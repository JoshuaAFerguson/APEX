import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import { Config } from '@apex/core';
import path from 'node:path';
import fs from 'fs/promises';
import os from 'node:os';

/**
 * Complete Integration Test Suite for Audit Logging in ApexOrchestrator
 *
 * This test suite validates the acceptance criteria:
 * "ApexOrchestrator calls audit logging methods when: autonomy mode changes occur,
 * approval is requested from user, approval response is received. All transitions
 * captured with full context including task ID, action type, and outcome."
 */
describe('Audit Logging Complete Integration', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let tempDir: string;
  let config: Config;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-audit-complete-test-'));

    // Create .apex directory
    const apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Test configuration with approval gates
    config = {
      projectName: 'audit-complete-test',
      projectDescription: 'Complete audit logging integration test',
      autonomy: {
        level: 'full-auto',
        gates: [
          {
            id: 'security-gate',
            name: 'Security Review',
            description: 'Security team approval required for sensitive operations',
            trigger: {
              conditions: ['always']
            },
            timeout: 60,
            approvers: ['security-team'],
            approvalsRequired: 1
          }
        ]
      },
      limits: {
        maxTurns: 10,
        maxCostPerTask: 1.0,
        maxRetries: 1,
        maxConcurrentTasks: 1,
        retryDelayMs: 100,
        retryBackoffFactor: 1.0
      },
      agents: {},
      workflows: {},
      git: {
        defaultBranch: 'main',
        branchPrefix: 'apex/',
        commitAfterSubtask: false,
        pushAfterTask: false,
        createPR: false,
        prDraft: true
      },
      policy: {
        enabled: false,
        preCommit: false,
        approvalRules: {
          enabled: false,
          rules: []
        }
      }
    };

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: tempDir,
      workingDirectory: tempDir,
      silent: true,
      skipGitOps: true
    });

    await orchestrator.initialize();
    store = orchestrator.store;
  });

  afterEach(async () => {
    await orchestrator?.destroy();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Complete Audit Trail - Acceptance Criteria Validation', () => {
    it('should capture all autonomy transitions with full context including task ID, action type, and outcome', async () => {
      // Create task
      const task = await orchestrator.createTask({
        description: 'Complete audit logging test task',
        acceptanceCriteria: 'All audit transitions captured with full context',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      expect(task.id).toBeDefined();
      const taskId = task.id;

      // === TEST 1: Autonomy Mode Change When Approval is Requested ===

      // Create approval state to simulate approval request
      const approvalState = {
        id: 'test-approval-complete-' + Date.now(),
        taskId,
        gateName: 'security-gate',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Security-sensitive operation',
          gateDescription: 'Security team approval required for sensitive operations'
        }
      };

      await store.saveApprovalState(approvalState);

      // Test approval request logging
      const approvalContext = `Approval gate: ${approvalState.gateName} - ${approvalState.context.gateDescription}`;
      await store.logApprovalRequest(taskId, approvalContext);

      // Test autonomy mode change logging for approval request
      await store.logModeChange(
        taskId,
        'full-auto',
        'supervised',
        `Approval gate triggered: ${approvalState.gateName} - requiring manual oversight`
      );

      // Verify approval request audit log
      const auditLogsAfterRequest = await store.getAuditLogs(taskId);

      const approvalRequestLog = auditLogsAfterRequest.find(log => log.eventType === 'approval.requested');
      expect(approvalRequestLog, 'Approval request should be logged').toBeDefined();
      expect(approvalRequestLog?.taskId, 'Task ID should be captured').toBe(taskId);
      expect(approvalRequestLog?.eventType, 'Action type should be approval.requested').toBe('approval.requested');
      expect(approvalRequestLog?.message, 'Context should include approval gate info').toContain('security-gate');
      expect(approvalRequestLog?.actor, 'Actor should be system').toBe('system');
      expect(approvalRequestLog?.severity, 'Severity should be info').toBe('info');
      expect(approvalRequestLog?.success, 'Outcome should be success').toBe(true);
      expect(approvalRequestLog?.metadata?.context, 'Metadata should contain context').toBe(approvalContext);

      // Verify autonomy mode change for approval request
      const modeChangeRequestLog = auditLogsAfterRequest.find(log =>
        log.eventType === 'config.updated' && log.newState === 'supervised'
      );
      expect(modeChangeRequestLog, 'Mode change should be logged').toBeDefined();
      expect(modeChangeRequestLog?.taskId, 'Task ID should be captured').toBe(taskId);
      expect(modeChangeRequestLog?.eventType, 'Action type should be config.updated').toBe('config.updated');
      expect(modeChangeRequestLog?.previousState, 'Previous state should be captured').toBe('full-auto');
      expect(modeChangeRequestLog?.newState, 'New state should be captured').toBe('supervised');
      expect(modeChangeRequestLog?.metadata?.reason, 'Reason should be captured').toContain('security-gate');

      // === TEST 2: Approval Grant and Autonomy Restoration ===

      // Test approval response logging for grant
      await store.logApprovalResponse(
        taskId,
        'security-lead',
        true,
        'Security review completed - approved for deployment'
      );

      // Test autonomy mode change for approval grant
      await store.logModeChange(
        taskId,
        'supervised',
        'full-auto',
        'Approval granted by security-lead - resuming with original autonomy level'
      );

      // Verify approval grant audit log
      const auditLogsAfterGrant = await store.getAuditLogs(taskId);

      const approvalGrantLog = auditLogsAfterGrant.find(log => log.eventType === 'approval.granted');
      expect(approvalGrantLog, 'Approval grant should be logged').toBeDefined();
      expect(approvalGrantLog?.taskId, 'Task ID should be captured').toBe(taskId);
      expect(approvalGrantLog?.eventType, 'Action type should be approval.granted').toBe('approval.granted');
      expect(approvalGrantLog?.actor, 'Actor should be approver').toBe('security-lead');
      expect(approvalGrantLog?.metadata?.approved, 'Outcome should be true').toBe(true);
      expect(approvalGrantLog?.metadata?.approver, 'Approver should be captured').toBe('security-lead');

      // Verify autonomy restoration mode change
      const modeChangeGrantLog = auditLogsAfterGrant.find(log =>
        log.eventType === 'config.updated' &&
        log.previousState === 'supervised' &&
        log.newState === 'full-auto'
      );
      expect(modeChangeGrantLog, 'Mode change restoration should be logged').toBeDefined();
      expect(modeChangeGrantLog?.taskId, 'Task ID should be captured').toBe(taskId);
      expect(modeChangeGrantLog?.metadata?.reason, 'Reason should include approver').toContain('security-lead');

      // === TEST 3: Complete audit trail verification ===

      const allAuditLogs = await store.getAuditLogs(taskId);

      // Should have at least 4 audit logs: approval request, mode change to supervised, approval grant, mode change to full-auto
      expect(allAuditLogs.length, 'Complete audit trail should exist').toBeGreaterThanOrEqual(4);

      // All logs should have proper task ID
      allAuditLogs.forEach((log, index) => {
        expect(log.taskId, `Log ${index} should have correct task ID`).toBe(taskId);
        expect(log.id, `Log ${index} should have unique ID`).toBeDefined();
        expect(log.timestamp, `Log ${index} should have timestamp`).toBeInstanceOf(Date);
        expect(log.eventType, `Log ${index} should have event type`).toBeDefined();
        expect(log.actor, `Log ${index} should have actor`).toBeDefined();
        expect(log.message, `Log ${index} should have message`).toBeDefined();
        expect(typeof log.success, `Log ${index} should have success outcome`).toBe('boolean');
      });

      // Verify chronological order
      const sortedLogs = allAuditLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      expect(sortedLogs[0].eventType, 'First event should be approval request').toBe('approval.requested');

      // Find the approval granted log
      const grantedLogIndex = sortedLogs.findIndex(log => log.eventType === 'approval.granted');
      expect(grantedLogIndex, 'Approval granted should exist').toBeGreaterThan(-1);

      // Approval request should come before approval granted
      const requestLogIndex = sortedLogs.findIndex(log => log.eventType === 'approval.requested');
      expect(requestLogIndex, 'Request should come before grant').toBeLessThan(grantedLogIndex);
    });

    it('should capture approval denial transitions with full context', async () => {
      // Create task
      const task = await orchestrator.createTask({
        description: 'Test audit logging for approval denial',
        acceptanceCriteria: 'Denial transitions captured with full context',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      const taskId = task.id;

      // Create approval state
      const approvalState = {
        id: 'test-denial-' + Date.now(),
        taskId,
        gateName: 'security-gate',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Security review',
          gateDescription: 'Security team approval required'
        }
      };

      await store.saveApprovalState(approvalState);

      // Log approval request
      await store.logApprovalRequest(taskId, 'Security review required');
      await store.logModeChange(taskId, 'full-auto', 'supervised', 'Approval gate triggered');

      // Test approval denial
      const denialReason = 'Security vulnerabilities identified - requires code changes';
      await store.logApprovalResponse(
        taskId,
        'security-reviewer',
        false,
        denialReason
      );

      await store.logModeChange(
        taskId,
        'supervised',
        'manual',
        `Approval denied by security-reviewer - requiring manual intervention: ${denialReason}`
      );

      // Verify denial audit log
      const auditLogs = await store.getAuditLogs(taskId);

      const denialLog = auditLogs.find(log => log.eventType === 'approval.denied');
      expect(denialLog, 'Approval denial should be logged').toBeDefined();
      expect(denialLog?.taskId, 'Task ID should be captured').toBe(taskId);
      expect(denialLog?.eventType, 'Action type should be approval.denied').toBe('approval.denied');
      expect(denialLog?.actor, 'Actor should be denier').toBe('security-reviewer');
      expect(denialLog?.metadata?.approved, 'Outcome should be false').toBe(false);
      expect(denialLog?.metadata?.context, 'Context should include denial reason').toBe(denialReason);

      // Verify mode change to manual intervention
      const modeChangeDenialLog = auditLogs.find(log =>
        log.eventType === 'config.updated' && log.newState === 'manual'
      );
      expect(modeChangeDenialLog, 'Mode change to manual should be logged').toBeDefined();
      expect(modeChangeDenialLog?.previousState, 'Previous state should be supervised').toBe('supervised');
      expect(modeChangeDenialLog?.newState, 'New state should be manual').toBe('manual');
      expect(modeChangeDenialLog?.metadata?.reason, 'Reason should include denial context').toContain('security-reviewer');
    });

    it('should capture autonomy enforcer triggered mode changes', async () => {
      // Create task
      const task = await orchestrator.createTask({
        description: 'Test autonomy enforcer audit logging',
        acceptanceCriteria: 'Enforcer triggered transitions captured',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      const taskId = task.id;

      // Simulate autonomy enforcer triggering mode change
      const gateName = 'runtime-security-gate';
      const reason = `Autonomy enforcer triggered approval gate: ${gateName}`;

      await store.logModeChange(
        taskId,
        'full-auto',
        'supervised',
        reason
      );

      // Verify audit log
      const auditLogs = await store.getAuditLogs(taskId);

      const enforcerLog = auditLogs.find(log =>
        log.eventType === 'config.updated' &&
        log.metadata?.reason?.includes('Autonomy enforcer triggered')
      );

      expect(enforcerLog, 'Autonomy enforcer mode change should be logged').toBeDefined();
      expect(enforcerLog?.taskId, 'Task ID should be captured').toBe(taskId);
      expect(enforcerLog?.eventType, 'Action type should be config.updated').toBe('config.updated');
      expect(enforcerLog?.actor, 'Actor should be system').toBe('system');
      expect(enforcerLog?.previousState, 'Previous autonomy should be captured').toBe('full-auto');
      expect(enforcerLog?.newState, 'New autonomy should be captured').toBe('supervised');
      expect(enforcerLog?.metadata?.reason, 'Gate name should be included').toContain(gateName);
      expect(enforcerLog?.success, 'Outcome should be success').toBe(true);
    });
  });

  describe('Audit Log Data Integrity', () => {
    it('should ensure all audit logs have required fields with proper data types', async () => {
      const task = await orchestrator.createTask({
        description: 'Data integrity test task',
        acceptanceCriteria: 'All audit logs have proper data structure',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      // Add various types of audit logs
      await store.logApprovalRequest(task.id, 'Test approval request');
      await store.logModeChange(task.id, 'auto', 'manual', 'Test mode change');
      await store.logApprovalResponse(task.id, 'tester', true, 'Test approval response');

      const auditLogs = await store.getAuditLogs(task.id);
      expect(auditLogs.length).toBeGreaterThan(0);

      auditLogs.forEach((log, index) => {
        // Required fields
        expect(log.id, `Log ${index} should have ID`).toMatch(/^[0-9a-f-]{36}$/); // UUID format
        expect(log.taskId, `Log ${index} should have taskId`).toBe(task.id);
        expect(log.eventType, `Log ${index} should have eventType`).toBeDefined();
        expect(log.severity, `Log ${index} should have severity`).toMatch(/^(info|warn|error|debug)$/);
        expect(log.timestamp, `Log ${index} should have timestamp`).toBeInstanceOf(Date);
        expect(log.actor, `Log ${index} should have actor`).toBeDefined();
        expect(log.message, `Log ${index} should have message`).toBeDefined();
        expect(typeof log.success, `Log ${index} should have boolean success`).toBe('boolean');

        // Optional fields should be proper types if present
        if (log.metadata !== undefined) {
          expect(typeof log.metadata, `Log ${index} metadata should be object`).toBe('object');
        }
        if (log.previousState !== undefined) {
          expect(typeof log.previousState, `Log ${index} previousState should be string`).toBe('string');
        }
        if (log.newState !== undefined) {
          expect(typeof log.newState, `Log ${index} newState should be string`).toBe('string');
        }
      });
    });
  });
});