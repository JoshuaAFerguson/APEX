/**
 * Type definitions for Tree-Sitter Wrapper
 *
 * Provides TypeScript types for tree-sitter parsing operations,
 * including language enumeration, parse results, and error handling.
 */

// Re-export core tree-sitter types for consumer convenience
// These types come from the tree-sitter package
export type { Tree, SyntaxNode, Point, TreeCursor } from 'tree-sitter';

/**
 * Supported programming languages for parsing
 */
export enum SupportedLanguage {
  /** TypeScript (.ts) */
  TypeScript = 'typescript',
  /** TypeScript with JSX (.tsx) */
  TSX = 'tsx',
  /** JavaScript (.js, .jsx, .mjs, .cjs) */
  JavaScript = 'javascript',
  /** Python (.py) */
  Python = 'python',
  /** Go (.go) */
  Go = 'go',
  /** Java (.java) */
  Java = 'java',
  /** Rust (.rs) */
  Rust = 'rust'
}

/**
 * Position in source code (line and column)
 */
export interface Position {
  /** Line number (0-based) */
  row: number;
  /** Column number (0-based) */
  column: number;
}

/**
 * Range in source code
 */
export interface Range {
  /** Start position */
  start: Position;
  /** End position */
  end: Position;
  /** Start byte offset */
  startIndex: number;
  /** End byte offset */
  endIndex: number;
}

/**
 * Parse error information
 *
 * Represents a syntax error or unexpected token found during parsing.
 * Tree-sitter continues parsing even with errors, allowing partial AST access.
 */
export interface ParseError {
  /** Error description */
  message: string;
  /** Start position of error */
  startPosition: Position;
  /** End position of error */
  endPosition: Position;
  /** Node type that caused the error (usually 'ERROR' or 'MISSING') */
  type: string;
  /** The source text at the error location (if available) */
  text?: string;
}

/**
 * Result of a parse operation
 *
 * Contains the AST, metadata about the parse, and any errors encountered.
 */
export interface ParseResult {
  /** The parsed syntax tree */
  tree: import('tree-sitter').Tree;
  /** Root node of the AST (convenience accessor) */
  rootNode: import('tree-sitter').SyntaxNode;
  /** Whether the tree contains any syntax errors */
  hasErrors: boolean;
  /** List of parse errors (empty if hasErrors is false) */
  errors: ParseError[];
  /** The language used for parsing */
  language: SupportedLanguage;
  /** The source code that was parsed */
  sourceCode: string;
}

/**
 * Options for parse operations
 */
export interface ParseOptions {
  /** Include comments in error collection (default: false) */
  collectCommentErrors?: boolean;
  /** Maximum number of errors to collect (default: 100) */
  maxErrors?: number;
  /** Timeout for parsing in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * File extension to language mapping
 */
export const EXTENSION_LANGUAGE_MAP: Readonly<Record<string, SupportedLanguage>> = {
  // TypeScript
  '.ts': SupportedLanguage.TypeScript,
  '.tsx': SupportedLanguage.TSX,
  '.mts': SupportedLanguage.TypeScript,
  '.cts': SupportedLanguage.TypeScript,
  // JavaScript
  '.js': SupportedLanguage.JavaScript,
  '.jsx': SupportedLanguage.JavaScript,
  '.mjs': SupportedLanguage.JavaScript,
  '.cjs': SupportedLanguage.JavaScript,
  // Python
  '.py': SupportedLanguage.Python,
  '.pyw': SupportedLanguage.Python,
  '.pyi': SupportedLanguage.Python,
  // Go
  '.go': SupportedLanguage.Go,
  // Java
  '.java': SupportedLanguage.Java,
  // Rust
  '.rs': SupportedLanguage.Rust
};

/**
 * Get all supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_LANGUAGE_MAP);
}

/**
 * Check if a file extension is supported
 */
export function isExtensionSupported(extension: string): boolean {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return ext.toLowerCase() in EXTENSION_LANGUAGE_MAP;
}

/**
 * Get language for a file extension
 */
export function getLanguageForExtension(extension: string): SupportedLanguage | null {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return EXTENSION_LANGUAGE_MAP[ext.toLowerCase()] ?? null;
}

/**
 * Parser initialization state
 */
export interface ParserState {
  /** Whether the parser is ready */
  isReady: boolean;
  /** Loaded languages */
  loadedLanguages: Set<SupportedLanguage>;
  /** Any initialization errors */
  initializationError?: Error;
}

/**
 * Error thrown when parsing fails catastrophically
 * (distinct from syntax errors which are collected in ParseResult.errors)
 */
export class ParserError extends Error {
  constructor(
    message: string,
    public readonly language?: SupportedLanguage,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ParserError';
    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ParserError);
    }
  }
}

/**
 * Error thrown when an unsupported language is requested
 */
export class UnsupportedLanguageError extends Error {
  constructor(
    public readonly language: string,
    public readonly supportedLanguages: SupportedLanguage[] = Object.values(SupportedLanguage)
  ) {
    super(
      `Unsupported language: '${language}'. Supported languages: ${supportedLanguages.join(', ')}`
    );
    this.name = 'UnsupportedLanguageError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnsupportedLanguageError);
    }
  }
}
