# ADR-004: Python Symbol Extractor Architecture

## Status
Proposed

## Date
2025-02-22

## Context

APEX needs to extract symbols (functions, classes, constants, type annotations) from Python source files for cross-reference validation, documentation analysis, and codebase intelligence features. This capability complements the existing TypeScript/JavaScript symbol extraction in `CrossReferenceValidator`.

### Current State
- `TreeSitterWrapper` already supports Python parsing via `tree-sitter-python` (v0.23.6)
- `CrossReferenceValidator` provides symbol extraction for TypeScript/JavaScript using regex-based parsing
- Python support is needed to enable cross-language codebase analysis

### Requirements
1. Extract Python symbols: functions, classes, methods, constants, type annotations
2. Leverage existing tree-sitter Python parsing infrastructure
3. Follow established patterns from `SymbolInfo` interface
4. Support Python-specific constructs: decorators, async functions, dataclasses, type hints
5. Integrate with the existing codebase intelligence module structure

## Decision

### Architecture Overview

Create a **language-specific extractor architecture** with:

1. **Base Extractor Interface** (`types.ts`) - Common types for all language extractors
2. **Python Symbol Extractor** (`python-extractor.ts`) - Tree-sitter AST-based extraction
3. **Export via index.ts** - Clean public API

### Directory Structure

```
packages/orchestrator/src/codebase-intelligence/
├── index.ts                    # Main exports (updated)
├── parsers/                    # Existing parsers
│   ├── tree-sitter-wrapper.ts
│   └── types.ts
└── extractors/                 # NEW: Language-specific extractors
    ├── index.ts                # Barrel export
    ├── types.ts                # Common extractor types
    ├── base-extractor.ts       # Abstract base class (optional future)
    └── python-extractor.ts     # Python implementation
```

### Type Definitions

Extend the existing `SymbolInfo` interface pattern with Python-specific metadata:

```typescript
// packages/orchestrator/src/codebase-intelligence/extractors/types.ts

/**
 * Symbol types supported by extractors
 * Extends beyond TS/JS to support Python constructs
 */
export type ExtractedSymbolKind =
  | 'function'      // Regular function
  | 'async_function'// Async function
  | 'class'         // Class definition
  | 'method'        // Class method
  | 'property'      // Class property / descriptor
  | 'constant'      // Module-level constant (UPPER_CASE)
  | 'variable'      // Module-level variable
  | 'type_alias'    // Type annotation alias
  | 'decorator'     // Decorator definition
  | 'dataclass';    // @dataclass decorated class

/**
 * Type annotation extracted from Python code
 */
export interface TypeAnnotation {
  raw: string;           // Original annotation text
  baseType: string;      // Base type (e.g., 'List', 'Optional', 'Dict')
  typeArgs?: string[];   // Generic arguments (e.g., ['str', 'int'] for Dict[str, int])
  isOptional: boolean;   // Whether wrapped in Optional
}

/**
 * Decorator information
 */
export interface DecoratorInfo {
  name: string;          // Decorator name (e.g., 'property', 'staticmethod')
  arguments?: string[];  // Decorator arguments if present
  isBuiltin: boolean;    // Whether it's a known Python builtin decorator
}

/**
 * Parameter information for functions/methods
 */
export interface ParameterInfo {
  name: string;
  typeAnnotation?: TypeAnnotation;
  hasDefault: boolean;
  isKwOnly: boolean;     // Keyword-only parameter (after *)
  isPosOnly: boolean;    // Position-only parameter (before /)
  isVararg: boolean;     // *args
  isKwargs: boolean;     // **kwargs
}

/**
 * Extracted symbol from Python source code
 */
export interface ExtractedSymbol {
  /** Symbol name */
  name: string;
  /** Symbol kind */
  kind: ExtractedSymbolKind;
  /** Source file path */
  filePath: string;
  /** Start line (1-based) */
  startLine: number;
  /** End line (1-based) */
  endLine: number;
  /** Column number (0-based) */
  column: number;
  /** Whether exported (module-level in Python) */
  isExported: boolean;
  /** Whether private (name starts with _) */
  isPrivate: boolean;
  /** Whether dunder method (__name__) */
  isDunder: boolean;
  /** Parent symbol (for methods inside classes) */
  parent?: string;
  /** Decorators applied to this symbol */
  decorators: DecoratorInfo[];
  /** Parameters (for functions/methods) */
  parameters?: ParameterInfo[];
  /** Return type annotation */
  returnType?: TypeAnnotation;
  /** Docstring if present */
  docstring?: string;
  /** Whether this is an async function/method */
  isAsync: boolean;
  /** Base classes (for class definitions) */
  baseClasses?: string[];
}

/**
 * Extraction result containing all symbols from a file
 */
export interface ExtractionResult {
  /** Source file path */
  filePath: string;
  /** All extracted symbols */
  symbols: ExtractedSymbol[];
  /** Parse errors encountered */
  errors: string[];
  /** Extraction statistics */
  stats: {
    functions: number;
    classes: number;
    methods: number;
    constants: number;
    variables: number;
    typeAnnotations: number;
  };
}

/**
 * Options for symbol extraction
 */
export interface ExtractionOptions {
  /** Include private symbols (_name) */
  includePrivate?: boolean;
  /** Include dunder methods (__name__) */
  includeDunder?: boolean;
  /** Include class methods and properties */
  includeMembers?: boolean;
  /** Extract docstrings */
  extractDocstrings?: boolean;
  /** Extract type annotations */
  extractTypeAnnotations?: boolean;
}
```

### Python Extractor Implementation Strategy

