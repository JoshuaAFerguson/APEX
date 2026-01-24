# ADR: MCPInstaller Rollback on Failure - Technical Design

## Status: Accepted

## Context

The MCPInstaller class (`packages/orchestrator/src/mcp-installer.ts`) manages MCP server installations via a multi-step process:

1. Check existing installation state (`getInstallation`)
2. Execute npm install command (`executeInstallation`)
3. Create configuration file (`createConfigFile` - includes `mkdir` + `writeFile`)
4. Store installation record in SQLite (`store.createMcpInstallation`)

Currently, the `install()` method has a basic try/catch that wraps the error but performs **no rollback** of partial state. This means if step 3 fails, step 2's npm package remains installed as an orphan. If step 4 fails, both the npm package and config file remain as orphaned artifacts.

The ADR `ADR-mcp-installer-rollback-tests.md` defines the test structure. This document defines the **implementation architecture** for both the rollback mechanism and the unit tests.

## Decision

### 1. MCPInstaller Rollback Implementation Architecture

#### 1.1 Rollback State Tracking Interface

```typescript
interface RollbackState {
  /** Whether the npm package was successfully installed */
  packageInstalled: boolean;
  /** Path to the config file if it was successfully created */
  configPath?: string;
  /** Installation ID if it was stored in the database */
  installationId?: string;
}
```

#### 1.2 New Private Method: `rollbackInstallation`

**Location**: Add to `MCPInstaller` class in `mcp-installer.ts`

```typescript
/**
 * Rollback a partial installation by cleaning up state in reverse order.
 * This is best-effort: individual rollback steps may fail without
 * preventing other rollback steps from executing.
 */
private async rollbackInstallation(
  server: MCPServer,
  options: MCPInstallationOptions,
  state: RollbackState
): Promise<void> {
  const errors: Error[] = [];

  // Step 3 rollback: Remove database record (reverse of step 4)
  if (state.installationId) {
    try {
      await this.store.removeMcpInstallation(state.installationId);
    } catch (e) {
      errors.push(e as Error);
    }
  }

  // Step 2 rollback: Remove config file (reverse of step 3)
  if (state.configPath) {
    try {
      await this.removeConfigFile(state.configPath);
    } catch (e) {
      errors.push(e as Error);
    }
  }

  // Step 1 rollback: Uninstall npm package (reverse of step 2)
  if (state.packageInstalled) {
    try {
      await this.executeUninstallCommand(server, options);
    } catch (e) {
      errors.push(e as Error);
    }
  }

  // Rollback errors are logged but not thrown - this is best-effort cleanup
  if (errors.length > 0) {
    // Future: could emit a warning event
  }
}
```

#### 1.3 New Private Method: `executeUninstallCommand`

```typescript
/**
 * Execute npm uninstall for the given server package.
 * Used during rollback to remove packages that were installed
 * before a subsequent step failed.
 */
private async executeUninstallCommand(
  server: MCPServer,
  options: MCPInstallationOptions
): Promise<void> {
  const packageName = this.extractPackageName(server);
  const parts = ['npm', 'uninstall'];
  if (options.global) parts.push('-g');
  parts.push(packageName);

  await execAsync(parts.join(' '), {
    cwd: this.projectPath,
    env: { ...process.env, ...options.env },
  });
}
```

#### 1.4 New Public Method: `verifyInstallation`

```typescript
/**
 * Verify that an installation is in a consistent state:
 * - Installation record exists in database
 * - Config file exists on disk
 * - Config file contains valid JSON
 */
async verifyInstallation(serverId: string): Promise<boolean> {
  const installation = await this.getInstallation(serverId);
  if (!installation) return false;

  try {
    await fs.access(installation.configPath);
    const content = await fs.readFile(installation.configPath, 'utf-8');
    JSON.parse(content); // Verify valid JSON
    return true;
  } catch {
    return false;
  }
}
```

#### 1.5 Modified `install()` Method

The existing `install()` method at lines 46-79 is modified to:
1. Track rollback state progressively
2. Separate the `createConfigFile` call from the installation record creation
3. Call `rollbackInstallation` in the catch block

