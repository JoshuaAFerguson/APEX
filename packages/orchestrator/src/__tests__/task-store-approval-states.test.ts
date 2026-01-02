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
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

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
});