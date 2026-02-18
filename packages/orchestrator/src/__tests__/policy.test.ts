/**
 * @fileoverview Unit tests for PolicyEnforcer
 *
 * Tests cover:
 * - Policy loading with different configurations
 * - Rule evaluation for file paths, approvals, and custom conditions
 * - Severity handling across different enforcement modes
 * - Blocking vs non-blocking violation behaviors
 * - Integration with task completion flow and event emission
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PolicyEnforcer, createPolicyEnforcer } from '../policy/policy-enforcer.js';
import type {
  PolicyConfig,
  PolicyViolation,
  PolicyViolationEvent,
  Task,
  ApprovalRule,
  ApprovalCondition,
  PolicyEvaluationResult,
} from '@apexcli/core';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock Task object with default values and any overrides
 */
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: randomUUID(),
    description: 'Test task description',
    workflow: 'feature-development',
    autonomy: 'autonomous',
    status: 'pending',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/project',
    branchName: 'feature/test',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.05,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  } as Task;
}

/**
 * Creates a policy configuration with default values and any overrides
 */
function createPolicyConfig(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return {
    version: '1.0',
    enabled: true,
    enforcement: 'warn',
    name: 'test-policy',
    allowedPaths: {
      mode: 'allowlist',
      allow: ['src/**', 'test/**'],
      block: ['secrets/**', '**/*.key'],
      sensitivePatterns: ['**/.env*', '**/config/production.*'],
    },
    ...overrides,
  };
}

/**
 * Creates an approval rule with default values and any overrides
 */
function createApprovalRule(overrides: Partial<ApprovalRule> = {}): ApprovalRule {
  return {
    id: 'test-rule',
    name: 'Test Approval Rule',
    enabled: true,
    priority: 100,
    conditions: [
      {
        type: 'file-pattern',
        patterns: ['**/*.config.*'],
      },
    ],
    urgency: 'normal',
    timeoutMinutes: 60,
    approvers: ['admin'],
    minApprovals: 1,
    timeoutAction: 'reject',
    ...overrides,
  };
}

// ============================================================================
// Policy Loading Tests
// ============================================================================

describe('PolicyEnforcer - Policy Loading', () => {
  it('should load policy configuration correctly', () => {
    const config = createPolicyConfig({
      name: 'my-policy',
      enforcement: 'strict',
      enabled: true,
    });

    const enforcer = new PolicyEnforcer(config);

    expect(enforcer.policyConfig).toEqual(config);
    expect(enforcer.enforcementMode).toBe('strict');
    expect(enforcer.isEnabled).toBe(true);
  });

  it('should handle minimal policy configuration', () => {
    const config = createPolicyConfig({
      allowedPaths: undefined,
      enforcement: undefined,
    });

    const enforcer = new PolicyEnforcer(config);

    expect(enforcer.enforcementMode).toBe('warn'); // default
    expect(enforcer.isEnabled).toBe(true);
  });

  it('should handle disabled policy configuration', () => {
    const config = createPolicyConfig({
      enabled: false,
    });

    const enforcer = new PolicyEnforcer(config);

    expect(enforcer.isEnabled).toBe(false);
  });

  it('should create enforcer with factory function', () => {
    const enforcer = createPolicyEnforcer({
      name: 'factory-policy',
      enforcement: 'audit',
    });

    expect(enforcer.policyConfig.name).toBe('factory-policy');
    expect(enforcer.enforcementMode).toBe('audit');
    expect(enforcer.policyConfig.version).toBe('1.0'); // default
  });
});

// ============================================================================
// Rule Evaluation Tests
// ============================================================================

