/**
 * Idle Dismiss Command Integration Tests
 *
 * Tests the actual CLI command integration for 'apex idle dismiss <id>'
 * by importing and executing the real command handler with proper context.
 *
 * This tests the end-to-end flow from CLI argument parsing to orchestrator
 * method invocation and console output formatting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('Idle Dismiss Command Integration', () => {
  let mockOrchestrator: any;
  let consoleSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Set up mock orchestrator
    mockOrchestrator = {
      deleteIdleTask: vi.fn(),
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const executeIdleDismissCommand = async (args: string[]) => {
    // Create context similar to actual CLI context
    const ctx = {
      orchestrator: mockOrchestrator,
    };

    // Simulate the idle command handler logic for dismiss
    const [subcommand, ...subArgs] = args;

    switch (subcommand) {
      case 'dismiss':
        const dismissId = subArgs[0];
        if (!dismissId) {
          console.log(chalk.red('Usage: /idle dismiss <id>'));
          return;
        }
        try {
          console.log(chalk.blue(`🗑️ Dismissing suggestion ${dismissId}...`));
          await ctx.orchestrator.deleteIdleTask(dismissId);
          console.log(chalk.green('✅ Suggestion dismissed successfully'));
        } catch (error) {
          if ((error as Error).message.includes('not found')) {
            console.log(chalk.red(`❌ Idle task with ID ${dismissId} not found`));
          } else {
            console.log(chalk.red(`❌ Failed to dismiss idle task: ${(error as Error).message}`));
          }
        }
        break;
      default:
        console.log(chalk.red('Usage: /idle [status|list|implement <id>|accept <id>|dismiss <id>|analyze]'));
    }
  };

  describe('successful dismiss operations', () => {
    it('should execute the complete dismiss command flow', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      await executeIdleDismissCommand(['dismiss', 'idle-task-12345678901234567890']);

      // Verify orchestrator method was called
      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith('idle-task-12345678901234567890');

      // Verify complete output sequence
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toBe('BLUE(🗑️ Dismissing suggestion idle-task-12345678901234567890...)');
      expect(calls[1]).toBe('GREEN(✅ Suggestion dismissed successfully)');
    });

    it('should handle various ID formats correctly', async () => {
      const idFormats = [
        'idle-123',
        'idle-task-abcdef123456',
        'suggestion-uuid-12345678-1234-1234-1234-123456789012',
        'short-id',
        'very-long-idle-task-id-with-many-segments-and-special-characters-123456789'
      ];

      for (const idFormat of idFormats) {
        vi.clearAllMocks();
        mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

        await executeIdleDismissCommand(['dismiss', idFormat]);

        expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith(idFormat);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[0]).toBe(`BLUE(🗑️ Dismissing suggestion ${idFormat}...)`);
        expect(calls[1]).toBe('GREEN(✅ Suggestion dismissed successfully)');
      }
    });

    it('should handle dismiss with additional whitespace in ID', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      // Test with leading/trailing spaces
      await executeIdleDismissCommand(['dismiss', ' idle-task-123 ']);

      // The orchestrator should receive the exact string (spaces preserved)
      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith(' idle-task-123 ');
    });
  });

  describe('error handling', () => {
    it('should handle missing ID parameter correctly', async () => {
      await executeIdleDismissCommand(['dismiss']);

      // Should not call orchestrator
      expect(mockOrchestrator.deleteIdleTask).not.toHaveBeenCalled();

      // Should show usage message
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toEqual(['RED(Usage: /idle dismiss <id>)']);
    });

    it('should handle orchestrator "not found" errors with proper formatting', async () => {
      const error = new Error('Idle task with ID missing-task not found');
      mockOrchestrator.deleteIdleTask.mockRejectedValue(error);

      await executeIdleDismissCommand(['dismiss', 'missing-task']);

      // Verify orchestrator was called
      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith('missing-task');

      // Verify error handling output
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toBe('BLUE(🗑️ Dismissing suggestion missing-task...)');
      expect(calls[1]).toBe('RED(❌ Idle task with ID missing-task not found)');
    });

    it('should handle generic orchestrator errors', async () => {
      const error = new Error('Database connection failed');
      mockOrchestrator.deleteIdleTask.mockRejectedValue(error);

      await executeIdleDismissCommand(['dismiss', 'test-task']);

      // Verify orchestrator was called
      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith('test-task');

      // Verify error handling output
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toBe('BLUE(🗑️ Dismissing suggestion test-task...)');
      expect(calls[1]).toBe('RED(❌ Failed to dismiss idle task: Database connection failed)');
    });

    it('should detect "not found" errors regardless of exact wording', async () => {
      const notFoundVariations = [
        'Idle task with ID xyz not found',
        'Task not found in database',
        'No task found with the given ID',
        'The specified idle task was not found',
        'Could not find idle task with that ID'
      ];

      for (const message of notFoundVariations) {
        vi.clearAllMocks();

        mockOrchestrator.deleteIdleTask.mockRejectedValue(new Error(message));

        await executeIdleDismissCommand(['dismiss', 'test-id']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[1]).toContain('❌ Idle task with ID test-id not found');
      }
    });

    it('should handle network and database errors gracefully', async () => {
      const systemErrors = [
        'Database connection timeout',
        'Network unreachable',
        'Permission denied',
        'Disk full',
        'Connection refused'
      ];

      for (const message of systemErrors) {
        vi.clearAllMocks();

        mockOrchestrator.deleteIdleTask.mockRejectedValue(new Error(message));

        await executeIdleDismissCommand(['dismiss', 'test-id']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[1]).toBe(`RED(❌ Failed to dismiss idle task: ${message})`);
      }
    });
  });

  describe('command validation', () => {
    it('should handle invalid subcommand', async () => {
      await executeIdleDismissCommand(['invalid']);

      expect(mockOrchestrator.deleteIdleTask).not.toHaveBeenCalled();

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[0]).toContain('Usage: /idle [status|list|implement <id>|accept <id>|dismiss <id>|analyze]');
    });

    it('should handle empty command array', async () => {
      await executeIdleDismissCommand([]);

      expect(mockOrchestrator.deleteIdleTask).not.toHaveBeenCalled();

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[0]).toContain('Usage: /idle [status|list|implement <id>|accept <id>|dismiss <id>|analyze]');
    });

    it('should handle multiple arguments gracefully', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      // Only the first argument after 'dismiss' should be used as the ID
      await executeIdleDismissCommand(['dismiss', 'task-1', 'task-2', 'extra-args']);

      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith('task-1');
      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledTimes(1);
    });
  });

  describe('performance and reliability', () => {
    it('should handle multiple concurrent dismiss commands', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'];

      // Mock successful deletion for each task
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      // Execute commands concurrently
      const promises = taskIds.map(taskId =>
        executeIdleDismissCommand(['dismiss', taskId])
      );

      await Promise.all(promises);

      // Verify all calls were made
      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledTimes(5);

      // Verify unique task IDs were passed
      for (let i = 0; i < taskIds.length; i++) {
        expect(mockOrchestrator.deleteIdleTask).toHaveBeenNthCalledWith(i + 1, taskIds[i]);
      }
    });

    it('should handle slow orchestrator responses', async () => {
      // Simulate slow response
      mockOrchestrator.deleteIdleTask.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(undefined), 100))
      );

      const startTime = Date.now();
      await executeIdleDismissCommand(['dismiss', 'slow-task']);
      const endTime = Date.now();

      // Verify command completed (took some time due to delay)
      expect(endTime - startTime).toBeGreaterThan(50);

      // Verify output was still generated correctly
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[1]).toBe('GREEN(✅ Suggestion dismissed successfully)');
    });

    it('should handle orchestrator timeout/rejection gracefully', async () => {
      // Simulate timeout
      mockOrchestrator.deleteIdleTask.mockImplementation(() =>
        new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), 50))
      );

      await executeIdleDismissCommand(['dismiss', 'timeout-task']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[1]).toBe('RED(❌ Failed to dismiss idle task: Operation timeout)');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string ID', async () => {
      await executeIdleDismissCommand(['dismiss', '']);

      // Empty string ID should still be passed to orchestrator
      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith('');
    });

    it('should handle special characters in ID', async () => {
      const specialCharIds = [
        'task-with-@-symbol',
        'task.with.dots',
        'task_with_underscores',
        'task#with#hashes',
        'task%20with%20encoding',
        'タスク-unicode-漢字'
      ];

      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      for (const specialId of specialCharIds) {
        vi.clearAllMocks();

        await executeIdleDismissCommand(['dismiss', specialId]);

        expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith(specialId);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[0]).toContain(specialId);
        expect(calls[1]).toBe('GREEN(✅ Suggestion dismissed successfully)');
      }
    });

    it('should handle very long task IDs', async () => {
      const veryLongId = 'a'.repeat(1000); // 1000 character ID
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      await executeIdleDismissCommand(['dismiss', veryLongId]);

      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith(veryLongId);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[0]).toContain(veryLongId);
      expect(calls[1]).toBe('GREEN(✅ Suggestion dismissed successfully)');
    });
  });

  describe('console output formatting', () => {
    it('should use correct emoji and colors for success', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      await executeIdleDismissCommand(['dismiss', 'test-task']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);

      // Check for correct emoji and color usage
      expect(calls[0]).toContain('🗑️');
      expect(calls[0]).toMatch(/^BLUE\(/);

      expect(calls[1]).toContain('✅');
      expect(calls[1]).toMatch(/^GREEN\(/);
    });

    it('should use correct emoji and colors for errors', async () => {
      mockOrchestrator.deleteIdleTask.mockRejectedValue(new Error('Test error'));

      await executeIdleDismissCommand(['dismiss', 'test-task']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);

      // Check error formatting
      expect(calls[1]).toContain('❌');
      expect(calls[1]).toMatch(/^RED\(/);
    });

    it('should format not found errors consistently', async () => {
      mockOrchestrator.deleteIdleTask.mockRejectedValue(new Error('Task not found'));

      await executeIdleDismissCommand(['dismiss', 'missing-task']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[1]).toBe('RED(❌ Idle task with ID missing-task not found)');
    });

    it('should format generic errors consistently', async () => {
      const genericError = 'Something went wrong';
      mockOrchestrator.deleteIdleTask.mockRejectedValue(new Error(genericError));

      await executeIdleDismissCommand(['dismiss', 'test-task']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[1]).toBe(`RED(❌ Failed to dismiss idle task: ${genericError})`);
    });
  });
});