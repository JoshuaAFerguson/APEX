# ADR-001: TypeScript/JavaScript Symbol Extractor Architecture

## Status
Accepted

## Context
APEX's codebase-intelligence module needs a symbol extractor for TypeScript and JavaScript files. This extractor will parse source code and extract structural information about functions, classes, interfaces, types, constants, and enums. This capability is essential for:

1. Understanding codebase structure for AI agents
2. Providing context about available symbols and their relationships
3. Enabling code navigation and analysis features
4. Supporting refactoring and documentation generation

## Decision

### 1. Architecture Overview

We will implement a **TypeScriptExtractor** class that follows the existing patterns in the codebase-intelligence module, specifically:

- **Location**: `packages/orchestrator/src/codebase-intelligence/extractors/typescript-extractor.ts`
- **Pattern**: Singleton pattern (consistent with TreeSitterWrapper)
- **Integration**: Uses TreeSitterWrapper for AST parsing
- **Design**: Strategy pattern for language-specific node handling (TS vs JS share most logic)

### 2. Symbol Type Hierarchy

```typescript
enum SymbolKind {
  Function = 'function',
  ArrowFunction = 'arrow_function',
  Class = 'class',
  Interface = 'interface',
  TypeAlias = 'type_alias',
  Enum = 'enum',
  Constant = 'constant',
  Variable = 'variable',
  Method = 'method',
  Property = 'property',
  Constructor = 'constructor',
  Getter = 'getter',
  Setter = 'setter',
  Parameter = 'parameter',
  EnumMember = 'enum_member'
}
```

### 3. Core Interfaces

```typescript
interface ExtractedSymbol {
  name: string;
  kind: SymbolKind;
  location: Range;
  exportKind?: 'named' | 'default' | 'none';
  modifiers: SymbolModifier[];
  documentation?: string;
  signature?: string;
  typeAnnotation?: string;
  children?: ExtractedSymbol[];
}

type SymbolModifier =
  | 'export' | 'default' | 'async' | 'static' | 'readonly'
  | 'abstract' | 'private' | 'protected' | 'public' | 'declare'
  | 'const' | 'let' | 'var';

interface ExtractionOptions {
  includeDocumentation?: boolean;  // Extract JSDoc comments (default: true)
  includeSignatures?: boolean;     // Extract function/method signatures (default: true)
  includePrivate?: boolean;        // Include private class members (default: true)
  maxDepth?: number;               // Max nesting depth (default: unlimited)
  symbolKinds?: SymbolKind[];      // Filter to specific kinds (default: all)
}

interface ExtractionResult {
  symbols: ExtractedSymbol[];
  filePath?: string;
  language: SupportedLanguage;
  hasErrors: boolean;
  errors: ParseError[];
  extractionTimeMs: number;
}
```

### 4. Tree-sitter Node Type Mapping

TypeScript/JavaScript AST nodes to extract:

| Node Type | SymbolKind | Notes |
|-----------|------------|-------|
| `function_declaration` | Function | Named function |
| `arrow_function` | ArrowFunction | Only when assigned to variable |
| `class_declaration` | Class | Class definition |
| `interface_declaration` | Interface | TS only |
| `type_alias_declaration` | TypeAlias | TS only |
| `enum_declaration` | Enum | TS only |
| `lexical_declaration` (const) | Constant | When using const |
| `lexical_declaration` (let/var) | Variable | When using let/var |
| `method_definition` | Method | Class method |
| `public_field_definition` | Property | Class property |
| `constructor` | Constructor | Class constructor |
| `getter` | Getter | Getter accessor |
| `setter` | Setter | Setter accessor |

### 5. AST Traversal Strategy

```
                    ┌─────────────────┐
                    │   Source Code   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │TreeSitterWrapper│
                    │    .parse()     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   ParseResult   │
                    │   (AST Tree)    │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │    TypeScriptExtractor       │
              │    .extractFromResult()      │
              └──────────────┬───────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌────────────┐    ┌────────────┐    ┌────────────┐
    │ visitNode  │    │ visitNode  │    │ visitNode  │
    │ (function) │    │  (class)   │    │   (type)   │
    └─────┬──────┘    └─────┬──────┘    └────────────┘
          │                 │
          ▼                 ▼
   ┌────────────┐    ┌────────────────┐
   │ extractName│    │ visitChildren  │
   │ extractMods│    │ (methods, etc) │
   │ extractDoc │    └────────────────┘
   └────────────┘
```

### 6. Class Design

