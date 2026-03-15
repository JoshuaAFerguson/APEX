/**
 * Test timing data with proper timing fields
 *
 * This test verifies that the timing data implementation includes all
 * proper timing fields and works correctly across different scenarios.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  assertFailedToolTiming,
  assertConcurrentFailedToolTiming,
  assertTimingAccuracy,
  type ToolCallCompleteEventLike,
} from './test-utils/failed-tool-timing-helpers';

// Mock tool execution class for testing timing data
class TimingDataValidator extends EventEmitter {
  private activeExecutions = new Map<string, { startTime: Date; toolName: string; taskId: string }>();
  private executionCounter = 0;

  /**
   * Start a tool execution and capture start timing
   */
  async startTool(taskId: string, toolName: string, input: Record<string, unknown> = {}): Promise<string> {
    const callId = `timing-test-${++this.executionCounter}`;
    const startTime = new Date();

    // Store execution start data
    this.activeExecutions.set(callId, { startTime, toolName, taskId });

    // Emit start event
    this.emit('tool:start', {
      taskId,
      toolName,
      callId,
      input,
      timestamp: startTime,
    });

    return callId;
  }

  /**
   * Complete a tool execution with proper timing fields
   */
  async completeTool(
    callId: string,
    success: boolean,
    result: unknown,
    duration?: number
  ): Promise<ToolCallCompleteEventLike> {
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      throw new Error(`No execution found for callId: ${callId}`);
    }

    // Calculate end time based on duration or current time
    const actualDuration = duration ?? 100; // Default 100ms if not specified
    const endTime = new Date(execution.startTime.getTime() + actualDuration);

    const completeEvent: ToolCallCompleteEventLike = {
      taskId: execution.taskId,
      toolName: execution.toolName,
      callId,
      result: {
        success,
        output: success ? result : undefined,
        error: success ? undefined : (result as string),
      },
      timing: {
        startTime: execution.startTime,
        endTime,
        duration: actualDuration,
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
   * Simulate a failing tool with specific duration
   */
  async failTool(callId: string, errorMessage: string, duration: number = 50): Promise<ToolCallCompleteEventLike> {
    return this.completeTool(callId, false, errorMessage, duration);
  }

  /**
   * Simulate a successful tool with specific duration
   */
  async succeedTool(callId: string, result: unknown, duration: number = 50): Promise<ToolCallCompleteEventLike> {
    return this.completeTool(callId, true, result, duration);
  }

  /**
   * Get current active executions count
   */
  getActiveCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Clear all active executions
   */
  cleanup(): void {
    this.activeExecutions.clear();
  }
}

describe('Timing Data with Proper Timing Fields', () => {
  let validator: TimingDataValidator;
  const collectedEvents: ToolCallCompleteEventLike[] = [];

  beforeEach(() => {
    validator = new TimingDataValidator();
    collectedEvents.length = 0;

    // Collect all tool:complete events for validation
    validator.on('tool:complete', (event) => {
      collectedEvents.push(event);
    });

    vi.clearAllTimers();
  });

  afterEach(() => {
    validator.cleanup();
  });

  describe('Basic Timing Field Validation', () => {
    it('should include all required timing fields', async () => {
      const callId = await validator.startTool('test-task', 'TimingTestTool');
      const event = await validator.failTool(callId, 'Test failure', 150);

      // Verify all timing fields are present
      expect(event.timing).toBeDefined();
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(event.timing.duration).toBeTypeOf('number');

      // Verify timing consistency
      expect(event.timing.duration).toBe(150);
      expect(event.timing.endTime.getTime() - event.timing.startTime.getTime()).toBe(150);

      // Verify timing logic
      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(event.timing.startTime.getTime());
    });

    it('should handle successful tools with proper timing', async () => {
      const callId = await validator.startTool('success-task', 'SuccessTestTool');
      const event = await validator.succeedTool(callId, { data: 'success' }, 200);

      // Verify successful execution has proper timing
      expect(event.result.success).toBe(true);
      expect(event.timing.duration).toBe(200);

      // Verify timing fields are present and valid for successful tools too
      expect(event.timing).toBeDefined();
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(event.timing.duration).toBeTypeOf('number');

      // Verify timing consistency
      expect(event.timing.endTime.getTime() - event.timing.startTime.getTime()).toBe(200);
      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(event.timing.startTime.getTime());

      // Verify timing accuracy
      assertTimingAccuracy(event.timing.duration, 200, 10);
    });

    it('should handle failed tools with proper timing', async () => {
      const callId = await validator.startTool('failure-task', 'FailureTestTool');
      const event = await validator.failTool(callId, 'Validation error', 75);

      // Verify failed execution has proper timing
      expect(event.result.success).toBe(false);
      expect(event.result.error).toBe('Validation error');
      expect(event.timing.duration).toBe(75);

      assertFailedToolTiming(event, {
        expectedMinDuration: 70,
        expectedMaxDuration: 80,
        tolerance: 5,
      });
    });
  });

  describe('Timing Accuracy and Precision', () => {
    it('should maintain precision for sub-second durations', async () => {
      const durations = [1, 5, 25, 50, 99];

      for (const duration of durations) {
        const callId = await validator.startTool('precision-task', 'PrecisionTool');
        const event = await validator.failTool(callId, `Test ${duration}ms`, duration);

        expect(event.timing.duration).toBe(duration);
        assertTimingAccuracy(event.timing.duration, duration, 1);
      }

      expect(collectedEvents).toHaveLength(durations.length);
    });

    it('should handle longer duration timing correctly', async () => {
      const longDurations = [1000, 2500, 5000];

      for (const duration of longDurations) {
        const callId = await validator.startTool('long-task', 'LongTestTool');
        const event = await validator.failTool(callId, `Long test ${duration}ms`, duration);

        expect(event.timing.duration).toBe(duration);
        expect(event.timing.endTime.getTime() - event.timing.startTime.getTime()).toBe(duration);
      }

      expect(collectedEvents).toHaveLength(longDurations.length);
    });

    it('should maintain timing consistency across multiple tools', async () => {
      const toolCount = 10;
      const baseDuration = 100;

      // Start multiple tools
      const callIds: string[] = [];
      for (let i = 0; i < toolCount; i++) {
        const callId = await validator.startTool(`multi-task-${i}`, `MultiTool-${i}`);
        callIds.push(callId);
      }

      // Complete with different durations
      for (let i = 0; i < callIds.length; i++) {
        const duration = baseDuration + (i * 10);
        await validator.failTool(callIds[i], `Multi error ${i}`, duration);
      }

      expect(collectedEvents).toHaveLength(toolCount);

      // Verify each event has correct timing
      collectedEvents.forEach((event, index) => {
        const expectedDuration = baseDuration + (index * 10);
        expect(event.timing.duration).toBe(expectedDuration);
        assertTimingAccuracy(event.timing.duration, expectedDuration, 1);
      });
    });
  });

  describe('Concurrent Timing Validation', () => {
    it('should handle concurrent tool executions with independent timing', async () => {
      const concurrentCount = 5;
      const callIds: string[] = [];

      // Start all tools concurrently
      for (let i = 0; i < concurrentCount; i++) {
        const callId = await validator.startTool('concurrent-task', `ConcurrentTool-${i}`);
        callIds.push(callId);
      }

      // Complete them with different durations
      const completionPromises = callIds.map(async (callId, index) => {
        const duration = 50 + (index * 25); // 50, 75, 100, 125, 150ms
        return validator.failTool(callId, `Concurrent error ${index}`, duration);
      });

      await Promise.all(completionPromises);

      expect(collectedEvents).toHaveLength(concurrentCount);

      // Verify concurrent timing independence
      assertConcurrentFailedToolTiming(collectedEvents);

      // Verify specific durations
      const expectedDurations = [50, 75, 100, 125, 150];
      collectedEvents.forEach((event, index) => {
        expect(event.timing.duration).toBe(expectedDurations[index]);
      });
    });

    it('should validate timing fields are properly typed', async () => {
      const callId = await validator.startTool('type-test', 'TypeTestTool');
      const event = await validator.failTool(callId, 'Type validation', 123);

      // Verify timing field types
      expect(typeof event.timing.duration).toBe('number');
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);

      // Verify numeric precision
      expect(Number.isInteger(event.timing.duration)).toBe(true);
      expect(event.timing.duration).toBeGreaterThan(0);

      // Verify date objects are valid
      expect(event.timing.startTime.getTime()).toBeGreaterThan(0);
      expect(event.timing.endTime.getTime()).toBeGreaterThan(0);
      expect(isNaN(event.timing.startTime.getTime())).toBe(false);
      expect(isNaN(event.timing.endTime.getTime())).toBe(false);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle zero and minimal duration properly', async () => {
      // Test with 0ms duration (immediate failure)
      const callId1 = await validator.startTool('zero-task', 'ZeroTool');
      const event1 = await validator.failTool(callId1, 'Immediate failure', 0);

      expect(event1.timing.duration).toBe(0);
      expect(event1.timing.endTime.getTime()).toBe(event1.timing.startTime.getTime());

      // Test with 1ms duration (minimal)
      const callId2 = await validator.startTool('minimal-task', 'MinimalTool');
      const event2 = await validator.failTool(callId2, 'Minimal failure', 1);

      expect(event2.timing.duration).toBe(1);
      expect(event2.timing.endTime.getTime() - event2.timing.startTime.getTime()).toBe(1);

      assertFailedToolTiming(event1, { allowZeroDuration: true });
      assertFailedToolTiming(event2, { allowZeroDuration: false });
    });

    it('should maintain timing integrity during cleanup operations', async () => {
      const callId = await validator.startTool('cleanup-task', 'CleanupTool');

      // Verify execution is tracked
      expect(validator.getActiveCount()).toBe(1);

      const event = await validator.failTool(callId, 'Pre-cleanup error', 200);

      // Verify execution is cleaned up
      expect(validator.getActiveCount()).toBe(0);

      // Verify timing is still valid
      expect(event.timing.duration).toBe(200);
      assertFailedToolTiming(event);
    });
  });

  describe('Integration with Helper Functions', () => {
    it('should pass all assertion helper validations', async () => {
      const callId = await validator.startTool('assertion-task', 'AssertionTool');
      const event = await validator.failTool(callId, 'Assertion test error', 300);

      // Test all helper assertions pass
      expect(() => {
        assertFailedToolTiming(event, {
          expectedMinDuration: 250,
          expectedMaxDuration: 350,
          tolerance: 25,
        });
      }).not.toThrow();

      expect(() => {
        assertTimingAccuracy(event.timing.duration, 300, 10);
      }).not.toThrow();

      expect(() => {
        assertConcurrentFailedToolTiming([event]);
      }).not.toThrow();
    });
  });
});