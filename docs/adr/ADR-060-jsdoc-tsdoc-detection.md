# ADR-060: JSDoc/TSDoc Detection Module

## Status

Proposed

## Context

APEX needs to analyze TypeScript/JavaScript codebases to identify public exports that are missing JSDoc/TSDoc documentation. This capability supports the documentation analysis features and helps the DocsAnalyzer provide actionable suggestions for improving code documentation.

The module must handle:
1. **Named exports**: `export function foo()`, `export class Bar`, `export interface Baz`
2. **Default exports**: `export default function()`, `export default class Foo`
3. **Re-exports**: `export { foo } from './module'`, `export * from './module'`
4. **Type exports**: `export type Foo`, `export interface Bar`
5. **Variable exports**: `export const foo`, `export let bar`

## Decision

### Module Location

Create a new utility module at `packages/core/src/jsdoc-detector.ts` with corresponding exports in `packages/core/src/index.ts`.

**Rationale**: Following the existing pattern where parsing utilities live in `packages/core/src/` as standalone files (similar to `utils.ts` containing `parseSemver`, `parseConventionalCommit`, etc.), this module will provide reusable parsing functionality for the entire monorepo.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     jsdoc-detector.ts                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌───────────────────────────────────┐   │
│  │  Type Exports   │    │          Core Functions           │   │
│  ├─────────────────┤    ├───────────────────────────────────┤   │
│  │ ExportKind      │    │ parseJSDocComment()               │   │
│  │ ExportInfo      │    │ findExportsInSource()             │   │
│  │ JSDocInfo       │    │ detectUndocumentedExports()       │   │
│  │ DetectionResult │    │ analyzeFile() - main entry        │   │
│  │ DetectionConfig │    │ analyzeFiles() - batch processing │   │
│  └─────────────────┘    └───────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Internal Helpers                           ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ isExportLine() - Detect export statements                   ││
│  │ parseExportStatement() - Extract export info                ││
│  │ extractPrecedingComment() - Get JSDoc before export         ││
│  │ isValidJSDoc() - Validate JSDoc completeness                ││
│  │ getExportKind() - Determine function/class/interface/etc    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Type Definitions

```typescript
/**
 * Types of exports that can be detected
 */
export type ExportKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'const'
  | 'let'
  | 'var'
  | 'enum'
  | 'namespace'
  | 're-export'
  | 'default'
  | 'unknown';

/**
 * Information about a detected export
 */
export interface ExportInfo {
  /** Name of the exported item (empty for default exports) */
  name: string;
  /** Type of export */
  kind: ExportKind;
  /** Line number where the export is defined (1-indexed) */
  line: number;
  /** Column number where the export starts (1-indexed) */
  column: number;
  /** Whether this is a default export */
  isDefault: boolean;
  /** Whether this is a re-export from another module */
  isReExport: boolean;
  /** Source module for re-exports */
  sourceModule?: string;
  /** The raw export statement */
  rawStatement: string;
}

/**
 * Parsed JSDoc/TSDoc comment
 */
export interface JSDocInfo {
  /** The full raw JSDoc comment */
  raw: string;
  /** The summary/description text */
  summary: string;
  /** Line where the JSDoc starts */
  startLine: number;
  /** Line where the JSDoc ends */
  endLine: number;
  /** Parsed JSDoc tags */
  tags: JSDocTag[];
  /** Whether the JSDoc has meaningful content (not just empty) */
  hasContent: boolean;
}

/**
 * A single JSDoc tag
 */
export interface JSDocTag {
  /** Tag name (e.g., 'param', 'returns', 'deprecated') */
  name: string;
  /** Tag value/content */
  value: string;
  /** Parameter name for @param tags */
  paramName?: string;
  /** Type annotation if present */
  type?: string;
}

/**
 * Result of analyzing an export for documentation
 */
export interface ExportDocumentation {
  /** The export information */
  export: ExportInfo;
  /** Associated JSDoc comment, if present */
  jsdoc: JSDocInfo | null;
  /** Whether the export has adequate documentation */
  isDocumented: boolean;
  /** Suggestions for improving documentation */
  suggestions: string[];
}

/**
 * Configuration options for detection
 */
export interface DetectionConfig {
  /** Check for specific required tags (default: none required) */
  requiredTags?: string[];
  /** Minimum summary length to consider documented (default: 10) */
  minSummaryLength?: number;
  /** Include re-exports in analysis (default: false) */
  includeReExports?: boolean;
  /** Include private exports (underscore prefix) (default: false) */
  includePrivate?: boolean;
  /** File extensions to analyze (default: ['.ts', '.tsx', '.js', '.jsx']) */
  extensions?: string[];
}

/**
 * Result of analyzing a file
 */
export interface FileAnalysisResult {
  /** File path that was analyzed */
  filePath: string;
  /** All detected exports */
  exports: ExportInfo[];
  /** Documentation status for each export */
  documentation: ExportDocumentation[];
  /** Summary statistics */
  stats: {
    totalExports: number;
    documentedExports: number;
    undocumentedExports: number;
    coveragePercent: number;
  };
  /** Any parsing errors encountered */
  errors: string[];
}
```

