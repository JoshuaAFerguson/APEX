# ADR-0060: ConventionAnalyzer Naming Convention Detection Architecture

**Status**: Proposed
**Date**: 2026-02-22
**Author**: Architect Agent
**Feature**: v0.6.0 Brownfield Codebase Analysis - Naming Convention Detection
**Component**: `packages/orchestrator/src/codebase-analyzer/analyzers/convention-analyzer.ts`

## Context

APEX v0.6.0 introduces brownfield codebase analysis capabilities. The `ConventionAnalyzer` needs robust **naming convention detection** for files, functions, variables, classes, and constants. This ADR defines the architecture for accurately detecting:

- **camelCase**: `myVariable`, `getUserData`
- **PascalCase**: `MyClass`, `UserService`
- **snake_case**: `my_variable`, `get_user_data`
- **SCREAMING_SNAKE_CASE**: `MAX_VALUE`, `API_KEY`
- **kebab-case** (files only): `my-component`, `user-service`

### Current State

1. **ConventionAnalyzer exists** at `packages/orchestrator/src/codebase-analyzer/analyzers/convention-analyzer.ts`
2. **Basic implementation present** with regex patterns for naming detection
3. **No unit tests** for naming convention detection
4. **Type definitions complete** in `packages/core/src/types.ts`

### Target Schema (from packages/core/src/types.ts)

```typescript
export const ConventionAnalysisSchema = z.object({
  fileNaming: z.enum(['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent']),
  functionNaming: z.enum(['camelCase', 'PascalCase', 'snake_case', 'mixed', 'inconsistent']),
  variableNaming: z.enum(['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent']),
  classNaming: z.enum(['PascalCase', 'camelCase', 'snake_case', 'mixed', 'inconsistent']).optional(),
  constantNaming: z.enum(['SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase', 'mixed', 'inconsistent']).optional(),
  // ... other fields
});
```

## Decision

### 1. Naming Pattern Detection Strategy

Use **precise regex patterns** with **statistical aggregation** to determine dominant naming conventions:

```typescript
/**
 * Naming convention patterns with enhanced precision
 * Each pattern uses word boundary and character class rules
 */
const NAMING_PATTERNS = {
  // camelCase: starts with lowercase, can have uppercase letters after
  // Examples: myVar, getUserById, htmlParser
  camelCase: /^[a-z][a-zA-Z0-9]*$/,

  // PascalCase: starts with uppercase, followed by mixed case
  // Examples: MyClass, UserService, HTMLParser
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,

  // snake_case: all lowercase with underscores
  // Examples: my_var, get_user_by_id, html_parser
  snakeCase: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,

  // SCREAMING_SNAKE_CASE: all uppercase with underscores
  // Examples: MAX_VALUE, API_KEY, DEFAULT_TIMEOUT
  screamingSnakeCase: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,

  // kebab-case: all lowercase with hyphens (for files)
  // Examples: my-component, user-service, api-client
  kebabCase: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
};
```

### 2. Detection Algorithm

#### 2.1 File Naming Detection

```typescript
/**
 * Analyze file naming conventions across the codebase
 *
 * Algorithm:
 * 1. Extract base filename (without extension and path)
 * 2. Classify each filename against naming patterns
 * 3. Handle special cases (index files, config files)
 * 4. Calculate dominant pattern with confidence threshold
 */
function analyzeFileNaming(files: string[]): ConventionAnalysis['fileNaming'] {
  const counts = {
    camelCase: 0,
    PascalCase: 0,
    'kebab-case': 0,
    snake_case: 0,
    other: 0
  };

  files.forEach(filePath => {
    const name = basename(filePath, extname(filePath));

    // Skip special files
    if (isSpecialFile(name)) return;

    // Classify the filename
    if (NAMING_PATTERNS.camelCase.test(name)) counts.camelCase++;
    else if (NAMING_PATTERNS.PascalCase.test(name)) counts.PascalCase++;
    else if (NAMING_PATTERNS.kebabCase.test(name)) counts['kebab-case']++;
    else if (NAMING_PATTERNS.snakeCase.test(name)) counts.snake_case++;
    else counts.other++;
  });

  return determineDominantPattern(counts);
}
```

