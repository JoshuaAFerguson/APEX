# ADR-060: ESLint Error Parsing - Technical Specification

## Overview

This document provides detailed technical specifications for implementing ESLint error parsing in the `ErrorFormatter` class.

## Implementation Details

### 1. Type Definitions to Add

Add the following to `packages/cli/src/utils/ErrorFormatter.ts`:

```typescript
/**
 * Severity levels for ESLint errors
 */
export type ESLintSeverity = 'error' | 'warning';

/**
 * Parsed ESLint error from text output
 */
export interface ESLintParsedError {
  /** File path where the error occurred */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Severity: 'error' or 'warning' */
  severity: ESLintSeverity;
  /** ESLint rule ID (e.g., 'no-unused-vars', '@typescript-eslint/no-explicit-any') */
  ruleId: string;
  /** Human-readable error message */
  message: string;
}
```

### 2. Regex Patterns

```typescript
// File path line: starts at column 0, ends with newline, contains a path-like string
// Examples:
//   /path/to/file.js
//   src/components/App.tsx
//   C:\Users\dev\file.ts
const FILE_PATH_PATTERN = /^(\S.+?)$/;

// Issue line pattern for default/stylish formatters
// Format: <indent><line>:<col><spaces><severity><spaces><message><spaces><rule-id>
// Examples (from default formatter):
//   10:5   error  'x' is defined but never used  no-unused-vars
//   15:3   warning  Unexpected console statement  no-console
// Examples (from stylish formatter - same pattern, just more padding):
//   10:5   error    'x' is defined but never used   no-unused-vars
const ISSUE_PATTERN = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}([\w\/@-]+)\s*$/;

// Summary line pattern (to skip)
// Examples:
//   2 problems (2 errors, 0 warnings)
//   X 3 problems (2 errors, 1 warning)
const SUMMARY_PATTERN = /^\s*[X\u2716]?\s*\d+\s+problems?\s*\(/i;
```

### 3. Method Implementation

```typescript
/**
 * Parse ESLint output (default or stylish formatter) into FormattedError array
 *
 * Supports both ESLint formatters:
 * - Default: Simple text output with line:col severity message rule-id
 * - Stylish: Aligned/padded columns for better readability
 *
 * Example default format:
 * ```
 * /path/to/file.js
 *   10:5   error  'x' is defined but never used  no-unused-vars
 *   15:3   warning  Unexpected console statement  no-console
 *
 * 2 problems (2 errors, 0 warnings)
 * ```
 *
 * @param eslintOutput - Raw ESLint output string
 * @returns Array of FormattedError objects
 */
parseESLintErrors(eslintOutput: string): FormattedError[] {
  const errors: FormattedError[] = [];

  if (!eslintOutput.trim()) {
    return errors;
  }

  const lines = eslintOutput.split('\n');
  let currentFilePath = '';

  // File path pattern: non-indented line that looks like a path
  const filePathPattern = /^(\S.+?)$/;

  // Issue pattern: indented line with line:col severity message rule-id
  const issuePattern = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}([\w\/@-]+)\s*$/;

  // Summary pattern: to skip summary lines
  const summaryPattern = /^\s*[X\u2716]?\s*\d+\s+problems?\s*\(/i;

  for (const line of lines) {
    // Skip empty lines and summary lines
    if (!line.trim() || summaryPattern.test(line)) {
      continue;
    }

    // Check if this is a file path line (non-indented, starts with non-whitespace)
    const fileMatch = line.match(filePathPattern);
    if (fileMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      // This could be a file path - verify it looks like a path
      const potentialPath = fileMatch[1].trim();
      // Basic path validation: contains path separator or looks like a relative path
      if (
        potentialPath.includes('/') ||
        potentialPath.includes('\\') ||
        potentialPath.match(/^[a-zA-Z]:\\/) || // Windows absolute
        potentialPath.match(/^\.?\.?\//) || // Unix relative
        potentialPath.match(/^[a-zA-Z0-9_-]+\.(js|jsx|ts|tsx|mjs|cjs|vue)$/) // Simple filename
      ) {
        currentFilePath = potentialPath;
        continue;
      }
    }

    // Check if this is an issue line
    const issueMatch = line.match(issuePattern);
    if (issueMatch && currentFilePath) {
      const [, lineNum, colNum, severity, message, ruleId] = issueMatch;

      // Check for duplicates (same file, line, column, rule)
      const isDuplicate = errors.some(error =>
        error.context?.file === currentFilePath &&
        error.context?.line === parseInt(lineNum, 10) &&
        error.context?.column === parseInt(colNum, 10) &&
        error.message.includes(ruleId)
      );

      if (!isDuplicate) {
        errors.push({
          type: severity === 'error' ? ErrorType.CONFIG : ErrorType.VALIDATION,
          message: `${ruleId}: ${message.trim()}`,
          context: {
            file: currentFilePath,
            line: parseInt(lineNum, 10),
            column: parseInt(colNum, 10),
            description: `ESLint ${severity}`
          },
          suggestions: this.generateESLintSuggestions(ruleId, message.trim())
        });
      }
    }
  }

  return errors;
}
```

