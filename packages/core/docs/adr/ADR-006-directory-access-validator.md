# ADR-006: DirectoryAccessValidator Design

## Status
Accepted

## Context

APEX needs a mechanism to validate whether file paths are allowed for agent tool operations based on configurable allowlist/blocklist patterns. The `DirectoryAccessConfigSchema` already exists in `types.ts` (lines 119-138) with the following fields:
- `allowlist`: Array of glob patterns for explicitly allowed paths
- `blocklist`: Array of glob patterns for explicitly blocked paths
- `defaultAllow`: Boolean to allow access when path is not in either list
- `resolveSymlinks`: Boolean to resolve symlinks before checking
- `maxDepth`: Maximum directory depth for recursive operations

This validator is essential for:
1. Filesystem tools (Read, Write, Edit, Glob) to restrict agent access
2. Shell tools (Bash) to validate working directories
3. Search tools (Grep) to limit search scope

## Decision

We will implement a `DirectoryAccessValidator` class with the following design:

### Class Interface

```typescript
export interface DirectoryAccessResult {
  allowed: boolean;
  reason: string;
  matchedPattern?: string;
}

export class DirectoryAccessValidator {
  // Core validation method
  isPathAllowed(path: string, config: DirectoryAccessConfig): Promise<DirectoryAccessResult>;

  // Pattern matching helpers (exposed for testing and reuse)
  matchesAllowlist(path: string, patterns: string[]): string | null;
  matchesBlocklist(path: string, patterns: string[]): string | null;

  // Utility methods
  normalizePath(inputPath: string): string;
  resolvePath(inputPath: string, basePath?: string): Promise<string>;
  getDepth(path: string, basePath?: string): number;
}
```

### Design Decisions

1. **Async by default**: `isPathAllowed` is async because `resolveSymlinks` requires filesystem access via `fs.realpath`. The synchronous pattern matching methods are separate for use cases where symlink resolution isn't needed.

2. **Use fast-glob for pattern matching**: The project already depends on `fast-glob@3.3.2`. We'll use `picomatch` (fast-glob's internal matcher) for consistent glob semantics. Actually, we'll use `micromatch` which is the underlying library used by fast-glob.

3. **Blocklist takes precedence**: If a path matches both allowlist and blocklist, the blocklist wins. This follows the principle of least privilege.

4. **Evaluation order**:
   - Check blocklist first (if match, deny)
   - Check allowlist (if match, allow)
   - If no matches, use `defaultAllow` (defaults to false if allowlist is non-empty)

5. **Cross-platform path handling**: Use Node.js path utilities and normalize all paths before matching. Support both Unix and Windows path formats.

6. **Depth calculation**: Measure from the base path (usually project root) to prevent deep directory traversal.

7. **No caching**: Patterns are typically checked per-operation, and the overhead is minimal. Avoids stale cache issues.

### Pattern Matching Semantics

- Support standard glob patterns: `*`, `**`, `?`, `[abc]`
- Patterns are matched against normalized absolute paths
- Relative patterns are resolved against the base path
- Examples:
  - `src/**` matches `/project/src/file.ts` and `/project/src/nested/file.ts`
  - `*.secret` matches `/project/config.secret`
  - `node_modules` matches `/project/node_modules`
  - `/etc/**` matches system paths (for blocklisting)

### Default Behavior

When `defaultAllow` is not explicitly set:
- If `allowlist` is non-empty: default is `false` (explicit allowlist mode)
- If `allowlist` is empty: default is `true` (blocklist-only mode)

This enables two common use cases:
1. Allowlist mode: Only allow specific directories (e.g., `src/**`, `tests/**`)
2. Blocklist mode: Allow everything except specific paths (e.g., `.env`, `secrets/`)

## Consequences

### Positive
- Clear, predictable access control for agent filesystem operations
- Consistent glob pattern matching using established libraries
- Flexible configuration supporting both allowlist and blocklist modes
- Cross-platform compatibility
- Symlink resolution prevents path traversal attacks

### Negative
- Async API required for symlink resolution (small performance overhead)
- Additional dependency on micromatch (though it's already transitively included via fast-glob)

### Risks
- Complex glob patterns may have unexpected matching behavior
- Symlink resolution can fail on broken symlinks (needs error handling)

## Implementation Notes

1. File location: `packages/core/src/directory-access-validator.ts`
2. Export from: `packages/core/src/index.ts`
3. Test file: `packages/core/src/__tests__/directory-access-validator.test.ts`
4. Dependencies:
   - `micromatch` (for glob pattern matching - needs to be added)
   - `path` (Node.js built-in)
   - `fs/promises` (Node.js built-in for symlink resolution)
5. Integration with existing code:
   - Uses `DirectoryAccessConfig` from `types.ts`
   - Uses `normalizePath` from `path-utils.ts`

## References

- DirectoryAccessConfigSchema: `packages/core/src/types.ts` (lines 119-138)
- FilesystemToolConfig: `packages/core/src/types.ts` (lines 166-179)
- Existing path utilities: `packages/core/src/path-utils.ts`
- Similar pattern: `ContainerRuntime` class structure
