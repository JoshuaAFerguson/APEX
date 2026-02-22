/**
 * ImportGraphBuilder - Module Dependency Analysis
 *
 * Analyzes import/require statements to build a directed graph representing
 * module dependencies in a codebase.
 *
 * Features:
 * - ES6 imports (named, default, namespace, side-effect, dynamic)
 * - CommonJS require statements
 * - TypeScript path aliases
 * - Re-export tracking
 * - Circular dependency detection
 * - Impact analysis
 *
 * @example
 * ```typescript
 * const builder = ImportGraphBuilder.getInstance();
 * const graph = await builder.buildGraph('/path/to/project', {
 *   includePatterns: ['src/**\/*.ts'],
 *   tsConfigPath: '/path/to/tsconfig.json'
 * });
 *
 * // Find circular dependencies
 * const circular = builder.findCircularDependencies(graph);
 *
 * // Get files impacted by changes
 * const impact = builder.getImpactedFiles(graph, 'src/utils.ts');
 * ```
 *
 * @module orchestrator/codebase-intelligence/import-graph
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import type { SyntaxNode } from 'tree-sitter';

import { TreeSitterWrapper } from '../parsers/tree-sitter-wrapper.js';
import {
  getLanguageForExtension,
  type SupportedLanguage
} from '../parsers/types.js';

import {
  type ImportGraph,
  type ImportGraphNode,
  type ImportGraphEdge,
  type ImportGraphStats,
  type ImportGraphError,
  type ImportGraphBuilderOptions,
  type ImportGraphProgress,
  type ImportType,
  type ImpactAnalysisOptions,
  type CircularDependency,
  type DotExportOptions,
  type ParsedTsConfig,
  DEFAULT_IMPORT_GRAPH_OPTIONS,
  createEmptyImportGraph,
  IMPORT_GRAPH_VERSION
} from './types.js';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal representation of an extracted import
 */
interface ExtractedImport {
  specifier: string;
  importType: ImportType;
  importedSymbols: string[];
  isTypeOnly: boolean;
  isDynamic: boolean;
  line: number;
  column: number;
}

/**
 * Resolved options with all defaults applied
 */
