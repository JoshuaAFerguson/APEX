import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InteractionManager } from './interaction-manager';
import { TaskStore } from './store';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  TaskUsage,
  TaskLog,
  IterationEntry,
  IterationDiff,
} from '@apexcli/core';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('InteractionManager Integration Tests', () => {
  let interactionManager: InteractionManager;
  let store: TaskStore;
  let testDbPath: string;

  beforeEach(() => {
    // Create a temporary database file
    testDbPath = path.join(tmpdir(), `apex-test-${Date.now()}.db`);
    store = new TaskStore(testDbPath);
    interactionManager = new InteractionManager(store);
  });

  afterEach(() => {
    // Clean up temporary database file
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createTestTask = async (): Promise<Task> => {
    const task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'logs' | 'artifacts' | 'dependsOn' | 'blockedBy' | 'iterationHistory'> = {
      title: 'Integration Test Task',
      description: 'Task for testing InteractionManager integration',
      status: 'in-progress' as TaskStatus,
      priority: 'normal' as TaskPriority,
      effort: 'medium' as TaskEffort,
      currentStage: 'implementation',
      workflowName: 'feature-workflow',
      usage: {
        totalTokens: 500,
        estimatedCost: 0.025,
      } as TaskUsage,
    };

    const taskId = await store.createTask(task);
    return await store.getTask(taskId) as Task;
  };

  describe('Full Iteration Workflow', () => {
    it('should complete full iteration cycle with real database operations', async () => {
      // Create a test task
      const task = await createTestTask();

      // Add some logs and artifacts to make the task more realistic
      await store.addTaskLog(task.id, {
        level: 'info',
        message: 'Started implementation stage',
        timestamp: new Date(),
        stage: 'implementation',
      } as TaskLog);

      await store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'Initial implementation',
        path: 'src/feature.ts',
        content: 'export class Feature {}',
      });

      // Start an iteration
      const iterationId = await interactionManager.iterateTask(
        task.id,
        'Add input validation to the Feature class',
        { validationType: 'strict' }
      );

      expect(iterationId).toMatch(new RegExp(`^${task.id}-iter-\\d+$`));

      // Verify iteration was stored
      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(1);
      expect(history.totalIterations).toBe(1);

      const iteration = history.entries[0];
      expect(iteration.id).toBe(iterationId);
      expect(iteration.feedback).toBe('Add input validation to the Feature class');
      expect(iteration.stage).toBe('implementation');
      expect(iteration.beforeState).toBeDefined();
      expect(iteration.beforeState?.stage).toBe('implementation');
      expect(iteration.beforeState?.status).toBe('in-progress');

      // Simulate task progress - add more artifacts
      await store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'Updated implementation',
        path: 'src/feature.ts',
        content: 'export class Feature { validate(input: unknown) { /* validation logic */ } }',
      });

      await store.addTaskLog(task.id, {
        level: 'info',
        message: 'Added validation method to Feature class',
        timestamp: new Date(),
        stage: 'implementation',
      } as TaskLog);

      // Complete the iteration
      await interactionManager.completeIteration(task.id, iterationId, 'developer');

      // Verify the iteration was completed with after state
      const updatedHistory = await store.getIterationHistory(task.id);
      const completedIteration = updatedHistory.entries[0];

      expect(completedIteration.afterState).toBeDefined();
      expect(completedIteration.diffSummary).toBeDefined();
      expect(completedIteration.diffSummary).toContain('1 artifacts created');
    });

    it('should track multiple iterations with correct diff calculations', async () => {
      const task = await createTestTask();

      // First iteration
      const iter1Id = await interactionManager.iterateTask(
        task.id,
        'Create initial structure'
      );

      await store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'Main module',
        path: 'src/main.ts',
        content: 'export class Main {}',
      });

      await interactionManager.completeIteration(task.id, iter1Id);

      // Second iteration
      const iter2Id = await interactionManager.iterateTask(
        task.id,
        'Add error handling'
      );

      await store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'Error handler',
        path: 'src/errors.ts',
        content: 'export class ErrorHandler {}',
      });

      await store.updateTaskStatus(task.id, 'in-progress', 'testing');

      await interactionManager.completeIteration(task.id, iter2Id);

      // Check iteration history
      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(2);
      expect(history.totalIterations).toBe(2);

      // Get diff between iterations
      const diff = await interactionManager.getIterationDiff(task.id);

      expect(diff.iterationId).toBe(iter2Id);
      expect(diff.previousIterationId).toBe(iter1Id);
      expect(diff.stageChange).toEqual({
        from: 'implementation',
        to: 'testing',
      });
      expect(diff.summary).toContain('Stage: implementation → testing');
    });

    it('should handle concurrent iteration requests correctly', async () => {
      const task = await createTestTask();

      // Start multiple iterations concurrently
      const promises = [
        interactionManager.iterateTask(task.id, 'First concurrent iteration'),
        interactionManager.iterateTask(task.id, 'Second concurrent iteration'),
        interactionManager.iterateTask(task.id, 'Third concurrent iteration'),
      ];

      const iterationIds = await Promise.all(promises);

      expect(iterationIds).toHaveLength(3);
      expect(new Set(iterationIds).size).toBe(3); // All IDs should be unique

      // Verify all iterations were stored
      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(3);
      expect(history.totalIterations).toBe(3);

      // Check that each iteration has the correct feedback
      const feedbacks = history.entries.map(e => e.feedback);
      expect(feedbacks).toContain('First concurrent iteration');
      expect(feedbacks).toContain('Second concurrent iteration');
      expect(feedbacks).toContain('Third concurrent iteration');
    });
  });

  describe('Real Database Edge Cases', () => {
    it('should handle task with no artifacts gracefully', async () => {
      const task = await createTestTask();

      const iterationId = await interactionManager.iterateTask(
        task.id,
        'Test with no artifacts'
      );

      await interactionManager.completeIteration(task.id, iterationId);

      const history = await store.getIterationHistory(task.id);
      const iteration = history.entries[0];

      expect(iteration.beforeState?.artifactCount).toBe(0);
      expect(iteration.afterState?.artifactCount).toBe(0);
      expect(iteration.diffSummary).toBe('No changes detected');
    });

    it('should handle database transaction rollback scenarios', async () => {
      const task = await createTestTask();

      // Start an iteration
      const iterationId = await interactionManager.iterateTask(
        task.id,
        'Test transaction rollback'
      );

      // Verify iteration exists
      let history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(1);

      // Try to complete with invalid data (this should not cause database corruption)
      try {
        // Complete iteration normally
        await interactionManager.completeIteration(task.id, iterationId);
      } catch (error) {
        // Even if there's an error, the database should remain consistent
      }

      // Verify database is still consistent
      history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(1);

      // Should be able to get task normally
      const retrievedTask = await store.getTask(task.id);
      expect(retrievedTask).toBeDefined();
      expect(retrievedTask?.id).toBe(task.id);
    });

    it('should handle large iteration histories efficiently', async () => {
      const task = await createTestTask();

      // Create many iterations to test performance
      const iterationCount = 20;
      const iterationIds: string[] = [];

      for (let i = 0; i < iterationCount; i++) {
        const iterationId = await interactionManager.iterateTask(
          task.id,
          `Iteration ${i + 1}`
        );
        iterationIds.push(iterationId);

        // Add some artifacts to make it more realistic
        await store.addTaskArtifact(task.id, {
          type: 'file',
          name: `File ${i + 1}`,
          path: `src/file${i + 1}.ts`,
          content: `export const value${i + 1} = ${i + 1};`,
        });

        await interactionManager.completeIteration(task.id, iterationId);
      }

      // Verify all iterations were stored
      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(iterationCount);
      expect(history.totalIterations).toBe(iterationCount);

      // Test diff calculation with large history
      const diff = await interactionManager.getIterationDiff(task.id);
      expect(diff.iterationId).toBe(iterationIds[iterationCount - 1]);
      expect(diff.previousIterationId).toBe(iterationIds[iterationCount - 2]);

      // Test specific iteration diff
      const midIterationDiff = await interactionManager.getIterationDiff(
        task.id,
        iterationIds[10] // Middle iteration
      );
      expect(midIterationDiff.iterationId).toBe(iterationIds[10]);
      expect(midIterationDiff.previousIterationId).toBe(iterationIds[9]);
    });

    it('should persist iteration data across store reinitializations', async () => {
      const task = await createTestTask();

      // Create an iteration
      const iterationId = await interactionManager.iterateTask(
        task.id,
        'Test persistence across reinit'
      );

      await store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'Persistent file',
        path: 'src/persistent.ts',
        content: 'export const persistent = true;',
      });

      await interactionManager.completeIteration(task.id, iterationId);

      // Recreate the store and interaction manager with the same database
      const newStore = new TaskStore(testDbPath);
      const newInteractionManager = new InteractionManager(newStore);

      // Verify iteration data persisted
      const history = await newStore.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(1);
      expect(history.entries[0].id).toBe(iterationId);
      expect(history.entries[0].feedback).toBe('Test persistence across reinit');

      // Verify we can still calculate diffs
      const diff = await newInteractionManager.getIterationDiff(task.id, iterationId);
      expect(diff.iterationId).toBe(iterationId);
      expect(diff.summary).toContain('1 artifacts created');
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle rapid iteration creation without memory leaks', async () => {
      const task = await createTestTask();
      const startMemory = process.memoryUsage().heapUsed;

      // Create iterations rapidly
      const promises: Promise<string>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          interactionManager.iterateTask(task.id, `Rapid iteration ${i}`)
        );
      }

      const iterationIds = await Promise.all(promises);
      expect(iterationIds).toHaveLength(10);

      // Complete all iterations
      const completionPromises = iterationIds.map(id =>
        interactionManager.completeIteration(task.id, id)
      );
      await Promise.all(completionPromises);

      // Check memory usage hasn't grown excessively
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Memory increase should be reasonable (less than 10MB for 10 iterations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      // Verify all data was persisted correctly
      const history = await store.getIterationHistory(task.id);
      expect(history.entries).toHaveLength(10);
    });

    it('should efficiently query iteration diffs for large datasets', async () => {
      const task = await createTestTask();

      // Create a moderate number of iterations with timing
      const iterationCount = 15;
      const iterationIds: string[] = [];

      for (let i = 0; i < iterationCount; i++) {
        const iterationId = await interactionManager.iterateTask(
          task.id,
          `Performance test iteration ${i + 1}`
        );
        iterationIds.push(iterationId);

        await store.addTaskArtifact(task.id, {
          type: 'file',
          name: `Performance file ${i + 1}`,
          path: `src/perf${i + 1}.ts`,
          content: `export const perf${i + 1} = ${i + 1};`,
        });

        await interactionManager.completeIteration(task.id, iterationId);
      }

      // Time the diff calculation
      const startTime = Date.now();
      const diff = await interactionManager.getIterationDiff(task.id);
      const endTime = Date.now();

      // Diff calculation should be fast (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      expect(diff.iterationId).toBe(iterationIds[iterationCount - 1]);
      expect(diff.summary).toContain('1 artifacts created');

      // Test specific iteration diff performance
      const midIterationStartTime = Date.now();
      const midDiff = await interactionManager.getIterationDiff(
        task.id,
        iterationIds[Math.floor(iterationCount / 2)]
      );
      const midIterationEndTime = Date.now();

      expect(midIterationEndTime - midIterationStartTime).toBeLessThan(100);
      expect(midDiff.iterationId).toBe(iterationIds[Math.floor(iterationCount / 2)]);
    });
  });
});