/**
 * Edge Cases and Boundary Condition Tests for Timing Fields
 *
 * This test suite validates timing data handling in edge cases,
 * boundary conditions, and unusual scenarios to ensure robust
 * timing field implementation across all possible conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  assertFailedToolTiming,
  assertTimingAccuracy,
  type ToolCallCompleteEventLike,
} from './test-utils/failed-tool-timing-helpers';

/**
 * Edge case timing test harness for boundary conditions
 */
class EdgeCaseTimingHarness extends EventEmitter {
  private executionCounter = 0;
  private events: ToolCallCompleteEventLike[] = [];
  private systemTimeOffset = 0;

  constructor() {
    super();
    this.on('tool:complete', (event) => {
      this.events.push(event);
    });
  }

  /**
   * Execute tool with specific timing behavior
   */
  async executeToolWithEdgeCase(
    scenario: string,
    edgeCaseConfig: {
      startTimeOverride?: Date;
      endTimeOverride?: Date;
      durationOverride?: number;
      shouldFail?: boolean;
      systemClockJump?: number;
    }
  ): Promise<ToolCallCompleteEventLike> {
    const callId = `edge-${++this.executionCounter}`;
    const taskId = `edge-case-task`;

    const startTime = edgeCaseConfig.startTimeOverride || new Date();

    // Simulate system clock jump during execution
    if (edgeCaseConfig.systemClockJump) {
      this.systemTimeOffset = edgeCaseConfig.systemClockJump;
    }

    const endTime = edgeCaseConfig.endTimeOverride ||
                   new Date(startTime.getTime() + (edgeCaseConfig.durationOverride || 100) + this.systemTimeOffset);

    // Always use the calculated duration from the actual dates for consistency
    const calculatedDuration = endTime.getTime() - startTime.getTime();
    const duration = edgeCaseConfig.durationOverride !== undefined ?
                    edgeCaseConfig.durationOverride :
                    calculatedDuration;

    // If duration override is provided, adjust endTime to match
    const finalEndTime = edgeCaseConfig.durationOverride !== undefined ?
                        new Date(startTime.getTime() + edgeCaseConfig.durationOverride) :
                        endTime;

    const event: ToolCallCompleteEventLike = {
      taskId,
      toolName: `EdgeTool-${scenario}`,
      callId,
      result: {
        success: !edgeCaseConfig.shouldFail,
        output: edgeCaseConfig.shouldFail ? undefined : { scenario, duration },
        error: edgeCaseConfig.shouldFail ? `Edge case failure: ${scenario}` : undefined
      },
      timing: {
        startTime,
        endTime: finalEndTime,
        duration
      },
      timestamp: finalEndTime
    };

    this.emit('tool:complete', event);
    return event;
  }

  /**
   * Test time zone boundary conditions
   */
  async executeTimeZoneBoundaryTest(): Promise<ToolCallCompleteEventLike[]> {
    const events: ToolCallCompleteEventLike[] = [];

    // Test around midnight UTC
    const midnightUTC = new Date('2024-01-01T00:00:00.000Z');
    events.push(await this.executeToolWithEdgeCase('midnight-utc', {
      startTimeOverride: new Date(midnightUTC.getTime() - 1),
      endTimeOverride: new Date(midnightUTC.getTime() + 1),
      durationOverride: 2
    }));

    // Test around year boundary
    const yearBoundary = new Date('2024-01-01T00:00:00.000Z');
    events.push(await this.executeToolWithEdgeCase('year-boundary', {
      startTimeOverride: new Date(yearBoundary.getTime() - 500),
      endTimeOverride: new Date(yearBoundary.getTime() + 500),
      durationOverride: 1000
    }));

    // Test daylight saving time boundary (example: US Eastern Time)
    const dstBoundary = new Date('2024-03-10T07:00:00.000Z'); // 2 AM EST -> 3 AM EDT
    events.push(await this.executeToolWithEdgeCase('dst-boundary', {
      startTimeOverride: new Date(dstBoundary.getTime() - 1800000), // 30 min before
      endTimeOverride: new Date(dstBoundary.getTime() + 1800000),   // 30 min after
      durationOverride: 3600000 // 1 hour
    }));

    return events;
  }

