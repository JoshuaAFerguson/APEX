# ADR-060: ESLint Error Parsing for ErrorFormatter

## Status
Proposed

## Context

The APEX CLI package has an `ErrorFormatter` class (`packages/cli/src/utils/ErrorFormatter.ts`) that currently supports parsing TypeScript compiler errors via `parseTypeScriptErrors()`. The task is to extend this class to also parse ESLint output in both default and stylish formatter formats.

### Current State Analysis

1. **Existing ErrorFormatter** (`packages/cli/src/utils/ErrorFormatter.ts`):
   - Has established patterns for error parsing (TypeScript)
   - Returns `FormattedError[]` with `ErrorType`, message, `ErrorContext`, and suggestions
   - Uses regex patterns for parsing different output formats
   - Already handles duplicate detection for mixed format output

2. **Existing ESLint Plugin** (`packages/orchestrator/src/linter/plugins/eslint.ts`):
   - Uses JSON output format (`--format json`) for programmatic parsing
   - Converts ESLint issues to `LintIssue` format (different from `FormattedError`)
   - Handles severity mapping (1=warning, 2=error)

3. **Key Difference in Purpose**:
   - **Orchestrator ESLint Plugin**: Uses JSON format for structured lint result processing
   - **CLI ErrorFormatter**: Parses human-readable text output for display formatting

## Decision

Implement ESLint text output parsing in the CLI `ErrorFormatter` class to handle both **default** and **stylish** formatter output formats.

### ESLint Output Formats

#### 1. Default Formatter
```
/path/to/file.js
  10:5   error  'x' is defined but never used  no-unused-vars
  15:3   warning  Unexpected console statement  no-console

/path/to/another-file.ts
  5:1    error  'import' must be declared first  import/first

2 problems (2 errors, 1 warning)
```

**Characteristics:**
- File path on its own line (no indentation)
- Issues indented with 2 spaces
- Format: `line:col  severity  message  rule-id`
- Summary line at the end

#### 2. Stylish Formatter
```
/path/to/file.js
  10:5   error    'x' is defined but never used   no-unused-vars
  15:3   warning  Unexpected console statement    no-console

/path/to/another-file.ts
   5:1   error    'import' must be declared first  import/first

✖ 3 problems (2 errors, 1 warning)
```

**Characteristics:**
- File path on its own line (optionally underlined in terminals)
- Issues indented with 2 spaces
- Columns aligned/padded for readability
- Format: `line:col  severity  message  rule-id`
- Summary with checkmark/cross symbols

### Parsing Strategy

Both formats share the same core structure, differing only in alignment padding. We can use a unified regex pattern:

```typescript
// File path line (starts at column 0, no leading whitespace)
const filePathPattern = /^(\S.+)$/;

// Issue line (indented, with line:col, severity, message, rule)
const issuePattern = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}([\w\/@-]+)$/;
```

### Technical Design

#### New Interface: `ESLintError`

```typescript
/**
 * Parsed ESLint error information
 */
export interface ESLintError {
  /** File path where the error occurred */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Severity: 'error' or 'warning' */
  severity: 'error' | 'warning';
  /** ESLint rule ID (e.g., 'no-unused-vars', '@typescript-eslint/no-explicit-any') */
  ruleId: string;
  /** Human-readable error message */
  message: string;
}
```

#### New Method: `parseESLintErrors`

```typescript
/**
 * Parse ESLint output (default or stylish formatter) into FormattedError array
 *
 * Supports both ESLint formatters:
 * - Default: Simple text output with line:col severity message rule-id
 * - Stylish: Aligned/padded columns for better readability
 *
 * @param eslintOutput - Raw ESLint output string
 * @returns Array of FormattedError objects
 */
parseESLintErrors(eslintOutput: string): FormattedError[]
```

#### Implementation Approach

1. **State Machine Parsing**:
   - Track current file path as we parse line by line
   - When we see a non-indented line (file path), update context
   - When we see an indented line matching issue pattern, parse and emit error

2. **Severity Mapping**:
   - `error` -> `ErrorType.CONFIG` (consistent with TypeScript error handling)
   - `warning` -> `ErrorType.VALIDATION` (validation/style issues)

3. **Suggestion Generation**:
   - Generate contextual suggestions based on common ESLint rules
   - Link to ESLint documentation for the rule

4. **Error Deduplication**:
   - Same approach as TypeScript: check file/line/column/rule combination

### File Structure

```
packages/cli/src/utils/
├── ErrorFormatter.ts          # Add parseESLintErrors method
└── __tests__/
    ├── ErrorFormatter.eslint.test.ts  # New test file for ESLint parsing
    └── ErrorFormatter.test.ts         # Existing tests (unchanged)
```

### Test Coverage Requirements

The acceptance criteria requires tests for:
1. **Warnings**: Parse warning-level issues correctly
2. **Errors**: Parse error-level issues correctly
3. **Multiple files**: Handle output with issues from multiple files
4. **Edge cases**:
   - Empty output
   - No issues found
   - Mixed severity (errors and warnings together)
   - Rule IDs with special characters (scoped packages like `@typescript-eslint/*`)
   - File paths with spaces
   - Absolute vs relative paths
   - Windows-style paths

### Integration Points

1. **Export from index.ts**: Add `parseESLintErrors` to exports
2. **Convenience function**: Add `parseESLintErrors` standalone function like `parseTypeScriptErrors`
3. **FormattedError compatibility**: Ensure output matches existing `FormattedError` interface

## Consequences

### Positive
- Unified error formatting for both TypeScript and ESLint in CLI
- Consistent user experience across different tool outputs
- Follows established patterns in the codebase
- Enables future integration with other text-based linter outputs

### Negative
- Text parsing is inherently fragile compared to JSON parsing
- Different ESLint versions may have subtle format differences
- Custom ESLint formatters won't be supported

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| ESLint format changes | Version-specific tests; fallback gracefully |
| Edge cases in file paths | Comprehensive regex; test with various path formats |
| Performance with large outputs | Stream parsing if needed; benchmark tests |

## Implementation Plan

### Phase 1: Core Implementation (Developer Stage)
1. Add `ESLintError` interface
2. Implement `parseESLintErrors` method
3. Add ESLint-specific suggestion generation
4. Export from index.ts

### Phase 2: Testing (Tester Stage)
1. Unit tests for default formatter parsing
2. Unit tests for stylish formatter parsing
3. Edge case tests (empty, no errors, special characters)
4. Multiple file tests
5. Mixed severity tests

### Phase 3: Integration (Reviewer Stage)
1. Code review
2. Verify TypeScript compilation
3. Run full test suite
4. Documentation update

## References

- Existing: `packages/cli/src/utils/ErrorFormatter.ts`
- Existing: `packages/orchestrator/src/linter/plugins/eslint.ts`
- Existing tests: `packages/cli/src/utils/__tests__/ErrorFormatter.typescript.test.ts`
- ESLint Formatters: https://eslint.org/docs/user-guide/formatters/
