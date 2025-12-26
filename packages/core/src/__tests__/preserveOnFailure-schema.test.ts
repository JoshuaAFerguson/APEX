import { describe, it, expect } from 'vitest';
import { WorkspaceConfigSchema } from '../types.js';

describe('WorkspaceConfigSchema preserveOnFailure field', () => {
  describe('schema validation', () => {
    it('should apply default value of false when preserveOnFailure is not provided', () => {
      const parsed = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true,
      });

      expect(parsed.preserveOnFailure).toBe(false);
    });

    it('should accept explicit true value', () => {
      const parsed = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: true,
      });

      expect(parsed.preserveOnFailure).toBe(true);
    });

    it('should accept explicit false value', () => {
      const parsed = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: false,
      });

      expect(parsed.preserveOnFailure).toBe(false);
    });

    it('should reject non-boolean values', () => {
      const invalidValues = [
        'true', 'false', 'yes', 'no', 1, 0, null, undefined, [], {}
      ];

      for (const invalidValue of invalidValues) {
        expect(() => {
          WorkspaceConfigSchema.parse({
            strategy: 'none',
            cleanup: true,
            preserveOnFailure: invalidValue,
          });
        }).toThrow();
      }
    });
  });

  describe('integration with workspace strategies', () => {
    it('should work with all workspace strategies', () => {
      const strategies = ['worktree', 'container', 'directory', 'none'] as const;

      for (const strategy of strategies) {
        const baseConfig = { strategy, cleanup: true, preserveOnFailure: true };
        const config = strategy === 'container'
          ? { ...baseConfig, container: { image: 'alpine' } }
          : baseConfig;

        const parsed = WorkspaceConfigSchema.parse(config);
        expect(parsed.preserveOnFailure).toBe(true);
        expect(parsed.strategy).toBe(strategy);
      }
    });
  });

  describe('default value behavior', () => {
    it('should consistently apply false default across all strategies', () => {
      const strategies = ['worktree', 'container', 'directory', 'none'] as const;

      for (const strategy of strategies) {
        const baseConfig = { strategy, cleanup: true };
        const config = strategy === 'container'
          ? { ...baseConfig, container: { image: 'alpine' } }
          : baseConfig;

        const parsed = WorkspaceConfigSchema.parse(config);
        expect(parsed.preserveOnFailure).toBe(false);
      }
    });
  });

  describe('validation independence', () => {
    it('should validate preserveOnFailure independently of other fields', () => {
      // Should fail only on preserveOnFailure, not other valid fields
      expect(() => {
        WorkspaceConfigSchema.parse({
          strategy: 'container',
          container: { image: 'valid-image' },
          cleanup: true,
          preserveOnFailure: 'invalid', // Only this field is invalid
        });
      }).toThrow();
    });

    it('should succeed when preserveOnFailure is fixed but other fields remain', () => {
      const parsed = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: { image: 'valid-image' },
        cleanup: true,
        preserveOnFailure: true, // Fixed to valid boolean
      });

      expect(parsed.preserveOnFailure).toBe(true);
      expect(parsed.container?.image).toBe('valid-image');
    });
  });
});