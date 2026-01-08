import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { showApprovalPrompt, promptForAdditionalInfo, type ApprovalPromptOptions } from '../approval-prompt.js';
import type { ApprovalRequiredEventData, ApprovalResponse } from '@apexcli/core';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock chalk to return plain text for easier testing
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

// Mock console.log to capture output for verification
const originalConsoleLog = console.log;
let consoleOutput: string[] = [];

describe('approval-prompt', () => {
  const mockInquirer = vi.mocked(await import('inquirer'));
  let mockEventData: ApprovalRequiredEventData;
  let mockOnSelection: vi.MockedFunction<(response: ApprovalResponse) => Promise<void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    console.log = vi.fn((...args: unknown[]) => {
      consoleOutput.push(args.join(' '));
    });

    mockEventData = {
      approvalId: 'test-approval-id',
      taskId: 'test-task-id',
      gateName: 'test-gate',
      gateType: 'pre-action',
      description: 'Test approval request',
      stage: 'test-stage',
      agent: 'test-agent',
      timestamp: new Date('2023-01-01T00:00:00.000Z'),
      affectedFiles: ['file1.ts', 'file2.ts'],
      changesSummary: 'Test changes summary',
      context: { key: 'value' },
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

  describe('showApprovalPrompt', () => {
    it('should handle approve selection', async () => {
      // Mock user selecting 'approve'
      mockInquirer.default.prompt.mockResolvedValueOnce({
        decision: 'approve'
      });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      expect(mockOnSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-approval-id',
          taskId: 'test-task-id',
          response: 'approved',
          approvalId: 'test-approval-id',
          gateName: 'test-gate',
          action: 'approve',
          approver: 'cli-user',
          resolved: true
        })
      );
    });

    it('should handle deny selection with reason', async () => {
      // Mock user selecting 'deny' and providing reason
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'deny' })
        .mockResolvedValueOnce({ reason: 'Test denial reason' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      expect(mockOnSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-approval-id',
          response: 'denied',
          message: 'Test denial reason',
          comment: 'Test denial reason',
          resolved: true
        })
      );
    });

    it('should handle info request selection', async () => {
      // Mock user selecting 'info' and providing request
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'info' })
        .mockResolvedValueOnce({ infoRequest: 'Need more details' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      expect(mockOnSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          response: 'info-requested',
          message: 'Need more details',
          comment: 'Need more details',
          resolved: false
        })
      );
    });

    it('should display timeout information correctly', async () => {
      // Mock current time to be before expiration
      vi.setSystemTime(new Date('2023-01-01T00:15:00.000Z'));

      mockInquirer.default.prompt.mockResolvedValueOnce({
        decision: 'approve'
      });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      // Should show timeout information
      expect(consoleOutput.some(line => line.includes('Expires in 15 minutes'))).toBe(true);

      vi.useRealTimers();
    });

    it('should display all approval information correctly', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      // Verify that all important information is displayed
      expect(consoleOutput.some(line => line.includes('Approval Required'))).toBe(true);
      expect(consoleOutput.some(line => line.includes(mockEventData.description!))).toBe(true);
      expect(consoleOutput.some(line => line.includes(mockEventData.taskId))).toBe(true);
      expect(consoleOutput.some(line => line.includes(mockEventData.gateName))).toBe(true);
      expect(consoleOutput.some(line => line.includes(mockEventData.stage!))).toBe(true);
      expect(consoleOutput.some(line => line.includes(mockEventData.agent!))).toBe(true);
    });

    it('should display affected files with truncation for long lists', async () => {
      const manyFilesEventData = {
        ...mockEventData,
        affectedFiles: [
          'file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts',
          'file6.ts', 'file7.ts', 'file8.ts'
        ]
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: manyFilesEventData,
        onSelection: mockOnSelection
      });

      // Should display first 5 files and show truncation message
      expect(consoleOutput.some(line => line.includes('file1.ts'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('file5.ts'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('... and 3 more files'))).toBe(true);
    });

    it('should handle optional fields gracefully', async () => {
      const minimalEventData: ApprovalRequiredEventData = {
        approvalId: 'test-approval-123',
        taskId: 'test-task-456',
        gateName: 'file-modification',
        gateType: 'file-operation',
        timestamp: new Date()
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: minimalEventData,
        onSelection: mockOnSelection
      });

      // Should not crash and should display basic info
      expect(consoleOutput.some(line => line.includes('Approval Required'))).toBe(true);
      expect(consoleOutput.some(line => line.includes(minimalEventData.taskId))).toBe(true);
    });

    it('should calculate response time correctly', async () => {
      const startTime = new Date(Date.now() - 5000); // 5 seconds ago
      const eventWithStartTime = { ...mockEventData, timestamp: startTime };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: eventWithStartTime,
        onSelection: mockOnSelection
      });

      const responseCall = mockOnSelection.mock.calls[0][0];
      expect(responseCall.responseTimeMs).toBeGreaterThanOrEqual(4000); // At least 4 seconds
      expect(responseCall.responseTimeMs).toBeLessThan(10000); // Less than 10 seconds
      expect(responseCall.requestedAt).toEqual(startTime);
      expect(responseCall.timestamp).toBeInstanceOf(Date);
    });

    it('should show expired timeout warning', async () => {
      const expiredEventData = {
        ...mockEventData,
        expiresAt: new Date(Date.now() - 60000) // 1 minute ago
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: expiredEventData,
        onSelection: mockOnSelection
      });

      expect(consoleOutput.some(line => line.includes('Already expired'))).toBe(true);
    });

    it('should handle denial without reason', async () => {
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'deny' })
        .mockResolvedValueOnce({ reason: '' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      expect(mockOnSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          response: 'denied',
          message: undefined,
          comment: undefined
        })
      );
    });

    it('should validate info request input correctly', async () => {
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'info' })
        .mockResolvedValueOnce({ infoRequest: 'Valid request' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      // Get the validate function from the second prompt call
      const secondPromptCall = mockInquirer.default.prompt.mock.calls[1];
      const validateFunction = secondPromptCall[0][0].validate;

      // Test validation function
      expect(validateFunction('')).toBe('Please specify what information you need');
      expect(validateFunction('   ')).toBe('Please specify what information you need');
      expect(validateFunction('Valid request')).toBe(true);
    });

    it('should throw error for unexpected decision', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'invalid' });

      await expect(showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      })).rejects.toThrow('Unexpected decision: invalid');
    });

    it('should handle onSelection callback errors', async () => {
      const errorOnSelection = vi.fn().mockRejectedValue(new Error('Callback failed'));
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await expect(showApprovalPrompt({
        eventData: mockEventData,
        onSelection: errorOnSelection
      })).rejects.toThrow('Callback failed');
    });

    it('should preserve context and metadata in response', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      const response = mockOnSelection.mock.calls[0][0];
      expect(response.stage).toBe(mockEventData.stage);
      expect(response.gateName).toBe(mockEventData.gateName);
      expect(response.taskId).toBe(mockEventData.taskId);
      expect(response.requestId).toBe(mockEventData.approvalId);
      expect(response.approvalsRequired).toBe(mockEventData.minApprovals);
    });
  });

  describe('promptForAdditionalInfo', () => {
    it('should prompt for additional information', async () => {
      mockInquirer.default.prompt.mockResolvedValueOnce({
        additionalInfo: 'Additional details provided'
      });

      const result = await promptForAdditionalInfo(
        mockEventData,
        'Need more information about X'
      );

      expect(result).toBe('Additional details provided');
      expect(mockInquirer.default.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'additionalInfo',
          message: 'Please provide the additional information:',
          validate: expect.any(Function)
        })
      ]);
    });

    it('should display additional info request correctly', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo: 'Here is the requested information' });

      const result = await promptForAdditionalInfo(
        mockEventData,
        'Please explain the security implications'
      );

      expect(consoleOutput.some(line => line.includes('Additional Information Requested'))).toBe(true);
      expect(consoleOutput.some(line => line.includes(mockEventData.taskId))).toBe(true);
      expect(consoleOutput.some(line => line.includes(mockEventData.gateName))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Please explain the security implications'))).toBe(true);
      expect(result).toBe('Here is the requested information');
    });

    it('should validate that information is provided', async () => {
      mockInquirer.default.prompt.mockResolvedValueOnce({
        additionalInfo: 'Some info'
      });

      await promptForAdditionalInfo(mockEventData, 'Test request');

      const promptConfig = mockInquirer.default.prompt.mock.calls[0][0][0];

      // Test validation function
      expect(promptConfig.validate('')).toBe('Please provide the requested information');
      expect(promptConfig.validate('   ')).toBe('Please provide the requested information');
      expect(promptConfig.validate('valid input')).toBe(true);
    });

    it('should show confirmation message', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo: 'Provided information' });

      await promptForAdditionalInfo(mockEventData, 'Test request');

      expect(consoleOutput.some(line => line.includes('Additional information provided'))).toBe(true);
    });

    it('should return the additional information provided', async () => {
      const testInfo = 'This is the additional information requested';
      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo: testInfo });

      const result = await promptForAdditionalInfo(mockEventData, 'Test request');

      expect(result).toBe(testInfo);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multi-approval scenarios', async () => {
      const multiApprovalEvent = {
        ...mockEventData,
        minApprovals: 3,
        approvers: ['user1', 'user2', 'admin']
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: multiApprovalEvent,
        onSelection: mockOnSelection
      });

      const response = mockOnSelection.mock.calls[0][0];
      expect(response.approvalsRequired).toBe(3);
      expect(response.approvalsReceived).toBe(1);
      expect(response.resolved).toBe(true); // Single approval still resolves in this implementation
    });

    it('should handle critical blocking operations', async () => {
      const criticalEvent = {
        ...mockEventData,
        gateName: 'critical-operation',
        gateType: 'manual-approval' as const,
        description: 'Critical system modification',
        blocking: true
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: criticalEvent,
        onSelection: mockOnSelection
      });

      expect(consoleOutput.some(line => line.includes('Approval Required'))).toBe(true);
      expect(mockOnSelection).toHaveBeenCalled();

      const response = mockOnSelection.mock.calls[0][0];
      expect(response.resolved).toBe(true);
      expect(response.gateName).toBe('critical-operation');
    });

    it('should preserve all event context in response', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      const response = mockOnSelection.mock.calls[0][0];
      expect(response.stage).toBe(mockEventData.stage);
      expect(response.gateName).toBe(mockEventData.gateName);
      expect(response.taskId).toBe(mockEventData.taskId);
      expect(response.requestId).toBe(mockEventData.approvalId);
      expect(response.approvalId).toBe(mockEventData.approvalId);
    });

    it('should handle complex workflow scenarios with context', async () => {
      const complexEvent = {
        ...mockEventData,
        context: {
          operation: 'database-migration',
          severity: 'high',
          estimatedDuration: '2 hours',
          rollbackPlan: 'available'
        },
        affectedFiles: ['migrations/001_users.sql', 'config/database.yaml'],
        changesSummary: 'Migration to add new user fields and update schema'
      };

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: complexEvent,
        onSelection: mockOnSelection
      });

      // Verify context is displayed
      expect(consoleOutput.some(line => line.includes('Context:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('database-migration'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('severity: high'))).toBe(true);
    });
  });

  describe('Type Safety and Interface Compliance', () => {
    it('should enforce correct ApprovalPromptOptions interface', () => {
      const validOptions: ApprovalPromptOptions = {
        eventData: mockEventData,
        onSelection: mockOnSelection
      };

      expect(validOptions.eventData).toBeDefined();
      expect(validOptions.onSelection).toBeDefined();
      expect(typeof validOptions.onSelection).toBe('function');
    });

    it('should ensure ApprovalResponse interface compliance', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: mockEventData,
        onSelection: mockOnSelection
      });

      const response: ApprovalResponse = mockOnSelection.mock.calls[0][0];

      // Verify all required fields are present
      expect(typeof response.requestId).toBe('string');
      expect(typeof response.taskId).toBe('string');
      expect(['approved', 'denied', 'info-requested']).toContain(response.response);
      expect(typeof response.approvalId).toBe('string');
      expect(typeof response.gateName).toBe('string');
      expect(['approve', 'deny', 'request-info']).toContain(response.action);
      expect(typeof response.approver).toBe('string');
      expect(response.timestamp).toBeInstanceOf(Date);
      expect(response.requestedAt).toBeInstanceOf(Date);
      expect(typeof response.responseTimeMs).toBe('number');
      expect(typeof response.resolved).toBe('boolean');
    });

    it('should handle all approval response types correctly', async () => {
      // Test approve response
      mockInquirer.default.prompt.mockResolvedValueOnce({ decision: 'approve' });
      await showApprovalPrompt({ eventData: mockEventData, onSelection: mockOnSelection });

      let response = mockOnSelection.mock.calls[0][0];
      expect(response.response).toBe('approved');
      expect(response.action).toBe('approve');
      expect(response.resolved).toBe(true);

      // Reset mocks
      vi.clearAllMocks();
      mockOnSelection = vi.fn().mockResolvedValue(undefined);

      // Test deny response
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'deny' })
        .mockResolvedValueOnce({ reason: 'Security concern' });
      await showApprovalPrompt({ eventData: mockEventData, onSelection: mockOnSelection });

      response = mockOnSelection.mock.calls[0][0];
      expect(response.response).toBe('denied');
      expect(response.action).toBe('deny');
      expect(response.resolved).toBe(true);

      // Reset mocks
      vi.clearAllMocks();
      mockOnSelection = vi.fn().mockResolvedValue(undefined);

      // Test info request response
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'info' })
        .mockResolvedValueOnce({ infoRequest: 'Need more details' });
      await showApprovalPrompt({ eventData: mockEventData, onSelection: mockOnSelection });

      response = mockOnSelection.mock.calls[0][0];
      expect(response.response).toBe('info-requested');
      expect(response.action).toBe('request-info');
      expect(response.resolved).toBe(false);
    });
  });
});