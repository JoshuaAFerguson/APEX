/**
 * @fileoverview Comprehensive unit tests for workflow-related Zod schemas
 *
 * This test suite validates the JSDoc-documented workflow schemas:
 * - WorkflowGateSchema (Approval gates for workflow stages)
 * - WorkflowStageSchema (Individual workflow stage definitions)
 * - WorkflowDefinitionSchema (Complete workflow definitions)
 * - IsolationConfigSchema (Task isolation configuration)
 * - StageResult (Stage execution result interface)
 *
 * These tests verify both valid and invalid inputs, edge cases, and integration scenarios
 * to ensure the schemas correctly validate workflow configurations and execution data.
 */

import { describe, it, expect } from 'vitest';
import {
  WorkflowGateSchema,
  WorkflowStageSchema,
  WorkflowDefinitionSchema,
  IsolationConfigSchema,
  StageResult,
  type WorkflowGate,
  type WorkflowStage,
  type WorkflowDefinition,
  type IsolationConfig,
} from '../types';

// ============================================================================
// WorkflowGateSchema Tests
// ============================================================================

describe('WorkflowGateSchema', () => {
  describe('valid inputs', () => {
    it('should accept minimal valid gate definition', () => {
      const minimalGate = {
        id: 'security-gate',
        trigger: 'stage:implementation:completed',
      };

      const result = WorkflowGateSchema.safeParse(minimalGate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('security-gate');
        expect(result.data.trigger).toBe('stage:implementation:completed');
        expect(result.data.required).toBe(true); // default value
        expect(result.data.name).toBeUndefined();
        expect(result.data.description).toBeUndefined();
      }
    });

    it('should accept complete gate definition with all fields', () => {
      const completeGate: WorkflowGate = {
        id: 'code-review-gate',
        name: 'Code Review Gate',
        description: 'Requires code review before deployment',
        trigger: 'stage:implementation:completed',
        required: true,
        approvers: ['team-lead@company.com', 'security@company.com'],
        conditions: {
          branch: 'main',
          coverage: 80,
        },
        timeout: 60,
        tags: ['security', 'quality'],
      };

      const result = WorkflowGateSchema.safeParse(completeGate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Code Review Gate');
        expect(result.data.description).toBe('Requires code review before deployment');
        expect(result.data.approvers).toEqual(['team-lead@company.com', 'security@company.com']);
        expect(result.data.conditions).toEqual({ branch: 'main', coverage: 80 });
        expect(result.data.timeout).toBe(60);
        expect(result.data.tags).toEqual(['security', 'quality']);
      }
    });

    it('should accept different trigger event formats', () => {
      const triggerFormats = [
        'stage:planning:completed',
        'stage:implementation:started',
        'workflow:feature:completed',
        'pr:opened',
        'deployment:ready',
        'custom:event',
      ];

      triggerFormats.forEach(trigger => {
        const gate = { id: 'test-gate', trigger };
        const result = WorkflowGateSchema.safeParse(gate);
        expect(result.success).toBe(true);
      });
    });

    it('should handle boolean required field correctly', () => {
      const requiredGate = { id: 'required-gate', trigger: 'test', required: true };
      const optionalGate = { id: 'optional-gate', trigger: 'test', required: false };

      expect(WorkflowGateSchema.safeParse(requiredGate).success).toBe(true);
      expect(WorkflowGateSchema.safeParse(optionalGate).success).toBe(true);

      const result = WorkflowGateSchema.safeParse(optionalGate);
      if (result.success) {
        expect(result.data.required).toBe(false);
      }
    });

    it('should accept empty arrays for optional fields', () => {
      const gateWithEmptyArrays = {
        id: 'empty-arrays-gate',
        trigger: 'test',
        approvers: [],
        tags: [],
      };

      const result = WorkflowGateSchema.safeParse(gateWithEmptyArrays);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.approvers).toEqual([]);
        expect(result.data.tags).toEqual([]);
      }
    });

    it('should accept complex conditions object', () => {
      const gateWithComplexConditions = {
        id: 'complex-gate',
        trigger: 'test',
        conditions: {
          environment: 'production',
          tests: { passed: true, coverage: 85 },
          security: { scan: 'passed', vulnerabilities: 0 },
          nested: { deep: { value: 'allowed' } },
        },
      };

      const result = WorkflowGateSchema.safeParse(gateWithComplexConditions);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject gate without required id', () => {
      const invalidGate = {
        trigger: 'stage:completed',
      };

      const result = WorkflowGateSchema.safeParse(invalidGate);
      expect(result.success).toBe(false);
    });

    it('should reject gate without required trigger', () => {
      const invalidGate = {
        id: 'test-gate',
      };

      const result = WorkflowGateSchema.safeParse(invalidGate);
      expect(result.success).toBe(false);
    });

    it('should reject gate with empty id', () => {
      const invalidGate = {
        id: '',
        trigger: 'test',
      };

      const result = WorkflowGateSchema.safeParse(invalidGate);
      expect(result.success).toBe(false);
    });

    it('should reject gate with empty trigger', () => {
      const invalidGate = {
        id: 'test-gate',
        trigger: '',
      };

      const result = WorkflowGateSchema.safeParse(invalidGate);
      expect(result.success).toBe(false);
    });

    it('should reject gate with invalid field types', () => {
      const invalidGates = [
        { id: 123, trigger: 'test' }, // id must be string
        { id: 'test', trigger: 456 }, // trigger must be string
        { id: 'test', trigger: 'test', required: 'yes' }, // required must be boolean
        { id: 'test', trigger: 'test', timeout: '60' }, // timeout must be number
        { id: 'test', trigger: 'test', approvers: 'single-approver' }, // approvers must be array
        { id: 'test', trigger: 'test', tags: 'security' }, // tags must be array
      ];

      invalidGates.forEach(gate => {
        const result = WorkflowGateSchema.safeParse(gate);
        expect(result.success).toBe(false);
      });
    });

    it('should reject null and undefined values', () => {
      expect(WorkflowGateSchema.safeParse(null).success).toBe(false);
      expect(WorkflowGateSchema.safeParse(undefined).success).toBe(false);
    });
  });

  describe('default values', () => {
    it('should apply default value for required field', () => {
      const gate = {
        id: 'default-gate',
        trigger: 'test',
      };

      const result = WorkflowGateSchema.safeParse(gate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.required).toBe(true);
      }
    });

    it('should not override explicitly set required field', () => {
      const gate = {
        id: 'explicit-gate',
        trigger: 'test',
        required: false,
      };

      const result = WorkflowGateSchema.safeParse(gate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.required).toBe(false);
      }
    });
  });
});

