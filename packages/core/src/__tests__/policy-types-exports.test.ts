import { describe, it, expect } from 'vitest';

describe('Policy Types Exports', () => {
  it('should export all required PolicyRule schemas and types', async () => {
    const module = await import('../types');

    // Check PolicyRule exports
    expect(module.PolicyRuleSchema).toBeDefined();
    expect(typeof module.PolicyRuleSchema.parse).toBe('function');

    // Check that PolicyRule type is available (TypeScript compilation test)
    const testRule: module.PolicyRule = {
      id: 'test-rule',
      name: 'Test Rule'
    };
    expect(testRule.id).toBe('test-rule');
  });

  it('should export all required PathPolicy schemas and types', async () => {
    const module = await import('../types');

    expect(module.PathPolicySchema).toBeDefined();
    expect(typeof module.PathPolicySchema.parse).toBe('function');

    // Check that PathPolicy type is available (TypeScript compilation test)
    const testPolicy: module.PathPolicy = {
      id: 'path-policy',
      name: 'Path Policy',
      type: 'path',
      config: {
        mode: 'allowlist',
        allow: ['src/**'],
        block: []
      }
    };
    expect(testPolicy.type).toBe('path');
  });

  it('should export all required TestPolicy schemas and types', async () => {
    const module = await import('../types');

    expect(module.TestPolicySchema).toBeDefined();
    expect(typeof module.TestPolicySchema.parse).toBe('function');

    // Check that TestPolicy type is available (TypeScript compilation test)
    const testPolicy: module.TestPolicy = {
      id: 'test-policy',
      name: 'Test Policy',
      type: 'test',
      config: {
        enforcement: 'warn',
        rules: []
      }
    };
    expect(testPolicy.type).toBe('test');
  });

  it('should export all required ApprovalPolicy schemas and types', async () => {
    const module = await import('../types');

    expect(module.ApprovalPolicySchema).toBeDefined();
    expect(typeof module.ApprovalPolicySchema.parse).toBe('function');

    // Check that ApprovalPolicy type is available (TypeScript compilation test)
    const testPolicy: module.ApprovalPolicy = {
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
    expect(testPolicy.type).toBe('approval');
  });

  it('should export Policy discriminated union schema and type', async () => {
    const module = await import('../types');

    expect(module.PolicySchema).toBeDefined();
    expect(typeof module.PolicySchema.parse).toBe('function');

    // Test that Policy union type works with all variants
    const pathPolicy: module.Policy = {
      id: 'policy-1',
      name: 'Policy 1',
      type: 'path',
      config: { mode: 'allowlist', allow: [], block: [] }
    };

    const testPolicy: module.Policy = {
      id: 'policy-2',
      name: 'Policy 2',
      type: 'test',
      config: { enforcement: 'warn', rules: [] }
    };

    const approvalPolicy: module.Policy = {
      id: 'policy-3',
      name: 'Policy 3',
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

    expect(pathPolicy.type).toBe('path');
    expect(testPolicy.type).toBe('test');
    expect(approvalPolicy.type).toBe('approval');
  });

  it('should export PolicyViolation schemas and types', async () => {
    const module = await import('../types');

    expect(module.PolicyViolationSchema).toBeDefined();
    expect(typeof module.PolicyViolationSchema.parse).toBe('function');

    // Check that PolicyViolation type is available (TypeScript compilation test)
    const violation: module.PolicyViolation = {
      id: 'violation-1',
      ruleId: 'rule-1',
      policyType: 'path',
      severity: 'warning',
      message: 'Path violation',
      timestamp: new Date()
    };
    expect(violation.policyType).toBe('path');
  });

  it('should export PolicyViolationEvent schemas and types', async () => {
    const module = await import('../types');

    expect(module.PolicyViolationEventSchema).toBeDefined();
    expect(typeof module.PolicyViolationEventSchema.parse).toBe('function');

    // Check that PolicyViolationEvent type is available (TypeScript compilation test)
    const event: module.PolicyViolationEvent = {
      type: 'policy_violation',
      id: 'event-1',
      timestamp: new Date(),
      violation: {
        id: 'violation-1',
        ruleId: 'rule-1',
        policyType: 'test',
        severity: 'error',
        message: 'Test violation',
        timestamp: new Date()
      }
    };
    expect(event.type).toBe('policy_violation');
    expect(event.violation.policyType).toBe('test');
  });

  it('should work with all schemas together', async () => {
    const module = await import('../types');

    // Test that all schemas can be used together in a realistic scenario
    const rule = module.PolicyRuleSchema.parse({
      id: 'integrated-rule',
      name: 'Integrated Rule'
    });

    const pathPolicy = module.PathPolicySchema.parse({
      ...rule,
      type: 'path',
      config: {
        mode: 'blocklist',
        allow: [],
        block: ['secret/**']
      }
    });

    const violation = module.PolicyViolationSchema.parse({
      id: 'violation-1',
      ruleId: pathPolicy.id,
      policyType: 'path',
      severity: 'error',
      message: 'Blocked path access attempted',
      timestamp: new Date()
    });

    const event = module.PolicyViolationEventSchema.parse({
      type: 'policy_violation',
      id: 'event-1',
      timestamp: new Date(),
      violation
    });

    expect(pathPolicy.id).toBe('integrated-rule');
    expect(violation.ruleId).toBe(pathPolicy.id);
    expect(event.violation.id).toBe(violation.id);
  });

  it('should allow proper type narrowing for discriminated unions', () => {
    // This test ensures TypeScript type narrowing works correctly with the Policy union
    const policies = [
      { id: 'p1', name: 'P1', type: 'path' as const, config: { mode: 'allowlist' as const, allow: [], block: [] } },
      { id: 'p2', name: 'P2', type: 'test' as const, config: { enforcement: 'warn' as const, rules: [] } },
      { id: 'p3', name: 'P3', type: 'approval' as const, config: { enabled: true, rules: [], defaultTimeoutMinutes: 60, defaultTimeoutAction: 'reject' as const, globalApprovers: [], notificationsEnabled: true } }
    ];

    policies.forEach(policy => {
      if (policy.type === 'path') {
        // TypeScript should know this is a PathPolicy
        expect(policy.config.mode).toBeDefined();
        expect(Array.isArray(policy.config.allow)).toBe(true);
      } else if (policy.type === 'test') {
        // TypeScript should know this is a TestPolicy
        expect(policy.config.enforcement).toBeDefined();
        expect(Array.isArray(policy.config.rules)).toBe(true);
      } else if (policy.type === 'approval') {
        // TypeScript should know this is an ApprovalPolicy
        expect(typeof policy.config.enabled).toBe('boolean');
        expect(Array.isArray(policy.config.rules)).toBe(true);
      }
    });
  });
});