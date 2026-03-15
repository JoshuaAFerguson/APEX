# ADR: ImportGraphBuilder Architecture

**Status**: Proposed
**Date**: 2025-02-22
**Author**: Architect Agent
**Decision Makers**: Development Team

## Context

APEX needs a module dependency analysis capability to understand import/require relationships between files. This enables features like:
- Dependency visualization
- Impact analysis (what files are affected by changes)
- Circular dependency detection
- Dead code identification
- Module boundary enforcement

## Decision

We will implement an `ImportGraphBuilder` class that analyzes import/require statements to build a directed graph representing module dependencies.

### Location

The ImportGraphBuilder will be located in the `codebase-intelligence` module:
```
packages/orchestrator/src/codebase-intelligence/import-graph/
├── import-graph-builder.ts      # Main class implementation
├── import-graph-builder.test.ts # Unit tests
├── types.ts                     # Types and interfaces
└── index.ts                     # Module exports
```

### Types Design

```typescript
/**
 * Represents a node in the import graph (a file/module)
 */
export interface ImportGraphNode {
  /** Unique identifier (typically the resolved file path) */
  id: string;
  /** File path relative to project root */
  path: string;
  /** File extension */
  extension: string;
  /** Language of the file */
  language: SupportedLanguage | 'unknown';
  /** Number of imports (outgoing edges) */
  importCount: number;
  /** Number of importers (incoming edges) */
  importerCount: number;
  /** Whether this is an external package (node_modules) */
  isExternal: boolean;
  /** Whether this file could not be resolved */
  isUnresolved: boolean;
  /** Metadata about the file */
  metadata?: Record<string, unknown>;
}

/**
 * Represents an edge in the import graph (an import relationship)
 */
export interface ImportGraphEdge {
  /** Source file (the file containing the import statement) */
  source: string;
  /** Target file (the file being imported) */
  target: string;
  /** The original import specifier as written in code */
  specifier: string;
  /** Type of import */
  importType: ImportType;
  /** Specific symbols imported (for named imports) */
  importedSymbols: string[];
  /** Whether this is a type-only import (TypeScript) */
  isTypeOnly: boolean;
  /** Whether this is a dynamic import */
  isDynamic: boolean;
  /** Line number of the import statement */
  line: number;
  /** Whether the import is used (not tree-shaken) */
  isUsed?: boolean;
}

/**
 * Import statement types
 */
export type ImportType =
  | 'es6-named'        // import { foo } from 'module'
  | 'es6-default'      // import foo from 'module'
  | 'es6-namespace'    // import * as foo from 'module'
  | 'es6-side-effect'  // import 'module'
  | 'commonjs-require' // const foo = require('module')
  | 'commonjs-module'  // module.exports = ...
  | 'dynamic-import'   // import('module')
  | 'reexport'         // export { foo } from 'module'
  | 'reexport-all';    // export * from 'module'

/**
 * The complete import graph structure
 */
export interface ImportGraph {
  /** All nodes (files) in the graph */
  nodes: ImportGraphNode[];
  /** All edges (import relationships) in the graph */
  edges: ImportGraphEdge[];
  /** Root path of the analyzed codebase */
  rootPath: string;
  /** Statistics about the graph */
  stats: ImportGraphStats;
  /** When the graph was built */
  createdAt: Date;
  /** Errors encountered during analysis */
  errors: ImportGraphError[];
}

/**
 * Statistics about the import graph
 */
export interface ImportGraphStats {
  /** Total number of files (nodes) */
  totalNodes: number;
  /** Total number of import relationships (edges) */
  totalEdges: number;
  /** Number of external dependencies */
  externalDependencies: number;
  /** Number of internal modules */
  internalModules: number;
  /** Number of unresolved imports */
  unresolvedImports: number;
  /** Circular dependency count */
  circularDependencies: number;
  /** Files with most imports (hot spots) */
  mostImported: Array<{ path: string; count: number }>;
  /** Files that import the most */
  mostImporting: Array<{ path: string; count: number }>;
  /** Language breakdown */
  languageBreakdown: Record<string, number>;
}

/**
 * Error encountered during import graph building
 */
export interface ImportGraphError {
  /** File where error occurred */
  file: string;
  /** Error message */
  message: string;
  /** Error type */
  type: 'parse' | 'resolve' | 'unsupported';
  /** Line number if applicable */
  line?: number;
}

/**
 * Options for building the import graph
 */
export interface ImportGraphBuilderOptions {
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Whether to resolve external packages */
  resolveExternal?: boolean;
  /** TypeScript path alias configuration */
  tsConfigPath?: string;
  /** Base URL for TypeScript path resolution */
  baseUrl?: string;
  /** Path alias mappings */
  pathAliases?: Record<string, string[]>;
  /** Whether to follow symlinks */
  followSymlinks?: boolean;
  /** Maximum depth for recursive analysis */
  maxDepth?: number;
  /** Whether to detect dynamic imports */
  includeDynamicImports?: boolean;
  /** Whether to continue on individual file errors */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (progress: ImportGraphProgress) => void;
}

/**
 * Progress information during graph building
 */
export interface ImportGraphProgress {
  /** Current phase */
  phase: 'discovering' | 'parsing' | 'resolving' | 'analyzing';
  /** Current file being processed */
  currentFile?: string;
  /** Files processed */
  filesProcessed: number;
  /** Total files to process */
  totalFiles: number;
  /** Percentage complete */
  percentComplete: number;
}
```

