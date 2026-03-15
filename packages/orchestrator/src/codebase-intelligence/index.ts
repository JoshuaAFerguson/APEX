/**
 * Codebase Intelligence Module
 *
 * Provides intelligent code analysis capabilities including:
 * - Tree-sitter based AST parsing
 * - Multi-language support (TypeScript, JavaScript, Python, Go, Java, Rust)
 * - Language detection
 * - Symbol extraction (functions, classes, interfaces, types, etc.)
 * - Directory indexing and RepositoryMap generation
 * - Semantic search for finding code by meaning
 * - Reference extraction and resolution
 * - Type relationship analysis and hierarchy mapping
 *
 * @example
 * ```typescript
 * import { TreeSitterWrapper, SupportedLanguage } from '@apexcli/orchestrator/codebase-intelligence';
 *
 * const wrapper = TreeSitterWrapper.getInstance();
 * const result = await wrapper.parse('const x = 5;', SupportedLanguage.JavaScript);
 * ```
 *
 * @example
 * ```typescript
 * import { CodebaseIndexer } from '@apexcli/orchestrator/codebase-intelligence';
 *
 * const indexer = CodebaseIndexer.getInstance();
 * const repoMap = await indexer.indexDirectory('/path/to/project');
 * console.log(`Indexed ${repoMap.stats?.totalFiles} files with ${repoMap.stats?.totalSymbols} symbols`);
 * ```
 *
 * @example
 * ```typescript
 * import { CodebaseIntelligenceService } from '@apexcli/orchestrator/codebase-intelligence';
 *
 * const service = new CodebaseIntelligenceService();
 * await service.initialize('/path/to/project');
 *
 * // Search for code by meaning
 * const results = service.searchCode('function that validates email');
 *
 * // Find type implementations
 * const implementations = service.getImplementations('IUserService');
 *
 * // Analyze type hierarchy
 * const hierarchy = service.getTypeHierarchy('User');
 * ```
 *
 * @example
 * ```typescript
 * import { SemanticSearch, ReferenceExtractor, TypeRelationshipMap } from '@apexcli/orchestrator/codebase-intelligence';
 *
 * // Use individual components
 * const search = new SemanticSearch(repositoryMap);
 * const extractor = new ReferenceExtractor(repositoryMap);
 * const typeMap = new TypeRelationshipMap(repositoryMap);
 *
 * const searchResults = search.search('authentication function');
 * const references = await extractor.extractReferencesFromFile(filePath, sourceCode, language);
 * const typeRelationships = await typeMap.buildTypeGraph();
 * ```
 */

// Parsers
export * from './parsers/index.js';

// Extractors
export * from './extractors/index.js';

// Indexer
export { CodebaseIndexer, getCodebaseIndexer } from './indexer.js';
export type { IndexingOptions, IndexingProgress, IndexingError } from './indexer.js';

// Symbol Resolver
export { SymbolResolver } from './symbol-resolver.js';
export type {
  FindOptions,
  SymbolDefinition,
  SymbolReferenceResult,
  ResolutionStats,
} from './symbol-resolver.js';

// Import Graph Builder
export { ImportGraphBuilder, getImportGraphBuilder } from './import-graph/index.js';
export * from './import-graph/types.js';

// Semantic Search
export { SemanticSearch, createSemanticSearch } from './semantic-search.js';
export type {
  SemanticSearchOptions,
  SearchResult,
  ScoreBreakdown,
} from './semantic-search.js';

// Reference Extraction
export { ReferenceExtractor, createReferenceExtractor } from './reference-extractor.js';
export type {
  ReferenceResolution,
} from './reference-extractor.js';

// Type Relationship Analysis
export { TypeRelationshipMap, createTypeRelationshipMap } from './type-relationship-map.js';
export type {
  TypeRelationship,
  TypeUsage,
  TypeHierarchy,
} from './type-relationship-map.js';

// Type Awareness Analysis
export { TypeAwarenessAnalyzer, getTypeAwarenessAnalyzer } from './type-awareness-analyzer.js';
export type {
  TypeScriptInterface,
  InterfaceProperty,
  TypeAlias,
  TypeParameter,
  TypeAnnotation,
  TypeKind,
  FunctionTypeSignature,
  FunctionParameter,
  TypeInformation,
  TypeImport,
  TypeExport,
  TypeDependency,
  TypeAnalysisOptions,
} from './type-awareness-analyzer.js';

// Unified Service
export {
  CodebaseIntelligenceService,
  createCodebaseIntelligenceService,
  getCodebaseIntelligenceService,
} from './codebase-intelligence-service.js';
export type {
  CodebaseIntelligenceConfig,
  ServiceStatus,
  CodebaseAnalysis,
} from './codebase-intelligence-service.js';
