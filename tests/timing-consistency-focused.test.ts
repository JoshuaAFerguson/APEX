import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Focused Timing Consistency Tests
 *
 * This test suite focuses on essential timing consistency features
 * without complex stress testing or long-running scenarios.
 */

interface ToolCallStartEvent {
  taskId: string;
  toolName: string;
  callId: string;
  input: Record<string, unknown>;
  startTime: Date;
  timestamp: Date;
}

interface ToolCallCompleteEvent {
  taskId: string;
  toolName: string;
  callId: string;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  timestamp: Date;
}

/**
 * Simple timing test orchestrator
 */
class TimingTestOrchestrator extends EventEmitter {
  private activeExecutions = new Map<string, { startTime: Date; toolName: string; taskId: string }>();

  async simulateToolExecution(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    executionTimeMs: number = 50,
    options: { shouldFail?: boolean } = {}
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const startTime = new Date();

      // Store active execution
      this.activeExecutions.set(callId, { startTime, toolName, taskId });

      // Emit start event
      const startEvent: ToolCallStartEvent = {
        taskId,
        toolName,
        callId,
        input,
        startTime,
        timestamp: startTime,
      };
      this.emit('tool:start', startEvent);

      // Simulate execution time
      setTimeout(() => {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        // Emit complete event
        const completeEvent: ToolCallCompleteEvent = {
          taskId,
          toolName,
          callId,
          result: {
            success: !options.shouldFail,
            output: options.shouldFail ? undefined : { result: 'completed' },
            error: options.shouldFail ? 'Execution failed' : undefined,
          },
          timing: {
            startTime,
            endTime,
            duration,
          },
          timestamp: endTime,
        };
        this.emit('tool:complete', completeEvent);

        // Clean up
        this.activeExecutions.delete(callId);
        resolve();
      }, executionTimeMs);
    });
  }

  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  close(): void {
    this.removeAllListeners();
    this.activeExecutions.clear();
  }
}

