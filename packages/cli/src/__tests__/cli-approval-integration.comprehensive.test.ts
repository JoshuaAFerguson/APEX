import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApprovalRequiredEventData, ApprovalResponse } from '@apexcli/core';

// Mock the approval prompt module
const mockShowApprovalPrompt = vi.fn();
const mockPromptForAdditionalInfo = vi.fn();

vi.mock('../utils/approval-prompt.js', () => ({
  showApprovalPrompt: mockShowApprovalPrompt,
  promptForAdditionalInfo: mockPromptForAdditionalInfo
}));

// Mock chalk for cleaner test output
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((text: string) => text),
    bold: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
    white: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
    magenta: vi.fn((text: string) => text)
  }
}));

// Mock console methods to capture output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleOutput: string[] = [];
let consoleErrors: string[] = [];

// Mock orchestrator class with comprehensive event handling
class MockApexOrchestrator extends EventEmitter {
  public respondToApproval = vi.fn();
  public addMessage = vi.fn();
  public getTask = vi.fn();

  constructor() {
    super();
  }

  async simulateApprovalRequired(eventData: ApprovalRequiredEventData): Promise<void> {
    this.emit('approval:required', eventData);
  }

  async simulateInfoRequested(data: {
    approvalId: string;
    taskId: string;
    requester: string;
    message?: string;
    timestamp: Date;
  }): Promise<void> {
    this.emit('approval:info-requested', data);
  }

  async simulateTaskStageChanged(data: {
    taskId: string;
    stage: string;
    agent?: string;
  }): Promise<void> {
    this.emit('task:stage-changed', data);
  }
}

