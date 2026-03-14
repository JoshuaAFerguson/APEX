import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// ============================================================================
// Mock Orchestrator Implementation for Timing Tests
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
 * Mock orchestrator for comprehensive timing tests
 */
class MockOrchestrator extends EventEmitter {
  private tasks: Map<string, MockTask> = new Map();
  private activeToolCalls: Map<string, { startTime: Date; toolName: string; taskId: string }> = new Map();
  private taskCounter = 0;

  async createTask(options: { description: string }): Promise<MockTask> {
    const task: MockTask = {
      id: `task_timing_${++this.taskCounter}`,
      description: options.description,
      status: 'pending',
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = 'running';
  }

  close(): void {
    this.removeAllListeners();
    this.tasks.clear();
    this.activeToolCalls.clear();
  }

  removeAllListeners(event?: string | symbol): this {
    return super.removeAllListeners(event);
  }

  // Tool event simulation
  simulateToolStart(taskId: string, toolName: string, callId: string, input: Record<string, unknown>): Date {
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
    return startTime;
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

  // Simulate full tool execution with configurable timing
  async simulateToolExecution(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    executionTimeMs: number,
    options: { shouldFail?: boolean; emitProgress?: boolean } = {}
  ): Promise<void> {
    const { shouldFail = false, emitProgress = false } = options;

    this.simulateToolStart(taskId, toolName, callId, input);

    if (emitProgress && executionTimeMs > 100) {
      const progressInterval = Math.max(30, executionTimeMs / 4);
      for (let i = 1; i <= 3; i++) {
        await new Promise(resolve => setTimeout(resolve, progressInterval));
        this.simulateToolProgress(callId, `Processing ${i}/3`, Math.round((i / 3) * 100));
      }
      const remainingTime = executionTimeMs - (progressInterval * 3);
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, executionTimeMs));
    }

    this.simulateToolComplete(callId, {
      success: !shouldFail,
      output: shouldFail ? undefined : { result: 'completed' },
      error: shouldFail ? 'Tool execution failed' : undefined,
    });
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Tool Timing Events - Comprehensive Testing', () => {
  let orchestrator: MockOrchestrator;

  beforeEach(async () => {
    orchestrator = new MockOrchestrator();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    orchestrator.close();
  });

  describe('Acceptance Criteria 1: Proper Timing Data', () => {
    it('should include startTime, endTime, and duration in tool:complete event', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;
      const startEventTime = Date.now();

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test timing data with proper timing fields'
      });

      // Simulate tool execution with 100ms
      await orchestrator.simulateToolExecution(
        task.id,
        'TimingTestTool',
        'timing_test_call',
        { test: 'timing' },
        100
      );

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.timing).toBeDefined();

      // Verify timing structure
      expect(completeEvent!.timing.startTime).toBeInstanceOf(Date);
      expect(completeEvent!.timing.endTime).toBeInstanceOf(Date);
      expect(typeof completeEvent!.timing.duration).toBe('number');

      // Verify timing logic
      expect(completeEvent!.timing.endTime.getTime()).toBeGreaterThan(completeEvent!.timing.startTime.getTime());
      expect(completeEvent!.timing.duration).toBe(
        completeEvent!.timing.endTime.getTime() - completeEvent!.timing.startTime.getTime()
      );

      // Verify timing is reasonable (should be at least 100ms)
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(90); // Allow 10ms tolerance
      expect(completeEvent!.timing.startTime.getTime()).toBeGreaterThanOrEqual(startEventTime - 50); // Allow 50ms tolerance
    });

    it('should include startTime field in tool:start event', async () => {
      let startEvent: ToolCallStartEvent | null = null;

      orchestrator.on('tool:start', (event) => {
        startEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test startTime in tool:start event'
      });

      await orchestrator.simulateToolExecution(
        task.id,
        'StartTimingTool',
        'start_timing_test',
        { test: 'start' },
        50
      );

      expect(startEvent).toBeTruthy();
      expect(startEvent!.startTime).toBeInstanceOf(Date);
      expect(startEvent!.timestamp).toBeInstanceOf(Date);

      // startTime should match timestamp in tool:start event
      expect(startEvent!.startTime.getTime()).toBe(startEvent!.timestamp.getTime());
    });

    it('should maintain timing consistency across start and complete events', async () => {
      let startEvent: ToolCallStartEvent | null = null;
      let completeEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:start', (event) => {
        startEvent = event;
      });

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test timing consistency between events'
      });

      await orchestrator.simulateToolExecution(
        task.id,
        'ConsistencyTool',
        'consistency_test',
        { test: 'consistency' },
        150
      );

      expect(startEvent).toBeTruthy();
      expect(completeEvent).toBeTruthy();

      // Verify consistency between start and complete events
      expect(startEvent!.callId).toBe(completeEvent!.callId);
      expect(startEvent!.toolName).toBe(completeEvent!.toolName);
      expect(startEvent!.startTime.getTime()).toBe(completeEvent!.timing.startTime.getTime());
    });
  });

  describe('Acceptance Criteria 2: Event Emission Order', () => {
    it('should emit events in correct order: tool:start -> tool:complete', async () => {
      const eventSequence: string[] = [];

      orchestrator.on('tool:start', () => {
        eventSequence.push('tool:start');
      });

      orchestrator.on('tool:progress', () => {
        eventSequence.push('tool:progress');
      });

      orchestrator.on('tool:complete', () => {
        eventSequence.push('tool:complete');
      });

      const task = await orchestrator.createTask({
        description: 'Test correct event emission order'
      });

      await orchestrator.simulateToolExecution(
        task.id,
        'SequenceTool',
        'sequence_test',
        { test: 'sequence' },
        50
      );

      expect(eventSequence.length).toBeGreaterThanOrEqual(2);
      expect(eventSequence[0]).toBe('tool:start');
      expect(eventSequence[eventSequence.length - 1]).toBe('tool:complete');

      // Ensure tool:start always comes before tool:complete
      const startIndex = eventSequence.indexOf('tool:start');
      const completeIndex = eventSequence.lastIndexOf('tool:complete');
      expect(startIndex).toBeLessThan(completeIndex);
    });

    it('should handle multiple concurrent tools with correct event ordering', async () => {
      const events: Array<{ type: string; callId: string; timestamp: number }> = [];

      ['tool:start', 'tool:progress', 'tool:complete'].forEach(eventType => {
        orchestrator.on(eventType as any, (event: any) => {
          events.push({
            type: eventType,
            callId: event.callId,
            timestamp: Date.now()
          });
        });
      });

      const task = await orchestrator.createTask({
        description: 'Test event ordering with concurrent tools'
      });

      // Start both tools
      orchestrator.simulateToolStart(task.id, 'ConcurrentTool1', 'concurrent_1', {});
      orchestrator.simulateToolStart(task.id, 'ConcurrentTool2', 'concurrent_2', {});

      // Add delay
      await new Promise(resolve => setTimeout(resolve, 50));

      // Complete tools in different order (2 before 1)
      orchestrator.simulateToolComplete('concurrent_2', { success: true, output: 'Tool2 result' });
      orchestrator.simulateToolComplete('concurrent_1', { success: true, output: 'Tool1 result' });

      // Verify each tool has proper event sequence
      const tool1Events = events.filter(e => e.callId === 'concurrent_1');
      const tool2Events = events.filter(e => e.callId === 'concurrent_2');

      expect(tool1Events.length).toBeGreaterThanOrEqual(2);
      expect(tool2Events.length).toBeGreaterThanOrEqual(2);

      // Verify order within each tool
      expect(tool1Events[0].type).toBe('tool:start');
      expect(tool1Events[tool1Events.length - 1].type).toBe('tool:complete');
      expect(tool2Events[0].type).toBe('tool:start');
      expect(tool2Events[tool2Events.length - 1].type).toBe('tool:complete');
    });
  });

  describe('Acceptance Criteria 3: Event Data Integrity', () => {
    it('should maintain data integrity across all timing events', async () => {
      let startEvent: ToolCallStartEvent | null = null;
      let progressEvents: ToolCallProgressEvent[] = [];
      let completeEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:start', (event) => {
        startEvent = event;
      });

      orchestrator.on('tool:progress', (event) => {
        progressEvents.push(event);
      });

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const testCallId = 'integrity_test_call';
      const testToolName = 'IntegrityTestTool';

      const task = await orchestrator.createTask({
        description: 'Test event data integrity'
      });

      await orchestrator.simulateToolExecution(
        task.id,
        testToolName,
        testCallId,
        { integrity: 'test' },
        150,
        { emitProgress: true }
      );

      expect(startEvent).toBeTruthy();
      expect(completeEvent).toBeTruthy();

      // Verify consistent identifiers across all events
      expect(startEvent!.callId).toBe(testCallId);
      expect(startEvent!.toolName).toBe(testToolName);
      expect(completeEvent!.callId).toBe(testCallId);
      expect(completeEvent!.toolName).toBe(testToolName);

      // Verify progress events have consistent identifiers
      progressEvents.forEach(progressEvent => {
        expect(progressEvent.callId).toBe(testCallId);
        expect(progressEvent.toolName).toBe(testToolName);
      });

      // Verify timestamp consistency (each event should have valid timestamp)
      expect(startEvent!.timestamp).toBeInstanceOf(Date);
      expect(completeEvent!.timestamp).toBeInstanceOf(Date);
      expect(completeEvent!.timestamp.getTime()).toBeGreaterThanOrEqual(startEvent!.timestamp.getTime());
    });

    it('should handle tool execution errors with proper timing data', async () => {
      let errorEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:complete', (event) => {
        errorEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test timing data for failed tools'
      });

      await orchestrator.simulateToolExecution(
        task.id,
        'ErrorTool',
        'error_test_call',
        { triggerError: true },
        80,
        { shouldFail: true }
      );

      expect(errorEvent).toBeTruthy();
      expect(errorEvent!.result.success).toBe(false);
      expect(errorEvent!.result.error).toBeTruthy();

      // Timing data should still be present for failed tools
      expect(errorEvent!.timing).toBeDefined();
      expect(errorEvent!.timing.startTime).toBeInstanceOf(Date);
      expect(errorEvent!.timing.endTime).toBeInstanceOf(Date);
      expect(errorEvent!.timing.duration).toBeGreaterThanOrEqual(70); // Allow tolerance
    });
  });

  describe('Acceptance Criteria 4: Timing Accuracy', () => {
    it('should provide accurate duration measurements within tolerance', async () => {
      const testDurations = [50, 100, 200];
      const tolerance = 50; // 50ms tolerance

      for (const expectedDuration of testDurations) {
        let completeEvent: ToolCallCompleteEvent | null = null;

        orchestrator.on('tool:complete', (event) => {
          completeEvent = event;
        });

        const task = await orchestrator.createTask({
          description: `Test ${expectedDuration}ms duration timing accuracy`
        });

        await orchestrator.simulateToolExecution(
          task.id,
          'DurationTestTool',
          `duration_test_${expectedDuration}`,
          { duration: expectedDuration },
          expectedDuration
        );

        expect(completeEvent).toBeTruthy();
        expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(expectedDuration - tolerance);
        expect(completeEvent!.timing.duration).toBeLessThanOrEqual(expectedDuration + tolerance);

        // Reset for next iteration
        completeEvent = null;
        orchestrator.removeAllListeners();
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle extremely fast tool execution', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test very fast tool execution'
      });

      // Simulate instant tool (0ms execution)
      orchestrator.simulateToolStart(task.id, 'FastTool', 'fast_tool', {});
      orchestrator.simulateToolComplete('fast_tool', { success: true, output: 'Immediate success' });

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(0);
      expect(completeEvent!.timing.endTime.getTime()).toBeGreaterThanOrEqual(completeEvent!.timing.startTime.getTime());
    });

    it('should handle tool execution timeout scenarios', async () => {
      let completeEvent: ToolCallCompleteEvent | null = null;

      orchestrator.on('tool:complete', (event) => {
        completeEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test long-running tool timing'
      });

      // Simulate longer execution
      await orchestrator.simulateToolExecution(
        task.id,
        'TimeoutTool',
        'timeout_test',
        { timeout: 1000 },
        500
      );

      expect(completeEvent).toBeTruthy();
      expect(completeEvent!.timing.duration).toBeGreaterThanOrEqual(450); // Allow tolerance
    });
  });
});
