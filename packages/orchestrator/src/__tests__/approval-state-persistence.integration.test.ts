/**
 * Integration tests for approval state persistence in TaskStore
 * Tests persistence functionality with real SQLite database
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskStore } from '../store.js';
import { ApprovalState, ApprovalStatus, generateTaskId } from '@apexcli/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TaskStore - Approval State Persistence (Integration)', () => {
  let store: TaskStore;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-approval-test-'));
    store = new TaskStore(tempDir);
    await store.initialize();
  });

  afterEach(async () => {
    // Clean up
    store.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('saveApprovalState integration', () => {
    it('should save and retrieve a complete approval state', async () => {
      const approvalState: ApprovalState = {
        id: 'approval-001',
        taskId: 'task-001',
        gateName: 'before-deployment',
        status: 'pending' as ApprovalStatus,
        approver: 'admin@example.com',
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        respondedAt: new Date('2023-01-01T10:30:00Z'),
        comment: 'Review required for production deployment',
        context: { environment: 'production', branch: 'main' },
        stage: 'deployment',
        agent: 'devops-agent',
        approvalsReceived: 1,
        approvalsRequired: 1,
        timeoutMinutes: 60,
        expiresAt: new Date('2023-01-01T11:00:00Z'),
      };

      // Save the approval state
      await store.saveApprovalState(approvalState);

      // Retrieve it back
      const retrieved = await store.getApprovalState('task-001', 'approval-001');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('approval-001');
      expect(retrieved?.taskId).toBe('task-001');
      expect(retrieved?.gateName).toBe('before-deployment');
      expect(retrieved?.status).toBe('pending');
      expect(retrieved?.approver).toBe('admin@example.com');
      expect(retrieved?.requestedAt).toEqual(new Date('2023-01-01T10:00:00Z'));
      expect(retrieved?.respondedAt).toEqual(new Date('2023-01-01T10:30:00Z'));
      expect(retrieved?.comment).toBe('Review required for production deployment');
      expect(retrieved?.context).toEqual({ environment: 'production', branch: 'main' });
      expect(retrieved?.stage).toBe('deployment');
      expect(retrieved?.agent).toBe('devops-agent');
      expect(retrieved?.approvalsReceived).toBe(1);
      expect(retrieved?.approvalsRequired).toBe(1);
      expect(retrieved?.timeoutMinutes).toBe(60);
      expect(retrieved?.expiresAt).toEqual(new Date('2023-01-01T11:00:00Z'));
    });

    it('should save approval state with minimal required fields', async () => {
      const approvalState: ApprovalState = {
        id: 'minimal-approval',
        taskId: 'task-minimal',
        gateName: 'basic-gate',
        status: 'approved' as ApprovalStatus,
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        approvalsReceived: 1,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-minimal', 'minimal-approval');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('minimal-approval');
      expect(retrieved?.taskId).toBe('task-minimal');
      expect(retrieved?.gateName).toBe('basic-gate');
      expect(retrieved?.status).toBe('approved');
      expect(retrieved?.requestedAt).toEqual(new Date('2023-01-01T10:00:00Z'));
      expect(retrieved?.approvalsReceived).toBe(1);
      expect(retrieved?.approvalsRequired).toBe(1);

      // Optional fields should be undefined or null
      expect(retrieved?.approver).toBeUndefined();
      expect(retrieved?.respondedAt).toBeUndefined();
      expect(retrieved?.comment).toBeUndefined();
      expect(retrieved?.context).toBeUndefined();
      expect(retrieved?.stage).toBeUndefined();
      expect(retrieved?.agent).toBeUndefined();
      expect(retrieved?.timeoutMinutes).toBeUndefined();
      expect(retrieved?.expiresAt).toBeUndefined();
    });

    it('should update approval state on INSERT OR REPLACE', async () => {
      const initialState: ApprovalState = {
        id: 'update-test',
        taskId: 'task-update',
        gateName: 'update-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      // Save initial state
      await store.saveApprovalState(initialState);

      // Update to approved
      const updatedState: ApprovalState = {
        ...initialState,
        status: 'approved' as ApprovalStatus,
        approver: 'reviewer@example.com',
        respondedAt: new Date('2023-01-01T10:30:00Z'),
        comment: 'Approved after review',
        approvalsReceived: 1,
      };

      await store.saveApprovalState(updatedState);

      // Verify updated state
      const retrieved = await store.getApprovalState('task-update', 'update-test');
      expect(retrieved?.status).toBe('approved');
      expect(retrieved?.approver).toBe('reviewer@example.com');
      expect(retrieved?.respondedAt).toEqual(new Date('2023-01-01T10:30:00Z'));
      expect(retrieved?.comment).toBe('Approved after review');
      expect(retrieved?.approvalsReceived).toBe(1);
    });
  });

  describe('getApprovalState integration', () => {
    beforeEach(async () => {
      // Set up test data
      const approvalStates: ApprovalState[] = [
        {
          id: 'approval-1',
          taskId: 'task-001',
          gateName: 'gate-1',
          status: 'approved' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T10:00:00Z'),
          approvalsReceived: 1,
          approvalsRequired: 1,
        },
        {
          id: 'approval-2',
          taskId: 'task-001',
          gateName: 'gate-2',
          status: 'pending' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T11:00:00Z'),
          approvalsReceived: 0,
          approvalsRequired: 1,
        },
        {
          id: 'approval-3',
          taskId: 'task-002',
          gateName: 'gate-1',
          status: 'denied' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T12:00:00Z'),
          approvalsReceived: 0,
          approvalsRequired: 1,
        },
      ];

      for (const state of approvalStates) {
        await store.saveApprovalState(state);
      }
    });

    it('should retrieve specific approval by task ID and approval ID', async () => {
      const retrieved = await store.getApprovalState('task-001', 'approval-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('approval-1');
      expect(retrieved?.taskId).toBe('task-001');
      expect(retrieved?.status).toBe('approved');
    });

    it('should retrieve most recent approval when approval ID not provided', async () => {
      const retrieved = await store.getApprovalState('task-001');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('approval-2'); // Most recent by requested_at
      expect(retrieved?.status).toBe('pending');
    });

    it('should return null for non-existent approval', async () => {
      const retrieved = await store.getApprovalState('non-existent-task', 'non-existent-approval');
      expect(retrieved).toBeNull();
    });
  });

  describe('getPendingApprovals integration', () => {
    beforeEach(async () => {
      // Set up test data with multiple pending approvals
      const approvalStates: ApprovalState[] = [
        {
          id: 'pending-1',
          taskId: 'task-001',
          gateName: 'gate-1',
          status: 'pending' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T10:00:00Z'),
          approvalsReceived: 0,
          approvalsRequired: 1,
        },
        {
          id: 'approved-1',
          taskId: 'task-002',
          gateName: 'gate-1',
          status: 'approved' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T10:30:00Z'),
          approvalsReceived: 1,
          approvalsRequired: 1,
        },
        {
          id: 'pending-2',
          taskId: 'task-003',
          gateName: 'gate-2',
          status: 'pending' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T11:00:00Z'),
          approvalsReceived: 0,
          approvalsRequired: 2,
        },
        {
          id: 'denied-1',
          taskId: 'task-004',
          gateName: 'gate-1',
          status: 'denied' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T11:30:00Z'),
          approvalsReceived: 0,
          approvalsRequired: 1,
        },
      ];

      for (const state of approvalStates) {
        await store.saveApprovalState(state);
      }
    });

    it('should retrieve only pending approval states ordered by requested_at', async () => {
      const pendingApprovals = await store.getPendingApprovals();

      expect(pendingApprovals).toHaveLength(2);

      // Should be ordered by requested_at ASC
      expect(pendingApprovals[0].id).toBe('pending-1');
      expect(pendingApprovals[0].requestedAt).toEqual(new Date('2023-01-01T10:00:00Z'));

      expect(pendingApprovals[1].id).toBe('pending-2');
      expect(pendingApprovals[1].requestedAt).toEqual(new Date('2023-01-01T11:00:00Z'));

      // All should have pending status
      expect(pendingApprovals.every(approval => approval.status === 'pending')).toBe(true);
    });

    it('should return empty array when no pending approvals', async () => {
      // Clear the database and add only non-pending approvals
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-approval-test-'));
      store = new TaskStore(tempDir);
      await store.initialize();

      const approvedState: ApprovalState = {
        id: 'approved-only',
        taskId: 'task-001',
        gateName: 'gate-1',
        status: 'approved' as ApprovalStatus,
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        approvalsReceived: 1,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvedState);

      const pendingApprovals = await store.getPendingApprovals();
      expect(pendingApprovals).toEqual([]);
    });
  });

  describe('Persistence across process restarts', () => {
    it('should persist approval state after database close and reopen', async () => {
      const approvalState: ApprovalState = {
        id: 'persistence-test',
        taskId: 'task-persistence',
        gateName: 'persistence-gate',
        status: 'pending' as ApprovalStatus,
        approver: 'tester@example.com',
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        comment: 'Testing persistence across restarts',
        context: { testFlag: true, version: '1.0' },
        stage: 'testing',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: 30,
        expiresAt: new Date('2023-01-01T10:30:00Z'),
      };

      // Save approval state
      await store.saveApprovalState(approvalState);

      // Verify it's saved
      const beforeRestart = await store.getApprovalState('task-persistence', 'persistence-test');
      expect(beforeRestart).toBeDefined();

      // Close and reopen the database (simulating process restart)
      store.close();

      const newStore = new TaskStore(tempDir);
      await newStore.initialize();

      // Verify approval state persists
      const afterRestart = await newStore.getApprovalState('task-persistence', 'persistence-test');

      expect(afterRestart).toBeDefined();
      expect(afterRestart?.id).toBe('persistence-test');
      expect(afterRestart?.taskId).toBe('task-persistence');
      expect(afterRestart?.gateName).toBe('persistence-gate');
      expect(afterRestart?.status).toBe('pending');
      expect(afterRestart?.approver).toBe('tester@example.com');
      expect(afterRestart?.requestedAt).toEqual(new Date('2023-01-01T10:00:00Z'));
      expect(afterRestart?.comment).toBe('Testing persistence across restarts');
      expect(afterRestart?.context).toEqual({ testFlag: true, version: '1.0' });
      expect(afterRestart?.stage).toBe('testing');
      expect(afterRestart?.agent).toBe('test-agent');
      expect(afterRestart?.approvalsReceived).toBe(0);
      expect(afterRestart?.approvalsRequired).toBe(1);
      expect(afterRestart?.timeoutMinutes).toBe(30);
      expect(afterRestart?.expiresAt).toEqual(new Date('2023-01-01T10:30:00Z'));

      newStore.close();
    });

    it('should persist multiple pending approvals across restarts', async () => {
      const approvals: ApprovalState[] = [
        {
          id: 'pending-persist-1',
          taskId: 'task-001',
          gateName: 'gate-1',
          status: 'pending' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T10:00:00Z'),
          approvalsReceived: 0,
          approvalsRequired: 1,
        },
        {
          id: 'pending-persist-2',
          taskId: 'task-002',
          gateName: 'gate-2',
          status: 'pending' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T11:00:00Z'),
          approvalsReceived: 0,
          approvalsRequired: 2,
        },
      ];

      // Save multiple approvals
      for (const approval of approvals) {
        await store.saveApprovalState(approval);
      }

      // Verify before restart
      const beforeRestart = await store.getPendingApprovals();
      expect(beforeRestart).toHaveLength(2);

      // Restart
      store.close();
      const newStore = new TaskStore(tempDir);
      await newStore.initialize();

      // Verify after restart
      const afterRestart = await newStore.getPendingApprovals();
      expect(afterRestart).toHaveLength(2);
      expect(afterRestart.map(a => a.id)).toContain('pending-persist-1');
      expect(afterRestart.map(a => a.id)).toContain('pending-persist-2');

      newStore.close();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle approval state with null/undefined optional fields', async () => {
      const approvalState: ApprovalState = {
        id: 'null-fields-test',
        taskId: 'task-null-fields',
        gateName: 'null-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        approvalsReceived: 0,
        approvalsRequired: 1,
        // Explicitly not setting optional fields
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-null-fields', 'null-fields-test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.approver).toBeUndefined();
      expect(retrieved?.respondedAt).toBeUndefined();
      expect(retrieved?.comment).toBeUndefined();
      expect(retrieved?.context).toBeUndefined();
      expect(retrieved?.stage).toBeUndefined();
      expect(retrieved?.agent).toBeUndefined();
      expect(retrieved?.timeoutMinutes).toBeUndefined();
      expect(retrieved?.expiresAt).toBeUndefined();
    });

    it('should handle complex context objects', async () => {
      const complexContext = {
        environment: 'staging',
        branch: 'feature/complex-approval',
        metadata: {
          author: 'developer@example.com',
          reviewers: ['reviewer1@example.com', 'reviewer2@example.com'],
          tags: ['urgent', 'security'],
          config: {
            timeout: 3600,
            retries: 3,
            notifications: {
              slack: true,
              email: false,
            },
          },
        },
      };

      const approvalState: ApprovalState = {
        id: 'complex-context-test',
        taskId: 'task-complex',
        gateName: 'complex-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        context: complexContext,
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-complex', 'complex-context-test');
      expect(retrieved?.context).toEqual(complexContext);
    });

    it('should handle very long comment strings', async () => {
      const longComment = 'A'.repeat(5000); // 5KB comment

      const approvalState: ApprovalState = {
        id: 'long-comment-test',
        taskId: 'task-long-comment',
        gateName: 'long-comment-gate',
        status: 'denied' as ApprovalStatus,
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        comment: longComment,
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-long-comment', 'long-comment-test');
      expect(retrieved?.comment).toBe(longComment);
    });

    it('should handle approval states with different status values', async () => {
      const statuses: ApprovalStatus[] = ['pending', 'approved', 'denied'];

      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        const approvalState: ApprovalState = {
          id: `status-test-${status}`,
          taskId: `task-${status}`,
          gateName: `${status}-gate`,
          status: status,
          requestedAt: new Date(`2023-01-0${i + 1}T10:00:00Z`),
          approvalsReceived: status === 'approved' ? 1 : 0,
          approvalsRequired: 1,
        };

        await store.saveApprovalState(approvalState);

        const retrieved = await store.getApprovalState(`task-${status}`, `status-test-${status}`);
        expect(retrieved?.status).toBe(status);
      }
    });
  });
});