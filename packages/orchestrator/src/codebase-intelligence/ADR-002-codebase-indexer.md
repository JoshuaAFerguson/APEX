# ADR-002: CodebaseIndexer Architecture

## Status

Proposed

## Context

APEX requires a mechanism to index entire codebases and generate structured `RepositoryMap` objects that capture the complete code intelligence data: symbols (functions, classes, interfaces, etc.), file metadata, and import relationships. This enables:

1. **Code Navigation**: Finding symbol definitions and references across files
2. **Dependency Analysis**: Understanding import/export relationships
3. **AI Context**: Providing Claude agents with comprehensive codebase understanding
4. **Change Detection**: Tracking modifications through content hashes

The codebase-intelligence module already provides:
- `TreeSitterWrapper`: Multi-language AST parsing with lazy-loaded language grammars
- `TypeScriptExtractor`: Symbol extraction for TypeScript/JavaScript/TSX
- `PythonExtractor`: Symbol extraction for Python
- `getExtractorForLanguage()`: Factory to get appropriate extractor

## Decision

### 1. Class Design: CodebaseIndexer

Create a `CodebaseIndexer` class at `packages/orchestrator/src/codebase-intelligence/indexer.ts` that:

- Uses singleton pattern (consistent with `TreeSitterWrapper` and extractors)
- Provides `indexDirectory(path: string, options?: IndexingOptions): Promise<RepositoryMap>`
- Leverages existing `TreeSitterWrapper` and extractors via factory pattern
- Filters files by supported extensions from `EXTENSION_LANGUAGE_MAP`
- Uses Node.js `fs` and `glob` package for directory traversal

### 2. Core Interface

```typescript
export interface IndexingOptions {
  /** File patterns to include (glob patterns) */
  includePatterns?: string[];

  /** File patterns to exclude (glob patterns) */
  excludePatterns?: string[];

  /** Maximum file size in bytes to process (0 = unlimited) */
  maxFileSize?: number;

  /** Whether to extract documentation comments */
  includeDocumentation?: boolean;

  /** Whether to extract function/method signatures */
  includeSignatures?: boolean;

  /** Maximum depth for nested symbols (classes with methods, etc.) */
  maxSymbolDepth?: number;

  /** Whether to compute content hashes for change detection */
  computeHashes?: boolean;

  /** Whether to continue processing on individual file errors */
  continueOnError?: boolean;

  /** Concurrency limit for parallel file processing */
  concurrency?: number;
}

export interface IndexingProgress {
  /** Current file being processed */
  currentFile: string;
  /** Number of files processed */
  filesProcessed: number;
  /** Total files to process */
  totalFiles: number;
  /** Errors encountered so far */
  errors: IndexingError[];
}

export interface IndexingError {
  file: string;
  message: string;
  severity: 'warning' | 'error';
}
```

### 3. Method Signature

```typescript
class CodebaseIndexer {
  private static instance: CodebaseIndexer | null = null;
  private wrapper: TreeSitterWrapper;

  public static getInstance(): CodebaseIndexer;
  public static resetInstance(): void;

  /**
   * Index a directory and return a RepositoryMap
   */
  public async indexDirectory(
    path: string,
    options?: IndexingOptions
  ): Promise<RepositoryMap>;

  /**
   * Index with progress callback for UI updates
   */
  public async indexDirectoryWithProgress(
    path: string,
    options?: IndexingOptions,
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<RepositoryMap>;
}
```

### 4. Data Flow

```
indexDirectory(path)
       │
       ▼
┌──────────────────┐
│  Discover Files  │ ← glob for supported extensions
│  (glob package)  │   filter by includePatterns/excludePatterns
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Parallel Process │ ← limit concurrency (default: 4)
│   Each File      │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ Parse  │ │ Extract│ ← TreeSitterWrapper.parseFile()
│  AST   │ │ Stats  │   fs.stat for metadata
└────┬───┘ └────┬───┘
     │          │
     ▼          │
┌────────────┐  │
│  Extract   │──┘ ← getExtractorForLanguage()
│  Symbols   │     Convert ExtractedSymbol → CodeSymbol
└────┬───────┘
     │
     ▼
┌────────────────┐
│ Convert to     │ ← Map ExtractedSymbol to CodeSymbol
│ CodeFile       │   Map ExtractionResult to CodeFile
└────────┬───────┘
         │
         ▼
┌────────────────┐
│  Aggregate     │ ← Combine all CodeFile entries
│  Results       │   Calculate stats
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ Build Repo Map │ ← Construct RepositoryMap object
│                │   Add metadata, stats, errors
└────────┬───────┘
         │
         ▼
    RepositoryMap
```

