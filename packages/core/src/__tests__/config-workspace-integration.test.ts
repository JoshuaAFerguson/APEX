import { ApexConfigSchema } from '../types.js';

describe('Config Workspace Integration', () => {
  describe('ApexConfig with workspace.container defaults', () => {
    it('should parse a complete config with workspace container settings', () => {
      const configData = {
        version: '1.0',
        project: {
          name: 'test-project',
          language: 'typescript',
          framework: 'node',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2.0,
              memory: '2g',
              memoryReservation: '1g',
              cpuShares: 1024,
              pidsLimit: 100,
            },
            networkMode: 'bridge',
            environment: {
              NODE_ENV: 'development',
              DEBUG: 'true',
            },
            autoRemove: true,
            installTimeout: 300000,
          },
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
        },
      };

      const result = ApexConfigSchema.parse(configData);

      // Verify the workspace configuration is properly parsed
      expect(result.workspace).toBeDefined();
      expect(result.workspace?.defaultStrategy).toBe('container');
      expect(result.workspace?.cleanupOnComplete).toBe(true);

      // Verify container defaults
      expect(result.workspace?.container).toBeDefined();
      expect(result.workspace?.container?.image).toBe('node:20-alpine');
      expect(result.workspace?.container?.autoRemove).toBe(true);

      // Verify resource limits
      expect(result.workspace?.container?.resourceLimits).toBeDefined();
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(2.0);
      expect(result.workspace?.container?.resourceLimits?.memory).toBe('2g');
      expect(result.workspace?.container?.resourceLimits?.memoryReservation).toBe('1g');
      expect(result.workspace?.container?.resourceLimits?.cpuShares).toBe(1024);
      expect(result.workspace?.container?.resourceLimits?.pidsLimit).toBe(100);

      // Verify environment variables
      expect(result.workspace?.container?.environment).toEqual({
        NODE_ENV: 'development',
        DEBUG: 'true',
      });
    });

    it('should work with minimal workspace config', () => {
      const minimalConfig = {
        project: {
          name: 'minimal-project',
        },
        workspace: {
          defaultStrategy: 'container',
        },
      };

      const result = ApexConfigSchema.parse(minimalConfig);

      expect(result.workspace?.defaultStrategy).toBe('container');
      expect(result.workspace?.cleanupOnComplete).toBe(true); // default value
      expect(result.workspace?.container).toBeUndefined();
    });

    it('should work with only resource limits specified', () => {
      const resourceLimitsOnlyConfig = {
        project: {
          name: 'resource-limits-project',
        },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 1.5,
              memory: '1g',
            },
          },
        },
      };

      const result = ApexConfigSchema.parse(resourceLimitsOnlyConfig);

      expect(result.workspace?.defaultStrategy).toBe('none'); // default
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(1.5);
      expect(result.workspace?.container?.resourceLimits?.memory).toBe('1g');
      expect(result.workspace?.container?.autoRemove).toBe(true); // default
    });

    it('should maintain backwards compatibility when workspace is not specified', () => {
      const legacyConfig = {
        project: {
          name: 'legacy-project',
        },
        limits: {
          maxTokensPerTask: 50000,
        },
      };

      const result = ApexConfigSchema.parse(legacyConfig);

      expect(result.workspace).toBeUndefined();
      expect(result.project.name).toBe('legacy-project');
      expect(result.limits?.maxTokensPerTask).toBe(50000);
    });

    it('should validate complex real-world configuration', () => {
      const complexConfig = {
        version: '1.0',
        project: {
          name: 'complex-app',
          language: 'typescript',
          framework: 'nextjs',
          testCommand: 'npm test',
          buildCommand: 'npm run build',
          lintCommand: 'npm run lint',
        },
        autonomy: {
          default: 'review-before-merge',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: false, // keep for debugging
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 4,
              memory: '8g',
              memoryReservation: '4g',
              memorySwap: '16g',
              cpuShares: 2048,
              pidsLimit: 200,
            },
            networkMode: 'bridge',
            environment: {
              NODE_ENV: 'test',
              CI: 'true',
              DEBUG: 'apex:*',
              NPM_CONFIG_CACHE: '/tmp/.npm',
            },
            autoRemove: false, // override default for debugging
            installTimeout: 900000, // 15 minutes
          },
        },
        limits: {
          maxTokensPerTask: 200000,
          maxCostPerTask: 15.0,
          dailyBudget: 100.0,
          maxConcurrentTasks: 2,
        },
        git: {
          branchPrefix: 'feature/',
          autoWorktree: true,
          commitAfterSubtask: true,
        },
      };

      const result = ApexConfigSchema.parse(complexConfig);

      // Should parse successfully and maintain all values
      expect(result.workspace?.defaultStrategy).toBe('container');
      expect(result.workspace?.cleanupOnComplete).toBe(false);
      expect(result.workspace?.container?.autoRemove).toBe(false);
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(4);
      expect(result.workspace?.container?.installTimeout).toBe(900000);
      expect(result.limits?.maxTokensPerTask).toBe(200000);
      expect(result.git?.autoWorktree).toBe(true);
    });

    it('should handle edge case values properly', () => {
      const edgeCaseConfig = {
        project: {
          name: 'edge-case-project',
        },
        workspace: {
          defaultStrategy: 'directory', // Different strategy
          container: {
            image: 'ubuntu:22.04', // Different image
            resourceLimits: {
              cpu: 0.1, // Minimum CPU
              memory: '64m', // Small memory
              cpuShares: 2, // Minimum shares
              pidsLimit: 1, // Minimum PIDs
            },
            networkMode: 'none', // No networking
            environment: {}, // Empty environment
          },
        },
      };

      const result = ApexConfigSchema.parse(edgeCaseConfig);

      expect(result.workspace?.defaultStrategy).toBe('directory');
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(0.1);
      expect(result.workspace?.container?.resourceLimits?.memory).toBe('64m');
      expect(result.workspace?.container?.networkMode).toBe('none');
      expect(result.workspace?.container?.environment).toEqual({});
    });
  });

  describe('Type Compilation', () => {
    it('should have correct TypeScript types for workspace config', () => {
      // This test ensures types compile correctly
      const config = ApexConfigSchema.parse({
        project: { name: 'test' },
        workspace: {
          defaultStrategy: 'container',
          container: {
            resourceLimits: {
              cpu: 1,
              memory: '1g',
            },
          },
        },
      });

      // Type checks - these should compile without errors
      const strategy: string = config.workspace?.defaultStrategy ?? 'none';
      const cpu: number | undefined = config.workspace?.container?.resourceLimits?.cpu;
      const memory: string | undefined = config.workspace?.container?.resourceLimits?.memory;
      const cleanup: boolean = config.workspace?.cleanupOnComplete ?? true;

      expect(strategy).toBeDefined();
      expect(typeof cpu).toBe('number');
      expect(typeof memory).toBe('string');
      expect(typeof cleanup).toBe('boolean');
    });
  });
});