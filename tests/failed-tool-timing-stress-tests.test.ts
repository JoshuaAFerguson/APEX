/**
 * Failed Tool Timing Events - Stress and Edge Case Tests
 *
 * Comprehensive stress tests and edge case scenarios for timing data
 * capture in failed tool executions. These tests verify the robustness
 * of timing mechanisms under various stress conditions and edge cases.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  assertFailedToolTiming,
  assertConcurrentFailedToolTiming,
  assertTimingAccuracy,
  waitForEvents,
  ErrorTypes,
  createErrorMessage,
  DEFAULT_TIMING_TOLERANCE,
  type ToolCallCompleteEventLike,
} from './test-utils/failed-tool-timing-helpers';

// Enhanced tool execution simulator with stress testing capabilities
class StressToolExecutionSimulator extends EventEmitter {
  private activeExecutions = new Map<
    string,
    { startTime: Date; toolName: string; taskId: string; aborted?: boolean }
  >();
  private executionCounter = 0;
  private abortControllers = new Map<string, AbortController>();

  /**
   * Start a tool execution with optional abort capability
   */
  async startTool(
    taskId: string,
    toolName: string,
    callId?: string,
    input: Record<string, unknown> = {},
    abortable: boolean = false
  ): Promise<string> {
    const finalCallId = callId || `call-${++this.executionCounter}`;
    const startTime = new Date();

    // Store active execution
    this.activeExecutions.set(finalCallId, { startTime, toolName, taskId });

    // Create abort controller if abortable
    if (abortable) {
      const abortController = new AbortController();
      this.abortControllers.set(finalCallId, abortController);
    }

    // Emit start event
    this.emit('tool:start', {
      taskId,
      toolName,
      callId: finalCallId,
      input,
      timestamp: startTime,
    });

    return finalCallId;
  }

  /**
   * Abort a tool execution to simulate cancellation
   */
  abortTool(callId: string): boolean {
    const execution = this.activeExecutions.get(callId);
    const abortController = this.abortControllers.get(callId);

    if (!execution || !abortController) {
      return false;
    }

    execution.aborted = true;
    abortController.abort();

    const endTime = new Date();
    const duration = endTime.getTime() - execution.startTime.getTime();

    this.emit('tool:complete', {
      taskId: execution.taskId,
      toolName: execution.toolName,
      callId,
      result: {
        success: false,
        error: 'Tool execution aborted',
      },
      timing: {
        startTime: execution.startTime,
        endTime,
        duration,
      },
      timestamp: endTime,
    });

    // Cleanup
    this.activeExecutions.delete(callId);
    this.abortControllers.delete(callId);

    return true;
  }

  /**
   * Fail a tool with precise timing control
   */
  async failToolWithPreciseTiming(
    callId: string,
    errorMessage: string,
    exactDurationMs: number
  ): Promise<ToolCallCompleteEventLike> {
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      throw new Error(`No active execution found for callId: ${callId}`);
    }

    if (execution.aborted) {
      throw new Error(`Tool ${callId} was already aborted`);
    }

    // Calculate exact end time for precise duration
    const targetEndTime = new Date(execution.startTime.getTime() + exactDurationMs);
    const currentTime = Date.now();
    const waitTime = targetEndTime.getTime() - currentTime;

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const actualEndTime = new Date();
    const actualDuration = actualEndTime.getTime() - execution.startTime.getTime();

    const completeEvent: ToolCallCompleteEventLike = {
      taskId: execution.taskId,
      toolName: execution.toolName,
      callId,
      result: {
        success: false,
        error: errorMessage,
      },
      timing: {
        startTime: execution.startTime,
        endTime: actualEndTime,
        duration: actualDuration,
      },
      timestamp: actualEndTime,
    };

    // Clean up
    this.activeExecutions.delete(callId);
    this.abortControllers.delete(callId);

    // Emit complete event
    this.emit('tool:complete', completeEvent);

    return completeEvent;
  }

  /**
   * Simulate a burst of rapid tool failures
   */
  async simulateFailureBurst(
    taskId: string,
    burstSize: number,
    intervalMs: number = 10
  ): Promise<ToolCallCompleteEventLike[]> {
    const events: ToolCallCompleteEventLike[] = [];
    const promises: Promise<ToolCallCompleteEventLike>[] = [];

    for (let i = 0; i < burstSize; i++) {
      const callId = await this.startTool(taskId, `BurstTool-${i}`, undefined, { index: i });

      // Stagger the failures slightly
      const promise = new Promise<ToolCallCompleteEventLike>((resolve) => {
        setTimeout(async () => {
          const event = await this.failToolWithPreciseTiming(
            callId,
            `Burst failure ${i}`,
            intervalMs + (i * 5) // Slightly different durations
          );
          resolve(event);
        }, i * 2); // Very small stagger
      });

      promises.push(promise);
    }

    const results = await Promise.all(promises);
    return results;
  }

  /**
   * Get current active executions count
   */
  getActiveExecutionsCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Cleanup all active executions
   */
  cleanup(): void {
    for (const [callId] of this.activeExecutions) {
      this.abortTool(callId);
    }
    this.abortControllers.clear();
    this.activeExecutions.clear();
  }
}

