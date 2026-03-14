# ADR: MCP Installer Error Handling and Rollback

## Status
**Proposed** - Pending Implementation

## Context
The MCP Installer (`packages/orchestrator/src/mcp-installer.ts`) handles installation of MCP servers from the marketplace, npm packages, or manual configurations. The current implementation has several deficiencies in error handling and rollback that need to be addressed.

### Current Issues Identified

1. **Incomplete Rollback Coverage**: The `rollbackInstallation` method exists but:
   - Rollback errors are silently swallowed (lines 690-693)
   - No logging or tracking of rollback failures
   - Users have no visibility into partial installation states

2. **Non-Descriptive Error Messages**: Current error messages lack actionable information:
   - "Failed to install MCP server 'X': Y" doesn't explain what step failed
   - No guidance on how to recover from failures
   - No indication of partial state that may need manual cleanup

3. **Installation Status Tracking Gaps**:
   - Status is not updated to 'failed' in the database on rollback
   - `verifyInstallation` only checks file presence, not content validity
   - No verification of npm package installation success
   - No tracking of corrupted/partial installations

4. **Missing Error Types**: The codebase has `ApexError` and `ApexErrorCode` but MCP installation-specific errors are not defined.

## Decision

### 1. Create MCP-Specific Error Types

Add new error codes to `ApexErrorCode` enum in `packages/core/src/apex-error.ts`:

```typescript
// MCP Installation errors (1900-1949)
MCP_INSTALLATION_FAILED = 'APEX_1900',
MCP_PACKAGE_INSTALL_FAILED = 'APEX_1901',
MCP_CONFIG_CREATION_FAILED = 'APEX_1902',
MCP_DATABASE_RECORD_FAILED = 'APEX_1903',
MCP_ROLLBACK_FAILED = 'APEX_1904',
MCP_VERIFICATION_FAILED = 'APEX_1905',
MCP_SERVER_NOT_FOUND = 'APEX_1906',
MCP_ALREADY_INSTALLED = 'APEX_1907',
MCP_UNINSTALL_FAILED = 'APEX_1908',
MCP_CORRUPTED_INSTALLATION = 'APEX_1909',
```

### 2. Define MCPInstallationError Class

Create a specialized error class for MCP installation operations:

```typescript
export interface MCPInstallationErrorContext extends ApexErrorContext {
  /** Server ID being installed */
  serverId?: string;
  /** Installation ID if created */
  installationId?: string;
  /** Package name being installed */
  packageName?: string;
  /** Installation step that failed */
  failedStep?: 'npm_install' | 'config_creation' | 'database_record' | 'verification';
  /** Rollback actions attempted */
  rollbackAttempts?: {
    step: string;
    success: boolean;
    error?: string;
  }[];
  /** Recommended recovery actions */
  recoverySteps?: string[];
}

export class MCPInstallationError extends ApexError {
  public readonly installationContext: MCPInstallationErrorContext;

  constructor(
    message: string,
    code: ApexErrorCode,
    context: MCPInstallationErrorContext,
    cause?: Error
  ) {
    super(message, code, context, cause);
    this.name = 'MCPInstallationError';
    this.installationContext = context;
  }

  /** Format user-friendly error message with recovery steps */
  public formatUserMessage(): string {
    let msg = this.message;
    if (this.installationContext.recoverySteps?.length) {
      msg += '\n\nSuggested recovery steps:\n';
      this.installationContext.recoverySteps.forEach((step, i) => {
        msg += `  ${i + 1}. ${step}\n`;
      });
    }
    return msg;
  }
}
```

### 3. Enhanced Rollback State Tracking

Extend `RollbackState` interface to track rollback outcomes:

```typescript
interface RollbackState {
  /** Whether the npm package was successfully installed */
  packageInstalled: boolean;
  /** Path to the config file if it was successfully created */
  configPath?: string;
  /** Installation ID if it was stored in the database */
  installationId?: string;
}

interface RollbackResult {
  /** Steps that were successfully rolled back */
  rolledBack: ('package' | 'config' | 'database')[];
  /** Steps that failed to rollback */
  failed: {
    step: 'package' | 'config' | 'database';
    error: Error;
  }[];
  /** Whether rollback was completely successful */
  success: boolean;
}
```

