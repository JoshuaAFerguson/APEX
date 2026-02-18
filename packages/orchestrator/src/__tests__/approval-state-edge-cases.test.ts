/**
 * Edge case tests for approval state persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskStore } from '../store.js';
import { ApprovalState, ApprovalStatus, generateTaskId } from '@apexcli/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TaskStore - Approval State Edge Cases', () => {
  let store: TaskStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-approval-edge-test-'));
    store = new TaskStore(tempDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Data validation and constraints', () => {
    it('should handle very long approval IDs and task IDs', async () => {
      const longId = 'a'.repeat(1000); // 1KB ID
      const approvalState: ApprovalState = {
        id: longId,
        taskId: longId,
        gateName: 'long-id-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date(),
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      await expect(store.saveApprovalState(approvalState)).resolves.not.toThrow();

      const retrieved = await store.getApprovalState(longId, longId);
      expect(retrieved?.id).toBe(longId);
      expect(retrieved?.taskId).toBe(longId);
    });

    it('should handle special characters in gate names and approvers', async () => {
      const approvalState: ApprovalState = {
        id: 'special-chars-test',
        taskId: 'task-special',
        gateName: 'gate/with-special*chars@domain.com & symbols!',
        status: 'approved' as ApprovalStatus,
        approver: 'user@domain.com ñáéí ♠♣♦♥',
        requestedAt: new Date(),
        approvalsReceived: 1,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-special', 'special-chars-test');
      expect(retrieved?.gateName).toBe('gate/with-special*chars@domain.com & symbols!');
      expect(retrieved?.approver).toBe('user@domain.com ñáéí ♠♣♦♥');
    });

    it('should handle empty and whitespace-only strings', async () => {
      const approvalState: ApprovalState = {
        id: 'whitespace-test',
        taskId: 'task-whitespace',
        gateName: '   ',
        status: 'pending' as ApprovalStatus,
        approver: '',
        comment: '   \n\t  ',
        stage: '',
        agent: '  ',
        requestedAt: new Date(),
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-whitespace', 'whitespace-test');
      expect(retrieved?.gateName).toBe('   ');
      expect(retrieved?.approver).toBeUndefined(); // Empty string becomes undefined after || null conversion
      expect(retrieved?.comment).toBe('   \n\t  ');
    });

    it('should handle maximum numeric values for approvals', async () => {
      const maxInt = Number.MAX_SAFE_INTEGER;
      const approvalState: ApprovalState = {
        id: 'max-numbers-test',
        taskId: 'task-max-numbers',
        gateName: 'max-numbers-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date(),
        approvalsReceived: maxInt,
        approvalsRequired: maxInt,
        timeoutMinutes: maxInt,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-max-numbers', 'max-numbers-test');
      expect(retrieved?.approvalsReceived).toBe(maxInt);
      expect(retrieved?.approvalsRequired).toBe(maxInt);
      expect(retrieved?.timeoutMinutes).toBe(maxInt);
    });

    it('should handle zero and negative numbers gracefully', async () => {
      const approvalState: ApprovalState = {
        id: 'zero-negative-test',
        taskId: 'task-zero-negative',
        gateName: 'zero-negative-gate',
        status: 'approved' as ApprovalStatus,
        requestedAt: new Date(),
        approvalsReceived: -1,
        approvalsRequired: 0,
        timeoutMinutes: -30,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-zero-negative', 'zero-negative-test');
      expect(retrieved?.approvalsReceived).toBe(-1);
      expect(retrieved?.approvalsRequired).toBe(0);
      expect(retrieved?.timeoutMinutes).toBe(-30);
    });
  });

  describe('Date and time handling', () => {
    it('should handle dates at boundaries (epoch, far future)', async () => {
      const epochDate = new Date(0); // 1970-01-01
      const farFutureDate = new Date('9999-12-31T23:59:59Z');

      const approvalState: ApprovalState = {
        id: 'date-boundaries-test',
        taskId: 'task-date-boundaries',
        gateName: 'date-boundaries-gate',
        status: 'approved' as ApprovalStatus,
        requestedAt: epochDate,
        respondedAt: farFutureDate,
        expiresAt: farFutureDate,
        approvalsReceived: 1,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-date-boundaries', 'date-boundaries-test');
      expect(retrieved?.requestedAt).toEqual(epochDate);
      expect(retrieved?.respondedAt).toEqual(farFutureDate);
      expect(retrieved?.expiresAt).toEqual(farFutureDate);
    });

    it('should preserve millisecond precision in dates', async () => {
      const preciseDate = new Date('2023-01-01T10:30:45.123Z');

      const approvalState: ApprovalState = {
        id: 'precision-test',
        taskId: 'task-precision',
        gateName: 'precision-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: preciseDate,
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-precision', 'precision-test');
      expect(retrieved?.requestedAt.getTime()).toBe(preciseDate.getTime());
    });
  });

  describe('Context field edge cases', () => {
    it('should handle deeply nested context objects', async () => {
      const deepContext = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  deeply: 'nested',
                  array: [1, 2, 3, { nested: 'in array' }],
                  date: '2023-01-01T00:00:00Z',
                  boolean: true,
                  null: null,
                },
              },
            },
          },
        },
        topLevel: 'value',
      };

      const approvalState: ApprovalState = {
        id: 'deep-context-test',
        taskId: 'task-deep-context',
        gateName: 'deep-context-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date(),
        context: deepContext,
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-deep-context', 'deep-context-test');
      expect(retrieved?.context).toEqual(deepContext);
    });

    it('should handle context with special data types', async () => {
      const specialContext = {
        bigNumber: 123456789012345678901234567890n, // BigInt (will be converted to string in JSON)
        symbol: Symbol.for('test'), // Symbol (will be lost in JSON)
        undefined: undefined, // Will be lost in JSON
        function: () => 'test', // Will be lost in JSON
        circular: null as any, // Will test circular reference handling
        array: [],
        emptyObject: {},
        date: new Date().toISOString(),
        regexp: '/test/gi', // RegExp as string
      };
      specialContext.circular = specialContext; // Create circular reference

      const approvalState: ApprovalState = {
        id: 'special-context-test',
        taskId: 'task-special-context',
        gateName: 'special-context-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date(),
        context: specialContext,
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      // This should not throw even with problematic data
      await expect(store.saveApprovalState(approvalState)).resolves.not.toThrow();

      const retrieved = await store.getApprovalState('task-special-context', 'special-context-test');
      expect(retrieved?.context).toBeDefined();
    });

    it('should handle very large context objects', async () => {
      const largeArray = Array(10000).fill(0).map((_, i) => ({
        id: i,
        name: `item-${i}`,
        data: `data-${'x'.repeat(100)}`, // 100 chars per item
      }));

      const largeContext = {
        largeArray,
        metadata: {
          total: largeArray.length,
          generated: new Date().toISOString(),
        },
      };

      const approvalState: ApprovalState = {
        id: 'large-context-test',
        taskId: 'task-large-context',
        gateName: 'large-context-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date(),
        context: largeContext,
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState('task-large-context', 'large-context-test');
      expect(retrieved?.context).toEqual(largeContext);
      expect(Array.isArray((retrieved?.context as any)?.largeArray)).toBe(true);
      expect((retrieved?.context as any)?.largeArray).toHaveLength(10000);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle multiple simultaneous saves of different approval states', async () => {
      const approvalStates: ApprovalState[] = Array(10).fill(0).map((_, i) => ({
        id: `concurrent-${i}`,
        taskId: `task-concurrent-${i}`,
        gateName: `gate-${i}`,
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date(),
        approvalsReceived: 0,
        approvalsRequired: 1,
      }));

      // Save all states concurrently
      await Promise.all(approvalStates.map(state => store.saveApprovalState(state)));

      // Verify all were saved
      for (const state of approvalStates) {
        const retrieved = await store.getApprovalState(state.taskId, state.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(state.id);
      }
    });

    it('should handle rapid updates to the same approval state', async () => {
      const initialState: ApprovalState = {
        id: 'rapid-update-test',
        taskId: 'task-rapid-update',
        gateName: 'rapid-update-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date(),
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      await store.saveApprovalState(initialState);

      // Rapidly update the same approval state
      const updates = Array(50).fill(0).map((_, i) => ({
        ...initialState,
        comment: `Update ${i}`,
        approvalsReceived: i,
      }));

      await Promise.all(updates.map(update => store.saveApprovalState(update)));

      const final = await store.getApprovalState('task-rapid-update', 'rapid-update-test');
      expect(final).toBeDefined();
      // Should have one of the update comments (exact one is race-dependent)
      expect(final?.comment).toMatch(/Update \d+/);
    });
  });

  describe('Query edge cases', () => {
    it('should handle queries with no matching results gracefully', async () => {
      const nonExistentTask = await store.getApprovalState('non-existent-task');
      expect(nonExistentTask).toBeNull();

      const nonExistentApproval = await store.getApprovalState('task-123', 'non-existent-approval');
      expect(nonExistentApproval).toBeNull();

      const noPending = await store.getPendingApprovals();
      expect(noPending).toEqual([]);
    });

    it('should return most recent when multiple approvals exist for same task', async () => {
      const baseState = {
        taskId: 'multi-approval-task',
        gateName: 'multi-gate',
        status: 'pending' as ApprovalStatus,
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      // Create multiple approvals with different timestamps
      const approvals: ApprovalState[] = [
        { ...baseState, id: 'approval-1', requestedAt: new Date('2023-01-01T10:00:00Z') },
        { ...baseState, id: 'approval-2', requestedAt: new Date('2023-01-01T11:00:00Z') },
        { ...baseState, id: 'approval-3', requestedAt: new Date('2023-01-01T09:00:00Z') },
      ];

      for (const approval of approvals) {
        await store.saveApprovalState(approval);
      }

      // Should return the most recent (approval-2)
      const mostRecent = await store.getApprovalState('multi-approval-task');
      expect(mostRecent?.id).toBe('approval-2');
      expect(mostRecent?.requestedAt).toEqual(new Date('2023-01-01T11:00:00Z'));
    });

    it('should order pending approvals correctly by requested_at', async () => {
      const pendingApprovals: ApprovalState[] = [
        {
          id: 'pending-c',
          taskId: 'task-c',
          gateName: 'gate-c',
          status: 'pending' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T12:00:00Z'), // Latest
          approvalsReceived: 0,
          approvalsRequired: 1,
        },
        {
          id: 'pending-a',
          taskId: 'task-a',
          gateName: 'gate-a',
          status: 'pending' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T10:00:00Z'), // Earliest
          approvalsReceived: 0,
          approvalsRequired: 1,
        },
        {
          id: 'pending-b',
          taskId: 'task-b',
          gateName: 'gate-b',
          status: 'pending' as ApprovalStatus,
          requestedAt: new Date('2023-01-01T11:00:00Z'), // Middle
          approvalsReceived: 0,
          approvalsRequired: 1,
        },
      ];

      for (const approval of pendingApprovals) {
        await store.saveApprovalState(approval);
      }

      const retrieved = await store.getPendingApprovals();
      expect(retrieved).toHaveLength(3);

      // Should be ordered by requested_at ASC
      expect(retrieved[0].id).toBe('pending-a');
      expect(retrieved[1].id).toBe('pending-b');
      expect(retrieved[2].id).toBe('pending-c');
    });
  });

  describe('Status transitions', () => {
    it('should handle all valid approval status values', async () => {
      const statuses: ApprovalStatus[] = ['pending', 'approved', 'denied'];

      for (const status of statuses) {
        const approvalState: ApprovalState = {
          id: `status-${status}`,
          taskId: `task-${status}`,
          gateName: `gate-${status}`,
          status: status,
          requestedAt: new Date(),
          approvalsReceived: status === 'approved' ? 1 : 0,
          approvalsRequired: 1,
        };

        await store.saveApprovalState(approvalState);

        const retrieved = await store.getApprovalState(`task-${status}`, `status-${status}`);
        expect(retrieved?.status).toBe(status);
      }
    });

    it('should track status transitions over time', async () => {
      const baseState: ApprovalState = {
        id: 'transition-test',
        taskId: 'task-transition',
        gateName: 'transition-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date('2023-01-01T10:00:00Z'),
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      // Save initial pending state
      await store.saveApprovalState(baseState);

      // Update to approved
      const approvedState: ApprovalState = {
        ...baseState,
        status: 'approved' as ApprovalStatus,
        approver: 'reviewer@example.com',
        respondedAt: new Date('2023-01-01T10:30:00Z'),
        approvalsReceived: 1,
      };

      await store.saveApprovalState(approvedState);

      // Verify the transition was persisted
      const finalState = await store.getApprovalState('task-transition', 'transition-test');
      expect(finalState?.status).toBe('approved');
      expect(finalState?.approver).toBe('reviewer@example.com');
      expect(finalState?.respondedAt).toEqual(new Date('2023-01-01T10:30:00Z'));
      expect(finalState?.approvalsReceived).toBe(1);

      // Original requestedAt should be preserved
      expect(finalState?.requestedAt).toEqual(new Date('2023-01-01T10:00:00Z'));
    });
  });
});