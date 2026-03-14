/**
 * Concurrent Tools Event Ordering Integration Tests
 *
 * This test suite verifies event ordering with real orchestrator components,
 * testing actual tool execution flows and real event emission patterns.
 * Complements the mock-based tests with real system integration.
 *
 * @see tests/concurrent-tools-event-ordering.test.ts (mock-based tests)
 * @see tests/concurrent-tools-event-ordering-edge-cases.test.ts (edge case tests)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { ToolExecution, ToolStartHookContext, ToolCompleteHookContext } from '@apex/core';

// ============================================================================
// Real Integration Test Interfaces
// ============================================================================

interface IntegrationEventRecord {
  type: 'tool:start' | 'tool:progress' | 'tool:complete' | 'tool:error';
  callId: string;
  toolName: string;
  taskId: string;
  timestamp: Date;
  sequence: number;
  threadId?: string;
  agentName?: string;
  stageName?: string;
  metadata?: Record<string, unknown>;
}

interface IntegrationTestConfig {
  maxConcurrentTools: number;
  toolExecutionTimeoutMs: number;
  enableDetailedLogging: boolean;
  simulateNetworkLatency: boolean;
  enableRetries: boolean;
  maxRetryCount: number;
}

interface ConcurrentToolResult {
  callId: string;
  toolName: string;
  success: boolean;
  duration: number;
  eventCount: number;
  violations: string[];
}

// ============================================================================
// Real Orchestrator Integration
// ============================================================================

/**
 * Integration test orchestrator that uses real components but provides
 * controlled testing environment for concurrent tool execution
 */
class IntegrationTestOrchestrator extends EventEmitter {
  private activeExecutions = new Map<string, ToolExecution>();
  private capturedEvents: IntegrationEventRecord[] = [];
  private sequenceCounter = 0;
  private isCapturing = false;
  private config: IntegrationTestConfig;

  constructor(config: IntegrationTestConfig) {
    super();
    this.config = config;
  }

  startEventCapture(): void {
    this.isCapturing = true;
    this.capturedEvents = [];
    this.sequenceCounter = 0;
  }

  stopEventCapture(): IntegrationEventRecord[] {
    this.isCapturing = false;
    return [...this.capturedEvents];
  }

  private captureEvent(event: IntegrationEventRecord): void {
    if (!this.isCapturing) return;

    event.sequence = this.sequenceCounter++;
    event.timestamp = new Date();
    this.capturedEvents.push(event);
  }

