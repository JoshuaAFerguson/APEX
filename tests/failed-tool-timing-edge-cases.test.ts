/**
 * Failed Tool Timing Edge Cases - Advanced Tests
 *
 * Additional edge cases and stress tests for timing events
 * of failed tools. These tests cover corner cases, performance
 * scenarios, and error conditions that might not be caught
 * in the basic test suite.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Reuse event interfaces from the main test file
interface ToolCallStartEvent {
  taskId: string;
  toolName: string;
  callId: string;
  input: Record<string, unknown>;
  timestamp: Date;
}

interface ToolCallCompleteEvent {
  taskId: string;
  toolName: string;
  callId: string;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  timestamp: Date;
}

/**
 * Advanced tool execution simulator with error injection capabilities
 */
class AdvancedToolExecutionSimulator extends EventEmitter {
  private activeExecutions = new Map<
    string,
    { startTime: Date; toolName: string; taskId: string }
  >();
  private clockOffset = 0; // For simulating clock skew

  /**
   * Set a clock offset to simulate system clock changes
   */
  setClockOffset(offsetMs: number): void {
    this.clockOffset = offsetMs;
  }

  /**
   * Get current time with offset applied
   */
  private now(): Date {
    return new Date(Date.now() + this.clockOffset);
  }

  async startTool(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>
  ): Promise<void> {
    const startTime = this.now();
    this.activeExecutions.set(callId, { startTime, toolName, taskId });

    const startEvent: ToolCallStartEvent = {
      taskId,
      toolName,
      callId,
      input,
      timestamp: startTime,
    };

    this.emit('tool:start', startEvent);
  }

  async failTool(
    callId: string,
    errorMessage: string = 'Tool execution failed',
    delayMs: number = 0
  ): Promise<ToolCallCompleteEvent> {
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      throw new Error(`No active execution found for callId: ${callId}`);
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const endTime = this.now();
    const duration = endTime.getTime() - execution.startTime.getTime();

    const completeEvent: ToolCallCompleteEvent = {
      taskId: execution.taskId,
      toolName: execution.toolName,
      callId,
      result: {
        success: false,
        error: errorMessage,
      },
      timing: {
        startTime: execution.startTime,
        endTime,
        duration,
      },
      timestamp: endTime,
    };

    this.activeExecutions.delete(callId);
    this.emit('tool:complete', completeEvent);

    return completeEvent;
  }

  /**
   * Simulate a tool that fails during execution (throws exception)
   */
  async crashTool(callId: string, delayMs: number = 0): Promise<void> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      throw new Error(`No active execution found for callId: ${callId}`);
    }

    // Even when crashing, we should emit a complete event with error
    const endTime = this.now();
    const duration = endTime.getTime() - execution.startTime.getTime();

    const completeEvent: ToolCallCompleteEvent = {
      taskId: execution.taskId,
      toolName: execution.toolName,
      callId,
      result: {
        success: false,
        error: 'Tool crashed with exception',
      },
      timing: {
        startTime: execution.startTime,
        endTime,
        duration,
      },
      timestamp: endTime,
    };

    this.activeExecutions.delete(callId);
    this.emit('tool:complete', completeEvent);
  }

  /**
   * Get count of active executions
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Force clear all active executions (for cleanup)
   */
  clearAllExecutions(): void {
    this.activeExecutions.clear();
  }
}