### 5. Symbol Type Mapping

Map `SymbolKind` (from extractors) to `SymbolType` (from core types):

| ExtractedSymbol.kind | CodeSymbol.type |
|---------------------|-----------------|
| Function            | function        |
| ArrowFunction       | function        |
| Class               | class           |
| Interface           | interface       |
| TypeAlias           | type            |
| Enum                | enum            |
| Constant            | constant        |
| Variable            | variable        |
| Method              | method          |
| Property            | property        |
| Constructor         | method          |
| Getter              | method          |
| Setter              | method          |
| Parameter           | parameter       |
| EnumMember          | constant        |
| Decorator           | decorator       |
| Import              | import          |
| ImportFrom          | import          |
| Module              | module          |

### 6. Default Configuration

```typescript
const DEFAULT_INDEXING_OPTIONS: Required<IndexingOptions> = {
  includePatterns: ['**/*'],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/__pycache__/**',
    '**/venv/**',
    '**/.venv/**',
    '**/*.min.js',
    '**/*.bundle.js'
  ],
  maxFileSize: 1024 * 1024, // 1MB
  includeDocumentation: true,
  includeSignatures: true,
  maxSymbolDepth: undefined, // unlimited
  computeHashes: true,
  continueOnError: true,
  concurrency: 4
};
```

### 7. Error Handling Strategy

1. **File Read Errors**: Log warning, skip file, continue with others
2. **Parse Errors**: Include in `CodeFile.errors`, set `hasErrors: true`
3. **Extraction Errors**: Include in result errors, continue processing
4. **Unsupported Language**: Skip file silently (not in extension map)
5. **Permission Errors**: Log warning, include in errors array

### 8. Performance Considerations

1. **Parallel Processing**: Process files concurrently with configurable limit
2. **Lazy Language Loading**: TreeSitterWrapper already handles this
3. **Early Filtering**: Filter by extension before any parsing
4. **Stream-like Processing**: Don't load all files into memory at once
5. **Abort Support**: Future enhancement via AbortController

### 9. Dependencies

- `glob` package (already in orchestrator dependencies)
- `fs/promises` (Node.js built-in)
- `path` (Node.js built-in)
- `crypto` (Node.js built-in, for content hashes)
- Existing codebase-intelligence modules

## Consequences

### Positive

1. **Consistent API**: Follows established singleton patterns in the codebase
2. **Extensible**: Easy to add new language extractors
3. **Resilient**: Continues processing despite individual file errors
4. **Progress Tracking**: Supports UI feedback via callbacks
5. **Type Safety**: Full TypeScript types matching core schemas

### Negative

1. **Memory Usage**: Large codebases may require significant memory
2. **Processing Time**: Full indexing of large repos can be slow
3. **No Incremental Updates**: Must re-index entire directory for changes

### Mitigations

1. Memory: Future enhancement - streaming/chunked processing
2. Time: Parallel processing, file size limits, exclude patterns
3. Incremental: Future enhancement - use contentHash for delta updates

## Implementation Plan

### Phase 1: Core Implementation
1. Create `indexer.ts` with `CodebaseIndexer` class
2. Implement `indexDirectory()` method
3. Implement symbol type mapping
4. Implement file discovery and filtering
5. Implement stats calculation

### Phase 2: Testing
1. Unit tests for symbol mapping
2. Unit tests for file filtering
3. Integration tests with sample directories
4. Edge case tests (empty dirs, permission errors, etc.)

### Phase 3: Export & Integration
1. Export from `codebase-intelligence/index.ts`
2. Update orchestrator exports if needed
3. Document usage in README

## File Structure

```
packages/orchestrator/src/codebase-intelligence/
├── index.ts                    # Updated to export indexer
├── indexer.ts                  # NEW: CodebaseIndexer implementation
├── ADR-002-codebase-indexer.md # This document
├── parsers/
│   ├── index.ts
│   ├── types.ts
│   └── tree-sitter-wrapper.ts
└── extractors/
    ├── index.ts
    ├── types.ts
    ├── typescript-extractor.ts
    └── python-extractor.ts
```

## References

- ADR-001: TypeScript/JavaScript Symbol Extractor
- `@apexcli/core` types.ts: RepositoryMap, CodeFile, CodeSymbol schemas
- Existing TreeSitterWrapper and extractor implementations
