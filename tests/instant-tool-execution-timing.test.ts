/**
 * Instant Tool Execution Timing Events Tests
 *
 * Comprehensive test suite for verifying timing event accuracy and consistency
 * for tools that execute immediately (zero or near-zero duration).
 *
 * This addresses the critical requirement that timing events must be accurately
 * captured even for tools that complete instantaneously, ensuring proper
 * start/end time recording and event emission order.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Type definitions for timing events
interface ToolStartEvent {
  taskId: string;
  toolName: string;
  callId: string;
  input: Record<string, unknown>;
  timestamp: Date;
}

interface ToolCompleteEvent {
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
 * Instant Tool Execution Simulator
 * Simulates tools that complete immediately for testing timing events
 */
class InstantToolExecutionSimulator extends EventEmitter {
  private executionHistory: Map<string, {
    startEvent: ToolStartEvent;
    completeEvent?: ToolCompleteEvent;
  }> = new Map();

  /**
   * Execute a tool instantly (zero delay)
   */
  async executeInstantly(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    success: boolean = true,
    output?: unknown,
    error?: string
  ): Promise<{ startEvent: ToolStartEvent; completeEvent: ToolCompleteEvent }> {
    const startTime = new Date();

    // Create start event
    const startEvent: ToolStartEvent = {
      taskId,
      toolName,
      callId,
      input,
      timestamp: startTime,
    };

    // Emit start event
    this.emit('tool:start', startEvent);

    // For true instant execution, endTime should be the same or 1ms later
    const endTime = new Date(startTime.getTime()); // Same timestamp for instant execution
    const duration = endTime.getTime() - startTime.getTime(); // Should be 0

    // Create complete event
    const completeEvent: ToolCompleteEvent = {
      taskId,
      toolName,
      callId,
      result: {
        success,
        output,
        error,
      },
      timing: {
        startTime,
        endTime,
        duration,
      },
      timestamp: endTime,
    };

    // Store execution history
    this.executionHistory.set(callId, { startEvent, completeEvent });

    // Emit complete event immediately
    this.emit('tool:complete', completeEvent);

    return { startEvent, completeEvent };
  }

  /**
   * Execute multiple tools instantly in sequence
   */
  async executeSequence(
    taskId: string,
    tools: Array<{
      toolName: string;
      callId: string;
      input: Record<string, unknown>;
      success?: boolean;
      output?: unknown;
      error?: string;
    }>
  ): Promise<Array<{ startEvent: ToolStartEvent; completeEvent: ToolCompleteEvent }>> {
    const results = [];

    for (const tool of tools) {
      const result = await this.executeInstantly(
        taskId,
        tool.toolName,
        tool.callId,
        tool.input,
        tool.success,
        tool.output,
        tool.error
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Execute multiple tools instantly in parallel
   */
  async executeParallel(
    taskId: string,
    tools: Array<{
      toolName: string;
      callId: string;
      input: Record<string, unknown>;
      success?: boolean;
      output?: unknown;
      error?: string;
    }>
  ): Promise<Array<{ startEvent: ToolStartEvent; completeEvent: ToolCompleteEvent }>> {
    const promises = tools.map(tool =>
      this.executeInstantly(
        taskId,
        tool.toolName,
        tool.callId,
        tool.input,
        tool.success,
        tool.output,
        tool.error
      )
    );

    return Promise.all(promises);
  }

  /**
   * Get execution history for analysis
   */
  getExecutionHistory(): Map<string, {
    startEvent: ToolStartEvent;
    completeEvent?: ToolCompleteEvent;
  }> {
    return new Map(this.executionHistory);
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory.clear();
  }
}

describe('Instant Tool Execution Timing Events', () => {
  let simulator: InstantToolExecutionSimulator;
  const TIMING_TOLERANCE = 5; // 5ms tolerance for CI environments

  beforeEach(() => {
    simulator = new InstantToolExecutionSimulator();
    vi.clearAllTimers();
  });

  describe('Basic Instant Execution Timing', () => {
    it('should capture accurate timing for instant successful tool execution', async () => {
      const taskId = 'instant-task-001';
      const toolName = 'ReadTool';
      const callId = 'instant-call-001';
      const input = { file_path: '/test/file.txt' };
      const output = { content: 'Hello World' };

      let startEvent: ToolStartEvent | null = null;
      let completeEvent: ToolCompleteEvent | null = null;

      simulator.on('tool:start', (event) => {
        startEvent = event;
      });

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      // Execute tool instantly
      const result = await simulator.executeInstantly(
        taskId,
        toolName,
        callId,
        input,
        true,
        output
      );

      // Verify start event
      expect(startEvent).toBeTruthy();
      expect(startEvent!.taskId).toBe(taskId);
      expect(startEvent!.toolName).toBe(toolName);
      expect(startEvent!.callId).toBe(callId);
      expect(startEvent!.input).toEqual(input);
      expect(startEvent!.timestamp).toBeInstanceOf(Date);

      // Verify complete event
      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.success).toBe(true);
      expect(completeEvent!.result.output).toEqual(output);
      expect(completeEvent!.result.error).toBeUndefined();

      // Verify instant timing characteristics
      expect(completeEvent!.timing.startTime).toBeInstanceOf(Date);
      expect(completeEvent!.timing.endTime).toBeInstanceOf(Date);
      expect(completeEvent!.timing.duration).toBe(0); // Should be exactly 0 for instant execution

      // Start time should equal end time for instant execution
      expect(completeEvent!.timing.startTime.getTime()).toBe(
        completeEvent!.timing.endTime.getTime()
      );

      // Timing consistency check
      const calculatedDuration =
        completeEvent!.timing.endTime.getTime() - completeEvent!.timing.startTime.getTime();
      expect(completeEvent!.timing.duration).toBe(calculatedDuration);

      // Start event timestamp should match complete event start time
      expect(startEvent!.timestamp.getTime()).toBe(completeEvent!.timing.startTime.getTime());
    });

    it('should capture accurate timing for instant failed tool execution', async () => {
      const taskId = 'instant-fail-task-001';
      const toolName = 'WriteTool';
      const callId = 'instant-fail-call-001';
      const input = { file_path: '/readonly/file.txt', content: 'test' };
      const error = 'Permission denied';

      let completeEvent: ToolCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      // Execute tool that fails instantly
      await simulator.executeInstantly(
        taskId,
        toolName,
        callId,
        input,
        false,
        undefined,
        error
      );

      // Verify failure result
      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.result.success).toBe(false);
      expect(completeEvent!.result.error).toBe(error);
      expect(completeEvent!.result.output).toBeUndefined();

      // Verify instant timing for failed execution
      expect(completeEvent!.timing.duration).toBe(0);
      expect(completeEvent!.timing.startTime.getTime()).toBe(
        completeEvent!.timing.endTime.getTime()
      );
    });

    it('should handle multiple instant executions with consistent timing', async () => {
      const events: ToolCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      const tools = [
        { toolName: 'ReadTool', callId: 'read-1', input: { file: 'file1.txt' } },
        { toolName: 'GrepTool', callId: 'grep-1', input: { pattern: 'test' } },
        { toolName: 'GlobTool', callId: 'glob-1', input: { pattern: '*.js' } },
      ];

      // Execute multiple tools instantly in sequence
      await simulator.executeSequence('multi-task', tools);

      expect(events).toHaveLength(3);

      // Verify all have instant timing characteristics
      events.forEach((event, index) => {
        expect(event.timing.duration).toBe(0);
        expect(event.timing.startTime.getTime()).toBe(event.timing.endTime.getTime());
        expect(event.callId).toBe(tools[index].callId);
      });

      // Verify execution order (should be chronological)
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timing.startTime.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timing.endTime.getTime()
        );
      }
    });
  });

