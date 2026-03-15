/**
 * 50ms Duration Timing Accuracy Test Suite
 *
 * Validates that tool executions with 50ms target duration maintain
 * accurate timing data across various execution conditions.
 *
 * Architecture Design:
 * - Uses the established InstantToolOrchestrator pattern
 * - Validates 50ms duration accuracy within defined tolerance
 * - Tests timing consistency across single, concurrent, and burst executions
 * - Ensures timing data integrity under standard and edge case conditions
 *
 * Timing Tolerance Strategy:
 * - Uses TIMING_TOLERANCE_MS (50ms) from shared utilities
 * - For 50ms executions, actual duration should be within ±50ms tolerance
 * - This accounts for system clock precision, Node.js event loop delays,
 *   and test execution environment variations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Standard timing tolerance from shared utilities
 * For 50ms tests, we use the project-standard tolerance value
 */
const TIMING_TOLERANCE_MS = 50;

/**
 * Target duration for all tests in this suite
 */
const TARGET_DURATION_MS = 50;

/**
 * Interface for timing event data
 */
interface TimingEventData {
  eventType: 'start' | 'complete';
  taskId: string;
  toolName: string;
  callId: string;
  timestamp: Date;
  timing?: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  result?: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
}

/**
 * Orchestrator for 50ms duration timing accuracy testing
 * Follows the established patterns from instant-tool-execution-timing.test.ts
 */
class DurationTimingOrchestrator extends EventEmitter {
  private activeExecutions = new Map<string, {
    startTime: Date;
    startPrecisionTime: number;
  }>();

  private executionHistory: TimingEventData[] = [];

