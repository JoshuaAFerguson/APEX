/**
 * @fileoverview Comprehensive Unit Tests for Undo Functionality
 *
 * This test suite provides comprehensive unit test coverage for APEX's undo functionality,
 * focusing on individual component testing including:
 * - Snapshot capture mechanisms
 * - Single operation undo/redo (Write, Edit, Delete operations)
 * - Multi-action undo scenarios
 * - Error handling and edge cases
 * - Event emission during undo operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  FileSnapshotSchema,
  FileSnapshot,
  ToolActionSnapshotSchema,
  ToolActionSnapshot,
  UndoEventSchema,
  UndoEvent,
  UndoEventType,
} from '../../../core/src/types.js';
import { ApexOrchestrator } from '../index.js';

describe('Comprehensive Undo Functionality - Unit Tests', () => {
  let tempDir: string;
  let originalCwd: string;
  let orchestrator: ApexOrchestrator;
  let testFilePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-undo-unit-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Initialize APEX in temp directory
    await fs.mkdir('.apex', { recursive: true });
    await fs.writeFile('.apex/config.yaml', `
project:
  name: "undo-test"
  version: "1.0.0"
agents: []
workflows: []
`);

    orchestrator = new ApexOrchestrator();
    await orchestrator.init(tempDir);

    // Create test file
    testFilePath = path.join(tempDir, 'test-file.txt');
    await fs.writeFile(testFilePath, 'original content', 'utf8');
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.destroy();
    }
    process.chdir(originalCwd);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('Snapshot Capture Functionality', () => {
    it('should create valid FileSnapshot with all required fields', async () => {
      const toolActionStore = orchestrator.getToolActionStore();
      const snapshot = await toolActionStore.createFileSnapshot(testFilePath);

      // Validate against schema
      expect(() => FileSnapshotSchema.parse(snapshot)).not.toThrow();

      // Check required fields
      expect(typeof snapshot.id).toBe('string');
      expect(snapshot.id.length).toBeGreaterThan(0);
      expect(snapshot.filePath).toBe(testFilePath);
      expect(snapshot.content).toBe('original content');
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.existed).toBe(true);
    });

    it('should create FileSnapshot for non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.txt');
      const toolActionStore = orchestrator.getToolActionStore();
      const snapshot = await toolActionStore.createFileSnapshot(nonExistentPath);

      expect(() => FileSnapshotSchema.parse(snapshot)).not.toThrow();
      expect(snapshot.filePath).toBe(nonExistentPath);
      expect(snapshot.content).toBe('');
      expect(snapshot.existed).toBe(false);
    });

    it('should handle binary file snapshots', async () => {
      const binaryPath = path.join(tempDir, 'binary.dat');
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      await fs.writeFile(binaryPath, binaryData);

      const toolActionStore = orchestrator.getToolActionStore();
      const snapshot = await toolActionStore.createFileSnapshot(binaryPath);

      expect(() => FileSnapshotSchema.parse(snapshot)).not.toThrow();
      expect(snapshot.existed).toBe(true);
      expect(snapshot.filePath).toBe(binaryPath);
    });

    it('should capture file metadata in snapshot', async () => {
      const toolActionStore = orchestrator.getToolActionStore();
      const snapshot = await toolActionStore.createFileSnapshot(testFilePath);

      expect(snapshot.metadata).toEqual(
        expect.objectContaining({
          size: expect.any(Number),
          mtime: expect.any(String)
        })
      );
    });

    it('should create unique snapshot IDs for same file', async () => {
      const toolActionStore = orchestrator.getToolActionStore();
      const snapshot1 = await toolActionStore.createFileSnapshot(testFilePath);
      const snapshot2 = await toolActionStore.createFileSnapshot(testFilePath);

      expect(snapshot1.id).not.toBe(snapshot2.id);
      expect(snapshot1.timestamp.getTime()).toBeLessThanOrEqual(snapshot2.timestamp.getTime());
    });

    it('should handle empty file snapshots', async () => {
      const emptyPath = path.join(tempDir, 'empty.txt');
      await fs.writeFile(emptyPath, '', 'utf8');

      const toolActionStore = orchestrator.getToolActionStore();
      const snapshot = await toolActionStore.createFileSnapshot(emptyPath);

      expect(() => FileSnapshotSchema.parse(snapshot)).not.toThrow();
      expect(snapshot.content).toBe('');
      expect(snapshot.existed).toBe(true);
    });
  });

  describe('Single Operation Undo - Write Tool', () => {
    it('should undo Write operation on existing file', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test Write undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Create before snapshot
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFilePath);

      // Simulate Write tool action
      const newContent = 'modified by write tool';
      await fs.writeFile(testFilePath, newContent, 'utf8');

      // Create after snapshot and record action
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFilePath);
      const mockExecution = {
        toolName: 'Write',
        input: { file_path: testFilePath, content: newContent },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot],
        afterSnapshots: [afterSnapshot]
      };

      const action = await toolActionStore.recordToolAction(task.id, mockExecution);
      expect(action.canUndo).toBe(true);

      // Verify file was modified
      const modifiedContent = await fs.readFile(testFilePath, 'utf8');
      expect(modifiedContent).toBe(newContent);

      // Perform undo
      await toolActionStore.undoAction(task.id, action.id);

      // Verify file was restored
      const restoredContent = await fs.readFile(testFilePath, 'utf8');
      expect(restoredContent).toBe('original content');
    });

    it('should undo Write operation on new file (delete file)', async () => {
      const newFilePath = path.join(tempDir, 'new-file.txt');
      const task = await orchestrator.createTask({
        goal: 'Test Write new file undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Create before snapshot (file doesn't exist)
      const beforeSnapshot = await toolActionStore.createFileSnapshot(newFilePath);
      expect(beforeSnapshot.existed).toBe(false);

      // Simulate Write tool creating new file
      const content = 'new file content';
      await fs.writeFile(newFilePath, content, 'utf8');

      // Record action
      const afterSnapshot = await toolActionStore.createFileSnapshot(newFilePath);
      const mockExecution = {
        toolName: 'Write',
        input: { file_path: newFilePath, content },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot],
        afterSnapshots: [afterSnapshot]
      };

      const action = await toolActionStore.recordToolAction(task.id, mockExecution);

      // Verify file was created
      expect(await fs.access(newFilePath).then(() => true).catch(() => false)).toBe(true);

      // Perform undo (should delete the file)
      await toolActionStore.undoAction(task.id, action.id);

      // Verify file was deleted
      expect(await fs.access(newFilePath).then(() => true).catch(() => false)).toBe(false);
    });
  });

  describe('Single Operation Undo - Edit Tool', () => {
    it('should undo Edit operation correctly', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test Edit undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const originalContent = await fs.readFile(testFilePath, 'utf8');

      // Create before snapshot
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFilePath);

      // Simulate Edit tool action
      const modifiedContent = 'content modified by edit tool';
      await fs.writeFile(testFilePath, modifiedContent, 'utf8');

      // Record action
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFilePath);
      const mockExecution = {
        toolName: 'Edit',
        input: {
          file_path: testFilePath,
          old_string: originalContent,
          new_string: modifiedContent
        },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot],
        afterSnapshots: [afterSnapshot]
      };

      const action = await toolActionStore.recordToolAction(task.id, mockExecution);

      // Perform undo
      await toolActionStore.undoAction(task.id, action.id);

      // Verify content was restored
      const restoredContent = await fs.readFile(testFilePath, 'utf8');
      expect(restoredContent).toBe(originalContent);
    });

    it('should handle Edit operation with partial content changes', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test Edit partial undo',
        context: {}
      });

      // Set up multi-line content
      const multiLineContent = `line 1\nline 2\nline 3\nline 4`;
      await fs.writeFile(testFilePath, multiLineContent, 'utf8');

      const toolActionStore = orchestrator.getToolActionStore();
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFilePath);

      // Simulate Edit changing only line 2
      const editedContent = `line 1\nmodified line 2\nline 3\nline 4`;
      await fs.writeFile(testFilePath, editedContent, 'utf8');

      const afterSnapshot = await toolActionStore.createFileSnapshot(testFilePath);
      const mockExecution = {
        toolName: 'Edit',
        input: {
          file_path: testFilePath,
          old_string: 'line 2',
          new_string: 'modified line 2'
        },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot],
        afterSnapshots: [afterSnapshot]
      };

      const action = await toolActionStore.recordToolAction(task.id, mockExecution);

      // Perform undo
      await toolActionStore.undoAction(task.id, action.id);

      // Verify original content was restored
      const restoredContent = await fs.readFile(testFilePath, 'utf8');
      expect(restoredContent).toBe(multiLineContent);
    });
  });

  describe('Single Operation Undo - Delete Operations', () => {
    it('should undo file deletion by Bash tool', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test delete undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const originalContent = await fs.readFile(testFilePath, 'utf8');

      // Create before snapshot
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFilePath);

      // Simulate file deletion
      await fs.unlink(testFilePath);

      // Record action
      const mockExecution = {
        toolName: 'Bash',
        input: { command: `rm ${testFilePath}` },
        output: { stdout: '', stderr: '', exitCode: 0 },
        beforeSnapshots: [beforeSnapshot],
        afterSnapshots: []
      };

      const action = await toolActionStore.recordToolAction(task.id, mockExecution);

      // Verify file was deleted
      expect(await fs.access(testFilePath).then(() => true).catch(() => false)).toBe(false);

      // Perform undo (should restore the file)
      await toolActionStore.undoAction(task.id, action.id);

      // Verify file was restored with original content
      expect(await fs.access(testFilePath).then(() => true).catch(() => false)).toBe(true);
      const restoredContent = await fs.readFile(testFilePath, 'utf8');
      expect(restoredContent).toBe(originalContent);
    });

    it('should handle undo of directory deletion', async () => {
      const testDir = path.join(tempDir, 'test-directory');
      const testDirFile = path.join(testDir, 'dir-file.txt');
      const dirContent = 'directory file content';

      // Create test directory structure
      await fs.mkdir(testDir);
      await fs.writeFile(testDirFile, dirContent, 'utf8');

      const task = await orchestrator.createTask({
        goal: 'Test directory delete undo',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Create snapshots for all files in directory
      const dirSnapshot = await toolActionStore.createFileSnapshot(testDirFile);

      // Simulate directory deletion
      await fs.rm(testDir, { recursive: true });

      // Record action
      const mockExecution = {
        toolName: 'Bash',
        input: { command: `rm -rf ${testDir}` },
        output: { stdout: '', stderr: '', exitCode: 0 },
        beforeSnapshots: [dirSnapshot],
        afterSnapshots: []
      };

      const action = await toolActionStore.recordToolAction(task.id, mockExecution);

      // Verify directory was deleted
      expect(await fs.access(testDir).then(() => true).catch(() => false)).toBe(false);

      // Perform undo
      await toolActionStore.undoAction(task.id, action.id);

      // Verify file content was restored (directory structure is implicit)
      const restoredContent = await fs.readFile(testDirFile, 'utf8');
      expect(restoredContent).toBe(dirContent);
    });
  });

  describe('Error Handling in Undo Operations', () => {
    it('should throw error when undoing non-existent action', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test error handling',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      await expect(toolActionStore.undoAction(task.id, 'non-existent-action-id'))
        .rejects.toThrow('Tool action not found');
    });

    it('should throw error when no undoable actions exist', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test no undoable actions',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      await expect(toolActionStore.undoLastAction(task.id))
        .rejects.toThrow('No undoable actions found for task');
    });

    it('should throw error when action is not undoable', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test non-undoable action',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Create a non-undoable action (no file modifications)
      const mockExecution = {
        toolName: 'Bash',
        input: { command: 'echo "hello"' },
        output: { stdout: 'hello\n', stderr: '', exitCode: 0 },
        beforeSnapshots: [],
        afterSnapshots: []
      };

      const action = await toolActionStore.recordToolAction(task.id, mockExecution);
      expect(action.canUndo).toBe(false);

      await expect(toolActionStore.undoAction(task.id, action.id))
        .rejects.toThrow('Action cannot be undone');
    });

    it('should throw error when action is already undone', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test already undone',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Create undoable action
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFilePath);
      await fs.writeFile(testFilePath, 'modified', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFilePath);

      const mockExecution = {
        toolName: 'Write',
        input: { file_path: testFilePath, content: 'modified' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot],
        afterSnapshots: [afterSnapshot]
      };

      const action = await toolActionStore.recordToolAction(task.id, mockExecution);

      // Undo once
      await toolActionStore.undoAction(task.id, action.id);

      // Try to undo again
      await expect(toolActionStore.undoAction(task.id, action.id))
        .rejects.toThrow('Action is already undone');
    });

    it('should handle permission errors gracefully', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test permission error',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();
      const restrictedPath = path.join(tempDir, 'restricted.txt');

      // Create file and snapshot
      await fs.writeFile(restrictedPath, 'original', 'utf8');
      const beforeSnapshot = await toolActionStore.createFileSnapshot(restrictedPath);

      // Modify file
      await fs.writeFile(restrictedPath, 'modified', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(restrictedPath);

      const mockExecution = {
        toolName: 'Write',
        input: { file_path: restrictedPath, content: 'modified' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot],
        afterSnapshots: [afterSnapshot]
      };

      const action = await toolActionStore.recordToolAction(task.id, mockExecution);

      // Make file read-only to simulate permission error
      await fs.chmod(restrictedPath, 0o444);

      // Undo should handle permission error gracefully
      await expect(toolActionStore.undoAction(task.id, action.id))
        .rejects.toThrow();

      // Clean up
      await fs.chmod(restrictedPath, 0o644);
    });

    it('should handle corrupted snapshots', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test corrupted snapshot',
        context: {}
      });

      const toolActionStore = orchestrator.getToolActionStore();

      // Create snapshot with invalid data
      const corruptedSnapshot = {
        id: 'corrupted',
        filePath: '/non/existent/path',
        content: null as any, // Invalid content
        timestamp: new Date(),
        existed: true
      };

      const mockExecution = {
        toolName: 'Write',
        input: { file_path: '/non/existent/path', content: 'test' },
        output: { success: true },
        beforeSnapshots: [corruptedSnapshot],
        afterSnapshots: []
      };

      // This should throw during recordToolAction due to validation
      await expect(toolActionStore.recordToolAction(task.id, mockExecution))
        .rejects.toThrow();
    });
  });

  describe('Event Emission During Undo Operations', () => {
    it('should emit correct event sequence for successful undo', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test undo events',
        context: {}
      });

      const events: string[] = [];

      // Set up event listeners
      orchestrator.on('undo:start', () => events.push('undo:start'));
      orchestrator.on('undo:complete', () => events.push('undo:complete'));
      orchestrator.on('undo:error', () => events.push('undo:error'));

      const toolActionStore = orchestrator.getToolActionStore();

      // Create undoable action
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFilePath);
      await fs.writeFile(testFilePath, 'modified for events test', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFilePath);

      const mockExecution = {
        toolName: 'Write',
        input: { file_path: testFilePath, content: 'modified for events test' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot],
        afterSnapshots: [afterSnapshot]
      };

      await toolActionStore.recordToolAction(task.id, mockExecution);

      // Perform undo through orchestrator to trigger events
      await orchestrator.undoLastAction(task.id);

      // Verify event sequence
      expect(events).toEqual(['undo:start', 'undo:complete']);
    });

    it('should emit error event for failed undo', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test undo error events',
        context: {}
      });

      const events: string[] = [];

      orchestrator.on('undo:start', () => events.push('undo:start'));
      orchestrator.on('undo:complete', () => events.push('undo:complete'));
      orchestrator.on('undo:error', () => events.push('undo:error'));

      // Try to undo when no actions exist
      await orchestrator.undoLastAction(task.id);

      expect(events).toEqual(['undo:start', 'undo:error']);
    });

    it('should include action details in undo events', async () => {
      const task = await orchestrator.createTask({
        goal: 'Test event details',
        context: {}
      });

      let startEventData: any = null;
      let completeEventData: any = null;

      orchestrator.on('undo:start', (data) => { startEventData = data; });
      orchestrator.on('undo:complete', (data) => { completeEventData = data; });

      const toolActionStore = orchestrator.getToolActionStore();

      // Create undoable action
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFilePath);
      await fs.writeFile(testFilePath, 'test content', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFilePath);

      const mockExecution = {
        toolName: 'Write',
        input: { file_path: testFilePath, content: 'test content' },
        output: { success: true },
        beforeSnapshots: [beforeSnapshot],
        afterSnapshots: [afterSnapshot]
      };

      await toolActionStore.recordToolAction(task.id, mockExecution);

      // Perform undo
      await orchestrator.undoLastAction(task.id);

      // Verify event data includes task ID
      expect(startEventData).toBe(task.id);
      expect(completeEventData).toEqual(
        expect.objectContaining({
          taskId: task.id,
          actionId: expect.any(String),
          restoredFiles: [testFilePath]
        })
      );
    });
  });

  describe('Validation and Schema Compliance', () => {
    it('should create valid UndoEvent objects', () => {
      const undoEvent: UndoEvent = {
        id: 'test-undo-event',
        type: 'undo:completed' as UndoEventType,
        taskId: 'test-task',
        actionId: 'test-action',
        timestamp: new Date(),
        metadata: {
          filesRestored: 1,
          duration: 500
        }
      };

      expect(() => UndoEventSchema.parse(undoEvent)).not.toThrow();
    });

    it('should validate all UndoEventType values', () => {
      const eventTypes: UndoEventType[] = [
        'undo:requested',
        'undo:started',
        'undo:completed',
        'undo:failed',
        'redo:requested',
        'redo:started',
        'redo:completed',
        'redo:failed'
      ];

      eventTypes.forEach(type => {
        const event: UndoEvent = {
          id: `event-${type}`,
          type,
          taskId: 'test-task',
          actionId: 'test-action',
          timestamp: new Date()
        };

        expect(() => UndoEventSchema.parse(event)).not.toThrow();
      });
    });

    it('should create valid ToolActionSnapshot objects', async () => {
      const toolActionStore = orchestrator.getToolActionStore();
      const snapshot = await toolActionStore.createFileSnapshot(testFilePath);

      const toolActionSnapshot: ToolActionSnapshot = {
        actionId: 'test-action',
        toolName: 'Write',
        snapshots: [snapshot],
        timestamp: new Date(),
        description: 'Test tool action',
        canUndo: true
      };

      expect(() => ToolActionSnapshotSchema.parse(toolActionSnapshot)).not.toThrow();
    });
  });
});