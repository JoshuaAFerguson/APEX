import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  parseTypeScriptErrors,
} from '../ErrorFormatter.js';

/**
 * Acceptance Tests for TypeScript Error Parsing
 *
 * These tests verify that the ErrorFormatter meets the acceptance criteria:
 * - ErrorFormatter can parse TypeScript compiler errors (tsc output)
 * - Extracts file path, line number, column, error code (TSxxxx), and message
 * - Extracts structured error objects from raw tsc output
 * - Unit tests cover single errors, multiple errors, and edge cases
 */
describe('ErrorFormatter TypeScript Parsing - Acceptance Criteria', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('AC1: Parse TypeScript compiler errors from tsc output', () => {
    it('should extract all required components from single error', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'username' does not exist on type 'User'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      const error = errors[0];

      // Verify all required components are extracted
      expect(error.context?.file).toBe('src/types/User.ts'); // File path
      expect(error.context?.line).toBe(42); // Line number
      expect(error.context?.column).toBe(15); // Column number
      expect(error.message).toContain('TS2339'); // Error code
      expect(error.message).toContain("Property 'username' does not exist on type 'User'."); // Error message
      expect(error.type).toBe(ErrorType.CONFIG); // Proper categorization
    });

    it('should extract components from colon format', () => {
      const tscOutput = `src/components/App.tsx:25:8 - error TS2304: Cannot find name 'React'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      const error = errors[0];

      expect(error.context?.file).toBe('src/components/App.tsx');
      expect(error.context?.line).toBe(25);
      expect(error.context?.column).toBe(8);
      expect(error.message).toContain('TS2304');
      expect(error.message).toContain("Cannot find name 'React'.");
    });

    it('should handle TypeScript errors with different error codes', () => {
      const testCases = [
        {
          input: `src/file.ts(1,1): error TS2322: Type 'string' is not assignable to type 'number'.`,
          code: 'TS2322',
          message: "Type 'string' is not assignable to type 'number'."
        },
        {
          input: `src/file.ts(2,2): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`,
          code: 'TS2345',
          message: "Argument of type 'string' is not assignable to parameter of type 'number'."
        },
        {
          input: `src/file.ts(3,3): error TS2307: Cannot find module 'missing-module'.`,
          code: 'TS2307',
          message: "Cannot find module 'missing-module'."
        }
      ];

      testCases.forEach(({ input, code, message }) => {
        const errors = formatter.parseTypeScriptErrors(input);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain(code);
        expect(errors[0].message).toContain(message);
      });
    });
  });

  describe('AC2: Extract structured error objects from raw tsc output', () => {
    it('should create proper FormattedError structure', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      const error = errors[0];

      // Verify FormattedError structure
      expect(error).toHaveProperty('type');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('context');
      expect(error).toHaveProperty('suggestions');

      // Verify ErrorContext structure
      expect(error.context).toHaveProperty('file');
      expect(error.context).toHaveProperty('line');
      expect(error.context).toHaveProperty('column');
      expect(error.context).toHaveProperty('description');

      // Verify suggestions array
      expect(Array.isArray(error.suggestions)).toBe(true);
      expect(error.suggestions!.length).toBeGreaterThan(0);

      // Verify suggestion structure
      const suggestion = error.suggestions![0];
      expect(suggestion).toHaveProperty('title');
      expect(suggestion).toHaveProperty('description');
    });

    it('should generate intelligent suggestions based on error codes', () => {
      const testCases = [
        {
          input: `src/file.ts(1,1): error TS2339: Property 'username' does not exist on type 'User'.`,
          expectedSuggestions: [
            'Add missing property to type definition',
            'Use optional chaining',
            'Check property name spelling'
          ]
        },
        {
          input: `src/file.ts(1,1): error TS2304: Cannot find name 'React'.`,
          expectedSuggestions: [
            'Import missing module or type',
            'Install type definitions'
          ]
        },
        {
          input: `src/file.ts(1,1): error TS2307: Cannot find module 'lodash'.`,
          expectedSuggestions: [
            'Install missing package',
            'Check import path'
          ]
        }
      ];

      testCases.forEach(({ input, expectedSuggestions }) => {
        const errors = formatter.parseTypeScriptErrors(input);
        expect(errors).toHaveLength(1);

        const suggestions = errors[0].suggestions || [];
        expectedSuggestions.forEach(expectedTitle => {
          expect(suggestions.some(s => s.title === expectedTitle)).toBe(true);
        });
      });
    });
  });

  describe('AC3: Handle multiple errors in tsc output', () => {
    it('should parse multiple errors correctly', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils/helper.ts(10,8): error TS2304: Cannot find name 'UnknownType'.
src/components/App.tsx(5,1): error TS2322: Type 'string' is not assignable to type 'number'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(3);

      // Verify first error
      expect(errors[0].context?.file).toBe('src/types/User.ts');
      expect(errors[0].context?.line).toBe(42);
      expect(errors[0].context?.column).toBe(15);
      expect(errors[0].message).toContain('TS2339');

      // Verify second error
      expect(errors[1].context?.file).toBe('src/utils/helper.ts');
      expect(errors[1].context?.line).toBe(10);
      expect(errors[1].context?.column).toBe(8);
      expect(errors[1].message).toContain('TS2304');

      // Verify third error
      expect(errors[2].context?.file).toBe('src/components/App.tsx');
      expect(errors[2].context?.line).toBe(5);
      expect(errors[2].context?.column).toBe(1);
      expect(errors[2].message).toContain('TS2322');
    });

    it('should handle mixed format multiple errors without duplicates', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/types/User.ts:42:15 - error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils/helper.ts:10:8 - error TS2304: Cannot find name 'UnknownType'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      // Should not duplicate the same error
      expect(errors).toHaveLength(2);
      expect(errors[0].context?.file).toBe('src/types/User.ts');
      expect(errors[1].context?.file).toBe('src/utils/helper.ts');
    });
  });

  describe('AC4: Edge case coverage', () => {
    it('should handle empty tsc output', () => {
      const errors = formatter.parseTypeScriptErrors('');
      expect(errors).toHaveLength(0);
    });

    it('should handle tsc output with no errors', () => {
      const tscOutput = `tsc completed successfully
No compilation errors found`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      expect(errors).toHaveLength(0);
    });

    it('should handle malformed error lines gracefully', () => {
      const tscOutput = `This is not an error line
src/invalid-format.ts: some random text
src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
Another invalid line`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      // Should only extract valid error lines
      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('src/types/User.ts');
    });

    it('should handle Windows and Unix file paths', () => {
      const windowsPath = `C:\\Users\\dev\\project\\src\\types\\User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;
      const unixPath = `/home/dev/project/src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const windowsErrors = formatter.parseTypeScriptErrors(windowsPath);
      const unixErrors = formatter.parseTypeScriptErrors(unixPath);

      expect(windowsErrors).toHaveLength(1);
      expect(unixErrors).toHaveLength(1);
      expect(windowsErrors[0].context?.file).toBe('C:\\Users\\dev\\project\\src\\types\\User.ts');
      expect(unixErrors[0].context?.file).toBe('/home/dev/project/src/types/User.ts');
    });

    it('should handle file paths with spaces', () => {
      const tscOutput = `src/my folder/User Type.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('src/my folder/User Type.ts');
    });

    it('should handle real-world tsc output with context', () => {
      const tscOutput = `Found 0 errors. Watching for file changes.

File change detected. Starting incremental compilation...

src/types/User.ts:42:15 - error TS2339: Property 'foo' does not exist on type 'Bar'.

42     const value = obj.foo;
                        ~~~

src/utils/helper.ts(10,8): error TS2304: Cannot find name 'UnknownType'.

Found 2 errors. Watching for file changes.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(2);
      expect(errors[0].context?.file).toBe('src/types/User.ts');
      expect(errors[0].context?.line).toBe(42);
      expect(errors[0].context?.column).toBe(15);
      expect(errors[1].context?.file).toBe('src/utils/helper.ts');
      expect(errors[1].context?.line).toBe(10);
      expect(errors[1].context?.column).toBe(8);
    });
  });

  describe('AC5: Standalone parseTypeScriptErrors function', () => {
    it('should be available as a standalone convenience function', () => {
      const tscOutput = `src/test.ts(1,1): error TS2339: Property 'test' does not exist on type 'object'.`;

      const errors = parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ErrorType.CONFIG);
      expect(errors[0].message).toContain('TS2339');
      expect(errors[0].context?.file).toBe('src/test.ts');
    });

    it('should produce same results as instance method', () => {
      const tscOutput = `src/test.ts(1,1): error TS2339: Property 'test' does not exist on type 'object'.`;

      const instanceErrors = formatter.parseTypeScriptErrors(tscOutput);
      const standaloneErrors = parseTypeScriptErrors(tscOutput);

      expect(instanceErrors).toEqual(standaloneErrors);
    });
  });

  describe('Integration with ErrorFormatter display', () => {
    it('should format parsed TypeScript errors with proper styling', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'username' does not exist on type 'User'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const formattedOutput = formatter.format(errors[0]);

      // Verify formatting includes all components
      expect(formattedOutput).toContain('⚙️'); // CONFIG error icon
      expect(formattedOutput).toContain('CONFIG');
      expect(formattedOutput).toContain('TS2339');
      expect(formattedOutput).toContain("Property 'username' does not exist");
      expect(formattedOutput).toContain('src/types/User.ts');
      expect(formattedOutput).toContain('42');
      expect(formattedOutput).toContain('15');
      expect(formattedOutput).toContain('TypeScript compilation error');
      expect(formattedOutput).toContain('💡 Suggestions:');
    });

    it('should format multiple TypeScript errors properly', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils/helper.ts(10,8): error TS2304: Cannot find name 'UnknownType'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const formattedOutput = formatter.formatMultiple(errors);

      expect(formattedOutput).toContain('2 errors found');
      expect(formattedOutput).toContain('--- Error 1 ---');
      expect(formattedOutput).toContain('--- Error 2 ---');
      expect(formattedOutput).toContain('TS2339');
      expect(formattedOutput).toContain('TS2304');
    });
  });
});