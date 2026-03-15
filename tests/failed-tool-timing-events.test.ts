/**
 * Failed Tool Timing Events - Simplified Tests
 *
 * Tests that verify timing data is correctly captured and emitted
 * for tools that fail during execution. This focuses on the core
 * event emission and timing capture mechanisms without complex
 * orchestrator setup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Define the event types we need to test
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
 * Simple tool execution simulator for testing timing events
 */
class ToolExecutionSimulator extends EventEmitter {
  private activeExecutions = new Map<
    string,
    { startTime: Date; toolName: string; taskId: string }
  >();

  /**
   * Simulate starting a tool execution
   */
  async startTool(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>
  ): Promise<void> {
    const startTime = new Date();

    // Store active execution
    this.activeExecutions.set(callId, { startTime, toolName, taskId });

    // Emit start event
    const startEvent: ToolCallStartEvent = {
      taskId,
      toolName,
      callId,
      input,
      timestamp: startTime,
    };

    this.emit('tool:start', startEvent);
  }

  /**
   * Simulate a tool execution failure after a delay
   */
  async failTool(
    callId: string,
    errorMessage: string = 'Tool execution failed',
    delayMs: number = 0
  ): Promise<ToolCallCompleteEvent> {
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      throw new Error(`No active execution found for callId: ${callId}`);
    }

    // Simulate processing delay
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const endTime = new Date();
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

    // Clean up
    this.activeExecutions.delete(callId);

    // Emit complete event
    this.emit('tool:complete', completeEvent);

    return completeEvent;
  }

  /**
   * Simulate a successful tool execution for comparison
   */
  async succeedTool(
    callId: string,
    output: unknown = 'Success',
    delayMs: number = 0
  ): Promise<ToolCallCompleteEvent> {
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      throw new Error(`No active execution found for callId: ${callId}`);
    }

    // Simulate processing delay
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const endTime = new Date();
    const duration = endTime.getTime() - execution.startTime.getTime();

    const completeEvent: ToolCallCompleteEvent = {
      taskId: execution.taskId,
      toolName: execution.toolName,
      callId,
      result: {
        success: true,
        output,
      },
      timing: {
        startTime: execution.startTime,
        endTime,
        duration,
      },
      timestamp: endTime,
    };

    // Clean up
    this.activeExecutions.delete(callId);

    // Emit complete event
    this.emit('tool:complete', completeEvent);

    return completeEvent;
  }
}

