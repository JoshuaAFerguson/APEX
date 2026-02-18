import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  FormattedError,
} from '../ErrorFormatter.js';

describe('ErrorFormatter Edge Cases', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('empty and null inputs', () => {
    it('should handle empty error message', () => {
      const result = formatter.formatSimple('');
      expect(result).toContain('APPLICATION');
      expect(result).toContain('❌');
      // Should not throw and should format empty message
    });

    it('should handle undefined context gracefully', () => {
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        context: undefined,
      };

      const result = formatter.format(error);
      expect(result).toContain('Test error');
      expect(result).not.toContain('📍 Location:');
    });

    it('should handle empty suggestions array', () => {
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        suggestions: [],
      };

      const result = formatter.format(error);
      expect(result).toContain('Test error');
      expect(result).not.toContain('💡 Suggestions:');
    });

    it('should handle null originalError stack', () => {
      formatter.setVerbosity(ErrorVerbosity.VERBOSE);
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        originalError: { name: 'Error', message: 'test', stack: undefined } as Error,
      };

      const result = formatter.format(error);
      expect(result).toContain('Test error');
      expect(result).not.toContain('🔍 Stack Trace:');
    });
  });

  describe('malformed input handling', () => {
    it('should handle context with only some fields', () => {
      const partialContext: ErrorContext = {
        line: 42,
        // Missing file, column, function, description
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Error with partial context',
        context: partialContext,
      };

      const result = formatter.format(error);
      expect(result).toContain('Error with partial context');
      expect(result).not.toContain('📍 Location:'); // No file provided
      expect(result).not.toContain('⚡ Function:'); // No function provided
    });

    it('should handle context with zero line number', () => {
      const context: ErrorContext = {
        file: 'test.js',
        line: 0,
        column: 0,
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Error at line zero',
        context,
      };

      const result = formatter.format(error);
      expect(result).toContain('test.js');
      expect(result).toContain('0'); // Should handle line 0
    });

    it('should handle suggestions with only title', () => {
      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Basic suggestion',
          description: '', // Empty description
          command: undefined, // No command
        },
      ];

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        suggestions,
      };

      const result = formatter.format(error);
      expect(result).toContain('Basic suggestion');
      expect(result).not.toContain('$'); // Should not show command prompt
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(1000); // 1000 character error message
      const result = formatter.formatSimple(longMessage);
      expect(result).toContain('APPLICATION');
      expect(result).toContain(longMessage);
      expect(result.length).toBeGreaterThan(1000);
    });

    it('should handle error messages with special characters', () => {
      const specialMessage = 'Error with special chars: \n\t"quotes"\' and unicode: 🚀💥';
      const result = formatter.formatSimple(specialMessage);
      expect(result).toContain(specialMessage);
      expect(result).toContain('APPLICATION');
    });
  });

  describe('extreme stack traces', () => {
    it('should handle very long stack traces', () => {
      formatter.setVerbosity(ErrorVerbosity.VERBOSE);
      const longStackTrace = Array(100)
        .fill(0)
        .map((_, i) => `    at function${i} (file${i}.js:${i + 1}:${i + 1})`)
        .join('\n');

      const originalError = new Error('Long stack trace');
      originalError.stack = `Error: Long stack trace\n${longStackTrace}`;

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error with long stack',
        originalError,
      };

      const result = formatter.format(error);
      expect(result).toContain('🔍 Stack Trace:');
      expect(result).toContain('function0');
      expect(result).toContain('function99');
    });

    it('should handle stack traces with special characters', () => {
      formatter.setVerbosity(ErrorVerbosity.VERBOSE);
      const originalError = new Error('Unicode error');
      originalError.stack = `Error: Unicode error 🚀
    at validateUser (/path/with spaces/unicode-✓-file.ts:10:5)
    at Controller.method (C:\\Windows\\Path\\file.js:20:10)`;

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Unicode stack trace test',
        originalError,
      };

      const result = formatter.format(error);
      expect(result).toContain('🔍 Stack Trace:');
      expect(result).toContain('unicode-✓-file.ts');
      expect(result).toContain('C:\\Windows\\Path\\file.js');
    });

    it('should handle malformed stack traces', () => {
      formatter.setVerbosity(ErrorVerbosity.VERBOSE);
      const originalError = new Error('Malformed stack');
      originalError.stack = 'Not a standard stack trace format\nSome random text\nNo "at" keywords';

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Malformed stack test',
        originalError,
      };

      const result = formatter.format(error);
      expect(result).toContain('🔍 Stack Trace:');
      expect(result).toContain('Not a standard stack trace format');
    });
  });

  describe('verbosity edge cases', () => {
    it('should handle verbosity changes after formatter creation', () => {
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        context: { file: 'test.js', line: 10 },
        suggestions: [{ title: 'Fix it', description: 'Just fix it' }],
      };

      // Start with normal verbosity
      formatter.setVerbosity(ErrorVerbosity.NORMAL);
      const normalResult = formatter.format(error);
      expect(normalResult).toContain('📍 Location:');
      expect(normalResult).toContain('💡 Suggestions:');

      // Switch to minimal
      formatter.setVerbosity(ErrorVerbosity.MINIMAL);
      const minimalResult = formatter.format(error);
      expect(minimalResult).not.toContain('📍 Location:');
      expect(minimalResult).not.toContain('💡 Suggestions:');

      // Switch to verbose
      formatter.setVerbosity(ErrorVerbosity.VERBOSE);
      const verboseResult = formatter.format(error);
      expect(verboseResult).toContain('📍 Location:');
      expect(verboseResult).toContain('💡 Suggestions:');
    });
  });

  describe('multiple errors edge cases', () => {
    it('should handle array with single error', () => {
      const errors: FormattedError[] = [
        { type: ErrorType.APPLICATION, message: 'Single error' },
      ];

      const result = formatter.formatMultiple(errors);
      expect(result).toContain('Single error');
      expect(result).not.toContain('1 errors found');
    });

    it('should handle very large number of errors', () => {
      const errors: FormattedError[] = Array(50)
        .fill(0)
        .map((_, i) => ({
          type: ErrorType.APPLICATION,
          message: `Error number ${i + 1}`,
        }));

      const result = formatter.formatMultiple(errors);
      expect(result).toContain('50 errors found');
      expect(result).toContain('Error 1');
      expect(result).toContain('Error 50');
    });

    it('should handle mixed error types in multiple errors', () => {
      const errors: FormattedError[] = [
        { type: ErrorType.SYSTEM, message: 'System error' },
        { type: ErrorType.VALIDATION, message: 'Validation error' },
        { type: ErrorType.CONFIG, message: 'Config error' },
        { type: ErrorType.NETWORK, message: 'Network error' },
        { type: ErrorType.FILESYSTEM, message: 'Filesystem error' },
        { type: ErrorType.APPLICATION, message: 'Application error' },
      ];

      const result = formatter.formatMultiple(errors);
      expect(result).toContain('6 errors found');
      expect(result).toContain('💥'); // System error icon
      expect(result).toContain('⚠️'); // Validation error icon
      expect(result).toContain('⚙️'); // Config error icon
      expect(result).toContain('🌐'); // Network error icon
      expect(result).toContain('📁'); // Filesystem error icon
      expect(result).toContain('❌'); // Application error icon
    });
  });

  describe('boundary conditions', () => {
    it('should handle extremely large line numbers', () => {
      const context: ErrorContext = {
        file: 'large-file.js',
        line: Number.MAX_SAFE_INTEGER,
        column: Number.MAX_SAFE_INTEGER,
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Error at max line number',
        context,
      };

      const result = formatter.format(error);
      expect(result).toContain('large-file.js');
      expect(result).toContain(Number.MAX_SAFE_INTEGER.toString());
    });

    it('should handle very long file paths', () => {
      const longPath = '/very/long/path/that/goes/on/and/on/'.repeat(10) + 'file.js';
      const context: ErrorContext = {
        file: longPath,
        line: 1,
        function: 'testFunction',
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Error with long path',
        context,
      };

      const result = formatter.format(error);
      expect(result).toContain(longPath);
      expect(result).toContain('📍 Location:');
    });

    it('should handle very long function names', () => {
      const longFunctionName = 'veryLongFunctionNameThat'.repeat(20) + 'Function';
      const context: ErrorContext = {
        file: 'test.js',
        line: 1,
        function: longFunctionName,
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Error with long function name',
        context,
      };

      const result = formatter.format(error);
      expect(result).toContain(longFunctionName);
      expect(result).toContain('⚡ Function:');
    });
  });

  describe('fromError method edge cases', () => {
    it('should handle Error object with no stack', () => {
      const jsError = new Error('Error without stack');
      jsError.stack = undefined;

      const result = formatter.formatFromError(jsError, ErrorType.SYSTEM);
      expect(result).toContain('Error without stack');
      expect(result).toContain('💥'); // System error icon
      expect(result).not.toContain('🔍 Stack Trace:');
    });

    it('should handle Error object with empty message', () => {
      const jsError = new Error('');
      const result = formatter.formatFromError(jsError);
      expect(result).toContain('APPLICATION');
      expect(result).toContain('❌');
    });

    it('should handle custom Error types', () => {
      class CustomError extends Error {
        code = 'CUSTOM_ERROR_CODE';

        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const customError = new CustomError('Custom error occurred');
      const result = formatter.formatFromError(
        customError,
        ErrorType.APPLICATION,
        { description: 'Custom error type test' }
      );

      expect(result).toContain('Custom error occurred');
      expect(result).toContain('Custom error type test');
    });
  });

  describe('suggestion formatting edge cases', () => {
    it('should handle suggestions with very long titles', () => {
      const suggestions: ErrorSuggestion[] = [
        {
          title: 'This is a very long suggestion title that goes on and on and might wrap or cause formatting issues'.repeat(3),
          description: 'Short description',
        },
      ];

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        suggestions,
      };

      const result = formatter.format(error);
      expect(result).toContain('💡 Suggestions:');
      expect(result).toContain('This is a very long suggestion');
    });

    it('should handle suggestions with very long commands', () => {
      const longCommand = 'npm install --save-dev ' + 'very-long-package-name-'.repeat(20) + 'package';
      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Install package',
          description: 'Install the required package',
          command: longCommand,
        },
      ];

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        suggestions,
      };

      const result = formatter.format(error);
      expect(result).toContain('💡 Suggestions:');
      expect(result).toContain(longCommand);
      expect(result).toContain('$'); // Command prompt symbol
    });

    it('should handle suggestions with multiline descriptions', () => {
      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Complex solution',
          description: 'This is a multiline description\nthat spans multiple lines\nand should be handled properly',
          command: 'echo "test"',
        },
      ];

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        suggestions,
      };

      const result = formatter.format(error);
      expect(result).toContain('💡 Suggestions:');
      expect(result).toContain('Complex solution');
      expect(result).toContain('This is a multiline description');
    });
  });
});