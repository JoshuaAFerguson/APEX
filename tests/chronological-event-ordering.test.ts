import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Chronological Event Ordering Tests
 *
 * Validates that events are emitted and processed in correct chronological order,
 * especially under high concurrency and rapid execution scenarios.
 *
 * Focus Areas:
 * - Event emission chronological ordering
 * - Cross-tool event timing relationships
 * - Event sequence preservation under load
 * - Timestamp monotonicity validation
 * - Event causality preservation
 */

interface TimestampedEvent {
  id: string;
  type: 'start' | 'progress' | 'complete';
  taskId: string;
  toolName: string;
  callId: string;
  timestamp: Date;
  systemTimestamp: number; // System timestamp for ordering validation
  sequenceNumber: number;
  causality?: {
    causedBy?: string; // ID of event that caused this one
    causedAfter?: string; // ID of event that must precede this one
  };
}

interface ChronologicalConstraint {
  eventId: string;
  mustOccurAfter?: string[];
  mustOccurBefore?: string[];
  maxDelayMs?: number;
  minDelayMs?: number;
}

/**
 * Chronological event orchestrator with strict ordering validation
 */
class ChronologicalEventOrchestrator extends EventEmitter {
  private eventHistory: TimestampedEvent[] = [];
  private sequenceCounter = 0;
  private activeExecutions = new Map<string, {
    startTime: Date;
    startSequence: number;
    constraints: ChronologicalConstraint[];
  }>();

  /**
   * Execute tool with chronological constraints
   */
  async executeWithConstraints(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    executionTimeMs: number,
    constraints: ChronologicalConstraint[] = [],
    options: {
      shouldFail?: boolean;
      progressSteps?: Array<{ message: string; percentage: number; delayMs: number }>;
      waitForEvents?: string[]; // Wait for these event IDs before starting
    } = {}
  ): Promise<void> {
    // Wait for prerequisite events if specified
    if (options.waitForEvents) {
      await this.waitForEvents(options.waitForEvents);
    }

    const startTime = new Date();
    const startEventId = `${callId}-start`;

    // Record start event
    const startEvent: TimestampedEvent = {
      id: startEventId,
      type: 'start',
      taskId,
      toolName,
      callId,
      timestamp: startTime,
      systemTimestamp: Date.now(),
      sequenceNumber: this.sequenceCounter++,
    };

    this.eventHistory.push(startEvent);
    this.activeExecutions.set(callId, {
      startTime,
      startSequence: startEvent.sequenceNumber,
      constraints,
    });

    // Emit start event
    this.emit('tool:start', {
      taskId,
      toolName,
      callId,
      input,
      startTime,
      timestamp: startTime,
    });

    return new Promise<void>((resolve) => {
      let progressDelay = 0;

      // Handle progress events if specified
      if (options.progressSteps) {
        for (const [index, step] of options.progressSteps.entries()) {
          progressDelay += step.delayMs;

          setTimeout(() => {
            const progressTime = new Date();
            const progressEventId = `${callId}-progress-${index}`;

            const progressEvent: TimestampedEvent = {
              id: progressEventId,
              type: 'progress',
              taskId,
              toolName,
              callId,
              timestamp: progressTime,
              systemTimestamp: Date.now(),
              sequenceNumber: this.sequenceCounter++,
              causality: {
                causedBy: startEventId,
                causedAfter: index > 0 ? `${callId}-progress-${index - 1}` : startEventId,
              },
            };

            this.eventHistory.push(progressEvent);

            this.emit('tool:progress', {
              taskId,
              toolName,
              callId,
              progress: step,
              timestamp: progressTime,
            });
          }, progressDelay);
        }
      }

      // Complete execution
      setTimeout(() => {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        const completeEventId = `${callId}-complete`;

        const lastProgressId = options.progressSteps
          ? `${callId}-progress-${options.progressSteps.length - 1}`
          : startEventId;

        const completeEvent: TimestampedEvent = {
          id: completeEventId,
          type: 'complete',
          taskId,
          toolName,
          callId,
          timestamp: endTime,
          systemTimestamp: Date.now(),
          sequenceNumber: this.sequenceCounter++,
          causality: {
            causedBy: startEventId,
            causedAfter: lastProgressId,
          },
        };

        this.eventHistory.push(completeEvent);

        // Emit completion
        this.emit('tool:complete', {
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
          timestamp: endTime,
        });

        this.activeExecutions.delete(callId);
        resolve();
      }, executionTimeMs);
    });
  }

