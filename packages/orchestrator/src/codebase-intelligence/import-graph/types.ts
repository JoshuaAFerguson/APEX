/**
 * Import Graph Types
 *
 * Type definitions for the ImportGraphBuilder module which analyzes
 * import/require statements to build module dependency graphs.
 *
 * @module orchestrator/codebase-intelligence/import-graph/types
 */

import type { SupportedLanguage } from '../parsers/types.js';

// ============================================================================
// Import Types
// ============================================================================

/**
 * Import statement types representing different ways modules can be imported
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
 * All import types as an array for validation
 */
export const IMPORT_TYPES: readonly ImportType[] = [
  'es6-named',
  'es6-default',
  'es6-namespace',
  'es6-side-effect',
  'commonjs-require',
  'commonjs-module',
  'dynamic-import',
  'reexport',
  'reexport-all'
] as const;

// ============================================================================
// Graph Node Types
// ============================================================================

/**
 * Represents a node in the import graph (a file/module)
 *
 * @example
 * ```typescript
 * const node: ImportGraphNode = {
 *   id: '/project/src/utils/helpers.ts',
 *   path: 'src/utils/helpers.ts',
 *   extension: '.ts',
 *   language: 'typescript',
 *   importCount: 3,
 *   importerCount: 15,
 *   isExternal: false,
 *   isUnresolved: false
 * };
 * ```
 */
