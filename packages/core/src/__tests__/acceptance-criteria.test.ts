import { ApexConfigSchema } from '../types.js';

/**
 * Test file to validate the specific acceptance criteria:
 * "ApexConfigSchema includes optional workspace section with container defaults including resourceLimits. Types compile successfully."
 */
describe('Acceptance Criteria Validation', () => {
  describe('ApexConfigSchema includes optional workspace section', () => {
    it('should include workspace as an optional field in ApexConfigSchema', () => {
      // Test that workspace is optional - config should be valid without it
      const configWithoutWorkspace = {
        project: {
          name: 'test-project',
        },
      };

      const result = ApexConfigSchema.parse(configWithoutWorkspace);
      expect(result.workspace).toBeUndefined();
    });

    it('should accept workspace when provided', () => {
      // Test that workspace is accepted when provided
      const configWithWorkspace = {
        project: {
          name: 'test-project',
        },
        workspace: {
          defaultStrategy: 'container',
        },
      };

      const result = ApexConfigSchema.parse(configWithWorkspace);
      expect(result.workspace).toBeDefined();
      expect(result.workspace?.defaultStrategy).toBe('container');
    });
  });

  describe('workspace section with container defaults', () => {
    it('should include container as an optional field in workspace', () => {
      // Test that container is optional within workspace
      const configWithoutContainer = {
        project: {
          name: 'test-project',
        },
        workspace: {
          defaultStrategy: 'worktree',
          cleanupOnComplete: false,
        },
      };

      const result = ApexConfigSchema.parse(configWithoutContainer);
      expect(result.workspace?.container).toBeUndefined();
      expect(result.workspace?.defaultStrategy).toBe('worktree');
    });

    it('should accept container defaults when provided', () => {
      const configWithContainer = {
        project: {
          name: 'test-project',
        },
        workspace: {
          container: {
            image: 'node:20-alpine',
            autoRemove: true,
            networkMode: 'bridge',
          },
        },
      };

      const result = ApexConfigSchema.parse(configWithContainer);
      expect(result.workspace?.container).toBeDefined();
      expect(result.workspace?.container?.image).toBe('node:20-alpine');
      expect(result.workspace?.container?.autoRemove).toBe(true);
      expect(result.workspace?.container?.networkMode).toBe('bridge');
    });
  });

  describe('container defaults including resourceLimits', () => {
    it('should include resourceLimits as an optional field in container', () => {
      // Test that resourceLimits is optional within container
      const configWithoutResourceLimits = {
        project: {
          name: 'test-project',
        },
        workspace: {
          container: {
            image: 'ubuntu:22.04',
            autoRemove: false,
          },
        },
      };

      const result = ApexConfigSchema.parse(configWithoutResourceLimits);
      expect(result.workspace?.container?.resourceLimits).toBeUndefined();
      expect(result.workspace?.container?.image).toBe('ubuntu:22.04');
    });

    it('should accept resourceLimits when provided', () => {
      const configWithResourceLimits = {
        project: {
          name: 'test-project',
        },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 2.5,
              memory: '4g',
              memoryReservation: '2g',
              memorySwap: '8g',
              cpuShares: 1024,
              pidsLimit: 100,
            },
          },
        },
      };

      const result = ApexConfigSchema.parse(configWithResourceLimits);
      expect(result.workspace?.container?.resourceLimits).toBeDefined();

      const resourceLimits = result.workspace?.container?.resourceLimits;
      expect(resourceLimits?.cpu).toBe(2.5);
      expect(resourceLimits?.memory).toBe('4g');
      expect(resourceLimits?.memoryReservation).toBe('2g');
      expect(resourceLimits?.memorySwap).toBe('8g');
      expect(resourceLimits?.cpuShares).toBe(1024);
      expect(resourceLimits?.pidsLimit).toBe(100);
    });

    it('should validate all resourceLimits fields individually', () => {
      // Test each field can be provided independently
      const testFields = [
        { cpu: 1.5 },
        { memory: '1g' },
        { memoryReservation: '512m' },
        { memorySwap: '2g' },
        { cpuShares: 512 },
        { pidsLimit: 50 },
      ];

      testFields.forEach((field) => {
        const config = {
          project: { name: 'test-project' },
          workspace: {
            container: {
              resourceLimits: field,
            },
          },
        };

        expect(() => ApexConfigSchema.parse(config)).not.toThrow();
      });
    });
  });

  describe('Types compile successfully', () => {
    it('should have correct TypeScript types for full configuration hierarchy', () => {
      // This test validates that TypeScript types compile correctly
      const fullConfig = ApexConfigSchema.parse({
        version: '1.0',
        project: {
          name: 'type-test-project',
          language: 'typescript',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '1g',
              memoryReservation: '512m',
              memorySwap: '2g',
              cpuShares: 1024,
              pidsLimit: 100,
            },
            networkMode: 'bridge',
            environment: {
              NODE_ENV: 'test',
            },
            autoRemove: true,
            installTimeout: 300000,
          },
        },
      });

      // Type assertions to ensure TypeScript compilation
      const version: string = fullConfig.version;
      const projectName: string = fullConfig.project.name;
      const strategy: string = fullConfig.workspace?.defaultStrategy ?? 'none';
      const cleanup: boolean = fullConfig.workspace?.cleanupOnComplete ?? true;
      const image: string | undefined = fullConfig.workspace?.container?.image;
      const cpu: number | undefined = fullConfig.workspace?.container?.resourceLimits?.cpu;
      const memory: string | undefined = fullConfig.workspace?.container?.resourceLimits?.memory;
      const autoRemove: boolean | undefined = fullConfig.workspace?.container?.autoRemove;

      // Verify values match expected types and values
      expect(typeof version).toBe('string');
      expect(typeof projectName).toBe('string');
      expect(typeof strategy).toBe('string');
      expect(typeof cleanup).toBe('boolean');
      expect(typeof image).toBe('string');
      expect(typeof cpu).toBe('number');
      expect(typeof memory).toBe('string');
      expect(typeof autoRemove).toBe('boolean');

      // Verify actual values
      expect(version).toBe('1.0');
      expect(projectName).toBe('type-test-project');
      expect(strategy).toBe('container');
      expect(cleanup).toBe(true);
      expect(image).toBe('node:20-alpine');
      expect(cpu).toBe(2);
      expect(memory).toBe('1g');
      expect(autoRemove).toBe(true);
    });

    it('should provide proper type inference for optional fields', () => {
      // Test type inference when fields are not provided
      const minimalConfig = ApexConfigSchema.parse({
        project: { name: 'minimal' },
      });

      // These should be undefined and TypeScript should infer the correct types
      const workspace = minimalConfig.workspace; // should be undefined
      const container = minimalConfig.workspace?.container; // should be undefined
      const resourceLimits = minimalConfig.workspace?.container?.resourceLimits; // should be undefined

      expect(workspace).toBeUndefined();
      expect(container).toBeUndefined();
      expect(resourceLimits).toBeUndefined();
    });

    it('should support partial resource limits configuration', () => {
      // Test that partial resource limits work with proper types
      const partialConfig = ApexConfigSchema.parse({
        project: { name: 'partial' },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 1,
              memory: '512m',
              // Other fields omitted
            },
          },
        },
      });

      const resourceLimits = partialConfig.workspace?.container?.resourceLimits;
      expect(resourceLimits?.cpu).toBe(1);
      expect(resourceLimits?.memory).toBe('512m');
      expect(resourceLimits?.memoryReservation).toBeUndefined();
      expect(resourceLimits?.memorySwap).toBeUndefined();
      expect(resourceLimits?.cpuShares).toBeUndefined();
      expect(resourceLimits?.pidsLimit).toBeUndefined();
    });
  });

  describe('Complete integration test', () => {
    it('should satisfy all acceptance criteria in a single comprehensive test', () => {
      // This test validates the complete acceptance criteria:
      // "ApexConfigSchema includes optional workspace section with container defaults including resourceLimits. Types compile successfully."

      // 1. Test that ApexConfigSchema includes optional workspace section
      const configWithoutWorkspace = {
        project: { name: 'test1' },
      };
      const result1 = ApexConfigSchema.parse(configWithoutWorkspace);
      expect(result1.workspace).toBeUndefined(); // ✓ workspace is optional

      const configWithWorkspace = {
        project: { name: 'test2' },
        workspace: { defaultStrategy: 'container' },
      };
      const result2 = ApexConfigSchema.parse(configWithWorkspace);
      expect(result2.workspace).toBeDefined(); // ✓ workspace is included

      // 2. Test that workspace section includes container defaults
      const configWithContainerDefaults = {
        project: { name: 'test3' },
        workspace: {
          container: {
            image: 'node:20',
            autoRemove: true,
            networkMode: 'bridge',
            environment: { NODE_ENV: 'test' },
            installTimeout: 300000,
          },
        },
      };
      const result3 = ApexConfigSchema.parse(configWithContainerDefaults);
      expect(result3.workspace?.container).toBeDefined(); // ✓ container defaults included

      // 3. Test that container defaults include resourceLimits
      const configWithResourceLimits = {
        project: { name: 'test4' },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 2,
              memory: '2g',
              memoryReservation: '1g',
              memorySwap: '4g',
              cpuShares: 1024,
              pidsLimit: 100,
            },
          },
        },
      };
      const result4 = ApexConfigSchema.parse(configWithResourceLimits);
      expect(result4.workspace?.container?.resourceLimits).toBeDefined(); // ✓ resourceLimits included

      // 4. Test that types compile successfully (TypeScript compilation test)
      const fullConfig = ApexConfigSchema.parse({
        project: { name: 'comprehensive-test' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
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
              NODE_ENV: 'production',
              DEBUG: 'false',
            },
            autoRemove: true,
            installTimeout: 600000,
          },
        },
      });

      // Type-safe access (this tests TypeScript compilation)
      const strategy: string = fullConfig.workspace?.defaultStrategy ?? 'none';
      const image: string | undefined = fullConfig.workspace?.container?.image;
      const cpu: number | undefined = fullConfig.workspace?.container?.resourceLimits?.cpu;
      const memory: string | undefined = fullConfig.workspace?.container?.resourceLimits?.memory;

      // Validate final values
      expect(strategy).toBe('container');
      expect(image).toBe('node:20-alpine');
      expect(cpu).toBe(4);
      expect(memory).toBe('8g');

      // ✅ All acceptance criteria satisfied:
      // - ApexConfigSchema includes optional workspace section ✓
      // - workspace section includes container defaults ✓
      // - container defaults include resourceLimits ✓
      // - Types compile successfully ✓
    });
  });
});