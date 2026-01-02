import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  FormattedError,
} from '../ErrorFormatter.js';

describe('ErrorFormatter Output Formatting', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('Basic Error Output Structure', () => {
    it('should format error with icon, type, and message in header', () => {
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error message',
      };

      const result = formatter.format(error);
      const lines = result.split('\n');

      // Should have header line with icon, type, and message
      expect(lines[0]).toMatch(/❌\s+APPLICATION\s+Test error message/);
      expect(lines.length).toBe(1); // Only header for simple error
    });

    it('should format error with all sections in correct order', () => {
      const context: ErrorContext = {
        file: '/path/to/file.ts',
        line: 42,
        function: 'testFunction',
        description: 'Error context description',
      };

      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Fix the issue',
          description: 'Try this solution',
          command: 'npm run fix',
        },
      ];

      const error: FormattedError = {
        type: ErrorType.VALIDATION,
        message: 'Validation failed',
        context,
        suggestions,
      };

      const result = formatter.format(error);
      const sections = result.split('\n\n');

      // Should have 3 sections: header, context, suggestions
      expect(sections).toHaveLength(3);

      // Section 1: Header
      expect(sections[0]).toMatch(/⚠️\s+VALIDATION\s+Validation failed/);

      // Section 2: Context
      expect(sections[1]).toContain('📍 Location:');
      expect(sections[1]).toContain('/path/to/file.ts:42');
      expect(sections[1]).toContain('⚡ Function:');
      expect(sections[1]).toContain('testFunction');
      expect(sections[1]).toContain('📝 Context:');
      expect(sections[1]).toContain('Error context description');

      // Section 3: Suggestions
      expect(sections[2]).toContain('💡 Suggestions:');
      expect(sections[2]).toContain('1. Fix the issue');
      expect(sections[2]).toContain('Try this solution');
      expect(sections[2]).toContain('$ npm run fix');
    });
  });

  describe('Formatting with Suggestions', () => {
    it('should format single suggestion with all components', () => {
      const error: FormattedError = {
        type: ErrorType.CONFIG,
        message: 'Configuration error',
        suggestions: [
          {
            title: 'Update configuration',
            description: 'Modify the config file to fix this issue',
            command: 'edit config.yaml',
          },
        ],
      };

      const result = formatter.format(error);

      // Should contain suggestion header
      expect(result).toContain('💡 Suggestions:');

      // Should contain numbered suggestion
      expect(result).toMatch(/1\.\s+Update configuration/);

      // Should contain description indented
      expect(result).toMatch(/\s+Modify the config file to fix this issue/);

      // Should contain command with $ prefix
      expect(result).toMatch(/\$\s+edit config\.yaml/);
    });

    it('should format multiple suggestions with proper spacing', () => {
      const error: FormattedError = {
        type: ErrorType.FILESYSTEM,
        message: 'File operation failed',
        suggestions: [
          {
            title: 'Check permissions',
            description: 'Verify file permissions are correct',
            command: 'chmod 755 file.txt',
          },
          {
            title: 'Check file exists',
            description: 'Ensure the file exists at the specified path',
          },
          {
            title: 'Restart service',
            description: 'Try restarting the related service',
            command: 'sudo systemctl restart service',
          },
        ],
      };

      const result = formatter.format(error);
      const suggestionSection = result.split('\n\n').pop() || '';

      // Should have proper numbering
      expect(suggestionSection).toMatch(/1\.\s+Check permissions/);
      expect(suggestionSection).toMatch(/2\.\s+Check file exists/);
      expect(suggestionSection).toMatch(/3\.\s+Restart service/);

      // Should have proper spacing between suggestions
      const lines = suggestionSection.split('\n');
      let emptyLineCount = 0;
      for (const line of lines) {
        if (line.trim() === '') emptyLineCount++;
      }
      expect(emptyLineCount).toBe(2); // Two empty lines between three suggestions
    });

    it('should format suggestion without command', () => {
      const error: FormattedError = {
        type: ErrorType.NETWORK,
        message: 'Network timeout',
        suggestions: [
          {
            title: 'Check network connection',
            description: 'Verify your internet connection is stable',
          },
        ],
      };

      const result = formatter.format(error);

      expect(result).toContain('1. Check network connection');
      expect(result).toContain('Verify your internet connection is stable');
      expect(result).not.toContain('$'); // No command present
    });

    it('should exclude suggestions in minimal verbosity', () => {
      formatter.setVerbosity(ErrorVerbosity.MINIMAL);

      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Application error',
        suggestions: [
          {
            title: 'Restart application',
            description: 'Try restarting to resolve the issue',
          },
        ],
      };

      const result = formatter.format(error);

      expect(result).not.toContain('💡 Suggestions:');
      expect(result).not.toContain('Restart application');
      expect(result).toContain('APPLICATION'); // Header should still be present
    });
  });

  describe('Formatting without Suggestions', () => {
    it('should format error without suggestions section', () => {
      const error: FormattedError = {
        type: ErrorType.SYSTEM,
        message: 'System error occurred',
        context: {
          file: '/system/error.log',
          line: 1,
        },
      };

      const result = formatter.format(error);
      const sections = result.split('\n\n');

      // Should have 2 sections: header and context (no suggestions)
      expect(sections).toHaveLength(2);
      expect(result).not.toContain('💡 Suggestions:');
      expect(sections[0]).toContain('💥'); // System error icon
      expect(sections[1]).toContain('📍 Location:'); // Context section
    });

    it('should format minimal error with just header', () => {
      const error: FormattedError = {
        type: ErrorType.VALIDATION,
        message: 'Simple validation error',
      };

      const result = formatter.format(error);

      // Should be single line with just header
      expect(result.split('\n')).toHaveLength(1);
      expect(result).toContain('⚠️');
      expect(result).toContain('VALIDATION');
      expect(result).toContain('Simple validation error');
    });
  });

  describe('Output Structure Consistency', () => {
    it('should maintain consistent section ordering across error types', () => {
      const context: ErrorContext = {
        file: 'test.ts',
        line: 10,
        function: 'process',
      };

      const suggestions: ErrorSuggestion[] = [
        { title: 'Fix it', description: 'Do this' },
      ];

      const errorTypes = [
        ErrorType.SYSTEM,
        ErrorType.VALIDATION,
        ErrorType.CONFIG,
        ErrorType.NETWORK,
        ErrorType.FILESYSTEM,
        ErrorType.APPLICATION,
      ];

      errorTypes.forEach((type) => {
        const error: FormattedError = {
          type,
          message: 'Test message',
          context,
          suggestions,
        };

        const result = formatter.format(error);
        const sections = result.split('\n\n');

        // All should have 3 sections in same order
        expect(sections).toHaveLength(3);

        // Section 1: Header (different icons but same structure)
        expect(sections[0]).toMatch(/^[^\s]+\s+[A-Z]+\s+Test message$/);

        // Section 2: Context (same structure)
        expect(sections[1]).toContain('📍 Location:');
        expect(sections[1]).toContain('⚡ Function:');

        // Section 3: Suggestions (same structure)
        expect(sections[2]).toContain('💡 Suggestions:');
        expect(sections[2]).toContain('1. Fix it');
      });
    });

    it('should maintain consistent indentation for nested elements', () => {
      const error: FormattedError = {
        type: ErrorType.CONFIG,
        message: 'Config issue',
        suggestions: [
          {
            title: 'First suggestion',
            description: 'First description',
            command: 'first command',
          },
          {
            title: 'Second suggestion',
            description: 'Second description',
            command: 'second command',
          },
        ],
      };

      const result = formatter.format(error);
      const lines = result.split('\n');

      // Find suggestion lines and verify consistent indentation
      const suggestionTitleLines = lines.filter(line => line.match(/^\s+\d+\./));
      const descriptionLines = lines.filter(line =>
        line.includes('description') && !line.includes('Suggestions:')
      );
      const commandLines = lines.filter(line => line.includes('$'));

      // All suggestion titles should have same indentation (3 spaces)
      suggestionTitleLines.forEach(line => {
        expect(line).toMatch(/^   \d+\./);
      });

      // All descriptions should have same indentation (6 spaces)
      descriptionLines.forEach(line => {
        expect(line).toMatch(/^      /);
      });

      // All commands should have same indentation (6 spaces)
      commandLines.forEach(line => {
        expect(line).toMatch(/^      \$/);
      });
    });
  });

  describe('Styling Consistency', () => {
    it('should apply consistent styling to similar elements across errors', () => {
      const createError = (type: ErrorType, icon: string) => ({
        type,
        message: 'Test message',
        context: {
          file: 'test.ts',
          line: 42,
          function: 'testFunc',
        },
        suggestions: [
          {
            title: 'Test suggestion',
            description: 'Test description',
            command: 'test command',
          },
        ],
      });

      const testCases = [
        { type: ErrorType.SYSTEM, icon: '💥' },
        { type: ErrorType.VALIDATION, icon: '⚠️' },
        { type: ErrorType.CONFIG, icon: '⚙️' },
        { type: ErrorType.NETWORK, icon: '🌐' },
        { type: ErrorType.FILESYSTEM, icon: '📁' },
        { type: ErrorType.APPLICATION, icon: '❌' },
      ];

      testCases.forEach(({ type, icon }) => {
        const error = createError(type, icon);
        const result = formatter.format(error);

        // Header should contain correct icon
        expect(result).toContain(icon);

        // Context elements should have consistent icons
        expect(result).toContain('📍 Location:');
        expect(result).toContain('⚡ Function:');

        // Suggestion section should have consistent icon
        expect(result).toContain('💡 Suggestions:');

        // File paths, line numbers should be consistently formatted
        expect(result).toContain('test.ts:42');
        expect(result).toContain('testFunc');

        // Commands should be consistently prefixed
        expect(result).toContain('$ test command');
      });
    });

    it('should maintain consistent spacing between sections', () => {
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Test error',
        context: {
          file: 'test.ts',
          line: 1,
        },
        suggestions: [
          { title: 'Fix it', description: 'Try this' },
        ],
      };

      const result = formatter.format(error);

      // Sections should be separated by exactly one empty line
      const doubleLinesCount = (result.match(/\n\n/g) || []).length;
      expect(doubleLinesCount).toBe(2); // Between 3 sections = 2 double newlines
    });
  });

  describe('Different Error Types Output', () => {
    it('should format system error with distinctive styling', () => {
      const error: FormattedError = {
        type: ErrorType.SYSTEM,
        message: 'Critical system failure',
      };

      const result = formatter.format(error);

      expect(result).toContain('💥'); // System icon
      expect(result).toContain('SYSTEM'); // Type in uppercase
      expect(result).toContain('Critical system failure');
    });

    it('should format validation error with distinctive styling', () => {
      const error: FormattedError = {
        type: ErrorType.VALIDATION,
        message: 'Input validation failed',
      };

      const result = formatter.format(error);

      expect(result).toContain('⚠️'); // Warning icon
      expect(result).toContain('VALIDATION');
      expect(result).toContain('Input validation failed');
    });

    it('should format config error with distinctive styling', () => {
      const error: FormattedError = {
        type: ErrorType.CONFIG,
        message: 'Configuration missing',
      };

      const result = formatter.format(error);

      expect(result).toContain('⚙️'); // Gear icon
      expect(result).toContain('CONFIG');
      expect(result).toContain('Configuration missing');
    });

    it('should format network error with distinctive styling', () => {
      const error: FormattedError = {
        type: ErrorType.NETWORK,
        message: 'Connection refused',
      };

      const result = formatter.format(error);

      expect(result).toContain('🌐'); // Globe icon
      expect(result).toContain('NETWORK');
      expect(result).toContain('Connection refused');
    });

    it('should format filesystem error with distinctive styling', () => {
      const error: FormattedError = {
        type: ErrorType.FILESYSTEM,
        message: 'File not accessible',
      };

      const result = formatter.format(error);

      expect(result).toContain('📁'); // Folder icon
      expect(result).toContain('FILESYSTEM');
      expect(result).toContain('File not accessible');
    });

    it('should format application error with distinctive styling', () => {
      const error: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Unexpected application error',
      };

      const result = formatter.format(error);

      expect(result).toContain('❌'); // X icon
      expect(result).toContain('APPLICATION');
      expect(result).toContain('Unexpected application error');
    });
  });

  describe('Complex Output Validation', () => {
    it('should format complete error with all components properly structured', () => {
      const originalError = new Error('Original error message');
      originalError.stack = 'Error: Original error message\n    at test.js:10:5\n    at main.js:20:10';

      formatter.setVerbosity(ErrorVerbosity.VERBOSE);

      const error: FormattedError = {
        type: ErrorType.SYSTEM,
        message: 'Complex system error',
        context: {
          file: '/path/to/complex/file.ts',
          line: 123,
          column: 45,
          function: 'complexFunction',
          description: 'Error occurred during complex processing with multiple steps',
        },
        suggestions: [
          {
            title: 'Check system resources',
            description: 'Monitor CPU and memory usage to identify bottlenecks',
            command: 'top -p $(pgrep process)',
          },
          {
            title: 'Review error logs',
            description: 'Examine detailed logs for more context about the failure',
            command: 'tail -f /var/log/system.log',
          },
          {
            title: 'Restart affected services',
            description: 'Restart services that might be in an inconsistent state',
          },
        ],
        originalError,
      };

      const result = formatter.format(error);
      const sections = result.split('\n\n');

      // Should have 4 sections: header, context, suggestions, stack trace
      expect(sections).toHaveLength(4);

      // Section 1: Header
      expect(sections[0]).toContain('💥');
      expect(sections[0]).toContain('SYSTEM');
      expect(sections[0]).toContain('Complex system error');

      // Section 2: Context
      expect(sections[1]).toContain('📍 Location:');
      expect(sections[1]).toContain('/path/to/complex/file.ts:123:45');
      expect(sections[1]).toContain('⚡ Function:');
      expect(sections[1]).toContain('complexFunction');
      expect(sections[1]).toContain('📝 Context:');
      expect(sections[1]).toContain('Error occurred during complex processing');

      // Section 3: Suggestions
      expect(sections[2]).toContain('💡 Suggestions:');
      expect(sections[2]).toContain('1. Check system resources');
      expect(sections[2]).toContain('2. Review error logs');
      expect(sections[2]).toContain('3. Restart affected services');
      expect(sections[2]).toContain('top -p $(pgrep process)');
      expect(sections[2]).toContain('tail -f /var/log/system.log');

      // Section 4: Stack trace
      expect(sections[3]).toContain('🔍 Stack Trace:');
      expect(sections[3]).toContain('at test.js:10:5');
      expect(sections[3]).toContain('at main.js:20:10');
    });

    it('should handle edge case formatting gracefully', () => {
      const error: FormattedError = {
        type: ErrorType.VALIDATION,
        message: '', // Empty message
        context: {
          file: '',
          line: 0,
          function: '',
        },
        suggestions: [
          {
            title: '',
            description: '',
            command: '',
          },
        ],
      };

      // Should not throw and produce valid output
      expect(() => formatter.format(error)).not.toThrow();

      const result = formatter.format(error);
      expect(result).toContain('VALIDATION');
      expect(result).toContain('💡 Suggestions:'); // Should still show section header
    });
  });
});