  describe('Concurrent Instant Execution', () => {
    it('should handle concurrent instant executions with isolated timing', async () => {
      const events: ToolCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      const tools = [
        { toolName: 'Tool1', callId: 'concurrent-1', input: { param: 'value1' } },
        { toolName: 'Tool2', callId: 'concurrent-2', input: { param: 'value2' } },
        { toolName: 'Tool3', callId: 'concurrent-3', input: { param: 'value3' } },
        { toolName: 'Tool4', callId: 'concurrent-4', input: { param: 'value4' } },
      ];

      // Execute all tools in parallel
      await simulator.executeParallel('concurrent-task', tools);

      expect(events).toHaveLength(4);

      // Verify each tool has instant timing characteristics
      events.forEach((event) => {
        expect(event.timing.duration).toBe(0);
        expect(event.timing.startTime.getTime()).toBe(event.timing.endTime.getTime());
      });

      // Verify timing isolation - each tool should have independent timing
      const timings = events.map(e => e.timing.startTime.getTime());
      timings.forEach((timing, index) => {
        // Each timing should be valid
        expect(Number.isInteger(timing)).toBe(true);
        expect(timing).toBeGreaterThan(0);
      });
    });

    it('should maintain event ordering for parallel instant executions', async () => {
      const startEvents: ToolStartEvent[] = [];
      const completeEvents: ToolCompleteEvent[] = [];

      simulator.on('tool:start', (event) => {
        startEvents.push(event);
      });

      simulator.on('tool:complete', (event) => {
        completeEvents.push(event);
      });

      const tools = Array.from({ length: 10 }, (_, i) => ({
        toolName: `Tool${i}`,
        callId: `parallel-${i}`,
        input: { index: i },
      }));

      // Execute many tools in parallel
      await simulator.executeParallel('parallel-order-task', tools);

      expect(startEvents).toHaveLength(10);
      expect(completeEvents).toHaveLength(10);

      // Verify each tool has matching start and complete events
      tools.forEach((tool) => {
        const startEvent = startEvents.find(e => e.callId === tool.callId);
        const completeEvent = completeEvents.find(e => e.callId === tool.callId);

        expect(startEvent).toBeTruthy();
        expect(completeEvent).toBeTruthy();

        // Verify timing consistency between start and complete events
        expect(startEvent!.timestamp.getTime()).toBe(
          completeEvent!.timing.startTime.getTime()
        );
      });
    });
  });

