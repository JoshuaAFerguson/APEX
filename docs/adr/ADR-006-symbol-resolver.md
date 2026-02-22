# ADR-006: SymbolResolver Design for Definition Lookup and Reference Tracking

## Status
Proposed

## Date
2025-02-22

## Context

The APEX codebase intelligence system needs the ability to:
1. Find where symbols (functions, classes, types, etc.) are defined across the codebase
2. Track where symbols are referenced/used
3. Support cross-file symbol resolution using the existing `RepositoryMap`

Currently:
- **CodebaseIndexer** indexes directories and generates `RepositoryMap` with files, symbols, and statistics
- **RepositoryMap** has `files: CodeFile[]` with symbols, and `references: SymbolReference[]` (currently empty - TODO in indexer.ts line 332)
- **CodeSymbol** contains definition location info (name, type, filePath, startLine, endLine, etc.)
- **SymbolReference** schema exists but reference extraction is not implemented

## Decision

### 1. Architecture Overview

Create a `SymbolResolver` class that operates on an existing `RepositoryMap` to provide efficient symbol lookup and reference tracking.

```
┌────────────────────────────────────────────────────────────────────┐
│                        SymbolResolver                              │
├────────────────────────────────────────────────────────────────────┤
│ - symbolIndex: Map<string, CodeSymbol[]>                          │
│ - referenceIndex: Map<string, SymbolReference[]>                  │
│ - repositoryMap: RepositoryMap                                     │
├────────────────────────────────────────────────────────────────────┤
│ + static fromRepositoryMap(map: RepositoryMap): SymbolResolver    │
│ + findDefinition(symbolName: string, opts?): DefinitionResult[]   │
│ + findReferences(symbolName: string, opts?): ReferenceResult[]    │
│ + getSymbol(symbolName: string, filePath?: string): CodeSymbol?   │
│ + getExportedSymbols(filePath: string): CodeSymbol[]              │
│ + getSymbolsOfType(type: SymbolType): CodeSymbol[]                │
└────────────────────────────────────────────────────────────────────┘
```

### 2. Detailed Design

#### 2.1 File Structure
```
packages/orchestrator/src/codebase-intelligence/
├── index.ts                          # Add SymbolResolver exports
├── symbol-resolver.ts                # Main SymbolResolver class
└── __tests__/
    └── symbol-resolver.test.ts       # Unit tests
```

#### 2.2 Core Types

```typescript
/**
 * Result from a definition lookup operation
 */
export interface DefinitionResult {
  /** The symbol definition */
  symbol: CodeSymbol;
  /** File where the symbol is defined */
  file: CodeFile;
  /** Confidence score (1.0 for exact match, lower for fuzzy) */
  confidence: number;
  /** Whether this is the primary definition (vs re-export) */
  isPrimary: boolean;
}

/**
 * Result from a reference lookup operation
 */
export interface ReferenceResult {
  /** The reference information */
  reference: SymbolReference;
  /** File where the reference occurs */
  sourceFile: CodeFile;
  /** The target symbol being referenced (if resolved) */
  targetSymbol?: CodeSymbol;
  /** File containing the definition */
  targetFile?: CodeFile;
}

/**
 * Options for definition lookup
 */
export interface FindDefinitionOptions {
  /** Filter by symbol type */
  type?: SymbolType;
  /** Only return exported symbols */
  exportedOnly?: boolean;
  /** Limit search to specific file */
  filePath?: string;
  /** Include partial/fuzzy matches */
  fuzzy?: boolean;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Options for reference lookup
 */
export interface FindReferencesOptions {
  /** Filter by reference type (call, import, etc.) */
  referenceType?: ReferenceType;
  /** Limit search to specific source file */
  sourceFile?: string;
  /** Include references where symbol is only partially resolved */
  includeUnresolved?: boolean;
  /** Maximum number of results */
  limit?: number;
}
```

#### 2.3 SymbolResolver Class

