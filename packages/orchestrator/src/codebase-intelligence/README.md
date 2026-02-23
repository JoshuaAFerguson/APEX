# Codebase Intelligence Module

The Codebase Intelligence module provides advanced code analysis capabilities for APEX, enabling AI agents to understand and navigate complex codebases with intelligent insights.

## Overview

This module offers a comprehensive suite of tools for analyzing codebases:

- **Tree-sitter based AST parsing** for accurate syntax understanding
- **Multi-language support** (TypeScript, JavaScript, Python, Go, Java, Rust, C++)
- **Symbol extraction and resolution** across files
- **Import graph generation** for dependency analysis
- **Type relationship mapping** and hierarchy analysis
- **Semantic search** for finding code by meaning
- **Reference tracking** for understanding code usage

## Architecture

The module is organized into several key components:

```
codebase-intelligence/
├── parsers/              # Tree-sitter wrapper and language detection
├── extractors/           # Symbol extraction for different languages
├── indexer.ts           # Main indexing orchestration
├── symbol-resolver.ts   # Cross-file symbol resolution
├── semantic-search.ts   # Natural language code search
├── reference-extractor.ts # Reference tracking and resolution
├── type-relationship-map.ts # Type hierarchy analysis
├── import-graph/        # Import dependency analysis
└── codebase-intelligence-service.ts # Unified facade API
```

## Quick Start

### Basic Usage

```typescript
import { CodebaseIntelligenceService } from '@apexcli/orchestrator/codebase-intelligence';

// Initialize the service
const service = new CodebaseIntelligenceService({
  enableCaching: true,
  includeExternalDependencies: false,
});

// Index a codebase
await service.initialize('/path/to/project');

// Search for code by meaning
const results = service.searchCode('function that validates email');

// Find symbol definitions
const definition = await service.findSymbolDefinition('UserService');

// Analyze type relationships
const hierarchy = service.getTypeHierarchy('User');

// Check for circular dependencies
const circular = service.findCircularDependencies();
```

### Using Individual Components

```typescript
import {
  CodebaseIndexer,
  TreeSitterWrapper,
  SemanticSearch,
  SymbolResolver
} from '@apexcli/orchestrator/codebase-intelligence';

// Index a directory
const indexer = CodebaseIndexer.getInstance();
const repositoryMap = await indexer.indexDirectory('/path/to/project');

// Parse code directly
const wrapper = TreeSitterWrapper.getInstance();
const parseResult = await wrapper.parse(sourceCode, 'typescript');

// Search through indexed code
const search = new SemanticSearch(repositoryMap);
const results = search.search('authentication function');

// Resolve symbol references
const resolver = new SymbolResolver(repositoryMap);
const definition = await resolver.findDefinition('MyClass');
```

## Features

### 1. AST-Aware Code Parsing

Uses tree-sitter parsers to build accurate Abstract Syntax Trees:

- **Precise symbol extraction** with exact position information
- **Syntax error handling** and recovery
- **Support for 7+ programming languages**
- **Fast incremental parsing** for large codebases

### 2. Symbol Resolution

Cross-file symbol resolution with context awareness:

```typescript
// Find where a symbol is defined
const definition = await service.findSymbolDefinition('APIClient');

// Find all references to a symbol
const references = service.findReferences('APIClient');

// Get implementations of an interface
const implementations = service.getImplementations('IUserService');
```

### 3. Import Dependency Analysis

Generate comprehensive import graphs:

```typescript
const repoMap = service.getRepositoryMap();

// Access import relationships
console.log(`Found ${repoMap.imports.length} import edges`);

// Check for circular dependencies
const circular = service.findCircularDependencies();
if (circular.imports.length > 0) {
  console.log('Circular import dependencies detected!');
}
```

### 4. Type Hierarchy Analysis

Understand inheritance and type relationships:

```typescript
// Get complete type hierarchy
const hierarchy = service.getTypeHierarchy('BaseComponent');
console.log('Implements interfaces:', hierarchy.interfaces);
console.log('Extended by classes:', hierarchy.descendants);

// Find inheritance chains
const chain = service.getInheritanceChain('SpecializedComponent');
chain.forEach(item => console.log(item.symbol.name));
```

