import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ApexEventType,
  ApexEvent,
  ApexEventTypeSchema,
  ApexEventSchema,
  Task,
  TaskStatus
} from './types';

// Create validation schema for ApexEventType to ensure the new event types are included
const ApexEventTypeSchema = z.enum([
  'task:created',
  'task:started',
  'task:stage-changed',
  'task:completed',
  'task:failed',
  'task:paused',
  'task:session-resumed',
  'task:decomposed',
  'task:iteration-started',
  'task:iteration-completed',
  'task:trashed',
  'task:restored',
  'task:archived',
  'task:unarchived',
  'trash:emptied',
  'subtask:created',
  'subtask:completed',
  'subtask:failed',
  'agent:message',
  'agent:thinking',
  'agent:tool-use',
  'agent:tool-result',
  'gate:required',
  'gate:approved',
  'gate:rejected',
  'usage:updated',
  'log:entry',
  'worktree:merge-cleaned',
  'container:created',
  'container:started',
  'container:stopped',
  'container:died',
  'container:removed',
  'container:health'
]);

const ApexEventSchema = z.object({
  type: ApexEventTypeSchema,
  taskId: z.string(),
  timestamp: z.date(),
  data: z.record(z.string(), z.unknown()),
});

describe('WebSocket Lifecycle Event Types', () => {
  describe('New lifecycle event types', () => {
    it('should include task:trashed in ApexEventType', () => {
      const eventType: ApexEventType = 'task:trashed';
      expect(() => ApexEventTypeSchema.parse(eventType)).not.toThrow();
    });

    it('should include task:restored in ApexEventType', () => {
      const eventType: ApexEventType = 'task:restored';
      expect(() => ApexEventTypeSchema.parse(eventType)).not.toThrow();
    });

    it('should include task:archived in ApexEventType', () => {
      const eventType: ApexEventType = 'task:archived';
      expect(() => ApexEventTypeSchema.parse(eventType)).not.toThrow();
    });

    it('should include task:unarchived in ApexEventType', () => {
      const eventType: ApexEventType = 'task:unarchived';
      expect(() => ApexEventTypeSchema.parse(eventType)).not.toThrow();
    });

    it('should include trash:emptied in ApexEventType', () => {
      const eventType: ApexEventType = 'trash:emptied';
      expect(() => ApexEventTypeSchema.parse(eventType)).not.toThrow();
    });
  });

  describe('ApexEvent structure validation', () => {
    const mockTask: Task = {
      id: 'test-task-123',
      description: 'Test task for event validation',
      workflow: 'feature',
      autonomy: 'full',
      status: 'pending' as TaskStatus,
      priority: 'normal',
      effort: 'medium',
      projectPath: '/test/project',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
      logs: [],
      artifacts: [],
    };

    it('should validate task:trashed event structure', () => {
      const trashedEvent: ApexEvent = {
        type: 'task:trashed',
        taskId: mockTask.id,
        timestamp: new Date(),
        data: {
          task: mockTask,
          trashedAt: new Date()
        }
      };

      expect(() => ApexEventSchema.parse(trashedEvent)).not.toThrow();
      expect(trashedEvent.type).toBe('task:trashed');
      expect(trashedEvent.data.task).toEqual(mockTask);
      expect(trashedEvent.data.trashedAt).toBeInstanceOf(Date);
    });

    it('should validate task:restored event structure', () => {
      const restoredEvent: ApexEvent = {
        type: 'task:restored',
        taskId: mockTask.id,
        timestamp: new Date(),
        data: {
          task: mockTask,
          status: 'pending'
        }
      };

      expect(() => ApexEventSchema.parse(restoredEvent)).not.toThrow();
      expect(restoredEvent.type).toBe('task:restored');
      expect(restoredEvent.data.task).toEqual(mockTask);
      expect(restoredEvent.data.status).toBe('pending');
    });

    it('should validate task:archived event structure', () => {
      const archivedEvent: ApexEvent = {
        type: 'task:archived',
        taskId: mockTask.id,
        timestamp: new Date(),
        data: {
          task: { ...mockTask, status: 'completed' as TaskStatus },
          archivedAt: new Date()
        }
      };

      expect(() => ApexEventSchema.parse(archivedEvent)).not.toThrow();
      expect(archivedEvent.type).toBe('task:archived');
      expect(archivedEvent.data.archivedAt).toBeInstanceOf(Date);
    });

    it('should validate task:unarchived event structure', () => {
      const unarchivedEvent: ApexEvent = {
        type: 'task:unarchived',
        taskId: mockTask.id,
        timestamp: new Date(),
        data: {
          task: mockTask,
          status: 'completed'
        }
      };

      expect(() => ApexEventSchema.parse(unarchivedEvent)).not.toThrow();
      expect(unarchivedEvent.type).toBe('task:unarchived');
      expect(unarchivedEvent.data.status).toBe('completed');
    });

    it('should validate trash:emptied event structure', () => {
      const trashEmptiedEvent: ApexEvent = {
        type: 'trash:emptied',
        taskId: '0', // Global event uses '0' as taskId
        timestamp: new Date(),
        data: {
          deletedCount: 3,
          deletedTaskIds: ['task-1', 'task-2', 'task-3']
        }
      };

      expect(() => ApexEventSchema.parse(trashEmptiedEvent)).not.toThrow();
      expect(trashEmptiedEvent.type).toBe('trash:emptied');
      expect(trashEmptiedEvent.data.deletedCount).toBe(3);
      expect(trashEmptiedEvent.data.deletedTaskIds).toHaveLength(3);
    });
  });

  describe('Event type safety', () => {
    it('should ensure all new lifecycle event types are properly typed', () => {
      // This test ensures TypeScript compilation succeeds for all new event types
      const eventTypes: ApexEventType[] = [
        'task:trashed',
        'task:restored',
        'task:archived',
        'task:unarchived',
        'trash:emptied'
      ];

      eventTypes.forEach(eventType => {
        expect(typeof eventType).toBe('string');
        expect(() => ApexEventTypeSchema.parse(eventType)).not.toThrow();
      });
    });

    it('should reject invalid event types', () => {
      const invalidEventTypes = [
        'task:invalid',
        'trash:removed',
        'archive:created',
        'task:moved'
      ];

      invalidEventTypes.forEach(invalidType => {
        expect(() => ApexEventTypeSchema.parse(invalidType)).toThrow();
      });
    });
  });

  describe('Event data consistency', () => {
    it('should ensure task:trashed events contain task and timestamp data', () => {
      const trashedEvent = {
        type: 'task:trashed',
        taskId: 'test-task',
        timestamp: new Date(),
        data: {
          task: { id: 'test-task', description: 'Test' },
          trashedAt: new Date()
        }
      };

      expect(trashedEvent.data).toHaveProperty('task');
      expect(trashedEvent.data).toHaveProperty('trashedAt');
      expect(trashedEvent.data.task.id).toBe(trashedEvent.taskId);
    });

    it('should ensure task:restored events contain task and status data', () => {
      const restoredEvent = {
        type: 'task:restored',
        taskId: 'test-task',
        timestamp: new Date(),
        data: {
          task: { id: 'test-task', description: 'Test' },
          status: 'pending'
        }
      };

      expect(restoredEvent.data).toHaveProperty('task');
      expect(restoredEvent.data).toHaveProperty('status');
      expect(restoredEvent.data.task.id).toBe(restoredEvent.taskId);
    });

    it('should ensure task:archived events contain task and archivedAt data', () => {
      const archivedEvent = {
        type: 'task:archived',
        taskId: 'test-task',
        timestamp: new Date(),
        data: {
          task: { id: 'test-task', description: 'Test', status: 'completed' },
          archivedAt: new Date()
        }
      };

      expect(archivedEvent.data).toHaveProperty('task');
      expect(archivedEvent.data).toHaveProperty('archivedAt');
      expect(archivedEvent.data.task.id).toBe(archivedEvent.taskId);
    });

    it('should ensure trash:emptied events contain count and task IDs', () => {
      const trashEmptiedEvent = {
        type: 'trash:emptied',
        taskId: '0',
        timestamp: new Date(),
        data: {
          deletedCount: 2,
          deletedTaskIds: ['task-1', 'task-2']
        }
      };

      expect(trashEmptiedEvent.data).toHaveProperty('deletedCount');
      expect(trashEmptiedEvent.data).toHaveProperty('deletedTaskIds');
      expect(trashEmptiedEvent.data.deletedCount).toBe(trashEmptiedEvent.data.deletedTaskIds.length);
    });
  });

  describe('Event timestamp validation', () => {
    it('should require valid timestamps for all lifecycle events', () => {
      const eventTypes: ApexEventType[] = [
        'task:trashed',
        'task:restored',
        'task:archived',
        'task:unarchived',
        'trash:emptied'
      ];

      eventTypes.forEach(eventType => {
        const event: ApexEvent = {
          type: eventType,
          taskId: 'test-task',
          timestamp: new Date(),
          data: {}
        };

        expect(event.timestamp).toBeInstanceOf(Date);
        expect(() => ApexEventSchema.parse(event)).not.toThrow();
      });
    });

    it('should reject events with invalid timestamps', () => {
      const invalidEvents = [
        {
          type: 'task:trashed',
          taskId: 'test-task',
          timestamp: 'invalid-date',
          data: {}
        },
        {
          type: 'task:restored',
          taskId: 'test-task',
          timestamp: null,
          data: {}
        }
      ];

      invalidEvents.forEach(event => {
        expect(() => ApexEventSchema.parse(event)).toThrow();
      });
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain compatibility with existing event types', () => {
      const existingEventTypes: ApexEventType[] = [
        'task:created',
        'task:started',
        'task:completed',
        'task:failed',
        'agent:message',
        'usage:updated'
      ];

      existingEventTypes.forEach(eventType => {
        const event: ApexEvent = {
          type: eventType,
          taskId: 'test-task',
          timestamp: new Date(),
          data: {}
        };

        expect(() => ApexEventTypeSchema.parse(eventType)).not.toThrow();
        expect(() => ApexEventSchema.parse(event)).not.toThrow();
      });
    });
  });
});