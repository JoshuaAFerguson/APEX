/**
 * Acceptance Criteria Test for Autonomy Control Types
 *
 * This test validates the specific acceptance criteria:
 * "AutonomyLevel enum (full-auto, review-before-commit, review-all) defined.
 *  ApprovalGate schema with checkpoint types (before-commit, before-deploy, before-destructive, custom).
 *  ResourceLimits schema with budget, token, time, and change limits.
 *  All schemas exported from core package.
 *  TypeScript compiles without errors."
 */
import { describe, it, expect } from 'vitest';
import {
  // Autonomy Level Types
  AutonomyLevelSchema,
  AutonomyLevel,

  // Approval Gate Types
  ApprovalCheckpointTypeSchema,
  ApprovalCheckpointType,
  ApprovalGateSchema,
  ApprovalGate,

  // Resource Limits Types
  TaskResourceLimitsSchema,
  TaskResourceLimits,
  ResourceLimitsSchema,
  ResourceLimits,

  // Config Types
  AutonomyConfigSchema,
  AutonomyConfig,
} from '../types';

describe('Autonomy Control Types - Acceptance Criteria Validation', () => {
  describe('AutonomyLevel enum requirement', () => {
    it('should define AutonomyLevel enum with full-auto, review-before-commit, review-all', () => {
      // Test that all required values are accepted
      const requiredLevels: AutonomyLevel[] = [
        'full-auto',
        'review-before-commit',
        'review-all'
      ];

      requiredLevels.forEach(level => {
        expect(AutonomyLevelSchema.parse(level)).toBe(level);
      });
    });

    it('should export AutonomyLevel as a TypeScript type', () => {
      // Type compilation test - if this compiles, the type is properly exported
      const autonomyLevel: AutonomyLevel = 'full-auto';
      expect(autonomyLevel).toBe('full-auto');
    });

    it('should reject values not in the enum', () => {
      const invalidLevels = ['invalid', 'manual', 'semi-auto'];

      invalidLevels.forEach(level => {
        expect(() => AutonomyLevelSchema.parse(level)).toThrow();
      });
    });
  });

  describe('ApprovalGate schema with checkpoint types requirement', () => {
    it('should define ApprovalCheckpointType with before-commit, before-deploy, before-destructive, custom', () => {
      const requiredCheckpoints: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'custom'
      ];

      requiredCheckpoints.forEach(checkpoint => {
        expect(ApprovalCheckpointTypeSchema.parse(checkpoint)).toBe(checkpoint);
      });
    });

    it('should export ApprovalGate schema with proper structure', () => {
      // Test minimal valid gate
      const minimalGate = { type: 'before-commit' as const };
      const parsed = ApprovalGateSchema.parse(minimalGate);

      expect(parsed.type).toBe('before-commit');
      expect(parsed.required).toBe(true); // default value
    });

    it('should export ApprovalGate as a TypeScript type', () => {
      // Type compilation test
      const gate: ApprovalGate = {
        type: 'before-deploy',
        name: 'Production Gate',
        required: true
      };

      expect(gate.type).toBe('before-deploy');
    });

    it('should support all checkpoint types in ApprovalGate schema', () => {
      const checkpointTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'custom'
      ];

      checkpointTypes.forEach(type => {
        const gate = { type };
        expect(() => ApprovalGateSchema.parse(gate)).not.toThrow();
      });
    });
  });

  describe('ResourceLimits schema with budget, token, time, and change limits requirement', () => {
    it('should define TaskResourceLimits with budget limits (maxCost, dailyBudget)', () => {
      const budgetLimits = {
        maxCost: 25.0,
        dailyBudget: 100.0
      };

      const parsed = TaskResourceLimitsSchema.parse(budgetLimits);
      expect(parsed.maxCost).toBe(25.0);
      expect(parsed.dailyBudget).toBe(100.0);
    });

    it('should define TaskResourceLimits with token limits', () => {
      const tokenLimits = {
        maxTokens: 100000,
        maxTurns: 50
      };

      const parsed = TaskResourceLimitsSchema.parse(tokenLimits);
      expect(parsed.maxTokens).toBe(100000);
      expect(parsed.maxTurns).toBe(50);
    });

    it('should define TaskResourceLimits with time limits', () => {
      const timeLimits = {
        maxTimeMs: 3600000 // 1 hour
      };

      const parsed = TaskResourceLimitsSchema.parse(timeLimits);
      expect(parsed.maxTimeMs).toBe(3600000);
    });

    it('should define TaskResourceLimits with change limits', () => {
      const changeLimits = {
        maxFilesCreated: 10,
        maxFilesModified: 50,
        maxFilesDeleted: 5,
        maxLinesChanged: 1000
      };

      const parsed = TaskResourceLimitsSchema.parse(changeLimits);
      expect(parsed.maxFilesCreated).toBe(10);
      expect(parsed.maxFilesModified).toBe(50);
      expect(parsed.maxFilesDeleted).toBe(5);
      expect(parsed.maxLinesChanged).toBe(1000);
    });

    it('should export TaskResourceLimits as a TypeScript type', () => {
      // Type compilation test
      const limits: TaskResourceLimits = {
        maxCost: 10.0,
        maxTokens: 50000,
        maxTimeMs: 1800000,
        maxFilesCreated: 5
      };

      expect(limits.maxCost).toBe(10.0);
    });

    it('should support container ResourceLimits for infrastructure constraints', () => {
      const containerLimits = {
        cpu: 2.0,
        memory: '1g',
        pidsLimit: 100
      };

      const parsed = ResourceLimitsSchema.parse(containerLimits);
      expect(parsed.cpu).toBe(2.0);
      expect(parsed.memory).toBe('1g');
      expect(parsed.pidsLimit).toBe(100);
    });
  });

  describe('All schemas exported from core package requirement', () => {
    it('should export AutonomyLevelSchema from core package', () => {
      expect(AutonomyLevelSchema).toBeDefined();
      expect(typeof AutonomyLevelSchema.parse).toBe('function');
    });

    it('should export ApprovalGateSchema from core package', () => {
      expect(ApprovalGateSchema).toBeDefined();
      expect(typeof ApprovalGateSchema.parse).toBe('function');
    });

    it('should export TaskResourceLimitsSchema from core package', () => {
      expect(TaskResourceLimitsSchema).toBeDefined();
      expect(typeof TaskResourceLimitsSchema.parse).toBe('function');
    });

    it('should export ResourceLimitsSchema from core package', () => {
      expect(ResourceLimitsSchema).toBeDefined();
      expect(typeof ResourceLimitsSchema.parse).toBe('function');
    });

    it('should export AutonomyConfigSchema from core package', () => {
      expect(AutonomyConfigSchema).toBeDefined();
      expect(typeof AutonomyConfigSchema.parse).toBe('function');
    });
  });

  describe('TypeScript compilation verification', () => {
    it('should compile AutonomyLevel type usage without errors', () => {
      // These should compile without TypeScript errors
      const level1: AutonomyLevel = 'full-auto';
      const level2: AutonomyLevel = 'review-before-commit';
      const level3: AutonomyLevel = 'review-all';

      expect([level1, level2, level3]).toEqual(['full-auto', 'review-before-commit', 'review-all']);
    });

    it('should compile ApprovalGate type usage without errors', () => {
      // Complex ApprovalGate should compile
      const gate: ApprovalGate = {
        type: 'custom',
        name: 'Security Review',
        description: 'Requires security team approval',
        required: true,
        trigger: 'security_impact > 0.8',
        approvers: ['security-team', 'tech-lead'],
        timeout: 60,
        autoApproveOnTimeout: false,
        minApprovals: 2,
        tags: ['security', 'mandatory']
      };

      expect(gate.type).toBe('custom');
      expect(gate.minApprovals).toBe(2);
    });

    it('should compile TaskResourceLimits type usage without errors', () => {
      // Complete resource limits should compile
      const limits: TaskResourceLimits = {
        maxCost: 50.0,
        maxTokens: 200000,
        maxTimeMs: 7200000,
        maxFilesCreated: 20,
        maxFilesModified: 100,
        maxFilesDeleted: 10,
        maxLinesChanged: 5000,
        maxTurns: 100,
        dailyBudget: 200.0,
        maxConcurrentTasks: 5
      };

      expect(limits.maxCost).toBe(50.0);
      expect(limits.maxTurns).toBe(100);
    });

    it('should compile AutonomyConfig type usage without errors', () => {
      // Full autonomy config should compile
      const config: AutonomyConfig = {
        level: 'review-before-commit',
        gates: [
          {
            type: 'before-commit',
            name: 'Code Review',
            required: true,
            minApprovals: 1
          }
        ],
        limits: {
          maxCost: 25.0,
          maxTokens: 100000
        },
        stageOverrides: {
          'planning': 'full-auto',
          'implementation': 'review-before-commit'
        },
        agentOverrides: {
          'developer': 'review-before-commit',
          'tester': 'full-auto'
        }
      };

      expect(config.level).toBe('review-before-commit');
      expect(config.gates).toHaveLength(1);
    });
  });

  describe('Integration and validation', () => {
    it('should work together in real-world autonomy configuration scenarios', () => {
      // Test complete integration of all autonomy control types
      const productionConfig: AutonomyConfig = {
        level: 'review-before-commit',
        gates: [
          {
            type: 'before-commit',
            name: 'Code Review Gate',
            description: 'Requires peer review before committing code',
            required: true,
            approvers: ['tech-lead', 'senior-dev'],
            minApprovals: 1,
            timeout: 120
          },
          {
            type: 'before-deploy',
            name: 'Production Deploy Gate',
            description: 'Requires ops approval for production deployment',
            required: true,
            approvers: ['devops-team', 'release-manager'],
            minApprovals: 1,
            timeout: 60
          },
          {
            type: 'before-destructive',
            name: 'Destructive Operations Gate',
            description: 'Requires approval for file deletion or destructive changes',
            required: true,
            approvers: ['tech-lead'],
            minApprovals: 1
          },
          {
            type: 'custom',
            name: 'High Risk Changes',
            description: 'Requires additional approval for high-risk modifications',
            required: false,
            trigger: 'risk_score > 0.8 || affects_core_infrastructure',
            approvers: ['architect', 'security-team'],
            minApprovals: 2,
            timeout: 240
          }
        ],
        limits: {
          maxCost: 100.0,
          maxTokens: 500000,
          maxTimeMs: 14400000, // 4 hours
          maxFilesCreated: 50,
          maxFilesModified: 200,
          maxFilesDeleted: 25,
          maxLinesChanged: 10000,
          maxTurns: 200,
          dailyBudget: 500.0,
          maxConcurrentTasks: 10
        },
        stageOverrides: {
          'planning': 'full-auto',
          'architecture': 'review-before-commit',
          'implementation': 'review-before-commit',
          'testing': 'full-auto',
          'deployment': 'review-all'
        },
        agentOverrides: {
          'planner': 'full-auto',
          'architect': 'review-before-commit',
          'developer': 'review-before-commit',
          'tester': 'full-auto',
          'devops': 'review-all'
        }
      };

      // Should parse successfully
      const parsed = AutonomyConfigSchema.parse(productionConfig);

      // Validate structure
      expect(parsed.level).toBe('review-before-commit');
      expect(parsed.gates).toHaveLength(4);
      expect(parsed.gates![0].type).toBe('before-commit');
      expect(parsed.gates![1].type).toBe('before-deploy');
      expect(parsed.gates![2].type).toBe('before-destructive');
      expect(parsed.gates![3].type).toBe('custom');
      expect(parsed.limits!.maxCost).toBe(100.0);
      expect(parsed.stageOverrides!['planning']).toBe('full-auto');
      expect(parsed.agentOverrides!['developer']).toBe('review-before-commit');
    });

    it('should validate autonomy control types work across the system', () => {
      // Test that all autonomy levels work with gates and limits
      const autonomyLevels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all'];
      const checkpointTypes: ApprovalCheckpointType[] = ['before-commit', 'before-deploy', 'before-destructive', 'custom'];

      autonomyLevels.forEach(level => {
        checkpointTypes.forEach(checkpointType => {
          const config: AutonomyConfig = {
            level,
            gates: [{
              type: checkpointType,
              name: `Test ${checkpointType} gate for ${level}`,
              required: true
            }],
            limits: {
              maxCost: 10.0,
              maxTokens: 50000,
              maxTimeMs: 3600000
            }
          };

          // Should parse without errors
          expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
          const parsed = AutonomyConfigSchema.parse(config);
          expect(parsed.level).toBe(level);
          expect(parsed.gates![0].type).toBe(checkpointType);
        });
      });
    });
  });
});