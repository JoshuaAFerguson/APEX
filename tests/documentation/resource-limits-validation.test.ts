import { describe, it, expect } from 'vitest';
import { ResourceLimitsSchema } from '../../packages/core/src/types';

describe('Resource Limits Schema Validation - Quick Test', () => {
  it('should validate basic resource limits configuration', () => {
    const resourceLimits = {
      cpu: 2,
      memory: "4g",
      cpuShares: 1024,
      pidsLimit: 1000
    };

    expect(() => ResourceLimitsSchema.parse(resourceLimits)).not.toThrow();

    const parsed = ResourceLimitsSchema.parse(resourceLimits);
    expect(parsed.cpu).toBe(2);
    expect(parsed.memory).toBe("4g");
    expect(parsed.cpuShares).toBe(1024);
    expect(parsed.pidsLimit).toBe(1000);
  });

  it('should reject invalid CPU values', () => {
    expect(() => ResourceLimitsSchema.parse({ cpu: 0.05 })).toThrow();
    expect(() => ResourceLimitsSchema.parse({ cpu: 65 })).toThrow();
  });

  it('should reject invalid memory formats', () => {
    expect(() => ResourceLimitsSchema.parse({ memory: "512mb" })).toThrow();
    expect(() => ResourceLimitsSchema.parse({ memory: "1gb" })).toThrow();
  });

  it('should reject invalid CPU shares', () => {
    expect(() => ResourceLimitsSchema.parse({ cpuShares: 1 })).toThrow();
    expect(() => ResourceLimitsSchema.parse({ cpuShares: 262145 })).toThrow();
  });

  it('should reject invalid pids limit', () => {
    expect(() => ResourceLimitsSchema.parse({ pidsLimit: 0 })).toThrow();
  });

  it('should accept valid memory formats', () => {
    const validFormats = ['512m', '1g', '2048M', '1G', '1024k', '512K', '1024'];

    validFormats.forEach(memory => {
      expect(() => ResourceLimitsSchema.parse({ memory })).not.toThrow();
    });
  });

  it('should accept valid CPU ranges', () => {
    const validCpus = [0.1, 0.5, 1, 2.5, 4, 8, 16, 32, 64];

    validCpus.forEach(cpu => {
      expect(() => ResourceLimitsSchema.parse({ cpu })).not.toThrow();
    });
  });

  it('should accept valid CPU shares range', () => {
    const validShares = [2, 512, 1024, 2048, 4096, 262144];

    validShares.forEach(cpuShares => {
      expect(() => ResourceLimitsSchema.parse({ cpuShares })).not.toThrow();
    });
  });
});