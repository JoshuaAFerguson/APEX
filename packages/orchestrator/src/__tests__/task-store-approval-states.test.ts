/**
 * Unit tests for approval state persistence in TaskStore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskStore } from '../store.js';
import { ApprovalState, ApprovalStatus } from '@apexcli/core';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Mock better-sqlite3
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();

const mockDb = {
  pragma: vi.fn(),
  exec: vi.fn(),
  prepare: vi.fn(() => ({
    run: mockRun,
    get: mockGet,
    all: mockAll,
  })),
  close: vi.fn(),
};

vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => mockDb),
}));

// Mock fs
vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
    },
  };
  return { ...mock, default: mock };
});

// Mock path
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/')),
  };
});

// Create mock approval state data
const createMockApprovalState = (overrides: Partial<ApprovalState> = {}): ApprovalState => ({
  id: 'approval-123',
  taskId: 'task-123',
  gateName: 'test-gate',
  status: 'pending' as ApprovalStatus,
  requestedAt: new Date('2023-01-01T10:00:00Z'),
  approvalsReceived: 0,
  approvalsRequired: 1,
  ...overrides,
});

describe('TaskStore - Approval State Persistence', () => {
  let store: TaskStore;
  const mockProjectPath = '/test/project';

  beforeEach(async () => {
    vi.clearAllMocks();
    store = new TaskStore(mockProjectPath);
    await store.initialize();
  });

  afterEach(() => {
    store.close();
  });

  describe('saveApprovalState', () => {
    it('should save an approval state to the database', async () => {
      const approvalState = createMockApprovalState({
        id: 'approval-456',
        taskId: 'task-123',
        gateName: 'before-deploy',
        status: 'pending',
        approver: 'admin@example.com',
        comment: 'Review required for deployment',
        context: { deployment: 'Production deployment context' },
        stage: 'deployment',
        agent: 'devops-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        expiresAt: new Date('2023-01-01T11:00:00Z'),
      });

      mockRun.mockReturnValue({ changes: 1 });

      await store.saveApprovalState(approvalState);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO approval_states')
      );
      expect(mockRun).toHaveBeenCalledWith({
        id: 'approval-456',
        taskId: 'task-123',
        gateName: 'before-deploy',
        status: 'pending',
        approver: 'admin@example.com',
        requestedAt: '2023-01-01T10:00:00.000Z',
        respondedAt: null,
        comment: 'Review required for deployment',
        context: JSON.stringify({ deployment: 'Production deployment context' }),
        stage: 'deployment',
        agent: 'devops-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: null,
        expiresAt: '2023-01-01T11:00:00.000Z',
      });
    });

    it('should handle approval state with minimal required fields', async () => {
      const approvalState = createMockApprovalState({
        id: 'minimal-approval',
        taskId: 'task-minimal',
        gateName: 'basic-gate',
        status: 'approved',
        requestedAt: new Date('2023-01-01T10:00:00Z'),
      });

      mockRun.mockReturnValue({ changes: 1 });

      await store.saveApprovalState(approvalState);

      expect(mockRun).toHaveBeenCalledWith({
        id: 'minimal-approval',
        taskId: 'task-minimal',
        gateName: 'basic-gate',
        status: 'approved',
        approver: null,
        requestedAt: '2023-01-01T10:00:00.000Z',
        respondedAt: null,
        comment: null,
        context: null,
        stage: null,
        agent: null,
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: null,
        expiresAt: null,
      });
    });
  });

  describe('getApprovalState', () => {
    it('should retrieve an approval state by task ID and approval ID', async () => {
      const taskId = 'task-123';
      const approvalId = 'approval-456';
      const mockRow = {
        id: 'approval-456',
        task_id: 'task-123',
        gate_name: 'before-deploy',
        status: 'approved',
        approver: 'admin@example.com',
        requested_at: '2023-01-01T10:00:00.000Z',
        responded_at: '2023-01-01T10:30:00.000Z',
        comment: 'Approved after review',
        context: '{"environment":"production"}',
        stage: 'deployment',
        agent: 'devops-agent',
        approvals_received: 1,
        approvals_required: 1,
        timeout_minutes: 60,
        expires_at: '2023-01-01T11:00:00.000Z',
      };

      mockGet.mockReturnValue(mockRow);

      const result = await store.getApprovalState(taskId, approvalId);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM approval_states WHERE task_id = ? AND id = ?'
      );
      expect(mockGet).toHaveBeenCalledWith(taskId, approvalId);
      expect(result).toEqual({
        id: 'approval-456',
        taskId: 'task-123',
        gateName: 'before-deploy',
        status: 'approved',
        approver: 'admin@example.com',
        requestedAt: new Date('2023-01-01T10:00:00.000Z'),
        respondedAt: new Date('2023-01-01T10:30:00.000Z'),
        comment: 'Approved after review',
        context: { environment: 'production' },
        stage: 'deployment',
        agent: 'devops-agent',
        approvalsReceived: 1,
        approvalsRequired: 1,
        timeoutMinutes: 60,
        expiresAt: new Date('2023-01-01T11:00:00.000Z'),
      });
    });

    it('should retrieve most recent approval state when no approval ID provided', async () => {
      const taskId = 'task-123';
      const mockRow = {
        id: 'latest-approval',
        task_id: 'task-123',
        gate_name: 'latest-gate',
        status: 'pending',
        approver: null,
        requested_at: '2023-01-01T12:00:00.000Z',
        responded_at: null,
        comment: null,
        context: null,
        stage: 'planning',
        agent: 'planning-agent',
        approvals_received: 0,
        approvals_required: 1,
        timeout_minutes: null,
        expires_at: null,
      };

      mockGet.mockReturnValue(mockRow);

      const result = await store.getApprovalState(taskId);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY requested_at DESC LIMIT 1')
      );
      expect(mockGet).toHaveBeenCalledWith(taskId);
      expect(result).toEqual({
        id: 'latest-approval',
        taskId: 'task-123',
        gateName: 'latest-gate',
        status: 'pending',
        approver: undefined,
        requestedAt: new Date('2023-01-01T12:00:00.000Z'),
        respondedAt: undefined,
        comment: undefined,
        context: undefined,
        stage: 'planning',
        agent: 'planning-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: undefined,
        expiresAt: undefined,
      });
    });

    it('should return null when approval state not found', async () => {
      mockGet.mockReturnValue(undefined);

      const result = await store.getApprovalState('non-existent-task', 'non-existent-approval');

      expect(result).toBeNull();
    });
  });

  describe('getPendingApprovals', () => {
    it('should retrieve all pending approval states', async () => {
      const mockRows = [
        {
          id: 'pending-1',
          task_id: 'task-1',
          gate_name: 'gate-1',
          status: 'pending',
          approver: null,
          requested_at: '2023-01-01T10:00:00.000Z',
          responded_at: null,
          comment: null,
          context: '{"name":"Context 1"}',
          stage: 'planning',
          agent: 'agent-1',
          approvals_received: 0,
          approvals_required: 1,
          timeout_minutes: 60,
          expires_at: '2023-01-01T11:00:00.000Z',
        },
        {
          id: 'pending-2',
          task_id: 'task-2',
          gate_name: 'gate-2',
          status: 'pending',
          approver: null,
          requested_at: '2023-01-01T10:30:00.000Z',
          responded_at: null,
          comment: null,
          context: null,
          stage: 'development',
          agent: 'agent-2',
          approvals_received: 0,
          approvals_required: 2,
          timeout_minutes: null,
          expires_at: null,
        },
      ];

      mockAll.mockReturnValue(mockRows);

      const result = await store.getPendingApprovals();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'pending' ORDER BY requested_at ASC")
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'pending-1',
        taskId: 'task-1',
        gateName: 'gate-1',
        status: 'pending',
        approver: undefined,
        requestedAt: new Date('2023-01-01T10:00:00.000Z'),
        respondedAt: undefined,
        comment: undefined,
        context: { name: 'Context 1' },
        stage: 'planning',
        agent: 'agent-1',
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: 60,
        expiresAt: new Date('2023-01-01T11:00:00.000Z'),
      });
      expect(result[1]).toEqual({
        id: 'pending-2',
        taskId: 'task-2',
        gateName: 'gate-2',
        status: 'pending',
        approver: undefined,
        requestedAt: new Date('2023-01-01T10:30:00.000Z'),
        respondedAt: undefined,
        comment: undefined,
        context: undefined,
        stage: 'development',
        agent: 'agent-2',
        approvalsReceived: 0,
        approvalsRequired: 2,
        timeoutMinutes: undefined,
        expiresAt: undefined,
      });
    });

    it('should return empty array when no pending approvals', async () => {
      mockAll.mockReturnValue([]);

      const result = await store.getPendingApprovals();

      expect(result).toEqual([]);
    });
  });

  describe('Database persistence across restarts', () => {
    it('should persist approval state after process restart simulation', async () => {
      const taskId = 'persistence-test-task';
      const approvalState = createMockApprovalState({
        id: 'persistent-approval',
        taskId: 'persistence-test-task',
        gateName: 'critical-gate',
        status: 'pending',
        requestedAt: new Date('2023-01-01T10:00:00Z'),
      });

      // Save approval state
      mockRun.mockReturnValue({ changes: 1 });
      await store.saveApprovalState(approvalState);

      // Simulate process restart - close and reinitialize
      store.close();

      // Clear mocks and setup retrieval mock
      vi.clearAllMocks();
      const newStore = new TaskStore(mockProjectPath);
      await newStore.initialize();

      // Mock the retrieval
      const mockRow = {
        id: 'persistent-approval',
        task_id: 'persistence-test-task',
        gate_name: 'critical-gate',
        status: 'pending',
        approver: null,
        requested_at: '2023-01-01T10:00:00.000Z',
        responded_at: null,
        comment: null,
        context: null,
        stage: null,
        agent: null,
        approvals_received: 0,
        approvals_required: 1,
        timeout_minutes: null,
        expires_at: null,
      };
      mockGet.mockReturnValue(mockRow);

      // Retrieve approval state after "restart"
      const retrieved = await newStore.getApprovalState(taskId, 'persistent-approval');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('persistent-approval');
      expect(retrieved?.gateName).toBe('critical-gate');
      expect(retrieved?.status).toBe('pending');

      newStore.close();
    });
  });

  describe('getApprovalStatesByTask', () => {
    it('should retrieve all approval states for a specific task', async () => {
      const taskId = 'task-with-multiple-approvals';
      const approvalStates = [
        createMockApprovalState('approval-1', taskId, 'gate-1', 'pending'),
        createMockApprovalState('approval-2', taskId, 'gate-2', 'approved'),
        createMockApprovalState('approval-3', taskId, 'gate-3', 'denied')
      ];

      // Save all approval states
      for (const state of approvalStates) {
        await store.saveApprovalState(state);
      }

      const results = await store.getApprovalStatesByTask(taskId);

      expect(results).toHaveLength(3);
      expect(results.map(r => r.id).sort()).toEqual(['approval-1', 'approval-2', 'approval-3']);
      expect(results.map(r => r.status)).toEqual(['pending', 'approved', 'denied']);
    });

    it('should return empty array for task with no approval states', async () => {
      const results = await store.getApprovalStatesByTask('non-existent-task');
      expect(results).toEqual([]);
    });
  });

  describe('updateApprovalState', () => {
    it('should update specific fields of an approval state', async () => {
      const originalState = createMockApprovalState('update-test', 'task-update', 'test-gate', 'pending');
      await store.saveApprovalState(originalState);

      // Update status and add approver
      const respondedAt = new Date();
      await store.updateApprovalState('update-test', {
        status: 'approved',
        approver: 'john.doe',
        respondedAt,
        comment: 'Looks good!'
      });

      const updatedState = await store.getApprovalState('task-update', 'update-test');
      expect(updatedState).toBeDefined();
      expect(updatedState!.status).toBe('approved');
      expect(updatedState!.approver).toBe('john.doe');
      expect(updatedState!.respondedAt).toEqual(respondedAt);
      expect(updatedState!.comment).toBe('Looks good!');
      // Original fields should remain unchanged
      expect(updatedState!.gateName).toBe('test-gate');
      expect(updatedState!.taskId).toBe('task-update');
    });

    it('should handle partial updates', async () => {
      const originalState = createMockApprovalState('partial-update', 'task-partial', 'test-gate', 'pending');
      await store.saveApprovalState(originalState);

      // Update only status
      await store.updateApprovalState('partial-update', {
        status: 'denied'
      });

      const updatedState = await store.getApprovalState('task-partial', 'partial-update');
      expect(updatedState!.status).toBe('denied');
      // Other fields should remain unchanged
      expect(updatedState!.approver).toBeUndefined();
      expect(updatedState!.comment).toBeUndefined();
    });

    it('should handle empty updates gracefully', async () => {
      const originalState = createMockApprovalState('empty-update', 'task-empty', 'test-gate', 'pending');
      await store.saveApprovalState(originalState);

      // Empty update should not throw
      await expect(store.updateApprovalState('empty-update', {})).resolves.not.toThrow();

      const unchangedState = await store.getApprovalState('task-empty', 'empty-update');
      expect(unchangedState!.status).toBe('pending');
    });
  });

  describe('deleteApprovalState', () => {
    it('should delete an approval state', async () => {
      const state = createMockApprovalState('delete-test', 'task-delete', 'test-gate', 'pending');
      await store.saveApprovalState(state);

      // Verify it exists
      let retrieved = await store.getApprovalState('task-delete', 'delete-test');
      expect(retrieved).toBeDefined();

      // Delete it
      await store.deleteApprovalState('delete-test');

      // Verify it's gone
      retrieved = await store.getApprovalState('task-delete', 'delete-test');
      expect(retrieved).toBeNull();
    });

    it('should handle deletion of non-existent approval state gracefully', async () => {
      await expect(store.deleteApprovalState('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getApprovalStatesByGate', () => {
    it('should retrieve approval states by gate name', async () => {
      const gateName = 'deployment-gate';
      const states = [
        createMockApprovalState('gate-1', 'task-1', gateName, 'pending'),
        createMockApprovalState('gate-2', 'task-2', gateName, 'approved'),
        createMockApprovalState('gate-3', 'task-3', 'other-gate', 'pending') // Different gate
      ];

      for (const state of states) {
        await store.saveApprovalState(state);
      }

      const results = await store.getApprovalStatesByGate(gateName);
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id).sort()).toEqual(['gate-1', 'gate-2']);
    });

    it('should filter by both gate name and task ID', async () => {
      const gateName = 'review-gate';
      const taskId = 'specific-task';
      const states = [
        createMockApprovalState('gate-1', taskId, gateName, 'pending'),
        createMockApprovalState('gate-2', 'other-task', gateName, 'approved'), // Different task
        createMockApprovalState('gate-3', taskId, 'other-gate', 'pending') // Different gate
      ];

      for (const state of states) {
        await store.saveApprovalState(state);
      }

      const results = await store.getApprovalStatesByGate(gateName, taskId);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('gate-1');
      expect(results[0].taskId).toBe(taskId);
    });
  });

  describe('getExpiredApprovals', () => {
    it('should retrieve expired pending approvals', async () => {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - 60000); // 1 minute ago
      const futureTime = new Date(now.getTime() + 60000); // 1 minute from now

      const states = [
        {
          ...createMockApprovalState('expired-1', 'task-1', 'gate-1', 'pending'),
          expiresAt: expiredTime
        },
        {
          ...createMockApprovalState('expired-2', 'task-2', 'gate-2', 'pending'),
          expiresAt: expiredTime
        },
        {
          ...createMockApprovalState('not-expired', 'task-3', 'gate-3', 'pending'),
          expiresAt: futureTime
        },
        {
          ...createMockApprovalState('expired-but-approved', 'task-4', 'gate-4', 'approved'),
          expiresAt: expiredTime
        }
      ];

      for (const state of states) {
        await store.saveApprovalState(state);
      }

      const results = await store.getExpiredApprovals();
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id).sort()).toEqual(['expired-1', 'expired-2']);
      expect(results.every(r => r.status === 'pending')).toBe(true);
      expect(results.every(r => r.expiresAt && r.expiresAt < now)).toBe(true);
    });

    it('should return empty array when no approvals are expired', async () => {
      const futureTime = new Date(Date.now() + 60000);
      const state = {
        ...createMockApprovalState('future-approval', 'task-future', 'gate-future', 'pending'),
        expiresAt: futureTime
      };

      await store.saveApprovalState(state);

      const results = await store.getExpiredApprovals();
      expect(results).toEqual([]);
    });
  });

  describe('getApprovalStateById', () => {
    it('should retrieve approval state by ID only', async () => {
      const approvalState = createMockApprovalState('direct-id-test', 'task-direct', 'test-gate', 'pending');
      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalStateById('direct-id-test');

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('direct-id-test');
      expect(retrieved!.taskId).toBe('task-direct');
      expect(retrieved!.gateName).toBe('test-gate');
      expect(retrieved!.status).toBe('pending');
    });

    it('should return null for non-existent approval ID', async () => {
      const result = await store.getApprovalStateById('non-existent-approval');
      expect(result).toBeNull();
    });
  });
});