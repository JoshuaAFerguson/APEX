# ADR-003: SymbolResolver Architecture

## Status

Proposed

## Context

APEX's codebase intelligence system needs to provide symbol resolution capabilities for:

1. **Definition Lookup**: Finding where a symbol is defined across the codebase
2. **Reference Tracking**: Finding all usages of a symbol across files
3. **Cross-file Resolution**: Resolving symbols imported/exported between files
4. **AI Context Enhancement**: Providing agents with accurate symbol locations

The codebase-intelligence module already provides:
- `CodebaseIndexer`: Generates `RepositoryMap` with all files and symbols
- `RepositoryMap`: Contains `files: CodeFile[]` and `references: SymbolReference[]`
- `CodeFile`: Contains `symbols: CodeSymbol[]`, `imports`, `exports`
- `CodeSymbol`: Contains `name`, `type`, `filePath`, `startLine`, `endLine`, etc.
- `SymbolReference`: Tracks symbol usage locations

## Decision

### 1. Class Design: SymbolResolver

Create a `SymbolResolver` class at `packages/orchestrator/src/codebase-intelligence/symbol-resolver.ts` that:

- Uses composition with `RepositoryMap` (not singleton - resolver is stateless, map is stateful)
- Provides `findDefinition(symbolName: string, options?: FindOptions): SymbolDefinition[]`
- Provides `findReferences(symbolName: string, options?: FindOptions): SymbolReferenceResult[]`
- Supports filtering by file path, symbol type, and scope
- Implements efficient lookup via internal symbol index

### 2. Core Interfaces

```typescript
/**
 * Options for finding symbols
 */
export interface FindOptions {
  /** Filter by file path pattern (glob-like matching) */
  filePath?: string;

  /** Filter by symbol type (function, class, interface, etc.) */
  symbolType?: SymbolType | SymbolType[];

  /** Filter by exported symbols only */
  exportedOnly?: boolean;

  /** Include private/internal symbols */
  includePrivate?: boolean;

  /** Maximum number of results to return */
  limit?: number;

  /** Case-sensitive search (default: true) */
  caseSensitive?: boolean;

  /** Exact match only (default: false - allows partial matches) */
  exactMatch?: boolean;
}

/**
 * Result of a definition lookup
 */
export interface SymbolDefinition {
  /** The found symbol */
  symbol: CodeSymbol;

  /** File containing the definition */
  file: CodeFile;

  /** Full file path relative to repository root */
  filePath: string;

  /** Match confidence (1.0 = exact match) */
  confidence: number;

  /** Whether this is a re-export from another file */
  isReExport: boolean;

  /** Original definition if this is a re-export */
  originalDefinition?: SymbolDefinition;
}

/**
 * Result of a reference lookup
 */
export interface SymbolReferenceResult {
  /** The reference information */
  reference: SymbolReference;

  /** File containing the reference */
  sourceFile: CodeFile;

  /** Definition this reference points to (if resolved) */
  definition?: SymbolDefinition;

  /** Context around the reference (surrounding code) */
  context?: string;
}

/**
 * Statistics about symbol resolution
 */
export interface ResolutionStats {
  /** Total symbols indexed */
  totalSymbols: number;

  /** Total unique symbol names */
  uniqueNames: number;

  /** Symbols by type count */
  byType: Record<SymbolType, number>;

  /** Files with symbols */
  filesWithSymbols: number;

  /** Index build time in ms */
  indexBuildTimeMs: number;
}
```

### 3. Class Structure

