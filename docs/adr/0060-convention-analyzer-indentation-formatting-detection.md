# ADR-0060: ConventionAnalyzer Indentation and Formatting Detection Architecture

**Status**: Proposed
**Date**: 2026-02-22
**Author**: Architect Agent
**Feature**: v0.6.0 Brownfield Codebase Analysis - ConventionAnalyzer
**Component**: `packages/orchestrator/src/codebase-analyzer/analyzers/convention-analyzer.ts`

## Context

APEX v0.6.0 introduces brownfield codebase analysis capabilities. The `ConventionAnalyzer` is a critical component responsible for detecting coding conventions and style patterns in existing codebases. This ADR defines the architecture for **indentation detection** and **formatting preferences detection**.

### Current State
1. **Type Definitions Exist**: `ConventionAnalysis` type is fully defined in `packages/core/src/types.ts`
2. **Implementation Missing**: The `codebase-analyzer/` directory does not exist
3. **Export Declarations Exist**: `packages/orchestrator/src/index.ts` exports `ConventionAnalyzer` from a non-existent module

### Target Type Structure

```typescript
// From packages/core/src/types.ts (lines 11031-11074)
export const ConventionAnalysisSchema = z.object({
  fileNaming: z.enum(['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent']),
  functionNaming: z.enum(['camelCase', 'PascalCase', 'snake_case', 'mixed', 'inconsistent']),
  variableNaming: z.enum(['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent']),
  classNaming: z.enum(['PascalCase', 'camelCase', 'snake_case', 'mixed', 'inconsistent']).optional(),
  constantNaming: z.enum(['SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase', 'mixed', 'inconsistent']).optional(),

  indentation: z.object({
    type: z.enum(['spaces', 'tabs', 'mixed']),
    size: z.number().int().min(1).max(8).optional(),
  }),

  imports: z.object({
    style: z.enum(['es6', 'commonjs', 'amd', 'umd', 'mixed']),
    grouping: z.enum(['none', 'type-separate', 'source-separate', 'alphabetical', 'custom']).optional(),
    quotes: z.enum(['single', 'double', 'mixed']).optional(),
  }),

  documentation: z.object({
    style: z.enum(['jsdoc', 'tsdoc', 'inline', 'markdown', 'none', 'mixed']),
    coverage: z.number().min(0).max(100),
  }),

  formatting: z.object({
    lineLength: z.number().int().min(40).max(200).optional(),
    semicolons: z.enum(['required', 'optional', 'mixed']).optional(),
    quotes: z.enum(['single', 'double', 'backtick', 'mixed']).optional(),
    trailingCommas: z.enum(['always', 'never', 'es5', 'mixed']).optional(),
  }).optional(),
});
```

## Decision

### 1. Module Architecture

Create a standalone `ConventionAnalyzer` class following the established analyzer patterns in the codebase.

```
packages/orchestrator/src/codebase-analyzer/
├── index.ts                          # Factory and orchestrator exports
├── types.ts                          # Shared types for codebase analysis
└── analyzers/
    └── convention-analyzer.ts        # Main ConventionAnalyzer implementation
```

### 2. ConventionAnalyzer Class Design

```typescript
/**
 * ConventionAnalyzer analyzes coding conventions and style patterns
 * in a codebase, returning a ConventionAnalysis result.
 */
export class ConventionAnalyzer implements CodebaseAnalyzerBase {
  readonly domain: AnalysisDomain = 'conventions';
  readonly name = 'Convention Analyzer';

  /**
   * Main analysis entry point
   */
  async analyze(context: AnalysisContext): Promise<ConventionAnalysis>;

  /**
   * Estimate complexity for progress reporting
   */
  estimateComplexity(context: AnalysisContext): number;
}
```

### 3. Indentation Detection Architecture

#### 3.1 Detection Strategy

Use a **statistical sampling approach** to determine indentation patterns:

```typescript
interface IndentationSample {
  /** The indentation string (spaces or tabs) */
  indent: string;
  /** Type: spaces or tabs */
  type: 'spaces' | 'tabs';
  /** Size in characters */
  size: number;
  /** File path for context */
  file: string;
  /** Line number */
  line: number;
}

interface IndentationAnalysis {
  type: 'spaces' | 'tabs' | 'mixed';
  size?: number;
  confidence: number;
  samples: number;
}
```

