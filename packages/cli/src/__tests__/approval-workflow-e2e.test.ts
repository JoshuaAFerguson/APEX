import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type { ApprovalRequiredEventData, ApprovalResponse } from '@apexcli/core';

// Mock external dependencies
const mockShowApprovalPrompt = vi.fn();
const mockPromptForAdditionalInfo = vi.fn();
const mockInquirerPrompt = vi.fn();

vi.mock('../utils/approval-prompt.js', () => ({
  showApprovalPrompt: mockShowApprovalPrompt,
  promptForAdditionalInfo: mockPromptForAdditionalInfo
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: mockInquirerPrompt
  }
}));

vi.mock('chalk', () => ({
  default: {
    cyan: (text: string) => `[CYAN]${text}[/CYAN]`,
    bold: (text: string) => `[BOLD]${text}[/BOLD]`,
    gray: (text: string) => `[GRAY]${text}[/GRAY]`,
    white: (text: string) => `[WHITE]${text}[/WHITE]`,
    yellow: (text: string) => `[YELLOW]${text}[/YELLOW]`,
    green: (text: string) => `[GREEN]${text}[/GREEN]`,
    red: (text: string) => `[RED]${text}[/RED]`,
    magenta: (text: string) => `[MAGENTA]${text}[/MAGENTA]`
  }
}));

// Console capture
const originalConsole = { ...console };
let consoleOutput: string[] = [];
let consoleErrors: string[] = [];

// Complete orchestrator mock with full workflow simulation
class CompleteApprovalOrchestrator extends EventEmitter {
  public respondToApproval = vi.fn();
  public addMessage = vi.fn();
  public getTask = vi.fn();
  private approvals = new Map<string, { status: 'pending' | 'approved' | 'denied' | 'info-requested'; data: any }>();
  private tasks = new Map<string, { id: string; status: string; description: string }>();

  constructor() {
    super();
  }

