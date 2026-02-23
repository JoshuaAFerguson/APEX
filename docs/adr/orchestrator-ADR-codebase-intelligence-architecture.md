# ADR: Codebase Intelligence Architecture

## Status
Proposed

## Date
2025-02-22

## Context

The APEX system requires comprehensive codebase intelligence capabilities to support AI-powered development workflows. The acceptance criteria specify:

1. **CodebaseIndexer class** creates AST-aware repository map using tree-sitter
2. **Symbol resolution** for finding definitions across the codebase
3. **Import graph generation** for understanding module dependencies
4. **Type awareness** for understanding type relationships
5. **SemanticSearch** enables finding code by meaning
6. **Integration tests** pass

### Current State Analysis

A significant portion of the codebase intelligence infrastructure already exists:

#### Already Implemented ✅

| Component | Location | Status |
|-----------|----------|--------|
| TreeSitterWrapper | `orchestrator/src/codebase-intelligence/parsers/tree-sitter-wrapper.ts` | Complete |
| TypeScriptExtractor | `orchestrator/src/codebase-intelligence/extractors/typescript-extractor.ts` | Complete |
| PythonExtractor | `orchestrator/src/codebase-intelligence/extractors/python-extractor.ts` | Complete |
| CodebaseIndexer | `orchestrator/src/codebase-intelligence/indexer.ts` | Complete |
| SymbolResolver | `orchestrator/src/codebase-intelligence/symbol-resolver.ts` | Complete |
| ImportGraphBuilder | `orchestrator/src/codebase-intelligence/import-graph/import-graph-builder.ts` | Complete |

#### Types Already Defined in Core

| Type | Location | Description |
|------|----------|-------------|
| SymbolType | `core/src/types.ts:11246` | Enum of symbol types (function, class, interface, etc.) |
| CodeSymbol | `core/src/types.ts:11286` | Symbol definition with location, signature, modifiers |
| SymbolReference | `core/src/types.ts:11355` | Reference tracking with confidence scores |
| ImportEdge | `core/src/types.ts:11418` | Import relationship between files |
| CodeFile | `core/src/types.ts:11479` | File with symbols, imports, exports |
| RepositoryMap | `core/src/types.ts:11552` | Complete repository structure |

#### Needs Implementation ❌

| Component | Description | Priority |
|-----------|-------------|----------|
| SemanticSearch | Search code by meaning (natural language queries) | High |
| Reference Extraction | Track symbol usage across files (RepositoryMap.references is empty) | Medium |
| Type Relationship Graph | Build type hierarchy and dependency information | Medium |
| Incremental Indexing | Update repository map incrementally on file changes | Low |

## Decision

### 1. Architecture Overview

The codebase intelligence system follows a layered architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PUBLIC API LAYER                                  │
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐   │
│  │  CodebaseIndexer  │  │  SymbolResolver   │  │  SemanticSearch       │   │
│  │                   │  │                   │  │  (NEW)                │   │
│  │  - indexDirectory │  │  - findDefinition │  │  - searchByQuery      │   │
│  │  - getRepoMap     │  │  - findReferences │  │  - searchSimilar      │   │
│  │                   │  │  - findAtLocation │  │  - rankResults        │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘   │
│           │                       │                       │                 │
├───────────┼───────────────────────┼───────────────────────┼─────────────────┤
│           ▼                       ▼                       ▼                 │
│                           ANALYSIS LAYER                                     │
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐   │
│  │ ImportGraphBuilder│  │ ReferenceExtractor│  │  TypeRelationshipMap  │   │
│  │                   │  │ (NEW)             │  │  (NEW)                │   │
│  │  - buildGraph     │  │  - extractRefs    │  │  - buildTypeGraph     │   │
│  │  - findCircular   │  │  - resolveUsage   │  │  - findHierarchy      │   │
│  │  - getImpact      │  │                   │  │  - getImplementations │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘   │
│           │                       │                       │                 │
├───────────┼───────────────────────┼───────────────────────┼─────────────────┤
│           ▼                       ▼                       ▼                 │
│                          EXTRACTION LAYER                                    │
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐   │
│  │TypeScriptExtractor│  │  PythonExtractor  │  │  Future Extractors    │   │
│  │                   │  │                   │  │  (Go, Java, Rust)     │   │
│  │  - extract()      │  │  - extract()      │  │                       │   │
│  │  - extractFile()  │  │  - extractFile()  │  │                       │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘   │
│           │                       │                       │                 │
├───────────┼───────────────────────┼───────────────────────┼─────────────────┤
│           ▼                       ▼                       ▼                 │
│                           PARSING LAYER                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       TreeSitterWrapper                              │   │
│  │                                                                      │   │
│  │   Supported Languages:                                               │   │
│  │   - TypeScript (.ts, .tsx)    - Python (.py)                        │   │
│  │   - JavaScript (.js, .jsx)    - Go (.go)                            │   │
│  │   - Java (.java)              - Rust (.rs)                          │   │
│  │                                                                      │   │
│  │   Features:                                                          │   │
│  │   - Lazy grammar loading      - Error recovery                      │   │
│  │   - Language detection        - AST traversal                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. SemanticSearch Implementation