  /**
   * Execute a tool with specified duration and capture timing data
   */
  async executeWithDuration(
    taskId: string,
    toolName: string,
    callId: string,
    durationMs: number,
    options: {
      shouldFail?: boolean;
    } = {}
  ): Promise<void> {
    const startTime = new Date();
    const startPrecisionTime = performance.now();

    // Record start
    this.activeExecutions.set(callId, {
      startTime,
      startPrecisionTime,
    });

    const startEvent: TimingEventData = {
      eventType: 'start',
      taskId,
      toolName,
      callId,
      timestamp: startTime,
    };

    this.executionHistory.push(startEvent);
    this.emit('tool:start', {
      taskId,
      toolName,
      callId,
      input: {},
      startTime,
      timestamp: startTime,
    });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const endTime = new Date();
        const endPrecisionTime = performance.now();

        const execution = this.activeExecutions.get(callId)!;
        const duration = endTime.getTime() - execution.startTime.getTime();
        const precisionDuration = endPrecisionTime - execution.startPrecisionTime;

        const completeEvent: TimingEventData = {
          eventType: 'complete',
          taskId,
          toolName,
          callId,
          timestamp: endTime,
          timing: {
            startTime: execution.startTime,
            endTime,
            duration,
          },
          result: {
            success: !options.shouldFail,
            output: options.shouldFail ? undefined : {
              precisionDuration,
              targetDuration: durationMs,
            },
            error: options.shouldFail ? 'Tool execution failed' : undefined,
          },
        };

        this.executionHistory.push(completeEvent);

        this.emit('tool:complete', {
          taskId,
          toolName,
          callId,
          result: completeEvent.result,
          timing: completeEvent.timing,
          timestamp: endTime,
        });

        this.activeExecutions.delete(callId);
        resolve();
      }, durationMs);
    });
  }

  private executionCounter = 0;

  /**
   * Execute multiple tools concurrently with specified duration
   */
  async executeConcurrent(
    taskId: string,
    count: number,
    durationMs: number,
    options: {
      failureRate?: number;
      batchId?: string;
    } = {}
  ): Promise<void> {
    const promises: Promise<void>[] = [];
    const batchPrefix = options.batchId || `batch-${Date.now()}`;

    for (let i = 0; i < count; i++) {
      const uniqueIndex = this.executionCounter++;
      const toolName = `ConcurrentTool${uniqueIndex}`;
      const callId = `${batchPrefix}-${uniqueIndex}`;
      const shouldFail = Math.random() < (options.failureRate || 0);

      promises.push(
        this.executeWithDuration(taskId, toolName, callId, durationMs, { shouldFail })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Get all completed execution timing data
   */
  getCompletedTimings(): Array<{
    callId: string;
    duration: number;
    startTime: Date;
    endTime: Date;
    success: boolean;
  }> {
    return this.executionHistory
      .filter(event => event.eventType === 'complete' && event.timing)
      .map(event => ({
        callId: event.callId,
        duration: event.timing!.duration,
        startTime: event.timing!.startTime,
        endTime: event.timing!.endTime,
        success: event.result?.success ?? true,
      }));
  }

  /**
   * Calculate timing accuracy statistics
   */
  getTimingAccuracyStats(targetDuration: number): {
    totalExecutions: number;
    withinTolerance: number;
    accuracyRate: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    averageDeviation: number;
  } {
    const timings = this.getCompletedTimings();

    if (timings.length === 0) {
      return {
        totalExecutions: 0,
        withinTolerance: 0,
        accuracyRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        averageDeviation: 0,
      };
    }

    const durations = timings.map(t => t.duration);
    const deviations = durations.map(d => Math.abs(d - targetDuration));

    const withinTolerance = deviations.filter(d => d <= TIMING_TOLERANCE_MS).length;

    return {
      totalExecutions: timings.length,
      withinTolerance,
      accuracyRate: withinTolerance / timings.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      averageDeviation: deviations.reduce((sum, d) => sum + d, 0) / deviations.length,
    };
  }

  getExecutionHistory(): TimingEventData[] {
    return [...this.executionHistory];
  }

  clearHistory(): void {
    this.executionHistory = [];
    this.activeExecutions.clear();
    this.executionCounter = 0;
  }

  close(): void {
    this.removeAllListeners();
    this.clearHistory();
  }
}

// =============================================================================
// Test Suite
// =============================================================================

describe('50ms Duration Timing Accuracy', () => {
  let orchestrator: DurationTimingOrchestrator;

  beforeEach(() => {
    orchestrator = new DurationTimingOrchestrator();
  });

  afterEach(() => {
    orchestrator.close();
  });

  // ===========================================================================
  // Single Execution Tests
  // ===========================================================================

  describe('Single Execution Timing', () => {
    it('should accurately measure 50ms duration for a single tool execution', async () => {
      const taskId = 'single-50ms-task';
      const events: Array<{
        type: 'start' | 'complete';
        timestamp: Date;
        timing?: { startTime: Date; endTime: Date; duration: number };
      }> = [];

      orchestrator.on('tool:start', (event) => {
        events.push({ type: 'start', timestamp: event.timestamp });
      });

      orchestrator.on('tool:complete', (event) => {
        events.push({
          type: 'complete',
          timestamp: event.timestamp,
          timing: event.timing,
        });
      });

      await orchestrator.executeWithDuration(
        taskId,
        'DurationTestTool',
        'duration-50ms-call',
        TARGET_DURATION_MS
      );

      expect(events).toHaveLength(2);

      const startEvent = events[0];
      const completeEvent = events[1];

      expect(startEvent.type).toBe('start');
      expect(completeEvent.type).toBe('complete');
      expect(completeEvent.timing).toBeDefined();

      const timing = completeEvent.timing!;

      // Duration should be at least the target (50ms)
      expect(timing.duration).toBeGreaterThanOrEqual(TARGET_DURATION_MS);

      // Duration should be within tolerance (50ms ± 50ms = 0-100ms)
      expect(timing.duration).toBeLessThanOrEqual(TARGET_DURATION_MS + TIMING_TOLERANCE_MS);

      // Timing consistency checks
      expect(timing.endTime.getTime()).toBeGreaterThanOrEqual(timing.startTime.getTime());

      const calculatedDuration = timing.endTime.getTime() - timing.startTime.getTime();
      expect(timing.duration).toBe(calculatedDuration);
    });

    it('should maintain timing consistency across multiple single executions', async () => {
      const taskId = 'repeated-50ms-task';
      const executionCount = 10;

      for (let i = 0; i < executionCount; i++) {
        await orchestrator.executeWithDuration(
          taskId,
          `RepeatTool${i}`,
          `repeat-50ms-${i}`,
          TARGET_DURATION_MS
        );
      }

      const stats = orchestrator.getTimingAccuracyStats(TARGET_DURATION_MS);

      expect(stats.totalExecutions).toBe(executionCount);

      // All executions should be within tolerance
      expect(stats.accuracyRate).toBeGreaterThanOrEqual(0.9); // 90% accuracy minimum

      // Average duration should be close to target
      expect(stats.averageDuration).toBeGreaterThanOrEqual(TARGET_DURATION_MS);
      expect(stats.averageDuration).toBeLessThanOrEqual(TARGET_DURATION_MS + TIMING_TOLERANCE_MS);

      // No execution should have negative or unreasonable duration
      expect(stats.minDuration).toBeGreaterThanOrEqual(0);
      expect(stats.maxDuration).toBeLessThan(TARGET_DURATION_MS + TIMING_TOLERANCE_MS * 2);
    });
  });

  // ===========================================================================
  // Concurrent Execution Tests
  // ===========================================================================

  describe('Concurrent Execution Timing', () => {
    it('should maintain 50ms timing accuracy during concurrent executions', async () => {
      const taskId = 'concurrent-50ms-task';
      const concurrentCount = 20;

      await orchestrator.executeConcurrent(
        taskId,
        concurrentCount,
        TARGET_DURATION_MS
      );

      const stats = orchestrator.getTimingAccuracyStats(TARGET_DURATION_MS);

      expect(stats.totalExecutions).toBe(concurrentCount);

      // At least 90% should be within tolerance even under concurrent load
      expect(stats.accuracyRate).toBeGreaterThanOrEqual(0.9);

      // Average deviation should be minimal
      expect(stats.averageDeviation).toBeLessThanOrEqual(TIMING_TOLERANCE_MS);

      // Validate individual timing consistency
      const timings = orchestrator.getCompletedTimings();
      for (const timing of timings) {
        expect(timing.duration).toBeGreaterThanOrEqual(0);
        expect(timing.endTime.getTime()).toBeGreaterThanOrEqual(timing.startTime.getTime());

        const calculatedDuration = timing.endTime.getTime() - timing.startTime.getTime();
        expect(timing.duration).toBe(calculatedDuration);
      }
    });

    it('should handle concurrent 50ms executions with some failures', async () => {
      const taskId = 'concurrent-failure-task';
      const concurrentCount = 30;
      const failureRate = 0.2; // 20% failure rate

      await orchestrator.executeConcurrent(
        taskId,
        concurrentCount,
        TARGET_DURATION_MS,
        { failureRate }
      );

      const timings = orchestrator.getCompletedTimings();
      const stats = orchestrator.getTimingAccuracyStats(TARGET_DURATION_MS);

      expect(timings).toHaveLength(concurrentCount);

      // Check success/failure distribution
      const successCount = timings.filter(t => t.success).length;
      const failureCount = timings.filter(t => !t.success).length;

      expect(successCount + failureCount).toBe(concurrentCount);

      // Both successful and failed executions should have consistent timing
      // Allow small negative tolerance for timer precision variance
      const TIMER_PRECISION_TOLERANCE = 2; // Allow 2ms variance below target
      for (const timing of timings) {
        expect(timing.duration).toBeGreaterThanOrEqual(TARGET_DURATION_MS - TIMER_PRECISION_TOLERANCE);
        expect(timing.duration).toBeLessThanOrEqual(TARGET_DURATION_MS + TIMING_TOLERANCE_MS * 2);
      }

      // Overall timing accuracy should still be high
      expect(stats.accuracyRate).toBeGreaterThanOrEqual(0.85);
    });
  });

  // ===========================================================================
  // Timing Data Integrity Tests
  // ===========================================================================

  describe('Timing Data Integrity', () => {
    it('should validate 50ms timing data consistency', async () => {
      const taskId = 'integrity-50ms-task';

      await orchestrator.executeWithDuration(
        taskId,
        'IntegrityTestTool',
        'integrity-call',
        TARGET_DURATION_MS
      );

      const timings = orchestrator.getCompletedTimings();
      expect(timings).toHaveLength(1);

      const timing = timings[0];

      // All timing fields must be present and valid
      expect(timing.callId).toBe('integrity-call');
      expect(timing.startTime).toBeInstanceOf(Date);
      expect(timing.endTime).toBeInstanceOf(Date);
      expect(typeof timing.duration).toBe('number');

      // Duration must be positive
      expect(timing.duration).toBeGreaterThan(0);

      // End time must be after start time
      expect(timing.endTime.getTime()).toBeGreaterThan(timing.startTime.getTime());

      // Duration must match calculated value
      const calculatedDuration = timing.endTime.getTime() - timing.startTime.getTime();
      expect(timing.duration).toBe(calculatedDuration);

      // Duration should be close to target
      const deviation = Math.abs(timing.duration - TARGET_DURATION_MS);
      expect(deviation).toBeLessThanOrEqual(TIMING_TOLERANCE_MS);
    });

    it('should preserve 50ms timing data through event emission', async () => {
      const taskId = 'emission-50ms-task';
      let capturedTiming: { startTime: Date; endTime: Date; duration: number } | undefined;

      orchestrator.on('tool:complete', (event) => {
        capturedTiming = event.timing;
      });

      await orchestrator.executeWithDuration(
        taskId,
        'EmissionTestTool',
        'emission-call',
        TARGET_DURATION_MS
      );

      expect(capturedTiming).toBeDefined();

      // Timing data should be complete
      expect(capturedTiming!.startTime).toBeInstanceOf(Date);
      expect(capturedTiming!.endTime).toBeInstanceOf(Date);
      expect(typeof capturedTiming!.duration).toBe('number');

      // Duration should be accurate (allowing for system timer precision variance)
      // Timer resolution on modern systems is typically ~1ms, so we allow ±1ms variance
      const TIMER_PRECISION_MS = 2;
      expect(capturedTiming!.duration).toBeGreaterThanOrEqual(TARGET_DURATION_MS - TIMER_PRECISION_MS);
      expect(capturedTiming!.duration).toBeLessThanOrEqual(TARGET_DURATION_MS + TIMING_TOLERANCE_MS);

      // Duration should still be within the project-standard tolerance
      const deviation = Math.abs(capturedTiming!.duration - TARGET_DURATION_MS);
      expect(deviation).toBeLessThanOrEqual(TIMING_TOLERANCE_MS);
    });
  });

  // ===========================================================================
  // Edge Case Tests
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle rapid succession of 50ms executions', async () => {
      const taskId = 'rapid-50ms-task';
      const rapidCount = 50;

      // Execute rapidly without waiting for completion
      const promises: Promise<void>[] = [];
      for (let i = 0; i < rapidCount; i++) {
        promises.push(
          orchestrator.executeWithDuration(
            taskId,
            `RapidTool${i}`,
            `rapid-${i}`,
            TARGET_DURATION_MS
          )
        );
      }

      await Promise.all(promises);

      const stats = orchestrator.getTimingAccuracyStats(TARGET_DURATION_MS);

      expect(stats.totalExecutions).toBe(rapidCount);

      // Under rapid load, at least 85% should still be accurate
      expect(stats.accuracyRate).toBeGreaterThanOrEqual(0.85);

      // No timing anomalies
      const timings = orchestrator.getCompletedTimings();
      for (const timing of timings) {
        expect(timing.duration).toBeGreaterThanOrEqual(0);
        expect(timing.endTime.getTime()).toBeGreaterThanOrEqual(timing.startTime.getTime());
      }
    });

    it('should maintain 50ms accuracy under mixed execution load', async () => {
      const taskId = 'mixed-load-task';

      // Execute different batch sizes concurrently
      const batch1 = orchestrator.executeConcurrent(taskId, 10, TARGET_DURATION_MS);
      const batch2 = orchestrator.executeConcurrent(taskId, 15, TARGET_DURATION_MS);
      const batch3 = orchestrator.executeConcurrent(taskId, 25, TARGET_DURATION_MS);

      await Promise.all([batch1, batch2, batch3]);

      const stats = orchestrator.getTimingAccuracyStats(TARGET_DURATION_MS);

      expect(stats.totalExecutions).toBe(50);

      // High accuracy even under mixed load
      expect(stats.accuracyRate).toBeGreaterThanOrEqual(0.85);

      // Average should be close to target
      expect(stats.averageDuration).toBeGreaterThanOrEqual(TARGET_DURATION_MS);
      expect(stats.averageDuration).toBeLessThanOrEqual(TARGET_DURATION_MS + TIMING_TOLERANCE_MS);
    });

    it('should correctly report 50ms timing for failed executions', async () => {
      const taskId = 'failure-50ms-task';

      await orchestrator.executeWithDuration(
        taskId,
        'FailingTool',
        'failure-call',
        TARGET_DURATION_MS,
        { shouldFail: true }
      );

      const timings = orchestrator.getCompletedTimings();
      expect(timings).toHaveLength(1);

      const timing = timings[0];

      // Failed execution should still have accurate timing
      expect(timing.success).toBe(false);
      expect(timing.duration).toBeGreaterThanOrEqual(TARGET_DURATION_MS);
      expect(timing.duration).toBeLessThanOrEqual(TARGET_DURATION_MS + TIMING_TOLERANCE_MS);

      // Timing consistency must be maintained for failures
      expect(timing.endTime.getTime()).toBeGreaterThanOrEqual(timing.startTime.getTime());
      const calculatedDuration = timing.endTime.getTime() - timing.startTime.getTime();
      expect(timing.duration).toBe(calculatedDuration);
    });
  });

  // ===========================================================================
  // Statistical Validation Tests
  // ===========================================================================

  describe('Statistical Validation', () => {
    it('should achieve high accuracy rate across large sample size', async () => {
      const taskId = 'statistical-50ms-task';
      const sampleSize = 100;

      await orchestrator.executeConcurrent(taskId, sampleSize, TARGET_DURATION_MS);

      const stats = orchestrator.getTimingAccuracyStats(TARGET_DURATION_MS);

      expect(stats.totalExecutions).toBe(sampleSize);

      // High statistical accuracy
      expect(stats.accuracyRate).toBeGreaterThanOrEqual(0.9);

      // Low average deviation
      expect(stats.averageDeviation).toBeLessThanOrEqual(TIMING_TOLERANCE_MS / 2);

      // Reasonable spread
      const spread = stats.maxDuration - stats.minDuration;
      expect(spread).toBeLessThanOrEqual(TIMING_TOLERANCE_MS * 2);

      console.log('50ms Duration Accuracy Statistics:', {
        sampleSize: stats.totalExecutions,
        accuracyRate: `${(stats.accuracyRate * 100).toFixed(1)}%`,
        averageDuration: `${stats.averageDuration.toFixed(2)}ms`,
        targetDuration: `${TARGET_DURATION_MS}ms`,
        averageDeviation: `${stats.averageDeviation.toFixed(2)}ms`,
        minDuration: `${stats.minDuration}ms`,
        maxDuration: `${stats.maxDuration}ms`,
      });
    });
  });
});
