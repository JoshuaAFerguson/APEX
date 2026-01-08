import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showApprovalPrompt, promptForAdditionalInfo } from '../utils/approval-prompt.js';
import type { ApprovalRequiredEventData, ApprovalResponse } from '@apexcli/core';

// Mock dependencies
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

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

// Console capture for edge case testing
const originalConsole = { ...console };
let consoleOutput: string[] = [];

describe('Approval Edge Cases and Error Scenarios', () => {
  const mockInquirer = vi.mocked(await import('inquirer'));
  let baseEventData: ApprovalRequiredEventData;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    console.log = vi.fn((...args: unknown[]) => {
      consoleOutput.push(args.join(' '));
    });

    baseEventData = {
      approvalId: 'edge-test-approval',
      taskId: 'edge-test-task',
      gateName: 'edge-test-gate',
      gateType: 'pre-action',
      timestamp: new Date(),
      blocking: true
    };
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
    vi.useRealTimers();
  });

  describe('Data Validation and Sanitization', () => {
    it('should handle extremely long strings in all fields', async () => {
      const longString = 'x'.repeat(10000);
      const edgeEventData = {
        ...baseEventData,
        approvalId: longString,
        taskId: longString,
        gateName: longString,
        description: longString,
        changesSummary: longString,
        stage: longString,
        agent: longString
      };

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: edgeEventData,
        onSelection: mockOnSelection
      });

      // Should not crash and should handle long strings
      expect(mockOnSelection).toHaveBeenCalled();
      const response = mockOnSelection.mock.calls[0][0];
      expect(response.requestId).toBe(longString);
      expect(response.taskId).toBe(longString);
      expect(response.gateName).toBe(longString);
    });

    it('should handle special unicode characters and emojis', async () => {
      const unicodeData = {
        ...baseEventData,
        description: '测试 approval with 🚀 emojis and ñ, é, ü special chars',
        gateName: '🔐-security-gate-✨',
        agent: '🤖-ai-agent',
        changesSummary: 'Changes include: ∀ symbols, → arrows, and 💾 data persistence'
      };

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: unicodeData,
        onSelection: mockOnSelection
      });

      // Should handle unicode without issues
      expect(consoleOutput.some(line => line.includes('🚀 emojis'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('🔐-security-gate-✨'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('🤖-ai-agent'))).toBe(true);
    });

    it('should handle malformed or dangerous input strings', async () => {
      const dangerousData = {
        ...baseEventData,
        description: '<script>alert("xss")</script>',
        gateName: '\\x00null\\xFF\\n\\r\\t',
        changesSummary: 'SQL injection: \\'; DROP TABLE users; --',
        context: {
          'malicious-key': '<iframe src="javascript:alert()">',
          'null-bytes': '\\x00\\x01\\x02',
          'control-chars': '\\r\\n\\t\\v\\f'
        }
      };

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: dangerousData,
        onSelection: mockOnSelection
      });

      // Should handle dangerous strings safely
      expect(mockOnSelection).toHaveBeenCalled();
      expect(consoleOutput.some(line => line.includes('<script>'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('DROP TABLE'))).toBe(true);
    });

    it('should handle null, undefined, and empty values in all optional fields', async () => {
      const sparseData: Partial<ApprovalRequiredEventData> = {
        approvalId: baseEventData.approvalId,
        taskId: baseEventData.taskId,
        gateName: baseEventData.gateName,
        gateType: baseEventData.gateType,
        timestamp: baseEventData.timestamp,
        description: null as any,
        stage: undefined,
        agent: '',
        affectedFiles: null as any,
        changesSummary: undefined,
        context: null as any,
        timeoutMinutes: undefined,
        expiresAt: null as any,
        minApprovals: undefined,
        approvers: null as any,
        blocking: undefined
      };

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: sparseData as ApprovalRequiredEventData,
        onSelection: mockOnSelection
      });

      // Should handle nulls/undefineds gracefully
      expect(mockOnSelection).toHaveBeenCalled();
      // Optional fields should not appear in output
      expect(consoleOutput.some(line => line.includes('Stage:'))).toBe(false);
      expect(consoleOutput.some(line => line.includes('Agent:'))).toBe(false);
      expect(consoleOutput.some(line => line.includes('📁 Affected Files:'))).toBe(false);
    });

    it('should handle circular references in context objects', async () => {
      const circularContext: any = { key: 'value' };
      circularContext.self = circularContext; // Create circular reference

      const edgeEventData = {
        ...baseEventData,
        context: circularContext
      };

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      // Should not crash with circular references
      await expect(showApprovalPrompt({
        eventData: edgeEventData,
        onSelection: mockOnSelection
      })).resolves.not.toThrow();

      expect(mockOnSelection).toHaveBeenCalled();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle extremely large file lists efficiently', async () => {
      const largeFileList = Array.from({ length: 100000 }, (_, i) =>
        `path/to/very/long/file/name/with/lots/of/subdirectories/file-${i}.ts`
      );

      const edgeEventData = {
        ...baseEventData,
        affectedFiles: largeFileList
      };

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      const startTime = Date.now();
      await showApprovalPrompt({
        eventData: edgeEventData,
        onSelection: mockOnSelection
      });
      const endTime = Date.now();

      // Should complete within reasonable time (under 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      // Should show truncation message
      expect(consoleOutput.some(line => line.includes('... and 99995 more files'))).toBe(true);
      expect(mockOnSelection).toHaveBeenCalled();
    });

    it('should handle massive context objects without memory issues', async () => {
      const massiveContext: Record<string, any> = {};
      for (let i = 0; i < 10000; i++) {
        massiveContext[`key-${i}`] = `value-${i}-`.repeat(100); // Large string values
      }

      const edgeEventData = {
        ...baseEventData,
        context: massiveContext
      };

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      const startMemory = process.memoryUsage().heapUsed;
      await showApprovalPrompt({
        eventData: edgeEventData,
        onSelection: mockOnSelection
      });
      const endMemory = process.memoryUsage().heapUsed;

      // Should not cause excessive memory growth (less than 100MB increase)
      expect(endMemory - startMemory).toBeLessThan(100 * 1024 * 1024);
      expect(mockOnSelection).toHaveBeenCalled();
    });
  });

  describe('Timing and Concurrency Edge Cases', () => {
    it('should handle rapid consecutive approval calls', async () => {
      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      // Create multiple rapid calls
      const promises = Array.from({ length: 100 }, (_, i) =>
        showApprovalPrompt({
          eventData: {
            ...baseEventData,
            approvalId: `rapid-${i}`,
            gateName: `gate-${i}`
          },
          onSelection: mockOnSelection
        })
      );

      // All should complete without race conditions
      await Promise.all(promises);

      expect(mockOnSelection).toHaveBeenCalledTimes(100);
      expect(mockInquirer.default.prompt).toHaveBeenCalledTimes(100);
    });

    it('should handle extremely fast responses', async () => {
      const mockOnSelection = vi.fn().mockResolvedValue(undefined);

      // Mock immediate response
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      const startTime = Date.now();
      await showApprovalPrompt({
        eventData: baseEventData,
        onSelection: mockOnSelection
      });
      const endTime = Date.now();

      const response = mockOnSelection.mock.calls[0][0];

      // Response time should be very small but positive
      expect(response.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(response.responseTimeMs).toBeLessThan(1000);
      expect(endTime - startTime).toBeLessThan(100); // Very fast completion
    });

    it('should handle date edge cases and timezone issues', async () => {
      // Test with various edge case dates
      const edgeDates = [
        new Date(0), // Unix epoch
        new Date('1970-01-01T00:00:00.000Z'), // Explicit epoch
        new Date('2038-01-19T03:14:07.000Z'), // Y2038 problem
        new Date('9999-12-31T23:59:59.999Z'), // Far future
        new Date(Date.now() + 86400000), // Tomorrow
        new Date(Date.now() - 86400000 * 365 * 10) // 10 years ago
      ];

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      for (const edgeDate of edgeDates) {
        const eventData = {
          ...baseEventData,
          timestamp: edgeDate,
          expiresAt: new Date(edgeDate.getTime() + 3600000) // 1 hour later
        };

        await showApprovalPrompt({
          eventData,
          onSelection: mockOnSelection
        });

        const response = mockOnSelection.mock.calls[mockOnSelection.mock.calls.length - 1][0];
        expect(response.requestedAt).toBe(edgeDate);
        expect(response.timestamp).toBeInstanceOf(Date);
      }
    });
  });

  describe('Inquirer and User Input Edge Cases', () => {
    it('should handle inquirer prompt cancellation (SIGINT)', async () => {
      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      const sigintError = new Error('User canceled');
      sigintError.name = 'ExitPromptError';

      mockInquirer.default.prompt.mockRejectedValue(sigintError);

      await expect(showApprovalPrompt({
        eventData: baseEventData,
        onSelection: mockOnSelection
      })).rejects.toThrow('User canceled');

      expect(mockOnSelection).not.toHaveBeenCalled();
    });

    it('should handle inquirer internal errors', async () => {
      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      const inquirerError = new Error('Terminal not compatible');

      mockInquirer.default.prompt.mockRejectedValue(inquirerError);

      await expect(showApprovalPrompt({
        eventData: baseEventData,
        onSelection: mockOnSelection
      })).rejects.toThrow('Terminal not compatible');
    });

    it('should handle malformed inquirer responses', async () => {
      const mockOnSelection = vi.fn().mockResolvedValue(undefined);

      // Mock malformed response
      mockInquirer.default.prompt.mockResolvedValue({
        // Missing 'decision' field
        wrongField: 'some value'
      });

      await expect(showApprovalPrompt({
        eventData: baseEventData,
        onSelection: mockOnSelection
      })).rejects.toThrow();
    });

    it('should handle validation errors in sub-prompts', async () => {
      const mockOnSelection = vi.fn().mockResolvedValue(undefined);

      // First prompt succeeds, second fails
      mockInquirer.default.prompt
        .mockResolvedValueOnce({ decision: 'info' })
        .mockRejectedValueOnce(new Error('Validation failed'));

      await expect(showApprovalPrompt({
        eventData: baseEventData,
        onSelection: mockOnSelection
      })).rejects.toThrow('Validation failed');
    });
  });

  describe('Callback and Async Edge Cases', () => {
    it('should handle onSelection callback that throws synchronously', async () => {
      const syncError = new Error('Synchronous callback error');
      const failingCallback = vi.fn().mockImplementation(() => {
        throw syncError;
      });

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await expect(showApprovalPrompt({
        eventData: baseEventData,
        onSelection: failingCallback
      })).rejects.toThrow('Synchronous callback error');
    });

    it('should handle onSelection callback that rejects asynchronously', async () => {
      const asyncError = new Error('Asynchronous callback error');
      const failingCallback = vi.fn().mockRejectedValue(asyncError);

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await expect(showApprovalPrompt({
        eventData: baseEventData,
        onSelection: failingCallback
      })).rejects.toThrow('Asynchronous callback error');
    });

    it('should handle onSelection callback that never resolves', async () => {
      const hangingCallback = vi.fn().mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      // Set a timeout for this test
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), 1000);
      });

      const approvalPromise = showApprovalPrompt({
        eventData: baseEventData,
        onSelection: hangingCallback
      });

      // Should timeout rather than hang
      await expect(Promise.race([approvalPromise, timeoutPromise]))
        .rejects.toThrow('Test timeout');
    });

    it('should handle multiple rapid callback executions', async () => {
      let callbackCount = 0;
      const multiCallback = vi.fn().mockImplementation(async () => {
        callbackCount++;
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 10));
        return callbackCount;
      });

      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: baseEventData,
        onSelection: multiCallback
      });

      expect(multiCallback).toHaveBeenCalledTimes(1);
      expect(callbackCount).toBe(1);
    });
  });

  describe('promptForAdditionalInfo Edge Cases', () => {
    it('should handle extremely long info request messages', async () => {
      const longMessage = 'Please provide detailed information about '.repeat(1000);
      const longResponse = 'Here is the detailed response '.repeat(1000);

      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo: longResponse });

      const result = await promptForAdditionalInfo(baseEventData, longMessage);

      expect(result).toBe(longResponse);
      expect(consoleOutput.some(line => line.includes(longMessage.substring(0, 100)))).toBe(true);
    });

    it('should handle special characters in info requests and responses', async () => {
      const specialMessage = 'Info needed: 🔍 search for → patterns with "quotes" and \\backslashes\\';
      const specialResponse = 'Response includes: ✅ results → findings with "data" and \\paths\\';

      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo: specialResponse });

      const result = await promptForAdditionalInfo(baseEventData, specialMessage);

      expect(result).toBe(specialResponse);
      expect(consoleOutput.some(line => line.includes('🔍 search for →'))).toBe(true);
    });

    it('should handle inquirer failure in additional info prompt', async () => {
      const infoError = new Error('Additional info prompt failed');

      mockInquirer.default.prompt.mockRejectedValue(infoError);

      await expect(promptForAdditionalInfo(baseEventData, 'Test request'))
        .rejects.toThrow('Additional info prompt failed');
    });

    it('should handle validation edge cases in additional info', async () => {
      mockInquirer.default.prompt.mockResolvedValue({ additionalInfo: 'Valid response' });

      await promptForAdditionalInfo(baseEventData, 'Test request');

      const promptConfig = mockInquirer.default.prompt.mock.calls[0][0][0];
      const validateFunction = promptConfig.validate;

      // Test edge cases for validation
      expect(validateFunction('')).toBe('Please provide the requested information');
      expect(validateFunction('   \\t\\n   ')).toBe('Please provide the requested information');
      expect(validateFunction('\\x00')).toBe(true); // Null bytes are still considered valid
      expect(validateFunction('a')).toBe(true); // Single character is valid
      expect(validateFunction('a'.repeat(10000))).toBe(true); // Very long input is valid
    });
  });

  describe('System Resource Edge Cases', () => {
    it('should handle system with low memory gracefully', async () => {
      // Simulate low memory by creating a large object first
      const memoryEater = new Array(1000000).fill('memory consuming string');

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      await showApprovalPrompt({
        eventData: baseEventData,
        onSelection: mockOnSelection
      });

      // Should complete even with memory pressure
      expect(mockOnSelection).toHaveBeenCalled();

      // Clean up
      memoryEater.length = 0;
    });

    it('should handle process termination signals gracefully', async () => {
      const mockOnSelection = vi.fn().mockResolvedValue(undefined);

      // Mock process termination during prompt
      mockInquirer.default.prompt.mockImplementation(async () => {
        // Simulate SIGTERM
        const error = new Error('Process terminated');
        error.name = 'SIGTERM';
        throw error;
      });

      await expect(showApprovalPrompt({
        eventData: baseEventData,
        onSelection: mockOnSelection
      })).rejects.toThrow('Process terminated');
    });
  });

  describe('Type Safety and Interface Edge Cases', () => {
    it('should handle missing required fields gracefully', async () => {
      const incompleteData = {
        approvalId: baseEventData.approvalId,
        taskId: baseEventData.taskId,
        // Missing gateName, gateType, timestamp
      } as any;

      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      // Should handle missing fields without crashing
      await showApprovalPrompt({
        eventData: incompleteData,
        onSelection: mockOnSelection
      });

      expect(mockOnSelection).toHaveBeenCalled();
      const response = mockOnSelection.mock.calls[0][0];
      expect(response.requestId).toBe(incompleteData.approvalId);
      expect(response.taskId).toBe(incompleteData.taskId);
    });

    it('should handle type coercion in response fields', async () => {
      const mockOnSelection = vi.fn().mockResolvedValue(undefined);
      mockInquirer.default.prompt.mockResolvedValue({ decision: 'approve' });

      // Use data with mixed types
      const mixedTypeData = {
        ...baseEventData,
        timeoutMinutes: '30' as any, // String instead of number
        minApprovals: '1' as any, // String instead of number
        blocking: 'true' as any // String instead of boolean
      };

      await showApprovalPrompt({
        eventData: mixedTypeData,
        onSelection: mockOnSelection
      });

      const response = mockOnSelection.mock.calls[0][0];
      expect(response.approvalsRequired).toBe('1'); // Should preserve the string value
    });
  });
});