# ADR-061: Cross-Platform Spawn Windows Compatibility

## Status
**Proposed** - For implementation in the `development` stage

## Context

The CLI package uses Node.js `spawn()` to launch background services (API server, Web UI) and execute commands. While `repl.tsx` already uses `resolveExecutable()` from `@apexcli/core` for spawn calls, other spawn calls in `index.ts` do not use these utilities and will fail on Windows.

### Current State Analysis

After reviewing the codebase, the spawn calls fall into these categories:

#### Already Using Cross-Platform Utilities (Compliant)
- `packages/cli/src/repl.tsx` (lines 372, 440, 1299, 1326)
  - Uses `resolveExecutable('node')` and `resolveExecutable('npx')` for background service spawning
  - Already imports: `getPlatformShell`, `isWindows`, `resolveExecutable` from `@apexcli/core`

#### Need Updates (Not Using Cross-Platform Utilities)

| File | Line | Call | Issue |
|------|------|------|-------|
| `packages/cli/src/index.ts` | 1957 | `spawn(runtime, ...)` | Container runtime (docker/podman) - likely OK as-is |
| `packages/cli/src/index.ts` | 2541 | `spawn('git', args, ...)` | Git commands without cross-platform handling |
| `packages/cli/src/index.ts` | 2636 | `spawn('git', args, ...)` | Git diff --stat command |
| `packages/cli/src/index.ts` | 2688 | `spawn('git', ['status', ...], ...)` | Git status --porcelain |
| `packages/cli/src/index.ts` | 2729 | `spawn('git', ['diff', '--staged'], ...)` | Git staged diff |
| `packages/cli/src/index.ts` | 3219 | `spawn('npx', args, ...)` | Web UI start - missing resolveExecutable |

#### Test/Build Scripts (Lower Priority)
- `packages/cli/run-tests.js` (lines 41, 64) - uses `shell: true` already
- `packages/cli/v030-coverage-analysis.js` (line 83)
- `packages/cli/test-validation-simple.js` (line 11)
- `packages/cli/test-agent-thoughts.js` (line 12)

### Windows Spawn Behavior

On Windows, there are key differences in spawn behavior:

1. **Executable Resolution**: Windows looks for `.exe`, `.cmd`, `.bat` extensions
2. **Shell Requirement**: Some commands require `shell: true` to work with PATH resolution
3. **PATH Separator**: Windows uses `;` vs Unix `:` for PATH
4. **Detached Processes**: Different behavior for `detached: true` on Windows

### Existing Utilities in `@apexcli/core/shell-utils.ts`

```typescript
// Already available and exported from @apexcli/core
export function isWindows(): boolean;
export function getPlatformShell(): ShellConfig;
export function resolveExecutable(name: string): string;
export function getKillCommand(pid: number): string[];
export function createShellCommand(commandParts: string[]): string;
```

## Decision

### Architecture Overview

The design will use a **layered approach** that:
1. Leverages existing `@apexcli/core` shell utilities
2. Adds `shell: true` option for PATH-based executable discovery on Windows
3. Uses `resolveExecutable()` for node/npx calls that spawn background services
4. Keeps git calls simple since Git for Windows is typically in PATH

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLI Spawn Calls                             │
├─────────────────────────────────────────────────────────────────┤
│  Background Services (API/Web UI):                               │
│    ├── Use resolveExecutable('node') or resolveExecutable('npx') │
│    ├── Keep detached: true for background operation              │
│    └── Don't add shell: true (reduces overhead)                  │
├─────────────────────────────────────────────────────────────────┤
│  Git Commands:                                                   │
│    ├── Add shell: true (or getPlatformShell().shell)             │
│    ├── Git for Windows installs to PATH                          │
│    └── Allows Git GUI wrapper scripts to work                    │
├─────────────────────────────────────────────────────────────────┤
│  Container Runtime (docker/podman):                              │
│    ├── Add shell: true for PATH resolution                       │
│    └── Docker Desktop adds to PATH on Windows                    │
└─────────────────────────────────────────────────────────────────┘
```

### Spawn Call Classification

#### Type 1: Background Service Spawns
For `node` and `npx` calls that spawn detached background processes:

```typescript
// Current (in repl.tsx - already correct)
const proc = spawn(resolveExecutable('node'), [path.join(apiPath, 'dist/index.js')], {
  cwd: ctx.cwd,
  env: { ... },
  stdio: 'ignore',
  detached: true,
});