type ResolvedOptions = Required<Omit<ImportGraphBuilderOptions, 'onProgress' | 'tsConfigPath' | 'baseUrl' | 'pathAliases'>> & {
  onProgress?: (progress: ImportGraphProgress) => void;
  tsConfigPath?: string;
  baseUrl?: string;
  pathAliases?: Record<string, string[]>;
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Node types for ES6 imports in tree-sitter
 */
const ES6_IMPORT_TYPES = {
  IMPORT_STATEMENT: 'import_statement',
  IMPORT_CLAUSE: 'import_clause',
  NAMED_IMPORTS: 'named_imports',
  IMPORT_SPECIFIER: 'import_specifier',
  NAMESPACE_IMPORT: 'namespace_import',
  EXPORT_STATEMENT: 'export_statement',
  CALL_EXPRESSION: 'call_expression'
} as const;

/**
 * Node types for CommonJS in tree-sitter
 */
const COMMONJS_TYPES = {
  CALL_EXPRESSION: 'call_expression',
  IDENTIFIER: 'identifier'
} as const;

// ============================================================================
// ImportGraphBuilder Class
// ============================================================================

/**
 * ImportGraphBuilder - Analyzes import/require statements to build dependency graphs
 *
 * Implements the singleton pattern for efficient reuse across multiple analyses.
 */
export class ImportGraphBuilder {
  /** Singleton instance */
  private static instance: ImportGraphBuilder | null = null;

  /** Tree-sitter wrapper for AST parsing */
  private parser: TreeSitterWrapper;

  /** Cache for parsed tsconfig files */
  private tsConfigCache: Map<string, ParsedTsConfig>;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.parser = TreeSitterWrapper.getInstance();
    this.tsConfigCache = new Map();
  }

  /**
   * Get the singleton instance of ImportGraphBuilder
   *
   * @returns The ImportGraphBuilder singleton instance
   */
  public static getInstance(): ImportGraphBuilder {
    if (!ImportGraphBuilder.instance) {
      ImportGraphBuilder.instance = new ImportGraphBuilder();
    }
    return ImportGraphBuilder.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    ImportGraphBuilder.instance = null;
  }

  // ==========================================================================
  // Public API - Graph Building
  // ==========================================================================

  /**
   * Build an import graph for a directory
   *
   * @param rootPath - Root path of the codebase to analyze
   * @param options - Build options
   * @returns The complete import graph
   *
   * @example
   * ```typescript
   * const graph = await builder.buildGraph('/path/to/project', {
   *   includePatterns: ['src/**\/*.ts'],
   *   tsConfigPath: './tsconfig.json'
   * });
   * ```
   */
  public async buildGraph(
    rootPath: string,
    options: ImportGraphBuilderOptions = {}
  ): Promise<ImportGraph> {
    const opts = this.resolveOptions(options);
    const absoluteRoot = path.resolve(rootPath);

    // Load tsconfig if specified
    let tsConfig: ParsedTsConfig | undefined;
    if (opts.tsConfigPath) {
      try {
        tsConfig = await this.loadTsConfig(opts.tsConfigPath, absoluteRoot);
      } catch {
        // Continue without tsconfig
      }
    }

    // Report progress: discovering
    this.reportProgress(opts, {
      phase: 'discovering',
      filesProcessed: 0,
      totalFiles: 0,
      percentComplete: 0
    });

    // Discover files
    const files = await this.discoverFiles(absoluteRoot, opts);

    // Build graph from files
    return this.buildGraphFromFiles(files, absoluteRoot, { ...options, ...opts }, tsConfig);
  }

  /**
   * Build an import graph from a list of files
   *
   * @param files - List of absolute file paths to analyze
   * @param rootPath - Root path for calculating relative paths
   * @param options - Build options
   * @param tsConfig - Pre-loaded tsconfig (optional)
   * @returns The complete import graph
   */
  public async buildGraphFromFiles(
    files: string[],
    rootPath: string,
    options: ImportGraphBuilderOptions = {},
    tsConfig?: ParsedTsConfig
  ): Promise<ImportGraph> {
    const opts = this.resolveOptions(options);
    const absoluteRoot = path.resolve(rootPath);
    const graph = createEmptyImportGraph(absoluteRoot);

    const nodeMap = new Map<string, ImportGraphNode>();
    const allEdges: ImportGraphEdge[] = [];
    const errors: ImportGraphError[] = [];

    // Parse all files and extract imports
    let filesProcessed = 0;
    const totalFiles = files.length;

    for (const filePath of files) {
      // Report progress
      this.reportProgress(opts, {
        phase: 'parsing',
        currentFile: filePath,
        filesProcessed,
        totalFiles,
        percentComplete: Math.round((filesProcessed / totalFiles) * 50)
      });

      try {
        const result = await this.processFile(filePath, absoluteRoot, opts, tsConfig);

        // Add/update node
        if (!nodeMap.has(result.node.id)) {
          nodeMap.set(result.node.id, result.node);
        }

        // Add edges
        allEdges.push(...result.edges);

        // Add target nodes for resolved imports
        for (const edge of result.edges) {
          if (!nodeMap.has(edge.target)) {
            const targetNode = this.createNodeForTarget(edge.target, absoluteRoot, opts);
            nodeMap.set(edge.target, targetNode);
          }
        }
      } catch (error) {
        if (opts.continueOnError) {
          errors.push({
            file: filePath,
            message: error instanceof Error ? error.message : String(error),
            type: 'parse',
            cause: error instanceof Error ? error : undefined
          });
        } else {
          throw error;
        }
      }

      filesProcessed++;
    }

    // Report progress: resolving
    this.reportProgress(opts, {
      phase: 'resolving',
      filesProcessed: totalFiles,
      totalFiles,
      percentComplete: 75
    });

    // Update node counts based on edges
    this.updateNodeCounts(nodeMap, allEdges);

    // Report progress: analyzing
    this.reportProgress(opts, {
      phase: 'analyzing',
      filesProcessed: totalFiles,
      totalFiles,
      percentComplete: 90
    });

    // Build final graph
    graph.nodes = Array.from(nodeMap.values());
    graph.edges = allEdges;
    graph.errors = errors;
    graph.stats = this.calculateStats(graph);

    // Report progress: complete
    this.reportProgress(opts, {
      phase: 'complete',
      filesProcessed: totalFiles,
      totalFiles,
      percentComplete: 100
    });

    return graph;
  }

  /**
   * Update an existing graph with changes
   *
   * @param graph - Existing graph to update
   * @param changedFiles - Files that have changed
   * @param options - Build options
   * @returns Updated import graph
   */
  public async updateGraph(
    graph: ImportGraph,
    changedFiles: string[],
    options: ImportGraphBuilderOptions = {}
  ): Promise<ImportGraph> {
    const opts = this.resolveOptions(options);

    // Remove old edges from changed files
    const changedSet = new Set(changedFiles.map(f => path.resolve(f)));
    const newEdges = graph.edges.filter(edge => !changedSet.has(edge.source));

    // Re-process changed files
    for (const filePath of changedFiles) {
      try {
        const result = await this.processFile(filePath, graph.rootPath, opts);
        newEdges.push(...result.edges);
      } catch (error) {
        if (!opts.continueOnError) {
          throw error;
        }
        graph.errors.push({
          file: filePath,
          message: error instanceof Error ? error.message : String(error),
          type: 'parse'
        });
      }
    }

    graph.edges = newEdges;

    // Recalculate node counts
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
    this.updateNodeCounts(nodeMap, newEdges);
    graph.nodes = Array.from(nodeMap.values());

    // Recalculate stats
    graph.stats = this.calculateStats(graph);
    graph.createdAt = new Date();

    return graph;
  }

  // ==========================================================================
  // Public API - Analysis
  // ==========================================================================

  /**
   * Find circular dependencies in the graph using Tarjan's algorithm
   *
   * @param graph - The import graph to analyze
   * @returns Array of circular dependency cycles
   *
   * @example
   * ```typescript
   * const circular = builder.findCircularDependencies(graph);
   * // Returns: [['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts']]
   * ```
   */
  public findCircularDependencies(graph: ImportGraph): CircularDependency[] {
    const adjacency = this.buildAdjacencyList(graph);
    const cycles: CircularDependency[] = [];

    // Track visited nodes and recursion stack
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const parent = new Map<string, string>();

    const dfs = (node: string, pathStack: string[]): void => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = adjacency.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          parent.set(neighbor, node);
          dfs(neighbor, [...pathStack, neighbor]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle - extract it
          const cycleStart = pathStack.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cycle = [...pathStack.slice(cycleStart), neighbor];
            cycles.push({ cycle, length: cycle.length - 1 });
          }
        }
      }

      recursionStack.delete(node);
    };

    // Run DFS from each node
    for (const node of graph.nodes) {
      if (!visited.has(node.id) && !node.isExternal) {
        dfs(node.id, [node.id]);
      }
    }

    // Remove duplicate cycles
    const uniqueCycles = this.deduplicateCycles(cycles);

    return uniqueCycles;
  }

  /**
   * Get files impacted by changes to a specific file
   *
   * @param graph - The import graph
   * @param filePath - The changed file path
   * @param options - Analysis options
   * @returns List of impacted file paths (files that depend on the changed file)
   *
   * @example
   * ```typescript
   * const impacted = builder.getImpactedFiles(graph, 'src/utils.ts');
   * // Returns: ['src/app.ts', 'src/components/Header.tsx', ...]
   * ```
   */
  public getImpactedFiles(
    graph: ImportGraph,
    filePath: string,
    options: ImpactAnalysisOptions = {}
  ): string[] {
    const { maxDepth = Infinity, includeTransitive = true, includeExternal = false } = options;

    // Build reverse adjacency list (who imports what)
    const reverseAdjacency = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (!reverseAdjacency.has(edge.target)) {
        reverseAdjacency.set(edge.target, []);
      }
      reverseAdjacency.get(edge.target)!.push(edge.source);
    }

    const normalizedPath = this.normalizePath(filePath, graph.rootPath);
    const impacted = new Set<string>();
    const queue: Array<{ path: string; depth: number }> = [{ path: normalizedPath, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { path: currentPath, depth } = queue.shift()!;

      if (visited.has(currentPath)) continue;
      visited.add(currentPath);

      if (depth > 0) {
        impacted.add(currentPath);
      }

      if (includeTransitive && depth < maxDepth) {
        const importers = reverseAdjacency.get(currentPath) || [];
        for (const importer of importers) {
          const node = graph.nodes.find(n => n.id === importer);
          if (!node?.isExternal || includeExternal) {
            queue.push({ path: importer, depth: depth + 1 });
          }
        }
      }
    }

    return Array.from(impacted);
  }

  /**
   * Get the dependency chain from one file to another
   *
   * @param graph - The import graph
   * @param from - Source file path
   * @param to - Target file path
   * @returns Array of paths representing the dependency chain, or null if no path
   *
   * @example
   * ```typescript
   * const chain = builder.getDependencyPath(graph, 'src/app.ts', 'src/utils/deep.ts');
   * // Returns: ['src/app.ts', 'src/helpers/index.ts', 'src/utils/deep.ts']
   * ```
   */
  public getDependencyPath(
    graph: ImportGraph,
    from: string,
    to: string
  ): string[] | null {
    const adjacency = this.buildAdjacencyList(graph);
    const normalizedFrom = this.normalizePath(from, graph.rootPath);
    const normalizedTo = this.normalizePath(to, graph.rootPath);

    // BFS to find shortest path
    const queue: string[][] = [[normalizedFrom]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const current = currentPath[currentPath.length - 1];

      if (current === normalizedTo) {
        return currentPath;
      }

      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = adjacency.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push([...currentPath, neighbor]);
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // Public API - Export
  // ==========================================================================

  /**
   * Export graph to DOT format for visualization with Graphviz
   *
   * @param graph - The import graph
   * @param options - Export options
   * @returns DOT format string
   *
   * @example
   * ```typescript
   * const dot = builder.exportToDot(graph, { cluster: true });
   * // Save to file and run: dot -Tpng graph.dot -o graph.png
   * ```
   */
  public exportToDot(graph: ImportGraph, options: DotExportOptions = {}): string {
    const {
      includeExternal = false,
      cluster = false,
      maxNodes = 500,
      title = 'Import Graph'
    } = options;

    const lines: string[] = [
      'digraph ImportGraph {',
      `  label="${title}";`,
      '  rankdir=LR;',
      '  node [shape=box, style=filled, fillcolor=lightblue];'
    ];

    // Filter nodes
    let nodes = graph.nodes;
    if (!includeExternal) {
      nodes = nodes.filter(n => !n.isExternal);
    }
    if (nodes.length > maxNodes) {
      // Keep most important nodes
      nodes = nodes
        .sort((a, b) => b.importerCount - a.importerCount)
        .slice(0, maxNodes);
    }

    const nodeSet = new Set(nodes.map(n => n.id));

    if (cluster) {
      // Group by directory
      const dirGroups = new Map<string, ImportGraphNode[]>();
      for (const node of nodes) {
        const dir = path.dirname(node.path);
        if (!dirGroups.has(dir)) {
          dirGroups.set(dir, []);
        }
        dirGroups.get(dir)!.push(node);
      }

      let clusterId = 0;
      for (const [dir, dirNodes] of dirGroups) {
        lines.push(`  subgraph cluster_${clusterId++} {`);
        lines.push(`    label="${dir}";`);
        for (const node of dirNodes) {
          const label = path.basename(node.path);
          const color = node.isExternal ? 'lightgray' : 'lightblue';
          lines.push(`    "${node.id}" [label="${label}", fillcolor=${color}];`);
        }
        lines.push('  }');
      }
    } else {
      // Add nodes
      for (const node of nodes) {
        const label = node.path;
        const color = node.isExternal ? 'lightgray' : 'lightblue';
        lines.push(`  "${node.id}" [label="${label}", fillcolor=${color}];`);
      }
    }

    // Add edges
    for (const edge of graph.edges) {
      if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
        const style = edge.isDynamic ? 'dashed' : 'solid';
        const color = edge.isTypeOnly ? 'gray' : 'black';
        lines.push(`  "${edge.source}" -> "${edge.target}" [style=${style}, color=${color}];`);
      }
    }

    lines.push('}');

    return lines.join('\n');
  }

  // ==========================================================================
  // Private Methods - File Processing
  // ==========================================================================

  /**
   * Process a single file and extract imports
   */
  private async processFile(
    filePath: string,
    rootPath: string,
    options: ResolvedOptions,
    tsConfig?: ParsedTsConfig
  ): Promise<{ node: ImportGraphNode; edges: ImportGraphEdge[] }> {
    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(rootPath, absolutePath);
    const extension = path.extname(absolutePath);
    const language = getLanguageForExtension(extension);

    // Create node
    const node: ImportGraphNode = {
      id: absolutePath,
      path: relativePath,
      extension,
      language: language || 'unknown',
      importCount: 0,
      importerCount: 0,
      isExternal: false,
      isUnresolved: false
    };

    // Parse file and extract imports
    const sourceCode = await fs.readFile(absolutePath, 'utf-8');
    const imports = await this.extractImports(sourceCode, absolutePath, language);

    // Resolve imports to edges
    const edges: ImportGraphEdge[] = [];
    for (const imp of imports) {
      // Skip dynamic imports if not requested
      if (imp.isDynamic && !options.includeDynamicImports) {
        continue;
      }

      const resolvedTarget = await this.resolveImportPath(
        imp.specifier,
        absolutePath,
        rootPath,
        options,
        tsConfig
      );

      edges.push({
        source: absolutePath,
        target: resolvedTarget || `unresolved:${imp.specifier}`,
        specifier: imp.specifier,
        importType: imp.importType,
        importedSymbols: imp.importedSymbols,
        isTypeOnly: imp.isTypeOnly,
        isDynamic: imp.isDynamic,
        line: imp.line,
        column: imp.column
      });
    }

    node.importCount = edges.length;

    return { node, edges };
  }

  /**
   * Extract imports from source code using tree-sitter
   */
  private async extractImports(
    sourceCode: string,
    filePath: string,
    language: SupportedLanguage | null
  ): Promise<ExtractedImport[]> {
    if (!language) {
      return [];
    }

    const imports: ExtractedImport[] = [];

    try {
      const parseResult = await this.parser.parse(sourceCode, language);
      this.visitNode(parseResult.rootNode, imports);
    } catch {
      // Parsing failed, return empty imports
    }

    return imports;
  }

  /**
   * Recursively visit AST nodes to extract imports
   */
  private visitNode(node: SyntaxNode, imports: ExtractedImport[]): void {
    switch (node.type) {
      case ES6_IMPORT_TYPES.IMPORT_STATEMENT:
        this.extractES6Import(node, imports);
        break;

      case ES6_IMPORT_TYPES.EXPORT_STATEMENT:
        this.extractReexport(node, imports);
        break;

      case ES6_IMPORT_TYPES.CALL_EXPRESSION:
        this.extractCallExpression(node, imports);
        break;
    }

    // Recursively visit children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.visitNode(child, imports);
      }
    }
  }

  /**
   * Extract ES6 import statement
   */
  private extractES6Import(node: SyntaxNode, imports: ExtractedImport[]): void {
    // Get the source string
    const sourceNode = this.findChildByType(node, 'string') ||
                       this.findChildByType(node, 'string_fragment');
    if (!sourceNode) return;

    const specifier = this.getStringValue(sourceNode);
    if (!specifier) return;

    // Check for type-only import
    const isTypeOnly = this.hasChild(node, 'type') ||
                       node.text.startsWith('import type');

    // Determine import type and symbols
    const importClause = this.findChildByType(node, 'import_clause');

    if (!importClause) {
      // Side-effect import: import 'module'
      imports.push({
        specifier,
        importType: 'es6-side-effect',
        importedSymbols: [],
        isTypeOnly,
        isDynamic: false,
        line: node.startPosition.row + 1,
        column: node.startPosition.column
      });
      return;
    }

    // Check for default import
    const defaultImport = this.findChildByType(importClause, 'identifier');
    if (defaultImport) {
      imports.push({
        specifier,
        importType: 'es6-default',
        importedSymbols: [defaultImport.text],
        isTypeOnly,
        isDynamic: false,
        line: node.startPosition.row + 1,
        column: node.startPosition.column
      });
    }

    // Check for namespace import
    const namespaceImport = this.findChildByType(importClause, 'namespace_import');
    if (namespaceImport) {
      const alias = this.findChildByType(namespaceImport, 'identifier');
      imports.push({
        specifier,
        importType: 'es6-namespace',
        importedSymbols: alias ? [alias.text] : [],
        isTypeOnly,
        isDynamic: false,
        line: node.startPosition.row + 1,
        column: node.startPosition.column
      });
    }

    // Check for named imports
    const namedImports = this.findChildByType(importClause, 'named_imports');
    if (namedImports) {
      const symbols: string[] = [];
      for (let i = 0; i < namedImports.childCount; i++) {
        const child = namedImports.child(i);
        if (child?.type === 'import_specifier') {
          const name = this.findChildByType(child, 'identifier');
          if (name) {
            symbols.push(name.text);
          }
        }
      }
      if (symbols.length > 0) {
        imports.push({
          specifier,
          importType: 'es6-named',
          importedSymbols: symbols,
          isTypeOnly,
          isDynamic: false,
          line: node.startPosition.row + 1,
          column: node.startPosition.column
        });
      }
    }
  }

  /**
   * Extract re-export statement
   */
  private extractReexport(node: SyntaxNode, imports: ExtractedImport[]): void {
    // Check if this is a re-export (has 'from' clause)
    if (!node.text.includes('from')) return;

    const sourceNode = this.findChildByType(node, 'string') ||
                       this.findChildByType(node, 'string_fragment');
    if (!sourceNode) return;

    const specifier = this.getStringValue(sourceNode);
    if (!specifier) return;

    // Check for export *
    if (node.text.includes('*')) {
      imports.push({
        specifier,
        importType: 'reexport-all',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: node.startPosition.row + 1,
        column: node.startPosition.column
      });
      return;
    }

    // Named re-export
    const exportClause = this.findChildByType(node, 'export_clause');
    if (exportClause) {
      const symbols: string[] = [];
      for (let i = 0; i < exportClause.childCount; i++) {
        const child = exportClause.child(i);
        if (child?.type === 'export_specifier') {
          const name = this.findChildByType(child, 'identifier');
          if (name) {
            symbols.push(name.text);
          }
        }
      }
      imports.push({
        specifier,
        importType: 'reexport',
        importedSymbols: symbols,
        isTypeOnly: false,
        isDynamic: false,
        line: node.startPosition.row + 1,
        column: node.startPosition.column
      });
    }
  }

  /**
   * Extract require() and dynamic import() calls
   */
  private extractCallExpression(node: SyntaxNode, imports: ExtractedImport[]): void {
    const callee = node.childForFieldName('function') ||
                   this.findChildByType(node, 'identifier') ||
                   this.findChildByType(node, 'import');

    if (!callee) return;

    const calleeName = callee.text;

    // Dynamic import
    if (calleeName === 'import' || callee.type === 'import') {
      const args = node.childForFieldName('arguments') ||
                   this.findChildByType(node, 'arguments');
      if (args) {
        const stringNode = this.findChildByType(args, 'string') ||
                          this.findChildByType(args, 'string_fragment');
        if (stringNode) {
          const specifier = this.getStringValue(stringNode);
          if (specifier) {
            imports.push({
              specifier,
              importType: 'dynamic-import',
              importedSymbols: [],
              isTypeOnly: false,
              isDynamic: true,
              line: node.startPosition.row + 1,
              column: node.startPosition.column
            });
          }
        }
      }
      return;
    }

    // CommonJS require
    if (calleeName === 'require') {
      const args = node.childForFieldName('arguments') ||
                   this.findChildByType(node, 'arguments');
      if (args) {
        const stringNode = this.findChildByType(args, 'string') ||
                          this.findChildByType(args, 'string_fragment');
        if (stringNode) {
          const specifier = this.getStringValue(stringNode);
          if (specifier) {
            imports.push({
              specifier,
              importType: 'commonjs-require',
              importedSymbols: [],
              isTypeOnly: false,
              isDynamic: false,
              line: node.startPosition.row + 1,
              column: node.startPosition.column
            });
          }
        }
      }
    }
  }

  // ==========================================================================
  // Private Methods - Path Resolution
  // ==========================================================================

  /**
   * Resolve an import specifier to an absolute file path
   */
  private async resolveImportPath(
    specifier: string,
    fromFile: string,
    rootPath: string,
    options: ResolvedOptions,
    tsConfig?: ParsedTsConfig
  ): Promise<string | null> {
    // External package (doesn't start with . or /)
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
      // Try TypeScript path aliases first
      if (tsConfig || options.pathAliases) {
        const aliasResolved = await this.resolveWithPathAliases(
          specifier,
          fromFile,
          rootPath,
          tsConfig,
          options
        );
        if (aliasResolved) {
          return aliasResolved;
        }
      }

      // External package
      if (options.resolveExternal) {
        return this.resolveExternalPackage(specifier, fromFile, rootPath);
      }

      return `external:${specifier}`;
    }

    // Relative or absolute path
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, specifier);

    // Try various extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', ''];
    const indexFiles = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (await this.fileExists(withExt)) {
        return withExt;
      }
    }

    // Try as directory with index file
    for (const indexFile of indexFiles) {
      const indexPath = path.join(resolved, indexFile);
      if (await this.fileExists(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Resolve using TypeScript path aliases
   */
  private async resolveWithPathAliases(
    specifier: string,
    fromFile: string,
    rootPath: string,
    tsConfig?: ParsedTsConfig,
    options?: ResolvedOptions
  ): Promise<string | null> {
    const pathAliases = options?.pathAliases || tsConfig?.compilerOptions.paths || {};
    const baseUrl = options?.baseUrl || tsConfig?.compilerOptions.baseUrl || rootPath;

    for (const [pattern, targets] of Object.entries(pathAliases)) {
      // Convert pattern to regex
      const patternRegex = pattern.replace('*', '(.*)');
      const match = specifier.match(new RegExp(`^${patternRegex}$`));

      if (match) {
        const captured = match[1] || '';

        for (const target of targets) {
          const resolvedTarget = target.replace('*', captured);
          const absolutePath = path.resolve(rootPath, baseUrl, resolvedTarget);

          // Try various extensions
          const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', ''];
          for (const ext of extensions) {
            const withExt = absolutePath + ext;
            if (await this.fileExists(withExt)) {
              return withExt;
            }
          }

          // Try as directory
          const indexPath = path.join(absolutePath, 'index.ts');
          if (await this.fileExists(indexPath)) {
            return indexPath;
          }
        }
      }
    }

    return null;
  }

  /**
   * Resolve external package in node_modules
   */
  private async resolveExternalPackage(
    specifier: string,
    fromFile: string,
    rootPath: string
  ): Promise<string | null> {
    // Walk up the directory tree looking for node_modules
    let currentDir = path.dirname(fromFile);

    while (currentDir !== path.dirname(currentDir)) {
      const nodeModulesPath = path.join(currentDir, 'node_modules', specifier);

      // Check for package.json
      const packageJsonPath = path.join(nodeModulesPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          const mainFile = packageJson.main || 'index.js';
          return path.join(nodeModulesPath, mainFile);
        } catch {
          // Continue
        }
      }

      // Check for index file
      const indexPath = path.join(nodeModulesPath, 'index.js');
      if (await this.fileExists(indexPath)) {
        return indexPath;
      }

      currentDir = path.dirname(currentDir);
    }

    return `external:${specifier}`;
  }

  // ==========================================================================
  // Private Methods - Utilities
  // ==========================================================================

  /**
   * Resolve options with defaults
   */
  private resolveOptions(options: ImportGraphBuilderOptions): ResolvedOptions {
    return {
      ...DEFAULT_IMPORT_GRAPH_OPTIONS,
      ...options
    } as ResolvedOptions;
  }

  /**
   * Discover files to analyze
   */
  private async discoverFiles(rootPath: string, options: ResolvedOptions): Promise<string[]> {
    const patterns = options.includePatterns.map(p =>
      path.isAbsolute(p) ? p : path.join(rootPath, p)
    );

    const files = await glob(patterns, {
      ignore: options.excludePatterns.map(p =>
        path.isAbsolute(p) ? p : path.join(rootPath, p)
      ),
      nodir: true,
      absolute: true,
      followSymbolicLinks: options.followSymlinks
    });

    return files;
  }

  /**
   * Load and parse tsconfig.json
   */
  private async loadTsConfig(configPath: string, rootPath: string): Promise<ParsedTsConfig> {
    const absolutePath = path.resolve(rootPath, configPath);

    // Check cache
    if (this.tsConfigCache.has(absolutePath)) {
      return this.tsConfigCache.get(absolutePath)!;
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const config = JSON.parse(content);

    const parsed: ParsedTsConfig = {
      configPath: absolutePath,
      compilerOptions: {
        baseUrl: config.compilerOptions?.baseUrl,
        paths: config.compilerOptions?.paths,
        rootDirs: config.compilerOptions?.rootDirs
      },
      baseDir: path.dirname(absolutePath)
    };

    this.tsConfigCache.set(absolutePath, parsed);

    return parsed;
  }

  /**
   * Create a node for an import target
   */
  private createNodeForTarget(
    target: string,
    rootPath: string,
    options: ResolvedOptions
  ): ImportGraphNode {
    const isExternal = target.startsWith('external:');
    const isUnresolved = target.startsWith('unresolved:');
    const displayPath = isExternal || isUnresolved
      ? target.split(':')[1]
      : path.relative(rootPath, target);

    return {
      id: target,
      path: displayPath,
      extension: isExternal || isUnresolved ? '' : path.extname(target),
      language: isExternal || isUnresolved ? 'unknown' : (getLanguageForExtension(path.extname(target)) || 'unknown'),
      importCount: 0,
      importerCount: 0,
      isExternal,
      isUnresolved
    };
  }

  /**
   * Update node import/importer counts based on edges
   */
  private updateNodeCounts(
    nodeMap: Map<string, ImportGraphNode>,
    edges: ImportGraphEdge[]
  ): void {
    // Reset counts
    for (const node of nodeMap.values()) {
      node.importCount = 0;
      node.importerCount = 0;
    }

    // Count edges
    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (sourceNode) {
        sourceNode.importCount++;
      }
      if (targetNode) {
        targetNode.importerCount++;
      }
    }
  }

  /**
   * Calculate graph statistics
   */
  private calculateStats(graph: ImportGraph): ImportGraphStats {
    const stats: ImportGraphStats = {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      externalDependencies: 0,
      internalModules: 0,
      unresolvedImports: 0,
      circularDependencies: 0,
      mostImported: [],
      mostImporting: [],
      languageBreakdown: {}
    };

    // Count node types
    for (const node of graph.nodes) {
      if (node.isExternal) {
        stats.externalDependencies++;
      } else if (node.isUnresolved) {
        stats.unresolvedImports++;
      } else {
        stats.internalModules++;
      }

      // Language breakdown
      const lang = node.language || 'unknown';
      stats.languageBreakdown[lang] = (stats.languageBreakdown[lang] || 0) + 1;
    }

    // Find most imported/importing
    const sortedByImporters = [...graph.nodes]
      .filter(n => !n.isExternal && !n.isUnresolved)
      .sort((a, b) => b.importerCount - a.importerCount)
      .slice(0, 10);

    const sortedByImports = [...graph.nodes]
      .filter(n => !n.isExternal && !n.isUnresolved)
      .sort((a, b) => b.importCount - a.importCount)
      .slice(0, 10);

    stats.mostImported = sortedByImporters.map(n => ({
      path: n.path,
      count: n.importerCount
    }));

    stats.mostImporting = sortedByImports.map(n => ({
      path: n.path,
      count: n.importCount
    }));

    // Count circular dependencies (simplified - full analysis is expensive)
    const cycles = this.findCircularDependencies(graph);
    stats.circularDependencies = cycles.length;

    return stats;
  }

  /**
   * Build adjacency list from graph
   */
  private buildAdjacencyList(graph: ImportGraph): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();

    for (const edge of graph.edges) {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, []);
      }
      adjacency.get(edge.source)!.push(edge.target);
    }

    return adjacency;
  }

  /**
   * Remove duplicate cycles
   */
  private deduplicateCycles(cycles: CircularDependency[]): CircularDependency[] {
    const seen = new Set<string>();
    const unique: CircularDependency[] = [];

    for (const cycle of cycles) {
      // Normalize cycle by rotating to start with smallest element
      const normalized = this.normalizeCycle(cycle.cycle);
      const key = normalized.join('->');

      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ ...cycle, cycle: normalized });
      }
    }

    return unique;
  }

  /**
   * Normalize a cycle to start with the smallest element
   */
  private normalizeCycle(cycle: string[]): string[] {
    if (cycle.length <= 1) return cycle;

    // Remove the last element if it's the same as the first (closing the cycle)
    const normalized = cycle[cycle.length - 1] === cycle[0]
      ? cycle.slice(0, -1)
      : cycle;

    // Find the smallest element
    const minIndex = normalized.reduce((minIdx, path, idx) =>
      path < normalized[minIdx] ? idx : minIdx, 0);

    // Rotate to start with smallest
    const rotated = [...normalized.slice(minIndex), ...normalized.slice(0, minIndex)];

    // Add closing element
    rotated.push(rotated[0]);

    return rotated;
  }

  /**
   * Normalize a file path relative to root
   */
  private normalizePath(filePath: string, rootPath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(rootPath, filePath);
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Report progress if callback is provided
   */
  private reportProgress(options: ResolvedOptions, progress: ImportGraphProgress): void {
    if (options.onProgress) {
      options.onProgress(progress);
    }
  }

  /**
   * Find child node by type
   */
  private findChildByType(node: SyntaxNode, type: string): SyntaxNode | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === type) {
        return child;
      }
      // Also check grandchildren for nested structures
      if (child) {
        for (let j = 0; j < child.childCount; j++) {
          const grandchild = child.child(j);
          if (grandchild?.type === type) {
            return grandchild;
          }
        }
      }
    }
    return null;
  }

  /**
   * Check if node has a child of given type
   */
  private hasChild(node: SyntaxNode, type: string): boolean {
    return this.findChildByType(node, type) !== null;
  }

  /**
   * Get string value from a string node
   */
  private getStringValue(node: SyntaxNode): string | null {
    const text = node.text;

    // Handle different string formats
    if (text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    if (text.startsWith("'") && text.endsWith("'")) {
      return text.slice(1, -1);
    }
    if (text.startsWith('`') && text.endsWith('`')) {
      return text.slice(1, -1);
    }

    // Return as-is if no quotes
    return text;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the singleton instance of ImportGraphBuilder
 *
 * @returns The ImportGraphBuilder singleton instance
 */
export function getImportGraphBuilder(): ImportGraphBuilder {
  return ImportGraphBuilder.getInstance();
}
