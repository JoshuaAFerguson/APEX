/**
 * CodebaseIntelligenceService - Unified facade for all codebase intelligence capabilities
 *
 * This service provides a single entry point for all codebase intelligence operations,
 * coordinating between indexing, search, reference extraction, and type analysis.
 * It manages the lifecycle of the RepositoryMap and provides caching for performance.
 *
 * @example
 * ```typescript
 * const service = new CodebaseIntelligenceService();
 * await service.indexDirectory('/path/to/project');
 *
 * // Search for code
 * const results = service.searchCode('function that validates email');
 *
 * // Analyze type relationships
 * const implementations = service.getImplementations('IUserService');
 *
 * // Find symbol references
 * const references = service.findReferences('calculateTotal');
 * ```
 */

import type {
  RepositoryMap,
  CodeSymbol,
  SymbolReference,
  SupportedLanguage,
} from '@apexcli/core/types';

import { CodebaseIndexer, type IndexingOptions, type IndexingProgress } from './indexer.js';
import { SymbolResolver, type FindOptions, type SymbolDefinition } from './symbol-resolver.js';
import { ImportGraphBuilder } from './import-graph/index.js';
import { SemanticSearch, type SemanticSearchOptions, type SearchResult } from './semantic-search.js';
import { ReferenceExtractor, type ReferenceResolution } from './reference-extractor.js';
import { TypeRelationshipMap, type TypeRelationship, type TypeHierarchy } from './type-relationship-map.js';

/**
 * Configuration options for the codebase intelligence service
 */
export interface CodebaseIntelligenceConfig {
  /** Enable caching of parsed files and analysis results */
  enableCaching?: boolean;
  /** Maximum cache size in MB */
  maxCacheSize?: number;
  /** Enable incremental indexing for file changes */
  enableIncrementalIndexing?: boolean;
  /** Enable background processing for large repositories */
  enableBackgroundProcessing?: boolean;
  /** Include external dependencies in analysis */
  includeExternalDependencies?: boolean;
  /** File patterns to exclude from analysis */
  excludePatterns?: string[];
  /** Maximum file size to analyze (in bytes) */
  maxFileSize?: number;
}

/**
 * Service status information
 */
export interface ServiceStatus {
  /** Whether the service is initialized */
  initialized: boolean;
  /** Whether indexing is in progress */
  indexing: boolean;
  /** Number of files indexed */
  filesIndexed: number;
  /** Number of symbols extracted */
  symbolsExtracted: number;
  /** Number of references found */
  referencesFound: number;
  /** Number of type relationships mapped */
  typeRelationships: number;
  /** Last indexing timestamp */
  lastIndexed?: Date;
  /** Cache statistics */
  cacheStats?: {
    size: number;
    hits: number;
    misses: number;
  };
}

/**
 * Comprehensive analysis result combining all intelligence capabilities
 */
export interface CodebaseAnalysis {
  /** Repository map with all files and symbols */
  repositoryMap: RepositoryMap;
  /** Symbol resolution statistics */
  symbolStats: {
    totalSymbols: number;
    byType: Record<string, number>;
    exportedSymbols: number;
  };
  /** Reference analysis */
  referenceStats: {
    totalReferences: number;
    byType: Record<string, number>;
    unresolvedReferences: number;
  };
  /** Type relationship analysis */
  typeStats: {
    totalTypes: number;
    inheritanceChains: number;
    circularDependencies: string[][];
    externalDependencies: string[];
  };
  /** Import graph analysis */
  importStats: {
    totalFiles: number;
    totalImports: number;
    circularImports: string[][];
    unresolvedImports: string[];
  };
}

/**
 * CodebaseIntelligenceService - Unified facade for codebase analysis
 *
 * Coordinates all codebase intelligence components and provides a comprehensive
 * API for analyzing and understanding codebases.
 */
export class CodebaseIntelligenceService {
  private config: Required<CodebaseIntelligenceConfig>;
  private repositoryMap?: RepositoryMap;

