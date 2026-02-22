# ADR-004: ImportGraphBuilder Architecture

## Status

Proposed

## Context

APEX requires a dedicated module for analyzing module dependencies and building comprehensive import graphs. While existing infrastructure provides symbol extraction and codebase indexing, there is no dedicated module for:

1. **Complete Import Analysis**: Parsing all import/require patterns (ES6, CommonJS, dynamic imports)
2. **TypeScript Path Alias Resolution**: Resolving `@/`, `~/`, and custom path mappings
3. **Dependency Graph Construction**: Building directed graphs showing module relationships
4. **Cycle Detection**: Identifying circular dependencies
5. **Impact Analysis**: Understanding which files are affected by changes

The codebase-intelligence module already provides:
- `TreeSitterWrapper`: Multi-language AST parsing
- `TypeScriptExtractor`/`PythonExtractor`: Symbol extraction with import detection
- `CodebaseIndexer`: Directory indexing with basic import edges
- `SymbolResolver`: Symbol definition/reference resolution

Additionally, the `import-auto-fixer` module provides:
- `TsConfigInfo` interface for reading tsconfig.json
- `AliasResolver` for path alias resolution
- Import pattern detection utilities

## Decision

### 1. Core Types: ImportGraph, ImportNode, ImportEdge

Define new types in `@apexcli/core/types.ts` (extending existing `ImportEdge`):

```typescript
/**
 * A node in the import dependency graph
 * Represents a single module/file
 */
export const ImportNodeSchema = z.object({
  /** File path relative to repository root */
  path: z.string().min(1),

  /** Absolute file path */
  absolutePath: z.string().min(1),

  /** Type of module */
  moduleType: z.enum(['esm', 'commonjs', 'mixed', 'unknown']),

  /** Whether this is an external package (not local file) */
  isExternal: z.boolean().default(false),

  /** Package name if external */
  packageName: z.string().optional(),

  /** Number of outgoing imports (this file imports from others) */
  outDegree: z.number().int().min(0).default(0),

  /** Number of incoming imports (other files import from this) */
  inDegree: z.number().int().min(0).default(0),

  /** Language of the module */
  language: z.string().optional(),

  /** Whether this module has parse errors */
  hasErrors: z.boolean().default(false),
});
export type ImportNode = z.infer<typeof ImportNodeSchema>;

/**
 * Import dependency graph with nodes and edges
 * Represents the complete import structure of a codebase
 */
export const ImportGraphSchema = z.object({
  /** Root path of the analyzed project */
  rootPath: z.string().min(1),

  /** All nodes (files/modules) in the graph */
  nodes: z.array(ImportNodeSchema),

  /** All edges (import relationships) between nodes */
  edges: z.array(ImportEdgeSchema),

  /** External package dependencies */
  externalDependencies: z.array(z.object({
    packageName: z.string(),
    importCount: z.number().int().min(1),
    importedBy: z.array(z.string()),
    isDevDependency: z.boolean().optional(),
  })).optional().default([]),

  /** Circular dependency cycles detected */
  cycles: z.array(z.array(z.string())).optional().default([]),

  /** Graph statistics */
  stats: z.object({
    totalNodes: z.number().int().min(0),
    totalEdges: z.number().int().min(0),
    totalExternalDeps: z.number().int().min(0),
    cycleCount: z.number().int().min(0),
    maxDepth: z.number().int().min(0),
    avgDependencies: z.number().min(0),
  }),

  /** Analysis metadata */
  metadata: z.object({
    analyzedAt: z.date(),
    duration: z.number().int().min(0),
    errors: z.array(z.object({
      file: z.string(),
      message: z.string(),
      severity: z.enum(['warning', 'error']),
    })).optional().default([]),
  }),
});
export type ImportGraph = z.infer<typeof ImportGraphSchema>;
```

### 2. Class Design: ImportGraphBuilder

Create `ImportGraphBuilder` class at `packages/orchestrator/src/codebase-intelligence/import-graph-builder.ts`:

