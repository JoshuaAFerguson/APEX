# ADR: MCPInstaller Rollback on Failure - Unit Test Architecture

## Status: Accepted

## Context

The MCPInstaller class manages MCP server installations with a multi-step process:
1. Check existing installation state
2. Execute npm install command (`executeInstallation`)
3. Create configuration file (`createConfigFile`)
4. Store installation record in SQLite (`store.createMcpInstallation`)

Currently, when failures occur at steps 2-4, the installer throws an error but does **not** perform rollback of any partial state created by prior successful steps. The task requires implementing rollback functionality in the MCPInstaller and comprehensive unit tests to verify correct rollback behavior.

## Decision

### Rollback Mechanism Design

The MCPInstaller `install()` method will be enhanced with a rollback mechanism that cleans up partial state when any step fails. The rollback should undo operations in reverse order.

#### Failure Points and Required Rollback Actions

| Failure Point | State Created Before Failure | Rollback Actions Required |
|---|---|---|
| `executeInstallation` (npm install) | None | No rollback needed (error propagates) |
| `createConfigFile` (mkdir/writeFile) | npm package installed | Run `npm uninstall <package>` |
| `store.createMcpInstallation` | npm package + config file | Remove config file + run `npm uninstall` |
| Corrupted download (post-install verification) | npm package (corrupted) | Run `npm uninstall <package>` |
| Dependency resolution failure | Partial deps installed | Uninstall all partially installed deps |

#### MCPInstaller Changes (for developer stage)

```typescript
// New private method to add to MCPInstaller
private async rollbackInstallation(
  server: MCPServer,
  options: MCPInstallationOptions,
  state: {
    packageInstalled: boolean;
    configPath?: string;
    installationId?: string;
  }
): Promise<void> {
  const errors: Error[] = [];

  // Rollback in reverse order
  if (state.installationId) {
    try {
      await this.store.removeMcpInstallation(state.installationId);
    } catch (e) { errors.push(e as Error); }
  }

  if (state.configPath) {
    try {
      await this.removeConfigFile(state.configPath);
    } catch (e) { errors.push(e as Error); }
  }

  if (state.packageInstalled) {
    try {
      await this.executeUninstallCommand(server, options);
    } catch (e) { errors.push(e as Error); }
  }

  if (errors.length > 0) {
    // Log but don't throw - rollback is best-effort
  }
}

// New private helper
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

// New public method for verifying installation integrity
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

#### Updated install() flow:

```typescript
async install(server, options): Promise<MCPInstallation> {
  // ... existing check logic ...

  const rollbackState = {
    packageInstalled: false,
    configPath: undefined as string | undefined,
    installationId: undefined as string | undefined,
  };

  try {
    await this.executeInstallation(server, options);
    rollbackState.packageInstalled = true;

    const configPath = await this.createConfigFile(server, installationId);
    rollbackState.configPath = configPath;

    const installation = { id: installationId, serverId: server.name, ... };
    await this.store.createMcpInstallation(installation);
    rollbackState.installationId = installationId;

    return installation;
  } catch (error) {
    await this.rollbackInstallation(server, options, rollbackState);
    throw new Error(`Failed to install MCP server '${server.name}': ${...}`);
  }
}
```

### Test Architecture

#### Test File: `mcp-installer-rollback.test.ts`

**Test Structure:**

```
describe('MCPInstaller - Rollback on Failure')
├── describe('Rollback on download/install failure')
│   ├── should not attempt rollback when executeInstallation fails (nothing to rollback)
│   ├── should not create config file when installation command fails
│   ├── should not store installation record when installation command fails
│   └── should handle network timeout during download gracefully
│
├── describe('Rollback on corrupted files')
│   ├── should rollback when config file is written with invalid JSON
│   ├── should rollback when config file write is interrupted (partial write)
│   ├── should uninstall package when config file creation fails after successful install
│   └── should verify installation integrity and trigger rollback on corruption
│
├── describe('Rollback on dependency failure')
│   ├── should rollback all installed deps when a required dependency fails
│   ├── should rollback target server when dependency install fails mid-chain
│   ├── should not rollback optional dependency failures
│   └── should cleanup partial state when dependency resolution fails after partial installs
│
├── describe('Partial installation cleanup')
│   ├── should remove config file when store operation fails
│   ├── should attempt npm uninstall when config creation fails post-install
│   ├── should handle rollback failure gracefully (best-effort cleanup)
│   ├── should clean up config directory when it was created for this installation
│   └── should not affect other installations during cleanup
│
└── describe('Rollback state verification')
    ├── should leave no installation record after rollback
    ├── should leave no config file after rollback
    ├── should restore previous installation state on force-reinstall failure
    ├── should report correct status after failed installation with rollback
    └── should not leave zombie entries in the store after rollback
```

#### Mock Strategy

The tests use the same mocking approach as existing tests:
- `vi.mock('fs')` - mock filesystem for config file operations
- `vi.mock('child_process')` - mock exec for npm commands
- `vi.mock('../store')` - mock TaskStore for database operations

Each test sets up specific failure scenarios by configuring mocks to:
1. Succeed for early steps (establishing partial state)
2. Fail at the specific failure point
3. Verify rollback actions were called with correct arguments

#### Key Assertions Pattern

```typescript
// Verify rollback was triggered
it('should uninstall package when config creation fails', async () => {
  // Arrange: npm install succeeds, writeFile fails
  mockExec.mockImplementation((cmd, opts, cb) => {
    if (cmd.startsWith('npm install')) cb(null, { stdout: '', stderr: '' });
    if (cmd.startsWith('npm uninstall')) cb(null, { stdout: '', stderr: '' });
    return {} as any;
  });
  mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

  // Act & Assert
  await expect(installer.install(server)).rejects.toThrow();

  // Verify rollback: npm uninstall was called
  expect(mockExec).toHaveBeenCalledWith(
    expect.stringContaining('npm uninstall'),
    expect.any(Object),
    expect.any(Function)
  );
});

// Verify state is clean after rollback
it('should leave no installation record after rollback', async () => {
  // ... trigger failure ...

  // Verify no record was left in store
  expect(mockStore.removeMcpInstallation).toHaveBeenCalled();
  // OR verify createMcpInstallation was not called if failure was before that step
  expect(mockStore.createMcpInstallation).not.toHaveBeenCalled();
});
```

## Consequences

### Positive
- Tests comprehensively verify rollback behavior at each failure point
- Tests follow established mocking patterns in the codebase
- Rollback mechanism is best-effort (doesn't throw if cleanup fails)
- State verification ensures no orphaned artifacts remain

### Negative
- Rollback of npm packages requires executing `npm uninstall` which could itself fail
- Tests require understanding the internal step ordering of `install()`
- Partial rollback may leave node_modules artifacts if npm uninstall is interrupted

### Implementation Notes for Developer Stage
1. Add `rollbackInstallation()` private method to MCPInstaller
2. Add `executeUninstallCommand()` private helper to MCPInstaller
3. Add `verifyInstallation()` public method to MCPInstaller
4. Modify `install()` to track state and call rollback on failure
5. Write the test file following the structure above
6. Ensure all existing tests still pass after the changes
