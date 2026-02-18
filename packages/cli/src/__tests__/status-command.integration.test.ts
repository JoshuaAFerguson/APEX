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

describe('Status Command Integration Tests', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let mockOrchestrator: any;
  let mockCtx: any;

  const createRealisticTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`,
    description: 'Implement user authentication system',
    acceptanceCriteria: 'Users can login, logout, and register. JWT tokens for session management.',
    workflow: 'feature',
    autonomy: 'review-before-commit',
    status: 'in-progress',
    priority: 'high',
    effort: 'large',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    updatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    currentStage: 'implementation',
    branchName: 'feature/user-auth',
    usage: {
      totalTokens: 25000,
      inputTokens: 20000,
      outputTokens: 5000,
      estimatedCost: 0.375,
      requestCount: 15,
    },
    ...overrides,
  });

  const createRealisticApproval = (taskId: string, overrides: Partial<ApprovalState> = {}): ApprovalState => ({
    id: `approval_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`,
    taskId,
    gateName: 'security-review',
    status: 'pending',
    requestedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    approvalsRequired: 2,
    approvalsReceived: 0,
    context: {
      reason: 'Security review required for authentication changes',
      requestedBy: 'developer',
    },
    ...overrides,
  });

  const createRealisticConfig = (): ApexConfig => ({
    name: 'ecommerce-platform',
    language: 'TypeScript',
    framework: 'Next.js',
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
      dailyBudget: 25.0,
    },
    api: {
      url: 'http://localhost:3001',
      port: 3001,
    },
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
      config: createRealisticConfig(),
      cwd: '/Users/developer/projects/ecommerce-platform',
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.clearAllMocks();
  });

  const findStatusCommand = () => {
    return commands.find(cmd => cmd.name === 'status');
  };

  describe('Real-world Status Overview Scenarios', () => {
    it('should display comprehensive project status for active development', async () => {
      const statusCommand = findStatusCommand();

      const activeTasks = [
        createRealisticTask({
          id: 'task_auth_system',
          description: 'Implement user authentication system',
          status: 'in-progress',
          priority: 'high',
          effort: 'large',
          usage: { totalTokens: 25000, estimatedCost: 0.375, requestCount: 15, inputTokens: 20000, outputTokens: 5000 },
        }),
        createRealisticTask({
          id: 'task_payment_flow',
          description: 'Add payment processing flow',
          status: 'pending',
          priority: 'urgent',
          effort: 'xl',
          usage: { totalTokens: 0, estimatedCost: 0, requestCount: 0, inputTokens: 0, outputTokens: 0 },
        }),
        createRealisticTask({
          id: 'task_ui_polish',
          description: 'Polish dashboard UI components',
          status: 'completed',
          priority: 'normal',
          effort: 'small',
          usage: { totalTokens: 8000, estimatedCost: 0.120, requestCount: 8, inputTokens: 6000, outputTokens: 2000 },
        }),
        createRealisticTask({
          id: 'task_bug_fix',
          description: 'Fix cart calculation bug',
          status: 'completed',
          priority: 'high',
          effort: 'xs',
          usage: { totalTokens: 3000, estimatedCost: 0.045, requestCount: 3, inputTokens: 2400, outputTokens: 600 },
        }),
        createRealisticTask({
          id: 'task_testing',
          description: 'Add comprehensive test coverage',
          status: 'waiting-approval',
          priority: 'normal',
          effort: 'medium',
          usage: { totalTokens: 12000, estimatedCost: 0.180, requestCount: 10, inputTokens: 9600, outputTokens: 2400 },
        }),
      ];

      const pendingApprovals = [
        createRealisticApproval('task_auth_system', {
          gateName: 'security-review',
          requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        }),
        createRealisticApproval('task_testing', {
          gateName: 'qa-review',
          requestedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(activeTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue(pendingApprovals);
      mockOrchestrator.getTask
        .mockImplementation((taskId: string) =>
          Promise.resolve(activeTasks.find(t => t.id === taskId) || null)
        );

      await statusCommand!.handler(mockCtx, []);

      // Verify status overview header
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CYAN]📋 APEX Status Overview:[/CYAN]')
      );

      // Verify autonomy level display
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BOLD]Autonomy Level:[/BOLD] 👀 review-before-commit')
      );

      // Verify cumulative resource usage
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CYAN]💰 Session Resource Usage:[/CYAN]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens: 48,000') // Sum of all task tokens
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Cost: $0.7200') // Sum of all task costs
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Requests: 36') // Sum of all request counts
      );

      // Verify recent tasks section
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CYAN]Recent Tasks:[/CYAN]')
      );

      // Verify pending approvals section
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CYAN]Pending Approvals:[/CYAN]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('security-review')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('qa-review')
      );
    });

    it('should handle empty project status gracefully', async () => {
      const statusCommand = findStatusCommand();

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[GRAY]No tasks found.[/GRAY]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens: 0')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Cost: $0.0000')
      );

      // Should not show pending approvals section
      const pendingApprovalsCalls = consoleSpy.mock.calls.filter(call =>
        call[0] && typeof call[0] === 'string' && call[0].includes('Pending Approvals')
      );
      expect(pendingApprovalsCalls.length).toBe(0);
    });

    it('should show archived tasks when flag is provided', async () => {
      const statusCommand = findStatusCommand();

      const allTasks = [
        createRealisticTask({
          id: 'task_current',
          description: 'Current development work',
          status: 'in-progress',
        }),
        createRealisticTask({
          id: 'task_archived',
          description: 'Completed feature from last sprint',
          status: 'completed',
          archivedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(allTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, ['--include-archived']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recent Tasks (including archived):')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/task_archived.*📁.*archived.*\[archived\]/)
      );
    });
  });

  describe('Individual Task Status Scenarios', () => {
    it('should display detailed task information for in-progress task', async () => {
      const statusCommand = findStatusCommand();

      const task = createRealisticTask({
        id: 'task_detailed_auth',
        description: 'Implement OAuth 2.0 authentication with Google and GitHub',
        status: 'in-progress',
        currentStage: 'implementation',
        branchName: 'feature/oauth-integration',
        usage: {
          totalTokens: 35000,
          inputTokens: 28000,
          outputTokens: 7000,
          estimatedCost: 0.525,
          requestCount: 20,
        },
      });

      mockOrchestrator.getTask.mockResolvedValue(task);

      await statusCommand!.handler(mockCtx, ['task_detailed_auth']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CYAN]Task: task_detailed_auth[/CYAN]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status: 🔄 in-progress')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Description: Implement OAuth 2.0 authentication with Google and GitHub')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Workflow: feature')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Branch: feature/oauth-integration')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tokens: 35,000')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost: $0.5250')
      );
    });

    it('should display failed task with error information', async () => {
      const statusCommand = findStatusCommand();

      const failedTask = createRealisticTask({
        id: 'task_failed_deployment',
        description: 'Deploy to production environment',
        status: 'failed',
        error: 'Deployment failed: Environment variables not configured correctly. Missing DATABASE_URL and JWT_SECRET.',
        branchName: 'release/v1.2.0',
        usage: {
          totalTokens: 15000,
          inputTokens: 12000,
          outputTokens: 3000,
          estimatedCost: 0.225,
          requestCount: 8,
        },
      });

      mockOrchestrator.getTask.mockResolvedValue(failedTask);

      await statusCommand!.handler(mockCtx, ['task_failed_deployment']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status: ❌ failed')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RED]Error: Deployment failed: Environment variables not configured correctly. Missing DATABASE_URL and JWT_SECRET.[/RED]')
      );
    });

    it('should handle task without branch information', async () => {
      const statusCommand = findStatusCommand();

      const taskWithoutBranch = createRealisticTask({
        id: 'task_no_branch',
        description: 'Code review and documentation update',
        branchName: undefined,
      });

      mockOrchestrator.getTask.mockResolvedValue(taskWithoutBranch);

      await statusCommand!.handler(mockCtx, ['task_no_branch']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Branch: N/A')
      );
    });
  });

  describe('Complex Approval Scenarios', () => {
    it('should display multiple pending approvals with varying wait times', async () => {
      const statusCommand = findStatusCommand();

      const tasks = [
        createRealisticTask({
          id: 'task_security_patch',
          description: 'Security vulnerability fix for user sessions',
        }),
        createRealisticTask({
          id: 'task_feature_rollout',
          description: 'New feature rollout to production',
        }),
        createRealisticTask({
          id: 'task_db_migration',
          description: 'Database schema migration',
        }),
      ];

      const approvals = [
        createRealisticApproval('task_security_patch', {
          gateName: 'security-review',
          requestedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        }),
        createRealisticApproval('task_feature_rollout', {
          gateName: 'product-review',
          requestedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        }),
        createRealisticApproval('task_db_migration', {
          gateName: 'dba-review',
          requestedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(tasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue(approvals);
      mockOrchestrator.getTask.mockImplementation((taskId: string) =>
        Promise.resolve(tasks.find(t => t.id === taskId) || null)
      );

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CYAN]Pending Approvals:[/CYAN]')
      );

      // Check for different approval gates
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('security-review')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('product-review')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('dba-review')
      );

      // Check for different time formats
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('3h') // 3 hours
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('30m') // 30 minutes
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('1d') // 25 hours = 1 day
      );
    });

    it('should handle approval for deleted task gracefully', async () => {
      const statusCommand = findStatusCommand();

      const approvals = [
        createRealisticApproval('task_deleted', {
          gateName: 'code-review',
          requestedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue([]);
      mockOrchestrator.getPendingApprovals.mockResolvedValue(approvals);
      mockOrchestrator.getTask.mockResolvedValue(null);

      await statusCommand!.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task task_deleted')
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large number of tasks efficiently', async () => {
      const statusCommand = findStatusCommand();

      // Create 50 tasks to test performance
      const largeBatchOfTasks = Array.from({ length: 50 }, (_, i) =>
        createRealisticTask({
          id: `task_batch_${i.toString().padStart(3, '0')}`,
          description: `Batch task ${i}`,
          usage: {
            totalTokens: 1000 + i * 100,
            estimatedCost: (1000 + i * 100) * 0.000015,
            requestCount: 2 + (i % 5),
            inputTokens: 800 + i * 80,
            outputTokens: 200 + i * 20,
          },
        })
      );

      mockOrchestrator.listTasks.mockResolvedValue(largeBatchOfTasks);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      const startTime = Date.now();
      await statusCommand!.handler(mockCtx, []);
      const endTime = Date.now();

      // Should complete quickly (within reasonable time)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should only display 10 tasks (recent limit)
      const taskDisplayLines = consoleSpy.mock.calls.filter(call =>
        call[0] && typeof call[0] === 'string' && call[0].includes('task_batch_')
      );
      expect(taskDisplayLines.length).toBe(10);

      // Should calculate cumulative totals correctly
      const expectedTotalTokens = largeBatchOfTasks.reduce(
        (sum, task) => sum + task.usage.totalTokens,
        0
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Total Tokens: ${expectedTotalTokens.toLocaleString()}`)
      );
    });

    it('should handle missing usage data gracefully', async () => {
      const statusCommand = findStatusCommand();

      const tasksWithMissingData = [
        createRealisticTask({
          usage: {
            totalTokens: 1000,
            estimatedCost: 0.015,
            requestCount: 5,
            inputTokens: 800,
            outputTokens: 200,
          },
        }),
        // @ts-ignore - testing missing usage
        createRealisticTask({ usage: undefined }),
        createRealisticTask({
          usage: {
            totalTokens: 0,
            estimatedCost: 0,
            requestCount: 0,
            inputTokens: 0,
            outputTokens: 0,
          },
        }),
      ];

      mockOrchestrator.listTasks.mockResolvedValue(tasksWithMissingData);
      mockOrchestrator.getPendingApprovals.mockResolvedValue([]);

      await statusCommand!.handler(mockCtx, []);

      // Should handle gracefully and show available data
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Tokens: 1,000')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total Cost: $0.0150')
      );
    });

    it('should handle various autonomy levels correctly', async () => {
      const statusCommand = findStatusCommand();

      const autonomyLevels = [
        { level: 'full-auto' as const, emoji: '🤖' },
        { level: 'review-before-commit' as const, emoji: '👀' },
        { level: 'review-all' as const, emoji: '🔍' },
      ];

      for (const { level, emoji } of autonomyLevels) {
        const config = {
          ...createRealisticConfig(),
          autonomy: { level },
        };

        const ctx = { ...mockCtx, config };

        mockOrchestrator.listTasks.mockResolvedValue([]);
        mockOrchestrator.getPendingApprovals.mockResolvedValue([]);
        consoleSpy.mockClear();

        await statusCommand!.handler(ctx, []);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(`${emoji} ${level}`)
        );
      }
    });
  });

  describe('Time Format Edge Cases', () => {
    it('should format various time durations correctly', async () => {
      const statusCommand = findStatusCommand();

      const task = createRealisticTask({ id: 'test_task' });

      const testCases = [
        { minutesAgo: 5, expectedFormat: '5m' },
        { minutesAgo: 45, expectedFormat: '45m' },
        { minutesAgo: 90, expectedFormat: '1h 30m' },
        { minutesAgo: 120, expectedFormat: '2h' },
        { minutesAgo: 1440, expectedFormat: '1d' }, // 24 hours
        { minutesAgo: 1500, expectedFormat: '1d 1h' }, // 25 hours
      ];

      for (const { minutesAgo, expectedFormat } of testCases) {
        const approval = createRealisticApproval('test_task', {
          requestedAt: new Date(Date.now() - minutesAgo * 60 * 1000),
        });

        mockOrchestrator.listTasks.mockResolvedValue([task]);
        mockOrchestrator.getPendingApprovals.mockResolvedValue([approval]);
        mockOrchestrator.getTask.mockResolvedValue(task);
        consoleSpy.mockClear();

        await statusCommand!.handler(mockCtx, []);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(expectedFormat)
        );
      }
    });
  });
});