  // Simulate complete approval workflow
  async simulateCompleteWorkflow(scenarios: {
    taskId: string;
    approvals: Array<{
      id: string;
      gateName: string;
      userResponse: 'approve' | 'deny' | 'info';
      denialReason?: string;
      infoRequest?: string;
      additionalInfo?: string;
      shouldFail?: boolean;
      failureType?: 'prompt' | 'response' | 'info';
    }>;
  }): Promise<void> {
    // Register task
    this.tasks.set(scenarios.taskId, {
      id: scenarios.taskId,
      status: 'running',
      description: 'Test workflow task'
    });

    for (const approval of scenarios.approvals) {
      const eventData: ApprovalRequiredEventData = {
        approvalId: approval.id,
        taskId: scenarios.taskId,
        gateName: approval.gateName,
        gateType: 'pre-action',
        description: `Approval for ${approval.gateName}`,
        timestamp: new Date(),
        stage: 'implementation',
        agent: 'developer',
        affectedFiles: [`${approval.gateName.replace('-', '_')}.ts`],
        changesSummary: `Changes for ${approval.gateName}`,
        context: {
          operation: approval.gateName,
          severity: 'medium'
        },
        timeoutMinutes: 30,
        blocking: true
      };

      // Emit approval required event
      this.emit('approval:required', eventData);

      // Wait a bit to simulate real-world timing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate the approval response based on scenario
      if (!approval.shouldFail || approval.failureType !== 'prompt') {
        if (approval.userResponse === 'info' && approval.infoRequest) {
          // Simulate info request follow-up
          this.emit('approval:info-requested', {
            approvalId: approval.id,
            taskId: scenarios.taskId,
            requester: 'orchestrator',
            message: approval.infoRequest,
            timestamp: new Date()
          });

          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
    }
  }

  // Simulate orchestrator approval response handling
  async simulateApprovalResponse(approvalId: string, response: ApprovalResponse): Promise<void> {
    if (this.approvals.has(approvalId)) {
      this.approvals.set(approvalId, { status: response.response as any, data: response });

      // Emit confirmation event
      this.emit('approval:processed', {
        approvalId,
        response: response.response,
        timestamp: new Date()
      });
    }
  }
}

describe('Approval Workflow End-to-End Tests', () => {
  let orchestrator: CompleteApprovalOrchestrator;
  let approvalHandler: (eventData: ApprovalRequiredEventData) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Console capture
    consoleOutput = [];
    consoleErrors = [];
    console.log = vi.fn((...args: any[]) => {
      consoleOutput.push(args.join(' '));
    });
    console.error = vi.fn((...args: any[]) => {
      consoleErrors.push(args.join(' '));
    });

    orchestrator = new CompleteApprovalOrchestrator();

    // Complete approval handler implementation
    approvalHandler = async (eventData: ApprovalRequiredEventData) => {
      const currentTaskId = 'e2e-test-task'; // Simulated current task

      if (eventData.taskId === currentTaskId) {
        try {
          console.log(); // Add spacing

          await mockShowApprovalPrompt({
            eventData,
            onSelection: async (response: ApprovalResponse) => {
              try {
                await orchestrator.respondToApproval(eventData.approvalId, response);

                // Handle info-requested follow-up
                if (response.response === 'info-requested') {
                  const handleInfoRequested = async (infoEvent: any) => {
                    if (infoEvent.approvalId === eventData.approvalId) {
                      try {
                        const additionalInfo = await mockPromptForAdditionalInfo(
                          eventData,
                          infoEvent.message || 'Additional information requested'
                        );

                        console.log(`ℹ️ Additional info provided: ${additionalInfo}`);

                        // Simulate sending info back to orchestrator
                        await orchestrator.simulateApprovalResponse(eventData.approvalId, {
                          ...response,
                          message: additionalInfo,
                          resolved: true // Now resolved with additional info
                        });
                      } catch (error) {
                        console.error(`❌ Error handling info request: ${error}`);
                      } finally {
                        orchestrator.off('approval:info-requested', handleInfoRequested);
                      }
                    }
                  };

                  orchestrator.on('approval:info-requested', handleInfoRequested);
                }

                // Log approval result
                const actionText = response.response === 'approved' ? 'approved' :
                                 response.response === 'denied' ? 'denied' :
                                 'requested more info for';
                console.log(`✅ Approval ${actionText} for ${eventData.gateName}`);

                // Simulate orchestrator processing
                await orchestrator.simulateApprovalResponse(eventData.approvalId, response);

              } catch (error) {
                console.error(`❌ Error responding to approval: ${error}`);
                throw error;
              }
            }
          });
        } catch (error) {
          console.error(`❌ Error handling approval request: ${error}`);
          throw error;
        }
      }
    };

    orchestrator.on('approval:required', approvalHandler);
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
    orchestrator.removeAllListeners();
  });

  describe('Complete Approval Workflows', () => {
    it('should handle simple approval workflow end-to-end', async () => {
      const mockResponse: ApprovalResponse = {
        requestId: 'simple-approval',
        taskId: 'e2e-test-task',
        response: 'approved',
        approvalId: 'simple-approval',
        gateName: 'file-modification',
        action: 'approve',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: new Date(),
        responseTimeMs: 1000,
        resolved: true
      };

      // Mock user approving the request
      mockShowApprovalPrompt.mockImplementation(async ({ eventData, onSelection }) => {
        expect(eventData.approvalId).toBe('simple-approval');
        expect(eventData.gateName).toBe('file-modification');
        await onSelection(mockResponse);
      });

      orchestrator.respondToApproval.mockResolvedValue(undefined);

      // Run the complete workflow
      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: [{
          id: 'simple-approval',
          gateName: 'file-modification',
          userResponse: 'approve'
        }]
      });

      // Verify the complete flow
      expect(mockShowApprovalPrompt).toHaveBeenCalledWith({
        eventData: expect.objectContaining({
          approvalId: 'simple-approval',
          gateName: 'file-modification'
        }),
        onSelection: expect.any(Function)
      });

      expect(orchestrator.respondToApproval).toHaveBeenCalledWith('simple-approval', mockResponse);
      expect(consoleOutput.some(line => line.includes('Approval approved for file-modification'))).toBe(true);
    });

    it('should handle denial workflow with reason', async () => {
      const denialReason = 'Changes introduce security vulnerabilities';
      const mockResponse: ApprovalResponse = {
        requestId: 'denial-test',
        taskId: 'e2e-test-task',
        response: 'denied',
        message: denialReason,
        approvalId: 'denial-test',
        gateName: 'critical-system-change',
        action: 'deny',
        approver: 'cli-user',
        comment: denialReason,
        timestamp: new Date(),
        requestedAt: new Date(),
        responseTimeMs: 2000,
        resolved: true
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      orchestrator.respondToApproval.mockResolvedValue(undefined);

      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: [{
          id: 'denial-test',
          gateName: 'critical-system-change',
          userResponse: 'deny',
          denialReason
        }]
      });

      expect(orchestrator.respondToApproval).toHaveBeenCalledWith(
        'denial-test',
        expect.objectContaining({
          response: 'denied',
          message: denialReason
        })
      );
      expect(consoleOutput.some(line => line.includes('Approval denied for critical-system-change'))).toBe(true);
    });

