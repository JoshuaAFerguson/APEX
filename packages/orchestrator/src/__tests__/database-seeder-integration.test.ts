/**
 * Integration tests for DatabaseSeeder with APEX ecosystem.
 * Tests how DatabaseSeeder integrates with TaskStore, orchestrator components,
 * and other APEX systems.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSeeder, createTestTaskStore } from '../test-utils';
import { TaskStore } from '../store';
import type { Task, TaskStatus } from '@apexcli/core';

describe('DatabaseSeeder Integration', () => {
  let seeder: DatabaseSeeder;

  beforeEach(async () => {
    seeder = new DatabaseSeeder();
    await seeder.initialize();
  });

  afterEach(async () => {
    await seeder.cleanup();
  });

  describe('TaskStore integration', () => {
    it('should work with existing TaskStore operations', async () => {
      const store = seeder.getStore();

      // Seed a task using seeder
      const seededTask = await seeder.seedPendingTask({
        description: 'Integration test task'
      });

      // Should be able to retrieve using TaskStore methods
      const retrievedTask = await store.getTask(seededTask.id);
      expect(retrievedTask).toBeDefined();
      expect(retrievedTask!.description).toBe('Integration test task');

      // Should be able to update using TaskStore
      await store.updateTaskStatus(seededTask.id, 'running', 'development');
      const updatedTask = await store.getTask(seededTask.id);
      expect(updatedTask!.status).toBe('running');
      expect(updatedTask!.currentStage).toBe('development');

      // Should be able to list tasks
      const allTasks = await store.listTasks();
      expect(allTasks.some(t => t.id === seededTask.id)).toBe(true);
    });

    it('should support TaskStore query operations on seeded data', async () => {
      const store = seeder.getStore();

      // Seed multiple tasks with different statuses
      await seeder.seedTaskScenario('mixed-statuses');

      // Test status-based queries
      const pendingTasks = await store.listTasks('pending');
      const runningTasks = await store.listTasks('running');
      const completedTasks = await store.listTasks('completed');

      expect(pendingTasks.length).toBeGreaterThan(0);
      expect(runningTasks.length).toBeGreaterThan(0);
      expect(completedTasks.length).toBeGreaterThan(0);

      // All tasks should have the correct status
      expect(pendingTasks.every(t => t.status === 'pending')).toBe(true);
      expect(runningTasks.every(t => t.status === 'running')).toBe(true);
      expect(completedTasks.every(t => t.status === 'completed')).toBe(true);
    });

    it('should support complex TaskStore operations on dependency chains', async () => {
      const store = seeder.getStore();

      // Seed dependency chain scenario
      const dependencyTasks = await seeder.seedTaskScenario('dependency-chain');
      const [taskA, taskB, taskC] = dependencyTasks;

      // Test dependency queries (if implemented)
      const allTasks = await store.listTasks();
      const taskBFromStore = allTasks.find(t => t.id === taskB.id);
      const taskCFromStore = allTasks.find(t => t.id === taskC.id);

      expect(taskBFromStore!.dependsOn).toContain(taskA.id);
      expect(taskCFromStore!.dependsOn).toContain(taskB.id);
    });

    it('should maintain data consistency with TaskStore operations', async () => {
      const store = seeder.getStore();

      // Seed initial data
      const task1 = await seeder.seedPendingTask({ description: 'Consistency test 1' });
      const task2 = await seeder.seedRunningTask({ description: 'Consistency test 2' });

      // Perform mixed operations
      await store.updateTaskStatus(task1.id, 'running');
      const task3 = await seeder.seedCompletedTask({ description: 'Consistency test 3' });
      await store.updateTaskStatus(task2.id, 'completed');

      // Verify final state
      const finalTasks = await store.listTasks();
      expect(finalTasks).toHaveLength(3);

      const task1Final = finalTasks.find(t => t.id === task1.id);
      const task2Final = finalTasks.find(t => t.id === task2.id);
      const task3Final = finalTasks.find(t => t.id === task3.id);

      expect(task1Final!.status).toBe('running');
      expect(task2Final!.status).toBe('completed');
      expect(task3Final!.status).toBe('completed');
    });
  });

  describe('multiple seeder instances', () => {
    it('should isolate data between different seeder instances', async () => {
      const seeder2 = new DatabaseSeeder();
      await seeder2.initialize();

      try {
        // Seed different data in each seeder
        await seeder.seedPendingTask({ description: 'Seeder 1 task' });
        await seeder2.seedRunningTask({ description: 'Seeder 2 task' });

        // Each seeder should only see its own data
        const tasks1 = await seeder.getStore().listTasks();
        const tasks2 = await seeder2.getStore().listTasks();

        expect(tasks1).toHaveLength(1);
        expect(tasks2).toHaveLength(1);
        expect(tasks1[0].description).toBe('Seeder 1 task');
        expect(tasks2[0].description).toBe('Seeder 2 task');

        // Database instances should be different
        expect(seeder.getDatabase()).not.toBe(seeder2.getDatabase());
      } finally {
        await seeder2.cleanup();
      }
    });

    it('should handle concurrent operations across multiple seeders', async () => {
      const seeders = [];

      try {
        // Create multiple seeders
        for (let i = 0; i < 3; i++) {
          const s = new DatabaseSeeder();
          await s.initialize();
          seeders.push(s);
        }

        // Perform operations concurrently
        const operations = seeders.map(async (s, index) => {
          await s.seedPendingTask({ description: `Concurrent seeder ${index}` });
          const env = await s.seedMinimalEnvironment();
          return env;
        });

        const results = await Promise.all(operations);

        // All operations should succeed
        expect(results).toHaveLength(3);
        results.forEach((env, index) => {
          expect(env.task).toBeDefined();
          expect(env.agent).toBeDefined();
          expect(env.workflow).toBeDefined();
        });

        // Each seeder should have 2 tasks (1 pending + 1 from minimal env)
        for (const s of seeders) {
          const tasks = await s.getStore().listTasks();
          expect(tasks).toHaveLength(2);
        }
      } finally {
        // Clean up all seeders
        await Promise.all(seeders.map(s => s.cleanup()));
      }
    });
  });

  describe('cross-package integration', () => {
    it('should work with core package type validation', async () => {
      // Seed fixtures using seeder
      const agents = seeder.getAgentFixtures();
      const workflows = seeder.getWorkflowFixtures();

      // Import schemas from core package for validation
      const { AgentDefinitionSchema, WorkflowDefinitionSchema } = await import('@apexcli/core');

      // All fixtures should validate against core schemas
      for (const agent of agents) {
        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
      }

      for (const workflow of workflows) {
        expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
      }
    });

    it('should create tasks that are compatible with core validation', async () => {
      // Seed various task types
      const tasks = await seeder.seedTaskScenario('mixed-statuses');

      // Import task schema from core package
      const { TaskSchema } = await import('@apexcli/core');

      // All tasks should validate against core schema
      for (const task of tasks) {
        expect(() => TaskSchema.parse(task)).not.toThrow();
      }
    });
  });

  describe('realistic workflow simulation', () => {
    it('should simulate a complete development workflow', async () => {
      // Start with a pending feature task
      const featureTask = await seeder.seedPendingTask({
        description: 'Add user authentication feature',
        workflow: 'feature',
        acceptanceCriteria: 'User can login and logout securely'
      });

      const store = seeder.getStore();

      // Simulate workflow progression
      await store.updateTaskStatus(featureTask.id, 'running', 'planning');
      await store.updateTaskStatus(featureTask.id, 'running', 'architecture');
      await store.updateTaskStatus(featureTask.id, 'running', 'implementation');

      // Add some usage data
      await store.updateTaskUsage(featureTask.id, {
        inputTokens: 2500,
        outputTokens: 1800,
        totalTokens: 4300,
        estimatedCost: 0.05,
        totalCostCents: 5,
        executionTimeMs: 120000
      });

      await store.updateTaskStatus(featureTask.id, 'running', 'testing');
      await store.updateTaskStatus(featureTask.id, 'completed');

      // Verify final state
      const finalTask = await store.getTask(featureTask.id);
      expect(finalTask!.status).toBe('completed');
      expect(finalTask!.usage.totalTokens).toBe(4300);
      expect(finalTask!.completedAt).toBeDefined();
    });

    it('should simulate bug investigation and fix workflow', async () => {
      // Start with a failed task that needs investigation
      const bugTask = await seeder.seedFailedTask({
        description: 'Fix authentication timeout bug',
        workflow: 'bugfix',
        error: 'Authentication timeout after 30 seconds'
      });

      const store = seeder.getStore();

      // Create a new task for the bug fix
      const fixTask = await seeder.seedPendingTask({
        description: 'Increase authentication timeout to 60 seconds',
        workflow: 'bugfix',
        dependsOn: [bugTask.id] // Depends on the failed task for context
      });

      // Simulate fix workflow
      await store.updateTaskStatus(fixTask.id, 'running', 'investigation');
      await store.updateTaskStatus(fixTask.id, 'running', 'fix');
      await store.updateTaskStatus(fixTask.id, 'running', 'verification');
      await store.updateTaskStatus(fixTask.id, 'completed');

      // Verify workflow completion
      const finalFixTask = await store.getTask(fixTask.id);
      expect(finalFixTask!.status).toBe('completed');
      expect(finalFixTask!.dependsOn).toContain(bugTask.id);
    });

    it('should simulate complex multi-task project', async () => {
      const store = seeder.getStore();

      // Create project tasks with dependencies
      const designTask = await seeder.seedCompletedTask({
        description: 'Design user interface mockups',
        workflow: 'feature'
      });

      const frontendTask = await seeder.seedRunningTask({
        description: 'Implement frontend components',
        workflow: 'feature',
        dependsOn: [designTask.id],
        currentStage: 'implementation'
      });

      const backendTask = await seeder.seedRunningTask({
        description: 'Implement backend API',
        workflow: 'feature',
        dependsOn: [designTask.id],
        currentStage: 'implementation'
      });

      const integrationTask = await seeder.seedPendingTask({
        description: 'Integrate frontend and backend',
        workflow: 'feature',
        dependsOn: [frontendTask.id, backendTask.id]
      });

      const testingTask = await seeder.seedPendingTask({
        description: 'End-to-end testing',
        workflow: 'testing',
        dependsOn: [integrationTask.id]
      });

      // Verify project structure
      const allTasks = await store.listTasks();
      expect(allTasks).toHaveLength(5);

      // Verify dependencies
      const integration = allTasks.find(t => t.id === integrationTask.id);
      const testing = allTasks.find(t => t.id === testingTask.id);

      expect(integration!.dependsOn).toContain(frontendTask.id);
      expect(integration!.dependsOn).toContain(backendTask.id);
      expect(testing!.dependsOn).toContain(integrationTask.id);

      // Verify statuses reflect project state
      expect(designTask.status).toBe('completed');
      expect(frontendTask.status).toBe('running');
      expect(backendTask.status).toBe('running');
      expect(integrationTask.status).toBe('pending');
      expect(testingTask.status).toBe('pending');
    });
  });

  describe('performance characteristics', () => {
    it('should handle rapid task creation and queries efficiently', async () => {
      const store = seeder.getStore();
      const TASK_COUNT = 50;

      const startTime = Date.now();

      // Create many tasks rapidly
      const tasks = [];
      for (let i = 0; i < TASK_COUNT; i++) {
        const task = await seeder.seedPendingTask({
          description: `Performance test task ${i}`
        });
        tasks.push(task);
      }

      // Query all tasks
      const allTasks = await store.listTasks();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Operations should complete in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(allTasks).toHaveLength(TASK_COUNT);
      expect(tasks).toHaveLength(TASK_COUNT);
    });

    it('should handle environment resets efficiently', async () => {
      // Seed large environment
      await seeder.seedFullEnvironment('mixed-statuses');

      const resetStartTime = Date.now();
      await seeder.reset();
      const resetEndTime = Date.now();

      const seedStartTime = Date.now();
      await seeder.seedFullEnvironment('dependency-chain');
      const seedEndTime = Date.now();

      // Operations should be fast
      const resetDuration = resetEndTime - resetStartTime;
      const seedDuration = seedEndTime - seedStartTime;

      expect(resetDuration).toBeLessThan(1000); // 1 second
      expect(seedDuration).toBeLessThan(2000); // 2 seconds
    });
  });

  describe('data integrity across operations', () => {
    it('should maintain referential integrity with complex operations', async () => {
      const store = seeder.getStore();

      // Create complex data structure
      const environment = await seeder.seedFullEnvironment('subtask-tree');

      // Perform various store operations
      const tasks = await store.listTasks();
      const parentTask = tasks.find(t => t.subtaskIds && t.subtaskIds.length > 0);

      if (parentTask && parentTask.subtaskIds) {
        // Update parent task
        await store.updateTaskStatus(parentTask.id, 'completed');

        // Verify subtasks still exist and are referenced correctly
        const updatedParent = await store.getTask(parentTask.id);
        expect(updatedParent!.subtaskIds).toBeDefined();
        expect(updatedParent!.subtaskIds!.length).toBeGreaterThan(0);

        // Verify all subtasks can still be retrieved
        for (const subtaskId of updatedParent!.subtaskIds!) {
          const subtask = await store.getTask(subtaskId);
          expect(subtask).toBeDefined();
        }
      }
    });

    it('should handle mixed seeder and direct store operations correctly', async () => {
      const store = seeder.getStore();

      // Mix seeder and store operations
      const seededTask = await seeder.seedPendingTask({ description: 'Seeded task' });

      const directTask = {
        id: `direct_${Date.now()}`,
        description: 'Direct store task',
        workflow: 'feature',
        autonomy: 'full' as const,
        status: 'pending' as TaskStatus,
        priority: 'normal',
        effort: 'medium',
        projectPath: '/test/project',
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          totalCostCents: 0,
          executionTimeMs: 0
        },
        logs: [],
        artifacts: [],
        dependsOn: [],
        blockedBy: []
      } as Task;

      await store.createTask(directTask);

      // Both tasks should be retrievable
      const allTasks = await store.listTasks();
      expect(allTasks).toHaveLength(2);

      const seededFromStore = await store.getTask(seededTask.id);
      const directFromStore = await store.getTask(directTask.id);

      expect(seededFromStore).toBeDefined();
      expect(directFromStore).toBeDefined();
      expect(seededFromStore!.description).toBe('Seeded task');
      expect(directFromStore!.description).toBe('Direct store task');
    });
  });
});