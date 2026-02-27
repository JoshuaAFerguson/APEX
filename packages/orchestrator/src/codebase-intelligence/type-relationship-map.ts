/**
 * TypeRelationshipMap - Track type hierarchies and relationships across the codebase
 *
 * This module analyzes type relationships including inheritance, implementation,
 * composition, and usage patterns. It builds a comprehensive graph of how types
 * interact with each other throughout the codebase.
 *
 * @example
 * ```typescript
 * const typeMap = new TypeRelationshipMap(repositoryMap);
 * await typeMap.buildTypeGraph();
 *
 * // Find all classes that implement an interface
 * const implementations = typeMap.getImplementations('IUserService');
 *
 * // Get inheritance chain for a class
 * const chain = typeMap.getInheritanceChain('AdminUser');
 *
 * // Find all types that use a specific type
 * const usages = typeMap.getUsages('User');
 * ```
 */

import type {
  RepositoryMap,
  CodeSymbol,
  SymbolType,
} from '@apexcli/core';
import { SupportedLanguage } from './parsers/types.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TreeSitterWrapper } from './parsers/tree-sitter-wrapper.js';
import { SymbolResolver, type SymbolDefinition } from './symbol-resolver.js';
import type { SyntaxNode } from './parsers/types.js';

/**
 * Represents a relationship between two types
 */
export interface TypeRelationship {
  /** Source type name */
  sourceType: string;
  /** Target type name */
  targetType: string;
  /** Relationship kind */
  kind: 'extends' | 'implements' | 'uses' | 'contains' | 'returns' | 'accepts';
  /** Source file where relationship is defined */
  sourceFile: string;
  /** Target file where target type is defined */
  targetFile?: string;
  /** Whether target is external (from node_modules, stdlib, etc.) */
  isExternal: boolean;
  /** Line where the relationship is declared */
  sourceLine?: number;
  /** Additional metadata about the relationship */
  metadata?: Record<string, unknown>;
}

/**
 * Type usage information
 */
export interface TypeUsage {
  /** Symbol using the type */
  symbol: CodeSymbol;
  /** How the type is used */
  usageKind: 'parameter' | 'return' | 'property' | 'variable' | 'generic' | 'cast';
  /** Context of usage (function signature, property declaration, etc.) */
  context: string;
  /** Confidence in the usage detection */
  confidence: number;
}

/**
 * Type hierarchy information
 */
export interface TypeHierarchy {
  /** The type being analyzed */
  type: string;
  /** Direct parent types */
  parents: string[];
  /** Direct child types */
  children: string[];
  /** All ancestor types (transitive closure) */
  ancestors: string[];
  /** All descendant types (transitive closure) */
  descendants: string[];
  /** Implemented interfaces */
  interfaces: string[];
  /** Types that implement this interface */
  implementors: string[];
}

/**
 * TypeRelationshipMap class - Analyze and track type relationships
 *
 * Builds a comprehensive map of type relationships including inheritance,
 * composition, and usage patterns across the entire codebase.
 */
export class TypeRelationshipMap {
  private repoMap: RepositoryMap;
  private treeWrapper: TreeSitterWrapper;
  private resolver: SymbolResolver;
  private relationships: TypeRelationship[] = [];
  private typeUsages: Map<string, TypeUsage[]> = new Map();
  private hierarchyCache: Map<string, TypeHierarchy> = new Map();

  constructor(repoMap: RepositoryMap) {
    this.repoMap = repoMap;
    this.treeWrapper = TreeSitterWrapper.getInstance();
    this.resolver = new SymbolResolver(repoMap);
  }

