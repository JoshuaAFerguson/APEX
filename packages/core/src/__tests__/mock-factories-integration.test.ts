/**
 * @fileoverview Integration Tests for Mock Factories with Zod Schemas
 *
 * This test suite verifies that mock factories create objects that validate
 * successfully against the actual Zod schemas defined in types.ts.
 */

import { describe, test, expect } from 'vitest';
import {
  createMockTask,
  createMockAgentDefinition,
  createMockWorkflowDefinition,
  createMockWorkflowStage,
  createMockWorkflowGate,
  createMockPermission,
  createMockContainerConfig,
  createMockIsolationConfig,
  createMockWorkspaceConfig,
  createMockProjectConfig,
  createMockApexConfig,
  createMockComplexTask,
  createMockComplexWorkflow
} from '../test-fixtures/mock-factories.js';

import {
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStageSchema,
  WorkflowGateSchema,
  PermissionSchema,
  ContainerConfigSchema,
  IsolationConfigSchema,
  WorkspaceConfigSchema,
  ProjectConfigSchema,
  ApexConfigSchema,
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskEffortSchema,
  AutonomyLevelSchema,
  AgentModelSchema,
  AgentToolSchema
} from '../types.js';

describe('Mock Factories Zod Schema Integration', () => {
  describe('AgentDefinition Schema Validation', () => {
    test('validates default mock AgentDefinition against schema', () => {
      const agent = createMockAgentDefinition();

      const result = AgentDefinitionSchema.safeParse(agent);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates mock AgentDefinition with various models', () => {
      const models: Array<'opus' | 'sonnet' | 'haiku' | 'inherit'> = ['opus', 'sonnet', 'haiku', 'inherit'];

      for (const model of models) {
        const agent = createMockAgentDefinition({ model });
        const result = AgentDefinitionSchema.safeParse(agent);

        if (!result.success) {
          console.error(`Validation failed for model ${model}:`, result.error.issues);
        }

        expect(result.success).toBe(true);
      }
    });

    test('validates mock AgentDefinition with various tool combinations', () => {
      const toolCombinations = [
        ['task', 'read', 'write'],
        ['grep', 'edit'],
        ['bash', 'lsp'],
        ['web_search', 'web_fetch'],
        ['browser']
      ];

      for (const tools of toolCombinations) {
        const agent = createMockAgentDefinition({ tools: tools as any });
        const result = AgentDefinitionSchema.safeParse(agent);

        if (!result.success) {
          console.error(`Validation failed for tools ${tools.join(', ')}:`, result.error.issues);
        }

        expect(result.success).toBe(true);
      }
    });
  });

  describe('WorkflowDefinition Schema Validation', () => {
    test('validates default mock WorkflowDefinition against schema', () => {
      const workflow = createMockWorkflowDefinition();

      const result = WorkflowDefinitionSchema.safeParse(workflow);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates complex mock WorkflowDefinition with multiple stages', () => {
      const workflow = createMockComplexWorkflow();

      const result = WorkflowDefinitionSchema.safeParse(workflow);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates WorkflowDefinition with custom autonomy settings', () => {
      const workflow = createMockWorkflowDefinition({
        autonomy: {
          level: 'supervised',
          checkpoints: ['planning', 'implementation'],
          rejectionBehavior: 'pause'
        }
      });

      const result = WorkflowDefinitionSchema.safeParse(workflow);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('WorkflowStage Schema Validation', () => {
    test('validates default mock WorkflowStage against schema', () => {
      const stage = createMockWorkflowStage();

      const result = WorkflowStageSchema.safeParse(stage);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates WorkflowStage with inputs and outputs', () => {
      const stage = createMockWorkflowStage({
        inputs: ['requirements', 'design'],
        outputs: ['implementation', 'tests']
      });

      const result = WorkflowStageSchema.safeParse(stage);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates WorkflowStage with conditions', () => {
      const stage = createMockWorkflowStage({
        conditions: {
          'only_on_changes': 'git diff --name-only HEAD~1'
        }
      });

      const result = WorkflowStageSchema.safeParse(stage);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('WorkflowGate Schema Validation', () => {
    test('validates default mock WorkflowGate against schema', () => {
      const gate = createMockWorkflowGate();

      const result = WorkflowGateSchema.safeParse(gate);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates WorkflowGate with different types', () => {
      const gateTypes = ['approval', 'policy', 'manual'] as const;

      for (const type of gateTypes) {
        const gate = createMockWorkflowGate({ type });
        const result = WorkflowGateSchema.safeParse(gate);

        if (!result.success) {
          console.error(`Validation failed for gate type ${type}:`, result.error.issues);
        }

        expect(result.success).toBe(true);
      }
    });

    test('validates WorkflowGate with escalation settings', () => {
      const gate = createMockWorkflowGate({
        escalation: {
          timeout: 600000,
          notify: ['team@example.com'],
          fallback: 'auto_approve'
        }
      });

      const result = WorkflowGateSchema.safeParse(gate);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('Permission Schema Validation', () => {
    test('validates default mock Permission against schema', () => {
      const permission = createMockPermission();

      const result = PermissionSchema.safeParse(permission);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates Permission with different levels', () => {
      const levels: Array<'full' | 'readonly' | 'restricted' | 'none'> = ['full', 'readonly', 'restricted', 'none'];

      for (const level of levels) {
        const permission = createMockPermission({ level });
        const result = PermissionSchema.safeParse(permission);

        if (!result.success) {
          console.error(`Validation failed for permission level ${level}:`, result.error.issues);
        }

        expect(result.success).toBe(true);
      }
    });

    test('validates Permission with restrictions', () => {
      const permission = createMockPermission({
        level: 'restricted',
        restrictions: {
          maxFileSize: 1048576,
          allowedExtensions: ['.ts', '.js', '.json'],
          blockedPaths: ['/secret/**', '/private/**']
        }
      });

      const result = PermissionSchema.safeParse(permission);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('Container Configuration Schema Validation', () => {
    test('validates default mock ContainerConfig against schema', () => {
      const config = createMockContainerConfig();

      const result = ContainerConfigSchema.safeParse(config);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates ContainerConfig with resource limits', () => {
      const config = createMockContainerConfig({
        resourceLimits: {
          cpu: 2.0,
          memory: '2g',
          memoryReservation: '1g',
          cpuShares: 1024
        }
      });

      const result = ContainerConfigSchema.safeParse(config);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates ContainerConfig with volumes and environment', () => {
      const config = createMockContainerConfig({
        volumes: {
          '/host/path': '/container/path',
          '/another/host': '/another/container'
        },
        environment: {
          'NODE_ENV': 'test',
          'API_KEY': 'test-key'
        }
      });

      const result = ContainerConfigSchema.safeParse(config);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('Workspace Configuration Schema Validation', () => {
    test('validates default mock WorkspaceConfig against schema', () => {
      const config = createMockWorkspaceConfig();

      const result = WorkspaceConfigSchema.safeParse(config);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates WorkspaceConfig with different strategies', () => {
      const strategies = ['worktree', 'container', 'directory', 'none'] as const;

      for (const strategy of strategies) {
        const config = createMockWorkspaceConfig({ strategy });
        const result = WorkspaceConfigSchema.safeParse(config);

        if (!result.success) {
          console.error(`Validation failed for strategy ${strategy}:`, result.error.issues);
        }

        expect(result.success).toBe(true);
      }
    });

    test('validates WorkspaceConfig with isolation settings', () => {
      const config = createMockWorkspaceConfig({
        isolation: createMockIsolationConfig({
          mode: 'full',
          worktreeName: 'task-workspace',
          cleanupOnComplete: true
        })
      });

      const result = WorkspaceConfigSchema.safeParse(config);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('Project Configuration Schema Validation', () => {
    test('validates default mock ProjectConfig against schema', () => {
      const config = createMockProjectConfig();

      const result = ProjectConfigSchema.safeParse(config);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates ProjectConfig with agents and workflows', () => {
      const config = createMockProjectConfig({
        agents: {
          'developer': createMockAgentDefinition({ name: 'developer' }),
          'tester': createMockAgentDefinition({ name: 'tester' })
        },
        workflows: {
          'feature-dev': createMockWorkflowDefinition({ name: 'feature-dev' })
        }
      });

      const result = ProjectConfigSchema.safeParse(config);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('APEX Configuration Schema Validation', () => {
    test('validates default mock ApexConfig against schema', () => {
      const config = createMockApexConfig();

      const result = ApexConfigSchema.safeParse(config);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });

    test('validates ApexConfig with comprehensive settings', () => {
      const config = createMockApexConfig({
        project: createMockProjectConfig({
          autonomy: {
            level: 'supervised',
            checkpoints: ['planning', 'implementation'],
            rejectionBehavior: 'pause'
          }
        }),
        permissions: {
          filesystem: createMockPermission({ level: 'restricted' }),
          shell: createMockPermission({ level: 'readonly' }),
          network: createMockPermission({ level: 'none' })
        }
      });

      const result = ApexConfigSchema.safeParse(config);

      if (!result.success) {
        console.error('Validation errors:', result.error.issues);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('Task Schema Components Validation', () => {
    test('validates task status enum values', () => {
      const validStatuses = ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'];

      for (const status of validStatuses) {
        const result = TaskStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    test('validates task priority enum values', () => {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];

      for (const priority of validPriorities) {
        const result = TaskPrioritySchema.safeParse(priority);
        expect(result.success).toBe(true);
      }
    });

    test('validates task effort enum values', () => {
      const validEfforts = ['xs', 'small', 'medium', 'large', 'xl'];

      for (const effort of validEfforts) {
        const result = TaskEffortSchema.safeParse(effort);
        expect(result.success).toBe(true);
      }
    });

    test('validates autonomy level enum values', () => {
      const validLevels = ['autonomous', 'supervised', 'manual'];

      for (const level of validLevels) {
        const result = AutonomyLevelSchema.safeParse(level);
        expect(result.success).toBe(true);
      }
    });

    test('validates agent model enum values', () => {
      const validModels = ['opus', 'sonnet', 'haiku', 'inherit'];

      for (const model of validModels) {
        const result = AgentModelSchema.safeParse(model);
        expect(result.success).toBe(true);
      }
    });

    test('validates agent tool enum values', () => {
      const validTools = [
        'task', 'todo_write', 'grep', 'glob', 'read', 'edit', 'write',
        'bash', 'lsp', 'web_search', 'web_fetch', 'browser', 'ask_user_question',
        'enter_plan_mode', 'exit_plan_mode'
      ];

      for (const tool of validTools) {
        const result = AgentToolSchema.safeParse(tool);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Error Case Testing', () => {
    test('handles invalid enum values gracefully', () => {
      // Test invalid task status
      const invalidStatus = TaskStatusSchema.safeParse('invalid-status');
      expect(invalidStatus.success).toBe(false);

      // Test invalid agent model
      const invalidModel = AgentModelSchema.safeParse('invalid-model');
      expect(invalidModel.success).toBe(false);

      // Test invalid autonomy level
      const invalidAutonomy = AutonomyLevelSchema.safeParse('invalid-level');
      expect(invalidAutonomy.success).toBe(false);
    });

    test('validates schema rejection for incomplete objects', () => {
      // Test incomplete agent definition
      const incompleteAgent = AgentDefinitionSchema.safeParse({
        name: 'test-agent'
        // Missing required fields
      });
      expect(incompleteAgent.success).toBe(false);

      // Test incomplete workflow definition
      const incompleteWorkflow = WorkflowDefinitionSchema.safeParse({
        name: 'test-workflow'
        // Missing required stages field
      });
      expect(incompleteWorkflow.success).toBe(false);
    });
  });
});