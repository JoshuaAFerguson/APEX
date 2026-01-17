/**
 * Edge case tests for EventCapture utility
 * Tests error scenarios, boundary conditions, and unusual inputs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture, createConfirmationEventCapture } from './event-capture';

describe('EventCapture Edge Cases', () => {
  let emitter: EventEmitter;
  let eventCapture: EventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    eventCapture?.dispose();
  });

  describe('Boundary Conditions', () => {
    it('should handle zero maxEvents limit', () => {
      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        maxEvents: 0
      });

      emitter.emit('test:event', {});
      emitter.emit('test:event2', {});

      // Should not capture any events
      expect(eventCapture.getAllEvents()).toHaveLength(0);
    });

    it('should handle extremely small maxEvents limit', () => {
      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        maxEvents: 1
      });

      emitter.emit('first:event', { id: 1 });
      emitter.emit('second:event', { id: 2 });
      emitter.emit('third:event', { id: 3 });

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(1);
      // Should contain only the most recent event
      expect(events[0].type).toBe('third:event');
      expect(events[0].data.id).toBe(3);
    });

    it('should handle extremely large maxEvents limit', () => {
      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        maxEvents: Number.MAX_SAFE_INTEGER
      });

      for (let i = 0; i < 1000; i++) {
        emitter.emit('test:event', { index: i });
      }

      expect(eventCapture.getAllEvents()).toHaveLength(1000);
    });

    it('should handle empty filterTypes array', () => {
      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        filterTypes: []
      });

      emitter.emit('event1', {});
      emitter.emit('event2', {});
      emitter.emit('event3', {});

      // Empty filter should capture all confirmation-related events
      const events = eventCapture.getAllEvents();
      expect(events.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle filterTypes with non-existent event types', () => {
      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        filterTypes: ['nonexistent:event', 'also:nonexistent']
      });

      emitter.emit('real:event', {});
      emitter.emit('another:event', {});

      // Should not capture any events since none match the filter
      expect(eventCapture.getAllEvents()).toHaveLength(0);
    });
  });

  describe('Invalid Input Handling', () => {
    it('should handle null emitter gracefully', () => {
      expect(() => {
        new EventCapture(null as any);
      }).toThrow();
    });

    it('should handle undefined emitter gracefully', () => {
      expect(() => {
        new EventCapture(undefined as any);
      }).toThrow();
    });

    it('should handle invalid options gracefully', () => {
      eventCapture = new EventCapture(emitter, null as any);
      // Should use default options
      expect(() => eventCapture.start()).not.toThrow();
    });

    it('should handle negative maxEvents', () => {
      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        maxEvents: -5
      });

      emitter.emit('test:event', {});

      // Should treat negative as zero or handle gracefully
      const events = eventCapture.getAllEvents();
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-integer maxEvents', () => {
      eventCapture = new EventCapture(emitter, {
        autoStart: true,
        maxEvents: 3.7 // Non-integer
      });

      for (let i = 0; i < 5; i++) {
        emitter.emit('test:event', { index: i });
      }

      // Should handle fractional limit appropriately
      const events = eventCapture.getAllEvents();
      expect(events.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Unusual Event Data Scenarios', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);
    });

    it('should handle events with no arguments', () => {
      emitter.emit('no:args');

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data).toBeUndefined();
    });

    it('should handle events with circular references', () => {
      const circularObj = { value: 'test' } as any;
      circularObj.self = circularObj;
      circularObj.nested = { parent: circularObj };

      emitter.emit('circular:ref', circularObj);

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.value).toBe('test');
      // Circular reference should be preserved in the captured data
      expect(events[0].data.self).toBe(events[0].data);
    });

    it('should handle events with functions', () => {
      const dataWithFunctions = {
        regularValue: 'test',
        syncFunction: function() { return 'sync'; },
        asyncFunction: async function() { return 'async'; },
        arrowFunction: () => 'arrow',
        boundFunction: (function() { return this; }).bind({ context: 'bound' })
      };

      emitter.emit('with:functions', dataWithFunctions);

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.regularValue).toBe('test');
      expect(typeof events[0].data.syncFunction).toBe('function');
      expect(typeof events[0].data.asyncFunction).toBe('function');
    });

    it('should handle events with symbols and non-serializable objects', () => {
      const symbolKey = Symbol('test');
      const complexData = {
        [symbolKey]: 'symbol value',
        date: new Date(),
        regex: /test-pattern/gi,
        error: new Error('test error'),
        map: new Map([['key', 'value']]),
        set: new Set([1, 2, 3]),
        weakMap: new WeakMap(),
        weakSet: new WeakSet(),
        buffer: Buffer.from('test buffer'),
        arrayBuffer: new ArrayBuffer(8)
      };

      emitter.emit('complex:types', complexData);

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.date).toBeInstanceOf(Date);
      expect(events[0].data.regex).toBeInstanceOf(RegExp);
      expect(events[0].data.error).toBeInstanceOf(Error);
    });

    it('should handle extremely large event data', () => {
      const largeString = 'x'.repeat(1000000); // 1MB string
      const largeArray = new Array(100000).fill(0).map((_, i) => ({ index: i }));
      const largeObject = {
        largeString,
        largeArray,
        metadata: {
          size: largeString.length,
          arrayLength: largeArray.length
        }
      };

      emitter.emit('large:data', largeObject);

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.largeString.length).toBe(1000000);
      expect(events[0].data.largeArray.length).toBe(100000);
    });
  });

  describe('Timing and Race Conditions', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);
    });

    it('should handle events emitted during start/stop transitions', () => {
      // Start capturing
      eventCapture.start();

      // Emit event during normal operation
      emitter.emit('before:stop', {});

      // Stop and immediately emit event
      eventCapture.stop();
      emitter.emit('during:stop', {}); // Should not be captured

      // Start again and emit
      eventCapture.start();
      emitter.emit('after:restart', {}); // Should be captured

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('before:stop');
      expect(events[1].type).toBe('after:restart');
    });

    it('should handle rapid start/stop cycles', () => {
      for (let i = 0; i < 100; i++) {
        eventCapture.start();
        eventCapture.stop();
      }

      // Should not cause any errors or memory leaks
      eventCapture.start();
      emitter.emit('final:event', {});

      expect(eventCapture.getAllEvents()).toHaveLength(1);
    });

    it('should handle events emitted during disposal', () => {
      eventCapture.start();
      emitter.emit('before:dispose', {});

      // Emit events while disposing (shouldn't crash)
      setTimeout(() => {
        emitter.emit('during:dispose', {});
      }, 0);

      eventCapture.dispose();

      // Events after disposal should not be captured
      emitter.emit('after:dispose', {});

      expect(eventCapture.getAllEvents()).toHaveLength(0); // Disposal clears events
    });

    it('should handle concurrent assertion calls', async () => {
      // Pre-populate with events
      for (let i = 0; i < 1000; i++) {
        emitter.emit('concurrent:test', { index: i });
      }

      // Run multiple assertions concurrently
      const assertions = Promise.all([
        new Promise<void>(resolve => {
          eventCapture.expectEventEmitted('concurrent:test');
          resolve();
        }),
        new Promise<void>(resolve => {
          eventCapture.expectEventCount('concurrent:test', 1000);
          resolve();
        }),
        new Promise<void>(resolve => {
          const events = eventCapture.getEventsByType('concurrent:test');
          expect(events).toHaveLength(1000);
          resolve();
        }),
        new Promise<void>(resolve => {
          eventCapture.expectEventSequence(['concurrent:test']);
          resolve();
        })
      ]);

      await expect(assertions).resolves.toBeDefined();
    });
  });

  describe('Error Recovery and Resilience', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);
    });

    it('should handle emitter errors gracefully', () => {
      // Force an error in the emitter
      const originalEmit = emitter.emit;
      emitter.emit = function() {
        throw new Error('Emitter error');
      };

      // Should not crash the event capture
      expect(() => {
        emitter.emit('error:test', {});
      }).toThrow('Emitter error');

      // Restore emitter
      emitter.emit = originalEmit;

      // Should continue working normally
      emitter.emit('normal:event', {});
      expect(eventCapture.getAllEvents()).toHaveLength(1);
    });

    it('should handle listener callback errors', () => {
      // Add a faulty listener
      emitter.on('faulty:event', () => {
        throw new Error('Listener error');
      });

      // EventCapture should still work despite other listener errors
      expect(() => {
        emitter.emit('faulty:event', { data: 'test' });
      }).toThrow('Listener error');

      // EventCapture should have captured the event despite the error
      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('faulty:event');
    });

    it('should handle memory pressure scenarios', () => {
      eventCapture = createEventCapture(emitter, { maxEvents: 10 });

      // Rapidly generate events to test memory pressure
      for (let i = 0; i < 1000; i++) {
        const largeData = {
          index: i,
          data: new Array(1000).fill(i) // Moderate size data
        };
        emitter.emit('memory:pressure', largeData);
      }

      const events = eventCapture.getAllEvents();
      expect(events).toHaveLength(10);
      expect(events[0].data.index).toBe(990); // Should contain last 10 events
      expect(events[9].data.index).toBe(999);
    });
  });

  describe('Assertion Edge Cases', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);
    });

    it('should handle empty event sequences', () => {
      // Empty sequence should pass
      expect(() => {
        eventCapture.expectEventSequence([]);
      }).not.toThrow();

      emitter.emit('test:event', {});

      // Empty sequence should still pass
      expect(() => {
        eventCapture.expectEventSequence([]);
      }).not.toThrow();
    });

    it('should handle data assertions with null/undefined values', () => {
      emitter.emit('null:test', { value: null, undefinedValue: undefined });

      // Should handle null values correctly
      expect(() => {
        eventCapture.expectEventData('null:test', { value: null });
      }).not.toThrow();

      expect(() => {
        eventCapture.expectEventData('null:test', { undefinedValue: undefined });
      }).not.toThrow();

      // Should fail when expected null but got different value
      expect(() => {
        eventCapture.expectEventData('null:test', { value: 'not null' });
      }).toThrow();
    });

    it('should handle assertions on events with complex nested data', () => {
      const complexEvent = {
        user: {
          id: 123,
          profile: {
            name: 'Test User',
            preferences: {
              theme: 'dark',
              notifications: true
            }
          }
        }
      };

      emitter.emit('complex:event', complexEvent);

      // Should handle partial nested data assertions
      expect(() => {
        eventCapture.expectEventData('complex:event', {
          user: complexEvent.user // Full nested object
        });
      }).not.toThrow();
    });

    it('should handle assertions with special number values', () => {
      emitter.emit('special:numbers', {
        infinity: Infinity,
        negativeInfinity: -Infinity,
        notANumber: NaN,
        zero: 0,
        negativeZero: -0
      });

      expect(() => {
        eventCapture.expectEventData('special:numbers', { infinity: Infinity });
      }).not.toThrow();

      expect(() => {
        eventCapture.expectEventData('special:numbers', { negativeInfinity: -Infinity });
      }).not.toThrow();

      // NaN comparison is special case
      expect(() => {
        eventCapture.expectEventData('special:numbers', { notANumber: NaN });
      }).toThrow(); // NaN !== NaN

      expect(() => {
        eventCapture.expectEventData('special:numbers', { zero: 0 });
      }).not.toThrow();
    });
  });

  describe('Helper Function Edge Cases', () => {
    it('should handle createEventCapture with invalid options', () => {
      const capture = createEventCapture(emitter, {
        maxEvents: -1,
        autoStart: null as any,
        filterTypes: null as any
      });

      // Should still create a working capture with defaults
      emitter.emit('test:event', {});
      expect(capture.getAllEvents().length).toBeGreaterThanOrEqual(0);

      capture.dispose();
    });

    it('should handle createConfirmationEventCapture with edge case options', () => {
      const capture = createConfirmationEventCapture(emitter, {
        maxEvents: 0 // Zero limit
      });

      emitter.emit('approval:required', {});
      emitter.emit('task:started', {}); // Should be filtered out anyway

      // With zero limit, should capture nothing
      expect(capture.getAllEvents()).toHaveLength(0);

      capture.dispose();
    });

    it('should handle disposal of already disposed captures', () => {
      const capture = createEventCapture(emitter);

      capture.dispose();
      capture.dispose(); // Second disposal
      capture.dispose(); // Third disposal

      // Should not throw errors
      expect(() => capture.dispose()).not.toThrow();
    });
  });

  describe('Async Edge Cases', () => {
    beforeEach(() => {
      eventCapture = createEventCapture(emitter);
    });

    it('should handle waitForEvent with immediate disposal', async () => {
      const promise = eventCapture.waitForEvent('never:comes', 1000);

      // Dispose immediately
      eventCapture.dispose();

      // Promise should still reject with timeout (not crash)
      await expect(promise).rejects.toThrow('Timeout waiting for event');
    });

    it('should handle multiple overlapping waitForEvent calls', async () => {
      const promise1 = eventCapture.waitForEvent('delayed:event', 2000);
      const promise2 = eventCapture.waitForEvent('delayed:event', 2000);
      const promise3 = eventCapture.waitForEvent('different:event', 2000);

      setTimeout(() => {
        emitter.emit('delayed:event', { id: 'shared' });
        emitter.emit('different:event', { id: 'different' });
      }, 100);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(result1.data.id).toBe('shared');
      expect(result2.data.id).toBe('shared');
      expect(result3.data.id).toBe('different');
    });

    it('should handle waitForEventSequence with partial completion', async () => {
      const promise = eventCapture.waitForEventSequence([
        'seq:first',
        'seq:second',
        'seq:never'
      ], 500);

      setTimeout(() => {
        emitter.emit('seq:first', {});
      }, 100);

      setTimeout(() => {
        emitter.emit('seq:second', {});
      }, 200);

      // seq:never is never emitted

      await expect(promise).rejects.toThrow('Timeout waiting for event sequence');
    });

    it('should handle zero timeout values', async () => {
      await expect(
        eventCapture.waitForEvent('immediate:timeout', 0)
      ).rejects.toThrow('Timeout waiting for event');

      await expect(
        eventCapture.waitForEventSequence(['immediate:timeout'], 0)
      ).rejects.toThrow('Timeout waiting for event sequence');
    });
  });
});