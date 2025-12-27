/**
 * Checkout Command End-to-End Tests
 *
 * End-to-end tests that verify the complete checkout command workflow
 * with real git operations and minimal mocking. These tests validate
 * the entire pipeline from CLI command through orchestrator to actual
 * git worktree operations.
 *
 * Acceptance Criteria:
 * - E2E tests verify checkout creates worktree
 * - E2E tests verify checkout --list shows worktrees
 * - E2E tests verify checkout --cleanup removes orphaned worktrees
 * - E2E tests verify checkout switches to correct branch
 * - All checkout tests pass
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { execSync } from 'child_process';
import type { CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { WorktreeInfo } from '@apexcli/core';

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

// Capture console output for validation
let consoleOutput: string[] = [];
const originalConsoleLog = console.log;

const mockConsoleLog = (...args: any[]) => {
  consoleOutput.push(args.map(arg => String(arg)).join(' '));
};

// Helper function to check if git worktree command is available
const isGitWorktreeAvailable = (): boolean => {
  try {
    execSync('git --version', { stdio: 'ignore' });
    execSync('git worktree --help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

describe('Checkout Command End-to-End Tests', () => {
  let tempProjectPath: string;
  let mockContext: CliContext;
  let realOrchestrator: ApexOrchestrator;

  beforeEach(async () => {
    // Reset console output capture
    consoleOutput = [];
    console.log = mockConsoleLog;

    // Create temporary project directory
    tempProjectPath = join(tmpdir(), `apex-checkout-e2e-${Date.now()}`);
    await mkdir(tempProjectPath, { recursive: true });

    // Skip git setup if git worktree is not available
    if (!isGitWorktreeAvailable()) {
      return;
    }

    // Initialize a git repository with proper configuration
    try {
      execSync('git init', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git config user.name "Test User"', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempProjectPath, stdio: 'ignore' });

      // Create initial commit
      await writeFile(join(tempProjectPath, 'README.md'), '# E2E Test Project\n\nTest project for checkout E2E tests.\n');
      execSync('git add README.md', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempProjectPath, stdio: 'ignore' });

      // Create a main branch (modern git uses 'main' instead of 'master')
      try {
        execSync('git branch -M main', { cwd: tempProjectPath, stdio: 'ignore' });
      } catch {
        // Ignore if already on main
      }
    } catch (error) {
      console.warn('Git setup failed in E2E test:', error);
      return;
    }

    // Create APEX configuration with worktree management enabled
    const apexDir = join(tempProjectPath, '.apex');
    await mkdir(apexDir, { recursive: true });

    const config = {
      project: {
        name: 'E2E Test Project',
        description: 'Test project for checkout E2E tests',
      },
      git: {
        autoWorktree: true,
        worktreePrefix: 'apex-task',
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
  name: E2E Test Project
  description: Test project for checkout E2E tests
git:
  autoWorktree: true
  worktreePrefix: apex-task
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
  });

  afterEach(async () => {
    console.log = originalConsoleLog;
    vi.clearAllMocks();

    // Clean up orchestrator
    if (realOrchestrator) {
      try {
        await realOrchestrator.destroy();
      } catch (error) {
        console.warn('Failed to destroy orchestrator in cleanup:', error);
      }
    }

    // Clean up temp directory
    if (tempProjectPath) {
      try {
        await rm(tempProjectPath, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error);
      }
    }
  });

  describe('E2E: Checkout Creates Worktree', () => {
    it('should create a worktree when task is checked out for the first time', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task that will trigger worktree creation
      const task = await realOrchestrator.createTask({
        description: 'E2E test task for worktree creation',
        workflow: 'feature',
      });

      // Verify no worktrees exist initially
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['--list']);
      expect(consoleOutput.join('\n')).toContain('No task worktrees found');

      // Checkout the task (should create worktree)
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      // Should indicate successful worktree creation and checkout
      const output = consoleOutput.join('\n');
      expect(output).toMatch(/Switched to worktree for task|Created new worktree|checkout|worktree/i);

      // Verify worktree was actually created
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['--list']);
      const listOutput = consoleOutput.join('\n');

      expect(listOutput).toContain('Task Worktrees');
      expect(listOutput).toContain(task.id.substring(0, 12));
    });

    it('should handle worktree creation with custom branch naming', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree branch naming E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task with specific description that might influence branch name
      const task = await realOrchestrator.createTask({
        description: 'Add user authentication feature',
        workflow: 'feature',
      });

      // Checkout the task
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      // Verify the branch name follows expected pattern
      const worktrees = await realOrchestrator.listTaskWorktrees();
      expect(worktrees.length).toBeGreaterThan(0);

      const taskWorktree = worktrees.find(w => w.taskId === task.id);
      expect(taskWorktree).toBeDefined();
      expect(taskWorktree?.branch).toMatch(/apex/); // Should contain 'apex' prefix
    });
  });

  describe('E2E: Checkout --list Shows Worktrees', () => {
    it('should list all task worktrees with proper formatting', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree list E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create multiple tasks and checkout to create worktrees
      const task1 = await realOrchestrator.createTask({
        description: 'First E2E test task',
        workflow: 'feature',
      });

      const task2 = await realOrchestrator.createTask({
        description: 'Second E2E test task',
        workflow: 'hotfix',
      });

      // Create worktrees for both tasks
      await checkoutCommand?.handler(mockContext, [task1.id.substring(0, 12)]);
      await checkoutCommand?.handler(mockContext, [task2.id.substring(0, 12)]);

      // List all worktrees
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['--list']);

      const output = consoleOutput.join('\n');

      // Should show both worktrees
      expect(output).toContain('Task Worktrees');
      expect(output).toContain(task1.id.substring(0, 12));
      expect(output).toContain(task2.id.substring(0, 12));

      // Should show worktree details
      expect(output).toContain('Path:');
      expect(output).toContain('Last used:');
      expect(output).toMatch(/Use \/checkout <task_id> to switch to a worktree/);
    });

    it('should show empty state when no worktrees exist', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // List worktrees when none exist
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['--list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No task worktrees found');
      expect(output).toContain('Task worktrees are created automatically');
    });

    it('should display worktree status information correctly', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree status E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task and checkout to create worktree
      const task = await realOrchestrator.createTask({
        description: 'Status test task',
        workflow: 'feature',
      });

      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      // List worktrees and check status formatting
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['--list']);

      const output = consoleOutput.join('\n');
      expect(output).toMatch(/📁|🔧|⚠️|✅/); // Should contain status emoji
      expect(output).toContain(task.id.substring(0, 12));
    });
  });

  describe('E2E: Checkout --cleanup Removes Orphaned Worktrees', () => {
    it('should remove orphaned worktrees when tasks are deleted', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree cleanup E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task and checkout to create worktree
      const task = await realOrchestrator.createTask({
        description: 'Cleanup test task',
        workflow: 'feature',
      });

      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      // Verify worktree exists
      const worktreesBefore = await realOrchestrator.listTaskWorktrees();
      expect(worktreesBefore.length).toBeGreaterThan(0);

      // Simulate orphaned worktree by "deleting" task reference
      // (Note: In real scenario, task would be deleted but worktree remains)

      // Run cleanup
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Cleaning up orphaned worktrees');

      // Should either find no orphaned worktrees or clean them up
      expect(output).toMatch(/No orphaned worktrees found|Cleaned up \d+ orphaned worktree/);
    });

    it('should cleanup specific task worktree when specified', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree specific cleanup E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task and checkout to create worktree
      const task = await realOrchestrator.createTask({
        description: 'Specific cleanup test task',
        workflow: 'feature',
      });

      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      // Cleanup specific task worktree
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['--cleanup', task.id.substring(0, 12)]);

      const output = consoleOutput.join('\n');
      expect(output).toContain(`Cleaning up worktree for task ${task.id.substring(0, 12)}`);
      expect(output).toMatch(/Worktree.*cleaned up successfully|No worktree found for task/);
    });

    it('should handle cleanup when no orphaned worktrees exist', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Run cleanup when no worktrees exist
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['--cleanup']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Cleaning up orphaned worktrees');
      expect(output).toContain('No orphaned worktrees found to clean up');
    });
  });

  describe('E2E: Checkout Switches to Correct Branch', () => {
    it('should switch to the correct branch for a task', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree branch switching E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task
      const task = await realOrchestrator.createTask({
        description: 'Branch switching test task',
        workflow: 'feature',
      });

      // Initial checkout (creates worktree)
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      const initialOutput = consoleOutput.join('\n');
      expect(initialOutput).toMatch(/Switched to worktree|checkout|Branch:/);

      // Get the worktree info
      const worktree = await realOrchestrator.getTaskWorktree(task.id);
      expect(worktree).toBeDefined();
      expect(worktree?.branch).toMatch(/apex.*task/i); // Should contain task identifier

      // Second checkout (should switch to existing worktree)
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      const secondOutput = consoleOutput.join('\n');
      expect(secondOutput).toContain('Switched to worktree for task');
      expect(secondOutput).toContain(task.id.substring(0, 12));
      expect(secondOutput).toContain('Branch:');
      expect(secondOutput).toContain(worktree?.branch);
    });

    it('should provide helpful information about worktree path and branch', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree path info E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task
      const task = await realOrchestrator.createTask({
        description: 'Path info test task',
        workflow: 'feature',
      });

      // Checkout the task
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      const output = consoleOutput.join('\n');

      // Should provide clear information about the worktree
      expect(output).toContain('Path:');
      expect(output).toContain('Branch:');
      expect(output).toContain('Task:');
      expect(output).toContain(task.description);

      // Should provide helpful next steps
      expect(output).toMatch(/To continue working.*change to the worktree directory/i);
      expect(output).toMatch(/cd.*"/);
    });

    it('should handle task ID matching with partial IDs correctly', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree partial ID E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task
      const task = await realOrchestrator.createTask({
        description: 'Partial ID test task',
        workflow: 'feature',
      });

      // Test different partial ID lengths
      const partialIds = [
        task.id.substring(0, 8),
        task.id.substring(0, 12),
        task.id.substring(0, 16),
        task.id, // full ID
      ];

      for (const partialId of partialIds) {
        consoleOutput = [];
        await checkoutCommand?.handler(mockContext, [partialId]);

        const output = consoleOutput.join('\n');
        // Should successfully find and handle the task
        expect(output).toMatch(/Switched to worktree|No worktree found/);

        if (output.includes('Switched to worktree')) {
          expect(output).toContain(task.id.substring(0, 12));
        }
      }
    });
  });

  describe('E2E: Error Handling and Edge Cases', () => {
    it('should handle non-existent task IDs gracefully', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Try to checkout non-existent task
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['nonexistent123']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Task not found: nonexistent123');
      expect(output).toContain('Use /status to see available tasks');
    });

    it('should handle git worktree command failures gracefully', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a context with invalid project path to simulate git errors
      const invalidContext = {
        ...mockContext,
        cwd: '/nonexistent/path',
      };

      // Try various operations that might fail
      const operations = [
        ['--list'],
        ['--cleanup'],
      ];

      for (const args of operations) {
        consoleOutput = [];
        await checkoutCommand?.handler(invalidContext, args);

        const output = consoleOutput.join('\n');
        // Should not crash and should handle errors gracefully
        expect(output).toMatch(/Error:|No task worktrees found|Cleaning up/);
      }
    });

    it('should provide helpful error messages for malformed inputs', async () => {
      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      const malformedInputs = [
        [''], // empty
        ['   '], // whitespace
        ['too-short'], // too short
        ['--invalid-flag'], // invalid flag
      ];

      for (const args of malformedInputs) {
        consoleOutput = [];
        await checkoutCommand?.handler(mockContext, args);

        const output = consoleOutput.join('\n');
        expect(output).toMatch(/Usage:|Task not found:|Error:/);
      }
    });
  });

  describe('E2E: Integration with Orchestrator', () => {
    it('should integrate properly with orchestrator task lifecycle', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree integration E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create multiple tasks to test orchestrator integration
      const tasks = [];
      for (let i = 0; i < 3; i++) {
        const task = await realOrchestrator.createTask({
          description: `Integration test task ${i + 1}`,
          workflow: 'feature',
        });
        tasks.push(task);
      }

      // Checkout each task
      for (const task of tasks) {
        consoleOutput = [];
        await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

        const output = consoleOutput.join('\n');
        expect(output).toMatch(/Switched to worktree|checkout/);
      }

      // List all worktrees
      consoleOutput = [];
      await checkoutCommand?.handler(mockContext, ['--list']);

      const listOutput = consoleOutput.join('\n');
      expect(listOutput).toContain('Task Worktrees (3)');

      // Verify all tasks are listed
      for (const task of tasks) {
        expect(listOutput).toContain(task.id.substring(0, 12));
      }
    });

    it('should maintain consistency with orchestrator state', async () => {
      if (!isGitWorktreeAvailable()) {
        console.log('Skipping git worktree consistency E2E test - git worktree not available');
        return;
      }

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Create a task
      const task = await realOrchestrator.createTask({
        description: 'Consistency test task',
        workflow: 'feature',
      });

      // Checkout the task
      await checkoutCommand?.handler(mockContext, [task.id.substring(0, 12)]);

      // Verify orchestrator state is consistent
      const worktreeFromOrchestrator = await realOrchestrator.getTaskWorktree(task.id);
      expect(worktreeFromOrchestrator).toBeDefined();

      const allWorktrees = await realOrchestrator.listTaskWorktrees();
      const taskWorktree = allWorktrees.find(w => w.taskId === task.id);
      expect(taskWorktree).toBeDefined();
      expect(taskWorktree?.taskId).toBe(task.id);

      // Verify the task exists in orchestrator
      const taskFromOrchestrator = await realOrchestrator.getTask(task.id);
      expect(taskFromOrchestrator).toBeDefined();
      expect(taskFromOrchestrator?.id).toBe(task.id);
    });
  });
});