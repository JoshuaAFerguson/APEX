# DirectoryAccessValidator Technical Design

## Overview

The `DirectoryAccessValidator` class provides path-based access control for agent tool operations in APEX. It validates whether a given file path is allowed based on configurable allowlist/blocklist patterns using glob syntax.

## Component Location

- **Implementation**: `packages/core/src/directory-access-validator.ts`
- **Tests**: `packages/core/src/__tests__/directory-access-validator.test.ts`
- **Export**: Via `packages/core/src/index.ts`

## Dependencies

### New Direct Dependency
- `picomatch@^4.0.3` - Fast glob pattern matching library (already a transitive dependency via vitest, but needs to be added as direct dependency for production use)

### Existing Dependencies
- `path` (Node.js built-in) - Path manipulation
- `fs/promises` (Node.js built-in) - Symlink resolution

### Internal Dependencies
- `DirectoryAccessConfig` from `./types.ts`
- `normalizePath` from `./path-utils.ts`

## Type Definitions

```typescript
/**
 * Result of a path access validation check
 */
export interface DirectoryAccessResult {
  /** Whether the path is allowed */
  allowed: boolean;

  /** Human-readable reason for the decision */
  reason: string;

  /** The pattern that matched (if any) */
  matchedPattern?: string;

  /** Whether blocklist was the deciding factor */
  blockedByBlocklist?: boolean;

  /** Whether allowlist was the deciding factor */
  allowedByAllowlist?: boolean;

  /** Whether default policy was used */
  usedDefaultPolicy?: boolean;
}

/**
 * Options for path validation
 */
export interface PathValidationOptions {
  /** Base path for resolving relative patterns (defaults to cwd) */
  basePath?: string;

  /** Skip symlink resolution even if config.resolveSymlinks is true */
  skipSymlinkResolution?: boolean;
}
```

## Class API

```typescript
export class DirectoryAccessValidator {
  /**
   * Validate whether a path is allowed based on the configuration
   *
   * Evaluation order:
   * 1. Check blocklist - if match, deny
   * 2. Check allowlist - if match, allow
   * 3. If maxDepth exceeded, deny
   * 4. Apply defaultAllow policy
   *
   * @param inputPath - Path to validate (absolute or relative)
   * @param config - Directory access configuration
   * @param options - Optional validation options
   * @returns Promise resolving to validation result
   */
  async isPathAllowed(
    inputPath: string,
    config: DirectoryAccessConfig,
    options?: PathValidationOptions
  ): Promise<DirectoryAccessResult>;

  /**
   * Check if a path matches any pattern in the allowlist
   * @param normalizedPath - Normalized absolute path
   * @param patterns - Array of glob patterns
   * @returns The matched pattern or null
   */
  matchesAllowlist(normalizedPath: string, patterns: string[]): string | null;

  /**
   * Check if a path matches any pattern in the blocklist
   * @param normalizedPath - Normalized absolute path
   * @param patterns - Array of glob patterns
   * @returns The matched pattern or null
   */
  matchesBlocklist(normalizedPath: string, patterns: string[]): string | null;

  /**
   * Calculate the depth of a path relative to a base path
   * @param targetPath - Path to measure
   * @param basePath - Base path to measure from
   * @returns Number of directory levels from base to target
   */
  getDepth(targetPath: string, basePath: string): number;

  /**
   * Normalize a path for consistent matching
   * - Resolves to absolute path
   * - Normalizes separators for current platform
   * - Optionally resolves symlinks
   */
  async normalizePath(
    inputPath: string,
    basePath?: string,
    resolveSymlinks?: boolean
  ): Promise<string>;
}
```

## Singleton Instance

```typescript
/**
 * Singleton instance for convenience
 */
export const directoryAccessValidator = new DirectoryAccessValidator();

/**
 * Convenience function for one-off validation
 */
export async function isPathAllowed(
  path: string,
  config: DirectoryAccessConfig,
  options?: PathValidationOptions
): Promise<boolean>;
```

## Pattern Matching Behavior

### Supported Glob Patterns

| Pattern | Description | Example Match |
|---------|-------------|---------------|
| `*` | Match any characters except path separator | `*.ts` matches `file.ts` |
| `**` | Match any characters including path separator | `src/**` matches `src/a/b/c.ts` |
| `?` | Match single character | `file?.ts` matches `file1.ts` |
| `[abc]` | Match character class | `[abc].ts` matches `a.ts`, `b.ts` |
| `[a-z]` | Match character range | `[a-z].ts` matches any single lowercase letter |
| `{a,b}` | Match alternatives | `*.{ts,js}` matches both `.ts` and `.js` |

### Pattern Resolution

