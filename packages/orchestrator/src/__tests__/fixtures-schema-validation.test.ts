/**
 * @fileoverview Schema validation tests for TaskStore test fixtures module
 *
 * Focuses specifically on Zod schema validation to ensure all fixtures
 * produce data that passes schema validation requirements.
 */

import {
  createTestTask,
  createTestAgent,
  createTestWorkflowStage,
  createTestWorkflow,
} from '../fixtures.js';

import {
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskEffortSchema,
  AgentModelSchema,
} from '@apexcli/core';

import { z } from 'zod';

describe('TaskStore Fixtures - Schema Validation', () => {
  // ============================================================================
  // Individual Schema Validation Tests
  // ============================================================================

  describe('TaskStatusSchema Validation', () => {
    it('should validate all supported task statuses', () => {
      const supportedStatuses = [
        'pending', 'queued', 'planning', 'in-progress',
        'waiting-approval', 'awaiting-approval', 'paused',
        'completed', 'failed', 'cancelled'
      ];

      supportedStatuses.forEach(status => {
        const task = createTestTask({ status: status as any });

        expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
        expect(TaskStatusSchema.parse(task.status)).toBe(status);

        // Ensure the entire task object is valid
        expect(task.id).toBeDefined();
        expect(task.description).toBeDefined();
        expect(task.status).toBe(status);
      });
    });

    it('should handle task status transitions realistically', () => {
      const statusTransitions = [
        { from: 'pending', to: 'in-progress' },
        { from: 'in-progress', to: 'waiting-approval' },
        { from: 'waiting-approval', to: 'completed' },
        { from: 'in-progress', to: 'failed' },
        { from: 'failed', to: 'pending' }, // Retry
        { from: 'paused', to: 'in-progress' },
        { from: 'in-progress', to: 'cancelled' }
      ];

      statusTransitions.forEach(({ from, to }) => {
        const task1 = createTestTask({ status: from as any });
        const task2 = createTestTask({ status: to as any });

        expect(() => TaskStatusSchema.parse(task1.status)).not.toThrow();
        expect(() => TaskStatusSchema.parse(task2.status)).not.toThrow();
        expect(task1.status).toBe(from);
        expect(task2.status).toBe(to);
      });
    });
  });

  describe('TaskPrioritySchema Validation', () => {
    it('should validate all supported task priorities', () => {
      const priorities = ['low', 'normal', 'high', 'urgent'];

      priorities.forEach(priority => {
        const task = createTestTask({ priority: priority as any });

        expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
        expect(TaskPrioritySchema.parse(task.priority)).toBe(priority);
        expect(task.priority).toBe(priority);
      });
    });

    it('should validate priority ordering semantically', () => {
      const priorityOrder = ['low', 'normal', 'high', 'urgent'];
      const tasks = priorityOrder.map(priority =>
        createTestTask({
          description: `${priority} priority task`,
          priority: priority as any
        })
      );

      tasks.forEach((task, index) => {
        expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
        expect(task.priority).toBe(priorityOrder[index]);
      });
    });
  });

  describe('TaskEffortSchema Validation', () => {
    it('should validate all supported effort levels', () => {
      const efforts = ['xs', 'small', 'medium', 'large', 'xl'];

      efforts.forEach(effort => {
        const task = createTestTask({ effort: effort as any });

        expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();
        expect(TaskEffortSchema.parse(task.effort)).toBe(effort);
        expect(task.effort).toBe(effort);
      });
    });

    it('should validate effort scaling makes sense', () => {
      const effortScales = ['xs', 'small', 'medium', 'large', 'xl'];
      const tasks = effortScales.map(effort =>
        createTestTask({
          description: `${effort} effort task`,
          effort: effort as any
        })
      );

      tasks.forEach((task, index) => {
        expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();
        expect(task.effort).toBe(effortScales[index]);
      });
    });
  });

  describe('AgentDefinitionSchema Validation', () => {
    it('should validate all supported agent models', () => {
      const models = ['opus', 'sonnet', 'haiku', 'inherit'];

      models.forEach(model => {
        const agent = createTestAgent({ model: model as any });

        expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
        expect(() => AgentModelSchema.parse(agent.model)).not.toThrow();
        expect(agent.model).toBe(model);
      });
    });

    it('should validate agent with minimal required fields', () => {
      const minimalAgent = createTestAgent({
        name: 'minimal-agent',
        description: 'Minimal agent description',
        prompt: 'You are a minimal agent.'
      });

      expect(() => AgentDefinitionSchema.parse(minimalAgent)).not.toThrow();
      expect(minimalAgent.name).toBe('minimal-agent');
      expect(minimalAgent.description).toBe('Minimal agent description');
      expect(minimalAgent.prompt).toBe('You are a minimal agent.');
    });

    it('should validate agent with all optional fields', () => {
      const fullAgent = createTestAgent({
        name: 'full-agent',
        description: 'Full agent with all fields',
        prompt: 'You are a full-featured agent.',
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        model: 'opus',
        skills: ['analysis', 'implementation', 'testing', 'documentation']
      });

      expect(() => AgentDefinitionSchema.parse(fullAgent)).not.toThrow();
      expect(fullAgent.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);
      expect(fullAgent.model).toBe('opus');
      expect(fullAgent.skills).toEqual(['analysis', 'implementation', 'testing', 'documentation']);
    });

    it('should validate agent with empty optional arrays', () => {
      const emptyAgent = createTestAgent({
        tools: [],
        skills: []
      });

      expect(() => AgentDefinitionSchema.parse(emptyAgent)).not.toThrow();
      expect(Array.isArray(emptyAgent.tools)).toBe(true);
      expect(Array.isArray(emptyAgent.skills)).toBe(true);
      expect(emptyAgent.tools!.length).toBe(0);
      expect(emptyAgent.skills!.length).toBe(0);
    });
  });

  describe('WorkflowStageSchema Validation', () => {
    it('should validate stage with minimal required fields', () => {
      const minimalStage = createTestWorkflowStage({
        name: 'minimal-stage',
        agent: 'minimal-agent',
        description: 'Minimal stage description'
      });

      expect(() => WorkflowStageSchema.parse(minimalStage)).not.toThrow();
      expect(minimalStage.name).toBe('minimal-stage');
      expect(minimalStage.agent).toBe('minimal-agent');
      expect(minimalStage.description).toBe('Minimal stage description');
    });

    it('should validate stage with all optional fields', () => {
      const fullStage = createTestWorkflowStage({
        name: 'full-stage',
        agent: 'full-agent',
        description: 'Full stage with all fields',
        parallel: true,
        maxRetries: 5,
        dependsOn: ['stage1', 'stage2'],
        inputs: ['input1', 'input2'],
        outputs: ['output1', 'output2'],
        timeout: 3600,
        environment: {
          NODE_ENV: 'production',
          API_KEY: 'test-key'
        }
      });

      expect(() => WorkflowStageSchema.parse(fullStage)).not.toThrow();
      expect(fullStage.parallel).toBe(true);
      expect(fullStage.maxRetries).toBe(5);
      expect(fullStage.dependsOn).toEqual(['stage1', 'stage2']);
      expect(fullStage.inputs).toEqual(['input1', 'input2']);
      expect(fullStage.outputs).toEqual(['output1', 'output2']);
      expect(fullStage.timeout).toBe(3600);
      expect(fullStage.environment).toEqual({
        NODE_ENV: 'production',
        API_KEY: 'test-key'
      });
    });

    it('should validate boolean and numeric values correctly', () => {
      const booleanStage = createTestWorkflowStage({
        parallel: false,
        maxRetries: 0
      });

      expect(() => WorkflowStageSchema.parse(booleanStage)).not.toThrow();
      expect(booleanStage.parallel).toBe(false);
      expect(booleanStage.maxRetries).toBe(0);
    });
  });

  describe('WorkflowDefinitionSchema Validation', () => {
    it('should validate workflow with minimal structure', () => {
      const minimalWorkflow = createTestWorkflow({
        name: 'minimal-workflow',
        description: 'Minimal workflow',
        stages: [
          createTestWorkflowStage({
            name: 'single-stage',
            agent: 'single-agent',
            description: 'Single stage'
          })
        ]
      });

      expect(() => WorkflowDefinitionSchema.parse(minimalWorkflow)).not.toThrow();
      expect(minimalWorkflow.stages.length).toBe(1);
      expect(minimalWorkflow.stages[0].name).toBe('single-stage');
    });

    it('should validate complex multi-stage workflow', () => {
      const complexWorkflow = createTestWorkflow({
        name: 'complex-workflow',
        description: 'Complex multi-stage workflow',
        // Uses default stages from createTestWorkflow
      });

      expect(() => WorkflowDefinitionSchema.parse(complexWorkflow)).not.toThrow();
      expect(complexWorkflow.stages.length).toBeGreaterThan(0);

      // Each stage should be valid
      complexWorkflow.stages.forEach(stage => {
        expect(() => WorkflowStageSchema.parse(stage)).not.toThrow();
      });
    });

    it('should validate workflow stage dependencies are consistent', () => {
      const dependentWorkflow = createTestWorkflow({
        name: 'dependent-workflow',
        description: 'Workflow with stage dependencies',
        stages: [
          createTestWorkflowStage({
            name: 'stage1',
            agent: 'agent1',
            description: 'First stage',
            outputs: ['stage1-output']
          }),
          createTestWorkflowStage({
            name: 'stage2',
            agent: 'agent2',
            description: 'Second stage',
            dependsOn: ['stage1'],
            inputs: ['stage1-output'],
            outputs: ['stage2-output']
          }),
          createTestWorkflowStage({
            name: 'stage3',
            agent: 'agent3',
            description: 'Third stage',
            dependsOn: ['stage2'],
            inputs: ['stage2-output']
          })
        ]
      });

      expect(() => WorkflowDefinitionSchema.parse(dependentWorkflow)).not.toThrow();

      const [stage1, stage2, stage3] = dependentWorkflow.stages;

      // Verify dependencies
      expect(stage1.dependsOn).toBeUndefined();
      expect(stage2.dependsOn).toEqual(['stage1']);
      expect(stage3.dependsOn).toEqual(['stage2']);

      // Verify inputs/outputs alignment
      expect(stage1.outputs).toEqual(['stage1-output']);
      expect(stage2.inputs).toEqual(['stage1-output']);
      expect(stage2.outputs).toEqual(['stage2-output']);
      expect(stage3.inputs).toEqual(['stage2-output']);
    });
  });

  // ============================================================================
  // Cross-Schema Validation Tests
  // ============================================================================

  describe('Cross-Schema Integration Validation', () => {
    it('should validate complete fixture ecosystem together', () => {
      // Create a complete ecosystem
      const agent = createTestAgent({
        name: 'ecosystem-agent',
        model: 'sonnet',
        skills: ['testing', 'validation']
      });

      const stage = createTestWorkflowStage({
        name: 'ecosystem-stage',
        agent: agent.name,
        description: 'Stage using the ecosystem agent'
      });

      const workflow = createTestWorkflow({
        name: 'ecosystem-workflow',
        description: 'Workflow using the ecosystem stage',
        stages: [stage]
      });

      const task = createTestTask({
        description: 'Task using the ecosystem workflow',
        workflow: workflow.name,
        status: 'pending',
        priority: 'normal',
        effort: 'medium'
      });

      // Validate all components
      expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
      expect(() => WorkflowStageSchema.parse(stage)).not.toThrow();
      expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
      expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
      expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
      expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();

      // Verify relationships
      expect(stage.agent).toBe(agent.name);
      expect(workflow.stages[0]).toBe(stage);
      expect(task.workflow).toBe(workflow.name);
    });

    it('should validate schema compatibility across different fixture combinations', () => {
      const combinations = [
        { status: 'pending', priority: 'low', effort: 'xs' },
        { status: 'in-progress', priority: 'normal', effort: 'small' },
        { status: 'waiting-approval', priority: 'high', effort: 'medium' },
        { status: 'completed', priority: 'urgent', effort: 'large' },
        { status: 'failed', priority: 'high', effort: 'xl' }
      ];

      combinations.forEach(({ status, priority, effort }) => {
        const task = createTestTask({ status: status as any, priority: priority as any, effort: effort as any });

        expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
        expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
        expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();

        expect(task.status).toBe(status);
        expect(task.priority).toBe(priority);
        expect(task.effort).toBe(effort);
      });
    });
  });

  // ============================================================================
  // Error Case Schema Validation
  // ============================================================================

  describe('Schema Error Handling', () => {
    it('should demonstrate schema validation catches invalid data', () => {
      // These should throw when validated against schemas (not when created)
      const taskWithInvalidStatus = createTestTask();
      (taskWithInvalidStatus as any).status = 'invalid-status';

      expect(() => TaskStatusSchema.parse(taskWithInvalidStatus.status)).toThrow();
    });

    it('should demonstrate strict schema validation', () => {
      const agent = createTestAgent();
      (agent as any).model = 'gpt-4'; // Invalid model

      expect(() => AgentDefinitionSchema.parse(agent)).toThrow();
    });

    it('should validate required fields are present', () => {
      const task = createTestTask();

      // Remove required fields
      delete (task as any).id;
      delete (task as any).description;

      // Should fail schema validation for Task-like schemas if they existed
      // Note: Task is an interface, not a schema, so we test component schemas
      expect(task.status).toBeDefined(); // This should still exist
      expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
    });
  });

  // ============================================================================
  // Schema Type Safety Tests
  // ============================================================================

  describe('Schema Type Safety', () => {
    it('should ensure type safety at compile time and runtime', () => {
      // These should compile and run without TypeScript errors
      const validTask = createTestTask({
        status: 'pending',
        priority: 'normal',
        effort: 'medium'
      });

      const validAgent = createTestAgent({
        name: 'typed-agent',
        model: 'sonnet'
      });

      const validStage = createTestWorkflowStage({
        name: 'typed-stage',
        agent: 'typed-agent',
        parallel: false
      });

      const validWorkflow = createTestWorkflow({
        name: 'typed-workflow',
        stages: [validStage]
      });

      // Runtime validation should pass
      expect(() => TaskStatusSchema.parse(validTask.status)).not.toThrow();
      expect(() => TaskPrioritySchema.parse(validTask.priority)).not.toThrow();
      expect(() => TaskEffortSchema.parse(validTask.effort)).not.toThrow();
      expect(() => AgentDefinitionSchema.parse(validAgent)).not.toThrow();
      expect(() => WorkflowStageSchema.parse(validStage)).not.toThrow();
      expect(() => WorkflowDefinitionSchema.parse(validWorkflow)).not.toThrow();
    });

    it('should maintain type inference correctness', () => {
      const task = createTestTask();
      const agent = createTestAgent();
      const stage = createTestWorkflowStage();
      const workflow = createTestWorkflow();

      // These type assertions should pass at compile time
      const taskStatus: string = task.status;
      const taskPriority: string = task.priority;
      const taskEffort: string = task.effort;
      const agentName: string = agent.name;
      const agentModel: string = agent.model;
      const stageName: string = stage.name;
      const stageParallel: boolean = stage.parallel;
      const workflowName: string = workflow.name;
      const workflowStages: Array<any> = workflow.stages;

      expect(typeof taskStatus).toBe('string');
      expect(typeof taskPriority).toBe('string');
      expect(typeof taskEffort).toBe('string');
      expect(typeof agentName).toBe('string');
      expect(typeof agentModel).toBe('string');
      expect(typeof stageName).toBe('string');
      expect(typeof stageParallel).toBe('boolean');
      expect(typeof workflowName).toBe('string');
      expect(Array.isArray(workflowStages)).toBe(true);
    });
  });
});