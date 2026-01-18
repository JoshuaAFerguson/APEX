/**
 * @fileoverview Comprehensive integration tests for CLI confirmation prompts
 * Tests all aspects of confirmation prompt integration including timeout handling,
 * spinner integration, user input capture, and orchestrator communication
 */

import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import {
  shouldShowConfirmation,
  confirmDangerousOperation,
  requestConfirmation,
  showOperationCancelled,
  DangerousOperation
} from '../confirmation.js';
import type { AutonomyLevel } from '@apexcli/core';

// Mock dependencies
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

vi.mock('chalk', () => {
  const mockChalk = vi.fn((str: string) => str);
  mockChalk.red = vi.fn((str: string) => `[RED]${str}`);
  mockChalk.yellow = vi.fn((str: string) => `[YELLOW]${str}`);
  mockChalk.cyan = vi.fn((str: string) => `[CYAN]${str}`);
  mockChalk.gray = vi.fn((str: string) => `[GRAY]${str}`);
  mockChalk.green = vi.fn((str: string) => `[GREEN]${str}`);
  mockChalk.blue = vi.fn((str: string) => `[BLUE]${str}`);
  mockChalk.magenta = vi.fn((str: string) => `[MAGENTA]${str}`);
  mockChalk.bold = vi.fn((str: string) => `[BOLD]${str}`);
  mockChalk.dim = vi.fn((str: string) => `[DIM]${str}`);
  return { default: mockChalk };
});

