/**
 * Simple validation test for autonomy enforcement schema
 * This test validates that the autonomy enforcement configuration options
 * are properly defined in the schema and can be used correctly.
 */
import { describe, it, expect } from 'vitest';
import { AutonomyConfigSchema, RejectionBehaviorSchema, AgentAutonomyOverrideSchema } from '../types';

describe('Autonomy Enforcement Schema Validation', () => {
  describe('RejectionBehaviorSchema', () => {
    it('should accept skip and abort values', () => {
      expect(RejectionBehaviorSchema.parse('skip')).toBe('skip');
      expect(RejectionBehaviorSchema.parse('abort')).toBe('abort');
    });

    it('should reject invalid values', () => {
      expect(() => RejectionBehaviorSchema.parse('invalid')).toThrow();
      expect(() => RejectionBehaviorSchema.parse('pause')).toThrow();
      expect(() => RejectionBehaviorSchema.parse('')).toThrow();
    });
  });

  describe('AgentAutonomyOverrideSchema', () => {
    it('should validate complete agent override configuration', () => {
      const validOverride = {
        level: 'supervised',
        rejectionBehavior: 'skip',
        approvalTimeout: 30
      };

      const result = AgentAutonomyOverrideSchema.parse(validOverride);
      expect(result.level).toBe('supervised');
      expect(result.rejectionBehavior).toBe('skip');
      expect(result.approvalTimeout).toBe(30);
    });

    it('should validate partial agent override configuration', () => {
      const partialOverride = {
        approvalTimeout: 60
      };

      const result = AgentAutonomyOverrideSchema.parse(partialOverride);
      expect(result.approvalTimeout).toBe(60);
      expect(result.level).toBeUndefined();
      expect(result.rejectionBehavior).toBeUndefined();
    });

    it('should reject invalid configurations', () => {
      expect(() => AgentAutonomyOverrideSchema.parse({
        level: 'invalid-level'
      })).toThrow();

      expect(() => AgentAutonomyOverrideSchema.parse({
        rejectionBehavior: 'invalid-behavior'
      })).toThrow();

      expect(() => AgentAutonomyOverrideSchema.parse({
        approvalTimeout: -1
      })).toThrow();

      expect(() => AgentAutonomyOverrideSchema.parse({
        approvalTimeout: 0
      })).toThrow();
    });
  });

  describe('AutonomyConfigSchema with enforcement options', () => {
    it('should support rejectionBehavior configuration', () => {
      const config = {
        level: 'review-before-commit',
        rejectionBehavior: 'skip'
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.rejectionBehavior).toBe('skip');
    });

    it('should default rejectionBehavior to abort', () => {
      const config = {
        level: 'review-before-commit'
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.rejectionBehavior).toBe('abort');
    });

    it('should support approvalTimeout configuration', () => {
      const config = {
        level: 'review-before-commit',
        approvalTimeout: 45
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.approvalTimeout).toBe(45);
    });

    it('should support complex agent overrides', () => {
      const config = {
        level: 'review-before-commit',
        rejectionBehavior: 'abort',
        approvalTimeout: 30,
        agentOverrides: {
          developer: {
            level: 'supervised',
            rejectionBehavior: 'skip',
            approvalTimeout: 60
          },
          tester: 'full-auto'
        }
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.rejectionBehavior).toBe('abort');
      expect(result.approvalTimeout).toBe(30);

      const developerOverride = result.agentOverrides!.developer;
      expect(typeof developerOverride).toBe('object');
      if (typeof developerOverride === 'object') {
        expect(developerOverride.level).toBe('supervised');
        expect(developerOverride.rejectionBehavior).toBe('skip');
        expect(developerOverride.approvalTimeout).toBe(60);
      }

      expect(result.agentOverrides!.tester).toBe('full-auto');
    });

    it('should validate all acceptance criteria are met', () => {
      // Test that all required autonomy enforcement options are supported
      const fullConfig = {
        level: 'review-before-commit',
        rejectionBehavior: 'skip', // ✓ rejectionBehavior with 'skip'|'abort'
        approvalTimeout: 30, // ✓ approvalTimeout as number
        agentOverrides: { // ✓ per-agent override settings
          developer: {
            level: 'supervised',
            rejectionBehavior: 'abort',
            approvalTimeout: 60
          },
          tester: {
            approvalTimeout: 15
          },
          reviewer: 'full-auto'
        }
      };

      const result = AutonomyConfigSchema.parse(fullConfig);

      // Verify rejectionBehavior support
      expect(result.rejectionBehavior).toBe('skip');

      // Verify approvalTimeout support
      expect(result.approvalTimeout).toBe(30);

      // Verify per-agent overrides support
      expect(result.agentOverrides).toBeDefined();
      expect(Object.keys(result.agentOverrides!)).toHaveLength(3);

      // Verify complex agent override with all enforcement options
      const developerOverride = result.agentOverrides!.developer;
      expect(typeof developerOverride).toBe('object');
      if (typeof developerOverride === 'object') {
        expect(developerOverride.level).toBe('supervised');
        expect(developerOverride.rejectionBehavior).toBe('abort');
        expect(developerOverride.approvalTimeout).toBe(60);
      }

      // Verify partial agent override
      const testerOverride = result.agentOverrides!.tester;
      expect(typeof testerOverride).toBe('object');
      if (typeof testerOverride === 'object') {
        expect(testerOverride.approvalTimeout).toBe(15);
      }

      // Verify simple agent override
      expect(result.agentOverrides!.reviewer).toBe('full-auto');
    });
  });
});