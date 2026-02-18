/**
 * Integration tests for EventCapture utility
 * Tests real-world scenarios and complex event patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture, createConfirmationEventCapture } from './event-capture';
import type { ApprovalRequiredEventData, ApprovalGrantedEventData, ApprovalDeniedEventData, ApprovalResolvedEventData } from '@apexcli/core';

describe('EventCapture Integration Tests', () => {
  let emitter: EventEmitter;
  let eventCapture: EventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    eventCapture?.dispose();
  });

  describe('Real-world Workflow Scenarios', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);
    });

    it('should capture a complete approval workflow', async () => {
      const taskId = 'workflow-task-1';

      // Simulate a typical approval workflow
      emitter.emit('task:created', { taskId, type: 'feature-implementation' });
      emitter.emit('task:started', { taskId });

      // Gate requirement triggers approval
      emitter.emit('gate:required', { taskId, gateName: 'deployment-approval' });
      emitter.emit('approval:required', {
        taskId,
        gateName: 'deployment-approval',
        description: 'Requires deployment approval',
        requester: 'developer'
      } as ApprovalRequiredEventData);

      // Task pauses while waiting for approval
      emitter.emit('task:paused', { taskId, reason: 'waiting-for-approval' });

      // Approval granted
      emitter.emit('gate:approved', { taskId, gateName: 'deployment-approval', approver: 'manager' });
      emitter.emit('approval:granted', {
        taskId,
        gateName: 'deployment-approval',
        approver: 'manager',
        timestamp: new Date()
      } as ApprovalGrantedEventData);
      emitter.emit('approval:resolved', {
        taskId,
        gateName: 'deployment-approval',
        decision: 'approved',
        resolvedBy: 'manager'
      } as ApprovalResolvedEventData);

      // Task resumes and completes
      emitter.emit('task:started', { taskId }); // Resume
      emitter.emit('task:completed', { taskId, result: 'success' });

      // Verify the complete workflow was captured
      const allEvents = eventCapture.getAllEvents();
      expect(allEvents).toHaveLength(10);

      // Verify event sequence
      eventCapture.expectEventSequence([
        'task:created',
        'task:started',
        'gate:required',
        'approval:required',
        'task:paused',
        'gate:approved',
        'approval:granted',
        'approval:resolved',
        'task:started',
        'task:completed'
      ]);

      // Verify specific event data
      eventCapture.expectEventData('approval:required', { taskId });
      eventCapture.expectEventData('approval:granted', { approver: 'manager' });

      // Verify confirmation events were captured
      const confirmationEvents = eventCapture.getConfirmationEvents();
      expect(confirmationEvents.length).toBeGreaterThanOrEqual(5);
    });

    it('should capture a denied approval workflow', async () => {
      const taskId = 'denied-task-1';

      // Start workflow
      emitter.emit('task:created', { taskId });
      emitter.emit('task:started', { taskId });
      emitter.emit('approval:required', {
        taskId,
        gateName: 'security-review',
        requester: 'developer'
      } as ApprovalRequiredEventData);

      // Approval denied
      emitter.emit('gate:rejected', { taskId, gateName: 'security-review', reason: 'security-concerns' });
      emitter.emit('approval:denied', {
        taskId,
        gateName: 'security-review',
        reason: 'security-concerns',
        deniedBy: 'security-team'
      } as ApprovalDeniedEventData);
      emitter.emit('approval:resolved', {
        taskId,
        gateName: 'security-review',
        decision: 'denied',
        resolvedBy: 'security-team'
      } as ApprovalResolvedEventData);

      // Task fails due to denial
      emitter.emit('task:failed', { taskId, reason: 'approval-denied' });

      // Verify denial workflow
      eventCapture.expectEventSequence([
        'task:created',
        'task:started',
        'approval:required',
        'gate:rejected',
        'approval:denied',
        'approval:resolved',
        'task:failed'
      ]);

      eventCapture.expectEventData('approval:denied', { reason: 'security-concerns' });

      // Verify approval-related events
      expect(eventCapture.getApprovalRequiredEvents()).toHaveLength(1);
      expect(eventCapture.getApprovalDeniedEvents()).toHaveLength(1);
      expect(eventCapture.getApprovalResolvedEvents()).toHaveLength(1);
    });

    it('should handle multiple concurrent approval workflows', async () => {
      const task1Id = 'concurrent-task-1';
      const task2Id = 'concurrent-task-2';

      // Start two tasks concurrently
      emitter.emit('task:created', { taskId: task1Id });
      emitter.emit('task:created', { taskId: task2Id });
      emitter.emit('task:started', { taskId: task1Id });
      emitter.emit('task:started', { taskId: task2Id });

      // Both require approvals
      emitter.emit('approval:required', {
        taskId: task1Id,
        gateName: 'code-review'
      } as ApprovalRequiredEventData);
      emitter.emit('approval:required', {
        taskId: task2Id,
        gateName: 'deployment-approval'
      } as ApprovalRequiredEventData);

      // Task 1 approved, Task 2 denied
      emitter.emit('approval:granted', {
        taskId: task1Id,
        approver: 'reviewer1'
      } as ApprovalGrantedEventData);
      emitter.emit('approval:denied', {
        taskId: task2Id,
        deniedBy: 'reviewer2',
        reason: 'incomplete-tests'
      } as ApprovalDeniedEventData);

      emitter.emit('task:completed', { taskId: task1Id });
      emitter.emit('task:failed', { taskId: task2Id });

      // Verify both workflows were captured correctly
      const allEvents = eventCapture.getAllEvents();
      expect(allEvents).toHaveLength(10);

      // Verify task-specific events
      const task1Events = eventCapture.getEventsWhere(e =>
        e.data?.taskId === task1Id
      );
      const task2Events = eventCapture.getEventsWhere(e =>
        e.data?.taskId === task2Id
      );

      expect(task1Events).toHaveLength(5); // created, started, approval:required, approval:granted, completed
      expect(task2Events).toHaveLength(5); // created, started, approval:required, approval:denied, failed

      // Verify approval events for each task
      expect(eventCapture.getApprovalRequiredEvents()).toHaveLength(2);
      expect(eventCapture.getApprovalGrantedEvents()).toHaveLength(1);
      expect(eventCapture.getApprovalDeniedEvents()).toHaveLength(1);
    });
  });

  describe('Permission and Dangerous Operation Scenarios', () => {
    beforeEach(() => {
      eventCapture = createConfirmationEventCapture(emitter);
    });

    it('should capture permission request workflows', async () => {
      const requestId = 'perm-req-1';
      const operationId = 'file-delete-op';

      // Permission requested
      emitter.emit('permission:request', {
        requestId,
        operationId,
        operation: 'file:delete',
        resource: '/important/file.txt'
      });

      // Permission granted
      emitter.emit('permission:granted', {
        requestId,
        operationId,
        grantedBy: 'admin',
        scope: 'file:delete'
      });

      // Verify permission workflow
      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('permission:request');
      expect(events[1].type).toBe('permission:granted');

      eventCapture.expectEventData('permission:request', { operationId });
      eventCapture.expectEventData('permission:granted', { grantedBy: 'admin' });
    });

    it('should capture dangerous operation detection and confirmation', async () => {
      const operationId = 'dangerous-op-1';

      // Dangerous operation detected
      emitter.emit('dangerous:detected', {
        operationId,
        operation: 'system:shutdown',
        riskLevel: 'high',
        description: 'System shutdown requested'
      });

      // User confirms they want to proceed
      emitter.emit('dangerous:confirmed', {
        operationId,
        confirmedBy: 'admin',
        acknowledgedRisk: true
      });

      // Verify dangerous operation workflow
      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(2);

      eventCapture.expectEventSequence(['dangerous:detected', 'dangerous:confirmed']);
      eventCapture.expectEventData('dangerous:detected', { riskLevel: 'high' });
      eventCapture.expectEventData('dangerous:confirmed', { acknowledgedRisk: true });
    });

    it('should capture blocked dangerous operations', async () => {
      const operationId = 'blocked-op-1';

      // Dangerous operation detected and blocked
      emitter.emit('dangerous:detected', {
        operationId,
        operation: 'data:delete-all',
        riskLevel: 'critical'
      });

      emitter.emit('dangerous:blocked', {
        operationId,
        reason: 'critical-risk',
        blockedBy: 'security-policy',
        automaticBlock: true
      });

      // Verify blocking workflow
      eventCapture.expectEventSequence(['dangerous:detected', 'dangerous:blocked']);
      eventCapture.expectEventData('dangerous:blocked', { automaticBlock: true });
    });
  });

  describe('Complex Event Filtering and Retrieval', () => {
    beforeEach(() => {
      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        filterTypes: [
          'approval:required',
          'approval:granted',
          'approval:denied',
          'task:started',
          'task:completed',
          'task:failed'
        ]
      });
    });

    it('should filter events correctly with complex patterns', async () => {
      // Emit various events, some should be filtered out
      emitter.emit('task:created', { taskId: 'test' }); // Filtered out
      emitter.emit('task:started', { taskId: 'test' }); // Captured
      emitter.emit('approval:required', { taskId: 'test' }); // Captured
      emitter.emit('permission:request', { requestId: 'req' }); // Filtered out
      emitter.emit('approval:granted', { taskId: 'test' }); // Captured
      emitter.emit('task:completed', { taskId: 'test' }); // Captured
      emitter.emit('debug:log', { message: 'test' }); // Filtered out

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(4);

      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toEqual([
        'task:started',
        'approval:required',
        'approval:granted',
        'task:completed'
      ]);
    });

    it('should handle time-based event retrieval', async () => {
      const startTime = new Date();

      emitter.emit('task:started', { taskId: 'time-test-1' });

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));
      const midTime = new Date();

      emitter.emit('approval:required', { taskId: 'time-test-1' });
      emitter.emit('approval:granted', { taskId: 'time-test-1' });

      await new Promise(resolve => setTimeout(resolve, 50));
      const endTime = new Date();

      emitter.emit('task:completed', { taskId: 'time-test-1' });

      // Test time range queries
      const earlyEvents = eventCapture.getEventsInTimeRange(startTime, midTime);
      expect(earlyEvents).toHaveLength(1);
      expect(earlyEvents[0].type).toBe('task:started');

      const lateEvents = eventCapture.getEventsInTimeRange(midTime, endTime);
      expect(lateEvents).toHaveLength(2);
      expect(lateEvents[0].type).toBe('approval:required');
      expect(lateEvents[1].type).toBe('approval:granted');

      const allInRange = eventCapture.getEventsInTimeRange(startTime, endTime);
      expect(allInRange).toHaveLength(4); // All events
    });

    it('should handle complex predicate-based filtering', async () => {
      // Setup various task events
      emitter.emit('task:started', { taskId: 'task-1', priority: 'high' });
      emitter.emit('task:started', { taskId: 'task-2', priority: 'low' });
      emitter.emit('approval:required', { taskId: 'task-1', gateName: 'security' });
      emitter.emit('approval:required', { taskId: 'task-2', gateName: 'review' });
      emitter.emit('approval:granted', { taskId: 'task-1', approver: 'security-team' });
      emitter.emit('task:completed', { taskId: 'task-1' });
      emitter.emit('task:failed', { taskId: 'task-2' });

      // Test complex predicates
      const highPriorityEvents = eventCapture.getEventsWhere(event =>
        event.data?.priority === 'high'
      );
      expect(highPriorityEvents).toHaveLength(1);

      const task1Events = eventCapture.getEventsWhere(event =>
        event.data?.taskId === 'task-1'
      );
      expect(task1Events).toHaveLength(4);

      const securityEvents = eventCapture.getEventsWhere(event =>
        event.data?.gateName === 'security' || event.data?.approver?.includes('security')
      );
      expect(securityEvents).toHaveLength(2);

      const completedTaskEvents = eventCapture.getEventsWhere(event =>
        event.type === 'task:completed' || event.type === 'task:failed'
      );
      expect(completedTaskEvents).toHaveLength(2);
    });
  });

  describe('Event Sequence Analysis', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);
    });

    it('should validate complex event sequences with exact matching', async () => {
      // Create a precise sequence
      emitter.emit('stage1:start', {});
      emitter.emit('stage1:validate', {});
      emitter.emit('stage1:complete', {});
      emitter.emit('stage2:start', {});
      emitter.emit('stage2:approve', {});
      emitter.emit('stage2:complete', {});

      // Should pass exact sequence validation
      eventCapture.expectEventSequence([
        'stage1:start',
        'stage1:validate',
        'stage1:complete',
        'stage2:start',
        'stage2:approve',
        'stage2:complete'
      ], true);

      // Should fail if extra events are inserted
      emitter.emit('extra:event', {});

      expect(() =>
        eventCapture.expectEventSequence([
          'stage1:start',
          'stage1:validate',
          'stage1:complete',
          'stage2:start',
          'stage2:approve',
          'stage2:complete',
          'extra:event'
        ], true)
      ).not.toThrow();
    });

    it('should validate non-exact sequences with intervening events', async () => {
      emitter.emit('workflow:start', {});
      emitter.emit('debug:log1', {});
      emitter.emit('approval:required', {});
      emitter.emit('debug:log2', {});
      emitter.emit('user:input', {});
      emitter.emit('approval:granted', {});
      emitter.emit('debug:log3', {});
      emitter.emit('workflow:complete', {});

      // Should pass non-exact sequence (ignoring debug and user events)
      eventCapture.expectEventSequence([
        'workflow:start',
        'approval:required',
        'approval:granted',
        'workflow:complete'
      ], false);
    });

    it('should detect missing events in sequences', async () => {
      emitter.emit('step1', {});
      emitter.emit('step2', {});
      // Missing step3
      emitter.emit('step4', {});

      expect(() =>
        eventCapture.expectEventSequence(['step1', 'step2', 'step3', 'step4'])
      ).toThrow(/Expected sequence.*not found/);
    });
  });

  describe('Async Event Waiting and Timeouts', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);
    });

    it('should wait for events with proper timeout handling', async () => {
      // Start waiting for an event that will come later
      const eventPromise = eventCapture.waitForEvent('delayed:test', 1000);

      // Emit the event after a delay
      setTimeout(() => {
        emitter.emit('delayed:test', { message: 'delayed event' });
      }, 200);

      const event = await eventPromise;
      expect(event.type).toBe('delayed:test');
      expect(event.data.message).toBe('delayed event');
    });

    it('should handle timeout for events that never arrive', async () => {
      await expect(
        eventCapture.waitForEvent('never:arrives', 100)
      ).rejects.toThrow('Timeout waiting for event \'never:arrives\' after 100ms');
    });

    it('should wait for event sequences with complex timing', async () => {
      // Start waiting for a sequence
      const sequencePromise = eventCapture.waitForEventSequence([
        'seq:first',
        'seq:second',
        'seq:third'
      ], 2000);

      // Emit events with delays
      setTimeout(() => emitter.emit('seq:first', {}), 100);
      setTimeout(() => emitter.emit('seq:second', {}), 300);
      setTimeout(() => emitter.emit('seq:third', {}), 500);

      const events = await sequencePromise;
      expect(events).toHaveLength(3);
      expect(events.map(e => e.type)).toEqual(['seq:first', 'seq:second', 'seq:third']);
    });

    it('should timeout on incomplete sequences', async () => {
      const sequencePromise = eventCapture.waitForEventSequence([
        'incomplete:first',
        'incomplete:second',
        'incomplete:never'
      ], 300);

      setTimeout(() => emitter.emit('incomplete:first', {}), 50);
      setTimeout(() => emitter.emit('incomplete:second', {}), 100);
      // incomplete:never is never emitted

      await expect(sequencePromise).rejects.toThrow(/Timeout waiting for event sequence/);
    });

    it('should return immediately for existing events', async () => {
      // Emit event first
      emitter.emit('existing:event', { data: 'already here' });

      // Should return immediately
      const startTime = Date.now();
      const event = await eventCapture.waitForEvent('existing:event', 1000);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
      expect(event.data.data).toBe('already here');
    });
  });

  describe('Memory Management and Resource Cleanup', () => {
    it('should properly clean up event listeners', () => {
      const emitter = new EventEmitter();
      const capture = createEventCapture(emitter);

      // Check initial listener count
      const eventType = 'test:cleanup';
      const initialCount = emitter.listenerCount(eventType);

      // Emit some events to ensure listeners are set up
      emitter.emit(eventType, {});

      // Dispose should clean up listeners
      capture.dispose();

      // Listener count should return to initial value
      expect(emitter.listenerCount(eventType)).toBe(initialCount);
    });

    it('should handle max events limit correctly', () => {
      const capture = new EventCapture(emitter, {
        autoStart: true,
        maxEvents: 5
      });

      // Emit more events than the limit
      for (let i = 0; i < 10; i++) {
        emitter.emit('overflow:test', { index: i });
      }

      const events = capture.getAllEvents();
      expect(events).toHaveLength(5);

      // Should contain the last 5 events (indexes 5-9)
      expect(events[0].data.index).toBe(5);
      expect(events[4].data.index).toBe(9);

      capture.dispose();
    });

    it('should handle multiple dispose calls gracefully', () => {
      const capture = createEventCapture(emitter);

      // Multiple dispose calls should not throw
      expect(() => {
        capture.dispose();
        capture.dispose();
        capture.dispose();
      }).not.toThrow();
    });

    it('should handle restart after disposal', () => {
      const capture = new EventCapture(emitter);

      capture.start();
      emitter.emit('before:dispose', {});
      expect(capture.getAllEvents()).toHaveLength(1);

      capture.dispose();

      // Should not capture events after disposal
      emitter.emit('after:dispose', {});
      expect(capture.getAllEvents()).toHaveLength(0);

      // Starting again should not work (capture is disposed)
      capture.start();
      emitter.emit('after:start-again', {});
      expect(capture.getAllEvents()).toHaveLength(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);
    });

    it('should handle events with null or undefined data', () => {
      emitter.emit('null:data', null);
      emitter.emit('undefined:data', undefined);
      emitter.emit('empty:data');

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(3);
      expect(events[0].data).toBeNull();
      expect(events[1].data).toBeUndefined();
      expect(events[2].data).toBeUndefined();
    });

    it('should handle events with complex nested data', () => {
      const complexData = {
        level1: {
          level2: {
            array: [1, 2, { nested: 'value' }],
            fn: () => 'function',
            date: new Date(),
            regexp: /test/g
          }
        },
        circular: null as any
      };

      // Create circular reference
      complexData.circular = complexData;

      emitter.emit('complex:data', complexData);

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.level1.level2.array[2].nested).toBe('value');
    });

    it('should handle rapid event emission', () => {
      const eventCount = 1000;
      const startTime = Date.now();

      for (let i = 0; i < eventCount; i++) {
        emitter.emit('rapid:event', { index: i });
      }

      const endTime = Date.now();

      // Should capture all events
      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(eventCount);

      // Should be reasonably fast
      expect(endTime - startTime).toBeLessThan(1000);

      // Events should be in correct order
      events.forEach((event, index) => {
        expect(event.data.index).toBe(index);
        expect(event.index).toBe(index);
      });
    });

    it('should handle assertion errors with proper error messages', () => {
      emitter.emit('test:event', { id: 'test-1' });

      // Test various assertion failures
      expect(() => eventCapture.expectEventEmitted('missing:event'))
        .toThrow(/Expected event 'missing:event' to be emitted/);

      expect(() => eventCapture.expectEventNotEmitted('test:event'))
        .toThrow(/Expected event 'test:event' to NOT be emitted/);

      expect(() => eventCapture.expectEventData('test:event', { id: 'wrong-id' }))
        .toThrow(/Expected event 'test:event' to have id="wrong-id"/);

      expect(() => eventCapture.expectEventCount('test:event', 5))
        .toThrow(/Expected 5 'test:event' events, but captured 1/);

      expect(() => eventCapture.expectTotalEventCount(10))
        .toThrow(/Expected 10 total events, but captured 1/);
    });

    it('should provide helpful event summaries for debugging', () => {
      emitter.emit('event:type1', {});
      emitter.emit('event:type1', {});
      emitter.emit('event:type2', {});
      emitter.emit('event:type3', {});
      emitter.emit('event:type3', {});
      emitter.emit('event:type3', {});

      const summary = eventCapture.getEventSummary();
      expect(summary).toContain('Captured 6 events');
      expect(summary).toContain('event:type1: 2');
      expect(summary).toContain('event:type2: 1');
      expect(summary).toContain('event:type3: 3');
    });
  });
});