#### 3.2 Indentation Detection Algorithm

```typescript
/**
 * IndentationDetector - Stateless utility for indentation analysis
 */
class IndentationDetector {
  /**
   * Detect indentation pattern from file content
   *
   * Algorithm:
   * 1. Extract all leading whitespace from non-empty, non-comment lines
   * 2. Identify indent "units" by looking at indent level changes
   * 3. Classify each unit as spaces or tabs
   * 4. Determine dominant pattern and calculate size
   */
  detectFromContent(content: string): IndentationSample[];

  /**
   * Aggregate samples into final analysis
   *
   * Rules:
   * - If >80% samples are same type: that type wins
   * - If mixed (20-80% split): report 'mixed'
   * - Size is the mode of detected sizes (most common)
   * - Size only meaningful for spaces (tabs are always 1 unit)
   */
  aggregateSamples(samples: IndentationSample[]): IndentationAnalysis;
}
```

#### 3.3 Indentation Detection Implementation

```typescript
/**
 * Core detection logic for a single file
 */
function detectIndentation(content: string): IndentationSample[] {
  const lines = content.split('\n');
  const samples: IndentationSample[] = [];
  let previousIndentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines and comment-only lines
    if (isEmptyOrComment(line)) continue;

    // Extract leading whitespace
    const match = line.match(/^(\s+)/);
    if (!match) {
      previousIndentLevel = 0;
      continue;
    }

    const indent = match[1];
    const currentIndentLevel = indent.length;

    // Only sample when indent level increases (indicates one indent unit)
    if (currentIndentLevel > previousIndentLevel) {
      const indentDiff = currentIndentLevel - previousIndentLevel;
      const indentUnit = indent.slice(previousIndentLevel);

      samples.push({
        indent: indentUnit,
        type: indentUnit.includes('\t') ? 'tabs' : 'spaces',
        size: indentUnit.length,
        file: '', // Set by caller
        line: i + 1,
      });
    }

    previousIndentLevel = currentIndentLevel;
  }

  return samples;
}

/**
 * Aggregate all samples across files
 */
function aggregateIndentation(allSamples: IndentationSample[]): IndentationAnalysis {
  if (allSamples.length === 0) {
    return { type: 'spaces', size: 2, confidence: 0, samples: 0 };
  }

  // Count by type
  const tabCount = allSamples.filter(s => s.type === 'tabs').length;
  const spaceCount = allSamples.filter(s => s.type === 'spaces').length;
  const total = allSamples.length;

  // Determine dominant type
  const tabRatio = tabCount / total;
  let type: 'spaces' | 'tabs' | 'mixed';

  if (tabRatio > 0.8) {
    type = 'tabs';
  } else if (tabRatio < 0.2) {
    type = 'spaces';
  } else {
    type = 'mixed';
  }

  // Calculate size for spaces (mode of sizes)
  let size: number | undefined;
  if (type === 'spaces' || type === 'mixed') {
    const spaceSamples = allSamples.filter(s => s.type === 'spaces');
    if (spaceSamples.length > 0) {
      const sizeCounts = new Map<number, number>();
      for (const sample of spaceSamples) {
        sizeCounts.set(sample.size, (sizeCounts.get(sample.size) || 0) + 1);
      }
      // Find mode
      let maxCount = 0;
      for (const [sz, count] of sizeCounts) {
        if (count > maxCount) {
          maxCount = count;
          size = sz;
        }
      }
    }
  }

  // Calculate confidence
  const dominantCount = Math.max(tabCount, spaceCount);
  const confidence = dominantCount / total;

  return { type, size, confidence, samples: total };
}
```

#### 3.4 Edge Cases for Indentation

| Edge Case | Handling |
|-----------|----------|
| Empty files | Return default (spaces, size 2, confidence 0) |
| Files with no indentation | Excluded from samples |
| Mixed tabs and spaces in same line | Classify as 'mixed' |
| Inconsistent indent sizes | Report mode (most common) |
| Only comments | Skip file entirely |
| Binary files | Detected and skipped before analysis |
| Very large files (>1MB) | Sample first 10,000 lines only |

