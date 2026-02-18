/**
 * Test coverage for TaskStatus extension with awaiting-approval status
 *
 * Validates that:
 * - TaskStatus enum includes 'awaiting-approval' status
 * - Task workflow properly handles approval states
 * - Integration with other task statuses works correctly
 */

import { describe, it, expect } from 'vitest';
import {
  TaskStatusSchema,
  TaskStatus,
  TaskSchema,
  Task,
  ApprovalStateSchema,
  ApprovalState
} from '../types';

describe('TaskStatus with Approval Support', () => {
  describe('TaskStatusSchema awaiting-approval status', () => {
    it('should include awaiting-approval in valid task statuses', () => {
      const status = 'awaiting-approval';
      expect(() => TaskStatusSchema.parse(status)).not.toThrow();

      const parsed = TaskStatusSchema.parse(status);
      expect(parsed).toBe('awaiting-approval');
    });

    it('should accept awaiting-approval as TaskStatus type', () => {
      const status: TaskStatus = 'awaiting-approval';
      expect(status).toBe('awaiting-approval');
    });

    it('should validate all task statuses including awaiting-approval', () => {
      const allStatuses: TaskStatus[] = [
        'pending',
        'queued',
        'planning',
        'in-progress',
        'awaiting-approval',  // New status
        'paused',
        'completed',
        'failed',
        'cancelled'
      ];

      allStatuses.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
        const parsed = TaskStatusSchema.parse(status);
        expect(parsed).toBe(status);
      });
    });

    it('should maintain backward compatibility with existing statuses', () => {
      const existingStatuses: TaskStatus[] = [
        'pending',
        'queued',
        'planning',
        'in-progress',
        'paused',
        'completed',
        'failed',
        'cancelled'
      ];

      existingStatuses.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('should reject invalid statuses including old ones', () => {
      const invalidStatuses = [
        'running',  // Old status, should be 'in-progress'
        'waiting',
        'blocked',
        'approved',
        'denied',
        '',
        null,
        undefined,
        123
      ];

      invalidStatuses.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).toThrow();
      });
    });
  });

  describe('Task with awaiting-approval status', () => {
    const baseTask = {
      id: 'task-approval-test',
      title: 'Test approval workflow',
      description: 'Testing task with approval gates',
      status: 'awaiting-approval' as TaskStatus,
      priority: 'medium' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should accept task with awaiting-approval status', () => {
      const parsed = TaskSchema.parse(baseTask);
      expect(parsed.status).toBe('awaiting-approval');
    });

    it('should support task with approval state', () => {
      const approvalState: ApprovalState = {
        id: 'approval-456',
        taskId: baseTask.id,
        gateName: 'Code Review Gate',
        status: 'pending',
        requestedAt: new Date()
      };

      const taskWithApproval: Task = {
        ...baseTask,
        approvalState
      };

      const parsed = TaskSchema.parse(taskWithApproval);
      expect(parsed.status).toBe('awaiting-approval');
      expect(parsed.approvalState).toEqual(approvalState);
      expect(parsed.approvalState!.taskId).toBe(parsed.id);
    });

    it('should validate task state consistency', () => {
      // When status is awaiting-approval, there should be an approval state
      const taskWithoutApprovalState: Task = {
        ...baseTask,
        status: 'awaiting-approval'
        // Missing approvalState - this is allowed by schema but may be logical inconsistency
      };

      // Schema should still parse (business logic validation separate)
      expect(() => TaskSchema.parse(taskWithoutApprovalState)).not.toThrow();

      // When status is not awaiting-approval, approval state might still exist (historical)
      const completedTaskWithApprovalHistory: Task = {
        ...baseTask,
        status: 'completed',
        approvalState: {
          id: 'approval-completed',
          taskId: baseTask.id,
          gateName: 'Final Review',
          status: 'approved',
          approver: 'reviewer@company.com',
          requestedAt: new Date(Date.now() - 60000),
          respondedAt: new Date()
        }
      };

      expect(() => TaskSchema.parse(completedTaskWithApprovalHistory)).not.toThrow();
    });
  });

  describe('Task status transitions with approvals', () => {
    it('should support common task status flow with approval gates', () => {
      const taskId = 'task-flow-test';

      // Typical workflow with approval gates
      const statusFlow: TaskStatus[] = [
        'pending',        // Initial state
        'queued',         // Picked up by system
        'planning',       // Planning stage
        'in-progress',    // Implementation stage
        'awaiting-approval', // Hit approval gate
        'in-progress',    // Approved, continuing
        'completed'       // Final state
      ];

      statusFlow.forEach(status => {
        const task = {
          id: taskId,
          title: 'Flow Test Task',
          description: 'Testing status flow',
          status,
          priority: 'medium' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(() => TaskSchema.parse(task)).not.toThrow();
      });
    });

    it('should support alternative flows with approval rejection', () => {
      const rejectionFlow: TaskStatus[] = [
        'pending',
        'planning',
        'in-progress',
        'awaiting-approval',
        'failed'          // Approval rejected, task failed
      ];

      rejectionFlow.forEach(status => {
        const task = {
          id: 'task-rejection-test',
          title: 'Rejection Test Task',
          description: 'Testing rejection flow',
          status,
          priority: 'high' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(() => TaskSchema.parse(task)).not.toThrow();
      });
    });

    it('should support multiple approval gates in workflow', () => {
      const multiApprovalFlow: TaskStatus[] = [
        'pending',
        'planning',
        'in-progress',
        'awaiting-approval',  // First gate (e.g., code review)
        'in-progress',        // Continue after approval
        'awaiting-approval',  // Second gate (e.g., deployment approval)
        'in-progress',        // Continue after second approval
        'completed'
      ];

      multiApprovalFlow.forEach(status => {
        const task = {
          id: 'task-multi-approval',
          title: 'Multi Approval Task',
          description: 'Testing multiple approval gates',
          status,
          priority: 'high' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(() => TaskSchema.parse(task)).not.toThrow();
      });
    });

    it('should support paused state during approval', () => {
      const pausedApprovalFlow: TaskStatus[] = [
        'in-progress',
        'awaiting-approval',
        'paused',             // Paused while waiting for approval
        'awaiting-approval',  // Resumed, still waiting
        'in-progress',        // Approved, continuing
        'completed'
      ];

      pausedApprovalFlow.forEach(status => {
        const task = {
          id: 'task-paused-approval',
          title: 'Paused Approval Task',
          description: 'Testing paused state during approval',
          status,
          priority: 'low' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(() => TaskSchema.parse(task)).not.toThrow();
      });
    });
  });

  describe('Integration with approval workflow', () => {
    it('should support realistic task with approval workflow', () => {
      const approvalWorkflowTask: Task = {
        id: 'task-real-workflow',
        title: 'Deploy to Production',
        description: 'Deploy the feature to production environment',
        status: 'awaiting-approval',
        priority: 'high',
        stage: 'deployment',
        agent: 'devops',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:30:00Z'),
        approvalState: {
          id: 'approval-prod-deploy',
          taskId: 'task-real-workflow',
          gateName: 'Production Deployment Gate',
          status: 'pending',
          requestedAt: new Date('2024-01-01T10:30:00Z'),
          stage: 'deployment',
          agent: 'devops',
          approvalsRequired: 2,
          timeoutMinutes: 240,
          expiresAt: new Date('2024-01-01T14:30:00Z'),
          context: {
            deploymentTarget: 'production',
            riskLevel: 'high',
            affectedServices: ['api', 'frontend']
          }
        },
        context: {
          deploymentEnvironment: 'production',
          requiresApproval: true
        }
      };

      expect(() => TaskSchema.parse(approvalWorkflowTask)).not.toThrow();

      const parsed = TaskSchema.parse(approvalWorkflowTask);
      expect(parsed.status).toBe('awaiting-approval');
      expect(parsed.approvalState!.status).toBe('pending');
      expect(parsed.approvalState!.taskId).toBe(parsed.id);
      expect(parsed.stage).toBe('deployment');
    });

    it('should support task status change from awaiting-approval to completed', () => {
      const taskId = 'task-approval-to-complete';

      // Task waiting for approval
      const awaitingTask: Task = {
        id: taskId,
        title: 'Feature Implementation',
        description: 'Implementing new feature',
        status: 'awaiting-approval',
        priority: 'medium',
        stage: 'implementation',
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        approvalState: {
          id: 'approval-feature-impl',
          taskId,
          gateName: 'Code Review Gate',
          status: 'pending',
          requestedAt: new Date('2024-01-01T10:00:00Z')
        }
      };

      // Task after approval and completion
      const completedTask: Task = {
        ...awaitingTask,
        status: 'completed',
        updatedAt: new Date('2024-01-01T11:00:00Z'),
        approvalState: {
          ...awaitingTask.approvalState!,
          status: 'approved',
          approver: 'senior-dev@company.com',
          respondedAt: new Date('2024-01-01T10:30:00Z'),
          comment: 'Code review passed, looks good!'
        },
        completedAt: new Date('2024-01-01T11:00:00Z')
      };

      expect(() => TaskSchema.parse(awaitingTask)).not.toThrow();
      expect(() => TaskSchema.parse(completedTask)).not.toThrow();

      // Verify the transition
      const parsedAwaiting = TaskSchema.parse(awaitingTask);
      const parsedCompleted = TaskSchema.parse(completedTask);

      expect(parsedAwaiting.status).toBe('awaiting-approval');
      expect(parsedAwaiting.approvalState!.status).toBe('pending');
      expect(parsedCompleted.status).toBe('completed');
      expect(parsedCompleted.approvalState!.status).toBe('approved');
    });

    it('should support task status change from awaiting-approval to failed', () => {
      const taskId = 'task-approval-to-failed';

      // Task waiting for approval
      const awaitingTask: Task = {
        id: taskId,
        title: 'Security Update',
        description: 'Applying security patches',
        status: 'awaiting-approval',
        priority: 'high',
        stage: 'implementation',
        createdAt: new Date('2024-01-01T08:00:00Z'),
        updatedAt: new Date('2024-01-01T09:00:00Z'),
        approvalState: {
          id: 'approval-security-update',
          taskId,
          gateName: 'Security Review Gate',
          status: 'pending',
          requestedAt: new Date('2024-01-01T09:00:00Z')
        }
      };

      // Task after denial and failure
      const failedTask: Task = {
        ...awaitingTask,
        status: 'failed',
        updatedAt: new Date('2024-01-01T09:45:00Z'),
        approvalState: {
          ...awaitingTask.approvalState!,
          status: 'denied',
          approver: 'security-team@company.com',
          respondedAt: new Date('2024-01-01T09:45:00Z'),
          comment: 'Security review failed: vulnerabilities found in dependencies'
        },
        failedAt: new Date('2024-01-01T09:45:00Z'),
        error: 'Task failed due to approval denial: Security review rejected'
      };

      expect(() => TaskSchema.parse(awaitingTask)).not.toThrow();
      expect(() => TaskSchema.parse(failedTask)).not.toThrow();

      // Verify the transition
      const parsedAwaiting = TaskSchema.parse(awaitingTask);
      const parsedFailed = TaskSchema.parse(failedTask);

      expect(parsedAwaiting.status).toBe('awaiting-approval');
      expect(parsedAwaiting.approvalState!.status).toBe('pending');
      expect(parsedFailed.status).toBe('failed');
      expect(parsedFailed.approvalState!.status).toBe('denied');
      expect(parsedFailed.error).toContain('approval denial');
    });
  });
});