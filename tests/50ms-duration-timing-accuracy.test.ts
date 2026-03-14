/**
 * 50ms Duration Timing Accuracy Tests
 *
 * Focused tests specifically for verifying the accuracy of 50ms duration timing
 * measurements and the standard timing tolerance used throughout the system.
 *
 * This test validates:
 * 1. 50ms duration measurements are accurate within standard tolerance
 * 2. The standard TIMING_TOLERANCE_MS (50ms) provides adequate buffer
 * 3. Real timing operations match expected durations for 50ms intervals
 * 4. Edge cases around the 50ms threshold are handled properly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  assertDurationBounds,
  assertTimingConsistency,
  TIMING_TOLERANCE_MS,
  type TimingData,
} from './event-data-integrity/shared/timing-consistency-utils';

describe('50ms Duration Timing Accuracy', () => {
  describe('Standard 50ms Duration Validation', () => {
    it('should validate exactly 50ms duration is within tolerance bounds', () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 50);
      const timing: TimingData = {
        startTime,
        endTime,
        duration: 50,
      };

      // This should pass without any issues
      expect(() => assertTimingConsistency(timing)).not.toThrow();
    });

    it('should validate 50ms duration measurements are accurate within standard tolerance', () => {
      const expectedDuration = 50;

      // Test various measured durations around 50ms that should be valid
      const validDurations = [
        50,                                    // Exact
        50 + TIMING_TOLERANCE_MS,             // Maximum allowed
        50 - TIMING_TOLERANCE_MS,             // Minimum allowed
        50 + Math.floor(TIMING_TOLERANCE_MS / 2), // Half tolerance above
        50 - Math.floor(TIMING_TOLERANCE_MS / 2), // Half tolerance below
      ];

      validDurations.forEach((actualDuration) => {
        expect(() =>
          assertDurationBounds(actualDuration, expectedDuration, expectedDuration)
        ).not.toThrow();
      });
    });

    it('should reject durations that exceed 50ms tolerance bounds', () => {
      const expectedDuration = 50;

      // Test durations that should be outside acceptable tolerance
      const invalidDurations = [
        50 + TIMING_TOLERANCE_MS + 1,         // Just above maximum
        50 - TIMING_TOLERANCE_MS - 1,         // Just below minimum
        150,                                   // Way too high
        -10,                                   // Negative (handled by assertDurationBounds)
      ];

      invalidDurations.forEach((actualDuration) => {
        if (actualDuration < 0) {
          // Negative durations should fail at the non-negative check
          expect(() =>
            assertDurationBounds(actualDuration)
          ).toThrow();
        } else {
          // Durations outside tolerance should fail bounds check
          expect(() =>
            assertDurationBounds(actualDuration, expectedDuration, expectedDuration, TIMING_TOLERANCE_MS)
          ).toThrow();
        }
      });
    });
  });

  describe('Real Timing Measurements for 50ms Operations', () => {
    it('should measure actual 50ms delays accurately', async () => {
      const targetDuration = 50;
      const startTime = new Date();

      // Create a real 50ms delay
      await new Promise(resolve => setTimeout(resolve, targetDuration));

      const endTime = new Date();
      const measuredDuration = endTime.getTime() - startTime.getTime();

      // Create timing data from real measurement
      const timing: TimingData = {
        startTime,
        endTime,
        duration: measuredDuration,
      };

      // Verify internal consistency
      assertTimingConsistency(timing);

      // Verify the measured duration is within expected bounds
      // Using a more generous tolerance for real async operations
      const asyncTolerance = TIMING_TOLERANCE_MS + 25; // Additional buffer for async timing
      assertDurationBounds(measuredDuration, targetDuration, undefined, asyncTolerance);
    });

    it('should handle multiple consecutive 50ms timing measurements', async () => {
      const targetDuration = 50;
      const measurementCount = 3;
      const timings: TimingData[] = [];

      for (let i = 0; i < measurementCount; i++) {
        const startTime = new Date();
        await new Promise(resolve => setTimeout(resolve, targetDuration));
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        timings.push({
          startTime,
          endTime,
          duration,
        });
      }

      // Validate each timing measurement
      timings.forEach((timing, index) => {
        expect(() => assertTimingConsistency(timing),
          `Timing measurement ${index + 1} should be consistent`
        ).not.toThrow();

        // Each measurement should be close to 50ms
        const asyncTolerance = TIMING_TOLERANCE_MS + 25;
        expect(() =>
          assertDurationBounds(timing.duration, targetDuration, undefined, asyncTolerance),
          `Timing measurement ${index + 1} should be within bounds`
        ).not.toThrow();
      });
    });
  });

  describe('Edge Cases Around 50ms Threshold', () => {
    it('should handle timing data exactly at tolerance boundaries', () => {
      const baseTime = Date.now();

      // Test exact tolerance boundary values
      const boundaryTests = [
        {
          name: 'exactly at upper tolerance limit',
          duration: 50 + TIMING_TOLERANCE_MS,
          expected: 50,
        },
        {
          name: 'exactly at lower tolerance limit',
          duration: 50 - TIMING_TOLERANCE_MS,
          expected: 50,
        },
        {
          name: 'zero tolerance with exact match',
          duration: 50,
          expected: 50,
          tolerance: 0,
        },
      ];

      boundaryTests.forEach(({ name, duration, expected, tolerance = TIMING_TOLERANCE_MS }) => {
        const timing: TimingData = {
          startTime: new Date(baseTime),
          endTime: new Date(baseTime + duration),
          duration,
        };

        expect(() => assertTimingConsistency(timing, tolerance), name).not.toThrow();
        expect(() => assertDurationBounds(duration, expected, expected, tolerance), name).not.toThrow();
      });
    });

    it('should handle sub-millisecond precision around 50ms', () => {
      const baseTime = Date.now();

      // Test fractional millisecond durations
      const precisionTests = [
        49.1,
        49.5,
        49.9,
        50.0,
        50.1,
        50.5,
        50.9,
      ];

      precisionTests.forEach((duration) => {
        const timing: TimingData = {
          startTime: new Date(baseTime),
          endTime: new Date(baseTime + Math.floor(duration)), // Date precision is millisecond
          duration,
        };

        // Should handle fractional durations gracefully
        expect(() => assertTimingConsistency(timing),
          `Duration ${duration}ms should be handled correctly`
        ).not.toThrow();
      });
    });

    it('should validate timing tolerance itself (50ms) is reasonable for system operations', () => {
      // Verify that our standard tolerance of 50ms is appropriate
      expect(TIMING_TOLERANCE_MS).toBe(50);

      // Test that the tolerance allows for reasonable system variance
      const systemVarianceTests = [
        { measured: 45, expected: 50, shouldPass: true },   // 5ms under
        { measured: 55, expected: 50, shouldPass: true },   // 5ms over
        { measured: 25, expected: 50, shouldPass: true },   // 25ms under
        { measured: 75, expected: 50, shouldPass: true },   // 25ms over
        { measured: 0, expected: 50, shouldPass: true },    // 50ms under (at tolerance limit: 50-50=0)
        { measured: 100, expected: 50, shouldPass: true },  // 50ms over (at tolerance limit: 50+50=100)
        { measured: 101, expected: 50, shouldPass: false }, // 51ms over (exceeds tolerance)
        { measured: -1, expected: 50, shouldPass: false },  // Below minimum (negative duration)
      ];

      systemVarianceTests.forEach(({ measured, expected, shouldPass }) => {
        if (shouldPass) {
          expect(() =>
            assertDurationBounds(measured, expected, expected, TIMING_TOLERANCE_MS),
            `${measured}ms should pass tolerance check against ${expected}ms`
          ).not.toThrow();
        } else {
          expect(() =>
            assertDurationBounds(measured, expected, expected, TIMING_TOLERANCE_MS),
            `${measured}ms should fail tolerance check against ${expected}ms`
          ).toThrow();
        }
      });
    });
  });

  describe('Integration with Existing Timing Infrastructure', () => {
    it('should work correctly with standard timing utilities', () => {
      const baseTime = Date.now();

      // Create a timing structure that represents a 50ms operation
      const toolTiming: TimingData = {
        startTime: new Date(baseTime),
        endTime: new Date(baseTime + 50),
        duration: 50,
      };

      // Should integrate seamlessly with existing timing validation
      assertTimingConsistency(toolTiming);
      assertDurationBounds(toolTiming.duration, 45, 55); // Allow 5ms variance
    });

    it('should validate 50ms timing is appropriate for tool operation measurements', () => {
      // Simulate a sequence of tool operations each taking around 50ms
      const operations = [
        { name: 'Read', targetMs: 50 },
        { name: 'Grep', targetMs: 50 },
        { name: 'Edit', targetMs: 50 },
      ];

      operations.forEach(({ name, targetMs }) => {
        const baseTime = Date.now();
        const timing: TimingData = {
          startTime: new Date(baseTime),
          endTime: new Date(baseTime + targetMs),
          duration: targetMs,
        };

        expect(() => assertTimingConsistency(timing),
          `${name} operation timing should be valid`
        ).not.toThrow();

        expect(() => assertDurationBounds(timing.duration, 0, 100),
          `${name} operation should be within reasonable bounds`
        ).not.toThrow();
      });
    });

    it('should confirm 50ms tolerance is suitable for CI environment timing variance', () => {
      // Test scenarios that might occur in CI environments with timing variance
      const ciScenarios = [
        { description: 'optimal conditions', variance: 0 },
        { description: 'light load', variance: 10 },
        { description: 'moderate load', variance: 25 },
        { description: 'heavy load', variance: 40 },
        { description: 'maximum acceptable load', variance: 50 },
      ];

      const expectedDuration = 50;

      ciScenarios.forEach(({ description, variance }) => {
        const scenarios = [
          expectedDuration + variance,  // Positive variance
          expectedDuration - variance,  // Negative variance
        ];

        scenarios.forEach((actualDuration) => {
          expect(() =>
            assertDurationBounds(actualDuration, expectedDuration, expectedDuration, TIMING_TOLERANCE_MS),
            `CI scenario '${description}' with ${actualDuration}ms duration should pass`
          ).not.toThrow();
        });
      });
    });
  });
});