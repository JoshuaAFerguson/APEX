/**
 * Test suite for PolicyEnforcer approval-required event emission
 *
 * Tests the integration between PolicyEnforcer and approval gate checking,
 * verifying that approval-required events are emitted when policy rules
 * require human approval for operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PolicyEnforcer } from '../policy/policy-enforcer';
import type {
  PolicyConfig,
  Task,
  ApprovalRule,
  ApprovalCondition,
  ApprovalCheckpointType,
  ApprovalUrgency,
} from '@apexcli/core';

describe('PolicyEnforcer Approval Events', () => {
  let policyEnforcer: PolicyEnforcer;
  let mockTask: Task;

  beforeEach(() => {
    // Create a mock task for testing
    mockTask = {
      id: 'test-task-123',
      description: 'Test task for approval checking',
      status: 'running',
      priority: 'normal',
      effort: 'medium',
      workflow: 'feature',
      autonomy: 'assisted',
      branchName: 'apex/test-branch',
      acceptanceCriteria: 'Task should complete successfully',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        totalTokens: 150,
        inputTokens: 75,
        outputTokens: 75,
        estimatedCost: 0.01,
        actualCost: 0.01,
        modelCalls: 1,
        toolCalls: 2,
        sessionTime: 60,
      },
      checkpoints: [],
      sessionData: {},
    } as Task;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Approval Requirement Detection', () => {
    it('should detect approval requirement for high-cost operations', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'high-cost-approval',
              name: 'High Cost Operations',
              description: 'Operations over $5 require approval',
              enabled: true,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 5.0,
                },
              ],
              urgency: 'high',
              timeoutMinutes: 30,
              approvers: ['finance-team', 'tech-lead'],
              minApprovals: 1,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      // Test task with high cost
      const highCostTask: Task = {
        ...mockTask,
        usage: {
          ...mockTask.usage,
          estimatedCost: 10.0,
        },
      };

      const approvalReq = policyEnforcer.checkApprovalRequired(
        highCostTask,
        'deploy',
        { estimatedCost: 10.0 }
      );

      expect(approvalReq.required).toBe(true);
      expect(approvalReq.triggeredRules).toHaveLength(1);
      expect(approvalReq.triggeredRules[0].id).toBe('high-cost-approval');
      expect(approvalReq.urgency).toBe('high');
      expect(approvalReq.timeoutMinutes).toBe(30);
      expect(approvalReq.requiredApprovers).toEqual(['finance-team', 'tech-lead']);
      expect(approvalReq.minApprovals).toBe(1);
      expect(approvalReq.timeoutAction).toBe('reject');
      expect(approvalReq.reason).toContain('High Cost Operations');
    });

    it('should detect approval requirement for file pattern operations', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'production-file-approval',
              name: 'Production File Changes',
              description: 'Changes to production files require approval',
              enabled: true,
              conditions: [
                {
                  type: 'file-pattern',
                  patterns: ['**/production/**', '**/prod/**', '**/*.prod.*'],
                },
              ],
              urgency: 'critical',
              timeoutMinutes: 15,
              approvers: ['senior-dev', 'devops-lead'],
              minApprovals: 2,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'modify',
        {
          filePaths: ['src/config/production/database.config.js'],
        }
      );

      expect(approvalReq.required).toBe(true);
      expect(approvalReq.triggeredRules).toHaveLength(1);
      expect(approvalReq.triggeredRules[0].id).toBe('production-file-approval');
      expect(approvalReq.urgency).toBe('critical');
      expect(approvalReq.timeoutMinutes).toBe(15);
      expect(approvalReq.requiredApprovers).toEqual(['senior-dev', 'devops-lead']);
      expect(approvalReq.minApprovals).toBe(2);
    });

    it('should detect approval requirement for dangerous operations', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'dangerous-ops-approval',
              name: 'Dangerous Operations',
              description: 'Dangerous operations require approval',
              enabled: true,
              conditions: [
                {
                  type: 'operation',
                  operations: ['delete', 'drop', 'truncate', 'destroy'],
                },
              ],
              urgency: 'critical',
              timeoutMinutes: 10,
              approvers: ['security-team', 'senior-dev'],
              minApprovals: 2,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'delete',
        {
          operation: 'delete',
        }
      );

      expect(approvalReq.required).toBe(true);
      expect(approvalReq.triggeredRules).toHaveLength(1);
      expect(approvalReq.urgency).toBe('critical');
      expect(approvalReq.timeoutMinutes).toBe(10);
    });

    it('should detect approval requirement for content pattern matches', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'sensitive-content-approval',
              name: 'Sensitive Content Changes',
              description: 'Changes to files with sensitive content require approval',
              enabled: true,
              conditions: [
                {
                  type: 'content-pattern',
                  patterns: ['API_KEY', 'PASSWORD', 'SECRET', 'private.*key'],
                },
              ],
              urgency: 'high',
              timeoutMinutes: 20,
              approvers: ['security-team'],
              minApprovals: 1,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const fileContents = new Map([
        ['config.env', 'API_KEY=secret123\nDATABASE_URL=postgresql://...'],
      ]);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'modify',
        {
          filePaths: ['config.env'],
          fileContents,
        }
      );

      expect(approvalReq.required).toBe(true);
      expect(approvalReq.triggeredRules).toHaveLength(1);
      expect(approvalReq.triggeredRules[0].id).toBe('sensitive-content-approval');
    });

    it('should not require approval when no rules match', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'warn',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'high-cost-approval',
              name: 'High Cost Operations',
              description: 'Operations over $50 require approval',
              enabled: true,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 50.0,
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 60,
              approvers: ['manager'],
              minApprovals: 1,
              timeoutAction: 'approve',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'read',
        { estimatedCost: 1.0 }
      );

      expect(approvalReq.required).toBe(false);
      expect(approvalReq.triggeredRules).toHaveLength(0);
      expect(approvalReq.reason).toContain('No approval rules matched');
    });

    it('should handle disabled approval rules', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: false, // Disabled approval rules
          rules: [
            {
              id: 'disabled-rule',
              name: 'Disabled Rule',
              description: 'This rule is disabled',
              enabled: true,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 1.0,
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 60,
              approvers: ['anyone'],
              minApprovals: 1,
              timeoutAction: 'approve',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'expensive-operation',
        { estimatedCost: 100.0 }
      );

      expect(approvalReq.required).toBe(false);
      expect(approvalReq.reason).toContain('No approval rules configured');
    });
  });

  describe('Multiple Rule Aggregation', () => {
    it('should aggregate multiple triggered rules correctly', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'cost-rule',
              name: 'Cost Rule',
              description: 'High cost operations',
              enabled: true,
              priority: 10,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 5.0,
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 60,
              approvers: ['finance-team'],
              minApprovals: 1,
              timeoutAction: 'approve',
            },
            {
              id: 'production-rule',
              name: 'Production Rule',
              description: 'Production file changes',
              enabled: true,
              priority: 20, // Higher priority
              conditions: [
                {
                  type: 'file-pattern',
                  patterns: ['**/production/**'],
                },
              ],
              urgency: 'critical', // Higher urgency
              timeoutMinutes: 15, // Shorter timeout
              approvers: ['devops-lead'],
              minApprovals: 2, // More approvals
              timeoutAction: 'reject', // More restrictive
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'deploy',
        {
          estimatedCost: 10.0, // Triggers cost rule
          filePaths: ['config/production/settings.json'], // Triggers production rule
        }
      );

      expect(approvalReq.required).toBe(true);
      expect(approvalReq.triggeredRules).toHaveLength(2);

      // Should use highest urgency
      expect(approvalReq.urgency).toBe('critical');

      // Should use shortest timeout (most restrictive)
      expect(approvalReq.timeoutMinutes).toBe(15);

      // Should use highest number of required approvals
      expect(approvalReq.minApprovals).toBe(2);

      // Should use most restrictive timeout action
      expect(approvalReq.timeoutAction).toBe('reject');

      // Should combine all required approvers
      expect(approvalReq.requiredApprovers).toEqual(['finance-team', 'devops-lead']);
    });

    it('should handle rule priority ordering correctly', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'low-priority-rule',
              name: 'Low Priority',
              description: 'Low priority rule',
              enabled: true,
              priority: 1,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 1.0,
                },
              ],
              urgency: 'low',
              timeoutMinutes: 120,
              approvers: ['anyone'],
              minApprovals: 1,
              timeoutAction: 'approve',
            },
            {
              id: 'high-priority-rule',
              name: 'High Priority',
              description: 'High priority rule',
              enabled: true,
              priority: 100,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 1.0,
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 60,
              approvers: ['supervisor'],
              minApprovals: 1,
              timeoutAction: 'approve',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'operation',
        { estimatedCost: 5.0 }
      );

      expect(approvalReq.required).toBe(true);
      expect(approvalReq.triggeredRules).toHaveLength(2);

      // Rules should be sorted by priority (highest first)
      expect(approvalReq.triggeredRules[0].id).toBe('high-priority-rule');
      expect(approvalReq.triggeredRules[1].id).toBe('low-priority-rule');
    });
  });

  describe('Rule Condition Evaluation', () => {
    it('should handle custom expression conditions', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'custom-expression-rule',
              name: 'Custom Expression',
              description: 'Custom expression evaluation',
              enabled: true,
              conditions: [
                {
                  type: 'custom',
                  expression: '10 > 5', // Simple expression that should evaluate to true
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 30,
              approvers: ['reviewer'],
              minApprovals: 1,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'operation',
        { customContext: { someValue: 'test' } }
      );

      expect(approvalReq.required).toBe(true);
      expect(approvalReq.triggeredRules).toHaveLength(1);
    });

    it('should handle token threshold conditions', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'token-threshold-rule',
              name: 'Token Threshold',
              description: 'High token usage requires approval',
              enabled: true,
              conditions: [
                {
                  type: 'token-threshold',
                  threshold: 1000,
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 30,
              approvers: ['tech-lead'],
              minApprovals: 1,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      // Test with high token usage
      const highTokenTask: Task = {
        ...mockTask,
        usage: {
          ...mockTask.usage,
          totalTokens: 5000,
        },
      };

      const approvalReq = policyEnforcer.checkApprovalRequired(
        highTokenTask,
        'operation',
        { tokenUsage: 5000 }
      );

      expect(approvalReq.required).toBe(true);
      expect(approvalReq.triggeredRules).toHaveLength(1);
    });

    it('should handle requireAllConditions logic', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'all-conditions-rule',
              name: 'All Conditions Required',
              description: 'Both cost and file pattern must match',
              enabled: true,
              requireAllConditions: true,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 5.0,
                },
                {
                  type: 'file-pattern',
                  patterns: ['**/sensitive/**'],
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 30,
              approvers: ['supervisor'],
              minApprovals: 1,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      // Test when only one condition matches
      const partialMatchReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'operation',
        {
          estimatedCost: 10.0, // Matches cost threshold
          filePaths: ['src/normal/file.js'], // Does NOT match file pattern
        }
      );

      expect(partialMatchReq.required).toBe(false);
      expect(partialMatchReq.triggeredRules).toHaveLength(0);

      // Test when both conditions match
      const fullMatchReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'operation',
        {
          estimatedCost: 10.0, // Matches cost threshold
          filePaths: ['src/sensitive/secrets.js'], // Matches file pattern
        }
      );

      expect(fullMatchReq.required).toBe(true);
      expect(fullMatchReq.triggeredRules).toHaveLength(1);
    });
  });

  describe('Urgency Level Handling', () => {
    it('should handle all urgency levels correctly', () => {
      const urgencyLevels: ApprovalUrgency[] = ['low', 'normal', 'high', 'critical'];

      urgencyLevels.forEach((urgency) => {
        const config: PolicyConfig = {
          version: '1.0',
          enforcement: 'enforce',
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: `${urgency}-urgency-rule`,
                name: `${urgency} Urgency Rule`,
                description: `Rule with ${urgency} urgency`,
                enabled: true,
                conditions: [
                  {
                    type: 'cost-threshold',
                    threshold: 1.0,
                  },
                ],
                urgency,
                timeoutMinutes: 30,
                approvers: ['reviewer'],
                minApprovals: 1,
                timeoutAction: 'reject',
              },
            ],
          },
        };

        policyEnforcer = new PolicyEnforcer(config);

        const approvalReq = policyEnforcer.checkApprovalRequired(
          mockTask,
          'operation',
          { estimatedCost: 5.0 }
        );

        expect(approvalReq.required).toBe(true);
        expect(approvalReq.urgency).toBe(urgency);
      });
    });

    it('should choose highest urgency when multiple rules trigger', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'low-urgency-rule',
              name: 'Low Urgency',
              description: 'Low urgency rule',
              enabled: true,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 1.0,
                },
              ],
              urgency: 'low',
              timeoutMinutes: 120,
              approvers: ['anyone'],
              minApprovals: 1,
              timeoutAction: 'approve',
            },
            {
              id: 'critical-urgency-rule',
              name: 'Critical Urgency',
              description: 'Critical urgency rule',
              enabled: true,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 1.0,
                },
              ],
              urgency: 'critical',
              timeoutMinutes: 5,
              approvers: ['emergency-contact'],
              minApprovals: 1,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'operation',
        { estimatedCost: 5.0 }
      );

      expect(approvalReq.required).toBe(true);
      expect(approvalReq.urgency).toBe('critical'); // Should pick the highest urgency
      expect(approvalReq.timeoutMinutes).toBe(5); // Should pick the shortest timeout
    });
  });

  describe('Policy Enforcement Mode', () => {
    it('should respect disabled policy enforcement', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: false, // Policy disabled
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'test-rule',
              name: 'Test Rule',
              description: 'Should not trigger when policy is disabled',
              enabled: true,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 1.0,
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 30,
              approvers: ['reviewer'],
              minApprovals: 1,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'operation',
        { estimatedCost: 100.0 }
      );

      expect(approvalReq.required).toBe(false);
      expect(approvalReq.triggeredRules).toHaveLength(0);
    });

    it('should handle missing approval rules configuration', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        // No approvalRules configured
      };

      policyEnforcer = new PolicyEnforcer(config);

      const approvalReq = policyEnforcer.checkApprovalRequired(
        mockTask,
        'operation',
        { estimatedCost: 100.0 }
      );

      expect(approvalReq.required).toBe(false);
      expect(approvalReq.reason).toContain('No approval rules configured');
    });
  });
});