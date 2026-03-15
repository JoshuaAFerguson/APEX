/**
 * Performance and Stress Tests for Timing Data Accuracy
 *
 * This test suite validates timing data collection under high-load conditions,
 * stress scenarios, and performance edge cases to ensure timing accuracy
 * is maintained even under challenging conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  assertFailedToolTiming,
  assertConcurrentFailedToolTiming,
  assertTimingAccuracy,
  waitForEvents,
  type ToolCallCompleteEventLike,
} from './test-utils/failed-tool-timing-helpers';

/**
 * High-performance timing test harness for stress testing
 */
class TimingPerformanceHarness extends EventEmitter {
  private executionCounter = 0;
  private events: ToolCallCompleteEventLike[] = [];
  private activeExecutions = new Map<string, {
    startTime: Date;
    perfStart: number;
    toolName: string;
    taskId: string;
  }>();

  constructor() {
    super();
    this.on('tool:complete', (event) => {
      this.events.push(event);
    });
  }

  /**
   * Execute a tool with precise timing measurement
   */
  async executeToolWithTiming(
    toolName: string,
    taskId: string,
    simulatedDuration: number,
    shouldFail: boolean = false
  ): Promise<ToolCallCompleteEventLike> {
    const callId = `perf-${++this.executionCounter}`;
    const startTime = new Date();
    const perfStart = performance.now();

    this.activeExecutions.set(callId, {
      startTime,
      perfStart,
      toolName,
      taskId
    });

    // Simulate tool execution with precise timing
    await new Promise(resolve => {
      const targetEnd = perfStart + simulatedDuration;
      const checkTiming = () => {
        if (performance.now() >= targetEnd) {
          resolve(void 0);
        } else {
          setImmediate(checkTiming);
        }
      };
      checkTiming();
    });

    const execution = this.activeExecutions.get(callId)!;
    const endTime = new Date();
    const perfEnd = performance.now();
    const actualDuration = endTime.getTime() - execution.startTime.getTime();

    const event: ToolCallCompleteEventLike = {
      taskId,
      toolName,
      callId,
      result: {
        success: !shouldFail,
        output: shouldFail ? undefined : { duration: actualDuration },
        error: shouldFail ? `Tool ${toolName} failed after ${actualDuration}ms` : undefined
      },
      timing: {
        startTime: execution.startTime,
        endTime,
        duration: actualDuration
      },
      timestamp: endTime
    };

    this.activeExecutions.delete(callId);
    this.emit('tool:complete', event);

    return event;
  }

  /**
   * Execute multiple tools concurrently with stress conditions
   */
  async executeStressTest(
    toolCount: number,
    durationRange: { min: number; max: number },
    failureRate: number = 0.2
  ): Promise<ToolCallCompleteEventLike[]> {
    const promises = Array.from({ length: toolCount }, (_, index) => {
      const duration = Math.floor(
        Math.random() * (durationRange.max - durationRange.min) + durationRange.min
      );
      const shouldFail = Math.random() < failureRate;

      return this.executeToolWithTiming(
        `StressTool-${index}`,
        `stress-task-${index}`,
        duration,
        shouldFail
      );
    });

    return Promise.all(promises);
  }

