/**
 * Category 2: Graceful Degradation Tests
 *
 * Verifies that permission denials result in graceful degradation rather than
 * crashes or undefined behavior according to ADR-052.
 *
 * Test Groups:
 * 1. Type guard reliability
 * 2. Error chain preservation
 * 3. Error context propagation
 * 4. Safe error serialization
 * 5. Error code classification
 *
 * @see ADR-052-permission-denial-error-handling-tests.md
 */

import { describe, test, expect } from 'vitest';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  toBrowserPermissionDeniedError,
  type BrowserPermissionDeniedContext
} from '../tools/browser/browser-permission-denied-error.js';
import { ApexError, ApexErrorCode, type ApexErrorContext } from '../apex-error.js';

describe('Category 2: Permission Denial Graceful Degradation', () => {
  describe('Group 1: Type guard reliability', () => {
    test('isBrowserPermissionDeniedError returns true for instances', () => {
      const error = new BrowserPermissionDeniedError('Test message');
      expect(isBrowserPermissionDeniedError(error)).toBe(true);
    });

    test('isBrowserPermissionDeniedError returns false for plain Error', () => {
      const error = new Error('Plain error');
      expect(isBrowserPermissionDeniedError(error)).toBe(false);
    });

    test('isBrowserPermissionDeniedError returns false for ApexError', () => {
      const error = new ApexError('Apex error', ApexErrorCode.VALIDATION_ERROR);
      expect(isBrowserPermissionDeniedError(error)).toBe(false);
    });

    test('isBrowserPermissionDeniedError returns false for other ApexError subtypes', () => {
      // Create a custom ApexError subtype for testing
      class CustomApexError extends ApexError {
        constructor(message: string) {
          super(message, ApexErrorCode.INTERNAL_ERROR);
          this.name = 'CustomApexError';
        }
      }

      const error = new CustomApexError('Custom error');
      expect(isBrowserPermissionDeniedError(error)).toBe(false);
    });

    test('isBrowserPermissionDeniedError returns false for null', () => {
      expect(isBrowserPermissionDeniedError(null)).toBe(false);
    });

    test('isBrowserPermissionDeniedError returns false for undefined', () => {
      expect(isBrowserPermissionDeniedError(undefined)).toBe(false);
    });

    test('isBrowserPermissionDeniedError returns false for strings', () => {
      expect(isBrowserPermissionDeniedError('error string')).toBe(false);
    });

    test('type guard works correctly after Object.setPrototypeOf in constructor', () => {
      // The constructor calls Object.setPrototypeOf for proper instanceof checks
      const error = new BrowserPermissionDeniedError('Test message');

      // Verify the prototype chain is correct
      expect(error instanceof BrowserPermissionDeniedError).toBe(true);
      expect(error instanceof ApexError).toBe(true);
      expect(error instanceof Error).toBe(true);

      // Type guard should still work
      expect(isBrowserPermissionDeniedError(error)).toBe(true);
    });
  });

  describe('Group 2: Error chain preservation', () => {
    test('permission errors with cause maintain full error chain via getDetails()', () => {
      const rootCause = new Error('Network connection failed');
      const intermediateCause = new Error('Request timeout', { cause: rootCause });
      const permissionError = new BrowserPermissionDeniedError(
        'Browser permission denied',
        { operation: 'navigate', permissionType: 'domain' },
        intermediateCause
      );

      const details = permissionError.getDetails();
      expect(details.cause).toBe(intermediateCause);
      expect(intermediateCause.cause).toBe(rootCause);
    });

    test('nested causes are traversable (permission -> network -> IO)', () => {
      const ioError = new Error('File not found');
      const networkError = new Error('Connection refused', { cause: ioError });
      const permissionError = new BrowserPermissionDeniedError(
        'Permission denied',
        { permissionType: 'storage' },
        networkError
      );

      // Walk the error chain
      expect(permissionError.cause).toBe(networkError);
      expect(networkError.cause).toBe(ioError);
      expect(ioError.cause).toBeUndefined();
    });

    test('toString(includeStack: true) includes cause chain', () => {
      const rootError = new Error('Root cause');
      const permissionError = new BrowserPermissionDeniedError(
        'Permission denied',
        { permissionType: 'camera' },
        rootError
      );

      const errorString = permissionError.toString(true);
      expect(errorString).toContain('BrowserPermissionDeniedError: Permission denied');
      expect(errorString).toContain('Caused by: Error: Root cause');
    });
  });

  describe('Group 3: Error context propagation', () => {
    test('ApexErrorContext fields survive through BrowserPermissionDeniedError constructor', () => {
      const context: BrowserPermissionDeniedContext = {
        taskId: 'task-123',
        agentId: 'browser-agent',
        stage: 'execution',
        operation: 'navigate',
        sessionId: 'session-456',
        permissionType: 'domain',
        target: 'https://example.com',
        denialReason: 'Domain blocked'
      };

      const error = new BrowserPermissionDeniedError('Permission denied', context);

      expect(error.context.taskId).toBe('task-123');
      expect(error.context.agentId).toBe('browser-agent');
      expect(error.context.stage).toBe('execution');
      expect(error.context.operation).toBe('navigate');
      expect(error.context.sessionId).toBe('session-456');
    });

    test('context is accessible via both .context and .browserContext', () => {
      const context: BrowserPermissionDeniedContext = {
        taskId: 'task-789',
        permissionType: 'javascript',
        operation: 'evaluate',
        denialReason: 'JS disabled'
      };

      const error = new BrowserPermissionDeniedError('JS denied', context);

      // Accessible via ApexError.context
      expect(error.context.taskId).toBe('task-789');
      expect(error.context.operation).toBe('evaluate');

      // Accessible via browserContext
      expect(error.browserContext.permissionType).toBe('javascript');
      expect(error.browserContext.denialReason).toBe('JS disabled');
    });

    test('Zod validation in ApexErrorContextSchema.parse() does not reject valid contexts', () => {
      const validContext: ApexErrorContext = {
        taskId: 'task-abc',
        agentId: 'test-agent',
        stage: 'planning',
        operation: 'analyze',
        sessionId: 'session-def'
      };

      const browserContext: BrowserPermissionDeniedContext = {
        ...validContext,
        permissionType: 'clipboard',
        target: 'textarea#input'
      };

      // Should not throw during construction
      expect(() => {
        new BrowserPermissionDeniedError('Clipboard denied', browserContext);
      }).not.toThrow();
    });
  });

  describe('Group 4: Safe error serialization', () => {
    test('toJSON() produces valid JSON without circular references', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        permissionType: 'geolocation',
        operation: 'getCurrentPosition',
        target: 'https://maps.example.com',
        taskId: 'task-123'
      });

      const json = error.toJSON();

      // Should be serializable
      expect(() => JSON.stringify(json)).not.toThrow();

      // Should contain expected fields
      expect(json.name).toBe('BrowserPermissionDeniedError');
      expect(json.message).toContain('Permission denied');
      expect(json.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
    });

    test('getDetails() returns all expected fields', () => {
      const context: BrowserPermissionDeniedContext = {
        permissionType: 'notifications',
        operation: 'requestPermission',
        target: 'https://news.example.com',
        denialReason: 'User declined permission',
        taskId: 'task-456',
        agentId: 'notification-agent'
      };

      const error = new BrowserPermissionDeniedError('Notifications denied', context);
      const details = error.getDetails();

      expect(details.name).toBe('BrowserPermissionDeniedError');
      expect(details.message).toContain('Notifications denied');
      expect(details.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
      expect(details.context).toEqual(expect.objectContaining(context));
    });

    test('permission errors with undefined/null context fields serialize safely', () => {
      const partialContext: BrowserPermissionDeniedContext = {
        permissionType: 'camera',
        // operation, target, denialReason are undefined
        taskId: undefined,
        agentId: null as any
      };

      const error = new BrowserPermissionDeniedError('Camera denied', partialContext);

      // Should not throw during serialization
      expect(() => {
        const json = error.toJSON();
        JSON.stringify(json);
      }).not.toThrow();

      const details = error.getDetails();
      expect(details).toBeDefined();
      expect(details.context.permissionType).toBe('camera');
    });

    test('toSafeErrorResponse() never exposes stack traces or internal paths', () => {
      const error = new BrowserPermissionDeniedError(
        'Internal error at /usr/local/lib/browser/security.js:42',
        {
          permissionType: 'storage',
          operation: 'requestStorageAccess',
          denialReason: 'Internal security module at /opt/security/policy-engine.so rejected request'
        }
      );

      const safeResponse = error.toSafeErrorResponse();

      // Should not contain internal paths or stack traces
      expect(safeResponse.message).toBe('Browser permission denied');
      expect(safeResponse.message).not.toContain('/usr/local');
      expect(safeResponse.message).not.toContain('/opt/security');
      expect(safeResponse.message).not.toContain('.js:42');
      expect(safeResponse.message).not.toContain('policy-engine.so');

      // Should not have stack trace
      expect(safeResponse.stack).toBeUndefined();
    });
  });

  describe('Group 5: Error code classification', () => {
    test('isCode(ApexErrorCode.BROWSER_PERMISSION_DENIED) returns true', () => {
      const error = new BrowserPermissionDeniedError('Test message');
      expect(error.isCode(ApexErrorCode.BROWSER_PERMISSION_DENIED)).toBe(true);
    });

    test('isCode() returns false for other error codes', () => {
      const error = new BrowserPermissionDeniedError('Test message');
      expect(error.isCode(ApexErrorCode.VALIDATION_ERROR)).toBe(false);
      expect(error.isCode(ApexErrorCode.INTERNAL_ERROR)).toBe(false);
    });

    test('isCategory() returns true for browser error category', () => {
      const error = new BrowserPermissionDeniedError('Test message');
      // Note: Adjust 'APEX_18' based on actual error categorization in codebase
      expect(error.isCategory('APEX_18')).toBe(true);
    });

    test('permission errors are distinguishable from other ApexError types', () => {
      const permissionError = new BrowserPermissionDeniedError('Permission denied');
      const validationError = new ApexError('Validation failed', ApexErrorCode.VALIDATION_ERROR);
      const internalError = new ApexError('Internal error', ApexErrorCode.INTERNAL_ERROR);

      // Type guards should distinguish correctly
      expect(isBrowserPermissionDeniedError(permissionError)).toBe(true);
      expect(isBrowserPermissionDeniedError(validationError)).toBe(false);
      expect(isBrowserPermissionDeniedError(internalError)).toBe(false);

      // Error codes should be different
      expect(permissionError.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
      expect(validationError.code).toBe(ApexErrorCode.VALIDATION_ERROR);
      expect(internalError.code).toBe(ApexErrorCode.INTERNAL_ERROR);
    });

    test('instanceof checks work correctly for inheritance hierarchy', () => {
      const error = new BrowserPermissionDeniedError('Test message');

      expect(error instanceof BrowserPermissionDeniedError).toBe(true);
      expect(error instanceof ApexError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('Helper method reliability', () => {
    test('isPermissionType() works correctly', () => {
      const error = new BrowserPermissionDeniedError('Test', { permissionType: 'microphone' });

      expect(error.isPermissionType('microphone')).toBe(true);
      expect(error.isPermissionType('camera')).toBe(false);
      expect(error.isPermissionType(undefined)).toBe(false);
    });

    test('isOperation() works correctly', () => {
      const error = new BrowserPermissionDeniedError('Test', { operation: 'getUserMedia' });

      expect(error.isOperation('getUserMedia')).toBe(true);
      expect(error.isOperation('navigate')).toBe(false);
    });

    test('helper methods handle undefined context gracefully', () => {
      const error = new BrowserPermissionDeniedError('Test', {});

      expect(error.isPermissionType('camera')).toBe(false);
      expect(error.isOperation('test')).toBe(false);

      // Should not throw
      expect(() => error.getUserFriendlyMessage()).not.toThrow();
      expect(() => error.getResolutionSuggestions()).not.toThrow();
    });
  });
});