```typescript
export class SymbolResolver {
  /** Index mapping symbol names to their definitions */
  private symbolIndex: Map<string, CodeSymbol[]>;

  /** Index mapping symbol names to their references */
  private referenceIndex: Map<string, SymbolReference[]>;

  /** Index mapping file paths to their symbols */
  private fileSymbolIndex: Map<string, CodeSymbol[]>;

  /** Index mapping symbol types to symbols of that type */
  private typeIndex: Map<SymbolType, CodeSymbol[]>;

  /** The source RepositoryMap */
  private repositoryMap: RepositoryMap;

  /**
   * Factory method to create a SymbolResolver from a RepositoryMap
   */
  public static fromRepositoryMap(map: RepositoryMap): SymbolResolver;

  /**
   * Find definition(s) of a symbol by name
   *
   * Searches across all files in the RepositoryMap to find where
   * the symbol is defined. Handles cases where the same symbol name
   * appears in multiple files (returns all matches with confidence scores).
   */
  public findDefinition(
    symbolName: string,
    options?: FindDefinitionOptions
  ): DefinitionResult[];

  /**
   * Find all references to a symbol
   *
   * Returns all locations where the symbol is used/referenced.
   * Currently operates on pre-computed references in RepositoryMap.
   */
  public findReferences(
    symbolName: string,
    options?: FindReferencesOptions
  ): ReferenceResult[];

  /**
   * Get a specific symbol by name, optionally scoped to a file
   */
  public getSymbol(
    symbolName: string,
    filePath?: string
  ): CodeSymbol | undefined;

  /**
   * Get all exported symbols from a specific file
   */
  public getExportedSymbols(filePath: string): CodeSymbol[];

  /**
   * Get all symbols of a specific type across the codebase
   */
  public getSymbolsOfType(type: SymbolType): CodeSymbol[];

  /**
   * Get all symbols in a specific file
   */
  public getFileSymbols(filePath: string): CodeSymbol[];

  /**
   * Check if a symbol exists in the codebase
   */
  public hasSymbol(symbolName: string): boolean;

  /**
   * Get statistics about the indexed symbols
   */
  public getStats(): SymbolResolverStats;
}
```

### 3. Index Building Strategy

When creating a `SymbolResolver` from a `RepositoryMap`, we build multiple indexes for O(1) or O(log n) lookups:

```typescript
// 1. Symbol name → definitions (for findDefinition)
symbolIndex: Map<string, CodeSymbol[]>

// 2. Symbol name → references (for findReferences)
referenceIndex: Map<string, SymbolReference[]>

// 3. File path → symbols (for getFileSymbols, getExportedSymbols)
fileSymbolIndex: Map<string, CodeSymbol[]>

// 4. Symbol type → symbols (for getSymbolsOfType)
typeIndex: Map<SymbolType, CodeSymbol[]>
```

### 4. Handling Ambiguity

When the same symbol name exists in multiple files:

1. **findDefinition()** returns ALL matches, sorted by:
   - `confidence`: 1.0 for exact matches, lower for fuzzy
   - `isPrimary`: true for original definitions, false for re-exports

2. Users can filter using `FindDefinitionOptions`:
   - `exportedOnly`: Only return exported/public symbols
   - `filePath`: Scope to specific file
   - `type`: Filter by symbol type (function, class, etc.)

### 5. Integration with Reference Tracking

The current `CodebaseIndexer` has a TODO for reference extraction:
```typescript
references: [], // TODO: Implement reference extraction in future version
```

The `SymbolResolver` is designed to work with whatever references are available:
- If references are empty, `findReferences()` returns empty array
- When reference extraction is implemented, `SymbolResolver` will automatically use them
- This separation of concerns keeps `SymbolResolver` focused on lookups, not extraction

### 6. Test Strategy

Unit tests will verify:
1. **Definition lookup**: Finding symbols by name, with filtering
2. **Reference lookup**: Finding references (once populated)
3. **Cross-file resolution**: Symbols defined in one file, used in another
4. **Ambiguity handling**: Same symbol name in multiple files
5. **Edge cases**: Empty maps, missing symbols, case sensitivity

### 7. Future Enhancements (Out of Scope)

For later implementation:
- **Live reference extraction**: Using tree-sitter to find identifier usages
- **Import graph resolution**: Using `ImportEdge` data to track dependencies
- **Scope-aware resolution**: Understanding nested scopes and shadowing
- **Incremental updates**: Updating indexes when files change

## Consequences

### Positive
- Clean separation between indexing (CodebaseIndexer) and lookup (SymbolResolver)
- Efficient O(1) lookups via pre-built indexes
- Flexible filtering options for different use cases
- Follows established patterns (singleton, factory method) in the codebase
- Ready for reference tracking when extraction is implemented

### Negative
- Memory overhead from multiple indexes (acceptable tradeoff for speed)
- Indexes become stale if RepositoryMap is modified (immutable approach recommended)
- Reference results will be empty until reference extraction is implemented

### Neutral
- Requires rebuilding indexes when RepositoryMap changes
- Users need to understand the difference between definition and reference lookup

## Technical Specifications

### Dependencies
- `@apexcli/core`: For `CodeSymbol`, `SymbolReference`, `RepositoryMap`, `CodeFile`, `SymbolType` types
- No new external dependencies required

### Exported Interfaces
```typescript
// From packages/orchestrator/src/codebase-intelligence/symbol-resolver.ts
export {
  SymbolResolver,
  DefinitionResult,
  ReferenceResult,
  FindDefinitionOptions,
  FindReferencesOptions,
  SymbolResolverStats
}
```

### Module Integration
```typescript
// packages/orchestrator/src/codebase-intelligence/index.ts
export { SymbolResolver } from './symbol-resolver.js';
export type {
  DefinitionResult,
  ReferenceResult,
  FindDefinitionOptions,
  FindReferencesOptions,
  SymbolResolverStats
} from './symbol-resolver.js';
```
