import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApprovalRequiredEventData, ApprovalResponse } from '@apexcli/core';
import { showApprovalPrompt } from '../utils/approval-prompt.js';

// Mock the approval prompt module
vi.mock('../utils/approval-prompt.js', () => ({
  showApprovalPrompt: vi.fn(),
  promptForAdditionalInfo: vi.fn()
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock chalk
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

// Mock orchestrator with event emission capabilities
class MockOrchestrator extends EventEmitter {
  public respondToApproval = vi.fn();
  public addMessage = vi.fn();

  constructor() {
    super();
  }

  async simulateApprovalRequired(eventData: ApprovalRequiredEventData): Promise<void> {
    this.emit('approval:required', eventData);
  }

  async simulateInfoRequested(data: { requestId: string; message: string }): Promise<void> {
    this.emit('info:requested', data);
  }
}

// Mock app interface
interface MockApp {
  addMessage: ReturnType<typeof vi.fn>;
  updateState: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
}

describe('Approval Integration Tests', () => {
  let mockOrchestrator: MockOrchestrator;
  let mockApp: MockApp;
  let mockShowApprovalPrompt: ReturnType<typeof vi.mocked>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOrchestrator = new MockOrchestrator();
    mockApp = {
      addMessage: vi.fn(),
      updateState: vi.fn(),
      getState: vi.fn().mockReturnValue({})
    };

    mockShowApprovalPrompt = vi.mocked(showApprovalPrompt);
  });

  afterEach(() => {
    mockOrchestrator.removeAllListeners();
  });

  describe('Event Handler Integration', () => {
    it('should properly handle approval:required events from orchestrator', async () => {
      const testEventData: ApprovalRequiredEventData = {
        approvalId: 'test-approval-123',
        taskId: 'test-task-456',
        gateName: 'file-modification',
        gateType: 'file-operation',
        description: 'Modify configuration files',
        timestamp: new Date(),
        stage: 'implementation',
        agent: 'developer'
      };

      let capturedCallback: ((response: ApprovalResponse) => Promise<void>) | undefined;

      // Mock showApprovalPrompt to capture the callback
      mockShowApprovalPrompt.mockImplementation(async (options) => {
        capturedCallback = options.onSelection;
        // Simulate user approval
        const mockResponse: ApprovalResponse = {
          requestId: testEventData.approvalId,
          taskId: testEventData.taskId,
          response: 'approved',
          approvalId: testEventData.approvalId,
          gateName: testEventData.gateName,
          action: 'approve',
          approver: 'cli-user',
          timestamp: new Date(),
          requestedAt: testEventData.timestamp,
          responseTimeMs: 1000,
          resolved: true
        };
        await capturedCallback!(mockResponse);
      });

      // Set up the event listener (simulating the repl.tsx logic)
      const handleApprovalRequired = async (eventData: ApprovalRequiredEventData) => {
        try {
          mockApp.addMessage({
            type: 'system',
            content: `⚠️ Approval required for ${eventData.gateName} (Task: ${eventData.taskId.slice(0, 12)}...)`
          });

          await showApprovalPrompt({
            eventData,
            onSelection: async (response) => {
              try {
                await mockOrchestrator.respondToApproval(eventData.approvalId, response);

                const actionText = response.response === 'approved' ? 'approved' :
                                 response.response === 'denied' ? 'denied' :
                                 'requested more info for';
                mockApp.addMessage({
                  type: 'system',
                  content: `✅ Approval ${actionText} for ${eventData.gateName}`
                });
              } catch (error) {
                mockApp.addMessage({
                  type: 'error',
                  content: `❌ Error responding to approval: ${error instanceof Error ? error.message : String(error)}`
                });
              }
            }
          });
        } catch (error) {
          mockApp.addMessage({
            type: 'error',
            content: `❌ Error handling approval prompt: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      };

      // Register the event listener
      mockOrchestrator.on('approval:required', handleApprovalRequired);

      // Simulate the approval event
      await mockOrchestrator.simulateApprovalRequired(testEventData);

      // Verify the flow
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Approval required for file-modification')
      });

      expect(mockShowApprovalPrompt).toHaveBeenCalledWith({
        eventData: testEventData,
        onSelection: expect.any(Function)
      });

      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        testEventData.approvalId,
        expect.objectContaining({
          response: 'approved',
          taskId: testEventData.taskId
        })
      );

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Approval approved for file-modification')
      });
    });

    it('should handle approval denial correctly', async () => {
      const testEventData: ApprovalRequiredEventData = {
        approvalId: 'test-approval-denial',
        taskId: 'test-task-denial',
        gateName: 'critical-operation',
        gateType: 'manual-approval',
        description: 'Critical system change',
        timestamp: new Date()
      };

      // Mock denial response
      mockShowApprovalPrompt.mockImplementation(async (options) => {
        const mockResponse: ApprovalResponse = {
          requestId: testEventData.approvalId,
          taskId: testEventData.taskId,
          response: 'denied',
          message: 'Security concerns',
          approvalId: testEventData.approvalId,
          gateName: testEventData.gateName,
          action: 'deny',
          approver: 'cli-user',
          comment: 'Security concerns',
          timestamp: new Date(),
          requestedAt: testEventData.timestamp,
          responseTimeMs: 2000,
          resolved: true
        };
        await options.onSelection(mockResponse);
      });

      const handleApprovalRequired = async (eventData: ApprovalRequiredEventData) => {
        await showApprovalPrompt({
          eventData,
          onSelection: async (response) => {
            await mockOrchestrator.respondToApproval(eventData.approvalId, response);

            const actionText = response.response === 'approved' ? 'approved' :
                             response.response === 'denied' ? 'denied' :
                             'requested more info for';
            mockApp.addMessage({
              type: 'system',
              content: `✅ Approval ${actionText} for ${eventData.gateName}`
            });
          }
        });
      };

      mockOrchestrator.on('approval:required', handleApprovalRequired);
      await mockOrchestrator.simulateApprovalRequired(testEventData);

      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        testEventData.approvalId,
        expect.objectContaining({
          response: 'denied',
          message: 'Security concerns'
        })
      );

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Approval denied for critical-operation')
      });
    });

    it('should handle info-requested flow with follow-up', async () => {
      const testEventData: ApprovalRequiredEventData = {
        approvalId: 'test-approval-info',
        taskId: 'test-task-info',
        gateName: 'database-operation',
        gateType: 'pre-action',
        description: 'Database migration',
        timestamp: new Date()
      };

      // Mock info request response
      mockShowApprovalPrompt.mockImplementation(async (options) => {
        const mockResponse: ApprovalResponse = {
          requestId: testEventData.approvalId,
          taskId: testEventData.taskId,
          response: 'info-requested',
          message: 'Need more details about rollback plan',
          approvalId: testEventData.approvalId,
          gateName: testEventData.gateName,
          action: 'request-info',
          approver: 'cli-user',
          comment: 'Need more details about rollback plan',
          timestamp: new Date(),
          requestedAt: testEventData.timestamp,
          responseTimeMs: 3000,
          resolved: false
        };
        await options.onSelection(mockResponse);
      });

      // Track if info-requested event handler was set up
      let infoRequestedHandlerSetup = false;

      const handleApprovalRequired = async (eventData: ApprovalRequiredEventData) => {
        await showApprovalPrompt({
          eventData,
          onSelection: async (response) => {
            await mockOrchestrator.respondToApproval(eventData.approvalId, response);

            if (response.response === 'info-requested') {
              const handleInfoRequested = async (infoData: any) => {
                if (infoData.requestId === eventData.approvalId) {
                  mockApp.addMessage({
                    type: 'system',
                    content: '📝 Additional information provided'
                  });
                  mockOrchestrator.off('info:requested', handleInfoRequested);
                }
              };

              mockOrchestrator.on('info:requested', handleInfoRequested);
              infoRequestedHandlerSetup = true;
            }

            const actionText = response.response === 'approved' ? 'approved' :
                             response.response === 'denied' ? 'denied' :
                             'requested more info for';
            mockApp.addMessage({
              type: 'system',
              content: `✅ Approval ${actionText} for ${eventData.gateName}`
            });
          }
        });
      };

      mockOrchestrator.on('approval:required', handleApprovalRequired);
      await mockOrchestrator.simulateApprovalRequired(testEventData);

      expect(infoRequestedHandlerSetup).toBe(true);
      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: expect.stringContaining('Approval requested more info for database-operation')
      });

      // Simulate info requested response
      await mockOrchestrator.simulateInfoRequested({
        requestId: testEventData.approvalId,
        message: 'Additional details provided'
      });

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: '📝 Additional information provided'
      });
    });

    it('should handle orchestrator.respondToApproval errors gracefully', async () => {
      const testEventData: ApprovalRequiredEventData = {
        approvalId: 'test-approval-error',
        taskId: 'test-task-error',
        gateName: 'error-prone-operation',
        gateType: 'file-operation',
        timestamp: new Date()
      };

      // Make respondToApproval throw an error
      mockOrchestrator.respondToApproval.mockRejectedValue(new Error('Network error'));

      mockShowApprovalPrompt.mockImplementation(async (options) => {
        const mockResponse: ApprovalResponse = {
          requestId: testEventData.approvalId,
          taskId: testEventData.taskId,
          response: 'approved',
          approvalId: testEventData.approvalId,
          gateName: testEventData.gateName,
          action: 'approve',
          approver: 'cli-user',
          timestamp: new Date(),
          requestedAt: testEventData.timestamp,
          responseTimeMs: 1000,
          resolved: true
        };
        await options.onSelection(mockResponse);
      });

      const handleApprovalRequired = async (eventData: ApprovalRequiredEventData) => {
        await showApprovalPrompt({
          eventData,
          onSelection: async (response) => {
            try {
              await mockOrchestrator.respondToApproval(eventData.approvalId, response);
            } catch (responseError) {
              mockApp.addMessage({
                type: 'error',
                content: `❌ Error responding to approval: ${responseError instanceof Error ? responseError.message : String(responseError)}`
              });
            }
          }
        });
      };

      mockOrchestrator.on('approval:required', handleApprovalRequired);
      await mockOrchestrator.simulateApprovalRequired(testEventData);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: '❌ Error responding to approval: Network error'
      });
    });

    it('should handle showApprovalPrompt errors gracefully', async () => {
      const testEventData: ApprovalRequiredEventData = {
        approvalId: 'test-approval-prompt-error',
        taskId: 'test-task-prompt-error',
        gateName: 'prompt-error-operation',
        gateType: 'manual-approval',
        timestamp: new Date()
      };

      // Make showApprovalPrompt throw an error
      mockShowApprovalPrompt.mockRejectedValue(new Error('Prompt display error'));

      const handleApprovalRequired = async (eventData: ApprovalRequiredEventData) => {
        try {
          await showApprovalPrompt({
            eventData,
            onSelection: async (response) => {
              await mockOrchestrator.respondToApproval(eventData.approvalId, response);
            }
          });
        } catch (approvalError) {
          mockApp.addMessage({
            type: 'error',
            content: `❌ Error handling approval prompt: ${approvalError instanceof Error ? approvalError.message : String(approvalError)}`
          });
        }
      };

      mockOrchestrator.on('approval:required', handleApprovalRequired);
      await mockOrchestrator.simulateApprovalRequired(testEventData);

      expect(mockApp.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: '❌ Error handling approval prompt: Prompt display error'
      });
    });
  });

  describe('Event Listener Lifecycle', () => {
    it('should properly set up and tear down event listeners', async () => {
      const testEventData: ApprovalRequiredEventData = {
        approvalId: 'lifecycle-test',
        taskId: 'lifecycle-task',
        gateName: 'lifecycle-operation',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      let handlerCallCount = 0;
      const handleApprovalRequired = async () => {
        handlerCallCount++;
      };

      // Register listener
      mockOrchestrator.on('approval:required', handleApprovalRequired);
      expect(mockOrchestrator.listenerCount('approval:required')).toBe(1);

      // Trigger event
      await mockOrchestrator.simulateApprovalRequired(testEventData);
      expect(handlerCallCount).toBe(1);

      // Remove listener
      mockOrchestrator.off('approval:required', handleApprovalRequired);
      expect(mockOrchestrator.listenerCount('approval:required')).toBe(0);

      // Trigger event again - should not call handler
      await mockOrchestrator.simulateApprovalRequired(testEventData);
      expect(handlerCallCount).toBe(1); // Should still be 1
    });

    it('should handle multiple simultaneous approval requests', async () => {
      const eventData1: ApprovalRequiredEventData = {
        approvalId: 'approval-1',
        taskId: 'task-1',
        gateName: 'operation-1',
        gateType: 'file-operation',
        timestamp: new Date()
      };

      const eventData2: ApprovalRequiredEventData = {
        approvalId: 'approval-2',
        taskId: 'task-2',
        gateName: 'operation-2',
        gateType: 'manual-approval',
        timestamp: new Date()
      };

      let handlerCallCount = 0;
      const approvalPromises: Promise<void>[] = [];

      mockShowApprovalPrompt.mockImplementation(async (options) => {
        // Simulate user interaction delay
        await new Promise(resolve => setTimeout(resolve, 10));

        const mockResponse: ApprovalResponse = {
          requestId: options.eventData.approvalId,
          taskId: options.eventData.taskId,
          response: 'approved',
          approvalId: options.eventData.approvalId,
          gateName: options.eventData.gateName,
          action: 'approve',
          approver: 'cli-user',
          timestamp: new Date(),
          requestedAt: options.eventData.timestamp,
          responseTimeMs: 1000,
          resolved: true
        };

        await options.onSelection(mockResponse);
      });

      const handleApprovalRequired = async (eventData: ApprovalRequiredEventData) => {
        handlerCallCount++;
        await showApprovalPrompt({
          eventData,
          onSelection: async (response) => {
            await mockOrchestrator.respondToApproval(eventData.approvalId, response);
          }
        });
      };

      mockOrchestrator.on('approval:required', handleApprovalRequired);

      // Trigger multiple events concurrently
      approvalPromises.push(mockOrchestrator.simulateApprovalRequired(eventData1));
      approvalPromises.push(mockOrchestrator.simulateApprovalRequired(eventData2));

      await Promise.all(approvalPromises);

      expect(handlerCallCount).toBe(2);
      expect(mockShowApprovalPrompt).toHaveBeenCalledTimes(2);
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Flow Validation', () => {
    it('should preserve all event data through the approval flow', async () => {
      const complexEventData: ApprovalRequiredEventData = {
        approvalId: 'complex-approval-123',
        taskId: 'complex-task-456',
        gateName: 'complex-operation',
        gateType: 'file-operation',
        description: 'Complex multi-file operation',
        approvers: ['admin', 'lead-dev'],
        minApprovals: 2,
        timeoutMinutes: 15,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        stage: 'implementation',
        agent: 'developer',
        timestamp: new Date(),
        context: {
          operation: 'refactor',
          severity: 'medium',
          impact: 'high'
        },
        changesSummary: 'Refactor authentication system',
        affectedFiles: ['auth.ts', 'config.yaml', 'tests/auth.test.ts'],
        blocking: true,
        approvalUrl: 'http://localhost:3000/approve/complex-approval-123'
      };

      let capturedEventData: ApprovalRequiredEventData | undefined;
      let capturedResponse: ApprovalResponse | undefined;

      mockShowApprovalPrompt.mockImplementation(async (options) => {
        capturedEventData = options.eventData;

        const mockResponse: ApprovalResponse = {
          requestId: options.eventData.approvalId,
          taskId: options.eventData.taskId,
          response: 'approved',
          approvalId: options.eventData.approvalId,
          gateName: options.eventData.gateName,
          action: 'approve',
          approver: 'cli-user',
          timestamp: new Date(),
          requestedAt: options.eventData.timestamp,
          responseTimeMs: 1000,
          stage: options.eventData.stage,
          approvalsReceived: 1,
          approvalsRequired: options.eventData.minApprovals,
          resolved: true
        };

        await options.onSelection(mockResponse);
      });

      mockOrchestrator.respondToApproval.mockImplementation(async (approvalId, response) => {
        capturedResponse = response;
      });

      const handleApprovalRequired = async (eventData: ApprovalRequiredEventData) => {
        await showApprovalPrompt({
          eventData,
          onSelection: async (response) => {
            await mockOrchestrator.respondToApproval(eventData.approvalId, response);
          }
        });
      };

      mockOrchestrator.on('approval:required', handleApprovalRequired);
      await mockOrchestrator.simulateApprovalRequired(complexEventData);

      // Verify event data was preserved
      expect(capturedEventData).toEqual(complexEventData);

      // Verify response data contains correct references
      expect(capturedResponse).toBeDefined();
      expect(capturedResponse!.requestId).toBe(complexEventData.approvalId);
      expect(capturedResponse!.taskId).toBe(complexEventData.taskId);
      expect(capturedResponse!.gateName).toBe(complexEventData.gateName);
      expect(capturedResponse!.stage).toBe(complexEventData.stage);
      expect(capturedResponse!.approvalsRequired).toBe(complexEventData.minApprovals);
    });
  });
});