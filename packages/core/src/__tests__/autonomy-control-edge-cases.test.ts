import { describe, it, expect } from 'vitest';
import {
  AutonomyLevelSchema,
  LegacyAutonomyLevelSchema,
  migrateLegacyAutonomyLevel,
  ApprovalCheckpointTypeSchema,
  ApprovalGateSchema,
  TaskResourceLimitsSchema,
  AutonomyConfigSchema,
  ResourceLimitsSchema,
  type LegacyAutonomyLevel
} from '../types';

describe('Autonomy Control Edge Cases', () => {
  describe('Input Validation Edge Cases', () => {
    it('should reject empty strings for enum values', () => {
      expect(() => AutonomyLevelSchema.parse('')).toThrow();
      expect(() => ApprovalCheckpointTypeSchema.parse('')).toThrow();
      expect(() => LegacyAutonomyLevelSchema.parse('')).toThrow();
    });

    it('should reject null and undefined for required enum fields', () => {
      expect(() => AutonomyLevelSchema.parse(null)).toThrow();
      expect(() => AutonomyLevelSchema.parse(undefined)).toThrow();
      expect(() => ApprovalCheckpointTypeSchema.parse(null)).toThrow();
      expect(() => ApprovalCheckpointTypeSchema.parse(undefined)).toThrow();
    });

    it('should reject wrong data types', () => {
      expect(() => AutonomyLevelSchema.parse(123)).toThrow();
      expect(() => AutonomyLevelSchema.parse(true)).toThrow();
      expect(() => AutonomyLevelSchema.parse({})).toThrow();
      expect(() => AutonomyLevelSchema.parse([])).toThrow();
    });

    it('should reject case-sensitive variations', () => {
      expect(() => AutonomyLevelSchema.parse('FULL-AUTO')).toThrow();
      expect(() => AutonomyLevelSchema.parse('Review-Before-Commit')).toThrow();
      expect(() => AutonomyLevelSchema.parse('review_before_commit')).toThrow();
    });
  });

  describe('ApprovalGate Edge Cases', () => {
    it('should handle edge case values for timeout', () => {
      // Minimum valid timeout (1 minute)
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        timeout: 1
      })).not.toThrow();

      // Very large timeout (24 hours)
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        timeout: 1440
      })).not.toThrow();

      // Zero timeout should be rejected
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        timeout: 0
      })).toThrow();

      // Negative timeout should be rejected
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        timeout: -1
      })).toThrow();

      // Non-integer timeout should be rejected
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        timeout: 1.5
      })).toThrow();
    });

    it('should handle edge case values for minApprovals', () => {
      // Minimum valid minApprovals
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        minApprovals: 1
      })).not.toThrow();

      // Large number of approvals
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        minApprovals: 100
      })).not.toThrow();

      // Zero approvals should be rejected
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        minApprovals: 0
      })).toThrow();

      // Negative approvals should be rejected
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        minApprovals: -1
      })).toThrow();
    });

    it('should handle empty and malformed arrays', () => {
      // Empty approvers array should be allowed
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        approvers: []
      })).not.toThrow();

      // Empty tags array should be allowed
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        tags: []
      })).not.toThrow();

      // Non-string elements in approvers should be rejected
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        approvers: ['valid@email.com', 123, 'another@email.com']
      })).toThrow();

      // Non-string elements in tags should be rejected
      expect(() => ApprovalGateSchema.parse({
        type: 'before-commit',
        tags: ['valid-tag', 456, 'another-tag']
      })).toThrow();
    });

    it('should validate custom trigger expressions', () => {
      // Valid trigger expressions
      const validTriggers = [
        'risk_score > 0.8',
        'environment === "production"',
        'files_changed.length > 10',
        'author.team !== "senior-dev"',
        'complexity_score > threshold && security_review_required'
      ];

      validTriggers.forEach(trigger => {
        expect(() => ApprovalGateSchema.parse({
          type: 'custom',
          trigger
        })).not.toThrow();
      });

      // Empty trigger should be allowed (even for custom type)
      expect(() => ApprovalGateSchema.parse({
        type: 'custom',
        trigger: ''
      })).not.toThrow();
    });
  });

  describe('Resource Limits Edge Cases', () => {
    it('should handle zero values correctly', () => {
      const zeroLimits = {
        maxCost: 0,
        maxTokens: 0,
        maxTimeMs: 0,
        maxFilesCreated: 0,
        maxFilesModified: 0,
        maxFilesDeleted: 0,
        maxLinesChanged: 0,
        dailyBudget: 0
      };

      expect(() => TaskResourceLimitsSchema.parse(zeroLimits)).not.toThrow();
    });

    it('should handle very large numbers', () => {
      const largeLimits = {
        maxCost: 999999.99,
        maxTokens: Number.MAX_SAFE_INTEGER,
        maxTimeMs: Number.MAX_SAFE_INTEGER,
        maxFilesCreated: 1000000,
        maxTurns: 10000,
        maxConcurrentTasks: 1000
      };

      expect(() => TaskResourceLimitsSchema.parse(largeLimits)).not.toThrow();
    });

    it('should reject negative values', () => {
      const negativeFields = [
        'maxCost', 'maxTokens', 'maxTimeMs', 'maxFilesCreated',
        'maxFilesModified', 'maxFilesDeleted', 'maxLinesChanged',
        'dailyBudget'
      ];

      negativeFields.forEach(field => {
        expect(() => TaskResourceLimitsSchema.parse({
          [field]: -1
        })).toThrow();
      });
    });

    it('should reject invalid minimum values for specific fields', () => {
      // maxTurns minimum is 1
      expect(() => TaskResourceLimitsSchema.parse({
        maxTurns: 0
      })).toThrow();

      // maxConcurrentTasks minimum is 1
      expect(() => TaskResourceLimitsSchema.parse({
        maxConcurrentTasks: 0
      })).toThrow();
    });

    it('should handle floating point precision', () => {
      expect(() => TaskResourceLimitsSchema.parse({
        maxCost: 10.999999999999998
      })).not.toThrow();

      expect(() => TaskResourceLimitsSchema.parse({
        dailyBudget: 0.01
      })).not.toThrow();
    });
  });

  describe('Container Resource Limits Edge Cases', () => {
    it('should validate CPU constraints strictly', () => {
      // Below minimum (0.1)
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.09 })).toThrow();

      // At minimum
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.1 })).not.toThrow();

      // At maximum
      expect(() => ResourceLimitsSchema.parse({ cpu: 64 })).not.toThrow();

      // Above maximum
      expect(() => ResourceLimitsSchema.parse({ cpu: 64.1 })).toThrow();
    });

    it('should validate memory format patterns strictly', () => {
      const validMemoryValues = [
        '1k', '1K', '1m', '1M', '1g', '1G',
        '256m', '1024K', '2g', '4G',
        '100', '0' // bare numbers should be valid
      ];

      const invalidMemoryValues = [
        '1kb', '1mb', '1gb', '1tb',  // wrong suffixes
        '1 m', ' 1g', '1g ', // spaces
        '1.5g', '1,024m', // decimal and comma
        'invalid', '', 'g1' // malformed
      ];

      validMemoryValues.forEach(value => {
        expect(() => ResourceLimitsSchema.parse({ memory: value })).not.toThrow();
      });

      invalidMemoryValues.forEach(value => {
        expect(() => ResourceLimitsSchema.parse({ memory: value })).toThrow();
      });
    });

    it('should validate CPU shares constraints', () => {
      // Below minimum (2)
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 1 })).toThrow();

      // At minimum
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 2 })).not.toThrow();

      // At maximum
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262144 })).not.toThrow();

      // Above maximum
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262145 })).toThrow();
    });

    it('should validate PIDs limit constraints', () => {
      // Below minimum (1)
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 0 })).toThrow();

      // At minimum
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 1 })).not.toThrow();

      // Large valid value
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 1000000 })).not.toThrow();
    });
  });

  describe('Migration Edge Cases', () => {
    it('should handle all legacy autonomy level mappings', () => {
      const mappings: Record<LegacyAutonomyLevel, string> = {
        'full': 'full-auto',
        'review-before-commit': 'review-before-commit',
        'review-before-merge': 'review-before-commit',
        'manual': 'review-all'
      };

      Object.entries(mappings).forEach(([legacy, expected]) => {
        const result = migrateLegacyAutonomyLevel(legacy as LegacyAutonomyLevel);
        expect(result).toBe(expected);
      });
    });

    it('should ensure migrated values are valid in new schema', () => {
      const legacyValues: LegacyAutonomyLevel[] = [
        'full', 'review-before-commit', 'review-before-merge', 'manual'
      ];

      legacyValues.forEach(legacy => {
        const migrated = migrateLegacyAutonomyLevel(legacy);
        expect(() => AutonomyLevelSchema.parse(migrated)).not.toThrow();
      });
    });
  });

  describe('Complex Configuration Edge Cases', () => {
    it('should handle configuration with all optional fields undefined', () => {
      const minimalConfig = {
        // Only required fields with defaults
      };

      const parsed = AutonomyConfigSchema.parse(minimalConfig);
      expect(parsed.level).toBe('review-before-commit');
      expect(parsed.gates).toBeUndefined();
      expect(parsed.limits).toBeUndefined();
      expect(parsed.stageOverrides).toBeUndefined();
      expect(parsed.agentOverrides).toBeUndefined();
    });

    it('should handle empty arrays and objects', () => {
      const configWithEmptyCollections = {
        gates: [],
        stageOverrides: {},
        agentOverrides: {}
      };

      expect(() => AutonomyConfigSchema.parse(configWithEmptyCollections)).not.toThrow();
    });

    it('should validate nested schema combinations', () => {
      // Configuration with invalid nested gate
      expect(() => AutonomyConfigSchema.parse({
        gates: [{
          type: 'invalid-gate-type'
        }]
      })).toThrow();

      // Configuration with invalid nested limits
      expect(() => AutonomyConfigSchema.parse({
        limits: {
          maxCost: -1 // invalid
        }
      })).toThrow();

      // Configuration with invalid override values
      expect(() => AutonomyConfigSchema.parse({
        stageOverrides: {
          'test-stage': 'invalid-autonomy-level'
        }
      })).toThrow();
    });

    it('should handle very large configurations', () => {
      const largeConfig = {
        level: 'review-all',
        gates: Array.from({ length: 100 }, (_, i) => ({
          type: 'before-commit' as const,
          name: `Gate ${i}`,
          description: `Description for gate ${i}`
        })),
        stageOverrides: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`stage-${i}`, 'full-auto' as const])
        ),
        agentOverrides: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`agent-${i}`, 'review-before-commit' as const])
        )
      };

      expect(() => AutonomyConfigSchema.parse(largeConfig)).not.toThrow();
    });
  });

  describe('Type Safety Edge Cases', () => {
    it('should preserve type information through parsing', () => {
      const config = {
        level: 'review-all' as const,
        gates: [{
          type: 'before-commit' as const,
          name: 'Test Gate'
        }]
      };

      const parsed = AutonomyConfigSchema.parse(config);

      // TypeScript should infer correct types
      expect(parsed.level).toBe('review-all');
      expect(parsed.gates![0].type).toBe('before-commit');
    });

    it('should handle union type edge cases', () => {
      // Test that all enum values are properly typed
      const autonomyLevels = ['full-auto', 'review-before-commit', 'review-all'] as const;
      const gatTypes = ['before-commit', 'before-deploy', 'before-destructive', 'custom'] as const;

      autonomyLevels.forEach(level => {
        expect(() => AutonomyLevelSchema.parse(level)).not.toThrow();
      });

      gatTypes.forEach(type => {
        expect(() => ApprovalCheckpointTypeSchema.parse(type)).not.toThrow();
      });
    });
  });
});