export interface ImportGraphNode {
  /** Unique identifier (typically the resolved absolute file path) */
  id: string;
  /** File path relative to project root */
  path: string;
  /** File extension (e.g., '.ts', '.js', '.tsx') */
  extension: string;
  /** Programming language of the file */
  language: SupportedLanguage | 'unknown';
  /** Number of imports this file makes (outgoing edges) */
  importCount: number;
  /** Number of files that import this file (incoming edges) */
  importerCount: number;
  /** Whether this is an external package (from node_modules) */
  isExternal: boolean;
  /** Whether this file could not be resolved on disk */
  isUnresolved: boolean;
  /** Additional metadata about the file */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Graph Edge Types
// ============================================================================

/**
 * Represents an edge in the import graph (an import relationship)
 *
 * @example
 * ```typescript
 * const edge: ImportGraphEdge = {
 *   source: 'src/components/App.tsx',
 *   target: 'src/utils/helpers.ts',
 *   specifier: './utils/helpers',
 *   importType: 'es6-named',
 *   importedSymbols: ['formatDate', 'parseJSON'],
 *   isTypeOnly: false,
 *   isDynamic: false,
 *   line: 5
 * };
 * ```
 */
export interface ImportGraphEdge {
  /** Source file path (the file containing the import statement) */
  source: string;
  /** Target file path (the file being imported) */
  target: string;
  /** The original import specifier as written in code */
  specifier: string;
  /** Type of import statement */
  importType: ImportType;
  /** Specific symbols imported (for named imports, empty for default/namespace) */
  importedSymbols: string[];
  /** Whether this is a type-only import (TypeScript `import type`) */
  isTypeOnly: boolean;
  /** Whether this is a dynamic import (`import()`) */
  isDynamic: boolean;
  /** Line number of the import statement (1-based) */
  line: number;
  /** Column number of the import statement (0-based) */
  column?: number;
  /** Whether the imported symbols are actually used in the code */
  isUsed?: boolean;
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * Statistics about the import graph
 *
 * @example
 * ```typescript
 * const stats: ImportGraphStats = {
 *   totalNodes: 150,
 *   totalEdges: 450,
 *   externalDependencies: 25,
 *   internalModules: 125,
 *   unresolvedImports: 2,
 *   circularDependencies: 1,
 *   mostImported: [{ path: 'src/utils/index.ts', count: 45 }],
 *   mostImporting: [{ path: 'src/components/App.tsx', count: 12 }],
 *   languageBreakdown: { typescript: 140, javascript: 10 }
 * };
 * ```
 */
export interface ImportGraphStats {
  /** Total number of files (nodes) in the graph */
  totalNodes: number;
  /** Total number of import relationships (edges) in the graph */
  totalEdges: number;
  /** Number of external package dependencies */
  externalDependencies: number;
  /** Number of internal project modules */
  internalModules: number;
  /** Number of imports that could not be resolved */
  unresolvedImports: number;
  /** Number of circular dependency cycles detected */
  circularDependencies: number;
  /** Top files by number of importers (most depended upon) */
  mostImported: Array<{ path: string; count: number }>;
  /** Top files by number of imports (most dependencies) */
  mostImporting: Array<{ path: string; count: number }>;
  /** Breakdown of files by programming language */
  languageBreakdown: Record<string, number>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error types that can occur during import graph building
 */
export type ImportGraphErrorType = 'parse' | 'resolve' | 'unsupported' | 'io';

/**
 * Error encountered during import graph building
 *
 * @example
 * ```typescript
 * const error: ImportGraphError = {
 *   file: 'src/broken.ts',
 *   message: 'Syntax error: Unexpected token',
 *   type: 'parse',
 *   line: 15
 * };
 * ```
 */
export interface ImportGraphError {
  /** File where error occurred */
  file: string;
  /** Human-readable error message */
  message: string;
  /** Type of error */
  type: ImportGraphErrorType;
  /** Line number if applicable */
  line?: number;
  /** Column number if applicable */
  column?: number;
  /** Original error if available */
  cause?: Error;
}

// ============================================================================
// Main Graph Type
// ============================================================================

/**
 * The complete import graph structure containing nodes, edges, and metadata
 *
 * @example
 * ```typescript
 * const graph: ImportGraph = {
 *   nodes: [
 *     { id: '/project/src/index.ts', path: 'src/index.ts', ... }
 *   ],
 *   edges: [
 *     { source: 'src/index.ts', target: 'src/app.ts', ... }
 *   ],
 *   rootPath: '/project',
 *   stats: { totalNodes: 1, totalEdges: 1, ... },
 *   createdAt: new Date(),
 *   errors: []
 * };
 * ```
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
  /** Version of the graph format */
  version: string;
  /** Errors encountered during analysis */
  errors: ImportGraphError[];
}

// ============================================================================
// Builder Options
// ============================================================================

/**
 * Progress information during graph building
 */
export interface ImportGraphProgress {
  /** Current phase of the build process */
  phase: 'discovering' | 'parsing' | 'resolving' | 'analyzing' | 'complete';
  /** Current file being processed */
  currentFile?: string;
  /** Number of files processed so far */
  filesProcessed: number;
  /** Total number of files to process */
  totalFiles: number;
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Elapsed time in milliseconds */
  elapsedMs?: number;
}

/**
 * Options for building the import graph
 *
 * @example
 * ```typescript
 * const options: ImportGraphBuilderOptions = {
 *   includePatterns: ['src/**\/*.ts', 'src/**\/*.tsx'],
 *   excludePatterns: ['**\/*.test.ts', '**\/__tests__/**'],
 *   tsConfigPath: './tsconfig.json',
 *   resolveExternal: false,
 *   includeDynamicImports: true,
 *   continueOnError: true,
 *   onProgress: (progress) => console.log(`${progress.percentComplete}% complete`)
 * };
 * ```
 */
export interface ImportGraphBuilderOptions {
  /** File patterns to include (glob patterns) */
  includePatterns?: string[];
  /** File patterns to exclude (glob patterns) */
  excludePatterns?: string[];
  /** Whether to resolve and include external packages (node_modules) */
  resolveExternal?: boolean;
  /** Path to tsconfig.json for TypeScript path alias resolution */
  tsConfigPath?: string;
  /** Base URL for TypeScript path resolution (overrides tsconfig) */
  baseUrl?: string;
  /** Path alias mappings (overrides tsconfig) */
  pathAliases?: Record<string, string[]>;
  /** Whether to follow symbolic links */
  followSymlinks?: boolean;
  /** Maximum depth for recursive dependency analysis */
  maxDepth?: number;
  /** Whether to detect and include dynamic imports */
  includeDynamicImports?: boolean;
  /** Whether to continue processing on individual file errors */
  continueOnError?: boolean;
  /** Concurrency limit for parallel file processing */
  concurrency?: number;
  /** Progress callback function */
  onProgress?: (progress: ImportGraphProgress) => void;
}

/**
 * Default options for ImportGraphBuilder
 */
export const DEFAULT_IMPORT_GRAPH_OPTIONS: Required<Omit<ImportGraphBuilderOptions, 'onProgress' | 'tsConfigPath' | 'baseUrl' | 'pathAliases'>> & {
  onProgress: undefined;
  tsConfigPath: undefined;
  baseUrl: undefined;
  pathAliases: undefined;
} = {
  includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/__tests__/**',
    '**/__mocks__/**'
  ],
  resolveExternal: false,
  tsConfigPath: undefined,
  baseUrl: undefined,
  pathAliases: undefined,
  followSymlinks: false,
  maxDepth: undefined,
  includeDynamicImports: true,
  continueOnError: true,
  concurrency: 4,
  onProgress: undefined
};

// ============================================================================
// Analysis Types
// ============================================================================

/**
 * Options for impact analysis
 */
export interface ImpactAnalysisOptions {
  /** Maximum depth for transitive dependency analysis */
  maxDepth?: number;
  /** Whether to include transitive dependencies */
  includeTransitive?: boolean;
  /** Whether to include external dependencies in impact */
  includeExternal?: boolean;
}

/**
 * Result of finding circular dependencies
 */
export interface CircularDependency {
  /** Files involved in the circular dependency chain */
  cycle: string[];
  /** Number of files in the cycle */
  length: number;
}

/**
 * Options for DOT export
 */
export interface DotExportOptions {
  /** Whether to include external dependencies */
  includeExternal?: boolean;
  /** Whether to cluster by directory */
  cluster?: boolean;
  /** Maximum nodes to include (for large graphs) */
  maxNodes?: number;
  /** Node color scheme */
  colorScheme?: 'language' | 'directory' | 'importance';
  /** Title for the graph */
  title?: string;
}

// ============================================================================
// TypeScript Config Types
// ============================================================================

/**
 * Relevant portions of tsconfig.json for path resolution
 */
export interface TsConfigPaths {
  /** Base URL for non-relative module names */
  baseUrl?: string;
  /** Path mapping entries */
  paths?: Record<string, string[]>;
  /** Root directories for module resolution */
  rootDirs?: string[];
}

/**
 * Parsed tsconfig.json with resolved paths
 */
export interface ParsedTsConfig {
  /** Path to the tsconfig file */
  configPath: string;
  /** Compiler options relevant to module resolution */
  compilerOptions: TsConfigPaths;
  /** Resolved base directory */
  baseDir: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type guard to check if a value is a valid ImportType
 */
export function isImportType(value: unknown): value is ImportType {
  return typeof value === 'string' && IMPORT_TYPES.includes(value as ImportType);
}

/**
 * Create an empty ImportGraph with default values
 */
export function createEmptyImportGraph(rootPath: string): ImportGraph {
  return {
    nodes: [],
    edges: [],
    rootPath,
    stats: {
      totalNodes: 0,
      totalEdges: 0,
      externalDependencies: 0,
      internalModules: 0,
      unresolvedImports: 0,
      circularDependencies: 0,
      mostImported: [],
      mostImporting: [],
      languageBreakdown: {}
    },
    createdAt: new Date(),
    version: '1.0.0',
    errors: []
  };
}

/**
 * Graph version for compatibility checking
 */
export const IMPORT_GRAPH_VERSION = '1.0.0';
