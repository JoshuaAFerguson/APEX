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

describe('Policy Configuration Comprehensive Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-policy-comprehensive-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Policy Schema Validation Edge Cases', () => {
    it('should validate policy config with minimal required fields', () => {
      const minimalPolicy = {};
      const parsed = PolicyConfigSchema.parse(minimalPolicy);

      expect(parsed.version).toBe('1.0');
      expect(parsed.enforcement).toBe('warn');
      expect(parsed.enabled).toBe(true);
      expect(parsed.tags).toEqual([]);
      expect(parsed.metadata).toBeUndefined();
    });

    it('should validate policy config with all optional fields', () => {
      const fullPolicy: PolicyConfig = {
        version: '2.1',
        name: 'Full Test Policy',
        description: 'A policy with all possible fields',
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**/*.ts', 'tests/**/*.test.ts'],
          block: ['node_modules/**', '**/*.tmp'],
          sensitivePatterns: ['.env*', '**/*.key', '**/*.secret'],
          followSymlinks: true,
          maxDepth: 15,
        },
        requiredTests: {
          enforcement: 'require',
          rules: [
            {
              name: 'comprehensive-tests',
              description: 'Comprehensive test requirements',
              sourcePatterns: ['src/**/*.ts'],
              testPatterns: ['tests/**/*.test.ts', '**/__tests__/**/*.ts'],
              testNamingConvention: '{dir}/__tests__/{basename}.test.ts',
              minCoverage: 85,
              tags: ['unit', 'integration'],
              enabled: true,
            },
          ],
          testCommand: 'npm run test:coverage',
          coverageCommand: 'npm run coverage:report',
          coverageReportPath: 'coverage/coverage.xml',
          excludePatterns: ['**/*.d.ts', '**/index.ts'],
          blockOnFailure: true,
        },
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'comprehensive-approval',
              name: 'comprehensive-approval',
              description: 'Comprehensive approval rule',
              conditions: [
                {
                  type: 'file-pattern',
                  patterns: ['**/*.config.ts', '**/important/**'],
                  description: 'Important configuration files',
                },
                {
                  type: 'cost-threshold',
                  threshold: 25.0,
                  description: 'Operations over $25',
                },
                {
                  type: 'custom',
                  expression: 'fileCount > 5 && operationType === "modify"',
                  description: 'Large modification operations',
                },
              ],
              approvers: ['lead@company.com', 'manager@company.com'],
              minApprovals: 2,
              timeoutMinutes: 180,
              timeoutAction: 'escalate',
              enabled: true,
              priority: 7,
              tags: ['security', 'compliance'],
            },
          ],
          defaultTimeoutMinutes: 120,
          defaultTimeoutAction: 'reject',
          globalApprovers: ['admin@company.com'],
          notificationsEnabled: true,
          notificationChannels: {
            slack: 'https://hooks.slack.com/test',
            email: ['team@company.com'],
            webhook: 'https://api.company.com/webhook',
          },
          auditLog: true,
          auditLogPath: 'audit/comprehensive.log',
        },
        enabled: true,
        tags: ['comprehensive', 'testing', 'validation'],
        metadata: {
          owner: 'test-team',
          version: '1.0',
          environment: 'test',
          lastUpdated: '2024-01-01',
          reviewers: ['reviewer1', 'reviewer2'],
          customField: 'custom-value',
        },
      };

      const parsed = PolicyConfigSchema.parse(fullPolicy);
      expect(parsed).toMatchObject(fullPolicy);
    });

    it('should reject invalid policy config structures', () => {
      // Invalid enforcement mode
      expect(() => PolicyConfigSchema.parse({ enforcement: 'invalid-mode' })).toThrow();

      // Invalid version (non-string)
      expect(() => PolicyConfigSchema.parse({ version: 123 })).toThrow();

      // Invalid allowedPaths mode
      expect(() => PolicyConfigSchema.parse({
        allowedPaths: { mode: 'invalid-mode' }
      })).toThrow();

      // Invalid maxDepth (negative)
      expect(() => PolicyConfigSchema.parse({
        allowedPaths: { maxDepth: -5 }
      })).toThrow();

      // Invalid required tests enforcement
      expect(() => PolicyConfigSchema.parse({
        requiredTests: { enforcement: 'invalid-enforcement' }
      })).toThrow();

      // Invalid approval rule structure
      expect(() => PolicyConfigSchema.parse({
        approvalRules: {
          rules: [{
            id: 'test',
            name: 'test',
            // Missing required conditions
          }]
        }
      })).toThrow();
    });

    it('should handle edge case values in policy config', () => {
      const edgeCasePolicy = {
        // Empty strings where allowed
        name: '',
        description: '',

        // Edge case numeric values
        allowedPaths: {
          maxDepth: 0, // Should be valid (no limit)
        },

        // Empty arrays
        tags: [],

        // Empty metadata object
        metadata: {},

        // Minimal approval rule
        approvalRules: {
          rules: [{
            id: 'minimal-rule',
            name: 'minimal',
            conditions: [{
              type: 'file-pattern',
              patterns: ['*'] // Very broad pattern
            }],
            minApprovals: 1,
            timeoutMinutes: 1, // Minimum timeout
          }]
        }
      };

      expect(() => PolicyConfigSchema.parse(edgeCasePolicy)).not.toThrow();
      const parsed = PolicyConfigSchema.parse(edgeCasePolicy);
      expect(parsed.allowedPaths?.maxDepth).toBe(0);
      expect(parsed.tags).toEqual([]);
    });
  });

  describe('Config.yaml Policy Parsing Advanced Cases', () => {
    it('should parse complex policy structure from YAML with comments', async () => {
      const yamlContent = `
# Policy Configuration with Comments
version: '1.0'
project:
  name: 'complex-yaml-policy-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'

# Main policy configuration
policy:
  version: '2.0'
  name: 'Complex YAML Policy'
  description: 'A complex policy configuration with comments'
  enforcement: 'strict'

  # File access controls
  allowedPaths:
    mode: 'allowlist'
    allow:
      # Source code patterns
      - 'src/**/*.{ts,tsx,js,jsx}'
      - 'lib/**/*.{ts,js}'
      # Documentation patterns
      - 'docs/**/*.{md,mdx}'
      # Configuration files
      - '*.{json,yaml,yml}'
      - 'package.json'
      - 'tsconfig*.json'
    block:
      # Generated directories
      - 'node_modules/**'
      - 'dist/**'
      - 'build/**'
      # Temporary files
      - '**/*.tmp'
      - '**/*.temp'
    sensitivePatterns:
      # Environment files
      - '.env*'
      # Key files
      - '**/*.{key,pem,p12}'
      # Secret directories
      - '**/secrets/**'
    followSymlinks: false
    maxDepth: 10

  # Test requirements
  requiredTests:
    enforcement: 'require'
    rules:
      # Component tests
      - name: 'component-tests'
        description: 'React components need tests'
        sourcePatterns:
          - 'src/components/**/*.{tsx,jsx}'
        testPatterns:
          - 'src/components/**/*.{test,spec}.{tsx,jsx}'
          - '__tests__/components/**/*.{tsx,jsx}'
        testNamingConvention: '{dir}/__tests__/{basename}.test.{ext}'
        minCoverage: 80
        tags: ['react', 'components']
        enabled: true

      # Utility tests
      - name: 'utility-tests'
        description: 'Utility functions need tests'
        sourcePatterns: ['src/utils/**/*.{ts,js}']
        testPatterns: ['src/utils/**/*.{test,spec}.{ts,js}']
        minCoverage: 90
        tags: ['utils']
        enabled: true

    testCommand: 'npm run test:coverage'
    coverageCommand: 'npm run coverage:xml'
    coverageReportPath: 'coverage/cobertura.xml'
    excludePatterns:
      - '**/*.d.ts'
      - '**/index.{ts,js}'
      - '**/*.stories.{tsx,jsx}'
    blockOnFailure: true

  # Approval requirements
  approvalRules:
    enabled: true
    rules:
      # Security-sensitive changes
      - id: 'security-changes'
        name: 'security-changes'
        description: 'Security-related changes require approval'
        conditions:
          - type: 'file-pattern'
            patterns:
              - '**/auth/**'
              - '**/security/**'
              - '**/*.env*'
            description: 'Security-related files'
          - type: 'content-pattern'
            patterns:
              - 'password'
              - 'secret'
              - 'api[_-]?key'
            description: 'Sensitive content patterns'
        approvers:
          - 'security@company.com'
          - 'infra@company.com'
        minApprovals: 2
        timeoutMinutes: 240
        timeoutAction: 'reject'
        enabled: true
        priority: 10
        tags: ['security', 'critical']

      # High-cost operations
      - id: 'high-cost-ops'
        name: 'high-cost-operations'
        description: 'High-cost operations need approval'
        conditions:
          - type: 'cost-threshold'
            threshold: 50.0
            description: 'Operations over $50'
          - type: 'token-threshold'
            threshold: 100000
            description: 'Operations using >100k tokens'
        approvers: ['manager@company.com']
        minApprovals: 1
        timeoutMinutes: 120
        timeoutAction: 'escalate'
        enabled: true
        priority: 5
        tags: ['cost', 'budget']

    defaultTimeoutMinutes: 60
    defaultTimeoutAction: 'reject'
    globalApprovers: ['admin@company.com']
    notificationsEnabled: true
    notificationChannels:
      slack: 'https://hooks.slack.com/complex'
      email: ['dev-team@company.com']
      webhook: 'https://api.company.com/approvals'
    auditLog: true
    auditLogPath: 'audit/policy-approvals.log'

  enabled: true
  tags:
    - 'complex'
    - 'yaml'
    - 'comprehensive'
  metadata:
    owner: 'platform-team'
    environment: 'production'
    compliance: 'SOX'
    version: '1.0'
    reviewCycle: 'quarterly'
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      const loaded = await loadConfig(testDir);

      // Verify basic structure
      expect(loaded.policy?.name).toBe('Complex YAML Policy');
      expect(loaded.policy?.enforcement).toBe('strict');
      expect(loaded.policy?.version).toBe('2.0');

      // Verify allowedPaths
      expect(loaded.policy?.allowedPaths?.mode).toBe('allowlist');
      expect(loaded.policy?.allowedPaths?.allow).toContain('src/**/*.{ts,tsx,js,jsx}');
      expect(loaded.policy?.allowedPaths?.block).toContain('node_modules/**');
      expect(loaded.policy?.allowedPaths?.sensitivePatterns).toContain('.env*');
      expect(loaded.policy?.allowedPaths?.followSymlinks).toBe(false);
      expect(loaded.policy?.allowedPaths?.maxDepth).toBe(10);

      // Verify requiredTests
      expect(loaded.policy?.requiredTests?.enforcement).toBe('require');
      expect(loaded.policy?.requiredTests?.rules).toHaveLength(2);
      expect(loaded.policy?.requiredTests?.blockOnFailure).toBe(true);

      // Verify specific test rule
      const componentRule = loaded.policy?.requiredTests?.rules?.find(r => r.name === 'component-tests');
      expect(componentRule).toBeDefined();
      expect(componentRule?.minCoverage).toBe(80);
      expect(componentRule?.tags).toEqual(['react', 'components']);

      // Verify approvalRules
      expect(loaded.policy?.approvalRules?.enabled).toBe(true);
      expect(loaded.policy?.approvalRules?.rules).toHaveLength(2);

      // Verify specific approval rule
      const securityRule = loaded.policy?.approvalRules?.rules?.find(r => r.id === 'security-changes');
      expect(securityRule).toBeDefined();
      expect(securityRule?.minApprovals).toBe(2);
      expect(securityRule?.timeoutAction).toBe('reject');
      expect(securityRule?.conditions).toHaveLength(2);

      // Verify metadata
      expect(loaded.policy?.tags).toEqual(['complex', 'yaml', 'comprehensive']);
      expect(loaded.policy?.metadata?.owner).toBe('platform-team');
      expect(loaded.policy?.metadata?.compliance).toBe('SOX');
    });

    it('should handle malformed YAML policy configurations gracefully', async () => {
      const malformedYaml = `
version: '1.0'
project:
  name: 'malformed-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
policy:
  enforcement: 'strict'
  allowedPaths:
    mode: 'invalid-mode'  # Invalid mode
    allow: 'not-an-array'  # Should be array
  requiredTests:
    enforcement: 'invalid-enforcement'  # Invalid enforcement
    rules:
      - name: ''  # Empty name not allowed
        sourcePatterns: []  # Empty array not allowed
        testPatterns: []  # Empty array not allowed
  approvalRules:
    rules:
      - id: 'test-rule'
        name: 'test'
        # Missing required conditions field
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, malformedYaml, 'utf-8');

      // Should throw validation error
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle policy configurations with null/undefined values', async () => {
      const yamlWithNulls = `
version: '1.0'
project:
  name: 'null-values-test'
  testCommand: 'npm test'
  lintCommand: 'npm run lint'
  buildCommand: 'npm run build'
policy:
  name: null
  description: null
  allowedPaths: null
  requiredTests: null
  approvalRules: null
  tags: null
  metadata: null
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlWithNulls, 'utf-8');

      const loaded = await loadConfig(testDir);

      // Should handle nulls gracefully by applying defaults
      expect(loaded.policy).toBeDefined();
      expect(loaded.policy?.name).toBeNull();
      expect(loaded.policy?.allowedPaths).toBeNull();
      expect(loaded.policy?.requiredTests).toBeNull();
      expect(loaded.policy?.approvalRules).toBeNull();
      expect(loaded.policy?.tags).toBeNull();

      // getEffectiveConfig should fill in defaults for null values
      const effective = getEffectiveConfig(loaded);
      expect(effective.policy.enforcement).toBe('warn'); // Default
      expect(effective.policy.enabled).toBe(true); // Default
    });
  });

  describe('Default Policy Merging and Inheritance', () => {
    it('should properly merge explicit config with built-in defaults', () => {
      const partialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'default-merge-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          enforcement: 'strict',
          allowedPaths: {
            allow: ['custom/**'],
            // Other fields should get defaults
          },
          // Other policy sections should get defaults
        },
      };

      const effective = getEffectiveConfig(partialConfig);

      // Explicit values should be preserved
      expect(effective.policy.enforcement).toBe('strict');
      expect(effective.policy.allowedPaths.allow).toEqual(['custom/**']);

      // Defaults should be applied for missing values
      expect(effective.policy.version).toBe('1.0');
      expect(effective.policy.enabled).toBe(true);
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
      expect(effective.policy.approvalRules.auditLog).toBe(true);
    });

    it('should handle deep merging of nested policy configurations', () => {
      const configWithDeepNesting: ApexConfig = {
        version: '1.0',
        project: {
          name: 'deep-merge-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          allowedPaths: {
            mode: 'blocklist', // Override default
            allow: [], // Explicit empty (should override defaults)
            // block and sensitivePatterns should get defaults
          },
          requiredTests: {
            enforcement: 'require',
            rules: [{
              name: 'custom-rule',
              sourcePatterns: ['custom/**/*.ts'],
              testPatterns: ['custom/**/*.test.ts'],
            }],
            // Other fields should get defaults
          },
          approvalRules: {
            enabled: false, // Override default
            defaultTimeoutMinutes: 30, // Override default
            // Other fields should get defaults
          },
        },
      };

      const effective = getEffectiveConfig(configWithDeepNesting);

      // Deep nested overrides should be preserved
      expect(effective.policy.allowedPaths.mode).toBe('blocklist');
      expect(effective.policy.allowedPaths.allow).toEqual([]); // Explicit empty
      expect(effective.policy.requiredTests.enforcement).toBe('require');
      expect(effective.policy.requiredTests.rules).toHaveLength(1);
      expect(effective.policy.approvalRules.enabled).toBe(false);
      expect(effective.policy.approvalRules.defaultTimeoutMinutes).toBe(30);

      // Defaults should still apply for non-overridden fields
      expect(effective.policy.allowedPaths.block).toContain('node_modules/**');
      expect(effective.policy.requiredTests.blockOnFailure).toBe(true);
      expect(effective.policy.approvalRules.defaultTimeoutAction).toBe('reject');
    });

    it('should handle policy configuration inheritance from initializeApex', async () => {
      await initializeApex(testDir, {
        projectName: 'inheritance-test',
        language: 'typescript',
        framework: 'react',
      });

      const initialConfig = await loadConfig(testDir);

      // Should have default policy configuration from initializeApex
      expect(initialConfig.policy?.enforcement).toBe('warn');
      expect(initialConfig.policy?.enabled).toBe(true);
      expect(initialConfig.policy?.allowedPaths?.mode).toBe('allowlist');
      expect(initialConfig.policy?.allowedPaths?.allow).toContain('src/**');
      expect(initialConfig.policy?.allowedPaths?.block).toContain('node_modules/**');

      // Modify the config to add custom policy rules
      const customConfig: ApexConfig = {
        ...initialConfig,
        policy: {
          ...initialConfig.policy!,
          name: 'Custom Project Policy',
          enforcement: 'strict',
          allowedPaths: {
            ...initialConfig.policy!.allowedPaths!,
            allow: [
              ...initialConfig.policy!.allowedPaths!.allow!,
              'custom/**/*.ts',
              'special/**/*.tsx',
            ],
            block: [
              ...initialConfig.policy!.allowedPaths!.block!,
              'temp/**',
              '**/*.backup',
            ],
          },
          requiredTests: {
            enforcement: 'require',
            rules: [{
              name: 'typescript-tests',
              sourcePatterns: ['src/**/*.ts', 'custom/**/*.ts'],
              testPatterns: ['**/*.test.ts', '**/__tests__/**/*.ts'],
              minCoverage: 85,
            }],
            blockOnFailure: true,
          },
        },
      };

      await saveConfig(testDir, customConfig);
      const modifiedConfig = await loadConfig(testDir);

      // Custom values should be preserved
      expect(modifiedConfig.policy?.name).toBe('Custom Project Policy');
      expect(modifiedConfig.policy?.enforcement).toBe('strict');
      expect(modifiedConfig.policy?.allowedPaths?.allow).toContain('custom/**/*.ts');
      expect(modifiedConfig.policy?.allowedPaths?.block).toContain('temp/**');
      expect(modifiedConfig.policy?.requiredTests?.enforcement).toBe('require');

      // Inherited defaults should still work through getEffectiveConfig
      const effective = getEffectiveConfig(modifiedConfig);
      expect(effective.policy.approvalRules.enabled).toBe(true);
      expect(effective.policy.approvalRules.defaultTimeoutMinutes).toBe(60);
    });
  });

  describe('Policy Configuration Error Handling and Edge Cases', () => {
    it('should handle missing policy directories gracefully', async () => {
      // Create a config that references non-existent directories
      const configWithMissingDirs: ApexConfig = {
        version: '1.0',
        project: {
          name: 'missing-dirs-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          allowedPaths: {
            allow: [
              'non-existent-dir/**',
              'missing/**/*.ts',
              'phantom/directory/**',
            ],
          },
          requiredTests: {
            rules: [{
              name: 'missing-sources',
              sourcePatterns: ['non-existent/**/*.ts'],
              testPatterns: ['also-missing/**/*.test.ts'],
            }],
          },
        },
      };

      // Should save and load without errors (patterns are just strings at config level)
      await saveConfig(testDir, configWithMissingDirs);
      const loaded = await loadConfig(testDir);

      expect(loaded.policy?.allowedPaths?.allow).toContain('non-existent-dir/**');
      expect(loaded.policy?.requiredTests?.rules?.[0]?.sourcePatterns).toContain('non-existent/**/*.ts');

      // getEffectiveConfig should also work
      const effective = getEffectiveConfig(loaded);
      expect(effective.policy.allowedPaths.allow).toContain('non-existent-dir/**');
    });

    it('should handle invalid policy data types gracefully', async () => {
      // Test schema validation for various invalid types
      const invalidConfigs = [
        // Non-string version
        { policy: { version: 123 } },
        // Non-string name
        { policy: { name: [] } },
        // Non-object allowedPaths
        { policy: { allowedPaths: 'invalid' } },
        // Non-array patterns
        { policy: { allowedPaths: { allow: 'not-array' } } },
        // Non-boolean enabled
        { policy: { enabled: 'true' } },
        // Invalid nested objects
        { policy: { metadata: 'not-an-object' } },
      ];

      for (const invalidConfig of invalidConfigs) {
        const config = {
          version: '1.0',
          project: {
            name: 'invalid-test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          ...invalidConfig,
        };

        expect(() => ApexConfigSchema.parse(config)).toThrow();
      }
    });

    it('should handle very large policy configurations without performance issues', async () => {
      const largeConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'large-policy-performance-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        policy: {
          name: 'Large Performance Test Policy',
          allowedPaths: {
            allow: Array.from({ length: 500 }, (_, i) => `module-${i}/**/*.ts`),
            block: Array.from({ length: 200 }, (_, i) => `blocked-${i}/**`),
            sensitivePatterns: Array.from({ length: 100 }, (_, i) => `**/*secret-${i}*`),
          },
          requiredTests: {
            rules: Array.from({ length: 100 }, (_, i) => ({
              name: `test-rule-${i}`,
              description: `Test rule for module ${i}`,
              sourcePatterns: [`module-${i}/**/*.ts`],
              testPatterns: [`tests/module-${i}/**/*.test.ts`],
              minCoverage: 70 + (i % 30),
              tags: [`module-${i}`, 'auto-generated'],
              enabled: i % 5 !== 0, // Disable every 5th rule
            })),
          },
          approvalRules: {
            rules: Array.from({ length: 50 }, (_, i) => ({
              id: `approval-${i}`,
              name: `approval-${i}`,
              description: `Auto-generated approval rule ${i}`,
              conditions: [
                {
                  type: 'file-pattern',
                  patterns: [`**/*module-${i}*`],
                },
                ...(i % 3 === 0 ? [{
                  type: 'cost-threshold',
                  threshold: 10 + (i * 2),
                }] : []),
              ],
              approvers: [`approver-${i}@company.com`],
              minApprovals: 1 + (i % 3),
              timeoutMinutes: 60 + (i * 5),
              priority: i % 10,
              enabled: i % 4 !== 0,
            })),
          },
          tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
          metadata: Object.fromEntries(
            Array.from({ length: 200 }, (_, i) => [`key-${i}`, `value-${i}`])
          ),
        },
      };

      const startTime = Date.now();
      await saveConfig(testDir, largeConfig);
      const saveTime = Date.now() - startTime;

      const loadStartTime = Date.now();
      const loaded = await loadConfig(testDir);
      const loadTime = Date.now() - loadStartTime;

      const effectiveStartTime = Date.now();
      const effective = getEffectiveConfig(loaded);
      const effectiveTime = Date.now() - effectiveStartTime;

      // Verify data integrity
      expect(loaded.policy?.allowedPaths?.allow).toHaveLength(500);
      expect(loaded.policy?.requiredTests?.rules).toHaveLength(100);
      expect(loaded.policy?.approvalRules?.rules).toHaveLength(50);
      expect(loaded.policy?.tags).toHaveLength(50);
      expect(Object.keys(loaded.policy?.metadata || {})).toHaveLength(200);

      // Verify effective config processes large data correctly
      expect(effective.policy.allowedPaths.allow).toHaveLength(500);
      expect(effective.policy.requiredTests.rules).toHaveLength(100);

      // Performance should be reasonable for large configs
      expect(saveTime).toBeLessThan(2000); // 2 seconds
      expect(loadTime).toBeLessThan(2000); // 2 seconds
      expect(effectiveTime).toBeLessThan(1000); // 1 second
    });

    it('should handle concurrent policy configuration operations', async () => {
      // Test concurrent save/load operations
      const configs = Array.from({ length: 5 }, (_, i) => ({
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
          allowedPaths: {
            allow: [`src-${i}/**/*.ts`],
          },
          tags: [`concurrent-${i}`],
        },
      } satisfies ApexConfig));

      // Create separate directories for each config
      const testDirs = await Promise.all(
        configs.map(async (_, i) => {
          const dir = await fs.mkdtemp(path.join(os.tmpdir(), `apex-concurrent-${i}-`));
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

        // Verify all configs loaded correctly
        loadedConfigs.forEach((loaded, i) => {
          expect(loaded.policy?.name).toBe(`Concurrent Policy ${i}`);
          expect(loaded.policy?.enforcement).toBe(i % 2 === 0 ? 'strict' : 'warn');
          expect(loaded.policy?.allowedPaths?.allow).toContain(`src-${i}/**/*.ts`);
        });

        // Concurrent effective config operations
        const effectiveConfigs = await Promise.all(
          loadedConfigs.map(config => Promise.resolve(getEffectiveConfig(config)))
        );

        effectiveConfigs.forEach((effective, i) => {
          expect(effective.policy.name).toBe(`Concurrent Policy ${i}`);
        });

      } finally {
        // Clean up
        await Promise.all(
          testDirs.map(dir => fs.rm(dir, { recursive: true, force: true }))
        );
      }
    });
  });

  describe('Policy Configuration Integration with Other Features', () => {
    it('should handle policy configuration alongside complex project setup', async () => {
      // Initialize a project with language and framework
      await initializeApex(testDir, {
        projectName: 'integration-test',
        language: 'typescript',
        framework: 'react',
      });

      const baseConfig = await loadConfig(testDir);

      // Add comprehensive policy alongside other complex config
      const enhancedConfig: ApexConfig = {
        ...baseConfig,
        autonomy: {
          level: 'review-before-commit',
          gates: [
            {
              type: 'before-commit',
              name: 'Policy Compliance Gate',
              description: 'Ensures all changes comply with policy',
              required: true,
            },
          ],
          limits: {
            maxCost: 25.0,
            maxTokens: 100000,
            maxTurns: 50,
            dailyBudget: 75.0,
            maxConcurrentTasks: 2,
          },
        },
        limits: {
          maxTokensPerTask: 50000,
          maxCostPerTask: 15.0,
          dailyBudget: 75.0,
          maxTurns: 50,
          maxConcurrentTasks: 2,
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional',
          autoPush: false,
          createPR: 'on-completion',
        },
        workspace: {
          defaultStrategy: 'worktree',
          cleanupOnComplete: true,
        },
        policy: {
          name: 'React TypeScript Project Policy',
          description: 'Comprehensive policy for React TypeScript projects',
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: [
              'src/**/*.{ts,tsx}',
              'src/**/*.{css,scss,less}',
              'src/**/*.{svg,png,jpg,gif}',
              'public/**/*.{html,ico,png,svg}',
              'docs/**/*.{md,mdx}',
              '__tests__/**/*.{ts,tsx}',
              '**/*.{test,spec}.{ts,tsx}',
              'package.json',
              'package-lock.json',
              'tsconfig*.json',
              'jest.config.*',
              'webpack.config.*',
              'vite.config.*',
              '.env.example',
              'README.md',
              'CHANGELOG.md',
            ],
            block: [
              'node_modules/**',
              'build/**',
              'dist/**',
              'coverage/**',
              '.git/**',
              '**/*.log',
              '**/.DS_Store',
              '**/npm-debug.log*',
              '**/.nyc_output/**',
            ],
            sensitivePatterns: [
              '.env*',
              '!.env.example',
              '**/*.key',
              '**/*.pem',
              '**/secrets.json',
              '**/.npmrc',
            ],
            followSymlinks: false,
            maxDepth: 8,
          },
          requiredTests: {
            enforcement: 'require',
            rules: [
              {
                name: 'react-components',
                description: 'All React components must have tests',
                sourcePatterns: ['src/components/**/*.{tsx,jsx}'],
                testPatterns: [
                  'src/components/**/*.{test,spec}.{tsx,jsx}',
                  '__tests__/components/**/*.{tsx,jsx}',
                ],
                testNamingConvention: '{dir}/__tests__/{basename}.test.{ext}',
                minCoverage: 80,
                tags: ['react', 'components', 'ui'],
                enabled: true,
              },
              {
                name: 'custom-hooks',
                description: 'Custom React hooks must have tests',
                sourcePatterns: ['src/hooks/**/*.{ts,tsx}'],
                testPatterns: ['src/hooks/**/*.{test,spec}.{ts,tsx}'],
                minCoverage: 90,
                tags: ['react', 'hooks'],
                enabled: true,
              },
              {
                name: 'utilities',
                description: 'Utility functions must have comprehensive tests',
                sourcePatterns: ['src/utils/**/*.{ts,js}'],
                testPatterns: ['src/utils/**/*.{test,spec}.{ts,js}'],
                minCoverage: 95,
                tags: ['utils', 'pure-functions'],
                enabled: true,
              },
            ],
            testCommand: 'npm run test -- --coverage --watchAll=false',
            coverageCommand: 'npm run test:coverage',
            coverageReportPath: 'coverage/lcov.info',
            excludePatterns: [
              '**/*.d.ts',
              '**/index.{ts,tsx}',
              '**/*.stories.{tsx,jsx}',
              '**/*.config.{ts,js}',
              '**/setupTests.{ts,js}',
            ],
            blockOnFailure: true,
          },
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'package-dependencies',
                name: 'package-dependencies',
                description: 'Package dependency changes require review',
                conditions: [
                  {
                    type: 'file-pattern',
                    patterns: ['package.json', 'package-lock.json'],
                    description: 'Node.js dependency files',
                  },
                ],
                approvers: ['tech-lead@company.com'],
                minApprovals: 1,
                timeoutMinutes: 120,
                timeoutAction: 'escalate',
                enabled: true,
                priority: 7,
                tags: ['dependencies', 'security'],
              },
              {
                id: 'public-api-changes',
                name: 'public-api-changes',
                description: 'Public API changes require architecture review',
                conditions: [
                  {
                    type: 'file-pattern',
                    patterns: ['src/api/**', 'src/types/**', 'src/interfaces/**'],
                    description: 'Public API and type definitions',
                  },
                ],
                approvers: ['architect@company.com', 'api-team@company.com'],
                minApprovals: 1,
                timeoutMinutes: 240,
                timeoutAction: 'escalate',
                enabled: true,
                priority: 8,
                tags: ['api', 'architecture'],
              },
            ],
            defaultTimeoutMinutes: 120,
            defaultTimeoutAction: 'escalate',
            globalApprovers: [],
            notificationsEnabled: true,
            auditLog: true,
            auditLogPath: 'logs/policy-approvals.log',
          },
          enabled: true,
          tags: ['typescript', 'react', 'frontend', 'strict'],
          metadata: {
            projectType: 'frontend',
            framework: 'react',
            language: 'typescript',
            testingFramework: 'jest',
            buildTool: 'webpack',
            owner: 'frontend-team',
            maintainers: ['john@company.com', 'jane@company.com'],
          },
        },
      };

      await saveConfig(testDir, enhancedConfig);
      const loaded = await loadConfig(testDir);

      // Verify policy integrates properly with other config
      expect(loaded.policy?.name).toBe('React TypeScript Project Policy');
      expect(loaded.autonomy?.level).toBe('review-before-commit');
      expect(loaded.git?.branchPrefix).toBe('feature/');
      expect(loaded.workspace?.defaultStrategy).toBe('worktree');

      // Verify effective config preserves all settings
      const effective = getEffectiveConfig(loaded);
      expect(effective.policy.enforcement).toBe('strict');
      expect(effective.autonomy.limits?.maxCost).toBe(25.0);
      expect(effective.git.commitFormat).toBe('conventional');
    });
  });
});