  // Core components
  private indexer: CodebaseIndexer;
  private resolver: SymbolResolver;
  private importGraphBuilder: ImportGraphBuilder;
  private semanticSearch?: SemanticSearch;
  private referenceExtractor?: ReferenceExtractor;
  private typeRelationshipMap?: TypeRelationshipMap;

  // Service state
  private initialized = false;
  private indexing = false;
  private cache = new Map<string, unknown>();
  private cacheStats = { hits: 0, misses: 0 };

  constructor(config: CodebaseIntelligenceConfig = {}) {
    this.config = {
      enableCaching: true,
      maxCacheSize: 100, // MB
      enableIncrementalIndexing: true,
      enableBackgroundProcessing: false,
      includeExternalDependencies: false,
      excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      ...config,
    };

    // Initialize core components
    this.indexer = CodebaseIndexer.getInstance();
    this.resolver = new SymbolResolver(this.getEmptyRepositoryMap());
    this.importGraphBuilder = ImportGraphBuilder.getInstance();
  }

  /**
   * Initialize the service and index a directory
   *
   * @param directoryPath Path to the directory to analyze
   * @param options Indexing options
   * @returns Promise that resolves when indexing is complete
   */
  async initialize(
    directoryPath: string,
    options: IndexingOptions = {}
  ): Promise<void> {
    if (this.initialized) {
      throw new Error('Service is already initialized. Call reset() first if you need to reinitialize.');
    }

    try {
      this.indexing = true;

      // Index the directory
      const indexingOptions: IndexingOptions = {
        excludePatterns: this.config.excludePatterns,
        maxFileSize: this.config.maxFileSize,
        ...options,
      };

      this.repositoryMap = await this.indexer.indexDirectory(directoryPath, indexingOptions);

      // Initialize dependent components
      await this.initializeComponents();

      // Perform additional analysis
      await this.performAdditionalAnalysis();

      this.initialized = true;
    } catch (error) {
      this.indexing = false;
      throw new Error(`Failed to initialize codebase intelligence service: ${error}`);
    } finally {
      this.indexing = false;
    }
  }

  /**
   * Update the analysis for specific files (incremental indexing)
   *
   * @param filePaths Array of file paths that changed
   * @returns Promise that resolves when update is complete
   */
  async updateFiles(filePaths: string[]): Promise<void> {
    if (!this.initialized || !this.repositoryMap) {
      throw new Error('Service must be initialized before updating files');
    }

    if (!this.config.enableIncrementalIndexing) {
      throw new Error('Incremental indexing is disabled in configuration');
    }

    try {
      // Update each file
      for (const filePath of filePaths) {
        await this.updateSingleFile(filePath);
      }

      // Refresh dependent analyses
      await this.refreshDependentAnalysis(filePaths);

    } catch (error) {
      throw new Error(`Failed to update files: ${error}`);
    }
  }

  /**
   * Search for code using natural language queries
   *
   * @param query Natural language search query
   * @param options Search options
   * @returns Array of search results
   */
  searchCode(query: string, options: SemanticSearchOptions = {}): SearchResult[] {
    this.ensureInitialized();

    if (!this.semanticSearch) {
      throw new Error('Semantic search is not available');
    }

    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cached = this.getFromCache<SearchResult[]>(cacheKey);
    if (cached) return cached;

    const results = this.semanticSearch.search(query, options);
    this.setCache(cacheKey, results);

    return results;
  }

  /**
   * Find symbols similar to a given symbol
   *
   * @param symbol Reference symbol
   * @param options Search options
   * @returns Array of similar symbols
   */
  findSimilarSymbols(symbol: CodeSymbol, options: SemanticSearchOptions = {}): SearchResult[] {
    this.ensureInitialized();

    if (!this.semanticSearch) {
      throw new Error('Semantic search is not available');
    }

    return this.semanticSearch.findSimilar(symbol, options);
  }

