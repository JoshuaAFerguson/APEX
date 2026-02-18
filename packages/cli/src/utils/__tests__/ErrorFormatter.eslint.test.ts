import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  FormattedError,
  parseESLintErrors,
} from '../ErrorFormatter.js';

describe('ErrorFormatter ESLint Error Parsing', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('parseESLintErrors - single error parsing', () => {
    it('should parse single error in default format', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        type: ErrorType.CONFIG,
        message: `'x' is defined but never used (no-unused-vars)`,
        context: {
          file: '/path/to/file.js',
          line: 10,
          column: 5,
          description: 'ESLint error'
        },
        suggestions: expect.any(Array)
      });

      // Verify suggestions for no-unused-vars
      expect(errors[0].suggestions).toHaveLength(2);
      expect(errors[0].suggestions?.[0].title).toBe('Remove unused variable');
      expect(errors[0].suggestions?.[1].title).toBe('Prefix with underscore');
    });

    it('should parse single warning in default format', () => {
      const eslintOutput = `/path/to/file.js
  15:3  warning  Unexpected console statement  no-console

✖ 1 problem (0 errors, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        type: ErrorType.VALIDATION,
        message: `Unexpected console statement (no-console)`,
        context: {
          file: '/path/to/file.js',
          line: 15,
          column: 3,
          description: 'ESLint warning'
        },
        suggestions: expect.any(Array)
      });
    });

    it('should parse error in stylish format with extra whitespace', () => {
      const eslintOutput = `/path/to/file.js
  10:5   error    'x' is defined but never used   no-unused-vars

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.line).toBe(10);
      expect(errors[0].context?.column).toBe(5);
      expect(errors[0].message).toBe(`'x' is defined but never used (no-unused-vars)`);
    });

    it('should parse TypeScript ESLint rule', () => {
      const eslintOutput = `/path/to/file.ts
  5:12  error  Don't use 'any' type  @typescript-eslint/no-explicit-any

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe(`Don't use 'any' type (@typescript-eslint/no-explicit-any)`);
      expect(errors[0].suggestions).toHaveLength(2);
      expect(errors[0].suggestions?.[0].title).toBe('Use specific type');
    });

    it('should parse scoped rule with forward slashes', () => {
      const eslintOutput = `/path/to/file.js
  1:1  error  Import should be at the top  import/first

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe(`Import should be at the top (import/first)`);
    });
  });

  describe('parseESLintErrors - multiple errors parsing', () => {
    it('should parse multiple errors in the same file', () => {
      const eslintOutput = `/path/to/file.js
  10:5   error    'x' is defined but never used   no-unused-vars
  15:3   warning  Unexpected console statement    no-console
  20:1   error    Use === instead of ==           eqeqeq

✖ 3 problems (2 errors, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(3);

      // First error
      expect(errors[0].type).toBe(ErrorType.CONFIG);
      expect(errors[0].message).toBe(`'x' is defined but never used (no-unused-vars)`);
      expect(errors[0].context?.file).toBe('/path/to/file.js');
      expect(errors[0].context?.line).toBe(10);
      expect(errors[0].context?.column).toBe(5);

      // Second warning
      expect(errors[1].type).toBe(ErrorType.VALIDATION);
      expect(errors[1].message).toBe(`Unexpected console statement (no-console)`);
      expect(errors[1].context?.line).toBe(15);
      expect(errors[1].context?.column).toBe(3);

      // Third error
      expect(errors[2].type).toBe(ErrorType.CONFIG);
      expect(errors[2].message).toBe(`Use === instead of == (eqeqeq)`);
      expect(errors[2].context?.line).toBe(20);
      expect(errors[2].context?.column).toBe(1);
    });

    it('should parse multiple files', () => {
      const eslintOutput = `/path/to/file1.js
  10:5  error  'x' is defined but never used  no-unused-vars

/path/to/file2.js
  5:1   warning  Unexpected console statement  no-console
  8:3   error    Missing semicolon            semi

✖ 3 problems (2 errors, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(3);

      // First file error
      expect(errors[0].context?.file).toBe('/path/to/file1.js');
      expect(errors[0].context?.line).toBe(10);

      // Second file errors
      expect(errors[1].context?.file).toBe('/path/to/file2.js');
      expect(errors[1].context?.line).toBe(5);
      expect(errors[1].type).toBe(ErrorType.VALIDATION); // warning

      expect(errors[2].context?.file).toBe('/path/to/file2.js');
      expect(errors[2].context?.line).toBe(8);
      expect(errors[2].type).toBe(ErrorType.CONFIG); // error
    });
  });

  describe('parseESLintErrors - edge cases', () => {
    it('should handle empty input', () => {
      const errors = formatter.parseESLintErrors('');
      expect(errors).toHaveLength(0);
    });

    it('should handle input with only summary line', () => {
      const eslintOutput = `✖ 0 problems (0 errors, 0 warnings)`;
      const errors = formatter.parseESLintErrors(eslintOutput);
      expect(errors).toHaveLength(0);
    });

    it('should skip lines that do not match error pattern', () => {
      const eslintOutput = `/path/to/file.js
Some random line that should be ignored
  10:5  error  'x' is defined but never used  no-unused-vars
Another random line

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.line).toBe(10);
    });

    it('should handle Windows file paths', () => {
      const eslintOutput = `C:\\Users\\name\\project\\file.js
  10:5  error  'x' is defined but never used  no-unused-vars

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('C:\\Users\\name\\project\\file.js');
    });

    it('should handle relative file paths', () => {
      const eslintOutput = `./src/components/App.jsx
  5:1  error  Missing semicolon  semi

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('./src/components/App.jsx');
    });

    it('should handle file paths with spaces', () => {
      const eslintOutput = `"/path/with spaces/file.js"
  10:5  error  'x' is defined but never used  no-unused-vars

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('"/path/with spaces/file.js"');
    });

    it('should prevent duplicate errors', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars
  10:5  error  'x' is defined but never used  no-unused-vars

✖ 2 problems (2 errors, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      // Should only have one error, not two duplicates
      expect(errors).toHaveLength(1);
    });

    it('should handle different summary line formats', () => {
      const formats = [
        '✖ 1 problem (1 error, 0 warnings)',
        'X 1 problem (1 error, 0 warnings)',
        '× 1 problem (1 error, 0 warnings)',
        '  1 problem (1 error, 0 warnings)',
        '1 problems (1 error, 0 warnings)'
      ];

      formats.forEach(summaryLine => {
        const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars

${summaryLine}`;

        const errors = formatter.parseESLintErrors(eslintOutput);
        expect(errors).toHaveLength(1);
      });
    });
  });

  describe('parseESLintErrors - suggestion generation', () => {
    it('should generate suggestions for no-unused-vars', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors[0].suggestions).toHaveLength(2);
      expect(errors[0].suggestions?.[0].title).toBe('Remove unused variable');
      expect(errors[0].suggestions?.[1].title).toBe('Prefix with underscore');
    });

    it('should generate suggestions for no-console', () => {
      const eslintOutput = `/path/to/file.js
  15:3  warning  Unexpected console statement  no-console`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors[0].suggestions).toHaveLength(2);
      expect(errors[0].suggestions?.[0].title).toBe('Remove console statement');
      expect(errors[0].suggestions?.[1].title).toBe('Use proper logging');
    });

    it('should generate suggestions for prefer-const', () => {
      const eslintOutput = `/path/to/file.js
  5:1  error  'x' is never reassigned  prefer-const`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors[0].suggestions).toHaveLength(1);
      expect(errors[0].suggestions?.[0].title).toBe('Use const instead of let');
    });

    it('should generate suggestions for eqeqeq', () => {
      const eslintOutput = `/path/to/file.js
  8:1  error  Expected '===' and instead saw '=='  eqeqeq`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors[0].suggestions).toHaveLength(1);
      expect(errors[0].suggestions?.[0].title).toBe('Use strict equality');
    });

    it('should generate suggestions for no-undef', () => {
      const eslintOutput = `/path/to/file.js
  12:1  error  'undefinedVar' is not defined  no-undef`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors[0].suggestions).toHaveLength(2);
      expect(errors[0].suggestions?.[0].title).toBe('Import the variable');
      expect(errors[0].suggestions?.[1].title).toBe('Define the variable');
      expect(errors[0].suggestions?.[0].command).toContain('undefinedVar');
    });

    it('should generate suggestions for @typescript-eslint/no-explicit-any', () => {
      const eslintOutput = `/path/to/file.ts
  7:15  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors[0].suggestions).toHaveLength(2);
      expect(errors[0].suggestions?.[0].title).toBe('Use specific type');
      expect(errors[0].suggestions?.[1].title).toBe('Use unknown for truly unknown types');
    });

    it('should generate suggestions for import rules', () => {
      const eslintOutput = `/path/to/file.js
  20:1  error  Import in body of module; reorder to top  import/first`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors[0].suggestions).toHaveLength(1);
      expect(errors[0].suggestions?.[0].title).toBe('Move imports to top');
    });

    it('should generate suggestions for quotes rule', () => {
      const eslintOutput1 = `/path/to/file.js
  5:15  error  Strings must use singlequote  quotes`;

      const errors1 = formatter.parseESLintErrors(eslintOutput1);

      expect(errors1[0].suggestions).toHaveLength(1);
      expect(errors1[0].suggestions?.[0].title).toBe('Use single quotes');

      const eslintOutput2 = `/path/to/file.js
  5:15  error  Strings must use doublequote  quotes`;

      const errors2 = formatter.parseESLintErrors(eslintOutput2);

      expect(errors2[0].suggestions).toHaveLength(1);
      expect(errors2[0].suggestions?.[0].title).toBe('Use double quotes');
    });

    it('should generate generic suggestion for unknown rules', () => {
      const eslintOutput = `/path/to/file.js
  10:1  error  Some custom rule violation  custom-rule`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors[0].suggestions).toHaveLength(1);
      expect(errors[0].suggestions?.[0].title).toBe('Check ESLint documentation');
      expect(errors[0].suggestions?.[0].command).toContain('custom-rule');
    });
  });

  describe('parseESLintErrors - standalone function', () => {
    it('should work with standalone function export', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars

✖ 1 problem (1 error, 0 warnings)`;

      const errors = parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ErrorType.CONFIG);
      expect(errors[0].message).toBe(`'x' is defined but never used (no-unused-vars)`);
    });
  });

  describe('parseESLintErrors - file path validation', () => {
    it('should accept valid file paths', () => {
      const validPaths = [
        '/absolute/path/file.js',
        './relative/path/file.js',
        '../parent/file.js',
        'src/components/App.jsx',
        'C:\\Windows\\path\\file.ts',
        './file.vue',
        'package.json'
      ];

      validPaths.forEach(filePath => {
        const eslintOutput = `${filePath}
  1:1  error  Test error  test-rule`;

        const errors = formatter.parseESLintErrors(eslintOutput);
        expect(errors).toHaveLength(1);
        expect(errors[0].context?.file).toBe(filePath);
      });
    });

    it('should reject invalid file paths', () => {
      const invalidPaths = [
        '  /path/with/leading/spaces',
        '/path/with/trailing/spaces  ',
        'just text without extension or separators'
      ];

      // Note: These should be treated as non-file lines and ignored
      invalidPaths.forEach(invalidPath => {
        const eslintOutput = `${invalidPath}
  1:1  error  Test error  test-rule`;

        const errors = formatter.parseESLintErrors(eslintOutput);
        // Should not parse any errors since file path is invalid
        expect(errors).toHaveLength(0);
      });
    });
  });
});