### 4. Suggestion Generation

```typescript
/**
 * Generate helpful suggestions for common ESLint rules
 */
private generateESLintSuggestions(ruleId: string, message: string): ErrorSuggestion[] {
  const suggestions: ErrorSuggestion[] = [];

  switch (ruleId) {
    case 'no-unused-vars':
    case '@typescript-eslint/no-unused-vars':
      // Extract variable name from message if possible
      const varMatch = message.match(/'([^']+)'/);
      if (varMatch) {
        const varName = varMatch[1];
        suggestions.push({
          title: 'Remove unused variable',
          description: `Remove the unused variable "${varName}" if it's no longer needed`,
        });
        suggestions.push({
          title: 'Prefix with underscore',
          description: `Rename to "_${varName}" to indicate intentionally unused`,
          command: `const _${varName} = ...`
        });
      } else {
        suggestions.push({
          title: 'Remove or use the variable',
          description: 'Either remove the variable or use it in your code',
        });
      }
      break;

    case 'no-console':
      suggestions.push({
        title: 'Remove console statement',
        description: 'Remove the console statement for production code',
      });
      suggestions.push({
        title: 'Use a logger',
        description: 'Replace with a proper logging library',
        command: 'logger.debug(...) // or logger.info(...)'
      });
      break;

    case 'prefer-const':
      suggestions.push({
        title: 'Use const instead of let',
        description: 'Variable is never reassigned, use const for immutability',
        command: 'const variableName = value;'
      });
      break;

    case 'eqeqeq':
      suggestions.push({
        title: 'Use strict equality',
        description: 'Replace == with === for strict type checking',
        command: 'value === expected'
      });
      break;

    case 'no-undef':
      const nameMatch = message.match(/'([^']+)'/);
      if (nameMatch) {
        suggestions.push({
          title: 'Define or import the variable',
          description: `Ensure "${nameMatch[1]}" is defined or imported`,
          command: `import { ${nameMatch[1]} } from 'module';`
        });
      }
      break;

    case '@typescript-eslint/no-explicit-any':
      suggestions.push({
        title: 'Replace any with specific type',
        description: 'Use a more specific type instead of any',
        command: 'unknown // or a specific type'
      });
      break;

    case 'import/first':
    case 'import/order':
      suggestions.push({
        title: 'Move imports to top',
        description: 'All imports should be at the top of the file',
      });
      suggestions.push({
        title: 'Auto-fix with ESLint',
        description: 'Run ESLint with --fix to auto-organize imports',
        command: 'npx eslint --fix <file>'
      });
      break;

    default:
      // Generic suggestion for unknown rules
      suggestions.push({
        title: 'Check ESLint documentation',
        description: `Look up rule "${ruleId}" in ESLint documentation`,
        command: `https://eslint.org/docs/rules/${ruleId.replace('@typescript-eslint/', '')}`
      });
  }

  return suggestions;
}
```

### 5. Export Updates

Add to the exports in `packages/cli/src/utils/ErrorFormatter.ts`:

```typescript
/**
 * Convenience function to parse ESLint output errors
 */
export const parseESLintErrors = (eslintOutput: string): FormattedError[] => {
  return defaultErrorFormatter.parseESLintErrors(eslintOutput);
};
```

Update `packages/cli/src/utils/index.ts`:

```typescript
export * from './ErrorFormatter.js';
// No change needed - re-exports all from ErrorFormatter
```

### 6. Test File Structure

Create `packages/cli/src/utils/__tests__/ErrorFormatter.eslint.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  parseESLintErrors,
} from '../ErrorFormatter.js';

