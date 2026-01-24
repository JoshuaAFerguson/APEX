/**
 * Test suite for ApprovalGateController class
 *
 * Tests the approval gate lifecycle management including:
 * - Event emission for approval:requested and approval:resolved
 * - Async approval/rejection with timeout handling
 * - State persistence through TaskStore
 * - Multiple approval support
 * - Auto-approval and timeout behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import {
  ApprovalGateController,
  type ApprovalGateOptions,
  type ApprovalResult,
} from '../approval-gate-controller';
import { TaskStore } from '../store';
import type {
  ApprovalGate as ApprovalGateConfig,
  ApprovalState,
  ApprovalStatus,
} from '@apexcli/core';

describe('ApprovalGateController', () => {
  let testDir: string;
  let store: TaskStore;
  let parentEmitter: EventEmitter;
  let controller: ApprovalGateController;

  const createTestGateConfig = (overrides?: Partial<ApprovalGateConfig>): ApprovalGateConfig => ({
    id: 'test-gate-id',
    type: 'stage-completion',
    name: 'Test Approval Gate',
    description: 'Test gate for unit testing',
    required: true,
    timeout: undefined,
    autoApprove: false,
    autoApproveOnTimeout: false,
    minApprovals: 1,
    tags: ['test'],
    ...overrides,
  });

  const createTestOptions = (gateConfig?: ApprovalGateConfig): ApprovalGateOptions => ({
    config: gateConfig || createTestGateConfig(),
    taskId: 'test-task-123',
    stage: 'implementation',
    agent: 'developer',
    store,
    parentEmitter,
    context: {
      workflowName: 'feature',
      stageDescription: 'Test implementation stage',
    },
  });

  beforeEach(async () => {
    // Create temporary directory for test database
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-gate-test-'));

    // Initialize test store
    store = new TaskStore(testDir);
    await store.initialize();

    // Create parent emitter for event testing
    parentEmitter = new EventEmitter();
  });

  afterEach(async () => {
    // Clean up controller
    if (controller) {
      controller.dispose();
    }

    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      const config = createTestGateConfig({ name: 'Custom Gate' });
      controller = new ApprovalGateController(createTestOptions(config));

      expect(controller.id).toBe('test-gate-id');
      expect(controller.isPending).toBe(true);
      expect(controller.isResolved).toBe(false);
      expect(controller.approvalState.gateName).toBe('Custom Gate');
    });

    it('should generate approval ID if not provided in config', () => {
      const config = createTestGateConfig();
      delete config.id;

      controller = new ApprovalGateController(createTestOptions(config));

      expect(controller.id).toMatch(/^apr_[a-z0-9]+_[a-f0-9]+$/);
    });

    it('should forward events to parent emitter when provided', async () => {
      const requestedSpy = vi.fn();
      const resolvedSpy = vi.fn();

      parentEmitter.on('approval:requested', requestedSpy);
      parentEmitter.on('approval:resolved', resolvedSpy);

      controller = new ApprovalGateController(createTestOptions());

      // Start approval process
      const approvalPromise = controller.requestApproval();

      // Wait a bit for events to emit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Resolve approval
      await controller.grant('test-user', 'Approved for testing');
      await approvalPromise;

      expect(requestedSpy).toHaveBeenCalledOnce();
      expect(resolvedSpy).toHaveBeenCalledOnce();
      expect(resolvedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
        'approved'
      );
    });
  });

  describe('requestApproval', () => {
    beforeEach(() => {
      controller = new ApprovalGateController(createTestOptions());
    });

    it('should emit approval:requested event when called', async () => {
      const requestedSpy = vi.fn();
      controller.on('approval:requested', requestedSpy);

      // Start approval (don't await to test intermediate state)
      const promise = controller.requestApproval();

      // Wait a bit for event to emit
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(requestedSpy).toHaveBeenCalledOnce();
      expect(requestedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: controller.id,
          taskId: 'test-task-123',
          gateName: 'Test Approval Gate',
          status: 'pending',
          approvalsRequired: 1,
          approvalsReceived: 0,
        })
      );

      // Clean up the pending promise
      await controller.grant('test-user', 'test');
      await promise;
    });

    it('should save approval state to store', async () => {
      const promise = controller.requestApproval();

      // Wait a bit for state to be saved
      await new Promise(resolve => setTimeout(resolve, 10));

      const savedState = await store.getApprovalStateById(controller.id);
      expect(savedState).toBeDefined();
      expect(savedState!.id).toBe(controller.id);
      expect(savedState!.status).toBe('pending');

      // Clean up
      await controller.grant('test-user', 'test');
      await promise;
    });

    it('should handle auto-approval when configured', async () => {
      const config = createTestGateConfig({ autoApprove: true });
      controller = new ApprovalGateController(createTestOptions(config));

      const result = await controller.requestApproval();

      expect(result.status).toBe('approved');
      expect(result.approver).toBe('system');
      expect(result.comment).toBe('Auto-approved by configuration');
      expect(controller.isResolved).toBe(true);
    });

    it('should throw error if called multiple times', async () => {
      const promise1 = controller.requestApproval();
      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for first call to set up

      await expect(controller.requestApproval()).rejects.toThrow(
        'Approval already requested for this gate'
      );

      // Clean up
      await controller.grant('test-user', 'test');
      await promise1;
    });

    it('should throw error if already resolved', async () => {
      const promise = controller.requestApproval();
      await new Promise(resolve => setTimeout(resolve, 20)); // Wait for setup
      await controller.grant('test-user', 'test');
      await promise;

      await expect(controller.requestApproval()).rejects.toThrow(
        'Approval gate is already resolved'
      );
    });
  });

  describe('grant', () => {
    beforeEach(async () => {
      controller = new ApprovalGateController(createTestOptions());
      // Start approval process
      controller.requestApproval(); // Don't await to test intermediate operations
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for setup
    });

    it('should grant approval and resolve promise', async () => {
      const resolvedSpy = vi.fn();
      controller.on('approval:resolved', resolvedSpy);

      await controller.grant('test-user', 'Looks good!');

      expect(controller.isResolved).toBe(true);
      expect(controller.approvalState.status).toBe('approved');
      expect(controller.approvalState.approvalsReceived).toBe(1);
      expect(controller.approvalState.approver).toBe('test-user');
      expect(controller.approvalState.comment).toBe('Looks good!');

      expect(resolvedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
        'approved'
      );
    });

    it('should handle multiple approvals when required', async () => {
      const config = createTestGateConfig({ minApprovals: 2 });
      controller = new ApprovalGateController(createTestOptions(config));
      controller.requestApproval(); // Don't await
      await new Promise(resolve => setTimeout(resolve, 10));

      const resolvedSpy = vi.fn();
      controller.on('approval:resolved', resolvedSpy);

      // First approval - shouldn't resolve yet
      await controller.grant('user1', 'First approval');
      expect(controller.isPending).toBe(true);
      expect(controller.approvalState.approvalsReceived).toBe(1);
      expect(resolvedSpy).not.toHaveBeenCalled();

      // Second approval - should resolve
      await controller.grant('user2', 'Second approval');
      expect(controller.isResolved).toBe(true);
      expect(controller.approvalState.approvalsReceived).toBe(2);
      expect(resolvedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
        'approved'
      );
    });

    it('should throw error if not pending', async () => {
      await controller.grant('user1', 'First grant');

      await expect(controller.grant('user2', 'Second grant')).rejects.toThrow(
        'Cannot grant approval - gate is not pending'
      );
    });

    it('should throw error if already has enough approvals', async () => {
      await controller.grant('user1', 'First grant');
      // At this point it should be resolved with 1/1 approvals

      await expect(controller.grant('user2', 'Extra grant')).rejects.toThrow(
        'Cannot grant approval - gate is not pending'
      );
    });
  });

  describe('deny', () => {
    beforeEach(async () => {
      controller = new ApprovalGateController(createTestOptions());
      controller.requestApproval(); // Don't await
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should deny approval and resolve promise', async () => {
      const resolvedSpy = vi.fn();
      controller.on('approval:resolved', resolvedSpy);

      await controller.deny('test-user', 'Not ready yet');

      expect(controller.isResolved).toBe(true);
      expect(controller.approvalState.status).toBe('denied');
      expect(controller.approvalState.approver).toBe('test-user');
      expect(controller.approvalState.comment).toBe('Not ready yet');

      expect(resolvedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'denied' }),
        'denied'
      );
    });

    it('should throw error if not pending', async () => {
      await controller.deny('user1', 'First deny');

      await expect(controller.deny('user2', 'Second deny')).rejects.toThrow(
        'Cannot deny approval - gate is not pending'
      );
    });
  });

  describe('timeout handling', () => {
    it('should auto-approve on timeout when configured', async () => {
      const config = createTestGateConfig({
        timeout: 0.01, // 0.6 seconds
        autoApproveOnTimeout: true,
      });
      controller = new ApprovalGateController(createTestOptions(config));

      const timeoutSpy = vi.fn();
      const resolvedSpy = vi.fn();
      controller.on('approval:timeout', timeoutSpy);
      controller.on('approval:resolved', resolvedSpy);

      const result = await controller.requestApproval();

      expect(result.status).toBe('approved');
      expect(result.approver).toBe('system');
      expect(result.comment).toBe('Auto-approved due to timeout');
      expect(controller.isResolved).toBe(true);
      expect(controller.approvalState.status).toBe('approved');

      expect(timeoutSpy).toHaveBeenCalledOnce();
      expect(resolvedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
        'timeout'
      );
    }, 10000);

    it('should auto-deny on timeout by default', async () => {
      const config = createTestGateConfig({
        timeout: 0.01, // 0.6 seconds
        autoApproveOnTimeout: false,
      });
      controller = new ApprovalGateController(createTestOptions(config));

      const timeoutSpy = vi.fn();
      const resolvedSpy = vi.fn();
      controller.on('approval:timeout', timeoutSpy);
      controller.on('approval:resolved', resolvedSpy);

      const result = await controller.requestApproval();

      expect(result.status).toBe('denied');
      expect(result.approver).toBe('system');
      expect(controller.isResolved).toBe(true);
      expect(controller.approvalState.status).toBe('denied');
      expect(controller.approvalState.comment).toBe('Approval timed out');

      expect(timeoutSpy).toHaveBeenCalledOnce();
      expect(resolvedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'denied' }),
        'timeout'
      );
    }, 10000);

    it('should not timeout when no timeout is configured', async () => {
      controller = new ApprovalGateController(createTestOptions());

      const promise = controller.requestApproval();

      // Wait longer than any reasonable timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(controller.isPending).toBe(true);

      // Manually resolve
      await controller.grant('test-user', 'Manual approval');
      const result = await promise;

      expect(result.status).toBe('approved');
    });
  });

  describe('cancel', () => {
    let approvalPromise: Promise<ApprovalResult>;

    beforeEach(async () => {
      controller = new ApprovalGateController(createTestOptions());
      approvalPromise = controller.requestApproval(); // Don't await
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    it('should cancel pending approval', async () => {
      await controller.cancel();

      expect(controller.isResolved).toBe(true);
      expect(controller.approvalState.status).toBe('denied');
      expect(controller.approvalState.comment).toBe('Cancelled');

      await expect(approvalPromise).rejects.toThrow('Approval was cancelled');
    });

    it('should do nothing if already resolved', async () => {
      await controller.grant('test-user', 'Approved');

      // Should not throw
      await controller.cancel();

      expect(controller.approvalState.status).toBe('approved');
    });
  });

  describe('dispose', () => {
    it('should clean up resources and listeners', async () => {
      controller = new ApprovalGateController(createTestOptions());

      const promise = controller.requestApproval();

      // Add some listeners
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      controller.on('approval:resolved', listener1);
      controller.on('approval:timeout', listener2);

      controller.dispose();

      // Verify listeners are removed
      expect(controller.listenerCount('approval:resolved')).toBe(0);
      expect(controller.listenerCount('approval:timeout')).toBe(0);

      // Should be safe to call multiple times
      controller.dispose();
    });
  });

  describe('integration with existing approval flow', () => {
    it('should work with TaskStore approval persistence', async () => {
      controller = new ApprovalGateController(createTestOptions());

      const promise = controller.requestApproval();

      // Check that state was saved
      let savedState = await store.getApprovalStateById(controller.id);
      expect(savedState).toBeDefined();
      expect(savedState!.status).toBe('pending');

      await controller.grant('integration-test-user', 'Integration test approval');
      await promise;

      // Check that state was updated
      savedState = await store.getApprovalStateById(controller.id);
      expect(savedState!.status).toBe('approved');
      expect(savedState!.approvalsReceived).toBe(1);
    });

    it('should generate correct ApprovalResult for consumers', async () => {
      controller = new ApprovalGateController(createTestOptions());

      const approvalPromise = controller.requestApproval();

      // Grant in separate call to test promise resolution
      setTimeout(async () => {
        await controller.grant('result-test-user', 'Result test comment');
      }, 10);

      const approvalResult = await approvalPromise;

      expect(approvalResult).toMatchObject({
        status: 'approved',
        approver: 'result-test-user',
        comment: 'Result test comment',
        approvalsReceived: 1,
        approvalsRequired: 1,
      });
      expect(approvalResult.respondedAt).toBeInstanceOf(Date);
    });
  });
});