```typescript
/**
 * Configuration options for import graph building
 */
export interface ImportGraphOptions {
  /** Include external (node_modules) dependencies in graph */
  includeExternal?: boolean;

  /** Detect circular dependencies */
  detectCycles?: boolean;

  /** Resolve TypeScript path aliases */
  resolveAliases?: boolean;

  /** Maximum depth for analysis (0 = unlimited) */
  maxDepth?: number;

  /** Glob patterns to exclude */
  excludePatterns?: string[];

  /** Analyze dynamic imports (import()) */
  includeDynamicImports?: boolean;

  /** Continue processing on individual file errors */
  continueOnError?: boolean;

  /** Include re-exports analysis */
  includeReExports?: boolean;
}

/**
 * Progress callback for UI integration
 */
export interface ImportGraphProgress {
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
  phase: 'discovery' | 'parsing' | 'resolution' | 'analysis';
  errors: Array<{ file: string; message: string }>;
}

/**
 * ImportGraphBuilder - Module Dependency Analysis
 *
 * Analyzes import/require statements to build comprehensive
 * dependency graphs supporting:
 * - ES6 imports (static and dynamic)
 * - CommonJS require()
 * - TypeScript path aliases
 * - Re-exports
 */
export class ImportGraphBuilder {
  private static instance: ImportGraphBuilder | null = null;
  private wrapper: TreeSitterWrapper;
  private aliasResolver: PathAliasResolver;

  public static getInstance(): ImportGraphBuilder;
  public static resetInstance(): void;

  /**
   * Build an import graph for a directory
   *
   * @param rootPath - Root directory to analyze
   * @param options - Configuration options
   * @returns Promise<ImportGraph> - Complete import graph
   */
  public async buildGraph(
    rootPath: string,
    options?: ImportGraphOptions
  ): Promise<ImportGraph>;

  /**
   * Build graph with progress callback
   */
  public async buildGraphWithProgress(
    rootPath: string,
    options?: ImportGraphOptions,
    onProgress?: (progress: ImportGraphProgress) => void
  ): Promise<ImportGraph>;

  /**
   * Get dependencies of a specific file
   */
  public async getDependencies(
    filePath: string,
    rootPath: string,
    options?: ImportGraphOptions
  ): Promise<ImportEdge[]>;

  /**
   * Get files that depend on a specific file
   */
  public async getDependents(
    filePath: string,
    graph: ImportGraph
  ): Promise<string[]>;

  /**
   * Detect circular dependencies
   */
  public detectCycles(graph: ImportGraph): string[][];

  /**
   * Get the import chain between two files
   */
  public findImportPath(
    from: string,
    to: string,
    graph: ImportGraph
  ): string[] | null;
}
```

### 3. Data Flow Architecture

```
buildGraph(rootPath)
       │
       ▼
┌──────────────────────┐
│  Phase 1: Discovery  │ ← glob for supported extensions
│  Collect file paths  │   filter by excludePatterns
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Phase 2: Load       │ ← Load tsconfig.json
│  Configuration       │   Load package.json
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│  Phase 3: Parse Imports      │ ← For each file:
│  (Parallel Processing)       │
│  ┌─────────────────────────┐ │
│  │ Parse AST               │ │ ← TreeSitterWrapper.parseFile()
│  │ Extract import nodes    │ │
│  │ Detect import type      │ │ ← ES6/CommonJS/Dynamic
│  │ Extract imported names  │ │
│  └─────────────────────────┘ │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Phase 4: Resolve Paths      │ ← For each import:
│  ┌─────────────────────────┐ │
│  │ Resolve relative paths  │ │ ← ./foo, ../bar
│  │ Resolve aliases         │ │ ← @/components, ~/utils
│  │ Resolve node_modules    │ │ ← External packages
│  │ Handle index.js         │ │ ← Dir imports
│  └─────────────────────────┘ │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Phase 5: Build Graph        │ ← Construct nodes and edges
│  ┌─────────────────────────┐ │
│  │ Create ImportNode       │ │ ← For each unique file
│  │ Create ImportEdge       │ │ ← For each import statement
│  │ Calculate degrees       │ │ ← in/out connections
│  └─────────────────────────┘ │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Phase 6: Analysis           │
│  ┌─────────────────────────┐ │
│  │ Detect cycles (DFS)     │ │ ← Tarjan's algorithm
│  │ Calculate statistics    │ │ ← depth, avg deps
│  │ Group external deps     │ │
│  └─────────────────────────┘ │
└──────────┬───────────────────┘
           │
           ▼
      ImportGraph
```

### 4. Import Pattern Support

The builder will support parsing these import patterns:

#### ES6 Imports (JavaScript/TypeScript)

```typescript
// Named imports
import { foo, bar } from './module';
import { foo as alias } from './module';

// Default imports
import MyClass from './module';

// Namespace imports
import * as utils from './utils';

// Combined imports
import React, { useState, useEffect } from 'react';

// Side-effect imports
import './styles.css';

// Type-only imports (TypeScript)
import type { MyType } from './types';
import { type MyType, MyValue } from './module';

// Dynamic imports
const module = await import('./module');
import('./lazy').then(m => m.default);
```

