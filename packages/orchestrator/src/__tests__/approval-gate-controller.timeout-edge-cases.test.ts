/**
 * Timeout edge case tests for ApprovalGateController
 *
 * Tests comprehensive timeout scenarios, event ordering, state cleanup,
 * database persistence, and error handling during approval timeouts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import {
  ApprovalGateController,
  type ApprovalGateOptions,
} from '../approval-gate-controller';
import { TaskStore } from '../store';
import type { ApprovalGate as ApprovalGateConfig, ApprovalState } from '@apexcli/core';

describe('ApprovalGateController - Timeout Edge Cases', () => {
  let testDir: string;
  let store: TaskStore;
  let parentEmitter: EventEmitter;

  const createTestGateConfig = (overrides?: Partial<ApprovalGateConfig>): ApprovalGateConfig => ({
    id: 'timeout-edge-test-gate',
    type: 'stage-completion',
    name: 'Timeout Edge Test Gate',
    description: 'Timeout edge testing gate',
    required: true,
    timeout: 1, // 1 minute default
    autoApprove: false,
    autoApproveOnTimeout: false,
    minApprovals: 1,
    tags: ['timeout-test'],
    ...overrides,
  });

  const createTestOptions = (gateConfig?: ApprovalGateConfig): ApprovalGateOptions => ({
    config: gateConfig || createTestGateConfig(),
    taskId: 'timeout-edge-task-789',
    stage: 'testing-timeout',
    agent: 'timeout-tester',
    store,
    parentEmitter,
    context: {
      timeoutEdgeCase: true,
      testType: 'timeout-boundary',
    },
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-timeout-edge-test-'));
    store = new TaskStore(testDir);
    await store.initialize();
    parentEmitter = new EventEmitter();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.useRealTimers(); // Always restore real timers
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Event Emission During Timeout', () => {
    it('should emit approval:timeout before approval:resolved', async () => {
      vi.useFakeTimers();
      const events: string[] = [];

      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      controller.on('approval:timeout', () => events.push('timeout'));
      controller.on('approval:resolved', () => events.push('resolved'));

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000); // 1 minute
      await promise;

      expect(events).toEqual(['timeout', 'resolved']);
      controller.dispose();
    });

    it('should include complete state in timeout event', async () => {
      vi.useFakeTimers();

      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: true,
        minApprovals: 2
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      let timeoutState: ApprovalState | undefined;
      controller.on('approval:timeout', (state) => {
        timeoutState = state;
      });

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);
      await promise;

      expect(timeoutState).toBeDefined();
      expect(timeoutState!.status).toBe('pending'); // State at timeout moment
      expect(timeoutState!.approvalsRequired).toBe(2);
      expect(timeoutState!.approvalsReceived).toBe(0);
      expect(timeoutState!.gateName).toBe('Timeout Edge Test Gate');

      controller.dispose();
    });

    it('should notify all registered timeout listeners', async () => {
      vi.useFakeTimers();

      const config = createTestGateConfig({ timeout: 1 });
      const controller = new ApprovalGateController(createTestOptions(config));

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      controller.on('approval:timeout', listener1);
      controller.on('approval:timeout', listener2);
      controller.on('approval:timeout', listener3);

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);
      await promise;

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
      expect(listener3).toHaveBeenCalledOnce();

      controller.dispose();
    });

    it('should forward timeout event to parent emitter', async () => {
      vi.useFakeTimers();

      const config = createTestGateConfig({ timeout: 1 });
      const controller = new ApprovalGateController(createTestOptions(config));

      const parentTimeoutListener = vi.fn();
      parentEmitter.on('approval:timeout', parentTimeoutListener);

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);
      await promise;

      expect(parentTimeoutListener).toHaveBeenCalledOnce();
      const [state] = parentTimeoutListener.mock.calls[0];
      expect(state.gateName).toBe('Timeout Edge Test Gate');

      controller.dispose();
    });
  });

  describe('State Cleanup Verification', () => {
    it('should clear timeout handle after timeout fires', async () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const config = createTestGateConfig({ timeout: 1 });
      const controller = new ApprovalGateController(createTestOptions(config));

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);
      await promise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
      controller.dispose();
    });

    it('should clear timeout handle when manually resolved before timeout', async () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const config = createTestGateConfig({ timeout: 5 }); // 5 minutes
      const controller = new ApprovalGateController(createTestOptions(config));

      const promise = controller.requestApproval();

      // Manually approve before timeout
      await controller.grant('user', 'Manual approval before timeout');
      await promise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
      controller.dispose();
    });

    it('should cleanup properly when disposed during pending timeout', async () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const config = createTestGateConfig({ timeout: 5 });
      const controller = new ApprovalGateController(createTestOptions(config));

      controller.requestApproval(); // Don't await

      // Dispose while timeout is pending
      controller.dispose();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(controller.listenerCount('approval:timeout')).toBe(0);
    });

    it('should not leave orphaned timers on rapid create/dispose cycles', async () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const config = createTestGateConfig({ timeout: 1 });

      // Rapid create/dispose cycle
      for (let i = 0; i < 5; i++) {
        const controller = new ApprovalGateController(createTestOptions(config));
        controller.requestApproval(); // Don't await
        controller.dispose();
      }

      // Each controller should have called setTimeout and clearTimeout
      expect(setTimeoutSpy).toHaveBeenCalledTimes(5);
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('Database Persistence During Timeout', () => {
    it('should persist state with respondedAt timestamp on timeout', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));
      const beforeTimeout = new Date();

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);
      await promise;

      const savedState = await store.getApprovalState(controller.id);
      expect(savedState).toBeDefined();
      expect(savedState!.respondedAt).toBeDefined();
      expect(savedState!.respondedAt!.getTime()).toBeGreaterThanOrEqual(beforeTimeout.getTime());

      controller.dispose();
    });

    it('should persist system as approver on timeout', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: true // Auto-approve on timeout
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);
      await promise;

      const savedState = await store.getApprovalState(controller.id);
      expect(savedState!.approver).toBe('system');
      expect(savedState!.comment).toBe('Auto-approved due to timeout');

      controller.dispose();
    });

    it('should persist correct status based on autoApproveOnTimeout config', async () => {
      vi.useFakeTimers();

      // Test auto-approve on timeout
      const approveConfig = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: true
      });

      const approveController = new ApprovalGateController(createTestOptions(approveConfig));

      const approvePromise = approveController.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);
      await approvePromise;

      const approvedState = await store.getApprovalState(approveController.id);
      expect(approvedState!.status).toBe('approved');
      approveController.dispose();

      // Test auto-deny on timeout
      const denyConfig = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: false,
        id: 'deny-timeout-gate' // Different ID
      });

      const denyController = new ApprovalGateController(createTestOptions(denyConfig));

      const denyPromise = denyController.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);
      await denyPromise;

      const deniedState = await store.getApprovalState(denyController.id);
      expect(deniedState!.status).toBe('denied');
      expect(deniedState!.comment).toBe('Approval timed out');
      denyController.dispose();
    });

    it('should handle store update failure gracefully during timeout', async () => {
      vi.useFakeTimers();

      const config = createTestGateConfig({ timeout: 1 });
      const controller = new ApprovalGateController(createTestOptions(config));

      // Mock store to fail on update
      const updateSpy = vi.spyOn(store, 'updateApprovalState')
        .mockRejectedValueOnce(new Error('Database connection lost'));

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);

      // Should not throw despite database error
      await expect(promise).rejects.toThrow('Database connection lost');

      updateSpy.mockRestore();
      controller.dispose();
    });
  });

  describe('Timeout with Partial Approvals', () => {
    it('should timeout even with partial approvals received', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        minApprovals: 3,
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const promise = controller.requestApproval();

      // Only 1 of 3 approvals received
      await controller.grant('user1', 'First approval');
      expect(controller.approvalState.approvalsReceived).toBe(1);

      vi.advanceTimersByTime(1 * 60 * 1000);
      const result = await promise;

      expect(result.status).toBe('denied');
      expect(result.approvalsReceived).toBe(1);
      expect(result.approvalsRequired).toBe(3);

      controller.dispose();
    });

    it('should preserve approvalsReceived count on timeout', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        minApprovals: 5,
        autoApproveOnTimeout: true
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const promise = controller.requestApproval();

      // Receive 2 of 5 approvals
      await controller.grant('user1', 'Partial 1');
      await controller.grant('user2', 'Partial 2');

      vi.advanceTimersByTime(1 * 60 * 1000);
      const result = await promise;

      expect(result.status).toBe('approved'); // Auto-approved due to timeout
      expect(result.approvalsReceived).toBe(5); // Should be bumped to required on auto-approve
      expect(result.approvalsRequired).toBe(5);

      const savedState = await store.getApprovalState(controller.id);
      expect(savedState!.approvalsReceived).toBe(5);

      controller.dispose();
    });

    it('should emit timeout event with partial approval context', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        minApprovals: 3,
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      let timeoutEventState: ApprovalState | undefined;
      controller.on('approval:timeout', (state) => {
        timeoutEventState = state;
      });

      const promise = controller.requestApproval();

      // Partial approvals
      await controller.grant('user1', 'Partial');
      await controller.grant('user2', 'Another partial');

      vi.advanceTimersByTime(1 * 60 * 1000);
      await promise;

      expect(timeoutEventState).toBeDefined();
      expect(timeoutEventState!.approvalsReceived).toBe(2);
      expect(timeoutEventState!.approvalsRequired).toBe(3);
      expect(timeoutEventState!.status).toBe('pending'); // Still pending at timeout moment

      controller.dispose();
    });
  });

  describe('Timeout Boundary Conditions', () => {
    it('should handle very small fractional timeouts', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 0.001, // 0.06 seconds
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const timeoutSpy = vi.fn();
      controller.on('approval:timeout', timeoutSpy);

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(60); // 0.001 * 60 * 1000 = 60ms
      const result = await promise;

      expect(result.status).toBe('denied');
      expect(timeoutSpy).toHaveBeenCalled();

      controller.dispose();
    });

    it('should handle timeout at exact millisecond boundary', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1, // Exactly 1 minute
        autoApproveOnTimeout: true
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const promise = controller.requestApproval();

      // Advance to just before timeout
      vi.advanceTimersByTime(60000 - 1); // 59.999 seconds
      expect(controller.isPending).toBe(true);

      // Advance the final millisecond
      vi.advanceTimersByTime(1);
      const result = await promise;

      expect(result.status).toBe('approved');
      expect(result.approver).toBe('system');

      controller.dispose();
    });

    it('should handle timeout immediately after approval requested', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 0, // Immediate timeout
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const result = await controller.requestApproval();

      expect(result.status).toBe('denied');
      expect(result.approver).toBe('system');
      expect(result.comment).toBe('Approval timed out');

      controller.dispose();
    });
  });

  describe('Denial Racing Against Timeout', () => {
    it('should handle denial just before timeout fires', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const promise = controller.requestApproval();

      // Deny just before timeout (59.9 seconds)
      vi.advanceTimersByTime(59900);
      await controller.deny('manual-user', 'Denied before timeout');

      const result = await promise;

      expect(result.status).toBe('denied');
      expect(result.approver).toBe('manual-user');
      expect(result.comment).toBe('Denied before timeout');

      controller.dispose();
    });

    it('should not emit double events on close race', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const timeoutEvents: any[] = [];
      const resolvedEvents: any[] = [];

      controller.on('approval:timeout', (...args) => timeoutEvents.push(args));
      controller.on('approval:resolved', (...args) => resolvedEvents.push(args));

      const promise = controller.requestApproval();

      // Race condition: deny exactly at timeout
      setTimeout(async () => {
        try {
          await controller.deny('race-user', 'Racing denial');
        } catch (error) {
          // May fail if timeout wins the race
        }
      }, 0);

      vi.advanceTimersByTime(1 * 60 * 1000);
      await promise;

      // Should have exactly one resolved event, regardless of who wins
      expect(resolvedEvents).toHaveLength(1);
      // May have zero or one timeout events depending on race outcome
      expect(timeoutEvents.length).toBeLessThanOrEqual(1);

      controller.dispose();
    });

    it('should preserve first resolution in race condition', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const promise = controller.requestApproval();

      // Manually deny first
      await controller.deny('first-user', 'First denial');

      // Try to advance timer - should not change result
      vi.advanceTimersByTime(1 * 60 * 1000);

      const result = await promise;

      expect(result.status).toBe('denied');
      expect(result.approver).toBe('first-user');
      expect(result.comment).toBe('First denial');

      controller.dispose();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle event listener errors during timeout', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: true
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      // Add listeners that throw errors
      controller.on('approval:timeout', () => {
        throw new Error('Timeout listener error');
      });

      controller.on('approval:resolved', () => {
        throw new Error('Resolved listener error');
      });

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);

      // Should not throw despite listener errors
      const result = await promise;
      expect(result.status).toBe('approved');

      controller.dispose();
    });

    it('should complete timeout resolution despite listener errors', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const errorListener = vi.fn(() => {
        throw new Error('Critical listener failure');
      });

      controller.on('approval:timeout', errorListener);

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);
      const result = await promise;

      expect(result.status).toBe('denied');
      expect(result.approver).toBe('system');
      expect(errorListener).toHaveBeenCalled();

      // Verify state was properly saved despite listener error
      const savedState = await store.getApprovalState(controller.id);
      expect(savedState!.status).toBe('denied');

      controller.dispose();
    });

    it('should maintain consistent state on error during timeout', async () => {
      vi.useFakeTimers();
      const config = createTestGateConfig({
        timeout: 1,
        autoApproveOnTimeout: true
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      // Mock store to fail on first update, succeed on retry
      let updateCallCount = 0;
      const updateSpy = vi.spyOn(store, 'updateApprovalState')
        .mockImplementation(async (id, state) => {
          updateCallCount++;
          if (updateCallCount === 1) {
            throw new Error('First update failed');
          }
          // Call original implementation for subsequent calls
          return updateSpy.mockRestore();
        });

      const promise = controller.requestApproval();
      vi.advanceTimersByTime(1 * 60 * 1000);

      // Should handle the error gracefully
      await expect(promise).rejects.toThrow('First update failed');

      // Controller state should remain consistent
      expect(controller.approvalState.status).toBe('approved');
      expect(controller.isResolved).toBe(true);

      controller.dispose();
    });
  });
});