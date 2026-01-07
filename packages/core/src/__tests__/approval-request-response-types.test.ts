/**
 * Comprehensive test coverage for ApprovalRequest, ApprovalResponse, and ApprovalAction types
 *
 * Tests the core approval workflow types as specified in the acceptance criteria:
 * - ApprovalRequest: request for approval with all necessary context
 * - ApprovalResponse: response to an approval request with decision and context
 * - ApprovalAction: actions that can be taken (approve, deny, request-info)
 */

import { describe, it, expect } from 'vitest';
import {
  ApprovalRequestSchema,
  ApprovalRequest,
  ApprovalResponseSchema,
  ApprovalResponse,
  ApprovalActionSchema,
  ApprovalAction,
  ApprovalStatusSchema,
  ApprovalStatus,
  ApprovalCheckpointTypeSchema,
  ApprovalCheckpointType
} from '../types';

describe('Approval Request/Response Types - Acceptance Criteria Validation', () => {
  describe('ApprovalActionSchema', () => {
    it('should accept all valid approval actions', () => {
      const validActions: ApprovalAction[] = ['approve', 'deny', 'request-info'];

      validActions.forEach(action => {
        expect(() => ApprovalActionSchema.parse(action)).not.toThrow();
        const parsed = ApprovalActionSchema.parse(action);
        expect(parsed).toBe(action);
      });
    });

    it('should reject invalid approval actions', () => {
      const invalidActions = ['accept', 'reject', 'cancel', 'ignore', ''];

      invalidActions.forEach(action => {
        expect(() => ApprovalActionSchema.parse(action)).toThrow();
      });
    });

    it('should support TypeScript type checking', () => {
      // These should compile without errors
      const approveAction: ApprovalAction = 'approve';
      const denyAction: ApprovalAction = 'deny';
      const requestInfoAction: ApprovalAction = 'request-info';

      expect(approveAction).toBe('approve');
      expect(denyAction).toBe('deny');
      expect(requestInfoAction).toBe('request-info');
    });
  });

  describe('ApprovalRequestSchema', () => {
    const baseRequest = {
      id: 'approval-request-123',
      taskId: 'task-456',
      gateName: 'Code Review Gate',
      gateType: 'before-commit' as ApprovalCheckpointType,
      requestedAt: new Date('2024-01-01T10:00:00Z')
    };

    it('should accept minimal valid approval request', () => {
      const parsed = ApprovalRequestSchema.parse(baseRequest);

      expect(parsed.id).toBe('approval-request-123');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.gateName).toBe('Code Review Gate');
      expect(parsed.gateType).toBe('before-commit');
      expect(parsed.requestedAt).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(parsed.minApprovals).toBe(1); // default value
    });

    it('should accept complete approval request with all optional fields', () => {
      const completeRequest: ApprovalRequest = {
        id: 'approval-complete-456',
        taskId: 'task-789',
        gateName: 'Production Deployment Gate',
        gateType: 'before-deploy',
        description: 'Requires approval before deploying to production environment',
        approvers: ['devops-team', 'tech-lead', 'security-team'],
        minApprovals: 2,
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        timeoutMinutes: 120,
        expiresAt: new Date('2024-01-01T12:00:00Z'),
        stage: 'deployment',
        agent: 'devops',
        priority: 'high',
        context: {
          environment: 'production',
          riskLevel: 'medium',
          changeType: 'feature-release'
        },
        metadata: {
          buildId: 'build-789',
          commitSha: 'abc123def456',
          branch: 'main'
        },
        affectedFiles: ['src/api/auth.ts', 'src/config/production.yaml']
      };

      const parsed = ApprovalRequestSchema.parse(completeRequest);

      expect(parsed.id).toBe('approval-complete-456');
      expect(parsed.taskId).toBe('task-789');
      expect(parsed.gateName).toBe('Production Deployment Gate');
      expect(parsed.gateType).toBe('before-deploy');
      expect(parsed.description).toBe('Requires approval before deploying to production environment');
      expect(parsed.approvers).toEqual(['devops-team', 'tech-lead', 'security-team']);
      expect(parsed.minApprovals).toBe(2);
      expect(parsed.timeoutMinutes).toBe(120);
      expect(parsed.stage).toBe('deployment');
      expect(parsed.agent).toBe('devops');
      expect(parsed.priority).toBe('high');
      expect(parsed.context).toEqual({
        environment: 'production',
        riskLevel: 'medium',
        changeType: 'feature-release'
      });
      expect(parsed.metadata).toEqual({
        buildId: 'build-789',
        commitSha: 'abc123def456',
        branch: 'main'
      });
      expect(parsed.affectedFiles).toEqual(['src/api/auth.ts', 'src/config/production.yaml']);
    });

    it('should validate required fields', () => {
      // Missing id
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        id: undefined
      })).toThrow();

      // Empty id
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        id: ''
      })).toThrow();

      // Missing taskId
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        taskId: undefined
      })).toThrow();

      // Empty taskId
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        taskId: ''
      })).toThrow();

      // Missing gateName
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        gateName: undefined
      })).toThrow();

      // Empty gateName
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        gateName: ''
      })).toThrow();

      // Missing gateType
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        gateType: undefined
      })).toThrow();

      // Missing requestedAt
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        requestedAt: undefined
      })).toThrow();
    });

    it('should validate string constraints', () => {
      // ID too short
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        id: ''
      })).toThrow();

      // TaskId too short
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        taskId: ''
      })).toThrow();

      // GateName too short
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        gateName: ''
      })).toThrow();
    });

    it('should validate number constraints', () => {
      // minApprovals too low
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        minApprovals: 0
      })).toThrow();

      // negative minApprovals
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        minApprovals: -1
      })).toThrow();

      // timeoutMinutes too low
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        timeoutMinutes: 0
      })).toThrow();

      // negative timeoutMinutes
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        timeoutMinutes: -5
      })).toThrow();
    });

    it('should validate gate types', () => {
      const validGateTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'deployment',
        'custom'
      ];

      validGateTypes.forEach(gateType => {
        const request = { ...baseRequest, gateType };
        expect(() => ApprovalRequestSchema.parse(request)).not.toThrow();
        const parsed = ApprovalRequestSchema.parse(request);
        expect(parsed.gateType).toBe(gateType);
      });

      // Invalid gate type
      expect(() => ApprovalRequestSchema.parse({
        ...baseRequest,
        gateType: 'invalid-gate-type' as any
      })).toThrow();
    });

    it('should handle various approver formats', () => {
      const approverLists = [
        ['user@example.com'],
        ['team1', 'team2', 'team3'],
        ['senior-dev@company.com', 'tech-lead', 'architect@company.co.uk'],
        [] // Empty array should be valid
      ];

      approverLists.forEach(approvers => {
        const request = { ...baseRequest, approvers };
        expect(() => ApprovalRequestSchema.parse(request)).not.toThrow();
        const parsed = ApprovalRequestSchema.parse(request);
        expect(parsed.approvers).toEqual(approvers);
      });
    });

    it('should handle complex context objects', () => {
      const contextExamples = [
        {},
        { simple: 'value' },
        {
          environment: 'production',
          riskLevel: 'high',
          deploymentType: 'blue-green',
          rollbackPlan: true,
          affectedServices: ['api', 'frontend'],
          estimatedDowntime: 0
        },
        {
          nested: {
            config: {
              database: 'postgresql',
              replicas: 3
            }
          },
          metrics: [
            { name: 'cpu', threshold: 80 },
            { name: 'memory', threshold: 90 }
          ]
        }
      ];

      contextExamples.forEach(context => {
        const request = { ...baseRequest, context };
        expect(() => ApprovalRequestSchema.parse(request)).not.toThrow();
        const parsed = ApprovalRequestSchema.parse(request);
        expect(parsed.context).toEqual(context);
      });
    });

    it('should handle metadata objects', () => {
      const metadataExamples = [
        {},
        { version: '1.2.3' },
        {
          buildId: 'jenkins-123',
          commitSha: '1a2b3c4d5e6f',
          branch: 'feature/new-auth',
          pullRequest: 456,
          author: 'developer@company.com',
          buildDuration: 180000
        }
      ];

      metadataExamples.forEach(metadata => {
        const request = { ...baseRequest, metadata };
        expect(() => ApprovalRequestSchema.parse(request)).not.toThrow();
        const parsed = ApprovalRequestSchema.parse(request);
        expect(parsed.metadata).toEqual(metadata);
      });
    });

    it('should handle file lists', () => {
      const fileLists = [
        [],
        ['README.md'],
        ['src/auth.ts', 'src/config.yaml', 'tests/auth.test.ts'],
        ['package.json', 'src/api/routes/auth.js', 'docs/api.md', 'config/production.yaml']
      ];

      fileLists.forEach(affectedFiles => {
        const request = { ...baseRequest, affectedFiles };
        expect(() => ApprovalRequestSchema.parse(request)).not.toThrow();
        const parsed = ApprovalRequestSchema.parse(request);
        expect(parsed.affectedFiles).toEqual(affectedFiles);
      });
    });
  });

  describe('ApprovalResponseSchema', () => {
    const baseResponse = {
      approvalId: 'approval-123',
      taskId: 'task-456',
      gateName: 'Test Gate',
      action: 'approve' as ApprovalAction,
      approver: 'reviewer@company.com',
      timestamp: new Date('2024-01-01T10:30:00Z')
    };

    it('should accept minimal valid approval response', () => {
      const parsed = ApprovalResponseSchema.parse(baseResponse);

      expect(parsed.approvalId).toBe('approval-123');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.gateName).toBe('Test Gate');
      expect(parsed.action).toBe('approve');
      expect(parsed.approver).toBe('reviewer@company.com');
      expect(parsed.timestamp).toEqual(new Date('2024-01-01T10:30:00Z'));
      expect(parsed.resolved).toBe(false); // default value
    });

    it('should accept complete approval response with all optional fields', () => {
      const completeResponse: ApprovalResponse = {
        approvalId: 'approval-complete-789',
        taskId: 'task-complete-101',
        gateName: 'Security Review Gate',
        action: 'deny',
        approver: 'security-team@company.com',
        comment: 'Security vulnerabilities found in dependencies, please update before proceeding',
        reason: 'security-policy-violation',
        timestamp: new Date('2024-01-01T10:45:00Z'),
        stage: 'security-review',
        agent: 'security-agent',
        priority: 'critical',
        context: {
          vulnerabilities: ['CVE-2023-1234', 'CVE-2023-5678'],
          severity: 'high',
          recommendation: 'update-dependencies'
        },
        metadata: {
          scanId: 'security-scan-456',
          tools: ['snyk', 'sonarqube'],
          scanDuration: 120000
        },
        responseTimeMs: 15 * 60 * 1000, // 15 minutes
        resolved: true
      };

      const parsed = ApprovalResponseSchema.parse(completeResponse);

      expect(parsed.approvalId).toBe('approval-complete-789');
      expect(parsed.taskId).toBe('task-complete-101');
      expect(parsed.gateName).toBe('Security Review Gate');
      expect(parsed.action).toBe('deny');
      expect(parsed.approver).toBe('security-team@company.com');
      expect(parsed.comment).toBe('Security vulnerabilities found in dependencies, please update before proceeding');
      expect(parsed.reason).toBe('security-policy-violation');
      expect(parsed.stage).toBe('security-review');
      expect(parsed.agent).toBe('security-agent');
      expect(parsed.priority).toBe('critical');
      expect(parsed.context).toEqual({
        vulnerabilities: ['CVE-2023-1234', 'CVE-2023-5678'],
        severity: 'high',
        recommendation: 'update-dependencies'
      });
      expect(parsed.metadata).toEqual({
        scanId: 'security-scan-456',
        tools: ['snyk', 'sonarqube'],
        scanDuration: 120000
      });
      expect(parsed.responseTimeMs).toBe(15 * 60 * 1000);
      expect(parsed.resolved).toBe(true);
    });

    it('should validate required fields', () => {
      // Missing approvalId
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        approvalId: undefined
      })).toThrow();

      // Empty approvalId
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        approvalId: ''
      })).toThrow();

      // Missing taskId
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        taskId: undefined
      })).toThrow();

      // Empty taskId
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        taskId: ''
      })).toThrow();

      // Missing gateName
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        gateName: undefined
      })).toThrow();

      // Empty gateName
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        gateName: ''
      })).toThrow();

      // Missing action
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        action: undefined
      })).toThrow();

      // Missing approver
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        approver: undefined
      })).toThrow();

      // Empty approver
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        approver: ''
      })).toThrow();

      // Missing timestamp
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        timestamp: undefined
      })).toThrow();
    });

    it('should validate approval actions', () => {
      const validActions: ApprovalAction[] = ['approve', 'deny', 'request-info'];

      validActions.forEach(action => {
        const response = { ...baseResponse, action };
        expect(() => ApprovalResponseSchema.parse(response)).not.toThrow();
        const parsed = ApprovalResponseSchema.parse(response);
        expect(parsed.action).toBe(action);
      });

      // Invalid action
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        action: 'invalid-action' as any
      })).toThrow();
    });

    it('should handle different approval scenarios', () => {
      const scenarios = [
        {
          description: 'approved response',
          response: {
            ...baseResponse,
            action: 'approve' as ApprovalAction,
            comment: 'Code looks good, approved for deployment',
            resolved: true
          }
        },
        {
          description: 'denied response',
          response: {
            ...baseResponse,
            action: 'deny' as ApprovalAction,
            comment: 'Please fix the security issues before proceeding',
            reason: 'security-issues',
            resolved: true
          }
        },
        {
          description: 'request-info response',
          response: {
            ...baseResponse,
            action: 'request-info' as ApprovalAction,
            comment: 'Can you provide more details about the deployment strategy?',
            resolved: false
          }
        }
      ];

      scenarios.forEach(({ description, response }) => {
        expect(() => ApprovalResponseSchema.parse(response),
          `Should parse ${description}`).not.toThrow();

        const parsed = ApprovalResponseSchema.parse(response);
        expect(parsed.action).toBe(response.action);
        expect(parsed.comment).toBe(response.comment);
        expect(parsed.resolved).toBe(response.resolved);
      });
    });

    it('should validate numeric constraints', () => {
      // Negative responseTimeMs
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        responseTimeMs: -1
      })).toThrow();

      // Zero responseTimeMs should be valid
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        responseTimeMs: 0
      })).not.toThrow();

      // Large responseTimeMs should be valid
      expect(() => ApprovalResponseSchema.parse({
        ...baseResponse,
        responseTimeMs: 24 * 60 * 60 * 1000 // 24 hours
      })).not.toThrow();
    });

    it('should handle different approver formats', () => {
      const approverFormats = [
        'user@example.com',
        'username',
        'Team Name',
        'user-123',
        'security-team@company.co.uk',
        'John Doe <john@company.com>'
      ];

      approverFormats.forEach(approver => {
        const response = { ...baseResponse, approver };
        expect(() => ApprovalResponseSchema.parse(response)).not.toThrow();
        const parsed = ApprovalResponseSchema.parse(response);
        expect(parsed.approver).toBe(approver);
      });
    });
  });

  describe('Approval workflow integration', () => {
    it('should support complete approval request to response workflow', () => {
      // 1. Create approval request
      const approvalRequest: ApprovalRequest = {
        id: 'approval-workflow-123',
        taskId: 'task-deploy-456',
        gateName: 'Production Deployment Gate',
        gateType: 'before-deploy',
        description: 'Approval required for production deployment',
        approvers: ['devops-team', 'tech-lead'],
        minApprovals: 1,
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        timeoutMinutes: 60,
        stage: 'deployment',
        context: {
          environment: 'production',
          version: '2.1.0'
        }
      };

      // 2. Create approval response
      const approvalResponse: ApprovalResponse = {
        approvalId: approvalRequest.id,
        taskId: approvalRequest.taskId,
        gateName: approvalRequest.gateName,
        action: 'approve',
        approver: 'tech-lead@company.com',
        comment: 'Deployment approved after review',
        timestamp: new Date('2024-01-01T10:15:00Z'),
        stage: 'deployment',
        responseTimeMs: 15 * 60 * 1000, // 15 minutes
        resolved: true
      };

      // Both should parse successfully
      expect(() => ApprovalRequestSchema.parse(approvalRequest)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(approvalResponse)).not.toThrow();

      // Verify workflow consistency
      const parsedRequest = ApprovalRequestSchema.parse(approvalRequest);
      const parsedResponse = ApprovalResponseSchema.parse(approvalResponse);

      expect(parsedResponse.approvalId).toBe(parsedRequest.id);
      expect(parsedResponse.taskId).toBe(parsedRequest.taskId);
      expect(parsedResponse.gateName).toBe(parsedRequest.gateName);
      expect(parsedResponse.action).toBe('approve');
      expect(parsedResponse.resolved).toBe(true);
    });

    it('should support multi-step approval workflow', () => {
      const approvalRequest: ApprovalRequest = {
        id: 'approval-multi-123',
        taskId: 'task-feature-789',
        gateName: 'Feature Review Gate',
        gateType: 'before-commit',
        approvers: ['senior-dev', 'architect'],
        minApprovals: 2,
        requestedAt: new Date('2024-01-01T10:00:00Z')
      };

      // First response - request more info
      const firstResponse: ApprovalResponse = {
        approvalId: 'approval-multi-123',
        taskId: 'task-feature-789',
        gateName: 'Feature Review Gate',
        action: 'request-info',
        approver: 'senior-dev@company.com',
        comment: 'Please add more unit tests for the new feature',
        timestamp: new Date('2024-01-01T10:10:00Z'),
        resolved: false
      };

      // Second response - approve
      const secondResponse: ApprovalResponse = {
        approvalId: 'approval-multi-123',
        taskId: 'task-feature-789',
        gateName: 'Feature Review Gate',
        action: 'approve',
        approver: 'architect@company.com',
        comment: 'Architecture looks good, approved',
        timestamp: new Date('2024-01-01T10:30:00Z'),
        resolved: true
      };

      // All should parse and maintain consistency
      expect(() => ApprovalRequestSchema.parse(approvalRequest)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(firstResponse)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(secondResponse)).not.toThrow();

      const parsedRequest = ApprovalRequestSchema.parse(approvalRequest);
      const parsedFirst = ApprovalResponseSchema.parse(firstResponse);
      const parsedSecond = ApprovalResponseSchema.parse(secondResponse);

      expect(parsedRequest.minApprovals).toBe(2);
      expect(parsedFirst.resolved).toBe(false);
      expect(parsedSecond.resolved).toBe(true);
      expect(parsedFirst.action).toBe('request-info');
      expect(parsedSecond.action).toBe('approve');
    });

    it('should support denial workflow with detailed reasoning', () => {
      const approvalRequest: ApprovalRequest = {
        id: 'approval-deny-123',
        taskId: 'task-security-456',
        gateName: 'Security Review Gate',
        gateType: 'before-deploy',
        description: 'Security review for deployment',
        approvers: ['security-team'],
        minApprovals: 1,
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        context: {
          scanResults: 'pending',
          riskLevel: 'unknown'
        }
      };

      const denialResponse: ApprovalResponse = {
        approvalId: 'approval-deny-123',
        taskId: 'task-security-456',
        gateName: 'Security Review Gate',
        action: 'deny',
        approver: 'security-team@company.com',
        comment: 'High severity vulnerabilities found, please fix before proceeding',
        reason: 'security-vulnerabilities',
        timestamp: new Date('2024-01-01T10:45:00Z'),
        context: {
          vulnerabilities: ['CVE-2023-1234'],
          severity: 'high',
          blocked: true
        },
        resolved: true
      };

      expect(() => ApprovalRequestSchema.parse(approvalRequest)).not.toThrow();
      expect(() => ApprovalResponseSchema.parse(denialResponse)).not.toThrow();

      const parsedRequest = ApprovalRequestSchema.parse(approvalRequest);
      const parsedResponse = ApprovalResponseSchema.parse(denialResponse);

      expect(parsedResponse.action).toBe('deny');
      expect(parsedResponse.reason).toBe('security-vulnerabilities');
      expect(parsedResponse.resolved).toBe(true);
      expect(parsedResponse.context).toHaveProperty('vulnerabilities');
    });
  });

  describe('Type exports validation', () => {
    it('should export all approval types for use', () => {
      // These should compile without errors (TypeScript compilation test)
      const action: ApprovalAction = 'approve';
      const status: ApprovalStatus = 'pending';
      const checkpointType: ApprovalCheckpointType = 'before-commit';

      const request: ApprovalRequest = {
        id: 'export-test-request',
        taskId: 'export-task',
        gateName: 'Export Gate',
        gateType: checkpointType,
        requestedAt: new Date()
      };

      const response: ApprovalResponse = {
        approvalId: request.id,
        taskId: request.taskId,
        gateName: request.gateName,
        action,
        approver: 'export-tester',
        timestamp: new Date()
      };

      // Verify types work correctly
      expect(action).toBe('approve');
      expect(status).toBe('pending');
      expect(checkpointType).toBe('before-commit');
      expect(request.gateType).toBe('before-commit');
      expect(response.action).toBe('approve');
    });

    it('should validate all schemas are properly exported', () => {
      const schemas = [
        ApprovalActionSchema,
        ApprovalRequestSchema,
        ApprovalResponseSchema
      ];

      schemas.forEach(schema => {
        expect(schema).toBeDefined();
        expect(typeof schema.parse).toBe('function');
        expect(typeof schema.safeParse).toBe('function');
      });
    });
  });
});