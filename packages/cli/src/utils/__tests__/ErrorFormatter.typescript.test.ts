import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  FormattedError,
} from '../ErrorFormatter.js';

describe('ErrorFormatter TypeScript Error Parsing', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('parseTypeScriptErrors - single error parsing', () => {
    it('should parse single-line format with parentheses', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        type: ErrorType.CONFIG,
        message: `TS2339: Property 'foo' does not exist on type 'Bar'.`,
        context: {
          file: 'src/types/User.ts',
          line: 42,
          column: 15,
          description: 'TypeScript compilation error'
        },
        suggestions: expect.any(Array)
      });
    });

    it('should parse colon format', () => {
      const tscOutput = `src/types/User.ts:42:15 - error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        type: ErrorType.CONFIG,
        message: `TS2339: Property 'foo' does not exist on type 'Bar'.`,
        context: {
          file: 'src/types/User.ts',
          line: 42,
          column: 15,
          description: 'TypeScript compilation error'
        },
        suggestions: expect.any(Array)
      });
    });

    it('should parse error with different error codes', () => {
      const tscOutput = `src/utils/config.ts(25,5): error TS2304: Cannot find name 'InvalidName'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe(`TS2304: Cannot find name 'InvalidName'.`);
      expect(errors[0].context?.line).toBe(25);
      expect(errors[0].context?.column).toBe(5);
    });
  });

  describe('parseTypeScriptErrors - multiple errors parsing', () => {
    it('should parse multiple errors in single-line format', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils/helper.ts(10,8): error TS2304: Cannot find name 'UnknownType'.
src/components/App.tsx(5,1): error TS2322: Type 'string' is not assignable to type 'number'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(3);

      // First error
      expect(errors[0].message).toBe(`TS2339: Property 'foo' does not exist on type 'Bar'.`);
      expect(errors[0].context?.file).toBe('src/types/User.ts');
      expect(errors[0].context?.line).toBe(42);
      expect(errors[0].context?.column).toBe(15);

      // Second error
      expect(errors[1].message).toBe(`TS2304: Cannot find name 'UnknownType'.`);
      expect(errors[1].context?.file).toBe('src/utils/helper.ts');
      expect(errors[1].context?.line).toBe(10);
      expect(errors[1].context?.column).toBe(8);

      // Third error
      expect(errors[2].message).toBe(`TS2322: Type 'string' is not assignable to type 'number'.`);
      expect(errors[2].context?.file).toBe('src/components/App.tsx');
      expect(errors[2].context?.line).toBe(5);
      expect(errors[2].context?.column).toBe(1);
    });

    it('should parse multiple errors in colon format', () => {
      const tscOutput = `src/types/User.ts:42:15 - error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils/helper.ts:10:8 - error TS2304: Cannot find name 'UnknownType'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(2);
      expect(errors[0].context?.file).toBe('src/types/User.ts');
      expect(errors[1].context?.file).toBe('src/utils/helper.ts');
    });

    it('should handle mixed format errors without duplicates', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/types/User.ts:42:15 - error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils/helper.ts:10:8 - error TS2304: Cannot find name 'UnknownType'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);

      // Should avoid duplicates - first format takes precedence
      expect(errors).toHaveLength(2);
      expect(errors[0].context?.file).toBe('src/types/User.ts');
      expect(errors[1].context?.file).toBe('src/utils/helper.ts');
    });
  });

  describe('parseTypeScriptErrors - edge cases', () => {
    it('should handle empty input', () => {
      const errors = formatter.parseTypeScriptErrors('');
      expect(errors).toHaveLength(0);
    });

    it('should handle input with no errors', () => {
      const tscOutput = `tsc completed successfully
No compilation errors found`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      expect(errors).toHaveLength(0);
    });

    it('should handle malformed error lines', () => {
      const tscOutput = `This is not an error line
src/invalid-format.ts: some random text
src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
Another invalid line`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('src/types/User.ts');
    });

    it('should handle paths with spaces', () => {
      const tscOutput = `src/my folder/User Type.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('src/my folder/User Type.ts');
    });

    it('should handle absolute paths', () => {
      const tscOutput = `/Users/dev/project/src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('/Users/dev/project/src/types/User.ts');
    });

    it('should handle Windows paths', () => {
      const tscOutput = `C:\\Users\\dev\\project\\src\\types\\User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('C:\\Users\\dev\\project\\src\\types\\User.ts');
    });

    it('should handle line/column numbers at boundaries', () => {
      const tscOutput = `src/types/User.ts(1,1): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/types/User.ts(999,999): error TS2304: Cannot find name 'Test'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      expect(errors).toHaveLength(2);
      expect(errors[0].context?.line).toBe(1);
      expect(errors[0].context?.column).toBe(1);
      expect(errors[1].context?.line).toBe(999);
      expect(errors[1].context?.column).toBe(999);
    });
  });

  describe('generateTypeScriptSuggestions', () => {
    it('should generate suggestions for TS2339 (property does not exist)', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'username' does not exist on type 'User'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const suggestions = errors[0].suggestions || [];

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].title).toBe('Add missing property to type definition');
      expect(suggestions[0].description).toContain('username');
      expect(suggestions[0].description).toContain('User');

      expect(suggestions[1].title).toBe('Use optional chaining');
      expect(suggestions[1].command).toContain('username');

      expect(suggestions[2].title).toBe('Check property name spelling');
    });

    it('should generate suggestions for TS2304 (cannot find name)', () => {
      const tscOutput = `src/utils/helper.ts(10,8): error TS2304: Cannot find name 'MyInterface'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const suggestions = errors[0].suggestions || [];

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].title).toBe('Import missing module or type');
      expect(suggestions[0].description).toContain('MyInterface');
      expect(suggestions[0].command).toContain('import { MyInterface }');

      expect(suggestions[1].title).toBe('Install type definitions');
      expect(suggestions[1].command).toContain('@types/myinterface');
    });

    it('should generate suggestions for TS2322 (type not assignable)', () => {
      const tscOutput = `src/utils/helper.ts(15,5): error TS2322: Type 'string' is not assignable to type 'number'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const suggestions = errors[0].suggestions || [];

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].title).toBe('Check type compatibility');
      expect(suggestions[1].title).toBe('Add type assertion');
      expect(suggestions[1].command).toBe('value as ExpectedType');
    });

    it('should generate suggestions for TS2345 (argument not assignable)', () => {
      const tscOutput = `src/utils/helper.ts(20,10): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const suggestions = errors[0].suggestions || [];

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].title).toBe('Check function parameters');
      expect(suggestions[1].title).toBe('Convert argument type');
    });

    it('should generate suggestions for TS2307 (cannot find module)', () => {
      const tscOutput = `src/utils/helper.ts(5,1): error TS2307: Cannot find module 'missing-package'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const suggestions = errors[0].suggestions || [];

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].title).toBe('Install missing package');
      expect(suggestions[0].command).toContain('npm install missing-package');

      expect(suggestions[1].title).toBe('Check import path');
    });

    it('should generate generic suggestions for unknown error codes', () => {
      const tscOutput = `src/utils/helper.ts(5,1): error TS9999: Some unknown error.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const suggestions = errors[0].suggestions || [];

      expect(suggestions.length).toBe(1);
      expect(suggestions[0].title).toBe('Check TypeScript documentation');
      expect(suggestions[0].description).toContain('TS9999');
      expect(suggestions[0].command).toBe('https://www.typescriptlang.org/docs/');
    });
  });

  describe('integration with ErrorFormatter', () => {
    it('should format parsed TypeScript errors correctly', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const formattedOutput = formatter.formatMultiple(errors);

      expect(formattedOutput).toContain('⚙️'); // CONFIG error icon
      expect(formattedOutput).toContain('CONFIG');
      expect(formattedOutput).toContain('TS2339');
      expect(formattedOutput).toContain('src/types/User.ts:42:15');
      expect(formattedOutput).toContain('TypeScript compilation error');
      expect(formattedOutput).toContain('💡 Suggestions:');
    });

    it('should format multiple TypeScript errors with numbered list', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils/helper.ts(10,8): error TS2304: Cannot find name 'UnknownType'.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      const formattedOutput = formatter.formatMultiple(errors);

      expect(formattedOutput).toContain('2 errors found');
      expect(formattedOutput).toContain('Error 1');
      expect(formattedOutput).toContain('Error 2');
      expect(formattedOutput).toContain('TS2339');
      expect(formattedOutput).toContain('TS2304');
    });

    it('should respect verbosity levels for TypeScript errors', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

      const minimalFormatter = new ErrorFormatter(ErrorVerbosity.MINIMAL);
      const normalFormatter = new ErrorFormatter(ErrorVerbosity.NORMAL);

      const errors = minimalFormatter.parseTypeScriptErrors(tscOutput);

      const minimalOutput = minimalFormatter.format(errors[0]);
      const normalOutput = normalFormatter.format(errors[0]);

      // Minimal should not include context and suggestions
      expect(minimalOutput).not.toContain('src/types/User.ts');
      expect(minimalOutput).not.toContain('💡 Suggestions:');

      // Normal should include context and suggestions
      expect(normalOutput).toContain('src/types/User.ts');
      expect(normalOutput).toContain('💡 Suggestions:');
    });
  });

  describe('real-world TypeScript error scenarios', () => {
    it('should handle complex multi-line tsc output with warnings and errors', () => {
      const tscOutput = `Found 0 errors. Watching for file changes.

File change detected. Starting incremental compilation...

src/types/User.ts(42,15): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils/helper.ts(10,8): error TS2304: Cannot find name 'UnknownType'.

Found 2 errors. Watching for file changes.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      expect(errors).toHaveLength(2);
    });

    it('should handle tsc output with source code snippets', () => {
      const tscOutput = `src/types/User.ts:42:15 - error TS2339: Property 'foo' does not exist on type 'Bar'.

42     const value = obj.foo;
                        ~~~

Found 1 error.`;

      const errors = formatter.parseTypeScriptErrors(tscOutput);
      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('src/types/User.ts');
      expect(errors[0].context?.line).toBe(42);
      expect(errors[0].context?.column).toBe(15);
    });
  });
});