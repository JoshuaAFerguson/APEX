/**
 * Error Message Security Tests
 *
 * Verifies that error messages and serialized error objects don't leak
 * sensitive information such as stack traces, internal paths, credentials,
 * or overly-detailed failure reasons for security-sensitive operations.
 *
 * NOTE: This file contains FAKE/DUMMY credential patterns used solely as
 * test fixtures to verify sanitization logic. No real credentials are present.
 *
 * @see ADR-092 for architectural decisions
 */

import { describe, it, expect } from 'vitest';
import {
  ApexError,
  ApexErrorCode,
  sanitizeErrorMessage,
  toSafeErrorResponse,
} from '../apex-error';

// ============================================================================
// Test Helpers
// ============================================================================

/** Patterns indicating sensitive filesystem paths */
const SENSITIVE_PATH_PATTERNS = [
  /\/Users\/[^\s/]+\//,
  /\/home\/[^\s/]+\//,
  /[A-Z]:\\Users\\[^\s\\]+\\/i,
  /node_modules\/[^\s]+/,
  /\.apex\/(config\.yaml|apex\.db)/,
  /\/tmp\/[^\s]+/,
];

/** Patterns indicating credentials or secrets */
const SENSITIVE_VALUE_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-]+/,
  /sk-[a-zA-Z0-9]{20,}/,
  /Bearer\s+[a-zA-Z0-9._-]+/,
  /password[=:]\s*\S+/i,
  /postgres:\/\/[^@\s]+@/,
  /mongodb(\+srv)?:\/\/[^@\s]+@/,
  /(?:api[_-]?key|secret|token|credential)[=:]\s*\S+/i,
];

// Dummy test fixture strings - NOT real credentials
const DUMMY_ANTHROPIC_KEY = 'sk-ant-api03-' + 'A'.repeat(20);
const DUMMY_BEARER = 'Bearer ' + 'x'.repeat(30);
const DUMMY_PG_CONN = 'postgres://testuser:testpw@localhost:5432/testdb';
const DUMMY_MONGO_CONN = 'mongodb+srv://testroot:testpw@cluster0.example.net/testdb';

function expectNoSensitivePaths(value: string): void {
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    expect(value).not.toMatch(pattern);
  }
}

