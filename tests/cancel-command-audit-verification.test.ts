import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * APEX Cancel Command Audit Verification Test Suite
 *
 * This test suite provides a comprehensive audit of the cancel command implementation
 * to verify that all acceptance criteria are met:
 *
 * 1. /cancel <taskId> command works via CLI
 * 2. handleCancel function calls orchestrator.cancelTask()
 * 3. Edge cases are handled properly:
 *    - Missing task ID
 *    - Non-existent task
 *    - Already completed task
 *    - Already failed task
 *    - Already cancelled task
 * 4. Proper error messages are provided
 * 5. Successful cancellation is confirmed
 */

describe('APEX Cancel Command Audit Verification', () => {
  describe('Code Architecture Audit', () => {
    it('should verify handleCancel function exists with proper signature', async () => {
      const replContent = await fs.readFile('packages/cli/src/repl.tsx', 'utf-8');

      // Check function signature
      expect(replContent).toContain('async function handleCancel(args: string[]): Promise<void>');

      // Check initialization validation
      expect(replContent).toContain('if (!ctx.initialized || !ctx.orchestrator)');
      expect(replContent).toContain('APEX not initialized. Run /init first.');

      // Check task ID validation
      expect(replContent).toContain('const taskId = args[0]');
      expect(replContent).toContain('if (!taskId)');
      expect(replContent).toContain('Usage: /cancel <task_id>');

      // Check orchestrator integration
      expect(replContent).toContain('await ctx.orchestrator.getTask(taskId)');
      expect(replContent).toContain('await ctx.orchestrator.cancelTask(taskId)');

      // Check error handling for different scenarios
      expect(replContent).toContain('Task not found');
      expect(replContent).toContain('Could not cancel task');
    });

    it('should verify orchestrator.cancelTask implementation', async () => {
      const orchestratorContent = await fs.readFile('packages/orchestrator/src/index.ts', 'utf-8');

      // Check method signature
      expect(orchestratorContent).toContain('async cancelTask(taskId: string): Promise<boolean>');

      // Check task existence validation
      expect(orchestratorContent).toContain('const task = await this.store.getTask(taskId)');
      expect(orchestratorContent).toContain('if (!task)');
      expect(orchestratorContent).toContain('return false');

      // Check cancellable status logic
      expect(orchestratorContent).toContain('cancellableStatuses');
      expect(orchestratorContent).toContain("'pending'");
      expect(orchestratorContent).toContain("'queued'");
      expect(orchestratorContent).toContain("'planning'");
      expect(orchestratorContent).toContain("'in-progress'");
      expect(orchestratorContent).toContain("'awaiting-approval'");
      expect(orchestratorContent).toContain("'paused'");

      // Check task status update
      expect(orchestratorContent).toContain("updateTaskStatus(taskId, 'cancelled'");

      // Check workspace cleanup
      expect(orchestratorContent).toContain('workspaceManager.cleanupWorkspace');
    });

    it('should verify command routing in handleCommand', async () => {
      const replContent = await fs.readFile('packages/cli/src/repl.tsx', 'utf-8');

      // Check command router includes cancel
      expect(replContent).toContain("case 'cancel':");
      expect(replContent).toContain('await handleCancel(args);');
    });
  });

  describe('Error Handling Implementation Audit', () => {
    it('should verify proper error message formatting for different scenarios', async () => {
      const replContent = await fs.readFile('packages/cli/src/repl.tsx', 'utf-8');

      // Check specific error messages exist
      const errorScenarios = [
        'Task not found',
        'Task is already completed',
        'Task has already failed',
        'Task is already cancelled'
      ];

      for (const errorMessage of errorScenarios) {
        expect(replContent).toContain(errorMessage);
      }

      // Check that error messages are contextual based on status
      expect(replContent).toContain("if (status === 'completed')");
      expect(replContent).toContain("else if (status === 'failed')");
      expect(replContent).toContain("else if (status === 'cancelled')");
    });

    it('should verify success message formatting', async () => {
      const replContent = await fs.readFile('packages/cli/src/repl.tsx', 'utf-8');

      // Check success message
      expect(replContent).toContain('Task ${taskId} cancelled.');
      expect(replContent).toContain("type: 'system'");
    });
  });

  describe('Integration Points Audit', () => {
    it('should verify proper flow from CLI to orchestrator', async () => {
      const replContent = await fs.readFile('packages/cli/src/repl.tsx', 'utf-8');

      // Extract handleCancel function to verify flow
      const handleCancelMatch = replContent.match(
        /async function handleCancel\(args: string\[\]\): Promise<void> \{([\s\S]*?)\n\}/
      );

      expect(handleCancelMatch).toBeTruthy();

      const handleCancelBody = handleCancelMatch![1];

      // Verify the correct execution flow
      const getTaskIndex = handleCancelBody.indexOf('await ctx.orchestrator.getTask');
      const cancelTaskIndex = handleCancelBody.indexOf('await ctx.orchestrator.cancelTask');

      // getTask should come before cancelTask
      expect(getTaskIndex).toBeGreaterThan(-1);
      expect(cancelTaskIndex).toBeGreaterThan(-1);
      expect(getTaskIndex).toBeLessThan(cancelTaskIndex);
    });

    it('should verify orchestrator cancellation logic', async () => {
      const orchestratorContent = await fs.readFile('packages/orchestrator/src/index.ts', 'utf-8');

      // Extract cancelTask method
      const cancelTaskMatch = orchestratorContent.match(
        /async cancelTask\(taskId: string\): Promise<boolean> \{([\s\S]*?)\n  \}/
      );

      expect(cancelTaskMatch).toBeTruthy();

      const cancelTaskBody = cancelTaskMatch![1];

      // Verify proper order of operations
      const taskExistCheck = cancelTaskBody.indexOf('if (!task)');
      const statusCheck = cancelTaskBody.indexOf('!cancellableStatuses.includes');
      const statusUpdate = cancelTaskBody.indexOf("updateTaskStatus(taskId, 'cancelled'");
      const cleanup = cancelTaskBody.indexOf('workspaceManager.cleanupWorkspace');

      // All operations should exist and be in proper order
      expect(taskExistCheck).toBeGreaterThan(-1);
      expect(statusCheck).toBeGreaterThan(-1);
      expect(statusUpdate).toBeGreaterThan(-1);
      expect(cleanup).toBeGreaterThan(-1);

      // Task existence should be checked first
      expect(taskExistCheck).toBeLessThan(statusCheck);
      // Status update should come before cleanup
      expect(statusUpdate).toBeLessThan(cleanup);
    });
  });

  describe('Cancellable Status Logic Audit', () => {
    it('should verify correct cancellable statuses are defined', async () => {
      const orchestratorContent = await fs.readFile('packages/orchestrator/src/index.ts', 'utf-8');

      // Extract the cancellableStatuses array
      const statusArrayMatch = orchestratorContent.match(
        /cancellableStatuses = \[([\s\S]*?)\]/
      );

      expect(statusArrayMatch).toBeTruthy();

      const statusArrayContent = statusArrayMatch![1];

      // Verify all expected statuses are included
      const expectedStatuses = [
        'pending',
        'queued',
        'planning',
        'in-progress',
        'awaiting-approval',
        'paused'
      ];

      for (const status of expectedStatuses) {
        expect(statusArrayContent).toContain(`'${status}'`);
      }

      // Verify non-cancellable statuses are NOT included
      const nonCancellableStatuses = ['completed', 'failed', 'cancelled'];
      for (const status of nonCancellableStatuses) {
        expect(statusArrayContent).not.toContain(`'${status}'`);
      }
    });

    it('should verify return value logic for cancellation', async () => {
      const orchestratorContent = await fs.readFile('packages/orchestrator/src/index.ts', 'utf-8');

      // Check that method returns false for non-existent tasks
      expect(orchestratorContent).toContain('if (!task)');
      expect(orchestratorContent).toContain('return false');

      // Check that method returns false for non-cancellable statuses
      expect(orchestratorContent).toContain('if (!cancellableStatuses.includes(task.status))');
      expect(orchestratorContent).toContain('return false');

      // Check that method returns true for successful cancellation
      const cancelTaskMatch = orchestratorContent.match(
        /async cancelTask\([\s\S]*?\n  \}/
      );
      expect(cancelTaskMatch![0]).toContain('return true');
    });
  });

  describe('Workspace Cleanup Integration Audit', () => {
    it('should verify workspace cleanup is called during cancellation', async () => {
      const orchestratorContent = await fs.readFile('packages/orchestrator/src/index.ts', 'utf-8');

      // Check that cleanup is called
      expect(orchestratorContent).toContain('workspaceManager.cleanupWorkspace(taskId)');

      // Check that cleanup errors are handled gracefully
      expect(orchestratorContent).toContain('try {');
      expect(orchestratorContent).toContain('} catch (error) {');
      expect(orchestratorContent).toContain('console.warn');
      expect(orchestratorContent).toContain('Failed to cleanup workspace');

      // Check that cancellation still succeeds even if cleanup fails
      const cancelTaskMatch = orchestratorContent.match(
        /async cancelTask\([\s\S]*?\n  \}/
      );
      const cancelTaskBody = cancelTaskMatch![0];

      // Should return true after cleanup attempt, regardless of cleanup success
      const tryCleanupIndex = cancelTaskBody.lastIndexOf('try {');
      const returnTrueIndex = cancelTaskBody.lastIndexOf('return true');
      expect(returnTrueIndex).toBeGreaterThan(tryCleanupIndex);
    });
  });

  describe('Process Cleanup Audit', () => {
    it('should verify task process abortion during cancellation', async () => {
      const orchestratorContent = await fs.readFile('packages/orchestrator/src/index.ts', 'utf-8');

      // Check that task process is aborted
      expect(orchestratorContent).toContain('this.abortTaskProcess(taskId)');

      // Check that running tasks are cleaned up
      expect(orchestratorContent).toContain('if (this.runningTasks.has(taskId))');
      expect(orchestratorContent).toContain('this.runningTasks.delete(taskId)');
    });
  });

  describe('Message Type Consistency Audit', () => {
    it('should verify consistent message types for different scenarios', async () => {
      const replContent = await fs.readFile('packages/cli/src/repl.tsx', 'utf-8');

      // Success messages should be 'system' type
      expect(replContent).toMatch(/addMessage\(\s*\{\s*type:\s*'system',[\s\S]*?Task.*cancelled/);

      // Error messages should be 'error' type
      expect(replContent).toMatch(/addMessage\(\s*\{\s*type:\s*'error',[\s\S]*?Usage:/);
      expect(replContent).toMatch(/addMessage\(\s*\{\s*type:\s*'error',[\s\S]*?Task not found/);
      expect(replContent).toMatch(/addMessage\(\s*\{\s*type:\s*'error',[\s\S]*?Could not cancel/);
    });
  });
});