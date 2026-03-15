/**
 * TypeScript/JavaScript Symbol Extractor
 *
 * Extracts structural symbols (functions, classes, interfaces, types, etc.)
 * from TypeScript and JavaScript source code using tree-sitter AST parsing.
 *
 * Features:
 * - Extracts functions, classes, interfaces, types, constants, enums
 * - Handles both TypeScript (.ts, .tsx) and JavaScript (.js, .jsx)
 * - Extracts JSDoc documentation comments
 * - Captures function/method signatures and type annotations
 * - Supports nested symbol extraction (e.g., methods within classes)
 *
 * @example
 * ```typescript
 * const extractor = TypeScriptExtractor.getInstance();
 * const result = await extractor.extract(`
 *   export function hello(name: string): string {
 *     return 'Hello, ' + name;
 *   }
 * `, SupportedLanguage.TypeScript);
 *
 * console.log(result.symbols[0].name); // 'hello'
 * console.log(result.symbols[0].kind); // 'function'
 * ```
 */

import type { SyntaxNode } from 'tree-sitter';
import {
  TreeSitterWrapper,
  type ParseResult,
  type Range,
  SupportedLanguage
} from '../parsers/index.js';
import {
  SymbolKind,
  type SymbolModifier,
  type ExportKind,
  type ExtractedSymbol,
  type ExtractionOptions,
  type ExtractionResult,
  ExtractionError,
  DEFAULT_EXTRACTION_OPTIONS,
  EXTRACTABLE_NODE_TYPES,
  isTypeScriptExtractorLanguage
} from './types.js';

// Re-export types for convenience
export * from './types.js';

/**
 * Resolved extraction options with all defaults applied
 */
type ResolvedExtractionOptions = Required<Omit<ExtractionOptions, 'maxDepth' | 'symbolKinds'>> & {
  maxDepth: number | undefined;
  symbolKinds: SymbolKind[] | undefined;
};

/**
 * TypeScript and JavaScript symbol extractor
 *
 * Provides symbol extraction from TypeScript and JavaScript source code
 * using tree-sitter AST parsing. Implements the singleton pattern for
 * efficient reuse across multiple extractions.
 */
export class TypeScriptExtractor {
  /** Singleton instance */
  private static instance: TypeScriptExtractor | null = null;

