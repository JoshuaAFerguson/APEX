import { describe, it, expect } from 'vitest';
import {
  PolicyValidationResultSchema,
  PolicyValidationResult,
  PolicyViolationSchema,
  PolicyViolation,
  PolicySeveritySchema,
  PolicySeverity,
  TaskPolicyCheckResultSchema,
  TaskPolicyCheckResult,
  PolicyEnforcementModeSchema,
  type PolicyEnforcementMode,
} from '../types';

describe('PolicyValidationResult Schema Tests', () => {
  describe('PolicyValidationResultSchema', () => {
    it('should accept minimal valid policy validation result', () => {
      const result = {
        passed: true,
        violations: []
      };
      const parsed = PolicyValidationResultSchema.parse(result);
      expect(parsed.passed).toBe(true);
      expect(parsed.violations).toEqual([]);
      expect(parsed.validatedAt).toBeUndefined();
      expect(parsed.context).toBeUndefined();
    });

    it('should accept comprehensive policy validation result', () => {
      const validatedAt = new Date();
      const violation: PolicyViolation = {
        id: 'violation-1',
        ruleId: 'test-rule',
        policyType: 'test',
        severity: 'low',
        message: 'Test coverage below threshold',
        description: 'Unit test coverage is 65%, below required 80%',
        resource: 'src/service.ts',
        context: {
          actualCoverage: 65,
          requiredCoverage: 80
        },
        timestamp: new Date(),
        blocking: false
      };

      const result = {
        passed: false,
        violations: [violation],
        validatedAt,
        context: {
          policyName: 'test-policy',
          validationMode: 'strict',
          totalRules: 5,
          passedRules: 4,
          failedRules: 1
        }
      };

      const parsed = PolicyValidationResultSchema.parse(result);
      expect(parsed.passed).toBe(false);
      expect(parsed.violations).toHaveLength(1);
      expect(parsed.violations[0].id).toBe('violation-1');
      expect(parsed.validatedAt).toEqual(validatedAt);
      expect(parsed.context?.policyName).toBe('test-policy');
      expect(parsed.context?.totalRules).toBe(5);
    });

    it('should accept result with multiple violations of different types', () => {
      const violations: PolicyViolation[] = [
        {
          id: 'path-violation',
          ruleId: 'path-rule',
          policyType: 'path',
          severity: 'high',
          message: 'Unauthorized path access',
          timestamp: new Date(),
          blocking: true
        },
        {
          id: 'test-violation',
          ruleId: 'test-rule',
          policyType: 'test',
          severity: 'medium',
          message: 'Test failure',
          timestamp: new Date(),
          blocking: false
        },
        {
          id: 'approval-violation',
          ruleId: 'approval-rule',
          policyType: 'approval',
          severity: 'critical',
          message: 'Approval required',
          timestamp: new Date(),
          blocking: true
        }
      ];

      const result = {
        passed: false,
        violations,
        validatedAt: new Date(),
        context: {
          totalViolations: 3,
          blockingViolations: 2,
          nonBlockingViolations: 1
        }
      };

      const parsed = PolicyValidationResultSchema.parse(result);
      expect(parsed.passed).toBe(false);
      expect(parsed.violations).toHaveLength(3);
      expect(parsed.violations[0].policyType).toBe('path');
      expect(parsed.violations[1].policyType).toBe('test');
      expect(parsed.violations[2].policyType).toBe('approval');
      expect(parsed.context?.blockingViolations).toBe(2);
    });

    it('should reject result without required fields', () => {
      expect(() => PolicyValidationResultSchema.parse({
        violations: []
      })).toThrow(); // missing 'passed' field

      expect(() => PolicyValidationResultSchema.parse({
        passed: true
      })).toThrow(); // missing 'violations' field
    });

    it('should reject result with invalid violations array', () => {
      expect(() => PolicyValidationResultSchema.parse({
        passed: false,
        violations: [
          {
            id: 'invalid-violation',
            ruleId: 'rule-1',
            policyType: 'invalid-type', // invalid policy type
            severity: 'low',
            message: 'Test',
            timestamp: new Date(),
            blocking: false
          }
        ]
      })).toThrow();

      expect(() => PolicyValidationResultSchema.parse({
        passed: false,
        violations: [
          {
            id: 'invalid-violation',
            ruleId: 'rule-1',
            policyType: 'path',
            severity: 'invalid-severity', // invalid severity
            message: 'Test',
            timestamp: new Date(),
            blocking: false
          }
        ]
      })).toThrow();
    });

    it('should handle complex context data', () => {
      const result = {
        passed: true,
        violations: [],
        context: {
          nested: {
            deeply: {
              nested: {
                value: 'test'
              }
            }
          },
          array: [1, 2, { nested: 'value' }],
          boolean: true,
          number: 42.5,
          null_value: null,
          performance: {
            validationTimeMs: 125,
            rulesEvaluated: 15,
            cacheHits: 8
          },
          metadata: {
            version: '1.0.0',
            environment: 'production'
          }
        }
      };

      const parsed = PolicyValidationResultSchema.parse(result);
      expect(parsed.context?.performance?.validationTimeMs).toBe(125);
      expect(parsed.context?.metadata?.environment).toBe('production');
    });

    it('should work with empty violations array when passed is true', () => {
      const result = {
        passed: true,
        violations: []
      };

      const parsed = PolicyValidationResultSchema.parse(result);
      expect(parsed.passed).toBe(true);
      expect(parsed.violations).toHaveLength(0);
    });

    it('should work with empty violations array when passed is false (edge case)', () => {
      // This might represent a case where validation failed for other reasons
      const result = {
        passed: false,
        violations: [],
        context: {
          reason: 'Validation timeout',
          error: 'Unable to complete policy evaluation'
        }
      };

      const parsed = PolicyValidationResultSchema.parse(result);
      expect(parsed.passed).toBe(false);
      expect(parsed.violations).toHaveLength(0);
      expect(parsed.context?.reason).toBe('Validation timeout');
    });
  });

  describe('PolicySeveritySchema', () => {
    it('should accept all valid severity levels', () => {
      const validSeverities: PolicySeverity[] = ['low', 'medium', 'high', 'critical'];

      validSeverities.forEach(severity => {
        expect(() => PolicySeveritySchema.parse(severity)).not.toThrow();
        const result = PolicySeveritySchema.parse(severity);
        expect(result).toBe(severity);
      });
    });

    it('should reject invalid severity levels', () => {
      const invalidSeverities = ['info', 'warning', 'error', 'debug', 'trace', '', null, undefined];

      invalidSeverities.forEach(severity => {
        expect(() => PolicySeveritySchema.parse(severity)).toThrow();
      });
    });

    it('should be case-sensitive', () => {
      expect(() => PolicySeveritySchema.parse('LOW')).toThrow();
      expect(() => PolicySeveritySchema.parse('Medium')).toThrow();
      expect(() => PolicySeveritySchema.parse('HIGH')).toThrow();
      expect(() => PolicySeveritySchema.parse('CRITICAL')).toThrow();
    });
  });

  describe('TaskPolicyCheckResultSchema', () => {
    it('should accept minimal valid task policy check result', () => {
      const result = {
        passed: true,
        blocked: false,
        violations: [],
        checkedAt: new Date()
      };

      const parsed = TaskPolicyCheckResultSchema.parse(result);
      expect(parsed.passed).toBe(true);
      expect(parsed.blocked).toBe(false);
      expect(parsed.violations).toEqual([]);
      expect(parsed.checkedAt).toBeInstanceOf(Date);
      expect(parsed.policyName).toBeUndefined();
      expect(parsed.enforcementMode).toBeUndefined();
    });

    it('should accept comprehensive task policy check result', () => {
      const checkedAt = new Date();
      const violations: PolicyViolation[] = [
        {
          id: 'task-violation-1',
          ruleId: 'task-rule-1',
          policyType: 'path',
          severity: 'high',
          message: 'Blocked path access in task',
          resource: 'src/restricted/file.ts',
          timestamp: new Date(),
          blocking: true
        },
        {
          id: 'task-violation-2',
          ruleId: 'task-rule-2',
          policyType: 'test',
          severity: 'medium',
          message: 'Test requirements not met',
          timestamp: new Date(),
          blocking: false
        }
      ];

      const result = {
        passed: false,
        blocked: true,
        violations,
        checkedAt,
        policyName: 'task-execution-policy',
        enforcementMode: 'strict' as PolicyEnforcementMode
      };

      const parsed = TaskPolicyCheckResultSchema.parse(result);
      expect(parsed.passed).toBe(false);
      expect(parsed.blocked).toBe(true);
      expect(parsed.violations).toHaveLength(2);
      expect(parsed.checkedAt).toEqual(checkedAt);
      expect(parsed.policyName).toBe('task-execution-policy');
      expect(parsed.enforcementMode).toBe('strict');
    });

    it('should reject result without required fields', () => {
      expect(() => TaskPolicyCheckResultSchema.parse({
        blocked: false,
        violations: [],
        checkedAt: new Date()
      })).toThrow(); // missing 'passed'

      expect(() => TaskPolicyCheckResultSchema.parse({
        passed: true,
        violations: [],
        checkedAt: new Date()
      })).toThrow(); // missing 'blocked'

      expect(() => TaskPolicyCheckResultSchema.parse({
        passed: true,
        blocked: false,
        checkedAt: new Date()
      })).toThrow(); // missing 'violations'

      expect(() => TaskPolicyCheckResultSchema.parse({
        passed: true,
        blocked: false,
        violations: []
      })).toThrow(); // missing 'checkedAt'
    });

    it('should validate enforcement mode values', () => {
      const baseResult = {
        passed: true,
        blocked: false,
        violations: [],
        checkedAt: new Date()
      };

      const validModes: PolicyEnforcementMode[] = ['strict', 'warn', 'audit', 'disabled'];
      validModes.forEach(mode => {
        const result = { ...baseResult, enforcementMode: mode };
        expect(() => TaskPolicyCheckResultSchema.parse(result)).not.toThrow();
        const parsed = TaskPolicyCheckResultSchema.parse(result);
        expect(parsed.enforcementMode).toBe(mode);
      });

      // Test invalid enforcement mode
      expect(() => TaskPolicyCheckResultSchema.parse({
        ...baseResult,
        enforcementMode: 'invalid-mode'
      })).toThrow();
    });

    it('should handle various blocking and passing combinations', () => {
      const baseResult = {
        violations: [],
        checkedAt: new Date(),
        policyName: 'test-policy'
      };

      // Passed and not blocked
      const result1 = { ...baseResult, passed: true, blocked: false };
      expect(() => TaskPolicyCheckResultSchema.parse(result1)).not.toThrow();

      // Passed but blocked (edge case - maybe warning violations exist but don't fail)
      const result2 = { ...baseResult, passed: true, blocked: true };
      expect(() => TaskPolicyCheckResultSchema.parse(result2)).not.toThrow();

      // Not passed and blocked
      const result3 = { ...baseResult, passed: false, blocked: true };
      expect(() => TaskPolicyCheckResultSchema.parse(result3)).not.toThrow();

      // Not passed but not blocked (warnings only)
      const result4 = { ...baseResult, passed: false, blocked: false };
      expect(() => TaskPolicyCheckResultSchema.parse(result4)).not.toThrow();
    });

    it('should validate nested violations correctly', () => {
      const invalidViolation = {
        id: 'task-violation',
        ruleId: 'rule-1',
        policyType: 'invalid-type', // invalid
        severity: 'high',
        message: 'Test',
        timestamp: new Date(),
        blocking: false
      };

      expect(() => TaskPolicyCheckResultSchema.parse({
        passed: false,
        blocked: true,
        violations: [invalidViolation],
        checkedAt: new Date()
      })).toThrow();
    });

    it('should handle realistic task policy scenarios', () => {
      // Scenario 1: Task with path violations
      const pathViolationScenario = {
        passed: false,
        blocked: true,
        violations: [
          {
            id: 'path-violation-task-123',
            ruleId: 'restricted-paths',
            policyType: 'path' as const,
            severity: 'critical' as const,
            message: 'Attempted to access restricted configuration files',
            description: 'Task tried to read from production config directory',
            resource: 'config/production/secrets.yaml',
            context: {
              taskId: 'task-123',
              attemptedOperation: 'read',
              deniedPath: 'config/production/secrets.yaml'
            },
            timestamp: new Date(),
            blocking: true
          }
        ],
        checkedAt: new Date(),
        policyName: 'production-security-policy',
        enforcementMode: 'strict' as PolicyEnforcementMode
      };

      const parsed1 = TaskPolicyCheckResultSchema.parse(pathViolationScenario);
      expect(parsed1.violations[0].policyType).toBe('path');
      expect(parsed1.blocked).toBe(true);

      // Scenario 2: Task with test requirement warnings
      const testWarningScenario = {
        passed: false,
        blocked: false, // warnings don't block
        violations: [
          {
            id: 'test-warning-task-456',
            ruleId: 'test-coverage',
            policyType: 'test' as const,
            severity: 'medium' as const,
            message: 'Test coverage below recommended threshold',
            description: 'Current coverage is 75%, recommended is 85%',
            resource: 'src/new-feature.ts',
            context: {
              actualCoverage: 75,
              recommendedCoverage: 85,
              testFiles: ['tests/new-feature.test.ts']
            },
            timestamp: new Date(),
            blocking: false
          }
        ],
        checkedAt: new Date(),
        policyName: 'code-quality-policy',
        enforcementMode: 'warn' as PolicyEnforcementMode
      };

      const parsed2 = TaskPolicyCheckResultSchema.parse(testWarningScenario);
      expect(parsed2.violations[0].policyType).toBe('test');
      expect(parsed2.blocked).toBe(false);

      // Scenario 3: Task requiring approval
      const approvalScenario = {
        passed: false,
        blocked: true,
        violations: [
          {
            id: 'approval-required-task-789',
            ruleId: 'high-cost-approval',
            policyType: 'approval' as const,
            severity: 'high' as const,
            message: 'High-cost operation requires approval',
            description: 'Estimated cost $150 exceeds approval threshold of $100',
            context: {
              estimatedCost: 150,
              threshold: 100,
              approvers: ['finance@company.com'],
              approvalId: 'approval-789'
            },
            timestamp: new Date(),
            blocking: true
          }
        ],
        checkedAt: new Date(),
        policyName: 'financial-governance-policy',
        enforcementMode: 'strict' as PolicyEnforcementMode
      };

      const parsed3 = TaskPolicyCheckResultSchema.parse(approvalScenario);
      expect(parsed3.violations[0].policyType).toBe('approval');
      expect(parsed3.violations[0].context?.estimatedCost).toBe(150);
    });
  });

  describe('Integration Tests', () => {
    it('should work together in realistic policy validation workflow', () => {
      // Simulate a complete policy validation workflow
      const violations: PolicyViolation[] = [
        {
          id: 'integration-violation-1',
          ruleId: 'path-security-rule',
          policyType: 'path',
          severity: 'critical',
          message: 'Security violation detected',
          timestamp: new Date(),
          blocking: true
        },
        {
          id: 'integration-violation-2',
          ruleId: 'test-quality-rule',
          policyType: 'test',
          severity: 'medium',
          message: 'Quality threshold not met',
          timestamp: new Date(),
          blocking: false
        }
      ];

      // Policy validation result
      const validationResult: PolicyValidationResult = {
        passed: false,
        violations,
        validatedAt: new Date(),
        context: {
          totalRulesChecked: 10,
          passedRules: 8,
          failedRules: 2,
          validationDurationMs: 250
        }
      };

      // Task policy check result
      const taskCheckResult: TaskPolicyCheckResult = {
        passed: false,
        blocked: true, // blocked due to critical severity violation
        violations,
        checkedAt: new Date(),
        policyName: 'comprehensive-policy',
        enforcementMode: 'strict'
      };

      // Validate both results
      const parsedValidation = PolicyValidationResultSchema.parse(validationResult);
      const parsedTaskCheck = TaskPolicyCheckResultSchema.parse(taskCheckResult);

      expect(parsedValidation.passed).toBe(false);
      expect(parsedValidation.violations).toHaveLength(2);
      expect(parsedTaskCheck.blocked).toBe(true);
      expect(parsedTaskCheck.violations).toHaveLength(2);

      // Verify violation data integrity across both schemas
      expect(parsedValidation.violations[0].id).toBe(parsedTaskCheck.violations[0].id);
      expect(parsedValidation.violations[1].id).toBe(parsedTaskCheck.violations[1].id);
    });

    it('should maintain type safety across related schemas', () => {
      // Test that TypeScript types work correctly
      const violation: PolicyViolation = {
        id: 'type-safety-test',
        ruleId: 'test-rule',
        policyType: 'test',
        severity: 'low',
        message: 'Test message',
        timestamp: new Date(),
        blocking: false
      };

      const validationResult: PolicyValidationResult = {
        passed: true,
        violations: [violation]
      };

      const taskResult: TaskPolicyCheckResult = {
        passed: true,
        blocked: false,
        violations: [violation],
        checkedAt: new Date()
      };

      // Type assertions to verify TypeScript integration
      expect(typeof validationResult.passed).toBe('boolean');
      expect(Array.isArray(validationResult.violations)).toBe(true);
      expect(typeof taskResult.blocked).toBe('boolean');
      expect(taskResult.checkedAt).toBeInstanceOf(Date);
    });
  });
});