### 5. Semantic Search

Find code using natural language descriptions:

```typescript
// Search by functionality
const results = service.searchCode('function that handles user authentication');

// Filter by symbol types
const classes = service.searchCode('user management', {
  symbolTypes: ['class', 'interface']
});

// Use different search strategies
const fuzzyResults = service.searchCode('usr svc', { strategy: 'fuzzy' });
const keywordResults = service.searchCode('UserService', { strategy: 'keyword' });
```

### 6. Performance Optimizations

Built-in caching and performance features:

- **Intelligent caching** of parsed ASTs and symbol maps
- **Concurrent processing** for large codebases
- **Memory-efficient** incremental indexing
- **Configurable timeouts** and limits

## Configuration

### Service Configuration

```typescript
const service = new CodebaseIntelligenceService({
  // Enable caching for better performance
  enableCaching: true,

  // Include node_modules and external dependencies
  includeExternalDependencies: false,

  // Concurrency settings
  maxConcurrentFiles: 10,

  // Timeout for large codebases (milliseconds)
  indexingTimeout: 60000,

  // File size limits
  maxFileSize: 1024 * 1024, // 1MB

  // Supported file extensions
  supportedExtensions: ['.ts', '.js', '.py', '.go', '.java', '.rs']
});
```

### Search Configuration

```typescript
const searchResults = service.searchCode('validation logic', {
  // Search strategy: 'semantic', 'keyword', or 'fuzzy'
  strategy: 'semantic',

  // Filter by symbol types
  symbolTypes: ['function', 'method'],

  // Maximum number of results
  maxResults: 50,

  // Minimum relevance score (0-1)
  minScore: 0.3
});
```

## Supported Languages

The module supports the following programming languages:

| Language   | Extension | Symbol Extraction | Type Analysis |
|------------|-----------|-------------------|---------------|
| TypeScript | `.ts`, `.tsx` | ✅ | ✅ |
| JavaScript | `.js`, `.jsx` | ✅ | ✅ |
| Python     | `.py` | ✅ | ✅ |
| Go         | `.go` | ✅ | ✅ |
| Java       | `.java` | ✅ | ✅ |
| Rust       | `.rs` | ✅ | ✅ |
| C++        | `.cpp`, `.hpp` | ✅ | ✅ |

## API Reference

### CodebaseIntelligenceService

The main facade class providing unified access to all functionality.

#### Methods

- `initialize(projectPath: string): Promise<void>` - Index a codebase
- `searchCode(query: string, options?: SearchOptions): SearchResult[]` - Search by natural language
- `findSymbolDefinition(name: string, context?: FindOptions): Promise<SymbolDefinition | null>` - Find symbol definition
- `findReferences(symbolName: string): ReferenceResult[]` - Find all symbol references
- `getTypeHierarchy(typeName: string): TypeHierarchy` - Get type inheritance hierarchy
- `getImplementations(interfaceName: string): ImplementationResult[]` - Find interface implementations
- `findCircularDependencies(): CircularDependencyResult` - Detect circular dependencies
- `getRepositoryMap(): RepositoryMap` - Get complete repository structure
- `getAnalysis(): CodebaseAnalysis` - Get comprehensive analysis
- `getStatus(): ServiceStatus` - Get service status and statistics

### Component Classes

- `CodebaseIndexer` - Core indexing functionality
- `TreeSitterWrapper` - AST parsing with tree-sitter
- `SemanticSearch` - Natural language code search
- `SymbolResolver` - Cross-file symbol resolution
- `ReferenceExtractor` - Reference tracking and extraction
- `TypeRelationshipMap` - Type hierarchy and relationships
- `ImportGraphBuilder` - Import dependency analysis

## Examples

### Complete Analysis Workflow

