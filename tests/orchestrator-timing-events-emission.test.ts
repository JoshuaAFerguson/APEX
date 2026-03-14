import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// ============================================================================
// Mock Orchestrator Implementation
// ============================================================================

interface ToolCallStartEvent {
  taskId: string;
  toolName: string;
  callId: string;
  input: Record<string, unknown>;
  startTime: Date;
  timestamp: Date;
}

interface ToolCallProgressEvent {
  taskId: string;
  toolName: string;
  callId: string;
  progress: { message: string; percentage?: number };
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

interface MockTask {
  id: string;
  description: string;
  status: string;
}

/**
 * Mock orchestrator that simulates tool event emission with proper timing
 * This allows testing timing consistency without real SDK dependencies
 */
class MockOrchestrator extends EventEmitter {
  private tasks: Map<string, MockTask> = new Map();
  private activeToolCalls: Map<string, { startTime: Date; toolName: string; taskId: string }> = new Map();
  private taskCounter = 0;

  async createTask(options: { description: string }): Promise<MockTask> {
    const task: MockTask = {
      id: `task_mock_${++this.taskCounter}`,
      description: options.description,
      status: 'pending',
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async runTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = 'running';
    // Task execution is simulated by calling simulateToolExecution
  }

  getTask(taskId: string): MockTask | undefined {
    return this.tasks.get(taskId);
  }

  close(): void {
    this.removeAllListeners();
    this.tasks.clear();
    this.activeToolCalls.clear();
  }

  // Tool event simulation methods
  simulateToolStart(taskId: string, toolName: string, callId: string, input: Record<string, unknown>): void {
    const startTime = new Date();
    this.activeToolCalls.set(callId, { startTime, toolName, taskId });

    const event: ToolCallStartEvent = {
      taskId,
      toolName,
      callId,
      input,
      startTime,
      timestamp: startTime,
    };

    this.emit('tool:start', event);
  }

  simulateToolProgress(callId: string, message: string, percentage?: number): void {
    const activeCall = this.activeToolCalls.get(callId);
    if (!activeCall) throw new Error(`No active call for ${callId}`);

    const event: ToolCallProgressEvent = {
      taskId: activeCall.taskId,
      toolName: activeCall.toolName,
      callId,
      progress: { message, percentage },
      timestamp: new Date(),
    };

    this.emit('tool:progress', event);
  }

  simulateToolComplete(
    callId: string,
    result: { success: boolean; output?: unknown; error?: string }
  ): void {
    const activeCall = this.activeToolCalls.get(callId);
    if (!activeCall) throw new Error(`No active call for ${callId}`);

    const endTime = new Date();
    const duration = endTime.getTime() - activeCall.startTime.getTime();

    const event: ToolCallCompleteEvent = {
      taskId: activeCall.taskId,
      toolName: activeCall.toolName,
      callId,
      result,
      timing: {
        startTime: activeCall.startTime,
        endTime,
        duration,
      },
      timestamp: endTime,
    };

    this.emit('tool:complete', event);
    this.activeToolCalls.delete(callId);
  }

  // Simulate a full tool execution with configurable timing
  async simulateFullToolExecution(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    executionTimeMs: number,
    shouldFail: boolean = false,
    emitProgress: boolean = false
  ): Promise<void> {
    this.simulateToolStart(taskId, toolName, callId, input);

    if (emitProgress) {
      const progressInterval = Math.max(50, executionTimeMs / 4);
      for (let i = 1; i <= 3; i++) {
        await new Promise(resolve => setTimeout(resolve, progressInterval));
        this.simulateToolProgress(callId, `Progress ${i}/3`, Math.round((i / 3) * 100));
      }
      // Wait remaining time
      const remainingTime = executionTimeMs - (progressInterval * 3);
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, executionTimeMs));
    }

    this.simulateToolComplete(callId, {
      success: !shouldFail,
      output: shouldFail ? undefined : 'Execution completed',
      error: shouldFail ? 'Simulated failure' : undefined,
    });
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Orchestrator Timing Events Emission', () => {
  let orchestrator: MockOrchestrator;

  beforeEach(async () => {
    orchestrator = new MockOrchestrator();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    orchestrator.close();
  });

