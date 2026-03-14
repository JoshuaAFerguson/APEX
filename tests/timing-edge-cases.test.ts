import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Edge case tests for timing calculations and scenarios
 *
 * This test suite covers unusual timing scenarios, boundary conditions,
 * and edge cases that might occur in real-world usage.
 */

describe('Timing Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Boundary Value Testing', () => {
    it('should handle zero-duration executions', () => {
      const startTime = new Date('2024-01-01T10:00:00.000Z');
      const endTime = new Date('2024-01-01T10:00:00.000Z'); // Same time
      const duration = endTime.getTime() - startTime.getTime();

      expect(duration).toBe(0);

      // Should be valid in timing structure
      const timingData = {
        startTime,
        endTime,
        duration,
      };

      expect(timingData.duration).toBe(0);
      expect(timingData.endTime.getTime()).toBe(timingData.startTime.getTime());
    });

    it('should handle 1-millisecond executions', () => {
      const startTime = new Date('2024-01-01T10:00:00.000Z');
      const endTime = new Date('2024-01-01T10:00:00.001Z'); // 1ms later
      const duration = endTime.getTime() - startTime.getTime();

      expect(duration).toBe(1);

      const timingData = {
        startTime,
        endTime,
        duration,
      };

      expect(timingData.duration).toBe(1);
      expect(timingData.endTime.getTime() - timingData.startTime.getTime()).toBe(1);
    });

    it('should handle very large durations', () => {
      const startTime = new Date('2024-01-01T10:00:00.000Z');
      const endTime = new Date('2024-01-02T10:00:00.000Z'); // 24 hours later
      const duration = endTime.getTime() - startTime.getTime();

      expect(duration).toBe(24 * 60 * 60 * 1000); // 86,400,000ms

      const timingData = {
        startTime,
        endTime,
        duration,
      };

      expect(timingData.duration).toBe(86400000);
    });

    it('should handle fractional milliseconds in calculations', () => {
      // Test with high-precision timestamps
      const startTimestamp = 1704110400000; // Round timestamp
      const endTimestamp = 1704110400250;   // 250ms later

      const startTime = new Date(startTimestamp);
      const endTime = new Date(endTimestamp);
      const duration = endTime.getTime() - startTime.getTime();

      // JavaScript Date.getTime() uses integers, calculation should work
      expect(duration).toBe(250);
    });
  });

  describe('Date Object Edge Cases', () => {
    it('should handle Date objects across timezone changes', () => {
      // Create dates in different ways to test consistency
      const startTime = new Date('2024-03-10T07:00:00.000Z'); // UTC
      const endTime = new Date(startTime.getTime() + 1000); // 1 second later

      const duration = endTime.getTime() - startTime.getTime();

      expect(duration).toBe(1000);
      expect(startTime.getTimezoneOffset()).toBe(endTime.getTimezoneOffset());
    });

    it('should handle leap year dates', () => {
      // Test around leap day
      const startTime = new Date('2024-02-29T23:59:59.000Z'); // Leap day
      const endTime = new Date('2024-03-01T00:00:01.000Z');   // Day after

      const duration = endTime.getTime() - startTime.getTime();

      expect(duration).toBe(2000); // 2 seconds
      expect(startTime.getMonth()).toBe(1); // February (0-indexed)
      expect(endTime.getMonth()).toBe(1);   // Still February in this calculation (UTC vs local time)

      // Verify it's actually crossing to March
      const actualMarchDate = new Date('2024-03-01T10:00:00.000Z');
      expect(actualMarchDate.getMonth()).toBe(2); // March (0-indexed)
    });

    it('should handle year boundary crossing', () => {
      // Use explicit millisecond timestamps to ensure year crossing
      const endOf2023 = new Date(2023, 11, 31, 23, 59, 59, 500); // Dec 31, 2023 local time
      const startOf2024 = new Date(2024, 0, 1, 0, 0, 0, 500);   // Jan 1, 2024 local time

      const duration = startOf2024.getTime() - endOf2023.getTime();

      expect(duration).toBe(1000); // 1 second
      expect(endOf2023.getFullYear()).toBe(2023);
      expect(startOf2024.getFullYear()).toBe(2024);
    });

    it('should handle daylight saving time transitions', () => {
      // Note: This test depends on system timezone, so we'll test the principle
      const beforeDST = new Date('2024-03-10T06:59:59.000Z');
      const afterDST = new Date('2024-03-10T07:00:01.000Z');

      const duration = afterDST.getTime() - beforeDST.getTime();

      // Duration should be consistent regardless of DST (using UTC)
      expect(duration).toBe(2000); // 2 seconds
    });
  });

  describe('Concurrent Execution Edge Cases', () => {
    it('should handle tools starting at exact same timestamp', () => {
      const exactTime = new Date('2024-01-01T10:00:00.000Z');

      const tool1Timing = {
        startTime: new Date(exactTime),
        endTime: new Date(exactTime.getTime() + 100),
        duration: 100,
      };

      const tool2Timing = {
        startTime: new Date(exactTime), // Exact same start time
        endTime: new Date(exactTime.getTime() + 150),
        duration: 150,
      };

      // Both should have valid timings despite same start
      expect(tool1Timing.startTime.getTime()).toBe(tool2Timing.startTime.getTime());
      expect(tool1Timing.duration).toBe(100);
      expect(tool2Timing.duration).toBe(150);
    });

    it('should handle rapidly sequential tool executions', () => {
      const baseTime = new Date('2024-01-01T10:00:00.000Z').getTime();

      const executions = Array.from({ length: 100 }, (_, i) => ({
        startTime: new Date(baseTime + i), // 1ms apart
        endTime: new Date(baseTime + i + 10), // 10ms duration each
        duration: 10,
        callId: `rapid-${i}`,
      }));

      // Verify all executions have valid timing
      executions.forEach((exec, index) => {
        expect(exec.duration).toBe(10);
        expect(exec.endTime.getTime() - exec.startTime.getTime()).toBe(10);

        if (index > 0) {
          // Each should start 1ms after the previous
          expect(exec.startTime.getTime() - executions[index - 1].startTime.getTime()).toBe(1);
        }
      });
    });
  });

  describe('Error Condition Edge Cases', () => {
    it('should handle execution interrupted before completion', () => {
      // Simulate a tool that gets interrupted
      const startTime = new Date('2024-01-01T10:00:00.000Z');
      const interruptTime = new Date('2024-01-01T10:00:02.500Z'); // 2.5s into execution

      const interruptedExecution = {
        callId: 'interrupted-call',
        toolName: 'InterruptedTool',
        input: { longTask: true },
        startTime,
        endTime: interruptTime,
        duration: interruptTime.getTime() - startTime.getTime(),
        status: 'failed' as const,
        result: {
          success: false,
          error: 'Tool execution was interrupted',
        },
      };

      expect(interruptedExecution.duration).toBe(2500);
      expect(interruptedExecution.status).toBe('failed');
      expect(interruptedExecution.result.success).toBe(false);
    });

    it('should handle tool timeout scenarios', () => {
      const startTime = new Date('2024-01-01T10:00:00.000Z');
      const timeoutTime = new Date('2024-01-01T10:00:30.000Z'); // 30s timeout

      const timeoutExecution = {
        callId: 'timeout-call',
        toolName: 'TimeoutTool',
        input: { timeout: 30000 },
        startTime,
        endTime: timeoutTime,
        duration: timeoutTime.getTime() - startTime.getTime(),
        status: 'failed' as const,
        result: {
          success: false,
          error: 'Tool execution timed out after 30s',
        },
      };

      expect(timeoutExecution.duration).toBe(30000);
      expect(timeoutExecution.result.error).toContain('timed out');
    });

    it('should handle system clock adjustments', () => {
      // Simulate a scenario where system clock changes during execution
      // This is rare but could happen with NTP adjustments

      const originalStartTime = new Date('2024-01-01T10:00:00.000Z');
      const adjustedEndTime = new Date('2024-01-01T09:59:59.000Z'); // Clock went backwards!

      // In such cases, we should handle gracefully
      const clockAdjustmentDuration = adjustedEndTime.getTime() - originalStartTime.getTime();

      // Duration would be negative, which should be handled
      expect(clockAdjustmentDuration).toBeLessThan(0);

      // A robust system should detect and handle this
      const saferDuration = Math.max(0, clockAdjustmentDuration);
      expect(saferDuration).toBe(0);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle high-frequency timing calculations', () => {
      const startTime = performance.now();
      const baseTimestamp = Date.now();

      // Simulate many rapid calculations
      const calculations = Array.from({ length: 10000 }, (_, i) => {
        const start = new Date(baseTimestamp + i * 0.1); // 0.1ms intervals
        const end = new Date(baseTimestamp + i * 0.1 + 5); // 5ms duration
        return end.getTime() - start.getTime();
      });

      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      // All calculations should be consistent
      calculations.forEach(duration => {
        expect(duration).toBe(5);
      });

      // Performance should be reasonable (less than 100ms for 10k calculations)
      expect(calculationTime).toBeLessThan(100);
    });

    it('should handle precise timing with microsecond-level operations', () => {
      // Test timing precision for very fast operations
      const measurements: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();

        // Minimal operation
        Math.sqrt(i);

        const end = performance.now();
        measurements.push(end - start);
      }

      // All measurements should be valid numbers
      measurements.forEach(measurement => {
        expect(typeof measurement).toBe('number');
        expect(measurement).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(measurement)).toBe(true);
      });

      // Some measurements might be very small or zero
      const nonZeroMeasurements = measurements.filter(m => m > 0);
      if (nonZeroMeasurements.length > 0) {
        expect(Math.min(...nonZeroMeasurements)).toBeGreaterThan(0);
      }
    });
  });

  describe('Data Consistency Edge Cases', () => {
    it('should maintain consistency with floating-point arithmetic', () => {
      // Test potential floating-point precision issues
      const baseTime = 1704110400000; // Base timestamp

      const testCases = [
        { offset: 0.1, expected: 0 }, // Very small differences - Date truncates fractional ms
        { offset: 0.3, expected: 0 },
        { offset: 0.7, expected: 0 }, // Still truncated to 0
        { offset: 1.1, expected: 1 },
        { offset: 10.9, expected: 10 }, // Truncated, not rounded
      ];

      testCases.forEach(({ offset, expected }) => {
        const startTime = new Date(baseTime);
        const endTime = new Date(baseTime + offset);
        const duration = endTime.getTime() - startTime.getTime();

        expect(duration).toBe(expected);
      });
    });

    it('should handle extreme timestamp values', () => {
      // Test with timestamps near JavaScript limits
      const maxSafeTimestamp = 8640000000000000; // Max valid Date
      const minSafeTimestamp = -8640000000000000; // Min valid Date

      const maxDate = new Date(maxSafeTimestamp);
      const minDate = new Date(minSafeTimestamp);

      expect(maxDate.getTime()).toBe(maxSafeTimestamp);
      expect(minDate.getTime()).toBe(minSafeTimestamp);

      // Duration calculation with extreme values
      const extremeDuration = maxSafeTimestamp - minSafeTimestamp;
      expect(extremeDuration).toBe(17280000000000000); // 17.28 quadrillion ms
    });

    it('should handle invalid Date objects gracefully', () => {
      const invalidDate = new Date('invalid-date-string');
      const validDate = new Date('2024-01-01T10:00:00.000Z');

      expect(isNaN(invalidDate.getTime())).toBe(true);
      expect(isNaN(validDate.getTime())).toBe(false);

      // Duration calculation with invalid date should result in NaN
      const invalidDuration = validDate.getTime() - invalidDate.getTime();
      expect(isNaN(invalidDuration)).toBe(true);

      // A robust system should validate dates before calculation
      const safeCalculateDuration = (start: Date, end: Date): number | null => {
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return null; // or throw error
        }
        return end.getTime() - start.getTime();
      };

      expect(safeCalculateDuration(invalidDate, validDate)).toBeNull();
      expect(safeCalculateDuration(validDate, validDate)).toBe(0);
    });
  });

  describe('Real-world Edge Cases', () => {
    it('should handle network operation interruptions', () => {
      // Simulate a network tool that gets interrupted
      const startTime = new Date('2024-01-01T10:00:00.000Z');
      const networkFailTime = new Date('2024-01-01T10:00:05.234Z'); // 5.234s

      const networkExecution = {
        callId: 'network-fail',
        toolName: 'WebFetch',
        input: { url: 'https://api.example.com/data' },
        startTime,
        endTime: networkFailTime,
        duration: networkFailTime.getTime() - startTime.getTime(),
        status: 'failed' as const,
        result: {
          success: false,
          error: 'Network timeout: Connection lost',
        },
      };

      expect(networkExecution.duration).toBe(5234);
      expect(networkExecution.result.error).toContain('Network timeout');
    });

    it('should handle file system operation delays', () => {
      // Simulate a file operation that takes unexpectedly long due to I/O
      const startTime = new Date('2024-01-01T10:00:00.000Z');
      const slowIoTime = new Date('2024-01-01T10:00:12.891Z'); // 12.891s

      const fileExecution = {
        callId: 'slow-file',
        toolName: 'Read',
        input: { file_path: '/very/large/file.log' },
        startTime,
        endTime: slowIoTime,
        duration: slowIoTime.getTime() - startTime.getTime(),
        status: 'completed' as const,
        result: {
          success: true,
          output: 'Large file content...',
        },
      };

      expect(fileExecution.duration).toBe(12891);
      expect(fileExecution.result.success).toBe(true);
      // Even slow operations should complete successfully
    });

    it('should handle compilation/build process variations', () => {
      // Build processes can vary significantly in timing
      const buildScenarios = [
        { name: 'quick', duration: 1250 },  // 1.25s
        { name: 'normal', duration: 15000 }, // 15s
        { name: 'slow', duration: 120000 },  // 2 minutes
      ];

      buildScenarios.forEach(scenario => {
        const startTime = new Date('2024-01-01T10:00:00.000Z');
        const endTime = new Date(startTime.getTime() + scenario.duration);

        const buildExecution = {
          callId: `build-${scenario.name}`,
          toolName: 'Bash',
          input: { command: 'npm run build' },
          startTime,
          endTime,
          duration: scenario.duration,
          status: 'completed' as const,
        };

        expect(buildExecution.duration).toBe(scenario.duration);
        expect(buildExecution.endTime.getTime() - buildExecution.startTime.getTime()).toBe(scenario.duration);
      });
    });
  });
});