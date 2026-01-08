/**
 * @fileoverview Unit tests for PolicyEngine class
 *
 * Tests cover:
 * - PolicyEngine creation and configuration
 * - Policy rule loading and evaluation
 * - Different enforcement modes and their behavior
 * - Context validation and transformation
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolicyEngine, createPolicyEngine } from '../policy-engine.js';
import type {
  ApexConfig,
  PolicyConfig,
  PolicyCheckContext,
  PolicyCheckOptions,
  PolicyEnforcementMode,
  PolicyCheckResult,
  PolicyViolation,
} from '@apexcli/core';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a test ApexConfig with policy settings
 */
function createTestConfig(policyOverrides: Partial<PolicyConfig> = {}): ApexConfig {
  return {
    project: {
      name: 'test-project',
      description: 'Test project for PolicyEngine',
    },
    policy: {
      enabled: true,
      enforcement: 'warn',
      name: 'test-policy',
      allowedPaths: {
        mode: 'allowlist',
        allow: ['src/**', 'test/**'],
        block: ['secrets/**', '**/*.key'],
        sensitive: ['**/.env*', '**/config/production.*'],
      },
      approvalRules: {
        enabled: true,
        rules: [
          {
            id: 'dangerous-commands',
            name: 'Dangerous Commands',
            enabled: true,
            priority: 100,
            conditions: [
              {
                type: 'tool-name',
                patterns: ['Bash', 'Shell'],
              },
            ],
            urgency: 'high',
            timeoutMinutes: 30,
            approvers: ['admin'],
            minApprovals: 1,
            timeoutAction: 'reject',
          },
        ],
      },
      ...policyOverrides,
    },
    permissions: {
      autonomy: 'autonomous',
      tools: {},
    },
    agents: [],
    workflows: [],
  };
}

/**
 * Creates a test PolicyCheckContext
 */
function createTestContext(overrides: Partial<PolicyCheckContext> = {}): PolicyCheckContext {
  return {
    taskId: 'test-task-123',
    agentId: 'test-agent',
    action: 'file_read',
    toolName: 'Read',
    resource: '/project/src/main.ts',
    toolArguments: { file_path: '/project/src/main.ts' },
    metadata: {
      workflowId: 'test-workflow',
      stage: 'implementation',
    },
    environment: {
      projectPath: '/project',
    },
    ...overrides,
  };
}

// ============================================================================
// PolicyEngine Creation and Configuration Tests
// ============================================================================

describe('PolicyEngine - Creation and Configuration', () => {
  it('should create PolicyEngine with default configuration', () => {
    const config = createTestConfig();
    const engine = new PolicyEngine(config);

    expect(engine.isEnabled).toBe(true);
    expect(engine.getEnforcementMode()).toBe('warn');
    expect(engine.policyConfiguration).toEqual(config.policy);
  });

  it('should create PolicyEngine with custom configuration', () => {
    const config = createTestConfig({
      enabled: true,
      enforcement: 'strict',
      name: 'custom-policy',
    });

    const engine = new PolicyEngine(config);

    expect(engine.isEnabled).toBe(true);
    expect(engine.getEnforcementMode()).toBe('strict');
    expect(engine.policyConfiguration.name).toBe('custom-policy');
  });

  it('should create PolicyEngine with disabled policy', () => {
    const config = createTestConfig({
      enabled: false,
    });

    const engine = new PolicyEngine(config);

    expect(engine.isEnabled).toBe(false);
    expect(engine.getEnforcementMode()).toBe('warn'); // default
  });

  it('should create PolicyEngine using factory function', () => {
    const config = createTestConfig({
      name: 'factory-policy',
      enforcement: 'audit',
    });

    const engine = createPolicyEngine(config);

    expect(engine.policyConfiguration.name).toBe('factory-policy');
    expect(engine.getEnforcementMode()).toBe('audit');
  });

  it('should update enforcement mode', () => {
    const config = createTestConfig({ enforcement: 'warn' });
    const engine = new PolicyEngine(config);

    expect(engine.getEnforcementMode()).toBe('warn');

    engine.setEnforcementMode('strict');
    expect(engine.getEnforcementMode()).toBe('strict');
  });

  it('should load policy rules from configuration', () => {
    const config = createTestConfig();
    const engine = new PolicyEngine(config);

    const rules = engine.policyRules;
    expect(rules.length).toBeGreaterThan(0);

    // Should have path rules from allowedPaths
    const pathRules = rules.filter(rule => rule.type === 'path');
    expect(pathRules.length).toBeGreaterThan(0);

    // Should have approval rules
    const approvalRules = rules.filter(rule => rule.type === 'approval');
    expect(approvalRules.length).toBeGreaterThan(0);
  });

  it('should handle minimal configuration', () => {
    const config: ApexConfig = {
      project: { name: 'minimal', description: 'Minimal config' },
      policy: { enabled: true, enforcement: 'warn' },
      permissions: { autonomy: 'autonomous', tools: {} },
      agents: [],
      workflows: [],
    };

    const engine = new PolicyEngine(config);

    expect(engine.isEnabled).toBe(true);
    expect(engine.getEnforcementMode()).toBe('warn');
    expect(engine.policyRules.length).toBe(0); // No rules defined
  });
});