#### 2.2 Function Naming Detection

```typescript
/**
 * Analyze function naming conventions in source files
 *
 * Detection patterns:
 * - function declarations: function name() {}
 * - arrow functions: const name = () => {}
 * - method definitions: name() {} in classes
 * - async functions: async function name() {}
 */
const FUNCTION_PATTERNS = [
  // Standard function declaration
  /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,

  // Arrow function assigned to const/let/var
  /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g,

  // Method shorthand in objects/classes
  /^\s*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm
];

function analyzeFunctionNaming(files: FileContent[]): ConventionAnalysis['functionNaming'] {
  const functionNames: string[] = [];

  files.forEach(file => {
    FUNCTION_PATTERNS.forEach(pattern => {
      const matches = [...file.content.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1] && !isBuiltInName(match[1])) {
          functionNames.push(match[1]);
        }
      });
    });
  });

  return classifyIdentifiers(functionNames, ['camelCase', 'PascalCase', 'snake_case']);
}
```

#### 2.3 Variable Naming Detection

```typescript
/**
 * Analyze variable naming conventions
 *
 * Detection targets:
 * - const/let/var declarations
 * - Destructuring assignments
 * - Function parameters
 */
const VARIABLE_PATTERNS = [
  // Simple variable declarations
  /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=|:|,|;)/g,

  // Destructuring (object)
  /(?:const|let|var)\s*\{([^}]+)\}/g,

  // Destructuring (array)
  /(?:const|let|var)\s*\[([^\]]+)\]/g
];

function analyzeVariableNaming(files: FileContent[]): ConventionAnalysis['variableNaming'] {
  const variableNames: string[] = [];

  files.forEach(file => {
    // Extract from simple declarations
    const simpleMatches = [...file.content.matchAll(VARIABLE_PATTERNS[0])];
    simpleMatches.forEach(match => {
      if (match[1]) variableNames.push(match[1]);
    });

    // Extract from destructuring
    const destructuredNames = extractDestructuredNames(file.content);
    variableNames.push(...destructuredNames);
  });

  return classifyIdentifiers(variableNames, [
    'camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE'
  ]);
}
```

#### 2.4 Class Naming Detection

```typescript
/**
 * Analyze class naming conventions
 *
 * Detection targets:
 * - ES6 class declarations
 * - Abstract classes
 * - Exported classes
 */
const CLASS_PATTERN = /(?:abstract\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

function analyzeClassNaming(files: FileContent[]): ConventionAnalysis['classNaming'] | undefined {
  const classNames: string[] = [];

  files.forEach(file => {
    const matches = [...file.content.matchAll(CLASS_PATTERN)];
    matches.forEach(match => {
      if (match[1]) classNames.push(match[1]);
    });
  });

  if (classNames.length === 0) return undefined;

  return classifyIdentifiers(classNames, ['PascalCase', 'camelCase', 'snake_case']);
}
```

#### 2.5 Constant Naming Detection

```typescript
/**
 * Analyze constant naming conventions
 *
 * Heuristics for identifying constants:
 * 1. Declared with `const` AND starts with uppercase
 * 2. All uppercase with underscores (SCREAMING_SNAKE_CASE)
 * 3. Top-level const exports with primitive values
 */
const CONSTANT_PATTERNS = [
  // Uppercase const declarations
  /const\s+([A-Z][A-Z0-9_]*)\s*=/g,

  // Exported constants at module level
  /export\s+const\s+([A-Z][A-Z0-9_]*)\s*=/g
];

function analyzeConstantNaming(files: FileContent[]): ConventionAnalysis['constantNaming'] | undefined {
  const constantNames: string[] = [];

  files.forEach(file => {
    CONSTANT_PATTERNS.forEach(pattern => {
      const matches = [...file.content.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1] && isLikelyConstant(match[1])) {
          constantNames.push(match[1]);
        }
      });
    });
  });

  if (constantNames.length === 0) return undefined;

  return classifyIdentifiers(constantNames, [
    'SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase'
  ]);
}

/**
 * Determine if an identifier is likely a constant based on naming
 */
function isLikelyConstant(name: string): boolean {
  // SCREAMING_SNAKE_CASE is definitely a constant
  if (NAMING_PATTERNS.screamingSnakeCase.test(name)) return true;

  // Single uppercase letter followed by numbers (e.g., X1, Y2)
  if (/^[A-Z][0-9]+$/.test(name)) return true;

  return false;
}
```