### 4. Improved rollbackInstallation Method

```typescript
private async rollbackInstallation(
  server: MCPServer,
  options: MCPInstallationOptions,
  state: RollbackState
): Promise<RollbackResult> {
  const result: RollbackResult = {
    rolledBack: [],
    failed: [],
    success: true,
  };

  // Step 3 rollback: Remove database record (reverse order)
  if (state.installationId) {
    try {
      // Update status to 'failed' before deleting
      await this.store.updateMcpInstallationStatus(
        state.installationId,
        'failed'
      );
      await this.store.removeMcpInstallation(state.installationId);
      result.rolledBack.push('database');
    } catch (e) {
      result.failed.push({ step: 'database', error: e as Error });
      result.success = false;
    }
  }

  // Step 2 rollback: Remove config file
  if (state.configPath) {
    try {
      await this.removeConfigFile(state.configPath);
      result.rolledBack.push('config');
    } catch (e) {
      result.failed.push({ step: 'config', error: e as Error });
      result.success = false;
    }
  }

  // Step 1 rollback: Uninstall npm package
  if (state.packageInstalled) {
    try {
      await this.executeUninstallCommand(server, options);
      result.rolledBack.push('package');
    } catch (e) {
      result.failed.push({ step: 'package', error: e as Error });
      result.success = false;
    }
  }

  // Log rollback outcome for debugging
  this.logRollbackResult(server.name, result);

  return result;
}
```

### 5. Enhanced verifyInstallation Method

```typescript
interface VerificationResult {
  isValid: boolean;
  checks: {
    databaseRecord: boolean;
    configFileExists: boolean;
    configFileValid: boolean;
    configContentValid: boolean;
    packageInstalled?: boolean;  // Optional npm verification
  };
  issues: string[];
  corruptionType?: 'missing_db_record' | 'missing_config' | 'invalid_config' | 'corrupted_package';
}

async verifyInstallation(serverId: string): Promise<VerificationResult> {
  const result: VerificationResult = {
    isValid: true,
    checks: {
      databaseRecord: false,
      configFileExists: false,
      configFileValid: false,
      configContentValid: false,
    },
    issues: [],
  };

  // Check 1: Database record exists
  const installation = await this.getInstallation(serverId);
  if (!installation) {
    result.isValid = false;
    result.issues.push(`No installation record found for server '${serverId}'`);
    result.corruptionType = 'missing_db_record';
    return result;
  }
  result.checks.databaseRecord = true;

  // Check 2: Config file exists
  try {
    await fs.access(installation.configPath);
    result.checks.configFileExists = true;
  } catch {
    result.isValid = false;
    result.issues.push(`Config file missing at: ${installation.configPath}`);
    result.corruptionType = 'missing_config';
    return result;
  }

  // Check 3: Config file contains valid JSON
  try {
    const content = await fs.readFile(installation.configPath, 'utf-8');
    const config = JSON.parse(content);
    result.checks.configFileValid = true;

    // Check 4: Config content has required fields
    if (!config.name || !config.command) {
      result.isValid = false;
      result.issues.push('Config file missing required fields (name, command)');
      result.corruptionType = 'invalid_config';
      return result;
    }
    result.checks.configContentValid = true;
  } catch (e) {
    result.isValid = false;
    result.issues.push(`Config file contains invalid JSON: ${(e as Error).message}`);
    result.corruptionType = 'invalid_config';
    return result;
  }

  // Check 5: Optional npm package verification (for npx/npm installations)
  if (installation.installedFrom === 'npm' || installation.installedFrom === 'npx') {
    try {
      const packageInstalled = await this.verifyPackageInstalled(serverId);
      result.checks.packageInstalled = packageInstalled;
      if (!packageInstalled) {
        result.isValid = false;
        result.issues.push(`npm package appears to be missing or corrupted`);
        result.corruptionType = 'corrupted_package';
      }
    } catch {
      // Package verification is optional, don't fail entirely
      result.checks.packageInstalled = undefined;
    }
  }

  return result;
}

private async verifyPackageInstalled(packageName: string): Promise<boolean> {
  try {
    await execAsync(`npm list ${packageName}`, { cwd: this.projectPath });
    return true;
  } catch {
    return false;
  }
}
```

