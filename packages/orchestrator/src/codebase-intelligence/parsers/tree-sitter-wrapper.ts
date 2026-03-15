/**
 * Tree-Sitter Wrapper
 *
 * Provides a unified interface for parsing source code across multiple languages
 * using tree-sitter. Supports TypeScript, JavaScript, Python, Go, Java, and Rust.
 *
 * Features:
 * - Lazy language loading for optimal startup performance
 * - Singleton pattern with cached parser instances
 * - Language detection from file extensions
 * - Comprehensive error collection from AST
 * - Full TypeScript type support
 *
 * @example
 * ```typescript
 * const wrapper = TreeSitterWrapper.getInstance();
 * const result = await wrapper.parse('const x = 5;', SupportedLanguage.JavaScript);
 * console.log(result.rootNode.type); // 'program'
 * ```
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import type { Language } from 'tree-sitter';
import {
  SupportedLanguage,
  ParseResult,
  ParseError,
  ParseOptions,
  Position,
  ParserError,
  UnsupportedLanguageError,
  EXTENSION_LANGUAGE_MAP
} from './types.js';

// Re-export types for convenience
export * from './types.js';

/**
 * Default parse options
 */
const DEFAULT_PARSE_OPTIONS: Required<ParseOptions> = {
  collectCommentErrors: false,
  maxErrors: 100,
  timeout: 5000
};

/**
 * TreeSitterWrapper class
 *
 * A wrapper around tree-sitter that provides:
 * - Multi-language support with lazy loading
 * - File-based parsing with automatic language detection
 * - Error collection and reporting
 * - TypeScript type safety
 */
export class TreeSitterWrapper {
  /** Singleton instance */
  private static instance: TreeSitterWrapper | null = null;

  /** Cached language grammars */
  private languageCache: Map<SupportedLanguage, Language> = new Map();

  /** The tree-sitter Parser instance */
  private parser: any | null = null;