```typescript
/**
 * SymbolResolver - Definition lookup and reference tracking
 *
 * Provides efficient symbol resolution across a RepositoryMap by building
 * internal indexes for fast lookup operations.
 *
 * @example
 * ```typescript
 * const indexer = CodebaseIndexer.getInstance();
 * const repoMap = await indexer.indexDirectory('/path/to/project');
 * const resolver = new SymbolResolver(repoMap);
 *
 * // Find definition
 * const definitions = resolver.findDefinition('MyClass');
 * console.log(definitions[0].symbol.filePath); // 'src/models/MyClass.ts'
 *
 * // Find references
 * const refs = resolver.findReferences('MyClass');
 * console.log(`Found ${refs.length} usages of MyClass`);
 * ```
 */
export class SymbolResolver {
  /** The repository map to search */
  private readonly repoMap: RepositoryMap;

  /** Index of symbols by name for fast lookup */
  private readonly symbolIndex: Map<string, SymbolDefinition[]>;

  /** Index of symbols by file path */
  private readonly fileIndex: Map<string, CodeSymbol[]>;

  /** Index of exports by file path */
  private readonly exportIndex: Map<string, Map<string, CodeSymbol>>;

  /** Case-insensitive name to canonical names mapping */
  private readonly nameIndex: Map<string, Set<string>>;

  /** Resolution statistics */
  private readonly stats: ResolutionStats;

  /**
   * Create a new SymbolResolver
   *
   * @param repoMap - The repository map to resolve symbols in
   */
  constructor(repoMap: RepositoryMap);

  /**
   * Find definition(s) of a symbol by name
   *
   * @param symbolName - Name of the symbol to find
   * @param options - Optional search options
   * @returns Array of matching symbol definitions, sorted by relevance
   */
  findDefinition(symbolName: string, options?: FindOptions): SymbolDefinition[];

  /**
   * Find all references to a symbol
   *
   * @param symbolName - Name of the symbol to find references for
   * @param options - Optional search options
   * @returns Array of references to the symbol
   */
  findReferences(symbolName: string, options?: FindOptions): SymbolReferenceResult[];

  /**
   * Find symbol at a specific location
   *
   * @param filePath - Path to the file
   * @param line - Line number (1-based)
   * @param column - Column number (0-based, optional)
   * @returns Symbol at the location, or undefined
   */
  findSymbolAtLocation(filePath: string, line: number, column?: number): CodeSymbol | undefined;

  /**
   * Get all symbols in a file
   *
   * @param filePath - Path to the file
   * @returns Array of symbols in the file
   */
  getFileSymbols(filePath: string): CodeSymbol[];

  /**
   * Get exported symbols from a file
   *
   * @param filePath - Path to the file
   * @returns Map of exported symbol names to symbols
   */
  getFileExports(filePath: string): Map<string, CodeSymbol>;

  /**
   * Get resolution statistics
   */
  getStats(): ResolutionStats;

  /**
   * Check if a symbol exists
   *
   * @param symbolName - Name to check
   * @param options - Optional search options
   */
  hasSymbol(symbolName: string, options?: FindOptions): boolean;

  /**
   * Rebuild internal indexes
   * Call this if the underlying RepositoryMap has been modified
   */
  rebuildIndex(): void;
}
```

### 4. Data Flow

```
                    RepositoryMap
                         │
                         ▼
            ┌────────────────────────┐
            │   SymbolResolver       │
            │   constructor()        │
            └────────────┬───────────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
    ┌────────────┐ ┌──────────┐ ┌──────────┐
    │ symbolIndex│ │ fileIndex│ │ nameIndex│
    │ Map<name,  │ │ Map<path,│ │ Map<lower│
    │ SymbolDef[]>│ │ Symbol[]>│ │ Set<name>>
    └────────────┘ └──────────┘ └──────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│              findDefinition()               │
│ 1. Normalize name (case handling)           │
│ 2. Lookup in symbolIndex                    │
│ 3. Apply filters (type, path, exported)     │
│ 4. Sort by relevance/confidence             │
│ 5. Apply limit                              │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│              findReferences()               │
│ 1. Find definition(s) first                 │
│ 2. Search repoMap.references                │
│ 3. Search imports for symbol usage          │
│ 4. Match against definition files           │
│ 5. Include context if requested             │
└─────────────────────────────────────────────┘
```

### 5. Index Building Strategy

The constructor builds three indexes for efficient lookup:

#### 5.1 Symbol Index (Primary)
```typescript
// Map from symbol name to all definitions
symbolIndex: Map<string, SymbolDefinition[]>

// Build process:
for (const file of repoMap.files) {
  for (const symbol of file.symbols) {
    const definitions = symbolIndex.get(symbol.name) || [];
    definitions.push({
      symbol,
      file,
      filePath: symbol.filePath,
      confidence: 1.0,
      isReExport: false
    });
    symbolIndex.set(symbol.name, definitions);
  }
}
```

#### 5.2 File Index
```typescript
// Map from file path to symbols in that file
fileIndex: Map<string, CodeSymbol[]>

// Enables fast file-scoped lookups
```

#### 5.3 Name Index (Case-Insensitive)
```typescript
// Map from lowercase name to all matching names
nameIndex: Map<string, Set<string>>

// Enables case-insensitive search:
// "myclass" -> {"MyClass", "myClass", "MYCLASS"}
```

### 6. Relevance Scoring

Definitions are sorted by relevance using this scoring:

| Criterion | Score Modifier |
|-----------|---------------|
| Exact name match | +1.0 |
| Case-insensitive match | +0.8 |
| Partial match (contains) | +0.5 |
| Exported symbol | +0.2 |
| Default export | +0.1 |
| File path match | +0.3 |
| Type match (if specified) | +0.2 |

Final confidence = sum of modifiers, capped at 1.0

### 7. Cross-File Resolution

For symbols imported from other files:

```typescript
// In file: src/components/App.tsx
import { MyClass } from './models/MyClass';

// Resolution process:
// 1. Find MyClass in imports of App.tsx
// 2. Resolve './models/MyClass' to 'src/models/MyClass.ts'
// 3. Look up MyClass in exports of src/models/MyClass.ts
// 4. Return definition with isReExport: false

// For re-exports:
// export { MyClass } from './models/MyClass';
// Return definition with isReExport: true
// And originalDefinition pointing to the actual definition
```

### 8. Reference Types Tracked

