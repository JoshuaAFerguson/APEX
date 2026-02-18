import { describe, it, expect } from 'vitest';
import {
  PolicyRuleSchema,
  PolicyRule,
  PathPolicySchema,
  PathPolicy,
  TestPolicySchema,
  TestPolicy,
  ApprovalPolicySchema,
  ApprovalPolicy,
  PolicySchema,
  Policy,
  PolicyViolationSchema,
  PolicyViolation,
  PolicyViolationEventSchema,
  PolicyViolationEvent,
  PolicyEnforcementModeSchema,
  AllowedPathsConfigSchema,
  RequiredTestsConfigSchema,
  ApprovalRulesConfigSchema,
} from '../types';

describe('Policy Domain Types', () => {
  describe('PolicyRuleSchema', () => {
    it('should accept minimal valid policy rule', () => {
      const rule = {
        id: 'rule-1',
        name: 'Basic Rule'
      };
      const result = PolicyRuleSchema.parse(rule);
      expect(result.id).toBe('rule-1');
      expect(result.name).toBe('Basic Rule');
      expect(result.enabled).toBe(true); // default
      expect(result.tags).toEqual([]); // default
    });

    it('should accept comprehensive policy rule', () => {
      const rule = {
        id: 'comprehensive-rule',
        name: 'Comprehensive Rule',
        description: 'A comprehensive rule for testing',
        enabled: false,
        enforcement: 'strict' as const,
        tags: ['security', 'compliance'],
        metadata: {
          createdBy: 'test-user',
          version: '1.0',
          lastUpdated: '2024-01-01'
        }
      };
      const result = PolicyRuleSchema.parse(rule);
      expect(result.id).toBe('comprehensive-rule');
      expect(result.name).toBe('Comprehensive Rule');
      expect(result.description).toBe('A comprehensive rule for testing');
      expect(result.enabled).toBe(false);
      expect(result.enforcement).toBe('strict');
      expect(result.tags).toEqual(['security', 'compliance']);
      expect(result.metadata).toEqual({
        createdBy: 'test-user',
        version: '1.0',
        lastUpdated: '2024-01-01'
      });
    });

    it('should reject rule without id', () => {
      expect(() => PolicyRuleSchema.parse({
        name: 'Test Rule'
      })).toThrow();
    });

    it('should reject rule without name', () => {
      expect(() => PolicyRuleSchema.parse({
        id: 'test-rule'
      })).toThrow();
    });

    it('should reject rule with empty id', () => {
      expect(() => PolicyRuleSchema.parse({
        id: '',
        name: 'Test Rule'
      })).toThrow();
    });

    it('should reject rule with empty name', () => {
      expect(() => PolicyRuleSchema.parse({
        id: 'test-rule',
        name: ''
      })).toThrow();
    });

    it('should reject invalid enforcement mode', () => {
      expect(() => PolicyRuleSchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        enforcement: 'invalid-mode'
      })).toThrow();
    });

    it('should accept valid enforcement modes', () => {
      const modes = ['strict', 'warn', 'audit', 'disabled'];
      modes.forEach(mode => {
        const rule = {
          id: 'test-rule',
          name: 'Test Rule',
          enforcement: mode as any
        };
        expect(() => PolicyRuleSchema.parse(rule)).not.toThrow();
        const result = PolicyRuleSchema.parse(rule);
        expect(result.enforcement).toBe(mode);
      });
    });

    it('should handle complex metadata', () => {
      const rule = {
        id: 'metadata-rule',
        name: 'Metadata Rule',
        metadata: {
          nested: { deeply: { nested: { value: 'test' } } },
          array: [1, 2, 3],
          boolean: true,
          number: 42,
          null_value: null,
          string: 'test'
        }
      };
      const result = PolicyRuleSchema.parse(rule);
      expect(result.metadata).toEqual(rule.metadata);
    });
  });

  describe('PathPolicySchema', () => {
    it('should accept minimal path policy', () => {
      const policy = {
        id: 'path-rule',
        name: 'Path Rule',
        type: 'path' as const,
        config: {
          mode: 'allowlist' as const,
          allow: ['src/**'],
          block: []
        }
      };
      const result = PathPolicySchema.parse(policy);
      expect(result.type).toBe('path');
      expect(result.id).toBe('path-rule');
      expect(result.config.mode).toBe('allowlist');
      expect(result.config.allow).toEqual(['src/**']);
    });

    it('should accept comprehensive path policy', () => {
      const policy = {
        id: 'comprehensive-path-rule',
        name: 'Comprehensive Path Rule',
        description: 'Controls access to critical files',
        type: 'path' as const,
        enabled: true,
        enforcement: 'strict' as const,
        tags: ['security', 'filesystem'],
        config: {
          mode: 'allowlist' as const,
          allow: ['src/**/*.ts', 'tests/**/*.test.ts', 'docs/**/*.md'],
          block: ['src/secrets/**', 'node_modules/**']
        },
        metadata: {
          team: 'security',
          severity: 'high'
        }
      };
      const result = PathPolicySchema.parse(policy);
      expect(result.type).toBe('path');
      expect(result.config.allow).toEqual(['src/**/*.ts', 'tests/**/*.test.ts', 'docs/**/*.md']);
      expect(result.config.block).toEqual(['src/secrets/**', 'node_modules/**']);
      expect(result.enforcement).toBe('strict');
    });

    it('should reject path policy without type field', () => {
      expect(() => PathPolicySchema.parse({
        id: 'path-rule',
        name: 'Path Rule',
        config: { mode: 'allowlist', allow: [], block: [] }
      })).toThrow();
    });

    it('should reject path policy with wrong type', () => {
      expect(() => PathPolicySchema.parse({
        id: 'path-rule',
        name: 'Path Rule',
        type: 'wrong-type',
        config: { mode: 'allowlist', allow: [], block: [] }
      })).toThrow();
    });

    it('should reject path policy with invalid config', () => {
      expect(() => PathPolicySchema.parse({
        id: 'path-rule',
        name: 'Path Rule',
        type: 'path',
        config: { mode: 'invalid-mode', allow: [], block: [] }
      })).toThrow();
    });

    it('should work with blocklist configuration', () => {
      const policy = {
        id: 'blocklist-rule',
        name: 'Blocklist Rule',
        type: 'path' as const,
        config: {
          mode: 'blocklist' as const,
          allow: [],
          block: ['node_modules/**', '.git/**', 'tmp/**']
        }
      };
      const result = PathPolicySchema.parse(policy);
      expect(result.config.mode).toBe('blocklist');
      expect(result.config.block).toEqual(['node_modules/**', '.git/**', 'tmp/**']);
    });
  });

  describe('TestPolicySchema', () => {
    it('should accept minimal test policy', () => {
      const policy = {
        id: 'test-rule',
        name: 'Test Rule',
        type: 'test' as const,
        config: {
          enforcement: 'warn' as const,
          rules: []
        }
      };
      const result = TestPolicySchema.parse(policy);
      expect(result.type).toBe('test');
      expect(result.id).toBe('test-rule');
      expect(result.config.enforcement).toBe('warn');
    });

    it('should accept comprehensive test policy', () => {
      const policy = {
        id: 'comprehensive-test-rule',
        name: 'Comprehensive Test Rule',
        description: 'Enforces comprehensive testing requirements',
        type: 'test' as const,
        enabled: true,
        enforcement: 'strict' as const,
        tags: ['testing', 'quality'],
        config: {
          enforcement: 'require' as const,
          rules: [
            {
              name: 'unit-tests',
              filePatterns: ['src/**/*.ts'],
              testPatterns: ['tests/**/*.test.ts'],
              requiredTestTypes: ['unit', 'integration'],
              minCoverage: 85,
              enforcement: 'require' as const,
              mustPass: true,
              enabled: true
            },
            {
              name: 'api-tests',
              filePatterns: ['src/api/**/*.ts'],
              testPatterns: ['tests/api/**/*.test.ts'],
              minCoverage: 90,
              mustPass: true
            }
          ],
          testCommand: 'npm run test:ci'
        },
        metadata: {
          team: 'qa',
          priority: 'high'
        }
      };
      const result = TestPolicySchema.parse(policy);
      expect(result.type).toBe('test');
      expect(result.config.rules).toHaveLength(2);
      expect(result.config.rules[0].minCoverage).toBe(85);
      expect(result.config.rules[1].minCoverage).toBe(90);
      expect(result.config.testCommand).toBe('npm run test:ci');
    });

    it('should reject test policy without type field', () => {
      expect(() => TestPolicySchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        config: { enforcement: 'warn', rules: [] }
      })).toThrow();
    });

    it('should reject test policy with wrong type', () => {
      expect(() => TestPolicySchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        type: 'wrong-type',
        config: { enforcement: 'warn', rules: [] }
      })).toThrow();
    });

    it('should reject test policy with invalid config', () => {
      expect(() => TestPolicySchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        type: 'test',
        config: { enforcement: 'invalid', rules: [] }
      })).toThrow();
    });

    it('should validate nested test rules', () => {
      expect(() => TestPolicySchema.parse({
        id: 'test-rule',
        name: 'Test Rule',
        type: 'test',
        config: {
          enforcement: 'require',
          rules: [
            { name: '', filePatterns: ['src/**/*.ts'] } // invalid rule
          ]
        }
      })).toThrow();
    });
  });

  describe('ApprovalPolicySchema', () => {
    it('should accept minimal approval policy', () => {
      const policy = {
        id: 'approval-rule',
        name: 'Approval Rule',
        type: 'approval' as const,
        config: {
          enabled: true,
          rules: [],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject' as const,
          globalApprovers: [],
          notificationsEnabled: true
        }
      };
      const result = ApprovalPolicySchema.parse(policy);
      expect(result.type).toBe('approval');
      expect(result.id).toBe('approval-rule');
      expect(result.config.enabled).toBe(true);
    });

    it('should accept comprehensive approval policy', () => {
      const policy = {
        id: 'comprehensive-approval-rule',
        name: 'Comprehensive Approval Rule',
        description: 'Requires approval for sensitive operations',
        type: 'approval' as const,
        enabled: true,
        enforcement: 'strict' as const,
        tags: ['security', 'approval'],
        config: {
          enabled: true,
          rules: [
            {
              id: 'high-cost-rule',
              name: 'High Cost Rule',
              conditions: [
                {
                  type: 'cost_threshold' as const,
                  threshold: 50.0,
                  operator: 'greater_than' as const
                }
              ],
              urgency: 'high' as const,
              approvers: ['admin@company.com'],
              timeoutMinutes: 30,
              timeoutAction: 'escalate' as const
            },
            {
              id: 'file-pattern-rule',
              name: 'File Pattern Rule',
              conditions: [
                {
                  type: 'file_pattern' as const,
                  patterns: ['src/core/**', 'config/production/**'],
                  operator: 'matches_any' as const
                }
              ],
              urgency: 'critical' as const,
              approvers: ['security@company.com', 'devops@company.com']
            }
          ],
          defaultTimeoutMinutes: 120,
          defaultTimeoutAction: 'escalate' as const,
          globalApprovers: ['admin@company.com'],
          notificationsEnabled: true
        },
        metadata: {
          team: 'security',
          compliance: 'required'
        }
      };
      const result = ApprovalPolicySchema.parse(policy);
      expect(result.type).toBe('approval');
      expect(result.config.rules).toHaveLength(2);
      expect(result.config.rules[0].urgency).toBe('high');
      expect(result.config.rules[1].urgency).toBe('critical');
      expect(result.config.defaultTimeoutMinutes).toBe(120);
    });

    it('should reject approval policy without type field', () => {
      expect(() => ApprovalPolicySchema.parse({
        id: 'approval-rule',
        name: 'Approval Rule',
        config: { enabled: true, rules: [], defaultTimeoutMinutes: 60, defaultTimeoutAction: 'reject', globalApprovers: [], notificationsEnabled: true }
      })).toThrow();
    });

    it('should reject approval policy with wrong type', () => {
      expect(() => ApprovalPolicySchema.parse({
        id: 'approval-rule',
        name: 'Approval Rule',
        type: 'wrong-type',
        config: { enabled: true, rules: [], defaultTimeoutMinutes: 60, defaultTimeoutAction: 'reject', globalApprovers: [], notificationsEnabled: true }
      })).toThrow();
    });

    it('should reject approval policy with invalid config', () => {
      expect(() => ApprovalPolicySchema.parse({
        id: 'approval-rule',
        name: 'Approval Rule',
        type: 'approval',
        config: { enabled: true, rules: [], defaultTimeoutMinutes: -1 } // invalid timeout
      })).toThrow();
    });

    it('should validate nested approval rules', () => {
      expect(() => ApprovalPolicySchema.parse({
        id: 'approval-rule',
        name: 'Approval Rule',
        type: 'approval',
        config: {
          enabled: true,
          rules: [
            { id: '', name: 'Invalid Rule', conditions: [] } // invalid rule
          ],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject',
          globalApprovers: [],
          notificationsEnabled: true
        }
      })).toThrow();
    });
  });

  describe('PolicySchema (Discriminated Union)', () => {
    it('should accept all policy types in union', () => {
      const pathPolicy = {
        id: 'path-1',
        name: 'Path Policy',
        type: 'path' as const,
        config: { mode: 'allowlist' as const, allow: ['src/**'], block: [] }
      };

      const testPolicy = {
        id: 'test-1',
        name: 'Test Policy',
        type: 'test' as const,
        config: { enforcement: 'warn' as const, rules: [] }
      };

      const approvalPolicy = {
        id: 'approval-1',
        name: 'Approval Policy',
        type: 'approval' as const,
        config: {
          enabled: true,
          rules: [],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject' as const,
          globalApprovers: [],
          notificationsEnabled: true
        }
      };

      expect(() => PolicySchema.parse(pathPolicy)).not.toThrow();
      expect(() => PolicySchema.parse(testPolicy)).not.toThrow();
      expect(() => PolicySchema.parse(approvalPolicy)).not.toThrow();

      const pathResult = PolicySchema.parse(pathPolicy);
      const testResult = PolicySchema.parse(testPolicy);
      const approvalResult = PolicySchema.parse(approvalPolicy);

      expect(pathResult.type).toBe('path');
      expect(testResult.type).toBe('test');
      expect(approvalResult.type).toBe('approval');
    });

    it('should reject policy with invalid type', () => {
      expect(() => PolicySchema.parse({
        id: 'invalid-policy',
        name: 'Invalid Policy',
        type: 'invalid-type',
        config: {}
      })).toThrow();
    });

    it('should reject policy without type discriminator', () => {
      expect(() => PolicySchema.parse({
        id: 'no-type-policy',
        name: 'No Type Policy',
        config: {}
      })).toThrow();
    });

    it('should correctly discriminate between types', () => {
      const policies = [
        { id: 'p1', name: 'Path', type: 'path' as const, config: { mode: 'allowlist' as const, allow: [], block: [] } },
        { id: 'p2', name: 'Test', type: 'test' as const, config: { enforcement: 'warn' as const, rules: [] } },
        { id: 'p3', name: 'Approval', type: 'approval' as const, config: { enabled: true, rules: [], defaultTimeoutMinutes: 60, defaultTimeoutAction: 'reject' as const, globalApprovers: [], notificationsEnabled: true } }
      ];

      const results = policies.map(p => PolicySchema.parse(p));
      expect(results[0].type).toBe('path');
      expect(results[1].type).toBe('test');
      expect(results[2].type).toBe('approval');
    });

    it('should validate config according to discriminated type', () => {
      // Path policy with test config should fail
      expect(() => PolicySchema.parse({
        id: 'invalid-config',
        name: 'Invalid Config',
        type: 'path',
        config: { enforcement: 'warn', rules: [] } // test config, not path config
      })).toThrow();

      // Test policy with approval config should fail
      expect(() => PolicySchema.parse({
        id: 'invalid-config-2',
        name: 'Invalid Config 2',
        type: 'test',
        config: { enabled: true, rules: [], defaultTimeoutMinutes: 60 } // approval config, not test config
      })).toThrow();
    });
  });

  describe('PolicyViolationSchema', () => {
    it('should accept minimal policy violation', () => {
      const violation = {
        id: 'violation-1',
        ruleId: 'rule-1',
        policyType: 'path' as const,
        severity: 'warning' as const,
        message: 'Path access violation',
        timestamp: new Date()
      };
      const result = PolicyViolationSchema.parse(violation);
      expect(result.id).toBe('violation-1');
      expect(result.ruleId).toBe('rule-1');
      expect(result.policyType).toBe('path');
      expect(result.severity).toBe('warning');
      expect(result.resolved).toBe(false); // default
    });

    it('should accept comprehensive policy violation', () => {
      const timestamp = new Date();
      const resolvedAt = new Date(timestamp.getTime() + 1000);

      const violation = {
        id: 'comprehensive-violation',
        ruleId: 'comprehensive-rule',
        policyType: 'test' as const,
        severity: 'error' as const,
        message: 'Test coverage below threshold',
        description: 'Unit test coverage is 65%, which is below the required 80%',
        resource: 'src/api/userService.ts',
        context: {
          currentCoverage: 65,
          requiredCoverage: 80,
          missingTests: ['handleUserCreation', 'validateUserInput']
        },
        timestamp,
        resolved: true,
        resolvedAt,
        resolution: 'Added missing unit tests to meet coverage requirements'
      };
      const result = PolicyViolationSchema.parse(violation);
      expect(result.id).toBe('comprehensive-violation');
      expect(result.description).toBe('Unit test coverage is 65%, which is below the required 80%');
      expect(result.resource).toBe('src/api/userService.ts');
      expect(result.context?.currentCoverage).toBe(65);
      expect(result.resolved).toBe(true);
      expect(result.resolvedAt).toEqual(resolvedAt);
      expect(result.resolution).toBe('Added missing unit tests to meet coverage requirements');
    });

    it('should reject violation without required fields', () => {
      expect(() => PolicyViolationSchema.parse({
        ruleId: 'rule-1',
        policyType: 'path',
        severity: 'warning',
        message: 'Test',
        timestamp: new Date()
      })).toThrow(); // missing id

      expect(() => PolicyViolationSchema.parse({
        id: 'violation-1',
        policyType: 'path',
        severity: 'warning',
        message: 'Test',
        timestamp: new Date()
      })).toThrow(); // missing ruleId

      expect(() => PolicyViolationSchema.parse({
        id: 'violation-1',
        ruleId: 'rule-1',
        severity: 'warning',
        message: 'Test',
        timestamp: new Date()
      })).toThrow(); // missing policyType
    });

    it('should reject violation with invalid enum values', () => {
      const baseViolation = {
        id: 'violation-1',
        ruleId: 'rule-1',
        message: 'Test',
        timestamp: new Date()
      };

      expect(() => PolicyViolationSchema.parse({
        ...baseViolation,
        policyType: 'invalid-type',
        severity: 'warning'
      })).toThrow(); // invalid policyType

      expect(() => PolicyViolationSchema.parse({
        ...baseViolation,
        policyType: 'path',
        severity: 'invalid-severity'
      })).toThrow(); // invalid severity
    });

    it('should accept all valid policy types and severities', () => {
      const policyTypes = ['path', 'test', 'approval'];
      const severities = ['info', 'warning', 'error'];

      policyTypes.forEach(policyType => {
        severities.forEach(severity => {
          const violation = {
            id: `violation-${policyType}-${severity}`,
            ruleId: 'rule-1',
            policyType: policyType as any,
            severity: severity as any,
            message: 'Test violation',
            timestamp: new Date()
          };
          expect(() => PolicyViolationSchema.parse(violation)).not.toThrow();
          const result = PolicyViolationSchema.parse(violation);
          expect(result.policyType).toBe(policyType);
          expect(result.severity).toBe(severity);
        });
      });
    });

    it('should handle complex context data', () => {
      const violation = {
        id: 'context-violation',
        ruleId: 'rule-1',
        policyType: 'approval' as const,
        severity: 'error' as const,
        message: 'Approval required',
        timestamp: new Date(),
        context: {
          nested: { deeply: { nested: { value: 'test' } } },
          array: [1, 2, 3, { nested: 'value' }],
          boolean: true,
          number: 42.5,
          null_value: null,
          undefined_value: undefined, // should be handled gracefully
          cost: 125.75,
          approvers: ['user1@test.com', 'user2@test.com']
        }
      };
      const result = PolicyViolationSchema.parse(violation);
      expect(result.context).toBeDefined();
      expect(result.context?.cost).toBe(125.75);
      expect(result.context?.approvers).toEqual(['user1@test.com', 'user2@test.com']);
    });
  });

  describe('PolicyViolationEventSchema', () => {
    it('should accept minimal policy violation event', () => {
      const violation = {
        id: 'violation-1',
        ruleId: 'rule-1',
        policyType: 'path' as const,
        severity: 'warning' as const,
        message: 'Path access violation',
        timestamp: new Date()
      };

      const event = {
        type: 'policy_violation' as const,
        id: 'event-1',
        timestamp: new Date(),
        violation
      };
      const result = PolicyViolationEventSchema.parse(event);
      expect(result.type).toBe('policy_violation');
      expect(result.id).toBe('event-1');
      expect(result.violation.id).toBe('violation-1');
    });

    it('should accept comprehensive policy violation event', () => {
      const violation = {
        id: 'comprehensive-violation',
        ruleId: 'test-rule',
        policyType: 'test' as const,
        severity: 'error' as const,
        message: 'Test failed',
        description: 'Unit tests are failing',
        resource: 'src/service.ts',
        context: { failedTests: 3, totalTests: 25 },
        timestamp: new Date(),
        resolved: false
      };

      const event = {
        type: 'policy_violation' as const,
        id: 'comprehensive-event',
        timestamp: new Date(),
        violation,
        taskId: 'task-123',
        agentId: 'agent-abc',
        workflowId: 'workflow-xyz',
        metadata: {
          environment: 'production',
          triggeredBy: 'automated-check',
          notificationsSent: ['admin@company.com', 'team@company.com']
        }
      };
      const result = PolicyViolationEventSchema.parse(event);
      expect(result.type).toBe('policy_violation');
      expect(result.violation.policyType).toBe('test');
      expect(result.taskId).toBe('task-123');
      expect(result.agentId).toBe('agent-abc');
      expect(result.workflowId).toBe('workflow-xyz');
      expect(result.metadata?.environment).toBe('production');
    });

    it('should reject event without required fields', () => {
      const violation = {
        id: 'violation-1',
        ruleId: 'rule-1',
        policyType: 'path' as const,
        severity: 'warning' as const,
        message: 'Test',
        timestamp: new Date()
      };

      expect(() => PolicyViolationEventSchema.parse({
        id: 'event-1',
        timestamp: new Date(),
        violation
      })).toThrow(); // missing type

      expect(() => PolicyViolationEventSchema.parse({
        type: 'policy_violation',
        timestamp: new Date(),
        violation
      })).toThrow(); // missing id

      expect(() => PolicyViolationEventSchema.parse({
        type: 'policy_violation',
        id: 'event-1',
        violation
      })).toThrow(); // missing timestamp
    });

    it('should reject event with wrong type', () => {
      const violation = {
        id: 'violation-1',
        ruleId: 'rule-1',
        policyType: 'path' as const,
        severity: 'warning' as const,
        message: 'Test',
        timestamp: new Date()
      };

      expect(() => PolicyViolationEventSchema.parse({
        type: 'wrong_type',
        id: 'event-1',
        timestamp: new Date(),
        violation
      })).toThrow();
    });

    it('should validate nested violation object', () => {
      const invalidViolation = {
        id: 'violation-1',
        ruleId: 'rule-1',
        policyType: 'invalid-type', // invalid
        severity: 'warning',
        message: 'Test',
        timestamp: new Date()
      };

      expect(() => PolicyViolationEventSchema.parse({
        type: 'policy_violation',
        id: 'event-1',
        timestamp: new Date(),
        violation: invalidViolation
      })).toThrow();
    });

    it('should handle complex metadata', () => {
      const violation = {
        id: 'violation-1',
        ruleId: 'rule-1',
        policyType: 'approval' as const,
        severity: 'error' as const,
        message: 'Approval required',
        timestamp: new Date()
      };

      const event = {
        type: 'policy_violation' as const,
        id: 'metadata-event',
        timestamp: new Date(),
        violation,
        metadata: {
          complex: {
            nested: {
              structure: {
                with: ['arrays', 'and', 'values']
              }
            }
          },
          notifications: {
            email: ['user1@test.com'],
            slack: ['#security-alerts'],
            webhook: 'https://example.com/webhook'
          },
          cost: 99.99,
          priority: 'high'
        }
      };
      const result = PolicyViolationEventSchema.parse(event);
      expect(result.metadata?.cost).toBe(99.99);
      expect(result.metadata?.priority).toBe('high');
      expect(result.metadata?.notifications?.email).toEqual(['user1@test.com']);
    });
  });

  describe('Type Integration', () => {
    it('should work together in realistic scenarios', () => {
      // Create a path policy
      const pathPolicy: PathPolicy = {
        id: 'security-paths',
        name: 'Security Path Control',
        description: 'Controls access to security-sensitive paths',
        type: 'path',
        enabled: true,
        enforcement: 'strict',
        tags: ['security', 'filesystem'],
        config: {
          mode: 'allowlist',
          allow: ['src/public/**', 'docs/**'],
          block: ['src/secrets/**', '.env*']
        },
        metadata: { team: 'security' }
      };

      // Create a test policy
      const testPolicy: TestPolicy = {
        id: 'comprehensive-testing',
        name: 'Comprehensive Testing Policy',
        type: 'test',
        enabled: true,
        config: {
          enforcement: 'require',
          rules: [
            {
              name: 'api-tests',
              filePatterns: ['src/api/**/*.ts'],
              testPatterns: ['tests/api/**/*.test.ts'],
              minCoverage: 85,
              mustPass: true
            }
          ]
        }
      };

      // Create an approval policy
      const approvalPolicy: ApprovalPolicy = {
        id: 'high-cost-approval',
        name: 'High Cost Approval Policy',
        type: 'approval',
        enabled: true,
        config: {
          enabled: true,
          rules: [
            {
              id: 'cost-control',
              name: 'Cost Control',
              conditions: [
                {
                  type: 'cost_threshold',
                  threshold: 100.0,
                  operator: 'greater_than'
                }
              ],
              urgency: 'high',
              approvers: ['finance@company.com']
            }
          ],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject',
          globalApprovers: ['admin@company.com'],
          notificationsEnabled: true
        }
      };

      // Validate all policies
      expect(() => PathPolicySchema.parse(pathPolicy)).not.toThrow();
      expect(() => TestPolicySchema.parse(testPolicy)).not.toThrow();
      expect(() => ApprovalPolicySchema.parse(approvalPolicy)).not.toThrow();
      expect(() => PolicySchema.parse(pathPolicy)).not.toThrow();
      expect(() => PolicySchema.parse(testPolicy)).not.toThrow();
      expect(() => PolicySchema.parse(approvalPolicy)).not.toThrow();

      // Create a violation for the test policy
      const violation: PolicyViolation = {
        id: 'test-violation-1',
        ruleId: testPolicy.id,
        policyType: 'test',
        severity: 'error',
        message: 'Test coverage below threshold',
        resource: 'src/api/userService.ts',
        context: { currentCoverage: 75, requiredCoverage: 85 },
        timestamp: new Date()
      };

      // Create an event for the violation
      const violationEvent: PolicyViolationEvent = {
        type: 'policy_violation',
        id: 'event-1',
        timestamp: new Date(),
        violation,
        taskId: 'task-123',
        agentId: 'tester-agent',
        workflowId: 'testing-workflow'
      };

      expect(() => PolicyViolationSchema.parse(violation)).not.toThrow();
      expect(() => PolicyViolationEventSchema.parse(violationEvent)).not.toThrow();

      const parsedEvent = PolicyViolationEventSchema.parse(violationEvent);
      expect(parsedEvent.violation.policyType).toBe('test');
      expect(parsedEvent.violation.ruleId).toBe('comprehensive-testing');
    });

    it('should support policy arrays and collections', () => {
      const policies: Policy[] = [
        {
          id: 'path-1',
          name: 'Path Policy 1',
          type: 'path',
          config: { mode: 'allowlist', allow: ['src/**'], block: [] }
        },
        {
          id: 'test-1',
          name: 'Test Policy 1',
          type: 'test',
          config: { enforcement: 'warn', rules: [] }
        },
        {
          id: 'approval-1',
          name: 'Approval Policy 1',
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

      // Validate each policy in the collection
      policies.forEach(policy => {
        expect(() => PolicySchema.parse(policy)).not.toThrow();
      });

      // Verify discriminated union works correctly
      const pathPolicies = policies.filter(p => p.type === 'path') as PathPolicy[];
      const testPolicies = policies.filter(p => p.type === 'test') as TestPolicy[];
      const approvalPolicies = policies.filter(p => p.type === 'approval') as ApprovalPolicy[];

      expect(pathPolicies).toHaveLength(1);
      expect(testPolicies).toHaveLength(1);
      expect(approvalPolicies).toHaveLength(1);
    });
  });

  describe('Type Safety and TypeScript Integration', () => {
    it('should provide proper TypeScript types', () => {
      // Test that the types can be used in TypeScript without compilation errors
      const policyRule: PolicyRule = {
        id: 'test-rule',
        name: 'Test Rule',
        enabled: true,
        tags: []
      };

      const pathPolicy: PathPolicy = {
        ...policyRule,
        type: 'path',
        config: {
          mode: 'allowlist',
          allow: [],
          block: []
        }
      };

      const testPolicy: TestPolicy = {
        ...policyRule,
        type: 'test',
        config: {
          enforcement: 'warn',
          rules: []
        }
      };

      const approvalPolicy: ApprovalPolicy = {
        ...policyRule,
        type: 'approval',
        config: {
          enabled: true,
          rules: [],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject',
          globalApprovers: [],
          notificationsEnabled: true
        }
      };

      const violation: PolicyViolation = {
        id: 'v1',
        ruleId: 'r1',
        policyType: 'test',
        severity: 'warning',
        message: 'Test',
        timestamp: new Date()
      };

      const event: PolicyViolationEvent = {
        type: 'policy_violation',
        id: 'e1',
        timestamp: new Date(),
        violation
      };

      // Type assertions to verify TypeScript compatibility
      expect(typeof pathPolicy.id).toBe('string');
      expect(typeof testPolicy.config.enforcement).toBe('string');
      expect(typeof approvalPolicy.config.enabled).toBe('boolean');
      expect(typeof violation.timestamp).toBe('object');
      expect(typeof event.violation.id).toBe('string');
    });
  });
});