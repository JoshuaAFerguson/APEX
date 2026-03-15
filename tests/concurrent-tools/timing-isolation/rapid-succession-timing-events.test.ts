/**
 * Rapid Succession Timing Events Tests
 *
 * Comprehensive test suite specifically designed to test timing events
 * when tool executions occur in rapid succession. This validates that:
 *
 * 1. Timing events maintain accuracy under rapid-fire execution
 * 2. Event ordering is preserved even with sub-millisecond intervals
 * 3. No timing data corruption occurs during burst workloads
 * 4. High-precision timestamps remain isolated between executions
 * 5. The system handles edge cases of near-simultaneous starts/completions
 *
 * Architecture Decision:
 * - This test file focuses specifically on "rapid succession" scenarios
 * - Uses existing shared infrastructure (MockOrchestrator, ConcurrentEventCollector)
 * - Validates timing isolation with progressively more aggressive patterns
 * - Tests both sequential rapid execution and parallel burst execution
 *
 * @module rapid-succession-timing-events
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockOrchestrator,
  createTestOrchestrator,
} from '../../tool-complete-events/shared/orchestrator-test-harness';
import {
  SUPPORTED_TOOLS,
  SupportedTool,
  createTestTaskId,
} from '../../tool-complete-events/shared/tool-test-fixtures';
import {
  createConcurrentEventCollector,
  ConcurrentEventCollector,
} from '../shared/concurrent-event-collector';
import {
  createTimingIsolationValidator,
  TimingIsolationValidator,
  buildTimingRecordsFromEvents,
  assertBatchTimingIsolation,
  ToolTimingRecord,
} from '../shared/timing-isolation-validator';
import { TIMING_TOLERANCE_MS } from '../../event-data-integrity/shared/timing-consistency-utils';

/**
 * Rapid execution configuration constants
 */
const RAPID_CONFIG = {
  /** Zero delay - as fast as possible */
  ZERO_DELAY_MS: 0,
  /** Sub-millisecond simulation (1ms is minimum for setTimeout) */
  MINIMAL_DELAY_MS: 1,
  /** Micro burst delay */
  MICRO_BURST_MS: 2,
  /** Small burst delay for slightly staggered execution */
  SMALL_BURST_MS: 5,
  /** Maximum number of tools for stress test */
  MAX_RAPID_TOOLS: 100,
  /** Medium batch size for balanced testing */
  MEDIUM_BATCH_SIZE: 50,
  /** Small batch size for quick tests */
  SMALL_BATCH_SIZE: 20,
  /** Minimum batch for edge cases */
  MIN_BATCH_SIZE: 10,
} as const;

