/**
 * Comprehensive schema validation tests for DatabaseSeeder.
 * Ensures all fixtures and seeded data comply with core Zod schemas.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSeeder } from '../test-utils';
import type { Task, AgentDefinition, WorkflowDefinition, TaskStatus, AgentModel } from '@apexcli/core';

describe('DatabaseSeeder Schema Validation', () => {
  let seeder: DatabaseSeeder;

  beforeEach(async () => {
    seeder = new DatabaseSeeder();
    await seeder.initialize();
  });

  afterEach(async () => {
    await seeder.cleanup();
  });

  describe('task schema validation', () => {
    it('should validate all task status variations against TaskSchema', async () => {
      const { TaskSchema } = await import('@apexcli/core');

      const tasksByStatus = [
        await seeder.seedPendingTask({ description: 'Pending validation test' }),
        await seeder.seedRunningTask({ description: 'Running validation test' }),
        await seeder.seedCompletedTask({ description: 'Completed validation test' }),
        await seeder.seedFailedTask({ description: 'Failed validation test' }),
        await seeder.seedPausedTask({ description: 'Paused validation test' }),
        await seeder.seedCancelledTask({ description: 'Cancelled validation test' })
      ];

      for (const task of tasksByStatus) {
        expect(() => TaskSchema.parse(task),
          `Task with status ${task.status} should validate against TaskSchema`).not.toThrow();
      }
    });

    it('should validate task scenarios against TaskSchema', async () => {
      const { TaskSchema } = await import('@apexcli/core');

      const scenarios = ['mixed-statuses', 'dependency-chain', 'subtask-tree', 'retry-exhausted'] as const;

      for (const scenario of scenarios) {
        await seeder.reset();
        const tasks = await seeder.seedTaskScenario(scenario);

        for (const task of tasks) {
          expect(() => TaskSchema.parse(task),
            `Task from scenario ${scenario} should validate against TaskSchema`).not.toThrow();
        }
      }
    });

    it('should validate complex task overrides against TaskSchema', async () => {
      const { TaskSchema } = await import('@apexcli/core');

      const complexTask = await seeder.seedCompletedTask({
        description: 'Complex validation test with many fields',
        acceptanceCriteria: 'All validation should pass',
        priority: 'high',
        effort: 'large',
        branchName: 'feature/schema-validation-test',
        prUrl: 'https://github.com/test/repo/pull/123',
        retryCount: 2,
        maxRetries: 5,
        resumeAttempts: 1,
        usage: {
          inputTokens: 15000,
          outputTokens: 8000,
          totalTokens: 23000,
          estimatedCost: 0.35,
          totalCostCents: 35,
          executionTimeMs: 300000
        },
        dependsOn: ['parent-task-id'],
        subtaskIds: ['subtask-1', 'subtask-2'],
        subtaskStrategy: 'parallel'
      });

      expect(() => TaskSchema.parse(complexTask)).not.toThrow();

      // Verify specific fields are properly typed
      expect(complexTask.priority).toBe('high');
      expect(complexTask.effort).toBe('large');
      expect(complexTask.subtaskStrategy).toBe('parallel');
      expect(complexTask.usage.totalTokens).toBe(23000);
    });

    it('should validate task usage data against schema requirements', async () => {
      const { TaskUsageSchema } = await import('@apexcli/core');

      const taskWithUsage = await seeder.seedCompletedTask({
        description: 'Usage validation test',
        usage: {
          inputTokens: 5000,
          outputTokens: 3000,
          totalTokens: 8000,
          estimatedCost: 0.12,
          totalCostCents: 12,
          executionTimeMs: 45000
        }
      });

      expect(() => TaskUsageSchema.parse(taskWithUsage.usage)).not.toThrow();

      // Verify numeric types
      expect(typeof taskWithUsage.usage.inputTokens).toBe('number');
      expect(typeof taskWithUsage.usage.estimatedCost).toBe('number');
      expect(taskWithUsage.usage.totalTokens).toBe(8000);
    });
  });

  describe('agent definition schema validation', () => {
    it('should validate all standard agent fixtures against AgentDefinitionSchema', () => {
      const { AgentDefinitionSchema } = require('@apexcli/core');

      const agents = seeder.createStandardAgentFixtures();

      for (const agent of agents) {
        expect(() => AgentDefinitionSchema.parse(agent),
          `Agent ${agent.name} should validate against AgentDefinitionSchema`).not.toThrow();
      }

      // Verify specific agents exist with correct properties
      const planner = agents.find(a => a.name === 'planner');
      const developer = agents.find(a => a.name === 'developer');
      const tester = agents.find(a => a.name === 'tester');

      expect(planner).toBeDefined();
      expect(developer).toBeDefined();
      expect(tester).toBeDefined();

      expect(planner!.skills).toContain('planning');
      expect(developer!.skills).toContain('typescript');
      expect(tester!.skills).toContain('testing');
    });

    it('should validate custom agent fixtures with various configurations', () => {
      const { AgentDefinitionSchema } = require('@apexcli/core');

      const customAgents = [
        // Minimal configuration
        seeder.createAgentFixture({
          name: 'minimal-agent',
          description: 'Minimal agent configuration'
        }),

        // Maximum configuration
        seeder.createAgentFixture({
          name: 'maximal-agent',
          description: 'Agent with all possible fields',
          prompt: 'Comprehensive prompt with detailed instructions',
          tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'LSP'],
          model: 'opus' as AgentModel,
          skills: ['javascript', 'typescript', 'python', 'go', 'docker', 'kubernetes', 'testing']
        }),

        // Different model types
        seeder.createAgentFixture({
          name: 'sonnet-agent',
          model: 'sonnet' as AgentModel
        }),
        seeder.createAgentFixture({
          name: 'haiku-agent',
          model: 'haiku' as AgentModel
        })
      ];

      for (const agent of customAgents) {
        expect(() => AgentDefinitionSchema.parse(agent),
          `Custom agent ${agent.name} should validate against AgentDefinitionSchema`).not.toThrow();
      }
    });

    it('should validate agent tools arrays contain valid tool names', () => {
      const { AgentDefinitionSchema } = require('@apexcli/core');

      const agentWithTools = seeder.createAgentFixture({
        name: 'tools-validation-agent',
        description: 'Agent for validating tool arrays',
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'LSP', 'WebFetch', 'WebSearch']
      });

      expect(() => AgentDefinitionSchema.parse(agentWithTools)).not.toThrow();

      // Verify tools array structure
      expect(Array.isArray(agentWithTools.tools)).toBe(true);
      expect(agentWithTools.tools.length).toBeGreaterThan(0);
      expect(agentWithTools.tools.every(tool => typeof tool === 'string')).toBe(true);
    });

    it('should validate agent skills arrays', () => {
      const { AgentDefinitionSchema } = require('@apexcli/core');

      const agentWithSkills = seeder.createAgentFixture({
        name: 'skills-validation-agent',
        description: 'Agent for validating skills arrays',
        skills: ['programming', 'testing', 'debugging', 'code-review', 'documentation']
      });

      expect(() => AgentDefinitionSchema.parse(agentWithSkills)).not.toThrow();

      // Verify skills array structure
      expect(Array.isArray(agentWithSkills.skills)).toBe(true);
      expect(agentWithSkills.skills!.length).toBeGreaterThan(0);
      expect(agentWithSkills.skills!.every(skill => typeof skill === 'string')).toBe(true);
    });
  });

  describe('workflow definition schema validation', () => {
    it('should validate all standard workflow fixtures against WorkflowDefinitionSchema', () => {
      const { WorkflowDefinitionSchema } = require('@apexcli/core');

      const workflows = seeder.createStandardWorkflowFixtures();

      for (const workflow of workflows) {
        expect(() => WorkflowDefinitionSchema.parse(workflow),
          `Workflow ${workflow.name} should validate against WorkflowDefinitionSchema`).not.toThrow();
      }

      // Verify specific workflows
      const featureWorkflow = workflows.find(w => w.name === 'feature');
      const bugfixWorkflow = workflows.find(w => w.name === 'bugfix');
      const testingWorkflow = workflows.find(w => w.name === 'testing');

      expect(featureWorkflow).toBeDefined();
      expect(bugfixWorkflow).toBeDefined();
      expect(testingWorkflow).toBeDefined();

      expect(featureWorkflow!.stages.length).toBe(5);
      expect(bugfixWorkflow!.stages.length).toBe(3);
      expect(testingWorkflow!.stages.length).toBe(3);
    });

    it('should validate workflow stages against WorkflowStageSchema', () => {
      const { WorkflowStageSchema } = require('@apexcli/core');

      const complexStages = [
        // Minimal stage
        seeder.createWorkflowStageFixture({
          name: 'minimal-stage',
          agent: 'developer'
        }),

        // Comprehensive stage
        seeder.createWorkflowStageFixture({
          name: 'comprehensive-stage',
          agent: 'tester',
          description: 'Comprehensive testing stage',
          dependsOn: ['planning', 'implementation'],
          inputs: ['code-changes', 'requirements'],
          outputs: ['test-results', 'coverage-report'],
          parallel: true,
          maxRetries: 3,
          timeoutMinutes: 60
        })
      ];

      for (const stage of complexStages) {
        expect(() => WorkflowStageSchema.parse(stage),
          `Workflow stage ${stage.name} should validate against WorkflowStageSchema`).not.toThrow();
      }
    });

    it('should validate complex workflow definitions with multiple stages', () => {
      const { WorkflowDefinitionSchema, WorkflowStageSchema } = require('@apexcli/core');

      const complexWorkflow = seeder.createWorkflowFixture({
        name: 'complex-validation-workflow',
        description: 'Multi-stage workflow for validation testing',
        trigger: ['feature:requested', 'manual:triggered'],
        stages: [
          seeder.createWorkflowStageFixture({
            name: 'analysis',
            agent: 'planner',
            description: 'Analyze requirements and create plan',
            outputs: ['analysis-report', 'implementation-plan']
          }),
          seeder.createWorkflowStageFixture({
            name: 'design',
            agent: 'architect',
            description: 'Design system architecture',
            dependsOn: ['analysis'],
            inputs: ['analysis-report'],
            outputs: ['architecture-design', 'technical-specs']
          }),
          seeder.createWorkflowStageFixture({
            name: 'parallel-implementation',
            agent: 'developer',
            description: 'Implement features in parallel',
            dependsOn: ['design'],
            inputs: ['architecture-design', 'technical-specs'],
            outputs: ['feature-code', 'unit-tests'],
            parallel: true,
            maxRetries: 2
          }),
          seeder.createWorkflowStageFixture({
            name: 'integration',
            agent: 'developer',
            description: 'Integrate all components',
            dependsOn: ['parallel-implementation'],
            inputs: ['feature-code'],
            outputs: ['integrated-system']
          }),
          seeder.createWorkflowStageFixture({
            name: 'validation',
            agent: 'tester',
            description: 'Comprehensive testing and validation',
            dependsOn: ['integration'],
            inputs: ['integrated-system'],
            outputs: ['test-results', 'validation-report'],
            timeoutMinutes: 120
          })
        ]
      });

      expect(() => WorkflowDefinitionSchema.parse(complexWorkflow)).not.toThrow();

      // Validate each stage individually
      for (const stage of complexWorkflow.stages) {
        expect(() => WorkflowStageSchema.parse(stage),
          `Stage ${stage.name} in complex workflow should validate`).not.toThrow();
      }

      // Verify workflow structure
      expect(complexWorkflow.stages).toHaveLength(5);
      expect(complexWorkflow.trigger).toEqual(['feature:requested', 'manual:triggered']);

      const parallelStage = complexWorkflow.stages.find(s => s.name === 'parallel-implementation');
      expect(parallelStage!.parallel).toBe(true);
      expect(parallelStage!.maxRetries).toBe(2);
    });

    it('should validate workflow trigger arrays', () => {
      const { WorkflowDefinitionSchema } = require('@apexcli/core');

      const workflowWithTriggers = seeder.createWorkflowFixture({
        name: 'trigger-validation-workflow',
        description: 'Workflow for validating trigger arrays',
        trigger: ['manual:start', 'schedule:daily', 'event:push', 'api:webhook']
      });

      expect(() => WorkflowDefinitionSchema.parse(workflowWithTriggers)).not.toThrow();

      // Verify trigger structure
      expect(Array.isArray(workflowWithTriggers.trigger)).toBe(true);
      expect(workflowWithTriggers.trigger!.length).toBe(4);
      expect(workflowWithTriggers.trigger!.every(trigger => typeof trigger === 'string')).toBe(true);
    });
  });

  describe('cross-schema validation', () => {
    it('should validate complete environments with all schemas', async () => {
      const { TaskSchema, AgentDefinitionSchema, WorkflowDefinitionSchema } = await import('@apexcli/core');

      const environment = await seeder.seedFullEnvironment('mixed-statuses');

      // Validate all tasks
      for (const task of environment.tasks) {
        expect(() => TaskSchema.parse(task),
          `Task ${task.description} should validate against TaskSchema`).not.toThrow();
      }

      // Validate all agents
      for (const agent of environment.agents) {
        expect(() => AgentDefinitionSchema.parse(agent),
          `Agent ${agent.name} should validate against AgentDefinitionSchema`).not.toThrow();
      }

      // Validate all workflows
      for (const workflow of environment.workflows) {
        expect(() => WorkflowDefinitionSchema.parse(workflow),
          `Workflow ${workflow.name} should validate against WorkflowDefinitionSchema`).not.toThrow();
      }

      // Verify environment completeness
      expect(environment.tasks).toHaveLength(6);
      expect(environment.agents).toHaveLength(6);
      expect(environment.workflows).toHaveLength(3);
    });

    it('should validate task-workflow-agent relationships', async () => {
      const environment = await seeder.seedFullEnvironment('dependency-chain');

      // Extract workflow and agent names from fixtures
      const agentNames = environment.agents.map(a => a.name);
      const workflowNames = environment.workflows.map(w => w.name);

      // Verify task workflows reference valid workflow names
      for (const task of environment.tasks) {
        expect(workflowNames).toContain(task.workflow);
      }

      // Verify workflow stages reference valid agent names
      for (const workflow of environment.workflows) {
        for (const stage of workflow.stages) {
          expect(agentNames).toContain(stage.agent);
        }
      }

      // Verify specific relationships
      const featureWorkflow = environment.workflows.find(w => w.name === 'feature');
      if (featureWorkflow) {
        const planningStage = featureWorkflow.stages.find(s => s.name === 'planning');
        const implementationStage = featureWorkflow.stages.find(s => s.name === 'implementation');

        expect(planningStage?.agent).toBe('planner');
        expect(implementationStage?.agent).toBe('developer');
        expect(agentNames).toContain('planner');
        expect(agentNames).toContain('developer');
      }
    });

    it('should validate data consistency after complex operations', async () => {
      const { TaskSchema } = await import('@apexcli/core');

      // Perform series of operations
      await seeder.seedFullEnvironment('mixed-statuses');
      await seeder.reset();
      await seeder.seedTaskScenario('subtask-tree');
      await seeder.seedMinimalEnvironment();

      // Get all current data
      const tasks = await seeder.getStore().listTasks();
      const agents = seeder.getAgentFixtures();
      const workflows = seeder.getWorkflowFixtures();

      // All data should still validate
      for (const task of tasks) {
        expect(() => TaskSchema.parse(task)).not.toThrow();
      }

      // Should have expected counts (subtask-tree: 4 tasks + minimal: 1 task = 5 total)
      expect(tasks).toHaveLength(5);
      expect(agents).toHaveLength(6);
      expect(workflows).toHaveLength(3);
    });
  });

  describe('schema field validation', () => {
    it('should validate required vs optional fields in tasks', async () => {
      const minimalTask = await seeder.seedPendingTask({
        description: 'Minimal required fields only'
      });

      // Required fields should be present
      expect(minimalTask.id).toBeDefined();
      expect(minimalTask.description).toBeDefined();
      expect(minimalTask.workflow).toBeDefined();
      expect(minimalTask.autonomy).toBeDefined();
      expect(minimalTask.status).toBeDefined();
      expect(minimalTask.projectPath).toBeDefined();
      expect(minimalTask.createdAt).toBeDefined();
      expect(minimalTask.updatedAt).toBeDefined();

      // Optional fields may be undefined
      expect(minimalTask.acceptanceCriteria).toBeUndefined();
      expect(minimalTask.completedAt).toBeUndefined();
      expect(minimalTask.error).toBeUndefined();
    });

    it('should validate field types and constraints', async () => {
      const task = await seeder.seedCompletedTask({
        description: 'Type validation test',
        retryCount: 3,
        maxRetries: 5,
        usage: {
          inputTokens: 1000,
          outputTokens: 750,
          totalTokens: 1750,
          estimatedCost: 0.025,
          totalCostCents: 3, // Different from estimatedCost * 100 to test independence
          executionTimeMs: 30000
        }
      });

      // Verify numeric types
      expect(typeof task.retryCount).toBe('number');
      expect(typeof task.maxRetries).toBe('number');
      expect(typeof task.usage.inputTokens).toBe('number');
      expect(typeof task.usage.estimatedCost).toBe('number');

      // Verify string types
      expect(typeof task.id).toBe('string');
      expect(typeof task.description).toBe('string');
      expect(typeof task.status).toBe('string');

      // Verify date types
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.completedAt).toBeInstanceOf(Date);

      // Verify array types
      expect(Array.isArray(task.logs)).toBe(true);
      expect(Array.isArray(task.artifacts)).toBe(true);
      expect(Array.isArray(task.dependsOn)).toBe(true);
    });

    it('should validate enum values', async () => {
      // Test different status values
      const statuses: TaskStatus[] = ['pending', 'running', 'completed', 'failed', 'paused', 'cancelled'];

      for (const status of statuses) {
        const task = status === 'pending' ? await seeder.seedPendingTask({ description: `${status} test` }) :
                     status === 'running' ? await seeder.seedRunningTask({ description: `${status} test` }) :
                     status === 'completed' ? await seeder.seedCompletedTask({ description: `${status} test` }) :
                     status === 'failed' ? await seeder.seedFailedTask({ description: `${status} test` }) :
                     status === 'paused' ? await seeder.seedPausedTask({ description: `${status} test` }) :
                     await seeder.seedCancelledTask({ description: `${status} test` });

        expect(task.status).toBe(status);
        expect(statuses).toContain(task.status);
      }

      // Test priority values
      const priorities = ['low', 'normal', 'high', 'urgent'];
      for (const priority of priorities) {
        const task = await seeder.seedPendingTask({
          description: `Priority ${priority} test`,
          priority: priority as any
        });
        expect(task.priority).toBe(priority);
      }

      // Test effort values
      const efforts = ['small', 'medium', 'large', 'epic'];
      for (const effort of efforts) {
        const task = await seeder.seedPendingTask({
          description: `Effort ${effort} test`,
          effort: effort as any
        });
        expect(task.effort).toBe(effort);
      }
    });
  });
});