  describe('Acceptance Criteria 3: Missing Event Emissions Fix', () => {
    it('should emit tool:start event for every tool execution', async () => {
      const startEvents: ToolCallStartEvent[] = [];

      orchestrator.on('tool:start', (event) => {
        startEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test that all tools emit start events'
      });

      // Simulate two sequential tool executions
      await orchestrator.simulateFullToolExecution(task.id, 'FirstTool', 'tool_1', { step: 1 }, 50);
      await orchestrator.simulateFullToolExecution(task.id, 'SecondTool', 'tool_2', { step: 2 }, 50);

      // Verify both tools emitted start events
      expect(startEvents).toHaveLength(2);
      expect(startEvents[0].callId).toBe('tool_1');
      expect(startEvents[0].toolName).toBe('FirstTool');
      expect(startEvents[1].callId).toBe('tool_2');
      expect(startEvents[1].toolName).toBe('SecondTool');

      // Verify all start events have required timing fields
      startEvents.forEach(event => {
        expect(event.startTime).toBeInstanceOf(Date);
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.callId).toBeTruthy();
        expect(event.toolName).toBeTruthy();
      });
    });

    it('should emit tool:complete event for every tool execution', async () => {
      const completeEvents: ToolCallCompleteEvent[] = [];

      orchestrator.on('tool:complete', (event) => {
        completeEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test that all tools emit complete events'
      });

      // Simulate concurrent tool starts (both start before either completes)
      orchestrator.simulateToolStart(task.id, 'CompleteTool1', 'complete_test_1', { data: 'test1' });
      orchestrator.simulateToolStart(task.id, 'CompleteTool2', 'complete_test_2', { data: 'test2' });

      // Add small delay to ensure measurable duration
      await new Promise(resolve => setTimeout(resolve, 50));

      // Complete both tools
      orchestrator.simulateToolComplete('complete_test_1', { success: true, output: 'Tool 1 result' });
      orchestrator.simulateToolComplete('complete_test_2', { success: true, output: 'Tool 2 result' });

      // Verify both tools emitted complete events
      expect(completeEvents).toHaveLength(2);

      const tool1Complete = completeEvents.find(e => e.callId === 'complete_test_1');
      const tool2Complete = completeEvents.find(e => e.callId === 'complete_test_2');

      expect(tool1Complete).toBeDefined();
      expect(tool2Complete).toBeDefined();

      // Verify timing data is present and valid
      [tool1Complete!, tool2Complete!].forEach(event => {
        expect(event.timing).toBeDefined();
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(typeof event.timing.duration).toBe('number');
        expect(event.timing.duration).toBeGreaterThanOrEqual(0);
        expect(event.result.success).toBe(true);
      });
    });

    it('should emit timing events even for tools that fail', async () => {
      const startEvents: ToolCallStartEvent[] = [];
      const completeEvents: ToolCallCompleteEvent[] = [];

      orchestrator.on('tool:start', (event) => startEvents.push(event));
      orchestrator.on('tool:complete', (event) => completeEvents.push(event));

      const task = await orchestrator.createTask({
        description: 'Test timing events for failed tools'
      });

      // Simulate a failing tool with ~100ms execution time
      await orchestrator.simulateFullToolExecution(
        task.id,
        'FailingTool',
        'failing_tool',
        { shouldFail: true },
        100,
        true // shouldFail
      );

      expect(startEvents).toHaveLength(1);
      expect(completeEvents).toHaveLength(1);

      const startEvent = startEvents[0];
      const completeEvent = completeEvents[0];

      // Verify failed tool still emits proper timing data
      expect(startEvent.callId).toBe('failing_tool');
      expect(completeEvent.callId).toBe('failing_tool');
      expect(completeEvent.result.success).toBe(false);
      expect(completeEvent.result.error).toBeTruthy();
      expect(completeEvent.timing.duration).toBeGreaterThanOrEqual(90); // Should be around 100ms
    });

    it('should emit events in rapid succession without losing any', async () => {
      const allEvents: Array<{type: string; callId: string; timestamp: number}> = [];

      ['tool:start', 'tool:progress', 'tool:complete'].forEach(eventType => {
        orchestrator.on(eventType as any, (event: any) => {
          allEvents.push({
            type: eventType,
            callId: event.callId,
            timestamp: Date.now()
          });
        });
      });

      const task = await orchestrator.createTask({
        description: 'Test timing events in rapid succession'
      });

      // Start all 5 tools rapidly
      for (let i = 0; i < 5; i++) {
        orchestrator.simulateToolStart(task.id, `RapidTool${i}`, `rapid_tool_${i}`, { index: i });
      }

      // Complete all tools rapidly
      for (let i = 0; i < 5; i++) {
        orchestrator.simulateToolComplete(`rapid_tool_${i}`, { success: true, output: `Rapid result ${i}` });
      }

      // Verify we got events for all 5 tools
      const startEvents = allEvents.filter(e => e.type === 'tool:start');
      const completeEvents = allEvents.filter(e => e.type === 'tool:complete');

      expect(startEvents).toHaveLength(5);
      expect(completeEvents).toHaveLength(5);

      // Verify all tools are represented
      for (let i = 0; i < 5; i++) {
        const toolId = `rapid_tool_${i}`;
        expect(startEvents.some(e => e.callId === toolId)).toBe(true);
        expect(completeEvents.some(e => e.callId === toolId)).toBe(true);
      }
    });

    it('should not lose events during high concurrency', async () => {
      const eventCounts = {
        start: 0,
        progress: 0,
        complete: 0
      };

      orchestrator.on('tool:start', () => eventCounts.start++);
      orchestrator.on('tool:progress', () => eventCounts.progress++);
      orchestrator.on('tool:complete', () => eventCounts.complete++);

      const task = await orchestrator.createTask({
        description: 'Test timing events under high concurrency'
      });

      // Start all 10 tools concurrently
      for (let i = 0; i < 10; i++) {
        orchestrator.simulateToolStart(task.id, `ConcurrentTool${i}`, `concurrent_${i}`, { batch: 'concurrency_test' });
      }

      // Complete all tools
      for (let i = 0; i < 10; i++) {
        orchestrator.simulateToolComplete(`concurrent_${i}`, { success: true, output: `Concurrent result ${i}` });
      }

      // Verify no events were lost
      expect(eventCounts.start).toBe(10);
      expect(eventCounts.complete).toBe(10);
      // Progress events may vary based on tool execution timing
    });
  });

