/**
 * ReferenceExtractor - Extract symbol usage patterns across the codebase
 *
 * This module analyzes AST nodes to identify where symbols are used (called,
 * instantiated, referenced) and builds a comprehensive reference graph. It
 * integrates with the existing TreeSitterWrapper and SymbolResolver to provide
 * complete cross-reference information.
 *
 * @example
 * ```typescript
 * const extractor = new ReferenceExtractor(repositoryMap);
 * const references = await extractor.extractReferencesFromFile(
 *   'src/utils/math.ts',
 *   sourceCode,
 *   SupportedLanguage.TypeScript
 * );
 * ```
 */

import type {
  RepositoryMap,
  CodeSymbol,
  SymbolReference,
} from '@apexcli/core';
import { promises as fs } from 'fs';
import * as nodePath from 'path';
import { TreeSitterWrapper } from './parsers/tree-sitter-wrapper.js';
import { SymbolResolver, type SymbolDefinition } from './symbol-resolver.js';
import { SupportedLanguage, type SyntaxNode } from './parsers/types.js';

/**
 * Reference resolution result with confidence scoring
 */
export interface ReferenceResolution {
  /** The resolved symbol definition */
  definition: SymbolDefinition;
  /** Confidence score (0-1) based on resolution quality */
  confidence: number;
  /** Resolution method used */
  method: 'exact' | 'heuristic' | 'contextual';
}

/**
 * Extraction context for maintaining state during AST traversal
 */
interface ExtractionContext {
  filePath: string;
  sourceCode: string;
  language: SupportedLanguage;
  currentScope: string[];
  imports: Map<string, string>; // local name -> original name/module
  references: SymbolReference[];
}

/**
 * AST node patterns for different reference types
 */
const REFERENCE_PATTERNS = {
  // Function/method calls
  call: ['call_expression', 'method_invocation'],

  // Class instantiation
  instantiation: ['new_expression', 'object_creation_expression'],

  // Variable/property access
  read: ['identifier', 'member_expression', 'property_access_expression'],

  // Assignments
  write: ['assignment_expression', 'variable_declaration'],

  // Type references
  type: ['type_identifier', 'type_reference', 'generic_type'],

  // Import statements
  import: ['import_statement', 'import_declaration', 'from_import_statement'],

  // Class inheritance
  extension: ['extends_clause', 'superclass'],

  // Interface implementation
  implementation: ['implements_clause', 'interface_list'],

  // Decorators
  decorator: ['decorator', 'annotation'],
} as const;

/**
 * ReferenceExtractor class - Extract symbol usage across the codebase
 *
 * Analyzes source code to identify all locations where symbols are referenced,
 * building a comprehensive cross-reference graph for the repository.
 */
export class ReferenceExtractor {
  private repoMap: RepositoryMap;
  private treeWrapper: TreeSitterWrapper;
  private resolver: SymbolResolver;

  constructor(repoMap: RepositoryMap) {
    this.repoMap = repoMap;
    this.treeWrapper = TreeSitterWrapper.getInstance();
    this.resolver = new SymbolResolver(repoMap);
  }

  /**
   * Extract all references from a source file
   *
   * @param filePath Path to the file being analyzed
   * @param sourceCode Source code content
   * @param language Programming language of the file
   * @returns Array of symbol references found in the file
   */
  async extractReferencesFromFile(
    filePath: string,
    sourceCode: string,
    language: SupportedLanguage
  ): Promise<SymbolReference[]> {
    try {
      // Parse the source code
      const parseResult = await this.treeWrapper.parse(sourceCode, language);
      if (parseResult.hasErrors || !parseResult.tree) {
        console.warn(`Failed to parse ${filePath} for reference extraction`);
        return [];
      }

      // Create extraction context
      const context: ExtractionContext = {
        filePath,
        sourceCode,
        language,
        currentScope: [],
        imports: new Map(),
        references: [],
      };

      // First pass: collect imports and scope information
      await this.collectImports(parseResult.tree.rootNode, context);

      // Second pass: extract references
      await this.extractReferencesFromNode(parseResult.tree.rootNode, context);

      return context.references;
    } catch {
      // Silently skip files that fail to parse (grammar issues, unsupported syntax, etc.)
      return [];
    }
  }