describe('PolicyEnforcer - Rule Evaluation', () => {
  let enforcer: PolicyEnforcer;
  let config: PolicyConfig;

  beforeEach(() => {
    config = createPolicyConfig();
    enforcer = new PolicyEnforcer(config);
  });

  describe('File Path Validation', () => {
    it('should allow files matching allowlist patterns', () => {
      const violations = enforcer.validateFilePath('/project/src/main.ts');
      expect(violations).toHaveLength(0);
    });

    it('should allow files in test directory', () => {
      const violations = enforcer.validateFilePath('/project/test/unit.test.ts');
      expect(violations).toHaveLength(0);
    });

    it('should block files matching block patterns', () => {
      const violations = enforcer.validateFilePath('/project/secrets/config.key');
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('path-validation');
      expect(violations[0].message).toContain('blocked by pattern');
    });

    it('should block files not in allowlist', () => {
      const violations = enforcer.validateFilePath('/project/private/data.txt');
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('not in the allowed paths list');
    });

    it('should detect sensitive files and require approval', () => {
      const violations = enforcer.validateFilePath('/project/src/.env.production');
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('sensitive-path');
      expect(violations[0].message).toContain('matches sensitive file pattern');
      expect(violations[0].context?.requiresApproval).toBe(true);
    });

    it('should handle blocklist mode correctly', () => {
      const blocklistConfig = createPolicyConfig({
        allowedPaths: {
          mode: 'blocklist',
          block: ['secrets/**'],
        },
      });
      const blocklistEnforcer = new PolicyEnforcer(blocklistConfig);

      // Should allow non-blocked paths
      const allowedViolations = blocklistEnforcer.validateFilePath('/project/src/main.ts');
      expect(allowedViolations).toHaveLength(0);

      // Should block explicitly blocked paths
      const blockedViolations = blocklistEnforcer.validateFilePath('/project/secrets/key.txt');
      expect(blockedViolations).toHaveLength(1);
      expect(blockedViolations[0].message).toContain('blocked by pattern');
    });

    it('should normalize paths correctly', () => {
      // Windows-style paths should be normalized
      const violations1 = enforcer.validateFilePath('\\project\\src\\main.ts');
      expect(violations1).toHaveLength(0);

      // Paths with .. should be normalized
      const violations2 = enforcer.validateFilePath('/project/test/../src/main.ts');
      expect(violations2).toHaveLength(0);
    });

    it('should handle empty and invalid paths', () => {
      const violations1 = enforcer.validateFilePath('');
      expect(violations1).toHaveLength(0);

      const violations2 = enforcer.validateFilePath('   ');
      expect(violations2).toHaveLength(0);
    });
  });

  describe('Approval Rule Evaluation', () => {
    let task: Task;

    beforeEach(() => {
      task = createMockTask();
    });

    it('should require approval for file pattern conditions', () => {
      const configWithApproval = createPolicyConfig({
        approvalRules: {
          enabled: true,
          rules: [
            createApprovalRule({
              conditions: [
                {
                  type: 'file-pattern',
                  patterns: ['**/*.config.*'],
                },
              ],
            }),
          ],
        },
      });

      const enforcer = new PolicyEnforcer(configWithApproval);
      const result = enforcer.checkApprovalRequired(task, 'edit', {
        filePaths: ['/project/app.config.js'],
      });

      expect(result.required).toBe(true);
      expect(result.triggeredRules).toHaveLength(1);
      expect(result.reason).toContain('Test Approval Rule');
    });

    it('should require approval for cost threshold conditions', () => {
      const configWithCostRule = createPolicyConfig({
        approvalRules: {
          enabled: true,
          rules: [
            createApprovalRule({
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 1.0,
                },
              ],
            }),
          ],
        },
      });

      const enforcer = new PolicyEnforcer(configWithCostRule);
      const highCostTask = createMockTask({
        usage: {
          inputTokens: 10000,
          outputTokens: 5000,
          totalTokens: 15000,
          estimatedCost: 2.0,
        },
      });

      const result = enforcer.checkApprovalRequired(highCostTask, 'execute');

      expect(result.required).toBe(true);
      expect(result.triggeredRules).toHaveLength(1);
    });

    it('should require approval for token threshold conditions', () => {
      const configWithTokenRule = createPolicyConfig({
        approvalRules: {
          enabled: true,
          rules: [
            createApprovalRule({
              conditions: [
                {
                  type: 'token-threshold',
                  threshold: 1000,
                },
              ],
            }),
          ],
        },
      });

      const enforcer = new PolicyEnforcer(configWithTokenRule);
      const highTokenTask = createMockTask({
        usage: {
          inputTokens: 800,
          outputTokens: 400,
          totalTokens: 1200,
          estimatedCost: 0.1,
        },
      });

      const result = enforcer.checkApprovalRequired(highTokenTask, 'execute');

      expect(result.required).toBe(true);
      expect(result.triggeredRules).toHaveLength(1);
    });

    it('should require approval for operation conditions', () => {
      const configWithOpRule = createPolicyConfig({
        approvalRules: {
          enabled: true,
          rules: [
            createApprovalRule({
              conditions: [
                {
                  type: 'operation',
                  operations: ['deploy', 'delete'],
                },
              ],
            }),
          ],
        },
      });

      const enforcer = new PolicyEnforcer(configWithOpRule);
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(true);
      expect(result.triggeredRules).toHaveLength(1);
    });

    it('should aggregate multiple triggered rules correctly', () => {
      const configWithMultipleRules = createPolicyConfig({
        approvalRules: {
          enabled: true,
          rules: [
            createApprovalRule({
              id: 'rule1',
              priority: 100,
              urgency: 'high',
              timeoutMinutes: 30,
              approvers: ['admin1'],
              minApprovals: 1,
              conditions: [{ type: 'operation', operations: ['deploy'] }],
            }),
            createApprovalRule({
              id: 'rule2',
              priority: 200,
              urgency: 'critical',
              timeoutMinutes: 15,
              approvers: ['admin2'],
              minApprovals: 2,
              conditions: [{ type: 'cost-threshold', threshold: 0.01 }],
            }),
          ],
        },
      });

      const enforcer = new PolicyEnforcer(configWithMultipleRules);
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(true);
      expect(result.triggeredRules).toHaveLength(2);
      expect(result.urgency).toBe('critical'); // highest urgency
      expect(result.timeoutMinutes).toBe(15); // shortest timeout
      expect(result.minApprovals).toBe(2); // maximum approvals
      expect(result.requiredApprovers).toEqual(['admin1', 'admin2']); // union
    });

    it('should handle AND logic for rule conditions', () => {
      const configWithAndRule = createPolicyConfig({
        approvalRules: {
          enabled: true,
          rules: [
            createApprovalRule({
              requireAllConditions: true,
              conditions: [
                { type: 'operation', operations: ['deploy'] },
                { type: 'cost-threshold', threshold: 0.01 },
              ],
            }),
          ],
        },
      });

      const enforcer = new PolicyEnforcer(configWithAndRule);

      // Should not require approval if only one condition matches
      const result1 = enforcer.checkApprovalRequired(
        createMockTask({ usage: { ...task.usage, estimatedCost: 0.001 } }),
        'deploy'
      );
      expect(result1.required).toBe(false);

      // Should require approval if both conditions match
      const result2 = enforcer.checkApprovalRequired(
        createMockTask({ usage: { ...task.usage, estimatedCost: 0.1 } }),
        'deploy'
      );
      expect(result2.required).toBe(true);
    });

    it('should not require approval when rules are disabled', () => {
      const configWithDisabledRules = createPolicyConfig({
        approvalRules: {
          enabled: false,
          rules: [createApprovalRule()],
        },
      });

      const enforcer = new PolicyEnforcer(configWithDisabledRules);
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(false);
    });
  });
});

