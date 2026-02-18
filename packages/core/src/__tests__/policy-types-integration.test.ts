import { describe, it, expect } from 'vitest';
import {
  PolicyRuleSchema,
  PathPolicySchema,
  TestPolicySchema,
  ApprovalPolicySchema,
  PolicySchema,
  PolicyViolationSchema,
  PolicyViolationEventSchema,
  PolicyConfigSchema,
  AllowedPathsConfigSchema,
  RequiredTestsConfigSchema,
  ApprovalRulesConfigSchema,
  type Policy,
  type PolicyViolation,
  type PolicyViolationEvent,
  type PolicyConfig,
} from '../types';

describe('Policy Types Integration', () => {
  describe('PolicyConfig Integration', () => {
    it('should integrate new policy types with existing PolicyConfig', () => {
      // Test that PolicyConfig can reference the new domain types
      const config: PolicyConfig = {
        version: '2.0',
        name: 'Integrated Policy Configuration',
        description: 'Uses new domain policy types',
        enforcement: 'strict',
        enabled: true,
        tags: ['integration', 'domain-types'],
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'tests/**'],
          block: ['secrets/**']
        },
        requiredTests: {
          enforcement: 'require',
          rules: [
            {
              name: 'unit-tests',
              filePatterns: ['src/**/*.ts'],
              testPatterns: ['tests/**/*.test.ts'],
              minCoverage: 80
            }
          ]
        },
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'cost-control',
              name: 'Cost Control',
              conditions: [
                {
                  type: 'cost_threshold',
                  threshold: 10.0,
                  operator: 'greater_than'
                }
              ]
            }
          ],
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject',
          globalApprovers: ['admin@company.com'],
          notificationsEnabled: true
        }
      };

      const result = PolicyConfigSchema.parse(config);
      expect(result.name).toBe('Integrated Policy Configuration');
      expect(result.allowedPaths?.mode).toBe('allowlist');
      expect(result.requiredTests?.rules).toHaveLength(1);
      expect(result.approvalRules?.rules).toHaveLength(1);
    });

    it('should work with existing PolicyConfig structure and new domain types', () => {
      // Simulate a realistic policy configuration that might be used in production
      const productionConfig = {
        version: '1.0',
        name: 'Production Security Policy v2.0',
        description: 'Enhanced security policy using domain-specific policy types',
        enforcement: 'strict',
        allowedPaths: AllowedPathsConfigSchema.parse({
          mode: 'allowlist',
          allow: [
            'src/**/*.{ts,tsx,js,jsx}',
            'tests/**/*.{test,spec}.{ts,js}',
            'docs/**/*.md',
            'config/{dev,staging}/**',
            'package.json',
            '*.{yml,yaml,json}',
            'README.md'
          ],
          block: [
            'src/**/*.secret.*',
            'config/production/**',
            '.env*',
            'node_modules/**',
            '.git/**',
            'tmp/**',
            'dist/**'
          ]
        }),
        requiredTests: RequiredTestsConfigSchema.parse({
          enforcement: 'require',
          rules: [
            {
              name: 'api-endpoints',
              description: 'All API endpoints must have comprehensive tests',
              filePatterns: ['src/api/**/*.ts', 'src/routes/**/*.ts'],
              testPatterns: ['tests/api/**/*.test.ts', 'tests/integration/**/*.test.ts'],
              requiredTestTypes: ['unit', 'integration'],
              minCoverage: 90,
              enforcement: 'require',
              mustPass: true,
              enabled: true
            },
            {
              name: 'business-logic',
              description: 'Business logic requires high test coverage',
              filePatterns: ['src/services/**/*.ts', 'src/utils/**/*.ts'],
              testPatterns: ['tests/unit/**/*.test.ts'],
              requiredTestTypes: ['unit'],
              minCoverage: 85,
              mustPass: true
            },
            {
              name: 'ui-components',
              description: 'UI components should have snapshot and interaction tests',
              filePatterns: ['src/components/**/*.{tsx,jsx}'],
              testPatterns: ['tests/components/**/*.{test,spec}.{ts,tsx}'],
              requiredTestTypes: ['unit', 'snapshot'],
              minCoverage: 75,
              enforcement: 'warn'
            }
          ],
          testCommand: 'npm run test:ci'
        }),
        approvalRules: ApprovalRulesConfigSchema.parse({
          enabled: true,
          rules: [
            {
              id: 'high-cost-operations',
              name: 'High Cost Operations Approval',
              description: 'Operations exceeding cost threshold require approval',
              enabled: true,
              conditions: [
                {
                  type: 'cost_threshold',
                  threshold: 25.0,
                  operator: 'greater_than'
                }
              ],
              urgency: 'high',
              approvers: ['finance@company.com', 'team-lead@company.com'],
              timeoutMinutes: 60,
              timeoutAction: 'escalate',
              messageTemplate: 'High cost operation detected: ${operation} (Cost: $${cost})',
              tags: ['cost', 'finance'],
              priority: 10
            },
            {
              id: 'production-file-changes',
              name: 'Production File Changes',
              description: 'Any changes to production configuration require security approval',
              enabled: true,
              conditions: [
                {
                  type: 'file_pattern',
                  patterns: [
                    'config/production/**',
                    'deploy/production/**',
                    'infrastructure/prod/**',
                    '**/prod.{yml,yaml,json}',
                    'Dockerfile.prod'
                  ],
                  operator: 'matches_any'
                }
              ],
              urgency: 'critical',
              approvers: ['security@company.com', 'devops@company.com'],
              timeoutMinutes: 30,
              timeoutAction: 'reject',
              messageTemplate: 'Production configuration change requires approval: ${files}',
              tags: ['security', 'production', 'infrastructure'],
              priority: 20
            },
            {
              id: 'database-migrations',
              name: 'Database Migrations',
              description: 'Database migrations require DBA approval',
              enabled: true,
              conditions: [
                {
                  type: 'file_pattern',
                  patterns: ['migrations/**', 'db/**/*.sql', 'schema/**'],
                  operator: 'matches_any'
                }
              ],
              urgency: 'high',
              approvers: ['dba@company.com'],
              timeoutMinutes: 120,
              timeoutAction: 'escalate',
              tags: ['database', 'migrations']
            }
          ],
          defaultTimeoutMinutes: 240,
          defaultTimeoutAction: 'escalate',
          globalApprovers: ['admin@company.com', 'cto@company.com'],
          notificationsEnabled: true
        }),
        enabled: true,
        tags: ['production', 'security', 'enhanced'],
        metadata: {
          version: '2.0.0',
          createdBy: 'security-team',
          lastUpdated: '2024-01-15T10:00:00Z',
          complianceFramework: 'SOX',
          auditRequired: true
        }
      };

      const result = PolicyConfigSchema.parse(productionConfig);
      expect(result).toBeDefined();
      expect(result.name).toBe('Production Security Policy v2.0');
      expect(result.allowedPaths?.allow).toHaveLength(7);
      expect(result.requiredTests?.rules).toHaveLength(3);
      expect(result.approvalRules?.rules).toHaveLength(3);
    });
  });

  describe('Domain Policy Workflow Integration', () => {
    it('should support end-to-end policy workflow scenarios', () => {
      // Scenario 1: Create individual domain policies
      const securityPathPolicy: Policy = {
        id: 'security-paths-v2',
        name: 'Security Paths Policy v2',
        description: 'Controls access to security-sensitive files and directories',
        type: 'path',
        enabled: true,
        enforcement: 'strict',
        tags: ['security', 'filesystem', 'access-control'],
        config: {
          mode: 'allowlist',
          allow: [
            'src/public/**',
            'docs/public/**',
            'assets/images/**',
            'config/{dev,test}/**'
          ],
          block: [
            'src/auth/secrets/**',
            'config/production/**',
            '.env*',
            'private/**',
            'credentials/**'
          ]
        },
        metadata: {
          owner: 'security-team',
          compliance: 'required',
          lastReview: '2024-01-01'
        }
      };

      const qualityTestPolicy: Policy = {
        id: 'quality-assurance-v2',
        name: 'Quality Assurance Testing Policy v2',
        description: 'Enforces comprehensive testing requirements for code quality',
        type: 'test',
        enabled: true,
        enforcement: 'require',
        tags: ['quality', 'testing', 'coverage'],
        config: {
          enforcement: 'require',
          rules: [
            {
              name: 'critical-path-testing',
              description: 'Critical business logic must have 95% coverage',
              filePatterns: ['src/critical/**/*.ts', 'src/payment/**/*.ts'],
              testPatterns: ['tests/critical/**/*.test.ts', 'tests/payment/**/*.test.ts'],
              requiredTestTypes: ['unit', 'integration', 'e2e'],
              minCoverage: 95,
              enforcement: 'require',
              mustPass: true,
              enabled: true
            },
            {
              name: 'api-testing',
              description: 'API endpoints require comprehensive testing',
              filePatterns: ['src/api/**/*.ts'],
              testPatterns: ['tests/api/**/*.test.ts'],
              requiredTestTypes: ['unit', 'integration'],
              minCoverage: 90,
              mustPass: true
            }
          ],
          testCommand: 'npm run test:comprehensive'
        },
        metadata: {
          owner: 'qa-team',
          priority: 'high'
        }
      };

      const governanceApprovalPolicy: Policy = {
        id: 'governance-approval-v2',
        name: 'Governance Approval Policy v2',
        description: 'Implements approval workflows for governance and compliance',
        type: 'approval',
        enabled: true,
        enforcement: 'strict',
        tags: ['governance', 'approval', 'compliance'],
        config: {
          enabled: true,
          rules: [
            {
              id: 'budget-threshold',
              name: 'Budget Threshold Approval',
              description: 'Operations exceeding budget require financial approval',
              enabled: true,
              conditions: [
                {
                  type: 'cost_threshold',
                  threshold: 100.0,
                  operator: 'greater_than'
                }
              ],
              urgency: 'high',
              approvers: ['finance@company.com', 'budget-owner@company.com'],
              timeoutMinutes: 120,
              timeoutAction: 'escalate',
              priority: 10
            },
            {
              id: 'architectural-changes',
              name: 'Architectural Changes Approval',
              description: 'Significant architectural changes require architect approval',
              enabled: true,
              conditions: [
                {
                  type: 'file_pattern',
                  patterns: [
                    'src/core/architecture/**',
                    'src/infrastructure/**',
                    'architecture/**',
                    'docs/architecture/**'
                  ],
                  operator: 'matches_any'
                }
              ],
              urgency: 'normal',
              approvers: ['architect@company.com', 'senior-dev@company.com'],
              timeoutMinutes: 480,
              timeoutAction: 'escalate'
            }
          ],
          defaultTimeoutMinutes: 360,
          defaultTimeoutAction: 'escalate',
          globalApprovers: ['admin@company.com'],
          notificationsEnabled: true
        },
        metadata: {
          owner: 'governance-team',
          compliance: 'SOX'
        }
      };

      // Validate all policies
      expect(() => PolicySchema.parse(securityPathPolicy)).not.toThrow();
      expect(() => PolicySchema.parse(qualityTestPolicy)).not.toThrow();
      expect(() => PolicySchema.parse(governanceApprovalPolicy)).not.toThrow();

      // Scenario 2: Policy violations and events
      const testFailureViolation: PolicyViolation = {
        id: 'test-failure-2024-001',
        ruleId: qualityTestPolicy.id,
        policyType: 'test',
        severity: 'error',
        message: 'Critical path testing requirements not met',
        description: 'Payment processing module has insufficient test coverage (85% actual vs 95% required)',
        resource: 'src/payment/processor.ts',
        context: {
          actualCoverage: 85,
          requiredCoverage: 95,
          missingTests: [
            'handlePaymentFailure',
            'validateCardExpiration',
            'processRefund'
          ],
          testSuite: 'payment-processing',
          affectedFiles: ['src/payment/processor.ts', 'src/payment/validator.ts']
        },
        timestamp: new Date(),
        resolved: false
      };

      const approvalRequiredViolation: PolicyViolation = {
        id: 'approval-required-2024-002',
        ruleId: governanceApprovalPolicy.id,
        policyType: 'approval',
        severity: 'warning',
        message: 'High-cost operation requires approval',
        description: 'Database migration with estimated cost of $150 requires financial approval',
        resource: 'deploy/migrations/2024-01-15-large-migration.sql',
        context: {
          estimatedCost: 150.0,
          costBreakdown: {
            compute: 75.0,
            storage: 50.0,
            network: 25.0
          },
          operation: 'database-migration',
          affectedTables: ['users', 'orders', 'payments']
        },
        timestamp: new Date(),
        resolved: false
      };

      const pathViolationEvent: PolicyViolationEvent = {
        type: 'policy_violation',
        id: 'path-violation-event-001',
        timestamp: new Date(),
        violation: {
          id: 'path-violation-2024-003',
          ruleId: securityPathPolicy.id,
          policyType: 'path',
          severity: 'error',
          message: 'Unauthorized access to restricted path',
          description: 'Attempt to access production configuration files from development workflow',
          resource: 'config/production/secrets.yml',
          context: {
            attemptedPath: 'config/production/secrets.yml',
            allowedPaths: securityPathPolicy.config.allow,
            blockedPaths: securityPathPolicy.config.block,
            accessMode: 'read'
          },
          timestamp: new Date(),
          resolved: false
        },
        taskId: 'task-dev-workflow-123',
        agentId: 'developer-agent-v1',
        workflowId: 'development-ci-pipeline',
        metadata: {
          environment: 'development',
          triggeredBy: 'automated-workflow',
          severity: 'high',
          requiresImmediateAction: true
        }
      };

      // Validate violations and events
      expect(() => PolicyViolationSchema.parse(testFailureViolation)).not.toThrow();
      expect(() => PolicyViolationSchema.parse(approvalRequiredViolation)).not.toThrow();
      expect(() => PolicyViolationEventSchema.parse(pathViolationEvent)).not.toThrow();

      // Verify parsed objects maintain their structure
      const parsedTestViolation = PolicyViolationSchema.parse(testFailureViolation);
      const parsedApprovalViolation = PolicyViolationSchema.parse(approvalRequiredViolation);
      const parsedPathEvent = PolicyViolationEventSchema.parse(pathViolationEvent);

      expect(parsedTestViolation.context?.actualCoverage).toBe(85);
      expect(parsedApprovalViolation.context?.estimatedCost).toBe(150.0);
      expect(parsedPathEvent.violation.context?.allowedPaths).toEqual(securityPathPolicy.config.allow);
    });

    it('should support policy collections and bulk operations', () => {
      // Create a collection of policies for an organization
      const organizationPolicies: Policy[] = [
        {
          id: 'org-path-policy',
          name: 'Organization Path Policy',
          type: 'path',
          config: {
            mode: 'allowlist',
            allow: ['src/**', 'docs/**'],
            block: ['secrets/**']
          }
        },
        {
          id: 'org-test-policy',
          name: 'Organization Test Policy',
          type: 'test',
          config: {
            enforcement: 'require',
            rules: [
              {
                name: 'standard-testing',
                filePatterns: ['src/**/*.ts'],
                minCoverage: 80
              }
            ]
          }
        },
        {
          id: 'org-approval-policy',
          name: 'Organization Approval Policy',
          type: 'approval',
          config: {
            enabled: true,
            rules: [
              {
                id: 'standard-approval',
                name: 'Standard Approval',
                conditions: [
                  {
                    type: 'cost_threshold',
                    threshold: 50.0,
                    operator: 'greater_than'
                  }
                ]
              }
            ],
            defaultTimeoutMinutes: 60,
            defaultTimeoutAction: 'reject',
            globalApprovers: [],
            notificationsEnabled: true
          }
        }
      ];

      // Validate all policies in bulk
      const validatedPolicies = organizationPolicies.map(policy => PolicySchema.parse(policy));
      expect(validatedPolicies).toHaveLength(3);

      // Verify type discrimination works for collections
      const pathPolicies = validatedPolicies.filter(p => p.type === 'path');
      const testPolicies = validatedPolicies.filter(p => p.type === 'test');
      const approvalPolicies = validatedPolicies.filter(p => p.type === 'approval');

      expect(pathPolicies).toHaveLength(1);
      expect(testPolicies).toHaveLength(1);
      expect(approvalPolicies).toHaveLength(1);

      // Create violations for multiple policies
      const multiPolicyViolations: PolicyViolation[] = validatedPolicies.map((policy, index) => ({
        id: `bulk-violation-${index}`,
        ruleId: policy.id,
        policyType: policy.type,
        severity: 'warning' as const,
        message: `Violation for ${policy.type} policy`,
        timestamp: new Date()
      }));

      const validatedViolations = multiPolicyViolations.map(v => PolicyViolationSchema.parse(v));
      expect(validatedViolations).toHaveLength(3);

      // Verify violation types match policy types
      validatedViolations.forEach((violation, index) => {
        expect(violation.policyType).toBe(organizationPolicies[index].type);
        expect(violation.ruleId).toBe(organizationPolicies[index].id);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing PolicyConfig structures', () => {
      // Test that new domain types don't break existing configurations
      const legacyStyleConfig = {
        version: '1.0',
        enforcement: 'warn',
        enabled: true,
        tags: []
      };

      const result = PolicyConfigSchema.parse(legacyStyleConfig);
      expect(result.version).toBe('1.0');
      expect(result.enforcement).toBe('warn');
    });

    it('should work with partial policy configurations', () => {
      // Test configurations with only some policy types defined
      const partialConfigs = [
        {
          name: 'Path-only Config',
          allowedPaths: {
            mode: 'allowlist' as const,
            allow: ['src/**'],
            block: []
          }
        },
        {
          name: 'Test-only Config',
          requiredTests: {
            enforcement: 'warn' as const,
            rules: []
          }
        },
        {
          name: 'Approval-only Config',
          approvalRules: {
            enabled: true,
            rules: [],
            defaultTimeoutMinutes: 60,
            defaultTimeoutAction: 'reject' as const,
            globalApprovers: [],
            notificationsEnabled: true
          }
        }
      ];

      partialConfigs.forEach(config => {
        expect(() => PolicyConfigSchema.parse(config)).not.toThrow();
      });
    });
  });

  describe('Performance and Scale', () => {
    it('should handle large policy collections efficiently', () => {
      // Test with a large number of policies
      const largePolicyCollection: Policy[] = Array.from({ length: 100 }, (_, i) => ({
        id: `policy-${i}`,
        name: `Policy ${i}`,
        type: (i % 3 === 0 ? 'path' : i % 3 === 1 ? 'test' : 'approval') as const,
        config: i % 3 === 0
          ? { mode: 'allowlist' as const, allow: [`path${i}/**`], block: [] }
          : i % 3 === 1
            ? { enforcement: 'warn' as const, rules: [] }
            : {
                enabled: true,
                rules: [],
                defaultTimeoutMinutes: 60,
                defaultTimeoutAction: 'reject' as const,
                globalApprovers: [],
                notificationsEnabled: true
              }
      }));

      // Validate all policies
      const startTime = Date.now();
      const validatedPolicies = largePolicyCollection.map(policy => PolicySchema.parse(policy));
      const endTime = Date.now();

      expect(validatedPolicies).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify type distribution
      const pathCount = validatedPolicies.filter(p => p.type === 'path').length;
      const testCount = validatedPolicies.filter(p => p.type === 'test').length;
      const approvalCount = validatedPolicies.filter(p => p.type === 'approval').length;

      expect(pathCount + testCount + approvalCount).toBe(100);
    });

    it('should handle deeply nested policy configurations', () => {
      // Test with complex, deeply nested configurations
      const deepConfig = {
        id: 'deep-config-policy',
        name: 'Deep Configuration Policy',
        type: 'approval' as const,
        config: {
          enabled: true,
          rules: Array.from({ length: 50 }, (_, i) => ({
            id: `rule-${i}`,
            name: `Rule ${i}`,
            conditions: [
              {
                type: 'cost_threshold' as const,
                threshold: i * 10,
                operator: 'greater_than' as const
              },
              {
                type: 'file_pattern' as const,
                patterns: Array.from({ length: 10 }, (_, j) => `pattern${i}-${j}/**`),
                operator: 'matches_any' as const
              }
            ],
            approvers: Array.from({ length: 5 }, (_, k) => `approver${i}-${k}@company.com`)
          })),
          defaultTimeoutMinutes: 60,
          defaultTimeoutAction: 'reject' as const,
          globalApprovers: Array.from({ length: 10 }, (_, i) => `global${i}@company.com`),
          notificationsEnabled: true
        }
      };

      expect(() => PolicySchema.parse(deepConfig)).not.toThrow();
      const result = PolicySchema.parse(deepConfig);
      expect(result.config.rules).toHaveLength(50);
    });
  });
});