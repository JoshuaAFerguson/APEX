/**
 * Streaming Test Utilities for Real-Time Event Testing
 *
 * Provides utilities for testing real-time streaming scenarios with the APEX orchestrator.
 * Extends the basic EventCapture with streaming-specific capabilities like:
 * - Real-time event assertion
 * - Stream timing validation
 * - Concurrent event stream testing
 * - Stream performance monitoring
 * - Event backpressure testing
 */

import { EventEmitter } from 'eventemitter3';
import { EventCapture, type CapturedEvent, type EventCaptureOptions } from './event-capture';

/**
 * Configuration for streaming test scenarios
 */
export interface StreamingTestConfig {
  /** Maximum time to wait for streaming events (ms) */
  streamTimeout?: number;
  /** Expected events per second for performance testing */
  expectedEventsPerSecond?: number;
  /** Maximum acceptable latency between event emission and capture (ms) */
  maxLatency?: number;
  /** Whether to validate event ordering strictly */
  strictOrdering?: boolean;
  /** Buffer size for streaming tests */
  streamBufferSize?: number;
  /** Concurrency level for multi-stream testing */
  concurrencyLevel?: number;
}

/**
 * Stream timing information for performance analysis
 */
export interface StreamTimingInfo {
  /** Event emission timestamp */
  emittedAt: Date;
  /** Event capture timestamp */
  capturedAt: Date;
  /** Latency in milliseconds */
  latency: number;
  /** Sequence number in the stream */
  sequence: number;
}

/**
 * Stream performance metrics
 */
export interface StreamMetrics {
  /** Total events processed */
  totalEvents: number;
  /** Events per second */
  eventsPerSecond: number;
  /** Average latency in ms */
  averageLatency: number;
  /** Maximum latency in ms */
  maxLatency: number;
  /** Minimum latency in ms */
  minLatency: number;
  /** Stream duration in ms */
  streamDuration: number;
  /** Number of out-of-order events */
  outOfOrderEvents: number;
  /** Backpressure occurrences */
  backpressureCount: number;
}

/**
 * Real-time streaming event with timing metadata
 */
export interface StreamingEvent extends CapturedEvent {
  /** Stream timing information */
  timing: StreamTimingInfo;
  /** Whether this event was expected in the current test */
  expected: boolean;
  /** Stream ID for multi-stream scenarios */
  streamId?: string;
}

/**
 * Stream assertion result
 */
export interface StreamAssertionResult {
  /** Whether the assertion passed */
  passed: boolean;
  /** Assertion description */
  description: string;
  /** Actual value observed */
  actual: unknown;
  /** Expected value */
  expected: unknown;
  /** Additional details */
  details?: string;
  /** Performance metrics if applicable */
  metrics?: Partial<StreamMetrics>;
}

/**
 * Stream test scenario definition
 */
export interface StreamTestScenario {
  /** Scenario name */
  name: string;
  /** Events to emit in order */
  events: Array<{ type: string; data: unknown; delay?: number }>;
  /** Expected streaming behavior */
  expectations: StreamingExpectation[];
  /** Scenario timeout */
  timeout: number;
}

/**
 * Streaming expectation definition
 */
export interface StreamingExpectation {
  type: 'latency' | 'throughput' | 'ordering' | 'completion' | 'backpressure';
  description: string;
  condition: (metrics: StreamMetrics, events: StreamingEvent[]) => boolean;
  timeout?: number;
}

/**
 * Enhanced EventCapture for streaming scenarios
 */
export class StreamingEventCapture extends EventCapture {
  private config: Required<StreamingTestConfig>;
  private streamingEvents: StreamingEvent[] = [];
  private streamStartTime?: Date;
  private streamEndTime?: Date;
  private eventSequence = 0;
  private expectedEventTypes: string[] = [];
  private backpressureCount = 0;

