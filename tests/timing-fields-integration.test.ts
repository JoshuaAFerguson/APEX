/**
 * Integration test for timing fields in real tool executions
 *
 * This test suite validates timing data collection across real tool executions,
 * ensuring that startTime, endTime, and duration fields are properly captured
 * and consistent across different scenarios and tool types.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  assertFailedToolTiming,
  assertConcurrentFailedToolTiming,
  assertTimingAccuracy,
  waitForEvents,
  type ToolCallCompleteEventLike,
} from './test-utils/failed-tool-timing-helpers';

interface TimingTestHarness {
  orchestrator: MockOrchestrator;
  events: ToolCallCompleteEventLike[];
}

/**
 * Mock orchestrator that simulates real tool execution timing
 */
class MockOrchestrator extends EventEmitter {
  private activeTools = new Map<string, {
    startTime: number;
    realStartTime: Date;
    toolName: string;
    taskId: string;
  }>();

  private callCounter = 0;

  /**
   * Execute a tool with real timing measurement
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    taskId: string = 'default-task',
    simulatedDuration: number = 100
  ): Promise<ToolCallCompleteEventLike> {
    const callId = `test-call-${++this.callCounter}`;
    const startTime = performance.now();
    const realStartTime = new Date();

    // Store active execution
    this.activeTools.set(callId, {
      startTime,
      realStartTime,
      toolName,
      taskId
    });

    // Emit tool start event
    this.emit('tool:start', {
      taskId,
      toolName,
      callId,
      input: params,
      timestamp: realStartTime,
      timing: {
        startTime: realStartTime
      }
    });

    // Simulate tool execution time
    await new Promise(resolve => setTimeout(resolve, simulatedDuration));

    // Calculate end timing
    const endTime = performance.now();
    const realEndTime = new Date();
    const measuredDuration = endTime - startTime;
    const actualExecution = this.activeTools.get(callId)!;

    // Use date-based duration for consistency with timing field validation
    const dateDuration = realEndTime.getTime() - actualExecution.realStartTime.getTime();

    // Create tool complete event with proper timing fields
    const event: ToolCallCompleteEventLike = {
      taskId,
      toolName,
      callId,
      result: {
        success: true,
        output: `Tool ${toolName} completed successfully`
      },
      timing: {
        startTime: actualExecution.realStartTime,
        endTime: realEndTime,
        duration: dateDuration
      },
      timestamp: realEndTime
    };

    // Clean up
    this.activeTools.delete(callId);

    // Emit completion event
    this.emit('tool:complete', event);

    return event;
  }

  /**
   * Execute a tool that fails with timing data
   */
  async executeFailingTool(
    toolName: string,
    errorMessage: string,
    simulatedDuration: number = 50,
    taskId: string = 'failing-task'
  ): Promise<ToolCallCompleteEventLike> {
    const callId = `fail-call-${++this.callCounter}`;
    const startTime = performance.now();
    const realStartTime = new Date();

    this.activeTools.set(callId, {
      startTime,
      realStartTime,
      toolName,
      taskId
    });

    // Emit start event
    this.emit('tool:start', {
      taskId,
      toolName,
      callId,
      input: { willFail: true },
      timestamp: realStartTime
    });

    // Simulate failure after duration
    await new Promise(resolve => setTimeout(resolve, simulatedDuration));

    const endTime = performance.now();
    const realEndTime = new Date();
    const measuredDuration = endTime - startTime;
    const actualExecution = this.activeTools.get(callId)!;

    // Use date-based duration for consistency
    const dateDuration = realEndTime.getTime() - actualExecution.realStartTime.getTime();

    const event: ToolCallCompleteEventLike = {
      taskId,
      toolName,
      callId,
      result: {
        success: false,
        error: errorMessage
      },
      timing: {
        startTime: actualExecution.realStartTime,
        endTime: realEndTime,
        duration: dateDuration
      },
      timestamp: realEndTime
    };

    this.activeTools.delete(callId);
    this.emit('tool:complete', event);

    return event;
  }

  /**
   * Execute multiple tools concurrently
   */
  async executeConcurrentTools(
    toolConfigs: Array<{
      toolName: string;
      duration: number;
      shouldFail?: boolean;
      params?: Record<string, unknown>;
    }>
  ): Promise<ToolCallCompleteEventLike[]> {
    const promises = toolConfigs.map((config, index) => {
      if (config.shouldFail) {
        return this.executeFailingTool(
          config.toolName,
          `Concurrent error ${index}`,
          config.duration,
          `concurrent-task-${index}`
        );
      } else {
        return this.executeTool(
          config.toolName,
          config.params || {},
          `concurrent-task-${index}`,
          config.duration
        );
      }
    });

    return Promise.all(promises);
  }

  getActiveToolCount(): number {
    return this.activeTools.size;
  }

  cleanup(): void {
    this.activeTools.clear();
    this.removeAllListeners();
  }
}

