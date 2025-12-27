/**
 * ADR-001: Technical Design for Partial Task ID Matching in Push Command Tests
 *
 * ## Context
 * The push command currently uses `ctx.orchestrator.getTask(taskId)` which requires
 * an exact task ID match. Other commands (checkout, merge) use `listTasks` followed
 * by `find(t => t.id.startsWith(taskId))` to support partial ID matching (8-12 characters).
 *
 * ## Decision
 * We need to add tests that verify the push command supports partial task ID matching
 * after the implementation is updated to use the `listTasks + startsWith` pattern.
 *
 * ## Technical Design
 *
 * ### Test Structure
 * The tests should be added to a new test file following the existing test patterns:
 * - `packages/cli/src/__tests__/push-command.partial-id.test.ts`
 *
 * ### Test Cases Required
 * 1. **8-character partial ID matching** - Verify task is found with minimum 8-char prefix
 * 2. **12-character partial ID matching** - Verify task is found with 12-char prefix
 * 3. **Full ID matching** - Verify task is found with complete ID (backward compatibility)
 * 4. **Ambiguous partial ID handling** - When multiple tasks match same prefix, expected behavior
 * 5. **Non-matching partial ID** - Verify appropriate error message
 *
 * ### Interface Changes Required in Push Command
 *
 * Current implementation (packages/cli/src/index.ts:818-828):
 * ```typescript
 * const task = await ctx.orchestrator.getTask(taskId);
 * if (!task) {
 *   console.log(chalk.red(`Task not found: ${taskId}`));
 *   return;
 * }
 * ```
 *
 * Should become (following checkout/merge pattern):
 * ```typescript
 * const tasks = await ctx.orchestrator.listTasks({ limit: 100 });
 * const task = tasks.find(t => t.id.startsWith(taskId));
 * if (!task) {
 *   console.log(chalk.red(`Task not found: ${taskId}`));
 *   console.log(chalk.gray('Use /status to see available tasks or provide a longer task ID.'));
 *   return;
 * }
 * ```
 *
 * And the pushTaskBranch call should use the full resolved task.id:
 * ```typescript
 * const result = await ctx.orchestrator.pushTaskBranch(task.id);
 * ```
 *
 * ### Mock Setup Pattern
 * Tests should mock:
 * - `orchestrator.listTasks` - returns array of tasks
 * - `orchestrator.pushTaskBranch` - returns success/failure result
 *
 * ### Dependencies
 * - No new dependencies required
 * - Uses existing vitest testing framework
 * - Follows existing test patterns from merge-command.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task } from '@apex/core';
import type { ApexOrchestrator } from '@apex/orchestrator';
import { commands, type CliContext } from '../index.js';

// Test data helpers
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  description: 'Test task for push functionality',
  workflow: 'feature',
  autonomy: 'full',
  status: 'completed',
  priority: 'normal',
  effort: 'medium',
  projectPath: '/test/project',
  branchName: 'apex/test-feature',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  },
  logs: [],
  artifacts: [],
  ...overrides,
});

// No need for custom handler - use the actual push command from the CLI

describe('Push Command - Partial Task ID Matching', () => {
  let mockCtx: CliContext;
  let mockOrchestrator: any;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockOrchestrator = {
      listTasks: vi.fn(),
      pushTaskBranch: vi.fn(),
    };

    mockCtx = {
      cwd: process.cwd(),
      initialized: true,
      config: {} as any,
      orchestrator: mockOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Partial ID Resolution', () => {
    it('should resolve task with 8-character partial ID prefix', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const fullTaskId = 'task_1234567890abcdef';
      const partialId = fullTaskId.substring(0, 8); // 'task_123'

      const testTask = createTestTask({
        id: fullTaskId,
        branchName: 'apex/test-feature',
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([testTask]);
      (mockOrchestrator.pushTaskBranch as any).mockResolvedValue({ success: true });

      await pushCommand?.handler(mockCtx, [partialId]);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 100 });
      expect(mockOrchestrator.pushTaskBranch).toHaveBeenCalledWith(fullTaskId);
    });

    it('should resolve task with 12-character partial ID prefix', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const fullTaskId = 'task_1234567890abcdef';
      const partialId = fullTaskId.substring(0, 12); // 'task_1234567'

      const testTask = createTestTask({
        id: fullTaskId,
        branchName: 'apex/test-feature',
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([testTask]);
      (mockOrchestrator.pushTaskBranch as any).mockResolvedValue({ success: true });

      await pushCommand?.handler(mockCtx, [partialId]);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 100 });
      expect(mockOrchestrator.pushTaskBranch).toHaveBeenCalledWith(fullTaskId);
    });

    it('should resolve task with full ID (backward compatibility)', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const fullTaskId = 'task_1234567890abcdef';

      const testTask = createTestTask({
        id: fullTaskId,
        branchName: 'apex/test-feature',
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([testTask]);
      (mockOrchestrator.pushTaskBranch as any).mockResolvedValue({ success: true });

      await pushCommand?.handler(mockCtx, [fullTaskId]);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 100 });
      expect(mockOrchestrator.pushTaskBranch).toHaveBeenCalledWith(fullTaskId);
    });

    it('should match first task when multiple tasks have similar prefixes', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const task1 = createTestTask({
        id: 'task_abc123_first',
        branchName: 'apex/feature-1',
      });
      const task2 = createTestTask({
        id: 'task_abc123_second',
        branchName: 'apex/feature-2',
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([task1, task2]);
      (mockOrchestrator.pushTaskBranch as any).mockResolvedValue({ success: true });

      await pushCommand?.handler(mockCtx, ['task_abc']);

      // Should match the first task in the list
      expect(mockOrchestrator.pushTaskBranch).toHaveBeenCalledWith('task_abc123_first');
    });

    it('should display error when partial ID does not match any task', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      (mockOrchestrator.listTasks as any).mockResolvedValue([]);

      await pushCommand?.handler(mockCtx, ['nonexist']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found: nonexist'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Use /status to see available tasks or provide a longer task ID.')
      );
      expect(mockOrchestrator.pushTaskBranch).not.toHaveBeenCalled();
    });

    it('should handle very short partial IDs (minimum viable)', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const fullTaskId = 'task_unique_id_12345';
      const partialId = 'task_u'; // Very short but unique

      const testTask = createTestTask({
        id: fullTaskId,
        branchName: 'apex/test-feature',
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([testTask]);
      (mockOrchestrator.pushTaskBranch as any).mockResolvedValue({ success: true });

      await pushCommand?.handler(mockCtx, [partialId]);

      expect(mockOrchestrator.pushTaskBranch).toHaveBeenCalledWith(fullTaskId);
    });
  });

  describe('Push Operations with Partial ID', () => {
    it('should successfully push with partial ID and show success message', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const fullTaskId = 'task_push_test_123';
      const partialId = 'task_push';

      const testTask = createTestTask({
        id: fullTaskId,
        branchName: 'apex/push-test-branch',
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([testTask]);
      (mockOrchestrator.pushTaskBranch as any).mockResolvedValue({ success: true });

      await pushCommand?.handler(mockCtx, [partialId]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pushing branch apex/push-test-branch to remote')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully pushed apex/push-test-branch to origin')
      );
    });

    it('should handle push failure with partial ID correctly', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const fullTaskId = 'task_push_fail_123';
      const partialId = 'task_push_f';

      const testTask = createTestTask({
        id: fullTaskId,
        branchName: 'apex/push-fail-branch',
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([testTask]);
      (mockOrchestrator.pushTaskBranch as any).mockResolvedValue({
        success: false,
        error: 'Remote not configured',
      });

      await pushCommand?.handler(mockCtx, [partialId]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to push: Remote not configured'));
    });

    it('should reject task without branch when using partial ID', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const fullTaskId = 'task_no_branch_123';
      const partialId = 'task_no_b';

      const testTask = createTestTask({
        id: fullTaskId,
        branchName: undefined, // No branch
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([testTask]);

      await pushCommand?.handler(mockCtx, [partialId]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task does not have a branch')
      );
      expect(mockOrchestrator.pushTaskBranch).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle case sensitivity in partial ID matching', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const fullTaskId = 'task_ABC123_upper';

      const testTask = createTestTask({
        id: fullTaskId,
        branchName: 'apex/case-test',
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([testTask]);
      (mockOrchestrator.pushTaskBranch as any).mockResolvedValue({ success: true });

      // ID matching should be case-sensitive (startsWith is case-sensitive)
      await pushCommand?.handler(mockCtx, ['task_ABC']);

      expect(mockOrchestrator.pushTaskBranch).toHaveBeenCalledWith(fullTaskId);
    });

    it('should not match with different case prefix', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      const fullTaskId = 'task_ABC123_upper';

      const testTask = createTestTask({
        id: fullTaskId,
        branchName: 'apex/case-test',
      });

      (mockOrchestrator.listTasks as any).mockResolvedValue([testTask]);

      // Lowercase 'abc' should not match uppercase 'ABC'
      await pushCommand?.handler(mockCtx, ['task_abc']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found: task_abc'));
      expect(mockOrchestrator.pushTaskBranch).not.toHaveBeenCalled();
    });

    it('should handle orchestrator errors gracefully during task lookup', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      (mockOrchestrator.listTasks as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      // The push command doesn't have try-catch around listTasks, so it should throw
      await expect(pushCommand?.handler(mockCtx, ['task_123'])).rejects.toThrow('Database connection failed');
    });

    it('should handle empty task list', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      (mockOrchestrator.listTasks as any).mockResolvedValue([]);

      await pushCommand?.handler(mockCtx, ['any_task']);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Task not found: any_task'));
      expect(mockOrchestrator.pushTaskBranch).not.toHaveBeenCalled();
    });
  });
});