  /** Tree-sitter wrapper for AST parsing */
  private wrapper: TreeSitterWrapper;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.wrapper = TreeSitterWrapper.getInstance();
  }

  /**
   * Get the singleton instance of TypeScriptExtractor
   *
   * @returns The TypeScriptExtractor singleton instance
   */
  public static getInstance(): TypeScriptExtractor {
    if (!TypeScriptExtractor.instance) {
      TypeScriptExtractor.instance = new TypeScriptExtractor();
    }
    return TypeScriptExtractor.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    TypeScriptExtractor.instance = null;
  }

  /**
   * Extract symbols from source code
   *
   * @param sourceCode - The source code to extract symbols from
   * @param language - The programming language (must be TypeScript, TSX, or JavaScript)
   * @param options - Extraction options
   * @returns ExtractionResult containing extracted symbols and metadata
   * @throws {ExtractionError} If the language is not supported
   *
   * @example
   * ```typescript
   * const extractor = TypeScriptExtractor.getInstance();
   * const result = await extractor.extract(
   *   'const PI = 3.14159;',
   *   SupportedLanguage.JavaScript
   * );
   * ```
   */
  public async extract(
    sourceCode: string,
    language: SupportedLanguage,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    // Validate language
    if (!isTypeScriptExtractorLanguage(language)) {
      throw new ExtractionError(
        `TypeScriptExtractor only supports TypeScript, TSX, and JavaScript. Got: ${language}`
      );
    }

    const startTime = performance.now();

    // Parse the source code
    const parseResult = await this.wrapper.parse(sourceCode, language);

    // Extract symbols from the parse result
    const result = this.extractFromParseResult(parseResult, options);

    result.extractionTimeMs = performance.now() - startTime;

    return result;
  }

  /**
   * Extract symbols from a file
   *
   * @param filePath - Path to the file to extract symbols from
   * @param options - Extraction options
   * @returns ExtractionResult containing extracted symbols and metadata
   * @throws {ExtractionError} If the file cannot be read or language is not supported
   *
   * @example
   * ```typescript
   * const extractor = TypeScriptExtractor.getInstance();
   * const result = await extractor.extractFromFile('/path/to/component.tsx');
   * ```
   */
  public async extractFromFile(
    filePath: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = performance.now();

    try {
      // Parse the file (wrapper handles language detection)
      const parseResult = await this.wrapper.parseFile(filePath);

      // Validate language
      if (!isTypeScriptExtractorLanguage(parseResult.language)) {
        throw new ExtractionError(
          `TypeScriptExtractor only supports TypeScript, TSX, and JavaScript. Got: ${parseResult.language}`,
          filePath
        );
      }

      // Extract symbols from the parse result
      const result = this.extractFromParseResult(parseResult, options);

      result.filePath = filePath;
      result.extractionTimeMs = performance.now() - startTime;

      return result;
    } catch (error) {
      if (error instanceof ExtractionError) {
        throw error;
      }
      throw new ExtractionError(
        `Failed to extract symbols from file: ${filePath}`,
        filePath,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Extract symbols from a ParseResult
   *
   * This is useful when you already have a parsed AST and want to extract
   * symbols without re-parsing.
   *
   * @param parseResult - The parse result from TreeSitterWrapper
   * @param options - Extraction options
   * @returns ExtractionResult containing extracted symbols
   */
  public extractFromParseResult(
    parseResult: ParseResult,
    options: ExtractionOptions = {}
  ): ExtractionResult {
    const opts = this.resolveOptions(options);
    const startTime = performance.now();

    // Extract top-level symbols
    const symbols = this.extractTopLevelSymbols(
      parseResult.rootNode,
      parseResult.sourceCode,
      opts,
      0
    );

    return {
      symbols,
      language: parseResult.language,
      hasErrors: parseResult.hasErrors,
      errors: parseResult.errors,
      extractionTimeMs: performance.now() - startTime
    };
  }

  /**
   * Resolve extraction options with defaults
   */
  private resolveOptions(options: ExtractionOptions): ResolvedExtractionOptions {
    return {
      ...DEFAULT_EXTRACTION_OPTIONS,
      ...options
    };
  }

  /**
   * Extract top-level symbols from a node
   */
  private extractTopLevelSymbols(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    depth: number
  ): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Iterate through children of the root/container node
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;

      const symbol = this.visitNode(child, sourceCode, options, depth, node, i);
      if (symbol) {
        // Filter by symbol kinds if specified
        if (!options.symbolKinds || options.symbolKinds.includes(symbol.kind)) {
          symbols.push(symbol);
        }
      }
    }

    return symbols;
  }

  /**
   * Visit a node and extract symbol if applicable
   */
  private visitNode(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    depth: number,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol | null {
    const nodeType = node.type;

    switch (nodeType) {
      // Export statement - need to look inside
      case EXTRACTABLE_NODE_TYPES.EXPORT_STATEMENT:
        return this.extractExportStatement(node, sourceCode, options, depth);

      // Function declarations
      case EXTRACTABLE_NODE_TYPES.FUNCTION_DECLARATION:
      case EXTRACTABLE_NODE_TYPES.GENERATOR_FUNCTION_DECLARATION:
        return this.extractFunction(node, sourceCode, options, parentNode, siblingIndex);

      // Class declarations
      case EXTRACTABLE_NODE_TYPES.CLASS_DECLARATION:
        return this.extractClass(node, sourceCode, options, depth, parentNode, siblingIndex);

      // TypeScript-specific declarations
      case EXTRACTABLE_NODE_TYPES.INTERFACE_DECLARATION:
        return this.extractInterface(node, sourceCode, options, depth, parentNode, siblingIndex);

      case EXTRACTABLE_NODE_TYPES.TYPE_ALIAS_DECLARATION:
        return this.extractTypeAlias(node, sourceCode, options, parentNode, siblingIndex);

      case EXTRACTABLE_NODE_TYPES.ENUM_DECLARATION:
        return this.extractEnum(node, sourceCode, options, depth, parentNode, siblingIndex);

      // Variable declarations
      case EXTRACTABLE_NODE_TYPES.LEXICAL_DECLARATION:
      case EXTRACTABLE_NODE_TYPES.VARIABLE_DECLARATION:
        return this.extractVariableDeclaration(node, sourceCode, options, parentNode, siblingIndex);

      default:
        return null;
    }
  }

  /**
   * Extract from an export statement
   */
  private extractExportStatement(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    depth: number
  ): ExtractedSymbol | null {
    // Find the declaration inside the export
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;

      const symbol = this.visitNode(child, sourceCode, options, depth, node, i);
      if (symbol) {
        // Mark as exported
        symbol.exportKind = this.getExportKind(node);
        if (!symbol.modifiers.includes('export')) {
          symbol.modifiers = ['export', ...symbol.modifiers];
        }
        if (symbol.exportKind === 'default' && !symbol.modifiers.includes('default')) {
          symbol.modifiers = ['default', ...symbol.modifiers.filter(m => m !== 'export'), 'export'];
          // Reorder: put 'export' and 'default' first
          symbol.modifiers = [
            ...symbol.modifiers.filter(m => m === 'export' || m === 'default'),
            ...symbol.modifiers.filter(m => m !== 'export' && m !== 'default')
          ];
        }
        return symbol;
      }
    }

    return null;
  }

  /**
   * Extract a function declaration
   */
  private extractFunction(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol {
    const name = this.getNodeName(node) || '<anonymous>';
    const modifiers = this.getModifiers(node);
    const isGenerator = node.type === EXTRACTABLE_NODE_TYPES.GENERATOR_FUNCTION_DECLARATION;

    if (isGenerator && !modifiers.includes('generator')) {
      modifiers.push('generator');
    }

    const symbol: ExtractedSymbol = {
      name,
      kind: SymbolKind.Function,
      location: this.toRange(node),
      exportKind: 'none',
      modifiers
    };

    if (options.includeDocumentation) {
      symbol.documentation = this.getDocumentation(node, sourceCode, parentNode, siblingIndex);
    }

    if (options.includeSignatures) {
      symbol.signature = this.getFunctionSignature(node);
      symbol.typeAnnotation = this.getReturnType(node);
    }

    return symbol;
  }

  /**
   * Extract a class declaration
   */
  private extractClass(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    depth: number,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol {
    const name = this.getNodeName(node) || '<anonymous>';
    const modifiers = this.getModifiers(node);

    const symbol: ExtractedSymbol = {
      name,
      kind: SymbolKind.Class,
      location: this.toRange(node),
      exportKind: 'none',
      modifiers
    };

    if (options.includeDocumentation) {
      symbol.documentation = this.getDocumentation(node, sourceCode, parentNode, siblingIndex);
    }

    // Extract class members if depth allows
    if (options.maxDepth === undefined || depth < options.maxDepth) {
      const classBody = node.childForFieldName('body');
      if (classBody) {
        symbol.children = this.extractClassMembers(classBody, sourceCode, options, depth + 1);
      }
    }

    return symbol;
  }

  /**
   * Extract class members (methods, properties, constructor)
   */
  private extractClassMembers(
    classBody: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    depth: number
  ): ExtractedSymbol[] {
    const members: ExtractedSymbol[] = [];

    for (let i = 0; i < classBody.childCount; i++) {
      const child = classBody.child(i);
      if (!child) continue;

      const member = this.extractClassMember(child, sourceCode, options, classBody, i);
      if (member) {
        // Filter private members if requested
        if (!options.includePrivate && this.isPrivateMember(member)) {
          continue;
        }
        // Filter by symbol kinds if specified
        if (!options.symbolKinds || options.symbolKinds.includes(member.kind)) {
          members.push(member);
        }
      }
    }

    return members;
  }

  /**
   * Extract a single class member
   */
  private extractClassMember(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol | null {
    const nodeType = node.type;

    switch (nodeType) {
      case EXTRACTABLE_NODE_TYPES.METHOD_DEFINITION:
        return this.extractMethod(node, sourceCode, options, parentNode, siblingIndex);

      case EXTRACTABLE_NODE_TYPES.PUBLIC_FIELD_DEFINITION:
      case EXTRACTABLE_NODE_TYPES.FIELD_DEFINITION:
        return this.extractProperty(node, sourceCode, options, parentNode, siblingIndex);

      default:
        return null;
    }
  }

  /**
   * Extract a method definition
   */
  private extractMethod(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol {
    const name = this.getMethodName(node);
    const modifiers = this.getModifiers(node);

    // Determine method kind
    let kind = SymbolKind.Method;
    const kindText = this.getChildText(node, 'kind');
    if (kindText === 'get') {
      kind = SymbolKind.Getter;
    } else if (kindText === 'set') {
      kind = SymbolKind.Setter;
    } else if (name === 'constructor') {
      kind = SymbolKind.Constructor;
    }

    const symbol: ExtractedSymbol = {
      name,
      kind,
      location: this.toRange(node),
      exportKind: 'none',
      modifiers
    };

    if (options.includeDocumentation) {
      symbol.documentation = this.getDocumentation(node, sourceCode, parentNode, siblingIndex);
    }

    if (options.includeSignatures) {
      symbol.signature = this.getFunctionSignature(node);
      symbol.typeAnnotation = this.getReturnType(node);
    }

    return symbol;
  }

  /**
   * Extract a class property/field
   */
  private extractProperty(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol {
    const name = this.getPropertyName(node);
    const modifiers = this.getModifiers(node);

    const symbol: ExtractedSymbol = {
      name,
      kind: SymbolKind.Property,
      location: this.toRange(node),
      exportKind: 'none',
      modifiers
    };

    if (options.includeDocumentation) {
      symbol.documentation = this.getDocumentation(node, sourceCode, parentNode, siblingIndex);
    }

    if (options.includeSignatures) {
      symbol.typeAnnotation = this.getPropertyType(node);
    }

    return symbol;
  }

  /**
   * Extract an interface declaration
   */
  private extractInterface(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    depth: number,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol {
    const name = this.getNodeName(node) || '<anonymous>';
    const modifiers = this.getModifiers(node);

    const symbol: ExtractedSymbol = {
      name,
      kind: SymbolKind.Interface,
      location: this.toRange(node),
      exportKind: 'none',
      modifiers
    };

    if (options.includeDocumentation) {
      symbol.documentation = this.getDocumentation(node, sourceCode, parentNode, siblingIndex);
    }

    // Extract interface members if depth allows
    if (options.maxDepth === undefined || depth < options.maxDepth) {
      const interfaceBody = this.findChildByType(node, 'interface_body') ||
                           this.findChildByType(node, 'object_type');
      if (interfaceBody) {
        symbol.children = this.extractInterfaceMembers(interfaceBody, sourceCode, options, depth + 1);
      }
    }

    return symbol;
  }

  /**
   * Extract interface members
   */
  private extractInterfaceMembers(
    interfaceBody: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    depth: number
  ): ExtractedSymbol[] {
    const members: ExtractedSymbol[] = [];

    for (let i = 0; i < interfaceBody.childCount; i++) {
      const child = interfaceBody.child(i);
      if (!child) continue;

      // Property signatures and method signatures
      if (child.type === 'property_signature' || child.type === 'method_signature') {
        const name = this.getInterfaceMemberName(child);
        if (name) {
          const kind = child.type === 'method_signature' ? SymbolKind.Method : SymbolKind.Property;
          const symbol: ExtractedSymbol = {
            name,
            kind,
            location: this.toRange(child),
            exportKind: 'none',
            modifiers: this.getModifiers(child)
          };

          if (options.includeSignatures) {
            if (child.type === 'method_signature') {
              symbol.signature = this.getFunctionSignature(child);
              symbol.typeAnnotation = this.getReturnType(child);
            } else {
              symbol.typeAnnotation = this.getPropertyType(child);
            }
          }

          // Filter by symbol kinds if specified
          if (!options.symbolKinds || options.symbolKinds.includes(symbol.kind)) {
            members.push(symbol);
          }
        }
      }
    }

    return members;
  }

  /**
   * Extract a type alias declaration
   */
  private extractTypeAlias(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol {
    const name = this.getNodeName(node) || '<anonymous>';
    const modifiers = this.getModifiers(node);

    const symbol: ExtractedSymbol = {
      name,
      kind: SymbolKind.TypeAlias,
      location: this.toRange(node),
      exportKind: 'none',
      modifiers
    };

    if (options.includeDocumentation) {
      symbol.documentation = this.getDocumentation(node, sourceCode, parentNode, siblingIndex);
    }

    if (options.includeSignatures) {
      symbol.typeAnnotation = this.getTypeAliasValue(node);
    }

    return symbol;
  }

  /**
   * Extract an enum declaration
   */
  private extractEnum(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    depth: number,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol {
    const name = this.getNodeName(node) || '<anonymous>';
    const modifiers = this.getModifiers(node);

    const symbol: ExtractedSymbol = {
      name,
      kind: SymbolKind.Enum,
      location: this.toRange(node),
      exportKind: 'none',
      modifiers
    };

    if (options.includeDocumentation) {
      symbol.documentation = this.getDocumentation(node, sourceCode, parentNode, siblingIndex);
    }

    // Extract enum members if depth allows
    if (options.maxDepth === undefined || depth < options.maxDepth) {
      const enumBody = this.findChildByType(node, 'enum_body');
      if (enumBody) {
        symbol.children = this.extractEnumMembers(enumBody, sourceCode, options);
      }
    }

    return symbol;
  }

  /**
   * Extract enum members
   */
  private extractEnumMembers(
    enumBody: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions
  ): ExtractedSymbol[] {
    const members: ExtractedSymbol[] = [];

    for (let i = 0; i < enumBody.childCount; i++) {
      const child = enumBody.child(i);
      if (!child) continue;

      if (child.type === 'enum_assignment' || child.type === 'property_identifier') {
        const name = child.type === 'enum_assignment'
          ? this.getChildText(child, 'name') || this.getFirstIdentifier(child)
          : child.text;

        if (name) {
          const symbol: ExtractedSymbol = {
            name,
            kind: SymbolKind.EnumMember,
            location: this.toRange(child),
            exportKind: 'none',
            modifiers: []
          };

          // Filter by symbol kinds if specified
          if (!options.symbolKinds || options.symbolKinds.includes(symbol.kind)) {
            members.push(symbol);
          }
        }
      }
    }

    return members;
  }

  /**
   * Extract a variable declaration (const/let/var)
   */
  private extractVariableDeclaration(
    node: SyntaxNode,
    sourceCode: string,
    options: ResolvedExtractionOptions,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): ExtractedSymbol | null {
    // Get the variable kind (const/let/var)
    const kindNode = node.child(0);
    if (!kindNode) return null;

    const kindText = kindNode.text.toLowerCase();
    const isConst = kindText === 'const';

    // Find the variable declarator
    const declarator = this.findChildByType(node, 'variable_declarator');
    if (!declarator) return null;

    const name = this.getDeclaratorName(declarator);
    if (!name) return null;

    const modifiers: SymbolModifier[] = [];
    if (isConst) {
      modifiers.push('const');
    } else if (kindText === 'let') {
      modifiers.push('let');
    } else {
      modifiers.push('var');
    }

    // Check if this is an arrow function or function expression
    const value = declarator.childForFieldName('value');
    if (value) {
      if (value.type === EXTRACTABLE_NODE_TYPES.ARROW_FUNCTION ||
          value.type === EXTRACTABLE_NODE_TYPES.FUNCTION_EXPRESSION) {
        // Extract as arrow function with the variable name
        const symbol: ExtractedSymbol = {
          name,
          kind: SymbolKind.ArrowFunction,
          location: this.toRange(node),
          exportKind: 'none',
          modifiers
        };

        if (options.includeDocumentation) {
          symbol.documentation = this.getDocumentation(node, sourceCode, parentNode, siblingIndex);
        }

        if (options.includeSignatures) {
          symbol.signature = this.getFunctionSignature(value);
          symbol.typeAnnotation = this.getReturnType(value);
        }

        return symbol;
      }
    }

    // Regular constant or variable
    const symbol: ExtractedSymbol = {
      name,
      kind: isConst ? SymbolKind.Constant : SymbolKind.Variable,
      location: this.toRange(node),
      exportKind: 'none',
      modifiers
    };

    if (options.includeDocumentation) {
      symbol.documentation = this.getDocumentation(node, sourceCode, parentNode, siblingIndex);
    }

    if (options.includeSignatures) {
      symbol.typeAnnotation = this.getDeclaratorType(declarator);
    }

    return symbol;
  }

  // ============================================================
  // Utility methods
  // ============================================================

  /**
   * Get the name of a node (function, class, interface, etc.)
   */
  private getNodeName(node: SyntaxNode): string | undefined {
    // Try field name first
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return nameNode.text;
    }

    // Look for identifier child
    const identifier = this.findChildByType(node, 'identifier') ||
                       this.findChildByType(node, 'type_identifier');
    return identifier?.text;
  }

  /**
   * Get method name (handles computed properties)
   */
  private getMethodName(node: SyntaxNode): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return nameNode.text;
    }

    // Look for property_identifier or computed_property_name
    const propId = this.findChildByType(node, 'property_identifier');
    if (propId) {
      return propId.text;
    }

    return '<anonymous>';
  }

  /**
   * Get property name
   */
  private getPropertyName(node: SyntaxNode): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return nameNode.text;
    }

    const propId = this.findChildByType(node, 'property_identifier') ||
                   this.findChildByType(node, 'private_property_identifier');
    return propId?.text || '<anonymous>';
  }

  /**
   * Get interface member name
   */
  private getInterfaceMemberName(node: SyntaxNode): string | undefined {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return nameNode.text;
    }

    const propId = this.findChildByType(node, 'property_identifier');
    return propId?.text;
  }

  /**
   * Get declarator name (from variable_declarator)
   */
  private getDeclaratorName(node: SyntaxNode): string | undefined {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      // Could be identifier or destructuring pattern
      if (nameNode.type === 'identifier') {
        return nameNode.text;
      }
    }

    const identifier = this.findChildByType(node, 'identifier');
    return identifier?.text;
  }

  /**
   * Get modifiers from a node
   */
  private getModifiers(node: SyntaxNode): SymbolModifier[] {
    const modifiers: SymbolModifier[] = [];

    // Check for accessibility modifiers
    const accessibility = node.childForFieldName('accessibility');
    if (accessibility) {
      const mod = accessibility.text as SymbolModifier;
      if (['public', 'private', 'protected'].includes(mod)) {
        modifiers.push(mod);
      }
    }

    // Check for other modifiers by looking at children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;

      const text = child.text.toLowerCase();
      if (child.type === 'async') {
        modifiers.push('async');
      } else if (text === 'static') {
        modifiers.push('static');
      } else if (text === 'readonly') {
        modifiers.push('readonly');
      } else if (text === 'abstract') {
        modifiers.push('abstract');
      } else if (text === 'declare') {
        modifiers.push('declare');
      } else if (text === 'public') {
        if (!modifiers.includes('public')) modifiers.push('public');
      } else if (text === 'private') {
        if (!modifiers.includes('private')) modifiers.push('private');
      } else if (text === 'protected') {
        if (!modifiers.includes('protected')) modifiers.push('protected');
      }
    }

    return modifiers;
  }

  /**
   * Get export kind from an export statement
   */
  private getExportKind(node: SyntaxNode): ExportKind {
    if (node.type !== EXTRACTABLE_NODE_TYPES.EXPORT_STATEMENT) {
      return 'none';
    }

    // Check for 'default' keyword
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.text === 'default') {
        return 'default';
      }
    }

    return 'named';
  }

  /**
   * Get documentation comment for a node
   */
  private getDocumentation(
    node: SyntaxNode,
    sourceCode: string,
    parentNode?: SyntaxNode,
    siblingIndex?: number
  ): string | undefined {
    // Look for preceding comment sibling
    if (parentNode && siblingIndex !== undefined && siblingIndex > 0) {
      const prevSibling = parentNode.child(siblingIndex - 1);
      if (prevSibling?.type === 'comment') {
        const commentText = prevSibling.text;
        // Check if it's a JSDoc comment
        if (commentText.startsWith('/**')) {
          return this.parseJSDocComment(commentText);
        }
      }
    }

    // Also check for attached comments in the source
    const startLine = node.startPosition.row;
    if (startLine > 0) {
      // Look backwards in the source for a comment
      const lines = sourceCode.split('\n');
      let commentLines: string[] = [];
      let lineIdx = startLine - 1;

      while (lineIdx >= 0) {
        const line = lines[lineIdx].trim();
        if (line.endsWith('*/')) {
          // Found end of block comment, look for start
          while (lineIdx >= 0) {
            const l = lines[lineIdx];
            commentLines.unshift(l);
            if (l.includes('/**')) {
              const fullComment = commentLines.join('\n').trim();
              return this.parseJSDocComment(fullComment);
            }
            lineIdx--;
          }
          break;
        } else if (line === '' || line.startsWith('*')) {
          // Could be middle of JSDoc
          commentLines.unshift(lines[lineIdx]);
          lineIdx--;
        } else {
          break;
        }
      }
    }

    return undefined;
  }

  /**
   * Parse JSDoc comment and extract content
   */
  private parseJSDocComment(comment: string): string {
    // Remove /** and */
    let content = comment
      .replace(/^\/\*\*\s*/, '')
      .replace(/\s*\*\/$/, '');

    // Remove leading * from each line
    const lines = content.split('\n').map(line => {
      return line.replace(/^\s*\*\s?/, '');
    });

    return lines.join('\n').trim();
  }

  /**
   * Get function signature (parameters)
   */
  private getFunctionSignature(node: SyntaxNode): string | undefined {
    const params = node.childForFieldName('parameters');
    if (params) {
      return params.text;
    }

    // Look for formal_parameters
    const formalParams = this.findChildByType(node, 'formal_parameters');
    return formalParams?.text;
  }

  /**
   * Get return type annotation
   */
  private getReturnType(node: SyntaxNode): string | undefined {
    const returnType = node.childForFieldName('return_type');
    if (returnType) {
      return returnType.text;
    }

    // Look for type_annotation after parameters
    const typeAnnotation = this.findChildByType(node, 'type_annotation');
    return typeAnnotation?.text;
  }

  /**
   * Get property type annotation
   */
  private getPropertyType(node: SyntaxNode): string | undefined {
    const typeNode = node.childForFieldName('type');
    if (typeNode) {
      return typeNode.text;
    }

    const typeAnnotation = this.findChildByType(node, 'type_annotation');
    return typeAnnotation?.text;
  }

  /**
   * Get declarator type annotation
   */
  private getDeclaratorType(node: SyntaxNode): string | undefined {
    const typeNode = node.childForFieldName('type');
    if (typeNode) {
      return typeNode.text;
    }

    const typeAnnotation = this.findChildByType(node, 'type_annotation');
    return typeAnnotation?.text;
  }

  /**
   * Get type alias value (the type being aliased)
   */
  private getTypeAliasValue(node: SyntaxNode): string | undefined {
    const value = node.childForFieldName('value');
    if (value) {
      return value.text;
    }

    // Look for type_annotation or the actual type
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type.includes('type') && child.type !== 'type_identifier') {
        return child.text;
      }
    }

    return undefined;
  }

  /**
   * Check if a member is private
   */
  private isPrivateMember(symbol: ExtractedSymbol): boolean {
    return symbol.modifiers.includes('private') ||
           symbol.name.startsWith('#') ||
           symbol.name.startsWith('_');
  }

  /**
   * Find first child of a specific type
   */
  private findChildByType(node: SyntaxNode, type: string): SyntaxNode | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === type) {
        return child;
      }
    }
    return null;
  }

  /**
   * Get text of a named child field
   */
  private getChildText(node: SyntaxNode, fieldName: string): string | undefined {
    const child = node.childForFieldName(fieldName);
    return child?.text;
  }

  /**
   * Get first identifier in a node
   */
  private getFirstIdentifier(node: SyntaxNode): string | undefined {
    const identifier = this.findChildByType(node, 'identifier') ||
                       this.findChildByType(node, 'property_identifier');
    return identifier?.text;
  }

  /**
   * Convert a SyntaxNode to a Range
   */
  private toRange(node: SyntaxNode): Range {
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
}

/**
 * Convenience function to get the TypeScriptExtractor instance
 *
 * @returns The TypeScriptExtractor singleton instance
 */
export function getTypeScriptExtractor(): TypeScriptExtractor {
  return TypeScriptExtractor.getInstance();
}
