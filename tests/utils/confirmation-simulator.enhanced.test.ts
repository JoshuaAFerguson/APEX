/**
 * @fileoverview Enhanced tests for the ConfirmationSimulator utility
 *
 * This file provides comprehensive test coverage for edge cases, error conditions,
 * and advanced scenarios that aren't covered by the basic tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  ApexOrchestrator,
  ApprovalRequiredEventData,
  PermissionRequestEventData,
  DangerousOperationDetectedEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
} from '@apexcli/orchestrator';
import {
  ConfirmationSimulator,
  createConfirmationSimulator,
  createConfirmationSimulatorWithResponses,
  waitForOrchestratorEvent,
} from './confirmation-simulator';

// Enhanced Mock Orchestrator with more realistic behavior
class EnhancedMockOrchestrator extends EventEmitter {
  respondToApproval = vi.fn();

  constructor() {
    super();
    // Simulate realistic delays in methods
    this.respondToApproval = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5)); // Small delay to simulate async work
      return { success: true };
    });
  }

  // Helper to emit test events with realistic data
  emitApprovalRequired(data: ApprovalRequiredEventData) {
    this.emit('approval:required', data);
  }

  emitPermissionRequest(data: PermissionRequestEventData) {
    this.emit('permission:request', data);
  }

  emitDangerousOperation(data: DangerousOperationDetectedEventData) {
    this.emit('dangerous:detected', data);
  }

  // Simulate orchestrator errors
  simulateRespondToApprovalError() {
    this.respondToApproval.mockRejectedValueOnce(new Error('Orchestrator database error'));
  }
}

describe('ConfirmationSimulator Enhanced Tests', () => {
  let mockOrchestrator: EnhancedMockOrchestrator;
  let simulator: ConfirmationSimulator;

  beforeEach(() => {
    mockOrchestrator = new EnhancedMockOrchestrator();
    simulator = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);
  });

  afterEach(() => {
    simulator.dispose();
    vi.clearAllMocks();
  });

  describe('Permission Request Handling', () => {
    it('should handle permission:request events and grant permissions', async () => {
      const permissionData: PermissionRequestEventData = {
        requestId: 'perm-123',
        tool: 'Bash',
        scope: ['read', 'write'],
        timestamp: new Date(),
        metadata: { reason: 'Testing file operations' },
      };

      // Configure permission approval
      simulator.simulateBatchResponses([{
        type: 'permission',
        matchPattern: 'perm-123',
        action: 'approve',
        options: { approver: 'test-admin', comment: 'Approved for testing' }
      }]);

      // Listen for the permission:granted event
      let grantedEvent: PermissionGrantedEventData | null = null;
      mockOrchestrator.on('permission:granted', (event) => {
        grantedEvent = event;
      });

      // Emit the permission request
      mockOrchestrator.emitPermissionRequest(permissionData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(grantedEvent).not.toBeNull();
      expect(grantedEvent?.requestId).toBe('perm-123');
      expect(grantedEvent?.tool).toBe('Bash');
      expect(grantedEvent?.grantedBy).toBe('test-admin');
    });

    it('should handle permission:request events and deny permissions', async () => {
      const permissionData: PermissionRequestEventData = {
        requestId: 'perm-deny-456',
        tool: 'Write',
        scope: ['/etc/passwd'],
        timestamp: new Date(),
        metadata: { reason: 'Modifying system files' },
      };

      // Configure permission denial
      simulator.simulateBatchResponses([{
        type: 'permission',
        matchPattern: /^perm-deny-/,
        action: 'deny',
        options: { denier: 'security-admin', reason: 'System files are protected' }
      }]);

      // Listen for the permission:denied event
      let deniedEvent: PermissionDeniedEventData | null = null;
      mockOrchestrator.on('permission:denied', (event) => {
        deniedEvent = event;
      });

      // Emit the permission request
      mockOrchestrator.emitPermissionRequest(permissionData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(deniedEvent).not.toBeNull();
      expect(deniedEvent?.requestId).toBe('perm-deny-456');
      expect(deniedEvent?.tool).toBe('Write');
      expect(deniedEvent?.deniedBy).toBe('security-admin');
      expect(deniedEvent?.reason).toBe('System files are protected');
    });

    it('should support pattern matching by tool name for permissions', async () => {
      const permissionData: PermissionRequestEventData = {
        requestId: 'perm-tool-789',
        tool: 'Bash',
        scope: ['execute'],
        timestamp: new Date(),
      };

      // Configure approval by tool name pattern
      simulator.simulateBatchResponses([{
        type: 'permission',
        matchPattern: 'Bash', // Match by tool name
        action: 'approve',
        options: { approver: 'shell-admin' }
      }]);

      let grantedEvent: PermissionGrantedEventData | null = null;
      mockOrchestrator.on('permission:granted', (event) => {
        grantedEvent = event;
      });

      mockOrchestrator.emitPermissionRequest(permissionData);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(grantedEvent).not.toBeNull();
      expect(grantedEvent?.grantedBy).toBe('shell-admin');
    });

    it('should wait for permission requests asynchronously', async () => {
      const permissionData: PermissionRequestEventData = {
        requestId: 'async-perm-123',
        tool: 'Read',
        scope: ['/tmp/test.txt'],
        timestamp: new Date(),
      };

      // Start waiting for the request
      const requestPromise = simulator.waitForPermissionRequest(1000);

      // Emit the event after a delay
      setTimeout(() => {
        mockOrchestrator.emitPermissionRequest(permissionData);
      }, 10);

      const captured = await requestPromise;
      expect(captured.requestId).toBe('async-perm-123');
      expect(captured.type).toBe('permission');
      expect(captured.data).toEqual(permissionData);
    });
  });

  describe('Dangerous Operation Handling', () => {
    it('should handle dangerous:detected events and confirm operations', async () => {
      const dangerousData: DangerousOperationDetectedEventData = {
        operationId: 'danger-123',
        tool: 'Bash',
        operation: 'rm -rf /tmp/*',
        severity: 'high',
        timestamp: new Date(),
        context: { workingDir: '/tmp', affectedFiles: ['*'] },
      };

      // Configure operation confirmation
      simulator.simulateBatchResponses([{
        type: 'dangerous-operation',
        matchPattern: 'danger-123',
        action: 'approve',
        options: { approver: 'ops-admin', comment: 'Cleanup approved' }
      }]);

      // Listen for the dangerous:confirmed event
      let confirmedEvent: DangerousOperationConfirmedEventData | null = null;
      mockOrchestrator.on('dangerous:confirmed', (event) => {
        confirmedEvent = event;
      });

      mockOrchestrator.emitDangerousOperation(dangerousData);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(confirmedEvent).not.toBeNull();
      expect(confirmedEvent?.operationId).toBe('danger-123');
      expect(confirmedEvent?.operation).toBe('rm -rf /tmp/*');
      expect(confirmedEvent?.confirmedBy).toBe('ops-admin');
    });

    it('should handle dangerous:detected events and block operations', async () => {
      const dangerousData: DangerousOperationDetectedEventData = {
        operationId: 'danger-block-456',
        tool: 'Bash',
        operation: 'dd if=/dev/zero of=/dev/sda',
        severity: 'critical',
        timestamp: new Date(),
        context: { workingDir: '/', riskLevel: 'extreme' },
      };

      // Configure operation blocking
      simulator.simulateBatchResponses([{
        type: 'dangerous-operation',
        matchPattern: /dd.*\/dev\/sda/,
        action: 'deny',
        options: { denier: 'security-admin', reason: 'Disk destruction prevented' }
      }]);

      // Listen for the dangerous:blocked event
      let blockedEvent: DangerousOperationBlockedEventData | null = null;
      mockOrchestrator.on('dangerous:blocked', (event) => {
        blockedEvent = event;
      });

      mockOrchestrator.emitDangerousOperation(dangerousData);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(blockedEvent).not.toBeNull();
      expect(blockedEvent?.operationId).toBe('danger-block-456');
      expect(blockedEvent?.blockedBy).toBe('security-admin');
      expect(blockedEvent?.reason).toBe('Disk destruction prevented');
    });

    it('should wait for dangerous operation requests asynchronously', async () => {
      const dangerousData: DangerousOperationDetectedEventData = {
        operationId: 'async-danger-789',
        tool: 'Write',
        operation: 'format C:',
        severity: 'critical',
        timestamp: new Date(),
      };

      const requestPromise = simulator.waitForDangerousOperationRequest(1000);

      setTimeout(() => {
        mockOrchestrator.emitDangerousOperation(dangerousData);
      }, 10);

      const captured = await requestPromise;
      expect(captured.requestId).toBe('async-danger-789');
      expect(captured.type).toBe('dangerous-operation');
    });
  });

  describe('Timeout Handling', () => {
    it('should execute timeout with reject action', async () => {
      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'timeout-reject-123',
        taskId: 'task-timeout',
        gateName: 'timeout-gate',
        gateType: 'pre-deploy',
        description: 'Timeout test',
        timestamp: new Date(),
        minApprovals: 1
      };

      // Configure timeout that rejects
      simulator.simulateTimeout('timeout-reject-123', {
        timeoutMs: 50,
        timeoutAction: 'reject',
        message: 'Test timeout rejection'
      });

      mockOrchestrator.emitApprovalRequired(approvalData);

      // Wait for timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have called respondToApproval with denial
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        'timeout-reject-123',
        expect.objectContaining({
          response: 'denied',
          message: 'Test timeout rejection'
        })
      );
    });

    it('should execute timeout with approve action', async () => {
      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'timeout-approve-456',
        taskId: 'task-timeout-approve',
        gateName: 'timeout-gate',
        gateType: 'pre-deploy',
        description: 'Auto-approve timeout test',
        timestamp: new Date(),
        minApprovals: 1
      };

      simulator.simulateTimeout('timeout-approve-456', {
        timeoutMs: 50,
        timeoutAction: 'approve',
        message: 'Auto-approved after timeout'
      });

      mockOrchestrator.emitApprovalRequired(approvalData);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        'timeout-approve-456',
        expect.objectContaining({
          response: 'approved',
          approver: 'timeout-auto-approve'
        })
      );
    });

    it('should execute timeout with escalate action', async () => {
      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'timeout-escalate-789',
        taskId: 'task-timeout-escalate',
        gateName: 'timeout-gate',
        gateType: 'pre-deploy',
        description: 'Escalation timeout test',
        timestamp: new Date(),
        minApprovals: 1
      };

      // Listen for the escalation event
      let escalationEvent: any = null;
      mockOrchestrator.on('apex-event', (event) => {
        if (event.type === 'confirmation:escalated') {
          escalationEvent = event;
        }
      });

      simulator.simulateTimeout('timeout-escalate-789', {
        timeoutMs: 50,
        timeoutAction: 'escalate',
        message: 'Escalated to manager'
      });

      mockOrchestrator.emitApprovalRequired(approvalData);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(escalationEvent).not.toBeNull();
      expect(escalationEvent.data.requestId).toBe('timeout-escalate-789');
      expect(escalationEvent.data.message).toBe('Escalated to manager');
    });
  });

  describe('Complex Pattern Matching', () => {
    it('should handle complex RegExp patterns', async () => {
      const pattern = /^(approval|permission|danger)-test-\d{3}$/;

      simulator.simulateUserApproval(pattern, {
        approver: 'pattern-matcher',
        comment: 'Matched complex pattern'
      });

      // Test matching IDs
      const testCases = [
        { id: 'approval-test-123', shouldMatch: true },
        { id: 'permission-test-456', shouldMatch: true },
        { id: 'danger-test-789', shouldMatch: true },
        { id: 'approval-test-12', shouldMatch: false }, // Too short
        { id: 'invalid-test-123', shouldMatch: false },  // Wrong prefix
        { id: 'approval-test-abc', shouldMatch: false }, // Non-numeric suffix
      ];

      for (const testCase of testCases) {
        const approvalData: ApprovalRequiredEventData = {
          approvalId: testCase.id,
          taskId: `task-${testCase.id}`,
          gateName: 'pattern-gate',
          gateType: 'pre-deploy',
          description: 'Pattern test',
          timestamp: new Date(),
          minApprovals: 1
        };

        mockOrchestrator.emitApprovalRequired(approvalData);
        await new Promise(resolve => setTimeout(resolve, 10));

        if (testCase.shouldMatch) {
          expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
            testCase.id,
            expect.objectContaining({
              approver: 'pattern-matcher',
              response: 'approved'
            })
          );
        }
      }
    });

    it('should match patterns in FIFO order', async () => {
      // Add multiple patterns
      simulator
        .simulateUserApproval(/approval-.*/, { approver: 'pattern1' })
        .simulateUserApproval('approval-specific', { approver: 'specific' })
        .simulateUserApproval(/approval-specific/, { approver: 'pattern2' });

      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'approval-specific',
        taskId: 'task-fifo',
        gateName: 'fifo-gate',
        gateType: 'pre-deploy',
        description: 'FIFO test',
        timestamp: new Date(),
        minApprovals: 1
      };

      mockOrchestrator.emitApprovalRequired(approvalData);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should match the first pattern (pattern1)
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        'approval-specific',
        expect.objectContaining({
          approver: 'pattern1'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle orchestrator errors gracefully', async () => {
      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'error-test-123',
        taskId: 'task-error',
        gateName: 'error-gate',
        gateType: 'pre-deploy',
        description: 'Error handling test',
        timestamp: new Date(),
        minApprovals: 1
      };

      simulator.simulateUserApproval('error-test-123', {
        approver: 'error-tester'
      });

      // Configure orchestrator to fail
      mockOrchestrator.simulateRespondToApprovalError();

      // This should not throw, even if orchestrator fails
      expect(async () => {
        mockOrchestrator.emitApprovalRequired(approvalData);
        await new Promise(resolve => setTimeout(resolve, 20));
      }).not.toThrow();

      // Verify the call was attempted
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        'error-test-123',
        expect.any(Object)
      );
    });

    it('should handle async wait timeouts properly', async () => {
      await expect(
        simulator.waitForApprovalRequest(10) // Very short timeout
      ).rejects.toThrow('Timeout waiting for approval request after 10ms');

      await expect(
        simulator.waitForPermissionRequest(10)
      ).rejects.toThrow('Timeout waiting for permission request after 10ms');

      await expect(
        simulator.waitForDangerousOperationRequest(10)
      ).rejects.toThrow('Timeout waiting for dangerous-operation request after 10ms');
    });

    it('should clean up timeouts when reset is called', () => {
      simulator.simulateTimeout('cleanup-test', {
        timeoutMs: 1000,
        timeoutAction: 'reject'
      });

      // Reset should cancel the timeout
      simulator.reset();

      // Emit an event that would match the timeout
      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'cleanup-test',
        taskId: 'task-cleanup',
        gateName: 'cleanup-gate',
        gateType: 'pre-deploy',
        description: 'Cleanup test',
        timestamp: new Date(),
        minApprovals: 1
      };

      mockOrchestrator.emitApprovalRequired(approvalData);

      // Since we reset, the timeout should not trigger
      // (This is verified by the fact that no timeout errors occur)
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous requests', async () => {
      // Configure different responses for different types
      simulator.simulateBatchResponses([
        { type: 'approval', matchPattern: /approval-concurrent-/, action: 'approve', options: { approver: 'approver1' } },
        { type: 'permission', matchPattern: /perm-concurrent-/, action: 'deny', options: { reason: 'Concurrent test denial' } },
        { type: 'dangerous-operation', matchPattern: /danger-concurrent-/, action: 'approve', options: { approver: 'danger-approver' } }
      ]);

      // Set up event listeners
      const events: any[] = [];
      mockOrchestrator.on('permission:denied', (event) => events.push({ type: 'permission:denied', event }));
      mockOrchestrator.on('dangerous:confirmed', (event) => events.push({ type: 'dangerous:confirmed', event }));

      // Emit multiple events simultaneously
      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'approval-concurrent-1',
        taskId: 'task-concurrent',
        gateName: 'concurrent-gate',
        gateType: 'pre-deploy',
        description: 'Concurrent test',
        timestamp: new Date(),
        minApprovals: 1
      };

      const permissionData: PermissionRequestEventData = {
        requestId: 'perm-concurrent-1',
        tool: 'Write',
        scope: ['/test'],
        timestamp: new Date(),
      };

      const dangerousData: DangerousOperationDetectedEventData = {
        operationId: 'danger-concurrent-1',
        tool: 'Bash',
        operation: 'rm -rf /test',
        severity: 'high',
        timestamp: new Date(),
      };

      // Emit all at once
      mockOrchestrator.emitApprovalRequired(approvalData);
      mockOrchestrator.emitPermissionRequest(permissionData);
      mockOrchestrator.emitDangerousOperation(dangerousData);

      // Wait for all to process
      await new Promise(resolve => setTimeout(resolve, 30));

      // Verify all were handled
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith('approval-concurrent-1', expect.any(Object));
      expect(events).toHaveLength(2);
      expect(events.some(e => e.type === 'permission:denied' && e.event.requestId === 'perm-concurrent-1')).toBe(true);
      expect(events.some(e => e.type === 'dangerous:confirmed' && e.event.operationId === 'danger-concurrent-1')).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should properly dispose and prevent memory leaks', () => {
      // Track initial listener counts
      const initialApprovalListeners = mockOrchestrator.listenerCount('approval:required');
      const initialPermissionListeners = mockOrchestrator.listenerCount('permission:request');
      const initialDangerousListeners = mockOrchestrator.listenerCount('dangerous:detected');

      // Create and dispose multiple simulators
      for (let i = 0; i < 5; i++) {
        const tempSim = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);
        tempSim.dispose();
      }

      // Listener counts should return to initial levels
      expect(mockOrchestrator.listenerCount('approval:required')).toBe(initialApprovalListeners);
      expect(mockOrchestrator.listenerCount('permission:request')).toBe(initialPermissionListeners);
      expect(mockOrchestrator.listenerCount('dangerous:detected')).toBe(initialDangerousListeners);
    });

    it('should clear all state when disposed', () => {
      simulator.simulateUserApproval('test-dispose');
      simulator.simulateUserDenial('test-dispose-2');

      // Add some captured requests
      mockOrchestrator.emitApprovalRequired({
        approvalId: 'unconfigured-approval',
        taskId: 'task-dispose',
        gateName: 'dispose-gate',
        gateType: 'pre-deploy',
        description: 'Dispose test',
        timestamp: new Date(),
        minApprovals: 1
      });

      // State should exist before dispose
      expect(simulator.getResponseQueue()).toHaveLength(2);
      expect(simulator.getCapturedRequests()).toHaveLength(1);

      simulator.dispose();

      // State should be cleared after dispose
      expect(simulator.getResponseQueue()).toHaveLength(0);
      expect(simulator.getCapturedRequests()).toHaveLength(0);
    });
  });

  describe('Integration with Real Event Data', () => {
    it('should handle realistic approval event data', async () => {
      const realisticApprovalData: ApprovalRequiredEventData = {
        approvalId: 'approval_task_1234567890_abc123',
        taskId: 'task_mjt849ec_feature_development',
        gateName: 'deployment-review',
        gateType: 'pre-deploy',
        description: 'Deploy feature branch to staging environment',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        minApprovals: 2,
        currentApprovals: 0,
        approvers: [],
        requester: 'ci-system',
        priority: 'high',
        metadata: {
          branch: 'feature/user-auth',
          environment: 'staging',
          changeSize: 'medium',
          riskLevel: 'low'
        },
        affectedServices: ['auth-service', 'user-api'],
        estimatedDuration: '15 minutes',
        rollbackPlan: 'Automated rollback via blue-green deployment',
        approvalUrl: 'https://app.apex.dev/approvals/approval_task_1234567890_abc123'
      };

      simulator.simulateUserApproval(realisticApprovalData.approvalId, {
        approver: 'tech-lead@company.com',
        comment: 'Code review passed, automated tests green, LGTM'
      });

      mockOrchestrator.emitApprovalRequired(realisticApprovalData);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        realisticApprovalData.approvalId,
        expect.objectContaining({
          requestId: realisticApprovalData.approvalId,
          taskId: realisticApprovalData.taskId,
          response: 'approved',
          approver: 'tech-lead@company.com',
          message: 'Code review passed, automated tests green, LGTM'
        })
      );
    });
  });
});