  /**
   * Find symbol definition
   *
   * @param symbolName Name of the symbol to find
   * @param options Find options
   * @returns Symbol definition or null if not found
   */
  async findSymbolDefinition(
    symbolName: string,
    options: FindOptions = {}
  ): Promise<SymbolDefinition | null> {
    this.ensureInitialized();

    return this.resolver.findDefinition(symbolName, options);
  }

  /**
   * Find all references to a symbol
   *
   * @param symbolName Name of the symbol to find references for
   * @param options Find options
   * @returns Array of symbol references
   */
  findReferences(symbolName: string, options: FindOptions = {}): SymbolReference[] {
    this.ensureInitialized();

    if (!this.repositoryMap) return [];

    return this.repositoryMap.references.filter(ref =>
      ref.symbolName === symbolName &&
      (!options.filePath || ref.sourceFile === options.filePath)
    );
  }

  /**
   * Get implementations of a type or interface
   *
   * @param typeName Name of the type/interface
   * @returns Array of implementations
   */
  getImplementations(typeName: string): SymbolDefinition[] {
    this.ensureInitialized();

    if (!this.typeRelationshipMap) {
      throw new Error('Type relationship mapping is not available');
    }

    return this.typeRelationshipMap.getImplementations(typeName);
  }

  /**
   * Get inheritance chain for a type
   *
   * @param typeName Name of the type
   * @returns Array of types in inheritance order
   */
  getInheritanceChain(typeName: string): SymbolDefinition[] {
    this.ensureInitialized();

    if (!this.typeRelationshipMap) {
      throw new Error('Type relationship mapping is not available');
    }

    return this.typeRelationshipMap.getInheritanceChain(typeName);
  }

  /**
   * Get type hierarchy information
   *
   * @param typeName Name of the type
   * @returns Complete hierarchy information
   */
  getTypeHierarchy(typeName: string): TypeHierarchy {
    this.ensureInitialized();

    if (!this.typeRelationshipMap) {
      throw new Error('Type relationship mapping is not available');
    }

    return this.typeRelationshipMap.getHierarchy(typeName);
  }

  /**
   * Find circular dependencies in the codebase
   *
   * @returns Array of circular dependency chains
   */
  findCircularDependencies(): {
    imports: string[][];
    types: string[][];
  } {
    this.ensureInitialized();

    const importCycles = this.importGraphBuilder.findCircularDependencies();
    const typeCycles = this.typeRelationshipMap?.findCircularDependencies() || [];

    return {
      imports: importCycles,
      types: typeCycles,
    };
  }

  /**
   * Get comprehensive codebase analysis
   *
   * @returns Complete analysis results
   */
  getAnalysis(): CodebaseAnalysis {
    this.ensureInitialized();

    if (!this.repositoryMap) {
      throw new Error('Repository map is not available');
    }

    return {
      repositoryMap: this.repositoryMap,
      symbolStats: this.calculateSymbolStats(),
      referenceStats: this.calculateReferenceStats(),
      typeStats: this.calculateTypeStats(),
      importStats: this.calculateImportStats(),
    };
  }

  /**
   * Get service status
   *
   * @returns Current service status
   */
  getStatus(): ServiceStatus {
    return {
      initialized: this.initialized,
      indexing: this.indexing,
      filesIndexed: this.repositoryMap?.files.length || 0,
      symbolsExtracted: this.getTotalSymbolCount(),
      referencesFound: this.repositoryMap?.references.length || 0,
      typeRelationships: this.typeRelationshipMap ? this.getTypeRelationshipCount() : 0,
      lastIndexed: this.repositoryMap?.stats?.indexedAt,
      cacheStats: {
        size: this.cache.size,
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
      },
    };
  }

  /**
   * Clear all caches and reset the service
   */
  reset(): void {
    this.initialized = false;
    this.indexing = false;
    this.repositoryMap = undefined;
    this.semanticSearch = undefined;
    this.referenceExtractor = undefined;
    this.typeRelationshipMap = undefined;
    this.cache.clear();
    this.cacheStats = { hits: 0, misses: 0 };
  }

