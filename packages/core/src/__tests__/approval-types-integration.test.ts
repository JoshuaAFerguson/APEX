/**
 * Integration test for approval types and acceptance criteria validation
 *
 * This test verifies that all the acceptance criteria types work together correctly:
 * - ApprovalRequest, ApprovalResponse, ApprovalStatus types with Zod schemas
 * - Event types include 'approval-required', 'approval-resolved'
 * - Types cover approve/deny/request-info actions
 * - All types are properly exported from the core package
 */

import { describe, it, expect } from 'vitest';
import {
  // Core approval types from acceptance criteria
  ApprovalRequestSchema,
  ApprovalRequest,
  ApprovalResponseSchema,
  ApprovalResponse,
  ApprovalStatusSchema,
  ApprovalStatus,
  ApprovalActionSchema,
  ApprovalAction,

  // Event types from acceptance criteria
  ApprovalRequiredEventDataSchema,
  ApprovalRequiredEventData,
  ApprovalResolvedEventDataSchema,
  ApprovalResolvedEventData,

  // Event type enum
  EventTypeSchema,

  // Supporting types
  ApprovalCheckpointTypeSchema,
  ApprovalCheckpointType
} from '../types';

describe('Approval Types Integration - Acceptance Criteria Compliance', () => {
  describe('Acceptance Criteria: Core package exports ApprovalRequest, ApprovalResponse, ApprovalStatus types with Zod schemas', () => {
    it('should export ApprovalRequest type with Zod schema', () => {
      // Verify schema exists and has validation methods
      expect(ApprovalRequestSchema).toBeDefined();
      expect(typeof ApprovalRequestSchema.parse).toBe('function');
      expect(typeof ApprovalRequestSchema.safeParse).toBe('function');

      // Verify type works
      const request: ApprovalRequest = {
        id: 'test-approval-123',
        taskId: 'test-task-456',
        gateName: 'Test Gate',
        gateType: 'before-commit',
        requestedAt: new Date()
      };

      // Schema should validate correctly
      expect(() => ApprovalRequestSchema.parse(request)).not.toThrow();
      const parsed = ApprovalRequestSchema.parse(request);
      expect(parsed.id).toBe('test-approval-123');
      expect(parsed.taskId).toBe('test-task-456');
      expect(parsed.gateName).toBe('Test Gate');
      expect(parsed.gateType).toBe('before-commit');
    });

    it('should export ApprovalResponse type with Zod schema', () => {
      // Verify schema exists and has validation methods
      expect(ApprovalResponseSchema).toBeDefined();
      expect(typeof ApprovalResponseSchema.parse).toBe('function');
      expect(typeof ApprovalResponseSchema.safeParse).toBe('function');

      // Verify type works
      const response: ApprovalResponse = {
        approvalId: 'test-approval-123',
        taskId: 'test-task-456',
        gateName: 'Test Gate',
        action: 'approve',
        approver: 'test-approver',
        timestamp: new Date()
      };

      // Schema should validate correctly
      expect(() => ApprovalResponseSchema.parse(response)).not.toThrow();
      const parsed = ApprovalResponseSchema.parse(response);
      expect(parsed.approvalId).toBe('test-approval-123');
      expect(parsed.taskId).toBe('test-task-456');
      expect(parsed.gateName).toBe('Test Gate');
      expect(parsed.action).toBe('approve');
      expect(parsed.approver).toBe('test-approver');
    });

    it('should export ApprovalStatus type with Zod schema', () => {
      // Verify schema exists and has validation methods
      expect(ApprovalStatusSchema).toBeDefined();
      expect(typeof ApprovalStatusSchema.parse).toBe('function');
      expect(typeof ApprovalStatusSchema.safeParse).toBe('function');

      // Verify all status values work
      const statuses: ApprovalStatus[] = ['pending', 'approved', 'denied'];

      statuses.forEach(status => {
        expect(() => ApprovalStatusSchema.parse(status)).not.toThrow();
        const parsed = ApprovalStatusSchema.parse(status);
        expect(parsed).toBe(status);
      });
    });
  });

  describe('Acceptance Criteria: Event types include approval-required, approval-resolved', () => {
    it('should include approval-required in event types', () => {
      expect(() => EventTypeSchema.parse('approval-required')).not.toThrow();
      const parsed = EventTypeSchema.parse('approval-required');
      expect(parsed).toBe('approval-required');
    });

    it('should include approval-resolved in event types', () => {
      expect(() => EventTypeSchema.parse('approval-resolved')).not.toThrow();
      const parsed = EventTypeSchema.parse('approval-resolved');
      expect(parsed).toBe('approval-resolved');
    });

    it('should export ApprovalRequiredEventData with Zod schema', () => {
      // Verify schema exists and has validation methods
      expect(ApprovalRequiredEventDataSchema).toBeDefined();
      expect(typeof ApprovalRequiredEventDataSchema.parse).toBe('function');
      expect(typeof ApprovalRequiredEventDataSchema.safeParse).toBe('function');

      // Verify event data type works
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'event-approval-123',
        taskId: 'event-task-456',
        gateName: 'Event Test Gate'
      };

      expect(() => ApprovalRequiredEventDataSchema.parse(eventData)).not.toThrow();
      const parsed = ApprovalRequiredEventDataSchema.parse(eventData);
      expect(parsed.approvalId).toBe('event-approval-123');
      expect(parsed.taskId).toBe('event-task-456');
      expect(parsed.gateName).toBe('Event Test Gate');
    });

    it('should export ApprovalResolvedEventData with Zod schema', () => {
      // Verify schema exists and has validation methods
      expect(ApprovalResolvedEventDataSchema).toBeDefined();
      expect(typeof ApprovalResolvedEventDataSchema.parse).toBe('function');
      expect(typeof ApprovalResolvedEventDataSchema.safeParse).toBe('function');

      // Verify event data type works
      const eventData: ApprovalResolvedEventData = {
        approvalId: 'resolved-approval-123',
        taskId: 'resolved-task-456',
        gateName: 'Resolved Test Gate',
        resolution: 'approved'
      };

      expect(() => ApprovalResolvedEventDataSchema.parse(eventData)).not.toThrow();
      const parsed = ApprovalResolvedEventDataSchema.parse(eventData);
      expect(parsed.approvalId).toBe('resolved-approval-123');
      expect(parsed.taskId).toBe('resolved-task-456');
      expect(parsed.gateName).toBe('Resolved Test Gate');
      expect(parsed.resolution).toBe('approved');
    });
  });

  describe('Acceptance Criteria: Types cover approve/deny/request-info actions', () => {
    it('should export ApprovalAction type covering approve/deny/request-info', () => {
      // Verify schema exists and has validation methods
      expect(ApprovalActionSchema).toBeDefined();
      expect(typeof ApprovalActionSchema.parse).toBe('function');
      expect(typeof ApprovalActionSchema.safeParse).toBe('function');

      // Verify all required actions are supported
      const actions: ApprovalAction[] = ['approve', 'deny', 'request-info'];

      actions.forEach(action => {
        expect(() => ApprovalActionSchema.parse(action)).not.toThrow();
        const parsed = ApprovalActionSchema.parse(action);
        expect(parsed).toBe(action);
      });

      // Verify types work in ApprovalResponse
      const approveResponse: ApprovalResponse = {
        approvalId: 'action-test-1',
        taskId: 'action-task-1',
        gateName: 'Action Test Gate',
        action: 'approve',
        approver: 'test-approver',
        timestamp: new Date()
      };

      const denyResponse: ApprovalResponse = {
        approvalId: 'action-test-2',
        taskId: 'action-task-2',
        gateName: 'Action Test Gate',
        action: 'deny',
        approver: 'test-approver',
        timestamp: new Date()
      };

      const requestInfoResponse: ApprovalResponse = {
        approvalId: 'action-test-3',
        taskId: 'action-task-3',
        gateName: 'Action Test Gate',
        action: 'request-info',
        approver: 'test-approver',
        timestamp: new Date()
      };

      // All should validate correctly
      expect(() => ApprovalResponseSchema.parse(approveResponse)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(denyResponse)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(requestInfoResponse)).not.toThrow();

      // Verify actions are correctly parsed
      const parsedApprove = ApprovalResponseSchema.parse(approveResponse);
      const parsedDeny = ApprovalResponseSchema.parse(denyResponse);
      const parsedRequestInfo = ApprovalResponseSchema.parse(requestInfoResponse);

      expect(parsedApprove.action).toBe('approve');
      expect(parsedDeny.action).toBe('deny');
      expect(parsedRequestInfo.action).toBe('request-info');
    });
  });

  describe('Complete approval workflow integration', () => {
    it('should support end-to-end approval workflow with all acceptance criteria types', () => {
      // 1. Create an approval request
      const approvalRequest: ApprovalRequest = {
        id: 'integration-approval-123',
        taskId: 'integration-task-456',
        gateName: 'Integration Test Gate',
        gateType: 'before-deploy',
        description: 'Integration test approval request',
        approvers: ['integration-tester'],
        minApprovals: 1,
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        timeoutMinutes: 60
      };

      // 2. Create approval-required event
      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: approvalRequest.id,
        taskId: approvalRequest.taskId,
        gateName: approvalRequest.gateName,
        gateType: approvalRequest.gateType,
        description: approvalRequest.description,
        approvers: approvalRequest.approvers,
        minApprovals: approvalRequest.minApprovals,
        timeoutMinutes: approvalRequest.timeoutMinutes,
        requestedAt: approvalRequest.requestedAt
      };

      // 3. Create approval response with 'approve' action
      const approvalResponse: ApprovalResponse = {
        approvalId: approvalRequest.id,
        taskId: approvalRequest.taskId,
        gateName: approvalRequest.gateName,
        action: 'approve', // Testing the approve action from acceptance criteria
        approver: 'integration-tester',
        comment: 'Integration test approval granted',
        timestamp: new Date('2024-01-01T10:15:00Z'),
        resolved: true
      };

      // 4. Create approval-resolved event
      const resolvedEvent: ApprovalResolvedEventData = {
        approvalId: approvalRequest.id,
        taskId: approvalRequest.taskId,
        gateName: approvalRequest.gateName,
        resolution: 'approved',
        resolvedBy: 'integration-tester',
        resolvedAt: new Date('2024-01-01T10:15:00Z'),
        finalComment: 'Integration test approval granted',
        approvalsReceived: 1,
        approvalsRequired: 1
      };

      // All schemas should validate successfully
      expect(() => ApprovalRequestSchema.parse(approvalRequest)).not.toThrow();
      expect(() => ApprovalRequiredEventDataSchema.parse(requiredEvent)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(approvalResponse)).not.toThrow();
      expect(() => ApprovalResolvedEventDataSchema.parse(resolvedEvent)).not.toThrow();

      // Verify workflow consistency
      const parsedRequest = ApprovalRequestSchema.parse(approvalRequest);
      const parsedRequired = ApprovalRequiredEventDataSchema.parse(requiredEvent);
      const parsedResponse = ApprovalResponseSchema.parse(approvalResponse);
      const parsedResolved = ApprovalResolvedEventDataSchema.parse(resolvedEvent);

      // Verify IDs match across workflow
      expect(parsedRequired.approvalId).toBe(parsedRequest.id);
      expect(parsedResponse.approvalId).toBe(parsedRequest.id);
      expect(parsedResolved.approvalId).toBe(parsedRequest.id);

      // Verify task IDs match
      expect(parsedRequired.taskId).toBe(parsedRequest.taskId);
      expect(parsedResponse.taskId).toBe(parsedRequest.taskId);
      expect(parsedResolved.taskId).toBe(parsedRequest.taskId);

      // Verify gate names match
      expect(parsedRequired.gateName).toBe(parsedRequest.gateName);
      expect(parsedResponse.gateName).toBe(parsedRequest.gateName);
      expect(parsedResolved.gateName).toBe(parsedRequest.gateName);

      // Verify action and resolution consistency
      expect(parsedResponse.action).toBe('approve');
      expect(parsedResolved.resolution).toBe('approved');
      expect(parsedResponse.resolved).toBe(true);

      // Verify approval counts
      expect(parsedResolved.approvalsReceived).toBe(parsedRequest.minApprovals);
      expect(parsedResolved.approvalsRequired).toBe(parsedRequest.minApprovals);
    });

    it('should support denial workflow with all acceptance criteria types', () => {
      // Test the 'deny' action from acceptance criteria
      const denialResponse: ApprovalResponse = {
        approvalId: 'denial-test-123',
        taskId: 'denial-task-456',
        gateName: 'Denial Test Gate',
        action: 'deny', // Testing the deny action from acceptance criteria
        approver: 'security-reviewer',
        comment: 'Security vulnerabilities found',
        reason: 'security-policy-violation',
        timestamp: new Date('2024-01-01T10:30:00Z'),
        resolved: true
      };

      const denialResolvedEvent: ApprovalResolvedEventData = {
        approvalId: 'denial-test-123',
        taskId: 'denial-task-456',
        gateName: 'Denial Test Gate',
        resolution: 'denied',
        resolvedBy: 'security-reviewer',
        resolvedAt: new Date('2024-01-01T10:30:00Z'),
        finalComment: 'Security vulnerabilities found',
        reason: 'security-policy-violation',
        approvalsReceived: 0,
        approvalsRequired: 1
      };

      // Both should validate correctly
      expect(() => ApprovalResponseSchema.parse(denialResponse)).not.toThrow();
      expect(() => ApprovalResolvedEventDataSchema.parse(denialResolvedEvent)).not.toThrow();

      const parsedResponse = ApprovalResponseSchema.parse(denialResponse);
      const parsedResolved = ApprovalResolvedEventDataSchema.parse(denialResolvedEvent);

      expect(parsedResponse.action).toBe('deny');
      expect(parsedResolved.resolution).toBe('denied');
      expect(parsedResponse.resolved).toBe(true);
      expect(parsedResolved.approvalsReceived).toBe(0);
    });

    it('should support request-info workflow with all acceptance criteria types', () => {
      // Test the 'request-info' action from acceptance criteria
      const requestInfoResponse: ApprovalResponse = {
        approvalId: 'request-info-test-123',
        taskId: 'request-info-task-456',
        gateName: 'Request Info Test Gate',
        action: 'request-info', // Testing the request-info action from acceptance criteria
        approver: 'senior-reviewer',
        comment: 'Please provide more details about the deployment strategy',
        timestamp: new Date('2024-01-01T10:20:00Z'),
        resolved: false // request-info doesn't resolve the approval
      };

      // Should validate correctly
      expect(() => ApprovalResponseSchema.parse(requestInfoResponse)).not.toThrow();

      const parsed = ApprovalResponseSchema.parse(requestInfoResponse);
      expect(parsed.action).toBe('request-info');
      expect(parsed.resolved).toBe(false);
      expect(parsed.comment).toContain('more details');
    });
  });

  describe('Type export validation', () => {
    it('should confirm all acceptance criteria types are exported from core package', () => {
      const exportedTypes = [
        // Types and Schemas from acceptance criteria
        ApprovalRequest,
        ApprovalRequestSchema,
        ApprovalResponse,
        ApprovalResponseSchema,
        ApprovalStatus,
        ApprovalStatusSchema,
        ApprovalAction,
        ApprovalActionSchema,
        ApprovalRequiredEventData,
        ApprovalRequiredEventDataSchema,
        ApprovalResolvedEventData,
        ApprovalResolvedEventDataSchema,

        // Supporting types
        ApprovalCheckpointType,
        ApprovalCheckpointTypeSchema
      ];

      // All should be defined (if this test runs, imports worked)
      exportedTypes.forEach((exportedItem, index) => {
        expect(exportedItem).toBeDefined();
      });
    });

    it('should allow creating all acceptance criteria types without imports', () => {
      // This test verifies that all the required types from acceptance criteria work
      const status: ApprovalStatus = 'pending';
      const action: ApprovalAction = 'approve';
      const checkpointType: ApprovalCheckpointType = 'before-commit';

      const request: ApprovalRequest = {
        id: 'export-validation-1',
        taskId: 'export-task-1',
        gateName: 'Export Validation Gate',
        gateType: checkpointType,
        requestedAt: new Date()
      };

      const response: ApprovalResponse = {
        approvalId: request.id,
        taskId: request.taskId,
        gateName: request.gateName,
        action,
        approver: 'export-validator',
        timestamp: new Date()
      };

      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: request.id,
        taskId: request.taskId,
        gateName: request.gateName
      };

      const resolvedEvent: ApprovalResolvedEventData = {
        approvalId: request.id,
        taskId: request.taskId,
        gateName: request.gateName,
        resolution: 'approved'
      };

      // Verify all types work as expected
      expect(status).toBe('pending');
      expect(action).toBe('approve');
      expect(checkpointType).toBe('before-commit');
      expect(request.gateType).toBe('before-commit');
      expect(response.action).toBe('approve');
      expect(requiredEvent.approvalId).toBe(request.id);
      expect(resolvedEvent.resolution).toBe('approved');
    });
  });
});