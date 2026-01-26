/**
 * Tests to verify ErrorFormatter examples from README documentation work correctly
 */
import { describe, it, expect } from 'vitest';
import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  parseTypeScriptErrors,
  parseESLintErrors,
  formatError,
  defaultErrorFormatter,
} from '../ErrorFormatter.js';

describe('README ErrorFormatter Examples', () => {
  describe('CLI ErrorFormatter creation and usage', () => {
    it('should create formatter with verbosity level as shown in README', () => {
      const formatter = new ErrorFormatter(ErrorVerbosity.VERBOSE);
      expect(formatter['verbosity']).toBe(ErrorVerbosity.VERBOSE);
    });

    it('should format structured error with full context as shown in README', () => {
      const formatter = new ErrorFormatter(ErrorVerbosity.VERBOSE);

      const formattedError = formatter.format({
        type: ErrorType.SYSTEM,
        message: 'Database connection failed',
        context: {
          file: 'src/database.ts',
          line: 25,
          function: 'connectToDatabase',
          description: 'Failed to establish connection after 3 retries'
        },
        suggestions: [
          {
            title: 'Check database credentials',
            description: 'Verify username, password, and host are correct',
            command: 'cat .env | grep DB_'
          },
          {
            title: 'Check network connectivity',
            description: 'Ensure the database server is reachable',
            command: 'ping database.example.com'
          }
        ]
      });

      expect(formattedError).toContain('💥'); // System error icon
      expect(formattedError).toContain('SYSTEM');
      expect(formattedError).toContain('Database connection failed');
      expect(formattedError).toContain('src/database.ts:25');
      expect(formattedError).toContain('connectToDatabase');
      expect(formattedError).toContain('Failed to establish connection after 3 retries');
      expect(formattedError).toContain('💡 Suggestions:');
      expect(formattedError).toContain('1. Check database credentials');
      expect(formattedError).toContain('2. Check network connectivity');
      expect(formattedError).toContain('cat .env | grep DB_');
      expect(formattedError).toContain('ping database.example.com');
    });
  });

  describe('parseTypeScriptErrors examples from README', () => {
    it('should parse TypeScript compiler errors as shown in README', () => {
      const tscErrorOutput = `
src/index.ts(42,15): error TS2339: Property 'foo' does not exist on type 'User'.
src/utils.ts(18,3): error TS2304: Cannot find name 'logger'.
`;

      const tscErrors = parseTypeScriptErrors(tscErrorOutput);

      expect(tscErrors).toHaveLength(2);

      // First error
      expect(tscErrors[0].type).toBe(ErrorType.CONFIG);
      expect(tscErrors[0].message).toContain('TS2339');
      expect(tscErrors[0].message).toContain('Property \'foo\' does not exist on type \'User\'');
      expect(tscErrors[0].context?.file).toBe('src/index.ts');
      expect(tscErrors[0].context?.line).toBe(42);
      expect(tscErrors[0].context?.column).toBe(15);
      expect(tscErrors[0].context?.description).toBe('TypeScript compilation error');

      // Second error
      expect(tscErrors[1].type).toBe(ErrorType.CONFIG);
      expect(tscErrors[1].message).toContain('TS2304');
      expect(tscErrors[1].message).toContain('Cannot find name \'logger\'');
      expect(tscErrors[1].context?.file).toBe('src/utils.ts');
      expect(tscErrors[1].context?.line).toBe(18);
      expect(tscErrors[1].context?.column).toBe(3);

      // Check that suggestions are generated
      expect(tscErrors[0].suggestions).toBeDefined();
      expect(tscErrors[0].suggestions!.length).toBeGreaterThan(0);
      expect(tscErrors[1].suggestions).toBeDefined();
      expect(tscErrors[1].suggestions!.length).toBeGreaterThan(0);
    });

    it('should handle colon format TypeScript errors', () => {
      const tscColonFormat = `
src/index.ts:42:15 - error TS2339: Property 'foo' does not exist on type 'User'.
src/utils.ts:18:3 - error TS2304: Cannot find name 'logger'.
`;

      const tscErrors = parseTypeScriptErrors(tscColonFormat);

      expect(tscErrors).toHaveLength(2);
      expect(tscErrors[0].context?.file).toBe('src/index.ts');
      expect(tscErrors[0].context?.line).toBe(42);
      expect(tscErrors[0].context?.column).toBe(15);
    });
  });

  describe('parseESLintErrors examples from README', () => {
    it('should parse ESLint errors as shown in README format', () => {
      const eslintOutput = `
/path/to/file.js
  10:5   error  'x' is defined but never used  no-unused-vars
  15:3   warning  Unexpected console statement  no-console

/path/to/another.js
  5:1   error  Missing semicolon  semi
`;

      const eslintErrors = parseESLintErrors(eslintOutput);

      expect(eslintErrors).toHaveLength(3);

      // First error
      expect(eslintErrors[0].type).toBe(ErrorType.CONFIG); // errors are CONFIG type
      expect(eslintErrors[0].message).toContain('\'x\' is defined but never used (no-unused-vars)');
      expect(eslintErrors[0].context?.file).toBe('/path/to/file.js');
      expect(eslintErrors[0].context?.line).toBe(10);
      expect(eslintErrors[0].context?.column).toBe(5);
      expect(eslintErrors[0].context?.description).toBe('ESLint error');

      // Second error (warning)
      expect(eslintErrors[1].type).toBe(ErrorType.VALIDATION); // warnings are VALIDATION type
      expect(eslintErrors[1].message).toContain('Unexpected console statement (no-console)');
      expect(eslintErrors[1].context?.line).toBe(15);
      expect(eslintErrors[1].context?.column).toBe(3);
      expect(eslintErrors[1].context?.description).toBe('ESLint warning');

      // Third error
      expect(eslintErrors[2].message).toContain('Missing semicolon (semi)');
      expect(eslintErrors[2].context?.file).toBe('/path/to/another.js');
      expect(eslintErrors[2].context?.line).toBe(5);
    });

    it('should parse ESLint stylish format', () => {
      const eslintStylish = `
/Users/user/project/src/app.js
   10:5    error    'x' is defined but never used    no-unused-vars
   15:3    warning  Unexpected console statement      no-console
   22:1    error    Missing semicolon                 semi

✖ 3 problems (2 errors, 1 warning)
`;

      const eslintErrors = parseESLintErrors(eslintStylish);

      expect(eslintErrors).toHaveLength(3);
      expect(eslintErrors[0].context?.file).toBe('/Users/user/project/src/app.js');
      expect(eslintErrors[0].message).toContain('no-unused-vars');
      expect(eslintErrors[1].message).toContain('no-console');
      expect(eslintErrors[2].message).toContain('semi');
    });
  });

  describe('Convenience formatError functions', () => {
    it('should provide all formatError convenience functions as shown in README', () => {
      const context: ErrorContext = { file: 'test.ts', line: 10 };
      const suggestions: ErrorSuggestion[] = [
        { title: 'Fix issue', description: 'Try this solution' }
      ];

      // Test system error
      const systemError = formatError.system('System failure', context, suggestions);
      expect(systemError).toContain('💥');
      expect(systemError).toContain('SYSTEM');
      expect(systemError).toContain('System failure');

      // Test validation error
      const validationError = formatError.validation('Invalid input', context);
      expect(validationError).toContain('⚠️');
      expect(validationError).toContain('VALIDATION');

      // Test config error
      const configError = formatError.config('Missing config', context);
      expect(configError).toContain('⚙️');
      expect(configError).toContain('CONFIG');

      // Test network error
      const networkError = formatError.network('Connection failed');
      expect(networkError).toContain('🌐');
      expect(networkError).toContain('NETWORK');

      // Test filesystem error
      const filesystemError = formatError.filesystem('File not found');
      expect(filesystemError).toContain('📁');
      expect(filesystemError).toContain('FILESYSTEM');

      // Test application error
      const appError = formatError.application('App crashed');
      expect(appError).toContain('❌');
      expect(appError).toContain('APPLICATION');
    });
  });

  describe('Error suggestions generation', () => {
    it('should generate helpful suggestions for common TypeScript errors', () => {
      const formatter = new ErrorFormatter();

      // Test TS2339 suggestions
      const ts2339Output = `src/test.ts(1,1): error TS2339: Property 'nonexistent' does not exist on type 'User'.`;
      const ts2339Errors = formatter.parseTypeScriptErrors(ts2339Output);
      expect(ts2339Errors[0].suggestions).toBeDefined();
      expect(ts2339Errors[0].suggestions![0].title).toContain('Add missing property');

      // Test TS2304 suggestions
      const ts2304Output = `src/test.ts(1,1): error TS2304: Cannot find name 'MyType'.`;
      const ts2304Errors = formatter.parseTypeScriptErrors(ts2304Output);
      expect(ts2304Errors[0].suggestions).toBeDefined();
      expect(ts2304Errors[0].suggestions![0].title).toContain('Import missing module');
    });

    it('should generate helpful suggestions for common ESLint rules', () => {
      const formatter = new ErrorFormatter();

      const eslintOutput = `
/test.js
  1:1   error  'unused' is defined but never used  no-unused-vars
  2:1   error  Unexpected console statement  no-console
  3:1   error  Use const instead of let  prefer-const
`;

      const errors = formatter.parseESLintErrors(eslintOutput);

      expect(errors).toHaveLength(3);

      // Check no-unused-vars suggestions
      expect(errors[0].suggestions![0].title).toContain('Remove unused variable');

      // Check no-console suggestions
      expect(errors[1].suggestions![0].title).toContain('Remove console statement');

      // Check prefer-const suggestions
      expect(errors[2].suggestions![0].title).toContain('Use const instead of let');
    });
  });

  describe('Multiple error formatting', () => {
    it('should format multiple errors as a list', () => {
      const formatter = new ErrorFormatter();

      const errors = [
        {
          type: ErrorType.VALIDATION,
          message: 'First error'
        },
        {
          type: ErrorType.CONFIG,
          message: 'Second error'
        }
      ];

      const result = formatter.formatMultiple(errors);

      expect(result).toContain('2 errors found');
      expect(result).toContain('Error 1');
      expect(result).toContain('Error 2');
      expect(result).toContain('First error');
      expect(result).toContain('Second error');
    });

    it('should handle single error in formatMultiple', () => {
      const formatter = new ErrorFormatter();

      const errors = [
        {
          type: ErrorType.APPLICATION,
          message: 'Single error'
        }
      ];

      const result = formatter.formatMultiple(errors);

      expect(result).not.toContain('1 errors found');
      expect(result).toContain('Single error');
      expect(result).toContain('APPLICATION');
    });

    it('should handle empty errors array', () => {
      const formatter = new ErrorFormatter();
      const result = formatter.formatMultiple([]);
      expect(result).toBe('');
    });
  });

  describe('Verbosity levels', () => {
    it('should show different levels of detail based on verbosity', () => {
      const error = {
        type: ErrorType.SYSTEM,
        message: 'Test error',
        context: {
          file: 'test.ts',
          line: 10,
          function: 'testFunc',
          description: 'Test description'
        },
        suggestions: [
          { title: 'Fix it', description: 'Do this' }
        ],
        originalError: new Error('Original error with stack')
      };

      // Minimal verbosity
      const minimalFormatter = new ErrorFormatter(ErrorVerbosity.MINIMAL);
      const minimalResult = minimalFormatter.format(error);
      expect(minimalResult).toContain('Test error');
      expect(minimalResult).not.toContain('test.ts'); // No context
      expect(minimalResult).not.toContain('Fix it'); // No suggestions

      // Normal verbosity
      const normalFormatter = new ErrorFormatter(ErrorVerbosity.NORMAL);
      const normalResult = normalFormatter.format(error);
      expect(normalResult).toContain('Test error');
      expect(normalResult).toContain('test.ts'); // Context included
      expect(normalResult).toContain('Fix it'); // Suggestions included
      expect(normalResult).not.toContain('Stack Trace'); // No stack trace

      // Verbose verbosity
      const verboseFormatter = new ErrorFormatter(ErrorVerbosity.VERBOSE);
      const verboseResult = verboseFormatter.format(error);
      expect(verboseResult).toContain('Test error');
      expect(verboseResult).toContain('test.ts'); // Context included
      expect(verboseResult).toContain('Fix it'); // Suggestions included
      expect(verboseResult).toContain('Stack Trace'); // Stack trace included
    });
  });

  describe('Default error formatter instance', () => {
    it('should provide default instance as shown in README', () => {
      expect(defaultErrorFormatter).toBeInstanceOf(ErrorFormatter);
      expect(defaultErrorFormatter['verbosity']).toBe(ErrorVerbosity.NORMAL);
    });

    it('should use default instance in convenience functions', () => {
      const result = formatError.system('Test system error');
      expect(result).toContain('SYSTEM');
      expect(result).toContain('Test system error');
    });
  });
});