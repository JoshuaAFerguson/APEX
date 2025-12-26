import { describe, it, expect } from 'vitest';
import { getEffectiveConfig } from './config';
import { ApexConfig, ApexConfigSchema } from './types';

describe('Config Merging for Container Resource Limits', () => {
  describe('getEffectiveConfig workspace.container defaults', () => {
    it('should apply default workspace container configuration when workspace is undefined', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const effective = getEffectiveConfig(config);

      // Workspace should have defaults
      expect(effective.workspace).toBeDefined();
      expect(effective.workspace.defaultStrategy).toBe('none');
      expect(effective.workspace.cleanupOnComplete).toBe(true);

      // Container defaults should have proper fallbacks
      expect(effective.workspace.container).toBeDefined();
      expect(effective.workspace.container.image).toBeUndefined(); // No default image
      expect(effective.workspace.container.networkMode).toBe('bridge');
      expect(effective.workspace.container.autoRemove).toBe(true);
      expect(effective.workspace.container.resourceLimits).toBeUndefined(); // No default limits
      expect(effective.workspace.container.environment).toBeUndefined(); // No default env
      expect(effective.workspace.container.installTimeout).toBeUndefined(); // No default timeout
    });

    it('should preserve workspace config when provided without container section', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'directory',
          cleanupOnComplete: false,
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.workspace.defaultStrategy).toBe('directory');
      expect(effective.workspace.cleanupOnComplete).toBe(false);

      // Container section should still get defaults
      expect(effective.workspace.container).toBeDefined();
      expect(effective.workspace.container.networkMode).toBe('bridge');
      expect(effective.workspace.container.autoRemove).toBe(true);
    });

    it('should preserve workspace container config when provided', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:18-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '1g',
            },
            environment: {
              NODE_ENV: 'development',
            },
            installTimeout: 300000,
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.workspace.container.image).toBe('node:18-alpine');
      expect(effective.workspace.container.resourceLimits).toEqual({
        cpu: 2,
        memory: '1g',
      });
      expect(effective.workspace.container.environment).toEqual({
        NODE_ENV: 'development',
      });
      expect(effective.workspace.container.installTimeout).toBe(300000);
      // Should still get defaults for unspecified fields
      expect(effective.workspace.container.networkMode).toBe('bridge');
      expect(effective.workspace.container.autoRemove).toBe(true);
    });

    it('should merge partial workspace container config with defaults', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'python:3.11-slim',
            networkMode: 'host',
            // Other fields should get defaults
          },
        },
      };

      const effective = getEffectiveConfig(config);

      // Specified fields preserved
      expect(effective.workspace.container.image).toBe('python:3.11-slim');
      expect(effective.workspace.container.networkMode).toBe('host');

      // Defaults applied for unspecified fields
      expect(effective.workspace.container.autoRemove).toBe(true);
      expect(effective.workspace.container.resourceLimits).toBeUndefined();
      expect(effective.workspace.container.environment).toBeUndefined();
    });

    it('should handle workspace container with complex resourceLimits', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            resourceLimits: {
              cpu: 0.5,
              memory: '512m',
              memoryReservation: '256m',
              memorySwap: '1g',
              cpuShares: 1024,
              pidsLimit: 100,
            },
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.workspace.container.resourceLimits).toEqual({
        cpu: 0.5,
        memory: '512m',
        memoryReservation: '256m',
        memorySwap: '1g',
        cpuShares: 1024,
        pidsLimit: 100,
      });
    });

    it('should handle false values correctly (not apply defaults over explicit false)', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: false,  // Explicit false should be preserved
          container: {
            autoRemove: false,  // Explicit false should be preserved
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.workspace.cleanupOnComplete).toBe(false);
      expect(effective.workspace.container.autoRemove).toBe(false);
      expect(effective.workspace.container.networkMode).toBe('bridge'); // Still get defaults for undefined
    });

    it('should handle container environment variables merging', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          container: {
            environment: {
              NODE_ENV: 'production',
              DEBUG: 'true',
              API_URL: 'https://api.example.com',
            },
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.workspace.container.environment).toEqual({
        NODE_ENV: 'production',
        DEBUG: 'true',
        API_URL: 'https://api.example.com',
      });
    });
  });

  describe('Type validation with workspace container config', () => {
    it('should validate valid workspace container configuration', () => {
      const validConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2.5,
              memory: '2g',
            },
            networkMode: 'bridge',
            environment: {
              NODE_ENV: 'development',
            },
            autoRemove: true,
            installTimeout: 600000,
          },
        },
      };

      // Should not throw
      const result = ApexConfigSchema.parse(validConfig);
      expect(result.workspace?.container?.image).toBe('node:20-alpine');
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(2.5);
    });

    it('should reject invalid memory format in resourceLimits', () => {
      const invalidConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          container: {
            resourceLimits: {
              memory: 'invalid-format', // Invalid memory format
            },
          },
        },
      };

      expect(() => ApexConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid CPU values in resourceLimits', () => {
      const invalidConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          container: {
            resourceLimits: {
              cpu: -1, // Invalid negative CPU
            },
          },
        },
      };

      expect(() => ApexConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid networkMode values', () => {
      const invalidConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          container: {
            networkMode: 'invalid-mode', // Invalid network mode
          },
        },
      };

      expect(() => ApexConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should accept valid networkMode values', () => {
      const modes = ['bridge', 'host', 'none', 'container'];

      modes.forEach((mode) => {
        const config = {
          version: '1.0',
          project: {
            name: 'test-project',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          workspace: {
            container: {
              networkMode: mode,
            },
          },
        };

        const result = ApexConfigSchema.parse(config);
        expect(result.workspace?.container?.networkMode).toBe(mode);
      });
    });

    it('should validate installTimeout as positive number', () => {
      const invalidConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        workspace: {
          container: {
            installTimeout: -1000, // Invalid negative timeout
          },
        },
      };

      expect(() => ApexConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should accept valid memory format patterns', () => {
      const validMemoryFormats = ['256m', '1g', '2048m', '1024k', '2G', '512M'];

      validMemoryFormats.forEach((memory) => {
        const config = {
          version: '1.0',
          project: {
            name: 'test-project',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          workspace: {
            container: {
              resourceLimits: {
                memory,
              },
            },
          },
        };

        const result = ApexConfigSchema.parse(config);
        expect(result.workspace?.container?.resourceLimits?.memory).toBe(memory);
      });
    });
  });
});