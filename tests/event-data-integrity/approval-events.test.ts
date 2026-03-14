/**
 * Approval/Gate Event Data Integrity Tests
 *
 * Comprehensive tests for all approval and gate-related event types.
 * These events are security-critical and require thorough validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateTestId,
  validateJsonRoundTrip,
  validateRequiredFields,
  validateFieldTypes,
  EventSequenceValidator,
  CrossReferenceValidator,
  eventAssert,
} from './shared/event-test-utils';
import {
  createApprovalRequiredEvent,
  createApprovalResolvedEvent,
  ApprovalRequiredEventData,
  ApprovalResolvedEventData,
} from './shared/mock-event-generators';

describe('Approval Event Data Integrity', () => {
  describe('approval-required event', () => {
    it('should have all required fields', () => {
      const event = createApprovalRequiredEvent();

      const result = validateRequiredFields(event, [
        'approvalId',
        'taskId',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should have correct field types', () => {
      const event = createApprovalRequiredEvent();

      const result = validateFieldTypes(event, {
        approvalId: 'string',
        taskId: 'string',
        gateName: 'string',
        gateType: 'string',
        description: 'string',
        approvers: 'array',
        minApprovals: 'number',
        timeoutMinutes: 'number',
        requestedAt: 'date',
        stage: 'string',
        agent: 'string',
        priority: 'string',
      });

      expect(result.isValid).toBe(true);
      expect(result.typeErrors).toHaveLength(0);
    });

    it('should survive JSON round-trip serialization', () => {
      const event = createApprovalRequiredEvent();

      const result = validateJsonRoundTrip(event, ['requestedAt']);

      expect(result.isValid).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should validate approvalId format', () => {
      const event = createApprovalRequiredEvent();

      expect(event.approvalId).toMatch(/^approval-/);
      expect(event.approvalId.length).toBeGreaterThan(8);
    });

    it('should validate gateType enum values', () => {
      const validGateTypes = [
        'before-commit',
        'before-deploy',
        'before-destructive',
        'deployment',
        'custom',
      ] as const;

      validGateTypes.forEach(gateType => {
        const event = createApprovalRequiredEvent('task-1', { gateType });
        expect(event.gateType).toBe(gateType);
      });
    });

    it('should validate priority enum values', () => {
      const validPriorities = ['low', 'normal', 'high', 'critical'] as const;

      validPriorities.forEach(priority => {
        const event = createApprovalRequiredEvent('task-1', { priority });
        expect(event.priority).toBe(priority);
      });
    });

    it('should validate minApprovals is positive', () => {
      const event = createApprovalRequiredEvent('task-1', { minApprovals: 2 });

      eventAssert.numberMatches(event.minApprovals!, {
        positive: true,
        integer: true,
        min: 1,
      });
    });

    it('should validate timeoutMinutes is positive', () => {
      const event = createApprovalRequiredEvent('task-1', { timeoutMinutes: 120 });

      eventAssert.numberMatches(event.timeoutMinutes!, {
        positive: true,
        integer: true,
        min: 1,
      });
    });

    it('should handle empty approvers array', () => {
      const event = createApprovalRequiredEvent('task-1', { approvers: [] });

      expect(event.approvers).toEqual([]);
    });

    it('should handle multiple approvers', () => {
      const approvers = ['admin@test.com', 'security@test.com', 'devops@test.com'];
      const event = createApprovalRequiredEvent('task-1', { approvers });

      expect(event.approvers).toHaveLength(3);
      expect(event.approvers).toEqual(approvers);
    });

    it('should handle complex descriptions', () => {
      const description = `
        This deployment requires approval because:
        - Changes affect production database schema
        - New API endpoints are being exposed
        - Security-sensitive configuration changes

        Please review carefully before approving.
      `;
      const event = createApprovalRequiredEvent('task-1', { description });

      const roundTrip = validateJsonRoundTrip(event, ['requestedAt']);
      expect(roundTrip.isValid).toBe(true);
      expect(roundTrip.deserialized.description).toBe(description);
    });
  });

  describe('approval-resolved event', () => {
    it('should have all required fields', () => {
      const event = createApprovalResolvedEvent();

      const result = validateRequiredFields(event, [
        'approvalId',
        'taskId',
        'gateName',
        'resolution',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should have correct field types', () => {
      const event = createApprovalResolvedEvent();

      const result = validateFieldTypes(event, {
        approvalId: 'string',
        taskId: 'string',
        gateName: 'string',
        resolution: 'string',
        resolvedBy: 'string',
        resolvedAt: 'date',
        finalComment: 'string',
        approvalsReceived: 'number',
        approvalsRequired: 'number',
      });

      expect(result.isValid).toBe(true);
      expect(result.typeErrors).toHaveLength(0);
    });

    it('should survive JSON round-trip serialization', () => {
      const event = createApprovalResolvedEvent();

      const result = validateJsonRoundTrip(event, ['resolvedAt']);

      expect(result.isValid).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should validate resolution enum values', () => {
      const validResolutions = ['approved', 'denied', 'timeout', 'cancelled'] as const;

      validResolutions.forEach(resolution => {
        const event = createApprovalResolvedEvent('approval-1', 'task-1', resolution);
        expect(event.resolution).toBe(resolution);
      });
    });

    it('should validate approvalsReceived is non-negative', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'approved', {
        approvalsReceived: 3,
      });

      eventAssert.numberMatches(event.approvalsReceived!, {
        nonNegative: true,
        integer: true,
      });
    });

    it('should validate approvalsRequired is positive', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'approved', {
        approvalsRequired: 2,
      });

      eventAssert.numberMatches(event.approvalsRequired!, {
        positive: true,
        integer: true,
      });
    });

    it('should have approvalsReceived <= approvalsRequired for denied resolution', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'denied', {
        approvalsReceived: 0,
        approvalsRequired: 2,
      });

      expect(event.approvalsReceived).toBeLessThanOrEqual(event.approvalsRequired!);
    });

    it('should have approvalsReceived >= approvalsRequired for approved resolution', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'approved', {
        approvalsReceived: 2,
        approvalsRequired: 2,
      });

      expect(event.approvalsReceived).toBeGreaterThanOrEqual(event.approvalsRequired!);
    });

    it('should handle timeout resolution without resolver', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'timeout', {
        resolvedBy: undefined,
        finalComment: 'Request timed out after 120 minutes',
      });

      expect(event.resolution).toBe('timeout');
    });

    it('should handle cancelled resolution', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'cancelled', {
        resolvedBy: 'task-owner@test.com',
        finalComment: 'Task cancelled by user',
      });

      expect(event.resolution).toBe('cancelled');
      expect(event.resolvedBy).toBe('task-owner@test.com');
    });
  });

  describe('Approval Workflow Sequences', () => {
    let sequenceValidator: EventSequenceValidator;

    beforeEach(() => {
      sequenceValidator = new EventSequenceValidator([
        'approval-required',
        'approval-resolved',
      ]);
    });

    it('should validate successful approval workflow', () => {
      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');

      sequenceValidator.addEvent('approval-required', createApprovalRequiredEvent(taskId, { approvalId }));
      sequenceValidator.addEvent('approval-resolved', createApprovalResolvedEvent(approvalId, taskId, 'approved'));

      const result = sequenceValidator.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate denied approval workflow', () => {
      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');

      sequenceValidator.addEvent('approval-required', createApprovalRequiredEvent(taskId, { approvalId }));
      sequenceValidator.addEvent('approval-resolved', createApprovalResolvedEvent(approvalId, taskId, 'denied', {
        finalComment: 'Security concerns identified',
        approvalsReceived: 0,
        approvalsRequired: 1,
      }));

      const result = sequenceValidator.validate();

      expect(result.isValid).toBe(true);
    });

    it('should validate timeout approval workflow', () => {
      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');

      sequenceValidator.addEvent('approval-required', createApprovalRequiredEvent(taskId, {
        approvalId,
        timeoutMinutes: 60,
      }));
      sequenceValidator.addEvent('approval-resolved', createApprovalResolvedEvent(approvalId, taskId, 'timeout', {
        finalComment: 'Approval request timed out after 60 minutes',
        approvalsReceived: 0,
        approvalsRequired: 1,
      }));

      const result = sequenceValidator.validate();

      expect(result.isValid).toBe(true);
    });

    it('should validate multi-approval workflow', () => {
      const multiApprovalSequence = new EventSequenceValidator([
        'approval-required',
        'gate:approved',
        'gate:approved',
        'approval-resolved',
      ]);

      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');

      multiApprovalSequence.addEvent('approval-required', createApprovalRequiredEvent(taskId, {
        approvalId,
        minApprovals: 2,
        approvers: ['admin@test.com', 'security@test.com'],
      }));
      multiApprovalSequence.addEvent('gate:approved', { approvalId, approver: 'admin@test.com' });
      multiApprovalSequence.addEvent('gate:approved', { approvalId, approver: 'security@test.com' });
      multiApprovalSequence.addEvent('approval-resolved', createApprovalResolvedEvent(approvalId, taskId, 'approved', {
        approvalsReceived: 2,
        approvalsRequired: 2,
      }));

      const result = multiApprovalSequence.validate();

      expect(result.isValid).toBe(true);
    });
  });

  describe('Cross-Reference Integrity', () => {
    let crossRefValidator: CrossReferenceValidator;

    beforeEach(() => {
      crossRefValidator = new CrossReferenceValidator();
    });

    it('should maintain approvalId consistency across events', () => {
      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');

      const requiredEvent = createApprovalRequiredEvent(taskId, { approvalId });
      const resolvedEvent = createApprovalResolvedEvent(approvalId, taskId, 'approved');

      crossRefValidator.registerReference('approvalId', requiredEvent.approvalId);
      crossRefValidator.registerReference('approvalId', resolvedEvent.approvalId);

      const allRefs = crossRefValidator.getAllReferences();
      expect(allRefs.approvalId).toHaveLength(1);
      expect(allRefs.approvalId[0]).toBe(approvalId);
    });

    it('should maintain taskId consistency across approval events', () => {
      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');

      const requiredEvent = createApprovalRequiredEvent(taskId, { approvalId });
      const resolvedEvent = createApprovalResolvedEvent(approvalId, taskId, 'approved');

      crossRefValidator.registerReference('taskId', requiredEvent.taskId);
      crossRefValidator.registerReference('taskId', resolvedEvent.taskId);

      const allRefs = crossRefValidator.getAllReferences();
      expect(allRefs.taskId).toHaveLength(1);
      expect(allRefs.taskId[0]).toBe(taskId);
    });

    it('should validate gateName consistency', () => {
      const taskId = generateTestId('task');
      const approvalId = generateTestId('approval');
      const gateName = 'Production Deployment Gate';

      const requiredEvent = createApprovalRequiredEvent(taskId, { approvalId, gateName });
      const resolvedEvent = createApprovalResolvedEvent(approvalId, taskId, 'approved', { gateName });

      expect(requiredEvent.gateName).toBe(resolvedEvent.gateName);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle SQL injection-like strings in description', () => {
      const maliciousDescription = "'; DROP TABLE approvals; --";
      const event = createApprovalRequiredEvent('task-1', { description: maliciousDescription });

      const roundTrip = validateJsonRoundTrip(event, ['requestedAt']);
      expect(roundTrip.isValid).toBe(true);
      expect(roundTrip.deserialized.description).toBe(maliciousDescription);
    });

    it('should handle XSS-like strings in comments', () => {
      const xssComment = '<script>alert("xss")</script>';
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'denied', {
        finalComment: xssComment,
      });

      const roundTrip = validateJsonRoundTrip(event, ['resolvedAt']);
      expect(roundTrip.isValid).toBe(true);
      expect(roundTrip.deserialized.finalComment).toBe(xssComment);
    });

    it('should handle extremely long approver lists', () => {
      const manyApprovers = Array.from({ length: 100 }, (_, i) => `approver${i}@test.com`);
      const event = createApprovalRequiredEvent('task-1', { approvers: manyApprovers });

      expect(event.approvers).toHaveLength(100);

      const roundTrip = validateJsonRoundTrip(event, ['requestedAt']);
      expect(roundTrip.isValid).toBe(true);
    });

    it('should handle unicode in approver emails', () => {
      const unicodeApprovers = ['admin@tëst.com', 'security@テスト.com', '管理者@test.com'];
      const event = createApprovalRequiredEvent('task-1', { approvers: unicodeApprovers });

      expect(event.approvers).toEqual(unicodeApprovers);

      const roundTrip = validateJsonRoundTrip(event, ['requestedAt']);
      expect(roundTrip.isValid).toBe(true);
    });

    it('should handle approval events with zero timeout', () => {
      // Edge case: instant timeout (should probably be prevented upstream)
      const event = createApprovalRequiredEvent('task-1', { timeoutMinutes: 0 });

      expect(event.timeoutMinutes).toBe(0);
    });

    it('should handle approval events requiring many approvals', () => {
      const event = createApprovalRequiredEvent('task-1', {
        minApprovals: 10,
        approvers: Array.from({ length: 15 }, (_, i) => `approver${i}@test.com`),
      });

      expect(event.minApprovals).toBe(10);
      expect(event.approvers!.length).toBeGreaterThanOrEqual(event.minApprovals!);
    });
  });

  describe('Gate-specific Events', () => {
    it('should handle before-commit gate type', () => {
      const event = createApprovalRequiredEvent('task-1', {
        gateType: 'before-commit',
        gateName: 'Code Review Gate',
        description: 'All code changes require review before commit',
      });

      expect(event.gateType).toBe('before-commit');
    });

    it('should handle before-deploy gate type', () => {
      const event = createApprovalRequiredEvent('task-1', {
        gateType: 'before-deploy',
        gateName: 'Production Deployment Gate',
        description: 'Requires approval before deploying to production',
      });

      expect(event.gateType).toBe('before-deploy');
    });

    it('should handle before-destructive gate type', () => {
      const event = createApprovalRequiredEvent('task-1', {
        gateType: 'before-destructive',
        gateName: 'Destructive Operation Gate',
        description: 'This operation will delete data and cannot be undone',
      });

      expect(event.gateType).toBe('before-destructive');
    });

    it('should handle custom gate type', () => {
      const event = createApprovalRequiredEvent('task-1', {
        gateType: 'custom',
        gateName: 'Custom Business Logic Gate',
        description: 'Approval required by business rules',
      });

      expect(event.gateType).toBe('custom');
    });
  });

  describe('Resolution Data Consistency', () => {
    it('should ensure approved resolution has correct approval counts', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'approved', {
        approvalsReceived: 2,
        approvalsRequired: 2,
      });

      expect(event.resolution).toBe('approved');
      expect(event.approvalsReceived).toBeGreaterThanOrEqual(event.approvalsRequired!);
    });

    it('should ensure denied resolution has appropriate metadata', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'denied', {
        resolvedBy: 'security@test.com',
        finalComment: 'Security policy violation detected',
        approvalsReceived: 0,
        approvalsRequired: 1,
      });

      expect(event.resolution).toBe('denied');
      expect(event.resolvedBy).toBeTruthy();
      expect(event.finalComment).toBeTruthy();
    });

    it('should ensure timeout resolution has timestamp', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'timeout', {
        resolvedAt: new Date(),
        finalComment: 'Approval request timed out',
      });

      expect(event.resolution).toBe('timeout');
      expect(event.resolvedAt).toBeInstanceOf(Date);
    });

    it('should ensure cancelled resolution tracks who cancelled', () => {
      const event = createApprovalResolvedEvent('approval-1', 'task-1', 'cancelled', {
        resolvedBy: 'task-owner@test.com',
        finalComment: 'Task no longer needed',
      });

      expect(event.resolution).toBe('cancelled');
      expect(event.resolvedBy).toBeTruthy();
    });
  });
});
