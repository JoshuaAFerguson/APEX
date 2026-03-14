import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Integration tests for timing event flow
 *
 * These tests verify the complete timing event flow from tool start to completion,
 * ensuring proper event emission order and data consistency throughout the lifecycle.
 */

interface TimingEventData {
  eventType: 'start' | 'progress' | 'complete';
  timestamp: number;
  callId: string;
  toolName: string;
  data: any;
}

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
 * Mock timing event emitter for integration testing
 */
class TimingEventEmitter extends EventEmitter {
  private activeExecutions = new Map<string, { startTime: Date; toolName: string; taskId: string }>();

  simulateToolExecution(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    executionTimeMs: number = 100,
    options: { shouldFail?: boolean } = {}
  ): Promise<void> {
    return new Promise((resolve) => {
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

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  isExecutionActive(callId: string): boolean {
    return this.activeExecutions.has(callId);
  }
}

describe('Timing Integration Flow', () => {
  let emitter: TimingEventEmitter;
  let capturedEvents: TimingEventData[];

  beforeEach(() => {
    emitter = new TimingEventEmitter();
    capturedEvents = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    emitter.removeAllListeners();
    vi.useRealTimers();
  });

  function setupEventCapture() {
    emitter.on('tool:start', (event: ToolCallStartEvent) => {
      capturedEvents.push({
        eventType: 'start',
        timestamp: Date.now(),
        callId: event.callId,
        toolName: event.toolName,
        data: { startTime: event.startTime, input: event.input },
      });
    });

    emitter.on('tool:complete', (event: ToolCallCompleteEvent) => {
      capturedEvents.push({
        eventType: 'complete',
        timestamp: Date.now(),
        callId: event.callId,
        toolName: event.toolName,
        data: { result: event.result, timing: event.timing },
      });
    });
  }

  describe('Single Tool Execution Flow', () => {
    it('should emit events in correct order for successful execution', async () => {
      setupEventCapture();

      const promise = emitter.simulateToolExecution(
        'task-001',
        'TestTool',
        'call-001',
        { param: 'value' },
        100
      );

      // Fast-forward time to complete execution
      vi.advanceTimersByTime(100);
      await promise;

      expect(capturedEvents).toHaveLength(2);
      expect(capturedEvents[0].eventType).toBe('start');
      expect(capturedEvents[1].eventType).toBe('complete');

      // Verify event data consistency
      expect(capturedEvents[0].callId).toBe(capturedEvents[1].callId);
      expect(capturedEvents[0].toolName).toBe(capturedEvents[1].toolName);
    });

    it('should maintain timing consistency throughout execution lifecycle', async () => {
      let startEvent: ToolCallStartEvent | null = null;
      let completeEvent: ToolCallCompleteEvent | null = null;

      emitter.on('tool:start', (event) => { startEvent = event; });
      emitter.on('tool:complete', (event) => { completeEvent = event; });

      const promise = emitter.simulateToolExecution(
        'timing-task',
        'TimingTool',
        'timing-call',
        { test: 'timing' },
        150
      );

      vi.advanceTimersByTime(150);
      await promise;

      expect(startEvent).not.toBeNull();
      expect(completeEvent).not.toBeNull();

      // Verify timing consistency
      expect(startEvent!.startTime.getTime()).toBe(completeEvent!.timing.startTime.getTime());
      expect(completeEvent!.timing.endTime.getTime()).toBeGreaterThan(completeEvent!.timing.startTime.getTime());
      expect(completeEvent!.timing.duration).toBe(
        completeEvent!.timing.endTime.getTime() - completeEvent!.timing.startTime.getTime()
      );
    });

    it('should handle failed tool execution with proper timing', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      emitter.on('tool:complete', (event) => { completeEvent = event; });

      const promise = emitter.simulateToolExecution(
        'error-task',
        'ErrorTool',
        'error-call',
        { trigger: 'error' },
        80,
        { shouldFail: true }
      );

      vi.advanceTimersByTime(80);
      await promise;

      expect(completeEvent).not.toBeNull();
      expect(completeEvent!.result.success).toBe(false);
      expect(completeEvent!.result.error).toBe('Execution failed');

      // Timing should still be accurate for failed executions
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Multiple Tool Execution Flow', () => {
    it('should handle concurrent tool executions correctly', async () => {
      setupEventCapture();

      const promises = [
        emitter.simulateToolExecution('task-1', 'Tool1', 'call-1', {}, 100),
        emitter.simulateToolExecution('task-2', 'Tool2', 'call-2', {}, 150),
        emitter.simulateToolExecution('task-3', 'Tool3', 'call-3', {}, 80),
      ];

      // Fast-forward to complete all executions
      vi.advanceTimersByTime(200);
      await Promise.all(promises);

      // Should have 6 events total (3 start + 3 complete)
      expect(capturedEvents).toHaveLength(6);

      // Group events by call ID
      const call1Events = capturedEvents.filter(e => e.callId === 'call-1');
      const call2Events = capturedEvents.filter(e => e.callId === 'call-2');
      const call3Events = capturedEvents.filter(e => e.callId === 'call-3');

      // Each tool should have start + complete events
      expect(call1Events).toHaveLength(2);
      expect(call2Events).toHaveLength(2);
      expect(call3Events).toHaveLength(2);

      // Verify order within each tool execution
      expect(call1Events[0].eventType).toBe('start');
      expect(call1Events[1].eventType).toBe('complete');
      expect(call2Events[0].eventType).toBe('start');
      expect(call2Events[1].eventType).toBe('complete');
      expect(call3Events[0].eventType).toBe('start');
      expect(call3Events[1].eventType).toBe('complete');
    });

    it('should track active executions correctly', async () => {
      // Start executions without awaiting
      emitter.simulateToolExecution('task-a', 'ToolA', 'call-a', {}, 200);
      emitter.simulateToolExecution('task-b', 'ToolB', 'call-b', {}, 300);

      // Allow microtasks to execute to start the simulations
      await Promise.resolve();

      // Now both should be active (started but not completed)
      expect(emitter.getActiveExecutions()).toHaveLength(2);
      expect(emitter.getActiveExecutions()).toContain('call-a');
      expect(emitter.getActiveExecutions()).toContain('call-b');

      // Complete first execution
      vi.advanceTimersByTime(200);
      await Promise.resolve(); // Allow completion callback to execute

      // Only call-b should still be active
      expect(emitter.getActiveExecutions()).toHaveLength(1);
      expect(emitter.getActiveExecutions()).toContain('call-b');

      // Complete second execution
      vi.advanceTimersByTime(100); // total 300ms for call-b
      await Promise.resolve();

      // No active executions remaining
      expect(emitter.getActiveExecutions()).toHaveLength(0);
    });
  });

  describe('Timing Accuracy Verification', () => {
    it('should provide accurate timing measurements within tolerance', async () => {
      const testCases = [
        { expectedDuration: 50, tolerance: 10 },
        { expectedDuration: 100, tolerance: 15 },
        { expectedDuration: 200, tolerance: 25 },
      ];

      for (const { expectedDuration, tolerance } of testCases) {
        let completeEvent: ToolCallCompleteEvent | null = null;

        emitter.on('tool:complete', (event) => { completeEvent = event; });

        const promise = emitter.simulateToolExecution(
          'accuracy-task',
          'AccuracyTool',
          `accuracy-${expectedDuration}`,
          { duration: expectedDuration },
          expectedDuration
        );

        vi.advanceTimersByTime(expectedDuration);
        await promise;

        expect(completeEvent).not.toBeNull();
        expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(expectedDuration - tolerance);
        expect(completeEvent!.timing.duration).toBeLessThanOrEqual(expectedDuration + tolerance);

        // Reset for next iteration
        emitter.removeAllListeners();
        completeEvent = null;
      }
    });

    it('should handle very fast executions (< 10ms)', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      emitter.on('tool:complete', (event) => { completeEvent = event; });

      const promise = emitter.simulateToolExecution(
        'fast-task',
        'FastTool',
        'fast-call',
        {},
        5 // 5ms execution
      );

      vi.advanceTimersByTime(5);
      await promise;

      expect(completeEvent).not.toBeNull();
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);
      expect(completeEvent!.timing.duration).toBeLessThanOrEqual(20); // Allow some tolerance
    });

    it('should handle longer executions (> 1 second)', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      emitter.on('tool:complete', (event) => { completeEvent = event; });

      const longDuration = 2500; // 2.5 seconds
      const promise = emitter.simulateToolExecution(
        'long-task',
        'LongTool',
        'long-call',
        {},
        longDuration
      );

      vi.advanceTimersByTime(longDuration);
      await promise;

      expect(completeEvent).not.toBeNull();
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(longDuration - 100); // 100ms tolerance
      expect(completeEvent!.timing.duration).toBeLessThanOrEqual(longDuration + 100);
    });
  });

  describe('Event Data Integrity', () => {
    it('should maintain consistent identifiers across event lifecycle', async () => {
      const taskId = 'integrity-task';
      const toolName = 'IntegrityTool';
      const callId = 'integrity-call';
      const input = { test: 'integrity', data: { nested: true } };

      let startEvent: ToolCallStartEvent | null = null;
      let completeEvent: ToolCallCompleteEvent | null = null;

      emitter.on('tool:start', (event) => { startEvent = event; });
      emitter.on('tool:complete', (event) => { completeEvent = event; });

      const promise = emitter.simulateToolExecution(taskId, toolName, callId, input, 100);

      vi.advanceTimersByTime(100);
      await promise;

      expect(startEvent).not.toBeNull();
      expect(completeEvent).not.toBeNull();

      // Verify all identifiers match
      expect(startEvent!.taskId).toBe(taskId);
      expect(startEvent!.toolName).toBe(toolName);
      expect(startEvent!.callId).toBe(callId);
      expect(startEvent!.input).toEqual(input);

      expect(completeEvent!.taskId).toBe(taskId);
      expect(completeEvent!.toolName).toBe(toolName);
      expect(completeEvent!.callId).toBe(callId);

      // Cross-verify between events
      expect(startEvent!.taskId).toBe(completeEvent!.taskId);
      expect(startEvent!.toolName).toBe(completeEvent!.toolName);
      expect(startEvent!.callId).toBe(completeEvent!.callId);
    });

    it('should ensure all timestamps are valid Date objects', async () => {
      let startEvent: ToolCallStartEvent | null = null;
      let completeEvent: ToolCallCompleteEvent | null = null;

      emitter.on('tool:start', (event) => { startEvent = event; });
      emitter.on('tool:complete', (event) => { completeEvent = event; });

      const promise = emitter.simulateToolExecution(
        'timestamp-task',
        'TimestampTool',
        'timestamp-call',
        {},
        120
      );

      vi.advanceTimersByTime(120);
      await promise;

      expect(startEvent).not.toBeNull();
      expect(completeEvent).not.toBeNull();

      // Verify all timing fields are proper Date objects
      expect(startEvent!.timestamp).toBeInstanceOf(Date);
      expect(startEvent!.startTime).toBeInstanceOf(Date);
      expect(completeEvent!.timestamp).toBeInstanceOf(Date);
      expect(completeEvent!.timing.startTime).toBeInstanceOf(Date);
      expect(completeEvent!.timing.endTime).toBeInstanceOf(Date);

      // Verify Date methods work
      expect(typeof startEvent!.timestamp.getTime()).toBe('number');
      expect(typeof completeEvent!.timing.endTime.getTime()).toBe('number');
    });
  });

  describe('Error Handling Integration', () => {
    it('should gracefully handle multiple failed executions', async () => {
      const failedEvents: ToolCallCompleteEvent[] = [];

      emitter.on('tool:complete', (event) => {
        if (!event.result.success) {
          failedEvents.push(event);
        }
      });

      const promises = [
        emitter.simulateToolExecution('fail-1', 'FailTool1', 'fail-call-1', {}, 60, { shouldFail: true }),
        emitter.simulateToolExecution('fail-2', 'FailTool2', 'fail-call-2', {}, 80, { shouldFail: true }),
        emitter.simulateToolExecution('success-1', 'SuccessTool', 'success-call-1', {}, 100),
      ];

      vi.advanceTimersByTime(120);
      await Promise.all(promises);

      expect(failedEvents).toHaveLength(2);

      failedEvents.forEach(event => {
        expect(event.result.success).toBe(false);
        expect(event.result.error).toBeDefined();
        expect(event.timing.duration).toBeGreaterThan(0); // Should still have timing
      });
    });

    it('should maintain event flow integrity even with mixed success/failure', async () => {
      setupEventCapture();

      const promises = [
        emitter.simulateToolExecution('mixed-1', 'Tool1', 'mixed-call-1', {}, 50),
        emitter.simulateToolExecution('mixed-2', 'Tool2', 'mixed-call-2', {}, 70, { shouldFail: true }),
        emitter.simulateToolExecution('mixed-3', 'Tool3', 'mixed-call-3', {}, 90),
      ];

      vi.advanceTimersByTime(100);
      await Promise.all(promises);

      // Should still have all events (start + complete for each tool)
      expect(capturedEvents).toHaveLength(6);

      // Verify each tool has proper event sequence
      const tool1Events = capturedEvents.filter(e => e.callId === 'mixed-call-1');
      const tool2Events = capturedEvents.filter(e => e.callId === 'mixed-call-2');
      const tool3Events = capturedEvents.filter(e => e.callId === 'mixed-call-3');

      expect(tool1Events[0].eventType).toBe('start');
      expect(tool1Events[1].eventType).toBe('complete');
      expect(tool2Events[0].eventType).toBe('start');
      expect(tool2Events[1].eventType).toBe('complete');
      expect(tool3Events[0].eventType).toBe('start');
      expect(tool3Events[1].eventType).toBe('complete');
    });
  });
});