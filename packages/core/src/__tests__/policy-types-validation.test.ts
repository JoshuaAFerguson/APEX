import { describe, it, expect } from 'vitest';
import {
  PolicyValidationResultSchema,
  PolicySeveritySchema,
  TaskPolicyCheckResultSchema,
  PolicySchema,
  LegacyPolicySchema,
  PolicyRuleSchema,
  PolicyEnforcementModeSchema,
} from '../types';

describe('Policy Types Validation Test', () => {
  it('should successfully validate all policy-related schemas exist and work', () => {
    // Test PolicySeveritySchema
    expect(() => PolicySeveritySchema.parse('low')).not.toThrow();
    expect(() => PolicySeveritySchema.parse('medium')).not.toThrow();
    expect(() => PolicySeveritySchema.parse('high')).not.toThrow();
    expect(() => PolicySeveritySchema.parse('critical')).not.toThrow();
    expect(() => PolicySeveritySchema.parse('invalid')).toThrow();

    // Test PolicyEnforcementModeSchema
    expect(() => PolicyEnforcementModeSchema.parse('strict')).not.toThrow();
    expect(() => PolicyEnforcementModeSchema.parse('warn')).not.toThrow();
    expect(() => PolicyEnforcementModeSchema.parse('audit')).not.toThrow();
    expect(() => PolicyEnforcementModeSchema.parse('disabled')).not.toThrow();
    expect(() => PolicyEnforcementModeSchema.parse('invalid')).toThrow();

    // Test PolicyRuleSchema
    const validRule = {
      id: 'test-rule',
      name: 'Test Rule',
      severity: 'medium'
    };
    expect(() => PolicyRuleSchema.parse(validRule)).not.toThrow();

    // Test PolicyValidationResultSchema
    const validationResult = {
      passed: true,
      violations: []
    };
    expect(() => PolicyValidationResultSchema.parse(validationResult)).not.toThrow();

    // Test TaskPolicyCheckResultSchema
    const taskResult = {
      passed: true,
      blocked: false,
      violations: [],
      checkedAt: new Date()
    };
    expect(() => TaskPolicyCheckResultSchema.parse(taskResult)).not.toThrow();

    // Test PolicySchema
    const policy = {
      id: 'test-policy',
      name: 'Test Policy',
      rules: []
    };
    expect(() => PolicySchema.parse(policy)).not.toThrow();

    // Test LegacyPolicySchema - Path Policy
    const pathPolicy = {
      id: 'path-policy',
      name: 'Path Policy',
      type: 'path',
      config: {
        mode: 'allowlist',
        allow: ['src/**'],
        block: []
      }
    };
    expect(() => LegacyPolicySchema.parse(pathPolicy)).not.toThrow();

    // Test LegacyPolicySchema - Test Policy
    const testPolicy = {
      id: 'test-policy',
      name: 'Test Policy',
      type: 'test',
      config: {
        enforcement: 'warn',
        rules: []
      }
    };
    expect(() => LegacyPolicySchema.parse(testPolicy)).not.toThrow();

    // Test LegacyPolicySchema - Approval Policy
    const approvalPolicy = {
      id: 'approval-policy',
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
    };
    expect(() => LegacyPolicySchema.parse(approvalPolicy)).not.toThrow();
  });

  it('should validate real-world policy scenario', () => {
    // Create a complete policy validation scenario
    const policyViolation = {
      id: 'real-world-violation',
      ruleId: 'security-rule',
      policyType: 'path',
      severity: 'high',
      message: 'Unauthorized access attempt',
      resource: 'config/secrets.env',
      timestamp: new Date(),
      blocking: true
    };

    const validationResult = {
      passed: false,
      violations: [policyViolation],
      validatedAt: new Date(),
      context: {
        policyName: 'security-policy',
        environment: 'production'
      }
    };

    const taskCheckResult = {
      passed: false,
      blocked: true,
      violations: [policyViolation],
      checkedAt: new Date(),
      policyName: 'security-policy',
      enforcementMode: 'strict'
    };

    // All should validate successfully
    expect(() => PolicyValidationResultSchema.parse(validationResult)).not.toThrow();
    expect(() => TaskPolicyCheckResultSchema.parse(taskCheckResult)).not.toThrow();

    const parsedValidation = PolicyValidationResultSchema.parse(validationResult);
    const parsedTask = TaskPolicyCheckResultSchema.parse(taskCheckResult);

    expect(parsedValidation.passed).toBe(false);
    expect(parsedValidation.violations).toHaveLength(1);
    expect(parsedTask.blocked).toBe(true);
    expect(parsedTask.enforcementMode).toBe('strict');
  });
});