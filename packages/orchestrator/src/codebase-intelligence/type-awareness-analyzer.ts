/**
 * TypeAwarenessAnalyzer - Advanced TypeScript Type Information Extraction
 *
 * Extracts and analyzes TypeScript type annotations, interfaces, type aliases,
 * generics, and type relationships from TypeScript source code. This analyzer
 * enhances the basic symbol extraction with deep type information for better
 * code understanding.
 *
 * Features:
 * - Extracts type annotations from variables, functions, properties
 * - Analyzes interfaces and their inheritance relationships
 * - Captures type aliases and their definitions
 * - Handles generic type parameters and constraints
 * - Identifies union types, intersection types, and mapped types
 * - Tracks type imports and exports
 * - Builds type dependency graphs
 *
 * @example
 * ```typescript
 * const analyzer = TypeAwarenessAnalyzer.getInstance();
 * const typeInfo = await analyzer.analyzeFile('/path/to/file.ts');
 *
 * console.log(`Found ${typeInfo.interfaces.length} interfaces`);
 * console.log(`Found ${typeInfo.typeAliases.length} type aliases`);
 * console.log(`Found ${typeInfo.generics.length} generic types`);
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { SyntaxNode } from 'tree-sitter';
import {
  TreeSitterWrapper,
  type ParseResult,
  type Range,
  SupportedLanguage
} from './parsers/index.js';
import {
  SymbolKind,
  type SymbolModifier,
  type ExportKind,
  type ExtractedSymbol,
  type ExtractionOptions,
  type ExtractionResult
} from './extractors/types.js';
import type {
  RepositoryMap,
  CodeFile,
  CodeSymbol
} from '@apexcli/core';

/**
 * Represents a TypeScript interface definition
 */
export interface TypeScriptInterface {
  /** Interface name */
  name: string;
  /** File where interface is defined */
  filePath: string;
  /** Line number where interface starts */
  startLine: number;
  /** Line number where interface ends */
  endLine: number;
  /** Properties defined in the interface */
  properties: InterfaceProperty[];
  /** Interfaces this interface extends */
  extends: string[];
  /** Generic type parameters */
  typeParameters: TypeParameter[];
  /** JSDoc documentation */
  documentation?: string;
  /** Whether this interface is exported */
  exported: boolean;
  /** Export kind (default, named, etc.) */
  exportKind: ExportKind;
  /** Access modifiers */
  modifiers: SymbolModifier[];
}

/**
 * Represents a property in an interface or class
 */
export interface InterfaceProperty {
  /** Property name */
  name: string;
  /** Property type annotation */
  type: TypeAnnotation;
  /** Whether property is optional */
  optional: boolean;
  /** Whether property is readonly */
  readonly: boolean;
  /** Property documentation */
  documentation?: string;
  /** Line number where property is defined */
  line: number;
}

/**
 * Represents a TypeScript type alias
 */
export interface TypeAlias {
  /** Type alias name */
  name: string;
  /** File where type alias is defined */
  filePath: string;
  /** Line number where type alias starts */
  startLine: number;
  /** Line number where type alias ends */
  endLine: number;
  /** The actual type definition */
  definition: TypeAnnotation;
  /** Generic type parameters */
  typeParameters: TypeParameter[];
  /** JSDoc documentation */
  documentation?: string;
  /** Whether this type is exported */
  exported: boolean;
  /** Export kind */
  exportKind: ExportKind;
}

/**
 * Represents a generic type parameter
 */
export interface TypeParameter {
  /** Parameter name */
  name: string;
  /** Constraint type (extends clause) */
  constraint?: TypeAnnotation;
  /** Default type */
  defaultType?: TypeAnnotation;
  /** Parameter documentation */
  documentation?: string;
}

/**
 * Represents a type annotation with detailed information
 */
export interface TypeAnnotation {
  /** Raw type string as written in code */
  raw: string;
  /** Normalized type string */
  normalized: string;
  /** Type kind/category */
  kind: TypeKind;
  /** Generic type arguments */
  typeArguments: TypeAnnotation[];
  /** Union type members (for union types) */
  unionMembers: TypeAnnotation[];
  /** Intersection type members (for intersection types) */
  intersectionMembers: TypeAnnotation[];
  /** Object type properties (for object literal types) */
  objectProperties: InterfaceProperty[];
  /** Array element type (for array types) */
  arrayElementType?: TypeAnnotation;
  /** Function signature (for function types) */
  functionSignature?: FunctionTypeSignature;
  /** Whether this type is nullable */
  nullable: boolean;
  /** Whether this type is optional */
  optional: boolean;
  /** Referenced type names */
  referencedTypes: string[];
}

/**
 * Type categories for classification
 */
