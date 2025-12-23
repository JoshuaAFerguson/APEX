/**
 * Cross Reference Validator
 *
 * Builds a symbol index from TypeScript/JavaScript source files for cross-reference
 * validation. Extracts function names, class names, and type names to enable
 * validation of references between documentation and code.
 *
 * This utility supports the `crossReferenceEnabled` configuration in OutdatedDocsConfig
 * and follows established patterns from JSDocDetector.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a symbol extracted from source code
 */
export interface SymbolInfo {
  /** Symbol name */
  name: string;
  /** Symbol type */
  type: 'function' | 'class' | 'type' | 'interface' | 'enum' | 'const' | 'variable' | 'method' | 'property';
  /** File path where the symbol is defined */
  file: string;
  /** Line number where the symbol is defined */
  line: number;
  /** Column number where the symbol starts */
  column: number;
  /** Whether the symbol is exported */
  isExported: boolean;
  /** Parent symbol (for methods/properties inside classes) */
  parent?: string;
  /** JSDoc/TSDoc comment if present */
  documentation?: string;
}

/**
 * Symbol index mapping symbol names to their definitions
 */
export interface SymbolIndex {
  /** All symbols indexed by name (may have multiple definitions) */
  byName: Map<string, SymbolInfo[]>;
  /** Symbols indexed by file path */
  byFile: Map<string, SymbolInfo[]>;
  /** Statistics about the index */
  stats: {
    totalSymbols: number;
    totalFiles: number;
    byType: Record<string, number>;
  };
}

/**
 * Options for symbol extraction
 */
export interface SymbolExtractionOptions {
  /** File extensions to process (default: ['.ts', '.tsx', '.js', '.jsx']) */
  extensions?: string[];
  /** Glob patterns to include */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Whether to extract non-exported symbols (default: false) */
  includePrivate?: boolean;
  /** Whether to extract class members (default: true) */
  includeMembers?: boolean;
}

// ============================================================================
// Regex Patterns for Symbol Extraction
// ============================================================================

/**
 * Regular expression patterns for detecting various symbol types
 * Based on patterns from JSDocDetector but extended for broader symbol extraction
 */
