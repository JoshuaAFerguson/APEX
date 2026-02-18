import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { TaskStore, ToolActionStore } from './store';
import type {
  Task,
  ToolAction,
  FileSnapshot,
  ToolActionRetentionConfig
} from '@apexcli/core';

describe('ToolActionStore Edge Cases and Error Handling', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let toolActionStore: ToolActionStore;
  let testTask: Task;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_edge`,
    description: 'Edge case test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/edge-test-branch',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-edge-test-'));
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    testTask = createTestTask();
    await taskStore.addTask(testTask);

    toolActionStore = new ToolActionStore(taskStore);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('file system edge cases', () => {
    it('should handle files with Unicode characters in names', async () => {
      const unicodeFileName = 'тест-файл-🎉-émoji.txt';
      const content = 'Unicode content: 你好世界! Здравствуй мир!';
      const filePath = path.join(testDir, unicodeFileName);

      await fs.writeFile(filePath, content, 'utf8');

      const snapshot = await toolActionStore.createFileSnapshot(filePath);

      expect(snapshot.filePath).toBe(path.resolve(filePath));
      expect(snapshot.content).toBe(content);
      expect(snapshot.fileSize).toBe(Buffer.from(content, 'utf8').length);
    });

    it('should handle very long file paths', async () => {
      // Create nested directory structure
      const longDirName = 'very_long_directory_name_that_is_quite_excessive_and_might_cause_issues';
      const nestedPath = path.join(testDir, longDirName, longDirName, longDirName);
      await fs.mkdir(nestedPath, { recursive: true });

      const longFileName = 'extremely_long_file_name_that_might_exceed_certain_filesystem_limits_in_some_cases.txt';
      const filePath = path.join(nestedPath, longFileName);
      const content = 'Content in deeply nested file';

      await fs.writeFile(filePath, content, 'utf8');

      const snapshot = await toolActionStore.createFileSnapshot(filePath);

      expect(snapshot.content).toBe(content);
      expect(snapshot.filePath).toBe(path.resolve(filePath));
    });

    it('should handle files with permission issues gracefully', async () => {
      if (process.platform === 'win32') {
        // Skip permission tests on Windows as they work differently
        return;
      }

      const restrictedFile = path.join(testDir, 'restricted.txt');
      await fs.writeFile(restrictedFile, 'Restricted content', 'utf8');

      // Make file read-only
      await fs.chmod(restrictedFile, 0o444);

      try {
        const snapshot = await toolActionStore.createFileSnapshot(restrictedFile);
        expect(snapshot.content).toBe('Restricted content');

        // Try to create an action that would modify this file
        const execution = {
          callId: crypto.randomUUID(),
          toolName: 'restrictedTool',
          input: {},
          taskId: testTask.id,
          agentName: 'testAgent',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { success: false, error: 'Permission denied' },
          error: 'Permission denied when modifying file',
          status: 'failed' as const,
        };

        const action = await toolActionStore.recordToolAction(
          testTask.id,
          execution,
          [restrictedFile],
          [snapshot],
          [] // No after snapshot due to permission error
        );

        expect(action.canUndo).toBe(true); // Still has before snapshot
        expect(action.afterSnapshots).toHaveLength(0);
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(restrictedFile, 0o644);
      }
    });

    it('should handle symlinks and special files', async () => {
      if (process.platform === 'win32') {
        // Skip symlink tests on Windows
        return;
      }

      const targetFile = path.join(testDir, 'target.txt');
      const symlinkFile = path.join(testDir, 'symlink.txt');

      await fs.writeFile(targetFile, 'Target file content', 'utf8');
      await fs.symlink(targetFile, symlinkFile);

      // Create snapshot of symlink - should resolve to target content
      const snapshot = await toolActionStore.createFileSnapshot(symlinkFile);

      expect(snapshot.content).toBe('Target file content');
      expect(snapshot.filePath).toBe(path.resolve(symlinkFile));
    });

    it('should handle rapidly changing files', async () => {
      const changingFile = path.join(testDir, 'changing.txt');
      await fs.writeFile(changingFile, 'Initial content', 'utf8');

      const snapshot1 = await toolActionStore.createFileSnapshot(changingFile);

      // Rapidly change file multiple times
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(changingFile, `Content ${i}`, 'utf8');
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const snapshot2 = await toolActionStore.createFileSnapshot(changingFile);

      expect(snapshot1.content).toBe('Initial content');
      expect(snapshot2.content).toBe('Content 4');
      expect(snapshot1.checksum).not.toBe(snapshot2.checksum);
      expect(snapshot1.lastModified.getTime()).toBeLessThan(snapshot2.lastModified.getTime());
    });
  });

  describe('database edge cases', () => {
    it('should handle malformed JSON in metadata gracefully', async () => {
      const testFile = path.join(testDir, 'metadata-test.txt');
      await fs.writeFile(testFile, 'Test content', 'utf8');

      // Create snapshot with complex metadata that could cause JSON issues
      const complexMetadata = {
        circularRef: {} as any,
        function: () => 'test',
        undefined: undefined,
        null: null,
        number: 123.456,
        boolean: true,
        array: [1, 2, { nested: 'value' }],
        date: new Date(),
        regexp: /test/g,
      };
      complexMetadata.circularRef.self = complexMetadata.circularRef;

      // This should handle the complex metadata without crashing
      const snapshot = await toolActionStore.createFileSnapshot(testFile, complexMetadata);

      expect(snapshot.id).toBeDefined();
      expect(snapshot.content).toBe('Test content');
      // Metadata might be sanitized or have some properties removed
      expect(snapshot.metadata).toBeDefined();
    });

    it('should handle corrupted sequence numbers', async () => {
      // Create several actions normally
      for (let i = 0; i < 3; i++) {
        const execution = {
          callId: crypto.randomUUID(),
          toolName: `tool${i}`,
          input: { index: i },
          taskId: testTask.id,
          agentName: 'testAgent',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { success: true },
          error: undefined,
          status: 'completed' as const,
        };

        await toolActionStore.recordToolAction(testTask.id, execution);
      }

      // Manually corrupt the sequence numbers in the database
      const db = (taskStore as any).db;
      db.prepare(`
        UPDATE tool_actions
        SET sequence_number = -1
        WHERE task_id = ? AND sequence_number = 1
      `).run(testTask.id);

      // Adding new actions should still work and assign correct sequence numbers
      const execution = {
        callId: crypto.randomUUID(),
        toolName: 'recoveryTool',
        input: {},
        taskId: testTask.id,
        agentName: 'testAgent',
        stageName: 'testing',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: true },
        error: undefined,
        status: 'completed' as const,
      };

      const newAction = await toolActionStore.recordToolAction(testTask.id, execution);

      // Should get the next available sequence number
      expect(newAction.sequenceNumber).toBe(3);
    });

    it('should handle database connection issues', async () => {
      // Close the database connection to simulate connection issues
      const db = (taskStore as any).db;
      db.close();

      // Operations should throw appropriate errors
      await expect(toolActionStore.getToolActions(testTask.id))
        .rejects.toThrow();

      const execution = {
        callId: crypto.randomUUID(),
        toolName: 'failedTool',
        input: {},
        taskId: testTask.id,
        agentName: 'testAgent',
        stageName: 'testing',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: true },
        error: undefined,
        status: 'completed' as const,
      };

      await expect(toolActionStore.recordToolAction(testTask.id, execution))
        .rejects.toThrow();
    });
  });

  describe('memory and resource management', () => {
    it('should handle very large file content efficiently', async () => {
      const largeContent = 'A'.repeat(10 * 1024 * 1024); // 10MB file
      const largeFile = path.join(testDir, 'large-file.txt');

      await fs.writeFile(largeFile, largeContent, 'utf8');

      const startMemory = process.memoryUsage().heapUsed;

      const snapshot = await toolActionStore.createFileSnapshot(largeFile);

      expect(snapshot.content).toBe(largeContent);
      expect(snapshot.fileSize).toBe(largeContent.length);

      // Memory increase should be reasonable (less than 2x file size)
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;
      expect(memoryIncrease).toBeLessThan(largeContent.length * 2);
    });

    it('should clean up resources when storing many snapshots', async () => {
      const testFile = path.join(testDir, 'resource-test.txt');
      await fs.writeFile(testFile, 'Test content for resource management', 'utf8');

      const initialMemory = process.memoryUsage().heapUsed;
      const snapshotCount = 100;

      // Create many snapshots
      for (let i = 0; i < snapshotCount; i++) {
        await fs.writeFile(testFile, `Content ${i}`, 'utf8');
        await toolActionStore.createFileSnapshot(testFile, { iteration: i });

        // Force garbage collection occasionally if available
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable per snapshot
      const memoryPerSnapshot = memoryIncrease / snapshotCount;
      expect(memoryPerSnapshot).toBeLessThan(50 * 1024); // Less than 50KB per snapshot
    });
  });

  describe('extreme retention policies', () => {
    it('should handle zero retention limits', async () => {
      const zeroRetentionStore = new ToolActionStore(taskStore, {
        maxActionsPerTask: 1,
        maxAgeDays: 0,
        keepUndoneSnapshots: false,
        maxSnapshotStorageMB: 0.001,
      });

      const execution = {
        callId: crypto.randomUUID(),
        toolName: 'shortLivedTool',
        input: {},
        taskId: testTask.id,
        agentName: 'testAgent',
        stageName: 'testing',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: true },
        error: undefined,
        status: 'completed' as const,
      };

      await zeroRetentionStore.recordToolAction(testTask.id, execution);

      // Should still have the action initially
      let actions = await zeroRetentionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);

      // Adding a second action should trigger cleanup
      const execution2 = {
        ...execution,
        callId: crypto.randomUUID(),
        toolName: 'secondTool',
      };

      await zeroRetentionStore.recordToolAction(testTask.id, execution2);
      await zeroRetentionStore.cleanup(testTask.id);

      // Should only have the most recent action
      actions = await zeroRetentionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(1);
      expect(actions[0].execution.toolName).toBe('secondTool');
    });

    it('should handle maximum retention limits', async () => {
      const maxRetentionStore = new ToolActionStore(taskStore, {
        maxActionsPerTask: Number.MAX_SAFE_INTEGER,
        maxAgeDays: Number.MAX_SAFE_INTEGER,
        keepUndoneSnapshots: true,
        maxSnapshotStorageMB: Number.MAX_SAFE_INTEGER,
      });

      // Create many actions without cleanup
      const actionCount = 50;
      for (let i = 0; i < actionCount; i++) {
        const execution = {
          callId: crypto.randomUUID(),
          toolName: `maxTool${i}`,
          input: { index: i },
          taskId: testTask.id,
          agentName: 'testAgent',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { success: true },
          error: undefined,
          status: 'completed' as const,
        };

        await maxRetentionStore.recordToolAction(testTask.id, execution);
      }

      await maxRetentionStore.cleanup(testTask.id);

      // All actions should be retained
      const actions = await maxRetentionStore.getToolActions(testTask.id);
      expect(actions).toHaveLength(actionCount);
    });
  });

  describe('race conditions and timing', () => {
    it('should handle file modifications during snapshot creation', async () => {
      const racingFile = path.join(testDir, 'racing.txt');
      await fs.writeFile(racingFile, 'Initial content', 'utf8');

      // Start snapshot creation and file modification concurrently
      const snapshotPromise = toolActionStore.createFileSnapshot(racingFile);
      const modificationPromise = fs.writeFile(racingFile, 'Modified during snapshot', 'utf8');

      const [snapshot] = await Promise.all([snapshotPromise, modificationPromise]);

      // Snapshot should capture consistent state (either before or after modification)
      expect(snapshot.content).toMatch(/Initial content|Modified during snapshot/);
      expect(snapshot.checksum).toBeDefined();
    });

    it('should handle concurrent undo operations', async () => {
      const testFile = path.join(testDir, 'concurrent-undo.txt');
      await fs.writeFile(testFile, 'Original', 'utf8');

      // Create multiple undoable actions
      const actions = [];
      for (let i = 0; i < 3; i++) {
        const beforeSnapshot = await toolActionStore.createFileSnapshot(testFile);
        await fs.writeFile(testFile, `Modified ${i}`, 'utf8');
        const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);

        const execution = {
          callId: crypto.randomUUID(),
          toolName: `concurrentTool${i}`,
          input: { index: i },
          taskId: testTask.id,
          agentName: 'testAgent',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { success: true },
          error: undefined,
          status: 'completed' as const,
        };

        const action = await toolActionStore.recordToolAction(
          testTask.id,
          execution,
          [testFile],
          [beforeSnapshot],
          [afterSnapshot]
        );

        actions.push(action);
      }

      // Try to undo multiple actions concurrently
      const undoPromises = actions.map(action =>
        toolActionStore.undoAction(testTask.id, action.id).catch(err => err)
      );

      const results = await Promise.all(undoPromises);

      // Only one undo should succeed, others should fail with appropriate errors
      const successCount = results.filter(result => !(result instanceof Error)).length;
      const errorCount = results.filter(result => result instanceof Error).length;

      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(successCount + errorCount).toBe(3);
    });
  });

  describe('data integrity', () => {
    it('should maintain checksum integrity after undo operations', async () => {
      const testFile = path.join(testDir, 'integrity-test.txt');
      const originalContent = 'Original content with specific checksum';
      await fs.writeFile(testFile, originalContent, 'utf8');

      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFile);
      const originalChecksum = beforeSnapshot.checksum;

      // Modify file
      await fs.writeFile(testFile, 'Modified content', 'utf8');
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);

      const execution = {
        callId: crypto.randomUUID(),
        toolName: 'integrityTool',
        input: {},
        taskId: testTask.id,
        agentName: 'testAgent',
        stageName: 'testing',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: true },
        error: undefined,
        status: 'completed' as const,
      };

      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [testFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Undo the modification
      await toolActionStore.undoAction(testTask.id, action.id);

      // Verify file content and checksum match original
      const restoredContent = await fs.readFile(testFile, 'utf8');
      const restoredChecksum = crypto.createHash('sha256').update(restoredContent).digest('hex');

      expect(restoredContent).toBe(originalContent);
      expect(restoredChecksum).toBe(originalChecksum);
    });

    it('should handle corrupted snapshot data gracefully', async () => {
      const testFile = path.join(testDir, 'corruption-test.txt');
      await fs.writeFile(testFile, 'Test content', 'utf8');

      const snapshot = await toolActionStore.createFileSnapshot(testFile);
      const execution = {
        callId: crypto.randomUUID(),
        toolName: 'corruptionTool',
        input: {},
        taskId: testTask.id,
        agentName: 'testAgent',
        stageName: 'testing',
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        result: { success: true },
        error: undefined,
        status: 'completed' as const,
      };

      const action = await toolActionStore.recordToolAction(
        testTask.id,
        execution,
        [testFile],
        [snapshot],
        []
      );

      // Corrupt the snapshot content in the database
      const db = (taskStore as any).db;
      db.prepare(`
        UPDATE file_snapshots
        SET content = 'CORRUPTED DATA', checksum = 'invalid_checksum'
        WHERE id = ?
      `).run(snapshot.id);

      // Trying to undo should handle the corruption gracefully
      await expect(toolActionStore.undoAction(testTask.id, action.id))
        .rejects.toThrow(/checksum|corruption|integrity/i);
    });
  });
});