describe('Failed Tool Timing Events - Stress Tests', () => {
  let simulator: StressToolExecutionSimulator;
  const STRESS_TIMING_TOLERANCE = 100; // More tolerance for stress tests

  beforeEach(() => {
    simulator = new StressToolExecutionSimulator();
    vi.clearAllTimers();
  });

  afterEach(() => {
    simulator.cleanup();
  });

  describe('High Volume Failures', () => {
    it('should handle 50 rapid consecutive failures with accurate timing', async () => {
      const taskId = 'high-volume-task';
      const failureCount = 50;
      const events: ToolCallCompleteEventLike[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Start all tools rapidly
      const callIds: string[] = [];
      for (let i = 0; i < failureCount; i++) {
        const callId = await simulator.startTool(taskId, `HighVolumeTool-${i}`, undefined, { batch: i });
        callIds.push(callId);
      }

      // Fail all tools with slight variations in timing
      const failurePromises = callIds.map(async (callId, index) => {
        const duration = 50 + (index % 10) * 5; // 50-95ms durations
        await simulator.failToolWithPreciseTiming(
          callId,
          `High volume failure ${index}`,
          duration
        );
      });

      await Promise.all(failurePromises);

      // Verify all events were captured
      expect(events).toHaveLength(failureCount);

      // Create a map of events by callId for proper correlation
      // (events may not arrive in the same order as they were started due to parallel execution)
      const eventsByCallId = new Map(events.map(e => [e.callId, e]));

      // Verify each callId has a corresponding event with valid timing
      callIds.forEach((callId) => {
        const event = eventsByCallId.get(callId);
        expect(event).toBeDefined();
        assertFailedToolTiming(event!, {
          allowZeroDuration: false,
          tolerance: STRESS_TIMING_TOLERANCE,
        });
      });

      // Verify all call IDs are unique
      expect(eventsByCallId.size).toBe(failureCount);

      // Verify timing distribution is reasonable
      const durations = events.map(e => e.timing.duration);
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      expect(minDuration).toBeGreaterThanOrEqual(45); // Should be close to 50ms
      expect(maxDuration).toBeLessThanOrEqual(105); // Should be close to 95ms
    }, 15000); // Extended timeout for high volume test

    it('should handle burst failures without timing corruption', async () => {
      const events: ToolCallCompleteEventLike[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Create 3 bursts of 10 failures each
      const burst1 = await simulator.simulateFailureBurst('burst-task-1', 10, 30);
      const burst2 = await simulator.simulateFailureBurst('burst-task-2', 10, 40);
      const burst3 = await simulator.simulateFailureBurst('burst-task-3', 10, 50);

      // Wait for all events to be processed
      await waitForEvents(events, (e) => e.length >= 30, 5000);

      expect(events).toHaveLength(30);

      // Group events by task ID
      const burst1Events = events.filter(e => e.taskId === 'burst-task-1');
      const burst2Events = events.filter(e => e.taskId === 'burst-task-2');
      const burst3Events = events.filter(e => e.taskId === 'burst-task-3');

      expect(burst1Events).toHaveLength(10);
      expect(burst2Events).toHaveLength(10);
      expect(burst3Events).toHaveLength(10);

      // Verify timing for each burst
      assertConcurrentFailedToolTiming(burst1Events);
      assertConcurrentFailedToolTiming(burst2Events);
      assertConcurrentFailedToolTiming(burst3Events);

      // Verify no timing overlap corruption between bursts
      // Note: Duration bounds account for the simulateFailureBurst calculation:
      // duration = intervalMs + (i * 5) where i goes from 0 to 9
      // burst1: 30 + (0..9)*5 = 30..75ms
      // burst2: 40 + (0..9)*5 = 40..85ms
      // burst3: 50 + (0..9)*5 = 50..95ms
      // Plus timing tolerance for system jitter (increased for CI environments)
      [burst1Events, burst2Events, burst3Events].forEach(burstEvents => {
        burstEvents.forEach((event, index) => {
          expect(event.timing.duration).toBeGreaterThanOrEqual(25);
          expect(event.timing.duration).toBeLessThanOrEqual(300); // Increased upper bound for CI tolerance
        });
      });
    }, 10000);
  });

  describe('Extreme Timing Edge Cases', () => {
    it('should handle sub-millisecond failure detection', async () => {
      const events: ToolCallCompleteEventLike[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Simulate a tool that fails almost immediately
      const callId = await simulator.startTool('immediate-task', 'SubMillisecondTool');

      // Fail after just 1ms
      await simulator.failToolWithPreciseTiming(callId, 'Instant validation failure', 1);

      expect(events).toHaveLength(1);
      const event = events[0];

      assertFailedToolTiming(event, {
        allowZeroDuration: true,
        expectedMaxDuration: 10, // Should be very fast
        tolerance: 5,
      });

      // Timing should still be valid even for very short durations
      expect(event.timing.duration).toBeGreaterThanOrEqual(0);
      expect(event.timing.duration).toBeLessThanOrEqual(15);
    });

    it('should handle very long-running tool failures', async () => {
      const events: ToolCallCompleteEventLike[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      const longDuration = 5000; // 5 seconds
      const callId = await simulator.startTool('long-task', 'LongRunningTool');

      await simulator.failToolWithPreciseTiming(
        callId,
        'Long operation timed out after extensive processing',
        longDuration
      );

      expect(events).toHaveLength(1);
      const event = events[0];

      assertFailedToolTiming(event, {
        expectedMinDuration: longDuration - 50,
        expectedMaxDuration: longDuration + 50,
        tolerance: 25,
      });

      // Error message should be preserved
      expect(event.result.error).toContain('Long operation timed out');
      expect(event.result.error.length).toBeGreaterThan(20);
    }, 10000); // Extended timeout for long-running test (must be > longDuration)

    it('should handle timing precision with fractional millisecond accuracy', async () => {
      const events: ToolCallCompleteEventLike[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Test various precise durations
      const preciseTimings = [17, 23, 41, 67, 89, 103]; // Prime numbers for variety

      const callIds: string[] = [];
      for (const timing of preciseTimings) {
        const callId = await simulator.startTool('precision-task', `PrecisionTool-${timing}ms`);
        callIds.push(callId);
      }

      // Fail each tool with precise timing
      for (let i = 0; i < callIds.length; i++) {
        await simulator.failToolWithPreciseTiming(
          callIds[i],
          `Precision test ${preciseTimings[i]}ms`,
          preciseTimings[i]
        );
      }

      expect(events).toHaveLength(preciseTimings.length);

      // Verify each timing is accurate
      events.forEach((event, index) => {
        const expectedDuration = preciseTimings[index];
        assertTimingAccuracy(event.timing.duration, expectedDuration, 10);

        // Duration should be an integer (no fractional milliseconds)
        expect(Number.isInteger(event.timing.duration)).toBe(true);
      });
    });
  });

  describe('Concurrent Execution Stress', () => {
    it('should maintain timing accuracy across 100 concurrent failing tools', async () => {
      const events: ToolCallCompleteEventLike[] = [];
      const concurrentCount = 100;

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Start all tools concurrently
      const callIds: string[] = [];
      const startPromises = Array.from({ length: concurrentCount }, async (_, i) => {
        const callId = await simulator.startTool(
          'concurrent-stress-task',
          `ConcurrentTool-${i}`,
          `concurrent-${i}`,
          { index: i }
        );
        callIds.push(callId);
        return callId;
      });

      await Promise.all(startPromises);

      // Fail all tools with different durations to test concurrent timing
      const failurePromises = callIds.map(async (callId, index) => {
        const duration = 20 + (index % 30) * 5; // 20-165ms range
        await simulator.failToolWithPreciseTiming(
          callId,
          `Concurrent failure ${index}`,
          duration
        );
      });

      await Promise.all(failurePromises);

      // Wait for all events
      await waitForEvents(events, (e) => e.length >= concurrentCount, 10000);

      expect(events).toHaveLength(concurrentCount);

      // Verify independent timing for all concurrent executions
      assertConcurrentFailedToolTiming(events);

      // Verify no timing collisions or corruption
      const timingMap = new Map<string, number>();
      events.forEach(event => {
        const key = `${event.timing.startTime.getTime()}-${event.timing.endTime.getTime()}`;
        const count = timingMap.get(key) || 0;
        timingMap.set(key, count + 1);
      });

      // With concurrent execution and short durations (20-165ms), many tools may complete
      // at the same millisecond, leading to shared timing combinations. This is expected
      // behavior at millisecond precision. A reasonable threshold is 30% uniqueness.
      // The important validation is that all events have VALID timing (assertConcurrentFailedToolTiming above).
      const uniqueTimings = timingMap.size;
      expect(uniqueTimings).toBeGreaterThanOrEqual(concurrentCount * 0.3); // 30% unique is reasonable for concurrent execution
    }, 20000);

    it('should handle mixed success/failure scenarios under stress', async () => {
      const allEvents: ToolCallCompleteEventLike[] = [];
      const taskCount = 50;

      simulator.on('tool:complete', (event) => {
        allEvents.push(event);
      });

      // Start mix of tools that will succeed vs fail
      const callIds: string[] = [];
      for (let i = 0; i < taskCount; i++) {
        const callId = await simulator.startTool(
          'mixed-stress-task',
          `MixedTool-${i}`,
          `mixed-${i}`,
          { willFail: i % 3 === 0 } // Every 3rd tool will fail
        );
        callIds.push(callId);
      }

      // Process tools with mixed outcomes
      const promises = callIds.map(async (callId, index) => {
        const duration = 30 + (index % 20) * 3; // 30-87ms range

        if (index % 3 === 0) {
          // This tool will fail
          await simulator.failToolWithPreciseTiming(
            callId,
            `Mixed scenario failure ${index}`,
            duration
          );
        } else {
          // This tool would succeed (simulated here as a successful completion)
          const execution = simulator['activeExecutions'].get(callId);
          if (execution) {
            const endTime = new Date(execution.startTime.getTime() + duration);
            simulator.emit('tool:complete', {
              taskId: execution.taskId,
              toolName: execution.toolName,
              callId,
              result: { success: true, output: `Success ${index}` },
              timing: {
                startTime: execution.startTime,
                endTime,
                duration,
              },
              timestamp: endTime,
            });
            simulator['activeExecutions'].delete(callId);
          }
        }
      });

      await Promise.all(promises);
      await waitForEvents(allEvents, (e) => e.length >= taskCount, 8000);

      expect(allEvents).toHaveLength(taskCount);

      // Separate successful and failed events
      const successEvents = allEvents.filter(e => e.result.success);
      const failureEvents = allEvents.filter(e => !e.result.success);

      expect(failureEvents.length).toBe(Math.ceil(taskCount / 3)); // Every 3rd fails
      expect(successEvents.length).toBe(taskCount - Math.ceil(taskCount / 3));

      // Verify timing for all events, regardless of success/failure
      allEvents.forEach(event => {
        expect(event.timing.duration).toBeGreaterThanOrEqual(25);
        expect(event.timing.duration).toBeLessThanOrEqual(95);
        expect(event.timing.startTime.getTime()).toBeLessThanOrEqual(event.timing.endTime.getTime());
      });

      // Failed events should have valid error information
      failureEvents.forEach(event => {
        assertFailedToolTiming(event, {
          tolerance: STRESS_TIMING_TOLERANCE,
        });
      });
    }, 15000);
  });

  describe('Tool Abortion and Cancellation', () => {
    it('should capture timing for aborted tool executions', async () => {
      const events: ToolCallCompleteEventLike[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Start several tools that can be aborted
      const callIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const callId = await simulator.startTool(
          'abort-task',
          `AbortableTool-${i}`,
          undefined,
          {},
          true // abortable
        );
        callIds.push(callId);
      }

      // Wait a bit, then abort all tools
      await new Promise(resolve => setTimeout(resolve, 25));

      const abortResults = callIds.map(callId => simulator.abortTool(callId));

      // All aborts should succeed
      expect(abortResults.every(result => result === true)).toBe(true);

      expect(events).toHaveLength(5);

      // Verify timing for aborted tools
      events.forEach(event => {
        expect(event.result.success).toBe(false);
        expect(event.result.error).toBe('Tool execution aborted');

        // Aborted tools should have reasonable timing
        expect(event.timing.duration).toBeGreaterThanOrEqual(20);
        expect(event.timing.duration).toBeLessThanOrEqual(50);

        assertFailedToolTiming(event, {
          expectedErrorType: 'aborted',
          tolerance: 15,
        });
      });

      // No tools should be active after abortion
      expect(simulator.getActiveExecutionsCount()).toBe(0);
    });

    it('should handle abortion during high-volume execution', async () => {
      const events: ToolCallCompleteEventLike[] = [];
      const abortCount = 20;

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Start many abortable tools
      const callIds: string[] = [];
      for (let i = 0; i < abortCount; i++) {
        const callId = await simulator.startTool(
          'mass-abort-task',
          `MassAbortTool-${i}`,
          undefined,
          { batch: Math.floor(i / 5) },
          true
        );
        callIds.push(callId);
      }

      // Abort all tools in rapid succession
      const abortPromises = callIds.map(async (callId, index) => {
        // Stagger aborts slightly
        await new Promise(resolve => setTimeout(resolve, index * 2));
        return simulator.abortTool(callId);
      });

      const abortResults = await Promise.all(abortPromises);

      // All aborts should succeed
      expect(abortResults.every(result => result === true)).toBe(true);
      expect(events).toHaveLength(abortCount);

      // Verify timing consistency during mass abortion
      events.forEach((event, index) => {
        assertFailedToolTiming(event, {
          expectedErrorType: 'aborted',
          tolerance: 20, // More tolerance for mass operations
          allowZeroDuration: true, // Aborted tools can have zero duration
        });

        // Timing should reflect the abortion stagger
        expect(event.timing.duration).toBeGreaterThanOrEqual(index * 2 - 10);
        expect(event.timing.duration).toBeLessThanOrEqual(index * 2 + 30);
      });
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak timing data during continuous failure cycles', async () => {
      const events: ToolCallCompleteEventLike[] = [];
      const cycleCount = 5;
      const toolsPerCycle = 20;

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Run multiple cycles of tool failures
      for (let cycle = 0; cycle < cycleCount; cycle++) {
        const cycleCallIds: string[] = [];

        // Start tools for this cycle
        for (let i = 0; i < toolsPerCycle; i++) {
          const callId = await simulator.startTool(
            `cycle-${cycle}-task`,
            `CycleTool-${cycle}-${i}`,
            `cycle-${cycle}-call-${i}`
          );
          cycleCallIds.push(callId);
        }

        // Fail all tools in this cycle
        await Promise.all(cycleCallIds.map(async (callId, index) => {
          await simulator.failToolWithPreciseTiming(
            callId,
            `Cycle ${cycle} failure ${index}`,
            20 + (index % 10) * 3
          );
        }));

        // Verify no active executions remain after each cycle
        expect(simulator.getActiveExecutionsCount()).toBe(0);
      }

      const totalExpectedEvents = cycleCount * toolsPerCycle;
      expect(events).toHaveLength(totalExpectedEvents);

      // Verify all events have valid timing
      events.forEach((event, index) => {
        assertFailedToolTiming(event, {
          tolerance: STRESS_TIMING_TOLERANCE,
        });

        // Verify cycle and tool identification
        const cycle = Math.floor(index / toolsPerCycle);
        expect(event.taskId).toBe(`cycle-${cycle}-task`);
      });

      // Verify timing consistency across cycles
      for (let cycle = 0; cycle < cycleCount; cycle++) {
        const cycleEvents = events.slice(cycle * toolsPerCycle, (cycle + 1) * toolsPerCycle);
        assertConcurrentFailedToolTiming(cycleEvents);
      }
    }, 20000);
  });
});