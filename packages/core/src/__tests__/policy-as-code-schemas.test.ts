import { describe, it, expect } from 'vitest';
import {
  PolicyConfigSchema,
  AllowedPathsConfigSchema,
  RequiredTestsConfigSchema,
  ApprovalRulesConfigSchema,
  TestRequirementRuleSchema,
  ApprovalRuleSchema,
  PathAccessModeSchema,
  TestEnforcementLevelSchema,
  PolicyEnforcementModeSchema,
  ApprovalUrgencySchema,
  type PolicyConfig,
  type AllowedPathsConfig,
  type RequiredTestsConfig,
  type ApprovalRulesConfig,
} from '../types';

describe('Policy-as-Code Schemas', () => {
  describe('PathAccessModeSchema', () => {
    it('should accept valid path access modes', () => {
      expect(() => PathAccessModeSchema.parse('allowlist')).not.toThrow();
      expect(() => PathAccessModeSchema.parse('blocklist')).not.toThrow();
    });

    it('should reject invalid path access modes', () => {
      expect(() => PathAccessModeSchema.parse('invalid')).toThrow();
      expect(() => PathAccessModeSchema.parse('')).toThrow();
      expect(() => PathAccessModeSchema.parse(null)).toThrow();
    });
  });

  describe('TestEnforcementLevelSchema', () => {
    it('should accept valid enforcement levels', () => {
      expect(() => TestEnforcementLevelSchema.parse('none')).not.toThrow();
      expect(() => TestEnforcementLevelSchema.parse('warn')).not.toThrow();
      expect(() => TestEnforcementLevelSchema.parse('require')).not.toThrow();
    });

    it('should reject invalid enforcement levels', () => {
      expect(() => TestEnforcementLevelSchema.parse('strict')).toThrow();
      expect(() => TestEnforcementLevelSchema.parse('')).toThrow();
      expect(() => TestEnforcementLevelSchema.parse(null)).toThrow();
    });
  });

  describe('PolicyEnforcementModeSchema', () => {
    it('should accept valid policy enforcement modes', () => {
      expect(() => PolicyEnforcementModeSchema.parse('strict')).not.toThrow();
      expect(() => PolicyEnforcementModeSchema.parse('warn')).not.toThrow();
      expect(() => PolicyEnforcementModeSchema.parse('audit')).not.toThrow();
      expect(() => PolicyEnforcementModeSchema.parse('disabled')).not.toThrow();
    });

    it('should reject invalid policy enforcement modes', () => {
      expect(() => PolicyEnforcementModeSchema.parse('require')).toThrow();
      expect(() => PolicyEnforcementModeSchema.parse('')).toThrow();
      expect(() => PolicyEnforcementModeSchema.parse(null)).toThrow();
    });
  });

  describe('ApprovalUrgencySchema', () => {
    it('should accept valid urgency levels', () => {
      expect(() => ApprovalUrgencySchema.parse('low')).not.toThrow();
      expect(() => ApprovalUrgencySchema.parse('normal')).not.toThrow();
      expect(() => ApprovalUrgencySchema.parse('high')).not.toThrow();
      expect(() => ApprovalUrgencySchema.parse('critical')).not.toThrow();
    });

    it('should reject invalid urgency levels', () => {
      expect(() => ApprovalUrgencySchema.parse('urgent')).toThrow();
      expect(() => ApprovalUrgencySchema.parse('')).toThrow();
      expect(() => ApprovalUrgencySchema.parse(null)).toThrow();
    });
  });

  describe('AllowedPathsConfigSchema', () => {
    it('should accept valid configuration with defaults', () => {
      const result = AllowedPathsConfigSchema.parse({});
      expect(result.mode).toBe('allowlist');
      expect(result.allow).toEqual([]);
      expect(result.block).toEqual([]);
    });

    it('should accept allowlist configuration', () => {
      const config = {
        mode: 'allowlist' as const,
        allow: ['src/**', 'tests/**', '*.md'],
        block: ['src/secrets/**']
      };
      const result = AllowedPathsConfigSchema.parse(config);
      expect(result.mode).toBe('allowlist');
      expect(result.allow).toEqual(['src/**', 'tests/**', '*.md']);
      expect(result.block).toEqual(['src/secrets/**']);
    });

    it('should accept blocklist configuration', () => {
      const config = {
        mode: 'blocklist' as const,
        block: ['node_modules/**', '.git/**', 'tmp/**']
      };
      const result = AllowedPathsConfigSchema.parse(config);
      expect(result.mode).toBe('blocklist');
      expect(result.block).toEqual(['node_modules/**', '.git/**', 'tmp/**']);
    });

    it('should reject invalid glob patterns', () => {
      expect(() => AllowedPathsConfigSchema.parse({
        allow: ['', 'valid/**'] // empty string not allowed
      })).toThrow();
    });

    it('should handle complex path patterns', () => {
      const config = {
        mode: 'allowlist' as const,
        allow: [
          'src/**/*.{ts,tsx,js,jsx}',
          'tests/**/*.test.ts',
          'docs/**/*.md',
          'package.json',
          '*.config.{js,ts}'
        ]
      };
      const result = AllowedPathsConfigSchema.parse(config);
      expect(result.allow).toHaveLength(5);
    });
  });

  describe('TestRequirementRuleSchema', () => {
    it('should accept minimal test requirement rule', () => {
      const rule = {
        name: 'basic-test-rule',
        filePatterns: ['src/**/*.ts']
      };
      const result = TestRequirementRuleSchema.parse(rule);
      expect(result.name).toBe('basic-test-rule');
      expect(result.filePatterns).toEqual(['src/**/*.ts']);
      expect(result.enabled).toBe(true); // default
      expect(result.mustPass).toBe(true); // default
    });

    it('should accept comprehensive test requirement rule', () => {
      const rule = {
        name: 'comprehensive-test-rule',
        description: 'Ensures all business logic has tests',
        filePatterns: ['src/business/**/*.ts'],
        testPatterns: ['tests/business/**/*.test.ts'],
        requiredTestTypes: ['unit', 'integration'],
        minCoverage: 90,
        enforcement: 'require' as const,
        mustPass: true,
        enabled: true
      };
      const result = TestRequirementRuleSchema.parse(rule);
      expect(result.name).toBe('comprehensive-test-rule');
      expect(result.minCoverage).toBe(90);
      expect(result.enforcement).toBe('require');
    });

    it('should reject rule without name', () => {
      expect(() => TestRequirementRuleSchema.parse({
        filePatterns: ['src/**/*.ts']
      })).toThrow();
    });

    it('should reject rule with empty name', () => {
      expect(() => TestRequirementRuleSchema.parse({
        name: '',
        filePatterns: ['src/**/*.ts']
      })).toThrow();
    });

    it('should reject rule without file patterns', () => {
      expect(() => TestRequirementRuleSchema.parse({
        name: 'test-rule'
      })).toThrow();
    });

    it('should reject invalid coverage percentage', () => {
      expect(() => TestRequirementRuleSchema.parse({
        name: 'test-rule',
        filePatterns: ['src/**/*.ts'],
        minCoverage: 150 // > 100
      })).toThrow();

      expect(() => TestRequirementRuleSchema.parse({
        name: 'test-rule',
        filePatterns: ['src/**/*.ts'],
        minCoverage: -10 // < 0
      })).toThrow();
    });
  });

  describe('RequiredTestsConfigSchema', () => {
    it('should accept configuration with defaults', () => {
      const result = RequiredTestsConfigSchema.parse({});
      expect(result.enforcement).toBe('warn');
      expect(result.rules).toEqual([]);
    });

    it('should accept comprehensive configuration', () => {
      const config = {
        enforcement: 'require' as const,
        rules: [
          {
            name: 'unit-tests',
            filePatterns: ['src/**/*.ts'],
            testPatterns: ['tests/**/*.test.ts'],
            minCoverage: 80
          },
          {
            name: 'integration-tests',
            filePatterns: ['src/api/**/*.ts'],
            testPatterns: ['tests/integration/**/*.test.ts'],
            minCoverage: 60,
            enforcement: 'warn' as const
          }
        ],
        testCommand: 'npm run test:coverage'
      };

      const result = RequiredTestsConfigSchema.parse(config);
      expect(result.enforcement).toBe('require');
      expect(result.rules).toHaveLength(2);
      expect(result.testCommand).toBe('npm run test:coverage');
    });

    it('should validate all rules in array', () => {
      expect(() => RequiredTestsConfigSchema.parse({
        rules: [
          { name: 'valid-rule', filePatterns: ['src/**/*.ts'] },
          { name: '', filePatterns: ['src/**/*.ts'] } // invalid name
        ]
      })).toThrow();
    });
  });

  describe('ApprovalRuleSchema', () => {
    it('should accept minimal approval rule', () => {
      const rule = {
        id: 'simple-rule',
        name: 'Simple Approval Rule',
        conditions: []
      };
      const result = ApprovalRuleSchema.parse(rule);
      expect(result.id).toBe('simple-rule');
      expect(result.name).toBe('Simple Approval Rule');
      expect(result.enabled).toBe(true); // default
      expect(result.urgency).toBe('normal'); // default
    });

    it('should accept comprehensive approval rule', () => {
      const rule = {
        id: 'high-cost-rule',
        name: 'High Cost Operations',
        description: 'Requires approval for expensive operations',
        enabled: true,
        conditions: [
          {
            type: 'cost_threshold' as const,
            threshold: 10.0,
            operator: 'greater_than' as const
          }
        ],
        urgency: 'high' as const,
        approvers: ['admin@company.com', 'lead@company.com'],
        timeoutMinutes: 30,
        timeoutAction: 'reject' as const,
        messageTemplate: 'Operation {operation} requires approval due to cost: ${cost}',
        tags: ['cost', 'security'],
        priority: 10
      };

      const result = ApprovalRuleSchema.parse(rule);
      expect(result.id).toBe('high-cost-rule');
      expect(result.urgency).toBe('high');
      expect(result.conditions).toHaveLength(1);
      expect(result.approvers).toHaveLength(2);
      expect(result.timeoutMinutes).toBe(30);
      expect(result.priority).toBe(10);
    });

    it('should reject rule without id', () => {
      expect(() => ApprovalRuleSchema.parse({
        name: 'Test Rule',
        conditions: []
      })).toThrow();
    });

    it('should reject rule with empty id', () => {
      expect(() => ApprovalRuleSchema.parse({
        id: '',
        name: 'Test Rule',
        conditions: []
      })).toThrow();
    });

    it('should reject rule without name', () => {
      expect(() => ApprovalRuleSchema.parse({
        id: 'test-rule',
        conditions: []
      })).toThrow();
    });

    it('should reject rule with empty name', () => {
      expect(() => ApprovalRuleSchema.parse({
        id: 'test-rule',
        name: '',
        conditions: []
      })).toThrow();
    });

    it('should reject negative priority', () => {
      expect(() => ApprovalRuleSchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        conditions: [],
        priority: -1
      })).toThrow();
    });

    it('should reject invalid timeout actions', () => {
      expect(() => ApprovalRuleSchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        conditions: [],
        timeoutAction: 'invalid'
      })).toThrow();
    });
  });

  describe('ApprovalRulesConfigSchema', () => {
    it('should accept configuration with defaults', () => {
      const result = ApprovalRulesConfigSchema.parse({});
      expect(result.enabled).toBe(true);
      expect(result.rules).toEqual([]);
      expect(result.defaultTimeoutMinutes).toBe(60);
      expect(result.defaultTimeoutAction).toBe('reject');
      expect(result.globalApprovers).toEqual([]);
      expect(result.notificationsEnabled).toBe(true);
    });

    it('should accept comprehensive configuration', () => {
      const config = {
        enabled: true,
        rules: [
          {
            id: 'cost-rule',
            name: 'Cost Control',
            conditions: [
              {
                type: 'cost_threshold' as const,
                threshold: 5.0,
                operator: 'greater_than' as const
              }
            ]
          },
          {
            id: 'file-rule',
            name: 'Critical File Protection',
            conditions: [
              {
                type: 'file_pattern' as const,
                patterns: ['src/core/**'],
                operator: 'matches_any' as const
              }
            ]
          }
        ],
        defaultTimeoutMinutes: 120,
        defaultTimeoutAction: 'escalate' as const,
        globalApprovers: ['admin@company.com'],
        notificationsEnabled: true
      };

      const result = ApprovalRulesConfigSchema.parse(config);
      expect(result.enabled).toBe(true);
      expect(result.rules).toHaveLength(2);
      expect(result.defaultTimeoutMinutes).toBe(120);
      expect(result.defaultTimeoutAction).toBe('escalate');
      expect(result.globalApprovers).toEqual(['admin@company.com']);
    });

    it('should validate all rules in array', () => {
      expect(() => ApprovalRulesConfigSchema.parse({
        rules: [
          { id: 'rule1', name: 'Rule 1', conditions: [] },
          { id: '', name: 'Rule 2', conditions: [] } // invalid id
        ]
      })).toThrow();
    });

    it('should reject invalid timeout values', () => {
      expect(() => ApprovalRulesConfigSchema.parse({
        defaultTimeoutMinutes: 0 // must be >= 1
      })).toThrow();

      expect(() => ApprovalRulesConfigSchema.parse({
        defaultTimeoutMinutes: -5 // negative not allowed
      })).toThrow();
    });
  });

  describe('PolicyConfigSchema', () => {
    it('should accept minimal configuration with defaults', () => {
      const result = PolicyConfigSchema.parse({});
      expect(result.version).toBe('1.0');
      expect(result.enforcement).toBe('warn');
      expect(result.enabled).toBe(true);
      expect(result.tags).toEqual([]);
    });

    it('should accept comprehensive policy configuration', () => {
      const config: Partial<PolicyConfig> = {
        version: '2.0',
        name: 'Production Security Policy',
        description: 'Comprehensive policy for production deployments',
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'tests/**', 'docs/**'],
          block: ['src/secrets/**', 'tmp/**']
        },
        requiredTests: {
          enforcement: 'require',
          rules: [
            {
              name: 'unit-tests',
              filePatterns: ['src/**/*.ts'],
              testPatterns: ['tests/**/*.test.ts'],
              minCoverage: 85
            }
          ],
          testCommand: 'npm run test:ci'
        },
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'security-review',
              name: 'Security Review Required',
              conditions: [
                {
                  type: 'file_pattern',
                  patterns: ['src/auth/**', 'src/security/**'],
                  operator: 'matches_any'
                }
              ],
              urgency: 'high',
              approvers: ['security@company.com']
            }
          ],
          defaultTimeoutMinutes: 240,
          globalApprovers: ['admin@company.com']
        },
        enabled: true,
        tags: ['security', 'production', 'strict'],
        metadata: {
          createdBy: 'security-team',
          lastUpdated: '2024-01-01',
          complianceLevel: 'high'
        }
      };

      const result = PolicyConfigSchema.parse(config);
      expect(result.version).toBe('2.0');
      expect(result.name).toBe('Production Security Policy');
      expect(result.enforcement).toBe('strict');
      expect(result.allowedPaths?.mode).toBe('allowlist');
      expect(result.requiredTests?.enforcement).toBe('require');
      expect(result.approvalRules?.enabled).toBe(true);
      expect(result.tags).toEqual(['security', 'production', 'strict']);
      expect(result.metadata).toEqual({
        createdBy: 'security-team',
        lastUpdated: '2024-01-01',
        complianceLevel: 'high'
      });
    });

    it('should validate nested configurations correctly', () => {
      // Test that invalid nested configs are rejected
      expect(() => PolicyConfigSchema.parse({
        allowedPaths: {
          mode: 'invalid-mode' // should fail
        }
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        requiredTests: {
          enforcement: 'invalid-enforcement' // should fail
        }
      })).toThrow();

      expect(() => PolicyConfigSchema.parse({
        approvalRules: {
          rules: [
            { id: '', name: 'Invalid Rule', conditions: [] } // invalid rule
          ]
        }
      })).toThrow();
    });

    it('should handle optional fields correctly', () => {
      const config = {
        name: 'Simple Policy'
        // All other fields should use defaults
      };

      const result = PolicyConfigSchema.parse(config);
      expect(result.name).toBe('Simple Policy');
      expect(result.version).toBe('1.0'); // default
      expect(result.enforcement).toBe('warn'); // default
      expect(result.enabled).toBe(true); // default
      expect(result.allowedPaths).toBeUndefined();
      expect(result.requiredTests).toBeUndefined();
      expect(result.approvalRules).toBeUndefined();
    });

    it('should accept complex real-world scenarios', () => {
      const config = {
        name: 'Multi-Environment Policy',
        description: 'Policy that handles different environments',
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: [
            'src/**/*.{ts,tsx,js,jsx}',
            'tests/**/*.{test,spec}.{ts,js}',
            'docs/**/*.md',
            '*.{json,yaml,yml}',
            'scripts/**/*.sh'
          ],
          block: [
            'src/**/*.secret.*',
            'node_modules/**',
            '.env*',
            'tmp/**'
          ]
        },
        requiredTests: {
          enforcement: 'require',
          rules: [
            {
              name: 'api-endpoint-tests',
              filePatterns: ['src/api/**/*.ts'],
              testPatterns: ['tests/api/**/*.test.ts'],
              requiredTestTypes: ['unit', 'integration'],
              minCoverage: 90,
              mustPass: true
            },
            {
              name: 'utility-tests',
              filePatterns: ['src/utils/**/*.ts'],
              testPatterns: ['tests/utils/**/*.test.ts'],
              minCoverage: 75,
              enforcement: 'warn'
            }
          ],
          testCommand: 'npm run test:coverage'
        },
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'high-cost-operations',
              name: 'High Cost Operations',
              conditions: [
                {
                  type: 'cost_threshold',
                  threshold: 25.0,
                  operator: 'greater_than'
                }
              ],
              urgency: 'high',
              timeoutMinutes: 60,
              approvers: ['team-lead@company.com']
            },
            {
              id: 'production-changes',
              name: 'Production File Changes',
              conditions: [
                {
                  type: 'file_pattern',
                  patterns: ['src/production/**', 'config/prod/**'],
                  operator: 'matches_any'
                }
              ],
              urgency: 'critical',
              timeoutMinutes: 30,
              approvers: ['devops@company.com', 'security@company.com']
            }
          ],
          defaultTimeoutMinutes: 120,
          globalApprovers: ['admin@company.com'],
          notificationsEnabled: true
        },
        enabled: true,
        tags: ['multi-env', 'comprehensive', 'production-ready']
      };

      expect(() => PolicyConfigSchema.parse(config)).not.toThrow();
      const result = PolicyConfigSchema.parse(config);
      expect(result.allowedPaths?.allow).toHaveLength(5);
      expect(result.requiredTests?.rules).toHaveLength(2);
      expect(result.approvalRules?.rules).toHaveLength(2);
    });
  });

  describe('Type Exports', () => {
    it('should export all necessary types', () => {
      // This test ensures the types are properly exported and can be used
      const policyConfig: PolicyConfig = {
        version: '1.0',
        enforcement: 'warn',
        enabled: true,
        tags: []
      };

      const allowedPaths: AllowedPathsConfig = {
        mode: 'allowlist',
        allow: [],
        block: []
      };

      const requiredTests: RequiredTestsConfig = {
        enforcement: 'warn',
        rules: []
      };

      const approvalRules: ApprovalRulesConfig = {
        enabled: true,
        rules: [],
        defaultTimeoutMinutes: 60,
        defaultTimeoutAction: 'reject',
        globalApprovers: [],
        notificationsEnabled: true
      };

      // Type assertions to verify the interfaces work
      expect(typeof policyConfig).toBe('object');
      expect(typeof allowedPaths).toBe('object');
      expect(typeof requiredTests).toBe('object');
      expect(typeof approvalRules).toBe('object');
    });
  });

  describe('Schema Integration', () => {
    it('should work together in complete configuration', () => {
      // Test that all schemas work together in a realistic scenario
      const completeConfig = PolicyConfigSchema.parse({
        name: 'Complete Integration Test Policy',
        allowedPaths: AllowedPathsConfigSchema.parse({
          mode: 'allowlist',
          allow: ['src/**', 'tests/**']
        }),
        requiredTests: RequiredTestsConfigSchema.parse({
          rules: [TestRequirementRuleSchema.parse({
            name: 'basic-test',
            filePatterns: ['src/**/*.ts']
          })]
        }),
        approvalRules: ApprovalRulesConfigSchema.parse({
          rules: [ApprovalRuleSchema.parse({
            id: 'test-approval',
            name: 'Test Approval',
            conditions: []
          })]
        })
      });

      expect(completeConfig).toBeDefined();
      expect(completeConfig.allowedPaths).toBeDefined();
      expect(completeConfig.requiredTests).toBeDefined();
      expect(completeConfig.approvalRules).toBeDefined();
    });
  });
});