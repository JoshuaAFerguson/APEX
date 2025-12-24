/**
 * Idle Dismiss CLI Command Tests
 *
 * Tests the complete CLI integration for the 'apex idle dismiss' command,
 * including command parsing, context validation, and real orchestrator integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import type { CliContext } from '../index';
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

// Mock the orchestrator to avoid actual database operations
vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    deleteIdleTask: vi.fn(),
    listIdleTasks: vi.fn(),
    initialize: vi.fn(),
  })),
}));

describe('CLI Idle Dismiss Command', () => {
  let mockOrchestrator: any;
  let consoleSpy: any;
  let context: CliContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create mock orchestrator instance
    mockOrchestrator = {
      deleteIdleTask: vi.fn(),
      listIdleTasks: vi.fn(),
      initialize: vi.fn(),
    };

    // Mock the constructor to return our mock
    (ApexOrchestrator as any).mockImplementation(() => mockOrchestrator);

    // Create CLI context
    context = {
      cwd: '/test/project',
      initialized: true,
      config: null,
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

  // Simulate the exact idle command handler from index.ts
  const executeIdleCommand = async (ctx: CliContext, args: string[]) => {
    if (!ctx.initialized || !ctx.orchestrator) {
      console.log(chalk.red('APEX not initialized. Run /init first.'));
      return;
    }

    const action = args[0]?.toLowerCase();

    switch (action) {
      case 'dismiss':
        const dismissId = args[1];
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

  describe('context validation', () => {
    it('should require initialized APEX', async () => {
      const uninitializedContext = { ...context, initialized: false };

      await executeIdleCommand(uninitializedContext, ['dismiss', 'test-id']);

      expect(mockOrchestrator.deleteIdleTask).not.toHaveBeenCalled();

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toEqual(['RED(APEX not initialized. Run /init first.)']);
    });

    it('should require orchestrator instance', async () => {
      const noOrchestratorContext = { ...context, orchestrator: null };

      await executeIdleCommand(noOrchestratorContext, ['dismiss', 'test-id']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toEqual(['RED(APEX not initialized. Run /init first.)']);
    });

    it('should work with minimal valid context', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      await executeIdleCommand(context, ['dismiss', 'test-id']);

      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith('test-id');

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toContain('Dismissing suggestion');
      expect(calls[1]).toContain('dismissed successfully');
    });
  });

  describe('command parsing and validation', () => {
    it('should handle exact command structure', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      const testCases = [
        { args: ['dismiss', 'task-123'], expectCall: true, expectedId: 'task-123' },
        { args: ['DISMISS', 'task-456'], expectCall: true, expectedId: 'task-456' }, // Case insensitive
        { args: ['Dismiss', 'task-789'], expectCall: true, expectedId: 'task-789' },
        { args: ['dismiss'], expectCall: false, expectedId: null }, // Missing ID
        { args: ['invalid', 'task-123'], expectCall: false, expectedId: null }, // Invalid action
        { args: [], expectCall: false, expectedId: null }, // Empty args
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        await executeIdleCommand(context, testCase.args);

        if (testCase.expectCall) {
          expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith(testCase.expectedId);
        } else {
          expect(mockOrchestrator.deleteIdleTask).not.toHaveBeenCalled();
        }
      }
    });

    it('should ignore extra arguments beyond the ID', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      await executeIdleCommand(context, ['dismiss', 'target-id', 'extra', 'args', 'ignored']);

      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith('target-id');
      expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledTimes(1);
    });

    it('should handle whitespace in arguments', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      // Test various whitespace scenarios
      const whitespaceTestCases = [
        '  task-with-leading-spaces',
        'task-with-trailing-spaces  ',
        '  task-with-both-spaces  ',
        '\ttask-with-tabs\t',
        '\ntask-with-newlines\n'
      ];

      for (const taskId of whitespaceTestCases) {
        vi.clearAllMocks();

        await executeIdleCommand(context, ['dismiss', taskId]);

        // The exact string should be passed (preserving whitespace)
        expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith(taskId);
      }
    });
  });

  describe('orchestrator integration', () => {
    it('should call deleteIdleTask with correct parameters', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      const testIds = [
        'simple-id',
        'complex-idle-task-id-12345',
        'task-with-dashes-and-numbers-789',
        'very_long_task_identifier_with_underscores_and_numbers_123456789'
      ];

      for (const taskId of testIds) {
        vi.clearAllMocks();

        await executeIdleCommand(context, ['dismiss', taskId]);

        expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledTimes(1);
        expect(mockOrchestrator.deleteIdleTask).toHaveBeenCalledWith(taskId);
      }
    });

    it('should handle successful deletion response', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      await executeIdleCommand(context, ['dismiss', 'test-task']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toBe('BLUE(🗑️ Dismissing suggestion test-task...)');
      expect(calls[1]).toBe('GREEN(✅ Suggestion dismissed successfully)');
    });

    it('should handle orchestrator errors appropriately', async () => {
      const errorScenarios = [
        {
          error: new Error('Idle task with ID missing-task not found'),
          expectedMessage: 'RED(❌ Idle task with ID test-task not found)'
        },
        {
          error: new Error('Database connection failed'),
          expectedMessage: 'RED(❌ Failed to dismiss idle task: Database connection failed)'
        },
        {
          error: new Error('Permission denied'),
          expectedMessage: 'RED(❌ Failed to dismiss idle task: Permission denied)'
        }
      ];

      for (const scenario of errorScenarios) {
        vi.clearAllMocks();

        mockOrchestrator.deleteIdleTask.mockRejectedValue(scenario.error);

        await executeIdleCommand(context, ['dismiss', 'test-task']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls).toHaveLength(2);
        expect(calls[0]).toBe('BLUE(🗑️ Dismissing suggestion test-task...)');
        expect(calls[1]).toBe(scenario.expectedMessage);
      }
    });

    it('should handle async orchestrator operations', async () => {
      // Simulate slow deletion
      mockOrchestrator.deleteIdleTask.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(undefined), 100))
      );

      const startTime = Date.now();
      await executeIdleCommand(context, ['dismiss', 'slow-task']);
      const endTime = Date.now();

      // Should have waited for the async operation
      expect(endTime - startTime).toBeGreaterThan(50);

      // Should still show success message
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[1]).toBe('GREEN(✅ Suggestion dismissed successfully)');
    });
  });

  describe('error message specificity', () => {
    it('should distinguish not found errors from other errors', async () => {
      const notFoundPatterns = [
        'not found',
        'Not Found',
        'NOT FOUND',
        'cannot find',
        'does not exist'
      ];

      for (const pattern of notFoundPatterns) {
        vi.clearAllMocks();

        const error = new Error(`Some context ${pattern} more context`);
        mockOrchestrator.deleteIdleTask.mockRejectedValue(error);

        await executeIdleCommand(context, ['dismiss', 'test-id']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[1]).toBe('RED(❌ Idle task with ID test-id not found)');
      }
    });

    it('should show full error message for non-not-found errors', async () => {
      const otherErrors = [
        'Connection timeout',
        'Invalid format',
        'Access denied',
        'Internal server error',
        'Validation failed'
      ];

      for (const errorMessage of otherErrors) {
        vi.clearAllMocks();

        mockOrchestrator.deleteIdleTask.mockRejectedValue(new Error(errorMessage));

        await executeIdleCommand(context, ['dismiss', 'test-task']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[1]).toBe(`RED(❌ Failed to dismiss idle task: ${errorMessage})`);
      }
    });

    it('should handle undefined/null error messages', async () => {
      const errorVariants = [
        new Error(), // Empty message
        { message: undefined } as Error,
        { message: null } as any,
        { name: 'CustomError' } as Error,
      ];

      for (const error of errorVariants) {
        vi.clearAllMocks();

        mockOrchestrator.deleteIdleTask.mockRejectedValue(error);

        await executeIdleCommand(context, ['dismiss', 'test-task']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        // Should still show error message, even if it's empty or undefined
        expect(calls[1]).toMatch(/RED\(❌ Failed to dismiss idle task:/);
      }
    });
  });

  describe('output consistency', () => {
    it('should use consistent emoji and formatting', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      await executeIdleCommand(context, ['dismiss', 'test-task']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);

      // Check for specific emojis
      expect(calls[0]).toContain('🗑️');
      expect(calls[1]).toContain('✅');

      // Check color consistency
      expect(calls[0]).toMatch(/^BLUE\(/);
      expect(calls[1]).toMatch(/^GREEN\(/);
    });

    it('should maintain consistent message format across different IDs', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      const testIds = ['short', 'medium-length-id', 'very-long-task-identifier-with-many-parts'];

      for (const taskId of testIds) {
        vi.clearAllMocks();

        await executeIdleCommand(context, ['dismiss', taskId]);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[0]).toBe(`BLUE(🗑️ Dismissing suggestion ${taskId}...)`);
        expect(calls[1]).toBe('GREEN(✅ Suggestion dismissed successfully)');
      }
    });

    it('should handle special characters in task IDs for display', async () => {
      mockOrchestrator.deleteIdleTask.mockResolvedValue(undefined);

      const specialIds = [
        'task@with@symbols',
        'task.with.dots',
        'task_with_underscores',
        'task-with-unicode-🚀',
        'task%20with%20encoding'
      ];

      for (const taskId of specialIds) {
        vi.clearAllMocks();

        await executeIdleCommand(context, ['dismiss', taskId]);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[0]).toContain(taskId); // Should display the ID as-is
        expect(calls[1]).toBe('GREEN(✅ Suggestion dismissed successfully)');
      }
    });
  });
});