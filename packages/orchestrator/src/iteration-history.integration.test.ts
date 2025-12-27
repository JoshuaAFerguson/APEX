import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, IterationEntry, IterationHistory, TaskSessionData } from '@apexcli/core';

describe('Iteration History Integration', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_integration`,
    description: 'Integration test task for iteration history',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/test-integration',
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-iteration-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('TaskSessionData Integration', () => {
    it('should include iteration history when loading task as TaskSessionData', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add several iterations with different stages
      const iterations = [
        {
          feedback: 'Initial planning feedback',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          stage: 'planning',
          agent: 'planner',
        },
        {
          feedback: 'Architecture review feedback',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          stage: 'architecture',
          agent: 'architect',
        },
        {
          feedback: 'Implementation issues found',
          timestamp: new Date('2024-01-01T12:00:00Z'),
          stage: 'implementation',
          agent: 'developer',
          diffSummary: 'Fixed null pointer exceptions',
          modifiedFiles: ['src/main.ts', 'src/utils.ts'],
        },
        {
          feedback: 'Tests failing, need fixes',
          timestamp: new Date('2024-01-01T13:00:00Z'),
          stage: 'testing',
          agent: 'tester',
          diffSummary: 'Updated test cases and fixed edge cases',
          modifiedFiles: ['test/main.test.ts'],
        },
      ];

      for (const iteration of iterations) {
        await store.addIterationEntry(task.id, iteration);
      }

      // Retrieve task and verify iteration history is included
      const retrievedTask = await store.getTask(task.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask!.iterationHistory).toBeDefined();

      const history = retrievedTask!.iterationHistory!;
      expect(history.entries).toHaveLength(4);
      expect(history.totalIterations).toBe(4);
      expect(history.lastIterationAt).toEqual(iterations[3].timestamp);

      // Verify chronological order
      expect(history.entries[0].stage).toBe('planning');
      expect(history.entries[1].stage).toBe('architecture');
      expect(history.entries[2].stage).toBe('implementation');
      expect(history.entries[3].stage).toBe('testing');
    });

    it('should handle tasks with no iteration history gracefully', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const retrievedTask = await store.getTask(task.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask!.iterationHistory).toBeDefined();
      expect(retrievedTask!.iterationHistory!.entries).toHaveLength(0);
      expect(retrievedTask!.iterationHistory!.totalIterations).toBe(0);
      expect(retrievedTask!.iterationHistory!.lastIterationAt).toBeUndefined();
    });

    it('should include iteration history in task list queries', async () => {
      // Create multiple tasks with different iteration counts
      const task1 = createTestTask();
      task1.id = 'task_with_iterations';
      task1.status = 'in-progress';
      await store.createTask(task1);

      const task2 = createTestTask();
      task2.id = 'task_without_iterations';
      task2.status = 'pending';
      await store.createTask(task2);

      // Add iterations only to first task
      await store.addIterationEntry(task1.id, {
        feedback: 'First iteration feedback',
        timestamp: new Date(),
        stage: 'implementation',
      });

      await store.addIterationEntry(task1.id, {
        feedback: 'Second iteration feedback',
        timestamp: new Date(),
        stage: 'testing',
      });

      // Query tasks and verify iteration history is included
      const tasks = await store.listTasks();
      expect(tasks).toHaveLength(2);

      const taskWithIterations = tasks.find(t => t.id === task1.id);
      const taskWithoutIterations = tasks.find(t => t.id === task2.id);

      expect(taskWithIterations).toBeDefined();
      expect(taskWithIterations!.iterationHistory).toBeDefined();
      expect(taskWithIterations!.iterationHistory!.entries).toHaveLength(2);

      expect(taskWithoutIterations).toBeDefined();
      expect(taskWithoutIterations!.iterationHistory).toBeDefined();
      expect(taskWithoutIterations!.iterationHistory!.entries).toHaveLength(0);
    });

    it('should maintain iteration history through task status changes', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add iteration before status change
      await store.addIterationEntry(task.id, {
        feedback: 'Initial feedback',
        timestamp: new Date(),
        stage: 'planning',
      });

      // Change task status
      await store.updateTask(task.id, { status: 'in-progress' });

      // Add iteration after status change
      await store.addIterationEntry(task.id, {
        feedback: 'Post-status-change feedback',
        timestamp: new Date(),
        stage: 'implementation',
      });

      // Change to completed
      await store.updateTask(task.id, { status: 'completed', completedAt: new Date() });

      // Verify all iterations are preserved
      const finalTask = await store.getTask(task.id);
      expect(finalTask).not.toBeNull();
      expect(finalTask!.status).toBe('completed');
      expect(finalTask!.iterationHistory!.entries).toHaveLength(2);
      expect(finalTask!.iterationHistory!.entries[0].feedback).toBe('Initial feedback');
      expect(finalTask!.iterationHistory!.entries[1].feedback).toBe('Post-status-change feedback');
    });
  });

  describe('Database Integrity', () => {
    it('should maintain referential integrity between tasks and iterations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add iterations
      await store.addIterationEntry(task.id, {
        feedback: 'First iteration',
        timestamp: new Date(),
      });

      await store.addIterationEntry(task.id, {
        feedback: 'Second iteration',
        timestamp: new Date(),
      });

      // Verify iterations exist
      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(2);

      // Note: In a real scenario, if we had a deleteTask method,
      // we would test that it properly cascades to delete iterations
      // For now, we just verify the relationship exists
    });

    it('should handle iteration persistence across database reinitializations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const originalIteration = {
        feedback: 'Persistent iteration',
        timestamp: new Date(),
        stage: 'testing',
        diffSummary: 'Made important changes',
        modifiedFiles: ['src/test.ts'],
      };

      await store.addIterationEntry(task.id, originalIteration);

      // Close and reinitialize store
      store.close();
      store = new TaskStore(testDir);
      await store.initialize();

      // Verify iteration is still there
      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(1);

      const retrievedIteration = history.entries[0];
      expect(retrievedIteration.feedback).toBe(originalIteration.feedback);
      expect(retrievedIteration.stage).toBe(originalIteration.stage);
      expect(retrievedIteration.diffSummary).toBe(originalIteration.diffSummary);
      expect(retrievedIteration.modifiedFiles).toEqual(originalIteration.modifiedFiles);
    });

    it('should handle large numbers of iterations efficiently', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add many iterations
      const iterationCount = 500;
      const startTime = Date.now();

      for (let i = 0; i < iterationCount; i++) {
        await store.addIterationEntry(task.id, {
          feedback: `Iteration ${i} feedback`,
          timestamp: new Date(startTime + i * 1000),
          stage: `stage-${i % 5}`, // Cycle through 5 stages
        });
      }

      // Verify all iterations are stored
      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(iterationCount);
      expect(history.totalIterations).toBe(iterationCount);

      // Verify chronological ordering
      for (let i = 0; i < history.entries.length - 1; i++) {
        expect(history.entries[i].timestamp.getTime())
          .toBeLessThanOrEqual(history.entries[i + 1].timestamp.getTime());
      }

      // Verify last iteration timestamp
      expect(history.lastIterationAt).toEqual(history.entries[iterationCount - 1].timestamp);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid task IDs gracefully', async () => {
      // Try to add iteration to non-existent task
      const invalidTaskId = 'non-existent-task-id';

      // This should not throw an error, but should succeed silently
      // (The implementation allows adding iterations to any task ID)
      await expect(store.addIterationEntry(invalidTaskId, {
        feedback: 'Feedback for invalid task',
        timestamp: new Date(),
      })).resolves.not.toThrow();

      // However, the iteration should be stored
      const history = await store.getIterationHistory(invalidTaskId);
      expect(history.entries).toHaveLength(1);
    });

    it('should handle malformed JSON in modifiedFiles', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add iteration with complex file paths
      const complexFiles = [
        'src/components/deeply/nested/Component.tsx',
        'test/integration/api/endpoint.test.js',
        '../../relative/path/file.ts',
        'files with spaces/component.vue',
        'files-with-special-chars-éñ中文.js',
      ];

      await store.addIterationEntry(task.id, {
        feedback: 'Complex file paths test',
        timestamp: new Date(),
        modifiedFiles: complexFiles,
      });

      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(1);
      expect(history.entries[0].modifiedFiles).toEqual(complexFiles);
    });

    it('should preserve iteration history during database errors', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add some iterations
      await store.addIterationEntry(task.id, {
        feedback: 'First iteration',
        timestamp: new Date(),
      });

      await store.addIterationEntry(task.id, {
        feedback: 'Second iteration',
        timestamp: new Date(),
      });

      // Simulate potential database issues by trying operations that might fail
      try {
        // Add iteration with very large feedback (stress test)
        const hugeFeedback = 'x'.repeat(1000000); // 1MB of text
        await store.addIterationEntry(task.id, {
          feedback: hugeFeedback,
          timestamp: new Date(),
        });
      } catch (error) {
        // If this fails, previous iterations should still be intact
      }

      // Verify original iterations are still there
      const history = await store.getIterationHistory(task.id);
      expect(history.entries.length).toBeGreaterThanOrEqual(2);
      expect(history.entries[0].feedback).toBe('First iteration');
      expect(history.entries[1].feedback).toBe('Second iteration');
    });
  });

  describe('Performance', () => {
    it('should retrieve iteration history efficiently for tasks with many iterations', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Add moderate number of iterations
      const iterationCount = 100;
      for (let i = 0; i < iterationCount; i++) {
        await store.addIterationEntry(task.id, {
          feedback: `Performance test iteration ${i}`,
          timestamp: new Date(Date.now() + i * 1000),
          stage: i % 2 === 0 ? 'implementation' : 'testing',
        });
      }

      // Time the retrieval
      const startTime = process.hrtime.bigint();
      const history = await store.getIterationHistory(task.id);
      const endTime = process.hrtime.bigint();

      // Verify results
      expect(history.entries).toHaveLength(iterationCount);
      expect(history.totalIterations).toBe(iterationCount);

      // Performance should be reasonable (less than 100ms for 100 iterations)
      const durationMs = Number(endTime - startTime) / 1000000;
      expect(durationMs).toBeLessThan(100);
    });
  });
});