  /** Whether the parser module has been loaded */
  private parserLoaded = false;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    // Initialization is done lazily in ensureParser()
  }

  /**
   * Get the singleton instance of TreeSitterWrapper
   *
   * @returns The TreeSitterWrapper singleton instance
   */
  public static getInstance(): TreeSitterWrapper {
    if (!TreeSitterWrapper.instance) {
      TreeSitterWrapper.instance = new TreeSitterWrapper();
    }
    return TreeSitterWrapper.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    if (TreeSitterWrapper.instance) {
      TreeSitterWrapper.instance.clearCache();
      TreeSitterWrapper.instance = null;
    }
  }

  /**
   * Ensure the parser module is loaded
   */
  private async ensureParser(): Promise<any> {
    if (!this.parserLoaded || !this.parser) {
      const TreeSitter = (await import('tree-sitter')).default;
      this.parser = new TreeSitter();
      this.parserLoaded = true;
    }
    return this.parser;
  }

  /**
   * Load and cache a language grammar
   *
   * @param language - The language to load
   * @returns The loaded Language instance
   * @throws {ParserError} If the language grammar fails to load
   */
  private async loadLanguage(language: SupportedLanguage): Promise<Language> {
    // Check cache first
    const cached = this.languageCache.get(language);
    if (cached) {
      return cached;
    }

    try {
      let languageGrammar: any;

      switch (language) {
        case SupportedLanguage.TypeScript: {
          const { typescript } = await import('tree-sitter-typescript');
          languageGrammar = typescript;
          break;
        }
        case SupportedLanguage.TSX: {
          const { tsx } = await import('tree-sitter-typescript');
          languageGrammar = tsx;
          break;
        }
        case SupportedLanguage.JavaScript: {
          const mod = await import('tree-sitter-javascript');
          languageGrammar = mod.default;
          break;
        }
        case SupportedLanguage.Python: {
          const mod = await import('tree-sitter-python');
          languageGrammar = mod.default;
          break;
        }
        case SupportedLanguage.Go: {
          const mod = await import('tree-sitter-go');
          languageGrammar = mod.default;
          break;
        }
        case SupportedLanguage.Java: {
          const mod = await import('tree-sitter-java');
          languageGrammar = mod.default;
          break;
        }
        case SupportedLanguage.Rust: {
          const mod = await import('tree-sitter-rust');
          languageGrammar = mod.default;
          break;
        }
        default:
          throw new UnsupportedLanguageError(language);
      }

      this.languageCache.set(language, languageGrammar as Language);
      return languageGrammar as Language;
    } catch (error) {
      if (error instanceof UnsupportedLanguageError) {
        throw error;
      }
      throw new ParserError(
        `Failed to load language grammar for ${language}`,
        language,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Parse source code and return an AST
   *
   * @param sourceCode - The source code to parse
   * @param language - The programming language of the source code
   * @param options - Optional parse configuration
   * @returns ParseResult containing the AST and any errors
   * @throws {UnsupportedLanguageError} If the language is not supported
   * @throws {ParserError} If parsing fails catastrophically
   *
   * @example
   * ```typescript
   * const wrapper = TreeSitterWrapper.getInstance();
   * const result = await wrapper.parse(
   *   'function hello() { return "world"; }',
   *   SupportedLanguage.JavaScript
   * );
   * console.log(result.hasErrors); // false
   * console.log(result.rootNode.type); // 'program'
   * ```
   */
  public async parse(
    sourceCode: string,
    language: SupportedLanguage,
    options: ParseOptions = {}
  ): Promise<ParseResult> {
    const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };

    // Validate language
    if (!Object.values(SupportedLanguage).includes(language)) {
      throw new UnsupportedLanguageError(language);
    }

    try {
      // Ensure parser is ready
      const parser = await this.ensureParser();

      // Load and set language
      const languageGrammar = await this.loadLanguage(language);
      parser.setLanguage(languageGrammar);

      // Parse the source code
      const tree = parser.parse(sourceCode);

      // Collect errors from the AST
      const errors = this.collectErrors(tree.rootNode, opts.maxErrors);

      return {
        tree,
        rootNode: tree.rootNode,
        hasErrors: tree.rootNode.hasError,
        errors,
        language,
        sourceCode
      };
    } catch (error) {
      if (error instanceof UnsupportedLanguageError || error instanceof ParserError) {
        throw error;
      }
      throw new ParserError(
        `Failed to parse source code as ${language}`,
        language,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Parse a file with automatic language detection
   *
   * @param filePath - Path to the file to parse
   * @param options - Optional parse configuration
   * @returns ParseResult containing the AST and any errors
   * @throws {UnsupportedLanguageError} If the file extension is not supported
   * @throws {ParserError} If the file cannot be read or parsed
   *
   * @example
   * ```typescript
   * const wrapper = TreeSitterWrapper.getInstance();
   * const result = await wrapper.parseFile('/path/to/file.ts');
   * console.log(result.language); // 'typescript'
   * ```
   */
  public async parseFile(filePath: string, options: ParseOptions = {}): Promise<ParseResult> {
    // Detect language from extension
    const language = this.detectLanguage(filePath);
    if (!language) {
      const ext = path.extname(filePath);
      throw new UnsupportedLanguageError(ext || 'unknown');
    }

    try {
      // Read file contents
      const sourceCode = await fs.readFile(filePath, 'utf-8');
      return this.parse(sourceCode, language, options);
    } catch (error) {
      if (error instanceof UnsupportedLanguageError || error instanceof ParserError) {
        throw error;
      }
      throw new ParserError(
        `Failed to read or parse file: ${filePath}`,
        language,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Detect the programming language from a file path
   *
   * @param filePath - Path to the file (can be just the filename)
   * @returns The detected language, or null if not supported
   *
   * @example
   * ```typescript
   * const wrapper = TreeSitterWrapper.getInstance();
   * wrapper.detectLanguage('app.tsx'); // SupportedLanguage.TSX
   * wrapper.detectLanguage('/path/to/main.py'); // SupportedLanguage.Python
   * wrapper.detectLanguage('file.txt'); // null
   * ```
   */
  public detectLanguage(filePath: string): SupportedLanguage | null {
    const ext = path.extname(filePath).toLowerCase();
    return EXTENSION_LANGUAGE_MAP[ext] ?? null;
  }

  /**
   * Get all supported languages
   *
   * @returns Array of all supported languages
   */
  public getSupportedLanguages(): SupportedLanguage[] {
    return Object.values(SupportedLanguage);
  }

  /**
   * Check if a language is supported
   *
   * @param language - The language to check
   * @returns true if the language is supported
   */
  public isLanguageSupported(language: string): language is SupportedLanguage {
    return Object.values(SupportedLanguage).includes(language as SupportedLanguage);
  }

  /**
   * Get all supported file extensions
   *
   * @returns Array of supported file extensions (e.g., ['.ts', '.tsx', '.js', ...])
   */
  public getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_LANGUAGE_MAP);
  }

  /**
   * Clear the language cache
   *
   * Useful for releasing memory when parsing is complete,
   * or for testing purposes.
   */
  public clearCache(): void {
    this.languageCache.clear();
    this.parser = null;
    this.parserLoaded = false;
  }

  /**
   * Get cache statistics
   *
   * @returns Object with cache size and loaded languages
   */
  public getCacheStats(): { size: number; loadedLanguages: SupportedLanguage[] } {
    return {
      size: this.languageCache.size,
      loadedLanguages: Array.from(this.languageCache.keys())
    };
  }

  /**
   * Collect parse errors from the AST
   *
   * Traverses the AST looking for ERROR and MISSING nodes,
   * which indicate syntax errors in the source code.
   *
   * @param rootNode - The root node of the AST
   * @param maxErrors - Maximum number of errors to collect
   * @returns Array of ParseError objects
   */
  private collectErrors(
    rootNode: import('tree-sitter').SyntaxNode,
    maxErrors: number
  ): ParseError[] {
    const errors: ParseError[] = [];

    // Use cursor for efficient traversal
    const cursor = rootNode.walk();

    const visitNode = (): void => {
      const node = cursor.currentNode;

      // Check for error nodes
      if (node.type === 'ERROR' || node.isMissing) {
        if (errors.length < maxErrors) {
          const startPos: Position = {
            row: node.startPosition.row,
            column: node.startPosition.column
          };
          const endPos: Position = {
            row: node.endPosition.row,
            column: node.endPosition.column
          };

          errors.push({
            message: node.isMissing
              ? `Missing expected token`
              : `Syntax error at position ${startPos.row}:${startPos.column}`,
            startPosition: startPos,
            endPosition: endPos,
            type: node.type,
            text: node.text?.slice(0, 50) // Limit text length
          });
        }
      }

      // Recursively visit children
      if (cursor.gotoFirstChild()) {
        do {
          visitNode();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };

    visitNode();
    return errors;
  }
}

/**
 * Convenience function to get the TreeSitterWrapper instance
 *
 * @returns The TreeSitterWrapper singleton instance
 */
export function getTreeSitterWrapper(): TreeSitterWrapper {
  return TreeSitterWrapper.getInstance();
}
