/**
 * SymbolResolver - Definition lookup and reference tracking
 *
 * Provides efficient symbol resolution across a RepositoryMap by building
 * internal indexes for fast lookup operations.
 *
 * @example
 * ```typescript
 * const indexer = CodebaseIndexer.getInstance();
 * const repoMap = await indexer.indexDirectory('/path/to/project');
 * const resolver = new SymbolResolver(repoMap);
 *
 * // Find definition
 * const definitions = resolver.findDefinition('MyClass');
 * console.log(definitions[0].symbol.filePath); // 'src/models/MyClass.ts'
 *
 * // Find references
 * const refs = resolver.findReferences('MyClass');
 * console.log(`Found ${refs.length} usages of MyClass`);
 * ```
 */

import type {
  RepositoryMap,
  CodeFile,
  CodeSymbol,
  SymbolReference,
  SymbolType,
} from '@apexcli/core';

/**
 * Options for finding symbols
 */
export interface FindOptions {
  /** Filter by file path pattern (glob-like matching) */
  filePath?: string;

  /** Filter by symbol type (function, class, interface, etc.) */
  symbolType?: SymbolType | SymbolType[];

  /** Filter by exported symbols only */
  exportedOnly?: boolean;

  /** Include private/internal symbols */
  includePrivate?: boolean;

  /** Maximum number of results to return */
  limit?: number;

  /** Case-sensitive search (default: true) */
  caseSensitive?: boolean;

  /** Exact match only (default: false - allows partial matches) */
  exactMatch?: boolean;
}

/**
 * Result of a definition lookup
 */
export interface SymbolDefinition {
  /** The found symbol */
  symbol: CodeSymbol;

  /** File containing the definition */
  file: CodeFile;

  /** Full file path relative to repository root */
  filePath: string;

  /** Match confidence (1.0 = exact match) */
  confidence: number;

  /** Whether this is a re-export from another file */
  isReExport: boolean;

  /** Original definition if this is a re-export */
  originalDefinition?: SymbolDefinition;
}

/**
 * Result of a reference lookup
 */
export interface SymbolReferenceResult {
  /** The reference information */
  reference: SymbolReference;

  /** File containing the reference */
  sourceFile: CodeFile;

  /** Definition this reference points to (if resolved) */
  definition?: SymbolDefinition;

  /** Context around the reference (surrounding code) */
  context?: string;
}

/**
 * Statistics about symbol resolution
 */
export interface ResolutionStats {
  /** Total symbols indexed */
  totalSymbols: number;

  /** Total unique symbol names */
  uniqueNames: number;

  /** Symbols by type count */
  byType: Record<SymbolType, number>;

  /** Files with symbols */
  filesWithSymbols: number;

  /** Index build time in ms */
  indexBuildTimeMs: number;
}

/**
 * SymbolResolver - Definition lookup and reference tracking
 *
 * Provides efficient symbol resolution across a RepositoryMap by building
 * internal indexes for fast lookup operations.
 */
export class SymbolResolver {
  /** The repository map to search */
  private readonly repoMap: RepositoryMap;

  /** Index of symbols by name for fast lookup */
  private readonly symbolIndex: Map<string, SymbolDefinition[]>;

  /** Index of symbols by file path */
  private readonly fileIndex: Map<string, CodeSymbol[]>;

  /** Index of exports by file path */
  private readonly exportIndex: Map<string, Map<string, CodeSymbol>>;

  /** Case-insensitive name to canonical names mapping */
  private readonly nameIndex: Map<string, Set<string>>;

  /** Resolution statistics */
  private readonly stats: ResolutionStats;

  /**
   * Create a new SymbolResolver
   *
   * @param repoMap - The repository map to resolve symbols in
   */
  constructor(repoMap: RepositoryMap) {
    this.repoMap = repoMap;
    this.symbolIndex = new Map();
    this.fileIndex = new Map();
    this.exportIndex = new Map();
    this.nameIndex = new Map();

    const startTime = Date.now();
    this.buildIndexes();
    const indexBuildTimeMs = Date.now() - startTime;

    this.stats = {
      totalSymbols: this.getTotalSymbolCount(),
      uniqueNames: this.symbolIndex.size,
      byType: this.getSymbolTypeBreakdown(),
      filesWithSymbols: this.fileIndex.size,
      indexBuildTimeMs,
    };
  }