const SYMBOL_PATTERNS = {
  // Exported functions: export function foo, export async function bar
  exportedFunction: /^export\s+(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,

  // Non-exported functions: function foo, async function bar
  function: /^(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,

  // Arrow functions: const foo = () =>, export const bar = async () =>
  arrowFunction: /^(export\s+)?const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(async\s+)?\(/,

  // Classes: export class Foo, class Bar, export abstract class Baz
  exportedClass: /^export\s+(abstract\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,

  // Non-exported classes
  class: /^(abstract\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,

  // Interfaces: export interface Foo, interface Bar
  exportedInterface: /^export\s+interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
  interface: /^interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,

  // Type aliases: export type Foo, type Bar
  exportedType: /^export\s+type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
  type: /^type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,

  // Enums: export enum Foo, enum Bar
  exportedEnum: /^export\s+enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
  enum: /^enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,

  // Constants/variables: export const FOO, const BAR, let baz
  exportedConst: /^export\s+(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
  const: /^(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,

  // Class methods: public foo(), private bar(), async baz()
  method: /^\s+(public|private|protected|static)?\s*(async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,

  // Class properties: public foo:, private bar =
  property: /^\s+(public|private|protected|static)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]/,

  // JSDoc comment block
  jsDocBlock: /\/\*\*([\s\S]*?)\*\//g,
} as const;

// ============================================================================
// CrossReferenceValidator Class
// ============================================================================

export class CrossReferenceValidator {
  /**
   * Build a symbol index from source files in a directory
   */
  async buildIndex(rootPath: string, options: SymbolExtractionOptions = {}): Promise<SymbolIndex> {
    const {
      extensions = ['.ts', '.tsx', '.js', '.jsx'],
      include = ['**/*'],
      exclude = ['node_modules/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*'],
      includePrivate = false,
      includeMembers = true,
    } = options;

    const index: SymbolIndex = {
      byName: new Map(),
      byFile: new Map(),
      stats: {
        totalSymbols: 0,
        totalFiles: 0,
        byType: {},
      },
    };

    try {
      const files = await this.findSourceFiles(rootPath, extensions, include, exclude);

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const symbols = this.extractSymbols(filePath, content, includePrivate, includeMembers);

          // Add symbols to the index
          for (const symbol of symbols) {
            this.addSymbolToIndex(index, symbol);
          }

          index.stats.totalFiles++;
        } catch (error) {
          // Skip files that can't be read
          console.warn(`Failed to process ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Failed to build symbol index for ${rootPath}:`, error);
    }

    return index;
  }

  /**
   * Extract symbols from a single file
   */
  extractSymbols(filePath: string, content: string, includePrivate = false, includeMembers = true): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');
    let currentClass: string | undefined;
    const jsDocMap = this.extractJSDocComments(content);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const lineNumber = i + 1;

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
        continue;
      }

      // Track current class context for methods and properties
      const classMatch = trimmedLine.match(SYMBOL_PATTERNS.class) ||
                        trimmedLine.match(SYMBOL_PATTERNS.exportedClass);
      if (classMatch) {
        const isExported = trimmedLine.startsWith('export');
        const name = classMatch[2];
        currentClass = name;

        const symbol: SymbolInfo = {
          name,
          type: 'class',
          file: filePath,
          line: lineNumber,
          column: line.indexOf(trimmedLine) + 1,
          isExported,
          documentation: jsDocMap.get(lineNumber),
        };

        symbols.push(symbol);
        continue;
      }

      // Reset class context when we exit a class
      if (trimmedLine === '}' && currentClass) {
        currentClass = undefined;
        continue;
      }

      // Extract various symbol types
      const symbolInfo = this.extractSymbolFromLine(line, lineNumber, filePath, jsDocMap, currentClass);
      if (symbolInfo && (includePrivate || symbolInfo.isExported || symbolInfo.type === 'method' || symbolInfo.type === 'property')) {
        // Include class members only if requested
        if (!includeMembers && (symbolInfo.type === 'method' || symbolInfo.type === 'property')) {
          continue;
        }
        symbols.push(symbolInfo);
      }
    }

    return symbols;
  }

  /**
   * Look up a symbol by name
   */
  lookupSymbol(index: SymbolIndex, name: string): SymbolInfo[] {
    return index.byName.get(name) || [];
  }

  /**
   * Get symbols from a specific file
   */
  getFileSymbols(index: SymbolIndex, filePath: string): SymbolInfo[] {
    return index.byFile.get(filePath) || [];
  }

  /**
   * Check if a symbol reference is valid
   */
  validateReference(index: SymbolIndex, symbolName: string): boolean {
    const symbols = this.lookupSymbol(index, symbolName);
    return symbols.length > 0;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Find source files matching the given criteria
   */
  private async findSourceFiles(
    rootPath: string,
    extensions: string[],
    include: string[],
    exclude: string[]
  ): Promise<string[]> {
    const files: string[] = [];

    const walkDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(rootPath, fullPath);

          // Check if path should be excluded
          if (exclude.some(pattern => this.matchesGlob(relativePath, pattern))) {
            continue;
          }

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            // Check if file has valid extension
            if (extensions.some(ext => entry.name.endsWith(ext))) {
              // Check if file matches include patterns
              if (include.some(pattern => this.matchesGlob(relativePath, pattern))) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    await walkDir(rootPath);
    return files;
  }

  /**
   * Simple glob pattern matching
   */
  private matchesGlob(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    const regex = new RegExp(regexPattern);
    return regex.test(path);
  }

  /**
   * Extract JSDoc comments and map them to line numbers
   */
  private extractJSDocComments(content: string): Map<number, string> {
    const jsDocMap = new Map<number, string>();
    let match: RegExpExecArray | null;

    while ((match = SYMBOL_PATTERNS.jsDocBlock.exec(content)) !== null) {
      const comment = match[0];
      const beforeComment = content.substring(0, match.index);
      const linesBefore = beforeComment.split('\n').length;
      const commentLines = comment.split('\n');

      // Map the comment to the line after it ends
      const endLine = linesBefore + commentLines.length;
      const cleanComment = this.cleanJSDocComment(comment);
      jsDocMap.set(endLine, cleanComment);
    }

    return jsDocMap;
  }

  /**
   * Clean JSDoc comment by removing formatting
   */
  private cleanJSDocComment(comment: string): string {
    return comment
      .replace(/\/\*\*|\*\//g, '')
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, '').trim())
      .filter(line => line.length > 0)
      .join(' ')
      .trim();
  }

  /**
   * Extract symbol information from a single line
   */
  private extractSymbolFromLine(
    line: string,
    lineNumber: number,
    filePath: string,
    jsDocMap: Map<number, string>,
    currentClass?: string
  ): SymbolInfo | null {
    const trimmedLine = line.trim();
    const column = line.indexOf(trimmedLine) + 1;
    const documentation = jsDocMap.get(lineNumber);

    // Exported functions
    let match = trimmedLine.match(SYMBOL_PATTERNS.exportedFunction);
    if (match) {
      return {
        name: match[2],
        type: 'function',
        file: filePath,
        line: lineNumber,
        column,
        isExported: true,
        documentation,
      };
    }

    // Non-exported functions
    match = trimmedLine.match(SYMBOL_PATTERNS.function);
    if (match && !trimmedLine.startsWith('export')) {
      return {
        name: match[2],
        type: 'function',
        file: filePath,
        line: lineNumber,
        column,
        isExported: false,
        documentation,
      };
    }

    // Arrow functions
    match = trimmedLine.match(SYMBOL_PATTERNS.arrowFunction);
    if (match) {
      return {
        name: match[2],
        type: 'function',
        file: filePath,
        line: lineNumber,
        column,
        isExported: !!match[1],
        documentation,
      };
    }

    // Interfaces
    match = trimmedLine.match(SYMBOL_PATTERNS.exportedInterface) ||
            trimmedLine.match(SYMBOL_PATTERNS.interface);
    if (match) {
      return {
        name: match[1],
        type: 'interface',
        file: filePath,
        line: lineNumber,
        column,
        isExported: trimmedLine.startsWith('export'),
        documentation,
      };
    }

    // Type aliases
    match = trimmedLine.match(SYMBOL_PATTERNS.exportedType) ||
            trimmedLine.match(SYMBOL_PATTERNS.type);
    if (match) {
      return {
        name: match[1],
        type: 'type',
        file: filePath,
        line: lineNumber,
        column,
        isExported: trimmedLine.startsWith('export'),
        documentation,
      };
    }

    // Enums
    match = trimmedLine.match(SYMBOL_PATTERNS.exportedEnum) ||
            trimmedLine.match(SYMBOL_PATTERNS.enum);
    if (match) {
      return {
        name: match[1],
        type: 'enum',
        file: filePath,
        line: lineNumber,
        column,
        isExported: trimmedLine.startsWith('export'),
        documentation,
      };
    }

    // Constants/variables
    match = trimmedLine.match(SYMBOL_PATTERNS.exportedConst) ||
            trimmedLine.match(SYMBOL_PATTERNS.const);
    if (match) {
      return {
        name: match[2],
        type: match[1] === 'const' ? 'const' : 'variable',
        file: filePath,
        line: lineNumber,
        column,
        isExported: trimmedLine.startsWith('export'),
        documentation,
      };
    }

    // Class methods (only if we're inside a class)
    if (currentClass) {
      match = trimmedLine.match(SYMBOL_PATTERNS.method);
      if (match) {
        return {
          name: match[3],
          type: 'method',
          file: filePath,
          line: lineNumber,
          column,
          isExported: false,
          parent: currentClass,
          documentation,
        };
      }

      // Class properties
      match = trimmedLine.match(SYMBOL_PATTERNS.property);
      if (match) {
        return {
          name: match[2],
          type: 'property',
          file: filePath,
          line: lineNumber,
          column,
          isExported: false,
          parent: currentClass,
          documentation,
        };
      }
    }

    return null;
  }

  /**
   * Add a symbol to the index
   */
  private addSymbolToIndex(index: SymbolIndex, symbol: SymbolInfo): void {
    // Add to name index
    if (!index.byName.has(symbol.name)) {
      index.byName.set(symbol.name, []);
    }
    index.byName.get(symbol.name)!.push(symbol);

    // Add to file index
    if (!index.byFile.has(symbol.file)) {
      index.byFile.set(symbol.file, []);
    }
    index.byFile.get(symbol.file)!.push(symbol);

    // Update stats
    index.stats.totalSymbols++;
    if (!index.stats.byType[symbol.type]) {
      index.stats.byType[symbol.type] = 0;
    }
    index.stats.byType[symbol.type]++;
  }
}