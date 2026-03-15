import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Instant Tool Execution Timing Tests
 *
 * Specialized tests for tools that execute nearly instantaneously,
 * ensuring timing consistency is maintained even for sub-millisecond executions.
 *
 * Focus Areas:
 * - Sub-millisecond execution timing accuracy
 * - Immediate tool completion scenarios
 * - Timing consistency for cached/mocked tools
 * - High-frequency tool execution patterns
 * - Zero-delay execution edge cases
 */

interface InstantToolEvent {
  eventType: 'start' | 'instant_complete';
  taskId: string;
  toolName: string;
  callId: string;
  timestamp: Date;
  precisionTimestamp: number;
  executionTimeNs?: number; // Nanosecond precision for instant tools
}

/**
 * High-precision orchestrator for instant tool execution
 */
class InstantToolOrchestrator extends EventEmitter {
  private instantExecutions = new Map<string, {
    startTime: Date;
    startPrecisionTime: number;
    completed: boolean;
  }>();

  private executionHistory: InstantToolEvent[] = [];

  /**
   * Execute tool with instant completion (0ms delay)
   */
  async executeInstantTool(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    options: {
      shouldFail?: boolean;
      useSetImmediate?: boolean;
      useNextTick?: boolean;
    } = {}
  ): Promise<void> {
    const startTime = new Date();
    const startPrecisionTime = performance.now();
    const startNanoTime = process.hrtime.bigint();

    // Record start
    this.instantExecutions.set(callId, {
      startTime,
      startPrecisionTime,
      completed: false,
    });

    const startEvent: InstantToolEvent = {
      eventType: 'start',
      taskId,
      toolName,
      callId,
      timestamp: startTime,
      precisionTimestamp: startPrecisionTime,
    };

    this.executionHistory.push(startEvent);
    this.emit('tool:start', {
      taskId,
      toolName,
      callId,
      input,
      startTime,
      timestamp: startTime,
    });

    // Determine completion method
    if (options.useNextTick) {
      return new Promise((resolve) => {
        process.nextTick(() => {
          this.completeInstantExecution(taskId, toolName, callId, startNanoTime, options.shouldFail);
          resolve();
        });
      });
    } else if (options.useSetImmediate) {
      return new Promise((resolve) => {
        setImmediate(() => {
          this.completeInstantExecution(taskId, toolName, callId, startNanoTime, options.shouldFail);
          resolve();
        });
      });
    } else {
      // Synchronous completion (truly instant)
      this.completeInstantExecution(taskId, toolName, callId, startNanoTime, options.shouldFail);
      return Promise.resolve();
    }
  }

  private completeInstantExecution(
    taskId: string,
    toolName: string,
    callId: string,
    startNanoTime: bigint,
    shouldFail: boolean = false
  ): void {
    const endTime = new Date();
    const endPrecisionTime = performance.now();
    const endNanoTime = process.hrtime.bigint();
    const executionTimeNs = Number(endNanoTime - startNanoTime);

    const execution = this.instantExecutions.get(callId);
    if (!execution) return;

    execution.completed = true;

    const duration = endTime.getTime() - execution.startTime.getTime();

    const completeEvent: InstantToolEvent = {
      eventType: 'instant_complete',
      taskId,
      toolName,
      callId,
      timestamp: endTime,
      precisionTimestamp: endPrecisionTime,
      executionTimeNs,
    };

    this.executionHistory.push(completeEvent);

    // Emit completion event
    this.emit('tool:complete', {
      taskId,
      toolName,
      callId,
      result: {
        success: !shouldFail,
        output: shouldFail ? undefined : {
          result: 'instant_completion',
          executionTimeNs,
          precisionDuration: endPrecisionTime - execution.startPrecisionTime,
        },
        error: shouldFail ? 'Instant tool execution failed' : undefined,
      },
      timing: {
        startTime: execution.startTime,
        endTime,
        duration,
      },
      timestamp: endTime,
    });

    this.instantExecutions.delete(callId);
  }

