/**
 * Python Symbol Extractor
 *
 * Extracts structural information from Python source code using tree-sitter.
 * Supports functions, classes, constants, variables, decorators, and type annotations.
 *
 * Features:
 * - Extracts functions (regular and async)
 * - Extracts classes with methods and properties
 * - Extracts constants and variables
 * - Extracts type annotations from typed parameters
 * - Extracts docstrings as documentation
 * - Handles decorators (@property, @classmethod, @staticmethod, custom decorators)
 * - Singleton pattern for efficient reuse
 *
 * @example
 * ```typescript
 * const extractor = PythonExtractor.getInstance();
 * const result = await extractor.extract(pythonCode, SupportedLanguage.Python);
 * console.log(result.symbols);
 * ```
 */

import { promises as fs } from 'fs';
import type { SyntaxNode } from 'tree-sitter';
import {
  TreeSitterWrapper,
  SupportedLanguage,
  type ParseResult
} from '../parsers/index.js';
import {
  SymbolKind,
  type ExtractedSymbol,
  type ExtractionOptions,
  type ExtractionResult,
  type SymbolModifier,
  type ExportKind,
  DEFAULT_EXTRACTION_OPTIONS,
  ExtractionError,
  PYTHON_EXTRACTABLE_NODE_TYPES,
  PYTHON_NODE_TYPE_TO_SYMBOL_KIND,
  isPythonExtractorLanguage
} from './types.js';

/**
 * PythonExtractor class
 *
 * Extracts symbols from Python source code using tree-sitter.
 * Follows singleton pattern for efficient resource management.
 */
export class PythonExtractor {
  /** Singleton instance */
  private static instance: PythonExtractor | null = null;

