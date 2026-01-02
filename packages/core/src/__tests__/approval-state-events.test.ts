/**
 * Test coverage for ApprovalState and approval event types
 *
 * Tests the new approval-related types that were added to support approval gates:
 * - ApprovalState: tracking approval request state
 * - ApprovalRequiredEventData: event when approval is needed
 * - ApprovalResponseEventData: event when approval decision is made
 * - ApprovalEventData: union type for event handling
 */

import { describe, it, expect } from 'vitest';
import {
  ApprovalStatusSchema,
  ApprovalStatus,
  ApprovalStateSchema,
  ApprovalState,
  ApprovalRequiredEventDataSchema,
  ApprovalRequiredEventData,
  ApprovalResponseEventDataSchema,
  ApprovalResponseEventData,
  ApprovalEventData,
  ApprovalCheckpointType,
  TaskStatusSchema,
} from '../types';

describe('Approval State and Event Types', () => {
  describe('ApprovalStatus enum', () => {
    it('should accept valid approval statuses', () => {
      const validStatuses: ApprovalStatus[] = ['pending', 'approved', 'denied'];

      validStatuses.forEach(status => {
        expect(ApprovalStatusSchema.parse(status)).toBe(status);
      });
    });

    it('should reject invalid approval statuses', () => {
      const invalidStatuses = [
        'invalid',
        'waiting',
        'completed',
        '',
        null,
        undefined,
        123
      ];

      invalidStatuses.forEach(status => {
        expect(() => ApprovalStatusSchema.parse(status)).toThrow();
      });
    });

    it('should export correct type', () => {
      const status: ApprovalStatus = 'approved';
      expect(status).toBe('approved');
    });
  });

  describe('ApprovalStateSchema', () => {
    const baseApprovalState = {
      id: 'approval-123',
      taskId: 'task-456',
      gateName: 'Code Review Gate',
      status: 'pending' as ApprovalStatus,
      requestedAt: new Date()
    };

    it('should accept minimal valid approval state', () => {
      const parsed = ApprovalStateSchema.parse(baseApprovalState);

      expect(parsed.id).toBe('approval-123');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.gateName).toBe('Code Review Gate');
      expect(parsed.status).toBe('pending');
      expect(parsed.requestedAt).toBeInstanceOf(Date);
      expect(parsed.approvalsReceived).toBe(0); // default value
      expect(parsed.approvalsRequired).toBe(1); // default value
    });

    it('should accept complete approval state', () => {
      const completeState: ApprovalState = {
        id: 'approval-789',
        taskId: 'task-101',
        gateName: 'Security Review',
        status: 'approved',
        approver: 'security-team@company.com',
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        respondedAt: new Date('2024-01-01T10:30:00Z'),
        comment: 'Security review completed successfully',
        context: {
          riskLevel: 'medium',
          reviewType: 'automated-plus-manual'
        },
        stage: 'implementation',
        agent: 'developer',
        approvalsReceived: 2,
        approvalsRequired: 2,
        timeoutMinutes: 120,
        expiresAt: new Date('2024-01-01T12:00:00Z')
      };

      const parsed = ApprovalStateSchema.parse(completeState);
      expect(parsed.id).toBe('approval-789');
      expect(parsed.approver).toBe('security-team@company.com');
      expect(parsed.comment).toBe('Security review completed successfully');
      expect(parsed.context).toEqual({ riskLevel: 'medium', reviewType: 'automated-plus-manual' });
      expect(parsed.approvalsReceived).toBe(2);
      expect(parsed.approvalsRequired).toBe(2);
      expect(parsed.timeoutMinutes).toBe(120);
    });

    it('should validate required fields', () => {
      // Missing id
      expect(() => ApprovalStateSchema.parse({
        taskId: 'task-456',
        gateName: 'Test Gate',
        status: 'pending',
        requestedAt: new Date()
      })).toThrow();

      // Missing taskId
      expect(() => ApprovalStateSchema.parse({
        id: 'approval-123',
        gateName: 'Test Gate',
        status: 'pending',
        requestedAt: new Date()
      })).toThrow();

      // Missing gateName
      expect(() => ApprovalStateSchema.parse({
        id: 'approval-123',
        taskId: 'task-456',
        status: 'pending',
        requestedAt: new Date()
      })).toThrow();

      // Missing status
      expect(() => ApprovalStateSchema.parse({
        id: 'approval-123',
        taskId: 'task-456',
        gateName: 'Test Gate',
        requestedAt: new Date()
      })).toThrow();

      // Missing requestedAt
      expect(() => ApprovalStateSchema.parse({
        id: 'approval-123',
        taskId: 'task-456',
        gateName: 'Test Gate',
        status: 'pending'
      })).toThrow();
    });

    it('should validate string field constraints', () => {
      // Empty id
      expect(() => ApprovalStateSchema.parse({
        ...baseApprovalState,
        id: ''
      })).toThrow();

      // Empty taskId
      expect(() => ApprovalStateSchema.parse({
        ...baseApprovalState,
        taskId: ''
      })).toThrow();

      // Empty gateName
      expect(() => ApprovalStateSchema.parse({
        ...baseApprovalState,
        gateName: ''
      })).toThrow();
    });

    it('should validate number field constraints', () => {
      // Negative approvalsReceived
      expect(() => ApprovalStateSchema.parse({
        ...baseApprovalState,
        approvalsReceived: -1
      })).toThrow();

      // Zero approvalsRequired (should be at least 1)
      expect(() => ApprovalStateSchema.parse({
        ...baseApprovalState,
        approvalsRequired: 0
      })).toThrow();

      // Zero timeoutMinutes
      expect(() => ApprovalStateSchema.parse({
        ...baseApprovalState,
        timeoutMinutes: 0
      })).toThrow();
    });

    it('should handle different approval statuses', () => {
      const statuses: ApprovalStatus[] = ['pending', 'approved', 'denied'];

      statuses.forEach(status => {
        const state = { ...baseApprovalState, status };
        const parsed = ApprovalStateSchema.parse(state);
        expect(parsed.status).toBe(status);
      });
    });
  });

  describe('ApprovalRequiredEventDataSchema', () => {
    const baseRequiredEvent = {
      approvalId: 'approval-123',
      taskId: 'task-456',
      gateName: 'Code Review',
      gateType: 'before-commit' as ApprovalCheckpointType,
      stage: 'implementation',
      requestedAt: new Date(),
      requiredApprovals: 1,
      timeout: 60
    };

    it('should accept minimal valid required event data', () => {
      const minimalEvent = {
        approvalId: 'approval-123',
        taskId: 'task-456'
      };

      const parsed = ApprovalRequiredEventDataSchema.parse(minimalEvent);
      expect(parsed.approvalId).toBe('approval-123');
      expect(parsed.taskId).toBe('task-456');
    });

    it('should accept complete required event data', () => {
      const completeEvent: ApprovalRequiredEventData = {
        approvalId: 'approval-789',
        taskId: 'task-101',
        gateName: 'Security Review',
        gateType: 'before-deploy',
        stage: 'deployment',
        description: 'Security approval required for production deployment',
        requiredApprovals: 2,
        approvers: ['security-team', 'devops-lead'],
        timeout: 120,
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        expiresAt: new Date('2024-01-01T12:00:00Z'),
        context: {
          deploymentTarget: 'production',
          riskLevel: 'high'
        },
        agent: 'devops'
      };

      const parsed = ApprovalRequiredEventDataSchema.parse(completeEvent);
      expect(parsed.approvalId).toBe('approval-789');
      expect(parsed.gateName).toBe('Security Review');
      expect(parsed.gateType).toBe('before-deploy');
      expect(parsed.requiredApprovals).toBe(2);
      expect(parsed.approvers).toEqual(['security-team', 'devops-lead']);
      expect(parsed.timeout).toBe(120);
      expect(parsed.context).toEqual({ deploymentTarget: 'production', riskLevel: 'high' });
    });

    it('should validate required fields', () => {
      // Missing approvalId
      expect(() => ApprovalRequiredEventDataSchema.parse({
        taskId: 'task-456'
      })).toThrow();

      // Missing taskId
      expect(() => ApprovalRequiredEventDataSchema.parse({
        approvalId: 'approval-123'
      })).toThrow();

      // Empty approvalId
      expect(() => ApprovalRequiredEventDataSchema.parse({
        approvalId: '',
        taskId: 'task-456'
      })).toThrow();

      // Empty taskId
      expect(() => ApprovalRequiredEventDataSchema.parse({
        approvalId: 'approval-123',
        taskId: ''
      })).toThrow();
    });

    it('should validate checkpoint types when provided', () => {
      const validTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'custom'
      ];

      validTypes.forEach(gateType => {
        const event = { ...baseRequiredEvent, gateType };
        const parsed = ApprovalRequiredEventDataSchema.parse(event);
        expect(parsed.gateType).toBe(gateType);
      });
    });

    it('should validate number constraints', () => {
      // Zero requiredApprovals
      expect(() => ApprovalRequiredEventDataSchema.parse({
        ...baseRequiredEvent,
        requiredApprovals: 0
      })).toThrow();

      // Negative requiredApprovals
      expect(() => ApprovalRequiredEventDataSchema.parse({
        ...baseRequiredEvent,
        requiredApprovals: -1
      })).toThrow();

      // Zero timeout
      expect(() => ApprovalRequiredEventDataSchema.parse({
        ...baseRequiredEvent,
        timeout: 0
      })).toThrow();
    });
  });

  describe('ApprovalResponseEventDataSchema', () => {
    const baseResponseEvent = {
      approvalId: 'approval-123',
      taskId: 'task-456',
      gateName: 'Code Review',
      gateType: 'before-commit' as ApprovalCheckpointType,
      approved: true,
      approver: 'reviewer@company.com',
      timestamp: new Date(),
      requestedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
    };

    it('should accept minimal valid response event data', () => {
      const minimalEvent = {
        approvalId: 'approval-123',
        taskId: 'task-456',
        gateName: 'Test Gate',
        gateType: 'custom' as ApprovalCheckpointType,
        approved: false,
        approver: 'user@example.com',
        timestamp: new Date(),
        requestedAt: new Date()
      };

      const parsed = ApprovalResponseEventDataSchema.parse(minimalEvent);
      expect(parsed.approvalId).toBe('approval-123');
      expect(parsed.approved).toBe(false);
      expect(parsed.approver).toBe('user@example.com');
    });

    it('should accept complete response event data', () => {
      const completeEvent: ApprovalResponseEventData = {
        approvalId: 'approval-789',
        taskId: 'task-101',
        gateName: 'Security Review',
        gateType: 'before-deploy',
        approved: true,
        approver: 'security-team@company.com',
        comment: 'Security review passed, deployment approved',
        timestamp: new Date('2024-01-01T10:30:00Z'),
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        responseTimeMs: 30 * 60 * 1000, // 30 minutes
        stage: 'deployment',
        approvalsReceived: 2,
        approvalsRequired: 2,
        allApprovalsReceived: true,
        context: {
          reviewType: 'manual',
          deploymentTarget: 'production'
        }
      };

      const parsed = ApprovalResponseEventDataSchema.parse(completeEvent);
      expect(parsed.approvalId).toBe('approval-789');
      expect(parsed.approved).toBe(true);
      expect(parsed.comment).toBe('Security review passed, deployment approved');
      expect(parsed.responseTimeMs).toBe(30 * 60 * 1000);
      expect(parsed.approvalsReceived).toBe(2);
      expect(parsed.allApprovalsReceived).toBe(true);
    });

    it('should validate required fields', () => {
      const requiredFields = [
        'approvalId', 'taskId', 'gateName', 'gateType',
        'approved', 'approver', 'timestamp', 'requestedAt'
      ];

      requiredFields.forEach(field => {
        const eventWithoutField = { ...baseResponseEvent };
        delete eventWithoutField[field as keyof typeof eventWithoutField];

        expect(() => ApprovalResponseEventDataSchema.parse(eventWithoutField))
          .toThrow();
      });
    });

    it('should validate string constraints', () => {
      // Empty strings for required string fields
      const stringFields = ['approvalId', 'taskId', 'gateName', 'approver'];

      stringFields.forEach(field => {
        const eventWithEmptyField = {
          ...baseResponseEvent,
          [field]: ''
        };

        expect(() => ApprovalResponseEventDataSchema.parse(eventWithEmptyField))
          .toThrow();
      });
    });

    it('should validate number constraints', () => {
      // Negative responseTimeMs
      expect(() => ApprovalResponseEventDataSchema.parse({
        ...baseResponseEvent,
        responseTimeMs: -1
      })).toThrow();

      // Negative approvalsReceived
      expect(() => ApprovalResponseEventDataSchema.parse({
        ...baseResponseEvent,
        approvalsReceived: -1
      })).toThrow();

      // Zero approvalsRequired
      expect(() => ApprovalResponseEventDataSchema.parse({
        ...baseResponseEvent,
        approvalsRequired: 0
      })).toThrow();
    });

    it('should handle both approval and denial', () => {
      // Test approval
      const approvalEvent = { ...baseResponseEvent, approved: true };
      const parsedApproval = ApprovalResponseEventDataSchema.parse(approvalEvent);
      expect(parsedApproval.approved).toBe(true);

      // Test denial
      const denialEvent = { ...baseResponseEvent, approved: false };
      const parsedDenial = ApprovalResponseEventDataSchema.parse(denialEvent);
      expect(parsedDenial.approved).toBe(false);
    });

    it('should validate checkpoint types', () => {
      const validTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'custom'
      ];

      validTypes.forEach(gateType => {
        const event = { ...baseResponseEvent, gateType };
        const parsed = ApprovalResponseEventDataSchema.parse(event);
        expect(parsed.gateType).toBe(gateType);
      });
    });
  });

  describe('ApprovalEventData union type', () => {
    it('should accept ApprovalRequiredEventData', () => {
      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: 'approval-123',
        taskId: 'task-456',
        gateName: 'Test Gate',
        gateType: 'custom',
        requestedAt: new Date()
      };

      // Type should compile and be assignable
      const eventData: ApprovalEventData = requiredEvent;
      expect(eventData.approvalId).toBe('approval-123');
      expect(eventData.taskId).toBe('task-456');
    });

    it('should accept ApprovalResponseEventData', () => {
      const responseEvent: ApprovalResponseEventData = {
        approvalId: 'approval-123',
        taskId: 'task-456',
        gateName: 'Test Gate',
        gateType: 'custom',
        approved: true,
        approver: 'user@example.com',
        timestamp: new Date(),
        requestedAt: new Date()
      };

      // Type should compile and be assignable
      const eventData: ApprovalEventData = responseEvent;
      expect(eventData.approvalId).toBe('approval-123');
      expect(eventData.taskId).toBe('task-456');
    });

    it('should support type discrimination', () => {
      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: 'approval-123',
        taskId: 'task-456'
      };

      const responseEvent: ApprovalResponseEventData = {
        approvalId: 'approval-456',
        taskId: 'task-789',
        gateName: 'Test Gate',
        gateType: 'custom',
        approved: true,
        approver: 'user@example.com',
        timestamp: new Date(),
        requestedAt: new Date()
      };

      const events: ApprovalEventData[] = [requiredEvent, responseEvent];

      // Should be able to distinguish between event types
      events.forEach(event => {
        if ('approved' in event) {
          // This is a response event
          expect(typeof event.approved).toBe('boolean');
          expect(typeof event.approver).toBe('string');
        } else {
          // This is a required event
          expect('approvalId' in event).toBe(true);
          expect('taskId' in event).toBe(true);
          expect('approved' in event).toBe(false);
        }
      });
    });
  });

  describe('Integration with Task status', () => {
    it('should validate awaiting-approval status exists in TaskStatus', () => {
      const status = 'awaiting-approval';
      expect(() => TaskStatusSchema.parse(status)).not.toThrow();

      const parsed = TaskStatusSchema.parse(status);
      expect(parsed).toBe('awaiting-approval');
    });

    it('should support workflow with approval states', () => {
      // Test that the approval types work together in a realistic scenario
      const approvalState: ApprovalState = {
        id: 'approval-workflow-123',
        taskId: 'task-workflow-456',
        gateName: 'Pre-Production Gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'deployment',
        agent: 'devops',
        approvalsRequired: 2,
        timeoutMinutes: 120
      };

      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: approvalState.id,
        taskId: approvalState.taskId,
        gateName: approvalState.gateName,
        gateType: 'before-deploy',
        stage: approvalState.stage,
        requiredApprovals: approvalState.approvalsRequired,
        timeout: approvalState.timeoutMinutes,
        requestedAt: approvalState.requestedAt
      };

      const responseEvent: ApprovalResponseEventData = {
        approvalId: approvalState.id,
        taskId: approvalState.taskId,
        gateName: approvalState.gateName!,
        gateType: 'before-deploy',
        approved: true,
        approver: 'ops-team@company.com',
        timestamp: new Date(),
        requestedAt: approvalState.requestedAt,
        stage: approvalState.stage,
        approvalsReceived: 1,
        approvalsRequired: approvalState.approvalsRequired,
        allApprovalsReceived: false
      };

      // All should parse successfully
      expect(() => ApprovalStateSchema.parse(approvalState)).not.toThrow();
      expect(() => ApprovalRequiredEventDataSchema.parse(requiredEvent)).not.toThrow();
      expect(() => ApprovalResponseEventDataSchema.parse(responseEvent)).not.toThrow();

      // Verify data consistency
      expect(approvalState.id).toBe(requiredEvent.approvalId);
      expect(approvalState.id).toBe(responseEvent.approvalId);
      expect(approvalState.taskId).toBe(requiredEvent.taskId);
      expect(approvalState.taskId).toBe(responseEvent.taskId);
    });
  });
});