describe('Failed Tool Timing Events', () => {
  let simulator: ToolExecutionSimulator;
  const TIMING_TOLERANCE = 200; // 200ms tolerance for CI environments (actual: 100ms + 100ms buffer)

  beforeEach(() => {
    simulator = new ToolExecutionSimulator();
    vi.clearAllTimers();
  });

  describe('Basic Timing Capture', () => {
    it('should capture accurate timing for failed tools', async () => {
      const taskId = 'test-task-001';
      const toolName = 'TestTool';
      const callId = 'call-001';
      const delayMs = 100;

      let startEvent: ToolCallStartEvent | null = null;
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:start', (event) => {
        startEvent = event;
      });

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      // Start the tool
      await simulator.startTool(taskId, toolName, callId, { test: true });

      // Fail the tool after delay
      await simulator.failTool(callId, 'Test failure', delayMs);

      // Verify start event
      expect(startEvent).toBeTruthy();
      expect(startEvent!.taskId).toBe(taskId);
      expect(startEvent!.toolName).toBe(toolName);
      expect(startEvent!.callId).toBe(callId);
      expect(startEvent!.timestamp).toBeInstanceOf(Date);

      // Verify complete event
      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.success).toBe(false);
      expect(completeEvent!.result.error).toBe('Test failure');

      // Verify timing data
      expect(completeEvent!.timing.startTime).toBeInstanceOf(Date);
      expect(completeEvent!.timing.endTime).toBeInstanceOf(Date);
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(delayMs - TIMING_TOLERANCE);
      expect(completeEvent!.timing.duration).toBeLessThanOrEqual(delayMs + TIMING_TOLERANCE);

      // Verify timing consistency
      const calculatedDuration =
        completeEvent!.timing.endTime.getTime() - completeEvent!.timing.startTime.getTime();
      expect(completeEvent!.timing.duration).toBe(calculatedDuration);

      // Verify start time matches between events
      expect(startEvent!.timestamp.getTime()).toBe(completeEvent!.timing.startTime.getTime());
    });

    it('should capture timing for immediate failures (zero delay)', async () => {
      const taskId = 'test-task-002';
      const toolName = 'InstantFailTool';
      const callId = 'call-002';

      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      // Start and immediately fail
      await simulator.startTool(taskId, toolName, callId, {});
      await simulator.failTool(callId, 'Immediate validation failure', 0);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.success).toBe(false);

      // Duration may be 0 for immediate failures
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);
      expect(completeEvent!.timing.duration).toBeLessThan(100); // Should be very fast

      // Timing consistency check
      expect(completeEvent!.timing.startTime.getTime()).toBeLessThanOrEqual(
        completeEvent!.timing.endTime.getTime()
      );
    });
  });

  describe('Different Failure Types', () => {
    it('should capture timing for timeout errors', async () => {
      const delayMs = 200;
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await simulator.startTool('task-timeout', 'TimeoutTool', 'call-timeout', { timeout: 200 });
      await simulator.failTool('call-timeout', 'timeout: Operation exceeded time limit', delayMs);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.error).toContain('timeout');
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(delayMs - TIMING_TOLERANCE);
    });

    it('should capture timing for validation errors', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await simulator.startTool('task-validation', 'ValidationTool', 'call-validation', {
        invalid: null,
      });
      await simulator.failTool('call-validation', 'validation_error: Invalid parameter', 0);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.error).toContain('validation_error');
      // Validation should be fast
      expect(completeEvent!.timing.duration).toBeLessThan(50);
    });

    it('should capture timing for permission denied errors', async () => {
      const delayMs = 25;
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await simulator.startTool('task-permission', 'RestrictedTool', 'call-permission', {
        action: 'delete',
      });
      await simulator.failTool('call-permission', 'permission_denied: Action not allowed', delayMs);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.error).toContain('permission_denied');
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);
    });

    it('should capture timing for network errors', async () => {
      const delayMs = 300;
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await simulator.startTool('task-network', 'NetworkTool', 'call-network', {
        url: 'https://unreachable.example.com',
      });
      await simulator.failTool('call-network', 'network_error: Connection refused', delayMs);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.error).toContain('network_error');
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(delayMs - TIMING_TOLERANCE);
    });
  });

  describe('Concurrent Tool Failures', () => {
    it('should track independent timing for concurrent failing tools', async () => {
      const events: ToolCallCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      const toolConfigs = [
        { callId: 'concurrent-1', toolName: 'Tool1', delayMs: 50, errorMessage: 'Error 1' },
        { callId: 'concurrent-2', toolName: 'Tool2', delayMs: 100, errorMessage: 'Error 2' },
        { callId: 'concurrent-3', toolName: 'Tool3', delayMs: 75, errorMessage: 'Error 3' },
      ];

      // Start all tools
      const startPromises = toolConfigs.map((config) =>
        simulator.startTool('concurrent-task', config.toolName, config.callId, {})
      );
      await Promise.all(startPromises);

      // Fail all tools concurrently
      const failPromises = toolConfigs.map((config) =>
        simulator.failTool(config.callId, config.errorMessage, config.delayMs)
      );
      await Promise.all(failPromises);

      // Should have 3 failed tool events
      expect(events).toHaveLength(3);

      // Each tool should have independent timing
      events.forEach((event) => {
        expect(event.result.success).toBe(false);
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);
      });

      // Verify timing for each specific tool
      const event1 = events.find((e) => e.callId === 'concurrent-1');
      const event2 = events.find((e) => e.callId === 'concurrent-2');
      const event3 = events.find((e) => e.callId === 'concurrent-3');

      expect(event1?.timing.duration).toBeGreaterThanOrEqual(50 - TIMING_TOLERANCE);
      expect(event2?.timing.duration).toBeGreaterThanOrEqual(100 - TIMING_TOLERANCE);
      expect(event3?.timing.duration).toBeGreaterThanOrEqual(75 - TIMING_TOLERANCE);
    });

    it('should handle mixed success/failure with correct timing', async () => {
      const events: ToolCallCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Start tools
      await simulator.startTool('mixed-task', 'SuccessTool', 'success-1', {});
      await simulator.startTool('mixed-task', 'FailTool', 'failure-1', {});
      await simulator.startTool('mixed-task', 'SuccessTool', 'success-2', {});
      await simulator.startTool('mixed-task', 'FailTool', 'failure-2', {});

      // Execute with different outcomes
      await Promise.all([
        simulator.succeedTool('success-1', 'Result 1', 60),
        simulator.failTool('failure-1', 'Error 1', 80),
        simulator.succeedTool('success-2', 'Result 2', 40),
        simulator.failTool('failure-2', 'Error 2', 120),
      ]);

      expect(events).toHaveLength(4);

      const successEvents = events.filter((e) => e.result.success);
      const failureEvents = events.filter((e) => !e.result.success);

      expect(successEvents).toHaveLength(2);
      expect(failureEvents).toHaveLength(2);

      // All events should have valid timing
      events.forEach((event) => {
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);
        expect(event.timing.startTime.getTime()).toBeLessThanOrEqual(
          event.timing.endTime.getTime()
        );
      });
    });
  });

  describe('Timing Edge Cases', () => {
    it('should handle rapid consecutive failures', async () => {
      const events: ToolCallCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      const failureCount = 5;

      // Rapid fire tool executions
      for (let i = 0; i < failureCount; i++) {
        const callId = `rapid-${i}`;
        await simulator.startTool('rapid-task', `RapidTool-${i}`, callId, { index: i });
        await simulator.failTool(callId, `Rapid failure ${i}`, 5);
      }

      expect(events).toHaveLength(failureCount);

      // Verify timing integrity
      events.forEach((event, index) => {
        expect(event.callId).toBe(`rapid-${index}`);
        expect(event.result.success).toBe(false);
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        // Timing should be consistent
        const calculatedDuration =
          event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });

      // Events should be in order
      for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const curr = events[i];
        expect(curr.timing.startTime.getTime()).toBeGreaterThanOrEqual(
          prev.timing.startTime.getTime()
        );
      }
    });

    it('should preserve timing through error scenarios', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      // Tool that fails with empty error message
      await simulator.startTool('error-edge', 'EmptyErrorTool', 'empty-error', {});
      await simulator.failTool('empty-error', '', 30);

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.success).toBe(false);
      expect(completeEvent!.result.error).toBe('');
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle long-running tool failures', async () => {
      const longDelay = 500;
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await simulator.startTool('long-task', 'LongRunningTool', 'long-call', {
        duration: longDelay,
      });
      await simulator.failTool(
        'long-call',
        'Long operation failed after extended processing',
        longDelay
      );

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(longDelay - TIMING_TOLERANCE);
      expect(completeEvent!.timing.duration).toBeLessThanOrEqual(longDelay + TIMING_TOLERANCE * 2);
    }, 10000); // Extended timeout for long test
  });

  describe('Timing Data Consistency', () => {
    it('should ensure startTime is always before or equal to endTime', async () => {
      const events: ToolCallCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Multiple tools with random delays
      for (let i = 0; i < 10; i++) {
        const callId = `consistency-${i}`;
        const delayMs = Math.random() * 100;

        await simulator.startTool('consistency-task', `Tool-${i}`, callId, {});
        await simulator.failTool(callId, `Error ${i}`, delayMs);
      }

      expect(events).toHaveLength(10);

      events.forEach((event) => {
        // startTime should be before or equal to endTime
        expect(event.timing.startTime.getTime()).toBeLessThanOrEqual(
          event.timing.endTime.getTime()
        );

        // Duration should match calculated value
        const calculatedDuration =
          event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);

        // Duration should be non-negative
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);
      });
    });

    it('should maintain timing precision in milliseconds', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await simulator.startTool('precision-task', 'PrecisionTool', 'precision-call', {});
      await simulator.failTool('precision-call', 'Precision test failure', 123);

      expect(completeEvent).toBeTruthy();

      // Duration should be a whole number (no fractional milliseconds)
      expect(Number.isInteger(completeEvent!.timing.duration)).toBe(true);

      // Start and end times should be valid dates
      expect(completeEvent!.timing.startTime.toString()).not.toBe('Invalid Date');
      expect(completeEvent!.timing.endTime.toString()).not.toBe('Invalid Date');
    });
  });
});
