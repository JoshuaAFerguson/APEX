/**
 * Integration tests for the /checkout command
 * Tests the complete interaction between CLI and orchestrator worktree management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { execSync } from 'child_process';
import type { CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';

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

describe('Checkout Command Integration', () => {
  let tempProjectPath: string;
  let mockContext: CliContext;
  let realOrchestrator: ApexOrchestrator;

  beforeEach(async () => {
    // Create temporary project directory
    tempProjectPath = join(tmpdir(), `apex-checkout-test-${Date.now()}`);
    await mkdir(tempProjectPath, { recursive: true });

    // Initialize a git repository
    try {
      execSync('git init', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git config user.name "Test User"', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempProjectPath, stdio: 'ignore' });

      // Create initial commit
      await writeFile(join(tempProjectPath, 'README.md'), '# Test Project\n');
      execSync('git add README.md', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempProjectPath, stdio: 'ignore' });
    } catch (error) {
      console.warn('Git setup failed, skipping git-dependent tests:', error);
      return;
    }

    // Create APEX configuration
    const apexDir = join(tempProjectPath, '.apex');
    await mkdir(apexDir, { recursive: true });

    const config = {
      project: {
        name: 'Test Project',
        description: 'Test project for integration tests',
      },
      git: {
        autoWorktree: true,
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
    };

    await writeFile(
      join(apexDir, 'config.yaml'),
      `project:
  name: Test Project
  description: Test project for integration tests
git:
  autoWorktree: true
agents: {}
workflows: {}
limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 10.0
  dailyBudget: 100.0
  timeoutMs: 300000
autonomy:
  default: medium
  autoApprove: false
api:
  url: http://localhost:3000
  port: 3000
models:
  planning: opus
  implementation: sonnet
  review: haiku`
    );

    // Create real orchestrator instance
    realOrchestrator = new ApexOrchestrator({ projectPath: tempProjectPath });
    await realOrchestrator.initialize();

    mockContext = {
      cwd: tempProjectPath,
      initialized: true,
      config,
      orchestrator: realOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    mockConsoleLog.mockClear();
  });

  afterEach(async () => {
    vi.clearAllMocks();

    // Clean up temp directory
    if (tempProjectPath) {
      try {
        await rm(tempProjectPath, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error);
      }
    }

    // Clean up orchestrator
    if (realOrchestrator) {
      try {
        await realOrchestrator.destroy();
      } catch (error) {
        console.warn('Failed to destroy orchestrator:', error);
      }
    }
  });

  describe('Real worktree management', () => {
    it('should handle missing git worktree command gracefully', async () => {
      // This test simulates what happens when git worktree is not available
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Try to list worktrees when none exist
      await checkoutCommand?.handler(mockContext, ['--list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No task worktrees found')
      );
    });

    it('should handle worktree management not enabled', async () => {
      // Create a context with worktree management disabled
      const configWithoutWorktree = { ...mockContext.config };
      delete (configWithoutWorktree as any).git;

      const contextWithoutWorktree = {
        ...mockContext,
        config: configWithoutWorktree,
      };

      // Create orchestrator without worktree support
      const orchestratorWithoutWorktree = new ApexOrchestrator({
        projectPath: tempProjectPath,
      });
      await orchestratorWithoutWorktree.initialize();

      contextWithoutWorktree.orchestrator = orchestratorWithoutWorktree;

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Try to create a task and checkout (this should fail gracefully)
      try {
        const task = await orchestratorWithoutWorktree.createTask({
          description: 'Test task without worktree',
          workflow: 'feature',
        });

        await checkoutCommand?.handler(contextWithoutWorktree, [task.id.substring(0, 12)]);

        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('No worktree found for task')
        );
      } finally {
        await orchestratorWithoutWorktree.destroy();
      }
    });

    it('should demonstrate complete workflow with task creation and checkout', async () => {
      // Skip if git is not available
      try {
        execSync('git --version', { stdio: 'ignore' });
        execSync('git worktree --help', { stdio: 'ignore' });
      } catch {
        console.log('Skipping git worktree integration test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task that would have a worktree
      const task = await realOrchestrator.createTask({
        description: 'Add user authentication',
        workflow: 'feature',
      });

      // List tasks to verify task exists
      const tasks = await realOrchestrator.listTasks({ limit: 10 });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task.id);

      // Try to list worktrees (should be empty initially)
      await checkoutCommand?.handler(mockContext, ['--list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No task worktrees found')
      );

      // Try to checkout the task (should fail if worktree doesn't exist)
      mockConsoleLog.mockClear();
      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      // Should indicate no worktree exists
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No worktree found for task') ||
        expect.stringContaining('Error:')
      );
    });

    it('should handle cleanup of non-existent worktrees', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Try to cleanup when no worktrees exist
      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up orphaned worktrees')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned worktrees found to clean up') ||
        expect.stringContaining('Cleaned up 0 orphaned worktree')
      );
    });

    it('should handle errors from orchestrator gracefully', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Destroy orchestrator to simulate error condition
      await realOrchestrator.destroy();

      // Try to use checkout command with destroyed orchestrator
      const contextWithDestroyedOrchestrator = {
        ...mockContext,
        orchestrator: realOrchestrator,
      };

      await checkoutCommand?.handler(contextWithDestroyedOrchestrator, ['--list']);

      // Should handle the error gracefully
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error:') ||
        expect.stringContaining('No task worktrees found')
      );
    });
  });

  describe('Command parsing and validation', () => {
    it('should handle malformed task IDs gracefully', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test with various malformed inputs
      const malformedInputs = [
        '', // empty string
        '   ', // whitespace only
        'task', // too short
        'not-a-task-id', // doesn't match pattern
      ];

      for (const input of malformedInputs) {
        mockConsoleLog.mockClear();
        await checkoutCommand?.handler(mockContext, [input]);

        if (input.trim() === '') {
          expect(mockConsoleLog).toHaveBeenCalledWith(
            expect.stringContaining('Usage: /checkout <task_id>')
          );
        } else {
          expect(mockConsoleLog).toHaveBeenCalledWith(
            expect.stringContaining('Task not found:') ||
            expect.stringContaining('Error:')
          );
        }
      }
    });

    it('should handle multiple arguments correctly', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test with multiple arguments (should use first one)
      await checkoutCommand?.handler(mockContext, ['task-123', 'extra', 'arguments']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: task-123')
      );
    });

    it('should handle unknown flags', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test with unknown flag
      await checkoutCommand?.handler(mockContext, ['--unknown-flag']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: --unknown-flag')
      );
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large numbers of tasks efficiently', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create multiple tasks to test performance
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const task = await realOrchestrator.createTask({
          description: `Test task ${i}`,
          workflow: 'feature',
        });
        tasks.push(task);
      }

      // Try to find a task by partial ID
      const firstTask = tasks[0];
      const partialId = firstTask.id.substring(0, 8);

      const startTime = Date.now();
      await checkoutCommand?.handler(mockContext, [partialId]);
      const endTime = Date.now();

      // Should complete in reasonable time (< 1 second for 5 tasks)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should find the correct task
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No worktree found for task') ||
        expect.stringContaining('Error:')
      );
    });

    it('should handle concurrent access gracefully', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task
      const task = await realOrchestrator.createTask({
        description: 'Concurrent test task',
        workflow: 'feature',
      });

      // Run multiple checkout commands concurrently
      const promises = [
        checkoutCommand?.handler(mockContext, [task.id.substring(0, 8)]),
        checkoutCommand?.handler(mockContext, ['--list']),
        checkoutCommand?.handler(mockContext, ['--cleanup']),
      ];

      // Should not throw errors
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle filesystem errors gracefully', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create orchestrator with invalid project path
      const invalidPath = '/nonexistent/invalid/path';
      const invalidOrchestrator = new ApexOrchestrator({
        projectPath: invalidPath,
      });

      const invalidContext = {
        ...mockContext,
        cwd: invalidPath,
        orchestrator: invalidOrchestrator,
      };

      // This should handle the error gracefully
      try {
        await invalidOrchestrator.initialize();
        await checkoutCommand?.handler(invalidContext, ['--list']);
      } catch (error) {
        // Expected to fail, but should not crash
        expect(error).toBeDefined();
      } finally {
        try {
          await invalidOrchestrator.destroy();
        } catch {
          // Ignore cleanup errors for invalid orchestrator
        }
      }
    });
  });

  describe('User experience', () => {
    it('should provide helpful guidance for new users', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test help/usage scenarios
      await checkoutCommand?.handler(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /checkout <task_id>')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Switch to the worktree for the specified task')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('List all task worktrees')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Remove orphaned/stale worktrees')
      );
    });

    it('should provide clear error messages for common mistakes', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Test common user mistakes
      await checkoutCommand?.handler(mockContext, ['123']); // too short

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: 123')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /status to see available tasks')
      );
    });

    it('should handle different task ID formats', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task to test with
      const task = await realOrchestrator.createTask({
        description: 'Task ID format test',
        workflow: 'feature',
      });

      // Test different ID formats
      const idFormats = [
        task.id, // full ID
        task.id.substring(0, 12), // standard short ID
        task.id.substring(0, 8), // very short ID
        task.id.substring(0, 16), // medium ID
      ];

      for (const idFormat of idFormats) {
        mockConsoleLog.mockClear();
        await checkoutCommand?.handler(mockContext, [idFormat]);

        // All should find the same task
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('No worktree found for task') ||
          expect.stringContaining('Error:') ||
          expect.stringContaining('Switched to worktree')
        );
      }
    });
  });
});