```typescript
async install(
  server: MCPServer,
  options: MCPInstallationOptions = {}
): Promise<MCPInstallation> {
  // Check if already installed
  const existing = await this.getInstallation(server.name);
  if (existing && !options.force) {
    throw new Error(`MCP server '${server.name}' is already installed. Use force option to reinstall.`);
  }

  const installationId = this.generateInstallationId();
  const rollbackState: RollbackState = {
    packageInstalled: false,
    configPath: undefined,
    installationId: undefined,
  };

  try {
    // Step 1: Execute npm install
    await this.executeInstallation(server, options);
    rollbackState.packageInstalled = true;

    // Step 2: Create config file
    const configPath = await this.createConfigFile(server, installationId);
    rollbackState.configPath = configPath;

    // Step 3: Store installation record
    const installation: MCPInstallation = {
      id: installationId,
      serverId: server.name,
      installedAt: new Date(),
      status: 'installed' as MCPInstallationStatus,
      configPath,
    };
    await this.store.createMcpInstallation(installation);
    rollbackState.installationId = installationId;

    return installation;
  } catch (error) {
    // Rollback any partial state
    await this.rollbackInstallation(server, options, rollbackState);
    throw new Error(
      `Failed to install MCP server '${server.name}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

### 2. Test Architecture

#### 2.1 Test File Structure

**File**: `packages/orchestrator/src/__tests__/mcp-installer-rollback.test.ts`

#### 2.2 Mock Strategy

The tests use complete mocking of external dependencies (consistent with existing tests in `mcp-installer-dependency-resolution.test.ts`):

```typescript
// Mock filesystem operations
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
  },
}));

// Mock child_process.exec (used via promisify)
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock TaskStore
vi.mock('../store');
```

#### 2.3 Test Setup Pattern

```typescript
let installer: MCPInstaller;
let mockStore: {
  createMcpInstallation: ReturnType<typeof vi.fn>;
  getMcpInstallation: ReturnType<typeof vi.fn>;
  removeMcpInstallation: ReturnType<typeof vi.fn>;
  listMcpInstallations: ReturnType<typeof vi.fn>;
  upsertMcpMarketplaceEntry: ReturnType<typeof vi.fn>;
  listMcpMarketplaceEntries: ReturnType<typeof vi.fn>;
};
let mockExec: ReturnType<typeof vi.fn>;
let mockFs: {
  mkdir: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  unlink: ReturnType<typeof vi.fn>;
  access: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
};

const projectPath = '/test/project';

function createTestServer(name: string = 'test-server', overrides: Partial<MCPServer> = {}): MCPServer {
  return {
    name,
    package: `@test/${name}`,
    command: 'npx',
    args: [`@test/${name}`],
    version: '1.0.0',
    ...overrides,
  };
}
```

#### 2.4 Test Categories and Scenarios

##### Category 1: Rollback on Download/Install Failure

| Test | Scenario | Expected Behavior |
|------|----------|-------------------|
| 1.1 | `executeInstallation` (npm install) fails | Error propagates, no rollback needed (nothing to clean up) |
| 1.2 | npm install fails | No `createConfigFile` or `store.createMcpInstallation` called |
| 1.3 | npm install fails | No store record created |
| 1.4 | Network timeout during npm install | Same as install failure - error propagates cleanly |

##### Category 2: Rollback on Corrupted Files

| Test | Scenario | Expected Behavior |
|------|----------|-------------------|
| 2.1 | `writeFile` produces invalid JSON config | Rollback: uninstall package |
| 2.2 | `writeFile` throws (disk full, permissions) | Rollback: uninstall package |
| 2.3 | `mkdir` fails for config directory | Rollback: uninstall package |
| 2.4 | `verifyInstallation` detects corruption | Returns false, caller can decide to uninstall |

##### Category 3: Rollback on Dependency Failure

| Test | Scenario | Expected Behavior |
|------|----------|-------------------|
| 3.1 | Required dependency install fails | All previously installed deps are uninstalled |
| 3.2 | Dependency fails mid-chain | Target + partial deps cleaned up |
| 3.3 | Optional dependency fails | No rollback (optional deps are best-effort) |
| 3.4 | Dependency resolution fails after partial installs | All partial installs cleaned up |

##### Category 4: Partial Installation Cleanup

| Test | Scenario | Expected Behavior |
|------|----------|-------------------|
| 4.1 | `store.createMcpInstallation` throws | Config file removed + package uninstalled |
| 4.2 | `createConfigFile` throws after successful install | Package uninstalled |
| 4.3 | Rollback itself fails (uninstall command fails) | Error swallowed, best-effort cleanup |
| 4.4 | Config dir was created fresh for this installation | Dir remains (shared resource, not cleaned) |
| 4.5 | Multiple installations exist | Only failed installation's artifacts cleaned |

##### Category 5: Rollback State Verification

| Test | Scenario | Expected Behavior |
|------|----------|-------------------|
| 5.1 | After rollback from config failure | No installation record in store |
| 5.2 | After rollback from store failure | No config file on disk |
| 5.3 | Force reinstall fails | Previous installation state preserved |
| 5.4 | After failed install + rollback | `isInstalled()` returns false |
| 5.5 | After failed install + rollback | No zombie entries in store |

#### 2.5 Mock Configuration Patterns

