import {
  PolicyConfigSchema,
  AllowedPathsConfigSchema,
  RequiredTestsConfigSchema,
  ApprovalRulesConfigSchema,
  TestRequirementRuleSchema,
  ApprovalRuleSchema,
  ApprovalConditionSchema,
  PathAccessModeSchema,
  TestEnforcementLevelSchema,
  ApprovalConditionTypeSchema,
  ApprovalOperationTypeSchema,
  PolicyEnforcementModeSchema,
  type PolicyConfig,
  type AllowedPathsConfig,
  type RequiredTestsConfig,
  type ApprovalRulesConfig,
  type TestRequirementRule,
  type ApprovalRule,
  type ApprovalCondition,
  type PathAccessMode,
  type TestEnforcementLevel,
  type ApprovalConditionType,
  type ApprovalOperationType,
  type PolicyEnforcementMode,
} from '../types.js';

describe('PolicyConfigSchema', () => {
  describe('PathAccessModeSchema', () => {
    it('accepts valid path access modes', () => {
      expect(PathAccessModeSchema.parse('allowlist')).toBe('allowlist');
      expect(PathAccessModeSchema.parse('blocklist')).toBe('blocklist');
    });

    it('rejects invalid path access modes', () => {
      expect(() => PathAccessModeSchema.parse('invalid')).toThrow();
      expect(() => PathAccessModeSchema.parse('')).toThrow();
      expect(() => PathAccessModeSchema.parse(null)).toThrow();
    });
  });

  describe('TestEnforcementLevelSchema', () => {
    it('accepts valid enforcement levels', () => {
      expect(TestEnforcementLevelSchema.parse('none')).toBe('none');
      expect(TestEnforcementLevelSchema.parse('warn')).toBe('warn');
      expect(TestEnforcementLevelSchema.parse('require')).toBe('require');
    });

    it('rejects invalid enforcement levels', () => {
      expect(() => TestEnforcementLevelSchema.parse('invalid')).toThrow();
      expect(() => TestEnforcementLevelSchema.parse('strict')).toThrow();
    });
  });

  describe('ApprovalConditionTypeSchema', () => {
    it('accepts valid condition types', () => {
      const validTypes: ApprovalConditionType[] = [
        'file-pattern',
        'content-pattern',
        'operation',
        'cost-threshold',
        'token-threshold',
        'custom',
      ];

      validTypes.forEach(type => {
        expect(ApprovalConditionTypeSchema.parse(type)).toBe(type);
      });
    });

    it('rejects invalid condition types', () => {
      expect(() => ApprovalConditionTypeSchema.parse('invalid')).toThrow();
      expect(() => ApprovalConditionTypeSchema.parse('file')).toThrow();
    });
  });

  describe('ApprovalOperationTypeSchema', () => {
    it('accepts valid operation types', () => {
      const validOperations: ApprovalOperationType[] = [
        'create',
        'modify',
        'delete',
        'execute',
        'deploy',
        'commit',
        'push',
        'merge',
      ];

      validOperations.forEach(operation => {
        expect(ApprovalOperationTypeSchema.parse(operation)).toBe(operation);
      });
    });

    it('rejects invalid operation types', () => {
      expect(() => ApprovalOperationTypeSchema.parse('invalid')).toThrow();
      expect(() => ApprovalOperationTypeSchema.parse('read')).toThrow();
    });
  });

  describe('PolicyEnforcementModeSchema', () => {
    it('accepts valid enforcement modes', () => {
      const validModes: PolicyEnforcementMode[] = ['strict', 'warn', 'audit', 'disabled'];

      validModes.forEach(mode => {
        expect(PolicyEnforcementModeSchema.parse(mode)).toBe(mode);
      });
    });

    it('rejects invalid enforcement modes', () => {
      expect(() => PolicyEnforcementModeSchema.parse('invalid')).toThrow();
      expect(() => PolicyEnforcementModeSchema.parse('require')).toThrow();
    });
  });

  describe('AllowedPathsConfigSchema', () => {
    it('parses valid minimal config with defaults', () => {
      const config = AllowedPathsConfigSchema.parse({});

      expect(config.mode).toBe('allowlist');
      expect(config.allow).toEqual([]);
      expect(config.block).toEqual([]);
      expect(config.sensitivePatterns).toEqual([]);
      expect(config.followSymlinks).toBe(false);
      expect(config.maxDepth).toBe(10);
    });

    it('parses valid complete config', () => {
      const input: AllowedPathsConfig = {
        mode: 'blocklist',
        allow: ['src/**', 'tests/**', '*.md'],
        block: ['node_modules/**', '.env*', '**/*.key'],
        sensitivePatterns: ['.env*', '**/config.json'],
        followSymlinks: true,
        maxDepth: 5,
      };

      const result = AllowedPathsConfigSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('validates maxDepth constraints', () => {
      expect(() => AllowedPathsConfigSchema.parse({ maxDepth: -1 })).toThrow();
      expect(AllowedPathsConfigSchema.parse({ maxDepth: 0 }).maxDepth).toBe(0);
      expect(AllowedPathsConfigSchema.parse({ maxDepth: 100 }).maxDepth).toBe(100);
    });

    it('rejects invalid mode', () => {
      expect(() => AllowedPathsConfigSchema.parse({ mode: 'invalid' })).toThrow();
    });
  });

  describe('TestRequirementRuleSchema', () => {
    it('parses valid minimal rule', () => {
      const input = {
        name: 'typescript-tests',
        sourcePatterns: ['src/**/*.ts'],
        testPatterns: ['**/*.test.ts'],
      };

      const result = TestRequirementRuleSchema.parse(input);
      expect(result.name).toBe('typescript-tests');
      expect(result.sourcePatterns).toEqual(['src/**/*.ts']);
      expect(result.testPatterns).toEqual(['**/*.test.ts']);
      expect(result.minCoverage).toBe(0);
      expect(result.enabled).toBe(true);
    });

    it('parses valid complete rule', () => {
      const input: TestRequirementRule = {
        name: 'react-component-tests',
        description: 'Ensure React components have tests',
        sourcePatterns: ['src/components/**/*.tsx'],
        testPatterns: ['src/components/**/*.test.tsx', '**/__tests__/**/*.tsx'],
        testNamingConvention: '{dir}/__tests__/{basename}.test.tsx',
        minCoverage: 80,
        tags: ['react', 'frontend'],
        enabled: true,
      };

      const result = TestRequirementRuleSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('validates required fields', () => {
      expect(() => TestRequirementRuleSchema.parse({})).toThrow();
      expect(() => TestRequirementRuleSchema.parse({ name: '' })).toThrow();
      expect(() => TestRequirementRuleSchema.parse({ name: 'test', sourcePatterns: [] })).toThrow();
      expect(() => TestRequirementRuleSchema.parse({
        name: 'test',
        sourcePatterns: ['src/**/*.ts'],
        testPatterns: []
      })).toThrow();
    });

    it('validates coverage threshold range', () => {
      const baseRule = {
        name: 'test',
        sourcePatterns: ['src/**/*.ts'],
        testPatterns: ['**/*.test.ts'],
      };

      expect(() => TestRequirementRuleSchema.parse({ ...baseRule, minCoverage: -1 })).toThrow();
      expect(() => TestRequirementRuleSchema.parse({ ...baseRule, minCoverage: 101 })).toThrow();
      expect(TestRequirementRuleSchema.parse({ ...baseRule, minCoverage: 0 }).minCoverage).toBe(0);
      expect(TestRequirementRuleSchema.parse({ ...baseRule, minCoverage: 100 }).minCoverage).toBe(100);
    });
  });

  describe('RequiredTestsConfigSchema', () => {
    it('parses valid minimal config with defaults', () => {
      const config = RequiredTestsConfigSchema.parse({});

      expect(config.enforcement).toBe('warn');
      expect(config.rules).toEqual([]);
      expect(config.excludePatterns).toEqual([]);
      expect(config.blockOnFailure).toBe(true);
    });

    it('parses valid complete config', () => {
      const input: RequiredTestsConfig = {
        enforcement: 'require',
        rules: [{
          name: 'typescript-tests',
          sourcePatterns: ['src/**/*.ts'],
          testPatterns: ['**/*.test.ts'],
          minCoverage: 80,
        }],
        testCommand: 'npm test',
        coverageCommand: 'npm run test:coverage',
        coverageReportPath: 'coverage/lcov.info',
        excludePatterns: ['**/*.d.ts', '**/index.ts'],
        blockOnFailure: false,
      };

      const result = RequiredTestsConfigSchema.parse(input);
      expect(result).toEqual(input);
    });
  });

  describe('ApprovalConditionSchema', () => {
    it('parses file-pattern condition', () => {
      const input: ApprovalCondition = {
        type: 'file-pattern',
        patterns: ['**/*.secret', '.env*'],
        description: 'Sensitive files require approval',
      };

      const result = ApprovalConditionSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('parses content-pattern condition', () => {
      const input: ApprovalCondition = {
        type: 'content-pattern',
        patterns: ['password\\s*=', 'api[_-]?key'],
        description: 'Sensitive content requires approval',
      };

      const result = ApprovalConditionSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('parses operation condition', () => {
      const input: ApprovalCondition = {
        type: 'operation',
        operations: ['delete', 'deploy'],
        description: 'Destructive operations require approval',
      };

      const result = ApprovalConditionSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('parses cost-threshold condition', () => {
      const input: ApprovalCondition = {
        type: 'cost-threshold',
        threshold: 10.0,
        description: 'High cost operations require approval',
      };

      const result = ApprovalConditionSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('parses token-threshold condition', () => {
      const input: ApprovalCondition = {
        type: 'token-threshold',
        threshold: 100000,
        description: 'High token usage requires approval',
      };

      const result = ApprovalConditionSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('parses custom condition', () => {
      const input: ApprovalCondition = {
        type: 'custom',
        expression: 'fileCount > 10 && operationType === "modify"',
        description: 'Custom approval logic',
      };

      const result = ApprovalConditionSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('validates threshold types and constraints', () => {
      expect(() => ApprovalConditionSchema.parse({
        type: 'cost-threshold',
        threshold: -1
      })).toThrow();

      expect(() => ApprovalConditionSchema.parse({
        type: 'token-threshold',
        threshold: -1
      })).toThrow();

      // Threshold can be a decimal number, so 1.5 is valid
      expect(ApprovalConditionSchema.parse({
        type: 'token-threshold',
        threshold: 1.5
      }).threshold).toBe(1.5);
    });
  });

  describe('ApprovalRuleSchema', () => {
    it('parses valid minimal rule', () => {
      const input = {
        id: 'sensitive-files-rule',
        name: 'sensitive-files',
        conditions: [{
          type: 'file-pattern' as const,
          patterns: ['**/*.secret']
        }]
      };

      const result = ApprovalRuleSchema.parse(input);
      expect(result.name).toBe('sensitive-files');
      expect(result.conditions).toHaveLength(1);
      expect(result.enabled).toBe(true);
      expect(result.priority).toBe(0);
    });

    it('parses valid complete rule', () => {
      const input: ApprovalRule = {
        id: 'prod-deploy-rule',
        name: 'production-deployment',
        description: 'Production deployments need manager approval',
        conditions: [
          {
            type: 'operation',
            operations: ['deploy'],
          },
          {
            type: 'custom',
            expression: 'environment === "production"',
          }
        ],
        approvers: ['manager@company.com', 'lead@company.com'],
        minApprovals: 2,
        timeoutMinutes: 120,
        timeoutAction: 'escalate',
        enabled: true,
        priority: 10,
        tags: ['production', 'deployment'],
      };

      const result = ApprovalRuleSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('validates required fields', () => {
      expect(() => ApprovalRuleSchema.parse({})).toThrow();
      expect(() => ApprovalRuleSchema.parse({ id: '', name: '' })).toThrow();
      expect(() => ApprovalRuleSchema.parse({ id: 'test-id', name: 'test', conditions: [] })).toThrow();
    });

    it('validates numeric constraints', () => {
      const baseRule = {
        id: 'test-rule',
        name: 'test',
        conditions: [{ type: 'file-pattern' as const, patterns: ['*.test'] }]
      };

      expect(() => ApprovalRuleSchema.parse({ ...baseRule, minApprovals: 0 })).toThrow();
      expect(() => ApprovalRuleSchema.parse({ ...baseRule, timeoutMinutes: 0 })).toThrow();
      expect(() => ApprovalRuleSchema.parse({ ...baseRule, priority: -1 })).toThrow();
    });
  });

  describe('ApprovalRulesConfigSchema', () => {
    it('parses valid minimal config with defaults', () => {
      const config = ApprovalRulesConfigSchema.parse({});

      expect(config.enabled).toBe(true);
      expect(config.rules).toEqual([]);
      expect(config.defaultTimeoutMinutes).toBe(60);
      expect(config.defaultTimeoutAction).toBe('reject');
      expect(config.globalApprovers).toEqual([]);
      expect(config.notificationsEnabled).toBe(true);
      expect(config.auditLog).toBe(true);
      expect(config.auditLogPath).toBe('approval-audit.log');
    });

    it('parses valid complete config', () => {
      const input: ApprovalRulesConfig = {
        enabled: true,
        rules: [{
          id: 'sensitive-ops-rule',
          name: 'sensitive-ops',
          conditions: [{
            type: 'operation',
            operations: ['delete']
          }],
          approvers: ['admin@company.com']
        }],
        defaultTimeoutMinutes: 120,
        defaultTimeoutAction: 'escalate',
        globalApprovers: ['manager@company.com'],
        notificationsEnabled: false,
        notificationChannels: {
          slack: 'https://hooks.slack.com/webhook',
          email: ['team@company.com'],
          webhook: 'https://api.company.com/approval-webhook'
        },
        auditLog: true,
        auditLogPath: 'custom/audit.log',
      };

      const result = ApprovalRulesConfigSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('validates timeout constraints', () => {
      expect(() => ApprovalRulesConfigSchema.parse({ defaultTimeoutMinutes: 0 })).toThrow();
      expect(ApprovalRulesConfigSchema.parse({ defaultTimeoutMinutes: 1 }).defaultTimeoutMinutes).toBe(1);
    });
  });

  describe('PolicyConfigSchema', () => {
    it('parses valid minimal config with defaults', () => {
      const config = PolicyConfigSchema.parse({});

      expect(config.version).toBe('1.0');
      expect(config.enforcement).toBe('warn');
      expect(config.enabled).toBe(true);
      expect(config.tags).toEqual([]);
    });

    it('parses valid complete config', () => {
      const input: PolicyConfig = {
        version: '2.0',
        name: 'Development Policy',
        description: 'Comprehensive development governance policy',
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'tests/**'],
          block: ['node_modules/**'],
          sensitivePatterns: ['.env*']
        },
        requiredTests: {
          enforcement: 'require',
          rules: [{
            name: 'typescript-tests',
            sourcePatterns: ['src/**/*.ts'],
            testPatterns: ['**/*.test.ts']
          }]
        },
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'sensitive-files-rule',
            name: 'sensitive-files',
            conditions: [{
              type: 'file-pattern',
              patterns: ['**/*.secret']
            }]
          }]
        },
        enabled: true,
        tags: ['development', 'governance'],
        metadata: {
          owner: 'platform-team',
          version: '1.0'
        }
      };

      const result = PolicyConfigSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('handles optional nested configs', () => {
      const config = PolicyConfigSchema.parse({
        name: 'Minimal Policy'
      });

      expect(config.allowedPaths).toBeUndefined();
      expect(config.requiredTests).toBeUndefined();
      expect(config.approvalRules).toBeUndefined();
    });

    it('validates nested config schemas', () => {
      expect(() => PolicyConfigSchema.parse({
        allowedPaths: {
          mode: 'invalid'
        }
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        requiredTests: {
          enforcement: 'invalid'
        }
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        approvalRules: {
          defaultTimeoutMinutes: -1
        }
      })).toThrow();
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('parses realistic enterprise policy config', () => {
      const enterprisePolicy: PolicyConfig = {
        version: '1.0',
        name: 'Enterprise Security Policy',
        description: 'Comprehensive security and compliance policy for enterprise development',
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: [
            'src/**/*.{ts,tsx,js,jsx}',
            'tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
            'docs/**/*.md',
            'package.json',
            'tsconfig.json',
            'README.md'
          ],
          block: [
            'node_modules/**',
            'dist/**',
            'build/**',
            '.git/**'
          ],
          sensitivePatterns: [
            '.env*',
            '**/*.key',
            '**/*.pem',
            '**/secrets/**',
            '**/config/production.*'
          ],
          followSymlinks: false,
          maxDepth: 20
        },
        requiredTests: {
          enforcement: 'require',
          rules: [
            {
              name: 'api-endpoint-tests',
              description: 'All API endpoints must have integration tests',
              sourcePatterns: ['src/api/**/*.ts', 'src/routes/**/*.ts'],
              testPatterns: ['tests/api/**/*.test.ts', 'tests/integration/**/*.test.ts'],
              minCoverage: 90,
              tags: ['api', 'integration'],
            },
            {
              name: 'component-tests',
              description: 'React components must have unit tests',
              sourcePatterns: ['src/components/**/*.tsx'],
              testPatterns: ['src/components/**/*.test.tsx', 'tests/components/**/*.test.tsx'],
              testNamingConvention: '{dir}/__tests__/{basename}.test.tsx',
              minCoverage: 85,
              tags: ['frontend', 'unit'],
            },
            {
              name: 'utility-tests',
              description: 'Utility functions must have comprehensive tests',
              sourcePatterns: ['src/utils/**/*.ts', 'src/lib/**/*.ts'],
              testPatterns: ['src/utils/**/*.test.ts', 'src/lib/**/*.test.ts', 'tests/utils/**/*.test.ts'],
              minCoverage: 95,
              tags: ['utils', 'unit'],
            }
          ],
          testCommand: 'npm run test:ci',
          coverageCommand: 'npm run test:coverage',
          coverageReportPath: 'coverage/lcov.info',
          excludePatterns: ['**/*.d.ts', '**/index.ts', '**/*.stories.tsx'],
          blockOnFailure: true
        },
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'sensitive-files',
              name: 'sensitive-file-changes',
              description: 'Changes to sensitive files require security team approval',
              conditions: [
                {
                  type: 'file-pattern',
                  patterns: [
                    '**/*.env*',
                    '**/config/production.*',
                    '**/secrets/**',
                    '**/docker-compose.prod.yml'
                  ],
                  description: 'Sensitive configuration files'
                }
              ],
              approvers: ['security@company.com', 'devops@company.com'],
              minApprovals: 1,
              timeoutMinutes: 240,
              timeoutAction: 'escalate',
              priority: 10,
              tags: ['security', 'configuration']
            },
            {
              id: 'prod-deployment',
              name: 'production-deployment',
              description: 'Production deployments require manager approval',
              conditions: [
                {
                  type: 'operation',
                  operations: ['deploy'],
                  description: 'Deployment operations'
                },
                {
                  type: 'custom',
                  expression: 'environment === "production" || branch === "main"',
                  description: 'Production environment or main branch'
                }
              ],
              approvers: ['manager@company.com', 'lead@company.com'],
              minApprovals: 2,
              timeoutMinutes: 120,
              timeoutAction: 'reject',
              priority: 8,
              tags: ['deployment', 'production']
            },
            {
              id: 'high-cost-ops',
              name: 'high-cost-operations',
              description: 'Operations with high estimated cost require approval',
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 50.0,
                  description: 'Operations estimated to cost more than $50'
                }
              ],
              approvers: ['finance@company.com', 'manager@company.com'],
              minApprovals: 1,
              timeoutMinutes: 60,
              timeoutAction: 'reject',
              priority: 5,
              tags: ['cost', 'finance']
            },
            {
              id: 'bulk-ops',
              name: 'bulk-operations',
              description: 'Operations touching many files require review',
              conditions: [
                {
                  type: 'custom',
                  expression: 'changedFiles.length > 20',
                  description: 'Operations changing more than 20 files'
                }
              ],
              approvers: ['lead@company.com', 'architect@company.com'],
              minApprovals: 1,
              timeoutMinutes: 90,
              timeoutAction: 'escalate',
              priority: 3,
              tags: ['bulk', 'review']
            }
          ],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'escalate',
          globalApprovers: ['cto@company.com'],
          notificationsEnabled: true,
          notificationChannels: {
            slack: 'YOUR_SLACK_WEBHOOK_URL',
            email: ['dev-team@company.com', 'security@company.com'],
            webhook: 'https://api.company.com/webhooks/approval-requests'
          },
          auditLog: true,
          auditLogPath: 'audit/approval-decisions.log'
        },
        enabled: true,
        tags: ['enterprise', 'security', 'compliance'],
        metadata: {
          owner: 'platform-security-team',
          lastReviewed: '2024-01-01',
          reviewCycle: 'quarterly',
          complianceFrameworks: ['SOX', 'ISO27001', 'PCI-DSS']
        }
      };

      const result = PolicyConfigSchema.parse(enterprisePolicy);
      expect(result).toEqual(enterprisePolicy);
    });

    it('validates cross-field consistency in complex configs', () => {
      // This test ensures that different parts of the policy config work together correctly
      const policy = PolicyConfigSchema.parse({
        enforcement: 'strict',
        requiredTests: {
          enforcement: 'require', // Should work with strict policy enforcement
          blockOnFailure: true
        },
        approvalRules: {
          enabled: true, // Should work with strict enforcement
          defaultTimeoutAction: 'reject' // Strict policy should reject by default
        }
      });

      expect(policy.enforcement).toBe('strict');
      expect(policy.requiredTests?.enforcement).toBe('require');
      expect(policy.requiredTests?.blockOnFailure).toBe(true);
      expect(policy.approvalRules?.enabled).toBe(true);
      expect(policy.approvalRules?.defaultTimeoutAction).toBe('reject');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles empty arrays and objects gracefully', () => {
      const config = PolicyConfigSchema.parse({
        allowedPaths: {
          allow: [],
          block: [],
          sensitivePatterns: []
        },
        requiredTests: {
          rules: [],
          excludePatterns: []
        },
        approvalRules: {
          rules: [],
          globalApprovers: []
        },
        tags: [],
        metadata: {}
      });

      expect(config.allowedPaths?.allow).toEqual([]);
      expect(config.requiredTests?.rules).toEqual([]);
      expect(config.approvalRules?.rules).toEqual([]);
      expect(config.tags).toEqual([]);
      expect(config.metadata).toEqual({});
    });

    it('validates string length constraints', () => {
      expect(() => TestRequirementRuleSchema.parse({
        name: '', // Empty name should fail
        sourcePatterns: ['src/**/*.ts'],
        testPatterns: ['**/*.test.ts']
      })).toThrow();

      expect(() => ApprovalRuleSchema.parse({
        name: '', // Empty name should fail
        conditions: [{ type: 'file-pattern', patterns: ['*.test'] }]
      })).toThrow();
    });

    it('handles malformed nested objects', () => {
      expect(() => PolicyConfigSchema.parse({
        allowedPaths: 'invalid' // Should be object
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        requiredTests: [] // Should be object
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        metadata: 'invalid' // Should be object
      })).toThrow();
    });

    it('validates enum constraints strictly', () => {
      expect(() => PolicyConfigSchema.parse({
        enforcement: 'STRICT' // Case sensitive
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        allowedPaths: {
          mode: 'ALLOWLIST' // Case sensitive
        }
      })).toThrow();
    });
  });
});