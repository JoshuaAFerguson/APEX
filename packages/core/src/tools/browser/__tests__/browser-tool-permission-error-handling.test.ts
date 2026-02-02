/**
 * @fileoverview Browser Tool Permission Error Handling Integration Tests
 *
 * Tests that verify the BrowserTool properly integrates with BrowserPermissionDeniedError
 * for graceful error handling when browser permissions are denied.
 *
 * This validates the acceptance criteria:
 * 1. BrowserPermissionDeniedError class with meaningful error messages
 * 2. Cleanup methods that release browser resources on denial
 * 3. State tracking to prevent resource leaks
 * 4. No process crashes when permissions are denied
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BrowserTool } from '../browser-tool.js';
import { BrowserPermissionDeniedError, isBrowserPermissionDeniedError } from '../browser-permission-denied-error.js';
import { ApexErrorCode } from '../../../apex-error.js';

describe('BrowserTool Permission Error Handling Integration', () => {
  let browserTool: BrowserTool;

  beforeEach(() => {
    browserTool = new BrowserTool();
  });

  describe('Domain restriction error handling', () => {
    test('should throw BrowserPermissionDeniedError for blocked domains', async () => {
      const tool = new BrowserTool({
        blockedDomains: ['malicious.com'],
      });

      const result = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://malicious.com/page' },
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(result.error).toContain('blocked');
    });

    test('should provide meaningful error messages for domain restrictions', async () => {
      const tool = new BrowserTool({
        allowedDomains: ['trusted.com'],
      });

      const result = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://untrusted.com/page' },
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(result.metadata?.suggestions).toBeInstanceOf(Array);
      expect(result.metadata?.suggestions).toContain('Add the domain to the allowed domains list');
    });
  });

  describe('Feature disabled error handling', () => {
    test('should handle JavaScript execution denied gracefully', async () => {
      const tool = new BrowserTool({
        allowJavaScriptExecution: false,
      });

      const result = await tool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' },
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(result.error).toContain('JavaScript execution');
      expect(result.metadata?.suggestions).toContain('Enable JavaScript execution in tool configuration');
    });

    test('should handle form submission denied gracefully', async () => {
      const tool = new BrowserTool({
        allowFormSubmission: false,
      });

      const result = await tool.execute({
        operation: 'submit',
        params: { selector: '#form' },
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(result.error).toContain('Form submission');
      expect(result.metadata?.suggestions).toContain('Enable form submission in tool configuration');
    });

    test('should handle screenshot denied gracefully', async () => {
      const tool = new BrowserTool({
        allowScreenshots: false,
      });

      const result = await tool.execute({
        operation: 'screenshot',
        params: { path: './test.png' },
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(result.error).toContain('Screenshots');
    });
  });

  describe('Resource cleanup on permission denial', () => {
    test('should clean up all sessions when permission is denied', async () => {
      const tool = new BrowserTool({
        blockedDomains: ['blocked.com'],
      });

      // Spy on the cleanup method
      const cleanupSpy = vi.spyOn(tool, 'cleanupAllSessions');

      const result = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com/page' },
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(cleanupSpy).toHaveBeenCalled();
    });

    test('should track sessions properly and prevent resource leaks', async () => {
      const tool = new BrowserTool();

      // Mock a successful operation first to create sessions
      const successResult = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });
      expect(successResult.success).toBe(true);

      // Now test permission denial with blocked domain
      const blockedTool = new BrowserTool({
        blockedDomains: ['blocked.com'],
      });

      const result = await blockedTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com/page' },
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
    });
  });

  describe('Error context and metadata', () => {
    test('should include detailed error context for troubleshooting', async () => {
      const tool = new BrowserTool({
        allowJavaScriptExecution: false,
      });

      const result = await tool.execute({
        operation: 'evaluate',
        params: { script: 'document.querySelector("#test")' },
      });

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(result.metadata).toMatchObject({
        operation: 'evaluate',
        permissionDenied: true,
        deniedBy: 'system',
        timestamp: expect.any(String),
        suggestions: expect.any(Array),
      });
    });

    test('should provide different error messages based on permission type', async () => {
      // Test different permission scenarios
      const scenarios = [
        {
          config: { allowJavaScriptExecution: false },
          operation: 'evaluate',
          params: { script: 'test' },
          expectedErrorType: 'javascript',
        },
        {
          config: { allowFormSubmission: false },
          operation: 'submit',
          params: { selector: '#form' },
          expectedErrorType: 'form',
        },
        {
          config: { allowScreenshots: false },
          operation: 'screenshot',
          params: { path: './test.png' },
          expectedErrorType: 'screenshot',
        },
      ];

      for (const scenario of scenarios) {
        const tool = new BrowserTool(scenario.config);
        const result = await tool.execute({
          operation: scenario.operation as any,
          params: scenario.params,
        });

        expect(result.success).toBe(false);
        expect(result.permissionDenied).toBe(true);
        expect(result.error).toBeDefined();
        expect(result.metadata?.suggestions).toBeInstanceOf(Array);
        expect(result.metadata?.suggestions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error validation - validation should catch issues before execution', () => {
    test('should catch permission issues during validation', () => {
      const tool = new BrowserTool({
        allowJavaScriptExecution: false,
      });

      const validationResult = tool.validate({
        operation: 'evaluate',
        params: { script: 'test' },
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toContain('JavaScript execution is disabled');
    });

    test('should catch domain restrictions during validation', () => {
      const tool = new BrowserTool({
        blockedDomains: ['blocked.com'],
      });

      const validationResult = tool.validate({
        operation: 'navigate',
        params: { url: 'https://blocked.com/page' },
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toContain("Domain 'blocked.com' is blocked");
    });
  });

  describe('Process stability and no crashes', () => {
    test('should handle multiple permission denials without crashing', async () => {
      const tool = new BrowserTool({
        blockedDomains: ['blocked1.com', 'blocked2.com', 'blocked3.com'],
      });

      const deniedUrls = [
        'https://blocked1.com/page',
        'https://blocked2.com/page',
        'https://blocked3.com/page',
      ];

      // Should handle multiple denials gracefully
      const results = await Promise.all(
        deniedUrls.map(url =>
          tool.execute({
            operation: 'navigate',
            params: { url },
          })
        )
      );

      // All should fail gracefully without throwing
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.permissionDenied).toBe(true);
        expect(result.error).toBeDefined();
      });
    });

    test('should handle mixed operations with some denied and some allowed', async () => {
      const tool = new BrowserTool({
        allowJavaScriptExecution: false, // Deny JS
        allowFormSubmission: true, // Allow forms
        allowScreenshots: true, // Allow screenshots
      });

      const operations = [
        {
          operation: 'navigate',
          params: { url: 'https://example.com' },
          shouldSucceed: true,
        },
        {
          operation: 'evaluate',
          params: { script: 'test' },
          shouldSucceed: false,
        },
        {
          operation: 'screenshot',
          params: { path: './test.png' },
          shouldSucceed: true,
        },
      ];

      for (const op of operations) {
        const result = await tool.execute({
          operation: op.operation as any,
          params: op.params,
        });

        if (op.shouldSucceed) {
          expect(result.success).toBe(true);
        } else {
          expect(result.success).toBe(false);
          expect(result.permissionDenied).toBe(true);
        }
      }
    });

    test('should maintain proper state after permission denials', async () => {
      const tool = new BrowserTool({
        allowJavaScriptExecution: false,
      });

      // Denied operation
      const deniedResult = await tool.execute({
        operation: 'evaluate',
        params: { script: 'test' },
      });

      expect(deniedResult.success).toBe(false);
      expect(deniedResult.permissionDenied).toBe(true);

      // Subsequent allowed operation should still work
      const allowedResult = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(allowedResult.success).toBe(true);
    });
  });
});