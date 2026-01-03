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

describe('Snapshot and Undo Types Integration', () => {
  describe('End-to-end workflow simulation', () => {
    it('should support a complete undo/redo workflow', () => {
      const baseTimestamp = new Date('2024-01-01T10:00:00.000Z');

      // Step 1: Create file snapshots before tool action
      const beforeSnapshot1: FileSnapshot = {
        id: 'before-main-ts',
        filePath: '/project/src/main.ts',
        content: 'console.log("Hello");',
        timestamp: baseTimestamp,
        existed: true,
      };

      const beforeSnapshot2: FileSnapshot = {
        id: 'before-utils-ts',
        filePath: '/project/src/utils.ts',
        content: '',
        timestamp: baseTimestamp,
        existed: false, // New file being created
      };

      // Step 2: Create tool action snapshot
      const toolActionSnapshot: ToolActionSnapshot = {
        actionId: 'action-123',
        toolName: 'Edit',
        snapshots: [beforeSnapshot1, beforeSnapshot2],
        timestamp: new Date(baseTimestamp.getTime() + 1000),
        description: 'Added logging utility function to utils.ts and updated main.ts',
        canUndo: true,
      };

      // Step 3: Create undo event sequence
      const undoRequestedEvent: UndoEvent = {
        id: 'undo-event-1',
        type: 'undo:requested',
        taskId: 'task-abc',
        actionId: 'action-123',
        snapshotId: 'action-123', // References the tool action snapshot
        timestamp: new Date(baseTimestamp.getTime() + 5000),
        metadata: {
          requestedBy: 'user',
          reason: 'Revert experimental changes',
        },
      };

      const undoStartedEvent: UndoEvent = {
        id: 'undo-event-2',
        type: 'undo:started',
        taskId: 'task-abc',
        actionId: 'action-123',
        snapshotId: 'action-123',
        timestamp: new Date(baseTimestamp.getTime() + 5100),
      };

      const undoCompletedEvent: UndoEvent = {
        id: 'undo-event-3',
        type: 'undo:completed',
        taskId: 'task-abc',
        actionId: 'action-123',
        snapshotId: 'action-123',
        timestamp: new Date(baseTimestamp.getTime() + 5500),
        metadata: {
          filesRestored: 2,
          duration: 400,
        },
      };

      // Validate all objects
      expect(() => FileSnapshotSchema.parse(beforeSnapshot1)).not.toThrow();
      expect(() => FileSnapshotSchema.parse(beforeSnapshot2)).not.toThrow();
      expect(() => ToolActionSnapshotSchema.parse(toolActionSnapshot)).not.toThrow();
      expect(() => UndoEventSchema.parse(undoRequestedEvent)).not.toThrow();
      expect(() => UndoEventSchema.parse(undoStartedEvent)).not.toThrow();
      expect(() => UndoEventSchema.parse(undoCompletedEvent)).not.toThrow();

      // Verify relationships
      expect(toolActionSnapshot.snapshots).toHaveLength(2);
      expect(toolActionSnapshot.snapshots[0].id).toBe(beforeSnapshot1.id);
      expect(toolActionSnapshot.snapshots[1].id).toBe(beforeSnapshot2.id);

      expect(undoRequestedEvent.actionId).toBe(toolActionSnapshot.actionId);
      expect(undoStartedEvent.actionId).toBe(toolActionSnapshot.actionId);
      expect(undoCompletedEvent.actionId).toBe(toolActionSnapshot.actionId);

      // Verify the undo workflow progression
      expect(undoRequestedEvent.type).toBe('undo:requested');
      expect(undoStartedEvent.type).toBe('undo:started');
      expect(undoCompletedEvent.type).toBe('undo:completed');

      expect(undoStartedEvent.timestamp.getTime()).toBeGreaterThan(undoRequestedEvent.timestamp.getTime());
      expect(undoCompletedEvent.timestamp.getTime()).toBeGreaterThan(undoStartedEvent.timestamp.getTime());
    });

    it('should support failed undo operations', () => {
      const baseTimestamp = new Date('2024-01-01T10:00:00.000Z');

      const fileSnapshot: FileSnapshot = {
        id: 'snapshot-locked-file',
        filePath: '/project/locked/file.txt',
        content: 'Original content',
        timestamp: baseTimestamp,
        existed: true,
      };

      const toolActionSnapshot: ToolActionSnapshot = {
        actionId: 'action-locked',
        toolName: 'Write',
        snapshots: [fileSnapshot],
        timestamp: new Date(baseTimestamp.getTime() + 1000),
        canUndo: true,
      };

      const undoFailedEvent: UndoEvent = {
        id: 'undo-failed-1',
        type: 'undo:failed',
        taskId: 'task-fail',
        actionId: 'action-locked',
        timestamp: new Date(baseTimestamp.getTime() + 2000),
        error: 'Permission denied: cannot write to locked file',
        metadata: {
          errorCode: 'EACCES',
          filePath: '/project/locked/file.txt',
        },
      };

      expect(() => FileSnapshotSchema.parse(fileSnapshot)).not.toThrow();
      expect(() => ToolActionSnapshotSchema.parse(toolActionSnapshot)).not.toThrow();
      expect(() => UndoEventSchema.parse(undoFailedEvent)).not.toThrow();

      expect(undoFailedEvent.type).toBe('undo:failed');
      expect(undoFailedEvent.error).toBeDefined();
      expect(undoFailedEvent.metadata?.errorCode).toBe('EACCES');
    });

    it('should support redo operations', () => {
      const baseTimestamp = new Date('2024-01-01T10:00:00.000Z');

      // Original tool action
      const toolActionSnapshot: ToolActionSnapshot = {
        actionId: 'action-original',
        toolName: 'Edit',
        snapshots: [{
          id: 'snapshot-before-change',
          filePath: '/project/config.json',
          content: '{"version": "1.0.0"}',
          timestamp: baseTimestamp,
          existed: true,
        }],
        timestamp: new Date(baseTimestamp.getTime() + 1000),
        description: 'Update version to 1.1.0',
        canUndo: true,
      };

      // First, undo the change
      const undoCompletedEvent: UndoEvent = {
        id: 'undo-1',
        type: 'undo:completed',
        taskId: 'task-redo',
        actionId: 'action-original',
        timestamp: new Date(baseTimestamp.getTime() + 2000),
      };

      // Then, redo the change
      const redoRequestedEvent: UndoEvent = {
        id: 'redo-1',
        type: 'redo:requested',
        taskId: 'task-redo',
        actionId: 'action-original',
        timestamp: new Date(baseTimestamp.getTime() + 3000),
      };

      const redoCompletedEvent: UndoEvent = {
        id: 'redo-2',
        type: 'redo:completed',
        taskId: 'task-redo',
        actionId: 'action-original',
        timestamp: new Date(baseTimestamp.getTime() + 3500),
        metadata: {
          filesRestored: 1,
          redoOperation: true,
        },
      };

      // Validate all parts of the redo workflow
      expect(() => ToolActionSnapshotSchema.parse(toolActionSnapshot)).not.toThrow();
      expect(() => UndoEventSchema.parse(undoCompletedEvent)).not.toThrow();
      expect(() => UndoEventSchema.parse(redoRequestedEvent)).not.toThrow();
      expect(() => UndoEventSchema.parse(redoCompletedEvent)).not.toThrow();

      // Verify redo event types
      expect(redoRequestedEvent.type).toBe('redo:requested');
      expect(redoCompletedEvent.type).toBe('redo:completed');

      // Verify chronological order
      expect(undoCompletedEvent.timestamp.getTime()).toBeGreaterThan(toolActionSnapshot.timestamp.getTime());
      expect(redoRequestedEvent.timestamp.getTime()).toBeGreaterThan(undoCompletedEvent.timestamp.getTime());
      expect(redoCompletedEvent.timestamp.getTime()).toBeGreaterThan(redoRequestedEvent.timestamp.getTime());
    });
  });

  describe('Type compatibility and relationships', () => {
    it('should allow file snapshots to be used in tool action snapshots', () => {
      const fileSnapshot: FileSnapshot = {
        id: 'file-1',
        filePath: '/test.ts',
        content: 'test',
        timestamp: new Date(),
        existed: true,
      };

      const toolActionSnapshot: ToolActionSnapshot = {
        actionId: 'action-1',
        toolName: 'Write',
        snapshots: [fileSnapshot], // This should compile without issues
        timestamp: new Date(),
      };

      expect(toolActionSnapshot.snapshots[0]).toBe(fileSnapshot);
      expect(toolActionSnapshot.snapshots[0].id).toBe('file-1');
    });

    it('should allow undo events to reference tool actions via actionId', () => {
      const actionId = 'shared-action-id';

      const toolActionSnapshot: ToolActionSnapshot = {
        actionId,
        toolName: 'Edit',
        snapshots: [],
        timestamp: new Date(),
      };

      const undoEvent: UndoEvent = {
        id: 'undo-1',
        type: 'undo:started',
        taskId: 'task-1',
        actionId, // Same ID to establish relationship
        timestamp: new Date(),
      };

      expect(toolActionSnapshot.actionId).toBe(undoEvent.actionId);
      expect(undoEvent.actionId).toBe(actionId);
    });

    it('should support all undo event types in event sequences', () => {
      const allEventTypes: UndoEventType[] = [
        'undo:requested',
        'undo:started',
        'undo:completed',
        'undo:failed',
        'redo:requested',
        'redo:started',
        'redo:completed',
        'redo:failed',
      ];

      const taskId = 'task-all-events';
      const actionId = 'action-all-events';
      let timestamp = new Date().getTime();

      allEventTypes.forEach(eventType => {
        const event: UndoEvent = {
          id: `event-${eventType}`,
          type: eventType,
          taskId,
          actionId,
          timestamp: new Date(timestamp++),
        };

        expect(() => UndoEventSchema.parse(event)).not.toThrow();
        expect(event.type).toBe(eventType);
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty content in file snapshots', () => {
      const emptyFileSnapshot: FileSnapshot = {
        id: 'empty-file',
        filePath: '/empty.txt',
        content: '', // Empty content is valid
        timestamp: new Date(),
        existed: true,
      };

      expect(() => FileSnapshotSchema.parse(emptyFileSnapshot)).not.toThrow();
      expect(emptyFileSnapshot.content).toBe('');
    });

    it('should handle file snapshots for non-existent files', () => {
      const nonExistentFileSnapshot: FileSnapshot = {
        id: 'new-file',
        filePath: '/new.txt',
        content: '',
        timestamp: new Date(),
        existed: false,
      };

      expect(() => FileSnapshotSchema.parse(nonExistentFileSnapshot)).not.toThrow();
      expect(nonExistentFileSnapshot.existed).toBe(false);
    });

    it('should handle tool action snapshots with no file changes', () => {
      const noOpToolAction: ToolActionSnapshot = {
        actionId: 'no-op',
        toolName: 'Bash',
        snapshots: [], // No files modified
        timestamp: new Date(),
        description: 'Command that did not modify files',
        canUndo: false,
      };

      expect(() => ToolActionSnapshotSchema.parse(noOpToolAction)).not.toThrow();
      expect(noOpToolAction.snapshots).toHaveLength(0);
      expect(noOpToolAction.canUndo).toBe(false);
    });

    it('should handle undo events with comprehensive metadata', () => {
      const detailedUndoEvent: UndoEvent = {
        id: 'detailed-undo',
        type: 'undo:completed',
        taskId: 'task-detailed',
        actionId: 'action-detailed',
        snapshotId: 'snapshot-detailed',
        timestamp: new Date(),
        metadata: {
          filesRestored: 5,
          duration: 1234,
          user: 'test@example.com',
          toolUsed: 'auto-undo',
          backupLocation: '/tmp/backups/action-detailed',
          checksumVerification: true,
        },
      };

      expect(() => UndoEventSchema.parse(detailedUndoEvent)).not.toThrow();
      expect(detailedUndoEvent.metadata?.filesRestored).toBe(5);
      expect(detailedUndoEvent.metadata?.checksumVerification).toBe(true);
    });
  });
});