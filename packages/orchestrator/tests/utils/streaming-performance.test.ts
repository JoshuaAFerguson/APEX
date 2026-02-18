/**
 * Performance and stress tests for streaming test utilities
 * Tests high-load scenarios, sustained performance, and resource usage
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

describe('Streaming Performance and Stress Tests', () => {
  let emitter: EventEmitter;
  let streamingCapture: StreamingEventCapture;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    streamingCapture?.dispose();
  });

  describe('High Throughput Performance', () => {
    it('should handle 1000 events/second sustained rate', async () => {
      const config: StreamingTestConfig = {
        streamBufferSize: 2000,
        expectedEventsPerSecond: 1000,
        maxLatency: 50
      };

      streamingCapture = createStreamingEventCapture(emitter, {}, config);

      const scenario = StreamingTestUtils.createHighThroughputScenario(2000, 1000);

      const startTime = Date.now();
      const result = await streamingCapture.runStreamingScenario(scenario);
      const duration = Date.now() - startTime;

      expect(result.passed).toBe(true);
      expect(result.metrics.totalEvents).toBe(2000);
      expect(result.metrics.eventsPerSecond).toBeGreaterThan(800); // Allow some tolerance
      expect(duration).toBeLessThan(4000); // Should complete within 4 seconds

      // Detailed performance analysis
      expect(result.metrics.averageLatency).toBeLessThan(100);
      expect(result.metrics.maxLatency).toBeLessThan(200);
      expect(result.metrics.backpressureCount).toBeLessThan(10);
    }, 10000); // 10 second timeout

    it('should maintain consistent performance across multiple bursts', async () => {
      const config: StreamingTestConfig = {
        streamBufferSize: 500,
        expectedEventsPerSecond: 200,
        maxLatency: 100
      };

      streamingCapture = createStreamingEventCapture(emitter, {}, config);
      streamingCapture.startStreamingTest(['burst:test']);

      const burstResults: number[] = [];

      // Run 5 bursts of 100 events each
      for (let burst = 0; burst < 5; burst++) {
        const burstStart = Date.now();

        // Emit 100 events rapidly
        for (let i = 0; i < 100; i++) {
          emitter.emit('burst:test', {
            burst,
            eventIndex: i,
            timestamp: Date.now()
          });
          // Small delay to simulate realistic rate
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        const burstDuration = Date.now() - burstStart;
        const burstThroughput = (100 * 1000) / burstDuration;
        burstResults.push(burstThroughput);

        // Brief pause between bursts
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await new Promise(resolve => setTimeout(resolve, 200));
      const metrics = streamingCapture.endStreamingTest();

      // All bursts should maintain similar throughput
      const avgThroughput = burstResults.reduce((sum, rate) => sum + rate, 0) / burstResults.length;
      const throughputVariance = Math.max(...burstResults) - Math.min(...burstResults);

      expect(metrics.totalEvents).toBe(500);
      expect(avgThroughput).toBeGreaterThan(150);
      expect(throughputVariance).toBeLessThan(100); // Consistent performance
    }, 15000);

    it('should handle mixed event sizes under high load', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 1000,
        maxLatency: 200
      });

      streamingCapture.startStreamingTest(['small:event', 'medium:event', 'large:event']);

      const eventCount = 300;
      const startTime = Date.now();

      // Emit mix of different sized events
      for (let i = 0; i < eventCount; i++) {
        const eventType = i % 3;

        if (eventType === 0) {
          // Small event
          emitter.emit('small:event', { index: i, size: 'small' });
        } else if (eventType === 1) {
          // Medium event
          emitter.emit('medium:event', {
            index: i,
            size: 'medium',
            data: new Array(100).fill(`medium-${i}`)
          });
        } else {
          // Large event
          emitter.emit('large:event', {
            index: i,
            size: 'large',
            data: new Array(1000).fill(`large-${i}`),
            metadata: {
              timestamp: Date.now(),
              description: 'Large event with significant payload'
            }
          });
        }

        // Maintain high rate
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      await streamingCapture.waitForStreamingEvents(
        events => events.length >= eventCount,
        5000
      );

      const duration = Date.now() - startTime;
      const metrics = streamingCapture.endStreamingTest();
      const events = streamingCapture.getStreamingEvents();

      // Verify all event types captured
      const smallEvents = events.filter(e => e.type === 'small:event');
      const mediumEvents = events.filter(e => e.type === 'medium:event');
      const largeEvents = events.filter(e => e.type === 'large:event');

      expect(smallEvents.length).toBeGreaterThan(90);
      expect(mediumEvents.length).toBeGreaterThan(90);
      expect(largeEvents.length).toBeGreaterThan(90);

      // Performance should remain acceptable despite mixed sizes
      expect(metrics.eventsPerSecond).toBeGreaterThan(50);
      expect(metrics.averageLatency).toBeLessThan(300);
      expect(duration).toBeLessThan(8000);
    }, 15000);
  });

  describe('Memory Stress Tests', () => {
    it('should handle buffer overflow gracefully under sustained load', async () => {
      const smallBuffer = 25; // Very small buffer
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: smallBuffer,
        maxLatency: 100
      });

      streamingCapture.startStreamingTest(['overflow:test']);

      // Emit 5x more events than buffer can hold
      const totalEvents = smallBuffer * 5;

      for (let i = 0; i < totalEvents; i++) {
        emitter.emit('overflow:test', {
          index: i,
          timestamp: Date.now(),
          data: `Event ${i} data payload`
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const metrics = streamingCapture.endStreamingTest();
      const events = streamingCapture.getStreamingEvents();

      // Should not exceed buffer size
      expect(events.length).toBeLessThanOrEqual(smallBuffer);

      // Should have detected backpressure
      expect(metrics.backpressureCount).toBeGreaterThan(0);

      // Should retain most recent events
      const lastEvent = events[events.length - 1];
      expect(lastEvent.data.index).toBeGreaterThan(totalEvents - smallBuffer - 10);

      // Memory usage should be bounded
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // < 100MB
    });

    it('should handle rapid capture creation/disposal', async () => {
      const captures: StreamingEventCapture[] = [];

      try {
        // Create many captures rapidly
        for (let i = 0; i < 50; i++) {
          const capture = createStreamingEventCapture(emitter, {}, {
            streamBufferSize: 10
          });
          captures.push(capture);

          capture.startStreamingTest(['rapid:test']);

          // Emit a few events to each
          emitter.emit('rapid:test', { captureId: i, timestamp: Date.now() });
        }

        // Emit more events
        for (let i = 0; i < 100; i++) {
          emitter.emit('rapid:test', { batch: 2, index: i });
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify all captures are functional
        captures.forEach((capture, index) => {
          const events = capture.getStreamingEvents();
          expect(events.length).toBeGreaterThan(0);
        });

      } finally {
        // Clean up all captures
        captures.forEach(capture => capture.dispose());
      }

      // Memory should be released after disposal
      global.gc && global.gc(); // Force garbage collection if available
      const finalMemory = process.memoryUsage();
      expect(finalMemory.heapUsed).toBeLessThan(200 * 1024 * 1024); // < 200MB
    });

    it('should maintain performance with large event payloads', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 100,
        maxLatency: 500 // Relaxed for large payloads
      });

      streamingCapture.startStreamingTest(['large:payload']);

      const payloadSize = 50000; // ~50KB per event
      const eventCount = 20;

      for (let i = 0; i < eventCount; i++) {
        const largePayload = {
          eventId: i,
          timestamp: Date.now(),
          largeData: new Array(payloadSize).fill(`data-${i}`),
          metadata: {
            size: payloadSize,
            description: `Large event ${i} for memory stress testing`
          }
        };

        emitter.emit('large:payload', largePayload);

        // Brief pause to allow processing
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await streamingCapture.waitForStreamingEvents(
        events => events.length >= eventCount,
        10000
      );

      const metrics = streamingCapture.endStreamingTest();

      // Should handle large payloads without excessive latency
      expect(metrics.totalEvents).toBe(eventCount);
      expect(metrics.averageLatency).toBeLessThan(1000);
      expect(metrics.backpressureCount).toBe(0); // Shouldn't hit backpressure with only 20 events
    }, 20000);
  });

  describe('Concurrent Load Tests', () => {
    it('should handle multiple emitters concurrently', async () => {
      const emitter1 = new EventEmitter();
      const emitter2 = new EventEmitter();
      const emitter3 = new EventEmitter();

      const capture1 = createStreamingEventCapture(emitter1);
      const capture2 = createStreamingEventCapture(emitter2);
      const capture3 = createStreamingEventCapture(emitter3);

      try {
        capture1.startStreamingTest(['emitter1:event']);
        capture2.startStreamingTest(['emitter2:event']);
        capture3.startStreamingTest(['emitter3:event']);

        const eventCount = 100;

        // Emit events concurrently from all emitters
        const promises = [
          // Emitter 1: Fast rate
          (async () => {
            for (let i = 0; i < eventCount; i++) {
              emitter1.emit('emitter1:event', { source: 1, index: i });
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          })(),

          // Emitter 2: Medium rate
          (async () => {
            for (let i = 0; i < eventCount; i++) {
              emitter2.emit('emitter2:event', { source: 2, index: i });
              await new Promise(resolve => setTimeout(resolve, 20));
            }
          })(),

          // Emitter 3: Slow rate
          (async () => {
            for (let i = 0; i < eventCount; i++) {
              emitter3.emit('emitter3:event', { source: 3, index: i });
              await new Promise(resolve => setTimeout(resolve, 30));
            }
          })()
        ];

        await Promise.all(promises);

        // Wait for all captures to finish
        await Promise.all([
          capture1.waitForStreamingEvents(events => events.length >= eventCount, 5000),
          capture2.waitForStreamingEvents(events => events.length >= eventCount, 5000),
          capture3.waitForStreamingEvents(events => events.length >= eventCount, 5000)
        ]);

        const metrics1 = capture1.endStreamingTest();
        const metrics2 = capture2.endStreamingTest();
        const metrics3 = capture3.endStreamingTest();

        // All should have captured their events
        expect(metrics1.totalEvents).toBe(eventCount);
        expect(metrics2.totalEvents).toBe(eventCount);
        expect(metrics3.totalEvents).toBe(eventCount);

        // Performance should reflect different rates
        expect(metrics1.eventsPerSecond).toBeGreaterThan(metrics2.eventsPerSecond);
        expect(metrics2.eventsPerSecond).toBeGreaterThan(metrics3.eventsPerSecond);

      } finally {
        capture1.dispose();
        capture2.dispose();
        capture3.dispose();
      }
    }, 15000);

    it('should handle concurrent scenario execution', async () => {
      const scenarios: StreamTestScenario[] = [
        StreamingTestUtils.createHighThroughputScenario(50, 100),
        StreamingTestUtils.createLowLatencyScenario(25),
        StreamingTestUtils.createMixedEventScenario()
      ];

      const captures = scenarios.map(() => createStreamingEventCapture(new EventEmitter()));

      try {
        // Run all scenarios concurrently
        const results = await Promise.all(
          captures.map((capture, index) =>
            capture.runStreamingScenario(scenarios[index])
          )
        );

        // All scenarios should pass
        expect(results.every(result => result.passed)).toBe(true);

        // Verify individual results
        expect(results[0].metrics.totalEvents).toBe(50); // High throughput
        expect(results[1].metrics.maxLatency).toBeLessThanOrEqual(25); // Low latency
        expect(results[2].metrics.totalEvents).toBe(30); // Mixed events

      } finally {
        captures.forEach(capture => capture.dispose());
      }
    }, 10000);

    it('should maintain performance under CPU stress', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        expectedEventsPerSecond: 100,
        maxLatency: 200
      });

      streamingCapture.startStreamingTest(['cpu:stress']);

      // Create CPU stress in parallel
      const cpuStressPromise = new Promise<void>(resolve => {
        const startTime = Date.now();
        const stressDuration = 2000; // 2 seconds

        const stressWork = () => {
          const now = Date.now();
          if (now - startTime < stressDuration) {
            // CPU-intensive work
            let result = 0;
            for (let i = 0; i < 100000; i++) {
              result += Math.sqrt(Math.random() * 1000);
            }
            setImmediate(stressWork);
          } else {
            resolve();
          }
        };

        stressWork();
      });

      // Emit events while CPU is under stress
      const eventPromise = (async () => {
        for (let i = 0; i < 200; i++) {
          emitter.emit('cpu:stress', {
            index: i,
            timestamp: Date.now(),
            cpuLoad: process.cpuUsage()
          });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })();

      await Promise.all([cpuStressPromise, eventPromise]);

      await streamingCapture.waitForStreamingEvents(
        events => events.length >= 150, // Allow some tolerance under stress
        5000
      );

      const metrics = streamingCapture.endStreamingTest();

      // Should maintain reasonable performance despite CPU stress
      expect(metrics.totalEvents).toBeGreaterThan(150);
      expect(metrics.eventsPerSecond).toBeGreaterThan(50);
      expect(metrics.averageLatency).toBeLessThan(500);
    }, 10000);
  });

  describe('Long-Running Performance Tests', () => {
    it('should maintain stable performance over extended periods', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 500,
        expectedEventsPerSecond: 50,
        maxLatency: 100
      });

      streamingCapture.startStreamingTest(['endurance:test']);

      const testDuration = 5000; // 5 seconds
      const eventInterval = 20; // 50 events/sec
      const expectedEvents = Math.floor(testDuration / eventInterval);

      let eventCount = 0;
      const startTime = Date.now();

      const intervalId = setInterval(() => {
        const currentTime = Date.now();
        if (currentTime - startTime >= testDuration) {
          clearInterval(intervalId);
          return;
        }

        emitter.emit('endurance:test', {
          index: eventCount++,
          timestamp: currentTime,
          runtime: currentTime - startTime
        });
      }, eventInterval);

      // Wait for test completion
      await new Promise(resolve => setTimeout(resolve, testDuration + 500));

      const metrics = streamingCapture.endStreamingTest();

      // Should have maintained stable performance
      expect(metrics.totalEvents).toBeGreaterThan(expectedEvents * 0.9); // 90% tolerance
      expect(metrics.eventsPerSecond).toBeCloseTo(50, 10); // Within 10 events/sec
      expect(metrics.averageLatency).toBeLessThan(200);

      // No significant backpressure over time
      expect(metrics.backpressureCount).toBe(0);

      clearInterval(intervalId);
    }, 10000);

    it('should handle gradual performance degradation gracefully', async () => {
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: 200,
        maxLatency: 300
      });

      streamingCapture.startStreamingTest(['degradation:test']);

      const performanceResults: number[] = [];

      // Gradually increase event complexity and reduce intervals
      for (let phase = 0; phase < 5; phase++) {
        const phaseStart = Date.now();
        const eventComplexity = (phase + 1) * 1000; // Increasing payload size
        const eventInterval = Math.max(10, 50 - (phase * 10)); // Decreasing interval

        // Run phase for 1 second
        const phasePromise = new Promise<void>(resolve => {
          const phaseInterval = setInterval(() => {
            const now = Date.now();
            if (now - phaseStart >= 1000) {
              clearInterval(phaseInterval);
              resolve();
              return;
            }

            emitter.emit('degradation:test', {
              phase,
              timestamp: now,
              complexity: new Array(eventComplexity).fill(`phase-${phase}-data`)
            });
          }, eventInterval);
        });

        await phasePromise;

        // Measure performance for this phase
        const phaseDuration = Date.now() - phaseStart;
        const phaseEvents = streamingCapture.getStreamingEvents()
          .filter(e => e.data.phase === phase).length;
        const phasePerformance = (phaseEvents * 1000) / phaseDuration;

        performanceResults.push(phasePerformance);
      }

      const metrics = streamingCapture.endStreamingTest();

      // Should have handled all phases despite degradation
      expect(metrics.totalEvents).toBeGreaterThan(50);

      // Performance degradation should be gradual, not catastrophic
      const initialPerformance = performanceResults[0];
      const finalPerformance = performanceResults[performanceResults.length - 1];
      const degradationRatio = finalPerformance / initialPerformance;

      expect(degradationRatio).toBeGreaterThan(0.3); // Should retain at least 30% of initial performance
    }, 15000);
  });

  describe('Resource Limit Tests', () => {
    it('should respect memory limits and prevent out-of-memory', async () => {
      const veryLargeBuffer = 10000;
      streamingCapture = createStreamingEventCapture(emitter, {}, {
        streamBufferSize: veryLargeBuffer
      });

      streamingCapture.startStreamingTest(['memory:limit']);

      // Try to emit more events than should be reasonable for memory
      const massiveEventCount = 50000;

      for (let i = 0; i < massiveEventCount; i++) {
        emitter.emit('memory:limit', {
          index: i,
          data: new Array(100).fill(`event-${i}-data`)
        });

        // Periodic check to prevent blocking
        if (i % 1000 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = streamingCapture.endStreamingTest();

      // Should have applied backpressure to prevent memory issues
      expect(metrics.backpressureCount).toBeGreaterThan(0);
      expect(metrics.totalEvents).toBeLessThan(massiveEventCount);

      // Memory usage should be reasonable
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // < 500MB
    }, 20000);

    it('should handle file descriptor limits with many captures', async () => {
      const captures: StreamingEventCapture[] = [];

      try {
        // Create many captures (testing resource limits)
        const captureCount = 100;

        for (let i = 0; i < captureCount; i++) {
          const capture = createStreamingEventCapture(new EventEmitter(), {}, {
            streamBufferSize: 10 // Small buffer to reduce memory usage
          });

          capture.startStreamingTest([`fd:test:${i}`]);
          captures.push(capture);
        }

        // Emit events to all captures
        captures.forEach((capture, index) => {
          (capture as any).emitter.emit(`fd:test:${index}`, {
            captureIndex: index,
            timestamp: Date.now()
          });
        });

        await new Promise(resolve => setTimeout(resolve, 200));

        // All captures should be functional
        captures.forEach((capture, index) => {
          const events = capture.getStreamingEvents();
          expect(events.length).toBe(1);
          expect(events[0].data.captureIndex).toBe(index);
        });

      } finally {
        // Clean up all resources
        captures.forEach(capture => {
          try {
            capture.dispose();
          } catch (error) {
            console.warn('Error disposing capture:', error);
          }
        });
      }
    });
  });
});