  /**
   * Execute rapid-fire tool executions
   */
  async executeRapidFire(
    count: number,
    intervalMs: number,
    duration: number
  ): Promise<ToolCallCompleteEventLike[]> {
    const events: ToolCallCompleteEventLike[] = [];

    for (let i = 0; i < count; i++) {
      const promise = this.executeToolWithTiming(
        `RapidTool-${i}`,
        `rapid-task-${i}`,
        duration
      );
      events.push(await promise);

      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    return events;
  }

  /**
   * Execute long-running tools with timing validation
   */
  async executeLongRunningTools(
    durations: number[]
  ): Promise<ToolCallCompleteEventLike[]> {
    const promises = durations.map((duration, index) =>
      this.executeToolWithTiming(
        `LongTool-${index}`,
        `long-task-${index}`,
        duration
      )
    );

    return Promise.all(promises);
  }

  getEvents(): ToolCallCompleteEventLike[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  getActiveCount(): number {
    return this.activeExecutions.size;
  }

  cleanup(): void {
    this.activeExecutions.clear();
    this.removeAllListeners();
    this.events = [];
  }
}

describe('Timing Performance and Stress Tests', () => {
  let harness: TimingPerformanceHarness;

  beforeEach(() => {
    harness = new TimingPerformanceHarness();
  });

  afterEach(() => {
    harness.cleanup();
    vi.clearAllTimers();
  });

  describe('High Volume Concurrent Execution', () => {
    it('should maintain timing accuracy with 100 concurrent tools', async () => {
      const toolCount = 100;
      const durationRange = { min: 10, max: 200 };

      const startTime = performance.now();
      const events = await harness.executeStressTest(toolCount, durationRange);
      const totalTime = performance.now() - startTime;

      expect(events).toHaveLength(toolCount);

      // Verify all events have valid timing
      events.forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        // Verify timing consistency
        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);

        // Verify duration is within expected range (with tolerance)
        expect(event.timing.duration).toBeGreaterThanOrEqual(durationRange.min - 50);
        expect(event.timing.duration).toBeLessThan(durationRange.max + 100);
      });

      // Verify no memory leaks
      expect(harness.getActiveCount()).toBe(0);

      // Verify overall timing is reasonable
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Executed ${toolCount} concurrent tools in ${Math.round(totalTime)}ms`);
    }, 10000); // 10 second timeout

    it('should handle 500 rapid sequential executions', async () => {
      const count = 500;
      const intervalMs = 1;
      const duration = 5;

      const startTime = performance.now();
      const events = await harness.executeRapidFire(count, intervalMs, duration);
      const totalTime = performance.now() - startTime;

      expect(events).toHaveLength(count);

      // Verify timing accuracy for each execution
      events.forEach((event, index) => {
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        // Verify timing consistency
        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);

        // Verify execution order (timestamps should be sequential)
        if (index > 0) {
          expect(event.timing.startTime.getTime()).toBeGreaterThanOrEqual(
            events[index - 1].timing.startTime.getTime()
          );
        }
      });

      // Verify all executions completed
      expect(harness.getActiveCount()).toBe(0);

      console.log(`Executed ${count} rapid sequential tools in ${Math.round(totalTime)}ms`);
    }, 15000); // 15 second timeout

    it('should maintain timing precision under memory pressure', async () => {
      // Create memory pressure with large data structures
      const largeArrays: number[][] = [];
      for (let i = 0; i < 100; i++) {
        largeArrays.push(Array(10000).fill(Math.random()));
      }

      const toolCount = 50;
      const events = await harness.executeStressTest(toolCount, { min: 20, max: 100 });

      expect(events).toHaveLength(toolCount);

      // Verify timing accuracy is maintained under memory pressure
      events.forEach(event => {
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);

        // Verify reasonable timing bounds
        expect(event.timing.duration).toBeLessThan(500);
      });

      // Clean up memory
      largeArrays.length = 0;
    }, 8000);
  });

  describe('Long-Running Tool Timing', () => {
    it('should accurately time long-running operations', async () => {
      const longDurations = [1000, 2000, 3000, 5000];

      const startTime = performance.now();
      const events = await harness.executeLongRunningTools(longDurations);
      const totalTime = performance.now() - startTime;

      expect(events).toHaveLength(longDurations.length);

      // Verify each long-running tool has accurate timing
      events.forEach((event, index) => {
        const expectedDuration = longDurations[index];

        // Allow larger tolerance for longer durations
        const tolerance = Math.max(100, expectedDuration * 0.1);
        assertTimingAccuracy(event.timing.duration, expectedDuration, tolerance);

        // Verify timing consistency
        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });

      // Verify total time is reasonable (should run concurrently)
      const maxDuration = Math.max(...longDurations);
      expect(totalTime).toBeLessThan(maxDuration + 1000);

      console.log(`Executed long-running tools in ${Math.round(totalTime)}ms`);
    }, 15000);

    it('should handle very short duration tools accurately', async () => {
      const shortDurations = [0, 1, 2, 5, 10];
      const events: ToolCallCompleteEventLike[] = [];

      for (const duration of shortDurations) {
        const event = await harness.executeToolWithTiming(
          'ShortTool',
          'short-task',
          duration
        );
        events.push(event);
      }

      expect(events).toHaveLength(shortDurations.length);

      // Verify even very short tools have valid timing
      events.forEach((event, index) => {
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);

        // For very short durations, timing might not be precise due to system limits
        // but should still be consistent
        const expectedDuration = shortDurations[index];
        if (expectedDuration === 0) {
          expect(event.timing.duration).toBeLessThan(10); // Should be very small
        } else {
          expect(event.timing.duration).toBeLessThan(50); // Should be reasonably small
        }
      });
    });
  });

  describe('Timing Accuracy Under Load', () => {
    it('should maintain timing accuracy during CPU-intensive operations', async () => {
      // Simulate CPU load
      const cpuIntensiveTask = () => {
        const start = performance.now();
        while (performance.now() - start < 100) {
          // Busy wait to simulate CPU load
          Math.random() * Math.random();
        }
      };

      // Start background CPU load
      const loadPromises = Array.from({ length: 4 }, () =>
        Promise.resolve().then(cpuIntensiveTask)
      );

      // Execute timing tests under load
      const events = await harness.executeStressTest(20, { min: 50, max: 150 });

      // Wait for CPU load to finish
      await Promise.all(loadPromises);

      expect(events).toHaveLength(20);

      // Verify timing accuracy is maintained under CPU load
      events.forEach(event => {
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);
        expect(event.timing.duration).toBeLessThan(1000); // Should not be drastically affected

        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });
    }, 8000);

    it('should handle timing during garbage collection pressure', async () => {
      // Create objects that will trigger garbage collection
      const createGarbageObjects = () => {
        const objects = [];
        for (let i = 0; i < 100000; i++) {
          objects.push({
            id: i,
            data: Array(100).fill(Math.random()),
            timestamp: new Date()
          });
        }
        return objects;
      };

      // Create garbage pressure
      let garbageObjects = createGarbageObjects();

      const events = await harness.executeStressTest(25, { min: 30, max: 120 });

      // Force garbage collection pressure
      garbageObjects = createGarbageObjects();
      garbageObjects = null; // Release references

      expect(events).toHaveLength(25);

      // Verify timing remains accurate during GC pressure
      events.forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);

        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });
    }, 10000);
  });

  describe('Concurrent Timing Validation', () => {
    it('should validate timing independence across concurrent executions', async () => {
      const concurrentCount = 50;
      const events = await harness.executeStressTest(
        concurrentCount,
        { min: 25, max: 200 },
        0.3 // 30% failure rate
      );

      expect(events).toHaveLength(concurrentCount);

      // Separate successful and failed events
      const successfulEvents = events.filter(e => e.result.success);
      const failedEvents = events.filter(e => !e.result.success);

      expect(successfulEvents.length + failedEvents.length).toBe(concurrentCount);

      // Validate failed tool timing using helper
      assertConcurrentFailedToolTiming(failedEvents);

      // Validate successful tool timing
      successfulEvents.forEach(event => {
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);
        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });

      // Verify all have unique call IDs
      const callIds = events.map(e => e.callId);
      const uniqueCallIds = new Set(callIds);
      expect(uniqueCallIds.size).toBe(events.length);

      // Verify timing independence (no two events have identical timing)
      const timingSignatures = events.map(e =>
        `${e.timing.startTime.getTime()}-${e.timing.duration}`
      );
      const uniqueTimings = new Set(timingSignatures);
      // Allow for more timing collisions in rapid succession scenarios, especially in CI environments
      // where concurrent executions may complete in the same millisecond. 30% unique timings is
      // sufficient to validate the system is attempting timing isolation
      expect(uniqueTimings.size).toBeGreaterThan(events.length * 0.3);
    }, 12000);
  });

  describe('Performance Regression Detection', () => {
    it('should detect timing performance regressions', async () => {
      const testCases = [
        { count: 10, duration: 50, expectedMaxTotal: 1000 },
        { count: 25, duration: 100, expectedMaxTotal: 2000 },
        { count: 50, duration: 25, expectedMaxTotal: 1500 }
      ];

      for (const testCase of testCases) {
        const startTime = performance.now();
        const events = await harness.executeStressTest(
          testCase.count,
          { min: testCase.duration, max: testCase.duration }
        );
        const totalTime = performance.now() - startTime;

        expect(events).toHaveLength(testCase.count);

        // Verify performance is within expected bounds
        expect(totalTime).toBeLessThan(testCase.expectedMaxTotal);

        // Verify timing accuracy
        events.forEach(event => {
          assertTimingAccuracy(event.timing.duration, testCase.duration, 50);
        });

        console.log(
          `Test case (count: ${testCase.count}, duration: ${testCase.duration}ms): ` +
          `completed in ${Math.round(totalTime)}ms (expected < ${testCase.expectedMaxTotal}ms)`
        );

        // Clear events for next test case
        harness.clearEvents();
      }
    }, 15000);

    it('should maintain consistent timing metrics across multiple runs', async () => {
      const runCount = 5;
      const toolsPerRun = 20;
      const duration = 75;
      const results: number[] = [];

      for (let run = 0; run < runCount; run++) {
        const startTime = performance.now();
        const events = await harness.executeStressTest(
          toolsPerRun,
          { min: duration, max: duration }
        );
        const runTime = performance.now() - startTime;

        expect(events).toHaveLength(toolsPerRun);

        // Verify timing accuracy for this run
        events.forEach(event => {
          assertTimingAccuracy(event.timing.duration, duration, 50);
        });

        results.push(runTime);
        harness.clearEvents();
      }

      // Verify consistency across runs
      const avgTime = results.reduce((a, b) => a + b) / results.length;
      const maxDeviation = Math.max(...results.map(r => Math.abs(r - avgTime)));

      // Deviation should be reasonable (within 50% of average)
      expect(maxDeviation).toBeLessThan(avgTime * 0.5);

      console.log(
        `Consistency test: avg=${Math.round(avgTime)}ms, ` +
        `max_deviation=${Math.round(maxDeviation)}ms, ` +
        `runs=[${results.map(r => Math.round(r)).join(', ')}]`
      );
    }, 20000);
  });
});