### 3. Statistical Aggregation

```typescript
interface NamingCounts {
  [key: string]: number;
}

interface ClassificationResult {
  dominant: string;
  confidence: number;
  distribution: NamingCounts;
}

/**
 * Classify a collection of identifiers and determine dominant pattern
 *
 * Rules:
 * - If one pattern > 60% of samples: return that pattern
 * - If second highest > 30%: return 'inconsistent'
 * - If no clear dominant (< 60%): return 'mixed'
 * - Special case: if 'other' dominates, return 'mixed'
 */
function classifyIdentifiers(
  names: string[],
  validPatterns: string[]
): string {
  const counts: NamingCounts = {};
  validPatterns.forEach(p => counts[p] = 0);
  counts['other'] = 0;

  names.forEach(name => {
    let matched = false;
    for (const pattern of validPatterns) {
      if (matchesPattern(name, pattern)) {
        counts[pattern]++;
        matched = true;
        break;
      }
    }
    if (!matched) counts['other']++;
  });

  return determineDominantPattern(counts, validPatterns);
}

function determineDominantPattern(
  counts: NamingCounts,
  validPatterns?: string[]
): string {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total === 0) return 'mixed';

  const sorted = Object.entries(counts)
    .filter(([key]) => key !== 'other')
    .sort(([, a], [, b]) => b - a);

  const [dominant, dominantCount] = sorted[0] || ['mixed', 0];
  const [, secondCount] = sorted[1] || ['', 0];

  // Check thresholds
  const dominantRatio = dominantCount / total;
  const secondRatio = secondCount / total;

  if (dominantRatio < 0.6) return 'mixed';
  if (secondRatio > 0.3) return 'inconsistent';

  return dominant;
}
```

### 4. Edge Cases and Special Handling

| Edge Case | Handling |
|-----------|----------|
| Empty identifier list | Return `undefined` for optional fields, `'mixed'` for required |
| Single-character identifiers | Include in analysis but may not match patterns |
| Numbers only (after first char) | Valid in all patterns (e.g., `var1`, `VAR_1`) |
| Underscore prefix (private) | Strip prefix before classification (e.g., `_privateVar` → `privateVar`) |
| Dollar sign prefix (framework) | Strip prefix before classification (e.g., `$scope` → `scope`) |
| Reserved words | Skip (e.g., `const`, `class`, `if`) |
| Built-in names | Skip (e.g., `Object`, `Array`, `String`) |
| Mixed patterns in name | Classify as `'other'` (e.g., `get_UserById`) |

### 5. Helper Functions

```typescript
/**
 * Check if a name matches a specific pattern
 */
function matchesPattern(name: string, patternName: string): boolean {
  const normalized = normalizeIdentifier(name);
  const pattern = NAMING_PATTERNS[patternName as keyof typeof NAMING_PATTERNS];
  return pattern ? pattern.test(normalized) : false;
}

/**
 * Normalize identifier by removing common prefixes
 */
function normalizeIdentifier(name: string): string {
  // Remove common prefixes
  return name
    .replace(/^[_$]+/, '')  // Strip leading _ or $
    .replace(/[_$]+$/, ''); // Strip trailing _ or $
}

/**
 * Check if name is a special file that should be skipped
 */
function isSpecialFile(name: string): boolean {
  const specialFiles = new Set([
    'index', 'main', 'app', 'mod', 'lib',
    'package', 'tsconfig', 'webpack', 'vite',
    'jest', 'vitest', 'eslint', 'prettier',
    'readme', 'changelog', 'license'
  ]);
  return specialFiles.has(name.toLowerCase());
}

/**
 * Check if name is a JavaScript built-in
 */
function isBuiltInName(name: string): boolean {
  const builtIns = new Set([
    'Object', 'Array', 'String', 'Number', 'Boolean',
    'Function', 'Symbol', 'Error', 'Promise', 'Map', 'Set',
    'constructor', 'toString', 'valueOf', 'prototype'
  ]);
  return builtIns.has(name);
}
```