  /**
   * Execute burst of instant tools
   */
  async executeInstantBurst(
    taskId: string,
    toolNames: string[],
    burstOptions: {
    interval?: 'immediate' | 'nextTick' | 'setImmediate';
    failureRate?: number; // 0-1, percentage of tools that should fail
    } = {}
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < toolNames.length; i++) {
      const toolName = toolNames[i];
      const callId = `burst-${i}-${toolName}`;
      const shouldFail = Math.random() < (burstOptions.failureRate || 0);

      const executionOptions = {
        shouldFail,
        useNextTick: burstOptions.interval === 'nextTick',
        useSetImmediate: burstOptions.interval === 'setImmediate',
      };

      promises.push(
        this.executeInstantTool(taskId, toolName, callId, { burstIndex: i }, executionOptions)
      );
    }

    await Promise.all(promises);
  }

  getExecutionHistory(): InstantToolEvent[] {
    return [...this.executionHistory];
  }

  getInstantExecutionStats(): {
    totalExecutions: number;
    completedExecutions: number;
    averageExecutionTimeNs: number;
    minExecutionTimeNs: number;
    maxExecutionTimeNs: number;
  } {
    const completeEvents = this.executionHistory.filter(e =>
      e.eventType === 'instant_complete' && e.executionTimeNs !== undefined
    );

    if (completeEvents.length === 0) {
      return {
        totalExecutions: this.executionHistory.length / 2, // start + complete pairs
        completedExecutions: 0,
        averageExecutionTimeNs: 0,
        minExecutionTimeNs: 0,
        maxExecutionTimeNs: 0,
      };
    }

    const executionTimes = completeEvents.map(e => e.executionTimeNs!);

    return {
      totalExecutions: this.executionHistory.length / 2,
      completedExecutions: completeEvents.length,
      averageExecutionTimeNs: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
      minExecutionTimeNs: Math.min(...executionTimes),
      maxExecutionTimeNs: Math.max(...executionTimes),
    };
  }

  clearHistory(): void {
    this.executionHistory = [];
    this.instantExecutions.clear();
  }

  close(): void {
    this.removeAllListeners();
    this.clearHistory();
  }
}

