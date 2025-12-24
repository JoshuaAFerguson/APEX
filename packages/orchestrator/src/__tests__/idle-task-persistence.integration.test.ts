import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IdleProcessor } from '../idle-processor';
import { TaskStore } from '../store';
import { DaemonConfig, IdleTask, TaskPriority, TaskEffort, IdleTaskType } from '@apexcli/core';
import * as fs from 'fs';
import * as path from 'path';

describe('IdleTask Persistence Integration', () => {
  let taskStore: TaskStore;
  let testProjectPath: string;
  let idleProcessor: IdleProcessor;
  let mockConfig: DaemonConfig;

  beforeEach(async () => {
    // Create unique test directory for each test
    testProjectPath = path.join(__dirname, '../../__test_temp__', `persistence_test_${Date.now()}`);

    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testProjectPath, { recursive: true });

    mockConfig = {
      idleProcessing: {
        enabled: true,
        maxIdleTasks: 10,
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

  describe('Idle Task CRUD Operations', () => {
    it('should persist idle task through complete lifecycle', async () => {
      const originalTask: IdleTask = {
        id: 'lifecycle-test',
        type: 'improvement' as IdleTaskType,
        title: 'Performance Enhancement',
        description: 'Optimize critical performance bottlenecks',
        priority: 'high' as TaskPriority,
        estimatedEffort: 'high' as TaskEffort,
        suggestedWorkflow: 'optimization',
        rationale: 'Performance metrics show degradation',
        createdAt: new Date(),
        implemented: false,
      };

      // 1. Create idle task
      await taskStore.createIdleTask(originalTask);

      // 2. Verify creation through getGeneratedTasks
      let tasks = await idleProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        id: originalTask.id,
        title: originalTask.title,
        implemented: false,
      });

      // 3. Implement the task
      const realTaskId = await idleProcessor.implementIdleTask(originalTask.id);
      expect(realTaskId).toBeTruthy();

      // 4. Verify implementation status
      const implementedTask = await taskStore.getIdleTask(originalTask.id);
      expect(implementedTask?.implemented).toBe(true);
      expect(implementedTask?.implementedTaskId).toBe(realTaskId);

      // 5. Verify implemented tasks are filtered out
      tasks = await idleProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(0);

      // 6. Verify real task was created
      const realTask = await taskStore.getTask(realTaskId);
      expect(realTask).toBeDefined();
      expect(realTask?.description).toBe(originalTask.description);
    });

    it('should handle multiple idle tasks of different types', async () => {
      const tasks: IdleTask[] = [
        {
          id: 'improvement-task',
          type: 'improvement',
          title: 'Code Quality Improvement',
          description: 'Refactor legacy components',
          priority: 'normal' as TaskPriority,
          estimatedEffort: 'medium' as TaskEffort,
          suggestedWorkflow: 'refactoring',
          rationale: 'Technical debt accumulation',
          createdAt: new Date(),
          implemented: false,
        },
        {
          id: 'maintenance-task',
          type: 'maintenance',
          title: 'Dependency Updates',
          description: 'Update npm packages',
          priority: 'low' as TaskPriority,
          estimatedEffort: 'low' as TaskEffort,
          suggestedWorkflow: 'maintenance',
          rationale: 'Security updates available',
          createdAt: new Date(),
          implemented: false,
        },
        {
          id: 'documentation-task',
          type: 'documentation',
          title: 'API Documentation',
          description: 'Document REST endpoints',
          priority: 'normal' as TaskPriority,
          estimatedEffort: 'medium' as TaskEffort,
          suggestedWorkflow: 'documentation',
          rationale: 'Missing API docs',
          createdAt: new Date(),
          implemented: false,
        },
      ];

      // Create all tasks
      for (const task of tasks) {
        await taskStore.createIdleTask(task);
      }

      // Verify all tasks are retrievable
      const retrievedTasks = await idleProcessor.getGeneratedTasks();
      expect(retrievedTasks).toHaveLength(3);

      // Verify task types are preserved
      const taskTypes = retrievedTasks.map(t => t.type).sort();
      expect(taskTypes).toEqual(['documentation', 'improvement', 'maintenance']);

      // Implement one task and verify count reduces
      await idleProcessor.implementIdleTask('improvement-task');
      const remainingTasks = await idleProcessor.getGeneratedTasks();
      expect(remainingTasks).toHaveLength(2);
    });

    it('should preserve task order and timestamps', async () => {
      const now = new Date();
      const tasks: IdleTask[] = [];

      // Create tasks with specific timestamps
      for (let i = 0; i < 3; i++) {
        const taskTime = new Date(now.getTime() + i * 1000); // 1 second apart
        const task: IdleTask = {
          id: `timestamp-task-${i}`,
          type: 'improvement',
          title: `Task ${i}`,
          description: `Description ${i}`,
          priority: 'normal' as TaskPriority,
          estimatedEffort: 'medium' as TaskEffort,
          suggestedWorkflow: 'testing',
          rationale: `Rationale ${i}`,
          createdAt: taskTime.toISOString(),
          implemented: false,
        };
        tasks.push(task);
        await taskStore.createIdleTask(task);

        // Small delay to ensure timestamp ordering
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const retrievedTasks = await idleProcessor.getGeneratedTasks();
      expect(retrievedTasks).toHaveLength(3);

      // Verify timestamps are preserved
      for (let i = 0; i < 3; i++) {
        const retrieved = retrievedTasks.find(t => t.id === `timestamp-task-${i}`);
        expect(retrieved?.createdAt?.getTime()).toBe(tasks[i].createdAt.getTime());
      }
    });
  });

  describe('Database Constraints and Validation', () => {
    it('should handle task with minimal valid data', async () => {
      const minimalTask: IdleTask = {
        id: 'minimal-test',
        type: 'improvement',
        title: 'Minimal Task',
        description: 'Basic description',
        priority: 'low' as TaskPriority,
        estimatedEffort: 'low' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Basic rationale',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(minimalTask);
      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject(minimalTask);
    });

    it('should handle task with maximum data', async () => {
      const maximalTask: IdleTask = {
        id: 'maximal-test-with-very-long-id-that-tests-length-limits',
        type: 'optimization',
        title: 'Comprehensive Performance Optimization Initiative',
        description: `This is a very detailed description that explains the full scope of work needed for comprehensive performance optimization.
        It includes analysis of bottlenecks, profiling requirements, optimization strategies, and implementation details.
        This tests the handling of longer text content.`,
        priority: 'high' as TaskPriority,
        estimatedEffort: 'high' as TaskEffort,
        suggestedWorkflow: 'optimization',
        rationale: `Performance analysis shows significant degradation in key user flows.
        Critical areas include: database query optimization, frontend bundle optimization,
        API response time improvements, and caching strategy implementation.`,
        createdAt: new Date(),
        implemented: false,
        implementedTaskId: undefined, // Test optional fields
      };

      await taskStore.createIdleTask(maximalTask);
      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject(maximalTask);
    });

    it('should maintain referential integrity with real tasks', async () => {
      const idleTask: IdleTask = {
        id: 'referential-test',
        type: 'improvement',
        title: 'Referential Integrity Test',
        description: 'Test task for referential integrity',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Testing database constraints',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(idleTask);
      const realTaskId = await idleProcessor.implementIdleTask(idleTask.id);

      // Verify the real task exists
      const realTask = await taskStore.getTask(realTaskId);
      expect(realTask).toBeDefined();

      // Verify the idle task references the real task
      const updatedIdleTask = await taskStore.getIdleTask(idleTask.id);
      expect(updatedIdleTask?.implementedTaskId).toBe(realTaskId);

      // Delete the real task and verify idle task still exists
      // (This tests that we don't have cascade deletion)
      await taskStore.deleteTask(realTaskId);
      const orphanedIdleTask = await taskStore.getIdleTask(idleTask.id);
      expect(orphanedIdleTask).toBeDefined();
      expect(orphanedIdleTask?.implemented).toBe(true);
      expect(orphanedIdleTask?.implementedTaskId).toBe(realTaskId);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty database gracefully', async () => {
      const tasks = await idleProcessor.getGeneratedTasks();
      expect(tasks).toEqual([]);
    });

    it('should handle large number of idle tasks', async () => {
      const taskCount = 50;
      const tasks: IdleTask[] = [];

      // Create many tasks
      for (let i = 0; i < taskCount; i++) {
        const task: IdleTask = {
          id: `bulk-task-${i.toString().padStart(3, '0')}`,
          type: i % 2 === 0 ? 'improvement' : 'maintenance',
          title: `Bulk Task ${i}`,
          description: `Description for task ${i}`,
          priority: (i % 3 === 0 ? 'high' : i % 3 === 1 ? 'normal' : 'low') as TaskPriority,
          estimatedEffort: (i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low') as TaskEffort,
          suggestedWorkflow: 'testing',
          rationale: `Rationale for task ${i}`,
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
          implemented: false,
        };
        tasks.push(task);
        await taskStore.createIdleTask(task);
      }

      // Verify all tasks are retrievable
      const retrievedTasks = await idleProcessor.getGeneratedTasks();
      expect(retrievedTasks).toHaveLength(taskCount);

      // Test batch implementation
      const tasksToImplement = tasks.slice(0, 10);
      const implementationPromises = tasksToImplement.map(task =>
        idleProcessor.implementIdleTask(task.id)
      );

      const realTaskIds = await Promise.all(implementationPromises);
      expect(realTaskIds).toHaveLength(10);
      expect(new Set(realTaskIds).size).toBe(10); // All unique

      // Verify remaining tasks
      const remainingTasks = await idleProcessor.getGeneratedTasks();
      expect(remainingTasks).toHaveLength(taskCount - 10);
    });

    it('should handle database corruption recovery', async () => {
      // Create some tasks normally
      const task: IdleTask = {
        id: 'corruption-test',
        type: 'improvement',
        title: 'Corruption Test',
        description: 'Test task for corruption handling',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Testing corruption handling',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(task);
      let tasks = await idleProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(1);

      // Close and reinitialize store (simulating restart)
      await taskStore.close?.();
      taskStore = new TaskStore(testProjectPath);
      await taskStore.initialize();

      // Create new processor instance
      idleProcessor = new IdleProcessor(testProjectPath, mockConfig, taskStore);

      // Verify data persisted across restart
      tasks = await idleProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('corruption-test');
    });
  });

  describe('Performance Considerations', () => {
    it('should efficiently handle rapid task creation and retrieval', async () => {
      const startTime = Date.now();
      const taskCount = 20;

      // Rapid creation
      const creationPromises = [];
      for (let i = 0; i < taskCount; i++) {
        const task: IdleTask = {
          id: `perf-task-${i}`,
          type: 'improvement',
          title: `Performance Task ${i}`,
          description: `Performance test task ${i}`,
          priority: 'normal' as TaskPriority,
          estimatedEffort: 'medium' as TaskEffort,
          suggestedWorkflow: 'testing',
          rationale: `Performance test rationale ${i}`,
          createdAt: new Date(),
          implemented: false,
        };
        creationPromises.push(taskStore.createIdleTask(task));
      }

      await Promise.all(creationPromises);
      const creationTime = Date.now() - startTime;

      // Rapid retrieval
      const retrievalStart = Date.now();
      const tasks = await idleProcessor.getGeneratedTasks();
      const retrievalTime = Date.now() - retrievalStart;

      expect(tasks).toHaveLength(taskCount);
      expect(creationTime).toBeLessThan(5000); // 5 seconds max for creation
      expect(retrievalTime).toBeLessThan(1000); // 1 second max for retrieval
    });

    it('should handle concurrent implementations without corruption', async () => {
      // Create multiple tasks
      const taskCount = 5;
      const tasks: IdleTask[] = [];

      for (let i = 0; i < taskCount; i++) {
        const task: IdleTask = {
          id: `concurrent-impl-${i}`,
          type: 'improvement',
          title: `Concurrent Task ${i}`,
          description: `Concurrent implementation test ${i}`,
          priority: 'normal' as TaskPriority,
          estimatedEffort: 'medium' as TaskEffort,
          suggestedWorkflow: 'testing',
          rationale: `Concurrent test ${i}`,
          createdAt: new Date(),
          implemented: false,
        };
        tasks.push(task);
        await taskStore.createIdleTask(task);
      }

      // Implement all tasks concurrently
      const implementationPromises = tasks.map(task =>
        idleProcessor.implementIdleTask(task.id)
      );

      const realTaskIds = await Promise.all(implementationPromises);

      // Verify all implementations succeeded uniquely
      expect(realTaskIds).toHaveLength(taskCount);
      expect(new Set(realTaskIds).size).toBe(taskCount);

      // Verify all idle tasks are marked as implemented
      for (const task of tasks) {
        const updatedTask = await taskStore.getIdleTask(task.id);
        expect(updatedTask?.implemented).toBe(true);
        expect(updatedTask?.implementedTaskId).toBeTruthy();
      }

      // Verify no tasks remain for generation
      const remainingTasks = await idleProcessor.getGeneratedTasks();
      expect(remainingTasks).toHaveLength(0);
    });
  });
});