#### CommonJS (JavaScript)

```typescript
// Standard require
const module = require('./module');
const { foo, bar } = require('./utils');

// Dynamic require
const path = './dynamic';
require(path); // Detected but not resolvable statically
```

#### TypeScript Path Aliases

```typescript
// tsconfig.json paths
import { Component } from '@/components/Component';
import { utils } from '~/lib/utils';
import { config } from '@app/config';
```

### 5. Path Resolution Strategy

```typescript
/**
 * PathAliasResolver - Handles TypeScript path alias resolution
 */
export class PathAliasResolver {
  private tsConfig: TsConfigInfo | null = null;
  private cache: Map<string, string | null> = new Map();

  /**
   * Load tsconfig.json and extract path mappings
   */
  async loadConfig(projectPath: string): Promise<void>;

  /**
   * Resolve an import specifier to an absolute path
   *
   * Resolution order:
   * 1. Relative imports (./foo, ../bar)
   * 2. Path aliases (@/, ~/, custom mappings)
   * 3. Node modules (external packages)
   * 4. Directory indexes (./dir → ./dir/index.ts)
   */
  resolve(
    importSpec: string,
    fromFile: string,
    rootPath: string
  ): Promise<ResolvedImport>;
}

interface ResolvedImport {
  /** Resolved absolute path or package name */
  resolvedPath: string;

  /** Whether this is an external package */
  isExternal: boolean;

  /** The alias that was used (if any) */
  usedAlias?: string;

  /** Original import specifier */
  originalSpec: string;

  /** Type of resolution used */
  resolutionType: 'relative' | 'alias' | 'node_modules' | 'unresolved';
}
```

### 6. AST Node Patterns for Import Detection

Using tree-sitter node types:

```typescript
const IMPORT_NODE_TYPES = {
  // ES6 imports
  IMPORT_STATEMENT: 'import_statement',
  IMPORT_CLAUSE: 'import_clause',
  NAMED_IMPORTS: 'named_imports',
  IMPORT_SPECIFIER: 'import_specifier',
  NAMESPACE_IMPORT: 'namespace_import',

  // Dynamic imports
  CALL_EXPRESSION: 'call_expression', // Check for import()
  AWAIT_EXPRESSION: 'await_expression',

  // CommonJS
  CALL_EXPRESSION: 'call_expression', // Check for require()

  // Re-exports
  EXPORT_STATEMENT: 'export_statement',
  EXPORT_CLAUSE: 'export_clause',
};

// Import type detection helpers
function isES6Import(node: SyntaxNode): boolean;
function isCommonJSRequire(node: SyntaxNode): boolean;
function isDynamicImport(node: SyntaxNode): boolean;
function isTypeOnlyImport(node: SyntaxNode): boolean;
function isReExport(node: SyntaxNode): boolean;
```

### 7. Cycle Detection Algorithm

Implement Tarjan's strongly connected components algorithm:

```typescript
interface CycleDetector {
  /**
   * Detect all cycles using Tarjan's SCC algorithm
   * Returns array of cycles (each cycle is array of file paths)
   */
  detectCycles(nodes: ImportNode[], edges: ImportEdge[]): string[][];

  /**
   * Check if adding an edge would create a cycle
   */
  wouldCreateCycle(from: string, to: string, edges: ImportEdge[]): boolean;
}

// Time complexity: O(V + E) where V = nodes, E = edges
function tarjanSCC(graph: AdjacencyList): StronglyConnectedComponent[] {
  // Standard Tarjan's algorithm implementation
  // Filter SCCs with size > 1 (those are cycles)
}
```

### 8. Default Configuration

```typescript
const DEFAULT_IMPORT_GRAPH_OPTIONS: Required<ImportGraphOptions> = {
  includeExternal: true,
  detectCycles: true,
  resolveAliases: true,
  maxDepth: 0, // unlimited
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
  ],
  includeDynamicImports: true,
  continueOnError: true,
  includeReExports: true,
};
```

### 9. Integration with Existing Infrastructure

```typescript
// Leverage existing modules
import { TreeSitterWrapper } from './parsers/tree-sitter-wrapper.js';
import { getLanguageForExtension } from './parsers/types.js';
import type { ImportEdge } from '@apexcli/core/types';

// Reuse patterns from import-auto-fixer
import type { TsConfigInfo } from '../import-auto-fixer/types.js';

// Integration with CodebaseIndexer
class CodebaseIndexer {
  /**
   * Index with import graph
   */
  async indexWithImportGraph(
    rootPath: string,
    options?: IndexingOptions & ImportGraphOptions
  ): Promise<RepositoryMap & { importGraph: ImportGraph }>;
}
```

