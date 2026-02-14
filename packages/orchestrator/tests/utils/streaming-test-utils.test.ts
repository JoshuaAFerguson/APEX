/**
 * Comprehensive test suite for streaming test utilities
 */

import { EventEmitter } from 'eventemitter3';
import {
  StreamingEventCapture,
  createStreamingEventCapture,
  StreamingTestUtils,
  StreamingAssertions,
  type StreamingTestConfig,
  type StreamingEvent,
  type StreamMetrics
} from './streaming-test-utils';

describe('StreamingEventCapture', () => {
  let emitter: EventEmitter;
  let streamingCapture: StreamingEventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
    streamingCapture = createStreamingEventCapture(emitter);
  });

  afterEach(() => {
    streamingCapture.dispose();
  });

  describe('Basic Streaming Functionality', () => {
    it('should capture events with timing information', async () => {
      const expectedEvents = ['test:event1', 'test:event2'];
      streamingCapture.startStreamingTest(expectedEvents);

      // Emit events with small delays
      setTimeout(() => emitter.emit('test:event1', { data: 'first' }), 10);
      setTimeout(() => emitter.emit('test:event2', { data: 'second' }), 20);

      // Wait for events to be captured
      await streamingCapture.waitForStreamingEvents(
        events => events.length === 2,
        1000
      );

      const streamingEvents = streamingCapture.getStreamingEvents();
      const metrics = streamingCapture.endStreamingTest();

      expect(streamingEvents).toHaveLength(2);
      expect(streamingEvents[0].type).toBe('test:event1');
      expect(streamingEvents[1].type).toBe('test:event2');

      // Check timing information
      streamingEvents.forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.latency).toBeGreaterThanOrEqual(0);
        expect(event.timing.sequence).toBeGreaterThanOrEqual(0);
        expect(event.timing.emittedAt).toBeInstanceOf(Date);
        expect(event.timing.capturedAt).toBeInstanceOf(Date);
      });

      // Verify metrics
      expect(metrics.totalEvents).toBe(2);
      expect(metrics.streamDuration).toBeGreaterThan(0);
    });

    it('should maintain event sequence ordering', async () => {
      streamingCapture.startStreamingTest(['test:sequence']);

      // Emit events rapidly
      for (let i = 0; i < 10; i++) {
        emitter.emit('test:sequence', { index: i });
      }

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 10,
        1000
      );

      const events = streamingCapture.getStreamingEvents();

      // Check sequence numbers are incrementing
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timing.sequence).toBe(events[i-1].timing.sequence + 1);
      }

      const orderingResult = streamingCapture.assertStreamOrdering();
      expect(orderingResult.passed).toBe(true);
    });

    it('should calculate accurate stream metrics', async () => {
      const config: StreamingTestConfig = {
        expectedEventsPerSecond: 50,
        maxLatency: 100
      };

      streamingCapture = new StreamingEventCapture(emitter, {}, config);
      streamingCapture.startStreamingTest(['test:metrics']);

      // Emit events at known rate (100ms intervals = 10 events/sec)
      const eventCount = 5;
      for (let i = 0; i < eventCount; i++) {
        setTimeout(() => {
          emitter.emit('test:metrics', { index: i });
        }, i * 100);
      }

      await streamingCapture.waitForStreamingEvents(
        events => events.length === eventCount,
        2000
      );

      const metrics = streamingCapture.endStreamingTest();

      expect(metrics.totalEvents).toBe(eventCount);
      expect(metrics.eventsPerSecond).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.streamDuration).toBeGreaterThan(400); // At least 400ms for 5 events at 100ms intervals
    });
  });

  describe('Stream Assertions', () => {
    beforeEach(() => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        maxLatency: 50,
        expectedEventsPerSecond: 100
      });
    });

    it('should assert stream latency correctly', async () => {
      streamingCapture.startStreamingTest(['test:latency']);

      // Emit events quickly (should have low latency)
      for (let i = 0; i < 3; i++) {
        emitter.emit('test:latency', { index: i });
      }

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 3,
        1000
      );

      const latencyResult = streamingCapture.assertStreamLatency(100); // 100ms max
      expect(latencyResult.passed).toBe(true);
      expect(latencyResult.description).toContain('latency');
      expect(latencyResult.metrics).toBeDefined();
    });

    it('should detect latency violations', async () => {
      streamingCapture.startStreamingTest(['test:slow']);

      // Simulate slow event capture by manually creating events with high latency
      const slowEvent: StreamingEvent = {
        type: 'test:slow',
        data: { test: true },
        timestamp: new Date(Date.now() - 200), // 200ms ago
        index: 0,
        timing: {
          emittedAt: new Date(Date.now() - 200),
          capturedAt: new Date(),
          latency: 200, // High latency
          sequence: 0
        },
        expected: true
      };

      // Add directly to simulate captured event
      (streamingCapture as any).streamingEvents.push(slowEvent);

      const latencyResult = streamingCapture.assertStreamLatency(50); // 50ms max
      expect(latencyResult.passed).toBe(false);
      expect(latencyResult.actual).toBe(200);
    });

    it('should assert stream completeness', async () => {
      const expectedEvents = ['event:a', 'event:b', 'event:c'];
      streamingCapture.startStreamingTest(expectedEvents);

      // Emit all expected events
      expectedEvents.forEach(type => {
        emitter.emit(type, { timestamp: Date.now() });
      });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === expectedEvents.length,
        1000
      );

      const completenessResult = streamingCapture.assertStreamCompleteness();
      expect(completenessResult.passed).toBe(true);
      expect(completenessResult.details).toContain('All 3 expected event types captured');
    });

    it('should detect missing events', async () => {
      const expectedEvents = ['event:a', 'event:b', 'event:c'];
      streamingCapture.startStreamingTest(expectedEvents);

      // Only emit 2 of 3 expected events
      emitter.emit('event:a', {});
      emitter.emit('event:b', {});

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 2,
        500
      );

      const completenessResult = streamingCapture.assertStreamCompleteness();
      expect(completenessResult.passed).toBe(false);
      expect(completenessResult.details).toContain('Missing: [event:c]');
    });
  });

  describe('Streaming Scenarios', () => {
    it('should run high throughput scenario', async () => {
      const scenario = StreamingTestUtils.createHighThroughputScenario(10, 20); // 10 events at 20/sec

      const result = await streamingCapture.runStreamingScenario(scenario);

      expect(result.passed).toBe(true);
      expect(result.metrics.totalEvents).toBe(10);
      expect(result.metrics.eventsPerSecond).toBeGreaterThan(15); // Allow some tolerance
      expect(result.results).toHaveLength(2); // throughput + completion expectations
    });

    it('should run low latency scenario', async () => {
      const scenario = StreamingTestUtils.createLowLatencyScenario(100); // 100ms max latency

      const result = await streamingCapture.runStreamingScenario(scenario);

      expect(result.passed).toBe(true);
      expect(result.metrics.maxLatency).toBeLessThanOrEqual(100);
      expect(result.metrics.outOfOrderEvents).toBe(0);
    });

    it('should run mixed event scenario', async () => {
      const scenario = StreamingTestUtils.createMixedEventScenario();

      const result = await streamingCapture.runStreamingScenario(scenario);

      expect(result.passed).toBe(true);
      expect(result.metrics.totalEvents).toBe(30);

      // Check that all expected event types were captured
      const capturedTypes = new Set(streamingCapture.getStreamingEvents().map(e => e.type));
      expect(capturedTypes.has('task:started')).toBe(true);
      expect(capturedTypes.has('approval:required')).toBe(true);
      expect(capturedTypes.has('task:completed')).toBe(true);
    });

    it('should handle scenario timeout', async () => {
      const scenario = {
        name: 'Timeout Test',
        events: [
          { type: 'test:timeout', data: {}, delay: 2000 } // 2 second delay
        ],
        expectations: [],
        timeout: 1000 // 1 second timeout
      };

      await expect(
        streamingCapture.runStreamingScenario(scenario)
      ).rejects.toThrow('Scenario timeout');
    });
  });

  describe('Backpressure Handling', () => {
    it('should handle buffer overflow', async () => {
      const smallBufferCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 5 // Small buffer
      });

      smallBufferCapture.startStreamingTest(['test:overflow']);

      // Emit more events than buffer size
      for (let i = 0; i < 10; i++) {
        emitter.emit('test:overflow', { index: i });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = smallBufferCapture.getStreamMetrics();
      expect(metrics.backpressureCount).toBeGreaterThan(0);

      const events = smallBufferCapture.getStreamingEvents();
      expect(events.length).toBeLessThanOrEqual(5); // Should not exceed buffer size

      smallBufferCapture.dispose();
    });
  });

  describe('Performance Analysis', () => {
    it('should provide detailed performance metrics', async () => {
      streamingCapture.startStreamingTest(['perf:test']);

      const startTime = Date.now();
      const eventCount = 20;

      // Emit events with varying delays
      for (let i = 0; i < eventCount; i++) {
        setTimeout(() => {
          emitter.emit('perf:test', { index: i, timestamp: Date.now() });
        }, i * 25); // 40 events/sec
      }

      await streamingCapture.waitForStreamingEvents(
        events => events.length === eventCount,
        2000
      );

      const metrics = streamingCapture.endStreamingTest();
      const duration = Date.now() - startTime;

      expect(metrics.totalEvents).toBe(eventCount);
      expect(metrics.streamDuration).toBeGreaterThan(0);
      expect(metrics.streamDuration).toBeLessThanOrEqual(duration + 100); // Some tolerance
      expect(metrics.eventsPerSecond).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.minLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.maxLatency).toBeGreaterThanOrEqual(metrics.minLatency);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid streaming configurations gracefully', () => {
      expect(() => {
        createStreamingEventCapture(emitter, {}, {
          streamTimeout: -1000,
          expectedEventsPerSecond: 0,
          maxLatency: -50
        });
      }).not.toThrow();
    });

    it('should handle emitter errors during streaming', async () => {
      streamingCapture.startStreamingTest(['test:error']);

      // Emit valid event
      emitter.emit('test:error', { valid: true });

      // Emit error-causing event (this should not break streaming)
      try {
        emitter.emit('test:error', { toString: () => { throw new Error('toString error'); } });
      } catch {
        // Expected to throw
      }

      // Emit another valid event
      emitter.emit('test:error', { valid: true });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still have captured the valid events
      const events = streamingCapture.getStreamingEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Integration with EventCapture', () => {
    it('should extend EventCapture functionality', () => {
      expect(streamingCapture).toBeInstanceOf(EventCapture);

      // Should have all base EventCapture methods
      expect(typeof streamingCapture.getAllEvents).toBe('function');
      expect(typeof streamingCapture.getEventsByType).toBe('function');
      expect(typeof streamingCapture.expectEventEmitted).toBe('function');
      expect(typeof streamingCapture.waitForEvent).toBe('function');

      // Should have streaming-specific methods
      expect(typeof streamingCapture.startStreamingTest).toBe('function');
      expect(typeof streamingCapture.getStreamMetrics).toBe('function');
      expect(typeof streamingCapture.assertStreamLatency).toBe('function');
    });

    it('should maintain compatibility with base EventCapture assertions', async () => {
      streamingCapture.startStreamingTest(['test:compatibility']);

      emitter.emit('test:compatibility', { test: true });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 1,
        1000
      );

      // Base EventCapture assertions should still work
      streamingCapture.expectEventEmitted('test:compatibility');
      streamingCapture.expectEventCount('test:compatibility', 1);

      const events = streamingCapture.getAllEvents();
      expect(events).toHaveLength(1);
    });
  });
});

