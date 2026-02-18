import { describe, it, expect } from 'vitest';
import {
  FileSnapshotSchema,
  FileSnapshot,
  ToolActionSnapshotSchema,
  ToolActionSnapshot,
  UndoEventTypeSchema,
  UndoEventType,
  UndoEventSchema,
  UndoEvent,
} from '../types.js';

describe('FileSnapshot', () => {
  describe('FileSnapshotSchema validation', () => {
    it('should validate a valid FileSnapshot with all required fields', () => {
      const validSnapshot = {
        id: 'snapshot-123',
        filePath: '/home/user/project/src/main.ts',
        content: 'console.log("Hello World");',
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
        existed: true,
      };

      const result = FileSnapshotSchema.safeParse(validSnapshot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('snapshot-123');
        expect(result.data.filePath).toBe('/home/user/project/src/main.ts');
        expect(result.data.content).toBe('console.log("Hello World");');
        expect(result.data.timestamp).toEqual(new Date('2024-01-01T10:00:00.000Z'));
        expect(result.data.existed).toBe(true);
      }
    });

    it('should validate a FileSnapshot for a non-existent file', () => {
      const snapshotForNewFile = {
        id: 'snapshot-new-file',
        filePath: '/home/user/project/src/newfile.ts',
        content: '',
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
        existed: false,
      };

      const result = FileSnapshotSchema.safeParse(snapshotForNewFile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.existed).toBe(false);
        expect(result.data.content).toBe('');
      }
    });

    it('should default existed to true when not provided', () => {
      const snapshotWithoutExisted = {
        id: 'snapshot-default',
        filePath: '/home/user/project/src/main.ts',
        content: 'console.log("Hello World");',
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
      };

      const result = FileSnapshotSchema.safeParse(snapshotWithoutExisted);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.existed).toBe(true);
      }
    });

    it('should accept optional metadata', () => {
      const snapshotWithMetadata = {
        id: 'snapshot-with-metadata',
        filePath: '/home/user/project/src/main.ts',
        content: 'console.log("Hello World");',
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
        existed: true,
        metadata: {
          size: 25,
          mimeType: 'text/typescript',
          encoding: 'utf-8',
        },
      };

      const result = FileSnapshotSchema.safeParse(snapshotWithMetadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toEqual({
          size: 25,
          mimeType: 'text/typescript',
          encoding: 'utf-8',
        });
      }
    });

    it('should reject invalid data', () => {
      const invalidCases = [
        {
          name: 'missing id',
          data: {
            filePath: '/path/to/file',
            content: 'content',
            timestamp: new Date(),
          },
        },
        {
          name: 'empty id',
          data: {
            id: '',
            filePath: '/path/to/file',
            content: 'content',
            timestamp: new Date(),
          },
        },
        {
          name: 'missing filePath',
          data: {
            id: 'snapshot-1',
            content: 'content',
            timestamp: new Date(),
          },
        },
        {
          name: 'empty filePath',
          data: {
            id: 'snapshot-1',
            filePath: '',
            content: 'content',
            timestamp: new Date(),
          },
        },
        {
          name: 'missing content',
          data: {
            id: 'snapshot-1',
            filePath: '/path/to/file',
            timestamp: new Date(),
          },
        },
        {
          name: 'missing timestamp',
          data: {
            id: 'snapshot-1',
            filePath: '/path/to/file',
            content: 'content',
          },
        },
        {
          name: 'invalid timestamp',
          data: {
            id: 'snapshot-1',
            filePath: '/path/to/file',
            content: 'content',
            timestamp: 'invalid-date',
          },
        },
      ];

      invalidCases.forEach(({ name, data }) => {
        const result = FileSnapshotSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('TypeScript type inference', () => {
    it('should infer correct TypeScript types', () => {
      const snapshot: FileSnapshot = {
        id: 'snapshot-123',
        filePath: '/path/to/file.ts',
        content: 'const x = 1;',
        timestamp: new Date(),
        existed: true,
        metadata: { size: 100 },
      };

      // Type assertions to ensure TypeScript compilation
      expect(typeof snapshot.id).toBe('string');
      expect(typeof snapshot.filePath).toBe('string');
      expect(typeof snapshot.content).toBe('string');
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(typeof snapshot.existed).toBe('boolean');
      expect(typeof snapshot.metadata).toBe('object');
    });
  });
});

describe('ToolActionSnapshot', () => {
  describe('ToolActionSnapshotSchema validation', () => {
    const validFileSnapshot = {
      id: 'file-snapshot-1',
      filePath: '/home/user/project/src/main.ts',
      content: 'console.log("Hello World");',
      timestamp: new Date('2024-01-01T10:00:00.000Z'),
      existed: true,
    };

    it('should validate a valid ToolActionSnapshot with all required fields', () => {
      const validToolActionSnapshot = {
        actionId: 'action-123',
        toolName: 'Write',
        snapshots: [validFileSnapshot],
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
        canUndo: true,
      };

      const result = ToolActionSnapshotSchema.safeParse(validToolActionSnapshot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.actionId).toBe('action-123');
        expect(result.data.toolName).toBe('Write');
        expect(result.data.snapshots).toHaveLength(1);
        expect(result.data.timestamp).toEqual(new Date('2024-01-01T10:00:00.000Z'));
        expect(result.data.canUndo).toBe(true);
      }
    });

    it('should validate with multiple file snapshots', () => {
      const multipleSnapshots = {
        actionId: 'action-multi',
        toolName: 'Edit',
        snapshots: [
          validFileSnapshot,
          {
            id: 'file-snapshot-2',
            filePath: '/home/user/project/src/utils.ts',
            content: 'export function helper() {}',
            timestamp: new Date('2024-01-01T10:01:00.000Z'),
            existed: true,
          },
        ],
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
      };

      const result = ToolActionSnapshotSchema.safeParse(multipleSnapshots);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.snapshots).toHaveLength(2);
      }
    });

    it('should validate with empty snapshots array', () => {
      const emptySnapshots = {
        actionId: 'action-empty',
        toolName: 'Bash',
        snapshots: [],
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
      };

      const result = ToolActionSnapshotSchema.safeParse(emptySnapshots);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.snapshots).toHaveLength(0);
      }
    });

    it('should default canUndo to true when not provided', () => {
      const snapshotWithoutCanUndo = {
        actionId: 'action-default',
        toolName: 'Write',
        snapshots: [validFileSnapshot],
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
      };

      const result = ToolActionSnapshotSchema.safeParse(snapshotWithoutCanUndo);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canUndo).toBe(true);
      }
    });

    it('should accept optional description', () => {
      const snapshotWithDescription = {
        actionId: 'action-desc',
        toolName: 'Edit',
        snapshots: [validFileSnapshot],
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
        description: 'Updated main function to add logging',
        canUndo: true,
      };

      const result = ToolActionSnapshotSchema.safeParse(snapshotWithDescription);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Updated main function to add logging');
      }
    });

    it('should reject invalid data', () => {
      const invalidCases = [
        {
          name: 'missing actionId',
          data: {
            toolName: 'Write',
            snapshots: [validFileSnapshot],
            timestamp: new Date(),
          },
        },
        {
          name: 'empty actionId',
          data: {
            actionId: '',
            toolName: 'Write',
            snapshots: [validFileSnapshot],
            timestamp: new Date(),
          },
        },
        {
          name: 'missing toolName',
          data: {
            actionId: 'action-1',
            snapshots: [validFileSnapshot],
            timestamp: new Date(),
          },
        },
        {
          name: 'empty toolName',
          data: {
            actionId: 'action-1',
            toolName: '',
            snapshots: [validFileSnapshot],
            timestamp: new Date(),
          },
        },
        {
          name: 'missing snapshots',
          data: {
            actionId: 'action-1',
            toolName: 'Write',
            timestamp: new Date(),
          },
        },
        {
          name: 'invalid snapshots - not array',
          data: {
            actionId: 'action-1',
            toolName: 'Write',
            snapshots: 'not-an-array',
            timestamp: new Date(),
          },
        },
        {
          name: 'missing timestamp',
          data: {
            actionId: 'action-1',
            toolName: 'Write',
            snapshots: [],
          },
        },
        {
          name: 'invalid timestamp',
          data: {
            actionId: 'action-1',
            toolName: 'Write',
            snapshots: [],
            timestamp: 'invalid-date',
          },
        },
      ];

      invalidCases.forEach(({ name, data }) => {
        const result = ToolActionSnapshotSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('TypeScript type inference', () => {
    it('should infer correct TypeScript types', () => {
      const toolActionSnapshot: ToolActionSnapshot = {
        actionId: 'action-123',
        toolName: 'Edit',
        snapshots: [{
          id: 'snapshot-1',
          filePath: '/path/to/file.ts',
          content: 'const x = 1;',
          timestamp: new Date(),
          existed: true,
        }],
        timestamp: new Date(),
        description: 'Tool action description',
        canUndo: true,
      };

      // Type assertions to ensure TypeScript compilation
      expect(typeof toolActionSnapshot.actionId).toBe('string');
      expect(typeof toolActionSnapshot.toolName).toBe('string');
      expect(Array.isArray(toolActionSnapshot.snapshots)).toBe(true);
      expect(toolActionSnapshot.timestamp).toBeInstanceOf(Date);
      expect(typeof toolActionSnapshot.description).toBe('string');
      expect(typeof toolActionSnapshot.canUndo).toBe('boolean');
    });
  });
});

describe('UndoEventType', () => {
  describe('UndoEventTypeSchema validation', () => {
    it('should validate all valid undo event types', () => {
      const validTypes = [
        'undo:requested',
        'undo:started',
        'undo:completed',
        'undo:failed',
        'redo:requested',
        'redo:started',
        'redo:completed',
        'redo:failed',
      ];

      validTypes.forEach(type => {
        const result = UndoEventTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(type);
        }
      });
    });

    it('should reject invalid event types', () => {
      const invalidTypes = [
        'invalid',
        'undo:unknown',
        'redo:unknown',
        'UNDO:REQUESTED',
        'undo_requested',
        '',
        null,
        undefined,
        123,
      ];

      invalidTypes.forEach(type => {
        const result = UndoEventTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('TypeScript type inference', () => {
    it('should infer correct TypeScript types', () => {
      const eventType: UndoEventType = 'undo:completed';
      expect(typeof eventType).toBe('string');
      expect(['undo:requested', 'undo:started', 'undo:completed', 'undo:failed', 'redo:requested', 'redo:started', 'redo:completed', 'redo:failed']).toContain(eventType);
    });
  });
});

describe('UndoEvent', () => {
  describe('UndoEventSchema validation', () => {
    it('should validate a valid UndoEvent with all required fields', () => {
      const validUndoEvent = {
        id: 'undo-event-123',
        type: 'undo:completed' as UndoEventType,
        taskId: 'task-456',
        actionId: 'action-789',
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
      };

      const result = UndoEventSchema.safeParse(validUndoEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('undo-event-123');
        expect(result.data.type).toBe('undo:completed');
        expect(result.data.taskId).toBe('task-456');
        expect(result.data.actionId).toBe('action-789');
        expect(result.data.timestamp).toEqual(new Date('2024-01-01T10:00:00.000Z'));
      }
    });

    it('should validate with optional snapshotId', () => {
      const undoEventWithSnapshot = {
        id: 'undo-event-with-snapshot',
        type: 'undo:started' as UndoEventType,
        taskId: 'task-123',
        actionId: 'action-456',
        snapshotId: 'snapshot-789',
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
      };

      const result = UndoEventSchema.safeParse(undoEventWithSnapshot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.snapshotId).toBe('snapshot-789');
      }
    });

    it('should validate with optional error message for failed events', () => {
      const failedUndoEvent = {
        id: 'undo-event-failed',
        type: 'undo:failed' as UndoEventType,
        taskId: 'task-123',
        actionId: 'action-456',
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
        error: 'File not found during undo operation',
      };

      const result = UndoEventSchema.safeParse(failedUndoEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error).toBe('File not found during undo operation');
      }
    });

    it('should validate with optional metadata', () => {
      const undoEventWithMetadata = {
        id: 'undo-event-metadata',
        type: 'redo:completed' as UndoEventType,
        taskId: 'task-123',
        actionId: 'action-456',
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
        metadata: {
          filesRestored: 3,
          duration: 150,
          user: 'developer@example.com',
        },
      };

      const result = UndoEventSchema.safeParse(undoEventWithMetadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toEqual({
          filesRestored: 3,
          duration: 150,
          user: 'developer@example.com',
        });
      }
    });

    it('should validate different event types', () => {
      const eventTypes: UndoEventType[] = [
        'undo:requested',
        'undo:started',
        'undo:completed',
        'undo:failed',
        'redo:requested',
        'redo:started',
        'redo:completed',
        'redo:failed',
      ];

      eventTypes.forEach(type => {
        const undoEvent = {
          id: `event-${type}`,
          type,
          taskId: 'task-123',
          actionId: 'action-456',
          timestamp: new Date('2024-01-01T10:00:00.000Z'),
        };

        const result = UndoEventSchema.safeParse(undoEvent);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe(type);
        }
      });
    });

    it('should reject invalid data', () => {
      const invalidCases = [
        {
          name: 'missing id',
          data: {
            type: 'undo:completed',
            taskId: 'task-123',
            actionId: 'action-456',
            timestamp: new Date(),
          },
        },
        {
          name: 'empty id',
          data: {
            id: '',
            type: 'undo:completed',
            taskId: 'task-123',
            actionId: 'action-456',
            timestamp: new Date(),
          },
        },
        {
          name: 'missing type',
          data: {
            id: 'event-1',
            taskId: 'task-123',
            actionId: 'action-456',
            timestamp: new Date(),
          },
        },
        {
          name: 'invalid type',
          data: {
            id: 'event-1',
            type: 'invalid:type',
            taskId: 'task-123',
            actionId: 'action-456',
            timestamp: new Date(),
          },
        },
        {
          name: 'missing taskId',
          data: {
            id: 'event-1',
            type: 'undo:completed',
            actionId: 'action-456',
            timestamp: new Date(),
          },
        },
        {
          name: 'empty taskId',
          data: {
            id: 'event-1',
            type: 'undo:completed',
            taskId: '',
            actionId: 'action-456',
            timestamp: new Date(),
          },
        },
        {
          name: 'missing actionId',
          data: {
            id: 'event-1',
            type: 'undo:completed',
            taskId: 'task-123',
            timestamp: new Date(),
          },
        },
        {
          name: 'empty actionId',
          data: {
            id: 'event-1',
            type: 'undo:completed',
            taskId: 'task-123',
            actionId: '',
            timestamp: new Date(),
          },
        },
        {
          name: 'missing timestamp',
          data: {
            id: 'event-1',
            type: 'undo:completed',
            taskId: 'task-123',
            actionId: 'action-456',
          },
        },
        {
          name: 'invalid timestamp',
          data: {
            id: 'event-1',
            type: 'undo:completed',
            taskId: 'task-123',
            actionId: 'action-456',
            timestamp: 'invalid-date',
          },
        },
      ];

      invalidCases.forEach(({ name, data }) => {
        const result = UndoEventSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('TypeScript type inference', () => {
    it('should infer correct TypeScript types', () => {
      const undoEvent: UndoEvent = {
        id: 'undo-event-123',
        type: 'undo:completed',
        taskId: 'task-456',
        actionId: 'action-789',
        timestamp: new Date(),
        snapshotId: 'snapshot-123',
        error: 'Some error message',
        metadata: { key: 'value' },
      };

      // Type assertions to ensure TypeScript compilation
      expect(typeof undoEvent.id).toBe('string');
      expect(typeof undoEvent.type).toBe('string');
      expect(typeof undoEvent.taskId).toBe('string');
      expect(typeof undoEvent.actionId).toBe('string');
      expect(undoEvent.timestamp).toBeInstanceOf(Date);
      expect(typeof undoEvent.snapshotId).toBe('string');
      expect(typeof undoEvent.error).toBe('string');
      expect(typeof undoEvent.metadata).toBe('object');
    });
  });
});