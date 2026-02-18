import { describe, it, expect } from 'vitest';
import {
  AuditLogEntrySchema,
  AuditEventTypeSchema,
  AuditSeveritySchema,
  type AuditLogEntry,
  type AuditEventType,
  type AuditSeverity,
} from '../types';

describe('Audit Log Schema Validation', () => {
  describe('AuditEventTypeSchema', () => {
    it('should accept all valid task lifecycle event types', () => {
      const validTaskEvents: AuditEventType[] = [
        'task.created',
        'task.started',
        'task.completed',
        'task.failed',
        'task.cancelled',
        'task.paused',
        'task.resumed',
        'task.trashed',
        'task.restored',
      ];

      for (const eventType of validTaskEvents) {
        expect(AuditEventTypeSchema.parse(eventType)).toBe(eventType);
      }
    });

    it('should accept all valid configuration event types', () => {
      const validConfigEvents: AuditEventType[] = [
        'config.updated',
        'config.validated',
      ];

      for (const eventType of validConfigEvents) {
        expect(AuditEventTypeSchema.parse(eventType)).toBe(eventType);
      }
    });

    it('should accept all valid approval event types', () => {
      const validApprovalEvents: AuditEventType[] = [
        'approval.requested',
        'approval.granted',
        'approval.denied',
        'approval.timeout',
      ];

      for (const eventType of validApprovalEvents) {
        expect(AuditEventTypeSchema.parse(eventType)).toBe(eventType);
      }
    });

    it('should accept all valid permission event types', () => {
      const validPermissionEvents: AuditEventType[] = [
        'permission.granted',
        'permission.revoked',
      ];

      for (const eventType of validPermissionEvents) {
        expect(AuditEventTypeSchema.parse(eventType)).toBe(eventType);
      }
    });

    it('should accept all valid tool and security event types', () => {
      const validOtherEvents: AuditEventType[] = [
        'tool.executed',
        'tool.undone',
        'security.policy_violation',
        'security.rate_limited',
      ];

      for (const eventType of validOtherEvents) {
        expect(AuditEventTypeSchema.parse(eventType)).toBe(eventType);
      }
    });

    it('should reject invalid event types', () => {
      const invalidEventTypes = [
        'task.unknown',
        'approval.maybe',
        'permission.confused',
        'invalid.type',
        '',
        null,
        undefined,
        123,
        {},
        [],
      ];

      for (const eventType of invalidEventTypes) {
        expect(() => AuditEventTypeSchema.parse(eventType)).toThrow();
      }
    });
  });

  describe('AuditSeveritySchema', () => {
    it('should accept all valid severity levels', () => {
      const validSeverities: AuditSeverity[] = [
        'debug',
        'info',
        'warn',
        'error',
        'critical',
      ];

      for (const severity of validSeverities) {
        expect(AuditSeveritySchema.parse(severity)).toBe(severity);
      }
    });

    it('should reject invalid severity levels', () => {
      const invalidSeverities = [
        'verbose',
        'notice',
        'emergency',
        'trace',
        '',
        null,
        undefined,
        123,
        {},
        [],
      ];

      for (const severity of invalidSeverities) {
        expect(() => AuditSeveritySchema.parse(severity)).toThrow();
      }
    });
  });

  describe('AuditLogEntrySchema', () => {
    const baseValidEntry = {
      id: 'audit_test_123',
      eventType: 'task.created' as AuditEventType,
      severity: 'info' as AuditSeverity,
      timestamp: new Date(),
      actor: 'test-agent',
      message: 'Test audit log message',
    };

    it('should accept minimal valid audit log entry', () => {
      const entry = AuditLogEntrySchema.parse(baseValidEntry);
      expect(entry.id).toBe(baseValidEntry.id);
      expect(entry.eventType).toBe(baseValidEntry.eventType);
      expect(entry.severity).toBe(baseValidEntry.severity);
      expect(entry.timestamp).toEqual(baseValidEntry.timestamp);
      expect(entry.actor).toBe(baseValidEntry.actor);
      expect(entry.message).toBe(baseValidEntry.message);
      expect(entry.success).toBe(true); // default value
    });

    it('should accept complete audit log entry with all optional fields', () => {
      const completeEntry: AuditLogEntry = {
        ...baseValidEntry,
        taskId: 'task_123',
        stage: 'planning',
        agent: 'planner',
        metadata: { key: 'value', nested: { prop: 123 } },
        previousState: 'pending',
        newState: 'running',
        durationMs: 1500,
        success: false,
        error: 'Something went wrong',
        correlationId: 'correlation_123',
        sessionId: 'session_456',
      };

      const entry = AuditLogEntrySchema.parse(completeEntry);
      expect(entry).toEqual(completeEntry);
    });

    it('should validate required fields', () => {
      const requiredFields = ['id', 'eventType', 'severity', 'timestamp', 'actor', 'message'];

      for (const field of requiredFields) {
        const invalidEntry = { ...baseValidEntry };
        delete (invalidEntry as any)[field];

        expect(() => AuditLogEntrySchema.parse(invalidEntry))
          .toThrow(new RegExp(field));
      }
    });

    it('should reject empty id', () => {
      const entryWithEmptyId = { ...baseValidEntry, id: '' };
      expect(() => AuditLogEntrySchema.parse(entryWithEmptyId)).toThrow();
    });

    it('should reject invalid event type', () => {
      const entryWithInvalidEventType = { ...baseValidEntry, eventType: 'invalid.type' };
      expect(() => AuditLogEntrySchema.parse(entryWithInvalidEventType)).toThrow();
    });

    it('should reject invalid severity', () => {
      const entryWithInvalidSeverity = { ...baseValidEntry, severity: 'invalid' };
      expect(() => AuditLogEntrySchema.parse(entryWithInvalidSeverity)).toThrow();
    });

    it('should reject invalid timestamp', () => {
      const entryWithInvalidTimestamp = { ...baseValidEntry, timestamp: 'invalid-date' };
      expect(() => AuditLogEntrySchema.parse(entryWithInvalidTimestamp)).toThrow();
    });

    it('should accept valid metadata structures', () => {
      const validMetadataStructures = [
        { simple: 'value' },
        { nested: { deep: { very: 'deep' } } },
        { array: [1, 2, 3] },
        { mixed: { string: 'value', number: 123, bool: true, array: ['a', 'b'] } },
        { nullValue: null },
        { undefinedValue: undefined },
      ];

      for (const metadata of validMetadataStructures) {
        const entryWithMetadata = { ...baseValidEntry, metadata };
        const parsed = AuditLogEntrySchema.parse(entryWithMetadata);
        expect(parsed.metadata).toEqual(metadata);
      }
    });

    it('should handle state transition fields', () => {
      const stateTransitionEntry = {
        ...baseValidEntry,
        previousState: 'pending',
        newState: 'running',
        durationMs: 2500,
      };

      const parsed = AuditLogEntrySchema.parse(stateTransitionEntry);
      expect(parsed.previousState).toBe('pending');
      expect(parsed.newState).toBe('running');
      expect(parsed.durationMs).toBe(2500);
    });

    it('should handle error scenarios', () => {
      const errorEntry = {
        ...baseValidEntry,
        success: false,
        error: 'Critical failure occurred during task execution',
        severity: 'error' as AuditSeverity,
      };

      const parsed = AuditLogEntrySchema.parse(errorEntry);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Critical failure occurred during task execution');
      expect(parsed.severity).toBe('error');
    });

    it('should handle correlation and session tracking', () => {
      const trackingEntry = {
        ...baseValidEntry,
        correlationId: 'corr_1234567890',
        sessionId: 'session_abcdefgh',
      };

      const parsed = AuditLogEntrySchema.parse(trackingEntry);
      expect(parsed.correlationId).toBe('corr_1234567890');
      expect(parsed.sessionId).toBe('session_abcdefgh');
    });

    it('should reject negative duration', () => {
      const entryWithNegativeDuration = { ...baseValidEntry, durationMs: -100 };
      expect(() => AuditLogEntrySchema.parse(entryWithNegativeDuration)).toThrow();
    });

    it('should handle system-wide events without taskId', () => {
      const systemWideEntry = {
        ...baseValidEntry,
        eventType: 'config.updated' as AuditEventType,
        // Note: no taskId
      };

      const parsed = AuditLogEntrySchema.parse(systemWideEntry);
      expect(parsed.taskId).toBeUndefined();
      expect(parsed.eventType).toBe('config.updated');
    });

    it('should validate specific workflow scenarios', () => {
      // Approval request scenario
      const approvalRequestEntry = {
        ...baseValidEntry,
        taskId: 'task_approval_test',
        eventType: 'approval.requested' as AuditEventType,
        stage: 'implementation',
        metadata: {
          gate: 'review-gate',
          description: 'Code review required',
          urgency: 'normal',
        },
      };

      const parsed = AuditLogEntrySchema.parse(approvalRequestEntry);
      expect(parsed.eventType).toBe('approval.requested');
      expect(parsed.metadata).toEqual(approvalRequestEntry.metadata);
    });

    it('should validate task lifecycle transitions', () => {
      // Task started scenario
      const taskStartedEntry = {
        ...baseValidEntry,
        taskId: 'task_lifecycle_test',
        eventType: 'task.started' as AuditEventType,
        previousState: 'pending',
        newState: 'running',
        durationMs: 0, // Starting, so no duration yet
        metadata: {
          workflow: 'feature',
          agent: 'developer',
          autonomyLevel: 'autonomous',
        },
      };

      const parsed = AuditLogEntrySchema.parse(taskStartedEntry);
      expect(parsed.eventType).toBe('task.started');
      expect(parsed.previousState).toBe('pending');
      expect(parsed.newState).toBe('running');
    });
  });
});