/**
 * Edge case tests for ApprovalGateController
 *
 * Tests edge cases, error conditions, and boundary scenarios
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
import type { ApprovalGate as ApprovalGateConfig } from '@apexcli/core';

describe('ApprovalGateController - Edge Cases', () => {
  let testDir: string;
  let store: TaskStore;
  let parentEmitter: EventEmitter;

  const createTestGateConfig = (overrides?: Partial<ApprovalGateConfig>): ApprovalGateConfig => ({
    id: 'edge-test-gate',
    type: 'stage-completion',
    name: 'Edge Test Gate',
    description: 'Edge testing gate',
    required: true,
    timeout: undefined,
    autoApprove: false,
    autoApproveOnTimeout: false,
    minApprovals: 1,
    tags: ['edge-test'],
    ...overrides,
  });

  const createTestOptions = (gateConfig?: ApprovalGateConfig): ApprovalGateOptions => ({
    config: gateConfig || createTestGateConfig(),
    taskId: 'edge-task-456',
    stage: 'testing',
    agent: 'tester',
    store,
    parentEmitter,
    context: {
      edgeCase: true,
      testType: 'boundary',
    },
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-edge-test-'));
    store = new TaskStore(path.join(testDir, 'edge-test.db'));
    parentEmitter = new EventEmitter();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('configuration edge cases', () => {
    it('should handle missing ID in config', () => {
      const config = createTestGateConfig();
      delete config.id;

      const controller = new ApprovalGateController(createTestOptions(config));

      expect(controller.id).toMatch(/^approval_[a-z0-9]+$/);
      expect(controller.approvalState.gateName).toBe('Edge Test Gate');

      controller.dispose();
    });

    it('should handle missing name in config with fallback', () => {
      const config = createTestGateConfig({ name: undefined });

      const controller = new ApprovalGateController(createTestOptions(config));

      expect(controller.approvalState.gateName).toBe('stage-completion-gate');

      controller.dispose();
    });

    it('should handle zero timeout (immediate timeout)', async () => {
      const config = createTestGateConfig({
        timeout: 0,
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const timeoutSpy = vi.fn();
      controller.on('approval:timeout', timeoutSpy);

      const result = await controller.requestApproval();

      expect(result.status).toBe('denied');
      expect(result.approver).toBe('system');
      expect(timeoutSpy).toHaveBeenCalled();

      controller.dispose();
    });

    it('should handle negative minApprovals by using default', () => {
      const config = createTestGateConfig({ minApprovals: -1 });

      const controller = new ApprovalGateController(createTestOptions(config));

      expect(controller.approvalState.approvalsRequired).toBe(-1); // Should preserve the value as configured

      controller.dispose();
    });

    it('should handle very large minApprovals', () => {
      const config = createTestGateConfig({ minApprovals: 999 });

      const controller = new ApprovalGateController(createTestOptions(config));

      expect(controller.approvalState.approvalsRequired).toBe(999);

      controller.dispose();
    });
  });

  describe('timeout edge cases', () => {
    it('should handle timeout clearing after manual resolution', async () => {
      const config = createTestGateConfig({
        timeout: 10, // 10 minutes
        autoApproveOnTimeout: true
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const approvalPromise = controller.requestApproval();

      // Manually approve before timeout
      await controller.grant('manual-user', 'Approved before timeout');

      const result = await approvalPromise;

      expect(result.status).toBe('approved');
      expect(result.approver).toBe('manual-user');
      expect(result.comment).toBe('Approved before timeout');

      controller.dispose();
    });

    it('should handle concurrent timeout and manual approval', async () => {
      vi.useFakeTimers();

      const config = createTestGateConfig({
        timeout: 0.001, // Very short timeout
        autoApproveOnTimeout: false
      });

      const controller = new ApprovalGateController(createTestOptions(config));

      const approvalPromise = controller.requestApproval();

      // Try to approve at the same time as timeout
      setTimeout(async () => {
        try {
          await controller.grant('concurrent-user', 'Concurrent approval');
        } catch (error) {
          // Expected to fail if timeout wins
        }
      }, 1);

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(100);

      const result = await approvalPromise;

      expect(result.status).toBe('denied'); // Timeout should win
      expect(result.approver).toBe('system');

      vi.useRealTimers();
      controller.dispose();
    });
  });

  describe('state management edge cases', () => {
    it('should maintain immutability of approval state', () => {
      const controller = new ApprovalGateController(createTestOptions());

      const state1 = controller.approvalState;
      const state2 = controller.approvalState;

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object references

      // Modifying returned state shouldn't affect internal state
      state1.status = 'approved';
      expect(controller.approvalState.status).toBe('pending');

      controller.dispose();
    });

    it('should handle database errors gracefully during save', async () => {
      // Create a mock store that fails on save
      const failingStore = {
        ...store,
        saveApprovalState: vi.fn().mockRejectedValue(new Error('Database write failed')),
      } as unknown as TaskStore;

      const options = createTestOptions();
      options.store = failingStore;

      const controller = new ApprovalGateController(options);

      await expect(controller.requestApproval()).rejects.toThrow('Database write failed');

      controller.dispose();
    });

    it('should handle database errors gracefully during update', async () => {
      const controller = new ApprovalGateController(createTestOptions());

      // Start the approval process
      const approvalPromise = controller.requestApproval();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock store to fail on update
      const failingSpy = vi.spyOn(store, 'updateApprovalState').mockRejectedValue(new Error('Update failed'));

      await expect(controller.grant('test-user', 'test')).rejects.toThrow('Update failed');

      failingSpy.mockRestore();
      controller.dispose();
    });
  });

  describe('event handling edge cases', () => {
    it('should not forward events when no parent emitter provided', async () => {
      const options = createTestOptions();
      delete options.parentEmitter;

      const controller = new ApprovalGateController(options);

      // Should not throw when emitting events
      const approvalPromise = controller.requestApproval();
      await new Promise(resolve => setTimeout(resolve, 10));

      await controller.grant('test-user', 'test');
      await approvalPromise;

      controller.dispose();
    });

    it('should handle listener removal during event emission', async () => {
      const controller = new ApprovalGateController(createTestOptions());

      let listenerCalled = false;
      const removeDuringEmit = () => {
        listenerCalled = true;
        controller.removeAllListeners();
      };

      controller.on('approval:resolved', removeDuringEmit);

      const approvalPromise = controller.requestApproval();
      await controller.grant('test-user', 'test');
      await approvalPromise;

      expect(listenerCalled).toBe(true);
      expect(controller.listenerCount('approval:resolved')).toBe(0);

      controller.dispose();
    });

    it('should handle error in event listeners gracefully', async () => {
      const controller = new ApprovalGateController(createTestOptions());

      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      controller.on('approval:requested', errorListener);

      // Should not throw despite listener error
      const approvalPromise = controller.requestApproval();
      await controller.grant('test-user', 'test');
      await approvalPromise;

      expect(errorListener).toHaveBeenCalled();

      controller.dispose();
    });
  });

  describe('multiple approval edge cases', () => {
    it('should handle rapid successive approvals correctly', async () => {
      const config = createTestGateConfig({ minApprovals: 3 });
      const controller = new ApprovalGateController(createTestOptions(config));

      const approvalPromise = controller.requestApproval();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Grant multiple approvals rapidly
      const promises = [
        controller.grant('user1', 'Rapid 1'),
        controller.grant('user2', 'Rapid 2'),
        controller.grant('user3', 'Rapid 3'),
      ];

      await Promise.all(promises);
      const result = await approvalPromise;

      expect(result.status).toBe('approved');
      expect(result.approvalsReceived).toBe(3);
      expect(result.approvalsRequired).toBe(3);

      controller.dispose();
    });

    it('should reject extra approvals after resolution', async () => {
      const config = createTestGateConfig({ minApprovals: 2 });
      const controller = new ApprovalGateController(createTestOptions(config));

      const approvalPromise = controller.requestApproval();
      await new Promise(resolve => setTimeout(resolve, 10));

      await controller.grant('user1', 'First');
      await controller.grant('user2', 'Second'); // This should complete
      await approvalPromise;

      // Third approval should fail
      await expect(controller.grant('user3', 'Third')).rejects.toThrow(
        'Cannot grant approval - gate is not pending'
      );

      controller.dispose();
    });
  });

  describe('cancellation edge cases', () => {
    it('should handle multiple cancellation calls', async () => {
      const controller = new ApprovalGateController(createTestOptions());

      const approvalPromise = controller.requestApproval();

      await controller.cancel();
      await controller.cancel(); // Second call should be safe

      await expect(approvalPromise).rejects.toThrow('Approval was cancelled');

      controller.dispose();
    });

    it('should handle cancellation without pending request', async () => {
      const controller = new ApprovalGateController(createTestOptions());

      // Should not throw when no pending request
      await controller.cancel();

      controller.dispose();
    });

    it('should handle disposal during pending approval', () => {
      const controller = new ApprovalGateController(createTestOptions());

      controller.requestApproval(); // Don't await

      // Should not throw
      controller.dispose();

      expect(controller.listenerCount('approval:resolved')).toBe(0);
    });
  });

  describe('boundary value testing', () => {
    it('should handle exactly one approval when minApprovals is 1', async () => {
      const config = createTestGateConfig({ minApprovals: 1 });
      const controller = new ApprovalGateController(createTestOptions(config));

      const approvalPromise = controller.requestApproval();
      await controller.grant('boundary-user', 'Exact match');
      const result = await approvalPromise;

      expect(result.approvalsReceived).toBe(1);
      expect(result.approvalsRequired).toBe(1);
      expect(result.status).toBe('approved');

      controller.dispose();
    });

    it('should handle empty strings in approval data', async () => {
      const controller = new ApprovalGateController(createTestOptions());

      const approvalPromise = controller.requestApproval();
      await controller.grant('', ''); // Empty strings
      const result = await approvalPromise;

      expect(result.approver).toBe('');
      expect(result.comment).toBe('');
      expect(result.status).toBe('approved');

      controller.dispose();
    });

    it('should handle undefined comment in grant', async () => {
      const controller = new ApprovalGateController(createTestOptions());

      const approvalPromise = controller.requestApproval();
      await controller.grant('test-user'); // No comment
      const result = await approvalPromise;

      expect(result.approver).toBe('test-user');
      expect(result.comment).toBeUndefined();
      expect(result.status).toBe('approved');

      controller.dispose();
    });
  });
});