### Implementation Approach: Regex-Based Parsing

**Decision**: Use regex-based parsing rather than full AST (Abstract Syntax Tree) parsing.

**Rationale**:
1. **Consistency**: The existing codebase uses regex for all parsing (see `parseConventionalCommit`, `parseSemver`, `parseAgentMarkdown`)
2. **Zero Dependencies**: No need to add TypeScript compiler or Babel as dependencies
3. **Performance**: Regex is faster for straightforward pattern matching
4. **Simplicity**: Easier to maintain and understand
5. **Sufficient for Requirements**: Export detection doesn't require semantic analysis

**Trade-offs**:
- May miss complex edge cases (dynamic exports, computed property names)
- Can't distinguish between type-only and value exports without running TypeScript
- Acceptable for documentation analysis use case

### Regex Patterns

```typescript
// Export detection patterns
const PATTERNS = {
  // Named exports: export function foo, export class Bar, etc.
  namedExport: /^export\s+(async\s+)?(function|class|interface|type|const|let|var|enum|namespace)\s+(\w+)/,

  // Default exports: export default function foo, export default class, etc.
  defaultExport: /^export\s+default\s+(async\s+)?(function|class)?\s*(\w*)/,

  // Re-exports: export { foo } from './module', export * from './module'
  reExport: /^export\s+(?:(\*)|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/,

  // Export list: export { foo, bar as baz }
  exportList: /^export\s+{([^}]+)}/,

  // JSDoc block: /** ... */
  jsDocBlock: /\/\*\*\s*([\s\S]*?)\s*\*\//g,

  // JSDoc tag: @tagname content
  jsDocTag: /@(\w+)(?:\s+{([^}]*)})?(?:\s+(\w+))?(?:\s+(.*))?/,
};
```

### Core Functions

#### 1. `parseJSDocComment(comment: string): JSDocInfo | null`

Parses a JSDoc comment block into structured information.

```typescript
// Input:  "/** @param name The user's name\n * @returns Greeting */""
// Output: { summary: "", tags: [{name: "param", paramName: "name", ...}, ...], ... }
```

#### 2. `findExportsInSource(source: string): ExportInfo[]`

Scans source code and returns all detected exports with their line numbers and types.

#### 3. `detectUndocumentedExports(source: string, config?: DetectionConfig): ExportDocumentation[]`

Main detection function that finds exports and checks for associated JSDoc comments.

**Algorithm**:
1. Split source into lines
2. Scan for JSDoc blocks and record their end line numbers
3. Scan for export statements
4. For each export, check if a JSDoc block ends on the line immediately before
5. Validate JSDoc content against config requirements
6. Return documentation status for each export

#### 4. `analyzeFile(filePath: string, source: string, config?: DetectionConfig): FileAnalysisResult`

Analyzes a single file and returns comprehensive results including statistics.

#### 5. `analyzeFiles(files: Array<{path: string, content: string}>, config?: DetectionConfig): FileAnalysisResult[]`

Batch processing for multiple files (for use by idle processor).

### Integration Points

#### With DocsAnalyzer

