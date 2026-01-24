/**
 * Edge case tests for limit recovery and approval timeout scenarios
 *
 * These tests verify:
 * - Limit recovery after pause
 * - Approval timeout handling
 * - Concurrent approval requests
 * - Resource limit reset scenarios
 * - Graceful degradation on limit breach
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import { ApprovalGateController } from '../approval-gate-controller';
import { TaskStore } from '../store';
import type {
  Task,
  ApprovalGate as ApprovalGateConfig,
  ApprovalState,
} from '@apexcli/core';

describe('Edge Cases - Limit Recovery and Approval Timeout', () => {
  let testDir: string;
  let store: TaskStore;
  let parentEmitter: EventEmitter;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-edge-cases-test-'));
    store = new TaskStore(testDir);
    await store.initialize();
    parentEmitter = new EventEmitter();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Limit Recovery After Pause', () => {
    it('should track task resource usage and allow recovery', async () => {
      const mockTask: Task = {
        id: 'limit-recovery-task',
        title: 'Test Limit Recovery',
        description: 'Test cost limit recovery',
        type: 'feature',
        status: 'paused',
        agent: 'developer',
        stage: 'implementation',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 4000,
          outputTokens: 4000,
          totalTokens: 8000,
          estimatedCost: 4.5,
        },
        resumeAttempts: 0,
      };

      // Store the task in the database
      await store.createTask(mockTask);

      // Verify task is stored correctly
      const storedTask = await store.getTask('limit-recovery-task');
      expect(storedTask).toBeDefined();
      expect(storedTask!.status).toBe('paused');
      expect(storedTask!.usage?.estimatedCost).toBe(4.5);

      // Simulate recovery by updating the task to running
      await store.updateTask('limit-recovery-task', { status: 'running' });

      // Verify the task status was updated
      const updatedTask = await store.getTask('limit-recovery-task');
      expect(updatedTask!.status).toBe('running');
    });

    it('should handle resource limit edge cases during recovery', async () => {
      // Test with task at 95% of token limit
      const nearLimitTask: Task = {
        id: 'near-limit-task',
        title: 'Near Limit Task',
        description: 'Task near resource limits',
        type: 'feature',
        status: 'paused',
        agent: 'developer',
        stage: 'implementation',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 9500,
          outputTokens: 500,
          totalTokens: 10000, // At limit
          estimatedCost: 9.8, // Near cost limit
        },
        resumeAttempts: 0,
      };

      await store.createTask(nearLimitTask);

      const storedTask = await store.getTask('near-limit-task');
      expect(storedTask!.usage!.totalTokens).toBe(10000);
      expect(storedTask!.usage!.estimatedCost).toBe(9.8);

      // Verify task can be marked as recovered
      await store.updateTask('near-limit-task', {
        status: 'running',
        resumeAttempts: 1
      });

      const recoveredTask = await store.getTask('near-limit-task');
      expect(recoveredTask!.status).toBe('running');
      expect(recoveredTask!.resumeAttempts).toBe(1);
    });
  });

  describe('Approval Timeout Handling', () => {
    it('should handle basic approval timeout with auto-deny', async () => {
      const gateConfig: ApprovalGateConfig = {
        id: 'timeout-test-gate',
        type: 'before-stage',
        name: 'Timeout Test Gate',
        description: 'Test approval timeout behavior',
        required: true,
        timeout: 1, // 1 minute timeout
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: ['timeout-test'],
      };

      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: 'timeout-task-1',
        stage: 'testing',
        agent: 'developer',
        store,
        parentEmitter,
        context: { testType: 'timeout' },
      });

      const events: Array<{ type: string; data: any }> = [];
      controller.on('approval:requested', (data) => events.push({ type: 'approval:requested', data }));
      controller.on('approval:timeout', (data) => events.push({ type: 'approval:timeout', data }));
      controller.on('approval:resolved', (data) => events.push({ type: 'approval:resolved', data }));

      // Start approval process
      vi.useFakeTimers();
      const approvalPromise = controller.requestApproval();

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(61000); // 61 seconds

      const result = await approvalPromise;
      expect(result.status).toBe('denied'); // Auto-deny on timeout

      // Verify event sequence
      expect(events.some(e => e.type === 'approval:timeout')).toBe(true);
      expect(events.some(e => e.type === 'approval:resolved')).toBe(true);
    });

    it('should handle approval timeout with auto-approve', async () => {
      const gateConfig: ApprovalGateConfig = {
        id: 'auto-approve-timeout-gate',
        type: 'before-stage',
        name: 'Auto Approve Timeout Gate',
        description: 'Test auto-approve on timeout',
        required: true,
        timeout: 1, // 1 minute timeout
        autoApproveOnTimeout: true, // Auto-approve on timeout
        minApprovals: 1,
        tags: ['auto-approve-timeout'],
      };

      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: 'auto-approve-task',
        stage: 'testing',
        agent: 'developer',
        store,
        parentEmitter,
        context: { testType: 'auto-approve-timeout' },
      });

      const events: Array<{ type: string; data: any }> = [];
      controller.on('approval:resolved', (data) => events.push({ type: 'approval:resolved', data }));
      controller.on('approval:timeout', (data) => events.push({ type: 'approval:timeout', data }));

      // Start approval process
      vi.useFakeTimers();
      const approvalPromise = controller.requestApproval();

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(61000);

      const result = await approvalPromise;
      expect(result.status).toBe('approved');

      // Verify auto-approval was triggered
      expect(events.some(e => e.type === 'approval:resolved')).toBe(true);
      expect(events.some(e => e.type === 'approval:timeout')).toBe(true);
    });

    it('should preserve partial approvals on timeout', async () => {
      const gateConfig: ApprovalGateConfig = {
        id: 'partial-timeout-gate',
        type: 'before-stage',
        name: 'Partial Timeout Gate',
        description: 'Test partial approvals with timeout',
        required: true,
        timeout: 1,
        autoApproveOnTimeout: false,
        minApprovals: 3, // Require 3 approvals
        tags: ['partial-timeout'],
      };

      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: 'partial-approval-task',
        stage: 'testing',
        agent: 'developer',
        store,
        parentEmitter,
        context: { testType: 'partial-timeout' },
      });

      let timeoutState: ApprovalState | null = null;
      controller.on('approval:timeout', (state) => {
        timeoutState = state;
      });

      // Start approval process
      vi.useFakeTimers();
      const approvalPromise = controller.requestApproval();

      // Provide partial approvals
      await controller.grant('user1', 'First approval');
      await controller.grant('user2', 'Second approval');

      // Fast-forward to timeout before third approval
      vi.advanceTimersByTime(61000);

      const result = await approvalPromise;
      expect(result.status).toBe('denied'); // Auto-deny on timeout

      // Verify partial approvals were preserved
      expect(timeoutState).not.toBeNull();
      expect(timeoutState!.approvalsReceived).toBe(2);
      expect(timeoutState!.approvalsRequired).toBe(3);
    });
  });

  describe('Concurrent Approval Requests', () => {
    it('should handle multiple simultaneous approval requests', async () => {
      const gateConfig1: ApprovalGateConfig = {
        id: 'concurrent-gate-1',
        type: 'before-stage',
        name: 'Concurrent Gate 1',
        description: 'First concurrent gate',
        required: true,
        timeout: 5,
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: ['concurrent'],
      };

      const gateConfig2: ApprovalGateConfig = {
        id: 'concurrent-gate-2',
        type: 'before-stage',
        name: 'Concurrent Gate 2',
        description: 'Second concurrent gate',
        required: true,
        timeout: 5,
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: ['concurrent'],
      };

      const controller1 = new ApprovalGateController({
        config: gateConfig1,
        taskId: 'concurrent-task-1',
        stage: 'testing',
        agent: 'developer',
        store,
        parentEmitter,
      });

      const controller2 = new ApprovalGateController({
        config: gateConfig2,
        taskId: 'concurrent-task-2',
        stage: 'testing',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Start both approval processes simultaneously
      const approval1Promise = controller1.requestApproval();
      const approval2Promise = controller2.requestApproval();

      // Approve both in parallel
      const approvePromise1 = controller1.grant('user1', 'Approve first');
      const approvePromise2 = controller2.grant('user2', 'Approve second');

      // Wait for all approvals to complete
      const [result1, result2] = await Promise.all([approval1Promise, approval2Promise]);
      await Promise.all([approvePromise1, approvePromise2]);

      expect(result1.status).toBe('approved');
      expect(result2.status).toBe('approved');
      expect(result1.approver).toBe('user1');
      expect(result2.approver).toBe('user2');
    });

    it('should prevent approval state corruption with concurrent operations', async () => {
      const gateConfig: ApprovalGateConfig = {
        id: 'corruption-test-gate',
        type: 'before-stage',
        name: 'Corruption Test Gate',
        description: 'Test concurrent operation safety',
        required: true,
        timeout: 5,
        autoApproveOnTimeout: false,
        minApprovals: 2,
        tags: ['corruption-test'],
      };

      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: 'corruption-test-task',
        stage: 'testing',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Start approval process
      const approvalPromise = controller.requestApproval();

      // Try multiple concurrent operations that could corrupt state
      const operations = [
        controller.grant('user1', 'First approval'),
        controller.grant('user2', 'Second approval'),
        controller.deny('user3', 'Denial attempt'),
        controller.grant('user4', 'Third approval'),
      ];

      await Promise.allSettled(operations);

      const result = await approvalPromise;

      // Verify state integrity - should have exactly 2 approvals
      expect(result.status).toBe('approved');
      expect(controller.approvalState.approvalsReceived).toBe(2);
    });
  });

  describe('Resource Limit Reset Scenarios', () => {
    it('should handle task resource usage resets', async () => {
      // Create a task with high resource usage
      const highUsageTask: Task = {
        id: 'high-usage-task',
        title: 'High Usage Task',
        description: 'Task with high resource usage',
        type: 'feature',
        status: 'paused',
        agent: 'developer',
        stage: 'implementation',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 8000,
          outputTokens: 2000,
          totalTokens: 10000,
          estimatedCost: 15.0, // Over limit
        },
        resumeAttempts: 0,
      };

      await store.createTask(highUsageTask);

      // Simulate resetting usage statistics
      await store.updateTask('high-usage-task', {
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
      });

      // Verify reset
      const resetTask = await store.getTask('high-usage-task');
      expect(resetTask!.usage!.totalTokens).toBe(0);
      expect(resetTask!.usage!.estimatedCost).toBe(0);
    });

    it('should track partial resource limit resets', async () => {
      const task: Task = {
        id: 'partial-reset-task',
        title: 'Partial Reset Task',
        description: 'Test partial resource reset',
        type: 'feature',
        status: 'running',
        agent: 'developer',
        stage: 'implementation',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 5000,
          outputTokens: 3000,
          totalTokens: 8000,
          estimatedCost: 10.0,
        },
        resumeAttempts: 0,
      };

      await store.createTask(task);

      // Reset only cost, keep tokens
      await store.updateTask('partial-reset-task', {
        usage: {
          inputTokens: 5000, // Keep
          outputTokens: 3000, // Keep
          totalTokens: 8000, // Keep
          estimatedCost: 0, // Reset
        },
      });

      const partiallyResetTask = await store.getTask('partial-reset-task');
      expect(partiallyResetTask!.usage!.totalTokens).toBe(8000); // Unchanged
      expect(partiallyResetTask!.usage!.estimatedCost).toBe(0); // Reset
    });
  });

  describe('Graceful Degradation on Limit Breach', () => {
    it('should track task status during limit breaches', async () => {
      const limitBreachTask: Task = {
        id: 'limit-breach-task',
        title: 'Limit Breach Task',
        description: 'Task exceeding limits',
        type: 'feature',
        status: 'running',
        agent: 'developer',
        stage: 'implementation',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 12000, // Over limit
          outputTokens: 3000,
          totalTokens: 15000,
          estimatedCost: 25.0, // Over limit
        },
        resumeAttempts: 0,
      };

      await store.createTask(limitBreachTask);

      // Simulate pausing due to limit breach
      await store.updateTask('limit-breach-task', {
        status: 'paused',
        pauseReason: 'resource_limit',
        pausedAt: new Date(),
      });

      // Verify pause state
      const pausedTask = await store.getTask('limit-breach-task');
      expect(pausedTask!.status).toBe('paused');
      expect(pausedTask!.pauseReason).toBe('resource_limit');
      expect(pausedTask!.pausedAt).toBeDefined();
    });

    it('should handle progressive degradation tracking', async () => {
      const degradationTask: Task = {
        id: 'degradation-task',
        title: 'Degradation Task',
        description: 'Task with progressive degradation',
        type: 'feature',
        status: 'running',
        agent: 'developer',
        stage: 'implementation',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 8500,
          outputTokens: 1500,
          totalTokens: 10000,
          estimatedCost: 12.0,
        },
        resumeAttempts: 0,
      };

      await store.createTask(degradationTask);

      // Track degradation steps in metadata
      await store.updateTask('degradation-task', {
        metadata: {
          degradationLevel: 1,
          degradationSteps: ['reduce-model-quality'],
          originalModel: 'opus',
          currentModel: 'sonnet',
        },
      });

      const degradedTask = await store.getTask('degradation-task');
      expect(degradedTask!.metadata?.degradationLevel).toBe(1);
      expect(degradedTask!.metadata?.currentModel).toBe('sonnet');
    });

    it('should handle service quality maintenance during degradation', async () => {
      const qualityTask: Task = {
        id: 'quality-task',
        title: 'Quality Maintenance Task',
        description: 'Task maintaining service quality',
        type: 'feature',
        status: 'running',
        agent: 'developer',
        stage: 'implementation',
        priority: 'critical', // High priority for better treatment
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 9000,
          outputTokens: 1000,
          totalTokens: 10000,
          estimatedCost: 15.0,
        },
        resumeAttempts: 0,
      };

      await store.createTask(qualityTask);

      // Update with quality preservation settings
      await store.updateTask('quality-task', {
        metadata: {
          qualityLevel: 'high',
          priorityConsidered: true,
          degradationLevel: 'minimal',
          preserveQuality: true,
        },
      });

      const updatedTask = await store.getTask('quality-task');
      expect(updatedTask!.metadata?.qualityLevel).toBe('high');
      expect(updatedTask!.metadata?.preserveQuality).toBe(true);
      expect(updatedTask!.priority).toBe('critical');
    });
  });
});