describe('StreamingAssertions', () => {
  describe('Performance Assertions', () => {
    it('should assert performance requirements', () => {
      const metrics: StreamMetrics = {
        totalEvents: 100,
        eventsPerSecond: 50,
        averageLatency: 25,
        maxLatency: 75,
        minLatency: 10,
        streamDuration: 2000,
        outOfOrderEvents: 0,
        backpressureCount: 2
      };

      const results = StreamingAssertions.assertPerformance(metrics, {
        minEventsPerSecond: 40,
        maxLatency: 100,
        maxBackpressure: 5
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.passed)).toBe(true);
    });

    it('should detect performance violations', () => {
      const metrics: StreamMetrics = {
        totalEvents: 50,
        eventsPerSecond: 25, // Below requirement
        averageLatency: 150,
        maxLatency: 250, // Above requirement
        minLatency: 50,
        streamDuration: 2000,
        outOfOrderEvents: 0,
        backpressureCount: 10 // Above requirement
      };

      const results = StreamingAssertions.assertPerformance(metrics, {
        minEventsPerSecond: 50,
        maxLatency: 100,
        maxBackpressure: 5
      });

      expect(results).toHaveLength(3);
      expect(results.filter(r => !r.passed)).toHaveLength(3); // All should fail
    });
  });

  describe('Consistency Assertions', () => {
    it('should validate stream consistency', () => {
      const events: StreamingEvent[] = [
        {
          type: 'test:event',
          data: {},
          timestamp: new Date('2023-01-01T10:00:00.000Z'),
          index: 0,
          timing: {
            emittedAt: new Date('2023-01-01T10:00:00.000Z'),
            capturedAt: new Date('2023-01-01T10:00:00.010Z'),
            latency: 10,
            sequence: 0
          },
          expected: true
        },
        {
          type: 'test:event',
          data: {},
          timestamp: new Date('2023-01-01T10:00:00.100Z'),
          index: 1,
          timing: {
            emittedAt: new Date('2023-01-01T10:00:00.100Z'),
            capturedAt: new Date('2023-01-01T10:00:00.110Z'),
            latency: 10,
            sequence: 1
          },
          expected: true
        }
      ];

      const result = StreamingAssertions.assertConsistency(events);
      expect(result.passed).toBe(true);
    });

    it('should detect timestamp inconsistencies', () => {
      const events: StreamingEvent[] = [
        {
          type: 'test:event',
          data: {},
          timestamp: new Date('2023-01-01T10:00:00.000Z'),
          index: 0,
          timing: {
            emittedAt: new Date('2023-01-01T10:00:00.000Z'),
            capturedAt: new Date('2023-01-01T09:59:59.990Z'), // Captured before emitted!
            latency: -10,
            sequence: 0
          },
          expected: true
        }
      ];

      const result = StreamingAssertions.assertConsistency(events);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('timestamp inconsistencies');
    });
  });
});

describe('Factory Functions', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    // Clean up any open captures
  });

  it('should create streaming capture with default options', () => {
    const capture = createStreamingEventCapture(emitter);

    expect(capture).toBeInstanceOf(StreamingEventCapture);
    expect(capture.getStreamMetrics().totalEvents).toBe(0);

    capture.dispose();
  });

  it('should create streaming capture with custom configuration', () => {
    const capture = createStreamingEventCapture(
      emitter,
      { maxEvents: 100 },
      {
        streamTimeout: 5000,
        expectedEventsPerSecond: 200,
        maxLatency: 25
      }
    );

    expect(capture).toBeInstanceOf(StreamingEventCapture);

    capture.dispose();
  });
});