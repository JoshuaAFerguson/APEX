/**
 * @fileoverview Acceptance tests for BrowserTool lifecycle state tracking
 *
 * These tests validate the acceptance criteria for the lifecycle state tracking feature:
 * - The core BrowserTool has a 'state' property initialized to 'idle'
 * - State transitions to 'active' on first executeImpl()
 * - State transitions to 'cleaning_up' during cleanupAllSessions()
 * - State transitions to 'destroyed' after cleanup
 * - executeImpl() rejects with an error if state is 'destroyed'
 * - An isActive() public method returns true when state is 'idle' or 'active'
 * - State transitions are logged via console.debug
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BrowserTool } from '../browser-tool.js';
import type { BrowserLifecycleState } from '../browser-permission-denied-error.js';

describe('BrowserTool Lifecycle - Acceptance Criteria Validation', () => {
  let browserTool: BrowserTool;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    browserTool = new BrowserTool();
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
  });

  describe('AC1: BrowserTool has state property initialized to idle', () => {
    it('should have state property initialized to idle on construction', () => {
      const tool = new BrowserTool();
      expect(tool).toHaveProperty('state');
      expect(tool.state).toBe('idle');
    });

    it('should have public state property that can be read', () => {
      expect(typeof browserTool.state).toBe('string');
      expect(browserTool.state).toBe('idle');
    });
  });

  describe('AC2: State transitions to active on first executeImpl()', () => {
    it('should transition from idle to active on first successful execution', async () => {
      expect(browserTool.state).toBe('idle');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(true);
      expect(browserTool.state).toBe('active');
    });

    it('should NOT transition state if validation fails before executeImpl', async () => {
      expect(browserTool.state).toBe('idle');

      // Invalid operation should fail validation before reaching executeImpl
      const result = await browserTool.execute({
        operation: 'navigate',
        params: {} // Missing required URL
      } as any);

      expect(result.success).toBe(false);
      expect(browserTool.state).toBe('idle'); // Should remain idle
    });

    it('should transition to active exactly once across multiple operations', async () => {
      expect(browserTool.state).toBe('idle');

      // First operation
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(browserTool.state).toBe('active');

      consoleDebugSpy.mockClear();

      // Subsequent operations should not change state
      await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });
      expect(browserTool.state).toBe('active');

      // Should not log transition again
      expect(consoleDebugSpy).not.toHaveBeenCalledWith('BrowserTool: State transitioned from idle to active');
    });
  });

  describe('AC3: State transitions to cleaning_up during cleanupAllSessions()', () => {
    it('should transition to cleaning_up when cleanupAllSessions is called', async () => {
      // Get to active state first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(browserTool.state).toBe('active');

      // Start cleanup and check intermediate state
      const cleanupPromise = browserTool.cleanupAllSessions();

      // Wait a small amount to ensure cleanup has started
      await new Promise(resolve => setTimeout(resolve, 1));

      await cleanupPromise;

      // Should have transitioned through cleaning_up to destroyed
      expect(browserTool.state).toBe('destroyed');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to cleaning_up');
    });

    it('should handle cleanupAllSessions from idle state', async () => {
      expect(browserTool.state).toBe('idle');

      await browserTool.cleanupAllSessions();

      expect(browserTool.state).toBe('destroyed');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to cleaning_up');
    });
  });

  describe('AC4: State transitions to destroyed after cleanup', () => {
    it('should end in destroyed state after cleanupAllSessions completes', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      await browserTool.cleanupAllSessions();

      expect(browserTool.state).toBe('destroyed');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to destroyed');
    });

    it('should remain destroyed after cleanup is complete', async () => {
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');

      consoleDebugSpy.mockClear();

      // Multiple cleanup calls should keep state as destroyed
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');
    });
  });

  describe('AC5: executeImpl() rejects with error if state is destroyed', () => {
    it('should reject execution with specific error when state is destroyed', async () => {
      // Destroy the tool
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
    });

    it('should reject execution when state is cleaning_up', async () => {
      browserTool.state = 'cleaning_up';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
    });

    it('should reject execution when state is launching', async () => {
      browserTool.state = 'launching';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
    });

    it('should include sessionId and duration even in failed executions', async () => {
      browserTool.state = 'destroyed';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.sessionId).toBeDefined();
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AC6: isActive() returns true when state is idle or active', () => {
    it('should return true for idle state', () => {
      browserTool.state = 'idle';
      expect(browserTool.isActive()).toBe(true);
    });

    it('should return true for active state', () => {
      browserTool.state = 'active';
      expect(browserTool.isActive()).toBe(true);
    });

    it('should return false for launching state', () => {
      browserTool.state = 'launching';
      expect(browserTool.isActive()).toBe(false);
    });

    it('should return false for cleaning_up state', () => {
      browserTool.state = 'cleaning_up';
      expect(browserTool.isActive()).toBe(false);
    });

    it('should return false for destroyed state', () => {
      browserTool.state = 'destroyed';
      expect(browserTool.isActive()).toBe(false);
    });

    it('should be consistent across state transitions', async () => {
      // Initial idle state
      expect(browserTool.isActive()).toBe(true);

      // After execution - active state
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(browserTool.isActive()).toBe(true);

      // After cleanup - destroyed state
      await browserTool.cleanupAllSessions();
      expect(browserTool.isActive()).toBe(false);
    });
  });

  describe('AC7: State transitions are logged via console.debug', () => {
    it('should log idle to active transition', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned from idle to active');
    });

    it('should log state transitions during cleanup', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      consoleDebugSpy.mockClear();

      await browserTool.cleanupAllSessions();

      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to cleaning_up');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to destroyed');
    });

    it('should use console.debug specifically, not other console methods', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      await browserTool.cleanupAllSessions();

      expect(consoleDebugSpy).toHaveBeenCalledTimes(3); // idle→active, active→cleaning_up, cleaning_up→destroyed
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });

    it('should not log transitions when state does not actually change', async () => {
      // Get to active state
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(browserTool.state).toBe('active');

      consoleDebugSpy.mockClear();

      // Second execution should not log state change
      await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });

      expect(consoleDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining('State transitioned'));
    });
  });

  describe('Integration scenarios', () => {
    it('should maintain state consistency during rapid operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        operation: 'navigate' as const,
        params: { url: `https://example${i}.com` }
      }));

      const promises = operations.map(op => browserTool.execute(op));
      const results = await Promise.all(promises);

      // All operations should succeed
      results.forEach(result => expect(result.success).toBe(true));

      // Should be in active state
      expect(browserTool.state).toBe('active');
      expect(browserTool.isActive()).toBe(true);

      // Should have logged transition exactly once
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned from idle to active');
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle state transitions under error conditions', async () => {
      // Simulate permission denial by setting up a restricted tool
      const restrictedTool = new BrowserTool({ allowJavaScriptExecution: false });
      const restrictedSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // This should fail but still transition to active before failing
      const result = await restrictedTool.execute({
        operation: 'evaluate',
        params: { script: 'return 1' }
      });

      expect(result.success).toBe(false);
      // Should still be in active state despite the failure
      expect(restrictedTool.state).toBe('active');
      expect(restrictedTool.isActive()).toBe(true);

      restrictedSpy.mockRestore();
    });

    it('should support manual state inspection and modification', () => {
      // State should be publicly accessible for debugging/testing
      expect(browserTool.state).toBe('idle');

      // Manual state changes should be possible (for testing scenarios)
      browserTool.state = 'destroyed';
      expect(browserTool.state).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);

      // Reset to idle
      browserTool.state = 'idle';
      expect(browserTool.state).toBe('idle');
      expect(browserTool.isActive()).toBe(true);
    });
  });

  describe('Type safety validation', () => {
    it('should accept all valid BrowserLifecycleState values', () => {
      const validStates: BrowserLifecycleState[] = ['idle', 'launching', 'active', 'cleaning_up', 'destroyed'];

      validStates.forEach(state => {
        browserTool.state = state;
        expect(browserTool.state).toBe(state);

        const isActive = browserTool.isActive();
        expect(typeof isActive).toBe('boolean');

        if (state === 'idle' || state === 'active') {
          expect(isActive).toBe(true);
        } else {
          expect(isActive).toBe(false);
        }
      });
    });
  });
});