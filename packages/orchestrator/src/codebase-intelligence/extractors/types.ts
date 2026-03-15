/**
 * Type definitions for Symbol Extractors
 *
 * Provides TypeScript types for symbol extraction operations,
 * including symbol kinds, modifiers, and extraction results.
 */

import type { Range, ParseError, SupportedLanguage } from '../parsers/types.js';

// Re-export commonly used types for convenience
export type { Range, ParseError, SupportedLanguage };

/**
 * Kinds of symbols that can be extracted from source code
 */
export enum SymbolKind {
  /** Function declaration (including generator functions) */
  Function = 'function',
  /** Arrow function expression (when assigned to a variable) */
  ArrowFunction = 'arrow_function',
  /** Class declaration */
  Class = 'class',
  /** Interface declaration (TypeScript only) */
  Interface = 'interface',
  /** Type alias declaration (TypeScript only) */
  TypeAlias = 'type_alias',
  /** Enum declaration (TypeScript only) */
  Enum = 'enum',
  /** Constant variable (const) */
  Constant = 'constant',
  /** Variable (let/var) */
  Variable = 'variable',
  /** Class method */
  Method = 'method',
  /** Class property/field */
  Property = 'property',
  /** Class constructor */
  Constructor = 'constructor',
  /** Getter accessor */
  Getter = 'getter',
  /** Setter accessor */
  Setter = 'setter',
  /** Function/method parameter */
  Parameter = 'parameter',
  /** Enum member */
  EnumMember = 'enum_member',
  /** Decorator (Python, TypeScript) */
  Decorator = 'decorator',
  /** Import statement */
  Import = 'import',
  /** Import from statement */
  ImportFrom = 'import_from',
  /** Module */
  Module = 'module'
}

/**
 * Modifiers that can be applied to symbols
 */
export type SymbolModifier =
  | 'export'
  | 'default'
  | 'async'
  | 'static'
  | 'readonly'
  | 'abstract'
  | 'private'
  | 'protected'
  | 'public'
  | 'declare'
  | 'const'
  | 'let'
  | 'var'
  | 'generator'
  | 'classmethod'
  | 'staticmethod'
  | 'property';

/**
 * Export kind for a symbol
 */
export type ExportKind = 'named' | 'default' | 'none';

/**
 * A symbol extracted from source code
 *
 * Represents a structural element like a function, class, or variable
 * with its location, modifiers, and optional nested children.
 */
export interface ExtractedSymbol {
  /** The name of the symbol (e.g., function name, class name) */
  name: string;

  /** The kind of symbol */
  kind: SymbolKind;

  /** Location in source code */
  location: Range;

  /** How this symbol is exported, if at all */
  exportKind: ExportKind;

  /** Modifiers applied to this symbol */
  modifiers: SymbolModifier[];

  /** JSDoc or documentation comment, if present */
  documentation?: string;

  /** Function/method signature (e.g., "(x: number, y: string): boolean") */
  signature?: string;

  /** Type annotation (e.g., ": string", ": MyInterface") */
  typeAnnotation?: string;

  /** Nested symbols (e.g., methods in a class, properties in an interface) */
  children?: ExtractedSymbol[];
}

/**
 * Options for symbol extraction
 */
export interface ExtractionOptions {
  /**
   * Whether to extract JSDoc/documentation comments
   * @default true
   */
  includeDocumentation?: boolean;

  /**
   * Whether to extract function/method signatures
   * @default true
   */
  includeSignatures?: boolean;

  /**
   * Whether to include private class members
   * @default true
   */
  includePrivate?: boolean;

  /**
   * Maximum nesting depth for child symbols (0 = no children, undefined = unlimited)
   * @default undefined (unlimited)
   */
  maxDepth?: number;

  /**
   * Filter to only extract specific symbol kinds
   * If not specified, all symbol kinds are extracted
   * @default undefined (all kinds)
   */
  symbolKinds?: SymbolKind[];

  /**
   * Whether to include import statements
   * @default false
   */
  includeImports?: boolean;

  /**
   * Whether to include decorators (for languages that support them)
   * @default true
   */
  includeDecorators?: boolean;
}

/**
 * Default extraction options
 */
export const DEFAULT_EXTRACTION_OPTIONS: Required<Omit<ExtractionOptions, 'maxDepth' | 'symbolKinds'>> & {
  maxDepth: number | undefined;
  symbolKinds: SymbolKind[] | undefined;
} = {
  includeDocumentation: true,
  includeSignatures: true,
  includePrivate: true,
  maxDepth: undefined,
  symbolKinds: undefined,
  includeImports: false,
  includeDecorators: true
};

/**
 * Result of a symbol extraction operation
 */
export interface ExtractionResult {
  /** Extracted symbols (top-level only, children are nested) */
  symbols: ExtractedSymbol[];

