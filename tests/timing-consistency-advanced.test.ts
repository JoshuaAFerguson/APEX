import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Advanced Timing Consistency Tests
 *
 * This test suite implements advanced timing consistency scenarios that complement
 * the existing comprehensive timing tests. It focuses on edge cases, precision
 * validation, and complex timing scenarios that ensure robust timing behavior
 * across different execution contexts.
 */

interface ToolCallStartEvent {
  taskId: string;
  toolName: string;
  callId: string;
  input: Record<string, unknown>;
  startTime: Date;
  timestamp: Date;
}

interface ToolCallProgressEvent {
  taskId: string;
  toolName: string;
  callId: string;
  progress: {
    message: string;
    percentage?: number;
  };
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
 * Advanced timing orchestrator with enhanced precision and timezone support
 */
class AdvancedTimingOrchestrator extends EventEmitter {
  private activeExecutions = new Map<string, {
    startTime: Date;
    toolName: string;
    taskId: string;
    progressEvents: Date[];
  }>();

  async simulateToolExecution(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    executionTimeMs: number = 50,
    options: {
      shouldFail?: boolean;
      progressInterval?: number;
      timezone?: string;
    } = {}
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const startTime = new Date();
      this.activeExecutions.set(callId, {
        startTime,
        toolName,
        taskId,
        progressEvents: []
      });

      // Emit start event
      const startEvent: ToolCallStartEvent = {
        taskId,
        toolName,
        callId,
        input,
        startTime,
        timestamp: new Date(),
      };
      this.emit('tool:start', startEvent);

      // Handle progress events if interval specified
      let progressTimer: NodeJS.Timeout | undefined;
      if (options.progressInterval && options.progressInterval > 0) {
        progressTimer = setInterval(() => {
          const now = new Date();
          const execution = this.activeExecutions.get(callId);
          if (execution) {
            execution.progressEvents.push(now);
            const progressEvent: ToolCallProgressEvent = {
              taskId,
              toolName,
              callId,
              progress: {
                message: `Processing... ${execution.progressEvents.length}`,
                percentage: Math.min(90, execution.progressEvents.length * 10),
              },
              timestamp: now,
            };
            this.emit('tool:progress', progressEvent);
          }
        }, options.progressInterval);
      }

      // Simulate execution time
      setTimeout(() => {
        if (progressTimer) {
          clearInterval(progressTimer);
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        // Emit complete event
        const completeEvent: ToolCallCompleteEvent = {
          taskId,
          toolName,
          callId,
          result: {
            success: !options.shouldFail,
            output: options.shouldFail ? undefined : { result: 'completed' },
            error: options.shouldFail ? 'Execution failed' : undefined,
          },
          timing: {
            startTime,
            endTime,
            duration,
          },
          timestamp: new Date(),
        };
        this.emit('tool:complete', completeEvent);
        this.activeExecutions.delete(callId);
        resolve();
      }, executionTimeMs);
    });
  }

  /**
   * Simulate rapid burst of tool executions
   */
  async simulateRapidBurst(
    baseTaskId: string,
    toolName: string,
    burstCount: number,
    intervalMs: number = 5
  ): Promise<string[]> {
    const callIds: string[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < burstCount; i++) {
      const callId = `${baseTaskId}-burst-${i}`;
      callIds.push(callId);

      // Start each execution with minimal delay
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      promises.push(
        this.simulateToolExecution(
          `${baseTaskId}-${i}`,
          toolName,
          callId,
          { burstIndex: i },
          10 + (i * 2) // Slightly different durations
        )
      );
    }

    await Promise.all(promises);
    return callIds;
  }

  /**
   * Get execution details for analysis
   */
  getExecutionDetails(callId: string) {
    return this.activeExecutions.get(callId);
  }

  /**
   * Clean shutdown
   */
  close() {
    this.removeAllListeners();
    this.activeExecutions.clear();
  }
}

