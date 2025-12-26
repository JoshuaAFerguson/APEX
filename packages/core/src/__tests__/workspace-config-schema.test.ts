import {
  ApexConfigSchema,
  WorkspaceDefaultsSchema,
  ContainerDefaultsSchema,
  ResourceLimitsSchema,
  WorkspaceStrategySchema,
  ContainerNetworkModeSchema,
} from '../types.js';

describe('Workspace Container Config Schema', () => {
  describe('ResourceLimitsSchema', () => {
    it('should validate valid resource limits', () => {
      const validResourceLimits = {
        cpu: 2.5,
        memory: '1g',
        memoryReservation: '512m',
        memorySwap: '2g',
        cpuShares: 1024,
        pidsLimit: 100,
      };

      expect(() => ResourceLimitsSchema.parse(validResourceLimits)).not.toThrow();
    });

    it('should accept empty resource limits object', () => {
      expect(() => ResourceLimitsSchema.parse({})).not.toThrow();
    });

    it('should validate CPU limits within range', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.1 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 64 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.05 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 65 })).toThrow();
    });

    it('should validate memory format with unit suffixes', () => {
      // Valid formats
      expect(() => ResourceLimitsSchema.parse({ memory: '256m' })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ memory: '1G' })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ memory: '1024k' })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ memory: '2048' })).not.toThrow();

      // Invalid formats
      expect(() => ResourceLimitsSchema.parse({ memory: '256mb' })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ memory: 'invalid' })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ memory: '' })).toThrow();
    });

    it('should validate CPU shares within range', () => {
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 2 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262144 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 1 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262145 })).toThrow();
    });

    it('should validate PIDs limit is positive', () => {
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 1 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 1000 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 0 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: -1 })).toThrow();
    });
  });

  describe('ContainerDefaultsSchema', () => {
    it('should validate complete container defaults configuration', () => {
      const validConfig = {
        image: 'node:20-alpine',
        resourceLimits: {
          cpu: 2,
          memory: '1g',
        },
        networkMode: 'bridge' as const,
        environment: {
          NODE_ENV: 'development',
          DEBUG: 'true',
        },
        autoRemove: true,
        installTimeout: 300000,
      };

      const result = ContainerDefaultsSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should accept empty container defaults', () => {
      const result = ContainerDefaultsSchema.parse({});
      expect(result.autoRemove).toBe(true); // should apply default
    });

    it('should validate network mode enum values', () => {
      expect(() => ContainerDefaultsSchema.parse({ networkMode: 'bridge' })).not.toThrow();
      expect(() => ContainerDefaultsSchema.parse({ networkMode: 'host' })).not.toThrow();
      expect(() => ContainerDefaultsSchema.parse({ networkMode: 'none' })).not.toThrow();
      expect(() => ContainerDefaultsSchema.parse({ networkMode: 'container' })).not.toThrow();
      expect(() => ContainerDefaultsSchema.parse({ networkMode: 'invalid' })).toThrow();
    });

    it('should validate install timeout is positive', () => {
      expect(() => ContainerDefaultsSchema.parse({ installTimeout: 1 })).not.toThrow();
      expect(() => ContainerDefaultsSchema.parse({ installTimeout: 300000 })).not.toThrow();
      expect(() => ContainerDefaultsSchema.parse({ installTimeout: 0 })).toThrow();
      expect(() => ContainerDefaultsSchema.parse({ installTimeout: -1 })).toThrow();
    });

    it('should apply autoRemove default value', () => {
      const result = ContainerDefaultsSchema.parse({});
      expect(result.autoRemove).toBe(true);

      const resultWithFalse = ContainerDefaultsSchema.parse({ autoRemove: false });
      expect(resultWithFalse.autoRemove).toBe(false);
    });

    it('should validate environment variables as string record', () => {
      const validEnv = { NODE_ENV: 'test', PORT: '3000' };
      expect(() => ContainerDefaultsSchema.parse({ environment: validEnv })).not.toThrow();

      // Invalid environment (number values)
      expect(() => ContainerDefaultsSchema.parse({
        environment: { PORT: 3000 }
      })).toThrow();
    });
  });

  describe('WorkspaceDefaultsSchema', () => {
    it('should validate complete workspace defaults configuration', () => {
      const validConfig = {
        defaultStrategy: 'container' as const,
        cleanupOnComplete: false,
        container: {
          image: 'ubuntu:22.04',
          resourceLimits: {
            cpu: 1.5,
            memory: '2g',
            pidsLimit: 50,
          },
          networkMode: 'host' as const,
          autoRemove: true,
        },
      };

      const result = WorkspaceDefaultsSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should apply default values correctly', () => {
      const result = WorkspaceDefaultsSchema.parse({});
      expect(result.defaultStrategy).toBe('none');
      expect(result.cleanupOnComplete).toBe(true);
      expect(result.container).toBeUndefined();
    });

    it('should validate workspace strategy enum values', () => {
      expect(() => WorkspaceDefaultsSchema.parse({ defaultStrategy: 'none' })).not.toThrow();
      expect(() => WorkspaceDefaultsSchema.parse({ defaultStrategy: 'worktree' })).not.toThrow();
      expect(() => WorkspaceDefaultsSchema.parse({ defaultStrategy: 'container' })).not.toThrow();
      expect(() => WorkspaceDefaultsSchema.parse({ defaultStrategy: 'directory' })).not.toThrow();
      expect(() => WorkspaceDefaultsSchema.parse({ defaultStrategy: 'invalid' })).toThrow();
    });

    it('should accept optional container configuration', () => {
      const withContainer = WorkspaceDefaultsSchema.parse({
        container: { image: 'node:20' }
      });
      expect(withContainer.container?.image).toBe('node:20');

      const withoutContainer = WorkspaceDefaultsSchema.parse({});
      expect(withoutContainer.container).toBeUndefined();
    });
  });

  describe('ApexConfig Integration', () => {
    it('should include workspace config in ApexConfig schema', () => {
      const validApexConfig = {
        project: {
          name: 'test-project',
        },
        workspace: {
          defaultStrategy: 'container' as const,
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '1g',
              cpuShares: 1024,
            },
            environment: {
              NODE_ENV: 'development',
            },
          },
        },
      };

      expect(() => ApexConfigSchema.parse(validApexConfig)).not.toThrow();

      const result = ApexConfigSchema.parse(validApexConfig);
      expect(result.workspace?.defaultStrategy).toBe('container');
      expect(result.workspace?.container?.image).toBe('node:20-alpine');
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(2);
    });

    it('should work without workspace config in ApexConfig', () => {
      const minimalConfig = {
        project: {
          name: 'test-project',
        },
      };

      const result = ApexConfigSchema.parse(minimalConfig);
      expect(result.workspace).toBeUndefined();
    });

    it('should apply all default values in nested configuration', () => {
      const configWithDefaults = {
        project: {
          name: 'test-project',
        },
        workspace: {
          container: {},
        },
      };

      const result = ApexConfigSchema.parse(configWithDefaults);
      expect(result.workspace?.defaultStrategy).toBe('none');
      expect(result.workspace?.cleanupOnComplete).toBe(true);
      expect(result.workspace?.container?.autoRemove).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined values appropriately', () => {
      // These should work (optional fields)
      expect(() => WorkspaceDefaultsSchema.parse({ container: undefined })).not.toThrow();
      expect(() => ContainerDefaultsSchema.parse({ resourceLimits: undefined })).not.toThrow();

      // These should fail (null is not valid for our schemas)
      expect(() => ResourceLimitsSchema.parse(null)).toThrow();
      expect(() => ContainerDefaultsSchema.parse(null)).toThrow();
    });

    it('should validate complex resource limit combinations', () => {
      const complexResourceLimits = {
        cpu: 0.5,
        memory: '512m',
        memoryReservation: '256m',
        memorySwap: '1g',
        cpuShares: 512,
        pidsLimit: 25,
      };

      expect(() => ResourceLimitsSchema.parse(complexResourceLimits)).not.toThrow();
    });

    it('should reject invalid type combinations', () => {
      // CPU as string (should be number)
      expect(() => ResourceLimitsSchema.parse({ cpu: '2' })).toThrow();

      // Memory as number (should be string with unit)
      expect(() => ResourceLimitsSchema.parse({ memory: 1024 })).toThrow();

      // Environment with non-string values
      expect(() => ContainerDefaultsSchema.parse({
        environment: { count: 5, enabled: true }
      })).toThrow();
    });

    it('should handle very large and very small valid values', () => {
      const edgeCaseConfig = {
        cpu: 64, // Maximum
        memory: '999999999k', // Very large memory
        cpuShares: 262144, // Maximum
        pidsLimit: 1, // Minimum
      };

      expect(() => ResourceLimitsSchema.parse(edgeCaseConfig)).not.toThrow();
    });
  });

  describe('Real-world Configuration Examples', () => {
    it('should validate typical Node.js development configuration', () => {
      const nodeConfig = {
        defaultStrategy: 'container' as const,
        cleanupOnComplete: true,
        container: {
          image: 'node:20-alpine',
          resourceLimits: {
            cpu: 2,
            memory: '2g',
          },
          environment: {
            NODE_ENV: 'development',
            NPM_CONFIG_CACHE: '/tmp/.npm',
          },
          autoRemove: true,
          installTimeout: 600000, // 10 minutes
        },
      };

      expect(() => WorkspaceDefaultsSchema.parse(nodeConfig)).not.toThrow();
    });

    it('should validate typical Python development configuration', () => {
      const pythonConfig = {
        defaultStrategy: 'container' as const,
        container: {
          image: 'python:3.11-slim',
          resourceLimits: {
            cpu: 1.5,
            memory: '1g',
            memoryReservation: '512m',
          },
          environment: {
            PYTHONUNBUFFERED: '1',
            PIP_NO_CACHE_DIR: '1',
          },
          networkMode: 'bridge' as const,
        },
      };

      expect(() => WorkspaceDefaultsSchema.parse(pythonConfig)).not.toThrow();
    });

    it('should validate lightweight container configuration', () => {
      const lightweightConfig = {
        defaultStrategy: 'container' as const,
        container: {
          image: 'alpine:3.18',
          resourceLimits: {
            cpu: 0.25,
            memory: '128m',
            cpuShares: 256,
            pidsLimit: 10,
          },
          autoRemove: true,
        },
      };

      expect(() => WorkspaceDefaultsSchema.parse(lightweightConfig)).not.toThrow();
    });
  });
});