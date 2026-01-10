/**
 * Status Command Acceptance Tests
 * Tests to verify the acceptance criteria for the 'apex status' command
 */

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

describe('Status Command Acceptance Criteria', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let mockOrchestrator: any;
  let mockCtx: any;

  const createMockConfig = (): ApexConfig => ({
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
  });

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
      estimatedCost: 0.015,
      requestCount: 5,
    },
    ...overrides,
  });

  const createMockApproval = (taskId: string, overrides: Partial<ApprovalState> = {}): ApprovalState => ({
    id: 'approval_12345678_abcd',
    taskId,
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

  describe('AC1: Shows current autonomy level from config', () => {
    it('should display autonomy level from configuration', async () => {
      const statusCommand = findStatusCommand();
      expect(statusCommand).toBeDefined();

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      // Should display the autonomy level from config
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Autonomy Level:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('review-before-commit')
      );
    });

    it('should display different autonomy levels correctly', async () => {
      const statusCommand = findStatusCommand();

      const autonomyLevels = [
        { level: 'full-auto' as const },
        { level: 'review-before-commit' as const },
        { level: 'review-all' as const },
      ];

      for (const { level } of autonomyLevels) {
        const config = {
          ...createMockConfig(),
          autonomy: { level },
        };

        const ctx = { ...mockCtx, config };

        mockOrchestrator.listTasks.mockResolvedValue([]);
        mockOrchestrator.getPendingApprovals.mockResolvedValue([]);
        consoleSpy.mockClear();

        await statusCommand!.handler(ctx, []);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(level)
        );
      }
    });

    it('should handle missing autonomy configuration with default', async () => {
      const statusCommand = findStatusCommand();

      const configWithoutAutonomy = {
        ...createMockConfig(),
        autonomy: {},
      };

      const ctx = { ...mockCtx, config: configWithoutAutonomy };

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(ctx, []);

      // Should default to review-before-commit
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('review-before-commit')
      );
    });
  });

  describe('AC2: Lists pending approvals with their details', () => {
    it('should list pending approvals when they exist', async () => {
      const statusCommand = findStatusCommand();

      const mockTask = createMockTask({
        id: 'task_needs_approval',
        description: 'Task requiring approval',
      });

      const mockApproval = createMockApproval('task_needs_approval', {
        gateName: 'security-review',
        approvalsRequired: 2,
        approvalsReceived: 0,
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

    it('should show approval details including gate name and task description', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({
          id: 'task_security',
          description: 'Security-sensitive feature implementation',
        }),
        createMockTask({
          id: 'task_qa',
          description: 'Quality assurance testing',
        }),
      ];

      const mockApprovals = [
        createMockApproval('task_security', {
          gateName: 'security-review',
          requestedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        }),
        createMockApproval('task_qa', {
          gateName: 'qa-review',
          requestedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue(mockApprovals);
      mockOrchestrator.getTask
        .mockImplementation((taskId: string) =>
          Promise.resolve(mockTasks.find(t => t.id === taskId) || null)
        );

      await statusCommand!.handler(mockCtx, []);

      // Should show both approval types
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('security-review')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('qa-review')
      );

      // Should show task descriptions
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security-sensitive feature implementation')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Quality assurance testing')
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

  describe('AC3: Shows active tasks and their states', () => {
    it('should display active tasks with their current states', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({
          id: 'task_in_progress',
          description: 'Currently executing task',
          status: 'in-progress',
        }),
        createMockTask({
          id: 'task_pending',
          description: 'Queued for execution',
          status: 'pending',
        }),
        createMockTask({
          id: 'task_waiting',
          description: 'Waiting for approval',
          status: 'waiting-approval',
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recent Tasks:')
      );

      // Should show all task states
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/task_in_progress.*in-progress/)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/task_pending.*pending/)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/task_waiting.*waiting-approval/)
      );
    });

    it('should show task status with appropriate emojis', async () => {
      const statusCommand = findStatusCommand();

      const statusTestCases = [
        { status: 'pending', emoji: '⏳' },
        { status: 'in-progress', emoji: '🔄' },
        { status: 'completed', emoji: '✅' },
        { status: 'failed', emoji: '❌' },
        { status: 'waiting-approval', emoji: '✋' },
      ] as const;

      for (const { status, emoji } of statusTestCases) {
        const mockTask = createMockTask({ status });
        mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
        mockOrchestrator.getPendingApprovals.mockResolvedValue([]);
        consoleSpy.mockClear();

        await statusCommand!.handler(mockCtx, []);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(emoji)
        );
      }
    });

    it('should handle empty task list gracefully', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No tasks found.')
      );
    });
  });

  describe('AC4: Displays cumulative resource usage across session', () => {
    it('should calculate and display total tokens across all tasks', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({
          usage: {
            totalTokens: 5000,
            estimatedCost: 0.075,
            requestCount: 10,
            inputTokens: 4000,
            outputTokens: 1000,
          },
        }),
        createMockTask({
          usage: {
            totalTokens: 3000,
            estimatedCost: 0.045,
            requestCount: 6,
            inputTokens: 2400,
            outputTokens: 600,
          },
        }),
        createMockTask({
          usage: {
            totalTokens: 2000,
            estimatedCost: 0.030,
            requestCount: 4,
            inputTokens: 1600,
            outputTokens: 400,
          },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session Resource Usage:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens: 10,000') // 5000 + 3000 + 2000
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Cost: $0.1500') // 0.075 + 0.045 + 0.030
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Requests: 20') // 10 + 6 + 4
      );
    });

    it('should handle tasks with missing usage data', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({
          usage: {
            totalTokens: 5000,
            estimatedCost: 0.075,
            requestCount: 10,
            inputTokens: 4000,
            outputTokens: 1000,
          },
        }),
        // @ts-ignore - testing undefined usage
        createMockTask({ usage: undefined }),
        createMockTask({
          usage: {
            totalTokens: 2000,
            estimatedCost: 0.030,
            requestCount: 4,
            inputTokens: 1600,
            outputTokens: 400,
          },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      // Should calculate correctly ignoring missing data
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens: 7,000') // 5000 + 0 + 2000
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Cost: $0.1050') // 0.075 + 0 + 0.030
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Requests: 14') // 10 + 0 + 4
      );
    });

    it('should display zero usage when no tasks exist', async () => {
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

    it('should include archived tasks in cumulative calculations', async () => {
      const statusCommand = findStatusCommand();

      const mockTasks = [
        createMockTask({
          usage: {
            totalTokens: 3000,
            estimatedCost: 0.045,
            requestCount: 6,
            inputTokens: 2400,
            outputTokens: 600,
          },
        }),
        createMockTask({
          archivedAt: new Date(), // Archived task
          usage: {
            totalTokens: 2000,
            estimatedCost: 0.030,
            requestCount: 4,
            inputTokens: 1600,
            outputTokens: 400,
          },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      // Should include both active and archived tasks in calculation
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens: 5,000') // 3000 + 2000
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Cost: $0.0750') // 0.045 + 0.030
      );
    });
  });
});