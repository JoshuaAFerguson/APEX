import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  FormattedError,
  defaultErrorFormatter,
  formatError,
  parseTypeScriptErrors,
} from '../ErrorFormatter.js';

/**
 * Test Coverage Validation
 *
 * This test suite validates that all requirements from the acceptance criteria
 * are met and that the implementation is complete and robust.
 */
describe('ErrorFormatter - Complete Coverage Validation', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('Requirement 1: TypeScript Error Parsing', () => {
    it('validates all TypeScript error format parsing is working', () => {
      const testOutputs = [
        // Format 1: file(line,col): error TSxxxx: message
        `src/components/App.tsx(25,10): error TS2339: Property 'userInfo' does not exist on type 'Props'.`,

        // Format 2: file:line:col - error TSxxxx: message
        `src/utils/api.ts:45:12 - error TS2304: Cannot find name 'fetch'.`,

        // Complex real-world output
        `Found 0 errors. Watching for file changes.
File change detected. Starting incremental compilation...
src/types/User.ts(15,8): error TS2322: Type 'string' is not assignable to type 'number'.
src/hooks/useAuth.ts:22:5 - error TS2307: Cannot find module 'react-query'.
Found 2 errors. Watching for file changes.`
      ];

      testOutputs.forEach((output, index) => {
        const errors = formatter.parseTypeScriptErrors(output);
        expect(errors.length).toBeGreaterThan(0, `Test output ${index} should parse errors`);

        errors.forEach(error => {
          // Validate structure
          expect(error.type).toBe(ErrorType.CONFIG);
          expect(error.message).toMatch(/TS\d{4}/); // Has error code
          expect(error.context?.file).toBeDefined();
          expect(error.context?.line).toBeGreaterThan(0);
          expect(error.context?.column).toBeGreaterThan(0);
          expect(error.suggestions).toBeDefined();
          expect(error.suggestions!.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Requirement 2: Structured Error Objects', () => {
    it('validates FormattedError structure is complete', () => {
      const tscOutput = `src/test.ts(10,5): error TS2339: Property 'test' does not exist on type 'TestType'.`;
      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      const error = errors[0];

      // Required FormattedError properties
      expect(error).toMatchObject({
        type: expect.any(String),
        message: expect.any(String),
        context: expect.objectContaining({
          file: expect.any(String),
          line: expect.any(Number),
          column: expect.any(Number),
          description: expect.any(String)
        }),
        suggestions: expect.arrayContaining([
          expect.objectContaining({
            title: expect.any(String),
            description: expect.any(String)
          })
        ])
      });
    });

    it('validates intelligent suggestion generation', () => {
      const errorCodes = [
        { code: 'TS2339', output: `src/test.ts(1,1): error TS2339: Property 'missing' does not exist on type 'Test'.` },
        { code: 'TS2304', output: `src/test.ts(1,1): error TS2304: Cannot find name 'Unknown'.` },
        { code: 'TS2307', output: `src/test.ts(1,1): error TS2307: Cannot find module 'missing-package'.` },
        { code: 'TS2322', output: `src/test.ts(1,1): error TS2322: Type 'string' is not assignable to type 'number'.` },
        { code: 'TS2345', output: `src/test.ts(1,1): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.` }
      ];

      errorCodes.forEach(({ code, output }) => {
        const errors = formatter.parseTypeScriptErrors(output);
        expect(errors).toHaveLength(1);

        const suggestions = errors[0].suggestions || [];
        expect(suggestions.length).toBeGreaterThan(0, `${code} should have suggestions`);

        // Each suggestion should have title and description
        suggestions.forEach(suggestion => {
          expect(suggestion.title).toBeTruthy();
          expect(suggestion.description).toBeTruthy();
        });
      });
    });
  });

  describe('Requirement 3: Single and Multiple Error Handling', () => {
    it('handles single errors correctly', () => {
      const singleError = `src/single.ts(1,1): error TS2339: Property 'prop' does not exist on type 'Type'.`;
      const errors = formatter.parseTypeScriptErrors(singleError);

      expect(errors).toHaveLength(1);
      expect(errors[0].context?.file).toBe('src/single.ts');
    });

    it('handles multiple errors correctly', () => {
      const multipleErrors = `
        src/file1.ts(1,1): error TS2339: Property 'prop1' does not exist on type 'Type1'.
        src/file2.ts(2,2): error TS2304: Cannot find name 'Name2'.
        src/file3.ts:3:3 - error TS2307: Cannot find module 'module3'.
      `;

      const errors = formatter.parseTypeScriptErrors(multipleErrors);
      expect(errors).toHaveLength(3);

      expect(errors[0].context?.file).toBe('src/file1.ts');
      expect(errors[1].context?.file).toBe('src/file2.ts');
      expect(errors[2].context?.file).toBe('src/file3.ts');
    });

    it('avoids duplicates in mixed format errors', () => {
      const mixedFormat = `
        src/same.ts(10,5): error TS2339: Property 'prop' does not exist on type 'Type'.
        src/same.ts:10:5 - error TS2339: Property 'prop' does not exist on type 'Type'.
        src/different.ts(20,10): error TS2304: Cannot find name 'Name'.
      `;

      const errors = formatter.parseTypeScriptErrors(mixedFormat);
      expect(errors).toHaveLength(2); // Should deduplicate the first error
    });
  });

  describe('Requirement 4: Edge Cases', () => {
    const edgeCases = [
      { name: 'Empty input', input: '', expectedLength: 0 },
      { name: 'No errors', input: 'tsc completed successfully', expectedLength: 0 },
      { name: 'Whitespace only', input: '   \n\t  ', expectedLength: 0 },
      { name: 'Invalid format lines', input: 'not an error\nsome random text', expectedLength: 0 },
    ];

    edgeCases.forEach(({ name, input, expectedLength }) => {
      it(`handles ${name}`, () => {
        const errors = formatter.parseTypeScriptErrors(input);
        expect(errors).toHaveLength(expectedLength);
      });
    });

    it('handles various file path formats', () => {
      const pathFormats = [
        'src/simple.ts(1,1): error TS2339: Test.',
        '/absolute/path/file.ts(1,1): error TS2339: Test.',
        'C:\\Windows\\Path\\file.ts(1,1): error TS2339: Test.',
        'src/path with spaces/file.ts(1,1): error TS2339: Test.',
        '../relative/path/file.ts(1,1): error TS2339: Test.',
      ];

      pathFormats.forEach((pathFormat, index) => {
        const errors = formatter.parseTypeScriptErrors(pathFormat);
        expect(errors).toHaveLength(1, `Path format ${index} should parse`);
        expect(errors[0].context?.file).toBeTruthy();
      });
    });
  });

  describe('Requirement 5: Integration with ErrorFormatter', () => {
    it('formats parsed TypeScript errors correctly', () => {
      const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'username' does not exist on type 'User'.`;
      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      const formatted = formatter.format(errors[0]);

      // Should contain all expected visual elements
      expect(formatted).toContain('⚙️'); // CONFIG icon
      expect(formatted).toContain('CONFIG');
      expect(formatted).toContain('TS2339');
      expect(formatted).toContain('username');
      expect(formatted).toContain('src/types/User.ts');
      expect(formatted).toContain('42');
      expect(formatted).toContain('15');
      expect(formatted).toContain('💡 Suggestions:');
    });

    it('respects verbosity levels for TypeScript errors', () => {
      const tscOutput = `src/test.ts(1,1): error TS2339: Property 'test' does not exist on type 'Type'.`;
      const errors = parseTypeScriptErrors(tscOutput);

      const minimalFormatter = new ErrorFormatter(ErrorVerbosity.MINIMAL);
      const normalFormatter = new ErrorFormatter(ErrorVerbosity.NORMAL);
      const verboseFormatter = new ErrorFormatter(ErrorVerbosity.VERBOSE);

      const minimalOutput = minimalFormatter.format(errors[0]);
      const normalOutput = normalFormatter.format(errors[0]);
      const verboseOutput = verboseFormatter.format(errors[0]);

      // Minimal should be shortest
      expect(minimalOutput.length).toBeLessThan(normalOutput.length);
      expect(normalOutput.length).toBeLessThan(verboseOutput.length);

      // Minimal shouldn't include context
      expect(minimalOutput).not.toContain('📍 Location:');
      expect(minimalOutput).not.toContain('💡 Suggestions:');

      // Normal and verbose should include context
      expect(normalOutput).toContain('📍 Location:');
      expect(normalOutput).toContain('💡 Suggestions:');
      expect(verboseOutput).toContain('📍 Location:');
      expect(verboseOutput).toContain('💡 Suggestions:');
    });
  });

  describe('Requirement 6: API Completeness', () => {
    it('validates all expected exports are available', () => {
      // Enums
      expect(ErrorVerbosity.MINIMAL).toBeDefined();
      expect(ErrorVerbosity.NORMAL).toBeDefined();
      expect(ErrorVerbosity.VERBOSE).toBeDefined();

      expect(ErrorType.SYSTEM).toBeDefined();
      expect(ErrorType.VALIDATION).toBeDefined();
      expect(ErrorType.CONFIG).toBeDefined();
      expect(ErrorType.NETWORK).toBeDefined();
      expect(ErrorType.FILESYSTEM).toBeDefined();
      expect(ErrorType.APPLICATION).toBeDefined();

      // Classes
      expect(ErrorFormatter).toBeDefined();
      expect(defaultErrorFormatter).toBeInstanceOf(ErrorFormatter);

      // Functions
      expect(typeof parseTypeScriptErrors).toBe('function');
      expect(typeof formatError.system).toBe('function');
      expect(typeof formatError.validation).toBe('function');
      expect(typeof formatError.config).toBe('function');
      expect(typeof formatError.network).toBe('function');
      expect(typeof formatError.filesystem).toBe('function');
      expect(typeof formatError.application).toBe('function');
    });

    it('validates ErrorFormatter constructor and methods', () => {
      const fmt = new ErrorFormatter(ErrorVerbosity.VERBOSE);

      // Methods should exist
      expect(typeof fmt.setVerbosity).toBe('function');
      expect(typeof fmt.format).toBe('function');
      expect(typeof fmt.formatSimple).toBe('function');
      expect(typeof fmt.formatFromError).toBe('function');
      expect(typeof fmt.formatMultiple).toBe('function');
      expect(typeof fmt.parseTypeScriptErrors).toBe('function');

      // Methods should work
      fmt.setVerbosity(ErrorVerbosity.MINIMAL);

      const simpleResult = fmt.formatSimple('test');
      expect(typeof simpleResult).toBe('string');
      expect(simpleResult.length).toBeGreaterThan(0);

      const errorResult = fmt.formatFromError(new Error('test'));
      expect(typeof errorResult).toBe('string');
      expect(errorResult.length).toBeGreaterThan(0);

      const multipleResult = fmt.formatMultiple([]);
      expect(typeof multipleResult).toBe('string');

      const tsResult = fmt.parseTypeScriptErrors('src/test.ts(1,1): error TS2339: Test.');
      expect(Array.isArray(tsResult)).toBe(true);
    });
  });

  describe('Requirement 7: Performance and Stability', () => {
    it('handles large TypeScript output efficiently', () => {
      // Generate large tsc output
      const largeOutput = Array(100).fill(0).map((_, i) =>
        `src/file${i}.ts(${i+1},${i+1}): error TS2339: Property 'prop${i}' does not exist on type 'Type${i}'.`
      ).join('\n');

      const startTime = performance.now();
      const errors = formatter.parseTypeScriptErrors(largeOutput);
      const endTime = performance.now();

      expect(errors).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should process quickly
    });

    it('maintains consistency across repeated calls', () => {
      const tscOutput = `src/test.ts(1,1): error TS2339: Property 'test' does not exist on type 'Type'.`;

      const results = Array(10).fill(0).map(() =>
        formatter.parseTypeScriptErrors(tscOutput)
      );

      // All results should be identical
      results.forEach((result, index) => {
        expect(result).toEqual(results[0], `Call ${index} should match first call`);
      });
    });
  });
});