The SemanticSearch component enables finding code by meaning using multiple strategies:

```typescript
/**
 * SemanticSearch - Find code by meaning
 *
 * Location: packages/orchestrator/src/codebase-intelligence/semantic-search.ts
 */
export interface SemanticSearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Minimum relevance score (0-1) */
  minScore?: number;
  /** Filter by symbol types */
  symbolTypes?: SymbolType[];
  /** Filter by file patterns */
  filePatterns?: string[];
  /** Include documentation in search */
  includeDocumentation?: boolean;
  /** Search strategy */
  strategy?: 'keyword' | 'fuzzy' | 'semantic';
}

export interface SearchResult {
  /** The matched symbol */
  symbol: CodeSymbol;
  /** File containing the symbol */
  file: CodeFile;
  /** Relevance score (0-1) */
  score: number;
  /** Match type that contributed to score */
  matchType: 'name' | 'signature' | 'documentation' | 'context';
  /** Highlighted snippet showing the match */
  snippet?: string;
}

export class SemanticSearch {
  constructor(repoMap: RepositoryMap);

  /**
   * Search for code matching a natural language query
   *
   * @example
   * const results = searcher.search('function that validates email');
   * // Returns functions with names/docs related to email validation
   */
  search(query: string, options?: SemanticSearchOptions): SearchResult[];

  /**
   * Find symbols similar to a given symbol
   *
   * @example
   * const similar = searcher.findSimilar(emailValidator, { limit: 5 });
   * // Returns other validator functions with similar signatures
   */
  findSimilar(symbol: CodeSymbol, options?: SemanticSearchOptions): SearchResult[];

  /**
   * Search by example code snippet
   */
  searchByExample(codeSnippet: string, options?: SemanticSearchOptions): SearchResult[];
}
```

#### Search Ranking Algorithm

The semantic search uses a multi-factor scoring system:

```
Score = Σ(weight_i × factor_i)

Factors:
  1. Name Match (weight: 0.35)
     - Exact match: 1.0
     - Case-insensitive: 0.9
     - Contains query: 0.7
     - Fuzzy match (Levenshtein): 0.3-0.6

  2. Signature Match (weight: 0.25)
     - Parameter names match: +0.5
     - Return type match: +0.3
     - Parameter types match: +0.2

  3. Documentation Match (weight: 0.25)
     - Keywords found in JSDoc/docstring
     - TF-IDF scoring for relevance

  4. Context Match (weight: 0.15)
     - File path relevance
     - Nearby symbols relevance
     - Import relationship proximity
```

### 3. Reference Extraction (Enhancement)

The current implementation has `references: []` in RepositoryMap. This needs to be populated:

