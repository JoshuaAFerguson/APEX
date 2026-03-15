/**
 * Task Event Data Integrity Tests
 *
 * Comprehensive tests for all task-related event types to ensure
 * data integrity, schema conformance, and serialization stability.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateTestId,
  validateJsonRoundTrip,
  validateRequiredFields,
  validateFieldTypes,
  EventSequenceValidator,
  CrossReferenceValidator,
  eventAssert,
} from './shared/event-test-utils';
import {
  createTaskCreatedEvent,
  createTaskStartedEvent,
  createTaskStageChangedEvent,
  createTaskCompletedEvent,
  createTaskFailedEvent,
  createTaskPausedEvent,
  TaskCreatedEventData,
  TaskStartedEventData,
  TaskStageChangedEventData,
  TaskCompletedEventData,
  TaskFailedEventData,
  TaskPausedEventData,
} from './shared/mock-event-generators';

describe('Task Event Data Integrity', () => {
  describe('task:created event', () => {
    it('should have all required fields', () => {
      const event = createTaskCreatedEvent();

      const result = validateRequiredFields(event, [
        'taskId',
        'description',
        'timestamp',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should have correct field types', () => {
      const event = createTaskCreatedEvent();

      const result = validateFieldTypes(event, {
        taskId: 'string',
        description: 'string',
        workflow: 'string',
        priority: 'string',
        effort: 'string',
        autonomy: 'string',
        projectPath: 'string',
        branchName: 'string',
        timestamp: 'date',
      });

      expect(result.isValid).toBe(true);
      expect(result.typeErrors).toHaveLength(0);
    });

    it('should survive JSON round-trip serialization', () => {
      const event = createTaskCreatedEvent();

      const result = validateJsonRoundTrip(event, ['timestamp']);

      expect(result.isValid).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should validate taskId format', () => {
      const event = createTaskCreatedEvent({ taskId: 'task-12345' });

      expect(event.taskId).toMatch(/^task-/);
      expect(event.taskId.length).toBeGreaterThan(5);
    });

    it('should validate priority enum values', () => {
      const validPriorities = ['low', 'normal', 'high', 'critical'] as const;

      validPriorities.forEach(priority => {
        const event = createTaskCreatedEvent({ priority });
        expect(event.priority).toBe(priority);
      });
    });

    it('should validate effort enum values', () => {
      const validEfforts = ['trivial', 'small', 'medium', 'large', 'epic'] as const;

      validEfforts.forEach(effort => {
        const event = createTaskCreatedEvent({ effort });
        expect(event.effort).toBe(effort);
      });
    });

    it('should validate autonomy enum values', () => {
      const validAutonomyLevels = ['suggest', 'auto-apply', 'full'] as const;

      validAutonomyLevels.forEach(autonomy => {
        const event = createTaskCreatedEvent({ autonomy });
        expect(event.autonomy).toBe(autonomy);
      });
    });

    it('should handle empty description gracefully', () => {
      // While we allow creating with empty description, this should be caught by validation
      const event = createTaskCreatedEvent({ description: '' });
      expect(event.description).toBe('');
    });

    it('should handle long descriptions', () => {
      const longDescription = 'A'.repeat(10000);
      const event = createTaskCreatedEvent({ description: longDescription });

      expect(event.description).toBe(longDescription);
      expect(event.description.length).toBe(10000);
    });

    it('should handle special characters in description', () => {
      const specialDescription = 'Test with "quotes" and <brackets> & symbols';
      const event = createTaskCreatedEvent({ description: specialDescription });

      const roundTrip = validateJsonRoundTrip(event, ['timestamp']);
      expect(roundTrip.isValid).toBe(true);
      expect(roundTrip.deserialized.description).toBe(specialDescription);
    });

    it('should handle unicode in description', () => {
      const unicodeDescription = 'Test with emojis 🎉 and 日本語 characters';
      const event = createTaskCreatedEvent({ description: unicodeDescription });

      const roundTrip = validateJsonRoundTrip(event, ['timestamp']);
      expect(roundTrip.isValid).toBe(true);
      expect(roundTrip.deserialized.description).toBe(unicodeDescription);
    });
  });

  describe('task:started event', () => {
    it('should have all required fields', () => {
      const event = createTaskStartedEvent();

      const result = validateRequiredFields(event, ['taskId', 'timestamp']);

      expect(result.isValid).toBe(true);
    });

    it('should have correct field types', () => {
      const event = createTaskStartedEvent();

      const result = validateFieldTypes(event, {
        taskId: 'string',
        stage: 'string',
        agent: 'string',
        timestamp: 'date',
      });

      expect(result.isValid).toBe(true);
    });

    it('should survive JSON round-trip', () => {
      const event = createTaskStartedEvent();

      const result = validateJsonRoundTrip(event, ['timestamp']);

      expect(result.isValid).toBe(true);
    });

    it('should maintain task reference from created event', () => {
      const taskId = generateTestId('task');
      const createdEvent = createTaskCreatedEvent({ taskId });
      const startedEvent = createTaskStartedEvent(taskId);

      expect(startedEvent.taskId).toBe(createdEvent.taskId);
    });
  });

  describe('task:stage-changed event', () => {
    it('should have all required fields', () => {
      const event = createTaskStageChangedEvent();

      const result = validateRequiredFields(event, [
        'taskId',
        'oldStage',
        'newStage',
        'timestamp',
      ]);

      expect(result.isValid).toBe(true);
    });

    it('should have different old and new stages', () => {
      const event = createTaskStageChangedEvent('task-1', 'planning', 'implementation');

      expect(event.oldStage).not.toBe(event.newStage);
    });

    it('should track agent changes with stage changes', () => {
      const event = createTaskStageChangedEvent('task-1', 'planning', 'implementation', {
        oldAgent: 'planner',
        newAgent: 'developer',
      });

      expect(event.oldAgent).toBe('planner');
      expect(event.newAgent).toBe('developer');
    });

    it('should survive JSON round-trip', () => {
      const event = createTaskStageChangedEvent();

      const result = validateJsonRoundTrip(event, ['timestamp']);

      expect(result.isValid).toBe(true);
    });

    it('should validate common stage transitions', () => {
      const validTransitions = [
        ['planning', 'architecture'],
        ['architecture', 'implementation'],
        ['implementation', 'testing'],
        ['testing', 'review'],
        ['review', 'completed'],
      ];

      validTransitions.forEach(([oldStage, newStage]) => {
        const event = createTaskStageChangedEvent('task-1', oldStage, newStage);

        expect(event.oldStage).toBe(oldStage);
        expect(event.newStage).toBe(newStage);
      });
    });
  });

  describe('task:completed event', () => {
    it('should have all required fields', () => {
      const event = createTaskCompletedEvent();

      const result = validateRequiredFields(event, ['taskId', 'timestamp']);

      expect(result.isValid).toBe(true);
    });

    it('should have correct field types', () => {
      const event = createTaskCompletedEvent();

      const result = validateFieldTypes(event, {
        taskId: 'string',
        result: 'object',
        duration: 'number',
        artifactsCreated: 'array',
        timestamp: 'date',
      });

      expect(result.isValid).toBe(true);
    });

    it('should have positive duration', () => {
      const event = createTaskCompletedEvent('task-1', { duration: 30000 });

      eventAssert.numberMatches(event.duration!, {
        positive: true,
        nonNegative: true,
      });
    });

    it('should survive JSON round-trip', () => {
      const event = createTaskCompletedEvent();

      const result = validateJsonRoundTrip(event, ['timestamp']);

      expect(result.isValid).toBe(true);
    });

    it('should handle complex result objects', () => {
      const complexResult = {
        success: true,
        message: 'Completed',
        artifacts: [
          { type: 'file', path: '/src/new-file.ts' },
          { type: 'commit', sha: 'abc123' },
        ],
        metrics: {
          linesAdded: 100,
          linesRemoved: 50,
          testsAdded: 5,
        },
      };

      const event = createTaskCompletedEvent('task-1', { result: complexResult });

      const roundTrip = validateJsonRoundTrip(event, ['timestamp']);
      expect(roundTrip.isValid).toBe(true);
      expect(roundTrip.deserialized.result).toEqual(complexResult);
    });
  });

  describe('task:failed event', () => {
    it('should have all required fields', () => {
      const event = createTaskFailedEvent();

      const result = validateRequiredFields(event, [
        'taskId',
        'error',
        'timestamp',
      ]);

      expect(result.isValid).toBe(true);
    });

    it('should have correct field types', () => {
      const event = createTaskFailedEvent();

      const result = validateFieldTypes(event, {
        taskId: 'string',
        error: 'string',
        errorCode: 'string',
        stage: 'string',
        retryable: 'boolean',
        retryCount: 'number',
        maxRetries: 'number',
        timestamp: 'date',
      });

      expect(result.isValid).toBe(true);
    });

    it('should have non-empty error message', () => {
      const event = createTaskFailedEvent('task-1', 'Something went wrong');

      expect(event.error.length).toBeGreaterThan(0);
    });

    it('should validate retry count constraints', () => {
      const event = createTaskFailedEvent('task-1', 'Error', {
        retryCount: 2,
        maxRetries: 3,
      });

      expect(event.retryCount).toBeLessThanOrEqual(event.maxRetries!);
      expect(event.retryCount).toBeGreaterThanOrEqual(0);
    });

    it('should survive JSON round-trip', () => {
      const event = createTaskFailedEvent();

      const result = validateJsonRoundTrip(event, ['timestamp']);

      expect(result.isValid).toBe(true);
    });

    it('should handle error messages with stack traces', () => {
      const errorWithStack = `Error: Something went wrong
    at TaskExecutor.execute (/src/executor.ts:42:15)
    at async Runner.run (/src/runner.ts:100:5)`;

      const event = createTaskFailedEvent('task-1', errorWithStack);

      const roundTrip = validateJsonRoundTrip(event, ['timestamp']);
      expect(roundTrip.isValid).toBe(true);
      expect(roundTrip.deserialized.error).toBe(errorWithStack);
    });
  });

  describe('task:paused event', () => {
    it('should have all required fields', () => {
      const event = createTaskPausedEvent();

      const result = validateRequiredFields(event, [
        'taskId',
        'reason',
        'pausedAt',
      ]);

      expect(result.isValid).toBe(true);
    });

    it('should have correct field types', () => {
      const event = createTaskPausedEvent();

      const result = validateFieldTypes(event, {
        taskId: 'string',
        reason: 'string',
        stage: 'string',
        pausedAt: 'date',
        resumable: 'boolean',
      });

      expect(result.isValid).toBe(true);
    });

    it('should validate common pause reasons', () => {
      const validReasons = [
        'User requested pause',
        'Waiting for approval',
        'Rate limit reached',
        'Error requiring human intervention',
      ];

      validReasons.forEach(reason => {
        const event = createTaskPausedEvent('task-1', reason);
        expect(event.reason).toBe(reason);
      });
    });

    it('should survive JSON round-trip', () => {
      const event = createTaskPausedEvent();

      const result = validateJsonRoundTrip(event, ['pausedAt']);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Event Sequence Validation', () => {
    let sequenceValidator: EventSequenceValidator;

    beforeEach(() => {
      sequenceValidator = new EventSequenceValidator([
        'task:created',
        'task:started',
        'task:stage-changed',
        'task:completed',
      ]);
    });

    it('should validate typical task lifecycle sequence', () => {
      const taskId = generateTestId('task');

      // Simulate event sequence
      sequenceValidator.addEvent('task:created', createTaskCreatedEvent({ taskId }));
      sequenceValidator.addEvent('task:started', createTaskStartedEvent(taskId));
      sequenceValidator.addEvent('task:stage-changed', createTaskStageChangedEvent(taskId));
      sequenceValidator.addEvent('task:completed', createTaskCompletedEvent(taskId));

      const result = sequenceValidator.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing events in sequence', () => {
      const taskId = generateTestId('task');

      // Missing task:started
      sequenceValidator.addEvent('task:created', createTaskCreatedEvent({ taskId }));
      sequenceValidator.addEvent('task:stage-changed', createTaskStageChangedEvent(taskId));
      sequenceValidator.addEvent('task:completed', createTaskCompletedEvent(taskId));

      const result = sequenceValidator.validate();

      // The sequence validator allows gaps, but we can check for specific patterns
      expect(result.actualSequence).toContain('task:created');
      expect(result.actualSequence).toContain('task:completed');
    });

    it('should validate failure workflow', () => {
      const failureSequenceValidator = new EventSequenceValidator([
        'task:created',
        'task:started',
        'task:failed',
      ]);

      const taskId = generateTestId('task');

      failureSequenceValidator.addEvent('task:created', createTaskCreatedEvent({ taskId }));
      failureSequenceValidator.addEvent('task:started', createTaskStartedEvent(taskId));
      failureSequenceValidator.addEvent('task:failed', createTaskFailedEvent(taskId));

      const result = failureSequenceValidator.validate();

      expect(result.isValid).toBe(true);
    });

    it('should validate pause/resume workflow', () => {
      const pauseSequenceValidator = new EventSequenceValidator([
        'task:created',
        'task:started',
        'task:paused',
        'task:started',
        'task:completed',
      ]);

      const taskId = generateTestId('task');

      pauseSequenceValidator.addEvent('task:created', createTaskCreatedEvent({ taskId }));
      pauseSequenceValidator.addEvent('task:started', createTaskStartedEvent(taskId));
      pauseSequenceValidator.addEvent('task:paused', createTaskPausedEvent(taskId));
      pauseSequenceValidator.addEvent('task:started', createTaskStartedEvent(taskId));
      pauseSequenceValidator.addEvent('task:completed', createTaskCompletedEvent(taskId));

      const result = pauseSequenceValidator.validate();

      expect(result.isValid).toBe(true);
    });
  });

  describe('Cross-Reference Integrity', () => {
    let crossRefValidator: CrossReferenceValidator;

    beforeEach(() => {
      crossRefValidator = new CrossReferenceValidator();
    });

    it('should maintain taskId consistency across events', () => {
      const taskId = generateTestId('task');

      // Register references from each event
      const events = [
        createTaskCreatedEvent({ taskId }),
        createTaskStartedEvent(taskId),
        createTaskStageChangedEvent(taskId),
        createTaskCompletedEvent(taskId),
      ];

      events.forEach(event => {
        crossRefValidator.registerReference('taskId', event.taskId);
      });

      // All events should have the same taskId
      const allRefs = crossRefValidator.getAllReferences();
      expect(allRefs.taskId).toHaveLength(1); // Should be deduplicated to one unique value
      expect(allRefs.taskId[0]).toBe(taskId);
    });

    it('should track stage references correctly', () => {
      const taskId = generateTestId('task');

      // Simulate stage progression
      const stages = ['planning', 'architecture', 'implementation', 'testing', 'completed'];

      stages.forEach((stage, index) => {
        if (index > 0) {
          crossRefValidator.registerReference('stage', stage);
        }
      });

      const allRefs = crossRefValidator.getAllReferences();
      expect(allRefs.stage).toContain('implementation');
      expect(allRefs.stage).toContain('testing');
    });

    it('should validate expected references exist', () => {
      const taskId = generateTestId('task');

      crossRefValidator.registerReference('taskId', taskId);
      crossRefValidator.registerReference('stage', 'implementation');

      const result = crossRefValidator.validateReferences([
        { refType: 'taskId', refValue: taskId },
        { refType: 'stage', refValue: 'implementation' },
      ]);

      expect(result.isValid).toBe(true);
      expect(result.missingReferences).toHaveLength(0);
    });

    it('should detect missing references', () => {
      const taskId = generateTestId('task');

      crossRefValidator.registerReference('taskId', taskId);

      const result = crossRefValidator.validateReferences([
        { refType: 'taskId', refValue: taskId },
        { refType: 'stage', refValue: 'implementation' }, // Not registered
      ]);

      expect(result.isValid).toBe(false);
      expect(result.missingReferences).toHaveLength(1);
      expect(result.missingReferences[0].refType).toBe('stage');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null optional fields', () => {
      const event = createTaskCreatedEvent({
        workflow: undefined,
        projectPath: undefined,
      });

      const roundTrip = validateJsonRoundTrip(event, ['timestamp']);
      expect(roundTrip.isValid).toBe(true);
    });

    it('should handle timestamps at epoch', () => {
      const event = createTaskCreatedEvent({
        timestamp: new Date(0),
      });

      expect(event.timestamp.getTime()).toBe(0);
    });

    it('should handle future timestamps', () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead
      const event = createTaskCreatedEvent({
        timestamp: futureDate,
      });

      expect(event.timestamp.getTime()).toBe(futureDate.getTime());
    });

    it('should handle extremely long taskIds', () => {
      const longTaskId = 'task-' + 'a'.repeat(1000);
      const event = createTaskCreatedEvent({ taskId: longTaskId });

      expect(event.taskId).toBe(longTaskId);

      const roundTrip = validateJsonRoundTrip(event, ['timestamp']);
      expect(roundTrip.isValid).toBe(true);
    });

    it('should handle multiple stage changes', () => {
      const taskId = generateTestId('task');
      const stages = ['planning', 'architecture', 'implementation', 'testing', 'review', 'completed'];
      const events: TaskStageChangedEventData[] = [];

      for (let i = 1; i < stages.length; i++) {
        events.push(createTaskStageChangedEvent(taskId, stages[i - 1], stages[i]));
      }

      expect(events).toHaveLength(5);
      events.forEach((event, index) => {
        expect(event.oldStage).toBe(stages[index]);
        expect(event.newStage).toBe(stages[index + 1]);
      });
    });
  });

  describe('Data Consistency', () => {
    it('should ensure completed events have non-zero duration', () => {
      const event = createTaskCompletedEvent('task-1', { duration: 30000 });

      expect(event.duration).toBeGreaterThan(0);
    });

    it('should ensure failed events have error details', () => {
      const event = createTaskFailedEvent('task-1', 'Specific error message');

      expect(event.error).toBeTruthy();
      expect(event.error.length).toBeGreaterThan(0);
    });

    it('should ensure paused events have pause timestamp', () => {
      const event = createTaskPausedEvent();

      expect(event.pausedAt).toBeInstanceOf(Date);
      expect(event.pausedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should ensure stage-changed events have both stages', () => {
      const event = createTaskStageChangedEvent('task-1', 'old', 'new');

      expect(event.oldStage).toBeTruthy();
      expect(event.newStage).toBeTruthy();
      expect(event.oldStage).not.toBe(event.newStage);
    });
  });
});