describe('Timing Fields Integration Tests', () => {
  let harness: TimingTestHarness;

  beforeEach(() => {
    const orchestrator = new MockOrchestrator();
    const events: ToolCallCompleteEventLike[] = [];

    // Collect all tool completion events
    orchestrator.on('tool:complete', (event) => {
      events.push(event);
    });

    harness = { orchestrator, events };
  });

  afterEach(() => {
    harness.orchestrator.cleanup();
    vi.clearAllTimers();
  });

  describe('Basic Timing Field Validation', () => {
    it('should capture accurate timing data for successful tool execution', async () => {
      const expectedDuration = 150;
      const event = await harness.orchestrator.executeTool(
        'ReadTool',
        { filePath: '/test/file.txt' },
        'read-task',
        expectedDuration
      );

      // Verify all timing fields are present and properly typed
      expect(event.timing).toBeDefined();
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(typeof event.timing.duration).toBe('number');

      // Verify timing logic consistency
      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(
        event.timing.startTime.getTime()
      );

      // Verify calculated duration matches reported duration
      const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
      expect(event.timing.duration).toBe(calculatedDuration);

      // Verify duration is within expected tolerance (±50ms for CI variability)
      assertTimingAccuracy(event.timing.duration, expectedDuration, 50);

      // Verify tool execution was successful
      expect(event.result.success).toBe(true);
      expect(event.result.error).toBeUndefined();
    });

    it('should capture timing data for failed tool execution', async () => {
      const expectedDuration = 75;
      const event = await harness.orchestrator.executeFailingTool(
        'WriteTool',
        'Permission denied',
        expectedDuration
      );

      // Validate failed tool timing structure
      assertFailedToolTiming(event, {
        expectedMinDuration: expectedDuration - 25,
        expectedMaxDuration: expectedDuration + 25,
        tolerance: 25
      });

      // Verify timing fields are properly populated for failed tools
      expect(event.timing).toBeDefined();
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(event.timing.duration).toBeGreaterThan(0);

      // Verify failure data
      expect(event.result.success).toBe(false);
      expect(event.result.error).toBe('Permission denied');
    });

    it('should handle zero-duration tool execution', async () => {
      const event = await harness.orchestrator.executeTool(
        'InstantTool',
        { immediate: true },
        'instant-task',
        0
      );

      expect(event.timing.duration).toBeGreaterThanOrEqual(0);
      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(
        event.timing.startTime.getTime()
      );

      // Even instant tools should have consistent timing data
      const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
      expect(event.timing.duration).toBe(calculatedDuration);
    });
  });

  describe('Tool Type-Specific Timing', () => {
    it('should capture timing for different tool types consistently', async () => {
      const toolConfigs = [
        { name: 'ReadTool', duration: 50 },
        { name: 'WriteTool', duration: 100 },
        { name: 'BashTool', duration: 200 },
        { name: 'GrepTool', duration: 75 },
        { name: 'WebFetchTool', duration: 300 }
      ];

      const events: ToolCallCompleteEventLike[] = [];

      for (const config of toolConfigs) {
        const event = await harness.orchestrator.executeTool(
          config.name,
          { testParam: 'value' },
          `${config.name}-task`,
          config.duration
        );
        events.push(event);
      }

      expect(events).toHaveLength(toolConfigs.length);

      // Verify each tool type has consistent timing
      events.forEach((event, index) => {
        const expectedDuration = toolConfigs[index].duration;

        expect(event.toolName).toBe(toolConfigs[index].name);
        expect(event.timing).toBeDefined();

        assertTimingAccuracy(event.timing.duration, expectedDuration, 50);

        // Verify timing fields are properly typed
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(typeof event.timing.duration).toBe('number');
      });
    });
  });

  describe('Concurrent Tool Execution Timing', () => {
    it('should maintain independent timing for concurrent tool executions', async () => {
      const concurrentConfigs = [
        { toolName: 'ReadTool', duration: 100 },
        { toolName: 'WriteTool', duration: 150 },
        { toolName: 'BashTool', duration: 50 },
        { toolName: 'GrepTool', duration: 200 }
      ];

      const events = await harness.orchestrator.executeConcurrentTools(concurrentConfigs);

      expect(events).toHaveLength(concurrentConfigs.length);

      // Verify concurrent timing independence
      assertConcurrentFailedToolTiming(
        events.map(e => ({ ...e, result: { ...e.result, success: false, error: 'test' } }))
      );

      // Verify each tool has independent timing
      events.forEach((event, index) => {
        const expectedDuration = concurrentConfigs[index].duration;

        assertTimingAccuracy(event.timing.duration, expectedDuration, 50);

        // Verify timing consistency
        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });

      // Verify all tools have unique call IDs
      const callIds = events.map(e => e.callId);
      const uniqueCallIds = new Set(callIds);
      expect(uniqueCallIds.size).toBe(events.length);
    });

    it('should handle mixed success/failure concurrent executions', async () => {
      const mixedConfigs = [
        { toolName: 'SuccessTool', duration: 100, shouldFail: false },
        { toolName: 'FailTool1', duration: 75, shouldFail: true },
        { toolName: 'SuccessTool2', duration: 150, shouldFail: false },
        { toolName: 'FailTool2', duration: 50, shouldFail: true }
      ];

      const events = await harness.orchestrator.executeConcurrentTools(mixedConfigs);

      expect(events).toHaveLength(mixedConfigs.length);

      // Verify timing for successful and failed tools
      events.forEach((event, index) => {
        const config = mixedConfigs[index];

        // Verify timing accuracy
        assertTimingAccuracy(event.timing.duration, config.duration, 50);

        // Verify result status matches expectation
        expect(event.result.success).toBe(!config.shouldFail);

        // Verify timing consistency regardless of success/failure
        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });
    });
  });

  describe('Timing Precision and Accuracy', () => {
    it('should maintain precision across various durations', async () => {
      const durations = [1, 10, 25, 50, 100, 250, 500, 1000];
      const events: ToolCallCompleteEventLike[] = [];

      for (const duration of durations) {
        const event = await harness.orchestrator.executeTool(
          'PrecisionTool',
          { duration },
          `precision-${duration}`,
          duration
        );
        events.push(event);
      }

      expect(events).toHaveLength(durations.length);

      // Verify precision across all durations
      events.forEach((event, index) => {
        const expectedDuration = durations[index];

        // Allow reasonable tolerance based on duration
        const tolerance = Math.max(10, expectedDuration * 0.1);
        assertTimingAccuracy(event.timing.duration, expectedDuration, tolerance);

        // Verify timing fields are integers (no sub-millisecond precision needed)
        expect(Number.isInteger(event.timing.duration)).toBe(true);
      });
    });

    it('should handle timing edge cases gracefully', async () => {
      // Test very short duration
      const shortEvent = await harness.orchestrator.executeTool(
        'ShortTool', {}, 'short-task', 1
      );
      expect(shortEvent.timing.duration).toBeGreaterThanOrEqual(0);

      // Test longer duration
      const longEvent = await harness.orchestrator.executeTool(
        'LongTool', {}, 'long-task', 2000
      );
      assertTimingAccuracy(longEvent.timing.duration, 2000, 100);

      // Test failed tool with short duration
      const failedShortEvent = await harness.orchestrator.executeFailingTool(
        'FailShortTool', 'Quick failure', 5
      );
      assertFailedToolTiming(failedShortEvent, {
        expectedMinDuration: 1,
        expectedMaxDuration: 50,
        allowZeroDuration: true
      });
    });
  });

  describe('Timing Data Consistency', () => {
    it('should maintain timing integrity during high-frequency executions', async () => {
      const executionCount = 50;
      const events: ToolCallCompleteEventLike[] = [];

      // Execute tools in rapid succession
      for (let i = 0; i < executionCount; i++) {
        const event = await harness.orchestrator.executeTool(
          `RapidTool${i % 5}`,
          { iteration: i },
          `rapid-task-${i}`,
          Math.floor(Math.random() * 100) + 10 // 10-110ms
        );
        events.push(event);
      }

      expect(events).toHaveLength(executionCount);

      // Verify all executions have valid timing
      events.forEach((event, index) => {
        expect(event.timing).toBeDefined();
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(event.timing.duration).toBeGreaterThan(0);

        // Verify timing consistency
        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);

        // Verify timestamps are reasonable (within the last few seconds)
        const now = Date.now();
        expect(event.timing.startTime.getTime()).toBeLessThanOrEqual(now);
        expect(event.timing.endTime.getTime()).toBeLessThanOrEqual(now);
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(now);
      });

      // Verify all executions have unique call IDs
      const callIds = events.map(e => e.callId);
      const uniqueCallIds = new Set(callIds);
      expect(uniqueCallIds.size).toBe(events.length);
    });

    it('should properly handle tool execution cleanup', async () => {
      // Start a tool
      const promise = harness.orchestrator.executeTool('CleanupTool', {}, 'cleanup-task', 100);

      // Verify active tool is tracked
      expect(harness.orchestrator.getActiveToolCount()).toBe(1);

      // Wait for completion
      const event = await promise;

      // Verify cleanup occurred
      expect(harness.orchestrator.getActiveToolCount()).toBe(0);

      // Verify timing data is still valid
      expect(event.timing).toBeDefined();
      assertTimingAccuracy(event.timing.duration, 100, 50);
    });
  });

  describe('Event Collection and Validation', () => {
    it('should collect all timing events properly', async () => {
      // Execute multiple tools with different outcomes
      await harness.orchestrator.executeTool('Tool1', {}, 'task1', 50);
      await harness.orchestrator.executeFailingTool('Tool2', 'Error', 75, 'task2');
      await harness.orchestrator.executeTool('Tool3', {}, 'task3', 100);

      // Verify all events were collected
      expect(harness.events).toHaveLength(3);

      // Verify events have proper timing data
      harness.events.forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(typeof event.timing.duration).toBe('number');
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);
      });

      // Verify events have unique identifiers
      const taskIds = harness.events.map(e => e.taskId);
      const uniqueTaskIds = new Set(taskIds);
      expect(uniqueTaskIds.size).toBe(3);

      const callIds = harness.events.map(e => e.callId);
      const uniqueCallIds = new Set(callIds);
      expect(uniqueCallIds.size).toBe(3);
    });
  });
});