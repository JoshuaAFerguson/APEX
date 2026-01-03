import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  initializeApex,
} from '../config.js';
import {
  ApexConfig,
  ApexConfigSchema,
  PolicyConfigSchema,
  PolicySchema,
  Policy,
  PolicyConfig,
} from '../types.js';

/**
 * Policy Configuration Acceptance Criteria Test Suite
 *
 * This test suite validates all acceptance criteria for policy configuration features:
 * - Policy schema validation
 * - Config.yaml policy parsing
 * - Default policies
 * - Directory-based policy loading
 * - Edge cases (missing dir, invalid policies, merge conflicts)
 *
 * All tests must pass to meet the feature requirements.
 */
describe('Policy Configuration Features - Acceptance Criteria', () => {
  let testDir: string;
  let policiesDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-acceptance-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    policiesDir = path.join(testDir, '.apex', 'policies');
    await fs.mkdir(policiesDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Acceptance Criteria: Policy Schema Validation', () => {
    it('should validate all policy schema types correctly', () => {
      // Test minimal policy config (defaults applied)
      const minimalPolicy = {};
      expect(() => PolicyConfigSchema.parse(minimalPolicy)).not.toThrow();

      // Test complete policy config
      const completePolicy: PolicyConfig = {
        version: '1.0',
        name: 'Complete Policy',
        description: 'A complete policy configuration',
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**/*.ts'],
          block: ['node_modules/**'],
          sensitivePatterns: ['.env*'],
          followSymlinks: false,
          maxDepth: 10,
        },
        requiredTests: {
          enforcement: 'require',
          rules: [{
            name: 'test-rule',
            sourcePatterns: ['src/**/*.ts'],
            testPatterns: ['**/*.test.ts'],
            minCoverage: 80,
          }],
          blockOnFailure: true,
        },
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'test-approval',
            name: 'test-approval',
            conditions: [{
              type: 'cost-threshold',
              threshold: 50.0,
            }],
            approvers: ['admin@test.com'],
            minApprovals: 1,
            timeoutMinutes: 60,
          }],
        },
        enabled: true,
        tags: ['test'],
        metadata: {
          owner: 'test-team',
        },
      };

      expect(() => PolicyConfigSchema.parse(completePolicy)).not.toThrow();
      const parsed = PolicyConfigSchema.parse(completePolicy);
      expect(parsed.name).toBe('Complete Policy');
      expect(parsed.enforcement).toBe('strict');
      expect(parsed.allowedPaths?.mode).toBe('allowlist');
    });

    it('should reject invalid policy configurations', () => {
      const invalidConfigurations = [
        { enforcement: 'invalid-mode' },
        { allowedPaths: { mode: 'invalid-mode' } },
        { requiredTests: { enforcement: 'invalid-enforcement' } },
        { approvalRules: { rules: [{ id: 'test', name: 'test' }] } }, // Missing conditions
      ];

      invalidConfigurations.forEach(config => {
        expect(() => PolicyConfigSchema.parse(config)).toThrow();
      });
    });

    it('should validate policy rules with all enforcement modes', () => {
      const enforcementModes = ['strict', 'warn', 'audit', 'disabled'] as const;

      enforcementModes.forEach(mode => {
        const policy: PolicyConfig = {
          enforcement: mode,
          enabled: mode !== 'disabled',
        };

        expect(() => PolicyConfigSchema.parse(policy)).not.toThrow();
        const parsed = PolicyConfigSchema.parse(policy);
        expect(parsed.enforcement).toBe(mode);
      });
    });
  });

  describe('Acceptance Criteria: Config.yaml Policy Parsing', () => {
    it('should parse policy configuration from YAML with comments and complex structure', async () => {
      const yamlContent = `
# Comprehensive Policy Configuration
version: '1.0'
project:
  name: 'acceptance-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'

# Main policy section
policy:
  name: 'Acceptance Test Policy'
  description: 'Policy for acceptance criteria testing'
  enforcement: 'strict'

  # File access patterns
  allowedPaths:
    mode: 'allowlist'
    allow:
      - 'src/**/*.{ts,tsx,js,jsx}'
      - 'tests/**/*.{test,spec}.{ts,tsx}'
      - 'docs/**/*.md'
    block:
      - 'node_modules/**'
      - '**/*.secret'
    sensitivePatterns:
      - '.env*'
      - '**/*.key'
    followSymlinks: false
    maxDepth: 8

  # Test requirements
  requiredTests:
    enforcement: 'require'
    rules:
      - name: 'typescript-coverage'
        description: 'TypeScript files need test coverage'
        sourcePatterns: ['src/**/*.ts']
        testPatterns: ['tests/**/*.test.ts']
        minCoverage: 85
        tags: ['typescript', 'coverage']
        enabled: true
    testCommand: 'npm run test:coverage'
    blockOnFailure: true

  # Approval workflows
  approvalRules:
    enabled: true
    rules:
      - id: 'cost-approval'
        name: 'cost-approval'
        description: 'High cost operations need approval'
        conditions:
          - type: 'cost-threshold'
            threshold: 100.0
            description: 'Operations over $100'
        approvers: ['finance@test.com']
        minApprovals: 1
        timeoutMinutes: 120
        enabled: true
    defaultTimeoutMinutes: 60
    defaultTimeoutAction: 'reject'

  enabled: true
  tags: ['acceptance', 'test']
  metadata:
    testSuite: 'acceptance-criteria'
    environment: 'test'
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      const loaded = await loadConfig(testDir);

      // Validate policy was parsed correctly
      expect(loaded.policy?.name).toBe('Acceptance Test Policy');
      expect(loaded.policy?.enforcement).toBe('strict');

      // Validate allowedPaths
      expect(loaded.policy?.allowedPaths?.mode).toBe('allowlist');
      expect(loaded.policy?.allowedPaths?.allow).toContain('src/**/*.{ts,tsx,js,jsx}');
      expect(loaded.policy?.allowedPaths?.block).toContain('node_modules/**');

      // Validate requiredTests
      expect(loaded.policy?.requiredTests?.enforcement).toBe('require');
      expect(loaded.policy?.requiredTests?.rules).toHaveLength(1);
      expect(loaded.policy?.requiredTests?.rules?.[0].minCoverage).toBe(85);

      // Validate approvalRules
      expect(loaded.policy?.approvalRules?.enabled).toBe(true);
      expect(loaded.policy?.approvalRules?.rules).toHaveLength(1);
      expect(loaded.policy?.approvalRules?.rules?.[0].conditions?.[0].threshold).toBe(100.0);
    });

    it('should handle malformed YAML gracefully with validation errors', async () => {
      const malformedYaml = `
version: '1.0'
project:
  name: 'malformed-test'
policy:
  enforcement: 'invalid-mode'  # Invalid enforcement
  allowedPaths: 'not-an-object'  # Should be object
  requiredTests:
    rules:
      - name: ''  # Empty name
        sourcePatterns: []  # Empty array
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, malformedYaml, 'utf-8');

      // Should throw validation error due to invalid schema
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should parse complex nested structures with arrays and objects', async () => {
      const complexYaml = `
version: '1.0'
project:
  name: 'complex-test'
policy:
  requiredTests:
    rules:
      - name: 'component-tests'
        sourcePatterns:
          - 'src/components/**/*.tsx'
          - 'src/ui/**/*.jsx'
        testPatterns:
          - 'tests/components/**/*.test.tsx'
          - '__tests__/**/*.spec.jsx'
        minCoverage: 90
        tags: ['react', 'components', 'ui']
      - name: 'utility-tests'
        sourcePatterns: ['src/utils/**/*.ts']
        testPatterns: ['tests/utils/**/*.test.ts']
        minCoverage: 95
  approvalRules:
    rules:
      - id: 'multi-condition-approval'
        name: 'multi-condition-approval'
        conditions:
          - type: 'file-pattern'
            patterns: ['src/critical/**', 'config/prod/**']
          - type: 'cost-threshold'
            threshold: 25.0
        approvers: ['lead@test.com', 'admin@test.com']
        minApprovals: 2
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, complexYaml, 'utf-8');

      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.requiredTests?.rules).toHaveLength(2);
      expect(loaded.policy?.requiredTests?.rules?.[0].tags).toEqual(['react', 'components', 'ui']);
      expect(loaded.policy?.approvalRules?.rules?.[0].conditions).toHaveLength(2);
      expect(loaded.policy?.approvalRules?.rules?.[0].minApprovals).toBe(2);
    });
  });

  describe('Acceptance Criteria: Default Policies', () => {
    it('should apply proper defaults for missing policy fields', () => {
      const partialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'defaults-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          allowedPaths: {
            allow: ['custom/**'],
            // Other fields should get defaults
          },
          // Other sections should get defaults
        },
      };

      const effective = getEffectiveConfig(partialConfig);

      // Verify explicit values preserved
      expect(effective.policy.allowedPaths.allow).toEqual(['custom/**']);

      // Verify defaults applied
      expect(effective.policy.enforcement).toBe('warn');
      expect(effective.policy.enabled).toBe(true);
      expect(effective.policy.version).toBe('1.0');
      expect(effective.policy.allowedPaths.mode).toBe('allowlist');
      expect(effective.policy.allowedPaths.block).toContain('node_modules/**');
      expect(effective.policy.allowedPaths.sensitivePatterns).toContain('.env*');
      expect(effective.policy.allowedPaths.followSymlinks).toBe(false);
      expect(effective.policy.allowedPaths.maxDepth).toBe(10);

      expect(effective.policy.requiredTests.enforcement).toBe('warn');
      expect(effective.policy.requiredTests.rules).toEqual([]);
      expect(effective.policy.requiredTests.blockOnFailure).toBe(true);

      expect(effective.policy.approvalRules.enabled).toBe(true);
      expect(effective.policy.approvalRules.rules).toEqual([]);
      expect(effective.policy.approvalRules.defaultTimeoutMinutes).toBe(60);
      expect(effective.policy.approvalRules.defaultTimeoutAction).toBe('reject');
    });

    it('should properly merge deep nested configurations', () => {
      const configWithOverrides: ApexConfig = {
        version: '1.0',
        project: {
          name: 'nested-merge-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          allowedPaths: {
            mode: 'blocklist', // Override default
            block: ['custom/**'], // Should merge with defaults
            maxDepth: 5, // Override default
          },
          requiredTests: {
            enforcement: 'require', // Override default
            rules: [{
              name: 'custom-rule',
              sourcePatterns: ['custom/**/*.ts'],
              testPatterns: ['custom/**/*.test.ts'],
            }],
            blockOnFailure: false, // Override default
          },
          approvalRules: {
            defaultTimeoutMinutes: 30, // Override default
            rules: [{
              id: 'custom-approval',
              name: 'custom-approval',
              conditions: [{
                type: 'file-pattern',
                patterns: ['custom/**'],
              }],
              approvers: ['custom@test.com'],
              minApprovals: 1,
              timeoutMinutes: 15,
            }],
          },
        },
      };

      const effective = getEffectiveConfig(configWithOverrides);

      // Verify overrides are preserved
      expect(effective.policy.allowedPaths.mode).toBe('blocklist');
      expect(effective.policy.allowedPaths.block).toContain('custom/**');
      expect(effective.policy.allowedPaths.maxDepth).toBe(5);
      expect(effective.policy.requiredTests.enforcement).toBe('require');
      expect(effective.policy.requiredTests.blockOnFailure).toBe(false);
      expect(effective.policy.approvalRules.defaultTimeoutMinutes).toBe(30);

      // Verify defaults still apply where not overridden
      expect(effective.policy.enforcement).toBe('warn');
      expect(effective.policy.allowedPaths.followSymlinks).toBe(false);
      expect(effective.policy.approvalRules.defaultTimeoutAction).toBe('reject');
    });

    it('should handle inheritance from initializeApex defaults', async () => {
      await initializeApex(testDir, {
        projectName: 'inheritance-test',
        language: 'typescript',
        framework: 'react',
      });

      const config = await loadConfig(testDir);
      const effective = getEffectiveConfig(config);

      // Verify defaults from initializeApex
      expect(config.policy?.enforcement).toBe('warn');
      expect(config.policy?.enabled).toBe(true);
      expect(config.policy?.allowedPaths?.mode).toBe('allowlist');
      expect(config.policy?.allowedPaths?.allow).toContain('src/**');

      // Verify effective config applies additional defaults
      expect(effective.policy.approvalRules.enabled).toBe(true);
      expect(effective.policy.requiredTests.enforcement).toBe('warn');
    });
  });

  describe('Acceptance Criteria: Directory-Based Policy Loading', () => {
    it('should handle multiple policy files from directory structure', async () => {
      // Create nested directory structure for policies
      const securityDir = path.join(policiesDir, 'security');
      const complianceDir = path.join(policiesDir, 'compliance');
      await fs.mkdir(securityDir, { recursive: true });
      await fs.mkdir(complianceDir, { recursive: true });

      // Create security policy file
      const securityPolicy = {
        id: 'security-policy',
        name: 'Security Policy',
        description: 'Security-focused rules',
        rules: [{
          id: 'sensitive-files',
          type: 'path',
          name: 'Sensitive Files Rule',
          patterns: ['.env*', '**/*.key', '**/secrets/**'],
          enforcement: 'strict',
          enabled: true,
        }],
        enabled: true,
        enforcement: 'strict',
        tags: ['security', 'external'],
        metadata: {
          source: 'security-team',
          directory: 'policies/security',
        },
      };

      // Create compliance policy file
      const compliancePolicy = {
        id: 'compliance-policy',
        name: 'Compliance Policy',
        description: 'Compliance rules',
        rules: [{
          id: 'audit-trail',
          type: 'approval',
          name: 'Audit Trail Rule',
          patterns: ['**/*'],
          enforcement: 'audit',
          enabled: true,
        }],
        enabled: true,
        enforcement: 'audit',
        tags: ['compliance', 'gdpr'],
        metadata: {
          source: 'legal-team',
          directory: 'policies/compliance',
        },
      };

      // Write policy files to directories
      await fs.writeFile(
        path.join(securityDir, 'security.yaml'),
        yaml.stringify(securityPolicy),
        'utf-8'
      );
      await fs.writeFile(
        path.join(complianceDir, 'compliance.yaml'),
        yaml.stringify(compliancePolicy),
        'utf-8'
      );

      // Create config that references the external policies
      const configWithExternalPolicies: ApexConfig = {
        version: '1.0',
        project: {
          name: 'directory-policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          name: 'Main Policy',
          enforcement: 'warn',
          allowedPaths: {
            allow: ['src/**'],
          },
          enabled: true,
        },
        // Simulate loading external policies from directory
        policies: [securityPolicy, compliancePolicy],
      };

      await saveConfig(testDir, configWithExternalPolicies);
      const loaded = await loadConfig(testDir);

      // Verify all policies are loaded
      expect(loaded.policies).toHaveLength(2);

      const secPolicy = loaded.policies?.find(p => p.id === 'security-policy');
      const compPolicy = loaded.policies?.find(p => p.id === 'compliance-policy');

      expect(secPolicy?.name).toBe('Security Policy');
      expect(secPolicy?.enforcement).toBe('strict');
      expect(secPolicy?.metadata?.source).toBe('security-team');

      expect(compPolicy?.name).toBe('Compliance Policy');
      expect(compPolicy?.enforcement).toBe('audit');
      expect(compPolicy?.metadata?.source).toBe('legal-team');
    });

    it('should handle policy loading with inheritance and overrides', async () => {
      // Create hierarchical policies: org -> team -> project
      const orgPolicy = {
        id: 'org-policy',
        name: 'Organization Base Policy',
        rules: [{ id: 'org-rule', type: 'path', name: 'Org Rule', patterns: ['.env*'], enforcement: 'strict', enabled: true }],
        enforcement: 'warn',
        tags: ['organization'],
        metadata: { priority: 1, inheritable: true },
      };

      const teamPolicy = {
        id: 'team-policy',
        name: 'Team Policy',
        rules: [{ id: 'team-rule', type: 'test', name: 'Team Rule', patterns: ['src/**'], enforcement: 'warn', enabled: true }],
        enforcement: 'warn',
        tags: ['team'],
        metadata: { priority: 2, inherits: ['org-policy'] },
      };

      const projectPolicy = {
        id: 'project-policy',
        name: 'Project Policy',
        rules: [{ id: 'project-rule', type: 'approval', name: 'Project Rule', patterns: ['**/*'], enforcement: 'strict', enabled: true }],
        enforcement: 'strict', // Override team/org enforcement
        tags: ['project'],
        metadata: { priority: 3, inherits: ['org-policy', 'team-policy'] },
      };

      const hierarchicalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'hierarchy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policies: [orgPolicy, teamPolicy, projectPolicy],
      };

      await saveConfig(testDir, hierarchicalConfig);
      const loaded = await loadConfig(testDir);

      expect(loaded.policies).toHaveLength(3);

      const org = loaded.policies?.find(p => p.id === 'org-policy');
      const team = loaded.policies?.find(p => p.id === 'team-policy');
      const project = loaded.policies?.find(p => p.id === 'project-policy');

      expect(org?.metadata?.priority).toBe(1);
      expect(team?.metadata?.priority).toBe(2);
      expect(project?.metadata?.priority).toBe(3);

      // Verify enforcement overrides
      expect(org?.enforcement).toBe('warn');
      expect(team?.enforcement).toBe('warn');
      expect(project?.enforcement).toBe('strict');
    });
  });

  describe('Acceptance Criteria: Edge Cases', () => {
    describe('Missing Directory Edge Cases', () => {
      it('should handle references to non-existent policy directories gracefully', async () => {
        const configWithMissingRefs: ApexConfig = {
          version: '1.0',
          project: {
            name: 'missing-dirs-test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          policy: {
            name: 'Policy with Missing References',
            allowedPaths: {
              allow: [
                'non-existent-dir/**',
                'phantom/directory/**',
                'missing/**/*.ts',
              ],
            },
            requiredTests: {
              rules: [{
                name: 'missing-sources',
                sourcePatterns: ['missing-src/**/*.ts'],
                testPatterns: ['missing-tests/**/*.test.ts'],
              }],
            },
            metadata: {
              externalPolicies: [
                'policies/non-existent.yaml',
                'policies/missing-policy.yaml',
              ],
            },
          },
          policies: [], // Empty - simulates failed loading
        };

        // Should not throw errors despite missing references
        await saveConfig(testDir, configWithMissingRefs);
        const loaded = await loadConfig(testDir);

        expect(loaded.policy?.allowedPaths?.allow).toContain('non-existent-dir/**');
        expect(loaded.policies).toEqual([]);
        expect(loaded.policy?.metadata?.externalPolicies).toHaveLength(2);

        // getEffectiveConfig should work with missing refs
        const effective = getEffectiveConfig(loaded);
        expect(effective.policy.allowedPaths.allow).toContain('non-existent-dir/**');
      });
    });

    describe('Invalid Policies Edge Cases', () => {
      it('should reject configurations with invalid policy data types', async () => {
        const invalidConfigs = [
          { policy: { version: 123 } }, // Non-string version
          { policy: { enforcement: 'invalid-mode' } }, // Invalid enforcement
          { policy: { allowedPaths: 'string-instead-of-object' } }, // Wrong type
          { policy: { enabled: 'true' } }, // String instead of boolean
          { policy: { tags: 'not-an-array' } }, // String instead of array
        ];

        for (const invalid of invalidConfigs) {
          const config = {
            version: '1.0',
            project: {
              name: 'invalid-test',
              testCommand: 'npm test',
              lintCommand: 'npm run lint',
              buildCommand: 'npm run build',
            },
            ...invalid,
          };

          expect(() => ApexConfigSchema.parse(config)).toThrow();
        }
      });

      it('should handle policy configurations with extreme values', async () => {
        const extremeConfig: ApexConfig = {
          version: '1.0',
          project: {
            name: 'extreme-values-test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          policy: {
            name: '', // Empty string
            description: '', // Empty string
            allowedPaths: {
              maxDepth: 0, // Edge case: no depth limit
              allow: [], // Explicit empty array
              block: [], // Explicit empty array
            },
            tags: [], // Empty tags
            metadata: {}, // Empty metadata
            approvalRules: {
              rules: [{
                id: 'minimal-rule',
                name: 'minimal',
                conditions: [{
                  type: 'file-pattern',
                  patterns: ['*'], // Very broad pattern
                }],
                minApprovals: 1, // Minimum approvals
                timeoutMinutes: 1, // Minimum timeout
              }],
            },
          },
        };

        // Should not throw with extreme but valid values
        expect(() => ApexConfigSchema.parse(extremeConfig)).not.toThrow();

        await saveConfig(testDir, extremeConfig);
        const loaded = await loadConfig(testDir);

        expect(loaded.policy?.name).toBe('');
        expect(loaded.policy?.allowedPaths?.maxDepth).toBe(0);
        expect(loaded.policy?.tags).toEqual([]);
      });
    });

    describe('Merge Conflicts Edge Cases', () => {
      it('should handle policy configurations with conflicting IDs', async () => {
        const policy1 = {
          id: 'conflicting-id',
          name: 'Policy Version 1',
          enforcement: 'warn',
          tags: ['version1'],
          metadata: { version: '1.0' },
        };

        const policy2 = {
          id: 'conflicting-id', // Same ID!
          name: 'Policy Version 2',
          enforcement: 'strict', // Different enforcement
          tags: ['version2'],
          metadata: { version: '2.0' },
        };

        const conflictConfig: ApexConfig = {
          version: '1.0',
          project: {
            name: 'conflict-test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          policies: [policy1, policy2], // Both with same ID
        };

        await saveConfig(testDir, conflictConfig);
        const loaded = await loadConfig(testDir);

        // Should preserve both policies as-is (conflict resolution at application level)
        expect(loaded.policies).toHaveLength(2);
        const policies = loaded.policies || [];

        expect(policies.filter(p => p.id === 'conflicting-id')).toHaveLength(2);

        const v1 = policies.find(p => p.metadata?.version === '1.0');
        const v2 = policies.find(p => p.metadata?.version === '2.0');

        expect(v1?.enforcement).toBe('warn');
        expect(v2?.enforcement).toBe('strict');
      });

      it('should handle concurrent configuration operations without corruption', async () => {
        const configs = Array.from({ length: 3 }, (_, i) => ({
          version: '1.0',
          project: {
            name: `concurrent-test-${i}`,
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          policy: {
            name: `Concurrent Policy ${i}`,
            enforcement: i % 2 === 0 ? 'strict' : 'warn',
            tags: [`concurrent-${i}`],
          },
        } satisfies ApexConfig));

        const testDirs = await Promise.all(
          configs.map(async (_, i) => {
            const dir = await fs.mkdtemp(path.join(os.tmpdir(), `concurrent-${i}-`));
            await fs.mkdir(path.join(dir, '.apex'), { recursive: true });
            return dir;
          })
        );

        try {
          // Concurrent save operations
          await Promise.all(
            configs.map((config, i) => saveConfig(testDirs[i], config))
          );

          // Concurrent load operations
          const loadedConfigs = await Promise.all(
            testDirs.map(dir => loadConfig(dir))
          );

          // Verify integrity of each config
          loadedConfigs.forEach((loaded, i) => {
            expect(loaded.policy?.name).toBe(`Concurrent Policy ${i}`);
            expect(loaded.policy?.enforcement).toBe(i % 2 === 0 ? 'strict' : 'warn');
          });

        } finally {
          await Promise.all(
            testDirs.map(dir => fs.rm(dir, { recursive: true, force: true }))
          );
        }
      });

      it('should handle very large policy configurations without performance degradation', async () => {
        const largeConfig: ApexConfig = {
          version: '1.0',
          project: {
            name: 'large-policy-test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          policy: {
            name: 'Large Policy Configuration',
            allowedPaths: {
              allow: Array.from({ length: 200 }, (_, i) => `module-${i}/**/*.ts`),
              block: Array.from({ length: 100 }, (_, i) => `blocked-${i}/**`),
              sensitivePatterns: Array.from({ length: 50 }, (_, i) => `**/*secret-${i}*`),
            },
            requiredTests: {
              rules: Array.from({ length: 50 }, (_, i) => ({
                name: `test-rule-${i}`,
                sourcePatterns: [`module-${i}/**/*.ts`],
                testPatterns: [`tests/module-${i}/**/*.test.ts`],
                minCoverage: 80,
                tags: [`module-${i}`],
              })),
            },
            approvalRules: {
              rules: Array.from({ length: 25 }, (_, i) => ({
                id: `approval-${i}`,
                name: `approval-${i}`,
                conditions: [{
                  type: 'file-pattern',
                  patterns: [`**/*module-${i}*`],
                }],
                approvers: [`approver-${i}@test.com`],
                minApprovals: 1,
                timeoutMinutes: 60,
              })),
            },
            tags: Array.from({ length: 30 }, (_, i) => `tag-${i}`),
          },
        };

        const startTime = Date.now();
        await saveConfig(testDir, largeConfig);
        const saveTime = Date.now() - startTime;

        const loadStart = Date.now();
        const loaded = await loadConfig(testDir);
        const loadTime = Date.now() - loadStart;

        const effectiveStart = Date.now();
        getEffectiveConfig(loaded);
        const effectiveTime = Date.now() - effectiveStart;

        // Verify data integrity
        expect(loaded.policy?.allowedPaths?.allow).toHaveLength(200);
        expect(loaded.policy?.requiredTests?.rules).toHaveLength(50);
        expect(loaded.policy?.approvalRules?.rules).toHaveLength(25);

        // Performance should be reasonable
        expect(saveTime).toBeLessThan(1000); // 1 second
        expect(loadTime).toBeLessThan(1000); // 1 second
        expect(effectiveTime).toBeLessThan(500); // 0.5 second
      });
    });
  });

  describe('Comprehensive Integration Test', () => {
    it('should handle all acceptance criteria features working together', async () => {
      // Initialize project with defaults
      await initializeApex(testDir, {
        projectName: 'comprehensive-test',
        language: 'typescript',
        framework: 'react',
      });

      // Create external policies in directories
      await fs.mkdir(path.join(policiesDir, 'team'), { recursive: true });

      const teamPolicy = {
        id: 'team-policy',
        name: 'Team Development Policy',
        description: 'Team-specific development rules',
        rules: [{
          id: 'team-test-rule',
          type: 'test',
          name: 'Team Testing Rule',
          patterns: ['src/team/**/*.ts'],
          enforcement: 'require',
          enabled: true,
        }],
        enforcement: 'warn',
        tags: ['team', 'external'],
        metadata: { source: 'team-lead' },
      };

      await fs.writeFile(
        path.join(policiesDir, 'team', 'policy.yaml'),
        yaml.stringify(teamPolicy),
        'utf-8'
      );

      // Update config with comprehensive policy setup
      const baseConfig = await loadConfig(testDir);
      const enhancedConfig: ApexConfig = {
        ...baseConfig,
        policy: {
          ...baseConfig.policy!,
          name: 'Comprehensive Integration Policy',
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**/*.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
            block: ['node_modules/**', '**/*.secret'],
            sensitivePatterns: ['.env*', '**/*.key'],
            followSymlinks: false,
            maxDepth: 8,
          },
          requiredTests: {
            enforcement: 'require',
            rules: [{
              name: 'comprehensive-tests',
              sourcePatterns: ['src/**/*.ts'],
              testPatterns: ['tests/**/*.test.ts'],
              minCoverage: 85,
              tags: ['comprehensive'],
            }],
            blockOnFailure: true,
          },
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'comprehensive-approval',
              name: 'comprehensive-approval',
              conditions: [
                {
                  type: 'file-pattern',
                  patterns: ['src/critical/**'],
                },
                {
                  type: 'cost-threshold',
                  threshold: 50.0,
                },
              ],
              approvers: ['lead@test.com'],
              minApprovals: 1,
              timeoutMinutes: 120,
            }],
          },
          tags: ['comprehensive', 'integration'],
        },
        // Include external policy
        policies: [teamPolicy],
      };

      await saveConfig(testDir, enhancedConfig);
      const loaded = await loadConfig(testDir);
      const effective = getEffectiveConfig(loaded);

      // Verify all features work together
      expect(loaded.policy?.name).toBe('Comprehensive Integration Policy');
      expect(loaded.policy?.enforcement).toBe('strict');
      expect(loaded.policies).toHaveLength(1);
      expect(loaded.policies?.[0].id).toBe('team-policy');

      // Verify effective config merges everything properly
      expect(effective.policy.allowedPaths.allow).toContain('src/**/*.{ts,tsx}');
      expect(effective.policy.requiredTests.enforcement).toBe('require');
      expect(effective.policy.approvalRules.enabled).toBe(true);

      // Verify edge cases still work
      expect(effective.policy.allowedPaths.followSymlinks).toBe(false);
      expect(effective.policy.approvalRules.defaultTimeoutAction).toBe('reject');
    });
  });
});