  /** Source file path, if extracted from a file */
  filePath?: string;

  /** The language of the source code */
  language: SupportedLanguage;

  /** Whether the source code had parse errors */
  hasErrors: boolean;

  /** Parse errors encountered (extraction may still succeed partially) */
  errors: ParseError[];

  /** Time taken to extract symbols in milliseconds */
  extractionTimeMs: number;

  /** Total number of symbols extracted (including nested children) */
  symbolCount?: number;
}

/**
 * Base interface for all symbol extractors
 *
 * Defines the contract that all language-specific extractors must implement.
 * This allows for consistent usage across different languages and enables
 * the factory pattern for obtaining the appropriate extractor.
 *
 * @example
 * ```typescript
 * // Using the factory to get an extractor
 * const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
 * const result = await extractor.extract(sourceCode, SupportedLanguage.TypeScript);
 *
 * // Or directly instantiate a specific extractor
 * const tsExtractor = TypeScriptExtractor.getInstance();
 * ```
 */
export interface SymbolExtractor {
  /**
   * Extract symbols from source code string
   *
   * @param sourceCode - The source code to extract symbols from
   * @param language - The programming language of the source code
   * @param options - Optional extraction configuration
   * @returns Promise resolving to extraction result with symbols and metadata
   * @throws {ExtractionError} If the language is not supported by this extractor
   */
  extract(
    sourceCode: string,
    language: SupportedLanguage,
    options?: ExtractionOptions
  ): Promise<ExtractionResult>;

  /**
   * Extract symbols from a file
   *
   * @param filePath - Path to the file to extract symbols from
   * @param options - Optional extraction configuration
   * @returns Promise resolving to extraction result with symbols and metadata
   * @throws {ExtractionError} If the file cannot be read or language is not supported
   */
  extractFromFile(
    filePath: string,
    options?: ExtractionOptions
  ): Promise<ExtractionResult>;
}

/**
 * Error thrown when symbol extraction fails
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ExtractionError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExtractionError);
    }
  }
}

/**
 * Languages supported by the TypeScript/JavaScript extractor
 */
export const TYPESCRIPT_EXTRACTOR_LANGUAGES = [
  'typescript',
  'tsx',
  'javascript'
] as const;

/**
 * Type guard to check if a language is supported by TypeScriptExtractor
 */
export function isTypeScriptExtractorLanguage(
  language: string
): language is (typeof TYPESCRIPT_EXTRACTOR_LANGUAGES)[number] {
  return (TYPESCRIPT_EXTRACTOR_LANGUAGES as readonly string[]).includes(language);
}

/**
 * Tree-sitter node types that represent extractable symbols in TypeScript/JavaScript
 */
export const EXTRACTABLE_NODE_TYPES = {
  // Functions
  FUNCTION_DECLARATION: 'function_declaration',
  FUNCTION_EXPRESSION: 'function_expression',
  ARROW_FUNCTION: 'arrow_function',
  GENERATOR_FUNCTION_DECLARATION: 'generator_function_declaration',

  // Classes
  CLASS_DECLARATION: 'class_declaration',
  CLASS_EXPRESSION: 'class_expression',

  // TypeScript-specific
  INTERFACE_DECLARATION: 'interface_declaration',
  TYPE_ALIAS_DECLARATION: 'type_alias_declaration',
  ENUM_DECLARATION: 'enum_declaration',

  // Variables
  LEXICAL_DECLARATION: 'lexical_declaration',
  VARIABLE_DECLARATION: 'variable_declaration',

  // Class members
  METHOD_DEFINITION: 'method_definition',
  PUBLIC_FIELD_DEFINITION: 'public_field_definition',
  FIELD_DEFINITION: 'field_definition',

  // Module
  EXPORT_STATEMENT: 'export_statement',
  EXPORT_CLAUSE: 'export_clause',

  // Comments (for documentation)
  COMMENT: 'comment',

  // Containers
  PROGRAM: 'program',
  STATEMENT_BLOCK: 'statement_block',
  CLASS_BODY: 'class_body',
  INTERFACE_BODY: 'interface_body',
  ENUM_BODY: 'enum_body'
} as const;

/**
 * Mapping of tree-sitter node types to SymbolKind
 */
export const NODE_TYPE_TO_SYMBOL_KIND: Record<string, SymbolKind> = {
  [EXTRACTABLE_NODE_TYPES.FUNCTION_DECLARATION]: SymbolKind.Function,
  [EXTRACTABLE_NODE_TYPES.GENERATOR_FUNCTION_DECLARATION]: SymbolKind.Function,
  [EXTRACTABLE_NODE_TYPES.ARROW_FUNCTION]: SymbolKind.ArrowFunction,
  [EXTRACTABLE_NODE_TYPES.CLASS_DECLARATION]: SymbolKind.Class,
  [EXTRACTABLE_NODE_TYPES.CLASS_EXPRESSION]: SymbolKind.Class,
  [EXTRACTABLE_NODE_TYPES.INTERFACE_DECLARATION]: SymbolKind.Interface,
  [EXTRACTABLE_NODE_TYPES.TYPE_ALIAS_DECLARATION]: SymbolKind.TypeAlias,
  [EXTRACTABLE_NODE_TYPES.ENUM_DECLARATION]: SymbolKind.Enum
};

