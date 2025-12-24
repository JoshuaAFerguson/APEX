import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor } from '../idle-processor';
import { TaskStore } from '../store';
import { DaemonConfig, IdleTask, TaskPriority, TaskEffort } from '@apexcli/core';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

describe('IdleProcessor - Database Integration', () => {
  let idleProcessor: IdleProcessor;
  let taskStore: TaskStore;
  let mockConfig: DaemonConfig;
  let testProjectPath: string;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testProjectPath = path.join(__dirname, '../../__test_temp__', `idle_processor_test_${Date.now()}`);
    testDbPath = path.join(testProjectPath, '.apex', 'apex.db');

    // Ensure clean state
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testProjectPath, { recursive: true });

    mockConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000, // 5 minutes
        taskGenerationInterval: 3600000, // 1 hour
        maxIdleTasks: 5,
      },
    };

    // Initialize real TaskStore
    taskStore = new TaskStore(testProjectPath);
    await taskStore.initialize();

    // Initialize IdleProcessor with real store
    idleProcessor = new IdleProcessor(testProjectPath, mockConfig, taskStore);
  });

  afterEach(async () => {
    // Clean up test database
    if (fs.existsSync(testProjectPath)) {
      try {
        // Close database connections first
        if (taskStore) {
          await taskStore.close?.();
        }
        // Small delay to ensure database is closed
        await new Promise(resolve => setTimeout(resolve, 100));
        fs.rmSync(testProjectPath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Cleanup warning: ${error}`);
      }
    }
  });

  describe('getGeneratedTasks() database integration', () => {
    it('should return empty array when no idle tasks exist', async () => {
      const tasks = await idleProcessor.getGeneratedTasks();
      expect(tasks).toEqual([]);
    });

    it('should retrieve idle tasks from database', async () => {
      // Create test idle tasks directly in database
      const testTask1: IdleTask = {
        id: 'idle-test-1',
        type: 'improvement',
        title: 'Test Coverage Improvement',
        description: 'Improve test coverage for core modules',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Low test coverage detected',
        createdAt: new Date(),
        implemented: false,
      };

      const testTask2: IdleTask = {
        id: 'idle-test-2',
        type: 'maintenance',
        title: 'Dependencies Update',
        description: 'Update outdated dependencies',
        priority: 'low' as TaskPriority,
        estimatedEffort: 'high' as TaskEffort,
        suggestedWorkflow: 'maintenance',
        rationale: 'Outdated packages found',
        createdAt: new Date(),
        implemented: false,
      };

      // Insert tasks into database
      await taskStore.createIdleTask(testTask1);
      await taskStore.createIdleTask(testTask2);

      // Retrieve tasks through IdleProcessor
      const retrievedTasks = await idleProcessor.getGeneratedTasks();

      expect(retrievedTasks).toHaveLength(2);
      expect(retrievedTasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'idle-test-1',
            title: 'Test Coverage Improvement',
            implemented: false,
          }),
          expect.objectContaining({
            id: 'idle-test-2',
            title: 'Dependencies Update',
            implemented: false,
          }),
        ])
      );
    });

    it('should filter out implemented tasks by default', async () => {
      const implementedTask: IdleTask = {
        id: 'idle-implemented',
        type: 'improvement',
        title: 'Implemented Task',
        description: 'This task has been implemented',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Test rationale',
        createdAt: new Date(),
        implemented: true,
        implementedTaskId: 'real-task-123',
      };

      const pendingTask: IdleTask = {
        id: 'idle-pending',
        type: 'maintenance',
        title: 'Pending Task',
        description: 'This task is still pending',
        priority: 'low' as TaskPriority,
        estimatedEffort: 'low' as TaskEffort,
        suggestedWorkflow: 'maintenance',
        rationale: 'Still needs work',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(implementedTask);
      await taskStore.createIdleTask(pendingTask);

      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('idle-pending');
      expect(tasks[0].implemented).toBe(false);
    });
  });

  describe('implementIdleTask() database integration', () => {
    let testIdleTask: IdleTask;

    beforeEach(async () => {
      testIdleTask = {
        id: 'idle-implement-test',
        type: 'improvement',
        title: 'Performance Optimization',
        description: 'Optimize database queries',
        priority: 'high' as TaskPriority,
        estimatedEffort: 'high' as TaskEffort,
        suggestedWorkflow: 'optimization',
        rationale: 'Slow queries detected in analytics',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(testIdleTask);
    });

    it('should convert idle task to real task and mark as implemented', async () => {
      // Implement the idle task
      const realTaskId = await idleProcessor.implementIdleTask(testIdleTask.id);

      expect(realTaskId).toBeTruthy();

      // Verify real task was created
      const realTask = await taskStore.getTask(realTaskId);
      expect(realTask).toBeDefined();
      expect(realTask?.description).toBe(testIdleTask.description);
      expect(realTask?.priority).toBe(testIdleTask.priority);

      // Verify idle task was marked as implemented
      const updatedIdleTask = await taskStore.getIdleTask(testIdleTask.id);
      expect(updatedIdleTask?.implemented).toBe(true);
      expect(updatedIdleTask?.implementedTaskId).toBe(realTaskId);
    });

    it('should throw error when idle task not found', async () => {
      await expect(
        idleProcessor.implementIdleTask('non-existent-task')
      ).rejects.toThrow('Idle task non-existent-task not found');
    });

    it('should throw error when idle task already implemented', async () => {
      // First implementation
      await idleProcessor.implementIdleTask(testIdleTask.id);

      // Second attempt should fail
      await expect(
        idleProcessor.implementIdleTask(testIdleTask.id)
      ).rejects.toThrow('Idle task idle-implement-test has already been implemented');
    });

    it('should create real task with correct acceptance criteria', async () => {
      const realTaskId = await idleProcessor.implementIdleTask(testIdleTask.id);
      const realTask = await taskStore.getTask(realTaskId);

      expect(realTask?.acceptanceCriteria).toBe(
        `Implement ${testIdleTask.title}. ${testIdleTask.rationale}`
      );
      expect(realTask?.workflow).toBe(testIdleTask.suggestedWorkflow);
    });
  });

  describe('Database persistence across processor instances', () => {
    it('should persist idle tasks across IdleProcessor instances', async () => {
      const testTask: IdleTask = {
        id: 'persistent-task',
        type: 'documentation',
        title: 'API Documentation',
        description: 'Document REST API endpoints',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'documentation',
        rationale: 'Missing API documentation',
        createdAt: new Date(),
        implemented: false,
      };

      // Create task with first processor instance
      await taskStore.createIdleTask(testTask);
      let tasks = await idleProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(1);

      // Create new processor instance with same store
      const newProcessor = new IdleProcessor(testProjectPath, mockConfig, taskStore);

      // Verify task persists
      tasks = await newProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('persistent-task');
    });

    it('should maintain implementation state across instances', async () => {
      const testTask: IdleTask = {
        id: 'state-persistence-test',
        type: 'maintenance',
        title: 'Cleanup Task',
        description: 'Remove unused code',
        priority: 'low' as TaskPriority,
        estimatedEffort: 'low' as TaskEffort,
        suggestedWorkflow: 'maintenance',
        rationale: 'Dead code detected',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(testTask);

      // Implement with first processor
      const realTaskId = await idleProcessor.implementIdleTask(testTask.id);

      // Create new processor instance
      const newProcessor = new IdleProcessor(testProjectPath, mockConfig, taskStore);

      // Verify implementation state persists
      const tasks = await newProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(0); // Implemented tasks filtered out

      // Verify we can't implement again
      await expect(
        newProcessor.implementIdleTask(testTask.id)
      ).rejects.toThrow('has already been implemented');
    });
  });

  describe('Database transaction integrity', () => {
    it('should handle concurrent task implementations', async () => {
      // Create multiple idle tasks
      const tasks: IdleTask[] = [];
      for (let i = 1; i <= 3; i++) {
        const task: IdleTask = {
          id: `concurrent-task-${i}`,
          type: 'improvement',
          title: `Concurrent Task ${i}`,
          description: `Description ${i}`,
          priority: 'normal' as TaskPriority,
          estimatedEffort: 'medium' as TaskEffort,
          suggestedWorkflow: 'testing',
          rationale: `Rationale ${i}`,
          createdAt: new Date(),
          implemented: false,
        };
        tasks.push(task);
        await taskStore.createIdleTask(task);
      }

      // Implement tasks concurrently
      const implementations = tasks.map(task =>
        idleProcessor.implementIdleTask(task.id)
      );

      const realTaskIds = await Promise.all(implementations);

      // Verify all implementations succeeded
      expect(realTaskIds).toHaveLength(3);
      expect(new Set(realTaskIds).size).toBe(3); // All IDs are unique

      // Verify all idle tasks are marked as implemented
      for (const task of tasks) {
        const updatedTask = await taskStore.getIdleTask(task.id);
        expect(updatedTask?.implemented).toBe(true);
        expect(updatedTask?.implementedTaskId).toBeTruthy();
      }
    });

    it('should maintain database consistency on errors', async () => {
      const validTask: IdleTask = {
        id: 'valid-task',
        type: 'improvement',
        title: 'Valid Task',
        description: 'This is a valid task',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium' as TaskEffort,
        suggestedWorkflow: 'testing',
        rationale: 'Valid rationale',
        createdAt: new Date(),
        implemented: false,
      };

      await taskStore.createIdleTask(validTask);

      // Try to implement invalid task (should fail)
      try {
        await idleProcessor.implementIdleTask('invalid-task-id');
      } catch (error) {
        // Expected error
      }

      // Verify valid task is still available for implementation
      const tasks = await idleProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('valid-task');

      // Verify we can still implement the valid task
      const realTaskId = await idleProcessor.implementIdleTask('valid-task');
      expect(realTaskId).toBeTruthy();
    });
  });
});