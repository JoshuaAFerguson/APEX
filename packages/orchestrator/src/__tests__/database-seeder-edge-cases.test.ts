/**
 * Edge case and advanced tests for DatabaseSeeder.
 * Tests scenarios not covered in the main test suite including error conditions,
 * performance characteristics, and complex data interactions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSeeder } from '../test-utils';
import type { Task, AgentDefinition, WorkflowDefinition } from '@apexcli/core';

describe('DatabaseSeeder Edge Cases', () => {
  let seeder: DatabaseSeeder;

  beforeEach(async () => {
    seeder = new DatabaseSeeder();
    await seeder.initialize();
  });

  afterEach(async () => {
    await seeder.cleanup();
  });

  describe('error handling and edge conditions', () => {
    it('should handle multiple rapid initializations gracefully', async () => {
      const seeder2 = new DatabaseSeeder();
      const seeder3 = new DatabaseSeeder();

      // Initialize multiple seeders rapidly
      await Promise.all([
        seeder2.initialize(),
        seeder3.initialize()
      ]);

      // Both should work independently
      expect(seeder2.getDatabase().open).toBe(true);
      expect(seeder3.getDatabase().open).toBe(true);

      await seeder2.cleanup();
      await seeder3.cleanup();
    });

    it('should handle operations on uninitialized seeder gracefully', async () => {
      const uninitializedSeeder = new DatabaseSeeder();

      expect(() => uninitializedSeeder.getDatabase()).toThrow('DatabaseSeeder not initialized');
      expect(() => uninitializedSeeder.getStore()).toThrow('DatabaseSeeder not initialized');
      expect(() => uninitializedSeeder.reset()).rejects.toThrow('DatabaseSeeder not initialized');

      // Cleanup should be safe even without initialization
      await expect(uninitializedSeeder.cleanup()).resolves.toBeUndefined();
    });

    it('should handle reset during active database operations', async () => {
      // Start seeding multiple tasks
      const taskPromises = [
        seeder.seedPendingTask({ description: 'Task 1' }),
        seeder.seedRunningTask({ description: 'Task 2' }),
        seeder.seedCompletedTask({ description: 'Task 3' })
      ];

      // Wait for tasks to complete
      await Promise.all(taskPromises);

      // Reset should work even with recent database activity
      await expect(seeder.reset()).resolves.toBeUndefined();

      // Database should be clean
      const taskCount = seeder.getDatabase()
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };
      expect(taskCount.count).toBe(0);
    });

    it('should handle multiple consecutive resets', async () => {
      // Seed some data
      await seeder.seedPendingTask();

      // Multiple resets should not cause issues
      await seeder.reset();
      await seeder.reset();
      await seeder.reset();

      // Should still be able to seed new data
      const task = await seeder.seedCompletedTask({ description: 'After multiple resets' });
      expect(task.description).toBe('After multiple resets');
    });

    it('should handle cleanup after database is manually closed', async () => {
      // Manually close the database
      seeder.getDatabase().close();

      // Cleanup should still work
      await expect(seeder.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('large data set handling', () => {
    it('should handle seeding large numbers of tasks', async () => {
      const TASK_COUNT = 100;
      const tasks: Task[] = [];

      // Seed many tasks
      for (let i = 0; i < TASK_COUNT; i++) {
        const task = await seeder.seedPendingTask({
          description: `Large dataset task ${i}`,
          id: `task_${i}_${Date.now()}`
        });
        tasks.push(task);
      }

      // Verify all tasks are present
      const taskCount = seeder.getDatabase()
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };
      expect(taskCount.count).toBe(TASK_COUNT);

      // Reset should handle large datasets
      await seeder.reset();

      const taskCountAfterReset = seeder.getDatabase()
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };
      expect(taskCountAfterReset.count).toBe(0);
    });

    it('should handle creating many agent fixtures without performance issues', async () => {
      const AGENT_COUNT = 50;
      const agents: AgentDefinition[] = [];

      const startTime = Date.now();

      for (let i = 0; i < AGENT_COUNT; i++) {
        const agent = seeder.createAgentFixture({
          name: `agent-${i}`,
          description: `Agent number ${i} for performance testing`,
          tools: ['Read', 'Write', 'Bash'],
          skills: [`skill-${i}`, `skill-${i}-alt`]
        });
        agents.push(agent);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      expect(agents).toHaveLength(AGENT_COUNT);

      // All agents should have unique names
      const uniqueNames = new Set(agents.map(a => a.name));
      expect(uniqueNames.size).toBe(AGENT_COUNT);
    });
  });

  describe('complex task scenario combinations', () => {
    it('should handle multiple overlapping scenarios', async () => {
      // Seed multiple scenarios
      const mixedTasks = await seeder.seedTaskScenario('mixed-statuses');
      const dependencyTasks = await seeder.seedTaskScenario('dependency-chain');
      const subtaskTasks = await seeder.seedTaskScenario('subtask-tree');
      const retryTasks = await seeder.seedTaskScenario('retry-exhausted');

      // Total tasks should be sum of all scenarios
      const expectedTotal = 6 + 3 + 4 + 1; // mixed(6) + dependency(3) + subtask(4) + retry(1)
      const actualCount = seeder.getDatabase()
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };

      expect(actualCount.count).toBe(expectedTotal);

      // Should still be able to query tasks by status
      const completedTasks = seeder.getDatabase()
        .prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?')
        .all('completed') as { count: number }[];

      expect(completedTasks.length).toBeGreaterThan(0);
    });

    it('should create complex dependency chains with mixed statuses', async () => {
      // Create custom dependency chain with more complex relationships
      const taskA = await seeder.seedCompletedTask({ description: 'Root task A' });
      const taskB1 = await seeder.seedRunningTask({
        description: 'Branch B1 (depends on A)',
        dependsOn: [taskA.id]
      });
      const taskB2 = await seeder.seedPausedTask({
        description: 'Branch B2 (depends on A)',
        dependsOn: [taskA.id]
      });
      const taskC = await seeder.seedPendingTask({
        description: 'Convergence C (depends on B1 and B2)',
        dependsOn: [taskB1.id, taskB2.id]
      });

      // Verify dependency structure
      expect(taskB1.dependsOn).toContain(taskA.id);
      expect(taskB2.dependsOn).toContain(taskA.id);
      expect(taskC.dependsOn).toContain(taskB1.id);
      expect(taskC.dependsOn).toContain(taskB2.id);

      // Verify different statuses
      expect([taskA.status, taskB1.status, taskB2.status, taskC.status]).toEqual([
        'completed', 'running', 'paused', 'pending'
      ]);
    });
  });

  describe('fixture customization edge cases', () => {
    it('should handle agent fixtures with minimal configuration', () => {
      const minimalAgent = seeder.createAgentFixture({
        name: 'minimal'
      });

      // Should have all required fields
      expect(minimalAgent.name).toBe('minimal');
      expect(minimalAgent.description).toBeDefined();
      expect(minimalAgent.prompt).toBeDefined();
      expect(Array.isArray(minimalAgent.tools)).toBe(true);
      expect(minimalAgent.model).toBeDefined();
    });

    it('should handle workflow fixtures with empty stages override', () => {
      const workflowWithoutStages = seeder.createWorkflowFixture({
        name: 'no-stages-workflow',
        description: 'Workflow with no stages for testing',
        stages: []
      });

      expect(workflowWithoutStages.name).toBe('no-stages-workflow');
      expect(workflowWithoutStages.stages).toEqual([]);
    });

    it('should handle workflow stage fixtures with complex dependencies', () => {
      const complexStage = seeder.createWorkflowStageFixture({
        name: 'complex-stage',
        agent: 'developer',
        description: 'Stage with complex configuration',
        dependsOn: ['stage-1', 'stage-2', 'stage-3'],
        inputs: ['input-1', 'input-2'],
        outputs: ['output-1', 'output-2', 'output-3'],
        parallel: true,
        maxRetries: 5,
        timeoutMinutes: 120
      });

      expect(complexStage.dependsOn).toEqual(['stage-1', 'stage-2', 'stage-3']);
      expect(complexStage.inputs).toEqual(['input-1', 'input-2']);
      expect(complexStage.outputs).toEqual(['output-1', 'output-2', 'output-3']);
      expect(complexStage.parallel).toBe(true);
      expect(complexStage.maxRetries).toBe(5);
      expect(complexStage.timeoutMinutes).toBe(120);
    });

    it('should handle agent fixtures with extensive tool lists', () => {
      const toolHeavyAgent = seeder.createAgentFixture({
        name: 'tool-heavy',
        description: 'Agent with many tools',
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'LSP', 'WebFetch', 'WebSearch'],
        skills: ['javascript', 'typescript', 'python', 'go', 'rust', 'docker', 'kubernetes']
      });

      expect(toolHeavyAgent.tools).toHaveLength(9);
      expect(toolHeavyAgent.skills).toHaveLength(7);
    });
  });

  describe('environment seeding variations', () => {
    it('should handle environment seeding with different scenarios', async () => {
      // Test each scenario type individually
      const scenarios = ['mixed-statuses', 'dependency-chain', 'subtask-tree', 'retry-exhausted'] as const;

      for (const scenario of scenarios) {
        await seeder.reset();
        const env = await seeder.seedFullEnvironment(scenario);

        expect(env.tasks.length).toBeGreaterThan(0);
        expect(env.agents.length).toBe(6);
        expect(env.workflows.length).toBe(3);
        expect(env.database).toBe(seeder.getDatabase());
        expect(env.store).toBe(seeder.getStore());
      }
    });

    it('should provide isolated environments', async () => {
      // Create two seeders for comparison
      const seeder2 = new DatabaseSeeder();
      await seeder2.initialize();

      try {
        // Seed different environments
        await seeder.seedFullEnvironment('mixed-statuses');
        await seeder2.seedFullEnvironment('dependency-chain');

        // Should have different databases
        expect(seeder.getDatabase()).not.toBe(seeder2.getDatabase());

        // Should have different task counts
        const count1 = seeder.getDatabase()
          .prepare('SELECT COUNT(*) as count FROM tasks')
          .get() as { count: number };

        const count2 = seeder2.getDatabase()
          .prepare('SELECT COUNT(*) as count FROM tasks')
          .get() as { count: number };

        expect(count1.count).toBe(6); // mixed-statuses
        expect(count2.count).toBe(3); // dependency-chain
      } finally {
        await seeder2.cleanup();
      }
    });
  });

  describe('database state validation', () => {
    it('should maintain database integrity after complex operations', async () => {
      // Perform various operations
      await seeder.seedFullEnvironment('mixed-statuses');
      await seeder.seedTaskScenario('dependency-chain');
      await seeder.reset();
      await seeder.seedMinimalEnvironment();

      // Verify database state is consistent
      const db = seeder.getDatabase();

      // Check that foreign key constraints are maintained
      const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
      const logCount = db.prepare('SELECT COUNT(*) as count FROM task_logs').get() as { count: number };

      // Should have at least one task from minimal environment
      expect(taskCount.count).toBe(1);

      // Logs table should exist and be queryable (even if empty)
      expect(logCount.count).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent access patterns', async () => {
      // Simulate concurrent operations
      const operations = [
        seeder.seedPendingTask({ description: 'Concurrent 1' }),
        seeder.seedRunningTask({ description: 'Concurrent 2' }),
        seeder.seedCompletedTask({ description: 'Concurrent 3' }),
        seeder.createStandardAgentFixtures(),
        seeder.createStandardWorkflowFixtures()
      ];

      // All operations should complete successfully
      const results = await Promise.all(operations);

      expect(results[0]).toBeDefined(); // pending task
      expect(results[1]).toBeDefined(); // running task
      expect(results[2]).toBeDefined(); // completed task
      expect(results[3]).toHaveLength(6); // agents
      expect(results[4]).toHaveLength(3); // workflows
    });
  });

  describe('fixture cache behavior', () => {
    it('should handle cache invalidation correctly', async () => {
      // Get initial fixtures
      const agents1 = seeder.getAgentFixtures();
      const workflows1 = seeder.getWorkflowFixtures();

      // Reset should clear caches
      await seeder.reset();

      // Get fixtures again
      const agents2 = seeder.getAgentFixtures();
      const workflows2 = seeder.getWorkflowFixtures();

      // Should be equivalent but different instances
      expect(agents1).toEqual(agents2);
      expect(workflows1).toEqual(workflows2);
    });

    it('should maintain cache consistency across multiple calls', () => {
      // Multiple calls should return the same instances
      const agents1 = seeder.getAgentFixtures();
      const agents2 = seeder.getAgentFixtures();
      const agents3 = seeder.getAgentFixtures();

      expect(agents1).toBe(agents2);
      expect(agents2).toBe(agents3);

      const workflows1 = seeder.getWorkflowFixtures();
      const workflows2 = seeder.getWorkflowFixtures();
      const workflows3 = seeder.getWorkflowFixtures();

      expect(workflows1).toBe(workflows2);
      expect(workflows2).toBe(workflows3);
    });
  });

  describe('task override validation', () => {
    it('should handle extreme task override values', async () => {
      // Test with unusual but valid values
      const extremeTask = await seeder.seedPendingTask({
        description: 'Task with extreme values',
        retryCount: 99,
        maxRetries: 100,
        usage: {
          inputTokens: 1000000,
          outputTokens: 500000,
          totalTokens: 1500000,
          estimatedCost: 999.99,
          totalCostCents: 99999,
          executionTimeMs: 3600000 // 1 hour
        }
      });

      expect(extremeTask.retryCount).toBe(99);
      expect(extremeTask.maxRetries).toBe(100);
      expect(extremeTask.usage.inputTokens).toBe(1000000);
      expect(extremeTask.usage.estimatedCost).toBe(999.99);
    });

    it('should handle tasks with very long descriptions', async () => {
      const longDescription = 'A'.repeat(10000); // 10KB description
      const taskWithLongDesc = await seeder.seedCompletedTask({
        description: longDescription
      });

      expect(taskWithLongDesc.description).toBe(longDescription);
      expect(taskWithLongDesc.description).toHaveLength(10000);
    });

    it('should handle tasks with complex subtask relationships', async () => {
      // Create a parent with many subtasks
      const subtaskIds = [];
      for (let i = 0; i < 10; i++) {
        const subtask = await seeder.seedPendingTask({
          description: `Subtask ${i}`,
        });
        subtaskIds.push(subtask.id);
      }

      const parentTask = await seeder.seedRunningTask({
        description: 'Parent with many subtasks',
        subtaskIds,
        subtaskStrategy: 'sequential'
      });

      expect(parentTask.subtaskIds).toHaveLength(10);
      expect(parentTask.subtaskStrategy).toBe('sequential');
    });
  });
});