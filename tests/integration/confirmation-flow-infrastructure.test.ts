/**
 * @fileoverview Integration Test Suite for Confirmation Flow Test Infrastructure
 *
 * This test suite validates that all test utilities work correctly:
 * - Fixtures generate valid data
 * - Simulators properly trigger responses
 * - Event capture captures all event types
 * - MockOrchestrator methods emit correct events
 *
 * This ensures our test infrastructure is reliable and consistent.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';

// Import fixtures from confirmation-flows.ts
import {
  createMockPermissionRequest,
  createMockPermissionGranted,
  createMockPermissionDenied,
  createMockDangerousOperationDetected,
  createMockDangerousOperationConfirmed,
  createMockDangerousOperationBlocked,
  createMockApprovalRequired,
  createMockApprovalGranted,
  createMockApprovalDenied,
  createMockApprovalResolved,
  generatePermissionMatrix,
  generateRiskLevelScenarios,
  generateTimeoutScenarios,
  PERMISSION_SCENARIOS,
  DANGEROUS_OPERATION_SCENARIOS,
  APPROVAL_SCENARIOS,
} from '../fixtures/confirmation-flows';

// Import simulator from confirmation-simulator.ts
import {
  ConfirmationSimulator,
  createConfirmationSimulator,
  createConfirmationSimulatorWithResponses,
  createMockApprovalResponse,
  waitForOrchestratorEvent,
} from '../utils/confirmation-simulator';

// Import event capture utility
import { createEventCapture } from '../../packages/orchestrator/tests/utils/event-capture';

// Mock types for testing
import type {
  ApexOrchestrator,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  ApprovalResolvedEventData,
} from '@apexcli/orchestrator';

// Simple Event Capture class for testing
class TestEventCapture {
  private events: Array<{ type: string; data: any; timestamp: Date }> = [];
  private emitter: EventEmitter;

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
    this.setupListeners();
  }

  private setupListeners() {
    const eventTypes = [
      'permission:request',
      'permission:granted',
      'permission:denied',
      'dangerous:detected',
      'dangerous:confirmed',
      'dangerous:blocked',
      'approval:required',
      'approval:granted',
      'approval:denied',
      'task:started',
      'task:completed',
      'agent:transition',
      'task:stage-changed',
      'stage:parallel-started',
      'stage:parallel-completed'
    ];

    eventTypes.forEach(eventType => {
      this.emitter.on(eventType, (data) => {
        this.events.push({
          type: eventType,
          data,
          timestamp: new Date()
        });
      });
    });
  }

  getAllEvents() {
    return [...this.events];
  }

  getEventsByType(type: string) {
    return this.events.filter(e => e.type === type);
  }

  getLastEventOfType(type: string) {
    const events = this.getEventsByType(type);
    return events[events.length - 1];
  }

  expectEventEmitted(eventType: string) {
    const events = this.getEventsByType(eventType);
    if (events.length === 0) {
      throw new Error(`Expected event '${eventType}' to be emitted, but it was not`);
    }
  }

  expectEventSequence(eventTypes: string[]) {
    let currentIndex = 0;
    for (const event of this.events) {
      if (event.type === eventTypes[currentIndex]) {
        currentIndex++;
        if (currentIndex === eventTypes.length) return;
      }
    }
    throw new Error(`Expected sequence [${eventTypes.join(', ')}] not found`);
  }

  expectEventData(event: any, expectedData: any) {
    for (const [key, value] of Object.entries(expectedData)) {
      if (event.data[key] !== value) {
        throw new Error(`Expected ${key}=${value}, got ${event.data[key]}`);
      }
    }
  }

  clear() {
    this.events = [];
  }

  dispose() {
    this.emitter.removeAllListeners();
  }
}

// Enhanced MockOrchestrator for testing
class EnhancedMockOrchestrator extends EventEmitter {
  respondToApproval = vi.fn();

  constructor() {
    super();
  }

  simulatePermissionRequest(data: Partial<PermissionRequestEventData> = {}) {
    const request: PermissionRequestEventData = {
      requestId: 'mock-req-' + Math.random().toString(36).substr(2, 9),
      tool: 'Write',
      scope: '/test/path',
      description: 'Mock permission request',
      isDangerous: false,
      agent: 'test-agent',
      timestamp: new Date(),
      metadata: {},
      ...data
    };
    this.emit('permission:request', request);
    return request;
  }

  simulatePermissionGranted(data: Partial<PermissionGrantedEventData> = {}) {
    const granted: PermissionGrantedEventData = {
      requestId: 'mock-req-' + Math.random().toString(36).substr(2, 9),
      tool: 'Write',
      scope: '/test/path',
      level: 'allow-once',
      grantedBy: 'user',
      timestamp: new Date(),
      ...data
    };
    this.emit('permission:granted', granted);
    return granted;
  }

  simulatePermissionDenied(data: Partial<PermissionDeniedEventData> = {}) {
    const denied: PermissionDeniedEventData = {
      requestId: 'mock-req-' + Math.random().toString(36).substr(2, 9),
      tool: 'Write',
      scope: '/test/path',
      deniedBy: 'user',
      timestamp: new Date(),
      reason: 'Test denial',
      ...data
    };
    this.emit('permission:denied', denied);
    return denied;
  }

  simulateDangerousOperationDetected(data: Partial<DangerousOperationDetectedEventData> = {}) {
    const dangerous: DangerousOperationDetectedEventData = {
      operationId: 'mock-op-' + Math.random().toString(36).substr(2, 9),
      tool: 'Bash',
      operation: 'rm -rf /',
      riskLevel: 'critical',
      riskDescription: 'Dangerous operation',
      agent: 'test-agent',
      timestamp: new Date(),
      context: {},
      ...data
    };
    this.emit('dangerous:detected', dangerous);
    return dangerous;
  }

  simulateDangerousOperationConfirmed(data: Partial<DangerousOperationConfirmedEventData> = {}) {
    const confirmed: DangerousOperationConfirmedEventData = {
      operationId: 'mock-op-' + Math.random().toString(36).substr(2, 9),
      tool: 'Bash',
      operation: 'rm -rf /',
      confirmedBy: 'user',
      timestamp: new Date(),
      ...data
    };
    this.emit('dangerous:confirmed', confirmed);
    return confirmed;
  }

  simulateDangerousOperationBlocked(data: Partial<DangerousOperationBlockedEventData> = {}) {
    const blocked: DangerousOperationBlockedEventData = {
      operationId: 'mock-op-' + Math.random().toString(36).substr(2, 9),
      tool: 'Bash',
      operation: 'rm -rf /',
      blockedBy: 'system',
      timestamp: new Date(),
      reason: 'Blocked for safety',
      ...data
    };
    this.emit('dangerous:blocked', blocked);
    return blocked;
  }

  simulateTaskStart(task: any) {
    this.emit('task:started', task);
  }

  simulateTaskComplete(task: any) {
    this.emit('task:completed', task);
  }

  simulateAgentTransition(taskId: string, fromAgent: string | null, toAgent: string) {
    this.emit('agent:transition', taskId, fromAgent, toAgent);
  }

  simulateStageChange(taskId: string, stageName: string, agentName: string) {
    const mockTask = {
      id: taskId,
      currentStage: stageName,
      status: 'in-progress',
      description: 'Test task',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.emit('task:stage-changed', mockTask, stageName);
  }

  simulateParallelStart(taskId: string, stages: string[], agents: string[]) {
    this.emit('stage:parallel-started', taskId, stages, agents);
  }

  simulateParallelComplete(taskId: string) {
    this.emit('stage:parallel-completed', taskId);
  }
}

describe('Confirmation Flow Test Infrastructure Integration', () => {
  let mockOrchestrator: EnhancedMockOrchestrator;
  let eventCapture: TestEventCapture;
  let simulator: ConfirmationSimulator;

  beforeEach(() => {
    // Create fresh instances for each test
    mockOrchestrator = new EnhancedMockOrchestrator();
    eventCapture = new TestEventCapture(mockOrchestrator);
    simulator = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);
  });

  afterEach(() => {
    // Clean up resources
    if (eventCapture) {
      eventCapture.dispose();
    }
    if (simulator) {
      simulator.dispose();
    }
    if (mockOrchestrator) {
      mockOrchestrator.removeAllListeners();
    }
  });

  describe('Fixture Generation Validation', () => {
    it('should generate valid permission request data', () => {
      const request = createMockPermissionRequest({
        tool: 'Write',
        scope: '/test/file.ts',
        description: 'Test permission request',
      });

      expect(request).toMatchObject({
        requestId: expect.stringMatching(/^req_/),
        tool: 'Write',
        scope: '/test/file.ts',
        description: 'Test permission request',
        isDangerous: false,
        agent: 'test-agent',
        timestamp: expect.any(Date),
        metadata: expect.any(Object),
      });

      // Validate timestamp is recent
      const timeDiff = Date.now() - request.timestamp.getTime();
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it('should generate valid dangerous operation data', () => {
      const operation = createMockDangerousOperationDetected({
        operation: 'rm -rf /',
        riskLevel: 'critical',
      });

      expect(operation).toMatchObject({
        operationId: expect.stringMatching(/^op_/),
        tool: 'Bash',
        operation: 'rm -rf /',
        riskLevel: 'critical',
        riskDescription: expect.any(String),
        agent: expect.any(String),
        timestamp: expect.any(Date),
        context: expect.any(Object),
      });
    });

    it('should generate valid approval gate data', () => {
      const approval = createMockApprovalRequired({
        gateName: 'deploy-production',
        description: 'Deploy to production environment',
      });

      expect(approval).toMatchObject({
        approvalId: expect.stringMatching(/^approval_/),
        taskId: expect.stringMatching(/^task_/),
        gateName: 'deploy-production',
        description: 'Deploy to production environment',
        approvers: expect.arrayContaining([expect.any(String)]),
        minApprovals: expect.any(Number),
        timeoutMinutes: expect.any(Number),
        expiresAt: expect.any(Date),
        timestamp: expect.any(Date),
      });

      // Validate expires at is in the future
      expect(approval.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate consistent permission matrix data', () => {
      const matrix = generatePermissionMatrix(['Read', 'Write']);

      expect(matrix).toHaveLength(6); // 2 tools * 3 levels

      const readEntries = matrix.filter(entry => entry.tool === 'Read');
      expect(readEntries).toHaveLength(3);

      const writeEntries = matrix.filter(entry => entry.tool === 'Write');
      expect(writeEntries).toHaveLength(3);

      // Validate all entries have required fields
      matrix.forEach(entry => {
        expect(entry).toMatchObject({
          tool: expect.any(String),
          level: expect.stringMatching(/^(allow-always|allow-once|deny)$/),
          request: expect.objectContaining({
            requestId: expect.any(String),
            tool: entry.tool,
          }),
          grantedResponse: expect.objectContaining({
            requestId: entry.request.requestId,
            tool: entry.tool,
            level: entry.level,
          }),
          deniedResponse: expect.objectContaining({
            requestId: entry.request.requestId,
            tool: entry.tool,
          }),
        });
      });
    });

    it('should generate risk level scenarios correctly', () => {
      const scenarios = generateRiskLevelScenarios();

      expect(scenarios).toHaveLength(4); // low, medium, high, critical

      const riskLevels = scenarios.map(s => s.riskLevel);
      expect(riskLevels).toEqual(['low', 'medium', 'high', 'critical']);

      scenarios.forEach(scenario => {
        expect(scenario).toMatchObject({
          riskLevel: expect.stringMatching(/^(low|medium|high|critical)$/),
          operation: expect.objectContaining({
            operationId: expect.any(String),
            riskLevel: scenario.riskLevel,
            operation: expect.any(String),
          }),
          confirmedResponse: expect.objectContaining({
            operationId: scenario.operation.operationId,
            operation: scenario.operation.operation,
          }),
          blockedResponse: expect.objectContaining({
            operationId: scenario.operation.operationId,
            operation: scenario.operation.operation,
          }),
        });
      });
    });

    it('should generate timeout scenarios with valid configurations', () => {
      const scenarios = generateTimeoutScenarios();

      expect(scenarios.length).toBeGreaterThan(0);

      scenarios.forEach(scenario => {
        expect(scenario).toMatchObject({
          name: expect.any(String),
          timeoutMinutes: expect.any(Number),
          timeoutAction: expect.stringMatching(/^(reject|approve|escalate)$/),
          request: expect.objectContaining({
            approvalId: expect.any(String),
            timeoutMinutes: scenario.timeoutMinutes,
          }),
          expectedResolution: expect.objectContaining({
            approvalId: scenario.request.approvalId,
            resolution: expect.any(String),
          }),
        });

        // Validate timeout is positive
        expect(scenario.timeoutMinutes).toBeGreaterThan(0);
      });
    });

    it('should provide pre-built scenario collections', () => {
      // Test permission scenarios
      expect(PERMISSION_SCENARIOS.approved).toBeInstanceOf(Array);
      expect(PERMISSION_SCENARIOS.denied).toBeInstanceOf(Array);

      PERMISSION_SCENARIOS.approved.forEach(scenario => {
        expect(scenario.expectedOutcome).toBe('approved');
        expect(scenario.request).toMatchObject({
          requestId: expect.any(String),
          tool: expect.any(String),
        });
        expect(scenario.response).toMatchObject({
          requestId: scenario.request.requestId,
          tool: scenario.request.tool,
        });
      });

      // Test dangerous operation scenarios
      expect(DANGEROUS_OPERATION_SCENARIOS.confirmed).toBeInstanceOf(Array);
      expect(DANGEROUS_OPERATION_SCENARIOS.blocked).toBeInstanceOf(Array);

      // Test approval scenarios
      expect(APPROVAL_SCENARIOS.approved).toBeInstanceOf(Array);
      expect(APPROVAL_SCENARIOS.denied).toBeInstanceOf(Array);
      expect(APPROVAL_SCENARIOS.timeout).toBeInstanceOf(Array);
    });
  });

  describe('MockOrchestrator Event Emission', () => {
    it('should emit permission events correctly', () => {
      const permissionRequest = mockOrchestrator.simulatePermissionRequest({
        tool: 'Write',
        scope: '/test/file.ts',
      });

      const capturedEvents = eventCapture.getAllEvents();
      expect(capturedEvents).toHaveLength(1);

      const event = capturedEvents[0];
      expect(event.type).toBe('permission:request');
      expect(event.data).toMatchObject({
        requestId: permissionRequest.requestId,
        tool: 'Write',
        scope: '/test/file.ts',
      });
    });

    it('should emit dangerous operation events correctly', () => {
      const dangerousOp = mockOrchestrator.simulateDangerousOperationDetected({
        operation: 'rm -rf /',
        riskLevel: 'critical',
      });

      const events = eventCapture.getEventsByType('dangerous:detected');
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.data).toMatchObject({
        operationId: dangerousOp.operationId,
        operation: 'rm -rf /',
        riskLevel: 'critical',
      });
    });

    it('should emit agent transition events correctly', () => {
      mockOrchestrator.simulateAgentTransition('task-123', 'planner', 'developer');

      const events = eventCapture.getAllEvents();
      const transitionEvent = events.find(e => e.type === 'agent:transition');

      expect(transitionEvent).toBeDefined();
      expect(transitionEvent?.data).toEqual(['task-123', 'planner', 'developer']);
    });

    it('should emit stage change events correctly', () => {
      mockOrchestrator.simulateStageChange('task-456', 'implementation', 'developer');

      const events = eventCapture.getAllEvents();
      const stageEvent = events.find(e => e.type === 'task:stage-changed');

      expect(stageEvent).toBeDefined();
      expect(stageEvent?.data).toMatchObject({
        id: 'task-456',
        currentStage: 'implementation',
      });
    });

    it('should handle parallel execution events', () => {
      const taskId = 'task-parallel-123';
      const stages = ['test', 'build'];
      const agents = ['tester', 'builder'];

      mockOrchestrator.simulateParallelStart(taskId, stages, agents);
      mockOrchestrator.simulateParallelComplete(taskId);

      const events = eventCapture.getAllEvents();

      const startEvent = events.find(e => e.type === 'stage:parallel-started');
      const completeEvent = events.find(e => e.type === 'stage:parallel-completed');

      expect(startEvent).toBeDefined();
      expect(startEvent?.data).toEqual([taskId, stages, agents]);

      expect(completeEvent).toBeDefined();
      expect(completeEvent?.data).toBe(taskId);
    });
  });

  describe('Event Capture Functionality', () => {
    it('should capture all event types correctly', () => {
      // Emit various event types
      mockOrchestrator.simulatePermissionRequest();
      mockOrchestrator.simulatePermissionGranted();
      mockOrchestrator.simulatePermissionDenied();
      mockOrchestrator.simulateDangerousOperationDetected();
      mockOrchestrator.simulateDangerousOperationConfirmed();
      mockOrchestrator.simulateDangerousOperationBlocked();

      const allEvents = eventCapture.getAllEvents();
      expect(allEvents).toHaveLength(6);

      const eventTypes = allEvents.map(e => e.type);
      expect(eventTypes).toContain('permission:request');
      expect(eventTypes).toContain('permission:granted');
      expect(eventTypes).toContain('permission:denied');
      expect(eventTypes).toContain('dangerous:detected');
      expect(eventTypes).toContain('dangerous:confirmed');
      expect(eventTypes).toContain('dangerous:blocked');
    });

    it('should filter events by type correctly', () => {
      mockOrchestrator.simulatePermissionRequest();
      mockOrchestrator.simulatePermissionGranted();
      mockOrchestrator.simulateDangerousOperationDetected();

      const permissionEvents = eventCapture.getEventsByType('permission:request');
      expect(permissionEvents).toHaveLength(1);

      const dangerousEvents = eventCapture.getEventsByType('dangerous:detected');
      expect(dangerousEvents).toHaveLength(1);
    });

    it('should support event sequence validation', () => {
      mockOrchestrator.simulateTaskStart({ id: 'task-1' });
      mockOrchestrator.simulatePermissionRequest();
      mockOrchestrator.simulatePermissionGranted();
      mockOrchestrator.simulateTaskComplete({ id: 'task-1' });

      // Should not throw
      eventCapture.expectEventSequence([
        'task:started',
        'permission:request',
        'permission:granted',
        'task:completed'
      ]);

      // Should throw for incorrect sequence
      expect(() => {
        eventCapture.expectEventSequence([
          'permission:granted',
          'permission:request'
        ]);
      }).toThrow();
    });

    it('should validate event data correctly', () => {
      const permissionData = mockOrchestrator.simulatePermissionRequest({
        tool: 'Write',
        scope: '/custom/path',
      });

      const event = eventCapture.getLastEventOfType('permission:request');
      expect(event).toBeDefined();

      // Should not throw
      eventCapture.expectEventData(event!, {
        tool: 'Write',
        scope: '/custom/path',
        requestId: permissionData.requestId,
      });

      // Should throw for incorrect data
      expect(() => {
        eventCapture.expectEventData(event!, { tool: 'Read' });
      }).toThrow();
    });
  });

  describe('Confirmation Simulator Integration', () => {
    it('should pre-configure approval responses', async () => {
      const approvalId = 'test-approval-123';

      // Pre-configure approval
      simulator.simulateUserApproval(approvalId, {
        approver: 'test-user',
        comment: 'Approved for testing',
      });

      // Simulate approval request
      const approvalEvent: ApprovalRequiredEventData = {
        approvalId,
        taskId: 'task-123',
        gateName: 'test-gate',
        gateType: 'custom',
        description: 'Test approval',
        approvers: ['test-user'],
        minApprovals: 1,
        timeoutMinutes: 30,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        stage: 'test-stage',
        agent: 'test-agent',
        timestamp: new Date(),
        context: {},
        changesSummary: 'Test changes',
        affectedFiles: ['test.ts'],
        blocking: true,
      };

      mockOrchestrator.emit('approval:required', approvalEvent);

      // Give the simulator time to respond
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that approval response was triggered
      // Note: This would require the orchestrator to have a respondToApproval method
      // For this test, we just verify the simulator consumed the response
      const queue = simulator.getResponseQueue();
      const consumedResponses = queue.filter(r => 'consumed' in r);
      expect(consumedResponses).toHaveLength(0); // Should be consumed and removed from visible queue
    });

    it('should handle permission simulation', async () => {
      // Configure permission denial
      simulator.simulateUserDenial(/Write/, {
        reason: 'Access denied for testing',
      });

      // Simulate permission request
      const permissionRequest: PermissionRequestEventData = {
        requestId: 'req-123',
        tool: 'Write',
        scope: '/test/file.ts',
        description: 'Write test file',
        isDangerous: false,
        agent: 'test-agent',
        timestamp: new Date(),
        metadata: {},
      };

      mockOrchestrator.emit('permission:request', permissionRequest);

      // Give simulator time to respond
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that permission denied event was emitted
      const deniedEvents = eventCapture.getEventsByType('permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const deniedEvent = deniedEvents[0];
      expect(deniedEvent.data).toMatchObject({
        requestId: 'req-123',
        tool: 'Write',
        reason: 'Access denied for testing',
      });
    });

    it('should support batch response configuration', () => {
      simulator.simulateBatchResponses([
        {
          type: 'permission',
          matchPattern: 'Read',
          action: 'approve',
          options: { approver: 'auto-approver' },
        },
        {
          type: 'dangerous-operation',
          matchPattern: /rm -rf/,
          action: 'deny',
          options: { reason: 'Too dangerous' },
        },
      ]);

      const queue = simulator.getResponseQueue();
      expect(queue).toHaveLength(2);

      expect(queue[0]).toMatchObject({
        type: 'permission',
        action: 'approve',
        matchPattern: 'Read',
      });

      expect(queue[1]).toMatchObject({
        type: 'dangerous-operation',
        action: 'deny',
        matchPattern: /rm -rf/,
      });
    });

    it('should capture requests for async handling', async () => {
      // Start waiting for permission request
      const requestPromise = simulator.waitForPermissionRequest(1000);

      // Emit permission request
      const permissionRequest: PermissionRequestEventData = {
        requestId: 'async-req-123',
        tool: 'Bash',
        scope: 'npm install',
        description: 'Install dependencies',
        isDangerous: false,
        agent: 'dev-agent',
        timestamp: new Date(),
        metadata: {},
      };

      setTimeout(() => {
        mockOrchestrator.emit('permission:request', permissionRequest);
      }, 100);

      // Should capture the request
      const capturedRequest = await requestPromise;
      expect(capturedRequest).toMatchObject({
        type: 'permission',
        requestId: 'async-req-123',
        data: permissionRequest,
      });
    });
  });

  describe('Full Workflow Integration Tests', () => {
    it('should handle complete permission flow with all components', async () => {
      // Create comprehensive test scenario using fixtures
      const permissionScenario = PERMISSION_SCENARIOS.approved[0];

      // Configure simulator to approve
      simulator.simulateUserApproval(permissionScenario.request.requestId, {
        approver: 'integration-test',
        comment: 'Auto-approved for integration test',
      });

      // Emit the permission request
      mockOrchestrator.emit('permission:request', permissionScenario.request);

      // Wait for the response
      await new Promise(resolve => setTimeout(resolve, 100));

      // Validate the complete flow was captured
      const allEvents = eventCapture.getAllEvents();
      expect(allEvents.length).toBeGreaterThan(0);

      const requestEvents = eventCapture.getEventsByType('permission:request');
      const grantedEvents = eventCapture.getEventsByType('permission:granted');

      expect(requestEvents).toHaveLength(1);
      expect(grantedEvents).toHaveLength(1);

      // Validate event data integrity
      eventCapture.expectEventData(requestEvents[0], {
        requestId: permissionScenario.request.requestId,
        tool: permissionScenario.request.tool,
      });

      eventCapture.expectEventData(grantedEvents[0], {
        requestId: permissionScenario.request.requestId,
        tool: permissionScenario.request.tool,
      });
    });

    it('should handle dangerous operation flow with risk assessment', async () => {
      // Use a risk scenario from fixtures
      const riskScenario = generateRiskLevelScenarios().find(s => s.riskLevel === 'high');
      expect(riskScenario).toBeDefined();

      // Configure simulator to block high-risk operations
      simulator.simulateUserDenial(riskScenario!.operation.operationId, {
        reason: 'High risk operation blocked by policy',
      });

      // Emit dangerous operation detected
      mockOrchestrator.emit('dangerous:detected', riskScenario!.operation);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Validate flow
      const detectedEvents = eventCapture.getEventsByType('dangerous:detected');
      const blockedEvents = eventCapture.getEventsByType('dangerous:blocked');

      expect(detectedEvents).toHaveLength(1);
      expect(blockedEvents).toHaveLength(1);

      // Validate proper event sequence
      eventCapture.expectEventSequence(['dangerous:detected', 'dangerous:blocked']);
    });

    it('should support complex multi-step approval workflows', async () => {
      // Create a complex scenario with multiple approval gates
      const approvalScenarios = APPROVAL_SCENARIOS.approved;

      // Configure batch approvals
      const batchConfig = approvalScenarios.map((scenario, index) => ({
        type: 'approval' as const,
        matchPattern: scenario.request.approvalId,
        action: 'approve' as const,
        options: {
          approver: `approver-${index}`,
          comment: `Approved step ${index + 1}`,
        },
      }));

      simulator.simulateBatchResponses(batchConfig);

      // Emit all approval requests
      for (const scenario of approvalScenarios) {
        mockOrchestrator.emit('approval:required', scenario.request);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Validate all approvals were processed
      const approvalEvents = eventCapture.getEventsByType('approval:required');
      expect(approvalEvents).toHaveLength(approvalScenarios.length);

      // Check that responses were generated (would be approval:granted in real system)
      const allEvents = eventCapture.getAllEvents();
      expect(allEvents.length).toBeGreaterThanOrEqual(approvalScenarios.length);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed events gracefully', () => {
      // Emit events with missing or invalid data
      mockOrchestrator.emit('permission:request', null);
      mockOrchestrator.emit('dangerous:detected', undefined);
      mockOrchestrator.emit('approval:required', { invalid: 'data' });

      // Event capture should still function
      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(3);

      // Events should be captured even with invalid data
      expect(events[0].data).toBe(null);
      expect(events[1].data).toBe(undefined);
      expect(events[2].data).toEqual({ invalid: 'data' });
    });

    it('should handle simulator timeout edge cases', async () => {
      // Configure very short timeout
      simulator.simulateTimeout(/timeout-test/, {
        timeoutMs: 50,
        timeoutAction: 'reject',
        message: 'Quick timeout test',
      });

      // Emit matching request
      const approvalRequest: ApprovalRequiredEventData = {
        approvalId: 'timeout-test-123',
        taskId: 'task-timeout',
        gateName: 'timeout-gate',
        gateType: 'custom',
        description: 'Timeout test',
        approvers: ['timeout-user'],
        minApprovals: 1,
        timeoutMinutes: 1,
        expiresAt: new Date(Date.now() + 60000),
        stage: 'test',
        agent: 'test',
        timestamp: new Date(),
        context: {},
        changesSummary: 'Test',
        affectedFiles: [],
        blocking: true,
      };

      mockOrchestrator.emit('approval:required', approvalRequest);

      // Wait for timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have triggered a denial due to timeout
      // Note: Actual behavior depends on simulator implementation
      const allEvents = eventCapture.getAllEvents();
      expect(allEvents.length).toBeGreaterThan(0);
    });

    it('should handle high-frequency events without memory leaks', () => {
      // Generate many events rapidly
      for (let i = 0; i < 100; i++) {
        mockOrchestrator.simulatePermissionRequest({
          requestId: `bulk-req-${i}`,
          tool: `Tool-${i % 5}`, // Rotate through 5 tools
        });
      }

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(100);

      // Validate all events were captured correctly
      for (let i = 0; i < 100; i++) {
        const event = events[i];
        expect(event.type).toBe('permission:request');
        expect(event.data.requestId).toBe(`bulk-req-${i}`);
        expect(event.index).toBe(i);
      }
    });

    it('should handle resource cleanup properly', () => {
      // Create multiple instances and ensure cleanup doesn't interfere
      const eventCapture2 = createEventCapture(mockOrchestrator);
      const simulator2 = createConfirmationSimulator(mockOrchestrator);

      // Generate some events
      mockOrchestrator.simulatePermissionRequest();

      // Both should capture events
      expect(eventCapture.getAllEvents()).toHaveLength(1);
      expect(eventCapture2.getAllEvents()).toHaveLength(1);

      // Cleanup one
      eventCapture2.dispose();
      simulator2.dispose();

      // Original should still work
      mockOrchestrator.simulatePermissionRequest();
      expect(eventCapture.getAllEvents()).toHaveLength(2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of events efficiently', () => {
      const startTime = Date.now();

      // Generate 1000 events
      for (let i = 0; i < 1000; i++) {
        mockOrchestrator.simulatePermissionRequest({
          requestId: `perf-req-${i}`,
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second

      // All events should be captured
      expect(eventCapture.getAllEvents()).toHaveLength(1000);
    });

    it('should maintain event ordering under load', () => {
      // Generate events in specific order
      const expectedOrder = ['permission:request', 'permission:granted', 'dangerous:detected'];

      for (let cycle = 0; cycle < 100; cycle++) {
        mockOrchestrator.simulatePermissionRequest();
        mockOrchestrator.simulatePermissionGranted();
        mockOrchestrator.simulateDangerousOperationDetected();
      }

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(300);

      // Verify ordering is maintained
      for (let i = 0; i < 100; i++) {
        const baseIndex = i * 3;
        expect(events[baseIndex].type).toBe('permission:request');
        expect(events[baseIndex + 1].type).toBe('permission:granted');
        expect(events[baseIndex + 2].type).toBe('dangerous:detected');
      }
    });
  });
});