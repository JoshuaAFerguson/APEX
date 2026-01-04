import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  parseESLintErrors,
} from '../ErrorFormatter.js';

/**
 * Acceptance Tests for ESLint Error Parsing
 *
 * These tests verify that the ErrorFormatter meets the acceptance criteria:
 * - ErrorFormatter can parse ESLint output (default and stylish formatters)
 * - Extracts file path, line, column, rule ID, severity, and message
 * - Unit tests cover warnings, errors, and multiple files
 */
describe('ErrorFormatter ESLint Parsing - Acceptance Criteria', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('AC1: Parse ESLint default formatter output', () => {
    it('should extract all required components from default formatter', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      const error = errors[0];

      // Verify all required components are extracted
      expect(error.context?.file).toBe('/path/to/file.js'); // File path
      expect(error.context?.line).toBe(10); // Line number
      expect(error.context?.column).toBe(5); // Column number
      expect(error.message).toContain('no-unused-vars'); // Rule ID
      expect(error.type).toBe(ErrorType.CONFIG); // Severity (error)
      expect(error.message).toContain("'x' is defined but never used"); // Message
      expect(error.context?.description).toBe('ESLint error'); // Categorization
    });

    it('should extract components from warning in default formatter', () => {
      const eslintOutput = `/path/to/file.js
  15:3  warning  Unexpected console statement  no-console

✖ 1 problem (0 errors, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      const error = errors[0];

      expect(error.context?.file).toBe('/path/to/file.js');
      expect(error.context?.line).toBe(15);
      expect(error.context?.column).toBe(3);
      expect(error.message).toContain('no-console');
      expect(error.type).toBe(ErrorType.VALIDATION); // Severity (warning)
      expect(error.message).toContain('Unexpected console statement');
      expect(error.context?.description).toBe('ESLint warning');
    });
  });

  describe('AC2: Parse ESLint stylish formatter output', () => {
    it('should extract all required components from stylish formatter', () => {
      const eslintOutput = `/path/to/file.js
  10:5   error    'x' is defined but never used   no-unused-vars
  15:3   warning  Unexpected console statement    no-console

✖ 2 problems (1 error, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(2);

      // First error
      const error1 = errors[0];
      expect(error1.context?.file).toBe('/path/to/file.js');
      expect(error1.context?.line).toBe(10);
      expect(error1.context?.column).toBe(5);
      expect(error1.message).toContain('no-unused-vars');
      expect(error1.type).toBe(ErrorType.CONFIG); // error severity
      expect(error1.message).toContain("'x' is defined but never used");

      // Second warning
      const error2 = errors[1];
      expect(error2.context?.file).toBe('/path/to/file.js');
      expect(error2.context?.line).toBe(15);
      expect(error2.context?.column).toBe(3);
      expect(error2.message).toContain('no-console');
      expect(error2.type).toBe(ErrorType.VALIDATION); // warning severity
      expect(error2.message).toContain('Unexpected console statement');
    });

    it('should handle TypeScript ESLint rules with scoped names', () => {
      const eslintOutput = `/path/to/file.ts
  5:12   error    Don't use 'any' type   @typescript-eslint/no-explicit-any
  8:1    warning  Import statement       import/first

✖ 2 problems (1 error, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(2);

      // TypeScript ESLint rule
      expect(errors[0].message).toContain('@typescript-eslint/no-explicit-any');
      expect(errors[0].type).toBe(ErrorType.CONFIG);

      // Import rule with slash
      expect(errors[1].message).toContain('import/first');
      expect(errors[1].type).toBe(ErrorType.VALIDATION);
    });
  });

  describe('AC3: Handle multiple files', () => {
    it('should parse errors and warnings from multiple files', () => {
      const eslintOutput = `/path/to/file1.js
  10:5  error    'x' is defined but never used   no-unused-vars
  15:3  warning  Unexpected console statement    no-console

/path/to/file2.js
  5:1   error    Missing semicolon               semi
  8:2   warning  Use === instead of ==           eqeqeq

/path/to/file3.ts
  12:15  error  Cannot find name 'React'         @typescript-eslint/no-undef

✖ 5 problems (3 errors, 2 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(5);

      // File 1 - error
      expect(errors[0].context?.file).toBe('/path/to/file1.js');
      expect(errors[0].context?.line).toBe(10);
      expect(errors[0].type).toBe(ErrorType.CONFIG);
      expect(errors[0].message).toContain('no-unused-vars');

      // File 1 - warning
      expect(errors[1].context?.file).toBe('/path/to/file1.js');
      expect(errors[1].context?.line).toBe(15);
      expect(errors[1].type).toBe(ErrorType.VALIDATION);
      expect(errors[1].message).toContain('no-console');

      // File 2 - error
      expect(errors[2].context?.file).toBe('/path/to/file2.js');
      expect(errors[2].context?.line).toBe(5);
      expect(errors[2].type).toBe(ErrorType.CONFIG);
      expect(errors[2].message).toContain('semi');

      // File 2 - warning
      expect(errors[3].context?.file).toBe('/path/to/file2.js');
      expect(errors[3].context?.line).toBe(8);
      expect(errors[3].type).toBe(ErrorType.VALIDATION);
      expect(errors[3].message).toContain('eqeqeq');

      // File 3 - TypeScript error
      expect(errors[4].context?.file).toBe('/path/to/file3.ts');
      expect(errors[4].context?.line).toBe(12);
      expect(errors[4].type).toBe(ErrorType.CONFIG);
      expect(errors[4].message).toContain('@typescript-eslint/no-undef');
    });

    it('should handle various file path formats', () => {
      const eslintOutput = `./src/components/App.jsx
  5:1  error  Missing semicolon  semi

../utils/helper.js
  10:2  warning  Unexpected console  no-console

C:\\Users\\dev\\project\\file.ts
  15:8  error  No explicit any  @typescript-eslint/no-explicit-any

/absolute/path/to/file.vue
  20:3  warning  Prefer const  prefer-const

✖ 4 problems (2 errors, 2 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(4);

      // Relative path with ./
      expect(errors[0].context?.file).toBe('./src/components/App.jsx');

      // Relative path with ../
      expect(errors[1].context?.file).toBe('../utils/helper.js');

      // Windows absolute path
      expect(errors[2].context?.file).toBe('C:\\Users\\dev\\project\\file.ts');

      // Unix absolute path
      expect(errors[3].context?.file).toBe('/absolute/path/to/file.vue');
    });
  });

  describe('AC4: Proper rule ID extraction', () => {
    it('should extract various rule ID formats', () => {
      const testCases = [
        {
          input: `file.js\n  1:1  error  Test message  no-unused-vars`,
          expectedRule: 'no-unused-vars'
        },
        {
          input: `file.ts\n  1:1  error  Test message  @typescript-eslint/no-explicit-any`,
          expectedRule: '@typescript-eslint/no-explicit-any'
        },
        {
          input: `file.js\n  1:1  error  Test message  import/order`,
          expectedRule: 'import/order'
        },
        {
          input: `file.vue\n  1:1  error  Test message  vue/require-v-for-key`,
          expectedRule: 'vue/require-v-for-key'
        },
        {
          input: `file.jsx\n  1:1  error  Test message  react/jsx-uses-vars`,
          expectedRule: 'react/jsx-uses-vars'
        },
        {
          input: `file.js\n  1:1  error  Test message  custom-rule`,
          expectedRule: 'custom-rule'
        }
      ];

      testCases.forEach(({ input, expectedRule }) => {
        const errors = formatter.parseESLintErrors(input);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain(expectedRule);
      });
    });
  });

  describe('AC5: Severity classification', () => {
    it('should correctly classify errors vs warnings', () => {
      const eslintOutput = `/path/to/file.js
  5:1   error    'x' is defined but never used   no-unused-vars
  10:3  warning  Unexpected console statement    no-console
  15:2  error    Missing semicolon               semi
  20:1  warning  Use === instead of ==           eqeqeq

✖ 4 problems (2 errors, 2 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(4);

      // First error
      expect(errors[0].type).toBe(ErrorType.CONFIG);
      expect(errors[0].context?.description).toBe('ESLint error');

      // First warning
      expect(errors[1].type).toBe(ErrorType.VALIDATION);
      expect(errors[1].context?.description).toBe('ESLint warning');

      // Second error
      expect(errors[2].type).toBe(ErrorType.CONFIG);
      expect(errors[2].context?.description).toBe('ESLint error');

      // Second warning
      expect(errors[3].type).toBe(ErrorType.VALIDATION);
      expect(errors[3].context?.description).toBe('ESLint warning');
    });
  });

  describe('AC6: Generated suggestions', () => {
    it('should generate appropriate suggestions for common rules', () => {
      const testCases = [
        {
          rule: 'no-unused-vars',
          expectedSuggestions: ['Remove unused variable', 'Prefix with underscore']
        },
        {
          rule: 'no-console',
          expectedSuggestions: ['Remove console statement', 'Use proper logging']
        },
        {
          rule: 'prefer-const',
          expectedSuggestions: ['Use const instead of let']
        },
        {
          rule: 'eqeqeq',
          expectedSuggestions: ['Use strict equality']
        },
        {
          rule: '@typescript-eslint/no-explicit-any',
          expectedSuggestions: ['Use specific type', 'Use unknown for truly unknown types']
        }
      ];

      testCases.forEach(({ rule, expectedSuggestions }) => {
        const eslintOutput = `/path/to/file.js\n  1:1  error  Test message  ${rule}`;
        const errors = formatter.parseESLintErrors(eslintOutput);

        expect(errors).toHaveLength(1);
        const suggestions = errors[0].suggestions || [];

        expectedSuggestions.forEach(expectedTitle => {
          expect(suggestions.some(s => s.title === expectedTitle)).toBe(true);
        });
      });
    });
  });

  describe('AC7: Edge cases and robustness', () => {
    it('should handle empty ESLint output', () => {
      const errors = formatter.parseESLintErrors('');
      expect(errors).toHaveLength(0);
    });

    it('should handle ESLint output with no errors', () => {
      const eslintOutput = `✖ 0 problems (0 errors, 0 warnings)`;
      const errors = formatter.parseESLintErrors(eslintOutput);
      expect(errors).toHaveLength(0);
    });

    it('should skip malformed lines gracefully', () => {
      const eslintOutput = `/path/to/file.js
Some random text that should be ignored
  10:5  error  'x' is defined but never used  no-unused-vars
Another line to ignore

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);
      expect(errors).toHaveLength(1);
      expect(errors[0].context?.line).toBe(10);
    });

    it('should prevent duplicate error extraction', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars
  10:5  error  'x' is defined but never used  no-unused-vars

✖ 2 problems (2 errors, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);
      // Should only extract one error, not two duplicates
      expect(errors).toHaveLength(1);
    });
  });

  describe('AC8: Standalone parseESLintErrors function', () => {
    it('should be available as a standalone convenience function', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  'x' is defined but never used  no-unused-vars

✖ 1 problem (1 error, 0 warnings)`;

      const errors = parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ErrorType.CONFIG);
      expect(errors[0].message).toContain('no-unused-vars');
      expect(errors[0].context?.file).toBe('/path/to/file.js');
    });

    it('should produce same results as instance method', () => {
      const eslintOutput = `/path/to/file.js
  10:5  error  Test error  test-rule

✖ 1 problem (1 error, 0 warnings)`;

      const instanceErrors = formatter.parseESLintErrors(eslintOutput);
      const standaloneErrors = parseESLintErrors(eslintOutput);

      expect(instanceErrors).toEqual(standaloneErrors);
    });
  });

  describe('AC9: Integration with ErrorFormatter display', () => {
    it('should format parsed ESLint errors with proper styling', () => {
      const eslintOutput = `/src/components/App.tsx
  42:15  error  'username' is not defined  no-undef

✖ 1 problem (1 error, 0 warnings)`;

      const errors = formatter.parseESLintErrors(eslintOutput);
      const formattedOutput = formatter.format(errors[0]);

      // Verify formatting includes all components
      expect(formattedOutput).toContain('⚙️'); // CONFIG error icon
      expect(formattedOutput).toContain('CONFIG');
      expect(formattedOutput).toContain('no-undef');
      expect(formattedOutput).toContain("'username' is not defined");
      expect(formattedOutput).toContain('src/components/App.tsx');
      expect(formattedOutput).toContain('42');
      expect(formattedOutput).toContain('15');
      expect(formattedOutput).toContain('ESLint error');
      expect(formattedOutput).toContain('💡 Suggestions:');
    });

    it('should format multiple ESLint errors properly', () => {
      const eslintOutput = `/src/file1.js
  10:5  error    'x' is defined but never used  no-unused-vars
  15:3  warning  Unexpected console statement   no-console

/src/file2.js
  5:1   error    Missing semicolon             semi

✖ 3 problems (2 errors, 1 warning)`;

      const errors = formatter.parseESLintErrors(eslintOutput);
      const formattedOutput = formatter.formatMultiple(errors);

      expect(formattedOutput).toContain('3 errors found');
      expect(formattedOutput).toContain('--- Error 1 ---');
      expect(formattedOutput).toContain('--- Error 2 ---');
      expect(formattedOutput).toContain('--- Error 3 ---');
      expect(formattedOutput).toContain('no-unused-vars');
      expect(formattedOutput).toContain('no-console');
      expect(formattedOutput).toContain('semi');
    });
  });

  describe('AC10: Real-world ESLint output compatibility', () => {
    it('should handle actual ESLint CLI output format', () => {
      const realWorldESLintOutput = `
/Users/dev/project/src/components/UserProfile.tsx
   8:10  error    'React' must be in scope when using JSX                      react/react-in-jsx-scope
  15:5   error    'user' is defined but never used                             no-unused-vars
  23:12  warning  Unexpected console statement                                  no-console
  35:8   error    Expected '===' and instead saw '=='                          eqeqeq
  42:1   warning  'UserProfile' is defined but never used                      no-unused-vars

/Users/dev/project/src/utils/api.js
  12:3   error    'fetch' is not defined                                       no-undef
  25:15  warning  Do not use 'new' for side effects                           no-new
  38:2   error    Newline required at end of file but not found               eol-last

✖ 8 problems (5 errors, 3 warnings)
  2 errors and 0 warnings potentially fixable with the \`--fix\` option.
`;

      const errors = formatter.parseESLintErrors(realWorldESLintOutput);

      expect(errors).toHaveLength(8);

      // Verify first file errors
      expect(errors[0].context?.file).toBe('/Users/dev/project/src/components/UserProfile.tsx');
      expect(errors[0].context?.line).toBe(8);
      expect(errors[0].message).toContain('react/react-in-jsx-scope');
      expect(errors[0].type).toBe(ErrorType.CONFIG);

      expect(errors[1].context?.line).toBe(15);
      expect(errors[1].message).toContain('no-unused-vars');

      expect(errors[2].context?.line).toBe(23);
      expect(errors[2].message).toContain('no-console');
      expect(errors[2].type).toBe(ErrorType.VALIDATION); // warning

      // Verify second file errors
      expect(errors[5].context?.file).toBe('/Users/dev/project/src/utils/api.js');
      expect(errors[5].context?.line).toBe(12);
      expect(errors[5].message).toContain('no-undef');

      expect(errors[6].context?.line).toBe(25);
      expect(errors[6].type).toBe(ErrorType.VALIDATION); // warning

      expect(errors[7].context?.line).toBe(38);
      expect(errors[7].message).toContain('eol-last');
    });
  });
});