  /**
   * Find definition(s) of a symbol by name
   *
   * @param symbolName - Name of the symbol to find
   * @param options - Optional search options
   * @returns Array of matching symbol definitions, sorted by relevance
   */
  findDefinition(symbolName: string, options: FindOptions = {}): SymbolDefinition[] {
    const {
      filePath,
      symbolType,
      exportedOnly = false,
      includePrivate = true,
      limit,
      caseSensitive = true,
      exactMatch = false,
    } = options;

    const candidateNames = this.getCandidateNames(symbolName, caseSensitive, exactMatch);
    const allResults: SymbolDefinition[] = [];

    for (const candidateName of candidateNames) {
      const definitions = this.symbolIndex.get(candidateName) || [];
      allResults.push(...definitions);
    }

    // Apply filters
    let filteredResults = allResults.filter((def) => {
      // Filter by file path
      if (filePath && !this.matchesFilePath(def.filePath, filePath)) {
        return false;
      }

      // Filter by symbol type
      if (symbolType) {
        const types = Array.isArray(symbolType) ? symbolType : [symbolType];
        if (!types.includes(def.symbol.type)) {
          return false;
        }
      }

      // Filter by exported status
      if (exportedOnly && !def.symbol.exported) {
        return false;
      }

      // Filter by private/internal status
      if (!includePrivate && this.isPrivateSymbol(def.symbol)) {
        return false;
      }

      return true;
    });

    // Update confidence scores based on match quality
    filteredResults = filteredResults.map((def) => ({
      ...def,
      confidence: this.calculateConfidence(symbolName, def, options),
    }));

    // Sort by confidence (descending)
    filteredResults.sort((a, b) => b.confidence - a.confidence);

    // Apply limit
    if (limit && limit > 0) {
      filteredResults = filteredResults.slice(0, limit);
    }

    return filteredResults;
  }

  /**
   * Find all references to a symbol
   *
   * @param symbolName - Name of the symbol to find references for
   * @param options - Optional search options
   * @returns Array of references to the symbol
   */
  findReferences(symbolName: string, options: FindOptions = {}): SymbolReferenceResult[] {
    // First find the definitions to know what we're looking for
    const definitions = this.findDefinition(symbolName, options);
    if (definitions.length === 0) {
      return [];
    }

    const {
      filePath,
      limit,
    } = options;

    const results: SymbolReferenceResult[] = [];

    // Search through all references in the repository map
    for (const reference of this.repoMap.references || []) {
      // Check if this reference matches our symbol name
      if (reference.symbolName !== symbolName) {
        continue;
      }

      // Filter by file path if specified
      if (filePath && !this.matchesFilePath(reference.sourceFile, filePath)) {
        continue;
      }

      // Find the source file
      const sourceFile = this.findFileByPath(reference.sourceFile);
      if (!sourceFile) {
        continue;
      }

      // Try to resolve which definition this reference points to
      const definition = this.resolveReferenceToDefinition(reference, definitions);

      results.push({
        reference,
        sourceFile,
        definition,
        // Context can be added later if needed
        context: undefined,
      });
    }

    // Also check imports for symbol usage
    for (const file of this.repoMap.files || []) {
      if (filePath && !this.matchesFilePath(file.path, filePath)) {
        continue;
      }

      for (const importEdge of file.imports || []) {
        if (importEdge.importedSymbols?.includes(symbolName)) {
          // Create a synthetic reference for the import
          const syntheticReference: SymbolReference = {
            symbolName,
            sourceFile: file.path,
            sourceLine: 1, // Imports are typically at the top
            sourceColumn: 0,
            targetFile: importEdge.targetFile,
            referenceType: 'import',
          };

          const definition = this.resolveReferenceToDefinition(syntheticReference, definitions);

          results.push({
            reference: syntheticReference,
            sourceFile: file,
            definition,
            context: undefined,
          });
        }
      }
    }

    // Apply limit
    if (limit && limit > 0) {
      return results.slice(0, limit);
    }

    return results;
  }

