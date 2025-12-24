import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor } from '../idle-processor';
import { TaskStore } from '../store';
import { DaemonConfig, IdleTask, TaskPriority, TaskEffort } from '@apexcli/core';
import * as fs from 'fs';
import * as path from 'path';

describe('IdleProcessor - Edge Cases and Error Scenarios', () => {
  let idleProcessor: IdleProcessor;
  let taskStore: TaskStore;
  let mockConfig: DaemonConfig;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = path.join(__dirname, '../../__test_temp__', `edge_cases_test_${Date.now()}`);

    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testProjectPath, { recursive: true });

    mockConfig = {
      idleProcessing: {
        enabled: true,
        maxIdleTasks: 5,
      },
    };

    taskStore = new TaskStore(testProjectPath);
    await taskStore.initialize();
    idleProcessor = new IdleProcessor(testProjectPath, mockConfig, taskStore);
  });

  afterEach(async () => {
    if (taskStore) {
      await taskStore.close?.();
    }

    if (fs.existsSync(testProjectPath)) {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        fs.rmSync(testProjectPath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Cleanup warning: ${error}`);
      }
    }
  });

  describe('Database Connection Error Handling', () => {
    it('should handle database connection failures gracefully', async () => {
      // Close the database connection
      await taskStore.close?.();

      // Attempt operations that should fail gracefully
      await expect(idleProcessor.getGeneratedTasks()).rejects.toThrow();
      await expect(
        idleProcessor.implementIdleTask('non-existent')
      ).rejects.toThrow();
    });

    it('should recover from temporary database lock', async () => {
      const task: IdleTask = {
        id: 'lock-test',
        type: 'improvement',
        title: 'Lock Test',
        description: 'Test database locking',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Lock testing',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(task);

      // Create multiple concurrent operations that might cause locking
      const operations = Array(5).fill(0).map(() =>
        idleProcessor.getGeneratedTasks()
      );

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach(tasks => {
        expect(tasks).toHaveLength(1);
        expect(tasks[0].id).toBe('lock-test');
      });
    });
  });

  describe('Invalid Task Data Handling', () => {
    it('should handle tasks with missing optional fields', async () => {
      // Create a task with minimal required fields only
      const minimalTask: Partial<IdleTask> = {
        id: 'minimal-task',
        type: 'improvement',
        title: 'Minimal Task',
        description: 'Basic task',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Basic rationale',
        createdAt: new Date(),
        implemented: false,
        // Missing implementedTaskId (optional field)
      };

      await taskStore.createIdleTask(minimalTask as IdleTask);
      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].implementedTaskId).toBeUndefined();
    });

    it('should handle malformed date strings gracefully', async () => {
      const taskWithBadDate: IdleTask = {
        id: 'bad-date-task',
        type: 'improvement',
        title: 'Bad Date Task',
        description: 'Task with malformed date',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Date testing',
        createdAt: new Date('invalid-date-string'), // Will create Invalid Date
        implemented: false,
      };

      // The database should still store this, but applications should handle parsing
      await taskStore.createIdleTask(taskWithBadDate);
      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].createdAt).toBeInstanceOf(Date);
    });

    it('should handle extremely long text fields', async () => {
      const longText = 'A'.repeat(10000); // Very long string

      const taskWithLongText: IdleTask = {
        id: 'long-text-task',
        type: 'improvement',
        title: longText.substring(0, 100), // Truncate title
        description: longText,
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: longText,
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(taskWithLongText);
      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].description.length).toBe(10000);
    });
  });

  describe('Implementation Error Scenarios', () => {
    it('should handle implementation failure during real task creation', async () => {
      const testTask: IdleTask = {
        id: 'implementation-fail-test',
        type: 'improvement',
        title: 'Implementation Fail Test',
        description: 'Test implementation failure',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Implementation failure testing',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(testTask);

      // Mock the createTask method to fail
      const originalCreateTask = taskStore.createTask;
      taskStore.createTask = vi.fn().mockRejectedValueOnce(new Error('Task creation failed'));

      // Implementation should fail
      await expect(
        idleProcessor.implementIdleTask(testTask.id)
      ).rejects.toThrow('Task creation failed');

      // Verify idle task remains unimplemented
      const idleTask = await taskStore.getIdleTask(testTask.id);
      expect(idleTask?.implemented).toBe(false);

      // Restore original method
      taskStore.createTask = originalCreateTask;

      // Verify we can still implement after fixing the issue
      const realTaskId = await idleProcessor.implementIdleTask(testTask.id);
      expect(realTaskId).toBeTruthy();
    });

    it('should handle race conditions in implementation', async () => {
      const testTask: IdleTask = {
        id: 'race-condition-test',
        type: 'improvement',
        title: 'Race Condition Test',
        description: 'Test race condition handling',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Race condition testing',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(testTask);

      // Try to implement the same task multiple times concurrently
      const implementations = [
        idleProcessor.implementIdleTask(testTask.id),
        idleProcessor.implementIdleTask(testTask.id),
        idleProcessor.implementIdleTask(testTask.id),
      ];

      const results = await Promise.allSettled(implementations);

      // Only one should succeed
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(2);

      // Verify all failures are due to "already implemented" errors
      failures.forEach(failure => {
        if (failure.status === 'rejected') {
          expect(failure.reason.message).toContain('has already been implemented');
        }
      });
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle disabled idle processing', async () => {
      const disabledConfig: DaemonConfig = {
        idleProcessing: {
          enabled: false,
        },
      };

      const disabledProcessor = new IdleProcessor(testProjectPath, disabledConfig, taskStore);

      // Should handle operations gracefully even when disabled
      const tasks = await disabledProcessor.getGeneratedTasks();
      expect(tasks).toEqual([]);
    });

    it('should handle missing idle processing config', async () => {
      const emptyConfig: DaemonConfig = {};

      const processorWithEmptyConfig = new IdleProcessor(testProjectPath, emptyConfig, taskStore);

      // Should still work with defaults
      const task: IdleTask = {
        id: 'config-test',
        type: 'improvement',
        title: 'Config Test',
        description: 'Test with empty config',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Config testing',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(task);
      const tasks = await processorWithEmptyConfig.getGeneratedTasks();
      expect(tasks).toHaveLength(1);
    });

    it('should handle negative or zero max tasks limit', async () => {
      const negativeConfig: DaemonConfig = {
        idleProcessing: {
          enabled: true,
          maxIdleTasks: -1,
        },
      };

      const processorWithNegativeConfig = new IdleProcessor(testProjectPath, negativeConfig, taskStore);

      // Should handle gracefully, possibly defaulting to unlimited or reasonable limit
      const task: IdleTask = {
        id: 'negative-config-test',
        type: 'improvement',
        title: 'Negative Config Test',
        description: 'Test with negative max tasks',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Negative config testing',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(task);
      const tasks = await processorWithNegativeConfig.getGeneratedTasks();
      expect(tasks).toHaveLength(1); // Should still work
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle cleanup during processor destruction', async () => {
      // Create a task to ensure processor has data
      const task: IdleTask = {
        id: 'cleanup-test',
        type: 'improvement',
        title: 'Cleanup Test',
        description: 'Test cleanup handling',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Cleanup testing',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(task);
      const tasks = await idleProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(1);

      // Destroy the processor (simulate garbage collection)
      // In TypeScript/JavaScript, this is mainly about removing references
      const processorRef = idleProcessor;
      idleProcessor = null as any;

      // The original processor should still be functional if we have a reference
      const tasksAfterDestroy = await processorRef.getGeneratedTasks();
      expect(tasksAfterDestroy).toHaveLength(1);
    });

    it('should handle multiple processor instances on same store', async () => {
      const task: IdleTask = {
        id: 'multi-processor-test',
        type: 'improvement',
        title: 'Multi Processor Test',
        description: 'Test multiple processors on same store',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Multi processor testing',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(task);

      // Create multiple processors sharing the same store
      const processor1 = new IdleProcessor(testProjectPath, mockConfig, taskStore);
      const processor2 = new IdleProcessor(testProjectPath, mockConfig, taskStore);

      // Both should see the same data
      const tasks1 = await processor1.getGeneratedTasks();
      const tasks2 = await processor2.getGeneratedTasks();

      expect(tasks1).toHaveLength(1);
      expect(tasks2).toHaveLength(1);
      expect(tasks1[0].id).toBe(tasks2[0].id);

      // Implementation through one should affect the other
      await processor1.implementIdleTask(task.id);

      const tasksAfterImpl1 = await processor1.getGeneratedTasks();
      const tasksAfterImpl2 = await processor2.getGeneratedTasks();

      expect(tasksAfterImpl1).toHaveLength(0);
      expect(tasksAfterImpl2).toHaveLength(0);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle maximum length task IDs', async () => {
      const maxLengthId = 'a'.repeat(255); // Assuming reasonable max length

      const task: IdleTask = {
        id: maxLengthId,
        type: 'improvement',
        title: 'Max Length ID Test',
        description: 'Test with maximum length ID',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Max length testing',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(task);
      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(maxLengthId);
    });

    it('should handle empty string values where allowed', async () => {
      const taskWithEmptyFields: IdleTask = {
        id: 'empty-fields-test',
        type: 'improvement',
        title: '', // Empty title
        description: '', // Empty description
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: '',  // Empty workflow
        rationale: '', // Empty rationale
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(taskWithEmptyFields);
      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('');
      expect(tasks[0].description).toBe('');
    });

    it('should handle special characters in task data', async () => {
      const specialCharsTask: IdleTask = {
        id: 'special-chars-test-123!@#$%^&*()',
        type: 'improvement',
        title: 'Special Characters Test: <script>alert("xss")</script>',
        description: 'Test with "quotes", \'apostrophes\', and \n newlines \t tabs',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Special chars: µ, ©, ®, ™, €, £, ¥, §, †, ‡, •, ‰, ‹, ›, ƒ, ∆, Ω',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(specialCharsTask);
      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toContain('<script>');
      expect(tasks[0].description).toContain('"quotes"');
      expect(tasks[0].rationale).toContain('µ, ©, ®');
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistency during rapid state changes', async () => {
      const tasks: IdleTask[] = [];

      // Create multiple tasks
      for (let i = 0; i < 5; i++) {
        const task: IdleTask = {
          id: `consistency-test-${i}`,
          type: 'improvement',
          title: `Consistency Test ${i}`,
          description: `Test consistency ${i}`,
          priority: 'normal' as TaskPriority,
          estimatedEffort: 'medium' as TaskEffort,
          suggestedWorkflow: 'testing',
          rationale: `Consistency testing ${i}`,
          createdAt: new Date(),
          implemented: false,
        };
        tasks.push(task);
        await taskStore.createIdleTask(task);
      }

      // Rapid operations: get tasks, implement some, get tasks again
      const initialTasks = await idleProcessor.getGeneratedTasks();
      expect(initialTasks).toHaveLength(5);

      // Implement tasks in random order concurrently
      const implementPromises = [
        idleProcessor.implementIdleTask('consistency-test-2'),
        idleProcessor.implementIdleTask('consistency-test-4'),
      ];

      await Promise.all(implementPromises);

      const remainingTasks = await idleProcessor.getGeneratedTasks();
      expect(remainingTasks).toHaveLength(3);

      // Verify the correct tasks remain
      const remainingIds = remainingTasks.map(t => t.id).sort();
      expect(remainingIds).toEqual([
        'consistency-test-0',
        'consistency-test-1',
        'consistency-test-3'
      ]);
    });
  });
});