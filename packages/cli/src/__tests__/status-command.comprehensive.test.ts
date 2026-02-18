import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chalk from 'chalk';
import { Task, ApprovalState, ApexConfig } from '@apexcli/core';
import { commands } from '../index.js';

// Mock chalk to avoid ANSI escape codes in tests
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    gray: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
    blue: (str: string) => str,
    bold: (str: string) => str,
  },
}));

describe('Status Command Comprehensive Tests', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let mockOrchestrator: any;
  let mockCtx: any;

  // Test fixtures
  const mockConfig: ApexConfig = {
    name: 'test-project',
    language: 'TypeScript',
    autonomy: {
      level: 'review-before-commit',
    },
    models: {
      planning: 'sonnet',
      implementation: 'sonnet',
      review: 'sonnet',
    },
    limits: {
      maxTokensPerTask: 100000,
      maxCostPerTask: 5.0,
      dailyBudget: 50.0,
    },
    api: {
      url: 'http://localhost:3001',
      port: 3001,
    },
  };

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task_12345678_abcd',
    description: 'Test task description',
    acceptanceCriteria: 'Task should work correctly',
    workflow: 'feature',
    autonomy: 'review-before-commit',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    usage: {
      totalTokens: 1000,
      inputTokens: 800,
      outputTokens: 200,
      estimatedCost: 0.0150,
      requestCount: 5,
    },
    ...overrides,
  });

  const createMockApproval = (overrides: Partial<ApprovalState> = {}): ApprovalState => ({
    id: 'approval_12345678_abcd',
    taskId: 'task_12345678_abcd',
    gateName: 'security-review',
    status: 'pending',
    requestedAt: new Date('2024-01-01T10:30:00Z'),
    approvalsRequired: 2,
    approvalsReceived: 0,
    ...overrides,
  });

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockOrchestrator = {
      listTasks: vi.fn(),
      getPendingApprovals: vi.fn(),
      getTask: vi.fn(),
    };

    mockCtx = {
      initialized: true,
      orchestrator: mockOrchestrator,
      config: mockConfig,
      cwd: '/test/project',
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.clearAllMocks();
  });

  const findStatusCommand = () => {
    return commands.find(cmd => cmd.name === 'status');
  };

  describe('Core Functionality', () => {
    it('should display status overview when no task ID provided', async () => {
      const statusCommand = findStatusCommand();
      expect(statusCommand).toBeDefined();

      const mockTasks = [
        createMockTask({ id: 'task1', description: 'First task', status: 'completed' }),
        createMockTask({ id: 'task2', description: 'Second task', status: 'in-progress' }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({
        limit: 1000,
        includeArchived: true,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📋 APEX Status Overview:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Autonomy Level:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💰 Session Resource Usage:')
      );
    });

    it('should display individual task details when task ID provided', async () => {
      const statusCommand = findStatusCommand();
      const mockTask = createMockTask({
        id: 'task_specific',
        description: 'Specific task details',
        status: 'completed',
        branchName: 'feature/task-branch',
        error: undefined,
      });

      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await statusCommand!.handler(mockCtx, ['task_specific']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('task_specific');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task: task_specific')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status: ✅ completed')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Description: Specific task details')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Branch: feature/task-branch')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tokens: 1,000')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost: $0.0150')
      );
    });

    it('should handle task with error', async () => {
      const statusCommand = findStatusCommand();
      const mockTask = createMockTask({
        error: 'Task execution failed due to timeout',
        status: 'failed',
      });

      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await statusCommand!.handler(mockCtx, ['task_error']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error: Task execution failed due to timeout')
      );
    });

    it('should handle task without branch', async () => {
      const statusCommand = findStatusCommand();
      const mockTask = createMockTask({
        branchName: undefined,
      });

      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await statusCommand!.handler(mockCtx, ['task_no_branch']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Branch: N/A')
      );
    });
  });

  describe('Autonomy Level Display', () => {
    it('should display full-auto autonomy with correct emoji', async () => {
      const statusCommand = findStatusCommand();
      const configWithFullAuto = {
        ...mockConfig,
        autonomy: { level: 'full-auto' as const },
      };

      const ctxWithFullAuto = { ...mockCtx, config: configWithFullAuto };

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(ctxWithFullAuto, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🤖 full-auto')
      );
    });

    it('should display review-all autonomy with correct emoji', async () => {
      const statusCommand = findStatusCommand();
      const configWithReviewAll = {
        ...mockConfig,
        autonomy: { level: 'review-all' as const },
      };

      const ctxWithReviewAll = { ...mockCtx, config: configWithReviewAll };

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(ctxWithReviewAll, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 review-all')
      );
    });

    it('should handle missing autonomy level with default', async () => {
      const statusCommand = findStatusCommand();
      const configWithoutAutonomy = {
        ...mockConfig,
        autonomy: {},
      };

      const ctxWithoutAutonomy = { ...mockCtx, config: configWithoutAutonomy };

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(ctxWithoutAutonomy, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('👀 review-before-commit')
      );
    });
  });

  describe('Session Resource Usage Calculation', () => {
    it('should calculate and display cumulative resource usage across all tasks', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({
          usage: { totalTokens: 1000, estimatedCost: 0.015, requestCount: 5, inputTokens: 800, outputTokens: 200 },
        }),
        createMockTask({
          usage: { totalTokens: 2000, estimatedCost: 0.030, requestCount: 3, inputTokens: 1600, outputTokens: 400 },
        }),
        createMockTask({
          usage: { totalTokens: 500, estimatedCost: 0.008, requestCount: 2, inputTokens: 400, outputTokens: 100 },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens: 3,500')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Cost: $0.0530')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Requests: 10')
      );
    });

    it('should handle tasks with missing or undefined usage data', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({
          usage: { totalTokens: 1000, estimatedCost: 0.015, requestCount: 5, inputTokens: 800, outputTokens: 200 },
        }),
        // @ts-ignore - testing undefined usage
        createMockTask({ usage: undefined }),
        createMockTask({
          usage: { totalTokens: 0, estimatedCost: 0, requestCount: 0, inputTokens: 0, outputTokens: 0 },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens: 1,000')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Cost: $0.0150')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Requests: 5')
      );
    });

    it('should handle zero usage when no tasks exist', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens: 0')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Cost: $0.0000')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Requests: 0')
      );
    });
  });

  describe('Recent Tasks Display', () => {
    it('should display recent tasks with proper formatting', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({
          id: 'task_12345678_abc1',
          description: 'First task with a longer description',
          status: 'completed',
          usage: { totalTokens: 1000, estimatedCost: 0.015, requestCount: 5, inputTokens: 800, outputTokens: 200 },
        }),
        createMockTask({
          id: 'task_87654321_def2',
          description: 'Second task',
          status: 'in-progress',
          usage: { totalTokens: 500, estimatedCost: 0.008, requestCount: 2, inputTokens: 400, outputTokens: 100 },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recent Tasks:')
      );

      // Check task 1 formatting
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/task_12345678_abc1.*✅.*completed.*\$0\.0150.*First task with a longer description/)
      );

      // Check task 2 formatting
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/task_87654321_def2.*🔄.*in-progress.*\$0\.0008.*Second task/)
      );
    });

    it('should show archived status for archived tasks', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({
          id: 'task_archived',
          status: 'completed',
          archivedAt: new Date('2024-01-02T10:00:00Z'),
          usage: { totalTokens: 1000, estimatedCost: 0.015, requestCount: 5, inputTokens: 800, outputTokens: 200 },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/task_archived.*📁.*archived.*\[archived\]/)
      );
    });

    it('should limit tasks display to 10 most recent', async () => {
      const statusCommand = findStatusCommand();

      // Create 15 tasks
      const mockTasks = Array.from({ length: 15 }, (_, i) =>
        createMockTask({
          id: `task_${i.toString().padStart(3, '0')}`,
          description: `Task ${i}`,
        })
      );

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      // Count how many task lines were logged (looking for task IDs)
      const taskLines = consoleSpy.mock.calls.filter(call =>
        call[0] && typeof call[0] === 'string' && call[0].includes('task_')
      );

      expect(taskLines.length).toBe(10);
    });
  });

  describe('Pending Approvals Display', () => {
    it('should display pending approvals with task details', async () => {
      const statusCommand = findStatusCommand();

      const mockTask = createMockTask({
        id: 'task_needs_approval',
        description: 'Task requiring approval',
      });

      const mockApproval = createMockApproval({
        taskId: 'task_needs_approval',
        gateName: 'security-review',
        requestedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      });

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([mockApproval]);
      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pending Approvals:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('security-review')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task requiring approval')
      );
    });

    it('should calculate and display waiting time correctly', async () => {
      const statusCommand = findStatusCommand();

      const mockTask = createMockTask({
        id: 'task_waiting_long',
        description: 'Long waiting task',
      });

      // Approval requested 2 hours and 30 minutes ago
      const twoAndHalfHoursAgo = new Date(Date.now() - (2.5 * 60 * 60 * 1000));
      const mockApproval = createMockApproval({
        taskId: 'task_waiting_long',
        requestedAt: twoAndHalfHoursAgo,
      });

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([mockApproval]);
      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('2h 30m')
      );
    });

    it('should handle approvals for tasks that no longer exist', async () => {
      const statusCommand = findStatusCommand();

      const mockApproval = createMockApproval({
        taskId: 'task_does_not_exist',
      });

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([mockApproval]);
      mockOrchestrator.getTask.mockResolvedValue(null);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task task_does_not_exist')
      );
    });

    it('should not show pending approvals section when none exist', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      const pendingApprovalsCalls = consoleSpy.mock.calls.filter(call =>
        call[0] && typeof call[0] === 'string' && call[0].includes('Pending Approvals')
      );

      expect(pendingApprovalsCalls.length).toBe(0);
    });
  });

  describe('Task Status Emojis', () => {
    it('should display correct emojis for different task statuses', async () => {
      const statusCommand = findStatusCommand();

      const testCases = [
        { status: 'pending', emoji: '⏳' },
        { status: 'queued', emoji: '📋' },
        { status: 'planning', emoji: '🤔' },
        { status: 'in-progress', emoji: '🔄' },
        { status: 'waiting-approval', emoji: '✋' },
        { status: 'paused', emoji: '⏸️' },
        { status: 'completed', emoji: '✅' },
        { status: 'failed', emoji: '❌' },
        { status: 'cancelled', emoji: '🚫' },
      ] as const;

      for (const { status, emoji } of testCases) {
        const mockTask = createMockTask({ status });
        mockOrchestrator.getTask.mockResolvedValue(mockTask);
        consoleSpy.mockClear();

        await statusCommand!.handler(mockCtx, ['test_task']);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Status: ${emoji} ${status}`)
        );
      }
    });

    it('should display default emoji for unknown status', async () => {
      const statusCommand = findStatusCommand();

      // @ts-ignore - testing unknown status
      const mockTask = createMockTask({ status: 'unknown-status' });
      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await statusCommand!.handler(mockCtx, ['test_task']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status: ❓ unknown-status')
      );
    });
  });

  describe('Include Archived Flag', () => {
    it('should include archived tasks when --include-archived flag is provided', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({ id: 'active_task', description: 'Active task' }),
        createMockTask({
          id: 'archived_task',
          description: 'Archived task',
          archivedAt: new Date(),
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, ['--include-archived']);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({
        limit: 1000,
        includeArchived: true,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recent Tasks (including archived):')
      );
    });

    it('should handle combined task ID and --include-archived flag', async () => {
      const statusCommand = findStatusCommand();

      // When a task ID is provided, it should get that specific task
      // The --include-archived flag should be ignored in this case
      const mockTask = createMockTask({ id: 'specific_task' });
      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await statusCommand!.handler(mockCtx, ['specific_task', '--include-archived']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('specific_task');
      expect(mockOrchestrator.listTasks).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle task not found', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.getTask.mockResolvedValue(null);

      await statusCommand!.handler(mockCtx, ['nonexistent_task']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: nonexistent_task')
      );
    });

    it('should handle uninitialized context', async () => {
      const statusCommand = findStatusCommand();

      const uninitializedCtx = {
        ...mockCtx,
        initialized: false,
        orchestrator: null,
      };

      await statusCommand!.handler(uninitializedCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });

    it('should handle missing orchestrator', async () => {
      const statusCommand = findStatusCommand();

      const noOrchestratorCtx = {
        ...mockCtx,
        orchestrator: null,
      };

      await statusCommand!.handler(noOrchestratorCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });

    it('should handle orchestrator errors gracefully', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.listTasks.mockRejectedValue(new Error('Database error'));

      // Should not throw, but might log error
      await expect(statusCommand!.handler(mockCtx, [])).rejects.toThrow('Database error');
    });
  });

  describe('Check Docs Flag', () => {
    it('should handle --check-docs flag', async () => {
      const statusCommand = findStatusCommand();

      // This functionality checks for outdated documentation
      // The implementation should analyze docs and provide feedback
      await statusCommand!.handler(mockCtx, ['--check-docs']);

      // Since this is a complex feature, we just verify it doesn't crash
      // The actual documentation checking logic would be tested separately
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should combine --check-docs with other flags', async () => {
      const statusCommand = findStatusCommand();

      await statusCommand!.handler(mockCtx, ['--check-docs', '--include-archived']);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});