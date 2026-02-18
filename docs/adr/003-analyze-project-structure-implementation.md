# ADR-003: analyzeProjectStructure() Implementation

## Status

Accepted

## Context

The APEX platform requires a method to analyze project directory structures to provide context for AI agents. The `ProjectContextAnalyzer` class in `packages/core/src/project-context-analyzer.ts` has a skeleton `getProjectStructure()` method that needs to be fully implemented.

### Requirements from Acceptance Criteria

The `analyzeProjectStructure()` method must return:
1. **Project root** - Absolute path to the project root directory
2. **List of top-level directories** - First-level subdirectories
3. **Detected src/test/docs folders** - Common project directories
4. **File count by extension** - Statistics on file types in the project
5. **Monorepo structure identification** - Detect if project is a monorepo

### Existing Infrastructure

The codebase already provides:
- `ProjectStructure` Zod schema in `packages/core/src/types.ts` (lines 10198-10238)
- `ProjectEntry` schema for hierarchical structure representation
- `ProjectContextAnalyzerOptions` for configuration (maxDepth, excludeDirectories, includeHidden)
- Patterns from `getGitStatus()` implementation for async file system operations

## Decision

### 1. Method Signature

The implementation will enhance the existing `getProjectStructure()` method to return a fully-populated `ProjectStructure` object:

```typescript
async getProjectStructure(): Promise<ProjectStructure>
```

### 2. Data Structure Extensions

To meet all acceptance criteria, we need to extend the `ProjectStructure` type with additional fields:

```typescript
// Additional fields in ProjectStructureSchema
fileCountByExtension: z.record(z.string(), z.number()) // .ts: 50, .js: 20, etc.
isMonorepo: z.boolean()
monorepoType: z.enum(['npm-workspaces', 'yarn-workspaces', 'pnpm-workspaces', 'lerna', 'turborepo', 'nx', 'rush', 'unknown']).optional()
workspacePackages: z.array(z.string()).optional() // ['packages/core', 'packages/cli', ...]
```

### 3. Implementation Architecture

```
getProjectStructure()
├── scanDirectory(path, depth) - Recursive directory traversal
│   ├── fs.readdir() with { withFileTypes: true }
│   ├── Filter excluded directories
│   ├── Handle hidden files based on options
│   └── Build ProjectEntry tree
├── detectCommonDirectories() - Identify src/test/docs/etc.
│   └── Match against known directory patterns
├── detectRootFiles() - Identify key root-level files
│   └── package.json, README, LICENSE, etc.
├── countFilesByExtension() - Aggregate file statistics
│   └── Walk the entry tree and count by extension
└── detectMonorepo() - Identify monorepo structure
    ├── Check for workspaces in package.json
    ├── Check for lerna.json
    ├── Check for turbo.json
    ├── Check for nx.json
    └── Check for pnpm-workspace.yaml
```

### 4. Common Directory Detection

Standard directories to detect:
| Category | Directories |
|----------|-------------|
| Source Code | `src/`, `lib/`, `source/`, `app/`, `packages/` |
| Tests | `test/`, `tests/`, `__tests__/`, `spec/`, `specs/`, `e2e/` |
| Documentation | `docs/`, `doc/`, `documentation/` |
| Build Output | `dist/`, `build/`, `out/`, `output/`, `.next/`, `.nuxt/` |
| Configuration | `config/`, `configs/`, `.config/` |
| Assets | `assets/`, `static/`, `public/`, `resources/` |
| Scripts | `scripts/`, `bin/` |

### 5. Monorepo Detection Logic

| Indicator | Monorepo Type |
|-----------|---------------|
| `package.json` with `workspaces` field | `npm-workspaces` / `yarn-workspaces` |
| `pnpm-workspace.yaml` exists | `pnpm-workspaces` |
| `lerna.json` exists | `lerna` |
| `turbo.json` exists | `turborepo` |
| `nx.json` exists | `nx` |
| `rush.json` exists | `rush` |
| `packages/` dir with multiple `package.json` children | Inferred monorepo |

### 6. Performance Considerations

1. **Depth Limiting**: Use `options.maxDepth` to prevent excessive traversal
2. **Early Exit**: Skip excluded directories immediately
3. **Parallel Processing**: Use `Promise.all` for concurrent file operations where safe
4. **Lazy Statistics**: Calculate file counts from already-scanned entries (no re-traversal)

### 7. Error Handling

- Handle `ENOENT` for missing directories gracefully
- Handle `EACCES` for permission denied with appropriate logging
- Handle symlink cycles by tracking visited paths
- Never throw for non-critical failures; report in `errors` array

### 8. Unit Testing Strategy

Tests will cover:
1. **Empty directory** - Returns structure with zero counts
2. **Simple flat structure** - Single-level files and directories
3. **Nested structure** - Multi-level hierarchy with depth limiting
4. **Monorepo detection** - Each monorepo type detection
5. **Common directory detection** - src, test, docs recognition
6. **File extension counting** - Accurate statistics
7. **Excluded directory handling** - node_modules, .git skipped
8. **Hidden file handling** - Respect `includeHidden` option
9. **Permission errors** - Graceful handling
10. **Symlink handling** - No infinite loops

## Consequences

### Positive
- AI agents get comprehensive project understanding
- Monorepo detection enables workspace-aware operations
- File statistics help with language/framework inference
- Hierarchical structure supports various analysis depths

### Negative
- Large projects may take noticeable time to scan
- Deep hierarchies increase memory usage
- Results become stale (consider caching strategy for future)

### Risks
- Very large monorepos (>100k files) may need pagination or sampling
- Symlink cycles could cause issues if not handled properly
- Network filesystems may have latency issues

## Implementation Plan

### Phase 1: Core Implementation
1. Add new schema fields to `ProjectStructureSchema` in `types.ts`
2. Implement `scanDirectory()` private method
3. Implement `detectCommonDirectories()` private method
4. Implement `countFilesByExtension()` private method
5. Update `getProjectStructure()` to orchestrate above methods

### Phase 2: Monorepo Detection
1. Implement `detectMonorepo()` private method
2. Add workspace package discovery
3. Integrate with main `getProjectStructure()` flow

### Phase 3: Testing
1. Create mock file system test fixtures
2. Write unit tests for each detection method
3. Write integration tests for full analysis
4. Test edge cases (empty dirs, deep nesting, permission errors)

### Phase 4: Integration
1. Update existing tests that depend on `getProjectStructure()`
2. Ensure build and typecheck pass
3. Document new capabilities

## References

- `packages/core/src/project-context-analyzer.ts` - Existing skeleton
- `packages/core/src/types.ts` - Zod schemas (lines 10152-10238)
- `packages/core/src/__tests__/project-context-analyzer.test.ts` - Existing tests
- `packages/core/src/environment-detector.ts` - Reference implementation pattern
