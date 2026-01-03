import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import type { Task, FileSnapshot } from '@apexcli/core';

describe('Snapshot Integration Tests', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_integration`,
    description: 'Integration test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/integration-test',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-snapshot-integration-test-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Complete Snapshot Workflow', () => {
    it('should handle complete snapshot lifecycle', async () => {
      // Create a task
      const task = createTestTask();
      await store.createTask(task);

      // Create file snapshots
      const fileSnapshots: FileSnapshot[] = [
        {
          id: 'snap_1',
          filePath: '/project/src/main.ts',
          content: 'console.log("Hello World");',
          checksum: 'abc123',
          fileSize: 26,
          lastModified: new Date(),
          snapshotTime: new Date(),
          existed: true,
          metadata: { language: 'typescript' }
        },
        {
          id: 'snap_2',
          filePath: '/project/src/utils.ts',
          content: 'export const add = (a: number, b: number) => a + b;',
          checksum: 'def456',
          fileSize: 50,
          lastModified: new Date(),
          snapshotTime: new Date(),
          existed: false // New file
        }
      ];

      // Save snapshot
      await store.saveSnapshot(
        task.id,
        'action_workflow_test',
        'edit',
        fileSnapshots,
        'Workflow integration test'
      );

      // Verify snapshot was saved
      const allSnapshots = await store.getSnapshots(task.id);
      expect(allSnapshots).toHaveLength(1);

      const snapshot = allSnapshots[0];
      expect(snapshot.taskId).toBe(task.id);
      expect(snapshot.actionId).toBe('action_workflow_test');
      expect(snapshot.toolName).toBe('edit');
      expect(snapshot.description).toBe('Workflow integration test');
      expect(snapshot.fileSnapshots).toHaveLength(2);

      // Verify file snapshot details
      const mainSnapshot = snapshot.fileSnapshots.find(fs => fs.filePath === '/project/src/main.ts');
      expect(mainSnapshot).toBeDefined();
      expect(mainSnapshot!.content).toBe('console.log("Hello World");');
      expect(mainSnapshot!.existed).toBe(true);

      const utilsSnapshot = snapshot.fileSnapshots.find(fs => fs.filePath === '/project/src/utils.ts');
      expect(utilsSnapshot).toBeDefined();
      expect(utilsSnapshot!.existed).toBe(false);

      // Test getLatestSnapshot
      const latest = await store.getLatestSnapshot(task.id);
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe(snapshot.id);

      // Clean up
      const deletedCount = await store.deleteSnapshots(task.id);
      expect(deletedCount).toBe(1);

      // Verify cleanup
      const remaining = await store.getSnapshots(task.id);
      expect(remaining).toEqual([]);
    });

    it('should handle multiple snapshots with different actions', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Create first snapshot
      const firstSnapshots: FileSnapshot[] = [{
        id: 'first_snap',
        filePath: '/test/file1.js',
        content: 'var x = 1;',
        checksum: 'hash1',
        fileSize: 10,
        lastModified: new Date(),
        snapshotTime: new Date(),
        existed: true
      }];

      await store.saveSnapshot(task.id, 'action_1', 'edit', firstSnapshots, 'First action');

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Create second snapshot
      const secondSnapshots: FileSnapshot[] = [{
        id: 'second_snap',
        filePath: '/test/file2.js',
        content: 'const y = 2;',
        checksum: 'hash2',
        fileSize: 12,
        lastModified: new Date(),
        snapshotTime: new Date(),
        existed: false
      }];

      await store.saveSnapshot(task.id, 'action_2', 'write', secondSnapshots, 'Second action');

      // Verify both snapshots exist
      const allSnapshots = await store.getSnapshots(task.id);
      expect(allSnapshots).toHaveLength(2);

      // Verify latest is the second one
      const latest = await store.getLatestSnapshot(task.id);
      expect(latest!.actionId).toBe('action_2');

      // Test filtering by action
      const firstOnly = await store.getSnapshots(task.id, 'action_1');
      expect(firstOnly).toHaveLength(1);
      expect(firstOnly[0].toolName).toBe('edit');

      // Delete specific action
      const deletedCount = await store.deleteSnapshots(task.id, 'action_1');
      expect(deletedCount).toBe(1);

      // Verify only one remains
      const remaining = await store.getSnapshots(task.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].actionId).toBe('action_2');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should reject snapshots for non-existent tasks', async () => {
      const fileSnapshots: FileSnapshot[] = [{
        id: 'error_snap',
        filePath: '/test/error.js',
        content: 'error test',
        checksum: 'error_hash',
        fileSize: 10,
        lastModified: new Date(),
        snapshotTime: new Date(),
        existed: true
      }];

      await expect(
        store.saveSnapshot('non_existent_task', 'action_error', 'edit', fileSnapshots)
      ).rejects.toThrow();
    });

    it('should enforce unique constraint on task_id and action_id', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const fileSnapshots: FileSnapshot[] = [{
        id: 'unique_snap',
        filePath: '/test/unique.js',
        content: 'unique test',
        checksum: 'unique_hash',
        fileSize: 11,
        lastModified: new Date(),
        snapshotTime: new Date(),
        existed: true
      }];

      // First save should succeed
      await expect(
        store.saveSnapshot(task.id, 'duplicate_action', 'edit', fileSnapshots)
      ).resolves.not.toThrow();

      // Second save with same task_id and action_id should fail
      await expect(
        store.saveSnapshot(task.id, 'duplicate_action', 'write', fileSnapshots)
      ).rejects.toThrow();
    });

    it('should handle empty file snapshots array', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Should not throw with empty array
      await expect(
        store.saveSnapshot(task.id, 'empty_action', 'cleanup', [], 'No files changed')
      ).resolves.not.toThrow();

      const snapshots = await store.getSnapshots(task.id);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].fileSnapshots).toEqual([]);
    });
  });
});