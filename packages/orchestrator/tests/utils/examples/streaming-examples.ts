/**
 * Examples demonstrating streaming test utilities usage
 * These examples show real-world use cases for the streaming test utilities
 */

import { EventEmitter } from 'eventemitter3';
import {
  createStreamingEventCapture,
  StreamingTestUtils,
  StreamingAssertions,
  type StreamTestScenario,
  type StreamingTestConfig
} from '../streaming-test-utils';

/**
 * Example 1: Basic Task Execution Streaming Test
 */
export async function exampleBasicTaskStreaming() {
  const orchestrator = new EventEmitter();
  const streamingCapture = createStreamingEventCapture(orchestrator);

  try {
    // Define expected task execution events
    const taskExecutionEvents = [
      'task:created',
      'task:started',
      'stage:planning',
      'stage:implementation',
      'task:completed'
    ];

    // Start streaming test
    streamingCapture.startStreamingTest(taskExecutionEvents);

    // Simulate task execution with realistic delays
    const taskId = 'example-task-123';

    setTimeout(() => orchestrator.emit('task:created', { taskId, title: 'Example Task' }), 0);
    setTimeout(() => orchestrator.emit('task:started', { taskId }), 50);
    setTimeout(() => orchestrator.emit('stage:planning', { taskId, stage: 'planning' }), 200);
    setTimeout(() => orchestrator.emit('stage:implementation', { taskId, stage: 'implementation' }), 500);
    setTimeout(() => orchestrator.emit('task:completed', { taskId, result: 'success' }), 800);

    // Wait for all events to be captured
    const streamingEvents = await streamingCapture.waitForStreamingEvents(
      events => events.length === taskExecutionEvents.length,
      2000
    );

    // Get performance metrics
    const metrics = streamingCapture.endStreamingTest();

    // Assert streaming requirements
    const results = {
      latency: streamingCapture.assertStreamLatency(100),
      ordering: streamingCapture.assertStreamOrdering(),
      completeness: streamingCapture.assertStreamCompleteness()
    };

    console.log('Basic Task Streaming Results:');
    console.log(`- Events captured: ${metrics.totalEvents}`);
    console.log(`- Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
    console.log(`- Events per second: ${metrics.eventsPerSecond.toFixed(2)}`);
    console.log(`- All assertions passed: ${Object.values(results).every(r => r.passed)}`);

    return { metrics, results, events: streamingEvents };

  } finally {
    streamingCapture.dispose();
  }
}

/**
 * Example 2: High-Throughput Agent Communication Test
 */
export async function exampleHighThroughputStreaming() {
  const orchestrator = new EventEmitter();

  // Configure for high-throughput testing
  const config: StreamingTestConfig = {
    expectedEventsPerSecond: 100,
    maxLatency: 50,
    streamBufferSize: 500
  };

  const streamingCapture = createStreamingEventCapture(orchestrator, {}, config);

  try {
    // Create high-throughput scenario
    const scenario = StreamingTestUtils.createHighThroughputScenario(200, 100);

    console.log('Running high-throughput scenario...');
    const startTime = Date.now();

    const result = await streamingCapture.runStreamingScenario(scenario);

    const duration = Date.now() - startTime;

    console.log('High-Throughput Streaming Results:');
    console.log(`- Scenario passed: ${result.passed}`);
    console.log(`- Total events: ${result.metrics.totalEvents}`);
    console.log(`- Achieved throughput: ${result.metrics.eventsPerSecond.toFixed(2)} events/sec`);
    console.log(`- Max latency: ${result.metrics.maxLatency}ms`);
    console.log(`- Test duration: ${duration}ms`);

    // Additional performance assertions
    const perfResults = StreamingAssertions.assertPerformance(result.metrics, {
      minEventsPerSecond: 80, // Allow some tolerance
      maxLatency: 100,
      maxBackpressure: 5
    });

    console.log(`- Performance assertions passed: ${perfResults.every(r => r.passed)}`);

    return { result, duration, perfResults };

  } finally {
    streamingCapture.dispose();
  }
}

/**
 * Example 3: Approval Workflow Streaming Test
 */
export async function exampleApprovalWorkflowStreaming() {
  const orchestrator = new EventEmitter();
  const streamingCapture = createStreamingEventCapture(orchestrator);

  try {
    const approvalWorkflowEvents = [
      'task:started',
      'approval:required',
      'task:paused',
      'user:notified',
      'approval:granted',
      'task:resumed',
      'task:completed'
    ];

    streamingCapture.startStreamingTest(approvalWorkflowEvents);

    // Simulate approval workflow with realistic human interaction delays
    const taskId = 'approval-task-456';
    const gateName = 'security-review';

    // Initial task execution
    orchestrator.emit('task:started', { taskId });

    setTimeout(() => {
      orchestrator.emit('approval:required', { taskId, gateName, reason: 'Security review needed' });
    }, 100);

    setTimeout(() => {
      orchestrator.emit('task:paused', { taskId, reason: 'Waiting for approval' });
    }, 120);

    setTimeout(() => {
      orchestrator.emit('user:notified', { taskId, gateName, method: 'email' });
    }, 150);

    // Simulate user approval delay (2 seconds)
    setTimeout(() => {
      orchestrator.emit('approval:granted', { taskId, gateName, approver: 'security-team' });
    }, 2200);

    setTimeout(() => {
      orchestrator.emit('task:resumed', { taskId });
    }, 2250);

    setTimeout(() => {
      orchestrator.emit('task:completed', { taskId, result: 'approved-and-completed' });
    }, 2500);

    // Wait with longer timeout for human interaction simulation
    const streamingEvents = await streamingCapture.waitForStreamingEvents(
      events => events.length === approvalWorkflowEvents.length,
      4000
    );

    const metrics = streamingCapture.endStreamingTest();

    // Custom assertions for approval workflow
    const approvalEvent = streamingEvents.find(e => e.type === 'approval:required');
    const grantedEvent = streamingEvents.find(e => e.type === 'approval:granted');

    const approvalLatency = grantedEvent && approvalEvent
      ? grantedEvent.timing.capturedAt.getTime() - approvalEvent.timing.capturedAt.getTime()
      : 0;

    console.log('Approval Workflow Streaming Results:');
    console.log(`- Total events: ${metrics.totalEvents}`);
    console.log(`- Approval latency: ${approvalLatency}ms`);
    console.log(`- Workflow duration: ${metrics.streamDuration}ms`);
    console.log(`- Events in order: ${metrics.outOfOrderEvents === 0}`);

    // Verify approval data integrity
    if (approvalEvent && grantedEvent) {
      const sameTask = approvalEvent.data.taskId === grantedEvent.data.taskId;
      const sameGate = approvalEvent.data.gateName === grantedEvent.data.gateName;
      console.log(`- Data integrity: ${sameTask && sameGate ? 'PASS' : 'FAIL'}`);
    }

    return { metrics, events: streamingEvents, approvalLatency };

  } finally {
    streamingCapture.dispose();
  }
}

/**
 * Example 4: Concurrent Multi-Task Streaming
 */
export async function exampleConcurrentTaskStreaming() {
  const orchestrator = new EventEmitter();
  const streamingCapture = createStreamingEventCapture(orchestrator);

  try {
    // Define events for multiple concurrent tasks
    const allTaskEvents = [
      'task1:started', 'task1:progress', 'task1:completed',
      'task2:started', 'task2:progress', 'task2:completed',
      'task3:started', 'task3:progress', 'task3:completed'
    ];

    streamingCapture.startStreamingTest(allTaskEvents);

    // Helper to emit task events with delays
    const emitTaskEvents = (taskNum: number, startDelay: number) => {
      const taskId = `task-${taskNum}`;

      setTimeout(() => {
        orchestrator.emit(`task${taskNum}:started`, { taskId, priority: taskNum });
      }, startDelay);

      setTimeout(() => {
        orchestrator.emit(`task${taskNum}:progress`, { taskId, progress: 50 });
      }, startDelay + 200);

      setTimeout(() => {
        orchestrator.emit(`task${taskNum}:completed`, { taskId, duration: 400 + taskNum * 100 });
      }, startDelay + 400);
    };

    // Start tasks with staggered delays
    emitTaskEvents(1, 0);
    emitTaskEvents(2, 100);
    emitTaskEvents(3, 200);

    // Wait for all task events
    const streamingEvents = await streamingCapture.waitForStreamingEvents(
      events => events.length === allTaskEvents.length,
      2000
    );

    const metrics = streamingCapture.endStreamingTest();

    // Analyze concurrent execution patterns
    const task1Events = streamingEvents.filter(e => e.type.startsWith('task1:'));
    const task2Events = streamingEvents.filter(e => e.type.startsWith('task2:'));
    const task3Events = streamingEvents.filter(e => e.type.startsWith('task3:'));

    // Check for proper interleaving
    const isProperlyInterleaved = streamingEvents.some((event, index) => {
      if (index === 0) return true;
      const prevEvent = streamingEvents[index - 1];
      return !event.type.startsWith(prevEvent.type.split(':')[0]);
    });

    console.log('Concurrent Multi-Task Streaming Results:');
    console.log(`- Total events: ${metrics.totalEvents}`);
    console.log(`- Task 1 events: ${task1Events.length}`);
    console.log(`- Task 2 events: ${task2Events.length}`);
    console.log(`- Task 3 events: ${task3Events.length}`);
    console.log(`- Properly interleaved: ${isProperlyInterleaved}`);
    console.log(`- Events per second: ${metrics.eventsPerSecond.toFixed(2)}`);
    console.log(`- Max latency: ${metrics.maxLatency}ms`);

    return {
      metrics,
      events: streamingEvents,
      taskBreakdown: { task1Events, task2Events, task3Events },
      isProperlyInterleaved
    };

  } finally {
    streamingCapture.dispose();
  }
}

/**
 * Example 5: Custom Streaming Scenario with Complex Expectations
 */
export async function exampleCustomStreamingScenario() {
  const orchestrator = new EventEmitter();
  const streamingCapture = createStreamingEventCapture(orchestrator);

  try {
    // Define custom scenario for API rate limiting test
    const rateLimitingScenario: StreamTestScenario = {
      name: 'API Rate Limiting Compliance Test',
      events: Array.from({ length: 50 }, (_, i) => ({
        type: 'api:request',
        data: {
          endpoint: `/api/v1/data/${i}`,
          timestamp: Date.now(),
          rateLimit: 10 // 10 requests per second max
        },
        delay: i > 0 ? 100 : 0 // 10 requests/sec = 100ms intervals
      })),
      expectations: [
        {
          type: 'throughput' as const,
          description: 'Should not exceed rate limit of 10 req/sec',
          condition: (metrics) => metrics.eventsPerSecond <= 12 // Allow small tolerance
        },
        {
          type: 'latency' as const,
          description: 'Request processing should be fast',
          condition: (metrics) => metrics.averageLatency <= 50
        },
        {
          type: 'completion' as const,
          description: 'All API requests should be captured',
          condition: (metrics) => metrics.totalEvents === 50
        },
        {
          type: 'ordering' as const,
          description: 'Requests should maintain order',
          condition: (metrics) => metrics.outOfOrderEvents === 0
        }
      ],
      timeout: 6000 // 5 seconds for 50 events + buffer
    };

    console.log('Running custom rate limiting scenario...');

    const result = await streamingCapture.runStreamingScenario(rateLimitingScenario);

    console.log('Custom Streaming Scenario Results:');
    console.log(`- Scenario '${rateLimitingScenario.name}' passed: ${result.passed}`);
    console.log(`- Total requests: ${result.metrics.totalEvents}`);
    console.log(`- Request rate: ${result.metrics.eventsPerSecond.toFixed(2)} req/sec`);
    console.log(`- Average processing latency: ${result.metrics.averageLatency.toFixed(2)}ms`);

    // Detailed expectation results
    result.results.forEach((expectationResult, index) => {
      console.log(`- ${expectationResult.description}: ${expectationResult.passed ? 'PASS' : 'FAIL'}`);
    });

    // Additional rate limiting analysis
    const events = streamingCapture.getStreamingEvents();
    const timeWindows = [];
    let windowStart = events[0]?.timing.capturedAt.getTime() || 0;

    for (let i = 1000; i <= 5000; i += 1000) { // 1-second windows
      const windowEnd = windowStart + i;
      const eventsInWindow = events.filter(e => {
        const time = e.timing.capturedAt.getTime();
        return time >= windowStart + (i - 1000) && time < windowEnd;
      });
      timeWindows.push(eventsInWindow.length);
    }

    console.log(`- Events per second (by window): ${timeWindows.join(', ')}`);
    console.log(`- Rate limit compliance: ${timeWindows.every(count => count <= 12) ? 'PASS' : 'FAIL'}`);

    return { result, timeWindows, events };

  } finally {
    streamingCapture.dispose();
  }
}

/**
 * Example 6: Error Recovery and Resilience Testing
 */
export async function exampleErrorRecoveryStreaming() {
  const orchestrator = new EventEmitter();
  const streamingCapture = createStreamingEventCapture(orchestrator, {}, {
    maxLatency: 200,
    streamBufferSize: 100
  });

  try {
    const errorRecoveryEvents = [
      'system:normal',
      'system:error',
      'system:recovery-start',
      'system:recovery-complete',
      'system:normal'
    ];

    streamingCapture.startStreamingTest(errorRecoveryEvents);

    // Simulate system with error recovery
    orchestrator.emit('system:normal', { status: 'operational', timestamp: Date.now() });

    setTimeout(() => {
      // Simulate error condition
      orchestrator.emit('system:error', {
        error: 'Database connection lost',
        severity: 'high',
        timestamp: Date.now()
      });
    }, 100);

    setTimeout(() => {
      // Start recovery
      orchestrator.emit('system:recovery-start', {
        action: 'reconnecting-database',
        timestamp: Date.now()
      });
    }, 200);

    // Simulate recovery time
    setTimeout(() => {
      orchestrator.emit('system:recovery-complete', {
        duration: 800,
        status: 'recovered',
        timestamp: Date.now()
      });
    }, 1000);

    setTimeout(() => {
      orchestrator.emit('system:normal', {
        status: 'operational',
        timestamp: Date.now(),
        uptime: 1100
      });
    }, 1100);

    const streamingEvents = await streamingCapture.waitForStreamingEvents(
      events => events.length === errorRecoveryEvents.length,
      2000
    );

    const metrics = streamingCapture.endStreamingTest();

    // Calculate recovery metrics
    const errorEvent = streamingEvents.find(e => e.type === 'system:error');
    const recoveryStartEvent = streamingEvents.find(e => e.type === 'system:recovery-start');
    const recoveryCompleteEvent = streamingEvents.find(e => e.type === 'system:recovery-complete');
    const normalEvent = streamingEvents.find(e => e.type === 'system:normal');

    const detectionTime = recoveryStartEvent && errorEvent
      ? recoveryStartEvent.timing.capturedAt.getTime() - errorEvent.timing.capturedAt.getTime()
      : 0;

    const recoveryTime = recoveryCompleteEvent && recoveryStartEvent
      ? recoveryCompleteEvent.timing.capturedAt.getTime() - recoveryStartEvent.timing.capturedAt.getTime()
      : 0;

    console.log('Error Recovery Streaming Results:');
    console.log(`- Total events: ${metrics.totalEvents}`);
    console.log(`- Error detection time: ${detectionTime}ms`);
    console.log(`- Recovery time: ${recoveryTime}ms`);
    console.log(`- Total downtime: ${detectionTime + recoveryTime}ms`);
    console.log(`- All events captured: ${streamingEvents.length === errorRecoveryEvents.length}`);
    console.log(`- Event ordering maintained: ${metrics.outOfOrderEvents === 0}`);

    // Verify error recovery SLA (example: < 1.5 seconds total)
    const slaCompliant = (detectionTime + recoveryTime) < 1500;
    console.log(`- SLA compliance (< 1.5s): ${slaCompliant ? 'PASS' : 'FAIL'}`);

    return {
      metrics,
      events: streamingEvents,
      timings: { detectionTime, recoveryTime },
      slaCompliant
    };

  } finally {
    streamingCapture.dispose();
  }
}

/**
 * Run all examples
 */
export async function runAllStreamingExamples() {
  console.log('='.repeat(60));
  console.log('STREAMING TEST UTILITIES - EXAMPLES');
  console.log('='.repeat(60));

  try {
    console.log('\n1. Basic Task Execution Streaming');
    console.log('-'.repeat(40));
    await exampleBasicTaskStreaming();

    console.log('\n2. High-Throughput Streaming');
    console.log('-'.repeat(40));
    await exampleHighThroughputStreaming();

    console.log('\n3. Approval Workflow Streaming');
    console.log('-'.repeat(40));
    await exampleApprovalWorkflowStreaming();

    console.log('\n4. Concurrent Multi-Task Streaming');
    console.log('-'.repeat(40));
    await exampleConcurrentTaskStreaming();

    console.log('\n5. Custom Streaming Scenario');
    console.log('-'.repeat(40));
    await exampleCustomStreamingScenario();

    console.log('\n6. Error Recovery Streaming');
    console.log('-'.repeat(40));
    await exampleErrorRecoveryStreaming();

    console.log('\n' + '='.repeat(60));
    console.log('ALL EXAMPLES COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Example execution failed:', error);
    throw error;
  }
}

// Export examples for individual testing
export {
  exampleBasicTaskStreaming,
  exampleHighThroughputStreaming,
  exampleApprovalWorkflowStreaming,
  exampleConcurrentTaskStreaming,
  exampleCustomStreamingScenario,
  exampleErrorRecoveryStreaming
};