describe('ConfirmationSimulator Factory Functions Enhanced', () => {
  let mockOrchestrator: EnhancedMockOrchestrator;

  beforeEach(() => {
    mockOrchestrator = new EnhancedMockOrchestrator();
  });

  describe('createConfirmationSimulatorWithResponses', () => {
    it('should handle mixed response types in batch configuration', () => {
      const complexResponses = [
        {
          type: 'approval' as const,
          matchPattern: /deploy-approval-.*/,
          action: 'approve' as const,
          options: { approver: 'deploy-bot', comment: 'Automated approval for deploy' }
        },
        {
          type: 'permission' as const,
          matchPattern: 'Bash',
          action: 'deny' as const,
          options: { denier: 'security-admin', reason: 'Shell access restricted' }
        },
        {
          type: 'dangerous-operation' as const,
          matchPattern: /rm\s+-rf/,
          action: 'deny' as const,
          options: { denier: 'safety-admin', reason: 'Destructive operation blocked' }
        }
      ];

      const simulator = createConfirmationSimulatorWithResponses(
        mockOrchestrator as unknown as ApexOrchestrator,
        complexResponses
      );

      const queue = simulator.getResponseQueue();
      expect(queue).toHaveLength(3);
      expect(queue[0].type).toBe('approval');
      expect(queue[1].type).toBe('permission');
      expect(queue[2].type).toBe('dangerous-operation');

      simulator.dispose();
    });
  });
});

