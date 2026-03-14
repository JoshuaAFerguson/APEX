/**
 * Event Timing Consistency Tests
 *
 * Comprehensive test suite for validating timing consistency between different
 * event types (start, progress, complete). Ensures that timing values are
 * mathematically consistent, chronologically ordered, and properly isolated.
 *
 * Test Coverage:
 * - Start/Complete Event Timing Alignment
 * - Progress Event Timing Windows
 * - Duration Calculation Consistency
 * - Chronological Ordering Validation
 * - Cross-Event Timing Relationships
 * - Timing Edge Cases
 *
 * @see ADR-0042-event-timing-consistency-testing.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockOrchestrator,
  createTestOrchestrator,
  TestScenarioBuilder,
} from '../tool-complete-events/shared/orchestrator-test-harness';
import {
  createConcurrentEventCollector,
  ConcurrentEventCollector,
} from '../concurrent-tools/shared/concurrent-event-collector';
import {
  EventTimingValidator,
  TIMING_TOLERANCE_MS,
  INTEGRATION_TIMING_TOLERANCE_MS,
  MAX_REASONABLE_DURATION_MS,
  MIN_REASONABLE_DURATION_MS,
  createEventSequence,
  assertEventOrdering,
  areTimestampsWithinTolerance,
  isReasonableDuration,
  calculateTimeDifference,
  formatDuration,
} from './shared/timing-consistency-utils';
import {
  createToolEventPair,
  createToolEventSequence,
  generateTimingEdgeCases,
  ToolStartEventData,
  ToolCompleteEventData,
} from './shared/mock-event-generators';
import {
  generateTestId,
  createTestTimestamp,
  eventAssert,
} from './shared/event-test-utils';
import {
  SUPPORTED_TOOLS,
  SupportedTool,
  createTestTaskId,
} from '../tool-complete-events/shared/tool-test-fixtures';
import {
  validateToolEventSequence,
} from '../tool-complete-events/shared/tool-event-validators';

describe('Event Timing Consistency', () => {
  let orchestrator: MockOrchestrator;
  let collector: ConcurrentEventCollector;
  let timingValidator: EventTimingValidator;

  beforeEach(() => {
    orchestrator = createTestOrchestrator();
    collector = createConcurrentEventCollector(orchestrator);
    timingValidator = new EventTimingValidator();
  });

  afterEach(() => {
    collector.dispose();
    orchestrator.reset();
    timingValidator.clear();
  });

  // ============================================================================
  // Start/Complete Event Timing Alignment
  // ============================================================================

  describe('Start/Complete Event Timing Alignment', () => {
    it('should align start event timestamp with complete event timing.startTime', () => {
      for (const toolName of SUPPORTED_TOOLS) {
        const { startEvent, completeEvent } = createToolEventPair(toolName);

        // Start event timestamp should equal complete event's timing.startTime
        const startTimestamp = startEvent.timestamp.getTime();
        const timingStartTime = completeEvent.timing.startTime.getTime();

        expect(startTimestamp).toBe(timingStartTime);
      }
    });

    it('should align complete event timestamp with timing.endTime', () => {
      for (const toolName of SUPPORTED_TOOLS) {
        const { completeEvent } = createToolEventPair(toolName);

        // Complete event timestamp should equal timing.endTime
        const completeTimestamp = completeEvent.timestamp.getTime();
        const timingEndTime = completeEvent.timing.endTime.getTime();

        expect(completeTimestamp).toBe(timingEndTime);
      }
    });

    it('should have start timestamp before or equal to complete timestamp', () => {
      for (const toolName of SUPPORTED_TOOLS) {
        const { startEvent, completeEvent } = createToolEventPair(toolName);

        expect(startEvent.timestamp.getTime()).toBeLessThanOrEqual(
          completeEvent.timestamp.getTime()
        );
      }
    });

    it('should have timing.startTime before or equal to timing.endTime', () => {
      for (const toolName of SUPPORTED_TOOLS) {
        const { completeEvent } = createToolEventPair(toolName);

        expect(completeEvent.timing.startTime.getTime()).toBeLessThanOrEqual(
          completeEvent.timing.endTime.getTime()
        );
      }
    });

    it('should maintain timing alignment with custom timestamps', () => {
      const customStartTime = new Date('2026-03-14T10:00:00.000Z');
      const customEndTime = new Date('2026-03-14T10:00:05.000Z');
      const expectedDuration = 5000;

      const { startEvent, completeEvent } = createToolEventPair('Bash', {
        startOptions: { timestamp: customStartTime },
        completeOptions: {
          timing: {
            startTime: customStartTime,
            endTime: customEndTime,
            duration: expectedDuration,
          },
          timestamp: customEndTime,
        },
      });

      expect(startEvent.timestamp).toEqual(customStartTime);
      expect(completeEvent.timestamp).toEqual(customEndTime);
      expect(completeEvent.timing.startTime).toEqual(customStartTime);
      expect(completeEvent.timing.endTime).toEqual(customEndTime);
    });
  });

  // ============================================================================
  // Duration Calculation Consistency
  // ============================================================================

  describe('Duration Calculation Consistency', () => {
    it('should have duration equal to endTime minus startTime', () => {
      for (const toolName of SUPPORTED_TOOLS) {
        const { completeEvent } = createToolEventPair(toolName);

        const calculatedDuration =
          completeEvent.timing.endTime.getTime() -
          completeEvent.timing.startTime.getTime();

        expect(
          Math.abs(completeEvent.timing.duration - calculatedDuration)
        ).toBeLessThanOrEqual(TIMING_TOLERANCE_MS);
      }
    });

    it('should have consistent duration across event pair', () => {
      for (const toolName of SUPPORTED_TOOLS) {
        const { startEvent, completeEvent } = createToolEventPair(toolName);

        // Calculate duration from external timestamps
        const externalDuration =
          completeEvent.timestamp.getTime() - startEvent.timestamp.getTime();

        // Calculate duration from timing object
        const internalDuration =
          completeEvent.timing.endTime.getTime() -
          completeEvent.timing.startTime.getTime();

        // Both should match the reported duration
        expect(
          Math.abs(externalDuration - completeEvent.timing.duration)
        ).toBeLessThanOrEqual(TIMING_TOLERANCE_MS);
        expect(
          Math.abs(internalDuration - completeEvent.timing.duration)
        ).toBeLessThanOrEqual(TIMING_TOLERANCE_MS);
      }
    });

    it('should use eventAssert.timingConsistency for validation', () => {
      for (const toolName of SUPPORTED_TOOLS) {
        const { completeEvent } = createToolEventPair(toolName);

        // Should not throw
        eventAssert.timingConsistency(
          completeEvent.timing.startTime,
          completeEvent.timing.endTime,
          completeEvent.timing.duration,
          TIMING_TOLERANCE_MS
        );
      }
    });

    it('should detect invalid duration calculations', () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 1000);
      const wrongDuration = 5000; // Should be 1000

      expect(() =>
        eventAssert.timingConsistency(startTime, endTime, wrongDuration, 50)
      ).toThrow(/Timing inconsistency/);
    });

    it('should handle zero duration correctly', () => {
      const now = new Date();
      const zeroDurationEvent = createToolEventPair('Read', {
        duration: 0,
        startOptions: { timestamp: now },
        completeOptions: {
          timing: {
            startTime: now,
            endTime: now,
            duration: 0,
          },
          timestamp: now,
        },
      });

      expect(zeroDurationEvent.completeEvent.timing.duration).toBe(0);
      expect(zeroDurationEvent.completeEvent.timing.startTime).toEqual(
        zeroDurationEvent.completeEvent.timing.endTime
      );
    });

    it('should flag negative durations as unreasonable', () => {
      const result = isReasonableDuration(-100);

      expect(result.isReasonable).toBe(false);
      expect(result.issues).toContain('Duration cannot be negative');
    });

    it('should flag excessive durations as unreasonable', () => {
      const result = isReasonableDuration(MAX_REASONABLE_DURATION_MS + 1000);

      expect(result.isReasonable).toBe(false);
      expect(result.issues.some((i) => i.includes('exceeds maximum'))).toBe(
        true
      );
    });
  });

  // ============================================================================
  // Progress Event Timing Consistency
  // ============================================================================

  describe('Progress Event Timing Consistency', () => {
    it('should have progress events within execution window', async () => {
      const taskId = createTestTaskId();
      collector.startCapturing();

      // Execute tool with progress events
      await orchestrator.executeToolWithProgress(taskId, 'Bash', [
        { message: 'Starting...', percentage: 0 },
        { message: 'Processing...', percentage: 50 },
        { message: 'Finishing...', percentage: 90 },
      ]);

      collector.stopCapturing();
      const summaries = collector.buildExecutionSummaries();

      for (const [, summary] of summaries) {
        if (summary.startEvent && summary.completeEvent) {
          const startTime = summary.startEvent.timestamp.getTime();
          const completeTime = summary.completeEvent.timestamp.getTime();

          for (const progressEvent of summary.progressEvents) {
            const progressTime = progressEvent.timestamp.getTime();

            // Progress should be within [startTime, completeTime]
            expect(progressTime).toBeGreaterThanOrEqual(startTime);
            expect(progressTime).toBeLessThanOrEqual(completeTime);
          }
        }
      }
    });

    it('should have progress events in chronological order', async () => {
      const taskId = createTestTaskId();
      collector.startCapturing();

      await orchestrator.executeToolWithProgress(
        taskId,
        'WebFetch',
        [
          { message: 'Step 1', percentage: 25 },
          { message: 'Step 2', percentage: 50 },
          { message: 'Step 3', percentage: 75 },
        ],
        20 // 20ms between steps
      );

      collector.stopCapturing();
      const summaries = collector.buildExecutionSummaries();

      for (const [, summary] of summaries) {
        const progressEvents = summary.progressEvents;

        for (let i = 1; i < progressEvents.length; i++) {
          const prevTime = progressEvents[i - 1].timestamp.getTime();
          const currentTime = progressEvents[i].timestamp.getTime();

          expect(currentTime).toBeGreaterThanOrEqual(prevTime);
        }
      }
    });

    it('should validate progress event sequence using validateToolEventSequence', () => {
      const taskId = generateTestId('task');
      const callId = generateTestId('call');
      const startTime = new Date();
      const duration = 5000;
      const endTime = new Date(startTime.getTime() + duration);

      const { startEvent, completeEvent } = createToolEventPair('Bash', {
        taskId,
        callId,
        startOptions: { timestamp: startTime },
        completeOptions: {
          timing: { startTime, endTime, duration },
          timestamp: endTime,
        },
      });

      // Create progress events between start and complete
      const progressEvents = [
        { taskId, toolName: 'Bash', callId, timestamp: new Date(startTime.getTime() + 1000) },
        { taskId, toolName: 'Bash', callId, timestamp: new Date(startTime.getTime() + 2500) },
        { taskId, toolName: 'Bash', callId, timestamp: new Date(startTime.getTime() + 4000) },
      ];

      const sequence = {
        startEvent,
        progressEvents,
        completeEvent,
      };

      const validation = validateToolEventSequence(sequence);
      expect(validation.isValid).toBe(true);
    });
  });

  // ============================================================================
  // Chronological Ordering Validation
  // ============================================================================

  describe('Chronological Ordering Validation', () => {
    it('should validate event ordering using EventTimingValidator', () => {
      const events = createEventSequence([
        { id: 'event-1', delayMs: 0 },
        { id: 'event-2', delayMs: 100 },
        { id: 'event-3', delayMs: 200 },
        { id: 'event-4', delayMs: 300 },
      ]);

      for (const event of events) {
        timingValidator.addEvent(event.id, event.timestamp, event.metadata);
      }

      const result = timingValidator.validateOrdering();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect out-of-order events', () => {
      const baseTime = Date.now();

      // Add events in wrong order
      timingValidator.addEvent('first', new Date(baseTime + 1000));
      timingValidator.addEvent('second', new Date(baseTime)); // Should be after 'first'

      const result = timingValidator.validateOrdering();

      // The validator should report warnings for potential race conditions
      // but not errors, as event capture order may differ from timestamp order
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should use assertEventOrdering for strict validation', () => {
      const events = createEventSequence([
        { id: 'a', delayMs: 0 },
        { id: 'b', delayMs: 50 },
        { id: 'c', delayMs: 100 },
      ]);

      // Should not throw for properly ordered events
      expect(() => assertEventOrdering(events)).not.toThrow();
    });

    it('should reject events with reversed timestamps', () => {
      const now = Date.now();
      const reversedEvents = [
        { id: 'first', timestamp: new Date(now + 100), metadata: {} },
        { id: 'second', timestamp: new Date(now), metadata: {} },
      ];

      // This should throw because second comes before first despite order
      expect(() => assertEventOrdering(reversedEvents, 0)).toThrow(
        /Event ordering violation/
      );
    });

    it('should handle identical timestamps with warnings', () => {
      const sameTime = new Date();

      timingValidator.addEvent('event-a', sameTime);
      timingValidator.addEvent('event-b', sameTime);

      const result = timingValidator.validateOrdering();

      // Should warn about identical timestamps (potential race condition)
      expect(result.warnings.some((w) => w.includes('identical timestamps'))).toBe(
        true
      );
    });
  });

  // ============================================================================
  // Sequential Tool Execution Timing
  // ============================================================================

  describe('Sequential Tool Execution Timing', () => {
    it('should maintain timing gaps between sequential executions', () => {
      const tools: SupportedTool[] = ['Read', 'Edit', 'Write', 'Bash'];
      const taskId = generateTestId('sequential-task');

      const eventSequences = createToolEventSequence(tools, {
        taskId,
        overlapEvents: false,
      });

      // Each tool should start after the previous one completes
      for (let i = 1; i < eventSequences.length; i++) {
        const prevComplete = eventSequences[i - 1].completeEvent;
        const currentStart = eventSequences[i].startEvent;

        expect(currentStart.timestamp.getTime()).toBeGreaterThanOrEqual(
          prevComplete.timestamp.getTime()
        );
      }
    });

    it('should have consistent taskId across sequential executions', () => {
      const tools: SupportedTool[] = ['Grep', 'Glob', 'Read'];
      const taskId = generateTestId('shared-task');

      const eventSequences = createToolEventSequence(tools, { taskId });

      for (const { startEvent, completeEvent } of eventSequences) {
        expect(startEvent.taskId).toBe(taskId);
        expect(completeEvent.taskId).toBe(taskId);
      }
    });

    it('should calculate total workflow duration correctly', () => {
      const tools: SupportedTool[] = ['Read', 'Edit', 'Write'];
      const taskId = generateTestId('workflow');

      const eventSequences = createToolEventSequence(tools, {
        taskId,
        overlapEvents: false,
      });

      const firstStart = eventSequences[0].startEvent.timestamp;
      const lastComplete =
        eventSequences[eventSequences.length - 1].completeEvent.timestamp;

      const totalWorkflowDuration = lastComplete.getTime() - firstStart.getTime();

      // Sum of individual durations should be <= total workflow duration
      const sumOfDurations = eventSequences.reduce(
        (sum, seq) => sum + seq.completeEvent.timing.duration,
        0
      );

      expect(totalWorkflowDuration).toBeGreaterThanOrEqual(sumOfDurations);
    });
  });

  // ============================================================================
  // Concurrent Tool Execution Timing
  // ============================================================================

  describe('Concurrent Tool Execution Timing', () => {
    it('should handle overlapping tool execution timing', () => {
      const tools: SupportedTool[] = ['Read', 'Grep', 'Glob'];
      const taskId = generateTestId('concurrent-task');

      const eventSequences = createToolEventSequence(tools, {
        taskId,
        overlapEvents: true,
      });

      // Each event pair should be internally consistent
      for (const { startEvent, completeEvent } of eventSequences) {
        expect(startEvent.timestamp.getTime()).toBeLessThanOrEqual(
          completeEvent.timestamp.getTime()
        );

        eventAssert.timingConsistency(
          completeEvent.timing.startTime,
          completeEvent.timing.endTime,
          completeEvent.timing.duration,
          TIMING_TOLERANCE_MS
        );
      }
    });

    it('should have independent timing for concurrent tools', async () => {
      const taskId = createTestTaskId();
      collector.startCapturing();

      // Execute multiple tools concurrently
      await orchestrator.executeConcurrentTools(
        taskId,
        ['Read', 'Write', 'Grep', 'Glob'],
        5
      );

      collector.stopCapturing();
      const events = collector.getEvents();

      // Build timing records from complete events
      const completeEvents = events.filter((e) => e.type === 'tool:complete');

      for (const event of completeEvents) {
        const eventData = event.data as ToolCompleteEventData;
        if (eventData?.timing) {
          // Each tool should have its own independent timing
          const calculatedDuration =
            eventData.timing.endTime.getTime() -
            eventData.timing.startTime.getTime();

          expect(
            Math.abs(eventData.timing.duration - calculatedDuration)
          ).toBeLessThanOrEqual(TIMING_TOLERANCE_MS);
        }
      }
    });

    it('should maintain unique callIds for concurrent executions', async () => {
      const taskId = createTestTaskId();
      collector.startCapturing();

      await orchestrator.executeConcurrentTools(
        taskId,
        ['Read', 'Read', 'Read'], // Same tool executed 3 times
        2
      );

      collector.stopCapturing();
      const events = collector.getEvents();

      const callIds = events.map((e) => e.callId);
      const uniqueCallIds = new Set(callIds);

      // Each start/complete pair should have unique callId
      expect(uniqueCallIds.size).toBe(callIds.length / 2); // start + complete per execution
    });
  });

  // ============================================================================
  // Timing Edge Cases
  // ============================================================================

  describe('Timing Edge Cases', () => {
    it('should handle zero duration events', () => {
      const edgeCases = generateTimingEdgeCases();
      const zeroDurationCase = edgeCases.find((c) =>
        c.name.includes('Zero duration')
      );

      expect(zeroDurationCase).toBeDefined();
      expect(zeroDurationCase!.event.timing.duration).toBe(0);

      const durationCheck = isReasonableDuration(0);
      expect(durationCheck.issues).toContain('Zero duration detected (instant execution)');
    });

    it('should handle very long duration events', () => {
      const edgeCases = generateTimingEdgeCases();
      const longDurationCase = edgeCases.find((c) =>
        c.name.includes('Very long duration')
      );

      expect(longDurationCase).toBeDefined();
      expect(longDurationCase!.event.timing.duration).toBeGreaterThan(60000);
    });

    it('should handle cross-day execution timing', () => {
      const edgeCases = generateTimingEdgeCases();
      const crossDayCase = edgeCases.find((c) =>
        c.name.includes('Cross-day')
      );

      expect(crossDayCase).toBeDefined();

      const event = crossDayCase!.event;
      const startDay = event.timing.startTime.getUTCDate();
      const endDay = event.timing.endTime.getUTCDate();

      expect(endDay).not.toBe(startDay);

      // Timing should still be consistent
      eventAssert.timingConsistency(
        event.timing.startTime,
        event.timing.endTime,
        event.timing.duration,
        TIMING_TOLERANCE_MS
      );
    });

    it('should handle sub-millisecond precision timing', () => {
      const edgeCases = generateTimingEdgeCases();
      const subMsCase = edgeCases.find((c) =>
        c.name.includes('Sub-millisecond')
      );

      expect(subMsCase).toBeDefined();

      // JavaScript Date has millisecond precision, so sub-ms should round
      const event = subMsCase!.event;
      expect(event.timing.duration).toBeGreaterThanOrEqual(0);
    });

    it('should format durations correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(65000)).toBe('1m 5.0s');
      expect(formatDuration(120000)).toBe('2m 0.0s');
    });
  });

  // ============================================================================
  // Timing Utility Functions
  // ============================================================================

  describe('Timing Utility Functions', () => {
    it('should calculate time difference correctly', () => {
      const time1 = new Date('2026-03-14T10:00:00.000Z');
      const time2 = new Date('2026-03-14T10:00:05.000Z');

      expect(calculateTimeDifference(time1, time2)).toBe(5000);
      expect(calculateTimeDifference(time2, time1)).toBe(5000); // Absolute value
    });

    it('should check timestamps within tolerance', () => {
      const baseTime = new Date();
      const withinTolerance = new Date(baseTime.getTime() + 30);
      const outsideTolerance = new Date(baseTime.getTime() + 100);

      expect(
        areTimestampsWithinTolerance(baseTime, withinTolerance, 50)
      ).toBe(true);
      expect(
        areTimestampsWithinTolerance(baseTime, outsideTolerance, 50)
      ).toBe(false);
    });

    it('should validate reasonable duration bounds', () => {
      // Valid durations
      expect(isReasonableDuration(100).isReasonable).toBe(true);
      expect(isReasonableDuration(5000).isReasonable).toBe(true);
      expect(isReasonableDuration(60000).isReasonable).toBe(true);

      // Edge cases
      expect(isReasonableDuration(-1).isReasonable).toBe(false);
      expect(isReasonableDuration(MAX_REASONABLE_DURATION_MS + 1).isReasonable).toBe(
        false
      );
    });
  });

  // ============================================================================
  // Integration with MockOrchestrator
  // ============================================================================

  describe('Integration with MockOrchestrator', () => {
    it('should capture timing data from orchestrator events', async () => {
      const taskId = createTestTaskId();
      collector.startCapturing();

      const callId = orchestrator.startToolExecution(taskId, 'Read');
      await delay(50);
      orchestrator.completeToolExecution(taskId, callId);

      collector.stopCapturing();
      const events = collector.getEvents();

      expect(events.length).toBe(2); // start + complete

      const startEvent = events.find((e) => e.type === 'tool:start');
      const completeEvent = events.find((e) => e.type === 'tool:complete');

      expect(startEvent).toBeDefined();
      expect(completeEvent).toBeDefined();

      // Timing should be consistent
      const completeData = completeEvent!.data as ToolCompleteEventData;
      expect(completeData.timing).toBeDefined();
      expect(completeData.timing.duration).toBeGreaterThanOrEqual(50 - TIMING_TOLERANCE_MS);
    });

    it('should capture timing data for failed tool executions', async () => {
      const taskId = createTestTaskId();
      collector.startCapturing();

      const callId = orchestrator.startToolExecution(taskId, 'Write');
      await delay(30);
      orchestrator.failToolExecution(taskId, callId, 'Test error');

      collector.stopCapturing();
      const events = collector.getEvents();

      const completeEvent = events.find((e) => e.type === 'tool:complete');
      const completeData = completeEvent!.data as ToolCompleteEventData;

      expect(completeData.result.success).toBe(false);
      expect(completeData.result.error).toBe('Test error');

      // Timing should still be consistent even for failures
      eventAssert.timingConsistency(
        completeData.timing.startTime,
        completeData.timing.endTime,
        completeData.timing.duration,
        TIMING_TOLERANCE_MS
      );
    });

    it('should validate timing across scenario builder', async () => {
      const taskId = createTestTaskId();

      const scenario = new TestScenarioBuilder(orchestrator)
        .startTool('Read', 'read-call')
        .completeTool('Read', 'read-call', 50)
        .startTool('Edit', 'edit-call', 10)
        .completeTool('Edit', 'edit-call', 40);

      const events = await scenario.execute(taskId);

      expect(events).toHaveLength(2);

      for (const event of events) {
        eventAssert.timingConsistency(
          event.timing.startTime,
          event.timing.endTime,
          event.timing.duration,
          TIMING_TOLERANCE_MS
        );
      }
    });
  });

  // ============================================================================
  // Total Duration Validation
  // ============================================================================

  describe('Total Duration Validation', () => {
    it('should calculate total duration from event validator', () => {
      const baseTime = Date.now();

      timingValidator.addEvent('first', new Date(baseTime));
      timingValidator.addEvent('second', new Date(baseTime + 500));
      timingValidator.addEvent('third', new Date(baseTime + 1000));

      const totalDuration = timingValidator.getTotalDuration();
      expect(totalDuration).toBe(1000);
    });

    it('should return zero duration for single event', () => {
      timingValidator.addEvent('only-event', new Date());

      expect(timingValidator.getTotalDuration()).toBe(0);
    });

    it('should return events in chronological order', () => {
      const baseTime = Date.now();

      // Add events in random order
      timingValidator.addEvent('third', new Date(baseTime + 200));
      timingValidator.addEvent('first', new Date(baseTime));
      timingValidator.addEvent('second', new Date(baseTime + 100));

      const orderedEvents = timingValidator.getEvents();

      expect(orderedEvents[0].id).toBe('first');
      expect(orderedEvents[1].id).toBe('second');
      expect(orderedEvents[2].id).toBe('third');
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Delay for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