function expectNoSensitiveValues(value: string): void {
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    expect(value).not.toMatch(pattern);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Error Message Security', () => {

  // ==========================================================================
  // Category 1: Stack Trace Exposure
  // ==========================================================================
  describe('Stack Trace Exposure', () => {
    it('should include stack in getDetails() (documenting current behavior)', () => {
      const error = new ApexError('Test error', ApexErrorCode.INTERNAL);
      const details = error.getDetails();
      expect(details.stack).toBeDefined();
      expect(details.stack).toContain('ApexError');
    });

    it('should include stack in toJSON() (documenting current behavior)', () => {
      const error = new ApexError('Test error', ApexErrorCode.INTERNAL);
      const json = error.toJSON() as Record<string, unknown>;
      expect(json.stack).toBeDefined();
    });

    it('should include cause stack in getDetails() when cause is present', () => {
      const cause = new Error('Original error');
      const error = new ApexError('Wrapped error', ApexErrorCode.INTERNAL, {}, cause);
      const details = error.getDetails();
      expect(details.cause).toBeDefined();
      expect(details.cause?.stack).toBeDefined();
    });

    it('should omit stack in toString(false)', () => {
      const error = new ApexError('Safe message', ApexErrorCode.TASK_NOT_FOUND);
      const str = error.toString(false);
      expect(str).not.toMatch(/^\s+at\s+/m);
      expect(str).not.toContain('    at ');
    });

    it('should include stack in toString(true)', () => {
      const error = new ApexError('Debug message', ApexErrorCode.TASK_NOT_FOUND);
      const str = error.toString(true);
      expect(str).toContain(error.stack!);
    });

    it('toSafeErrorResponse() should NOT include stack traces', () => {
      const error = new ApexError('Test error', ApexErrorCode.INTERNAL);
      const safe = toSafeErrorResponse(error);
      expect(safe).toHaveProperty('errorId');
      expect(safe).toHaveProperty('code');
      expect(safe).toHaveProperty('message');
      expect(safe).not.toHaveProperty('stack');
      expect(safe).not.toHaveProperty('cause');
      expect(safe).not.toHaveProperty('context');
    });
  });

  // ==========================================================================
  // Category 2: Internal Path Leakage Prevention
  // ==========================================================================
  describe('Internal Path Leakage Prevention', () => {
    const PATH_MESSAGES = [
      'Failed to read /Users/developer/project/.apex/config.yaml',
      'ENOENT: no such file or directory /home/ubuntu/apex/data/apex.db',
      'Cannot find module at /Users/dev/project/node_modules/@anthropic-ai/sdk/dist/index.js',
      'Temporary file error at /tmp/apex-task-12345.json',
      'Permission denied: /var/lib/apex/data',
    ];

    it.each(PATH_MESSAGES)(
      'sanitizeErrorMessage should strip paths from: "%s"',
      (message) => {
        const sanitized = sanitizeErrorMessage(message);
        expectNoSensitivePaths(sanitized);
      }
    );

    it('toSafeErrorResponse should strip paths from error messages', () => {
      const error = new ApexError(
        'Failed to read /Users/developer/project/.apex/config.yaml',
        ApexErrorCode.FILE_NOT_FOUND
      );
      const safe = toSafeErrorResponse(error);
      expectNoSensitivePaths(safe.message);
    });

    it('should replace paths with [path] placeholder', () => {
      const sanitized = sanitizeErrorMessage(
        'Cannot open /Users/dev/project/.apex/config.yaml'
      );
      expect(sanitized).toContain('[path]');
      expect(sanitized).not.toContain('/Users/');
    });

    it('should handle messages with multiple paths', () => {
      const sanitized = sanitizeErrorMessage(
        'Copy failed: /home/user/src to /tmp/build-output'
      );
      expectNoSensitivePaths(sanitized);
      expect(sanitized.match(/\[path\]/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('should not modify messages without paths', () => {
      const message = 'Task not found';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toBe(message);
    });
  });

  // ==========================================================================
  // Category 3: Credential/Secret Leakage Prevention (using dummy fixtures)
  // ==========================================================================
  describe('Credential Leakage Prevention', () => {
    it('sanitizeErrorMessage should strip Anthropic-style keys', () => {
      const message = `Auth failed with key ${DUMMY_ANTHROPIC_KEY}`;
      const sanitized = sanitizeErrorMessage(message);
      expectNoSensitiveValues(sanitized);
      expect(sanitized).toContain('[redacted]');
    });

    it('sanitizeErrorMessage should strip bearer tokens', () => {
      const message = `Token: ${DUMMY_BEARER}`;
      const sanitized = sanitizeErrorMessage(message);
      expectNoSensitiveValues(sanitized);
    });

    it('sanitizeErrorMessage should strip postgres connection strings', () => {
      const message = `Connection failed: ${DUMMY_PG_CONN}`;
      const sanitized = sanitizeErrorMessage(message);
      expectNoSensitiveValues(sanitized);
    });

    it('sanitizeErrorMessage should strip mongodb connection strings', () => {
      const message = `Connection failed: ${DUMMY_MONGO_CONN}`;
      const sanitized = sanitizeErrorMessage(message);
      expectNoSensitiveValues(sanitized);
    });

    it('sanitizeErrorMessage should strip password values', () => {
      const message = 'Login failed: password= dummyTestValue123';
      const sanitized = sanitizeErrorMessage(message);
      expectNoSensitiveValues(sanitized);
    });

    it('sanitizeErrorMessage should strip generic api_key patterns', () => {
      const message = 'Request failed: api_key: dummy-test-fixture-key';
      const sanitized = sanitizeErrorMessage(message);
      expectNoSensitiveValues(sanitized);
    });

    it('sanitizeErrorMessage should strip token patterns', () => {
      const message = 'Expired: token: dummy.test.fixture';
      const sanitized = sanitizeErrorMessage(message);
      expectNoSensitiveValues(sanitized);
    });

    it('toSafeErrorResponse should strip credentials from error messages', () => {
      const error = new ApexError(
        `Auth failed with key ${DUMMY_ANTHROPIC_KEY}`,
        ApexErrorCode.API_ERROR
      );
      const safe = toSafeErrorResponse(error);
      expectNoSensitiveValues(safe.message);
    });

    it('should not modify messages without credentials', () => {
      const message = 'Task execution failed due to timeout';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toBe(message);
    });

    it('should handle mixed paths and credentials', () => {
      const sanitized = sanitizeErrorMessage(
        `Failed to auth at /Users/dev/.apex/config.yaml with key ${DUMMY_ANTHROPIC_KEY}`
      );
      expectNoSensitivePaths(sanitized);
      expectNoSensitiveValues(sanitized);
    });
  });

  // ==========================================================================
  // Category 4: Generic Error Messages for Security-Sensitive Failures
  // ==========================================================================
  describe('Generic Error Messages for Security-Sensitive Failures', () => {
    it('AUTHENTICATION_ERROR should use generic message', () => {
      const error = new ApexError(
        'Invalid API key provided for internal endpoint',
        ApexErrorCode.AUTHENTICATION_ERROR,
        { userId: 'user-123' }
      );
      const safe = toSafeErrorResponse(error);
      expect(safe.message).toBe('Authentication failed');
      expect(safe.message).not.toContain('Invalid API key');
    });

    it('FILE_ACCESS_DENIED should use generic message', () => {
      const error = new ApexError(
        'Permission denied: /Users/dev/secrets/data.json',
        ApexErrorCode.FILE_ACCESS_DENIED
      );
      const safe = toSafeErrorResponse(error);
      expect(safe.message).toBe('Access denied');
      expect(safe.message).not.toContain('/Users/');
    });

    it('DATABASE_CONNECTION_FAILED should use generic message', () => {
      const error = new ApexError(
        `Connection refused: ${DUMMY_PG_CONN}`,
        ApexErrorCode.DATABASE_CONNECTION_FAILED
      );
      const safe = toSafeErrorResponse(error);
      expect(safe.message).toBe('Service temporarily unavailable');
      expect(safe.message).not.toContain('postgres');
    });

    it('DATABASE_QUERY_FAILED should use generic message', () => {
      const error = new ApexError(
        'SELECT * FROM users WHERE id = 123 failed: syntax error',
        ApexErrorCode.DATABASE_QUERY_FAILED
      );
      const safe = toSafeErrorResponse(error);
      expect(safe.message).toBe('Service temporarily unavailable');
      expect(safe.message).not.toContain('SELECT');
    });

    it('CONFIGURATION should use generic message', () => {
      const error = new ApexError(
        'Invalid config value for database setting',
        ApexErrorCode.CONFIGURATION
      );
      const safe = toSafeErrorResponse(error);
      expect(safe.message).toBe('Configuration error');
    });

    it('RATE_LIMIT_EXCEEDED should use generic message', () => {
      const error = new ApexError(
        'Rate limit exceeded for internal-user on /api/v1/tasks',
        ApexErrorCode.RATE_LIMIT_EXCEEDED
      );
      const safe = toSafeErrorResponse(error);
      expect(safe.message).toBe('Rate limit exceeded, please try again later');
      expect(safe.message).not.toContain('internal-user');
    });

    it('non-sensitive error codes should still sanitize the message', () => {
      const error = new ApexError(
        'Task failed at /Users/dev/project/src/index.ts',
        ApexErrorCode.TASK_EXECUTION_FAILED
      );
      const safe = toSafeErrorResponse(error);
      expectNoSensitivePaths(safe.message);
    });

    it('safe response should always include errorId for log correlation', () => {
      const error = new ApexError('Something failed', ApexErrorCode.INTERNAL);
      const safe = toSafeErrorResponse(error);
      expect(safe.errorId).toMatch(/^apex_err_/);
      expect(safe.code).toBe(ApexErrorCode.INTERNAL);
    });
  });

  // ==========================================================================
  // Category 5: ApexError Serialization Security
  // ==========================================================================
  describe('ApexError Serialization Security', () => {
    it('toSafeErrorResponse should not expose context metadata', () => {
      const error = new ApexError(
        'Operation failed',
        ApexErrorCode.INTERNAL,
        {
          taskId: 'task-123',
          agentId: 'developer',
          metadata: {
            internalPath: '/Users/dev/project',
          },
        }
      );
      const safe = toSafeErrorResponse(error);
      const safeStr = JSON.stringify(safe);
      expect(safeStr).not.toContain('/Users/dev');
      expect(safeStr).not.toContain('task-123');
      expect(safeStr).not.toContain('developer');
    });

    it('toSafeErrorResponse should not include cause chain', () => {
      const rootCause = new Error('ECONNREFUSED at internal host');
      const wrappedError = new ApexError(
        'Database unavailable',
        ApexErrorCode.DATABASE_CONNECTION_FAILED,
        {},
        rootCause
      );
      const safe = toSafeErrorResponse(wrappedError);
      const safeStr = JSON.stringify(safe);
      expect(safeStr).not.toContain('ECONNREFUSED');
      expect(safeStr).not.toContain('internal host');
    });

    it('safe response has minimal properties only', () => {
      const error = new ApexError('Test', ApexErrorCode.UNKNOWN);
      const safe = toSafeErrorResponse(error);
      const keys = Object.keys(safe);
      expect(keys).toEqual(['errorId', 'code', 'message']);
    });
  });

  // ==========================================================================
  // Category 6: Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle empty error messages', () => {
      const sanitized = sanitizeErrorMessage('');
      expect(sanitized).toBe('');
    });

    it('should handle error messages with only paths', () => {
      const sanitized = sanitizeErrorMessage('/Users/dev/.apex/config.yaml');
      expectNoSensitivePaths(sanitized);
    });

    it('should handle error messages with only credentials', () => {
      const sanitized = sanitizeErrorMessage(DUMMY_ANTHROPIC_KEY);
      expectNoSensitiveValues(sanitized);
    });

    it('should preserve error message structure after sanitization', () => {
      const sanitized = sanitizeErrorMessage(
        'Error: Failed to read file at /Users/dev/test.ts (permission denied)'
      );
      expect(sanitized).toContain('Error:');
      expect(sanitized).toContain('(permission denied)');
    });

    it('should handle very long error messages', () => {
      const longPath = '/Users/dev/' + 'a'.repeat(1000) + '/file.ts';
      const sanitized = sanitizeErrorMessage(`Error at ${longPath}`);
      expectNoSensitivePaths(sanitized);
    });

    it('toSafeErrorResponse should work with minimal ApexError', () => {
      const error = new ApexError('Simple error');
      const safe = toSafeErrorResponse(error);
      expect(safe.errorId).toBeDefined();
      expect(safe.code).toBe(ApexErrorCode.UNKNOWN);
      expect(safe.message).toBe('Simple error');
    });
  });
});
