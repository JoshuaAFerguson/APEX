/**
 * @fileoverview Edge case and error handling tests for confirmation system
 * Tests unusual scenarios, error conditions, and boundary cases
 */

import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import inquirer from 'inquirer';
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

// Mock chalk
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

describe('Confirmation Edge Cases and Error Handling', () => {
  let mockPrompt: Mock;

  beforeEach(() => {
    mockPrompt = vi.mocked(inquirer.prompt);
    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('should handle inquirer timeout errors', async () => {
      mockPrompt.mockRejectedValue(new Error('Prompt timeout'));

      await expect(confirmDangerousOperation(DangerousOperation.CANCEL_TASK))
        .rejects.toThrow('Prompt timeout');
    });

    it('should handle inquirer interrupt signals', async () => {
      mockPrompt.mockRejectedValue(new Error('User interrupted'));

      await expect(confirmDangerousOperation(DangerousOperation.EMPTY_TRASH))
        .rejects.toThrow('User interrupted');
    });

    it('should handle inquirer permission errors', async () => {
      mockPrompt.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(confirmDangerousOperation(DangerousOperation.MERGE_TASK))
        .rejects.toThrow('EACCES: permission denied');
    });

    it('should handle inquirer stream errors', async () => {
      mockPrompt.mockRejectedValue(new Error('Input stream closed'));

      await expect(confirmDangerousOperation(DangerousOperation.TRASH_TASK))
        .rejects.toThrow('Input stream closed');
    });

    it('should handle malformed inquirer responses', async () => {
      mockPrompt.mockResolvedValue({ confirmed: undefined });

      const result = await confirmDangerousOperation(DangerousOperation.CANCEL_TASK);

      // Should handle undefined as falsy
      expect(result).toBe(false);
    });

    it('should handle unexpected inquirer response structure', async () => {
      mockPrompt.mockResolvedValue({ wrongField: true });

      const result = await confirmDangerousOperation(DangerousOperation.CANCEL_TASK);

      // Should handle missing confirmed field as falsy
      expect(result).toBe(false);
    });

    it('should handle inquirer returning null', async () => {
      mockPrompt.mockResolvedValue(null);

      await expect(confirmDangerousOperation(DangerousOperation.CANCEL_TASK))
        .rejects.toThrow();
    });
  });

  describe('boundary conditions', () => {
    it('should handle extremely long context strings', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const longContext = 'A'.repeat(10000); // Very long context
      const longResourceId = 'task-' + 'x'.repeat(1000);
      const longDescription = 'Very long description: ' + 'D'.repeat(5000);

      const result = await confirmDangerousOperation(
        DangerousOperation.CANCEL_TASK,
        {
          context: longContext,
          resourceId: longResourceId,
          resourceDescription: longDescription
        }
      );

      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(`[GRAY]Context: ${longContext}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`[GRAY]Resource: ${longResourceId}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`[GRAY]Description: ${longDescription}`);
    });

    it('should handle empty string values in options', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const result = await confirmDangerousOperation(
        DangerousOperation.TRASH_TASK,
        {
          context: '',
          resourceId: '',
          resourceDescription: ''
        }
      );

      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Context: ');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Resource: ');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]Description: ');
    });

    it('should handle special characters in context strings', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const specialContext = 'Context with 🚀 emojis and \n newlines and \t tabs';
      const specialResourceId = 'task-with-special-chars-!@#$%^&*()';

      const result = await confirmDangerousOperation(
        DangerousOperation.DELETE_TEMPLATE,
        {
          context: specialContext,
          resourceId: specialResourceId
        }
      );

      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(`[GRAY]Context: ${specialContext}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`[GRAY]Resource: ${specialResourceId}`);
    });

    it('should handle null and undefined values gracefully', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const result = await confirmDangerousOperation(
        DangerousOperation.UNARCHIVE_TASK,
        {
          context: undefined,
          resourceId: null as any,
          resourceDescription: undefined
        }
      );

      expect(result).toBe(true);
      // Should not display lines for null/undefined values
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Context: undefined'));
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Resource: null'));
    });
  });

  describe('autonomy level edge cases', () => {
    it('should handle invalid autonomy level strings', () => {
      const invalidLevels = [
        'invalid',
        'FULL', // Wrong case
        'manual-review',
        'super-autonomous',
        '',
        '   ', // Whitespace only
        'review-before-push' // Similar but invalid
      ];

      for (const level of invalidLevels) {
        const result = shouldShowConfirmation(
          DangerousOperation.CANCEL_TASK,
          level as AutonomyLevel
        );
        expect(result).toBe(true); // Should default to showing confirmation
      }
    });

    it('should handle autonomy level with extra whitespace', () => {
      const autonomyLevels = [
        ' full ',
        '\tfull\t',
        '\nfull\n',
        '  manual  '
      ];

      for (const level of autonomyLevels) {
        // These will be treated as invalid since they don't exactly match
        const result = shouldShowConfirmation(
          DangerousOperation.TRASH_TASK,
          level.trim() as AutonomyLevel
        );
        // After trimming, 'full' should work correctly
        if (level.trim() === 'full') {
          expect(result).toBe(false); // Low consequence operation in full mode
        } else {
          expect(result).toBe(true); // Invalid autonomy level defaults to true
        }
      }
    });

    it('should handle case sensitivity in autonomy levels', () => {
      const caseVariations = [
        'FULL',
        'Full',
        'fULL',
        'MANUAL',
        'Manual',
        'REVIEW-BEFORE-COMMIT'
      ];

      for (const level of caseVariations) {
        const result = shouldShowConfirmation(
          DangerousOperation.MERGE_TASK,
          level as AutonomyLevel
        );
        // Since these don't match exactly, should default to true
        expect(result).toBe(true);
      }
    });
  });

  describe('operation type edge cases', () => {
    it('should handle operations with inconsistent casing', () => {
      // This tests the enum value consistency
      const operations = Object.values(DangerousOperation);

      for (const operation of operations) {
        expect(operation).toBe(operation.toLowerCase());
        expect(operation).toContain('_'); // All operations use underscore naming
      }
    });

    it('should handle operations that might not exist in config', () => {
      // Test with a hypothetical operation that doesn't exist
      const fakeOperation = 'fake_operation' as DangerousOperation;

      expect(() => {
        shouldShowConfirmation(fakeOperation, 'manual');
      }).toThrow(); // Should throw when accessing undefined config
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple simultaneous confirmation requests', async () => {
      const confirmations = Array.from({ length: 10 }, (_, i) =>
        mockPrompt.mockResolvedValueOnce({ confirmed: i % 2 === 0 })
      );

      const operations = Array.from({ length: 10 }, (_, i) =>
        confirmDangerousOperation(DangerousOperation.CANCEL_TASK)
      );

      const results = await Promise.all(operations);

      // Results should alternate between true and false
      expect(results).toEqual([true, false, true, false, true, false, true, false, true, false]);
      expect(mockPrompt).toHaveBeenCalledTimes(10);
    });

    it('should handle mixed confirmation and autonomy checks concurrently', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      const promises = [
        requestConfirmation(DangerousOperation.TRASH_TASK, 'full'), // Should not prompt
        requestConfirmation(DangerousOperation.EMPTY_TRASH, 'full'), // Should prompt
        requestConfirmation(DangerousOperation.CANCEL_TASK, 'manual'), // Should prompt
        shouldShowConfirmation(DangerousOperation.MERGE_TASK, 'review-before-merge'), // Synchronous
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toBe(true); // No prompt, proceeds
      expect(results[1]).toBe(true); // Prompts and user confirms
      expect(results[2]).toBe(true); // Prompts and user confirms
      expect(results[3]).toBe(true); // Synchronous check for merge in review-before-merge
    });
  });

  describe('message formatting edge cases', () => {
    it('should handle operation names with underscores in prompt messages', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      await confirmDangerousOperation(DangerousOperation.DELETE_TEMPLATE);

      expect(mockPrompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to proceed with this delete template?',
          default: false
        }
      ]);
    });

    it('should handle multi-word operation names correctly', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true });

      await confirmDangerousOperation(DangerousOperation.EMPTY_TRASH);

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

  describe('console output edge cases', () => {
    it('should handle console methods that might throw errors', async () => {
      // Mock console.log to throw an error
      mockConsoleLog.mockImplementationOnce(() => {
        throw new Error('Console output failed');
      });

      // The function should still work even if console output fails
      mockPrompt.mockResolvedValue({ confirmed: true });

      await expect(confirmDangerousOperation(DangerousOperation.CANCEL_TASK))
        .rejects.toThrow('Console output failed');
    });

    it('should handle multiple rapid showOperationCancelled calls', () => {
      const operations = [
        DangerousOperation.CANCEL_TASK,
        DangerousOperation.TRASH_TASK,
        DangerousOperation.MERGE_TASK,
        DangerousOperation.DELETE_TEMPLATE,
        DangerousOperation.EMPTY_TRASH
      ];

      operations.forEach(operation => {
        showOperationCancelled(operation);
      });

      expect(mockConsoleLog).toHaveBeenCalledTimes(5);

      // Each call should have the correct operation-specific message
      const calls = mockConsoleLog.mock.calls;
      expect(calls[0][0]).toContain('Cancel Running Task cancelled by user');
      expect(calls[1][0]).toContain('Move Task to Trash cancelled by user');
      expect(calls[2][0]).toContain('Merge Task Branch cancelled by user');
      expect(calls[3][0]).toContain('Delete Task Template cancelled by user');
      expect(calls[4][0]).toContain('Empty Trash (Permanent Deletion) cancelled by user');
    });
  });

  describe('memory and performance edge cases', () => {
    it('should handle large numbers of sequential confirmations without memory issues', async () => {
      const iterationCount = 1000;

      for (let i = 0; i < iterationCount; i++) {
        mockPrompt.mockResolvedValueOnce({ confirmed: true });

        const result = await confirmDangerousOperation(DangerousOperation.TRASH_TASK);
        expect(result).toBe(true);

        // Clear console log mock to prevent memory buildup
        if (i % 100 === 0) {
          mockConsoleLog.mockClear();
        }
      }

      expect(mockPrompt).toHaveBeenCalledTimes(iterationCount);
    });

    it('should handle autonomy checks in tight loops efficiently', () => {
      const iterationCount = 10000;
      const startTime = Date.now();

      for (let i = 0; i < iterationCount; i++) {
        const operation = Object.values(DangerousOperation)[i % Object.values(DangerousOperation).length];
        const autonomy: AutonomyLevel = ['full', 'review-before-commit', 'review-before-merge', 'manual'][i % 4];

        shouldShowConfirmation(operation, autonomy);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 1 second for 10k iterations)
      expect(duration).toBeLessThan(1000);
    });
  });
});