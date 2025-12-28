# ADR: Cross-Platform Shell Utilities Module

## Status
Proposed

## Context
APEX needs to execute shell commands across Windows, macOS, and Linux. Currently, shell execution code is scattered across:
- `packages/orchestrator/src/container-execution-proxy.ts` - Uses `exec()` with `promisify`
- `packages/orchestrator/src/service-manager.ts` - Uses `execSync()` for detection
- Various CLI commands

The main cross-platform challenges include:
1. **Shell selection**: Windows uses `cmd.exe` or PowerShell; Unix uses `/bin/sh` or `/bin/bash`
2. **Process termination**: Windows uses `taskkill`; Unix uses `kill` signals
3. **Executable resolution**: Windows requires `.exe`, `.cmd`, `.bat` extensions
4. **Path handling**: Already addressed by `path-utils.ts`

## Decision

### Module Location
Create `packages/core/src/shell-utils.ts` with corresponding test file `packages/core/src/shell-utils.test.ts`.

### Public API Design

```typescript
/**
 * Shell configuration for exec/spawn operations
 */
export interface ShellConfig {
  /** Shell executable path */
  shell: string;
  /** Arguments to pass to shell (e.g., ['/c'] for cmd.exe, ['-c'] for bash) */
  shellArgs: string[];
}

/**
 * Options for getPlatformShell
 */
export interface GetPlatformShellOptions {
  /** Prefer PowerShell over cmd.exe on Windows (default: false) */
  preferPowerShell?: boolean;
}

/**
 * Kill command configuration for process termination
 */
export interface KillCommandConfig {
  /** Command to execute */
  command: string;
  /** Arguments for the kill command */
  args: string[];
}

/**
 * Options for resolveExecutable
 */
export interface ResolveExecutableOptions {
  /** Additional extensions to check beyond platform defaults */
  additionalExtensions?: string[];
  /** Skip checking if file exists (just return platform-appropriate name) */
  skipExistenceCheck?: boolean;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if the current platform is Windows
 * @returns true if running on Windows
 */
export function isWindows(): boolean;

/**
 * Check if the current platform is macOS
 * @returns true if running on macOS
 */
export function isMacOS(): boolean;

/**
 * Check if the current platform is Linux
 * @returns true if running on Linux
 */
export function isLinux(): boolean;

/**
 * Get the appropriate shell configuration for the current platform
 *
 * @param options - Configuration options
 * @returns Shell configuration with shell path and arguments
 *
 * @example
 * ```typescript
 * const { shell, shellArgs } = getPlatformShell();
 * // Windows: { shell: 'cmd.exe', shellArgs: ['/c'] }
 * // Unix:    { shell: '/bin/sh', shellArgs: ['-c'] }
 *
 * spawn(shell, [...shellArgs, 'echo hello']);
 * ```
 */
export function getPlatformShell(options?: GetPlatformShellOptions): ShellConfig;

/**
 * Get the platform-appropriate command to kill a process
 *
 * @param pid - Process ID to kill
 * @param force - Force kill (SIGKILL on Unix, /F on Windows)
 * @returns Kill command configuration
 *
 * @example
 * ```typescript
 * const { command, args } = getKillCommand(12345, true);
 * // Windows: { command: 'taskkill', args: ['/F', '/PID', '12345'] }
 * // Unix:    { command: 'kill', args: ['-9', '12345'] }
 *
 * spawn(command, args);
 * ```
 */
export function getKillCommand(pid: number, force?: boolean): KillCommandConfig;

/**
 * Resolve an executable name to its platform-appropriate form
 *
 * Handles Windows executable extensions (.exe, .cmd, .bat, .ps1)
 * and checks for existence in PATH or specified directory.
 *
 * @param name - Base executable name (e.g., 'npm', 'node')
 * @param options - Resolution options
 * @returns Resolved executable path/name, or null if not found
 *
 * @example
 * ```typescript
 * const npm = await resolveExecutable('npm');
 * // Windows: 'npm.cmd' or 'npm.exe'
 * // Unix:    'npm'
 * ```
 */
export function resolveExecutable(
  name: string,
  options?: ResolveExecutableOptions
): Promise<string | null>;

/**
 * Synchronous version of resolveExecutable
 */
export function resolveExecutableSync(
  name: string,
  options?: ResolveExecutableOptions
): string | null;

/**
 * Get Windows-specific executable extensions in priority order
 * @returns Array of extensions including empty string for exact match
 */
export function getWindowsExecutableExtensions(): string[];

/**
 * Escape a command argument for shell execution
 * Handles platform-specific quoting requirements
 *
 * @param arg - Argument to escape
 * @returns Escaped argument safe for shell execution
 */
export function escapeShellArg(arg: string): string;
```

### Implementation Details

#### 1. Platform Detection
```typescript
export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}
```

#### 2. Shell Selection Logic
```typescript
export function getPlatformShell(options: GetPlatformShellOptions = {}): ShellConfig {
  if (isWindows()) {
    if (options.preferPowerShell) {
      return {
        shell: 'powershell.exe',
        shellArgs: ['-NoProfile', '-Command'],
      };
    }
    return {
      shell: process.env.COMSPEC || 'cmd.exe',
      shellArgs: ['/c'],
    };
  }

  // Unix-like systems
  const shell = process.env.SHELL || '/bin/sh';
  return {
    shell,
    shellArgs: ['-c'],
  };
}
```

