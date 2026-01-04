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
} from '../ErrorFormatter.js';

describe('ErrorFormatter', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('constructor and verbosity', () => {
    it('should initialize with default normal verbosity', () => {
      expect(formatter['verbosity']).toBe(ErrorVerbosity.NORMAL);
    });

    it('should initialize with custom verbosity', () => {
      const verboseFormatter = new ErrorFormatter(ErrorVerbosity.VERBOSE);
      expect(verboseFormatter['verbosity']).toBe(ErrorVerbosity.VERBOSE);
    });

    it('should allow setting verbosity', () => {
      formatter.setVerbosity(ErrorVerbosity.MINIMAL);
      expect(formatter['verbosity']).toBe(ErrorVerbosity.MINIMAL);
    });
  });

  describe('formatSimple', () => {
    it('should format a simple error message with default type', () => {
      const result = formatter.formatSimple('Something went wrong');
      expect(result).toContain('APPLICATION');
      expect(result).toContain('Something went wrong');
      expect(result).toContain('❌');
    });

    it('should format with custom error type', () => {
      const result = formatter.formatSimple('Invalid input', ErrorType.VALIDATION);
      expect(result).toContain('VALIDATION');
      expect(result).toContain('Invalid input');
      expect(result).toContain('⚠️');
    });
  });

  describe('format with different error types', () => {
    it('should format system error with correct icon and color', () => {
      const error: FormattedError = {
        type: ErrorType.SYSTEM,
        message: 'System crash detected',
      };
      const result = formatter.format(error);
      expect(result).toContain('💥');
      expect(result).toContain('SYSTEM');
      expect(result).toContain('System crash detected');
    });

    it('should format validation error with correct icon', () => {
      const error: FormattedError = {
        type: ErrorType.VALIDATION,
        message: 'Invalid email format',
      };
      const result = formatter.format(error);
      expect(result).toContain('⚠️');
      expect(result).toContain('VALIDATION');
    });

    it('should format config error with correct icon', () => {
      const error: FormattedError = {
        type: ErrorType.CONFIG,
        message: 'Missing configuration file',
      };
      const result = formatter.format(error);
      expect(result).toContain('⚙️');
      expect(result).toContain('CONFIG');
    });

    it('should format network error with correct icon', () => {
      const error: FormattedError = {
        type: ErrorType.NETWORK,
        message: 'Connection timeout',
      };
      const result = formatter.format(error);
      expect(result).toContain('🌐');
      expect(result).toContain('NETWORK');
    });

    it('should format filesystem error with correct icon', () => {
      const error: FormattedError = {
        type: ErrorType.FILESYSTEM,
        message: 'File not found',
      };
      const result = formatter.format(error);
      expect(result).toContain('📁');
      expect(result).toContain('FILESYSTEM');
    });
  });

  describe('format with context', () => {
    const context: ErrorContext = {
      file: '/path/to/file.ts',
      line: 42,
      column: 15,
      function: 'processData',
      description: 'Error occurred during data validation',
    };

    it('should include context information in normal verbosity', () => {
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Processing failed',
        context,
      };

      const result = formatter.format(error);
      expect(result).toContain('/path/to/file.ts');
      expect(result).toContain('42');
      expect(result).toContain('15');
      expect(result).toContain('processData');
      expect(result).toContain('Error occurred during data validation');
      expect(result).toContain('📍 Location:');
      expect(result).toContain('⚡ Function:');
      expect(result).toContain('📝 Context:');
    });

    it('should exclude context in minimal verbosity', () => {
      formatter.setVerbosity(ErrorVerbosity.MINIMAL);
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Processing failed',
        context,
      };

      const result = formatter.format(error);
      expect(result).not.toContain('/path/to/file.ts');
      expect(result).not.toContain('processData');
      expect(result).toContain('Processing failed');
    });

    it('should handle partial context information', () => {
      const partialContext: ErrorContext = {
        file: '/path/to/file.ts',
        description: 'Something went wrong',
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Error occurred',
        context: partialContext,
      };

      const result = formatter.format(error);
      expect(result).toContain('/path/to/file.ts');
      expect(result).toContain('Something went wrong');
      expect(result).not.toContain('⚡ Function:'); // No function provided
    });
  });

  describe('format with suggestions', () => {
    const suggestions: ErrorSuggestion[] = [
      {
        title: 'Check file permissions',
        description: 'Ensure the file is readable and writable',
        command: 'chmod 644 file.txt',
      },
      {
        title: 'Verify file exists',
        description: 'Make sure the target file exists',
      },
    ];

    it('should include suggestions in normal verbosity', () => {
      const error: FormattedError = {
        type: ErrorType.FILESYSTEM,
        message: 'Cannot access file',
        suggestions,
      };

      const result = formatter.format(error);
      expect(result).toContain('💡 Suggestions:');
      expect(result).toContain('1. Check file permissions');
      expect(result).toContain('2. Verify file exists');
      expect(result).toContain('Ensure the file is readable and writable');
      expect(result).toContain('chmod 644 file.txt');
    });

    it('should exclude suggestions in minimal verbosity', () => {
      formatter.setVerbosity(ErrorVerbosity.MINIMAL);
      const error: FormattedError = {
        type: ErrorType.FILESYSTEM,
        message: 'Cannot access file',
        suggestions,
      };

      const result = formatter.format(error);
      expect(result).not.toContain('💡 Suggestions:');
      expect(result).not.toContain('Check file permissions');
    });

    it('should handle suggestions without commands', () => {
      const simplesuggestions: ErrorSuggestion[] = [
        {
          title: 'Restart the application',
          description: 'Try restarting to clear any temporary issues',
        },
      ];

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Unexpected error',
        suggestions: simplesuggestions,
      };

      const result = formatter.format(error);
      expect(result).toContain('Restart the application');
      expect(result).toContain('Try restarting to clear any temporary issues');
    });
  });

  describe('format with stack trace', () => {
    it('should include stack trace in verbose mode', () => {
      formatter.setVerbosity(ErrorVerbosity.VERBOSE);
      const originalError = new Error('Test error');
      originalError.stack = 'Error: Test error\n    at test.js:10:5\n    at run.js:20:10';

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error occurred',
        originalError,
      };

      const result = formatter.format(error);
      expect(result).toContain('🔍 Stack Trace:');
      expect(result).toContain('at test.js:10:5');
      expect(result).toContain('at run.js:20:10');
    });

    it('should exclude stack trace in normal mode', () => {
      const originalError = new Error('Test error');
      originalError.stack = 'Error: Test error\n    at test.js:10:5';

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error occurred',
        originalError,
      };

      const result = formatter.format(error);
      expect(result).not.toContain('🔍 Stack Trace:');
      expect(result).not.toContain('at test.js:10:5');
    });
  });

  describe('formatFromError', () => {
    it('should create formatted error from Error object', () => {
      const jsError = new Error('JavaScript error');
      const context: ErrorContext = { file: 'test.js', line: 10 };
      const suggestions: ErrorSuggestion[] = [
        { title: 'Fix syntax', description: 'Check for typos' },
      ];

      const result = formatter.formatFromError(
        jsError,
        ErrorType.APPLICATION,
        context,
        suggestions
      );

      expect(result).toContain('JavaScript error');
      expect(result).toContain('test.js');
      expect(result).toContain('Fix syntax');
    });

    it('should use default application type when none specified', () => {
      const jsError = new Error('Default type test');
      const result = formatter.formatFromError(jsError);
      expect(result).toContain('APPLICATION');
      expect(result).toContain('Default type test');
    });
  });

  describe('formatMultiple', () => {
    it('should handle empty error array', () => {
      const result = formatter.formatMultiple([]);
      expect(result).toBe('');
    });

    it('should format single error normally', () => {
      const errors: FormattedError[] = [
        { type: ErrorType.VALIDATION, message: 'Single error' },
      ];

      const result = formatter.formatMultiple(errors);
      expect(result).toContain('VALIDATION');
      expect(result).toContain('Single error');
      expect(result).not.toContain('1 errors found');
    });

    it('should format multiple errors with numbered list', () => {
      const errors: FormattedError[] = [
        { type: ErrorType.VALIDATION, message: 'First error' },
        { type: ErrorType.CONFIG, message: 'Second error' },
      ];

      const result = formatter.formatMultiple(errors);
      expect(result).toContain('2 errors found');
      expect(result).toContain('Error 1');
      expect(result).toContain('Error 2');
      expect(result).toContain('First error');
      expect(result).toContain('Second error');
    });
  });

  describe('convenience formatError functions', () => {
    it('should format system error', () => {
      const result = formatError.system('System failure');
      expect(result).toContain('💥');
      expect(result).toContain('SYSTEM');
      expect(result).toContain('System failure');
    });

    it('should format validation error with context', () => {
      const context: ErrorContext = { file: 'input.ts', line: 5 };
      const result = formatError.validation('Invalid data', context);
      expect(result).toContain('⚠️');
      expect(result).toContain('VALIDATION');
      expect(result).toContain('input.ts');
    });

    it('should format config error with suggestions', () => {
      const suggestions: ErrorSuggestion[] = [
        { title: 'Check config file', description: 'Verify syntax' },
      ];
      const result = formatError.config('Missing config', undefined, suggestions);
      expect(result).toContain('CONFIG');
      expect(result).toContain('Check config file');
    });

    it('should format network error', () => {
      const result = formatError.network('Connection failed');
      expect(result).toContain('🌐');
      expect(result).toContain('NETWORK');
    });

    it('should format filesystem error', () => {
      const result = formatError.filesystem('File not found');
      expect(result).toContain('📁');
      expect(result).toContain('FILESYSTEM');
    });

    it('should format application error', () => {
      const result = formatError.application('App crashed');
      expect(result).toContain('❌');
      expect(result).toContain('APPLICATION');
    });
  });

  describe('default error formatter', () => {
    it('should provide default instance', () => {
      expect(defaultErrorFormatter).toBeInstanceOf(ErrorFormatter);
    });

    it('should have normal verbosity by default', () => {
      expect(defaultErrorFormatter['verbosity']).toBe(ErrorVerbosity.NORMAL);
    });
  });

  describe('parseTypeScriptErrors method', () => {
    it('should have parseTypeScriptErrors method', () => {
      expect(typeof formatter.parseTypeScriptErrors).toBe('function');
    });

    it('should parse a simple TypeScript error', () => {
      const tscOutput = `src/test.ts(1,1): error TS2339: Property 'test' does not exist on type 'object'.`;
      const errors = formatter.parseTypeScriptErrors(tscOutput);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(ErrorType.CONFIG);
      expect(errors[0].message).toContain('TS2339');
      expect(errors[0].context?.file).toBe('src/test.ts');
      expect(errors[0].context?.line).toBe(1);
      expect(errors[0].context?.column).toBe(1);
    });
  });
});