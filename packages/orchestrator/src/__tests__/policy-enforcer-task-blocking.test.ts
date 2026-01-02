/**
 * @fileoverview Task Blocking Tests for PolicyEnforcer Integration
 *
 * This test suite focuses specifically on the task blocking behavior when
 * PolicyEnforcer.checkTaskStart() detects violations with error severity.
 * Tests cover various enforcement modes, violation types, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PolicyEnforcer } from '../policy/policy-enforcer';
import type {
  PolicyConfig,
  Task,
  PolicyEvaluationResult,
} from '@apexcli/core';

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: randomUUID(),
  title: 'Test Task',
  description: 'A test task for policy enforcement testing',
  status: 'pending',
  agent: 'test-agent',
  workflow: 'test-workflow',
  priority: 'medium',
  effort: 'medium',
  context: {},
  usage: {
    totalTokens: 1000,
    inputTokens: 600,
    outputTokens: 400,
    estimatedCost: 1.0,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('PolicyEnforcer Task Blocking Behavior', () => {
  describe('Enforcement Mode Effects on Task Blocking', () => {
    it('should block task in strict mode when any violation occurs', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['**/*.secret'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        priority: 'urgent', // Generates warning in evaluateTaskPolicies
        usage: { estimatedCost: 1.0, totalTokens: 1000, inputTokens: 600, outputTokens: 400 },
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['config/app.secret'], // Blocked path
        operationType: 'modify',
      });

      // In strict mode, should fail on any violation (error OR warning)
      expect(result.passed).toBe(false);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.failedCount + result.warningCount).toBeGreaterThan(0);
    });

    it('should allow task in warn mode with only warnings', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        priority: 'urgent', // Generates warning but not error
        usage: { estimatedCost: 2.0, totalTokens: 2000, inputTokens: 1200, outputTokens: 800 },
      });

      const result = enforcer.checkTaskStart(task);

      // Should pass in warn mode with only warnings
      expect(result.passed).toBe(true);
      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.failedCount).toBe(0);
    });

    it('should block task in warn mode when error-level violations exist', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        workflow: 'production-deployment', // Triggers error-level violation
        usage: { estimatedCost: 5.0, totalTokens: 8000, inputTokens: 4800, outputTokens: 3200 },
      });

      const result = enforcer.checkTaskStart(task);

      // Should fail even in warn mode with error-level violations
      expect(result.passed).toBe(false);
      expect(result.failedCount).toBeGreaterThan(0);
    });

    it('should always pass in audit mode regardless of violations', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'audit',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['**/*'], // Block everything to force violations
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        workflow: 'production-deployment', // Error-level violation
        priority: 'urgent',               // Warning-level violation
        effort: 'xlarge',                // Info-level violation
        usage: { estimatedCost: 50.0, totalTokens: 100000, inputTokens: 60000, outputTokens: 40000 },
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['blocked/file.ts'],
        operationType: 'deploy',
      });

      // Should pass in audit mode despite multiple violations
      expect(result.passed).toBe(true);
      expect(result.results.length).toBeGreaterThan(0); // Violations are still recorded
    });
  });

  describe('Path Validation Blocking Behavior', () => {
    it('should block task when accessing blocked file patterns', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'tests/**'],
          block: ['src/secrets/**', '**/*.key', '**/.env*'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const blockedPaths = [
        'src/secrets/api-key.ts',
        'config/database.key',
        '.env.production',
        'src/secrets/nested/secret.json',
      ];

      for (const blockedPath of blockedPaths) {
        const result = enforcer.checkTaskStart(task, {
          projectPaths: [blockedPath],
        });

        expect(result.passed).toBe(false);
        expect(result.failedCount).toBeGreaterThan(0);

        const pathViolation = result.results.find(r => r.ruleType === 'path');
        expect(pathViolation).toBeDefined();
        expect(pathViolation?.details?.filePath).toBe(blockedPath);
      }
    });

    it('should block task when paths not in allowlist', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'tests/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const disallowedPaths = [
        'config/database.yml',
        'node_modules/package/index.js',
        'build/output.js',
        'docs/README.md',
      ];

      for (const disallowedPath of disallowedPaths) {
        const result = enforcer.checkTaskStart(task, {
          projectPaths: [disallowedPath],
        });

        expect(result.passed).toBe(false);
        expect(result.failedCount).toBeGreaterThan(0);
      }
    });

    it('should handle sensitive file patterns correctly', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['**/*'], // Allow all paths
          sensitivePatterns: ['**/.env*', '**/config/production.*', '**/*.key'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const sensitivePaths = [
        '.env',
        '.env.production',
        'config/production.yml',
        'certificates/server.key',
      ];

      for (const sensitivePath of sensitivePaths) {
        const result = enforcer.checkTaskStart(task, {
          projectPaths: [sensitivePath],
        });

        // Sensitive patterns create violations but may not block depending on severity
        expect(result.results.length).toBeGreaterThan(0);

        const sensitiveViolation = result.results.find(r =>
          r.ruleId === 'sensitive-path' || r.details?.context?.isSensitive
        );
        expect(sensitiveViolation).toBeDefined();
      }
    });

    it('should handle multiple paths with mixed violations', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'tests/**'],
          block: ['src/secrets/**'],
          sensitivePatterns: ['**/.env*'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const mixedPaths = [
        'src/components/Button.tsx',  // Allowed
        'src/utils/helpers.ts',       // Allowed
        'src/secrets/api.key',        // Blocked
        'config/.env.production',     // Not in allowlist + sensitive
        'tests/unit/helpers.test.ts', // Allowed
      ];

      const result = enforcer.checkTaskStart(task, {
        projectPaths: mixedPaths,
      });

      expect(result.passed).toBe(false);
      expect(result.failedCount).toBeGreaterThan(0);

      // Should have violations for blocked and disallowed paths
      const violations = result.results.filter(r => r.ruleType === 'path');
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('Cost and Resource Based Blocking', () => {
    it('should block high-cost tasks based on threshold', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'cost-threshold-rule',
              name: 'Cost Threshold',
              enabled: true,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 5.0,
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 60,
              minApprovals: 1,
            },
          ],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      const lowCostTask = createMockTask({
        usage: { estimatedCost: 3.0, totalTokens: 3000, inputTokens: 1800, outputTokens: 1200 },
      });

      const highCostTask = createMockTask({
        usage: { estimatedCost: 10.0, totalTokens: 20000, inputTokens: 12000, outputTokens: 8000 },
      });

      // Low cost task should pass
      const lowCostResult = enforcer.checkTaskStart(lowCostTask);
      expect(lowCostResult.requiresApproval).toBe(false);
      expect(lowCostResult.passed).toBe(true);

      // High cost task should require approval
      const highCostResult = enforcer.checkTaskStart(highCostTask);
      expect(highCostResult.requiresApproval).toBe(true);
      expect(highCostResult.triggeredApprovalRules).toContain('cost-threshold-rule');
    });

    it('should block tasks with high token usage', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'token-threshold-rule',
              name: 'Token Threshold',
              enabled: true,
              conditions: [
                {
                  type: 'token-threshold',
                  threshold: 50000,
                },
              ],
              urgency: 'high',
              timeoutMinutes: 30,
              minApprovals: 2,
            },
          ],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      const highTokenTask = createMockTask({
        usage: { estimatedCost: 5.0, totalTokens: 75000, inputTokens: 45000, outputTokens: 30000 },
      });

      const result = enforcer.checkTaskStart(highTokenTask);

      expect(result.requiresApproval).toBe(true);
      expect(result.triggeredApprovalRules).toContain('token-threshold-rule');

      const approvalResult = result.results.find(r => r.ruleType === 'approval');
      expect(approvalResult).toBeDefined();
      expect(approvalResult?.details?.urgency).toBe('high');
      expect(approvalResult?.details?.minApprovals).toBe(2);
    });
  });

  describe('Workflow-Based Blocking', () => {
    it('should block production deployment workflows', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);

      const productionWorkflows = [
        'production-deployment',
        'deploy-prod',
        'release-to-production',
        'production-rollout',
      ];

      for (const workflow of productionWorkflows) {
        const task = createMockTask({ workflow });
        const result = enforcer.checkTaskStart(task);

        // Should detect production workflow and create error-level violation
        expect(result.passed).toBe(false);
        expect(result.failedCount).toBeGreaterThan(0);

        const productionViolation = result.results.find(r =>
          r.ruleId === 'production-deployment'
        );
        expect(productionViolation).toBeDefined();
        expect(productionViolation?.severity).toBe('error');
      }
    });

    it('should block urgent priority tasks with appropriate severity', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'strict', // Strict mode blocks on warnings
      };

      const enforcer = new PolicyEnforcer(config);

      const urgentTask = createMockTask({
        priority: 'urgent',
        workflow: 'emergency-fix',
      });

      const result = enforcer.checkTaskStart(urgentTask);

      // In the current implementation, urgent tasks generate warnings, not errors
      // So in strict mode they should be blocked
      expect(result.passed).toBe(false);
      expect(result.warningCount).toBeGreaterThan(0);

      const urgentViolation = result.results.find(r =>
        r.ruleId === 'urgent-task-review'
      );
      expect(urgentViolation).toBeDefined();
      expect(urgentViolation?.severity).toBe('warning');
    });
  });

  describe('Complex Violation Scenarios', () => {
    it('should handle tasks with multiple simultaneous violations', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['**/*.secret'],
        },
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'high-cost-rule',
              name: 'High Cost Rule',
              enabled: true,
              conditions: [{ type: 'cost-threshold', threshold: 5.0 }],
              urgency: 'normal',
              timeoutMinutes: 60,
              minApprovals: 1,
            },
          ],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      const complexTask = createMockTask({
        workflow: 'production-deployment',    // Error: production workflow
        priority: 'urgent',                  // Warning: urgent priority
        effort: 'xlarge',                    // Info: large effort
        usage: { estimatedCost: 20.0, totalTokens: 50000, inputTokens: 30000, outputTokens: 20000 }, // Cost violation + high-cost review
      });

      const result = enforcer.checkTaskStart(complexTask, {
        projectPaths: [
          'config/secrets.key',    // Blocked path
          'data/export.csv',       // Not in allowlist
        ],
      });

      // Should fail due to error-level violations
      expect(result.passed).toBe(false);
      expect(result.failedCount).toBeGreaterThan(0);
      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.results.length).toBeGreaterThan(3); // Multiple violations

      // Verify different violation types are present
      const ruleTypes = new Set(result.results.map(r => r.ruleType));
      expect(ruleTypes.has('path')).toBe(true);
      expect(ruleTypes.has('approval')).toBe(true);
    });

    it('should aggregate violation counts correctly', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      const task = createMockTask({
        priority: 'urgent',    // Warning
        effort: 'large',       // Info
        workflow: 'deploy-prod', // Error
        usage: { estimatedCost: 15.0, totalTokens: 25000, inputTokens: 15000, outputTokens: 10000 }, // Warning
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: [
          'blocked/file1.ts',  // Error (not in allowlist)
          'blocked/file2.ts',  // Error (not in allowlist)
          'blocked/file3.ts',  // Error (not in allowlist)
        ],
      });

      // Verify counts are accurate
      expect(result.passedCount).toBe(0);
      expect(result.failedCount).toBeGreaterThan(0);  // Path violations + production deployment
      expect(result.warningCount).toBeGreaterThan(0); // Urgent priority + high cost
      expect(result.passedCount + result.failedCount + result.warningCount).toBe(result.results.length);
    });
  });

  describe('Policy Disabled and Error Handling', () => {
    it('should allow all tasks when policy is disabled', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: false,
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['**/*'], // Would block everything if enabled
        },
      };

      const enforcer = new PolicyEnforcer(config);

      const problematicTask = createMockTask({
        workflow: 'production-deployment',
        priority: 'urgent',
        effort: 'xlarge',
        usage: { estimatedCost: 100.0, totalTokens: 200000, inputTokens: 120000, outputTokens: 80000 },
      });

      const result = enforcer.checkTaskStart(problematicTask, {
        projectPaths: ['completely/blocked/file.ts'],
        operationType: 'deploy',
      });

      // Should pass when policy is disabled
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.failedCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should handle tasks with missing or malformed usage data', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'cost-rule',
              name: 'Cost Rule',
              enabled: true,
              conditions: [{ type: 'cost-threshold', threshold: 5.0 }],
              urgency: 'normal',
              timeoutMinutes: 60,
              minApprovals: 1,
            },
          ],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      // Task with missing usage
      const taskWithoutUsage = createMockTask();
      delete (taskWithoutUsage as any).usage;

      expect(() => enforcer.checkTaskStart(taskWithoutUsage)).not.toThrow();

      // Task with invalid usage values
      const taskWithInvalidUsage = createMockTask({
        usage: {
          estimatedCost: -1,    // Invalid negative cost
          totalTokens: null as any,
          inputTokens: undefined as any,
          outputTokens: 'invalid' as any,
        },
      });

      expect(() => enforcer.checkTaskStart(taskWithInvalidUsage)).not.toThrow();
    });

    it('should handle extremely large violation lists efficiently', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      // Create task with many blocked paths
      const manyPaths = Array.from({ length: 1000 }, (_, i) => `blocked/file${i}.ts`);
      const task = createMockTask();

      const startTime = Date.now();
      const result = enforcer.checkTaskStart(task, {
        projectPaths: manyPaths,
      });
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
    });
  });

  describe('Event Emission During Blocking', () => {
    it('should emit policy violation events even when task is blocked', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['**/*.secret'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violationEvents: any[] = [];

      // Listen for policy violation events
      enforcer.on('policy:violation', (event) => {
        violationEvents.push(event);
      });

      const task = createMockTask();

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['config/secret.key'],
      });

      expect(result.passed).toBe(false);
      expect(violationEvents.length).toBeGreaterThan(0);

      const event = violationEvents[0];
      expect(event.type).toBe('policy_violation');
      expect(event.violation).toBeDefined();
      expect(event.violation.ruleId).toBe('path-validation');
    });
  });
});