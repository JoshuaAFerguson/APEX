/**
 * Concurrent Tools Event Ordering Tests
 *
 * This test suite verifies that when multiple tools run concurrently,
 * the events (tool:start and tool:complete) are emitted in the correct
 * order and can be properly tracked.
 *
 * @see ADR-075-concurrent-tools-event-ordering-tests.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// ============================================================================
// Test Interfaces
// ============================================================================

interface ConcurrentEventRecord {
  type: 'tool:start' | 'tool:progress' | 'tool:complete';
  callId: string;
  toolName: string;
  taskId: string;
  timestamp: Date;
  globalSequence: number;
  timing?: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  result?: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
}

interface ConcurrentToolConfig {
  callId: string;
  toolName: string;
  executionTimeMs: number;
  shouldFail?: boolean;
  emitProgress?: boolean;
}

interface OrderingViolation {
  callId: string;
  expectedOrder: string[];
  actualOrder: string[];
  description: string;
}

interface ConcurrentExecutionResult {
  totalEvents: number;
  eventsByTool: Map<string, ConcurrentEventRecord[]>;
  violations: OrderingViolation[];
  valid: boolean;
}

// ============================================================================
// Mock Orchestrator
// ============================================================================

class ConcurrentToolTestOrchestrator extends EventEmitter {
  private activeTools = new Map<string, { startTime: Date; toolName: string; taskId: string }>();
  private globalSequence = 0;
  private capturedEvents: ConcurrentEventRecord[] = [];
  private isCapturing = false;

  startCapture(): void {
    this.isCapturing = true;
    this.capturedEvents = [];
    this.globalSequence = 0;
  }

  stopCapture(): ConcurrentEventRecord[] {
    this.isCapturing = false;
    return [...this.capturedEvents];
  }

  getCapturedEvents(): ConcurrentEventRecord[] {
    return [...this.capturedEvents];
  }

  clearCapture(): void {
    this.capturedEvents = [];
    this.globalSequence = 0;
  }

  simulateToolStart(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown> = {}
  ): Date {
    const startTime = new Date();

    this.activeTools.set(callId, { startTime, toolName, taskId });

    const event: ConcurrentEventRecord = {
      type: 'tool:start',
      callId,
      toolName,
      taskId,
      timestamp: startTime,
      globalSequence: this.globalSequence++,
    };

    if (this.isCapturing) {
      this.capturedEvents.push(event);
    }

    this.emit('tool:start', {
      taskId,
      toolName,
      callId,
      input,
      startTime,
      timestamp: startTime,
    });

    return startTime;
  }

  simulateToolProgress(
    callId: string,
    message: string,
    percentage?: number
  ): void {
    const activeCall = this.activeTools.get(callId);
    if (!activeCall) {
      throw new Error(`No active call for ${callId}`);
    }

    const event: ConcurrentEventRecord = {
      type: 'tool:progress',
      callId,
      toolName: activeCall.toolName,
      taskId: activeCall.taskId,
      timestamp: new Date(),
      globalSequence: this.globalSequence++,
    };

    if (this.isCapturing) {
      this.capturedEvents.push(event);
    }

    this.emit('tool:progress', {
      taskId: activeCall.taskId,
      toolName: activeCall.toolName,
      callId,
      progress: { message, percentage },
      timestamp: new Date(),
    });
  }

  simulateToolComplete(
    callId: string,
    result: { success: boolean; output?: unknown; error?: string }
  ): void {
    const activeCall = this.activeTools.get(callId);
    if (!activeCall) {
      throw new Error(`No active call for ${callId}`);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - activeCall.startTime.getTime();

    const event: ConcurrentEventRecord = {
      type: 'tool:complete',
      callId,
      toolName: activeCall.toolName,
      taskId: activeCall.taskId,
      timestamp: endTime,
      globalSequence: this.globalSequence++,
      timing: {
        startTime: activeCall.startTime,
        endTime,
        duration,
      },
      result,
    };

    if (this.isCapturing) {
      this.capturedEvents.push(event);
    }

    this.emit('tool:complete', {
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
    });

    this.activeTools.delete(callId);
  }

  async simulateToolExecution(
    taskId: string,
    config: ConcurrentToolConfig
  ): Promise<void> {
    const { callId, toolName, executionTimeMs, shouldFail = false, emitProgress = false } = config;

    this.simulateToolStart(taskId, toolName, callId, {});

    if (emitProgress && executionTimeMs > 50) {
      const progressInterval = Math.max(10, executionTimeMs / 4);
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

  async executeToolsConcurrently(
    taskId: string,
    tools: ConcurrentToolConfig[]
  ): Promise<ConcurrentExecutionResult> {
    this.startCapture();

    const executions = tools.map(tool =>
      this.simulateToolExecution(taskId, tool)
    );

    await Promise.all(executions);

    const events = this.stopCapture();
    return this.analyzeExecution(events);
  }

  private analyzeExecution(events: ConcurrentEventRecord[]): ConcurrentExecutionResult {
    const eventsByTool = this.groupEventsByTool(events);
    const violations = this.detectOrderingViolations(eventsByTool);

    return {
      totalEvents: events.length,
      eventsByTool,
      violations,
      valid: violations.length === 0
    };
  }

  private groupEventsByTool(events: ConcurrentEventRecord[]): Map<string, ConcurrentEventRecord[]> {
    const grouped = new Map<string, ConcurrentEventRecord[]>();

    for (const event of events) {
      const existing = grouped.get(event.callId) || [];
      existing.push(event);
      grouped.set(event.callId, existing);
    }

    return grouped;
  }

  private detectOrderingViolations(eventsByTool: Map<string, ConcurrentEventRecord[]>): OrderingViolation[] {
    const violations: OrderingViolation[] = [];

    for (const [callId, events] of eventsByTool) {
      const sortedEvents = events.sort((a, b) => a.globalSequence - b.globalSequence);
      const eventTypes = sortedEvents.map(e => e.type);

      // Check that tool:start comes first
      if (eventTypes[0] !== 'tool:start') {
        violations.push({
          callId,
          expectedOrder: ['tool:start', '...', 'tool:complete'],
          actualOrder: eventTypes,
          description: `tool:start should be first event, but got ${eventTypes[0]}`
        });
      }

      // Check that tool:complete comes last
      if (eventTypes[eventTypes.length - 1] !== 'tool:complete') {
        violations.push({
          callId,
          expectedOrder: ['tool:start', '...', 'tool:complete'],
          actualOrder: eventTypes,
          description: `tool:complete should be last event, but got ${eventTypes[eventTypes.length - 1]}`
        });
      }
    }

    return violations;
  }

  close(): void {
    this.removeAllListeners();
    this.activeTools.clear();
    this.capturedEvents = [];
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Concurrent Tools Event Ordering', () => {
  let orchestrator: ConcurrentToolTestOrchestrator;

  beforeEach(() => {
    orchestrator = new ConcurrentToolTestOrchestrator();
  });

  afterEach(() => {
    orchestrator.close();
  });

  describe('Basic Sequence Validation', () => {
    it('should emit start before complete for each concurrent tool', async () => {
      const taskId = 'test-task-1';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'tool-1', toolName: 'ReadFile', executionTimeMs: 50 },
        { callId: 'tool-2', toolName: 'WriteFile', executionTimeMs: 60 },
        { callId: 'tool-3', toolName: 'Search', executionTimeMs: 40 },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.eventsByTool.size).toBe(3);

      // Verify each tool has exactly start + complete
      for (const [callId, events] of result.eventsByTool) {
        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(events[0].type).toBe('tool:start');
        expect(events[events.length - 1].type).toBe('tool:complete');
      }
    });

    it('should maintain correct sequence with varying execution times', async () => {
      const taskId = 'test-task-2';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'slow', toolName: 'SlowTool', executionTimeMs: 100 },
        { callId: 'fast', toolName: 'FastTool', executionTimeMs: 20 },
        { callId: 'medium', toolName: 'MediumTool', executionTimeMs: 50 },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      expect(result.valid).toBe(true);

      // Fast tool should complete first, but each tool should have correct sequence
      for (const [, events] of result.eventsByTool) {
        const sortedEvents = events.sort((a, b) => a.globalSequence - b.globalSequence);
        expect(sortedEvents[0].type).toBe('tool:start');
        expect(sortedEvents[sortedEvents.length - 1].type).toBe('tool:complete');
      }
    });

    it('should correctly track global sequence across concurrent tools', async () => {
      const taskId = 'test-task-3';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'a', toolName: 'ToolA', executionTimeMs: 30 },
        { callId: 'b', toolName: 'ToolB', executionTimeMs: 30 },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      // Get all events sorted by global sequence
      const allEvents: ConcurrentEventRecord[] = [];
      for (const events of result.eventsByTool.values()) {
        allEvents.push(...events);
      }
      allEvents.sort((a, b) => a.globalSequence - b.globalSequence);

      // First two events should be starts
      const firstTwoTypes = allEvents.slice(0, 2).map(e => e.type);
      expect(firstTwoTypes).toEqual(['tool:start', 'tool:start']);

      // Last two events should be completes
      const lastTwoTypes = allEvents.slice(-2).map(e => e.type);
      expect(lastTwoTypes).toEqual(['tool:complete', 'tool:complete']);
    });
  });

  describe('Concurrent Isolation', () => {
    it('should track events independently for each concurrent tool', async () => {
      const taskId = 'isolation-test';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'iso-1', toolName: 'IsoTool1', executionTimeMs: 40 },
        { callId: 'iso-2', toolName: 'IsoTool2', executionTimeMs: 60 },
        { callId: 'iso-3', toolName: 'IsoTool3', executionTimeMs: 50 },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      // Each tool should have independent events
      for (const [callId, events] of result.eventsByTool) {
        // All events for this tool should have the same callId
        expect(events.every(e => e.callId === callId)).toBe(true);

        // All events for this tool should have the same toolName
        const toolName = events[0].toolName;
        expect(events.every(e => e.toolName === toolName)).toBe(true);

        // All events for this tool should have the same taskId
        expect(events.every(e => e.taskId === taskId)).toBe(true);
      }
    });

    it('should handle completion order different from start order', async () => {
      orchestrator.startCapture();

      // Manually control start/complete order
      orchestrator.simulateToolStart('task', 'Tool1', 'first', {});
      orchestrator.simulateToolStart('task', 'Tool2', 'second', {});
      orchestrator.simulateToolStart('task', 'Tool3', 'third', {});

      // Complete in reverse order
      await new Promise(r => setTimeout(r, 10));
      orchestrator.simulateToolComplete('third', { success: true });

      await new Promise(r => setTimeout(r, 10));
      orchestrator.simulateToolComplete('second', { success: true });

      await new Promise(r => setTimeout(r, 10));
      orchestrator.simulateToolComplete('first', { success: true });

      const events = orchestrator.stopCapture();

      // Verify each tool's sequence is correct
      const eventsByTool = new Map<string, ConcurrentEventRecord[]>();
      for (const event of events) {
        const existing = eventsByTool.get(event.callId) || [];
        existing.push(event);
        eventsByTool.set(event.callId, existing);
      }

      for (const [callId, toolEvents] of eventsByTool) {
        const sorted = toolEvents.sort((a, b) => a.globalSequence - b.globalSequence);
        expect(sorted[0].type).toBe('tool:start');
        expect(sorted[sorted.length - 1].type).toBe('tool:complete');
      }
    });

    it('should not cross-contaminate data between concurrent tools', async () => {
      const taskId = 'contamination-test';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'clean-1', toolName: 'CleanTool1', executionTimeMs: 30 },
        { callId: 'clean-2', toolName: 'CleanTool2', executionTimeMs: 30 },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      const tool1Events = result.eventsByTool.get('clean-1')!;
      const tool2Events = result.eventsByTool.get('clean-2')!;

      // Ensure no tool1 events have tool2's data
      for (const event of tool1Events) {
        expect(event.callId).toBe('clean-1');
        expect(event.toolName).toBe('CleanTool1');
      }

      // Ensure no tool2 events have tool1's data
      for (const event of tool2Events) {
        expect(event.callId).toBe('clean-2');
        expect(event.toolName).toBe('CleanTool2');
      }
    });
  });

  describe('Race Conditions', () => {
    it('should handle very rapid sequential completions', async () => {
      orchestrator.startCapture();

      // Start tools
      orchestrator.simulateToolStart('task', 'Rapid1', 'rapid-1', {});
      orchestrator.simulateToolStart('task', 'Rapid2', 'rapid-2', {});
      orchestrator.simulateToolStart('task', 'Rapid3', 'rapid-3', {});

      // Complete all almost simultaneously
      orchestrator.simulateToolComplete('rapid-1', { success: true });
      orchestrator.simulateToolComplete('rapid-2', { success: true });
      orchestrator.simulateToolComplete('rapid-3', { success: true });

      const events = orchestrator.stopCapture();

      // All events should be captured
      expect(events).toHaveLength(6);

      // Each tool should have proper sequence
      const grouped = new Map<string, ConcurrentEventRecord[]>();
      for (const event of events) {
        const existing = grouped.get(event.callId) || [];
        existing.push(event);
        grouped.set(event.callId, existing);
      }

      for (const [, toolEvents] of grouped) {
        expect(toolEvents).toHaveLength(2);
        const sorted = toolEvents.sort((a, b) => a.globalSequence - b.globalSequence);
        expect(sorted[0].type).toBe('tool:start');
        expect(sorted[1].type).toBe('tool:complete');
      }
    });

    it('should handle simultaneous start events', async () => {
      orchestrator.startCapture();

      // Start multiple tools at "same time"
      const startPromises = [
        Promise.resolve(orchestrator.simulateToolStart('task', 'Sim1', 'sim-1', {})),
        Promise.resolve(orchestrator.simulateToolStart('task', 'Sim2', 'sim-2', {})),
        Promise.resolve(orchestrator.simulateToolStart('task', 'Sim3', 'sim-3', {})),
      ];

      await Promise.all(startPromises);

      const events = orchestrator.getCapturedEvents();

      // All starts should be captured
      const startEvents = events.filter(e => e.type === 'tool:start');
      expect(startEvents).toHaveLength(3);

      // All should have unique callIds
      const callIds = new Set(startEvents.map(e => e.callId));
      expect(callIds.size).toBe(3);

      // Clean up
      orchestrator.simulateToolComplete('sim-1', { success: true });
      orchestrator.simulateToolComplete('sim-2', { success: true });
      orchestrator.simulateToolComplete('sim-3', { success: true });
    });

    it('should handle high concurrency (10+ tools)', async () => {
      const taskId = 'high-concurrency-test';
      const tools: ConcurrentToolConfig[] = [];

      for (let i = 0; i < 15; i++) {
        tools.push({
          callId: `hc-${i}`,
          toolName: `HighConcTool${i}`,
          executionTimeMs: Math.floor(Math.random() * 50) + 20, // 20-70ms
        });
      }

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.eventsByTool.size).toBe(15);
      expect(result.totalEvents).toBeGreaterThanOrEqual(30); // At least 2 events per tool
    });
  });

  describe('Error Scenarios', () => {
    it('should maintain event ordering when tools fail', async () => {
      const taskId = 'error-test';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'success-1', toolName: 'SuccessTool', executionTimeMs: 30, shouldFail: false },
        { callId: 'fail-1', toolName: 'FailTool', executionTimeMs: 40, shouldFail: true },
        { callId: 'success-2', toolName: 'SuccessTool2', executionTimeMs: 35, shouldFail: false },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      expect(result.valid).toBe(true);

      // Failed tool should still have proper sequence
      const failedToolEvents = result.eventsByTool.get('fail-1')!;
      expect(failedToolEvents[0].type).toBe('tool:start');
      expect(failedToolEvents[failedToolEvents.length - 1].type).toBe('tool:complete');

      // Failed tool's complete event should have error
      const completeEvent = failedToolEvents.find(e => e.type === 'tool:complete')!;
      expect(completeEvent.result?.success).toBe(false);
      expect(completeEvent.result?.error).toBeDefined();
    });

    it('should include timing data in error completion events', async () => {
      const taskId = 'error-timing-test';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'error-with-timing', toolName: 'ErrorTool', executionTimeMs: 50, shouldFail: true },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      const events = result.eventsByTool.get('error-with-timing')!;
      const completeEvent = events.find(e => e.type === 'tool:complete')!;

      expect(completeEvent.timing).toBeDefined();
      expect(completeEvent.timing!.startTime).toBeInstanceOf(Date);
      expect(completeEvent.timing!.endTime).toBeInstanceOf(Date);
      expect(completeEvent.timing!.duration).toBeGreaterThanOrEqual(40); // With tolerance
    });

    it('should handle mixed success and failure in concurrent tools', async () => {
      const taskId = 'mixed-results-test';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'mixed-s1', toolName: 'SuccessA', executionTimeMs: 30, shouldFail: false },
        { callId: 'mixed-f1', toolName: 'FailA', executionTimeMs: 40, shouldFail: true },
        { callId: 'mixed-s2', toolName: 'SuccessB', executionTimeMs: 35, shouldFail: false },
        { callId: 'mixed-f2', toolName: 'FailB', executionTimeMs: 45, shouldFail: true },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      expect(result.valid).toBe(true);

      let successCount = 0;
      let failCount = 0;

      for (const [, events] of result.eventsByTool) {
        const completeEvent = events.find(e => e.type === 'tool:complete')!;
        if (completeEvent.result?.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      expect(successCount).toBe(2);
      expect(failCount).toBe(2);
    });
  });

  describe('Progress Events', () => {
    it('should emit progress events between start and complete', async () => {
      const taskId = 'progress-test';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'progress-1', toolName: 'ProgressTool', executionTimeMs: 100, emitProgress: true },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      const events = result.eventsByTool.get('progress-1')!;

      expect(events[0].type).toBe('tool:start');
      expect(events[events.length - 1].type).toBe('tool:complete');

      // Should have progress events in between
      const progressEvents = events.filter(e => e.type === 'tool:progress');
      expect(progressEvents.length).toBeGreaterThan(0);

      // Progress events should have consistent callId
      for (const progressEvent of progressEvents) {
        expect(progressEvent.callId).toBe('progress-1');
        expect(progressEvent.toolName).toBe('ProgressTool');
      }
    });

    it('should maintain progress event ordering', async () => {
      const taskId = 'progress-order-test';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'po-1', toolName: 'ProgressOrderTool', executionTimeMs: 120, emitProgress: true },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      const events = result.eventsByTool.get('po-1')!;
      const sortedEvents = events.sort((a, b) => a.globalSequence - b.globalSequence);

      // Verify start is first
      expect(sortedEvents[0].type).toBe('tool:start');

      // Verify complete is last
      expect(sortedEvents[sortedEvents.length - 1].type).toBe('tool:complete');

      // Verify all progress events are between start and complete
      const startSeq = sortedEvents[0].globalSequence;
      const completeSeq = sortedEvents[sortedEvents.length - 1].globalSequence;

      for (const event of sortedEvents) {
        if (event.type === 'tool:progress') {
          expect(event.globalSequence).toBeGreaterThan(startSeq);
          expect(event.globalSequence).toBeLessThan(completeSeq);
        }
      }
    });
  });

  describe('Timing Data Integrity', () => {
    it('should provide accurate duration measurements', async () => {
      const taskId = 'timing-accuracy-test';
      const executionTime = 80;
      const tolerance = 40;

      const tools: ConcurrentToolConfig[] = [
        { callId: 'timing-test', toolName: 'TimingTool', executionTimeMs: executionTime },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      const events = result.eventsByTool.get('timing-test')!;
      const completeEvent = events.find(e => e.type === 'tool:complete')!;

      expect(completeEvent.timing).toBeDefined();
      expect(completeEvent.timing!.duration).toBeGreaterThanOrEqual(executionTime - tolerance);
      expect(completeEvent.timing!.duration).toBeLessThanOrEqual(executionTime + tolerance);
    });

    it('should ensure startTime in complete matches actual start', async () => {
      orchestrator.startCapture();

      const startTime = orchestrator.simulateToolStart('task', 'TimingMatch', 'tm-1', {});
      await new Promise(r => setTimeout(r, 50));
      orchestrator.simulateToolComplete('tm-1', { success: true });

      const events = orchestrator.stopCapture();

      const completeEvent = events.find(e => e.type === 'tool:complete')!;

      expect(completeEvent.timing!.startTime.getTime()).toBe(startTime.getTime());
    });

    it('should calculate duration correctly', async () => {
      orchestrator.startCapture();

      const startTime = new Date();
      orchestrator.simulateToolStart('task', 'DurationCalc', 'dc-1', {});

      const waitTime = 60;
      await new Promise(r => setTimeout(r, waitTime));

      orchestrator.simulateToolComplete('dc-1', { success: true });

      const events = orchestrator.stopCapture();
      const completeEvent = events.find(e => e.type === 'tool:complete')!;

      // Duration should match endTime - startTime
      const calculatedDuration =
        completeEvent.timing!.endTime.getTime() - completeEvent.timing!.startTime.getTime();

      expect(completeEvent.timing!.duration).toBe(calculatedDuration);
    });
  });

  describe('Edge Cases', () => {
    it('should handle instant tool completion (0ms)', async () => {
      orchestrator.startCapture();

      orchestrator.simulateToolStart('task', 'InstantTool', 'instant-1', {});
      orchestrator.simulateToolComplete('instant-1', { success: true });

      const events = orchestrator.stopCapture();

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool:start');
      expect(events[1].type).toBe('tool:complete');

      const completeEvent = events.find(e => e.type === 'tool:complete')!;
      expect(completeEvent.timing!.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle single tool execution correctly', async () => {
      const taskId = 'single-tool-test';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'single', toolName: 'SingleTool', executionTimeMs: 40 },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      expect(result.valid).toBe(true);
      expect(result.eventsByTool.size).toBe(1);

      const events = result.eventsByTool.get('single')!;
      expect(events).toHaveLength(2);
    });

    it('should handle tools with same name but different callIds', async () => {
      const taskId = 'same-name-test';
      const tools: ConcurrentToolConfig[] = [
        { callId: 'read-1', toolName: 'ReadFile', executionTimeMs: 30 },
        { callId: 'read-2', toolName: 'ReadFile', executionTimeMs: 40 },
        { callId: 'read-3', toolName: 'ReadFile', executionTimeMs: 35 },
      ];

      const result = await orchestrator.executeToolsConcurrently(taskId, tools);

      expect(result.valid).toBe(true);
      expect(result.eventsByTool.size).toBe(3);

      // Each should be tracked independently by callId
      expect(result.eventsByTool.has('read-1')).toBe(true);
      expect(result.eventsByTool.has('read-2')).toBe(true);
      expect(result.eventsByTool.has('read-3')).toBe(true);
    });
  });
});
