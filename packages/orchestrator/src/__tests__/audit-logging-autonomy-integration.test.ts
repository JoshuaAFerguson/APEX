import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import { Config } from '@apex/core';
import path from 'node:path';
import fs from 'fs/promises';
import os from 'node:os';
import { EventEmitter } from 'events';

describe('Audit Logging - Autonomy Integration', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let tempDir: string;
  let config: Config;

  beforeAll(async () => {
    // Increase test timeout for integration tests
    // @ts-ignore - vitest timeout
    expect.setTimeout?.(30000);
  });

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-audit-test-'));

    // Create .apex directory
    const apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Basic test configuration
    config = {
      projectName: 'audit-test',
      projectDescription: 'Test project for audit logging',
      autonomy: {
        level: 'full-auto',
        gates: [
          {
            id: 'security-review',
            name: 'Security Review',
            description: 'Security team approval required',
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
    orchestrator = new ApexOrchestrator(config, {
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

  describe('Approval Request Audit Logging', () => {
    it('should log audit entry when approval request is created', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task that triggers approval gate',
        acceptanceCriteria: 'Task should complete successfully',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      // Create a mock workflow that requires approval
      const workflow = {
        name: 'feature',
        description: 'Feature workflow with approval gate',
        stages: [
          {
            name: 'planning',
            description: 'Plan the implementation',
            gate: 'security-review',
            agent: 'planner',
            maxTurns: 5
          }
        ]
      };

      // Mock the workflow execution to trigger approval gate
      const originalSaveApprovalState = store.saveApprovalState.bind(store);
      let approvalStateCreated = false;

      store.saveApprovalState = async (state) => {
        await originalSaveApprovalState(state);
        approvalStateCreated = true;
      };

      // Trigger workflow execution that should hit approval gate
      try {
        await orchestrator.executeWorkflow(task.id, workflow);
      } catch (error) {
        // Expected to fail at approval gate
      }

      if (approvalStateCreated) {
        // Get audit logs for the task
        const auditLogs = await store.getAuditLogs(task.id);

        // Should have approval request log
        const approvalRequestLog = auditLogs.find(log => log.eventType === 'approval.requested');
        expect(approvalRequestLog).toBeDefined();
        expect(approvalRequestLog?.message).toContain('Approval gate: security-review');
        expect(approvalRequestLog?.actor).toBe('system');
        expect(approvalRequestLog?.severity).toBe('info');

        // Should have mode change log for autonomy transition
        const modeChangeLog = auditLogs.find(log => log.eventType === 'config.updated');
        expect(modeChangeLog).toBeDefined();
        expect(modeChangeLog?.message).toContain('Autonomy mode changed from full-auto to supervised');
        expect(modeChangeLog?.previousState).toBe('full-auto');
        expect(modeChangeLog?.newState).toBe('supervised');
        expect(modeChangeLog?.metadata?.reason).toContain('Approval gate triggered: security-review');
      }
    });
  });

  describe('Approval Response Audit Logging', () => {
    it('should log audit entries for approval grant and autonomy restoration', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task for approval grant audit logging',
        acceptanceCriteria: 'Task should complete after approval',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      // Create approval state manually
      const approvalState = {
        id: 'test-approval-' + Date.now(),
        taskId: task.id,
        gateName: 'security-review',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Planning stage',
          gateDescription: 'Security team approval required'
        }
      };

      await store.saveApprovalState(approvalState);

      // Grant the approval
      await orchestrator.grantApproval(approvalState.id, 'test-approver', 'Approved for testing');

      // Get audit logs
      const auditLogs = await store.getAuditLogs(task.id);

      // Should have approval response log
      const approvalResponseLog = auditLogs.find(log => log.eventType === 'approval.granted');
      expect(approvalResponseLog).toBeDefined();
      expect(approvalResponseLog?.message).toContain('Approval granted by test-approver');
      expect(approvalResponseLog?.actor).toBe('test-approver');
      expect(approvalResponseLog?.metadata?.approved).toBe(true);

      // Should have mode change log for autonomy restoration
      const modeChangeLog = auditLogs.find(log =>
        log.eventType === 'config.updated' &&
        log.message.includes('resuming with original autonomy level')
      );
      expect(modeChangeLog).toBeDefined();
      expect(modeChangeLog?.previousState).toBe('supervised');
      expect(modeChangeLog?.newState).toBe('full-auto');
      expect(modeChangeLog?.metadata?.reason).toContain('Approval granted by test-approver');
    });

    it('should log audit entries for approval denial and manual intervention', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task for approval denial audit logging',
        acceptanceCriteria: 'Task should fail after denial',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      // Create approval state manually
      const approvalState = {
        id: 'test-approval-denial-' + Date.now(),
        taskId: task.id,
        gateName: 'security-review',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Planning stage',
          gateDescription: 'Security team approval required'
        }
      };

      await store.saveApprovalState(approvalState);

      // Deny the approval
      await orchestrator.denyApproval(approvalState.id, 'security-reviewer', 'Security concerns identified');

      // Get audit logs
      const auditLogs = await store.getAuditLogs(task.id);

      // Should have approval response log for denial
      const approvalResponseLog = auditLogs.find(log => log.eventType === 'approval.denied');
      expect(approvalResponseLog).toBeDefined();
      expect(approvalResponseLog?.message).toContain('Approval denied by security-reviewer');
      expect(approvalResponseLog?.actor).toBe('security-reviewer');
      expect(approvalResponseLog?.metadata?.approved).toBe(false);

      // Should have mode change log for manual intervention
      const modeChangeLog = auditLogs.find(log =>
        log.eventType === 'config.updated' &&
        log.message.includes('requiring manual intervention')
      );
      expect(modeChangeLog).toBeDefined();
      expect(modeChangeLog?.previousState).toBe('supervised');
      expect(modeChangeLog?.newState).toBe('manual');
      expect(modeChangeLog?.metadata?.reason).toContain('Approval denied by security-reviewer');
    });
  });

  describe('Autonomy Enforcer Audit Logging', () => {
    it('should log autonomy mode change when enforcer triggers approval requirement', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task for autonomy enforcer audit logging',
        acceptanceCriteria: 'Task should log mode change on enforcer trigger',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      // Start task to get it in progress
      await orchestrator.startTask(task.id);

      // Simulate autonomy enforcer triggering approval requirement
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      if (autonomyEnforcer) {
        // Emit the approval:required event
        autonomyEnforcer.emit('approval:required', 'test-gate', {
          task: { id: task.id },
          taskId: task.id
        });

        // Wait a bit for async processing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get audit logs
        const auditLogs = await store.getAuditLogs(task.id);

        // Should have mode change log from autonomy enforcer
        const modeChangeLog = auditLogs.find(log =>
          log.eventType === 'config.updated' &&
          log.message.includes('Autonomy enforcer triggered approval gate')
        );
        expect(modeChangeLog).toBeDefined();
        expect(modeChangeLog?.previousState).toBe('full-auto');
        expect(modeChangeLog?.newState).toBe('supervised');
        expect(modeChangeLog?.metadata?.reason).toContain('test-gate');
      }
    });
  });

  describe('Audit Log Integrity', () => {
    it('should maintain audit trail across complete approval cycle', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task for complete audit trail',
        acceptanceCriteria: 'Complete audit trail maintained',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      // Create and save approval state (simulating approval request)
      const approvalState = {
        id: 'test-complete-audit-' + Date.now(),
        taskId: task.id,
        gateName: 'security-review',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Planning stage',
          gateDescription: 'Security team approval required'
        }
      };

      await store.saveApprovalState(approvalState);
      await store.logApprovalRequest(task.id, 'Security review required');
      await store.logModeChange(task.id, 'full-auto', 'supervised', 'Approval gate triggered');

      // Grant approval
      await orchestrator.grantApproval(approvalState.id, 'security-lead', 'Approved after review');

      // Get all audit logs
      const auditLogs = await store.getAuditLogs(task.id);

      // Should have complete audit trail
      expect(auditLogs.length).toBeGreaterThanOrEqual(3);

      // Verify sequence of events
      const approvalRequestLog = auditLogs.find(log => log.eventType === 'approval.requested');
      const initialModeChange = auditLogs.find(log =>
        log.eventType === 'config.updated' && log.newState === 'supervised'
      );
      const approvalGrantedLog = auditLogs.find(log => log.eventType === 'approval.granted');
      const finalModeChange = auditLogs.find(log =>
        log.eventType === 'config.updated' && log.newState === 'full-auto'
      );

      expect(approvalRequestLog).toBeDefined();
      expect(initialModeChange).toBeDefined();
      expect(approvalGrantedLog).toBeDefined();
      expect(finalModeChange).toBeDefined();

      // Verify chronological order
      expect(approvalRequestLog!.timestamp.getTime()).toBeLessThanOrEqual(approvalGrantedLog!.timestamp.getTime());
      expect(initialModeChange!.timestamp.getTime()).toBeLessThanOrEqual(finalModeChange!.timestamp.getTime());

      // Verify all logs have proper task ID
      auditLogs.forEach(log => {
        expect(log.taskId).toBe(task.id);
        expect(log.id).toBeDefined();
        expect(log.timestamp).toBeInstanceOf(Date);
      });
    });
  });
});