// ============================================================================
// Policy Check Tests
// ============================================================================

describe('PolicyEngine - Policy Checks', () => {
  let engine: PolicyEngine;
  let config: ApexConfig;

  beforeEach(() => {
    config = createTestConfig();
    engine = new PolicyEngine(config);
  });

  it('should allow actions that pass all policies', async () => {
    const context = createTestContext({
      action: 'file_read',
      toolName: 'Read',
      resource: '/project/src/allowed.ts',
    });

    const result = await engine.checkPolicy(context);

    expect(result.status).toBe('allow');
    expect(result.violations).toHaveLength(0);
    expect(result.enforcementMode).toBe('warn');
    expect(result.rulesEvaluated).toBeGreaterThan(0);
  });

  it('should deny actions that violate path policies in allowlist mode', async () => {
    const context = createTestContext({
      action: 'file_write',
      toolName: 'Write',
      resource: '/project/restricted/secret.txt',
    });

    const result = await engine.checkPolicy(context);

    expect(result.status).toBe('deny');
    expect(result.violations.length).toBeGreaterThan(0);

    const violation = result.violations[0];
    expect(violation.blocking).toBe(false); // warn mode
    expect(violation.policyType).toBe('path');
    expect(violation.message).toContain('not in the allowed paths list');
  });

  it('should block dangerous tools in approval rules', async () => {
    const context = createTestContext({
      action: 'command_execution',
      toolName: 'Bash',
      resource: 'rm -rf /',
      toolArguments: { command: 'rm -rf /' },
    });

    const result = await engine.checkPolicy(context);

    expect(result.status).toBe('deny');
    expect(result.violations.length).toBeGreaterThan(0);

    const violation = result.violations[0];
    expect(violation.rule).toBe('approval-1');
    expect(violation.severity).toBe('high'); // high urgency maps to high severity
  });

  it('should handle different enforcement modes correctly', async () => {
    const context = createTestContext({
      resource: '/project/restricted/file.txt',
    });

    // Test strict mode
    const strictResult = await engine.checkPolicy(context, { enforcementMode: 'strict' });
    expect(strictResult.status).toBe('deny');
    expect(strictResult.enforcementMode).toBe('strict');

    // Test warn mode
    const warnResult = await engine.checkPolicy(context, { enforcementMode: 'warn' });
    expect(warnResult.status).toBe('deny'); // Still deny because of violations
    expect(warnResult.enforcementMode).toBe('warn');

    // Test audit mode
    const auditResult = await engine.checkPolicy(context, { enforcementMode: 'audit' });
    expect(auditResult.status).toBe('allow'); // Allow in audit mode
    expect(auditResult.enforcementMode).toBe('audit');

    // Test disabled mode
    const disabledResult = await engine.checkPolicy(context, { enforcementMode: 'disabled' });
    expect(disabledResult.status).toBe('allow');
    expect(disabledResult.enforcementMode).toBe('disabled');
    expect(disabledResult.violations).toHaveLength(0);
    expect(disabledResult.metadata?.disabled).toBe(true);
  });

  it('should limit violations when maxViolations is set', async () => {
    const context = createTestContext({
      resource: '/project/secrets/config.key', // Matches both block and sensitive patterns
    });

    const result = await engine.checkPolicy(context, { maxViolations: 1 });

    expect(result.violations.length).toBe(1);
  });

  it('should include timing and metadata in results', async () => {
    const context = createTestContext();

    const startTime = Date.now();
    const result = await engine.checkPolicy(context);
    const endTime = Date.now();

    expect(result.checkedAt).toBeInstanceOf(Date);
    expect(result.checkedAt.getTime()).toBeGreaterThanOrEqual(startTime);
    expect(result.checkedAt.getTime()).toBeLessThanOrEqual(endTime);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.policyName).toBe('test-policy');
    expect(result.policyId).toBe('policy-engine-config');
  });

  it('should handle missing context gracefully', async () => {
    const minimalContext: PolicyCheckContext = {
      action: 'unknown',
      taskId: '',
      agentId: '',
    };

    const result = await engine.checkPolicy(minimalContext);

    expect(result.status).toBe('allow'); // Should default to allow for minimal context
    expect(result.violations).toHaveLength(0);
  });

  it('should convert legacy evaluation to new format correctly', async () => {
    const context = createTestContext({
      resource: '/project/secrets/blocked.key',
    });

    const result = await engine.checkPolicy(context);

    expect(result).toMatchObject({
      status: expect.stringMatching(/^(allow|deny)$/),
      violations: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          rule: expect.any(String),
          message: expect.any(String),
          severity: expect.stringMatching(/^(low|medium|high|critical)$/),
          blocking: expect.any(Boolean),
          policyType: expect.stringMatching(/^(path|approval|test)$/),
          timestamp: expect.any(Date),
        }),
      ]),
      enforcementMode: expect.any(String),
      checkedAt: expect.any(Date),
      rulesEvaluated: expect.any(Number),
      rulesPassed: expect.any(Number),
      rulesFailed: expect.any(Number),
      durationMs: expect.any(Number),
      metadata: expect.objectContaining({
        legacyEvaluation: true,
      }),
    });
  });
});

