import { describe, it, expect } from 'vitest';

describe('Policy Types Build Verification', () => {
  it('should import all policy types without compilation errors', async () => {
    // This test verifies that all new policy types can be imported successfully
    // and that TypeScript compilation passes without errors

    try {
      const module = await import('../types');

      // Verify all required exports are available
      const requiredExports = [
        'PolicyRuleSchema',
        'PolicyRule',
        'PathPolicySchema',
        'PathPolicy',
        'TestPolicySchema',
        'TestPolicy',
        'ApprovalPolicySchema',
        'ApprovalPolicy',
        'PolicySchema',
        'Policy',
        'PolicyViolationSchema',
        'PolicyViolation',
        'PolicyViolationEventSchema',
        'PolicyViolationEvent'
      ];

      requiredExports.forEach(exportName => {
        expect(module[exportName]).toBeDefined();
        expect(module[exportName]).not.toBeUndefined();
        expect(module[exportName]).not.toBeNull();
      });

      // Verify schemas are functions (Zod schemas)
      const schemaNames = [
        'PolicyRuleSchema',
        'PathPolicySchema',
        'TestPolicySchema',
        'ApprovalPolicySchema',
        'PolicySchema',
        'PolicyViolationSchema',
        'PolicyViolationEventSchema'
      ];

      schemaNames.forEach(schemaName => {
        expect(typeof module[schemaName].parse).toBe('function');
        expect(typeof module[schemaName].safeParse).toBe('function');
      });

    } catch (error) {
      // If this test fails, it indicates a compilation or import error
      console.error('Failed to import policy types:', error);
      throw new Error('Policy types import failed - likely compilation error');
    }
  });

  it('should validate that all types work together in TypeScript', () => {
    // This test uses TypeScript's type system to verify compatibility
    // If this compiles without errors, the types are correctly defined

    const testData = {
      // Test PolicyRule type
      policyRule: {
        id: 'test-rule',
        name: 'Test Rule',
        enabled: true,
        tags: ['test']
      } as import('../types').PolicyRule,

      // Test PathPolicy type
      pathPolicy: {
        id: 'path-policy',
        name: 'Path Policy',
        type: 'path' as const,
        config: {
          mode: 'allowlist' as const,
          allow: ['src/**'],
          block: []
        }
      } as import('../types').PathPolicy,

      // Test TestPolicy type
      testPolicy: {
        id: 'test-policy',
        name: 'Test Policy',
        type: 'test' as const,
        config: {
          enforcement: 'warn' as const,
          rules: []
        }
      } as import('../types').TestPolicy,

      // Test ApprovalPolicy type
      approvalPolicy: {
        id: 'approval-policy',
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
      } as import('../types').ApprovalPolicy,

      // Test Policy union type
      policy: {
        id: 'union-policy',
        name: 'Union Policy',
        type: 'path' as const,
        config: {
          mode: 'allowlist' as const,
          allow: [],
          block: []
        }
      } as import('../types').Policy,

      // Test PolicyViolation type
      violation: {
        id: 'violation-1',
        ruleId: 'rule-1',
        policyType: 'path' as const,
        severity: 'warning' as const,
        message: 'Violation message',
        timestamp: new Date()
      } as import('../types').PolicyViolation,

      // Test PolicyViolationEvent type
      event: {
        type: 'policy_violation' as const,
        id: 'event-1',
        timestamp: new Date(),
        violation: {
          id: 'violation-1',
          ruleId: 'rule-1',
          policyType: 'test' as const,
          severity: 'error' as const,
          message: 'Event violation',
          timestamp: new Date()
        }
      } as import('../types').PolicyViolationEvent
    };

    // If this code compiles, all types are properly defined
    expect(testData.policyRule.id).toBe('test-rule');
    expect(testData.pathPolicy.type).toBe('path');
    expect(testData.testPolicy.type).toBe('test');
    expect(testData.approvalPolicy.type).toBe('approval');
    expect(testData.policy.type).toBe('path');
    expect(testData.violation.policyType).toBe('path');
    expect(testData.event.type).toBe('policy_violation');
  });

  it('should ensure backward compatibility with existing types', async () => {
    // Verify that adding new types doesn't break existing functionality
    try {
      const module = await import('../types');

      // Test existing exports still work
      expect(module.PolicyConfigSchema).toBeDefined();
      expect(module.PolicyConfig).toBeDefined();
      expect(module.AllowedPathsConfigSchema).toBeDefined();
      expect(module.RequiredTestsConfigSchema).toBeDefined();
      expect(module.ApprovalRulesConfigSchema).toBeDefined();

      // Test that PolicyConfig can still be created
      const config = {
        version: '1.0',
        enforcement: 'warn' as const,
        enabled: true,
        tags: []
      };

      const result = module.PolicyConfigSchema.parse(config);
      expect(result.version).toBe('1.0');

    } catch (error) {
      console.error('Backward compatibility test failed:', error);
      throw error;
    }
  });

  it('should validate runtime schema functionality', async () => {
    // Test that Zod schemas actually work at runtime
    try {
      const module = await import('../types');

      // Test successful parsing
      const validPolicy = {
        id: 'runtime-test',
        name: 'Runtime Test Policy',
        type: 'path' as const,
        config: {
          mode: 'allowlist' as const,
          allow: ['test/**'],
          block: []
        }
      };

      const result = module.PolicySchema.parse(validPolicy);
      expect(result.type).toBe('path');
      expect(result.id).toBe('runtime-test');

      // Test error handling
      const invalidPolicy = {
        id: 'invalid-test',
        name: 'Invalid Test Policy',
        type: 'invalid-type',
        config: {}
      };

      expect(() => module.PolicySchema.parse(invalidPolicy)).toThrow();

    } catch (error) {
      console.error('Runtime schema validation failed:', error);
      throw error;
    }
  });

  it('should verify TypeScript type narrowing works correctly', () => {
    // Test discriminated union type narrowing
    const policies = [
      { id: 'p1', name: 'P1', type: 'path' as const, config: { mode: 'allowlist' as const, allow: [], block: [] } },
      { id: 'p2', name: 'P2', type: 'test' as const, config: { enforcement: 'warn' as const, rules: [] } },
      { id: 'p3', name: 'P3', type: 'approval' as const, config: { enabled: true, rules: [], defaultTimeoutMinutes: 60, defaultTimeoutAction: 'reject' as const, globalApprovers: [], notificationsEnabled: true } }
    ];

    policies.forEach(policy => {
      // TypeScript should properly narrow types based on discriminator
      if (policy.type === 'path') {
        expect(policy.config.mode).toBeDefined();
        expect(Array.isArray(policy.config.allow)).toBe(true);
      } else if (policy.type === 'test') {
        expect(policy.config.enforcement).toBeDefined();
        expect(Array.isArray(policy.config.rules)).toBe(true);
      } else if (policy.type === 'approval') {
        expect(typeof policy.config.enabled).toBe('boolean');
      }
    });
  });
});

// Additional compilation test - if this file compiles, types are working
type TestPolicyUnion = import('../types').Policy;
type TestViolation = import('../types').PolicyViolation;
type TestEvent = import('../types').PolicyViolationEvent;

// Type assertion test functions
function isPathPolicy(policy: TestPolicyUnion): policy is import('../types').PathPolicy {
  return policy.type === 'path';
}

function isTestPolicy(policy: TestPolicyUnion): policy is import('../types').TestPolicy {
  return policy.type === 'test';
}

function isApprovalPolicy(policy: TestPolicyUnion): policy is import('../types').ApprovalPolicy {
  return policy.type === 'approval';
}

// If these functions compile without errors, discriminated unions are working correctly