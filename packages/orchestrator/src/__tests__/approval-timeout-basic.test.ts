/**
 * Basic unit tests for approval timeout functionality
 *
 * These tests verify the core timeout mechanisms work correctly
 * in isolation before running the full integration tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import { ApprovalGateController } from '../approval-gate-controller';
import type { ApprovalGate as ApprovalGateConfig } from '@apexcli/core';

describe('Approval Timeout - Basic Unit Tests', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-basic-test-'));
    store = new TaskStore(testDir);
    await store.initialize();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Timeout Configuration', () => {
    it('should create approval gate with timeout configuration', () => {
      const config: ApprovalGateConfig = {
        id: 'basic-timeout-gate',
        type: 'before-stage',
        name: 'Basic Timeout Gate',
        description: 'Test gate with timeout',
        required: true,
        timeout: 5, // 5 minutes
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'basic-test-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      expect(controller.approvalState.timeoutMinutes).toBe(5);
      expect(controller.approvalState.expiresAt).toBeDefined();
      expect(controller.isPending).toBe(true);

      controller.dispose();
    });

    it('should handle gates without timeout', () => {
      const config: ApprovalGateConfig = {
        id: 'no-timeout-gate',
        type: 'before-stage',
        name: 'No Timeout Gate',
        description: 'Test gate without timeout',
        required: true,
        // timeout is undefined
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'no-timeout-test-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      expect(controller.approvalState.timeoutMinutes).toBeUndefined();
      expect(controller.approvalState.expiresAt).toBeUndefined();

      controller.dispose();
    });
  });

  describe('Basic Timeout Mechanics', () => {
    it('should emit timeout event when timer expires', async () => {
      vi.useFakeTimers();

      const config: ApprovalGateConfig = {
        id: 'timeout-emit-gate',
        type: 'before-stage',
        name: 'Timeout Emit Gate',
        description: 'Test timeout event emission',
        required: true,
        timeout: 0.1, // 6 seconds
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'timeout-emit-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      let timeoutEmitted = false;
      controller.on('approval:timeout', () => {
        timeoutEmitted = true;
      });

      const approvalPromise = controller.requestApproval();

      // Advance timer to trigger timeout
      vi.advanceTimersByTime(6 * 1000);

      const result = await approvalPromise;

      expect(timeoutEmitted).toBe(true);
      expect(result.status).toBe('denied');
      expect(result.approver).toBe('system');

      controller.dispose();
    });

    it('should auto-approve on timeout when configured', async () => {
      vi.useFakeTimers();

      const config: ApprovalGateConfig = {
        id: 'auto-approve-gate',
        type: 'before-stage',
        name: 'Auto Approve Gate',
        description: 'Test auto approve on timeout',
        required: true,
        timeout: 0.1, // 6 seconds
        autoApproveOnTimeout: true,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'auto-approve-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      const approvalPromise = controller.requestApproval();

      // Advance timer to trigger timeout
      vi.advanceTimersByTime(6 * 1000);

      const result = await approvalPromise;

      expect(result.status).toBe('approved');
      expect(result.approver).toBe('system');
      expect(result.comment).toBe('Auto-approved due to timeout');

      controller.dispose();
    });
  });

  describe('Error Handling', () => {
    it('should reject duplicate approval requests', async () => {
      const config: ApprovalGateConfig = {
        id: 'duplicate-test-gate',
        type: 'before-stage',
        name: 'Duplicate Test Gate',
        description: 'Test duplicate request handling',
        required: true,
        timeout: 10,
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'duplicate-test-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      // First request should succeed
      const firstPromise = controller.requestApproval();

      // Second request should fail
      await expect(controller.requestApproval())
        .rejects
        .toThrow('Approval already requested for this gate');

      // Clean up first request
      await controller.grant('user', 'Test approval');
      await firstPromise;

      controller.dispose();
    });

    it('should reject operations on resolved gates', async () => {
      const config: ApprovalGateConfig = {
        id: 'resolved-test-gate',
        type: 'before-stage',
        name: 'Resolved Test Gate',
        description: 'Test operations on resolved gates',
        required: true,
        timeout: 10,
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'resolved-test-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      // Request and grant approval
      const approvalPromise = controller.requestApproval();
      await controller.grant('user1', 'First approval');
      await approvalPromise;

      expect(controller.isResolved).toBe(true);

      // Subsequent operations should fail
      await expect(controller.grant('user2', 'Second approval'))
        .rejects
        .toThrow('Cannot grant approval - gate is not pending');

      await expect(controller.deny('user3', 'Attempted denial'))
        .rejects
        .toThrow('Cannot deny approval - gate is not pending');

      controller.dispose();
    });
  });

  describe('Store Integration', () => {
    it('should save approval state to database', async () => {
      const config: ApprovalGateConfig = {
        id: 'store-test-gate',
        type: 'before-stage',
        name: 'Store Test Gate',
        description: 'Test database storage',
        required: true,
        timeout: 60,
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'store-test-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: { testData: 'value' }
      });

      const approvalPromise = controller.requestApproval();

      // Verify state was saved to database
      const savedState = await store.getApprovalStateById('store-test-gate');
      expect(savedState).toBeDefined();
      expect(savedState!.gateName).toBe('Store Test Gate');
      expect(savedState!.status).toBe('pending');
      expect(savedState!.context).toEqual({ testData: 'value' });

      // Complete the approval
      await controller.grant('user', 'Test completion');
      await approvalPromise;

      // Verify final state
      const finalState = await store.getApprovalStateById('store-test-gate');
      expect(finalState!.status).toBe('approved');
      expect(finalState!.approver).toBe('user');

      controller.dispose();
    });

    it('should handle orphaned approval states detection', async () => {
      // Create orphaned approval state directly in database
      const orphanedState = {
        id: 'orphaned-test-123',
        taskId: 'non-existent-task-id',
        gateName: 'Orphaned Gate',
        status: 'pending' as const,
        requestedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        stage: 'orphaned-stage',
        agent: 'orphaned-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: 60,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 24 hours ago
        context: { orphaned: true }
      };

      await store.saveApprovalState(orphanedState);

      // Verify orphaned state detection
      const orphanedStates = await store.getOrphanedApprovalStates();
      expect(orphanedStates.length).toBeGreaterThan(0);

      const found = orphanedStates.find(state => state.id === 'orphaned-test-123');
      expect(found).toBeDefined();
      expect(found!.taskId).toBe('non-existent-task-id');

      // Test cleanup
      const cleanedCount = await store.cleanupOrphanedApprovalStates();
      expect(cleanedCount).toBeGreaterThan(0);

      // Verify state was marked as denied
      const cleanedState = await store.getApprovalStateById('orphaned-test-123');
      expect(cleanedState!.status).toBe('denied');
      expect(cleanedState!.comment).toContain('orphaned');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent grant attempts correctly', async () => {
      const config: ApprovalGateConfig = {
        id: 'concurrent-test-gate',
        type: 'before-stage',
        name: 'Concurrent Test Gate',
        description: 'Test concurrent grant handling',
        required: true,
        timeout: 30,
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'concurrent-test-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      const approvalPromise = controller.requestApproval();

      // Attempt concurrent grants
      const grantPromises = [
        controller.grant('user1', 'First attempt'),
        controller.grant('user2', 'Second attempt'),
        controller.grant('user3', 'Third attempt')
      ];

      const results = await Promise.allSettled(grantPromises);
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      // Only one should succeed
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(2);

      // Approval should complete
      const result = await approvalPromise;
      expect(result.status).toBe('approved');
      expect(controller.isResolved).toBe(true);

      controller.dispose();
    });
  });
});