  /**
   * Get repository map (read-only access)
   */
  getRepositoryMap(): Readonly<RepositoryMap> | undefined {
    return this.repositoryMap;
  }

  /**
   * Initialize all dependent components
   */
  private async initializeComponents(): Promise<void> {
    if (!this.repositoryMap) return;

    // Initialize resolver with the new repository map
    this.resolver = new SymbolResolver(this.repositoryMap);

    // Initialize semantic search
    this.semanticSearch = new SemanticSearch(this.repositoryMap);

    // Initialize reference extractor
    this.referenceExtractor = new ReferenceExtractor(this.repositoryMap);

    // Initialize type relationship map
    this.typeRelationshipMap = new TypeRelationshipMap(this.repositoryMap);
  }

  /**
   * Perform additional analysis after initial indexing
   */
  private async performAdditionalAnalysis(): Promise<void> {
    if (!this.repositoryMap || !this.referenceExtractor || !this.typeRelationshipMap) return;

    try {
      // Extract references from all files
      await this.extractAllReferences();

      // Build type relationship graph
      await this.typeRelationshipMap.buildTypeGraph();

      // Build import graph
      await this.importGraphBuilder.buildGraph(this.repositoryMap);

    } catch (error) {
      console.warn('Some additional analysis failed:', error);
    }
  }

  /**
   * Extract references from all files in the repository
   */
  private async extractAllReferences(): Promise<void> {
    if (!this.repositoryMap || !this.referenceExtractor) return;

    for (const file of this.repositoryMap.files) {
      if (file.content && this.isAnalyzableFile(file.filePath, file.language)) {
        try {
          await this.referenceExtractor.updateRepositoryMapReferences(file.filePath);
        } catch (error) {
          console.warn(`Failed to extract references from ${file.filePath}:`, error);
        }
      }
    }
  }

  /**
   * Update a single file in the repository map
   */
  private async updateSingleFile(filePath: string): Promise<void> {
    if (!this.repositoryMap) return;

    // Re-index the specific file
    // Note: This would require extending the CodebaseIndexer to support single file updates
    // For now, we'll just mark it as needing a full re-index
    console.warn(`Incremental update for ${filePath} not fully implemented`);
  }

  /**
   * Refresh dependent analysis after file changes
   */
  private async refreshDependentAnalysis(filePaths: string[]): Promise<void> {
    if (!this.referenceExtractor || !this.typeRelationshipMap) return;

    // Update references for changed files
    for (const filePath of filePaths) {
      if (this.isAnalyzableFile(filePath)) {
        await this.referenceExtractor.updateRepositoryMapReferences(filePath);
      }
    }

    // Rebuild type graph (could be optimized to only update affected types)
    await this.typeRelationshipMap.buildTypeGraph();

    // Clear related caches
    this.clearCacheByPattern(/^(search|type|reference):/);
  }

  /**
   * Calculate symbol statistics
   */
  private calculateSymbolStats() {
    if (!this.repositoryMap) {
      return { totalSymbols: 0, byType: {}, exportedSymbols: 0 };
    }

    const allSymbols = this.repositoryMap.files.flatMap(f => f.symbols);
    const byType: Record<string, number> = {};
    let exportedSymbols = 0;

    for (const symbol of allSymbols) {
      byType[symbol.type] = (byType[symbol.type] || 0) + 1;
      if (symbol.exported) exportedSymbols++;
    }

    return {
      totalSymbols: allSymbols.length,
      byType,
      exportedSymbols,
    };
  }

  /**
   * Calculate reference statistics
   */
  private calculateReferenceStats() {
    if (!this.repositoryMap) {
      return { totalReferences: 0, byType: {}, unresolvedReferences: 0 };
    }

    const byType: Record<string, number> = {};
    let unresolvedReferences = 0;

    for (const ref of this.repositoryMap.references) {
      byType[ref.referenceType || 'unknown'] = (byType[ref.referenceType || 'unknown'] || 0) + 1;
      if (ref.targetFile === 'unknown') unresolvedReferences++;
    }

    return {
      totalReferences: this.repositoryMap.references.length,
      byType,
      unresolvedReferences,
    };
  }

