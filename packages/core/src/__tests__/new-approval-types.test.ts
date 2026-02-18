/**
 * Comprehensive test coverage for NEW ApprovalRequest and ApprovalResponse schemas
 *
 * Tests the new approval workflow types as specified in the acceptance criteria:
 * - ApprovalRequest: requestId, taskId, description, resourceImpact, reason + legacy fields
 * - ApprovalResponse: requestId, taskId, response (approved/denied/info-requested), message + legacy fields
 *
 * These tests focus on the NEW fields added to support the v0.5.0 feature development.
 */

import { describe, it, expect } from 'vitest';
import {
  ApprovalRequestSchema,
  ApprovalRequest,
  ApprovalResponseSchema,
  ApprovalResponse,
} from '../types';

describe('New ApprovalRequest and ApprovalResponse Schema Tests', () => {
  describe('ApprovalRequestSchema - New Fields', () => {
    const baseNewRequest = {
      // NEW required fields from acceptance criteria
      requestId: 'req-12345',
      taskId: 'task-67890',
      description: 'Approval required for database migration',
      reason: 'Schema changes require manual review',

      // Legacy required fields (for backward compatibility)
      id: 'approval-legacy-123',
      gateName: 'Database Migration Gate',
      gateType: 'before-deploy' as const,
      requestedAt: new Date('2024-01-01T10:00:00Z')
    };

    it('should accept minimal valid request with new required fields', () => {
      const parsed = ApprovalRequestSchema.parse(baseNewRequest);

      // Verify NEW fields
      expect(parsed.requestId).toBe('req-12345');
      expect(parsed.taskId).toBe('task-67890');
      expect(parsed.description).toBe('Approval required for database migration');
      expect(parsed.reason).toBe('Schema changes require manual review');
      expect(parsed.resourceImpact).toBeUndefined(); // optional field

      // Verify legacy fields still work
      expect(parsed.id).toBe('approval-legacy-123');
      expect(parsed.gateName).toBe('Database Migration Gate');
      expect(parsed.gateType).toBe('before-deploy');
    });

    it('should accept request with resourceImpact field', () => {
      const requestWithResourceImpact = {
        ...baseNewRequest,
        resourceImpact: 'high'
      };

      const parsed = ApprovalRequestSchema.parse(requestWithResourceImpact);

      expect(parsed.resourceImpact).toBe('high');
      expect(parsed.requestId).toBe('req-12345');
      expect(parsed.taskId).toBe('task-67890');
    });

    it('should handle various resourceImpact values', () => {
      const impactLevels = ['low', 'medium', 'high', 'critical', 'minimal'];

      impactLevels.forEach(impact => {
        const request = {
          ...baseNewRequest,
          resourceImpact: impact
        };

        const parsed = ApprovalRequestSchema.parse(request);
        expect(parsed.resourceImpact).toBe(impact);
      });
    });

    it('should require requestId field', () => {
      const requestMissingRequestId = {
        ...baseNewRequest
      };
      delete requestMissingRequestId.requestId;

      expect(() => ApprovalRequestSchema.parse(requestMissingRequestId)).toThrow();
    });

    it('should reject empty requestId', () => {
      const requestWithEmptyRequestId = {
        ...baseNewRequest,
        requestId: ''
      };

      expect(() => ApprovalRequestSchema.parse(requestWithEmptyRequestId)).toThrow();
    });

    it('should require taskId field', () => {
      const requestMissingTaskId = {
        ...baseNewRequest
      };
      delete requestMissingTaskId.taskId;

      expect(() => ApprovalRequestSchema.parse(requestMissingTaskId)).toThrow();
    });

    it('should reject empty taskId', () => {
      const requestWithEmptyTaskId = {
        ...baseNewRequest,
        taskId: ''
      };

      expect(() => ApprovalRequestSchema.parse(requestWithEmptyTaskId)).toThrow();
    });

    it('should require description field', () => {
      const requestMissingDescription = {
        ...baseNewRequest
      };
      delete requestMissingDescription.description;

      expect(() => ApprovalRequestSchema.parse(requestMissingDescription)).toThrow();
    });

    it('should reject empty description', () => {
      const requestWithEmptyDescription = {
        ...baseNewRequest,
        description: ''
      };

      expect(() => ApprovalRequestSchema.parse(requestWithEmptyDescription)).toThrow();
    });

    it('should require reason field', () => {
      const requestMissingReason = {
        ...baseNewRequest
      };
      delete requestMissingReason.reason;

      expect(() => ApprovalRequestSchema.parse(requestMissingReason)).toThrow();
    });

    it('should reject empty reason', () => {
      const requestWithEmptyReason = {
        ...baseNewRequest,
        reason: ''
      };

      expect(() => ApprovalRequestSchema.parse(requestWithEmptyReason)).toThrow();
    });

    it('should accept complete request with all new and legacy fields', () => {
      const completeNewRequest: ApprovalRequest = {
        // NEW fields
        requestId: 'req-complete-789',
        taskId: 'task-complete-101',
        description: 'Production deployment requiring approval',
        resourceImpact: 'high',
        reason: 'Critical system changes that affect user data',

        // Legacy fields
        id: 'approval-complete-789',
        gateName: 'Production Deployment Gate',
        gateType: 'before-deploy',
        approvers: ['devops-team', 'security-team'],
        minApprovals: 2,
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        timeoutMinutes: 60,
        stage: 'deployment',
        agent: 'deployment-agent',
        context: {
          environment: 'production',
          version: '2.0.0',
          riskLevel: 'high'
        },
        changesSummary: 'Database schema migration and API endpoint updates',
        affectedFiles: ['migrations/001_add_user_preferences.sql', 'src/api/users.ts']
      };

      const parsed = ApprovalRequestSchema.parse(completeNewRequest);

      // Verify all NEW fields
      expect(parsed.requestId).toBe('req-complete-789');
      expect(parsed.taskId).toBe('task-complete-101');
      expect(parsed.description).toBe('Production deployment requiring approval');
      expect(parsed.resourceImpact).toBe('high');
      expect(parsed.reason).toBe('Critical system changes that affect user data');

      // Verify legacy fields still work
      expect(parsed.id).toBe('approval-complete-789');
      expect(parsed.gateName).toBe('Production Deployment Gate');
      expect(parsed.approvers).toEqual(['devops-team', 'security-team']);
      expect(parsed.minApprovals).toBe(2);
      expect(parsed.context).toEqual({
        environment: 'production',
        version: '2.0.0',
        riskLevel: 'high'
      });
      expect(parsed.changesSummary).toBe('Database schema migration and API endpoint updates');
      expect(parsed.affectedFiles).toEqual(['migrations/001_add_user_preferences.sql', 'src/api/users.ts']);
    });
  });

  describe('ApprovalResponseSchema - New Fields', () => {
    const baseNewResponse = {
      // NEW required fields from acceptance criteria
      requestId: 'req-12345',
      taskId: 'task-67890',
      response: 'approved' as const,

      // Legacy required fields (for backward compatibility)
      approvalId: 'approval-legacy-123',
      gateName: 'Test Gate',
      action: 'approve' as const,
      approver: 'reviewer@company.com',
      timestamp: new Date('2024-01-01T10:30:00Z')
    };

    it('should accept minimal valid response with new required fields', () => {
      const parsed = ApprovalResponseSchema.parse(baseNewResponse);

      // Verify NEW fields
      expect(parsed.requestId).toBe('req-12345');
      expect(parsed.taskId).toBe('task-67890');
      expect(parsed.response).toBe('approved');
      expect(parsed.message).toBeUndefined(); // optional field

      // Verify legacy fields still work
      expect(parsed.approvalId).toBe('approval-legacy-123');
      expect(parsed.gateName).toBe('Test Gate');
      expect(parsed.action).toBe('approve');
      expect(parsed.approver).toBe('reviewer@company.com');
    });

    it('should accept all valid response status values', () => {
      const validResponses = ['approved', 'denied', 'info-requested'] as const;

      validResponses.forEach(responseStatus => {
        const response = {
          ...baseNewResponse,
          response: responseStatus
        };

        const parsed = ApprovalResponseSchema.parse(response);
        expect(parsed.response).toBe(responseStatus);
      });
    });

    it('should reject invalid response status values', () => {
      const invalidResponses = ['accept', 'reject', 'pending', 'cancelled', ''];

      invalidResponses.forEach(invalidResponse => {
        const response = {
          ...baseNewResponse,
          response: invalidResponse
        };

        expect(() => ApprovalResponseSchema.parse(response)).toThrow();
      });
    });

    it('should accept response with optional message', () => {
      const responseWithMessage = {
        ...baseNewResponse,
        message: 'Approved after reviewing security considerations'
      };

      const parsed = ApprovalResponseSchema.parse(responseWithMessage);

      expect(parsed.message).toBe('Approved after reviewing security considerations');
      expect(parsed.requestId).toBe('req-12345');
      expect(parsed.response).toBe('approved');
    });

    it('should require requestId field', () => {
      const responseMissingRequestId = {
        ...baseNewResponse
      };
      delete responseMissingRequestId.requestId;

      expect(() => ApprovalResponseSchema.parse(responseMissingRequestId)).toThrow();
    });

    it('should reject empty requestId', () => {
      const responseWithEmptyRequestId = {
        ...baseNewResponse,
        requestId: ''
      };

      expect(() => ApprovalResponseSchema.parse(responseWithEmptyRequestId)).toThrow();
    });

    it('should require taskId field', () => {
      const responseMissingTaskId = {
        ...baseNewResponse
      };
      delete responseMissingTaskId.taskId;

      expect(() => ApprovalResponseSchema.parse(responseMissingTaskId)).toThrow();
    });

    it('should reject empty taskId', () => {
      const responseWithEmptyTaskId = {
        ...baseNewResponse,
        taskId: ''
      };

      expect(() => ApprovalResponseSchema.parse(responseWithEmptyTaskId)).toThrow();
    });

    it('should require response field', () => {
      const responseMissingResponse = {
        ...baseNewResponse
      };
      delete responseMissingResponse.response;

      expect(() => ApprovalResponseSchema.parse(responseMissingResponse)).toThrow();
    });

    it('should accept complete response with all new and legacy fields', () => {
      const completeNewResponse: ApprovalResponse = {
        // NEW fields
        requestId: 'req-complete-456',
        taskId: 'task-complete-789',
        response: 'denied',
        message: 'Security vulnerabilities found, please address before proceeding',

        // Legacy fields
        approvalId: 'approval-complete-456',
        gateName: 'Security Review Gate',
        action: 'deny',
        approver: 'security-team@company.com',
        comment: 'High severity security issues detected',
        timestamp: new Date('2024-01-01T11:00:00Z'),
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        responseTimeMs: 60 * 60 * 1000, // 1 hour
        stage: 'security-review',
        approvalsReceived: 0,
        approvalsRequired: 1,
        resolved: true
      };

      const parsed = ApprovalResponseSchema.parse(completeNewResponse);

      // Verify all NEW fields
      expect(parsed.requestId).toBe('req-complete-456');
      expect(parsed.taskId).toBe('task-complete-789');
      expect(parsed.response).toBe('denied');
      expect(parsed.message).toBe('Security vulnerabilities found, please address before proceeding');

      // Verify legacy fields still work
      expect(parsed.approvalId).toBe('approval-complete-456');
      expect(parsed.gateName).toBe('Security Review Gate');
      expect(parsed.action).toBe('deny');
      expect(parsed.approver).toBe('security-team@company.com');
      expect(parsed.comment).toBe('High severity security issues detected');
      expect(parsed.responseTimeMs).toBe(60 * 60 * 1000);
      expect(parsed.resolved).toBe(true);
    });

    it('should handle different response scenarios with new fields', () => {
      const scenarios = [
        {
          description: 'approved with message',
          response: {
            ...baseNewResponse,
            response: 'approved' as const,
            message: 'Code review passed, deployment approved'
          }
        },
        {
          description: 'denied with detailed message',
          response: {
            ...baseNewResponse,
            response: 'denied' as const,
            message: 'Failed security scan - 3 high severity vulnerabilities found'
          }
        },
        {
          description: 'info-requested with guidance',
          response: {
            ...baseNewResponse,
            response: 'info-requested' as const,
            message: 'Please provide rollback plan and impact assessment'
          }
        },
        {
          description: 'approved without message',
          response: {
            ...baseNewResponse,
            response: 'approved' as const
          }
        }
      ];

      scenarios.forEach(({ description, response }) => {
        expect(() => ApprovalResponseSchema.parse(response),
          `Should parse ${description}`).not.toThrow();

        const parsed = ApprovalResponseSchema.parse(response);
        expect(parsed.response).toBe(response.response);
        expect(parsed.message).toBe(response.message);
        expect(parsed.requestId).toBe('req-12345');
        expect(parsed.taskId).toBe('task-67890');
      });
    });
  });

  describe('New Approval Workflow Integration', () => {
    it('should support complete approval workflow with new schema fields', () => {
      // 1. Create approval request with new fields
      const approvalRequest: ApprovalRequest = {
        // NEW fields
        requestId: 'req-workflow-001',
        taskId: 'task-feature-deploy',
        description: 'Deploy new user authentication feature to production',
        resourceImpact: 'medium',
        reason: 'New authentication system affects user login flow',

        // Legacy fields
        id: 'approval-workflow-001',
        gateName: 'Production Feature Deployment',
        gateType: 'before-deploy',
        approvers: ['tech-lead', 'security-team'],
        minApprovals: 2,
        requestedAt: new Date('2024-01-01T09:00:00Z'),
        stage: 'deployment',
        context: {
          feature: 'oauth-integration',
          environment: 'production'
        }
      };

      // 2. Create approval response with new fields
      const approvalResponse: ApprovalResponse = {
        // NEW fields
        requestId: 'req-workflow-001', // Must match request
        taskId: 'task-feature-deploy', // Must match request
        response: 'approved',
        message: 'Authentication feature approved after security review',

        // Legacy fields
        approvalId: 'approval-workflow-001', // Must match request id
        gateName: 'Production Feature Deployment',
        action: 'approve',
        approver: 'tech-lead@company.com',
        timestamp: new Date('2024-01-01T09:30:00Z'),
        responseTimeMs: 30 * 60 * 1000, // 30 minutes
        resolved: true
      };

      // Both should parse successfully
      expect(() => ApprovalRequestSchema.parse(approvalRequest)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(approvalResponse)).not.toThrow();

      // Verify workflow consistency using NEW fields
      const parsedRequest = ApprovalRequestSchema.parse(approvalRequest);
      const parsedResponse = ApprovalResponseSchema.parse(approvalResponse);

      // NEW field consistency
      expect(parsedResponse.requestId).toBe(parsedRequest.requestId);
      expect(parsedResponse.taskId).toBe(parsedRequest.taskId);
      expect(parsedResponse.response).toBe('approved');
      expect(parsedResponse.message).toContain('Authentication feature approved');

      // Legacy field consistency
      expect(parsedResponse.approvalId).toBe(parsedRequest.id);
      expect(parsedResponse.gateName).toBe(parsedRequest.gateName);
      expect(parsedResponse.action).toBe('approve');
      expect(parsedResponse.resolved).toBe(true);
    });

    it('should support multi-step approval with new fields', () => {
      // Request requiring multiple approvals
      const approvalRequest: ApprovalRequest = {
        requestId: 'req-multi-002',
        taskId: 'task-database-migration',
        description: 'Execute database schema migration for user preferences',
        resourceImpact: 'high',
        reason: 'Schema changes will affect all user accounts and require downtime',

        id: 'approval-multi-002',
        gateName: 'Database Schema Migration',
        gateType: 'before-destructive',
        approvers: ['dba-team', 'senior-engineer', 'ops-manager'],
        minApprovals: 3,
        requestedAt: new Date('2024-01-01T08:00:00Z')
      };

      // First response - requests more information
      const firstResponse: ApprovalResponse = {
        requestId: 'req-multi-002',
        taskId: 'task-database-migration',
        response: 'info-requested',
        message: 'Please provide detailed rollback plan and backup verification steps',

        approvalId: 'approval-multi-002',
        gateName: 'Database Schema Migration',
        action: 'request-info',
        approver: 'dba-lead@company.com',
        timestamp: new Date('2024-01-01T08:15:00Z'),
        resolved: false
      };

      // Second response - approval
      const secondResponse: ApprovalResponse = {
        requestId: 'req-multi-002',
        taskId: 'task-database-migration',
        response: 'approved',
        message: 'Migration plan reviewed and approved, rollback procedures are adequate',

        approvalId: 'approval-multi-002',
        gateName: 'Database Schema Migration',
        action: 'approve',
        approver: 'senior-engineer@company.com',
        timestamp: new Date('2024-01-01T09:45:00Z'),
        resolved: false
      };

      // Third response - final approval
      const thirdResponse: ApprovalResponse = {
        requestId: 'req-multi-002',
        taskId: 'task-database-migration',
        response: 'approved',
        message: 'Operations team approval - migration window confirmed',

        approvalId: 'approval-multi-002',
        gateName: 'Database Schema Migration',
        action: 'approve',
        approver: 'ops-manager@company.com',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        resolved: true
      };

      // All should parse successfully
      expect(() => ApprovalRequestSchema.parse(approvalRequest)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(firstResponse)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(secondResponse)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(thirdResponse)).not.toThrow();

      // Verify workflow progression using NEW fields
      const parsedRequest = ApprovalRequestSchema.parse(approvalRequest);
      const parsedFirst = ApprovalResponseSchema.parse(firstResponse);
      const parsedSecond = ApprovalResponseSchema.parse(secondResponse);
      const parsedThird = ApprovalResponseSchema.parse(thirdResponse);

      // All responses should reference same request
      [parsedFirst, parsedSecond, parsedThird].forEach(response => {
        expect(response.requestId).toBe(parsedRequest.requestId);
        expect(response.taskId).toBe(parsedRequest.taskId);
      });

      // Verify response progression
      expect(parsedFirst.response).toBe('info-requested');
      expect(parsedSecond.response).toBe('approved');
      expect(parsedThird.response).toBe('approved');

      expect(parsedFirst.resolved).toBe(false);
      expect(parsedSecond.resolved).toBe(false);
      expect(parsedThird.resolved).toBe(true);
    });

    it('should support denial workflow with new fields', () => {
      const denialRequest: ApprovalRequest = {
        requestId: 'req-deny-003',
        taskId: 'task-security-patch',
        description: 'Deploy security patch to production environment',
        resourceImpact: 'low',
        reason: 'Critical security vulnerability requires immediate patching',

        id: 'approval-deny-003',
        gateName: 'Security Patch Deployment',
        gateType: 'before-deploy',
        requestedAt: new Date('2024-01-01T11:00:00Z')
      };

      const denialResponse: ApprovalResponse = {
        requestId: 'req-deny-003',
        taskId: 'task-security-patch',
        response: 'denied',
        message: 'Patch conflicts with current production version, requires regression testing first',

        approvalId: 'approval-deny-003',
        gateName: 'Security Patch Deployment',
        action: 'deny',
        approver: 'qa-team@company.com',
        timestamp: new Date('2024-01-01T11:30:00Z'),
        resolved: true
      };

      expect(() => ApprovalRequestSchema.parse(denialRequest)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(denialResponse)).not.toThrow();

      const parsedRequest = ApprovalRequestSchema.parse(denialRequest);
      const parsedResponse = ApprovalResponseSchema.parse(denialResponse);

      // Verify denial using NEW fields
      expect(parsedResponse.requestId).toBe(parsedRequest.requestId);
      expect(parsedResponse.taskId).toBe(parsedRequest.taskId);
      expect(parsedResponse.response).toBe('denied');
      expect(parsedResponse.message).toContain('conflicts with current production version');
      expect(parsedResponse.resolved).toBe(true);
    });
  });

  describe('Backward Compatibility with New Fields', () => {
    it('should maintain compatibility when both new and legacy fields are present', () => {
      const hybridRequest = {
        // NEW fields
        requestId: 'req-hybrid-001',
        taskId: 'task-hybrid-deploy',
        description: 'Hybrid approval request with both new and legacy fields',
        resourceImpact: 'medium',
        reason: 'Testing backward compatibility',

        // Legacy fields
        id: 'approval-hybrid-001',
        gateName: 'Hybrid Compatibility Gate',
        gateType: 'custom' as const,
        requestedAt: new Date('2024-01-01T12:00:00Z')
      };

      const hybridResponse = {
        // NEW fields
        requestId: 'req-hybrid-001',
        taskId: 'task-hybrid-deploy',
        response: 'approved' as const,
        message: 'Compatibility test passed',

        // Legacy fields
        approvalId: 'approval-hybrid-001',
        gateName: 'Hybrid Compatibility Gate',
        action: 'approve' as const,
        approver: 'compatibility-tester',
        timestamp: new Date('2024-01-01T12:15:00Z')
      };

      const parsedRequest = ApprovalRequestSchema.parse(hybridRequest);
      const parsedResponse = ApprovalResponseSchema.parse(hybridResponse);

      // Both new and legacy fields should be accessible
      expect(parsedRequest.requestId).toBe('req-hybrid-001');
      expect(parsedRequest.id).toBe('approval-hybrid-001');

      expect(parsedResponse.requestId).toBe('req-hybrid-001');
      expect(parsedResponse.approvalId).toBe('approval-hybrid-001');
      expect(parsedResponse.response).toBe('approved');
      expect(parsedResponse.action).toBe('approve');
    });

    it('should export all types for external use', () => {
      // TypeScript compilation test - these should not cause type errors
      const request: ApprovalRequest = {
        requestId: 'export-test-req',
        taskId: 'export-test-task',
        description: 'Testing type exports',
        reason: 'Ensure types are properly exported',

        id: 'export-test-approval',
        gateName: 'Export Test Gate',
        gateType: 'custom',
        requestedAt: new Date()
      };

      const response: ApprovalResponse = {
        requestId: request.requestId,
        taskId: request.taskId,
        response: 'approved',

        approvalId: request.id,
        gateName: request.gateName,
        action: 'approve',
        approver: 'export-tester',
        timestamp: new Date()
      };

      // Verify types work correctly
      expect(request.requestId).toBe('export-test-req');
      expect(request.resourceImpact).toBeUndefined();
      expect(response.response).toBe('approved');
      expect(response.message).toBeUndefined();
    });
  });
});