### 4. Formatting Detection Architecture

#### 4.1 Detection Strategy

Analyze formatting preferences using pattern matching and statistical analysis:

```typescript
interface FormattingAnalysis {
  lineLength?: number;
  semicolons?: 'required' | 'optional' | 'mixed';
  quotes?: 'single' | 'double' | 'backtick' | 'mixed';
  trailingCommas?: 'always' | 'never' | 'es5' | 'mixed';
}

interface FormattingSample {
  file: string;
  hasSemicolons: boolean;
  quoteStyle: 'single' | 'double' | 'backtick';
  hasTrailingComma: boolean;
  maxLineLength: number;
}
```

#### 4.2 Semicolon Detection

```typescript
/**
 * Detect semicolon usage pattern
 *
 * Strategy:
 * 1. Find statement-ending lines (not in comments/strings)
 * 2. Check if they end with semicolon
 * 3. Calculate ratio to determine pattern
 */
function detectSemicolons(content: string, fileType: string): 'required' | 'optional' | 'mixed' | null {
  // Skip non-JS/TS files
  if (!['js', 'ts', 'jsx', 'tsx'].includes(fileType)) {
    return null;
  }

  const lines = content.split('\n');
  let withSemi = 0;
  let withoutSemi = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty, comments, and structural lines
    if (isStatementEndingLine(trimmed)) {
      if (trimmed.endsWith(';')) {
        withSemi++;
      } else {
        withoutSemi++;
      }
    }
  }

  const total = withSemi + withoutSemi;
  if (total === 0) return null;

  const semiRatio = withSemi / total;

  if (semiRatio > 0.9) return 'required';
  if (semiRatio < 0.1) return 'optional';
  return 'mixed';
}

/**
 * Determine if line represents a statement that could end with semicolon
 */
function isStatementEndingLine(line: string): boolean {
  // Skip empty lines
  if (!line) return false;

  // Skip comments
  if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
    return false;
  }

  // Skip lines ending with structural characters
  const structuralEndings = ['{', '}', '(', ')', '[', ']', ',', ':'];
  const lastChar = line.slice(-1);
  if (structuralEndings.includes(lastChar)) return false;

  // Skip lines that are clearly not statements
  if (line.startsWith('import ') && !line.endsWith(';')) {
    // Could be multi-line import
    return false;
  }

  return true;
}
```

#### 4.3 Quote Style Detection

```typescript
/**
 * Detect quote style preferences
 *
 * Strategy:
 * 1. Find all string literals using regex
 * 2. Categorize by quote type (single, double, backtick)
 * 3. Determine dominant style
 */
function detectQuoteStyle(content: string): 'single' | 'double' | 'backtick' | 'mixed' {
  // Simple regex patterns for string detection
  // Note: This is approximate - full parsing would require AST
  const singleQuotes = (content.match(/'[^'\\]*(?:\\.[^'\\]*)*'/g) || []).length;
  const doubleQuotes = (content.match(/"[^"\\]*(?:\\.[^"\\]*)*"/g) || []).length;
  const backticks = (content.match(/`[^`\\]*(?:\\.[^`\\]*)*`/g) || []).length;

  const total = singleQuotes + doubleQuotes + backticks;
  if (total === 0) return 'single'; // Default

  const max = Math.max(singleQuotes, doubleQuotes, backticks);
  const dominantRatio = max / total;

  if (dominantRatio < 0.7) return 'mixed';

  if (max === singleQuotes) return 'single';
  if (max === doubleQuotes) return 'double';
  return 'backtick';
}
```

#### 4.4 Trailing Comma Detection