### 6. Integration Points

```typescript
// In ConventionAnalyzer.analyze()
async analyze(projectPath: string): Promise<ConventionAnalysis> {
  const files = await this.findAnalyzableFiles(projectPath);
  const fileContents = await this.readFiles(files);

  return {
    // Naming conventions
    fileNaming: this.analyzeFileNaming(files),
    functionNaming: this.analyzeFunctionNaming(fileContents),
    variableNaming: this.analyzeVariableNaming(fileContents),
    classNaming: this.analyzeClassNaming(fileContents),
    constantNaming: this.analyzeConstantNaming(fileContents),

    // Other conventions (existing)
    indentation: this.analyzeIndentation(fileContents),
    imports: this.analyzeImportStyle(fileContents),
    documentation: this.analyzeDocumentation(fileContents),
    formatting: this.analyzeFormatting(fileContents)
  };
}
```

### 7. Performance Considerations

| Optimization | Description |
|--------------|-------------|
| **Lazy Loading** | Only analyze files when needed |
| **Parallel Processing** | Use `Promise.all` for file reading |
| **Early Return** | Stop analyzing when confidence > 90% |
| **Sampling** | For large codebases (>1000 files), sample representative files |
| **Caching** | Cache regex matches for repeated patterns |

### 8. Testing Strategy

#### 8.1 Unit Tests

```typescript
describe('ConventionAnalyzer - Naming Detection', () => {
  describe('analyzeFileNaming', () => {
    it('detects camelCase file naming', () => {
      const files = ['myComponent.ts', 'userService.ts', 'apiClient.ts'];
      expect(analyzer.analyzeFileNaming(files)).toBe('camelCase');
    });

    it('detects PascalCase file naming', () => {
      const files = ['MyComponent.tsx', 'UserService.ts', 'ApiClient.ts'];
      expect(analyzer.analyzeFileNaming(files)).toBe('PascalCase');
    });

    it('detects kebab-case file naming', () => {
      const files = ['my-component.ts', 'user-service.ts', 'api-client.ts'];
      expect(analyzer.analyzeFileNaming(files)).toBe('kebab-case');
    });

    it('detects snake_case file naming', () => {
      const files = ['my_component.ts', 'user_service.ts', 'api_client.ts'];
      expect(analyzer.analyzeFileNaming(files)).toBe('snake_case');
    });

    it('returns mixed for inconsistent naming', () => {
      const files = ['myComponent.ts', 'user-service.ts', 'ApiClient.ts'];
      const result = analyzer.analyzeFileNaming(files);
      expect(['mixed', 'inconsistent']).toContain(result);
    });
  });

  describe('analyzeFunctionNaming', () => {
    it('detects camelCase function naming', () => {
      const content = `
        function getUserById(id) {}
        const fetchData = () => {};
        async function processRequest() {}
      `;
      expect(analyzer.analyzeFunctionNaming([{ content, path: 'test.ts' }])).toBe('camelCase');
    });

    it('detects snake_case function naming', () => {
      const content = `
        function get_user_by_id(id) {}
        const fetch_data = () => {};
      `;
      expect(analyzer.analyzeFunctionNaming([{ content, path: 'test.py' }])).toBe('snake_case');
    });
  });

  describe('analyzeVariableNaming', () => {
    it('detects camelCase variable naming', () => {
      const content = `
        const userName = 'test';
        let userAge = 25;
        var isActive = true;
      `;
      expect(analyzer.analyzeVariableNaming([{ content, path: 'test.ts' }])).toBe('camelCase');
    });

    it('detects SCREAMING_SNAKE_CASE for constants in variables', () => {
      const content = `
        const MAX_RETRY = 3;
        const API_KEY = 'secret';
        const DEFAULT_TIMEOUT = 5000;
      `;
      expect(analyzer.analyzeVariableNaming([{ content, path: 'test.ts' }])).toBe('SCREAMING_SNAKE_CASE');
    });
  });

  describe('analyzeClassNaming', () => {
    it('detects PascalCase class naming', () => {
      const content = `
        class UserService {}
        class ApiClient extends BaseClient {}
        abstract class Repository {}
      `;
      expect(analyzer.analyzeClassNaming([{ content, path: 'test.ts' }])).toBe('PascalCase');
    });

    it('returns undefined when no classes found', () => {
      const content = `const x = 1;`;
      expect(analyzer.analyzeClassNaming([{ content, path: 'test.ts' }])).toBeUndefined();
    });
  });

  describe('analyzeConstantNaming', () => {
    it('detects SCREAMING_SNAKE_CASE constant naming', () => {
      const content = `
        const MAX_VALUE = 100;
        const API_ENDPOINT = '/api';
        export const DEFAULT_CONFIG = {};
      `;
      expect(analyzer.analyzeConstantNaming([{ content, path: 'test.ts' }])).toBe('SCREAMING_SNAKE_CASE');
    });

    it('returns undefined when no constants found', () => {
      const content = `const userName = 'test';`;
      expect(analyzer.analyzeConstantNaming([{ content, path: 'test.ts' }])).toBeUndefined();
    });
  });
});
```