### 10. Error Handling Strategy

| Error Type | Handling | Severity |
|------------|----------|----------|
| File read failure | Log, skip file, continue | warning |
| Parse error | Include in errors, partial extraction | warning |
| Unresolved alias | Mark as unresolved, continue | warning |
| Unresolved import | Include edge with isResolved=false | warning |
| Circular dependency | Detect and report in cycles array | info |
| Large cycle | Truncate cycle path if > 20 nodes | info |
| Permission denied | Log, skip file, continue | error |
| Invalid tsconfig | Fall back to no alias resolution | warning |

### 11. Performance Considerations

1. **Parallel File Processing**: Configurable concurrency (default: 4)
2. **Resolution Caching**: Cache alias resolutions per session
3. **Lazy Parsing**: Only parse files in analysis scope
4. **Early Termination**: Skip resolved imports in node_modules
5. **Streaming Results**: Support incremental graph building
6. **Memory Efficiency**: Use string references for paths, not objects

### 12. File Structure

```
packages/orchestrator/src/codebase-intelligence/
├── index.ts                         # Export import-graph-builder
├── import-graph-builder.ts          # NEW: ImportGraphBuilder class
├── import-graph-types.ts            # NEW: Internal types
├── path-alias-resolver.ts           # NEW: Path alias resolution
├── cycle-detector.ts                # NEW: Cycle detection (Tarjan's)
├── import-extractor.ts              # NEW: AST import extraction
├── ADR-004-import-graph-builder.md  # This document
├── __tests__/
│   ├── import-graph-builder.test.ts
│   ├── import-graph-builder.integration.test.ts
│   ├── path-alias-resolver.test.ts
│   ├── cycle-detector.test.ts
│   └── import-extractor.test.ts
└── ...existing files
```

## Consequences

### Positive

1. **Comprehensive Import Analysis**: Supports all major import patterns
2. **Alias Resolution**: Full TypeScript path alias support
3. **Cycle Detection**: Identifies problematic circular dependencies
4. **Impact Analysis Ready**: Graph structure enables change impact analysis
5. **Consistent API**: Follows established singleton patterns
6. **Extensible**: Easy to add new import pattern support
7. **Type Safe**: Full TypeScript types with Zod validation

### Negative

1. **Memory Usage**: Large graphs can consume significant memory
2. **Processing Time**: Full analysis of large codebases can be slow
3. **Dynamic Import Limitations**: Can't resolve runtime-computed paths
4. **External Resolution**: Relies on local node_modules structure

### Mitigations

1. Memory: Implement streaming/incremental graph building
2. Time: Parallel processing, caching, configurable depth limits
3. Dynamic: Mark dynamic imports as "unresolved" with warning
4. External: Optional external resolution via npm registry API

## Implementation Plan

### Phase 1: Core Infrastructure (Developer Stage)
1. Define types in `@apexcli/core/types.ts`
2. Create `ImportGraphBuilder` class skeleton
3. Implement `PathAliasResolver`
4. Implement basic import extraction

### Phase 2: Import Extraction (Developer Stage)
1. ES6 import pattern extraction
2. CommonJS require() extraction
3. Dynamic import detection
4. Type-only import handling

### Phase 3: Graph Construction (Developer Stage)
1. Node creation and deduplication
2. Edge creation with metadata
3. Degree calculation
4. External dependency grouping

### Phase 4: Analysis Features (Developer Stage)
1. Cycle detection (Tarjan's SCC)
2. Statistics calculation
3. Path finding utilities

### Phase 5: Testing (Tester Stage)
1. Unit tests for each component
2. Integration tests with real codebases
3. Edge case coverage
4. Performance benchmarks

### Phase 6: Documentation & Export (Developer Stage)
1. JSDoc documentation
2. Export from index.ts
3. Update CLAUDE.md if needed

## References

- ADR-002: CodebaseIndexer Architecture
- ADR-003: SymbolResolver Architecture
- `@apexcli/core/types.ts`: ImportEdge, CodeFile schemas
- `import-auto-fixer/types.ts`: TsConfigInfo, import-related types
- `import-auto-fixer/resolvers/alias-resolver.ts`: Path alias resolution patterns
- Tree-sitter grammar: ES6/CommonJS import patterns
