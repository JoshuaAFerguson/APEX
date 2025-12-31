/**
 * @fileoverview End-to-end tests for CLI commands with confirmation prompts
 * Tests the complete command execution flow with confirmation integration
 */

import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { loadConfig } from '@apexcli/core';
import { createCLI } from '../index.js';

// Mock dependencies
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

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

describe('CLI Confirmation E2E Tests', () => {
  let mockPrompt: Mock;
  let mockLoadConfig: Mock;
  let mockOrchestrator: any;
  let program: Command;

  const mockTask = {
    id: 'task-123',
    description: 'Test task implementation',
    status: 'running',
    currentStage: 'implementation',
    branchName: 'feature/test-task'
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

  describe('cancel command', () => {
    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
    });

    it('should proceed without confirmation for full autonomy on medium-consequence operations', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'full' }
      });

      // Execute cancel command
      await program.parseAsync(['node', 'apex', 'cancel', 'task-123']);

      // Should not prompt user
      expect(mockPrompt).not.toHaveBeenCalled();
      // Should call orchestrator
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-123');
      // Should show success message
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Task task-123 has been cancelled'));
    });

    it('should show confirmation for review-before-commit autonomy on medium-consequence operations', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'review-before-commit' }
      });

      mockPrompt.mockResolvedValue({ confirmed: true });

      // Execute cancel command
      await program.parseAsync(['node', 'apex', 'cancel', 'task-123']);

      // Should prompt user
      expect(mockPrompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to proceed with this cancel task?',
          default: false
        }
      ]);

      // Should call orchestrator after confirmation
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-123');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Task task-123 has been cancelled'));
    });

    it('should abort operation when user declines confirmation', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });

      mockPrompt.mockResolvedValue({ confirmed: false });

      // Execute cancel command
      await program.parseAsync(['node', 'apex', 'cancel', 'task-123']);

      // Should prompt user
      expect(mockPrompt).toHaveBeenCalled();

      // Should NOT call orchestrator
      expect(mockOrchestrator.cancelTask).not.toHaveBeenCalled();

      // Should show cancellation message
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Cancel Running Task cancelled by user'));
    });

    it('should handle task not found error', async () => {
      mockOrchestrator.getTask.mockResolvedValue(null);

      await program.parseAsync(['node', 'apex', 'cancel', 'nonexistent-task']);

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Task nonexistent-task not found'));
      expect(mockOrchestrator.cancelTask).not.toHaveBeenCalled();
    });
  });

  describe('merge command', () => {
    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue({
        ...mockTask,
        status: 'completed'
      });
    });

    it('should show confirmation for merge operations in review-before-merge autonomy', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      // Execute merge command
      await program.parseAsync(['node', 'apex', 'merge', 'task-123']);

      // Should prompt user for merge operation
      expect(mockPrompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to proceed with this merge task?',
          default: false
        }
      ]);

      // Should call orchestrator after confirmation
      expect(mockOrchestrator.mergeTask).toHaveBeenCalledWith('task-123', false);
    });

    it('should handle squash merge option with confirmation', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      // Execute merge command with squash option
      await program.parseAsync(['node', 'apex', 'merge', 'task-123', '--squash']);

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockOrchestrator.mergeTask).toHaveBeenCalledWith('task-123', true);
    });

    it('should skip confirmation for full autonomy except forced operations', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'full' }
      });

      // Execute merge command
      await program.parseAsync(['node', 'apex', 'merge', 'task-123']);

      // Should not prompt in full autonomy for merge
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockOrchestrator.mergeTask).toHaveBeenCalledWith('task-123', false);
    });
  });

  describe('trash command', () => {
    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
    });

    it('should skip confirmation for low-consequence operations in most autonomy modes', async () => {
      // Execute trash command with review-before-merge autonomy
      await program.parseAsync(['node', 'apex', 'trash', 'task-123']);

      // Should not prompt for low-consequence trash operation
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockOrchestrator.trashTask).toHaveBeenCalledWith('task-123');
    });

    it('should show confirmation for manual autonomy mode', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });

      mockPrompt.mockResolvedValue({ confirmed: true });

      // Execute trash command
      await program.parseAsync(['node', 'apex', 'trash', 'task-123']);

      // Should prompt in manual mode
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockOrchestrator.trashTask).toHaveBeenCalledWith('task-123');
    });
  });

  describe('empty-trash command', () => {
    beforeEach(() => {
      mockOrchestrator.listTasks.mockResolvedValue([
        { ...mockTask, id: 'trash-1', status: 'trashed' },
        { ...mockTask, id: 'trash-2', status: 'trashed' },
        { ...mockTask, id: 'trash-3', status: 'trashed' }
      ]);
    });

    it('should always show confirmation for irreversible high-consequence operations', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      // Execute empty-trash command
      await program.parseAsync(['node', 'apex', 'empty-trash']);

      // Should always prompt due to irreversible nature
      expect(mockPrompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to proceed with this empty trash?',
          default: false
        }
      ]);

      expect(mockOrchestrator.emptyTrash).toHaveBeenCalled();
    });

    it('should show count of tasks to be deleted in context', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      await program.parseAsync(['node', 'apex', 'empty-trash']);

      // Should display context about number of tasks
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('3 tasks will be permanently deleted'));

      // Should not proceed if user declines
      expect(mockOrchestrator.emptyTrash).not.toHaveBeenCalled();
    });

    it('should handle empty trash gracefully', async () => {
      mockOrchestrator.listTasks.mockResolvedValue([]);

      await program.parseAsync(['node', 'apex', 'empty-trash']);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Trash is already empty'));
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockOrchestrator.emptyTrash).not.toHaveBeenCalled();
    });
  });

  describe('unarchive command', () => {
    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue({
        ...mockTask,
        status: 'archived'
      });
    });

    it('should handle low-consequence unarchive operations according to autonomy level', async () => {
      // Should not prompt in review-before-merge for low-consequence operations
      await program.parseAsync(['node', 'apex', 'unarchive', 'task-123']);

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockOrchestrator.unarchiveTask).toHaveBeenCalledWith('task-123');
    });

    it('should show confirmation in manual mode', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });

      mockPrompt.mockResolvedValue({ confirmed: true });

      await program.parseAsync(['node', 'apex', 'unarchive', 'task-123']);

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockOrchestrator.unarchiveTask).toHaveBeenCalledWith('task-123');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle orchestrator errors gracefully', async () => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockOrchestrator.cancelTask.mockRejectedValue(new Error('Orchestrator error'));

      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'full' }
      });

      await program.parseAsync(['node', 'apex', 'cancel', 'task-123']);

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Failed to cancel task'));
    });

    it('should handle config loading errors', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Config not found'));

      await expect(program.parseAsync(['node', 'apex', 'cancel', 'task-123']))
        .rejects.toThrow('Config not found');
    });

    it('should handle inquirer prompt errors', async () => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockPrompt.mockRejectedValue(new Error('Prompt interrupted'));

      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });

      await expect(program.parseAsync(['node', 'apex', 'cancel', 'task-123']))
        .rejects.toThrow('Prompt interrupted');
    });

    it('should handle missing task ID argument', async () => {
      await program.parseAsync(['node', 'apex', 'cancel']);

      // Should show help or error message for missing argument
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Missing required argument'));
    });

    it('should handle invalid autonomy levels in config', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'invalid-level' }
      });

      mockOrchestrator.getTask.mockResolvedValue(mockTask);

      await program.parseAsync(['node', 'apex', 'cancel', 'task-123']);

      // Should default to showing confirmation for unknown autonomy levels
      expect(mockPrompt).toHaveBeenCalled();
    });
  });

  describe('real-world workflow scenarios', () => {
    it('should handle complete task lifecycle with different autonomy settings', async () => {
      // Start with manual mode
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'manual' }
      });

      // User confirms all operations
      mockPrompt.mockResolvedValue({ confirmed: true });

      // Setup tasks for different operations
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockOrchestrator.listTasks.mockResolvedValue([
        { ...mockTask, status: 'trashed' }
      ]);

      // Execute multiple operations
      await program.parseAsync(['node', 'apex', 'cancel', 'task-123']);
      expect(mockPrompt).toHaveBeenCalledTimes(1);

      await program.parseAsync(['node', 'apex', 'trash', 'task-456']);
      expect(mockPrompt).toHaveBeenCalledTimes(2);

      await program.parseAsync(['node', 'apex', 'empty-trash']);
      expect(mockPrompt).toHaveBeenCalledTimes(3);

      // All operations should have been executed
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-123');
      expect(mockOrchestrator.trashTask).toHaveBeenCalledWith('task-456');
      expect(mockOrchestrator.emptyTrash).toHaveBeenCalled();
    });

    it('should respect force confirmation settings for critical operations', async () => {
      mockLoadConfig.mockResolvedValue({
        ...mockConfig,
        autonomy: { default: 'full' }
      });

      mockOrchestrator.listTasks.mockResolvedValue([
        { ...mockTask, status: 'trashed' }
      ]);

      mockPrompt.mockResolvedValue({ confirmed: true });

      // Empty trash should always prompt even in full autonomy
      await program.parseAsync(['node', 'apex', 'empty-trash']);

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockOrchestrator.emptyTrash).toHaveBeenCalled();
    });
  });
});