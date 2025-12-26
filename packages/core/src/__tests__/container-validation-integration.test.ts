import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, validateContainerWorkspaceConfig } from '../config';
import { ApexConfig } from '../types';
import { containerRuntime } from '../container-runtime';

// Mock the container runtime module
vi.mock('../container-runtime', () => ({
  containerRuntime: {
    detectRuntimes: vi.fn(),
  },
}));

const mockContainerRuntime = vi.mocked(containerRuntime);

describe('Container Validation Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-container-integration-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('End-to-end config loading scenarios', () => {
    it('should successfully load and validate a complete container configuration', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'integration-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            networkMode: 'bridge',
            autoRemove: true,
            resourceLimits: {
              cpu: 2,
              memory: '1g',
            },
            environment: {
              NODE_ENV: 'test',
              API_URL: 'http://localhost:3000',
            },
          },
        },
      };

      mockContainerRuntime.detectRuntimes.mockResolvedValue([
        {
          type: 'docker',
          available: true,
          versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' },
        },
      ]);

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.project.name).toBe('integration-test');
      expect(loadedConfig.workspace?.defaultStrategy).toBe('container');
      expect(loadedConfig.workspace?.container?.image).toBe('node:20-alpine');
      expect(loadedConfig.workspace?.container?.resourceLimits?.cpu).toBe(2);
      expect(loadedConfig.workspace?.container?.resourceLimits?.memory).toBe('1g');
      expect(loadedConfig.workspace?.container?.environment?.NODE_ENV).toBe('test');

      // Should not have any warnings property
      const warnings = Object.getOwnPropertyDescriptor(loadedConfig, '_containerWarnings');
      expect(warnings).toBeUndefined();
    });

    it('should handle configuration with both errors and warnings gracefully', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'mixed-validation-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          // No image specified - should trigger warning
          container: {
            networkMode: 'bridge',
            autoRemove: true,
          },
        },
      };

      // No container runtime available - should trigger error
      mockContainerRuntime.detectRuntimes.mockResolvedValue([
        { type: 'docker', available: false, error: 'Docker not installed' },
        { type: 'podman', available: false, error: 'Podman not installed' },
      ]);

      await saveConfig(testDir, config);

      await expect(loadConfig(testDir)).rejects.toThrow(
        /Container workspace configuration validation failed/
      );
    });

    it('should handle runtime detection timeout gracefully', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'timeout-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'ubuntu:latest',
          },
        },
      };

      // Simulate timeout during runtime detection
      mockContainerRuntime.detectRuntimes.mockRejectedValue(
        new Error('timeout of 10000ms exceeded')
      );

      await saveConfig(testDir, config);

      await expect(loadConfig(testDir)).rejects.toThrow(
        'Container workspace configuration validation failed:\n' +
        'Failed to detect container runtime: timeout of 10000ms exceeded\n' +
        '  Suggestion: Please check your container runtime installation and ensure it is functional.'
      );
    });

    it('should preserve warnings in loaded config object', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'warnings-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: false,
          // No container config - should trigger warning
        },
      };

      mockContainerRuntime.detectRuntimes.mockResolvedValue([
        {
          type: 'docker',
          available: true,
          versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' },
        },
      ]);

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.project.name).toBe('warnings-test');
      expect(loadedConfig.workspace?.cleanupOnComplete).toBe(false);

      // Check that warnings are properly attached
      const warningsProperty = Object.getOwnPropertyDescriptor(loadedConfig, '_containerWarnings');
      expect(warningsProperty).toBeDefined();
      expect(warningsProperty?.enumerable).toBe(false);
      expect(warningsProperty?.writable).toBe(false);
      expect(warningsProperty?.value).toEqual([
        'Container workspace strategy is selected but no default container image is specified.\n' +
        '  Suggestion: Consider setting workspace.container.image to a default image like "node:20-alpine" or "ubuntu:latest" for better task execution reliability.'
      ]);
    });
  });

  describe('Direct validation function tests', () => {
    it('should validate complex workspace configurations correctly', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            networkMode: 'host',
            autoRemove: false,
            privileged: false,
            resourceLimits: {
              cpu: 4,
              memory: '2g',
              memorySwap: '4g',
              cpuShares: 1024,
            },
            environment: {
              NODE_ENV: 'production',
              DEBUG: 'false',
            },
            volumes: {
              '/app': '/workspace',
              '/tmp': '/tmp',
            },
            workingDir: '/workspace',
            user: 'node',
          },
        },
      };

      mockContainerRuntime.detectRuntimes.mockResolvedValue([
        {
          type: 'docker',
          available: true,
          versionInfo: {
            version: '24.0.7',
            fullVersion: 'Docker version 24.0.7, build afdd53b',
            buildInfo: 'afdd53b',
          },
        },
        {
          type: 'podman',
          available: false,
          error: 'Podman not installed',
        },
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });
      expect(mockContainerRuntime.detectRuntimes).toHaveBeenCalledOnce();
    });

    it('should handle partially configured container settings', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'partial-config-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            // Only some container settings provided
            networkMode: 'bridge',
            autoRemove: true,
            environment: {
              NODE_ENV: 'development',
            },
            // No image specified - should trigger warning
          },
        },
      };

      mockContainerRuntime.detectRuntimes.mockResolvedValue([
        {
          type: 'podman',
          available: true,
          versionInfo: { version: '4.7.2', fullVersion: 'podman version 4.7.2' },
        },
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('no_image_specified');
    });

    it('should handle malformed runtime detection responses', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'malformed-response-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'alpine:latest',
          },
        },
      };

      // Mock malformed response (missing required fields)
      mockContainerRuntime.detectRuntimes.mockResolvedValue([
        {
          type: 'docker',
          available: true,
          // Missing versionInfo
        } as any,
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      // Should still pass validation as we only check for available: true
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Error message format verification', () => {
    it('should format multiple errors with proper suggestions', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'multiple-errors-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
        },
      };

      // First, simulate runtime detection throwing error
      mockContainerRuntime.detectRuntimes.mockRejectedValue(
        new Error('Container runtime access denied')
      );

      await saveConfig(testDir, config);

      try {
        await loadConfig(testDir);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Container workspace configuration validation failed:');
        expect(error.message).toContain('Failed to detect container runtime: Container runtime access denied');
        expect(error.message).toContain('Suggestion: Please check your container runtime installation and ensure it is functional.');
      }
    });

    it('should handle config loading errors unrelated to container validation', async () => {
      // Create invalid YAML that should fail before reaching container validation
      const invalidYaml = `
version: 1.0  # Should be string
project:
  name: invalid-config
  unknownField: true
workspace:
  defaultStrategy: invalid_strategy
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidYaml);

      await expect(loadConfig(testDir)).rejects.toThrow();
      // Container runtime detection should not be called due to schema validation failure
      expect(mockContainerRuntime.detectRuntimes).not.toHaveBeenCalled();
    });
  });

  describe('Performance and caching scenarios', () => {
    it('should not call container runtime detection for non-container strategies', async () => {
      const strategies = ['worktree', 'directory', 'none'] as const;

      for (const strategy of strategies) {
        vi.clearAllMocks();

        const config: ApexConfig = {
          version: '1.0',
          project: {
            name: `${strategy}-test`,
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          workspace: {
            defaultStrategy: strategy,
            cleanupOnComplete: true,
          },
        };

        await saveConfig(testDir, config);
        const loadedConfig = await loadConfig(testDir);

        expect(loadedConfig.workspace?.defaultStrategy).toBe(strategy);
        expect(mockContainerRuntime.detectRuntimes).not.toHaveBeenCalled();

        // Verify no warnings are attached
        const warnings = Object.getOwnPropertyDescriptor(loadedConfig, '_containerWarnings');
        expect(warnings).toBeUndefined();
      }
    });

    it('should handle concurrent config loading correctly', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'concurrent-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'node:20-alpine',
          },
        },
      };

      mockContainerRuntime.detectRuntimes.mockResolvedValue([
        {
          type: 'docker',
          available: true,
          versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' },
        },
      ]);

      await saveConfig(testDir, config);

      // Load config multiple times concurrently
      const loadPromises = Array.from({ length: 3 }, () => loadConfig(testDir));
      const loadedConfigs = await Promise.all(loadPromises);

      // All should succeed with same result
      for (const loadedConfig of loadedConfigs) {
        expect(loadedConfig.project.name).toBe('concurrent-test');
        expect(loadedConfig.workspace?.defaultStrategy).toBe('container');
        expect(loadedConfig.workspace?.container?.image).toBe('node:20-alpine');
      }

      // Runtime detection should have been called (exact count may vary due to caching)
      expect(mockContainerRuntime.detectRuntimes).toHaveBeenCalled();
    });
  });
});