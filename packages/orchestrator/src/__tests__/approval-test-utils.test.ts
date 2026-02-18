import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockApprovalState,
  createMockApprovalGate,
  createApprovalScenario,
  ApprovalFlowTestEnvironment,
  createApprovalFlowTestEnvironment,
  createWorkflowWithApprovals,
  ApprovalTestAssertions,
  type ApprovalStateConfig,
  type ApprovalGateConfig,
} from '../approval-test-utils.js';
import { createMockTask } from '../test-utils.js';
import type { ApprovalStatus } from '@apexcli/core';

describe('Approval Test Utilities', () => {
  describe('createMockApprovalState', () => {
    it('should create approval state with defaults', () => {
      const approval = createMockApprovalState({ taskId: 'task-123' });

      expect(approval).toMatchObject({
        taskId: 'task-123',
        gateName: 'test-gate',
        status: 'pending',
        approvalsRequired: 1,
      });
      expect(approval.id).toMatch(/^approval_/);
      expect(approval.requestedAt).toBeInstanceOf(Date);
    });

    it('should create approval state with custom config', () => {
      const customConfig: ApprovalStateConfig = {
        taskId: 'task-456',
        id: 'custom-approval-id',
        gateName: 'deployment-gate',
        status: 'approved',
        approver: 'john.doe@example.com',
        comment: 'Looks good to deploy',
        stage: 'deployment',
        agent: 'devops',
        approvalsRequired: 2,
        approvalsReceived: 2,
        timeoutMinutes: 30,
      };

      const approval = createMockApprovalState(customConfig);

      expect(approval).toMatchObject({
        id: 'custom-approval-id',
        taskId: 'task-456',
        gateName: 'deployment-gate',
        status: 'approved',
        approver: 'john.doe@example.com',
        comment: 'Looks good to deploy',
        stage: 'deployment',
        agent: 'devops',
        approvalsRequired: 2,
        approvalsReceived: 2,
        timeoutMinutes: 30,
      });
    });

    it('should handle optional fields correctly', () => {
      const approval = createMockApprovalState({
        taskId: 'task-789',
        status: 'denied',
      });

      expect(approval.status).toBe('denied');
      expect(approval.approver).toBeUndefined();
      expect(approval.respondedAt).toBeUndefined();
      expect(approval.comment).toBeUndefined();
    });
  });

  describe('createMockApprovalGate', () => {
    it('should create approval gate with defaults', () => {
      const gate = createMockApprovalGate();

      expect(gate).toMatchObject({
        type: 'custom',
        name: 'test-gate',
        description: 'Test approval gate',
        required: true,
        autoApprove: false,
        autoApproveOnTimeout: false,
        minApprovals: 1,
        approvers: ['test@example.com'],
      });
      expect(gate.id).toMatch(/^gate_/);
    });

    it('should create approval gate with custom config', () => {
      const customConfig: ApprovalGateConfig = {
        id: 'custom-gate-id',
        type: 'before-deploy',
        name: 'deployment-approval',
        description: 'Deployment requires approval',
        required: true,
        timeout: 60,
        approvers: ['admin@example.com', 'devops@example.com'],
        minApprovals: 2,
        autoApproveOnTimeout: true,
      };

      const gate = createMockApprovalGate(customConfig);

      expect(gate).toMatchObject({
        id: 'custom-gate-id',
        type: 'before-deploy',
        name: 'deployment-approval',
        description: 'Deployment requires approval',
        required: true,
        timeout: 60,
        approvers: ['admin@example.com', 'devops@example.com'],
        minApprovals: 2,
        autoApproveOnTimeout: true,
      });
    });
  });

  describe('createApprovalScenario', () => {
    const taskId = 'scenario-task-123';

    it('should create pending-approval scenario', () => {
      const approvals = createApprovalScenario(taskId, 'pending-approval');

      expect(approvals).toHaveLength(1);
      expect(approvals[0]).toMatchObject({
        taskId,
        gateName: 'code-review',
        status: 'pending',
        stage: 'review',
        agent: 'reviewer',
      });
    });

    it('should create auto-approval scenario', () => {
      const approvals = createApprovalScenario(taskId, 'auto-approval');

      expect(approvals).toHaveLength(1);
      expect(approvals[0]).toMatchObject({
        taskId,
        status: 'approved',
        approver: 'system',
        comment: 'Auto-approved by system',
      });
      expect(approvals[0].respondedAt).toBeDefined();
    });

    it('should create manual-approval scenario', () => {
      const approvals = createApprovalScenario(taskId, 'manual-approval');

      expect(approvals).toHaveLength(1);
      expect(approvals[0]).toMatchObject({
        taskId,
        status: 'approved',
        approver: 'john.doe@example.com',
        comment: 'Approved after code review',
        stage: 'deployment',
        agent: 'devops',
      });
    });

    it('should create rejection scenario', () => {
      const approvals = createApprovalScenario(taskId, 'rejection');

      expect(approvals).toHaveLength(1);
      expect(approvals[0]).toMatchObject({
        taskId,
        status: 'denied',
        approver: 'security@example.com',
        comment: 'Security concerns identified - needs further review',
      });
    });

    it('should create timeout scenario', () => {
      const approvals = createApprovalScenario(taskId, 'timeout');

      expect(approvals).toHaveLength(1);
      expect(approvals[0]).toMatchObject({
        taskId,
        status: 'pending',
        timeoutMinutes: 0.5,
      });
      expect(approvals[0].expiresAt).toBeDefined();
    });

    it('should create multi-step-approval scenario', () => {
      const approvals = createApprovalScenario(taskId, 'multi-step-approval');

      expect(approvals).toHaveLength(3);
      expect(approvals[0]).toMatchObject({
        taskId,
        gateName: 'code-review',
        status: 'approved',
        approver: 'dev@example.com',
      });
      expect(approvals[1]).toMatchObject({
        taskId,
        gateName: 'security-review',
        status: 'pending',
      });
      expect(approvals[2]).toMatchObject({
        taskId,
        gateName: 'deployment-approval',
        status: 'pending',
      });
    });

    it('should create approval-chain scenario', () => {
      const approvals = createApprovalScenario(taskId, 'approval-chain');

      expect(approvals).toHaveLength(3);

      // First approval: completed
      expect(approvals[0]).toMatchObject({
        taskId,
        gateName: 'pr-review',
        status: 'approved',
        approver: 'reviewer1@example.com',
      });

      // Second approval: completed
      expect(approvals[1]).toMatchObject({
        taskId,
        gateName: 'qa-approval',
        status: 'approved',
        approver: 'qa@example.com',
      });

      // Third approval: pending with multi-approval requirement
      expect(approvals[2]).toMatchObject({
        taskId,
        gateName: 'final-approval',
        status: 'pending',
        approvalsRequired: 2,
        approvalsReceived: 0,
      });
    });

    it('should throw error for unknown scenario', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid scenario
        createApprovalScenario(taskId, 'invalid-scenario');
      }).toThrow('Unknown approval scenario: invalid-scenario');
    });
  });

  describe('ApprovalFlowTestEnvironment', () => {
    let approvalFlow: ApprovalFlowTestEnvironment;

    beforeEach(async () => {
      approvalFlow = await createApprovalFlowTestEnvironment();
    });

    afterEach(async () => {
      await approvalFlow.cleanup();
    });

    it('should initialize correctly', () => {
      expect(approvalFlow.getStore()).toBeDefined();
      expect(approvalFlow.getEventEmitter()).toBeDefined();
    });

    it('should create task with approval gates', async () => {
      const { task, gates } = await approvalFlow.createTaskWithApprovals({
        task: { description: 'Test task with approvals' },
        gates: [
          { type: 'before-deploy', name: 'deployment-gate' },
          { type: 'before-commit', name: 'code-review-gate' },
        ],
      });

      expect(task.description).toBe('Test task with approvals');
      expect(gates).toHaveLength(2);
      expect(gates[0].type).toBe('before-deploy');
      expect(gates[1].type).toBe('before-commit');

      // Verify task is stored
      const storedTask = await approvalFlow.getStore().getTask(task.id);
      expect(storedTask).toBeDefined();
    });

    it('should request approval and emit event', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      // Listen for approval required event
      const eventPromise = approvalFlow.waitForApprovalEvent('approval-required', 1000);

      const approval = await approvalFlow.requestApproval(task.id, 'test-gate', {
        comment: 'Please review this',
        stage: 'review',
      });

      expect(approval).toMatchObject({
        taskId: task.id,
        gateName: 'test-gate',
        status: 'pending',
        comment: 'Please review this',
        stage: 'review',
      });

      // Verify event was emitted
      const eventData = await eventPromise;
      expect(eventData).toMatchObject({
        approvalId: approval.id,
        taskId: task.id,
        gateName: 'test-gate',
      });

      // Verify approval is stored
      const storedApproval = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(storedApproval).toBeDefined();
    });

    it('should grant approval and emit event', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'test-gate');

      // Listen for approval granted event
      const eventPromise = approvalFlow.waitForApprovalEvent('approval-granted', 1000);

      const updatedApproval = await approvalFlow.grantApproval(
        approval.id,
        'admin@example.com',
        'Approved for deployment'
      );

      expect(updatedApproval.status).toBe('approved');
      expect(updatedApproval.approver).toBe('admin@example.com');
      expect(updatedApproval.respondedAt).toBeDefined();

      // Verify event was emitted
      const eventData = await eventPromise;
      expect(eventData).toMatchObject({
        approvalId: approval.id,
        taskId: task.id,
        approver: 'admin@example.com',
      });
    });

    it('should deny approval and emit event', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'test-gate');

      // Listen for approval denied event
      const eventPromise = approvalFlow.waitForApprovalEvent('approval-denied', 1000);

      const updatedApproval = await approvalFlow.denyApproval(
        approval.id,
        'security@example.com',
        'Security concerns identified'
      );

      expect(updatedApproval.status).toBe('denied');
      expect(updatedApproval.approver).toBe('security@example.com');

      // Verify event was emitted
      const eventData = await eventPromise;
      expect(eventData).toMatchObject({
        approvalId: approval.id,
        taskId: task.id,
        approver: 'security@example.com',
        reason: 'Security concerns identified',
      });
    });

    it('should simulate complete approval workflow', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      const approvals = await approvalFlow.simulateApprovalWorkflow(
        task.id,
        'multi-step-approval'
      );

      expect(approvals).toHaveLength(3);

      // Verify approvals are stored
      const storedApprovals = await approvalFlow.getStore().getApprovalStatesByTask(task.id);
      expect(storedApprovals).toHaveLength(3);
    });

    it('should check approval completion status', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      // Initially no approvals
      let allComplete = await approvalFlow.areAllApprovalsComplete(task.id);
      expect(allComplete).toBe(true); // No approvals means "complete"

      // Add pending approval
      await approvalFlow.requestApproval(task.id, 'test-gate');
      allComplete = await approvalFlow.areAllApprovalsComplete(task.id);
      expect(allComplete).toBe(false);

      // Add approved approval
      const approval = await approvalFlow.requestApproval(task.id, 'another-gate');
      await approvalFlow.grantApproval(approval.id, 'admin@example.com');

      allComplete = await approvalFlow.areAllApprovalsComplete(task.id);
      expect(allComplete).toBe(false); // Still has one pending

      // Approve the first one
      const pendingApprovals = await approvalFlow.getPendingApprovals(task.id);
      await approvalFlow.grantApproval(pendingApprovals[0].id, 'admin@example.com');

      allComplete = await approvalFlow.areAllApprovalsComplete(task.id);
      expect(allComplete).toBe(true);
    });

    it('should check for denied approvals', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      let anyDenied = await approvalFlow.hasAnyApprovalBeenDenied(task.id);
      expect(anyDenied).toBe(false);

      const approval = await approvalFlow.requestApproval(task.id, 'test-gate');
      await approvalFlow.denyApproval(approval.id, 'admin@example.com', 'Not ready');

      anyDenied = await approvalFlow.hasAnyApprovalBeenDenied(task.id);
      expect(anyDenied).toBe(true);
    });

    it('should get pending approvals', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      await approvalFlow.requestApproval(task.id, 'gate1');
      const approval2 = await approvalFlow.requestApproval(task.id, 'gate2');
      await approvalFlow.requestApproval(task.id, 'gate3');

      // Approve one
      await approvalFlow.grantApproval(approval2.id, 'admin@example.com');

      const pendingApprovals = await approvalFlow.getPendingApprovals(task.id);
      expect(pendingApprovals).toHaveLength(2);
      expect(pendingApprovals.every(a => a.status === 'pending')).toBe(true);
    });

    it('should handle approval timeout simulation', (done) => {
      const { task } = approvalFlow.createTaskWithApprovals().then(async ({ task }) => {
        // Listen for timeout event
        approvalFlow.getEventEmitter().on('approval-timeout', (data) => {
          expect(data.taskId).toBe(task.id);
          expect(data.gateName).toBe('timeout-gate');
          done();
        });

        // Request approval with very short timeout
        await approvalFlow.requestApproval(task.id, 'timeout-gate', {
          timeoutMinutes: 0.001, // 60ms
        });
      });
    }, 1000);

    it('should wait for approval events', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      // Start approval request in background
      setTimeout(async () => {
        await approvalFlow.requestApproval(task.id, 'async-gate');
      }, 100);

      // Wait for the event
      const eventData = await approvalFlow.waitForApprovalEvent('approval-required', 1000);
      expect(eventData.taskId).toBe(task.id);
      expect(eventData.gateName).toBe('async-gate');
    });

    it('should timeout waiting for events', async () => {
      await expect(
        approvalFlow.waitForApprovalEvent('approval-required', 100)
      ).rejects.toThrow('Timeout waiting for approval-required event');
    });
  });

  describe('createWorkflowWithApprovals', () => {
    it('should create workflow with default settings', () => {
      const workflow = createWorkflowWithApprovals({});

      expect(workflow.name).toBe('test-workflow-with-approvals');
      expect(workflow.description).toBe('Test workflow with approval gates');
      expect(workflow.stages).toHaveLength(1);
      expect(workflow.stages[0].name).toBe('implementation');
    });

    it('should create workflow with custom gates', () => {
      const workflow = createWorkflowWithApprovals({
        name: 'custom-workflow',
        gates: [
          { type: 'before-deploy', name: 'deployment-gate' },
          { type: 'before-commit', name: 'code-review-gate' },
        ],
      });

      expect(workflow.name).toBe('custom-workflow');
      expect(workflow.stages[0].gates).toHaveLength(2);
      expect(workflow.stages[0].gates![0].type).toBe('before-deploy');
      expect(workflow.stages[0].gates![1].type).toBe('before-commit');
    });

    it('should create workflow with custom stages', () => {
      const workflow = createWorkflowWithApprovals({
        stages: [
          { name: 'planning', agent: 'planner' },
          { name: 'development', agent: 'developer' },
        ],
      });

      expect(workflow.stages).toHaveLength(2);
      expect(workflow.stages[0].name).toBe('planning');
      expect(workflow.stages[1].name).toBe('development');
    });
  });

  describe('ApprovalTestAssertions', () => {
    let approvalFlow: ApprovalFlowTestEnvironment;

    beforeEach(async () => {
      approvalFlow = await createApprovalFlowTestEnvironment();
    });

    afterEach(async () => {
      await approvalFlow.cleanup();
    });

    it('should assert approval status correctly', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'test-gate');

      await expect(
        ApprovalTestAssertions.assertApprovalStatus(
          approvalFlow.getStore(),
          approval.id,
          'pending'
        )
      ).resolves.not.toThrow();

      await expect(
        ApprovalTestAssertions.assertApprovalStatus(
          approvalFlow.getStore(),
          approval.id,
          'approved'
        )
      ).rejects.toThrow('Expected approval status approved, got pending');
    });

    it('should assert pending approvals count', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      await approvalFlow.requestApproval(task.id, 'gate1');
      await approvalFlow.requestApproval(task.id, 'gate2');

      await expect(
        ApprovalTestAssertions.assertPendingApprovalsCount(
          approvalFlow.getStore(),
          task.id,
          2
        )
      ).resolves.not.toThrow();

      await expect(
        ApprovalTestAssertions.assertPendingApprovalsCount(
          approvalFlow.getStore(),
          task.id,
          1
        )
      ).rejects.toThrow('Expected 1 pending approvals, got 2');
    });

    it('should assert all approvals approved', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval1 = await approvalFlow.requestApproval(task.id, 'gate1');
      const approval2 = await approvalFlow.requestApproval(task.id, 'gate2');

      await expect(
        ApprovalTestAssertions.assertAllApprovalsApproved(
          approvalFlow.getStore(),
          task.id
        )
      ).rejects.toThrow('Not all approvals approved');

      await approvalFlow.grantApproval(approval1.id, 'admin1@example.com');
      await approvalFlow.grantApproval(approval2.id, 'admin2@example.com');

      await expect(
        ApprovalTestAssertions.assertAllApprovalsApproved(
          approvalFlow.getStore(),
          task.id
        )
      ).resolves.not.toThrow();
    });

    it('should assert approval approver', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'test-gate');
      await approvalFlow.grantApproval(approval.id, 'specific@example.com');

      await expect(
        ApprovalTestAssertions.assertApprovalApprover(
          approvalFlow.getStore(),
          approval.id,
          'specific@example.com'
        )
      ).resolves.not.toThrow();

      await expect(
        ApprovalTestAssertions.assertApprovalApprover(
          approvalFlow.getStore(),
          approval.id,
          'wrong@example.com'
        )
      ).rejects.toThrow('Expected approver wrong@example.com, got specific@example.com');
    });

    it('should handle non-existent approvals', async () => {
      await expect(
        ApprovalTestAssertions.assertApprovalStatus(
          approvalFlow.getStore(),
          'non-existent-id',
          'pending'
        )
      ).rejects.toThrow('Approval non-existent-id not found');
    });
  });
});