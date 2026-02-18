/**
 * Permission Error Integration Test
 *
 * This test verifies that the PermissionRevokedError can be properly imported
 * from @apexcli/core and works correctly with our test infrastructure.
 */
import { describe, it, expect } from 'vitest';
import { PermissionRevokedError, ApexErrorCode } from '@apexcli/core';

describe('PermissionRevokedError Integration', () => {
  it('should create PermissionRevokedError with correct properties', () => {
    const error = new PermissionRevokedError('Test permission revoked message');

    // Test instance and name
    expect(error).toBeInstanceOf(PermissionRevokedError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PermissionRevokedError');

    // Test message
    expect(error.message).toBe('Test permission revoked message');

    // Test legacy code property for backward compatibility
    expect(error.code).toBe('PERMISSION_REVOKED');

    // Test stack trace exists
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('PermissionRevokedError');
  });

  it('should use default message when none provided', () => {
    const error = new PermissionRevokedError();
    expect(error.message).toBe('Permission was revoked during operation');
    expect(error.code).toBe('PERMISSION_REVOKED');
  });

  it('should work correctly with instanceof checks', () => {
    const error = new PermissionRevokedError('Test');
    const genericError = new Error('Generic');

    expect(error instanceof PermissionRevokedError).toBe(true);
    expect(error instanceof Error).toBe(true);
    expect(genericError instanceof PermissionRevokedError).toBe(false);
  });

  it('should be catchable in try-catch blocks', () => {
    expect(() => {
      try {
        throw new PermissionRevokedError('Test revocation');
      } catch (err) {
        expect(err).toBeInstanceOf(PermissionRevokedError);
        expect((err as PermissionRevokedError).code).toBe('PERMISSION_REVOKED');
        throw err; // Re-throw to test catch behavior
      }
    }).toThrow(PermissionRevokedError);
  });

  it('should work with async/await error handling', async () => {
    const asyncFunction = async () => {
      throw new PermissionRevokedError('Async permission revoked');
    };

    await expect(asyncFunction()).rejects.toThrow(PermissionRevokedError);
    await expect(asyncFunction()).rejects.toThrow('Async permission revoked');

    try {
      await asyncFunction();
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionRevokedError);
      expect((err as PermissionRevokedError).code).toBe('PERMISSION_REVOKED');
    }
  });

  it('should include context information when provided', () => {
    const error = new PermissionRevokedError('Test message', {
      taskId: 'test-task-123',
      agentId: 'test-agent',
      operation: 'file-write'
    });

    expect(error.context.taskId).toBe('test-task-123');
    expect(error.context.agentId).toBe('test-agent');
    expect(error.context.operation).toBe('file-write');
    expect(error.context.timestamp).toBeInstanceOf(Date);
  });
});