  /**
   * Find symbol at a specific location
   *
   * @param filePath - Path to the file
   * @param line - Line number (1-based)
   * @param column - Column number (0-based, optional)
   * @returns Symbol at the location, or undefined
   */
  findSymbolAtLocation(filePath: string, line: number, column?: number): CodeSymbol | undefined {
    const symbols = this.fileIndex.get(filePath);
    if (!symbols) {
      return undefined;
    }

    // Find symbols that contain the given line
    for (const symbol of symbols) {
      if (line >= symbol.startLine && line <= symbol.endLine) {
        // If column is specified, check if it's within the symbol bounds
        if (column !== undefined) {
          if (line === symbol.startLine && column < (symbol.startColumn || 0)) {
            continue;
          }
          if (line === symbol.endLine && column > (symbol.endColumn || Number.MAX_SAFE_INTEGER)) {
            continue;
          }
        }
        return symbol;
      }
    }

    return undefined;
  }

  /**
   * Get all symbols in a file
   *
   * @param filePath - Path to the file
   * @returns Array of symbols in the file
   */
  getFileSymbols(filePath: string): CodeSymbol[] {
    return this.fileIndex.get(filePath) || [];
  }

  /**
   * Get exported symbols from a file
   *
   * @param filePath - Path to the file
   * @returns Map of exported symbol names to symbols
   */
  getFileExports(filePath: string): Map<string, CodeSymbol> {
    return this.exportIndex.get(filePath) || new Map();
  }

  /**
   * Get resolution statistics
   */
  getStats(): ResolutionStats {
    return { ...this.stats };
  }

  /**
   * Check if a symbol exists
   *
   * @param symbolName - Name to check
   * @param options - Optional search options
   */
  hasSymbol(symbolName: string, options: FindOptions = {}): boolean {
    return this.findDefinition(symbolName, { ...options, limit: 1 }).length > 0;
  }

  /**
   * Rebuild internal indexes
   * Call this if the underlying RepositoryMap has been modified
   */
  rebuildIndex(): void {
    this.symbolIndex.clear();
    this.fileIndex.clear();
    this.exportIndex.clear();
    this.nameIndex.clear();

    const startTime = Date.now();
    this.buildIndexes();
    const indexBuildTimeMs = Date.now() - startTime;

    // Update stats
    Object.assign(this.stats, {
      totalSymbols: this.getTotalSymbolCount(),
      uniqueNames: this.symbolIndex.size,
      byType: this.getSymbolTypeBreakdown(),
      filesWithSymbols: this.fileIndex.size,
      indexBuildTimeMs,
    });
  }

  // Private helper methods

  /**
   * Build all internal indexes from the repository map
   */
  private buildIndexes(): void {
    for (const file of this.repoMap.files || []) {
      const fileSymbols: CodeSymbol[] = [];
      const fileExports = new Map<string, CodeSymbol>();

      for (const symbol of file.symbols || []) {
        fileSymbols.push(symbol);

        // Add to symbol index
        const definitions = this.symbolIndex.get(symbol.name) || [];
        const symbolDef: SymbolDefinition = {
          symbol,
          file,
          filePath: symbol.filePath,
          confidence: 1.0,
          isReExport: false,
        };
        definitions.push(symbolDef);
        this.symbolIndex.set(symbol.name, definitions);

        // Add to name index for case-insensitive search
        const lowerName = symbol.name.toLowerCase();
        const nameSet = this.nameIndex.get(lowerName) || new Set();
        nameSet.add(symbol.name);
        this.nameIndex.set(lowerName, nameSet);

        // Add to exports if exported
        if (symbol.exported) {
          fileExports.set(symbol.name, symbol);
        }
      }

      // Store file-level indexes
      if (fileSymbols.length > 0) {
        this.fileIndex.set(file.path, fileSymbols);
      }
      if (fileExports.size > 0) {
        this.exportIndex.set(file.path, fileExports);
      }

      // Process re-exports
      for (const exportInfo of file.exports || []) {
        if (exportInfo.fromFile) {
          // This is a re-export
          const originalSymbol = this.findSymbolInFile(exportInfo.fromFile, exportInfo.originalName || exportInfo.name);
          if (originalSymbol) {
            const reExportDef: SymbolDefinition = {
              symbol: originalSymbol,
              file,
              filePath: file.path,
              confidence: 1.0,
              isReExport: true,
              originalDefinition: {
                symbol: originalSymbol,
                file: this.findFileByPath(exportInfo.fromFile)!,
                filePath: exportInfo.fromFile,
                confidence: 1.0,
                isReExport: false,
              },
            };

            const definitions = this.symbolIndex.get(exportInfo.name) || [];
            definitions.push(reExportDef);
            this.symbolIndex.set(exportInfo.name, definitions);

            fileExports.set(exportInfo.name, originalSymbol);
          }
        }
      }
    }
  }