describe('ErrorFormatter ESLint Parsing', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('parseESLintErrors - Default Formatter', () => {
    it('should parse single warning', () => {
      const eslintOutput = `/path/to/file.js
  10:5  warning  Unexpected console statement  no-console

1 problem (0 errors, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ErrorType.VALIDATION);
      expect(errors[0].context?.file).toBe('/path/to/file.js');
      expect(errors[0].context?.line).toBe(10);
      expect(errors[0].context?.column).toBe(5);
      expect(errors[0].message).toContain('no-console');
      expect(errors[0].message).toContain('Unexpected console statement');
    });

    it('should parse single error', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars

1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ErrorType.CONFIG);
      expect(errors[0].context?.file).toBe('/path/to/file.js');
      expect(errors[0].context?.line).toBe(10);
      expect(errors[0].context?.column).toBe(5);
      expect(errors[0].message).toContain('no-unused-vars');
    });

    it('should parse multiple files', () => {
      const eslintOutput = `/path/to/file1.js
  10:5  error  'x' is defined but never used  no-unused-vars

/path/to/file2.ts
  5:1   error  'import' must be before other statements  import/first
  15:3  warning  Unexpected console statement  no-console

3 problems (2 errors, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(3);

      expect(errors[0].context?.file).toBe('/path/to/file1.js');
      expect(errors[0].context?.line).toBe(10);

      expect(errors[1].context?.file).toBe('/path/to/file2.ts');
      expect(errors[1].context?.line).toBe(5);

      expect(errors[2].context?.file).toBe('/path/to/file2.ts');
      expect(errors[2].context?.line).toBe(15);
    });
  });

  describe('parseESLintErrors - Stylish Formatter', () => {
    it('should parse stylish format with aligned columns', () => {
      const eslintOutput = `/path/to/file.js
  10:5   error    'x' is defined but never used   no-unused-vars
  15:3   warning  Unexpected console statement    no-console

X 2 problems (1 error, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(2);
      expect(errors[0].context?.line).toBe(10);
      expect(errors[0].context?.column).toBe(5);
      expect(errors[1].context?.line).toBe(15);
      expect(errors[1].context?.column).toBe(3);
    });
  });

  describe('parseESLintErrors - Edge Cases', () => {
    it('should handle empty output', () => {
      const errors = formatter.parseESLintErrors('');
      expect(errors).toHaveLength(0);
    });

    it('should handle output with no issues', () => {
      const eslintOutput = `0 problems`;
      const errors = formatter.parseESLintErrors(eslintOutput);
      expect(errors).toHaveLength(0);
    });

    it('should handle scoped rule IDs', () => {
      const eslintOutput = `/path/to/file.ts
  10:5  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('@typescript-eslint/no-explicit-any');
    });

    it('should handle file paths with spaces', () => {
      const eslintOutput = `/path/to/my file.js
  10:5  error  'x' is defined but never used  no-unused-vars

1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('/path/to/my file.js');
    });

    it('should handle Windows paths', () => {
      const eslintOutput = `C:\\Users\\dev\\project\\src\\file.js
  10:5  error  'x' is defined but never used  no-unused-vars

1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('C:\\Users\\dev\\project\\src\\file.js');
    });

    it('should handle relative paths', () => {
      const eslintOutput = `src/components/App.tsx
  10:5  error  'x' is defined but never used  no-unused-vars

1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('src/components/App.tsx');
    });
  });

  describe('parseESLintErrors - Suggestions', () => {
    it('should generate suggestions for no-unused-vars', () => {
      const eslintOutput = `/path/to/file.js
  10:5  warning  'unusedVar' is defined but never used  no-unused-vars

1 problem (0 errors, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].suggestions).toBeDefined();
      expect(errors[0].suggestions!.length).toBeGreaterThan(0);
      expect(errors[0].suggestions!.some(s => s.title.includes('unused'))).toBe(true);
    });

    it('should generate suggestions for no-console', () => {
      const eslintOutput = `/path/to/file.js
  10:5  warning  Unexpected console statement  no-console

1 problem (0 errors, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].suggestions).toBeDefined();
      expect(errors[0].suggestions!.some(s =>
        s.title.includes('Remove') || s.title.includes('logger')
      )).toBe(true);
    });
  });

  describe('parseESLintErrors convenience function', () => {
    it('should be available as standalone function', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars

1 problem (1 error, 0 warnings)`;

      const errors = parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('/path/to/file.js');
    });

    it('should produce same results as instance method', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars

1 problem (1 error, 0 warnings)`;

      const instanceErrors = formatter.parseESLintErrors(eslintOutput);
      const standaloneErrors = parseESLintErrors(eslintOutput);

      expect(instanceErrors).toEqual(standaloneErrors);
    });
  });

  describe('Integration with ErrorFormatter display', () => {
    it('should format parsed ESLint errors with proper styling', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars

1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);
      const formattedOutput = formatter.format(errors[0]);

      expect(formattedOutput).toContain('no-unused-vars');
      expect(formattedOutput).toContain('/path/to/file.js');
      expect(formattedOutput).toContain('10');
      expect(formattedOutput).toContain('5');
    });

    it('should format multiple ESLint errors properly', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars
  15:3  warning  Unexpected console statement  no-console

2 problems (1 error, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);
      const formattedOutput = formatter.formatMultiple(errors);

      expect(formattedOutput).toContain('2 errors found');
      expect(formattedOutput).toContain('no-unused-vars');
      expect(formattedOutput).toContain('no-console');
    });
  });
});
```

## Verification Checklist

Before completing implementation, verify:

- [ ] `npm run build` passes with no errors
- [ ] `npm run test` passes with all tests
- [ ] `npm run typecheck` passes
- [ ] New tests cover:
  - [ ] Single warning parsing
  - [ ] Single error parsing
  - [ ] Multiple files parsing
  - [ ] Default formatter format
  - [ ] Stylish formatter format
  - [ ] Edge cases (empty, no errors, special chars)
  - [ ] Scoped rule IDs (@typescript-eslint/*)
  - [ ] File paths with spaces
  - [ ] Windows and Unix paths
  - [ ] Suggestion generation for common rules
  - [ ] Standalone convenience function

## Notes for Developer Stage

1. **Pattern Order**: Parse file path before issue lines
2. **State Tracking**: Use `currentFilePath` to track context between lines
3. **Duplicate Detection**: Same logic as TypeScript parser
4. **Severity Mapping**:
   - `error` -> `ErrorType.CONFIG`
   - `warning` -> `ErrorType.VALIDATION`
5. **Follow existing patterns**: Mirror `parseTypeScriptErrors` implementation style
