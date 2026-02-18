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

describe('ErrorFormatter Integration Tests', () => {
  let formatter: ErrorFormatter;

  beforeEach(() => {
    formatter = new ErrorFormatter();
  });

  describe('real-world error scenarios', () => {
    it('should format TypeScript compilation errors', () => {
      const tsError: FormattedError = {
        type: ErrorType.CONFIG,
        message: "Property 'foo' does not exist on type 'Bar'",
        context: {
          file: 'src/types/User.ts',
          line: 42,
          column: 15,
          function: 'validateUser',
          description: 'TypeScript type checking error during compilation',
        },
        suggestions: [
          {
            title: 'Add missing property',
            description: 'Add the "foo" property to the Bar type definition',
            command: 'interface Bar { foo: string; }',
          },
          {
            title: 'Use optional chaining',
            description: 'Access the property safely using optional chaining',
            command: 'const value = bar.foo?.toString();',
          },
          {
            title: 'Check TypeScript documentation',
            description: 'Review TypeScript handbook for type definitions',
          },
        ],
      };

      const result = formatter.format(tsError);

      expect(result).toContain('⚙️');
      expect(result).toContain('CONFIG');
      expect(result).toContain("Property 'foo' does not exist");
      expect(result).toContain('src/types/User.ts:42:15');
      expect(result).toContain('validateUser');
      expect(result).toContain('Add missing property');
      expect(result).toContain('interface Bar');
    });

    it('should format database connection errors', () => {
      const dbError = new Error('Connection terminated unexpectedly');
      dbError.stack = `Error: Connection terminated unexpectedly
    at Client.emit (events.js:315:20)
    at Socket.<anonymous> (/node_modules/pg/lib/connection.js:107:12)
    at Socket.emit (events.js:315:20)
    at endReadableNT (_stream_readable.js:1327:12)`;

      const result = formatter.formatFromError(
        dbError,
        ErrorType.NETWORK,
        {
          file: 'src/database/connection.ts',
          line: 25,
          function: 'connectToDatabase',
          description: 'PostgreSQL connection lost during query execution',
        },
        [
          {
            title: 'Check database server status',
            description: 'Verify that the PostgreSQL server is running and accepting connections',
            command: 'pg_isready -h localhost -p 5432',
          },
          {
            title: 'Verify connection parameters',
            description: 'Check DATABASE_URL environment variable and connection settings',
            command: 'echo $DATABASE_URL',
          },
          {
            title: 'Implement connection retry logic',
            description: 'Add automatic reconnection with exponential backoff',
          },
        ]
      );

      expect(result).toContain('🌐');
      expect(result).toContain('NETWORK');
      expect(result).toContain('Connection terminated unexpectedly');
      expect(result).toContain('src/database/connection.ts:25');
      expect(result).toContain('connectToDatabase');
      expect(result).toContain('pg_isready');
    });

    it('should format file system permission errors', () => {
      const error: FormattedError = {
        type: ErrorType.FILESYSTEM,
        message: 'EACCES: permission denied, open \'/var/log/app.log\'',
        context: {
          file: 'src/utils/logger.ts',
          line: 18,
          column: 7,
          function: 'writeToLogFile',
          description: 'Application tried to write to system log directory without proper permissions',
        },
        suggestions: [
          {
            title: 'Fix file permissions',
            description: 'Change file permissions to allow write access for the current user',
            command: 'sudo chmod 664 /var/log/app.log',
          },
          {
            title: 'Change log directory',
            description: 'Use a log directory in the application folder instead',
            command: 'mkdir -p ./logs && LOG_DIR=./logs',
          },
          {
            title: 'Run with elevated privileges',
            description: 'Run the application with sudo (not recommended for production)',
            command: 'sudo node app.js',
          },
        ],
      };

      const result = formatter.format(error);

      expect(result).toContain('📁');
      expect(result).toContain('FILESYSTEM');
      expect(result).toContain('EACCES: permission denied');
      expect(result).toContain('sudo chmod 664');
    });

    it('should format API validation errors with multiple issues', () => {
      const validationErrors: FormattedError[] = [
        {
          type: ErrorType.VALIDATION,
          message: 'Email field is required',
          context: {
            file: 'src/validators/user.validator.ts',
            line: 15,
            function: 'validateUserInput',
          },
        },
        {
          type: ErrorType.VALIDATION,
          message: 'Password must be at least 8 characters long',
          context: {
            file: 'src/validators/user.validator.ts',
            line: 22,
            function: 'validatePassword',
          },
        },
        {
          type: ErrorType.VALIDATION,
          message: 'Phone number format is invalid',
          context: {
            file: 'src/validators/user.validator.ts',
            line: 35,
            function: 'validatePhoneNumber',
          },
        },
      ];

      const result = formatter.formatMultiple(validationErrors);

      expect(result).toContain('3 errors found');
      expect(result).toContain('⚠️'); // Validation icon
      expect(result).toContain('Email field is required');
      expect(result).toContain('Password must be at least 8');
      expect(result).toContain('Phone number format is invalid');
    });
  });

  describe('convenience formatError functions integration', () => {
    it('should handle complex system error scenario', () => {
      const context: ErrorContext = {
        file: 'src/system/memory.manager.ts',
        line: 120,
        column: 8,
        function: 'allocateMemory',
        description: 'Memory allocation failed due to insufficient system resources',
      };

      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Increase memory limit',
          description: 'Increase Node.js memory limit using --max-old-space-size flag',
          command: 'node --max-old-space-size=4096 app.js',
        },
        {
          title: 'Implement memory optimization',
          description: 'Add garbage collection and memory cleanup routines',
        },
      ];

      const result = formatError.system(
        'Out of memory: Cannot allocate buffer of size 1073741824',
        context,
        suggestions
      );

      expect(result).toContain('💥');
      expect(result).toContain('SYSTEM');
      expect(result).toContain('Out of memory');
      expect(result).toContain('--max-old-space-size=4096');
    });

    it('should handle network error with detailed context', () => {
      const context: ErrorContext = {
        file: 'src/api/client.ts',
        line: 87,
        function: 'fetchUserData',
        description: 'HTTP request failed after 3 retry attempts',
      };

      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Check network connectivity',
          description: 'Verify internet connection and DNS resolution',
          command: 'ping google.com && nslookup api.example.com',
        },
        {
          title: 'Increase timeout values',
          description: 'Set higher timeout values for slow connections',
        },
      ];

      const result = formatError.network(
        'Request timeout: Connection to api.example.com:443 timed out after 30000ms',
        context,
        suggestions
      );

      expect(result).toContain('🌐');
      expect(result).toContain('NETWORK');
      expect(result).toContain('Request timeout');
      expect(result).toContain('ping google.com');
    });
  });

  describe('different verbosity levels in real scenarios', () => {
    it('should adapt error detail for production vs development', () => {
      const productionError = new Error('Authentication failed');
      productionError.stack = `Error: Authentication failed
    at AuthService.authenticate (/app/src/auth/service.ts:45:12)
    at UserController.login (/app/src/controllers/user.ts:23:18)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`;

      const context: ErrorContext = {
        file: '/app/src/auth/service.ts',
        line: 45,
        column: 12,
        function: 'authenticate',
        description: 'JWT token validation failed',
      };

      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Check JWT configuration',
          description: 'Verify JWT_SECRET environment variable is set correctly',
        },
        {
          title: 'Validate token format',
          description: 'Ensure the Authorization header contains a valid Bearer token',
        },
      ];

      // Production mode - minimal verbosity
      const productionFormatter = new ErrorFormatter(ErrorVerbosity.MINIMAL);
      const prodResult = productionFormatter.formatFromError(
        productionError,
        ErrorType.SYSTEM,
        context,
        suggestions
      );

      expect(prodResult).toContain('Authentication failed');
      expect(prodResult).not.toContain('JWT token validation failed'); // No context
      expect(prodResult).not.toContain('Check JWT configuration'); // No suggestions
      expect(prodResult).not.toContain('AuthService.authenticate'); // No stack trace

      // Development mode - verbose verbosity
      const devFormatter = new ErrorFormatter(ErrorVerbosity.VERBOSE);
      const devResult = devFormatter.formatFromError(
        productionError,
        ErrorType.SYSTEM,
        context,
        suggestions
      );

      expect(devResult).toContain('Authentication failed');
      expect(devResult).toContain('JWT token validation failed'); // Context included
      expect(devResult).toContain('Check JWT configuration'); // Suggestions included
      expect(devResult).toContain('AuthService.authenticate'); // Stack trace included
    });
  });

  describe('chaining and composition', () => {
    it('should work well with error handling middleware', () => {
      // Simulate Express.js error handler pattern
      const handleError = (error: Error, verbosity: ErrorVerbosity = ErrorVerbosity.NORMAL) => {
        const errorFormatter = new ErrorFormatter(verbosity);

        if (error.name === 'ValidationError') {
          return errorFormatter.formatFromError(
            error,
            ErrorType.VALIDATION,
            undefined,
            [{
              title: 'Fix validation errors',
              description: 'Review the input data and fix validation issues',
            }]
          );
        }

        if (error.name === 'DatabaseError') {
          return errorFormatter.formatFromError(
            error,
            ErrorType.NETWORK,
            undefined,
            [{
              title: 'Check database connection',
              description: 'Verify database server is running and accessible',
              command: 'docker ps | grep postgres || systemctl status postgresql',
            }]
          );
        }

        // Default error handling
        return errorFormatter.formatFromError(error);
      };

      // Test validation error
      const validationError = new Error('Invalid email format');
      validationError.name = 'ValidationError';
      const validationResult = handleError(validationError);

      expect(validationResult).toContain('⚠️');
      expect(validationResult).toContain('VALIDATION');
      expect(validationResult).toContain('Fix validation errors');

      // Test database error
      const dbError = new Error('Connection refused');
      dbError.name = 'DatabaseError';
      const dbResult = handleError(dbError);

      expect(dbResult).toContain('🌐');
      expect(dbResult).toContain('NETWORK');
      expect(dbResult).toContain('docker ps | grep postgres');

      // Test generic error
      const genericError = new Error('Unknown error');
      const genericResult = handleError(genericError);

      expect(genericResult).toContain('❌');
      expect(genericResult).toContain('APPLICATION');
      expect(genericResult).toContain('Unknown error');
    });
  });

  describe('default formatter behavior', () => {
    it('should provide consistent behavior across different usage patterns', () => {
      const testError = 'Configuration file not found';
      const testContext = { file: 'config.json', line: 1 };
      const testSuggestions = [{ title: 'Create config file', description: 'Create a new config.json file' }];

      // Direct method call
      const directResult = defaultErrorFormatter.format({
        type: ErrorType.CONFIG,
        message: testError,
        context: testContext,
        suggestions: testSuggestions,
      });

      // Convenience function
      const convenienceResult = formatError.config(testError, testContext, testSuggestions);

      // Both should produce identical results
      expect(directResult).toBe(convenienceResult);
      expect(directResult).toContain('⚙️');
      expect(directResult).toContain('CONFIG');
      expect(directResult).toContain('Configuration file not found');
      expect(directResult).toContain('config.json');
      expect(directResult).toContain('Create config file');
    });

    it('should maintain state consistency across formatter instances', () => {
      // Create two separate formatters
      const formatter1 = new ErrorFormatter(ErrorVerbosity.MINIMAL);
      const formatter2 = new ErrorFormatter(ErrorVerbosity.VERBOSE);

      const testError: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'State consistency test',
        context: { file: 'test.js' },
        suggestions: [{ title: 'Fix it', description: 'Just fix it' }],
      };

      const result1 = formatter1.format(testError);
      const result2 = formatter2.format(testError);

      // Results should be different due to different verbosity
      expect(result1).not.toBe(result2);
      expect(result1.length).toBeLessThan(result2.length);

      // But both should contain the basic error message
      expect(result1).toContain('State consistency test');
      expect(result2).toContain('State consistency test');
    });
  });
});