1. Absolute patterns (starting with `/` on Unix, `C:\` on Windows) are matched as-is
2. Relative patterns are resolved against `basePath` (defaults to `process.cwd()`)
3. All paths are normalized to platform-specific separators before matching

### Cross-Platform Considerations

- Path separators are normalized before matching
- Patterns can use either `/` or `\` - both work on all platforms
- Windows drive letters are handled (e.g., `C:/Users/**`)
- Case sensitivity follows the operating system's filesystem

## Algorithm

```
function isPathAllowed(path, config, options):
  1. Normalize input path (resolve relative, normalize separators)

  2. If config.resolveSymlinks && !options.skipSymlinkResolution:
       path = fs.realpath(path)  // May throw if path doesn't exist

  3. If config.blocklist is non-empty:
       matched = matchesBlocklist(path, config.blocklist)
       If matched:
         return { allowed: false, reason: "Blocked by pattern", matchedPattern: matched }

  4. If config.allowlist is non-empty:
       matched = matchesAllowlist(path, config.allowlist)
       If matched:
         return { allowed: true, reason: "Allowed by pattern", matchedPattern: matched }

  5. If config.maxDepth > 0:
       depth = getDepth(path, basePath)
       If depth > config.maxDepth:
         return { allowed: false, reason: "Exceeds maximum depth" }

  6. Determine defaultAllow:
       If config.defaultAllow is explicitly set:
         use config.defaultAllow
       Else if config.allowlist is non-empty:
         defaultAllow = false  // Explicit allowlist mode
       Else:
         defaultAllow = true   // Blocklist-only mode

  7. Return { allowed: defaultAllow, reason: "Default policy" }
```

## Error Handling

### Path Resolution Errors
- If `fs.realpath()` fails (e.g., path doesn't exist, broken symlink):
  - Return `{ allowed: false, reason: "Path does not exist or is inaccessible" }`
  - Set `error` property with original error message

### Invalid Patterns
- Invalid glob patterns throw during `picomatch` compilation
- Catch and log warning, skip the invalid pattern
- Continue checking remaining patterns

### Edge Cases
- Empty path: Normalize to current directory
- Path outside basePath with relative pattern: May not match as expected (document this)
- Circular symlinks: `fs.realpath()` will throw; handle gracefully

## Performance Considerations

1. **No caching by default**: Patterns are typically checked per-operation, caching adds complexity
2. **Compile patterns once**: If validating multiple paths against same config, compile patterns once
3. **Short-circuit evaluation**: Stop checking patterns after first match
4. **Lazy symlink resolution**: Only resolve when `resolveSymlinks: true`

## Test Coverage Requirements

### Unit Tests (>90% coverage)

1. **Pattern Matching**
   - Simple glob patterns (`*`, `**`, `?`)
   - Character classes and ranges
   - Alternatives (braces)
   - Negation patterns
   - Edge cases (empty patterns, special chars)

2. **Allowlist/Blocklist Logic**
   - Blocklist takes precedence over allowlist
   - Empty lists behavior
   - Mixed patterns
   - Order independence

3. **Path Normalization**
   - Relative to absolute conversion
   - Path separator normalization
   - Symlink resolution
   - Cross-platform paths

4. **Depth Checking**
   - Zero depth (same directory)
   - Nested paths
   - maxDepth = 0 (unlimited)
   - Paths outside basePath

5. **Default Policy**
   - Explicit defaultAllow: true
   - Explicit defaultAllow: false
   - Inferred from allowlist presence
   - Inferred from blocklist-only mode

6. **Error Handling**
   - Non-existent paths
   - Broken symlinks
   - Invalid patterns
   - Permission errors

### Integration Tests

1. **Real filesystem operations**
   - Actual symlink following
   - Cross-platform behavior

2. **Configuration integration**
   - With `FilesystemToolConfig`
   - With `DirectoryAccessConfigSchema` validation

## Example Usage

```typescript
import { DirectoryAccessValidator, DirectoryAccessConfig } from '@apex/core';

const validator = new DirectoryAccessValidator();

// Example configuration
const config: DirectoryAccessConfig = {
  allowlist: ['src/**', 'tests/**', 'package.json'],
  blocklist: ['**/*.secret', '**/node_modules/**', '.env'],
  defaultAllow: false,
  resolveSymlinks: true,
  maxDepth: 10,
};

// Validate a path
const result = await validator.isPathAllowed('/project/src/index.ts', config, {
  basePath: '/project',
});

if (result.allowed) {
  console.log(`Access allowed: ${result.reason}`);
} else {
  console.log(`Access denied: ${result.reason}`);
  if (result.matchedPattern) {
    console.log(`Matched pattern: ${result.matchedPattern}`);
  }
}
```

## Future Enhancements

1. **Pattern caching**: Optional LRU cache for compiled patterns
2. **Batch validation**: Validate multiple paths in single call
3. **Pattern suggestions**: Suggest patterns based on common use cases
4. **Audit logging**: Track access attempts for security monitoring
5. **Async pattern loading**: Load patterns from external file