### Class Design

```typescript
/**
 * ImportGraphBuilder - Analyzes import/require statements to build dependency graph
 *
 * Supports:
 * - ES6 imports (named, default, namespace, side-effect, dynamic)
 * - CommonJS require statements
 * - TypeScript path aliases
 * - Re-exports
 *
 * @example
 * ```typescript
 * const builder = ImportGraphBuilder.getInstance();
 * const graph = await builder.buildGraph('/path/to/project', {
 *   includePatterns: ['src/**/*.ts'],
 *   tsConfigPath: '/path/to/tsconfig.json'
 * });
 *
 * // Analyze dependencies
 * const circular = builder.findCircularDependencies(graph);
 * const impact = builder.getImpactedFiles(graph, 'src/utils.ts');
 * ```
 */
export class ImportGraphBuilder {
  /** Singleton instance */
  private static instance: ImportGraphBuilder | null = null;

  /** Tree-sitter wrapper for AST parsing */
  private parser: TreeSitterWrapper;

  /** Cached tsconfig for path resolution */
  private tsConfigCache: Map<string, TsConfig>;

  /**
   * Get the singleton instance
   */
  public static getInstance(): ImportGraphBuilder;

  /**
   * Reset the singleton instance (for testing)
   */
  public static resetInstance(): void;

  /**
   * Build an import graph for a directory
   *
   * @param rootPath - Root path of the codebase
   * @param options - Build options
   * @returns The complete import graph
   */
  public async buildGraph(
    rootPath: string,
    options?: ImportGraphBuilderOptions
  ): Promise<ImportGraph>;

  /**
   * Build an import graph from a list of files
   *
   * @param files - List of file paths to analyze
   * @param rootPath - Root path for relative paths
   * @param options - Build options
   * @returns The complete import graph
   */
  public async buildGraphFromFiles(
    files: string[],
    rootPath: string,
    options?: ImportGraphBuilderOptions
  ): Promise<ImportGraph>;

  /**
   * Update an existing graph with changes
   *
   * @param graph - Existing graph to update
   * @param changedFiles - Files that have changed
   * @returns Updated import graph
   */
  public async updateGraph(
    graph: ImportGraph,
    changedFiles: string[]
  ): Promise<ImportGraph>;

  /**
   * Find circular dependencies in the graph
   *
   * @param graph - The import graph to analyze
   * @returns Array of circular dependency chains
   */
  public findCircularDependencies(graph: ImportGraph): string[][];

  /**
   * Get files impacted by changes to a specific file
   *
   * @param graph - The import graph
   * @param filePath - The changed file
   * @param options - Analysis options
   * @returns List of impacted file paths
   */
  public getImpactedFiles(
    graph: ImportGraph,
    filePath: string,
    options?: { maxDepth?: number; includeTransitive?: boolean }
  ): string[];

  /**
   * Get the dependency chain from one file to another
   *
   * @param graph - The import graph
   * @param from - Source file
   * @param to - Target file
   * @returns Array of paths representing the dependency chain, or null
   */
  public getDependencyPath(
    graph: ImportGraph,
    from: string,
    to: string
  ): string[] | null;

  /**
   * Export graph to DOT format (for visualization with Graphviz)
   *
   * @param graph - The import graph
   * @param options - Export options
   * @returns DOT format string
   */
  public exportToDot(
    graph: ImportGraph,
    options?: { includeExternal?: boolean; cluster?: boolean }
  ): string;

  // Private methods for import extraction
  private extractImports(sourceCode: string, language: SupportedLanguage): ImportEdge[];
  private resolveImportPath(specifier: string, fromFile: string, options: ImportGraphBuilderOptions): string | null;
  private loadTsConfig(tsConfigPath: string): TsConfig;
  private resolveWithPathAliases(specifier: string, aliases: Record<string, string[]>, baseUrl: string): string | null;
}
```

