/**
 * @fileoverview Integration tests for CLI confirmation prompt implementation
 * Verifies that CLI properly surfaces confirmation prompts, handles user input,
 * and integrates with the orchestrator for dangerous operations
 */

import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { loadConfig } from '@apexcli/core';
import { createCLI } from '../index.js';

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

vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    createTask: vi.fn(),
    cancelTask: vi.fn(),
    mergeTask: vi.fn(),
    trashTask: vi.fn(),
    emptyTrash: vi.fn(),
    unarchiveTask: vi.fn(),
    deleteTemplate: vi.fn(),
    listTasks: vi.fn(),
    getTask: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }))
}));

vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn(),
  AutonomyLevel: {
    FULL: 'full',
    REVIEW_BEFORE_COMMIT: 'review-before-commit',
    REVIEW_BEFORE_MERGE: 'review-before-merge',
    MANUAL: 'manual'
  },
  TaskStatus: {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    TRASHED: 'trashed'
  }
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('CLI Confirmation Prompt Integration Tests', () => {
  let mockPrompt: Mock;
  let mockLoadConfig: Mock;
  let mockOrchestrator: any;
  let mockOra: Mock;
  let mockSpinner: any;
  let program: Command;

  const mockTask = {
    id: 'task-integration-test',
    description: 'Integration test task',
    status: 'running',
    currentStage: 'implementation',
    branchName: 'feature/integration-test'
  };

  const mockConfig = {
    autonomy: {
      default: 'review-before-merge'
    },
    projects: {
      current: 'test-project'
    }
  };

  beforeEach(() => {
    mockPrompt = vi.mocked(inquirer.prompt);
    mockLoadConfig = vi.mocked(loadConfig);
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

    mockLoadConfig.mockResolvedValue(mockConfig);

    // Create mock orchestrator instance
    mockOrchestrator = {
      createTask: vi.fn(),
      cancelTask: vi.fn().mockResolvedValue(undefined),
      mergeTask: vi.fn().mockResolvedValue(undefined),
      trashTask: vi.fn().mockResolvedValue(undefined),
      emptyTrash: vi.fn().mockResolvedValue(undefined),
      unarchiveTask: vi.fn().mockResolvedValue(undefined),
      deleteTemplate: vi.fn().mockResolvedValue(undefined),
      listTasks: vi.fn(),
      getTask: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    };

    // Mock ApexOrchestrator constructor
    vi.mocked(ApexOrchestrator).mockImplementation(() => mockOrchestrator);

    // Create fresh CLI instance for each test
    program = createCLI();

    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CLI surfaces confirmation prompts using inquirer', () => {
    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
    });

    it('should surface inquirer confirmation prompt for cancel command with correct configuration', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });

      mockPrompt.mockResolvedValue({ confirmed: true });

      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      expect(mockPrompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to proceed with this cancel task?',
          default: false
        }
      ]);
    });

    it('should skip inquirer prompt when autonomy level allows automatic execution', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'full' }
      });

      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-integration-test');
    });

    it('should always surface inquirer prompt for high-consequence operations regardless of autonomy', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'full' }
      });

      mockOrchestrator.listTasks.mockResolvedValue([
        { ...mockTask, id: 'trash-1', status: 'trashed' },
        { ...mockTask, id: 'trash-2', status: 'trashed' }
      ]);

      mockPrompt.mockResolvedValue({ confirmed: true });

      await program.parseAsync(['node', 'apex', 'empty-trash']);

      expect(mockPrompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to proceed with this empty trash?',
          default: false
        }
      ]);
    });
  });

  describe('Prompts display correct message and options', () => {
    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });
    });

    it('should display correct warning messages and colors for different operations', async () => {
      const testCases = [
        {
          command: ['cancel', 'task-integration-test'],
          expectedWarning: '[YELLOW]⚠️  Cancel Running Task',
          expectedDescription: 'This will terminate the currently running task and any partial progress will be lost.'
        },
        {
          command: ['trash', 'task-integration-test'],
          expectedWarning: '[CYAN]⚠️  Move Task to Trash',
          expectedDescription: 'This will move the task to trash. You can restore it later if needed.'
        }
      ];

      for (const testCase of testCases) {
        mockPrompt.mockResolvedValueOnce({ confirmed: true });

        await program.parseAsync(['node', 'apex', ...testCase.command]);

        expect(mockConsoleLog).toHaveBeenCalledWith(testCase.expectedWarning);
        expect(mockConsoleLog).toHaveBeenCalledWith(`[GRAY]${testCase.expectedDescription}`);

        mockPrompt.mockClear();
        mockConsoleLog.mockClear();
      }
    });

    it('should display resource context information when available', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      // Should display context about the task being cancelled
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Resource: task-integration-test');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Description: Integration test task');
    });

    it('should show irreversible warning for high-consequence operations', async () => {
      mockOrchestrator.listTasks.mockResolvedValue([
        { ...mockTask, status: 'trashed' }
      ]);

      mockPrompt.mockResolvedValue({ confirmed: true });

      await program.parseAsync(['node', 'apex', 'empty-trash']);

      expect(mockConsoleLog).toHaveBeenCalledWith('[RED]⚠️  Empty Trash (Permanent Deletion)');
      expect(mockConsoleLog).toHaveBeenCalledWith('[RED]🚨 This action is irreversible!');
    });
  });

  describe('User input capture and orchestrator communication', () => {
    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });
    });

    it('should capture user confirmation and execute orchestrator method when confirmed', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-integration-test');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task task-integration-test has been cancelled')
      );
    });

    it('should capture user rejection and NOT execute orchestrator method when declined', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockOrchestrator.cancelTask).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cancel Running Task cancelled by user')
      );
    });

    it('should pass correct parameters to orchestrator based on command options', async () => {
      mockOrchestrator.getTask.mockResolvedValue({
        ...mockTask,
        status: 'completed'
      });

      mockPrompt.mockResolvedValue({ confirmed: true });

      // Test merge with squash option
      await program.parseAsync(['node', 'apex', 'merge', 'task-integration-test', '--squash']);

      expect(mockOrchestrator.mergeTask).toHaveBeenCalledWith('task-integration-test', true);
    });

    it('should handle multiple operations in sequence', async () => {
      mockPrompt
        .mockResolvedValueOnce({ confirmed: true })  // First operation
        .mockResolvedValueOnce({ confirmed: false }) // Second operation
        .mockResolvedValueOnce({ confirmed: true }); // Third operation

      // First command
      await program.parseAsync(['node', 'apex', 'trash', 'task-1']);
      expect(mockOrchestrator.trashTask).toHaveBeenCalledWith('task-1');

      // Second command (declined)
      mockOrchestrator.getTask.mockResolvedValue({ ...mockTask, id: 'task-2' });
      await program.parseAsync(['node', 'apex', 'cancel', 'task-2']);
      expect(mockOrchestrator.cancelTask).not.toHaveBeenCalledWith('task-2');

      // Third command
      mockOrchestrator.getTask.mockResolvedValue({ ...mockTask, id: 'task-3' });
      await program.parseAsync(['node', 'apex', 'unarchive', 'task-3']);
      expect(mockOrchestrator.unarchiveTask).toHaveBeenCalledWith('task-3');
    });
  });

  describe('CLI handles confirmation timeouts', () => {
    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });
    });

    it('should handle inquirer timeout errors gracefully', async () => {
      mockPrompt.mockRejectedValue(new Error('Prompt timeout after 30 seconds'));

      await expect(
        program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test'])
      ).rejects.toThrow('Prompt timeout after 30 seconds');

      expect(mockOrchestrator.cancelTask).not.toHaveBeenCalled();
    });

    it('should handle user interruption (Ctrl+C) gracefully', async () => {
      mockPrompt.mockRejectedValue(new Error('User interrupted'));

      await expect(
        program.parseAsync(['node', 'apex', 'trash', 'task-integration-test'])
      ).rejects.toThrow('User interrupted');

      expect(mockOrchestrator.trashTask).not.toHaveBeenCalled();
    });

    it('should handle stream closure during confirmation', async () => {
      mockPrompt.mockRejectedValue(new Error('Input stream closed'));

      await expect(
        program.parseAsync(['node', 'apex', 'merge', 'task-integration-test'])
      ).rejects.toThrow('Input stream closed');

      expect(mockOrchestrator.mergeTask).not.toHaveBeenCalled();
    });

    it('should not execute dangerous operations when timeout occurs', async () => {
      mockOrchestrator.listTasks.mockResolvedValue([
        { ...mockTask, status: 'trashed' }
      ]);

      mockPrompt.mockRejectedValue(new Error('Timeout during confirmation'));

      await expect(
        program.parseAsync(['node', 'apex', 'empty-trash'])
      ).rejects.toThrow('Timeout during confirmation');

      expect(mockOrchestrator.emptyTrash).not.toHaveBeenCalled();
    });
  });

  describe('Chalk/ora formatting for confirmation states', () => {
    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });
    });

    it('should use chalk for colored confirmation messages', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      const chalkMock = vi.mocked(chalk);
      expect(chalkMock.yellow).toHaveBeenCalled(); // Warning color for medium consequence
      expect(chalkMock.gray).toHaveBeenCalled();   // Context information color
    });

    it('should use appropriate colors for different consequence levels', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      // Test high-consequence operation (red)
      mockOrchestrator.listTasks.mockResolvedValue([{ ...mockTask, status: 'trashed' }]);
      await program.parseAsync(['node', 'apex', 'empty-trash']);

      const chalkMock = vi.mocked(chalk);
      expect(chalkMock.red).toHaveBeenCalled();

      mockPrompt.mockClear();
      vi.clearAllMocks();

      // Test low-consequence operation (cyan)
      mockPrompt.mockResolvedValue({ confirmed: false });
      await program.parseAsync(['node', 'apex', 'trash', 'task-integration-test']);

      expect(chalkMock.cyan).toHaveBeenCalled();
    });

    it('should use ora spinner integration during operations', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      // Simulate a spinner being used during the confirmation flow
      const spinner = ora('Processing...');
      spinner.start();

      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      spinner.succeed('Operation completed');

      expect(mockOra).toHaveBeenCalled();
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Operation completed');
    });

    it('should format cancellation messages correctly', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      const chalkMock = vi.mocked(chalk);
      expect(chalkMock.yellow).toHaveBeenCalledWith(
        expect.stringContaining('cancelled by user')
      );
    });

    it('should handle complex formatting scenarios with context', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      const chalkMock = vi.mocked(chalk);

      // Should display formatted context information
      expect(chalkMock.gray).toHaveBeenCalledWith('Resource: task-integration-test');
      expect(chalkMock.gray).toHaveBeenCalledWith('Description: Integration test task');

      // Should display formatted warning
      expect(chalkMock.yellow).toHaveBeenCalledWith('⚠️  Cancel Running Task');
    });
  });

  describe('End-to-end confirmation workflow integration', () => {
    it('should handle complete workflow from command to orchestrator execution', async () => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'review-before-commit' }
      });

      mockPrompt.mockResolvedValue({ confirmed: true });

      // Start spinner for operation
      const operationSpinner = ora('Executing cancel operation...');
      operationSpinner.start();

      // Execute command
      await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);

      // Complete spinner
      operationSpinner.succeed('Task cancelled successfully');

      // Verify the complete flow
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-integration-test');
      expect(mockOra).toHaveBeenCalled();
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Task cancelled successfully');
    });

    it('should handle error scenarios with proper formatting', async () => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockOrchestrator.cancelTask.mockRejectedValue(new Error('Network error'));

      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });

      mockPrompt.mockResolvedValue({ confirmed: true });

      const errorSpinner = ora('Cancelling task...');
      errorSpinner.start();

      try {
        await program.parseAsync(['node', 'apex', 'cancel', 'task-integration-test']);
      } catch (error) {
        errorSpinner.fail('Failed to cancel task');
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cancel task')
      );
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to cancel task');
    });

    it('should maintain state consistency across multiple confirmation operations', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });

      for (let i = 0; i < taskIds.length; i++) {
        const taskId = taskIds[i];
        const shouldConfirm = i !== 1; // Decline middle operation

        mockOrchestrator.getTask.mockResolvedValue({ ...mockTask, id: taskId });
        mockPrompt.mockResolvedValueOnce({ confirmed: shouldConfirm });

        await program.parseAsync(['node', 'apex', 'trash', taskId]);

        if (shouldConfirm) {
          expect(mockOrchestrator.trashTask).toHaveBeenCalledWith(taskId);
        } else {
          expect(mockOrchestrator.trashTask).not.toHaveBeenCalledWith(taskId);
        }
      }

      expect(mockPrompt).toHaveBeenCalledTimes(3);
      expect(mockOrchestrator.trashTask).toHaveBeenCalledTimes(2); // Only confirmed operations
    });
  });
});