// Update required in index.ts line 3219
// From:
const proc = spawn('npx', args, { ... });
// To:
const proc = spawn(resolveExecutable('npx'), args, { ... });
```

#### Type 2: Interactive/Piped Commands (Git, etc.)
For commands that pipe output back to the process:

```typescript
// Current (line 2541 in index.ts)
const gitProcess = spawn('git', args, {
  cwd: projectPath,
  stdio: ['inherit', 'pipe', 'pipe']
});

// Updated for Windows compatibility
const shellConfig = getPlatformShell();
const gitProcess = spawn('git', args, {
  cwd: projectPath,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: shellConfig.shell,  // 'cmd.exe' on Windows, '/bin/sh' on Unix
});
```

#### Type 3: Container Runtime Spawns
For docker/podman interactive shells:

```typescript
// Current (line 1957 in index.ts)
const shellProcess = spawn(runtime, [...], {
  stdio: 'inherit',
  env: process.env
});

// Updated
const shellConfig = getPlatformShell();
const shellProcess = spawn(runtime, [...], {
  stdio: 'inherit',
  env: process.env,
  shell: isWindows(),  // Use shell on Windows for PATH resolution
});
```

### Implementation Changes Required

#### 1. Update `packages/cli/src/index.ts` Imports

```typescript
// Add to existing imports from @apexcli/core
import {
  // ... existing imports ...
  getPlatformShell,
  isWindows,
  resolveExecutable,
} from '@apexcli/core';
```

#### 2. Update Git Spawn Calls (Lines 2541, 2636, 2688, 2729)

Add shell configuration to all git spawn calls:

```typescript
// Helper at top of file or inline
const shellConfig = getPlatformShell();

// Apply to all git spawns
const gitProcess = spawn('git', args, {
  cwd: projectPath,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: shellConfig.shell,
});
```

#### 3. Update Web UI Spawn (Line 3219)

```typescript
// From:
const proc = spawn('npx', args, {
  cwd: webUIPath,
  env: { ... },
  stdio: 'ignore',
  detached: true,
});

// To:
const proc = spawn(resolveExecutable('npx'), args, {
  cwd: webUIPath,
  env: { ... },
  stdio: 'ignore',
  detached: true,
});
```

#### 4. Update Container Runtime Spawn (Line 1957)

```typescript
// From:
const shellProcess = spawn(runtime, [...], {
  stdio: 'inherit',
  env: process.env
});

