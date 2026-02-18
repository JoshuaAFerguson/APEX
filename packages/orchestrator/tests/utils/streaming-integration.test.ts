/**
 * Integration tests for streaming utilities with real orchestrator scenarios
 */

import { EventEmitter } from 'eventemitter3';
import {
  createStreamingEventCapture,
  StreamingTestUtils,
  StreamingAssertions,
  type StreamingTestConfig,
  type StreamTestScenario
} from './streaming-test-utils';
import { createEventCapture } from './event-capture';

describe('Streaming Integration Tests', () => {
  let orchestratorEmitter: EventEmitter;
  let streamingCapture: ReturnType<typeof createStreamingEventCapture>;

  beforeEach(() => {
    orchestratorEmitter = new EventEmitter();
    streamingCapture = createStreamingEventCapture(orchestratorEmitter, {
      autoStart: false,
      maxEvents: 500
    }, {
      streamTimeout: 5000,
      maxLatency: 100,
      expectedEventsPerSecond: 50
    });
  });

  afterEach(() => {
    streamingCapture.dispose();
  });

  describe('Orchestrator Event Patterns', () => {
    it('should handle typical task execution flow', async () => {
      const taskEvents = [
        'task:created',
        'task:started',
        'stage:changed',
        'approval:required',
        'task:paused',
        'approval:granted',
        'task:resumed',
        'stage:changed',
        'task:completed'
      ];

      streamingCapture.startStreamingTest(taskEvents);

      const taskId = 'test-task-123';

      // Simulate task execution flow with realistic timings
      setTimeout(() => orchestratorEmitter.emit('task:created', { taskId, workflow: 'test-workflow' }), 0);
      setTimeout(() => orchestratorEmitter.emit('task:started', { taskId }), 50);
      setTimeout(() => orchestratorEmitter.emit('stage:changed', { taskId, stage: 'planning' }), 100);
      setTimeout(() => orchestratorEmitter.emit('approval:required', { taskId, gateName: 'review-gate' }), 150);
      setTimeout(() => orchestratorEmitter.emit('task:paused', { taskId, reason: 'approval' }), 175);

      // User approval after delay
      setTimeout(() => orchestratorEmitter.emit('approval:granted', { taskId, gateName: 'review-gate' }), 300);
      setTimeout(() => orchestratorEmitter.emit('task:resumed', { taskId }), 325);
      setTimeout(() => orchestratorEmitter.emit('stage:changed', { taskId, stage: 'implementation' }), 350);
      setTimeout(() => orchestratorEmitter.emit('task:completed', { taskId, result: 'success' }), 500);

      // Wait for all events
      await streamingCapture.waitForStreamingEvents(
        events => events.length === taskEvents.length,
        2000
      );

      const metrics = streamingCapture.endStreamingTest();
      const streamingEvents = streamingCapture.getStreamingEvents();

      // Verify all events captured
      expect(metrics.totalEvents).toBe(taskEvents.length);
      expect(streamingEvents.every(e => e.expected)).toBe(true);

      // Verify event sequence
      const capturedTypes = streamingEvents.map(e => e.type);
      expect(capturedTypes).toEqual(taskEvents);

      // Verify performance
      const latencyResult = streamingCapture.assertStreamLatency();
      expect(latencyResult.passed).toBe(true);

      const orderingResult = streamingCapture.assertStreamOrdering();
      expect(orderingResult.passed).toBe(true);

      const completenessResult = streamingCapture.assertStreamCompleteness();
      expect(completenessResult.passed).toBe(true);

      // Verify event data consistency
      const taskCreatedEvent = streamingEvents.find(e => e.type === 'task:created');
      const taskCompletedEvent = streamingEvents.find(e => e.type === 'task:completed');

      expect(taskCreatedEvent?.data).toMatchObject({ taskId, workflow: 'test-workflow' });
      expect(taskCompletedEvent?.data).toMatchObject({ taskId, result: 'success' });
    });

    it('should handle high-frequency agent communication', async () => {
      const agentEvents = [
        'agent:message',
        'agent:response',
        'agent:thinking',
        'agent:handoff'
      ];

      // Create high-throughput scenario
      const scenario = {
        name: 'Agent Communication Burst',
        events: Array.from({ length: 50 }, (_, i) => ({
          type: agentEvents[i % agentEvents.length],
          data: {
            agentId: `agent-${Math.floor(i / 4) + 1}`,
            message: `Message ${i}`,
            timestamp: Date.now()
          },
          delay: i > 0 ? 20 : 0 // 50 events/sec
        })),
        expectations: [
          {
            type: 'throughput' as const,
            description: 'Should maintain high throughput',
            condition: (metrics) => metrics.eventsPerSecond >= 40
          },
          {
            type: 'latency' as const,
            description: 'Should maintain low latency',
            condition: (metrics) => metrics.maxLatency <= 100
          }
        ],
        timeout: 3000
      };

      const result = await streamingCapture.runStreamingScenario(scenario);

      expect(result.passed).toBe(true);
      expect(result.metrics.totalEvents).toBe(50);
      expect(result.metrics.eventsPerSecond).toBeGreaterThan(40);
      expect(result.metrics.outOfOrderEvents).toBe(0);
    });

    it('should handle concurrent task streams', async () => {
      const task1Events = ['task1:started', 'task1:progress', 'task1:completed'];
      const task2Events = ['task2:started', 'task2:progress', 'task2:completed'];

      streamingCapture.startStreamingTest([...task1Events, ...task2Events]);

      // Simulate concurrent task execution
      const emitTaskEvents = (taskEvents: string[], taskId: string, startDelay: number) => {
        taskEvents.forEach((eventType, index) => {
          setTimeout(() => {
            orchestratorEmitter.emit(eventType, { taskId, step: index + 1 });
          }, startDelay + (index * 100));
        });
      };

      emitTaskEvents(task1Events, 'task-1', 0);
      emitTaskEvents(task2Events, 'task-2', 50); // Start 50ms later

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 6,
        2000
      );

      const metrics = streamingCapture.endStreamingTest();
      const events = streamingCapture.getStreamingEvents();

      expect(metrics.totalEvents).toBe(6);

      // Verify both task event sequences are present
      const task1EventsFound = events.filter(e => e.type.startsWith('task1:')).length;
      const task2EventsFound = events.filter(e => e.type.startsWith('task2:')).length;

      expect(task1EventsFound).toBe(3);
      expect(task2EventsFound).toBe(3);

      // Verify interleaving is handled correctly
      const orderingResult = streamingCapture.assertStreamOrdering();
      expect(orderingResult.passed).toBe(true);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle streaming errors gracefully', async () => {
      streamingCapture.startStreamingTest(['test:normal', 'test:error', 'test:recovery']);

      // Normal event
      orchestratorEmitter.emit('test:normal', { data: 'normal' });

      // Event that might cause processing error
      setTimeout(() => {
        try {
          orchestratorEmitter.emit('test:error', {
            circular: {} as any
          });
          // Create circular reference to potentially cause JSON serialization issues
          ((orchestratorEmitter as any).circular as any).circular = orchestratorEmitter;
        } catch (error) {
          // Expected to handle gracefully
        }
      }, 50);

      // Recovery event
      setTimeout(() => {
        orchestratorEmitter.emit('test:recovery', { data: 'recovered' });
      }, 100);

      await streamingCapture.waitForStreamingEvents(
        events => events.length >= 2, // At least normal and recovery
        1000
      );

      const events = streamingCapture.getStreamingEvents();
      const metrics = streamingCapture.endStreamingTest();

      // Should have captured at least the normal events
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.some(e => e.type === 'test:normal')).toBe(true);
      expect(events.some(e => e.type === 'test:recovery')).toBe(true);

      // Stream should still be functioning
      expect(metrics.totalEvents).toBeGreaterThanOrEqual(2);
    });

    it('should handle event buffer overflow', async () => {
      const smallBufferCapture = createStreamingEventCapture(orchestratorEmitter, {}, {
        streamBufferSize: 10 // Small buffer
      });

      smallBufferCapture.startStreamingTest(['test:overflow']);

      // Emit more events than buffer size
      const eventCount = 25;
      for (let i = 0; i < eventCount; i++) {
        orchestratorEmitter.emit('test:overflow', { index: i, timestamp: Date.now() });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = smallBufferCapture.getStreamMetrics();
      const events = smallBufferCapture.getStreamingEvents();

      // Should have detected backpressure
      expect(metrics.backpressureCount).toBeGreaterThan(0);

      // Should not exceed buffer size
      expect(events.length).toBeLessThanOrEqual(10);

      // Should have kept the most recent events
      const lastEvent = events[events.length - 1];
      expect(lastEvent.data).toMatchObject(
        expect.objectContaining({ index: expect.any(Number) })
      );

      smallBufferCapture.dispose();
    });
  });

  describe('Performance Benchmarking', () => {
    it('should benchmark event capture performance', async () => {
      const benchmarkConfig: StreamingTestConfig = {
        expectedEventsPerSecond: 100,
        maxLatency: 50,
        streamBufferSize: 1000
      };

      const benchmarkCapture = createStreamingEventCapture(
        orchestratorEmitter,
        {},
        benchmarkConfig
      );

      // Benchmark scenario: 200 events in 2 seconds (100 events/sec)
      const scenario = StreamingTestUtils.createHighThroughputScenario(200, 100);

      const startTime = Date.now();
      const result = await benchmarkCapture.runStreamingScenario(scenario);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      expect(result.passed).toBe(true);
      expect(result.metrics.totalEvents).toBe(200);
      expect(result.metrics.eventsPerSecond).toBeGreaterThan(80); // Allow some tolerance
      expect(totalDuration).toBeLessThan(3000); // Should complete within 3 seconds

      // Performance assertions
      const perfResults = StreamingAssertions.assertPerformance(result.metrics, {
        minEventsPerSecond: 80,
        maxLatency: 100,
        maxBackpressure: 5
      });

      expect(perfResults.every(r => r.passed)).toBe(true);

      benchmarkCapture.dispose();
    });

    it('should measure streaming consistency under load', async () => {
      const loadTestCapture = createStreamingEventCapture(orchestratorEmitter);

      loadTestCapture.startStreamingTest(['load:test']);

      // Generate sustained load
      const eventCount = 100;
      const interval = setInterval(() => {
        orchestratorEmitter.emit('load:test', {
          timestamp: Date.now(),
          load: Math.random()
        });
      }, 10); // 100 events/sec

      // Stop after eventCount events
      let emittedCount = 0;
      orchestratorEmitter.on('load:test', () => {
        emittedCount++;
        if (emittedCount >= eventCount) {
          clearInterval(interval);
        }
      });

      await loadTestCapture.waitForStreamingEvents(
        events => events.length >= eventCount,
        2000
      );

      const events = loadTestCapture.getStreamingEvents();
      const metrics = loadTestCapture.endStreamingTest();

      // Consistency checks
      const consistencyResult = StreamingAssertions.assertConsistency(events);
      expect(consistencyResult.passed).toBe(true);

      // Performance under load
      expect(metrics.totalEvents).toBeGreaterThanOrEqual(eventCount);
      expect(metrics.eventsPerSecond).toBeGreaterThan(50);
      expect(metrics.outOfOrderEvents).toBe(0);

      loadTestCapture.dispose();
    });
  });

  describe('Compatibility with EventCapture', () => {
    it('should work alongside regular EventCapture', async () => {
      const regularCapture = createEventCapture(orchestratorEmitter, { autoStart: true });

      streamingCapture.startStreamingTest(['compat:test']);

      // Emit test events
      orchestratorEmitter.emit('compat:test', { type: 'regular' });
      orchestratorEmitter.emit('compat:test', { type: 'streaming' });

      await streamingCapture.waitForStreamingEvents(
        events => events.length === 2,
        1000
      );

      // Both captures should have captured events
      const streamingEvents = streamingCapture.getStreamingEvents();
      const regularEvents = regularCapture.getAllEvents();

      expect(streamingEvents).toHaveLength(2);
      expect(regularEvents).toHaveLength(2);

      // Verify both have timing information (streaming has enhanced timing)
      streamingEvents.forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.latency).toBeGreaterThanOrEqual(0);
      });

      regularEvents.forEach(event => {
        expect(event.timestamp).toBeInstanceOf(Date);
      });

      // Both should support basic assertions
      streamingCapture.expectEventEmitted('compat:test');
      regularCapture.expectEventEmitted('compat:test');

      streamingCapture.expectEventCount('compat:test', 2);
      regularCapture.expectEventCount('compat:test', 2);

      streamingCapture.endStreamingTest();
      regularCapture.dispose();
    });
  });
});