vi.mock('ora', () => {
  const mockSpinner = {
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    text: ''
  };
  return {
    default: vi.fn(() => mockSpinner)
  };
});

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Comprehensive CLI Confirmation Integration Tests', () => {
  let mockPrompt: Mock;
  let mockOra: Mock;
  let mockSpinner: any;

  beforeEach(() => {
    mockPrompt = vi.mocked(inquirer.prompt);
    mockOra = vi.mocked(ora);
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      warn: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
      text: ''
    };
    mockOra.mockReturnValue(mockSpinner);
    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CLI surfaces confirmation prompts using inquirer', () => {
    it('should use inquirer.prompt with correct configuration for all operations', async () => {
      const operations = Object.values(DangerousOperation);

      for (const operation of operations) {
        mockPrompt.mockResolvedValueOnce({ confirmed: true });

        await confirmDangerousOperation(operation);

        expect(mockPrompt).toHaveBeenCalledWith([
          {
            type: 'confirm',
            name: 'confirmed',
            message: expect.stringContaining('Are you sure you want to proceed'),
            default: false
          }
        ]);

        mockPrompt.mockClear();
      }
    });

    it('should properly integrate inquirer with autonomy level checking', async () => {
      const testCases = [
        {
          operation: DangerousOperation.CANCEL_TASK,
          autonomy: 'full' as AutonomyLevel,
          shouldPrompt: false,
          description: 'Full autonomy should skip medium-consequence operations'
        },
        {
          operation: DangerousOperation.EMPTY_TRASH,
          autonomy: 'full' as AutonomyLevel,
          shouldPrompt: true,
          description: 'Full autonomy should still prompt for high-consequence irreversible operations'
        },
        {
          operation: DangerousOperation.MERGE_TASK,
          autonomy: 'review-before-merge' as AutonomyLevel,
          shouldPrompt: true,
          description: 'Review-before-merge should prompt for merge operations'
        },
        {
          operation: DangerousOperation.TRASH_TASK,
          autonomy: 'manual' as AutonomyLevel,
          shouldPrompt: true,
          description: 'Manual mode should always prompt'
        }
      ];

      for (const testCase of testCases) {
        mockPrompt.mockResolvedValueOnce({ confirmed: true });

        const result = await requestConfirmation(
          testCase.operation,
          testCase.autonomy
        );

        expect(result).toBe(true);

        if (testCase.shouldPrompt) {
          expect(mockPrompt).toHaveBeenCalled();
        } else {
          expect(mockPrompt).not.toHaveBeenCalled();
        }

        mockPrompt.mockClear();
      }
    });

    it('should handle inquirer prompt rejections gracefully', async () => {
      const errorTypes = [
        'User interrupted',
        'Input stream closed',
        'SIGINT received',
        'Prompt timeout'
      ];

      for (const errorType of errorTypes) {
        mockPrompt.mockRejectedValueOnce(new Error(errorType));

        await expect(
          confirmDangerousOperation(DangerousOperation.CANCEL_TASK)
        ).rejects.toThrow(errorType);

        mockPrompt.mockClear();
      }
    });
  });

  describe('Prompts display correct message and options', () => {
    it('should display operation-specific titles and descriptions with correct formatting', async () => {
      const testCases = [
        {
          operation: DangerousOperation.EMPTY_TRASH,
          expectedColor: '[RED]',
          expectedTitle: '⚠️  Empty Trash (Permanent Deletion)',
          expectedDescription: 'This will permanently delete all tasks in trash. This action cannot be undone.',
          expectsIrreversibleWarning: true
        },
        {
          operation: DangerousOperation.CANCEL_TASK,
          expectedColor: '[YELLOW]',
          expectedTitle: '⚠️  Cancel Running Task',
          expectedDescription: 'This will terminate the currently running task and any partial progress will be lost.',
          expectsIrreversibleWarning: false
        },
        {
          operation: DangerousOperation.TRASH_TASK,
          expectedColor: '[CYAN]',
          expectedTitle: '⚠️  Move Task to Trash',
          expectedDescription: 'This will move the task to trash. You can restore it later if needed.',
          expectsIrreversibleWarning: false
        }
      ];

      for (const testCase of testCases) {
        mockPrompt.mockResolvedValueOnce({ confirmed: true });

        await confirmDangerousOperation(testCase.operation);

        expect(mockConsoleLog).toHaveBeenCalledWith(
          `${testCase.expectedColor}${testCase.expectedTitle}`
        );
        expect(mockConsoleLog).toHaveBeenCalledWith(
          `[GRAY]${testCase.expectedDescription}`
        );

        if (testCase.expectsIrreversibleWarning) {
          expect(mockConsoleLog).toHaveBeenCalledWith(
            '[RED]🚨 This action is irreversible!'
          );
        }

        mockConsoleLog.mockClear();
        mockPrompt.mockClear();
      }
    });

    it('should display context information with correct formatting', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const contextOptions = {
        context: 'Status: running, Stage: implementation, Progress: 75%',
        resourceId: 'task-abc-123',
        resourceDescription: 'Implement user authentication system'
      };

      await confirmDangerousOperation(DangerousOperation.CANCEL_TASK, contextOptions);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]Context: Status: running, Stage: implementation, Progress: 75%'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Resource: task-abc-123');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]Description: Implement user authentication system'
      );
    });

    it('should format prompt messages correctly for all operation types', async () => {
      const expectedMessages = {
        [DangerousOperation.CANCEL_TASK]: 'Are you sure you want to proceed with this cancel task?',
        [DangerousOperation.TRASH_TASK]: 'Are you sure you want to proceed with this trash task?',
        [DangerousOperation.EMPTY_TRASH]: 'Are you sure you want to proceed with this empty trash?',
        [DangerousOperation.MERGE_TASK]: 'Are you sure you want to proceed with this merge task?',
        [DangerousOperation.DELETE_TEMPLATE]: 'Are you sure you want to proceed with this delete template?',
        [DangerousOperation.UNARCHIVE_TASK]: 'Are you sure you want to proceed with this unarchive task?'
      };

      for (const [operation, expectedMessage] of Object.entries(expectedMessages)) {
        mockPrompt.mockResolvedValueOnce({ confirmed: true });

        await confirmDangerousOperation(operation as DangerousOperation);

        expect(mockPrompt).toHaveBeenCalledWith([
          {
            type: 'confirm',
            name: 'confirmed',
            message: expectedMessage,
            default: false
          }
        ]);

        mockPrompt.mockClear();
      }
    });
  });

  describe('User input capture and orchestrator communication', () => {
    it('should capture user confirmation input and return correct boolean values', async () => {
      const inputTestCases = [
        { userInput: { confirmed: true }, expectedResult: true },
        { userInput: { confirmed: false }, expectedResult: false },
        { userInput: { confirmed: undefined }, expectedResult: false },
        { userInput: { wrongProperty: true }, expectedResult: false },
        { userInput: {}, expectedResult: false }
      ];

      for (const testCase of inputTestCases) {
        mockPrompt.mockResolvedValueOnce(testCase.userInput);

        const result = await confirmDangerousOperation(DangerousOperation.CANCEL_TASK);

        expect(result).toBe(testCase.expectedResult);
        expect(mockPrompt).toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining({
            type: 'confirm',
            name: 'confirmed'
          })
        ]));

        mockPrompt.mockClear();
      }
    });

    it('should properly propagate confirmation results through the requestConfirmation flow', async () => {
      const testScenarios = [
        {
          operation: DangerousOperation.MERGE_TASK,
          autonomy: 'manual' as AutonomyLevel,
          userConfirms: true,
          expectedResult: true,
          description: 'User confirmation should propagate through manual autonomy'
        },
        {
          operation: DangerousOperation.MERGE_TASK,
          autonomy: 'manual' as AutonomyLevel,
          userConfirms: false,
          expectedResult: false,
          description: 'User rejection should propagate through manual autonomy'
        },
        {
          operation: DangerousOperation.TRASH_TASK,
          autonomy: 'full' as AutonomyLevel,
          userConfirms: false, // This won't matter since no prompt is shown
          expectedResult: true,
          description: 'Full autonomy should skip prompt and return true'
        }
      ];

      for (const scenario of testScenarios) {
        if (shouldShowConfirmation(scenario.operation, scenario.autonomy)) {
          mockPrompt.mockResolvedValueOnce({ confirmed: scenario.userConfirms });
        }

        const result = await requestConfirmation(scenario.operation, scenario.autonomy);

        expect(result).toBe(scenario.expectedResult);

        mockPrompt.mockClear();
      }
    });

    it('should handle force confirmation flag correctly', async () => {
      // Test that forceConfirmation overrides autonomy level
      mockPrompt.mockResolvedValue({ confirmed: true });

      const result = await requestConfirmation(
        DangerousOperation.TRASH_TASK, // Normally wouldn't prompt in full autonomy
        'full',
        { forceConfirmation: true }
      );

      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalled();

      // Verify the prompt was called with the correct configuration
      expect(mockPrompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to proceed with this trash task?',
          default: false
        }
      ]);
    });
  });

  describe('CLI handles confirmation timeouts', () => {
    it('should handle inquirer timeout errors appropriately', async () => {
      const timeoutError = new Error('Prompt timeout after 30 seconds');
      timeoutError.name = 'PromptTimeoutError';

      mockPrompt.mockRejectedValue(timeoutError);

      await expect(
        confirmDangerousOperation(DangerousOperation.EMPTY_TRASH)
      ).rejects.toThrow('Prompt timeout after 30 seconds');
    });

    it('should handle various timeout-related errors', async () => {
      const timeoutErrors = [
        new Error('Input timeout'),
        new Error('Read timeout'),
        new Error('User interaction timeout'),
        new Error('TTY timeout')
      ];

      for (const error of timeoutErrors) {
        mockPrompt.mockRejectedValueOnce(error);

        await expect(
          confirmDangerousOperation(DangerousOperation.CANCEL_TASK)
        ).rejects.toThrow(error.message);

        mockPrompt.mockClear();
      }
    });

    it('should handle graceful degradation when inquirer times out', async () => {
      // Test that timeout errors bubble up properly and don't cause silent failures
      const timeoutError = new Error('Inquirer prompt timed out');
      mockPrompt.mockRejectedValue(timeoutError);

      let caughtError: Error | null = null;
      try {
        await confirmDangerousOperation(DangerousOperation.MERGE_TASK);
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).toBe('Inquirer prompt timed out');
    });

    it('should maintain operation state during timeout scenarios', async () => {
      mockPrompt.mockRejectedValue(new Error('Operation timed out'));

      // Ensure that a timeout doesn't accidentally approve an operation
      await expect(
        requestConfirmation(DangerousOperation.EMPTY_TRASH, 'manual')
      ).rejects.toThrow('Operation timed out');

      // Verify that the prompt was attempted
      expect(mockPrompt).toHaveBeenCalled();
    });
  });

  describe('Chalk/ora formatting for confirmation states', () => {
    it('should use appropriate chalk colors for different consequence levels', async () => {
      const colorTestCases = [
        {
          operation: DangerousOperation.EMPTY_TRASH,
          expectedColor: 'red',
          consequenceLevel: 'high'
        },
        {
          operation: DangerousOperation.CANCEL_TASK,
          expectedColor: 'yellow',
          consequenceLevel: 'medium'
        },
        {
          operation: DangerousOperation.TRASH_TASK,
          expectedColor: 'cyan',
          consequenceLevel: 'low'
        }
      ];

      for (const testCase of colorTestCases) {
        mockPrompt.mockResolvedValueOnce({ confirmed: true });

        await confirmDangerousOperation(testCase.operation);

        // Verify the correct chalk color function was called
        const chalkMock = vi.mocked(chalk);
        expect(chalkMock[testCase.expectedColor as keyof typeof chalkMock]).toHaveBeenCalled();

        vi.clearAllMocks();
      }
    });

    it('should display cancellation messages with correct chalk formatting', () => {
      const operations = Object.values(DangerousOperation);

      for (const operation of operations) {
        showOperationCancelled(operation);

        // Verify yellow color is used for cancellation messages
        const chalkMock = vi.mocked(chalk);
        expect(chalkMock.yellow).toHaveBeenCalledWith(
          expect.stringContaining('cancelled by user')
        );

        vi.clearAllMocks();
      }
    });

    it('should integrate with ora spinner for confirmation states', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      // Simulate a confirmation flow that might use spinners
      const spinner = ora('Processing confirmation...');
      spinner.start();

      const result = await confirmDangerousOperation(DangerousOperation.MERGE_TASK);

      if (result) {
        spinner.succeed('Operation confirmed');
      } else {
        spinner.fail('Operation cancelled');
      }

      // Verify ora integration
      expect(mockOra).toHaveBeenCalledWith('Processing confirmation...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Operation confirmed');
      expect(result).toBe(true);
    });

    it('should handle complex formatting scenarios', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      const spinner = ora('Waiting for user confirmation...');
      spinner.start();

      const contextOptions = {
        context: 'Critical operation requiring confirmation',
        resourceId: 'prod-database-backup',
        resourceDescription: 'Production database containing sensitive data'
      };

      const result = await confirmDangerousOperation(
        DangerousOperation.DELETE_TEMPLATE,
        contextOptions
      );

      if (!result) {
        spinner.warn('Operation was cancelled by user');
        showOperationCancelled(DangerousOperation.DELETE_TEMPLATE);
      }

      // Verify the complete formatting flow
      expect(mockOra).toHaveBeenCalled();
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.warn).toHaveBeenCalledWith('Operation was cancelled by user');

      // Verify chalk formatting for context information
      const chalkMock = vi.mocked(chalk);
      expect(chalkMock.gray).toHaveBeenCalledWith('Context: Critical operation requiring confirmation');
      expect(chalkMock.gray).toHaveBeenCalledWith('Resource: prod-database-backup');
      expect(chalkMock.gray).toHaveBeenCalledWith('Description: Production database containing sensitive data');

      // Verify cancellation message formatting
      expect(chalkMock.yellow).toHaveBeenCalledWith(
        expect.stringContaining('Delete Task Template cancelled by user')
      );

      expect(result).toBe(false);
    });

    it('should handle formatting edge cases gracefully', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      // Test with special characters and long strings
      const edgeCaseOptions = {
        context: 'Context with 🚀 emojis, \n newlines, and \t tabs',
        resourceId: 'task-with-special-chars-!@#$%^&*()',
        resourceDescription: 'A'.repeat(500) // Very long description
      };

      await confirmDangerousOperation(DangerousOperation.UNARCHIVE_TASK, edgeCaseOptions);

      const chalkMock = vi.mocked(chalk);
      expect(chalkMock.gray).toHaveBeenCalledWith(
        `Context: ${edgeCaseOptions.context}`
      );
      expect(chalkMock.gray).toHaveBeenCalledWith(
        `Resource: ${edgeCaseOptions.resourceId}`
      );
      expect(chalkMock.gray).toHaveBeenCalledWith(
        `Description: ${edgeCaseOptions.resourceDescription}`
      );
    });

    it('should maintain formatting consistency across rapid confirmation requests', async () => {
      const operations = Object.values(DangerousOperation);

      // Test rapid consecutive confirmations
      for (let i = 0; i < operations.length; i++) {
        mockPrompt.mockResolvedValueOnce({ confirmed: i % 2 === 0 });

        const result = await confirmDangerousOperation(operations[i]);

        // Each confirmation should maintain consistent formatting
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringMatching(/\[(RED|YELLOW|CYAN)\]⚠️/)
        );

        if (i % 2 !== 0) { // When user declines
          showOperationCancelled(operations[i]);
          const chalkMock = vi.mocked(chalk);
          expect(chalkMock.yellow).toHaveBeenCalledWith(
            expect.stringContaining('cancelled by user')
          );
        }

        vi.clearAllMocks();
      }
    });
  });

  describe('Real-world integration scenarios', () => {
    it('should handle complete confirmation workflow with all components', async () => {
      const spinner = ora('Preparing dangerous operation...');
      spinner.start();

      // Simulate loading configuration
      const autonomyLevel: AutonomyLevel = 'review-before-commit';
      const operation = DangerousOperation.EMPTY_TRASH;
      const options = {
        context: '15 tasks will be permanently deleted',
        resourceId: 'trash-batch-001',
        resourceDescription: 'Mixed task types from last 30 days',
        forceConfirmation: true
      };

      spinner.text = 'Checking autonomy level...';
      const shouldShow = shouldShowConfirmation(operation, autonomyLevel, options);
      expect(shouldShow).toBe(true);

      spinner.text = 'Requesting user confirmation...';
      mockPrompt.mockResolvedValue({ confirmed: true });

      const result = await requestConfirmation(operation, autonomyLevel, options);

      if (result) {
        spinner.succeed('Operation confirmed - proceeding with deletion');
      } else {
        spinner.warn('Operation cancelled by user');
      }

      // Verify the complete workflow
      expect(mockOra).toHaveBeenCalled();
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        'Operation confirmed - proceeding with deletion'
      );
      expect(result).toBe(true);
    });

    it('should handle error recovery in confirmation workflow', async () => {
      const spinner = ora('Initializing confirmation...');
      spinner.start();

      // Simulate an error during confirmation
      mockPrompt.mockRejectedValue(new Error('Connection lost'));

      let errorOccurred = false;
      try {
        await confirmDangerousOperation(DangerousOperation.MERGE_TASK);
      } catch (error) {
        errorOccurred = true;
        spinner.fail('Confirmation failed due to connection error');
      }

      expect(errorOccurred).toBe(true);
      expect(mockSpinner.fail).toHaveBeenCalledWith(
        'Confirmation failed due to connection error'
      );
    });

    it('should handle concurrent confirmation requests gracefully', async () => {
      const operations = [
        DangerousOperation.CANCEL_TASK,
        DangerousOperation.TRASH_TASK,
        DangerousOperation.MERGE_TASK
      ];

      // Setup responses for concurrent requests
      operations.forEach((_, i) => {
        mockPrompt.mockResolvedValueOnce({ confirmed: i === 1 }); // Only middle one confirms
      });

      const promises = operations.map(op => confirmDangerousOperation(op));
      const results = await Promise.all(promises);

      expect(results).toEqual([false, true, false]);
      expect(mockPrompt).toHaveBeenCalledTimes(3);
    });
  });
});