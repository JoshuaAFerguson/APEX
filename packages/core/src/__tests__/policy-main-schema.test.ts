import { describe, it, expect } from 'vitest';
import {
  PolicySchema,
  Policy,
  PolicyRuleSchema,
  PolicyRule,
  PolicySeveritySchema,
  PolicySeverity,
  PolicyEnforcementModeSchema,
  PolicyEnforcementMode,
  LegacyPolicySchema,
  LegacyPolicy,
  PathPolicySchema,
  TestPolicySchema,
  ApprovalPolicySchema,
} from '../types';

describe('Main Policy Schema Tests', () => {
  describe('PolicySchema', () => {
    it('should accept minimal valid policy', () => {
      const policy = {
        id: 'minimal-policy',
        name: 'Minimal Policy',
        rules: []
      };

      const result = PolicySchema.parse(policy);
      expect(result.id).toBe('minimal-policy');
      expect(result.name).toBe('Minimal Policy');
      expect(result.rules).toEqual([]);
      expect(result.enabled).toBe(true); // default
      expect(result.enforcement).toBe('warn'); // default
      expect(result.tags).toEqual([]); // default
      expect(result.description).toBeUndefined();
      expect(result.severityLevels).toBeUndefined();
      expect(result.version).toBeUndefined();
      expect(result.metadata).toBeUndefined();
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
    });

    it('should accept comprehensive policy with all fields', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const updatedAt = new Date('2024-01-15T12:30:00Z');

      const policy = {
        id: 'comprehensive-policy',
        name: 'Comprehensive Security Policy',
        description: 'A comprehensive policy covering all security aspects',
        rules: [
          {
            id: 'rule-1',
            name: 'First Rule',
            description: 'First security rule',
            severity: 'high' as PolicySeverity,
            enabled: true,
            enforcement: 'strict' as PolicyEnforcementMode,
            tags: ['security', 'access'],
            metadata: { priority: 10 }
          },
          {
            id: 'rule-2',
            name: 'Second Rule',
            severity: 'medium' as PolicySeverity,
            enabled: false,
            tags: ['compliance']
          }
        ],
        severityLevels: {
          default: 'medium' as PolicySeverity,
          overrides: {
            'security-rules': 'high' as PolicySeverity,
            'compliance-rules': 'low' as PolicySeverity
          }
        },
        enabled: true,
        enforcement: 'strict' as PolicyEnforcementMode,
        version: '2.1.0',
        tags: ['security', 'compliance', 'production'],
        metadata: {
          department: 'security',
          owner: 'security-team@company.com',
          lastReview: '2024-01-01',
          complianceFramework: 'SOX',
          priority: 'high',
          nestedConfig: {
            auditEnabled: true,
            reportingLevel: 'detailed'
          }
        },
        createdAt,
        updatedAt
      };

      const result = PolicySchema.parse(policy);
      expect(result.id).toBe('comprehensive-policy');
      expect(result.name).toBe('Comprehensive Security Policy');
      expect(result.description).toBe('A comprehensive policy covering all security aspects');
      expect(result.rules).toHaveLength(2);
      expect(result.rules[0].id).toBe('rule-1');
      expect(result.rules[0].severity).toBe('high');
      expect(result.rules[1].id).toBe('rule-2');
      expect(result.rules[1].enabled).toBe(false);
      expect(result.severityLevels?.default).toBe('medium');
      expect(result.severityLevels?.overrides?.['security-rules']).toBe('high');
      expect(result.enabled).toBe(true);
      expect(result.enforcement).toBe('strict');
      expect(result.version).toBe('2.1.0');
      expect(result.tags).toEqual(['security', 'compliance', 'production']);
      expect(result.metadata?.department).toBe('security');
      expect(result.metadata?.nestedConfig?.auditEnabled).toBe(true);
      expect(result.createdAt).toEqual(createdAt);
      expect(result.updatedAt).toEqual(updatedAt);
    });

    it('should reject policy without required fields', () => {
      expect(() => PolicySchema.parse({
        name: 'Test Policy',
        rules: []
      })).toThrow(); // missing id

      expect(() => PolicySchema.parse({
        id: 'test-policy',
        rules: []
      })).toThrow(); // missing name

      expect(() => PolicySchema.parse({
        id: 'test-policy',
        name: 'Test Policy'
      })).toThrow(); // missing rules
    });

    it('should reject policy with empty required strings', () => {
      expect(() => PolicySchema.parse({
        id: '',
        name: 'Test Policy',
        rules: []
      })).toThrow(); // empty id

      expect(() => PolicySchema.parse({
        id: 'test-policy',
        name: '',
        rules: []
      })).toThrow(); // empty name
    });

    it('should reject policy with invalid enforcement mode', () => {
      expect(() => PolicySchema.parse({
        id: 'test-policy',
        name: 'Test Policy',
        rules: [],
        enforcement: 'invalid-mode'
      })).toThrow();
    });

    it('should validate enforcement modes correctly', () => {
      const validModes: PolicyEnforcementMode[] = ['strict', 'warn', 'audit', 'disabled'];

      validModes.forEach(mode => {
        const policy = {
          id: `test-policy-${mode}`,
          name: `Test Policy ${mode}`,
          rules: [],
          enforcement: mode
        };

        expect(() => PolicySchema.parse(policy)).not.toThrow();
        const result = PolicySchema.parse(policy);
        expect(result.enforcement).toBe(mode);
      });
    });

    it('should validate severity levels configuration', () => {
      const validSeverities: PolicySeverity[] = ['low', 'medium', 'high', 'critical'];

      validSeverities.forEach(severity => {
        const policy = {
          id: `test-policy-${severity}`,
          name: `Test Policy ${severity}`,
          rules: [],
          severityLevels: {
            default: severity
          }
        };

        expect(() => PolicySchema.parse(policy)).not.toThrow();
        const result = PolicySchema.parse(policy);
        expect(result.severityLevels?.default).toBe(severity);
      });

      // Test invalid default severity
      expect(() => PolicySchema.parse({
        id: 'test-policy',
        name: 'Test Policy',
        rules: [],
        severityLevels: {
          default: 'invalid-severity'
        }
      })).toThrow();

      // Test invalid override severity
      expect(() => PolicySchema.parse({
        id: 'test-policy',
        name: 'Test Policy',
        rules: [],
        severityLevels: {
          default: 'medium',
          overrides: {
            'test-rule': 'invalid-severity'
          }
        }
      })).toThrow();
    });

    it('should validate nested rules correctly', () => {
      const validRule: PolicyRule = {
        id: 'valid-rule',
        name: 'Valid Rule',
        severity: 'medium',
        enabled: true,
        enforcement: 'warn',
        tags: ['test'],
        metadata: { source: 'test' }
      };

      const policy = {
        id: 'test-policy',
        name: 'Test Policy',
        rules: [validRule]
      };

      expect(() => PolicySchema.parse(policy)).not.toThrow();
      const result = PolicySchema.parse(policy);
      expect(result.rules[0].id).toBe('valid-rule');

      // Test invalid rule
      const invalidRulePolicy = {
        id: 'test-policy',
        name: 'Test Policy',
        rules: [
          {
            id: '',
            name: 'Invalid Rule',
            severity: 'medium'
          }
        ]
      };

      expect(() => PolicySchema.parse(invalidRulePolicy)).toThrow();
    });

    it('should handle complex metadata correctly', () => {
      const policy = {
        id: 'metadata-policy',
        name: 'Metadata Policy',
        rules: [],
        metadata: {
          simple: 'value',
          number: 42,
          boolean: true,
          null_value: null,
          nested: {
            level1: {
              level2: {
                deepValue: 'test'
              }
            }
          },
          array: [1, 2, 3, { nested: 'array-value' }],
          configuration: {
            retries: 3,
            timeout: 5000,
            endpoints: ['api.example.com', 'backup.example.com'],
            features: {
              caching: true,
              monitoring: false
            }
          }
        }
      };

      const result = PolicySchema.parse(policy);
      expect(result.metadata?.simple).toBe('value');
      expect(result.metadata?.number).toBe(42);
      expect(result.metadata?.nested?.level1?.level2?.deepValue).toBe('test');
      expect(result.metadata?.configuration?.retries).toBe(3);
      expect(result.metadata?.configuration?.endpoints).toEqual(['api.example.com', 'backup.example.com']);
    });

    it('should handle dates correctly', () => {
      const now = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const policy = {
        id: 'date-policy',
        name: 'Date Policy',
        rules: [],
        createdAt: yesterday,
        updatedAt: now
      };

      const result = PolicySchema.parse(policy);
      expect(result.createdAt).toEqual(yesterday);
      expect(result.updatedAt).toEqual(now);
    });

    it('should work with multiple rules of different configurations', () => {
      const policy = {
        id: 'multi-rule-policy',
        name: 'Multi Rule Policy',
        rules: [
          {
            id: 'rule-1',
            name: 'High Security Rule',
            severity: 'critical' as PolicySeverity,
            enabled: true,
            enforcement: 'strict' as PolicyEnforcementMode,
            tags: ['security', 'critical'],
            metadata: {
              priority: 'highest',
              alertLevel: 'immediate'
            }
          },
          {
            id: 'rule-2',
            name: 'Medium Quality Rule',
            description: 'Ensures medium quality standards',
            severity: 'medium' as PolicySeverity,
            enabled: true,
            enforcement: 'warn' as PolicyEnforcementMode,
            tags: ['quality'],
            metadata: {
              category: 'quality-assurance'
            }
          },
          {
            id: 'rule-3',
            name: 'Low Priority Rule',
            severity: 'low' as PolicySeverity,
            enabled: false,
            tags: []
          }
        ]
      };

      const result = PolicySchema.parse(policy);
      expect(result.rules).toHaveLength(3);
      expect(result.rules[0].severity).toBe('critical');
      expect(result.rules[0].enforcement).toBe('strict');
      expect(result.rules[1].severity).toBe('medium');
      expect(result.rules[1].description).toBe('Ensures medium quality standards');
      expect(result.rules[2].enabled).toBe(false);
    });
  });

  describe('LegacyPolicySchema (Discriminated Union)', () => {
    it('should accept valid path policy', () => {
      const pathPolicy = {
        id: 'path-policy',
        name: 'Path Policy',
        type: 'path' as const,
        config: {
          mode: 'allowlist' as const,
          allow: ['src/**'],
          block: ['secrets/**']
        },
        enabled: true,
        enforcement: 'strict' as PolicyEnforcementMode,
        tags: ['security']
      };

      expect(() => LegacyPolicySchema.parse(pathPolicy)).not.toThrow();
      const result = LegacyPolicySchema.parse(pathPolicy);
      expect(result.type).toBe('path');
      expect(result.id).toBe('path-policy');

      // Type narrowing should work
      if (result.type === 'path') {
        expect(result.config.mode).toBe('allowlist');
        expect(result.config.allow).toEqual(['src/**']);
      }
    });

    it('should accept valid test policy', () => {
      const testPolicy = {
        id: 'test-policy',
        name: 'Test Policy',
        type: 'test' as const,
        config: {
          enforcement: 'require' as const,
          rules: [
            {
              name: 'unit-tests',
              filePatterns: ['src/**/*.ts'],
              minCoverage: 80
            }
          ]
        },
        enabled: true
      };

      expect(() => LegacyPolicySchema.parse(testPolicy)).not.toThrow();
      const result = LegacyPolicySchema.parse(testPolicy);
      expect(result.type).toBe('test');

      // Type narrowing should work
      if (result.type === 'test') {
        expect(result.config.enforcement).toBe('require');
        expect(result.config.rules).toHaveLength(1);
      }
    });

    it('should accept valid approval policy', () => {
      const approvalPolicy = {
        id: 'approval-policy',
        name: 'Approval Policy',
        type: 'approval' as const,
        config: {
          enabled: true,
          rules: [
            {
              id: 'cost-approval',
              name: 'Cost Approval',
              conditions: [
                {
                  type: 'cost_threshold' as const,
                  threshold: 10.0,
                  operator: 'greater_than' as const
                }
              ]
            }
          ],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject' as const,
          globalApprovers: ['admin@company.com'],
          notificationsEnabled: true
        }
      };

      expect(() => LegacyPolicySchema.parse(approvalPolicy)).not.toThrow();
      const result = LegacyPolicySchema.parse(approvalPolicy);
      expect(result.type).toBe('approval');

      // Type narrowing should work
      if (result.type === 'approval') {
        expect(result.config.enabled).toBe(true);
        expect(result.config.rules).toHaveLength(1);
        expect(result.config.defaultTimeoutMinutes).toBe(60);
      }
    });

    it('should reject policy without type discriminator', () => {
      expect(() => LegacyPolicySchema.parse({
        id: 'no-type-policy',
        name: 'No Type Policy',
        config: {}
      })).toThrow();
    });

    it('should reject policy with invalid type', () => {
      expect(() => LegacyPolicySchema.parse({
        id: 'invalid-policy',
        name: 'Invalid Policy',
        type: 'invalid-type',
        config: {}
      })).toThrow();
    });

    it('should validate config matches discriminated type', () => {
      // Path type with test config should fail
      expect(() => LegacyPolicySchema.parse({
        id: 'wrong-config',
        name: 'Wrong Config',
        type: 'path',
        config: { enforcement: 'warn', rules: [] } // test config, not path config
      })).toThrow();

      // Test type with approval config should fail
      expect(() => LegacyPolicySchema.parse({
        id: 'wrong-config',
        name: 'Wrong Config',
        type: 'test',
        config: { enabled: true, rules: [], defaultTimeoutMinutes: 60 } // approval config
      })).toThrow();

      // Approval type with path config should fail
      expect(() => LegacyPolicySchema.parse({
        id: 'wrong-config',
        name: 'Wrong Config',
        type: 'approval',
        config: { mode: 'allowlist', allow: [], block: [] } // path config
      })).toThrow();
    });

    it('should support type discrimination in arrays', () => {
      const policies: LegacyPolicy[] = [
        {
          id: 'path-1',
          name: 'Path 1',
          type: 'path',
          config: { mode: 'allowlist', allow: ['src/**'], block: [] }
        },
        {
          id: 'test-1',
          name: 'Test 1',
          type: 'test',
          config: { enforcement: 'warn', rules: [] }
        },
        {
          id: 'approval-1',
          name: 'Approval 1',
          type: 'approval',
          config: {
            enabled: true,
            rules: [],
            defaultTimeoutMinutes: 60,
            defaultTimeoutAction: 'reject',
            globalApprovers: [],
            notificationsEnabled: true
          }
        }
      ];

      // Validate each policy
      policies.forEach(policy => {
        expect(() => LegacyPolicySchema.parse(policy)).not.toThrow();
      });

      // Filter by type (demonstrates type discrimination)
      const pathPolicies = policies.filter(p => p.type === 'path');
      const testPolicies = policies.filter(p => p.type === 'test');
      const approvalPolicies = policies.filter(p => p.type === 'approval');

      expect(pathPolicies).toHaveLength(1);
      expect(testPolicies).toHaveLength(1);
      expect(approvalPolicies).toHaveLength(1);
    });
  });

  describe('TypeScript Integration', () => {
    it('should provide proper TypeScript types', () => {
      // Test that the types can be used correctly in TypeScript
      const policy: Policy = {
        id: 'typescript-policy',
        name: 'TypeScript Policy',
        description: 'Testing TypeScript integration',
        rules: [
          {
            id: 'ts-rule',
            name: 'TypeScript Rule',
            severity: 'medium',
            enabled: true,
            tags: ['typescript']
          }
        ],
        enabled: true,
        enforcement: 'warn',
        version: '1.0.0',
        tags: ['test'],
        metadata: {
          language: 'typescript',
          framework: 'zod'
        }
      };

      const legacyPolicy: LegacyPolicy = {
        id: 'legacy-ts-policy',
        name: 'Legacy TypeScript Policy',
        type: 'path',
        config: {
          mode: 'allowlist',
          allow: ['src/**/*.ts'],
          block: ['**/*.js']
        }
      };

      // Type assertions to verify TypeScript compatibility
      expect(typeof policy.id).toBe('string');
      expect(typeof policy.enabled).toBe('boolean');
      expect(Array.isArray(policy.rules)).toBe(true);
      expect(typeof legacyPolicy.type).toBe('string');
    });

    it('should work with type guards for discriminated unions', () => {
      const policies: LegacyPolicy[] = [
        {
          id: 'guard-path',
          name: 'Path Policy',
          type: 'path',
          config: { mode: 'allowlist', allow: [], block: [] }
        },
        {
          id: 'guard-test',
          name: 'Test Policy',
          type: 'test',
          config: { enforcement: 'warn', rules: [] }
        },
        {
          id: 'guard-approval',
          name: 'Approval Policy',
          type: 'approval',
          config: {
            enabled: true,
            rules: [],
            defaultTimeoutMinutes: 60,
            defaultTimeoutAction: 'reject',
            globalApprovers: [],
            notificationsEnabled: true
          }
        }
      ];

      policies.forEach(policy => {
        const parsed = LegacyPolicySchema.parse(policy);

        // Type guards should work correctly
        if (parsed.type === 'path') {
          expect(parsed.config.mode).toBeDefined();
          expect(Array.isArray(parsed.config.allow)).toBe(true);
        } else if (parsed.type === 'test') {
          expect(parsed.config.enforcement).toBeDefined();
          expect(Array.isArray(parsed.config.rules)).toBe(true);
        } else if (parsed.type === 'approval') {
          expect(typeof parsed.config.enabled).toBe('boolean');
          expect(typeof parsed.config.defaultTimeoutMinutes).toBe('number');
        }
      });
    });
  });
});