```typescript
/**
 * ReferenceExtractor - Extracts symbol usage across the codebase
 *
 * Location: packages/orchestrator/src/codebase-intelligence/reference-extractor.ts
 */
export class ReferenceExtractor {
  constructor(repoMap: RepositoryMap);

  /**
   * Extract all references from a file
   * Updates RepositoryMap.references in place
   */
  extractReferencesFromFile(
    filePath: string,
    sourceCode: string,
    language: SupportedLanguage
  ): SymbolReference[];

  /**
   * Resolve reference to its definition
   * Returns confidence score based on resolution quality
   */
  resolveReference(
    reference: SymbolReference,
    resolver: SymbolResolver
  ): { definition: SymbolDefinition; confidence: number } | null;
}
```

#### Reference Types to Track

| Reference Type | AST Patterns | Example |
|----------------|--------------|---------|
| `call` | call_expression | `myFunction()` |
| `instantiation` | new_expression | `new MyClass()` |
| `type` | type_reference | `: MyType` |
| `extension` | extends_clause | `extends BaseClass` |
| `implementation` | implements_clause | `implements MyInterface` |
| `import` | import_statement | `import { foo }` |
| `assignment` | assignment_expression | `x = foo` |

### 4. Type Relationship Map (New Component)

```typescript
/**
 * TypeRelationshipMap - Track type hierarchies and relationships
 *
 * Location: packages/orchestrator/src/codebase-intelligence/type-relationship-map.ts
 */
export interface TypeRelationship {
  /** Source type name */
  sourceType: string;
  /** Target type name */
  targetType: string;
  /** Relationship kind */
  kind: 'extends' | 'implements' | 'uses' | 'contains' | 'returns' | 'accepts';
  /** Source file */
  sourceFile: string;
  /** Target file (if internal) */
  targetFile?: string;
  /** Whether target is external (from node_modules) */
  isExternal: boolean;
}

export class TypeRelationshipMap {
  constructor(repoMap: RepositoryMap);

  /**
   * Get all types that extend/implement a given type
   */
  getImplementations(typeName: string): SymbolDefinition[];

  /**
   * Get the inheritance chain for a type
   */
  getInheritanceChain(typeName: string): SymbolDefinition[];

  /**
   * Get types that use this type (as property, parameter, return)
   */
  getUsages(typeName: string): SymbolDefinition[];

  /**
   * Build the complete type graph
   */
  buildTypeGraph(): TypeRelationship[];
}
```

### 5. Integration with Existing Components

The new components integrate with existing infrastructure:

```
                    ┌─────────────────────────────────────┐
                    │           ApexOrchestrator          │
                    │                                     │
                    │  Uses codebase intelligence for:    │
                    │  - Context-aware prompts            │
                    │  - Code understanding tasks         │
                    │  - Refactoring suggestions          │
                    └───────────────┬─────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────┐
                    │      CodebaseIntelligenceService    │
                    │              (NEW)                  │
                    │                                     │
                    │  - Coordinates all components       │
                    │  - Manages RepositoryMap lifecycle  │
                    │  - Provides unified API             │
                    └───────────────┬─────────────────────┘
                                    │
     ┌──────────────────────────────┼──────────────────────────────┐
     │                              │                              │
     ▼                              ▼                              ▼
┌────────────────┐          ┌────────────────┐          ┌────────────────┐
│CodebaseIndexer │          │ SemanticSearch │          │SymbolResolver  │
│                │          │                │          │                │
│ Creates        │          │ Searches       │          │ Resolves       │
│ RepositoryMap  │◀─────────│ RepositoryMap  │◀─────────│ definitions    │
│                │          │                │          │                │
└────────────────┘          └────────────────┘          └────────────────┘
        │                                                       ▲
        │                                                       │
        └───────────────────────────────────────────────────────┘
                         Shares RepositoryMap
```

### 6. Data Flow

```
1. Indexing Flow:
   User Request → CodebaseIndexer → TreeSitterWrapper → Extractors → RepositoryMap

2. Search Flow:
   Query → SemanticSearch → SymbolIndex → Ranking → SearchResults

3. Resolution Flow:
   Symbol → SymbolResolver → Definition Lookup → SymbolDefinition

4. Impact Analysis Flow:
   Changed File → ImportGraphBuilder → Reverse Dependencies → Impacted Files
```