// ============================================================================
// Policy Management Tests
// ============================================================================

describe('PolicyEngine - Policy Management', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    const config = createTestConfig();
    engine = new PolicyEngine(config);
  });

  it('should register and retrieve policies', () => {
    const policy = {
      id: 'test-policy-1',
      name: 'Test Policy',
      version: '1.0',
      enabled: true,
      enforcement: 'warn' as PolicyEnforcementMode,
      rules: [],
    };

    engine.registerPolicy(policy);

    expect(engine.hasPolicy('test-policy-1')).toBe(true);
    expect(engine.getPolicy('test-policy-1')).toEqual(policy);

    const allPolicies = engine.getPolicies();
    expect(allPolicies).toContainEqual(policy);
  });

  it('should unregister policies', () => {
    const policy = {
      id: 'test-policy-2',
      name: 'Test Policy 2',
      version: '1.0',
      enabled: true,
      enforcement: 'strict' as PolicyEnforcementMode,
      rules: [],
    };

    engine.registerPolicy(policy);
    expect(engine.hasPolicy('test-policy-2')).toBe(true);

    const removed = engine.unregisterPolicy('test-policy-2');
    expect(removed).toBe(true);
    expect(engine.hasPolicy('test-policy-2')).toBe(false);

    const removedAgain = engine.unregisterPolicy('test-policy-2');
    expect(removedAgain).toBe(false);
  });

  it('should clear all policies', () => {
    const policy1 = {
      id: 'policy-1',
      name: 'Policy 1',
      version: '1.0',
      enabled: true,
      enforcement: 'warn' as PolicyEnforcementMode,
      rules: [],
    };

    const policy2 = {
      id: 'policy-2',
      name: 'Policy 2',
      version: '1.0',
      enabled: true,
      enforcement: 'strict' as PolicyEnforcementMode,
      rules: [],
    };

    engine.registerPolicy(policy1);
    engine.registerPolicy(policy2);

    expect(engine.getPolicies()).toHaveLength(2);

    engine.clearPolicies();

    expect(engine.getPolicies()).toHaveLength(0);
    expect(engine.hasPolicy('policy-1')).toBe(false);
    expect(engine.hasPolicy('policy-2')).toBe(false);
  });
});

// ============================================================================
// Rule Evaluation Tests
// ============================================================================