  constructor(
    emitter: EventEmitter,
    eventCaptureOptions: EventCaptureOptions = {},
    streamingConfig: StreamingTestConfig = {}
  ) {
    super(emitter, eventCaptureOptions);

    this.config = {
      streamTimeout: streamingConfig.streamTimeout ?? 10000,
      expectedEventsPerSecond: streamingConfig.expectedEventsPerSecond ?? 100,
      maxLatency: streamingConfig.maxLatency ?? 100,
      strictOrdering: streamingConfig.strictOrdering ?? true,
      streamBufferSize: streamingConfig.streamBufferSize ?? 1000,
      concurrencyLevel: streamingConfig.concurrencyLevel ?? 1,
    };

    this.setupStreamingListeners();
  }

  /**
   * Start streaming test with expected event types
   */
  startStreamingTest(expectedEventTypes: string[]): void {
    this.expectedEventTypes = expectedEventTypes;
    this.streamingEvents = [];
    this.eventSequence = 0;
    this.streamStartTime = new Date();
    this.streamEndTime = undefined;
    this.start();
  }

  /**
   * End streaming test
   */
  endStreamingTest(): StreamMetrics {
    this.stop();
    this.streamEndTime = new Date();
    return this.calculateStreamMetrics();
  }

  /**
   * Wait for streaming events to meet criteria
   */
  async waitForStreamingEvents(
    criteria: (events: StreamingEvent[]) => boolean,
    timeout: number = this.config.streamTimeout
  ): Promise<StreamingEvent[]> {
    return new Promise((resolve, reject) => {
      const checkCriteria = () => {
        if (criteria(this.streamingEvents)) {
          resolve([...this.streamingEvents]);
          return;
        }
      };

      // Check immediately
      checkCriteria();

      const intervalId = setInterval(checkCriteria, 10);
      const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        reject(new Error(`Streaming criteria not met within ${timeout}ms`));
      }, timeout);

      // Clean up when resolved
      const originalResolve = resolve;
      resolve = (value) => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        originalResolve(value);
      };
    });
  }

  /**
   * Assert streaming latency is within acceptable bounds
   */
  assertStreamLatency(maxLatency: number = this.config.maxLatency): StreamAssertionResult {
    const events = this.streamingEvents;
    const exceedsLatency = events.filter(e => e.timing.latency > maxLatency);

    const passed = exceedsLatency.length === 0;
    const averageLatency = events.length > 0
      ? events.reduce((sum, e) => sum + e.timing.latency, 0) / events.length
      : 0;

    return {
      passed,
      description: `Stream latency should be <= ${maxLatency}ms`,
      expected: maxLatency,
      actual: Math.max(...events.map(e => e.timing.latency), 0),
      details: passed
        ? `All ${events.length} events within latency bounds (avg: ${averageLatency.toFixed(2)}ms)`
        : `${exceedsLatency.length}/${events.length} events exceeded ${maxLatency}ms latency`,
      metrics: { averageLatency, maxLatency: Math.max(...events.map(e => e.timing.latency), 0) }
    };
  }

  /**
   * Assert streaming throughput meets requirements
   */
  assertStreamThroughput(
    expectedEventsPerSecond: number = this.config.expectedEventsPerSecond
  ): StreamAssertionResult {
    const metrics = this.calculateStreamMetrics();
    const passed = metrics.eventsPerSecond >= expectedEventsPerSecond;

    return {
      passed,
      description: `Stream throughput should be >= ${expectedEventsPerSecond} events/sec`,
      expected: expectedEventsPerSecond,
      actual: metrics.eventsPerSecond,
      details: `Achieved ${metrics.eventsPerSecond.toFixed(2)} events/sec over ${metrics.streamDuration}ms`,
      metrics
    };
  }

  /**
   * Assert event ordering is correct
   */
  assertStreamOrdering(): StreamAssertionResult {
    if (!this.config.strictOrdering) {
      return {
        passed: true,
        description: 'Stream ordering check skipped (strict ordering disabled)',
        expected: 'any order',
        actual: 'any order'
      };
    }

    const events = this.streamingEvents;
    const outOfOrderCount = events.reduce((count, event, index) => {
      if (index > 0 && event.timing.sequence < events[index - 1].timing.sequence) {
        return count + 1;
      }
      return count;
    }, 0);

    const passed = outOfOrderCount === 0;

    return {
      passed,
      description: 'Events should be captured in order of emission',
      expected: 0,
      actual: outOfOrderCount,
      details: passed
        ? `All ${events.length} events in correct order`
        : `${outOfOrderCount} events out of order`,
      metrics: { outOfOrderEvents: outOfOrderCount }
    };
  }

  /**
   * Assert all expected events were captured
   */
  assertStreamCompleteness(): StreamAssertionResult {
    const capturedTypes = new Set(this.streamingEvents.map(e => e.type));
    const expectedTypes = new Set(this.expectedEventTypes);
    const missingTypes = Array.from(expectedTypes).filter(type => !capturedTypes.has(type));
    const unexpectedTypes = Array.from(capturedTypes).filter(type => !expectedTypes.has(type));

    const passed = missingTypes.length === 0;

    return {
      passed,
      description: 'All expected event types should be captured',
      expected: Array.from(expectedTypes).sort(),
      actual: Array.from(capturedTypes).sort(),
      details: passed
        ? `All ${expectedTypes.size} expected event types captured`
        : `Missing: [${missingTypes.join(', ')}]${unexpectedTypes.length > 0 ? `, Unexpected: [${unexpectedTypes.join(', ')}]` : ''}`,
      metrics: { totalEvents: this.streamingEvents.length }
    };
  }

  /**
   * Run complete streaming test scenario
   */
  async runStreamingScenario(scenario: StreamTestScenario): Promise<{
    passed: boolean;
    results: StreamAssertionResult[];
    metrics: StreamMetrics;
  }> {
    const { events: scenarioEvents, expectations, timeout } = scenario;

    // Start streaming test
    this.startStreamingTest(scenarioEvents.map(e => e.type));

    // Emit events according to scenario
    const emitPromise = this.emitScenarioEvents(scenarioEvents);

    try {
      // Wait for all events to be emitted
      await Promise.race([
        emitPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Scenario timeout')), timeout)
        )
      ]);

      // Small delay to ensure all events are captured
      await new Promise(resolve => setTimeout(resolve, 50));

      // Run all expectations
      const results = await this.runStreamingExpectations(expectations);
      const metrics = this.endStreamingTest();

      return {
        passed: results.every(r => r.passed),
        results,
        metrics
      };
    } catch (error) {
      this.endStreamingTest();
      throw error;
    }
  }

  /**
   * Get streaming events with timing information
   */
  getStreamingEvents(): StreamingEvent[] {
    return [...this.streamingEvents];
  }

  /**
   * Get stream performance metrics
   */
  getStreamMetrics(): StreamMetrics {
    return this.calculateStreamMetrics();
  }

  /**
   * Reset streaming state
   */
  resetStreaming(): void {
    this.streamingEvents = [];
    this.eventSequence = 0;
    this.streamStartTime = undefined;
    this.streamEndTime = undefined;
    this.expectedEventTypes = [];
    this.backpressureCount = 0;
    this.reset();
  }

  /**
   * Setup streaming-specific event listeners
   */
  private setupStreamingListeners(): void {
    // Override the base event capture to add timing info
    this.on = ((originalOn) => {
      return (event: string, listener: (...args: any[]) => void) => {
        if (event === 'message' || event === 'error') {
          const wrappedListener = (capturedEvent: CapturedEvent) => {
            const streamingEvent = this.enhanceWithStreamingInfo(capturedEvent);
            this.streamingEvents.push(streamingEvent);

            // Check for backpressure
            if (this.streamingEvents.length > this.config.streamBufferSize) {
              this.backpressureCount++;
              this.streamingEvents = this.streamingEvents.slice(-this.config.streamBufferSize);
            }

            listener(streamingEvent);
          };
          return originalOn.call(this, event, wrappedListener);
        }
        return originalOn.call(this, event, listener);
      };
    })(this.on.bind(this));
  }

  /**
   * Enhance captured event with streaming information
   */
  private enhanceWithStreamingInfo(event: CapturedEvent): StreamingEvent {
    const now = new Date();
    const timing: StreamTimingInfo = {
      emittedAt: event.timestamp,
      capturedAt: now,
      latency: now.getTime() - event.timestamp.getTime(),
      sequence: this.eventSequence++
    };

    return {
      ...event,
      timing,
      expected: this.expectedEventTypes.includes(event.type)
    };
  }

  /**
   * Calculate comprehensive stream metrics
   */
  private calculateStreamMetrics(): StreamMetrics {
    const events = this.streamingEvents;
    const start = this.streamStartTime?.getTime() || 0;
    const end = this.streamEndTime?.getTime() || Date.now();
    const duration = end - start;

    if (events.length === 0) {
      return {
        totalEvents: 0,
        eventsPerSecond: 0,
        averageLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        streamDuration: duration,
        outOfOrderEvents: 0,
        backpressureCount: this.backpressureCount
      };
    }

    const latencies = events.map(e => e.timing.latency);
    const outOfOrderCount = events.reduce((count, event, index) => {
      if (index > 0 && event.timing.sequence < events[index - 1].timing.sequence) {
        return count + 1;
      }
      return count;
    }, 0);

    return {
      totalEvents: events.length,
      eventsPerSecond: duration > 0 ? (events.length * 1000) / duration : 0,
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
      maxLatency: Math.max(...latencies),
      minLatency: Math.min(...latencies),
      streamDuration: duration,
      outOfOrderEvents: outOfOrderCount,
      backpressureCount: this.backpressureCount
    };
  }

  /**
   * Emit events according to scenario timing
   */
  private async emitScenarioEvents(events: Array<{ type: string; data: unknown; delay?: number }>): Promise<void> {
    for (const event of events) {
      if (event.delay) {
        await new Promise(resolve => setTimeout(resolve, event.delay));
      }

      // Emit through the original emitter to simulate real events
      (this as any).emitter.emit(event.type, event.data);
    }
  }

  /**
   * Run streaming expectations and collect results
   */
  private async runStreamingExpectations(expectations: StreamingExpectation[]): Promise<StreamAssertionResult[]> {
    const results: StreamAssertionResult[] = [];

    for (const expectation of expectations) {
      const metrics = this.calculateStreamMetrics();
      const events = this.streamingEvents;

      const passed = expectation.condition(metrics, events);

      results.push({
        passed,
        description: expectation.description,
        expected: 'condition met',
        actual: passed ? 'condition met' : 'condition failed',
        details: `${expectation.type} expectation: ${expectation.description}`,
        metrics
      });
    }

    return results;
  }
}

