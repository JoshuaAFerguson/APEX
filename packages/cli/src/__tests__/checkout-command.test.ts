/**
 * Unit tests for the /checkout command functionality
 * Tests the worktree switching, listing, and cleanup features
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import type { CliContext } from '../index.js';
import type { Task, WorktreeInfo } from '@apexcli/core';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    cyan: (str: string) => str,
    bold: (str: string) => str,
    magenta: { bold: (str: string) => str },
  },
}));

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('Checkout Command', () => {
  let mockContext: CliContext;
  let mockOrchestrator: any;

  beforeEach(() => {
    // Create mock orchestrator
    mockOrchestrator = {
      listTasks: vi.fn(),
      getTaskWorktree: vi.fn(),
      switchToTaskWorktree: vi.fn(),
      listTaskWorktrees: vi.fn(),
      cleanupOrphanedWorktrees: vi.fn(),
      cleanupTaskWorktree: vi.fn(),
    };

    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: {
          name: 'Test Project',
          description: 'Test project',
        },
        agents: {},
        workflows: {},
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          timeoutMs: 300000,
        },
        autonomy: {
          default: 'medium',
          autoApprove: false,
        },
        api: {
          url: 'http://localhost:3000',
          port: 3000,
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
      },
      orchestrator: mockOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Command registration', () => {
    it('should have checkout command registered with correct properties', async () => {
      const { commands } = await import('../index.js');

      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      expect(checkoutCommand).toBeDefined();
      expect(checkoutCommand?.name).toBe('checkout');
      expect(checkoutCommand?.aliases).toEqual(['co']);
      expect(checkoutCommand?.description).toBe('Switch to task worktree or manage worktrees');
      expect(checkoutCommand?.usage).toBe('/checkout <task_id> | /checkout --list | /checkout --cleanup [<task_id>]');
    });

    it('should be accessible via alias "co"', async () => {
      const { commands } = await import('../index.js');

      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');
      expect(checkoutCommand?.aliases).toContain('co');
    });
  });

  describe('Task worktree switching', () => {
    it('should switch to task worktree when task exists', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-full-id-123456789012',
        description: 'Add login form',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-abc123-login-form',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-full-id-123456789012',
        path: '/tmp/apex-worktrees/task-abc123-login-form',
        branch: 'apex/task-abc123-login-form',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-abc123-login-form');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-full-id']);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 100 });
      expect(mockOrchestrator.getTaskWorktree).toHaveBeenCalledWith('task-full-id-123456789012');
      expect(mockOrchestrator.switchToTaskWorktree).toHaveBeenCalledWith('task-full-id-123456789012');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Switched to worktree for task task-full-id')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Path: /tmp/apex-worktrees/task-abc123-login-form')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Branch: apex/task-abc123-login-form')
      );
    });

    it('should handle task not found', async () => {
      mockOrchestrator.listTasks.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: nonexistent')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /status to see available tasks')
      );
    });

    it('should handle task without worktree', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-no-worktree-123456789012',
        description: 'Legacy task',
        status: 'completed',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(null);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-no-worktree']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No worktree found for task task-no-worktree')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('This task may have been created before worktree management was enabled')
      );
    });

    it('should handle worktree switching errors', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-error-123456789012',
        description: 'Error task',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-error-123456789012',
        path: '/tmp/apex-worktrees/task-error',
        branch: 'apex/task-error',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockRejectedValue(new Error('Failed to switch worktree'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-error']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Failed to switch worktree')
      );
    });

    it('should handle worktree not enabled error', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-not-enabled-123456789012',
        description: 'No worktree task',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(null);
      mockOrchestrator.switchToTaskWorktree.mockRejectedValue(new Error('Worktree management not enabled'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-not-enabled']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To enable worktree management')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('git:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('autoWorktree: true')
      );
    });
  });

  describe('List worktrees', () => {
    it('should list all task worktrees', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        {
          taskId: 'task-1-123456789012',
          path: '/tmp/apex-worktrees/task-1',
          branch: 'apex/task-1-feature',
          status: 'active',
          lastUsedAt: new Date('2023-01-01T10:00:00Z'),
        },
        {
          taskId: 'task-2-123456789012',
          path: '/tmp/apex-worktrees/task-2',
          branch: 'apex/task-2-bugfix',
          status: 'stale',
          lastUsedAt: new Date('2023-01-02T12:00:00Z'),
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      expect(mockOrchestrator.listTaskWorktrees).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task Worktrees (2)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('task-1-123456')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('apex/task-1-feature')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('apex/task-2-bugfix')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /checkout <task_id> to switch to a worktree')
      );
    });

    it('should handle empty worktrees list', async () => {
      mockOrchestrator.listTaskWorktrees.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No task worktrees found')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task worktrees are created automatically when worktree management is enabled')
      );
    });
  });

  describe('Cleanup orphaned worktrees', () => {
    it('should clean up orphaned worktrees successfully', async () => {
      const cleanedTaskIds = ['task-1-orphaned', 'task-2-orphaned'];
      mockOrchestrator.cleanupOrphanedWorktrees.mockResolvedValue(cleanedTaskIds);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      expect(mockOrchestrator.cleanupOrphanedWorktrees).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up orphaned worktrees')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 2 orphaned worktree(s)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('task-1-orphaned')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('task-2-orphaned')
      );
    });

    it('should handle no orphaned worktrees', async () => {
      mockOrchestrator.cleanupOrphanedWorktrees.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned worktrees found to clean up')
      );
    });
  });

  describe('Cleanup specific task worktree', () => {
    it('should clean up worktree for specific task successfully', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-cleanup-123456789012',
        description: 'Task to cleanup',
        status: 'completed',
        workflow: 'feature',
        branchName: 'apex/task-cleanup',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.cleanupTaskWorktree.mockResolvedValue(true);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup', 'task-cleanup']);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 100 });
      expect(mockOrchestrator.cleanupTaskWorktree).toHaveBeenCalledWith('task-cleanup-123456789012');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up worktree for task task-cleanup')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Worktree for task task-cleanup cleaned up successfully')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task: Task to cleanup')
      );
    });

    it('should handle task not found for specific cleanup', async () => {
      mockOrchestrator.listTasks.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: nonexistent')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /status to see available tasks')
      );
      expect(mockOrchestrator.cleanupTaskWorktree).not.toHaveBeenCalled();
    });

    it('should handle cleanup failure for specific task', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-cleanup-fail-123456789012',
        description: 'Task cleanup fail',
        status: 'failed',
        workflow: 'feature',
        branchName: 'apex/task-cleanup-fail',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.cleanupTaskWorktree.mockResolvedValue(false);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup', 'task-cleanup-fail']);

      expect(mockOrchestrator.cleanupTaskWorktree).toHaveBeenCalledWith('task-cleanup-fail-123456789012');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No worktree found for task task-cleanup-fa or cleanup failed')
      );
    });

    it('should handle cleanup error for specific task', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-cleanup-error-123456789012',
        description: 'Task cleanup error',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-cleanup-error',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.cleanupTaskWorktree.mockRejectedValue(new Error('Cleanup failed'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup', 'task-cleanup-error']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup worktree: Cleanup failed')
      );
    });

    it('should handle partial task ID matching for cleanup', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-partial-cleanup-123456789012',
        description: 'Partial ID cleanup test',
        status: 'completed',
        workflow: 'feature',
        branchName: 'apex/task-partial-cleanup',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.cleanupTaskWorktree.mockResolvedValue(true);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup', 'task-partial']);

      expect(mockOrchestrator.cleanupTaskWorktree).toHaveBeenCalledWith('task-partial-cleanup-123456789012');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Worktree for task task-partial- cleaned up successfully')
      );
    });

    it('should handle worktree not enabled error for specific cleanup', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-not-enabled-123456789012',
        description: 'Worktree not enabled test',
        status: 'completed',
        workflow: 'feature',
        branchName: 'apex/task-not-enabled',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.cleanupTaskWorktree.mockRejectedValue(new Error('Worktree management is not enabled'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup', 'task-not-enabled']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup worktree: Worktree management is not enabled')
      );
    });
  });

  describe('Error handling', () => {
    it('should handle uninitialized context', async () => {
      const uninitializedContext = { ...mockContext, initialized: false, orchestrator: null };

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(uninitializedContext, ['task-123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });

    it('should handle missing orchestrator', async () => {
      const contextWithoutOrchestrator = { ...mockContext, orchestrator: null };

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(contextWithoutOrchestrator, ['task-123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });

    it('should handle no arguments', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /checkout <task_id> | /checkout --list | /checkout --cleanup [<task_id>]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('<task_id>           Switch to the worktree for the specified task')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('--list              List all task worktrees')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('--cleanup           Remove orphaned/stale worktrees')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('--cleanup <task_id> Remove worktree for specific task')
      );
    });

    it('should handle general errors with helpful suggestions', async () => {
      mockOrchestrator.listTasks.mockRejectedValue(new Error('Database error'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Database error')
      );
    });
  });

  describe('Partial task ID matching', () => {
    it('should match task with partial ID', async () => {
      const mockTasks: Partial<Task>[] = [
        {
          id: 'task-abc123def456789',
          description: 'First task',
          status: 'in-progress',
          workflow: 'feature',
          createdAt: new Date(),
          usage: { totalTokens: 0, estimatedCost: 0 },
          logs: [],
        },
        {
          id: 'task-xyz789abc123456',
          description: 'Second task',
          status: 'completed',
          workflow: 'bugfix',
          createdAt: new Date(),
          usage: { totalTokens: 0, estimatedCost: 0 },
          logs: [],
        },
      ];

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-abc123def456789',
        path: '/tmp/apex-worktrees/task-abc123',
        branch: 'apex/task-abc123-first',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-abc123');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test matching with partial ID
      await checkoutCommand?.handler(mockContext, ['task-abc123']);

      expect(mockOrchestrator.switchToTaskWorktree).toHaveBeenCalledWith('task-abc123def456789');
    });

    it('should handle ambiguous partial ID', async () => {
      const mockTasks: Partial<Task>[] = [
        {
          id: 'task-abc123def456789',
          description: 'First task',
          status: 'in-progress',
          workflow: 'feature',
          createdAt: new Date(),
          usage: { totalTokens: 0, estimatedCost: 0 },
          logs: [],
        },
        {
          id: 'task-abc123xyz789456',
          description: 'Second task',
          status: 'completed',
          workflow: 'bugfix',
          createdAt: new Date(),
          usage: { totalTokens: 0, estimatedCost: 0 },
          logs: [],
        },
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // The implementation uses the first match, so this should still work
      await checkoutCommand?.handler(mockContext, ['task-abc123']);

      // Should find the first matching task
      expect(mockOrchestrator.getTaskWorktree).toHaveBeenCalledWith('task-abc123def456789');
    });
  });

  describe('Integration scenarios', () => {
    it('should provide helpful guidance after successful checkout', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-integration-123456789012',
        description: 'Integration test task',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-integration',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-integration-123456789012',
        path: '/tmp/apex-worktrees/task-integration',
        branch: 'apex/task-integration',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-integration');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-integration']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To continue working on this task, change to the worktree directory:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('cd "/tmp/apex-worktrees/task-integration"')
      );
    });

    it('should handle various worktree statuses in list view', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        {
          taskId: 'task-active-123456789012',
          path: '/tmp/apex-worktrees/task-active',
          branch: 'apex/task-active',
          status: 'active',
          lastUsedAt: new Date(),
        },
        {
          taskId: 'task-stale-123456789012',
          path: '/tmp/apex-worktrees/task-stale',
          branch: 'apex/task-stale',
          status: 'stale',
          lastUsedAt: new Date(Date.now() - 86400000), // 1 day ago
        },
        {
          taskId: 'task-broken-123456789012',
          path: '/tmp/apex-worktrees/task-broken',
          branch: 'apex/task-broken',
          status: 'broken',
          lastUsedAt: new Date(Date.now() - 172800000), // 2 days ago
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task Worktrees (3)')
      );

      // Should show all three worktrees with their statuses
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('task-active-12')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('task-stale-123')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('task-broken-12')
      );
    });

    it('should handle time formatting in worktree listing', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneDayAgo = new Date(now.getTime() - 86400000);

      const mockWorktrees: WorktreeInfo[] = [
        {
          taskId: 'task-recent-123456789012',
          path: '/tmp/apex-worktrees/task-recent',
          branch: 'apex/task-recent',
          status: 'active',
          lastUsedAt: oneHourAgo,
        },
        {
          taskId: 'task-old-123456789012',
          path: '/tmp/apex-worktrees/task-old',
          branch: 'apex/task-old',
          status: 'stale',
          lastUsedAt: oneDayAgo,
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      // Should show relative time formatting
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Last used:')
      );
    });
  });
});