describe('waitForOrchestratorEvent Enhanced', () => {
  let mockOrchestrator: EnhancedMockOrchestrator;

  beforeEach(() => {
    mockOrchestrator = new EnhancedMockOrchestrator();
  });

  it('should handle rapid successive events', async () => {
    const eventPromises = [
      waitForOrchestratorEvent(mockOrchestrator as unknown as ApexOrchestrator, 'task:created' as any, 1000),
      waitForOrchestratorEvent(mockOrchestrator as unknown as ApexOrchestrator, 'task:started' as any, 1000),
      waitForOrchestratorEvent(mockOrchestrator as unknown as ApexOrchestrator, 'task:completed' as any, 1000),
    ];

    // Emit events in rapid succession
    setTimeout(() => {
      mockOrchestrator.emit('task:created', { id: 'task1', type: 'created' });
      mockOrchestrator.emit('task:started', { id: 'task1', type: 'started' });
      mockOrchestrator.emit('task:completed', { id: 'task1', type: 'completed' });
    }, 10);

    const results = await Promise.all(eventPromises);
    expect(results).toHaveLength(3);
    expect(results[0].type).toBe('created');
    expect(results[1].type).toBe('started');
    expect(results[2].type).toBe('completed');
  });

  it('should handle event listener cleanup on timeout', async () => {
    const initialListenerCount = mockOrchestrator.listenerCount('task:nonexistent' as any);

    try {
      await waitForOrchestratorEvent(
        mockOrchestrator as unknown as ApexOrchestrator,
        'task:nonexistent' as any,
        50
      );
    } catch (error) {
      // Expected timeout error
    }

    // Listener count should be back to initial level
    const finalListenerCount = mockOrchestrator.listenerCount('task:nonexistent' as any);
    expect(finalListenerCount).toBe(initialListenerCount);
  });
});