  /**
   * Build the complete type relationship graph
   *
   * @returns Array of all type relationships found
   */
  async buildTypeGraph(): Promise<TypeRelationship[]> {
    this.relationships = [];
    this.typeUsages.clear();
    this.hierarchyCache.clear();

    // Process each file to extract type relationships
    for (const file of this.repoMap.files) {
      if (file.language && this.isAnalyzableLanguage(file.language)) {
        try {
          const filePath = path.isAbsolute(file.path)
            ? file.path
            : path.join(this.repoMap.rootPath, file.path);
          const content = await fs.readFile(filePath, 'utf-8');
          await this.analyzeFileForTypeRelationships(
            file.path,
            content,
            file.language as SupportedLanguage
          );
        } catch {
          // Skip files that can't be read
        }
      }
    }

    // Build hierarchy cache after all relationships are collected
    await this.buildHierarchyCache();

    return this.relationships;
  }

  /**
   * Get all types that extend or implement a given type
   *
   * @param typeName Name of the base type or interface
   * @returns Array of symbol definitions that implement/extend the type
   */
  getImplementations(typeName: string): SymbolDefinition[] {
    const implementations: SymbolDefinition[] = [];

    for (const relationship of this.relationships) {
      if (relationship.targetType === typeName &&
          (relationship.kind === 'extends' || relationship.kind === 'implements')) {

        const symbol = this.findTypeSymbol(relationship.sourceType, relationship.sourceFile);
        if (symbol) {
          const file = this.repoMap.files.find((f) => f.path === symbol.filePath);
          if (file) {
            implementations.push({
              symbol,
              file,
              filePath: symbol.filePath,
              confidence: 1.0,
              isReExport: false,
            });
          }
        }
      }
    }

    return implementations;
  }

  /**
   * Get the complete inheritance chain for a type
   *
   * @param typeName Name of the type to analyze
   * @returns Array of symbol definitions in inheritance order (most specific to most general)
   */
  getInheritanceChain(typeName: string): SymbolDefinition[] {
    const hierarchy = this.getHierarchy(typeName);
    const chain: SymbolDefinition[] = [];

    // Start with the type itself
    const baseSymbol = this.findTypeSymbol(typeName);
    if (baseSymbol) {
      const baseFile = this.repoMap.files.find((f) => f.path === baseSymbol.filePath);
      if (baseFile) {
        chain.push({
          symbol: baseSymbol,
          file: baseFile,
          filePath: baseSymbol.filePath,
          confidence: 1.0,
          isReExport: false,
        });
      }
    }

    // Add ancestors in order
    for (const ancestor of hierarchy.ancestors) {
      const symbol = this.findTypeSymbol(ancestor);
      if (symbol) {
        const ancestorFile = this.repoMap.files.find((f) => f.path === symbol.filePath);
        if (ancestorFile) {
          chain.push({
            symbol,
            file: ancestorFile,
            filePath: symbol.filePath,
            confidence: 1.0,
            isReExport: false,
          });
        }
      }
    }

    return chain;
  }

  /**
   * Get all symbols that use a specific type
   *
   * @param typeName Name of the type to find usages for
   * @returns Array of symbol definitions that use the type
   */
  getUsages(typeName: string): Array<{ symbol: SymbolDefinition; usage: TypeUsage }> {
    const usages = this.typeUsages.get(typeName) || [];

    return usages.map(usage => {
      const usageFile = this.repoMap.files.find((f) => f.path === usage.symbol.filePath);
      return {
        symbol: {
          symbol: usage.symbol,
          file: usageFile!,
          filePath: usage.symbol.filePath,
          confidence: usage.confidence,
          isReExport: false,
        },
        usage,
      };
    });
  }

  /**
   * Get type hierarchy information for a specific type
   *
   * @param typeName Name of the type to analyze
   * @returns Complete hierarchy information
   */
  getHierarchy(typeName: string): TypeHierarchy {
    if (this.hierarchyCache.has(typeName)) {
      return this.hierarchyCache.get(typeName)!;
    }

    // Build hierarchy on demand
    const hierarchy = this.buildHierarchyForType(typeName);
    this.hierarchyCache.set(typeName, hierarchy);
    return hierarchy;
  }

  /**
   * Get all relationships for a specific type
   *
   * @param typeName Name of the type
   * @returns Array of relationships where this type is involved
   */
  getRelationships(typeName: string): TypeRelationship[] {
    return this.relationships.filter(
      rel => rel.sourceType === typeName || rel.targetType === typeName
    );
  }

