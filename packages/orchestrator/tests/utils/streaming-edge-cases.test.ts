/**
 * Edge case tests for streaming test utilities
 * Covers boundary conditions, error scenarios, and unusual configurations
 */

import { EventEmitter } from 'eventemitter3';
import {
  StreamingEventCapture,
  createStreamingEventCapture,
  StreamingTestUtils,
  StreamingAssertions,
  type StreamingTestConfig,
  type StreamingEvent,
  type StreamTestScenario,
  type StreamMetrics
} from './streaming-test-utils';

describe('Streaming Test Utilities - Edge Cases', () => {
  let emitter: EventEmitter;
  let streamingCapture: StreamingEventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    streamingCapture?.dispose();
  });

  describe('Boundary Conditions', () => {
    it('should handle zero events gracefully', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest([]);

      // Don't emit any events
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = streamingCapture.endStreamingTest();

      expect(metrics.totalEvents).toBe(0);
      expect(metrics.eventsPerSecond).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.streamDuration).toBeGreaterThan(0);
    });

    it('should handle single event streaming', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['single:event']);

      emitter.emit('single:event', { data: 'only' });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 1,
        1000
      );

      const metrics = streamingCapture.endStreamingTest();
      const events = streamingCapture.getStreamingEvents();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('single:event');
      expect(events[0].data).toEqual({ data: 'only' });
      expect(metrics.totalEvents).toBe(1);
    });

    it('should handle extremely high event rates', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 100, // Small buffer to test overflow
        maxLatency: 1000 // Relaxed latency for high throughput
      });

      streamingCapture.startStreamingTest(['burst:event']);

      // Emit 200 events rapidly (more than buffer size)
      for (let i = 0; i < 200; i++) {
        emitter.emit('burst:event', { index: i, timestamp: Date.now() });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = streamingCapture.endStreamingTest();
      const events = streamingCapture.getStreamingEvents();

      // Should have hit backpressure
      expect(metrics.backpressureCount).toBeGreaterThan(0);
      expect(events.length).toBeLessThanOrEqual(100);
      expect(metrics.totalEvents).toBeLessThanOrEqual(100);
    });

    it('should handle events with extremely large payloads', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['large:payload']);

      const largeData = {
        hugArray: new Array(10000).fill('large data string'),
        metadata: {
          timestamp: Date.now(),
          description: 'Test with large payload to verify memory handling'
        }
      };

      emitter.emit('large:payload', largeData);

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 1,
        1000
      );

      const events = streamingCapture.getStreamingEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.hugArray).toHaveLength(10000);
      expect(events[0].data.metadata.description).toBeDefined();
    });
  });

  describe('Timing Edge Cases', () => {
    it('should handle events emitted before streaming starts', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      // Emit events before starting streaming test
      emitter.emit('early:event1', { timing: 'before' });
      emitter.emit('early:event2', { timing: 'before' });

      streamingCapture.startStreamingTest(['early:event1', 'early:event2', 'late:event']);

      // Emit event after starting
      emitter.emit('late:event', { timing: 'after' });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 1, // Only the late event should be captured
        1000
      );

      const events = streamingCapture.getStreamingEvents();

      // Only events after startStreamingTest should be captured
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('late:event');
      expect(events[0].data.timing).toBe('after');
    });

    it('should handle rapid start/stop cycling', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      for (let cycle = 0; cycle < 5; cycle++) {
        streamingCapture.startStreamingTest(['cycle:event']);

        emitter.emit('cycle:event', { cycle });

        await new Promise(resolve => setTimeout(resolve, 10));
        streamingCapture.endStreamingTest();
        streamingCapture.resetStreaming();
      }

      // Final test
      streamingCapture.startStreamingTest(['final:event']);
      emitter.emit('final:event', { final: true });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 1,
        500
      );

      const events = streamingCapture.getStreamingEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('final:event');
    });

    it('should handle concurrent streaming captures on same emitter', async () => {
      const capture1 = createStreamingEventCapture(emitter);
      const capture2 = createStreamingEventCapture(emitter);

      try {
        capture1.startStreamingTest(['shared:event']);
        capture2.startStreamingTest(['shared:event']);

        emitter.emit('shared:event', { source: 'test', id: 1 });
        emitter.emit('shared:event', { source: 'test', id: 2 });

        await Promise.all([
          capture1.waitForStreamingEvents(events => events.length === 2, 1000),
          capture2.waitForStreamingEvents(events => events.length === 2, 1000)
        ]);

        const events1 = capture1.getStreamingEvents();
        const events2 = capture2.getStreamingEvents();

        // Both captures should have captured the same events
        expect(events1).toHaveLength(2);
        expect(events2).toHaveLength(2);

        // Verify both captured the same data
        expect(events1[0].data.id).toBe(1);
        expect(events1[1].data.id).toBe(2);
        expect(events2[0].data.id).toBe(1);
        expect(events2[1].data.id).toBe(2);

      } finally {
        capture1.dispose();
        capture2.dispose();
      }
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle invalid configuration gracefully', () => {
      const invalidConfig: StreamingTestConfig = {
        streamTimeout: -1000,
        expectedEventsPerSecond: -50,
        maxLatency: -100,
        streamBufferSize: 0,
        strictOrdering: undefined as any,
        concurrencyLevel: -1
      };

      expect(() => {
        streamingCapture = createStreamingEventCapture(emitter, {}, invalidConfig);
      }).not.toThrow();

      // Should use default values for invalid configs
      streamingCapture.startStreamingTest(['test:event']);
      emitter.emit('test:event', { test: true });

      // Should still work despite invalid config
      expect(streamingCapture.getStreamingEvents()).toBeDefined();
    });

    it('should handle undefined and null event data', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['null:event', 'undefined:event', 'empty:event']);

      emitter.emit('null:event', null);
      emitter.emit('undefined:event', undefined);
      emitter.emit('empty:event');

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 3,
        1000
      );

      const events = streamingCapture.getStreamingEvents();

      expect(events).toHaveLength(3);
      expect(events[0].data).toBeNull();
      expect(events[1].data).toBeUndefined();
      expect(events[2].data).toBeUndefined();

      // All should have timing information
      events.forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.latency).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle circular reference in event data', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['circular:event']);

      const circularData: any = { name: 'circular' };
      circularData.self = circularData;

      // Should not throw when handling circular references
      expect(() => {
        emitter.emit('circular:event', circularData);
      }).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      const events = streamingCapture.getStreamingEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.name).toBe('circular');
    });
  });

  describe('Assertion Edge Cases', () => {
    it('should handle latency assertions with no events', () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['no:events']);

      // Don't emit any events
      const result = streamingCapture.assertStreamLatency(100);

      expect(result.passed).toBe(true); // No events = no latency violations
      expect(result.actual).toBe(0);
    });

    it('should handle throughput assertions with zero duration', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['instant:events']);

      // Emit events immediately
      for (let i = 0; i < 5; i++) {
        emitter.emit('instant:events', { index: i });
      }

      // End immediately (very short duration)
      const metrics = streamingCapture.endStreamingTest();

      const result = streamingCapture.assertStreamThroughput(10);

      // Should handle division by zero gracefully
      expect(result).toBeDefined();
      expect(typeof result.actual).toBe('number');
      expect(result.actual).not.toBe(Infinity);
      expect(result.actual).not.toBeNaN();
    });

    it('should handle completeness assertions with unexpected events', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['expected:event']);

      // Emit expected and unexpected events
      emitter.emit('expected:event', { expected: true });
      emitter.emit('unexpected:event', { expected: false });
      emitter.emit('another:unexpected', { surprise: true });

      await new Promise(resolve => setTimeout(resolve, 100));

      const result = streamingCapture.assertStreamCompleteness();

      expect(result.passed).toBe(true); // All expected events were captured
      expect(result.details).toContain('Unexpected');
    });

    it('should handle ordering assertions with duplicate sequence numbers', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      // Manually create events with duplicate sequences to test edge case
      const duplicateEvents: StreamingEvent[] = [
        {
          type: 'duplicate:event',
          data: { index: 0 },
          timestamp: new Date(),
          index: 0,
          timing: {
            emittedAt: new Date(),
            capturedAt: new Date(),
            latency: 10,
            sequence: 0
          },
          expected: true
        },
        {
          type: 'duplicate:event',
          data: { index: 1 },
          timestamp: new Date(),
          index: 1,
          timing: {
            emittedAt: new Date(),
            capturedAt: new Date(),
            latency: 10,
            sequence: 0 // Same sequence number
          },
          expected: true
        }
      ];

      // Add events directly to test consistency checker
      (streamingCapture as any).streamingEvents = duplicateEvents;

      const consistencyResult = StreamingAssertions.assertConsistency(duplicateEvents);

      expect(consistencyResult.passed).toBe(false);
      expect(consistencyResult.details).toContain('Duplicate sequence numbers');
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle memory pressure with large event counts', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 50 // Small buffer to force memory management
      });

      streamingCapture.startStreamingTest(['memory:test']);

      // Emit more events than buffer can hold
      for (let i = 0; i < 100; i++) {
        emitter.emit('memory:test', {
          index: i,
          largeData: new Array(1000).fill(`data-${i}`)
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = streamingCapture.endStreamingTest();
      const events = streamingCapture.getStreamingEvents();

      // Should have managed memory appropriately
      expect(events.length).toBeLessThanOrEqual(50);
      expect(metrics.backpressureCount).toBeGreaterThan(0);

      // Most recent events should be retained
      const lastEvent = events[events.length - 1];
      expect(lastEvent.data.index).toBeGreaterThan(50);
    });

    it('should clean up resources after disposal', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['cleanup:test']);

      emitter.emit('cleanup:test', { before: 'disposal' });

      await new Promise(resolve => setTimeout(resolve, 50));

      const eventsBeforeDisposal = streamingCapture.getStreamingEvents();
      expect(eventsBeforeDisposal).toHaveLength(1);

      // Dispose the capture
      streamingCapture.dispose();

      // Events after disposal should not be captured
      emitter.emit('cleanup:test', { after: 'disposal' });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not crash when trying to access disposed capture
      expect(() => streamingCapture.getStreamingEvents()).not.toThrow();
    });

    it('should handle emitter removal during streaming', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['removal:test']);

      emitter.emit('removal:test', { phase: 'before' });

      // Simulate emitter being removed/destroyed
      emitter.removeAllListeners();

      // Should not throw when trying to emit after listeners removed
      expect(() => {
        emitter.emit('removal:test', { phase: 'after' });
      }).not.toThrow();

      // Capture should still function
      const events = streamingCapture.getStreamingEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.phase).toBe('before');
    });
  });

  describe('Scenario Edge Cases', () => {
    it('should handle scenario with no expectations', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      const scenarioWithNoExpectations: StreamTestScenario = {
        name: 'No Expectations Test',
        events: [
          { type: 'test:event', data: { test: true }, delay: 10 }
        ],
        expectations: [], // No expectations
        timeout: 1000
      };

      const result = await streamingCapture.runStreamingScenario(scenarioWithNoExpectations);

      expect(result.passed).toBe(true); // Should pass with no expectations
      expect(result.results).toHaveLength(0);
      expect(result.metrics.totalEvents).toBe(1);
    });

    it('should handle scenario timeout with partial completion', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      const slowScenario: StreamTestScenario = {
        name: 'Timeout Test',
        events: [
          { type: 'fast:event', data: {}, delay: 10 },
          { type: 'slow:event', data: {}, delay: 2000 } // Will timeout
        ],
        expectations: [
          {
            type: 'completion' as const,
            description: 'Should complete all events',
            condition: (metrics) => metrics.totalEvents === 2
          }
        ],
        timeout: 500 // Short timeout
      };

      await expect(
        streamingCapture.runStreamingScenario(slowScenario)
      ).rejects.toThrow('Scenario timeout');

      // Should have captured partial events
      const events = streamingCapture.getStreamingEvents();
      expect(events.length).toBeLessThan(2);
    });

    it('should handle scenario with invalid event delays', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      const invalidDelayScenario: StreamTestScenario = {
        name: 'Invalid Delay Test',
        events: [
          { type: 'test:event1', data: {}, delay: -100 }, // Negative delay
          { type: 'test:event2', data: {}, delay: Infinity }, // Invalid delay
          { type: 'test:event3', data: {}, delay: NaN } // NaN delay
        ],
        expectations: [],
        timeout: 1000
      };

      // Should not throw despite invalid delays
      const result = await streamingCapture.runStreamingScenario(invalidDelayScenario);

      expect(result.passed).toBe(true);
      expect(result.metrics.totalEvents).toBe(3);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle extremely low throughput requirements', async () => {
      streamingCapture = createStreamingEventCapture(emitter);

      const lowThroughputScenario = StreamingTestUtils.createHighThroughputScenario(2, 0.1); // 0.1 events/sec

      const result = await streamingCapture.runStreamingScenario(lowThroughputScenario);

      expect(result.passed).toBe(true);
      expect(result.metrics.totalEvents).toBe(2);
      expect(result.metrics.streamDuration).toBeGreaterThan(10000); // Should take > 10 seconds
    });

    it('should handle zero latency tolerance', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        maxLatency: 0 // Zero tolerance
      });

      streamingCapture.startStreamingTest(['zero:latency']);

      emitter.emit('zero:latency', { test: true });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 1,
        500
      );

      const latencyResult = streamingCapture.assertStreamLatency(0);

      // Any measurable latency should fail
      expect(latencyResult.passed).toBe(false);
      expect(latencyResult.actual).toBeGreaterThan(0);
    });

    it('should handle performance requirements with floating point precision', async () => {
      streamingCapture = createStreamingEventCapture(emitter);
      streamingCapture.startStreamingTest(['precision:test']);

      // Emit events with precise timing
      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        emitter.emit('precision:test', {
          index: i,
          expectedTime: startTime + (i * 33.333) // 30 events/sec
        });
        await new Promise(resolve => setTimeout(resolve, 33.333));
      }

      const metrics = streamingCapture.endStreamingTest();

      // Test floating point precision in performance calculations
      expect(metrics.eventsPerSecond).toBeCloseTo(30, 1);
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);

      const perfResults = StreamingAssertions.assertPerformance(metrics, {
        minEventsPerSecond: 29.9, // Very precise requirement
        maxLatency: 50
      });

      expect(perfResults).toHaveLength(2);
    });
  });
});