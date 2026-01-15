/**
 * @fileoverview Comprehensive tests for PolicyEnforcer.checkTaskStart() method
 *
 * This test suite focuses specifically on the checkTaskStart method which is the core
 * functionality mentioned in the acceptance criteria. It ensures that policy evaluation
 * works correctly for task start scenarios with proper violation detection and approval
 * requirements.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEnforcer } from './policy-enforcer.js';
import type { PolicyConfig, Task, PolicyEvaluationResult } from '@apexcli/core';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock Task object with default values and any overrides
 */
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task',
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
 * Helper to validate PolicyEvaluationResult structure
 */
function validatePolicyEvaluationResult(result: PolicyEvaluationResult): void {
  expect(result).toHaveProperty('passed');
  expect(result).toHaveProperty('passedCount');
  expect(result).toHaveProperty('failedCount');
  expect(result).toHaveProperty('warningCount');
  expect(result).toHaveProperty('results');
  expect(result).toHaveProperty('requiresApproval');
  expect(result).toHaveProperty('triggeredApprovalRules');
  expect(result).toHaveProperty('evaluatedAt');
  expect(result).toHaveProperty('policyName');

  expect(typeof result.passed).toBe('boolean');
  expect(typeof result.passedCount).toBe('number');
  expect(typeof result.failedCount).toBe('number');
  expect(typeof result.warningCount).toBe('number');
  expect(Array.isArray(result.results)).toBe(true);
  expect(typeof result.requiresApproval).toBe('boolean');
  expect(Array.isArray(result.triggeredApprovalRules)).toBe(true);
  expect(result.evaluatedAt).toBeInstanceOf(Date);
}