describe('Instant Tool Execution Timing Tests', () => {
  let orchestrator: InstantToolOrchestrator;

  beforeEach(() => {
    orchestrator = new InstantToolOrchestrator();
  });

  afterEach(() => {
    orchestrator.close();
  });

  // ============================================================================
  // Sub-Millisecond Execution Tests
  // ============================================================================

  describe('Sub-Millisecond Execution', () => {
    it('should maintain timing accuracy for truly instant executions', async () => {
      const taskId = 'instant-task';
      const events: Array<{
        type: 'start' | 'complete';
        timestamp: Date;
        callId: string;
        timing?: { startTime: Date; endTime: Date; duration: number };
      }> = [];

      orchestrator.on('tool:start', (event) => {
        events.push({
          type: 'start',
          timestamp: event.timestamp,
          callId: event.callId,
        });
      });

      orchestrator.on('tool:complete', (event) => {
        events.push({
          type: 'complete',
          timestamp: event.timestamp,
          callId: event.callId,
          timing: event.timing,
        });
      });

      // Execute truly instant tool (synchronous completion)
      await orchestrator.executeInstantTool(
        taskId,
        'InstantTool',
        'instant-call',
        { testType: 'synchronous' }
      );

      expect(events).toHaveLength(2);

      const startEvent = events[0];
      const completeEvent = events[1];

      expect(startEvent.type).toBe('start');
      expect(completeEvent.type).toBe('complete');

      // Even for instant execution, timing should be consistent
      if (completeEvent.timing) {
        expect(completeEvent.timing.endTime.getTime()).toBeGreaterThanOrEqual(
          completeEvent.timing.startTime.getTime()
        );

        // Duration should be minimal (0 or very small positive number)
        expect(completeEvent.timing.duration).toBeGreaterThanOrEqual(0);
        expect(completeEvent.timing.duration).toBeLessThan(5); // Less than 5ms for instant execution

        // Calculated duration should match recorded duration
        const calculatedDuration = completeEvent.timing.endTime.getTime() - completeEvent.timing.startTime.getTime();
        expect(completeEvent.timing.duration).toBe(calculatedDuration);
      }

      // Start and complete should be very close in time
      const eventTimeDiff = completeEvent.timestamp.getTime() - startEvent.timestamp.getTime();
      expect(eventTimeDiff).toBeLessThan(10); // Within 10ms
    });

    it('should handle instant execution with process.nextTick completion', async () => {
      const taskId = 'nexttick-task';
      let startTime: Date;
      let completeTime: Date;
      let timingData: { startTime: Date; endTime: Date; duration: number };

      orchestrator.on('tool:start', (event) => {
        startTime = event.timestamp;
      });

      orchestrator.on('tool:complete', (event) => {
        completeTime = event.timestamp;
        timingData = event.timing;
      });

      await orchestrator.executeInstantTool(
        taskId,
        'NextTickTool',
        'nexttick-call',
        { completionMethod: 'nextTick' },
        { useNextTick: true }
      );

      expect(startTime!).toBeDefined();
      expect(completeTime!).toBeDefined();
      expect(timingData!).toBeDefined();

      // NextTick should complete very quickly but not instantaneously
      expect(timingData!.duration).toBeGreaterThanOrEqual(0);
      expect(timingData!.duration).toBeLessThan(15); // Less than 15ms

      // Timing consistency
      expect(timingData!.endTime.getTime()).toBeGreaterThanOrEqual(timingData!.startTime.getTime());

      const calculatedDuration = timingData!.endTime.getTime() - timingData!.startTime.getTime();
      expect(timingData!.duration).toBe(calculatedDuration);
    });

    it('should handle instant execution with setImmediate completion', async () => {
      const taskId = 'immediate-task';
      let completionResult: any;

      orchestrator.on('tool:complete', (event) => {
        completionResult = event;
      });

      await orchestrator.executeInstantTool(
        taskId,
        'ImmediateTool',
        'immediate-call',
        { completionMethod: 'setImmediate' },
        { useSetImmediate: true }
      );

      expect(completionResult).toBeDefined();
      expect(completionResult.timing.duration).toBeGreaterThanOrEqual(0);
      expect(completionResult.timing.duration).toBeLessThan(20); // Less than 20ms

      // SetImmediate should have consistent timing
      const timing = completionResult.timing;
      expect(timing.endTime.getTime()).toBeGreaterThan(timing.startTime.getTime() - 1); // Allow minimal variance
    });
  });

  // ============================================================================
  // High-Frequency Execution Tests
  // ============================================================================

  describe('High-Frequency Execution', () => {
    it('should maintain timing consistency during rapid instant tool bursts', async () => {
      const taskId = 'burst-task';
      const burstSize = 100;
      const toolNames = Array.from({ length: burstSize }, (_, i) => `BurstTool${i}`);

      const capturedTimings: Array<{
        callId: string;
        duration: number;
        startTime: Date;
        endTime: Date;
        success: boolean;
      }> = [];

      orchestrator.on('tool:complete', (event) => {
        capturedTimings.push({
          callId: event.callId,
          duration: event.timing.duration,
          startTime: event.timing.startTime,
          endTime: event.timing.endTime,
          success: event.result.success,
        });
      });

      // Execute burst with immediate completion
      await orchestrator.executeInstantBurst(
        taskId,
        toolNames,
        { interval: 'immediate', failureRate: 0.1 } // 10% failure rate
      );

      expect(capturedTimings).toHaveLength(burstSize);

      // Validate each execution
      for (const timing of capturedTimings) {
        // Duration should be minimal for instant execution
        expect(timing.duration).toBeGreaterThanOrEqual(0);
        expect(timing.duration).toBeLessThan(10); // Less than 10ms

        // Timing consistency
        expect(timing.endTime.getTime()).toBeGreaterThanOrEqual(timing.startTime.getTime());

        const calculatedDuration = timing.endTime.getTime() - timing.startTime.getTime();
        expect(timing.duration).toBe(calculatedDuration);
      }

      // Verify execution statistics
      const stats = orchestrator.getInstantExecutionStats();
      expect(stats.totalExecutions).toBe(burstSize);
      expect(stats.completedExecutions).toBe(burstSize);
      expect(stats.averageExecutionTimeNs).toBeLessThan(10_000_000); // Less than 10ms in nanoseconds

      // Check success/failure distribution
      const successCount = capturedTimings.filter(t => t.success).length;
      const failureCount = capturedTimings.filter(t => !t.success).length;

      expect(successCount).toBeGreaterThan(burstSize * 0.85); // At least 85% success
      expect(failureCount).toBeGreaterThan(0); // Some failures expected
      expect(successCount + failureCount).toBe(burstSize);
    });

    it('should handle mixed instant execution methods in rapid succession', async () => {
      const taskId = 'mixed-instant-task';
      const methodCount = 50;

      const executionMethods: Array<{
        method: 'sync' | 'nextTick' | 'setImmediate';
        callId: string;
      }> = [];

      // Create mixed execution pattern
      for (let i = 0; i < methodCount; i++) {
        const methods = ['sync', 'nextTick', 'setImmediate'] as const;
        const method = methods[i % 3];
        executionMethods.push({ method, callId: `mixed-${i}-${method}` });
      }

      const timingResults: Array<{
        callId: string;
        method: string;
        duration: number;
        order: number;
      }> = [];

      let completionOrder = 0;

      orchestrator.on('tool:complete', (event) => {
        const methodMatch = event.callId.match(/-(\w+)$/);
        const method = methodMatch ? methodMatch[1] : 'unknown';

        timingResults.push({
          callId: event.callId,
          method,
          duration: event.timing.duration,
          order: completionOrder++,
        });
      });

      // Execute all methods rapidly
      const executionPromises = executionMethods.map(async (exec) => {
        const options = {
          useNextTick: exec.method === 'nextTick',
          useSetImmediate: exec.method === 'setImmediate',
        };

        return orchestrator.executeInstantTool(
          taskId,
          `MixedTool${exec.method}`,
          exec.callId,
          { executionMethod: exec.method },
          options
        );
      });

      await Promise.all(executionPromises);

      expect(timingResults).toHaveLength(methodCount);

      // Analyze timing patterns by method
      const syncResults = timingResults.filter(r => r.method === 'sync');
      const nextTickResults = timingResults.filter(r => r.method === 'nextTick');
      const setImmediateResults = timingResults.filter(r => r.method === 'setImmediate');

      // All methods should have executed
      expect(syncResults.length).toBeGreaterThan(0);
      expect(nextTickResults.length).toBeGreaterThan(0);
      expect(setImmediateResults.length).toBeGreaterThan(0);

      // Sync executions should typically have the smallest durations
      const avgSyncDuration = syncResults.reduce((sum, r) => sum + r.duration, 0) / syncResults.length;
      const avgNextTickDuration = nextTickResults.reduce((sum, r) => sum + r.duration, 0) / nextTickResults.length;

      // All should be very fast, but sync should typically be fastest
      expect(avgSyncDuration).toBeLessThan(5);
      expect(avgNextTickDuration).toBeLessThan(15);

      // Validate timing consistency across all methods
      for (const result of timingResults) {
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(result.duration).toBeLessThan(50); // All instant methods should be under 50ms
      }
    });
  });

  // ============================================================================
  // Edge Case Scenarios
  // ============================================================================

  describe('Edge Case Scenarios', () => {
    it('should handle zero-duration executions correctly', async () => {
      const taskId = 'zero-duration-task';
      const zeroExecutionCount = 20;

      const zeroDurations: number[] = [];
      const timingConsistency: Array<{
        startTime: Date;
        endTime: Date;
        duration: number;
        isConsistent: boolean;
      }> = [];

      orchestrator.on('tool:complete', (event) => {
        const timing = event.timing;
        const calculatedDuration = timing.endTime.getTime() - timing.startTime.getTime();
        const isConsistent = timing.duration === calculatedDuration;

        zeroDurations.push(timing.duration);
        timingConsistency.push({
          startTime: timing.startTime,
          endTime: timing.endTime,
          duration: timing.duration,
          isConsistent,
        });
      });

      // Execute multiple instant tools that might have zero duration
      const promises = Array.from({ length: zeroExecutionCount }, (_, i) => {
        return orchestrator.executeInstantTool(
          taskId,
          'ZeroDurationTool',
          `zero-${i}`,
          { testZeroDuration: true }
        );
      });

      await Promise.all(promises);

      expect(zeroDurations).toHaveLength(zeroExecutionCount);
      expect(timingConsistency).toHaveLength(zeroExecutionCount);

      // All durations should be zero or very minimal
      for (const duration of zeroDurations) {
        expect(duration).toBeGreaterThanOrEqual(0);
        expect(duration).toBeLessThan(2); // Less than 2ms for zero-duration tools
      }

      // All timing should be consistent
      const consistentCount = timingConsistency.filter(t => t.isConsistent).length;
      expect(consistentCount).toBe(zeroExecutionCount);

      // No negative durations should occur
      const negativeDurations = zeroDurations.filter(d => d < 0);
      expect(negativeDurations).toHaveLength(0);
    });

    it('should maintain timing consistency under extreme instant execution load', async () => {
      const taskId = 'extreme-load-task';
      const extremeLoadSize = 1000;

      const loadTestResults: Array<{
        batchIndex: number;
        executionsInBatch: number;
        averageDuration: number;
        timingViolations: number;
      }> = [];

      // Execute in batches to simulate extreme load
      const batchSize = 100;
      const batches = Math.ceil(extremeLoadSize / batchSize);

      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const batchDurations: number[] = [];
        let timingViolations = 0;

        orchestrator.on('tool:complete', (event) => {
          const timing = event.timing;
          const calculatedDuration = timing.endTime.getTime() - timing.startTime.getTime();

          batchDurations.push(timing.duration);

          // Check for timing violations
          if (timing.duration !== calculatedDuration ||
              timing.duration < 0 ||
              timing.endTime.getTime() < timing.startTime.getTime()) {
            timingViolations++;
          }
        });

        // Execute batch
        const batchPromises = Array.from({ length: batchSize }, (_, i) => {
          const globalIndex = batchIndex * batchSize + i;
          return orchestrator.executeInstantTool(
            taskId,
            `ExtremeLoadTool${globalIndex}`,
            `extreme-${globalIndex}`,
            { batchIndex, itemIndex: i }
          );
        });

        await Promise.all(batchPromises);

        const averageDuration = batchDurations.reduce((sum, d) => sum + d, 0) / batchDurations.length;

        loadTestResults.push({
          batchIndex,
          executionsInBatch: batchSize,
          averageDuration,
          timingViolations,
        });

        // Clear listeners for next batch
        orchestrator.removeAllListeners();
        orchestrator.clearHistory();
      }

      // Validate load test results
      expect(loadTestResults).toHaveLength(batches);

      let totalViolations = 0;
      let totalExecutions = 0;

      for (const result of loadTestResults) {
        expect(result.executionsInBatch).toBe(batchSize);
        expect(result.averageDuration).toBeGreaterThanOrEqual(0);
        expect(result.averageDuration).toBeLessThan(20); // Should remain fast under load

        totalViolations += result.timingViolations;
        totalExecutions += result.executionsInBatch;
      }

      // Timing violations should be minimal even under extreme load
      const violationRate = totalViolations / totalExecutions;
      expect(violationRate).toBeLessThan(0.01); // Less than 1% violation rate

      expect(totalExecutions).toBe(extremeLoadSize);
    });

    it('should handle instant tool failures with consistent timing', async () => {
      const taskId = 'instant-failure-task';
      const failureTestCount = 50;

      const failureTimings: Array<{
        callId: string;
        duration: number;
        success: boolean;
        error?: string;
      }> = [];

      orchestrator.on('tool:complete', (event) => {
        failureTimings.push({
          callId: event.callId,
          duration: event.timing.duration,
          success: event.result.success,
          error: event.result.error,
        });
      });

      // Execute instant tools with guaranteed failures
      const failurePromises = Array.from({ length: failureTestCount }, (_, i) => {
        return orchestrator.executeInstantTool(
          taskId,
          `FailureTool${i}`,
          `failure-${i}`,
          { shouldFail: true },
          { shouldFail: true }
        );
      });

      await Promise.all(failurePromises);

      expect(failureTimings).toHaveLength(failureTestCount);

      // Validate all failed as expected
      const failedExecutions = failureTimings.filter(t => !t.success);
      expect(failedExecutions).toHaveLength(failureTestCount);

      // Failed executions should still have consistent timing
      for (const failure of failedExecutions) {
        expect(failure.duration).toBeGreaterThanOrEqual(0);
        expect(failure.duration).toBeLessThan(5); // Instant failures should be very fast
        expect(failure.error).toBeDefined();
        expect(failure.error).toContain('failed');
      }

      // Average failure duration should be minimal
      const avgFailureDuration = failureTimings.reduce((sum, f) => sum + f.duration, 0) / failureTimings.length;
      expect(avgFailureDuration).toBeLessThan(3);
    });
  });
});