// ============================================================================
// WorkflowStageSchema Tests
// ============================================================================

describe('WorkflowStageSchema', () => {
  describe('valid inputs', () => {
    it('should accept minimal valid stage definition', () => {
      const minimalStage = {
        name: 'implementation',
        agent: 'developer',
      };

      const result = WorkflowStageSchema.safeParse(minimalStage);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('implementation');
        expect(result.data.agent).toBe('developer');
        expect(result.data.parallel).toBe(false); // default value
        expect(result.data.maxRetries).toBe(2); // default value
      }
    });

    it('should accept complete stage definition with all fields', () => {
      const completeStage: WorkflowStage = {
        name: 'testing',
        agent: 'tester',
        description: 'Run comprehensive tests',
        dependsOn: ['implementation', 'linting'],
        parallel: true,
        inputs: ['code_changes', 'test_plan'],
        outputs: ['test_results', 'coverage_report'],
        condition: 'always',
        actions: ['unit_test', 'integration_test', 'e2e_test'],
        gate: 'quality-gate',
        maxRetries: 3,
      };

      const result = WorkflowStageSchema.safeParse(completeStage);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Run comprehensive tests');
        expect(result.data.dependsOn).toEqual(['implementation', 'linting']);
        expect(result.data.parallel).toBe(true);
        expect(result.data.inputs).toEqual(['code_changes', 'test_plan']);
        expect(result.data.outputs).toEqual(['test_results', 'coverage_report']);
        expect(result.data.condition).toBe('always');
        expect(result.data.actions).toEqual(['unit_test', 'integration_test', 'e2e_test']);
        expect(result.data.gate).toBe('quality-gate');
        expect(result.data.maxRetries).toBe(3);
      }
    });

    it('should accept different agent types', () => {
      const agentTypes = [
        'planner',
        'architect',
        'developer',
        'tester',
        'reviewer',
        'devops',
        'custom-agent',
        'ai-specialist',
      ];

      agentTypes.forEach(agent => {
        const stage = { name: 'test-stage', agent };
        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
      });
    });

    it('should accept various dependency configurations', () => {
      const dependencyConfigs = [
        [], // no dependencies
        ['stage1'], // single dependency
        ['stage1', 'stage2'], // multiple dependencies
        ['planning', 'architecture', 'implementation'], // workflow stages
      ];

      dependencyConfigs.forEach(dependsOn => {
        const stage = { name: 'test-stage', agent: 'test-agent', dependsOn };
        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
      });
    });

    it('should handle parallel execution flag correctly', () => {
      const parallelStage = { name: 'parallel-stage', agent: 'test', parallel: true };
      const sequentialStage = { name: 'sequential-stage', agent: 'test', parallel: false };

      expect(WorkflowStageSchema.safeParse(parallelStage).success).toBe(true);
      expect(WorkflowStageSchema.safeParse(sequentialStage).success).toBe(true);
    });

    it('should accept nullable gate field', () => {
      const stageWithoutGate = { name: 'no-gate', agent: 'test', gate: null };
      const stageWithGate = { name: 'with-gate', agent: 'test', gate: 'review-gate' };

      expect(WorkflowStageSchema.safeParse(stageWithoutGate).success).toBe(true);
      expect(WorkflowStageSchema.safeParse(stageWithGate).success).toBe(true);
    });

    it('should accept various maxRetries values', () => {
      const retryValues = [0, 1, 2, 3, 5, 10];

      retryValues.forEach(maxRetries => {
        const stage = { name: 'retry-stage', agent: 'test', maxRetries };
        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('invalid inputs', () => {
    it('should reject stage without required name', () => {
      const invalidStage = {
        agent: 'developer',
      };

      const result = WorkflowStageSchema.safeParse(invalidStage);
      expect(result.success).toBe(false);
    });

    it('should reject stage without required agent', () => {
      const invalidStage = {
        name: 'implementation',
      };

      const result = WorkflowStageSchema.safeParse(invalidStage);
      expect(result.success).toBe(false);
    });

    it('should reject stage with empty name', () => {
      const invalidStage = {
        name: '',
        agent: 'developer',
      };

      const result = WorkflowStageSchema.safeParse(invalidStage);
      expect(result.success).toBe(false);
    });

    it('should reject stage with empty agent', () => {
      const invalidStage = {
        name: 'implementation',
        agent: '',
      };

      const result = WorkflowStageSchema.safeParse(invalidStage);
      expect(result.success).toBe(false);
    });

    it('should reject stage with invalid field types', () => {
      const invalidStages = [
        { name: 123, agent: 'test' }, // name must be string
        { name: 'test', agent: 456 }, // agent must be string
        { name: 'test', agent: 'test', parallel: 'true' }, // parallel must be boolean
        { name: 'test', agent: 'test', maxRetries: '2' }, // maxRetries must be number
        { name: 'test', agent: 'test', dependsOn: 'stage1' }, // dependsOn must be array
        { name: 'test', agent: 'test', inputs: 'input1' }, // inputs must be array
        { name: 'test', agent: 'test', outputs: 'output1' }, // outputs must be array
        { name: 'test', agent: 'test', actions: 'action1' }, // actions must be array
      ];

      invalidStages.forEach(stage => {
        const result = WorkflowStageSchema.safeParse(stage);
        expect(result.success).toBe(false);
      });
    });

    it('should reject negative maxRetries', () => {
      const invalidStage = {
        name: 'test',
        agent: 'test',
        maxRetries: -1,
      };

      const result = WorkflowStageSchema.safeParse(invalidStage);
      expect(result.success).toBe(false);
    });

    it('should reject null and undefined values', () => {
      expect(WorkflowStageSchema.safeParse(null).success).toBe(false);
      expect(WorkflowStageSchema.safeParse(undefined).success).toBe(false);
    });
  });

  describe('default values', () => {
    it('should apply default values for optional fields', () => {
      const stage = {
        name: 'default-stage',
        agent: 'test-agent',
      };

      const result = WorkflowStageSchema.safeParse(stage);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parallel).toBe(false);
        expect(result.data.maxRetries).toBe(2);
      }
    });

    it('should not override explicitly set optional fields', () => {
      const stage = {
        name: 'explicit-stage',
        agent: 'test-agent',
        parallel: true,
        maxRetries: 5,
      };

      const result = WorkflowStageSchema.safeParse(stage);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parallel).toBe(true);
        expect(result.data.maxRetries).toBe(5);
      }
    });
  });
});