  /**
   * Resolve a reference to its definition with confidence scoring
   *
   * @param reference Symbol reference to resolve
   * @returns Resolution result or null if not found
   */
  async resolveReference(reference: SymbolReference): Promise<ReferenceResolution | null> {
    try {
      // Try exact symbol resolution first
      const exactMatches = this.resolver.findDefinition(reference.symbolName, {
        filePath: reference.sourceFile,
      });

      if (exactMatches.length > 0) {
        return {
          definition: exactMatches[0],
          confidence: 0.9,
          method: 'exact',
        };
      }

      // Try heuristic resolution based on symbol type and context
      const heuristicMatch = await this.heuristicResolve(reference);
      if (heuristicMatch) {
        return {
          definition: heuristicMatch,
          confidence: 0.6,
          method: 'heuristic',
        };
      }

      // Try contextual resolution using surrounding code
      const contextualMatch = await this.contextualResolve(reference);
      if (contextualMatch) {
        return {
          definition: contextualMatch,
          confidence: 0.4,
          method: 'contextual',
        };
      }

      return null;
    } catch (error) {
      console.error(`Error resolving reference ${reference.symbolName}:`, error);
      return null;
    }
  }

  /**
   * Update repository map with extracted references
   *
   * @param filePath File to update references for
   */
  async updateRepositoryMapReferences(filePath: string): Promise<void> {
    const file = this.repoMap.files.find((f) => f.path === filePath);
    if (!file) {
      console.warn(`File ${filePath} not found in repository map`);
      return;
    }

    try {
      // Read file content from disk since CodeFile doesn't store content
      const absolutePath = nodePath.isAbsolute(filePath)
        ? filePath
        : nodePath.join(this.repoMap.rootPath, filePath);
      const content = await fs.readFile(absolutePath, 'utf-8');

      // Extract references from the file
      const references = await this.extractReferencesFromFile(
        filePath,
        content,
        file.language as SupportedLanguage
      );

      // Add to global references (avoiding duplicates)
      for (const reference of references) {
        const exists = this.repoMap.references.some((existing: SymbolReference) =>
          existing.symbolName === reference.symbolName &&
          existing.sourceFile === reference.sourceFile &&
          existing.sourceLine === reference.sourceLine &&
          existing.sourceColumn === reference.sourceColumn
        );

        if (!exists) {
          this.repoMap.references.push(reference);
        }
      }
    } catch (error) {
      console.error(`Failed to update references for ${filePath}:`, error);
    }
  }

  /**
   * Collect import statements and build local name mapping
   */
  private async collectImports(node: SyntaxNode, context: ExtractionContext): Promise<void> {
    if (this.isImportNode(node)) {
      await this.processImportNode(node, context);
    }

    // Recursively process child nodes
    for (const child of node.children) {
      await this.collectImports(child, context);
    }
  }

  /**
   * Extract references from AST node recursively
   */
  private async extractReferencesFromNode(node: SyntaxNode, context: ExtractionContext): Promise<void> {
    // Update scope context
    if (this.isScopeNode(node)) {
      const scopeName = this.extractScopeName(node);
      if (scopeName) {
        context.currentScope.push(scopeName);
      }
    }

    // Check if this node represents a reference
    const reference = await this.extractReferenceFromNode(node, context);
    if (reference) {
      context.references.push(reference);
    }

    // Recursively process child nodes
    for (const child of node.children) {
      await this.extractReferencesFromNode(child, context);
    }

    // Pop scope when exiting
    if (this.isScopeNode(node)) {
      const scopeName = this.extractScopeName(node);
      if (scopeName && context.currentScope[context.currentScope.length - 1] === scopeName) {
        context.currentScope.pop();
      }
    }
  }