describe('CLI Approval Integration - Comprehensive Tests', () => {
  let mockOrchestrator: MockApexOrchestrator;
  let approvalHandler: (eventData: ApprovalRequiredEventData) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up console capture
    consoleOutput = [];
    consoleErrors = [];
    console.log = vi.fn((...args: unknown[]) => {
      consoleOutput.push(args.join(' '));
    });
    console.error = vi.fn((...args: unknown[]) => {
      consoleErrors.push(args.join(' '));
    });

    mockOrchestrator = new MockApexOrchestrator();

    // Create the approval handler that mimics the CLI implementation
    approvalHandler = async (eventData: ApprovalRequiredEventData) => {
      const targetTaskId = 'test-task-id'; // Simulated current task

      if (eventData.taskId === targetTaskId) {
        try {
          console.log(); // Add spacing

          await mockShowApprovalPrompt({
            eventData,
            onSelection: async (response: ApprovalResponse) => {
              try {
                await mockOrchestrator.respondToApproval(eventData.approvalId, response);

                // Handle info-requested follow-up
                if (response.response === 'info-requested') {
                  const handleInfoRequested = async (infoEvent: {
                    approvalId: string;
                    taskId: string;
                    requester: string;
                    message?: string;
                    timestamp: Date;
                  }) => {
                    if (infoEvent.approvalId === eventData.approvalId) {
                      try {
                        // Prompt for additional information
                        const additionalInfo = await mockPromptForAdditionalInfo(
                          eventData,
                          infoEvent.message || 'Additional information requested'
                        );

                        // Send the additional info back (this would be implemented in the orchestrator)
                        console.log(`Additional info provided: ${additionalInfo}`);
                      } catch (error) {
                        console.error(`Error handling info request: ${error}`);
                      } finally {
                        mockOrchestrator.off('approval:info-requested', handleInfoRequested);
                      }
                    }
                  };

                  mockOrchestrator.on('approval:info-requested', handleInfoRequested);
                }

                // Log the approval response
                const actionText = response.response === 'approved' ? 'approved' :
                                 response.response === 'denied' ? 'denied' :
                                 'requested more info for';
                console.log(`Approval ${actionText} for ${eventData.gateName}`);

              } catch (error) {
                console.error(`Error responding to approval: ${error}`);
              }
            }
          });
        } catch (error) {
          console.error(`Error handling approval request: ${error}`);
        }
      }
    };
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    mockOrchestrator.removeAllListeners();
  });

  describe('Event Handler Registration and Cleanup', () => {
    it('should register approval handler correctly', () => {
      mockOrchestrator.on('approval:required', approvalHandler);

      expect(mockOrchestrator.listenerCount('approval:required')).toBe(1);
    });

    it('should clean up event listeners properly', () => {
      mockOrchestrator.on('approval:required', approvalHandler);
      expect(mockOrchestrator.listenerCount('approval:required')).toBe(1);

      mockOrchestrator.off('approval:required', approvalHandler);
      expect(mockOrchestrator.listenerCount('approval:required')).toBe(0);
    });

    it('should handle multiple event listener registrations', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      mockOrchestrator.on('approval:required', handler1);
      mockOrchestrator.on('approval:required', handler2);

      expect(mockOrchestrator.listenerCount('approval:required')).toBe(2);

      mockOrchestrator.off('approval:required', handler1);
      expect(mockOrchestrator.listenerCount('approval:required')).toBe(1);

      mockOrchestrator.off('approval:required', handler2);
      expect(mockOrchestrator.listenerCount('approval:required')).toBe(0);
    });
  });

  describe('Task ID Filtering', () => {
    it('should only process approvals for the current task', async () => {
      const currentTaskData: ApprovalRequiredEventData = {
        approvalId: 'approval-current-task',
        taskId: 'test-task-id', // Matches the target task ID
        gateName: 'current-task-gate',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const otherTaskData: ApprovalRequiredEventData = {
        approvalId: 'approval-other-task',
        taskId: 'other-task-id', // Different task ID
        gateName: 'other-task-gate',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      mockShowApprovalPrompt.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      // Process approval for current task
      await mockOrchestrator.simulateApprovalRequired(currentTaskData);
      expect(mockShowApprovalPrompt).toHaveBeenCalledTimes(1);

      // Reset and process approval for other task
      vi.clearAllMocks();
      await mockOrchestrator.simulateApprovalRequired(otherTaskData);
      expect(mockShowApprovalPrompt).not.toHaveBeenCalled();
    });

    it('should handle multiple tasks with same approval gate name', async () => {
      const task1Data: ApprovalRequiredEventData = {
        approvalId: 'approval-task1',
        taskId: 'test-task-id',
        gateName: 'file-modification',
        gateType: 'file-operation',
        timestamp: new Date()
      };

      const task2Data: ApprovalRequiredEventData = {
        approvalId: 'approval-task2',
        taskId: 'different-task-id',
        gateName: 'file-modification', // Same gate name
        gateType: 'file-operation',
        timestamp: new Date()
      };

      mockShowApprovalPrompt.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      // Only the first one should be processed (matching task ID)
      await Promise.all([
        mockOrchestrator.simulateApprovalRequired(task1Data),
        mockOrchestrator.simulateApprovalRequired(task2Data)
      ]);

      expect(mockShowApprovalPrompt).toHaveBeenCalledTimes(1);
      expect(mockShowApprovalPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          eventData: task1Data
        })
      );
    });
  });

  describe('Approval Response Handling', () => {
    it('should handle successful approval responses', async () => {
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'test-approval',
        taskId: 'test-task-id',
        gateName: 'test-gate',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const mockResponse: ApprovalResponse = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'approved',
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'approve',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: eventData.timestamp,
        responseTimeMs: 1000,
        resolved: true
      };

      // Mock the approval prompt to call onSelection with the response
      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      mockOrchestrator.respondToApproval.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      await mockOrchestrator.simulateApprovalRequired(eventData);

      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        eventData.approvalId,
        mockResponse
      );
      expect(consoleOutput.some(line => line.includes('Approval approved for test-gate'))).toBe(true);
    });

    it('should handle denial responses with reasons', async () => {
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'test-denial',
        taskId: 'test-task-id',
        gateName: 'critical-operation',
        gateType: 'manual-approval',
        timestamp: new Date()
      };

      const mockResponse: ApprovalResponse = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'denied',
        message: 'Security concerns detected',
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'deny',
        approver: 'cli-user',
        comment: 'Security concerns detected',
        timestamp: new Date(),
        requestedAt: eventData.timestamp,
        responseTimeMs: 2000,
        resolved: true
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      mockOrchestrator.respondToApproval.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      await mockOrchestrator.simulateApprovalRequired(eventData);

      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        eventData.approvalId,
        expect.objectContaining({
          response: 'denied',
          message: 'Security concerns detected'
        })
      );
      expect(consoleOutput.some(line => line.includes('Approval denied for critical-operation'))).toBe(true);
    });

    it('should handle info-requested responses and follow-up', async () => {
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'test-info-request',
        taskId: 'test-task-id',
        gateName: 'database-migration',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const mockResponse: ApprovalResponse = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'info-requested',
        message: 'Need rollback procedure details',
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'request-info',
        approver: 'cli-user',
        comment: 'Need rollback procedure details',
        timestamp: new Date(),
        requestedAt: eventData.timestamp,
        responseTimeMs: 3000,
        resolved: false
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      mockPromptForAdditionalInfo.mockResolvedValue('Detailed rollback procedure provided');
      mockOrchestrator.respondToApproval.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      // Simulate approval request
      await mockOrchestrator.simulateApprovalRequired(eventData);

      // Verify initial response was processed
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        eventData.approvalId,
        expect.objectContaining({
          response: 'info-requested'
        })
      );
      expect(consoleOutput.some(line => line.includes('Approval requested more info for database-migration'))).toBe(true);

      // Simulate the info-requested event
      await mockOrchestrator.simulateInfoRequested({
        approvalId: eventData.approvalId,
        taskId: eventData.taskId,
        requester: 'orchestrator',
        message: 'Please provide rollback details',
        timestamp: new Date()
      });

      // Verify additional info was requested
      expect(mockPromptForAdditionalInfo).toHaveBeenCalledWith(
        eventData,
        'Please provide rollback details'
      );
      expect(consoleOutput.some(line => line.includes('Additional info provided: Detailed rollback procedure provided'))).toBe(true);
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle respondToApproval errors gracefully', async () => {
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'test-error-response',
        taskId: 'test-task-id',
        gateName: 'error-prone-operation',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const mockResponse: ApprovalResponse = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'approved',
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'approve',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: eventData.timestamp,
        responseTimeMs: 1000,
        resolved: true
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      const responseError = new Error('Network connection failed');
      mockOrchestrator.respondToApproval.mockRejectedValue(responseError);
      mockOrchestrator.on('approval:required', approvalHandler);

      await mockOrchestrator.simulateApprovalRequired(eventData);

      expect(consoleErrors.some(error => error.includes('Error responding to approval: Error: Network connection failed'))).toBe(true);
    });

    it('should handle showApprovalPrompt errors gracefully', async () => {
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'test-prompt-error',
        taskId: 'test-task-id',
        gateName: 'prompt-error-operation',
        gateType: 'manual-approval',
        timestamp: new Date()
      };

      const promptError = new Error('UI prompt failed to display');
      mockShowApprovalPrompt.mockRejectedValue(promptError);
      mockOrchestrator.on('approval:required', approvalHandler);

      await mockOrchestrator.simulateApprovalRequired(eventData);

      expect(consoleErrors.some(error => error.includes('Error handling approval request: Error: UI prompt failed to display'))).toBe(true);
      expect(mockOrchestrator.respondToApproval).not.toHaveBeenCalled();
    });

    it('should handle promptForAdditionalInfo errors', async () => {
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'test-info-error',
        taskId: 'test-task-id',
        gateName: 'info-error-operation',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const mockResponse: ApprovalResponse = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'info-requested',
        message: 'Request for info',
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'request-info',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: eventData.timestamp,
        responseTimeMs: 1000,
        resolved: false
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      const infoError = new Error('Failed to get additional information');
      mockPromptForAdditionalInfo.mockRejectedValue(infoError);
      mockOrchestrator.respondToApproval.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      // Simulate approval request
      await mockOrchestrator.simulateApprovalRequired(eventData);

      // Simulate info-requested event
      await mockOrchestrator.simulateInfoRequested({
        approvalId: eventData.approvalId,
        taskId: eventData.taskId,
        requester: 'orchestrator',
        message: 'Info request',
        timestamp: new Date()
      });

      expect(consoleErrors.some(error => error.includes('Error handling info request: Error: Failed to get additional information'))).toBe(true);
    });
  });

  describe('Event Listener Lifecycle Management', () => {
    it('should properly clean up info-requested listeners after use', async () => {
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'test-cleanup',
        taskId: 'test-task-id',
        gateName: 'cleanup-test',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const mockResponse: ApprovalResponse = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'info-requested',
        message: 'Test info request',
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'request-info',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: eventData.timestamp,
        responseTimeMs: 1000,
        resolved: false
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      mockPromptForAdditionalInfo.mockResolvedValue('Test additional info');
      mockOrchestrator.respondToApproval.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      // Initially no listeners for info-requested
      expect(mockOrchestrator.listenerCount('approval:info-requested')).toBe(0);

      // Process approval request (this should set up info-requested listener)
      await mockOrchestrator.simulateApprovalRequired(eventData);

      // Should now have a listener
      expect(mockOrchestrator.listenerCount('approval:info-requested')).toBe(1);

      // Process info request (this should clean up the listener)
      await mockOrchestrator.simulateInfoRequested({
        approvalId: eventData.approvalId,
        taskId: eventData.taskId,
        requester: 'orchestrator',
        message: 'Test message',
        timestamp: new Date()
      });

      // Listener should be cleaned up
      expect(mockOrchestrator.listenerCount('approval:info-requested')).toBe(0);
    });

    it('should only respond to info-requested events with matching approval ID', async () => {
      const eventData1: ApprovalRequiredEventData = {
        approvalId: 'approval-1',
        taskId: 'test-task-id',
        gateName: 'operation-1',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const eventData2: ApprovalRequiredEventData = {
        approvalId: 'approval-2',
        taskId: 'test-task-id',
        gateName: 'operation-2',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const mockResponse: ApprovalResponse = {
        requestId: 'approval-1',
        taskId: 'test-task-id',
        response: 'info-requested',
        message: 'Test request',
        approvalId: 'approval-1',
        gateName: 'operation-1',
        action: 'request-info',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: eventData1.timestamp,
        responseTimeMs: 1000,
        resolved: false
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      mockPromptForAdditionalInfo.mockResolvedValue('Test info');
      mockOrchestrator.respondToApproval.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      // Process first approval request
      await mockOrchestrator.simulateApprovalRequired(eventData1);

      // Send info-requested for different approval ID (should be ignored)
      await mockOrchestrator.simulateInfoRequested({
        approvalId: 'approval-2', // Different ID
        taskId: 'test-task-id',
        requester: 'orchestrator',
        message: 'Different approval info request',
        timestamp: new Date()
      });

      expect(mockPromptForAdditionalInfo).not.toHaveBeenCalled();

      // Send info-requested for correct approval ID
      await mockOrchestrator.simulateInfoRequested({
        approvalId: 'approval-1', // Matching ID
        taskId: 'test-task-id',
        requester: 'orchestrator',
        message: 'Correct approval info request',
        timestamp: new Date()
      });

      expect(mockPromptForAdditionalInfo).toHaveBeenCalledWith(
        eventData1,
        'Correct approval info request'
      );
    });
  });

  describe('Concurrent Approval Handling', () => {
    it('should handle multiple concurrent approval requests', async () => {
      const approvalEvents: ApprovalRequiredEventData[] = [
        {
          approvalId: 'concurrent-1',
          taskId: 'test-task-id',
          gateName: 'operation-1',
          gateType: 'file-operation',
          timestamp: new Date()
        },
        {
          approvalId: 'concurrent-2',
          taskId: 'test-task-id',
          gateName: 'operation-2',
          gateType: 'manual-approval',
          timestamp: new Date()
        },
        {
          approvalId: 'concurrent-3',
          taskId: 'test-task-id',
          gateName: 'operation-3',
          gateType: 'pre-action',
          timestamp: new Date()
        }
      ];

      const mockResponses: ApprovalResponse[] = approvalEvents.map((event, index) => ({
        requestId: event.approvalId,
        taskId: event.taskId,
        response: 'approved',
        approvalId: event.approvalId,
        gateName: event.gateName,
        action: 'approve',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: event.timestamp,
        responseTimeMs: (index + 1) * 1000,
        resolved: true
      }));

      let callCount = 0;
      mockShowApprovalPrompt.mockImplementation(async ({ eventData, onSelection }) => {
        const response = mockResponses.find(r => r.approvalId === eventData.approvalId);
        if (response) {
          await onSelection(response);
        }
        callCount++;
      });

      mockOrchestrator.respondToApproval.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      // Process all approvals concurrently
      const promises = approvalEvents.map(event =>
        mockOrchestrator.simulateApprovalRequired(event)
      );

      await Promise.all(promises);

      expect(callCount).toBe(3);
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledTimes(3);

      // Verify each approval was processed
      approvalEvents.forEach((event, index) => {
        expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
          event.approvalId,
          expect.objectContaining({
            approvalId: event.approvalId,
            gateName: event.gateName
          })
        );
      });
    });
  });

  describe('Console Output Verification', () => {
    it('should log proper spacing and formatting', async () => {
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'format-test',
        taskId: 'test-task-id',
        gateName: 'format-gate',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        const response: ApprovalResponse = {
          requestId: eventData.approvalId,
          taskId: eventData.taskId,
          response: 'approved',
          approvalId: eventData.approvalId,
          gateName: eventData.gateName,
          action: 'approve',
          approver: 'cli-user',
          timestamp: new Date(),
          requestedAt: eventData.timestamp,
          responseTimeMs: 1000,
          resolved: true
        };
        await onSelection(response);
      });

      mockOrchestrator.respondToApproval.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      await mockOrchestrator.simulateApprovalRequired(eventData);

      // Should include spacing line at the start
      expect(consoleOutput[0]).toBe('');
      // Should include the approval success message
      expect(consoleOutput.some(line => line.includes('Approval approved for format-gate'))).toBe(true);
    });

    it('should handle default message for info requests without message', async () => {
      const eventData: ApprovalRequiredEventData = {
        approvalId: 'default-message-test',
        taskId: 'test-task-id',
        gateName: 'default-gate',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const mockResponse: ApprovalResponse = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'info-requested',
        message: 'Test request',
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'request-info',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: eventData.timestamp,
        responseTimeMs: 1000,
        resolved: false
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      mockPromptForAdditionalInfo.mockResolvedValue('Default response');
      mockOrchestrator.respondToApproval.mockResolvedValue(undefined);
      mockOrchestrator.on('approval:required', approvalHandler);

      await mockOrchestrator.simulateApprovalRequired(eventData);

      // Simulate info request without message
      await mockOrchestrator.simulateInfoRequested({
        approvalId: eventData.approvalId,
        taskId: eventData.taskId,
        requester: 'orchestrator',
        // message is undefined
        timestamp: new Date()
      });

      expect(mockPromptForAdditionalInfo).toHaveBeenCalledWith(
        eventData,
        'Additional information requested' // Default message
      );
    });
  });
});