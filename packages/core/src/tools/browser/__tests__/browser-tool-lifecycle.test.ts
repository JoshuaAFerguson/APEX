/**
 * @fileoverview Tests for BrowserTool lifecycle state tracking functionality
 *
 * Tests cover:
 * - Initial state initialization
 * - State transitions (idle → active → cleaning_up → destroyed)
 * - State guards on execute() method
 * - isActive() method functionality
 * - Console logging for state transitions
 * - Edge cases and error scenarios
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BrowserTool } from '../browser-tool.js';
import type { BrowserLifecycleState } from '../browser-permission-denied-error.js';

describe('BrowserTool Lifecycle State Tracking', () => {
  let browserTool: BrowserTool;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    browserTool = new BrowserTool();
    // Mock console.debug to capture logging
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
  });

  describe('initial state', () => {
    it('should initialize state to "idle"', () => {
      expect(browserTool.state).toBe('idle');
    });

    it('should implement BrowserLifecycleAware interface', () => {
      // Check that the class implements the required interface methods/properties
      expect(browserTool).toHaveProperty('state');
      expect(browserTool).toHaveProperty('isActive');
      expect(typeof browserTool.isActive).toBe('function');
    });
  });

  describe('isActive() method', () => {
    it('should return true when state is "idle"', () => {
      browserTool.state = 'idle';
      expect(browserTool.isActive()).toBe(true);
    });

    it('should return true when state is "active"', () => {
      browserTool.state = 'active';
      expect(browserTool.isActive()).toBe(true);
    });

    it('should return false when state is "launching"', () => {
      browserTool.state = 'launching';
      expect(browserTool.isActive()).toBe(false);
    });

    it('should return false when state is "cleaning_up"', () => {
      browserTool.state = 'cleaning_up';
      expect(browserTool.isActive()).toBe(false);
    });

    it('should return false when state is "destroyed"', () => {
      browserTool.state = 'destroyed';
      expect(browserTool.isActive()).toBe(false);
    });
  });

  describe('state transitions during execution', () => {
    it('should transition from "idle" to "active" on first execute', async () => {
      expect(browserTool.state).toBe('idle');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(browserTool.state).toBe('active');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned from idle to active');
    });

    it('should remain "active" on subsequent executions', async () => {
      // First execution
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(browserTool.state).toBe('active');

      // Clear the console spy calls from first execution
      consoleDebugSpy.mockClear();

      // Second execution
      await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });

      expect(browserTool.state).toBe('active');
      // Should not log state transition since we're already active
      expect(consoleDebugSpy).not.toHaveBeenCalledWith('BrowserTool: State transitioned from idle to active');
    });

    it('should not transition state when execution is aborted early due to validation', async () => {
      expect(browserTool.state).toBe('idle');

      await browserTool.execute({
        operation: 'navigate',
        params: {} // Invalid - missing URL
      } as any);

      // Should remain idle since validation failed before executeImpl was called
      expect(browserTool.state).toBe('idle');
    });
  });

  describe('state guards', () => {
    it('should reject execution when state is "destroyed"', async () => {
      browserTool.state = 'destroyed';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
    });

    it('should allow execution when state is "idle"', async () => {
      browserTool.state = 'idle';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(true);
    });

    it('should allow execution when state is "active"', async () => {
      browserTool.state = 'active';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(true);
    });

    it('should reject execution when state is "cleaning_up"', async () => {
      browserTool.state = 'cleaning_up';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
    });

    it('should reject execution when state is "launching"', async () => {
      browserTool.state = 'launching';

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool has been destroyed and cannot execute operations');
    });
  });

  describe('cleanupAllSessions state management', () => {
    it('should transition to "cleaning_up" then "destroyed" during cleanup', async () => {
      // Start in active state
      browserTool.state = 'active';

      await browserTool.cleanupAllSessions();

      expect(browserTool.state).toBe('destroyed');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to cleaning_up');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to destroyed');
    });

    it('should handle cleanup from "idle" state', async () => {
      expect(browserTool.state).toBe('idle');

      await browserTool.cleanupAllSessions();

      expect(browserTool.state).toBe('destroyed');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to cleaning_up');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to destroyed');
    });

    it('should not change state when already destroyed', async () => {
      browserTool.state = 'destroyed';
      consoleDebugSpy.mockClear();

      await browserTool.cleanupAllSessions();

      expect(browserTool.state).toBe('destroyed');
      // Should not log state transitions since we're already destroyed
      expect(consoleDebugSpy).not.toHaveBeenCalledWith('BrowserTool: State transitioned to cleaning_up');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to destroyed');
    });

    it('should clean up all active sessions during state transition', async () => {
      // Create some active sessions by executing operations
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      await browserTool.execute({
        operation: 'click',
        params: { selector: 'button' }
      });

      // Verify we have active sessions (internal state)
      expect(browserTool.state).toBe('active');

      // Cleanup should clear all sessions and transition state
      await browserTool.cleanupAllSessions();

      expect(browserTool.state).toBe('destroyed');
    });
  });

  describe('console logging', () => {
    it('should log state transition from idle to active', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned from idle to active');
    });

    it('should log state transitions during cleanup', async () => {
      browserTool.state = 'active';

      await browserTool.cleanupAllSessions();

      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to cleaning_up');
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to destroyed');
    });

    it('should use console.debug for all logging', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      await browserTool.cleanupAllSessions();

      // Verify only debug logging is used, not other console methods
      expect(consoleDebugSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      consoleInfoSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle multiple rapid execute calls during state transition', async () => {
      // Simulate rapid concurrent calls
      const promises = [
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com' } }),
        browserTool.execute({ operation: 'click', params: { selector: 'button' } }),
        browserTool.execute({ operation: 'type', params: { selector: 'input', text: 'test' } })
      ];

      const results = await Promise.all(promises);

      // All should succeed and tool should be in active state
      results.forEach(result => expect(result.success).toBe(true));
      expect(browserTool.state).toBe('active');

      // Should only log the state transition once
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned from idle to active');
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle execute call during cleanup', async () => {
      // Start cleanup without awaiting
      const cleanupPromise = browserTool.cleanupAllSessions();

      // Try to execute during cleanup
      const executePromise = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Wait for both to complete
      const [, executeResult] = await Promise.all([cleanupPromise, executePromise]);

      // Execute should fail because tool is destroyed
      expect(executeResult.success).toBe(false);
      expect(executeResult.error).toBe('Browser tool has been destroyed and cannot execute operations');
      expect(browserTool.state).toBe('destroyed');
    });

    it('should handle state manipulation attempts', () => {
      // Direct state manipulation should be possible (public property)
      browserTool.state = 'destroyed';
      expect(browserTool.state).toBe('destroyed');
      expect(browserTool.isActive()).toBe(false);
    });

    it('should handle multiple cleanup calls', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // First cleanup
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');

      consoleDebugSpy.mockClear();

      // Second cleanup
      await browserTool.cleanupAllSessions();
      expect(browserTool.state).toBe('destroyed');

      // Should still log the destroyed transition (as per implementation)
      expect(consoleDebugSpy).toHaveBeenCalledWith('BrowserTool: State transitioned to destroyed');
    });

    it('should maintain state consistency across different operations', async () => {
      const operations = [
        { operation: 'navigate' as const, params: { url: 'https://example.com' } },
        { operation: 'click' as const, params: { selector: 'button' } },
        { operation: 'type' as const, params: { selector: 'input', text: 'test' } },
        { operation: 'screenshot' as const, params: { path: './test.png' } },
        { operation: 'waitForSelector' as const, params: { selector: '.element' } },
      ];

      for (const operation of operations) {
        const result = await browserTool.execute(operation);
        expect(result.success).toBe(true);
        expect(browserTool.state).toBe('active');
      }

      expect(browserTool.isActive()).toBe(true);
    });
  });

  describe('state type safety', () => {
    it('should accept all valid BrowserLifecycleState values', () => {
      const validStates: BrowserLifecycleState[] = ['idle', 'launching', 'active', 'cleaning_up', 'destroyed'];

      validStates.forEach(state => {
        browserTool.state = state;
        expect(browserTool.state).toBe(state);
      });
    });

    it('should maintain type consistency with BrowserLifecycleAware interface', () => {
      // This is a compile-time check, but we can verify the property exists and has the right type
      const state: BrowserLifecycleState = browserTool.state;
      expect(typeof state).toBe('string');
      expect(['idle', 'launching', 'active', 'cleaning_up', 'destroyed']).toContain(state);

      const isActive: boolean = browserTool.isActive();
      expect(typeof isActive).toBe('boolean');
    });
  });
});