    it('should handle complete info-requested workflow', async () => {
      const infoRequest = 'Please provide detailed rollback procedure';
      const additionalInfo = 'Step 1: Backup current state\\nStep 2: Restore previous version\\nStep 3: Verify functionality';

      const initialResponse: ApprovalResponse = {
        requestId: 'info-test',
        taskId: 'e2e-test-task',
        response: 'info-requested',
        message: infoRequest,
        approvalId: 'info-test',
        gateName: 'database-migration',
        action: 'request-info',
        approver: 'cli-user',
        comment: infoRequest,
        timestamp: new Date(),
        requestedAt: new Date(),
        responseTimeMs: 1500,
        resolved: false
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(initialResponse);
      });

      mockPromptForAdditionalInfo.mockResolvedValue(additionalInfo);
      orchestrator.respondToApproval.mockResolvedValue(undefined);

      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: [{
          id: 'info-test',
          gateName: 'database-migration',
          userResponse: 'info',
          infoRequest,
          additionalInfo
        }]
      });

      // Verify initial info request
      expect(orchestrator.respondToApproval).toHaveBeenCalledWith(
        'info-test',
        expect.objectContaining({
          response: 'info-requested',
          message: infoRequest
        })
      );

      // Verify additional info prompt
      expect(mockPromptForAdditionalInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalId: 'info-test',
          gateName: 'database-migration'
        }),
        infoRequest
      );

      // Verify additional info was logged
      expect(consoleOutput.some(line => line.includes(`ℹ️ Additional info provided: ${additionalInfo}`))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Approval requested more info for database-migration'))).toBe(true);
    });

    it('should handle multiple sequential approvals', async () => {
      const approvals = [
        { id: 'seq-1', gate: 'code-review', action: 'approve' as const },
        { id: 'seq-2', gate: 'security-scan', action: 'approve' as const },
        { id: 'seq-3', gate: 'deployment-gate', action: 'deny' as const, reason: 'Deployment window closed' }
      ];

      let callIndex = 0;
      mockShowApprovalPrompt.mockImplementation(async ({ eventData, onSelection }) => {
        const approval = approvals[callIndex];
        const response: ApprovalResponse = {
          requestId: approval.id,
          taskId: 'e2e-test-task',
          response: approval.action === 'approve' ? 'approved' : 'denied',
          message: approval.reason,
          approvalId: approval.id,
          gateName: approval.gate,
          action: approval.action === 'approve' ? 'approve' : 'deny',
          approver: 'cli-user',
          comment: approval.reason,
          timestamp: new Date(),
          requestedAt: new Date(),
          responseTimeMs: 1000,
          resolved: true
        };

        await onSelection(response);
        callIndex++;
      });

      orchestrator.respondToApproval.mockResolvedValue(undefined);

      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: approvals.map(a => ({
          id: a.id,
          gateName: a.gate,
          userResponse: a.action,
          denialReason: a.reason
        }))
      });

      expect(mockShowApprovalPrompt).toHaveBeenCalledTimes(3);
      expect(orchestrator.respondToApproval).toHaveBeenCalledTimes(3);

      // Verify each approval was processed correctly
      expect(consoleOutput.some(line => line.includes('Approval approved for code-review'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Approval approved for security-scan'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Approval denied for deployment-gate'))).toBe(true);
    });

    it('should handle mixed approval types in sequence', async () => {
      const scenarios = [
        { id: 'mixed-1', gate: 'initial-review', type: 'approve' as const },
        { id: 'mixed-2', gate: 'security-check', type: 'info' as const, infoReq: 'Clarify authentication method' },
        { id: 'mixed-3', gate: 'final-approval', type: 'deny' as const, reason: 'Insufficient testing' }
      ];

      let scenarioIndex = 0;
      mockShowApprovalPrompt.mockImplementation(async ({ eventData, onSelection }) => {
        const scenario = scenarios[scenarioIndex];

        let response: ApprovalResponse;
        if (scenario.type === 'approve') {
          response = {
            requestId: scenario.id,
            taskId: 'e2e-test-task',
            response: 'approved',
            approvalId: scenario.id,
            gateName: scenario.gate,
            action: 'approve',
            approver: 'cli-user',
            timestamp: new Date(),
            requestedAt: new Date(),
            responseTimeMs: 1000,
            resolved: true
          };
        } else if (scenario.type === 'deny') {
          response = {
            requestId: scenario.id,
            taskId: 'e2e-test-task',
            response: 'denied',
            message: scenario.reason,
            approvalId: scenario.id,
            gateName: scenario.gate,
            action: 'deny',
            approver: 'cli-user',
            comment: scenario.reason,
            timestamp: new Date(),
            requestedAt: new Date(),
            responseTimeMs: 1000,
            resolved: true
          };
        } else { // info
          response = {
            requestId: scenario.id,
            taskId: 'e2e-test-task',
            response: 'info-requested',
            message: scenario.infoReq,
            approvalId: scenario.id,
            gateName: scenario.gate,
            action: 'request-info',
            approver: 'cli-user',
            comment: scenario.infoReq,
            timestamp: new Date(),
            requestedAt: new Date(),
            responseTimeMs: 1000,
            resolved: false
          };
        }

        await onSelection(response);
        scenarioIndex++;
      });

      mockPromptForAdditionalInfo.mockResolvedValue('OAuth 2.0 with PKCE flow');
      orchestrator.respondToApproval.mockResolvedValue(undefined);

      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: scenarios.map(s => ({
          id: s.id,
          gateName: s.gate,
          userResponse: s.type,
          infoRequest: s.infoReq,
          denialReason: s.reason,
          additionalInfo: s.type === 'info' ? 'OAuth 2.0 with PKCE flow' : undefined
        }))
      });

      // Verify all types were processed
      expect(consoleOutput.some(line => line.includes('Approval approved for initial-review'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Approval requested more info for security-check'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Approval denied for final-approval'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('ℹ️ Additional info provided: OAuth 2.0 with PKCE flow'))).toBe(true);
    });
  });

  describe('Error Scenarios End-to-End', () => {
    it('should handle approval prompt failures gracefully', async () => {
      const promptError = new Error('UI failed to display prompt');
      mockShowApprovalPrompt.mockRejectedValue(promptError);

      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: [{
          id: 'error-approval',
          gateName: 'error-gate',
          userResponse: 'approve',
          shouldFail: true,
          failureType: 'prompt'
        }]
      });

      expect(consoleErrors.some(error =>
        error.includes('Error handling approval request: Error: UI failed to display prompt')
      )).toBe(true);
      expect(orchestrator.respondToApproval).not.toHaveBeenCalled();
    });

    it('should handle orchestrator response failures', async () => {
      const responseError = new Error('Orchestrator communication failed');
      const mockResponse: ApprovalResponse = {
        requestId: 'response-error',
        taskId: 'e2e-test-task',
        response: 'approved',
        approvalId: 'response-error',
        gateName: 'response-error-gate',
        action: 'approve',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: new Date(),
        responseTimeMs: 1000,
        resolved: true
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(mockResponse);
      });

      orchestrator.respondToApproval.mockRejectedValue(responseError);

      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: [{
          id: 'response-error',
          gateName: 'response-error-gate',
          userResponse: 'approve',
          shouldFail: true,
          failureType: 'response'
        }]
      });

      expect(consoleErrors.some(error =>
        error.includes('Error responding to approval: Error: Orchestrator communication failed')
      )).toBe(true);
    });

    it('should handle additional info prompt failures', async () => {
      const infoError = new Error('Additional info prompt failed');
      const infoRequest = 'Provide deployment strategy';

      const initialResponse: ApprovalResponse = {
        requestId: 'info-error',
        taskId: 'e2e-test-task',
        response: 'info-requested',
        message: infoRequest,
        approvalId: 'info-error',
        gateName: 'info-error-gate',
        action: 'request-info',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: new Date(),
        responseTimeMs: 1000,
        resolved: false
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(initialResponse);
      });

      mockPromptForAdditionalInfo.mockRejectedValue(infoError);
      orchestrator.respondToApproval.mockResolvedValue(undefined);

      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: [{
          id: 'info-error',
          gateName: 'info-error-gate',
          userResponse: 'info',
          infoRequest,
          shouldFail: true,
          failureType: 'info'
        }]
      });

      expect(consoleErrors.some(error =>
        error.includes('Error handling info request: Error: Additional info prompt failed')
      )).toBe(true);
    });
  });

  describe('Performance and Timing', () => {
    it('should handle rapid sequential approvals efficiently', async () => {
      const startTime = Date.now();
      const rapidApprovals = Array.from({ length: 10 }, (_, i) => ({
        id: `rapid-${i}`,
        gateName: `operation-${i}`,
        userResponse: 'approve' as const
      }));

      let responseCount = 0;
      mockShowApprovalPrompt.mockImplementation(async ({ eventData, onSelection }) => {
        const response: ApprovalResponse = {
          requestId: eventData.approvalId,
          taskId: eventData.taskId,
          response: 'approved',
          approvalId: eventData.approvalId,
          gateName: eventData.gateName,
          action: 'approve',
          approver: 'cli-user',
          timestamp: new Date(),
          requestedAt: new Date(),
          responseTimeMs: 100,
          resolved: true
        };

        await onSelection(response);
        responseCount++;
      });

      orchestrator.respondToApproval.mockResolvedValue(undefined);

      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: rapidApprovals
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(responseCount).toBe(10);
      expect(mockShowApprovalPrompt).toHaveBeenCalledTimes(10);
      expect(orchestrator.respondToApproval).toHaveBeenCalledTimes(10);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle approval timeouts appropriately', async () => {
      vi.useFakeTimers();

      const timeoutResponse: ApprovalResponse = {
        requestId: 'timeout-test',
        taskId: 'e2e-test-task',
        response: 'approved',
        approvalId: 'timeout-test',
        gateName: 'timeout-gate',
        action: 'approve',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        responseTimeMs: 10 * 60 * 1000, // 10 minutes response time
        resolved: true
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        // Simulate delayed response
        await new Promise(resolve => setTimeout(resolve, 1000));
        await onSelection(timeoutResponse);
      });

      orchestrator.respondToApproval.mockResolvedValue(undefined);

      const workflowPromise = orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: [{
          id: 'timeout-test',
          gateName: 'timeout-gate',
          userResponse: 'approve'
        }]
      });

      // Fast-forward time
      vi.advanceTimersByTime(2000);

      await workflowPromise;

      expect(orchestrator.respondToApproval).toHaveBeenCalledWith(
        'timeout-test',
        expect.objectContaining({
          responseTimeMs: 10 * 60 * 1000
        })
      );

      vi.useRealTimers();
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle approval workflow with task filtering', async () => {
      // Test that approvals for other tasks are ignored
      const correctTaskApproval: ApprovalRequiredEventData = {
        approvalId: 'correct-task',
        taskId: 'e2e-test-task', // Matches current task
        gateName: 'correct-gate',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      const wrongTaskApproval: ApprovalRequiredEventData = {
        approvalId: 'wrong-task',
        taskId: 'different-task-id', // Different task
        gateName: 'wrong-gate',
        gateType: 'pre-action',
        timestamp: new Date()
      };

      mockShowApprovalPrompt.mockImplementation(async ({ eventData, onSelection }) => {
        if (eventData.taskId === 'e2e-test-task') {
          const response: ApprovalResponse = {
            requestId: eventData.approvalId,
            taskId: eventData.taskId,
            response: 'approved',
            approvalId: eventData.approvalId,
            gateName: eventData.gateName,
            action: 'approve',
            approver: 'cli-user',
            timestamp: new Date(),
            requestedAt: new Date(),
            responseTimeMs: 1000,
            resolved: true
          };
          await onSelection(response);
        }
      });

      orchestrator.respondToApproval.mockResolvedValue(undefined);

      // Emit both approvals
      orchestrator.emit('approval:required', correctTaskApproval);
      orchestrator.emit('approval:required', wrongTaskApproval);

      await new Promise(resolve => setTimeout(resolve, 50)); // Allow async processing

      // Only the correct task approval should be processed
      expect(mockShowApprovalPrompt).toHaveBeenCalledTimes(1);
      expect(mockShowApprovalPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          eventData: correctTaskApproval
        })
      );
      expect(orchestrator.respondToApproval).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup of event listeners properly', async () => {
      const infoResponse: ApprovalResponse = {
        requestId: 'cleanup-test',
        taskId: 'e2e-test-task',
        response: 'info-requested',
        message: 'Test info request',
        approvalId: 'cleanup-test',
        gateName: 'cleanup-gate',
        action: 'request-info',
        approver: 'cli-user',
        timestamp: new Date(),
        requestedAt: new Date(),
        responseTimeMs: 1000,
        resolved: false
      };

      mockShowApprovalPrompt.mockImplementation(async ({ onSelection }) => {
        await onSelection(infoResponse);
      });

      mockPromptForAdditionalInfo.mockResolvedValue('Cleanup test info');
      orchestrator.respondToApproval.mockResolvedValue(undefined);

      // Initially no info-requested listeners
      expect(orchestrator.listenerCount('approval:info-requested')).toBe(0);

      await orchestrator.simulateCompleteWorkflow({
        taskId: 'e2e-test-task',
        approvals: [{
          id: 'cleanup-test',
          gateName: 'cleanup-gate',
          userResponse: 'info',
          infoRequest: 'Test cleanup',
          additionalInfo: 'Cleanup test info'
        }]
      });

      // After complete workflow, should be cleaned up
      expect(orchestrator.listenerCount('approval:info-requested')).toBe(0);
    });
  });
});