  /**
   * Calculate type statistics
   */
  private calculateTypeStats() {
    const circularDeps = this.findCircularDependencies();

    return {
      totalTypes: this.getTypeCount(),
      inheritanceChains: this.getInheritanceChainCount(),
      circularDependencies: circularDeps.types,
      externalDependencies: this.getExternalDependencies(),
    };
  }

  /**
   * Calculate import statistics
   */
  private calculateImportStats() {
    if (!this.repositoryMap) {
      return { totalFiles: 0, totalImports: 0, circularImports: [], unresolvedImports: [] };
    }

    const circularDeps = this.findCircularDependencies();

    return {
      totalFiles: this.repositoryMap.files.length,
      totalImports: this.repositoryMap.imports.length,
      circularImports: circularDeps.imports,
      unresolvedImports: this.getUnresolvedImports(),
    };
  }

  /**
   * Helper methods
   */

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Service must be initialized before use. Call initialize() first.');
    }
  }

  private isAnalyzableFile(filePath: string, language?: string): boolean {
    // Check exclude patterns
    for (const pattern of this.config.excludePatterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return false;
      }
    }

    // Check language support
    const analyzableLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust'];
    return language ? analyzableLanguages.includes(language.toLowerCase()) : true;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(filePath);
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.config.enableCaching) return null;

    if (this.cache.has(key)) {
      this.cacheStats.hits++;
      return this.cache.get(key) as T;
    }

    this.cacheStats.misses++;
    return null;
  }

  private setCache<T>(key: string, value: T): void {
    if (!this.config.enableCaching) return;

    // Simple cache size management
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  private clearCacheByPattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  private getEmptyRepositoryMap(): RepositoryMap {
    return {
      rootPath: '',
      files: [],
      imports: [],
      references: [],
      stats: {
        totalFiles: 0,
        totalSymbols: 0,
        indexedAt: new Date(),
        processingTimeMs: 0,
      },
    };
  }

  private getTotalSymbolCount(): number {
    return this.repositoryMap?.files.reduce((count, file) => count + file.symbols.length, 0) || 0;
  }

  private getTypeRelationshipCount(): number {
    // This would depend on the actual implementation
    return 0;
  }

  private getTypeCount(): number {
    if (!this.repositoryMap) return 0;
    return this.repositoryMap.files
      .flatMap(f => f.symbols)
      .filter(s => ['class', 'interface', 'type', 'enum'].includes(s.type))
      .length;
  }

  private getInheritanceChainCount(): number {
    // This would be calculated from type relationships
    return 0;
  }

  private getExternalDependencies(): string[] {
    // This would be extracted from import analysis
    return [];
  }

  private getUnresolvedImports(): string[] {
    if (!this.repositoryMap) return [];
    return this.repositoryMap.imports
      .filter(imp => !imp.targetFile || imp.targetFile === 'unknown')
      .map(imp => imp.importSpecifier || 'unknown');
  }
}

/**
 * Create a new CodebaseIntelligenceService instance
 *
 * @param config Service configuration
 * @returns CodebaseIntelligenceService instance
 */
export function createCodebaseIntelligenceService(
  config: CodebaseIntelligenceConfig = {}
): CodebaseIntelligenceService {
  return new CodebaseIntelligenceService(config);
}

/**
 * Get a singleton CodebaseIntelligenceService instance
 */
let serviceInstance: CodebaseIntelligenceService | null = null;

export function getCodebaseIntelligenceService(
  config?: CodebaseIntelligenceConfig
): CodebaseIntelligenceService {
  if (!serviceInstance) {
    serviceInstance = new CodebaseIntelligenceService(config);
  }
  return serviceInstance;
}