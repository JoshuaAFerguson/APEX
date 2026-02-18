/**
 * Unit tests for ApexError class and error context handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ApexError,
  ApexErrorCode,
  ApexErrorContext,
  ApexErrorContextSchema,
  isApexError,
  toApexError,
  wrapWithApexError,
} from '../apex-error';

describe('ApexError', () => {
  let mockDate: Date;

  beforeEach(() => {
    mockDate = new Date('2023-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create an ApexError with basic parameters', () => {
      const error = new ApexError('Test message', ApexErrorCode.TASK_NOT_FOUND);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApexError);
      expect(error.name).toBe('ApexError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe(ApexErrorCode.TASK_NOT_FOUND);
      expect(error.timestamp).toEqual(mockDate);
      expect(error.errorId).toMatch(/^apex_err_/);
      expect(error.context).toEqual({ timestamp: mockDate });
    });

    it('should create an ApexError with default UNKNOWN code', () => {
      const error = new ApexError('Test message');

      expect(error.code).toBe(ApexErrorCode.UNKNOWN);
    });

    it('should create an ApexError with context', () => {
      const context: ApexErrorContext = {
        taskId: 'task-123',
        agentId: 'developer',
        stage: 'implementation',
        operation: 'file-creation',
        metadata: { fileName: 'test.ts' },
        userId: 'user-456',
        sessionId: 'session-789',
      };

      const error = new ApexError(
        'Context test',
        ApexErrorCode.FILE_NOT_FOUND,
        context
      );

      expect(error.context).toEqual({
        ...context,
        timestamp: mockDate,
      });
    });

    it('should create an ApexError with cause', () => {
      const originalError = new Error('Original error');
      const error = new ApexError(
        'Wrapped error',
        ApexErrorCode.INTERNAL,
        {},
        originalError
      );

      expect(error.cause).toBe(originalError);
    });

    it('should validate context with schema', () => {
      const invalidContext = {
        taskId: 123, // Invalid: should be string
        agentId: 'developer',
      } as any;

      expect(() => {
        new ApexError('Test', ApexErrorCode.VALIDATION, invalidContext);
      }).toThrow();
    });

    it('should generate unique error IDs', () => {
      const error1 = new ApexError('Test 1');
      const error2 = new ApexError('Test 2');

      expect(error1.errorId).not.toBe(error2.errorId);
      expect(error1.errorId).toMatch(/^apex_err_[a-z0-9]+_[a-z0-9]+$/);
      expect(error2.errorId).toMatch(/^apex_err_[a-z0-9]+_[a-z0-9]+$/);
    });

    it('should capture stack trace', () => {
      const error = new ApexError('Stack trace test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ApexError');
      expect(error.stack).toContain('Stack trace test');
    });
  });

  describe('error codes', () => {
    it('should have all expected error codes', () => {
      expect(ApexErrorCode.UNKNOWN).toBe('APEX_1000');
      expect(ApexErrorCode.INTERNAL).toBe('APEX_1001');
      expect(ApexErrorCode.VALIDATION).toBe('APEX_1002');
      expect(ApexErrorCode.CONFIGURATION).toBe('APEX_1003');

      expect(ApexErrorCode.TASK_NOT_FOUND).toBe('APEX_1100');
      expect(ApexErrorCode.TASK_EXECUTION_FAILED).toBe('APEX_1101');
      expect(ApexErrorCode.TASK_TIMEOUT).toBe('APEX_1102');
      expect(ApexErrorCode.TASK_CANCELLED).toBe('APEX_1103');
      expect(ApexErrorCode.TASK_VALIDATION_FAILED).toBe('APEX_1104');

      expect(ApexErrorCode.AGENT_NOT_FOUND).toBe('APEX_1200');
      expect(ApexErrorCode.AGENT_INITIALIZATION_FAILED).toBe('APEX_1201');
      expect(ApexErrorCode.AGENT_EXECUTION_FAILED).toBe('APEX_1202');
      expect(ApexErrorCode.AGENT_COMMUNICATION_FAILED).toBe('APEX_1203');

      expect(ApexErrorCode.WORKFLOW_NOT_FOUND).toBe('APEX_1300');
      expect(ApexErrorCode.WORKFLOW_VALIDATION_FAILED).toBe('APEX_1301');
      expect(ApexErrorCode.WORKFLOW_EXECUTION_FAILED).toBe('APEX_1302');
      expect(ApexErrorCode.WORKFLOW_STAGE_FAILED).toBe('APEX_1303');

      expect(ApexErrorCode.FILE_NOT_FOUND).toBe('APEX_1400');
      expect(ApexErrorCode.FILE_ACCESS_DENIED).toBe('APEX_1401');
      expect(ApexErrorCode.DIRECTORY_NOT_FOUND).toBe('APEX_1402');
      expect(ApexErrorCode.WORKSPACE_NOT_INITIALIZED).toBe('APEX_1403');

      expect(ApexErrorCode.NETWORK_ERROR).toBe('APEX_1500');
      expect(ApexErrorCode.API_ERROR).toBe('APEX_1501');
      expect(ApexErrorCode.AUTHENTICATION_ERROR).toBe('APEX_1502');
      expect(ApexErrorCode.RATE_LIMIT_EXCEEDED).toBe('APEX_1503');

      expect(ApexErrorCode.DATABASE_CONNECTION_FAILED).toBe('APEX_1600');
      expect(ApexErrorCode.DATABASE_QUERY_FAILED).toBe('APEX_1601');
      expect(ApexErrorCode.DATABASE_MIGRATION_FAILED).toBe('APEX_1602');

      expect(ApexErrorCode.CLAUDE_SDK_ERROR).toBe('APEX_1700');
      expect(ApexErrorCode.TOOL_INTEGRATION_FAILED).toBe('APEX_1701');
      expect(ApexErrorCode.DEPENDENCY_ERROR).toBe('APEX_1702');
    });
  });

  describe('context object handling', () => {
    it('should handle empty context', () => {
      const error = new ApexError('Test', ApexErrorCode.UNKNOWN, {});

      expect(error.context).toEqual({ timestamp: mockDate });
    });

    it('should handle context with all fields', () => {
      const fullContext: ApexErrorContext = {
        taskId: 'task-123',
        agentId: 'developer',
        stage: 'implementation',
        operation: 'file-write',
        timestamp: new Date('2022-12-01T00:00:00.000Z'),
        metadata: {
          fileName: 'test.ts',
          lineNumber: 42,
          nested: { value: 'test' },
        },
        relatedErrorIds: ['err1', 'err2'],
        userId: 'user-456',
        sessionId: 'session-789',
      };

      const error = new ApexError('Full context test', ApexErrorCode.INTERNAL, fullContext);

      expect(error.context).toEqual(fullContext);
    });

    it('should preserve custom timestamp if provided', () => {
      const customTimestamp = new Date('2022-06-01T12:30:45.000Z');
      const context: ApexErrorContext = {
        taskId: 'task-123',
        timestamp: customTimestamp,
      };

      const error = new ApexError('Custom timestamp', ApexErrorCode.UNKNOWN, context);

      expect(error.context.timestamp).toEqual(customTimestamp);
    });

    it('should validate context against schema', () => {
      // Valid context
      expect(() => {
        ApexErrorContextSchema.parse({
          taskId: 'task-123',
          agentId: 'developer',
          timestamp: new Date(),
        });
      }).not.toThrow();

      // Invalid context
      expect(() => {
        ApexErrorContextSchema.parse({
          taskId: 123, // Should be string
        });
      }).toThrow();
    });

    it('should handle complex metadata', () => {
      const complexMetadata = {
        config: { debug: true, retries: 3 },
        performance: { startTime: Date.now(), duration: 1500 },
        request: {
          url: 'https://api.example.com',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        null_value: null,
        undefined_value: undefined,
        array_value: [1, 2, 3, 'test'],
      };

      const error = new ApexError(
        'Complex metadata test',
        ApexErrorCode.API_ERROR,
        { metadata: complexMetadata }
      );

      expect(error.context.metadata).toEqual(complexMetadata);
    });
  });

  describe('instance methods', () => {
    let error: ApexError;

    beforeEach(() => {
      error = new ApexError(
        'Test error',
        ApexErrorCode.TASK_EXECUTION_FAILED,
        { taskId: 'task-123', stage: 'implementation' }
      );
    });

    describe('isCode', () => {
      it('should return true for matching code', () => {
        expect(error.isCode(ApexErrorCode.TASK_EXECUTION_FAILED)).toBe(true);
      });

      it('should return false for non-matching code', () => {
        expect(error.isCode(ApexErrorCode.AGENT_NOT_FOUND)).toBe(false);
      });
    });

    describe('isCategory', () => {
      it('should return true for matching category prefix', () => {
        expect(error.isCategory('APEX_11')).toBe(true); // Task errors
      });

      it('should return false for non-matching category prefix', () => {
        expect(error.isCategory('APEX_12')).toBe(false); // Agent errors
      });

      it('should handle exact matches', () => {
        expect(error.isCategory('APEX_1101')).toBe(true);
      });
    });

    describe('getDetails', () => {
      it('should return complete error details', () => {
        const details = error.getDetails();

        expect(details).toEqual({
          errorId: error.errorId,
          name: 'ApexError',
          message: 'Test error',
          code: ApexErrorCode.TASK_EXECUTION_FAILED,
          context: error.context,
          timestamp: error.timestamp,
          stack: error.stack,
          cause: undefined,
        });
      });

      it('should include cause details when present', () => {
        const originalError = new Error('Original error');
        originalError.stack = 'Original stack trace';

        const errorWithCause = new ApexError(
          'Caused error',
          ApexErrorCode.INTERNAL,
          {},
          originalError
        );

        const details = errorWithCause.getDetails();

        expect(details.cause).toEqual({
          name: 'Error',
          message: 'Original error',
          stack: 'Original stack trace',
        });
      });
    });

    describe('toJSON', () => {
      it('should return JSON-serializable object', () => {
        const json = error.toJSON();
        const details = error.getDetails();

        expect(json).toEqual(details);
        expect(JSON.stringify(json)).not.toThrow;
      });
    });

    describe('toString', () => {
      it('should return basic string representation', () => {
        const str = error.toString();

        expect(str).toBe(
          'ApexError [APEX_1101]: Test error (Task: task-123) (Stage: implementation)'
        );
      });

      it('should include agent information when present', () => {
        const errorWithAgent = new ApexError(
          'Agent error',
          ApexErrorCode.AGENT_EXECUTION_FAILED,
          { taskId: 'task-123', agentId: 'developer', stage: 'implementation' }
        );

        const str = errorWithAgent.toString();

        expect(str).toContain('(Agent: developer)');
      });

      it('should include cause information when present', () => {
        const originalError = new Error('Original error');
        const errorWithCause = new ApexError(
          'Caused error',
          ApexErrorCode.INTERNAL,
          {},
          originalError
        );

        const str = errorWithCause.toString();

        expect(str).toContain('\nCaused by: Error: Original error');
      });

      it('should include stack trace when requested', () => {
        const str = error.toString(true);

        expect(str).toContain(error.stack!);
      });

      it('should handle minimal context', () => {
        const minimalError = new ApexError('Minimal', ApexErrorCode.UNKNOWN);
        const str = minimalError.toString();

        expect(str).toBe('ApexError [APEX_1000]: Minimal');
      });
    });
  });

  describe('error serialization', () => {
    it('should serialize to JSON without losing information', () => {
      const originalError = new Error('Cause');
      const error = new ApexError(
        'Serialization test',
        ApexErrorCode.DATABASE_CONNECTION_FAILED,
        {
          taskId: 'task-123',
          agentId: 'developer',
          metadata: { connectionString: 'postgres://localhost' },
        },
        originalError
      );

      const json = JSON.parse(JSON.stringify(error));

      expect(json.errorId).toBe(error.errorId);
      expect(json.name).toBe('ApexError');
      expect(json.message).toBe('Serialization test');
      expect(json.code).toBe(ApexErrorCode.DATABASE_CONNECTION_FAILED);
      expect(json.context.taskId).toBe('task-123');
      expect(json.context.agentId).toBe('developer');
      expect(json.context.metadata.connectionString).toBe('postgres://localhost');
      expect(json.cause.name).toBe('Error');
      expect(json.cause.message).toBe('Cause');
    });

    it('should handle circular references in metadata', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => {
        new ApexError('Circular test', ApexErrorCode.INTERNAL, {
          metadata: { circular },
        });
      }).not.toThrow(); // Creation should succeed

      // JSON serialization will handle circular refs based on JSON.stringify behavior
    });
  });

  describe('type checking', () => {
    it('should work with instanceof', () => {
      const error = new ApexError('Instance test');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ApexError).toBe(true);
    });

    it('should maintain proper prototype chain', () => {
      const error = new ApexError('Prototype test');

      expect(Object.getPrototypeOf(error)).toBe(ApexError.prototype);
      expect(error.constructor).toBe(ApexError);
    });
  });
});

describe('isApexError', () => {
  it('should return true for ApexError instances', () => {
    const error = new ApexError('Test');

    expect(isApexError(error)).toBe(true);
  });

  it('should return false for regular Error instances', () => {
    const error = new Error('Test');

    expect(isApexError(error)).toBe(false);
  });

  it('should return false for non-error objects', () => {
    expect(isApexError({})).toBe(false);
    expect(isApexError('string')).toBe(false);
    expect(isApexError(null)).toBe(false);
    expect(isApexError(undefined)).toBe(false);
    expect(isApexError(123)).toBe(false);
  });

  it('should return false for objects that look like ApexError', () => {
    const fakeError = {
      name: 'ApexError',
      message: 'Fake error',
      code: ApexErrorCode.UNKNOWN,
    };

    expect(isApexError(fakeError)).toBe(false);
  });
});

describe('toApexError', () => {
  it('should return same error if already an ApexError', () => {
    const originalError = new ApexError('Original', ApexErrorCode.TASK_NOT_FOUND);
    const result = toApexError(originalError);

    expect(result).toBe(originalError);
  });

  it('should convert regular Error to ApexError', () => {
    const originalError = new Error('Regular error');
    const result = toApexError(originalError, ApexErrorCode.INTERNAL, {
      taskId: 'task-123',
    });

    expect(result).toBeInstanceOf(ApexError);
    expect(result.message).toBe('Regular error');
    expect(result.code).toBe(ApexErrorCode.INTERNAL);
    expect(result.context.taskId).toBe('task-123');
    expect(result.cause).toBe(originalError);
  });

  it('should use default values when not provided', () => {
    const originalError = new Error('Test error');
    const result = toApexError(originalError);

    expect(result.code).toBe(ApexErrorCode.UNKNOWN);
    expect(result.context).toEqual({ timestamp: expect.any(Date) });
  });
});

describe('wrapWithApexError', () => {
  it('should wrap synchronous functions', () => {
    const throwingFunction = () => {
      throw new Error('Original error');
    };

    const wrappedFunction = wrapWithApexError(
      throwingFunction,
      ApexErrorCode.INTERNAL,
      { operation: 'test-operation' }
    );

    expect(() => wrappedFunction()).toThrow(ApexError);

    try {
      wrappedFunction();
    } catch (error) {
      expect(isApexError(error)).toBe(true);
      if (isApexError(error)) {
        expect(error.code).toBe(ApexErrorCode.INTERNAL);
        expect(error.context.operation).toBe('test-operation');
        expect(error.cause?.message).toBe('Original error');
      }
    }
  });

  it('should return result for successful synchronous functions', () => {
    const successFunction = (a: number, b: number) => a + b;
    const wrappedFunction = wrapWithApexError(successFunction);

    expect(wrappedFunction(2, 3)).toBe(5);
  });

  it('should wrap asynchronous functions', async () => {
    const throwingAsyncFunction = async () => {
      throw new Error('Async error');
    };

    const wrappedFunction = wrapWithApexError(
      throwingAsyncFunction,
      ApexErrorCode.NETWORK_ERROR
    );

    await expect(wrappedFunction()).rejects.toThrow(ApexError);

    try {
      await wrappedFunction();
    } catch (error) {
      expect(isApexError(error)).toBe(true);
      if (isApexError(error)) {
        expect(error.code).toBe(ApexErrorCode.NETWORK_ERROR);
        expect(error.cause?.message).toBe('Async error');
      }
    }
  });

  it('should return result for successful asynchronous functions', async () => {
    const successAsyncFunction = async (a: number, b: number) => a * b;
    const wrappedFunction = wrapWithApexError(successAsyncFunction);

    await expect(wrappedFunction(3, 4)).resolves.toBe(12);
  });

  it('should handle non-Error thrown values', () => {
    const throwingFunction = () => {
      throw 'String error';
    };

    const wrappedFunction = wrapWithApexError(throwingFunction, ApexErrorCode.UNKNOWN);

    expect(() => wrappedFunction()).toThrow(ApexError);

    try {
      wrappedFunction();
    } catch (error) {
      expect(isApexError(error)).toBe(true);
      if (isApexError(error)) {
        expect(error.message).toBe('String error');
        expect(error.code).toBe(ApexErrorCode.UNKNOWN);
      }
    }
  });

  it('should preserve function signature and parameters', () => {
    const originalFunction = (a: number, b: string, c: boolean) => `${a}-${b}-${c}`;
    const wrappedFunction = wrapWithApexError(originalFunction);

    expect(wrappedFunction(42, 'test', true)).toBe('42-test-true');
  });
});

describe('ApexErrorContextSchema', () => {
  it('should validate valid context objects', () => {
    const validContext: ApexErrorContext = {
      taskId: 'task-123',
      agentId: 'developer',
      stage: 'implementation',
      operation: 'file-write',
      timestamp: new Date(),
      metadata: { key: 'value' },
      relatedErrorIds: ['err1', 'err2'],
      userId: 'user-456',
      sessionId: 'session-789',
    };

    expect(() => ApexErrorContextSchema.parse(validContext)).not.toThrow();
  });

  it('should reject invalid context objects', () => {
    const invalidContexts = [
      { taskId: 123 }, // Invalid type
      { agentId: null }, // Invalid type
      { stage: [] }, // Invalid type
      { timestamp: 'not-a-date' }, // Invalid type
      { relatedErrorIds: 'not-an-array' }, // Invalid type
      { metadata: 'not-an-object' }, // Invalid type
    ];

    invalidContexts.forEach((invalidContext) => {
      expect(() => ApexErrorContextSchema.parse(invalidContext)).toThrow();
    });
  });

  it('should allow optional fields to be undefined', () => {
    const minimalContext = {};

    expect(() => ApexErrorContextSchema.parse(minimalContext)).not.toThrow();
  });

  it('should handle complex metadata structures', () => {
    const complexContext = {
      metadata: {
        nested: {
          deeply: {
            value: 'test',
            number: 42,
            boolean: true,
            array: [1, 2, 3],
          },
        },
        null_value: null,
        undefined_value: undefined,
      },
    };

    expect(() => ApexErrorContextSchema.parse(complexContext)).not.toThrow();
  });
});