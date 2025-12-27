/**
 * Acceptance criteria tests for the /checkout command
 * Validates that the command meets all specified requirements
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

describe('Checkout Command Acceptance Criteria', () => {
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

  describe('AC1: /checkout <taskId> command verified to switch to task branch/worktree', () => {
    it('should successfully switch to task worktree when provided with valid task ID', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-ac1-test-123456789012',
        description: 'Acceptance criteria test task',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-ac1-test',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-ac1-test-123456789012',
        path: '/tmp/apex-worktrees/task-ac1-test',
        branch: 'apex/task-ac1-test',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-ac1-test');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-ac1-test-123456789012']);

      // Verify that the orchestrator methods were called correctly
      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 100 });
      expect(mockOrchestrator.getTaskWorktree).toHaveBeenCalledWith('task-ac1-test-123456789012');
      expect(mockOrchestrator.switchToTaskWorktree).toHaveBeenCalledWith('task-ac1-test-123456789012');

      // Verify successful switch message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Switched to worktree for task')
      );

      // ✓ AC1: Command successfully switches to task branch/worktree
    });

    it('should execute the checkout workflow correctly', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-workflow-123456789012',
        description: 'Workflow verification task',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-workflow',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-workflow-123456789012',
        path: '/tmp/apex-worktrees/task-workflow',
        branch: 'apex/task-workflow',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-workflow');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-workflow']);

      // Verify the correct sequence of operations
      expect(mockOrchestrator.listTasks).toHaveBeenCalledBefore(mockOrchestrator.getTaskWorktree as any);
      expect(mockOrchestrator.getTaskWorktree).toHaveBeenCalledBefore(mockOrchestrator.switchToTaskWorktree as any);

      // ✓ AC1: Checkout workflow executes correctly
    });
  });

  describe('AC2: Command works with partial task IDs', () => {
    it('should match task using partial ID (beginning of task ID)', async () => {
      const fullTaskId = 'task-partial-match-123456789012345678901234567890';
      const partialTaskId = 'task-partial-match';

      const mockTask: Partial<Task> = {
        id: fullTaskId,
        description: 'Partial ID test task',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-partial-match',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: fullTaskId,
        path: '/tmp/apex-worktrees/task-partial-match',
        branch: 'apex/task-partial-match',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-partial-match');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, [partialTaskId]);

      // Verify that partial ID was resolved to full ID
      expect(mockOrchestrator.getTaskWorktree).toHaveBeenCalledWith(fullTaskId);
      expect(mockOrchestrator.switchToTaskWorktree).toHaveBeenCalledWith(fullTaskId);

      // ✓ AC2: Command works with partial task IDs
    });

    it('should handle various partial ID lengths', async () => {
      const fullTaskId = 'task-various-lengths-123456789012345678901234567890';

      const mockTask: Partial<Task> = {
        id: fullTaskId,
        description: 'Various lengths test',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: fullTaskId,
        path: '/tmp/apex-worktrees/task-various-lengths',
        branch: 'apex/task-various-lengths',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-various-lengths');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test different partial ID lengths
      const partialIds = [
        'task-various', // short prefix
        'task-various-lengths', // medium prefix
        'task-various-lengths-123456', // long prefix
        fullTaskId.substring(0, 20), // very specific prefix
      ];

      for (const partialId of partialIds) {
        mockConsoleLog.mockClear();
        await checkoutCommand?.handler(mockContext, [partialId]);

        expect(mockOrchestrator.switchToTaskWorktree).toHaveBeenCalledWith(fullTaskId);
      }

      // ✓ AC2: Various partial ID lengths work correctly
    });

    it('should find correct task among multiple tasks with similar prefixes', async () => {
      const targetTaskId = 'task-target-abc123456789';
      const similarTaskId = 'task-target-xyz987654321';

      const mockTasks: Partial<Task>[] = [
        {
          id: similarTaskId,
          description: 'Similar task (not target)',
          status: 'completed',
          workflow: 'feature',
          createdAt: new Date(Date.now() - 100000), // older
          usage: { totalTokens: 0, estimatedCost: 0 },
          logs: [],
        },
        {
          id: targetTaskId,
          description: 'Target task',
          status: 'in-progress',
          workflow: 'feature',
          createdAt: new Date(), // newer
          usage: { totalTokens: 0, estimatedCost: 0 },
          logs: [],
        },
      ];

      const mockWorktree: WorktreeInfo = {
        taskId: targetTaskId,
        path: '/tmp/apex-worktrees/task-target-abc',
        branch: 'apex/task-target-abc',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-target-abc');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Use partial ID that matches the beginning of both tasks
      await checkoutCommand?.handler(mockContext, ['task-target-abc']);

      // Should match the first task that starts with the partial ID (targetTaskId)
      expect(mockOrchestrator.getTaskWorktree).toHaveBeenCalledWith(targetTaskId);

      // ✓ AC2: Correctly resolves partial IDs even with similar task IDs
    });
  });

  describe('AC3: Provides helpful output with worktree path and instructions', () => {
    it('should display worktree path information after successful checkout', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-output-test-123456789012',
        description: 'Output verification task',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-output-test',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-output-test-123456789012',
        path: '/tmp/apex-worktrees/task-output-test',
        branch: 'apex/task-output-test',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-output-test');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-output-test']);

      // Verify worktree path is displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Path: /tmp/apex-worktrees/task-output-test')
      );

      // ✓ AC3: Displays worktree path
    });

    it('should provide clear instructions for next steps', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-instructions-123456789012',
        description: 'Instructions test task',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-instructions',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-instructions-123456789012',
        path: '/tmp/apex-worktrees/task-instructions',
        branch: 'apex/task-instructions',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-instructions');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-instructions']);

      // Verify helpful instructions are provided
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To continue working on this task, change to the worktree directory:')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('cd "/tmp/apex-worktrees/task-instructions"')
      );

      // ✓ AC3: Provides helpful instructions
    });

    it('should include branch and task information in output', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-info-display-123456789012',
        description: 'Information display verification',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-info-display',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-info-display-123456789012',
        path: '/tmp/apex-worktrees/task-info-display',
        branch: 'apex/task-info-display',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-info-display');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['task-info-display']);

      // Verify branch information is displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Branch: apex/task-info-display')
      );

      // Verify task description is displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task: Information display verification')
      );

      // ✓ AC3: Includes comprehensive information in output
    });
  });

  describe('AC4: CLI help text coverage', () => {
    it('should provide comprehensive help when called without arguments', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, []);

      // Verify usage line is present
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /checkout <task_id> | /checkout --list | /checkout --cleanup [<task_id>]')
      );

      // Verify all subcommand options are documented
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

      // ✓ AC4: CLI help text is comprehensive and helpful
    });

    it('should have correct command registration with aliases', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      expect(checkoutCommand).toBeDefined();
      expect(checkoutCommand?.name).toBe('checkout');
      expect(checkoutCommand?.aliases).toEqual(['co']);
      expect(checkoutCommand?.description).toBe('Switch to task worktree or manage worktrees');
      expect(checkoutCommand?.usage).toBe('/checkout <task_id> | /checkout --list | /checkout --cleanup [<task_id>]');

      // ✓ AC4: Command is properly registered with correct metadata
    });
  });

  describe('Overall command functionality verification', () => {
    it('should successfully handle all major use cases in sequence', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test 1: Help display
      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, []);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Usage:'));

      // Test 2: List worktrees
      mockOrchestrator.listTaskWorktrees.mockResolvedValue([]);
      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, ['--list']);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No task worktrees found'));

      // Test 3: Cleanup
      mockOrchestrator.cleanupOrphanedWorktrees.mockResolvedValue([]);
      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, ['--cleanup']);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Cleaning up orphaned worktrees'));

      // Test 4: Task checkout
      const mockTask: Partial<Task> = {
        id: 'task-sequence-test-123456789012',
        description: 'Sequence test task',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-sequence-test-123456789012',
        path: '/tmp/apex-worktrees/task-sequence-test',
        branch: 'apex/task-sequence-test',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-sequence-test');

      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, ['task-sequence']);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Switched to worktree'));

      // ✓ All major functionality works correctly
    });

    it('should meet all acceptance criteria in a comprehensive test', async () => {
      // This test verifies all acceptance criteria are met in a single flow
      const mockTask: Partial<Task> = {
        id: 'task-comprehensive-ac-123456789012',
        description: 'Comprehensive acceptance criteria test',
        status: 'in-progress',
        workflow: 'feature',
        branchName: 'apex/task-comprehensive-ac',
        createdAt: new Date(),
        usage: { totalTokens: 0, estimatedCost: 0 },
        logs: [],
      };

      const mockWorktree: WorktreeInfo = {
        taskId: 'task-comprehensive-ac-123456789012',
        path: '/tmp/apex-worktrees/task-comprehensive-ac',
        branch: 'apex/task-comprehensive-ac',
        status: 'active',
        lastUsedAt: new Date(),
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getTaskWorktree.mockResolvedValue(mockWorktree);
      mockOrchestrator.switchToTaskWorktree.mockResolvedValue('/tmp/apex-worktrees/task-comprehensive-ac');

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Use partial task ID (AC2)
      await checkoutCommand?.handler(mockContext, ['task-comprehensive']);

      // ✓ AC1: Command switches to task branch/worktree
      expect(mockOrchestrator.switchToTaskWorktree).toHaveBeenCalledWith('task-comprehensive-ac-123456789012');

      // ✓ AC2: Works with partial task IDs
      expect(mockOrchestrator.listTasks).toHaveBeenCalled();

      // ✓ AC3: Provides helpful output with worktree path and instructions
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Path: /tmp/apex-worktrees/task-comprehensive-ac')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('cd "/tmp/apex-worktrees/task-comprehensive-ac"')
      );

      // ✓ AC4: CLI help text verified in other tests
      expect(checkoutCommand?.usage).toBe('/checkout <task_id> | /checkout --list | /checkout --cleanup [<task_id>]');

      // All acceptance criteria are satisfied
    });
  });
});