#### 3. Process Kill Command
```typescript
export function getKillCommand(pid: number, force = false): KillCommandConfig {
  if (isWindows()) {
    const args = force
      ? ['/F', '/PID', String(pid)]
      : ['/PID', String(pid)];
    return { command: 'taskkill', args };
  }

  // Unix-like systems
  const signal = force ? '-9' : '-15';
  return { command: 'kill', args: [signal, String(pid)] };
}
```

#### 4. Executable Resolution
```typescript
const WINDOWS_EXTENSIONS = ['', '.exe', '.cmd', '.bat', '.ps1'];

export function getWindowsExecutableExtensions(): string[] {
  // Include PATHEXT environment variable if available
  const pathExt = process.env.PATHEXT;
  if (pathExt) {
    const extensions = pathExt.toLowerCase().split(';').filter(Boolean);
    return ['', ...extensions];
  }
  return WINDOWS_EXTENSIONS;
}

export async function resolveExecutable(
  name: string,
  options: ResolveExecutableOptions = {}
): Promise<string | null> {
  if (!isWindows()) {
    // Unix: just return the name, let PATH resolution handle it
    if (options.skipExistenceCheck) {
      return name;
    }
    // Check if executable exists in PATH using which
    try {
      const { stdout } = await execAsync(`which ${name}`);
      return stdout.trim() || name;
    } catch {
      return null;
    }
  }

  // Windows: try extensions
  const extensions = [
    ...getWindowsExecutableExtensions(),
    ...(options.additionalExtensions || []),
  ];

  for (const ext of extensions) {
    const candidate = name + ext;
    if (options.skipExistenceCheck) {
      // Return first non-empty extension match
      if (ext) return candidate;
    } else {
      // Check existence using where command
      try {
        await execAsync(`where ${candidate}`);
        return candidate;
      } catch {
        continue;
      }
    }
  }

  return options.skipExistenceCheck ? name : null;
}
```

#### 5. Shell Argument Escaping
```typescript
export function escapeShellArg(arg: string): string {
  if (isWindows()) {
    // Windows cmd.exe escaping
    // Wrap in double quotes, escape internal double quotes and special chars
    if (!/["\s&|<>^%]/.test(arg)) {
      return arg;
    }
    return `"${arg.replace(/"/g, '""').replace(/%/g, '%%')}"`;
  }

  // Unix shell escaping
  // Wrap in single quotes, escape internal single quotes
  if (!/['\s"$`\\!*?#~<>|&;(){}[\]]/.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
```

### Dependencies
- **Node.js built-ins only**: `os`, `path`, `child_process`, `util`
- No external dependencies required

### Error Handling
- Functions return `null` for resolution failures (not exceptions)
- Platform detection never throws
- Invalid PID values are passed through (shell will handle errors)

### Testing Strategy

#### Unit Tests (shell-utils.test.ts)
1. **Platform Detection**
   - Mock `process.platform` for each platform
   - Test `isWindows()`, `isMacOS()`, `isLinux()`

2. **Shell Configuration**
   - Test default shell selection per platform
   - Test PowerShell preference option on Windows
   - Test SHELL/COMSPEC environment variable usage

3. **Kill Command**
   - Verify correct command/args per platform
   - Test force vs graceful kill options
   - Test with various PID values

4. **Executable Resolution**
   - Mock file system checks
   - Test Windows extension resolution
   - Test PATHEXT environment variable handling
   - Test skipExistenceCheck option

5. **Argument Escaping**
   - Test special characters on each platform
   - Test already-safe strings (no escaping needed)
   - Test edge cases (empty string, unicode)

#### Integration Tests
- Actual shell execution tests (when in CI with appropriate platform)
- Cross-platform test matrix in CI

### Export from Index
Add to `packages/core/src/index.ts`:
```typescript
// Shell Utilities
export * from './shell-utils';
```

## Consequences

### Positive
- Centralized cross-platform shell handling
- Consistent API across all APEX packages
- Simplified consumer code (no platform checks scattered)
- Testable with platform mocking
- Follows existing `path-utils.ts` patterns

### Negative
- Small overhead for platform check on each call (negligible)
- Windows PowerShell support adds complexity

### Neutral
- Must update existing shell usage in orchestrator to use new utilities
- Container execution proxy can adopt these utilities in future iteration

## Implementation Notes

### File Structure
```
packages/core/src/
├── shell-utils.ts          # Implementation
├── shell-utils.test.ts     # Unit tests
└── index.ts                # Add export
```

### Migration Path
1. Create shell-utils.ts with all functions
2. Add comprehensive tests
3. Export from index.ts
4. Future: Migrate orchestrator shell code to use utilities

## References
- `packages/core/src/path-utils.ts` - Similar cross-platform utility pattern
- `packages/orchestrator/src/container-execution-proxy.ts` - Current shell usage
- `packages/orchestrator/src/service-manager.ts` - Platform-specific commands
- Node.js `child_process` documentation
