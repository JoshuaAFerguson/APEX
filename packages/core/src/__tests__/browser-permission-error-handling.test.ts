/**
 * Unit tests for Browser Permission Denied Error Handling Infrastructure
 *
 * Tests verify:
 * 1. BrowserPermissionDeniedError class functionality
 * 2. Browser resource cleanup on permission denial
 * 3. State tracking to prevent resource leaks
 * 4. Graceful error handling without process crashes
 * 5. Proper error messaging and metadata
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserPermissionDeniedError } from '../types.js';
import { BrowserTool } from '../tools/browser/browser-tool.js';

describe('Browser Permission Denied Error Handling', () => {
  let browserTool: BrowserTool;
  let cleanupSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cleanupSpy = vi.fn().mockResolvedValue(undefined);
    browserTool = new BrowserTool({
      allowJavaScriptExecution: false,
      allowFormSubmission: false,
    });
  });

  afterEach(async () => {
    // Cleanup all sessions after each test
    await browserTool.cleanupAllSessions();
    vi.clearAllMocks();
  });

  describe('BrowserPermissionDeniedError Class', () => {
    it('should create error with meaningful message and metadata', () => {
      const error = new BrowserPermissionDeniedError({
        operation: 'evaluate',
        scope: 'javascript',
        tool: 'browser',
        deniedBy: 'security-policy',
        reason: 'JavaScript execution disabled',
        sessionId: 'test-session-123',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BrowserPermissionDeniedError);
      expect(error.name).toBe('BrowserPermissionDeniedError');
      expect(error.message).toBe('JavaScript execution disabled');
      expect(error.operation).toBe('evaluate');
      expect(error.scope).toBe('javascript');
      expect(error.tool).toBe('browser');
      expect(error.deniedBy).toBe('security-policy');
      expect(error.sessionId).toBe('test-session-123');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should provide detailed error message', () => {
      const error = new BrowserPermissionDeniedError({
        operation: 'submit',
        scope: 'form-submission',
        deniedBy: 'user',
        sessionId: 'sess-456',
      });

      const detailedMessage = error.getDetailedMessage();
      expect(detailedMessage).toContain("operation 'submit'");
      expect(detailedMessage).toContain("scope: 'form-submission'");
      expect(detailedMessage).toContain('denied by: user');
      expect(detailedMessage).toContain('session: sess-456');
    });

    it('should execute cleanup function when provided', async () => {
      const error = new BrowserPermissionDeniedError({
        operation: 'click',
        cleanup: cleanupSpy,
      });

      await error.executeCleanup();

      expect(cleanupSpy).toHaveBeenCalledOnce();
    });

    it('should handle cleanup errors gracefully', async () => {
      const failingCleanup = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const error = new BrowserPermissionDeniedError({
        operation: 'navigate',
        cleanup: failingCleanup,
      });

      // Should not throw even if cleanup fails
      await expect(error.executeCleanup()).resolves.toBeUndefined();

      expect(failingCleanup).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should serialize to JSON correctly', () => {
      const error = new BrowserPermissionDeniedError({
        operation: 'screenshot',
        scope: 'capture',
        deniedBy: 'admin-policy',
        sessionId: 'json-test-session',
        reason: 'Screenshots disabled in production',
      });

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'BrowserPermissionDeniedError',
        message: 'Screenshots disabled in production',
        operation: 'screenshot',
        scope: 'capture',
        tool: 'browser',
        deniedBy: 'admin-policy',
        timestamp: expect.any(String),
        sessionId: 'json-test-session',
      });

      // Verify timestamp is valid ISO string
      expect(new Date(json.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Browser Tool Error Handling', () => {
    it('should return structured error response for permission denial', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' },
      });

      expect(result.success).toBe(false);
      expect(result.operation).toBe('evaluate');
      expect(result.error).toContain('requires elevated permissions');
      expect(result.permissionDenied).toBe(true);
      expect(result.sessionId).toMatch(/^browser-session-\d+-[a-z0-9]+$/);
      expect(result.metadata).toEqual({
        operation: 'evaluate',
        permissionDenied: true,
        deniedBy: 'security-policy',
        timestamp: expect.any(String),
      });
    });

    it('should return structured error response for form submission denial', async () => {
      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#form' },
      });

      expect(result.success).toBe(false);
      expect(result.operation).toBe('submit');
      expect(result.permissionDenied).toBe(true);
      expect(result.error).toContain('requires elevated permissions');
    });

    it('should allow permitted operations', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.permissionDenied).toBeUndefined();
      expect(result.sessionId).toMatch(/^browser-session-\d+-[a-z0-9]+$/);
    });

    it('should not crash on invalid operation parameters', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: {} as any, // Missing required URL
      });

      expect(result).toBeDefined();
      // Should return an error response, not crash
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Session Management and Cleanup', () => {
    it('should track active sessions', async () => {
      // Execute an operation to create a session
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.sessionId).toBeDefined();

      // Verify session is tracked internally
      // Note: This would require exposing session tracking for testing
      // In a real implementation, we might have a getActiveSessions() method
    });

    it('should cleanup all sessions on demand', async () => {
      // Create multiple sessions
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      await browserTool.execute({
        operation: 'screenshot',
        params: {},
      });

      // Cleanup all sessions
      await expect(browserTool.cleanupAllSessions()).resolves.toBeUndefined();
    });

    it('should clear permission cache', () => {
      // This should not throw
      expect(() => browserTool.clearPermissionCache()).not.toThrow();
    });
  });

  describe('Permission Caching', () => {
    it('should cache permission decisions', async () => {
      // First call - should check permission
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      // Second call - should use cached permission
      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.org' },
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should cache denial decisions', async () => {
      // First call - should check and deny
      const result1 = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'test' },
      });

      // Second call - should use cached denial
      const result2 = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'other test' },
      });

      expect(result1.success).toBe(false);
      expect(result1.permissionDenied).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.permissionDenied).toBe(true);
      expect(result2.error).toContain('cached');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle concurrent operations gracefully', async () => {
      const operations = [
        browserTool.execute({ operation: 'navigate', params: { url: 'https://test1.com' } }),
        browserTool.execute({ operation: 'navigate', params: { url: 'https://test2.com' } }),
        browserTool.execute({ operation: 'screenshot', params: {} }),
        browserTool.execute({ operation: 'evaluate', params: { script: 'test' } }), // Will be denied
      ];

      const results = await Promise.allSettled(operations);

      // All operations should complete without crashes
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // Check that some succeeded and permission denial was handled gracefully
      const values = results.map(r => (r as PromiseFulfilledResult<any>).value);
      const successful = values.filter(v => v.success);
      const denied = values.filter(v => v.permissionDenied);

      expect(successful.length).toBeGreaterThan(0);
      expect(denied.length).toBeGreaterThan(0);
    });

    it('should maintain tool state after errors', async () => {
      // Cause a permission error
      await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'test' },
      });

      // Tool should still be usable for permitted operations
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
    });

    it('should handle browser tool configuration changes', () => {
      const newTool = browserTool.withConfig({
        allowJavaScriptExecution: true,
      });

      expect(newTool).toBeInstanceOf(BrowserTool);
      expect(newTool).not.toBe(browserTool); // Should be a new instance

      const config = newTool.getConfig();
      expect(config.allowJavaScriptExecution).toBe(true);
    });
  });

  describe('Edge Cases and Error Boundaries', () => {
    it('should handle null/undefined cleanup functions', async () => {
      const error = new BrowserPermissionDeniedError({
        operation: 'test',
        cleanup: undefined,
      });

      await expect(error.executeCleanup()).resolves.toBeUndefined();
    });

    it('should handle extremely long operation names', async () => {
      const longOperation = 'a'.repeat(1000);
      const error = new BrowserPermissionDeniedError({
        operation: longOperation,
      });

      expect(error.operation).toBe(longOperation);
      expect(error.getDetailedMessage()).toContain(longOperation);
    });

    it('should handle special characters in operation names', async () => {
      const specialOperation = 'eval<script>alert("xss")</script>';
      const error = new BrowserPermissionDeniedError({
        operation: specialOperation,
      });

      expect(error.operation).toBe(specialOperation);
      // Should not execute the script, just treat as a string
      expect(error.getDetailedMessage()).toContain(specialOperation);
    });
  });
});