describe('Failed Tool Timing Edge Cases', () => {
  let simulator: AdvancedToolExecutionSimulator;
  const TIMING_TOLERANCE = 50;

  beforeEach(() => {
    simulator = new AdvancedToolExecutionSimulator();
    vi.clearAllTimers();
  });

  describe('Clock and Timing Edge Cases', () => {
    it('should handle system clock adjustments during tool execution', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      // Start tool
      await simulator.startTool('clock-test', 'ClockTool', 'clock-call', {});

      // Simulate clock adjustment during execution (e.g., NTP sync)
      simulator.setClockOffset(100); // Move clock forward 100ms

      await simulator.failTool('clock-call', 'Clock adjustment test', 50);

      expect(completeEvent).toBeTruthy();
      // Even with clock adjustment, timing should be consistent
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);

      // The adjusted time should be reflected
      const calculatedDuration =
        completeEvent!.timing.endTime.getTime() - completeEvent!.timing.startTime.getTime();
      expect(completeEvent!.timing.duration).toBe(calculatedDuration);
    });

    it('should handle very precise timing measurements', async () => {
      const events: ToolCallCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Multiple tools with very small delays
      const preciseDelays = [1, 2, 3, 5, 8, 13]; // Fibonacci-like sequence

      for (let i = 0; i < preciseDelays.length; i++) {
        const callId = `precise-${i}`;
        await simulator.startTool('precise-task', `PreciseTool-${i}`, callId, {});
        await simulator.failTool(callId, `Precise error ${i}`, preciseDelays[i]);
      }

      expect(events).toHaveLength(preciseDelays.length);

      // Verify each timing is reasonable given the precision
      events.forEach((event, index) => {
        const expectedDelay = preciseDelays[index];

        // Duration should be at least the delay (allowing for some overhead)
        expect(event.timing.duration).toBeGreaterThanOrEqual(expectedDelay - 5);

        // But shouldn't be excessively larger
        expect(event.timing.duration).toBeLessThan(expectedDelay + 100);
      });
    });

    it('should handle timing when tool crashes with exception', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const delayBeforeCrash = 75;

      await simulator.startTool('crash-test', 'CrashTool', 'crash-call', { willCrash: true });
      await simulator.crashTool('crash-call', delayBeforeCrash);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.success).toBe(false);
      expect(completeEvent!.result.error).toContain('crashed');

      // Should still capture timing even for crashes
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(
        delayBeforeCrash - TIMING_TOLERANCE
      );
      expect(completeEvent!.timing.duration).toBeLessThan(delayBeforeCrash + TIMING_TOLERANCE * 2);
    });
  });

  describe('High Load and Stress Testing', () => {
    it('should handle high-frequency tool failures without timing corruption', async () => {
      const events: ToolCallCompleteEvent[] = [];
      const toolCount = 50;

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Start many tools rapidly
      const startPromises = [];
      for (let i = 0; i < toolCount; i++) {
        startPromises.push(
          simulator.startTool('stress-test', `StressTool-${i}`, `stress-${i}`, { index: i })
        );
      }
      await Promise.all(startPromises);

      // Fail all tools with minimal delays
      const failPromises = [];
      for (let i = 0; i < toolCount; i++) {
        failPromises.push(
          simulator.failTool(`stress-${i}`, `Stress error ${i}`, Math.random() * 10)
        );
      }
      await Promise.all(failPromises);

      expect(events).toHaveLength(toolCount);

      // Verify no timing corruption
      events.forEach((event) => {
        // Verify call ID format (should be stress-X where X is a number)
        expect(event.callId).toMatch(/^stress-\d+$/);
        expect(event.result.success).toBe(false);
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);
        expect(event.timing.duration).toBeLessThan(1000); // Reasonable upper bound

        // Timing consistency
        const calculated = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculated);
      });

      // Verify all expected callIds are present
      const receivedCallIds = new Set(events.map((e) => e.callId));
      for (let i = 0; i < toolCount; i++) {
        expect(receivedCallIds.has(`stress-${i}`)).toBe(true);
      }

      // Verify all executions were cleaned up
      expect(simulator.getActiveExecutionCount()).toBe(0);
    });

    it('should handle tools with extremely long execution times before failure', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const longDelay = 1000; // 1 second

      await simulator.startTool('long-test', 'VeryLongTool', 'long-call', { duration: longDelay });
      await simulator.failTool('long-call', 'Failed after very long execution', longDelay);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(longDelay - TIMING_TOLERANCE);
      expect(completeEvent!.timing.duration).toBeLessThanOrEqual(longDelay + TIMING_TOLERANCE * 3);

      // Should still be precise despite long duration
      const calculated =
        completeEvent!.timing.endTime.getTime() - completeEvent!.timing.startTime.getTime();
      expect(completeEvent!.timing.duration).toBe(calculated);
    }, 15000); // Extended timeout for long test
  });

  describe('Error Message and Metadata Edge Cases', () => {
    it('should handle very large error messages', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      // Create a very large error message
      const largeErrorMessage = 'Error: ' + 'x'.repeat(10000) + ' - End of large error';

      await simulator.startTool('large-error-test', 'LargeTool', 'large-call', {});
      await simulator.failTool('large-call', largeErrorMessage, 25);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.error).toBe(largeErrorMessage);
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);

      // Timing should not be affected by large error messages
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(25 - TIMING_TOLERANCE);
    });

    it('should handle special characters in error messages', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const specialErrorMessage =
        'Error with 🔥 emoji, "quotes", \\backslashes\\, and \n newlines \t tabs';

      await simulator.startTool('special-test', 'SpecialTool', 'special-call', {});
      await simulator.failTool('special-call', specialErrorMessage, 15);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.error).toBe(specialErrorMessage);
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle null and undefined error conditions gracefully', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await simulator.startTool('null-test', 'NullTool', 'null-call', {});
      // Pass null as error message (should be handled gracefully)
      await simulator.failTool('null-call', null as any, 10);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.success).toBe(false);
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should properly clean up executions after failures', async () => {
      // Start many tools
      for (let i = 0; i < 100; i++) {
        await simulator.startTool('cleanup-test', `CleanupTool-${i}`, `cleanup-${i}`, {});
      }

      expect(simulator.getActiveExecutionCount()).toBe(100);

      // Fail all tools
      for (let i = 0; i < 100; i++) {
        await simulator.failTool(`cleanup-${i}`, `Cleanup error ${i}`, 1);
      }

      // All executions should be cleaned up
      expect(simulator.getActiveExecutionCount()).toBe(0);
    });

    it('should handle cleanup when simulator is destroyed', () => {
      // Start some tools but don't complete them
      simulator.startTool('abandon-test', 'AbandonTool1', 'abandon-1', {});
      simulator.startTool('abandon-test', 'AbandonTool2', 'abandon-2', {});

      expect(simulator.getActiveExecutionCount()).toBe(2);

      // Force cleanup (simulating process termination)
      simulator.clearAllExecutions();

      expect(simulator.getActiveExecutionCount()).toBe(0);
    });
  });

  describe('Event Ordering and Concurrency', () => {
    it('should maintain correct event ordering under heavy concurrent load', async () => {
      const startEvents: ToolCallStartEvent[] = [];
      const completeEvents: ToolCallCompleteEvent[] = [];

      simulator.on('tool:start', (event) => {
        startEvents.push(event);
      });

      simulator.on('tool:complete', (event) => {
        completeEvents.push(event);
      });

      const concurrentCount = 20;

      // Start all tools concurrently
      const startPromises = [];
      for (let i = 0; i < concurrentCount; i++) {
        startPromises.push(
          simulator.startTool('concurrent-order-test', `ConcurrentTool-${i}`, `concurrent-${i}`, {
            index: i,
          })
        );
      }
      await Promise.all(startPromises);

      // Fail all tools concurrently with different delays
      const failPromises = [];
      for (let i = 0; i < concurrentCount; i++) {
        const delay = (i % 5) * 10; // Vary delays: 0, 10, 20, 30, 40, 0, 10, ...
        failPromises.push(simulator.failTool(`concurrent-${i}`, `Concurrent error ${i}`, delay));
      }
      await Promise.all(failPromises);

      expect(startEvents).toHaveLength(concurrentCount);
      expect(completeEvents).toHaveLength(concurrentCount);

      // Each start event should have a corresponding complete event
      startEvents.forEach((startEvent) => {
        const correspondingComplete = completeEvents.find((ce) => ce.callId === startEvent.callId);
        expect(correspondingComplete).toBeTruthy();

        // Start timestamp should match the timing start time
        expect(startEvent.timestamp.getTime()).toBe(
          correspondingComplete!.timing.startTime.getTime()
        );
      });
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle minimum and maximum safe integer durations', async () => {
      const events: ToolCallCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Test with 0 delay (minimum)
      await simulator.startTool('boundary-test', 'MinTool', 'min-call', {});
      await simulator.failTool('min-call', 'Min boundary test', 0);

      expect(events[0].timing.duration).toBeGreaterThanOrEqual(0);
      expect(events[0].timing.duration).toBeLessThan(100); // Should be very small

      // Test with a reasonably large delay
      const largeDelay = 2000; // 2 seconds
      await simulator.startTool('boundary-test', 'MaxTool', 'max-call', {});
      await simulator.failTool('max-call', 'Max boundary test', largeDelay);

      expect(events[1].timing.duration).toBeGreaterThanOrEqual(largeDelay - TIMING_TOLERANCE);
      expect(events[1].timing.duration).toBeLessThanOrEqual(largeDelay + TIMING_TOLERANCE * 3);
    }, 10000);

    it('should handle tools that start but never complete (timeout scenario)', async () => {
      const startEvents: ToolCallStartEvent[] = [];

      simulator.on('tool:start', (event) => {
        startEvents.push(event);
      });

      // Start a tool but never complete it
      await simulator.startTool('timeout-test', 'TimeoutTool', 'timeout-call', {
        willTimeout: true,
      });

      expect(startEvents).toHaveLength(1);
      expect(simulator.getActiveExecutionCount()).toBe(1);

      // Verify that incomplete executions can be tracked
      expect(startEvents[0].timestamp).toBeInstanceOf(Date);
      expect(startEvents[0].callId).toBe('timeout-call');

      // Clean up the abandoned execution
      simulator.clearAllExecutions();
      expect(simulator.getActiveExecutionCount()).toBe(0);
    });
  });
});