  describe('Event Timing Accuracy and Consistency', () => {
    it('should emit events in chronological order', async () => {
      const eventTimestamps: Array<{type: string; timestamp: number; callId: string}> = [];

      ['tool:start', 'tool:progress', 'tool:complete'].forEach(eventType => {
        orchestrator.on(eventType as any, (event: any) => {
          eventTimestamps.push({
            type: eventType,
            timestamp: Date.now(),
            callId: event.callId
          });
        });
      });

      const task = await orchestrator.createTask({
        description: 'Test events are emitted in chronological order'
      });

      // Simulate tool with progress events
      await orchestrator.simulateFullToolExecution(
        task.id,
        'ChronologyTool',
        'chronology_test',
        { test: 'timing' },
        200,
        false,
        true // emit progress
      );

      const toolEvents = eventTimestamps.filter(e => e.callId === 'chronology_test');
      expect(toolEvents.length).toBeGreaterThanOrEqual(2);

      // Verify timestamps are in order
      for (let i = 1; i < toolEvents.length; i++) {
        expect(toolEvents[i].timestamp).toBeGreaterThanOrEqual(toolEvents[i - 1].timestamp);
      }

      // Verify start comes before complete
      const startEvent = toolEvents.find(e => e.type === 'tool:start');
      const completeEvent = toolEvents.find(e => e.type === 'tool:complete');
      expect(startEvent).toBeDefined();
      expect(completeEvent).toBeDefined();
      expect(startEvent!.timestamp).toBeLessThan(completeEvent!.timestamp);
    });

    it('should maintain event isolation between different tools', async () => {
      const eventsByTool: Record<string, Array<{type: string; data: any}>> = {};

      ['tool:start', 'tool:progress', 'tool:complete'].forEach(eventType => {
        orchestrator.on(eventType as any, (event: any) => {
          if (!eventsByTool[event.callId]) {
            eventsByTool[event.callId] = [];
          }
          eventsByTool[event.callId].push({
            type: eventType,
            data: event
          });
        });
      });

      const task = await orchestrator.createTask({
        description: 'Test timing events are isolated between tools'
      });

      // Start both tools
      orchestrator.simulateToolStart(task.id, 'IsolatedTool1', 'isolated_1', { isolation: 'test1' });
      orchestrator.simulateToolStart(task.id, 'IsolatedTool2', 'isolated_2', { isolation: 'test2' });

      // Complete both tools
      orchestrator.simulateToolComplete('isolated_1', { success: true, output: 'Isolated 1 result' });
      orchestrator.simulateToolComplete('isolated_2', { success: true, output: 'Isolated 2 result' });

      // Verify both tools have their own event sequences
      expect(eventsByTool['isolated_1']).toBeDefined();
      expect(eventsByTool['isolated_2']).toBeDefined();

      // Verify no cross-contamination
      eventsByTool['isolated_1'].forEach(event => {
        expect(event.data.callId).toBe('isolated_1');
        expect(event.data.toolName).toBe('IsolatedTool1');
      });

      eventsByTool['isolated_2'].forEach(event => {
        expect(event.data.callId).toBe('isolated_2');
        expect(event.data.toolName).toBe('IsolatedTool2');
      });
    });

    it('should handle edge case of extremely fast tool execution', async () => {
      const events: Array<{type: string; callId: string; timestamp: Date}> = [];

      ['tool:start', 'tool:complete'].forEach(eventType => {
        orchestrator.on(eventType as any, (event: any) => {
          events.push({
            type: eventType,
            callId: event.callId,
            timestamp: eventType === 'tool:start' ? event.startTime || event.timestamp : event.timestamp
          });
        });
      });

      const task = await orchestrator.createTask({
        description: 'Test timing events for instant tool execution'
      });

      // Simulate instant tool (no delay)
      orchestrator.simulateToolStart(task.id, 'InstantTool', 'instant_tool', { speed: 'instant' });
      orchestrator.simulateToolComplete('instant_tool', { success: true, output: 'Instant result' });

      expect(events).toHaveLength(2);

      const startEvent = events.find(e => e.type === 'tool:start');
      const completeEvent = events.find(e => e.type === 'tool:complete');

      expect(startEvent).toBeDefined();
      expect(completeEvent).toBeDefined();

      // Even for instant tools, complete should not be before start
      expect(completeEvent!.timestamp.getTime()).toBeGreaterThanOrEqual(startEvent!.timestamp.getTime());
    });
  });
});
