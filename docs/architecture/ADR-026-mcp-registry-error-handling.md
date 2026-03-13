# ADR-026: MCP Registry Catalog Loading and Error Handling

**Status**: Proposed
**Date**: 2026-03-13
**Context**: MCP Registry catalog loading and error handling improvements

## Summary

Design a robust error handling and fallback mechanism for MCP Registry catalog loading to ensure graceful degradation when `catalog.json` fails to load, with actionable validation error messages.

## Context

### Current State Analysis

The `MCPRegistry` class in `packages/core/src/mcp/mcp-registry.ts` currently:

1. **Loads catalog synchronously** via `readFileSync` in the constructor
2. **Throws `MCPCatalogLoadError`** when file read/parse fails
3. **Throws `MCPCatalogValidationError`** when catalog structure is invalid
4. **Uses singleton pattern** - errors during first `getInstance()` propagate to caller
5. **No fallback mechanism** - if catalog fails to load, the entire registry is unusable

### Problem Statement

The current implementation has several limitations:

1. **Brittle initialization**: Any failure during catalog loading makes the entire registry unusable
2. **Limited error context**: Error messages lack actionable details for debugging
3. **No graceful degradation**: Missing catalog means zero servers available
4. **Missing server-level validation**: Servers with partial data can cause runtime errors
5. **Synchronous-only loading**: No async alternative for non-blocking initialization

## Decision

Implement a multi-layered error handling strategy with graceful degradation:

### 1. Error Type Hierarchy Enhancement

Extend the existing error classes with richer context:

```typescript
// Enhanced error codes for specific failure scenarios
export enum MCPCatalogErrorCode {
  FILE_NOT_FOUND = 'MCP_CATALOG_FILE_NOT_FOUND',
  FILE_READ_ERROR = 'MCP_CATALOG_FILE_READ_ERROR',
  JSON_PARSE_ERROR = 'MCP_CATALOG_JSON_PARSE_ERROR',
  SCHEMA_VALIDATION_ERROR = 'MCP_CATALOG_SCHEMA_VALIDATION_ERROR',
  SERVER_VALIDATION_ERROR = 'MCP_CATALOG_SERVER_VALIDATION_ERROR',
}

// Enhanced load error with specific error code
export class MCPCatalogLoadError extends Error {
  readonly catalogPath: string;
  readonly cause?: Error;
  readonly errorCode: MCPCatalogErrorCode;
  readonly suggestions: string[];  // NEW: Actionable suggestions

  constructor(
    catalogPath: string,
    errorCode: MCPCatalogErrorCode,
    cause?: Error,
    suggestions?: string[]
  ) {
    const message = buildActionableErrorMessage(catalogPath, errorCode, cause);
    super(message);
    this.name = 'MCPCatalogLoadError';
    this.catalogPath = catalogPath;
    this.errorCode = errorCode;
    this.cause = cause;
    this.suggestions = suggestions ?? getDefaultSuggestions(errorCode);
  }
}

// Enhanced validation error with per-server details
export class MCPCatalogValidationError extends Error {
  readonly details: ValidationErrorDetail[];  // Enhanced from string[]
  readonly validServers: number;
  readonly invalidServers: number;

  constructor(details: ValidationErrorDetail[]) {
    super(formatValidationErrors(details));
    this.name = 'MCPCatalogValidationError';
    this.details = details;
    this.validServers = /* computed */;
    this.invalidServers = details.filter(d => d.severity === 'error').length;
  }
}

// New: Detailed validation error structure
export interface ValidationErrorDetail {
  field: string;          // Path to invalid field (e.g., "servers[2].name")
  message: string;        // Human-readable description
  severity: 'error' | 'warning';  // Whether it blocks loading
  suggestion?: string;    // How to fix it
  serverName?: string;    // Affected server (if applicable)
}
```

### 2. Fallback Catalog Mechanism

Implement a default empty catalog for graceful degradation:

