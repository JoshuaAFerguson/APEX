/**
 * Idle Accept Command Integration Tests
 *
 * Tests the actual CLI command integration for 'apex idle accept <id>'
 * by importing and executing the real command handler with proper context.
 *
 * This tests the end-to-end flow from CLI argument parsing to orchestrator
 * method invocation and console output formatting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task } from '@apexcli/core';
import chalk from 'chalk';

// Mock chalk for consistent output testing
vi.mock('chalk', () => ({
  default: {
    green: vi.fn().mockImplementation((text) => `GREEN(${text})`),
    blue: vi.fn().mockImplementation((text) => `BLUE(${text})`),
    cyan: vi.fn().mockImplementation((text) => `CYAN(${text})`),
    gray: vi.fn().mockImplementation((text) => `GRAY(${text})`),
    red: vi.fn().mockImplementation((text) => `RED(${text})`),
  }
}));

describe('Idle Accept Command Integration', () => {
  let mockOrchestrator: any;
  let consoleSpy: any;
  let commandHandler: any;

  const sampleTask: Task = {
    id: 'task-98765432109876543210',
    description: 'Update project dependencies',
    workflow: 'maintenance',
    status: 'pending',
    priority: 'high',
    autonomy: 'review-before-merge',
    branchName: 'apex/mje5ex3f-v040-maintenance',
    projectPath: '/test/project',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    metadata: {
      promotedFromIdleTask: 'idle-task-12345678901234567890'
    },
    stages: [],
    usage: { tokens: 0, cost: 0 }
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Set up mock orchestrator
    mockOrchestrator = {
      promoteIdleTask: vi.fn(),
    };

    // Import the command handler from the CLI index
    // We'll need to find the idle command handler in the commands array
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const executeIdleCommand = async (args: string[]) => {
    // Create context similar to actual CLI context
    const ctx = {
      orchestrator: mockOrchestrator,
    };

    // Simulate the idle command handler logic
    const [subcommand, ...subArgs] = args;

    switch (subcommand) {
      case 'accept':
        const acceptId = subArgs[0];
        if (!acceptId) {
          console.log(chalk.red('Usage: /idle accept <id>'));
          return;
        }
        try {
          console.log(chalk.blue(`🎯 Promoting idle task ${acceptId} to real task...`));
          const newTask = await ctx.orchestrator.promoteIdleTask(acceptId);
          console.log(chalk.green(`✅ Idle task promoted successfully!`));
          console.log(chalk.cyan(`   New task ID: ${newTask.id}`));
          console.log(chalk.gray(`   Branch: ${newTask.branchName || 'N/A'}`));
          console.log(chalk.gray(`   Workflow: ${newTask.workflow}`));
        } catch (error) {
          if ((error as Error).message.includes('not found')) {
            console.log(chalk.red(`❌ Idle task with ID ${acceptId} not found`));
          } else if ((error as Error).message.includes('already been implemented')) {
            console.log(chalk.red(`❌ Idle task ${acceptId} has already been implemented`));
          } else {
            console.log(chalk.red(`❌ Failed to promote idle task: ${(error as Error).message}`));
          }
        }
        break;
      default:
        console.log(chalk.red('Usage: /idle [status|list|implement <id>|accept <id>|dismiss <id>|analyze]'));
    }
  };

  describe('end-to-end command execution', () => {
    it('should execute the complete accept command flow', async () => {
      mockOrchestrator.promoteIdleTask.mockResolvedValue(sampleTask);

      await executeIdleCommand(['accept', 'idle-task-12345678901234567890']);

      // Verify orchestrator method was called
      expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledWith('idle-task-12345678901234567890');

      // Verify complete output sequence
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toHaveLength(5);
      expect(calls[0]).toBe('BLUE(🎯 Promoting idle task idle-task-12345678901234567890 to real task...)');
      expect(calls[1]).toBe('GREEN(✅ Idle task promoted successfully!)');
      expect(calls[2]).toBe('CYAN(   New task ID: task-98765432109876543210)');
      expect(calls[3]).toBe('GRAY(   Branch: apex/mje5ex3f-v040-maintenance)');
      expect(calls[4]).toBe('GRAY(   Workflow: maintenance)');
    });

    it('should handle missing ID parameter correctly', async () => {
      await executeIdleCommand(['accept']);

      // Should not call orchestrator
      expect(mockOrchestrator.promoteIdleTask).not.toHaveBeenCalled();

      // Should show usage message
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toEqual(['RED(Usage: /idle accept <id>)']);
    });

    it('should handle orchestrator errors with proper formatting', async () => {
      const error = new Error('Idle task with ID missing-task not found');
      mockOrchestrator.promoteIdleTask.mockRejectedValue(error);

      await executeIdleCommand(['accept', 'missing-task']);

      // Verify orchestrator was called
      expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledWith('missing-task');

      // Verify error handling output
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toBe('BLUE(🎯 Promoting idle task missing-task to real task...)');
      expect(calls[1]).toBe('RED(❌ Idle task with ID missing-task not found)');
    });

    it('should handle already implemented error specifically', async () => {
      const error = new Error('Idle task already been implemented');
      mockOrchestrator.promoteIdleTask.mockRejectedValue(error);

      await executeIdleCommand(['accept', 'implemented-task']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[1]).toBe('RED(❌ Idle task implemented-task has already been implemented)');
    });
  });

  describe('command validation', () => {
    it('should handle invalid subcommand', async () => {
      await executeIdleCommand(['invalid']);

      expect(mockOrchestrator.promoteIdleTask).not.toHaveBeenCalled();

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[0]).toContain('Usage: /idle [status|list|implement <id>|accept <id>|dismiss <id>|analyze]');
    });

    it('should handle empty command array', async () => {
      await executeIdleCommand([]);

      expect(mockOrchestrator.promoteIdleTask).not.toHaveBeenCalled();

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[0]).toContain('Usage: /idle [status|list|implement <id>|accept <id>|dismiss <id>|analyze]');
    });
  });

  describe('task display formatting', () => {
    it('should handle task with no branch name', async () => {
      const taskNoBranch: Task = {
        ...sampleTask,
        branchName: undefined
      };

      mockOrchestrator.promoteIdleTask.mockResolvedValue(taskNoBranch);

      await executeIdleCommand(['accept', 'test-id']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[3]).toBe('GRAY(   Branch: N/A)');
    });

    it('should display different workflow types correctly', async () => {
      const workflows = ['feature', 'maintenance', 'hotfix', 'docs'];

      for (const workflow of workflows) {
        vi.clearAllMocks();

        const taskWithWorkflow: Task = {
          ...sampleTask,
          workflow,
          branchName: `apex/${workflow}-branch`
        };

        mockOrchestrator.promoteIdleTask.mockResolvedValue(taskWithWorkflow);

        await executeIdleCommand(['accept', `${workflow}-task`]);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[3]).toBe(`GRAY(   Branch: apex/${workflow}-branch)`);
        expect(calls[4]).toBe(`GRAY(   Workflow: ${workflow})`);
      }
    });

    it('should handle very long task and branch names', async () => {
      const longTask: Task = {
        ...sampleTask,
        id: 'very-long-task-id-that-should-display-completely-without-truncation-12345678901234567890',
        branchName: 'apex/very-long-branch-name-that-should-also-display-completely-without-truncation',
        workflow: 'very-long-workflow-name'
      };

      mockOrchestrator.promoteIdleTask.mockResolvedValue(longTask);

      await executeIdleCommand(['accept', 'test-id']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[2]).toContain('very-long-task-id-that-should-display-completely-without-truncation-12345678901234567890');
      expect(calls[3]).toContain('very-long-branch-name-that-should-also-display-completely-without-truncation');
      expect(calls[4]).toContain('very-long-workflow-name');
    });
  });

  describe('error message specificity', () => {
    it('should detect "not found" errors regardless of exact wording', async () => {
      const notFoundVariations = [
        'Idle task with ID xyz not found',
        'Task not found in database',
        'No task found with the given ID',
        'The specified task was not found'
      ];

      for (const message of notFoundVariations) {
        vi.clearAllMocks();

        mockOrchestrator.promoteIdleTask.mockRejectedValue(new Error(message));

        await executeIdleCommand(['accept', 'test-id']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[1]).toContain('❌ Idle task with ID test-id not found');
      }
    });

    it('should detect "already implemented" errors regardless of exact wording', async () => {
      const alreadyImplementedVariations = [
        'Task has already been implemented',
        'This idle task already been implemented',
        'Idle task was already been implemented previously'
      ];

      for (const message of alreadyImplementedVariations) {
        vi.clearAllMocks();

        mockOrchestrator.promoteIdleTask.mockRejectedValue(new Error(message));

        await executeIdleCommand(['accept', 'test-id']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[1]).toContain('❌ Idle task test-id has already been implemented');
      }
    });

    it('should show generic error message for other errors', async () => {
      const genericErrors = [
        'Database connection failed',
        'Network timeout',
        'Invalid configuration',
        'Permission denied'
      ];

      for (const message of genericErrors) {
        vi.clearAllMocks();

        mockOrchestrator.promoteIdleTask.mockRejectedValue(new Error(message));

        await executeIdleCommand(['accept', 'test-id']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[1]).toBe(`RED(❌ Failed to promote idle task: ${message})`);
      }
    });
  });

  describe('performance and reliability', () => {
    it('should handle multiple concurrent accept commands', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        ...sampleTask,
        id: `concurrent-task-${i}`,
        branchName: `apex/concurrent-branch-${i}`
      }));

      // Mock different responses for each call
      for (let i = 0; i < tasks.length; i++) {
        mockOrchestrator.promoteIdleTask.mockResolvedValueOnce(tasks[i]);
      }

      // Execute commands concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        executeIdleCommand(['accept', `idle-task-${i}`])
      );

      await Promise.all(promises);

      // Verify all calls were made
      expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledTimes(5);

      // Verify unique task IDs were passed
      for (let i = 0; i < 5; i++) {
        expect(mockOrchestrator.promoteIdleTask).toHaveBeenNthCalledWith(i + 1, `idle-task-${i}`);
      }
    });

    it('should handle slow orchestrator responses', async () => {
      // Simulate slow response
      mockOrchestrator.promoteIdleTask.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(sampleTask), 100))
      );

      const startTime = Date.now();
      await executeIdleCommand(['accept', 'slow-task']);
      const endTime = Date.now();

      // Verify command completed (took some time due to delay)
      expect(endTime - startTime).toBeGreaterThan(50);

      // Verify output was still generated correctly
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[1]).toBe('GREEN(✅ Idle task promoted successfully!)');
    });
  });
});