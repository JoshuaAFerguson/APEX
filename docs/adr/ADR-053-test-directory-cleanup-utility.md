# ADR-053: Test Directory Cleanup Utility

## Status
Proposed

## Date
2024-12-XX

## Context

The APEX test infrastructure creates temporary `.apex-test` directories during test execution. These directories contain test databases, configurations, and other artifacts that should be cleaned up after test runs. Currently, there is no centralized utility to reliably remove these directories across all platforms (Windows, macOS, Linux).

### Current Patterns Observed

1. **Temporary Directory Creation**: Tests use various patterns:
   - `fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'))` (most common)
   - `path.join(tmpdir(), 'apex-test-${Date.now()}')` (manual naming)
   - `.apex-test` subdirectories within APEX_HOME

2. **Existing Cleanup Utilities**:
   - `packages/orchestrator/src/test-cleanup.ts` - TaskStore-specific cleanup
   - `tests/test-utils/cleanup.ts` - Comprehensive cleanup registry
   - `tests/test-utils/isolation/file-system.ts` - File system isolation with automatic cleanup
   - `packages/core/src/test-fixtures/context/isolation-utils.ts` - Test context isolation

3. **Cross-Platform Considerations**:
   - Node.js `fs.rmSync` with `recursive: true` and `force: true` works on all platforms
   - Path separators differ (Windows: `\`, Unix: `/`)
   - File locking on Windows can prevent deletion

## Decision

Create a cross-platform test cleanup utility that:

1. **Primary Implementation**: `packages/core/src/test-cleanup-utils.ts`
   - Single-responsibility module for cleaning `.apex-test` directories
   - Uses `fs.rmSync` with `recursive: true, force: true` for cross-platform compatibility
   - Handles non-existent directories gracefully (no error if already deleted)
   - Provides both sync and async variants
   - Integrates with existing path utilities

2. **CLI Script**: `scripts/clean-test-dir.ts`
   - Standalone script for manual/CI cleanup
   - Can be run via `npx ts-node scripts/clean-test-dir.ts` or built/executed
   - Accepts optional path argument (defaults to `.apex-test` in current directory)
   - Provides verbose output for debugging

3. **NPM Script Integration**: Add to root `package.json`
   - `npm run clean:test` - Clean `.apex-test` directory
   - Integrates with existing `npm run clean` workflow

### API Design

```typescript
// packages/core/src/test-cleanup-utils.ts

/**
 * Options for cleanup operations
 */
export interface CleanupOptions {
  /** Base directory to clean from (defaults to process.cwd()) */
  basePath?: string;
  /** Whether to suppress errors for non-existent paths */
  ignoreNonExistent?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Remove .apex-test directory and its contents
 * Cross-platform compatible (Windows, macOS, Linux)
 */
export function cleanTestDirectory(options?: CleanupOptions): void;

/**
 * Async version of cleanTestDirectory
 */
export async function cleanTestDirectoryAsync(options?: CleanupOptions): Promise<void>;

/**
 * Check if .apex-test directory exists
 */
export function testDirectoryExists(basePath?: string): boolean;

/**
 * Get the path to .apex-test directory
 */
export function getTestDirectoryPath(basePath?: string): string;
```

### Directory Structure

```
packages/core/src/
  test-cleanup-utils.ts          # Core cleanup implementation
  test-cleanup-utils.test.ts     # Unit tests

scripts/
  clean-test-dir.ts              # CLI script

package.json                     # NPM script: "clean:test"
```

## Rationale

### Why Node.js `fs.rmSync`?

1. **Cross-Platform**: Handles path differences automatically
2. **Recursive**: Removes nested directories without manual traversal
3. **Force Option**: Handles locked files on Windows (best effort)
4. **Built-in**: No external dependencies required
5. **Proven Pattern**: Already used in `tests/test-utils/cleanup.ts`

### Why in `@apex/core`?

1. **Reusability**: All packages can import from core
2. **No External Dependencies**: Uses only Node.js built-ins
3. **Consistent with Existing Patterns**: Other test utilities are in core
4. **Export Path**: Can be exported via `@apexcli/core/test-cleanup-utils`

### Why Separate Script?

1. **CI/CD Integration**: Easy to call from GitHub Actions
2. **Manual Cleanup**: Developers can run without understanding internals
3. **No Build Required**: Can use `ts-node` or `npx tsx`

## Consequences

### Positive
- Centralized, tested cleanup logic
- Cross-platform reliability
- Easy integration with CI/CD
- Reusable across test files
- Follows existing APEX patterns

### Negative
- Another utility to maintain
- Slight overlap with existing cleanup utilities

### Neutral
- Requires documentation updates
- May need to update existing tests to use new utility

## Implementation Notes

1. **Error Handling**: Use `try-catch` with specific error codes:
   - `ENOENT`: Directory doesn't exist (ok, ignore)
   - `EBUSY`/`EPERM`: File locked (log warning, continue)
   - Other errors: Throw with context

2. **Windows Considerations**:
   - SQLite database files may be locked
   - Add retry logic with small delay for Windows
   - Use `path.normalize()` for consistent paths

3. **Testing Strategy**:
   - Create temp directory structure
   - Call cleanup
   - Verify removal
   - Test non-existent path handling
   - Test error cases (mocked)

## Related

- `packages/orchestrator/src/test-cleanup.ts` - Existing TaskStore cleanup
- `tests/test-utils/cleanup.ts` - Existing cleanup registry
- `tests/test-utils/isolation/file-system.ts` - File system isolation
- ADR-052: Test Isolation Architecture
