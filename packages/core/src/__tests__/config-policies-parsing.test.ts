import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, getEffectiveConfig, initializeApex } from '../config.js';
import { ApexConfig, ApexConfigSchema, PolicySchema, Policy } from '../types.js';
import * as yaml from 'yaml';

describe('ConfigLoader Policies Key Parsing', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-policies-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Schema Validation', () => {
    it('should validate policies field is optional in ApexConfigSchema', () => {
      // Config without policies should be valid
      const configWithoutPolicies = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const parsedConfig = ApexConfigSchema.parse(configWithoutPolicies);
      expect(parsedConfig.policies).toEqual([]);
    });

    it('should validate policies field defaults to empty array', () => {
      const configWithoutPolicies = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const parsedConfig = ApexConfigSchema.parse(configWithoutPolicies);
      expect(Array.isArray(parsedConfig.policies)).toBe(true);
      expect(parsedConfig.policies).toHaveLength(0);
    });

    it('should validate policies field accepts array of Policy objects', () => {
      const testPolicy: Policy = {
        id: 'test-policy-1',
        name: 'Test Policy',
        description: 'A test policy for validation',
        rules: [
          {
            id: 'rule-1',
            type: 'path',
            name: 'Path Rule',
            description: 'Test path rule',
            patterns: ['src/**/*.ts'],
            enforcement: 'warn',
            enabled: true,
          }
        ],
        enabled: true,
        enforcement: 'warn',
        tags: ['test'],
      };

      const configWithPolicies = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [testPolicy],
      };

      const parsedConfig = ApexConfigSchema.parse(configWithPolicies);
      expect(parsedConfig.policies).toHaveLength(1);
      expect(parsedConfig.policies[0]).toMatchObject({
        id: 'test-policy-1',
        name: 'Test Policy',
        description: 'A test policy for validation',
        enabled: true,
        enforcement: 'warn',
        tags: ['test'],
      });
      expect(parsedConfig.policies[0].rules).toHaveLength(1);
      expect(parsedConfig.policies[0].rules[0].type).toBe('path');
    });

    it('should validate complex policies structure', () => {
      const complexPolicy: Policy = {
        id: 'complex-policy',
        name: 'Complex Test Policy',
        description: 'A complex policy with multiple rules',
        rules: [
          {
            id: 'path-rule',
            type: 'path',
            name: 'Path Access Rule',
            description: 'Controls file access',
            patterns: ['src/**/*.ts', 'lib/**/*.js'],
            enforcement: 'strict',
            enabled: true,
          },
          {
            id: 'test-rule',
            type: 'test',
            name: 'Test Requirement Rule',
            description: 'Requires tests for source files',
            patterns: ['src/**/*.ts'],
            enforcement: 'warn',
            enabled: true,
          }
        ],
        severityLevels: {
          default: 'warn',
          overrides: {
            'critical': 'error',
            'minor': 'info',
          },
        },
        enabled: true,
        enforcement: 'audit',
        version: '2.0',
        tags: ['security', 'quality'],
        metadata: {
          owner: 'qa-team',
          reviewedDate: '2024-01-01',
        },
      };

      const configWithComplexPolicies = {
        version: '1.0',
        project: {
          name: 'complex-test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [complexPolicy],
      };

      const parsedConfig = ApexConfigSchema.parse(configWithComplexPolicies);
      expect(parsedConfig.policies).toHaveLength(1);

      const policy = parsedConfig.policies[0];
      expect(policy.id).toBe('complex-policy');
      expect(policy.name).toBe('Complex Test Policy');
      expect(policy.rules).toHaveLength(2);
      expect(policy.severityLevels?.default).toBe('warn');
      expect(policy.severityLevels?.overrides?.['critical']).toBe('error');
      expect(policy.tags).toEqual(['security', 'quality']);
      expect(policy.metadata?.owner).toBe('qa-team');
    });

    it('should reject invalid policies structure', () => {
      const invalidConfig = {
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

      expect(() => ApexConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject policies that are not an array', () => {
      const invalidConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: {
          'not-an-array': 'should-be-array'
        },
      };

      expect(() => ApexConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('Config File Loading and Saving', () => {
    it('should load config with empty policies from YAML file', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'yaml-test-project'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
policies: []
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.policies).toEqual([]);
    });

    it('should load config with policies from YAML file', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'policies-yaml-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
policies:
  - id: 'yaml-policy'
    name: 'YAML Test Policy'
    description: 'Policy loaded from YAML'
    rules:
      - id: 'yaml-rule'
        type: 'path'
        name: 'YAML Path Rule'
        description: 'Path rule from YAML'
        patterns:
          - 'src/**/*.ts'
        enforcement: 'warn'
        enabled: true
    enabled: true
    enforcement: 'audit'
    tags:
      - 'yaml'
      - 'test'
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.policies).toHaveLength(1);
      expect(loadedConfig.policies[0].id).toBe('yaml-policy');
      expect(loadedConfig.policies[0].name).toBe('YAML Test Policy');
      expect(loadedConfig.policies[0].rules).toHaveLength(1);
      expect(loadedConfig.policies[0].rules[0].patterns).toEqual(['src/**/*.ts']);
      expect(loadedConfig.policies[0].tags).toEqual(['yaml', 'test']);
    });

    it('should save and reload config with policies correctly', async () => {
      const testPolicy: Policy = {
        id: 'save-test-policy',
        name: 'Save Test Policy',
        description: 'Policy for testing save/load cycle',
        rules: [
          {
            id: 'save-rule',
            type: 'test',
            name: 'Save Test Rule',
            description: 'Test rule for save/load',
            patterns: ['**/*.spec.ts'],
            enforcement: 'strict',
            enabled: true,
          }
        ],
        enabled: true,
        enforcement: 'warn',
        version: '1.5',
        tags: ['save-test'],
      };

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'save-load-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [testPolicy],
      };

      await saveConfig(testDir, config);
      const reloadedConfig = await loadConfig(testDir);

      expect(reloadedConfig.policies).toHaveLength(1);
      expect(reloadedConfig.policies[0]).toMatchObject({
        id: 'save-test-policy',
        name: 'Save Test Policy',
        description: 'Policy for testing save/load cycle',
        enabled: true,
        enforcement: 'warn',
        version: '1.5',
        tags: ['save-test'],
      });
      expect(reloadedConfig.policies[0].rules).toHaveLength(1);
      expect(reloadedConfig.policies[0].rules[0].patterns).toEqual(['**/*.spec.ts']);
    });

    it('should handle config without policies key', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'no-policies-project'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
# No policies key
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.policies).toEqual([]);
    });

    it('should maintain other config fields when loading with policies', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'full-config-test'
  language: 'typescript'
  framework: 'nextjs'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
autonomy:
  level: 'full-auto'
limits:
  maxCostPerTask: 15.0
policies:
  - id: 'integration-policy'
    name: 'Integration Test Policy'
    rules: []
    enabled: true
git:
  branchPrefix: 'custom/'
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      const loadedConfig = await loadConfig(testDir);

      // Verify other fields are preserved
      expect(loadedConfig.project.name).toBe('full-config-test');
      expect(loadedConfig.project.language).toBe('typescript');
      expect(loadedConfig.project.framework).toBe('nextjs');
      expect(loadedConfig.autonomy?.level).toBe('full-auto');
      expect(loadedConfig.limits?.maxCostPerTask).toBe(15.0);
      expect(loadedConfig.git?.branchPrefix).toBe('custom/');

      // Verify policies are loaded correctly
      expect(loadedConfig.policies).toHaveLength(1);
      expect(loadedConfig.policies[0].id).toBe('integration-policy');
    });
  });

  describe('getEffectiveConfig Integration', () => {
    it('should preserve policies in effective config', () => {
      const testPolicy: Policy = {
        id: 'effective-test-policy',
        name: 'Effective Config Test Policy',
        description: 'Policy for testing getEffectiveConfig',
        rules: [
          {
            id: 'effective-rule',
            type: 'approval',
            name: 'Approval Rule',
            description: 'Test approval rule',
            patterns: ['**/*'],
            enforcement: 'strict',
            enabled: true,
          }
        ],
        enabled: true,
        enforcement: 'audit',
        tags: ['effective-config'],
      };

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'effective-config-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [testPolicy],
      };

      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.policies).toHaveLength(1);
      expect(effectiveConfig.policies[0]).toMatchObject({
        id: 'effective-test-policy',
        name: 'Effective Config Test Policy',
        enabled: true,
        enforcement: 'audit',
        tags: ['effective-config'],
      });
    });

    it('should default to empty array when policies not specified', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'default-policies-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        // No policies specified
      };

      const effectiveConfig = getEffectiveConfig(config);
      expect(effectiveConfig.policies).toEqual([]);
    });

    it('should preserve multiple policies with different configurations', () => {
      const policies: Policy[] = [
        {
          id: 'security-policy',
          name: 'Security Policy',
          description: 'Security-related rules',
          rules: [
            {
              id: 'sensitive-files',
              type: 'path',
              name: 'Sensitive Files',
              description: 'Block access to sensitive files',
              patterns: ['.env*', '*.key'],
              enforcement: 'strict',
              enabled: true,
            }
          ],
          enabled: true,
          enforcement: 'strict',
          tags: ['security'],
        },
        {
          id: 'quality-policy',
          name: 'Quality Policy',
          description: 'Code quality rules',
          rules: [
            {
              id: 'test-coverage',
              type: 'test',
              name: 'Test Coverage',
              description: 'Require test coverage',
              patterns: ['src/**/*.ts'],
              enforcement: 'warn',
              enabled: true,
            }
          ],
          enabled: true,
          enforcement: 'warn',
          tags: ['quality', 'testing'],
        }
      ];

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'multi-policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies,
      };

      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.policies).toHaveLength(2);

      const securityPolicy = effectiveConfig.policies.find(p => p.id === 'security-policy');
      const qualityPolicy = effectiveConfig.policies.find(p => p.id === 'quality-policy');

      expect(securityPolicy).toBeDefined();
      expect(securityPolicy?.enforcement).toBe('strict');
      expect(securityPolicy?.tags).toEqual(['security']);

      expect(qualityPolicy).toBeDefined();
      expect(qualityPolicy?.enforcement).toBe('warn');
      expect(qualityPolicy?.tags).toEqual(['quality', 'testing']);
    });
  });

  describe('initializeApex Integration', () => {
    it('should initialize project with empty policies', async () => {
      await initializeApex(testDir, {
        projectName: 'init-policies-test',
        language: 'typescript',
      });

      const config = await loadConfig(testDir);
      expect(config.policies).toEqual([]);
    });

    it('should preserve policies after initialization when config is modified', async () => {
      await initializeApex(testDir, {
        projectName: 'init-modify-test',
      });

      // Load and modify config to add policies
      const originalConfig = await loadConfig(testDir);
      const modifiedConfig: ApexConfig = {
        ...originalConfig,
        policies: [
          {
            id: 'post-init-policy',
            name: 'Post Initialization Policy',
            description: 'Added after initialization',
            rules: [
              {
                id: 'post-init-rule',
                type: 'path',
                name: 'Post Init Rule',
                description: 'Rule added post-init',
                patterns: ['src/**'],
                enforcement: 'warn',
                enabled: true,
              }
            ],
            enabled: true,
            enforcement: 'audit',
          }
        ],
      };

      await saveConfig(testDir, modifiedConfig);
      const reloadedConfig = await loadConfig(testDir);

      expect(reloadedConfig.policies).toHaveLength(1);
      expect(reloadedConfig.policies[0].id).toBe('post-init-policy');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed policy rules gracefully', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'malformed-policy-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
policies:
  - id: 'malformed-policy'
    name: 'Malformed Policy'
    rules:
      - id: 'malformed-rule'
        type: 'invalid-type'
        name: 'Invalid Rule'
        patterns: []
        enforcement: 'invalid-enforcement'
        enabled: 'not-boolean'
    enabled: true
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      // Should throw validation error
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle empty policies array in YAML', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'empty-policies-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
policies: []
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      const loadedConfig = await loadConfig(testDir);
      expect(Array.isArray(loadedConfig.policies)).toBe(true);
      expect(loadedConfig.policies).toHaveLength(0);
    });

    it('should handle null policies in YAML', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'null-policies-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
policies: null
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      const loadedConfig = await loadConfig(testDir);
      // Should default to empty array
      expect(loadedConfig.policies).toEqual([]);
    });

    it('should validate policy rule enforcement values', () => {
      const validEnforcements = ['off', 'warn', 'error', 'strict', 'audit'];

      for (const enforcement of validEnforcements) {
        const config = {
          version: '1.0',
          project: {
            name: 'enforcement-test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          policies: [
            {
              id: 'enforcement-test-policy',
              name: 'Enforcement Test',
              rules: [
                {
                  id: 'enforcement-rule',
                  type: 'path',
                  name: 'Test Rule',
                  patterns: ['**/*'],
                  enforcement,
                  enabled: true,
                }
              ],
              enabled: true,
            }
          ],
        };

        const parsedConfig = ApexConfigSchema.parse(config);
        expect(parsedConfig.policies[0].rules[0].enforcement).toBe(enforcement);
      }
    });

    it('should reject invalid policy rule enforcement values', () => {
      const invalidConfig = {
        version: '1.0',
        project: {
          name: 'invalid-enforcement-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [
          {
            id: 'invalid-enforcement-policy',
            name: 'Invalid Enforcement Test',
            rules: [
              {
                id: 'invalid-rule',
                type: 'path',
                name: 'Invalid Rule',
                patterns: ['**/*'],
                enforcement: 'invalid-value',
                enabled: true,
              }
            ],
            enabled: true,
          }
        ],
      };

      expect(() => ApexConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('Type Safety and Inference', () => {
    it('should provide correct TypeScript types for policies', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'type-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [
          {
            id: 'type-test-policy',
            name: 'Type Test Policy',
            description: 'Policy for type testing',
            rules: [
              {
                id: 'type-test-rule',
                type: 'path',
                name: 'Type Test Rule',
                description: 'Rule for type testing',
                patterns: ['src/**/*.ts'],
                enforcement: 'warn',
                enabled: true,
              }
            ],
            enabled: true,
            enforcement: 'audit',
          }
        ],
      };

      // These should compile without TypeScript errors
      const policyId: string = config.policies?.[0]?.id ?? '';
      const policyName: string = config.policies?.[0]?.name ?? '';
      const ruleType: 'path' | 'test' | 'approval' = config.policies?.[0]?.rules[0]?.type ?? 'path';
      const enforcement: 'off' | 'warn' | 'error' | 'strict' | 'audit' =
        config.policies?.[0]?.enforcement ?? 'warn';

      expect(policyId).toBe('type-test-policy');
      expect(policyName).toBe('Type Test Policy');
      expect(ruleType).toBe('path');
      expect(enforcement).toBe('audit');
    });

    it('should infer correct types from parsed config', () => {
      const rawConfig = {
        version: '1.0',
        project: {
          name: 'inference-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [
          {
            id: 'inference-policy',
            name: 'Inference Policy',
            rules: [],
            enabled: true,
          }
        ],
      };

      const parsedConfig = ApexConfigSchema.parse(rawConfig);

      // TypeScript should infer these correctly
      const policies: Policy[] = parsedConfig.policies;
      const firstPolicy: Policy | undefined = policies[0];

      expect(Array.isArray(policies)).toBe(true);
      expect(firstPolicy?.id).toBe('inference-policy');
    });
  });
});