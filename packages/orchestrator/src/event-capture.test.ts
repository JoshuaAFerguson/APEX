/**
 * Test suite for EventCapture utility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture, createConfirmationEventCapture } from '../tests/utils/event-capture';
import type { ApprovalRequiredEventData, ApprovalGrantedEventData } from '@apexcli/core';

describe('EventCapture', () => {
  let emitter: EventEmitter;
  let eventCapture: EventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    eventCapture?.dispose();
  });

  describe('Basic Event Capture', () => {
    beforeEach(() => {
      eventCapture = new EventCapture(emitter, { autoStart: true });
    });

    it('should capture events when started', () => {
      emitter.emit('test:event', { id: 'test-1' });
      emitter.emit('test:event2', { id: 'test-2' });

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('test:event');
      expect(events[0].data).toEqual({ id: 'test-1' });
      expect(events[1].type).toBe('test:event2');
      expect(events[1].data).toEqual({ id: 'test-2' });
    });

    it('should include timestamps and indexes', () => {
      const beforeTime = new Date();
      emitter.emit('test:event', { data: 'test' });
      const afterTime = new Date();

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].timestamp).toBeInstanceOf(Date);
      expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(events[0].timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(events[0].index).toBe(0);
    });

    it('should not capture events when stopped', () => {
      eventCapture.stop();
      emitter.emit('test:event', { data: 'test' });

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(0);
    });

    it('should resume capturing after restart', () => {
      emitter.emit('test:before', { data: 'before' });
      eventCapture.stop();
      emitter.emit('test:during-stop', { data: 'during' });
      eventCapture.start();
      emitter.emit('test:after', { data: 'after' });

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('test:before');
      expect(events[1].type).toBe('test:after');
    });

    it('should clear events', () => {
      emitter.emit('test:event', { data: 'test' });
      expect(eventCapture.getAllEvents()).toHaveLength(1);

      eventCapture.clear();
      expect(eventCapture.getAllEvents()).toHaveLength(0);
    });

    it('should reset (clear and restart if running)', () => {
      emitter.emit('test:before', { data: 'before' });
      expect(eventCapture.getAllEvents()).toHaveLength(1);

      eventCapture.reset();
      expect(eventCapture.getAllEvents()).toHaveLength(0);

      emitter.emit('test:after', { data: 'after' });
      expect(eventCapture.getAllEvents()).toHaveLength(1);
      expect(eventCapture.getAllEvents()[0].type).toBe('test:after');
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by type', () => {
      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        filterTypes: ['approval:required', 'task:started'],
      });

      emitter.emit('approval:required', { taskId: 'test-1' });
      emitter.emit('other:event', { data: 'ignored' });
      emitter.emit('task:started', { taskId: 'test-2' });

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('approval:required');
      expect(events[1].type).toBe('task:started');
    });

    it('should capture all events when no filter specified', () => {
      eventCapture = new EventCapture(emitter, { autoStart: true });

      emitter.emit('event1', {});
      emitter.emit('event2', {});
      emitter.emit('event3', {});

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(3);
    });
  });

  describe('Event Retrieval', () => {
    beforeEach(() => {
      eventCapture = new EventCapture(emitter, { autoStart: true });

      // Set up test events
      emitter.emit('task:started', { taskId: 'task-1' });
      emitter.emit('approval:required', { taskId: 'task-1', gateName: 'gate-1' });
      emitter.emit('task:started', { taskId: 'task-2' });
      emitter.emit('approval:granted', { taskId: 'task-1', approver: 'user1' });
      emitter.emit('task:completed', { taskId: 'task-1' });
    });

    it('should get events by type', () => {
      const taskEvents = eventCapture.getEventsByType('task:started');
      expect(taskEvents).toHaveLength(2);
      expect(taskEvents[0].data.taskId).toBe('task-1');
      expect(taskEvents[1].data.taskId).toBe('task-2');
    });

    it('should get events by multiple types', () => {
      const events = eventCapture.getEventsByTypes(['approval:required', 'approval:granted']);
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('approval:required');
      expect(events[1].type).toBe('approval:granted');
    });

    it('should get last event', () => {
      const lastEvent = eventCapture.getLastEvent();
      expect(lastEvent?.type).toBe('task:completed');
      expect(lastEvent?.data.taskId).toBe('task-1');
    });

    it('should get last event of specific type', () => {
      const lastTaskEvent = eventCapture.getLastEventOfType('task:started');
      expect(lastTaskEvent?.data.taskId).toBe('task-2');
    });

    it('should return undefined for non-existent event type', () => {
      const event = eventCapture.getLastEventOfType('non:existent');
      expect(event).toBeUndefined();
    });

    it('should get events in time range', () => {
      const startTime = new Date(Date.now() - 1000);
      const endTime = new Date();

      const events = eventCapture.getEventsInTimeRange(startTime, endTime);
      expect(events).toHaveLength(5); // All events should be in this range
    });

    it('should get events with predicate', () => {
      const taskEvents = eventCapture.getEventsWhere(event =>
        event.type.startsWith('task:') && event.data.taskId === 'task-1'
      );
      expect(taskEvents).toHaveLength(2); // task:started and task:completed for task-1
    });
  });

  describe('Event Assertions', () => {
    beforeEach(() => {
      eventCapture = new EventCapture(emitter, { autoStart: true });
    });

    describe('expectEventEmitted', () => {
      it('should pass when event was emitted', () => {
        emitter.emit('test:event', {});
        expect(() => eventCapture.expectEventEmitted('test:event')).not.toThrow();
      });

      it('should throw when event was not emitted', () => {
        emitter.emit('other:event', {});
        expect(() => eventCapture.expectEventEmitted('test:event'))
          .toThrow("Expected event 'test:event' to be emitted, but it was not");
      });

      it('should use custom error message', () => {
        expect(() => eventCapture.expectEventEmitted('test:event', 'Custom message'))
          .toThrow('Custom message');
      });
    });

    describe('expectEventNotEmitted', () => {
      it('should pass when event was not emitted', () => {
        emitter.emit('other:event', {});
        expect(() => eventCapture.expectEventNotEmitted('test:event')).not.toThrow();
      });

      it('should throw when event was emitted', () => {
        emitter.emit('test:event', {});
        expect(() => eventCapture.expectEventNotEmitted('test:event'))
          .toThrow("Expected event 'test:event' to NOT be emitted, but it was emitted 1 time(s)");
      });
    });

    describe('expectEventSequence', () => {
      it('should pass for correct non-exact sequence', () => {
        emitter.emit('event1', {});
        emitter.emit('other', {});
        emitter.emit('event2', {});
        emitter.emit('event3', {});

        expect(() => eventCapture.expectEventSequence(['event1', 'event2', 'event3']))
          .not.toThrow();
      });

      it('should pass for correct exact sequence', () => {
        emitter.emit('event1', {});
        emitter.emit('event2', {});
        emitter.emit('event3', {});

        expect(() => eventCapture.expectEventSequence(['event1', 'event2', 'event3'], true))
          .not.toThrow();
      });

      it('should throw for incorrect non-exact sequence', () => {
        emitter.emit('event1', {});
        emitter.emit('event3', {}); // Missing event2

        expect(() => eventCapture.expectEventSequence(['event1', 'event2', 'event3']))
          .toThrow('Expected sequence [event1, event2, event3] not found');
      });

      it('should throw for incorrect exact sequence', () => {
        emitter.emit('event1', {});
        emitter.emit('other', {}); // Extra event breaks exact sequence
        emitter.emit('event2', {});

        expect(() => eventCapture.expectEventSequence(['event1', 'event2'], true))
          .toThrow('Expected exact sequence [event1, event2] not found');
      });
    });

    describe('expectEventData', () => {
      it('should pass when event has expected data', () => {
        emitter.emit('test:event', { taskId: 'test-1', status: 'active' });

        expect(() => eventCapture.expectEventData('test:event', { taskId: 'test-1' }))
          .not.toThrow();
      });

      it('should throw when event data does not match', () => {
        emitter.emit('test:event', { taskId: 'test-1' });

        expect(() => eventCapture.expectEventData('test:event', { taskId: 'test-2' }))
          .toThrow("Expected event 'test:event' to have taskId=\"test-2\", but got \"test-1\"");
      });

      it('should work with event objects', () => {
        emitter.emit('test:event', { taskId: 'test-1' });
        const event = eventCapture.getLastEvent()!;

        expect(() => eventCapture.expectEventData(event, { taskId: 'test-1' }))
          .not.toThrow();
      });

      it('should throw when event not found', () => {
        expect(() => eventCapture.expectEventData('non:existent', { data: 'value' }))
          .toThrow('Cannot check event data: no event of type \'non:existent\' found');
      });
    });

    describe('expectEventCount', () => {
      it('should pass when count matches', () => {
        emitter.emit('test:event', {});
        emitter.emit('test:event', {});

        expect(() => eventCapture.expectEventCount('test:event', 2)).not.toThrow();
      });

      it('should throw when count does not match', () => {
        emitter.emit('test:event', {});

        expect(() => eventCapture.expectEventCount('test:event', 2))
          .toThrow("Expected 2 'test:event' events, but captured 1");
      });
    });

    describe('expectTotalEventCount', () => {
      it('should pass when total count matches', () => {
        emitter.emit('event1', {});
        emitter.emit('event2', {});

        expect(() => eventCapture.expectTotalEventCount(2)).not.toThrow();
      });

      it('should throw when total count does not match', () => {
        emitter.emit('event1', {});

        expect(() => eventCapture.expectTotalEventCount(2))
          .toThrow('Expected 2 total events, but captured 1');
      });
    });
  });

  describe('Confirmation Event Helpers', () => {
    beforeEach(() => {
      eventCapture = new EventCapture(emitter, { autoStart: true });

      // Set up confirmation-related test events
      emitter.emit('approval:required', { taskId: 'test-1', gateName: 'gate-1' } as ApprovalRequiredEventData);
      emitter.emit('gate:approved', { taskId: 'test-1', approved: true });
      emitter.emit('approval:granted', { taskId: 'test-1', approver: 'user1' } as ApprovalGrantedEventData);
      emitter.emit('permission:request', { requestId: 'req-1' });
      emitter.emit('dangerous:detected', { operationId: 'op-1' });
    });

    it('should get approval required events', () => {
      const events = eventCapture.getApprovalRequiredEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.taskId).toBe('test-1');
    });

    it('should get approval response events', () => {
      const events = eventCapture.getApprovalResponseEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('gate:approved');
    });

    it('should get approval granted events', () => {
      const events = eventCapture.getApprovalGrantedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.approver).toBe('user1');
    });

    it('should get gate events', () => {
      const events = eventCapture.getGateEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('gate:approved');
    });

    it('should get all confirmation events', () => {
      const events = eventCapture.getConfirmationEvents();
      expect(events.length).toBeGreaterThanOrEqual(4);
      const types = events.map(e => e.type);
      expect(types).toContain('approval:required');
      expect(types).toContain('permission:request');
      expect(types).toContain('dangerous:detected');
    });
  });

  describe('Async Event Waiting', () => {
    beforeEach(() => {
      eventCapture = new EventCapture(emitter, { autoStart: true });
    });

    it('should wait for event that occurs later', async () => {
      setTimeout(() => {
        emitter.emit('delayed:event', { data: 'test' });
      }, 100);

      const event = await eventCapture.waitForEvent('delayed:event', 1000);
      expect(event.type).toBe('delayed:event');
      expect(event.data).toEqual({ data: 'test' });
    });

    it('should return immediately for existing event', async () => {
      emitter.emit('existing:event', { data: 'test' });

      const event = await eventCapture.waitForEvent('existing:event', 1000);
      expect(event.type).toBe('existing:event');
    });

    it('should timeout waiting for event', async () => {
      await expect(eventCapture.waitForEvent('never:emitted', 100))
        .rejects.toThrow('Timeout waiting for event \'never:emitted\' after 100ms');
    });

    it('should wait for event sequence', async () => {
      setTimeout(() => {
        emitter.emit('seq:event1', {});
        emitter.emit('seq:event2', {});
      }, 100);

      const events = await eventCapture.waitForEventSequence(['seq:event1', 'seq:event2'], 1000);
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('seq:event1');
      expect(events[1].type).toBe('seq:event2');
    });

    it('should timeout waiting for sequence', async () => {
      setTimeout(() => {
        emitter.emit('partial:event1', {});
        // Missing partial:event2
      }, 50);

      await expect(eventCapture.waitForEventSequence(['partial:event1', 'partial:event2'], 200))
        .rejects.toThrow('Timeout waiting for event sequence');
    });
  });

  describe('Max Events Limit', () => {
    it('should enforce max events limit', () => {
      eventCapture = new EventCapture(emitter, { autoStart: true, maxEvents: 3 });

      emitter.emit('event1', {});
      emitter.emit('event2', {});
      emitter.emit('event3', {});
      emitter.emit('event4', {}); // Should cause event1 to be removed

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('event2');
      expect(events[2].type).toBe('event4');
    });
  });

  describe('Event Summary', () => {
    beforeEach(() => {
      eventCapture = new EventCapture(emitter, { autoStart: true });
    });

    it('should provide event summary', () => {
      emitter.emit('event1', {});
      emitter.emit('event1', {});
      emitter.emit('event2', {});

      const summary = eventCapture.getEventSummary();
      expect(summary).toContain('Captured 3 events');
      expect(summary).toContain('event1: 2');
      expect(summary).toContain('event2: 1');
    });
  });

  describe('Multiple Argument Handling', () => {
    beforeEach(() => {
      eventCapture = new EventCapture(emitter, { autoStart: true });
    });

    it('should handle single argument events', () => {
      emitter.emit('single:arg', { data: 'test' });

      const events = eventCapture.getAllEvents();
      expect(events[0].data).toEqual({ data: 'test' });
    });

    it('should handle multiple argument events', () => {
      emitter.emit('multi:arg', 'arg1', { data: 'test' });

      const events = eventCapture.getAllEvents();
      expect(events[0].data).toEqual({ data: 'test' }); // Should take second arg as data
    });

    it('should handle events with no arguments', () => {
      emitter.emit('no:args');

      const events = eventCapture.getAllEvents();
      expect(events[0].data).toBeUndefined();
    });

    it('should handle events with many arguments', () => {
      emitter.emit('many:args', 'arg1', 'arg2', 'arg3');

      const events = eventCapture.getAllEvents();
      expect(events[0].data).toEqual(['arg1', 'arg2', 'arg3']);
    });
  });
});

describe('Helper Functions', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('createEventCapture', () => {
    it('should create EventCapture with defaults', () => {
      const capture = createEventCapture(emitter);

      // Should auto-start
      emitter.emit('test:event', {});
      expect(capture.getAllEvents()).toHaveLength(1);

      capture.dispose();
    });

    it('should apply custom options', () => {
      const capture = createEventCapture(emitter, {
        maxEvents: 100,
        filterTypes: ['test:event']
      });

      emitter.emit('test:event', {});
      emitter.emit('other:event', {});

      expect(capture.getAllEvents()).toHaveLength(1);
      expect(capture.getAllEvents()[0].type).toBe('test:event');

      capture.dispose();
    });
  });

  describe('createConfirmationEventCapture', () => {
    it('should only capture confirmation-related events', () => {
      const capture = createConfirmationEventCapture(emitter);

      emitter.emit('approval:required', {});
      emitter.emit('task:started', {}); // Should be filtered out
      emitter.emit('permission:request', {});

      const events = capture.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('approval:required');
      expect(events[1].type).toBe('permission:request');

      capture.dispose();
    });
  });
});

describe('Disposal and Cleanup', () => {
  let emitter: EventEmitter;
  let eventCapture: EventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
    eventCapture = new EventCapture(emitter, { autoStart: true });
  });

  it('should clean up listeners on dispose', () => {
    const initialListenerCount = emitter.listenerCount('test:event');

    eventCapture.dispose();

    // Should have same number of listeners (no leaks)
    expect(emitter.listenerCount('test:event')).toBe(initialListenerCount);

    // Should not capture events after disposal
    emitter.emit('test:event', {});
    expect(eventCapture.getAllEvents()).toHaveLength(0);
  });

  it('should handle multiple start/stop cycles', () => {
    eventCapture.start();
    eventCapture.stop();
    eventCapture.start();
    eventCapture.stop();

    // Should not leak listeners
    expect(emitter.listenerCount('test:event')).toBe(0);
  });
});