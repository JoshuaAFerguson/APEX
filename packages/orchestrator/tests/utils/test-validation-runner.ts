/**
 * Test validation runner - Validates that all test imports and basic functionality work
 * This serves as a quick validation that all tests are properly structured
 */

// Test all imports from streaming utilities
import {
  StreamingEventCapture,
  createStreamingEventCapture,
  StreamingTestUtils,
  StreamingAssertions,
  type StreamingTestConfig,
  type StreamingEvent,
  type StreamMetrics,
  type StreamTestScenario
} from './streaming-test-utils';

// Test all imports from event capture
import {
  EventCapture,
  createEventCapture,
  createConfirmationEventCapture,
  type CapturedEvent,
  type EventCaptureOptions
} from './event-capture';

// Test unified exports
import * as TestUtils from './index';

import { EventEmitter } from 'eventemitter3';

/**
 * Validation test suite - checks basic functionality without running full test suites
 */
export class TestValidationRunner {
  private validationResults: Array<{ test: string; passed: boolean; error?: string }> = [];

  /**
   * Run all validation tests
   */
  async runValidation(): Promise<boolean> {
    console.log('🧪 Starting Test Validation Runner...\n');

    // Basic import validation
    this.validateImports();

    // Basic functionality validation
    await this.validateBasicEventCapture();
    await this.validateBasicStreamingCapture();
    await this.validateStreamingScenarios();
    await this.validateStreamingAssertions();
    await this.validateErrorHandling();

    // Report results
    this.reportResults();

    return this.validationResults.every(result => result.passed);
  }

  /**
   * Validate all imports work correctly
   */
  private validateImports(): void {
    try {
      // Check class constructors
      if (typeof EventCapture !== 'function') throw new Error('EventCapture not a constructor');
      if (typeof StreamingEventCapture !== 'function') throw new Error('StreamingEventCapture not a constructor');

      // Check factory functions
      if (typeof createEventCapture !== 'function') throw new Error('createEventCapture not a function');
      if (typeof createStreamingEventCapture !== 'function') throw new Error('createStreamingEventCapture not a function');

      // Check utility objects
      if (typeof StreamingTestUtils !== 'object') throw new Error('StreamingTestUtils not an object');
      if (typeof StreamingAssertions !== 'object') throw new Error('StreamingAssertions not an object');

      // Check unified exports
      if (!TestUtils.EventCapture) throw new Error('TestUtils.EventCapture not exported');
      if (!TestUtils.StreamingEventCapture) throw new Error('TestUtils.StreamingEventCapture not exported');

      this.addResult('Import Validation', true);
    } catch (error: any) {
      this.addResult('Import Validation', false, error.message);
    }
  }

  /**
   * Validate basic EventCapture functionality
   */
  private async validateBasicEventCapture(): Promise<void> {
    try {
      const emitter = new EventEmitter();
      const capture = createEventCapture(emitter, { autoStart: false });

      // Test basic lifecycle
      capture.start();
      emitter.emit('test:event', { data: 'validation' });
      await new Promise(resolve => setTimeout(resolve, 10));

      const events = capture.getAllEvents();
      if (events.length !== 1) throw new Error(`Expected 1 event, got ${events.length}`);
      if (events[0].type !== 'test:event') throw new Error('Event type mismatch');
      if (events[0].data.data !== 'validation') throw new Error('Event data mismatch');

      // Test assertions
      capture.expectEventEmitted('test:event');
      capture.expectEventCount('test:event', 1);

      capture.dispose();
      this.addResult('Basic EventCapture', true);
    } catch (error: any) {
      this.addResult('Basic EventCapture', false, error.message);
    }
  }

  /**
   * Validate basic StreamingEventCapture functionality
   */
  private async validateBasicStreamingCapture(): Promise<void> {
    try {
      const emitter = new EventEmitter();
      const streamingCapture = createStreamingEventCapture(emitter);

      // Test streaming lifecycle
      streamingCapture.startStreamingTest(['test:streaming']);
      emitter.emit('test:streaming', { data: 'streaming-validation' });

      const streamingEvents = await streamingCapture.waitForStreamingEvents(
        events => events.length >= 1,
        1000
      );

      if (streamingEvents.length !== 1) {
        throw new Error(`Expected 1 streaming event, got ${streamingEvents.length}`);
      }

      const event = streamingEvents[0];
      if (!event.timing) throw new Error('Missing timing information');
      if (event.timing.latency < 0) throw new Error('Invalid latency');
      if (!event.timing.sequence && event.timing.sequence !== 0) throw new Error('Missing sequence');

      const metrics = streamingCapture.endStreamingTest();
      if (metrics.totalEvents !== 1) throw new Error('Metrics mismatch');
      if (metrics.streamDuration <= 0) throw new Error('Invalid stream duration');

      streamingCapture.dispose();
      this.addResult('Basic StreamingEventCapture', true);
    } catch (error: any) {
      this.addResult('Basic StreamingEventCapture', false, error.message);
    }
  }

