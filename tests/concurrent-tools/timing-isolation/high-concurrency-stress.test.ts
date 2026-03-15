/**
 * High Concurrency Stress Tests for Timing Events
 *
 * This test suite validates timing event integrity under extreme concurrency
 * conditions as specified in ADR-0015.
 *
 * Test Categories:
 * 1. Extreme Burst Scenarios - 200+ simultaneous tool executions
 * 2. Sustained Load Scenarios - Maintain high concurrency over time
 * 3. Chaos Scenarios - Random interleaving and unpredictable patterns
 * 4. Resource Limit Scenarios - Test system limits
 * 5. Timing Precision Validation - High-resolution accuracy at scale
 *
 * @module high-concurrency-stress
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
 * High concurrency stress test configuration
 */
const STRESS_CONFIG = {
  // Extreme burst scenarios
  EXTREME_BURST_SIZE: 200,
  LARGE_BURST_SIZE: 100,
  MEDIUM_BURST_SIZE: 50,

  // Sustained load scenarios
  SUSTAINED_CONCURRENCY: 50,
  SUSTAINED_DURATION_MS: 5000,

  // Chaos scenarios
  CHAOS_OPERATIONS: 100,

  // Timing constraints
  MAX_TEST_DURATION_MS: 10000,
  TIMING_TOLERANCE_MS: 50,

  // Intervals
  ZERO_DELAY: 0,
  MICRO_DELAY: 1,
  SMALL_DELAY: 5,
} as const;

