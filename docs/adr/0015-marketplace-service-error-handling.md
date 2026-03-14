# ADR-0015: MCP Marketplace Service Error Handling and Edge Cases

## Status
Proposed

## Context
The `MCPMarketplaceService` in `packages/orchestrator/src/mcp/marketplace-service.ts` has three areas requiring improvement to meet acceptance criteria:

1. **`loadMarketplaceData` missing data file handling** - Current implementation throws a generic error when the marketplace data file is missing, which doesn't provide graceful degradation.

2. **`autoConfigureStandardTools` error feedback** - The method doesn't provide accurate categorization of servers into configured/skipped/errors arrays in all edge cases.

3. **Project type detection** - The `getRecommendedServersForProject` method uses synchronous `require('fs').existsSync()` which is inconsistent with the async patterns in the codebase and may throw unhandled errors.

## Decision

### 1. Enhanced `loadMarketplaceData` with Graceful Degradation

**Current Behavior:**
```typescript
async loadMarketplaceData(): Promise<MarketplaceMetadata> {
  try {
    const dataPath = path.join(__dirname, 'marketplace-data.json');
    const content = await fs.readFile(dataPath, 'utf-8');
    // ... parsing
  } catch (error) {
    throw new Error(`Failed to load marketplace data: ${error.message}`);
  }
}
```

**Proposed Changes:**

1. Add explicit file existence check with informative error messages
2. Return empty/default data when file is missing (optional graceful mode)
3. Add specific error types for different failure scenarios

```typescript
export class MarketplaceDataError extends Error {
  constructor(
    message: string,
    public readonly code: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR',
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MarketplaceDataError';
  }
}

async loadMarketplaceData(options?: {
  gracefulFallback?: boolean
}): Promise<MarketplaceMetadata> {
  if (this.marketplaceData) {
    return this.marketplaceData;
  }

  const dataPath = path.join(__dirname, 'marketplace-data.json');

  // Check file existence first
  try {
    await fs.access(dataPath);
  } catch (accessError) {
    if (options?.gracefulFallback) {
      this.marketplaceData = { entries: [], categories: [], featured: [] };
      return this.marketplaceData;
    }
    throw new MarketplaceDataError(
      `Marketplace data file not found at ${dataPath}`,
      'FILE_NOT_FOUND',
      accessError instanceof Error ? accessError : undefined
    );
  }

  try {
    const content = await fs.readFile(dataPath, 'utf-8');
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      throw new MarketplaceDataError(
        'Marketplace data file contains invalid JSON',
        'PARSE_ERROR',
        parseError instanceof Error ? parseError : undefined
      );
    }

    // Validate with Zod
    const validatedEntries = MCPMarketplaceEntrySchema.array().safeParse(
      (parsed as Record<string, unknown>).entries
    );

    if (!validatedEntries.success) {
      throw new MarketplaceDataError(
        `Marketplace entries validation failed: ${validatedEntries.error.message}`,
        'VALIDATION_ERROR'
      );
    }

    this.marketplaceData = {
      entries: validatedEntries.data,
      categories: (parsed as Record<string, unknown>).categories as string[] || [],
      featured: (parsed as Record<string, unknown>).featured as string[] || [],
    };

    return this.marketplaceData;
  } catch (error) {
    if (error instanceof MarketplaceDataError) {
      throw error;
    }
    throw new MarketplaceDataError(
      `Failed to load marketplace data: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_NOT_FOUND',
      error instanceof Error ? error : undefined
    );
  }
}
```

### 2. Improved `autoConfigureStandardTools` Result Accuracy

**Current Issues:**
- Errors during configuration are caught but may not accurately reflect the state
- The `saveConfig` call happens outside the per-server try-catch, so a save failure affects all servers
- The configured array contains server configs, but errors during save could leave the config in an inconsistent state

**Proposed Changes:**

```typescript
export interface AutoConfigurationResult {
  configured: MCPServerConfig[];
  skipped: Array<{
    name: string;
    reason: 'already_installed' | 'excluded_by_user';
  }>;
  errors: Array<{
    name: string;
    error: string;
    code: 'NOT_FOUND' | 'CONFIGURATION_ERROR' | 'SAVE_ERROR';
  }>;
  /** Indicates if configuration was persisted successfully */
  saved: boolean;
  /** Any warning messages */
  warnings: string[];
}

