# ADR: CrossReferenceValidator Architecture

## Status
Proposed

## Context

APEX needs the ability to build a symbol index from TypeScript/JavaScript source files for cross-reference validation. This is part of the Advanced Codebase Intelligence roadmap items for "Codebase indexing" and "Symbol resolution".

The CrossReferenceValidator will:
1. Build a symbol index from source files
2. Extract function names, class names, and type names
3. Enable validation of references between documentation and code
4. Support the existing `crossReferenceEnabled` configuration in `OutdatedDocsConfig`

### Existing Patterns

The codebase has established patterns we should follow:
- **BaseAnalyzer pattern**: All analyzers extend `BaseAnalyzer` and implement `StrategyAnalyzer`
- **JSDocDetector**: Located in `@apexcli/core`, provides export/documentation detection patterns
- **ProjectAnalysis interface**: Standard input for all analyzers
- **TaskCandidate output**: Standard output format with scoring

## Decision

### Class Design

Create `CrossReferenceValidator` as a standalone utility class (not extending BaseAnalyzer) because:
1. Its primary purpose is symbol indexing, not task generation
2. It can be used by multiple analyzers (DocsAnalyzer, RefactoringAnalyzer)
3. It aligns with the acceptance criteria which focuses on symbol extraction

### Location

`packages/orchestrator/src/analyzers/cross-reference-validator.ts`

This location is appropriate because:
- It's related to code analysis functionality
- Other analyzers can easily import it
- It follows the existing directory structure

### Core Data Structures

```typescript
/**
 * Represents a symbol extracted from source code
 */
export interface SymbolInfo {
  /** Symbol name */
  name: string;
  /** Symbol type */
  type: 'function' | 'class' | 'type' | 'interface' | 'enum' | 'const' | 'variable' | 'method' | 'property';
  /** File path where the symbol is defined */
  file: string;
  /** Line number where the symbol is defined */
  line: number;
  /** Column number where the symbol starts */
  column: number;
  /** Whether the symbol is exported */
  isExported: boolean;
  /** Parent symbol (for methods/properties inside classes) */
  parent?: string;
  /** JSDoc/TSDoc comment if present */
  documentation?: string;
}

/**
 * Symbol index mapping symbol names to their definitions
 */
export interface SymbolIndex {
  /** All symbols indexed by name (may have multiple definitions) */
  byName: Map<string, SymbolInfo[]>;
  /** Symbols indexed by file path */
  byFile: Map<string, SymbolInfo[]>;
  /** Statistics about the index */
  stats: {
    totalSymbols: number;
    totalFiles: number;
    byType: Record<string, number>;
  };
}

/**
 * Options for symbol extraction
 */
export interface SymbolExtractionOptions {
  /** File extensions to process (default: ['.ts', '.tsx', '.js', '.jsx']) */
  extensions?: string[];
  /** Glob patterns to include */
  include?: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Whether to extract non-exported symbols (default: false) */
  includePrivate?: boolean;
  /** Whether to extract class members (default: true) */
  includeMembers?: boolean;
}
```

### Class Interface

```typescript
export class CrossReferenceValidator {
  /**
   * Build a symbol index from source files in a directory
   */
  buildIndex(rootPath: string, options?: SymbolExtractionOptions): Promise<SymbolIndex>;

  /**
   * Extract symbols from a single file
   */
  extractSymbols(filePath: string, content: string): SymbolInfo[];

  /**
   * Look up a symbol by name
   */
  lookupSymbol(index: SymbolIndex, name: string): SymbolInfo[];

  /**
   * Get symbols from a specific file
   */
  getFileSymbols(index: SymbolIndex, filePath: string): SymbolInfo[];

  /**
   * Check if a symbol reference is valid
   */
  validateReference(index: SymbolIndex, symbolName: string): boolean;
}
```

### Symbol Extraction Strategy

Use regex-based parsing (like JSDocDetector) rather than AST parsing because:
1. **Consistency**: Matches the existing pattern in `jsdoc-detector.ts`
2. **Performance**: Faster for large codebases
3. **Dependencies**: No additional dependencies required
4. **Simplicity**: Easier to maintain and extend

#### Patterns to Extract

1. **Functions**:
   - Named functions: `function foo()`, `export function bar()`
   - Arrow functions: `const foo = () =>`, `export const bar = async () =>`
   - Async functions: `async function foo()`

2. **Classes**:
   - Class declarations: `class Foo`, `export class Bar`
   - Abstract classes: `abstract class Foo`

3. **Types/Interfaces**:
   - Type aliases: `type Foo = ...`, `export type Bar`
   - Interfaces: `interface Foo`, `export interface Bar`

4. **Other**:
   - Enums: `enum Foo`, `export enum Bar`
   - Constants: `const FOO = `, `export const BAR`

### Integration Points

1. **DocsAnalyzer**: Can use symbol index to validate documentation references
2. **RefactoringAnalyzer**: Can use for dead code detection, symbol usage analysis
3. **IdleProcessor**: Can build index during idle analysis phase
4. **Future**: Support for IDE-like features (go-to-definition, find-references)

## Consequences

### Positive
- Enables cross-reference validation between docs and code
- Provides foundation for more advanced code intelligence features
- Follows established codebase patterns
- Minimal dependencies (regex-based approach)

### Negative
- Regex-based parsing may miss edge cases that AST would catch
- Initial implementation focuses on TypeScript/JavaScript only
- Symbol extraction doesn't capture full type information

### Risks
- Performance with very large codebases (mitigated by lazy loading and caching)
- Accuracy vs. full AST parsing (acceptable trade-off for initial implementation)

## Future Considerations

1. **AST-based extraction**: Could add optional TypeScript compiler API integration for higher accuracy
2. **Incremental updates**: File watcher for index updates on changes
3. **Cross-file resolution**: Import/export chain tracking
4. **Type resolution**: Full type information extraction using TypeScript services
