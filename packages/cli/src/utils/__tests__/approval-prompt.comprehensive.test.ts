import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { showApprovalPrompt, promptForAdditionalInfo, type ApprovalPromptOptions } from '../approval-prompt.js';
import type { ApprovalRequiredEventData, ApprovalResponse } from '@apexcli/core';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock chalk - simplified version for testing
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((text: string) => text),
    bold: { white: vi.fn((text: string) => text) },
    gray: vi.fn((text: string) => text),
    white: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    magenta: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text)
  }
}));

// Console capture setup
const originalConsoleLog = console.log;
let consoleOutput: string[] = [];

describe('Approval Prompt - Comprehensive Tests', () => {
  const mockInquirer = vi.mocked(await import('inquirer'));
  let mockEventData: ApprovalRequiredEventData;
  let mockOnSelection: vi.MockedFunction<(response: ApprovalResponse) => Promise<void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    console.log = vi.fn((...args: unknown[]) => {
      consoleOutput.push(args.join(' '));
    });

    // Create comprehensive mock event data
    mockEventData = {
      approvalId: 'test-approval-comprehensive',
      taskId: 'test-task-comprehensive',
      gateName: 'comprehensive-gate',
      gateType: 'pre-action',
      description: 'Comprehensive test approval request',
      stage: 'test-stage',
      agent: 'test-agent',
      timestamp: new Date('2023-01-01T00:00:00.000Z'),
      affectedFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
      changesSummary: 'Comprehensive test changes',
      context: {
        operation: 'test-operation',
        severity: 'medium',
        impact: 'low'
      },
      timeoutMinutes: 30,
      expiresAt: new Date('2023-01-01T00:30:00.000Z'),
      minApprovals: 1,
      blocking: true
    };

    mockOnSelection = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.useRealTimers();
  });

  describe('Display Formatting and UI Tests', () => {
    it('should format approval header correctly with proper spacing', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      // Check for header formatting
      expect(consoleOutput.some(line => line.includes('Approval Required'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('─'.repeat(80)))).toBe(true);

      // Check for proper field labels
      expect(consoleOutput.some(line => line.includes('Description:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Task ID:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Gate:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Stage:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Agent:'))).toBe(true);
    });

    it('should display file list with proper indentation and icons', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      // Check for file list formatting
      expect(consoleOutput.some(line => line.includes('📁 Affected Files:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('  • file1.ts'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('  • file2.ts'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('  • file3.ts'))).toBe(true);
    });

    it('should display context information with proper formatting', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      // Check for context display
      expect(consoleOutput.some(line => line.includes('🔍 Context:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('operation: test-operation'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('severity: medium'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('impact: low'))).toBe(true);
    });

    it('should handle mixed data types in context correctly', async () => {
      const complexContext = {
        stringValue: 'test-string',
        numberValue: 42,
        booleanValue: true,
        nullValue: null,
        undefinedValue: undefined,
        objectValue: { nested: 'value' },
        arrayValue: ['item1', 'item2']
      };

      const eventWithComplexContext = {
        ...mockEventData,
        context: complexContext
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: eventWithComplexContext,
        onSelection: mockOnSelection
      });

      // Verify different data types are converted to strings properly
      expect(consoleOutput.some(line => line.includes('stringValue: test-string'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('numberValue: 42'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('booleanValue: true'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('objectValue: [object Object]'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('arrayValue: item1,item2'))).toBe(true);
    });
  });

  describe('Time and Timeout Handling', () => {
    it('should calculate and display remaining time correctly', async () => {
      // Set current time to be 15 minutes before expiration
      vi.setSystemTime(new Date('2023-01-01T00:15:00.000Z'));

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      expect(consoleOutput.some(line => line.includes('Expires in 15 minutes'))).toBe(true);
    });

    it('should handle expired timeouts with warning message', async () => {
      // Set current time to be 1 hour after expiration
      vi.setSystemTime(new Date('2023-01-01T01:30:00.000Z'));

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      expect(consoleOutput.some(line => line.includes('Already expired'))).toBe(true);
    });

    it('should show both timeout minutes and expiration time when both are present', async () => {
      vi.setSystemTime(new Date('2023-01-01T00:10:00.000Z'));

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      expect(consoleOutput.some(line => line.includes('30 minutes from request'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Expires in 20 minutes'))).toBe(true);
    });

    it('should calculate response time accurately for different durations', async () => {
      const testCases = [
        { delay: 1000, expectedMin: 900, expectedMax: 1100 }, // 1 second
        { delay: 30000, expectedMin: 29000, expectedMax: 31000 }, // 30 seconds
        { delay: 300000, expectedMin: 299000, expectedMax: 301000 } // 5 minutes
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        const startTime = new Date(Date.now() - testCase.delay);
        const eventWithStartTime = { ...mockEventData, timestamp: startTime };

        mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

        await showApprovalPrompt({
          eventData: eventWithStartTime,
          onSelection: mockOnSelection
        });

        const response = mockOnSelection.mock.calls[0][0];
        expect(response.responseTimeMs).toBeGreaterThanOrEqual(testCase.expectedMin);
        expect(response.responseTimeMs).toBeLessThan(testCase.expectedMax);
      }
    });
  });

  describe('File List Display Logic', () => {
    it('should show all files when count is 5 or less', async () => {
      const eventWithFewFiles = {
        ...mockEventData,
        affectedFiles: ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts']
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: eventWithFewFiles,
        onSelection: mockOnSelection
      });

      // All files should be shown
      expect(consoleOutput.some(line => line.includes('file1.ts'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('file5.ts'))).toBe(true);
      // No truncation message should appear
      expect(consoleOutput.some(line => line.includes('... and'))).toBe(false);
    });

    it('should truncate file list when more than 5 files', async () => {
      const manyFiles = Array.from({ length: 10 }, (_, i) => `file${i + 1}.ts`);
      const eventWithManyFiles = {
        ...mockEventData,
        affectedFiles: manyFiles
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: eventWithManyFiles,
        onSelection: mockOnSelection
      });

      // First 5 files should be shown
      expect(consoleOutput.some(line => line.includes('file1.ts'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('file5.ts'))).toBe(true);
      // File 6 should not be shown
      expect(consoleOutput.some(line => line.includes('file6.ts'))).toBe(false);
      // Truncation message should appear
      expect(consoleOutput.some(line => line.includes('... and 5 more files'))).toBe(true);
    });

    it('should handle empty file list gracefully', async () => {
      const eventWithNoFiles = {
        ...mockEventData,
        affectedFiles: []
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: eventWithNoFiles,
        onSelection: mockOnSelection
      });

      // File section should not appear
      expect(consoleOutput.some(line => line.includes('📁 Affected Files:'))).toBe(false);
    });

    it('should handle undefined or null file list', async () => {
      const eventWithUndefinedFiles = {
        ...mockEventData,
        affectedFiles: undefined
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: eventWithUndefinedFiles,
        onSelection: mockOnSelection
      });

      // Should not crash and file section should not appear
      expect(consoleOutput.some(line => line.includes('📁 Affected Files:'))).toBe(false);
    });
  });

  describe('Input Validation and Error Handling', () => {
    it('should validate info request input properly', async () => {
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'info' })
        .mockResolvedValueOnce({ infoRequest: 'Valid request message' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      // Get the validate function from the second prompt call
      const secondPromptCall = mockInquirer.default.prompt.mock.calls[1];
      const validateFunction = secondPromptCall[0][0].validate;

      // Test various validation scenarios
      expect(validateFunction('')).toBe('Please specify what information you need');
      expect(validateFunction('   ')).toBe('Please specify what information you need');
      expect(validateFunction('\\t\\n  ')).toBe('Please specify what information you need');
      expect(validateFunction('Valid input')).toBe(true);
      expect(validateFunction('   Valid input with whitespace   ')).toBe(true);
    });

    it('should validate additional info input properly', async () => {
      mockInquirer.default.prompt.mockResolvedValueOnce({
        additionalInfo: 'Valid additional information'
      });

      await promptForAdditionalInfo(mockEventData, 'Test request');

      const promptConfig = mockInquirer.default.prompt.mock.calls[0][0][0];
      const validateFunction = promptConfig.validate;

      // Test validation function
      expect(validateFunction('')).toBe('Please provide the requested information');
      expect(validateFunction('   ')).toBe('Please provide the requested information');
      expect(validateFunction('\\n\\t  ')).toBe('Please provide the requested information');
      expect(validateFunction('Valid response')).toBe(true);
      expect(validateFunction('  Valid response with spaces  ')).toBe(true);
    });

    it('should handle inquirer prompt rejection gracefully', async () => {
      const inquirerError = new Error('User canceled prompt');
      mockInquirer.default.prompt.mockRejectedValue(inquirerError);

      await expect(showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      })).rejects.toThrow('User canceled prompt');

      // onSelection should not be called when prompt fails
      expect(mockOnSelection).not.toHaveBeenCalled();
    });

    it('should propagate onSelection callback errors', async () => {
      const callbackError = new Error('Callback processing failed');
      const failingCallback = vi.fn().mockRejectedValue(callbackError);

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await expect(showApprovalPrompt({
        eventData: mockEventData,
        onSelection: failingCallback
      })).rejects.toThrow('Callback processing failed');

      expect(failingCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Object Structure and Completeness', () => {
    it('should include all required fields in approval response', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      const response: ApprovalResponse = mockOnSelection.mock.calls[0][0];

      // Required fields
      expect(response.requestId).toBe(mockEventData.approvalId);
      expect(response.taskId).toBe(mockEventData.taskId);
      expect(response.response).toBe('approved');
      expect(response.approvalId).toBe(mockEventData.approvalId);
      expect(response.gateName).toBe(mockEventData.gateName);
      expect(response.action).toBe('approve');
      expect(response.approver).toBe('cli-user');
      expect(response.timestamp).toBeInstanceOf(Date);
      expect(response.requestedAt).toBe(mockEventData.timestamp);
      expect(typeof response.responseTimeMs).toBe('number');
      expect(response.resolved).toBe(true);

      // Optional fields that should be present for approval
      expect(response.stage).toBe(mockEventData.stage);
      expect(response.approvalsReceived).toBe(1);
      expect(response.approvalsRequired).toBe(mockEventData.minApprovals);
    });

    it('should include denial reason in denial response', async () => {
      const denialReason = 'Security vulnerability detected in the changes';
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'deny' })
        .mockResolvedValueOnce({ reason: denialReason });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      const response: ApprovalResponse = mockOnSelection.mock.calls[0][0];

      expect(response.response).toBe('denied');
      expect(response.action).toBe('deny');
      expect(response.message).toBe(denialReason);
      expect(response.comment).toBe(denialReason);
      expect(response.resolved).toBe(true);
      expect(response.approvalsReceived).toBe(0);
    });

    it('should handle denial without reason correctly', async () => {
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'deny' })
        .mockResolvedValueOnce({ reason: '' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      const response: ApprovalResponse = mockOnSelection.mock.calls[0][0];

      expect(response.response).toBe('denied');
      expect(response.message).toBeUndefined();
      expect(response.comment).toBeUndefined();
    });

    it('should include info request in info-requested response', async () => {
      const infoRequest = 'Please provide more details about the database migration strategy';
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'info' })
        .mockResolvedValueOnce({ infoRequest });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      const response: ApprovalResponse = mockOnSelection.mock.calls[0][0];

      expect(response.response).toBe('info-requested');
      expect(response.action).toBe('request-info');
      expect(response.message).toBe(infoRequest);
      expect(response.comment).toBe(infoRequest);
      expect(response.resolved).toBe(false);
      expect(response.approvalsReceived).toBe(0);
    });
  });

  describe('Multi-Approval Scenarios', () => {
    it('should handle multi-approval requirements correctly', async () => {
      const multiApprovalEvent = {
        ...mockEventData,
        minApprovals: 3,
        approvers: ['admin1', 'admin2', 'lead-developer']
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: multiApprovalEvent,
        onSelection: mockOnSelection
      });

      const response = mockOnSelection.mock.calls[0][0];
      expect(response.approvalsRequired).toBe(3);
      expect(response.approvalsReceived).toBe(1);
      // Note: In this implementation, each individual approval is still marked as resolved
      expect(response.resolved).toBe(true);
    });

    it('should handle default minApprovals when not specified', async () => {
      const eventWithoutMinApprovals = {
        ...mockEventData,
        minApprovals: undefined
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: eventWithoutMinApprovals,
        onSelection: mockOnSelection
      });

      const response = mockOnSelection.mock.calls[0][0];
      expect(response.approvalsRequired).toBe(1); // Should default to 1
      expect(response.approvalsReceived).toBe(1);
    });
  });

  describe('Console Output and User Feedback', () => {
    it('should display appropriate confirmation messages for each decision type', async () => {
      // Test approval confirmation
      mockInquirer.default.prompt.mockResolvedValueOnce({ decision: 'approve' });
      await showApprovalPrompt({ eventData: mockEventData, onSelection: mockOnSelection });
      expect(consoleOutput.some(line => line.includes('Approval granted. Task will continue'))).toBe(true);

      // Reset and test denial confirmation
      vi.clearAllMocks();
      consoleOutput = [];
      console.log = vi.fn((...args: unknown[]) => {
        consoleOutput.push(args.join(' '));
      });

      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'deny' })
        .mockResolvedValueOnce({ reason: 'Test reason' });
      await showApprovalPrompt({ eventData: mockEventData, onSelection: mockOnSelection });
      expect(consoleOutput.some(line => line.includes('Approval denied. Task will be blocked'))).toBe(true);

      // Reset and test info request confirmation
      vi.clearAllMocks();
      consoleOutput = [];
      console.log = vi.fn((...args: unknown[]) => {
        consoleOutput.push(args.join(' '));
      });

      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'info' })
        .mockResolvedValueOnce({ infoRequest: 'Test info request' });
      await showApprovalPrompt({ eventData: mockEventData, onSelection: mockOnSelection });
      expect(consoleOutput.some(line => line.includes('Information requested. Waiting for response'))).toBe(true);
    });

    it('should maintain consistent spacing in console output', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      // Check for empty line spacing at the beginning and end
      expect(consoleOutput[0]).toBe(''); // Should start with empty line
      expect(consoleOutput[consoleOutput.length - 1]).toBe(''); // Should end with empty line
    });
  });

  describe('promptForAdditionalInfo Function Tests', () => {
    it('should display original request context correctly', async () => {
      const infoRequest = 'Please explain the rollback procedure';
      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo: 'Detailed rollback explanation' });

      await promptForAdditionalInfo(mockEventData, infoRequest);

      expect(consoleOutput.some(line => line.includes('Additional Information Requested'))).toBe(true);
      expect(consoleOutput.some(line => line.includes(mockEventData.taskId))).toBe(true);
      expect(consoleOutput.some(line => line.includes(mockEventData.gateName))).toBe(true);
      expect(consoleOutput.some(line => line.includes(infoRequest))).toBe(true);
    });

    it('should return the provided additional information', async () => {
      const additionalInfo = 'This is the additional information provided by the user';
      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo });

      const result = await promptForAdditionalInfo(mockEventData, 'Test request');

      expect(result).toBe(additionalInfo);
    });

    it('should display confirmation message after information is provided', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo: 'Test info' });

      await promptForAdditionalInfo(mockEventData, 'Test request');

      expect(consoleOutput.some(line => line.includes('Additional information provided'))).toBe(true);
    });

    it('should handle minimal event data for info request', async () => {
      const minimalEventData: ApprovalRequiredEventData = {
        approvalId: 'minimal-approval',
        taskId: 'minimal-task',
        gateName: 'minimal-gate',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo: 'Minimal response' });

      const result = await promptForAdditionalInfo(minimalEventData, 'Minimal request');

      expect(result).toBe('Minimal response');
      expect(consoleOutput.some(line => line.includes('minimal-task'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('minimal-gate'))).toBe(true);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long task IDs gracefully', async () => {
      const longTaskId = 'very-long-task-id-'.repeat(20) + 'end';
      const eventWithLongTaskId = {
        ...mockEventData,
        taskId: longTaskId
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: eventWithLongTaskId,
        onSelection: mockOnSelection
      });

      expect(consoleOutput.some(line => line.includes(longTaskId))).toBe(true);
      const response = mockOnSelection.mock.calls[0][0];
      expect(response.taskId).toBe(longTaskId);
    });

    it('should handle special characters in all text fields', async () => {
      const specialCharsEvent = {
        ...mockEventData,
        description: 'Test with émojis 🎉, special chars: <>&"\\',
        gateName: 'special-gate-✨',
        stage: 'special-stage-💻',
        agent: 'special-agent-🤖',
        changesSummary: 'Changes with unicode: ∀x∈ℝ, α→β transitions'
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: specialCharsEvent,
        onSelection: mockOnSelection
      });

      // Should handle special characters without crashing
      expect(consoleOutput.some(line => line.includes('émojis 🎉'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('special-gate-✨'))).toBe(true);
    });

    it('should handle extremely large numbers of affected files', async () => {
      const manyFiles = Array.from({ length: 1000 }, (_, i) => `auto-generated-file-${i}.ts`);
      const eventWithManyFiles = {
        ...mockEventData,
        affectedFiles: manyFiles
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: eventWithManyFiles,
        onSelection: mockOnSelection
      });

      // Should show truncation message with correct count
      expect(consoleOutput.some(line => line.includes('... and 995 more files'))).toBe(true);
    });

    it('should handle empty or whitespace-only strings in optional fields', async () => {
      const emptyFieldsEvent = {
        ...mockEventData,
        description: '   ',
        changesSummary: '',
        stage: null,
        agent: undefined
      } as any;

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: emptyFieldsEvent,
        onSelection: mockOnSelection
      });

      // Should not display empty optional fields
      expect(consoleOutput.some(line => line.includes('Description:') && line.includes('   '))).toBe(false);
      expect(consoleOutput.some(line => line.includes('Stage:'))).toBe(false);
      expect(consoleOutput.some(line => line.includes('Agent:'))).toBe(false);
    });
  });
});