**Pattern A: npm install succeeds, later step fails**
```typescript
mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
  if (cmd.includes('npm install')) {
    cb(null, { stdout: 'installed', stderr: '' });
  } else if (cmd.includes('npm uninstall')) {
    cb(null, { stdout: 'removed', stderr: '' });
  }
  return {} as any;
});
```

**Pattern B: npm install fails**
```typescript
mockExec.mockImplementation((cmd: string, opts: any, cb: Function) => {
  if (cmd.includes('npm install')) {
    cb(new Error('ENETUNREACH: network timeout'));
  }
  return {} as any;
});
```

**Pattern C: writeFile fails (config creation)**
```typescript
mockFs.writeFile.mockRejectedValueOnce(new Error('ENOSPC: disk full'));
```

**Pattern D: store operation fails**
```typescript
mockStore.createMcpInstallation.mockRejectedValueOnce(
  new Error('SQLITE_CONSTRAINT: unique violation')
);
```

#### 2.6 Assertion Patterns

```typescript
// Verify rollback uninstall was triggered
expect(mockExec).toHaveBeenCalledWith(
  expect.stringContaining('npm uninstall'),
  expect.objectContaining({ cwd: projectPath }),
  expect.any(Function)
);

// Verify config file was cleaned up
expect(mockFs.unlink).toHaveBeenCalledWith(
  expect.stringContaining('.apex/mcp-installations/')
);

// Verify no store record remains
expect(mockStore.removeMcpInstallation).toHaveBeenCalled();

// Verify error is still thrown to caller
await expect(installer.install(server)).rejects.toThrow(
  /Failed to install MCP server/
);

// Verify clean state after rollback
expect(mockStore.createMcpInstallation).not.toHaveBeenCalled(); // if failure before store step
```

### 3. Implementation Order (for Developer Stage)

1. **Add `RollbackState` interface** to `mcp-installer.ts`
2. **Add `executeUninstallCommand()`** private method
3. **Add `rollbackInstallation()`** private method
4. **Add `verifyInstallation()`** public method
5. **Modify `install()`** to track rollback state and call rollback on failure
6. **Create test file** `mcp-installer-rollback.test.ts` with all 5 categories
7. **Run tests** to verify all pass
8. **Run build** to verify TypeScript compiles

### 4. Interface Contracts

#### MCPInstaller Public API Changes

| Method | Signature | Description |
|--------|-----------|-------------|
| `verifyInstallation` | `(serverId: string) => Promise<boolean>` | Verify installation integrity |

#### MCPInstaller Private Method Additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `rollbackInstallation` | `(server, options, state) => Promise<void>` | Best-effort rollback |
| `executeUninstallCommand` | `(server, options) => Promise<void>` | Run npm uninstall |

#### Modified Methods

| Method | Change |
|--------|--------|
| `install()` | Adds rollback state tracking + calls `rollbackInstallation` on failure |

### 5. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/orchestrator/src/mcp-installer.ts` | Modify | Add rollback methods + modify install() |
| `packages/orchestrator/src/__tests__/mcp-installer-rollback.test.ts` | Create | All rollback unit tests (5 categories, ~21 tests) |

### 6. Dependencies and Compatibility

- No new npm dependencies required
- Uses existing `execAsync` (promisified `exec`) already imported
- Uses existing `removeConfigFile` private method already in the class
- Uses existing `extractPackageName` private method already in the class
- The `verifyInstallation` method uses `fs.access` and `fs.readFile` - both already imported via `promises as fs`
- The `MCPInstallation` and `MCPServer` types are already imported from `@apexcli/core`

### 7. Error Handling Philosophy

- **Rollback is best-effort**: If a rollback step fails, the error is captured but does not prevent other rollback steps from executing
- **Original error preserved**: The error that triggered the rollback is always thrown to the caller, wrapped in a descriptive message
- **No cascading failures**: A failing rollback step (e.g., `npm uninstall` fails) does not cause additional exceptions
- **Idempotent cleanup**: `removeConfigFile` already handles `ENOENT` gracefully

## Consequences

### Positive
- Installation failures leave no orphaned artifacts (packages, config files, DB records)
- Best-effort approach ensures partial cleanup even when rollback steps fail
- `verifyInstallation` provides a way to detect and handle corrupted installations
- Tests comprehensively cover all failure points with proper assertions

### Negative
- Slight increase in complexity of the `install()` method
- Rollback of npm packages (`npm uninstall`) adds a command execution that could itself fail
- The `mcp-installations/` directory is not cleaned up (shared resource across installations)

### Risks
- `npm uninstall` timing: If the process is killed during rollback, packages may remain
- File system race conditions: Config file could be read between creation and rollback
- Mitigation: Both risks are acceptable for development tooling; `verifyInstallation` provides detection
