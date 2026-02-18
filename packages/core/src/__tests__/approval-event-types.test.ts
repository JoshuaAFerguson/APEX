/**
 * Comprehensive test coverage for approval-related event types
 *
 * Tests the event types as specified in the acceptance criteria:
 * - 'approval-required' event type and ApprovalRequiredEventData
 * - 'approval-resolved' event type and ApprovalResolvedEventData
 * - ApprovalGrantedEventData, ApprovalDeniedEventData
 * - ApprovalEventData union type
 */

import { describe, it, expect } from 'vitest';
import {
  // Event data types
  ApprovalRequiredEventDataSchema,
  ApprovalRequiredEventData,
  ApprovalResolvedEventDataSchema,
  ApprovalResolvedEventData,
  ApprovalGrantedEventDataSchema,
  ApprovalGrantedEventData,
  ApprovalDeniedEventDataSchema,
  ApprovalDeniedEventData,
  ApprovalEventData,

  // Supporting types
  ApprovalCheckpointTypeSchema,
  ApprovalCheckpointType,

  // Event types
  EventTypeSchema
} from '../types';

describe('Approval Event Types - Acceptance Criteria Validation', () => {
  describe('Event type validation', () => {
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

    it('should include all approval-related event types', () => {
      const approvalEventTypes = [
        'approval-required',
        'approval-resolved',
        'gate:approved',
        'gate:rejected',
        'approval:granted',
        'approval:denied'
      ];

      approvalEventTypes.forEach(eventType => {
        expect(() => EventTypeSchema.parse(eventType)).not.toThrow();
        const parsed = EventTypeSchema.parse(eventType);
        expect(parsed).toBe(eventType);
      });
    });
  });

  describe('ApprovalRequiredEventDataSchema', () => {
    const baseRequiredEvent = {
      approvalId: 'approval-123',
      taskId: 'task-456'
    };

    it('should accept minimal valid approval-required event data', () => {
      const parsed = ApprovalRequiredEventDataSchema.parse(baseRequiredEvent);

      expect(parsed.approvalId).toBe('approval-123');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.minApprovals).toBe(1); // default value
    });

    it('should accept complete approval-required event data', () => {
      const completeEvent: ApprovalRequiredEventData = {
        approvalId: 'approval-complete-789',
        taskId: 'task-deploy-101',
        gateName: 'Production Deployment Gate',
        gateType: 'before-deploy',
        description: 'Manual approval required before deploying to production',
        approvers: ['devops-team', 'tech-lead', 'security-team'],
        minApprovals: 2,
        timeoutMinutes: 120,
        expiresAt: new Date('2024-01-01T14:00:00Z'),
        requestedAt: new Date('2024-01-01T12:00:00Z'),
        stage: 'deployment',
        agent: 'deployment-agent',
        priority: 'high',
        context: {
          environment: 'production',
          riskLevel: 'medium',
          affectedServices: ['api', 'frontend'],
          rollbackPlan: 'blue-green'
        },
        metadata: {
          buildId: 'build-789',
          commitSha: 'abc123def456',
          pullRequestId: 123
        },
        affectedFiles: ['src/api/auth.ts', 'src/config/production.yaml'],
        approvalUrl: 'https://approval.company.com/approve/approval-complete-789'
      };

      const parsed = ApprovalRequiredEventDataSchema.parse(completeEvent);

      expect(parsed.approvalId).toBe('approval-complete-789');
      expect(parsed.taskId).toBe('task-deploy-101');
      expect(parsed.gateName).toBe('Production Deployment Gate');
      expect(parsed.gateType).toBe('before-deploy');
      expect(parsed.description).toBe('Manual approval required before deploying to production');
      expect(parsed.approvers).toEqual(['devops-team', 'tech-lead', 'security-team']);
      expect(parsed.minApprovals).toBe(2);
      expect(parsed.timeoutMinutes).toBe(120);
      expect(parsed.stage).toBe('deployment');
      expect(parsed.agent).toBe('deployment-agent');
      expect(parsed.priority).toBe('high');
      expect(parsed.context).toEqual({
        environment: 'production',
        riskLevel: 'medium',
        affectedServices: ['api', 'frontend'],
        rollbackPlan: 'blue-green'
      });
      expect(parsed.metadata).toEqual({
        buildId: 'build-789',
        commitSha: 'abc123def456',
        pullRequestId: 123
      });
      expect(parsed.affectedFiles).toEqual(['src/api/auth.ts', 'src/config/production.yaml']);
      expect(parsed.approvalUrl).toBe('https://approval.company.com/approve/approval-complete-789');
    });

    it('should validate required fields', () => {
      // Missing approvalId
      expect(() => ApprovalRequiredEventDataSchema.parse({
        taskId: 'task-456'
      })).toThrow();

      // Empty approvalId
      expect(() => ApprovalRequiredEventDataSchema.parse({
        approvalId: '',
        taskId: 'task-456'
      })).toThrow();

      // Missing taskId
      expect(() => ApprovalRequiredEventDataSchema.parse({
        approvalId: 'approval-123'
      })).toThrow();

      // Empty taskId
      expect(() => ApprovalRequiredEventDataSchema.parse({
        approvalId: 'approval-123',
        taskId: ''
      })).toThrow();
    });

    it('should validate numeric constraints', () => {
      // minApprovals too low
      expect(() => ApprovalRequiredEventDataSchema.parse({
        ...baseRequiredEvent,
        minApprovals: 0
      })).toThrow();

      // negative minApprovals
      expect(() => ApprovalRequiredEventDataSchema.parse({
        ...baseRequiredEvent,
        minApprovals: -1
      })).toThrow();

      // timeoutMinutes too low
      expect(() => ApprovalRequiredEventDataSchema.parse({
        ...baseRequiredEvent,
        timeoutMinutes: 0
      })).toThrow();

      // negative timeoutMinutes
      expect(() => ApprovalRequiredEventDataSchema.parse({
        ...baseRequiredEvent,
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
        const event = { ...baseRequiredEvent, gateType };
        expect(() => ApprovalRequiredEventDataSchema.parse(event)).not.toThrow();
        const parsed = ApprovalRequiredEventDataSchema.parse(event);
        expect(parsed.gateType).toBe(gateType);
      });

      // Invalid gate type
      expect(() => ApprovalRequiredEventDataSchema.parse({
        ...baseRequiredEvent,
        gateType: 'invalid-type'
      })).toThrow();
    });

    it('should validate URL format for approvalUrl', () => {
      const validUrls = [
        'https://approval.company.com/approve/123',
        'http://localhost:3000/approve/123',
        'https://api.example.com/v1/approvals/123/approve'
      ];

      validUrls.forEach(approvalUrl => {
        const event = { ...baseRequiredEvent, approvalUrl };
        expect(() => ApprovalRequiredEventDataSchema.parse(event)).not.toThrow();
        const parsed = ApprovalRequiredEventDataSchema.parse(event);
        expect(parsed.approvalUrl).toBe(approvalUrl);
      });

      // Invalid URLs
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid.protocol.com',
        'javascript:alert("xss")',
        ''
      ];

      invalidUrls.forEach(approvalUrl => {
        const event = { ...baseRequiredEvent, approvalUrl };
        expect(() => ApprovalRequiredEventDataSchema.parse(event)).toThrow();
      });
    });
  });

  describe('ApprovalResolvedEventDataSchema', () => {
    const baseResolvedEvent = {
      approvalId: 'approval-resolved-123',
      taskId: 'task-456',
      gateName: 'Test Gate',
      resolution: 'approved' as const
    };

    it('should accept minimal valid approval-resolved event data', () => {
      const parsed = ApprovalResolvedEventDataSchema.parse(baseResolvedEvent);

      expect(parsed.approvalId).toBe('approval-resolved-123');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.gateName).toBe('Test Gate');
      expect(parsed.resolution).toBe('approved');
      expect(parsed.approvalsRequired).toBe(1); // default value
    });

    it('should accept complete approval-resolved event data', () => {
      const completeEvent: ApprovalResolvedEventData = {
        approvalId: 'approval-resolved-complete-789',
        taskId: 'task-feature-101',
        gateName: 'Feature Review Gate',
        resolution: 'denied',
        resolvedBy: 'security-team@company.com',
        resolvedAt: new Date('2024-01-01T11:00:00Z'),
        finalComment: 'Security vulnerabilities found, please fix before proceeding',
        stage: 'security-review',
        reason: 'security-policy-violation',
        context: {
          vulnerabilities: ['CVE-2023-1234', 'CVE-2023-5678'],
          scanId: 'security-scan-456',
          severity: 'high'
        },
        approvalsReceived: 0,
        approvalsRequired: 1
      };

      const parsed = ApprovalResolvedEventDataSchema.parse(completeEvent);

      expect(parsed.approvalId).toBe('approval-resolved-complete-789');
      expect(parsed.taskId).toBe('task-feature-101');
      expect(parsed.gateName).toBe('Feature Review Gate');
      expect(parsed.resolution).toBe('denied');
      expect(parsed.resolvedBy).toBe('security-team@company.com');
      expect(parsed.resolvedAt).toEqual(new Date('2024-01-01T11:00:00Z'));
      expect(parsed.finalComment).toBe('Security vulnerabilities found, please fix before proceeding');
      expect(parsed.stage).toBe('security-review');
      expect(parsed.reason).toBe('security-policy-violation');
      expect(parsed.context).toEqual({
        vulnerabilities: ['CVE-2023-1234', 'CVE-2023-5678'],
        scanId: 'security-scan-456',
        severity: 'high'
      });
      expect(parsed.approvalsReceived).toBe(0);
      expect(parsed.approvalsRequired).toBe(1);
    });

    it('should validate required fields', () => {
      // Missing approvalId
      expect(() => ApprovalResolvedEventDataSchema.parse({
        taskId: 'task-456',
        gateName: 'Test Gate',
        resolution: 'approved'
      })).toThrow();

      // Empty approvalId
      expect(() => ApprovalResolvedEventDataSchema.parse({
        approvalId: '',
        taskId: 'task-456',
        gateName: 'Test Gate',
        resolution: 'approved'
      })).toThrow();

      // Missing taskId
      expect(() => ApprovalResolvedEventDataSchema.parse({
        approvalId: 'approval-123',
        gateName: 'Test Gate',
        resolution: 'approved'
      })).toThrow();

      // Empty taskId
      expect(() => ApprovalResolvedEventDataSchema.parse({
        approvalId: 'approval-123',
        taskId: '',
        gateName: 'Test Gate',
        resolution: 'approved'
      })).toThrow();

      // Missing gateName
      expect(() => ApprovalResolvedEventDataSchema.parse({
        approvalId: 'approval-123',
        taskId: 'task-456',
        resolution: 'approved'
      })).toThrow();

      // Empty gateName
      expect(() => ApprovalResolvedEventDataSchema.parse({
        approvalId: 'approval-123',
        taskId: 'task-456',
        gateName: '',
        resolution: 'approved'
      })).toThrow();

      // Missing resolution
      expect(() => ApprovalResolvedEventDataSchema.parse({
        approvalId: 'approval-123',
        taskId: 'task-456',
        gateName: 'Test Gate'
      })).toThrow();
    });

    it('should validate resolution types', () => {
      const validResolutions = ['approved', 'denied', 'timeout', 'cancelled'];

      validResolutions.forEach(resolution => {
        const event = { ...baseResolvedEvent, resolution };
        expect(() => ApprovalResolvedEventDataSchema.parse(event)).not.toThrow();
        const parsed = ApprovalResolvedEventDataSchema.parse(event);
        expect(parsed.resolution).toBe(resolution);
      });

      // Invalid resolution
      expect(() => ApprovalResolvedEventDataSchema.parse({
        ...baseResolvedEvent,
        resolution: 'invalid-resolution'
      })).toThrow();
    });

    it('should validate numeric constraints', () => {
      // Negative approvalsReceived
      expect(() => ApprovalResolvedEventDataSchema.parse({
        ...baseResolvedEvent,
        approvalsReceived: -1
      })).toThrow();

      // Zero approvalsRequired
      expect(() => ApprovalResolvedEventDataSchema.parse({
        ...baseResolvedEvent,
        approvalsRequired: 0
      })).toThrow();

      // Negative approvalsRequired
      expect(() => ApprovalResolvedEventDataSchema.parse({
        ...baseResolvedEvent,
        approvalsRequired: -1
      })).toThrow();
    });

    it('should handle different resolution scenarios', () => {
      const scenarios = [
        {
          description: 'approved resolution',
          event: {
            ...baseResolvedEvent,
            resolution: 'approved' as const,
            resolvedBy: 'tech-lead@company.com',
            finalComment: 'All checks passed, approved for deployment'
          }
        },
        {
          description: 'denied resolution',
          event: {
            ...baseResolvedEvent,
            resolution: 'denied' as const,
            resolvedBy: 'security-team@company.com',
            finalComment: 'Security vulnerabilities found',
            reason: 'security-issues'
          }
        },
        {
          description: 'timeout resolution',
          event: {
            ...baseResolvedEvent,
            resolution: 'timeout' as const,
            reason: 'no-response-within-timeout',
            finalComment: 'Approval request timed out after 120 minutes'
          }
        },
        {
          description: 'cancelled resolution',
          event: {
            ...baseResolvedEvent,
            resolution: 'cancelled' as const,
            resolvedBy: 'task-owner@company.com',
            reason: 'user-cancelled',
            finalComment: 'Task cancelled by user'
          }
        }
      ];

      scenarios.forEach(({ description, event }) => {
        expect(() => ApprovalResolvedEventDataSchema.parse(event),
          `Should parse ${description}`).not.toThrow();

        const parsed = ApprovalResolvedEventDataSchema.parse(event);
        expect(parsed.resolution).toBe(event.resolution);
        if (event.resolvedBy) {
          expect(parsed.resolvedBy).toBe(event.resolvedBy);
        }
        if (event.finalComment) {
          expect(parsed.finalComment).toBe(event.finalComment);
        }
        if (event.reason) {
          expect(parsed.reason).toBe(event.reason);
        }
      });
    });
  });

  describe('ApprovalGrantedEventDataSchema', () => {
    const baseGrantedEvent = {
      approvalId: 'approval-granted-123',
      taskId: 'task-456',
      gateName: 'Test Gate',
      timestamp: new Date('2024-01-01T10:30:00Z')
    };

    it('should accept minimal valid approval-granted event data', () => {
      const parsed = ApprovalGrantedEventDataSchema.parse(baseGrantedEvent);

      expect(parsed.approvalId).toBe('approval-granted-123');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.gateName).toBe('Test Gate');
      expect(parsed.timestamp).toEqual(new Date('2024-01-01T10:30:00Z'));
    });

    it('should validate required fields', () => {
      // Missing approvalId
      expect(() => ApprovalGrantedEventDataSchema.parse({
        taskId: 'task-456',
        gateName: 'Test Gate',
        timestamp: new Date()
      })).toThrow();

      // Missing timestamp
      expect(() => ApprovalGrantedEventDataSchema.parse({
        approvalId: 'approval-granted-123',
        taskId: 'task-456',
        gateName: 'Test Gate'
      })).toThrow();
    });
  });

  describe('ApprovalDeniedEventDataSchema', () => {
    const baseDeniedEvent = {
      approvalId: 'approval-denied-123',
      taskId: 'task-456',
      gateName: 'Test Gate',
      timestamp: new Date('2024-01-01T10:30:00Z')
    };

    it('should accept minimal valid approval-denied event data', () => {
      const parsed = ApprovalDeniedEventDataSchema.parse(baseDeniedEvent);

      expect(parsed.approvalId).toBe('approval-denied-123');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.gateName).toBe('Test Gate');
      expect(parsed.timestamp).toEqual(new Date('2024-01-01T10:30:00Z'));
    });

    it('should validate required fields', () => {
      // Missing approvalId
      expect(() => ApprovalDeniedEventDataSchema.parse({
        taskId: 'task-456',
        gateName: 'Test Gate',
        timestamp: new Date()
      })).toThrow();

      // Missing timestamp
      expect(() => ApprovalDeniedEventDataSchema.parse({
        approvalId: 'approval-denied-123',
        taskId: 'task-456',
        gateName: 'Test Gate'
      })).toThrow();
    });
  });

  describe('ApprovalEventData union type', () => {
    it('should accept all approval event data types', () => {
      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: 'approval-required-union-1',
        taskId: 'task-union-1',
        gateName: 'Union Test Gate'
      };

      const resolvedEvent: ApprovalResolvedEventData = {
        approvalId: 'approval-resolved-union-2',
        taskId: 'task-union-2',
        gateName: 'Union Test Gate',
        resolution: 'approved'
      };

      const grantedEvent: ApprovalGrantedEventData = {
        approvalId: 'approval-granted-union-3',
        taskId: 'task-union-3',
        gateName: 'Union Test Gate',
        timestamp: new Date()
      };

      const deniedEvent: ApprovalDeniedEventData = {
        approvalId: 'approval-denied-union-4',
        taskId: 'task-union-4',
        gateName: 'Union Test Gate',
        timestamp: new Date()
      };

      const events: ApprovalEventData[] = [
        requiredEvent,
        resolvedEvent,
        grantedEvent,
        deniedEvent
      ];

      events.forEach((event, index) => {
        expect(event.approvalId).toBeDefined();
        expect(event.taskId).toBeDefined();
        expect(event.gateName).toBeDefined();
      });

      // Type discrimination should work
      const resolvedEvents = events.filter(event => 'resolution' in event);
      const requiredEvents = events.filter(event => 'minApprovals' in event);
      const timestampedEvents = events.filter(event => 'timestamp' in event);

      expect(resolvedEvents).toHaveLength(1);
      expect(requiredEvents).toHaveLength(1);
      expect(timestampedEvents).toHaveLength(2); // granted and denied events
    });
  });

  describe('Event workflow integration', () => {
    it('should support complete approval event flow', () => {
      // 1. Approval required event
      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: 'approval-workflow-123',
        taskId: 'task-workflow-456',
        gateName: 'Workflow Test Gate',
        gateType: 'before-deploy',
        description: 'Approval required for deployment',
        approvers: ['devops-team'],
        minApprovals: 1,
        timeoutMinutes: 60,
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        stage: 'deployment'
      };

      // 2. Approval granted event
      const grantedEvent: ApprovalGrantedEventData = {
        approvalId: requiredEvent.approvalId,
        taskId: requiredEvent.taskId,
        gateName: requiredEvent.gateName,
        timestamp: new Date('2024-01-01T10:15:00Z')
      };

      // 3. Approval resolved event
      const resolvedEvent: ApprovalResolvedEventData = {
        approvalId: requiredEvent.approvalId,
        taskId: requiredEvent.taskId,
        gateName: requiredEvent.gateName,
        resolution: 'approved',
        resolvedBy: 'devops-team@company.com',
        resolvedAt: new Date('2024-01-01T10:15:00Z'),
        finalComment: 'Deployment approved after review',
        approvalsReceived: 1,
        approvalsRequired: 1
      };

      // All events should parse successfully
      expect(() => ApprovalRequiredEventDataSchema.parse(requiredEvent)).not.toThrow();
      expect(() => ApprovalGrantedEventDataSchema.parse(grantedEvent)).not.toThrow();
      expect(() => ApprovalResolvedEventDataSchema.parse(resolvedEvent)).not.toThrow();

      // Verify workflow consistency
      const parsedRequired = ApprovalRequiredEventDataSchema.parse(requiredEvent);
      const parsedGranted = ApprovalGrantedEventDataSchema.parse(grantedEvent);
      const parsedResolved = ApprovalResolvedEventDataSchema.parse(resolvedEvent);

      expect(parsedGranted.approvalId).toBe(parsedRequired.approvalId);
      expect(parsedResolved.approvalId).toBe(parsedRequired.approvalId);
      expect(parsedGranted.taskId).toBe(parsedRequired.taskId);
      expect(parsedResolved.taskId).toBe(parsedRequired.taskId);
      expect(parsedGranted.gateName).toBe(parsedRequired.gateName);
      expect(parsedResolved.gateName).toBe(parsedRequired.gateName);
      expect(parsedResolved.resolution).toBe('approved');
      expect(parsedResolved.approvalsReceived).toBe(parsedRequired.minApprovals);
    });

    it('should support denial workflow', () => {
      // 1. Approval required event
      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: 'approval-denial-workflow-123',
        taskId: 'task-denial-456',
        gateName: 'Security Gate',
        gateType: 'before-deploy',
        minApprovals: 1
      };

      // 2. Approval denied event
      const deniedEvent: ApprovalDeniedEventData = {
        approvalId: requiredEvent.approvalId,
        taskId: requiredEvent.taskId,
        gateName: requiredEvent.gateName,
        timestamp: new Date('2024-01-01T10:30:00Z')
      };

      // 3. Approval resolved event
      const resolvedEvent: ApprovalResolvedEventData = {
        approvalId: requiredEvent.approvalId,
        taskId: requiredEvent.taskId,
        gateName: requiredEvent.gateName,
        resolution: 'denied',
        resolvedBy: 'security-team@company.com',
        resolvedAt: new Date('2024-01-01T10:30:00Z'),
        finalComment: 'Security vulnerabilities found',
        reason: 'security-policy-violation',
        approvalsReceived: 0,
        approvalsRequired: 1
      };

      // All events should parse successfully
      expect(() => ApprovalRequiredEventDataSchema.parse(requiredEvent)).not.toThrow();
      expect(() => ApprovalDeniedEventDataSchema.parse(deniedEvent)).not.toThrow();
      expect(() => ApprovalResolvedEventDataSchema.parse(resolvedEvent)).not.toThrow();

      // Verify consistency
      expect(deniedEvent.approvalId).toBe(requiredEvent.approvalId);
      expect(resolvedEvent.approvalId).toBe(requiredEvent.approvalId);
      expect(resolvedEvent.resolution).toBe('denied');
      expect(resolvedEvent.approvalsReceived).toBe(0);
    });

    it('should support timeout workflow', () => {
      const resolvedEvent: ApprovalResolvedEventData = {
        approvalId: 'approval-timeout-123',
        taskId: 'task-timeout-456',
        gateName: 'Timeout Gate',
        resolution: 'timeout',
        reason: 'no-response-within-timeout',
        resolvedAt: new Date('2024-01-01T12:00:00Z'),
        finalComment: 'Approval request timed out after 120 minutes'
      };

      expect(() => ApprovalResolvedEventDataSchema.parse(resolvedEvent)).not.toThrow();
      const parsed = ApprovalResolvedEventDataSchema.parse(resolvedEvent);
      expect(parsed.resolution).toBe('timeout');
      expect(parsed.reason).toBe('no-response-within-timeout');
    });
  });

  describe('Type exports validation', () => {
    it('should export all approval event types for use', () => {
      // These should compile without errors (TypeScript compilation test)
      const requiredEventData: ApprovalRequiredEventData = {
        approvalId: 'export-test-1',
        taskId: 'export-task-1',
        gateName: 'Export Test Gate'
      };

      const resolvedEventData: ApprovalResolvedEventData = {
        approvalId: 'export-test-2',
        taskId: 'export-task-2',
        gateName: 'Export Test Gate',
        resolution: 'approved'
      };

      const grantedEventData: ApprovalGrantedEventData = {
        approvalId: 'export-test-3',
        taskId: 'export-task-3',
        gateName: 'Export Test Gate',
        timestamp: new Date()
      };

      const deniedEventData: ApprovalDeniedEventData = {
        approvalId: 'export-test-4',
        taskId: 'export-task-4',
        gateName: 'Export Test Gate',
        timestamp: new Date()
      };

      const unionEventData: ApprovalEventData = requiredEventData;

      // Verify types work correctly
      expect(requiredEventData.approvalId).toBe('export-test-1');
      expect(resolvedEventData.resolution).toBe('approved');
      expect(grantedEventData.timestamp).toBeInstanceOf(Date);
      expect(deniedEventData.timestamp).toBeInstanceOf(Date);
      expect(unionEventData.approvalId).toBe('export-test-1');
    });

    it('should validate all event schemas are properly exported', () => {
      const schemas = [
        ApprovalRequiredEventDataSchema,
        ApprovalResolvedEventDataSchema,
        ApprovalGrantedEventDataSchema,
        ApprovalDeniedEventDataSchema
      ];

      schemas.forEach(schema => {
        expect(schema).toBeDefined();
        expect(typeof schema.parse).toBe('function');
        expect(typeof schema.safeParse).toBe('function');
      });
    });
  });
});