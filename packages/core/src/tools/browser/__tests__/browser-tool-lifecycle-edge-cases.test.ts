/**
 * @fileoverview Edge case tests for BrowserTool lifecycle state tracking
 *
 * Tests cover edge cases and scenarios that might not be covered by regular tests:
 * - Concurrent state transitions
 * - Error handling during state transitions
 * - Memory leaks and resource cleanup
 * - State consistency during failures
 * - Timing-sensitive operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BrowserTool } from '../browser-tool.js';
import type { BrowserLifecycleState } from '../browser-permission-denied-error.js';

describe('BrowserTool Lifecycle - Edge Cases', () => {
  let browserTool: BrowserTool;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    browserTool = new BrowserTool();
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
  });

  describe('concurrent operations and race conditions', () => {
    it('should handle concurrent executions during state transition', async () => {
      expect(browserTool.state).toBe('idle');

      // Start multiple operations simultaneously
      const operations = [
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example1.com' } }),
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example2.com' } }),
        browserTool.execute({ operation: 'click', params: { selector: 'button1' } }),
        browserTool.execute({ operation: 'click', params: { selector: 'button2' } }),
      ];

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.sessionId).toBeDefined();
      });

      // Should be in active state
      expect(browserTool.state).toBe('active');

      // Should log transition exactly once despite multiple concurrent operations
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned from idle to active');

      // Count the number of times the transition was logged
      const transitionLogs = consoleDebugSpy.mock.calls.filter(
        call => call[0] === 'BrowserTool: State transitioned from idle to active'
      );
      expect(transitionLogs).toHaveLength(1);
    });

    it('should handle execute call during cleanup race condition', async () => {
      // Get to active state
      await browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com' } });
      expect(browserTool.state).toBe('active');

      // Start cleanup but don't await it
      const cleanupPromise = browserTool.cleanupAllSessions();

      // Immediately try to execute another operation
      const executePromise = browserTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });

      // Wait for both operations to complete
      const [, executeResult] = await Promise.all([cleanupPromise, executePromise]);

      // Cleanup should complete successfully
      expect(browserTool.state).toBe('destroyed');

      // Execute should fail because tool was destroyed during cleanup
      expect(executeResult.success).toBe(false);
      expect(executeResult.error).toBe('Browser tool has been destroyed and cannot execute operations');
    });

    it('should handle rapid cleanup calls', async () => {
      await browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com' } });
      expect(browserTool.state).toBe('active');

      // Call cleanup multiple times rapidly
      const cleanupPromises = [
        browserTool.cleanupAllSessions(),
        browserTool.cleanupAllSessions(),
        browserTool.cleanupAllSessions(),
      ];

      await Promise.all(cleanupPromises);

      // Should end up destroyed
      expect(browserTool.state).toBe('destroyed');

      // Should be stable for subsequent cleanup calls
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');
    });
  });

  describe('error handling during state transitions', () => {
    it('should handle errors during session cleanup gracefully', async () => {
      // Create a spy to simulate cleanup errors
      const originalCleanupAllSessions = browserTool.cleanupAllSessions.bind(browserTool);
      let cleanupCallCount = 0;

      browserTool.cleanupAllSessions = async function() {
        cleanupCallCount++;
        if (cleanupCallCount === 1) {
          // Simulate error on first call
          throw new Error('Simulated cleanup error');
        }
        return originalCleanupAllSessions();
      };

      await browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com' } });
      expect(browserTool.state).toBe('active');

      // First cleanup call should fail
      await expect(browserTool.cleanupAllSessions()).rejects.toThrow('Simulated cleanup error');

      // State might be inconsistent after error, but second call should work
      browserTool.cleanupAllSessions = originalCleanupAllSessions;
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');
    });

    it('should maintain state consistency when execution fails after state change', async () => {
      expect(browserTool.state).toBe('idle');

      // Mock the executeOperation method to fail after state transition
      const originalExecuteOperation = (browserTool as any).executeOperation;
      (browserTool as any).executeOperation = vi.fn().mockRejectedValue(new Error('Simulated operation error'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should have transitioned to active despite the operation failure
      expect(browserTool.state).toBe('active');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser operation failed');

      // Restore original method
      (browserTool as any).executeOperation = originalExecuteOperation;

      // Subsequent operations should work
      const result2 = await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });
      expect(result2.success).toBe(true);
    });
  });

  describe('memory and resource management', () => {
    it('should clean up session tracking data on destroy', async () => {
      // Execute multiple operations to create sessions
      const operations = Array.from({ length: 5 }, (_, i) => ({
        operation: 'navigate' as const,
        params: { url: `https://example${i}.com` }
      }));

      for (const op of operations) {
        await browserTool.execute(op);
      }

      // Tool should have active sessions internally
      expect(browserTool.state).toBe('active');

      // Cleanup should remove all session data
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');

      // Verify cleanup was thorough by checking that subsequent operations fail appropriately
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });
      expect(result.success).toBe(false);
    });

    it('should handle permission cache during state transitions', async () => {
      // Execute an operation to populate permission cache
      await browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com' } });
      expect(browserTool.state).toBe('active');

      // Clear cache explicitly (testing public API)
      browserTool.clearPermissionCache();

      // Tool should still work after cache clear
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });
      expect(result.success).toBe(true);
      expect(browserTool.state).toBe('active');

      // Cleanup should work normally
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');
    });
  });

  describe('timing and async behavior', () => {
    it('should handle delayed state checks correctly', async () => {
      expect(browserTool.isActive()).toBe(true);

      const executePromise = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Check state before execution completes (should still be idle or active)
      expect(browserTool.isActive()).toBe(true);

      await executePromise;

      // Check state after execution completes
      expect(browserTool.state).toBe('active');
      expect(browserTool.isActive()).toBe(true);
    });

    it('should handle cancellation during different states', async () => {
      const controller = new AbortController();

      // Start operation and cancel immediately
      setTimeout(() => controller.abort(), 1);

      const result = await browserTool.execute(
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { signal: controller.signal }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');

      // Tool should be in a consistent state after cancellation
      expect(browserTool.isActive()).toBe(true); // Should be active since executeImpl was called
    });
  });

  describe('state validation and consistency', () => {
    it('should maintain isActive() consistency across all state values', () => {
      const stateActivenessMap: Record<BrowserLifecycleState, boolean> = {
        'idle': true,
        'active': true,
        'launching': false,
        'cleaning_up': false,
        'destroyed': false
      };

      Object.entries(stateActivenessMap).forEach(([state, expectedActive]) => {
        browserTool.state = state as BrowserLifecycleState;
        expect(browserTool.isActive()).toBe(expectedActive);
      });
    });

    it('should handle invalid state transitions gracefully', async () => {
      // Manually set to launching state
      browserTool.state = 'launching';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
      expect(browserTool.state).toBe('launching'); // Should remain in launching state
    });

    it('should handle state guards consistently for all blocked states', async () => {
      const blockedStates: BrowserLifecycleState[] = ['launching', 'cleaning_up', 'destroyed'];

      for (const state of blockedStates) {
        browserTool.state = state;

        const result = await browserTool.execute({
          operation: 'click',
          params: { selector: 'button' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
        expect(browserTool.state).toBe(state); // State should not change
      }
    });
  });

  describe('logging edge cases', () => {
    it('should not log excessive debug messages during normal operation', async () => {
      consoleDebugSpy.mockClear();

      // Execute multiple operations
      for (let i = 0; i < 5; i++) {
        await browserTool.execute({
          operation: 'click',
          params: { selector: `button${i}` }
        });
      }

      // Should only log the initial state transition, not for every operation
      const transitionLogs = consoleDebugSpy.mock.calls.filter(
        call => call[0]?.includes('State transitioned')
      );
      expect(transitionLogs).toHaveLength(1); // Only idle → active
    });

    it('should handle console.debug errors gracefully', async () => {
      // Mock console.debug to throw an error
      consoleDebugSpy.mockImplementation(() => {
        throw new Error('Console error');
      });

      // Operations should still work despite logging errors
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(true);
      expect(browserTool.state).toBe('active');

      // Cleanup should also work
      await expect(browserTool.cleanupAllSessions()).resolves.not.toThrow();
      expect(browserTool.state).toBe('destroyed');
    });
  });

  describe('configuration interaction with lifecycle', () => {
    it('should maintain lifecycle state across configuration changes', async () => {
      await browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com' } });
      expect(browserTool.state).toBe('active');

      // Create new tool with different config
      const newTool = browserTool.withConfig({ headless: false });

      // Original tool should still be active
      expect(browserTool.state).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      // New tool should start fresh
      expect(newTool.state).toBe('idle');
      expect(newTool.isActive()).toBe(true);
    });

    it('should handle lifecycle with different permission configurations', async () => {
      const restrictedTool = new BrowserTool({
        allowJavaScriptExecution: false,
        allowFormSubmission: false
      });

      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // Should transition to active even with restricted config
      const result = await restrictedTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });

      expect(result.success).toBe(true);
      expect(restrictedTool.state).toBe('active');
      expect(restrictedTool.isActive()).toBe(true);

      // But restricted operations should fail while maintaining active state
      const evalResult = await restrictedTool.execute({
        operation: 'evaluate',
        params: { script: 'return 1' }
      });

      expect(evalResult.success).toBe(false);
      expect(restrictedTool.state).toBe('active'); // Should remain active
      expect(restrictedTool.isActive()).toBe(true);

      debugSpy.mockRestore();
    });
  });

  describe('error response formatting with lifecycle', () => {
    it('should include lifecycle-aware metadata in error responses', async () => {
      browserTool.state = 'destroyed';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
      expect(result.operation).toBe('navigate');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe('string');
    });

    it('should handle session ID generation consistently across states', async () => {
      const sessionIds: string[] = [];

      // Execute in idle state
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      sessionIds.push(result1.sessionId!);

      // Execute in active state
      const result2 = await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });
      sessionIds.push(result2.sessionId!);

      // Execute in destroyed state
      await browserTool.cleanupAllSessions();
      const result3 = await browserTool.execute({
        operation: 'type',
        params: { selector: 'input', text: 'test' }
      });
      sessionIds.push(result3.sessionId!);

      // All should have unique session IDs
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(3);

      // All should be strings and follow expected format
      sessionIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^browser-session-\d+-[a-z0-9]+$/);
      });
    });
  });
});