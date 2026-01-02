import { describe, it, expect } from 'vitest';
import {
  AutonomyLevelSchema,
  AutonomyLevel,
  LegacyAutonomyLevelSchema,
  LegacyAutonomyLevel,
  migrateLegacyAutonomyLevel,
  ApprovalCheckpointTypeSchema,
  ApprovalCheckpointType,
  ApprovalGateSchema,
  ApprovalGate,
  TaskResourceLimitsSchema,
  TaskResourceLimits,
  AutonomyConfigSchema,
  AutonomyConfig,
  ResourceLimitsSchema,
  ResourceLimits,
} from '../types';

describe('Autonomy Control Types', () => {
  describe('AutonomyLevelSchema', () => {
    it('should accept valid autonomy levels', () => {
      const validLevels: AutonomyLevel[] = [
        'full-auto',
        'review-before-commit',
        'review-all'
      ];

      validLevels.forEach(level => {
        expect(AutonomyLevelSchema.parse(level)).toBe(level);
      });
    });

    it('should reject invalid autonomy levels', () => {
      const invalidLevels = [
        'invalid',
        'full',
        'manual',
        'review-before-merge',
        '',
        null,
        undefined,
        123
      ];

      invalidLevels.forEach(level => {
        expect(() => AutonomyLevelSchema.parse(level)).toThrow();
      });
    });

    it('should export correct type', () => {
      const level: AutonomyLevel = 'review-before-commit';
      expect(level).toBe('review-before-commit');
    });
  });

  describe('LegacyAutonomyLevelSchema and Migration', () => {
    it('should accept valid legacy autonomy levels', () => {
      const validLegacyLevels: LegacyAutonomyLevel[] = [
        'full',
        'review-before-commit',
        'review-before-merge',
        'manual'
      ];

      validLegacyLevels.forEach(level => {
        expect(LegacyAutonomyLevelSchema.parse(level)).toBe(level);
      });
    });

    it('should reject invalid legacy autonomy levels', () => {
      const invalidLevels = [
        'full-auto',
        'review-all',
        'invalid',
        '',
        null,
        undefined,
        123
      ];

      invalidLevels.forEach(level => {
        expect(() => LegacyAutonomyLevelSchema.parse(level)).toThrow();
      });
    });

    it('should migrate legacy levels correctly', () => {
      expect(migrateLegacyAutonomyLevel('full')).toBe('full-auto');
      expect(migrateLegacyAutonomyLevel('review-before-commit')).toBe('review-before-commit');
      expect(migrateLegacyAutonomyLevel('review-before-merge')).toBe('review-before-commit');
      expect(migrateLegacyAutonomyLevel('manual')).toBe('review-all');
    });

    it('should handle all possible legacy values', () => {
      const legacyValues: LegacyAutonomyLevel[] = ['full', 'review-before-commit', 'review-before-merge', 'manual'];

      legacyValues.forEach(legacy => {
        const migrated = migrateLegacyAutonomyLevel(legacy);
        expect(AutonomyLevelSchema.parse(migrated)).toBe(migrated);
      });
    });
  });

  describe('ApprovalCheckpointTypeSchema', () => {
    it('should accept valid checkpoint types', () => {
      const validTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'custom'
      ];

      validTypes.forEach(type => {
        expect(ApprovalCheckpointTypeSchema.parse(type)).toBe(type);
      });
    });

    it('should reject invalid checkpoint types', () => {
      const invalidTypes = [
        'before-merge',
        'after-commit',
        'invalid',
        '',
        null,
        undefined,
        123
      ];

      invalidTypes.forEach(type => {
        expect(() => ApprovalCheckpointTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('ApprovalGateSchema', () => {
    it('should accept valid minimal approval gate', () => {
      const minimalGate = {
        type: 'before-commit' as const,
      };

      const parsed = ApprovalGateSchema.parse(minimalGate);
      expect(parsed.type).toBe('before-commit');
      expect(parsed.required).toBe(true); // default value
      expect(parsed.autoApproveOnTimeout).toBe(false); // default value
      expect(parsed.minApprovals).toBe(1); // default value
    });

    it('should accept complete approval gate', () => {
      const completeGate: ApprovalGate = {
        type: 'custom',
        name: 'Production Deploy Gate',
        description: 'Requires approval before deploying to production',
        required: true,
        trigger: 'environment === "production"',
        approvers: ['alice@company.com', 'bob@company.com', 'devops-team'],
        timeout: 60,
        autoApproveOnTimeout: false,
        minApprovals: 2,
        tags: ['production', 'deploy', 'critical']
      };

      const parsed = ApprovalGateSchema.parse(completeGate);
      expect(parsed).toEqual(completeGate);
    });

    it('should validate timeout constraints', () => {
      // Valid timeout
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        timeout: 30
      })).not.toThrow();

      // Invalid timeout (too small)
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        timeout: 0
      })).toThrow();

      // Invalid timeout (negative)
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        timeout: -1
      })).toThrow();
    });

    it('should validate minApprovals constraints', () => {
      // Valid minApprovals
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        minApprovals: 3
      })).not.toThrow();

      // Invalid minApprovals (too small)
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        minApprovals: 0
      })).toThrow();

      // Invalid minApprovals (negative)
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        minApprovals: -1
      })).toThrow();
    });

    it('should handle optional fields correctly', () => {
      const gateWithOptionals = {
        type: 'before-deploy' as const,
        name: 'Deploy Gate',
        approvers: ['deployer@company.com'],
        tags: ['deploy']
      };

      const parsed = ApprovalGateSchema.parse(gateWithOptionals);
      expect(parsed.name).toBe('Deploy Gate');
      expect(parsed.description).toBeUndefined();
      expect(parsed.trigger).toBeUndefined();
      expect(parsed.timeout).toBeUndefined();
      expect(parsed.required).toBe(true);
      expect(parsed.autoApproveOnTimeout).toBe(false);
      expect(parsed.minApprovals).toBe(1);
    });
  });

  describe('TaskResourceLimitsSchema', () => {
    it('should accept valid minimal resource limits', () => {
      const minimalLimits = {};

      const parsed = TaskResourceLimitsSchema.parse(minimalLimits);
      expect(parsed).toEqual({});
    });

    it('should accept complete resource limits', () => {
      const completeLimits: TaskResourceLimits = {
        maxCost: 10.0,
        maxTokens: 100000,
        maxTimeMs: 3600000,
        maxFilesCreated: 10,
        maxFilesModified: 50,
        maxFilesDeleted: 5,
        maxLinesChanged: 1000,
        maxTurns: 20,
        dailyBudget: 50.0,
        maxConcurrentTasks: 3
      };

      const parsed = TaskResourceLimitsSchema.parse(completeLimits);
      expect(parsed).toEqual(completeLimits);
    });

    it('should validate numeric constraints', () => {
      // Test maxCost constraints
      expect(() => TaskResourceLimitsSchema.parse({ maxCost: -1 })).toThrow();
      expect(() => TaskResourceLimitsSchema.parse({ maxCost: 0 })).not.toThrow();

      // Test maxTokens constraints
      expect(() => TaskResourceLimitsSchema.parse({ maxTokens: -1 })).toThrow();
      expect(() => TaskResourceLimitsSchema.parse({ maxTokens: 0 })).not.toThrow();

      // Test maxTimeMs constraints
      expect(() => TaskResourceLimitsSchema.parse({ maxTimeMs: -1 })).toThrow();
      expect(() => TaskResourceLimitsSchema.parse({ maxTimeMs: 0 })).not.toThrow();

      // Test file operation constraints
      expect(() => TaskResourceLimitsSchema.parse({ maxFilesCreated: -1 })).toThrow();
      expect(() => TaskResourceLimitsSchema.parse({ maxFilesModified: -1 })).toThrow();
      expect(() => TaskResourceLimitsSchema.parse({ maxFilesDeleted: -1 })).toThrow();
      expect(() => TaskResourceLimitsSchema.parse({ maxLinesChanged: -1 })).toThrow();

      // Test maxTurns constraint (minimum 1)
      expect(() => TaskResourceLimitsSchema.parse({ maxTurns: 0 })).toThrow();
      expect(() => TaskResourceLimitsSchema.parse({ maxTurns: 1 })).not.toThrow();

      // Test daily budget constraints
      expect(() => TaskResourceLimitsSchema.parse({ dailyBudget: -1 })).toThrow();
      expect(() => TaskResourceLimitsSchema.parse({ dailyBudget: 0 })).not.toThrow();

      // Test concurrent tasks constraint (minimum 1)
      expect(() => TaskResourceLimitsSchema.parse({ maxConcurrentTasks: 0 })).toThrow();
      expect(() => TaskResourceLimitsSchema.parse({ maxConcurrentTasks: 1 })).not.toThrow();
    });

    it('should accept partial resource limits', () => {
      const partialLimits = {
        maxCost: 5.0,
        maxTokens: 50000
      };

      const parsed = TaskResourceLimitsSchema.parse(partialLimits);
      expect(parsed.maxCost).toBe(5.0);
      expect(parsed.maxTokens).toBe(50000);
      expect(parsed.maxTimeMs).toBeUndefined();
      expect(parsed.maxFilesCreated).toBeUndefined();
    });
  });

  describe('AutonomyConfigSchema', () => {
    it('should accept minimal autonomy config with defaults', () => {
      const minimalConfig = {};

      const parsed = AutonomyConfigSchema.parse(minimalConfig);
      expect(parsed.level).toBe('review-before-commit'); // default value
      expect(parsed.gates).toBeUndefined();
      expect(parsed.limits).toBeUndefined();
      expect(parsed.stageOverrides).toBeUndefined();
      expect(parsed.agentOverrides).toBeUndefined();
    });

    it('should accept complete autonomy config', () => {
      const completeConfig: AutonomyConfig = {
        level: 'review-all',
        gates: [
          {
            type: 'before-commit',
            name: 'Code Review Gate',
            required: true,
            minApprovals: 2
          },
          {
            type: 'before-deploy',
            name: 'Production Gate',
            required: true,
            approvers: ['ops-team'],
            timeout: 30
          }
        ],
        limits: {
          maxCost: 15.0,
          maxTokens: 200000,
          maxFilesModified: 100
        },
        stageOverrides: {
          'planning': 'full-auto',
          'testing': 'review-before-commit'
        },
        agentOverrides: {
          'developer': 'review-all',
          'tester': 'review-before-commit'
        }
      };

      const parsed = AutonomyConfigSchema.parse(completeConfig);
      expect(parsed).toEqual(completeConfig);
    });

    it('should validate level field', () => {
      expect(() => AutonomyConfigSchema.parse({ level: 'invalid' })).toThrow();
      expect(() => AutonomyConfigSchema.parse({ level: 'full-auto' })).not.toThrow();
    });

    it('should validate gates array', () => {
      const configWithValidGates = {
        gates: [
          { type: 'before-commit' },
          { type: 'before-deploy' }
        ]
      };
      expect(() => AutonomyConfigSchema.parse(configWithValidGates)).not.toThrow();

      const configWithInvalidGate = {
        gates: [
          { type: 'invalid-gate' }
        ]
      };
      expect(() => AutonomyConfigSchema.parse(configWithInvalidGate)).toThrow();
    });

    it('should validate override objects', () => {
      const configWithValidOverrides = {
        stageOverrides: {
          'planning': 'full-auto',
          'implementation': 'review-before-commit',
          'testing': 'review-all'
        },
        agentOverrides: {
          'developer': 'review-before-commit',
          'tester': 'full-auto'
        }
      };
      expect(() => AutonomyConfigSchema.parse(configWithValidOverrides)).not.toThrow();

      const configWithInvalidStageOverride = {
        stageOverrides: {
          'planning': 'invalid-level'
        }
      };
      expect(() => AutonomyConfigSchema.parse(configWithInvalidStageOverride)).toThrow();

      const configWithInvalidAgentOverride = {
        agentOverrides: {
          'developer': 'invalid-level'
        }
      };
      expect(() => AutonomyConfigSchema.parse(configWithInvalidAgentOverride)).toThrow();
    });
  });

  describe('ResourceLimitsSchema (Container)', () => {
    it('should accept valid minimal resource limits', () => {
      const minimalLimits = {};

      const parsed = ResourceLimitsSchema.parse(minimalLimits);
      expect(parsed).toEqual({});
    });

    it('should accept complete resource limits', () => {
      const completeLimits: ResourceLimits = {
        cpu: 2.0,
        memory: '2g',
        memoryReservation: '1g',
        memorySwap: '4g',
        cpuShares: 1024,
        pidsLimit: 1000
      };

      const parsed = ResourceLimitsSchema.parse(completeLimits);
      expect(parsed).toEqual(completeLimits);
    });

    it('should validate CPU constraints', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.05 })).toThrow(); // below minimum
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.1 })).not.toThrow(); // at minimum
      expect(() => ResourceLimitsSchema.parse({ cpu: 64 })).not.toThrow(); // at maximum
      expect(() => ResourceLimitsSchema.parse({ cpu: 65 })).toThrow(); // above maximum
    });

    it('should validate memory format', () => {
      const validMemoryFormats = ['256m', '1g', '2048m', '1G', '512K'];
      validMemoryFormats.forEach(format => {
        expect(() => ResourceLimitsSchema.parse({ memory: format })).not.toThrow();
      });

      const invalidMemoryFormats = ['256', '1gb', '2048mb', '1 g', ''];
      invalidMemoryFormats.forEach(format => {
        expect(() => ResourceLimitsSchema.parse({ memory: format })).toThrow();
      });
    });

    it('should validate memory reservation format', () => {
      expect(() => ResourceLimitsSchema.parse({ memoryReservation: '512m' })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ memoryReservation: 'invalid' })).toThrow();
    });

    it('should validate memory swap format', () => {
      expect(() => ResourceLimitsSchema.parse({ memorySwap: '2g' })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ memorySwap: 'invalid' })).toThrow();
    });

    it('should validate CPU shares constraints', () => {
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 1 })).toThrow(); // below minimum
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 2 })).not.toThrow(); // at minimum
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262144 })).not.toThrow(); // at maximum
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262145 })).toThrow(); // above maximum
    });

    it('should validate PIDs limit constraints', () => {
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 0 })).toThrow(); // below minimum
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 1 })).not.toThrow(); // at minimum
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 10000 })).not.toThrow(); // valid value
    });
  });

  describe('Integration Tests', () => {
    it('should work together in complex scenarios', () => {
      // Create a complex autonomy config that uses all types
      const complexConfig: AutonomyConfig = {
        level: 'review-before-commit',
        gates: [
          {
            type: 'before-commit',
            name: 'Code Review',
            description: 'Requires peer review before commit',
            required: true,
            approvers: ['team-lead', 'senior-dev'],
            minApprovals: 1,
            timeout: 120,
            autoApproveOnTimeout: false,
            tags: ['review', 'quality']
          },
          {
            type: 'before-deploy',
            name: 'Production Deploy',
            description: 'Requires ops approval for production',
            required: true,
            approvers: ['devops-team'],
            minApprovals: 1,
            timeout: 60,
            autoApproveOnTimeout: false,
            tags: ['production', 'deploy']
          },
          {
            type: 'custom',
            name: 'High Risk Change',
            description: 'Requires approval for high-risk changes',
            required: false,
            trigger: 'risk_score > 0.8',
            approvers: ['security-team', 'architect'],
            minApprovals: 2,
            timeout: 240,
            autoApproveOnTimeout: false,
            tags: ['security', 'risk']
          }
        ],
        limits: {
          maxCost: 25.0,
          maxTokens: 500000,
          maxTimeMs: 7200000, // 2 hours
          maxFilesCreated: 20,
          maxFilesModified: 100,
          maxFilesDeleted: 10,
          maxLinesChanged: 5000,
          maxTurns: 50,
          dailyBudget: 100.0,
          maxConcurrentTasks: 5
        },
        stageOverrides: {
          'planning': 'full-auto',
          'architecture': 'review-before-commit',
          'implementation': 'review-before-commit',
          'testing': 'full-auto',
          'review': 'review-all',
          'deployment': 'review-all'
        },
        agentOverrides: {
          'planner': 'full-auto',
          'architect': 'review-before-commit',
          'developer': 'review-before-commit',
          'tester': 'full-auto',
          'reviewer': 'review-all',
          'devops': 'review-all'
        }
      };

      // Should parse without errors
      const parsed = AutonomyConfigSchema.parse(complexConfig);
      expect(parsed).toEqual(complexConfig);

      // Test that individual components work correctly
      expect(parsed.level).toBe('review-before-commit');
      expect(parsed.gates).toHaveLength(3);
      expect(parsed.gates![0].type).toBe('before-commit');
      expect(parsed.gates![1].type).toBe('before-deploy');
      expect(parsed.gates![2].type).toBe('custom');
      expect(parsed.limits!.maxCost).toBe(25.0);
      expect(parsed.stageOverrides!['planning']).toBe('full-auto');
      expect(parsed.agentOverrides!['developer']).toBe('review-before-commit');
    });

    it('should handle migration scenarios', () => {
      // Test migrating from legacy autonomy levels
      const legacyLevels: LegacyAutonomyLevel[] = ['full', 'manual', 'review-before-merge'];

      legacyLevels.forEach(legacy => {
        const migrated = migrateLegacyAutonomyLevel(legacy);

        // Create config with migrated level
        const config: AutonomyConfig = {
          level: migrated,
          gates: [{
            type: 'before-commit',
            name: 'Migrated Gate'
          }]
        };

        const parsed = AutonomyConfigSchema.parse(config);
        expect(parsed.level).toBe(migrated);
      });
    });

    it('should validate cross-schema consistency', () => {
      // Test that all approval gate types work in autonomy config
      const checkpointTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'custom'
      ];

      checkpointTypes.forEach(type => {
        const config: AutonomyConfig = {
          level: 'review-all',
          gates: [{
            type,
            name: `Test ${type} gate`
          }]
        };

        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });

      // Test that all autonomy levels work in overrides
      const autonomyLevels: AutonomyLevel[] = [
        'full-auto',
        'review-before-commit',
        'review-all'
      ];

      autonomyLevels.forEach(level => {
        const config: AutonomyConfig = {
          level,
          stageOverrides: {
            'test-stage': level
          },
          agentOverrides: {
            'test-agent': level
          }
        };

        expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should provide meaningful error messages', () => {
      // Test invalid autonomy level
      try {
        AutonomyLevelSchema.parse('invalid-level');
      } catch (error: any) {
        expect(error.message).toContain('Invalid enum value');
      }

      // Test invalid gate type
      try {
        ApprovalGateSchema.parse({ type: 'invalid-type' });
      } catch (error: any) {
        expect(error.message).toContain('Invalid enum value');
      }

      // Test negative resource limits
      try {
        TaskResourceLimitsSchema.parse({ maxCost: -1 });
      } catch (error: any) {
        expect(error.message).toContain('Number must be greater than or equal to 0');
      }
    });

    it('should handle type inference correctly', () => {
      // Test that TypeScript can infer types correctly
      const inferredGate = {
        type: 'before-commit' as const,
        name: 'Inferred Gate',
        required: true
      };

      // Should be assignable to ApprovalGate
      const typedGate: ApprovalGate = inferredGate;
      expect(typedGate.type).toBe('before-commit');

      const inferredConfig = {
        level: 'review-all' as const,
        gates: [inferredGate]
      };

      // Should be assignable to AutonomyConfig
      const typedConfig: AutonomyConfig = inferredConfig;
      expect(typedConfig.level).toBe('review-all');
    });
  });
});