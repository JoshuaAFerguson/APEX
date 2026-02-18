import { describe, it, expect } from 'vitest';
import {
  PolicyRuleSchema,
  PathPolicySchema,
  TestPolicySchema,
  ApprovalPolicySchema,
  PolicySchema,
  PolicyViolationSchema,
  PolicyViolationEventSchema,
} from '../types';

describe('Policy Types Edge Cases', () => {
  describe('PolicyRuleSchema Edge Cases', () => {
    it('should reject null and undefined values for required fields', () => {
      expect(() => PolicyRuleSchema.parse({ id: null, name: 'Test' })).toThrow();
      expect(() => PolicyRuleSchema.parse({ id: undefined, name: 'Test' })).toThrow();
      expect(() => PolicyRuleSchema.parse({ id: 'test', name: null })).toThrow();
      expect(() => PolicyRuleSchema.parse({ id: 'test', name: undefined })).toThrow();
    });

    it('should handle whitespace-only strings', () => {
      expect(() => PolicyRuleSchema.parse({ id: '   ', name: 'Test' })).not.toThrow();
      expect(() => PolicyRuleSchema.parse({ id: 'test', name: '   ' })).not.toThrow();
      expect(() => PolicyRuleSchema.parse({ id: '\t\n', name: 'Test' })).not.toThrow();
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const rule = { id: longString, name: longString, description: longString };
      expect(() => PolicyRuleSchema.parse(rule)).not.toThrow();
    });

    it('should handle special characters in strings', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
      const rule = { id: specialChars, name: specialChars, description: specialChars };
      expect(() => PolicyRuleSchema.parse(rule)).not.toThrow();
    });

    it('should handle unicode characters', () => {
      const unicodeString = '测试规则-правило-规則-🌟✨🚀';
      const rule = { id: unicodeString, name: unicodeString, description: unicodeString };
      expect(() => PolicyRuleSchema.parse(rule)).not.toThrow();
    });

    it('should handle empty arrays for tags', () => {
      const rule = { id: 'test', name: 'Test', tags: [] };
      const result = PolicyRuleSchema.parse(rule);
      expect(result.tags).toEqual([]);
    });

    it('should handle tags with special characters', () => {
      const rule = { id: 'test', name: 'Test', tags: ['tag-1', 'tag_2', 'tag.3', 'tag@domain'] };
      const result = PolicyRuleSchema.parse(rule);
      expect(result.tags).toEqual(['tag-1', 'tag_2', 'tag.3', 'tag@domain']);
    });

    it('should reject non-array tags', () => {
      expect(() => PolicyRuleSchema.parse({ id: 'test', name: 'Test', tags: 'not-array' })).toThrow();
      expect(() => PolicyRuleSchema.parse({ id: 'test', name: 'Test', tags: { tag: 'value' } })).toThrow();
    });

    it('should handle deeply nested metadata', () => {
      const deepMetadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep'
                }
              }
            }
          }
        }
      };
      const rule = { id: 'test', name: 'Test', metadata: deepMetadata };
      const result = PolicyRuleSchema.parse(rule);
      expect(result.metadata?.level1?.level2?.level3?.level4?.level5?.value).toBe('deep');
    });

    it('should handle metadata with various data types', () => {
      const metadata = {
        string: 'test',
        number: 42,
        float: 3.14159,
        boolean_true: true,
        boolean_false: false,
        null_value: null,
        array: [1, 'two', { three: 3 }],
        date_string: '2024-01-01T00:00:00.000Z',
        regex_pattern: '/^test.*/',
        empty_string: '',
        zero: 0
      };
      const rule = { id: 'test', name: 'Test', metadata };
      const result = PolicyRuleSchema.parse(rule);
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('PathPolicySchema Edge Cases', () => {
    it('should reject missing config object', () => {
      expect(() => PathPolicySchema.parse({
        id: 'test',
        name: 'Test',
        type: 'path'
      })).toThrow();
    });

    it('should reject invalid config structure', () => {
      expect(() => PathPolicySchema.parse({
        id: 'test',
        name: 'Test',
        type: 'path',
        config: 'not-an-object'
      })).toThrow();
    });

    it('should handle empty path patterns', () => {
      const policy = {
        id: 'test',
        name: 'Test',
        type: 'path' as const,
        config: {
          mode: 'allowlist' as const,
          allow: [],
          block: []
        }
      };
      const result = PathPolicySchema.parse(policy);
      expect(result.config.allow).toEqual([]);
      expect(result.config.block).toEqual([]);
    });

    it('should handle complex glob patterns', () => {
      const complexPatterns = [
        'src/**/*.{ts,tsx,js,jsx}',
        '**/*.test.{spec,test}.{ts,js}',
        'config/environments/{dev,staging,prod}/**',
        '**/node_modules/**/{package.json,.bin/**}',
        '**/*.!(test|spec|stories).*',
        '{src,lib,test}/**/*.{json,yaml,yml}',
        '**/.*{ignore,env*,rc*}'
      ];

      const policy = {
        id: 'complex-patterns',
        name: 'Complex Patterns',
        type: 'path' as const,
        config: {
          mode: 'allowlist' as const,
          allow: complexPatterns,
          block: []
        }
      };

      const result = PathPolicySchema.parse(policy);
      expect(result.config.allow).toEqual(complexPatterns);
    });

    it('should handle paths with spaces and special characters', () => {
      const specialPaths = [
        'My Documents/**',
        'paths with spaces/**',
        'paths-with-dashes/**',
        'paths_with_underscores/**',
        'paths.with.dots/**',
        'paths@with@symbols/**',
        'paths(with)parentheses/**',
        'paths[with]brackets/**'
      ];

      const policy = {
        id: 'special-paths',
        name: 'Special Paths',
        type: 'path' as const,
        config: {
          mode: 'blocklist' as const,
          allow: [],
          block: specialPaths
        }
      };

      const result = PathPolicySchema.parse(policy);
      expect(result.config.block).toEqual(specialPaths);
    });

    it('should handle very long path lists', () => {
      const manyPaths = Array.from({ length: 1000 }, (_, i) => `path${i}/**`);

      const policy = {
        id: 'many-paths',
        name: 'Many Paths',
        type: 'path' as const,
        config: {
          mode: 'allowlist' as const,
          allow: manyPaths,
          block: []
        }
      };

      const result = PathPolicySchema.parse(policy);
      expect(result.config.allow).toHaveLength(1000);
    });
  });

  describe('TestPolicySchema Edge Cases', () => {
    it('should handle empty test rules', () => {
      const policy = {
        id: 'empty-rules',
        name: 'Empty Rules',
        type: 'test' as const,
        config: {
          enforcement: 'warn' as const,
          rules: []
        }
      };

      const result = TestPolicySchema.parse(policy);
      expect(result.config.rules).toEqual([]);
    });

    it('should handle test rules with extreme coverage values', () => {
      const policy = {
        id: 'extreme-coverage',
        name: 'Extreme Coverage',
        type: 'test' as const,
        config: {
          enforcement: 'require' as const,
          rules: [
            {
              name: 'zero-coverage',
              filePatterns: ['src/**/*.ts'],
              minCoverage: 0
            },
            {
              name: 'perfect-coverage',
              filePatterns: ['src/**/*.ts'],
              minCoverage: 100
            }
          ]
        }
      };

      const result = TestPolicySchema.parse(policy);
      expect(result.config.rules[0].minCoverage).toBe(0);
      expect(result.config.rules[1].minCoverage).toBe(100);
    });

    it('should reject coverage values outside 0-100 range', () => {
      expect(() => TestPolicySchema.parse({
        id: 'invalid-coverage',
        name: 'Invalid Coverage',
        type: 'test',
        config: {
          enforcement: 'require',
          rules: [
            {
              name: 'over-100',
              filePatterns: ['src/**/*.ts'],
              minCoverage: 101
            }
          ]
        }
      })).toThrow();

      expect(() => TestPolicySchema.parse({
        id: 'negative-coverage',
        name: 'Negative Coverage',
        type: 'test',
        config: {
          enforcement: 'require',
          rules: [
            {
              name: 'negative',
              filePatterns: ['src/**/*.ts'],
              minCoverage: -1
            }
          ]
        }
      })).toThrow();
    });

    it('should handle complex test patterns', () => {
      const policy = {
        id: 'complex-test-patterns',
        name: 'Complex Test Patterns',
        type: 'test' as const,
        config: {
          enforcement: 'require' as const,
          rules: [
            {
              name: 'multi-pattern-rule',
              filePatterns: ['src/**/*.{ts,tsx}', 'lib/**/*.js'],
              testPatterns: ['tests/**/*.{test,spec}.{ts,js}', '__tests__/**/*.{ts,js}'],
              requiredTestTypes: ['unit', 'integration', 'e2e', 'acceptance'],
              minCoverage: 85
            }
          ]
        }
      };

      const result = TestPolicySchema.parse(policy);
      expect(result.config.rules[0].filePatterns).toHaveLength(2);
      expect(result.config.rules[0].testPatterns).toHaveLength(2);
      expect(result.config.rules[0].requiredTestTypes).toHaveLength(4);
    });

    it('should handle very long test commands', () => {
      const longCommand = 'npm run test:unit && npm run test:integration && npm run test:e2e -- --coverage --reporter=verbose --timeout=60000 --retries=3';

      const policy = {
        id: 'long-command',
        name: 'Long Command',
        type: 'test' as const,
        config: {
          enforcement: 'warn' as const,
          rules: [],
          testCommand: longCommand
        }
      };

      const result = TestPolicySchema.parse(policy);
      expect(result.config.testCommand).toBe(longCommand);
    });
  });

  describe('ApprovalPolicySchema Edge Cases', () => {
    it('should handle empty approval rules', () => {
      const policy = {
        id: 'empty-approval',
        name: 'Empty Approval',
        type: 'approval' as const,
        config: {
          enabled: false,
          rules: [],
          defaultTimeoutMinutes: 1,
          defaultTimeoutAction: 'reject' as const,
          globalApprovers: [],
          notificationsEnabled: false
        }
      };

      const result = ApprovalPolicySchema.parse(policy);
      expect(result.config.rules).toEqual([]);
      expect(result.config.globalApprovers).toEqual([]);
    });

    it('should handle extreme timeout values', () => {
      const policy = {
        id: 'extreme-timeouts',
        name: 'Extreme Timeouts',
        type: 'approval' as const,
        config: {
          enabled: true,
          rules: [
            {
              id: 'very-short',
              name: 'Very Short',
              conditions: [],
              timeoutMinutes: 1
            },
            {
              id: 'very-long',
              name: 'Very Long',
              conditions: [],
              timeoutMinutes: 43200 // 30 days
            }
          ],
          defaultTimeoutMinutes: 1,
          defaultTimeoutAction: 'reject' as const,
          globalApprovers: [],
          notificationsEnabled: true
        }
      };

      const result = ApprovalPolicySchema.parse(policy);
      expect(result.config.rules[0].timeoutMinutes).toBe(1);
      expect(result.config.rules[1].timeoutMinutes).toBe(43200);
    });

    it('should reject zero or negative timeout values', () => {
      expect(() => ApprovalPolicySchema.parse({
        id: 'zero-timeout',
        name: 'Zero Timeout',
        type: 'approval',
        config: {
          enabled: true,
          rules: [],
          defaultTimeoutMinutes: 0,
          defaultTimeoutAction: 'reject',
          globalApprovers: [],
          notificationsEnabled: true
        }
      })).toThrow();

      expect(() => ApprovalPolicySchema.parse({
        id: 'negative-timeout',
        name: 'Negative Timeout',
        type: 'approval',
        config: {
          enabled: true,
          rules: [{
            id: 'negative',
            name: 'Negative',
            conditions: [],
            timeoutMinutes: -1
          }],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject',
          globalApprovers: [],
          notificationsEnabled: true
        }
      })).toThrow();
    });

    it('should handle many approvers', () => {
      const manyApprovers = Array.from({ length: 100 }, (_, i) => `approver${i}@company.com`);

      const policy = {
        id: 'many-approvers',
        name: 'Many Approvers',
        type: 'approval' as const,
        config: {
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              name: 'Rule 1',
              conditions: [],
              approvers: manyApprovers.slice(0, 50)
            }
          ],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'escalate' as const,
          globalApprovers: manyApprovers.slice(50),
          notificationsEnabled: true
        }
      };

      const result = ApprovalPolicySchema.parse(policy);
      expect(result.config.rules[0].approvers).toHaveLength(50);
      expect(result.config.globalApprovers).toHaveLength(50);
    });

    it('should handle complex approval conditions', () => {
      const policy = {
        id: 'complex-conditions',
        name: 'Complex Conditions',
        type: 'approval' as const,
        config: {
          enabled: true,
          rules: [
            {
              id: 'multi-condition',
              name: 'Multi Condition',
              conditions: [
                {
                  type: 'cost_threshold' as const,
                  threshold: 0.01,
                  operator: 'greater_than' as const
                },
                {
                  type: 'file_pattern' as const,
                  patterns: ['**/*.{prod,production}.*', 'config/prod/**', 'deploy/**'],
                  operator: 'matches_any' as const
                },
                {
                  type: 'time_range' as const,
                  startTime: '09:00',
                  endTime: '17:00',
                  timezone: 'UTC',
                  operator: 'within' as const
                }
              ]
            }
          ],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject' as const,
          globalApprovers: [],
          notificationsEnabled: true
        }
      };

      const result = ApprovalPolicySchema.parse(policy);
      expect(result.config.rules[0].conditions).toHaveLength(3);
    });

    it('should handle special email formats for approvers', () => {
      const specialEmails = [
        'user+tag@domain.com',
        'user.name@sub.domain.co.uk',
        'user_name@domain-name.org',
        'user123@domain123.net',
        'very.long.email.address@very.long.domain.name.example.com'
      ];

      const policy = {
        id: 'special-emails',
        name: 'Special Emails',
        type: 'approval' as const,
        config: {
          enabled: true,
          rules: [],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject' as const,
          globalApprovers: specialEmails,
          notificationsEnabled: true
        }
      };

      const result = ApprovalPolicySchema.parse(policy);
      expect(result.config.globalApprovers).toEqual(specialEmails);
    });
  });

  describe('PolicyViolationSchema Edge Cases', () => {
    it('should handle violations with minimal data', () => {
      const violation = {
        id: 'min-violation',
        ruleId: 'rule-1',
        policyType: 'path' as const,
        severity: 'info' as const,
        message: 'M',  // Single character message
        timestamp: new Date()
      };

      const result = PolicyViolationSchema.parse(violation);
      expect(result.message).toBe('M');
    });

    it('should handle very long violation messages', () => {
      const longMessage = 'This is a very long violation message that could potentially contain a lot of details about what went wrong, including stack traces, file paths, user actions, system state, and other diagnostic information. '.repeat(100);

      const violation = {
        id: 'long-message',
        ruleId: 'rule-1',
        policyType: 'test' as const,
        severity: 'error' as const,
        message: longMessage,
        timestamp: new Date()
      };

      const result = PolicyViolationSchema.parse(violation);
      expect(result.message).toBe(longMessage);
      expect(result.message.length).toBeGreaterThan(10000);
    });

    it('should handle complex violation context', () => {
      const complexContext = {
        stackTrace: [
          'Error: Test failed',
          '  at TestRunner.run (/src/test.ts:42:15)',
          '  at async main (/src/main.ts:123:5)'
        ],
        environment: {
          node: '18.16.0',
          npm: '9.6.4',
          platform: 'linux',
          arch: 'x64'
        },
        testResults: {
          passed: 234,
          failed: 12,
          skipped: 5,
          failedTests: [
            { name: 'should handle edge case', file: 'test/edge.test.ts', line: 42 },
            { name: 'should validate input', file: 'test/validation.test.ts', line: 15 }
          ]
        },
        performanceMetrics: {
          testDuration: 45.6,
          memoryUsage: 156.7,
          cpuUsage: 78.9
        }
      };

      const violation = {
        id: 'complex-context',
        ruleId: 'test-rule',
        policyType: 'test' as const,
        severity: 'error' as const,
        message: 'Tests failed with complex context',
        context: complexContext,
        timestamp: new Date()
      };

      const result = PolicyViolationSchema.parse(violation);
      expect(result.context?.testResults?.failed).toBe(12);
      expect(result.context?.environment?.node).toBe('18.16.0');
    });

    it('should handle resolution workflow', () => {
      const timestamp = new Date('2024-01-01T10:00:00Z');
      const resolvedAt = new Date('2024-01-01T10:30:00Z');

      const violation = {
        id: 'resolved-violation',
        ruleId: 'security-rule',
        policyType: 'approval' as const,
        severity: 'warning' as const,
        message: 'Approval required for production deployment',
        resource: 'production/config.yml',
        timestamp,
        resolved: true,
        resolvedAt,
        resolution: 'Approved by security team after review. Changes verified safe for production.'
      };

      const result = PolicyViolationSchema.parse(violation);
      expect(result.resolved).toBe(true);
      expect(result.resolvedAt).toEqual(resolvedAt);
      expect(result.resolution).toContain('security team');
    });

    it('should handle all severity levels', () => {
      const severities = ['info', 'warning', 'error'];
      const policyTypes = ['path', 'test', 'approval'];

      severities.forEach(severity => {
        policyTypes.forEach(policyType => {
          const violation = {
            id: `violation-${severity}-${policyType}`,
            ruleId: 'rule-1',
            policyType: policyType as any,
            severity: severity as any,
            message: `${severity} level violation for ${policyType} policy`,
            timestamp: new Date()
          };

          expect(() => PolicyViolationSchema.parse(violation)).not.toThrow();
          const result = PolicyViolationSchema.parse(violation);
          expect(result.severity).toBe(severity);
          expect(result.policyType).toBe(policyType);
        });
      });
    });

    it('should reject invalid timestamp formats', () => {
      expect(() => PolicyViolationSchema.parse({
        id: 'invalid-timestamp',
        ruleId: 'rule-1',
        policyType: 'path',
        severity: 'warning',
        message: 'Test',
        timestamp: 'not-a-date'
      })).toThrow();

      expect(() => PolicyViolationSchema.parse({
        id: 'invalid-timestamp-2',
        ruleId: 'rule-1',
        policyType: 'path',
        severity: 'warning',
        message: 'Test',
        timestamp: 1234567890  // number instead of Date
      })).toThrow();
    });
  });

  describe('PolicyViolationEventSchema Edge Cases', () => {
    it('should handle events with all optional fields populated', () => {
      const violation = {
        id: 'full-violation',
        ruleId: 'comprehensive-rule',
        policyType: 'approval' as const,
        severity: 'critical' as const,
        message: 'Critical approval violation',
        description: 'High-cost operation requires immediate approval',
        resource: 'production/database/migration',
        context: { cost: 500.00, impact: 'high' },
        timestamp: new Date(),
        resolved: false
      };

      const event = {
        type: 'policy_violation' as const,
        id: 'comprehensive-event',
        timestamp: new Date(),
        violation,
        taskId: 'task-abc-123',
        agentId: 'approval-agent-v1',
        workflowId: 'production-deployment-workflow',
        metadata: {
          source: 'automated-scanner',
          environment: 'production',
          region: 'us-east-1',
          notifications: {
            email: true,
            slack: true,
            webhook: true
          },
          escalation: {
            level: 2,
            contacts: ['oncall@company.com', '+1-555-0123']
          }
        }
      };

      const result = PolicyViolationEventSchema.parse(event);
      expect(result.taskId).toBe('task-abc-123');
      expect(result.agentId).toBe('approval-agent-v1');
      expect(result.workflowId).toBe('production-deployment-workflow');
      expect(result.metadata?.environment).toBe('production');
      expect(result.violation.context?.cost).toBe(500.00);
    });

    it('should handle events with minimal violation data', () => {
      const minimalViolation = {
        id: 'minimal',
        ruleId: 'r1',
        policyType: 'path' as const,
        severity: 'info' as const,
        message: 'Info',
        timestamp: new Date()
      };

      const event = {
        type: 'policy_violation' as const,
        id: 'minimal-event',
        timestamp: new Date(),
        violation: minimalViolation
      };

      const result = PolicyViolationEventSchema.parse(event);
      expect(result.violation.message).toBe('Info');
      expect(result.taskId).toBeUndefined();
      expect(result.agentId).toBeUndefined();
      expect(result.workflowId).toBeUndefined();
    });

    it('should handle events with very large metadata', () => {
      const largeMetadata = {
        logs: Array.from({ length: 1000 }, (_, i) => `Log entry ${i}: Operation completed successfully`),
        diagnostics: {
          memory: Array.from({ length: 100 }, (_, i) => ({ timestamp: i, usage: Math.random() * 100 })),
          cpu: Array.from({ length: 100 }, (_, i) => ({ timestamp: i, usage: Math.random() * 100 }))
        },
        configuration: {
          settings: Object.fromEntries(
            Array.from({ length: 200 }, (_, i) => [`setting_${i}`, `value_${i}`])
          )
        }
      };

      const violation = {
        id: 'large-data',
        ruleId: 'rule-1',
        policyType: 'test' as const,
        severity: 'warning' as const,
        message: 'Test with large data',
        timestamp: new Date()
      };

      const event = {
        type: 'policy_violation' as const,
        id: 'large-metadata-event',
        timestamp: new Date(),
        violation,
        metadata: largeMetadata
      };

      const result = PolicyViolationEventSchema.parse(event);
      expect(result.metadata?.logs).toHaveLength(1000);
      expect(result.metadata?.diagnostics?.memory).toHaveLength(100);
      expect(Object.keys(result.metadata?.configuration?.settings || {})).toHaveLength(200);
    });

    it('should handle concurrent timestamp scenarios', () => {
      const baseTime = new Date('2024-01-01T12:00:00Z');
      const sameTime = new Date('2024-01-01T12:00:00Z');
      const slightlyLater = new Date('2024-01-01T12:00:00.001Z');

      const violation = {
        id: 'timing-test',
        ruleId: 'timing-rule',
        policyType: 'path' as const,
        severity: 'info' as const,
        message: 'Timing test',
        timestamp: baseTime
      };

      const event1 = {
        type: 'policy_violation' as const,
        id: 'event-1',
        timestamp: sameTime,
        violation
      };

      const event2 = {
        type: 'policy_violation' as const,
        id: 'event-2',
        timestamp: slightlyLater,
        violation
      };

      const result1 = PolicyViolationEventSchema.parse(event1);
      const result2 = PolicyViolationEventSchema.parse(event2);

      expect(result1.timestamp).toEqual(sameTime);
      expect(result2.timestamp).toEqual(slightlyLater);
      expect(result2.timestamp.getTime() - result1.timestamp.getTime()).toBe(1);
    });
  });

  describe('Cross-Schema Validation', () => {
    it('should reject PolicySchema when type and config mismatch', () => {
      // Path type with test config
      expect(() => PolicySchema.parse({
        id: 'mismatch-1',
        name: 'Mismatch 1',
        type: 'path',
        config: { enforcement: 'warn', rules: [] }  // test config
      })).toThrow();

      // Test type with approval config
      expect(() => PolicySchema.parse({
        id: 'mismatch-2',
        name: 'Mismatch 2',
        type: 'test',
        config: { enabled: true, rules: [], defaultTimeoutMinutes: 60 }  // approval config
      })).toThrow();

      // Approval type with path config
      expect(() => PolicySchema.parse({
        id: 'mismatch-3',
        name: 'Mismatch 3',
        type: 'approval',
        config: { mode: 'allowlist', allow: [], block: [] }  // path config
      })).toThrow();
    });

    it('should maintain referential integrity in violation events', () => {
      const ruleId = 'integrity-rule';
      const violation = {
        id: 'integrity-violation',
        ruleId,
        policyType: 'test' as const,
        severity: 'error' as const,
        message: 'Integrity test',
        timestamp: new Date()
      };

      const event = {
        type: 'policy_violation' as const,
        id: 'integrity-event',
        timestamp: new Date(),
        violation
      };

      const result = PolicyViolationEventSchema.parse(event);
      expect(result.violation.ruleId).toBe(ruleId);
    });

    it('should handle nested schema validation correctly', () => {
      // Test that deeply nested invalid data is caught
      expect(() => PathPolicySchema.parse({
        id: 'deep-invalid',
        name: 'Deep Invalid',
        type: 'path',
        config: {
          mode: 'allowlist',
          allow: ['valid/path/**'],
          block: [null, undefined, '', 'valid/block/**']  // mix of invalid and valid
        }
      })).toThrow();
    });
  });
});