```typescript
// Default empty catalog for graceful degradation
export const DEFAULT_EMPTY_CATALOG: MCPCatalog = {
  version: '0.0.0',
  updated: new Date().toISOString(),
  description: 'Default empty catalog (actual catalog failed to load)',
  categories: {},
  servers: [],
};

// Frozen to prevent accidental modification
Object.freeze(DEFAULT_EMPTY_CATALOG);
Object.freeze(DEFAULT_EMPTY_CATALOG.categories);
Object.freeze(DEFAULT_EMPTY_CATALOG.servers);
```

### 3. Graceful Loading Strategy

Add new options and behavior for controlled error handling:

```typescript
export interface MCPRegistryOptions {
  catalogPath?: string;
  validateOnLoad?: boolean;

  // NEW options for graceful degradation
  fallbackOnError?: boolean;        // Use empty catalog if load fails (default: false)
  warnOnValidationErrors?: boolean; // Log warnings vs throw for non-critical errors
  skipInvalidServers?: boolean;     // Load valid servers, skip invalid ones
  onError?: (error: MCPCatalogLoadError | MCPCatalogValidationError) => void;  // Error callback
}
```

### 4. Enhanced `loadCatalog` Method

```typescript
private loadCatalog(): MCPCatalog {
  const path = this.options.catalogPath;

  try {
    // Step 1: Read file
    let catalogData: string;
    try {
      catalogData = readFileSync(path, 'utf-8');
    } catch (error) {
      throw new MCPCatalogLoadError(
        path,
        error instanceof Error && error.message.includes('ENOENT')
          ? MCPCatalogErrorCode.FILE_NOT_FOUND
          : MCPCatalogErrorCode.FILE_READ_ERROR,
        error instanceof Error ? error : new Error(String(error)),
        [
          `Verify the catalog file exists at: ${path}`,
          'Check file permissions (requires read access)',
          'Ensure the file path is correct in your configuration',
        ]
      );
    }

    // Step 2: Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(catalogData);
    } catch (error) {
      throw new MCPCatalogLoadError(
        path,
        MCPCatalogErrorCode.JSON_PARSE_ERROR,
        error instanceof Error ? error : new Error(String(error)),
        [
          'Validate JSON syntax using a JSON validator',
          'Check for trailing commas or unquoted strings',
          `JSON parse error: ${error instanceof Error ? error.message : 'Unknown'}`,
        ]
      );
    }

    // Step 3: Validate structure with detailed errors
    return this.validateAndNormalize(parsed, path);

  } catch (error) {
    // Handle fallback if enabled
    if (this.options.fallbackOnError) {
      this.options.onError?.(error as MCPCatalogLoadError);
      console.warn(`[MCPRegistry] Falling back to empty catalog: ${(error as Error).message}`);
      return { ...DEFAULT_EMPTY_CATALOG };
    }
    throw error;
  }
}
```

### 5. Detailed Validation with Partial Success