The `DocsAnalyzer` in `packages/orchestrator/src/analyzers/docs-analyzer.ts` will use this module to populate the `undocumentedExports` field in `ProjectAnalysis.documentation`:

```typescript
// In idle-processor.ts or project-analyzer
import { analyzeFiles, DetectionConfig } from '@apex/core';

const results = analyzeFiles(sourceFiles, {
  includeReExports: false,
  includePrivate: false,
});

// Map to UndocumentedExport[] type from types.ts
const undocumentedExports: UndocumentedExport[] = results
  .flatMap(result =>
    result.documentation
      .filter(doc => !doc.isDocumented)
      .map(doc => ({
        file: result.filePath,
        name: doc.export.name,
        type: mapKindToType(doc.export.kind),
        line: doc.export.line,
        isPublic: !doc.export.name.startsWith('_'),
      }))
  );
```

#### With Existing Types

The module output aligns with `UndocumentedExport` interface already defined in `packages/core/src/types.ts` (lines 696-707):

```typescript
export interface UndocumentedExport {
  file: string;
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'namespace';
  line: number;
  isPublic: boolean;
}
```

### File Structure

```
packages/core/src/
├── index.ts              # Add: export * from './jsdoc-detector'
├── jsdoc-detector.ts     # New: Main detection module (~300-400 lines)
└── __tests__/
    └── jsdoc-detector.test.ts  # New: Unit tests (~200-300 lines)
```

### Error Handling

Following the project pattern of returning `null` for parse failures:
- Invalid JSDoc syntax → return partial result with `hasContent: false`
- Malformed export statements → skip and add to `errors` array
- File read errors → bubble up to caller

### Performance Considerations

1. **Line-by-line scanning**: Avoid loading entire file into memory for regex
2. **Early termination**: Stop scanning after closing brace for non-exported items
3. **Caching**: Consider memoizing JSDoc positions for multi-pass scenarios
4. **Streaming support**: Design API to support streaming file content in future

## Consequences

### Positive

- **Reusable**: Any package in the monorepo can import from `@apex/core`
- **Type-safe**: Full TypeScript types with Zod-compatible patterns
- **Testable**: Pure functions with clear inputs/outputs
- **Consistent**: Follows established parsing patterns in the codebase
- **Low overhead**: No new runtime dependencies

### Negative

- **Limited accuracy**: Regex can't handle all edge cases
- **No semantic analysis**: Can't detect if JSDoc describes correct types
- **Manual maintenance**: Patterns may need updates for new syntax

### Neutral

- **Scope limited**: Only detects presence of JSDoc, not quality
- **TypeScript-focused**: Best accuracy for TS/TSX files

## Implementation Plan

1. **Phase 1**: Core parsing functions (parseJSDocComment, findExportsInSource)
2. **Phase 2**: Detection logic (detectUndocumentedExports)
3. **Phase 3**: File analysis wrappers (analyzeFile, analyzeFiles)
4. **Phase 4**: Unit tests with comprehensive test cases
5. **Phase 5**: Integration with DocsAnalyzer

## Test Cases

The implementation should handle these cases:

```typescript
// Named function export
export function processData(input: string): string { }

// Named async function export
export async function fetchData(): Promise<Data> { }

// Class export
export class DataProcessor { }

// Interface export
export interface ProcessorConfig { }

// Type alias export
export type DataType = string | number;

// Const export
export const DEFAULT_CONFIG = { };

// Enum export
export enum Status { Active, Inactive }

// Default export
export default function main() { }

// Default class export
export default class App { }

// Re-exports
export { helper } from './helpers';
export * from './utils';
export { foo as bar } from './module';

// Export list
export { localFunc, LocalClass };

// With JSDoc
/**
 * Processes input data
 * @param input - The input string
 * @returns Processed output
 */
export function documented(input: string): string { }
```

## References

- [JSDoc Documentation](https://jsdoc.app/)
- [TSDoc Specification](https://tsdoc.org/)
- Existing parsing utilities: `packages/core/src/utils.ts`
- DocsAnalyzer: `packages/orchestrator/src/analyzers/docs-analyzer.ts`
- UndocumentedExport type: `packages/core/src/types.ts:696-707`
