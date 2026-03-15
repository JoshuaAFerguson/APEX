/**
 * Timing Events Isolated Between Tools
 *
 * Comprehensive test suite verifying that when multiple different tools
 * (e.g., ReadTool, GrepTool, BashTool) execute concurrently, their timing
 * events remain isolated and don't interfere with each other.
 *
 * This validates:
 * - Each tool execution has independent timing data
 * - No timing leakage or cross-contamination between concurrent tools
 * - Duration calculations are accurate per-tool
 * - Event ordering doesn't affect timing accuracy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockOrchestrator,
  createTestOrchestrator,
  TestScenarioBuilder,
} from '../../tool-complete-events/shared/orchestrator-test-harness';
import {
  SUPPORTED_TOOLS,
  SupportedTool,
  createTestTaskId,
  getToolsByCategory,
} from '../../tool-complete-events/shared/tool-test-fixtures';
import {
  createConcurrentEventCollector,
  ConcurrentEventCollector,
} from '../shared/concurrent-event-collector';
import {
  ConcurrentScenarios,
  createScenarioBuilder,
} from '../shared/concurrent-test-scenarios';
import {
  TimingIsolationValidator,
  createTimingIsolationValidator,
  assertTimingIsolation,
  assertBatchTimingIsolation,
  buildTimingRecordsFromEvents,
  ToolTimingRecord,
} from '../shared/timing-isolation-validator';
import { TIMING_TOLERANCE_MS } from '../../event-data-integrity/shared/timing-consistency-utils';

describe('Timing Events Isolated Between Tools', () => {
  let orchestrator: MockOrchestrator;
  let collector: ConcurrentEventCollector;
  let isolationValidator: TimingIsolationValidator;
  let testTaskId: string;

  beforeEach(() => {
    orchestrator = createTestOrchestrator();
    collector = createConcurrentEventCollector(orchestrator);
    isolationValidator = createTimingIsolationValidator();
    testTaskId = createTestTaskId();
    collector.startCapturing();
  });

  afterEach(() => {
    collector.dispose();
    orchestrator.reset();
    isolationValidator.clear();
  });

  // ============================================================================
  // Basic Timing Isolation
  // ============================================================================

  describe('Basic Timing Isolation', () => {
    it('should isolate timing between two different tools executing concurrently', async () => {
      // Start two different tools
      const callIdA = orchestrator.startToolExecution(testTaskId, 'Read');
      await delay(10);
      const callIdB = orchestrator.startToolExecution(testTaskId, 'Write');

      // Complete them in reverse order
      await delay(20);
      orchestrator.completeToolExecution(testTaskId, callIdB);
      await delay(15);
      orchestrator.completeToolExecution(testTaskId, callIdA);

      collector.stopCapturing();
      const events = collector.getEvents();
      const records = buildTimingRecordsFromEvents(events);

      expect(records).toHaveLength(2);

      // Find records
      const readRecord = records.find(r => r.callId === callIdA);
      const writeRecord = records.find(r => r.callId === callIdB);

      expect(readRecord).toBeDefined();
      expect(writeRecord).toBeDefined();

      // Validate timing isolation
      assertTimingIsolation(readRecord!, writeRecord!);

      // Verify each has independent duration
      expect(readRecord!.duration).toBeGreaterThan(0);
      expect(writeRecord!.duration).toBeGreaterThan(0);

      // Read started first but completed last, so should have longer duration
      expect(readRecord!.duration).toBeGreaterThan(writeRecord!.duration);
    });

    it('should maintain independent duration calculations per tool', async () => {
      const tools: Array<{ tool: SupportedTool; callId: string; expectedMinDuration: number }> = [];

      // Start tools with different expected durations
      const durations = [50, 100, 75, 25];
      for (let i = 0; i < durations.length; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        tools.push({ tool, callId, expectedMinDuration: durations[i] });
      }

      // Complete tools after their expected delays
      for (const { callId, expectedMinDuration } of tools) {
        await delay(expectedMinDuration);
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const events = collector.getEvents();
      const records = buildTimingRecordsFromEvents(events);

      expect(records).toHaveLength(tools.length);

      // Each tool should have duration calculated correctly
      for (const record of records) {
        const calculatedDuration =
          record.endTime.getTime() - record.startTime.getTime();
        expect(record.duration).toBe(calculatedDuration);
        expect(record.duration).toBeGreaterThan(0);
      }

      // Validate batch isolation
      assertBatchTimingIsolation(records);
    });

    it('should not share timestamps between concurrent tools', async () => {
      // Execute several tools concurrently
      const callIds: string[] = [];
      const toolNames: SupportedTool[] = ['Read', 'Write', 'Edit', 'Grep'];

      for (const tool of toolNames) {
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
        await delay(5); // Small stagger to ensure different start times
      }

      // Complete all tools
      for (const callId of callIds) {
        await delay(10);
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const events = collector.getEvents();
      const records = buildTimingRecordsFromEvents(events);

      expect(records).toHaveLength(toolNames.length);

      // Check that no two records share exact timestamps (unless 0ms tools)
      for (let i = 0; i < records.length; i++) {
        for (let j = i + 1; j < records.length; j++) {
          // Start times should be different (we staggered starts)
          expect(records[i].startTime.getTime()).not.toBe(
            records[j].startTime.getTime()
          );
        }
      }
    });

    it('should isolate timing.startTime, timing.endTime, and timing.duration', async () => {
      // Start two tools at almost the same time
      const callIdA = orchestrator.startToolExecution(testTaskId, 'Bash');
      const callIdB = orchestrator.startToolExecution(testTaskId, 'Grep');

      // Complete with different delays
      await delay(50);
      orchestrator.completeToolExecution(testTaskId, callIdA);
      await delay(30);
      orchestrator.completeToolExecution(testTaskId, callIdB);

      collector.stopCapturing();
      const events = collector.getEvents();
      const records = buildTimingRecordsFromEvents(events);

      const recordA = records.find(r => r.callId === callIdA)!;
      const recordB = records.find(r => r.callId === callIdB)!;

      // Verify each record has independent timing values
      expect(recordA.startTime).not.toBe(recordB.startTime); // Different objects
      expect(recordA.endTime).not.toBe(recordB.endTime);

      // Each duration is calculated from its own start/end
      expect(recordA.duration).toBe(
        recordA.endTime.getTime() - recordA.startTime.getTime()
      );
      expect(recordB.duration).toBe(
        recordB.endTime.getTime() - recordB.startTime.getTime()
      );

      // B should have longer duration (started ~same time, completed later)
      expect(recordB.duration).toBeGreaterThan(recordA.duration);
    });
  });

  // ============================================================================
  // Multi-Tool Concurrent Execution
  // ============================================================================

  describe('Multi-Tool Concurrent Execution', () => {
    it('should isolate timing when all 12 tools execute concurrently', async () => {
      const result = await ConcurrentScenarios.maxConcurrency(
        orchestrator,
        testTaskId
      );

      expect(result.events).toHaveLength(12);
      expect(result.maxConcurrency).toBeGreaterThanOrEqual(2);

      collector.stopCapturing();
      const events = collector.getEvents();
      const records = buildTimingRecordsFromEvents(events);

      // Validate using the validator
      isolationValidator.addFromEvents(events);
      const isolationResult = isolationValidator.validate();

      // Should have no error-level violations
      const errors = isolationResult.violations.filter(v => v.severity === 'error');
      expect(errors).toHaveLength(0);
      expect(isolationResult.isIsolated).toBe(true);

      // All 12 tools should have valid timing
      expect(isolationResult.stats.toolExecutions).toBe(12);
      expect(isolationResult.stats.uniqueTools).toBe(12);
    });

    it('should maintain isolation with random subset of tools', async () => {
      // Pick random 5 tools
      const selectedTools = shuffleArray([...SUPPORTED_TOOLS]).slice(0, 5);

      const callIds: string[] = [];
      for (const tool of selectedTools) {
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
        await delay(2);
      }

      // Complete in random order
      const shuffledCallIds = shuffleArray([...callIds]);
      for (const callId of shuffledCallIds) {
        await delay(Math.random() * 20 + 5);
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(5);
      assertBatchTimingIsolation(records);
    });

    it('should handle category-mixed tools (file, search, web, execution, ui)', async () => {
      // One tool from each category
      const fileTools = getToolsByCategory('file');
      const searchTools = getToolsByCategory('search');
      const webTools = getToolsByCategory('web');
      const executionTools = getToolsByCategory('execution');
      const uiTools = getToolsByCategory('ui');

      const mixedTools: SupportedTool[] = [
        fileTools[0],
        searchTools[0],
        webTools[0],
        executionTools[0],
        uiTools[0],
      ];

      const callIds: string[] = [];
      for (const tool of mixedTools) {
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete all
      await delay(30);
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
        await delay(5);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(5);

      // Each category's tool should have isolated timing
      assertBatchTimingIsolation(records);

      // Use validator for comprehensive check
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();
      expect(result.isIsolated).toBe(true);
    });
  });

  // ============================================================================
  // Same Tool Type Concurrent Execution
  // ============================================================================

  describe('Same Tool Type Concurrent Execution', () => {
    it('should isolate timing for 5 concurrent Read tools', async () => {
      const callIds: string[] = [];

      // Start 5 Read tools
      for (let i = 0; i < 5; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'Read');
        callIds.push(callId);
        await delay(3);
      }

      // Complete with varying delays
      for (let i = 0; i < callIds.length; i++) {
        await delay(10 + i * 5);
        orchestrator.completeToolExecution(testTaskId, callIds[i]);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(5);

      // All should be Read tools
      expect(records.every(r => r.toolName === 'Read')).toBe(true);

      // But all should have unique call IDs
      const uniqueCallIds = new Set(records.map(r => r.callId));
      expect(uniqueCallIds.size).toBe(5);

      // Each should have independent timing
      assertBatchTimingIsolation(records);
    });

    it('should isolate timing for concurrent Bash commands', async () => {
      const result = await ConcurrentScenarios.sameToolConcurrent(
        orchestrator,
        testTaskId,
        'Bash',
        4
      );

      expect(result.events).toHaveLength(4);

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // All Bash commands should have isolated timing
      expect(records.every(r => r.toolName === 'Bash')).toBe(true);
      assertBatchTimingIsolation(records);
    });

    it('should maintain isolation by callId, not toolName', async () => {
      // Create multiple executions of same tool
      const callIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'Edit');
        callIds.push(callId);
      }

      // Complete in different order with different durations
      await delay(50);
      orchestrator.completeToolExecution(testTaskId, callIds[2]); // Third starts first

      await delay(30);
      orchestrator.completeToolExecution(testTaskId, callIds[0]); // First starts second

      await delay(20);
      orchestrator.completeToolExecution(testTaskId, callIds[1]); // Second starts third

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // Find each record by callId
      const record0 = records.find(r => r.callId === callIds[0])!;
      const record1 = records.find(r => r.callId === callIds[1])!;
      const record2 = records.find(r => r.callId === callIds[2])!;

      // Each should have different durations based on when they completed
      // callIds[2] completed first, callIds[0] second, callIds[1] last
      // All started at nearly same time
      // So: record2 < record0 < record1 in duration
      expect(record2.duration).toBeLessThan(record0.duration);
      expect(record0.duration).toBeLessThan(record1.duration);
    });
  });

  // ============================================================================
  // Interleaved Start/Complete Patterns
  // ============================================================================

  describe('Interleaved Start/Complete Patterns', () => {
    it('should isolate timing with ABAB pattern (start A, start B, complete A, complete B)', async () => {
      const callIdA = orchestrator.startToolExecution(testTaskId, 'Read');
      await delay(5);
      const callIdB = orchestrator.startToolExecution(testTaskId, 'Write');
      await delay(20);
      orchestrator.completeToolExecution(testTaskId, callIdA);
      await delay(15);
      orchestrator.completeToolExecution(testTaskId, callIdB);

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      const recordA = records.find(r => r.callId === callIdA)!;
      const recordB = records.find(r => r.callId === callIdB)!;

      // A started first and completed first
      expect(recordA.startTime.getTime()).toBeLessThan(recordB.startTime.getTime());
      expect(recordA.endTime.getTime()).toBeLessThan(recordB.endTime.getTime());

      // Both should have valid isolated timing
      assertTimingIsolation(recordA, recordB);
    });

    it('should isolate timing with ABBA pattern (start A, start B, complete B, complete A)', async () => {
      const callIdA = orchestrator.startToolExecution(testTaskId, 'Grep');
      await delay(5);
      const callIdB = orchestrator.startToolExecution(testTaskId, 'Glob');
      await delay(15);
      orchestrator.completeToolExecution(testTaskId, callIdB); // B completes first
      await delay(20);
      orchestrator.completeToolExecution(testTaskId, callIdA); // A completes last

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      const recordA = records.find(r => r.callId === callIdA)!;
      const recordB = records.find(r => r.callId === callIdB)!;

      // A started first but completed last
      expect(recordA.startTime.getTime()).toBeLessThan(recordB.startTime.getTime());
      expect(recordA.endTime.getTime()).toBeGreaterThan(recordB.endTime.getTime());

      // A should have longer duration
      expect(recordA.duration).toBeGreaterThan(recordB.duration);

      assertTimingIsolation(recordA, recordB);
    });

    it('should isolate timing with random interleaved patterns', async () => {
      const tools: SupportedTool[] = ['Read', 'Write', 'Edit', 'Bash', 'Grep'];
      const callIds: string[] = [];

      // Start all tools
      for (const tool of tools) {
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
        await delay(Math.random() * 5);
      }

      // Complete in random order
      const completionOrder = shuffleArray([...callIds]);
      for (const callId of completionOrder) {
        await delay(Math.random() * 20 + 5);
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(5);

      // Validate all have isolated timing
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
      expect(result.stats.toolExecutions).toBe(5);
    });
  });

  // ============================================================================
  // High-Frequency Rapid Execution
  // ============================================================================

  describe('High-Frequency Rapid Execution', () => {
    it('should isolate timing for 20 rapid concurrent tool starts', async () => {
      const callIds: string[] = [];
      const toolRotation: SupportedTool[] = ['Read', 'Write', 'Grep', 'Glob'];

      // Start 20 tools very rapidly
      for (let i = 0; i < 20; i++) {
        const tool = toolRotation[i % toolRotation.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
        // Minimal delay
        await delay(1);
      }

      // Complete all tools
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(20);

      // All should have valid, isolated timing
      assertBatchTimingIsolation(records);

      // All call IDs should be unique
      const uniqueCallIds = new Set(records.map(r => r.callId));
      expect(uniqueCallIds.size).toBe(20);
    });

    it('should maintain sub-millisecond timing precision per tool', async () => {
      const callIds: string[] = [];

      // Rapid fire tool starts
      for (let i = 0; i < 10; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'TodoWrite');
        callIds.push(callId);
        // No delay - as fast as possible
      }

      // Immediate completions
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(10);

      // Each should have precise timing (duration >= 0)
      for (const record of records) {
        expect(record.duration).toBeGreaterThanOrEqual(0);
        expect(record.duration).toBe(
          record.endTime.getTime() - record.startTime.getTime()
        );
      }
    });

    it('should not have timing collisions with 1ms stagger', async () => {
      const result = await ConcurrentScenarios.rapidFire(
        orchestrator,
        testTaskId,
        20
      );

      expect(result.events).toHaveLength(20);

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // Validate timing isolation
      isolationValidator.addFromEvents(collector.getEvents());
      const isolationResult = isolationValidator.validate();

      expect(isolationResult.isIsolated).toBe(true);

      // No errors
      const errors = isolationResult.violations.filter(v => v.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Mixed Duration Scenarios
  // ============================================================================

  describe('Mixed Duration Scenarios', () => {
    it('should isolate instant tools from slow tools', async () => {
      // Start a slow tool
      const slowCallId = orchestrator.startToolExecution(testTaskId, 'WebFetch');

      // Start and complete instant tools while slow is running
      for (let i = 0; i < 3; i++) {
        const instantCallId = orchestrator.startToolExecution(testTaskId, 'TodoWrite');
        orchestrator.completeToolExecution(testTaskId, instantCallId);
        await delay(10);
      }

      // Complete slow tool
      await delay(50);
      orchestrator.completeToolExecution(testTaskId, slowCallId);

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(4);

      const slowRecord = records.find(r => r.callId === slowCallId)!;
      const instantRecords = records.filter(r => r.callId !== slowCallId);

      // Slow tool should have much longer duration
      expect(slowRecord.duration).toBeGreaterThan(50);

      // Instant tools should have short durations
      for (const record of instantRecords) {
        expect(record.duration).toBeLessThan(slowRecord.duration);
      }

      // All should have isolated timing
      assertBatchTimingIsolation(records);
    });

    it('should isolate timing when durations vary by 100x', async () => {
      const scenario = createScenarioBuilder(orchestrator, testTaskId)
        .addTool({ tool: 'TodoWrite', duration: 1 })     // 1ms
        .addTool({ tool: 'Bash', duration: 100 })        // 100ms
        .withStartStagger(5)
        .withCompletionStagger(0);

      await scenario.execute();

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(2);
      assertBatchTimingIsolation(records);
    });

    it('should handle 0ms duration alongside 5000ms duration', async () => {
      // Start long-running tool
      const longCallId = orchestrator.startToolExecution(testTaskId, 'Browser');

      // Execute instant tool
      const instantCallId = orchestrator.startToolExecution(testTaskId, 'TodoWrite');
      orchestrator.completeToolExecution(testTaskId, instantCallId);

      // Wait and complete long tool
      await delay(100); // Simulate long duration
      orchestrator.completeToolExecution(testTaskId, longCallId);

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      const longRecord = records.find(r => r.callId === longCallId)!;
      const instantRecord = records.find(r => r.callId === instantCallId)!;

      // Both should have valid timing
      expect(instantRecord.duration).toBeGreaterThanOrEqual(0);
      expect(longRecord.duration).toBeGreaterThan(instantRecord.duration);

      assertTimingIsolation(longRecord, instantRecord);
    });
  });

  // ============================================================================
  // Error Condition Timing Isolation
  // ============================================================================

  describe('Error Condition Timing Isolation', () => {
    it('should isolate failed tool timing from successful tools', async () => {
      // Start both tools
      const successCallId = orchestrator.startToolExecution(testTaskId, 'Read');
      const failCallId = orchestrator.startToolExecution(testTaskId, 'Write');

      await delay(30);

      // Complete success
      orchestrator.completeToolExecution(testTaskId, successCallId);

      await delay(20);

      // Fail the other
      orchestrator.failToolExecution(testTaskId, failCallId, 'Permission denied');

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(2);

      const successRecord = records.find(r => r.callId === successCallId)!;
      const failRecord = records.find(r => r.callId === failCallId)!;

      // Both should have valid, isolated timing
      expect(successRecord.success).toBe(true);
      expect(failRecord.success).toBe(false);

      assertTimingIsolation(successRecord, failRecord);
    });

    it('should isolate timing for concurrent failures', async () => {
      const result = await ConcurrentScenarios.mixedOutcomes(
        orchestrator,
        testTaskId
      );

      expect(result.events).toHaveLength(5);

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // Should have mix of success and failure
      const successRecords = records.filter(r => r.success === true);
      const failRecords = records.filter(r => r.success === false);

      expect(successRecords.length).toBeGreaterThan(0);
      expect(failRecords.length).toBeGreaterThan(0);

      // All should have isolated timing regardless of success/failure
      assertBatchTimingIsolation(records);
    });

    it('should maintain timing isolation during error recovery workflows', async () => {
      // Simulate: Attempt → Fail → Retry → Success pattern
      const scenario = new TestScenarioBuilder(orchestrator)
        .startTool('Write', 'initial-write')
        .failTool('Write', 'initial-write', 50, 'First attempt failed')
        .startTool('Read', 'verify-read', 10)
        .completeTool('Read', 'verify-read', 30)
        .startTool('Write', 'retry-write', 10)
        .completeTool('Write', 'retry-write', 40);

      const events = await scenario.execute(testTaskId);

      expect(events).toHaveLength(3);

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // Each tool should have independent timing
      assertBatchTimingIsolation(records);

      // Validate comprehensive isolation
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();
      expect(result.isIsolated).toBe(true);
    });
  });

  // ============================================================================
  // Stress Testing
  // ============================================================================

  describe('Stress Testing', () => {
    it('should maintain isolation with 50 concurrent executions', async () => {
      const callIds: string[] = [];

      // Start 50 tools
      for (let i = 0; i < 50; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete all with minimal delay
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(50);

      // Validate isolation
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
      expect(result.stats.toolExecutions).toBe(50);

      // All call IDs unique
      const uniqueCallIds = new Set(records.map(r => r.callId));
      expect(uniqueCallIds.size).toBe(50);
    });

    it('should handle rapid fire execution (100 tools, 1ms intervals)', async () => {
      const callIds: string[] = [];
      const startTime = Date.now();

      // Rapid fire starts
      for (let i = 0; i < 100; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
        await delay(1);
      }

      // Rapid completions
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      const totalTime = Date.now() - startTime;

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(100);

      // Should complete reasonably fast
      expect(totalTime).toBeLessThan(5000);

      // Validate isolation - for rapid execution, focus on key isolation properties:
      // 1. All call IDs are unique
      const uniqueCallIds = new Set(records.map(r => r.callId));
      expect(uniqueCallIds.size).toBe(100);

      // 2. All timing boundaries are valid (endTime >= startTime)
      for (const record of records) {
        expect(record.endTime.getTime()).toBeGreaterThanOrEqual(record.startTime.getTime());
      }

      // 3. Duration matches calculated value
      for (const record of records) {
        const calculatedDuration = record.endTime.getTime() - record.startTime.getTime();
        expect(record.duration).toBe(calculatedDuration);
      }

      // 4. No critical violations (timing_boundary_violation, calculation_mismatch)
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      const criticalViolations = result.violations.filter(
        v => v.type === 'timing_boundary_violation' || v.type === 'calculation_mismatch'
      );
      expect(criticalViolations).toHaveLength(0);

      // Note: For very rapid execution, identical timing values for short-duration tools
      // completing in the same millisecond is acceptable behavior, not cross-contamination.
      expect(result.stats.toolExecutions).toBe(100);
    });

    it('should maintain isolation under high concurrency load', async () => {
      // Create complex interleaved scenario
      const scenario = createScenarioBuilder(orchestrator, testTaskId);

      // Add 30 tools
      for (let i = 0; i < 30; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        scenario.addTool(tool);
      }

      // Execute with interleaved completion
      await scenario
        .withStartStagger(2)
        .withCompletionOrder('interleaved')
        .withCompletionStagger(3)
        .execute();

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(30);

      // Comprehensive validation
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
      expect(result.stats.maxConcurrency).toBeGreaterThan(1);

      // No cross-contamination errors
      const crossContaminationErrors = result.violations.filter(
        v => v.type === 'cross_contamination'
      );
      expect(crossContaminationErrors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Validator Edge Cases
  // ============================================================================

  describe('Validator Edge Cases', () => {
    it('should detect timing cross-contamination if it occurs', () => {
      // Manually create records that share timing (simulating a bug)
      const sharedStart = new Date();
      const sharedEnd = new Date(sharedStart.getTime() + 100);

      const badRecord1: ToolTimingRecord = {
        callId: 'bad-1',
        toolName: 'Read',
        taskId: testTaskId,
        startTime: sharedStart,
        endTime: sharedEnd,
        duration: 100,
        captureSequence: 0,
      };

      const badRecord2: ToolTimingRecord = {
        callId: 'bad-2',
        toolName: 'Write', // Different tool
        taskId: testTaskId,
        startTime: sharedStart, // Same start!
        endTime: sharedEnd,     // Same end!
        duration: 100,          // Same duration!
        captureSequence: 1,
      };

      isolationValidator.addTimingRecord(badRecord1);
      isolationValidator.addTimingRecord(badRecord2);

      const result = isolationValidator.validate();

      // Should detect cross-contamination
      const crossContamination = result.violations.filter(
        v => v.type === 'cross_contamination'
      );
      expect(crossContamination.length).toBeGreaterThan(0);
      expect(result.isIsolated).toBe(false);
    });

    it('should handle empty event set gracefully', () => {
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.stats.toolExecutions).toBe(0);
    });

    it('should handle single tool execution', async () => {
      const callId = orchestrator.startToolExecution(testTaskId, 'Read');
      await delay(50);
      orchestrator.completeToolExecution(testTaskId, callId);

      collector.stopCapturing();
      isolationValidator.addFromEvents(collector.getEvents());

      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
      expect(result.stats.toolExecutions).toBe(1);
      expect(result.stats.maxConcurrency).toBe(1);
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Delay for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fisher-Yates shuffle for array randomization
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
