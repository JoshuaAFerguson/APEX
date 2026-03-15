import { RepositoryMap, CodeSymbol, SymbolReference } from './types';

/**
 * Result of a symbol definition lookup
 */
export interface SymbolDefinition {
  /** The symbol that was found */
  symbol: CodeSymbol;
  /** The file where the symbol is defined */
  filePath: string;
  /** The line where the symbol is defined */
  line: number;
  /** The column where the symbol is defined (if available) */
  column?: number;
}

/**
 * Result of a symbol reference lookup
 */
export interface SymbolReferencesResult {
  /** The symbol that references were found for */
  symbol: CodeSymbol;
  /** All references to this symbol */
  references: Array<{
    /** The reference information */
    reference: SymbolReference;
    /** The file where the reference occurs */
    filePath: string;
    /** The line where the reference occurs */
    line: number;
    /** The column where the reference occurs (if available) */
    column?: number;
  }>;
}

/**
 * SymbolResolver provides functionality for definition lookup and reference tracking
 * across a codebase using the RepositoryMap structure.
 *
 * This class enables cross-file symbol resolution by analyzing the symbol definitions
 * and references stored in the repository map.
 *
 * @example
 * ```typescript
 * const resolver = new SymbolResolver(repositoryMap);
 *
 * // Find definition of a symbol
 * const definition = resolver.findDefinition('calculateTotal');
 * if (definition) {
 *   console.log(`Found at ${definition.filePath}:${definition.line}`);
 * }
 *
 * // Find all references to a symbol
 * const references = resolver.findReferences('UserService');
 * console.log(`Found ${references?.references.length || 0} references`);
 * ```
 */
export class SymbolResolver {
  private repositoryMap: RepositoryMap;

  /**
   * Create a new SymbolResolver
   * @param repositoryMap - The repository map to resolve symbols from
   */
  constructor(repositoryMap: RepositoryMap) {
    this.repositoryMap = repositoryMap;
  }

  /**
   * Find the definition of a symbol by name
   *
   * @param symbolName - The name of the symbol to find
   * @returns The symbol definition if found, null otherwise
   *
   * @example
   * ```typescript
   * const definition = resolver.findDefinition('calculateTotal');
   * if (definition) {
   *   console.log(`calculateTotal is defined in ${definition.filePath} at line ${definition.line}`);
   * }
   * ```
   */
  findDefinition(symbolName: string): SymbolDefinition | null {
    // Search through all files in the repository
    for (const file of this.repositoryMap.files) {
      // Search through all symbols in each file
      for (const symbol of file.symbols || []) {
        if (symbol.name === symbolName) {
          return {
            symbol,
            filePath: file.path,
            line: symbol.startLine,
            column: symbol.startColumn
          };
        }
      }
    }

    return null;
  }

  /**
   * Find all references to a symbol by name
   *
   * @param symbolName - The name of the symbol to find references for
   * @returns The symbol and all its references if found, null otherwise
   *
   * @example
   * ```typescript
   * const result = resolver.findReferences('UserService');
   * if (result) {
   *   console.log(`Found ${result.references.length} references to UserService`);
   *   result.references.forEach(ref => {
   *     console.log(`  - ${ref.filePath}:${ref.line}`);
   *   });
   * }
   * ```
   */
  findReferences(symbolName: string): SymbolReferencesResult | null {
    // First find the symbol definition
    const definition = this.findDefinition(symbolName);
    if (!definition) {
      return null;
    }

    // Find all references to this symbol
    const references: SymbolReferencesResult['references'] = [];

    for (const reference of this.repositoryMap.references) {
      if (reference.symbolName === symbolName) {
        references.push({
          reference,
          filePath: reference.sourceFile,
          line: reference.sourceLine,
          column: reference.sourceColumn
        });
      }
    }

    return {
      symbol: definition.symbol,
      references
    };
  }

