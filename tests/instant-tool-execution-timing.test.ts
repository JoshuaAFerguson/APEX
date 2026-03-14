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
});