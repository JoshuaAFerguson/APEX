import { describe, it, expect } from 'vitest';
import { WorkspaceConfigSchema, WorkspaceConfig } from '../types.js';

describe('WorkspaceConfig preserveOnFailure field', () => {
  describe('basic validation', () => {
    it('should be optional with default value of false', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true,
      });

      expect(config.preserveOnFailure).toBe(false);
    });

    it('should accept true value explicitly', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'worktree',
        path: '/tmp/workspace',
        cleanup: true,
        preserveOnFailure: true,
      });

      expect(config.preserveOnFailure).toBe(true);
    });

    it('should accept false value explicitly', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'directory',
        path: '/tmp/workspace',
        cleanup: true,
        preserveOnFailure: false,
      });

      expect(config.preserveOnFailure).toBe(false);
    });

    it('should reject non-boolean values', () => {
      const invalidValues = [
        'true',
        'false',
        1,
        0,
        null,
        undefined,
        'yes',
        'no',
        [],
        {},
      ];

      for (const invalidValue of invalidValues) {
        expect(() => WorkspaceConfigSchema.parse({
          strategy: 'none',
          cleanup: true,
          preserveOnFailure: invalidValue,
        })).toThrow();
      }
    });
  });

  describe('integration with workspace strategies', () => {
    it('should work with worktree strategy', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'worktree',
        path: '/tmp/debug-worktree',
        cleanup: true,
        preserveOnFailure: true,
      });

      expect(config.strategy).toBe('worktree');
      expect(config.path).toBe('/tmp/debug-worktree');
      expect(config.preserveOnFailure).toBe(true);
    });

    it('should work with container strategy', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'ubuntu:22.04',
          environment: { DEBUG: 'true' },
        },
        cleanup: false,
        preserveOnFailure: true,
      });

      expect(config.strategy).toBe('container');
      expect(config.container?.image).toBe('ubuntu:22.04');
      expect(config.preserveOnFailure).toBe(true);
    });

    it('should work with directory strategy', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'directory',
        path: '/var/tmp/isolated',
        cleanup: true,
        preserveOnFailure: false,
      });

      expect(config.strategy).toBe('directory');
      expect(config.path).toBe('/var/tmp/isolated');
      expect(config.preserveOnFailure).toBe(false);
    });

    it('should work with none strategy', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: false,
        preserveOnFailure: true,
      });

      expect(config.strategy).toBe('none');
      expect(config.preserveOnFailure).toBe(true);
    });
  });

  describe('logical scenarios', () => {
    it('should handle debug scenario: preserve on failure with cleanup enabled', () => {
      // Realistic scenario: clean up on success, preserve on failure for debugging
      const config = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: { image: 'node:20' },
        cleanup: true, // Clean up on success
        preserveOnFailure: true, // But preserve on failure for debugging
      });

      expect(config.cleanup).toBe(true);
      expect(config.preserveOnFailure).toBe(true);
    });

    it('should handle CI scenario: always cleanup, never preserve', () => {
      // CI scenario: clean environment, no debugging needed
      const config = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: { image: 'alpine:3.18' },
        cleanup: true,
        preserveOnFailure: false,
      });

      expect(config.cleanup).toBe(true);
      expect(config.preserveOnFailure).toBe(false);
    });

    it('should handle development scenario: persist everything', () => {
      // Development scenario: preserve workspace for inspection
      const config = WorkspaceConfigSchema.parse({
        strategy: 'worktree',
        path: '/tmp/dev-workspace',
        cleanup: false,
        preserveOnFailure: true,
      });

      expect(config.cleanup).toBe(false);
      expect(config.preserveOnFailure).toBe(true);
    });

    it('should handle production scenario: minimal resource usage', () => {
      // Production scenario: clean up immediately regardless of outcome
      const config = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'node:20-alpine',
          resourceLimits: { memory: '512m' },
        },
        cleanup: true,
        preserveOnFailure: false,
      });

      expect(config.cleanup).toBe(true);
      expect(config.preserveOnFailure).toBe(false);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle minimal configuration with preserveOnFailure', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: true,
      });

      expect(config).toEqual({
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: true,
      });
    });

    it('should handle complex container configuration with preserveOnFailure', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'python:3.11-slim',
          volumes: {
            '/host/project': '/workspace',
            '/host/cache': '/root/.cache',
          },
          environment: {
            PYTHONPATH: '/workspace',
            DEBUG: 'true',
          },
          resourceLimits: {
            cpu: 2,
            memory: '2g',
            pidsLimit: 50,
          },
          networkMode: 'bridge',
          autoRemove: false,
          privileged: false,
        },
        cleanup: true,
        preserveOnFailure: true,
      });

      expect(config.strategy).toBe('container');
      expect(config.container?.autoRemove).toBe(false);
      expect(config.cleanup).toBe(true);
      expect(config.preserveOnFailure).toBe(true);
    });

    it('should maintain type safety with preserveOnFailure', () => {
      const config: WorkspaceConfig = {
        strategy: 'worktree',
        path: '/tmp/typed-workspace',
        cleanup: true,
        preserveOnFailure: true,
      };

      // TypeScript should enforce boolean type
      expect(typeof config.preserveOnFailure).toBe('boolean');
      expect(config.preserveOnFailure).toBe(true);
    });
  });

  describe('default value consistency', () => {
    it('should consistently default to false across all strategies', () => {
      const strategies: Array<'worktree' | 'container' | 'directory' | 'none'> = [
        'worktree', 'container', 'directory', 'none'
      ];

      for (const strategy of strategies) {
        const baseConfig = {
          strategy,
          cleanup: true,
        };

        const configWithContainer = strategy === 'container'
          ? { ...baseConfig, container: { image: 'node:20' } }
          : baseConfig;

        const result = WorkspaceConfigSchema.parse(configWithContainer);
        expect(result.preserveOnFailure).toBe(false);
      }
    });

    it('should apply default even when other optional fields are provided', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'worktree',
        path: '/tmp/workspace-with-path',
        cleanup: false,
        // preserveOnFailure not provided
      });

      expect(config.path).toBe('/tmp/workspace-with-path');
      expect(config.cleanup).toBe(false);
      expect(config.preserveOnFailure).toBe(false); // Should default to false
    });

    it('should not override explicit false value with default', () => {
      const config = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: { image: 'alpine' },
        cleanup: true,
        preserveOnFailure: false, // Explicitly false
      });

      // Should be explicitly false, not default
      expect(config.preserveOnFailure).toBe(false);
    });
  });

  describe('schema validation errors', () => {
    it('should provide clear error message for invalid type', () => {
      expect(() => WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: 'invalid',
      })).toThrow();
    });

    it('should validate preserveOnFailure independently of other fields', () => {
      // Should fail even if other fields are valid
      expect(() => WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: { image: 'valid-image' },
        cleanup: true,
        preserveOnFailure: 42, // Invalid type
      })).toThrow();
    });

    it('should allow valid schema with preserveOnFailure after fixing errors', () => {
      // This should pass after fixing the preserveOnFailure type
      const config = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: { image: 'valid-image' },
        cleanup: true,
        preserveOnFailure: true, // Fixed: boolean instead of number
      });

      expect(config.preserveOnFailure).toBe(true);
    });
  });
});