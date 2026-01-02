/**
 * Comprehensive Acceptance Criteria Validation for Approval Gates Feature
 *
 * This test validates ALL acceptance criteria for the approval gates implementation:
 *
 * Acceptance Criteria:
 * 1. ApprovalGate type defined with checkpoint name, required approvers, timeout config
 * 2. ApprovalState type defined with status (pending/approved/denied), approver, timestamp, context
 * 3. TaskStatus enum extended with 'awaiting-approval' status
 * 4. ApprovalRequiredEvent and ApprovalResponseEvent types defined
 * 5. Zod schemas validate all new types
 * 6. Types exported from core package
 */

import { describe, it, expect } from 'vitest';
import {
  // Acceptance Criteria 1: ApprovalGate type with checkpoint name, required approvers, timeout config
  ApprovalGateSchema,
  ApprovalGate,
  ApprovalCheckpointTypeSchema,
  ApprovalCheckpointType,

  // Acceptance Criteria 2: ApprovalState type with status, approver, timestamp, context
  ApprovalStateSchema,
  ApprovalState,
  ApprovalStatusSchema,
  ApprovalStatus,

  // Acceptance Criteria 3: TaskStatus enum extended with 'awaiting-approval' status
  TaskStatusSchema,
  TaskStatus,

  // Acceptance Criteria 4: ApprovalRequiredEvent and ApprovalResponseEvent types defined
  ApprovalRequiredEventDataSchema,
  ApprovalRequiredEventData,
  ApprovalResponseEventDataSchema,
  ApprovalResponseEventData,
  ApprovalEventData,

  // Additional approval workflow types
  ApprovalDecisionRequestSchema,
  ApprovalDecisionRequest,
  ApprovalDecisionResponseSchema,
  ApprovalDecisionResponse
} from '../types';

