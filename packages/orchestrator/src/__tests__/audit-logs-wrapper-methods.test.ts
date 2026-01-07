import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import type { Task, AuditLogEntry } from '@apexcli/core';

describe('TaskStore - Audit Log Wrapper Methods', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    // Create a temporary directory for the test database
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-audit-wrapper-test-'));
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.close();
    }
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const createTestTask = async (): Promise<Task> => {
    const task: Task = {
      id: `task_${Date.now()}_audit_wrapper`,
      description: 'Test task for audit logging wrapper methods',
      workflow: 'feature',
      autonomy: 'full',
      status: 'pending',
      priority: 'normal',
      projectPath: testDir,
      branchName: 'apex/audit-wrapper-test',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      logs: [],
      artifacts: [],
    };
    await store.createTask(task);
    return task;
  };

  describe('logAuditEntry', () => {
    it('should successfully log an audit entry via wrapper method', async () => {
      const task = await createTestTask();

      const auditEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_wrapper_test`,
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        timestamp: new Date(),
        actor: 'test-wrapper',
        message: 'Test audit entry via wrapper method',
        stage: 'testing',
        agent: 'tester',
        metadata: { wrapperTest: true },
        success: true,
      };

      // Test the wrapper method
      await store.logAuditEntry(auditEntry);

      // Verify the entry was logged correctly
      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: auditEntry.id,
        taskId: task.id,
        eventType: 'task.created',
        severity: 'info',
        actor: 'test-wrapper',
        message: 'Test audit entry via wrapper method',
        stage: 'testing',
        agent: 'tester',
        success: true,
      });
      expect(logs[0].metadata).toEqual({ wrapperTest: true });
    });

    it('should handle minimal audit entry through wrapper', async () => {
      const task = await createTestTask();

      const minimalEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_minimal`,
        taskId: task.id,
        eventType: 'task.started',
        severity: 'info',
        timestamp: new Date(),
        actor: 'system',
        message: 'Minimal audit entry',
      };

      await store.logAuditEntry(minimalEntry);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        taskId: task.id,
        eventType: 'task.started',
        severity: 'info',
        actor: 'system',
        message: 'Minimal audit entry',
      });
    });
  });

  describe('logModeChange', () => {
    it('should log autonomy mode change correctly', async () => {
      const task = await createTestTask();

      await store.logModeChange(
        task.id,
        'full',
        'supervised',
        'User requested more oversight'
      );

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);

      const logEntry = logs[0];
      expect(logEntry).toMatchObject({
        taskId: task.id,
        eventType: 'config.updated',
        severity: 'info',
        actor: 'system',
        message: 'Autonomy mode changed from full to supervised: User requested more oversight',
        previousState: 'full',
        newState: 'supervised',
      });

      expect(logEntry.metadata).toEqual({
        previousMode: 'full',
        newMode: 'supervised',
        reason: 'User requested more oversight',
      });

      // Verify timestamp is recent
      expect(Date.now() - logEntry.timestamp.getTime()).toBeLessThan(1000);
    });

    it('should handle mode change with complex reason', async () => {
      const task = await createTestTask();
      const complexReason = 'Security policy requires manual approval for production deployments and sensitive operations involving user data';

      await store.logModeChange(
        task.id,
        'autonomous',
        'manual',
        complexReason
      );

      const logs = await store.getAuditLogs(task.id);
      expect(logs[0]).toMatchObject({
        eventType: 'config.updated',
        message: `Autonomy mode changed from autonomous to manual: ${complexReason}`,
      });
      expect(logs[0].metadata.reason).toBe(complexReason);
    });

    it('should generate unique IDs for multiple mode changes', async () => {
      const task = await createTestTask();

      await store.logModeChange(task.id, 'full', 'supervised', 'First change');
      await store.logModeChange(task.id, 'supervised', 'manual', 'Second change');

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(2);

      // Verify unique IDs
      expect(logs[0].id).not.toBe(logs[1].id);

      // Verify correct ordering (newest first)
      expect(logs[0].metadata.reason).toBe('Second change');
      expect(logs[1].metadata.reason).toBe('First change');
    });
  });

  describe('logApprovalRequest', () => {
    it('should log approval request correctly', async () => {
      const task = await createTestTask();
      const context = 'Deploy to production environment';

      await store.logApprovalRequest(task.id, context);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);

      const logEntry = logs[0];
      expect(logEntry).toMatchObject({
        taskId: task.id,
        eventType: 'approval.requested',
        severity: 'info',
        actor: 'system',
        message: `Approval requested: ${context}`,
        success: true,
      });

      expect(logEntry.metadata).toEqual({
        context,
        requestedAt: expect.any(String),
      });

      // Verify requestedAt is a valid ISO string
      const requestedAt = new Date(logEntry.metadata.requestedAt);
      expect(requestedAt.toISOString()).toBe(logEntry.metadata.requestedAt);
      expect(Date.now() - requestedAt.getTime()).toBeLessThan(1000);
    });

    it('should handle approval request with complex context', async () => {
      const task = await createTestTask();
      const complexContext = 'Modify database schema: Add user_preferences table with foreign key constraints and indexes for performance optimization';

      await store.logApprovalRequest(task.id, complexContext);

      const logs = await store.getAuditLogs(task.id);
      expect(logs[0]).toMatchObject({
        message: `Approval requested: ${complexContext}`,
      });
      expect(logs[0].metadata.context).toBe(complexContext);
    });

    it('should handle multiple approval requests for the same task', async () => {
      const task = await createTestTask();

      await store.logApprovalRequest(task.id, 'First approval request');
      await store.logApprovalRequest(task.id, 'Second approval request');

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(2);

      // Verify both are approval.requested events
      expect(logs.every(log => log.eventType === 'approval.requested')).toBe(true);

      // Verify different contexts
      expect(logs[0].metadata.context).toBe('Second approval request');
      expect(logs[1].metadata.context).toBe('First approval request');
    });

    it('should generate unique IDs for approval requests', async () => {
      const task = await createTestTask();

      await store.logApprovalRequest(task.id, 'Request 1');
      await store.logApprovalRequest(task.id, 'Request 2');

      const logs = await store.getAuditLogs(task.id);
      expect(logs[0].id).not.toBe(logs[1].id);
      expect(logs[0].id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(logs[1].id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });
  });

  describe('logApprovalResponse', () => {
    it('should log approval granted correctly', async () => {
      const task = await createTestTask();
      const approver = 'john.doe';
      const context = 'Database migration approval';

      await store.logApprovalResponse(task.id, approver, true, context);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);

      const logEntry = logs[0];
      expect(logEntry).toMatchObject({
        taskId: task.id,
        eventType: 'approval.granted',
        severity: 'info',
        actor: approver,
        message: `Approval granted by ${approver}: ${context}`,
        success: true,
      });

      expect(logEntry.metadata).toEqual({
        context,
        approved: true,
        approver,
        respondedAt: expect.any(String),
      });

      // Verify respondedAt is a valid ISO string
      const respondedAt = new Date(logEntry.metadata.respondedAt);
      expect(respondedAt.toISOString()).toBe(logEntry.metadata.respondedAt);
      expect(Date.now() - respondedAt.getTime()).toBeLessThan(1000);
    });

    it('should log approval denied correctly', async () => {
      const task = await createTestTask();
      const approver = 'jane.smith';
      const context = 'Production deployment during peak hours';

      await store.logApprovalResponse(task.id, approver, false, context);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);

      const logEntry = logs[0];
      expect(logEntry).toMatchObject({
        taskId: task.id,
        eventType: 'approval.denied',
        severity: 'info',
        actor: approver,
        message: `Approval denied by ${approver}: ${context}`,
        success: true,
      });

      expect(logEntry.metadata).toEqual({
        context,
        approved: false,
        approver,
        respondedAt: expect.any(String),
      });
    });

    it('should handle different approvers and contexts', async () => {
      const task = await createTestTask();

      await store.logApprovalResponse(task.id, 'admin', true, 'Security review passed');
      await store.logApprovalResponse(task.id, 'lead.dev', false, 'Code quality issues found');

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(2);

      // Verify first log (newest - denied)
      expect(logs[0]).toMatchObject({
        eventType: 'approval.denied',
        actor: 'lead.dev',
        message: 'Approval denied by lead.dev: Code quality issues found',
      });
      expect(logs[0].metadata.approved).toBe(false);

      // Verify second log (older - granted)
      expect(logs[1]).toMatchObject({
        eventType: 'approval.granted',
        actor: 'admin',
        message: 'Approval granted by admin: Security review passed',
      });
      expect(logs[1].metadata.approved).toBe(true);
    });

    it('should generate unique IDs for approval responses', async () => {
      const task = await createTestTask();

      await store.logApprovalResponse(task.id, 'user1', true, 'Context 1');
      await store.logApprovalResponse(task.id, 'user2', false, 'Context 2');

      const logs = await store.getAuditLogs(task.id);
      expect(logs[0].id).not.toBe(logs[1].id);
      expect(logs[0].id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(logs[1].id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });
  });

  describe('Integration tests - workflow scenarios', () => {
    it('should log complete approval workflow', async () => {
      const task = await createTestTask();

      // Log the complete approval workflow
      await store.logApprovalRequest(task.id, 'Deploy to production');
      await store.logModeChange(task.id, 'full', 'manual', 'Waiting for approval');
      await store.logApprovalResponse(task.id, 'prod.admin', true, 'Deploy to production');
      await store.logModeChange(task.id, 'manual', 'full', 'Approval granted, resuming autonomy');

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(4);

      // Verify the sequence (newest first)
      expect(logs[0].eventType).toBe('config.updated'); // Mode change back to full
      expect(logs[0].metadata.newMode).toBe('full');

      expect(logs[1].eventType).toBe('approval.granted'); // Approval granted
      expect(logs[1].metadata.approved).toBe(true);

      expect(logs[2].eventType).toBe('config.updated'); // Mode change to manual
      expect(logs[2].metadata.newMode).toBe('manual');

      expect(logs[3].eventType).toBe('approval.requested'); // Initial request
    });

    it('should log approval rejection workflow', async () => {
      const task = await createTestTask();

      // Log approval rejection workflow
      await store.logApprovalRequest(task.id, 'Delete production database');
      await store.logApprovalResponse(task.id, 'security.admin', false, 'Delete production database');
      await store.logModeChange(task.id, 'manual', 'disabled', 'Task cancelled due to rejection');

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(3);

      expect(logs[0].eventType).toBe('config.updated');
      expect(logs[0].metadata.newMode).toBe('disabled');

      expect(logs[1].eventType).toBe('approval.denied');
      expect(logs[1].metadata.approved).toBe(false);

      expect(logs[2].eventType).toBe('approval.requested');
    });

    it('should handle multiple approval rounds', async () => {
      const task = await createTestTask();

      // First round - denied
      await store.logApprovalRequest(task.id, 'Deploy v1.0');
      await store.logApprovalResponse(task.id, 'qa.lead', false, 'Deploy v1.0');

      // Second round - approved
      await store.logApprovalRequest(task.id, 'Deploy v1.1 with fixes');
      await store.logApprovalResponse(task.id, 'qa.lead', true, 'Deploy v1.1 with fixes');

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(4);

      // Filter approval requests and responses
      const requests = logs.filter(log => log.eventType === 'approval.requested');
      const responses = logs.filter(log => log.eventType === 'approval.granted' || log.eventType === 'approval.denied');

      expect(requests).toHaveLength(2);
      expect(responses).toHaveLength(2);
      expect(responses[0].eventType).toBe('approval.granted'); // Latest response
      expect(responses[1].eventType).toBe('approval.denied'); // Earlier response
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty context strings', async () => {
      const task = await createTestTask();

      await store.logApprovalRequest(task.id, '');
      await store.logApprovalResponse(task.id, 'admin', true, '');

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(2);

      expect(logs[0].message).toBe('Approval granted by admin: ');
      expect(logs[0].metadata.context).toBe('');

      expect(logs[1].message).toBe('Approval requested: ');
      expect(logs[1].metadata.context).toBe('');
    });

    it('should handle special characters in parameters', async () => {
      const task = await createTestTask();
      const specialContext = 'Context with "quotes", \'apostrophes\', and émojis 🚀';
      const specialApprover = 'user@domain.com';
      const specialReason = 'Reason with newlines\nand tabs\t';

      await store.logApprovalRequest(task.id, specialContext);
      await store.logApprovalResponse(task.id, specialApprover, true, specialContext);
      await store.logModeChange(task.id, 'manual', 'auto', specialReason);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(3);

      expect(logs[0].metadata.reason).toBe(specialReason);
      expect(logs[1].actor).toBe(specialApprover);
      expect(logs[1].metadata.context).toBe(specialContext);
      expect(logs[2].metadata.context).toBe(specialContext);
    });

    it('should handle very long parameter strings', async () => {
      const task = await createTestTask();
      const longContext = 'x'.repeat(1000);
      const longReason = 'y'.repeat(2000);
      const longApprover = 'z'.repeat(100);

      await store.logApprovalRequest(task.id, longContext);
      await store.logApprovalResponse(task.id, longApprover, false, longContext);
      await store.logModeChange(task.id, 'a'.repeat(50), 'b'.repeat(50), longReason);

      const logs = await store.getAuditLogs(task.id);
      expect(logs).toHaveLength(3);

      expect(logs[0].metadata.reason).toHaveLength(2000);
      expect(logs[1].actor).toHaveLength(100);
      expect(logs[1].metadata.context).toHaveLength(1000);
      expect(logs[2].metadata.context).toHaveLength(1000);
    });
  });

  describe('Timestamp validation', () => {
    it('should create timestamps that are close to current time', async () => {
      const task = await createTestTask();
      const startTime = Date.now();

      await store.logModeChange(task.id, 'old', 'new', 'test');
      await store.logApprovalRequest(task.id, 'test context');
      await store.logApprovalResponse(task.id, 'admin', true, 'test context');

      const endTime = Date.now();
      const logs = await store.getAuditLogs(task.id);

      for (const log of logs) {
        expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(startTime - 100); // Small buffer
        expect(log.timestamp.getTime()).toBeLessThanOrEqual(endTime + 100); // Small buffer
      }
    });

    it('should create consistent timestamp formats in metadata', async () => {
      const task = await createTestTask();

      await store.logApprovalRequest(task.id, 'test');
      await store.logApprovalResponse(task.id, 'admin', true, 'test');

      const logs = await store.getAuditLogs(task.id);

      for (const log of logs) {
        if (log.metadata?.requestedAt) {
          expect(log.metadata.requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        }
        if (log.metadata?.respondedAt) {
          expect(log.metadata.respondedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        }
      }
    });
  });
});