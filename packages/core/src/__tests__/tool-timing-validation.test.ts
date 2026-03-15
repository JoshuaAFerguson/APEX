import { describe, it, expect } from 'vitest';
import { formatDuration } from '../utils.js';

/**
 * Validation tests for tool timing display functionality
 *
 * Verifies acceptance criteria compliance:
 * - CLI displays tool execution duration in human-readable format (e.g., '2.3s', '150ms')
 * - Timing shown inline with tool output or in summary
 * - Tests verify correct formatting for various durations
 */
describe('Tool Timing Implementation Validation', () => {
  describe('Acceptance Criteria Compliance', () => {
    it('should format "150ms" as specified in acceptance criteria', () => {
      const result = formatDuration(150);
      expect(result).toBe('150ms');
    });

    it('should format "2.3s" as specified in acceptance criteria', () => {
      const result = formatDuration(2300);
      expect(result).toBe('2.3s');
    });

    it('should provide human-readable format for all time ranges', () => {
      const testCases = [
        // Milliseconds range
        { input: 0, expected: '0ms', range: 'zero' },
        { input: 1, expected: '1ms', range: 'minimal' },
        { input: 100, expected: '100ms', range: 'fast operations' },
        { input: 500, expected: '500ms', range: 'medium operations' },
        { input: 999, expected: '999ms', range: 'sub-second max' },

        // Seconds range
        { input: 1000, expected: '1.0s', range: 'seconds start' },
        { input: 1500, expected: '1.5s', range: 'second fractions' },
        { input: 10000, expected: '10.0s', range: 'longer operations' },
        { input: 59999, expected: '60.0s', range: 'approaching minute' },

        // Minutes range
        { input: 60000, expected: '1m 0s', range: 'minute boundary' },
        { input: 90000, expected: '1m 30s', range: 'minute with seconds' },
        { input: 300000, expected: '5m 0s', range: 'longer tasks' },

        // Hours range (edge cases)
        { input: 3600000, expected: '1h 0m', range: 'hour boundary' },
        { input: 7200000, expected: '2h 0m', range: 'multiple hours' },
      ];

      testCases.forEach(({ input, expected, range }) => {
        const result = formatDuration(input);
        expect(result).toBe(expected);

        // Verify human-readability
        expect(result).toMatch(/^\d+(?:\.\d+)?(?:ms|s|[hm](?:\s\d+[sm])?)?$/);
      });
    });

    it('should format durations suitable for inline display', () => {
      const commonDurations = [25, 150, 800, 1200, 5000, 30000];

      commonDurations.forEach(duration => {
        const result = formatDuration(duration);

        // Should be concise for inline display
        expect(result.length).toBeLessThanOrEqual(10);

        // Should not have trailing spaces
        expect(result.trim()).toBe(result);

        // Should follow expected patterns
        expect(result).toMatch(/^\d+(?:\.\d+)?(?:ms|s|m \d+s|h \d+m)$/);
      });
    });
  });

  describe('Real-world Tool Scenarios', () => {
    it('should format file operation timings correctly', () => {
      expect(formatDuration(25)).toBe('25ms');      // Read small file
      expect(formatDuration(150)).toBe('150ms');    // Write file
      expect(formatDuration(800)).toBe('800ms');    // Edit large file
    });

    it('should format command execution timings correctly', () => {
      expect(formatDuration(1200)).toBe('1.2s');    // Quick bash command
      expect(formatDuration(5000)).toBe('5.0s');    // Longer command
      expect(formatDuration(30000)).toBe('30.0s');  // Build process
    });

    it('should format search operation timings correctly', () => {
      expect(formatDuration(50)).toBe('50ms');      // Glob search
      expect(formatDuration(300)).toBe('300ms');    // Grep search
      expect(formatDuration(2000)).toBe('2.0s');    // Complex search
    });

    it('should format network operation timings correctly', () => {
      expect(formatDuration(500)).toBe('500ms');    // Fast API call
      expect(formatDuration(3000)).toBe('3.0s');    // Slow API call
      expect(formatDuration(15000)).toBe('15.0s');  // Timeout scenario
    });
  });

  describe('Boundary Value Validation', () => {
    it('should handle millisecond-second boundary correctly', () => {
      expect(formatDuration(999)).toBe('999ms');
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1001)).toBe('1.0s');
    });

    it('should handle second-minute boundary correctly', () => {
      expect(formatDuration(59000)).toBe('59.0s');
      expect(formatDuration(59999)).toBe('60.0s');
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(61000)).toBe('1m 1s');
    });

    it('should handle minute-hour boundary correctly', () => {
      expect(formatDuration(3599000)).toBe('59m 59s');
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(3661000)).toBe('1h 1m');
    });
  });

  describe('Precision and Rounding Validation', () => {
    it('should round seconds to one decimal place', () => {
      expect(formatDuration(1234)).toBe('1.2s');
      expect(formatDuration(1250)).toBe('1.3s'); // JavaScript toFixed rounds 0.5 up
      expect(formatDuration(1260)).toBe('1.3s');
    });

    it('should handle fractional milliseconds', () => {
      // formatDuration does not round milliseconds - fractional values are passed through
      expect(formatDuration(123.7)).toBe('123.7ms');
      expect(formatDuration(999.9)).toBe('999.9ms');
    });

    it('should round minutes correctly in hour display', () => {
      expect(formatDuration(3630000)).toBe('1h 0m');  // 30 seconds rounds down
      expect(formatDuration(3690000)).toBe('1h 1m');  // 30 seconds rounds up
    });
  });

  describe('Performance Characteristics', () => {
    it('should format durations quickly for performance monitoring', () => {
      const durations = Array.from({ length: 1000 }, (_, i) => i * 10);

      const startTime = Date.now();
      durations.forEach(formatDuration);
      const endTime = Date.now();

      // Should complete very quickly (less than 100ms for 1000 calls)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should produce consistent results for same input', () => {
      const testValue = 2345;
      const expected = formatDuration(testValue);

      // Should be deterministic across multiple calls
      for (let i = 0; i < 100; i++) {
        expect(formatDuration(testValue)).toBe(expected);
      }
    });
  });

  describe('Error Resilience', () => {
    it('should handle edge cases without crashing', () => {
      const edgeCases = [0, -1000, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER];

      edgeCases.forEach(value => {
        expect(() => formatDuration(value)).not.toThrow();
      });
    });

    it('should maintain readability even with extreme values', () => {
      const extremeValues = [0, 999999999, Number.MAX_SAFE_INTEGER];

      extremeValues.forEach(value => {
        const result = formatDuration(value);
        // Should still follow basic format patterns
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});

/**
 * Summary validation test to ensure core functionality works
 */
describe('Tool Timing Feature Summary', () => {
  it('should meet all acceptance criteria requirements', () => {
    // 1. Display tool execution duration in human-readable format
    const quickOp = formatDuration(150);
    const slowOp = formatDuration(2300);

    expect(quickOp).toBe('150ms');
    expect(slowOp).toBe('2.3s');

    // 2. Format should be suitable for inline display
    expect(quickOp.length).toBeLessThanOrEqual(10);
    expect(slowOp.length).toBeLessThanOrEqual(10);

    // 3. Should handle various duration ranges correctly
    const ranges = [50, 1500, 90000, 3600000];
    const results = ranges.map(formatDuration);

    expect(results).toEqual([
      '50ms',      // Milliseconds
      '1.5s',      // Seconds
      '1m 30s',    // Minutes
      '1h 0m'      // Hours
    ]);

    // 4. All results should be human-readable
    results.forEach(result => {
      expect(result).toMatch(/^\d+(?:\.\d+)?(?:ms|s|[hm](?:\s\d+[sm])?)?$/);
    });
  });
});