/**
 * Create streaming event capture with default configuration
 */
export function createStreamingEventCapture(
  emitter: EventEmitter,
  options: EventCaptureOptions = {},
  streamingConfig: StreamingTestConfig = {}
): StreamingEventCapture {
  return new StreamingEventCapture(emitter, {
    autoStart: false, // We'll start manually for streaming tests
    maxEvents: streamingConfig.streamBufferSize || 1000,
    ...options
  }, streamingConfig);
}

/**
 * Utility functions for common streaming test scenarios
 */
export class StreamingTestUtils {
  /**
   * Create high-throughput streaming scenario
   */
  static createHighThroughputScenario(
    eventCount: number,
    eventsPerSecond: number
  ): StreamTestScenario {
    const events = Array.from({ length: eventCount }, (_, i) => ({
      type: 'test:high-throughput',
      data: { index: i, timestamp: Date.now() },
      delay: i > 0 ? 1000 / eventsPerSecond : 0
    }));

    return {
      name: 'High Throughput Test',
      events,
      expectations: [
        {
          type: 'throughput',
          description: `Should achieve ${eventsPerSecond} events/sec`,
          condition: (metrics) => metrics.eventsPerSecond >= eventsPerSecond * 0.9 // 90% tolerance
        },
        {
          type: 'completion',
          description: `Should capture all ${eventCount} events`,
          condition: (metrics) => metrics.totalEvents === eventCount
        }
      ],
      timeout: (eventCount / eventsPerSecond + 2) * 1000 // Add 2 second buffer
    };
  }