// ============================================================================
// Severity Handling Tests
// ============================================================================

describe('PolicyEnforcer - Severity Handling', () => {
  it('should map enforcement modes to correct severities', () => {
    const testCases = [
      { enforcement: 'strict', expectedSeverity: 'critical' },
      { enforcement: 'warn', expectedSeverity: 'high' },
      { enforcement: 'audit', expectedSeverity: 'low' },
    ] as const;

    testCases.forEach(({ enforcement, expectedSeverity }) => {
      const config = createPolicyConfig({ enforcement });
      const enforcer = new PolicyEnforcer(config);

      const violations = enforcer.validateFilePath('/blocked/file.txt');

      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe(expectedSeverity);
    });
  });

  it('should set blocking flag based on enforcement mode', () => {
    const strictConfig = createPolicyConfig({ enforcement: 'strict' });
    const strictEnforcer = new PolicyEnforcer(strictConfig);
    const strictViolations = strictEnforcer.validateFilePath('/blocked/file.txt');
    expect(strictViolations[0].blocking).toBe(true);

    const warnConfig = createPolicyConfig({ enforcement: 'warn' });
    const warnEnforcer = new PolicyEnforcer(warnConfig);
    const warnViolations = warnEnforcer.validateFilePath('/blocked/file.txt');
    expect(warnViolations[0].blocking).toBe(false);
  });

  it('should handle approval urgency to severity mapping', () => {
    const testCases = [
      { urgency: 'critical', expectedSeverity: 'error' },
      { urgency: 'high', expectedSeverity: 'error' },
      { urgency: 'normal', expectedSeverity: 'warning' },
      { urgency: 'low', expectedSeverity: 'info' },
    ] as const;

    testCases.forEach(({ urgency, expectedSeverity }) => {
      const config = createPolicyConfig({
        approvalRules: {
          enabled: true,
          rules: [
            createApprovalRule({
              urgency,
              conditions: [{ type: 'operation', operations: ['test'] }],
            }),
          ],
        },
      });

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkTaskStart(task, { operationType: 'test' });

      const approvalResult = result.results.find(r => r.ruleType === 'approval');
      expect(approvalResult?.severity).toBe(expectedSeverity);
    });
  });
});