```typescript
private validateAndNormalize(parsed: unknown, catalogPath: string): MCPCatalog {
  const errors: ValidationErrorDetail[] = [];
  const warnings: ValidationErrorDetail[] = [];

  // Type guard
  if (typeof parsed !== 'object' || parsed === null) {
    errors.push({
      field: 'root',
      message: 'Catalog must be a JSON object',
      severity: 'error',
      suggestion: 'Ensure the catalog file contains a valid JSON object with version, servers, and categories',
    });
    throw new MCPCatalogValidationError(errors);
  }

  const catalog = parsed as Record<string, unknown>;

  // Validate required top-level fields
  if (!catalog.version || typeof catalog.version !== 'string') {
    errors.push({
      field: 'version',
      message: 'Catalog version is required and must be a string',
      severity: 'error',
      suggestion: 'Add "version": "1.0.0" to the catalog root',
    });
  }

  if (!catalog.categories || typeof catalog.categories !== 'object') {
    errors.push({
      field: 'categories',
      message: 'Catalog must have a categories object',
      severity: 'error',
      suggestion: 'Add "categories": {} to the catalog (can be empty)',
    });
  }

  if (!Array.isArray(catalog.servers)) {
    errors.push({
      field: 'servers',
      message: 'Catalog must have a servers array',
      severity: 'error',
      suggestion: 'Add "servers": [] to the catalog',
    });
    throw new MCPCatalogValidationError(errors);
  }

  // Validate each server (with skipInvalidServers support)
  const validServers: MCPMarketplaceEntry[] = [];

  catalog.servers.forEach((server: unknown, index: number) => {
    const serverErrors = this.validateServer(server, index);

    if (serverErrors.length === 0) {
      validServers.push(server as MCPMarketplaceEntry);
    } else {
      const hasErrors = serverErrors.some(e => e.severity === 'error');

      if (hasErrors) {
        if (this.options.skipInvalidServers) {
          warnings.push(...serverErrors.map(e => ({ ...e, severity: 'warning' as const })));
        } else {
          errors.push(...serverErrors);
        }
      } else {
        warnings.push(...serverErrors);
        validServers.push(server as MCPMarketplaceEntry);
      }
    }
  });

  // Report warnings
  if (warnings.length > 0 && this.options.warnOnValidationErrors) {
    console.warn('[MCPRegistry] Validation warnings:', formatValidationErrors(warnings));
  }

  // Throw if critical errors and not skipping
  if (errors.length > 0 && !this.options.skipInvalidServers) {
    throw new MCPCatalogValidationError(errors);
  }

  // Return normalized catalog
  return {
    version: String(catalog.version ?? '0.0.0'),
    updated: String(catalog.updated ?? new Date().toISOString()),
    description: String(catalog.description ?? ''),
    categories: catalog.categories as MCPCatalog['categories'],
    servers: validServers,
  };
}

private validateServer(server: unknown, index: number): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];
  const prefix = `servers[${index}]`;

  if (typeof server !== 'object' || server === null) {
    return [{
      field: prefix,
      message: 'Server entry must be an object',
      severity: 'error',
      suggestion: `Ensure servers[${index}] is a valid object with name, description, and serverConfig`,
    }];
  }

  const s = server as Record<string, unknown>;
  const serverName = typeof s.name === 'string' ? s.name : `index ${index}`;

  // Required: name
  if (!s.name || typeof s.name !== 'string' || s.name.trim() === '') {
    errors.push({
      field: `${prefix}.name`,
      message: 'Server name is required and must be a non-empty string',
      severity: 'error',
      suggestion: 'Add a unique "name" field to identify the server',
      serverName,
    });
  }

  // Required: description
  if (!s.description || typeof s.description !== 'string' || s.description.trim() === '') {
    errors.push({
      field: `${prefix}.description`,
      message: 'Server description is required and must be a non-empty string',
      severity: 'error',
      suggestion: `Add a "description" field explaining what "${serverName}" does`,
      serverName,
    });
  }

  // Required: serverConfig
  if (!s.serverConfig || typeof s.serverConfig !== 'object') {
    errors.push({
      field: `${prefix}.serverConfig`,
      message: 'Server configuration is required',
      severity: 'error',
      suggestion: `Add a "serverConfig" object with at least "name" and "command" fields for "${serverName}"`,
      serverName,
    });
  } else {
    // Validate serverConfig structure
    const config = s.serverConfig as Record<string, unknown>;

    if (!config.command || typeof config.command !== 'string') {
      errors.push({
        field: `${prefix}.serverConfig.command`,
        message: 'Server config must have a command string',
        severity: 'error',
        suggestion: `Add "command" (e.g., "npx", "node") to serverConfig for "${serverName}"`,
        serverName,
      });
    }
  }

  // Optional but recommended: capabilities
  if (s.capabilities !== undefined && !Array.isArray(s.capabilities)) {
    errors.push({
      field: `${prefix}.capabilities`,
      message: 'Capabilities must be an array of strings',
      severity: 'warning',
      suggestion: `Change capabilities to an array, e.g., ["file:read", "file:write"] for "${serverName}"`,
      serverName,
    });
  }

  return errors;
}
```

