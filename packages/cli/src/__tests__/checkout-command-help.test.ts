/**
 * Tests for the /checkout command help text and user guidance
 * Verifies that the command provides clear instructions and feedback
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

describe('Checkout Command Help and Guidance', () => {
  let mockContext: CliContext;
  let mockOrchestrator: any;

  beforeEach(() => {
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

  describe('Help text completeness', () => {
    it('should display comprehensive usage information when called without arguments', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, []);

      // Check that usage line is displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /checkout <task_id> | /checkout --list | /checkout --cleanup [<task_id>]')
      );

      // Check that all options are documented
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

    it('should provide clear error messages with guidance when task not found', async () => {
      mockOrchestrator.listTasks.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['nonexistent-task']);

      // Check error message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: nonexistent-task')
      );

      // Check guidance
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /status to see available tasks or provide a longer task ID.')
      );
    });

    it('should provide helpful worktree setup guidance when not enabled', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-no-worktree-123456789012',
        description: 'Test task',
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

      await checkoutCommand?.handler(mockContext, ['task-no-worktree']);

      // Check that setup instructions are provided
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To enable worktree management, add this to your .apex/config.yaml:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('git:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('autoWorktree: true')
      );
    });

    it('should provide clear next steps after successful checkout', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-success-123456789012',
        description: 'Successful checkout test',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-success',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-success-123456789012',
        path: '/tmp/apex-worktrees/task-success',
        branch: 'apex/task-success',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-success');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-success']);

      // Check success message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Switched to worktree for task task-success-1')
      );

      // Check path information
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Path: /tmp/apex-worktrees/task-success')
      );

      // Check branch information
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Branch: apex/task-success')
      );

      // Check task description
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task: Successful checkout test')
      );

      // Check next steps guidance
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To continue working on this task, change to the worktree directory:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('cd "/tmp/apex-worktrees/task-success"')
      );
    });

    it('should provide appropriate guidance when no worktrees exist', async () => {
      mockOrchestrator.listTaskWorktrees.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      // Check empty state message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No task worktrees found')
      );

      // Check guidance
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task worktrees are created automatically when worktree management is enabled')
      );
    });

    it('should provide guidance after listing worktrees', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        {
          taskId: 'task-example-123456789012',
          path: '/tmp/apex-worktrees/task-example',
          branch: 'apex/task-example',
          status: 'active',
          lastUsedAt: new Date(),
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      // Check that usage guidance is provided
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /checkout <task_id> to switch to a worktree')
      );
    });

    it('should display appropriate feedback during cleanup operations', async () => {
      const cleanedTaskIds = ['task-orphaned-1', 'task-orphaned-2'];
      mockOrchestrator.cleanupOrphanedWorktrees.mockResolvedValue(cleanedTaskIds);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      // Check cleanup start message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up orphaned worktrees')
      );

      // Check completion message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 2 orphaned worktree(s)')
      );

      // Check that specific cleaned items are listed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('task-orphaned-1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('task-orphaned-2')
      );
    });

    it('should provide informative message when no cleanup is needed', async () => {
      mockOrchestrator.cleanupOrphanedWorktrees.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      // Check that appropriate message is shown
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned worktrees found to clean up')
      );
    });

    it('should handle worktree-not-found scenario with clear messaging', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-no-worktree-123456789012',
        description: 'Task without worktree',
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

      // Check clear messaging about missing worktree
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No worktree found for task task-no-worktree-')
      );

      // Check explanation
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('This task may have been created before worktree management was enabled')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('or worktree management may not be enabled for this project')
      );
    });
  });

  describe('User experience and feedback', () => {
    it('should use appropriate emojis and visual indicators', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        {
          taskId: 'task-visual-test-123456789012',
          path: '/tmp/apex-worktrees/task-visual',
          branch: 'apex/task-visual',
          status: 'active',
          lastUsedAt: new Date(),
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      const allLogCalls = mockConsoleLog.mock.calls.flat();

      // Check for visual indicators
      const hasFileEmoji = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('📁')
      );
      expect(hasFileEmoji).toBe(true);

      // Check for status indicators
      const hasStatusEmoji = allLogCalls.some(call =>
        typeof call === 'string' && (call.includes('✅') || call.includes('⚠️') || call.includes('❌'))
      );
      expect(hasStatusEmoji).toBe(true);
    });

    it('should provide context about current operation during cleanup', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-cleanup-context-123456789012',
        description: 'Cleanup context test',
        status: 'completed',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.cleanupTaskWorktree.mockResolvedValue(true);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup', 'task-cleanup-context']);

      // Check that operation is clearly described
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up worktree for task task-cleanup-context')
      );

      // Check success feedback with context
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Worktree for task task-cleanup-con cleaned up successfully')
      );

      // Check that task description is provided for context
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task: Cleanup context test')
      );
    });

    it('should format output consistently across all subcommands', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test help formatting
      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, []);

      const helpCalls = mockConsoleLog.mock.calls.flat();
      const hasConsistentFormatting = helpCalls.some(call =>
        typeof call === 'string' && call.includes('Usage:')
      );
      expect(hasConsistentFormatting).toBe(true);

      // Test list formatting
      mockOrchestrator.listTaskWorktrees.mockResolvedValue([]);
      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, ['--list']);

      const listCalls = mockConsoleLog.mock.calls.flat();
      const hasConsistentListFormatting = listCalls.some(call =>
        typeof call === 'string' && call.includes('📁')
      );
      expect(hasConsistentListFormatting).toBe(true);

      // Test cleanup formatting
      mockOrchestrator.cleanupOrphanedWorktrees.mockResolvedValue([]);
      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      const cleanupCalls = mockConsoleLog.mock.calls.flat();
      const hasConsistentCleanupFormatting = cleanupCalls.some(call =>
        typeof call === 'string' && call.includes('🧹')
      );
      expect(hasConsistentCleanupFormatting).toBe(true);
    });
  });

  describe('Error messaging quality', () => {
    it('should provide actionable error messages', async () => {
      mockOrchestrator.listTasks.mockRejectedValue(new Error('Database connection failed'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['test-task']);

      // Check that error is clearly displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Database connection failed')
      );
    });

    it('should handle initialization errors gracefully', async () => {
      const uninitializedContext = {
        ...mockContext,
        initialized: false,
        orchestrator: null,
      };

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(uninitializedContext, ['test-task']);

      // Check clear initialization message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });
  });
});