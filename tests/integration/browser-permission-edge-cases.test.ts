/**
 * Browser Permission Edge Cases and Advanced Scenarios
 *
 * This test suite covers complex permission scenarios and edge cases:
 * 1. Permission escalation and degradation
 * 2. Complex domain handling and subdomain permissions
 * 3. Operation chaining with permission dependencies
 * 4. Error recovery and cleanup scenarios
 * 5. Session state management across permission changes
 * 6. Performance and concurrency edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { TaskStore } from '@apexcli/orchestrator';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';
import { createTestTask, MockBrowserSession } from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

import type {
  Task,
  PermissionLevel,
  BrowserSession,
  BrowserSessionConfig,
  ToolPermissionResult,
} from '@apexcli/core';

describe('Browser Permission Edge Cases and Advanced Scenarios', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let testTask: Task;
  let mockSession: MockBrowserSession;
  let permissionEvents: any[] = [];
  let eventEmitter: EventEmitter;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-permission-edge-'));

    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();

    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
      eventEmitter,
      taskId: testTask.id,
    });

    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['example.com', 'test.local', 'subdomain.example.com'],
      blockedDomains: ['blocked.com', 'malicious.site'],
    });

    // Mock browser page with more detailed behavior
    vi.spyOn(browserTool as any, 'ensurePage').mockResolvedValue({
      backend: 'playwright',
      page: {
        url: () => 'https://example.com',
        title: () => Promise.resolve('Test Page'),
        goto: vi.fn((url) => {
          if (url.includes('slow.example.com')) {
            return new Promise(resolve => setTimeout(() => resolve({ status: () => 200 }), 100));
          }
          return Promise.resolve({ status: () => 200 });
        }),
        click: vi.fn().mockResolvedValue(undefined),
        fill: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
        evaluate: vi.fn((payload) => {
          if (payload?.snippet?.includes('throw')) {
            throw new Error('Script execution failed');
          }
          return Promise.resolve('evaluation result');
        }),
        locator: vi.fn().mockReturnValue({
          evaluate: vi.fn().mockResolvedValue(undefined),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        }),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        getAttribute: vi.fn().mockResolvedValue('attribute-value'),
        textContent: vi.fn().mockResolvedValue('text content'),
        content: vi.fn().mockResolvedValue('<html></html>'),
        innerHTML: vi.fn().mockResolvedValue('<div></div>'),
        hover: vi.fn().mockResolvedValue(undefined),
        viewportSize: () => ({ width: 1920, height: 1080 }),
      },
    });

    permissionEvents = [];
    eventEmitter.on('permission:granted', (event) => {
      permissionEvents.push({ type: 'granted', ...event });
    });
    eventEmitter.on('permission:denied', (event) => {
      permissionEvents.push({ type: 'denied', ...event });
    });
  });

  afterEach(async () => {
    await browserTool?.cleanup();
    await taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    eventEmitter.removeAllListeners();
  });

  describe('Permission Escalation and Degradation', () => {
    it('should handle permission escalation during workflow', async () => {
      // Start with basic navigation permission
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Navigate successfully
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
      expect(navResult.success).toBe(true);

      // Attempt screenshot without permission (should fail)
      const screenshotResult1 = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: false },
      } as any);
      expect(screenshotResult1.success).toBe(false);

      // Grant screenshot permission
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

      // Screenshot should now succeed
      const screenshotResult2 = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: false },
      } as any);
      expect(screenshotResult2.success).toBe(true);
    });

    it('should handle permission downgrade scenarios', async () => {
      // Start with full permissions
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Execute various operations successfully
      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button1' } },
        { operation: 'screenshot', params: { fullPage: false } },
      ];

      for (const op of operations) {
        const result = await browserTool.execute(op as any);
        expect(result.success).toBe(true);
      }

      // Revoke specific permissions
      await permissionManager.denyPermission('Browser', 'screenshot');
      await permissionManager.denyPermission('Browser', 'click');

      // Navigation should still work
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page2' },
      } as any);
      expect(navResult.success).toBe(true);

      // But screenshot and click should fail
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: false },
      } as any);
      expect(screenshotResult.success).toBe(false);

      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button2' },
      } as any);
      expect(clickResult.success).toBe(false);
    });
  });

  describe('Complex Domain and Subdomain Handling', () => {
    it('should handle subdomain permissions correctly', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Test navigation to main domain
      const mainResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
      expect(mainResult.success).toBe(true);

      // Test navigation to allowed subdomain
      const subResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://subdomain.example.com' },
      } as any);
      expect(subResult.success).toBe(true);
    });

    it('should handle domain permission inheritance', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Test multiple levels of subdomains
      const domains = [
        'https://example.com',
        'https://api.example.com',
        'https://www.example.com',
        'https://cdn.subdomain.example.com',
      ];

      for (const domain of domains) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: domain },
        } as any);

        // Should succeed for allowed domains based on mock configuration
        if (domain.includes('example.com')) {
          expect(result.success).toBe(true);
        }
      }
    });

    it('should handle domain-specific permission scoping', async () => {
      // Grant permission only for specific domain operations
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:https://example.com');

      const allowedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
      expect(allowedResult.success).toBe(true);

      const deniedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.local' },
      } as any);
      expect(deniedResult.success).toBe(false);
    });
  });

  describe('Operation Chaining and Dependencies', () => {
    it('should handle dependent operation sequences', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Execute a sequence where each operation depends on the previous
      const sequence = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#load-content' } },
        { operation: 'waitForSelector', params: { selector: '.dynamic-content' } },
        { operation: 'getText', params: { selector: '.dynamic-content' } },
        { operation: 'screenshot', params: { fullPage: false } },
      ];

      const results = [];
      for (const step of sequence) {
        const result = await browserTool.execute(step as any);
        results.push(result);
        expect(result.success).toBe(true);
      }

      // Verify all steps completed successfully
      expect(results.length).toBe(sequence.length);
      results.forEach(result => expect(result.success).toBe(true));
    });

    it('should handle partial failure in operation chains', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.grantPermission('Browser', 'allow-once', 'click');

      // First operations should succeed
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
      expect(navResult.success).toBe(true);

      const clickResult1 = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button1' },
      } as any);
      expect(clickResult1.success).toBe(true);

      // Second click should fail (allow-once consumed)
      const clickResult2 = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button2' },
      } as any);
      expect(clickResult2.success).toBe(false);

      // But navigation should still work
      const navResult2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page2' },
      } as any);
      expect(navResult2.success).toBe(true);
    });
  });

  describe('Error Recovery and Session Management', () => {
    it('should handle browser errors without affecting permission state', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate');

      // Successful evaluation
      const goodResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return document.title;' },
      } as any);
      expect(goodResult.success).toBe(true);

      // Failed evaluation (but permission should still be valid)
      const badResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'throw new Error("test error");' },
      } as any);
      expect(badResult.success).toBe(false);
      expect(badResult.error).toContain('Script execution failed');

      // Next evaluation should work (permission still valid)
      const recoveryResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return "recovered";' },
      } as any);
      expect(recoveryResult.success).toBe(true);
    });

    it('should maintain session state across permission checks', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Initial session state
      const initialState = browserTool.getResourceState();
      expect(initialState.sessionId).toBeDefined();

      // Execute operation
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
      expect(result.success).toBe(true);

      // Session state should be consistent
      const afterState = browserTool.getResourceState();
      expect(afterState.sessionId).toBe(initialState.sessionId);
    });

    it('should handle cleanup on permission system failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Mock permission manager failure
      const originalCheck = permissionManager.checkToolPermission.bind(permissionManager);
      vi.spyOn(permissionManager, 'checkToolPermission').mockImplementation(async (...args) => {
        // Fail after first call
        if (permissionManager.checkToolPermission.name === 'mockImplementation') {
          throw new Error('Permission system failure');
        }
        return originalCheck(...args);
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission system failure');
    });
  });

  describe('Performance and Concurrency Edge Cases', () => {
    it('should handle rapid permission changes', async () => {
      // Rapidly change permissions while executing operations
      const operations = [];
      const permissionChanges = [];

      for (let i = 0; i < 5; i++) {
        // Schedule permission grant
        permissionChanges.push(
          permissionManager.grantPermission('Browser', 'allow-once', 'navigate')
        );

        // Schedule operation
        operations.push(
          browserTool.execute({
            operation: 'navigate',
            params: { url: `https://example.com/page${i}` },
          } as any)
        );

        // Add small delay to create interleaving
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for all to complete
      await Promise.all(permissionChanges);
      const results = await Promise.all(operations);

      // Some operations should succeed, others might fail due to timing
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('should handle high-frequency operations with stable permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Execute many operations quickly
      const operations = Array.from({ length: 20 }, (_, i) =>
        browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/page${i}` },
        } as any)
      );

      const results = await Promise.all(operations);

      // All should succeed with stable permissions
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metadata?.permissionGranted).toBe(true);
      });

      // Verify all permission events were recorded
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBe(20);
    });

    it('should handle timeout scenarios gracefully', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Execute operation with potential timeout
      const slowResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://slow.example.com', timeout: 50 },
      } as any);

      // Operation should complete (mock includes delay handling)
      expect(slowResult.success).toBe(true);
      expect(slowResult.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Permission Scope Edge Cases', () => {
    it('should handle wildcard permission scopes', async () => {
      // Grant wildcard permission for all click operations
      await permissionManager.grantPermission('Browser', 'allow-always', 'click:*');

      const clickResults = await Promise.all([
        browserTool.execute({
          operation: 'click',
          params: { selector: '#button1' },
        } as any),
        browserTool.execute({
          operation: 'click',
          params: { selector: '.menu-item' },
        } as any),
        browserTool.execute({
          operation: 'click',
          params: { selector: '[data-action="submit"]' },
        } as any),
      ]);

      clickResults.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle nested permission scopes', async () => {
      // Grant permission for specific nested scopes
      await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate:dom-read');
      await permissionManager.denyPermission('Browser', 'evaluate:dom-write');

      // Read operation should succeed
      const readResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return document.title;' },
      } as any);
      expect(readResult.success).toBe(true);

      // Write operation should be blocked at permission level
      // (In a real implementation, this would check the script content)
    });

    it('should handle permission scope inheritance', async () => {
      // Grant broad permission
      await permissionManager.grantPermission('Browser', 'allow-always', 'element-interaction');

      // All element interaction operations should inherit this permission
      const operations = [
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'hover', params: { selector: '.tooltip' } },
        { operation: 'getAttribute', params: { selector: '#input', attribute: 'value' } },
        { operation: 'getText', params: { selector: 'h1' } },
      ];

      for (const op of operations) {
        const result = await browserTool.execute(op as any);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Resource Cleanup Edge Cases', () => {
    it('should handle cleanup when browser is in inconsistent state', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Execute operation to initialize browser
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      // Simulate browser in inconsistent state
      const resourceState = browserTool.getResourceState();
      expect(resourceState.sessionId).toBeDefined();

      // Cleanup should handle this gracefully
      await expect(browserTool.cleanup()).resolves.not.toThrow();

      // Tool should be in destroyed state
      expect(browserTool.getState()).toBe('destroyed');
    });

    it('should handle multiple cleanup calls safely', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Execute operation
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      // Multiple cleanup calls should be safe
      await browserTool.cleanup();
      await browserTool.cleanup();
      await browserTool.cleanup();

      expect(browserTool.getState()).toBe('destroyed');
    });
  });
});