```typescript
import { CodebaseIntelligenceService } from '@apexcli/orchestrator/codebase-intelligence';

async function analyzeProject() {
  const service = new CodebaseIntelligenceService();

  console.log('Indexing codebase...');
  await service.initialize('./my-project');

  // Get overview
  const analysis = service.getAnalysis();
  console.log(`Indexed ${analysis.repositoryMap.files.length} files`);
  console.log(`Found ${analysis.symbolStats.totalSymbols} symbols`);

  // Search for specific functionality
  const authFunctions = service.searchCode('authentication and login');
  console.log(`Found ${authFunctions.length} auth-related symbols`);

  // Analyze a specific class
  if (authFunctions.length > 0) {
    const authSymbol = authFunctions[0];
    const hierarchy = service.getTypeHierarchy(authSymbol.symbol.name);
    console.log(`${authSymbol.symbol.name} implements:`, hierarchy.interfaces);
  }

  // Check code quality
  const circular = service.findCircularDependencies();
  if (circular.imports.length > 0) {
    console.warn('Found circular dependencies:', circular.imports);
  }
}

analyzeProject();
```

### Real-time Code Understanding

```typescript
// Monitor symbol usage patterns
function analyzeSymbolUsage(symbolName: string) {
  const definition = await service.findSymbolDefinition(symbolName);
  const references = service.findReferences(symbolName);
  const similar = service.findSimilarSymbols(definition.symbol);

  console.log(`Symbol: ${symbolName}`);
  console.log(`Defined in: ${definition.filePath}`);
  console.log(`Referenced ${references.length} times`);
  console.log(`Similar symbols: ${similar.map(s => s.symbol.name).join(', ')}`);
}

// Find refactoring opportunities
function findRefactoringOpportunities() {
  const analysis = service.getAnalysis();

  // Find large functions that might need splitting
  const largeFunctions = analysis.repositoryMap.files
    .flatMap(f => f.symbols)
    .filter(s => s.type === 'function')
    .filter(s => (s.endLine - s.startLine) > 50);

  console.log(`Found ${largeFunctions.length} functions with >50 lines`);

  // Find unused symbols
  const allSymbols = analysis.repositoryMap.files.flatMap(f => f.symbols);
  const referencedSymbols = new Set(
    service.findReferences('*').map(ref => ref.symbolName)
  );

  const unusedSymbols = allSymbols.filter(s => !referencedSymbols.has(s.name));
  console.log(`Found ${unusedSymbols.length} potentially unused symbols`);
}
```

## Testing

The module includes comprehensive tests:

```bash
# Run all codebase intelligence tests
npm test -- codebase-intelligence

# Run specific test suites
npm test -- codebase-intelligence/indexer
npm test -- codebase-intelligence/semantic-search
npm test -- codebase-intelligence/integration

# Run full workflow integration tests
npm test -- codebase-intelligence/full-workflow-integration
```

## Performance

### Benchmarks

Typical performance on a medium-sized TypeScript project (~100 files, ~10k LOC):

- **Initial indexing**: 2-5 seconds
- **Incremental updates**: 100-500ms
- **Symbol resolution**: <10ms
- **Semantic search**: 50-200ms
- **Memory usage**: 50-100MB

### Optimization Tips

1. **Enable caching** for repeated operations
2. **Exclude large directories** like `node_modules`
3. **Use file size limits** to skip very large files
4. **Adjust concurrency** based on available CPU cores
5. **Use incremental indexing** for frequent updates

## Troubleshooting

### Common Issues

**Large memory usage:**
```typescript
// Reduce memory usage
const service = new CodebaseIntelligenceService({
  maxFileSize: 512 * 1024, // Smaller file limit
  includeExternalDependencies: false,
  maxConcurrentFiles: 5 // Reduce concurrency
});
```

**Slow indexing:**
```typescript
// Improve indexing speed
const service = new CodebaseIntelligenceService({
  enableCaching: true,
  maxConcurrentFiles: 10, // Increase concurrency
  indexingTimeout: 120000 // Longer timeout
});
```

**Missing symbols:**
- Check that file extensions are supported
- Verify files are syntactically valid
- Ensure files are not excluded by gitignore patterns

## Contributing

Contributions to the Codebase Intelligence module are welcome! Areas for improvement:

- **Additional language support** (C#, PHP, Ruby, etc.)
- **Enhanced type analysis** for complex inheritance patterns
- **Performance optimizations** for very large codebases
- **Machine learning integration** for smarter semantic search
- **IDE integration** for real-time analysis

## License

This module is part of APEX and follows the same MIT license terms.

---

For more information, see the [APEX documentation](../../README.md) and [API examples](./examples/).