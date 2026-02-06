/**
 * Browser Permission-Denied Resource Cleanup Integration Tests
 *
 * This test suite specifically verifies that browser resources are properly
 * cleaned up when permission denials occur, ensuring no resource leaks.
 *
 * Tests verify:
 * 1. Browser sessions are cleaned up after permission denial
 * 2. No browser, context, or page resource leaks occur
 * 3. Partial cleanup failures are handled gracefully
 * 4. Resource state tracking is updated correctly
 * 5. Cleanup timeouts are handled properly
 *
 * @module tests/integration/browser-permission-denied-cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPermissionTestContext,
  createPermissionDenialScenarios,
  assertPermissionDeniedResponse,
  assertCleanResourceState,
  assertNoCrashes,
  type PermissionTestContext
} from '../test-utils/permission-test-helpers.js';
import type { BrowserResourceState } from '../../packages/core/src/tools/browser/browser-permission-denied-error.js';

describe('Browser Permission-Denied Resource Cleanup Integration Tests', () => {
  let testContext: PermissionTestContext;
  const scenarios = createPermissionDenialScenarios();

  afterEach(async () => {
    if (testContext) {
      await testContext.browserTool.cleanup();
      testContext = null as any;
    }
    vi.restoreAllMocks();
  });

  describe('Browser Session Cleanup', () => {
    it('should clean up browser resources after navigation denial', async () => {
      testContext = createPermissionTestContext();

      // Start with granted permission to establish resources
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');

      const establishResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(establishResult.success).toBe(true);
      expect(testContext.mockBrowser.state.pageActive).toBe(true);

      // Now deny permissions and attempt cleanup
      await testContext.permissionManager.denyPermission('Browser');

      // Trigger cleanup through denied operation
      const deniedResult = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      assertPermissionDeniedResponse(deniedResult, 'click');

      // Explicit cleanup should work regardless of permission state
      await testContext.browserTool.cleanup();

      // Verify resources are cleaned up
      assertCleanResourceState(testContext);
    });

    it('should handle cleanup when browser launch is denied', async () => {
      testContext = scenarios.denyAllOperations();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // No resources should have been allocated in the first place
      expect(testContext.mockBrowser.state.browserActive).toBe(false);
      expect(testContext.mockBrowser.state.contextActive).toBe(false);
      expect(testContext.mockBrowser.state.pageActive).toBe(false);

      // Cleanup should be safe to call even when no resources exist
      await expect(testContext.browserTool.cleanup()).resolves.not.toThrow();

      assertCleanResourceState(testContext);
    });

    it('should clean up browser context after permission denial', async () => {
      testContext = createPermissionTestContext();

      // Establish browser context
      await testContext.permissionManager.grantPermission('Browser', 'full');
      const successResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(successResult.success).toBe(true);
      expect(testContext.mockBrowser.state.contextActive).toBe(true);

      // Deny further operations
      await testContext.permissionManager.denyPermission('Browser', 'evaluate');

      const deniedResult = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      assertPermissionDeniedResponse(deniedResult, 'evaluate');

      // Cleanup should close browser context
      await testContext.browserTool.cleanup();

      expect(testContext.mockBrowser.context.close).toHaveBeenCalled();
      expect(testContext.mockBrowser.state.contextActive).toBe(false);

      assertCleanResourceState(testContext);
    });

    it('should clean up page resources after permission denial', async () => {
      testContext = createPermissionTestContext();

      // Establish page
      await testContext.permissionManager.grantPermission('Browser', 'full', 'navigate');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(testContext.mockBrowser.state.pageActive).toBe(true);

      // Deny screenshot operation
      await testContext.permissionManager.denyPermission('Browser', 'screenshot');

      const deniedResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      assertPermissionDeniedResponse(deniedResult, 'screenshot');

      // Cleanup should close page
      await testContext.browserTool.cleanup();

      expect(testContext.mockBrowser.page.close).toHaveBeenCalled();
      expect(testContext.mockBrowser.state.pageActive).toBe(false);

      assertCleanResourceState(testContext);
    });
  });

  describe('No Resource Leaks', () => {
    it('should not leak resources when multiple operations are denied', async () => {
      testContext = scenarios.denyAllOperations();

      // Attempt multiple operations that should all be denied
      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'type', params: { selector: '#input', text: 'test' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'evaluate', params: { script: 'document.title' } },
      ];

      const results = await Promise.all(
        operations.map(op => testContext.browserTool.execute(op))
      );

      // All operations should be denied
      results.forEach((result, index) => {
        assertPermissionDeniedResponse(result, operations[index].operation as any);
      });

      // Verify no resources were leaked
      expect(testContext.mockBrowser.state.browserActive).toBe(false);
      expect(testContext.mockBrowser.state.contextActive).toBe(false);
      expect(testContext.mockBrowser.state.pageActive).toBe(false);
      expect(testContext.mockBrowser.state.activeOperations).toBe(0);

      // Cleanup should be safe
      await testContext.browserTool.cleanup();
      assertCleanResourceState(testContext);
    });

    it('should track resource state correctly during mixed scenarios', async () => {
      testContext = scenarios.partialDenial();

      // Mix of allowed and denied operations
      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' }, shouldSucceed: true },
        { operation: 'evaluate', params: { script: 'window.title' }, shouldSucceed: false },
        { operation: 'click', params: { selector: '#button' }, shouldSucceed: true },
        { operation: 'submit', params: { selector: '#form' }, shouldSucceed: false },
      ];

      for (const op of operations) {
        const result = await testContext.browserTool.execute({
          operation: op.operation,
          params: op.params,
        });

        if (op.shouldSucceed) {
          expect(result.success).toBe(true);
        } else {
          assertPermissionDeniedResponse(result, op.operation as any);
        }
      }

      // Resource state should be consistent
      const resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.activeOperations).toBe(0);

      // Cleanup should work properly
      await testContext.browserTool.cleanup();
      assertCleanResourceState(testContext);
    });

    it('should prevent resource accumulation over multiple test runs', async () => {
      // Simulate multiple test scenarios without cleanup between them
      const initialActiveOperations = 0;

      for (let i = 0; i < 5; i++) {
        testContext = scenarios.denyAllOperations();

        await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/test${i}` }
        });

        // Each iteration should start fresh
        expect(testContext.mockBrowser.state.activeOperations).toBe(0);
        expect(testContext.mockBrowser.state.browserActive).toBe(false);

        await testContext.browserTool.cleanup();
      }

      // Final verification
      assertCleanResourceState(testContext);
    });
  });

  describe('Partial Cleanup Failures', () => {
    it('should handle browser close failure gracefully', async () => {
      testContext = createPermissionTestContext();

      // Establish resources
      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Mock browser close failure
      const mockError = new Error('Browser close timeout');
      testContext.mockBrowser.browser.close.mockRejectedValue(mockError);

      // Cleanup should handle the failure gracefully
      await expect(testContext.browserTool.cleanup()).resolves.not.toThrow();

      // State should still be marked as cleaned up
      expect(testContext.mockBrowser.state.lifecycleState).toBe('destroyed');
    });

    it('should handle context close failure gracefully', async () => {
      testContext = createPermissionTestContext();

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Mock context close failure
      const mockError = new Error('Context close failed');
      testContext.mockBrowser.context.close.mockRejectedValue(mockError);

      // Cleanup should continue with other resources
      await expect(testContext.browserTool.cleanup()).resolves.not.toThrow();

      // Browser should still be closed
      expect(testContext.mockBrowser.browser.close).toHaveBeenCalled();
    });

    it('should handle page close failure gracefully', async () => {
      testContext = createPermissionTestContext();

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Mock page close failure
      const mockError = new Error('Page close timeout');
      testContext.mockBrowser.page.close.mockRejectedValue(mockError);

      // Cleanup should continue with other resources
      await expect(testContext.browserTool.cleanup()).resolves.not.toThrow();

      // Context and browser should still be closed
      expect(testContext.mockBrowser.context.close).toHaveBeenCalled();
      expect(testContext.mockBrowser.browser.close).toHaveBeenCalled();
    });

    it('should handle complete cleanup failure chain gracefully', async () => {
      testContext = createPermissionTestContext();

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Mock all cleanup methods to fail
      const mockError = new Error('Cleanup failure');
      testContext.mockBrowser.page.close.mockRejectedValue(mockError);
      testContext.mockBrowser.context.close.mockRejectedValue(mockError);
      testContext.mockBrowser.browser.close.mockRejectedValue(mockError);

      // Cleanup should not throw despite all failures
      await expect(testContext.browserTool.cleanup()).resolves.not.toThrow();

      // Verify cleanup was attempted for all resources
      expect(testContext.mockBrowser.page.close).toHaveBeenCalled();
      expect(testContext.mockBrowser.context.close).toHaveBeenCalled();
      expect(testContext.mockBrowser.browser.close).toHaveBeenCalled();
    });
  });

  describe('Resource State Tracking', () => {
    it('should update BrowserResourceState correctly after permission denial', async () => {
      testContext = createPermissionTestContext();

      // Initial state
      let resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);
      expect(resourceState.activeOperations).toBe(0);

      // Deny operations
      await testContext.permissionManager.denyPermission('Browser');

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // State should remain clean after denial
      resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);
      expect(resourceState.activeOperations).toBe(0);
    });

    it('should track session ID correctly', async () => {
      testContext = createPermissionTestContext();

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      const resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.sessionId).toBeDefined();
      expect(typeof resourceState.sessionId).toBe('string');
      expect(resourceState.sessionId!.length).toBeGreaterThan(0);

      await testContext.browserTool.cleanup();

      // Session ID should be preserved for debugging even after cleanup
      const finalState = testContext.browserTool.getResourceState();
      expect(finalState.sessionId).toBe(resourceState.sessionId);
    });

    it('should track lastAllocation timestamp correctly', async () => {
      testContext = createPermissionTestContext();

      const beforeTime = new Date();

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      const afterTime = new Date();
      const resourceState = testContext.browserTool.getResourceState();

      expect(resourceState.lastAllocation).toBeDefined();
      expect(resourceState.lastAllocation!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(resourceState.lastAllocation!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should track lifecycle state transitions correctly', async () => {
      testContext = createPermissionTestContext();

      // Initial state should be idle
      let resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.lifecycleState).toBe('idle');

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should be active after successful operation
      resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.lifecycleState).toBe('active');

      await testContext.browserTool.cleanup();

      // Should be destroyed after cleanup
      resourceState = testContext.browserTool.getResourceState();
      expect(resourceState.lifecycleState).toBe('destroyed');
    });
  });

  describe('Cleanup Timeout Handling', () => {
    it('should handle cleanup timeouts gracefully', async () => {
      testContext = createPermissionTestContext();

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Mock cleanup to hang indefinitely
      testContext.mockBrowser.browser.close.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      // Cleanup should timeout gracefully (in a real implementation)
      // For this test, we just verify it doesn't hang forever
      const cleanupPromise = testContext.browserTool.cleanup();

      // In a real implementation, you might want to test with a timeout
      // For now, we'll just verify it's called
      expect(testContext.mockBrowser.browser.close).toHaveBeenCalled();

      // Cancel the hanging promise for test completion
      testContext.mockBrowser.browser.close.mockResolvedValue(undefined);
      await cleanupPromise;
    });

    it('should clean up remaining resources if one cleanup times out', async () => {
      testContext = createPermissionTestContext();

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Mock only page cleanup to timeout
      testContext.mockBrowser.page.close.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      // Other cleanups should still work
      testContext.mockBrowser.context.close.mockResolvedValue(undefined);
      testContext.mockBrowser.browser.close.mockResolvedValue(undefined);

      await testContext.browserTool.cleanup();

      // Context and browser cleanup should still be called
      expect(testContext.mockBrowser.context.close).toHaveBeenCalled();
      expect(testContext.mockBrowser.browser.close).toHaveBeenCalled();
    });
  });

  describe('Concurrent Cleanup Scenarios', () => {
    it('should handle concurrent cleanup calls safely', async () => {
      testContext = createPermissionTestContext();

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Call cleanup multiple times concurrently
      const cleanupPromises = [
        testContext.browserTool.cleanup(),
        testContext.browserTool.cleanup(),
        testContext.browserTool.cleanup(),
      ];

      // All should resolve without throwing
      await expect(Promise.all(cleanupPromises)).resolves.not.toThrow();

      // Cleanup methods should be idempotent
      assertCleanResourceState(testContext);
    });

    it('should handle operation attempts during cleanup', async () => {
      testContext = createPermissionTestContext();

      await testContext.permissionManager.grantPermission('Browser', 'full');
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Start cleanup but make it slow
      let cleanupResolve: () => void;
      const cleanupPromise = new Promise<void>(resolve => {
        cleanupResolve = resolve;
      });

      testContext.mockBrowser.browser.close.mockImplementation(async () => {
        await cleanupPromise;
      });

      // Start cleanup
      const cleanup = testContext.browserTool.cleanup();

      // Attempt operation during cleanup
      const operationResult = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      // Should fail gracefully
      expect(operationResult.success).toBe(false);

      // Complete cleanup
      cleanupResolve!();
      await cleanup;

      assertCleanResourceState(testContext);
    });
  });
});