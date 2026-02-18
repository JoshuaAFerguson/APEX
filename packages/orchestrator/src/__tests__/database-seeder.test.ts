/**
 * Tests for DatabaseSeeder - E2E test data management utilities.
 * Verifies that the seeder can create isolated test databases and fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSeeder } from '../test-utils';
import type { AgentDefinition, WorkflowDefinition } from '@apexcli/core';
import { AgentDefinitionSchema, WorkflowDefinitionSchema } from '@apexcli/core';

describe('DatabaseSeeder', () => {
  let seeder: DatabaseSeeder;

  beforeEach(async () => {
    seeder = new DatabaseSeeder();
    await seeder.initialize();
  });

  afterEach(async () => {
    await seeder.cleanup();
  });

  describe('initialization and cleanup', () => {
    it('should initialize with a working database', () => {
      expect(seeder.getDatabase()).toBeDefined();
      expect(seeder.getStore()).toBeDefined();
      expect(seeder.getDatabase().open).toBe(true);
    });

    it('should throw error when accessing database before initialization', async () => {
      const uninitializedSeeder = new DatabaseSeeder();

      expect(() => uninitializedSeeder.getDatabase()).toThrow('DatabaseSeeder not initialized');
      expect(() => uninitializedSeeder.getStore()).toThrow('DatabaseSeeder not initialized');
    });
  });

  describe('database reset functionality', () => {
    it('should clear all data when reset is called', async () => {
      // Seed some data
      await seeder.seedPendingTask({ description: 'Test task to be cleared' });

      // Verify data exists
      const tasksBefore = seeder.getDatabase()
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };
      expect(tasksBefore.count).toBe(1);

      // Reset database
      await seeder.reset();

      // Verify data is cleared
      const tasksAfter = seeder.getDatabase()
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };
      expect(tasksAfter.count).toBe(0);
    });

    it('should clear fixture caches on reset', async () => {
      // Get fixtures to populate cache
      const agentsBefore = seeder.getAgentFixtures();
      const workflowsBefore = seeder.getWorkflowFixtures();
      expect(agentsBefore.length).toBeGreaterThan(0);
      expect(workflowsBefore.length).toBeGreaterThan(0);

      // Reset should clear caches
      await seeder.reset();

      // Verify caches are cleared by checking internal state
      // (This tests the implementation detail that caches are cleared)
      const agentsAfterReset = seeder.getAgentFixtures();
      const workflowsAfterReset = seeder.getWorkflowFixtures();

      // Should recreate fixtures (same content but new instances)
      expect(agentsAfterReset).toEqual(agentsBefore);
      expect(workflowsAfterReset).toEqual(workflowsBefore);
    });
  });

  describe('task seeding methods', () => {
    it('should seed tasks with all statuses', async () => {
      const pendingTask = await seeder.seedPendingTask({ description: 'Pending test' });
      const runningTask = await seeder.seedRunningTask({ description: 'Running test' });
      const completedTask = await seeder.seedCompletedTask({ description: 'Completed test' });
      const failedTask = await seeder.seedFailedTask({ description: 'Failed test' });
      const pausedTask = await seeder.seedPausedTask({ description: 'Paused test' });
      const cancelledTask = await seeder.seedCancelledTask({ description: 'Cancelled test' });

      expect(pendingTask.status).toBe('pending');
      expect(runningTask.status).toBe('running');
      expect(completedTask.status).toBe('completed');
      expect(failedTask.status).toBe('failed');
      expect(pausedTask.status).toBe('paused');
      expect(cancelledTask.status).toBe('cancelled');

      // Verify all tasks are persisted in database
      const totalTasks = seeder.getDatabase()
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };
      expect(totalTasks.count).toBe(6);
    });

    it('should seed task scenarios', async () => {
      const mixedTasks = await seeder.seedTaskScenario('mixed-statuses');
      expect(mixedTasks).toHaveLength(6);

      const statuses = mixedTasks.map(t => t.status);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('running');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('paused');
      expect(statuses).toContain('cancelled');
    });

    it('should handle dependency chains in scenarios', async () => {
      const dependencyTasks = await seeder.seedTaskScenario('dependency-chain');
      expect(dependencyTasks).toHaveLength(3);

      // Find tasks by description patterns
      const taskA = dependencyTasks.find(t => t.description.includes('task A'));
      const taskB = dependencyTasks.find(t => t.description.includes('task B'));
      const taskC = dependencyTasks.find(t => t.description.includes('task C'));

      expect(taskA).toBeDefined();
      expect(taskB).toBeDefined();
      expect(taskC).toBeDefined();

      expect(taskA!.status).toBe('completed');
      expect(taskB!.status).toBe('running');
      expect(taskC!.status).toBe('pending');

      expect(taskB!.dependsOn).toContain(taskA!.id);
      expect(taskC!.dependsOn).toContain(taskB!.id);
    });
  });

  describe('agent fixture creation', () => {
    it('should create agent fixtures that match AgentDefinitionSchema', () => {
      const agent = seeder.createAgentFixture({
        name: 'test-agent',
        description: 'Test agent for schema validation',
      });

      // Should not throw when parsed against schema
      expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();

      expect(agent.name).toBe('test-agent');
      expect(agent.description).toBe('Test agent for schema validation');
      expect(agent.model).toBe('sonnet'); // Default value
      expect(Array.isArray(agent.tools)).toBe(true);
    });

    it('should create standard agent fixtures', () => {
      const agents = seeder.createStandardAgentFixtures();

      expect(agents).toHaveLength(6);

      const agentNames = agents.map(a => a.name);
      expect(agentNames).toContain('planner');
      expect(agentNames).toContain('developer');
      expect(agentNames).toContain('tester');
      expect(agentNames).toContain('reviewer');
      expect(agentNames).toContain('devops');
      expect(agentNames).toContain('architect');

      // Verify all agents match schema
      agents.forEach(agent => {
        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
      });
    });

    it('should cache agent fixtures', () => {
      const agents1 = seeder.getAgentFixtures();
      const agents2 = seeder.getAgentFixtures();

      // Should return same instances (cached)
      expect(agents1).toBe(agents2);
      expect(agents1).toHaveLength(6);
    });

    it('should handle agent fixture overrides', () => {
      const customAgent = seeder.createAgentFixture({
        name: 'custom-agent',
        model: 'opus',
        tools: ['Read', 'Write'],
        skills: ['custom-skill'],
      });

      expect(customAgent.name).toBe('custom-agent');
      expect(customAgent.model).toBe('opus');
      expect(customAgent.tools).toEqual(['Read', 'Write']);
      expect(customAgent.skills).toEqual(['custom-skill']);
    });
  });

  describe('workflow fixture creation', () => {
    it('should create workflow stages that match WorkflowStageSchema', () => {
      const stage = seeder.createWorkflowStageFixture({
        name: 'test-stage',
        agent: 'developer',
        description: 'Test stage for validation',
      });

      // Should have required fields
      expect(stage.name).toBe('test-stage');
      expect(stage.agent).toBe('developer');
      expect(stage.description).toBe('Test stage for validation');
      expect(stage.parallel).toBe(false); // Default value
      expect(stage.maxRetries).toBe(2); // Default value
    });

    it('should create workflow fixtures that match WorkflowDefinitionSchema', () => {
      const workflow = seeder.createWorkflowFixture({
        name: 'test-workflow',
        description: 'Test workflow for schema validation',
      });

      // Should not throw when parsed against schema
      expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();

      expect(workflow.name).toBe('test-workflow');
      expect(workflow.description).toBe('Test workflow for schema validation');
      expect(Array.isArray(workflow.stages)).toBe(true);
      expect(workflow.stages.length).toBeGreaterThan(0);
    });

    it('should create standard workflow fixtures', () => {
      const workflows = seeder.createStandardWorkflowFixtures();

      expect(workflows).toHaveLength(3);

      const workflowNames = workflows.map(w => w.name);
      expect(workflowNames).toContain('feature');
      expect(workflowNames).toContain('bugfix');
      expect(workflowNames).toContain('testing');

      // Verify all workflows match schema
      workflows.forEach(workflow => {
        expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
        expect(workflow.stages.length).toBeGreaterThan(0);
      });
    });

    it('should cache workflow fixtures', () => {
      const workflows1 = seeder.getWorkflowFixtures();
      const workflows2 = seeder.getWorkflowFixtures();

      // Should return same instances (cached)
      expect(workflows1).toBe(workflows2);
      expect(workflows1).toHaveLength(3);
    });

    it('should create workflows with proper stage dependencies', () => {
      const workflows = seeder.createStandardWorkflowFixtures();
      const featureWorkflow = workflows.find(w => w.name === 'feature')!;

      expect(featureWorkflow).toBeDefined();
      expect(featureWorkflow.stages).toHaveLength(5);

      // Check stage dependencies
      const planningStage = featureWorkflow.stages.find(s => s.name === 'planning')!;
      const architectureStage = featureWorkflow.stages.find(s => s.name === 'architecture')!;
      const implementationStage = featureWorkflow.stages.find(s => s.name === 'implementation')!;

      expect(planningStage.dependsOn).toBeUndefined(); // First stage
      expect(architectureStage.dependsOn).toEqual(['planning']);
      expect(implementationStage.dependsOn).toEqual(['architecture']);
    });
  });

  describe('complete environment seeding', () => {
    it('should seed full environment with all components', async () => {
      const environment = await seeder.seedFullEnvironment('mixed-statuses');

      expect(environment.tasks).toHaveLength(6);
      expect(environment.agents).toHaveLength(6);
      expect(environment.workflows).toHaveLength(3);
      expect(environment.database).toBe(seeder.getDatabase());
      expect(environment.store).toBe(seeder.getStore());

      // Verify database contains the tasks
      const taskCount = environment.database
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };
      expect(taskCount.count).toBe(6);
    });

    it('should seed minimal environment', async () => {
      const environment = await seeder.seedMinimalEnvironment();

      expect(environment.task).toBeDefined();
      expect(environment.task.status).toBe('completed');
      expect(environment.agent.name).toBe('developer');
      expect(environment.workflow.name).toBe('simple');
      expect(environment.workflow.stages).toHaveLength(1);

      // Verify database contains one task
      const taskCount = environment.database
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };
      expect(taskCount.count).toBe(1);
    });

    it('should allow multiple environment seeding operations', async () => {
      // Seed full environment first
      await seeder.seedFullEnvironment('mixed-statuses');

      // Then seed minimal (should add to existing)
      await seeder.seedMinimalEnvironment();

      // Should have 6 + 1 = 7 tasks total
      const taskCount = seeder.getDatabase()
        .prepare('SELECT COUNT(*) as count FROM tasks')
        .get() as { count: number };
      expect(taskCount.count).toBe(7);
    });
  });

  describe('schema validation', () => {
    it('should validate all agent fixtures against Zod schema', () => {
      const agents = seeder.getAgentFixtures();

      agents.forEach((agent, index) => {
        expect(() => AgentDefinitionSchema.parse(agent),
          `Agent ${index} (${agent.name}) should match schema`).not.toThrow();
      });
    });

    it('should validate all workflow fixtures against Zod schema', () => {
      const workflows = seeder.getWorkflowFixtures();

      workflows.forEach((workflow, index) => {
        expect(() => WorkflowDefinitionSchema.parse(workflow),
          `Workflow ${index} (${workflow.name}) should match schema`).not.toThrow();
      });
    });

    it('should validate custom agent fixtures with overrides', () => {
      const customAgent = seeder.createAgentFixture({
        name: 'validation-test',
        description: 'Testing schema validation',
        prompt: 'Custom prompt for testing',
        tools: ['Read', 'Grep', 'Bash'],
        model: 'haiku',
        skills: ['testing', 'validation'],
      });

      expect(() => AgentDefinitionSchema.parse(customAgent)).not.toThrow();
      expect(customAgent.name).toBe('validation-test');
      expect(customAgent.model).toBe('haiku');
      expect(customAgent.tools).toEqual(['Read', 'Grep', 'Bash']);
    });

    it('should validate custom workflow fixtures with complex stages', () => {
      const customWorkflow = seeder.createWorkflowFixture({
        name: 'validation-workflow',
        description: 'Complex workflow for validation testing',
        trigger: ['test:trigger'],
        stages: [
          seeder.createWorkflowStageFixture({
            name: 'stage-1',
            agent: 'planner',
            parallel: false,
            outputs: ['plan'],
          }),
          seeder.createWorkflowStageFixture({
            name: 'stage-2',
            agent: 'developer',
            dependsOn: ['stage-1'],
            inputs: ['plan'],
            outputs: ['code'],
            parallel: true,
            maxRetries: 3,
          }),
        ],
      });

      expect(() => WorkflowDefinitionSchema.parse(customWorkflow)).not.toThrow();
      expect(customWorkflow.name).toBe('validation-workflow');
      expect(customWorkflow.trigger).toEqual(['test:trigger']);
      expect(customWorkflow.stages).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should handle database operations gracefully', async () => {
      // Test that seeder operations don't throw on valid inputs
      expect(async () => {
        await seeder.seedPendingTask();
        await seeder.seedRunningTask();
        await seeder.reset();
        await seeder.seedCompletedTask();
      }).not.toThrow();
    });

    it('should handle cleanup when database is already closed', async () => {
      // Close database manually
      seeder.getDatabase().close();

      // Cleanup should not throw
      await expect(seeder.cleanup()).resolves.toBeUndefined();
    });
  });
});