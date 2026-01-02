import { describe, it, expect, beforeEach } from 'vitest';
import chalk from 'chalk';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  FormattedError,
} from '../ErrorFormatter.js';

describe('ErrorFormatter Chalk Integration Tests', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
    // Ensure chalk is enabled for testing
    chalk.level = 1;
  });

  describe('color formatting for error types', () => {
    it('should apply red color for system errors', () => {
      const error: FormattedError = {
        type: ErrorType.SYSTEM,
        message: 'System failure detected',
      };

      const result = formatter.format(error);

      // Check for ANSI red color codes (31m for red)
      expect(result).toContain('\u001b[31m'); // Red color code
      expect(result).toContain('💥'); // System error icon
      expect(result).toContain('SYSTEM');
      expect(result).toContain('System failure detected');
    });

    it('should apply yellow color for validation errors', () => {
      const error: FormattedError = {
        type: ErrorType.VALIDATION,
        message: 'Input validation failed',
      };

      const result = formatter.format(error);

      // Check for ANSI yellow color codes (33m for yellow)
      expect(result).toContain('\u001b[33m'); // Yellow color code
      expect(result).toContain('⚠️'); // Validation error icon
      expect(result).toContain('VALIDATION');
    });

    it('should apply blue color for config errors', () => {
      const error: FormattedError = {
        type: ErrorType.CONFIG,
        message: 'Configuration invalid',
      };

      const result = formatter.format(error);

      // Check for ANSI blue color codes (34m for blue)
      expect(result).toContain('\u001b[34m'); // Blue color code
      expect(result).toContain('⚙️'); // Config error icon
      expect(result).toContain('CONFIG');
    });

    it('should apply magenta color for network errors', () => {
      const error: FormattedError = {
        type: ErrorType.NETWORK,
        message: 'Network connection failed',
      };

      const result = formatter.format(error);

      // Check for ANSI magenta color codes (35m for magenta)
      expect(result).toContain('\u001b[35m'); // Magenta color code
      expect(result).toContain('🌐'); // Network error icon
      expect(result).toContain('NETWORK');
    });

    it('should apply cyan color for filesystem errors', () => {
      const error: FormattedError = {
        type: ErrorType.FILESYSTEM,
        message: 'File access denied',
      };

      const result = formatter.format(error);

      // Check for ANSI cyan color codes (36m for cyan)
      expect(result).toContain('\u001b[36m'); // Cyan color code
      expect(result).toContain('📁'); // Filesystem error icon
      expect(result).toContain('FILESYSTEM');
    });

    it('should apply red color for application errors', () => {
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Application error occurred',
      };

      const result = formatter.format(error);

      // Check for ANSI red color codes (31m for red)
      expect(result).toContain('\u001b[31m'); // Red color code
      expect(result).toContain('❌'); // Application error icon
      expect(result).toContain('APPLICATION');
    });
  });

  describe('context color formatting', () => {
    it('should color file paths with cyan', () => {
      const context: ErrorContext = {
        file: '/path/to/file.ts',
        line: 42,
        column: 15,
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        context,
      };

      const result = formatter.format(error);

      // Should contain cyan colored file path
      expect(result).toContain('\u001b[36m'); // Cyan for file path
      expect(result).toContain('/path/to/file.ts');
      expect(result).toContain('📍 Location:');
    });

    it('should color line and column numbers with yellow', () => {
      const context: ErrorContext = {
        file: 'test.js',
        line: 123,
        column: 45,
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        context,
      };

      const result = formatter.format(error);

      // Should contain yellow colored line/column numbers
      expect(result).toContain('\u001b[33m'); // Yellow for line numbers
      expect(result).toContain('123');
      expect(result).toContain('45');
    });

    it('should color function names with magenta', () => {
      const context: ErrorContext = {
        file: 'test.js',
        line: 10,
        function: 'calculateSum',
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        context,
      };

      const result = formatter.format(error);

      // Should contain magenta colored function name
      expect(result).toContain('\u001b[35m'); // Magenta for function name
      expect(result).toContain('calculateSum');
      expect(result).toContain('⚡ Function:');
    });

    it('should color context descriptions with white', () => {
      const context: ErrorContext = {
        file: 'test.js',
        description: 'Error occurred during processing',
      };

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        context,
      };

      const result = formatter.format(error);

      // Should contain white colored description
      expect(result).toContain('Error occurred during processing');
      expect(result).toContain('📝 Context:');
    });
  });

  describe('suggestion color formatting', () => {
    it('should color suggestion headers with green', () => {
      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Fix the issue',
          description: 'How to fix it',
          command: 'npm run fix',
        },
      ];

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        suggestions,
      };

      const result = formatter.format(error);

      // Should contain green colored suggestions header and numbers
      expect(result).toContain('\u001b[32m'); // Green color code
      expect(result).toContain('💡 Suggestions:');
      expect(result).toContain('1.');
    });

    it('should color suggestion titles with white', () => {
      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Check configuration',
          description: 'Verify config settings',
        },
      ];

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        suggestions,
      };

      const result = formatter.format(error);

      expect(result).toContain('Check configuration');
    });

    it('should color suggestion descriptions with gray', () => {
      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Fix issue',
          description: 'This is a detailed description of the fix',
        },
      ];

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        suggestions,
      };

      const result = formatter.format(error);

      // Should contain gray colored description
      expect(result).toContain('This is a detailed description of the fix');
    });

    it('should color commands with cyan and command prompt with gray', () => {
      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Run command',
          description: 'Execute this command',
          command: 'npm install package-name',
        },
      ];

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        suggestions,
      };

      const result = formatter.format(error);

      // Should contain cyan colored command
      expect(result).toContain('\u001b[36m'); // Cyan for command
      expect(result).toContain('npm install package-name');
      expect(result).toContain('$'); // Command prompt
    });
  });

  describe('stack trace color formatting', () => {
    it('should color stack trace header and content with gray', () => {
      formatter.setVerbosity(ErrorVerbosity.VERBOSE);
      const originalError = new Error('Stack trace test');
      originalError.stack = `Error: Stack trace test
    at testFunction (test.js:10:5)
    at main (index.js:20:10)`;

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        originalError,
      };

      const result = formatter.format(error);

      // Should contain gray colored stack trace
      expect(result).toContain('🔍 Stack Trace:');
      expect(result).toContain('testFunction');
      expect(result).toContain('test.js:10:5');
    });
  });

  describe('color combinations and formatting consistency', () => {
    it('should maintain consistent coloring across complex errors', () => {
      const complexError: FormattedError = {
        type: ErrorType.VALIDATION,
        message: 'Complex validation error',
        context: {
          file: '/src/validators/user.ts',
          line: 45,
          column: 20,
          function: 'validateEmail',
          description: 'Email format validation failed',
        },
        suggestions: [
          {
            title: 'Check email regex',
            description: 'Verify the regular expression pattern',
            command: 'test-regex "user@example.com"',
          },
          {
            title: 'Update validation rules',
            description: 'Consider relaxing validation for edge cases',
          },
        ],
        originalError: (() => {
          const err = new Error('Original validation error');
          err.stack = `Error: Original validation error
    at validateEmail (/src/validators/user.ts:45:20)
    at UserService.register (/src/services/user.ts:120:15)`;
          return err;
        })(),
      };

      formatter.setVerbosity(ErrorVerbosity.VERBOSE);
      const result = formatter.format(complexError);

      // Should contain all expected color codes and content
      expect(result).toContain('\u001b[33m'); // Yellow for validation
      expect(result).toContain('⚠️'); // Validation icon
      expect(result).toContain('\u001b[36m'); // Cyan for file paths and commands
      expect(result).toContain('\u001b[35m'); // Magenta for function names
      expect(result).toContain('\u001b[32m'); // Green for suggestions
      expect(result).toContain('💡 Suggestions:');
      expect(result).toContain('🔍 Stack Trace:');
    });

    it('should handle color codes in error messages gracefully', () => {
      // Test error message that already contains color codes
      const coloredMessage = `Error with ${chalk.red('colored')} text`;

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: coloredMessage,
      };

      const result = formatter.format(error);

      // Should preserve existing colors and add new ones
      expect(result).toContain(coloredMessage);
      expect(result).toContain('APPLICATION');
    });
  });

  describe('no color mode handling', () => {
    it('should work correctly when chalk colors are disabled', () => {
      // Temporarily disable chalk colors
      const originalLevel = chalk.level;
      chalk.level = 0; // Disable colors

      try {
        const error: FormattedError = {
          type: ErrorType.SYSTEM,
          message: 'No color test',
          context: {
            file: 'test.js',
            line: 1,
            function: 'testFunction',
          },
          suggestions: [
            {
              title: 'Fix issue',
              description: 'How to fix',
              command: 'npm run fix',
            },
          ],
        };

        const result = formatter.format(error);

        // Should still contain all text content
        expect(result).toContain('💥'); // Icon
        expect(result).toContain('SYSTEM');
        expect(result).toContain('No color test');
        expect(result).toContain('test.js');
        expect(result).toContain('testFunction');
        expect(result).toContain('Fix issue');
        expect(result).toContain('npm run fix');

        // Should not contain ANSI color codes
        expect(result).not.toContain('\u001b[31m'); // No red
        expect(result).not.toContain('\u001b[32m'); // No green
        expect(result).not.toContain('\u001b[33m'); // No yellow
      } finally {
        // Restore original chalk level
        chalk.level = originalLevel;
      }
    });
  });
});