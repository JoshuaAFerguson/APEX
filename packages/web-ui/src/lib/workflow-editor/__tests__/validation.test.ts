import { describe, it, expect } from 'vitest';
import {
  validateWorkflow,
  validateStages,
  validateDependencies,
  validateGates,
  detectCircularDependencies,
  validateStage,
  validateGate,
} from '../validation';
import type { WorkflowDefinition, Stage, Gate } from '@/types/workflow-editor';

describe('validation', () => {
  const validWorkflow: WorkflowDefinition = {
    name: 'Valid Workflow',
    description: 'A properly structured workflow',
    stages: [
      {
        name: 'planning',
        agent: 'planner',
        description: 'Plan the implementation',
        dependencies: [],
        gates: [],
      },
      {
        name: 'development',
        agent: 'developer',
        description: 'Implement the feature',
        dependencies: ['planning'],
        gates: [
          {
            name: 'code-review',
            type: 'approval',
            approvers: ['senior-dev'],
          },
        ],
      },
    ],
    gates: [
      {
        name: 'security-review',
        type: 'manual',
        approvers: ['security-team'],
      },
    ],
  };

  describe('validateWorkflow', () => {
    it('validates a correct workflow', () => {
      const result = validateWorkflow(validWorkflow);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('detects missing workflow name', () => {
      const invalidWorkflow = {
        ...validWorkflow,
        name: '',
      };

      const result = validateWorkflow(invalidWorkflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('name'),
          type: 'error',
        })
      );
    });

    it('detects empty stages array', () => {
      const invalidWorkflow = {
        ...validWorkflow,
        stages: [],
      };

      const result = validateWorkflow(invalidWorkflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('stages'),
          type: 'error',
        })
      );
    });

    it('detects circular dependencies', () => {
      const circularWorkflow: WorkflowDefinition = {
        name: 'Circular Workflow',
        description: 'Has circular dependencies',
        stages: [
          {
            name: 'stage1',
            agent: 'agent1',
            description: 'First stage',
            dependencies: ['stage3'],
            gates: [],
          },
          {
            name: 'stage2',
            agent: 'agent2',
            description: 'Second stage',
            dependencies: ['stage1'],
            gates: [],
          },
          {
            name: 'stage3',
            agent: 'agent3',
            description: 'Third stage',
            dependencies: ['stage2'],
            gates: [],
          },
        ],
        gates: [],
      };

      const result = validateWorkflow(circularWorkflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('circular'),
          type: 'error',
        })
      );
    });

    it('warns about long workflow chains', () => {
      const longChainWorkflow: WorkflowDefinition = {
        name: 'Long Chain Workflow',
        description: 'Has very long dependency chain',
        stages: Array.from({ length: 20 }, (_, i) => ({
          name: `stage${i}`,
          agent: 'agent',
          description: `Stage ${i}`,
          dependencies: i > 0 ? [`stage${i - 1}`] : [],
          gates: [],
        })),
        gates: [],
      };

      const result = validateWorkflow(longChainWorkflow);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain(
        expect.objectContaining({
          message: expect.stringContaining('dependency chain'),
          type: 'warning',
        })
      );
    });

    it('validates workflow size limits', () => {
      const oversizedWorkflow: WorkflowDefinition = {
        name: 'Oversized Workflow',
        description: 'Too many stages',
        stages: Array.from({ length: 101 }, (_, i) => ({
          name: `stage${i}`,
          agent: 'agent',
          description: `Stage ${i}`,
          dependencies: [],
          gates: [],
        })),
        gates: [],
      };

      const result = validateWorkflow(oversizedWorkflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('too many stages'),
          type: 'error',
        })
      );
    });
  });

  describe('validateStages', () => {
    it('validates correct stages array', () => {
      const result = validateStages(validWorkflow.stages);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects duplicate stage names', () => {
      const duplicateStages = [
        {
          name: 'duplicate',
          agent: 'agent1',
          description: 'First duplicate',
          dependencies: [],
          gates: [],
        },
        {
          name: 'duplicate',
          agent: 'agent2',
          description: 'Second duplicate',
          dependencies: [],
          gates: [],
        },
      ];

      const result = validateStages(duplicateStages);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('duplicate'),
          type: 'error',
        })
      );
    });

    it('detects invalid stage names', () => {
      const invalidStages = [
        {
          name: 'invalid name with spaces',
          agent: 'agent',
          description: 'Invalid stage name',
          dependencies: [],
          gates: [],
        },
        {
          name: 'invalid@name',
          agent: 'agent',
          description: 'Invalid stage name',
          dependencies: [],
          gates: [],
        },
      ];

      const result = validateStages(invalidStages);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates stage descriptions', () => {
      const stagesWithoutDescription = [
        {
          name: 'stage1',
          agent: 'agent',
          description: '',
          dependencies: [],
          gates: [],
        },
      ];

      const result = validateStages(stagesWithoutDescription);

      expect(result.warnings).toContain(
        expect.objectContaining({
          message: expect.stringContaining('description'),
          type: 'warning',
        })
      );
    });
  });

  describe('validateDependencies', () => {
    it('validates correct dependencies', () => {
      const result = validateDependencies(validWorkflow.stages);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects missing dependency references', () => {
      const stagesWithMissingDeps = [
        {
          name: 'stage1',
          agent: 'agent',
          description: 'Stage with missing dependency',
          dependencies: ['nonexistent-stage'],
          gates: [],
        },
      ];

      const result = validateDependencies(stagesWithMissingDeps);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('nonexistent-stage'),
          type: 'error',
        })
      );
    });

    it('detects self-referential dependencies', () => {
      const selfRefStages = [
        {
          name: 'stage1',
          agent: 'agent',
          description: 'Self-referential stage',
          dependencies: ['stage1'],
          gates: [],
        },
      ];

      const result = validateDependencies(selfRefStages);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('itself'),
          type: 'error',
        })
      );
    });
  });

  describe('validateGates', () => {
    it('validates correct gates', () => {
      const result = validateGates(validWorkflow.gates, validWorkflow.stages);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects invalid gate types', () => {
      const invalidGates = [
        {
          name: 'invalid-gate',
          type: 'invalid-type' as any,
          approvers: [],
        },
      ];

      const result = validateGates(invalidGates, []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('type'),
          type: 'error',
        })
      );
    });

    it('detects gates without approvers', () => {
      const gatesWithoutApprovers = [
        {
          name: 'gate-without-approvers',
          type: 'approval' as const,
          approvers: [],
        },
      ];

      const result = validateGates(gatesWithoutApprovers, []);

      expect(result.warnings).toContain(
        expect.objectContaining({
          message: expect.stringContaining('approvers'),
          type: 'warning',
        })
      );
    });

    it('validates gate names uniqueness', () => {
      const duplicateGates = [
        {
          name: 'duplicate-gate',
          type: 'manual' as const,
          approvers: ['approver1'],
        },
        {
          name: 'duplicate-gate',
          type: 'approval' as const,
          approvers: ['approver2'],
        },
      ];

      const result = validateGates(duplicateGates, []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('duplicate'),
          type: 'error',
        })
      );
    });
  });

  describe('detectCircularDependencies', () => {
    it('detects simple circular dependency', () => {
      const circularStages: Stage[] = [
        {
          name: 'stage1',
          agent: 'agent',
          description: 'Stage 1',
          dependencies: ['stage2'],
          gates: [],
        },
        {
          name: 'stage2',
          agent: 'agent',
          description: 'Stage 2',
          dependencies: ['stage1'],
          gates: [],
        },
      ];

      const result = detectCircularDependencies(circularStages);

      expect(result).toBe(true);
    });

    it('detects complex circular dependency', () => {
      const circularStages: Stage[] = [
        {
          name: 'stage1',
          agent: 'agent',
          description: 'Stage 1',
          dependencies: ['stage3'],
          gates: [],
        },
        {
          name: 'stage2',
          agent: 'agent',
          description: 'Stage 2',
          dependencies: ['stage1'],
          gates: [],
        },
        {
          name: 'stage3',
          agent: 'agent',
          description: 'Stage 3',
          dependencies: ['stage2'],
          gates: [],
        },
      ];

      const result = detectCircularDependencies(circularStages);

      expect(result).toBe(true);
    });

    it('handles valid dependency chains', () => {
      const validStages: Stage[] = [
        {
          name: 'stage1',
          agent: 'agent',
          description: 'Stage 1',
          dependencies: [],
          gates: [],
        },
        {
          name: 'stage2',
          agent: 'agent',
          description: 'Stage 2',
          dependencies: ['stage1'],
          gates: [],
        },
        {
          name: 'stage3',
          agent: 'agent',
          description: 'Stage 3',
          dependencies: ['stage2'],
          gates: [],
        },
      ];

      const result = detectCircularDependencies(validStages);

      expect(result).toBe(false);
    });

    it('handles empty stages array', () => {
      const result = detectCircularDependencies([]);

      expect(result).toBe(false);
    });
  });

  describe('validateStage', () => {
    it('validates correct stage', () => {
      const validStage: Stage = {
        name: 'valid-stage',
        agent: 'planner',
        description: 'A valid stage',
        dependencies: [],
        gates: [],
      };

      const result = validateStage(validStage);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects missing required fields', () => {
      const invalidStage = {
        name: '',
        agent: '',
        description: '',
        dependencies: [],
        gates: [],
      } as Stage;

      const result = validateStage(invalidStage);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates stage name format', () => {
      const stageWithInvalidName = {
        name: 'Invalid Stage Name',
        agent: 'agent',
        description: 'Stage with spaces in name',
        dependencies: [],
        gates: [],
      } as Stage;

      const result = validateStage(stageWithInvalidName);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('name'),
        })
      );
    });

    it('validates agent field', () => {
      const stageWithInvalidAgent = {
        name: 'valid-stage',
        agent: 'invalid-agent-type',
        description: 'Stage with invalid agent',
        dependencies: [],
        gates: [],
      } as Stage;

      const result = validateStage(stageWithInvalidAgent);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateGate', () => {
    it('validates correct gate', () => {
      const validGate: Gate = {
        name: 'valid-gate',
        type: 'approval',
        approvers: ['approver1', 'approver2'],
      };

      const result = validateGate(validGate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects missing gate name', () => {
      const invalidGate = {
        name: '',
        type: 'approval' as const,
        approvers: ['approver'],
      };

      const result = validateGate(invalidGate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('name'),
        })
      );
    });

    it('validates gate type', () => {
      const gateWithInvalidType = {
        name: 'gate',
        type: 'invalid' as any,
        approvers: [],
      };

      const result = validateGate(gateWithInvalidType);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          message: expect.stringContaining('type'),
        })
      );
    });

    it('warns about empty approvers for approval gates', () => {
      const approvalGateWithoutApprovers = {
        name: 'approval-gate',
        type: 'approval' as const,
        approvers: [],
      };

      const result = validateGate(approvalGateWithoutApprovers);

      expect(result.warnings).toContain(
        expect.objectContaining({
          message: expect.stringContaining('approvers'),
        })
      );
    });

    it('allows empty approvers for manual gates', () => {
      const manualGateWithoutApprovers = {
        name: 'manual-gate',
        type: 'manual' as const,
        approvers: [],
      };

      const result = validateGate(manualGateWithoutApprovers);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('handles null/undefined inputs gracefully', () => {
      expect(() => validateWorkflow(null as any)).not.toThrow();
      expect(() => validateStages(undefined as any)).not.toThrow();
      expect(() => validateGates(null as any, [])).not.toThrow();
    });

    it('handles very large workflows', () => {
      const largeWorkflow: WorkflowDefinition = {
        name: 'Large Workflow',
        description: 'A very large workflow',
        stages: Array.from({ length: 50 }, (_, i) => ({
          name: `stage${i}`,
          agent: 'agent',
          description: `Stage ${i}`,
          dependencies: i > 0 ? [`stage${i - 1}`] : [],
          gates: [],
        })),
        gates: [],
      };

      const result = validateWorkflow(largeWorkflow);

      // Should complete without performance issues
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
    });

    it('handles workflows with complex dependency graphs', () => {
      const complexWorkflow: WorkflowDefinition = {
        name: 'Complex Dependency Workflow',
        description: 'Complex dependencies',
        stages: [
          { name: 'stage1', agent: 'agent', description: 'Stage 1', dependencies: [], gates: [] },
          { name: 'stage2', agent: 'agent', description: 'Stage 2', dependencies: ['stage1'], gates: [] },
          { name: 'stage3', agent: 'agent', description: 'Stage 3', dependencies: ['stage1'], gates: [] },
          { name: 'stage4', agent: 'agent', description: 'Stage 4', dependencies: ['stage2', 'stage3'], gates: [] },
          { name: 'stage5', agent: 'agent', description: 'Stage 5', dependencies: ['stage4'], gates: [] },
        ],
        gates: [],
      };

      const result = validateWorkflow(complexWorkflow);

      expect(result.isValid).toBe(true);
    });
  });
});