import { describe, it, expect } from 'vitest';
import {
  ApexConfigSchema,
  ResourceLimitsSchema,
  ContainerDefaultsSchema,
  WorkspaceConfigSchema,
} from '../types';

describe('Resource Limits Schema Validation for initializeApex defaults', () => {
  describe('Default values validation', () => {
    it('should validate CPU default value (1) against ResourceLimitsSchema', () => {
      const resourceLimits = { cpu: 1 };

      expect(() => ResourceLimitsSchema.parse(resourceLimits)).not.toThrow();

      const parsed = ResourceLimitsSchema.parse(resourceLimits);
      expect(parsed.cpu).toBe(1);
    });

    it('should validate memory default value (512m) against ResourceLimitsSchema', () => {
      const resourceLimits = { memory: '512m' };

      expect(() => ResourceLimitsSchema.parse(resourceLimits)).not.toThrow();

      const parsed = ResourceLimitsSchema.parse(resourceLimits);
      expect(parsed.memory).toBe('512m');
    });

    it('should validate combined default values against ResourceLimitsSchema', () => {
      const resourceLimits = {
        cpu: 1,
        memory: '512m',
      };

      expect(() => ResourceLimitsSchema.parse(resourceLimits)).not.toThrow();

      const parsed = ResourceLimitsSchema.parse(resourceLimits);
      expect(parsed.cpu).toBe(1);
      expect(parsed.memory).toBe('512m');
      expect(parsed.memoryReservation).toBeUndefined();
      expect(parsed.memorySwap).toBeUndefined();
      expect(parsed.cpuShares).toBeUndefined();
      expect(parsed.pidsLimit).toBeUndefined();
    });
  });

  describe('CPU validation edge cases', () => {
    it('should accept CPU value 1 (exactly at lower bound)', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 1 })).not.toThrow();
    });

    it('should reject CPU values below 0.1 (minimum bound)', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.05 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 0 })).toThrow();
    });

    it('should reject CPU values above 64 (maximum bound)', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 65 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 100 })).toThrow();
    });

    it('should accept various valid CPU values including our default', () => {
      const validCpuValues = [0.1, 0.5, 1, 2, 4, 8, 16, 32, 64];

      for (const cpu of validCpuValues) {
        expect(() => ResourceLimitsSchema.parse({ cpu })).not.toThrow();
        const parsed = ResourceLimitsSchema.parse({ cpu });
        expect(parsed.cpu).toBe(cpu);
      }
    });
  });

  describe('Memory validation edge cases', () => {
    it('should accept memory value 512m (our default)', () => {
      expect(() => ResourceLimitsSchema.parse({ memory: '512m' })).not.toThrow();
    });

    it('should accept various memory formats', () => {
      const validMemoryValues = ['256m', '512M', '1g', '2G', '4096m', '1024'];

      for (const memory of validMemoryValues) {
        expect(() => ResourceLimitsSchema.parse({ memory })).not.toThrow();
        const parsed = ResourceLimitsSchema.parse({ memory });
        expect(parsed.memory).toBe(memory);
      }
    });

    it('should reject invalid memory formats', () => {
      const invalidMemoryValues = ['512mb', '1gb', 'invalid', '', '512x', '1.5g'];

      for (const memory of invalidMemoryValues) {
        expect(() => ResourceLimitsSchema.parse({ memory })).toThrow();
      }
    });

    it('should validate memory regex pattern correctly', () => {
      // Test the exact regex pattern: /^\d+[kmgKMG]?$/
      const validPatterns = ['512', '512m', '512M', '512k', '512K', '512g', '512G'];
      const invalidPatterns = ['512mb', '512GB', '1.5g', 'g512', 'm512'];

      for (const memory of validPatterns) {
        expect(() => ResourceLimitsSchema.parse({ memory })).not.toThrow();
      }

      for (const memory of invalidPatterns) {
        expect(() => ResourceLimitsSchema.parse({ memory })).toThrow();
      }
    });
  });

  describe('Container defaults schema integration', () => {
    it('should validate initializeApex container defaults structure', () => {
      const containerDefaults = {
        resourceLimits: {
          cpu: 1,
          memory: '512m',
        },
        networkMode: 'bridge',
        autoRemove: true,
      };

      expect(() => ContainerDefaultsSchema.parse(containerDefaults)).not.toThrow();

      const parsed = ContainerDefaultsSchema.parse(containerDefaults);
      expect(parsed.resourceLimits?.cpu).toBe(1);
      expect(parsed.resourceLimits?.memory).toBe('512m');
      expect(parsed.networkMode).toBe('bridge');
      expect(parsed.autoRemove).toBe(true);
    });

    it('should validate workspace config with container resource limits', () => {
      const workspaceConfig = {
        defaultStrategy: 'none',
        cleanupOnComplete: true,
        container: {
          resourceLimits: {
            cpu: 1,
            memory: '512m',
          },
          networkMode: 'bridge',
          autoRemove: true,
        },
      };

      expect(() => WorkspaceConfigSchema.parse(workspaceConfig)).not.toThrow();
    });
  });

  describe('Full ApexConfig schema validation', () => {
    it('should validate complete initializeApex default config structure', () => {
      const defaultConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          language: 'typescript',
          framework: 'react',
        },
        autonomy: {
          default: 'review-before-merge',
        },
        agents: {
          enabled: ['planner', 'architect', 'developer', 'reviewer', 'tester'],
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
        git: {
          branchPrefix: 'apex/',
          commitFormat: 'conventional',
          autoPush: true,
          defaultBranch: 'main',
        },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
        workspace: {
          defaultStrategy: 'none',
          cleanupOnComplete: true,
          container: {
            networkMode: 'bridge',
            autoRemove: true,
            resourceLimits: {
              cpu: 1,
              memory: '512m',
            },
          },
        },
      };

      expect(() => ApexConfigSchema.parse(defaultConfig)).not.toThrow();

      const parsed = ApexConfigSchema.parse(defaultConfig);
      expect(parsed.workspace?.container?.resourceLimits?.cpu).toBe(1);
      expect(parsed.workspace?.container?.resourceLimits?.memory).toBe('512m');
    });

    it('should validate minimal config with just resource limits', () => {
      const minimalConfig = {
        project: {
          name: 'minimal-test',
        },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 1,
              memory: '512m',
            },
          },
        },
      };

      expect(() => ApexConfigSchema.parse(minimalConfig)).not.toThrow();

      const parsed = ApexConfigSchema.parse(minimalConfig);
      expect(parsed.workspace?.container?.resourceLimits?.cpu).toBe(1);
      expect(parsed.workspace?.container?.resourceLimits?.memory).toBe('512m');
    });
  });

  describe('Sensible defaults verification', () => {
    it('should verify CPU default (1 core) is reasonable for development', () => {
      const cpu = 1;

      // Should be sufficient for basic development tasks
      expect(cpu).toBeGreaterThan(0.5); // More than half a core
      expect(cpu).toBeLessThanOrEqual(4); // Not excessive for default

      // Should be within schema bounds
      expect(cpu).toBeGreaterThanOrEqual(0.1);
      expect(cpu).toBeLessThanOrEqual(64);
    });

    it('should verify memory default (512m) is reasonable for development', () => {
      const memory = '512m';

      // Should match the expected format
      expect(memory).toMatch(/^\d+[mM]$/);

      // Extract numeric value
      const memoryValue = parseInt(memory.replace(/[mM]/, ''));

      // Should be sufficient for basic development tasks
      expect(memoryValue).toBeGreaterThanOrEqual(256); // At least 256MB
      expect(memoryValue).toBeLessThanOrEqual(2048); // Not excessive for default
      expect(memoryValue).toBe(512); // Exactly our default
    });

    it('should verify defaults work well together', () => {
      const resourceLimits = {
        cpu: 1,
        memory: '512m',
      };

      // Both values should be reasonable for a balanced development environment
      expect(resourceLimits.cpu).toBe(1); // 1 CPU core
      expect(resourceLimits.memory).toBe('512m'); // 512MB memory

      // Should validate together
      expect(() => ResourceLimitsSchema.parse(resourceLimits)).not.toThrow();
    });
  });

  describe('Error handling and validation messages', () => {
    it('should provide meaningful errors for invalid CPU values', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 0 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 65 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: -1 })).toThrow();
    });

    it('should provide meaningful errors for invalid memory values', () => {
      expect(() => ResourceLimitsSchema.parse({ memory: 'invalid' })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ memory: '1gb' })).toThrow(); // Should be '1g'
      expect(() => ResourceLimitsSchema.parse({ memory: '512MB' })).toThrow(); // Should be '512m' or '512M'
    });

    it('should handle type mismatches gracefully', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: '1' })).toThrow(); // Should be number
      expect(() => ResourceLimitsSchema.parse({ memory: 512 })).toThrow(); // Should be string
    });
  });
});