### 6. Descriptive Error Messages with Recovery Steps

```typescript
private buildInstallationError(
  serverId: string,
  failedStep: MCPInstallationErrorContext['failedStep'],
  originalError: Error,
  rollbackResult?: RollbackResult
): MCPInstallationError {
  const recoverySteps: string[] = [];
  let code: ApexErrorCode;
  let message: string;

  switch (failedStep) {
    case 'npm_install':
      code = ApexErrorCode.MCP_PACKAGE_INSTALL_FAILED;
      message = `Failed to install npm package for MCP server '${serverId}'`;
      recoverySteps.push(
        'Check your network connection',
        'Verify the package name is correct',
        'Try running: npm cache clean --force',
        'Check npm registry status at status.npmjs.org'
      );
      break;
    case 'config_creation':
      code = ApexErrorCode.MCP_CONFIG_CREATION_FAILED;
      message = `Failed to create configuration file for MCP server '${serverId}'`;
      recoverySteps.push(
        'Check disk space availability',
        'Verify write permissions in .apex directory',
        'Try running with elevated privileges if needed'
      );
      break;
    case 'database_record':
      code = ApexErrorCode.MCP_DATABASE_RECORD_FAILED;
      message = `Failed to save installation record for MCP server '${serverId}'`;
      recoverySteps.push(
        'Check SQLite database integrity',
        'Verify .apex directory permissions',
        'Try running: apex db repair'
      );
      break;
    default:
      code = ApexErrorCode.MCP_INSTALLATION_FAILED;
      message = `Failed to install MCP server '${serverId}'`;
  }

  // Add rollback failure information
  if (rollbackResult && !rollbackResult.success) {
    message += '. Partial cleanup failed - manual intervention may be required.';
    rollbackResult.failed.forEach(f => {
      recoverySteps.push(`Manually remove ${f.step}: ${f.error.message}`);
    });
  }

  return new MCPInstallationError(
    message,
    code,
    {
      serverId,
      failedStep,
      rollbackAttempts: rollbackResult?.failed.map(f => ({
        step: f.step,
        success: false,
        error: f.error.message,
      })),
      recoverySteps,
    },
    originalError
  );
}
```

### 7. Add Status Update Method to TaskStore

Add a new method to update installation status without removing the record:

```typescript
// In packages/orchestrator/src/store.ts
async updateMcpInstallationStatus(
  id: string,
  status: MCPInstallationStatus
): Promise<boolean> {
  const stmt = this.db.prepare(`
    UPDATE mcp_installations
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  const result = stmt.run(status, new Date().toISOString(), id);
  return result.changes > 0;
}
```

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     MCP Installer Flow                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  install(server)                                                 │
│       │                                                          │
│       ├──▶ Check if already installed                           │
│       │         │                                                │
│       │         ├── Yes ──▶ throw MCP_ALREADY_INSTALLED         │
│       │         │                                                │
│       │         └── No ──▶ Continue                             │
│       │                                                          │
│       ├──▶ Step 1: executeInstallation()                        │
│       │         │                                                │
│       │         ├── Success ──▶ rollbackState.packageInstalled  │
│       │         │                                                │
│       │         └── Failure ──▶ throw with recovery steps       │
│       │                                                          │
│       ├──▶ Step 2: createConfigFile()                           │
│       │         │                                                │
│       │         ├── Success ──▶ rollbackState.configPath        │
│       │         │                                                │
│       │         └── Failure ──▶ rollback(step 1) + throw        │
│       │                                                          │
│       ├──▶ Step 3: store.createMcpInstallation()                │
│       │         │                                                │
│       │         ├── Success ──▶ rollbackState.installationId    │
│       │         │                                                │
│       │         └── Failure ──▶ rollback(steps 1,2) + throw     │
│       │                                                          │
│       └──▶ Return InstalledMCPResult                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                     Rollback Flow                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  rollbackInstallation(server, state)                            │
│       │                                                          │
│       ├──▶ Track RollbackResult                                 │
│       │                                                          │
│       ├──▶ Step 3 rollback: Remove DB record                    │
│       │         ├── Update status to 'failed'                   │
│       │         └── Delete record (or track failure)            │
│       │                                                          │
│       ├──▶ Step 2 rollback: Remove config file                  │
│       │         └── Delete file (or track failure)              │
│       │                                                          │
│       ├──▶ Step 1 rollback: Uninstall package                   │
│       │         └── npm uninstall (or track failure)            │
│       │                                                          │
│       ├──▶ Log rollback outcome                                 │
│       │                                                          │
│       └──▶ Return RollbackResult                                │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                  Verification Flow                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  verifyInstallation(serverId)                                   │
│       │                                                          │
│       ├──▶ Check 1: Database record exists                      │
│       │                                                          │
│       ├──▶ Check 2: Config file exists on disk                  │
│       │                                                          │
│       ├──▶ Check 3: Config file contains valid JSON             │
│       │                                                          │
│       ├──▶ Check 4: Config has required fields                  │
│       │                                                          │
│       ├──▶ Check 5: npm package installed (optional)            │
│       │                                                          │
│       └──▶ Return VerificationResult with issues[]              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## File Changes Required

### Files to Modify:

1. **`packages/core/src/apex-error.ts`**
   - Add MCP installation error codes (1900-1949)
   - Add `MCPInstallationError` class
   - Add `MCPInstallationErrorContext` interface
   - Export new types

2. **`packages/orchestrator/src/mcp-installer.ts`**
   - Import new error types from `@apexcli/core`
   - Update `RollbackState` interface
   - Add `RollbackResult` interface
   - Add `VerificationResult` interface
   - Refactor `rollbackInstallation()` to return `RollbackResult`
   - Refactor `verifyInstallation()` to return `VerificationResult`
   - Add `buildInstallationError()` helper method
   - Add `verifyPackageInstalled()` helper method
   - Add `logRollbackResult()` helper method
   - Update `install()` and `installFromNpm()` to use new error handling
   - Export new types

3. **`packages/orchestrator/src/store.ts`**
   - Add `updateMcpInstallationStatus()` method

4. **`packages/orchestrator/src/mcp-installer.test.ts`**
   - Add tests for rollback scenarios
   - Add tests for verification with corrupted installations
   - Add tests for error message formatting
   - Add tests for partial rollback failures

5. **`packages/core/src/mcp.ts`**
   - Re-export new error types

6. **`packages/orchestrator/src/index.ts`**
   - Export new types and interfaces

## Acceptance Criteria Verification

| Criteria | How It's Addressed |
|----------|-------------------|
| Installation failures rollback npm packages | `rollbackInstallation()` calls `executeUninstallCommand()` with proper error tracking |
| Installation failures rollback config files | `rollbackInstallation()` calls `removeConfigFile()` with proper error tracking |
| Installation failures rollback database records | `rollbackInstallation()` updates status to 'failed' then removes record |
| Error messages include actionable information | `MCPInstallationError.formatUserMessage()` includes recovery steps |
| `verifyInstallation` correctly identifies corrupted installations | Enhanced `verifyInstallation()` returns detailed `VerificationResult` with corruption types |

## Consequences

### Positive
- Users get clear guidance on how to recover from installation failures
- Partial installation states are properly tracked and can be cleaned up
- Corrupted installations can be identified programmatically
- Better observability through rollback result tracking
- Consistent error handling using project's `ApexError` pattern

### Negative
- Slightly increased complexity in error handling code
- Additional database method required in TaskStore
- Need to update existing tests to handle new error types

### Risks
- Rollback of npm packages may fail if the package was already installed by another project
- Package verification via `npm list` adds execution time to verification

## Implementation Notes

1. **Testing Priority**: Focus on edge cases:
   - Database write fails after npm install succeeds
   - Config file creation fails after npm install succeeds
   - Rollback of npm uninstall fails
   - Verification of missing vs corrupted vs valid installations

2. **Backwards Compatibility**: The enhanced `verifyInstallation()` should return a boolean by default for backwards compatibility, with an optional `detailed` parameter to get the full `VerificationResult`.

3. **Logging**: Consider adding a logging interface for rollback operations to aid debugging in production.

## Related Documents
- `packages/core/src/apex-error.ts` - Base error infrastructure
- `packages/orchestrator/src/mcp-store.ts` - Separate MCP store implementation (reference)
- `packages/core/src/types.ts` - MCPInstallation and MCPInstallationStatus types