  /**
   * Extract a single reference from an AST node
   */
  private async extractReferenceFromNode(
    node: SyntaxNode,
    context: ExtractionContext
  ): Promise<SymbolReference | null> {
    const nodeType = node.type;
    const referenceType = this.determineReferenceType(node, context);

    if (!referenceType) {
      return null;
    }

    const symbolName = this.extractSymbolName(node, context);
    if (!symbolName) {
      return null;
    }

    // Get position information
    const position = this.getNodePosition(node, context.sourceCode);

    // Resolve target file if possible
    const targetFile = await this.resolveTargetFile(symbolName, context);

    return {
      symbolName,
      symbolType: this.inferSymbolType(node, context),
      sourceFile: context.filePath,
      sourceLine: position.line,
      sourceColumn: position.column,
      targetFile: targetFile || 'unknown',
      referenceType,
      isDynamic: this.isDynamicReference(node, context),
      confidence: this.calculateReferenceConfidence(node, context),
    };
  }

  /**
   * Process import/require statements
   */
  private async processImportNode(node: SyntaxNode, context: ExtractionContext): Promise<void> {
    try {
      const importInfo = this.extractImportInfo(node, context);

      for (const [localName, originalName] of importInfo.bindings) {
        context.imports.set(localName, originalName);

        // Create reference entry for the import
        const position = this.getNodePosition(node, context.sourceCode);
        const reference: SymbolReference = {
          symbolName: originalName,
          sourceFile: context.filePath,
          sourceLine: position.line,
          sourceColumn: position.column,
          targetFile: importInfo.module || 'unknown',
          referenceType: 'import',
          confidence: 0.9,
        };

        context.references.push(reference);
      }
    } catch (error) {
      console.error('Error processing import node:', error);
    }
  }

  /**
   * Determine the type of reference based on AST context
   */
  private determineReferenceType(node: SyntaxNode, context: ExtractionContext): SymbolReference['referenceType'] {
    const nodeType = node.type;
    const parentType = node.parent?.type;

    // Check against known patterns
    for (const [refType, patterns] of Object.entries(REFERENCE_PATTERNS)) {
      if ((patterns as readonly string[]).includes(nodeType) || (parentType && (patterns as readonly string[]).includes(parentType))) {
        return refType as SymbolReference['referenceType'];
      }
    }

    // Context-based inference
    if (parentType === 'call_expression' && node === node.parent?.children[0]) {
      return 'call';
    }

    if (parentType === 'new_expression') {
      return 'instantiation';
    }

    if (parentType === 'assignment_expression' && node === node.parent?.children[0]) {
      return 'write';
    }

    if (this.isTypeContext(node)) {
      return 'type';
    }

    // Default to read access
    return 'read';
  }

  /**
   * Extract symbol name from AST node
   */
  private extractSymbolName(node: SyntaxNode, context: ExtractionContext): string | null {
    // Handle different node types
    if (node.type === 'identifier' || node.type === 'type_identifier') {
      return this.getNodeText(node, context.sourceCode);
    }

    // For member expressions, get the property name
    if (node.type === 'member_expression' || node.type === 'property_access_expression') {
      const property = node.children.find(child =>
        child.type === 'property_identifier' || child.type === 'identifier'
      );
      if (property) {
        return this.getNodeText(property, context.sourceCode);
      }
    }

    // For call expressions, get the function name
    if (node.type === 'call_expression') {
      const callee = node.children[0];
      return this.extractSymbolName(callee, context);
    }

    return null;
  }

  /**
   * Infer symbol type from context
   */
  private inferSymbolType(node: SyntaxNode, context: ExtractionContext): SymbolReference['symbolType'] {
    const parentType = node.parent?.type;

    if (parentType === 'call_expression') return 'function';
    if (parentType === 'new_expression') return 'class';
    if (this.isTypeContext(node)) return 'type';
    if (parentType === 'extends_clause') return 'class';
    if (parentType === 'implements_clause') return 'interface';

    return undefined;
  }

  /**
   * Get node position in source code
   */
  private getNodePosition(node: SyntaxNode, sourceCode: string): { line: number; column: number } {
    const position = node.startPosition;
    return {
      line: position.row + 1, // Convert to 1-based
      column: position.column,
    };
  }