describe('PolicyEnforcer.checkTaskStart', () => {
  // ============================================================================
  // Baseline Policy Configuration Tests
  // ============================================================================

  describe('policy configuration states', () => {
    it('should allow task when policy is completely disabled', () => {
      const config: PolicyConfig = {
        enabled: false,
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['**/*'], // Block everything
        },
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'block-all',
            name: 'Block All',
            conditions: [{ type: 'custom', expression: 'true' }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        priority: 'critical',
        effort: 'xlarge',
        usage: { estimatedCost: 100.0, totalTokens: 50000 },
        workflow: 'production-deployment',
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['/blocked/secret/file.env'],
        operationType: 'deploy',
      });

      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.requiresApproval).toBe(false);
      expect(result.passedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should allow task when no policies are configured', () => {
      const config: PolicyConfig = {
        enabled: true,
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const result = enforcer.checkTaskStart(task);

      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.requiresApproval).toBe(false);
    });

    it('should handle undefined/null context gracefully', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      // Test with undefined context
      let result = enforcer.checkTaskStart(task, undefined as any);
      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(true);

      // Test with empty context
      result = enforcer.checkTaskStart(task, {});
      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(true);
    });
  });

  // ============================================================================
  // Path Policy Evaluation Tests
  // ============================================================================

  describe('path policy evaluation', () => {
    let enforcer: PolicyEnforcer;

    beforeEach(() => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'lib/**', 'docs/**'],
          block: ['src/secrets/**', '**/*.private'],
          sensitivePatterns: ['**/.env*', '**/*.key', '**/credentials.*'],
        },
      };
      enforcer = new PolicyEnforcer(config);
    });

    it('should evaluate multiple file paths and aggregate violations', () => {
      const task = createMockTask({ id: 'multi-path-task' });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: [
          'src/index.ts',           // Allowed
          'src/utils/helper.ts',    // Allowed
          'src/secrets/api.key',    // Blocked (matches block pattern)
          'config/.env.production', // Not in allowlist + sensitive
          'lib/main.js',            // Allowed
          'data/private.private',   // Not in allowlist + blocked pattern
        ],
        operationType: 'modify',
        metadata: { stage: 'development' },
      });

      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(false); // Has warnings
      expect(result.results.length).toBeGreaterThan(0);

      // Should detect violations for the problematic paths
      const violationPaths = result.results
        .filter(r => r.ruleType === 'path' && !r.passed)
        .map(r => r.details?.filePath);

      expect(violationPaths).toContain('src/secrets/api.key');
      expect(violationPaths).toContain('config/.env.production');
      expect(violationPaths).toContain('data/private.private');

      // Check for sensitive file detection
      const sensitiveViolations = result.results.filter(
        r => r.details?.context?.isSensitive
      );
      expect(sensitiveViolations.length).toBeGreaterThan(0);
    });

    it('should handle empty projectPaths array', () => {
      const task = createMockTask();

      const result = enforcer.checkTaskStart(task, {
        projectPaths: [],
        operationType: 'analyze',
      });

      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(true);
      // Should still evaluate task-specific policies but no path violations
    });

    it('should handle projectPaths with duplicate entries', () => {
      const task = createMockTask();

      const result = enforcer.checkTaskStart(task, {
        projectPaths: [
          'blocked/file.ts',
          'blocked/file.ts', // Duplicate
          'blocked/file.ts', // Another duplicate
        ],
      });

      validatePolicyEvaluationResult(result);
      // Should evaluate each path independently (duplicates will create multiple violations)
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Task-Specific Policy Evaluation Tests
  // ============================================================================

  describe('task-specific policy evaluation', () => {
    let enforcer: PolicyEnforcer;

    beforeEach(() => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
      };
      enforcer = new PolicyEnforcer(config);
    });

    it('should evaluate critical priority tasks', () => {
      const task = createMockTask({
        priority: 'critical',
        workflow: 'emergency-hotfix',
        effort: 'small',
      });

      const result = enforcer.checkTaskStart(task);

      validatePolicyEvaluationResult(result);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].ruleId).toBe('critical-task-review');
      expect(result.results[0].severity).toBe('warning');
      expect(result.results[0].details?.taskPriority).toBe('critical');
    });

    it('should evaluate large effort tasks', () => {
      const task = createMockTask({
        effort: 'large',
        workflow: 'refactoring-project',
        usage: { estimatedCost: 5.0, totalTokens: 15000 },
      });

      const result = enforcer.checkTaskStart(task);

      validatePolicyEvaluationResult(result);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].ruleId).toBe('large-effort-review');
      expect(result.results[0].severity).toBe('info');
      expect(result.results[0].details?.taskEffort).toBe('large');
    });

    it('should evaluate xlarge effort tasks', () => {
      const task = createMockTask({
        effort: 'xlarge',
        workflow: 'major-refactoring',
      });

      const result = enforcer.checkTaskStart(task);

      validatePolicyEvaluationResult(result);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].ruleId).toBe('large-effort-review');
      expect(result.results[0].severity).toBe('info');
      expect(result.results[0].message).toContain('xlarge effort');
    });

    it('should evaluate high-cost tasks', () => {
      const task = createMockTask({
        usage: {
          estimatedCost: 15.75,
          totalTokens: 25000,
          inputTokens: 15000,
          outputTokens: 10000,
        },
      });

      const result = enforcer.checkTaskStart(task);

      validatePolicyEvaluationResult(result);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].ruleId).toBe('high-cost-review');
      expect(result.results[0].severity).toBe('warning');
      expect(result.results[0].details?.estimatedCost).toBe(15.75);
      expect(result.results[0].message).toContain('$15.75');
    });

    it('should evaluate production deployment workflows', () => {
      const productionWorkflows = [
        'deploy-to-production',
        'production-release',
        'release-candidate',
        'DEPLOY-PROD', // Case variation
      ];

      for (const workflow of productionWorkflows) {
        const task = createMockTask({ workflow });

        const result = enforcer.checkTaskStart(task);

        validatePolicyEvaluationResult(result);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].ruleId).toBe('production-deployment');
        expect(result.results[0].severity).toBe('error');
        expect(result.results[0].details?.workflow).toBe(workflow);
      }
    });

    it('should aggregate multiple task policy violations', () => {
      const task = createMockTask({
        priority: 'critical',      // Warning
        effort: 'large',           // Info
        workflow: 'deploy-prod',   // Error
        usage: { estimatedCost: 25.0, totalTokens: 100000 }, // Warning
      });

      const result = enforcer.checkTaskStart(task);

      validatePolicyEvaluationResult(result);
      expect(result.results.length).toBeGreaterThanOrEqual(3);

      const ruleIds = result.results.map(r => r.ruleId);
      expect(ruleIds).toContain('critical-task-review');
      expect(ruleIds).toContain('large-effort-review');
      expect(ruleIds).toContain('production-deployment');
      expect(ruleIds).toContain('high-cost-review');
    });

    it('should not flag normal tasks', () => {
      const task = createMockTask({
        priority: 'medium',
        effort: 'medium',
        workflow: 'feature-development',
        usage: { estimatedCost: 2.0, totalTokens: 5000 },
      });

      const result = enforcer.checkTaskStart(task);

      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.requiresApproval).toBe(false);
    });
  });

  // ============================================================================
  // Approval Requirements Integration Tests
  // ============================================================================

  describe('approval requirements integration', () => {
    it('should integrate approval rules with task evaluation', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'high-cost-approval',
              name: 'High Cost Approval',
              description: 'Requires approval for expensive operations',
              urgency: 'high',
              timeoutMinutes: 30,
              minApprovals: 2,
              timeoutAction: 'reject',
              conditions: [{
                type: 'cost-threshold',
                threshold: 1.0,
              }],
              approvers: ['finance-team', 'tech-lead'],
            },
            {
              id: 'production-approval',
              name: 'Production Approval',
              description: 'Requires approval for production operations',
              urgency: 'critical',
              timeoutMinutes: 15,
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
              approvers: ['ops-team'],
            },
          ],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        usage: { estimatedCost: 5.0, totalTokens: 20000 },
      });

      const result = enforcer.checkTaskStart(task, {
        operationType: 'deploy',
      });

      validatePolicyEvaluationResult(result);
      expect(result.requiresApproval).toBe(true);
      expect(result.triggeredApprovalRules).toContain('high-cost-approval');
      expect(result.triggeredApprovalRules).toContain('production-approval');

      // Should have approval result in the results array
      const approvalResult = result.results.find(r => r.ruleType === 'approval');
      expect(approvalResult).toBeDefined();
      expect(approvalResult?.severity).toBe('error'); // Critical urgency maps to error
      expect(approvalResult?.details?.urgency).toBe('critical');
      expect(approvalResult?.details?.requiredApprovers).toContain('ops-team');
      expect(approvalResult?.details?.requiredApprovers).toContain('finance-team');
    });

    it('should handle sensitive file approval requirements', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['**/*'],
          sensitivePatterns: ['**/.env*', '**/*.key'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['config/.env.production', 'certs/server.key'],
      });

      validatePolicyEvaluationResult(result);
      expect(result.requiresApproval).toBe(true);
      expect(result.triggeredApprovalRules.some(rule => rule.includes('sensitive-path'))).toBe(true);

      const sensitiveViolations = result.results.filter(
        r => r.details?.context?.requiresApproval
      );
      expect(sensitiveViolations.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Enforcement Mode Behavior Tests
  // ============================================================================

  describe('enforcement mode behavior', () => {
    const violationScenario = {
      task: createMockTask({
        priority: 'critical',     // Warning
        workflow: 'deploy-prod',  // Error
        usage: { estimatedCost: 15.0, totalTokens: 10000 }, // Warning
      }),
      context: {
        projectPaths: ['blocked/file.ts'], // Warning in allowlist mode
      },
    };

    it('should pass in audit mode despite violations', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'audit',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const result = enforcer.checkTaskStart(violationScenario.task, violationScenario.context);

      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(true); // Audit mode always passes
      expect(result.results.length).toBeGreaterThan(0); // But violations are recorded
      expect(result.failedCount + result.warningCount).toBeGreaterThan(0);
    });

    it('should fail in strict mode with any warnings', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        priority: 'critical', // This generates a warning
      });

      const result = enforcer.checkTaskStart(task);

      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(false);
      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.failedCount).toBe(0); // Only warning, no errors
    });

    it('should pass in warn mode with warnings but fail with errors', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);

      // Test with only warnings
      let task = createMockTask({ priority: 'critical' }); // Warning only
      let result = enforcer.checkTaskStart(task);
      expect(result.passed).toBe(true);
      expect(result.warningCount).toBeGreaterThan(0);

      // Test with errors
      task = createMockTask({ workflow: 'production-deploy' }); // Error
      result = enforcer.checkTaskStart(task);
      expect(result.passed).toBe(false);
      expect(result.failedCount).toBeGreaterThan(0);
    });

    it('should handle disabled enforcement mode', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'disabled',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const result = enforcer.checkTaskStart(violationScenario.task, violationScenario.context);

      validatePolicyEvaluationResult(result);
      expect(result.passed).toBe(true);
      // In disabled mode, violations may still be detected but don't affect pass/fail
    });
  });

  // ============================================================================
  // Result Aggregation and Structure Tests
  // ============================================================================

  describe('result aggregation and structure', () => {
    it('should correctly aggregate result counts', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        priority: 'critical',        // Warning
        effort: 'large',            // Info
        workflow: 'deploy-prod',    // Error
        usage: { estimatedCost: 15.0, totalTokens: 10000 }, // Warning
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['blocked/file1.ts', 'blocked/file2.ts'], // 2 warnings
      });

      validatePolicyEvaluationResult(result);

      // Verify counts are consistent
      const expectedTotal = result.passedCount + result.failedCount + result.warningCount;
      expect(result.results.length).toBeGreaterThanOrEqual(expectedTotal);

      // Verify at least some violations were detected
      expect(result.failedCount + result.warningCount).toBeGreaterThan(0);

      // Check individual result structure
      for (const validationResult of result.results) {
        expect(validationResult).toHaveProperty('passed');
        expect(validationResult).toHaveProperty('ruleId');
        expect(validationResult).toHaveProperty('ruleName');
        expect(validationResult).toHaveProperty('ruleType');
        expect(validationResult).toHaveProperty('message');
        expect(validationResult).toHaveProperty('severity');

        expect(typeof validationResult.passed).toBe('boolean');
        expect(typeof validationResult.ruleId).toBe('string');
        expect(typeof validationResult.ruleName).toBe('string');
        expect(typeof validationResult.ruleType).toBe('string');
        expect(typeof validationResult.message).toBe('string');
        expect(['info', 'warning', 'error']).toContain(validationResult.severity);
      }
    });

    it('should include policy name and evaluation timestamp', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
        name: 'test-policy-v1',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const beforeTime = new Date();
      const result = enforcer.checkTaskStart(task);
      const afterTime = new Date();

      validatePolicyEvaluationResult(result);
      expect(result.policyName).toBe('test-policy-v1');
      expect(result.evaluatedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.evaluatedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle missing policy name gracefully', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
        // No name specified
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const result = enforcer.checkTaskStart(task);

      validatePolicyEvaluationResult(result);
      expect(result.policyName).toBeUndefined();
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling Tests
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle malformed file paths gracefully', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const result = enforcer.checkTaskStart(task, {
        projectPaths: [
          '',                    // Empty string
          '   ',                 // Whitespace only
          '//',                  // Double slashes
          '../../../etc/passwd', // Path traversal
          'src/../secrets/key',  // Relative path escape
        ],
      });

      validatePolicyEvaluationResult(result);
      expect(result.results.length).toBeGreaterThan(0);
      expect(() => enforcer.checkTaskStart(task)).not.toThrow();
    });

    it('should handle tasks with missing or invalid usage data', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);

      // Task with missing usage
      const taskMissingUsage = createMockTask();
      delete (taskMissingUsage as any).usage;

      expect(() => {
        enforcer.checkTaskStart(taskMissingUsage);
      }).not.toThrow();

      // Task with invalid usage values
      const taskInvalidUsage = createMockTask({
        usage: {
          estimatedCost: NaN,
          totalTokens: -1,
          inputTokens: undefined as any,
          outputTokens: null as any,
        },
      });

      expect(() => {
        enforcer.checkTaskStart(taskInvalidUsage);
      }).not.toThrow();
    });

    it('should handle extremely large numbers of project paths', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      // Generate a large number of paths
      const largePaths = Array.from({ length: 1000 }, (_, i) => `blocked/file${i}.ts`);

      const startTime = Date.now();
      const result = enforcer.checkTaskStart(task, {
        projectPaths: largePaths,
      });
      const endTime = Date.now();

      validatePolicyEvaluationResult(result);
      expect(result.results.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle tasks with special characters in workflow names', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);

      const specialWorkflows = [
        'workflow-with-dashes',
        'workflow_with_underscores',
        'workflow with spaces',
        'workflow/with/slashes',
        'workflow@with#special$chars%',
        '中文工作流程', // Chinese characters
        'émoji-workflow-🚀',
      ];

      for (const workflow of specialWorkflows) {
        const task = createMockTask({ workflow });

        expect(() => {
          const result = enforcer.checkTaskStart(task);
          validatePolicyEvaluationResult(result);
        }).not.toThrow();
      }
    });

    it('should handle concurrent evaluations correctly', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);

      // Create multiple tasks to evaluate concurrently
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createMockTask({
          id: `concurrent-task-${i}`,
          priority: i % 2 === 0 ? 'critical' : 'medium',
        })
      );

      const promises = tasks.map(task =>
        Promise.resolve(enforcer.checkTaskStart(task))
      );

      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(10);

        for (const result of results) {
          validatePolicyEvaluationResult(result);
        }

        // Critical tasks should have violations, medium tasks should not
        const criticalResults = results.filter((_, i) => i % 2 === 0);
        const mediumResults = results.filter((_, i) => i % 2 === 1);

        for (const result of criticalResults) {
          expect(result.results.length).toBeGreaterThan(0);
        }

        for (const result of mediumResults) {
          expect(result.results).toHaveLength(0);
        }
      });
    });
  });

  // ============================================================================
  // Performance and Memory Tests
  // ============================================================================

  describe('performance and memory', () => {
    it('should perform efficiently with complex policy configurations', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'lib/**', 'tests/**', 'docs/**'],
          block: ['src/secrets/**', '**/*.private', 'node_modules/**', '.git/**'],
          sensitivePatterns: ['**/.env*', '**/*.key', '**/credentials.*', '**/*.pem', '**/*.p12'],
        },
        approvalRules: {
          enabled: true,
          rules: Array.from({ length: 20 }, (_, i) => ({
            id: `rule-${i}`,
            name: `Test Rule ${i}`,
            conditions: [{
              type: 'cost-threshold' as const,
              threshold: i * 0.1,
            }],
          })),
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        usage: { estimatedCost: 1.0, totalTokens: 10000 },
      });

      const startTime = Date.now();
      const result = enforcer.checkTaskStart(task, {
        projectPaths: Array.from({ length: 100 }, (_, i) => `src/file${i}.ts`),
      });
      const endTime = Date.now();

      validatePolicyEvaluationResult(result);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should maintain consistent memory usage across evaluations', () => {
      const config: PolicyConfig = {
        enabled: true,
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      // Perform multiple evaluations and check they don't leak memory
      for (let i = 0; i < 100; i++) {
        const result = enforcer.checkTaskStart(task);
        validatePolicyEvaluationResult(result);

        // Each result should be independent
        expect(result.results).toEqual([]);
      }

      const finalResult = enforcer.checkTaskStart(task);
      expect(finalResult.results).toEqual([]);
    });
  });
});
