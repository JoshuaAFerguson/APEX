/**
 * @fileoverview Additional edge case tests for PolicyEnforcer to achieve >80% coverage
 *
 * Tests cover:
 * - Edge cases in checkTaskStart method
 * - Private method edge cases
 * - Complex policy scenarios
 * - Error recovery scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEnforcer, createPolicyEnforcer } from './policy-enforcer.js';
import type { PolicyConfig, PolicyViolation, Task } from '@apexcli/core';

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

describe('PolicyEnforcer Edge Cases', () => {
  // ============================================================================
  // checkTaskStart Edge Cases
  // ============================================================================

  describe('checkTaskStart edge cases', () => {
    it('should handle tasks with missing usage information', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        usage: {} as any, // Missing required fields
      });

      const result = enforcer.checkTaskStart(task);

      expect(result.passed).toBe(true);
      expect(result.results).toEqual([]);
    });

    it('should handle tasks with undefined/null values', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        priority: undefined as any,
        effort: null as any,
        workflow: '',
      });

      const result = enforcer.checkTaskStart(task);

      expect(result.passed).toBe(true);
      // Should not flag tasks with undefined priority/effort
      expect(result.results).toEqual([]);
    });

    it('should handle edge case priority values', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        priority: 'urgent' as any, // Edge case priority
      });

      const result = enforcer.checkTaskStart(task);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].ruleId).toBe('urgent-task-review');
    });

    it('should handle xl effort edge case', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        effort: 'xl', // Extra large effort
      });

      const result = enforcer.checkTaskStart(task);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].ruleId).toBe('large-effort-review');
      expect(result.results[0].message).toContain('xl effort');
    });

    it('should handle exactly threshold cost values', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        usage: { estimatedCost: 10.0, totalTokens: 1000 }, // Exactly at threshold
      });

      const result = enforcer.checkTaskStart(task);

      // Should not flag exactly at threshold (> 10.0 means 10.01+)
      const costRule = result.results.find(r => r.ruleId === 'high-cost-review');
      expect(costRule).toBeUndefined();
    });

    it('should handle workflows with various production keywords', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);

      const workflows = [
        'DEPLOY-prod',
        'release-v1.0',
        'Production-hotfix',
        'deploy-staging', // Should trigger
        'release-candidate', // Should trigger
      ];

      workflows.forEach(workflow => {
        const task = createMockTask({ workflow });
        const result = enforcer.checkTaskStart(task);

        const prodRule = result.results.find(r => r.ruleId === 'production-deployment');
        expect(prodRule).toBeDefined();
        expect(prodRule?.details?.workflow).toBe(workflow);
      });
    });

    it('should handle sensitive patterns with legacy configuration', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['**/*'],
          // Use legacy sensitive property
          sensitive: ['.env*', '**/*.secret']
        } as any, // Cast to any to use legacy property
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['.env.local', 'config/db.secret'],
      });

      expect(result.results.length).toBeGreaterThan(0);
      const violations = result.results.filter(r => r.ruleType === 'path');
      expect(violations.length).toBe(2); // Both files should be flagged as sensitive
    });

    it('should handle context with missing optional properties', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      // Context with only metadata, no paths
      const result = enforcer.checkTaskStart(task, {
        metadata: { source: 'cli' },
      });

      expect(result.passed).toBe(true);
      expect(result.results).toEqual([]);
    });
  });

  // ============================================================================
  // Error Handling Edge Cases
  // ============================================================================

  describe('error handling edge cases', () => {
    it('should handle invalid glob patterns in allowedPaths', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['[unclosed', 'src/**', '**/test['],
          block: ['**/invalid[pattern'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      // Should not throw on invalid patterns, just ignore them
      expect(() => {
        enforcer.validateFilePath('src/index.ts');
      }).not.toThrow();

      const violations = enforcer.validateFilePath('src/index.ts');
      expect(violations).toEqual([]); // Should be allowed by 'src/**'
    });

    it('should handle empty or whitespace-only paths', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      const testPaths = ['', '   ', '\t', '\n', '  \n\t  '];
      testPaths.forEach(path => {
        const violations = enforcer.validateFilePath(path);
        expect(violations).toHaveLength(1);
        expect(violations[0].resource).toBe(''); // Should be normalized to empty
      });
    });

    it('should handle patterns with no patterns defined', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: [],
          block: [],
          sensitivePatterns: [],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violations = enforcer.validateFilePath('any/file.ts');

      expect(violations).toEqual([]); // Empty allow list should allow everything
    });

    it('should handle tasks with extreme values', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        usage: {
          estimatedCost: Number.MAX_SAFE_INTEGER,
          totalTokens: Number.MAX_SAFE_INTEGER,
          inputTokens: 0,
          outputTokens: 0,
        },
      });

      const result = enforcer.checkTaskStart(task);

      expect(result.results.length).toBeGreaterThan(0);
      const costRule = result.results.find(r => r.ruleId === 'high-cost-review');
      expect(costRule).toBeDefined();
    });
  });

  // ============================================================================
  // Path Normalization Edge Cases
  // ============================================================================

  describe('path normalization edge cases', () => {
    let enforcer: PolicyEnforcer;

    beforeEach(() => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };
      enforcer = new PolicyEnforcer(config);
    });

    it('should handle various path separators and formats', () => {
      const pathVariations = [
        'src/file.ts',
        'src\\file.ts',        // Windows style
        'src//file.ts',        // Double slash
        './src/file.ts',       // Relative with dot
        'src/./file.ts',       // Dot in path
        'src/../src/file.ts',  // Parent directory navigation
        'src/file.ts/',        // Trailing slash
      ];

      pathVariations.forEach(path => {
        const violations = enforcer.validateFilePath(path);
        expect(violations).toEqual([]); // All should be normalized and allowed
      });
    });

    it('should handle unicode and special characters in paths', () => {
      const unicodePaths = [
        'src/файл.ts',          // Cyrillic
        'src/文件.ts',           // Chinese
        'src/file with spaces.ts',
        'src/file-with-dashes.ts',
        'src/file_with_underscores.ts',
        'src/file.with.dots.ts',
        'src/file+plus.ts',
        'src/file(parens).ts',
        'src/file[brackets].ts',
      ];

      unicodePaths.forEach(path => {
        const violations = enforcer.validateFilePath(path);
        expect(violations).toEqual([]); // All should be normalized and allowed
      });
    });

    it('should handle very long path names', () => {
      const longFileName = 'very'.repeat(100) + '.ts'; // 400+ char filename
      const longPath = `src/${longFileName}`;

      const violations = enforcer.validateFilePath(longPath);
      expect(violations).toEqual([]);
    });
  });

  // ============================================================================
  // Event Emission Edge Cases
  // ============================================================================

  describe('event emission edge cases', () => {
    it('should emit events with unique IDs even for identical paths', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: any[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      // Validate same path multiple times
      enforcer.validateFilePath('blocked/file.ts');
      enforcer.validateFilePath('blocked/file.ts');
      enforcer.validateFilePath('blocked/file.ts');

      expect(events).toHaveLength(3);
      expect(events[0].id).not.toBe(events[1].id);
      expect(events[1].id).not.toBe(events[2].id);
    });

    it('should handle event listeners that throw errors', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      // Add a listener that throws
      enforcer.on('policy:violation', () => {
        throw new Error('Listener error');
      });

      // Should not prevent violation detection
      expect(() => {
        const violations = enforcer.validateFilePath('blocked/file.ts');
        expect(violations).toHaveLength(1);
      }).not.toThrow(); // PolicyEnforcer should handle listener errors gracefully
    });

    it('should handle context with nested objects and arrays', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: any[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const complexContext = {
        taskId: 'task-123',
        metadata: {
          nested: { deeply: { value: 'test' } },
          array: [1, 2, 3],
          circular: {} as any,
        },
      };
      complexContext.metadata.circular.self = complexContext.metadata;

      enforcer.validateFilePath('blocked/file.ts', complexContext);

      expect(events).toHaveLength(1);
      expect(events[0].taskId).toBe('task-123');
      expect(events[0].metadata.nested.deeply.value).toBe('test');
    });
  });

  // ============================================================================
  // Factory Function Edge Cases
  // ============================================================================

  describe('createPolicyEnforcer edge cases', () => {
    it('should handle null and undefined config values', () => {
      const enforcer = createPolicyEnforcer({
        enforcement: null as any,
        enabled: undefined as any,
        version: '',
      });

      expect(enforcer).toBeInstanceOf(PolicyEnforcer);
      expect(enforcer.enforcementMode).toBe('warn'); // Should default
      expect(enforcer.isEnabled).toBe(true); // Should default
    });

    it('should merge deeply nested config objects', () => {
      const enforcer = createPolicyEnforcer({
        allowedPaths: {
          mode: 'blocklist',
          block: ['node_modules/**'],
          sensitivePatterns: ['.env*'],
        },
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'test-rule',
              name: 'Test Rule',
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            },
          ],
        },
      });

      expect(enforcer.policyConfig.allowedPaths?.mode).toBe('blocklist');
      expect(enforcer.policyConfig.approvalRules?.enabled).toBe(true);
      expect(enforcer.policyConfig.version).toBe('1.0'); // Should default
    });
  });

  // ============================================================================
  // Complex Integration Edge Cases
  // ============================================================================

  describe('complex integration edge cases', () => {
    it('should handle policy with both path violations and approval requirements', () => {
      const config: PolicyConfig = {
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          sensitivePatterns: ['**/*.env*'],
        },
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'sensitive-file-rule',
            name: 'Sensitive File Access',
            conditions: [{
              type: 'file-pattern',
              patterns: ['**/*.env*'],
            }],
            approvers: ['security-team'],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        priority: 'urgent', // Will trigger task policy
        workflow: 'production-deploy', // Will trigger task policy
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['src/.env.production'], // Allowed path but sensitive
        operationType: 'modify',
      });

      expect(result.passed).toBe(false); // Strict mode
      expect(result.results.length).toBeGreaterThan(1); // Multiple violations
      expect(result.requiresApproval).toBe(true);

      // Should have both path and approval violations
      const pathViolations = result.results.filter(r => r.ruleType === 'path');
      const approvalViolations = result.results.filter(r => r.ruleType === 'approval');
      expect(pathViolations.length).toBeGreaterThan(0);
      expect(approvalViolations.length).toBeGreaterThan(0);
    });

    it('should handle disabled policy with complex configuration', () => {
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
            id: 'strict-rule',
            name: 'Strict Rule',
            conditions: [{
              type: 'operation',
              operations: ['deploy'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask({
        priority: 'urgent',
        workflow: 'production-deploy',
        usage: { estimatedCost: 100.0, totalTokens: 50000 },
      });

      const result = enforcer.checkTaskStart(task, {
        projectPaths: ['blocked/everything.ts'],
        operationType: 'deploy',
      });

      // Should pass everything when policy is disabled
      expect(result.passed).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.requiresApproval).toBe(false);
    });
  });
});