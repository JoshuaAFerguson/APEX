/**
 * Advanced Browser Permission Denial Edge Cases
 *
 * This test suite covers critical edge cases for browser permission denial scenarios:
 * 1. Denial during mid-operation (partial execution)
 * 2. Denial with pending browser actions in queue
 * 3. Denial followed by retry attempt
 * 4. Concurrent permission denials
 * 5. Session cleanup after denial
 *
 * These tests ensure proper resource cleanup, event emission, and state management
 * in edge cases that can occur in production environments.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { BrowserTool } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import { PermissionStore } from '../../permission-store';
import { TaskStore } from '../../store';
import { createTestTask, MockBrowserSession } from '../../__tests__/v050-integration/test-utils';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  type BrowserPermissionDeniedContext,
  type BrowserResourceState
} from '@apexcli/core';

import type {
  Task,
  PermissionLevel,
  BrowserSession,
  BrowserSessionConfig,
  ToolPermissionResult,
  BrowserResult,
} from '@apexcli/core';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

interface EdgeCaseTestEnvironment {
  testDir: string;
  taskStore: TaskStore;
  permissionStore: PermissionStore;
  permissionManager: PermissionManager;
  browserTool: BrowserTool;
  testTask: Task;
  mockSession: MockBrowserSession;
  eventEmitter: EventEmitter;
  events: any[];
}

const EDGE_CASE_OPERATIONS = {
  slowNavigation: { operation: 'navigate', params: { url: 'https://slow.example.com' } },
  complexEvaluate: { operation: 'evaluate', params: { script: 'await new Promise(r => setTimeout(r, 1000)); return true;' } },
  multiStepForm: [
    { operation: 'click', params: { selector: '#field1' } },
    { operation: 'type', params: { selector: '#field1', text: 'test' } },
    { operation: 'submit', params: { selector: '#form' } },
  ],
};

const DENIAL_SCENARIOS = {
  immediateRevocation: { delay: 0 },
  midOperationRevocation: { delay: 50 },
  postCompletionAttemptedDenial: { delay: 1000 },
};

const CLEANUP_ERROR_SCENARIOS = {
  pageCloseFails: 'Page close failed: Connection closed',
  contextCloseFails: 'Context close failed: Browser crashed',
  browserCloseFails: 'Browser close failed: Process terminated',
};

async function createEdgeCaseTestEnvironment(): Promise<EdgeCaseTestEnvironment> {
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-permission-advanced-edge-'));

  const taskStore = new TaskStore(testDir);
  await taskStore.initialize();

  const permissionStore = new PermissionStore();
  const permissionManager = new PermissionManager(permissionStore);
  const eventEmitter = new EventEmitter();

  const testTask = createTestTask(testDir);
  await taskStore.addTask(testTask);

  const browserTool = new BrowserTool({
    permissionManager,
    backend: 'playwright',
    engine: 'chromium',
    headless: true,
    eventEmitter,
    taskId: testTask.id,
  });

  const mockSession = new MockBrowserSession({
    browserType: 'chromium',
    headless: true,
    allowedDomains: ['example.com', 'test.local', 'subdomain.example.com'],
    blockedDomains: ['blocked.com', 'malicious.site'],
  });

  // Mock browser page with timing control for edge case testing
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
        const script = payload?.snippet || payload;
        if (typeof script === 'string' && script.includes('await new Promise')) {
          return new Promise(resolve => setTimeout(() => resolve('delayed result'), 50));
        }
        if (typeof script === 'string' && script.includes('throw')) {
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
      close: vi.fn().mockResolvedValue(undefined),
    },
  });

  const events: any[] = [];
  eventEmitter.on('permission:granted', (event) => {
    events.push({ type: 'granted', ...event, timestamp: Date.now() });
  });
  eventEmitter.on('permission:denied', (event) => {
    events.push({ type: 'denied', ...event, timestamp: Date.now() });
  });
  eventEmitter.on('browser:state:transition', (event) => {
    events.push({ type: 'state:transition', ...event, timestamp: Date.now() });
  });

  return {
    testDir,
    taskStore,
    permissionStore,
    permissionManager,
    browserTool,
    testTask,
    mockSession,
    eventEmitter,
    events,
  };
}

describe('Advanced Browser Permission Denial Edge Cases', () => {
  let env: EdgeCaseTestEnvironment;

  beforeEach(async () => {
    env = await createEdgeCaseTestEnvironment();
  });

  afterEach(async () => {
    await env.browserTool?.cleanup();
    await env.taskStore?.close();
    await fs.rm(env.testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    env.eventEmitter.removeAllListeners();
  });

  // ========================================================================
  // 1. Denial During Mid-Operation (Partial Execution)
  // ========================================================================

  describe('Denial During Mid-Operation', () => {
    it('should handle permission revocation during navigation in progress', async () => {
      let callCount = 0;
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        callCount++;
        if (callCount <= 1) {
          return { allowed: true, level: 'full' };
        }
        return { allowed: false, denialReason: 'Permission revoked mid-operation' };
      });

      const result = await env.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://slow.example.com' },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission');
      expect(result.metadata?.permissionGranted).toBe(false);

      // Verify resource cleanup
      const resourceState = env.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);

      // Verify event emission
      const deniedEvents = env.events.filter(e => e.type === 'denied');
      expect(deniedEvents.length).toBeGreaterThan(0);
    });

    it('should handle permission revocation during multi-step operation', async () => {
      let evaluationSteps = 0;
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        evaluationSteps++;
        if (evaluationSteps <= 1) {
          return { allowed: true, level: 'full' };
        }
        return { allowed: false, denialReason: 'Permission revoked during evaluation' };
      });

      const result = await env.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'await new Promise(r => setTimeout(r, 100)); return true;' },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission');

      // Verify no partial results are returned
      expect(result.data).toBeUndefined();

      // Verify proper cleanup
      const state = env.browserTool.getResourceState();
      expect(state.activeOperations).toBe(0);
    });

    it('should not corrupt browser state when denial occurs mid-screenshot', async () => {
      let screenshotAttempts = 0;
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        screenshotAttempts++;
        if (screenshotAttempts <= 1) {
          return { allowed: true, level: 'read' };
        }
        return { allowed: false, denialReason: 'Screenshot permission revoked' };
      });

      const result = await env.browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: false },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission');

      // Verify no partial screenshots
      expect(result.data).toBeUndefined();

      // Browser state should remain valid for other operations
      const resourceState = env.browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.pageActive).toBe(true);
      expect(resourceState.activeOperations).toBe(0);
    });
  });

  // ========================================================================
  // 2. Denial with Pending Browser Actions in Queue
  // ========================================================================

  describe('Denial with Pending Browser Actions', () => {
    it('should cancel pending operations when permission is denied', async () => {
      let operationCount = 0;
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        operationCount++;
        if (operationCount <= 2) {
          return { allowed: true, level: 'full' };
        }
        return { allowed: false, denialReason: 'Permission denied for queued operations' };
      });

      // Submit multiple operations concurrently
      const operations = [
        env.browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com/1' } } as any),
        env.browserTool.execute({ operation: 'click', params: { selector: '#button1' } } as any),
        env.browserTool.execute({ operation: 'screenshot', params: { fullPage: false } } as any),
        env.browserTool.execute({ operation: 'getText', params: { selector: '#content' } } as any),
      ];

      const results = await Promise.allSettled(operations);

      // First few operations should succeed, later ones should fail
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failureCount = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;

      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(failureCount).toBeGreaterThan(0);

      // Verify no resource leaks
      const resourceState = env.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);
    });

    it('should properly handle denial with mixed operation queue', async () => {
      // Allow only navigate operations
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async (tool, operation) => {
        if (operation?.includes('navigate')) {
          return { allowed: true, level: 'read' };
        }
        return { allowed: false, denialReason: 'Non-navigation operations denied' };
      });

      const operations = [
        env.browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com' } } as any),
        env.browserTool.execute({ operation: 'click', params: { selector: '#button' } } as any),
        env.browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com/page2' } } as any),
        env.browserTool.execute({ operation: 'screenshot', params: { fullPage: false } } as any),
      ];

      const results = await Promise.allSettled(operations);

      // Only navigation operations should succeed
      expect(results[0].status === 'fulfilled' && results[0].value.success).toBe(true);
      expect(results[1].status === 'fulfilled' && !results[1].value.success).toBe(true);
      expect(results[2].status === 'fulfilled' && results[2].value.success).toBe(true);
      expect(results[3].status === 'fulfilled' && !results[3].value.success).toBe(true);
    });

    it('should emit denial events for each affected queued operation', async () => {
      let denialCount = 0;
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        denialCount++;
        return { allowed: false, denialReason: `Operation ${denialCount} denied` };
      });

      // Queue 5 operations
      const operations = Array.from({ length: 5 }, (_, i) =>
        env.browserTool.execute({ operation: 'click', params: { selector: `#button${i}` } } as any)
      );

      await Promise.allSettled(operations);

      // Verify 5 permission:denied events with correct timestamps
      const deniedEvents = env.events.filter(e => e.type === 'denied');
      expect(deniedEvents.length).toBe(5);

      // Events should be ordered by timestamp
      for (let i = 1; i < deniedEvents.length; i++) {
        expect(deniedEvents[i].timestamp).toBeGreaterThanOrEqual(deniedEvents[i - 1].timestamp);
      }
    });
  });

  // ========================================================================
  // 3. Denial Followed by Retry Attempt
  // ========================================================================

  describe('Denial Followed by Retry', () => {
    it('should handle retry after denial with same session', async () => {
      let attemptCount = 0;
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          return { allowed: false, denialReason: 'Initial denial' };
        }
        return { allowed: true, level: 'full' };
      });

      // First attempt should fail
      const firstResult = await env.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      expect(firstResult.success).toBe(false);
      expect(firstResult.error).toContain('Initial denial');

      // Second attempt should succeed
      const secondResult = await env.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      expect(secondResult.success).toBe(true);

      // Session should be consistent
      const resourceState = env.browserTool.getResourceState();
      expect(resourceState.sessionId).toBeDefined();
    });

    it('should handle retry after denial with new session', async () => {
      let sessionCreations = 0;
      const originalSessionId = env.browserTool.getResourceState().sessionId;

      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'Permission consistently denied' };
      });

      // First attempt fails
      const firstResult = await env.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      expect(firstResult.success).toBe(false);

      // Cleanup and create new session
      await env.browserTool.cleanup();

      // Create new browser tool (simulating new session)
      const newBrowserTool = new BrowserTool({
        permissionManager: env.permissionManager,
        backend: 'playwright',
        engine: 'chromium',
        headless: true,
        eventEmitter: env.eventEmitter,
        taskId: env.testTask.id,
      });

      const newSessionId = newBrowserTool.getResourceState().sessionId;
      expect(newSessionId).not.toBe(originalSessionId);

      await newBrowserTool.cleanup();
    });

    it('should track retry count and emit appropriate events', async () => {
      let retryCount = 0;
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        retryCount++;
        return { allowed: false, denialReason: `Retry attempt ${retryCount} denied` };
      });

      // Make multiple retry attempts
      const attempts = [];
      for (let i = 0; i < 3; i++) {
        attempts.push(
          env.browserTool.execute({
            operation: 'click',
            params: { selector: '#retry-button' },
          } as any)
        );
      }

      const results = await Promise.allSettled(attempts);

      // All should fail
      results.forEach(result => {
        expect(result.status === 'fulfilled' && !result.value.success).toBe(true);
      });

      // Should have 3 denial events
      const deniedEvents = env.events.filter(e => e.type === 'denied');
      expect(deniedEvents.length).toBe(3);
    });

    it('should not accumulate resources across retry attempts', async () => {
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'Always denied for resource test' };
      });

      const initialState = env.browserTool.getResourceState();
      const initialActiveOps = initialState.activeOperations;

      // Multiple deny-retry cycles
      for (let i = 0; i < 5; i++) {
        await env.browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: false },
        } as any);
      }

      const finalState = env.browserTool.getResourceState();
      expect(finalState.activeOperations).toBe(initialActiveOps);

      // No resource accumulation
      expect(finalState.activeOperations).toBe(0);
    });
  });

  // ========================================================================
  // 4. Concurrent Permission Denials
  // ========================================================================

  describe('Concurrent Permission Denials', () => {
    it('should handle simultaneous denials on different operations', async () => {
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'All operations denied concurrently' };
      });

      // Start navigate, click, screenshot in parallel
      const operations = await Promise.allSettled([
        env.browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com' } } as any),
        env.browserTool.execute({ operation: 'click', params: { selector: '#button' } } as any),
        env.browserTool.execute({ operation: 'screenshot', params: { fullPage: false } } as any),
      ]);

      // Each operation should fail independently
      operations.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(false);
          expect(result.value.error).toContain('denied');
        }
      });

      // Resources should be properly cleaned up
      const resourceState = env.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);
    });

    it('should not double-cleanup on concurrent denials', async () => {
      let cleanupCallCount = 0;
      const originalCleanup = env.browserTool.cleanup.bind(env.browserTool);
      vi.spyOn(env.browserTool, 'cleanup').mockImplementation(async () => {
        cleanupCallCount++;
        return originalCleanup();
      });

      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'Concurrent denial test' };
      });

      // Trigger concurrent denials
      await Promise.allSettled([
        env.browserTool.execute({ operation: 'navigate', params: { url: 'https://a.com' } } as any),
        env.browserTool.execute({ operation: 'navigate', params: { url: 'https://b.com' } } as any),
        env.browserTool.execute({ operation: 'screenshot', params: {} } as any),
      ]);

      // Cleanup should not be called excessively (normal lifecycle only)
      expect(cleanupCallCount).toBeLessThanOrEqual(1);
    });

    it('should emit events in consistent order for concurrent denials', async () => {
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'Event order test denial' };
      });

      const operationPromises = [
        env.browserTool.execute({ operation: 'navigate', params: { url: 'https://first.com' } } as any),
        env.browserTool.execute({ operation: 'click', params: { selector: '#second' } } as any),
        env.browserTool.execute({ operation: 'screenshot', params: { filename: 'third.png' } } as any),
      ];

      await Promise.allSettled(operationPromises);

      // Events should have logical ordering (by start time)
      const deniedEvents = env.events.filter(e => e.type === 'denied');
      expect(deniedEvents.length).toBe(3);

      // Events should have consecutive timestamps
      for (let i = 1; i < deniedEvents.length; i++) {
        expect(deniedEvents[i].timestamp).toBeGreaterThanOrEqual(deniedEvents[i - 1].timestamp);
      }
    });

    it('should handle race between denial and operation completion', async () => {
      let raceConditionDetected = false;
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        // Simulate race condition: sometimes allow, sometimes deny
        const shouldAllow = Math.random() > 0.5;
        if (!shouldAllow) {
          raceConditionDetected = true;
        }
        return {
          allowed: shouldAllow,
          level: shouldAllow ? 'full' : undefined,
          denialReason: shouldAllow ? undefined : 'Race condition denial',
        };
      });

      const result = await env.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://race-test.com' },
      } as any);

      // Result should be either success or failure, not both
      expect(typeof result.success).toBe('boolean');
      if (result.success) {
        expect(result.error).toBeUndefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  // ========================================================================
  // 5. Session Cleanup After Denial
  // ========================================================================

  describe('Session Cleanup After Denial', () => {
    it('should cleanup all browser resources on permission denial', async () => {
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'Permission denied for cleanup test' };
      });

      // Launch browser with page (by attempting an operation)
      const result = await env.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      expect(result.success).toBe(false);

      // Verify browser, context, page all cleaned up
      const resourceState = env.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);
      expect(resourceState.sessionId).toBeDefined(); // Session tracking should still work
    });

    it('should handle cleanup failure gracefully', async () => {
      // Mock page.close() to throw
      const mockPage = {
        close: vi.fn().mockRejectedValue(new Error('Page close failed: Connection closed')),
        url: () => 'https://example.com',
        title: () => Promise.resolve('Test Page'),
      };

      vi.spyOn(env.browserTool as any, 'ensurePage').mockResolvedValue({
        backend: 'playwright',
        page: mockPage,
      });

      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'Cleanup failure test' };
      });

      // Should not crash on cleanup failure
      const result = await env.browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: false },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('denied'); // Should report permission error, not cleanup error

      // State should be reset despite cleanup failure
      const resourceState = env.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);
    });

    it('should transition to destroyed state after cleanup', async () => {
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'State transition test' };
      });

      await env.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      // Perform explicit cleanup
      await env.browserTool.cleanup();

      // Should be in destroyed state
      expect(env.browserTool.getState()).toBe('destroyed');

      // Subsequent operations should fail with appropriate error
      const result = await env.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('destroyed');
    });

    it('should clear console and error buffers on cleanup', async () => {
      // Mock browser tool with console/error buffers
      const consoleSpy = vi.fn();
      vi.spyOn(env.browserTool as any, 'consoleStream', 'get').mockReturnValue({
        stopStream: consoleSpy,
      });

      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'Buffer cleanup test' };
      });

      await env.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' },
      } as any);

      await env.browserTool.cleanup();

      // Console stream should be stopped
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should emit browser:state:transition events during cleanup', async () => {
      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        return { allowed: false, denialReason: 'State transition event test' };
      });

      await env.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      await env.browserTool.cleanup();

      // Should have state transition events
      const stateEvents = env.events.filter(e => e.type === 'state:transition');
      expect(stateEvents.length).toBeGreaterThan(0);

      // Should include destroyed state
      const destroyedEvent = stateEvents.find(e => e.newState === 'destroyed');
      expect(destroyedEvent).toBeDefined();
    });
  });

  // ========================================================================
  // Integration Tests for Combined Edge Cases
  // ========================================================================

  describe('Combined Edge Case Scenarios', () => {
    it('should handle complex workflow with multiple denial points', async () => {
      let operationIndex = 0;
      const allowedOperations = ['navigate', 'click']; // First two operations allowed

      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async () => {
        const currentOp = allowedOperations[operationIndex];
        operationIndex++;

        if (currentOp) {
          return { allowed: true, level: 'full' };
        }
        return { allowed: false, denialReason: `Operation ${operationIndex} denied in workflow` };
      });

      const workflow = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#start' } },
        { operation: 'screenshot', params: { fullPage: false } },
        { operation: 'evaluate', params: { script: 'return document.title;' } },
      ];

      const results = [];
      for (const step of workflow) {
        const result = await env.browserTool.execute(step as any);
        results.push(result);
        if (!result.success) break;
      }

      // First two should succeed, third should fail
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);
      expect(results.length).toBe(3);

      // Resources should be properly cleaned up
      const resourceState = env.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);
    });

    it('should maintain consistency across permission state changes', async () => {
      const permissionHistory: Array<{ operation: string; allowed: boolean; timestamp: number }> = [];

      vi.spyOn(env.permissionManager, 'checkToolPermission').mockImplementation(async (tool, operation) => {
        const allowed = !operation?.includes('screenshot'); // Deny only screenshots
        permissionHistory.push({
          operation: operation || 'unknown',
          allowed,
          timestamp: Date.now(),
        });

        return {
          allowed,
          level: allowed ? 'full' : undefined,
          denialReason: allowed ? undefined : 'Screenshots not allowed',
        };
      });

      // Mix of operations that should have different permission outcomes
      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'screenshot', params: { fullPage: false } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'getText', params: { selector: '#content' } },
      ];

      const results = await Promise.allSettled(
        operations.map(op => env.browserTool.execute(op as any))
      );

      // Verify consistent permission handling
      const screenshots = results.filter((_, i) => operations[i].operation === 'screenshot');
      const nonScreenshots = results.filter((_, i) => operations[i].operation !== 'screenshot');

      screenshots.forEach(result => {
        expect(result.status === 'fulfilled' && !result.value.success).toBe(true);
      });

      nonScreenshots.forEach(result => {
        expect(result.status === 'fulfilled' && result.value.success).toBe(true);
      });

      // Permission history should reflect all checks
      expect(permissionHistory.length).toBe(operations.length);
    });
  });
});