describe('Timing Consistency - Focused Tests', () => {
  let orchestrator: TimingTestOrchestrator;

  beforeEach(() => {
    orchestrator = new TimingTestOrchestrator();
  });

  afterEach(() => {
    orchestrator.close();
  });

  describe('Basic Timing Consistency', () => {
    it('should maintain timing consistency between start and complete events', async () => {
      let startEvent: ToolCallStartEvent | null = null;
      let completeEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:start', (event) => {
        startEvent = event;
      });

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await orchestrator.simulateToolExecution(
        'test-task',
        'TestTool',
        'test-call',
        { test: 'timing-consistency' },
        100
      );

      expect(startEvent).not.toBeNull();
      expect(completeEvent).not.toBeNull();

      // Verify timing consistency
      expect(startEvent!.startTime.getTime()).toBe(completeEvent!.timing.startTime.getTime());
      expect(startEvent!.timestamp.getTime()).toBe(completeEvent!.timing.startTime.getTime());
      expect(completeEvent!.timing.endTime.getTime()).toBeGreaterThan(completeEvent!.timing.startTime.getTime());

      // Verify duration calculation
      const calculatedDuration = completeEvent!.timing.endTime.getTime() - completeEvent!.timing.startTime.getTime();
      expect(completeEvent!.timing.duration).toBe(calculatedDuration);
    });

    it('should handle failed tool execution with proper timing data', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await orchestrator.simulateToolExecution(
        'error-task',
        'ErrorTool',
        'error-call',
        { triggerError: true },
        50,
        { shouldFail: true }
      );

      expect(completeEvent).not.toBeNull();
      expect(completeEvent!.result.success).toBe(false);
      expect(completeEvent!.result.error).toBeDefined();

      // Timing data should still be accurate for failed executions
      expect(completeEvent!.timing).toBeDefined();
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(40);
      expect(completeEvent!.timing.endTime.getTime()).toBeGreaterThan(completeEvent!.timing.startTime.getTime());
    });

    it('should maintain data integrity across all timing events', async () => {
      let startEvent: ToolCallStartEvent | null = null;
      let completeEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:start', (event) => {
        startEvent = event;
      });

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const testCallId = 'integrity-test-call';
      const testToolName = 'IntegrityTestTool';
      const testTaskId = 'integrity-test-task';
      const testInput = { integrity: 'test', value: 42 };

      await orchestrator.simulateToolExecution(
        testTaskId,
        testToolName,
        testCallId,
        testInput,
        60
      );

      expect(startEvent).not.toBeNull();
      expect(completeEvent).not.toBeNull();

      // Verify consistent identifiers
      expect(startEvent!.callId).toBe(testCallId);
      expect(startEvent!.toolName).toBe(testToolName);
      expect(startEvent!.taskId).toBe(testTaskId);
      expect(completeEvent!.callId).toBe(testCallId);
      expect(completeEvent!.toolName).toBe(testToolName);
      expect(completeEvent!.taskId).toBe(testTaskId);

      // Verify input data integrity
      expect(startEvent!.input).toEqual(testInput);

      // Verify timing data types
      expect(startEvent!.timestamp).toBeInstanceOf(Date);
      expect(startEvent!.startTime).toBeInstanceOf(Date);
      expect(completeEvent!.timestamp).toBeInstanceOf(Date);
      expect(completeEvent!.timing.startTime).toBeInstanceOf(Date);
      expect(completeEvent!.timing.endTime).toBeInstanceOf(Date);
      expect(typeof completeEvent!.timing.duration).toBe('number');
    });
  });

  describe('Concurrent Execution Timing', () => {
    it('should handle concurrent executions with isolated timing', async () => {
      const events: Array<{ type: string; callId: string; timestamp: Date; duration?: number }> = [];

      orchestrator.on('tool:start', (event) => {
        events.push({ type: 'start', callId: event.callId, timestamp: event.timestamp });
      });

      orchestrator.on('tool:complete', (event) => {
        events.push({
          type: 'complete',
          callId: event.callId,
          timestamp: event.timestamp,
          duration: event.timing.duration
        });
      });

      // Start multiple concurrent executions
      const promises = [
        orchestrator.simulateToolExecution('task-1', 'Tool1', 'call-1', {}, 60),
        orchestrator.simulateToolExecution('task-2', 'Tool2', 'call-2', {}, 80),
        orchestrator.simulateToolExecution('task-3', 'Tool3', 'call-3', {}, 70),
      ];

      await Promise.all(promises);

      // Verify all tools completed
      expect(events.filter(e => e.type === 'start')).toHaveLength(3);
      expect(events.filter(e => e.type === 'complete')).toHaveLength(3);

      // Verify timing isolation - each tool should have its own timing
      const call1Events = events.filter(e => e.callId === 'call-1');
      const call2Events = events.filter(e => e.callId === 'call-2');
      const call3Events = events.filter(e => e.callId === 'call-3');

      expect(call1Events).toHaveLength(2);
      expect(call2Events).toHaveLength(2);
      expect(call3Events).toHaveLength(2);

      // Verify each tool has proper timing data
      const durations = events
        .filter(e => e.type === 'complete' && e.duration !== undefined)
        .map(e => e.duration!);

      durations.forEach(duration => {
        expect(duration).toBeGreaterThan(50);
        expect(duration).toBeLessThan(200);
      });
    });

    it('should track active executions correctly', async () => {
      // Verify initial state
      expect(orchestrator.getActiveExecutionCount()).toBe(0);
      expect(orchestrator.getActiveExecutions()).toHaveLength(0);

      // Start execution without awaiting
      const promise = orchestrator.simulateToolExecution(
        'tracking-task',
        'TrackingTool',
        'tracking-call',
        {},
        100
      );

      // Should be active immediately after starting
      expect(orchestrator.getActiveExecutionCount()).toBe(1);
      expect(orchestrator.getActiveExecutions()).toContain('tracking-call');

      // Wait for completion
      await promise;

      // Should be cleaned up after completion
      expect(orchestrator.getActiveExecutionCount()).toBe(0);
      expect(orchestrator.getActiveExecutions()).toHaveLength(0);
    });
  });

  describe('Event Sequence Validation', () => {
    it('should emit events in correct order for single execution', async () => {
      const eventSequence: string[] = [];

      orchestrator.on('tool:start', () => {
        eventSequence.push('start');
      });

      orchestrator.on('tool:complete', () => {
        eventSequence.push('complete');
      });

      await orchestrator.simulateToolExecution(
        'sequence-task',
        'SequenceTool',
        'sequence-call',
        {},
        50
      );

      expect(eventSequence).toEqual(['start', 'complete']);
    });

    it('should maintain correct sequence for multiple concurrent executions', async () => {
      const events: Array<{ type: string; callId: string; sequenceNumber: number }> = [];
      let sequenceCounter = 0;

      orchestrator.on('tool:start', (event) => {
        events.push({ type: 'start', callId: event.callId, sequenceNumber: sequenceCounter++ });
      });

      orchestrator.on('tool:complete', (event) => {
        events.push({ type: 'complete', callId: event.callId, sequenceNumber: sequenceCounter++ });
      });

      // Start concurrent executions
      const promises = [
        orchestrator.simulateToolExecution('seq-task-1', 'SeqTool1', 'seq-call-1', {}, 40),
        orchestrator.simulateToolExecution('seq-task-2', 'SeqTool2', 'seq-call-2', {}, 60),
      ];

      await Promise.all(promises);

      expect(events).toHaveLength(4); // 2 starts + 2 completes

      // Verify each tool has proper start->complete sequence
      const call1Events = events.filter(e => e.callId === 'seq-call-1').sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      const call2Events = events.filter(e => e.callId === 'seq-call-2').sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      expect(call1Events).toHaveLength(2);
      expect(call1Events[0].type).toBe('start');
      expect(call1Events[1].type).toBe('complete');

      expect(call2Events).toHaveLength(2);
      expect(call2Events[0].type).toBe('start');
      expect(call2Events[1].type).toBe('complete');
    });
  });

  describe('Timing Accuracy', () => {
    it('should provide accurate duration measurements within tolerance', async () => {
      const testDurations = [30, 60, 100];
      const tolerance = 30; // 30ms tolerance

      for (const expectedDuration of testDurations) {
        let completeEvent: ToolCallCompleteEvent | null = null;

        orchestrator.on('tool:complete', (event) => {
          completeEvent = event;
        });

        await orchestrator.simulateToolExecution(
          `accuracy-task-${expectedDuration}`,
          'AccuracyTool',
          `accuracy-call-${expectedDuration}`,
          { expectedDuration },
          expectedDuration
        );

        expect(completeEvent).not.toBeNull();
        expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(expectedDuration - tolerance);
        expect(completeEvent!.timing.duration).toBeLessThanOrEqual(expectedDuration + tolerance);

        // Reset for next iteration
        completeEvent = null;
        orchestrator.removeAllListeners();
      }
    });

    it('should handle very fast executions correctly', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await orchestrator.simulateToolExecution(
        'fast-task',
        'FastTool',
        'fast-call',
        {},
        10 // 10ms execution
      );

      expect(completeEvent).not.toBeNull();
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);
      expect(completeEvent!.timing.duration).toBeLessThan(50);
      expect(completeEvent!.timing.endTime.getTime()).toBeGreaterThanOrEqual(completeEvent!.timing.startTime.getTime());
    });
  });

  describe('Edge Cases', () => {
    it('should handle mixed success and failure executions', async () => {
      const results: Array<{ callId: string; success: boolean; duration: number }> = [];

      orchestrator.on('tool:complete', (event) => {
        results.push({
          callId: event.callId,
          success: event.result.success,
          duration: event.timing.duration
        });
      });

      const promises = [
        orchestrator.simulateToolExecution('mixed-1', 'SuccessTool', 'success-call', {}, 50, { shouldFail: false }),
        orchestrator.simulateToolExecution('mixed-2', 'FailTool', 'fail-call', {}, 40, { shouldFail: true }),
        orchestrator.simulateToolExecution('mixed-3', 'AnotherSuccessTool', 'another-success-call', {}, 60, { shouldFail: false }),
      ];

      await Promise.all(promises);

      expect(results).toHaveLength(3);

      const successResults = results.filter(r => r.success);
      const failResults = results.filter(r => !r.success);

      expect(successResults).toHaveLength(2);
      expect(failResults).toHaveLength(1);

      // All tools should have reasonable timing regardless of success/failure
      results.forEach(result => {
        expect(result.duration).toBeGreaterThan(30);
        expect(result.duration).toBeLessThan(100);
      });
    });

    it('should ensure all timing fields are properly typed', async () => {
      let startEvent: ToolCallStartEvent | null = null;
      let completeEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:start', (event) => {
        startEvent = event;
      });

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      await orchestrator.simulateToolExecution(
        'type-task',
        'TypeTool',
        'type-call',
        { test: 'typing' },
        50
      );

      expect(startEvent).not.toBeNull();
      expect(completeEvent).not.toBeNull();

      // Verify start event types
      expect(typeof startEvent!.taskId).toBe('string');
      expect(typeof startEvent!.toolName).toBe('string');
      expect(typeof startEvent!.callId).toBe('string');
      expect(startEvent!.input).toBeInstanceOf(Object);
      expect(startEvent!.startTime).toBeInstanceOf(Date);
      expect(startEvent!.timestamp).toBeInstanceOf(Date);

      // Verify complete event types
      expect(typeof completeEvent!.taskId).toBe('string');
      expect(typeof completeEvent!.toolName).toBe('string');
      expect(typeof completeEvent!.callId).toBe('string');
      expect(completeEvent!.result).toBeInstanceOf(Object);
      expect(typeof completeEvent!.result.success).toBe('boolean');

      // Verify timing object types
      expect(completeEvent!.timing).toBeInstanceOf(Object);
      expect(completeEvent!.timing.startTime).toBeInstanceOf(Date);
      expect(completeEvent!.timing.endTime).toBeInstanceOf(Date);
      expect(typeof completeEvent!.timing.duration).toBe('number');
      expect(completeEvent!.timestamp).toBeInstanceOf(Date);

      // Verify Date objects are valid
      expect(isNaN(startEvent!.startTime.getTime())).toBe(false);
      expect(isNaN(completeEvent!.timing.startTime.getTime())).toBe(false);
      expect(isNaN(completeEvent!.timing.endTime.getTime())).toBe(false);
    });
  });
});