export type TypeKind =
  | 'primitive'        // string, number, boolean, etc.
  | 'literal'          // 'hello', 42, true
  | 'array'           // T[]
  | 'tuple'           // [string, number]
  | 'union'           // A | B
  | 'intersection'    // A & B
  | 'object'          // { prop: string }
  | 'function'        // (arg: T) => R
  | 'generic'         // T<U>
  | 'mapped'          // { [K in keyof T]: ... }
  | 'conditional'     // T extends U ? X : Y
  | 'indexed'         // T[K]
  | 'template'        // `hello ${string}`
  | 'reference'       // SomeType
  | 'unknown'         // Complex or unrecognized types

/**
 * Function type signature information
 */
export interface FunctionTypeSignature {
  /** Function parameters */
  parameters: FunctionParameter[];
  /** Return type */
  returnType: TypeAnnotation;
  /** Generic type parameters */
  typeParameters: TypeParameter[];
  /** Whether function is async */
  async: boolean;
}

/**
 * Function parameter information
 */
export interface FunctionParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: TypeAnnotation;
  /** Whether parameter is optional */
  optional: boolean;
  /** Whether parameter is a rest parameter */
  rest: boolean;
  /** Default value if any */
  defaultValue?: string;
}

/**
 * Complete type information extracted from a file
 */
export interface TypeInformation {
  /** File path that was analyzed */
  filePath: string;
  /** All interfaces found */
  interfaces: TypeScriptInterface[];
  /** All type aliases found */
  typeAliases: TypeAlias[];
  /** All generic types found */
  generics: TypeParameter[];
  /** Type annotations found on symbols */
  typeAnnotations: Map<string, TypeAnnotation>;
  /** Type import statements */
  typeImports: TypeImport[];
  /** Type export statements */
  typeExports: TypeExport[];
  /** Type relationships and dependencies */
  typeDependencies: TypeDependency[];
  /** Analysis errors */
  errors: string[];
}

/**
 * Type import information
 */
export interface TypeImport {
  /** Imported type name */
  typeName: string;
  /** Module it's imported from */
  fromModule: string;
  /** Whether it's a type-only import */
  typeOnly: boolean;
  /** Line number of import */
  line: number;
  /** Original import name if aliased */
  originalName?: string;
}

/**
 * Type export information
 */
export interface TypeExport {
  /** Exported type name */
  typeName: string;
  /** Whether it's a type-only export */
  typeOnly: boolean;
  /** Whether it's a default export */
  isDefault: boolean;
  /** Line number of export */
  line: number;
  /** Re-export module if applicable */
  fromModule?: string;
}

/**
 * Type dependency relationship
 */
export interface TypeDependency {
  /** Source type name */
  sourceType: string;
  /** Target type name */
  targetType: string;
  /** Dependency kind */
  kind: 'extends' | 'implements' | 'uses' | 'generic' | 'property' | 'parameter' | 'return';
  /** File where dependency is defined */
  filePath: string;
  /** Line number where dependency occurs */
  line: number;
  /** Additional context */
  context?: string;
}

/**
 * Configuration options for type analysis
 */
export interface TypeAnalysisOptions {
  /** Whether to include type dependencies */
  includeDependencies?: boolean;
  /** Whether to include detailed type annotations */
  includeDetailedAnnotations?: boolean;
  /** Whether to include generic type information */
  includeGenerics?: boolean;
  /** Whether to include import/export information */
  includeImportsExports?: boolean;
  /** Maximum depth for nested type analysis */
  maxTypeDepth?: number;
  /** Whether to resolve type aliases */
  resolveTypeAliases?: boolean;
}

/**
 * Default analysis options
 */
const DEFAULT_TYPE_ANALYSIS_OPTIONS: Required<TypeAnalysisOptions> = {
  includeDependencies: true,
  includeDetailedAnnotations: true,
  includeGenerics: true,
  includeImportsExports: true,
  maxTypeDepth: 10,
  resolveTypeAliases: true
};

/**
 * TypeAwarenessAnalyzer - Main class for TypeScript type analysis
 *
 * Uses singleton pattern for consistent state management and integrates
 * with the existing TreeSitterWrapper for AST parsing.
 */
export class TypeAwarenessAnalyzer {
  /** Singleton instance */
  private static instance: TypeAwarenessAnalyzer | null = null;

  /** Tree-sitter wrapper for parsing */
  private wrapper: TreeSitterWrapper;

  /** Cache for analyzed files */
  private fileCache: Map<string, TypeInformation> = new Map();