  /**
   * Get candidate symbol names based on search options
   */
  private getCandidateNames(symbolName: string, caseSensitive: boolean, exactMatch: boolean): string[] {
    if (exactMatch && caseSensitive) {
      return [symbolName];
    }

    const candidates = new Set<string>();

    if (exactMatch && !caseSensitive) {
      // Case-insensitive exact match
      const lowerName = symbolName.toLowerCase();
      const nameSet = this.nameIndex.get(lowerName);
      if (nameSet) {
        nameSet.forEach(name => candidates.add(name));
      }
    } else if (!exactMatch) {
      // Partial match
      for (const [indexedName, _] of this.symbolIndex) {
        const matches = caseSensitive
          ? indexedName.includes(symbolName)
          : indexedName.toLowerCase().includes(symbolName.toLowerCase());

        if (matches) {
          candidates.add(indexedName);
        }
      }
    } else {
      // Exact match, case-sensitive (default case)
      candidates.add(symbolName);
    }

    return Array.from(candidates);
  }

  /**
   * Check if a file path matches a pattern
   */
  private matchesFilePath(filePath: string, pattern: string): boolean {
    // Simple glob-like matching - could be enhanced with minimatch library
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  }

  /**
   * Check if a symbol is private/internal
   */
  private isPrivateSymbol(symbol: CodeSymbol): boolean {
    // Simple heuristics for private symbols
    return symbol.name.startsWith('_') || symbol.name.startsWith('#');
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(searchName: string, definition: SymbolDefinition, options: FindOptions): number {
    let confidence = 0;

    // Exact name match
    if (definition.symbol.name === searchName) {
      confidence += 1.0;
    }
    // Case-insensitive match
    else if (definition.symbol.name.toLowerCase() === searchName.toLowerCase()) {
      confidence += 0.8;
    }
    // Partial match
    else if (definition.symbol.name.toLowerCase().includes(searchName.toLowerCase())) {
      confidence += 0.5;
    }

    // Exported symbol bonus
    if (definition.symbol.exported) {
      confidence += 0.2;
    }

    // File path match bonus
    if (options.filePath && this.matchesFilePath(definition.filePath, options.filePath)) {
      confidence += 0.3;
    }

    // Type match bonus
    if (options.symbolType) {
      const types = Array.isArray(options.symbolType) ? options.symbolType : [options.symbolType];
      if (types.includes(definition.symbol.type)) {
        confidence += 0.2;
      }
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Resolve which definition a reference points to
   */
  private resolveReferenceToDefinition(
    reference: SymbolReference,
    definitions: SymbolDefinition[]
  ): SymbolDefinition | undefined {
    // If the reference has a target file, try to find a definition in that file
    if (reference.targetFile) {
      for (const def of definitions) {
        if (def.filePath === reference.targetFile) {
          return def;
        }
      }
    }

    // Otherwise, return the most confident definition
    return definitions.length > 0 ? definitions[0] : undefined;
  }

  /**
   * Find a file by its path
   */
  private findFileByPath(filePath: string): CodeFile | undefined {
    return this.repoMap.files?.find((file: CodeFile) => file.path === filePath);
  }

  /**
   * Find a symbol in a specific file
   */
  private findSymbolInFile(filePath: string, symbolName: string): CodeSymbol | undefined {
    const file = this.findFileByPath(filePath);
    if (!file) {
      return undefined;
    }

    return file.symbols?.find((symbol: CodeSymbol) => symbol.name === symbolName);
  }

  /**
   * Get total symbol count across all files
   */
  private getTotalSymbolCount(): number {
    return Array.from(this.fileIndex.values()).reduce((total, symbols) => total + symbols.length, 0);
  }

  /**
   * Get breakdown of symbols by type
   */
  private getSymbolTypeBreakdown(): Record<SymbolType, number> {
    const breakdown: Partial<Record<SymbolType, number>> = {};

    for (const symbols of this.fileIndex.values()) {
      for (const symbol of symbols) {
        breakdown[symbol.type] = (breakdown[symbol.type] || 0) + 1;
      }
    }

    return breakdown as Record<SymbolType, number>;
  }
}