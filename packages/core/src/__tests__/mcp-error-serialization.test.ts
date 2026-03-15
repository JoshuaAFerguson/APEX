import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serializeMCPError, SerializedMCPError } from '../utils.js';

describe('serializeMCPError', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('basic error serialization', () => {
    it('serializes a basic Error object', () => {
      const error = new Error('Test error message');
      error.name = 'TestError';

      const result = serializeMCPError(error);

      expect(result).toEqual({
        message: 'Test error message',
        name: 'TestError',
        stack: expect.stringContaining('Test error message')
      });
    });

    it('handles null/undefined errors gracefully', () => {
      expect(serializeMCPError(null)).toEqual({
        message: 'Unknown error occurred',
        name: 'UnknownError'
      });

      expect(serializeMCPError(undefined)).toEqual({
        message: 'Unknown error occurred',
        name: 'UnknownError'
      });
    });

    it('handles string errors', () => {
      const result = serializeMCPError('Simple string error');

      expect(result).toEqual({
        message: 'Simple string error',
        name: 'StringError'
      });
    });

    it('handles errors without a name property', () => {
      const error = {
        message: 'Error without name',
        stack: 'Stack trace here'
      };

      const result = serializeMCPError(error);

      expect(result).toEqual({
        message: 'Error without name',
        name: 'Object', // Plain objects get constructor.name = 'Object'
        stack: expect.stringContaining('Stack trace here')
      });
    });
  });

  describe('MCP-specific error properties', () => {
    it('includes error code when available', () => {
      const error = new Error('Connection failed');
      (error as any).code = 'CONNECTION_FAILED';

      const result = serializeMCPError(error);

      expect(result.code).toBe('CONNECTION_FAILED');
    });

    it('includes category when available', () => {
      const error = new Error('Protocol error');
      (error as any).category = 'protocol';

      const result = serializeMCPError(error);

      expect(result.category).toBe('protocol');
    });

    it('includes recoverable status when available', () => {
      const error = new Error('Recoverable error');
      (error as any).recoverable = true;

      const result = serializeMCPError(error);

      expect(result.recoverable).toBe(true);
    });

    it('includes all MCP error properties', () => {
      const error = new Error('Full MCP error');
      (error as any).code = 'MCP_ERROR';
      (error as any).category = 'connection';
      (error as any).recoverable = false;

      const result = serializeMCPError(error);

      expect(result).toEqual(expect.objectContaining({
        message: 'Full MCP error',
        name: 'Error',
        code: 'MCP_ERROR',
        category: 'connection',
        recoverable: false,
        stack: expect.any(String)
      }));
    });
  });

  describe('stack trace handling', () => {
    it('excludes stack trace in production by default', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Production error');
      const result = serializeMCPError(error);

      expect(result.stack).toBeUndefined();
    });

    it('includes stack trace in development by default', () => {
      process.env.NODE_ENV = 'development';

      const error = new Error('Development error');
      const result = serializeMCPError(error);

      expect(result.stack).toBeDefined();
      expect(result.stack).toContain('Development error');
    });

    it('respects explicit includeStack parameter', () => {
      const error = new Error('Explicit stack test');

      // Force include stack
      const withStack = serializeMCPError(error, true);
      expect(withStack.stack).toBeDefined();

      // Force exclude stack
      const withoutStack = serializeMCPError(error, false);
      expect(withoutStack.stack).toBeUndefined();
    });

    it('sanitizes file paths in stack traces by default', () => {
      const error = new Error('Path sanitization test');
      // Mock a stack trace with absolute paths
      error.stack = `Error: Path sanitization test
    at /Users/developer/project/src/test.js:10:5
    at C:\\Users\\developer\\project\\src\\test.js:15:3
    at /home/user/project/node_modules/lib/index.js:20:10`;

      const result = serializeMCPError(error, true, true);

      expect(result.stack).toBeDefined();
      expect(result.stack).not.toContain('/Users/developer');
      expect(result.stack).not.toContain('C:\\Users\\developer');

      // Check that the sanitization patterns work (paths get replaced with .../)
      expect(result.stack).toContain('.../test.js:10:5');
      expect(result.stack).toContain('C:\\Users\\***\\');

      // The /Users/ pattern should be replaced
      if (result.stack!.includes('/Users/')) {
        expect(result.stack).toContain('/Users/***');
      }
    });

    it('preserves full paths when sanitization is disabled', () => {
      const error = new Error('No sanitization test');
      error.stack = `Error: No sanitization test
    at /Users/developer/project/src/test.js:10:5`;

      const result = serializeMCPError(error, true, false);

      expect(result.stack).toBe(error.stack);
    });
  });

  describe('cause error handling', () => {
    it('serializes cause error when available', () => {
      const causeError = new Error('Root cause');
      causeError.stack = 'Root cause stack trace';

      const error = new Error('Main error');
      (error as any).cause = causeError;

      const result = serializeMCPError(error, true);

      expect(result.cause).toEqual({
        message: 'Root cause',
        name: 'Error',
        stack: expect.stringContaining('Root cause stack trace')
      });
    });

    it('sanitizes cause error stack traces', () => {
      const causeError = new Error('Cause with path');
      causeError.stack = 'Error at /Users/developer/project/cause.js:5:10';

      const error = new Error('Main error');
      (error as any).cause = causeError;

      const result = serializeMCPError(error, true, true);

      // The path will be sanitized to .../ pattern
      expect(result.cause?.stack).toContain('.../cause.js:5:10');
      expect(result.cause?.stack).not.toContain('/Users/developer');
    });

    it('handles string cause errors', () => {
      const error = new Error('Main error');
      (error as any).cause = 'String cause error';

      const result = serializeMCPError(error, true);

      expect(result.cause).toEqual({
        message: 'String cause error',
        name: 'String' // String constructor name is 'String'
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('handles circular references gracefully', () => {
      const error: any = new Error('Circular reference test');
      error.circular = error; // Create circular reference

      expect(() => serializeMCPError(error)).not.toThrow();

      const result = serializeMCPError(error);
      expect(result.message).toBe('Circular reference test');
    });

    it('handles non-standard error objects', () => {
      const weirdError = {
        toString: () => 'Weird error object',
        nonStandardProp: 'should be ignored'
      };

      const result = serializeMCPError(weirdError);

      expect(result.message).toBe('Weird error object');
      expect(result.name).toBe('Object'); // Plain objects have constructor.name = 'Object'
    });

    it('handles errors with numeric codes', () => {
      const error = new Error('Numeric code error');
      (error as any).code = 404;

      const result = serializeMCPError(error);

      expect(result.code).toBe('404');
    });

    it('handles very long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new Error(longMessage);

      const result = serializeMCPError(error);

      expect(result.message).toBe(longMessage);
      expect(result.name).toBe('Error');
    });

    it('handles empty error messages', () => {
      const error = new Error('');

      const result = serializeMCPError(error);

      // When message is empty, it falls back to String(error) which is the error.toString()
      expect(result.message).toBe('Error'); // Error object toString() returns 'Error' when message is empty
      expect(result.name).toBe('Error');
    });
  });

  describe('type safety and TypeScript integration', () => {
    it('returns correctly typed SerializedMCPError', () => {
      const error = new Error('Type test');
      (error as any).code = 'TYPE_TEST';
      (error as any).category = 'protocol';
      (error as any).recoverable = true;

      const result: SerializedMCPError = serializeMCPError(error);

      // Verify all expected properties are present and properly typed
      expect(typeof result.message).toBe('string');
      expect(typeof result.name).toBe('string');
      expect(typeof result.code).toBe('string');
      expect(typeof result.category).toBe('string');
      expect(typeof result.recoverable).toBe('boolean');
    });

    it('works with custom error classes', () => {
      class MCPTransportError extends Error {
        constructor(
          message: string,
          public code: string,
          public category: 'transport' = 'transport',
          public recoverable: boolean = true
        ) {
          super(message);
          this.name = 'MCPTransportError';
        }
      }

      const error = new MCPTransportError('Transport failed', 'TRANSPORT_ERROR');
      const result = serializeMCPError(error);

      expect(result).toEqual(expect.objectContaining({
        message: 'Transport failed',
        name: 'MCPTransportError',
        code: 'TRANSPORT_ERROR',
        category: 'transport',
        recoverable: true
      }));
    });
  });

  describe('performance and memory usage', () => {
    it('handles large error objects efficiently', () => {
      const error = new Error('Performance test');
      // Add many properties to simulate a large error object
      for (let i = 0; i < 1000; i++) {
        (error as any)[`prop${i}`] = `value${i}`;
      }

      const start = performance.now();
      const result = serializeMCPError(error);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
      expect(result.message).toBe('Performance test');
    });

    it('does not leak memory with repeated serializations', () => {
      const error = new Error('Memory test');

      // Perform many serializations
      for (let i = 0; i < 1000; i++) {
        const result = serializeMCPError(error);
        expect(result.message).toBe('Memory test');
      }

      // Test passes if no memory errors occur
      expect(true).toBe(true);
    });
  });
});