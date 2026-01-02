/**
 * Test coverage for approval decision and response types
 *
 * Tests the approval decision workflow types:
 * - ApprovalDecisionRequest: request to make an approval decision
 * - ApprovalDecisionResponse: response after decision is made
 */

import { describe, it, expect } from 'vitest';
import {
  ApprovalDecisionRequestSchema,
  ApprovalDecisionRequest,
  ApprovalDecisionResponseSchema,
  ApprovalDecisionResponse,
  ApprovalStateSchema,
  ApprovalState
} from '../types';

describe('Approval Decision Types', () => {
  describe('ApprovalDecisionRequestSchema', () => {
    const baseRequest = {
      approvalId: 'approval-123',
      approved: true,
      approver: 'reviewer@company.com'
    };

    it('should accept minimal valid decision request', () => {
      const parsed = ApprovalDecisionRequestSchema.parse(baseRequest);

      expect(parsed.approvalId).toBe('approval-123');
      expect(parsed.approved).toBe(true);
      expect(parsed.approver).toBe('reviewer@company.com');
      expect(parsed.comment).toBeUndefined();
    });

    it('should accept complete decision request with comment', () => {
      const completeRequest: ApprovalDecisionRequest = {
        approvalId: 'approval-456',
        approved: false,
        approver: 'security-team@company.com',
        comment: 'Security vulnerabilities found, please fix before proceeding'
      };

      const parsed = ApprovalDecisionRequestSchema.parse(completeRequest);
      expect(parsed.approvalId).toBe('approval-456');
      expect(parsed.approved).toBe(false);
      expect(parsed.approver).toBe('security-team@company.com');
      expect(parsed.comment).toBe('Security vulnerabilities found, please fix before proceeding');
    });

    it('should validate required fields', () => {
      // Missing approvalId
      expect(() => ApprovalDecisionRequestSchema.parse({
        approved: true,
        approver: 'reviewer@company.com'
      })).toThrow();

      // Missing approved
      expect(() => ApprovalDecisionRequestSchema.parse({
        approvalId: 'approval-123',
        approver: 'reviewer@company.com'
      })).toThrow();

      // Missing approver
      expect(() => ApprovalDecisionRequestSchema.parse({
        approvalId: 'approval-123',
        approved: true
      })).toThrow();
    });

    it('should validate string constraints', () => {
      // Empty approvalId
      expect(() => ApprovalDecisionRequestSchema.parse({
        approvalId: '',
        approved: true,
        approver: 'reviewer@company.com'
      })).toThrow();

      // Empty approver
      expect(() => ApprovalDecisionRequestSchema.parse({
        approvalId: 'approval-123',
        approved: true,
        approver: ''
      })).toThrow();
    });

    it('should handle both approval and denial decisions', () => {
      // Test approval
      const approvalRequest = { ...baseRequest, approved: true };
      const parsedApproval = ApprovalDecisionRequestSchema.parse(approvalRequest);
      expect(parsedApproval.approved).toBe(true);

      // Test denial
      const denialRequest = { ...baseRequest, approved: false };
      const parsedDenial = ApprovalDecisionRequestSchema.parse(denialRequest);
      expect(parsedDenial.approved).toBe(false);
    });

    it('should handle different approver formats', () => {
      const approverFormats = [
        'user@example.com',
        'username',
        'Team Name',
        'user-123',
        'security-team@company.co.uk'
      ];

      approverFormats.forEach(approver => {
        const request = { ...baseRequest, approver };
        const parsed = ApprovalDecisionRequestSchema.parse(request);
        expect(parsed.approver).toBe(approver);
      });
    });

    it('should handle various comment types', () => {
      const comments = [
        'Looks good to me!',
        'LGTM',
        'Changes requested: please fix the security issue in line 42',
        '',  // Empty comment should be valid
        'Multi-line\ncomment\nwith breaks'
      ];

      comments.forEach(comment => {
        const request = { ...baseRequest, comment };
        expect(() => ApprovalDecisionRequestSchema.parse(request)).not.toThrow();
      });
    });
  });

  describe('ApprovalDecisionResponseSchema', () => {
    const sampleApprovalState: ApprovalState = {
      id: 'approval-123',
      taskId: 'task-456',
      gateName: 'Code Review',
      status: 'approved',
      approver: 'reviewer@company.com',
      requestedAt: new Date('2024-01-01T10:00:00Z'),
      respondedAt: new Date('2024-01-01T10:30:00Z'),
      comment: 'Approved after review'
    };

    const baseResponse = {
      success: true
    };

    it('should accept minimal valid decision response', () => {
      const parsed = ApprovalDecisionResponseSchema.parse(baseResponse);

      expect(parsed.success).toBe(true);
      expect(parsed.approvalState).toBeUndefined();
      expect(parsed.error).toBeUndefined();
      expect(parsed.taskWillProceed).toBeUndefined();
    });

    it('should accept complete successful decision response', () => {
      const completeResponse: ApprovalDecisionResponse = {
        success: true,
        approvalState: sampleApprovalState,
        taskWillProceed: true
      };

      const parsed = ApprovalDecisionResponseSchema.parse(completeResponse);
      expect(parsed.success).toBe(true);
      expect(parsed.approvalState).toEqual(sampleApprovalState);
      expect(parsed.taskWillProceed).toBe(true);
      expect(parsed.error).toBeUndefined();
    });

    it('should accept error response', () => {
      const errorResponse: ApprovalDecisionResponse = {
        success: false,
        error: 'Approval request not found',
        taskWillProceed: false
      };

      const parsed = ApprovalDecisionResponseSchema.parse(errorResponse);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Approval request not found');
      expect(parsed.taskWillProceed).toBe(false);
      expect(parsed.approvalState).toBeUndefined();
    });

    it('should validate success field is required', () => {
      expect(() => ApprovalDecisionResponseSchema.parse({})).toThrow();
      expect(() => ApprovalDecisionResponseSchema.parse({
        approvalState: sampleApprovalState,
        taskWillProceed: true
      })).toThrow();
    });

    it('should validate approvalState when provided', () => {
      // Invalid approval state should fail
      const invalidResponse = {
        success: true,
        approvalState: {
          id: '', // Invalid empty id
          taskId: 'task-456',
          gateName: 'Test Gate',
          status: 'pending',
          requestedAt: new Date()
        }
      };

      expect(() => ApprovalDecisionResponseSchema.parse(invalidResponse)).toThrow();
    });

    it('should handle different success/failure scenarios', () => {
      const scenarios = [
        {
          description: 'successful approval',
          response: {
            success: true,
            approvalState: { ...sampleApprovalState, status: 'approved' as const },
            taskWillProceed: true
          }
        },
        {
          description: 'successful denial',
          response: {
            success: true,
            approvalState: { ...sampleApprovalState, status: 'denied' as const },
            taskWillProceed: false
          }
        },
        {
          description: 'partial approval (more approvals needed)',
          response: {
            success: true,
            approvalState: {
              ...sampleApprovalState,
              status: 'pending' as const,
              approvalsReceived: 1,
              approvalsRequired: 2
            },
            taskWillProceed: false
          }
        },
        {
          description: 'approval not found error',
          response: {
            success: false,
            error: 'Approval ID not found'
          }
        },
        {
          description: 'permission denied error',
          response: {
            success: false,
            error: 'User not authorized to approve this gate'
          }
        },
        {
          description: 'already decided error',
          response: {
            success: false,
            error: 'Approval request has already been decided',
            approvalState: { ...sampleApprovalState, status: 'approved' as const }
          }
        }
      ];

      scenarios.forEach(({ description, response }) => {
        expect(() => ApprovalDecisionResponseSchema.parse(response),
          `Should parse ${description}`).not.toThrow();

        const parsed = ApprovalDecisionResponseSchema.parse(response);
        expect(parsed.success).toBe(response.success);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should support complete approval decision workflow', () => {
      // 1. Create approval decision request
      const decisionRequest: ApprovalDecisionRequest = {
        approvalId: 'approval-workflow-123',
        approved: true,
        approver: 'tech-lead@company.com',
        comment: 'Code looks good, approved for deployment'
      };

      // 2. Process decision and create response
      const updatedApprovalState: ApprovalState = {
        id: 'approval-workflow-123',
        taskId: 'task-deploy-456',
        gateName: 'Production Deployment Gate',
        status: 'approved',
        approver: 'tech-lead@company.com',
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        respondedAt: new Date('2024-01-01T10:15:00Z'),
        comment: 'Code looks good, approved for deployment',
        stage: 'deployment',
        approvalsReceived: 1,
        approvalsRequired: 1
      };

      const decisionResponse: ApprovalDecisionResponse = {
        success: true,
        approvalState: updatedApprovalState,
        taskWillProceed: true
      };

      // All should parse successfully
      expect(() => ApprovalDecisionRequestSchema.parse(decisionRequest)).not.toThrow();
      expect(() => ApprovalDecisionResponseSchema.parse(decisionResponse)).not.toThrow();

      // Verify workflow consistency
      const parsedRequest = ApprovalDecisionRequestSchema.parse(decisionRequest);
      const parsedResponse = ApprovalDecisionResponseSchema.parse(decisionResponse);

      expect(parsedRequest.approvalId).toBe(parsedResponse.approvalState!.id);
      expect(parsedRequest.approved).toBe(true);
      expect(parsedResponse.approvalState!.status).toBe('approved');
      expect(parsedRequest.approver).toBe(parsedResponse.approvalState!.approver);
      expect(parsedRequest.comment).toBe(parsedResponse.approvalState!.comment);
      expect(parsedResponse.taskWillProceed).toBe(true);
    });

    it('should support multi-approval workflow', () => {
      // First approval
      const firstDecision: ApprovalDecisionRequest = {
        approvalId: 'approval-multi-123',
        approved: true,
        approver: 'senior-dev@company.com',
        comment: 'Code review passed'
      };

      const firstResponse: ApprovalDecisionResponse = {
        success: true,
        approvalState: {
          id: 'approval-multi-123',
          taskId: 'task-feature-789',
          gateName: 'Feature Review Gate',
          status: 'pending',  // Still pending, need more approvals
          approver: 'senior-dev@company.com',
          requestedAt: new Date('2024-01-01T10:00:00Z'),
          respondedAt: new Date('2024-01-01T10:10:00Z'),
          comment: 'Code review passed',
          approvalsReceived: 1,
          approvalsRequired: 2
        },
        taskWillProceed: false  // Not yet, need one more approval
      };

      // Second approval
      const secondDecision: ApprovalDecisionRequest = {
        approvalId: 'approval-multi-123',
        approved: true,
        approver: 'architect@company.com',
        comment: 'Architecture review approved'
      };

      const finalResponse: ApprovalDecisionResponse = {
        success: true,
        approvalState: {
          id: 'approval-multi-123',
          taskId: 'task-feature-789',
          gateName: 'Feature Review Gate',
          status: 'approved',  // Now approved
          approver: 'architect@company.com',  // Latest approver
          requestedAt: new Date('2024-01-01T10:00:00Z'),
          respondedAt: new Date('2024-01-01T10:20:00Z'),
          comment: 'Architecture review approved',
          approvalsReceived: 2,
          approvalsRequired: 2
        },
        taskWillProceed: true  // Now can proceed
      };

      // All should parse and maintain consistency
      expect(() => ApprovalDecisionRequestSchema.parse(firstDecision)).not.toThrow();
      expect(() => ApprovalDecisionResponseSchema.parse(firstResponse)).not.toThrow();
      expect(() => ApprovalDecisionRequestSchema.parse(secondDecision)).not.toThrow();
      expect(() => ApprovalDecisionResponseSchema.parse(finalResponse)).not.toThrow();

      expect(firstResponse.taskWillProceed).toBe(false);
      expect(finalResponse.taskWillProceed).toBe(true);
      expect(firstResponse.approvalState!.approvalsReceived).toBe(1);
      expect(finalResponse.approvalState!.approvalsReceived).toBe(2);
    });

    it('should support denial workflow', () => {
      const denialRequest: ApprovalDecisionRequest = {
        approvalId: 'approval-denial-123',
        approved: false,
        approver: 'security-team@company.com',
        comment: 'Security vulnerabilities found in dependencies'
      };

      const denialResponse: ApprovalDecisionResponse = {
        success: true,
        approvalState: {
          id: 'approval-denial-123',
          taskId: 'task-security-456',
          gateName: 'Security Review Gate',
          status: 'denied',
          approver: 'security-team@company.com',
          requestedAt: new Date('2024-01-01T10:00:00Z'),
          respondedAt: new Date('2024-01-01T10:45:00Z'),
          comment: 'Security vulnerabilities found in dependencies'
        },
        taskWillProceed: false
      };

      expect(() => ApprovalDecisionRequestSchema.parse(denialRequest)).not.toThrow();
      expect(() => ApprovalDecisionResponseSchema.parse(denialResponse)).not.toThrow();

      const parsedRequest = ApprovalDecisionRequestSchema.parse(denialRequest);
      const parsedResponse = ApprovalDecisionResponseSchema.parse(denialResponse);

      expect(parsedRequest.approved).toBe(false);
      expect(parsedResponse.approvalState!.status).toBe('denied');
      expect(parsedResponse.taskWillProceed).toBe(false);
    });

    it('should support error scenarios', () => {
      const validRequest: ApprovalDecisionRequest = {
        approvalId: 'approval-missing-123',
        approved: true,
        approver: 'user@company.com'
      };

      const errorScenarios = [
        {
          description: 'approval not found',
          response: {
            success: false,
            error: 'Approval request approval-missing-123 not found'
          }
        },
        {
          description: 'unauthorized user',
          response: {
            success: false,
            error: 'User user@company.com is not authorized to approve this gate'
          }
        },
        {
          description: 'already decided',
          response: {
            success: false,
            error: 'This approval request has already been decided',
            approvalState: {
              id: 'approval-missing-123',
              taskId: 'task-123',
              gateName: 'Test Gate',
              status: 'approved' as const,
              requestedAt: new Date()
            }
          }
        },
        {
          description: 'expired approval',
          response: {
            success: false,
            error: 'This approval request has expired'
          }
        }
      ];

      expect(() => ApprovalDecisionRequestSchema.parse(validRequest)).not.toThrow();

      errorScenarios.forEach(({ description, response }) => {
        expect(() => ApprovalDecisionResponseSchema.parse(response),
          `Should parse ${description} error response`).not.toThrow();

        const parsed = ApprovalDecisionResponseSchema.parse(response);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBeDefined();
      });
    });
  });
});