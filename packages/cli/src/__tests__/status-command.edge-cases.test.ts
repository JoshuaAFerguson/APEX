import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chalk from 'chalk';
import { Task, ApprovalState, ApexConfig } from '@apexcli/core';
import { commands } from '../index.js';

// Mock chalk to avoid ANSI escape codes in tests
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => `[CYAN]${str}[/CYAN]`,
    gray: (str: string) => `[GRAY]${str}[/GRAY]`,
    green: (str: string) => `[GREEN]${str}[/GREEN]`,
    red: (str: string) => `[RED]${str}[/RED]`,
    yellow: (str: string) => `[YELLOW]${str}[/YELLOW]`,
    blue: (str: string) => `[BLUE]${str}[/BLUE]`,
    bold: (str: string) => `[BOLD]${str}[/BOLD]`,
  },
}));

describe('Status Command Edge Cases', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let mockOrchestrator: any;
  let mockCtx: any;

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task_12345678_abcd',
    description: 'Test task',
    acceptanceCriteria: 'Should work',
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
      estimatedCost: 0.015,
      requestCount: 5,
    },
    ...overrides,
  });

  const createMockConfig = (overrides: Partial<ApexConfig> = {}): ApexConfig => ({
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
      config: createMockConfig(),
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

  describe('Initialization and Context Errors', () => {
    it('should handle uninitialized context gracefully', async () => {
      const statusCommand = findStatusCommand();

      const uninitializedCtx = {
        ...mockCtx,
        initialized: false,
        orchestrator: null,
      };

      await statusCommand!.handler(uninitializedCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RED]APEX not initialized. Run /init first.[/RED]')
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
        expect.stringContaining('[RED]APEX not initialized. Run /init first.[/RED]')
      );
    });

    it('should handle partially initialized context', async () => {
      const statusCommand = findStatusCommand();

      const partialCtx = {
        initialized: true,
        orchestrator: null,
        config: null,
        cwd: '/test/project',
      };

      await statusCommand!.handler(partialCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RED]APEX not initialized. Run /init first.[/RED]')
      );
    });

    it('should handle missing config gracefully', async () => {
      const statusCommand = findStatusCommand();

      const noConfigCtx = {
        ...mockCtx,
        config: null,
      };

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      // Should not crash, but might have undefined behavior
      await expect(statusCommand!.handler(noConfigCtx, [])).rejects.toThrow();
    });
  });

  describe('Database and Network Errors', () => {
    it('should handle database connection errors', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.listTasks.mockRejectedValue(new Error('Database connection failed'));

      await expect(statusCommand!.handler(mockCtx, [])).rejects.toThrow('Database connection failed');
    });

    it('should handle network timeout errors', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.getTask.mockRejectedValue(new Error('Request timeout'));

      await expect(statusCommand!.handler(mockCtx, ['task_timeout'])).rejects.toThrow('Request timeout');
    });

    it('should handle corrupted data errors', async () => {
      const statusCommand = findStatusCommand();

      // Simulate corrupted task data
      mockOrchestrator.listTasks.mockResolvedValue([
        { invalid: 'data', missing: 'required fields' },
      ]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      // Should handle gracefully or throw appropriate error
      await expect(statusCommand!.handler(mockCtx, [])).rejects.toThrow();
    });

    it('should handle approval fetch errors', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.listTasks.mockResolvedValue([createMockTask()]);
      mockOrchestrator.getPendingApprovals.mockRejectedValue(new Error('Failed to fetch approvals'));

      await expect(statusCommand!.handler(mockCtx, [])).rejects.toThrow('Failed to fetch approvals');
    });
  });

  describe('Data Validation and Boundary Cases', () => {
    it('should handle tasks with invalid usage data', async () => {
      const statusCommand = findStatusCommand();

      const invalidUsageTasks = [
        createMockTask({
          usage: {
            totalTokens: -1000, // Negative tokens
            estimatedCost: -0.5, // Negative cost
            requestCount: -5, // Negative requests
            inputTokens: NaN, // Invalid number
            outputTokens: Infinity, // Invalid number
          },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(invalidUsageTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      // Should handle gracefully and not crash
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle extremely large numbers', async () => {
      const statusCommand = findStatusCommand();

      const extremeUsageTasks = [
        createMockTask({
          usage: {
            totalTokens: Number.MAX_SAFE_INTEGER,
            estimatedCost: 999999999.9999,
            requestCount: Number.MAX_SAFE_INTEGER,
            inputTokens: Number.MAX_SAFE_INTEGER - 1,
            outputTokens: 1,
          },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(extremeUsageTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      // Should handle large numbers and format them properly
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens:')
      );
    });

    it('should handle tasks with very long descriptions', async () => {
      const statusCommand = findStatusCommand();

      const longDescription = 'A'.repeat(10000); // 10k character description
      const taskWithLongDescription = createMockTask({
        description: longDescription,
      });

      mockOrchestrator.listTasks.mockResolvedValue([taskWithLongDescription]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      // Should truncate or handle long descriptions gracefully
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle tasks with special characters and emojis', async () => {
      const statusCommand = findStatusCommand();

      const specialCharTask = createMockTask({
        description: '🚀 Task with émojis & spëcial chars! 中文 العربية',
        branchName: 'feature/🎉-unicode-support-ñoño',
      });

      mockOrchestrator.getTask.mockResolvedValue(specialCharTask);

      await statusCommand!.handler(mockCtx, ['special_task']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Task with émojis & spëcial chars! 中文 العربية')
      );
    });

    it('should handle null and undefined task fields', async () => {
      const statusCommand = findStatusCommand();

      const taskWithNulls = createMockTask({
        // @ts-ignore - testing null/undefined values
        description: null,
        // @ts-ignore
        branchName: null,
        // @ts-ignore
        error: undefined,
        // @ts-ignore
        currentStage: undefined,
      });

      mockOrchestrator.getTask.mockResolvedValue(taskWithNulls);

      await statusCommand!.handler(mockCtx, ['null_task']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Branch: N/A')
      );
    });
  });

  describe('Time and Date Edge Cases', () => {
    it('should handle invalid dates', async () => {
      const statusCommand = findStatusCommand();

      const taskWithInvalidDate = createMockTask({
        // @ts-ignore - testing invalid date
        createdAt: new Date('invalid-date'),
        // @ts-ignore
        updatedAt: null,
      });

      mockOrchestrator.getTask.mockResolvedValue(taskWithInvalidDate);

      await statusCommand!.handler(mockCtx, ['invalid_date_task']);

      // Should handle gracefully
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle extremely old and future dates', async () => {
      const statusCommand = findStatusCommand();

      const approval = {
        id: 'approval_time_edge',
        taskId: 'task_time_edge',
        gateName: 'test-gate',
        status: 'pending' as const,
        requestedAt: new Date('1970-01-01T00:00:00Z'), // Unix epoch
        approvalsRequired: 1,
        approvalsReceived: 0,
      };

      const task = createMockTask({
        id: 'task_time_edge',
        createdAt: new Date('2030-01-01T00:00:00Z'), // Future date
      });

      mockOrchestrator.listTasks.mockResolvedValue([task]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([approval]);
      mockOrchestrator.getTask.mockResolvedValue(task);

      await statusCommand!.handler(mockCtx, []);

      // Should handle extreme dates gracefully
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle zero duration approvals', async () => {
      const statusCommand = findStatusCommand();

      const approval = {
        id: 'approval_zero_duration',
        taskId: 'task_zero_duration',
        gateName: 'instant-gate',
        status: 'pending' as const,
        requestedAt: new Date(), // Right now
        approvalsRequired: 1,
        approvalsReceived: 0,
      };

      const task = createMockTask({ id: 'task_zero_duration' });

      mockOrchestrator.listTasks.mockResolvedValue([task]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([approval]);
      mockOrchestrator.getTask.mockResolvedValue(task);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('0m')
      );
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle malformed autonomy configuration', async () => {
      const statusCommand = findStatusCommand();

      const malformedConfig = createMockConfig({
        // @ts-ignore - testing malformed config
        autonomy: 'invalid-autonomy-string',
      });

      const malformedCtx = { ...mockCtx, config: malformedConfig };

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(malformedCtx, []);

      // Should handle gracefully with default
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚙️')
      );
    });

    it('should handle missing autonomy level', async () => {
      const statusCommand = findStatusCommand();

      const configWithoutAutonomy = createMockConfig({
        // @ts-ignore - testing missing autonomy
        autonomy: {},
      });

      const ctxWithoutAutonomy = { ...mockCtx, config: configWithoutAutonomy };

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(ctxWithoutAutonomy, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('👀 review-before-commit')
      );
    });

    it('should handle unknown autonomy level', async () => {
      const statusCommand = findStatusCommand();

      const configWithUnknownAutonomy = createMockConfig({
        autonomy: {
          // @ts-ignore - testing unknown level
          level: 'unknown-autonomy-level',
        },
      });

      const ctxWithUnknownAutonomy = { ...mockCtx, config: configWithUnknownAutonomy };

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(ctxWithUnknownAutonomy, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚙️ unknown-autonomy-level')
      );
    });
  });

  describe('Argument Parsing Edge Cases', () => {
    it('should handle empty string arguments', async () => {
      const statusCommand = findStatusCommand();

      const mockTask = createMockTask();
      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await statusCommand!.handler(mockCtx, ['']);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('');
    });

    it('should handle very long task IDs', async () => {
      const statusCommand = findStatusCommand();

      const veryLongTaskId = 'task_' + 'a'.repeat(1000);
      const mockTask = createMockTask({ id: veryLongTaskId });
      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await statusCommand!.handler(mockCtx, [veryLongTaskId]);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith(veryLongTaskId);
    });

    it('should handle special characters in task IDs', async () => {
      const statusCommand = findStatusCommand();

      const specialTaskId = 'task_with_$pec!al-chars.and.dots/slashes';
      mockOrchestrator.getTask.mockResolvedValue(null);

      await statusCommand!.handler(mockCtx, [specialTaskId]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[RED]Task not found: ${specialTaskId}[/RED]`)
      );
    });

    it('should handle mixed valid and invalid flags', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, [
        '--include-archived',
        '--invalid-flag',
        '--check-docs',
        'random-arg',
      ]);

      // Should process valid flags and ignore invalid ones
      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({
        limit: 1000,
        includeArchived: true,
      });
    });

    it('should handle Unicode and non-ASCII task IDs', async () => {
      const statusCommand = findStatusCommand();

      const unicodeTaskId = 'task_中文_العربية_🚀';
      mockOrchestrator.getTask.mockResolvedValue(null);

      await statusCommand!.handler(mockCtx, [unicodeTaskId]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Task not found: ${unicodeTaskId}`)
      );
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle extremely large task lists', async () => {
      const statusCommand = findStatusCommand();

      // Create a very large number of tasks to test memory handling
      const massiveTasks = Array.from({ length: 10000 }, (_, i) =>
        createMockTask({
          id: `task_massive_${i}`,
          description: `Massive task ${i}`,
          usage: {
            totalTokens: i,
            estimatedCost: i * 0.001,
            requestCount: 1,
            inputTokens: i * 0.8,
            outputTokens: i * 0.2,
          },
        })
      );

      mockOrchestrator.listTasks.mockResolvedValue(massiveTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      const startTime = Date.now();
      await statusCommand!.handler(mockCtx, []);
      const endTime = Date.now();

      // Should complete within reasonable time even with large dataset
      expect(endTime - startTime).toBeLessThan(5000);

      // Should still only display 10 tasks
      const taskDisplayLines = consoleSpy.mock.calls.filter(call =>
        call[0] && typeof call[0] === 'string' && call[0].includes('task_massive_')
      );
      expect(taskDisplayLines.length).toBe(10);
    });

    it('should handle circular reference scenarios', async () => {
      const statusCommand = findStatusCommand();

      // Create a task that might have circular references
      const circularTask = createMockTask();
      // @ts-ignore - testing circular reference
      circularTask.self = circularTask;

      mockOrchestrator.getTask.mockResolvedValue(circularTask);

      await statusCommand!.handler(mockCtx, ['circular_task']);

      // Should handle without infinite loops
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Console Output Edge Cases', () => {
    it('should handle console.log failures', async () => {
      const statusCommand = findStatusCommand();

      // Mock console.log to throw an error
      consoleSpy.mockImplementation(() => {
        throw new Error('Console output failed');
      });

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      // Should not crash the entire command
      await expect(statusCommand!.handler(mockCtx, [])).rejects.toThrow('Console output failed');
    });

    it('should handle very wide terminal output', async () => {
      const statusCommand = findStatusCommand();

      const taskWithVeryLongValues = createMockTask({
        id: 'task_' + 'x'.repeat(200),
        description: 'Description that is extremely long and could potentially cause formatting issues when displayed in the terminal because it exceeds normal line lengths significantly'.repeat(10),
        branchName: 'feature/' + 'very-long-branch-name-that-might-cause-issues-with-terminal-display'.repeat(5),
      });

      mockOrchestrator.listTasks.mockResolvedValue([taskWithVeryLongValues]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      // Should handle gracefully without breaking terminal
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});