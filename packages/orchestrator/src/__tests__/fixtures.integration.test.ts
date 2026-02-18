/**
 * @fileoverview Integration tests for TaskStore test fixtures module
 *
 * Tests that verify the fixtures module integrates well with other parts of the system
 * including TaskStore, database operations, and existing test utilities.
 */

import {
  createTestTask,
  createTestAgent,
  createTestWorkflow,
  createTestTasks,
  createMockTask,
  createTestTaskStore,
  DatabaseSeeder,
  seedPendingTask,
  seedRunningTask,
  seedCompletedTask,
} from '../fixtures.js';

import { TaskStore } from '../store.js';

describe('TaskStore Test Fixtures Integration', () => {
  let taskStore: TaskStore;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary TaskStore for testing
    taskStore = createTestTaskStore();
    tempDir = ':memory:'; // SQLite in-memory database for tests
  });

  afterEach(async () => {
    if (taskStore) {
      taskStore.close();
    }
  });

  // ============================================================================
  // Integration with TaskStore
  // ============================================================================

  describe('TaskStore Integration', () => {
    it('should create tasks that can be stored in TaskStore', async () => {
      const task = createTestTask({
        description: 'Integration test task',
        status: 'pending',
      });

      // Store the task
      await taskStore.createTask(task);

      // Retrieve and verify
      const retrieved = await taskStore.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(task.id);
      expect(retrieved!.description).toBe('Integration test task');
      expect(retrieved!.status).toBe('pending');
    });

    it('should work with bulk-created tasks', async () => {
      const tasks = createTestTasks(3, (index) => ({
        description: `Bulk task ${index + 1}`,
        priority: index === 0 ? 'urgent' : 'normal',
      }));

      // Store all tasks
      for (const task of tasks) {
        await taskStore.createTask(task);
      }

      // Retrieve and verify
      for (let i = 0; i < tasks.length; i++) {
        const retrieved = await taskStore.getTask(tasks[i].id);
        expect(retrieved).toBeDefined();
        expect(retrieved!.description).toBe(`Bulk task ${i + 1}`);
        expect(retrieved!.priority).toBe(i === 0 ? 'urgent' : 'normal');
      }
    });

    it('should support task status transitions', async () => {
      const task = createTestTask({
        description: 'Status transition test',
        status: 'pending',
      });

      await taskStore.createTask(task);

      // Update status to in-progress
      const updatedTask = { ...task, status: 'in-progress' as const };
      await taskStore.updateTask(updatedTask);

      // Verify status change
      const retrieved = await taskStore.getTask(task.id);
      expect(retrieved!.status).toBe('in-progress');
    });
  });

  // ============================================================================
  // Integration with Database Seeder
  // ============================================================================

  describe('Database Seeder Integration', () => {
    it('should work with database seeder utilities', async () => {
      const seeder = new DatabaseSeeder(taskStore);

      // Use fixtures with seeder
      const task1 = await seedPendingTask(seeder, {
        description: 'Seeded pending task',
      });

      const task2 = await seedRunningTask(seeder, {
        description: 'Seeded running task',
      });

      const task3 = await seedCompletedTask(seeder, {
        description: 'Seeded completed task',
      });

      // Verify all tasks were seeded correctly
      expect(task1.status).toBe('pending');
      expect(task1.description).toBe('Seeded pending task');

      expect(task2.status).toBe('in-progress');
      expect(task2.description).toBe('Seeded running task');

      expect(task3.status).toBe('completed');
      expect(task3.description).toBe('Seeded completed task');

      // Verify they're in the database
      const retrieved1 = await taskStore.getTask(task1.id);
      const retrieved2 = await taskStore.getTask(task2.id);
      const retrieved3 = await taskStore.getTask(task3.id);

      expect(retrieved1).toBeDefined();
      expect(retrieved2).toBeDefined();
      expect(retrieved3).toBeDefined();
    });
  });

  // ============================================================================
  // Integration with Mock Utilities
  // ============================================================================

  describe('Mock Task Integration', () => {
    it('should work alongside mock task creation', async () => {
      // Create a fixture task
      const fixtureTask = createTestTask({
        description: 'Fixture task',
        priority: 'high',
      });

      // Create a mock task (from test-utils.js)
      const mockTask = createMockTask({
        description: 'Mock task',
        priority: 'low',
      });

      // Both should work with TaskStore
      await taskStore.createTask(fixtureTask);
      await taskStore.createTask(mockTask);

      const retrieved1 = await taskStore.getTask(fixtureTask.id);
      const retrieved2 = await taskStore.getTask(mockTask.id);

      expect(retrieved1!.description).toBe('Fixture task');
      expect(retrieved1!.priority).toBe('high');
      expect(retrieved2!.description).toBe('Mock task');
      expect(retrieved2!.priority).toBe('low');
    });
  });

  // ============================================================================
  // Performance and Scale Tests
  // ============================================================================

  describe('Performance Integration', () => {
    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();

      // Create 100 tasks
      const tasks = createTestTasks(100, (index) => ({
        description: `Performance task ${index + 1}`,
        priority: index % 2 === 0 ? 'normal' : 'high',
      }));

      // Store all tasks
      for (const task of tasks) {
        await taskStore.createTask(task);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds for 100 tasks)
      expect(duration).toBeLessThan(5000);

      // Verify all tasks are stored
      for (const task of tasks.slice(0, 5)) { // Check first 5 for verification
        const retrieved = await taskStore.getTask(task.id);
        expect(retrieved).toBeDefined();
      }
    });
  });

  // ============================================================================
  // Error Handling Integration
  // ============================================================================

  describe('Error Handling Integration', () => {
    it('should handle database errors gracefully', async () => {
      const task = createTestTask({
        description: 'Error test task',
      });

      // Close the TaskStore to simulate database error
      taskStore.close();

      // Attempting to store should throw an error
      await expect(taskStore.createTask(task)).rejects.toThrow();
    });

    it('should maintain data integrity with concurrent operations', async () => {
      const tasks = createTestTasks(10, (index) => ({
        description: `Concurrent task ${index + 1}`,
      }));

      // Create tasks concurrently
      const promises = tasks.map(task => taskStore.createTask(task));
      await Promise.all(promises);

      // Verify all tasks are stored correctly
      const retrievedTasks = await Promise.all(
        tasks.map(task => taskStore.getTask(task.id))
      );

      retrievedTasks.forEach((retrieved, index) => {
        expect(retrieved).toBeDefined();
        expect(retrieved!.description).toBe(`Concurrent task ${index + 1}`);
      });
    });
  });

  // ============================================================================
  // Real-world Scenario Tests
  // ============================================================================

  describe('Real-world Scenarios', () => {
    it('should support a complete workflow scenario', async () => {
      // Create a workflow with agents and stages
      const agent = createTestAgent({
        name: 'workflow-agent',
        skills: ['development', 'testing'],
      });

      const workflow = createTestWorkflow({
        name: 'complete-workflow',
        description: 'A complete development workflow',
      });

      // Create tasks that follow the workflow
      const tasks = createTestTasks(3, (index) => {
        const stageNames = ['planning', 'implementation', 'testing'];
        return {
          description: `${stageNames[index]} task`,
          workflow: workflow.name,
          status: index === 0 ? 'in-progress' : 'pending',
        };
      });

      // Store workflow tasks
      for (const task of tasks) {
        await taskStore.createTask(task);
      }

      // Simulate workflow progression
      const planningTask = tasks[0];
      const implementationTask = tasks[1];

      // Complete planning, start implementation
      planningTask.status = 'completed';
      await taskStore.updateTask(planningTask);

      implementationTask.status = 'in-progress';
      await taskStore.updateTask(implementationTask);

      // Verify workflow state
      const retrievedPlanning = await taskStore.getTask(planningTask.id);
      const retrievedImplementation = await taskStore.getTask(implementationTask.id);

      expect(retrievedPlanning!.status).toBe('completed');
      expect(retrievedImplementation!.status).toBe('in-progress');
    });
  });
});