  /** Tree-sitter wrapper for parsing */
  private wrapper: TreeSitterWrapper;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.wrapper = TreeSitterWrapper.getInstance();
  }

  /**
   * Get the singleton instance of PythonExtractor
   *
   * @returns The PythonExtractor singleton instance
   */
  public static getInstance(): PythonExtractor {
    if (!PythonExtractor.instance) {
      PythonExtractor.instance = new PythonExtractor();
    }
    return PythonExtractor.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    PythonExtractor.instance = null;
  }

  /**
   * Extract symbols from Python source code string
   *
   * @param sourceCode - The Python source code to analyze
   * @param language - Must be SupportedLanguage.Python
   * @param options - Extraction options
   * @returns Promise resolving to extraction result
   * @throws ExtractionError if language is not Python or extraction fails
   */
  public async extract(
    sourceCode: string,
    language: SupportedLanguage,
    options?: ExtractionOptions
  ): Promise<ExtractionResult> {
    if (!isPythonExtractorLanguage(language)) {
      throw new ExtractionError(
        `PythonExtractor only supports Python, got: ${language}`
      );
    }

    const startTime = performance.now();

    try {
      const parseResult = await this.wrapper.parse(sourceCode, language);
      const result = this.extractFromParseResult(parseResult, options);

      return {
        ...result,
        extractionTimeMs: performance.now() - startTime
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract symbols from Python source code: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extract symbols from a Python file
   *
   * @param filePath - Path to the Python file
   * @param options - Extraction options
   * @returns Promise resolving to extraction result
   * @throws ExtractionError if file read or extraction fails
   */
  public async extractFromFile(
    filePath: string,
    options?: ExtractionOptions
  ): Promise<ExtractionResult> {
    const startTime = performance.now();

    try {
      const sourceCode = await fs.readFile(filePath, 'utf-8');
      const result = await this.extract(sourceCode, SupportedLanguage.Python, options);

      return {
        ...result,
        filePath,
        extractionTimeMs: performance.now() - startTime
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract symbols from file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extract symbols from an existing parse result
   *
   * @param result - The parse result from tree-sitter
   * @param options - Extraction options
   * @returns Extraction result
   * @throws ExtractionError if extraction fails
   */
  public extractFromParseResult(
    result: ParseResult,
    options?: ExtractionOptions
  ): ExtractionResult {
    const startTime = performance.now();
    const effectiveOptions = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };

    try {
      const symbols = this.visitNode(result.rootNode, effectiveOptions, result.sourceCode, 0);

      return {
        symbols: symbols.children || [],
        language: result.language,
        hasErrors: result.hasErrors,
        errors: result.errors,
        extractionTimeMs: performance.now() - startTime,
        symbolCount: this.countSymbols(symbols.children || [])
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract symbols from parse result: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Visit a syntax node and extract symbols
   *
   * @param node - The syntax node to visit
   * @param options - Extraction options
   * @param sourceCode - Full source code (for extracting text)
   * @param depth - Current nesting depth
   * @returns Extracted symbol or null if node should be skipped
   */
  private visitNode(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string,
    depth: number
  ): ExtractedSymbol {
    // Handle depth limits
    if (options.maxDepth !== undefined && depth > options.maxDepth) {
      return this.createContainerSymbol(node, sourceCode, []);
    }

    const nodeType = node.type;
    const symbolKind = PYTHON_NODE_TYPE_TO_SYMBOL_KIND[nodeType];

    // If this is an extractable node, create a symbol
    if (symbolKind) {
      // Check if this symbol kind should be included
      if (options.symbolKinds && !options.symbolKinds.includes(symbolKind)) {
        return this.createContainerSymbol(node, sourceCode, []);
      }

      return this.extractSymbol(node, symbolKind, options, sourceCode, depth);
    }

    // For non-extractable nodes, visit children
    const children = this.visitChildren(node, options, sourceCode, depth);
    return this.createContainerSymbol(node, sourceCode, children);
  }

  /**
   * Visit all children of a node
   *
   * @param node - Parent node
   * @param options - Extraction options
   * @param sourceCode - Full source code
   * @param depth - Current depth
   * @returns Array of child symbols
   */
  private visitChildren(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string,
    depth: number
  ): ExtractedSymbol[] {
    const children: ExtractedSymbol[] = [];

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const childSymbol = this.visitNode(child, options, sourceCode, depth + 1);
        if (childSymbol.children && childSymbol.children.length > 0) {
          children.push(...childSymbol.children);
        } else if (childSymbol.kind !== SymbolKind.Module) {
          children.push(childSymbol);
        }
      }
    }

    return children;
  }

  /**
   * Extract a specific symbol from a node
   *
   * @param node - The syntax node
   * @param symbolKind - The kind of symbol to extract
   * @param options - Extraction options
   * @param sourceCode - Full source code
   * @param depth - Current depth
   * @returns Extracted symbol
   */
  private extractSymbol(
    node: SyntaxNode,
    symbolKind: SymbolKind,
    options: Required<ExtractionOptions>,
    sourceCode: string,
    depth: number
  ): ExtractedSymbol {
    switch (symbolKind) {
      case SymbolKind.Function:
        return this.extractFunction(node, options, sourceCode, depth);
      case SymbolKind.Class:
        return this.extractClass(node, options, sourceCode, depth);
      case SymbolKind.Variable:
        return this.extractVariable(node, options, sourceCode);
      case SymbolKind.Parameter:
        return this.extractParameter(node, options, sourceCode);
      case SymbolKind.Import:
        return this.extractImport(node, options, sourceCode);
      case SymbolKind.ImportFrom:
        return this.extractImportFrom(node, options, sourceCode);
      case SymbolKind.Decorator:
        return this.extractDecorator(node, options, sourceCode);
      default:
        return this.createBasicSymbol(node, symbolKind, sourceCode, []);
    }
  }

  /**
   * Extract a function or async function
   */
  private extractFunction(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string,
    depth: number
  ): ExtractedSymbol {
    const name = this.extractName(node);
    const modifiers: SymbolModifier[] = [];

    // Check if it's an async function
    if (node.type === PYTHON_EXTRACTABLE_NODE_TYPES.ASYNC_FUNCTION_DEFINITION) {
      modifiers.push('async');
    }

    // Extract decorators if enabled
    const decorators = options.includeDecorators ? this.extractDecorators(node, sourceCode) : [];
    modifiers.push(...this.getDecoratorsAsModifiers(decorators));

    // Extract signature if enabled
    const signature = options.includeSignatures ? this.extractFunctionSignature(node, sourceCode) : undefined;

    // Extract documentation if enabled
    const documentation = options.includeDocumentation ? this.extractDocumentation(node, sourceCode) : undefined;

    // Extract child symbols (parameters)
    const children = depth < (options.maxDepth ?? Number.MAX_SAFE_INTEGER) ?
      this.extractFunctionParameters(node, options, sourceCode) : [];

    return {
      name: name || '<anonymous>',
      kind: SymbolKind.Function,
      location: this.nodeToRange(node),
      exportKind: 'none', // Python doesn't have explicit exports like JS/TS
      modifiers,
      documentation,
      signature,
      children
    };
  }

  /**
   * Extract a class definition
   */
  private extractClass(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string,
    depth: number
  ): ExtractedSymbol {
    const name = this.extractName(node);
    const modifiers: SymbolModifier[] = [];

    // Extract decorators if enabled
    const decorators = options.includeDecorators ? this.extractDecorators(node, sourceCode) : [];
    modifiers.push(...this.getDecoratorsAsModifiers(decorators));

    // Extract documentation if enabled
    const documentation = options.includeDocumentation ? this.extractDocumentation(node, sourceCode) : undefined;

    // Extract child symbols (methods, properties) if within depth limit
    const children = depth < (options.maxDepth ?? Number.MAX_SAFE_INTEGER) ?
      this.extractClassMembers(node, options, sourceCode, depth + 1) : [];

    return {
      name: name || '<anonymous>',
      kind: SymbolKind.Class,
      location: this.nodeToRange(node),
      exportKind: 'none',
      modifiers,
      documentation,
      children
    };
  }

  /**
   * Extract a variable assignment
   */
  private extractVariable(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string
  ): ExtractedSymbol {
    const name = this.extractAssignmentTarget(node);
    const typeAnnotation = this.extractTypeAnnotation(node);

    // Determine if it's a constant (uppercase naming convention)
    const isConstant = name ? /^[A-Z_][A-Z0-9_]*$/.test(name) : false;
    const kind = isConstant ? SymbolKind.Constant : SymbolKind.Variable;

    return {
      name: name || '<unknown>',
      kind,
      location: this.nodeToRange(node),
      exportKind: 'none',
      modifiers: [],
      typeAnnotation
    };
  }

  /**
   * Extract a function parameter
   */
  private extractParameter(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string
  ): ExtractedSymbol {
    const name = this.extractName(node);
    const typeAnnotation = this.extractTypeAnnotation(node);

    return {
      name: name || '<unknown>',
      kind: SymbolKind.Parameter,
      location: this.nodeToRange(node),
      exportKind: 'none',
      modifiers: [],
      typeAnnotation
    };
  }

  /**
   * Extract an import statement
   */
  private extractImport(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string
  ): ExtractedSymbol {
    const name = this.extractImportName(node);

    return {
      name: name || '<unknown>',
      kind: SymbolKind.Import,
      location: this.nodeToRange(node),
      exportKind: 'none',
      modifiers: []
    };
  }

  /**
   * Extract an import from statement
   */
  private extractImportFrom(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string
  ): ExtractedSymbol {
    const name = this.extractImportFromName(node);

    return {
      name: name || '<unknown>',
      kind: SymbolKind.ImportFrom,
      location: this.nodeToRange(node),
      exportKind: 'none',
      modifiers: []
    };
  }

  /**
   * Extract a decorator
   */
  private extractDecorator(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string
  ): ExtractedSymbol {
    const name = this.extractDecoratorName(node);

    return {
      name: name || '<unknown>',
      kind: SymbolKind.Decorator,
      location: this.nodeToRange(node),
      exportKind: 'none',
      modifiers: []
    };
  }

  /**
   * Create a basic symbol for simple cases
   */
  private createBasicSymbol(
    node: SyntaxNode,
    kind: SymbolKind,
    sourceCode: string,
    modifiers: SymbolModifier[]
  ): ExtractedSymbol {
    return {
      name: this.extractName(node) || '<unknown>',
      kind,
      location: this.nodeToRange(node),
      exportKind: 'none',
      modifiers
    };
  }

  /**
   * Create a container symbol for grouping children
   */
  private createContainerSymbol(
    node: SyntaxNode,
    sourceCode: string,
    children: ExtractedSymbol[]
  ): ExtractedSymbol {
    return {
      name: '<container>',
      kind: SymbolKind.Module,
      location: this.nodeToRange(node),
      exportKind: 'none',
      modifiers: [],
      children
    };
  }

  // Helper methods for extracting specific node information

  /**
   * Extract the name from a named node
   */
  private extractName(node: SyntaxNode): string | undefined {
    // Try to find a child named 'identifier' or 'name'
    const nameChild = node.childForFieldName('name') ||
      node.children.find(child => child.type === 'identifier');

    return nameChild?.text;
  }

  /**
   * Extract assignment target name
   */
  private extractAssignmentTarget(node: SyntaxNode): string | undefined {
    const leftSide = node.child(0);
    return leftSide?.text;
  }

  /**
   * Extract import name
   */
  private extractImportName(node: SyntaxNode): string | undefined {
    // Look for the module name after 'import'
    const nameNode = node.children.find(child => child.type === 'dotted_name' || child.type === 'identifier');
    return nameNode?.text;
  }

  /**
   * Extract import from name
   */
  private extractImportFromName(node: SyntaxNode): string | undefined {
    // Look for the module name after 'from'
    const nameNode = node.children.find(child => child.type === 'dotted_name' || child.type === 'identifier');
    return nameNode?.text;
  }

  /**
   * Extract decorator name
   */
  private extractDecoratorName(node: SyntaxNode): string | undefined {
    // Decorators start with @ followed by an identifier or dotted name
    const nameNode = node.children.find(child =>
      child.type === 'identifier' || child.type === 'dotted_name' || child.type === 'call'
    );
    return nameNode?.text;
  }

  /**
   * Extract function signature
   */
  private extractFunctionSignature(node: SyntaxNode, sourceCode: string): string | undefined {
    const parametersNode = node.childForFieldName('parameters');
    const returnType = this.extractReturnType(node);

    if (parametersNode) {
      const params = parametersNode.text;
      return returnType ? `${params} -> ${returnType}` : params;
    }

    return undefined;
  }

  /**
   * Extract return type annotation
   */
  private extractReturnType(node: SyntaxNode): string | undefined {
    // Look for return type annotation after '->'
    const returnTypeNode = node.children.find(child =>
      child.type === 'type' || child.type === 'expression'
    );
    return returnTypeNode?.text;
  }

  /**
   * Extract type annotation from node
   */
  private extractTypeAnnotation(node: SyntaxNode): string | undefined {
    const typeNode = node.childForFieldName('type') ||
      node.children.find(child => child.type === 'type');
    return typeNode?.text;
  }

  /**
   * Extract decorators from a decorated node
   */
  private extractDecorators(node: SyntaxNode, sourceCode: string): string[] {
    const decorators: string[] = [];

    // Look for preceding decorator nodes
    let sibling = node.previousSibling;
    while (sibling && sibling.type === 'decorator') {
      decorators.unshift(sibling.text);
      sibling = sibling.previousSibling;
    }

    return decorators;
  }

  /**
   * Convert decorators to modifiers
   */
  private getDecoratorsAsModifiers(decorators: string[]): SymbolModifier[] {
    const modifiers: SymbolModifier[] = [];

    for (const decorator of decorators) {
      if (decorator.includes('@property')) {
        modifiers.push('property');
      } else if (decorator.includes('@classmethod')) {
        modifiers.push('classmethod');
      } else if (decorator.includes('@staticmethod')) {
        modifiers.push('staticmethod');
      }
    }

    return modifiers;
  }

  /**
   * Extract documentation from a node (docstrings)
   */
  private extractDocumentation(node: SyntaxNode, sourceCode: string): string | undefined {
    // Look for string literals at the beginning of the body (docstrings)
    const body = node.childForFieldName('body');
    if (body) {
      const firstChild = body.child(0);
      if (firstChild && firstChild.type === 'expression_statement') {
        const expr = firstChild.child(0);
        if (expr && expr.type === 'string') {
          return this.cleanDocstring(expr.text);
        }
      }
    }

    return undefined;
  }

  /**
   * Clean docstring text
   */
  private cleanDocstring(docstring: string): string {
    // Remove quotes and clean formatting
    return docstring
      .replace(/^["']{1,3}|["']{1,3}$/g, '') // Remove quotes
      .trim();
  }

  /**
   * Extract function parameters
   */
  private extractFunctionParameters(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string
  ): ExtractedSymbol[] {
    const parameters: ExtractedSymbol[] = [];
    const parametersNode = node.childForFieldName('parameters');

    if (parametersNode) {
      for (let i = 0; i < parametersNode.childCount; i++) {
        const child = parametersNode.child(i);
        if (child && (
          child.type === 'parameter' ||
          child.type === 'default_parameter' ||
          child.type === 'typed_parameter' ||
          child.type === 'typed_default_parameter'
        )) {
          parameters.push(this.extractParameter(child, options, sourceCode));
        }
      }
    }

    return parameters;
  }

  /**
   * Extract class members (methods and properties)
   */
  private extractClassMembers(
    node: SyntaxNode,
    options: Required<ExtractionOptions>,
    sourceCode: string,
    depth: number
  ): ExtractedSymbol[] {
    const members: ExtractedSymbol[] = [];
    const body = node.childForFieldName('body');

    if (body) {
      for (let i = 0; i < body.childCount; i++) {
        const child = body.child(i);
        if (child) {
          if (child.type === 'function_definition' || child.type === 'async_function_definition') {
            const func = this.extractFunction(child, options, sourceCode, depth);
            // Methods inside classes are methods, not functions
            members.push({
              ...func,
              kind: SymbolKind.Method
            });
          } else if (child.type === 'assignment') {
            const variable = this.extractVariable(child, options, sourceCode);
            // Variables inside classes are properties
            members.push({
              ...variable,
              kind: SymbolKind.Property
            });
          }
        }
      }
    }

    return members;
  }

  /**
   * Convert tree-sitter node to Range
   */
  private nodeToRange(node: SyntaxNode): import('./types.js').Range {
    return {
      start: {
        row: node.startPosition.row,
        column: node.startPosition.column
      },
      end: {
        row: node.endPosition.row,
        column: node.endPosition.column
      },
      startIndex: node.startIndex,
      endIndex: node.endIndex
    };
  }

  /**
   * Count total symbols recursively
   */
  private countSymbols(symbols: ExtractedSymbol[]): number {
    let count = symbols.length;
    for (const symbol of symbols) {
      if (symbol.children) {
        count += this.countSymbols(symbol.children);
      }
    }
    return count;
  }
}

/**
 * Get the singleton PythonExtractor instance (convenience function)
 *
 * @returns The PythonExtractor singleton instance
 */
export function getPythonExtractor(): PythonExtractor {
  return PythonExtractor.getInstance();
}