/**
 * @fileoverview Comprehensive Autonomy Control Tests
 *
 * This test suite provides comprehensive coverage of autonomy control
 * edge cases, including complex configuration scenarios, approval gates,
 * resource limits, and legacy migration paths.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AutonomyLevelSchema,
  LegacyAutonomyLevelSchema,
  migrateLegacyAutonomyLevel,
  ApprovalCheckpointTypeSchema,
  ApprovalGateSchema,
  TaskResourceLimitsSchema,
  ResourceLimitsSchema,
  AutonomyConfigSchema,
  AgentAutonomyOverrideSchema,
  StageAutonomyOverrideSchema,
  type AutonomyLevel,
  type LegacyAutonomyLevel,
  type ApprovalCheckpointType,
  type ApprovalGate,
  type TaskResourceLimits,
  type ResourceLimits,
  type AutonomyConfig,
  type AgentAutonomyOverride,
  type StageAutonomyOverride,
} from '../types';

describe('Autonomy Control System Comprehensive Tests', () => {
  describe('AutonomyLevel Schema Edge Cases', () => {
    it('should handle all valid autonomy levels', () => {
      const validLevels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all'];

      validLevels.forEach(level => {
        const result = AutonomyLevelSchema.parse(level);
        expect(result).toBe(level);
      });

      // Ensure we have exactly 3 levels
      expect(validLevels).toHaveLength(3);
    });

    it('should reject legacy-style autonomy levels', () => {
      const legacyLevels = [
        'supervised', 'autonomous', 'custom', 'manual'
      ];

      legacyLevels.forEach(level => {
        expect(() => AutonomyLevelSchema.parse(level)).toThrow();
      });
    });

    it('should handle case sensitivity', () => {
      const caseSensitiveLevels = [
        'Full-Auto', 'FULL-AUTO', 'full_auto', 'fullAuto',
        'Review-Before-Commit', 'REVIEW-BEFORE-COMMIT',
        'Review-All', 'REVIEW-ALL', 'review_all'
      ];

      caseSensitiveLevels.forEach(level => {
        expect(() => AutonomyLevelSchema.parse(level)).toThrow();
      });
    });
  });

  describe('Legacy Autonomy Migration', () => {
    it('should correctly migrate all legacy autonomy levels', () => {
      const migrationMap: Record<LegacyAutonomyLevel, AutonomyLevel> = {
        'supervised': 'review-all',
        'review-before-commit': 'review-before-commit',
        'autonomous': 'full-auto',
        'custom': 'review-all',
      };

      Object.entries(migrationMap).forEach(([legacy, expected]) => {
        const result = migrateLegacyAutonomyLevel(legacy as LegacyAutonomyLevel);
        expect(result).toBe(expected);
      });
    });

    it('should handle legacy autonomy level validation', () => {
      const validLegacyLevels: LegacyAutonomyLevel[] = [
        'supervised', 'review-before-commit', 'autonomous', 'custom'
      ];

      validLegacyLevels.forEach(level => {
        const result = LegacyAutonomyLevelSchema.parse(level);
        expect(result).toBe(level);
      });
    });

    it('should reject invalid legacy levels', () => {
      const invalidLegacyLevels = [
        'invalid', 'manual', 'semi-auto', '', null, undefined, 123
      ];

      invalidLegacyLevels.forEach(level => {
        expect(() => LegacyAutonomyLevelSchema.parse(level)).toThrow();
      });
    });

    it('should handle migration error cases', () => {
      const invalidInputs = [null, undefined, 123, 'invalid', ''];

      invalidInputs.forEach(input => {
        expect(() => migrateLegacyAutonomyLevel(input as any)).toThrow();
      });
    });
  });

  describe('ApprovalGate System', () => {
    describe('ApprovalCheckpointTypeSchema', () => {
      it('should validate all checkpoint types', () => {
        const validTypes: ApprovalCheckpointType[] = [
          'before-stage', 'after-stage', 'before-commit', 'before-deploy',
          'on-error', 'on-resource-limit'
        ];

        validTypes.forEach(type => {
          const result = ApprovalCheckpointTypeSchema.parse(type);
          expect(result).toBe(type);
        });
      });

      it('should reject invalid checkpoint types', () => {
        const invalidTypes = [
          'before-task', 'after-task', 'during-stage', 'manual',
          '', null, undefined, 123
        ];

        invalidTypes.forEach(type => {
          expect(() => ApprovalCheckpointTypeSchema.parse(type)).toThrow();
        });
      });
    });

    describe('ApprovalGateSchema', () => {
      it('should validate complete approval gates', () => {
        const approvalGates: ApprovalGate[] = [
          {
            type: 'before-stage',
            stage: 'implementation',
            message: 'Review implementation plan before proceeding?',
            timeout: 300000, // 5 minutes
          },
          {
            type: 'after-stage',
            stage: 'testing',
            message: 'Tests completed. Deploy to production?',
          },
          {
            type: 'before-commit',
            message: 'Review changes before committing?',
            condition: 'hasFileChanges',
          },
          {
            type: 'on-error',
            message: 'Error occurred. Continue with fallback plan?',
            autoResolve: true,
            timeout: 30000,
          },
          {
            type: 'on-resource-limit',
            message: 'Resource limit reached. Request additional quota?',
            condition: 'tokenLimitExceeded',
          },
        ];

        approvalGates.forEach(gate => {
          const result = ApprovalGateSchema.parse(gate);
          expect(result).toEqual(gate);
        });
      });

      it('should handle minimal approval gates', () => {
        const minimalGates = [
          { type: 'before-commit' as ApprovalCheckpointType },
          { type: 'on-error' as ApprovalCheckpointType, message: 'Error occurred' },
        ];

        minimalGates.forEach(gate => {
          const result = ApprovalGateSchema.parse(gate);
          expect(result.type).toBe(gate.type);
        });
      });

      it('should validate approval gate timeouts', () => {
        const timeoutCases = [
          { timeout: 1000 }, // 1 second
          { timeout: 30000 }, // 30 seconds
          { timeout: 300000 }, // 5 minutes
          { timeout: 3600000 }, // 1 hour
        ];

        timeoutCases.forEach(({ timeout }) => {
          const gate = ApprovalGateSchema.parse({
            type: 'before-stage',
            timeout,
          });
          expect(gate.timeout).toBe(timeout);
        });

        // Test invalid timeouts
        const invalidTimeouts = [0, -1, NaN, Infinity];
        invalidTimeouts.forEach(timeout => {
          expect(() => ApprovalGateSchema.parse({
            type: 'before-stage',
            timeout,
          })).toThrow();
        });
      });

      it('should handle approval gate conditions', () => {
        const conditionCases = [
          'hasFileChanges',
          'tokenLimitExceeded',
          'testsFailed',
          'dangerousOperation',
          'customCondition',
        ];

        conditionCases.forEach(condition => {
          const gate = ApprovalGateSchema.parse({
            type: 'before-commit',
            condition,
          });
          expect(gate.condition).toBe(condition);
        });
      });
    });
  });

  describe('Resource Limits System', () => {
    describe('TaskResourceLimitsSchema', () => {
      it('should validate task resource limits', () => {
        const resourceLimits: TaskResourceLimits = {
          maxTokensPerTask: 100000,
          maxExecutionTime: 3600000, // 1 hour
          maxMemoryUsage: 1073741824, // 1GB
          maxFileOperations: 1000,
          maxNetworkRequests: 100,
        };

        const result = TaskResourceLimitsSchema.parse(resourceLimits);
        expect(result).toEqual(resourceLimits);
      });

      it('should handle minimal resource limits', () => {
        const minimalLimits = {
          maxTokensPerTask: 10000,
        };

        const result = TaskResourceLimitsSchema.parse(minimalLimits);
        expect(result.maxTokensPerTask).toBe(10000);
      });

      it('should validate resource limit ranges', () => {
        const rangeCases = [
          { maxTokensPerTask: 1 }, // Minimum tokens
          { maxTokensPerTask: 1000000 }, // Large token limit
          { maxExecutionTime: 1000 }, // 1 second
          { maxExecutionTime: 86400000 }, // 24 hours
          { maxMemoryUsage: 1048576 }, // 1MB
          { maxMemoryUsage: 8589934592 }, // 8GB
          { maxFileOperations: 1 }, // Minimum operations
          { maxFileOperations: 10000 }, // Many operations
          { maxNetworkRequests: 1 }, // Minimum requests
          { maxNetworkRequests: 1000 }, // Many requests
        ];

        rangeCases.forEach(limits => {
          const result = TaskResourceLimitsSchema.parse(limits);
          Object.entries(limits).forEach(([key, value]) => {
            expect(result[key as keyof typeof limits]).toBe(value);
          });
        });
      });

      it('should reject invalid resource limits', () => {
        const invalidLimits = [
          { maxTokensPerTask: 0 }, // Zero tokens
          { maxTokensPerTask: -1 }, // Negative tokens
          { maxExecutionTime: -1000 }, // Negative time
          { maxMemoryUsage: -1 }, // Negative memory
          { maxFileOperations: -1 }, // Negative operations
          { maxNetworkRequests: -1 }, // Negative requests
        ];

        invalidLimits.forEach(limits => {
          expect(() => TaskResourceLimitsSchema.parse(limits)).toThrow();
        });
      });
    });

    describe('ResourceLimitsSchema', () => {
      it('should validate complete resource limits', () => {
        const resourceLimits: ResourceLimits = {
          global: {
            maxTokensPerTask: 200000,
            maxExecutionTime: 7200000, // 2 hours
          },
          perStage: {
            planning: { maxTokensPerTask: 50000, maxExecutionTime: 1800000 },
            implementation: { maxTokensPerTask: 100000, maxExecutionTime: 3600000 },
            testing: { maxTokensPerTask: 30000, maxExecutionTime: 1800000 },
          },
          perAgent: {
            developer: { maxTokensPerTask: 80000, maxFileOperations: 500 },
            tester: { maxTokensPerTask: 40000, maxNetworkRequests: 50 },
          },
        };

        const result = ResourceLimitsSchema.parse(resourceLimits);
        expect(result).toEqual(resourceLimits);
      });

      it('should handle partial resource limits', () => {
        const partialCases = [
          {
            global: { maxTokensPerTask: 100000 },
          },
          {
            perStage: {
              implementation: { maxTokensPerTask: 50000 },
            },
          },
          {
            perAgent: {
              developer: { maxFileOperations: 100 },
            },
          },
        ];

        partialCases.forEach(limits => {
          const result = ResourceLimitsSchema.parse(limits);
          expect(result).toEqual(limits);
        });
      });
    });
  });

  describe('Agent and Stage Overrides', () => {
    describe('AgentAutonomyOverrideSchema', () => {
      it('should validate agent autonomy overrides', () => {
        const overrides: AgentAutonomyOverride[] = [
          {
            agentName: 'developer',
            level: 'full-auto',
            reason: 'Developer agent is trusted for implementation',
          },
          {
            agentName: 'tester',
            level: 'review-before-commit',
            reason: 'Tests require human review before committing',
          },
          {
            agentName: 'reviewer',
            level: 'review-all',
          },
        ];

        overrides.forEach(override => {
          const result = AgentAutonomyOverrideSchema.parse(override);
          expect(result).toEqual(override);
        });
      });

      it('should handle agent names with special characters', () => {
        const specialAgentNames = [
          'agent-with-hyphens',
          'agent_with_underscores',
          'Agent.With.Dots',
          'Agent With Spaces',
          'AgentWithNumbers123',
          '中文代理',
          '🤖Agent',
        ];

        specialAgentNames.forEach(agentName => {
          const override = AgentAutonomyOverrideSchema.parse({
            agentName,
            level: 'full-auto',
          });
          expect(override.agentName).toBe(agentName);
        });
      });
    });

    describe('StageAutonomyOverrideSchema', () => {
      it('should validate stage autonomy overrides', () => {
        const stageOverrides: Record<string, AutonomyLevel> = {
          planning: 'full-auto',
          architecture: 'review-before-commit',
          implementation: 'review-before-commit',
          testing: 'review-all',
          review: 'review-all',
          deployment: 'review-all',
        };

        const result = StageAutonomyOverrideSchema.parse(stageOverrides);
        expect(result).toEqual(stageOverrides);
      });

      it('should handle custom stage names', () => {
        const customStages = {
          'custom-stage-1': 'full-auto' as AutonomyLevel,
          'pre_processing': 'review-before-commit' as AutonomyLevel,
          'Stage With Spaces': 'review-all' as AutonomyLevel,
          '阶段名称': 'full-auto' as AutonomyLevel,
        };

        const result = StageAutonomyOverrideSchema.parse(customStages);
        expect(result).toEqual(customStages);
      });
    });
  });

  describe('Complete AutonomyConfig Integration', () => {
    it('should validate complete autonomy configurations', () => {
      const complexConfigs: AutonomyConfig[] = [
        {
          level: 'review-before-commit',
          stageOverrides: {
            planning: 'full-auto',
            testing: 'review-all',
          },
          agentOverrides: [
            { agentName: 'planner', level: 'full-auto', reason: 'Planning is low-risk' },
            { agentName: 'tester', level: 'review-all', reason: 'Tests affect deployment' },
          ],
          approvalGates: [
            {
              type: 'before-stage',
              stage: 'implementation',
              message: 'Review implementation plan?',
              timeout: 300000,
            },
            {
              type: 'on-error',
              message: 'Error encountered. Continue?',
              autoResolve: false,
            },
          ],
          resourceLimits: {
            global: { maxTokensPerTask: 200000 },
            perStage: {
              implementation: { maxTokensPerTask: 100000 },
            },
          },
          onRejection: 'abort',
        },
        {
          level: 'full-auto',
          resourceLimits: {
            global: {
              maxTokensPerTask: 500000,
              maxExecutionTime: 7200000,
              maxMemoryUsage: 2147483648,
            },
          },
          onRejection: 'fallback',
        },
        {
          level: 'review-all',
          approvalGates: [
            { type: 'before-stage', stage: 'planning' },
            { type: 'before-stage', stage: 'implementation' },
            { type: 'before-stage', stage: 'testing' },
            { type: 'before-commit' },
          ],
          onRejection: 'prompt',
        },
      ];

      complexConfigs.forEach((config, index) => {
        const result = AutonomyConfigSchema.parse(config);
        expect(result).toEqual(config);
      });
    });

    it('should handle autonomy configuration edge cases', () => {
      const edgeCases = [
        {
          level: 'full-auto' as AutonomyLevel,
          // No overrides or limits - minimal config
        },
        {
          level: 'review-all' as AutonomyLevel,
          stageOverrides: {}, // Empty overrides
          agentOverrides: [], // Empty overrides
          approvalGates: [], // No gates
        },
        {
          level: 'review-before-commit' as AutonomyLevel,
          resourceLimits: {
            global: { maxTokensPerTask: 1 }, // Minimal resources
          },
        },
      ];

      edgeCases.forEach(config => {
        const result = AutonomyConfigSchema.parse(config);
        expect(result.level).toBe(config.level);
      });
    });

    it('should validate rejection behavior options', () => {
      const rejectionBehaviors = ['abort', 'fallback', 'prompt'] as const;

      rejectionBehaviors.forEach(behavior => {
        const config = AutonomyConfigSchema.parse({
          level: 'review-before-commit',
          onRejection: behavior,
        });
        expect(config.onRejection).toBe(behavior);
      });

      // Test invalid rejection behaviors
      const invalidBehaviors = ['continue', 'ignore', 'retry', null, undefined];
      invalidBehaviors.forEach(behavior => {
        expect(() => AutonomyConfigSchema.parse({
          level: 'review-before-commit',
          onRejection: behavior,
        })).toThrow();
      });
    });
  });

  describe('Autonomy System Consistency', () => {
    it('should maintain consistency between legacy and modern autonomy levels', () => {
      const legacyToModern: Record<LegacyAutonomyLevel, AutonomyLevel> = {
        'supervised': 'review-all',
        'review-before-commit': 'review-before-commit',
        'autonomous': 'full-auto',
        'custom': 'review-all',
      };

      Object.entries(legacyToModern).forEach(([legacy, modern]) => {
        // Legacy should parse correctly
        const parsedLegacy = LegacyAutonomyLevelSchema.parse(legacy);
        expect(parsedLegacy).toBe(legacy);

        // Migration should produce correct modern equivalent
        const migrated = migrateLegacyAutonomyLevel(legacy as LegacyAutonomyLevel);
        expect(migrated).toBe(modern);

        // Modern should parse correctly
        const parsedModern = AutonomyLevelSchema.parse(modern);
        expect(parsedModern).toBe(modern);
      });
    });

    it('should validate autonomy level hierarchy consistency', () => {
      // Test that autonomy levels maintain their intended hierarchy
      const hierarchyTests = [
        {
          level: 'review-all' as AutonomyLevel,
          shouldRequireApproval: true,
          description: 'Most restrictive level',
        },
        {
          level: 'review-before-commit' as AutonomyLevel,
          shouldRequireApproval: true,
          description: 'Moderate restriction level',
        },
        {
          level: 'full-auto' as AutonomyLevel,
          shouldRequireApproval: false,
          description: 'Least restrictive level',
        },
      ];

      hierarchyTests.forEach(({ level, shouldRequireApproval, description }) => {
        const config = AutonomyConfigSchema.parse({ level });
        expect(config.level).toBe(level);
        // The actual approval logic would be implemented elsewhere,
        // but we validate the schema accepts the level
      });
    });
  });
});