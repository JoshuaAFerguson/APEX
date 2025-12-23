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
import type { OutdatedDocumentation } from '@apexcli/core';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a documentation reference extracted from markdown or comments
 */
export interface DocumentationReference {
  /** Referenced symbol name */
  symbolName: string;
  /** Type of reference (inline-code, code-block, see-tag) */
  referenceType: 'inline-code' | 'code-block' | 'see-tag';
  /** File where the reference was found */
  sourceFile: string;
  /** Line number where the reference was found */
  line: number;
  /** Column where the reference starts */
  column: number;
  /** Full context of the reference */
  context: string;
}

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

/**
 * Regular expression patterns for extracting documentation references
 */
const DOCUMENTATION_PATTERNS = {
  // Inline code patterns: `FunctionName()`, `ClassName`, `TypeName`
  inlineCode: /`([A-Z][a-zA-Z0-9_$]*(?:\(\))?|[a-z][a-zA-Z0-9_$]*\(\))`/g,

  // Markdown code blocks (JavaScript/TypeScript)
  codeBlock: /```(?:javascript|typescript|js|ts)?\s*\n([\s\S]*?)\n```/g,

  // @see tags in JSDoc comments
  seeTag: /@see\s+(?:\{@link\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)(?:\})?/g,

  // Symbol references within code blocks (function calls, class instantiations, etc.)
  symbolInCode: /(?:new\s+)?([A-Z][a-zA-Z0-9_$]*)|([a-z][a-zA-Z0-9_$]*)\s*\(/g,
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

  /**
   * Validate documentation references against the symbol index and report broken links
   * Returns array of OutdatedDocumentation objects for broken references
   */
  validateDocumentationReferences(
    index: SymbolIndex,
    references: DocumentationReference[]
  ): OutdatedDocumentation[] {
    const brokenReferences: OutdatedDocumentation[] = [];

    for (const reference of references) {
      const isValid = this.validateReference(index, reference.symbolName);

      if (!isValid) {
        // Try to find similar symbol names for suggestions
        const similarSymbols = this.findSimilarSymbols(index, reference.symbolName);
        const suggestion = similarSymbols.length > 0
          ? `Did you mean: ${similarSymbols.slice(0, 3).join(', ')}?`
          : 'Symbol not found in codebase';

        // Determine severity based on reference type
        let severity: 'low' | 'medium' | 'high';
        switch (reference.referenceType) {
          case 'see-tag':
            severity = 'high'; // @see tags are explicit references
            break;
          case 'inline-code':
            severity = 'medium'; // Inline code is likely intentional
            break;
          case 'code-block':
            severity = 'low'; // Code blocks might be examples
            break;
          default:
            severity = 'medium';
        }

        brokenReferences.push({
          file: reference.sourceFile,
          type: 'broken-link',
          description: `Reference to non-existent symbol '${reference.symbolName}' in ${reference.referenceType} at line ${reference.line}. Context: ${reference.context.substring(0, 100)}${reference.context.length > 100 ? '...' : ''}`,
          line: reference.line,
          suggestion,
          severity,
        });
      }
    }

    return brokenReferences;
  }

  /**
   * Find symbols with names similar to the given symbol name
   * Used for providing suggestions when a reference is broken
   */
  private findSimilarSymbols(index: SymbolIndex, symbolName: string, threshold = 0.6): string[] {
    const allSymbolNames = Array.from(index.byName.keys());
    const similar: Array<{name: string, score: number}> = [];

    for (const name of allSymbolNames) {
      const score = this.calculateSimilarity(symbolName.toLowerCase(), name.toLowerCase());
      if (score >= threshold) {
        similar.push({name, score});
      }
    }

    // Sort by similarity score and return just the names
    return similar
      .sort((a, b) => b.score - a.score)
      .map(item => item.name);
  }

  /**
   * Calculate similarity between two strings using a simple algorithm
   * Returns a score between 0 and 1, where 1 is identical
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Handle identical strings
    if (str1 === str2) return 1;

    // Handle empty strings
    if (str1.length === 0 || str2.length === 0) return 0;

    // Use Jaccard similarity based on character bigrams
    const getBigrams = (str: string): Set<string> => {
      const bigrams = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
      }
      return bigrams;
    };

    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);

    const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
    const union = new Set([...bigrams1, ...bigrams2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Extract symbol references from documentation content
   * Supports markdown files, JSDoc comments, and other documentation formats
   */
  extractDocumentationReferences(filePath: string, content: string): DocumentationReference[] {
    const references: DocumentationReference[] = [];

    // Extract references from inline code patterns
    references.push(...this.extractInlineCodeReferences(filePath, content));

    // Extract references from markdown code blocks
    references.push(...this.extractCodeBlockReferences(filePath, content));

    // Extract references from @see tags
    references.push(...this.extractSeeTagReferences(filePath, content));

    return references;
  }

  /**
   * Extract symbol references from inline code patterns like `FunctionName()` or `ClassName`
   */
  extractInlineCodeReferences(filePath: string, content: string): DocumentationReference[] {
    const references: DocumentationReference[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      let match: RegExpExecArray | null;

      // Reset regex lastIndex for each line
      DOCUMENTATION_PATTERNS.inlineCode.lastIndex = 0;

      while ((match = DOCUMENTATION_PATTERNS.inlineCode.exec(line)) !== null) {
        const symbolName = match[1];

        // Clean up symbol name (remove parentheses if present)
        const cleanSymbolName = symbolName.replace(/\(\)$/, '');

        references.push({
          symbolName: cleanSymbolName,
          referenceType: 'inline-code',
          sourceFile: filePath,
          line: lineNumber,
          column: match.index + 1,
          context: line.trim(),
        });
      }
    }

    return references;
  }

  /**
   * Extract symbol references from markdown code blocks
   */
  extractCodeBlockReferences(filePath: string, content: string): DocumentationReference[] {
    const references: DocumentationReference[] = [];
    let match: RegExpExecArray | null;

    // Reset regex lastIndex
    DOCUMENTATION_PATTERNS.codeBlock.lastIndex = 0;

    while ((match = DOCUMENTATION_PATTERNS.codeBlock.exec(content)) !== null) {
      const codeBlockContent = match[1];
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      // Extract symbols from the code block content
      const codeBlockReferences = this.extractSymbolsFromCodeContent(
        filePath,
        codeBlockContent,
        lineNumber
      );

      references.push(...codeBlockReferences);
    }

    return references;
  }

  /**
   * Extract symbol references from @see tags in documentation
   */
  extractSeeTagReferences(filePath: string, content: string): DocumentationReference[] {
    const references: DocumentationReference[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      let match: RegExpExecArray | null;

      // Reset regex lastIndex for each line
      DOCUMENTATION_PATTERNS.seeTag.lastIndex = 0;

      while ((match = DOCUMENTATION_PATTERNS.seeTag.exec(line)) !== null) {
        const symbolName = match[1];

        // Handle dotted references (e.g., Module.Function) - take the last part
        const actualSymbolName = symbolName.includes('.')
          ? symbolName.split('.').pop()!
          : symbolName;

        references.push({
          symbolName: actualSymbolName,
          referenceType: 'see-tag',
          sourceFile: filePath,
          line: lineNumber,
          column: match.index + 1,
          context: line.trim(),
        });
      }
    }

    return references;
  }

  /**
   * Extract symbols from code content (used by code block extraction)
   */
  private extractSymbolsFromCodeContent(
    filePath: string,
    codeContent: string,
    startLine: number
  ): DocumentationReference[] {
    const references: DocumentationReference[] = [];
    const lines = codeContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = startLine + i;
      let match: RegExpExecArray | null;

      // Reset regex lastIndex for each line
      DOCUMENTATION_PATTERNS.symbolInCode.lastIndex = 0;

      while ((match = DOCUMENTATION_PATTERNS.symbolInCode.exec(line)) !== null) {
        // match[1] is class names (PascalCase), match[2] is function calls
        const symbolName = match[1] || match[2];

        if (symbolName && this.isValidSymbolReference(symbolName)) {
          references.push({
            symbolName,
            referenceType: 'code-block',
            sourceFile: filePath,
            line: lineNumber,
            column: match.index + 1,
            context: line.trim(),
          });
        }
      }
    }

    return references;
  }

  /**
   * Check if a symbol name is valid and should be considered a reference
   */
  private isValidSymbolReference(symbolName: string): boolean {
    // Filter out common JavaScript keywords and built-in functions
    const excludedNames = new Set([
      'console', 'log', 'error', 'warn', 'info', 'debug',
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean',
      'Date', 'RegExp', 'Math', 'JSON',
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'function', 'class', 'interface', 'type', 'enum',
      'const', 'let', 'var', 'return', 'throw', 'try', 'catch', 'finally',
      'import', 'export', 'from', 'as',
    ]);

    return (
      symbolName.length > 1 && // Must be more than 1 character
      !excludedNames.has(symbolName) && // Not in excluded list
      /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(symbolName) // Valid identifier
    );
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