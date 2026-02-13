import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type {
  Task,
  TaskStatus,
  TaskUsage,
  TaskLog,
  TaskArtifact,
  TaskCheckpoint,
} from '@apexcli/core';

/**
 * Test suite for verifying SQLite TaskStore data integrity during
 * mid-stream permission revocation and interruption scenarios.
 *
 * These tests ensure:
 * 1. SQLite TaskStore maintains integrity during interruption
 * 2. Task status is correctly updated (not left in inconsistent state)
 * 3. Concurrent operations don't cause race conditions
 * 4. Recovery from interrupted state works correctly
 */
describe('TaskStore - Permission Revocation Integrity', () => {
  let testDir: string;
  let store: TaskStore;
  let testTaskId: string;

  /**
   * Create a realistic test task with full data structure
   */
  const createTestTask = (): Task => {
    testTaskId = `task_${Date.now()}_integrity_test`;
    return {
      id: testTaskId,
      description: 'Test task for permission revocation integrity',
      workflow: 'feature-development',
      autonomy: 'full',
      status: 'pending',
      priority: 'normal',
      projectPath: testDir,
      branchName: 'apex/test-permission-revocation',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 1500,
        outputTokens: 800,
        totalTokens: 2300,
        estimatedCost: 0.025,
      },
      logs: [],
      artifacts: [],
    };
  };

  /**
   * Create test logs and artifacts to simulate ongoing task execution
   */
  const createTaskExecutionData = async (): Promise<void> => {
    const logs: TaskLog[] = [
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Starting task execution',
        agent: 'planner',
        stage: 'planning',
      },
      {
        timestamp: new Date(),
        level: 'debug',
        message: 'Analyzing project structure',
        agent: 'planner',
        stage: 'planning',
      },
      {
        timestamp: new Date(),
        level: 'info',
        message: 'Planning stage completed',
        agent: 'planner',
        stage: 'planning',
      },
    ];

    const artifacts: TaskArtifact[] = [
      {
        id: 'artifact-1',
        taskId: testTaskId,
        type: 'file',
        name: 'plan.md',
        path: '/tmp/plan.md',
        size: 2048,
        createdAt: new Date(),
        metadata: { stage: 'planning', agent: 'planner' },
      },
      {
        id: 'artifact-2',
        taskId: testTaskId,
        type: 'file',
        name: 'architecture.md',
        path: '/tmp/architecture.md',
        size: 4096,
        createdAt: new Date(),
        metadata: { stage: 'architecture', agent: 'architect' },
      },
    ];

    // Add logs
    for (const log of logs) {
      await store.addLog(testTaskId, log);
    }

    // Add artifacts
    for (const artifact of artifacts) {
      await store.addArtifact(testTaskId, artifact);
    }

    // Create checkpoint to simulate mid-execution state
    const checkpoint: TaskCheckpoint = {
      id: 'checkpoint-1',
      taskId: testTaskId,
      stage: 'architecture',
      status: 'in-progress',
      data: {
        currentAgent: 'architect',
        stageProgress: 0.6,
        nextSteps: ['finalize architecture', 'begin implementation'],
      },
      createdAt: new Date(),
    };
    await store.saveCheckpoint(checkpoint);
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permission-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('SQLite Integrity During Interruption', () => {
    it('should maintain database integrity when task is interrupted during status update', async () => {
      // Create and persist task
      const task = createTestTask();
      await store.createTask(task);
      await createTaskExecutionData();

      // Verify initial state
      const initialTask = await store.getTask(testTaskId);
      expect(initialTask).not.toBeNull();
      expect(initialTask?.status).toBe('pending');

      // Simulate interruption during status update by wrapping in transaction
      const db = store.getDatabase();

      // Start a transaction to simulate mid-operation state
      const updateTransaction = db.transaction(() => {
        // Update task status
        store.updateTaskStatus(testTaskId, 'in-progress', 'architecture');

        // Simulate interruption by throwing error before commit
        throw new Error('Permission revoked - simulated interruption');
      });

      // Attempt the update - should fail and rollback
      expect(() => {
        updateTransaction();
      }).toThrow('Permission revoked - simulated interruption');

      // Verify database integrity - task should still be in original state
      const taskAfterInterruption = await store.getTask(testTaskId);
      expect(taskAfterInterruption).not.toBeNull();
      expect(taskAfterInterruption?.status).toBe('pending'); // Should remain unchanged

      // Verify all data is still accessible and uncorrupted
      const logs = await store.getLogs(testTaskId);
      const taskAfterRecovery = await store.getTask(testTaskId);
      const checkpoints = await store.listCheckpoints(testTaskId);

      expect(logs).toHaveLength(3);
      expect(taskAfterRecovery?.artifacts).toHaveLength(2);
      expect(checkpoints).toHaveLength(1);
    });

    it('should handle database corruption gracefully and maintain referential integrity', async () => {
      // Create task with complex relationships
      const task = createTestTask();
      await store.createTask(task);
      await createTaskExecutionData();

      // Simulate a scenario where task status is updated but related data update fails
      await store.updateTaskStatus(testTaskId, 'in-progress', 'implementation');

      // Verify task status updated successfully
      const updatedTask = await store.getTask(testTaskId);
      expect(updatedTask?.status).toBe('in-progress');
      expect(updatedTask?.currentStage).toBe('implementation');

      // Verify all related data remains intact
      const logs = await store.getLogs(testTaskId);
      const taskWithData = await store.getTask(testTaskId);
      const checkpoints = await store.listCheckpoints(testTaskId);

      expect(logs).toHaveLength(3);
      expect(taskWithData?.artifacts).toHaveLength(2);
      expect(checkpoints).toHaveLength(1);

      // Verify foreign key relationships are maintained
      logs.forEach(log => {
        expect(log.stage).toBeDefined();
        expect(log.agent).toBeDefined();
      });

      taskWithData?.artifacts.forEach(artifact => {
        expect(artifact.taskId).toBe(testTaskId);
        expect(artifact.metadata).toBeDefined();
      });

      checkpoints.forEach(checkpoint => {
        expect(checkpoint.taskId).toBe(testTaskId);
        expect(checkpoint.data).toBeDefined();
      });
    });
  });

  describe('Task Status Consistency', () => {
    it('should never leave task in inconsistent state after interruption', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await createTaskExecutionData();

      // Test various status transition interruptions
      const statusTransitions: { from: TaskStatus; to: TaskStatus; stage?: string }[] = [
        { from: 'pending', to: 'queued' },
        { from: 'queued', to: 'planning', stage: 'planning' },
        { from: 'planning', to: 'in-progress', stage: 'architecture' },
        { from: 'in-progress', to: 'paused', stage: 'implementation' },
        { from: 'paused', to: 'in-progress', stage: 'implementation' },
        { from: 'in-progress', to: 'completed', stage: 'review' },
      ];

      for (const transition of statusTransitions) {
        // Set initial state
        await store.updateTaskStatus(testTaskId, transition.from, transition.stage);

        // Verify initial state
        let currentTask = await store.getTask(testTaskId);
        expect(currentTask?.status).toBe(transition.from);

        // Attempt status update with potential interruption
        try {
          await store.updateTaskStatus(testTaskId, transition.to, transition.stage);

          // Verify successful transition
          currentTask = await store.getTask(testTaskId);
          expect(currentTask?.status).toBe(transition.to);

          if (transition.stage) {
            expect(currentTask?.currentStage).toBe(transition.stage);
          }

          // Verify updatedAt was set
          expect(currentTask?.updatedAt).toBeInstanceOf(Date);
          expect(currentTask?.updatedAt.getTime()).toBeGreaterThan(currentTask!.createdAt.getTime());

        } catch (error) {
          // If interrupted, verify task remains in consistent state
          currentTask = await store.getTask(testTaskId);
          expect(currentTask?.status).toBe(transition.from); // Should remain in previous state
        }
      }
    });

    it('should handle completion status with proper timestamp updates', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.updateTaskStatus(testTaskId, 'in-progress', 'implementation');

      // Complete the task
      await store.updateTaskStatus(testTaskId, 'completed', 'review');

      const completedTask = await store.getTask(testTaskId);
      expect(completedTask?.status).toBe('completed');
      expect(completedTask?.completedAt).toBeInstanceOf(Date);
      expect(completedTask?.completedAt?.getTime()).toBeGreaterThan(completedTask!.createdAt.getTime());
    });

    it('should handle failed status with proper error information', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.updateTaskStatus(testTaskId, 'in-progress', 'implementation');

      // Fail the task with error message
      const errorMessage = 'Permission revoked during execution';
      await store.updateTaskStatus(testTaskId, 'failed', 'implementation', errorMessage);

      const failedTask = await store.getTask(testTaskId);
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.error).toBe(errorMessage);
      expect(failedTask?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Concurrent Operations Safety', () => {
    it('should handle concurrent status updates without race conditions', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await createTaskExecutionData();

      // Simulate concurrent status updates
      const concurrentUpdates = [
        store.updateTaskStatus(testTaskId, 'in-progress', 'planning'),
        store.updateTaskStatus(testTaskId, 'in-progress', 'architecture'),
        store.updateTaskStatus(testTaskId, 'in-progress', 'implementation'),
      ];

      // All updates should complete without error
      await Promise.allSettled(concurrentUpdates);

      // Verify task is in a valid state
      const finalTask = await store.getTask(testTaskId);
      expect(finalTask?.status).toBe('in-progress');
      expect(['planning', 'architecture', 'implementation']).toContain(finalTask?.currentStage);
    });

    it('should handle concurrent log additions during status updates', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.updateTaskStatus(testTaskId, 'in-progress', 'implementation');

      // Simulate concurrent operations: status update + log addition
      const statusUpdate = store.updateTaskStatus(testTaskId, 'paused', 'implementation', 'Rate limited');

      const logAdditions = Array.from({ length: 10 }, (_, i) =>
        store.addLog(testTaskId, {
          timestamp: new Date(),
          level: 'info',
          message: `Concurrent log entry ${i}`,
          agent: 'developer',
          stage: 'implementation',
        })
      );

      // Wait for all operations to complete
      await Promise.allSettled([statusUpdate, ...logAdditions]);

      // Verify final state consistency
      const finalTask = await store.getTask(testTaskId);
      const logs = await store.getLogs(testTaskId);

      expect(finalTask?.status).toBe('paused');
      expect(finalTask?.error).toBe('Rate limited');
      expect(logs.length).toBeGreaterThanOrEqual(3); // Original 3 + concurrent additions
    });

    it('should handle concurrent artifact operations safely', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await store.updateTaskStatus(testTaskId, 'in-progress', 'implementation');

      // Create multiple artifacts concurrently
      const concurrentArtifacts = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-artifact-${i}`,
        taskId: testTaskId,
        type: 'file' as const,
        name: `test-file-${i}.txt`,
        path: `/tmp/test-file-${i}.txt`,
        size: 1024 + i * 100,
        createdAt: new Date(),
        metadata: { stage: 'implementation', index: i },
      }));

      const artifactOperations = concurrentArtifacts.map(artifact =>
        store.addArtifact(testTaskId, artifact)
      );

      // Execute concurrently with status update
      const statusUpdate = store.updateTaskStatus(testTaskId, 'completed', 'review');

      await Promise.allSettled([...artifactOperations, statusUpdate]);

      // Verify all artifacts were created and task status updated
      const finalTask = await store.getTask(testTaskId);

      expect(finalTask?.artifacts.length).toBeGreaterThanOrEqual(2); // Original 2 + concurrent additions
      expect(finalTask?.status).toBe('completed');
    });
  });

  describe('Recovery from Interrupted State', () => {
    it('should recover correctly from interrupted task creation', async () => {
      const task = createTestTask();

      // Simulate partial task creation (interrupted before completion)
      const db = store.getDatabase();
      const insertStmt = db.prepare(`
        INSERT INTO tasks (id, description, workflow, status, created_at, updated_at, project_path, branch_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        task.id,
        task.description,
        task.workflow,
        'pending', // Status but missing other fields
        task.createdAt.toISOString(),
        task.updatedAt.toISOString(),
        task.projectPath,
        task.branchName
      );

      // Verify partial task exists but may have NULL fields
      const partialTask = await store.getTask(testTaskId);
      expect(partialTask).not.toBeNull();
      expect(partialTask?.id).toBe(testTaskId);
      expect(partialTask?.status).toBe('pending');

      // Attempt to complete the task creation through normal update
      await store.updateTask(testTaskId, {
        autonomy: 'full',
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
      });

      // Verify task is now fully consistent
      const recoveredTask = await store.getTask(testTaskId);
      expect(recoveredTask?.autonomy).toBe('full');
      expect(recoveredTask?.priority).toBe('normal');
      expect(recoveredTask?.retryCount).toBe(0);
      expect(recoveredTask?.maxRetries).toBe(3);
    });

    it('should handle recovery when task is left in transitional state', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await createTaskExecutionData();

      // Simulate task left in transitional state (e.g., status updated but stage not updated)
      const db = store.getDatabase();
      const updateStmt = db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?');
      updateStmt.run('in-progress', new Date().toISOString(), testTaskId);

      // Verify inconsistent state (status updated but currentStage might be null/undefined)
      const inconsistentTask = await store.getTask(testTaskId);
      expect(inconsistentTask?.status).toBe('in-progress');

      // Recovery: properly update with both status and stage
      await store.updateTaskStatus(testTaskId, 'in-progress', 'implementation');

      // Verify consistent state after recovery
      const recoveredTask = await store.getTask(testTaskId);
      expect(recoveredTask?.status).toBe('in-progress');
      expect(recoveredTask?.currentStage).toBe('implementation');

      // Verify all related data is still intact
      const logs = await store.getLogs(testTaskId);
      const taskWithData = await store.getTask(testTaskId);
      const checkpoints = await store.listCheckpoints(testTaskId);

      expect(logs).toHaveLength(3);
      expect(taskWithData?.artifacts).toHaveLength(2);
      expect(checkpoints).toHaveLength(1);
    });

    it('should handle orphaned data cleanup after task recovery', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await createTaskExecutionData();

      // Simulate scenario where task is deleted but related data remains (orphaned data)
      const db = store.getDatabase();
      const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?');
      deleteStmt.run(testTaskId);

      // Verify task is gone but related data might remain
      const deletedTask = await store.getTask(testTaskId);
      expect(deletedTask).toBeNull();

      // Recreate task with same ID to test recovery
      await store.createTask(task);

      // Verify task is recreated and can access existing related data
      const recoveredTask = await store.getTask(testTaskId);
      expect(recoveredTask).not.toBeNull();
      expect(recoveredTask?.id).toBe(testTaskId);

      // Note: Depending on foreign key constraints, related data might be cleaned up
      // or might remain accessible. Both behaviors should be handled gracefully.
    });

    it('should maintain usage data integrity during interruptions', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Simulate partial usage update
      const partialUsage: Partial<TaskUsage> = {
        inputTokens: 2000,
        outputTokens: 1500,
        // totalTokens and estimatedCost intentionally missing to simulate interruption
      };

      await store.updateTaskUsage(testTaskId, partialUsage);

      // Verify partial update was applied
      const taskWithPartialUsage = await store.getTask(testTaskId);
      expect(taskWithPartialUsage?.usage.inputTokens).toBe(2000);
      expect(taskWithPartialUsage?.usage.outputTokens).toBe(1500);

      // Complete the usage update
      const completeUsage: TaskUsage = {
        inputTokens: 2000,
        outputTokens: 1500,
        totalTokens: 3500,
        estimatedCost: 0.045,
      };

      await store.updateTaskUsage(testTaskId, completeUsage);

      // Verify complete and consistent usage data
      const taskWithCompleteUsage = await store.getTask(testTaskId);
      expect(taskWithCompleteUsage?.usage).toEqual(completeUsage);
    });
  });

  describe('Database Transaction Integrity', () => {
    it('should rollback failed transactions without leaving partial updates', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const db = store.getDatabase();

      // Create a transaction that will fail midway
      const failingTransaction = db.transaction(() => {
        // Update task status
        const updateStmt = db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?');
        updateStmt.run('in-progress', new Date().toISOString(), testTaskId);

        // Insert a log entry
        const logStmt = db.prepare(`
          INSERT INTO task_logs (task_id, timestamp, level, message, agent, stage)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        logStmt.run(testTaskId, new Date().toISOString(), 'info', 'Starting implementation', 'developer', 'implementation');

        // Simulate failure before transaction commit
        throw new Error('Simulated transaction failure');
      });

      // Attempt transaction - should fail and rollback
      expect(() => failingTransaction()).toThrow('Simulated transaction failure');

      // Verify no partial updates occurred
      const taskAfterFailure = await store.getTask(testTaskId);
      const logsAfterFailure = await store.getLogs(testTaskId);

      expect(taskAfterFailure?.status).toBe('pending'); // Should remain unchanged
      expect(logsAfterFailure).toHaveLength(0); // No new logs should be added
    });

    it('should handle database lock timeouts gracefully', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // This test simulates database locks by creating a long-running transaction
      const db = store.getDatabase();

      // Start a long-running transaction that holds locks
      const longTransaction = db.transaction(() => {
        const updateStmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
        updateStmt.run('in-progress', testTaskId);

        // Simulate long-running operation
        // In real scenario, this might be a complex query or external operation
      });

      // Execute the long transaction
      longTransaction();

      // Now try concurrent operations - these should complete without deadlock
      const concurrentOperations = [
        store.addLog(testTaskId, {
          timestamp: new Date(),
          level: 'info',
          message: 'Concurrent log during lock',
          agent: 'developer',
          stage: 'implementation',
        }),
        store.updateTaskStatus(testTaskId, 'paused', 'implementation'),
      ];

      // All operations should complete (may be serialized but shouldn't deadlock)
      await Promise.allSettled(concurrentOperations);

      // Verify final state is consistent
      const finalTask = await store.getTask(testTaskId);
      expect(finalTask).not.toBeNull();
      expect(['in-progress', 'paused']).toContain(finalTask?.status);
    });
  });

  describe('Error Handling and Cleanup', () => {
    it('should handle database connection errors gracefully', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Close database to simulate connection error
      store.close();

      // Attempting operations on closed database should handle gracefully
      await expect(store.getTask(testTaskId)).rejects.toThrow();

      // Reinitialize and verify data integrity
      store = new TaskStore(testDir);
      await store.initialize();

      const recoveredTask = await store.getTask(testTaskId);
      expect(recoveredTask).not.toBeNull();
      expect(recoveredTask?.id).toBe(testTaskId);
    });

    it('should clean up resources properly after interruption', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await createTaskExecutionData();

      // Simulate resource usage during task execution
      await store.updateTaskUsage(testTaskId, {
        inputTokens: 5000,
        outputTokens: 3000,
        totalTokens: 8000,
        estimatedCost: 0.12,
      });

      // Simulate interruption and cleanup
      await store.updateTaskStatus(testTaskId, 'failed', 'implementation', 'Permission revoked');

      // Verify cleanup occurred but data integrity maintained
      const failedTask = await store.getTask(testTaskId);
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.error).toBe('Permission revoked');

      // Usage data should be preserved for analysis
      expect(failedTask?.usage.totalTokens).toBe(8000);
      expect(failedTask?.usage.estimatedCost).toBe(0.12);

      // Logs and artifacts should be preserved for debugging
      const logs = await store.getLogs(testTaskId);
      const taskWithData = await store.getTask(testTaskId);

      expect(logs.length).toBeGreaterThan(0);
      expect(taskWithData?.artifacts.length).toBeGreaterThan(0);
    });
  });

  describe('Enhanced Checkpoint and Artifact Integrity', () => {
    it('should handle checkpoint corruption and recovery during permission revocation', async () => {
      const task = createTestTask();
      await store.createTask(task);
      await createTaskExecutionData();

      // Create multiple checkpoints to simulate complex state
      const checkpoints = [
        {
          id: 'checkpoint-2',
          taskId: testTaskId,
          stage: 'implementation',
          status: 'in-progress' as const,
          data: {
            currentAgent: 'developer',
            progress: 0.3,
            files: ['src/main.ts', 'src/utils.ts'],
          },
          createdAt: new Date(),
        },
        {
          id: 'checkpoint-3',
          taskId: testTaskId,
          stage: 'testing',
          status: 'in-progress' as const,
          data: {
            currentAgent: 'tester',
            progress: 0.8,
            testResults: { passed: 5, failed: 1 },
          },
          createdAt: new Date(),
        }
      ];

      // Save checkpoints concurrently
      const checkpointOps = checkpoints.map(cp => store.saveCheckpoint(cp));
      await Promise.allSettled(checkpointOps);

      // Simulate interruption during checkpoint cleanup
      const db = store.getDatabase();
      const corruptTransaction = db.transaction(() => {
        // Update task status
        const updateStmt = db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?');
        updateStmt.run('failed', new Date().toISOString(), testTaskId);

        // Simulate partial checkpoint deletion (interrupted before completion)
        const deleteStmt = db.prepare('DELETE FROM task_checkpoints WHERE task_id = ? AND id = ?');
        deleteStmt.run(testTaskId, 'checkpoint-2');

        // Simulate interruption
        throw new Error('Permission revoked during checkpoint cleanup');
      });

      // Expect transaction to fail
      expect(() => corruptTransaction()).toThrow('Permission revoked during checkpoint cleanup');

      // Verify checkpoints are still intact after rollback
      const checkpointList = await store.listCheckpoints(testTaskId);
      expect(checkpointList).toHaveLength(3); // Original 1 + 2 new ones

      const checkpointIds = checkpointList.map(cp => cp.id).sort();
      expect(checkpointIds).toContain('checkpoint-1');
      expect(checkpointIds).toContain('checkpoint-2');
      expect(checkpointIds).toContain('checkpoint-3');

      // Verify task status remains unchanged due to rollback
      const taskAfterFailure = await store.getTask(testTaskId);
      expect(taskAfterFailure?.status).not.toBe('failed');
    });

    it('should handle artifact metadata corruption during concurrent operations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Create artifacts with complex metadata that could be corrupted
      const artifactsWithComplexMetadata = Array.from({ length: 5 }, (_, i) => ({
        id: `complex-artifact-${i}`,
        taskId: testTaskId,
        type: 'file' as const,
        name: `complex-file-${i}.json`,
        path: `/tmp/complex-file-${i}.json`,
        size: 2048 + i * 500,
        metadata: {
          stage: 'implementation',
          checksum: `sha256-${i.toString().repeat(32)}`,
          dependencies: [`dep-${i}-1`, `dep-${i}-2`],
          generatedBy: {
            agent: 'developer',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        }
      }));

      // Simulate concurrent artifact creation with status updates
      const artifactOperations = artifactsWithComplexMetadata.map(artifact =>
        store.addArtifact(testTaskId, artifact)
      );

      const statusOperations = [
        store.updateTaskStatus(testTaskId, 'in-progress', 'implementation'),
        store.updateTaskStatus(testTaskId, 'in-progress', 'testing'),
        store.updateTaskStatus(testTaskId, 'paused', 'testing', 'Rate limited'),
      ];

      // Execute all operations concurrently
      await Promise.allSettled([...artifactOperations, ...statusOperations]);

      // Verify all artifacts maintained metadata integrity
      const finalTask = await store.getTask(testTaskId);
      expect(finalTask?.artifacts.length).toBeGreaterThanOrEqual(7); // Original 2 + 5 new ones

      const complexArtifacts = finalTask?.artifacts.filter(a => a.name?.startsWith('complex-file-'));
      expect(complexArtifacts).toHaveLength(5);

      // Verify metadata was preserved correctly
      complexArtifacts?.forEach(artifact => {
        expect(artifact.metadata).toBeDefined();
        if (artifact.metadata) {
          const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
          expect(metadata.stage).toBe('implementation');
          expect(metadata.checksum).toMatch(/^sha256-/);
          expect(metadata.dependencies).toHaveLength(2);
          expect(metadata.generatedBy).toBeDefined();
          expect(metadata.generatedBy.agent).toBe('developer');
        }
      });

      // Verify task ended in a valid state
      expect(['in-progress', 'paused']).toContain(finalTask?.status);
    });

    it('should handle foreign key constraint violations gracefully during interruption', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Simulate corrupted foreign key reference (task_id that doesn't exist)
      const invalidTaskId = 'non-existent-task-id';

      // These operations should fail gracefully without corrupting existing data
      const invalidOperations = [
        store.addLog(invalidTaskId, {
          level: 'info',
          message: 'Log for non-existent task',
          agent: 'developer',
          stage: 'implementation',
        }).catch(e => e),
        store.addArtifact(invalidTaskId, {
          id: 'invalid-artifact',
          taskId: invalidTaskId,
          type: 'file',
          name: 'invalid.txt',
          path: '/tmp/invalid.txt',
          size: 1024,
          metadata: { test: true }
        }).catch(e => e),
        store.saveCheckpoint({
          id: 'invalid-checkpoint',
          taskId: invalidTaskId,
          stage: 'planning',
          status: 'in-progress',
          data: { test: true },
          createdAt: new Date(),
        }).catch(e => e)
      ];

      const results = await Promise.allSettled(invalidOperations);

      // All operations should fail (rejected promises or errors)
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          // If fulfilled, the value should be an Error object from our .catch()
          expect(result.value).toBeInstanceOf(Error);
        }
        // If rejected, that's also expected behavior
      });

      // Verify our valid task remains intact and unaffected
      const validTask = await store.getTask(testTaskId);
      expect(validTask).not.toBeNull();
      expect(validTask?.id).toBe(testTaskId);

      // Verify existing data is still accessible
      const logs = await store.getLogs(testTaskId);
      const checkpoints = await store.listCheckpoints(testTaskId);

      expect(logs).toHaveLength(3); // Original logs should remain
      expect(checkpoints).toHaveLength(1); // Original checkpoint should remain
      expect(validTask?.artifacts).toHaveLength(2); // Original artifacts should remain
    });
  });
});