/**
 * Languages supported by the Python extractor
 */
export const PYTHON_EXTRACTOR_LANGUAGES = [
  'python'
] as const;

/**
 * Type guard to check if a language is supported by PythonExtractor
 */
export function isPythonExtractorLanguage(
  language: string
): language is (typeof PYTHON_EXTRACTOR_LANGUAGES)[number] {
  return (PYTHON_EXTRACTOR_LANGUAGES as readonly string[]).includes(language);
}

/**
 * Tree-sitter node types that represent extractable symbols in Python
 */
export const PYTHON_EXTRACTABLE_NODE_TYPES = {
  // Functions
  FUNCTION_DEFINITION: 'function_definition',
  ASYNC_FUNCTION_DEFINITION: 'async_function_definition',

  // Classes
  CLASS_DEFINITION: 'class_definition',

  // Variables and assignments
  ASSIGNMENT: 'assignment',
  AUGMENTED_ASSIGNMENT: 'augmented_assignment',

  // Parameters
  PARAMETER: 'parameter',
  DEFAULT_PARAMETER: 'default_parameter',
  TYPED_PARAMETER: 'typed_parameter',
  TYPED_DEFAULT_PARAMETER: 'typed_default_parameter',

  // Imports
  IMPORT_STATEMENT: 'import_statement',
  IMPORT_FROM_STATEMENT: 'import_from_statement',

  // Decorators
  DECORATOR: 'decorator',

  // Comments (for documentation)
  COMMENT: 'comment',
  STRING: 'string', // Python docstrings

  // Containers
  MODULE: 'module',
  BLOCK: 'block'
} as const;

/**
 * Mapping of Python tree-sitter node types to SymbolKind
 */
export const PYTHON_NODE_TYPE_TO_SYMBOL_KIND: Record<string, SymbolKind> = {
  [PYTHON_EXTRACTABLE_NODE_TYPES.FUNCTION_DEFINITION]: SymbolKind.Function,
  [PYTHON_EXTRACTABLE_NODE_TYPES.ASYNC_FUNCTION_DEFINITION]: SymbolKind.Function,
  [PYTHON_EXTRACTABLE_NODE_TYPES.CLASS_DEFINITION]: SymbolKind.Class,
  [PYTHON_EXTRACTABLE_NODE_TYPES.ASSIGNMENT]: SymbolKind.Variable,
  [PYTHON_EXTRACTABLE_NODE_TYPES.AUGMENTED_ASSIGNMENT]: SymbolKind.Variable,
  [PYTHON_EXTRACTABLE_NODE_TYPES.PARAMETER]: SymbolKind.Parameter,
  [PYTHON_EXTRACTABLE_NODE_TYPES.DEFAULT_PARAMETER]: SymbolKind.Parameter,
  [PYTHON_EXTRACTABLE_NODE_TYPES.TYPED_PARAMETER]: SymbolKind.Parameter,
  [PYTHON_EXTRACTABLE_NODE_TYPES.TYPED_DEFAULT_PARAMETER]: SymbolKind.Parameter,
  [PYTHON_EXTRACTABLE_NODE_TYPES.IMPORT_STATEMENT]: SymbolKind.Import,
  [PYTHON_EXTRACTABLE_NODE_TYPES.IMPORT_FROM_STATEMENT]: SymbolKind.ImportFrom,
  [PYTHON_EXTRACTABLE_NODE_TYPES.DECORATOR]: SymbolKind.Decorator,
  [PYTHON_EXTRACTABLE_NODE_TYPES.MODULE]: SymbolKind.Module
};

/**
 * All languages that have extractor support
 */
export const SUPPORTED_EXTRACTOR_LANGUAGES = [
  ...TYPESCRIPT_EXTRACTOR_LANGUAGES,
  ...PYTHON_EXTRACTOR_LANGUAGES
] as const;

/**
 * Type for languages that have extractor support
 */
export type ExtractorSupportedLanguage = (typeof SUPPORTED_EXTRACTOR_LANGUAGES)[number];

/**
 * Check if a language has extractor support
 *
 * @param language - The language to check
 * @returns True if the language has a symbol extractor available
 */
export function hasExtractorSupport(language: string): language is ExtractorSupportedLanguage {
  return (SUPPORTED_EXTRACTOR_LANGUAGES as readonly string[]).includes(language);
}
