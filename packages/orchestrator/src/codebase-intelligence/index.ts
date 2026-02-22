/**
 * Codebase Intelligence Module
 *
 * Provides intelligent code analysis capabilities including:
 * - Tree-sitter based AST parsing
 * - Multi-language support (TypeScript, JavaScript, Python, Go, Java, Rust)
 * - Language detection
 * - Symbol extraction (functions, classes, interfaces, types, etc.)
 * - Directory indexing and RepositoryMap generation
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
 * import { TypeScriptExtractor, PythonExtractor, SupportedLanguage } from '@apexcli/orchestrator/codebase-intelligence';
 *
 * const tsExtractor = TypeScriptExtractor.getInstance();
 * const tsResult = await tsExtractor.extract(sourceCode, SupportedLanguage.TypeScript);
 * console.log(tsResult.symbols); // [{ name: 'myFunction', kind: 'function', ... }]
 *
 * const pythonExtractor = PythonExtractor.getInstance();
 * const pythonResult = await pythonExtractor.extract(pythonCode, SupportedLanguage.Python);
 * console.log(pythonResult.symbols); // [{ name: 'my_class', kind: 'class', ... }]
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