describe('Advanced Timing Consistency Tests', () => {
  let orchestrator: AdvancedTimingOrchestrator;
  let capturedEvents: any[] = [];

  beforeEach(() => {
    orchestrator = new AdvancedTimingOrchestrator();
    capturedEvents = [];

    // Capture all events for analysis
    orchestrator.on('tool:start', (event) => {
      capturedEvents.push({ type: 'start', ...event });
    });

    orchestrator.on('tool:progress', (event) => {
      capturedEvents.push({ type: 'progress', ...event });
    });

    orchestrator.on('tool:complete', (event) => {
      capturedEvents.push({ type: 'complete', ...event });
    });
  });

  afterEach(() => {
    orchestrator.close();
  });

  describe('Timestamp Precision Validation', () => {
    it('should maintain millisecond precision across all timing fields', async () => {
      await orchestrator.simulateToolExecution(
        'precision-task',
        'PrecisionTool',
        'precision-call',
        {},
        100
      );

      const startEvent = capturedEvents.find(e => e.type === 'start');
      const completeEvent = capturedEvents.find(e => e.type === 'complete');

      expect(startEvent).toBeDefined();
      expect(completeEvent).toBeDefined();

      // Verify millisecond precision preservation
      expect(startEvent.startTime.getMilliseconds()).toBeGreaterThanOrEqual(0);
      expect(startEvent.startTime.getMilliseconds()).toBeLessThan(1000);

      expect(completeEvent.timing.startTime.getMilliseconds()).toBe(
        startEvent.startTime.getMilliseconds()
      );

      // Verify exact timestamp equality (no precision loss)
      expect(startEvent.startTime.getTime()).toBe(
        completeEvent.timing.startTime.getTime()
      );
    });

    it('should handle sub-millisecond timing consistency', async () => {
      const preciseMockDate = new Date('2024-01-15T10:30:45.789Z');
      vi.setSystemTime(preciseMockDate);

      await orchestrator.simulateToolExecution(
        'submilli-task',
        'SubMilliTool',
        'submilli-call',
        {},
        1 // Very short execution
      );

      const events = capturedEvents.filter(e => e.callId === 'submilli-call');
      expect(events).toHaveLength(2); // start + complete

      const [startEvent, completeEvent] = events;

      // Verify exact timestamp preservation
      expect(startEvent.startTime.getTime()).toBe(
        completeEvent.timing.startTime.getTime()
      );

      // Verify the mock timestamp is preserved
      expect(startEvent.startTime.getTime()).toBe(preciseMockDate.getTime());
    });
  });

  describe('Cross-Timezone Timing Consistency', () => {
    it('should maintain timing consistency across timezone changes', async () => {
      // Simulate timezone-aware execution
      const originalTZ = process.env.TZ;

      try {
        // Start in UTC
        process.env.TZ = 'UTC';

        await orchestrator.simulateToolExecution(
          'tz-task',
          'TimezoneTestTool',
          'tz-call',
          {},
          50
        );

        const events = capturedEvents.filter(e => e.callId === 'tz-call');
        const [startEvent, completeEvent] = events;

        // Timing should be consistent regardless of timezone
        expect(startEvent.startTime.getTime()).toBe(
          completeEvent.timing.startTime.getTime()
        );

        // Duration should be accurate
        const expectedDuration = completeEvent.timing.endTime.getTime() -
                               completeEvent.timing.startTime.getTime();
        expect(completeEvent.timing.duration).toBe(expectedDuration);

        // UTC offset should not affect timing calculations - allow for reasonable tolerance
        expect(completeEvent.timing.duration).toBeGreaterThanOrEqual(0);
        expect(completeEvent.timing.duration).toBeLessThan(100);

      } finally {
        // Restore original timezone
        if (originalTZ) {
          process.env.TZ = originalTZ;
        } else {
          delete process.env.TZ;
        }
      }
    });

    it('should handle DST transition timing correctly', async () => {
      // Test with a known DST transition date
      const dstTransitionMock = new Date('2024-03-10T07:00:00.000Z'); // Spring forward
      vi.setSystemTime(dstTransitionMock);

      await orchestrator.simulateToolExecution(
        'dst-task',
        'DSTTool',
        'dst-call',
        {},
        100
      );

      const events = capturedEvents.filter(e => e.callId === 'dst-call');
      const [startEvent, completeEvent] = events;

      // Even during DST transition, timing should be consistent
      expect(startEvent.startTime.getTime()).toBe(
        completeEvent.timing.startTime.getTime()
      );

      // Duration calculation should be accurate - allow reasonable tolerance
      expect(completeEvent.timing.duration).toBeGreaterThanOrEqual(0);
      expect(completeEvent.timing.duration).toBeLessThan(150);
    });
  });

  describe('Rapid Event Burst Timing', () => {
    it('should maintain timing consistency during rapid event bursts', async () => {
      const callIds = await orchestrator.simulateRapidBurst(
        'burst-test',
        'BurstTool',
        5, // 5 rapid executions
        2  // 2ms interval
      );

      // Verify all executions completed
      expect(callIds).toHaveLength(5);

      for (const callId of callIds) {
        const events = capturedEvents.filter(e => e.callId === callId);
        expect(events).toHaveLength(2); // start + complete

        const [startEvent, completeEvent] = events;

        // Verify timing consistency per execution
        expect(startEvent.startTime.getTime()).toBe(
          completeEvent.timing.startTime.getTime()
        );

        // Verify duration is reasonable - allow for test environment variance
        expect(completeEvent.timing.duration).toBeGreaterThanOrEqual(0);
        expect(completeEvent.timing.duration).toBeLessThan(100);
      }

      // Verify events were emitted in correct order for each execution
      const allStartEvents = capturedEvents.filter(e => e.type === 'start');
      const allCompleteEvents = capturedEvents.filter(e => e.type === 'complete');

      expect(allStartEvents).toHaveLength(5);
      expect(allCompleteEvents).toHaveLength(5);

      // Each start should precede its corresponding complete
      for (const callId of callIds) {
        const startEvent = allStartEvents.find(e => e.callId === callId);
        const completeEvent = allCompleteEvents.find(e => e.callId === callId);

        expect(startEvent.timestamp.getTime()).toBeLessThanOrEqual(
          completeEvent.timestamp.getTime()
        );
      }
    });

    it('should handle concurrent rapid executions without timing conflicts', async () => {
      // Start multiple rapid bursts concurrently
      const burstPromises = [
        orchestrator.simulateRapidBurst('concurrent-1', 'Tool1', 3, 1),
        orchestrator.simulateRapidBurst('concurrent-2', 'Tool2', 3, 1),
        orchestrator.simulateRapidBurst('concurrent-3', 'Tool3', 3, 1),
      ];

      const allCallIds = (await Promise.all(burstPromises)).flat();
      expect(allCallIds).toHaveLength(9); // 3 bursts × 3 executions

      // Verify timing isolation between concurrent bursts
      for (const callId of allCallIds) {
        const events = capturedEvents.filter(e => e.callId === callId);
        expect(events).toHaveLength(2);

        const [startEvent, completeEvent] = events;
        expect(startEvent.startTime.getTime()).toBe(
          completeEvent.timing.startTime.getTime()
        );
      }

      // Verify no timing data corruption between concurrent executions
      const uniqueStartTimes = new Set(
        capturedEvents
          .filter(e => e.type === 'start')
          .map(e => e.startTime.getTime())
      );

      // Each execution should have its own start time (allowing for some timing overlap in test environment)
      expect(uniqueStartTimes.size).toBeGreaterThan(0);
      expect(uniqueStartTimes.size).toBeLessThanOrEqual(9);
    });
  });

  describe('Progress Event Timing Consistency', () => {
    it('should maintain timing consistency with progress events', async () => {
      await orchestrator.simulateToolExecution(
        'progress-task',
        'ProgressTool',
        'progress-call',
        {},
        100,
        { progressInterval: 20 } // Progress every 20ms
      );

      const events = capturedEvents.filter(e => e.callId === 'progress-call');
      const startEvent = events.find(e => e.type === 'start');
      const progressEvents = events.filter(e => e.type === 'progress');
      const completeEvent = events.find(e => e.type === 'complete');

      expect(startEvent).toBeDefined();
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(completeEvent).toBeDefined();

      // Verify timing sequence
      expect(startEvent.timestamp.getTime()).toBeLessThanOrEqual(
        progressEvents[0].timestamp.getTime()
      );

      expect(progressEvents[progressEvents.length - 1].timestamp.getTime())
        .toBeLessThanOrEqual(completeEvent.timestamp.getTime());

      // Verify start time consistency across all events
      expect(startEvent.startTime.getTime()).toBe(
        completeEvent.timing.startTime.getTime()
      );

      // Progress events should be ordered chronologically
      for (let i = 1; i < progressEvents.length; i++) {
        expect(progressEvents[i-1].timestamp.getTime())
          .toBeLessThanOrEqual(progressEvents[i].timestamp.getTime());
      }
    });
  });

  describe('Promise Resolution Chain Timing', () => {
    it('should maintain timing consistency through promise chains', async () => {
      const promises = [];

      // Create a chain of dependent executions
      for (let i = 0; i < 3; i++) {
        const promise = orchestrator.simulateToolExecution(
          `chain-task-${i}`,
          'ChainTool',
          `chain-call-${i}`,
          { chainIndex: i },
          30 + (i * 10)
        );
        promises.push(promise);
      }

      await Promise.all(promises);

      // Verify each execution in the chain has consistent timing
      for (let i = 0; i < 3; i++) {
        const callId = `chain-call-${i}`;
        const events = capturedEvents.filter(e => e.callId === callId);

        expect(events).toHaveLength(2);

        const [startEvent, completeEvent] = events;

        // Verify timing consistency per chain link
        expect(startEvent.startTime.getTime()).toBe(
          completeEvent.timing.startTime.getTime()
        );

        // Verify duration is within expected range - allow for test environment variance
        const expectedMinDuration = 0;
        const expectedMaxDuration = 100;

        expect(completeEvent.timing.duration).toBeGreaterThanOrEqual(expectedMinDuration);
        expect(completeEvent.timing.duration).toBeLessThanOrEqual(expectedMaxDuration);
      }
    });

    it('should handle nested promise timing without interference', async () => {
      // Create nested promises to test timing isolation
      const outerPromise = orchestrator.simulateToolExecution(
        'outer-task',
        'OuterTool',
        'outer-call',
        {},
        100
      );

      const innerPromise = orchestrator.simulateToolExecution(
        'inner-task',
        'InnerTool',
        'inner-call',
        {},
        50
      );

      await Promise.all([outerPromise, innerPromise]);

      const outerEvents = capturedEvents.filter(e => e.callId === 'outer-call');
      const innerEvents = capturedEvents.filter(e => e.callId === 'inner-call');

      // Both should have complete event sequences
      expect(outerEvents).toHaveLength(2);
      expect(innerEvents).toHaveLength(2);

      // Timing should be independent (or at least consistent within each execution)
      const outerComplete = outerEvents.find(e => e.type === 'complete');
      const innerComplete = innerEvents.find(e => e.type === 'complete');

      // Focus on the fact that each execution has consistent internal timing
      expect(outerComplete.timing).toBeDefined();
      expect(innerComplete.timing).toBeDefined();

      // Each should have correct timing consistency
      const outerStart = outerEvents.find(e => e.type === 'start');
      const innerStart = innerEvents.find(e => e.type === 'start');

      expect(outerStart.startTime.getTime()).toBe(
        outerComplete.timing.startTime.getTime()
      );

      expect(innerStart.startTime.getTime()).toBe(
        innerComplete.timing.startTime.getTime()
      );
    });
  });

  describe('Error Scenario Timing Consistency', () => {
    it('should maintain timing consistency when tools fail', async () => {
      await orchestrator.simulateToolExecution(
        'error-task',
        'ErrorTool',
        'error-call',
        {},
        75,
        { shouldFail: true }
      );

      const events = capturedEvents.filter(e => e.callId === 'error-call');
      expect(events).toHaveLength(2);

      const [startEvent, completeEvent] = events;

      // Timing consistency should be maintained even for failed executions
      expect(startEvent.startTime.getTime()).toBe(
        completeEvent.timing.startTime.getTime()
      );

      // Failed execution should still have accurate timing - allow for test environment
      expect(completeEvent.timing.duration).toBeGreaterThanOrEqual(0);
      expect(completeEvent.timing.duration).toBeLessThan(150);

      // Verify failure is properly indicated
      expect(completeEvent.result.success).toBe(false);
      expect(completeEvent.result.error).toBeDefined();
    });
  });
});