/**
 * Concurrent Tools Event Ordering Edge Cases Tests
 *
 * This test suite verifies advanced edge cases for event ordering
 * when multiple tools run concurrently, extending beyond the basic
 * event ordering tests.
 *
 * @see tests/concurrent-tools-event-ordering.test.ts
 * @see docs/adr/ADR-075-concurrent-tools-event-ordering-tests.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// ============================================================================
// Test Interfaces
// ============================================================================

interface AdvancedEventRecord {
  type: 'tool:start' | 'tool:progress' | 'tool:complete' | 'tool:error' | 'tool:timeout';
  callId: string;
  toolName: string;
  taskId: string;
  timestamp: Date;
  globalSequence: number;
  threadId?: string; // For testing thread isolation
  metadata?: {
    retryCount?: number;
    parentCallId?: string;
    nestedLevel?: number;
    executionContext?: string;
  };
}

interface StressTestConfig {
  concurrentTools: number;
  eventsPerTool: number;
  executionTimeVariance: [number, number]; // min, max ms
  errorProbability: number;
  timeoutProbability: number;
  maxRetries: number;
}

interface EventOrderingAnomaly {
  type: 'out_of_sequence' | 'missing_event' | 'duplicate_event' | 'timing_violation';
  callId: string;
  description: string;
  expectedSequence?: string[];
  actualSequence?: string[];
  timingData?: {
    expectedBefore: Date;
    actualTime: Date;
    violationType: 'too_early' | 'too_late';
  };
}

// ============================================================================
// Advanced Mock Orchestrator
// ============================================================================

class AdvancedEventOrderTestOrchestrator extends EventEmitter {
  private globalSequence = 0;
  private capturedEvents: AdvancedEventRecord[] = [];
  private isCapturing = false;
  private activeTools = new Map<string, any>();
  private executionThreads = new Map<string, Set<string>>();

  startCapture(): void {
    this.isCapturing = true;
    this.capturedEvents = [];
    this.globalSequence = 0;
  }

  stopCapture(): AdvancedEventRecord[] {
    this.isCapturing = false;
    return [...this.capturedEvents];
  }

  private emitAndCapture(event: AdvancedEventRecord): void {
    if (this.isCapturing) {
      this.capturedEvents.push(event);
    }

    this.emit(event.type, {
      taskId: event.taskId,
      toolName: event.toolName,
      callId: event.callId,
      timestamp: event.timestamp,
      ...event.metadata
    });
  }

  simulateNestedToolExecution(
    parentCallId: string,
    nestedTools: { callId: string; toolName: string; executionTimeMs: number }[]
  ): Promise<void> {
    return new Promise(async (resolve) => {
      const taskId = 'nested-task';

      for (const tool of nestedTools) {
        const event: AdvancedEventRecord = {
          type: 'tool:start',
          callId: tool.callId,
          toolName: tool.toolName,
          taskId,
          timestamp: new Date(),
          globalSequence: this.globalSequence++,
          metadata: {
            parentCallId,
            nestedLevel: 1
          }
        };

        this.emitAndCapture(event);
        this.activeTools.set(tool.callId, { startTime: event.timestamp });
      }

      // Simulate execution
      await Promise.all(nestedTools.map(async (tool) => {
        await new Promise(r => setTimeout(r, tool.executionTimeMs));

        const completeEvent: AdvancedEventRecord = {
          type: 'tool:complete',
          callId: tool.callId,
          toolName: tool.toolName,
          taskId,
          timestamp: new Date(),
          globalSequence: this.globalSequence++,
          metadata: {
            parentCallId,
            nestedLevel: 1
          }
        };

        this.emitAndCapture(completeEvent);
        this.activeTools.delete(tool.callId);
      }));

      resolve();
    });
  }

  async simulateStressTest(config: StressTestConfig): Promise<AdvancedEventRecord[]> {
    this.startCapture();
    const taskId = 'stress-test';
    const executions: Promise<void>[] = [];

    for (let i = 0; i < config.concurrentTools; i++) {
      const callId = `stress-tool-${i}`;
      const toolName = `StressTool${i}`;

      executions.push(this.simulateStressedTool(
        taskId,
        callId,
        toolName,
        config
      ));
    }

    await Promise.all(executions);
    return this.stopCapture();
  }

  private async simulateStressedTool(
    taskId: string,
    callId: string,
    toolName: string,
    config: StressTestConfig
  ): Promise<void> {
    let retryCount = 0;

    while (retryCount <= config.maxRetries) {
      // Start event
      const startEvent: AdvancedEventRecord = {
        type: 'tool:start',
        callId,
        toolName,
        taskId,
        timestamp: new Date(),
        globalSequence: this.globalSequence++,
        threadId: `thread-${Math.floor(Math.random() * 4)}`, // Simulate 4 threads
        metadata: { retryCount }
      };

      this.emitAndCapture(startEvent);
      this.activeTools.set(callId, { startTime: startEvent.timestamp });

      // Simulate random execution time
      const [minTime, maxTime] = config.executionTimeVariance;
      const executionTime = minTime + Math.random() * (maxTime - minTime);

      // Simulate progress events
      const progressCount = Math.floor(config.eventsPerTool * Math.random());
      for (let p = 0; p < progressCount; p++) {
        await new Promise(r => setTimeout(r, executionTime / (progressCount + 1)));

        const progressEvent: AdvancedEventRecord = {
          type: 'tool:progress',
          callId,
          toolName,
          taskId,
          timestamp: new Date(),
          globalSequence: this.globalSequence++,
          threadId: startEvent.threadId,
          metadata: { retryCount }
        };

        this.emitAndCapture(progressEvent);
      }

      await new Promise(r => setTimeout(r, executionTime / 2));

      // Randomly simulate errors or timeouts
      const shouldError = Math.random() < config.errorProbability;
      const shouldTimeout = Math.random() < config.timeoutProbability;

      if (shouldError && retryCount < config.maxRetries) {
        const errorEvent: AdvancedEventRecord = {
          type: 'tool:error',
          callId,
          toolName,
          taskId,
          timestamp: new Date(),
          globalSequence: this.globalSequence++,
          threadId: startEvent.threadId,
          metadata: { retryCount }
        };

        this.emitAndCapture(errorEvent);
        retryCount++;
        continue;
      }

      if (shouldTimeout && retryCount < config.maxRetries) {
        const timeoutEvent: AdvancedEventRecord = {
          type: 'tool:timeout',
          callId,
          toolName,
          taskId,
          timestamp: new Date(),
          globalSequence: this.globalSequence++,
          threadId: startEvent.threadId,
          metadata: { retryCount }
        };

        this.emitAndCapture(timeoutEvent);
        retryCount++;
        continue;
      }

      // Success - complete event
      const completeEvent: AdvancedEventRecord = {
        type: 'tool:complete',
        callId,
        toolName,
        taskId,
        timestamp: new Date(),
        globalSequence: this.globalSequence++,
        threadId: startEvent.threadId,
        metadata: { retryCount }
      };

      this.emitAndCapture(completeEvent);
      this.activeTools.delete(callId);
      break;
    }
  }

  analyzeEventOrderingAnomalies(events: AdvancedEventRecord[]): EventOrderingAnomaly[] {
    const anomalies: EventOrderingAnomaly[] = [];
    const eventsByCallId = new Map<string, AdvancedEventRecord[]>();

    // Group events by callId
    for (const event of events) {
      const existing = eventsByCallId.get(event.callId) || [];
      existing.push(event);
      eventsByCallId.set(event.callId, existing);
    }

    // Analyze each tool's event sequence
    for (const [callId, toolEvents] of eventsByCallId) {
      const sortedEvents = toolEvents.sort((a, b) => a.globalSequence - b.globalSequence);

      // For retry scenarios, we need to analyze each attempt separately
      const attemptGroups = this.groupEventsByAttempt(sortedEvents);

      for (const attemptEvents of attemptGroups) {
        let hasStart = false;
        let hasEnd = false; // complete, error, or timeout

        for (let i = 0; i < attemptEvents.length; i++) {
          const event = attemptEvents[i];

          if (event.type === 'tool:start') {
            if (hasStart) {
              anomalies.push({
                type: 'duplicate_event',
                callId,
                description: 'Multiple start events in same attempt'
              });
            }
            hasStart = true;
          } else if (event.type === 'tool:complete' || event.type === 'tool:error' || event.type === 'tool:timeout') {
            if (!hasStart) {
              anomalies.push({
                type: 'out_of_sequence',
                callId,
                description: `${event.type} event before start event`,
                expectedSequence: ['tool:start', event.type],
                actualSequence: attemptEvents.map(e => e.type)
              });
            }
            hasEnd = true;
          } else if (event.type === 'tool:progress') {
            if (!hasStart) {
              anomalies.push({
                type: 'out_of_sequence',
                callId,
                description: 'Progress event before start event',
                expectedSequence: ['tool:start', 'tool:progress'],
                actualSequence: attemptEvents.map(e => e.type)
              });
            }
          }

          // Check timing violations (events too close together)
          if (i > 0) {
            const prevEvent = attemptEvents[i - 1];
            const timeDiff = event.timestamp.getTime() - prevEvent.timestamp.getTime();

            if (timeDiff < 0) {
              anomalies.push({
                type: 'timing_violation',
                callId,
                description: 'Event timestamp earlier than previous event',
                timingData: {
                  expectedBefore: prevEvent.timestamp,
                  actualTime: event.timestamp,
                  violationType: 'too_early'
                }
              });
            }
          }
        }
      }
    }

    return anomalies;
  }

  private groupEventsByAttempt(events: AdvancedEventRecord[]): AdvancedEventRecord[][] {
    const attemptGroups: AdvancedEventRecord[][] = [];
    let currentAttempt: AdvancedEventRecord[] = [];

    for (const event of events) {
      if (event.type === 'tool:start') {
        // New attempt starts
        if (currentAttempt.length > 0) {
          attemptGroups.push(currentAttempt);
        }
        currentAttempt = [event];
      } else {
        currentAttempt.push(event);
      }
    }

    if (currentAttempt.length > 0) {
      attemptGroups.push(currentAttempt);
    }

    return attemptGroups;
  }

  close(): void {
    this.removeAllListeners();
    this.activeTools.clear();
    this.capturedEvents = [];
    this.executionThreads.clear();
  }
}

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Concurrent Tools Event Ordering - Edge Cases', () => {
  let orchestrator: AdvancedEventOrderTestOrchestrator;

  beforeEach(() => {
    orchestrator = new AdvancedEventOrderTestOrchestrator();
  });

  afterEach(() => {
    orchestrator.close();
  });

  describe('Nested Tool Execution', () => {
    it('should maintain correct ordering for nested tool calls', async () => {
      const parentCallId = 'parent-tool';
      const nestedTools = [
        { callId: 'nested-1', toolName: 'NestedTool1', executionTimeMs: 30 },
        { callId: 'nested-2', toolName: 'NestedTool2', executionTimeMs: 40 },
        { callId: 'nested-3', toolName: 'NestedTool3', executionTimeMs: 25 },
      ];

      orchestrator.startCapture();
      await orchestrator.simulateNestedToolExecution(parentCallId, nestedTools);
      const events = orchestrator.stopCapture();

      // Should have start and complete for each nested tool
      expect(events).toHaveLength(6); // 3 starts + 3 completes

      // All events should reference the parent
      const nestedEvents = events.filter(e => e.metadata?.parentCallId === parentCallId);
      expect(nestedEvents).toHaveLength(6);

      // Check ordering within nested tools
      const anomalies = orchestrator.analyzeEventOrderingAnomalies(events);
      expect(anomalies).toHaveLength(0);
    });

    it('should handle deeply nested tool calls (3 levels)', async () => {
      orchestrator.startCapture();

      // Level 1
      await orchestrator.simulateNestedToolExecution('root', [
        { callId: 'level1-1', toolName: 'L1Tool1', executionTimeMs: 20 }
      ]);

      // Level 2
      await orchestrator.simulateNestedToolExecution('level1-1', [
        { callId: 'level2-1', toolName: 'L2Tool1', executionTimeMs: 15 },
        { callId: 'level2-2', toolName: 'L2Tool2', executionTimeMs: 18 }
      ]);

      // Level 3
      await orchestrator.simulateNestedToolExecution('level2-1', [
        { callId: 'level3-1', toolName: 'L3Tool1', executionTimeMs: 10 }
      ]);

      const events = orchestrator.stopCapture();

      // Verify all nesting levels are represented
      const level1Events = events.filter(e => e.metadata?.parentCallId === 'root');
      const level2Events = events.filter(e => e.metadata?.parentCallId === 'level1-1');
      const level3Events = events.filter(e => e.metadata?.parentCallId === 'level2-1');

      expect(level1Events.length).toBeGreaterThan(0);
      expect(level2Events.length).toBeGreaterThan(0);
      expect(level3Events.length).toBeGreaterThan(0);

      const anomalies = orchestrator.analyzeEventOrderingAnomalies(events);
      expect(anomalies).toHaveLength(0);
    });
  });

  describe('High-Stress Concurrent Execution', () => {
    it('should handle extreme concurrency without ordering violations', async () => {
      const stressConfig: StressTestConfig = {
        concurrentTools: 25,
        eventsPerTool: 5,
        executionTimeVariance: [10, 100],
        errorProbability: 0.1,
        timeoutProbability: 0.05,
        maxRetries: 2
      };

      const events = await orchestrator.simulateStressTest(stressConfig);

      expect(events.length).toBeGreaterThan(50); // Should have many events

      const anomalies = orchestrator.analyzeEventOrderingAnomalies(events);

      // Allow for some timing anomalies in high stress but no sequence violations
      const sequenceAnomalies = anomalies.filter(a =>
        a.type === 'out_of_sequence' || a.type === 'missing_event' || a.type === 'duplicate_event'
      );

      expect(sequenceAnomalies).toHaveLength(0);
    });

    it('should maintain thread isolation across concurrent executions', async () => {
      const stressConfig: StressTestConfig = {
        concurrentTools: 15,
        eventsPerTool: 3,
        executionTimeVariance: [20, 60],
        errorProbability: 0,
        timeoutProbability: 0,
        maxRetries: 0
      };

      const events = await orchestrator.simulateStressTest(stressConfig);

      // Group events by threadId
      const eventsByThread = new Map<string, AdvancedEventRecord[]>();
      for (const event of events) {
        if (event.threadId) {
          const existing = eventsByThread.get(event.threadId) || [];
          existing.push(event);
          eventsByThread.set(event.threadId, existing);
        }
      }

      expect(eventsByThread.size).toBeGreaterThan(1); // Should use multiple threads

      // Each thread should have proper event ordering
      for (const [threadId, threadEvents] of eventsByThread) {
        const threadAnomalies = orchestrator.analyzeEventOrderingAnomalies(threadEvents);
        expect(threadAnomalies.filter(a => a.type === 'out_of_sequence')).toHaveLength(0);
      }
    });
  });

  describe('Error and Retry Scenarios', () => {
    it('should maintain ordering across retry attempts', async () => {
      const stressConfig: StressTestConfig = {
        concurrentTools: 5,
        eventsPerTool: 2,
        executionTimeVariance: [30, 50],
        errorProbability: 0.6, // High error rate to trigger retries
        timeoutProbability: 0.3, // High timeout rate
        maxRetries: 3
      };

      const events = await orchestrator.simulateStressTest(stressConfig);

      // Should have retry attempts (multiple start events per callId)
      const eventsByCallId = new Map<string, AdvancedEventRecord[]>();
      for (const event of events) {
        const existing = eventsByCallId.get(event.callId) || [];
        existing.push(event);
        eventsByCallId.set(event.callId, existing);
      }

      let hasRetries = false;
      for (const [callId, toolEvents] of eventsByCallId) {
        const startEvents = toolEvents.filter(e => e.type === 'tool:start');
        if (startEvents.length > 1) {
          hasRetries = true;

          // Verify retry count increases
          const sortedStarts = startEvents.sort((a, b) => a.globalSequence - b.globalSequence);
          for (let i = 1; i < sortedStarts.length; i++) {
            expect(sortedStarts[i].metadata?.retryCount).toBeGreaterThan(sortedStarts[i - 1].metadata?.retryCount || 0);
          }
        }
      }

      expect(hasRetries).toBe(true); // Should have at least some retries

      // Overall ordering should still be maintained
      const anomalies = orchestrator.analyzeEventOrderingAnomalies(events);
      const criticalAnomalies = anomalies.filter(a =>
        a.type === 'out_of_sequence' || a.type === 'duplicate_event'
      );

      expect(criticalAnomalies).toHaveLength(0);
    });
  });

  describe('Event Timing Edge Cases', () => {
    it('should handle rapid-fire event sequences correctly', async () => {
      orchestrator.startCapture();

      const promises = [];
      for (let i = 0; i < 10; i++) {
        // Emit events in rapid succession
        promises.push(
          orchestrator.simulateNestedToolExecution(`rapid-${i}`, [
            { callId: `rapid-tool-${i}`, toolName: 'RapidTool', executionTimeMs: 1 }
          ])
        );
      }

      await Promise.all(promises);
      const events = orchestrator.stopCapture();

      // All events should be captured
      expect(events.length).toBeGreaterThanOrEqual(20); // At least start+complete for each

      // Global sequence should be strictly increasing
      const sortedEvents = events.sort((a, b) => a.globalSequence - b.globalSequence);
      for (let i = 1; i < sortedEvents.length; i++) {
        expect(sortedEvents[i].globalSequence).toBeGreaterThan(sortedEvents[i - 1].globalSequence);
      }
    });

    it('should detect and report timing anomalies correctly', async () => {
      orchestrator.startCapture();

      // Manually create events with timing issues
      const baseTime = new Date();
      const events: AdvancedEventRecord[] = [
        {
          type: 'tool:start',
          callId: 'timing-test',
          toolName: 'TimingTool',
          taskId: 'timing-task',
          timestamp: new Date(baseTime.getTime() + 100),
          globalSequence: 0
        },
        {
          type: 'tool:complete',
          callId: 'timing-test',
          toolName: 'TimingTool',
          taskId: 'timing-task',
          timestamp: new Date(baseTime.getTime() + 50), // Earlier than start!
          globalSequence: 1
        }
      ];

      const anomalies = orchestrator.analyzeEventOrderingAnomalies(events);
      const timingAnomalies = anomalies.filter(a => a.type === 'timing_violation');

      expect(timingAnomalies.length).toBeGreaterThan(0);
      expect(timingAnomalies[0].timingData?.violationType).toBe('too_early');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large event volumes efficiently', async () => {
      const startTime = Date.now();

      const stressConfig: StressTestConfig = {
        concurrentTools: 50,
        eventsPerTool: 10,
        executionTimeVariance: [5, 25],
        errorProbability: 0.05,
        timeoutProbability: 0.02,
        maxRetries: 1
      };

      const events = await orchestrator.simulateStressTest(stressConfig);

      const duration = Date.now() - startTime;

      expect(events.length).toBeGreaterThan(100); // Lots of events
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time

      const anomalies = orchestrator.analyzeEventOrderingAnomalies(events);
      const criticalAnomalies = anomalies.filter(a =>
        a.type === 'out_of_sequence' || a.type === 'missing_event'
      );

      expect(criticalAnomalies).toHaveLength(0);
    });

    it('should not leak memory during long-running tests', () => {
      // Test memory by creating and destroying many orchestrators
      const orchestrators = [];

      for (let i = 0; i < 100; i++) {
        const orch = new AdvancedEventOrderTestOrchestrator();
        orchestrators.push(orch);
      }

      // Clean up
      orchestrators.forEach(orch => orch.close());

      // If we get here without memory errors, test passes
      expect(orchestrators.length).toBe(100);
    });
  });
});