  /**
   * Create low-latency streaming scenario
   */
  static createLowLatencyScenario(maxLatency: number): StreamTestScenario {
    const events = Array.from({ length: 20 }, (_, i) => ({
      type: 'test:low-latency',
      data: { index: i, timestamp: Date.now() },
      delay: i > 0 ? 100 : 0 // 10 events/sec
    }));

    return {
      name: 'Low Latency Test',
      events,
      expectations: [
        {
          type: 'latency',
          description: `All events should have latency <= ${maxLatency}ms`,
          condition: (metrics) => metrics.maxLatency <= maxLatency
        },
        {
          type: 'ordering',
          description: 'Events should maintain order',
          condition: (metrics) => metrics.outOfOrderEvents === 0
        }
      ],
      timeout: 5000
    };
  }

  /**
   * Create mixed event type streaming scenario
   */
  static createMixedEventScenario(): StreamTestScenario {
    const eventTypes = ['task:started', 'approval:required', 'task:completed'];
    const events = Array.from({ length: 30 }, (_, i) => ({
      type: eventTypes[i % eventTypes.length],
      data: { taskId: `task-${Math.floor(i / eventTypes.length)}`, step: i },
      delay: i > 0 ? 50 : 0
    }));

    return {
      name: 'Mixed Event Types Test',
      events,
      expectations: [
        {
          type: 'completion',
          description: 'Should capture all event types',
          condition: (_, events) => {
            const types = new Set(events.map(e => e.type));
            return eventTypes.every(type => types.has(type));
          }
        },
        {
          type: 'ordering',
          description: 'Should maintain sequence order',
          condition: (metrics) => metrics.outOfOrderEvents === 0
        }
      ],
      timeout: 3000
    };
  }
}