```typescript
class TypeScriptExtractor {
  private static instance: TypeScriptExtractor | null = null;
  private wrapper: TreeSitterWrapper;

  // Singleton access
  public static getInstance(): TypeScriptExtractor;
  public static resetInstance(): void;

  // Main extraction methods
  public async extract(sourceCode: string, language: SupportedLanguage, options?: ExtractionOptions): Promise<ExtractionResult>;
  public async extractFromFile(filePath: string, options?: ExtractionOptions): Promise<ExtractionResult>;
  public extractFromParseResult(result: ParseResult, options?: ExtractionOptions): ExtractionResult;

  // Internal traversal
  private visitNode(node: SyntaxNode, options: Required<ExtractionOptions>, depth: number): ExtractedSymbol | null;
  private visitChildren(node: SyntaxNode, options: Required<ExtractionOptions>, depth: number): ExtractedSymbol[];

  // Symbol extraction helpers
  private extractFunction(node: SyntaxNode, options: Required<ExtractionOptions>): ExtractedSymbol;
  private extractClass(node: SyntaxNode, options: Required<ExtractionOptions>, depth: number): ExtractedSymbol;
  private extractInterface(node: SyntaxNode, options: Required<ExtractionOptions>, depth: number): ExtractedSymbol;
  private extractTypeAlias(node: SyntaxNode, options: Required<ExtractionOptions>): ExtractedSymbol;
  private extractEnum(node: SyntaxNode, options: Required<ExtractionOptions>, depth: number): ExtractedSymbol;
  private extractVariable(node: SyntaxNode, options: Required<ExtractionOptions>): ExtractedSymbol;
  private extractMethod(node: SyntaxNode, options: Required<ExtractionOptions>): ExtractedSymbol;

  // Utility methods
  private getModifiers(node: SyntaxNode): SymbolModifier[];
  private getExportKind(node: SyntaxNode): 'named' | 'default' | 'none';
  private getDocumentation(node: SyntaxNode, sourceCode: string): string | undefined;
  private getSignature(node: SyntaxNode): string | undefined;
  private getTypeAnnotation(node: SyntaxNode): string | undefined;
  private getNodeName(node: SyntaxNode): string | undefined;
  private toRange(node: SyntaxNode): Range;
}
```

### 7. Language Handling

TypeScript and JavaScript share the same extractor because:

1. Tree-sitter uses similar node types for both
2. JS is essentially a subset of TS (no interfaces, type aliases, enums)
3. The extractor gracefully handles missing TS-specific nodes

Language-specific behavior:
- **TypeScript (.ts, .tsx, .mts, .cts)**: Full extraction including interfaces, type aliases, enums
- **JavaScript (.js, .jsx, .mjs, .cjs)**: Functions, classes, variables, constants only

### 8. Documentation Extraction

JSDoc comments are associated with symbols by looking at the preceding sibling:

```typescript
/**
 * Helper function    <-- Extract this
 * @param x input
 */
function helper(x) {}
```

The extractor:
1. Looks for `comment` node immediately preceding the symbol
2. Checks if comment starts with `/**`
3. Strips comment delimiters and formats content

### 9. Error Handling

The extractor handles errors gracefully:
- **Parse errors**: Included in result, extraction continues for valid portions
- **Node extraction errors**: Logged and skipped, other symbols still extracted
- **Missing nodes**: Returns undefined/empty values rather than throwing

### 10. Performance Considerations

1. **Single-pass traversal**: AST is traversed once using TreeCursor
2. **Lazy evaluation**: Child symbols only extracted when needed
3. **Memory efficiency**: No deep copies of AST nodes
4. **Caching**: Leverages TreeSitterWrapper's language caching

## Consequences

### Positive
- Consistent with existing TreeSitterWrapper patterns
- Single class handles both TS and JS (DRY)
- Extensible design allows future language additions
- Comprehensive symbol information for AI context
- Performance-optimized single-pass extraction

### Negative
- Complexity in handling TS-specific vs JS nodes
- JSDoc extraction may miss edge cases
- Large files could produce large symbol trees

### Neutral
- Singleton pattern chosen for consistency (may revisit if needed)
- No persistent caching of extraction results (could add later)

## File Structure

```
packages/orchestrator/src/codebase-intelligence/
├── index.ts                          # Add extractor exports
├── extractors/
│   ├── index.ts                      # Extractor module exports
│   ├── types.ts                      # Symbol types & interfaces
│   ├── typescript-extractor.ts       # Main extractor implementation
│   └── __tests__/
│       ├── typescript-extractor.test.ts
│       └── typescript-extractor.integration.test.ts
└── parsers/                          # Existing parser module
```

## Implementation Order

1. Create `extractors/types.ts` with all type definitions
2. Create `extractors/typescript-extractor.ts` with core class
3. Create `extractors/index.ts` with exports
4. Update `codebase-intelligence/index.ts` to export extractors
5. Create unit tests
6. Create integration tests

## References

- Tree-sitter TypeScript grammar: https://github.com/tree-sitter/tree-sitter-typescript
- Tree-sitter JavaScript grammar: https://github.com/tree-sitter/tree-sitter-javascript
- Existing TreeSitterWrapper implementation in this module
