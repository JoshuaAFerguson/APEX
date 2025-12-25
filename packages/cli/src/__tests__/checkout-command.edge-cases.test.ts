/**
 * Edge case and error handling tests for the /checkout command
 * Tests boundary conditions, error scenarios, and robustness
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

describe('Checkout Command Edge Cases', () => {
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
    };

    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: { name: 'Test Project', description: 'Test project' },
        agents: {},
        workflows: {},
        limits: { maxTokensPerTask: 100000, maxCostPerTask: 10.0, dailyBudget: 100.0, timeoutMs: 300000 },
        autonomy: { default: 'medium', autoApprove: false },
        api: { url: 'http://localhost:3000', port: 3000 },
        models: { planning: 'opus', implementation: 'sonnet', review: 'haiku' },
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

  describe('Null and undefined handling', () => {
    it('should handle null orchestrator response', async () => {
      mockOrchestrator.listTasks.mockResolvedValue(null);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: task-123')
      );
    });

    it('should handle undefined task properties', async () => {
      const mockTask = {
        id: 'task-undefined-props-123',
        description: undefined, // undefined description
        status: 'in-progress',
        workflow: undefined, // undefined workflow
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(null);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-undefined']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No worktree found for task')
      );
    });

    it('should handle null worktree properties', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-null-worktree-123',
        description: 'Task with null worktree',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-null-worktree-123',
        path: null as any, // null path
        branch: 'apex/test-branch',
        status: 'broken',
        lastUsedAt: null as any, // null lastUsedAt
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockRejectedValue(new Error('Invalid path'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-null-worktree']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Invalid path')
      );
    });
  });

  describe('Extreme values and boundary conditions', () => {
    it('should handle extremely long task IDs', async () => {
      const longTaskId = 'task-' + 'a'.repeat(1000); // Very long ID

      mockOrchestrator.listTasks.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, [longTaskId]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found:')
      );
    });

    it('should handle extremely short task IDs', async () => {
      const shortTaskId = 'a'; // Single character

      mockOrchestrator.listTasks.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, [shortTaskId]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: a')
      );
    });

    it('should handle special characters in task IDs', async () => {
      const specialCharTaskId = 'task-!@#$%^&*()_+-={}[]|\\:";\'<>?,./';

      mockOrchestrator.listTasks.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, [specialCharTaskId]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found:')
      );
    });

    it('should handle Unicode characters in task IDs', async () => {
      const unicodeTaskId = 'task-🚀🌟💻🔧';

      mockOrchestrator.listTasks.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, [unicodeTaskId]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found:')
      );
    });

    it('should handle very large number of worktrees', async () => {
      const largeWorktreeList: WorktreeInfo[] = Array.from({ length: 1000 }, (_, i) => ({
        taskId: `task-large-${i}-123456789012`,
        path: `/tmp/apex-worktrees/task-${i}`,
        branch: `apex/task-${i}`,
        status: i % 4 === 0 ? 'active' : i % 4 === 1 ? 'stale' : i % 4 === 2 ? 'broken' : 'prunable',
        lastUsedAt: new Date(Date.now() - i * 1000),
      }));

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(largeWorktreeList);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      const startTime = Date.now();
      await checkoutCommand?.handler(mockContext, ['--list']);
      const endTime = Date.now();

      // Should handle large lists efficiently (within reasonable time)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task Worktrees (1000)')
      );
    });
  });

  describe('Network and I/O error simulation', () => {
    it('should handle timeout errors', async () => {
      mockOrchestrator.listTasks.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-timeout']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Request timeout')
      );
    });

    it('should handle database connection errors', async () => {
      mockOrchestrator.listTasks.mockRejectedValue(new Error('SQLITE_BUSY: database is locked'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-db-error']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: SQLITE_BUSY: database is locked')
      );
    });

    it('should handle permission denied errors', async () => {
      mockOrchestrator.switchToTaskWorktree.mockRejectedValue(new Error('EACCES: permission denied'));

      const mockTask: Partial<Task> = {
        id: 'task-permission-123456789012',
        description: 'Permission test',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-permission-123456789012',
        path: '/root/restricted',
        branch: 'apex/test',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-permission']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: EACCES: permission denied')
      );
    });

    it('should handle disk full errors', async () => {
      mockOrchestrator.cleanupOrphanedWorktrees.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: ENOSPC: no space left on device')
      );
    });
  });

  describe('Malformed data handling', () => {
    it('should handle corrupted task data', async () => {
      const corruptedTask = {
        id: 'task-corrupted-123',
        // Missing required fields
        description: null,
        status: 'invalid-status',
        workflow: '',
        createdAt: 'not-a-date',
        usage: null,
        logs: undefined,
      };

      mockOrchestrator.listTasks.mockResolvedValue([corruptedTask]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-corrupted']);

      // Should handle gracefully and either find/not find the task
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No worktree found for task') ||
        expect.stringContaining('Error:')
      );
    });

    it('should handle malformed worktree data', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-malformed-worktree-123456789012',
        description: 'Malformed worktree test',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const malformedWorktree = {
        taskId: undefined,
        path: '',
        branch: null,
        status: 'unknown-status',
        lastUsedAt: 'invalid-date',
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(malformedWorktree);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-malformed']);

      // Should handle the malformed data gracefully
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle empty arrays and objects', async () => {
      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.listTaskWorktrees.mockResolvedValue([]);
      mockOrchestrator.cleanupOrphanedWorktrees.mockResolvedValue([]);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test all subcommands with empty data
      await checkoutCommand?.handler(mockContext, ['nonexistent-task']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: nonexistent-task')
      );

      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, ['--list']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No task worktrees found')
      );

      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, ['--cleanup']);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned worktrees found to clean up')
      );
    });
  });

  describe('Race conditions and concurrency', () => {
    it('should handle task deletion during checkout', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-race-condition-123456789012',
        description: 'Race condition test',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      // First call returns task, second call (during checkout) returns empty
      mockOrchestrator.listTasks
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([]);

      mockOrchestrator.getTaskWorktree.mockRejectedValue(new Error('Task not found'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-race-condition']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Task not found')
      );
    });

    it('should handle worktree modification during operation', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-modification-123456789012',
        description: 'Modification test',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-modification-123456789012',
        path: '/tmp/apex-worktrees/task-modification',
        branch: 'apex/task-modification',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockRejectedValue(new Error('Worktree was modified during operation'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-modification']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Worktree was modified during operation')
      );
    });

    it('should handle concurrent cleanup operations', async () => {
      mockOrchestrator.cleanupOrphanedWorktrees.mockRejectedValue(new Error('Another cleanup operation is in progress'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Another cleanup operation is in progress')
      );
    });
  });

  describe('Memory and resource constraints', () => {
    it('should handle memory constraints with large task lists', async () => {
      // Simulate out of memory error
      mockOrchestrator.listTasks.mockRejectedValue(new Error('JavaScript heap out of memory'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-memory-test']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: JavaScript heap out of memory')
      );
    });

    it('should handle resource cleanup failures', async () => {
      mockOrchestrator.cleanupOrphanedWorktrees.mockImplementation(async () => {
        throw new Error('Failed to release file handles');
      });

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Failed to release file handles')
      );
    });
  });

  describe('Edge cases in time and date handling', () => {
    it('should handle invalid dates in worktree info', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        {
          taskId: 'task-invalid-date-123456789012',
          path: '/tmp/apex-worktrees/task-invalid',
          branch: 'apex/task-invalid',
          status: 'active',
          lastUsedAt: new Date('invalid-date'),
        },
        {
          taskId: 'task-null-date-123456789012',
          path: '/tmp/apex-worktrees/task-null',
          branch: 'apex/task-null',
          status: 'stale',
          lastUsedAt: null as any,
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task Worktrees (2)')
      );
    });

    it('should handle extreme date values', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        {
          taskId: 'task-future-date-123456789012',
          path: '/tmp/apex-worktrees/task-future',
          branch: 'apex/task-future',
          status: 'active',
          lastUsedAt: new Date('2099-12-31T23:59:59Z'), // Far future
        },
        {
          taskId: 'task-past-date-123456789012',
          path: '/tmp/apex-worktrees/task-past',
          branch: 'apex/task-past',
          status: 'stale',
          lastUsedAt: new Date('1970-01-01T00:00:00Z'), // Unix epoch
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task Worktrees (2)')
      );
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle missing git configuration', async () => {
      const contextWithoutGit = {
        ...mockContext,
        config: {
          ...mockContext.config,
          // No git configuration
        },
      };

      mockOrchestrator.switchToTaskWorktree.mockRejectedValue(new Error('Git worktree feature not enabled'));

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(contextWithoutGit, ['--list']);

      // Should handle missing git config gracefully
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle partially corrupt configuration', async () => {
      const contextWithCorruptConfig = {
        ...mockContext,
        config: {
          // Missing required fields
          project: null,
          agents: undefined,
          workflows: {},
        } as any,
      };

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(contextWithCorruptConfig, ['--list']);

      // Should handle corrupt config gracefully
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});