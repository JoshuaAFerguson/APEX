/**
 * Event Timing Consistency Tests
 *
 * Comprehensive tests for validating timing consistency across different
 * event types (tool events, task events, approval events).
 *
 * These tests ensure:
 * 1. Intra-event timing consistency (startTime <= endTime, duration calculated correctly)
 * 2. Inter-event timing consistency (events follow logical time ordering)
 * 3. Cross-type timing consistency (related events have coherent timing)
 * 4. Timing data integrity (survives serialization/deserialization)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  assertTimingConsistency,
  assertEventOrdering,
  assertNestedTiming,
  assertDurationBounds,
  EventTimingValidator,
  createEventSequence,
  compareTimestamps,
  calculateOverlap,
  isWithinRange,
  validateTimingSerializationRoundTrip,
  validateISOTimestamp,
  TIMING_TOLERANCE_MS,
  type TimingData,
} from './shared/timing-consistency-utils';
import {
  createToolStartEvent,
  createToolProgressEvent,
  createToolCompleteEvent,
  createTaskCreatedEvent,
  createTaskStartedEvent,
  createTaskStageChangedEvent,
  createTaskCompletedEvent,
  createTaskPausedEvent,
  createApprovalRequiredEvent,
  createApprovalResolvedEvent,
} from './shared/mock-event-generators';
import { generateTestId, createTestTimestamp } from './shared/event-test-utils';

describe('Event Timing Consistency', () => {
  describe('Core Timing Assertions', () => {
    describe('assertTimingConsistency', () => {
      it('should pass for valid timing data', () => {
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + 100);
        const timing: TimingData = {
          startTime,
          endTime,
          duration: 100,
        };

        expect(() => assertTimingConsistency(timing)).not.toThrow();
      });

      it('should pass for zero duration (instant events)', () => {
        const now = new Date();
        const timing: TimingData = {
          startTime: now,
          endTime: now,
          duration: 0,
        };

        expect(() => assertTimingConsistency(timing)).not.toThrow();
      });

      it('should pass for timing with tolerance', () => {
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + 100);
        const timing: TimingData = {
          startTime,
          endTime,
          duration: 102, // Slightly off due to timing variance
        };

        expect(() => assertTimingConsistency(timing, 10)).not.toThrow();
      });

      it('should handle very long durations', () => {
        const startTime = new Date(Date.now() - 3600000); // 1 hour ago
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        const timing: TimingData = { startTime, endTime, duration };

        expect(() => assertTimingConsistency(timing)).not.toThrow();
      });
    });

    describe('assertEventOrdering', () => {
      it('should pass when earlier event precedes later event', () => {
        const earlier = { timestamp: new Date(Date.now() - 100) };
        const later = { timestamp: new Date() };

        expect(() => assertEventOrdering(earlier, later)).not.toThrow();
      });

      it('should pass for equal timestamps when allowed', () => {
        const now = new Date();
        const event1 = { timestamp: now };
        const event2 = { timestamp: now };

        expect(() => assertEventOrdering(event1, event2, true)).not.toThrow();
      });
    });

    describe('assertNestedTiming', () => {
      it('should pass when child is within parent bounds', () => {
        const parent = {
          startTime: new Date(Date.now() - 1000),
          endTime: new Date(),
        };
        const child = {
          startTime: new Date(Date.now() - 500),
          endTime: new Date(Date.now() - 100),
        };

        expect(() => assertNestedTiming(parent, child)).not.toThrow();
      });

      it('should pass for exact boundary alignment', () => {
        const now = Date.now();
        const parent = {
          startTime: new Date(now - 1000),
          endTime: new Date(now),
        };
        const child = {
          startTime: new Date(now - 1000),
          endTime: new Date(now),
        };

        expect(() => assertNestedTiming(parent, child)).not.toThrow();
      });
    });

    describe('assertDurationBounds', () => {
      it('should pass for duration within bounds', () => {
        expect(() => assertDurationBounds(100, 50, 150)).not.toThrow();
      });

      it('should pass for exact boundary values', () => {
        expect(() => assertDurationBounds(100, 100, 100, 0)).not.toThrow();
      });

      it('should pass with only minimum bound', () => {
        expect(() => assertDurationBounds(100, 50, undefined)).not.toThrow();
      });

      it('should pass with only maximum bound', () => {
        expect(() => assertDurationBounds(100, undefined, 150)).not.toThrow();
      });
    });
  });

  describe('Tool Event Timing Consistency', () => {
    it('should have tool:start timestamp before tool:complete timestamp', () => {
      const taskId = generateTestId('task');
      const callId = generateTestId('call');

      const baseTime = Date.now();
      const startEvent = createToolStartEvent(taskId, 'Read', {
        callId,
        timestamp: new Date(baseTime),
      });
      const completeEvent = createToolCompleteEvent(taskId, 'Read', callId, {
        timestamp: new Date(baseTime + 100),
        timing: {
          startTime: new Date(baseTime),
          endTime: new Date(baseTime + 100),
          duration: 100,
        },
      });

      assertEventOrdering(startEvent, completeEvent);
    });

    it('should have consistent timing in tool:complete event', () => {
      const event = createToolCompleteEvent();

      assertTimingConsistency(event.timing);
    });

    it('should have tool:progress events between tool:start and tool:complete', () => {
      const taskId = generateTestId('task');
      const callId = generateTestId('call');
      const baseTime = Date.now();

      const startEvent = createToolStartEvent(taskId, 'WebFetch', {
        callId,
        timestamp: new Date(baseTime),
      });

      const progressEvent = createToolProgressEvent(taskId, 'WebFetch', callId, {
        timestamp: new Date(baseTime + 50),
      });

      const completeEvent = createToolCompleteEvent(taskId, 'WebFetch', callId, {
        timestamp: new Date(baseTime + 100),
        timing: {
          startTime: new Date(baseTime),
          endTime: new Date(baseTime + 100),
          duration: 100,
        },
      });

      assertEventOrdering(startEvent, progressEvent);
      assertEventOrdering(progressEvent, completeEvent);
    });

    it('should have independent timing for concurrent tool executions', () => {
      const taskId = generateTestId('task');
      const baseTime = Date.now();

      // Tool 1: starts first, completes last
      const tool1Start = createToolStartEvent(taskId, 'Read', {
        callId: 'call-1',
        timestamp: new Date(baseTime),
      });
      const tool1Complete = createToolCompleteEvent(taskId, 'Read', 'call-1', {
        timestamp: new Date(baseTime + 200),
        timing: {
          startTime: new Date(baseTime),
          endTime: new Date(baseTime + 200),
          duration: 200,
        },
      });

      // Tool 2: starts second, completes first
      const tool2Start = createToolStartEvent(taskId, 'Grep', {
        callId: 'call-2',
        timestamp: new Date(baseTime + 10),
      });
      const tool2Complete = createToolCompleteEvent(taskId, 'Grep', 'call-2', {
        timestamp: new Date(baseTime + 100),
        timing: {
          startTime: new Date(baseTime + 10),
          endTime: new Date(baseTime + 100),
          duration: 90,
        },
      });

      // Each tool's timing should be internally consistent
      assertTimingConsistency(tool1Complete.timing);
      assertTimingConsistency(tool2Complete.timing);

      // Tool 2 completed before Tool 1 (valid for concurrent execution)
      expect(tool2Complete.timestamp.getTime()).toBeLessThan(
        tool1Complete.timestamp.getTime()
      );
    });

    it('should have same timing integrity for failed tools as successful tools', () => {
      const successEvent = createToolCompleteEvent('task-1', 'Read', 'call-1', {
        result: { success: true, output: 'content' },
      });

      const failureEvent = createToolCompleteEvent('task-1', 'Read', 'call-2', {
        result: { success: false, error: 'File not found' },
      });

      // Both should have valid timing data
      assertTimingConsistency(successEvent.timing);
      assertTimingConsistency(failureEvent.timing);
    });
  });

  describe('Task Event Timing Consistency', () => {
    it('should have task:created timestamp before task:started timestamp', () => {
      const taskId = generateTestId('task');
      const baseTime = Date.now();

      const createdEvent = createTaskCreatedEvent({
        taskId,
        timestamp: new Date(baseTime),
      });
      const startedEvent = createTaskStartedEvent(taskId, {
        timestamp: new Date(baseTime + 10),
      });

      assertEventOrdering(createdEvent, startedEvent);
    });

    it('should have task:started timestamp before task:completed timestamp', () => {
      const taskId = generateTestId('task');
      const baseTime = Date.now();

      const startedEvent = createTaskStartedEvent(taskId, {
        timestamp: new Date(baseTime),
      });
      const completedEvent = createTaskCompletedEvent(taskId, {
        timestamp: new Date(baseTime + 1000),
        duration: 1000,
      });

      assertEventOrdering(startedEvent, completedEvent);
    });

    it('should have task:stage-changed events with progressive timestamps', () => {
      const taskId = generateTestId('task');
      const baseTime = Date.now();

      const stages = ['planning', 'architecture', 'implementation', 'testing'];
      const stageChangeEvents = stages.slice(1).map((newStage, index) =>
        createTaskStageChangedEvent(taskId, stages[index], newStage, {
          timestamp: new Date(baseTime + (index + 1) * 100),
        })
      );

      for (let i = 1; i < stageChangeEvents.length; i++) {
        assertEventOrdering(stageChangeEvents[i - 1], stageChangeEvents[i]);
      }
    });

    it('should have valid pausedAt timestamp in task:paused events', () => {
      const pausedEvent = createTaskPausedEvent();

      expect(pausedEvent.pausedAt).toBeInstanceOf(Date);
      expect(pausedEvent.pausedAt.toString()).not.toBe('Invalid Date');
      expect(pausedEvent.pausedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should have nested tool events within task time bounds', () => {
      const taskId = generateTestId('task');
      const baseTime = Date.now();

      // Task time span
      const taskStart = new Date(baseTime);
      const taskEnd = new Date(baseTime + 1000);

      // Tool execution within task
      const toolTiming = {
        startTime: new Date(baseTime + 100),
        endTime: new Date(baseTime + 500),
      };

      assertNestedTiming(
        { startTime: taskStart, endTime: taskEnd },
        toolTiming
      );
    });
  });

  describe('Approval Event Timing Consistency', () => {
    it('should have approval-required requestedAt before approval-resolved resolvedAt', () => {
      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');
      const baseTime = Date.now();

      const requiredEvent = createApprovalRequiredEvent(taskId, {
        approvalId,
        requestedAt: new Date(baseTime),
      });

      const resolvedEvent = createApprovalResolvedEvent(approvalId, taskId, 'approved', {
        resolvedAt: new Date(baseTime + 60000), // 1 minute later
      });

      expect(requiredEvent.requestedAt!.getTime()).toBeLessThan(
        resolvedEvent.resolvedAt!.getTime()
      );
    });

    it('should have timeout resolutions after requestedAt + timeoutMinutes', () => {
      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');
      const baseTime = Date.now();
      const timeoutMinutes = 5;

      const requiredEvent = createApprovalRequiredEvent(taskId, {
        approvalId,
        requestedAt: new Date(baseTime),
        timeoutMinutes,
      });

      const timeoutEvent = createApprovalResolvedEvent(approvalId, taskId, 'timeout', {
        resolvedAt: new Date(baseTime + timeoutMinutes * 60 * 1000),
      });

      const expectedTimeoutTime = requiredEvent.requestedAt!.getTime() + timeoutMinutes * 60 * 1000;
      expect(timeoutEvent.resolvedAt!.getTime()).toBeGreaterThanOrEqual(
        expectedTimeoutTime - TIMING_TOLERANCE_MS
      );
    });

    it('should have approval events within parent task time bounds', () => {
      const baseTime = Date.now();

      // Task bounds
      const taskBounds = {
        startTime: new Date(baseTime),
        endTime: new Date(baseTime + 300000), // 5 minutes
      };

      // Approval within task
      const approvalBounds = {
        startTime: new Date(baseTime + 60000), // 1 minute in
        endTime: new Date(baseTime + 120000), // 2 minutes in
      };

      assertNestedTiming(taskBounds, approvalBounds);
    });
  });

  describe('Cross-Event Type Timing', () => {
    it('should have tool events within task bounded by task timestamps', () => {
      const sequence = createEventSequence({
        taskDuration: 1000,
        toolCount: 3,
        toolDuration: 100,
      });

      const taskCreated = sequence.events.find((e) => e.type === 'task:created');
      const taskCompleted = sequence.events.find((e) => e.type === 'task:completed');
      const toolEvents = sequence.events.filter((e) => e.type.startsWith('tool:'));

      // All tool events should be within task bounds
      toolEvents.forEach((toolEvent) => {
        expect(toolEvent.timestamp.getTime()).toBeGreaterThanOrEqual(
          taskCreated!.timestamp.getTime() - TIMING_TOLERANCE_MS
        );
        expect(toolEvent.timestamp.getTime()).toBeLessThanOrEqual(
          taskCompleted!.timestamp.getTime() + TIMING_TOLERANCE_MS
        );
      });
    });

    it('should have stage transitions with matching tool event timings', () => {
      const sequence = createEventSequence({
        taskDuration: 1000,
        toolCount: 2,
        toolDuration: 100,
      });

      const validator = new EventTimingValidator();

      sequence.events.forEach((event) => {
        validator.addEvent(event.type, event.timestamp, event.data);
      });

      const result = validator.validateOrdering();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle event sequences with approvals', () => {
      const sequence = createEventSequence({
        taskDuration: 2000,
        toolCount: 2,
        toolDuration: 100,
        includeApproval: true,
      });

      const validator = new EventTimingValidator();

      sequence.events.forEach((event) => {
        validator.addEvent(event.type, event.timestamp, event.data);
      });

      const result = validator.validateOrdering();
      expect(result.isValid).toBe(true);

      // Verify approval events exist and are in order
      const approvalRequired = sequence.events.find(
        (e) => e.type === 'approval-required'
      );
      const approvalResolved = sequence.events.find(
        (e) => e.type === 'approval-resolved'
      );

      expect(approvalRequired).toBeDefined();
      expect(approvalResolved).toBeDefined();
      expect(approvalRequired!.timestamp.getTime()).toBeLessThan(
        approvalResolved!.timestamp.getTime()
      );
    });
  });

  describe('EventTimingValidator', () => {
    let validator: EventTimingValidator;

    beforeEach(() => {
      validator = new EventTimingValidator();
    });

    it('should validate correct event ordering', () => {
      const baseTime = Date.now();

      validator.addEvent('task:created', new Date(baseTime));
      validator.addEvent('task:started', new Date(baseTime + 10));
      validator.addEvent('tool:start', new Date(baseTime + 20));
      validator.addEvent('tool:complete', new Date(baseTime + 100));
      validator.addEvent('task:completed', new Date(baseTime + 110));

      const result = validator.validateOrdering();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect ordering violations', () => {
      const baseTime = Date.now();

      validator.addEvent('task:started', new Date(baseTime + 100)); // Later
      validator.addEvent('task:created', new Date(baseTime)); // Earlier - wrong order

      const result = validator.validateOrdering();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about large time gaps', () => {
      const baseTime = Date.now();

      validator.addEvent('task:created', new Date(baseTime));
      validator.addEvent('task:started', new Date(baseTime + 10));
      validator.addEvent('task:completed', new Date(baseTime + 100000)); // 100 seconds later

      const result = validator.validateNoGaps(1000);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should calculate total duration correctly', () => {
      const baseTime = Date.now();
      const duration = 1000;

      validator.addEvent('start', new Date(baseTime));
      validator.addEvent('end', new Date(baseTime + duration));

      expect(validator.getTotalDuration()).toBe(duration);
    });
  });

  describe('Timing Data Serialization', () => {
    it('should survive JSON round-trip with Date objects', () => {
      const timing: TimingData = {
        startTime: new Date(),
        endTime: new Date(Date.now() + 100),
        duration: 100,
      };

      const result = validateTimingSerializationRoundTrip(timing);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should preserve duration values exactly', () => {
      const preciseValue = 123.456789;
      const timing: TimingData = {
        startTime: new Date(),
        endTime: new Date(),
        duration: preciseValue,
      };

      const result = validateTimingSerializationRoundTrip(timing);
      expect(result.deserialized.duration).toBe(preciseValue);
    });

    it('should parse ISO 8601 timestamps correctly', () => {
      const isoStrings = [
        '2024-01-15T10:30:00.000Z',
        '2024-06-30T23:59:59.999Z',
        '2024-12-25T00:00:00.000Z',
      ];

      isoStrings.forEach((iso) => {
        const result = validateISOTimestamp(iso);
        expect(result.isValid).toBe(true);
        expect(result.parsedDate).toBeInstanceOf(Date);
      });
    });

    it('should reject invalid ISO timestamps', () => {
      const invalidStrings = [
        'not-a-date',
        '2024-13-01T00:00:00.000Z', // Invalid month
        '',
      ];

      invalidStrings.forEach((invalid) => {
        const result = validateISOTimestamp(invalid);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Timing Comparison Helpers', () => {
    it('should compare timestamps correctly', () => {
      const earlier = new Date(Date.now() - 100);
      const later = new Date();

      expect(compareTimestamps(earlier, later)).toBe('before');
      expect(compareTimestamps(later, earlier)).toBe('after');
      expect(compareTimestamps(later, later)).toBe('equal');
    });

    it('should calculate overlap between time ranges', () => {
      const range1 = {
        start: new Date(0),
        end: new Date(100),
      };
      const range2 = {
        start: new Date(50),
        end: new Date(150),
      };

      expect(calculateOverlap(range1, range2)).toBe(50);
    });

    it('should return zero for non-overlapping ranges', () => {
      const range1 = {
        start: new Date(0),
        end: new Date(100),
      };
      const range2 = {
        start: new Date(200),
        end: new Date(300),
      };

      expect(calculateOverlap(range1, range2)).toBe(0);
    });

    it('should check if timestamp is within range', () => {
      const range = {
        start: new Date(0),
        end: new Date(100),
      };

      expect(isWithinRange(new Date(50), range)).toBe(true);
      expect(isWithinRange(new Date(0), range)).toBe(true);
      expect(isWithinRange(new Date(100), range)).toBe(true);
      expect(isWithinRange(new Date(200), range)).toBe(false);
    });
  });

  describe('Event Sequence Generation', () => {
    it('should create valid event sequences', () => {
      const sequence = createEventSequence({
        taskDuration: 1000,
        toolCount: 3,
      });

      expect(sequence.events.length).toBeGreaterThan(0);
      expect(sequence.taskId).toMatch(/^task-/);
      expect(sequence.totalDuration).toBeGreaterThan(0);
    });

    it('should include progress events when requested', () => {
      const sequence = createEventSequence({
        taskDuration: 1000,
        toolCount: 2,
        includeProgress: true,
      });

      const progressEvents = sequence.events.filter(
        (e) => e.type === 'tool:progress'
      );
      expect(progressEvents.length).toBe(2);
    });

    it('should include approval events when requested', () => {
      const sequence = createEventSequence({
        taskDuration: 2000,
        toolCount: 1,
        includeApproval: true,
      });

      const approvalRequired = sequence.events.find(
        (e) => e.type === 'approval-required'
      );
      const approvalResolved = sequence.events.find(
        (e) => e.type === 'approval-resolved'
      );

      expect(approvalRequired).toBeDefined();
      expect(approvalResolved).toBeDefined();
    });

    it('should generate properly ordered events', () => {
      const sequence = createEventSequence({
        taskDuration: 1000,
        toolCount: 2,
        includeApproval: true,
        includeProgress: true,
      });

      // Verify all events are in chronological order
      for (let i = 1; i < sequence.events.length; i++) {
        expect(sequence.events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          sequence.events[i - 1].timestamp.getTime()
        );
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with identical timestamps', () => {
      const now = new Date();
      const event1 = { timestamp: now };
      const event2 = { timestamp: now };

      // Should pass with allowEqual = true
      expect(() => assertEventOrdering(event1, event2, true)).not.toThrow();
    });

    it('should handle very short durations (sub-millisecond precision)', () => {
      const now = new Date();
      const timing: TimingData = {
        startTime: now,
        endTime: now,
        duration: 0,
      };

      expect(() => assertTimingConsistency(timing)).not.toThrow();
    });

    it('should handle timing at epoch (Date 0)', () => {
      const epoch = new Date(0);
      const timing: TimingData = {
        startTime: epoch,
        endTime: new Date(100),
        duration: 100,
      };

      expect(() => assertTimingConsistency(timing)).not.toThrow();
    });

    it('should handle very large durations', () => {
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      const startTime = new Date(Date.now() - oneYearMs);
      const endTime = new Date();
      const timing: TimingData = {
        startTime,
        endTime,
        duration: oneYearMs,
      };

      expect(() => assertTimingConsistency(timing, 1000)).not.toThrow();
    });
  });
});
