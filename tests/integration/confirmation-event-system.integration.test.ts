/**
 * @fileoverview Integration Tests for Confirmation Event System
 *
 * This test suite validates the confirmation event system integration:
 * - Events are emitted via EventEmitter3 at correct lifecycle points
 * - Events contain proper payload data
 * - Event listeners receive confirmation requests in real-time
 * - Multiple listeners can subscribe to confirmation events
 * - Event ordering is preserved
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  ApprovalResolvedEventData,
  ApprovalResponseEventData,
  Task,
} from '@apexcli/core';

// Mock ApexOrchestrator class for testing event emission
class MockApexOrchestrator extends EventEmitter {
  private currentTask: Task | null = null;

  constructor() {
    super();
  }

  /**
   * Simulate an approval required event emission
   */
  emitApprovalRequired(data: Partial<ApprovalRequiredEventData> = {}): ApprovalRequiredEventData {
    const approvalData: ApprovalRequiredEventData = {
      approvalId: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId: `task_${Math.random().toString(36).substr(2, 9)}`,
      gateName: data.gateName || 'test-gate',
      gateType: data.gateType || 'manual',
      description: data.description || 'Test approval gate',
      approvers: data.approvers || ['test-user'],
      minApprovals: data.minApprovals || 1,
      timeoutMinutes: data.timeoutMinutes || 30,
      expiresAt: data.expiresAt || new Date(Date.now() + 30 * 60 * 1000),
      stage: data.stage || 'test-stage',
      agent: data.agent || 'test-agent',
      timestamp: data.timestamp || new Date(),
      context: data.context || {},
      changesSummary: data.changesSummary || 'Test changes',
      affectedFiles: data.affectedFiles || [],
      blocking: data.blocking ?? true,
      ...data,
    };

    this.emit('approval:required', approvalData);
    return approvalData;
  }

  /**
   * Simulate an approval granted event emission
   */
  emitApprovalGranted(data: Partial<ApprovalGrantedEventData> = {}): ApprovalGrantedEventData {
    const grantedData: ApprovalGrantedEventData = {
      approvalId: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId: `task_${Math.random().toString(36).substr(2, 9)}`,
      approver: data.approver || 'test-user',
      comment: data.comment || 'Approved for testing',
      timestamp: data.timestamp || new Date(),
      ...data,
    };

    this.emit('approval:granted', grantedData);
    return grantedData;
  }

  /**
   * Simulate an approval denied event emission
   */
  emitApprovalDenied(data: Partial<ApprovalDeniedEventData> = {}): ApprovalDeniedEventData {
    const deniedData: ApprovalDeniedEventData = {
      approvalId: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId: `task_${Math.random().toString(36).substr(2, 9)}`,
      approver: data.approver || 'test-user',
      reason: data.reason || 'Denied for testing',
      timestamp: data.timestamp || new Date(),
      ...data,
    };

    this.emit('approval:denied', deniedData);
    return deniedData;
  }

  /**
   * Simulate an approval resolved event emission
   */
  emitApprovalResolved(data: Partial<ApprovalResolvedEventData> = {}): ApprovalResolvedEventData {
    const resolvedData: ApprovalResolvedEventData = {
      approvalId: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId: `task_${Math.random().toString(36).substr(2, 9)}`,
      gateName: data.gateName || 'test-gate',
      resolution: data.resolution || 'approved',
      resolvedBy: data.resolvedBy || 'test-user',
      comment: data.comment || 'Resolved for testing',
      timestamp: data.timestamp || new Date(),
      requestedAt: data.requestedAt || new Date(Date.now() - 5000), // 5 seconds ago
      totalDurationMs: data.totalDurationMs || 5000,
      approvalsReceived: data.approvalsReceived || 1,
      approvalsRequired: data.approvalsRequired || 1,
      ...data,
    };

    this.emit('approval:resolved', resolvedData);
    return resolvedData;
  }

  /**
   * Simulate a complete approval lifecycle
   */
  simulateApprovalLifecycle(
    approvalId: string = `approval_${Date.now()}`,
    taskId: string = `task_${Date.now()}`
  ): {
    required: ApprovalRequiredEventData;
    granted: ApprovalGrantedEventData;
    resolved: ApprovalResolvedEventData;
  } {
    const requestedAt = new Date();

    // 1. Emit approval required
    const required = this.emitApprovalRequired({
      approvalId,
      taskId,
      timestamp: requestedAt,
    });

    // 2. Simulate delay for approval processing
    setTimeout(() => {
      // 3. Emit approval granted
      const granted = this.emitApprovalGranted({
        approvalId,
        taskId,
        timestamp: new Date(),
      });

      // 4. Emit approval resolved
      setTimeout(() => {
        const resolved = this.emitApprovalResolved({
          approvalId,
          taskId,
          requestedAt,
          timestamp: new Date(),
          totalDurationMs: Date.now() - requestedAt.getTime(),
        });
      }, 10);
    }, 10);

    return {
      required,
      granted: {
        approvalId,
        taskId,
        approver: 'test-user',
        comment: 'Approved for testing',
        timestamp: new Date(),
      },
      resolved: {
        approvalId,
        taskId,
        gateName: 'test-gate',
        resolution: 'approved',
        resolvedBy: 'test-user',
        comment: 'Resolved for testing',
        timestamp: new Date(),
        requestedAt,
        totalDurationMs: 0,
        approvalsReceived: 1,
        approvalsRequired: 1,
      },
    };
  }

  /**
   * Set current task for testing context
   */
  setCurrentTask(task: Task): void {
    this.currentTask = task;
  }

  /**
   * Get current task
   */
  getCurrentTask(): Task | null {
    return this.currentTask;
  }
}