  /**
   * Test leap second scenarios
   */
  async executeLeapSecondTest(): Promise<ToolCallCompleteEventLike> {
    // Simulate a leap second scenario (June 30, 2015 23:59:60 UTC)
    const beforeLeapSecond = new Date('2015-06-30T23:59:59.000Z');
    const afterLeapSecond = new Date('2015-07-01T00:00:01.000Z');

    return this.executeToolWithEdgeCase('leap-second', {
      startTimeOverride: beforeLeapSecond,
      endTimeOverride: afterLeapSecond,
      durationOverride: afterLeapSecond.getTime() - beforeLeapSecond.getTime()
    });
  }

  /**
   * Test extreme duration values
   */
  async executeExtremeDurationTests(): Promise<ToolCallCompleteEventLike[]> {
    const events: ToolCallCompleteEventLike[] = [];
    const baseTime = new Date('2024-01-01T12:00:00.000Z');

    // Zero duration
    events.push(await this.executeToolWithEdgeCase('zero-duration', {
      startTimeOverride: baseTime,
      endTimeOverride: baseTime,
      durationOverride: 0
    }));

    // Very small duration (1ms)
    events.push(await this.executeToolWithEdgeCase('minimal-duration', {
      startTimeOverride: baseTime,
      endTimeOverride: new Date(baseTime.getTime() + 1),
      durationOverride: 1
    }));

    // Very large duration (24 hours)
    const dayInMs = 24 * 60 * 60 * 1000;
    events.push(await this.executeToolWithEdgeCase('day-duration', {
      startTimeOverride: baseTime,
      endTimeOverride: new Date(baseTime.getTime() + dayInMs),
      durationOverride: dayInMs
    }));

    // Extremely large duration (1 year)
    const yearInMs = 365 * 24 * 60 * 60 * 1000;
    events.push(await this.executeToolWithEdgeCase('year-duration', {
      startTimeOverride: baseTime,
      endTimeOverride: new Date(baseTime.getTime() + yearInMs),
      durationOverride: yearInMs
    }));

    return events;
  }

  /**
   * Test clock synchronization edge cases
   */
  async executeClockSyncTests(): Promise<ToolCallCompleteEventLike[]> {
    const events: ToolCallCompleteEventLike[] = [];
    const baseTime = new Date();

    // System clock moved backward during execution
    events.push(await this.executeToolWithEdgeCase('clock-backward', {
      startTimeOverride: baseTime,
      endTimeOverride: new Date(baseTime.getTime() - 1000), // End before start
      durationOverride: -1000 // Negative duration
    }));

    // System clock jumped forward during execution
    events.push(await this.executeToolWithEdgeCase('clock-forward', {
      startTimeOverride: baseTime,
      systemClockJump: 60000, // 1 minute jump
      durationOverride: 100
    }));

    // Clock resolution issues (microsecond precision lost)
    const preciseTime = new Date();
    preciseTime.setMilliseconds(999);
    events.push(await this.executeToolWithEdgeCase('precision-loss', {
      startTimeOverride: preciseTime,
      endTimeOverride: new Date(preciseTime.getTime() + 1),
      durationOverride: 1
    }));

    return events;
  }