```typescript
/**
 * Detect trailing comma preferences
 *
 * Strategy:
 * 1. Find array/object literals with multiple lines
 * 2. Check if last element before closing bracket has trailing comma
 * 3. Determine pattern based on consistency
 */
function detectTrailingCommas(content: string): 'always' | 'never' | 'es5' | 'mixed' {
  // Find multiline arrays and objects
  const multilineStructures = findMultilineStructures(content);

  let withTrailing = 0;
  let withoutTrailing = 0;
  let functionParamsWithTrailing = 0;
  let functionParamsWithout = 0;

  for (const structure of multilineStructures) {
    if (structure.hasTrailingComma) {
      if (structure.isFunction) {
        functionParamsWithTrailing++;
      }
      withTrailing++;
    } else {
      if (structure.isFunction) {
        functionParamsWithout++;
      }
      withoutTrailing++;
    }
  }

  const total = withTrailing + withoutTrailing;
  if (total === 0) return 'never'; // Default

  const trailingRatio = withTrailing / total;

  // Check for ES5 pattern (trailing in objects/arrays but not functions)
  if (trailingRatio > 0.5 && functionParamsWithTrailing === 0) {
    return 'es5';
  }

  if (trailingRatio > 0.8) return 'always';
  if (trailingRatio < 0.2) return 'never';
  return 'mixed';
}
```

#### 4.5 Line Length Analysis

```typescript
/**
 * Detect predominant line length limit
 *
 * Strategy:
 * 1. Calculate max line length per file
 * 2. Find common "ceiling" values (80, 100, 120, etc.)
 * 3. Report the apparent limit
 */
function detectLineLength(content: string): number {
  const lines = content.split('\n');
  const lengths = lines.map(l => l.length).filter(l => l > 0);

  if (lengths.length === 0) return 80; // Default

  // Find the 95th percentile to avoid outliers
  lengths.sort((a, b) => a - b);
  const p95Index = Math.floor(lengths.length * 0.95);
  const p95Length = lengths[p95Index];

  // Round to common line length limits
  const commonLimits = [80, 100, 120, 140, 160, 200];
  for (const limit of commonLimits) {
    if (p95Length <= limit) {
      return limit;
    }
  }

  return 200; // Max allowed by schema
}
```

### 5. Integration with ConventionAnalyzer

```typescript
export class ConventionAnalyzer implements CodebaseAnalyzerBase {
  readonly domain: AnalysisDomain = 'conventions';
  readonly name = 'Convention Analyzer';

  private indentationDetector = new IndentationDetector();
  private formattingDetector = new FormattingDetector();

  async analyze(context: AnalysisContext): Promise<ConventionAnalysis> {
    const { files, projectPath, options } = context;

    // Filter to analyzable files
    const sourceFiles = files.filter(f => this.isSourceFile(f.path));

    // Collect samples from all files (with parallel processing)
    const indentSamples: IndentationSample[] = [];
    const formatSamples: FormattingSample[] = [];

    await Promise.all(sourceFiles.map(async (file) => {
      const content = await fs.readFile(file.path, 'utf-8');

      // Indentation sampling
      const fileSamples = this.indentationDetector.detectFromContent(content);
      fileSamples.forEach(s => s.file = file.path);
      indentSamples.push(...fileSamples);

      // Formatting sampling
      const formatSample = this.formattingDetector.analyzeFile(content, file.path);
      formatSamples.push(formatSample);
    }));

    // Aggregate results
    const indentation = this.indentationDetector.aggregateSamples(indentSamples);
    const formatting = this.formattingDetector.aggregateSamples(formatSamples);

    return {
      fileNaming: await this.detectFileNaming(sourceFiles),
      functionNaming: await this.detectFunctionNaming(sourceFiles),
      variableNaming: await this.detectVariableNaming(sourceFiles),
      classNaming: await this.detectClassNaming(sourceFiles),
      constantNaming: await this.detectConstantNaming(sourceFiles),
      indentation: {
        type: indentation.type,
        size: indentation.size,
      },
      imports: await this.detectImportStyle(sourceFiles),
      documentation: await this.detectDocumentation(sourceFiles),
      formatting: {
        lineLength: formatting.lineLength,
        semicolons: formatting.semicolons,
        quotes: formatting.quotes,
        trailingCommas: formatting.trailingCommas,
      },
    };
  }

  estimateComplexity(context: AnalysisContext): number {
    // Estimate based on file count
    const fileCount = context.files?.length ?? 0;
    if (fileCount < 50) return 1;
    if (fileCount < 200) return 2;
    if (fileCount < 500) return 3;
    return 4;
  }

  private isSourceFile(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase();
    return ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext ?? '');
  }
}
```