  /** Cache for type definitions */
  private typeDefinitionCache: Map<string, TypeAnnotation> = new Map();

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.wrapper = TreeSitterWrapper.getInstance();
  }

  /**
   * Get the singleton instance of TypeAwarenessAnalyzer
   */
  public static getInstance(): TypeAwarenessAnalyzer {
    if (!TypeAwarenessAnalyzer.instance) {
      TypeAwarenessAnalyzer.instance = new TypeAwarenessAnalyzer();
    }
    return TypeAwarenessAnalyzer.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    TypeAwarenessAnalyzer.instance = null;
  }

  /**
   * Analyze TypeScript file for type information
   *
   * @param filePath - Path to the TypeScript file
   * @param options - Analysis options
   * @returns Complete type information for the file
   */
  public async analyzeFile(
    filePath: string,
    options: TypeAnalysisOptions = {}
  ): Promise<TypeInformation> {
    const config = { ...DEFAULT_TYPE_ANALYSIS_OPTIONS, ...options };

    // Check cache first
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      return this.analyzeContent(content, filePath, config);
    } catch (error) {
      throw new Error(
        `Failed to analyze file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Analyze TypeScript content for type information
   *
   * @param content - TypeScript source code
   * @param filePath - File path for reference
   * @param options - Analysis options
   * @returns Complete type information
   */
  public async analyzeContent(
    content: string,
    filePath: string = '<unknown>',
    options: TypeAnalysisOptions = {}
  ): Promise<TypeInformation> {
    const config = { ...DEFAULT_TYPE_ANALYSIS_OPTIONS, ...options };
    const errors: string[] = [];

    const typeInfo: TypeInformation = {
      filePath,
      interfaces: [],
      typeAliases: [],
      generics: [],
      typeAnnotations: new Map(),
      typeImports: [],
      typeExports: [],
      typeDependencies: [],
      errors
    };

    try {
      // Parse the TypeScript code
      const parseResult = await this.wrapper.parse(content, SupportedLanguage.TypeScript);

      if (parseResult.hasErrors || !parseResult.tree) {
        errors.push('Failed to parse TypeScript content');
        return typeInfo;
      }

      // Extract type information from AST
      await this.extractTypeInformation(
        parseResult.tree.rootNode,
        content,
        filePath,
        config,
        typeInfo
      );

      // Cache the result
      this.fileCache.set(filePath, typeInfo);

    } catch (error) {
      errors.push(`Analysis error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return typeInfo;
  }

  /**
   * Enrich repository map with type information
   *
   * @param repoMap - Repository map to enrich
   * @param options - Analysis options
   * @returns Enhanced repository map with type data
   */
  public async enrichRepositoryMap(
    repoMap: RepositoryMap,
    options: TypeAnalysisOptions = {}
  ): Promise<RepositoryMap> {
    const config = { ...DEFAULT_TYPE_ANALYSIS_OPTIONS, ...options };
    const enrichedFiles: CodeFile[] = [];

    for (const file of repoMap.files) {
      if (this.isTypeScriptFile(file.path)) {
        try {
          // Read file content if not already available
          let content = (file as any).content;
          if (!content) {
            const fullPath = path.resolve(repoMap.rootPath, file.path);
            content = await fs.readFile(fullPath, 'utf-8');
          }

          // Analyze type information
          const typeInfo = await this.analyzeContent(content, file.path, config);

          // Enrich the file with type information
          const enrichedFile = await this.enrichCodeFile(file, typeInfo);
          enrichedFiles.push(enrichedFile);

        } catch (error) {
          // Keep original file if analysis fails
          console.warn(`Failed to enrich file ${file.path}:`, error);
          enrichedFiles.push(file);
        }
      } else {
        // Keep non-TypeScript files as-is
        enrichedFiles.push(file);
      }
    }

    return {
      ...repoMap,
      files: enrichedFiles
    };
  }

  /**
   * Extract type information from AST node
   */
  private async extractTypeInformation(
    node: SyntaxNode,
    content: string,
    filePath: string,
    config: Required<TypeAnalysisOptions>,
    typeInfo: TypeInformation
  ): Promise<void> {
    // Extract interfaces
    if (this.isInterfaceDeclaration(node)) {
      const interfaceInfo = this.extractInterface(node, content, filePath);
      if (interfaceInfo) {
        typeInfo.interfaces.push(interfaceInfo);
      }
    }

    // Extract type aliases
    if (this.isTypeAliasDeclaration(node)) {
      const typeAlias = this.extractTypeAlias(node, content, filePath);
      if (typeAlias) {
        typeInfo.typeAliases.push(typeAlias);
      }
    }

    // Extract type imports/exports
    if (config.includeImportsExports) {
      if (this.isImportDeclaration(node)) {
        const imports = this.extractTypeImports(node, content);
        typeInfo.typeImports.push(...imports);
      }

      if (this.isExportDeclaration(node)) {
        const exports = this.extractTypeExports(node, content);
        typeInfo.typeExports.push(...exports);
      }
    }

    // Extract type annotations from functions, variables, etc.
    if (config.includeDetailedAnnotations) {
      const typeAnnotation = this.extractTypeAnnotation(node, content);
      if (typeAnnotation) {
        const symbolName = this.getSymbolNameFromNode(node, content);
        if (symbolName) {
          typeInfo.typeAnnotations.set(symbolName, typeAnnotation);
        }
      }
    }

    // Extract dependencies
    if (config.includeDependencies) {
      const dependencies = this.extractTypeDependencies(node, content, filePath);
      typeInfo.typeDependencies.push(...dependencies);
    }

    // Recursively process child nodes
    for (const child of node.children) {
      await this.extractTypeInformation(child, content, filePath, config, typeInfo);
    }
  }

  /**
   * Check if a file is a TypeScript file
   */
  private isTypeScriptFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.d.ts'].includes(ext);
  }

  /**
   * Check if node is an interface declaration
   */
  private isInterfaceDeclaration(node: SyntaxNode): boolean {
    return node.type === 'interface_declaration';
  }

  /**
   * Check if node is a type alias declaration
   */
  private isTypeAliasDeclaration(node: SyntaxNode): boolean {
    return node.type === 'type_alias_declaration';
  }

  /**
   * Check if node is an import declaration
   */
  private isImportDeclaration(node: SyntaxNode): boolean {
    return node.type === 'import_statement';
  }

  /**
   * Check if node is an export declaration
   */
  private isExportDeclaration(node: SyntaxNode): boolean {
    return node.type === 'export_statement' || node.type.startsWith('export_');
  }

  /**
   * Extract interface information from AST node
   */
  private extractInterface(
    node: SyntaxNode,
    content: string,
    filePath: string
  ): TypeScriptInterface | null {
    const nameNode = this.findChildByType(node, 'type_identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode, content);
    const properties = this.extractInterfaceProperties(node, content);
    const extendsClause = this.findChildByType(node, 'extends_clause');
    const extends_types = extendsClause ? this.extractExtendsTypes(extendsClause, content) : [];
    const typeParameters = this.extractTypeParameters(node, content);
    const documentation = this.extractJSDoc(node, content);
    const { exported, exportKind } = this.extractExportInfo(node);

    return {
      name,
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      properties,
      extends: extends_types,
      typeParameters,
      documentation,
      exported,
      exportKind,
      modifiers: this.extractModifiers(node)
    };
  }

  /**
   * Extract type alias information from AST node
   */
  private extractTypeAlias(
    node: SyntaxNode,
    content: string,
    filePath: string
  ): TypeAlias | null {
    const nameNode = this.findChildByType(node, 'type_identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode, content);
    const typeNode = this.findTypeDefinitionNode(node);
    const definition = typeNode ? this.parseTypeAnnotation(typeNode, content) : {
      raw: 'unknown',
      normalized: 'unknown',
      kind: 'unknown' as TypeKind,
      typeArguments: [],
      unionMembers: [],
      intersectionMembers: [],
      objectProperties: [],
      nullable: false,
      optional: false,
      referencedTypes: []
    };

    const typeParameters = this.extractTypeParameters(node, content);
    const documentation = this.extractJSDoc(node, content);
    const { exported, exportKind } = this.extractExportInfo(node);

    return {
      name,
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      definition,
      typeParameters,
      documentation,
      exported,
      exportKind
    };
  }

  /**
   * Extract interface properties from AST node
   */
  private extractInterfaceProperties(node: SyntaxNode, content: string): InterfaceProperty[] {
    const properties: InterfaceProperty[] = [];
    const objectType = this.findChildByType(node, 'object_type');

    if (objectType) {
      for (const child of objectType.children) {
        if (child.type === 'property_signature') {
          const property = this.extractPropertySignature(child, content);
          if (property) {
            properties.push(property);
          }
        }
      }
    }

    return properties;
  }

  /**
   * Extract property signature information
   */
  private extractPropertySignature(node: SyntaxNode, content: string): InterfaceProperty | null {
    const nameNode = this.findChildByType(node, 'property_identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode, content);
    const typeAnnotationNode = this.findChildByType(node, 'type_annotation');
    const type = typeAnnotationNode ?
      this.parseTypeAnnotation(typeAnnotationNode, content) :
      {
        raw: 'unknown',
        normalized: 'unknown',
        kind: 'unknown' as TypeKind,
        typeArguments: [],
        unionMembers: [],
        intersectionMembers: [],
        objectProperties: [],
        nullable: false,
        optional: false,
        referencedTypes: []
      };

    const optional = this.isOptionalProperty(node);
    const readonly = this.isReadonlyProperty(node);
    const documentation = this.extractJSDoc(node, content);

    return {
      name,
      type,
      optional,
      readonly,
      documentation,
      line: node.startPosition.row + 1
    };
  }

  /**
   * Parse type annotation from AST node
   */
  private parseTypeAnnotation(node: SyntaxNode, content: string): TypeAnnotation {
    const rawType = this.getNodeText(node, content);
    const normalized = this.normalizeTypeString(rawType);
    const kind = this.determineTypeKind(node);

    return {
      raw: rawType,
      normalized,
      kind,
      typeArguments: this.extractTypeArguments(node, content),
      unionMembers: this.extractUnionMembers(node, content),
      intersectionMembers: this.extractIntersectionMembers(node, content),
      objectProperties: this.extractObjectTypeProperties(node, content),
      arrayElementType: this.extractArrayElementType(node, content),
      functionSignature: this.extractFunctionSignature(node, content),
      nullable: this.isNullableType(node),
      optional: this.isOptionalType(node),
      referencedTypes: this.extractReferencedTypes(node, content)
    };
  }

  /**
   * Helper methods for type analysis
   */

  private getNodeText(node: SyntaxNode, content: string): string {
    return content.slice(node.startIndex, node.endIndex);
  }

  private findChildByType(node: SyntaxNode, type: string): SyntaxNode | null {
    return node.children.find(child => child.type === type) || null;
  }

  private normalizeTypeString(typeStr: string): string {
    return typeStr.trim().replace(/\s+/g, ' ');
  }

  private determineTypeKind(node: SyntaxNode): TypeKind {
    switch (node.type) {
      case 'predefined_type':
      case 'primitive_type':
        return 'primitive';
      case 'literal_type':
        return 'literal';
      case 'array_type':
        return 'array';
      case 'tuple_type':
        return 'tuple';
      case 'union_type':
        return 'union';
      case 'intersection_type':
        return 'intersection';
      case 'object_type':
        return 'object';
      case 'function_type':
        return 'function';
      case 'generic_type':
        return 'generic';
      case 'mapped_type_clause':
        return 'mapped';
      case 'conditional_type':
        return 'conditional';
      case 'index_type_query':
        return 'indexed';
      case 'template_literal_type':
        return 'template';
      case 'type_identifier':
        return 'reference';
      default:
        return 'unknown';
    }
  }

  /**
   * Helper methods for TypeScript type analysis
   */

  private extractTypeParameters(node: SyntaxNode, content: string): TypeParameter[] {
    const typeParametersNode = this.findChildByType(node, 'type_parameters');
    if (!typeParametersNode) return [];

    const parameters: TypeParameter[] = [];

    for (const child of typeParametersNode.children) {
      if (child.type === 'type_parameter') {
        const nameNode = this.findChildByType(child, 'type_identifier');
        if (nameNode) {
          const name = this.getNodeText(nameNode, content);
          const constraintNode = this.findChildByType(child, 'constraint');
          const defaultNode = this.findChildByType(child, 'default_type');

          parameters.push({
            name,
            constraint: constraintNode ? this.parseTypeAnnotation(constraintNode, content) : undefined,
            defaultType: defaultNode ? this.parseTypeAnnotation(defaultNode, content) : undefined
          });
        }
      }
    }

    return parameters;
  }

  private extractJSDoc(node: SyntaxNode, content: string): string | undefined {
    // Look for JSDoc comment before the node
    let current = node.previousSibling;
    while (current && current.type === 'comment') {
      const commentText = this.getNodeText(current, content);
      if (commentText.startsWith('/**')) {
        // Extract JSDoc content
        return commentText
          .replace(/^\/\*\*/, '')
          .replace(/\*\/$/, '')
          .split('\n')
          .map(line => line.replace(/^\s*\*\s?/, '').trim())
          .join('\n')
          .trim();
      }
      current = current.previousSibling;
    }
    return undefined;
  }

  private extractExportInfo(node: SyntaxNode): { exported: boolean; exportKind: ExportKind } {
    let current = node.parent;
    while (current) {
      if (current.type === 'export_statement') {
        const isDefault = current.children.some(child =>
          child.type === 'identifier' && this.getNodeText(child, '') === 'default'
        );
        return {
          exported: true,
          exportKind: isDefault ? 'default' : 'named'
        };
      }
      current = current.parent;
    }

    // Check if the declaration itself has export keyword
    const firstChild = node.children[0];
    if (firstChild && firstChild.type === 'export') {
      return { exported: true, exportKind: 'named' };
    }

    return { exported: false, exportKind: 'none' };
  }

  private extractModifiers(node: SyntaxNode): SymbolModifier[] {
    const modifiers: SymbolModifier[] = [];

    for (const child of node.children) {
      switch (child.type) {
        case 'accessibility_modifier':
          const accessText = this.getNodeText(child, '');
          if (['public', 'private', 'protected'].includes(accessText)) {
            modifiers.push(accessText as SymbolModifier);
          }
          break;
        case 'readonly':
          modifiers.push('readonly');
          break;
        case 'static':
          modifiers.push('static');
          break;
        case 'async':
          modifiers.push('async');
          break;
        case 'abstract':
          modifiers.push('abstract');
          break;
      }
    }

    return modifiers;
  }

  private extractExtendsTypes(node: SyntaxNode, content: string): string[] {
    const types: string[] = [];

    for (const child of node.children) {
      if (child.type === 'type_identifier' || child.type === 'generic_type') {
        types.push(this.getNodeText(child, content));
      }
    }

    return types;
  }

  private findTypeDefinitionNode(node: SyntaxNode): SyntaxNode | null {
    // Look for the type after the '=' in type alias
    let foundEquals = false;
    for (const child of node.children) {
      if (foundEquals && child.type !== '=' && child.type !== 'comment') {
        return child;
      }
      if (child.type === '=' || this.getNodeText(child, '') === '=') {
        foundEquals = true;
      }
    }
    return null;
  }

  private isOptionalProperty(node: SyntaxNode): boolean {
    return node.children.some(child => child.type === '?' || this.getNodeText(child, '') === '?');
  }

  private isReadonlyProperty(node: SyntaxNode): boolean {
    return node.children.some(child => child.type === 'readonly');
  }

  private extractTypeArguments(node: SyntaxNode, content: string): TypeAnnotation[] {
    const typeArgumentsNode = this.findChildByType(node, 'type_arguments');
    if (!typeArgumentsNode) return [];

    const arguments_list: TypeAnnotation[] = [];

    for (const child of typeArgumentsNode.children) {
      if (child.type !== ',' && child.type !== '<' && child.type !== '>') {
        arguments_list.push(this.parseTypeAnnotation(child, content));
      }
    }

    return arguments_list;
  }

  private extractUnionMembers(node: SyntaxNode, content: string): TypeAnnotation[] {
    if (node.type !== 'union_type') return [];

    const members: TypeAnnotation[] = [];

    for (const child of node.children) {
      if (child.type !== '|' && child.type !== 'comment') {
        members.push(this.parseTypeAnnotation(child, content));
      }
    }

    return members;
  }

  private extractIntersectionMembers(node: SyntaxNode, content: string): TypeAnnotation[] {
    if (node.type !== 'intersection_type') return [];

    const members: TypeAnnotation[] = [];

    for (const child of node.children) {
      if (child.type !== '&' && child.type !== 'comment') {
        members.push(this.parseTypeAnnotation(child, content));
      }
    }

    return members;
  }

  private extractObjectTypeProperties(node: SyntaxNode, content: string): InterfaceProperty[] {
    if (node.type !== 'object_type') return [];

    const properties: InterfaceProperty[] = [];

    for (const child of node.children) {
      if (child.type === 'property_signature') {
        const property = this.extractPropertySignature(child, content);
        if (property) {
          properties.push(property);
        }
      }
    }

    return properties;
  }

  private extractArrayElementType(node: SyntaxNode, content: string): TypeAnnotation | undefined {
    if (node.type === 'array_type') {
      const elementTypeNode = node.children.find(child =>
        child.type !== '[' && child.type !== ']'
      );
      return elementTypeNode ? this.parseTypeAnnotation(elementTypeNode, content) : undefined;
    }
    return undefined;
  }

  private extractFunctionSignature(node: SyntaxNode, content: string): FunctionTypeSignature | undefined {
    if (node.type !== 'function_type') return undefined;

    const parametersNode = this.findChildByType(node, 'parameters');
    const parameters = parametersNode ? this.extractFunctionParameters(parametersNode, content) : [];

    const returnTypeNode = this.findChildByType(node, 'type_annotation');
    const returnType = returnTypeNode ? this.parseTypeAnnotation(returnTypeNode, content) : {
      raw: 'void',
      normalized: 'void',
      kind: 'primitive' as TypeKind,
      typeArguments: [],
      unionMembers: [],
      intersectionMembers: [],
      objectProperties: [],
      nullable: false,
      optional: false,
      referencedTypes: []
    };

    return {
      parameters,
      returnType,
      typeParameters: this.extractTypeParameters(node, content),
      async: false // Function types don't have async modifier
    };
  }

  private extractFunctionParameters(node: SyntaxNode, content: string): FunctionParameter[] {
    const parameters: FunctionParameter[] = [];

    for (const child of node.children) {
      if (child.type === 'parameter' || child.type === 'required_parameter' || child.type === 'optional_parameter') {
        const nameNode = this.findChildByType(child, 'identifier');
        const typeNode = this.findChildByType(child, 'type_annotation');

        if (nameNode) {
          const name = this.getNodeText(nameNode, content);
          const type = typeNode ? this.parseTypeAnnotation(typeNode, content) : {
            raw: 'any',
            normalized: 'any',
            kind: 'primitive' as TypeKind,
            typeArguments: [],
            unionMembers: [],
            intersectionMembers: [],
            objectProperties: [],
            nullable: false,
            optional: false,
            referencedTypes: []
          };

          parameters.push({
            name,
            type,
            optional: child.type === 'optional_parameter' || this.isOptionalProperty(child),
            rest: child.children.some(c => c.type === '...' || this.getNodeText(c, content) === '...'),
            defaultValue: this.extractDefaultValue(child, content)
          });
        }
      }
    }

    return parameters;
  }

  private extractDefaultValue(node: SyntaxNode, content: string): string | undefined {
    const defaultNode = this.findChildByType(node, 'default_value');
    return defaultNode ? this.getNodeText(defaultNode, content) : undefined;
  }

  private isNullableType(node: SyntaxNode): boolean {
    // Check if type includes null or undefined
    const text = this.getNodeText(node, '');
    return text.includes('null') || text.includes('undefined') || text.includes('?');
  }

  private isOptionalType(node: SyntaxNode): boolean {
    return node.children.some(child => child.type === '?' || this.getNodeText(child, '') === '?');
  }

  private extractReferencedTypes(node: SyntaxNode, content: string): string[] {
    const types: string[] = [];

    // Recursively find all type identifiers
    const findTypeIdentifiers = (n: SyntaxNode) => {
      if (n.type === 'type_identifier') {
        const typeName = this.getNodeText(n, content);
        if (!['string', 'number', 'boolean', 'any', 'void', 'never', 'unknown'].includes(typeName)) {
          types.push(typeName);
        }
      }
      for (const child of n.children) {
        findTypeIdentifiers(child);
      }
    };

    findTypeIdentifiers(node);
    return [...new Set(types)]; // Remove duplicates
  }

  private extractTypeImports(node: SyntaxNode, content: string): TypeImport[] {
    const imports: TypeImport[] = [];
    const line = node.startPosition.row + 1;

    // Check for type-only import
    const isTypeOnly = node.children.some(child =>
      this.getNodeText(child, content) === 'type'
    );

    // Find import specifier
    const importSpecifierNode = this.findChildByType(node, 'import_specifier') ||
                               this.findChildByType(node, 'namespace_import') ||
                               this.findChildByType(node, 'identifier');

    // Find from clause
    const fromClause = node.children.find(child => child.type === 'string');
    const fromModule = fromClause ?
      this.getNodeText(fromClause, content).replace(/['"]/g, '') : '';

    if (importSpecifierNode && fromModule) {
      const importedName = this.getNodeText(importSpecifierNode, content);

      imports.push({
        typeName: importedName,
        fromModule,
        typeOnly: isTypeOnly,
        line
      });
    }

    return imports;
  }

  private extractTypeExports(node: SyntaxNode, content: string): TypeExport[] {
    const exports: TypeExport[] = [];
    const line = node.startPosition.row + 1;

    // Check for type-only export
    const isTypeOnly = node.children.some(child =>
      this.getNodeText(child, content) === 'type'
    );

    // Check for default export
    const isDefault = node.children.some(child =>
      this.getNodeText(child, content) === 'default'
    );

    // Find exported type name
    const typeNode = this.findChildByType(node, 'type_identifier') ||
                    this.findChildByType(node, 'identifier');

    if (typeNode) {
      const typeName = this.getNodeText(typeNode, content);

      exports.push({
        typeName,
        typeOnly: isTypeOnly,
        isDefault,
        line
      });
    }

    return exports;
  }

  private extractTypeAnnotation(node: SyntaxNode, content: string): TypeAnnotation | null {
    const typeAnnotationNode = this.findChildByType(node, 'type_annotation');
    return typeAnnotationNode ? this.parseTypeAnnotation(typeAnnotationNode, content) : null;
  }

  private getSymbolNameFromNode(node: SyntaxNode, content: string): string | null {
    // Look for various identifier types
    const identifierNode = this.findChildByType(node, 'identifier') ||
                          this.findChildByType(node, 'property_identifier') ||
                          this.findChildByType(node, 'type_identifier');

    return identifierNode ? this.getNodeText(identifierNode, content) : null;
  }

  private extractTypeDependencies(node: SyntaxNode, content: string, filePath: string): TypeDependency[] {
    const dependencies: TypeDependency[] = [];
    const line = node.startPosition.row + 1;

    // Extract dependencies from extends clauses
    if (node.type === 'extends_clause') {
      const sourceType = this.getContainingTypeName(node, content);
      const targetTypes = this.extractExtendsTypes(node, content);

      for (const targetType of targetTypes) {
        if (sourceType) {
          dependencies.push({
            sourceType,
            targetType,
            kind: 'extends',
            filePath,
            line,
            context: 'inheritance'
          });
        }
      }
    }

    // Extract dependencies from implements clauses
    if (node.type === 'implements_clause') {
      const sourceType = this.getContainingTypeName(node, content);
      const targetTypes = this.extractExtendsTypes(node, content);

      for (const targetType of targetTypes) {
        if (sourceType) {
          dependencies.push({
            sourceType,
            targetType,
            kind: 'implements',
            filePath,
            line,
            context: 'implementation'
          });
        }
      }
    }

    return dependencies;
  }

  private getContainingTypeName(node: SyntaxNode, content: string): string | null {
    let current = node.parent;
    while (current) {
      if (this.isInterfaceDeclaration(current) ||
          this.isTypeAliasDeclaration(current) ||
          current.type === 'class_declaration') {
        const nameNode = this.findChildByType(current, 'type_identifier') ||
                        this.findChildByType(current, 'identifier');
        return nameNode ? this.getNodeText(nameNode, content) : null;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Enrich a CodeFile with type information
   */
  private async enrichCodeFile(file: CodeFile, typeInfo: TypeInformation): Promise<CodeFile> {
    // Add type information to the file's metadata
    const enrichedFile: CodeFile = {
      ...file,
      metadata: {
        ...file.metadata,
        typeInfo: {
          interfaceCount: typeInfo.interfaces.length,
          typeAliasCount: typeInfo.typeAliases.length,
          typeImportCount: typeInfo.typeImports.length,
          typeExportCount: typeInfo.typeExports.length,
          typeDependencyCount: typeInfo.typeDependencies.length,
          interfaces: typeInfo.interfaces.map(i => i.name),
          typeAliases: typeInfo.typeAliases.map(t => t.name),
          hasComplexTypes: typeInfo.typeAliases.some(t => t.definition.kind !== 'primitive'),
          hasGenerics: typeInfo.interfaces.some(i => i.typeParameters.length > 0) ||
                       typeInfo.typeAliases.some(t => t.typeParameters.length > 0)
        }
      }
    };

    // Enhance existing symbols with type information
    const enhancedSymbols: CodeSymbol[] = file.symbols.map((symbol: CodeSymbol) => {
      const typeAnnotation = typeInfo.typeAnnotations.get(symbol.name);
      return {
        ...symbol,
        typeAnnotation: typeAnnotation?.raw,
        metadata: {
          ...symbol.metadata,
          typeKind: typeAnnotation?.kind,
          referencedTypes: typeAnnotation?.referencedTypes
        }
      };
    });

    // Add interfaces as symbols
    const interfaceSymbols: CodeSymbol[] = typeInfo.interfaces.map(iface => ({
      name: iface.name,
      type: 'interface',
      filePath: file.path,
      startLine: iface.startLine,
      endLine: iface.endLine,
      exported: iface.exported,
      isDefault: iface.exportKind === 'default',
      documentation: iface.documentation,
      typeAnnotation: `interface ${iface.name}`,
      metadata: {
        extends: iface.extends,
        propertyCount: iface.properties.length,
        hasTypeParameters: iface.typeParameters.length > 0
      }
    }));

    // Add type aliases as symbols
    const typeAliasSymbols: CodeSymbol[] = typeInfo.typeAliases.map(alias => ({
      name: alias.name,
      type: 'type',
      filePath: file.path,
      startLine: alias.startLine,
      endLine: alias.endLine,
      exported: alias.exported,
      isDefault: alias.exportKind === 'default',
      documentation: alias.documentation,
      typeAnnotation: `type ${alias.name} = ${alias.definition.raw}`,
      metadata: {
        definition: alias.definition.raw,
        typeKind: alias.definition.kind,
        hasTypeParameters: alias.typeParameters.length > 0
      }
    }));

    return {
      ...enrichedFile,
      symbols: [...enhancedSymbols, ...interfaceSymbols, ...typeAliasSymbols]
    };
  }
}

/**
 * Convenience function for getting the singleton instance
 */
export function getTypeAwarenessAnalyzer(): TypeAwarenessAnalyzer {
  return TypeAwarenessAnalyzer.getInstance();
}