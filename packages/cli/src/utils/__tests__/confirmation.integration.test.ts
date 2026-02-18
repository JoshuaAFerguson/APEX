/**
 * @fileoverview Integration tests for CLI confirmation prompts
 * Tests the complete confirmation flow including user interaction simulation
 */

import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  shouldShowConfirmation,
  confirmDangerousOperation,
  requestConfirmation,
  showOperationCancelled,
  DangerousOperation
} from '../confirmation.js';
import type { AutonomyLevel } from '@apexcli/core';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock chalk to prevent ANSI codes in test output
vi.mock('chalk', () => {
  const mockChalk = vi.fn((str: string) => str);
  mockChalk.red = vi.fn((str: string) => `[RED]${str}`);
  mockChalk.yellow = vi.fn((str: string) => `[YELLOW]${str}`);
  mockChalk.cyan = vi.fn((str: string) => `[CYAN]${str}`);
  mockChalk.gray = vi.fn((str: string) => `[GRAY]${str}`);
  return { default: mockChalk };
});

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Confirmation Integration Tests', () => {
  let mockPrompt: Mock;

  beforeEach(() => {
    mockPrompt = vi.mocked(inquirer.prompt);
    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('confirmDangerousOperation', () => {
    it('should display appropriate warning for high-consequence irreversible operations', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const result = await confirmDangerousOperation(DangerousOperation.EMPTY_TRASH);

      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('[RED]⚠️  Empty Trash (Permanent Deletion)');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]This will permanently delete all tasks in trash. This action cannot be undone.');
      expect(mockConsoleLog).toHaveBeenCalledWith('[RED]🚨 This action is irreversible!');
    });

    it('should display appropriate warning for medium-consequence operations', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      const result = await confirmDangerousOperation(DangerousOperation.CANCEL_TASK);

      expect(result).toBe(false);
      expect(mockConsoleLog).toHaveBeenCalledWith('[YELLOW]⚠️  Cancel Running Task');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]This will terminate the currently running task and any partial progress will be lost.');
      expect(mockConsoleLog).not.toHaveBeenCalledWith('[RED]🚨 This action is irreversible!');
    });

    it('should display appropriate warning for low-consequence operations', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const result = await confirmDangerousOperation(DangerousOperation.TRASH_TASK);

      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('[CYAN]⚠️  Move Task to Trash');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]This will move the task to trash. You can restore it later if needed.');
      expect(mockConsoleLog).not.toHaveBeenCalledWith('[RED]🚨 This action is irreversible!');
    });

    it('should display context information when provided', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const options = {
        context: 'Status: running, Stage: implementation',
        resourceId: 'task-123',
        resourceDescription: 'Add user authentication'
      };

      await confirmDangerousOperation(DangerousOperation.CANCEL_TASK, options);

      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Context: Status: running, Stage: implementation');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Resource: task-123');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Description: Add user authentication');
    });

    it('should properly format confirmation prompt message', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      await confirmDangerousOperation(DangerousOperation.MERGE_TASK);

      expect(mockPrompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to proceed with this merge task?',
          default: false
        }
      ]);
    });

    it('should handle all dangerous operation types correctly', async () => {
      const operations = Object.values(DangerousOperation);

      for (const operation of operations) {
        mockPrompt.mockResolvedValue({ confirmed: true });
        mockConsoleLog.mockClear();

        const result = await confirmDangerousOperation(operation);

        expect(result).toBe(true);
        expect(mockConsoleLog).toHaveBeenCalled();
        expect(mockPrompt).toHaveBeenCalled();

        // Reset for next iteration
        mockPrompt.mockClear();
      }
    });
  });

  describe('requestConfirmation integration', () => {
    it('should skip confirmation and return true for full autonomy with low-consequence operations', async () => {
      const result = await requestConfirmation(
        DangerousOperation.TRASH_TASK,
        'full'
      );

      expect(result).toBe(true);
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should show confirmation and return user choice for full autonomy with high-consequence irreversible operations', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      const result = await requestConfirmation(
        DangerousOperation.EMPTY_TRASH,
        'full'
      );

      expect(result).toBe(false);
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should respect forceConfirmation option regardless of autonomy level', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const result = await requestConfirmation(
        DangerousOperation.TRASH_TASK,
        'full',
        { forceConfirmation: true }
      );

      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle review-before-commit autonomy level correctly', async () => {
      // Should skip low-consequence operations
      let result = await requestConfirmation(
        DangerousOperation.TRASH_TASK,
        'review-before-commit'
      );
      expect(result).toBe(true);
      expect(mockPrompt).not.toHaveBeenCalled();

      // Should show confirmation for medium-consequence operations
      mockPrompt.mockResolvedValue({ confirmed: true });
      result = await requestConfirmation(
        DangerousOperation.CANCEL_TASK,
        'review-before-commit'
      );
      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalled();

      // Reset for next test
      mockPrompt.mockClear();

      // Should show confirmation for high-consequence operations
      mockPrompt.mockResolvedValue({ confirmed: false });
      result = await requestConfirmation(
        DangerousOperation.EMPTY_TRASH,
        'review-before-commit'
      );
      expect(result).toBe(false);
      expect(mockPrompt).toHaveBeenCalled();
    });

    it('should handle review-before-merge autonomy level correctly', async () => {
      // Should skip low and medium-consequence non-merge operations
      let result = await requestConfirmation(
        DangerousOperation.CANCEL_TASK,
        'review-before-merge'
      );
      expect(result).toBe(true);
      expect(mockPrompt).not.toHaveBeenCalled();

      // Should show confirmation for merge operations
      mockPrompt.mockResolvedValue({ confirmed: true });
      result = await requestConfirmation(
        DangerousOperation.MERGE_TASK,
        'review-before-merge'
      );
      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalled();

      // Reset for next test
      mockPrompt.mockClear();

      // Should show confirmation for high-consequence operations
      mockPrompt.mockResolvedValue({ confirmed: false });
      result = await requestConfirmation(
        DangerousOperation.DELETE_TEMPLATE,
        'review-before-merge'
      );
      expect(result).toBe(false);
      expect(mockPrompt).toHaveBeenCalled();
    });

    it('should always show confirmation for manual autonomy level', async () => {
      const operations = Object.values(DangerousOperation);

      for (const operation of operations) {
        mockPrompt.mockResolvedValue({ confirmed: true });
        mockPrompt.mockClear();

        const result = await requestConfirmation(operation, 'manual');

        expect(result).toBe(true);
        expect(mockPrompt).toHaveBeenCalled();
      }
    });
  });

  describe('showOperationCancelled', () => {
    it('should display cancellation message with correct formatting', () => {
      showOperationCancelled(DangerousOperation.EMPTY_TRASH);

      expect(mockConsoleLog).toHaveBeenCalledWith('[YELLOW]❌ Empty Trash (Permanent Deletion) cancelled by user.');
    });

    it('should handle all operation types', () => {
      const operations = Object.values(DangerousOperation);

      for (const operation of operations) {
        mockConsoleLog.mockClear();

        showOperationCancelled(operation);

        expect(mockConsoleLog).toHaveBeenCalled();
        const call = mockConsoleLog.mock.calls[0][0];
        expect(call).toContain('cancelled by user');
        expect(call).toContain('❌');
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle inquirer errors gracefully', async () => {
      mockPrompt.mockRejectedValue(new Error('Inquirer error'));

      await expect(confirmDangerousOperation(DangerousOperation.CANCEL_TASK))
        .rejects.toThrow('Inquirer error');
    });

    it('should handle partial context information', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      // Test with only resourceId
      await confirmDangerousOperation(DangerousOperation.TRASH_TASK, {
        resourceId: 'task-456'
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Resource: task-456');
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Context:'));
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Description:'));

      mockConsoleLog.mockClear();

      // Test with only context
      await confirmDangerousOperation(DangerousOperation.TRASH_TASK, {
        context: 'Important context'
      });

      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Context: Important context');
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Resource:'));
    });

    it('should handle unknown autonomy levels by defaulting to showing confirmation', () => {
      const result = shouldShowConfirmation(
        DangerousOperation.TRASH_TASK,
        'unknown_level' as AutonomyLevel
      );

      expect(result).toBe(true);
    });

    it('should maintain consistent behavior across multiple calls', async () => {
      // Test that the function behaves consistently when called multiple times
      mockPrompt.mockResolvedValue({ confirmed: true });

      const results = await Promise.all([
        requestConfirmation(DangerousOperation.CANCEL_TASK, 'manual'),
        requestConfirmation(DangerousOperation.CANCEL_TASK, 'manual'),
        requestConfirmation(DangerousOperation.CANCEL_TASK, 'manual')
      ]);

      expect(results).toEqual([true, true, true]);
      expect(mockPrompt).toHaveBeenCalledTimes(3);
    });
  });

  describe('real-world scenario testing', () => {
    it('should handle complete workflow for task cancellation', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const autonomyLevel: AutonomyLevel = 'review-before-merge';
      const options = {
        resourceId: 'task-789',
        resourceDescription: 'Implement user dashboard',
        context: 'Status: running, Stage: implementation, Progress: 45%'
      };

      // Check if confirmation should be shown
      const shouldShow = shouldShowConfirmation(
        DangerousOperation.CANCEL_TASK,
        autonomyLevel,
        options
      );
      expect(shouldShow).toBe(false); // Medium consequence, not shown in review-before-merge

      // Request confirmation (should skip due to autonomy level)
      const result = await requestConfirmation(
        DangerousOperation.CANCEL_TASK,
        autonomyLevel,
        options
      );
      expect(result).toBe(true);
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should handle complete workflow for force-confirmed operation', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      const autonomyLevel: AutonomyLevel = 'full';
      const options = {
        resourceId: 'task-999',
        resourceDescription: 'Critical security patch',
        context: 'Status: completed, Ready for merge',
        forceConfirmation: true
      };

      // Check if confirmation should be shown (forced)
      const shouldShow = shouldShowConfirmation(
        DangerousOperation.MERGE_TASK,
        autonomyLevel,
        options
      );
      expect(shouldShow).toBe(true); // Forced confirmation

      // Request confirmation
      const result = await requestConfirmation(
        DangerousOperation.MERGE_TASK,
        autonomyLevel,
        options
      );
      expect(result).toBe(false); // User declined
      expect(mockPrompt).toHaveBeenCalled();

      // Show cancellation message
      showOperationCancelled(DangerousOperation.MERGE_TASK);
      expect(mockConsoleLog).toHaveBeenCalledWith('[YELLOW]❌ Merge Task Branch cancelled by user.');
    });

    it('should handle empty trash workflow with all autonomy levels', async () => {
      const autonomyLevels: AutonomyLevel[] = ['full', 'review-before-commit', 'review-before-merge', 'manual'];
      const options = {
        context: '5 tasks will be permanently deleted',
        forceConfirmation: true // Empty trash always forces confirmation
      };

      for (const autonomyLevel of autonomyLevels) {
        mockPrompt.mockResolvedValue({ confirmed: true });
        mockPrompt.mockClear();

        const shouldShow = shouldShowConfirmation(
          DangerousOperation.EMPTY_TRASH,
          autonomyLevel,
          options
        );
        expect(shouldShow).toBe(true); // Always shown due to forceConfirmation

        const result = await requestConfirmation(
          DangerousOperation.EMPTY_TRASH,
          autonomyLevel,
          options
        );
        expect(result).toBe(true);
        expect(mockPrompt).toHaveBeenCalled();
      }
    });
  });
});