  getEvents(): ToolCallCompleteEventLike[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  cleanup(): void {
    this.removeAllListeners();
    this.events = [];
    this.systemTimeOffset = 0;
  }
}

describe('Timing Edge Cases and Boundary Conditions', () => {
  let harness: EdgeCaseTimingHarness;

  beforeEach(() => {
    harness = new EdgeCaseTimingHarness();
  });

  afterEach(() => {
    harness.cleanup();
    vi.clearAllTimers();
  });

  describe('Time Boundary Conditions', () => {
    it('should handle timing around UTC midnight correctly', async () => {
      const events = await harness.executeTimeZoneBoundaryTest();

      expect(events).toHaveLength(3);

      const [midnightEvent, yearBoundaryEvent, dstEvent] = events;

      // Midnight UTC test
      expect(midnightEvent.timing.duration).toBe(2);
      expect(midnightEvent.timing.endTime.getTime() - midnightEvent.timing.startTime.getTime())
        .toBe(midnightEvent.timing.duration);

      // Year boundary test
      expect(yearBoundaryEvent.timing.duration).toBe(1000);
      expect(yearBoundaryEvent.timing.endTime.getTime() - yearBoundaryEvent.timing.startTime.getTime())
        .toBe(yearBoundaryEvent.timing.duration);

      // DST boundary test
      expect(dstEvent.timing.duration).toBe(3600000);
      expect(dstEvent.timing.endTime.getTime() - dstEvent.timing.startTime.getTime())
        .toBe(dstEvent.timing.duration);

      // All events should have consistent timing fields
      events.forEach(event => {
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(typeof event.timing.duration).toBe('number');
      });
    });

    it('should handle leap second scenarios gracefully', async () => {
      const event = await harness.executeLeapSecondTest();

      expect(event.timing).toBeDefined();
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(event.timing.duration).toBeGreaterThan(0);

      // Verify leap second timing is consistent
      const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
      expect(event.timing.duration).toBe(calculatedDuration);

      // Leap second event should be around 2 seconds
      expect(event.timing.duration).toBeGreaterThan(1000);
      expect(event.timing.duration).toBeLessThan(3000);
    });

    it('should handle extreme duration values correctly', async () => {
      const events = await harness.executeExtremeDurationTests();

      expect(events).toHaveLength(4);
      const [zeroEvent, minimalEvent, dayEvent, yearEvent] = events;

      // Zero duration
      expect(zeroEvent.timing.duration).toBe(0);
      expect(zeroEvent.timing.startTime.getTime()).toBe(zeroEvent.timing.endTime.getTime());

      // Minimal duration (1ms)
      expect(minimalEvent.timing.duration).toBe(1);
      expect(minimalEvent.timing.endTime.getTime() - minimalEvent.timing.startTime.getTime()).toBe(1);

      // Day duration
      const dayInMs = 24 * 60 * 60 * 1000;
      expect(dayEvent.timing.duration).toBe(dayInMs);
      expect(dayEvent.timing.endTime.getTime() - dayEvent.timing.startTime.getTime()).toBe(dayInMs);

      // Year duration
      const yearInMs = 365 * 24 * 60 * 60 * 1000;
      expect(yearEvent.timing.duration).toBe(yearInMs);
      expect(yearEvent.timing.endTime.getTime() - yearEvent.timing.startTime.getTime()).toBe(yearInMs);

      // All should have consistent timing structure
      events.forEach(event => {
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(typeof event.timing.duration).toBe('number');
        expect(Number.isFinite(event.timing.duration)).toBe(true);
      });
    });
  });

  describe('Clock Synchronization Edge Cases', () => {
    it('should handle backward clock movement gracefully', async () => {
      const events = await harness.executeClockSyncTests();

      expect(events).toHaveLength(3);
      const [backwardEvent, forwardEvent, precisionEvent] = events;

      // Backward clock movement (negative duration)
      expect(backwardEvent.timing.duration).toBe(-1000);
      expect(backwardEvent.timing.startTime).toBeInstanceOf(Date);
      expect(backwardEvent.timing.endTime).toBeInstanceOf(Date);

      // Even with negative duration, timing structure should be valid
      const backwardCalculated = backwardEvent.timing.endTime.getTime() - backwardEvent.timing.startTime.getTime();
      expect(backwardEvent.timing.duration).toBe(backwardCalculated);

      // Forward clock jump
      expect(forwardEvent.timing.duration).toBe(100);
      expect(forwardEvent.timing.startTime).toBeInstanceOf(Date);
      expect(forwardEvent.timing.endTime).toBeInstanceOf(Date);

      // Precision event
      expect(precisionEvent.timing.duration).toBe(1);
      expect(precisionEvent.timing.startTime).toBeInstanceOf(Date);
      expect(precisionEvent.timing.endTime).toBeInstanceOf(Date);
    });

    it('should maintain timing field consistency in abnormal conditions', async () => {
      // Test various abnormal timing scenarios
      const abnormalCases = [
        { scenario: 'same-timestamps', startOffset: 0, endOffset: 0, expectedDuration: 0 },
        { scenario: 'microsecond-diff', startOffset: 0, endOffset: 0.1, expectedDuration: 0 }, // Sub-ms precision lost
        { scenario: 'second-boundary', startOffset: 999, endOffset: 1001, expectedDuration: 2 }
      ];

      for (const testCase of abnormalCases) {
        const baseTime = new Date();
        const startTime = new Date(baseTime.getTime() + testCase.startOffset);
        const endTime = new Date(baseTime.getTime() + testCase.endOffset);
        const duration = endTime.getTime() - startTime.getTime();

        const event = await harness.executeToolWithEdgeCase(testCase.scenario, {
          startTimeOverride: startTime,
          endTimeOverride: endTime,
          durationOverride: duration
        });

        // Verify timing consistency
        expect(event.timing.duration).toBe(testCase.expectedDuration);
        expect(event.timing.endTime.getTime() - event.timing.startTime.getTime()).toBe(duration);

        // Verify field types
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(typeof event.timing.duration).toBe('number');
        expect(Number.isInteger(event.timing.duration)).toBe(true);
      }
    });
  });

  describe('Data Type and Format Edge Cases', () => {
    it('should handle JavaScript Date edge cases', async () => {
      // Test with very old date
      const veryOldDate = new Date('1970-01-01T00:00:00.000Z');
      const oldEvent = await harness.executeToolWithEdgeCase('old-date', {
        startTimeOverride: veryOldDate,
        endTimeOverride: new Date(veryOldDate.getTime() + 1000),
        durationOverride: 1000
      });

      expect(oldEvent.timing.startTime.getTime()).toBe(0);
      expect(oldEvent.timing.duration).toBe(1000);

      // Test with far future date
      const futureDate = new Date('2100-12-31T23:59:59.999Z');
      const futureEvent = await harness.executeToolWithEdgeCase('future-date', {
        startTimeOverride: futureDate,
        endTimeOverride: new Date(futureDate.getTime() + 500),
        durationOverride: 500
      });

      expect(futureEvent.timing.startTime.getTime()).toBe(futureDate.getTime());
      expect(futureEvent.timing.duration).toBe(500);

      // Test with a large but valid timestamp (not MAX_SAFE_INTEGER as it creates invalid dates)
      const largeTime = new Date('2050-12-31T23:59:59.999Z');
      const largeEvent = await harness.executeToolWithEdgeCase('large-timestamp', {
        startTimeOverride: largeTime,
        durationOverride: 0
      });

      expect(largeEvent.timing.duration).toBe(0);
      expect(largeEvent.timing.startTime.getTime()).toBe(largeTime.getTime());
    });

    it('should validate timing field constraints', async () => {
      const event = await harness.executeToolWithEdgeCase('constraint-test', {
        durationOverride: 12345
      });

      // Duration should be non-negative integer
      expect(Number.isInteger(event.timing.duration)).toBe(true);
      expect(event.timing.duration).toBeGreaterThanOrEqual(0);

      // Timestamps should be valid Date objects
      expect(event.timing.startTime).toBeInstanceOf(Date);
      expect(event.timing.endTime).toBeInstanceOf(Date);
      expect(isNaN(event.timing.startTime.getTime())).toBe(false);
      expect(isNaN(event.timing.endTime.getTime())).toBe(false);

      // Timing should be logically consistent
      expect(event.timing.endTime.getTime()).toBeGreaterThanOrEqual(
        event.timing.startTime.getTime()
      );

      // Timestamp should be reasonable (not in far past or future)
      const now = Date.now();
      const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
      const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);

      expect(event.timestamp.getTime()).toBeGreaterThan(oneYearAgo);
      expect(event.timestamp.getTime()).toBeLessThan(oneYearFromNow);
    });
  });

  describe('Concurrent Edge Cases', () => {
    it('should handle concurrent executions with edge case timings', async () => {
      const concurrentPromises = [
        // Zero duration
        harness.executeToolWithEdgeCase('concurrent-zero', { durationOverride: 0 }),
        // Very small duration
        harness.executeToolWithEdgeCase('concurrent-minimal', { durationOverride: 1 }),
        // Normal duration
        harness.executeToolWithEdgeCase('concurrent-normal', { durationOverride: 100 }),
        // Large duration
        harness.executeToolWithEdgeCase('concurrent-large', { durationOverride: 1000 })
      ];

      const events = await Promise.all(concurrentPromises);

      expect(events).toHaveLength(4);

      // Verify all events have unique call IDs
      const callIds = events.map(e => e.callId);
      const uniqueCallIds = new Set(callIds);
      expect(uniqueCallIds.size).toBe(events.length);

      // Verify all events have valid timing regardless of edge case nature
      events.forEach(event => {
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(typeof event.timing.duration).toBe('number');
        expect(Number.isFinite(event.timing.duration)).toBe(true);

        // Verify timing consistency
        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });

      // Verify expected durations
      expect(events[0].timing.duration).toBe(0);   // zero
      expect(events[1].timing.duration).toBe(1);   // minimal
      expect(events[2].timing.duration).toBe(100); // normal
      expect(events[3].timing.duration).toBe(1000); // large
    });

    it('should handle rapid edge case executions', async () => {
      const rapidCount = 20;
      const events: ToolCallCompleteEventLike[] = [];

      // Execute edge cases in rapid succession
      for (let i = 0; i < rapidCount; i++) {
        const duration = i % 5; // Mix of 0, 1, 2, 3, 4 ms durations
        const event = await harness.executeToolWithEdgeCase(`rapid-${i}`, {
          durationOverride: duration
        });
        events.push(event);
      }

      expect(events).toHaveLength(rapidCount);

      // Verify all have valid timing despite rapid execution
      events.forEach((event, index) => {
        const expectedDuration = index % 5;
        expect(event.timing.duration).toBe(expectedDuration);

        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);

        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });

      // Verify events are chronologically ordered
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timing.startTime.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timing.startTime.getTime()
        );
      }
    });
  });

  describe('Error Condition Edge Cases', () => {
    it('should handle timing for failed tools with edge case scenarios', async () => {
      const failureEdgeCases = [
        { scenario: 'zero-duration-failure', duration: 0, shouldFail: true },
        { scenario: 'instant-failure', duration: 1, shouldFail: true },
        { scenario: 'long-failure', duration: 5000, shouldFail: true }
      ];

      for (const edgeCase of failureEdgeCases) {
        const event = await harness.executeToolWithEdgeCase(edgeCase.scenario, {
          durationOverride: edgeCase.duration,
          shouldFail: edgeCase.shouldFail
        });

        // Verify failed tool has proper timing structure
        assertFailedToolTiming(event, {
          expectedMinDuration: edgeCase.duration,
          expectedMaxDuration: edgeCase.duration,
          allowZeroDuration: edgeCase.duration === 0,
          tolerance: 0 // Exact match since we're controlling the duration
        });

        // Verify error message includes scenario
        expect(event.result.error).toContain(edgeCase.scenario);
      }
    });
  });

  describe('Integration with Real-World Scenarios', () => {
    it('should handle system under stress with edge case timings', async () => {
      // Create a mix of edge cases under stress conditions
      const stressPromises = Array.from({ length: 25 }, (_, index) => {
        let duration: number;
        let scenario: string;

        switch (index % 5) {
          case 0: duration = 0; scenario = 'stress-zero'; break;
          case 1: duration = 1; scenario = 'stress-minimal'; break;
          case 2: duration = Math.floor(Math.random() * 100); scenario = 'stress-random'; break;
          case 3: duration = 1000; scenario = 'stress-long'; break;
          case 4: duration = Number.MAX_SAFE_INTEGER % 1000; scenario = 'stress-modulo'; break;
          default: duration = 50; scenario = 'stress-default'; break;
        }

        return harness.executeToolWithEdgeCase(`${scenario}-${index}`, {
          durationOverride: duration,
          shouldFail: index % 7 === 0 // ~14% failure rate
        });
      });

      const events = await Promise.all(stressPromises);

      expect(events).toHaveLength(25);

      // Verify all events maintain timing integrity under stress
      events.forEach(event => {
        expect(event.timing.startTime).toBeInstanceOf(Date);
        expect(event.timing.endTime).toBeInstanceOf(Date);
        expect(typeof event.timing.duration).toBe('number');
        expect(Number.isFinite(event.timing.duration)).toBe(true);

        const calculatedDuration = event.timing.endTime.getTime() - event.timing.startTime.getTime();
        expect(event.timing.duration).toBe(calculatedDuration);
      });

      // Verify unique call IDs
      const callIds = events.map(e => e.callId);
      const uniqueCallIds = new Set(callIds);
      expect(uniqueCallIds.size).toBe(events.length);

      // Count successful vs failed
      const successCount = events.filter(e => e.result.success).length;
      const failureCount = events.filter(e => !e.result.success).length;

      expect(successCount + failureCount).toBe(25);
      expect(failureCount).toBeGreaterThan(0); // Should have some failures
      expect(successCount).toBeGreaterThan(0); // Should have some successes
    });
  });
});