### Integration with Existing Types

The implementation will integrate with existing core types:

1. **ImportEdge** from `@apexcli/core/types` - Reuse for basic edge representation
2. **SupportedLanguage** from `codebase-intelligence/parsers/types` - For language detection
3. **TreeSitterWrapper** - For AST parsing

### Import Extraction Strategy

The builder will use tree-sitter AST parsing (already available) to extract imports:

#### ES6 Imports
```typescript
// Tree-sitter node types to look for:
// - import_statement
// - export_statement (for re-exports)
// - call_expression with 'import' callee (dynamic imports)
```

#### CommonJS Requires
```typescript
// Tree-sitter node types:
// - call_expression where callee is 'require'
// - assignment_expression with require call
```

#### TypeScript Path Aliases
```typescript
// Resolution order:
// 1. Check path aliases from tsconfig.json
// 2. Check node_modules
// 3. Check relative paths
// 4. Mark as unresolved
```

### Algorithm Considerations

1. **Graph Building**: O(n*m) where n = files, m = average imports per file
2. **Circular Detection**: Tarjan's algorithm for strongly connected components - O(V + E)
3. **Impact Analysis**: BFS/DFS from target node - O(V + E)
4. **Memory**: Store adjacency list representation for efficiency

### Error Handling

- Continue-on-error by default (configurable)
- Collect errors in `ImportGraphError[]`
- Graceful handling of:
  - Syntax errors in source files
  - Unresolved imports (mark node as `isUnresolved`)
  - Circular dependencies (detect but don't fail)
  - Permission errors

## Consequences

### Positive
- Enables powerful dependency analysis features
- Integrates seamlessly with existing codebase-intelligence module
- Reuses existing tree-sitter infrastructure
- Supports incremental updates
- Language-agnostic design (easily extensible)

### Negative
- Additional processing time during indexing
- Memory overhead for large codebases
- Path resolution complexity (especially with TypeScript aliases)

### Risks
- Performance with very large codebases (>10,000 files)
- Accuracy of dynamic import detection
- Complex monorepo configurations

## Implementation Plan

### Phase 1: Core Implementation
1. Create `import-graph/types.ts` with all interfaces
2. Implement `ImportGraphBuilder` class with basic ES6 support
3. Add CommonJS require support
4. Write unit tests

### Phase 2: Path Resolution
1. TypeScript path alias resolution
2. Node.js module resolution algorithm
3. External dependency handling

### Phase 3: Analysis Features
1. Circular dependency detection
2. Impact analysis
3. DOT export for visualization

### Phase 4: Integration
1. Export from `codebase-intelligence/index.ts`
2. Integration with `CodebaseIndexer`
3. CLI command for dependency visualization

## Test Strategy

Unit tests should cover:
- ES6 import extraction (all variants)
- CommonJS require extraction
- TypeScript path alias resolution
- Circular dependency detection
- Impact analysis accuracy
- Error handling scenarios
- Performance with large file sets

## References

- Existing `ImportEdge` type in `@apexcli/core/types`
- `TypeScriptExtractor` pattern for singleton + tree-sitter
- `CodebaseIndexer` for file discovery patterns
- Node.js module resolution algorithm
- TypeScript path mapping specification