/**
 * Streaming test assertion helpers
 */
export class StreamingAssertions {
  /**
   * Assert that streaming meets performance requirements
   */
  static assertPerformance(
    metrics: StreamMetrics,
    requirements: {
      minEventsPerSecond?: number;
      maxLatency?: number;
      maxBackpressure?: number;
    }
  ): StreamAssertionResult[] {
    const results: StreamAssertionResult[] = [];

    if (requirements.minEventsPerSecond !== undefined) {
      results.push({
        passed: metrics.eventsPerSecond >= requirements.minEventsPerSecond,
        description: `Throughput should be >= ${requirements.minEventsPerSecond} events/sec`,
        expected: requirements.minEventsPerSecond,
        actual: metrics.eventsPerSecond
      });
    }

    if (requirements.maxLatency !== undefined) {
      results.push({
        passed: metrics.maxLatency <= requirements.maxLatency,
        description: `Max latency should be <= ${requirements.maxLatency}ms`,
        expected: requirements.maxLatency,
        actual: metrics.maxLatency
      });
    }

    if (requirements.maxBackpressure !== undefined) {
      results.push({
        passed: metrics.backpressureCount <= requirements.maxBackpressure,
        description: `Backpressure events should be <= ${requirements.maxBackpressure}`,
        expected: requirements.maxBackpressure,
        actual: metrics.backpressureCount
      });
    }

    return results;
  }

  /**
   * Assert stream consistency
   */
  static assertConsistency(events: StreamingEvent[]): StreamAssertionResult {
    let issues: string[] = [];

    // Check for duplicate sequence numbers
    const sequences = events.map(e => e.timing.sequence);
    const uniqueSequences = new Set(sequences);
    if (sequences.length !== uniqueSequences.size) {
      issues.push('Duplicate sequence numbers detected');
    }

    // Check timestamp consistency
    const timestampIssues = events.filter((event, i) =>
      event.timing.capturedAt < event.timing.emittedAt ||
      (i > 0 && event.timing.emittedAt < events[i-1].timing.emittedAt)
    );
    if (timestampIssues.length > 0) {
      issues.push(`${timestampIssues.length} timestamp inconsistencies`);
    }

    return {
      passed: issues.length === 0,
      description: 'Stream should be consistent',
      expected: 'no inconsistencies',
      actual: issues.length > 0 ? issues.join(', ') : 'consistent',
      details: issues.length > 0 ? `Issues found: ${issues.join(', ')}` : undefined
    };
  }
}