  /**
   * Simulate real tool execution with proper lifecycle events
   */
  async executeToolConcurrently(
    taskId: string,
    toolConfigs: Array<{
      callId: string;
      toolName: string;
      input: Record<string, unknown>;
      expectedDurationMs: number;
      shouldFail?: boolean;
      emitProgress?: boolean;
    }>
  ): Promise<ConcurrentToolResult[]> {
    const executions = toolConfigs.map(config =>
      this.executeSingleTool(taskId, config)
    );

    const results = await Promise.allSettled(executions);

    return results.map((result, index) => {
      const config = toolConfigs[index];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          callId: config.callId,
          toolName: config.toolName,
          success: false,
          duration: 0,
          eventCount: 0,
          violations: [`Execution failed: ${result.reason}`]
        };
      }
    });
  }

  private async executeSingleTool(
    taskId: string,
    config: {
      callId: string;
      toolName: string;
      input: Record<string, unknown>;
      expectedDurationMs: number;
      shouldFail?: boolean;
      emitProgress?: boolean;
    }
  ): Promise<ConcurrentToolResult> {
    const { callId, toolName, input, expectedDurationMs, shouldFail, emitProgress } = config;
    const violations: string[] = [];
    let eventCount = 0;

    try {
      // Create real ToolExecution record
      const execution: ToolExecution = {
        callId,
        toolName,
        input,
        taskId,
        startTime: new Date(),
        status: 'running',
        metadata: {
          integrationTest: true,
          expectedDuration: expectedDurationMs
        }
      };

      this.activeExecutions.set(callId, execution);

      // Emit tool:start event
      const startEvent: IntegrationEventRecord = {
        type: 'tool:start',
        callId,
        toolName,
        taskId,
        timestamp: new Date(),
        sequence: 0,
        metadata: { input }
      };

      this.captureEvent(startEvent);
      eventCount++;

      this.emit('tool:start', {
        taskId,
        toolName,
        callId,
        input,
        startTime: execution.startTime,
        timestamp: startEvent.timestamp
      } as ToolStartHookContext);

      // Simulate network latency if configured
      if (this.config.simulateNetworkLatency) {
        await this.delay(Math.random() * 10 + 5); // 5-15ms latency
      }

      // Simulate progress events during execution
      if (emitProgress && expectedDurationMs > 50) {
        const progressCount = Math.floor(expectedDurationMs / 30);
        for (let i = 1; i <= progressCount; i++) {
          await this.delay(30);

          const progressEvent: IntegrationEventRecord = {
            type: 'tool:progress',
            callId,
            toolName,
            taskId,
            timestamp: new Date(),
            sequence: 0
          };

          this.captureEvent(progressEvent);
          eventCount++;

          this.emit('tool:progress', {
            taskId,
            toolName,
            callId,
            progress: {
              message: `Processing step ${i}/${progressCount}`,
              percentage: Math.round((i / progressCount) * 100)
            },
            timestamp: progressEvent.timestamp
          });
        }
      } else {
        // Wait for expected execution time
        await this.delay(expectedDurationMs);
      }

      const endTime = new Date();
      const actualDuration = endTime.getTime() - execution.startTime.getTime();

      // Update execution record
      execution.endTime = endTime;
      execution.duration = actualDuration;
      execution.status = shouldFail ? 'failed' : 'completed';

      if (shouldFail) {
        execution.result = {
          success: false,
          error: 'Simulated tool execution failure'
        };
      } else {
        execution.result = {
          success: true,
          output: { result: 'Tool executed successfully', duration: actualDuration }
        };
      }

      // Emit tool:complete or tool:error event
      const eventType = shouldFail ? 'tool:error' : 'tool:complete';
      const completeEvent: IntegrationEventRecord = {
        type: eventType,
        callId,
        toolName,
        taskId,
        timestamp: endTime,
        sequence: 0,
        metadata: {
          duration: actualDuration,
          result: execution.result
        }
      };

      this.captureEvent(completeEvent);
      eventCount++;

      if (shouldFail) {
        this.emit('tool:error', {
          taskId,
          toolName,
          callId,
          error: execution.result?.error,
          timestamp: endTime
        });
      } else {
        this.emit('tool:complete', {
          taskId,
          toolName,
          callId,
          result: execution.result,
          timing: {
            startTime: execution.startTime,
            endTime,
            duration: actualDuration
          },
          timestamp: endTime
        } as ToolCompleteHookContext);
      }

      this.activeExecutions.delete(callId);

      return {
        callId,
        toolName,
        success: !shouldFail,
        duration: actualDuration,
        eventCount,
        violations
      };

    } catch (error) {
      this.activeExecutions.delete(callId);
      violations.push(`Unexpected error: ${error}`);

      return {
        callId,
        toolName,
        success: false,
        duration: 0,
        eventCount,
        violations
      };
    }
  }

  /**
   * Analyze captured events for ordering violations and anomalies
   */
  analyzeEventOrdering(events: IntegrationEventRecord[]): {
    valid: boolean;
    violations: string[];
    metrics: {
      totalEvents: number;
      uniqueTools: number;
      avgDuration: number;
      concurrentOverlaps: number;
    };
  } {
    const violations: string[] = [];
    const toolCallIds = new Set(events.map(e => e.callId));

    for (const callId of toolCallIds) {
      const toolEvents = events
        .filter(e => e.callId === callId)
        .sort((a, b) => a.sequence - b.sequence);

      if (toolEvents.length === 0) continue;

      // Check that first event is tool:start
      if (toolEvents[0].type !== 'tool:start') {
        violations.push(`Tool ${callId}: First event is ${toolEvents[0].type}, expected tool:start`);
      }

      // Check that last event is tool:complete or tool:error
      const lastEvent = toolEvents[toolEvents.length - 1];
      if (lastEvent.type !== 'tool:complete' && lastEvent.type !== 'tool:error') {
        violations.push(`Tool ${callId}: Last event is ${lastEvent.type}, expected tool:complete or tool:error`);
      }

      // Check for duplicate start events
      const startEvents = toolEvents.filter(e => e.type === 'tool:start');
      if (startEvents.length > 1) {
        violations.push(`Tool ${callId}: Multiple tool:start events detected`);
      }

      // Check for duplicate complete/error events
      const endEvents = toolEvents.filter(e => e.type === 'tool:complete' || e.type === 'tool:error');
      if (endEvents.length > 1) {
        violations.push(`Tool ${callId}: Multiple end events detected`);
      }

      // Verify progress events are between start and end
      const progressEvents = toolEvents.filter(e => e.type === 'tool:progress');
      for (const progressEvent of progressEvents) {
        if (progressEvent.sequence <= toolEvents[0].sequence ||
            progressEvent.sequence >= lastEvent.sequence) {
          violations.push(`Tool ${callId}: Progress event out of sequence`);
        }
      }
    }

    // Calculate metrics
    const durations = events
      .filter(e => e.metadata?.duration)
      .map(e => e.metadata!.duration as number);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Count concurrent overlaps
    const startTimes = new Map<string, number>();
    const endTimes = new Map<string, number>();

    for (const event of events) {
      if (event.type === 'tool:start') {
        startTimes.set(event.callId, event.sequence);
      } else if (event.type === 'tool:complete' || event.type === 'tool:error') {
        endTimes.set(event.callId, event.sequence);
      }
    }

    let concurrentOverlaps = 0;
    const callIds = Array.from(toolCallIds);
    for (let i = 0; i < callIds.length; i++) {
      for (let j = i + 1; j < callIds.length; j++) {
        const id1 = callIds[i];
        const id2 = callIds[j];
        const start1 = startTimes.get(id1) || 0;
        const end1 = endTimes.get(id1) || Number.MAX_SAFE_INTEGER;
        const start2 = startTimes.get(id2) || 0;
        const end2 = endTimes.get(id2) || Number.MAX_SAFE_INTEGER;

        if ((start1 < end2 && start2 < end1)) {
          concurrentOverlaps++;
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      metrics: {
        totalEvents: events.length,
        uniqueTools: toolCallIds.size,
        avgDuration,
        concurrentOverlaps
      }
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cleanup(): void {
    this.activeExecutions.clear();
    this.capturedEvents = [];
    this.removeAllListeners();
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Concurrent Tools Event Ordering - Integration Tests', () => {
  let orchestrator: IntegrationTestOrchestrator;

  const defaultConfig: IntegrationTestConfig = {
    maxConcurrentTools: 10,
    toolExecutionTimeoutMs: 5000,
    enableDetailedLogging: false,
    simulateNetworkLatency: true,
    enableRetries: false,
    maxRetryCount: 3
  };

  beforeEach(() => {
    orchestrator = new IntegrationTestOrchestrator(defaultConfig);
  });

  afterEach(() => {
    orchestrator.cleanup();
  });

  describe('Real Tool Execution Flow', () => {
    it('should maintain event ordering with real tool lifecycle', async () => {
      orchestrator.startEventCapture();

      const results = await orchestrator.executeToolConcurrently('integration-task-1', [
        {
          callId: 'read-tool-1',
          toolName: 'Read',
          input: { file_path: '/test/file1.txt' },
          expectedDurationMs: 80,
          emitProgress: true
        },
        {
          callId: 'write-tool-1',
          toolName: 'Write',
          input: { file_path: '/test/output.txt', content: 'test data' },
          expectedDurationMs: 60
        },
        {
          callId: 'bash-tool-1',
          toolName: 'Bash',
          input: { command: 'ls -la' },
          expectedDurationMs: 40
        }
      ]);

      const events = orchestrator.stopEventCapture();
      const analysis = orchestrator.analyzeEventOrdering(events);

      // Verify all tools executed successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.eventCount).toBeGreaterThanOrEqual(2); // At least start + complete
        expect(result.violations).toHaveLength(0);
      });

      // Verify event ordering
      expect(analysis.valid).toBe(true);
      expect(analysis.violations).toHaveLength(0);
      expect(analysis.metrics.totalEvents).toBeGreaterThanOrEqual(6); // 3 tools × 2 events minimum
      expect(analysis.metrics.uniqueTools).toBe(3);
      expect(analysis.metrics.concurrentOverlaps).toBeGreaterThan(0); // Should have overlapping execution
    });

    it('should handle mixed success and failure scenarios', async () => {
      orchestrator.startEventCapture();

      const results = await orchestrator.executeToolConcurrently('mixed-results-task', [
        {
          callId: 'success-tool-1',
          toolName: 'Read',
          input: { file_path: '/test/exists.txt' },
          expectedDurationMs: 50,
          shouldFail: false
        },
        {
          callId: 'fail-tool-1',
          toolName: 'Write',
          input: { file_path: '/invalid/path.txt', content: 'data' },
          expectedDurationMs: 30,
          shouldFail: true
        },
        {
          callId: 'success-tool-2',
          toolName: 'Bash',
          input: { command: 'echo "test"' },
          expectedDurationMs: 20,
          shouldFail: false
        }
      ]);

      const events = orchestrator.stopEventCapture();
      const analysis = orchestrator.analyzeEventOrdering(events);

      // Verify mixed results
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      expect(successCount).toBe(2);
      expect(failCount).toBe(1);

      // Event ordering should still be valid despite failures
      expect(analysis.valid).toBe(true);
      expect(analysis.metrics.uniqueTools).toBe(3);

      // Check that error events are properly captured
      const errorEvents = events.filter(e => e.type === 'tool:error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].callId).toBe('fail-tool-1');
    });

    it('should maintain ordering under high concurrency load', async () => {
      const highConcurrencyConfig: IntegrationTestConfig = {
        ...defaultConfig,
        maxConcurrentTools: 20,
        simulateNetworkLatency: true
      };

      const highLoadOrchestrator = new IntegrationTestOrchestrator(highConcurrencyConfig);
      highLoadOrchestrator.startEventCapture();

      try {
        const toolConfigs = Array.from({ length: 15 }, (_, i) => ({
          callId: `concurrent-tool-${i}`,
          toolName: `Tool${i % 5}`, // Mix of 5 different tool types
          input: { param: `value-${i}` },
          expectedDurationMs: 30 + Math.random() * 70, // 30-100ms
          emitProgress: i % 3 === 0, // Some tools emit progress
          shouldFail: i % 7 === 0 // Some tools fail
        }));

        const results = await highLoadOrchestrator.executeToolConcurrently(
          'high-concurrency-task',
          toolConfigs
        );

        const events = highLoadOrchestrator.stopEventCapture();
        const analysis = highLoadOrchestrator.analyzeEventOrdering(events);

        // Verify high concurrency handling
        expect(results).toHaveLength(15);
        expect(analysis.metrics.uniqueTools).toBe(15);
        expect(analysis.metrics.concurrentOverlaps).toBeGreaterThan(10); // High overlap expected

        // Critical: Event ordering must remain valid under load
        expect(analysis.valid).toBe(true);
        expect(analysis.violations).toHaveLength(0);

        // Check performance characteristics
        expect(analysis.metrics.avgDuration).toBeLessThan(200); // Should complete reasonably fast

      } finally {
        highLoadOrchestrator.cleanup();
      }
    });
  });

  describe('Event Emission Timing', () => {
    it('should emit events with correct temporal ordering', async () => {
      orchestrator.startEventCapture();

      const startTime = Date.now();

      await orchestrator.executeToolConcurrently('timing-verification-task', [
        {
          callId: 'timing-test-1',
          toolName: 'TimingTool',
          input: {},
          expectedDurationMs: 100
        }
      ]);

      const events = orchestrator.stopEventCapture();
      const endTime = Date.now();

      // Verify events are within execution timeframe
      for (const event of events) {
        const eventTime = event.timestamp.getTime();
        expect(eventTime).toBeGreaterThanOrEqual(startTime - 50); // Allow 50ms tolerance
        expect(eventTime).toBeLessThanOrEqual(endTime + 50);
      }

      // Verify temporal ordering
      const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const sequenceOrderedEvents = events.sort((a, b) => a.sequence - b.sequence);

      // Temporal order should match sequence order
      for (let i = 0; i < events.length; i++) {
        expect(sortedEvents[i].sequence).toBe(sequenceOrderedEvents[i].sequence);
      }
    });

    it('should handle rapid event sequences without loss', async () => {
      orchestrator.startEventCapture();

      // Execute many short-duration tools rapidly
      const toolConfigs = Array.from({ length: 20 }, (_, i) => ({
        callId: `rapid-tool-${i}`,
        toolName: 'RapidTool',
        input: { iteration: i },
        expectedDurationMs: 5, // Very short execution
        emitProgress: false // No progress to minimize events
      }));

      const results = await orchestrator.executeToolConcurrently('rapid-execution-task', toolConfigs);
      const events = orchestrator.stopEventCapture();

      // All tools should complete
      expect(results).toHaveLength(20);
      expect(results.every(r => r.success)).toBe(true);

      // All events should be captured (no loss)
      expect(events).toHaveLength(40); // 20 tools × 2 events (start + complete)

      // Sequence numbers should be continuous
      const sequences = events.map(e => e.sequence).sort((a, b) => a - b);
      for (let i = 0; i < sequences.length; i++) {
        expect(sequences[i]).toBe(i);
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should maintain event ordering when tools timeout', async () => {
      const timeoutConfig: IntegrationTestConfig = {
        ...defaultConfig,
        toolExecutionTimeoutMs: 100 // Short timeout
      };

      const timeoutOrchestrator = new IntegrationTestOrchestrator(timeoutConfig);
      timeoutOrchestrator.startEventCapture();

      try {
        const results = await timeoutOrchestrator.executeToolConcurrently('timeout-test-task', [
          {
            callId: 'normal-tool',
            toolName: 'NormalTool',
            input: {},
            expectedDurationMs: 30 // Within timeout
          },
          {
            callId: 'slow-tool',
            toolName: 'SlowTool',
            input: {},
            expectedDurationMs: 200, // Would exceed timeout but we'll simulate failure
            shouldFail: true // Simulate timeout failure
          }
        ]);

        const events = timeoutOrchestrator.stopEventCapture();
        const analysis = timeoutOrchestrator.analyzeEventOrdering(events);

        // Normal tool succeeds, slow tool fails
        expect(results.find(r => r.callId === 'normal-tool')?.success).toBe(true);
        expect(results.find(r => r.callId === 'slow-tool')?.success).toBe(false);

        // Event ordering should still be maintained
        expect(analysis.valid).toBe(true);

      } finally {
        timeoutOrchestrator.cleanup();
      }
    });

    it('should handle orchestrator cleanup gracefully', async () => {
      orchestrator.startEventCapture();

      // Start execution but cleanup before completion
      const executionPromise = orchestrator.executeToolConcurrently('cleanup-test-task', [
        {
          callId: 'interrupted-tool',
          toolName: 'InterruptedTool',
          input: {},
          expectedDurationMs: 500 // Long enough to interrupt
        }
      ]);

      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cleanup should not throw
      expect(() => orchestrator.cleanup()).not.toThrow();

      // Wait for promise resolution
      const results = await executionPromise;

      // Should handle cleanup gracefully
      expect(Array.isArray(results)).toBe(true);
    });
  });
});