  /**
   * Validate streaming scenarios
   */
  private async validateStreamingScenarios(): Promise<void> {
    try {
      const emitter = new EventEmitter();
      const streamingCapture = createStreamingEventCapture(emitter);

      // Test high throughput scenario
      const scenario = StreamingTestUtils.createHighThroughputScenario(5, 50);
      if (!scenario.events || scenario.events.length !== 5) {
        throw new Error('High throughput scenario creation failed');
      }

      const result = await streamingCapture.runStreamingScenario(scenario);

      if (!result.passed) {
        throw new Error('High throughput scenario failed');
      }

      if (result.metrics.totalEvents !== 5) {
        throw new Error('Scenario metrics mismatch');
      }

      // Test low latency scenario
      const lowLatencyScenario = StreamingTestUtils.createLowLatencyScenario(100);
      if (!lowLatencyScenario.events) {
        throw new Error('Low latency scenario creation failed');
      }

      streamingCapture.dispose();
      this.addResult('Streaming Scenarios', true);
    } catch (error: any) {
      this.addResult('Streaming Scenarios', false, error.message);
    }
  }

  /**
   * Validate streaming assertions
   */
  private async validateStreamingAssertions(): Promise<void> {
    try {
      const emitter = new EventEmitter();
      const streamingCapture = createStreamingEventCapture(emitter);

      streamingCapture.startStreamingTest(['assertion:test']);
      emitter.emit('assertion:test', { test: true });

      await streamingCapture.waitForStreamingEvents(
        events => events.length >= 1,
        500
      );

      // Test latency assertion
      const latencyResult = streamingCapture.assertStreamLatency(1000);
      if (!latencyResult.passed) {
        throw new Error('Latency assertion failed unexpectedly');
      }

      // Test ordering assertion
      const orderingResult = streamingCapture.assertStreamOrdering();
      if (!orderingResult.passed) {
        throw new Error('Ordering assertion failed unexpectedly');
      }

      // Test completeness assertion
      const completenessResult = streamingCapture.assertStreamCompleteness();
      if (!completenessResult.passed) {
        throw new Error('Completeness assertion failed unexpectedly');
      }

      const metrics = streamingCapture.endStreamingTest();

      // Test performance assertions
      const perfResults = StreamingAssertions.assertPerformance(metrics, {
        minEventsPerSecond: 0, // Very lenient
        maxLatency: 10000,
        maxBackpressure: 100
      });

      if (!perfResults.every(r => r.passed)) {
        throw new Error('Performance assertions failed');
      }

      // Test consistency assertion
      const events = streamingCapture.getStreamingEvents();
      const consistencyResult = StreamingAssertions.assertConsistency(events);
      if (!consistencyResult.passed) {
        throw new Error('Consistency assertion failed');
      }

      streamingCapture.dispose();
      this.addResult('Streaming Assertions', true);
    } catch (error: any) {
      this.addResult('Streaming Assertions', false, error.message);
    }
  }

  /**
   * Validate error handling
   */
  private async validateErrorHandling(): Promise<void> {
    try {
      const emitter = new EventEmitter();
      const streamingCapture = createStreamingEventCapture(emitter);

      // Test with invalid configuration (should not throw)
      const invalidConfigCapture = createStreamingEventCapture(emitter, {}, {
        streamTimeout: -1000,
        expectedEventsPerSecond: -50,
        maxLatency: -100
      });

      invalidConfigCapture.startStreamingTest(['error:test']);
      emitter.emit('error:test', { invalid: null });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not crash
      const events = invalidConfigCapture.getStreamingEvents();
      if (!Array.isArray(events)) {
        throw new Error('Invalid config caused system failure');
      }

      invalidConfigCapture.dispose();

      // Test disposal during active streaming
      streamingCapture.startStreamingTest(['disposal:test']);
      emitter.emit('disposal:test', { beforeDisposal: true });

      streamingCapture.dispose(); // Should not throw

      // Should handle post-disposal access gracefully
      const postDisposalEvents = streamingCapture.getStreamingEvents();
      if (!Array.isArray(postDisposalEvents)) {
        throw new Error('Post-disposal access failed');
      }

      this.addResult('Error Handling', true);
    } catch (error: any) {
      this.addResult('Error Handling', false, error.message);
    }
  }

  /**
   * Add a validation result
   */
  private addResult(test: string, passed: boolean, error?: string): void {
    this.validationResults.push({ test, passed, error });
  }

  /**
   * Report validation results
   */
  private reportResults(): void {
    console.log('\n📊 Validation Results:');
    console.log('=' .repeat(50));

    let passedCount = 0;
    let failedCount = 0;

    this.validationResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${result.test}`);

      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    });

    console.log('=' .repeat(50));
    console.log(`Total: ${this.validationResults.length} tests`);
    console.log(`✅ Passed: ${passedCount}`);
    console.log(`❌ Failed: ${failedCount}`);

    if (failedCount === 0) {
      console.log('\n🎉 All validation tests passed! Tests are ready to run.');
    } else {
      console.log('\n⚠️  Some validation tests failed. Please check the errors above.');
    }
  }
}

/**
 * Run validation if this file is executed directly
 */
export async function runValidation(): Promise<boolean> {
  const runner = new TestValidationRunner();
  return await runner.runValidation();
}

// Export for use in other files
export default TestValidationRunner;