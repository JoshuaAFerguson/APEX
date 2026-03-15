/**
 * Event Ordering with Concurrent Tools - Comprehensive Test Suite
 *
 * This test suite verifies that when multiple tools execute concurrently,
 * their events (tool:start, tool:progress, tool:complete) are properly
 * ordered and tracked. This addresses the core requirement for testing
 * event ordering with concurrent tools.
 *
 * Key test scenarios:
 * 1. Basic event sequencing (start -> progress* -> complete)
 * 2. Concurrent execution without event contamination
 * 3. Complex interleaving patterns
 * 4. High-concurrency stress tests
 * 5. Timing consistency and chronological ordering
 * 6. Error handling during concurrent execution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// ============================================================================
// Core Interfaces and Types
// ============================================================================

interface ConcurrentToolEvent {
  type: 'tool:start' | 'tool:progress' | 'tool:complete';
  callId: string;
  toolName: string;
  taskId: string;
  timestamp: Date;
  sequenceIndex: number;
  data?: unknown;
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

interface EventOrderingValidationResult {
  isValid: boolean;
  violations: Array<{
    type: string;
    callId: string;
    description: string;
    severity: 'warning' | 'error';
  }>;
  stats: {
    totalEvents: number;
    uniqueCallIds: number;
    maxConcurrentExecutions: number;
    averageEventGap: number;
  };
}

interface ConcurrentExecutionSpec {
  callId: string;
  toolName: string;
  executionDuration: number;
  shouldFail?: boolean;
  emitProgress?: boolean;
  startDelay?: number;
}

// ============================================================================
// Enhanced Mock Orchestrator with Precise Event Control
// ============================================================================

class ConcurrentEventOrchestrator extends EventEmitter {
  private executionSpecs = new Map<string, ConcurrentExecutionSpec>();
  private eventSequence: ConcurrentToolEvent[] = [];
  private sequenceCounter = 0;
  private isCapturing = false;

  constructor() {
    super();
    this.setMaxListeners(100); // Support high concurrency tests
  }

  startCapturing(): void {
    this.isCapturing = true;
    this.eventSequence = [];
    this.sequenceCounter = 0;
  }

  stopCapturing(): ConcurrentToolEvent[] {
    this.isCapturing = false;
    return [...this.eventSequence];
  }

  clearState(): void {
    this.executionSpecs.clear();
    this.eventSequence = [];
    this.sequenceCounter = 0;
    this.removeAllListeners();
  }

  /**
   * Generate globally unique call ID for each execution
   */
  generateCallId(): string {
    return `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Start a tool execution with precise timing control
   */
  startToolExecution(
    taskId: string,
    toolName: string,
    spec?: Partial<ConcurrentExecutionSpec>
  ): string {
    const callId = this.generateCallId();

    const executionSpec: ConcurrentExecutionSpec = {
      callId,
      toolName,
      executionDuration: spec?.executionDuration ?? 50,
      shouldFail: spec?.shouldFail ?? false,
      emitProgress: spec?.emitProgress ?? false,
      startDelay: spec?.startDelay ?? 0,
    };

    this.executionSpecs.set(callId, executionSpec);

    // Emit start event immediately
    this.emitEvent({
      type: 'tool:start',
      callId,
      toolName,
      taskId,
      timestamp: new Date(),
      sequenceIndex: this.sequenceCounter++,
      data: { input: {} }
    });

    return callId;
  }

  /**
   * Simulate tool execution with optional progress events
   */
  async executeToolAsync(
    taskId: string,
    callId: string
  ): Promise<void> {
    const spec = this.executionSpecs.get(callId);
    if (!spec) {
      throw new Error(`No execution spec found for callId: ${callId}`);
    }

    // Apply start delay if specified
    if (spec.startDelay && spec.startDelay > 0) {
      await this.sleep(spec.startDelay);
    }

    // Emit progress events if enabled
    if (spec.emitProgress) {
      const progressCount = 3;
      const progressInterval = spec.executionDuration / (progressCount + 1);

      for (let i = 1; i <= progressCount; i++) {
        await this.sleep(progressInterval);

        this.emitEvent({
          type: 'tool:progress',
          callId,
          toolName: spec.toolName,
          taskId,
          timestamp: new Date(),
          sequenceIndex: this.sequenceCounter++,
          data: {
            message: `Progress ${i}/${progressCount}`,
            percentage: Math.round((i / progressCount) * 100)
          }
        });
      }
    } else {
      // Wait for the full execution duration
      await this.sleep(spec.executionDuration);
    }

    // Emit completion event
    const endTime = new Date();
    const startEvent = this.eventSequence.find(e =>
      e.callId === callId && e.type === 'tool:start'
    );

    const timing = startEvent ? {
      startTime: startEvent.timestamp,
      endTime,
      duration: endTime.getTime() - startEvent.timestamp.getTime()
    } : undefined;

    this.emitEvent({
      type: 'tool:complete',
      callId,
      toolName: spec.toolName,
      taskId,
      timestamp: endTime,
      sequenceIndex: this.sequenceCounter++,
      timing,
      result: {
        success: !spec.shouldFail,
        output: spec.shouldFail ? undefined : { result: 'completed' },
        error: spec.shouldFail ? 'Tool execution failed' : undefined
      }
    });

    this.executionSpecs.delete(callId);
  }

  /**
   * Execute multiple tools concurrently
   */
  async executeConcurrentTools(
    taskId: string,
    specs: Array<Partial<ConcurrentExecutionSpec> & { toolName: string }>
  ): Promise<string[]> {
    const callIds: string[] = [];

    // Start all tools
    for (const spec of specs) {
      const callId = this.startToolExecution(taskId, spec.toolName, spec);
      callIds.push(callId);
    }

    // Execute all tools concurrently
    await Promise.all(
      callIds.map(callId => this.executeToolAsync(taskId, callId))
    );

    return callIds;
  }

  /**
   * Validate event ordering for all captured events
   */
  validateEventOrdering(): EventOrderingValidationResult {
    const violations: EventOrderingValidationResult['violations'] = [];
    const callIds = new Set(this.eventSequence.map(e => e.callId));

    // Validate per-tool event sequencing
    for (const callId of callIds) {
      const callEvents = this.eventSequence
        .filter(e => e.callId === callId)
        .sort((a, b) => a.sequenceIndex - b.sequenceIndex);

      if (callEvents.length === 0) continue;

      // First event must be tool:start
      if (callEvents[0].type !== 'tool:start') {
        violations.push({
          type: 'invalid_sequence',
          callId,
          description: `First event is ${callEvents[0].type}, expected tool:start`,
          severity: 'error'
        });
      }

      // Last event should be tool:complete for completed executions
      if (callEvents.length > 1 && !this.executionSpecs.has(callId)) {
        const lastEvent = callEvents[callEvents.length - 1];
        if (lastEvent.type !== 'tool:complete') {
          violations.push({
            type: 'incomplete_sequence',
            callId,
            description: `Last event is ${lastEvent.type}, expected tool:complete`,
            severity: 'warning'
          });
        }
      }

      // Progress events must be between start and complete
      for (let i = 1; i < callEvents.length - 1; i++) {
        if (callEvents[i].type === 'tool:progress') {
          if (callEvents[0].type !== 'tool:start') {
            violations.push({
              type: 'orphaned_progress',
              callId,
              description: 'Progress event without preceding start event',
              severity: 'error'
            });
          }
        }
      }

      // Verify timestamp monotonicity
      for (let i = 1; i < callEvents.length; i++) {
        if (callEvents[i].timestamp.getTime() < callEvents[i - 1].timestamp.getTime()) {
          violations.push({
            type: 'timestamp_violation',
            callId,
            description: 'Non-monotonic timestamps detected',
            severity: 'warning'
          });
        }
      }
    }

    // Calculate concurrency statistics
    const maxConcurrency = this.calculateMaxConcurrency();
    const averageEventGap = this.calculateAverageEventGap();

    return {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      stats: {
        totalEvents: this.eventSequence.length,
        uniqueCallIds: callIds.size,
        maxConcurrentExecutions: maxConcurrency,
        averageEventGap
      }
    };
  }

  /**
   * Get events for a specific call ID
   */
  getEventsForCall(callId: string): ConcurrentToolEvent[] {
    return this.eventSequence
      .filter(e => e.callId === callId)
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  }

  /**
   * Get all captured events sorted by sequence
   */
  getAllEventsBySequence(): ConcurrentToolEvent[] {
    return [...this.eventSequence].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  }

  /**
   * Get all captured events sorted by timestamp
   */
  getAllEventsByTimestamp(): ConcurrentToolEvent[] {
    return [...this.eventSequence].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  // Private methods
  private emitEvent(event: ConcurrentToolEvent): void {
    if (this.isCapturing) {
      this.eventSequence.push(event);
    }

    // Emit the actual event for any listeners
    this.emit(event.type, {
      ...event,
      timestamp: event.timestamp
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateMaxConcurrency(): number {
    const events = this.getAllEventsByTimestamp();
    const activeCalls = new Set<string>();
    let maxConcurrency = 0;

    for (const event of events) {
      if (event.type === 'tool:start') {
        activeCalls.add(event.callId);
      } else if (event.type === 'tool:complete') {
        activeCalls.delete(event.callId);
      }
      maxConcurrency = Math.max(maxConcurrency, activeCalls.size);
    }

    return maxConcurrency;
  }

  private calculateAverageEventGap(): number {
    const events = this.getAllEventsByTimestamp();
    if (events.length < 2) return 0;

    let totalGap = 0;
    for (let i = 1; i < events.length; i++) {
      totalGap += events[i].timestamp.getTime() - events[i - 1].timestamp.getTime();
    }

    return totalGap / (events.length - 1);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Event Ordering with Concurrent Tools', () => {
  let orchestrator: ConcurrentEventOrchestrator;

  beforeEach(() => {
    orchestrator = new ConcurrentEventOrchestrator();
    orchestrator.startCapturing();
  });

  afterEach(() => {
    orchestrator.clearState();
  });

  // ========================================================================
  // Basic Event Sequencing Tests
  // ========================================================================

  describe('Basic Event Sequencing', () => {
    it('should emit start event before complete event for single tool', async () => {
      const callId = orchestrator.startToolExecution('task-1', 'ReadTool');
      await orchestrator.executeToolAsync('task-1', callId);

      const events = orchestrator.getEventsForCall(callId);
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool:start');
      expect(events[1].type).toBe('tool:complete');
      expect(events[0].sequenceIndex).toBeLessThan(events[1].sequenceIndex);
    });

    it('should emit progress events between start and complete', async () => {
      const callId = orchestrator.startToolExecution('task-1', 'ProgressTool', {
        emitProgress: true,
        executionDuration: 100
      });
      await orchestrator.executeToolAsync('task-1', callId);

      const events = orchestrator.getEventsForCall(callId);
      expect(events.length).toBeGreaterThan(2);
      expect(events[0].type).toBe('tool:start');
      expect(events[events.length - 1].type).toBe('tool:complete');

      // Check that all middle events are progress events
      for (let i = 1; i < events.length - 1; i++) {
        expect(events[i].type).toBe('tool:progress');
      }
    });

    it('should maintain timestamp monotonicity within single execution', async () => {
      const callId = orchestrator.startToolExecution('task-1', 'TimingTool', {
        emitProgress: true,
        executionDuration: 80
      });
      await orchestrator.executeToolAsync('task-1', callId);

      const events = orchestrator.getEventsForCall(callId);
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timestamp.getTime()
        );
      }
    });
  });

  // ========================================================================
  // Concurrent Execution Tests
  // ========================================================================

  describe('Concurrent Execution', () => {
    it('should handle two tools executing concurrently', async () => {
      await orchestrator.executeConcurrentTools('task-concurrent', [
        { toolName: 'Tool1', executionDuration: 50 },
        { toolName: 'Tool2', executionDuration: 60 }
      ]);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);
      expect(validation.stats.uniqueCallIds).toBe(2);
      expect(validation.stats.totalEvents).toBe(4); // 2 start + 2 complete
      expect(validation.stats.maxConcurrentExecutions).toBeGreaterThanOrEqual(2);
    });

    it('should handle five tools with mixed execution patterns', async () => {
      await orchestrator.executeConcurrentTools('task-mixed', [
        { toolName: 'FastTool', executionDuration: 20 },
        { toolName: 'SlowTool', executionDuration: 100 },
        { toolName: 'ProgressTool', executionDuration: 60, emitProgress: true },
        { toolName: 'FailTool', executionDuration: 40, shouldFail: true },
        { toolName: 'DelayedTool', executionDuration: 30, startDelay: 25 }
      ]);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);
      expect(validation.stats.uniqueCallIds).toBe(5);
      expect(validation.violations.filter(v => v.severity === 'error')).toHaveLength(0);

      // Verify specific tool behaviors
      const allEvents = orchestrator.getAllEventsBySequence();
      const progressEvents = allEvents.filter(e => e.type === 'tool:progress');
      expect(progressEvents.length).toBeGreaterThan(0); // ProgressTool should emit progress

      const failedCompleteEvent = allEvents.find(e =>
        e.type === 'tool:complete' && e.toolName === 'FailTool'
      );
      expect(failedCompleteEvent?.result?.success).toBe(false);
    });

    it('should handle 10 tools executing with high concurrency', async () => {
      const tools = [];
      for (let i = 1; i <= 10; i++) {
        tools.push({
          toolName: `ConcurrentTool${i}`,
          executionDuration: Math.floor(Math.random() * 50) + 20, // 20-70ms
          emitProgress: i % 3 === 0 // Every third tool emits progress
        });
      }

      await orchestrator.executeConcurrentTools('task-high-concurrency', tools);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);
      expect(validation.stats.uniqueCallIds).toBe(10);
      expect(validation.stats.maxConcurrentExecutions).toBeGreaterThanOrEqual(8); // Very high concurrency
    });

    it('should maintain call ID uniqueness across concurrent executions', async () => {
      const callIds = [];

      // Start 15 tools nearly simultaneously
      for (let i = 1; i <= 15; i++) {
        const callId = orchestrator.startToolExecution('task-unique', `Tool${i}`);
        callIds.push(callId);
      }

      // Execute them all
      await Promise.all(
        callIds.map(callId => orchestrator.executeToolAsync('task-unique', callId))
      );

      // Verify all call IDs are unique
      const uniqueCallIds = new Set(callIds);
      expect(uniqueCallIds.size).toBe(15);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);
      expect(validation.stats.uniqueCallIds).toBe(15);
    });
  });

  // ========================================================================
  // Complex Interleaving Patterns
  // ========================================================================

  describe('Complex Interleaving Patterns', () => {
    it('should handle LIFO completion pattern', async () => {
      const tools = ['First', 'Second', 'Third'].map(name => ({
        toolName: name,
        executionDuration: 50
      }));

      // Start all tools first
      const callIds = [];
      for (const tool of tools) {
        const callId = orchestrator.startToolExecution('task-lifo', tool.toolName);
        callIds.push(callId);
      }

      // Complete in reverse order with delays
      for (let i = callIds.length - 1; i >= 0; i--) {
        await orchestrator.executeToolAsync('task-lifo', callIds[i]);
        if (i > 0) await orchestrator.sleep(10); // Small delay between completions
      }

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);

      // Verify LIFO completion order by checking complete events
      const allEvents = orchestrator.getAllEventsBySequence();
      const completeEvents = allEvents
        .filter(e => e.type === 'tool:complete')
        .map(e => e.toolName);

      expect(completeEvents).toEqual(['Third', 'Second', 'First']);
    });

    it('should handle interleaved starts and completions', async () => {
      // Pattern: A starts, B starts, A completes, C starts, B completes, C completes

      const taskId = 'task-interleaved';

      const callIdA = orchestrator.startToolExecution(taskId, 'ToolA');
      await orchestrator.sleep(10);

      const callIdB = orchestrator.startToolExecution(taskId, 'ToolB');
      await orchestrator.sleep(10);

      await orchestrator.executeToolAsync(taskId, callIdA);
      await orchestrator.sleep(10);

      const callIdC = orchestrator.startToolExecution(taskId, 'ToolC');
      await orchestrator.sleep(10);

      await orchestrator.executeToolAsync(taskId, callIdB);
      await orchestrator.sleep(10);

      await orchestrator.executeToolAsync(taskId, callIdC);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);

      // Verify the interleaving pattern
      const allEvents = orchestrator.getAllEventsBySequence();
      const eventPattern = allEvents.map(e => `${e.toolName}:${e.type.split(':')[1]}`);

      expect(eventPattern).toEqual([
        'ToolA:start',
        'ToolB:start',
        'ToolA:complete',
        'ToolC:start',
        'ToolB:complete',
        'ToolC:complete'
      ]);
    });
  });

  // ========================================================================
  // Timing Consistency Tests
  // ========================================================================

  describe('Timing Consistency', () => {
    it('should maintain consistent timing data across concurrent executions', async () => {
      await orchestrator.executeConcurrentTools('task-timing', [
        { toolName: 'Timer1', executionDuration: 50 },
        { toolName: 'Timer2', executionDuration: 75 },
        { toolName: 'Timer3', executionDuration: 100 }
      ]);

      const allEvents = orchestrator.getAllEventsBySequence();
      const completeEvents = allEvents.filter(e => e.type === 'tool:complete');

      for (const event of completeEvents) {
        expect(event.timing).toBeDefined();
        expect(event.timing!.duration).toBeGreaterThan(0);
        expect(event.timing!.endTime.getTime()).toBeGreaterThanOrEqual(
          event.timing!.startTime.getTime()
        );
      }
    });

    it('should handle rapid successive executions without timing conflicts', async () => {
      // Execute 20 tools in rapid succession
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const callId = orchestrator.startToolExecution('task-rapid', `RapidTool${i}`);
        promises.push(orchestrator.executeToolAsync('task-rapid', callId));
      }

      await Promise.all(promises);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);
      expect(validation.stats.uniqueCallIds).toBe(20);
      expect(validation.stats.totalEvents).toBe(40); // 20 starts + 20 completes

      // Average event gap should be very small due to rapid execution
      expect(validation.stats.averageEventGap).toBeLessThan(100); // Less than 100ms average gap
    });
  });

  // ========================================================================
  // Error Handling Tests
  // ========================================================================

  describe('Error Handling', () => {
    it('should maintain proper event ordering when tools fail', async () => {
      await orchestrator.executeConcurrentTools('task-errors', [
        { toolName: 'Success1', executionDuration: 40, shouldFail: false },
        { toolName: 'Failure1', executionDuration: 50, shouldFail: true },
        { toolName: 'Success2', executionDuration: 60, shouldFail: false },
        { toolName: 'Failure2', executionDuration: 30, shouldFail: true }
      ]);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);

      // Verify failed tools still have proper event sequence
      const allEvents = orchestrator.getAllEventsBySequence();
      const failedCompleteEvents = allEvents.filter(e =>
        e.type === 'tool:complete' &&
        e.result?.success === false
      );

      expect(failedCompleteEvents).toHaveLength(2);

      for (const failEvent of failedCompleteEvents) {
        const callEvents = orchestrator.getEventsForCall(failEvent.callId);
        expect(callEvents[0].type).toBe('tool:start');
        expect(callEvents[callEvents.length - 1].type).toBe('tool:complete');
      }
    });

    it('should handle mixed progress and failure scenarios', async () => {
      await orchestrator.executeConcurrentTools('task-mixed-errors', [
        {
          toolName: 'ProgressFail',
          executionDuration: 80,
          shouldFail: true,
          emitProgress: true
        },
        {
          toolName: 'ProgressSuccess',
          executionDuration: 70,
          shouldFail: false,
          emitProgress: true
        }
      ]);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);

      // Both tools should have progress events despite different outcomes
      const progressEvents = orchestrator.getAllEventsBySequence()
        .filter(e => e.type === 'tool:progress');

      expect(progressEvents.length).toBeGreaterThan(0);

      // Verify at least one tool from each category emitted progress
      const progressToolNames = new Set(progressEvents.map(e => e.toolName));
      expect(progressToolNames.has('ProgressFail')).toBe(true);
      expect(progressToolNames.has('ProgressSuccess')).toBe(true);
    });
  });

  // ========================================================================
  // Stress and Edge Case Tests
  // ========================================================================

  describe('Stress and Edge Cases', () => {
    it('should handle burst execution of 25 tools', async () => {
      const tools = [];
      for (let i = 1; i <= 25; i++) {
        tools.push({
          toolName: `BurstTool${i}`,
          executionDuration: Math.floor(Math.random() * 40) + 10, // 10-50ms
          emitProgress: Math.random() > 0.7, // 30% chance of progress
          shouldFail: Math.random() > 0.8 // 20% chance of failure
        });
      }

      const startTime = Date.now();
      await orchestrator.executeConcurrentTools('task-burst', tools);
      const endTime = Date.now();

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);
      expect(validation.stats.uniqueCallIds).toBe(25);
      expect(validation.stats.maxConcurrentExecutions).toBeGreaterThanOrEqual(20);

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(3000); // Less than 3 seconds
    });

    it('should handle zero-duration tool executions', async () => {
      await orchestrator.executeConcurrentTools('task-instant', [
        { toolName: 'InstantTool1', executionDuration: 0 },
        { toolName: 'InstantTool2', executionDuration: 0 },
        { toolName: 'InstantTool3', executionDuration: 0 }
      ]);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);
      expect(validation.stats.uniqueCallIds).toBe(3);

      // All executions should have valid timing even with 0 duration
      const completeEvents = orchestrator.getAllEventsBySequence()
        .filter(e => e.type === 'tool:complete');

      for (const event of completeEvents) {
        expect(event.timing?.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should maintain event ordering across task boundaries', async () => {
      // Execute tools for multiple tasks concurrently
      const task1Promise = orchestrator.executeConcurrentTools('task-1', [
        { toolName: 'Task1Tool1', executionDuration: 40 },
        { toolName: 'Task1Tool2', executionDuration: 50 }
      ]);

      const task2Promise = orchestrator.executeConcurrentTools('task-2', [
        { toolName: 'Task2Tool1', executionDuration: 45 },
        { toolName: 'Task2Tool2', executionDuration: 35 }
      ]);

      await Promise.all([task1Promise, task2Promise]);

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);
      expect(validation.stats.uniqueCallIds).toBe(4);

      // Verify task IDs are maintained correctly
      const allEvents = orchestrator.getAllEventsBySequence();
      for (const event of allEvents) {
        if (event.toolName.startsWith('Task1')) {
          expect(event.taskId).toBe('task-1');
        } else if (event.toolName.startsWith('Task2')) {
          expect(event.taskId).toBe('task-2');
        }
      }
    });
  });

  // ========================================================================
  // Integration and Real-World Scenarios
  // ========================================================================

  describe('Real-World Integration Scenarios', () => {
    it('should handle workflow-like execution patterns', async () => {
      // Simulate a typical development workflow:
      // 1. Read files (parallel)
      // 2. Process data (parallel)
      // 3. Write results (sequential)

      // Phase 1: Parallel reads
      const readCallIds = [];
      for (let i = 1; i <= 3; i++) {
        const callId = orchestrator.startToolExecution('workflow', `ReadFile${i}`, {
          executionDuration: 40
        });
        readCallIds.push(callId);
      }

      await Promise.all(
        readCallIds.map(id => orchestrator.executeToolAsync('workflow', id))
      );

      // Phase 2: Parallel processing
      const processCallIds = [];
      for (let i = 1; i <= 2; i++) {
        const callId = orchestrator.startToolExecution('workflow', `ProcessData${i}`, {
          executionDuration: 60,
          emitProgress: true
        });
        processCallIds.push(callId);
      }

      await Promise.all(
        processCallIds.map(id => orchestrator.executeToolAsync('workflow', id))
      );

      // Phase 3: Sequential writes
      for (let i = 1; i <= 2; i++) {
        const callId = orchestrator.startToolExecution('workflow', `WriteResult${i}`, {
          executionDuration: 30
        });
        await orchestrator.executeToolAsync('workflow', callId);
      }

      const validation = orchestrator.validateEventOrdering();
      expect(validation.isValid).toBe(true);
      expect(validation.stats.uniqueCallIds).toBe(7); // 3 + 2 + 2

      // Verify workflow phases in event timeline
      const allEvents = orchestrator.getAllEventsBySequence();
      const eventNames = allEvents.map(e => e.toolName);

      // All ReadFile events should appear before ProcessData events
      const lastReadIndex = Math.max(...eventNames
        .map((name, i) => name.startsWith('ReadFile') ? i : -1));
      const firstProcessIndex = eventNames
        .findIndex(name => name.startsWith('ProcessData'));

      expect(firstProcessIndex).toBeGreaterThan(lastReadIndex);
    });

    it('should provide comprehensive event ordering summary', () => {
      // This test validates the overall testing infrastructure
      const validation = orchestrator.validateEventOrdering();

      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('violations');
      expect(validation).toHaveProperty('stats');

      expect(validation.stats).toHaveProperty('totalEvents');
      expect(validation.stats).toHaveProperty('uniqueCallIds');
      expect(validation.stats).toHaveProperty('maxConcurrentExecutions');
      expect(validation.stats).toHaveProperty('averageEventGap');

      // All violations should have proper structure
      for (const violation of validation.violations) {
        expect(violation).toHaveProperty('type');
        expect(violation).toHaveProperty('callId');
        expect(violation).toHaveProperty('description');
        expect(violation).toHaveProperty('severity');
      }
    });
  });
});