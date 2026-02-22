# ADR-009: Tree-Sitter Wrapper Implementation

## Status
Accepted

## Context

APEX needs a robust code parsing capability for the codebase intelligence module. The project already has tree-sitter dependencies installed for 6 languages (TypeScript, JavaScript, Python, Go, Java, Rust). A centralized wrapper class is needed to:

1. Provide a consistent API for parsing source code across multiple languages
2. Encapsulate tree-sitter initialization and language loading
3. Handle language detection from file extensions
4. Provide proper TypeScript types for working with AST nodes
5. Enable error handling for malformed code

## Decision

We will implement a `TreeSitterWrapper` class at `packages/orchestrator/src/codebase-intelligence/parsers/tree-sitter-wrapper.ts` with the following architecture:

### Class Design

```typescript
export class TreeSitterWrapper {
  // Singleton instance for parser caching
  private static instance: TreeSitterWrapper | null = null;

  // Cached language parsers (lazy-loaded)
  private languageCache: Map<SupportedLanguage, Language>;

  // Main tree-sitter Parser instance
  private parser: Parser;

  // Methods
  static getInstance(): TreeSitterWrapper;
  parse(sourceCode: string, language: SupportedLanguage): ParseResult;
  parseFile(filePath: string): Promise<ParseResult>;
  detectLanguage(filePath: string): SupportedLanguage | null;
  getSupportedLanguages(): SupportedLanguage[];
  clearCache(): void;
}
```

### Supported Languages Enum

```typescript
export enum SupportedLanguage {
  TypeScript = 'typescript',
  TSX = 'tsx',
  JavaScript = 'javascript',
  Python = 'python',
  Go = 'go',
  Java = 'java',
  Rust = 'rust'
}
```

### Parse Result Interface

```typescript
export interface ParseResult {
  tree: Tree;
  rootNode: SyntaxNode;
  hasErrors: boolean;
  errors: ParseError[];
  language: SupportedLanguage;
  sourceCode: string;
}

export interface ParseError {
  message: string;
  startPosition: Point;
  endPosition: Point;
  type: string;
}
```

### Key Design Decisions

1. **Singleton Pattern**: Use singleton for parser caching to avoid expensive re-initialization. Languages are lazy-loaded on first use.

2. **Language Detection**: Map file extensions to languages:
   - `.ts` → typescript
   - `.tsx` → tsx
   - `.js`, `.jsx`, `.mjs`, `.cjs` → javascript
   - `.py` → python
   - `.go` → go
   - `.java` → java
   - `.rs` → rust

3. **Error Handling**: Tree-sitter continues parsing even with syntax errors. We collect error nodes and expose them in `ParseResult.errors`.

4. **TypeScript Types**: Re-export tree-sitter types (`Tree`, `SyntaxNode`, `Point`, `Range`) for consumer convenience.

5. **Async Loading**: Language grammars are dynamically imported to avoid loading all grammars upfront.

### File Structure

```
packages/orchestrator/src/codebase-intelligence/
├── index.ts                         # Module exports
├── parsers/
│   ├── index.ts                     # Parser exports
│   ├── tree-sitter-wrapper.ts       # Main wrapper class
│   └── types.ts                     # Type definitions
```

## Consequences

### Positive

- **Consistent API**: Single entry point for all code parsing operations
- **Type Safety**: Full TypeScript support with proper types
- **Performance**: Lazy loading of grammars, caching of parser instances
- **Extensibility**: Easy to add new language support
- **Testability**: Clear interface enables easy unit testing

### Negative

- **Memory**: Caching parsers/grammars increases memory footprint
- **Native Dependencies**: tree-sitter requires native bindings (already installed)

### Neutral

- Follows established patterns from `codebase-analyzer` module
- Integrates with existing error handling conventions

## Implementation Notes

1. Use dynamic imports (`await import('tree-sitter-xxx')`) for grammars
2. TypeScript has two grammars (typescript, tsx) - expose both
3. Collect ERROR nodes from AST for parse error reporting
4. Parser reuse is safe - just call `setLanguage()` before each parse
5. Consider incremental parsing for large files (future enhancement)

## References

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [Existing tree-sitter integration tests](../packages/orchestrator/src/codebase-analyzer/__tests__/tree-sitter-integration.test.ts)
- [Tree-sitter Node.js bindings](https://github.com/tree-sitter/node-tree-sitter)