  /**
   * Wait for specific events to occur
   */
  private async waitForEvents(eventIds: string[]): Promise<void> {
    return new Promise<void>((resolve) => {
      const checkCompletion = () => {
        const existingEventIds = this.eventHistory.map(e => e.id);
        const allEventsExist = eventIds.every(id => existingEventIds.includes(id));

        if (allEventsExist) {
          resolve();
        } else {
          // Check again after a small delay
          setTimeout(checkCompletion, 10);
        }
      };

      checkCompletion();
    });
  }

  /**
   * Execute tools with complex causal relationships
   */
  async executeChain(
    taskId: string,
    chainSteps: Array<{
      toolName: string;
      callId: string;
      executionTimeMs: number;
      waitForPrevious?: boolean;
      waitForSpecific?: string[]; // Specific event IDs to wait for
      constraints?: ChronologicalConstraint[];
    }>
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < chainSteps.length; i++) {
      const step = chainSteps[i];
      const previousStepCompleteId = i > 0 ? `${chainSteps[i - 1].callId}-complete` : undefined;

      const waitForEvents = [
        ...(step.waitForSpecific || []),
        ...(step.waitForPrevious && previousStepCompleteId ? [previousStepCompleteId] : []),
      ];

      promises.push(
        this.executeWithConstraints(
          taskId,
          step.toolName,
          step.callId,
          { chainStep: i },
          step.executionTimeMs,
          step.constraints,
          {
            waitForEvents: waitForEvents.length > 0 ? waitForEvents : undefined,
            progressSteps: [
              { message: `Step ${i} progress`, percentage: 100, delayMs: Math.floor(step.executionTimeMs * 0.5) }
            ]
          }
        )
      );
    }

    await Promise.all(promises);
  }

  /**
   * Validate chronological ordering of all events
   */
  validateChronologicalOrder(): {
    isValid: boolean;
    violations: Array<{
      eventA: TimestampedEvent;
      eventB: TimestampedEvent;
      violationType: 'timestamp_order' | 'sequence_order' | 'causality' | 'system_clock';
      description: string;
    }>;
    statistics: {
      totalEvents: number;
      avgTimeBetweenEvents: number;
      maxTimeBetweenEvents: number;
      sequenceOrderAccuracy: number;
    };
  } {
    const violations: Array<{
      eventA: TimestampedEvent;
      eventB: TimestampedEvent;
      violationType: 'timestamp_order' | 'sequence_order' | 'causality' | 'system_clock';
      description: string;
    }> = [];

    const events = [...this.eventHistory].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Check timestamp ordering
    for (let i = 1; i < events.length; i++) {
      const current = events[i];
      const previous = events[i - 1];

      // Timestamp should generally increase (allow for minimal clock variance)
      if (current.timestamp.getTime() < previous.timestamp.getTime() - 5) {
        violations.push({
          eventA: previous,
          eventB: current,
          violationType: 'timestamp_order',
          description: `Event ${current.id} has earlier timestamp than ${previous.id}`,
        });
      }

      // System timestamp should increase
      if (current.systemTimestamp < previous.systemTimestamp - 10) {
        violations.push({
          eventA: previous,
          eventB: current,
          violationType: 'system_clock',
          description: `Event ${current.id} has earlier system timestamp than ${previous.id}`,
        });
      }
    }

    // Check causality constraints
    for (const event of events) {
      if (event.causality?.causedAfter) {
        const causeEvent = events.find(e => e.id === event.causality!.causedAfter);
        if (causeEvent && causeEvent.sequenceNumber >= event.sequenceNumber) {
          violations.push({
            eventA: causeEvent,
            eventB: event,
            violationType: 'causality',
            description: `Event ${event.id} should occur after ${causeEvent.id} but sequence order is violated`,
          });
        }
      }

      if (event.causality?.causedBy) {
        const causedByEvent = events.find(e => e.id === event.causality!.causedBy);
        if (causedByEvent && causedByEvent.timestamp.getTime() > event.timestamp.getTime()) {
          violations.push({
            eventA: causedByEvent,
            eventB: event,
            violationType: 'causality',
            description: `Event ${event.id} should be caused by ${causedByEvent.id} but occurs before it`,
          });
        }
      }
    }

    // Calculate statistics
    const timeDiffs: number[] = [];
    for (let i = 1; i < events.length; i++) {
      timeDiffs.push(events[i].timestamp.getTime() - events[i - 1].timestamp.getTime());
    }

    const avgTimeBetweenEvents = timeDiffs.length > 0
      ? timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length
      : 0;
    const maxTimeBetweenEvents = timeDiffs.length > 0 ? Math.max(...timeDiffs) : 0;

    // Check sequence order accuracy
    let correctSequenceCount = 0;
    for (let i = 1; i < events.length; i++) {
      if (events[i].timestamp.getTime() >= events[i - 1].timestamp.getTime() - 5) {
        correctSequenceCount++;
      }
    }
    const sequenceOrderAccuracy = events.length > 1
      ? correctSequenceCount / (events.length - 1)
      : 1;

    return {
      isValid: violations.length === 0,
      violations,
      statistics: {
        totalEvents: events.length,
        avgTimeBetweenEvents,
        maxTimeBetweenEvents,
        sequenceOrderAccuracy,
      },
    };
  }

  getEventHistory(): TimestampedEvent[] {
    return [...this.eventHistory];
  }

  clearHistory(): void {
    this.eventHistory = [];
    this.sequenceCounter = 0;
    this.activeExecutions.clear();
  }

  close(): void {
    this.removeAllListeners();
    this.clearHistory();
  }
}

