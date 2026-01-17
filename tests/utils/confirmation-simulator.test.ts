/**
 * @fileoverview Tests for the ConfirmationSimulator utility
 *
 * This file tests the user response simulation utilities to ensure they
 * properly integrate with the orchestrator events and can simulate various
 * confirmation scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  ApexOrchestrator,
  ApprovalRequiredEventData,
  PermissionRequestEventData,
  DangerousOperationDetectedEventData,
} from '@apexcli/orchestrator';
import {
  ConfirmationSimulator,
  createConfirmationSimulator,
  createConfirmationSimulatorWithResponses,
  createMockApprovalResponse,
  waitForOrchestratorEvent,
} from './confirmation-simulator';

// Mock ApexOrchestrator
class MockOrchestrator extends EventEmitter {
  respondToApproval = vi.fn();

  constructor() {
    super();
  }

  // Helper to emit test events
  emitApprovalRequired(data: ApprovalRequiredEventData) {
    this.emit('approval:required', data);
  }

  emitPermissionRequest(data: PermissionRequestEventData) {
    this.emit('permission:request', data);
  }

  emitDangerousOperation(data: DangerousOperationDetectedEventData) {
    this.emit('dangerous:detected', data);
  }
}

describe('ConfirmationSimulator', () => {
  let mockOrchestrator: MockOrchestrator;
  let simulator: ConfirmationSimulator;

  beforeEach(() => {
    mockOrchestrator = new MockOrchestrator();
    simulator = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);
  });

  afterEach(() => {
    simulator.dispose();
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create a new ConfirmationSimulator', () => {
      expect(simulator).toBeInstanceOf(ConfirmationSimulator);
    });

    it('should register event listeners on orchestrator', () => {
      const listenerCount = mockOrchestrator.listenerCount('approval:required');
      expect(listenerCount).toBeGreaterThan(0);
    });
  });

  describe('simulateUserApproval', () => {
    it('should queue an approval response', () => {
      simulator.simulateUserApproval('approval-123', {
        approver: 'test-user',
        comment: 'Looks good!'
      });

      const queue = simulator.getResponseQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('approval');
      expect(queue[0].action).toBe('approve');
      expect(queue[0].matchPattern).toBe('approval-123');
    });

    it('should support pattern matching with RegExp', () => {
      const pattern = /^approval-.*$/;
      simulator.simulateUserApproval(pattern);

      const queue = simulator.getResponseQueue();
      expect(queue[0].matchPattern).toBe(pattern);
    });

    it('should return simulator instance for chaining', () => {
      const result = simulator.simulateUserApproval('test');
      expect(result).toBe(simulator);
    });
  });

  describe('simulateUserDenial', () => {
    it('should queue a denial response', () => {
      simulator.simulateUserDenial('approval-456', {
        denier: 'security-team',
        reason: 'Unsafe operation'
      });

      const queue = simulator.getResponseQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('approval');
      expect(queue[0].action).toBe('deny');
    });
  });

  describe('simulateTimeout', () => {
    it('should queue a timeout response', () => {
      simulator.simulateTimeout('approval-789', {
        timeoutMs: 5000,
        timeoutAction: 'reject',
        message: 'No response received'
      });

      const queue = simulator.getResponseQueue();
      expect(queue[0].action).toBe('timeout');
    });
  });

  describe('simulateBatchResponses', () => {
    it('should queue multiple responses', () => {
      const responses = [
        { type: 'approval' as const, action: 'approve' as const },
        { type: 'permission' as const, action: 'deny' as const, matchPattern: 'Write' },
        { type: 'dangerous-operation' as const, action: 'approve' as const }
      ];

      simulator.simulateBatchResponses(responses);

      const queue = simulator.getResponseQueue();
      expect(queue).toHaveLength(3);
      expect(queue[0].type).toBe('approval');
      expect(queue[1].type).toBe('permission');
      expect(queue[2].type).toBe('dangerous-operation');
    });
  });

  describe('Event Handling', () => {
    it('should handle approval:required events and respond automatically', async () => {
      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'test-approval-123',
        taskId: 'task-456',
        gateName: 'deploy-gate',
        gateType: 'pre-deploy',
        description: 'Test approval',
        timestamp: new Date(),
        minApprovals: 1
      };

      // Queue a response before emitting the event
      simulator.simulateUserApproval('test-approval-123', {
        approver: 'test-user',
        comment: 'Auto-approved by test'
      });

      // Emit the event
      mockOrchestrator.emitApprovalRequired(approvalData);

      // Give a moment for the async handler to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify the orchestrator's respondToApproval was called
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        'test-approval-123',
        expect.objectContaining({
          requestId: 'test-approval-123',
          taskId: 'task-456',
          response: 'approved',
          approver: 'test-user'
        })
      );
    });

    it('should capture unmatched requests for async handling', async () => {
      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'unmatched-approval',
        taskId: 'task-789',
        gateName: 'review-gate',
        gateType: 'pre-deploy',
        description: 'Manual review required',
        timestamp: new Date(),
        minApprovals: 1
      };

      mockOrchestrator.emitApprovalRequired(approvalData);

      // Give a moment for the event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      const captured = simulator.getCapturedRequests();
      expect(captured).toHaveLength(1);
      expect(captured[0].requestId).toBe('unmatched-approval');
      expect(captured[0].type).toBe('approval');
    });
  });

  describe('Async Response Handling', () => {
    it('should waitForApprovalRequest and resolve with captured data', async () => {
      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'async-approval',
        taskId: 'task-async',
        gateName: 'async-gate',
        gateType: 'pre-deploy',
        description: 'Async test',
        timestamp: new Date(),
        minApprovals: 1
      };

      // Start waiting for the request
      const requestPromise = simulator.waitForApprovalRequest(1000);

      // Emit the event after a short delay
      setTimeout(() => {
        mockOrchestrator.emitApprovalRequired(approvalData);
      }, 10);

      // Wait for the request to be captured
      const captured = await requestPromise;

      expect(captured.requestId).toBe('async-approval');
      expect(captured.type).toBe('approval');
      expect(captured.data).toEqual(approvalData);
    });

    it('should timeout when waiting for request that never comes', async () => {
      await expect(
        simulator.waitForApprovalRequest(100)
      ).rejects.toThrow('Timeout waiting for approval request after 100ms');
    });
  });

  describe('Utility Methods', () => {
    it('should reset and clear all state', () => {
      simulator.simulateUserApproval('test');
      mockOrchestrator.emitApprovalRequired({
        approvalId: 'capture-test',
        taskId: 'task-test',
        gateName: 'test-gate',
        gateType: 'pre-deploy',
        description: 'Test',
        timestamp: new Date(),
        minApprovals: 1
      });

      simulator.reset();

      expect(simulator.getResponseQueue()).toHaveLength(0);
      expect(simulator.getCapturedRequests()).toHaveLength(0);
    });

    it('should dispose cleanly', () => {
      const initialListeners = mockOrchestrator.listenerCount('approval:required');
      simulator.dispose();
      const finalListeners = mockOrchestrator.listenerCount('approval:required');

      expect(finalListeners).toBeLessThan(initialListeners);
    });
  });
});

describe('Factory Functions', () => {
  let mockOrchestrator: MockOrchestrator;

  beforeEach(() => {
    mockOrchestrator = new MockOrchestrator();
  });

  describe('createConfirmationSimulator', () => {
    it('should create a new simulator instance', () => {
      const simulator = createConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);
      expect(simulator).toBeInstanceOf(ConfirmationSimulator);
      simulator.dispose();
    });
  });

  describe('createConfirmationSimulatorWithResponses', () => {
    it('should create simulator with pre-configured responses', () => {
      const responses = [
        { type: 'approval' as const, action: 'approve' as const },
        { type: 'permission' as const, action: 'deny' as const }
      ];

      const simulator = createConfirmationSimulatorWithResponses(
        mockOrchestrator as unknown as ApexOrchestrator,
        responses
      );

      const queue = simulator.getResponseQueue();
      expect(queue).toHaveLength(2);
      simulator.dispose();
    });
  });
});

describe('Utility Functions', () => {
  describe('createMockApprovalResponse', () => {
    it('should create a valid approval response with defaults', () => {
      const response = createMockApprovalResponse('approval-123', 'task-456');

      expect(response.requestId).toBe('approval-123');
      expect(response.taskId).toBe('task-456');
      expect(response.response).toBe('approved');
      expect(response.approver).toBe('test-simulator');
      expect(response.resolved).toBe(true);
    });

    it('should create denial response when action is deny', () => {
      const response = createMockApprovalResponse('approval-123', 'task-456', {
        action: 'deny',
        message: 'Not authorized'
      });

      expect(response.response).toBe('denied');
      expect(response.message).toBe('Not authorized');
    });
  });

  describe('waitForOrchestratorEvent', () => {
    let mockOrchestrator: MockOrchestrator;

    beforeEach(() => {
      mockOrchestrator = new MockOrchestrator();
    });

    it('should resolve when event is emitted', async () => {
      const eventData = { test: 'data' };

      const eventPromise = waitForOrchestratorEvent(
        mockOrchestrator as unknown as ApexOrchestrator,
        'task:created' as any,
        1000
      );

      setTimeout(() => {
        mockOrchestrator.emit('task:created', eventData);
      }, 10);

      const result = await eventPromise;
      expect(result).toEqual(eventData);
    });

    it('should timeout if event is not emitted', async () => {
      await expect(
        waitForOrchestratorEvent(
          mockOrchestrator as unknown as ApexOrchestrator,
          'task:created' as any,
          100
        )
      ).rejects.toThrow("Timeout waiting for event 'task:created' after 100ms");
    });
  });
});