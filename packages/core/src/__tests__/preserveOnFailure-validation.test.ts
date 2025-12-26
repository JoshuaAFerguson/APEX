import { describe, it, expect } from 'vitest';
import { WorkspaceConfigSchema } from '../types.js';

describe('WorkspaceConfigSchema preserveOnFailure validation', () => {
  it('should parse with preserveOnFailure default (false)', () => {
    const result = WorkspaceConfigSchema.parse({
      strategy: 'none',
      cleanup: true,
    });

    expect(result.preserveOnFailure).toBe(false);
  });

  it('should parse with preserveOnFailure explicitly true', () => {
    const result = WorkspaceConfigSchema.parse({
      strategy: 'none',
      cleanup: true,
      preserveOnFailure: true,
    });

    expect(result.preserveOnFailure).toBe(true);
  });

  it('should parse with preserveOnFailure explicitly false', () => {
    const result = WorkspaceConfigSchema.parse({
      strategy: 'none',
      cleanup: true,
      preserveOnFailure: false,
    });

    expect(result.preserveOnFailure).toBe(false);
  });

  it('should reject invalid preserveOnFailure values', () => {
    expect(() => {
      WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: 'true',
      });
    }).toThrow();

    expect(() => {
      WorkspaceConfigSchema.parse({
        strategy: 'none',
        cleanup: true,
        preserveOnFailure: 1,
      });
    }).toThrow();
  });
});