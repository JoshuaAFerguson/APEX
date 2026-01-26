/**
 * Integration tests for ErrorFormatter with syntax highlighting utilities
 * to verify the complete documentation examples work together
 */
import { describe, it, expect } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  parseTypeScriptErrors,
  parseESLintErrors,
  defaultErrorFormatter,
} from '../ErrorFormatter.js';

describe('ErrorFormatter + Syntax Highlighting Integration', () => {
  describe('Real-world TypeScript error parsing scenarios', () => {
    it('should parse complex TypeScript compilation output with multiple files', () => {
      const complexTscOutput = `
src/components/UserProfile.tsx(15,7): error TS2339: Property 'username' does not exist on type '{ id: number; email: string; profile: { firstName: string; lastName: string; }; }'.
src/components/UserProfile.tsx(22,15): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/utils/validation.ts(8,3): error TS2304: Cannot find name 'validator'.
src/utils/validation.ts(12,10): error TS2307: Cannot find module 'lodash/isEmpty' or its corresponding type declarations.
src/hooks/useAuth.ts(45,21): error TS2531: Object is possibly 'null'.
src/hooks/useAuth.ts(52,8): error TS7006: Parameter 'user' implicitly has an 'any' type.
src/types/api.ts(3,14): error TS2583: Cannot find name 'Response'. Do you need to change your target library? Try changing the 'lib' compiler option to include 'dom'.
`;

      const errors = parseTypeScriptErrors(complexTscOutput);

      expect(errors).toHaveLength(7);

      // Check specific error types and contexts
      expect(errors[0].message).toContain('TS2339');
      expect(errors[0].context?.file).toBe('src/components/UserProfile.tsx');
      expect(errors[0].context?.line).toBe(15);
      expect(errors[0].context?.column).toBe(7);

      expect(errors[3].message).toContain('TS2307');
      expect(errors[3].context?.file).toBe('src/utils/validation.ts');
      expect(errors[3].context?.line).toBe(12);

      expect(errors[6].message).toContain('TS2583');
      expect(errors[6].context?.file).toBe('src/types/api.ts');

      // Verify all errors have suggestions
      errors.forEach(error => {
        expect(error.suggestions).toBeDefined();
        expect(error.suggestions!.length).toBeGreaterThan(0);
      });
    });

    it('should parse TypeScript errors in different output formats', () => {
      // Colon format (newer tsc versions)
      const colonFormat = `
src/index.ts:42:15 - error TS2339: Property 'nonExistent' does not exist on type 'Config'.
src/utils.ts:18:3 - error TS2304: Cannot find name 'logger'.
`;

      // Parentheses format (older tsc versions)
      const parenFormat = `
src/index.ts(42,15): error TS2339: Property 'nonExistent' does not exist on type 'Config'.
src/utils.ts(18,3): error TS2304: Cannot find name 'logger'.
`;

      const colonErrors = parseTypeScriptErrors(colonFormat);
      const parenErrors = parseTypeScriptErrors(parenFormat);

      expect(colonErrors).toHaveLength(2);
      expect(parenErrors).toHaveLength(2);

      // Both should parse to the same structure
      expect(colonErrors[0].context?.file).toBe(parenErrors[0].context?.file);
      expect(colonErrors[0].context?.line).toBe(parenErrors[0].context?.line);
      expect(colonErrors[0].context?.column).toBe(parenErrors[0].context?.column);
      expect(colonErrors[0].message).toBe(parenErrors[0].message);
    });
  });

  describe('Real-world ESLint error parsing scenarios', () => {
    it('should parse ESLint output from different formatters', () => {
      const defaultFormat = `
/Users/developer/project/src/components/Button.tsx
  15:7   error    'React' must be in scope when using JSX  react/react-in-jsx-scope
  22:15  warning  img elements must have an alt prop        jsx-a11y/alt-text
  35:3   error    Missing semicolon                         semi

/Users/developer/project/src/utils/api.ts
  8:5   error  'response' is assigned a value but never used  no-unused-vars
  12:1  error  Expected indentation of 2 spaces but found 4   indent
`;

      const stylishFormat = `

/Users/developer/project/src/components/Button.tsx
   15:7    error    'React' must be in scope when using JSX    react/react-in-jsx-scope
   22:15   warning  img elements must have an alt prop          jsx-a11y/alt-text
   35:3    error    Missing semicolon                           semi

/Users/developer/project/src/utils/api.ts
    8:5    error    'response' is assigned a value but never used    no-unused-vars
   12:1    error    Expected indentation of 2 spaces but found 4     indent

✖ 5 problems (4 errors, 1 warning)

`;

      const defaultErrors = parseESLintErrors(defaultFormat);
      const stylishErrors = parseESLintErrors(stylishFormat);

      expect(defaultErrors).toHaveLength(5);
      expect(stylishErrors).toHaveLength(5);

      // Check error types (error vs warning)
      expect(defaultErrors[0].type).toBe(ErrorType.CONFIG); // error
      expect(defaultErrors[1].type).toBe(ErrorType.VALIDATION); // warning
      expect(stylishErrors[0].type).toBe(ErrorType.CONFIG); // error
      expect(stylishErrors[1].type).toBe(ErrorType.VALIDATION); // warning

      // Check rule IDs are parsed correctly
      expect(defaultErrors[0].message).toContain('react/react-in-jsx-scope');
      expect(defaultErrors[1].message).toContain('jsx-a11y/alt-text');
      expect(defaultErrors[2].message).toContain('semi');
      expect(defaultErrors[3].message).toContain('no-unused-vars');
      expect(defaultErrors[4].message).toContain('indent');
    });

    it('should handle ESLint output with no errors', () => {
      const noErrorsOutput = `
✨  ESLint found no problems!

  2 files checked
  0 errors, 0 warnings
`;

      const errors = parseESLintErrors(noErrorsOutput);
      expect(errors).toHaveLength(0);
    });

    it('should handle ESLint output with only summary', () => {
      const summaryOnlyOutput = `
✖ 15 problems (10 errors, 5 warnings)
  3 errors and 2 warnings potentially fixable with the \`--fix\` option.
`;

      const errors = parseESLintErrors(summaryOnlyOutput);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Formatting complex error scenarios', () => {
    it('should format multiple errors with full context and suggestions', () => {
      const formatter = new ErrorFormatter(ErrorVerbosity.VERBOSE);

      const tscOutput = `
src/auth.ts(25,8): error TS2304: Cannot find name 'JWT'.
src/auth.ts(30,15): error TS2339: Property 'decode' does not exist on type 'typeof import("jsonwebtoken")'.
`;

      const errors = parseTypeScriptErrors(tscOutput);
      const formatted = formatter.formatMultiple(errors);

      expect(formatted).toContain('2 errors found');
      expect(formatted).toContain('Error 1');
      expect(formatted).toContain('Error 2');
      expect(formatted).toContain('Cannot find name \'JWT\'');
      expect(formatted).toContain('Property \'decode\' does not exist');
      expect(formatted).toContain('src/auth.ts:25:8');
      expect(formatted).toContain('src/auth.ts:30:15');
      expect(formatted).toContain('💡 Suggestions:');
      expect(formatted).toContain('Import missing module');
    });

    it('should handle mixed TypeScript and ESLint errors', () => {
      const formatter = new ErrorFormatter(ErrorVerbosity.NORMAL);

      // Simulate a scenario where both TypeScript and ESLint errors occur
      const tscErrors = parseTypeScriptErrors(`
src/app.ts(10,5): error TS2304: Cannot find name 'process'.
`);

      const eslintErrors = parseESLintErrors(`
/src/app.ts
  15:3  error  'console' is not defined  no-undef
  20:1  error  Missing semicolon         semi
`);

      const allErrors = [...tscErrors, ...eslintErrors];
      const formatted = formatter.formatMultiple(allErrors);

      expect(formatted).toContain('3 errors found');
      expect(formatted).toContain('Cannot find name \'process\'');
      expect(formatted).toContain('\'console\' is not defined');
      expect(formatted).toContain('Missing semicolon');
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle very large error outputs efficiently', () => {
      const largeErrorOutput = Array(1000).fill(
        'src/generated/file{index}.ts(1,1): error TS2339: Property \'test\' does not exist on type \'object\'.'
      ).map((template, index) => template.replace('{index}', index.toString())).join('\n');

      const startTime = Date.now();
      const errors = parseTypeScriptErrors(largeErrorOutput);
      const endTime = Date.now();

      expect(errors).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds

      // Verify structure of first and last errors
      expect(errors[0].context?.file).toBe('src/generated/file0.ts');
      expect(errors[999].context?.file).toBe('src/generated/file999.ts');
    });

    it('should handle malformed error output gracefully', () => {
      const malformedOutput = `
This is not a valid error format
Random text without structure
src/file.ts: some incomplete error
(15,3): missing file path
`;

      const tscErrors = parseTypeScriptErrors(malformedOutput);
      const eslintErrors = parseESLintErrors(malformedOutput);

      expect(tscErrors).toHaveLength(0);
      expect(eslintErrors).toHaveLength(0);
    });

    it('should handle errors with special characters and unicode', () => {
      const unicodeErrorOutput = `
src/unicode.ts(5,12): error TS2339: Property 'émoji' does not exist on type '{ name: string; 日本語: number; }'.
src/paths.ts(8,3): error TS2307: Cannot find module './utils/файл.js' or its corresponding type declarations.
`;

      const errors = parseTypeScriptErrors(unicodeErrorOutput);

      expect(errors).toHaveLength(2);
      expect(errors[0].message).toContain('émoji');
      expect(errors[0].message).toContain('日本語');
      expect(errors[1].message).toContain('файл.js');
    });
  });

  describe('Error formatting with different verbosity levels', () => {
    it('should provide appropriate detail levels for different use cases', () => {
      const error = {
        type: ErrorType.CONFIG,
        message: 'TypeScript compilation failed',
        context: {
          file: 'src/complex/deeply/nested/component.tsx',
          line: 127,
          column: 23,
          function: 'renderUserProfile',
          description: 'Type mismatch in user profile rendering logic'
        },
        suggestions: [
          {
            title: 'Add type annotation',
            description: 'Specify the correct type for the user parameter',
            command: '// Add: user: UserProfile'
          },
          {
            title: 'Import missing types',
            description: 'Import UserProfile interface from types module',
            command: 'import { UserProfile } from \'../types/User\';'
          }
        ],
        originalError: new Error('Original TypeScript error with stack trace')
      };

      const minimalFormatter = new ErrorFormatter(ErrorVerbosity.MINIMAL);
      const normalFormatter = new ErrorFormatter(ErrorVerbosity.NORMAL);
      const verboseFormatter = new ErrorFormatter(ErrorVerbosity.VERBOSE);

      const minimalOutput = minimalFormatter.format(error);
      const normalOutput = normalFormatter.format(error);
      const verboseOutput = verboseFormatter.format(error);

      // Minimal should only show error message
      expect(minimalOutput).toContain('TypeScript compilation failed');
      expect(minimalOutput).not.toContain('src/complex/deeply');
      expect(minimalOutput).not.toContain('Add type annotation');
      expect(minimalOutput).not.toContain('Stack Trace');

      // Normal should show context and suggestions but no stack trace
      expect(normalOutput).toContain('TypeScript compilation failed');
      expect(normalOutput).toContain('src/complex/deeply/nested/component.tsx:127');
      expect(normalOutput).toContain('renderUserProfile');
      expect(normalOutput).toContain('Add type annotation');
      expect(normalOutput).not.toContain('Stack Trace');

      // Verbose should show everything
      expect(verboseOutput).toContain('TypeScript compilation failed');
      expect(verboseOutput).toContain('src/complex/deeply/nested/component.tsx:127');
      expect(verboseOutput).toContain('renderUserProfile');
      expect(verboseOutput).toContain('Add type annotation');
      expect(verboseOutput).toContain('Stack Trace');
    });
  });

  describe('Integration with default formatter instance', () => {
    it('should work seamlessly with default exported functions', () => {
      // This test ensures the convenience exports work as documented
      expect(defaultErrorFormatter).toBeDefined();
      expect(typeof parseTypeScriptErrors).toBe('function');
      expect(typeof parseESLintErrors).toBe('function');

      const tscOutput = 'src/test.ts(1,1): error TS2304: Cannot find name \'test\'.';
      const errors = parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ErrorType.CONFIG);
      expect(errors[0].message).toContain('TS2304');

      // Should work with default formatter
      const formatted = defaultErrorFormatter.format(errors[0]);
      expect(formatted).toContain('CONFIG');
      expect(formatted).toContain('Cannot find name \'test\'');
    });
  });
});