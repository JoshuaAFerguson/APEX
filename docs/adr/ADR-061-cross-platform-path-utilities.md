# ADR-061: Cross-Platform Path Utilities

## Status
Accepted

## Date
2025-01-28

## Context

APEX currently has inconsistent handling of cross-platform paths across its codebase:

1. **Home directory resolution**: Multiple locations use `process.env.HOME || '/tmp'` which:
   - Doesn't work on Windows (should use `USERPROFILE`)
   - Uses `/tmp` as a fallback which is incorrect behavior
   - Duplicates logic across `packages/orchestrator/src/service-manager.ts` and `packages/cli/src/services/CompletionEngine.ts`

2. **Path separators**: The codebase uses hardcoded forward slashes in some places, which work on Windows (Node.js handles this) but can cause issues in edge cases.

3. **Config directory**: Windows uses `%AppData%` while Unix uses `~/.config`, but this isn't handled consistently.

## Decision

We will create a new `path-utils.ts` module in `@apex/core` that provides:

### Functions

1. **`getHomeDir(): string`**
   - Returns the user's home directory
   - Windows: Uses `process.env.USERPROFILE` or `os.homedir()`
   - Unix: Uses `process.env.HOME` or `os.homedir()`
   - Falls back to `os.homedir()` for robustness

2. **`normalizePath(inputPath: string): string`**
   - Normalizes path separators for the current platform
   - Handles `~` expansion to home directory
   - Resolves `.` and `..` segments
   - Ensures consistent trailing slash behavior

3. **`getConfigDir(appName?: string): string`**
   - Returns the platform-appropriate config directory
   - Windows: `%AppData%\{appName}` or `%AppData%`
   - macOS: `~/Library/Application Support/{appName}` or `~/.config/{appName}`
   - Linux: `~/.config/{appName}` or `~/.config`
   - If appName is provided, creates subdirectory

### Design Principles

1. **Pure functions**: All functions are synchronous and side-effect free
2. **Platform detection**: Use `process.platform` for reliable platform detection
3. **Graceful fallbacks**: Always have a sensible fallback behavior
4. **Node.js compatibility**: Use built-in `os` and `path` modules
5. **TypeScript strict mode**: Full type safety with JSDoc documentation

### Interface Design

```typescript
/**
 * Get the user's home directory in a cross-platform way
 * @returns Absolute path to user's home directory
 */
export function getHomeDir(): string;

/**
 * Normalize a path for the current platform
 * @param inputPath - Path to normalize (can include ~ for home)
 * @returns Normalized absolute path
 */
export function normalizePath(inputPath: string): string;

/**
 * Get the platform-appropriate config directory
 * @param appName - Optional application name for subdirectory
 * @returns Absolute path to config directory
 */
export function getConfigDir(appName?: string): string;
```

## Consequences

### Positive

- **Consistency**: Single source of truth for path handling
- **Correctness**: Proper Windows support with USERPROFILE and AppData
- **Maintainability**: Centralized logic is easier to maintain and test
- **Reusability**: Other packages can import from @apex/core

### Negative

- **Migration**: Existing code needs to be updated to use new utilities
- **Dependency**: Other packages now depend on @apex/core for path handling

### Neutral

- **No external dependencies**: Uses only Node.js built-ins (os, path)

## Implementation Notes

### Platform Detection

```typescript
const isWindows = process.platform === 'win32';
const isMacOS = process.platform === 'darwin';
```

### Environment Variable Priority

| Platform | Home Dir                           | Config Dir                        |
|----------|-----------------------------------|-----------------------------------|
| Windows  | USERPROFILE > HOMEDRIVE+HOMEPATH > os.homedir() | APPDATA > {home}/AppData/Roaming |
| macOS    | HOME > os.homedir()               | ~/Library/Application Support or ~/.config |
| Linux    | HOME > os.homedir()               | XDG_CONFIG_HOME > ~/.config       |

### Error Handling

- Functions should never throw
- Return best-effort results even if environment variables are missing
- Use `os.homedir()` as ultimate fallback (Node.js handles this cross-platform)

## References

- [Node.js path module](https://nodejs.org/api/path.html)
- [Node.js os module](https://nodejs.org/api/os.html)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
- [Windows Known Folders](https://docs.microsoft.com/en-us/windows/win32/shell/known-folders)