// ============================================================================
// Blocking vs Non-blocking Violation Tests
// ============================================================================

describe('PolicyEnforcer - Blocking vs Non-blocking Violations', () => {
  it('should block tasks in strict enforcement mode', () => {
    const strictConfig = createPolicyConfig({ enforcement: 'strict' });
    const enforcer = new PolicyEnforcer(strictConfig);
    const task = createMockTask();

    const result = enforcer.checkTaskStart(task, {
      projectPaths: ['/blocked/secret.key'],
    });

    expect(result.passed).toBe(false);
    expect(result.failedCount).toBeGreaterThan(0);
  });

  it('should warn but not block tasks in warn enforcement mode', () => {
    const warnConfig = createPolicyConfig({ enforcement: 'warn' });
    const enforcer = new PolicyEnforcer(warnConfig);
    const task = createMockTask();

    const result = enforcer.checkTaskStart(task, {
      projectPaths: ['/blocked/secret.key'],
    });

    expect(result.passed).toBe(false); // Has violations but should not block
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('should audit but not block tasks in audit enforcement mode', () => {
    const auditConfig = createPolicyConfig({ enforcement: 'audit' });
    const enforcer = new PolicyEnforcer(auditConfig);
    const task = createMockTask();

    const result = enforcer.checkTaskStart(task, {
      projectPaths: ['/blocked/secret.key'],
    });

    expect(result.passed).toBe(true); // Should pass in audit mode
  });

  it('should handle disabled policy correctly', () => {
    const disabledConfig = createPolicyConfig({ enabled: false });
    const enforcer = new PolicyEnforcer(disabledConfig);
    const task = createMockTask();

    const result = enforcer.checkTaskStart(task, {
      projectPaths: ['/any/path.txt'],
    });

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it('should require approval without blocking in warn mode', () => {
    const config = createPolicyConfig({
      enforcement: 'warn',
      approvalRules: {
        enabled: true,
        rules: [
          createApprovalRule({
            conditions: [{ type: 'operation', operations: ['deploy'] }],
          }),
        ],
      },
    });

    const enforcer = new PolicyEnforcer(config);
    const task = createMockTask();

    const result = enforcer.checkTaskStart(task, { operationType: 'deploy' });

    expect(result.requiresApproval).toBe(true);
    expect(result.passed).toBe(false); // Has warnings but doesn't block
  });
});

// ============================================================================
// Task Completion Flow Integration Tests
// ============================================================================

describe('PolicyEnforcer - Task Completion Flow Integration', () => {
  let enforcer: PolicyEnforcer;
  let task: Task;

  beforeEach(() => {
    const config = createPolicyConfig();
    enforcer = new PolicyEnforcer(config);
    task = createMockTask();
  });

  it('should evaluate task policies based on task properties', () => {
    const urgentTask = createMockTask({
      priority: 'urgent',
      effort: 'large',
      usage: {
        inputTokens: 5000,
        outputTokens: 2500,
        totalTokens: 7500,
        estimatedCost: 15.0,
      },
    });

    const result = enforcer.checkTaskStart(urgentTask);

    expect(result.results.length).toBeGreaterThan(0);

    // Should flag urgent priority
    const urgentRule = result.results.find(r => r.ruleId === 'urgent-task-review');
    expect(urgentRule).toBeDefined();
    expect(urgentRule?.severity).toBe('warning');

    // Should flag large effort
    const effortRule = result.results.find(r => r.ruleId === 'large-effort-review');
    expect(effortRule).toBeDefined();
    expect(effortRule?.severity).toBe('info');

    // Should flag high cost
    const costRule = result.results.find(r => r.ruleId === 'high-cost-review');
    expect(costRule).toBeDefined();
    expect(costRule?.severity).toBe('warning');
  });

  it('should flag production workflows as requiring approval', () => {
    const productionTask = createMockTask({
      workflow: 'production-deployment',
    });

    const result = enforcer.checkTaskStart(productionTask);

    const productionRule = result.results.find(r => r.ruleId === 'production-deployment');
    expect(productionRule).toBeDefined();
    expect(productionRule?.severity).toBe('error');
    expect(productionRule?.message).toContain('Production-related workflows require mandatory approval');
  });

  it('should provide comprehensive task evaluation results', () => {
    const complexTask = createMockTask({
      priority: 'urgent',
      workflow: 'deploy-to-production',
      usage: {
        inputTokens: 8000,
        outputTokens: 4000,
        totalTokens: 12000,
        estimatedCost: 25.0,
      },
    });

    const result = enforcer.checkTaskStart(complexTask, {
      projectPaths: ['/project/src/config.js', '/project/.env.production'],
      operationType: 'deploy',
    });

    expect(result.policyName).toBe('test-policy');
    expect(result.evaluatedAt).toBeInstanceOf(Date);
    expect(result.results.length).toBeGreaterThan(1);

    // Should have failed due to strict violations
    expect(result.failedCount).toBeGreaterThan(0);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('should handle empty context gracefully', () => {
    const result = enforcer.checkTaskStart(task);

    expect(result.passed).toBe(true); // No violations with empty context
    expect(result.results).toEqual([]);
    expect(result.requiresApproval).toBe(false);
  });
});

// ============================================================================
// Event Emission Tests
// ============================================================================

describe('PolicyEnforcer - Event Emission', () => {
  let enforcer: PolicyEnforcer;
  let emittedEvents: PolicyViolationEvent[];

  beforeEach(() => {
    const config = createPolicyConfig();
    enforcer = new PolicyEnforcer(config);
    emittedEvents = [];

    enforcer.on('policy:violation', (event) => {
      emittedEvents.push(event);
    });
  });

  it('should emit violation events for path violations', () => {
    enforcer.validateFilePath('/blocked/secret.key', {
      taskId: 'test-task',
      agentId: 'test-agent',
      workflowId: 'test-workflow',
    });

    expect(emittedEvents).toHaveLength(1);

    const event = emittedEvents[0];
    expect(event.type).toBe('policy_violation');
    expect(event.taskId).toBe('test-task');
    expect(event.agentId).toBe('test-agent');
    expect(event.workflowId).toBe('test-workflow');
    expect(event.violation.rule).toBe('path-validation');
  });

  it('should emit violation events for sensitive files', () => {
    enforcer.validateFilePath('/project/src/.env.production', {
      taskId: 'test-task',
    });

    expect(emittedEvents).toHaveLength(1);

    const event = emittedEvents[0];
    expect(event.type).toBe('policy_violation');
    expect(event.violation.rule).toBe('sensitive-path');
    expect(event.violation.context?.requiresApproval).toBe(true);
  });

  it('should include proper event metadata', () => {
    const metadata = { source: 'test', operation: 'file-access' };

    enforcer.validateFilePath('/blocked/file.txt', {
      taskId: 'test-task',
      metadata,
    });

    expect(emittedEvents).toHaveLength(1);

    const event = emittedEvents[0];
    expect(event.metadata).toEqual(metadata);
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it('should not emit events when policy is disabled', () => {
    const disabledConfig = createPolicyConfig({ enabled: false });
    const disabledEnforcer = new PolicyEnforcer(disabledConfig);

    disabledEnforcer.on('policy:violation', (event) => {
      emittedEvents.push(event);
    });

    disabledEnforcer.validateFilePath('/blocked/secret.key');

    expect(emittedEvents).toHaveLength(0);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('PolicyEnforcer - Edge Cases and Error Handling', () => {
  it('should handle malformed glob patterns gracefully', () => {
    const configWithBadPatterns = createPolicyConfig({
      allowedPaths: {
        mode: 'allowlist',
        allow: ['[invalid-pattern'],
        block: ['**{malformed'],
      },
    });

    const enforcer = new PolicyEnforcer(configWithBadPatterns);

    // Should not throw and should treat malformed patterns as non-matching
    expect(() => {
      const violations = enforcer.validateFilePath('/project/src/file.ts');
      expect(violations).toHaveLength(1); // Should be blocked due to allowlist mode
    }).not.toThrow();
  });

  it('should handle content pattern evaluation with invalid regex', () => {
    const configWithBadRegex = createPolicyConfig({
      approvalRules: {
        enabled: true,
        rules: [
          createApprovalRule({
            conditions: [
              {
                type: 'content-pattern',
                patterns: ['[invalid-regex'],
              },
            ],
          }),
        ],
      },
    });

    const enforcer = new PolicyEnforcer(configWithBadRegex);
    const task = createMockTask();

    expect(() => {
      const result = enforcer.checkApprovalRequired(task, 'edit', {
        fileContents: new Map([['test.txt', 'content']]),
      });
      expect(result.required).toBe(false);
    }).not.toThrow();
  });

  it('should handle custom expression evaluation safely', () => {
    const configWithCustomRule = createPolicyConfig({
      approvalRules: {
        enabled: true,
        rules: [
          createApprovalRule({
            conditions: [
              {
                type: 'custom',
                expression: 'malformed expression',
              },
            ],
          }),
        ],
      },
    });

    const enforcer = new PolicyEnforcer(configWithCustomRule);
    const task = createMockTask();

    expect(() => {
      const result = enforcer.checkApprovalRequired(task, 'execute');
      expect(result.required).toBe(false);
    }).not.toThrow();
  });

  it('should handle numeric comparison expressions', () => {
    const configWithNumericRule = createPolicyConfig({
      approvalRules: {
        enabled: true,
        rules: [
          createApprovalRule({
            conditions: [
              {
                type: 'custom',
                expression: '5.5 > 3.0',
              },
            ],
          }),
        ],
      },
    });

    const enforcer = new PolicyEnforcer(configWithNumericRule);
    const task = createMockTask();

    const result = enforcer.checkApprovalRequired(task, 'execute');
    expect(result.required).toBe(true);
  });

  it('should handle empty and undefined values gracefully', () => {
    const minimalConfig = createPolicyConfig({
      allowedPaths: undefined,
      approvalRules: undefined,
    });

    const enforcer = new PolicyEnforcer(minimalConfig);
    const task = createMockTask();

    expect(() => {
      const pathViolations = enforcer.validateFilePath('/any/path.txt');
      expect(pathViolations).toHaveLength(0);

      const approvalResult = enforcer.checkApprovalRequired(task, 'execute');
      expect(approvalResult.required).toBe(false);

      const taskResult = enforcer.checkTaskStart(task);
      expect(taskResult.passed).toBe(true);
    }).not.toThrow();
  });
});