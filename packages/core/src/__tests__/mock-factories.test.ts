/**
 * @fileoverview Tests for Mock Factories
 *
 * This test suite verifies that all mock factories create valid objects
 * that conform to their respective type definitions and Zod schemas.
 */

import { describe, test, expect } from 'vitest';
import {
  mockFactories,
  createMockTask,
  createMockTaskUsage,
  createMockTaskLog,
  createMockTaskArtifact,
  createMockAgentDefinition,
  createMockWorkflowStage,
  createMockWorkflowGate,
  createMockWorkflowDefinition,
  createMockPermission,
  createMockToolConfig,
  createMockContainerConfig,
  createMockIsolationConfig,
  createMockWorkspaceConfig,
  createMockProjectConfig,
  createMockApexConfig,
  createMockSubtaskDefinition,
  createMockTaskDecomposition,
  createMockWorkflowTestData,
  createMockComplexTask,
  createMockComplexWorkflow,
  validateMockObject
} from '../test-fixtures/mock-factories.js';

import {
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskEffortSchema,
  AutonomyLevelSchema,
  AgentDefinitionSchema,
  WorkflowStageSchema,
  WorkflowGateSchema,
  WorkflowDefinitionSchema,
  PermissionSchema,
  ToolConfigSchema,
  ContainerConfigSchema,
  IsolationConfigSchema,
  WorkspaceConfigSchema,
  ProjectConfigSchema,
  ApexConfigSchema
} from '../types.js';