### 6. Performance Considerations

| Optimization | Description |
|-------------|-------------|
| **Lazy File Reading** | Read file content only when needed |
| **Parallel Processing** | Process multiple files concurrently (configurable limit) |
| **Sampling for Large Files** | Sample first 10K lines for files >1MB |
| **Early Termination** | Stop sampling when confidence threshold reached |
| **Caching** | Cache parsed results for repeated analysis |

### 7. Testing Strategy

#### 7.1 Unit Tests

```typescript
describe('IndentationDetector', () => {
  describe('detectFromContent', () => {
    it('detects 2-space indentation', () => {
      const content = `function foo() {
  const x = 1;
  if (x) {
    return x;
  }
}`;
      const samples = detector.detectFromContent(content);
      expect(samples).toContainEqual(expect.objectContaining({
        type: 'spaces',
        size: 2,
      }));
    });

    it('detects 4-space indentation', () => {
      const content = `function foo() {
    const x = 1;
}`;
      const samples = detector.detectFromContent(content);
      expect(samples[0].size).toBe(4);
    });

    it('detects tab indentation', () => {
      const content = `function foo() {
\tconst x = 1;
\tif (x) {
\t\treturn x;
\t}
}`;
      const samples = detector.detectFromContent(content);
      expect(samples.every(s => s.type === 'tabs')).toBe(true);
    });

    it('detects mixed indentation', () => {
      const content = `function foo() {
  const x = 1;
\tconst y = 2;
}`;
      const result = detector.aggregateSamples(detector.detectFromContent(content));
      expect(result.type).toBe('mixed');
    });
  });
});

describe('FormattingDetector', () => {
  describe('detectSemicolons', () => {
    it('detects semicolon-required style', () => {
      const content = `const x = 1;
const y = 2;
function foo() { return x; }`;
      expect(detector.detectSemicolons(content, 'ts')).toBe('required');
    });

    it('detects no-semicolon style', () => {
      const content = `const x = 1
const y = 2
function foo() { return x }`;
      expect(detector.detectSemicolons(content, 'ts')).toBe('optional');
    });
  });

  describe('detectQuoteStyle', () => {
    it('detects single quotes', () => {
      const content = `const x = 'hello';
const y = 'world';`;
      expect(detector.detectQuoteStyle(content)).toBe('single');
    });

    it('detects double quotes', () => {
      const content = `const x = "hello";
const y = "world";`;
      expect(detector.detectQuoteStyle(content)).toBe('double');
    });
  });
});
```

#### 7.2 Integration Tests (See ADR-convention-analyzer-integration-tests.md)

Test fixtures with known convention patterns for end-to-end validation.

## Consequences

### Positive
- **Accurate Detection**: Statistical approach handles real-world code variability
- **Performance**: Parallel processing and sampling keep analysis fast
- **Schema Compliance**: All outputs validated against Zod schemas
- **Extensible**: Easy to add new formatting detection rules

### Negative
- **Regex Limitations**: Quote/string detection without AST may have edge cases
- **Mixed Patterns**: Some codebases genuinely have inconsistent conventions
- **File Type Limitations**: Currently focused on JS/TS files

## Implementation Priority

1. **IndentationDetector** - Core functionality (P0)
2. **FormattingDetector.semicolons** - Common convention (P0)
3. **FormattingDetector.quotes** - Common convention (P0)
4. **FormattingDetector.trailingCommas** - ES5 vs modern detection (P1)
5. **FormattingDetector.lineLength** - Nice to have (P2)

## Files to Create

```
packages/orchestrator/src/codebase-analyzer/
├── index.ts
├── types.ts
└── analyzers/
    ├── convention-analyzer.ts
    ├── indentation-detector.ts
    └── formatting-detector.ts
```

## Dependencies

- **@apexcli/core**: ConventionAnalysis type
- **Node.js fs/promises**: File reading
- No external dependencies required for basic detection

## Related Documents

- `packages/core/src/types.ts` - ConventionAnalysisSchema definition
- `docs/adr/ADR-convention-analyzer-integration-tests.md` - Integration test architecture
- `REVIEW_FINDINGS.md` - Current implementation status
