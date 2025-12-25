import { describe, it, expect } from 'vitest';
import { WorktreeConfigSchema } from '../types';

describe('cleanupDelayMs Configuration Tests', () => {
  describe('WorktreeConfigSchema cleanupDelayMs field', () => {
    it('should have correct default value of 0', () => {
      const config = WorktreeConfigSchema.parse({});
      expect(config.cleanupDelayMs).toBe(0);
    });

    it('should accept valid cleanupDelayMs values', () => {
      const testValues = [0, 1, 1000, 5000, 30000, 60000, 300000];

      for (const value of testValues) {
        const config = WorktreeConfigSchema.parse({ cleanupDelayMs: value });
        expect(config.cleanupDelayMs).toBe(value);
      }
    });

    it('should reject negative cleanupDelayMs values', () => {
      const invalidValues = [-1, -100, -1000, -5000];

      for (const value of invalidValues) {
        expect(() => WorktreeConfigSchema.parse({ cleanupDelayMs: value }))
          .toThrow();
      }
    });

    it('should reject non-numeric cleanupDelayMs values', () => {
      const invalidValues = ['1000', '0', 'invalid', true, false, null, undefined, {}, []];

      for (const value of invalidValues) {
        expect(() => WorktreeConfigSchema.parse({ cleanupDelayMs: value }))
          .toThrow();
      }
    });

    it('should work with realistic delay values', () => {
      // Common realistic scenarios
      const scenarios = [
        { name: 'immediate cleanup', value: 0 },
        { name: '1 second delay', value: 1000 },
        { name: '5 second delay', value: 5000 },
        { name: '30 second delay', value: 30000 },
        { name: '1 minute delay', value: 60000 },
        { name: '5 minute delay', value: 300000 },
      ];

      for (const scenario of scenarios) {
        const config = WorktreeConfigSchema.parse({
          cleanupDelayMs: scenario.value,
        });

        expect(config.cleanupDelayMs).toBe(scenario.value);
      }
    });

    it('should work in combination with other WorktreeConfig fields', () => {
      const config = WorktreeConfigSchema.parse({
        baseDir: '/test/worktrees',
        cleanupOnComplete: true,
        maxWorktrees: 10,
        pruneStaleAfterDays: 14,
        preserveOnFailure: false,
        cleanupDelayMs: 5000,
      });

      expect(config.baseDir).toBe('/test/worktrees');
      expect(config.cleanupOnComplete).toBe(true);
      expect(config.maxWorktrees).toBe(10);
      expect(config.pruneStaleAfterDays).toBe(14);
      expect(config.preserveOnFailure).toBe(false);
      expect(config.cleanupDelayMs).toBe(5000);
    });

    it('should maintain correct type information', () => {
      const config = WorktreeConfigSchema.parse({ cleanupDelayMs: 1500 });

      // TypeScript type checking
      expect(typeof config.cleanupDelayMs).toBe('number');
      expect(config.cleanupDelayMs).toBeGreaterThanOrEqual(0);

      // Ensure it's specifically the value we set
      expect(config.cleanupDelayMs).toBe(1500);
    });

    it('should handle edge case values', () => {
      // Test zero (minimum valid value)
      const zeroConfig = WorktreeConfigSchema.parse({ cleanupDelayMs: 0 });
      expect(zeroConfig.cleanupDelayMs).toBe(0);

      // Test very large values (should be valid)
      const largeConfig = WorktreeConfigSchema.parse({ cleanupDelayMs: Number.MAX_SAFE_INTEGER });
      expect(largeConfig.cleanupDelayMs).toBe(Number.MAX_SAFE_INTEGER);

      // Test floating point values (should work with zod number validation)
      const floatConfig = WorktreeConfigSchema.parse({ cleanupDelayMs: 1500.5 });
      expect(floatConfig.cleanupDelayMs).toBe(1500.5);
    });

    it('should work correctly when parsing from JSON configuration', () => {
      const jsonConfig = {
        project: { name: 'test-project' },
        git: {
          autoWorktree: true,
          worktree: {
            cleanupOnComplete: true,
            cleanupDelayMs: 3000,
          },
        },
      };

      // This simulates parsing from a configuration file
      const worktreeConfig = WorktreeConfigSchema.parse(jsonConfig.git.worktree);
      expect(worktreeConfig.cleanupDelayMs).toBe(3000);
      expect(worktreeConfig.cleanupOnComplete).toBe(true);
    });
  });

  describe('cleanupDelayMs validation boundary tests', () => {
    it('should validate minimum boundary (0)', () => {
      expect(() => WorktreeConfigSchema.parse({ cleanupDelayMs: 0 })).not.toThrow();
      expect(() => WorktreeConfigSchema.parse({ cleanupDelayMs: -0.1 })).toThrow();
    });

    it('should handle common delay patterns', () => {
      const commonPatterns = [
        { pattern: 'no delay', ms: 0 },
        { pattern: 'short delay (100ms)', ms: 100 },
        { pattern: 'half second', ms: 500 },
        { pattern: '1 second', ms: 1000 },
        { pattern: '2 seconds', ms: 2000 },
        { pattern: '5 seconds', ms: 5000 },
        { pattern: '10 seconds', ms: 10000 },
        { pattern: '30 seconds', ms: 30000 },
        { pattern: '1 minute', ms: 60000 },
        { pattern: '2 minutes', ms: 120000 },
        { pattern: '5 minutes', ms: 300000 },
        { pattern: '10 minutes', ms: 600000 },
      ];

      for (const { pattern, ms } of commonPatterns) {
        const config = WorktreeConfigSchema.parse({ cleanupDelayMs: ms });
        expect(config.cleanupDelayMs).toBe(ms);
      }
    });

    it('should maintain precision for sub-second delays', () => {
      const subSecondDelays = [1, 10, 50, 100, 250, 500, 750, 999];

      for (const delay of subSecondDelays) {
        const config = WorktreeConfigSchema.parse({ cleanupDelayMs: delay });
        expect(config.cleanupDelayMs).toBe(delay);
      }
    });

    it('should be serializable and deserializable', () => {
      const originalConfig = {
        cleanupDelayMs: 2500,
        maxWorktrees: 3,
        cleanupOnComplete: false,
      };

      // Serialize to JSON and back
      const serialized = JSON.stringify(originalConfig);
      const deserialized = JSON.parse(serialized);

      // Parse with schema
      const config = WorktreeConfigSchema.parse(deserialized);

      expect(config.cleanupDelayMs).toBe(2500);
      expect(config.maxWorktrees).toBe(3);
      expect(config.cleanupOnComplete).toBe(false);
    });
  });
});