// ============================================================================
// WorkflowDefinitionSchema Tests
// ============================================================================

describe('WorkflowDefinitionSchema', () => {
  describe('valid inputs', () => {
    it('should accept minimal valid workflow definition', () => {
      const minimalWorkflow = {
        name: 'feature-workflow',
        description: 'Basic feature development workflow',
        stages: [
          {
            name: 'planning',
            agent: 'planner',
          },
        ],
      };

      const result = WorkflowDefinitionSchema.safeParse(minimalWorkflow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('feature-workflow');
        expect(result.data.description).toBe('Basic feature development workflow');
        expect(result.data.stages).toHaveLength(1);
        expect(result.data.trigger).toBeUndefined();
        expect(result.data.gates).toBeUndefined();
        expect(result.data.isolation).toBeUndefined();
      }
    });

    it('should accept complete workflow definition with all fields', () => {
      const completeWorkflow: WorkflowDefinition = {
        name: 'comprehensive-workflow',
        description: 'Full-featured workflow with all options',
        trigger: ['pr:opened', 'issue:labeled:enhancement'],
        stages: [
          {
            name: 'planning',
            agent: 'planner',
            description: 'Plan the implementation',
            inputs: ['requirements'],
            outputs: ['plan', 'architecture'],
          },
          {
            name: 'implementation',
            agent: 'developer',
            description: 'Implement the solution',
            dependsOn: ['planning'],
            inputs: ['plan', 'architecture'],
            outputs: ['code_changes', 'tests'],
            gate: 'code-review-gate',
          },
          {
            name: 'testing',
            agent: 'tester',
            description: 'Run comprehensive tests',
            dependsOn: ['implementation'],
            parallel: true,
            inputs: ['code_changes', 'tests'],
            outputs: ['test_results', 'coverage_report'],
          },
        ],
        gates: [
          {
            id: 'code-review-gate',
            trigger: 'stage:implementation:completed',
            required: true,
            approvers: ['lead@company.com'],
            timeout: 120,
          },
        ],
        isolation: {
          mode: 'full',
          cleanupOnComplete: true,
          preserveOnFailure: false,
        },
      };

      const result = WorkflowDefinitionSchema.safeParse(completeWorkflow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('comprehensive-workflow');
        expect(result.data.description).toBe('Full-featured workflow with all options');
        expect(result.data.trigger).toEqual(['pr:opened', 'issue:labeled:enhancement']);
        expect(result.data.stages).toHaveLength(3);
        expect(result.data.gates).toHaveLength(1);
        expect(result.data.isolation).toBeDefined();
        expect(result.data.isolation?.mode).toBe('full');
      }
    });

    it('should accept workflow with various trigger events', () => {
      const triggerEvents = [
        ['pr:opened'],
        ['issue:created', 'issue:labeled:bug'],
        ['push:main', 'schedule:daily'],
        ['webhook:deployment', 'manual:trigger'],
        ['release:created'],
      ];

      triggerEvents.forEach(trigger => {
        const workflow = {
          name: 'trigger-test',
          description: 'Test trigger events',
          trigger,
          stages: [{ name: 'test', agent: 'test' }],
        };

        const result = WorkflowDefinitionSchema.safeParse(workflow);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.trigger).toEqual(trigger);
        }
      });
    });

    it('should accept workflow with complex stage dependencies', () => {
      const workflowWithDependencies = {
        name: 'dependency-workflow',
        description: 'Workflow with complex dependencies',
        stages: [
          { name: 'init', agent: 'initializer' },
          { name: 'lint', agent: 'linter', dependsOn: ['init'] },
          { name: 'test', agent: 'tester', dependsOn: ['init'] },
          { name: 'build', agent: 'builder', dependsOn: ['lint', 'test'] },
          { name: 'deploy', agent: 'deployer', dependsOn: ['build'] },
        ],
      };

      const result = WorkflowDefinitionSchema.safeParse(workflowWithDependencies);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stages[3].dependsOn).toEqual(['lint', 'test']);
      }
    });

    it('should accept workflow with multiple gates', () => {
      const workflowWithMultipleGates = {
        name: 'multi-gate-workflow',
        description: 'Workflow with multiple approval gates',
        stages: [
          { name: 'development', agent: 'developer', gate: 'code-gate' },
          { name: 'testing', agent: 'tester', gate: 'qa-gate' },
          { name: 'deployment', agent: 'deployer', gate: 'release-gate' },
        ],
        gates: [
          {
            id: 'code-gate',
            trigger: 'stage:development:completed',
            required: true,
            approvers: ['tech-lead@company.com'],
          },
          {
            id: 'qa-gate',
            trigger: 'stage:testing:completed',
            required: true,
            approvers: ['qa-lead@company.com'],
          },
          {
            id: 'release-gate',
            trigger: 'stage:deployment:ready',
            required: false,
            approvers: ['product-owner@company.com'],
            timeout: 240,
          },
        ],
      };

      const result = WorkflowDefinitionSchema.safeParse(workflowWithMultipleGates);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gates).toHaveLength(3);
        expect(result.data.gates?.map(g => g.id)).toEqual(['code-gate', 'qa-gate', 'release-gate']);
      }
    });

    it('should accept workflow with isolation configuration', () => {
      const workflowWithIsolation = {
        name: 'isolated-workflow',
        description: 'Workflow with custom isolation',
        stages: [{ name: 'build', agent: 'builder' }],
        isolation: {
          mode: 'full',
          container: {
            image: 'node:18-alpine',
            workDir: '/workspace',
          },
          cleanupOnComplete: false,
          preserveOnFailure: true,
        },
      };

      const result = WorkflowDefinitionSchema.safeParse(workflowWithIsolation);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isolation?.mode).toBe('full');
        expect(result.data.isolation?.cleanupOnComplete).toBe(false);
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject workflow without required name', () => {
      const invalidWorkflow = {
        description: 'Missing name',
        stages: [{ name: 'test', agent: 'test' }],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow without required description', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        stages: [{ name: 'test', agent: 'test' }],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow without required stages', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: 'Missing stages',
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow with empty name', () => {
      const invalidWorkflow = {
        name: '',
        description: 'Empty name',
        stages: [{ name: 'test', agent: 'test' }],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow with empty description', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: '',
        stages: [{ name: 'test', agent: 'test' }],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow with empty stages array', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: 'Empty stages',
        stages: [],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow with invalid field types', () => {
      const invalidWorkflows = [
        {
          name: 123,
          description: 'Invalid name type',
          stages: [{ name: 'test', agent: 'test' }],
        },
        {
          name: 'test',
          description: 456,
          stages: [{ name: 'test', agent: 'test' }],
        },
        {
          name: 'test',
          description: 'test',
          trigger: 'single-trigger', // should be array
          stages: [{ name: 'test', agent: 'test' }],
        },
        {
          name: 'test',
          description: 'test',
          stages: 'invalid-stages', // should be array
        },
      ];

      invalidWorkflows.forEach(workflow => {
        const result = WorkflowDefinitionSchema.safeParse(workflow);
        expect(result.success).toBe(false);
      });
    });

    it('should reject workflow with invalid stage definitions', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: 'Invalid stages',
        stages: [
          { name: 'valid', agent: 'test' },
          { name: '', agent: 'test' }, // invalid stage with empty name
        ],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow with invalid gate definitions', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: 'Invalid gates',
        stages: [{ name: 'test', agent: 'test' }],
        gates: [
          { id: 'valid-gate', trigger: 'test' },
          { id: '', trigger: 'test' }, // invalid gate with empty id
        ],
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject workflow with invalid isolation config', () => {
      const invalidWorkflow = {
        name: 'test-workflow',
        description: 'Invalid isolation',
        stages: [{ name: 'test', agent: 'test' }],
        isolation: {
          mode: 'invalid-mode', // should be 'none' | 'process' | 'full'
        },
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should reject null and undefined values', () => {
      expect(WorkflowDefinitionSchema.safeParse(null).success).toBe(false);
      expect(WorkflowDefinitionSchema.safeParse(undefined).success).toBe(false);
    });
  });

  describe('edge cases and validation rules', () => {
    it('should validate stage gate references exist in gates array', () => {
      const workflowWithMismatchedGates = {
        name: 'mismatched-gates',
        description: 'Stage references non-existent gate',
        stages: [
          {
            name: 'test',
            agent: 'test',
            gate: 'non-existent-gate', // This gate ID doesn't exist in gates array
          },
        ],
        gates: [
          {
            id: 'existing-gate',
            trigger: 'test',
          },
        ],
      };

      // Note: This test demonstrates that the schema validates structure
      // but doesn't enforce referential integrity (that would be business logic)
      const result = WorkflowDefinitionSchema.safeParse(workflowWithMismatchedGates);
      expect(result.success).toBe(true); // Schema validation passes
      // Referential integrity would need to be validated separately
    });

    it('should handle workflows with only optional fields undefined', () => {
      const workflowMinimalOptional = {
        name: 'minimal-optional',
        description: 'Only required fields',
        stages: [{ name: 'single-stage', agent: 'single-agent' }],
        trigger: undefined,
        gates: undefined,
        isolation: undefined,
      };

      const result = WorkflowDefinitionSchema.safeParse(workflowMinimalOptional);
      expect(result.success).toBe(true);
    });

    it('should accept very complex workflow configurations', () => {
      const complexWorkflow: WorkflowDefinition = {
        name: 'enterprise-deployment-workflow',
        description: 'Complex enterprise-grade deployment workflow with multiple environments and approval gates',
        trigger: [
          'pr:merged:main',
          'schedule:weekly',
          'webhook:security-scan-complete',
          'manual:emergency-hotfix',
        ],
        stages: [
          {
            name: 'security-scan',
            agent: 'security-scanner',
            description: 'Run security vulnerability scans',
            parallel: false,
            inputs: ['source_code', 'dependencies'],
            outputs: ['security_report', 'vulnerability_count'],
            condition: 'always',
            actions: ['sast_scan', 'dependency_check', 'container_scan'],
            maxRetries: 1,
          },
          {
            name: 'unit-testing',
            agent: 'test-runner',
            description: 'Execute comprehensive unit test suite',
            parallel: true,
            inputs: ['source_code', 'test_config'],
            outputs: ['test_results', 'coverage_report'],
            maxRetries: 2,
          },
          {
            name: 'integration-testing',
            agent: 'integration-tester',
            description: 'Run integration tests against staging environment',
            dependsOn: ['unit-testing'],
            parallel: true,
            inputs: ['test_results', 'staging_config'],
            outputs: ['integration_results', 'performance_metrics'],
            gate: 'qa-approval-gate',
            maxRetries: 3,
          },
          {
            name: 'staging-deployment',
            agent: 'deployment-manager',
            description: 'Deploy to staging environment',
            dependsOn: ['security-scan', 'integration-testing'],
            inputs: ['security_report', 'integration_results'],
            outputs: ['staging_url', 'deployment_logs'],
            condition: 'on_success',
            gate: 'staging-gate',
          },
          {
            name: 'production-deployment',
            agent: 'production-deployer',
            description: 'Deploy to production with blue-green strategy',
            dependsOn: ['staging-deployment'],
            inputs: ['staging_url', 'deployment_logs'],
            outputs: ['production_url', 'rollback_plan'],
            gate: 'production-gate',
            maxRetries: 0,
          },
        ],
        gates: [
          {
            id: 'qa-approval-gate',
            name: 'QA Team Approval',
            description: 'QA team must approve integration test results',
            trigger: 'stage:integration-testing:completed',
            required: true,
            approvers: ['qa-lead@company.com', 'qa-senior@company.com'],
            conditions: {
              test_success_rate: 95,
              performance_threshold: 'acceptable',
            },
            timeout: 480, // 8 hours
            tags: ['quality-gate', 'approval-required'],
          },
          {
            id: 'staging-gate',
            name: 'Staging Environment Gate',
            description: 'Automated checks for staging readiness',
            trigger: 'stage:staging-deployment:ready',
            required: false,
            conditions: {
              environment_health: 'green',
              dependencies_available: true,
            },
            timeout: 60,
            tags: ['automated', 'environment-check'],
          },
          {
            id: 'production-gate',
            name: 'Production Release Gate',
            description: 'Final approval for production deployment',
            trigger: 'stage:production-deployment:ready',
            required: true,
            approvers: [
              'release-manager@company.com',
              'tech-lead@company.com',
              'product-owner@company.com',
            ],
            conditions: {
              staging_validation: 'passed',
              business_hours: true,
              maintenance_window: 'open',
            },
            timeout: 720, // 12 hours
            tags: ['production', 'critical-approval', 'business-hours-only'],
          },
        ],
        isolation: {
          mode: 'full',
          container: {
            image: 'enterprise/deployment:latest',
            workDir: '/workspace',
            env: {
              NODE_ENV: 'production',
              DEPLOYMENT_ENV: 'enterprise',
              LOG_LEVEL: 'info',
            },
            volumes: ['/var/run/docker.sock:/var/run/docker.sock'],
            ports: ['3000:3000', '9090:9090'],
            network: 'enterprise-network',
            resources: {
              cpu: 4,
              memory: '8g',
            },
          },
          cleanupOnComplete: true,
          preserveOnFailure: true,
        },
      };

      const result = WorkflowDefinitionSchema.safeParse(complexWorkflow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stages).toHaveLength(5);
        expect(result.data.gates).toHaveLength(3);
        expect(result.data.trigger).toHaveLength(4);
        expect(result.data.isolation?.mode).toBe('full');
      }
    });
  });
});

