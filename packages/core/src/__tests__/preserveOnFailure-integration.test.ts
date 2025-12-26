import { describe, it, expect } from 'vitest';
import { WorkspaceConfigSchema, type WorkspaceConfig } from '../types.js';

describe('preserveOnFailure integration scenarios', () => {
  describe('development workflow scenarios', () => {
    it('should support debug-friendly development configuration', () => {
      const devConfig: WorkspaceConfig = {
        strategy: 'container',
        container: {
          image: 'node:20-alpine',
          volumes: {
            '/host/project': '/workspace',
            '/host/node_modules': '/workspace/node_modules',
          },
          environment: {
            NODE_ENV: 'development',
            DEBUG: '*',
          },
          autoRemove: false, // Keep container for inspection
        },
        cleanup: false, // Don't cleanup workspace
        preserveOnFailure: true, // Preserve on failure for debugging
      };

      const result = WorkspaceConfigSchema.parse(devConfig);
      expect(result.preserveOnFailure).toBe(true);
      expect(result.cleanup).toBe(false);
      expect(result.container?.autoRemove).toBe(false);
    });

    it('should support production deployment configuration', () => {
      const prodConfig: WorkspaceConfig = {
        strategy: 'container',
        container: {
          image: 'node:20-alpine',
          environment: {
            NODE_ENV: 'production',
          },
          resourceLimits: {
            cpu: 1,
            memory: '512m',
          },
          autoRemove: true, // Clean up container
        },
        cleanup: true, // Always cleanup workspace
        preserveOnFailure: false, // Don't preserve on failure (save resources)
      };

      const result = WorkspaceConfigSchema.parse(prodConfig);
      expect(result.preserveOnFailure).toBe(false);
      expect(result.cleanup).toBe(true);
      expect(result.container?.autoRemove).toBe(true);
    });

    it('should support CI/CD pipeline configuration', () => {
      const ciConfig: WorkspaceConfig = {
        strategy: 'worktree',
        path: '/tmp/ci-workspace',
        cleanup: true, // Clean up workspace after task
        preserveOnFailure: false, // Don't preserve failures in CI
      };

      const result = WorkspaceConfigSchema.parse(ciConfig);
      expect(result.strategy).toBe('worktree');
      expect(result.preserveOnFailure).toBe(false);
      expect(result.cleanup).toBe(true);
    });

    it('should support debugging CI failures configuration', () => {
      const debugCiConfig: WorkspaceConfig = {
        strategy: 'container',
        container: {
          image: 'ubuntu:22.04',
          volumes: {
            '/tmp/ci-artifacts': '/artifacts',
          },
          environment: {
            CI: 'true',
            DEBUG_MODE: 'true',
          },
        },
        cleanup: true, // Cleanup on success
        preserveOnFailure: true, // But preserve on failure for debugging
      };

      const result = WorkspaceConfigSchema.parse(debugCiConfig);
      expect(result.preserveOnFailure).toBe(true);
      expect(result.cleanup).toBe(true);
    });
  });

  describe('workspace strategy specific behavior', () => {
    it('should handle preserveOnFailure with worktree strategy', () => {
      const worktreeConfig = WorkspaceConfigSchema.parse({
        strategy: 'worktree',
        path: '/tmp/preserved-worktree',
        cleanup: true,
        preserveOnFailure: true,
      });

      expect(worktreeConfig.strategy).toBe('worktree');
      expect(worktreeConfig.path).toBe('/tmp/preserved-worktree');
      expect(worktreeConfig.preserveOnFailure).toBe(true);
    });

    it('should handle preserveOnFailure with directory strategy', () => {
      const dirConfig = WorkspaceConfigSchema.parse({
        strategy: 'directory',
        path: '/var/tmp/preserved-directory',
        cleanup: false,
        preserveOnFailure: true,
      });

      expect(dirConfig.strategy).toBe('directory');
      expect(dirConfig.path).toBe('/var/tmp/preserved-directory');
      expect(dirConfig.preserveOnFailure).toBe(true);
    });

    it('should handle preserveOnFailure with container strategy', () => {
      const containerConfig = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'python:3.11-slim',
          workingDir: '/workspace',
        },
        cleanup: true,
        preserveOnFailure: false,
      });

      expect(containerConfig.strategy).toBe('container');
      expect(containerConfig.container?.image).toBe('python:3.11-slim');
      expect(containerConfig.preserveOnFailure).toBe(false);
    });

    it('should handle preserveOnFailure with none strategy', () => {
      const noneConfig = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: false,
        preserveOnFailure: true,
      });

      expect(noneConfig.strategy).toBe('none');
      expect(noneConfig.preserveOnFailure).toBe(true);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle complex container configuration with preserveOnFailure', () => {
      const complexConfig = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'rust:1.75-alpine',
          dockerfile: 'Dockerfile.debug',
          buildContext: './debug-build',
          volumes: {
            '/host/target': '/workspace/target',
            '/host/registry': '/usr/local/cargo/registry',
          },
          environment: {
            RUST_BACKTRACE: 'full',
            RUST_LOG: 'debug',
            CARGO_HOME: '/usr/local/cargo',
          },
          resourceLimits: {
            cpu: 4,
            memory: '8g',
            pidsLimit: 1000,
          },
          networkMode: 'bridge',
          autoRemove: false,
          privileged: false,
          capAdd: ['SYS_PTRACE'], // For debugging
          securityOpts: ['seccomp:unconfined'],
        },
        cleanup: true,
        preserveOnFailure: true,
      });

      expect(complexConfig.strategy).toBe('container');
      expect(complexConfig.container?.image).toBe('rust:1.75-alpine');
      expect(complexConfig.container?.capAdd).toEqual(['SYS_PTRACE']);
      expect(complexConfig.preserveOnFailure).toBe(true);
      expect(complexConfig.cleanup).toBe(true);
    });

    it('should maintain consistency when both cleanup and preserveOnFailure are false', () => {
      const persistentConfig = WorkspaceConfigSchema.parse({
        strategy: 'directory',
        path: '/opt/persistent-workspace',
        cleanup: false,
        preserveOnFailure: false,
      });

      // Both false means: never cleanup, never preserve specifically on failure
      expect(persistentConfig.cleanup).toBe(false);
      expect(persistentConfig.preserveOnFailure).toBe(false);
    });

    it('should handle minimal configuration with preserveOnFailure override', () => {
      const minimalConfig = WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: true, // Override default
      });

      expect(minimalConfig).toEqual({
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: true,
      });
    });
  });

  describe('field interaction validation', () => {
    it('should validate that preserveOnFailure works independently of cleanup', () => {
      // Test all combinations of cleanup and preserveOnFailure
      const combinations = [
        { cleanup: true, preserveOnFailure: true },
        { cleanup: true, preserveOnFailure: false },
        { cleanup: false, preserveOnFailure: true },
        { cleanup: false, preserveOnFailure: false },
      ];

      for (const { cleanup, preserveOnFailure } of combinations) {
        const config = WorkspaceConfigSchema.parse({
          strategy: 'none',
          cleanup,
          preserveOnFailure,
        });

        expect(config.cleanup).toBe(cleanup);
        expect(config.preserveOnFailure).toBe(preserveOnFailure);
      }
    });

    it('should validate that preserveOnFailure works with all container configurations', () => {
      const containerWithAllOptions = WorkspaceConfigSchema.parse({
        strategy: 'container',
        container: {
          image: 'ubuntu:22.04',
          dockerfile: 'Dockerfile.test',
          buildContext: './context',
          imageTag: 'test:latest',
          volumes: { '/host': '/container' },
          environment: { ENV: 'test' },
          resourceLimits: { cpu: 1, memory: '1g' },
          networkMode: 'host',
          workingDir: '/work',
          user: 'testuser',
          labels: { test: 'true' },
          entrypoint: ['/bin/bash'],
          command: ['-c', 'echo test'],
          autoRemove: true,
          privileged: false,
          securityOpts: ['no-new-privileges:true'],
          capAdd: ['NET_ADMIN'],
          capDrop: ['ALL'],
        },
        cleanup: true,
        preserveOnFailure: false,
      });

      expect(containerWithAllOptions.container?.image).toBe('ubuntu:22.04');
      expect(containerWithAllOptions.preserveOnFailure).toBe(false);
    });
  });

  describe('type safety verification', () => {
    it('should enforce correct TypeScript types', () => {
      // This test mainly ensures TypeScript compilation is correct
      const config: WorkspaceConfig = {
        strategy: 'container',
        container: { image: 'node:20' },
        cleanup: true,
        preserveOnFailure: false,
      };

      expect(typeof config.preserveOnFailure).toBe('boolean');

      // TypeScript should prevent this at compile time:
      // config.preserveOnFailure = 'true'; // Type error
      // config.preserveOnFailure = 1; // Type error
    });

    it('should handle optional preserveOnFailure in type definitions', () => {
      // Test that preserveOnFailure is properly optional in TypeScript
      const configWithoutPreserve: WorkspaceConfig = {
        strategy: 'none',
        cleanup: true,
        // preserveOnFailure omitted - should be allowed by TypeScript
      };

      const configWithPreserve: WorkspaceConfig = {
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: true,
      };

      // Both should be valid WorkspaceConfig types
      expect(configWithoutPreserve.strategy).toBe('none');
      expect(configWithPreserve.preserveOnFailure).toBe(true);
    });
  });
});