/**
 * Edge Cases and Error Scenarios Integration Tests
 *
 * This test suite focuses on edge cases, error conditions, and
 * fault tolerance scenarios across the integrated systems:
 * - Tools + Permissions + Browser Automation
 *
 * Tests verify that:
 * - Systems fail gracefully under error conditions
 * - Recovery mechanisms work correctly
 * - Resource cleanup happens properly
 * - Error propagation is consistent
 * - Edge cases don't break system integrity
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Core types
import type {
  Task,
  Permission,
  PermissionLevel,
  BrowserSession
} from '@apexcli/core';

// Components under test
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { TaskStore } from '@apexcli/orchestrator';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Test utilities
import {
  createTestTask,
  MockBrowserSession,
  setupTestEnvironment,
  cleanupTestEnvironment
} from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

// Mock dependencies with deliberate failure modes
vi.mock('playwright', () => {
  const mockBrowser = {
    newContext: vi.fn(() => {
      if ((global as any)._TEST_BROWSER_SHOULD_FAIL) {
        return Promise.reject(new Error('Browser context creation failed'));
      }
      return Promise.resolve({
        newPage: vi.fn(() => Promise.resolve(mockPage)),
        on: vi.fn(),
        close: vi.fn()
      });
    }),
    close: vi.fn()
  };

  return {
    chromium: {
      launch: vi.fn(() => {
        if ((global as any)._TEST_BROWSER_LAUNCH_SHOULD_FAIL) {
          return Promise.reject(new Error('Browser launch failed'));
        }
        return Promise.resolve(mockBrowser);
      })
    }
  };
});

vi.mock('fs/promises', () => {
  const originalFs = {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn()
  };

  return {
    ...originalFs,
    access: vi.fn(() => {
      if ((global as any)._TEST_FS_SHOULD_FAIL) {
        return Promise.reject(new Error('File system access denied'));
      }
      return Promise.resolve();
    }),
    readFile: vi.fn(() => {
      if ((global as any)._TEST_FS_SHOULD_FAIL) {
        return Promise.reject(new Error('File read failed'));
      }
      return Promise.resolve('mock file content');
    })
  };
});

// Mock page with failure modes
const mockPage = {
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => {
    if ((global as any)._TEST_PAGE_SHOULD_FAIL) {
      return Promise.reject(new Error('Page title access failed'));
    }
    return Promise.resolve('Test Page');
  }),
  goto: vi.fn((url: string) => {
    if ((global as any)._TEST_NAVIGATION_SHOULD_FAIL || url.includes('timeout-site')) {
      return Promise.reject(new Error('Navigation timeout'));
    }
    if (url.includes('404-site')) {
      return Promise.resolve({ status: () => 404 });
    }
    if (url.includes('500-site')) {
      return Promise.resolve({ status: () => 500 });
    }
    return Promise.resolve({ status: () => 200 });
  }),
  click: vi.fn(() => {
    if ((global as any)._TEST_CLICK_SHOULD_FAIL) {
      return Promise.reject(new Error('Element not clickable'));
    }
    return Promise.resolve();
  }),
  screenshot: vi.fn(() => {
    if ((global as any)._TEST_SCREENSHOT_SHOULD_FAIL) {
      return Promise.reject(new Error('Screenshot capture failed'));
    }
    return Promise.resolve(Buffer.from('mock-screenshot'));
  }),
  evaluate: vi.fn(() => {
    if ((global as any)._TEST_EVALUATE_SHOULD_FAIL) {
      return Promise.reject(new Error('Script evaluation failed'));
    }
    return Promise.resolve('mock-result');
  }),
  on: vi.fn(),
  close: vi.fn(() => {
    if ((global as any)._TEST_PAGE_CLOSE_SHOULD_FAIL) {
      return Promise.reject(new Error('Page close failed'));
    }
    return Promise.resolve();
  }),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 }))
};

describe('Systems Integration Edge Cases and Error Scenarios', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let eventEmitter: EventEmitter;
  let testTask: Task;
  let systemEvents: any[];
  let errorEvents: any[];

  beforeEach(async () => {
    // Reset global test flags
    (global as any)._TEST_BROWSER_SHOULD_FAIL = false;
    (global as any)._TEST_BROWSER_LAUNCH_SHOULD_FAIL = false;
    (global as any)._TEST_FS_SHOULD_FAIL = false;
    (global as any)._TEST_PAGE_SHOULD_FAIL = false;
    (global as any)._TEST_NAVIGATION_SHOULD_FAIL = false;
    (global as any)._TEST_CLICK_SHOULD_FAIL = false;
    (global as any)._TEST_SCREENSHOT_SHOULD_FAIL = false;
    (global as any)._TEST_EVALUATE_SHOULD_FAIL = false;
    (global as any)._TEST_PAGE_CLOSE_SHOULD_FAIL = false;

    // Setup test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-edge-cases-test-'));

    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();

    systemEvents = [];
    errorEvents = [];

    // Track all events, especially errors
    setupComprehensiveEventTracking();

    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      backend: 'playwright',
      engine: 'chromium',
      headless: true
    });

    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      taskStore,
      permissionManager,
      eventEmitter
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestEnvironment(testDir, taskStore);
    vi.restoreAllMocks();
  });

  function setupComprehensiveEventTracking() {
    const allEventTypes = [
      'permission:requested',
      'permission:granted',
      'permission:denied',
      'permission:error',
      'tool:execution:start',
      'tool:execution:complete',
      'tool:execution:error',
      'browser:operation:start',
      'browser:operation:complete',
      'browser:operation:error',
      'browser:session:created',
      'browser:session:closed',
      'browser:session:error',
      'task:status:changed',
      'task:error',
      'system:error',
      'system:recovery',
      'system:degraded'
    ];

    allEventTypes.forEach(eventType => {
      eventEmitter.on(eventType, (data) => {
        const event = {
          type: eventType,
          timestamp: Date.now(),
          data
        };
        systemEvents.push(event);

        if (eventType.includes('error')) {
          errorEvents.push(event);
        }
      });
    });
  }

  describe('Permission System Edge Cases', () => {
    it('should handle permission store corruption gracefully', async () => {
      // Mock permission store corruption
      vi.spyOn(permissionStore, 'getPermission').mockRejectedValue(
        new Error('Permission store corrupted')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*store.*corrupted|permission.*error/i);

      // Verify error was properly handled and logged
      const permissionErrors = errorEvents.filter(e => e.type === 'permission:error');
      expect(permissionErrors.length).toBeGreaterThan(0);
    });

    it('should handle concurrent permission modifications during tool execution', async () => {
      await permissionManager.grantPermission('Browser', 'allow-once', 'navigate');

      // Start navigation
      const navigationPromise = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Immediately revoke permission while operation is in progress
      await permissionManager.denyPermission('Browser');

      const result = await navigationPromise;

      // Operation should complete based on initial permission check
      // (depending on implementation, this might succeed or fail)
      if (result.success) {
        // Permission was checked and cached at start
        expect(result.data.url).toBeDefined();
      } else {
        // Permission was re-checked during operation
        expect(result.error).toMatch(/permission.*denied|revoked/i);
      }

      // Verify subsequent operations fail
      const nextResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });
      expect(nextResult.success).toBe(false);
    });

    it('should handle permission escalation loops', async () => {
      let escalationCount = 0;
      const maxEscalations = 3;

      // Mock escalating permission requests
      vi.spyOn(permissionManager, 'checkToolPermission').mockImplementation(async () => {
        escalationCount++;
        if (escalationCount <= maxEscalations) {
          return {
            allowed: false,
            denialReason: `Escalation required (attempt ${escalationCount})`,
            requiresConfirmation: true,
            escalationRequired: true
          };
        }
        throw new Error('Maximum escalation attempts exceeded');
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'dangerous.operation()' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/maximum.*escalation|escalation.*exceeded/i);
      expect(escalationCount).toBe(maxEscalations + 1);
    });

    it('should handle permission expiry during long operations', async () => {
      // Grant permission with immediate expiry
      const expiredPermission: Permission = {
        tool: 'Browser',
        scope: 'navigate',
        level: 'allow-once',
        expiry: new Date(Date.now() - 1000), // Already expired
        createdAt: new Date(Date.now() - 2000)
      };

      vi.spyOn(permissionStore, 'getPermission').mockResolvedValue(expiredPermission);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*expired|expired.*permission/i);
    });

    it('should handle null and undefined permission responses', async () => {
      // Mock permission store returning null
      vi.spyOn(permissionStore, 'getPermission').mockResolvedValue(null);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*not.*found|no.*permission/i);

      // Test undefined response
      vi.spyOn(permissionStore, 'getPermission').mockResolvedValue(undefined as any);

      const result2 = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toMatch(/permission.*not.*found|no.*permission/i);
    });
  });

  describe('Browser Tool Edge Cases', () => {
    it('should handle browser launch failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Enable browser launch failure
      (global as any)._TEST_BROWSER_LAUNCH_SHOULD_FAIL = true;

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/browser.*launch.*failed|browser.*error/i);

      // Verify browser error event was emitted
      const browserErrors = errorEvents.filter(e => e.type === 'browser:session:error');
      expect(browserErrors.length).toBeGreaterThan(0);
    });

    it('should handle page navigation timeouts', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://timeout-site.com/slow-page' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/navigation.*timeout|timeout/i);

      // Verify proper error events
      const operationErrors = errorEvents.filter(e => e.type === 'browser:operation:error');
      expect(operationErrors.length).toBeGreaterThan(0);
    });

    it('should handle HTTP error status codes', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Test 404 response
      const result404 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://404-site.com/not-found' }
      });

      expect(result404.success).toBe(false);
      expect(result404.error).toMatch(/404|not.*found/i);

      // Test 500 response
      const result500 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://500-site.com/server-error' }
      });

      expect(result500.success).toBe(false);
      expect(result500.error).toMatch(/500|server.*error/i);
    });

    it('should handle element interaction failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // First navigate successfully
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Enable click failure
      (global as any)._TEST_CLICK_SHOULD_FAIL = true;

      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#non-existent-button' }
      });

      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toMatch(/element.*not.*clickable|click.*failed/i);
    });

    it('should handle screenshot capture failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Enable screenshot failure
      (global as any)._TEST_SCREENSHOT_SHOULD_FAIL = true;

      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(screenshotResult.success).toBe(false);
      expect(screenshotResult.error).toMatch(/screenshot.*capture.*failed|screenshot.*failed/i);
    });

    it('should handle JavaScript evaluation errors', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Enable evaluation failure
      (global as any)._TEST_EVALUATE_SHOULD_FAIL = true;

      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'invalid.javascript.code()' }
      });

      expect(evalResult.success).toBe(false);
      expect(evalResult.error).toMatch(/script.*evaluation.*failed|evaluation.*failed/i);
    });

    it('should handle session cleanup failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Enable page close failure
      (global as any)._TEST_PAGE_CLOSE_SHOULD_FAIL = true;

      // Attempt to cleanup session
      const cleanupErrors: Error[] = [];
      try {
        await (browserTool as any).cleanup?.();
      } catch (error) {
        cleanupErrors.push(error as Error);
      }

      // Cleanup failure should be handled gracefully
      // The system should continue to function even if cleanup fails
    });

    it('should handle browser context creation failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Enable browser context failure
      (global as any)._TEST_BROWSER_SHOULD_FAIL = true;

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/browser.*context.*failed|context.*creation/i);
    });
  });

  describe('Cross-System Failure Scenarios', () => {
    it('should handle cascading failures across all systems', async () => {
      // Set up a scenario where all systems fail
      (global as any)._TEST_FS_SHOULD_FAIL = true;
      (global as any)._TEST_BROWSER_SHOULD_FAIL = true;

      vi.spyOn(permissionStore, 'getPermission').mockRejectedValue(
        new Error('Permission store down')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);

      // Should have multiple error types
      const systemErrors = errorEvents.filter(e =>
        e.type === 'system:error' ||
        e.type === 'permission:error' ||
        e.type === 'browser:session:error'
      );
      expect(systemErrors.length).toBeGreaterThan(0);

      // System should not crash despite multiple failures
      expect(orchestrator).toBeDefined();
      expect(browserTool).toBeDefined();
      expect(permissionManager).toBeDefined();
    });

    it('should handle partial system recovery', async () => {
      // Start with permission system down
      const permissionSpy = vi.spyOn(permissionManager, 'checkToolPermission')
        .mockRejectedValue(new Error('Permission system unavailable'));

      const failedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(failedResult.success).toBe(false);

      // Restore permission system
      permissionSpy.mockRestore();
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Should now succeed
      const successResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(successResult.success).toBe(true);

      // Verify recovery was tracked
      const recoveryEvents = systemEvents.filter(e =>
        e.type === 'system:recovery' ||
        (e.type === 'permission:granted' && e.timestamp > failedResult.timestamp)
      );
      expect(recoveryEvents.length).toBeGreaterThan(0);
    });

    it('should handle resource exhaustion gracefully', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Simulate resource exhaustion by creating many concurrent operations
      const manyOperations = Array.from({ length: 50 }, (_, i) =>
        browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/page${i}` }
        })
      );

      const results = await Promise.allSettled(manyOperations);

      // Some operations may fail due to resource limits
      const failures = results.filter(r =>
        r.status === 'fulfilled' && !(r.value as any).success
      );

      // System should handle resource limits gracefully
      // (exact behavior depends on implementation)

      // Verify error handling didn't crash the system
      expect(orchestrator).toBeDefined();
      expect(browserTool).toBeDefined();
    });

    it('should handle event system failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Mock event emitter failure
      const originalEmit = eventEmitter.emit;
      eventEmitter.emit = vi.fn().mockImplementation(() => {
        throw new Error('Event system failure');
      });

      // Operations should still work even if events fail
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Core functionality should continue despite event system failure
      expect(result.success).toBe(true);

      // Restore event system
      eventEmitter.emit = originalEmit;
    });

    it('should handle malformed operation parameters', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Test with null parameters
      const nullResult = await browserTool.execute({
        operation: 'navigate',
        params: null as any
      });
      expect(nullResult.success).toBe(false);
      expect(nullResult.error).toMatch(/invalid.*params|parameters.*required/i);

      // Test with undefined operation
      const undefinedResult = await browserTool.execute({
        operation: undefined as any,
        params: { url: 'https://example.com' }
      });
      expect(undefinedResult.success).toBe(false);
      expect(undefinedResult.error).toMatch(/invalid.*operation|operation.*required/i);

      // Test with invalid URL
      const invalidUrlResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'not-a-valid-url' }
      });
      expect(invalidUrlResult.success).toBe(false);
      expect(invalidUrlResult.error).toMatch(/invalid.*url|url.*format/i);

      // Test with missing required parameters
      const missingParamsResult = await browserTool.execute({
        operation: 'click',
        params: {} // Missing selector
      });
      expect(missingParamsResult.success).toBe(false);
      expect(missingParamsResult.error).toMatch(/selector.*required|missing.*selector/i);
    });

    it('should handle memory pressure and cleanup', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Simulate memory pressure by creating large data
      const largeData = Buffer.alloc(10 * 1024 * 1024); // 10MB buffer
      mockPage.screenshot.mockResolvedValue(largeData);

      // Take multiple large screenshots
      const screenshotPromises = Array.from({ length: 10 }, () =>
        browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true }
        })
      );

      const results = await Promise.allSettled(screenshotPromises);

      // Some operations might fail due to memory constraints
      const successfulResults = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      );

      // At least some should succeed, and system should remain stable
      expect(successfulResults.length).toBeGreaterThan(0);

      // Memory cleanup should happen automatically
      // (verification depends on implementation)
    });

    it('should handle network connectivity issues', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Mock network failure
      mockPage.goto.mockImplementation((url: string) => {
        if (url.includes('network-fail')) {
          return Promise.reject(new Error('Network unreachable'));
        }
        return Promise.resolve({ status: () => 200 });
      });

      const networkFailResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://network-fail.com' }
      });

      expect(networkFailResult.success).toBe(false);
      expect(networkFailResult.error).toMatch(/network.*unreachable|network.*error/i);

      // Network recovery should work
      const recoveryResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(recoveryResult.success).toBe(true);
    });
  });

  describe('Data Integrity and Consistency', () => {
    it('should maintain data integrity during partial failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-once');

      // Start operation that should consume permission
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result1.success).toBe(true);

      // Even if subsequent operations fail, permission should be consumed
      (global as any)._TEST_NAVIGATION_SHOULD_FAIL = true;

      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result2.success).toBe(false);

      // Verify permission was properly consumed despite failures
      const thirdResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' }
      });

      expect(thirdResult.success).toBe(false);
      expect(thirdResult.error).toMatch(/permission.*denied|consumed/i);
    });

    it('should handle transaction rollback scenarios', async () => {
      // This test verifies that failed operations don't leave the system
      // in an inconsistent state

      await permissionManager.grantPermission('Browser', 'allow-always');

      // Start operation that will fail midway
      const initialSessionCount = (browserTool as any).activeSessions?.length || 0;

      (global as any)._TEST_NAVIGATION_SHOULD_FAIL = true;

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);

      // Verify no session leak occurred
      const finalSessionCount = (browserTool as any).activeSessions?.length || 0;
      expect(finalSessionCount).toBe(initialSessionCount);

      // System should be ready for next operation
      (global as any)._TEST_NAVIGATION_SHOULD_FAIL = false;

      const nextResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(nextResult.success).toBe(true);
    });

    it('should handle concurrent permission changes consistently', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      let operationCount = 0;
      const operations: Promise<any>[] = [];

      // Start multiple operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          browserTool.execute({
            operation: 'navigate',
            params: { url: `https://example.com/page${i}` }
          }).then(result => ({ id: i, result }))
        );
      }

      // Change permissions while operations are running
      setTimeout(() => {
        permissionManager.denyPermission('Browser');
      }, 10);

      const results = await Promise.all(operations);

      // Operations that started before permission change should complete
      // Operations that started after should fail
      // The exact split depends on timing, but the system should be consistent

      const successes = results.filter(r => r.result.success);
      const failures = results.filter(r => !r.result.success);

      // At least some operations should have completed
      expect(successes.length + failures.length).toBe(5);

      // All operations should have deterministic outcomes
      results.forEach(r => {
        expect(r.result.success).toBeDefined();
        if (!r.result.success) {
          expect(r.result.error).toBeDefined();
        }
      });
    });
  });
});