describe('PolicyEngine - Rule Evaluation', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    const config = createTestConfig();
    engine = new PolicyEngine(config);
  });

  it('should validate file paths correctly', () => {
    // Test allowed paths
    const allowedViolations = engine.validateFilePath('/project/src/main.ts');
    expect(allowedViolations).toHaveLength(0);

    // Test blocked paths
    const blockedViolations = engine.validateFilePath('/project/secrets/key.txt');
    expect(blockedViolations.length).toBeGreaterThan(0);
    expect(blockedViolations[0].rule).toContain('path-block');

    // Test paths not in allowlist
    const restrictedViolations = engine.validateFilePath('/project/private/data.txt');
    expect(restrictedViolations.length).toBeGreaterThan(0);
  });

  it('should handle sensitive files requiring approval', () => {
    const violations = engine.validateFilePath('/project/src/.env.production');
    expect(violations.length).toBeGreaterThan(0);

    const sensitiveViolation = violations.find(v => v.rule?.includes('sensitive'));
    expect(sensitiveViolation).toBeDefined();
    expect(sensitiveViolation?.context?.requiresApproval).toBe(true);
  });

  it('should evaluate rules by type correctly', () => {
    const pathRules = engine.getRulesByType('path');
    expect(pathRules.length).toBeGreaterThan(0);
    expect(pathRules.every(rule => rule.type === 'path')).toBe(true);

    const approvalRules = engine.getRulesByType('approval');
    expect(approvalRules.length).toBeGreaterThan(0);
    expect(approvalRules.every(rule => rule.type === 'approval')).toBe(true);
  });

  it('should evaluate rules by severity correctly', () => {
    const errorRules = engine.getRulesBySeverity('high');
    expect(errorRules.every(rule => rule.severity === 'high')).toBe(true);

    const warningRules = engine.getRulesBySeverity('medium');
    expect(warningRules.every(rule => rule.severity === 'medium')).toBe(true);
  });

  it('should reload rules when configuration changes', () => {
    const initialRuleCount = engine.policyRules.length;

    // Reload with different configuration
    engine.reloadRules({
      loadPathRules: true,
      loadApprovalRules: false,
      loadToolRules: false,
      loadCustomRules: false,
    });

    const newRuleCount = engine.policyRules.length;
    expect(newRuleCount).toBeLessThan(initialRuleCount);

    // Should only have path rules now
    const rules = engine.policyRules;
    expect(rules.every(rule => rule.type === 'path')).toBe(true);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('PolicyEngine - Edge Cases and Error Handling', () => {
  it('should handle disabled policy engine correctly', async () => {
    const config = createTestConfig({ enabled: false });
    const engine = new PolicyEngine(config);

    const context = createTestContext();
    const result = await engine.checkPolicy(context);

    expect(result.status).toBe('allow');
    expect(result.violations).toHaveLength(0);
    expect(result.rulesEvaluated).toBe(0);
  });

  it('should handle malformed path patterns gracefully', () => {
    const config = createTestConfig({
      allowedPaths: {
        mode: 'allowlist',
        allow: ['[invalid-glob-pattern'],
        block: ['**{malformed'],
      },
    });

    expect(() => {
      const engine = new PolicyEngine(config);
      const violations = engine.validateFilePath('/project/test.ts');
      // Should not throw and treat as violation due to allowlist mode
      expect(violations.length).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it('should handle empty configuration sections', () => {
    const config = createTestConfig({
      allowedPaths: undefined,
      approvalRules: undefined,
    });

    expect(() => {
      const engine = new PolicyEngine(config);
      expect(engine.policyRules).toHaveLength(0);
    }).not.toThrow();
  });

  it('should handle empty file paths', () => {
    const config = createTestConfig();
    const engine = new PolicyEngine(config);

    const emptyViolations = engine.validateFilePath('');
    expect(emptyViolations).toHaveLength(0);

    const whitespaceViolations = engine.validateFilePath('   ');
    expect(whitespaceViolations).toHaveLength(0);
  });

  it('should normalize Windows-style paths', () => {
    const config = createTestConfig();
    const engine = new PolicyEngine(config);

    // Test Windows-style path
    const violations = engine.validateFilePath('\\project\\src\\main.ts');
    expect(violations).toHaveLength(0); // Should be allowed after normalization
  });

  it('should handle custom rule loading configuration', () => {
    const config = createTestConfig();

    // Test selective rule loading
    const engine1 = new PolicyEngine(config, {
      loadPathRules: true,
      loadApprovalRules: false,
      loadToolRules: false,
      loadCustomRules: false,
    });

    const pathOnlyRules = engine1.policyRules;
    expect(pathOnlyRules.every(rule => rule.type === 'path')).toBe(true);

    // Test all rules disabled
    const engine2 = new PolicyEngine(config, {
      loadPathRules: false,
      loadApprovalRules: false,
      loadToolRules: false,
      loadCustomRules: false,
    });

    expect(engine2.policyRules).toHaveLength(0);
  });

  it('should handle concurrent policy checks safely', async () => {
    const config = createTestConfig();
    const engine = new PolicyEngine(config);

    const context1 = createTestContext({ taskId: 'task-1' });
    const context2 = createTestContext({ taskId: 'task-2' });
    const context3 = createTestContext({ taskId: 'task-3' });

    // Run concurrent policy checks
    const results = await Promise.all([
      engine.checkPolicy(context1),
      engine.checkPolicy(context2),
      engine.checkPolicy(context3),
    ]);

    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.status).toBeDefined();
      expect(result.enforcementMode).toBeDefined();
      expect(result.checkedAt).toBeInstanceOf(Date);
    });
  });
});