async autoConfigureStandardTools(options?: AutoConfigurationOptions): Promise<AutoConfigurationResult> {
  const result: AutoConfigurationResult = {
    configured: [],
    skipped: [],
    errors: [],
    saved: false,
    warnings: [],
  };

  let serversToInstall: string[] = [];

  // Determine which servers to install based on options
  if (options?.developmentTools) {
    serversToInstall.push(...this.toolCollections.development);
  }
  if (options?.productivityTools) {
    serversToInstall.push(...this.toolCollections.productivity);
  }
  if (options?.devopsTools) {
    serversToInstall.push(...this.toolCollections.devops);
  }
  if (options?.customServers) {
    serversToInstall.push(...options.customServers);
  }

  // Default auto-configuration if no options provided
  if (!options || Object.keys(options).length === 0) {
    try {
      serversToInstall = this.getRecommendedServersForProject();
    } catch (detectionError) {
      result.warnings.push(
        `Project detection failed: ${detectionError instanceof Error ? detectionError.message : String(detectionError)}. Using minimal defaults.`
      );
      serversToInstall = ['filesystem', 'web-search'];
    }
  }

  // Remove duplicates
  serversToInstall = [...new Set(serversToInstall)];

  // Track servers that were successfully configured before save
  const pendingConfigs: Array<{ name: string; config: MCPServerConfig }> = [];

  // Install each server
  for (const serverName of serversToInstall) {
    try {
      // Check if already installed
      const currentServers = getMCPServers(this.config);
      if (currentServers[serverName]) {
        result.skipped.push({
          name: serverName,
          reason: 'already_installed'
        });
        continue;
      }

      const entry = await this.getMarketplaceEntry(serverName);
      if (!entry) {
        result.errors.push({
          name: serverName,
          error: 'Server not found in marketplace',
          code: 'NOT_FOUND'
        });
        continue;
      }

      // Auto-configure with environment-specific settings
      const autoConfiguredServer = this.autoConfigureServer(entry.serverConfig);
      pendingConfigs.push({ name: serverName, config: autoConfiguredServer });

    } catch (error) {
      result.errors.push({
        name: serverName,
        error: error instanceof Error ? error.message : String(error),
        code: 'CONFIGURATION_ERROR'
      });
    }
  }

  // Apply all pending configurations
  if (pendingConfigs.length > 0) {
    const mcpConfig = this.config.mcp || { enabled: true, servers: {} };
    const currentServers = getMCPServers(this.config);

    for (const { name, config } of pendingConfigs) {
      mcpConfig.servers = {
        ...currentServers,
        ...mcpConfig.servers,
        [name]: config,
      };
      result.configured.push(config);
    }

    this.config.mcp = mcpConfig;

    // Save configuration
    try {
      await saveConfig(this.projectPath, this.config);
      result.saved = true;
    } catch (saveError) {
      // Move all configured to errors since save failed
      const savedConfigs = [...result.configured];
      result.configured = [];

      for (const config of savedConfigs) {
        result.errors.push({
          name: config.name,
          error: `Save failed: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
          code: 'SAVE_ERROR'
        });
      }
    }
  } else {
    // Nothing to save, mark as successful
    result.saved = true;
  }

  return result;
}
```

### 3. Robust Project Type Detection

**Current Issues:**
- Uses synchronous `require('fs').existsSync()` which is inconsistent with async patterns
- Catches errors but falls back silently without specific handling for different project types
- Limited detection (only .git, package.json, Dockerfile, k8s directory)

**Proposed Changes:**

Add additional project type detection and make it more robust:

```typescript
export interface ProjectTypeDetection {
  hasGit: boolean;
  hasNodeJS: boolean;
  hasPython: boolean;
  hasDocker: boolean;
  hasKubernetes: boolean;
  hasRust: boolean;
  hasGo: boolean;
  hasDotNet: boolean;
  errors: string[];
}

/**
 * Detect project types by checking for common project indicators.
 * Uses synchronous fs operations for reliability but handles errors gracefully.
 */
private detectProjectTypes(): ProjectTypeDetection {
  const result: ProjectTypeDetection = {
    hasGit: false,
    hasNodeJS: false,
    hasPython: false,
    hasDocker: false,
    hasKubernetes: false,
    hasRust: false,
    hasGo: false,
    hasDotNet: false,
    errors: [],
  };

  const checkFile = (relativePath: string): boolean => {
    try {
      const fullPath = path.join(this.projectPath, relativePath);
      return fsSync.existsSync(fullPath);
    } catch (error) {
      result.errors.push(
        `Failed to check ${relativePath}: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  };

  // Git repository
  result.hasGit = checkFile('.git');

  // Node.js project
  result.hasNodeJS = checkFile('package.json');

  // Python project
  result.hasPython =
    checkFile('requirements.txt') ||
    checkFile('pyproject.toml') ||
    checkFile('setup.py') ||
    checkFile('Pipfile');

  // Docker
  result.hasDocker =
    checkFile('Dockerfile') ||
    checkFile('docker-compose.yml') ||
    checkFile('docker-compose.yaml') ||
    checkFile('.dockerignore');

  // Kubernetes
  result.hasKubernetes =
    checkFile('k8s') ||
    checkFile('kubernetes') ||
    checkFile('helm') ||
    checkFile('charts');

  // Rust
  result.hasRust = checkFile('Cargo.toml');

  // Go
  result.hasGo = checkFile('go.mod');

  // .NET
  result.hasDotNet =
    checkFile('*.csproj') ||
    checkFile('*.sln') ||
    checkFile('global.json');

  return result;
}

/**
 * Get recommended servers based on project analysis
 */
private getRecommendedServersForProject(): string[] {
  const recommended: string[] = ['filesystem']; // Always recommend filesystem access

  const projectTypes = this.detectProjectTypes();

  // Log any detection errors as warnings
  if (projectTypes.errors.length > 0) {
    console.warn('Project detection warnings:', projectTypes.errors);
  }

  // Git repository
  if (projectTypes.hasGit) {
    recommended.push('git');
  }

  // Node.js project - likely uses GitHub
  if (projectTypes.hasNodeJS) {
    recommended.push('github-integration');
  }

  // Docker present
  if (projectTypes.hasDocker) {
    recommended.push('docker-management');
  }

  // Kubernetes present
  if (projectTypes.hasKubernetes) {
    recommended.push('kubernetes-operator');
  }

  // Database recommendations based on project
  if (projectTypes.hasNodeJS || projectTypes.hasPython) {
    recommended.push('database');
  }

  // Always recommend web search for general productivity
  recommended.push('web-search');

  return [...new Set(recommended)]; // Remove duplicates
}
```

## Consequences

### Positive
1. **Better error messages** - Users get specific error codes and messages to understand what went wrong
2. **Graceful degradation** - Option to return empty data when marketplace file is missing
3. **Accurate result reporting** - The `autoConfigureStandardTools` now accurately reports what was configured, skipped, and what errors occurred
4. **Save failure handling** - Configuration save failures are now properly tracked and reported
5. **Extended project detection** - Support for Python, Rust, Go, and .NET project types
6. **Robust error handling** - Each file check is wrapped in try-catch for resilience

### Negative
1. **API change** - The `autoConfigureStandardTools` return type changes (breaking change for callers)
2. **Slightly more complex** - More code to handle edge cases
3. **New dependency on fsSync** - Using both async and sync fs operations

### Neutral
1. **Backward compatibility** - The `loadMarketplaceData` graceful fallback is opt-in via options parameter
2. **Performance** - Sync file checks are fast enough for this use case

## Implementation Notes

1. Export the new `MarketplaceDataError` class for consumers to catch specific errors
2. Update tests to cover all new error scenarios
3. Document the new `gracefulFallback` option in JSDoc
4. Consider adding a `validate` method to check marketplace data without loading
5. The `detectProjectTypes` result could be exposed publicly for UI consumption

## References
- Original acceptance criteria in task description
- Existing tests in `packages/orchestrator/src/mcp/__tests__/marketplace-service.test.ts`
- Core types in `packages/core/src/types.ts`