// To:
const shellProcess = spawn(runtime, [...], {
  stdio: 'inherit',
  env: process.env,
  shell: isWindows(),
});
```

### Files to Modify

| File | Changes |
|------|---------|
| `packages/cli/src/index.ts` | Add imports, update 5 spawn calls |
| `packages/cli/run-tests.js` | Optional: already uses `shell: true` |
| `packages/cli/test-*.js` | Optional: test utilities, lower priority |

### Testing Strategy

1. **Unit Tests**: Mock `isWindows()` to return true, verify spawn options include shell
2. **Integration Tests**: Run on Windows CI (GitHub Actions `windows-latest`)
3. **Manual Testing**: Test `apex serve`, `apex web`, `/diff` commands on Windows

Test cases to add:
- Verify git commands work on Windows
- Verify background service spawning works on Windows
- Verify container runtime spawn works on Windows

### Error Handling Considerations

On Windows, additional error scenarios to handle:

1. **Executable Not Found**: More common on Windows due to PATH issues
2. **Permission Denied**: UAC may block certain operations
3. **Path Too Long**: Windows MAX_PATH (260 chars) limitation

```typescript
// Enhanced error handling example
proc.on('error', (err) => {
  if (err.code === 'ENOENT') {
    if (isWindows()) {
      console.error(`Command not found. Ensure ${command} is installed and in PATH.`);
      console.error('On Windows, you may need to restart your terminal after installation.');
    } else {
      console.error(`Command not found: ${command}`);
    }
  }
});
```

## Consequences

### Positive
- **Windows Compatibility**: CLI will work correctly on Windows
- **Minimal Changes**: Leverages existing `@apexcli/core` utilities
- **No Breaking Changes**: Unix/macOS behavior unchanged
- **Consistent Pattern**: All spawn calls follow same pattern

### Negative
- **Slight Overhead**: `shell: true` adds minor overhead for git commands
- **Additional Testing**: Requires Windows CI testing

### Neutral
- **No API Changes**: Internal implementation detail only
- **Existing Patterns**: repl.tsx already demonstrates correct pattern

## Implementation Notes for Development Stage

1. **Priority Order**:
   - High: `index.ts` line 3219 (Web UI spawn with 'npx')
   - High: `index.ts` git spawns (lines 2541, 2636, 2688, 2729)
   - Medium: `index.ts` line 1957 (container runtime)
   - Low: Test runner scripts (already use `shell: true`)

2. **Verification Steps**:
   - Run `npm run build` - must pass
   - Run `npm run test` - must pass
   - Manual test on Windows (if available)

3. **No Changes Needed**:
   - `repl.tsx` already uses correct pattern
   - Service handlers don't use spawn directly

## Summary of Required Changes

### `packages/cli/src/index.ts`

```diff
 import {
   isApexInitialized,
   initializeApex,
   loadConfig,
   saveConfig,
   loadAgents,
   loadWorkflows,
   formatCost,
   formatTokens,
   formatDuration,
   getEffectiveConfig,
   ApexConfig,
   Task,
+  getPlatformShell,
+  isWindows,
+  resolveExecutable,
 } from '@apexcli/core';

 // ... later in file ...

+// Cross-platform shell configuration
+const shellConfig = getPlatformShell();

 // Line ~1957 - Container runtime spawn
 const shellProcess = spawn(runtime, [
   'exec',
   '--interactive',
   '--tty',
   taskContainer.id,
   ...execArgs
 ], {
   stdio: 'inherit',
   env: process.env,
+  shell: isWindows(),
 });

 // Line ~2541 - Git diff
 const gitProcess = spawn('git', args, {
   cwd: projectPath,
   stdio: ['inherit', 'pipe', 'pipe'],
+  shell: shellConfig.shell,
 });

 // Line ~2636 - Git diff --stat
 const gitProcess = spawn('git', args, {
   cwd: projectPath,
   stdio: ['inherit', 'pipe', 'pipe'],
+  shell: shellConfig.shell,
 });

 // Line ~2688 - Git status
 const statusProcess = spawn('git', ['status', '--porcelain'], {
   cwd: projectPath,
   stdio: ['inherit', 'pipe', 'pipe'],
+  shell: shellConfig.shell,
 });

 // Line ~2729 - Git diff --staged
 const stagedProcess = spawn('git', ['diff', '--staged'], {
   cwd: projectPath,
   stdio: ['inherit', 'pipe', 'pipe'],
+  shell: shellConfig.shell,
 });

 // Line ~3219 - Web UI npx spawn
-const proc = spawn('npx', args, {
+const proc = spawn(resolveExecutable('npx'), args, {
   cwd: webUIPath,
   env: { ... },
   stdio: 'ignore',
   detached: true,
 });
```

## References

- [Node.js child_process.spawn documentation](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)
- [Windows shell command processing](https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/cmd)
- [Git for Windows PATH configuration](https://gitforwindows.org/)
- Existing implementation: `packages/core/src/shell-utils.ts`