describe('Chronological Event Ordering Tests', () => {
  let orchestrator: ChronologicalEventOrchestrator;

  beforeEach(() => {
    orchestrator = new ChronologicalEventOrchestrator();
  });

  afterEach(() => {
    orchestrator.close();
  });

  // ============================================================================
  // Basic Chronological Ordering Tests
  // ============================================================================

  describe('Basic Chronological Ordering', () => {
    it('should maintain correct chronological order for sequential executions', async () => {
      const taskId = 'sequential-task';

      // Execute tools in sequence with clear dependencies
      await orchestrator.executeChain(taskId, [
        { toolName: 'FirstTool', callId: 'first', executionTimeMs: 100 },
        { toolName: 'SecondTool', callId: 'second', executionTimeMs: 80, waitForPrevious: true },
        { toolName: 'ThirdTool', callId: 'third', executionTimeMs: 60, waitForPrevious: true },
      ]);

      const validation = orchestrator.validateChronologicalOrder();

      // Should have no violations
      expect(validation.violations).toHaveLength(0);
      expect(validation.isValid).toBe(true);

      // Should have proper sequence order accuracy
      expect(validation.statistics.sequenceOrderAccuracy).toBeGreaterThan(0.95);

      // Should have 9 events total (3 tools × 3 events each: start, progress, complete)
      expect(validation.statistics.totalEvents).toBe(9);

      // Validate specific ordering
      const history = orchestrator.getEventHistory();
      const sortedBySequence = history.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      // First tool should start first
      expect(sortedBySequence[0].callId).toBe('first');
      expect(sortedBySequence[0].type).toBe('start');

      // Second tool should start after first completes
      const firstComplete = sortedBySequence.find(e => e.callId === 'first' && e.type === 'complete');
      const secondStart = sortedBySequence.find(e => e.callId === 'second' && e.type === 'start');

      expect(firstComplete).toBeDefined();
      expect(secondStart).toBeDefined();
      expect(secondStart!.sequenceNumber).toBeGreaterThan(firstComplete!.sequenceNumber);
    });

    it('should preserve event ordering for concurrent executions with different durations', async () => {
      const taskId = 'concurrent-task';

      // Execute concurrent tools with different execution times
      const concurrentPromises = [
        orchestrator.executeWithConstraints(taskId, 'FastTool', 'fast', {}, 50),
        orchestrator.executeWithConstraints(taskId, 'SlowTool', 'slow', {}, 150),
        orchestrator.executeWithConstraints(taskId, 'MediumTool', 'medium', {}, 100),
      ];

      await Promise.all(concurrentPromises);

      const validation = orchestrator.validateChronologicalOrder();

      // Concurrent execution should still maintain chronological consistency
      expect(validation.violations.filter(v => v.violationType === 'timestamp_order')).toHaveLength(0);
      expect(validation.statistics.sequenceOrderAccuracy).toBeGreaterThan(0.90);

      const history = orchestrator.getEventHistory();

      // All tools should have start, complete events
      const fastEvents = history.filter(e => e.callId === 'fast');
      const slowEvents = history.filter(e => e.callId === 'slow');
      const mediumEvents = history.filter(e => e.callId === 'medium');

      expect(fastEvents.length).toBeGreaterThanOrEqual(2); // start, complete
      expect(slowEvents.length).toBeGreaterThanOrEqual(2);
      expect(mediumEvents.length).toBeGreaterThanOrEqual(2);

      // Fast tool should complete before slow tool
      const fastComplete = fastEvents.find(e => e.type === 'complete');
      const slowComplete = slowEvents.find(e => e.type === 'complete');

      expect(fastComplete).toBeDefined();
      expect(slowComplete).toBeDefined();
      expect(fastComplete!.timestamp.getTime()).toBeLessThan(slowComplete!.timestamp.getTime());
    });

    it('should validate causality preservation in event chains', async () => {
      const taskId = 'causality-task';

      // Create a complex chain with specific dependencies
      const chainPromises = [
        orchestrator.executeWithConstraints(
          taskId, 'InitializerTool', 'init', {}, 80,
          [],
          {
            progressSteps: [
              { message: 'Initializing...', percentage: 100, delayMs: 40 }
            ]
          }
        ),
        orchestrator.executeWithConstraints(
          taskId, 'ProcessorTool', 'process', {}, 120,
          [],
          {
            waitForEvents: ['init-complete'],
            progressSteps: [
              { message: 'Processing...', percentage: 50, delayMs: 60 },
              { message: 'Finalizing...', percentage: 100, delayMs: 60 }
            ]
          }
        ),
        orchestrator.executeWithConstraints(
          taskId, 'FinalizerTool', 'finalize', {}, 90,
          [],
          {
            waitForEvents: ['process-complete'],
            progressSteps: [
              { message: 'Cleanup...', percentage: 100, delayMs: 45 }
            ]
          }
        ),
      ];

      await Promise.all(chainPromises);

      const validation = orchestrator.validateChronologicalOrder();

      // Should have no causality violations
      const causalityViolations = validation.violations.filter(v => v.violationType === 'causality');
      expect(causalityViolations).toHaveLength(0);

      // Validate the causal chain
      const history = orchestrator.getEventHistory();
      const initComplete = history.find(e => e.id === 'init-complete');
      const processStart = history.find(e => e.id === 'process-start');
      const processComplete = history.find(e => e.id === 'process-complete');
      const finalizeStart = history.find(e => e.id === 'finalize-start');

      expect(initComplete).toBeDefined();
      expect(processStart).toBeDefined();
      expect(processComplete).toBeDefined();
      expect(finalizeStart).toBeDefined();

      // Validate causal ordering
      expect(processStart!.timestamp.getTime()).toBeGreaterThanOrEqual(initComplete!.timestamp.getTime());
      expect(finalizeStart!.timestamp.getTime()).toBeGreaterThanOrEqual(processComplete!.timestamp.getTime());
    });
  });

  // ============================================================================
  // High Load Ordering Tests
  // ============================================================================

  describe('High Load Event Ordering', () => {
    it('should maintain ordering under rapid execution load', async () => {
      const taskId = 'rapid-load-task';
      const rapidExecutionCount = 50;

      // Execute many tools rapidly
      const rapidPromises = Array.from({ length: rapidExecutionCount }, (_, i) => {
        return orchestrator.executeWithConstraints(
          taskId,
          `RapidTool${i}`,
          `rapid-${i}`,
          { index: i },
          20 + Math.random() * 40, // 20-60ms execution time
          [],
          {
            progressSteps: [
              { message: `Rapid progress ${i}`, percentage: 100, delayMs: 10 }
            ]
          }
        );
      });

      await Promise.all(rapidPromises);

      const validation = orchestrator.validateChronologicalOrder();

      // Under rapid load, some reordering is acceptable but should be minimal
      expect(validation.statistics.sequenceOrderAccuracy).toBeGreaterThan(0.85);

      // Should have correct total event count
      expect(validation.statistics.totalEvents).toBe(rapidExecutionCount * 3); // start, progress, complete

      // Timestamp violations should be minimal
      const timestampViolations = validation.violations.filter(v => v.violationType === 'timestamp_order');
      expect(timestampViolations.length).toBeLessThan(rapidExecutionCount * 0.1); // Less than 10%

      // Each tool should have complete event cycle
      const history = orchestrator.getEventHistory();
      for (let i = 0; i < rapidExecutionCount; i++) {
        const toolEvents = history.filter(e => e.callId === `rapid-${i}`);
        expect(toolEvents.length).toBe(3); // start, progress, complete

        const startEvent = toolEvents.find(e => e.type === 'start');
        const completeEvent = toolEvents.find(e => e.type === 'complete');

        expect(startEvent).toBeDefined();
        expect(completeEvent).toBeDefined();
        expect(completeEvent!.timestamp.getTime()).toBeGreaterThanOrEqual(startEvent!.timestamp.getTime());
      }
    });

    it('should preserve ordering consistency with mixed execution patterns', async () => {
      const taskId = 'mixed-pattern-task';

      // Mix of instant, fast, and slow executions
      const mixedPromises = [
        // Instant executions
        ...Array.from({ length: 10 }, (_, i) =>
          orchestrator.executeWithConstraints(taskId, `InstantTool${i}`, `instant-${i}`, {}, 5)
        ),

        // Fast executions
        ...Array.from({ length: 8 }, (_, i) =>
          orchestrator.executeWithConstraints(taskId, `FastTool${i}`, `fast-${i}`, {}, 30)
        ),

        // Slow executions
        ...Array.from({ length: 5 }, (_, i) =>
          orchestrator.executeWithConstraints(taskId, `SlowTool${i}`, `slow-${i}`, {}, 150)
        ),
      ];

      await Promise.all(mixedPromises);

      const validation = orchestrator.validateChronologicalOrder();

      // Mixed patterns should still maintain reasonable ordering
      expect(validation.statistics.sequenceOrderAccuracy).toBeGreaterThan(0.80);

      const history = orchestrator.getEventHistory();

      // Group events by execution speed
      const instantEvents = history.filter(e => e.callId.startsWith('instant-'));
      const fastEvents = history.filter(e => e.callId.startsWith('fast-'));
      const slowEvents = history.filter(e => e.callId.startsWith('slow-'));

      // Instant tools should generally complete first
      const instantCompletes = instantEvents.filter(e => e.type === 'complete');
      const slowCompletes = slowEvents.filter(e => e.type === 'complete');

      if (instantCompletes.length > 0 && slowCompletes.length > 0) {
        const avgInstantCompleteTime = instantCompletes.reduce((sum, e) =>
          sum + e.timestamp.getTime(), 0) / instantCompletes.length;
        const avgSlowCompleteTime = slowCompletes.reduce((sum, e) =>
          sum + e.timestamp.getTime(), 0) / slowCompletes.length;

        expect(avgInstantCompleteTime).toBeLessThan(avgSlowCompleteTime);
      }
    });
  });

  // ============================================================================
  // Timestamp Monotonicity Tests
  // ============================================================================

  describe('Timestamp Monotonicity', () => {
    it('should maintain timestamp monotonicity under normal conditions', async () => {
      const taskId = 'monotonic-task';

      // Execute tools in a way that should maintain strict monotonicity
      await orchestrator.executeChain(taskId, [
        { toolName: 'MonotonicTool1', callId: 'mono-1', executionTimeMs: 50 },
        { toolName: 'MonotonicTool2', callId: 'mono-2', executionTimeMs: 50, waitForPrevious: true },
        { toolName: 'MonotonicTool3', callId: 'mono-3', executionTimeMs: 50, waitForPrevious: true },
        { toolName: 'MonotonicTool4', callId: 'mono-4', executionTimeMs: 50, waitForPrevious: true },
      ]);

      const history = orchestrator.getEventHistory();
      const sortedBySequence = history.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      // Check strict monotonicity
      let monotonicityViolations = 0;
      for (let i = 1; i < sortedBySequence.length; i++) {
        const current = sortedBySequence[i];
        const previous = sortedBySequence[i - 1];

        if (current.timestamp.getTime() < previous.timestamp.getTime()) {
          monotonicityViolations++;
        }
      }

      // Should have perfect or near-perfect monotonicity for sequential execution
      expect(monotonicityViolations).toBe(0);

      const validation = orchestrator.validateChronologicalOrder();
      expect(validation.statistics.sequenceOrderAccuracy).toBe(1.0);
    });

    it('should handle timestamp precision edge cases', async () => {
      const taskId = 'precision-edge-task';

      // Execute tools with very short intervals to test timestamp precision
      const precisionPromises = Array.from({ length: 20 }, async (_, i) => {
        await new Promise(resolve => setTimeout(resolve, i * 2)); // 2ms stagger
        return orchestrator.executeWithConstraints(
          taskId,
          `PrecisionTool${i}`,
          `precision-${i}`,
          { index: i },
          10 // Very short execution time
        );
      });

      await Promise.all(precisionPromises);

      const validation = orchestrator.validateChronologicalOrder();
      const history = orchestrator.getEventHistory();

      // Check for timestamp collisions (same timestamp values)
      const timestamps = history.map(e => e.timestamp.getTime());
      const uniqueTimestamps = new Set(timestamps);

      // Should have reasonable timestamp uniqueness (allowing for rapid execution)
      const timestampUniqueness = uniqueTimestamps.size / timestamps.length;
      expect(timestampUniqueness).toBeGreaterThan(0.50); // At least 50% unique due to rapid execution

      // System timestamps should be more precise
      const systemTimestamps = history.map(e => e.systemTimestamp);
      const uniqueSystemTimestamps = new Set(systemTimestamps);
      const systemTimestampUniqueness = uniqueSystemTimestamps.size / systemTimestamps.length;
      expect(systemTimestampUniqueness).toBeGreaterThan(0.55); // Allowing for rapid execution variance

      // Should maintain reasonable ordering despite precision limits
      expect(validation.statistics.sequenceOrderAccuracy).toBeGreaterThan(0.70);
    });
  });

  // ============================================================================
  // Complex Dependency Validation Tests
  // ============================================================================

  describe('Complex Dependency Validation', () => {
    it('should validate complex multi-tool dependency graphs', async () => {
      const taskId = 'dependency-graph-task';

      // Create a complex dependency graph:
      // A -> B, C
      // B -> D
      // C -> D, E
      // D -> F
      // E -> F

      const graphPromises = [
        // A (no dependencies)
        orchestrator.executeWithConstraints(taskId, 'ToolA', 'dep-a', {}, 60),

        // B (depends on A)
        orchestrator.executeWithConstraints(taskId, 'ToolB', 'dep-b', {}, 50, [], {
          waitForEvents: ['dep-a-complete']
        }),

        // C (depends on A)
        orchestrator.executeWithConstraints(taskId, 'ToolC', 'dep-c', {}, 70, [], {
          waitForEvents: ['dep-a-complete']
        }),

        // D (depends on B and C)
        orchestrator.executeWithConstraints(taskId, 'ToolD', 'dep-d', {}, 40, [], {
          waitForEvents: ['dep-b-complete', 'dep-c-complete']
        }),

        // E (depends on C)
        orchestrator.executeWithConstraints(taskId, 'ToolE', 'dep-e', {}, 55, [], {
          waitForEvents: ['dep-c-complete']
        }),

        // F (depends on D and E)
        orchestrator.executeWithConstraints(taskId, 'ToolF', 'dep-f', {}, 45, [], {
          waitForEvents: ['dep-d-complete', 'dep-e-complete']
        }),
      ];

      await Promise.all(graphPromises);

      const validation = orchestrator.validateChronologicalOrder();

      // Should have no causality violations
      const causalityViolations = validation.violations.filter(v => v.violationType === 'causality');
      expect(causalityViolations).toHaveLength(0);

      const history = orchestrator.getEventHistory();

      // Validate dependency graph execution order
      const getCompleteTime = (callId: string) =>
        history.find(e => e.callId === callId && e.type === 'complete')?.timestamp.getTime() || 0;

      const aComplete = getCompleteTime('dep-a');
      const bComplete = getCompleteTime('dep-b');
      const cComplete = getCompleteTime('dep-c');
      const dComplete = getCompleteTime('dep-d');
      const eComplete = getCompleteTime('dep-e');
      const fComplete = getCompleteTime('dep-f');

      // Validate dependency order
      expect(bComplete).toBeGreaterThan(aComplete); // B after A
      expect(cComplete).toBeGreaterThan(aComplete); // C after A
      expect(dComplete).toBeGreaterThan(bComplete); // D after B
      expect(dComplete).toBeGreaterThan(cComplete); // D after C
      expect(eComplete).toBeGreaterThan(cComplete); // E after C
      expect(fComplete).toBeGreaterThan(dComplete); // F after D
      expect(fComplete).toBeGreaterThan(eComplete); // F after E

      expect(validation.isValid).toBe(true);
    });
  });
});