describe('Mock Factories', () => {
  describe('Task Mock Factory', () => {
    test('creates valid Task with default values', () => {
      const task = createMockTask();

      expect(task.id).toMatch(/^task-[a-z0-9]+$/);
      expect(task.description).toBe('Mock task description');
      expect(task.workflow).toBe('feature-development');
      expect(task.autonomy).toBe('supervised');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.effort).toBe('medium');
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
      expect(task.resumeAttempts).toBe(0);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.usage).toEqual(expect.objectContaining({
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        totalTokens: expect.any(Number),
        estimatedCost: expect.any(Number),
        totalCostCents: expect.any(Number),
        executionTimeMs: expect.any(Number)
      }));
      expect(task.logs).toEqual([]);
      expect(task.artifacts).toEqual([]);
    });

    test('creates valid Task with overrides', () => {
      const overrides = {
        description: 'Custom task description',
        priority: 'high' as const,
        effort: 'large' as const,
        status: 'running' as const
      };

      const task = createMockTask(overrides);

      expect(task.description).toBe('Custom task description');
      expect(task.priority).toBe('high');
      expect(task.effort).toBe('large');
      expect(task.status).toBe('running');
    });

    test('creates Task with valid enum values', () => {
      const task = createMockTask();

      expect(() => TaskStatusSchema.parse(task.status)).not.toThrow();
      expect(() => TaskPrioritySchema.parse(task.priority)).not.toThrow();
      expect(() => TaskEffortSchema.parse(task.effort)).not.toThrow();
      expect(() => AutonomyLevelSchema.parse(task.autonomy)).not.toThrow();
    });
  });

  describe('TaskUsage Mock Factory', () => {
    test('creates valid TaskUsage with default values', () => {
      const usage = createMockTaskUsage();

      expect(usage).toEqual({
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.015,
        totalCostCents: 15,
        executionTimeMs: 5000
      });
    });

    test('creates valid TaskUsage with overrides', () => {
      const overrides = {
        inputTokens: 2000,
        outputTokens: 1000,
        estimatedCost: 0.05
      };

      const usage = createMockTaskUsage(overrides);

      expect(usage.inputTokens).toBe(2000);
      expect(usage.outputTokens).toBe(1000);
      expect(usage.estimatedCost).toBe(0.05);
      expect(usage.totalTokens).toBe(1500); // Should keep default
      expect(usage.totalCostCents).toBe(15); // Should keep default
    });
  });

  describe('TaskLog Mock Factory', () => {
    test('creates valid TaskLog with default values', () => {
      const log = createMockTaskLog();

      expect(log.timestamp).toBeInstanceOf(Date);
      expect(log.level).toBe('info');
      expect(log.stage).toBe('implementation');
      expect(log.agent).toBe('developer');
      expect(log.message).toBe('Mock log message');
      expect(log.metadata).toEqual({ action: 'test-action' });
    });

    test('creates valid TaskLog with overrides', () => {
      const overrides = {
        level: 'error' as const,
        message: 'Custom error message',
        stage: 'testing'
      };

      const log = createMockTaskLog(overrides);

      expect(log.level).toBe('error');
      expect(log.message).toBe('Custom error message');
      expect(log.stage).toBe('testing');
    });
  });

  describe('TaskArtifact Mock Factory', () => {
    test('creates valid TaskArtifact with default values', () => {
      const artifact = createMockTaskArtifact();

      expect(artifact.name).toBe('MockFile.ts');
      expect(artifact.type).toBe('file');
      expect(artifact.path).toBe('/src/components/MockFile.ts');
      expect(artifact.content).toContain('MockComponent');
      expect(artifact.createdAt).toBeInstanceOf(Date);
    });

    test('creates valid TaskArtifact with overrides', () => {
      const overrides = {
        name: 'test.diff',
        type: 'diff' as const,
        content: '+ added line\n- removed line'
      };

      const artifact = createMockTaskArtifact(overrides);

      expect(artifact.name).toBe('test.diff');
      expect(artifact.type).toBe('diff');
      expect(artifact.content).toBe('+ added line\n- removed line');
    });
  });

  describe('AgentDefinition Mock Factory', () => {
    test('creates valid AgentDefinition with default values', () => {
      const agent = createMockAgentDefinition();

      expect(agent.name).toBe('mock-agent');
      expect(agent.model).toBe('sonnet');
      expect(agent.role).toBe('Mock Agent Role');
      expect(agent.tools).toEqual(['task', 'grep', 'read', 'edit', 'write']);
      expect(agent.description).toBe('Mock agent for testing purposes');
      expect(agent.prompt).toBe('You are a mock agent used for testing.');
    });

    test('creates valid AgentDefinition with overrides', () => {
      const overrides = {
        name: 'custom-agent',
        model: 'opus' as const,
        tools: ['read', 'write'] as const
      };

      const agent = createMockAgentDefinition(overrides);

      expect(agent.name).toBe('custom-agent');
      expect(agent.model).toBe('opus');
      expect(agent.tools).toEqual(['read', 'write']);
    });

    test('creates AgentDefinition that validates against schema', () => {
      const agent = createMockAgentDefinition();

      expect(() => AgentDefinitionSchema.parse(agent)).not.toThrow();
    });
  });

  describe('WorkflowStage Mock Factory', () => {
    test('creates valid WorkflowStage with default values', () => {
      const stage = createMockWorkflowStage();

      expect(stage.name).toBe('mock-stage');
      expect(stage.agent).toBe('mock-agent');
      expect(stage.description).toBe('Mock workflow stage');
      expect(stage.prompt).toBe('Execute mock stage operations');
      expect(stage.tools).toEqual(['task', 'read', 'write']);
    });

    test('creates valid WorkflowStage with overrides', () => {
      const overrides = {
        name: 'custom-stage',
        agent: 'custom-agent',
        tools: ['grep', 'edit'] as const
      };

      const stage = createMockWorkflowStage(overrides);

      expect(stage.name).toBe('custom-stage');
      expect(stage.agent).toBe('custom-agent');
      expect(stage.tools).toEqual(['grep', 'edit']);
    });

    test('creates WorkflowStage that validates against schema', () => {
      const stage = createMockWorkflowStage();

      expect(() => WorkflowStageSchema.parse(stage)).not.toThrow();
    });
  });

  describe('WorkflowGate Mock Factory', () => {
    test('creates valid WorkflowGate with default values', () => {
      const gate = createMockWorkflowGate();

      expect(gate.type).toBe('approval');
      expect(gate.condition).toBe('always');
      expect(gate.title).toBe('Mock Approval Gate');
      expect(gate.description).toBe('Mock gate for testing');
      expect(gate.timeout).toBe(300000);
      expect(gate.required).toBe(true);
    });

    test('creates valid WorkflowGate with overrides', () => {
      const overrides = {
        type: 'policy' as const,
        condition: 'on_error',
        title: 'Custom Gate'
      };

      const gate = createMockWorkflowGate(overrides);

      expect(gate.type).toBe('policy');
      expect(gate.condition).toBe('on_error');
      expect(gate.title).toBe('Custom Gate');
    });

    test('creates WorkflowGate that validates against schema', () => {
      const gate = createMockWorkflowGate();

      expect(() => WorkflowGateSchema.parse(gate)).not.toThrow();
    });
  });

  describe('WorkflowDefinition Mock Factory', () => {
    test('creates valid WorkflowDefinition with default values', () => {
      const workflow = createMockWorkflowDefinition();

      expect(workflow.name).toBe('mock-workflow');
      expect(workflow.description).toBe('Mock workflow for testing');
      expect(workflow.stages).toHaveLength(1);
      expect(workflow.stages[0].name).toBe('mock-stage');
    });

    test('creates valid WorkflowDefinition with overrides', () => {
      const customStages = [
        createMockWorkflowStage({ name: 'stage1' }),
        createMockWorkflowStage({ name: 'stage2' })
      ];
      const overrides = {
        name: 'custom-workflow',
        stages: customStages
      };

      const workflow = createMockWorkflowDefinition(overrides);

      expect(workflow.name).toBe('custom-workflow');
      expect(workflow.stages).toHaveLength(2);
      expect(workflow.stages[0].name).toBe('stage1');
      expect(workflow.stages[1].name).toBe('stage2');
    });

    test('creates WorkflowDefinition that validates against schema', () => {
      const workflow = createMockWorkflowDefinition();

      expect(() => WorkflowDefinitionSchema.parse(workflow)).not.toThrow();
    });
  });

  describe('Permission Mock Factory', () => {
    test('creates valid Permission with default values', () => {
      const permission = createMockPermission();

      expect(permission.level).toBe('full');
      expect(permission.scope).toEqual(['read', 'write']);
      expect(permission.paths).toEqual(['/allowed/**']);
    });

    test('creates valid Permission with overrides', () => {
      const overrides = {
        level: 'readonly' as const,
        scope: ['read'] as const,
        paths: ['/readonly/**']
      };

      const permission = createMockPermission(overrides);

      expect(permission.level).toBe('readonly');
      expect(permission.scope).toEqual(['read']);
      expect(permission.paths).toEqual(['/readonly/**']);
    });

    test('creates Permission that validates against schema', () => {
      const permission = createMockPermission();

      expect(() => PermissionSchema.parse(permission)).not.toThrow();
    });
  });

  describe('Configuration Mock Factories', () => {
    test('creates valid ContainerConfig', () => {
      const config = createMockContainerConfig();

      expect(config.image).toBe('node:20-alpine');
      expect(config.networkMode).toBe('bridge');
      expect(config.workingDir).toBe('/workspace');
      expect(config.autoRemove).toBe(true);
      expect(config.privileged).toBe(false);

      expect(() => ContainerConfigSchema.parse(config)).not.toThrow();
    });

    test('creates valid IsolationConfig', () => {
      const config = createMockIsolationConfig();

      expect(config.mode).toBe('worktree');

      expect(() => IsolationConfigSchema.parse(config)).not.toThrow();
    });

    test('creates valid WorkspaceConfig', () => {
      const config = createMockWorkspaceConfig();

      expect(config.strategy).toBe('directory');

      expect(() => WorkspaceConfigSchema.parse(config)).not.toThrow();
    });

    test('creates valid ProjectConfig', () => {
      const config = createMockProjectConfig();

      expect(config.name).toBe('mock-project');
      expect(config.description).toBe('Mock project for testing');
      expect(config.agents).toEqual({});
      expect(config.workflows).toEqual({});

      expect(() => ProjectConfigSchema.parse(config)).not.toThrow();
    });

    test('creates valid ApexConfig', () => {
      const config = createMockApexConfig();

      expect(config.version).toBe('0.5.0');
      expect(config.project).toEqual(expect.objectContaining({
        name: 'mock-project',
        description: 'Mock project for testing'
      }));

      expect(() => ApexConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe('Subtask Mock Factories', () => {
    test('creates valid SubtaskDefinition', () => {
      const definition = createMockSubtaskDefinition();

      expect(definition.description).toBe('Mock subtask description');
      expect(definition.acceptanceCriteria).toBe('Subtask should complete successfully');
    });

    test('creates valid TaskDecomposition', () => {
      const decomposition = createMockTaskDecomposition();

      expect(decomposition.parentTaskId).toBe('parent-task-id');
      expect(decomposition.subtasks).toHaveLength(1);
      expect(decomposition.strategy).toBe('sequential');
      expect(decomposition.subtasks[0].description).toBe('Mock subtask description');
    });
  });

  describe('Complex Mock Factories', () => {
    test('creates workflow test data collection', () => {
      const testData = createMockWorkflowTestData();

      expect(testData.task).toEqual(expect.objectContaining({
        id: expect.stringMatching(/^task-[a-z0-9]+$/),
        description: 'Mock task description'
      }));
      expect(testData.agent).toEqual(expect.objectContaining({
        name: 'mock-agent',
        model: 'sonnet'
      }));
      expect(testData.workflow).toEqual(expect.objectContaining({
        name: 'mock-workflow',
        stages: expect.arrayContaining([expect.any(Object)])
      }));
      expect(testData.config).toEqual(expect.objectContaining({
        version: '0.5.0',
        project: expect.any(Object)
      }));
    });

    test('creates workflow test data with overrides', () => {
      const testData = createMockWorkflowTestData({
        task: { description: 'Custom task' },
        agent: { name: 'custom-agent' },
        workflow: { name: 'custom-workflow' }
      });

      expect(testData.task.description).toBe('Custom task');
      expect(testData.agent.name).toBe('custom-agent');
      expect(testData.workflow.name).toBe('custom-workflow');
    });

    test('creates complex task with multiple logs and artifacts', () => {
      const task = createMockComplexTask();

      expect(task.logs).toHaveLength(3);
      expect(task.logs[0].message).toBe('Task started');
      expect(task.logs[1].level).toBe('warn');
      expect(task.logs[2].message).toBe('Task completed');

      expect(task.artifacts).toHaveLength(3);
      expect(task.artifacts[0].type).toBe('file');
      expect(task.artifacts[1].type).toBe('diff');
      expect(task.artifacts[2].type).toBe('report');

      expect(task.usage.inputTokens).toBe(5000);
      expect(task.usage.totalTokens).toBe(7500);
    });

    test('creates complex workflow with multiple stages and gates', () => {
      const workflow = createMockComplexWorkflow();

      expect(workflow.name).toBe('complex-workflow');
      expect(workflow.stages).toHaveLength(4);
      expect(workflow.stages[0].name).toBe('planning');
      expect(workflow.stages[1].name).toBe('implementation');
      expect(workflow.stages[2].name).toBe('testing');
      expect(workflow.stages[3].name).toBe('review');

      expect(workflow.gates).toHaveLength(2);
      expect(workflow.gates![0].title).toBe('Plan Approval');
      expect(workflow.gates![1].title).toBe('Security Check');
    });
  });

  describe('Validation Utilities', () => {
    test('validateMockObject returns true for valid objects', () => {
      const task = createMockTask();
      const isValid = validateMockObject(task, (obj) => {
        return typeof obj.id === 'string' && typeof obj.description === 'string';
      });

      expect(isValid).toBe(true);
    });

    test('validateMockObject returns false for invalid objects', () => {
      const task = createMockTask();
      const isValid = validateMockObject(task, (obj) => {
        return obj.id === 'invalid-id';
      });

      expect(isValid).toBe(false);
    });

    test('validateMockObject handles validation errors gracefully', () => {
      const task = createMockTask();
      const isValid = validateMockObject(task, () => {
        throw new Error('Validation failed');
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Mock Factories Collection', () => {
    test('exports all factory functions', () => {
      expect(mockFactories).toEqual(expect.objectContaining({
        createMockTask: expect.any(Function),
        createMockTaskUsage: expect.any(Function),
        createMockTaskLog: expect.any(Function),
        createMockTaskArtifact: expect.any(Function),
        createMockAgentDefinition: expect.any(Function),
        createMockWorkflowStage: expect.any(Function),
        createMockWorkflowGate: expect.any(Function),
        createMockWorkflowDefinition: expect.any(Function),
        createMockPermission: expect.any(Function),
        createMockToolConfig: expect.any(Function),
        createMockContainerConfig: expect.any(Function),
        createMockIsolationConfig: expect.any(Function),
        createMockWorkspaceConfig: expect.any(Function),
        createMockProjectConfig: expect.any(Function),
        createMockApexConfig: expect.any(Function),
        createMockSubtaskDefinition: expect.any(Function),
        createMockTaskDecomposition: expect.any(Function),
        createMockWorkflowTestData: expect.any(Function),
        createMockComplexTask: expect.any(Function),
        createMockComplexWorkflow: expect.any(Function),
        validateMockObject: expect.any(Function)
      }));
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles empty overrides gracefully', () => {
      const task = createMockTask({});

      expect(task).toEqual(expect.objectContaining({
        description: 'Mock task description',
        status: 'pending'
      }));
    });

    test('handles null and undefined values in overrides', () => {
      const task = createMockTask({
        acceptanceCriteria: undefined,
        branchName: null as any
      });

      expect(task.acceptanceCriteria).toBeUndefined();
      expect(task.branchName).toBeNull();
    });

    test('generates unique IDs for multiple mock objects', () => {
      const task1 = createMockTask();
      const task2 = createMockTask();

      expect(task1.id).not.toBe(task2.id);
    });

    test('handles complex nested overrides', () => {
      const task = createMockTask({
        usage: createMockTaskUsage({ inputTokens: 999 }),
        logs: [createMockTaskLog({ level: 'debug' })]
      });

      expect(task.usage.inputTokens).toBe(999);
      expect(task.logs).toHaveLength(1);
      expect(task.logs[0].level).toBe('debug');
    });
  });
});