import {
  ApexConfigSchema,
  ResourceLimitsSchema,
  ContainerDefaultsSchema,
  WorkspaceDefaultsSchema
} from '../types.js';

describe('Workspace Config Error Validation', () => {
  describe('ResourceLimits validation errors', () => {
    it('should reject CPU values outside valid range', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.05 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 65 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: -1 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 'invalid' })).toThrow();
    });

    it('should reject invalid memory formats', () => {
      const invalidMemoryFormats = [
        '256mb',     // invalid suffix
        '1gb',       // invalid suffix
        '512bytes',  // invalid suffix
        'invalid',   // not a number
        '',          // empty string
        '256.5m',    // decimal not allowed
      ];

      invalidMemoryFormats.forEach(memory => {
        expect(() => ResourceLimitsSchema.parse({ memory })).toThrow();
      });
    });

    it('should reject CPU shares outside valid range', () => {
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 1 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262145 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: -100 })).toThrow();
    });

    it('should reject invalid PIDs limit values', () => {
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 0 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: -10 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 'invalid' })).toThrow();
    });

    it('should reject null/invalid type values', () => {
      expect(() => ResourceLimitsSchema.parse(null)).toThrow();
      expect(() => ResourceLimitsSchema.parse('invalid')).toThrow();
      expect(() => ResourceLimitsSchema.parse([])).toThrow();
    });
  });

  describe('ContainerDefaults validation errors', () => {
    it('should reject invalid network mode values', () => {
      const invalidModes = ['invalid', 'custom', 'default', ''];

      invalidModes.forEach(networkMode => {
        expect(() => ContainerDefaultsSchema.parse({ networkMode })).toThrow();
      });
    });

    it('should reject invalid environment variable types', () => {
      const invalidEnvironments = [
        { PORT: 3000 },                    // number instead of string
        { ENABLED: true },                 // boolean instead of string
        { CONFIG: { nested: 'object' } },  // object instead of string
        { VALUES: ['array'] },             // array instead of string
      ];

      invalidEnvironments.forEach(environment => {
        expect(() => ContainerDefaultsSchema.parse({ environment })).toThrow();
      });
    });

    it('should reject negative or zero installTimeout', () => {
      expect(() => ContainerDefaultsSchema.parse({ installTimeout: 0 })).toThrow();
      expect(() => ContainerDefaultsSchema.parse({ installTimeout: -1000 })).toThrow();
    });

    it('should reject invalid autoRemove values', () => {
      expect(() => ContainerDefaultsSchema.parse({ autoRemove: 'true' })).toThrow();
      expect(() => ContainerDefaultsSchema.parse({ autoRemove: 1 })).toThrow();
      expect(() => ContainerDefaultsSchema.parse({ autoRemove: null })).toThrow();
    });
  });

  describe('WorkspaceDefaults validation errors', () => {
    it('should reject invalid defaultStrategy values', () => {
      const invalidStrategies = ['invalid', 'custom', 'docker', ''];

      invalidStrategies.forEach(defaultStrategy => {
        expect(() => WorkspaceDefaultsSchema.parse({ defaultStrategy })).toThrow();
      });
    });

    it('should reject invalid cleanupOnComplete values', () => {
      expect(() => WorkspaceDefaultsSchema.parse({ cleanupOnComplete: 'true' })).toThrow();
      expect(() => WorkspaceDefaultsSchema.parse({ cleanupOnComplete: 1 })).toThrow();
      expect(() => WorkspaceDefaultsSchema.parse({ cleanupOnComplete: null })).toThrow();
    });

    it('should reject invalid container configuration', () => {
      // Test with invalid nested container config
      expect(() => WorkspaceDefaultsSchema.parse({
        container: {
          networkMode: 'invalid-mode',
        },
      })).toThrow();

      expect(() => WorkspaceDefaultsSchema.parse({
        container: {
          resourceLimits: {
            cpu: 'invalid',
          },
        },
      })).toThrow();
    });
  });

  describe('ApexConfig validation with workspace errors', () => {
    it('should reject invalid workspace configuration in ApexConfig', () => {
      const invalidConfigs = [
        // Invalid strategy
        {
          project: { name: 'test' },
          workspace: { defaultStrategy: 'invalid' },
        },
        // Invalid resource limits
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: { cpu: 'invalid' },
            },
          },
        },
        // Invalid network mode
        {
          project: { name: 'test' },
          workspace: {
            container: { networkMode: 'invalid-mode' },
          },
        },
      ];

      invalidConfigs.forEach(config => {
        expect(() => ApexConfigSchema.parse(config)).toThrow();
      });
    });

    it('should provide meaningful error messages', () => {
      try {
        ApexConfigSchema.parse({
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                cpu: 100, // exceeds maximum
              },
            },
          },
        });
        fail('Expected validation to throw');
      } catch (error: any) {
        expect(error.message).toBeTruthy();
        expect(error.issues).toBeTruthy(); // Zod validation errors have issues array
      }
    });
  });

  describe('Complex error scenarios', () => {
    it('should handle multiple validation errors', () => {
      try {
        ApexConfigSchema.parse({
          project: { name: 'test' },
          workspace: {
            defaultStrategy: 'invalid-strategy',
            container: {
              networkMode: 'invalid-mode',
              resourceLimits: {
                cpu: -1,
                memory: 'invalid-format',
                cpuShares: 1,
                pidsLimit: 0,
              },
              installTimeout: -1000,
              autoRemove: 'invalid',
            },
          },
        });
        fail('Expected validation to throw');
      } catch (error: any) {
        expect(error.issues.length).toBeGreaterThan(1);
      }
    });

    it('should reject deeply nested invalid values', () => {
      expect(() => ApexConfigSchema.parse({
        project: { name: 'test' },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 2,
              memory: 'invalid-memory-format-with-wrong-suffix',
            },
          },
        },
      })).toThrow();
    });

    it('should handle type coercion edge cases', () => {
      // These should all fail because they're wrong types
      const edgeCases = [
        { workspace: 'string-instead-of-object' },
        { workspace: [] },
        { workspace: null },
        { workspace: { container: 'string-instead-of-object' } },
        { workspace: { container: { resourceLimits: 'string' } } },
      ];

      edgeCases.forEach(config => {
        expect(() => ApexConfigSchema.parse({
          project: { name: 'test' },
          ...config,
        })).toThrow();
      });
    });
  });

  describe('Boundary value testing', () => {
    it('should accept values exactly at boundaries', () => {
      // These should all pass
      const boundaryConfigs = [
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                cpu: 0.1, // minimum
              },
            },
          },
        },
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                cpu: 64, // maximum
              },
            },
          },
        },
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                cpuShares: 2, // minimum
              },
            },
          },
        },
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                cpuShares: 262144, // maximum
              },
            },
          },
        },
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                pidsLimit: 1, // minimum
              },
            },
          },
        },
      ];

      boundaryConfigs.forEach(config => {
        expect(() => ApexConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should reject values just outside boundaries', () => {
      // These should all fail
      const outsideBoundaryConfigs = [
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                cpu: 0.05, // below minimum
              },
            },
          },
        },
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                cpu: 64.1, // above maximum
              },
            },
          },
        },
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                cpuShares: 1, // below minimum
              },
            },
          },
        },
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                cpuShares: 262145, // above maximum
              },
            },
          },
        },
        {
          project: { name: 'test' },
          workspace: {
            container: {
              resourceLimits: {
                pidsLimit: 0, // below minimum
              },
            },
          },
        },
      ];

      outsideBoundaryConfigs.forEach(config => {
        expect(() => ApexConfigSchema.parse(config)).toThrow();
      });
    });
  });
});