### 6. Async Loading Alternative

Add an async factory method for non-blocking initialization:

```typescript
/**
 * Creates a new MCPRegistry instance asynchronously.
 * Useful for environments where blocking I/O should be avoided.
 *
 * @param options - Registry configuration options
 * @returns Promise resolving to the registry instance
 */
static async createAsync(options?: MCPRegistryOptions): Promise<MCPRegistry> {
  // Reset singleton for async creation
  if (options) {
    MCPRegistry.resetInstance();
  }

  return new Promise((resolve, reject) => {
    try {
      const registry = MCPRegistry.getInstance(options);
      resolve(registry);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Safely gets or creates the registry instance.
 * Returns null if loading fails instead of throwing.
 *
 * @param options - Registry configuration options
 * @returns The registry instance or null on failure
 */
static tryGetInstance(options?: MCPRegistryOptions): MCPRegistry | null {
  try {
    return MCPRegistry.getInstance(options);
  } catch {
    return null;
  }
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MCPRegistry                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────────┐     ┌────────────────┐   │
│  │  getInstance │────▶│   loadCatalog    │────▶│ validateAnd    │   │
│  │              │     │                  │     │ Normalize      │   │
│  └──────────────┘     └────────┬─────────┘     └───────┬────────┘   │
│         │                      │                       │            │
│         │                      ▼                       ▼            │
│         │             ┌────────────────┐      ┌────────────────┐    │
│         │             │  FILE_READ     │      │ SCHEMA_        │    │
│         │             │  Error?        │      │ VALIDATION?    │    │
│         │             └───────┬────────┘      └───────┬────────┘    │
│         │                     │                       │             │
│         │         ┌───────────┴────────┐    ┌────────┴────────┐    │
│         │         ▼                    ▼    ▼                 ▼    │
│         │   fallbackOnError?    MCPCatalogLoadError  skipInvalidServers?│
│         │         │                                           │     │
│         │    ┌────┴────┐                              ┌───────┴───┐ │
│         │    ▼         ▼                              ▼           ▼ │
│         │   YES       NO                             YES         NO │
│         │    │         │                              │           │ │
│         │    ▼         ▼                              ▼           ▼ │
│         │ DEFAULT_   THROW                      LOAD_VALID   THROW  │
│         │ EMPTY_                                SERVERS            │
│         │ CATALOG                               ONLY               │
│         │    │                                    │                │
│         ▼    ▼                                    ▼                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     buildLookupMaps()                          │ │
│  │   serversByName: Map<string, Entry>                            │ │
│  │   serversByCategory: Map<string, Entry[]>                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Error Message Examples

### File Not Found
```
MCPCatalogLoadError [MCP_CATALOG_FILE_NOT_FOUND]:
  Failed to load MCP catalog from /path/to/catalog.json

  The catalog file could not be found.

  Suggestions:
  • Verify the catalog file exists at: /path/to/catalog.json
  • Check file permissions (requires read access)
  • Ensure the file path is correct in your configuration
  • Run 'npm run build' to ensure catalog.json is copied to dist/
```

### JSON Parse Error
```
MCPCatalogLoadError [MCP_CATALOG_JSON_PARSE_ERROR]:
  Failed to parse catalog JSON at /path/to/catalog.json

  Unexpected token '}' at position 1234

  Suggestions:
  • Validate JSON syntax using a JSON validator (e.g., jsonlint.com)
  • Check for trailing commas after the last item in arrays/objects
  • Ensure all strings are properly quoted
  • Look for unescaped special characters in string values