describe('High Concurrency Stress Tests', () => {
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
  // Extreme Burst Scenarios
  // ============================================================================

  describe('Extreme Burst Scenarios', () => {
    it('should handle 200 simultaneous tool starts without timing violations', async () => {
      const burstSize = STRESS_CONFIG.EXTREME_BURST_SIZE;
      const callIds: string[] = [];
      const startTime = Date.now();

      // Burst start - all tools start as fast as possible
      for (let i = 0; i < burstSize; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
        // NO delay - maximum burst stress
      }

      // Complete all tools
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      const totalTime = Date.now() - startTime;

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // Assertions
      expect(records).toHaveLength(burstSize);
      expect(totalTime).toBeLessThan(STRESS_CONFIG.MAX_TEST_DURATION_MS);

      // All call IDs must be unique
      const uniqueCallIds = new Set(records.map(r => r.callId));
      expect(uniqueCallIds.size).toBe(burstSize);

      // All timing boundaries must be valid
      for (const record of records) {
        expect(record.endTime.getTime()).toBeGreaterThanOrEqual(record.startTime.getTime());
        expect(record.duration).toBeGreaterThanOrEqual(0);
      }

      // Duration calculations must be accurate
      for (const record of records) {
        const calculatedDuration = record.endTime.getTime() - record.startTime.getTime();
        expect(record.duration).toBe(calculatedDuration);
      }

      // Validate using comprehensive validator
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      // No critical violations (boundary and calculation errors)
      const criticalViolations = result.violations.filter(
        v => v.type === 'timing_boundary_violation' || v.type === 'calculation_mismatch'
      );
      expect(criticalViolations).toHaveLength(0);

      // Log stats for visibility
      expect(result.stats.toolExecutions).toBe(burstSize);
      expect(result.stats.maxConcurrency).toBeGreaterThanOrEqual(1);
    });

    it('should handle zero-delay burst completions with valid timing', async () => {
      const burstSize = STRESS_CONFIG.LARGE_BURST_SIZE;
      const callIds: string[] = [];

      // Start all tools
      for (let i = 0; i < burstSize; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Burst completion - all complete as fast as possible
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
        // NO delay between completions
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(burstSize);

      // Verify timing integrity
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      const criticalErrors = result.violations.filter(v => v.severity === 'error');
      expect(criticalErrors.filter(e =>
        e.type === 'timing_boundary_violation' || e.type === 'calculation_mismatch'
      )).toHaveLength(0);
    });

    it('should handle mixed tool type distribution under burst load', async () => {
      const burstSize = STRESS_CONFIG.LARGE_BURST_SIZE;
      const toolCounts = new Map<SupportedTool, number>();
      const callIds: string[] = [];

      // Track tool distribution
      for (let i = 0; i < burstSize; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete all
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(burstSize);

      // Verify all tool types are represented
      const recordedToolTypes = new Set(records.map(r => r.toolName));
      expect(recordedToolTypes.size).toBe(SUPPORTED_TOOLS.length);

      // Validate timing isolation
      assertBatchTimingIsolation(records);
    });

    it('should handle multiple bursts in succession', async () => {
      const burstCount = 5;
      const burstSize = STRESS_CONFIG.MEDIUM_BURST_SIZE;
      const allCallIds: string[] = [];

      for (let burst = 0; burst < burstCount; burst++) {
        const burstCallIds: string[] = [];

        // Start burst
        for (let i = 0; i < burstSize; i++) {
          const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
          const callId = orchestrator.startToolExecution(testTaskId, tool);
          burstCallIds.push(callId);
        }

        // Complete burst
        for (const callId of burstCallIds) {
          orchestrator.completeToolExecution(testTaskId, callId);
        }

        allCallIds.push(...burstCallIds);

        // Small gap between bursts
        await delay(STRESS_CONFIG.SMALL_DELAY);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(burstCount * burstSize);

      // Validate comprehensive timing isolation
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
    });
  });

  // ============================================================================
  // Sustained Load Scenarios
  // ============================================================================

  describe('Sustained Load Scenarios', () => {
    it('should maintain timing accuracy with sustained 50 concurrent tools', async () => {
      const targetConcurrency = STRESS_CONFIG.SUSTAINED_CONCURRENCY;
      const testDuration = 2000; // 2 seconds for test performance
      const startTime = Date.now();
      let completedCount = 0;

      const activeCallIds: string[] = [];

      // Start initial batch to reach target concurrency
      for (let i = 0; i < targetConcurrency; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        activeCallIds.push(callId);
      }

      // Maintain concurrency for duration
      while (Date.now() - startTime < testDuration) {
        // Complete oldest tool
        if (activeCallIds.length > 0) {
          const callIdToComplete = activeCallIds.shift()!;
          orchestrator.completeToolExecution(testTaskId, callIdToComplete);
          completedCount++;

          // Start new tool to maintain concurrency
          const tool = SUPPORTED_TOOLS[completedCount % SUPPORTED_TOOLS.length];
          const newCallId = orchestrator.startToolExecution(testTaskId, tool);
          activeCallIds.push(newCallId);
        }

        await delay(STRESS_CONFIG.MICRO_DELAY);
      }

      // Complete remaining tools
      for (const callId of activeCallIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
        completedCount++;
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // Verify we processed many tools
      expect(records.length).toBeGreaterThan(targetConcurrency);

      // Validate timing didn't drift
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      const criticalViolations = result.violations.filter(
        v => v.type === 'timing_boundary_violation' || v.type === 'calculation_mismatch'
      );
      expect(criticalViolations).toHaveLength(0);

      // Verify high concurrency was achieved
      expect(result.stats.maxConcurrency).toBeGreaterThanOrEqual(targetConcurrency - 5);
    });

    it('should handle steady stream of starts and completions', async () => {
      const streamDuration = 1000; // 1 second
      const operationsPerSecond = 50;
      const delayBetweenOps = Math.floor(1000 / operationsPerSecond);

      const startTime = Date.now();
      const pendingCallIds: string[] = [];
      let operationCount = 0;

      while (Date.now() - startTime < streamDuration) {
        const tool = SUPPORTED_TOOLS[operationCount % SUPPORTED_TOOLS.length];

        // Alternate: start or complete
        if (operationCount % 2 === 0 || pendingCallIds.length === 0) {
          const callId = orchestrator.startToolExecution(testTaskId, tool);
          pendingCallIds.push(callId);
        } else {
          const callIdToComplete = pendingCallIds.shift()!;
          orchestrator.completeToolExecution(testTaskId, callIdToComplete);
        }

        operationCount++;
        await delay(delayBetweenOps);
      }

      // Complete all pending
      for (const callId of pendingCallIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // Verify processed tools
      expect(records.length).toBeGreaterThan(0);

      // Validate timing stability
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
    });

    it('should verify no timing drift under continuous load', async () => {
      const iterations = 50;
      const durationsByIteration: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const callId = orchestrator.startToolExecution(
          testTaskId,
          SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length]
        );
        await delay(STRESS_CONFIG.SMALL_DELAY);
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(iterations);

      // Check for timing drift - all should be within tolerance of expected
      for (const record of records) {
        expect(record.duration).toBeGreaterThanOrEqual(STRESS_CONFIG.SMALL_DELAY - 10);
        expect(record.duration).toBeLessThan(STRESS_CONFIG.SMALL_DELAY * 5);
      }

      // Validate comprehensive isolation
      assertBatchTimingIsolation(records);
    });
  });

  // ============================================================================
  // Chaos Scenarios
  // ============================================================================

  describe('Chaos Scenarios', () => {
    it('should handle random start/complete interleaving', async () => {
      const operationCount = STRESS_CONFIG.CHAOS_OPERATIONS;
      const activeCallIds: string[] = [];
      const completedCallIds: string[] = [];

      for (let i = 0; i < operationCount; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];

        // Random decision: start new or complete existing
        const shouldStart = activeCallIds.length === 0 ||
          (activeCallIds.length < 20 && Math.random() > 0.3);

        if (shouldStart) {
          const callId = orchestrator.startToolExecution(testTaskId, tool);
          activeCallIds.push(callId);
        } else {
          // Complete a random active tool
          const randomIndex = Math.floor(Math.random() * activeCallIds.length);
          const callIdToComplete = activeCallIds.splice(randomIndex, 1)[0];
          orchestrator.completeToolExecution(testTaskId, callIdToComplete);
          completedCallIds.push(callIdToComplete);
        }
      }

      // Complete remaining
      for (const callId of activeCallIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
        completedCallIds.push(callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // All completed tools should have valid timing
      expect(records.length).toBe(completedCallIds.length);

      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      const criticalViolations = result.violations.filter(
        v => v.type === 'timing_boundary_violation' || v.type === 'calculation_mismatch'
      );
      expect(criticalViolations).toHaveLength(0);
    });

    it('should handle random failures mixed with successes under load', async () => {
      const toolCount = STRESS_CONFIG.MEDIUM_BURST_SIZE;
      const callIds: string[] = [];

      // Start all tools
      for (let i = 0; i < toolCount; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete with random success/failure
      for (let i = 0; i < callIds.length; i++) {
        const shouldFail = Math.random() > 0.7; // 30% failure rate

        if (shouldFail) {
          orchestrator.failToolExecution(testTaskId, callIds[i], `Chaos failure ${i}`);
        } else {
          orchestrator.completeToolExecution(testTaskId, callIds[i]);
        }
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(toolCount);

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

    it('should handle random completion order without timing corruption', async () => {
      const toolCount = STRESS_CONFIG.MEDIUM_BURST_SIZE;
      const callIds: string[] = [];

      // Start all tools in order
      for (let i = 0; i < toolCount; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Shuffle completion order
      const shuffledCallIds = shuffleArray([...callIds]);

      // Complete in random order
      for (const callId of shuffledCallIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(toolCount);

      // Validate timing isolation
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
    });

    it('should handle ABBA pattern under high concurrency', async () => {
      const pairCount = 25; // 50 tools total
      const allCallIds: string[] = [];

      for (let i = 0; i < pairCount; i++) {
        const toolA = SUPPORTED_TOOLS[(i * 2) % SUPPORTED_TOOLS.length];
        const toolB = SUPPORTED_TOOLS[(i * 2 + 1) % SUPPORTED_TOOLS.length];

        // ABBA: Start A, Start B, Complete B, Complete A
        const callIdA = orchestrator.startToolExecution(testTaskId, toolA);
        const callIdB = orchestrator.startToolExecution(testTaskId, toolB);

        orchestrator.completeToolExecution(testTaskId, callIdB);
        orchestrator.completeToolExecution(testTaskId, callIdA);

        allCallIds.push(callIdA, callIdB);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(pairCount * 2);

      // A tools should have longer duration than B tools (completed later)
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
    });
  });

  // ============================================================================
  // Resource Limit Scenarios
  // ============================================================================

  describe('Resource Limit Scenarios', () => {
    it('should handle maximum event throughput', async () => {
      const eventCount = 500; // 500 complete events = 1000 total events
      const callIds: string[] = [];
      const startTime = Date.now();

      // Generate as many events as possible
      for (let i = 0; i < eventCount; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      const totalTime = Date.now() - startTime;

      collector.stopCapturing();
      const events = collector.getEvents();
      const stats = collector.calculateStats();

      // Verify we captured all events
      expect(events).toHaveLength(eventCount * 2); // start + complete for each
      expect(stats.totalEvents).toBe(eventCount * 2);

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(STRESS_CONFIG.MAX_TEST_DURATION_MS);

      // Validate timing
      const records = buildTimingRecordsFromEvents(events);
      expect(records).toHaveLength(eventCount);

      isolationValidator.addFromEvents(events);
      const result = isolationValidator.validate();

      const criticalViolations = result.violations.filter(
        v => v.type === 'timing_boundary_violation' || v.type === 'calculation_mismatch'
      );
      expect(criticalViolations).toHaveLength(0);
    });

    it('should recover timing accuracy after peak load', async () => {
      // Phase 1: Peak load
      const peakCallIds: string[] = [];
      for (let i = 0; i < STRESS_CONFIG.LARGE_BURST_SIZE; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        peakCallIds.push(callId);
      }

      for (const callId of peakCallIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      // Phase 2: Recovery - slower operations
      await delay(50);

      const recoveryCallIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        recoveryCallIds.push(callId);
        await delay(STRESS_CONFIG.SMALL_DELAY);
      }

      for (const callId of recoveryCallIds) {
        await delay(STRESS_CONFIG.SMALL_DELAY);
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      const totalExpected = STRESS_CONFIG.LARGE_BURST_SIZE + 10;
      expect(records).toHaveLength(totalExpected);

      // Recovery phase records should have measurable duration
      const recoveryRecords = records.filter(r =>
        recoveryCallIds.includes(r.callId)
      );

      for (const record of recoveryRecords) {
        expect(record.duration).toBeGreaterThan(0);
      }

      // All timing should still be valid
      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      expect(result.isIsolated).toBe(true);
    });

    it('should maintain unique call IDs under extreme pressure', async () => {
      const extremeCount = 300;
      const callIds: string[] = [];

      // Generate many call IDs as fast as possible
      for (let i = 0; i < extremeCount; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete all
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      // All call IDs must be unique
      const uniqueCallIds = new Set(callIds);
      expect(uniqueCallIds.size).toBe(extremeCount);

      // All records should have unique call IDs
      const recordCallIds = new Set(records.map(r => r.callId));
      expect(recordCallIds.size).toBe(extremeCount);
    });
  });

  // ============================================================================
  // Timing Precision Validation
  // ============================================================================

  describe('Timing Precision Validation', () => {
    it('should maintain high-resolution timestamp uniqueness at scale', async () => {
      const count = STRESS_CONFIG.LARGE_BURST_SIZE;
      const callIds: string[] = [];

      for (let i = 0; i < count; i++) {
        const callId = orchestrator.startToolExecution(testTaskId, 'TodoWrite');
        callIds.push(callId);
      }

      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const events = collector.getEventsBySequence();

      // High-resolution capture times should be valid
      for (const event of events) {
        expect(event.captureTime).toBeGreaterThan(0);
        expect(typeof event.captureTime).toBe('number');
      }

      // Capture times should be monotonically increasing
      for (let i = 1; i < events.length; i++) {
        expect(events[i].captureTime).toBeGreaterThanOrEqual(events[i - 1].captureTime);
      }
    });

    it('should preserve sequence index ordering under concurrency', async () => {
      const count = STRESS_CONFIG.MEDIUM_BURST_SIZE;
      const callIds: string[] = [];

      // Interleaved starts
      for (let i = 0; i < count; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Random order completions
      const shuffled = shuffleArray([...callIds]);
      for (const callId of shuffled) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const events = collector.getEventsBySequence();

      // Verify monotonic sequence indices
      for (let i = 1; i < events.length; i++) {
        expect(events[i].sequenceIndex).toBeGreaterThan(events[i - 1].sequenceIndex);
      }
    });

    it('should calculate accurate durations at high throughput', async () => {
      const count = STRESS_CONFIG.MEDIUM_BURST_SIZE;

      for (let i = 0; i < count; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        await delay(STRESS_CONFIG.MICRO_DELAY);
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const records = buildTimingRecordsFromEvents(collector.getEvents());

      expect(records).toHaveLength(count);

      // All durations should be calculated correctly
      for (const record of records) {
        const calculated = record.endTime.getTime() - record.startTime.getTime();
        expect(record.duration).toBe(calculated);
        expect(record.duration).toBeGreaterThanOrEqual(0);
      }

      // Most should have measurable duration (>= 1ms due to delay)
      const measurableDurations = records.filter(r => r.duration >= 1);
      expect(measurableDurations.length).toBeGreaterThan(count * 0.5);
    });

    it('should produce accurate statistics under high load', async () => {
      const count = STRESS_CONFIG.LARGE_BURST_SIZE;
      const callIds: string[] = [];

      // Start all
      for (let i = 0; i < count; i++) {
        const tool = SUPPORTED_TOOLS[i % SUPPORTED_TOOLS.length];
        const callId = orchestrator.startToolExecution(testTaskId, tool);
        callIds.push(callId);
      }

      // Complete all
      for (const callId of callIds) {
        orchestrator.completeToolExecution(testTaskId, callId);
      }

      collector.stopCapturing();
      const stats = collector.calculateStats();

      // Verify statistics accuracy
      expect(stats.totalEvents).toBe(count * 2);
      expect(stats.uniqueCallIds).toBe(count);
      expect(stats.uniqueToolTypes).toBe(SUPPORTED_TOOLS.length);
      expect(stats.maxConcurrentExecutions).toBe(count); // All started before any completed

      // Timing statistics should be reasonable
      expect(stats.totalDuration).toBeGreaterThanOrEqual(0);
      expect(stats.averageInterEventDelay).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Validation Completeness
  // ============================================================================

  describe('Validation Completeness', () => {
    it('should detect introduced timing violations (negative test)', async () => {
      // This test verifies the validator can detect problems

      // Create records with intentional violations
      const now = new Date();
      const badRecord: ToolTimingRecord = {
        callId: 'bad-record-1',
        toolName: 'Read',
        taskId: testTaskId,
        startTime: new Date(now.getTime() + 100), // Future
        endTime: now,                               // Past (violation!)
        duration: -100,                             // Negative (violation!)
        captureSequence: 0,
      };

      isolationValidator.addTimingRecord(badRecord);
      const result = isolationValidator.validate();

      // Should detect the timing boundary violation
      const boundaryViolations = result.violations.filter(
        v => v.type === 'timing_boundary_violation'
      );
      expect(boundaryViolations.length).toBeGreaterThan(0);

      expect(result.isIsolated).toBe(false);
    });

    it('should pass validation for properly isolated high-volume execution', async () => {
      // Large-scale proper execution
      const count = STRESS_CONFIG.LARGE_BURST_SIZE;
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

      isolationValidator.addFromEvents(collector.getEvents());
      const result = isolationValidator.validate();

      // Should pass - no timing violations from proper execution
      expect(result.isIsolated).toBe(true);

      // All records should be validated
      expect(result.stats.toolExecutions).toBe(count);
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
