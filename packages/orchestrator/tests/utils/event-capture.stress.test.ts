/**
 * Stress tests for EventCapture utility
 * Tests performance, memory usage, and behavior under high load
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture, createConfirmationEventCapture } from './event-capture';

describe('EventCapture Stress Tests', () => {
  let emitter: EventEmitter;
  let eventCapture: EventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    eventCapture?.dispose();
  });

  describe('High Volume Event Processing', () => {
    it('should handle 10,000 events efficiently', () => {
      eventCapture = createEventCapture(emitter, { maxEvents: 15000 });

      const eventCount = 10000;
      const startTime = performance.now();

      // Generate high volume of events
      for (let i = 0; i < eventCount; i++) {
        emitter.emit('stress:event', {
          index: i,
          timestamp: Date.now(),
          payload: `payload-${i}`,
          metadata: {
            batch: Math.floor(i / 100),
            type: i % 3 === 0 ? 'critical' : 'normal'
          }
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify all events were captured
      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(eventCount);

      // Performance assertions
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      console.log(`Processed ${eventCount} events in ${duration.toFixed(2)}ms (${(eventCount / duration * 1000).toFixed(2)} events/sec)`);

      // Verify data integrity
      expect(events[0].data.index).toBe(0);
      expect(events[eventCount - 1].data.index).toBe(eventCount - 1);
      expect(events[5000].data.payload).toBe('payload-5000');
    });

    it('should handle rapid concurrent event emission', async () => {
      eventCapture = createEventCapture(emitter, { maxEvents: 50000 });

      const eventsPerBatch = 1000;
      const batchCount = 10;
      const startTime = performance.now();

      // Simulate concurrent event emission
      const promises = Array.from({ length: batchCount }, (_, batchIndex) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            for (let i = 0; i < eventsPerBatch; i++) {
              emitter.emit('concurrent:event', {
                batchIndex,
                eventIndex: i,
                id: `batch-${batchIndex}-event-${i}`
              });
            }
            resolve();
          }, batchIndex * 10); // Stagger batches slightly
        })
      );

      await Promise.all(promises);
      const endTime = performance.now();

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(eventsPerBatch * batchCount);

      // Verify events from all batches were captured
      const batches = new Set(events.map(e => e.data.batchIndex));
      expect(batches.size).toBe(batchCount);

      console.log(`Processed ${events.length} concurrent events in ${(endTime - startTime).toFixed(2)}ms`);
    });

    it('should maintain performance with mixed event types', () => {
      eventCapture = createEventCapture(emitter);

      const eventTypes = [
        'approval:required',
        'approval:granted',
        'approval:denied',
        'task:started',
        'task:completed',
        'task:failed',
        'permission:request',
        'permission:granted',
        'dangerous:detected',
        'gate:required',
        'gate:approved',
        'gate:rejected'
      ];

      const eventsPerType = 500;
      const totalEvents = eventTypes.length * eventsPerType;
      const startTime = performance.now();

      // Emit events in randomized order
      const eventQueue = [];
      for (const eventType of eventTypes) {
        for (let i = 0; i < eventsPerType; i++) {
          eventQueue.push({ type: eventType, data: { index: i, eventType } });
        }
      }

      // Shuffle for realistic mixed pattern
      for (let i = eventQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eventQueue[i], eventQueue[j]] = [eventQueue[j], eventQueue[i]];
      }

      // Emit all events
      for (const { type, data } of eventQueue) {
        emitter.emit(type, data);
      }

      const endTime = performance.now();
      const events = eventCapture.getAllEvents();

      expect(events).toHaveLength(totalEvents);

      // Verify each event type has correct count
      for (const eventType of eventTypes) {
        const typeEvents = eventCapture.getEventsByType(eventType);
        expect(typeEvents).toHaveLength(eventsPerType);
      }

      console.log(`Mixed event processing: ${totalEvents} events in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Memory Management Under Load', () => {
    it('should respect maxEvents limit with very large event volumes', () => {
      const maxEvents = 1000;
      eventCapture = createEventCapture(emitter, { maxEvents });

      // Generate many more events than the limit
      const totalEvents = maxEvents * 5;

      for (let i = 0; i < totalEvents; i++) {
        emitter.emit('memory:test', {
          index: i,
          largeData: 'x'.repeat(1000) // 1KB per event
        });
      }

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(maxEvents);

      // Should contain the LAST maxEvents events
      expect(events[0].data.index).toBe(totalEvents - maxEvents);
      expect(events[maxEvents - 1].data.index).toBe(totalEvents - 1);
    });

    it('should handle large event payloads efficiently', () => {
      eventCapture = createEventCapture(emitter, { maxEvents: 100 });

      const largePayloadSize = 10000; // 10KB per event
      const eventCount = 50;

      const startTime = performance.now();

      for (let i = 0; i < eventCount; i++) {
        emitter.emit('large:payload', {
          index: i,
          largeData: 'x'.repeat(largePayloadSize),
          timestamp: Date.now(),
          metadata: {
            size: largePayloadSize,
            type: 'stress-test'
          }
        });
      }

      const endTime = performance.now();
      const events = eventCapture.getAllEvents();

      expect(events).toHaveLength(eventCount);
      expect(events[0].data.largeData.length).toBe(largePayloadSize);

      console.log(`Large payload processing: ${eventCount} events with ${largePayloadSize}B each in ${(endTime - startTime).toFixed(2)}ms`);
    });

    it('should handle circular references and complex objects', () => {
      eventCapture = createEventCapture(emitter);

      const complexObjectCount = 1000;
      const startTime = performance.now();

      for (let i = 0; i < complexObjectCount; i++) {
        const complexObj = {
          id: i,
          nested: {
            level1: {
              level2: {
                level3: {
                  data: `complex-data-${i}`,
                  array: [1, 2, 3, { deep: 'value' }],
                  date: new Date(),
                  regexp: /test-\d+/g
                }
              }
            }
          },
          circular: null as any,
          functions: {
            test: () => `function-${i}`,
            arrow: (x: number) => x * i
          }
        };

        // Create circular reference
        complexObj.circular = complexObj;

        emitter.emit('complex:object', complexObj);
      }

      const endTime = performance.now();
      const events = eventCapture.getAllEvents();

      expect(events).toHaveLength(complexObjectCount);
      expect(events[500].data.nested.level1.level2.level3.data).toBe('complex-data-500');

      console.log(`Complex object processing: ${complexObjectCount} events in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Filtering Performance Under Load', () => {
    it('should maintain filtering performance with many event types', () => {
      const filterTypes = [
        'approval:required',
        'approval:granted',
        'task:completed'
      ];

      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        filterTypes,
        maxEvents: 10000
      });

      const eventsPerType = 1000;
      const noiseEventsCount = 5000; // Events that should be filtered out
      const startTime = performance.now();

      // Add noise events that should be filtered out
      for (let i = 0; i < noiseEventsCount; i++) {
        emitter.emit('noise:event', { index: i });
        emitter.emit('debug:log', { message: `debug-${i}` });
        emitter.emit('metrics:update', { value: i });
      }

      // Add events that should be captured
      for (let i = 0; i < eventsPerType; i++) {
        emitter.emit('approval:required', { index: i });
        emitter.emit('approval:granted', { index: i });
        emitter.emit('task:completed', { index: i });
      }

      const endTime = performance.now();
      const events = eventCapture.getAllEvents();

      // Should only capture the filtered events
      expect(events).toHaveLength(filterTypes.length * eventsPerType);

      // Verify no noise events were captured
      const eventTypes = new Set(events.map(e => e.type));
      expect(eventTypes).toEqual(new Set(filterTypes));

      console.log(`Filtering performance: processed ${noiseEventsCount + (filterTypes.length * eventsPerType)} events, captured ${events.length} in ${(endTime - startTime).toFixed(2)}ms`);
    });

    it('should handle rapid start/stop cycles efficiently', () => {
      eventCapture = createEventCapture(emitter);

      const cycles = 100;
      const eventsPerCycle = 50;
      const startTime = performance.now();

      for (let cycle = 0; cycle < cycles; cycle++) {
        // Emit some events
        for (let i = 0; i < eventsPerCycle; i++) {
          emitter.emit('cycle:event', { cycle, index: i });
        }

        // Stop and restart
        eventCapture.stop();
        eventCapture.start();
      }

      const endTime = performance.now();
      const events = eventCapture.getAllEvents();

      // Should have captured all events (start/stop doesn't lose events unless stopped during emission)
      expect(events.length).toBeGreaterThan(0);

      console.log(`Start/stop cycles: ${cycles} cycles with ${eventsPerCycle} events each in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Assertion Performance Under Load', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);

      // Pre-populate with many events for assertion testing
      for (let i = 0; i < 5000; i++) {
        emitter.emit('perf:test', { index: i, type: i % 3 === 0 ? 'critical' : 'normal' });
        emitter.emit('approval:required', { taskId: `task-${i}`, index: i });
        emitter.emit('task:completed', { taskId: `task-${i}`, index: i });
      }
    });

    it('should perform event type filtering quickly with large datasets', () => {
      const startTime = performance.now();

      const approvalEvents = eventCapture.getEventsByType('approval:required');
      const taskEvents = eventCapture.getEventsByType('task:completed');
      const perfEvents = eventCapture.getEventsByType('perf:test');

      const endTime = performance.now();

      expect(approvalEvents).toHaveLength(5000);
      expect(taskEvents).toHaveLength(5000);
      expect(perfEvents).toHaveLength(5000);

      console.log(`Event filtering performance: 15,000 events filtered in ${(endTime - startTime).toFixed(2)}ms`);
    });

    it('should perform predicate-based filtering efficiently', () => {
      const startTime = performance.now();

      const criticalEvents = eventCapture.getEventsWhere(event =>
        event.data?.type === 'critical'
      );

      const highIndexEvents = eventCapture.getEventsWhere(event =>
        event.data?.index > 4000
      );

      const specificTaskEvents = eventCapture.getEventsWhere(event =>
        event.type === 'task:completed' && event.data?.index % 100 === 0
      );

      const endTime = performance.now();

      expect(criticalEvents.length).toBeGreaterThan(0);
      expect(highIndexEvents.length).toBeGreaterThan(0);
      expect(specificTaskEvents.length).toBe(50); // Every 100th task event (0, 100, 200, ..., 4900)

      console.log(`Predicate filtering: 3 complex predicates over 15,000 events in ${(endTime - startTime).toFixed(2)}ms`);
    });

    it('should handle sequence validation efficiently with large datasets', () => {
      const startTime = performance.now();

      // Test multiple sequence validations
      expect(() =>
        eventCapture.expectEventSequence(['perf:test', 'approval:required', 'task:completed'])
      ).not.toThrow();

      expect(() =>
        eventCapture.expectEventSequence(['approval:required', 'task:completed'])
      ).not.toThrow();

      expect(() =>
        eventCapture.expectEventSequence(['nonexistent:event', 'approval:required'])
      ).toThrow();

      const endTime = performance.now();

      console.log(`Sequence validation: 3 sequence checks over 15,000 events in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Memory Cleanup and Resource Management', () => {
    it('should clean up efficiently after processing many events', () => {
      eventCapture = createEventCapture(emitter, { maxEvents: 1000 });

      // Generate many events
      for (let i = 0; i < 10000; i++) {
        emitter.emit('cleanup:test', { index: i });
      }

      // Check listener counts before cleanup
      const beforeCount = emitter.listenerCount('cleanup:test');

      // Dispose should clean up all resources
      eventCapture.dispose();

      // Check listener counts after cleanup
      const afterCount = emitter.listenerCount('cleanup:test');
      expect(afterCount).toBe(0);

      // Events should be cleared
      expect(eventCapture.getAllEvents()).toHaveLength(0);
    });

    it('should handle multiple EventCapture instances without interference', () => {
      const capture1 = createEventCapture(emitter, { maxEvents: 1000 });
      const capture2 = createEventCapture(emitter, { maxEvents: 1000 });
      const capture3 = createConfirmationEventCapture(emitter, { maxEvents: 500 });

      // Generate events that should be captured by all
      for (let i = 0; i < 2000; i++) {
        emitter.emit('approval:required', { index: i });
        emitter.emit('task:started', { index: i });
        emitter.emit('debug:log', { index: i });
      }

      // Check that each capture has appropriate events
      expect(capture1.getAllEvents()).toHaveLength(1000); // Last 1000 events
      expect(capture2.getAllEvents()).toHaveLength(1000); // Last 1000 events
      expect(capture3.getAllEvents()).toHaveLength(500);  // Last 500 confirmation events only

      // Clean up all captures
      capture1.dispose();
      capture2.dispose();
      capture3.dispose();

      // No listeners should remain
      expect(emitter.listenerCount('approval:required')).toBe(0);
      expect(emitter.listenerCount('task:started')).toBe(0);
    });

    it('should handle stress testing with confirmation event capture', () => {
      eventCapture = createConfirmationEventCapture(emitter, { maxEvents: 5000 });

      const confirmationEventTypes = [
        'approval:required',
        'approval:granted',
        'approval:denied',
        'approval:resolved',
        'gate:required',
        'gate:approved',
        'gate:rejected',
        'permission:request',
        'permission:granted',
        'permission:denied',
        'dangerous:detected',
        'dangerous:confirmed',
        'dangerous:blocked'
      ];

      const eventsPerType = 200;
      const noiseEventsCount = 10000;

      const startTime = performance.now();

      // Add noise events (should be filtered out)
      for (let i = 0; i < noiseEventsCount; i++) {
        emitter.emit('task:started', { index: i });
        emitter.emit('task:completed', { index: i });
        emitter.emit('debug:log', { message: `noise-${i}` });
      }

      // Add confirmation events (should be captured)
      for (const eventType of confirmationEventTypes) {
        for (let i = 0; i < eventsPerType; i++) {
          emitter.emit(eventType, { type: eventType, index: i });
        }
      }

      const endTime = performance.now();
      const events = eventCapture.getAllEvents();

      // Should only capture confirmation events
      const expectedEventCount = confirmationEventTypes.length * eventsPerType;
      expect(events).toHaveLength(expectedEventCount);

      // Verify only confirmation events were captured
      const capturedTypes = new Set(events.map(e => e.type));
      expect(capturedTypes).toEqual(new Set(confirmationEventTypes));

      console.log(`Confirmation event stress test: ${noiseEventsCount + expectedEventCount} total events, ${expectedEventCount} captured in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });
});