// ============================================================================
// IsolationConfigSchema Tests
// ============================================================================

describe('IsolationConfigSchema', () => {
  describe('valid inputs', () => {
    it('should accept minimal isolation config', () => {
      const minimalConfig = {
        mode: 'none',
      };

      const result = IsolationConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('none');
        expect(result.data.cleanupOnComplete).toBe(true); // default
        expect(result.data.preserveOnFailure).toBe(false); // default
      }
    });

    it('should accept complete isolation config', () => {
      const completeConfig: IsolationConfig = {
        mode: 'full',
        container: {
          image: 'node:18-alpine',
          workDir: '/workspace',
          env: { NODE_ENV: 'development' },
          volumes: ['/host/path:/container/path'],
          ports: ['3000:3000'],
          network: 'bridge',
          resources: {
            cpu: 2,
            memory: '1g',
          },
        },
        cleanupOnComplete: false,
        preserveOnFailure: true,
      };

      const result = IsolationConfigSchema.safeParse(completeConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('full');
        expect(result.data.cleanupOnComplete).toBe(false);
        expect(result.data.preserveOnFailure).toBe(true);
        expect(result.data.container).toBeDefined();
      }
    });

    it('should accept different isolation modes', () => {
      const modes = ['none', 'process', 'full'];

      modes.forEach(mode => {
        const config = { mode };
        const result = IsolationConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should handle cleanup flags correctly', () => {
      const configs = [
        { mode: 'none', cleanupOnComplete: true, preserveOnFailure: false },
        { mode: 'none', cleanupOnComplete: false, preserveOnFailure: true },
        { mode: 'none', cleanupOnComplete: true, preserveOnFailure: true },
        { mode: 'none', cleanupOnComplete: false, preserveOnFailure: false },
      ];

      configs.forEach(config => {
        const result = IsolationConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should accept isolation config without container for non-full modes', () => {
      const configWithoutContainer = {
        mode: 'process',
        cleanupOnComplete: true,
      };

      const result = IsolationConfigSchema.safeParse(configWithoutContainer);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should reject config without required mode', () => {
      const invalidConfig = {
        cleanupOnComplete: true,
      };

      const result = IsolationConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config with invalid mode', () => {
      const invalidConfig = {
        mode: 'invalid-mode',
      };

      const result = IsolationConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject config with invalid field types', () => {
      const invalidConfigs = [
        { mode: 123 }, // mode must be string
        { mode: 'none', cleanupOnComplete: 'true' }, // cleanupOnComplete must be boolean
        { mode: 'none', preserveOnFailure: 'false' }, // preserveOnFailure must be boolean
      ];

      invalidConfigs.forEach(config => {
        const result = IsolationConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      });
    });

    it('should reject null and undefined values', () => {
      expect(IsolationConfigSchema.safeParse(null).success).toBe(false);
      expect(IsolationConfigSchema.safeParse(undefined).success).toBe(false);
    });
  });

  describe('default values', () => {
    it('should apply default values for cleanup flags', () => {
      const config = {
        mode: 'process',
      };

      const result = IsolationConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cleanupOnComplete).toBe(true);
        expect(result.data.preserveOnFailure).toBe(false);
      }
    });

    it('should not override explicitly set cleanup flags', () => {
      const config = {
        mode: 'process',
        cleanupOnComplete: false,
        preserveOnFailure: true,
      };

      const result = IsolationConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cleanupOnComplete).toBe(false);
        expect(result.data.preserveOnFailure).toBe(true);
      }
    });
  });
});

