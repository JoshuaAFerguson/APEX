/**
 * @fileoverview Comprehensive tests for the TaskStore test fixtures module
 *
 * This test suite verifies that all fixture factory functions:
 * - Generate valid data that passes Zod validation
 * - Support proper override functionality
 * - Handle bulk creation correctly
 * - Provide sensible defaults
 * - Handle edge cases gracefully
 */

import {
  createTestTask,
  createTestAgent,
  createTestWorkflowStage,
  createTestWorkflow,
  createTestTasks,
  createTestAgents,
  createTestWorkflows,
} from '../fixtures.js';

import {
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskEffortSchema,
} from '@apexcli/core';

import type {
  Task,
  AgentDefinition,
  WorkflowDefinition,
  WorkflowStage,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  AutonomyLevel,
} from '@apexcli/core';

describe('TaskStore Test Fixtures Module', () => {
  // ============================================================================
  // createTestTask Tests
  // ============================================================================

  describe('createTestTask', () => {
    it('should create a valid task with default values', () => {
      const task = createTestTask();

      // Verify required fields are populated
      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe('string');
      expect(task.id.startsWith('task_')).toBe(true);

      expect(task.description).toBe('Test task');
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('full');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.effort).toBe('medium');
      expect(task.projectPath).toBe('/test/project');
      expect(task.branchName).toBe('apex/test-branch');
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
      expect(task.resumeAttempts).toBe(0);

      // Verify dates are proper Date objects
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);

      // Verify usage object structure
      expect(task.usage).toBeDefined();
      expect(task.usage.inputTokens).toBe(0);
      expect(task.usage.outputTokens).toBe(0);
      expect(task.usage.totalTokens).toBe(0);
      expect(task.usage.estimatedCost).toBe(0);
      expect(task.usage.totalCostCents).toBe(0);
      expect(task.usage.executionTimeMs).toBe(0);

      // Verify arrays are initialized
      expect(Array.isArray(task.logs)).toBe(true);
      expect(task.logs.length).toBe(0);
      expect(Array.isArray(task.artifacts)).toBe(true);
      expect(task.artifacts.length).toBe(0);
      expect(Array.isArray(task.dependsOn)).toBe(true);
      expect(task.dependsOn.length).toBe(0);
      expect(Array.isArray(task.blockedBy)).toBe(true);
      expect(task.blockedBy.length).toBe(0);

      // Verify Zod validation for enum values
      expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
      expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
      expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();
    });

    it('should support override values', () => {
      const customDescription = 'Custom task description';
      const customWorkflow = 'custom-workflow';
      const customStatus: TaskStatus = 'in-progress';
      const customPriority: TaskPriority = 'urgent';
      const customEffort: TaskEffort = 'large';
      const customAutonomy: AutonomyLevel = 'supervised';

      const task = createTestTask({
        description: customDescription,
        workflow: customWorkflow,
        status: customStatus,
        priority: customPriority,
        effort: customEffort,
        autonomy: customAutonomy,
        retryCount: 2,
        maxRetries: 5,
      });

      expect(task.description).toBe(customDescription);
      expect(task.workflow).toBe(customWorkflow);
      expect(task.status).toBe(customStatus);
      expect(task.priority).toBe(customPriority);
      expect(task.effort).toBe(customEffort);
      expect(task.autonomy).toBe(customAutonomy);
      expect(task.retryCount).toBe(2);
      expect(task.maxRetries).toBe(5);

      // Verify overridden values still pass validation
      expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
      expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
      expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();
    });

    it('should generate unique IDs for each task', () => {
      const task1 = createTestTask();
      const task2 = createTestTask();

      expect(task1.id).not.toBe(task2.id);
    });

    it('should handle partial overrides correctly', () => {
      const task = createTestTask({
        description: 'Partial override',
        priority: 'high'
      });

      // Overridden values
      expect(task.description).toBe('Partial override');
      expect(task.priority).toBe('high');

      // Default values should remain
      expect(task.workflow).toBe('feature');
      expect(task.status).toBe('pending');
      expect(task.effort).toBe('medium');
    });

    it('should validate enum values correctly', () => {
      // Valid enum values should not throw
      expect(() => createTestTask({ status: 'completed' })).not.toThrow();
      expect(() => createTestTask({ priority: 'low' })).not.toThrow();
      expect(() => createTestTask({ effort: 'small' })).not.toThrow();

      // Test all valid status values
      const validStatuses: TaskStatus[] = ['pending', 'in-progress', 'completed', 'failed', 'cancelled', 'paused'];
      validStatuses.forEach(status => {
        expect(() => createTestTask({ status })).not.toThrow();
      });

      // Test all valid priority values
      const validPriorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
      validPriorities.forEach(priority => {
        expect(() => createTestTask({ priority })).not.toThrow();
      });

      // Test all valid effort values
      const validEfforts: TaskEffort[] = ['small', 'medium', 'large', 'xlarge'];
      validEfforts.forEach(effort => {
        expect(() => createTestTask({ effort })).not.toThrow();
      });
    });
  });

  // ============================================================================
  // createTestAgent Tests
  // ============================================================================

  describe('createTestAgent', () => {
    it('should create a valid agent with default values', () => {
      const agent = createTestAgent();

      expect(agent.name).toBe('test-agent');
      expect(agent.description).toBe('Test agent for automated testing');
      expect(agent.prompt).toBe('You are a test agent. Follow instructions carefully and provide detailed responses.');
      expect(agent.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep']);
      expect(agent.model).toBe('sonnet');
      expect(agent.skills).toEqual(['testing', 'debugging']);

      // Verify Zod validation passes
      expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
    });

    it('should support override values', () => {
      const customAgent = createTestAgent({
        name: 'custom-agent',
        description: 'Custom agent description',
        tools: ['Read', 'WebSearch'],
        model: 'opus',
        skills: ['research', 'analysis'],
      });

      expect(customAgent.name).toBe('custom-agent');
      expect(customAgent.description).toBe('Custom agent description');
      expect(customAgent.tools).toEqual(['Read', 'WebSearch']);
      expect(customAgent.model).toBe('opus');
      expect(customAgent.skills).toEqual(['research', 'analysis']);

      // Verify Zod validation passes
      expect(() => AgentDefinitionSchema.parse(customAgent)).not.toThrow();
    });

    it('should handle partial overrides correctly', () => {
      const agent = createTestAgent({
        name: 'partial-agent',
        model: 'haiku'
      });

      // Overridden values
      expect(agent.name).toBe('partial-agent');
      expect(agent.model).toBe('haiku');

      // Default values should remain
      expect(agent.description).toBe('Test agent for automated testing');
      expect(agent.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep']);
      expect(agent.skills).toEqual(['testing', 'debugging']);

      // Verify Zod validation passes
      expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
    });

    it('should validate all model types', () => {
      const models = ['opus', 'sonnet', 'haiku', 'inherit'] as const;

      models.forEach(model => {
        const agent = createTestAgent({ model });
        expect(agent.model).toBe(model);
        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
      });
    });

    it('should throw ZodError for invalid data', () => {
      // This would fail Zod validation if we passed invalid model
      expect(() => {
        const invalidData = { ...createTestAgent(), model: 'invalid-model' as any };
        AgentDefinitionSchema.parse(invalidData);
      }).toThrow();
    });
  });

  // ============================================================================
  // createTestWorkflowStage Tests
  // ============================================================================

  describe('createTestWorkflowStage', () => {
    it('should create a valid workflow stage with default values', () => {
      const stage = createTestWorkflowStage();

      expect(stage.name).toBe('test-stage');
      expect(stage.agent).toBe('test-agent');
      expect(stage.description).toBe('Test workflow stage');
      expect(stage.parallel).toBe(false);
      expect(stage.maxRetries).toBe(2);

      // Verify Zod validation passes
      expect(() => WorkflowStageSchema.parse(stage)).not.toThrow();
    });

    it('should support override values', () => {
      const customStage = createTestWorkflowStage({
        name: 'implementation',
        agent: 'developer',
        description: 'Implement the planned solution',
        parallel: true,
        maxRetries: 3,
        dependsOn: ['planning'],
        inputs: ['implementation_plan'],
        outputs: ['code_changes'],
      });

      expect(customStage.name).toBe('implementation');
      expect(customStage.agent).toBe('developer');
      expect(customStage.description).toBe('Implement the planned solution');
      expect(customStage.parallel).toBe(true);
      expect(customStage.maxRetries).toBe(3);
      expect(customStage.dependsOn).toEqual(['planning']);
      expect(customStage.inputs).toEqual(['implementation_plan']);
      expect(customStage.outputs).toEqual(['code_changes']);

      // Verify Zod validation passes
      expect(() => WorkflowStageSchema.parse(customStage)).not.toThrow();
    });

    it('should handle partial overrides correctly', () => {
      const stage = createTestWorkflowStage({
        name: 'review',
        parallel: true
      });

      // Overridden values
      expect(stage.name).toBe('review');
      expect(stage.parallel).toBe(true);

      // Default values should remain
      expect(stage.agent).toBe('test-agent');
      expect(stage.description).toBe('Test workflow stage');
      expect(stage.maxRetries).toBe(2);

      // Verify Zod validation passes
      expect(() => WorkflowStageSchema.parse(stage)).not.toThrow();
    });
  });

  // ============================================================================
  // createTestWorkflow Tests
  // ============================================================================

  describe('createTestWorkflow', () => {
    it('should create a valid workflow with default values', () => {
      const workflow = createTestWorkflow();

      expect(workflow.name).toBe('test-workflow');
      expect(workflow.description).toBe('Test workflow for automated testing');
      expect(Array.isArray(workflow.stages)).toBe(true);
      expect(workflow.stages.length).toBe(3);

      // Verify stages are correctly structured
      expect(workflow.stages[0].name).toBe('planning');
      expect(workflow.stages[0].agent).toBe('planner');
      expect(workflow.stages[0].outputs).toEqual(['implementation_plan']);

      expect(workflow.stages[1].name).toBe('implementation');
      expect(workflow.stages[1].agent).toBe('developer');
      expect(workflow.stages[1].dependsOn).toEqual(['planning']);
      expect(workflow.stages[1].inputs).toEqual(['implementation_plan']);
      expect(workflow.stages[1].outputs).toEqual(['code_changes']);

      expect(workflow.stages[2].name).toBe('testing');
      expect(workflow.stages[2].agent).toBe('tester');
      expect(workflow.stages[2].dependsOn).toEqual(['implementation']);
      expect(workflow.stages[2].inputs).toEqual(['code_changes']);
      expect(workflow.stages[2].outputs).toEqual(['test_results']);

      // Verify Zod validation passes
      expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
    });

    it('should support override values', () => {
      const customStages = [
        createTestWorkflowStage({
          name: 'custom-stage',
          agent: 'custom-agent',
        })
      ];

      const workflow = createTestWorkflow({
        name: 'custom-workflow',
        description: 'Custom workflow description',
        stages: customStages,
      });

      expect(workflow.name).toBe('custom-workflow');
      expect(workflow.description).toBe('Custom workflow description');
      expect(workflow.stages).toEqual(customStages);

      // Verify Zod validation passes
      expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
    });

    it('should handle partial overrides correctly', () => {
      const workflow = createTestWorkflow({
        name: 'partial-workflow'
      });

      // Overridden values
      expect(workflow.name).toBe('partial-workflow');

      // Default values should remain
      expect(workflow.description).toBe('Test workflow for automated testing');
      expect(workflow.stages.length).toBe(3);

      // Verify Zod validation passes
      expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
    });

    it('should create workflows with valid stage dependencies', () => {
      const workflow = createTestWorkflow();

      // Check that dependencies are properly set up
      const planningStage = workflow.stages.find(s => s.name === 'planning');
      const implementationStage = workflow.stages.find(s => s.name === 'implementation');
      const testingStage = workflow.stages.find(s => s.name === 'testing');

      expect(planningStage?.dependsOn).toBeUndefined();
      expect(implementationStage?.dependsOn).toEqual(['planning']);
      expect(testingStage?.dependsOn).toEqual(['implementation']);

      // Verify outputs/inputs alignment
      expect(planningStage?.outputs).toEqual(['implementation_plan']);
      expect(implementationStage?.inputs).toEqual(['implementation_plan']);
      expect(implementationStage?.outputs).toEqual(['code_changes']);
      expect(testingStage?.inputs).toEqual(['code_changes']);
    });
  });

  // ============================================================================
  // Bulk Creation Tests
  // ============================================================================

  describe('createTestTasks', () => {
    it('should create multiple tasks with default values', () => {
      const count = 5;
      const tasks = createTestTasks(count);

      expect(tasks.length).toBe(count);

      tasks.forEach((task, index) => {
        expect(task.description).toBe(`Test task ${index + 1}`);
        expect(task.workflow).toBe('feature');
        expect(task.status).toBe('pending');
        expect(task.id).toBeDefined();

        // Verify each task validates
        expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
        expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
        expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();
      });
    });

    it('should create unique tasks', () => {
      const tasks = createTestTasks(3);
      const ids = tasks.map(t => t.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3); // All IDs should be unique
    });

    it('should support static overrides for all tasks', () => {
      const overrides = {
        workflow: 'bug-fix',
        priority: 'urgent' as TaskPriority,
        effort: 'large' as TaskEffort,
      };

      const tasks = createTestTasks(3, overrides);

      tasks.forEach(task => {
        expect(task.workflow).toBe('bug-fix');
        expect(task.priority).toBe('urgent');
        expect(task.effort).toBe('large');

        // Verify validation passes
        expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
        expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();
      });
    });

    it('should support function-based overrides', () => {
      const tasks = createTestTasks(3, (index) => ({
        description: `Dynamic task ${index}`,
        priority: index === 0 ? 'urgent' as TaskPriority : 'normal' as TaskPriority,
      }));

      expect(tasks[0].description).toBe('Dynamic task 0');
      expect(tasks[0].priority).toBe('urgent');
      expect(tasks[1].description).toBe('Dynamic task 1');
      expect(tasks[1].priority).toBe('normal');
      expect(tasks[2].description).toBe('Dynamic task 2');
      expect(tasks[2].priority).toBe('normal');
    });

    it('should throw error for invalid count', () => {
      expect(() => createTestTasks(0)).toThrow('Count must be a positive number');
      expect(() => createTestTasks(-1)).toThrow('Count must be a positive number');
    });
  });

  describe('createTestAgents', () => {
    it('should create multiple agents with default pattern', () => {
      const count = 3;
      const agents = createTestAgents(count);

      expect(agents.length).toBe(count);

      agents.forEach((agent, index) => {
        expect(agent.name).toBe(`test-agent-${index + 1}`);
        expect(agent.description).toBe(`Test agent ${index + 1}`);
        expect(agent.model).toBe('sonnet');

        // Verify each agent validates
        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
      });
    });

    it('should support static overrides for all agents', () => {
      const overrides = {
        model: 'opus' as const,
        skills: ['custom-skill'],
      };

      const agents = createTestAgents(2, overrides);

      agents.forEach(agent => {
        expect(agent.model).toBe('opus');
        expect(agent.skills).toEqual(['custom-skill']);

        // Verify validation passes
        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
      });
    });

    it('should support function-based overrides', () => {
      const agents = createTestAgents(2, (index) => ({
        name: `custom-agent-${index}`,
        model: index === 0 ? 'opus' as const : 'haiku' as const,
      }));

      expect(agents[0].name).toBe('custom-agent-0');
      expect(agents[0].model).toBe('opus');
      expect(agents[1].name).toBe('custom-agent-1');
      expect(agents[1].model).toBe('haiku');
    });

    it('should throw error for invalid count', () => {
      expect(() => createTestAgents(0)).toThrow('Count must be a positive number');
      expect(() => createTestAgents(-5)).toThrow('Count must be a positive number');
    });
  });

  describe('createTestWorkflows', () => {
    it('should create multiple workflows with default pattern', () => {
      const count = 2;
      const workflows = createTestWorkflows(count);

      expect(workflows.length).toBe(count);

      workflows.forEach((workflow, index) => {
        expect(workflow.name).toBe(`test-workflow-${index + 1}`);
        expect(workflow.description).toBe(`Test workflow ${index + 1}`);
        expect(workflow.stages.length).toBe(3);

        // Verify each workflow validates
        expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
      });
    });

    it('should support static overrides for all workflows', () => {
      const customStages = [
        createTestWorkflowStage({ name: 'single-stage', agent: 'single-agent' })
      ];

      const workflows = createTestWorkflows(2, {
        stages: customStages,
      });

      workflows.forEach(workflow => {
        expect(workflow.stages).toEqual(customStages);

        // Verify validation passes
        expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
      });
    });

    it('should support function-based overrides', () => {
      const workflows = createTestWorkflows(2, (index) => ({
        name: `dynamic-workflow-${index}`,
        description: `Dynamic workflow ${index} description`,
      }));

      expect(workflows[0].name).toBe('dynamic-workflow-0');
      expect(workflows[0].description).toBe('Dynamic workflow 0 description');
      expect(workflows[1].name).toBe('dynamic-workflow-1');
      expect(workflows[1].description).toBe('Dynamic workflow 1 description');
    });

    it('should throw error for invalid count', () => {
      expect(() => createTestWorkflows(0)).toThrow('Count must be a positive number');
      expect(() => createTestWorkflows(-10)).toThrow('Count must be a positive number');
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('should return correct TypeScript types', () => {
      const task: Task = createTestTask();
      const agent: AgentDefinition = createTestAgent();
      const stage: WorkflowStage = createTestWorkflowStage();
      const workflow: WorkflowDefinition = createTestWorkflow();

      // Type assertions - these should compile without errors
      expect(typeof task.id).toBe('string');
      expect(typeof agent.name).toBe('string');
      expect(typeof stage.name).toBe('string');
      expect(typeof workflow.name).toBe('string');
    });

    it('should maintain type safety for arrays', () => {
      const tasks: Task[] = createTestTasks(2);
      const agents: AgentDefinition[] = createTestAgents(2);
      const workflows: WorkflowDefinition[] = createTestWorkflows(2);

      // Type assertions - these should compile without errors
      expect(Array.isArray(tasks)).toBe(true);
      expect(Array.isArray(agents)).toBe(true);
      expect(Array.isArray(workflows)).toBe(true);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should create fixtures that work together', () => {
      // Create related fixtures
      const agent = createTestAgent({
        name: 'integration-agent',
        skills: ['integration-testing']
      });

      const stage = createTestWorkflowStage({
        name: 'integration-stage',
        agent: agent.name,
      });

      const workflow = createTestWorkflow({
        name: 'integration-workflow',
        stages: [stage]
      });

      const task = createTestTask({
        workflow: workflow.name,
        description: 'Integration test task'
      });

      // Verify relationships
      expect(stage.agent).toBe(agent.name);
      expect(workflow.stages[0]).toBe(stage);
      expect(task.workflow).toBe(workflow.name);

      // Verify all fixtures validate
      expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
      expect(() => WorkflowStageSchema.parse(stage)).not.toThrow();
      expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
      expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty overrides gracefully', () => {
      expect(() => createTestTask({})).not.toThrow();
      expect(() => createTestAgent({})).not.toThrow();
      expect(() => createTestWorkflowStage({})).not.toThrow();
      expect(() => createTestWorkflow({})).not.toThrow();
    });

    it('should handle undefined overrides gracefully', () => {
      expect(() => createTestTask(undefined)).not.toThrow();
      expect(() => createTestAgent(undefined)).not.toThrow();
      expect(() => createTestWorkflowStage(undefined)).not.toThrow();
      expect(() => createTestWorkflow(undefined)).not.toThrow();
    });

    it('should handle null overrides gracefully', () => {
      expect(() => createTestTask(null as any)).not.toThrow();
      expect(() => createTestAgent(null as any)).not.toThrow();
      expect(() => createTestWorkflowStage(null as any)).not.toThrow();
      expect(() => createTestWorkflow(null as any)).not.toThrow();
    });

    it('should handle bulk creation with zero or negative counts', () => {
      expect(() => createTestTasks(0)).toThrow();
      expect(() => createTestAgents(-1)).toThrow();
      expect(() => createTestWorkflows(-5)).toThrow();
    });

    it('should maintain immutability - overrides should not affect defaults', () => {
      const originalOverrides = { description: 'Original' };
      const task1 = createTestTask(originalOverrides);

      originalOverrides.description = 'Modified';
      const task2 = createTestTask(originalOverrides);

      expect(task1.description).toBe('Original');
      expect(task2.description).toBe('Modified');
    });
  });
});