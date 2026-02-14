/**
 * Error handling and recovery tests for streaming test utilities
 * Tests resilience, error recovery, and graceful degradation
 */

import { EventEmitter } from 'eventemitter3';
import {
  StreamingEventCapture,
  createStreamingEventCapture,
  StreamingTestUtils,
  StreamingAssertions,
  type StreamingTestConfig,
  type StreamTestScenario
} from './streaming-test-utils';

describe('Streaming Error Handling and Recovery Tests', () => {
  let emitter: EventEmitter;
  let streamingCapture: StreamingEventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    streamingCapture?.dispose();
  });

  describe('Event Processing Errors', () => {
    it('should handle events with invalid JSON serializable data', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['invalid:json']);

      const problemData = {
        normalField: 'valid',
        circularRef: {} as any,
        functionField: () => console.log('function'),
        undefinedField: undefined,
        symbolField: Symbol('test')
      };
      problemData.circularRef = problemData;

      // Should not throw when emitting problematic data
      expect(() => {
        emitter.emit('invalid:json', problemData);
      }).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      const events = streamingCapture.getStreamingEvents();
      expect(events).toHaveLength(1);

      // Should capture what it can
      expect(events[0].data.normalField).toBe('valid');
      expect(events[0].timing).toBeDefined();
    });

    it('should recover from event processing exceptions', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['error:prone', 'recovery:test']);

      let errorThrown = false;

      // Mock a processing error by overriding internal method temporarily
      const originalCaptureEvent = (streamingCapture as any).captureEvent;
      (streamingCapture as any).captureEvent = function(type: string, args: any[]) {
        if (type === 'error:prone' && !errorThrown) {
          errorThrown = true;
          throw new Error('Simulated processing error');
        }
        return originalCaptureEvent.call(this, type, args);
      };

      try {
        // This should cause an internal error
        emitter.emit('error:prone', { shouldFail: true });

        // This should work normally after error recovery
        emitter.emit('recovery:test', { shouldWork: true });

        await new Promise(resolve => setTimeout(resolve, 100));

        const events = streamingCapture.getStreamingEvents();

        // Should have recovered and captured the second event
        expect(events.length).toBeGreaterThanOrEqual(1);
        const recoveryEvent = events.find(e => e.type === 'recovery:test');
        expect(recoveryEvent).toBeDefined();
        expect(recoveryEvent?.data.shouldWork).toBe(true);

      } finally {
        // Restore original method
        (streamingCapture as any).captureEvent = originalCaptureEvent;
      }
    });

    it('should handle emitter errors without crashing', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['error:event', 'normal:event']);

      // Set up an error listener that throws
      emitter.on('error:event', () => {
        throw new Error('Listener error');
      });

      let errorCaught = false;
      emitter.on('error', (error) => {
        errorCaught = true;
        expect(error.message).toBe('Listener error');
      });

      // Emit error-causing event
      expect(() => {
        emitter.emit('error:event', { triggerError: true });
      }).toThrow('Listener error');

      // Streaming should continue working
      emitter.emit('normal:event', { afterError: true });

      await new Promise(resolve => setTimeout(resolve, 100));

      const events = streamingCapture.getStreamingEvents();

      // Should have captured at least the normal event
      const normalEvent = events.find(e => e.type === 'normal:event');
      expect(normalEvent).toBeDefined();
      expect(normalEvent?.data.afterError).toBe(true);
      expect(errorCaught).toBe(true);
    });
  });

  describe('Network and I/O Error Simulation', () => {
    it('should handle simulated network interruptions', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        maxLatency: 1000, // Relaxed for network simulation
        streamBufferSize: 100
      });

      streamingCapture.startStreamingTest(['network:event']);

      let networkUp = true;

      // Simulate network events with interruptions
      for (let i = 0; i < 50; i++) {
        if (i === 20) {
          networkUp = false; // Simulate network down
          await new Promise(resolve => setTimeout(resolve, 100));
        } else if (i === 30) {
          networkUp = true; // Network recovery
        }

        if (networkUp) {
          emitter.emit('network:event', {
            index: i,
            networkStatus: 'up',
            timestamp: Date.now()
          });
        } else {
          // Simulate network timeout/delay
          setTimeout(() => {
            emitter.emit('network:event', {
              index: i,
              networkStatus: 'delayed',
              timestamp: Date.now()
            });
          }, 200);
        }

        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Wait for delayed events
      await new Promise(resolve => setTimeout(resolve, 500));

      const metrics = streamingCapture.endStreamingTest();
      const events = streamingCapture.getStreamingEvents();

      // Should have captured events despite network simulation
      expect(events.length).toBeGreaterThan(30);

      // Should have events from both network states
      const upEvents = events.filter(e => e.data.networkStatus === 'up');
      const delayedEvents = events.filter(e => e.data.networkStatus === 'delayed');

      expect(upEvents.length).toBeGreaterThan(0);
      expect(delayedEvents.length).toBeGreaterThan(0);

      // Latency should reflect network conditions
      const maxLatencyForDelayed = Math.max(
        ...delayedEvents.map(e => e.timing.latency)
      );
      expect(maxLatencyForDelayed).toBeGreaterThan(100);
    });

    it('should handle resource exhaustion gracefully', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 10, // Very small buffer
        maxLatency: 500
      });

      streamingCapture.startStreamingTest(['resource:exhaustion']);

      // Simulate resource exhaustion by rapid event emission
      const resourceExhaustionPromise = (async () => {
        for (let i = 0; i < 100; i++) {
          // Simulate resource pressure
          const largeData = new Array(1000).fill(`resource-pressure-${i}`);

          try {
            emitter.emit('resource:exhaustion', {
              index: i,
              data: largeData,
              timestamp: Date.now()
            });
          } catch (error) {
            // Resource errors should be handled gracefully
            console.warn(`Resource error at event ${i}:`, error.message);
          }

          // No delay - maximum pressure
        }
      })();

      await resourceExhaustionPromise;
      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = streamingCapture.endStreamingTest();

      // Should have applied backpressure
      expect(metrics.backpressureCount).toBeGreaterThan(0);
      expect(metrics.totalEvents).toBeLessThanOrEqual(50); // Significant reduction due to pressure

      // But streaming should still be functional
      expect(metrics.totalEvents).toBeGreaterThan(0);
      expect(metrics.streamDuration).toBeGreaterThan(0);
    });

    it('should recover from temporary emitter failures', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['failure:test']);

      // Emit some events normally
      for (let i = 0; i < 5; i++) {
        emitter.emit('failure:test', { phase: 'normal', index: i });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate emitter failure by removing all listeners
      const originalListeners = emitter.listeners('failure:test');
      emitter.removeAllListeners('failure:test');

      // Try to emit events during "failure" - these should be lost
      for (let i = 5; i < 10; i++) {
        emitter.emit('failure:test', { phase: 'failure', index: i });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Restore listeners (simulate recovery)
      originalListeners.forEach(listener => {
        emitter.on('failure:test', listener as any);
      });

      // Emit events after recovery
      for (let i = 10; i < 15; i++) {
        emitter.emit('failure:test', { phase: 'recovery', index: i });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const events = streamingCapture.getStreamingEvents();

      // Should have events from normal and recovery phases
      const normalEvents = events.filter(e => e.data.phase === 'normal');
      const recoveryEvents = events.filter(e => e.data.phase === 'recovery');
      const failureEvents = events.filter(e => e.data.phase === 'failure');

      expect(normalEvents.length).toBe(5);
      expect(recoveryEvents.length).toBe(5);
      expect(failureEvents.length).toBe(0); // Lost during failure
    });
  });

  describe('Scenario Error Handling', () => {
    it('should handle scenario with failing expectations gracefully', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      const failingScenario: StreamTestScenario = {
        name: 'Failing Expectations Test',
        events: [
          { type: 'test:event', data: { value: 1 }, delay: 10 },
          { type: 'test:event', data: { value: 2 }, delay: 20 }
        ],
        expectations: [
          {
            type: 'completion' as const,
            description: 'Should have exactly 5 events (will fail)',
            condition: (metrics) => metrics.totalEvents === 5 // Will fail with only 2 events
          },
          {
            type: 'throughput' as const,
            description: 'Should have impossible throughput',
            condition: (metrics) => metrics.eventsPerSecond > 10000 // Impossible requirement
          },
          {
            type: 'latency' as const,
            description: 'Should have valid latency check',
            condition: (metrics) => metrics.averageLatency >= 0 // This should pass
          }
        ],
        timeout: 1000
      };

      const result = await streamingCapture.runStreamingScenario(failingScenario);

      expect(result.passed).toBe(false);
      expect(result.results).toHaveLength(3);

      // First two expectations should fail
      expect(result.results[0].passed).toBe(false);
      expect(result.results[1].passed).toBe(false);

      // Third expectation should pass
      expect(result.results[2].passed).toBe(true);

      // Metrics should still be valid
      expect(result.metrics.totalEvents).toBe(2);
      expect(result.metrics.streamDuration).toBeGreaterThan(0);
    });

    it('should handle scenario timeout with partial results', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      const slowScenario: StreamTestScenario = {
        name: 'Timeout Recovery Test',
        events: [
          { type: 'fast:event', data: { speed: 'fast' }, delay: 10 },
          { type: 'slow:event', data: { speed: 'slow' }, delay: 2000 }, // Will timeout
          { type: 'never:event', data: { speed: 'never' }, delay: 5000 } // Will never execute
        ],
        expectations: [
          {
            type: 'completion' as const,
            description: 'Should capture partial events',
            condition: (metrics) => metrics.totalEvents >= 1
          }
        ],
        timeout: 500 // Short timeout
      };

      await expect(
        streamingCapture.runStreamingScenario(slowScenario)
      ).rejects.toThrow('Scenario timeout');

      // Should still have captured the fast event
      const events = streamingCapture.getStreamingEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('fast:event');
      expect(events[0].data.speed).toBe('fast');

      // Streaming should still be functional after timeout
      streamingCapture.resetStreaming();
      streamingCapture.startStreamingTest(['post:timeout']);
      emitter.emit('post:timeout', { afterTimeout: true });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 1,
        1000
      );

      const postTimeoutEvents = streamingCapture.getStreamingEvents();
      expect(postTimeoutEvents).toHaveLength(1);
      expect(postTimeoutEvents[0].data.afterTimeout).toBe(true);
    });

    it('should handle corrupted scenario data', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      const corruptedScenario: StreamTestScenario = {
        name: 'Corrupted Data Test',
        events: [
          // Invalid delay types
          { type: 'test:event1', data: {}, delay: 'invalid' as any },
          { type: 'test:event2', data: {}, delay: null as any },
          { type: 'test:event3', data: {}, delay: undefined as any },

          // Valid event for comparison
          { type: 'test:event4', data: { valid: true }, delay: 10 }
        ],
        expectations: [
          {
            type: 'completion' as const,
            description: 'Should handle corrupted events',
            condition: (metrics) => metrics.totalEvents >= 1
          }
        ],
        timeout: 1000
      };

      // Should not throw despite invalid data
      const result = await streamingCapture.runStreamingScenario(corruptedScenario);

      expect(result.passed).toBe(true);
      expect(result.metrics.totalEvents).toBeGreaterThanOrEqual(1);

      // Should have handled the valid event
      const events = streamingCapture.getStreamingEvents();
      const validEvent = events.find(e => e.data.valid === true);
      expect(validEvent).toBeDefined();
    });
  });

  describe('Memory Leak and Resource Recovery', () => {
    it('should recover from memory leaks in event handlers', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 50
      });

      const leakyData: any[] = [];

      // Set up a "leaky" event handler
      emitter.on('leaky:event', (data) => {
        // Simulate memory leak by keeping references
        leakyData.push(data);

        // Also create some temporary large objects
        const waste = new Array(1000).fill('memory-waste');
        // Intentionally don't clean up
      });

      streamingCapture.startStreamingTest(['leaky:event']);

      // Generate many events that could cause memory issues
      for (let i = 0; i < 200; i++) {
        emitter.emit('leaky:event', {
          index: i,
          largePayload: new Array(500).fill(`leak-test-${i}`)
        });

        // Brief pause to allow garbage collection
        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = streamingCapture.endStreamingTest();

      // Should have applied backpressure due to buffer limits
      expect(metrics.backpressureCount).toBeGreaterThan(0);
      expect(metrics.totalEvents).toBeLessThanOrEqual(50);

      // Force garbage collection if available
      global.gc && global.gc();

      // Memory usage should be bounded despite leaky handlers
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(200 * 1024 * 1024); // < 200MB

      // Streaming should still be functional
      streamingCapture.resetStreaming();
      streamingCapture.startStreamingTest(['post:leak']);
      emitter.emit('post:leak', { afterLeak: true });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 1,
        1000
      );

      const postLeakEvents = streamingCapture.getStreamingEvents();
      expect(postLeakEvents).toHaveLength(1);

      // Clean up
      leakyData.length = 0;
    });

    it('should handle disposal during active streaming', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['disposal:test']);

      // Start emitting events
      const emissionInterval = setInterval(() => {
        emitter.emit('disposal:test', {
          timestamp: Date.now(),
          message: 'Should handle disposal gracefully'
        });
      }, 50);

      // Let some events be emitted
      await new Promise(resolve => setTimeout(resolve, 200));

      const eventsBeforeDisposal = streamingCapture.getStreamingEvents();
      expect(eventsBeforeDisposal.length).toBeGreaterThan(0);

      // Dispose while events are still being emitted
      streamingCapture.dispose();

      // Continue emitting (should not crash)
      await new Promise(resolve => setTimeout(resolve, 200));

      clearInterval(emissionInterval);

      // Should not throw when accessing disposed capture
      expect(() => streamingCapture.getStreamingEvents()).not.toThrow();
      expect(() => streamingCapture.getStreamMetrics()).not.toThrow();

      // New capture should work normally
      const newCapture = createStreamingEventCapture(emitter);
      newCapture.startStreamingTest(['post:disposal']);
      emitter.emit('post:disposal', { afterDisposal: true });

      await newCapture.waitForStreamingEvents(
        events => events.length === 1,
        1000
      );

      const newEvents = newCapture.getStreamingEvents();
      expect(newEvents).toHaveLength(1);
      expect(newEvents[0].data.afterDisposal).toBe(true);

      newCapture.dispose();
    });

    it('should recover from assertion calculation errors', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      // Create events with problematic timing data
      const problematicEvents = [
        {
          type: 'problem:event',
          data: {},
          timestamp: new Date(),
          index: 0,
          timing: {
            emittedAt: new Date(NaN), // Invalid date
            capturedAt: new Date(),
            latency: Infinity, // Invalid latency
            sequence: 0
          },
          expected: true
        },
        {
          type: 'problem:event',
          data: {},
          timestamp: new Date(),
          index: 1,
          timing: {
            emittedAt: new Date(),
            capturedAt: new Date(NaN), // Invalid date
            latency: -100, // Negative latency
            sequence: 1
          },
          expected: true
        }
      ];

      // Inject problematic events
      (streamingCapture as any).streamingEvents = problematicEvents;

      // Assertions should not throw despite invalid data
      expect(() => {
        const latencyResult = streamingCapture.assertStreamLatency(100);
        expect(latencyResult).toBeDefined();
      }).not.toThrow();

      expect(() => {
        const orderingResult = streamingCapture.assertStreamOrdering();
        expect(orderingResult).toBeDefined();
      }).not.toThrow();

      expect(() => {
        const metrics = streamingCapture.getStreamMetrics();
        expect(metrics).toBeDefined();
        expect(metrics.totalEvents).toBe(2);
      }).not.toThrow();

      expect(() => {
        const consistencyResult = StreamingAssertions.assertConsistency(problematicEvents);
        expect(consistencyResult).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Concurrent Error Scenarios', () => {
    it('should handle errors across multiple concurrent captures', async () => {
      const captures: StreamingEventCapture[] = [];
      const emitters: EventEmitter[] = [];

      try {
        // Create multiple captures with potential error conditions
        for (let i = 0; i < 5; i++) {
          const testEmitter = new EventEmitter();
          const capture = createStreamingEventCapture(testEmitter, {}, {
            streamBufferSize: 10 // Small buffer to trigger backpressure
          });

          capture.startStreamingTest([`concurrent:test:${i}`]);
          captures.push(capture);
          emitters.push(testEmitter);
        }

        // Emit events concurrently, with some triggering errors
        const emissionPromises = emitters.map(async (testEmitter, index) => {
          for (let j = 0; j < 20; j++) {
            if (index === 2 && j === 10) {
              // Simulate error in one emitter
              testEmitter.emit('error', new Error(`Simulated error in emitter ${index}`));
            }

            testEmitter.emit(`concurrent:test:${index}`, {
              emitterIndex: index,
              eventIndex: j,
              timestamp: Date.now()
            });

            // Some delay to allow processing
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        });

        await Promise.all(emissionPromises);
        await new Promise(resolve => setTimeout(resolve, 100));

        // All captures should have some events despite errors
        captures.forEach((capture, index) => {
          const events = capture.getStreamingEvents();
          const metrics = capture.endStreamingTest();

          expect(events.length).toBeGreaterThan(0);
          expect(metrics.totalEvents).toBeGreaterThan(0);

          // Capture 2 might have fewer events due to the error, but should still function
          if (index !== 2) {
            expect(events.length).toBeGreaterThan(15);
          }
        });

      } finally {
        captures.forEach(capture => capture.dispose());
      }
    });

    it('should handle cascading failures gracefully', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 20
      });

      streamingCapture.startStreamingTest(['cascade:test']);

      let failureCount = 0;

      // Set up cascading failure scenario
      emitter.on('cascade:test', (data) => {
        if (data.trigger === 'failure') {
          failureCount++;

          if (failureCount < 3) {
            // Trigger more failures
            process.nextTick(() => {
              emitter.emit('cascade:test', {
                trigger: 'failure',
                cascade: failureCount + 1
              });
            });
          }

          throw new Error(`Cascading failure ${failureCount}`);
        }
      });

      let errorsCaught = 0;
      emitter.on('error', () => {
        errorsCaught++;
      });

      // Start the cascade
      expect(() => {
        emitter.emit('cascade:test', { trigger: 'failure', cascade: 1 });
      }).toThrow();

      // Wait for cascade to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Emit normal events to verify recovery
      for (let i = 0; i < 5; i++) {
        emitter.emit('cascade:test', {
          trigger: 'normal',
          index: i,
          afterCascade: true
        });
      }

      await streamingCapture.waitForStreamingEvents(
        events => events.filter(e => e.data.trigger === 'normal').length >= 5,
        1000
      );

      const events = streamingCapture.getStreamingEvents();
      const normalEvents = events.filter(e => e.data.trigger === 'normal');
      const failureEvents = events.filter(e => e.data.trigger === 'failure');

      // Should have recovered and captured normal events
      expect(normalEvents.length).toBe(5);
      expect(normalEvents.every(e => e.data.afterCascade)).toBe(true);

      // May or may not have captured failure events depending on timing
      expect(failureCount).toBe(3); // Cascade should have completed
      expect(errorsCaught).toBeGreaterThan(0);
    });
  });
});