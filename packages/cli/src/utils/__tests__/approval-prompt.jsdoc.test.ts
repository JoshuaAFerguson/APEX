import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showApprovalPrompt,
  promptForAdditionalInfo,
  ApprovalPromptOptions
} from '../approval-prompt.js';
import { ApprovalRequiredEventData, ApprovalResponse } from '@apexcli/core';
import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * Test suite for JSDoc documented approval prompt functions
 * Tests the approval workflow for task gates and user interactions
 */
describe('Approval Prompt JSDoc Documented Functionality', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let inquirerPromptSpy: ReturnType<typeof vi.spyOn>;
  let mockOnSelection: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    inquirerPromptSpy = vi.spyOn(inquirer, 'prompt').mockImplementation(() =>
      Promise.resolve({ action: 'approve' })
    );
    mockOnSelection = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    inquirerPromptSpy.mockRestore();
  });

  describe('ApprovalPromptOptions interface validation', () => {
    it('should accept valid ApprovalPromptOptions structure', () => {
      const eventData: ApprovalRequiredEventData = {
        taskId: 'test-task-123',
        gateName: 'pre-commit-review',
        description: 'Review code changes before commit',
        stage: 'implementation',
        agent: 'developer',
        reason: 'Code quality check required',
        affectedFiles: ['src/main.ts', 'README.md'],
        resourceImpact: {
          estimatedCost: 0.05,
          estimatedTokens: 1000,
          estimatedTime: 120000, // 2 minutes
        },
      };

      const options: ApprovalPromptOptions = {
        eventData,
        onSelection: mockOnSelection,
      };

      expect(options.eventData).toBeDefined();
      expect(options.onSelection).toBeDefined();
      expect(typeof options.onSelection).toBe('function');
    });

    it('should handle minimal ApprovalRequiredEventData', () => {
      const minimalEventData: ApprovalRequiredEventData = {
        taskId: 'minimal-task',
        gateName: 'minimal-gate',
        reason: 'Minimal approval required',
      };

      const options: ApprovalPromptOptions = {
        eventData: minimalEventData,
        onSelection: mockOnSelection,
      };

      expect(options.eventData.taskId).toBe('minimal-task');
      expect(options.eventData.gateName).toBe('minimal-gate');
      expect(options.eventData.reason).toBe('Minimal approval required');
    });
  });

  describe('showApprovalPrompt function', () => {
    const fullEventData: ApprovalRequiredEventData = {
      taskId: 'feature-xyz-123',
      gateName: 'security-review',
      description: 'Implement user authentication system',
      stage: 'implementation',
      agent: 'developer',
      reason: 'Security-sensitive code changes detected',
      affectedFiles: [
        'src/auth/login.ts',
        'src/auth/password.ts',
        'src/middleware/auth.ts',
        'tests/auth.test.ts',
      ],
      resourceImpact: {
        estimatedCost: 0.25,
        estimatedTokens: 5000,
        estimatedTime: 300000, // 5 minutes
      },
    };

    it('should display comprehensive approval information', async () => {
      const options: ApprovalPromptOptions = {
        eventData: fullEventData,
        onSelection: mockOnSelection,
      };

      inquirerPromptSpy.mockResolvedValue({ action: 'approve' });

      await showApprovalPrompt(options);

      // Verify header is displayed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Approval Required')
      );

      // Verify task information
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('feature-xyz-123')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('security-review')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('implementation')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('developer')
      );

      // Verify affected files are shown
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Affected Files')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('src/auth/login.ts')
      );

      // Verify resource impact
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Resource Impact')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('0.25')
      );

      // Verify callback was called with approval
      expect(mockOnSelection).toHaveBeenCalledWith('approved');
    });

    it('should handle user denial', async () => {
      const options: ApprovalPromptOptions = {
        eventData: fullEventData,
        onSelection: mockOnSelection,
      };

      inquirerPromptSpy.mockResolvedValue({ action: 'deny' });

      await showApprovalPrompt(options);

      expect(mockOnSelection).toHaveBeenCalledWith('denied');
    });

    it('should handle request for more info', async () => {
      const options: ApprovalPromptOptions = {
        eventData: fullEventData,
        onSelection: mockOnSelection,
      };

      inquirerPromptSpy
        .mockResolvedValueOnce({ action: 'info' })
        .mockResolvedValueOnce({ additionalInfo: 'Please explain the security implications' });

      await showApprovalPrompt(options);

      expect(mockOnSelection).toHaveBeenCalledWith({
        type: 'info-requested',
        message: 'Please explain the security implications',
      });
    });

    it('should display minimal information when data is sparse', async () => {
      const minimalEventData: ApprovalRequiredEventData = {
        taskId: 'minimal-123',
        gateName: 'basic-gate',
        reason: 'Basic approval needed',
      };

      const options: ApprovalPromptOptions = {
        eventData: minimalEventData,
        onSelection: mockOnSelection,
      };

      inquirerPromptSpy.mockResolvedValue({ action: 'approve' });

      await showApprovalPrompt(options);

      // Should still show basic information
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('minimal-123')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('basic-gate')
      );

      expect(mockOnSelection).toHaveBeenCalledWith('approved');
    });

    it('should handle many affected files by truncating display', async () => {
      const manyFilesEventData: ApprovalRequiredEventData = {
        taskId: 'large-change-456',
        gateName: 'bulk-review',
        reason: 'Many files changed',
        affectedFiles: [
          'file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts',
          'file6.ts', 'file7.ts', 'file8.ts', 'file9.ts', 'file10.ts'
        ],
      };

      const options: ApprovalPromptOptions = {
        eventData: manyFilesEventData,
        onSelection: mockOnSelection,
      };

      inquirerPromptSpy.mockResolvedValue({ action: 'approve' });

      await showApprovalPrompt(options);

      // Should show first 5 files
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('file1.ts')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('file5.ts')
      );

      // Should indicate more files exist
      const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allOutput).toContain('5 more');
    });

    it('should handle resource impact with various values', async () => {
      const resourceEventData: ApprovalRequiredEventData = {
        taskId: 'resource-test-789',
        gateName: 'resource-gate',
        reason: 'Resource intensive operation',
        resourceImpact: {
          estimatedCost: 1.50,
          estimatedTokens: 25000,
          estimatedTime: 600000, // 10 minutes
        },
      };

      const options: ApprovalPromptOptions = {
        eventData: resourceEventData,
        onSelection: mockOnSelection,
      };

      inquirerPromptSpy.mockResolvedValue({ action: 'approve' });

      await showApprovalPrompt(options);

      const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allOutput).toContain('1.50');
      expect(allOutput).toContain('25000');
      expect(allOutput).toContain('10');
    });

    it('should handle inquirer errors gracefully', async () => {
      const options: ApprovalPromptOptions = {
        eventData: fullEventData,
        onSelection: mockOnSelection,
      };

      inquirerPromptSpy.mockRejectedValue(new Error('Prompt failed'));

      await expect(showApprovalPrompt(options)).rejects.toThrow('Prompt failed');
    });

    it('should handle callback errors gracefully', async () => {
      const options: ApprovalPromptOptions = {
        eventData: fullEventData,
        onSelection: vi.fn().mockRejectedValue(new Error('Callback failed')),
      };

      inquirerPromptSpy.mockResolvedValue({ action: 'approve' });

      await expect(showApprovalPrompt(options)).rejects.toThrow('Callback failed');
    });

    it('should present correct action choices to user', async () => {
      const options: ApprovalPromptOptions = {
        eventData: fullEventData,
        onSelection: mockOnSelection,
      };

      inquirerPromptSpy.mockResolvedValue({ action: 'approve' });

      await showApprovalPrompt(options);

      const promptCall = inquirerPromptSpy.mock.calls[0][0];
      const choices = Array.isArray(promptCall) ? promptCall[0].choices : promptCall.choices;

      expect(choices).toContain(
        expect.objectContaining({ value: 'approve' })
      );
      expect(choices).toContain(
        expect.objectContaining({ value: 'deny' })
      );
      expect(choices).toContain(
        expect.objectContaining({ value: 'info' })
      );
    });
  });

  describe('promptForAdditionalInfo function', () => {
    const originalRequest: ApprovalRequiredEventData = {
      taskId: 'info-request-test',
      gateName: 'info-gate',
      reason: 'Need more information',
      description: 'Complex operation requiring clarification',
    };

    it('should prompt for additional information with context', async () => {
      const infoRequest = 'Please explain the security implications of this change';

      inquirerPromptSpy.mockResolvedValue({
        additionalInfo: 'This change adds authentication middleware to protect sensitive endpoints'
      });

      const result = await promptForAdditionalInfo(originalRequest, infoRequest);

      expect(result).toBe('This change adds authentication middleware to protect sensitive endpoints');

      // Verify context is displayed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Additional Information Requested')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(infoRequest)
      );
    });

    it('should display original request context', async () => {
      const infoRequest = 'What files will be affected?';

      inquirerPromptSpy.mockResolvedValue({
        additionalInfo: 'Authentication files in src/auth/ directory'
      });

      await promptForAdditionalInfo(originalRequest, infoRequest);

      const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allOutput).toContain('info-request-test');
      expect(allOutput).toContain('info-gate');
      expect(allOutput).toContain('Complex operation requiring clarification');
    });

    it('should handle empty info request gracefully', async () => {
      inquirerPromptSpy.mockResolvedValue({
        additionalInfo: 'User provided info despite empty request'
      });

      const result = await promptForAdditionalInfo(originalRequest, '');

      expect(result).toBe('User provided info despite empty request');
      expect(inquirerPromptSpy).toHaveBeenCalled();
    });

    it('should handle long info requests appropriately', async () => {
      const longInfoRequest = 'This is a very long information request that goes into great detail about what the user wants to know about the operation including all the technical details and implications that might be relevant to making an informed decision about whether to approve or deny this particular operation.';

      inquirerPromptSpy.mockResolvedValue({
        additionalInfo: 'Detailed response to long request'
      });

      const result = await promptForAdditionalInfo(originalRequest, longInfoRequest);

      expect(result).toBe('Detailed response to long request');

      const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allOutput).toContain(longInfoRequest);
    });

    it('should handle user cancellation or empty response', async () => {
      inquirerPromptSpy.mockResolvedValue({
        additionalInfo: ''
      });

      const result = await promptForAdditionalInfo(originalRequest, 'Please provide details');

      expect(result).toBe('');
    });

    it('should handle prompt errors during info request', async () => {
      inquirerPromptSpy.mockRejectedValue(new Error('Info prompt failed'));

      await expect(
        promptForAdditionalInfo(originalRequest, 'Failing request')
      ).rejects.toThrow('Info prompt failed');
    });

    it('should format the prompt appropriately', async () => {
      const infoRequest = 'How will this affect performance?';

      inquirerPromptSpy.mockResolvedValue({
        additionalInfo: 'Minimal performance impact expected'
      });

      await promptForAdditionalInfo(originalRequest, infoRequest);

      const promptCall = inquirerPromptSpy.mock.calls[0][0];
      const prompt = Array.isArray(promptCall) ? promptCall[0] : promptCall;

      expect(prompt.type).toBe('input');
      expect(prompt.name).toBe('additionalInfo');
      expect(prompt.message).toContain('Your response');
    });
  });

  describe('Integration workflows', () => {
    it('should handle complete approval workflow', async () => {
      const eventData: ApprovalRequiredEventData = {
        taskId: 'workflow-test',
        gateName: 'workflow-gate',
        reason: 'Testing complete workflow',
        description: 'End-to-end approval test',
        affectedFiles: ['test.ts'],
        resourceImpact: {
          estimatedCost: 0.1,
          estimatedTokens: 1000,
          estimatedTime: 60000,
        },
      };

      const options: ApprovalPromptOptions = {
        eventData,
        onSelection: mockOnSelection,
      };

      // User approves
      inquirerPromptSpy.mockResolvedValue({ action: 'approve' });

      await showApprovalPrompt(options);

      expect(mockOnSelection).toHaveBeenCalledWith('approved');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Approval Required')
      );
    });

    it('should handle info request followed by response', async () => {
      const eventData: ApprovalRequiredEventData = {
        taskId: 'info-workflow-test',
        gateName: 'info-gate',
        reason: 'Testing info request workflow',
      };

      // First call: user requests info
      inquirerPromptSpy
        .mockResolvedValueOnce({ action: 'info' })
        .mockResolvedValueOnce({ additionalInfo: 'Here is the requested information' });

      const options: ApprovalPromptOptions = {
        eventData,
        onSelection: mockOnSelection,
      };

      await showApprovalPrompt(options);

      expect(mockOnSelection).toHaveBeenCalledWith({
        type: 'info-requested',
        message: 'Here is the requested information',
      });
    });
  });
});