### 7. File Structure

```
packages/orchestrator/src/codebase-intelligence/
├── index.ts                          # Public exports
├── parsers/
│   ├── index.ts
│   ├── types.ts
│   └── tree-sitter-wrapper.ts        # ✅ Exists
├── extractors/
│   ├── index.ts
│   ├── types.ts
│   ├── typescript-extractor.ts       # ✅ Exists
│   └── python-extractor.ts           # ✅ Exists
├── indexer.ts                        # ✅ Exists
├── symbol-resolver.ts                # ✅ Exists
├── import-graph/
│   ├── index.ts
│   ├── types.ts
│   └── import-graph-builder.ts       # ✅ Exists
├── semantic-search.ts                # ❌ NEW - To implement
├── reference-extractor.ts            # ❌ NEW - To implement
├── type-relationship-map.ts          # ❌ NEW - To implement
├── codebase-intelligence-service.ts  # ❌ NEW - Unified service
└── __tests__/
    ├── semantic-search.test.ts       # ❌ NEW
    ├── reference-extractor.test.ts   # ❌ NEW
    ├── type-relationship-map.test.ts # ❌ NEW
    ├── integration.test.ts           # Update existing
    └── acceptance.test.ts            # ❌ NEW - Full acceptance tests
```

### 8. Performance Considerations

| Operation | Target | Strategy |
|-----------|--------|----------|
| Full Index (10K files) | < 30s | Parallel processing, batch extraction |
| Symbol Search | < 100ms | Pre-built indexes, name/type hash maps |
| Reference Resolution | < 50ms | Cached file indexes, lazy loading |
| Incremental Update | < 1s per file | Hash-based change detection |

#### Memory Management

- Use weak references for large ASTs
- Implement LRU cache for parsed files
- Stream large repository maps to disk if > 100MB
- Lazy load file contents when needed

### 9. Testing Strategy

#### Unit Tests
- Each component has isolated tests
- Mock TreeSitterWrapper for extractor tests
- Use fixture files for parsing tests

#### Integration Tests
- Index real codebase directories
- Test cross-file symbol resolution
- Verify import graph accuracy
- Test search result relevance

#### Acceptance Tests (Priority)
```typescript
describe('Codebase Intelligence Acceptance', () => {
  it('indexes a TypeScript project and extracts all symbols');
  it('resolves symbol definitions across files');
  it('builds accurate import graph');
  it('finds code by natural language query');
  it('detects circular dependencies');
  it('calculates change impact correctly');
});
```

## Consequences

### Positive
- **Comprehensive code understanding** - AI agents can navigate codebases effectively
- **Semantic search** - Find code by meaning, not just text matching
- **Type awareness** - Understand type hierarchies for better refactoring
- **Import analysis** - Detect circular dependencies and calculate impact

### Negative
- **Memory usage** - Large repositories require significant memory for full index
- **Initial indexing time** - First-time indexing can be slow for large codebases
- **Maintenance** - Tree-sitter grammars need updates for language changes

### Mitigations
- Implement incremental indexing to reduce repeated work
- Use disk caching for large repository maps
- Support selective indexing (include/exclude patterns)
- Background indexing with progress reporting

## Implementation Plan

### Phase 1: SemanticSearch (Priority)
1. Implement `SemanticSearch` class with keyword/fuzzy search
2. Add search result ranking algorithm
3. Integration with SymbolResolver
4. Tests and documentation

### Phase 2: Reference Extraction
1. Implement `ReferenceExtractor` class
2. Update CodebaseIndexer to populate references
3. Enhance SymbolResolver with reference data
4. Tests

### Phase 3: Type Relationships
1. Implement `TypeRelationshipMap` class
2. Extract type hierarchy from AST
3. Integration tests

### Phase 4: Unified Service
1. Create `CodebaseIntelligenceService` facade
2. Add caching layer
3. Add incremental update support
4. Full acceptance test suite

## References

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [LSP Text Document Synchronization](https://microsoft.github.io/language-server-protocol/)
- Existing Implementation: `packages/orchestrator/src/codebase-intelligence/`