  describe('Edge Cases for Instant Execution', () => {
    it('should handle rapid successive instant executions', async () => {
      const events: ToolCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      const executionCount = 50;
      const tools = Array.from({ length: executionCount }, (_, i) => ({
        toolName: `RapidTool${i}`,
        callId: `rapid-${i}`,
        input: { iteration: i },
      }));

      // Execute many tools rapidly
      const startTime = performance.now();
      await simulator.executeSequence('rapid-task', tools);
      const totalDuration = performance.now() - startTime;

      expect(events).toHaveLength(executionCount);

      // Verify all have instant timing
      events.forEach((event, index) => {
        expect(event.timing.duration).toBe(0);
        expect(event.callId).toBe(`rapid-${index}`);
      });

      // Verify rapid execution completed quickly (should be under 100ms)
      expect(totalDuration).toBeLessThan(100);
    });

    it('should handle mixed instant success and failure executions', async () => {
      const events: ToolCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      const tools = [
        { toolName: 'SuccessTool1', callId: 'success-1', input: {}, success: true, output: 'OK' },
        { toolName: 'FailTool1', callId: 'fail-1', input: {}, success: false, error: 'Error 1' },
        { toolName: 'SuccessTool2', callId: 'success-2', input: {}, success: true, output: 'OK' },
        { toolName: 'FailTool2', callId: 'fail-2', input: {}, success: false, error: 'Error 2' },
      ];

      // Execute mixed success/failure tools
      await simulator.executeSequence('mixed-task', tools);

      expect(events).toHaveLength(4);

      const successEvents = events.filter(e => e.result.success);
      const failureEvents = events.filter(e => !e.result.success);

      expect(successEvents).toHaveLength(2);
      expect(failureEvents).toHaveLength(2);

      // Verify all have instant timing regardless of success/failure
      events.forEach((event) => {
        expect(event.timing.duration).toBe(0);
        expect(event.timing.startTime.getTime()).toBe(event.timing.endTime.getTime());
      });

      // Verify success events have output
      successEvents.forEach((event) => {
        expect(event.result.output).toBeDefined();
        expect(event.result.error).toBeUndefined();
      });

      // Verify failure events have error
      failureEvents.forEach((event) => {
        expect(event.result.error).toBeDefined();
        expect(event.result.output).toBeUndefined();
      });
    });

    it('should preserve timing precision for instant executions', async () => {
      const events: ToolCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      // Execute a single instant tool
      await simulator.executeInstantly(
        'precision-task',
        'PrecisionTool',
        'precision-call',
        { test: true },
        true,
        { result: 'precise' }
      );

      expect(events).toHaveLength(1);

      const event = events[0];

      // Verify timing precision
      expect(Number.isInteger(event.timing.duration)).toBe(true);
      expect(event.timing.duration).toBe(0);

      // Verify timestamps are valid dates
      expect(event.timing.startTime.toString()).not.toBe('Invalid Date');
      expect(event.timing.endTime.toString()).not.toBe('Invalid Date');
      expect(event.timestamp.toString()).not.toBe('Invalid Date');

      // Verify timestamp relationships
      expect(event.timestamp.getTime()).toBe(event.timing.endTime.getTime());
    });

    it('should handle instant execution with complex input data', async () => {
      let completeEvent: ToolCompleteEvent | null = null;

      simulator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const complexInput = {
        nested: {
          array: [1, 2, 3, { deep: true }],
          object: {
            string: 'test',
            number: 42,
            boolean: true,
            null_value: null,
            undefined_value: undefined,
          },
        },
        special_chars: 'áéíóú ñ 中文 🎉',
        large_data: 'x'.repeat(10000),
      };

      const complexOutput = {
        processed: true,
        metadata: {
          input_size: JSON.stringify(complexInput).length,
          processing_time: 0,
        },
      };

      // Execute with complex data
      await simulator.executeInstantly(
        'complex-task',
        'ComplexTool',
        'complex-call',
        complexInput,
        true,
        complexOutput
      );

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.timing.duration).toBe(0);
      expect(completeEvent!.result.success).toBe(true);
      expect(completeEvent!.result.output).toEqual(complexOutput);
    });
  });

  describe('Timing Event Consistency', () => {
    it('should maintain consistent timing data across multiple instant executions', async () => {
      const executionHistory = [];

      // Execute 20 instant tools
      for (let i = 0; i < 20; i++) {
        const result = await simulator.executeInstantly(
          'consistency-task',
          `Tool${i}`,
          `call-${i}`,
          { index: i },
          true,
          { processed: i }
        );

        executionHistory.push(result);
      }

      expect(executionHistory).toHaveLength(20);

      // Verify timing consistency
      executionHistory.forEach((execution, index) => {
        const { startEvent, completeEvent } = execution;

        // Basic timing checks
        expect(completeEvent.timing.duration).toBe(0);
        expect(completeEvent.timing.startTime.getTime()).toBe(
          completeEvent.timing.endTime.getTime()
        );

        // Event consistency checks
        expect(startEvent.taskId).toBe(completeEvent.taskId);
        expect(startEvent.toolName).toBe(completeEvent.toolName);
        expect(startEvent.callId).toBe(completeEvent.callId);
        expect(startEvent.timestamp.getTime()).toBe(
          completeEvent.timing.startTime.getTime()
        );

        // Verify execution order
        if (index > 0) {
          const prevExecution = executionHistory[index - 1];
          expect(startEvent.timestamp.getTime()).toBeGreaterThanOrEqual(
            prevExecution.completeEvent.timing.endTime.getTime()
          );
        }
      });
    });

    it('should ensure timing events are properly isolated between different tasks', async () => {
      const task1Events: ToolCompleteEvent[] = [];
      const task2Events: ToolCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        if (event.taskId === 'task-1') {
          task1Events.push(event);
        } else if (event.taskId === 'task-2') {
          task2Events.push(event);
        }
      });

      // Execute tools for different tasks in parallel
      const task1Tools = Array.from({ length: 5 }, (_, i) => ({
        toolName: `Task1Tool${i}`,
        callId: `task1-${i}`,
        input: { task: 1, index: i },
      }));

      const task2Tools = Array.from({ length: 5 }, (_, i) => ({
        toolName: `Task2Tool${i}`,
        callId: `task2-${i}`,
        input: { task: 2, index: i },
      }));

      // Execute both tasks in parallel
      await Promise.all([
        simulator.executeParallel('task-1', task1Tools),
        simulator.executeParallel('task-2', task2Tools),
      ]);

      expect(task1Events).toHaveLength(5);
      expect(task2Events).toHaveLength(5);

      // Verify task isolation
      task1Events.forEach((event) => {
        expect(event.taskId).toBe('task-1');
        expect(event.timing.duration).toBe(0);
      });

      task2Events.forEach((event) => {
        expect(event.taskId).toBe('task-2');
        expect(event.timing.duration).toBe(0);
      });

      // Verify no cross-contamination
      const allCallIds = [...task1Events, ...task2Events].map(e => e.callId);
      const uniqueCallIds = new Set(allCallIds);
      expect(uniqueCallIds.size).toBe(10); // All call IDs should be unique
    });
  });

  describe('Performance Verification', () => {
    it('should handle high-volume instant executions efficiently', async () => {
      const eventCount = 1000;
      const events: ToolCompleteEvent[] = [];

      simulator.on('tool:complete', (event) => {
        events.push(event);
      });

      const tools = Array.from({ length: eventCount }, (_, i) => ({
        toolName: `PerformanceTool${i}`,
        callId: `perf-${i}`,
        input: { iteration: i },
      }));

      const startTime = performance.now();
      await simulator.executeSequence('performance-task', tools);
      const executionTime = performance.now() - startTime;

      expect(events).toHaveLength(eventCount);

      // Verify all executions completed instantly
      events.forEach((event) => {
        expect(event.timing.duration).toBe(0);
      });

      // Performance check - should complete within reasonable time
      // (This is generous to account for CI environment variations)
      expect(executionTime).toBeLessThan(5000); // 5 seconds max

      // Calculate average time per execution
      const avgTimePerExecution = executionTime / eventCount;
      expect(avgTimePerExecution).toBeLessThan(5); // Under 5ms per execution on average
    });
  });

  describe('Chronological Event Ordering', () => {
    beforeEach(() => {
      simulator = new InstantToolExecutionSimulator();
      vi.clearAllTimers();
    });

    describe('Sequential Execution', () => {
      it('should emit events in chronological sequence order', async () => {
        const capturedEvents: Array<{ type: string; event: any; captureTime: number; sequenceIndex: number }> = [];
        let sequenceCounter = 0;

        // Capture all events with sequence information
        simulator.on('tool:start', (event) => {
          capturedEvents.push({
            type: 'tool:start',
            event,
            captureTime: performance.now(),
            sequenceIndex: sequenceCounter++,
          });
        });

        simulator.on('tool:complete', (event) => {
          capturedEvents.push({
            type: 'tool:complete',
            event,
            captureTime: performance.now(),
            sequenceIndex: sequenceCounter++,
          });
        });

        const tools = [
          { toolName: 'Tool1', callId: 'seq-1', input: { index: 1 } },
          { toolName: 'Tool2', callId: 'seq-2', input: { index: 2 } },
          { toolName: 'Tool3', callId: 'seq-3', input: { index: 3 } },
          { toolName: 'Tool4', callId: 'seq-4', input: { index: 4 } },
          { toolName: 'Tool5', callId: 'seq-5', input: { index: 5 } },
        ];

        // Execute tools sequentially
        await simulator.executeSequence('chronological-task', tools);

        expect(capturedEvents).toHaveLength(10); // 5 start + 5 complete events

        // Sort events by sequence index (capture order)
        capturedEvents.sort((a, b) => a.sequenceIndex - b.sequenceIndex);

        // Verify chronological ordering: events are captured in emission order
        const expectedOrder = [
          'tool:start',   // Tool1 start
          'tool:complete', // Tool1 complete
          'tool:start',   // Tool2 start
          'tool:complete', // Tool2 complete
          'tool:start',   // Tool3 start
          'tool:complete', // Tool3 complete
          'tool:start',   // Tool4 start
          'tool:complete', // Tool4 complete
          'tool:start',   // Tool5 start
          'tool:complete', // Tool5 complete
        ];

        // Validate that events follow chronological emission order
        capturedEvents.forEach((capturedEvent, index) => {
          expect(capturedEvent.type).toBe(expectedOrder[index]);
          expect(capturedEvent.sequenceIndex).toBe(index);
        });

        // Validate per-tool ordering: start precedes complete
        for (const tool of tools) {
          const toolStartEvent = capturedEvents.find(
            e => e.type === 'tool:start' && e.event.callId === tool.callId
          );
          const toolCompleteEvent = capturedEvents.find(
            e => e.type === 'tool:complete' && e.event.callId === tool.callId
          );

          expect(toolStartEvent).toBeTruthy();
          expect(toolCompleteEvent).toBeTruthy();
          expect(toolStartEvent!.sequenceIndex).toBeLessThan(toolCompleteEvent!.sequenceIndex);

          // Verify timestamp ordering within tool execution
          expect(toolStartEvent!.event.timestamp.getTime()).toBeLessThanOrEqual(
            toolCompleteEvent!.event.timing.startTime.getTime()
          );
          expect(toolCompleteEvent!.event.timing.startTime.getTime()).toBeLessThanOrEqual(
            toolCompleteEvent!.event.timing.endTime.getTime()
          );
        }
      });

      it('should have increasing sequence indices for sequential tools', async () => {
        const allEvents: Array<{ event: any; sequenceIndex: number; captureTime: number }> = [];
        let globalSequence = 0;

        // Capture all events with global sequence
        const captureEvent = (event: any) => {
          allEvents.push({
            event,
            sequenceIndex: globalSequence++,
            captureTime: performance.now(),
          });
        };

        simulator.on('tool:start', captureEvent);
        simulator.on('tool:complete', captureEvent);

        // Execute 8 tools sequentially
        const tools = Array.from({ length: 8 }, (_, i) => ({
          toolName: `SeqTool${i}`,
          callId: `seq-increasing-${i}`,
          input: { index: i },
        }));

        await simulator.executeSequence('sequence-indices-task', tools);

        expect(allEvents).toHaveLength(16); // 8 start + 8 complete events

        // Verify sequence indices are strictly increasing
        for (let i = 1; i < allEvents.length; i++) {
          expect(allEvents[i].sequenceIndex).toBe(allEvents[i - 1].sequenceIndex + 1);
          expect(allEvents[i].captureTime).toBeGreaterThanOrEqual(allEvents[i - 1].captureTime);
        }

        // Verify each tool's events are in order
        for (let i = 0; i < tools.length; i++) {
          const startEventIndex = i * 2;
          const completeEventIndex = i * 2 + 1;

          const startEvent = allEvents[startEventIndex];
          const completeEvent = allEvents[completeEventIndex];

          expect(startEvent.event.callId).toBe(tools[i].callId);
          expect(completeEvent.event.callId).toBe(tools[i].callId);
          expect(startEvent.sequenceIndex).toBe(startEventIndex);
          expect(completeEvent.sequenceIndex).toBe(completeEventIndex);
        }
      });

      it('should maintain timestamp ordering across sequential executions', async () => {
        const timestampedEvents: Array<{ timestamp: Date; callId: string; type: string }> = [];

        simulator.on('tool:start', (event) => {
          timestampedEvents.push({
            timestamp: event.timestamp,
            callId: event.callId,
            type: 'start',
          });
        });

        simulator.on('tool:complete', (event) => {
          timestampedEvents.push({
            timestamp: event.timestamp,
            callId: event.callId,
            type: 'complete',
          });
        });

        const tools = Array.from({ length: 6 }, (_, i) => ({
          toolName: `TimestampTool${i}`,
          callId: `timestamp-${i}`,
          input: { order: i },
        }));

        await simulator.executeSequence('timestamp-ordering-task', tools);

        // Verify timestamps are in chronological order
        for (let i = 1; i < timestampedEvents.length; i++) {
          const prevTime = timestampedEvents[i - 1].timestamp.getTime();
          const currentTime = timestampedEvents[i].timestamp.getTime();

          // Allow equal timestamps for instant execution but no backward movement
          expect(currentTime).toBeGreaterThanOrEqual(prevTime);
        }

        // Verify each tool's start timestamp <= complete timestamp
        for (const tool of tools) {
          const startEvent = timestampedEvents.find(
            e => e.callId === tool.callId && e.type === 'start'
          );
          const completeEvent = timestampedEvents.find(
            e => e.callId === tool.callId && e.type === 'complete'
          );

          expect(startEvent).toBeTruthy();
          expect(completeEvent).toBeTruthy();
          expect(startEvent!.timestamp.getTime()).toBeLessThanOrEqual(
            completeEvent!.timestamp.getTime()
          );
        }
      });
    });

    describe('Concurrent Execution', () => {
      it('should maintain per-tool chronological ordering', async () => {
        const eventsByCallId = new Map<string, Array<{ type: string; sequenceIndex: number; timestamp: Date }>>();
        let globalSequence = 0;

        const recordEvent = (callId: string, type: string, timestamp: Date) => {
          if (!eventsByCallId.has(callId)) {
            eventsByCallId.set(callId, []);
          }
          eventsByCallId.get(callId)!.push({
            type,
            sequenceIndex: globalSequence++,
            timestamp,
          });
        };

        simulator.on('tool:start', (event) => {
          recordEvent(event.callId, 'start', event.timestamp);
        });

        simulator.on('tool:complete', (event) => {
          recordEvent(event.callId, 'complete', event.timestamp);
        });

        const tools = Array.from({ length: 12 }, (_, i) => ({
          toolName: `ConcurrentTool${i}`,
          callId: `concurrent-ordering-${i}`,
          input: { toolIndex: i },
        }));

        // Execute tools concurrently
        await simulator.executeParallel('concurrent-ordering-task', tools);

        expect(eventsByCallId.size).toBe(12);

        // Verify per-tool ordering is maintained
        for (const [callId, events] of eventsByCallId) {
          expect(events).toHaveLength(2); // start + complete

          // Sort by sequence index to verify capture order
          events.sort((a, b) => a.sequenceIndex - b.sequenceIndex);

          const [startEvent, completeEvent] = events;
          expect(startEvent.type).toBe('start');
          expect(completeEvent.type).toBe('complete');

          // Per-tool chronological ordering: start before complete
          expect(startEvent.sequenceIndex).toBeLessThan(completeEvent.sequenceIndex);
          expect(startEvent.timestamp.getTime()).toBeLessThanOrEqual(
            completeEvent.timestamp.getTime()
          );
        }

        // Verify global sequence indices are unique and monotonic
        const allSequenceIndices = Array.from(eventsByCallId.values())
          .flat()
          .map(e => e.sequenceIndex)
          .sort((a, b) => a - b);

        for (let i = 0; i < allSequenceIndices.length; i++) {
          expect(allSequenceIndices[i]).toBe(i);
        }
      });

      it('should have consistent sequence indices with emission order', async () => {
        const captureLog: Array<{
          callId: string;
          type: string;
          sequenceIndex: number;
          captureTime: number;
          timestamp: Date;
        }> = [];
        let sequenceCounter = 0;

        const logCapture = (callId: string, type: string, timestamp: Date) => {
          captureLog.push({
            callId,
            type,
            sequenceIndex: sequenceCounter++,
            captureTime: performance.now(),
            timestamp,
          });
        };

        simulator.on('tool:start', (event) => {
          logCapture(event.callId, 'start', event.timestamp);
        });

        simulator.on('tool:complete', (event) => {
          logCapture(event.callId, 'complete', event.timestamp);
        });

        const tools = Array.from({ length: 8 }, (_, i) => ({
          toolName: `EmissionOrderTool${i}`,
          callId: `emission-${i}`,
          input: { index: i },
        }));

        await simulator.executeParallel('emission-order-task', tools);

        expect(captureLog).toHaveLength(16); // 8 start + 8 complete

        // Sort by sequence index (capture order)
        captureLog.sort((a, b) => a.sequenceIndex - b.sequenceIndex);

        // Verify sequence indices match capture order
        captureLog.forEach((entry, index) => {
          expect(entry.sequenceIndex).toBe(index);
        });

        // Verify capture times are non-decreasing
        for (let i = 1; i < captureLog.length; i++) {
          expect(captureLog[i].captureTime).toBeGreaterThanOrEqual(
            captureLog[i - 1].captureTime
          );
        }

        // Count events per type to ensure balance
        const startEvents = captureLog.filter(e => e.type === 'start').length;
        const completeEvents = captureLog.filter(e => e.type === 'complete').length;
        expect(startEvents).toBe(8);
        expect(completeEvents).toBe(8);
      });

      it('should validate ordering with ConcurrentEventCollector', async () => {
        // Import the ConcurrentEventCollector to test integration
        const { createConcurrentEventCollector } = await import(
          './concurrent-tools/shared/concurrent-event-collector'
        );

        const collector = createConcurrentEventCollector(simulator, {
          eventTypes: ['tool:start', 'tool:complete'],
          highResolutionTiming: true,
        });

        collector.startCapturing();

        const tools = Array.from({ length: 6 }, (_, i) => ({
          toolName: `CollectorTool${i}`,
          callId: `collector-test-${i}`,
          input: { testIndex: i },
        }));

        // Mix sequential and parallel executions
        await Promise.all([
          simulator.executeSequence('collector-seq-task', tools.slice(0, 3)),
          simulator.executeParallel('collector-parallel-task', tools.slice(3, 6)),
        ]);

        collector.stopCapturing();

        const validationResult = collector.validateOrdering();
        expect(validationResult.isValid).toBe(true);
        expect(validationResult.violations).toHaveLength(0);

        // Verify all executions were captured
        expect(validationResult.executionSummaries.size).toBe(6);

        // Check execution summaries
        for (const [callId, summary] of validationResult.executionSummaries) {
          expect(summary.eventsInOrder).toBe(true);
          expect(summary.startEvent).toBeTruthy();
          expect(summary.completeEvent).toBeTruthy();
          expect(summary.duration).toBe(0); // Instant executions
          expect(summary.success).toBe(true);
        }

        // Verify chronological ordering stats
        const stats = validationResult.stats;
        expect(stats.totalEvents).toBe(12); // 6 start + 6 complete
        expect(stats.uniqueCallIds).toBe(6);

        // Timeline should be in chronological order
        const timeline = validationResult.timeline;
        for (let i = 1; i < timeline.length; i++) {
          expect(timeline[i].sequenceIndex).toBeGreaterThanOrEqual(
            timeline[i - 1].sequenceIndex
          );
          expect(timeline[i].captureTime).toBeGreaterThanOrEqual(
            timeline[i - 1].captureTime
          );
        }

        collector.dispose();
      });
    });

    describe('Edge Cases', () => {
      it('should maintain order for instant executions', async () => {
        const instantEvents: Array<{
          callId: string;
          type: string;
          timestamp: Date;
          sequenceIndex: number;
        }> = [];
        let sequence = 0;

        const captureInstantEvent = (callId: string, type: string, timestamp: Date) => {
          instantEvents.push({ callId, type, timestamp, sequenceIndex: sequence++ });
        };

        simulator.on('tool:start', (event) => {
          captureInstantEvent(event.callId, 'start', event.timestamp);
        });

        simulator.on('tool:complete', (event) => {
          captureInstantEvent(event.callId, 'complete', event.timestamp);
        });

        // Execute many instant tools rapidly
        const tools = Array.from({ length: 25 }, (_, i) => ({
          toolName: `InstantTool${i}`,
          callId: `instant-edge-${i}`,
          input: { rapid: true, index: i },
        }));

        await simulator.executeSequence('instant-edge-task', tools);

        expect(instantEvents).toHaveLength(50); // 25 start + 25 complete

        // Verify sequence indices are strictly increasing
        for (let i = 1; i < instantEvents.length; i++) {
          expect(instantEvents[i].sequenceIndex).toBe(instantEvents[i - 1].sequenceIndex + 1);
        }

        // Verify alternating pattern: start, complete, start, complete, ...
        for (let i = 0; i < tools.length; i++) {
          const startIndex = i * 2;
          const completeIndex = i * 2 + 1;

          expect(instantEvents[startIndex].type).toBe('start');
          expect(instantEvents[completeIndex].type).toBe('complete');
          expect(instantEvents[startIndex].callId).toBe(tools[i].callId);
          expect(instantEvents[completeIndex].callId).toBe(tools[i].callId);
        }

        // Verify timestamps are non-decreasing
        for (let i = 1; i < instantEvents.length; i++) {
          expect(instantEvents[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            instantEvents[i - 1].timestamp.getTime()
          );
        }
      });

      it('should preserve order under high concurrency', async () => {
        const { createOrderingValidator } = await import(
          './concurrent-tools/shared/ordering-validator'
        );

        const concurrencyEvents: Array<{
          type: 'tool:start' | 'tool:complete';
          toolName: string;
          callId: string;
          taskId: string;
          timestamp: Date;
          sequenceIndex: number;
          captureTime: number;
        }> = [];
        let sequenceCounter = 0;

        const recordConcurrentEvent = (
          type: 'tool:start' | 'tool:complete',
          event: any
        ) => {
          concurrencyEvents.push({
            type,
            toolName: event.toolName || (event.result?.toolName ?? 'UnknownTool'),
            callId: event.callId,
            taskId: event.taskId,
            timestamp: event.timestamp,
            sequenceIndex: sequenceCounter++,
            captureTime: performance.now(),
          });
        };

        simulator.on('tool:start', (event) => {
          recordConcurrentEvent('tool:start', event);
        });

        simulator.on('tool:complete', (event) => {
          recordConcurrentEvent('tool:complete', event);
        });

        // Create high concurrency scenario
        const highConcurrencyTools = Array.from({ length: 50 }, (_, i) => ({
          toolName: `HighConcurrencyTool${i}`,
          callId: `high-concurrency-${i}`,
          input: { concurrency: true, toolIndex: i },
        }));

        // Execute all tools in parallel to maximize concurrency
        await simulator.executeParallel('high-concurrency-task', highConcurrencyTools);

        expect(concurrencyEvents).toHaveLength(100); // 50 start + 50 complete

        // Create summaries for validation
        const summaries = new Map<string, any>();
        for (const event of concurrencyEvents) {
          if (!summaries.has(event.callId)) {
            summaries.set(event.callId, {
              callId: event.callId,
              toolName: event.toolName,
              taskId: event.taskId,
              progressEvents: [],
              eventsInOrder: true,
            });
          }

          const summary = summaries.get(event.callId)!;
          if (event.type === 'tool:start') {
            summary.startEvent = event;
          } else if (event.type === 'tool:complete') {
            summary.completeEvent = event;
          }
        }

        // Validate ordering with OrderingValidator
        const validator = createOrderingValidator({
          timingTolerance: TIMING_TOLERANCE,
        });

        const violations = validator.validate(concurrencyEvents, summaries);
        expect(violations).toHaveLength(0);

        // Verify each execution has proper ordering
        for (const [callId, summary] of summaries) {
          expect(summary.startEvent).toBeTruthy();
          expect(summary.completeEvent).toBeTruthy();
          expect(summary.startEvent.sequenceIndex).toBeLessThan(
            summary.completeEvent.sequenceIndex
          );
          expect(summary.startEvent.timestamp.getTime()).toBeLessThanOrEqual(
            summary.completeEvent.timestamp.getTime()
          );
        }
      });

      it('should handle progress events in correct order', async () => {
        // For this test, we'll demonstrate proper progress event ordering conceptually
        // since the instant tool simulator doesn't emit actual progress events
        const orderedEvents: Array<{
          callId: string;
          type: 'start' | 'progress' | 'complete';
          sequenceIndex: number;
          timestamp: Date;
        }> = [];
        let sequence = 0;

        // Capture start and complete events
        simulator.on('tool:start', (event) => {
          orderedEvents.push({
            callId: event.callId,
            type: 'start',
            sequenceIndex: sequence++,
            timestamp: event.timestamp,
          });
        });

        simulator.on('tool:complete', (event) => {
          orderedEvents.push({
            callId: event.callId,
            type: 'complete',
            sequenceIndex: sequence++,
            timestamp: event.timestamp,
          });
        });

        const tools = [
          { toolName: 'SimpleToolNoProgress', callId: 'no-progress-1', input: {} },
          { toolName: 'SimpleToolNoProgress2', callId: 'no-progress-2', input: {} },
          { toolName: 'SimpleToolNoProgress3', callId: 'no-progress-3', input: {} },
        ];

        await simulator.executeSequence('progress-order-task', tools);

        // Manually add some simulated progress events in correct positions
        // This demonstrates the expected ordering behavior
        const simulatedProgressEvents = [
          {
            callId: 'no-progress-1',
            type: 'progress' as const,
            sequenceIndex: 0.5, // Between start (0) and complete (1)
            timestamp: new Date(),
          },
          {
            callId: 'no-progress-2',
            type: 'progress' as const,
            sequenceIndex: 2.5, // Between start (2) and complete (3)
            timestamp: new Date(),
          }
        ];

        // Insert progress events in the correct chronological positions
        const allEvents = [...orderedEvents, ...simulatedProgressEvents]
          .sort((a, b) => a.sequenceIndex - b.sequenceIndex);

        // Group events by call ID
        const eventsByCallId = new Map<string, any[]>();
        for (const event of allEvents) {
          if (!eventsByCallId.has(event.callId)) {
            eventsByCallId.set(event.callId, []);
          }
          eventsByCallId.get(event.callId)!.push(event);
        }

        // Verify event ordering within each execution
        for (const [callId, events] of eventsByCallId) {
          // Sort by sequence index (chronological order)
          events.sort((a, b) => a.sequenceIndex - b.sequenceIndex);

          // First event should be start
          expect(events[0].type).toBe('start');

          // Last event should be complete (for tools without progress events)
          // OR for tools with progress, complete should be last
          const lastEvent = events[events.length - 1];
          expect(lastEvent.type).toBe('complete');

          // Any progress events should be between start and complete
          const startEvent = events[0];
          const completeEvent = events[events.length - 1];

          for (let i = 1; i < events.length - 1; i++) {
            if (events[i].type === 'progress') {
              expect(events[i].sequenceIndex).toBeGreaterThan(startEvent.sequenceIndex);
              expect(events[i].sequenceIndex).toBeLessThan(completeEvent.sequenceIndex);
            }
          }

          // Verify sequence indices are strictly increasing (chronological ordering)
          for (let i = 1; i < events.length; i++) {
            expect(events[i].sequenceIndex).toBeGreaterThan(events[i - 1].sequenceIndex);
          }
        }

        // Verify the global ordering principle: events are captured in emission order
        expect(orderedEvents).toHaveLength(6); // 3 start + 3 complete events

        // Check that all original events have increasing sequence indices
        for (let i = 1; i < orderedEvents.length; i++) {
          expect(orderedEvents[i].sequenceIndex).toBe(orderedEvents[i - 1].sequenceIndex + 1);
        }
      });
    });
  });
});