  /**
   * Find symbols defined in a specific file
   *
   * @param filePath - The path of the file to search
   * @returns Array of symbols defined in the file
   *
   * @example
   * ```typescript
   * const symbols = resolver.findSymbolsInFile('src/utils/math.ts');
   * symbols.forEach(def => {
   *   console.log(`${def.symbol.name} (${def.symbol.type}) at line ${def.line}`);
   * });
   * ```
   */
  findSymbolsInFile(filePath: string): SymbolDefinition[] {
    const file = this.repositoryMap.files.find(f => f.path === filePath);
    if (!file) {
      return [];
    }

    return (file.symbols || []).map(symbol => ({
      symbol,
      filePath: file.path,
      line: symbol.startLine,
      column: symbol.startColumn
    }));
  }

  /**
   * Find references that originate from a specific file
   *
   * @param filePath - The path of the file to search
   * @returns Array of references originating from the file
   *
   * @example
   * ```typescript
   * const refs = resolver.findReferencesFromFile('src/components/Cart.tsx');
   * refs.forEach(ref => {
   *   console.log(`Uses ${ref.reference.symbolName} from ${ref.reference.targetFile}`);
   * });
   * ```
   */
  findReferencesFromFile(filePath: string): Array<{
    reference: SymbolReference;
    filePath: string;
    line: number;
    column?: number;
  }> {
    return this.repositoryMap.references
      .filter(ref => ref.sourceFile === filePath)
      .map(reference => ({
        reference,
        filePath: reference.sourceFile,
        line: reference.sourceLine,
        column: reference.sourceColumn
      }));
  }

  /**
   * Find references that target a specific file
   *
   * @param filePath - The path of the file to search
   * @returns Array of references targeting the file
   *
   * @example
   * ```typescript
   * const refs = resolver.findReferencesToFile('src/utils/math.ts');
   * refs.forEach(ref => {
   *   console.log(`${ref.reference.symbolName} is used by ${ref.reference.sourceFile}`);
   * });
   * ```
   */
  findReferencesToFile(filePath: string): Array<{
    reference: SymbolReference;
    filePath: string;
    line: number;
    column?: number;
  }> {
    return this.repositoryMap.references
      .filter(ref => ref.targetFile === filePath)
      .map(reference => ({
        reference,
        filePath: reference.sourceFile,
        line: reference.sourceLine,
        column: reference.sourceColumn
      }));
  }

  /**
   * Find all symbols of a specific type
   *
   * @param symbolType - The type of symbols to find (e.g., 'function', 'class', 'interface')
   * @returns Array of symbols of the specified type
   *
   * @example
   * ```typescript
   * const functions = resolver.findSymbolsByType('function');
   * console.log(`Found ${functions.length} functions in the codebase`);
   * ```
   */
  findSymbolsByType(symbolType: string): SymbolDefinition[] {
    const results: SymbolDefinition[] = [];

    for (const file of this.repositoryMap.files) {
      for (const symbol of file.symbols || []) {
        if (symbol.type === symbolType) {
          results.push({
            symbol,
            filePath: file.path,
            line: symbol.startLine,
            column: symbol.startColumn
          });
        }
      }
    }

    return results;
  }

  /**
   * Get statistics about the symbols and references in the repository
   *
   * @returns Object containing counts and statistics
   *
   * @example
   * ```typescript
   * const stats = resolver.getStatistics();
   * console.log(`Total symbols: ${stats.totalSymbols}`);
   * console.log(`Total references: ${stats.totalReferences}`);
   * ```
   */
  getStatistics(): {
    totalSymbols: number;
    totalReferences: number;
    totalFiles: number;
    symbolsByType: Record<string, number>;
    filesWithSymbols: number;
    filesWithReferences: number;
  } {
    let totalSymbols = 0;
    const symbolsByType: Record<string, number> = {};
    let filesWithSymbols = 0;

    for (const file of this.repositoryMap.files) {
      const fileSymbols = file.symbols || [];
      if (fileSymbols.length > 0) {
        filesWithSymbols++;
      }

      totalSymbols += fileSymbols.length;

      for (const symbol of fileSymbols) {
        symbolsByType[symbol.type] = (symbolsByType[symbol.type] || 0) + 1;
      }
    }

    const sourceFiles = new Set(this.repositoryMap.references.map(ref => ref.sourceFile));

    return {
      totalSymbols,
      totalReferences: this.repositoryMap.references.length,
      totalFiles: this.repositoryMap.files.length,
      symbolsByType,
      filesWithSymbols,
      filesWithReferences: sourceFiles.size
    };
  }
}