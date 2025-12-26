import { describe, it, expect } from 'vitest';
import {
  ApexConfigSchema,
  ContainerDefaultsSchema,
  WorkspaceConfigSchema,
  ResourceLimitsSchema,
  ContainerConfigSchema,
  ApexConfig,
  WorkspaceConfig,
  ContainerConfig,
} from '../types';
import { getEffectiveConfig } from '../config';

describe('Container Resource Limits Configuration Tests', () => {
  describe('Schema validation for workspace.container defaults', () => {
    describe('ResourceLimitsSchema validation', () => {
      it('should validate correct CPU limits', () => {
        const validCpuLimits = [
          { cpu: 0.1 },
          { cpu: 1 },
          { cpu: 2.5 },
          { cpu: 64 },
        ];

        for (const limit of validCpuLimits) {
          expect(() => ResourceLimitsSchema.parse(limit)).not.toThrow();
        }
      });

      it('should reject invalid CPU limits', () => {
        const invalidCpuLimits = [
          { cpu: 0 },      // Below minimum
          { cpu: 0.05 },   // Below minimum
          { cpu: 65 },     // Above maximum
          { cpu: -1 },     // Negative
        ];

        for (const limit of invalidCpuLimits) {
          expect(() => ResourceLimitsSchema.parse(limit)).toThrow();
        }
      });

      it('should validate correct memory formats', () => {
        const validMemoryFormats = [
          { memory: '256m' },
          { memory: '1g' },
          { memory: '2048M' },
          { memory: '1G' },
          { memory: '512k' },
          { memory: '1024K' },
          { memory: '1024' },
        ];

        for (const memory of validMemoryFormats) {
          expect(() => ResourceLimitsSchema.parse(memory)).not.toThrow();
        }
      });

      it('should reject invalid memory formats', () => {
        const invalidMemoryFormats = [
          { memory: '256' },       // No unit (invalid without k/m/g)
          { memory: '256mb' },     // Invalid unit
          { memory: '1.5g' },      // Decimal not allowed in regex
          { memory: 'invalid' },   // Non-numeric
          { memory: '256t' },      // Invalid unit
        ];

        for (const memory of invalidMemoryFormats) {
          expect(() => ResourceLimitsSchema.parse(memory)).toThrow();
        }
      });

      it('should validate CPU shares range', () => {
        const validShares = [
          { cpuShares: 2 },
          { cpuShares: 1024 },
          { cpuShares: 262144 },
        ];

        for (const shares of validShares) {
          expect(() => ResourceLimitsSchema.parse(shares)).not.toThrow();
        }

        const invalidShares = [
          { cpuShares: 1 },      // Below minimum
          { cpuShares: 262145 }, // Above maximum
          { cpuShares: 0 },      // Below minimum
        ];

        for (const shares of invalidShares) {
          expect(() => ResourceLimitsSchema.parse(shares)).toThrow();
        }
      });

      it('should validate complex resource limits configuration', () => {
        const complexConfig = {
          cpu: 2.5,
          memory: '2g',
          memoryReservation: '1g',
          memorySwap: '4g',
          cpuShares: 2048,
          pidsLimit: 500,
        };

        expect(() => ResourceLimitsSchema.parse(complexConfig)).not.toThrow();
        const parsed = ResourceLimitsSchema.parse(complexConfig);
        expect(parsed.cpu).toBe(2.5);
        expect(parsed.memory).toBe('2g');
        expect(parsed.cpuShares).toBe(2048);
        expect(parsed.pidsLimit).toBe(500);
      });
    });

    describe('ContainerDefaultsSchema validation', () => {
      it('should validate minimal container defaults', () => {
        const minimalDefaults = {};
        expect(() => ContainerDefaultsSchema.parse(minimalDefaults)).not.toThrow();

        const parsed = ContainerDefaultsSchema.parse(minimalDefaults);
        expect(parsed.autoRemove).toBe(true); // Default value
      });

      it('should validate full container defaults', () => {
        const fullDefaults = {
          image: 'node:18-alpine',
          resourceLimits: {
            cpu: 2,
            memory: '1g',
            cpuShares: 1024,
          },
          networkMode: 'host' as const,
          environment: {
            NODE_ENV: 'development',
            DEBUG: 'true',
          },
          autoRemove: false,
          installTimeout: 300000,
        };

        expect(() => ContainerDefaultsSchema.parse(fullDefaults)).not.toThrow();
        const parsed = ContainerDefaultsSchema.parse(fullDefaults);

        expect(parsed.image).toBe('node:18-alpine');
        expect(parsed.resourceLimits?.cpu).toBe(2);
        expect(parsed.networkMode).toBe('host');
        expect(parsed.autoRemove).toBe(false);
        expect(parsed.installTimeout).toBe(300000);
      });

      it('should apply correct defaults for container configuration', () => {
        const partialConfig = {
          resourceLimits: {
            cpu: 1,
            memory: '512m',
          },
        };

        const parsed = ContainerDefaultsSchema.parse(partialConfig);

        expect(parsed.autoRemove).toBe(true); // Default
        expect(parsed.resourceLimits?.cpu).toBe(1);
        expect(parsed.resourceLimits?.memory).toBe('512m');
        expect(parsed.networkMode).toBeUndefined(); // Not set
      });
    });

    describe('ApexConfigSchema workspace validation', () => {
      it('should validate complete ApexConfig with workspace container defaults', () => {
        const config: ApexConfig = {
          version: '1.0',
          project: {
            name: 'test-project',
          },
          workspace: {
            defaultStrategy: 'container',
            cleanupOnComplete: true,
            container: {
              image: 'node:18',
              resourceLimits: {
                cpu: 2,
                memory: '1g',
              },
              networkMode: 'bridge',
              autoRemove: true,
            },
          },
        };

        expect(() => ApexConfigSchema.parse(config)).not.toThrow();
        const parsed = ApexConfigSchema.parse(config);

        expect(parsed.workspace?.container?.resourceLimits?.cpu).toBe(2);
        expect(parsed.workspace?.container?.resourceLimits?.memory).toBe('1g');
        expect(parsed.workspace?.container?.networkMode).toBe('bridge');
      });
    });
  });

  describe('Config merging precedence (task overrides global)', () => {
    it('should demonstrate task-level config overriding global workspace defaults', () => {
      const globalConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'node:18',
            resourceLimits: {
              cpu: 1,
              memory: '512m',
            },
            networkMode: 'bridge',
            autoRemove: true,
          },
        },
      };

      const taskConfig: WorkspaceConfig = {
        strategy: 'container',
        cleanup: false,
        container: {
          image: 'node:20-alpine',
          resourceLimits: {
            cpu: 4, // Override global CPU
            memory: '2g', // Override global memory
            pidsLimit: 200,
          },
          networkMode: 'host', // Override global network mode
          autoRemove: false, // Override global autoRemove
          volumes: {
            '/host/data': '/container/data',
          },
        } as ContainerConfig,
      };

      // Simulate task-level override by merging configurations
      const effectiveTaskConfig = {
        ...globalConfig.workspace?.container,
        ...taskConfig.container,
        resourceLimits: {
          ...globalConfig.workspace?.container?.resourceLimits,
          ...taskConfig.container?.resourceLimits,
        },
      };

      expect(effectiveTaskConfig.image).toBe('node:20-alpine'); // Task override
      expect(effectiveTaskConfig.resourceLimits?.cpu).toBe(4); // Task override
      expect(effectiveTaskConfig.resourceLimits?.memory).toBe('2g'); // Task override
      expect(effectiveTaskConfig.resourceLimits?.pidsLimit).toBe(200); // Task addition
      expect(effectiveTaskConfig.networkMode).toBe('host'); // Task override
      expect(effectiveTaskConfig.autoRemove).toBe(false); // Task override
      expect(effectiveTaskConfig.volumes).toEqual({ '/host/data': '/container/data' }); // Task addition
    });

    it('should preserve global defaults when task config is partial', () => {
      const globalConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'node:18',
            resourceLimits: {
              cpu: 2,
              memory: '1g',
              cpuShares: 1024,
            },
            networkMode: 'bridge',
            autoRemove: true,
            environment: {
              NODE_ENV: 'production',
              LOG_LEVEL: 'info',
            },
          },
        },
      };

      const partialTaskConfig: WorkspaceConfig = {
        strategy: 'container',
        cleanup: true,
        container: {
          image: 'node:18', // Same as global
          resourceLimits: {
            memory: '2g', // Override only memory, keep CPU and cpuShares from global
          },
          environment: {
            NODE_ENV: 'development', // Override only NODE_ENV
          },
        } as ContainerConfig,
      };

      // Simulate proper merging that preserves global defaults
      const effectiveTaskConfig = {
        ...globalConfig.workspace?.container,
        ...partialTaskConfig.container,
        resourceLimits: {
          ...globalConfig.workspace?.container?.resourceLimits,
          ...partialTaskConfig.container?.resourceLimits,
        },
        environment: {
          ...globalConfig.workspace?.container?.environment,
          ...partialTaskConfig.container?.environment,
        },
      };

      expect(effectiveTaskConfig.resourceLimits?.cpu).toBe(2); // From global
      expect(effectiveTaskConfig.resourceLimits?.memory).toBe('2g'); // From task override
      expect(effectiveTaskConfig.resourceLimits?.cpuShares).toBe(1024); // From global
      expect(effectiveTaskConfig.networkMode).toBe('bridge'); // From global
      expect(effectiveTaskConfig.environment?.NODE_ENV).toBe('development'); // From task
      expect(effectiveTaskConfig.environment?.LOG_LEVEL).toBe('info'); // From global
    });

    it('should handle complex precedence scenarios', () => {
      const globalConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'complex-test' },
        workspace: {
          defaultStrategy: 'container',
          container: {
            resourceLimits: {
              cpu: 1,
              memory: '512m',
              cpuShares: 512,
              pidsLimit: 100,
            },
            networkMode: 'bridge',
            autoRemove: true,
            securityOpts: ['no-new-privileges'],
            capAdd: ['NET_ADMIN'],
          },
        },
      };

      // High-performance task that needs more resources
      const highPerfTaskConfig: Partial<ContainerConfig> = {
        resourceLimits: {
          cpu: 8, // Much higher CPU
          memory: '4g', // Much more memory
          // Keep global cpuShares and pidsLimit
        },
        // Override security settings for performance
        securityOpts: [],
        capAdd: ['SYS_ADMIN', 'NET_ADMIN'],
      };

      const effectiveConfig = {
        ...globalConfig.workspace?.container,
        ...highPerfTaskConfig,
        resourceLimits: {
          ...globalConfig.workspace?.container?.resourceLimits,
          ...highPerfTaskConfig.resourceLimits,
        },
      };

      expect(effectiveConfig.resourceLimits?.cpu).toBe(8); // Task override
      expect(effectiveConfig.resourceLimits?.memory).toBe('4g'); // Task override
      expect(effectiveConfig.resourceLimits?.cpuShares).toBe(512); // Global preserved
      expect(effectiveConfig.resourceLimits?.pidsLimit).toBe(100); // Global preserved
      expect(effectiveConfig.networkMode).toBe('bridge'); // Global preserved
      expect(effectiveConfig.securityOpts).toEqual([]); // Task override
      expect(effectiveConfig.capAdd).toEqual(['SYS_ADMIN', 'NET_ADMIN']); // Task override
    });
  });

  describe('getEffectiveConfig includes workspace section', () => {
    it('should include workspace section when missing from input config', () => {
      const minimalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'minimal-test',
        },
      };

      const effective = getEffectiveConfig(minimalConfig);

      expect(effective.workspace).toBeDefined();
      expect(effective.workspace.defaultStrategy).toBe('none');
      expect(effective.workspace.cleanupOnComplete).toBe(true);
      expect(effective.workspace.container).toBeDefined();
      expect(effective.workspace.container.networkMode).toBe('bridge');
      expect(effective.workspace.container.autoRemove).toBe(true);
      expect(effective.workspace.container.resourceLimits).toBeUndefined(); // Not set by default
    });

    it('should preserve workspace section when present in input config', () => {
      const configWithWorkspace: ApexConfig = {
        version: '1.0',
        project: {
          name: 'workspace-test',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: false,
          container: {
            image: 'node:18-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '1g',
            },
            networkMode: 'host',
            autoRemove: false,
          },
        },
      };

      const effective = getEffectiveConfig(configWithWorkspace);

      expect(effective.workspace.defaultStrategy).toBe('container');
      expect(effective.workspace.cleanupOnComplete).toBe(false);
      expect(effective.workspace.container.image).toBe('node:18-alpine');
      expect(effective.workspace.container.resourceLimits?.cpu).toBe(2);
      expect(effective.workspace.container.resourceLimits?.memory).toBe('1g');
      expect(effective.workspace.container.networkMode).toBe('host');
      expect(effective.workspace.container.autoRemove).toBe(false);
    });

    it('should merge partial workspace configurations with defaults', () => {
      const partialWorkspaceConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'partial-workspace-test',
        },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 4,
              memory: '2g',
            },
          },
        },
      };

      const effective = getEffectiveConfig(partialWorkspaceConfig);

      // Explicit values should be preserved
      expect(effective.workspace.container.resourceLimits?.cpu).toBe(4);
      expect(effective.workspace.container.resourceLimits?.memory).toBe('2g');

      // Defaults should be applied for missing values
      expect(effective.workspace.defaultStrategy).toBe('none'); // Default
      expect(effective.workspace.cleanupOnComplete).toBe(true); // Default
      expect(effective.workspace.container.networkMode).toBe('bridge'); // Default
      expect(effective.workspace.container.autoRemove).toBe(true); // Default
      expect(effective.workspace.container.image).toBeUndefined(); // Not set
    });

    it('should handle deep partial workspace container configuration', () => {
      const deepPartialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'deep-partial-test',
        },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 1.5, // Only set CPU, no memory or other limits
            },
            environment: {
              NODE_ENV: 'development',
            },
            // Missing networkMode, autoRemove, etc.
          },
        },
      };

      const effective = getEffectiveConfig(deepPartialConfig);

      // Should preserve the explicitly set values
      expect(effective.workspace.container.resourceLimits?.cpu).toBe(1.5);
      expect(effective.workspace.container.environment?.NODE_ENV).toBe('development');

      // Should not have values that weren't set
      expect(effective.workspace.container.resourceLimits?.memory).toBeUndefined();
      expect(effective.workspace.container.resourceLimits?.cpuShares).toBeUndefined();

      // Should apply defaults for missing top-level container properties
      expect(effective.workspace.container.networkMode).toBe('bridge');
      expect(effective.workspace.container.autoRemove).toBe(true);
    });

    it('should maintain type safety for all workspace configuration paths', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'type-safety-test' },
        workspace: {
          defaultStrategy: 'directory',
          cleanupOnComplete: true,
          container: {
            image: 'ubuntu:22.04',
            resourceLimits: {
              cpu: 3.5,
              memory: '3g',
              memoryReservation: '1g',
              memorySwap: '6g',
              cpuShares: 2048,
              pidsLimit: 300,
            },
            networkMode: 'none',
            workingDir: '/app',
            user: '1000:1000',
            environment: {
              PATH: '/usr/local/bin:/usr/bin:/bin',
              HOME: '/home/user',
            },
            autoRemove: false,
            privileged: false,
            installTimeout: 600000,
          },
        },
      };

      const effective = getEffectiveConfig(config);

      // Verify all types are preserved correctly
      expect(typeof effective.workspace.defaultStrategy).toBe('string');
      expect(typeof effective.workspace.cleanupOnComplete).toBe('boolean');
      expect(typeof effective.workspace.container.resourceLimits?.cpu).toBe('number');
      expect(typeof effective.workspace.container.resourceLimits?.memory).toBe('string');
      expect(typeof effective.workspace.container.resourceLimits?.cpuShares).toBe('number');
      expect(typeof effective.workspace.container.resourceLimits?.pidsLimit).toBe('number');
      expect(typeof effective.workspace.container.networkMode).toBe('string');
      expect(typeof effective.workspace.container.autoRemove).toBe('boolean');
      expect(typeof effective.workspace.container.installTimeout).toBe('number');
      expect(typeof effective.workspace.container.environment).toBe('object');

      // Verify exact values are maintained
      expect(effective.workspace.container.resourceLimits?.cpu).toBe(3.5);
      expect(effective.workspace.container.resourceLimits?.memory).toBe('3g');
      expect(effective.workspace.container.resourceLimits?.memoryReservation).toBe('1g');
      expect(effective.workspace.container.resourceLimits?.memorySwap).toBe('6g');
      expect(effective.workspace.container.resourceLimits?.cpuShares).toBe(2048);
      expect(effective.workspace.container.resourceLimits?.pidsLimit).toBe(300);
    });
  });

  describe('Integration test scenarios', () => {
    it('should validate complete workflow from schema to effective config', () => {
      // Step 1: Define a realistic configuration
      const realWorldConfig = {
        version: '1.0',
        project: {
          name: 'microservice-api',
          language: 'typescript',
          framework: 'fastify',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:18-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '1g',
              cpuShares: 1024,
              pidsLimit: 200,
            },
            networkMode: 'bridge',
            environment: {
              NODE_ENV: 'development',
              PORT: '3000',
            },
            autoRemove: true,
            installTimeout: 120000,
          },
        },
      };

      // Step 2: Validate against schema
      expect(() => ApexConfigSchema.parse(realWorldConfig)).not.toThrow();
      const validatedConfig = ApexConfigSchema.parse(realWorldConfig);

      // Step 3: Get effective configuration
      const effectiveConfig = getEffectiveConfig(validatedConfig);

      // Step 4: Verify all paths work correctly
      expect(effectiveConfig.workspace.defaultStrategy).toBe('container');
      expect(effectiveConfig.workspace.container.resourceLimits?.cpu).toBe(2);
      expect(effectiveConfig.workspace.container.resourceLimits?.memory).toBe('1g');
      expect(effectiveConfig.workspace.container.environment?.NODE_ENV).toBe('development');
      expect(effectiveConfig.workspace.container.environment?.PORT).toBe('3000');
      expect(effectiveConfig.workspace.container.installTimeout).toBe(120000);

      // Step 5: Verify defaults are also applied for unspecified values
      expect(effectiveConfig.limits.maxTokensPerTask).toBe(500000); // From global defaults
      expect(effectiveConfig.api.port).toBe(3000); // From global defaults
    });

    it('should handle configuration evolution and backward compatibility', () => {
      // Old-style config that might not have workspace section
      const legacyConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'legacy-project',
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
        },
      };

      const effectiveConfig = getEffectiveConfig(legacyConfig);

      // Should get modern workspace defaults even with legacy config
      expect(effectiveConfig.workspace).toBeDefined();
      expect(effectiveConfig.workspace.defaultStrategy).toBe('none');
      expect(effectiveConfig.workspace.container).toBeDefined();
      expect(effectiveConfig.workspace.container.networkMode).toBe('bridge');

      // Should preserve legacy settings
      expect(effectiveConfig.limits.maxTokensPerTask).toBe(100000);
      expect(effectiveConfig.limits.maxCostPerTask).toBe(5.0);
    });
  });
});