/**
 * Event capture utility for testing
 */
class ConfirmationEventCapture {
  private events: Array<{ type: string; data: any; timestamp: Date }> = [];
  private emitter: EventEmitter;

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const eventTypes = [
      'approval:required',
      'approval:granted',
      'approval:denied',
      'approval:resolved',
      'approval:response',
    ];

    eventTypes.forEach(eventType => {
      this.emitter.on(eventType, (data) => {
        this.events.push({
          type: eventType,
          data,
          timestamp: new Date(),
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

  expectEventEmitted(eventType: string): void {
    const events = this.getEventsByType(eventType);
    expect(events.length).toBeGreaterThan(0);
  }

  expectEventSequence(eventTypes: string[]): void {
    let currentIndex = 0;
    for (const event of this.events) {
      if (event.type === eventTypes[currentIndex]) {
        currentIndex++;
        if (currentIndex === eventTypes.length) return;
      }
    }
    throw new Error(`Expected event sequence [${eventTypes.join(', ')}] not found in captured events: [${this.events.map(e => e.type).join(', ')}]`);
  }

  expectEventData(eventType: string, expectedData: Partial<any>): void {
    const event = this.getLastEventOfType(eventType);
    expect(event).toBeDefined();
    expect(event.data).toMatchObject(expectedData);
  }

  getEventCount(): number {
    return this.events.length;
  }

  clear(): void {
    this.events = [];
  }

  dispose(): void {
    this.emitter.removeAllListeners();
  }
}

describe('Confirmation Event System Integration', () => {
  let orchestrator: MockApexOrchestrator;
  let eventCapture: ConfirmationEventCapture;

  beforeEach(() => {
    orchestrator = new MockApexOrchestrator();
    eventCapture = new ConfirmationEventCapture(orchestrator);
  });

  afterEach(() => {
    eventCapture?.dispose();
    orchestrator?.removeAllListeners();
  });

  describe('Event Emission at Correct Lifecycle Points', () => {
    it('should emit approval:required event when approval is needed', () => {
      const approvalData = orchestrator.emitApprovalRequired({
        gateName: 'deploy-production',
        description: 'Deploy to production environment',
      });

      eventCapture.expectEventEmitted('approval:required');
      eventCapture.expectEventData('approval:required', {
        approvalId: approvalData.approvalId,
        gateName: 'deploy-production',
        description: 'Deploy to production environment',
      });
    });

    it('should emit approval:granted event when approval is given', () => {
      const grantedData = orchestrator.emitApprovalGranted({
        approver: 'admin-user',
        comment: 'Approved after security review',
      });

      eventCapture.expectEventEmitted('approval:granted');
      eventCapture.expectEventData('approval:granted', {
        approvalId: grantedData.approvalId,
        approver: 'admin-user',
        comment: 'Approved after security review',
      });
    });

    it('should emit approval:denied event when approval is rejected', () => {
      const deniedData = orchestrator.emitApprovalDenied({
        approver: 'security-team',
        reason: 'Security concerns identified',
      });

      eventCapture.expectEventEmitted('approval:denied');
      eventCapture.expectEventData('approval:denied', {
        approvalId: deniedData.approvalId,
        approver: 'security-team',
        reason: 'Security concerns identified',
      });
    });

    it('should emit approval:resolved event when approval process completes', () => {
      const resolvedData = orchestrator.emitApprovalResolved({
        resolution: 'approved',
        resolvedBy: 'team-lead',
        comment: 'All requirements met',
      });

      eventCapture.expectEventEmitted('approval:resolved');
      eventCapture.expectEventData('approval:resolved', {
        approvalId: resolvedData.approvalId,
        resolution: 'approved',
        resolvedBy: 'team-lead',
        comment: 'All requirements met',
      });
    });
  });

  describe('Event Payload Data Validation', () => {
    it('should include all required fields in approval:required events', () => {
      const approvalData = orchestrator.emitApprovalRequired({
        gateName: 'code-review',
        description: 'Code review required',
        approvers: ['reviewer1', 'reviewer2'],
        minApprovals: 2,
        timeoutMinutes: 60,
        blocking: true,
      });

      const event = eventCapture.getLastEventOfType('approval:required');
      expect(event.data).toMatchObject({
        approvalId: expect.stringMatching(/^approval_/),
        taskId: expect.stringMatching(/^task_/),
        gateName: 'code-review',
        gateType: 'manual',
        description: 'Code review required',
        approvers: ['reviewer1', 'reviewer2'],
        minApprovals: 2,
        timeoutMinutes: 60,
        expiresAt: expect.any(Date),
        stage: expect.any(String),
        agent: expect.any(String),
        timestamp: expect.any(Date),
        context: expect.any(Object),
        blocking: true,
      });

      // Validate timestamp is recent
      const timeDiff = Date.now() - event.data.timestamp.getTime();
      expect(timeDiff).toBeLessThan(1000);

      // Validate expiry is in the future
      expect(event.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should include all required fields in approval:granted events', () => {
      const grantedData = orchestrator.emitApprovalGranted({
        approver: 'team-member',
        comment: 'LGTM - looks good to me',
      });

      const event = eventCapture.getLastEventOfType('approval:granted');
      expect(event.data).toMatchObject({
        approvalId: expect.stringMatching(/^approval_/),
        taskId: expect.stringMatching(/^task_/),
        approver: 'team-member',
        comment: 'LGTM - looks good to me',
        timestamp: expect.any(Date),
      });

      // Validate timestamp is recent
      const timeDiff = Date.now() - event.data.timestamp.getTime();
      expect(timeDiff).toBeLessThan(1000);
    });

    it('should include all required fields in approval:denied events', () => {
      const deniedData = orchestrator.emitApprovalDenied({
        approver: 'quality-assurance',
        reason: 'Tests failing on critical path',
      });

      const event = eventCapture.getLastEventOfType('approval:denied');
      expect(event.data).toMatchObject({
        approvalId: expect.stringMatching(/^approval_/),
        taskId: expect.stringMatching(/^task_/),
        approver: 'quality-assurance',
        reason: 'Tests failing on critical path',
        timestamp: expect.any(Date),
      });

      // Validate reason is mandatory for denials
      expect(event.data.reason).toBeDefined();
      expect(event.data.reason).toHaveLength.greaterThan(0);
    });

    it('should include all required fields in approval:resolved events', () => {
      const requestedAt = new Date(Date.now() - 10000); // 10 seconds ago
      const resolvedData = orchestrator.emitApprovalResolved({
        resolution: 'timeout',
        comment: 'Approval timed out after 30 minutes',
        requestedAt,
        totalDurationMs: 10000,
        approvalsReceived: 0,
        approvalsRequired: 1,
      });

      const event = eventCapture.getLastEventOfType('approval:resolved');
      expect(event.data).toMatchObject({
        approvalId: expect.stringMatching(/^approval_/),
        taskId: expect.stringMatching(/^task_/),
        gateName: expect.any(String),
        resolution: 'timeout',
        comment: 'Approval timed out after 30 minutes',
        timestamp: expect.any(Date),
        requestedAt: requestedAt,
        totalDurationMs: 10000,
        approvalsReceived: 0,
        approvalsRequired: 1,
      });

      // Validate duration calculation
      expect(event.data.totalDurationMs).toBe(10000);
      expect(event.data.requestedAt).toEqual(requestedAt);
    });
  });

  describe('Real-time Event Listener Reception', () => {
    it('should deliver events to listeners in real-time', async () => {
      let receivedEvent: any = null;
      let receivedTimestamp: Date | null = null;

      // Set up listener
      orchestrator.on('approval:required', (data) => {
        receivedEvent = data;
        receivedTimestamp = new Date();
      });

      const emitTimestamp = new Date();
      orchestrator.emitApprovalRequired({
        gateName: 'realtime-test',
      });

      // Event should be received immediately
      expect(receivedEvent).toBeTruthy();
      expect(receivedEvent.gateName).toBe('realtime-test');
      expect(receivedTimestamp).toBeTruthy();

      // Reception should be very fast (within a few milliseconds)
      const receptionDelay = receivedTimestamp!.getTime() - emitTimestamp.getTime();
      expect(receptionDelay).toBeLessThan(100); // Less than 100ms
    });

    it('should deliver events asynchronously without blocking', async () => {
      const startTime = Date.now();
      let listenerCallCount = 0;

      // Set up listener that takes some time
      orchestrator.on('approval:granted', () => {
        listenerCallCount++;
        // Simulate some processing time
        const endTime = Date.now() + 50; // 50ms delay
        while (Date.now() < endTime) {
          // Busy wait
        }
      });

      // Emit multiple events rapidly
      for (let i = 0; i < 5; i++) {
        orchestrator.emitApprovalGranted({
          approver: `user-${i}`,
        });
      }

      const emitTime = Date.now() - startTime;
      expect(emitTime).toBeLessThan(100); // Emit should be fast despite slow listener

      // Wait for listeners to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(listenerCallCount).toBe(5);
    });
  });

  describe('Multiple Listener Support', () => {
    it('should support multiple listeners for the same event type', () => {
      let listener1Called = false;
      let listener2Called = false;
      let listener3Called = false;
      const receivedData: any[] = [];

      // Register multiple listeners
      orchestrator.on('approval:required', (data) => {
        listener1Called = true;
        receivedData.push({ listener: 1, data });
      });

      orchestrator.on('approval:required', (data) => {
        listener2Called = true;
        receivedData.push({ listener: 2, data });
      });

      orchestrator.on('approval:required', (data) => {
        listener3Called = true;
        receivedData.push({ listener: 3, data });
      });

      // Emit event
      const approvalData = orchestrator.emitApprovalRequired({
        gateName: 'multi-listener-test',
      });

      // All listeners should be called
      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
      expect(listener3Called).toBe(true);

      // All should receive the same data
      expect(receivedData).toHaveLength(3);
      receivedData.forEach(entry => {
        expect(entry.data).toMatchObject({
          approvalId: approvalData.approvalId,
          gateName: 'multi-listener-test',
        });
      });
    });

    it('should support listeners for different event types', () => {
      const receivedEvents: Array<{ type: string; data: any }> = [];

      // Register listeners for different event types
      orchestrator.on('approval:required', (data) => {
        receivedEvents.push({ type: 'required', data });
      });

      orchestrator.on('approval:granted', (data) => {
        receivedEvents.push({ type: 'granted', data });
      });

      orchestrator.on('approval:denied', (data) => {
        receivedEvents.push({ type: 'denied', data });
      });

      // Emit different event types
      orchestrator.emitApprovalRequired({ gateName: 'test-gate-1' });
      orchestrator.emitApprovalGranted({ approver: 'test-user-1' });
      orchestrator.emitApprovalDenied({ reason: 'test-reason-1' });

      // Should have received all events
      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents[0]).toMatchObject({
        type: 'required',
        data: { gateName: 'test-gate-1' },
      });
      expect(receivedEvents[1]).toMatchObject({
        type: 'granted',
        data: { approver: 'test-user-1' },
      });
      expect(receivedEvents[2]).toMatchObject({
        type: 'denied',
        data: { reason: 'test-reason-1' },
      });
    });

    it('should support listener removal', () => {
      let listenerCallCount = 0;

      const listener = () => {
        listenerCallCount++;
      };

      // Add listener
      orchestrator.on('approval:granted', listener);

      // Emit event - should be received
      orchestrator.emitApprovalGranted();
      expect(listenerCallCount).toBe(1);

      // Remove listener
      orchestrator.off('approval:granted', listener);

      // Emit event again - should not be received
      orchestrator.emitApprovalGranted();
      expect(listenerCallCount).toBe(1);
    });
  });

  describe('Event Ordering Preservation', () => {
    it('should preserve event order in single-threaded emission', () => {
      const eventOrder: string[] = [];

      // Set up listeners to track order
      orchestrator.on('approval:required', () => eventOrder.push('required'));
      orchestrator.on('approval:granted', () => eventOrder.push('granted'));
      orchestrator.on('approval:denied', () => eventOrder.push('denied'));
      orchestrator.on('approval:resolved', () => eventOrder.push('resolved'));

      // Emit events in specific order
      orchestrator.emitApprovalRequired();
      orchestrator.emitApprovalGranted();
      orchestrator.emitApprovalDenied();
      orchestrator.emitApprovalResolved();

      // Order should be preserved
      expect(eventOrder).toEqual(['required', 'granted', 'denied', 'resolved']);
    });

    it('should maintain order during rapid sequential emissions', () => {
      const receivedOrder: Array<{ type: string; index: number }> = [];

      orchestrator.on('approval:granted', (data) => {
        const match = data.approver.match(/user-(\d+)/);
        if (match) {
          receivedOrder.push({ type: 'granted', index: parseInt(match[1]) });
        }
      });

      // Emit 10 events rapidly
      for (let i = 0; i < 10; i++) {
        orchestrator.emitApprovalGranted({ approver: `user-${i}` });
      }

      // Should maintain order
      expect(receivedOrder).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(receivedOrder[i]).toEqual({ type: 'granted', index: i });
      }
    });

    it('should preserve order in complete approval lifecycle', async () => {
      const lifecycleOrder: string[] = [];
      const approvalId = 'lifecycle-test-approval';

      // Set up listeners to track lifecycle
      orchestrator.on('approval:required', (data) => {
        if (data.approvalId === approvalId) {
          lifecycleOrder.push('required');
        }
      });

      orchestrator.on('approval:granted', (data) => {
        if (data.approvalId === approvalId) {
          lifecycleOrder.push('granted');
        }
      });

      orchestrator.on('approval:resolved', (data) => {
        if (data.approvalId === approvalId) {
          lifecycleOrder.push('resolved');
        }
      });

      // Simulate approval lifecycle
      orchestrator.simulateApprovalLifecycle(approvalId);

      // Wait for async lifecycle events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should follow correct order
      expect(lifecycleOrder).toEqual(['required', 'granted', 'resolved']);
    });
  });

  describe('EventEmitter3 Specific Features', () => {
    it('should support once() listeners for single-use subscriptions', () => {
      let callCount = 0;
      let receivedData: any = null;

      // Register once listener
      orchestrator.once('approval:required', (data) => {
        callCount++;
        receivedData = data;
      });

      // Emit first event - should be received
      const firstData = orchestrator.emitApprovalRequired({ gateName: 'once-test-1' });
      expect(callCount).toBe(1);
      expect(receivedData).toMatchObject({ gateName: 'once-test-1' });

      // Emit second event - should not be received
      orchestrator.emitApprovalRequired({ gateName: 'once-test-2' });
      expect(callCount).toBe(1); // Still 1, not 2
      expect(receivedData.gateName).toBe('once-test-1'); // Still first data
    });

    it('should support event listener limit checking', () => {
      const originalMaxListeners = orchestrator.getMaxListeners();

      // Set a low limit for testing
      orchestrator.setMaxListeners(3);

      // Add listeners up to the limit
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      orchestrator.on('approval:granted', listener1);
      orchestrator.on('approval:granted', listener2);
      orchestrator.on('approval:granted', listener3);

      // Should not trigger warning yet
      expect(orchestrator.listenerCount('approval:granted')).toBe(3);

      // Restore original limit
      orchestrator.setMaxListeners(originalMaxListeners);
    });

    it('should support prependListener for listener ordering', () => {
      const callOrder: number[] = [];

      // Add normal listeners
      orchestrator.on('approval:denied', () => callOrder.push(1));
      orchestrator.on('approval:denied', () => callOrder.push(2));

      // Prepend listener (should be called first)
      orchestrator.prependListener('approval:denied', () => callOrder.push(0));

      // Emit event
      orchestrator.emitApprovalDenied();

      // Prepended listener should be called first
      expect(callOrder).toEqual([0, 1, 2]);
    });

    it('should support removeAllListeners for cleanup', () => {
      let callCount = 0;

      // Add multiple listeners
      orchestrator.on('approval:resolved', () => callCount++);
      orchestrator.on('approval:resolved', () => callCount++);
      orchestrator.on('approval:resolved', () => callCount++);

      // Emit event - all should be called
      orchestrator.emitApprovalResolved();
      expect(callCount).toBe(3);

      // Remove all listeners
      orchestrator.removeAllListeners('approval:resolved');

      // Emit event again - none should be called
      orchestrator.emitApprovalResolved();
      expect(callCount).toBe(3); // Still 3, not 6
    });
  });

  describe('Error Handling in Event System', () => {
    it('should handle listener errors without stopping other listeners', () => {
      let successfulListenerCalled = false;
      let errorThrownListenerCalled = false;

      // Add listener that throws error
      orchestrator.on('approval:granted', () => {
        errorThrownListenerCalled = true;
        throw new Error('Test error in listener');
      });

      // Add successful listener
      orchestrator.on('approval:granted', () => {
        successfulListenerCalled = true;
      });

      // Emit event - should not throw and both listeners should be called
      expect(() => {
        orchestrator.emitApprovalGranted();
      }).not.toThrow();

      expect(errorThrownListenerCalled).toBe(true);
      expect(successfulListenerCalled).toBe(true);
    });

    it('should handle malformed event data gracefully', () => {
      let receivedData: any = null;

      orchestrator.on('approval:required', (data) => {
        receivedData = data;
      });

      // Emit event with invalid/partial data
      orchestrator.emit('approval:required', { invalid: 'data', missing: 'required fields' });

      // Should still receive the data
      expect(receivedData).toEqual({ invalid: 'data', missing: 'required fields' });
    });
  });
});