#### 8.2 Integration Tests

```typescript
describe('ConventionAnalyzer - Full Analysis', () => {
  it('analyzes a TypeScript codebase with consistent conventions', async () => {
    const result = await analyzer.analyze('/path/to/typescript-project');

    expect(result.fileNaming).toBe('camelCase');
    expect(result.functionNaming).toBe('camelCase');
    expect(result.variableNaming).toBe('camelCase');
    expect(result.classNaming).toBe('PascalCase');
    expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
  });

  it('analyzes a Python codebase with snake_case conventions', async () => {
    const result = await analyzer.analyze('/path/to/python-project');

    expect(result.fileNaming).toBe('snake_case');
    expect(result.functionNaming).toBe('snake_case');
    expect(result.variableNaming).toBe('snake_case');
    expect(result.classNaming).toBe('PascalCase');
    expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');
  });
});
```

## Consequences

### Positive
- **Accurate Detection**: Statistical approach with confidence thresholds handles real-world variability
- **Schema Compliance**: All outputs validated against Zod schemas
- **Language Agnostic**: Patterns work across JavaScript, TypeScript, Python, etc.
- **Extensible**: Easy to add support for new naming conventions

### Negative
- **Regex Limitations**: Cannot handle all edge cases (e.g., code in strings/comments)
- **No AST Parsing**: Relies on regex, which may produce false positives
- **Language-Specific Patterns**: Some conventions are language-specific (e.g., `$` in PHP)

## Implementation Checklist

1. **Enhance existing patterns** in `convention-analyzer.ts`:
   - [x] File naming detection (exists)
   - [x] Function naming detection (exists)
   - [x] Variable naming detection (exists)
   - [x] Class naming detection (exists)
   - [x] Constant naming detection (exists)

2. **Add comprehensive tests**:
   - [ ] Unit tests for each naming detection method
   - [ ] Integration tests with real codebase samples
   - [ ] Edge case tests (empty, special characters, mixed)

3. **Validate schema compliance**:
   - [ ] All return values match `ConventionAnalysisSchema`
   - [ ] Optional fields return `undefined` when appropriate

## Files to Modify

```
packages/orchestrator/src/codebase-analyzer/analyzers/
├── convention-analyzer.ts  # Enhance naming detection logic
└── convention-analyzer.test.ts  # Add comprehensive tests (NEW)
```

## Dependencies

- **@apexcli/core**: `ConventionAnalysis` type, `ConventionAnalysisSchema`
- **Node.js path**: `basename`, `extname` for file path handling
- No additional dependencies required

## Related Documents

- `packages/core/src/types.ts` - ConventionAnalysisSchema definition
- `docs/adr/0060-convention-analyzer-indentation-formatting-detection.md` - Indentation/formatting architecture
- `docs/adr/ADR-convention-analyzer-integration-tests.md` - Integration test architecture
