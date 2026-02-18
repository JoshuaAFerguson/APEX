import { describe, it, expect } from 'vitest';
import { formatDuration } from '../utils.js';

/**
 * Comprehensive tests for formatDuration function
 *
 * Tests tool timing display functionality per acceptance criteria:
 * - CLI displays tool execution duration in human-readable format (e.g., '2.3s', '150ms')
 * - Timing shown inline with tool output or in summary
 * - Tests verify correct formatting for various durations
 */
describe('formatDuration', () => {
  describe('Millisecond formatting', () => {
    it('should format sub-second durations as milliseconds', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(1)).toBe('1ms');
      expect(formatDuration(50)).toBe('50ms');
      expect(formatDuration(150)).toBe('150ms');
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should handle edge cases around 1 second boundary', () => {
      expect(formatDuration(999)).toBe('999ms');
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1001)).toBe('1.0s');
    });

    it('should format fractional milliseconds as whole numbers', () => {
      expect(formatDuration(150.7)).toBe('150ms');
      expect(formatDuration(999.9)).toBe('999ms');
    });
  });

  describe('Second formatting', () => {
    it('should format seconds with one decimal place', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(2300)).toBe('2.3s');
      expect(formatDuration(5000)).toBe('5.0s');
      expect(formatDuration(10500)).toBe('10.5s');
    });

    it('should round to one decimal place correctly', () => {
      expect(formatDuration(1230)).toBe('1.2s');
      expect(formatDuration(1250)).toBe('1.2s');
      expect(formatDuration(1260)).toBe('1.3s');
      expect(formatDuration(1990)).toBe('2.0s');
    });

    it('should handle edge cases around 1 minute boundary', () => {
      expect(formatDuration(59000)).toBe('59.0s');
      expect(formatDuration(59500)).toBe('59.5s');
      expect(formatDuration(59999)).toBe('60.0s');
      expect(formatDuration(60000)).toBe('1m 0s');
    });
  });

  describe('Minute formatting', () => {
    it('should format minutes and seconds correctly', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(61000)).toBe('1m 1s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(125000)).toBe('2m 5s');
      expect(formatDuration(3570000)).toBe('59m 30s');
    });

    it('should handle exact minute boundaries', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(120000)).toBe('2m 0s');
      expect(formatDuration(600000)).toBe('10m 0s');
    });

    it('should round seconds in minute display', () => {
      expect(formatDuration(61500)).toBe('1m 1s');
      expect(formatDuration(61999)).toBe('1m 1s');
      expect(formatDuration(92500)).toBe('1m 32s');
    });

    it('should handle edge cases around 1 hour boundary', () => {
      expect(formatDuration(3599000)).toBe('59m 59s');
      expect(formatDuration(3600000)).toBe('1h 0m');
    });
  });

  describe('Hour formatting', () => {
    it('should format hours and minutes correctly', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(3660000)).toBe('1h 1m');
      expect(formatDuration(7200000)).toBe('2h 0m');
      expect(formatDuration(9900000)).toBe('2h 45m');
    });

    it('should not show seconds when hours are present', () => {
      expect(formatDuration(3661000)).toBe('1h 1m');
      expect(formatDuration(3730000)).toBe('1h 2m');
      expect(formatDuration(7230000)).toBe('2h 0m');
    });

    it('should handle large durations correctly', () => {
      expect(formatDuration(36000000)).toBe('10h 0m');
      expect(formatDuration(90000000)).toBe('25h 0m');
      expect(formatDuration(356400000)).toBe('99h 0m');
    });

    it('should round minutes in hour display', () => {
      expect(formatDuration(3630000)).toBe('1h 0m');
      expect(formatDuration(3690000)).toBe('1h 1m');
      expect(formatDuration(3750000)).toBe('1h 2m');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0ms');
    });

    it('should handle negative durations gracefully', () => {
      expect(formatDuration(-1000)).toBe('-1000ms');
      expect(formatDuration(-5000)).toBe('-5000ms');
    });

    it('should handle very large numbers', () => {
      const veryLarge = Number.MAX_SAFE_INTEGER;
      const result = formatDuration(veryLarge);
      expect(result).toMatch(/^\d+h \d+m$/);
    });

    it('should handle floating point precision issues', () => {
      expect(formatDuration(1000.1)).toBe('1.0s');
      expect(formatDuration(1000.9)).toBe('1.0s');
      expect(formatDuration(999.1)).toBe('999ms');
    });

    it('should handle NaN input', () => {
      expect(formatDuration(NaN)).toBe('NaNms');
    });

    it('should handle Infinity', () => {
      expect(formatDuration(Infinity)).toBe('Infinityms');
      expect(formatDuration(-Infinity)).toBe('-Infinityms');
    });
  });

  describe('Performance scenarios', () => {
    it('should handle typical tool execution times correctly', () => {
      // Fast operations
      expect(formatDuration(10)).toBe('10ms');
      expect(formatDuration(50)).toBe('50ms');
      expect(formatDuration(100)).toBe('100ms');

      // Medium operations
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(3000)).toBe('3.0s');

      // Slow operations
      expect(formatDuration(15000)).toBe('15.0s');
      expect(formatDuration(45000)).toBe('45.0s');
      expect(formatDuration(120000)).toBe('2m 0s');

      // Very slow operations
      expect(formatDuration(300000)).toBe('5m 0s');
      expect(formatDuration(900000)).toBe('15m 0s');
      expect(formatDuration(3600000)).toBe('1h 0m');
    });

    it('should maintain precision for important ranges', () => {
      // Sub-second precision is important for fast tools
      expect(formatDuration(123)).toBe('123ms');
      expect(formatDuration(456)).toBe('456ms');

      // Decimal precision for seconds
      expect(formatDuration(1230)).toBe('1.2s');
      expect(formatDuration(2560)).toBe('2.6s');
      expect(formatDuration(9870)).toBe('9.9s');
    });
  });

  describe('Acceptance criteria compliance', () => {
    it('should format durations per acceptance criteria examples', () => {
      // Example: '2.3s'
      expect(formatDuration(2300)).toBe('2.3s');

      // Example: '150ms'
      expect(formatDuration(150)).toBe('150ms');
    });

    it('should provide human-readable format for all ranges', () => {
      const testCases = [
        { input: 50, expected: /^\d+ms$/ },
        { input: 1500, expected: /^\d+\.\d+s$/ },
        { input: 90000, expected: /^\d+m \d+s$/ },
        { input: 7200000, expected: /^\d+h \d+m$/ },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = formatDuration(input);
        expect(result).toMatch(expected);
      });
    });

    it('should be suitable for inline display with tool output', () => {
      // All formats should be concise for inline display
      expect(formatDuration(100).length).toBeLessThanOrEqual(10);
      expect(formatDuration(1500).length).toBeLessThanOrEqual(10);
      expect(formatDuration(90000).length).toBeLessThanOrEqual(10);
      expect(formatDuration(3600000).length).toBeLessThanOrEqual(10);
    });

    it('should handle real-world tool execution patterns', () => {
      // File operations
      expect(formatDuration(25)).toBe('25ms');    // Read small file
      expect(formatDuration(150)).toBe('150ms');  // Write file
      expect(formatDuration(800)).toBe('800ms');  // Edit large file

      // Command execution
      expect(formatDuration(1200)).toBe('1.2s');   // Quick bash command
      expect(formatDuration(5000)).toBe('5.0s');   // Longer command
      expect(formatDuration(30000)).toBe('30.0s'); // Build process

      // Search operations
      expect(formatDuration(50)).toBe('50ms');     // Glob search
      expect(formatDuration(300)).toBe('300ms');   // Grep search
      expect(formatDuration(2000)).toBe('2.0s');   // Complex search

      // Network operations
      expect(formatDuration(500)).toBe('500ms');   // Fast API call
      expect(formatDuration(3000)).toBe('3.0s');   // Slow API call
      expect(formatDuration(15000)).toBe('15.0s'); // Timeout scenario
    });
  });

  describe('Consistency and reliability', () => {
    it('should produce consistent output for same input', () => {
      const duration = 2345;
      const expected = formatDuration(duration);

      // Should be deterministic
      for (let i = 0; i < 10; i++) {
        expect(formatDuration(duration)).toBe(expected);
      }
    });

    it('should handle rapid successive calls', () => {
      const durations = [100, 1500, 60000, 3600000];
      const results = durations.map(formatDuration);

      // Should be stable across multiple calls
      expect(results).toEqual([
        '100ms',
        '1.5s',
        '1m 0s',
        '1h 0m'
      ]);
    });

    it('should maintain order relationships', () => {
      // Larger durations should not appear "smaller" than shorter ones
      expect(formatDuration(999)).toBe('999ms');
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(59999)).toBe('60.0s');
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(3599999)).toBe('59m 59s');
      expect(formatDuration(3600000)).toBe('1h 0m');
    });
  });
});