  /**
   * Find circular dependencies in type relationships
   *
   * @returns Array of circular dependency chains
   */
  findCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Get all unique type names
    const allTypes = new Set([
      ...this.relationships.map(r => r.sourceType),
      ...this.relationships.map(r => r.targetType),
    ]);

    for (const type of allTypes) {
      if (!visited.has(type)) {
        const cycle = this.detectCycle(type, visited, recursionStack, []);
        if (cycle.length > 0) {
          cycles.push(cycle);
        }
      }
    }

    return cycles;
  }

  /**
   * Analyze a file for type relationships
   */
  private async analyzeFileForTypeRelationships(
    filePath: string,
    sourceCode: string,
    language: SupportedLanguage
  ): Promise<void> {
    try {
      const parseResult = await this.treeWrapper.parse(sourceCode, language);
      if (parseResult.hasErrors || !parseResult.tree) {
        console.warn(`Failed to parse ${filePath} for type relationship analysis`);
        return;
      }

      // Extract type relationships from AST
      await this.extractTypeRelationships(parseResult.tree.rootNode, {
        filePath,
        sourceCode,
        language,
      });

    } catch (error) {
      console.error(`Error analyzing ${filePath} for type relationships:`, error);
    }
  }

  /**
   * Extract type relationships from AST nodes
   */
  private async extractTypeRelationships(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string; language: SupportedLanguage }
  ): Promise<void> {
    // Check current node for type relationships
    const relationships = await this.extractRelationshipsFromNode(node, context);
    this.relationships.push(...relationships);

    // Extract type usages
    const usages = await this.extractTypeUsagesFromNode(node, context);
    for (const usage of usages) {
      const typeName = this.extractTypeNameFromUsage(usage);
      if (typeName) {
        if (!this.typeUsages.has(typeName)) {
          this.typeUsages.set(typeName, []);
        }
        this.typeUsages.get(typeName)!.push(usage);
      }
    }

    // Recursively process children
    for (const child of node.children) {
      await this.extractTypeRelationships(child, context);
    }
  }

  /**
   * Extract type relationships from a specific AST node
   */
  private async extractRelationshipsFromNode(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string; language: SupportedLanguage }
  ): Promise<TypeRelationship[]> {
    const relationships: TypeRelationship[] = [];
    const nodeType = node.type;

    // Class/interface inheritance
    if (this.isInheritanceNode(node)) {
      const sourceType = this.extractSourceType(node, context);
      const targetType = this.extractTargetType(node, context);

      if (sourceType && targetType) {
        relationships.push({
          sourceType,
          targetType,
          kind: this.determineInheritanceKind(node),
          sourceFile: context.filePath,
          targetFile: await this.resolveTypeFile(targetType),
          isExternal: await this.isExternalType(targetType),
          sourceLine: this.getNodeLine(node, context.sourceCode),
        });
      }
    }

    // Function signatures (parameters and return types)
    if (this.isFunctionNode(node)) {
      const functionRelationships = await this.extractFunctionTypeRelationships(node, context);
      relationships.push(...functionRelationships);
    }

    // Property declarations
    if (this.isPropertyNode(node)) {
      const propertyRelationships = await this.extractPropertyTypeRelationships(node, context);
      relationships.push(...propertyRelationships);
    }

    // Generic type parameters
    if (this.isGenericNode(node)) {
      const genericRelationships = await this.extractGenericTypeRelationships(node, context);
      relationships.push(...genericRelationships);
    }

    return relationships;
  }

  /**
   * Extract type usage information from AST node
   */
  private async extractTypeUsagesFromNode(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string; language: SupportedLanguage }
  ): Promise<TypeUsage[]> {
    const usages: TypeUsage[] = [];

    // Variable declarations with type annotations
    if (this.isVariableDeclarationNode(node)) {
      const usage = await this.extractVariableTypeUsage(node, context);
      if (usage) usages.push(usage);
    }

    // Type casts and assertions
    if (this.isTypeCastNode(node)) {
      const usage = await this.extractCastTypeUsage(node, context);
      if (usage) usages.push(usage);
    }

    return usages;
  }

  /**
   * Check if the language can be analyzed for type relationships
   */
  private isAnalyzableLanguage(language: string): boolean {
    return ['typescript', 'javascript', 'python', 'java', 'go', 'rust'].includes(language.toLowerCase());
  }

  /**
   * Check if node represents inheritance/implementation
   */
  private isInheritanceNode(node: SyntaxNode): boolean {
    return ['extends_clause', 'implements_clause', 'superclass', 'interface_list'].includes(node.type);
  }

  /**
   * Check if node represents a function/method
   */
  private isFunctionNode(node: SyntaxNode): boolean {
    return [
      'function_declaration',
      'method_definition',
      'arrow_function',
      'function_expression',
      'method_signature',
    ].includes(node.type);
  }

  /**
   * Check if node represents a property
   */
  private isPropertyNode(node: SyntaxNode): boolean {
    return [
      'property_signature',
      'property_declaration',
      'field_declaration',
      'public_field_definition',
    ].includes(node.type);
  }

  /**
   * Check if node represents generic types
   */
  private isGenericNode(node: SyntaxNode): boolean {
    return ['generic_type', 'type_parameters', 'type_arguments'].includes(node.type);
  }

  /**
   * Check if node is variable declaration
   */
  private isVariableDeclarationNode(node: SyntaxNode): boolean {
    return ['variable_declaration', 'variable_declarator', 'lexical_declaration'].includes(node.type);
  }

  /**
   * Check if node is type cast
   */
  private isTypeCastNode(node: SyntaxNode): boolean {
    return ['type_assertion', 'as_expression', 'cast_expression'].includes(node.type);
  }

  /**
   * Extract source type from inheritance node
   */
  private extractSourceType(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    // Look for parent class/interface declaration
    let current = node.parent;
    while (current) {
      if (this.isTypeDeclarationNode(current)) {
        const identifier = this.findTypeIdentifier(current);
        if (identifier) {
          return this.getNodeText(identifier, context.sourceCode);
        }
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Extract target type from inheritance node
   */
  private extractTargetType(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    // Find type identifier in the inheritance clause
    const identifier = this.findTypeIdentifier(node);
    if (identifier) {
      return this.getNodeText(identifier, context.sourceCode);
    }
    return null;
  }

  /**
   * Determine inheritance kind (extends vs implements)
   */
  private determineInheritanceKind(node: SyntaxNode): 'extends' | 'implements' {
    return node.type === 'implements_clause' || node.type === 'interface_list' ? 'implements' : 'extends';
  }

  /**
   * Extract function type relationships
   */
  private async extractFunctionTypeRelationships(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): Promise<TypeRelationship[]> {
    const relationships: TypeRelationship[] = [];
    const functionName = this.extractFunctionName(node, context);

    if (!functionName) return relationships;

    // Extract parameter types
    const parameters = this.findParameterNodes(node);
    for (const param of parameters) {
      const paramType = this.extractParameterType(param, context);
      if (paramType) {
        relationships.push({
          sourceType: functionName,
          targetType: paramType,
          kind: 'accepts',
          sourceFile: context.filePath,
          targetFile: await this.resolveTypeFile(paramType),
          isExternal: await this.isExternalType(paramType),
          sourceLine: this.getNodeLine(param, context.sourceCode),
        });
      }
    }

    // Extract return type
    const returnType = this.extractReturnType(node, context);
    if (returnType) {
      relationships.push({
        sourceType: functionName,
        targetType: returnType,
        kind: 'returns',
        sourceFile: context.filePath,
        targetFile: await this.resolveTypeFile(returnType),
        isExternal: await this.isExternalType(returnType),
        sourceLine: this.getNodeLine(node, context.sourceCode),
      });
    }

    return relationships;
  }

  /**
   * Extract property type relationships
   */
  private async extractPropertyTypeRelationships(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): Promise<TypeRelationship[]> {
    const relationships: TypeRelationship[] = [];
    const propertyName = this.extractPropertyName(node, context);
    const propertyType = this.extractPropertyType(node, context);

    if (propertyName && propertyType) {
      // Find containing class/interface
      const containingType = this.findContainingType(node, context);
      if (containingType) {
        relationships.push({
          sourceType: containingType,
          targetType: propertyType,
          kind: 'contains',
          sourceFile: context.filePath,
          targetFile: await this.resolveTypeFile(propertyType),
          isExternal: await this.isExternalType(propertyType),
          sourceLine: this.getNodeLine(node, context.sourceCode),
        });
      }
    }

    return relationships;
  }

  /**
   * Extract generic type relationships
   */
  private async extractGenericTypeRelationships(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): Promise<TypeRelationship[]> {
    const relationships: TypeRelationship[] = [];

    // Extract generic constraints and usages
    const constraints = this.extractGenericConstraints(node, context);
    for (const constraint of constraints) {
      relationships.push({
        sourceType: constraint.sourceType,
        targetType: constraint.targetType,
        kind: 'extends',
        sourceFile: context.filePath,
        targetFile: await this.resolveTypeFile(constraint.targetType),
        isExternal: await this.isExternalType(constraint.targetType),
        sourceLine: this.getNodeLine(node, context.sourceCode),
      });
    }

    return relationships;
  }

  /**
   * Extract variable type usage
   */
  private async extractVariableTypeUsage(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): Promise<TypeUsage | null> {
    const varName = this.extractVariableName(node, context);
    const varType = this.extractVariableType(node, context);

    if (!varName || !varType) return null;

    // Find or create symbol for this variable
    const symbol = this.findOrCreateVariableSymbol(varName, node, context);

    return {
      symbol,
      usageKind: 'variable',
      context: `Variable declaration: ${varName}`,
      confidence: 0.9,
    };
  }

  /**
   * Extract cast type usage
   */
  private async extractCastTypeUsage(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): Promise<TypeUsage | null> {
    const castType = this.extractCastType(node, context);
    if (!castType) return null;

    // Create synthetic symbol for the cast
    const symbol: CodeSymbol = {
      name: `cast_${castType}`,
      type: 'variable',
      filePath: context.filePath,
      startLine: this.getNodeLine(node, context.sourceCode),
      endLine: this.getNodeLine(node, context.sourceCode),
    };

    return {
      symbol,
      usageKind: 'cast',
      context: `Type cast to ${castType}`,
      confidence: 0.8,
    };
  }

  /**
   * Build hierarchy cache for all types
   */
  private async buildHierarchyCache(): Promise<void> {
    // Get all unique type names
    const allTypes = new Set([
      ...this.relationships.map(r => r.sourceType),
      ...this.relationships.map(r => r.targetType),
    ]);

    for (const typeName of allTypes) {
      if (!this.hierarchyCache.has(typeName)) {
        const hierarchy = this.buildHierarchyForType(typeName);
        this.hierarchyCache.set(typeName, hierarchy);
      }
    }
  }

  /**
   * Build hierarchy for a specific type
   */
  private buildHierarchyForType(typeName: string): TypeHierarchy {
    const hierarchy: TypeHierarchy = {
      type: typeName,
      parents: [],
      children: [],
      ancestors: [],
      descendants: [],
      interfaces: [],
      implementors: [],
    };

    // Find direct relationships
    for (const rel of this.relationships) {
      if (rel.sourceType === typeName) {
        if (rel.kind === 'extends') {
          hierarchy.parents.push(rel.targetType);
        } else if (rel.kind === 'implements') {
          hierarchy.interfaces.push(rel.targetType);
        }
      } else if (rel.targetType === typeName) {
        if (rel.kind === 'extends') {
          hierarchy.children.push(rel.sourceType);
        } else if (rel.kind === 'implements') {
          hierarchy.implementors.push(rel.sourceType);
        }
      }
    }

    // Build transitive closure for ancestors and descendants
    hierarchy.ancestors = this.findAllAncestors(typeName, new Set());
    hierarchy.descendants = this.findAllDescendants(typeName, new Set());

    return hierarchy;
  }

  /**
   * Find all ancestor types recursively
   */
  private findAllAncestors(typeName: string, visited: Set<string>): string[] {
    if (visited.has(typeName)) return [];
    visited.add(typeName);

    const ancestors: string[] = [];

    for (const rel of this.relationships) {
      if (rel.sourceType === typeName && rel.kind === 'extends') {
        ancestors.push(rel.targetType);
        ancestors.push(...this.findAllAncestors(rel.targetType, visited));
      }
    }

    return [...new Set(ancestors)];
  }

  /**
   * Find all descendant types recursively
   */
  private findAllDescendants(typeName: string, visited: Set<string>): string[] {
    if (visited.has(typeName)) return [];
    visited.add(typeName);

    const descendants: string[] = [];

    for (const rel of this.relationships) {
      if (rel.targetType === typeName && rel.kind === 'extends') {
        descendants.push(rel.sourceType);
        descendants.push(...this.findAllDescendants(rel.sourceType, visited));
      }
    }

    return [...new Set(descendants)];
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCycle(
    type: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] {
    visited.add(type);
    recursionStack.add(type);
    path.push(type);

    // Check all types this type extends
    for (const rel of this.relationships) {
      if (rel.sourceType === type && rel.kind === 'extends') {
        const target = rel.targetType;

        if (recursionStack.has(target)) {
          // Found cycle - return the cycle path
          const cycleStart = path.indexOf(target);
          return path.slice(cycleStart).concat([target]);
        }

        if (!visited.has(target)) {
          const cycle = this.detectCycle(target, visited, recursionStack, [...path]);
          if (cycle.length > 0) return cycle;
        }
      }
    }

    recursionStack.delete(type);
    return [];
  }

  /**
   * Find type symbol in repository
   */
  private findTypeSymbol(typeName: string, filePath?: string): CodeSymbol | null {
    const typeSymbols = this.repoMap.files
      .flatMap((file) => file.symbols)
      .filter((symbol: CodeSymbol) =>
        symbol.name === typeName &&
        ['class', 'interface', 'type', 'enum'].includes(symbol.type)
      );

    if (filePath) {
      // Prefer symbol from specified file
      const localSymbol = typeSymbols.find((s: CodeSymbol) => s.filePath === filePath);
      if (localSymbol) return localSymbol;
    }

    return typeSymbols[0] || null;
  }

  /**
   * Extract type name from usage
   */
  private extractTypeNameFromUsage(usage: TypeUsage): string | null {
    // This would extract the actual type name from the usage context
    // For now, return null (would be implemented based on AST analysis)
    return null;
  }

  /**
   * Helper methods for AST analysis
   */

  private getNodeText(node: SyntaxNode, sourceCode: string): string {
    return sourceCode.slice(node.startIndex, node.endIndex);
  }

  private getNodeLine(node: SyntaxNode, sourceCode: string): number {
    return node.startPosition.row + 1;
  }

  private isTypeDeclarationNode(node: SyntaxNode): boolean {
    return ['class_declaration', 'interface_declaration', 'type_alias_declaration'].includes(node.type);
  }

  private findTypeIdentifier(node: SyntaxNode): SyntaxNode | null {
    return node.children.find(child =>
      child.type === 'type_identifier' || child.type === 'identifier'
    ) || null;
  }

  private extractFunctionName(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    const identifier = node.children.find(child => child.type === 'identifier');
    return identifier ? this.getNodeText(identifier, context.sourceCode) : null;
  }

  private findParameterNodes(node: SyntaxNode): SyntaxNode[] {
    const paramList = node.children.find(child =>
      child.type === 'parameters' || child.type === 'formal_parameters'
    );
    return paramList?.children.filter(child =>
      child.type === 'parameter' || child.type === 'required_parameter'
    ) || [];
  }

  private extractParameterType(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    const typeAnnotation = node.children.find(child =>
      child.type === 'type_annotation' || child.type === 'type'
    );
    if (typeAnnotation) {
      const typeId = this.findTypeIdentifier(typeAnnotation);
      return typeId ? this.getNodeText(typeId, context.sourceCode) : null;
    }
    return null;
  }

  private extractReturnType(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    const returnType = node.children.find(child =>
      child.type === 'type_annotation' && child.parent === node
    );
    if (returnType) {
      const typeId = this.findTypeIdentifier(returnType);
      return typeId ? this.getNodeText(typeId, context.sourceCode) : null;
    }
    return null;
  }

  private extractPropertyName(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    const identifier = node.children.find(child => child.type === 'property_identifier');
    return identifier ? this.getNodeText(identifier, context.sourceCode) : null;
  }

  private extractPropertyType(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    const typeAnnotation = node.children.find(child => child.type === 'type_annotation');
    if (typeAnnotation) {
      const typeId = this.findTypeIdentifier(typeAnnotation);
      return typeId ? this.getNodeText(typeId, context.sourceCode) : null;
    }
    return null;
  }

  private findContainingType(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    let current = node.parent;
    while (current) {
      if (this.isTypeDeclarationNode(current)) {
        const identifier = this.findTypeIdentifier(current);
        return identifier ? this.getNodeText(identifier, context.sourceCode) : null;
      }
      current = current.parent;
    }
    return null;
  }

  private extractGenericConstraints(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): Array<{ sourceType: string; targetType: string }> {
    // Simplified implementation - would parse generic constraints
    return [];
  }

  private extractVariableName(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    const identifier = node.children.find(child => child.type === 'identifier');
    return identifier ? this.getNodeText(identifier, context.sourceCode) : null;
  }

  private extractVariableType(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    const typeAnnotation = node.children.find(child => child.type === 'type_annotation');
    if (typeAnnotation) {
      const typeId = this.findTypeIdentifier(typeAnnotation);
      return typeId ? this.getNodeText(typeId, context.sourceCode) : null;
    }
    return null;
  }

  private extractCastType(
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): string | null {
    const typeId = this.findTypeIdentifier(node);
    return typeId ? this.getNodeText(typeId, context.sourceCode) : null;
  }

  private findOrCreateVariableSymbol(
    varName: string,
    node: SyntaxNode,
    context: { filePath: string; sourceCode: string }
  ): CodeSymbol {
    // Try to find existing symbol
    const existingSymbol = this.repoMap.files
      .find((f) => f.path === context.filePath)
      ?.symbols.find((s: CodeSymbol) => s.name === varName);

    if (existingSymbol) {
      return existingSymbol;
    }

    // Create new symbol
    return {
      name: varName,
      type: 'variable',
      filePath: context.filePath,
      startLine: this.getNodeLine(node, context.sourceCode),
      endLine: this.getNodeLine(node, context.sourceCode),
    };
  }

  private async resolveTypeFile(typeName: string): Promise<string | undefined> {
    const symbol = this.findTypeSymbol(typeName);
    return symbol?.filePath;
  }

  private async isExternalType(typeName: string): Promise<boolean> {
    // Check if type is from standard library or external modules
    const builtinTypes = new Set([
      'string', 'number', 'boolean', 'object', 'any', 'void', 'null', 'undefined',
      'Array', 'Promise', 'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet'
    ]);

    if (builtinTypes.has(typeName)) return true;

    // Check if type is defined in the repository
    const symbol = this.findTypeSymbol(typeName);
    return !symbol;
  }
}

/**
 * Create a new TypeRelationshipMap instance
 *
 * @param repoMap Repository map to analyze
 * @returns TypeRelationshipMap instance
 */
export function createTypeRelationshipMap(repoMap: RepositoryMap): TypeRelationshipMap {
  return new TypeRelationshipMap(repoMap);
}