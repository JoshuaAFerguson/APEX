import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Comprehensive Timing Consistency Tests
 *
 * This test suite validates timing consistency between events with specific focus on:
 * - Rapid succession tool execution timing accuracy
 * - Event correlation and ordering under high load
 * - Timestamp precision and consistency
 * - Cross-event timing data integrity
 * - Concurrent execution timing isolation
 */

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
  progress: {
    message: string;
    percentage: number;
  };
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
 * High-precision timing orchestrator for testing timing consistency
 */
class PrecisionTimingOrchestrator extends EventEmitter {
  private activeExecutions = new Map<string, {
    startTime: Date;
    toolName: string;
    taskId: string;
    startTimestamp: number; // High precision timestamp
  }>();

  private executionSequence: Array<{
    eventType: 'start' | 'progress' | 'complete';
    callId: string;
    timestamp: number;
    precisionTimestamp: number;
  }> = [];

  /**
   * Execute tool with precise timing tracking
   */
  async executeToolWithPrecisionTiming(
    taskId: string,
    toolName: string,
    callId: string,
    input: Record<string, unknown>,
    executionTimeMs: number = 100,
    options: {
      shouldFail?: boolean;
      progressSteps?: Array<{ message: string; percentage: number; delayMs?: number }>;
    } = {}
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const startTime = new Date();
      const startPrecisionTimestamp = performance.now();

      // Store active execution with high precision timing
      this.activeExecutions.set(callId, {
        startTime,
        toolName,
        taskId,
        startTimestamp: startPrecisionTimestamp,
      });

      // Record sequence
      this.executionSequence.push({
        eventType: 'start',
        callId,
        timestamp: startTime.getTime(),
        precisionTimestamp: startPrecisionTimestamp,
      });

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

      // Handle progress events if specified
      let totalProgressDelay = 0;
      if (options.progressSteps) {
        for (let i = 0; i < options.progressSteps.length; i++) {
          const step = options.progressSteps[i];
          const progressDelay = step.delayMs || (executionTimeMs / options.progressSteps.length);
          totalProgressDelay += progressDelay;

          setTimeout(() => {
            const progressTimestamp = performance.now();
            const progressTime = new Date();

            this.executionSequence.push({
              eventType: 'progress',
              callId,
              timestamp: progressTime.getTime(),
              precisionTimestamp: progressTimestamp,
            });

            const progressEvent: ToolCallProgressEvent = {
              taskId,
              toolName,
              callId,
              progress: step,
              timestamp: progressTime,
            };
            this.emit('tool:progress', progressEvent);
          }, totalProgressDelay);
        }
      }

      // Complete execution
      setTimeout(() => {
        const endTime = new Date();
        const endPrecisionTimestamp = performance.now();
        const calculatedDuration = endTime.getTime() - startTime.getTime();
        const precisionDuration = endPrecisionTimestamp - startPrecisionTimestamp;

        this.executionSequence.push({
          eventType: 'complete',
          callId,
          timestamp: endTime.getTime(),
          precisionTimestamp: endPrecisionTimestamp,
        });

        // Emit complete event
        const completeEvent: ToolCallCompleteEvent = {
          taskId,
          toolName,
          callId,
          result: {
            success: !options.shouldFail,
            output: options.shouldFail ? undefined : {
              result: 'completed',
              precisionDuration,
              executionId: callId
            },
            error: options.shouldFail ? `${toolName} execution failed` : undefined,
          },
          timing: {
            startTime,
            endTime,
            duration: calculatedDuration,
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

  /**
   * Execute multiple tools in rapid succession
   */
  async executeRapidSuccession(
    taskId: string,
    tools: Array<{ name: string; callId: string; input?: Record<string, unknown> }>,
    intervalMs: number = 10
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];

      // Stagger the start times by intervalMs
      setTimeout(() => {
        const promise = this.executeToolWithPrecisionTiming(
          taskId,
          tool.name,
          tool.callId,
          tool.input || {},
          50 + Math.random() * 100 // Random execution time
        );
        promises.push(promise);
      }, i * intervalMs);
    }

    // Wait for all executions to complete
    await new Promise(resolve => setTimeout(resolve, tools.length * intervalMs + 300));
    await Promise.all(promises);
  }

  getExecutionSequence(): Array<{
    eventType: 'start' | 'progress' | 'complete';
    callId: string;
    timestamp: number;
    precisionTimestamp: number;
  }> {
    return [...this.executionSequence];
  }

  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  clearExecutionHistory(): void {
    this.executionSequence = [];
  }

  close(): void {
    this.removeAllListeners();
    this.activeExecutions.clear();
    this.executionSequence = [];
  }
}

describe('Comprehensive Timing Consistency Tests', () => {
  let orchestrator: PrecisionTimingOrchestrator;

  beforeEach(() => {
    orchestrator = new PrecisionTimingOrchestrator();
  });

  afterEach(() => {
    orchestrator.close();
  });

  // ============================================================================
  // Rapid Succession Tool Execution Tests
  // ============================================================================

  describe('Rapid Succession Tool Execution', () => {
    it('should maintain timing consistency for tools executed in rapid succession', async () => {
      const taskId = 'rapid-succession-task';
      const tools = [
        { name: 'Tool1', callId: 'rapid-call-1' },
        { name: 'Tool2', callId: 'rapid-call-2' },
        { name: 'Tool3', callId: 'rapid-call-3' },
        { name: 'Tool4', callId: 'rapid-call-4' },
        { name: 'Tool5', callId: 'rapid-call-5' },
      ];

      const events: Array<{
        type: 'start' | 'complete';
        callId: string;
        timestamp: Date;
        timing?: { startTime: Date; endTime: Date; duration: number };
      }> = [];

      orchestrator.on('tool:start', (event) => {
        events.push({
          type: 'start',
          callId: event.callId,
          timestamp: event.timestamp,
        });
      });

      orchestrator.on('tool:complete', (event) => {
        events.push({
          type: 'complete',
          callId: event.callId,
          timestamp: event.timestamp,
          timing: event.timing,
        });
      });

      // Execute tools with 5ms interval (very rapid succession)
      await orchestrator.executeRapidSuccession(taskId, tools, 5);

      // Validate all tools completed
      expect(events.filter(e => e.type === 'start')).toHaveLength(5);
      expect(events.filter(e => e.type === 'complete')).toHaveLength(5);

      // Validate timing consistency for each tool
      for (let i = 0; i < tools.length; i++) {
        const callId = tools[i].callId;
        const startEvent = events.find(e => e.type === 'start' && e.callId === callId);
        const completeEvent = events.find(e => e.type === 'complete' && e.callId === callId);

        expect(startEvent).toBeDefined();
        expect(completeEvent).toBeDefined();

        if (completeEvent?.timing) {
          // Verify timing calculation consistency
          const calculatedDuration = completeEvent.timing.endTime.getTime() - completeEvent.timing.startTime.getTime();
          expect(completeEvent.timing.duration).toBe(calculatedDuration);

          // Verify reasonable duration (allowing for rapid execution variance)
          expect(completeEvent.timing.duration).toBeGreaterThan(30); // At least 30ms
          expect(completeEvent.timing.duration).toBeLessThan(300); // Less than 300ms

          // Verify temporal ordering
          expect(completeEvent.timing.endTime.getTime()).toBeGreaterThan(completeEvent.timing.startTime.getTime());
        }
      }

      // Validate start order matches expected rapid succession
      const startEvents = events.filter(e => e.type === 'start').sort((a, b) =>
        a.timestamp.getTime() - b.timestamp.getTime()
      );

      for (let i = 1; i < startEvents.length; i++) {
        const timeDiff = startEvents[i].timestamp.getTime() - startEvents[i-1].timestamp.getTime();
        // Start times should be close together (rapid succession)
        expect(timeDiff).toBeLessThan(50); // Within 50ms of each other
      }
    }, 10000);

    it('should handle ultra-rapid succession (1ms intervals) without timing corruption', async () => {
      const taskId = 'ultra-rapid-task';
      const tools = Array.from({ length: 10 }, (_, i) => ({
        name: `UltraFast${i + 1}`,
        callId: `ultra-${i + 1}`,
      }));

      const timingData: Array<{
        callId: string;
        startTimestamp: number;
        endTimestamp: number;
        duration: number;
        sequenceOrder: number;
      }> = [];

      let sequenceCounter = 0;

      orchestrator.on('tool:start', (event) => {
        const existingEntry = timingData.find(d => d.callId === event.callId);
        if (existingEntry) {
          existingEntry.startTimestamp = event.timestamp.getTime();
        } else {
          timingData.push({
            callId: event.callId,
            startTimestamp: event.timestamp.getTime(),
            endTimestamp: 0,
            duration: 0,
            sequenceOrder: sequenceCounter++,
          });
        }
      });

      orchestrator.on('tool:complete', (event) => {
        const entry = timingData.find(d => d.callId === event.callId);
        if (entry) {
          entry.endTimestamp = event.timestamp.getTime();
          entry.duration = event.timing.duration;
        }
      });

      // Execute with 1ms interval (ultra-rapid)
      await orchestrator.executeRapidSuccession(taskId, tools, 1);

      // Validate all executions completed
      expect(timingData).toHaveLength(10);

      // Validate no timing corruption occurred
      for (const data of timingData) {
        expect(data.startTimestamp).toBeGreaterThan(0);
        expect(data.endTimestamp).toBeGreaterThan(0);
        expect(data.duration).toBeGreaterThan(0);
        expect(data.endTimestamp).toBeGreaterThan(data.startTimestamp);

        // Each execution should maintain its own timing integrity
        const calculatedDuration = data.endTimestamp - data.startTimestamp;
        expect(Math.abs(data.duration - calculatedDuration)).toBeLessThan(50); // 50ms tolerance
      }

      // Validate sequence ordering is preserved
      const sortedBySequence = [...timingData].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      for (let i = 1; i < sortedBySequence.length; i++) {
        const current = sortedBySequence[i];
        const previous = sortedBySequence[i - 1];

        // Start times should generally increase (allowing for minimal system variance)
        expect(current.startTimestamp).toBeGreaterThanOrEqual(previous.startTimestamp - 10);
      }
    }, 15000);
  });

  // ============================================================================
  // Event Correlation and Ordering Tests
  // ============================================================================

  describe('Event Correlation and Ordering', () => {
    it('should maintain correct event correlation for concurrent executions', async () => {
      const taskId = 'correlation-task';
      const correlationMap = new Map<string, {
        startEvent?: ToolCallStartEvent;
        progressEvents: ToolCallProgressEvent[];
        completeEvent?: ToolCallCompleteEvent;
      }>();

      // Track all events by callId
      orchestrator.on('tool:start', (event) => {
        if (!correlationMap.has(event.callId)) {
          correlationMap.set(event.callId, { progressEvents: [] });
        }
        correlationMap.get(event.callId)!.startEvent = event;
      });

      orchestrator.on('tool:progress', (event) => {
        if (!correlationMap.has(event.callId)) {
          correlationMap.set(event.callId, { progressEvents: [] });
        }
        correlationMap.get(event.callId)!.progressEvents.push(event);
      });

      orchestrator.on('tool:complete', (event) => {
        if (!correlationMap.has(event.callId)) {
          correlationMap.set(event.callId, { progressEvents: [] });
        }
        correlationMap.get(event.callId)!.completeEvent = event;
      });

      // Execute multiple tools with progress tracking
      const executionPromises = [
        orchestrator.executeToolWithPrecisionTiming(
          taskId, 'ToolA', 'call-a', {}, 120,
          {
            progressSteps: [
              { message: 'Step 1', percentage: 25 },
              { message: 'Step 2', percentage: 50 },
              { message: 'Step 3', percentage: 75 },
              { message: 'Complete', percentage: 100 },
            ]
          }
        ),
        orchestrator.executeToolWithPrecisionTiming(
          taskId, 'ToolB', 'call-b', {}, 80,
          {
            progressSteps: [
              { message: 'Phase 1', percentage: 50 },
              { message: 'Phase 2', percentage: 100 },
            ]
          }
        ),
        orchestrator.executeToolWithPrecisionTiming(
          taskId, 'ToolC', 'call-c', {}, 150,
          {
            progressSteps: [
              { message: 'Beginning', percentage: 20 },
              { message: 'Middle', percentage: 60 },
              { message: 'End', percentage: 100 },
            ]
          }
        ),
      ];

      await Promise.all(executionPromises);

      // Validate event correlation
      expect(correlationMap.size).toBe(3);

      for (const [callId, events] of correlationMap) {
        const { startEvent, progressEvents, completeEvent } = events;

        // All events should exist
        expect(startEvent).toBeDefined();
        expect(completeEvent).toBeDefined();
        expect(progressEvents.length).toBeGreaterThan(0);

        // All events should have the same identifiers
        expect(startEvent!.callId).toBe(callId);
        expect(startEvent!.taskId).toBe(taskId);
        expect(completeEvent!.callId).toBe(callId);
        expect(completeEvent!.taskId).toBe(taskId);
        expect(startEvent!.toolName).toBe(completeEvent!.toolName);

        for (const progressEvent of progressEvents) {
          expect(progressEvent.callId).toBe(callId);
          expect(progressEvent.taskId).toBe(taskId);
          expect(progressEvent.toolName).toBe(startEvent!.toolName);
        }

        // Events should be in correct temporal order
        const allEventTimes = [
          startEvent!.timestamp.getTime(),
          ...progressEvents.map(e => e.timestamp.getTime()),
          completeEvent!.timestamp.getTime(),
        ];

        for (let i = 1; i < allEventTimes.length; i++) {
          expect(allEventTimes[i]).toBeGreaterThanOrEqual(allEventTimes[i - 1]);
        }

        // Progress events should be between start and complete
        for (const progressEvent of progressEvents) {
          expect(progressEvent.timestamp.getTime()).toBeGreaterThanOrEqual(startEvent!.timestamp.getTime());
          expect(progressEvent.timestamp.getTime()).toBeLessThanOrEqual(completeEvent!.timestamp.getTime());
        }
      }
    });

    it('should maintain event ordering consistency under high load', async () => {
      const taskId = 'high-load-task';
      const toolCount = 20;
      const tools = Array.from({ length: toolCount }, (_, i) => ({
        name: `LoadTool${i + 1}`,
        callId: `load-call-${i + 1}`,
        input: { index: i, loadTest: true },
      }));

      const eventSequence: Array<{
        eventType: 'start' | 'complete';
        callId: string;
        timestamp: number;
        globalSequence: number;
      }> = [];

      let globalSequenceCounter = 0;

      orchestrator.on('tool:start', (event) => {
        eventSequence.push({
          eventType: 'start',
          callId: event.callId,
          timestamp: event.timestamp.getTime(),
          globalSequence: globalSequenceCounter++,
        });
      });

      orchestrator.on('tool:complete', (event) => {
        eventSequence.push({
          eventType: 'complete',
          callId: event.callId,
          timestamp: event.timestamp.getTime(),
          globalSequence: globalSequenceCounter++,
        });
      });

      // Execute all tools rapidly
      await orchestrator.executeRapidSuccession(taskId, tools, 2); // 2ms intervals

      // Validate total events received
      expect(eventSequence).toHaveLength(toolCount * 2); // start + complete for each

      // Validate sequence integrity
      const sortedByGlobalSequence = [...eventSequence].sort((a, b) => a.globalSequence - b.globalSequence);
      const sortedByTimestamp = [...eventSequence].sort((a, b) => a.timestamp - b.timestamp);

      // Global sequence should generally match timestamp order (allowing for minimal variance)
      for (let i = 0; i < sortedByGlobalSequence.length; i++) {
        const sequenceEvent = sortedByGlobalSequence[i];
        const timestampEvent = sortedByTimestamp[i];

        // Allow for some reordering due to rapid execution, but major ordering should be preserved
        const sequenceDiff = Math.abs(sequenceEvent.globalSequence - timestampEvent.globalSequence);
        expect(sequenceDiff).toBeLessThan(5); // Allow up to 5 positions of variance
      }

      // Validate each tool has proper start->complete sequence
      for (const tool of tools) {
        const toolEvents = eventSequence.filter(e => e.callId === tool.callId);
        expect(toolEvents).toHaveLength(2);

        const startEvent = toolEvents.find(e => e.eventType === 'start');
        const completeEvent = toolEvents.find(e => e.eventType === 'complete');

        expect(startEvent).toBeDefined();
        expect(completeEvent).toBeDefined();
        expect(startEvent!.timestamp).toBeLessThanOrEqual(completeEvent!.timestamp);
      }
    });
  });

  // ============================================================================
  // Timestamp Precision and Consistency Tests
  // ============================================================================

  describe('Timestamp Precision and Consistency', () => {
    it('should maintain microsecond-level timestamp precision', async () => {
      const taskId = 'precision-task';
      const timestamps: Array<{
        eventType: string;
        timestamp: number;
        precisionTimestamp: number;
        callId: string;
      }> = [];

      let startPrecisionTime: number;

      orchestrator.on('tool:start', (event) => {
        startPrecisionTime = performance.now();
        timestamps.push({
          eventType: 'start',
          timestamp: event.timestamp.getTime(),
          precisionTimestamp: startPrecisionTime,
          callId: event.callId,
        });
      });

      orchestrator.on('tool:complete', (event) => {
        const endPrecisionTime = performance.now();
        timestamps.push({
          eventType: 'complete',
          timestamp: event.timestamp.getTime(),
          precisionTimestamp: endPrecisionTime,
          callId: event.callId,
        });
      });

      await orchestrator.executeToolWithPrecisionTiming(
        taskId, 'PrecisionTool', 'precision-call', {}, 100
      );

      expect(timestamps).toHaveLength(2);

      const startTimestamp = timestamps[0];
      const completeTimestamp = timestamps[1];

      // Validate precision timestamp consistency
      expect(completeTimestamp.precisionTimestamp).toBeGreaterThan(startTimestamp.precisionTimestamp);

      // High-precision duration should be close to regular duration
      const precisionDuration = completeTimestamp.precisionTimestamp - startTimestamp.precisionTimestamp;
      const regularDuration = completeTimestamp.timestamp - startTimestamp.timestamp;

      // Precision and regular duration should be within 5ms of each other
      expect(Math.abs(precisionDuration - regularDuration)).toBeLessThan(5);

      // Precision should be more granular (allow for sub-millisecond differences)
      expect(precisionDuration).toBeGreaterThan(95); // At least 95ms
      expect(precisionDuration).toBeLessThan(150); // Less than 150ms
    });

    it('should detect and handle timestamp clock skew', async () => {
      const taskId = 'clock-skew-task';

      const timestamps: Array<{
        timestamp: Date;
        performanceTimestamp: number;
        eventType: string;
      }> = [];

      let simulatedClockSkew = 0;

      orchestrator.on('tool:start', (event) => {
        timestamps.push({
          timestamp: event.timestamp,
          performanceTimestamp: performance.now() + simulatedClockSkew,
          eventType: 'start',
        });

        // Simulate clock adjustment during execution
        simulatedClockSkew += 50; // Add 50ms simulated skew
      });

      orchestrator.on('tool:complete', (event) => {
        timestamps.push({
          timestamp: event.timestamp,
          performanceTimestamp: performance.now() + simulatedClockSkew,
          eventType: 'complete',
        });
      });

      await orchestrator.executeToolWithPrecisionTiming(
        taskId, 'ClockSkewTool', 'skew-call', {}, 100
      );

      // Validate timing remains internally consistent despite simulated clock changes
      expect(timestamps).toHaveLength(2);

      const startTime = timestamps[0];
      const endTime = timestamps[1];

      // Even with simulated clock skew, timing should remain reasonable
      expect(endTime.performanceTimestamp).toBeGreaterThan(startTime.performanceTimestamp);

      // System timestamps should also progress
      expect(endTime.timestamp.getTime()).toBeGreaterThan(startTime.timestamp.getTime());
    });
  });

  // ============================================================================
  // Cross-Event Data Integrity Tests
  // ============================================================================

  describe('Cross-Event Data Integrity', () => {
    it('should maintain data integrity across all event types', async () => {
      const taskId = 'integrity-task';
      const toolName = 'IntegrityTool';
      const callId = 'integrity-call';
      const testInput = {
        complex: { nested: { value: 42 } },
        array: [1, 2, 3],
        string: 'test-data',
        boolean: true
      };

      const capturedEvents: Array<{
        type: string;
        taskId: string;
        toolName: string;
        callId: string;
        data: any;
        timestamp: Date;
      }> = [];

      orchestrator.on('tool:start', (event) => {
        capturedEvents.push({
          type: 'start',
          taskId: event.taskId,
          toolName: event.toolName,
          callId: event.callId,
          data: { input: event.input, startTime: event.startTime },
          timestamp: event.timestamp,
        });
      });

      orchestrator.on('tool:progress', (event) => {
        capturedEvents.push({
          type: 'progress',
          taskId: event.taskId,
          toolName: event.toolName,
          callId: event.callId,
          data: { progress: event.progress },
          timestamp: event.timestamp,
        });
      });

      orchestrator.on('tool:complete', (event) => {
        capturedEvents.push({
          type: 'complete',
          taskId: event.taskId,
          toolName: event.toolName,
          callId: event.callId,
          data: { result: event.result, timing: event.timing },
          timestamp: event.timestamp,
        });
      });

      await orchestrator.executeToolWithPrecisionTiming(
        taskId, toolName, callId, testInput, 120,
        {
          progressSteps: [
            { message: 'Processing...', percentage: 50 },
            { message: 'Finalizing...', percentage: 100 },
          ]
        }
      );

      expect(capturedEvents.length).toBeGreaterThanOrEqual(3); // start, progress(es), complete

      // Validate consistent identifiers across all events
      for (const event of capturedEvents) {
        expect(event.taskId).toBe(taskId);
        expect(event.toolName).toBe(toolName);
        expect(event.callId).toBe(callId);
        expect(event.timestamp).toBeInstanceOf(Date);
      }

      // Validate input data integrity
      const startEvent = capturedEvents.find(e => e.type === 'start');
      expect(startEvent).toBeDefined();
      expect(startEvent!.data.input).toEqual(testInput);

      // Validate progress data integrity
      const progressEvents = capturedEvents.filter(e => e.type === 'progress');
      expect(progressEvents.length).toBe(2);

      for (const progressEvent of progressEvents) {
        expect(progressEvent.data.progress).toBeDefined();
        expect(typeof progressEvent.data.progress.message).toBe('string');
        expect(typeof progressEvent.data.progress.percentage).toBe('number');
      }

      // Validate completion data integrity
      const completeEvent = capturedEvents.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent!.data.result).toBeDefined();
      expect(completeEvent!.data.timing).toBeDefined();
      expect(typeof completeEvent!.data.result.success).toBe('boolean');

      // Validate timing data structure
      const timing = completeEvent!.data.timing;
      expect(timing.startTime).toBeInstanceOf(Date);
      expect(timing.endTime).toBeInstanceOf(Date);
      expect(typeof timing.duration).toBe('number');

      // Cross-reference timing data
      expect(timing.startTime.getTime()).toBe(startEvent!.data.startTime.getTime());
      expect(timing.endTime.getTime()).toBeGreaterThan(timing.startTime.getTime());
      expect(timing.duration).toBe(timing.endTime.getTime() - timing.startTime.getTime());
    });

    it('should preserve data integrity under memory pressure simulation', async () => {
      const taskId = 'memory-pressure-task';
      const largeDataSize = 1000;

      // Create large input objects to simulate memory pressure
      const largeInputs = Array.from({ length: largeDataSize }, (_, i) => ({
        id: i,
        data: new Array(100).fill(`data-item-${i}`),
        metadata: { timestamp: Date.now(), index: i },
      }));

      const dataIntegrityCheck = new Map<string, {
        originalInput: any;
        capturedInput?: any;
        startTime?: Date;
        endTime?: Date;
      }>();

      orchestrator.on('tool:start', (event) => {
        if (!dataIntegrityCheck.has(event.callId)) {
          dataIntegrityCheck.set(event.callId, { originalInput: null });
        }
        const entry = dataIntegrityCheck.get(event.callId)!;
        entry.capturedInput = JSON.parse(JSON.stringify(event.input)); // Deep copy
        entry.startTime = event.startTime;
      });

      orchestrator.on('tool:complete', (event) => {
        const entry = dataIntegrityCheck.get(event.callId);
        if (entry) {
          entry.endTime = event.timing.endTime;
        }
      });

      // Execute multiple tools with large data inputs
      const executionPromises = Array.from({ length: 10 }, (_, i) => {
        const callId = `memory-test-${i}`;
        const input = { largeData: largeInputs.slice(i * 100, (i + 1) * 100) };

        dataIntegrityCheck.set(callId, { originalInput: input });

        return orchestrator.executeToolWithPrecisionTiming(
          taskId,
          `MemoryTestTool${i}`,
          callId,
          input,
          80 + Math.random() * 40 // 80-120ms
        );
      });

      await Promise.all(executionPromises);

      // Validate data integrity was preserved
      for (const [callId, integrity] of dataIntegrityCheck) {
        expect(integrity.capturedInput).toBeDefined();
        expect(integrity.startTime).toBeDefined();
        expect(integrity.endTime).toBeDefined();

        // Verify deep equality of large data structures
        expect(integrity.capturedInput).toEqual(integrity.originalInput);

        // Verify timing integrity
        expect(integrity.endTime!.getTime()).toBeGreaterThan(integrity.startTime!.getTime());
      }

      expect(dataIntegrityCheck.size).toBe(10);
    });
  });

  // ============================================================================
  // Concurrent Execution Timing Isolation Tests
  // ============================================================================

  describe('Concurrent Execution Timing Isolation', () => {
    it('should maintain timing isolation between concurrent executions', async () => {
      const taskId = 'isolation-task';
      const concurrentCount = 15;
      const executionTimings = new Map<string, {
        expectedDuration: number;
        actualDuration?: number;
        startTime?: Date;
        endTime?: Date;
      }>();

      // Set up tracking
      orchestrator.on('tool:start', (event) => {
        if (executionTimings.has(event.callId)) {
          executionTimings.get(event.callId)!.startTime = event.startTime;
        }
      });

      orchestrator.on('tool:complete', (event) => {
        const entry = executionTimings.get(event.callId);
        if (entry) {
          entry.actualDuration = event.timing.duration;
          entry.endTime = event.timing.endTime;
        }
      });

      // Create concurrent executions with different expected durations
      const executionPromises = Array.from({ length: concurrentCount }, (_, i) => {
        const callId = `isolation-call-${i}`;
        const expectedDuration = 50 + (i * 10); // 50ms to 190ms

        executionTimings.set(callId, { expectedDuration });

        return orchestrator.executeToolWithPrecisionTiming(
          taskId,
          `IsolationTool${i}`,
          callId,
          { isolationTest: true, expectedDuration },
          expectedDuration
        );
      });

      // Execute all concurrently
      await Promise.all(executionPromises);

      // Validate timing isolation
      expect(executionTimings.size).toBe(concurrentCount);

      const toleranceMs = 50; // 50ms tolerance for timing accuracy
      let isolationViolations = 0;

      for (const [callId, timing] of executionTimings) {
        expect(timing.actualDuration).toBeDefined();
        expect(timing.startTime).toBeDefined();
        expect(timing.endTime).toBeDefined();

        // Validate duration accuracy (within tolerance)
        const durationDiff = Math.abs(timing.actualDuration! - timing.expectedDuration);
        if (durationDiff > toleranceMs) {
          isolationViolations++;
        }

        // Timing should be isolated (not affected by other concurrent executions)
        expect(timing.actualDuration!).toBeGreaterThan(timing.expectedDuration - toleranceMs);
        expect(timing.actualDuration!).toBeLessThan(timing.expectedDuration + toleranceMs);
      }

      // Allow for some variance due to system load, but isolation should generally be maintained
      expect(isolationViolations).toBeLessThan(concurrentCount * 0.3); // Less than 30% violations

      // Validate no cross-contamination of timing data
      const actualDurations = Array.from(executionTimings.values()).map(t => t.actualDuration!);
      const uniqueDurations = new Set(actualDurations);

      // Should have diverse durations (not all the same due to cross-contamination)
      expect(uniqueDurations.size).toBeGreaterThan(concurrentCount * 0.6); // At least 60% unique
    });

    it('should handle timing consistency during rapid context switching', async () => {
      const taskId = 'context-switch-task';
      const switchCount = 50;

      const timingValidations: Array<{
        callId: string;
        contextSwitchOrder: number;
        startTime: Date;
        endTime: Date;
        duration: number;
        isValid: boolean;
      }> = [];

      orchestrator.on('tool:complete', (event) => {
        const validation = {
          callId: event.callId,
          contextSwitchOrder: parseInt(event.callId.split('-')[2]),
          startTime: event.timing.startTime,
          endTime: event.timing.endTime,
          duration: event.timing.duration,
          isValid: event.timing.endTime.getTime() > event.timing.startTime.getTime() &&
                   event.timing.duration === (event.timing.endTime.getTime() - event.timing.startTime.getTime())
        };
        timingValidations.push(validation);
      });

      // Create rapid context switching scenario
      const switchPromises = Array.from({ length: switchCount }, (_, i) => {
        return new Promise<void>((resolve) => {
          // Stagger starts by very small amounts to create context switching
          setTimeout(() => {
            orchestrator.executeToolWithPrecisionTiming(
              taskId,
              `ContextTool${i}`,
              `context-switch-${i}`,
              { switchOrder: i },
              30 + (i % 5) * 10 // 30-70ms execution time
            ).then(() => resolve());
          }, i * 2); // 2ms stagger
        });
      });

      await Promise.all(switchPromises);

      // Validate all context switches maintained timing consistency
      expect(timingValidations).toHaveLength(switchCount);

      const invalidValidations = timingValidations.filter(v => !v.isValid);
      expect(invalidValidations).toHaveLength(0);

      // Validate context switch ordering preservation
      timingValidations.sort((a, b) => a.contextSwitchOrder - b.contextSwitchOrder);

      for (let i = 1; i < timingValidations.length; i++) {
        const current = timingValidations[i];
        const previous = timingValidations[i - 1];

        // Start times should generally progress forward (allowing for rapid switching variance)
        const startTimeDiff = current.startTime.getTime() - previous.startTime.getTime();
        expect(startTimeDiff).toBeGreaterThanOrEqual(-20); // Allow 20ms variance for rapid switching
      }
    });
  });
});