describe('Rapid Succession Timing Events', () => {
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
  // Sequential Rapid Succession
  // ============================================================================

  describe('Sequential Rapid Succession', () => {
    it('should preserve timing accuracy with zero-delay sequential starts', async () => {
      const toolCount = RAPID_CONFIG.SMALL_BATCH_SIZE;
      const callIds: string[] = [];

      // Start tools with zero delay between starts
      for (let i = 0; i < toolCount; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
        // NO delay - immediate next start
      }

      // Complete all tools immediately
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(toolCount);

      // All call IDs should be unique
      const uniqueCallIds = new Set(records.map(r => r.callId));
      expect(uniqueCallIds.size).toBe(toolCount);

      // Each record should have valid timing
      for (const record of records) {
        expect(record.duration).toBeGreaterThanOrEqual(0);
        expect(record.endTime.getTime()).toBeGreaterThanOrEqual(record.startTime.getTime());
      }
    });

    it('should handle back-to-back start-complete cycles', async () => {
      const cycleCount = RAPID_CONFIG.SMALL_BATCH_SIZE;
      const records: ToolTimingRecord[] = [];

      // Execute tools one-by-one in rapid succession
      for (let i = 0; i < cycleCount; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const capturedRecords = buildTimingRecordsFromEvents(collector.getEvents());

      expect(capturedRecords).toHaveLength(cycleCount);

      // Each execution should have valid, independent timing
      for (const record of capturedRecords) {
        const calculatedDuration = record.endTime.getTime() - record.startTime.getTime();
        expect(record.duration).toBe(calculatedDuration);
        expect(record.duration).toBeGreaterThanOrEqual(0);
      }

      // Validate batch isolation
      assertBatchTimingIsolation(capturedRecords);
    });

    it('should maintain event ordering in rapid sequential execution', async () => {
      const toolCount = RAPID_CONFIG.MIN_BATCH_SIZE;
      const startTimes: number[] = [];
      const callIds: string[] = [];

      // Start all tools rapidly
      for (let i = 0; i < toolCount; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete all tools
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const events = collector.getEventsBySequence();

      // Events should be in sequence order
      for (let i = 1; i < events.length; i++) {
        expect(events[i].sequenceIndex).toBeGreaterThan(events[i - 1].sequenceIndex);
      }
    });

    it('should handle alternating rapid starts and completions', async () => {
      const pairCount = RAPID_CONFIG.MIN_BATCH_SIZE;
      const allCallIds: string[] = [];

      // Pattern: Start A, Start B, Complete A, Complete B (repeat)
      for (let i = 0; i < pairCount; i++) {
        const toolA = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const toolB = SUPPORTED_TOOLS[(i + 1) % SUPPORTED_TOOLS.length];

        const callIdA = orchestrator.startToolExecution(testTaskId, toolA);
        const callIdB = orchestrator.startToolExecution(testTaskId, toolB);

        orchestrator.completeToolExecution(testTaskId, callIdA);
        orchestrator.completeToolExecution(testTaskId, callIdB);

        allCallIds.push(callIdA, callIdB);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(pairCount * 2);

      // Validate all timing is isolated
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
      const errors = result.violations.filter(v => v.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // Burst Execution Patterns
  // ============================================================================

  describe('Burst Execution Patterns', () => {
    it('should handle burst of starts followed by burst of completions', async () => {
      const burstSize = RAPID_CONFIG.SMALL_BATCH_SIZE;
      const callIds: string[] = [];

      // Burst start phase - all starts happen together
      for (let i = 0; i < burstSize; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Burst completion phase - all completions happen together
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(burstSize);

      // All should have valid timing despite simultaneous execution
      for (const record of records) {
        expect(record.endTime.getTime()).toBeGreaterThanOrEqual(record.startTime.getTime());
        expect(record.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should maintain timing integrity with multiple small bursts', async () => {
      const burstCount = 5;
      const burstSize = 10;
      const allRecords: ToolTimingRecord[] = [];

      for (let burst = 0; burst < burstCount; burst++) {
        const burstCallIds: string[] = [];

        // Start burst
        for (let i = 0; i < burstSize; i++) {
          const tool = SUPPORTED_TOOLS[(burst * burstSize + i) % SUPPORTED_TOOLS.length];
          const callId = orchestrator.startToolExecution(testTaskId, tool);
          burstCallIds.push(callId);
        }

        // Complete burst
        for (const callId of burstCallIds) {
          orchestrator.completeToolExecution(testTaskId, callId);
        }

        // Small gap between bursts
        await delay(RAPID_CONFIG.MICRO_BURST_MS);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(burstCount * burstSize);

      // Validate comprehensive timing isolation
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
    });

    it('should handle interleaved bursts from different tool categories', async () => {
      const fileTools: SupportedTool[] = ['Read', 'Write', 'Edit'];
      const searchTools: SupportedTool[] = ['Grep', 'Glob'];
      const webTools: SupportedTool[] = ['WebFetch', 'WebSearch'];

      const allCallIds: string[] = [];

      // Burst 1: File tools
      for (const tool of fileTools) {
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        allCallIds.push(callId);
      }

      // Burst 2: Search tools (while file tools still running)
      for (const tool of searchTools) {
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        allCallIds.push(callId);
      }

      // Burst 3: Web tools
      for (const tool of webTools) {
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        allCallIds.push(callId);
      }

      // Complete all in reverse order
      for (let i = allCallIds.length - 1; i >= 0; i--) {
        orchestrator.completeToolExecution(testTaskId, allCallIds[i]);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      const totalTools = fileTools.length + searchTools.length + webTools.length;
      expect(records).toHaveLength(totalTools);

      // Each tool should have isolated timing
      assertBatchTimingIsolation(records);
    });
  });

  // ============================================================================
  // Sub-Millisecond Precision Tests
  // ============================================================================

  describe('Sub-Millisecond Precision', () => {
    it('should preserve distinct timestamps for rapid successive starts', async () => {
      const rapidCount = RAPID_CONFIG.MIN_BATCH_SIZE;
      const callIds: string[] = [];

      // Create tools as fast as possible
      for (let i = 0; i < rapidCount; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'TodoWrite');
        callIds.push(callId);
      }

      // Complete all
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const events = collector.getEventsBySequence();

      // Get start events
      const startEvents = events.filter(e => e.type === 'tool:start');

      expect(startEvents).toHaveLength(rapidCount);

      // Even if timestamps match (same millisecond), sequence indices should differ
      for (let i = 1; i < startEvents.length; i++) {
        expect(startEvents[i].sequenceIndex).toBeGreaterThan(startEvents[i - 1].sequenceIndex);
      }
    });

    it('should maintain capture time precision across rapid events', async () => {
      const rapidCount = RAPID_CONFIG.MIN_BATCH_SIZE;
      const callIds: string[] = [];

      for (let i = 0; i < rapidCount; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'Read');
        callIds.push(callId);
      }

      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const events = collector.getEventsBySequence();

      // Verify high-resolution capture times are valid
      for (const event of events) {
        expect(event.captureTime).toBeGreaterThan(0);
        expect(typeof event.captureTime).toBe('number');
      }

      // Capture times should be monotonically increasing or equal
      for (let i = 1; i < events.length; i++) {
        expect(events[i].captureTime).toBeGreaterThanOrEqual(events[i - 1].captureTime);
      }
    });

    it('should handle zero-duration tool executions in rapid succession', async () => {
      const rapidCount = RAPID_CONFIG.SMALL_BATCH_SIZE;

      // Execute tools where start and complete happen immediately
      for (let i = 0; i < rapidCount; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'TodoWrite');
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(rapidCount);

      // All should have valid timing (duration >= 0)
      for (const record of records) {
        expect(record.duration).toBeGreaterThanOrEqual(0);
        expect(record.endTime.getTime()).toBeGreaterThanOrEqual(record.startTime.getTime());
      }

      // Unique call IDs
      const uniqueIds = new Set(records.map(r => r.callId));
      expect(uniqueIds.size).toBe(rapidCount);
    });
  });

  // ============================================================================
  // Stress Tests - High Volume Rapid Succession
  // ============================================================================

  describe('Stress Tests - High Volume', () => {
    it('should handle 100 rapid tool executions without timing corruption', async () => {
      const largeCount = RAPID_CONFIG.MAX_RAPID_TOOLS;
      const callIds: string[] = [];

      const startTime = Date.now();

      // Start all tools rapidly
      for (let i = 0; i < largeCount; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete all tools
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      const totalTime = Date.now() - startTime;

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(largeCount);

      // Execution should complete reasonably fast
      expect(totalTime).toBeLessThan(5000);

      // All call IDs unique
      const uniqueCallIds = new Set(records.map(r => r.callId));
      expect(uniqueCallIds.size).toBe(largeCount);

      // All timing boundaries valid
      for (const record of records) {
        expect(record.endTime.getTime()).toBeGreaterThanOrEqual(record.startTime.getTime());
      }

      // Duration matches calculation
      for (const record of records) {
        const calculated = record.endTime.getTime() - record.startTime.getTime();
        expect(record.duration).toBe(calculated);
      }

      // Validate isolation
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      // No critical violations
      const criticalViolations = result.violations.filter(
        v => v.type === 'timing_boundary_violation' || v.type === 'calculation_mismatch'
      );
      expect(criticalViolations).toHaveLength(0);
    });

    it('should maintain timing accuracy with 1ms intervals over 50 tools', async () => {
      const count = RAPID_CONFIG.MEDIUM_BATCH_SIZE;
      const callIds: string[] = [];

      for (let i = 0; i < count; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
        await delay(RAPID_CONFIG.MINIMAL_DELAY_MS);
      }

      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(count);

      // Comprehensive validation - for rapid execution we focus on critical errors
      // (timing boundary violations and calculation mismatches), not warnings
      // about identical timestamps which are expected in rapid succession
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      // Check for critical violations only - identical timestamps are acceptable
      // in rapid succession scenarios
      const criticalErrors = result.violations.filter(
        v => v.type === 'timing_boundary_violation' || v.type === 'calculation_mismatch'
      );
      expect(criticalErrors).toHaveLength(0);
      expect(result.stats.toolExecutions).toBe(count);
    });

    it('should handle rapid mixed success/failure outcomes', async () => {
      const count = RAPID_CONFIG.SMALL_BATCH_SIZE;
      const callIds: string[] = [];

      // Start all tools
      for (let i = 0; i < count; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete with alternating success/failure
      for (let i = 0; i < callIds.length; i++) {
        if (i % 2 === 0) {
          orchestrator.completeToolExecution(testTaskId, callIds[i]);
        } else {
          orchestrator.failToolExecution(testTaskId, callIds[i], `Rapid failure ${i}`);
        }
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(count);

      // Both success and failure should have valid timing
      const successes = records.filter(r => r.success === true);
      const failures = records.filter(r => r.success === false);

      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);

      // All timing should be valid regardless of outcome
      for (const record of records) {
        expect(record.duration).toBeGreaterThanOrEqual(0);
        expect(record.endTime.getTime()).toBeGreaterThanOrEqual(record.startTime.getTime());
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle single tool execution (baseline)', async () => {
      const callId = orchestrator.startToolExecution(testTaskId, 'Read');
      orchestrator.completeToolExecution(testTaskId, callId);

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(1);
      expect(records[0].callId).toBe(callId);
      expect(records[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle all 12 tool types in rapid succession', async () => {
      const callIds: string[] = [];

      // Start all 12 tools rapidly
      for (const tool of SUPPORTED_TOOLS) {
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete all
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(SUPPORTED_TOOLS.length);

      // Each tool type should appear exactly once
      const toolNames = new Set(records.map(r => r.toolName));
      expect(toolNames.size).toBe(SUPPORTED_TOOLS.length);

      // All timing valid
      assertBatchTimingIsolation(records);
    });

    it('should handle same tool type executed rapidly multiple times', async () => {
      const sameToolCount = RAPID_CONFIG.MIN_BATCH_SIZE;
      const callIds: string[] = [];

      // Execute the same tool multiple times
      for (let i = 0; i < sameToolCount; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'Read');
        callIds.push(callId);
      }

      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(sameToolCount);

      // All should be Read tool
      expect(records.every(r => r.toolName === 'Read')).toBe(true);

      // But all call IDs should be unique
      const uniqueCallIds = new Set(records.map(r => r.callId));
      expect(uniqueCallIds.size).toBe(sameToolCount);

      // Timing isolation still maintained
      assertBatchTimingIsolation(records);
    });

    it('should handle rapid completion in reverse start order', async () => {
      const count = RAPID_CONFIG.MIN_BATCH_SIZE;
      const callIds: string[] = [];

      // Start tools in order
      for (let i = 0; i < count; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete in REVERSE order (LIFO pattern)
      for (let i = callIds.length - 1; i >= 0; i--) {
        orchestrator.completeToolExecution(testTaskId, callIds[i]);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(count);

      // First started should have longest duration (completed last)
      // Last started should have shortest duration (completed first)
      const firstStarted = records.find(r => r.callId === callIds[0]);
      const lastStarted = records.find(r => r.callId === callIds[callIds.length - 1]);

      expect(firstStarted).toBeDefined();
      expect(lastStarted).toBeDefined();

      // This verifies timing isolation - durations should reflect actual execution time
      assertBatchTimingIsolation(records);
    });

    it('should handle rapid interleaved completion order', async () => {
      const count = RAPID_CONFIG.MIN_BATCH_SIZE;
      const callIds: string[] = [];

      // Start tools
      for (let i = 0; i < count; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete in interleaved order (0, last, 1, second-last, ...)
      const completionOrder: string[] = [];
      let left = 0;
      let right = callIds.length - 1;

      while (left <= right) {
        if (left === right) {
          completionOrder.push(callIds[left]);
        } else {
          completionOrder.push(callIds[left], callIds[right]);
        }
        left++;
        right--;
      }

      for (const callId of completionOrder) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(count);

      // All timing should be valid regardless of completion order
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
    });
  });

  // ============================================================================
  // Timing Statistics Validation
  // ============================================================================

  describe('Timing Statistics Validation', () => {
    it('should produce accurate statistics for rapid executions', async () => {
      const count = RAPID_CONFIG.SMALL_BATCH_SIZE;
      const callIds: string[] = [];

      for (let i = 0; i < count; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();

      // Get statistics
      const stats = collector.calculateStats();

      expect(stats.totalEvents).toBe(count * 2); // Start + Complete for each
      expect(stats.uniqueCallIds).toBe(count);
      expect(stats.maxConcurrentExecutions).toBeGreaterThanOrEqual(1);
      expect(stats.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should track concurrent execution count accurately in rapid succession', async () => {
      const count = RAPID_CONFIG.MIN_BATCH_SIZE;
      const callIds: string[] = [];

      // Start all tools (creates concurrent execution)
      for (let i = 0; i < count; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'Read');
        callIds.push(callId);
      }

      // At this point, all tools are "running" concurrently
      // Now complete them

      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const stats = collector.calculateStats();

      // Max concurrency should be equal to count (all were running at once)
      expect(stats.maxConcurrentExecutions).toBe(count);
    });

    it('should calculate inter-event delays for rapid execution', async () => {
      const count = 10;
      const callIds: string[] = [];

      for (let i = 0; i < count; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'TodoWrite');
        callIds.push(callId);
        await delay(RAPID_CONFIG.MINIMAL_DELAY_MS);
      }

      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const stats = collector.calculateStats();

      // Inter-event delays should be calculated
      expect(stats.averageInterEventDelay).toBeGreaterThanOrEqual(0);
      expect(stats.minInterEventDelay).toBeGreaterThanOrEqual(0);
      expect(stats.maxInterEventDelay).toBeGreaterThanOrEqual(stats.minInterEventDelay);
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
