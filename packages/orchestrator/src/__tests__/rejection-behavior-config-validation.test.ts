/**
 * Test suite for rejection behavior configuration validation
 *
 * Tests that the rejection behavior configuration is properly loaded and validated:
 * - RejectionBehavior schema validation
 * - Config loading with rejectionBehavior field
 * - Default behavior when not specified
 * - Error handling for invalid values
 */

import { describe, it, expect } from 'vitest';
import { RejectionBehaviorSchema, AutonomyConfigSchema } from '@apexcli/core';

describe('Rejection Behavior Configuration Validation', () => {
  describe('RejectionBehavior Schema', () => {
    it('should accept valid rejection behaviors', () => {
      expect(() => RejectionBehaviorSchema.parse('skip')).not.toThrow();
      expect(() => RejectionBehaviorSchema.parse('abort')).not.toThrow();
    });

    it('should reject invalid rejection behaviors', () => {
      expect(() => RejectionBehaviorSchema.parse('invalid')).toThrow();
      expect(() => RejectionBehaviorSchema.parse('continue')).toThrow();
      expect(() => RejectionBehaviorSchema.parse('')).toThrow();
      expect(() => RejectionBehaviorSchema.parse(null)).toThrow();
      expect(() => RejectionBehaviorSchema.parse(undefined)).toThrow();
    });

    it('should be case-sensitive', () => {
      expect(() => RejectionBehaviorSchema.parse('Skip')).toThrow();
      expect(() => RejectionBehaviorSchema.parse('ABORT')).toThrow();
      expect(() => RejectionBehaviorSchema.parse('Abort')).toThrow();
    });
  });

  describe('AutonomyConfig Schema with rejectionBehavior', () => {
    it('should accept autonomy config with valid rejectionBehavior', () => {
      const config = {
        level: 'manual' as const,
        rejectionBehavior: 'skip' as const,
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.rejectionBehavior).toBe('skip');
    });

    it('should default rejectionBehavior to abort when not specified', () => {
      const config = {
        level: 'manual' as const,
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.rejectionBehavior).toBe('abort');
    });

    it('should accept autonomy config with abort rejectionBehavior', () => {
      const config = {
        level: 'review-before-commit' as const,
        rejectionBehavior: 'abort' as const,
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.rejectionBehavior).toBe('abort');
    });

    it('should reject autonomy config with invalid rejectionBehavior', () => {
      const config = {
        level: 'manual' as const,
        rejectionBehavior: 'invalid-behavior' as any,
      };

      expect(() => AutonomyConfigSchema.parse(config)).toThrow();
    });

    it('should work with stage overrides containing rejectionBehavior', () => {
      const config = {
        level: 'manual' as const,
        rejectionBehavior: 'abort' as const,
        stageOverrides: {
          'implementation': {
            level: 'review' as const,
            rejectionBehavior: 'skip' as const,
          },
          'testing': {
            level: 'manual' as const,
            rejectionBehavior: 'abort' as const,
          },
        },
      };

      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      const result = AutonomyConfigSchema.parse(config);
      expect(result.stageOverrides?.implementation?.rejectionBehavior).toBe('skip');
      expect(result.stageOverrides?.testing?.rejectionBehavior).toBe('abort');
    });

    it('should work with agent overrides containing rejectionBehavior', () => {
      const config = {
        level: 'manual' as const,
        rejectionBehavior: 'abort' as const,
        agentOverrides: {
          'developer': {
            level: 'review' as const,
            rejectionBehavior: 'skip' as const,
          },
          'tester': {
            level: 'automatic' as const,
            rejectionBehavior: 'abort' as const,
          },
        },
      };

      expect(() => AutonomyConfigSchema.parse(config)).not.toThrow();
      const result = AutonomyConfigSchema.parse(config);
      expect(result.agentOverrides?.developer?.rejectionBehavior).toBe('skip');
      expect(result.agentOverrides?.tester?.rejectionBehavior).toBe('abort');
    });
  });

  describe('Configuration Type Inference', () => {
    it('should properly infer rejection behavior types', () => {
      const skipConfig = AutonomyConfigSchema.parse({
        level: 'manual' as const,
        rejectionBehavior: 'skip' as const,
      });

      const abortConfig = AutonomyConfigSchema.parse({
        level: 'manual' as const,
        rejectionBehavior: 'abort' as const,
      });

      // Type-level assertions
      const skipBehavior: 'skip' = skipConfig.rejectionBehavior as 'skip';
      const abortBehavior: 'abort' = abortConfig.rejectionBehavior as 'abort';

      expect(skipBehavior).toBe('skip');
      expect(abortBehavior).toBe('abort');
    });

    it('should handle optional rejectionBehavior in overrides', () => {
      const config = AutonomyConfigSchema.parse({
        level: 'manual' as const,
        rejectionBehavior: 'skip' as const,
        stageOverrides: {
          'planning': {
            level: 'review' as const,
            // No rejectionBehavior - should inherit from parent
          },
          'implementation': {
            level: 'manual' as const,
            rejectionBehavior: 'abort' as const,
          },
        },
      });

      expect(config.stageOverrides?.planning?.rejectionBehavior).toBeUndefined();
      expect(config.stageOverrides?.implementation?.rejectionBehavior).toBe('abort');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty autonomy config', () => {
      const result = AutonomyConfigSchema.parse({});
      expect(result.level).toBe('review-before-commit'); // Default autonomy level
      expect(result.rejectionBehavior).toBe('abort'); // Default rejection behavior
    });

    it('should handle null and undefined values gracefully', () => {
      const configWithNull = {
        level: 'manual' as const,
        rejectionBehavior: null as any,
      };

      const configWithUndefined = {
        level: 'manual' as const,
        rejectionBehavior: undefined as any,
      };

      expect(() => AutonomyConfigSchema.parse(configWithNull)).toThrow();

      // Undefined should use default
      const result = AutonomyConfigSchema.parse(configWithUndefined);
      expect(result.rejectionBehavior).toBe('abort');
    });

    it('should handle complex nested configurations', () => {
      const complexConfig = {
        level: 'review-before-commit' as const,
        rejectionBehavior: 'skip' as const,
        stageOverrides: {
          'planning': {
            level: 'manual' as const,
            rejectionBehavior: 'abort' as const,
          },
          'implementation': {
            level: 'review' as const,
            rejectionBehavior: 'skip' as const,
          },
        },
        agentOverrides: {
          'developer': {
            level: 'automatic' as const,
            rejectionBehavior: 'skip' as const,
          },
          'reviewer': {
            level: 'manual' as const,
            rejectionBehavior: 'abort' as const,
          },
        },
      };

      expect(() => AutonomyConfigSchema.parse(complexConfig)).not.toThrow();
      const result = AutonomyConfigSchema.parse(complexConfig);

      expect(result.rejectionBehavior).toBe('skip');
      expect(result.stageOverrides?.planning?.rejectionBehavior).toBe('abort');
      expect(result.stageOverrides?.implementation?.rejectionBehavior).toBe('skip');
      expect(result.agentOverrides?.developer?.rejectionBehavior).toBe('skip');
      expect(result.agentOverrides?.reviewer?.rejectionBehavior).toBe('abort');
    });
  });
});