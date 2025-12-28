# ADR 0005: Workspace Manager Cross-Platform Shell Execution

## Status

Proposed

## Context

The `workspace-manager.ts` file in the `@apex/orchestrator` package currently uses `execAsync()` calls without specifying a shell parameter, which causes issues on Windows where:

1. The default shell behavior differs between platforms (Unix uses `/bin/sh`, Windows uses `cmd.exe`)
2. Package manager commands like `npm`, `yarn`, and `pnpm` require `.cmd` extensions on Windows
3. Commands like `git worktree`, `cp`, and `du` need proper shell context for consistent cross-platform behavior

The `worktree-manager.ts` already correctly implements cross-platform shell execution by using `getPlatformShell().shell` from `@apexcli/core` for all `exec` calls. We need to apply the same pattern to `workspace-manager.ts`.

## Decision

We will update `workspace-manager.ts` to use the cross-platform shell utilities from `@apexcli/core`:

### 1. Import Required Utilities

Add imports from `@apexcli/core`:
```typescript
import {
  getPlatformShell,
  isWindows,
  resolveExecutable
} from '@apexcli/core';
```

### 2. Add Shell Specification to All `execAsync` Calls

Every `execAsync()` call must include the shell option:
```typescript
await execAsync(command, {
  cwd: this.projectPath,
  shell: getPlatformShell().shell
});
```

### 3. Affected Methods and Required Changes

The following methods contain `execAsync` calls that need updating:

| Method | Line | Current Command | Change Required |
|--------|------|-----------------|-----------------|
| `getWorkspaceStats()` | ~417 | `du -s "${workspace.workspacePath}"` | Add shell option, add Windows fallback |
| `createWorktreeWorkspace()` | ~454 | `git worktree add ...` | Add shell option |
| `cleanupWorktree()` | ~465 | `git worktree remove ...` | Add shell option |
| `createDirectoryWorkspace()` | ~595 | `cp -r ...` | Add shell option, add Windows fallback for `xcopy` or `robocopy` |

### 4. Platform-Specific Command Handling

For commands that differ between platforms:

#### Disk Usage (`du` vs PowerShell/Windows):
```typescript
if (isWindows()) {
  // Use PowerShell or skip (du not available on Windows)
  // Alternative: Use fs.stat recursively or skip disk calculation on Windows
} else {
  const { stdout } = await execAsync(
    `du -s "${workspace.workspacePath}"`,
    { shell: getPlatformShell().shell }
  );
}
```

#### Copy Command (`cp` vs `xcopy`/`robocopy`):
```typescript
if (isWindows()) {
  await execAsync(
    `xcopy "${this.projectPath}" "${workspacePath}" /E /I /H /Y`,
    { shell: getPlatformShell().shell }
  );
} else {
  await execAsync(
    `cp -r "${this.projectPath}/." "${workspacePath}"`,
    { shell: getPlatformShell().shell }
  );
}
```

Alternatively, use Node.js `fs.cp()` (available in Node 16.7+) for truly cross-platform file copying:
```typescript
await fs.cp(this.projectPath, workspacePath, { recursive: true });
```

### 5. Package Manager Command Resolution

While not directly in `workspace-manager.ts`, the container dependency installation uses package manager commands. The existing `getInstallCommand()` and `getOptimizedInstallCommand()` functions from `@apexcli/core` should handle this, but verify that:

- `npm` resolves to `npm.cmd` on Windows
- `yarn` resolves to `yarn.cmd` on Windows
- `pnpm` resolves to `pnpm.cmd` on Windows

If running commands outside containers (host shell), use `resolveExecutable()`:
```typescript
const npmCmd = resolveExecutable('npm'); // Returns 'npm.exe' on Windows
```

### 6. Test Requirements

Create/update tests to verify Windows compatibility:

```typescript
describe('WorkspaceManager - Windows Compatibility', () => {
  it('should use platform shell for git worktree operations', async () => {
    // Mock process.platform = 'win32'
    // Verify execAsync called with { shell: 'cmd.exe' }
  });

  it('should handle directory operations on Windows', async () => {
    // Verify xcopy/fs.cp used instead of cp -r
  });

  it('should handle disk usage calculation on Windows', async () => {
    // Verify graceful fallback when du unavailable
  });
});
```

## Consequences

### Positive

1. **Windows Compatibility**: Workspace manager will function correctly on Windows
2. **Consistency**: Same pattern used across worktree-manager and workspace-manager
3. **Maintainability**: Centralized shell utilities in `@apexcli/core` make future changes easier
4. **Test Coverage**: New tests will increase confidence in cross-platform behavior

### Negative

1. **Slight Complexity**: Windows-specific fallbacks add conditional logic
2. **Testing Burden**: Need to test on both platforms (or mock thoroughly)

### Neutral

1. **Performance**: No significant performance impact
2. **Dependencies**: No new dependencies (using existing `@apexcli/core` utilities)

## Implementation Summary

### Files to Modify

1. **`packages/orchestrator/src/workspace-manager.ts`**:
   - Add imports: `getPlatformShell`, `isWindows` from `@apexcli/core`
   - Update 4 `execAsync` calls to include shell option
   - Add Windows fallbacks for `du` and `cp` commands

2. **`packages/orchestrator/src/__tests__/workspace-manager-windows.test.ts`** (new):
   - Add Windows compatibility tests following the pattern in `service-manager-windows-compatibility.test.ts`

### Implementation Order

1. Import cross-platform utilities
2. Update git worktree commands (safe, git works same on both platforms)
3. Update `cp` command with Windows fallback or `fs.cp()`
4. Update `du` command with Windows fallback/skip
5. Add comprehensive tests
6. Verify build and all tests pass

## References

- `packages/orchestrator/src/worktree-manager.ts` - Reference implementation
- `packages/core/src/shell-utils.ts` - Cross-platform shell utilities
- `packages/orchestrator/src/__tests__/service-manager-windows-compatibility.test.ts` - Test patterns
