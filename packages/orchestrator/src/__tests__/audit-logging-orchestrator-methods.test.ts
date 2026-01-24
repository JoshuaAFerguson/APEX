import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import { Config } from '@apex/core';
import path from 'node:path';
import fs from 'fs/promises';
import os from 'node:os';

/**
 * Unit tests focused on ApexOrchestrator audit logging method calls
 *
 * Validates that the orchestrator correctly calls audit logging methods
 * at the appropriate points during autonomy transitions and approval workflows.
 */
describe('ApexOrchestrator Audit Logging Method Calls', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let tempDir: string;
  let config: Config;

  // Spies for monitoring audit logging calls
  let logApprovalRequestSpy: any;
  let logModeChangeSpy: any;
  let logApprovalResponseSpy: any;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-audit-methods-test-'));

    // Create .apex directory
    const apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Test configuration
    config = {
      projectName: 'audit-methods-test',
      projectDescription: 'Test orchestrator audit logging method calls',
      autonomy: {
        level: 'full-auto',
        gates: [
          {
            id: 'test-gate',
            name: 'Test Gate',
            description: 'Test approval gate',
            trigger: {
              conditions: ['always']
            },
            timeout: 60,
            approvers: ['test-team'],
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

    // Set up spies to monitor audit logging calls
    logApprovalRequestSpy = vi.spyOn(store, 'logApprovalRequest').mockImplementation(async () => {});
    logModeChangeSpy = vi.spyOn(store, 'logModeChange').mockImplementation(async () => {});
    logApprovalResponseSpy = vi.spyOn(store, 'logApprovalResponse').mockImplementation(async () => {});
  });

  afterEach(async () => {
    // Restore all spies
    vi.restoreAllMocks();

    await orchestrator?.destroy();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('grantApproval method audit logging', () => {
    it('should call logApprovalResponse with correct parameters when approval is granted', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test task for approval grant audit',
        acceptanceCriteria: 'Approval grant logged correctly',
        workflow: 'feature',
        autonomy: 'supervised'  // Start in supervised mode to avoid triggering gates
      });

      // Create approval state
      const approvalState = {
        id: 'test-approval-grant-' + Date.now(),
        taskId: task.id,
        gateName: 'test-gate',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Test stage',
          gateDescription: 'Test gate description'
        }
      };

      await store.saveApprovalState(approvalState);

      // Grant approval
      const approver = 'test-approver';
      const comment = 'Approval granted for testing';

      await orchestrator.grantApproval(approvalState.id, approver, comment);

      // Verify logApprovalResponse was called correctly
      expect(logApprovalResponseSpy).toHaveBeenCalledWith(
        task.id,
        approver,
        true,
        comment
      );

      // Verify logModeChange was called for autonomy restoration
      expect(logModeChangeSpy).toHaveBeenCalledWith(
        task.id,
        'supervised',
        task.autonomy, // Should restore to original autonomy
        expect.stringContaining(`Approval granted by ${approver} - resuming with original autonomy level`)
      );
    });

    it('should call audit logging methods with all required parameters', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test task for audit parameter validation',
        acceptanceCriteria: 'All audit parameters captured',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      // Create approval state
      const approvalState = {
        id: 'test-audit-params-' + Date.now(),
        taskId: task.id,
        gateName: 'test-gate',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Parameter validation test',
          gateDescription: 'Test gate for parameter validation'
        }
      };

      await store.saveApprovalState(approvalState);

      // Grant approval with specific parameters
      const approver = 'parameter-tester';
      const comment = 'Testing parameter capture in audit logs';

      await orchestrator.grantApproval(approvalState.id, approver, comment);

      // Verify all required parameters were passed
      const approvalResponseCall = logApprovalResponseSpy.mock.calls[0];
      expect(approvalResponseCall[0], 'Task ID should be provided').toBe(task.id);
      expect(approvalResponseCall[1], 'Approver should be provided').toBe(approver);
      expect(approvalResponseCall[2], 'Approval status should be true').toBe(true);
      expect(approvalResponseCall[3], 'Comment should be provided').toBe(comment);

      const modeChangeCall = logModeChangeSpy.mock.calls[0];
      expect(modeChangeCall[0], 'Task ID should be provided for mode change').toBe(task.id);
      expect(modeChangeCall[1], 'Previous mode should be captured').toBe('supervised');
      expect(modeChangeCall[2], 'New mode should be captured').toBe(task.autonomy);
      expect(modeChangeCall[3], 'Reason should include approver').toContain(approver);
    });
  });

  describe('denyApproval method audit logging', () => {
    it('should call logApprovalResponse with correct parameters when approval is denied', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test task for approval denial audit',
        acceptanceCriteria: 'Approval denial logged correctly',
        workflow: 'feature',
        autonomy: 'supervised'
      });

      // Create approval state
      const approvalState = {
        id: 'test-approval-denial-' + Date.now(),
        taskId: task.id,
        gateName: 'test-gate',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Test stage',
          gateDescription: 'Test gate description'
        }
      };

      await store.saveApprovalState(approvalState);

      // Deny approval
      const approver = 'test-denier';
      const reason = 'Security concerns identified during review';

      await orchestrator.denyApproval(approvalState.id, approver, reason);

      // Verify logApprovalResponse was called correctly for denial
      expect(logApprovalResponseSpy).toHaveBeenCalledWith(
        task.id,
        approver,
        false, // denied
        reason
      );

      // Verify logModeChange was called for manual intervention
      expect(logModeChangeSpy).toHaveBeenCalledWith(
        task.id,
        'supervised',
        'manual',
        expect.stringContaining(`Approval denied by ${approver} - requiring manual intervention: ${reason}`)
      );
    });

    it('should handle empty denial reason gracefully', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test task for empty denial reason',
        acceptanceCriteria: 'Empty denial reason handled',
        workflow: 'feature',
        autonomy: 'supervised'
      });

      // Create approval state
      const approvalState = {
        id: 'test-empty-reason-' + Date.now(),
        taskId: task.id,
        gateName: 'test-gate',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Empty reason test',
          gateDescription: 'Test empty reason handling'
        }
      };

      await store.saveApprovalState(approvalState);

      // Deny approval with empty reason
      const approver = 'empty-reason-tester';
      const emptyReason = '';

      await orchestrator.denyApproval(approvalState.id, approver, emptyReason);

      // Verify audit logging was still called
      expect(logApprovalResponseSpy).toHaveBeenCalledWith(
        task.id,
        approver,
        false,
        emptyReason
      );

      expect(logModeChangeSpy).toHaveBeenCalledWith(
        task.id,
        'supervised',
        'manual',
        expect.stringContaining(`Approval denied by ${approver}`)
      );
    });
  });

  describe('Autonomy enforcer audit logging', () => {
    it('should call logModeChange when autonomy enforcer triggers supervision', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test autonomy enforcer audit logging',
        acceptanceCriteria: 'Autonomy enforcer triggers logged',
        workflow: 'feature',
        autonomy: 'full-auto'
      });

      // Start the task to enable autonomy enforcer
      await orchestrator.startTask(task.id);

      // Clear any existing calls
      logModeChangeSpy.mockClear();

      // Get the autonomy enforcer and emit approval:required event
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      if (autonomyEnforcer) {
        const gateName = 'runtime-gate';
        const eventData = {
          task: { id: task.id },
          taskId: task.id
        };

        // Emit the event that should trigger audit logging
        autonomyEnforcer.emit('approval:required', gateName, eventData);

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify logModeChange was called
        expect(logModeChangeSpy).toHaveBeenCalledWith(
          task.id,
          task.autonomy,
          'supervised',
          expect.stringContaining(`Autonomy enforcer triggered approval gate: ${gateName}`)
        );
      }
    });
  });

  describe('Audit logging error handling', () => {
    it('should not fail if audit logging throws an error', async () => {
      // Make audit logging throw an error
      logApprovalResponseSpy.mockRejectedValue(new Error('Audit logging failed'));

      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test audit logging error handling',
        acceptanceCriteria: 'Audit errors handled gracefully',
        workflow: 'feature',
        autonomy: 'supervised'
      });

      // Create approval state
      const approvalState = {
        id: 'test-error-handling-' + Date.now(),
        taskId: task.id,
        gateName: 'test-gate',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Error handling test',
          gateDescription: 'Test error handling'
        }
      };

      await store.saveApprovalState(approvalState);

      // Grant approval should not throw even if audit logging fails
      await expect(
        orchestrator.grantApproval(approvalState.id, 'error-tester', 'Test comment')
      ).resolves.not.toThrow();

      // Verify audit logging was attempted
      expect(logApprovalResponseSpy).toHaveBeenCalled();
    });
  });

  describe('Audit logging call timing and sequence', () => {
    it('should call audit logging methods in the correct sequence during approval grant', async () => {
      const callSequence: string[] = [];

      // Wrap the spies to track call order
      logApprovalResponseSpy.mockImplementation(async (...args) => {
        callSequence.push('logApprovalResponse');
      });

      logModeChangeSpy.mockImplementation(async (...args) => {
        callSequence.push('logModeChange');
      });

      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test audit logging call sequence',
        acceptanceCriteria: 'Audit calls in correct order',
        workflow: 'feature',
        autonomy: 'supervised'
      });

      // Create approval state
      const approvalState = {
        id: 'test-sequence-' + Date.now(),
        taskId: task.id,
        gateName: 'test-gate',
        status: 'pending' as const,
        requiredApprovals: 1,
        approvalsReceived: 0,
        requestedAt: new Date(),
        timeoutMinutes: 60,
        context: {
          workflowName: 'feature',
          stageDescription: 'Sequence test',
          gateDescription: 'Test call sequence'
        }
      };

      await store.saveApprovalState(approvalState);

      // Grant approval
      await orchestrator.grantApproval(approvalState.id, 'sequence-tester', 'Test sequence');

      // Verify the sequence: approval response should be logged before mode change
      expect(callSequence.length).toBeGreaterThanOrEqual(2);
      expect(callSequence.indexOf('logApprovalResponse')).toBeLessThan(
        callSequence.indexOf('logModeChange')
      );
    });
  });
});