| Reference Type | Description |
|---------------|-------------|
| `call` | Function/method invocation |
| `instantiation` | Class instantiation (new Foo()) |
| `assignment` | Variable assignment |
| `read` | Value read |
| `write` | Value mutation |
| `import` | Import statement |
| `export` | Re-export statement |
| `extension` | Class extends |
| `implementation` | Interface implements |
| `type` | Type annotation reference |
| `decorator` | Decorator application |
| `parameter` | Used as parameter |
| `return` | Used as return value |

### 9. Error Handling

| Scenario | Behavior |
|----------|----------|
| Symbol not found | Return empty array |
| Invalid file path | Skip file in search |
| Malformed RepositoryMap | Throw TypeError with details |
| Circular re-exports | Detect and break cycle |
| Missing export target | Mark as unresolved |

### 10. Performance Considerations

1. **Index on Construction**: Build all indexes once at construction
2. **Lazy Context Loading**: Only fetch context when explicitly requested
3. **Early Termination**: Stop after `limit` results found
4. **Efficient Matching**: Use Set/Map for O(1) lookups
5. **Minimal Copying**: Return references, not deep copies

### 11. Dependencies

- `@apexcli/core/types`: RepositoryMap, CodeFile, CodeSymbol, SymbolReference, SymbolType
- `minimatch` (optional): For glob-style file path matching
- Built-in: Map, Set, Array methods

## Consequences

### Positive

1. **Fast Lookups**: O(1) name-based lookups via indexes
2. **Flexible Filtering**: Multiple filter options for precise queries
3. **Cross-File Resolution**: Full import/export chain resolution
4. **Type-Safe**: Full TypeScript types from core schemas
5. **Testable**: Stateless design, clear inputs/outputs

### Negative

1. **Memory Overhead**: Indexes duplicate some information
2. **No Live Updates**: Must rebuild index if RepositoryMap changes
3. **Import Resolution Complexity**: May not resolve all dynamic imports

### Mitigations

1. Memory: Indexes use references, not copies; overhead is minimal
2. Updates: Provide `rebuildIndex()` method for explicit refresh
3. Dynamic Imports: Mark as `isDynamic: true` with lower confidence

## Implementation Plan

### Phase 1: Core Implementation
1. Create `symbol-resolver.ts` with `SymbolResolver` class
2. Implement constructor with index building
3. Implement `findDefinition()` with basic filtering
4. Implement `findReferences()` with definition resolution

### Phase 2: Enhanced Features
1. Add cross-file resolution via import tracking
2. Implement relevance scoring
3. Add `findSymbolAtLocation()` for position-based lookup
4. Add `getFileSymbols()` and `getFileExports()`

### Phase 3: Testing
1. Unit tests for index building
2. Unit tests for findDefinition() scenarios
3. Unit tests for findReferences() scenarios
4. Integration tests with real RepositoryMap data
5. Cross-file resolution tests

### Phase 4: Export & Integration
1. Export from `codebase-intelligence/index.ts`
2. Update orchestrator exports
3. Document usage examples

## File Structure

```
packages/orchestrator/src/codebase-intelligence/
├── index.ts                       # Updated to export SymbolResolver
├── indexer.ts                     # CodebaseIndexer (existing)
├── symbol-resolver.ts             # NEW: SymbolResolver implementation
├── ADR-003-symbol-resolver.md     # This document
├── __tests__/
│   └── symbol-resolver.test.ts    # NEW: Unit tests
├── parsers/
│   └── ...
└── extractors/
    └── ...
```

## API Examples

### Basic Usage

```typescript
import { CodebaseIndexer, SymbolResolver } from '@apexcli/orchestrator/codebase-intelligence';

// Index a codebase
const indexer = CodebaseIndexer.getInstance();
const repoMap = await indexer.indexDirectory('/path/to/project');

// Create resolver
const resolver = new SymbolResolver(repoMap);

// Find where a function is defined
const definitions = resolver.findDefinition('calculateTotal');
// [{ symbol: { name: 'calculateTotal', type: 'function', ... }, file: ..., confidence: 1.0 }]

// Find all usages of a class
const references = resolver.findReferences('UserService');
// [{ reference: { symbolName: 'UserService', referenceType: 'instantiation', ... }, ... }]
```

### Filtered Search

```typescript
// Find only exported functions named "handle*"
const handlers = resolver.findDefinition('handle', {
  symbolType: 'function',
  exportedOnly: true,
  exactMatch: false  // partial match
});

// Find references in specific files
const refs = resolver.findReferences('config', {
  filePath: 'src/services/**',
  limit: 10
});
```

### Cross-File Resolution

```typescript
// Given:
// src/models/User.ts: export class User { ... }
// src/services/UserService.ts: import { User } from '../models/User';

const defs = resolver.findDefinition('User');
// Returns definition from src/models/User.ts

const refs = resolver.findReferences('User');
// Returns reference from src/services/UserService.ts (import)
// Plus any instantiations, type annotations, etc.
```

## References

- ADR-001: TypeScript/JavaScript Symbol Extractor
- ADR-002: CodebaseIndexer Architecture
- `@apexcli/core` types.ts: RepositoryMap, CodeFile, CodeSymbol, SymbolReference schemas
