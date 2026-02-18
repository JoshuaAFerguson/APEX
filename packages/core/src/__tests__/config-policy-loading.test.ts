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
import { ApexConfig, ApexConfigSchema } from '../types.js';

describe('Config Policy Loading', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-policy-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Policy Configuration Loading', () => {
    it('should load minimal policy configuration', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'strict',
          enabled: true,
        },
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy).toBeDefined();
      expect(loaded.policy?.enforcement).toBe('strict');
      expect(loaded.policy?.enabled).toBe(true);
    });

    it('should load policy with allowed paths configuration', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'policy-paths-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: [
              'src/**/*.ts',
              'tests/**/*.test.ts',
              'docs/**/*.md',
            ],
            block: [
              'node_modules/**',
              '.git/**',
              '**/*.log',
              'coverage/**',
            ],
            sensitivePatterns: [
              '.env*',
              '**/*.key',
              '**/*.pem',
              '**/secrets/**',
            ],
            followSymlinks: false,
            maxDepth: 15,
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.allowedPaths).toBeDefined();
      expect(loaded.policy?.allowedPaths?.mode).toBe('allowlist');
      expect(loaded.policy?.allowedPaths?.allow).toEqual([
        'src/**/*.ts',
        'tests/**/*.test.ts',
        'docs/**/*.md',
      ]);
      expect(loaded.policy?.allowedPaths?.block).toEqual([
        'node_modules/**',
        '.git/**',
        '**/*.log',
        'coverage/**',
      ]);
      expect(loaded.policy?.allowedPaths?.sensitivePatterns).toEqual([
        '.env*',
        '**/*.key',
        '**/*.pem',
        '**/secrets/**',
      ]);
      expect(loaded.policy?.allowedPaths?.followSymlinks).toBe(false);
      expect(loaded.policy?.allowedPaths?.maxDepth).toBe(15);
    });

    it('should load policy with required tests configuration', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'policy-tests-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          requiredTests: {
            enforcement: 'require',
            rules: [
              {
                name: 'typescript-unit-tests',
                description: 'All TypeScript source files must have unit tests',
                sourcePatterns: ['src/**/*.ts'],
                testPatterns: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
                minCoverage: 80,
                tags: ['unit', 'typescript'],
                enabled: true,
              },
              {
                name: 'component-tests',
                description: 'React components require specific test patterns',
                sourcePatterns: ['src/components/**/*.tsx'],
                testPatterns: ['src/components/**/*.test.tsx'],
                testNamingConvention: '{dir}/__tests__/{basename}.test.tsx',
                minCoverage: 90,
                tags: ['component', 'react'],
                enabled: true,
              },
            ],
            testCommand: 'npm run test:unit',
            coverageCommand: 'npm run test:coverage',
            coverageReportPath: 'coverage/lcov.info',
            excludePatterns: ['**/*.d.ts', '**/index.ts'],
            blockOnFailure: true,
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.requiredTests).toBeDefined();
      expect(loaded.policy?.requiredTests?.enforcement).toBe('require');
      expect(loaded.policy?.requiredTests?.rules).toHaveLength(2);

      const rule1 = loaded.policy?.requiredTests?.rules?.[0];
      expect(rule1?.name).toBe('typescript-unit-tests');
      expect(rule1?.sourcePatterns).toEqual(['src/**/*.ts']);
      expect(rule1?.testPatterns).toEqual(['src/**/*.test.ts', 'tests/**/*.test.ts']);
      expect(rule1?.minCoverage).toBe(80);
      expect(rule1?.tags).toEqual(['unit', 'typescript']);

      const rule2 = loaded.policy?.requiredTests?.rules?.[1];
      expect(rule2?.name).toBe('component-tests');
      expect(rule2?.testNamingConvention).toBe('{dir}/__tests__/{basename}.test.tsx');
      expect(rule2?.minCoverage).toBe(90);

      expect(loaded.policy?.requiredTests?.testCommand).toBe('npm run test:unit');
      expect(loaded.policy?.requiredTests?.coverageCommand).toBe('npm run test:coverage');
      expect(loaded.policy?.requiredTests?.blockOnFailure).toBe(true);
    });

    it('should load policy with approval rules configuration', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'policy-approval-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'strict',
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'sensitive-files-rule',
                name: 'sensitive-files',
                description: 'Changes to sensitive files require approval',
                conditions: [
                  {
                    type: 'file-pattern',
                    patterns: ['**/*.env*', '**/secrets/**', '**/*.key'],
                    description: 'Sensitive file patterns',
                  },
                ],
                approvers: ['security@company.com', 'devops@company.com'],
                minApprovals: 1,
                timeoutMinutes: 120,
                timeoutAction: 'reject',
                enabled: true,
                priority: 10,
                tags: ['security', 'sensitive'],
              },
              {
                id: 'high-cost-operations',
                name: 'high-cost-ops',
                description: 'High-cost operations require manager approval',
                conditions: [
                  {
                    type: 'cost-threshold',
                    threshold: 25.0,
                    description: 'Operations over $25',
                  },
                  {
                    type: 'custom',
                    expression: 'operationType === "deploy" && environment === "production"',
                    description: 'Production deployments',
                  },
                ],
                approvers: ['manager@company.com'],
                minApprovals: 1,
                timeoutMinutes: 60,
                timeoutAction: 'escalate',
                enabled: true,
                priority: 5,
                tags: ['cost', 'production'],
              },
            ],
            defaultTimeoutMinutes: 90,
            defaultTimeoutAction: 'reject',
            globalApprovers: ['admin@company.com'],
            notificationsEnabled: true,
            notificationChannels: {
              slack: 'https://hooks.slack.com/services/TEST/WEBHOOK/URL',
              email: ['approvals@company.com'],
              webhook: 'https://api.company.com/approval-webhook',
            },
            auditLog: true,
            auditLogPath: 'audit/approvals.log',
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.approvalRules).toBeDefined();
      expect(loaded.policy?.approvalRules?.enabled).toBe(true);
      expect(loaded.policy?.approvalRules?.rules).toHaveLength(2);

      const rule1 = loaded.policy?.approvalRules?.rules?.[0];
      expect(rule1?.id).toBe('sensitive-files-rule');
      expect(rule1?.name).toBe('sensitive-files');
      expect(rule1?.conditions).toHaveLength(1);
      expect(rule1?.conditions?.[0]?.type).toBe('file-pattern');
      expect(rule1?.conditions?.[0]?.patterns).toEqual(['**/*.env*', '**/secrets/**', '**/*.key']);
      expect(rule1?.approvers).toEqual(['security@company.com', 'devops@company.com']);
      expect(rule1?.priority).toBe(10);

      const rule2 = loaded.policy?.approvalRules?.rules?.[1];
      expect(rule2?.id).toBe('high-cost-operations');
      expect(rule2?.conditions).toHaveLength(2);
      expect(rule2?.conditions?.[0]?.type).toBe('cost-threshold');
      expect(rule2?.conditions?.[0]?.threshold).toBe(25.0);
      expect(rule2?.conditions?.[1]?.type).toBe('custom');

      expect(loaded.policy?.approvalRules?.globalApprovers).toEqual(['admin@company.com']);
      expect(loaded.policy?.approvalRules?.notificationChannels?.slack).toBe('https://hooks.slack.com/services/TEST/WEBHOOK/URL');
    });

    it('should load complete enterprise-level policy configuration', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'enterprise-policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          version: '2.0',
          name: 'Enterprise Development Policy',
          description: 'Comprehensive policy for enterprise-grade development',
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: [
              'src/**/*.{ts,tsx,js,jsx}',
              'tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
              'docs/**/*.md',
              'package.json',
              'tsconfig.json',
              '*.config.{js,ts}',
            ],
            block: [
              'node_modules/**',
              'dist/**',
              'build/**',
              '.git/**',
              '**/*.log',
              '**/tmp/**',
            ],
            sensitivePatterns: [
              '.env*',
              '**/*.key',
              '**/*.pem',
              '**/*.secret',
              '**/secrets/**',
              '**/config/production.*',
            ],
            followSymlinks: false,
            maxDepth: 20,
          },
          requiredTests: {
            enforcement: 'require',
            rules: [
              {
                name: 'api-tests',
                description: 'API endpoints must have integration tests',
                sourcePatterns: ['src/api/**/*.ts', 'src/routes/**/*.ts'],
                testPatterns: ['tests/api/**/*.test.ts', 'tests/integration/**/*.test.ts'],
                minCoverage: 85,
                tags: ['api', 'integration'],
                enabled: true,
              },
              {
                name: 'utility-tests',
                description: 'Utility functions require comprehensive tests',
                sourcePatterns: ['src/utils/**/*.ts', 'src/lib/**/*.ts'],
                testPatterns: ['src/utils/**/*.test.ts', 'tests/utils/**/*.test.ts'],
                minCoverage: 95,
                tags: ['utils', 'unit'],
                enabled: true,
              },
            ],
            testCommand: 'npm run test:ci',
            coverageCommand: 'npm run test:coverage',
            coverageReportPath: 'coverage/lcov.info',
            excludePatterns: ['**/*.d.ts', '**/index.ts', '**/*.stories.tsx'],
            blockOnFailure: true,
          },
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'production-deploy',
                name: 'production-deployment',
                description: 'Production deployments require dual approval',
                conditions: [
                  {
                    type: 'operation',
                    operations: ['deploy'],
                    description: 'Deployment operations',
                  },
                  {
                    type: 'custom',
                    expression: 'environment === "production"',
                    description: 'Production environment',
                  },
                ],
                approvers: ['lead@company.com', 'manager@company.com'],
                minApprovals: 2,
                timeoutMinutes: 240,
                timeoutAction: 'escalate',
                enabled: true,
                priority: 10,
                tags: ['production', 'deployment', 'critical'],
              },
            ],
            defaultTimeoutMinutes: 120,
            defaultTimeoutAction: 'reject',
            globalApprovers: ['cto@company.com'],
            notificationsEnabled: true,
            auditLog: true,
            auditLogPath: 'audit/enterprise-approvals.log',
          },
          enabled: true,
          tags: ['enterprise', 'compliance', 'security'],
          metadata: {
            owner: 'platform-team',
            lastReviewed: '2024-01-01',
            complianceFrameworks: ['SOX', 'ISO27001'],
          },
        },
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy).toBeDefined();
      expect(loaded.policy?.version).toBe('2.0');
      expect(loaded.policy?.name).toBe('Enterprise Development Policy');
      expect(loaded.policy?.enforcement).toBe('strict');
      expect(loaded.policy?.tags).toEqual(['enterprise', 'compliance', 'security']);
      expect(loaded.policy?.metadata?.owner).toBe('platform-team');
      expect(loaded.policy?.metadata?.complianceFrameworks).toEqual(['SOX', 'ISO27001']);

      // Verify all sections are loaded correctly
      expect(loaded.policy?.allowedPaths?.allow).toContain('src/**/*.{ts,tsx,js,jsx}');
      expect(loaded.policy?.requiredTests?.rules).toHaveLength(2);
      expect(loaded.policy?.approvalRules?.rules).toHaveLength(1);
    });
  });

  describe('Config Validation Error Handling', () => {
    it('should handle invalid YAML syntax gracefully', async () => {
      const invalidYaml = `
version: "1.0"
project:
  name: test
policy:
  enforcement: strict
  allowedPaths:
    mode: allowlist
    allow:
      - src/**
      - invalid: yaml: syntax: here
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidYaml);

      await expect(loadConfig(testDir)).rejects.toThrow(/Failed to load APEX config/);
    });

    it('should handle invalid policy enforcement values', async () => {
      const configWithInvalidEnforcement = {
        version: '1.0',
        project: {
          name: 'invalid-enforcement-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'invalid-enforcement-mode',
          enabled: true,
        },
      };

      const yamlContent = yaml.stringify(configWithInvalidEnforcement);
      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), yamlContent);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle invalid path access modes', async () => {
      const configWithInvalidPathMode = {
        version: '1.0',
        project: {
          name: 'invalid-path-mode-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'invalid-mode',
            allow: ['src/**'],
          },
          enabled: true,
        },
      };

      const yamlContent = yaml.stringify(configWithInvalidPathMode);
      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), yamlContent);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle invalid test rule configurations', async () => {
      const configWithInvalidTestRule = {
        version: '1.0',
        project: {
          name: 'invalid-test-rule-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          requiredTests: {
            enforcement: 'require',
            rules: [
              {
                // Missing required name field
                sourcePatterns: ['src/**/*.ts'],
                testPatterns: ['**/*.test.ts'],
              },
            ],
          },
          enabled: true,
        },
      };

      const yamlContent = yaml.stringify(configWithInvalidTestRule);
      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), yamlContent);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle invalid approval rule configurations', async () => {
      const configWithInvalidApprovalRule = {
        version: '1.0',
        project: {
          name: 'invalid-approval-rule-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'test-rule',
                // Missing required name and conditions fields
              },
            ],
          },
          enabled: true,
        },
      };

      const yamlContent = yaml.stringify(configWithInvalidApprovalRule);
      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), yamlContent);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe('getEffectiveConfig with Policy Defaults', () => {
    it('should provide comprehensive policy defaults', () => {
      const minimalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'minimal-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const effective = getEffectiveConfig(minimalConfig);

      // Policy should be defined with defaults
      expect(effective.policy).toBeDefined();
      expect(effective.policy.version).toBe('1.0');
      expect(effective.policy.enforcement).toBe('warn');
      expect(effective.policy.enabled).toBe(true);

      // AllowedPaths defaults
      expect(effective.policy.allowedPaths.mode).toBe('allowlist');
      expect(effective.policy.allowedPaths.allow).toContain('src/**');
      expect(effective.policy.allowedPaths.allow).toContain('lib/**');
      expect(effective.policy.allowedPaths.allow).toContain('tests/**');
      expect(effective.policy.allowedPaths.block).toContain('node_modules/**');
      expect(effective.policy.allowedPaths.block).toContain('.git/**');
      expect(effective.policy.allowedPaths.sensitivePatterns).toContain('.env*');
      expect(effective.policy.allowedPaths.followSymlinks).toBe(false);
      expect(effective.policy.allowedPaths.maxDepth).toBe(10);

      // RequiredTests defaults
      expect(effective.policy.requiredTests.enforcement).toBe('warn');
      expect(effective.policy.requiredTests.rules).toEqual([]);
      expect(effective.policy.requiredTests.excludePatterns).toContain('**/*.d.ts');
      expect(effective.policy.requiredTests.blockOnFailure).toBe(true);

      // ApprovalRules defaults
      expect(effective.policy.approvalRules.enabled).toBe(true);
      expect(effective.policy.approvalRules.rules).toEqual([]);
      expect(effective.policy.approvalRules.defaultTimeoutMinutes).toBe(60);
      expect(effective.policy.approvalRules.defaultTimeoutAction).toBe('reject');
      expect(effective.policy.approvalRules.globalApprovers).toEqual([]);
      expect(effective.policy.approvalRules.notificationsEnabled).toBe(true);
      expect(effective.policy.approvalRules.auditLog).toBe(true);
      expect(effective.policy.approvalRules.auditLogPath).toBe('approval-audit.log');
    });

    it('should merge partial policy config with defaults', () => {
      const partialPolicyConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'partial-policy-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'strict',
          allowedPaths: {
            mode: 'blocklist',
            allow: ['custom/**'],
          },
          // Missing requiredTests and approvalRules - should get defaults
        },
      };

      const effective = getEffectiveConfig(partialPolicyConfig);

      // Explicit values should be preserved
      expect(effective.policy.enforcement).toBe('strict');
      expect(effective.policy.allowedPaths.mode).toBe('blocklist');
      expect(effective.policy.allowedPaths.allow).toEqual(['custom/**']);

      // Missing nested config should get defaults
      expect(effective.policy.allowedPaths.block).toEqual([
        'node_modules/**',
        '.git/**',
        '**/*.log',
        '**/*.tmp',
        'coverage/**',
        'dist/**',
        'build/**'
      ]);
      expect(effective.policy.requiredTests.enforcement).toBe('warn');
      expect(effective.policy.approvalRules.enabled).toBe(true);
    });

    it('should handle complex partial policy configurations', () => {
      const complexPartialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-partial-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          name: 'Custom Policy',
          enforcement: 'audit',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**', 'lib/**'],
            // missing block and sensitivePatterns
            followSymlinks: true,
            maxDepth: 5,
          },
          requiredTests: {
            enforcement: 'require',
            // missing rules and other fields
          },
          approvalRules: {
            enabled: false,
            // missing rules and other fields
          },
        },
      };

      const effective = getEffectiveConfig(complexPartialConfig);

      expect(effective.policy.name).toBe('Custom Policy');
      expect(effective.policy.enforcement).toBe('audit');

      // Partial allowedPaths config
      expect(effective.policy.allowedPaths.allow).toEqual(['src/**', 'lib/**']);
      expect(effective.policy.allowedPaths.followSymlinks).toBe(true);
      expect(effective.policy.allowedPaths.maxDepth).toBe(5);
      // Missing fields should get defaults
      expect(effective.policy.allowedPaths.block).toEqual([
        'node_modules/**',
        '.git/**',
        '**/*.log',
        '**/*.tmp',
        'coverage/**',
        'dist/**',
        'build/**'
      ]);

      // Partial requiredTests config
      expect(effective.policy.requiredTests.enforcement).toBe('require');
      expect(effective.policy.requiredTests.rules).toEqual([]);
      expect(effective.policy.requiredTests.blockOnFailure).toBe(true);

      // Partial approvalRules config
      expect(effective.policy.approvalRules.enabled).toBe(false);
      expect(effective.policy.approvalRules.rules).toEqual([]);
      expect(effective.policy.approvalRules.defaultTimeoutMinutes).toBe(60);
    });
  });

  describe('initializeApex Policy Integration', () => {
    it('should initialize project with complete policy defaults', async () => {
      await initializeApex(testDir, {
        projectName: 'policy-init-test',
        language: 'typescript',
        framework: 'nextjs',
      });

      const config = await loadConfig(testDir);

      expect(config.policy).toBeDefined();
      expect(config.policy?.enforcement).toBe('warn');
      expect(config.policy?.enabled).toBe(true);

      // Check allowedPaths initialization
      expect(config.policy?.allowedPaths?.mode).toBe('allowlist');
      expect(config.policy?.allowedPaths?.allow).toContain('src/**');
      expect(config.policy?.allowedPaths?.allow).toContain('*.ts');
      expect(config.policy?.allowedPaths?.allow).toContain('*.tsx');
      expect(config.policy?.allowedPaths?.block).toContain('node_modules/**');
      expect(config.policy?.allowedPaths?.sensitivePatterns).toContain('.env*');

      // Verify the config can be loaded effectively
      const effective = getEffectiveConfig(config);
      expect(effective.policy.enabled).toBe(true);
    });

    it('should create valid policy configuration that passes all validation', async () => {
      await initializeApex(testDir, { projectName: 'validation-test' });

      const config = await loadConfig(testDir);

      // The config should pass schema validation
      expect(() => ApexConfigSchema.parse(config)).not.toThrow();

      // The effective config should also be valid
      const effective = getEffectiveConfig(config);
      expect(effective.policy.version).toBe('1.0');
      expect(effective.policy.enforcement).toBe('warn');
      expect(effective.policy.enabled).toBe(true);
    });
  });

  describe('Policy Configuration Edge Cases', () => {
    it('should handle empty arrays in policy configuration', async () => {
      const configWithEmptyArrays: ApexConfig = {
        version: '1.0',
        project: {
          name: 'empty-arrays-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: [],
            block: [],
            sensitivePatterns: [],
          },
          requiredTests: {
            enforcement: 'warn',
            rules: [],
            excludePatterns: [],
          },
          approvalRules: {
            enabled: true,
            rules: [],
            globalApprovers: [],
          },
          tags: [],
          metadata: {},
          enabled: true,
        },
      };

      await saveConfig(testDir, configWithEmptyArrays);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.allowedPaths?.allow).toEqual([]);
      expect(loaded.policy?.allowedPaths?.block).toEqual([]);
      expect(loaded.policy?.allowedPaths?.sensitivePatterns).toEqual([]);
      expect(loaded.policy?.requiredTests?.rules).toEqual([]);
      expect(loaded.policy?.approvalRules?.rules).toEqual([]);
      expect(loaded.policy?.tags).toEqual([]);
      expect(loaded.policy?.metadata).toEqual({});
    });

    it('should handle numeric edge cases in policy configuration', async () => {
      const configWithNumericEdges: ApexConfig = {
        version: '1.0',
        project: {
          name: 'numeric-edges-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            maxDepth: 0, // Edge case: zero depth
          },
          requiredTests: {
            enforcement: 'warn',
            rules: [
              {
                name: 'edge-case-rule',
                sourcePatterns: ['src/**/*.ts'],
                testPatterns: ['**/*.test.ts'],
                minCoverage: 0, // Edge case: zero coverage
              },
            ],
          },
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'edge-rule',
                name: 'edge-rule',
                conditions: [
                  {
                    type: 'cost-threshold',
                    threshold: 0, // Edge case: zero threshold
                  },
                ],
                minApprovals: 1,
                timeoutMinutes: 1, // Edge case: minimum timeout
                priority: 0, // Edge case: zero priority
              },
            ],
            defaultTimeoutMinutes: 1, // Edge case: minimum default timeout
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, configWithNumericEdges);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.allowedPaths?.maxDepth).toBe(0);
      expect(loaded.policy?.requiredTests?.rules?.[0]?.minCoverage).toBe(0);
      expect(loaded.policy?.approvalRules?.rules?.[0]?.priority).toBe(0);
      expect(loaded.policy?.approvalRules?.defaultTimeoutMinutes).toBe(1);
    });

    it('should preserve complex metadata in policy configuration', async () => {
      const configWithComplexMetadata: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-metadata-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'warn',
          metadata: {
            owner: 'platform-team',
            version: '2.1.0',
            lastModified: '2024-01-15T10:30:00Z',
            reviewCycle: 'quarterly',
            approvedBy: ['cto@company.com', 'security-lead@company.com'],
            complianceFrameworks: ['SOX', 'ISO27001', 'PCI-DSS'],
            customFields: {
              businessUnit: 'engineering',
              riskLevel: 'medium',
              documentationUrl: 'https://docs.company.com/policies/dev',
            },
          },
          enabled: true,
        },
      };

      await saveConfig(testDir, configWithComplexMetadata);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.metadata?.owner).toBe('platform-team');
      expect(loaded.policy?.metadata?.version).toBe('2.1.0');
      expect(loaded.policy?.metadata?.approvedBy).toEqual(['cto@company.com', 'security-lead@company.com']);
      expect(loaded.policy?.metadata?.complianceFrameworks).toEqual(['SOX', 'ISO27001', 'PCI-DSS']);
      expect(loaded.policy?.metadata?.customFields).toEqual({
        businessUnit: 'engineering',
        riskLevel: 'medium',
        documentationUrl: 'https://docs.company.com/policies/dev',
      });
    });
  });
});