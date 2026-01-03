import { describe, it, expect } from 'vitest';
import { ApexConfigSchema } from '../types.js';

describe('Basic Policies Key Parsing', () => {
  it('should parse config without policies field (defaults to empty array)', () => {
    const config = {
      version: '1.0',
      project: {
        name: 'test-project',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
    };

    const parsed = ApexConfigSchema.parse(config);
    expect(parsed.policies).toEqual([]);
    expect(Array.isArray(parsed.policies)).toBe(true);
  });

  it('should parse config with empty policies array', () => {
    const config = {
      version: '1.0',
      project: {
        name: 'test-project',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      policies: [],
    };

    const parsed = ApexConfigSchema.parse(config);
    expect(parsed.policies).toEqual([]);
    expect(Array.isArray(parsed.policies)).toBe(true);
  });

  it('should parse config with valid policy', () => {
    const config = {
      version: '1.0',
      project: {
        name: 'test-project',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      policies: [
        {
          id: 'test-policy',
          name: 'Test Policy',
          description: 'A test policy',
          rules: [
            {
              id: 'test-rule',
              type: 'path',
              name: 'Test Rule',
              description: 'A test rule',
              patterns: ['src/**/*.ts'],
              enforcement: 'warn',
              enabled: true,
            }
          ],
          enabled: true,
          enforcement: 'warn',
          tags: ['test'],
        }
      ],
    };

    const parsed = ApexConfigSchema.parse(config);
    expect(parsed.policies).toHaveLength(1);
    expect(parsed.policies[0].id).toBe('test-policy');
    expect(parsed.policies[0].name).toBe('Test Policy');
    expect(parsed.policies[0].rules).toHaveLength(1);
    expect(parsed.policies[0].rules[0].type).toBe('path');
  });

  it('should reject invalid policies structure', () => {
    const config = {
      version: '1.0',
      project: {
        name: 'test-project',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      policies: [
        {
          // Missing required 'id' field
          name: 'Invalid Policy',
          rules: [],
        }
      ],
    };

    expect(() => ApexConfigSchema.parse(config)).toThrow();
  });

  it('should reject non-array policies', () => {
    const config = {
      version: '1.0',
      project: {
        name: 'test-project',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      policies: 'not-an-array',
    };

    expect(() => ApexConfigSchema.parse(config)).toThrow();
  });
});