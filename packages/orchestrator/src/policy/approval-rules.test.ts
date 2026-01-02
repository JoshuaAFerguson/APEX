/**
 * @fileoverview Unit tests for PolicyEnforcer approval rules functionality
 *
 * Tests cover:
 * - checkApprovalRequired method
 * - Approval condition evaluation (file-pattern, operation, cost-threshold, etc.)
 * - Rule aggregation logic
 * - AND/OR condition logic
 * - Edge cases and error handling
 */

import { describe, it, expect } from 'vitest';
import { PolicyEnforcer } from './policy-enforcer.js';
import type { PolicyConfig, Task } from '@apexcli/core';

describe('PolicyEnforcer - Approval Rules', () => {
  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-123',
    description: 'Test task',
    acceptanceCriteria: 'Test acceptance criteria',
    workflow: 'test-workflow',
    autonomy: 'guided',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    currentStage: 'implementation',
    projectPath: '/test/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 2.50,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  });

  // ============================================================================
  // Basic Approval Logic Tests
  // ============================================================================

  describe('basic approval logic', () => {
    it('should return not required when policy is disabled', () => {
      const config: PolicyConfig = {
        enabled: false,
        approvalRules: {
          enabled: true,
          rules: [],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should return not required when approval rules are disabled', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: false,
          rules: [],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should return not required when no rules are configured', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(false);
      expect(result.reason).toContain('No approval rules matched');
    });

    it('should return not required when no rules match', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'rule-1',
            name: 'File Pattern Rule',
            conditions: [{
              type: 'file-pattern',
              patterns: ['production/**'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy', {
        filePaths: ['src/app.ts'],
      });

      expect(result.required).toBe(false);
      expect(result.reason).toContain('No approval rules matched');
    });
  });

  // ============================================================================
  // File Pattern Condition Tests
  // ============================================================================

  describe('file-pattern conditions', () => {
    it('should trigger on matching file patterns', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'file-rule',
            name: 'Production Files',
            description: 'Production files require approval',
            conditions: [{
              type: 'file-pattern',
              patterns: ['production/**', '*.prod.*'],
            }],
            urgency: 'high',
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy', {
        filePaths: ['production/config.yaml', 'src/app.ts'],
      });

      expect(result.required).toBe(true);
      expect(result.triggeredRules).toHaveLength(1);
      expect(result.triggeredRules[0].id).toBe('file-rule');
      expect(result.urgency).toBe('high');
      expect(result.reason).toContain('Production files require approval');
    });

    it('should not trigger when no file patterns match', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'file-rule',
            name: 'Production Files',
            conditions: [{
              type: 'file-pattern',
              patterns: ['production/**'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy', {
        filePaths: ['src/app.ts', 'tests/unit.test.ts'],
      });

      expect(result.required).toBe(false);
    });

    it('should handle empty file paths gracefully', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'file-rule',
            name: 'Production Files',
            conditions: [{
              type: 'file-pattern',
              patterns: ['production/**'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy', {
        filePaths: [],
      });

      expect(result.required).toBe(false);
    });
  });

  // ============================================================================
  // Operation Condition Tests
  // ============================================================================

  describe('operation conditions', () => {
    it('should trigger on matching operation types', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'deploy-rule',
            name: 'Deployment Approval',
            conditions: [{
              type: 'operation',
              operations: ['deploy', 'push'],
            }],
            urgency: 'critical',
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(true);
      expect(result.urgency).toBe('critical');
    });

    it('should trigger on context operation', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'delete-rule',
            name: 'Delete Approval',
            conditions: [{
              type: 'operation',
              operations: ['delete'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'modify', {
        operation: 'delete',
      });

      expect(result.required).toBe(true);
    });

    it('should handle case insensitive matching', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'deploy-rule',
            name: 'Deployment Approval',
            conditions: [{
              type: 'operation',
              operations: ['deploy'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'DEPLOY');

      expect(result.required).toBe(true);
    });
  });

  // ============================================================================
  // Cost Threshold Condition Tests
  // ============================================================================

  describe('cost-threshold conditions', () => {
    it('should trigger when task cost exceeds threshold', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'cost-rule',
            name: 'High Cost Approval',
            conditions: [{
              type: 'cost-threshold',
              threshold: 2.0,
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask(); // Has estimatedCost: 2.50
      const result = enforcer.checkApprovalRequired(task, 'execute');

      expect(result.required).toBe(true);
    });

    it('should trigger when context cost exceeds threshold', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'cost-rule',
            name: 'High Cost Approval',
            conditions: [{
              type: 'cost-threshold',
              threshold: 5.0,
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask(); // Has estimatedCost: 2.50
      const result = enforcer.checkApprovalRequired(task, 'execute', {
        estimatedCost: 10.0,
      });

      expect(result.required).toBe(true);
    });

    it('should not trigger when cost is below threshold', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'cost-rule',
            name: 'High Cost Approval',
            conditions: [{
              type: 'cost-threshold',
              threshold: 10.0,
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask(); // Has estimatedCost: 2.50
      const result = enforcer.checkApprovalRequired(task, 'execute');

      expect(result.required).toBe(false);
    });

    it('should handle missing or invalid thresholds', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'cost-rule',
            name: 'Invalid Threshold',
            conditions: [{
              type: 'cost-threshold',
              // No threshold defined
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'execute');

      expect(result.required).toBe(false);
    });
  });

  // ============================================================================
  // Token Threshold Condition Tests
  // ============================================================================

  describe('token-threshold conditions', () => {
    it('should trigger when task tokens exceed threshold', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'token-rule',
            name: 'High Token Usage Approval',
            conditions: [{
              type: 'token-threshold',
              threshold: 1000,
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask(); // Has totalTokens: 1500
      const result = enforcer.checkApprovalRequired(task, 'execute');

      expect(result.required).toBe(true);
    });

    it('should use context token usage when provided', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'token-rule',
            name: 'High Token Usage Approval',
            conditions: [{
              type: 'token-threshold',
              threshold: 500,
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask(); // Has totalTokens: 1500
      const result = enforcer.checkApprovalRequired(task, 'execute', {
        tokenUsage: 1000,
      });

      expect(result.required).toBe(true);
    });

    it('should not trigger when tokens are below threshold', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'token-rule',
            name: 'High Token Usage Approval',
            conditions: [{
              type: 'token-threshold',
              threshold: 2000,
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask(); // Has totalTokens: 1500
      const result = enforcer.checkApprovalRequired(task, 'execute');

      expect(result.required).toBe(false);
    });
  });

  // ============================================================================
  // Custom Expression Condition Tests
  // ============================================================================

  describe('custom expression conditions', () => {
    it('should evaluate basic numeric expressions', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'custom-rule',
            name: 'Custom Expression',
            conditions: [{
              type: 'custom',
              expression: '5 > 3',
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'execute');

      expect(result.required).toBe(true);
    });

    it('should handle invalid expressions safely', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'custom-rule',
            name: 'Invalid Expression',
            conditions: [{
              type: 'custom',
              expression: 'invalid expression syntax',
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'execute');

      expect(result.required).toBe(false);
    });

    it('should handle empty expressions', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'custom-rule',
            name: 'Empty Expression',
            conditions: [{
              type: 'custom',
              expression: '',
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'execute');

      expect(result.required).toBe(false);
    });
  });

  // ============================================================================
  // Content Pattern Condition Tests
  // ============================================================================

  describe('content-pattern conditions', () => {
    it('should trigger when file content matches regex pattern', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'content-rule',
            name: 'Sensitive Content',
            conditions: [{
              type: 'content-pattern',
              patterns: ['secretkey\\s*=', 'api[_-]?token'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const fileContents = new Map([
        ['config.js', 'const config = { secretkey = "abc123" }'],
        ['app.js', 'console.log("Hello world")'],
      ]);

      const result = enforcer.checkApprovalRequired(task, 'commit', {
        fileContents,
      });

      expect(result.required).toBe(true);
    });

    it('should not trigger when content does not match patterns', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'content-rule',
            name: 'Sensitive Content',
            conditions: [{
              type: 'content-pattern',
              patterns: ['secretkey\\s*='],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const fileContents = new Map([
        ['app.js', 'console.log("Hello world")'],
      ]);

      const result = enforcer.checkApprovalRequired(task, 'commit', {
        fileContents,
      });

      expect(result.required).toBe(false);
    });

    it('should handle empty file contents', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'content-rule',
            name: 'Sensitive Content',
            conditions: [{
              type: 'content-pattern',
              patterns: ['secretkey\\s*='],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      const result = enforcer.checkApprovalRequired(task, 'commit', {
        fileContents: new Map(),
      });

      expect(result.required).toBe(false);
    });

    it('should handle invalid regex patterns gracefully', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'content-rule',
            name: 'Invalid Regex',
            conditions: [{
              type: 'content-pattern',
              patterns: ['[invalid regex'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const fileContents = new Map([
        ['app.js', 'some content here'],
      ]);

      const result = enforcer.checkApprovalRequired(task, 'commit', {
        fileContents,
      });

      expect(result.required).toBe(false);
    });
  });

  // ============================================================================
  // Rule Logic Tests
  // ============================================================================

  describe('rule logic', () => {
    it('should handle OR logic (default)', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'or-rule',
            name: 'OR Logic Rule',
            conditions: [
              {
                type: 'file-pattern',
                patterns: ['production/**'],
              },
              {
                type: 'operation',
                operations: ['deploy'],
              },
            ],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      // Should trigger on deploy operation alone
      const result1 = enforcer.checkApprovalRequired(task, 'deploy', {
        filePaths: ['src/app.ts'],
      });
      expect(result1.required).toBe(true);

      // Should trigger on production file alone
      const result2 = enforcer.checkApprovalRequired(task, 'modify', {
        filePaths: ['production/config.yaml'],
      });
      expect(result2.required).toBe(true);
    });

    it('should handle AND logic', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'and-rule',
            name: 'AND Logic Rule',
            requireAllConditions: true,
            conditions: [
              {
                type: 'file-pattern',
                patterns: ['production/**'],
              },
              {
                type: 'operation',
                operations: ['deploy'],
              },
            ],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      // Should NOT trigger on deploy operation alone
      const result1 = enforcer.checkApprovalRequired(task, 'deploy', {
        filePaths: ['src/app.ts'],
      });
      expect(result1.required).toBe(false);

      // Should trigger when BOTH conditions are met
      const result2 = enforcer.checkApprovalRequired(task, 'deploy', {
        filePaths: ['production/config.yaml'],
      });
      expect(result2.required).toBe(true);
    });

    it('should skip disabled rules', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'disabled-rule',
              name: 'Disabled Rule',
              enabled: false,
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            },
            {
              id: 'enabled-rule',
              name: 'Enabled Rule',
              enabled: true,
              conditions: [{
                type: 'operation',
                operations: ['delete'],
              }],
            },
          ],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();

      // Deploy should not trigger disabled rule
      const result1 = enforcer.checkApprovalRequired(task, 'deploy');
      expect(result1.required).toBe(false);

      // Delete should trigger enabled rule
      const result2 = enforcer.checkApprovalRequired(task, 'delete');
      expect(result2.required).toBe(true);
    });
  });

  // ============================================================================
  // Aggregation Tests
  // ============================================================================

  describe('requirement aggregation', () => {
    it('should aggregate multiple triggered rules', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              name: 'High Priority Rule',
              priority: 10,
              urgency: 'high',
              timeoutMinutes: 15,
              approvers: ['alice@example.com'],
              minApprovals: 1,
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            },
            {
              id: 'rule-2',
              name: 'Critical Security Rule',
              priority: 20,
              urgency: 'critical',
              timeoutMinutes: 5,
              approvers: ['bob@example.com', 'security@example.com'],
              minApprovals: 2,
              conditions: [{
                type: 'file-pattern',
                patterns: ['**/*'],
              }],
            },
          ],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy', {
        filePaths: ['src/app.ts'],
      });

      expect(result.required).toBe(true);
      expect(result.triggeredRules).toHaveLength(2);

      // Should use highest urgency
      expect(result.urgency).toBe('critical');

      // Should use shortest timeout
      expect(result.timeoutMinutes).toBe(5);

      // Should use maximum approvals needed
      expect(result.minApprovals).toBe(2);

      // Should combine all approvers
      expect(result.requiredApprovers).toContain('alice@example.com');
      expect(result.requiredApprovers).toContain('bob@example.com');
      expect(result.requiredApprovers).toContain('security@example.com');

      // Should mention multiple rules in reason
      expect(result.reason).toContain('Multiple approval rules triggered');
    });

    it('should use most restrictive timeout action', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'rule-1',
              name: 'Auto Approve Rule',
              timeoutAction: 'approve',
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            },
            {
              id: 'rule-2',
              name: 'Strict Rule',
              timeoutAction: 'reject',
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            },
          ],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(true);
      expect(result.timeoutAction).toBe('reject'); // Most restrictive
    });

    it('should sort rules by priority', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'low-priority',
              name: 'Low Priority Rule',
              priority: 1,
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            },
            {
              id: 'high-priority',
              name: 'High Priority Rule',
              priority: 10,
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            },
          ],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(true);
      expect(result.triggeredRules).toHaveLength(2);
      // Higher priority rule should be first
      expect(result.triggeredRules[0].id).toBe('high-priority');
      expect(result.triggeredRules[1].id).toBe('low-priority');
    });

    it('should handle single rule correctly', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'single-rule',
            name: 'Single Rule',
            description: 'This is a test rule',
            urgency: 'normal',
            timeoutMinutes: 30,
            conditions: [{
              type: 'operation',
              operations: ['deploy'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(true);
      expect(result.triggeredRules).toHaveLength(1);
      expect(result.urgency).toBe('normal');
      expect(result.timeoutMinutes).toBe(30);
      expect(result.reason).toContain('This is a test rule');
    });

    it('should use default values when rules have no specific values', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'minimal-rule',
            name: 'Minimal Rule',
            conditions: [{
              type: 'operation',
              operations: ['deploy'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(true);
      expect(result.urgency).toBe('normal'); // default
      expect(result.timeoutAction).toBe('reject'); // default
      expect(result.minApprovals).toBe(1); // default
      expect(result.requiredApprovers).toEqual([]); // default
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle unknown condition types gracefully', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'unknown-rule',
            name: 'Unknown Condition Type',
            conditions: [{
              type: 'unknown-type' as any,
              patterns: ['**/*'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(false);
    });

    it('should handle empty context gracefully', () => {
      const config: PolicyConfig = {
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [{
            id: 'context-rule',
            name: 'Context Rule',
            conditions: [{
              type: 'file-pattern',
              patterns: ['**/*'],
            }],
          }],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(false);
    });

    it('should handle missing approval rules configuration', () => {
      const config: PolicyConfig = {
        enabled: true,
        // No approvalRules defined
      };

      const enforcer = new PolicyEnforcer(config);
      const task = createMockTask();
      const result = enforcer.checkApprovalRequired(task, 'deploy');

      expect(result.required).toBe(false);
      expect(result.reason).toContain('disabled');
    });
  });
});