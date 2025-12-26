import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  validateContainerWorkspaceConfig,
  loadConfig,
  ContainerValidationError,
  ContainerValidationWarning,
} from '../config';
import { ApexConfig } from '../types';
import { containerRuntime } from '../container-runtime';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock the container runtime
vi.mock('../container-runtime', () => ({
  containerRuntime: {
    detectRuntimes: vi.fn(),
  },
}));

// Mock fs module
vi.mock('fs/promises');

describe('Container Workspace Validation', () => {
  const mockDetectRuntimes = containerRuntime.detectRuntimes as Mock;
  const mockReadFile = fs.readFile as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateContainerWorkspaceConfig', () => {
    it('should return valid result when no workspace config is provided', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
      };

      const result = await validateContainerWorkspaceConfig(config);

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });
    });

    it('should return valid result when workspace strategy is not container', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'worktree',
          cleanupOnComplete: true,
        },
      };

      const result = await validateContainerWorkspaceConfig(config);

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });
    });

    it('should return error when container strategy is selected but no runtime is available', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
        },
      };

      // Mock no available runtimes
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: false, error: 'Docker is not installed' },
        { type: 'podman', available: false, error: 'Podman is not installed' },
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        type: 'missing_runtime',
        message: 'Container workspace strategy is selected but no container runtime (Docker/Podman) is available.',
        suggestion: 'Please install Docker or Podman, or change the workspace strategy to "worktree", "directory", or "none".',
      });
    });

    it('should return error when container runtime detection fails', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
        },
      };

      // Mock runtime detection failure
      mockDetectRuntimes.mockRejectedValue(new Error('Runtime detection failed'));

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        type: 'runtime_not_functional',
        message: 'Failed to detect container runtime: Runtime detection failed',
        suggestion: 'Please check your container runtime installation and ensure it is functional.',
      });
    });

    it('should return warning when container strategy is selected but no image is specified', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
        },
      };

      // Mock available runtime but no image
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: true, versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' } },
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual({
        type: 'no_image_specified',
        message: 'Container workspace strategy is selected but no default container image is specified.',
        suggestion: 'Consider setting workspace.container.image to a default image like "node:20-alpine" or "ubuntu:latest" for better task execution reliability.',
      });
    });

    it('should return valid result when container strategy is properly configured', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            autoRemove: true,
          },
        },
      };

      // Mock available runtime with image
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: true, versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' } },
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });
    });
  });

  describe('loadConfig with container validation', () => {
    const configPath = '/test/project/.apex/config.yaml';

    it('should load config successfully when container validation passes', async () => {
      const yamlContent = `
version: "1.0"
project:
  name: "test-project"
workspace:
  defaultStrategy: "container"
  container:
    image: "node:20-alpine"
`;

      mockReadFile.mockResolvedValue(yamlContent);
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: true, versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' } },
      ]);

      const config = await loadConfig('/test/project');

      expect(config.project.name).toBe('test-project');
      expect(config.workspace?.defaultStrategy).toBe('container');
    });

    it('should throw error when container validation fails', async () => {
      const yamlContent = `
version: "1.0"
project:
  name: "test-project"
workspace:
  defaultStrategy: "container"
`;

      mockReadFile.mockResolvedValue(yamlContent);
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: false, error: 'Docker is not installed' },
        { type: 'podman', available: false, error: 'Podman is not installed' },
      ]);

      await expect(loadConfig('/test/project')).rejects.toThrow(
        'Container workspace configuration validation failed:'
      );
    });

    it('should include warnings in config when container validation has warnings', async () => {
      const yamlContent = `
version: "1.0"
project:
  name: "test-project"
workspace:
  defaultStrategy: "container"
`;

      mockReadFile.mockResolvedValue(yamlContent);
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: true, versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' } },
      ]);

      const config = await loadConfig('/test/project');

      // Check if warnings are attached to the config object
      expect((config as any)._containerWarnings).toBeDefined();
      expect((config as any)._containerWarnings).toHaveLength(1);
      expect((config as any)._containerWarnings[0]).toContain('no default container image is specified');
    });

    it('should handle ENOENT error appropriately', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);

      await expect(loadConfig('/test/project')).rejects.toThrow(
        'APEX not initialized in /test/project. Run \'apex init\' first.'
      );
    });

    it('should handle YAML parsing errors', async () => {
      const invalidYaml = `
version: 1.0
project:
  name: test-project
  invalid: [unclosed array
`;

      mockReadFile.mockResolvedValue(invalidYaml);

      await expect(loadConfig('/test/project')).rejects.toThrow(
        'Failed to load APEX config:'
      );
    });

    it('should handle Zod validation errors for invalid container image format', async () => {
      const yamlContent = `
version: "1.0"
project:
  name: "test-project"
workspace:
  defaultStrategy: "container"
  container:
    image: "INVALID_IMAGE_FORMAT"
`;

      mockReadFile.mockResolvedValue(yamlContent);

      await expect(loadConfig('/test/project')).rejects.toThrow(
        'Failed to load APEX config:'
      );
    });
  });

  describe('Error message formatting', () => {
    it('should format error messages with suggestions properly', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
        },
      };

      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: false, error: 'Docker daemon not running' },
        { type: 'podman', available: false, error: 'Podman not installed' },
      ]);

      try {
        await loadConfig('/test/project');
      } catch (error) {
        expect(error.message).toContain('Container workspace configuration validation failed:');
        expect(error.message).toContain('Container workspace strategy is selected but no container runtime');
        expect(error.message).toContain('Suggestion: Please install Docker or Podman');
      }
    });

    it('should format warning messages with suggestions properly', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
        },
      };

      const yamlContent = `
version: "1.0"
project:
  name: "test-project"
workspace:
  defaultStrategy: "container"
`;

      mockReadFile.mockResolvedValue(yamlContent);
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: true, versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' } },
      ]);

      const loadedConfig = await loadConfig('/test/project');
      const warnings = (loadedConfig as any)._containerWarnings;

      expect(warnings[0]).toContain('no default container image is specified');
      expect(warnings[0]).toContain('Suggestion: Consider setting workspace.container.image');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
        },
      };

      // Mock runtime detection failure with non-Error exception
      mockDetectRuntimes.mockRejectedValue('String error message');

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toEqual({
        type: 'runtime_not_functional',
        message: 'Failed to detect container runtime: String error message',
        suggestion: 'Please check your container runtime installation and ensure it is functional.',
      });
    });

    it('should handle mixed runtime availability scenarios', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'ubuntu:latest',
          },
        },
      };

      // Docker unavailable but Podman available
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: false, error: 'Docker daemon not running' },
        { type: 'podman', available: true, versionInfo: { version: '4.7.2', fullVersion: 'podman version 4.7.2' } },
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle runtime detection returning empty array', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
        },
      };

      // No runtimes detected
      mockDetectRuntimes.mockResolvedValue([]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('missing_runtime');
    });
  });

  describe('Additional edge cases', () => {
    it('should handle container config with empty image string', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: '', // Empty string should trigger warning
          },
        },
      };

      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: true, versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' } },
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('no_image_specified');
    });

    it('should handle container config with missing container object', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          // container object is undefined
        },
      };

      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: true, versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' } },
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('no_image_specified');
    });

    it('should pass validation when both runtimes are available', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
          },
        },
      };

      // Both Docker and Podman available
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: true, versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' } },
        { type: 'podman', available: true, versionInfo: { version: '4.7.2', fullVersion: 'podman version 4.7.2' } },
      ]);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle validation with timeout or network errors', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
        },
      };

      // Simulate timeout error
      const timeoutError = new Error('Command timed out');
      mockDetectRuntimes.mockRejectedValue(timeoutError);

      const result = await validateContainerWorkspaceConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('runtime_not_functional');
      expect(result.errors[0].message).toContain('Command timed out');
    });
  });

  describe('Integration with full config loading', () => {
    it('should properly handle config with warnings during complete load cycle', async () => {
      const yamlContent = `
version: "1.0"
project:
  name: "integration-test"
  testCommand: "npm test"
  lintCommand: "npm run lint"
  buildCommand: "npm run build"
workspace:
  defaultStrategy: "container"
  cleanupOnComplete: true
  container:
    networkMode: "bridge"
    autoRemove: true
`;

      mockReadFile.mockResolvedValue(yamlContent);
      mockDetectRuntimes.mockResolvedValue([
        { type: 'docker', available: true, versionInfo: { version: '24.0.7', fullVersion: 'Docker version 24.0.7' } },
      ]);

      const config = await loadConfig('/test/project');

      expect(config.project.name).toBe('integration-test');
      expect(config.workspace?.defaultStrategy).toBe('container');
      expect(config.workspace?.container?.networkMode).toBe('bridge');

      // Verify warnings are attached
      const warnings = (config as any)._containerWarnings;
      expect(warnings).toBeDefined();
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('no default container image is specified');
    });

    it('should handle config without workspace section', async () => {
      const yamlContent = `
version: "1.0"
project:
  name: "no-workspace-test"
  testCommand: "npm test"
  lintCommand: "npm run lint"
  buildCommand: "npm run build"
`;

      mockReadFile.mockResolvedValue(yamlContent);

      const config = await loadConfig('/test/project');

      expect(config.project.name).toBe('no-workspace-test');
      expect(config.workspace).toBeUndefined();

      // Verify no warnings are attached
      const warnings = (config as any)._containerWarnings;
      expect(warnings).toBeUndefined();

      // Verify container runtime detection was not called
      expect(mockDetectRuntimes).not.toHaveBeenCalled();
    });
  });
});