// ============================================================================
// StageResult Interface Tests
// ============================================================================

describe('StageResult interface validation', () => {
  describe('valid stage result data', () => {
    it('should validate minimal stage result', () => {
      const minimalResult: StageResult = {
        stageName: 'implementation',
        agent: 'developer',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: '',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
        },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      // TypeScript compilation is the validation for interfaces
      expect(minimalResult.stageName).toBe('implementation');
      expect(minimalResult.agent).toBe('developer');
      expect(minimalResult.status).toBe('completed');
    });

    it('should validate complete stage result with all fields', () => {
      const completeResult: StageResult = {
        stageName: 'testing',
        agent: 'tester',
        status: 'completed',
        outputs: {
          test_results: 'all_passed',
          coverage_report: 95,
          branch_name: 'feature/new-tests',
        },
        artifacts: [
          'tests/unit.test.ts',
          'tests/integration.test.ts',
          'coverage/lcov.info',
        ],
        summary: 'All tests passed with 95% coverage',
        usage: {
          inputTokens: 2500,
          outputTokens: 1200,
          totalCost: 0.045,
        },
        startedAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-01T10:30:00Z'),
        autoFixResults: {
          applied: true,
          filesProcessed: ['src/api.ts', 'tests/api.test.ts'],
          filesModified: ['src/api.ts'],
          totalImportsAdded: 2,
          totalDuration: 1500,
        },
      };

      expect(completeResult.outputs.test_results).toBe('all_passed');
      expect(completeResult.artifacts).toHaveLength(3);
      expect(completeResult.autoFixResults?.applied).toBe(true);
    });

    it('should validate different status values', () => {
      const statuses: Array<StageResult['status']> = ['completed', 'failed', 'skipped'];

      statuses.forEach(status => {
        const result: StageResult = {
          stageName: 'test',
          agent: 'test',
          status,
          outputs: {},
          artifacts: [],
          summary: '',
          usage: { inputTokens: 0, outputTokens: 0, totalCost: 0 },
          startedAt: new Date(),
          completedAt: new Date(),
        };

        expect(result.status).toBe(status);
      });
    });

    it('should validate complex outputs object', () => {
      const result: StageResult = {
        stageName: 'complex-stage',
        agent: 'complex-agent',
        status: 'completed',
        outputs: {
          stringOutput: 'test-value',
          numberOutput: 42,
          booleanOutput: true,
          arrayOutput: ['item1', 'item2'],
          objectOutput: {
            nested: {
              value: 'deep',
            },
          },
        },
        artifacts: [],
        summary: 'Complex outputs test',
        usage: { inputTokens: 100, outputTokens: 50, totalCost: 0.01 },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      expect(result.outputs.stringOutput).toBe('test-value');
      expect(result.outputs.numberOutput).toBe(42);
      expect(result.outputs.booleanOutput).toBe(true);
      expect(Array.isArray(result.outputs.arrayOutput)).toBe(true);
      expect(typeof result.outputs.objectOutput).toBe('object');
    });

    it('should validate usage tracking data', () => {
      const result: StageResult = {
        stageName: 'usage-tracking',
        agent: 'tracking-agent',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: 'Usage tracking validation',
        usage: {
          inputTokens: 1500,
          outputTokens: 800,
          totalCost: 0.035,
        },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      expect(result.usage.inputTokens).toBe(1500);
      expect(result.usage.outputTokens).toBe(800);
      expect(result.usage.totalCost).toBe(0.035);
    });

    it('should validate auto-fix results when present', () => {
      const result: StageResult = {
        stageName: 'auto-fix-stage',
        agent: 'auto-fix-agent',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: 'Auto-fix applied successfully',
        usage: { inputTokens: 500, outputTokens: 300, totalCost: 0.015 },
        startedAt: new Date(),
        completedAt: new Date(),
        autoFixResults: {
          applied: true,
          filesProcessed: ['src/utils.ts', 'src/helpers.ts'],
          filesModified: ['src/utils.ts'],
          totalImportsAdded: 3,
          totalDuration: 2000,
        },
      };

      expect(result.autoFixResults?.applied).toBe(true);
      expect(result.autoFixResults?.filesProcessed).toEqual(['src/utils.ts', 'src/helpers.ts']);
      expect(result.autoFixResults?.filesModified).toEqual(['src/utils.ts']);
      expect(result.autoFixResults?.totalImportsAdded).toBe(3);
      expect(result.autoFixResults?.totalDuration).toBe(2000);
    });
  });

  describe('edge cases and data integrity', () => {
    it('should handle empty artifacts array', () => {
      const result: StageResult = {
        stageName: 'no-artifacts',
        agent: 'test-agent',
        status: 'completed',
        outputs: { result: 'success' },
        artifacts: [], // empty array
        summary: 'No artifacts generated',
        usage: { inputTokens: 100, outputTokens: 50, totalCost: 0.01 },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      expect(result.artifacts).toEqual([]);
      expect(Array.isArray(result.artifacts)).toBe(true);
    });

    it('should handle empty outputs object', () => {
      const result: StageResult = {
        stageName: 'no-outputs',
        agent: 'test-agent',
        status: 'failed',
        outputs: {}, // empty object
        artifacts: [],
        summary: 'Stage failed with no outputs',
        usage: { inputTokens: 200, outputTokens: 0, totalCost: 0.005 },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      expect(result.outputs).toEqual({});
      expect(Object.keys(result.outputs)).toHaveLength(0);
    });

    it('should handle date ordering correctly', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');

      const result: StageResult = {
        stageName: 'timed-stage',
        agent: 'timing-agent',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: 'Timing validation',
        usage: { inputTokens: 300, outputTokens: 150, totalCost: 0.012 },
        startedAt: startTime,
        completedAt: endTime,
      };

      expect(result.startedAt.getTime()).toBeLessThan(result.completedAt.getTime());
      expect(result.completedAt.getTime() - result.startedAt.getTime()).toBe(30 * 60 * 1000); // 30 minutes
    });

    it('should handle zero usage values', () => {
      const result: StageResult = {
        stageName: 'zero-usage',
        agent: 'zero-agent',
        status: 'skipped',
        outputs: {},
        artifacts: [],
        summary: 'Stage was skipped',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
        },
        startedAt: new Date(),
        completedAt: new Date(),
      };

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
      expect(result.usage.totalCost).toBe(0);
    });
  });
});

// ============================================================================
// Integration Tests for Workflow Schemas
// ============================================================================

describe('Workflow Schema Integration', () => {
  it('should validate complete workflow with all schema integrations', () => {
    // Test a complete workflow that integrates all schemas
    const completeWorkflow: WorkflowDefinition = {
      name: 'integrated-workflow',
      description: 'Complete workflow integrating all schema types',
      trigger: ['pr:opened'],
      stages: [
        {
          name: 'planning',
          agent: 'planner',
          outputs: ['plan_document'],
        },
        {
          name: 'implementation',
          agent: 'developer',
          dependsOn: ['planning'],
          inputs: ['plan_document'],
          outputs: ['code_changes'],
          gate: 'review-gate',
        },
        {
          name: 'testing',
          agent: 'tester',
          dependsOn: ['implementation'],
          inputs: ['code_changes'],
          outputs: ['test_results'],
          parallel: true,
        },
      ],
      gates: [
        {
          id: 'review-gate',
          trigger: 'stage:implementation:completed',
          required: true,
          approvers: ['reviewer@company.com'],
        },
      ],
      isolation: {
        mode: 'process',
        cleanupOnComplete: true,
      },
    };

    // Validate the complete workflow
    const workflowResult = WorkflowDefinitionSchema.safeParse(completeWorkflow);
    expect(workflowResult.success).toBe(true);

    if (workflowResult.success) {
      // Validate individual components
      const stages = workflowResult.data.stages;
      const gates = workflowResult.data.gates;
      const isolation = workflowResult.data.isolation;

      // Test each stage schema validation
      stages.forEach(stage => {
        expect(WorkflowStageSchema.safeParse(stage).success).toBe(true);
      });

      // Test each gate schema validation
      gates?.forEach(gate => {
        expect(WorkflowGateSchema.safeParse(gate).success).toBe(true);
      });

      // Test isolation config validation
      if (isolation) {
        expect(IsolationConfigSchema.safeParse(isolation).success).toBe(true);
      }

      // Verify referential integrity concepts (schema structure)
      expect(stages[1].gate).toBe(gates?.[0]?.id);
      expect(stages[1].dependsOn).toEqual(['planning']);
      expect(stages[2].dependsOn).toEqual(['implementation']);
    }
  });

  it('should validate workflow stage with gate reference', () => {
    const gate: WorkflowGate = {
      id: 'review-gate',
      trigger: 'stage:implementation:completed',
      required: true,
    };

    const stage: WorkflowStage = {
      name: 'implementation',
      agent: 'developer',
      gate: gate.id,
    };

    expect(WorkflowGateSchema.safeParse(gate).success).toBe(true);
    expect(WorkflowStageSchema.safeParse(stage).success).toBe(true);
    expect(stage.gate).toBe(gate.id);
  });

  it('should validate stage dependency chains', () => {
    const stages: WorkflowStage[] = [
      {
        name: 'planning',
        agent: 'planner',
      },
      {
        name: 'architecture',
        agent: 'architect',
        dependsOn: ['planning'],
      },
      {
        name: 'implementation',
        agent: 'developer',
        dependsOn: ['architecture'],
      },
      {
        name: 'testing',
        agent: 'tester',
        dependsOn: ['implementation'],
        parallel: true,
      },
    ];

    stages.forEach(stage => {
      expect(WorkflowStageSchema.safeParse(stage).success).toBe(true);
    });

    // Verify dependency chain integrity
    expect(stages[1].dependsOn).toEqual(['planning']);
    expect(stages[2].dependsOn).toEqual(['architecture']);
    expect(stages[3].dependsOn).toEqual(['implementation']);
  });

  it('should validate isolation config with workflow stage', () => {
    const isolationConfig: IsolationConfig = {
      mode: 'full',
      cleanupOnComplete: true,
      preserveOnFailure: false,
    };

    const stage: WorkflowStage = {
      name: 'isolated-build',
      agent: 'builder',
      description: 'Build in isolated environment',
    };

    expect(IsolationConfigSchema.safeParse(isolationConfig).success).toBe(true);
    expect(WorkflowStageSchema.safeParse(stage).success).toBe(true);
  });

  it('should validate complete workflow execution result', () => {
    const stageResult: StageResult = {
      stageName: 'comprehensive-test',
      agent: 'test-runner',
      status: 'completed',
      outputs: {
        test_files: ['unit.test.ts', 'integration.test.ts'],
        coverage_report: { lines: 95, branches: 88, functions: 92 },
        passed_tests: 147,
        failed_tests: 0,
      },
      artifacts: [
        'coverage/lcov.info',
        'test-results.xml',
        'performance-metrics.json',
      ],
      summary: 'All 147 tests passed with excellent coverage metrics',
      usage: {
        inputTokens: 3500,
        outputTokens: 1800,
        totalCost: 0.078,
      },
      startedAt: new Date('2024-01-01T14:00:00Z'),
      completedAt: new Date('2024-01-01T14:25:00Z'),
      autoFixResults: {
        applied: true,
        filesProcessed: ['src/main.ts', 'src/utils.ts', 'tests/helpers.ts'],
        filesModified: ['src/main.ts', 'src/utils.ts'],
        totalImportsAdded: 5,
        totalDuration: 3200,
      },
    };

    // Verify all fields are correctly structured
    expect(typeof stageResult.stageName).toBe('string');
    expect(typeof stageResult.agent).toBe('string');
    expect(['completed', 'failed', 'skipped']).toContain(stageResult.status);
    expect(typeof stageResult.outputs).toBe('object');
    expect(Array.isArray(stageResult.artifacts)).toBe(true);
    expect(typeof stageResult.summary).toBe('string');
    expect(typeof stageResult.usage.inputTokens).toBe('number');
    expect(typeof stageResult.usage.outputTokens).toBe('number');
    expect(typeof stageResult.usage.totalCost).toBe('number');
    expect(stageResult.startedAt instanceof Date).toBe(true);
    expect(stageResult.completedAt instanceof Date).toBe(true);
    expect(stageResult.autoFixResults?.applied).toBe(true);
  });
});