```typescript
// packages/orchestrator/src/codebase-intelligence/extractors/python-extractor.ts

/**
 * PythonSymbolExtractor uses tree-sitter AST to extract symbols
 *
 * Supported Python AST node types:
 * - module: Root node for Python files
 * - function_definition: def name(...): ...
 * - class_definition: class Name(...): ...
 * - decorated_definition: @decorator def/class
 * - assignment: name = value (for constants/variables)
 * - type_alias_statement: type Name = Type (Python 3.12+)
 * - expression_statement: For docstrings
 */
export class PythonSymbolExtractor {
  private wrapper: TreeSitterWrapper;

  /**
   * Extract symbols from Python source code
   */
  async extractFromCode(
    code: string,
    filePath: string,
    options?: ExtractionOptions
  ): Promise<ExtractionResult>;

  /**
   * Extract symbols from a Python file
   */
  async extractFromFile(
    filePath: string,
    options?: ExtractionOptions
  ): Promise<ExtractionResult>;

  // AST Traversal Methods
  private visitNode(node: SyntaxNode, context: ExtractionContext): void;
  private extractFunction(node: SyntaxNode, context: ExtractionContext): ExtractedSymbol;
  private extractClass(node: SyntaxNode, context: ExtractionContext): ExtractedSymbol;
  private extractDecorated(node: SyntaxNode, context: ExtractionContext): ExtractedSymbol;
  private extractAssignment(node: SyntaxNode, context: ExtractionContext): ExtractedSymbol | null;

  // Helper Methods
  private extractDecorators(node: SyntaxNode): DecoratorInfo[];
  private extractParameters(parametersNode: SyntaxNode): ParameterInfo[];
  private extractTypeAnnotation(node: SyntaxNode): TypeAnnotation | undefined;
  private extractDocstring(bodyNode: SyntaxNode): string | undefined;
  private isConstant(name: string): boolean; // Check UPPER_CASE convention
  private isPrivate(name: string): boolean;  // Check _prefix
  private isDunder(name: string): boolean;   // Check __name__ pattern
}
```

### Python AST Node Mapping

| Python Construct | Tree-sitter Node Type | Extracted Symbol Kind |
|-----------------|----------------------|----------------------|
| `def func():` | `function_definition` | `function` |
| `async def func():` | `function_definition` (with async child) | `async_function` |
| `class Foo:` | `class_definition` | `class` |
| `@dataclass class Foo:` | `decorated_definition` → `class_definition` | `dataclass` |
| `def method(self):` | `function_definition` (inside class) | `method` |
| `@property def x(self):` | `decorated_definition` | `property` |
| `NAME = value` | `assignment` | `constant` |
| `name = value` | `assignment` | `variable` |
| `type Alias = Type` | `type_alias_statement` | `type_alias` |

### Integration Points

1. **codebase-intelligence/index.ts**: Add export for extractors module
2. **Cross-Reference Validator**: Future integration for Python cross-references
3. **Idle Task Generator**: Use for codebase analysis tasks

### Error Handling Strategy

- Return partial results on parse errors (tree-sitter handles recovery)
- Log warnings for unsupported constructs
- Include error details in `ExtractionResult.errors`
- Never throw on invalid Python code (graceful degradation)

## Consequences

### Positive
- Clean separation of concerns with language-specific extractors
- Leverages existing tree-sitter infrastructure (no new dependencies)
- AST-based approach is more accurate than regex
- Type-safe extraction with full TypeScript types
- Supports Python 3.12+ features (type alias statements)
- Extensible pattern for adding Go, Java, Rust extractors

### Negative
- Requires understanding of tree-sitter Python grammar
- More complex than regex-based approach
- May need updates for new Python syntax

### Neutral
- Different approach from CrossReferenceValidator (AST vs regex)
- Could eventually replace regex-based extraction with AST-based

## Implementation Plan

### Phase 1: Core Infrastructure (Developer Stage)
1. Create `extractors/types.ts` with interfaces
2. Create `extractors/python-extractor.ts` with basic extraction
3. Create `extractors/index.ts` barrel export
4. Update `codebase-intelligence/index.ts` to export extractors

### Phase 2: Symbol Extraction (Developer Stage)
1. Implement function extraction (sync and async)
2. Implement class extraction with methods/properties
3. Implement constant/variable detection
4. Implement decorator extraction

### Phase 3: Advanced Features (Developer Stage)
1. Add type annotation extraction
2. Add docstring extraction
3. Add parameter extraction with type hints
4. Add base class extraction

### Phase 4: Testing (Tester Stage)
1. Unit tests for each extraction method
2. Integration tests with real Python files
3. Edge case tests (decorators, async, generics)
4. Performance tests for large files

## Alternatives Considered

### 1. Extend CrossReferenceValidator for Python
- **Rejected**: Regex-based approach is brittle for Python's complex syntax
- Decorators, type hints, and async patterns are hard to match with regex

### 2. Use Python AST module via child process
- **Rejected**: Requires Python runtime, adds complexity
- tree-sitter already provides excellent Python parsing

### 3. Single unified SymbolExtractor class
- **Rejected**: Languages have different constructs (decorators, type hints)
- Language-specific extractors provide better type safety

## References

- [tree-sitter-python grammar](https://github.com/tree-sitter/tree-sitter-python)
- [Python AST reference](https://docs.python.org/3/library/ast.html)
- Existing code: `packages/orchestrator/src/analyzers/cross-reference-validator.ts`
- Existing code: `packages/orchestrator/src/codebase-intelligence/parsers/tree-sitter-wrapper.ts`
