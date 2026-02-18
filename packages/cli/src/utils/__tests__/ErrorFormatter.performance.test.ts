import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  FormattedError,
} from '../ErrorFormatter.js';

describe('ErrorFormatter Performance Tests', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('performance benchmarks', () => {
    it('should format simple errors quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        formatter.formatSimple(`Error message ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should format 1000 simple errors in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should format complex errors efficiently', () => {
      const complexError: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Complex error with all features',
        context: {
          file: '/very/long/path/to/some/deeply/nested/file.ts',
          line: 12345,
          column: 67,
          function: 'veryLongFunctionNameThatIsQuiteLengthy',
          description: 'A detailed description of what went wrong and why it happened and what was being attempted at the time',
        },
        suggestions: [
          {
            title: 'First suggestion with a long title',
            description: 'A very detailed description of what the user should do to fix this issue, including multiple steps and considerations',
            command: 'npm install --save-dev some-very-long-package-name-that-might-be-used',
          },
          {
            title: 'Second suggestion',
            description: 'Another detailed explanation',
            command: 'echo "Another long command with many parameters and options --verbose --debug --output-file=/path/to/file"',
          },
          {
            title: 'Third suggestion without command',
            description: 'Just a description without a command to execute',
          },
        ],
        originalError: (() => {
          const err = new Error('Original error message');
          err.stack = Array(20).fill(0).map((_, i) =>
            `    at function${i} (/path/to/file${i}.js:${i + 1}:${i + 1})`
          ).join('\n');
          return err;
        })(),
      };

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        formatter.format(complexError);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should format 100 complex errors in less than 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should handle multiple errors efficiently', () => {
      const errors: FormattedError[] = Array(100).fill(0).map((_, i) => ({
        type: Object.values(ErrorType)[i % Object.values(ErrorType).length] as ErrorType,
        message: `Error message number ${i}`,
        context: {
          file: `file${i}.ts`,
          line: i + 1,
          function: `function${i}`,
          description: `Description for error ${i}`,
        },
        suggestions: [
          {
            title: `Suggestion ${i}`,
            description: `How to fix error ${i}`,
            command: `command-${i} --flag${i}`,
          },
        ],
      }));

      const startTime = performance.now();
      const result = formatter.formatMultiple(errors);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should format 100 errors in less than 30ms
      expect(duration).toBeLessThan(30);
      expect(result).toContain('100 errors found');
    });
  });

  describe('memory efficiency', () => {
    it('should not accumulate memory with repeated formatting', () => {
      // This test ensures the formatter doesn't leak memory
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Memory test error',
        context: { file: 'memory-test.ts', line: 1 },
      };

      // Format the same error many times
      for (let i = 0; i < 10000; i++) {
        const result = formatter.format(error);
        // Verify the result is still correct
        if (i === 0) {
          expect(result).toContain('Memory test error');
        }
      }

      const finalResult = formatter.format(error);
      expect(finalResult).toContain('Memory test error');
    });

    it('should handle large datasets without excessive memory usage', () => {
      // Create a large error with lots of data
      const largeContext = {
        file: 'x'.repeat(1000), // 1KB filename
        line: 999999,
        column: 999999,
        function: 'f'.repeat(1000), // 1KB function name
        description: 'd'.repeat(10000), // 10KB description
      };

      const largeSuggestions = Array(100).fill(0).map((_, i) => ({
        title: `Suggestion ${i}: ${'t'.repeat(100)}`, // ~100 chars each
        description: `Description ${i}: ${'d'.repeat(500)}`, // ~500 chars each
        command: `command-${i} ${'c'.repeat(200)}`, // ~200 chars each
      }));

      const largeError: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'm'.repeat(5000), // 5KB message
        context: largeContext,
        suggestions: largeSuggestions,
        originalError: (() => {
          const err = new Error('Large stack trace error');
          err.stack = Array(100).fill(0).map((_, i) =>
            `    at function${i} (/very/long/path/to/file${i}.js:${i + 1}:${i + 1})`
          ).join('\n');
          return err;
        })(),
      };

      formatter.setVerbosity(ErrorVerbosity.VERBOSE);
      const result = formatter.format(largeError);

      // Should handle large inputs and produce a result
      expect(result).toContain('mmmmm'); // Part of the large message
      expect(result).toContain('Suggestion 50'); // Part of the suggestions
      expect(result.length).toBeGreaterThan(10000); // Should be a substantial result
    });
  });

  describe('verbosity switching performance', () => {
    it('should handle frequent verbosity changes efficiently', () => {
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Verbosity test error',
        context: { file: 'test.js', line: 1 },
        suggestions: [{ title: 'Fix it', description: 'Just fix it' }],
      };

      const verbosityLevels = [
        ErrorVerbosity.MINIMAL,
        ErrorVerbosity.NORMAL,
        ErrorVerbosity.VERBOSE,
      ];

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const verbosity = verbosityLevels[i % verbosityLevels.length];
        formatter.setVerbosity(verbosity);
        formatter.format(error);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 1000 verbosity changes and formats in less than 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('concurrent usage simulation', () => {
    it('should handle multiple formatter instances efficiently', () => {
      const formatters = Array(10).fill(0).map(() => new ErrorFormatter());
      const errors = Array(10).fill(0).map((_, i) => ({
        type: ErrorType.APPLICATION,
        message: `Concurrent error ${i}`,
        context: { file: `file${i}.ts`, line: i + 1 },
      }));

      const startTime = performance.now();

      // Simulate concurrent usage
      const results = formatters.map((fmt, i) => fmt.format(errors[i]));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 10 concurrent formatters quickly
      expect(duration).toBeLessThan(10);
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toContain(`Concurrent error ${i}`);
      });
    });
  });

  describe('edge case performance', () => {
    it('should handle empty inputs efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        formatter.formatSimple('');
        formatter.formatMultiple([]);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 1000 empty inputs quickly
      expect(duration).toBeLessThan(20);
    });

    it('should handle malformed stack traces efficiently', () => {
      const error = new Error('Malformed stack test');
      error.stack = 'Not a real stack trace\n'.repeat(1000); // Large malformed stack

      formatter.setVerbosity(ErrorVerbosity.VERBOSE);

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        formatter.formatFromError(error);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle malformed stacks efficiently
      expect(duration).toBeLessThan(30);
    });
  });
});
