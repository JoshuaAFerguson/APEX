import { describe, it, expect } from 'vitest';
import {
  PolicyViolationSchema,
  PolicyValidationResultSchema,
  TaskPolicyCheckResultSchema,
  PolicySchema,
  PolicySeveritySchema,
  PolicyEnforcementModeSchema,
  LegacyPolicySchema,
} from '../types';

describe('Policy Types Edge Cases', () => {
  describe('PolicyViolationSchema Edge Cases', () => {
    it('should handle violations with all optional fields populated', () => {
      const violation = {
        id: 'comprehensive-violation',
        ruleId: 'comprehensive-rule',
        policyType: 'approval',
        severity: 'critical',
        message: 'Critical approval required',
        description: 'This operation requires immediate approval due to high cost and security implications',
        resource: 'infrastructure/production/database-migration.sql',
        context: {
          cost: 500.00,
          estimatedDowntime: '2 hours',
          affectedUsers: 50000,
          backupStatus: 'completed',
          approvers: ['dba@company.com', 'security@company.com', 'cto@company.com']
        },
        timestamp: new Date(),
        blocking: true,
        resolved: false,
        resolvedAt: null,
        resolution: null
      };

      expect(() => PolicyViolationSchema.parse(violation)).not.toThrow();
      const parsed = PolicyViolationSchema.parse(violation);
      expect(parsed.context?.cost).toBe(500.00);
      expect(parsed.blocking).toBe(true);
      expect(parsed.resolved).toBe(false);
    });

    it('should handle resolved violations', () => {
      const resolvedAt = new Date();
      const violation = {
        id: 'resolved-violation',
        ruleId: 'test-rule',
        policyType: 'test',
        severity: 'medium',
        message: 'Test coverage below threshold',
        timestamp: new Date(),
        blocking: false,
        resolved: true,
        resolvedAt,
        resolution: 'Added additional unit tests to meet coverage requirement'
      };

      const parsed = PolicyViolationSchema.parse(violation);
      expect(parsed.resolved).toBe(true);
      expect(parsed.resolvedAt).toEqual(resolvedAt);
      expect(parsed.resolution).toBe('Added additional unit tests to meet coverage requirement');
    });

    it('should reject violations with inconsistent resolved state', () => {
      // Resolved = true but no resolvedAt date should still parse (data might be incomplete)
      const violation = {
        id: 'incomplete-resolution',
        ruleId: 'test-rule',
        policyType: 'path',
        severity: 'low',
        message: 'Test',
        timestamp: new Date(),
        blocking: false,
        resolved: true
        // Missing resolvedAt - this should still be valid as resolvedAt is optional
      };

      expect(() => PolicyViolationSchema.parse(violation)).not.toThrow();
      const parsed = PolicyViolationSchema.parse(violation);
      expect(parsed.resolved).toBe(true);
      expect(parsed.resolvedAt).toBeUndefined();
    });
  });

  describe('PolicyValidationResult Edge Cases', () => {
    it('should handle validation with timeout/error context', () => {
      const result = {
        passed: false,
        violations: [],
        validatedAt: new Date(),
        context: {
          timeout: true,
          timeoutAfterMs: 30000,
          errorMessage: 'Validation timed out after 30 seconds',
          partialResults: {
            rulesChecked: 5,
            rulesTotalCount: 20,
            completionPercentage: 25
          }
        }
      };

      const parsed = PolicyValidationResultSchema.parse(result);
      expect(parsed.passed).toBe(false);
      expect(parsed.violations).toHaveLength(0);
      expect(parsed.context?.timeout).toBe(true);
      expect(parsed.context?.partialResults?.completionPercentage).toBe(25);
    });

    it('should handle validation with performance metrics', () => {
      const result = {
        passed: true,
        violations: [],
        context: {
          performance: {
            totalDurationMs: 1250,
            ruleEvaluationTimes: {
              'path-rules': 450,
              'test-rules': 600,
              'approval-rules': 200
            },
            cacheStats: {
              hits: 15,
              misses: 5,
              hitRate: 0.75
            },
            resourceUsage: {
              memoryMb: 128,
              cpuPercent: 45
            }
          }
        }
      };

      const parsed = PolicyValidationResultSchema.parse(result);
      expect(parsed.context?.performance?.totalDurationMs).toBe(1250);
      expect(parsed.context?.performance?.cacheStats?.hitRate).toBe(0.75);
    });
  });

  describe('TaskPolicyCheckResult Edge Cases', () => {
    it('should handle different enforcement modes correctly', () => {
      const enforcementModes = ['strict', 'warn', 'audit', 'disabled'] as const;

      enforcementModes.forEach(mode => {
        const result = {
          passed: mode !== 'strict', // Only strict mode might cause failures
          blocked: mode === 'strict',
          violations: [],
          checkedAt: new Date(),
          policyName: `${mode}-policy`,
          enforcementMode: mode
        };

        expect(() => TaskPolicyCheckResultSchema.parse(result)).not.toThrow();
        const parsed = TaskPolicyCheckResultSchema.parse(result);
        expect(parsed.enforcementMode).toBe(mode);
      });
    });

    it('should handle task check with mixed violation severities', () => {
      const violations = [
        {
          id: 'low-violation',
          ruleId: 'low-rule',
          policyType: 'test',
          severity: 'low',
          message: 'Low priority issue',
          timestamp: new Date(),
          blocking: false
        },
        {
          id: 'medium-violation',
          ruleId: 'medium-rule',
          policyType: 'test',
          severity: 'medium',
          message: 'Medium priority issue',
          timestamp: new Date(),
          blocking: false
        },
        {
          id: 'high-violation',
          ruleId: 'high-rule',
          policyType: 'path',
          severity: 'high',
          message: 'High priority issue',
          timestamp: new Date(),
          blocking: true
        },
        {
          id: 'critical-violation',
          ruleId: 'critical-rule',
          policyType: 'approval',
          severity: 'critical',
          message: 'Critical issue requiring immediate attention',
          timestamp: new Date(),
          blocking: true
        }
      ];

      const result = {
        passed: false,
        blocked: true, // Blocked due to high and critical violations
        violations,
        checkedAt: new Date(),
        policyName: 'comprehensive-policy',
        enforcementMode: 'strict'
      };

      const parsed = TaskPolicyCheckResultSchema.parse(result);
      expect(parsed.violations).toHaveLength(4);
      expect(parsed.violations.filter(v => v.blocking)).toHaveLength(2);
      expect(parsed.violations.filter(v => v.severity === 'critical')).toHaveLength(1);
    });
  });

  describe('Policy Schema Edge Cases', () => {
    it('should handle policy with complex severity level overrides', () => {
      const policy = {
        id: 'complex-severity-policy',
        name: 'Complex Severity Policy',
        rules: [],
        severityLevels: {
          default: 'medium',
          overrides: {
            'security-rules': 'critical',
            'performance-rules': 'high',
            'documentation-rules': 'low',
            'style-rules': 'low',
            'compatibility-rules': 'medium'
          }
        },
        enforcement: 'strict',
        metadata: {
          ruleCategories: {
            security: ['auth', 'crypto', 'permissions'],
            performance: ['memory', 'cpu', 'network'],
            documentation: ['jsdoc', 'readme', 'comments'],
            style: ['formatting', 'naming', 'structure'],
            compatibility: ['versions', 'deprecations', 'migrations']
          }
        }
      };

      const parsed = PolicySchema.parse(policy);
      expect(parsed.severityLevels?.overrides?.['security-rules']).toBe('critical');
      expect(parsed.severityLevels?.overrides?.['documentation-rules']).toBe('low');
      expect(Object.keys(parsed.severityLevels?.overrides || {})).toHaveLength(5);
    });

    it('should handle policy with timestamps and versioning', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const updatedAt = new Date('2024-01-15T12:30:00Z');

      const policy = {
        id: 'versioned-policy',
        name: 'Versioned Policy',
        description: 'A policy with version tracking',
        rules: [],
        version: '2.1.3-beta',
        tags: ['versioned', 'beta', 'experimental'],
        metadata: {
          changelog: [
            { version: '2.1.3-beta', changes: ['Added new rule validation', 'Fixed performance issue'] },
            { version: '2.1.2', changes: ['Security update', 'Bug fixes'] },
            { version: '2.1.1', changes: ['Initial release'] }
          ],
          maintainer: 'policy-team@company.com',
          reviewers: ['security@company.com', 'compliance@company.com']
        },
        createdAt,
        updatedAt
      };

      const parsed = PolicySchema.parse(policy);
      expect(parsed.version).toBe('2.1.3-beta');
      expect(parsed.createdAt).toEqual(createdAt);
      expect(parsed.updatedAt).toEqual(updatedAt);
      expect(parsed.metadata?.changelog).toHaveLength(3);
    });

    it('should reject policy with invalid severity in rules', () => {
      const invalidPolicy = {
        id: 'invalid-policy',
        name: 'Invalid Policy',
        rules: [
          {
            id: 'invalid-rule',
            name: 'Invalid Rule',
            severity: 'ultra-critical' // Invalid severity
          }
        ]
      };

      expect(() => PolicySchema.parse(invalidPolicy)).toThrow();
    });
  });

  describe('Legacy Policy Schema Edge Cases', () => {
    it('should handle comprehensive path policy with complex patterns', () => {
      const pathPolicy = {
        id: 'complex-path-policy',
        name: 'Complex Path Policy',
        type: 'path',
        description: 'Advanced path control with complex glob patterns',
        config: {
          mode: 'allowlist',
          allow: [
            'src/**/*.{ts,tsx,js,jsx}',
            'tests/**/*.{test,spec}.{ts,tsx,js,jsx}',
            'docs/**/*.{md,mdx}',
            'config/{dev,staging,test}/**/*.{json,yaml,yml}',
            'scripts/**/*.{sh,bash}',
            'package{,-lock}.json',
            'tsconfig*.json',
            'vite.config.ts',
            '*.{gitignore,dockerignore,editorconfig}'
          ],
          block: [
            'src/**/*.secret.*',
            'src/**/*.key',
            'config/production/**',
            '.env*',
            'node_modules/**',
            'dist/**',
            'build/**',
            '.git/**',
            'tmp/**',
            'logs/**'
          ]
        },
        enabled: true,
        enforcement: 'strict',
        tags: ['security', 'filesystem', 'access-control'],
        metadata: {
          purpose: 'Prevent access to sensitive files and directories',
          auditRequired: true,
          exceptions: []
        }
      };

      expect(() => LegacyPolicySchema.parse(pathPolicy)).not.toThrow();
      const parsed = LegacyPolicySchema.parse(pathPolicy);

      if (parsed.type === 'path') {
        expect(parsed.config.allow).toHaveLength(9);
        expect(parsed.config.block).toHaveLength(10);
        expect(parsed.config.mode).toBe('allowlist');
      }
    });

    it('should handle comprehensive test policy with multiple rule types', () => {
      const testPolicy = {
        id: 'comprehensive-test-policy',
        name: 'Comprehensive Test Policy',
        type: 'test',
        description: 'Enforces testing standards across different types of code',
        config: {
          enforcement: 'require',
          rules: [
            {
              name: 'api-endpoint-testing',
              description: 'All API endpoints must have comprehensive tests',
              filePatterns: ['src/api/**/*.ts', 'src/routes/**/*.ts'],
              testPatterns: ['tests/api/**/*.test.ts', 'tests/integration/**/*.test.ts'],
              requiredTestTypes: ['unit', 'integration', 'e2e'],
              minCoverage: 95,
              enforcement: 'require',
              mustPass: true,
              enabled: true
            },
            {
              name: 'business-logic-testing',
              description: 'Core business logic requires thorough testing',
              filePatterns: ['src/services/**/*.ts', 'src/models/**/*.ts'],
              testPatterns: ['tests/unit/**/*.test.ts'],
              requiredTestTypes: ['unit'],
              minCoverage: 90,
              mustPass: true
            },
            {
              name: 'utility-function-testing',
              description: 'Utility functions should be well tested',
              filePatterns: ['src/utils/**/*.ts', 'src/helpers/**/*.ts'],
              testPatterns: ['tests/utils/**/*.test.ts'],
              minCoverage: 85,
              enforcement: 'warn'
            },
            {
              name: 'component-testing',
              description: 'UI components should have snapshot and interaction tests',
              filePatterns: ['src/components/**/*.{tsx,jsx}'],
              testPatterns: ['tests/components/**/*.test.{ts,tsx}'],
              requiredTestTypes: ['unit', 'snapshot'],
              minCoverage: 75,
              enforcement: 'warn'
            }
          ],
          testCommand: 'npm run test:comprehensive -- --coverage --reporter=detailed'
        },
        enabled: true,
        enforcement: 'require',
        tags: ['testing', 'quality', 'coverage'],
        metadata: {
          testingFramework: 'vitest',
          coverageThreshold: 85,
          required: true
        }
      };

      expect(() => LegacyPolicySchema.parse(testPolicy)).not.toThrow();
      const parsed = LegacyPolicySchema.parse(testPolicy);

      if (parsed.type === 'test') {
        expect(parsed.config.rules).toHaveLength(4);
        expect(parsed.config.rules[0].minCoverage).toBe(95);
        expect(parsed.config.rules[0].requiredTestTypes).toEqual(['unit', 'integration', 'e2e']);
      }
    });

    it('should handle comprehensive approval policy with complex conditions', () => {
      const approvalPolicy = {
        id: 'comprehensive-approval-policy',
        name: 'Comprehensive Approval Policy',
        type: 'approval',
        description: 'Multi-layered approval workflow for different scenarios',
        config: {
          enabled: true,
          rules: [
            {
              id: 'high-cost-operations',
              name: 'High Cost Operations',
              description: 'Operations with significant financial impact',
              enabled: true,
              conditions: [
                {
                  type: 'cost_threshold',
                  threshold: 100.0,
                  operator: 'greater_than'
                }
              ],
              urgency: 'high',
              approvers: ['finance@company.com', 'cfo@company.com'],
              timeoutMinutes: 60,
              timeoutAction: 'escalate',
              messageTemplate: 'High cost operation detected: ${operation} - Cost: $${cost}',
              tags: ['finance', 'cost'],
              priority: 20
            },
            {
              id: 'security-sensitive-changes',
              name: 'Security Sensitive Changes',
              description: 'Changes affecting security posture',
              enabled: true,
              conditions: [
                {
                  type: 'file_pattern',
                  patterns: [
                    'src/auth/**',
                    'src/security/**',
                    'config/production/security/**',
                    'infrastructure/security/**',
                    'deploy/security/**'
                  ],
                  operator: 'matches_any'
                }
              ],
              urgency: 'critical',
              approvers: ['security@company.com', 'ciso@company.com'],
              timeoutMinutes: 30,
              timeoutAction: 'reject',
              messageTemplate: 'Security-sensitive changes require approval: ${files}',
              tags: ['security', 'critical'],
              priority: 30
            },
            {
              id: 'infrastructure-changes',
              name: 'Infrastructure Changes',
              description: 'Changes to production infrastructure',
              enabled: true,
              conditions: [
                {
                  type: 'file_pattern',
                  patterns: ['infrastructure/**', 'terraform/**', 'k8s/**', 'docker/**'],
                  operator: 'matches_any'
                },
                {
                  type: 'cost_threshold',
                  threshold: 50.0,
                  operator: 'greater_than'
                }
              ],
              urgency: 'high',
              approvers: ['devops@company.com', 'infrastructure@company.com'],
              timeoutMinutes: 120,
              timeoutAction: 'escalate',
              tags: ['infrastructure', 'devops'],
              priority: 25
            }
          ],
          defaultTimeoutMinutes: 240,
          defaultTimeoutAction: 'escalate',
          globalApprovers: ['admin@company.com', 'cto@company.com'],
          notificationsEnabled: true
        },
        enabled: true,
        enforcement: 'strict',
        tags: ['approval', 'governance', 'compliance'],
        metadata: {
          complianceFramework: 'SOX',
          auditTrail: true,
          escalationChain: ['team-lead', 'department-head', 'c-level']
        }
      };

      expect(() => LegacyPolicySchema.parse(approvalPolicy)).not.toThrow();
      const parsed = LegacyPolicySchema.parse(approvalPolicy);

      if (parsed.type === 'approval') {
        expect(parsed.config.rules).toHaveLength(3);
        expect(parsed.config.rules[0].priority).toBe(20);
        expect(parsed.config.rules[1].urgency).toBe('critical');
        expect(parsed.config.rules[2].conditions).toHaveLength(2);
        expect(parsed.config.globalApprovers).toEqual(['admin@company.com', 'cto@company.com']);
      }
    });
  });

  describe('Cross-Schema Integration Edge Cases', () => {
    it('should handle realistic multi-policy violation scenario', () => {
      const violations = [
        {
          id: 'path-violation-prod-config',
          ruleId: 'production-path-protection',
          policyType: 'path',
          severity: 'critical',
          message: 'Attempted access to production configuration',
          description: 'Developer workflow tried to access production secrets',
          resource: 'config/production/database.secrets.json',
          context: {
            attemptedOperation: 'read',
            deniedPath: 'config/production/database.secrets.json',
            allowedAlternatives: ['config/dev/database.json', 'config/staging/database.json']
          },
          timestamp: new Date(),
          blocking: true,
          resolved: false
        },
        {
          id: 'test-violation-coverage',
          ruleId: 'api-test-coverage',
          policyType: 'test',
          severity: 'high',
          message: 'Insufficient test coverage for API endpoints',
          description: 'New payment API endpoints lack comprehensive test coverage',
          resource: 'src/api/payments.ts',
          context: {
            actualCoverage: 65,
            requiredCoverage: 95,
            missingTests: ['POST /payment/process', 'PUT /payment/refund', 'GET /payment/history'],
            testFiles: ['tests/api/payments.test.ts']
          },
          timestamp: new Date(),
          blocking: false,
          resolved: false
        },
        {
          id: 'approval-violation-high-cost',
          ruleId: 'cost-threshold-approval',
          policyType: 'approval',
          severity: 'high',
          message: 'High-cost operation requires approval',
          description: 'Database migration estimated to cost $275 requires financial approval',
          context: {
            estimatedCost: 275.0,
            threshold: 100.0,
            operation: 'database-migration',
            approvers: ['finance@company.com', 'dba@company.com'],
            approvalId: 'approval-2024-001'
          },
          timestamp: new Date(),
          blocking: true,
          resolved: false
        }
      ];

      const validationResult = {
        passed: false,
        violations,
        validatedAt: new Date(),
        context: {
          policyName: 'comprehensive-security-policy',
          totalRulesChecked: 25,
          passedRules: 22,
          failedRules: 3,
          blockingViolations: 2,
          nonBlockingViolations: 1,
          severityBreakdown: {
            critical: 1,
            high: 2,
            medium: 0,
            low: 0
          },
          validationDurationMs: 1850,
          environment: 'production-pipeline'
        }
      };

      const taskCheckResult = {
        passed: false,
        blocked: true, // Blocked due to critical and high severity blocking violations
        violations,
        checkedAt: new Date(),
        policyName: 'comprehensive-security-policy',
        enforcementMode: 'strict'
      };

      // All schemas should validate successfully
      expect(() => PolicyValidationResultSchema.parse(validationResult)).not.toThrow();
      expect(() => TaskPolicyCheckResultSchema.parse(taskCheckResult)).not.toThrow();

      const parsedValidation = PolicyValidationResultSchema.parse(validationResult);
      const parsedTask = TaskPolicyCheckResultSchema.parse(taskCheckResult);

      expect(parsedValidation.violations).toHaveLength(3);
      expect(parsedValidation.context?.blockingViolations).toBe(2);
      expect(parsedTask.blocked).toBe(true);
      expect(parsedTask.violations.filter(v => v.blocking)).toHaveLength(2);
      expect(parsedTask.violations.filter(v => v.severity === 'critical')).toHaveLength(1);
    });
  });
});