describe('Approval Gates Feature - Complete Acceptance Criteria Validation', () => {
  describe('Acceptance Criteria 1: ApprovalGate type with required features', () => {
    it('should define ApprovalGate with checkpoint name', () => {
      const gateWithName: ApprovalGate = {
        type: 'before-commit',
        name: 'Code Review Checkpoint'
      };

      expect(() => ApprovalGateSchema.parse(gateWithName)).not.toThrow();
      const parsed = ApprovalGateSchema.parse(gateWithName);
      expect(parsed.name).toBe('Code Review Checkpoint');
    });

    it('should define ApprovalGate with required approvers', () => {
      const gateWithApprovers: ApprovalGate = {
        type: 'before-deploy',
        approvers: ['devops-team', 'tech-lead', 'security-team']
      };

      expect(() => ApprovalGateSchema.parse(gateWithApprovers)).not.toThrow();
      const parsed = ApprovalGateSchema.parse(gateWithApprovers);
      expect(parsed.approvers).toEqual(['devops-team', 'tech-lead', 'security-team']);
    });

    it('should define ApprovalGate with timeout configuration', () => {
      const gateWithTimeout: ApprovalGate = {
        type: 'custom',
        timeout: 120, // 120 minutes
        autoApproveOnTimeout: false
      };

      expect(() => ApprovalGateSchema.parse(gateWithTimeout)).not.toThrow();
      const parsed = ApprovalGateSchema.parse(gateWithTimeout);
      expect(parsed.timeout).toBe(120);
      expect(parsed.autoApproveOnTimeout).toBe(false);
    });

    it('should define ApprovalGate with all checkpoint types', () => {
      const checkpointTypes: ApprovalCheckpointType[] = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'custom'
      ];

      checkpointTypes.forEach(type => {
        const gate: ApprovalGate = { type };
        expect(() => ApprovalGateSchema.parse(gate)).not.toThrow();
        const parsed = ApprovalGateSchema.parse(gate);
        expect(parsed.type).toBe(type);
      });
    });

    it('should define complete ApprovalGate with all features', () => {
      const completeGate: ApprovalGate = {
        type: 'before-deploy',
        name: 'Production Deployment Gate',
        description: 'Requires approval before deploying to production',
        required: true,
        approvers: ['devops-lead', 'tech-lead', 'security-team'],
        minApprovals: 2,
        timeout: 240, // 4 hours
        autoApproveOnTimeout: false,
        trigger: 'environment === "production"',
        tags: ['production', 'critical']
      };

      expect(() => ApprovalGateSchema.parse(completeGate)).not.toThrow();
      const parsed = ApprovalGateSchema.parse(completeGate);

      // Validate checkpoint name
      expect(parsed.name).toBe('Production Deployment Gate');

      // Validate required approvers
      expect(parsed.approvers).toEqual(['devops-lead', 'tech-lead', 'security-team']);
      expect(parsed.minApprovals).toBe(2);

      // Validate timeout config
      expect(parsed.timeout).toBe(240);
      expect(parsed.autoApproveOnTimeout).toBe(false);
    });
  });

  describe('Acceptance Criteria 2: ApprovalState type with required features', () => {
    it('should define ApprovalState with status (pending/approved/denied)', () => {
      const statuses: ApprovalStatus[] = ['pending', 'approved', 'denied'];

      statuses.forEach(status => {
        const approvalState: ApprovalState = {
          id: `approval-${status}`,
          taskId: 'task-123',
          gateName: 'Test Gate',
          status,
          requestedAt: new Date()
        };

        expect(() => ApprovalStateSchema.parse(approvalState)).not.toThrow();
        const parsed = ApprovalStateSchema.parse(approvalState);
        expect(parsed.status).toBe(status);
      });
    });

    it('should define ApprovalState with approver', () => {
      const approvalStateWithApprover: ApprovalState = {
        id: 'approval-with-approver',
        taskId: 'task-456',
        gateName: 'Security Gate',
        status: 'approved',
        approver: 'security-team@company.com',
        requestedAt: new Date(),
        respondedAt: new Date()
      };

      expect(() => ApprovalStateSchema.parse(approvalStateWithApprover)).not.toThrow();
      const parsed = ApprovalStateSchema.parse(approvalStateWithApprover);
      expect(parsed.approver).toBe('security-team@company.com');
    });

    it('should define ApprovalState with timestamps', () => {
      const requestTime = new Date('2024-01-01T10:00:00Z');
      const responseTime = new Date('2024-01-01T10:30:00Z');
      const expiryTime = new Date('2024-01-01T14:00:00Z');

      const approvalStateWithTimestamps: ApprovalState = {
        id: 'approval-timestamps',
        taskId: 'task-789',
        gateName: 'Time Test Gate',
        status: 'approved',
        requestedAt: requestTime,
        respondedAt: responseTime,
        expiresAt: expiryTime
      };

      expect(() => ApprovalStateSchema.parse(approvalStateWithTimestamps)).not.toThrow();
      const parsed = ApprovalStateSchema.parse(approvalStateWithTimestamps);
      expect(parsed.requestedAt).toEqual(requestTime);
      expect(parsed.respondedAt).toEqual(responseTime);
      expect(parsed.expiresAt).toEqual(expiryTime);
    });

    it('should define ApprovalState with context', () => {
      const approvalStateWithContext: ApprovalState = {
        id: 'approval-context',
        taskId: 'task-context',
        gateName: 'Context Gate',
        status: 'pending',
        requestedAt: new Date(),
        context: {
          riskLevel: 'high',
          deploymentTarget: 'production',
          affectedServices: ['api', 'frontend'],
          reviewType: 'manual'
        }
      };

      expect(() => ApprovalStateSchema.parse(approvalStateWithContext)).not.toThrow();
      const parsed = ApprovalStateSchema.parse(approvalStateWithContext);
      expect(parsed.context).toEqual({
        riskLevel: 'high',
        deploymentTarget: 'production',
        affectedServices: ['api', 'frontend'],
        reviewType: 'manual'
      });
    });

    it('should define complete ApprovalState with all features', () => {
      const completeApprovalState: ApprovalState = {
        id: 'approval-complete',
        taskId: 'task-complete',
        gateName: 'Complete Test Gate',
        status: 'approved',
        approver: 'reviewer@company.com',
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        respondedAt: new Date('2024-01-01T10:25:00Z'),
        comment: 'Approved after thorough review',
        context: {
          reviewType: 'comprehensive',
          findings: 'minor issues fixed'
        },
        stage: 'implementation',
        agent: 'developer',
        approvalsReceived: 1,
        approvalsRequired: 1,
        timeoutMinutes: 120,
        expiresAt: new Date('2024-01-01T12:00:00Z')
      };

      expect(() => ApprovalStateSchema.parse(completeApprovalState)).not.toThrow();
      const parsed = ApprovalStateSchema.parse(completeApprovalState);

      // Validate status
      expect(parsed.status).toBe('approved');

      // Validate approver
      expect(parsed.approver).toBe('reviewer@company.com');

      // Validate timestamps
      expect(parsed.requestedAt).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(parsed.respondedAt).toEqual(new Date('2024-01-01T10:25:00Z'));

      // Validate context
      expect(parsed.context).toEqual({
        reviewType: 'comprehensive',
        findings: 'minor issues fixed'
      });
    });
  });

  describe('Acceptance Criteria 3: TaskStatus enum extended with awaiting-approval', () => {
    it('should include awaiting-approval status in TaskStatus enum', () => {
      const status = 'awaiting-approval';
      expect(() => TaskStatusSchema.parse(status)).not.toThrow();

      const parsed = TaskStatusSchema.parse(status);
      expect(parsed).toBe('awaiting-approval');
    });

    it('should maintain all existing TaskStatus values', () => {
      const allExpectedStatuses: TaskStatus[] = [
        'pending',
        'queued',
        'planning',
        'in-progress',
        'awaiting-approval', // New status
        'paused',
        'completed',
        'failed',
        'cancelled'
      ];

      allExpectedStatuses.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
        const parsed = TaskStatusSchema.parse(status);
        expect(parsed).toBe(status);
      });
    });

    it('should support awaiting-approval as TypeScript type', () => {
      const status: TaskStatus = 'awaiting-approval';
      expect(status).toBe('awaiting-approval');
    });
  });

  describe('Acceptance Criteria 4: ApprovalRequiredEvent and ApprovalResponseEvent types', () => {
    it('should define ApprovalRequiredEventData type', () => {
      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: 'approval-required-123',
        taskId: 'task-456',
        gateName: 'Code Review Gate',
        gateType: 'before-commit',
        stage: 'implementation',
        description: 'Code review required before commit',
        requiredApprovals: 1,
        approvers: ['senior-dev'],
        timeout: 60,
        requestedAt: new Date(),
        agent: 'developer'
      };

      expect(() => ApprovalRequiredEventDataSchema.parse(requiredEvent)).not.toThrow();
      const parsed = ApprovalRequiredEventDataSchema.parse(requiredEvent);
      expect(parsed.approvalId).toBe('approval-required-123');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.gateName).toBe('Code Review Gate');
    });

    it('should define ApprovalResponseEventData type', () => {
      const responseEvent: ApprovalResponseEventData = {
        approvalId: 'approval-response-456',
        taskId: 'task-789',
        gateName: 'Security Gate',
        gateType: 'before-deploy',
        approved: true,
        approver: 'security-team@company.com',
        comment: 'Security review passed',
        timestamp: new Date(),
        requestedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        responseTimeMs: 30 * 60 * 1000,
        stage: 'deployment'
      };

      expect(() => ApprovalResponseEventDataSchema.parse(responseEvent)).not.toThrow();
      const parsed = ApprovalResponseEventDataSchema.parse(responseEvent);
      expect(parsed.approvalId).toBe('approval-response-456');
      expect(parsed.approved).toBe(true);
      expect(parsed.approver).toBe('security-team@company.com');
    });

    it('should support ApprovalEventData union type', () => {
      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: 'approval-union-1',
        taskId: 'task-union-1'
      };

      const responseEvent: ApprovalResponseEventData = {
        approvalId: 'approval-union-2',
        taskId: 'task-union-2',
        gateName: 'Union Gate',
        gateType: 'custom',
        approved: false,
        approver: 'reviewer',
        timestamp: new Date(),
        requestedAt: new Date()
      };

      const events: ApprovalEventData[] = [requiredEvent, responseEvent];

      events.forEach(event => {
        expect(event.approvalId).toBeDefined();
        expect(event.taskId).toBeDefined();
      });

      // Type discrimination should work
      const responseEvents = events.filter(event => 'approved' in event);
      const requiredEvents = events.filter(event => !('approved' in event));

      expect(responseEvents).toHaveLength(1);
      expect(requiredEvents).toHaveLength(1);
    });
  });

  describe('Acceptance Criteria 5: Zod schemas validate all new types', () => {
    it('should have Zod schemas for all approval gate types', () => {
      const schemas = [
        ApprovalCheckpointTypeSchema,
        ApprovalGateSchema,
        ApprovalStatusSchema,
        ApprovalStateSchema,
        ApprovalRequiredEventDataSchema,
        ApprovalResponseEventDataSchema,
        ApprovalDecisionRequestSchema,
        ApprovalDecisionResponseSchema
      ];

      schemas.forEach(schema => {
        expect(schema).toBeDefined();
        expect(typeof schema.parse).toBe('function');
        expect(typeof schema.safeParse).toBe('function');
      });
    });

    it('should validate with Zod schemas successfully', () => {
      // Test each schema with valid data
      expect(() => ApprovalCheckpointTypeSchema.parse('before-commit')).not.toThrow();

      expect(() => ApprovalGateSchema.parse({
        type: 'before-deploy',
        name: 'Deploy Gate'
      })).not.toThrow();

      expect(() => ApprovalStatusSchema.parse('pending')).not.toThrow();

      expect(() => ApprovalStateSchema.parse({
        id: 'approval-schema-test',
        taskId: 'task-schema-test',
        gateName: 'Schema Gate',
        status: 'pending',
        requestedAt: new Date()
      })).not.toThrow();

      expect(() => ApprovalRequiredEventDataSchema.parse({
        approvalId: 'approval-event-required',
        taskId: 'task-event-required'
      })).not.toThrow();

      expect(() => ApprovalResponseEventDataSchema.parse({
        approvalId: 'approval-event-response',
        taskId: 'task-event-response',
        gateName: 'Event Gate',
        gateType: 'custom',
        approved: true,
        approver: 'event-approver',
        timestamp: new Date(),
        requestedAt: new Date()
      })).not.toThrow();
    });

    it('should reject invalid data with Zod schemas', () => {
      // Test each schema with invalid data
      expect(() => ApprovalCheckpointTypeSchema.parse('invalid-type')).toThrow();
      expect(() => ApprovalStatusSchema.parse('invalid-status')).toThrow();
      expect(() => TaskStatusSchema.parse('running')).toThrow(); // Old status

      expect(() => ApprovalGateSchema.parse({
        type: 'invalid-checkpoint'
      })).toThrow();

      expect(() => ApprovalStateSchema.parse({
        // Missing required fields
        status: 'pending'
      })).toThrow();
    });
  });

  describe('Acceptance Criteria 6: Types exported from core package', () => {
    it('should export all approval gate related types', () => {
      const typeExports = [
        // Types
        ApprovalCheckpointType,
        ApprovalGate,
        ApprovalStatus,
        ApprovalState,
        ApprovalRequiredEventData,
        ApprovalResponseEventData,
        ApprovalEventData,
        ApprovalDecisionRequest,
        ApprovalDecisionResponse,
        TaskStatus,

        // Schemas
        ApprovalCheckpointTypeSchema,
        ApprovalGateSchema,
        ApprovalStatusSchema,
        ApprovalStateSchema,
        ApprovalRequiredEventDataSchema,
        ApprovalResponseEventDataSchema,
        ApprovalDecisionRequestSchema,
        ApprovalDecisionResponseSchema,
        TaskStatusSchema
      ];

      // All should be imported successfully (if this test runs, imports worked)
      typeExports.forEach(exportedItem => {
        expect(exportedItem).toBeDefined();
      });
    });

    it('should allow type usage without additional imports', () => {
      // These should compile without errors (TypeScript compilation test)
      const checkpointType: ApprovalCheckpointType = 'before-commit';
      const status: ApprovalStatus = 'pending';
      const taskStatus: TaskStatus = 'awaiting-approval';

      const gate: ApprovalGate = {
        type: checkpointType,
        name: 'Export Test Gate'
      };

      const approvalState: ApprovalState = {
        id: 'export-test',
        taskId: 'task-export',
        gateName: 'Export Gate',
        status,
        requestedAt: new Date()
      };

      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: 'export-required',
        taskId: 'task-export-required'
      };

      const responseEvent: ApprovalResponseEventData = {
        approvalId: 'export-response',
        taskId: 'task-export-response',
        gateName: 'Export Response Gate',
        gateType: 'custom',
        approved: true,
        approver: 'export-approver',
        timestamp: new Date(),
        requestedAt: new Date()
      };

      // Verify types compile and work correctly
      expect(checkpointType).toBe('before-commit');
      expect(status).toBe('pending');
      expect(taskStatus).toBe('awaiting-approval');
      expect(gate.type).toBe('before-commit');
      expect(approvalState.status).toBe('pending');
      expect(requiredEvent.approvalId).toBe('export-required');
      expect(responseEvent.approved).toBe(true);
    });
  });

  describe('Complete integration validation', () => {
    it('should validate all acceptance criteria work together', () => {
      // Comprehensive test that uses all the acceptance criteria together

      // 1. ApprovalGate with checkpoint name, required approvers, timeout config
      const gate: ApprovalGate = {
        type: 'before-deploy', // checkpoint type
        name: 'Production Deployment Checkpoint', // checkpoint name
        approvers: ['devops-team', 'tech-lead'], // required approvers
        timeout: 120, // timeout config
        autoApproveOnTimeout: false,
        minApprovals: 2
      };

      // 2. ApprovalState with status, approver, timestamp, context
      const approvalState: ApprovalState = {
        id: 'integration-approval',
        taskId: 'integration-task',
        gateName: gate.name!,
        status: 'approved', // status (pending/approved/denied)
        approver: 'devops-team@company.com', // approver
        requestedAt: new Date('2024-01-01T10:00:00Z'), // timestamp
        respondedAt: new Date('2024-01-01T10:30:00Z'), // timestamp
        context: { // context
          environment: 'production',
          riskLevel: 'medium'
        }
      };

      // 3. TaskStatus with 'awaiting-approval'
      const taskStatus: TaskStatus = 'awaiting-approval';

      // 4. ApprovalRequiredEvent and ApprovalResponseEvent types
      const requiredEvent: ApprovalRequiredEventData = {
        approvalId: approvalState.id,
        taskId: approvalState.taskId,
        gateName: gate.name!,
        gateType: gate.type,
        requiredApprovals: gate.minApprovals!,
        timeout: gate.timeout!,
        requestedAt: approvalState.requestedAt
      };

      const responseEvent: ApprovalResponseEventData = {
        approvalId: approvalState.id,
        taskId: approvalState.taskId,
        gateName: approvalState.gateName,
        gateType: gate.type,
        approved: true,
        approver: approvalState.approver!,
        timestamp: approvalState.respondedAt!,
        requestedAt: approvalState.requestedAt
      };

      // 5. All should validate with Zod schemas
      expect(() => ApprovalGateSchema.parse(gate)).not.toThrow();
      expect(() => ApprovalStateSchema.parse(approvalState)).not.toThrow();
      expect(() => TaskStatusSchema.parse(taskStatus)).not.toThrow();
      expect(() => ApprovalRequiredEventDataSchema.parse(requiredEvent)).not.toThrow();
      expect(() => ApprovalResponseEventDataSchema.parse(responseEvent)).not.toThrow();

      // 6. All types are exported and usable (this test proves it)
      const parsedGate = ApprovalGateSchema.parse(gate);
      const parsedState = ApprovalStateSchema.parse(approvalState);
      const parsedStatus = TaskStatusSchema.parse(taskStatus);
      const parsedRequired = ApprovalRequiredEventDataSchema.parse(requiredEvent);
      const parsedResponse = ApprovalResponseEventDataSchema.parse(responseEvent);

      // Verify data consistency across all acceptance criteria
      expect(parsedGate.name).toBe(parsedState.gateName);
      expect(parsedState.id).toBe(parsedRequired.approvalId);
      expect(parsedState.id).toBe(parsedResponse.approvalId);
      expect(parsedGate.type).toBe(parsedRequired.gateType);
      expect(parsedGate.type).toBe(parsedResponse.gateType);
      expect(parsedStatus).toBe('awaiting-approval');
    });
  });
});