  /**
   * Get text content of an AST node
   */
  private getNodeText(node: SyntaxNode, sourceCode: string): string {
    return sourceCode.slice(node.startIndex, node.endIndex);
  }

  /**
   * Check if node represents an import statement
   */
  private isImportNode(node: SyntaxNode): boolean {
    return (REFERENCE_PATTERNS.import as readonly string[]).includes(node.type);
  }

  /**
   * Check if node creates a new scope
   */
  private isScopeNode(node: SyntaxNode): boolean {
    const scopeTypes = [
      'function_declaration',
      'method_definition',
      'class_declaration',
      'interface_declaration',
      'namespace_declaration',
      'block_statement',
    ];
    return scopeTypes.includes(node.type);
  }

  /**
   * Extract scope name from AST node
   */
  private extractScopeName(node: SyntaxNode): string | null {
    // Find identifier child
    const identifier = node.children.find(child =>
      child.type === 'identifier' || child.type === 'type_identifier'
    );

    if (identifier) {
      return identifier.text || null;
    }

    return null;
  }

  /**
   * Check if node is in a type context
   */
  private isTypeContext(node: SyntaxNode): boolean {
    let current = node.parent;
    while (current) {
      if (current.type === 'type_annotation' ||
          current.type === 'generic_type' ||
          current.type === 'type_reference') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if reference is dynamic (computed/runtime)
   */
  private isDynamicReference(node: SyntaxNode, context: ExtractionContext): boolean {
    // Check for computed property access
    if (node.parent?.type === 'subscript_expression') {
      return true;
    }

    // Check for dynamic imports
    if (node.parent?.type === 'call_expression') {
      const callee = node.parent.children[0];
      if (this.getNodeText(callee, context.sourceCode) === 'import') {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate confidence score for reference
   */
  private calculateReferenceConfidence(node: SyntaxNode, context: ExtractionContext): number {
    let confidence = 0.8; // Base confidence

    // Higher confidence for direct identifiers
    if (node.type === 'identifier') {
      confidence += 0.1;
    }

    // Lower confidence for dynamic references
    if (this.isDynamicReference(node, context)) {
      confidence -= 0.3;
    }

    // Higher confidence if symbol is imported
    const symbolName = this.extractSymbolName(node, context);
    if (symbolName && context.imports.has(symbolName)) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract import information from import node
   */
  private extractImportInfo(node: SyntaxNode, context: ExtractionContext): {
    module: string | null;
    bindings: Map<string, string>;
  } {
    const bindings = new Map<string, string>();
    let module: string | null = null;

    // This is a simplified implementation - real implementation would
    // handle different import syntaxes for different languages
    try {
      const nodeText = this.getNodeText(node, context.sourceCode);

      // Extract module name (handle both string literals and bare imports)
      const moduleMatch = nodeText.match(/from\s+['"`]([^'"`]+)['"`]/) ||
                         nodeText.match(/import\s+['"`]([^'"`]+)['"`]/);
      if (moduleMatch) {
        module = moduleMatch[1];
      }

      // Extract named imports
      const namedMatch = nodeText.match(/\{([^}]+)\}/);
      if (namedMatch) {
        const imports = namedMatch[1].split(',');
        for (const imp of imports) {
          const cleanImp = imp.trim();
          const aliasMatch = cleanImp.match(/(\w+)\s+as\s+(\w+)/);
          if (aliasMatch) {
            bindings.set(aliasMatch[2], aliasMatch[1]);
          } else {
            bindings.set(cleanImp, cleanImp);
          }
        }
      }

      // Extract default imports
      const defaultMatch = nodeText.match(/import\s+(\w+)\s+from/);
      if (defaultMatch) {
        bindings.set(defaultMatch[1], 'default');
      }

    } catch (error) {
      console.error('Error extracting import info:', error);
    }

    return { module, bindings };
  }

  /**
   * Resolve target file for a symbol reference
   */
  private async resolveTargetFile(
    symbolName: string,
    context: ExtractionContext
  ): Promise<string | null> {
    // Check if it's an imported symbol
    if (context.imports.has(symbolName)) {
      // Try to resolve the import to actual file
      return this.resolveImportToFile(symbolName, context);
    }

    // Try to find definition in current repository
    const definitions = this.resolver.findDefinition(symbolName, {
      filePath: context.filePath,
    });

    return definitions.length > 0 ? definitions[0].filePath : null;
  }

  /**
   * Resolve import to actual file path
   */
  private resolveImportToFile(symbolName: string, context: ExtractionContext): string | null {
    // This is simplified - real implementation would handle module resolution
    const originalName = context.imports.get(symbolName);
    if (!originalName) return null;

    // Look for files that export this symbol
    for (const file of this.repoMap.files as any[]) {
      for (const symbol of file.symbols as CodeSymbol[]) {
        if (symbol.name === originalName && symbol.exported) {
          return file.filePath;
        }
      }
    }

    return null;
  }

  /**
   * Heuristic symbol resolution using pattern matching
   */
  private async heuristicResolve(reference: SymbolReference): Promise<SymbolDefinition | null> {
    // Find symbols with similar names in related files
    const candidates = this.repoMap.files
      .flatMap((file) => file.symbols)
      .filter((symbol: CodeSymbol) =>
        symbol.name === reference.symbolName ||
        this.isNameVariant(symbol.name, reference.symbolName)
      );

    // Score candidates based on context
    const scored = candidates.map((symbol: CodeSymbol) => ({
      symbol,
      score: this.calculateHeuristicScore(symbol, reference),
    }));

    // Return highest scoring candidate
    scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    const best = scored[0];

    if (best && best.score > 0.3) {
      const matchFile = this.repoMap.files.find((f) => f.path === best.symbol.filePath);
      if (matchFile) {
        return {
          symbol: best.symbol,
          file: matchFile,
          filePath: best.symbol.filePath,
          confidence: best.score,
          isReExport: false,
        };
      }
    }

    return null;
  }

  /**
   * Contextual symbol resolution using surrounding code
   */
  private async contextualResolve(reference: SymbolReference): Promise<SymbolDefinition | null> {
    // This would analyze the context around the reference to infer the symbol
    // For now, return null (would be implemented based on specific language patterns)
    return null;
  }

  /**
   * Check if two names are variants of each other
   */
  private isNameVariant(name1: string, name2: string): boolean {
    // Simple heuristics for name matching
    const lower1 = name1.toLowerCase();
    const lower2 = name2.toLowerCase();

    // Exact case-insensitive match
    if (lower1 === lower2) return true;

    // One is substring of other
    if (lower1.includes(lower2) || lower2.includes(lower1)) return true;

    // Remove common prefixes/suffixes
    const stripped1 = lower1.replace(/^(get|set|is|has|can)/, '').replace(/(er|ed|ing)$/, '');
    const stripped2 = lower2.replace(/^(get|set|is|has|can)/, '').replace(/(er|ed|ing)$/, '');

    if (stripped1 === stripped2) return true;

    return false;
  }

  /**
   * Calculate heuristic matching score
   */
  private calculateHeuristicScore(symbol: CodeSymbol, reference: SymbolReference): number {
    let score = 0;

    // Exact name match
    if (symbol.name === reference.symbolName) {
      score += 0.8;
    } else if (this.isNameVariant(symbol.name, reference.symbolName)) {
      score += 0.4;
    }

    // Type compatibility
    if (symbol.type === reference.symbolType) {
      score += 0.2;
    }

    // File proximity (same directory gets bonus)
    const refDir = reference.sourceFile.split('/').slice(0, -1).join('/');
    const symDir = symbol.filePath.split('/').slice(0, -1).join('/');
    if (refDir === symDir) {
      score += 0.1;
    }

    return Math.min(1, score);
  }
}

/**
 * Create a new ReferenceExtractor instance
 *
 * @param repoMap Repository map to extract references from
 * @returns ReferenceExtractor instance
 */
export function createReferenceExtractor(repoMap: RepositoryMap): ReferenceExtractor {
  return new ReferenceExtractor(repoMap);
}