```

### Validation Error
```
MCPCatalogValidationError:
  MCP catalog validation failed with 3 errors:

  [ERROR] servers[2].name: Server name is required and must be a non-empty string
          Suggestion: Add a unique "name" field to identify the server

  [ERROR] servers[5].serverConfig: Server configuration is required
          Suggestion: Add a "serverConfig" object with at least "name" and "command" fields

  [WARNING] servers[8].capabilities: Capabilities must be an array of strings
            Suggestion: Change capabilities to an array, e.g., ["file:read"]

  Valid servers: 12 | Invalid servers: 3 | Warnings: 1
```

## Consequences

### Positive

1. **Graceful degradation**: Systems can continue operating with reduced functionality
2. **Actionable errors**: Users can self-diagnose and fix issues
3. **Partial loading**: Valid servers remain available even when some are invalid
4. **Flexible configuration**: Teams can choose strict vs. lenient validation
5. **Better debugging**: Rich error context aids troubleshooting
6. **Production resilience**: `fallbackOnError` prevents hard crashes in production

### Negative

1. **Increased complexity**: More code paths to test and maintain
2. **Silent failures possible**: `skipInvalidServers` may hide configuration issues
3. **Memory overhead**: Slightly more memory for error context objects

### Neutral

1. **Backward compatible**: Default behavior remains strict (throws on errors)
2. **Opt-in features**: New behavior requires explicit configuration

## Implementation Plan

### Phase 1: Error Enhancement (Low Risk)
1. Add `MCPCatalogErrorCode` enum
2. Enhance `MCPCatalogLoadError` with error codes and suggestions
3. Add `ValidationErrorDetail` type
4. Enhance `MCPCatalogValidationError` with detailed errors
5. Update existing tests

### Phase 2: Fallback Mechanism (Medium Risk)
1. Add `DEFAULT_EMPTY_CATALOG` constant
2. Add new `MCPRegistryOptions` fields
3. Implement `fallbackOnError` behavior
4. Implement `skipInvalidServers` behavior
5. Add new tests for fallback scenarios

### Phase 3: Async Support (Low Risk)
1. Add `createAsync` static method
2. Add `tryGetInstance` static method
3. Add async tests

## Test Cases Required

### Error Message Tests
- [ ] FILE_NOT_FOUND produces actionable message
- [ ] JSON_PARSE_ERROR includes syntax error details
- [ ] SCHEMA_VALIDATION_ERROR lists all invalid fields
- [ ] SERVER_VALIDATION_ERROR identifies specific server

### Fallback Tests
- [ ] `fallbackOnError: true` returns empty catalog on file error
- [ ] `fallbackOnError: true` returns empty catalog on parse error
- [ ] `fallbackOnError: false` (default) throws on errors
- [ ] `onError` callback is invoked before fallback

### Partial Loading Tests
- [ ] `skipInvalidServers: true` loads valid servers only
- [ ] Invalid servers are reported as warnings
- [ ] Valid server count is accurate
- [ ] Category maps exclude invalid servers

### Edge Cases
- [ ] Empty catalog file (`{}`)
- [ ] Catalog with only invalid servers
- [ ] Catalog with mixed valid/invalid servers
- [ ] Deeply nested validation errors
- [ ] Unicode characters in error messages

## Files to Modify

1. `packages/core/src/mcp/mcp-registry.ts` - Main implementation
2. `packages/core/src/mcp/index.ts` - Export new types
3. `packages/core/src/__tests__/mcp-registry.test.ts` - Update existing tests
4. `packages/core/src/__tests__/mcp-registry.edge-cases.test.ts` - Add fallback tests
5. `packages/core/src/__tests__/mcp-registry.error-handling.test.ts` - NEW: Dedicated error tests

## Decision

**APPROVED** - Implement the multi-layered error handling strategy with graceful degradation as described above.

## References

- ADR-024: MCP Registry Architecture (existing)
- ADR-025: MCP Protocol Types (existing)
- `packages/core/src/apex-error.ts` - APEX error patterns
- `packages/core/src/tools/tool-registry.ts` - Similar registry pattern
