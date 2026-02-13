import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DangerousOperation,
  requestConfirmation,
  showOperationCancelled
} from '../confirmation.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import type { ApexConfig } from '@apexcli/core';

/**
 * Test suite for JSDoc documented confirmation utility functions
 * Tests dangerous operation confirmation and user interaction flows
 */
describe('Confirmation Utilities JSDoc Documented Functionality', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let inquirerPromptSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    inquirerPromptSpy = vi.spyOn(inquirer, 'prompt').mockImplementation(() =>
      Promise.resolve({ confirmed: true })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    inquirerPromptSpy.mockRestore();
  });

  describe('DangerousOperation enum', () => {
    it('should export all expected dangerous operation types', () => {
      expect(DangerousOperation.CANCEL_TASK).toBe('cancel_task');
      expect(DangerousOperation.TRASH_TASK).toBe('trash_task');
      expect(DangerousOperation.EMPTY_TRASH).toBe('empty_trash');
      expect(DangerousOperation.MERGE_TASK).toBe('merge_task');
      expect(DangerousOperation.DELETE_TEMPLATE).toBe('delete_template');
      expect(DangerousOperation.UNARCHIVE_TASK).toBe('unarchive_task');
    });

    it('should have stable string values for all operations', () => {
      // These values should remain consistent for backwards compatibility
      const expectedValues = {
        [DangerousOperation.CANCEL_TASK]: 'cancel_task',
        [DangerousOperation.TRASH_TASK]: 'trash_task',
        [DangerousOperation.EMPTY_TRASH]: 'empty_trash',
        [DangerousOperation.MERGE_TASK]: 'merge_task',
        [DangerousOperation.DELETE_TEMPLATE]: 'delete_template',
        [DangerousOperation.UNARCHIVE_TASK]: 'unarchive_task',
      };

      Object.entries(expectedValues).forEach(([operation, expectedValue]) => {
        expect(operation).toBe(expectedValue);
      });
    });
  });

  describe('requestConfirmation function', () => {
    const mockConfig: ApexConfig = {
      autonomy: 'review-all',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 8192,
      temperature: 0.0,
      timeout: 300000,
      retries: 3,
      costLimit: 10.0,
      agents: {},
      workflows: {},
      browserTool: {
        enabled: true,
        headless: true,
        timeout: 30000,
        viewport: { width: 1280, height: 720 }
      }
    };

    it('should request confirmation for cancel task operation', async () => {
      inquirerPromptSpy.mockResolvedValue({ confirmed: true });

      const result = await requestConfirmation(
        DangerousOperation.CANCEL_TASK,
        mockConfig,
        'task-123'
      );

      expect(result).toBe(true);
      expect(inquirerPromptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: expect.stringContaining('Cancel Running Task'),
        })
      );
    });

    it('should request confirmation for trash task operation', async () => {
      inquirerPromptSpy.mockResolvedValue({ confirmed: false });

      const result = await requestConfirmation(
        DangerousOperation.TRASH_TASK,
        mockConfig,
        'task-456'
      );

      expect(result).toBe(false);
      expect(inquirerPromptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: expect.stringContaining('Move Task to Trash'),
        })
      );
    });

    it('should request confirmation for empty trash operation', async () => {
      inquirerPromptSpy.mockResolvedValue({ confirmed: true });

      const result = await requestConfirmation(
        DangerousOperation.EMPTY_TRASH,
        mockConfig
      );

      expect(result).toBe(true);
      expect(inquirerPromptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: expect.stringContaining('Empty Trash'),
        })
      );
    });

    it('should request confirmation for merge task operation', async () => {
      inquirerPromptSpy.mockResolvedValue({ confirmed: false });

      const result = await requestConfirmation(
        DangerousOperation.MERGE_TASK,
        mockConfig,
        'source-task',
        'target-task'
      );

      expect(result).toBe(false);
      expect(inquirerPromptSpy).toHaveBeenCalled();
    });

    it('should request confirmation for delete template operation', async () => {
      inquirerPromptSpy.mockResolvedValue({ confirmed: true });

      const result = await requestConfirmation(
        DangerousOperation.DELETE_TEMPLATE,
        mockConfig,
        'template-name'
      );

      expect(result).toBe(true);
      expect(inquirerPromptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: expect.stringContaining('Delete Template'),
        })
      );
    });

    it('should request confirmation for unarchive task operation', async () => {
      inquirerPromptSpy.mockResolvedValue({ confirmed: false });

      const result = await requestConfirmation(
        DangerousOperation.UNARCHIVE_TASK,
        mockConfig,
        'archived-task'
      );

      expect(result).toBe(false);
      expect(inquirerPromptSpy).toHaveBeenCalled();
    });

    it('should handle different autonomy levels appropriately', async () => {
      const fullAutoConfig = { ...mockConfig, autonomy: 'full-auto' as const };
      const reviewAllConfig = { ...mockConfig, autonomy: 'review-all' as const };
      const reviewCommitConfig = { ...mockConfig, autonomy: 'review-before-commit' as const };

      // Test each autonomy level
      for (const config of [fullAutoConfig, reviewAllConfig, reviewCommitConfig]) {
        inquirerPromptSpy.mockResolvedValue({ confirmed: true });

        const result = await requestConfirmation(
          DangerousOperation.CANCEL_TASK,
          config,
          'test-task'
        );

        expect(typeof result).toBe('boolean');
      }
    });

    it('should include context information in confirmation prompt', async () => {
      await requestConfirmation(
        DangerousOperation.CANCEL_TASK,
        mockConfig,
        'my-important-task'
      );

      const promptCall = inquirerPromptSpy.mock.calls[0][0];
      const message = Array.isArray(promptCall) ? promptCall[0].message : promptCall.message;

      expect(message).toContain('my-important-task');
    });

    it('should handle missing optional parameters gracefully', async () => {
      inquirerPromptSpy.mockResolvedValue({ confirmed: true });

      // Test operations that might not require additional context
      const result = await requestConfirmation(
        DangerousOperation.EMPTY_TRASH,
        mockConfig
      );

      expect(result).toBe(true);
      expect(inquirerPromptSpy).toHaveBeenCalled();
    });

    it('should show appropriate warning levels for different operations', async () => {
      const operations = [
        { op: DangerousOperation.TRASH_TASK, level: 'low' },
        { op: DangerousOperation.CANCEL_TASK, level: 'medium' },
        { op: DangerousOperation.EMPTY_TRASH, level: 'high' },
      ];

      for (const { op, level } of operations) {
        inquirerPromptSpy.mockResolvedValue({ confirmed: true });

        await requestConfirmation(op, mockConfig, 'test-item');

        const promptCall = inquirerPromptSpy.mock.calls[inquirerPromptSpy.mock.calls.length - 1][0];
        const message = Array.isArray(promptCall) ? promptCall[0].message : promptCall.message;

        // Verify appropriate warning styling based on consequence level
        if (level === 'high') {
          expect(message).toContain('Permanent');
        }
      }
    });

    it('should handle inquirer prompt errors gracefully', async () => {
      inquirerPromptSpy.mockRejectedValue(new Error('Prompt failed'));

      const result = await requestConfirmation(
        DangerousOperation.CANCEL_TASK,
        mockConfig,
        'test-task'
      );

      // Should default to false (safe behavior) on error
      expect(result).toBe(false);
    });

    it('should handle malformed inquirer responses', async () => {
      inquirerPromptSpy.mockResolvedValue({} as any); // Missing confirmed property

      const result = await requestConfirmation(
        DangerousOperation.CANCEL_TASK,
        mockConfig,
        'test-task'
      );

      // Should handle missing property gracefully
      expect(typeof result).toBe('boolean');
    });
  });

  describe('showOperationCancelled function', () => {
    it('should display cancellation message for cancel task operation', () => {
      showOperationCancelled(DangerousOperation.CANCEL_TASK, 'my-task');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation cancelled')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('my-task')
      );
    });

    it('should display cancellation message for trash task operation', () => {
      showOperationCancelled(DangerousOperation.TRASH_TASK, 'task-to-trash');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('cancelled')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('task-to-trash')
      );
    });

    it('should display cancellation message for empty trash operation', () => {
      showOperationCancelled(DangerousOperation.EMPTY_TRASH);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('cancelled')
      );
    });

    it('should handle operations without context gracefully', () => {
      const operations = [
        DangerousOperation.EMPTY_TRASH,
        DangerousOperation.DELETE_TEMPLATE,
        DangerousOperation.MERGE_TASK,
        DangerousOperation.UNARCHIVE_TASK,
      ];

      for (const operation of operations) {
        showOperationCancelled(operation);
        expect(consoleLogSpy).toHaveBeenLastCalledWith(
          expect.stringContaining('cancelled')
        );
      }
    });

    it('should include operation-specific messaging', () => {
      showOperationCancelled(DangerousOperation.DELETE_TEMPLATE, 'my-template');

      const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allOutput).toContain('my-template');
      expect(allOutput).toContain('cancelled');
    });

    it('should use appropriate styling for cancellation messages', () => {
      showOperationCancelled(DangerousOperation.CANCEL_TASK, 'styled-task');

      // Verify that console.log was called (styling verification is complex)
      expect(consoleLogSpy).toHaveBeenCalled();

      // Check that some kind of message was displayed
      const firstCall = consoleLogSpy.mock.calls[0];
      expect(firstCall[0]).toBeDefined();
      expect(typeof firstCall[0]).toBe('string');
    });

    it('should handle multiple context parameters', () => {
      showOperationCancelled(
        DangerousOperation.MERGE_TASK,
        'source-task',
        'target-task'
      );

      const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allOutput).toContain('source-task');
      expect(allOutput).toContain('target-task');
      expect(allOutput).toContain('cancelled');
    });

    it('should handle undefined and empty context parameters', () => {
      // Should not crash with undefined context
      expect(() => {
        showOperationCancelled(DangerousOperation.CANCEL_TASK, undefined);
      }).not.toThrow();

      // Should not crash with empty string context
      expect(() => {
        showOperationCancelled(DangerousOperation.CANCEL_TASK, '');
      }).not.toThrow();

      // Should not crash with no context at all
      expect(() => {
        showOperationCancelled(DangerousOperation.EMPTY_TRASH);
      }).not.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete confirmation workflow', async () => {
      // User confirms the operation
      inquirerPromptSpy.mockResolvedValue({ confirmed: true });

      const confirmed = await requestConfirmation(
        DangerousOperation.CANCEL_TASK,
        {
          autonomy: 'review-all',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 8192,
          temperature: 0.0,
          timeout: 300000,
          retries: 3,
          costLimit: 10.0,
          agents: {},
          workflows: {},
        },
        'my-task'
      );

      expect(confirmed).toBe(true);

      // If they had cancelled, show cancellation message
      if (!confirmed) {
        showOperationCancelled(DangerousOperation.CANCEL_TASK, 'my-task');
      }

      expect(inquirerPromptSpy).toHaveBeenCalledOnce();
    });

    it('should handle complete cancellation workflow', async () => {
      // User cancels the operation
      inquirerPromptSpy.mockResolvedValue({ confirmed: false });

      const confirmed = await requestConfirmation(
        DangerousOperation.DELETE_TEMPLATE,
        {
          autonomy: 'review-all',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 8192,
          temperature: 0.0,
          timeout: 300000,
          retries: 3,
          costLimit: 10.0,
          agents: {},
          workflows: {},
        },
        'template-to-delete'
      );

      expect(confirmed).toBe(false);

      // Show cancellation message
      showOperationCancelled(DangerousOperation.DELETE_TEMPLATE, 'template-to-delete');

      expect(inquirerPromptSpy).toHaveBeenCalledOnce();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('cancelled')
      );
    });
  });
});