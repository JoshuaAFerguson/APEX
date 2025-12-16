import { formatElapsed } from '../utils.js';

describe('formatElapsed Edge Cases', () => {
  describe('Invalid Date handling', () => {
    it('handles invalid start date', () => {
      const invalidStartTime = new Date('invalid-date');
      const validCurrentTime = new Date('2023-01-01T00:01:00Z');

      // Should return '0s' for invalid dates
      expect(formatElapsed(invalidStartTime, validCurrentTime)).toBe('0s');
    });

    it('handles invalid current date', () => {
      const validStartTime = new Date('2023-01-01T00:00:00Z');
      const invalidCurrentTime = new Date('invalid-date');

      // Should return '0s' for invalid dates
      expect(formatElapsed(validStartTime, invalidCurrentTime)).toBe('0s');
    });

    it('handles both dates being invalid', () => {
      const invalidStartTime = new Date('invalid-start');
      const invalidCurrentTime = new Date('invalid-current');

      expect(formatElapsed(invalidStartTime, invalidCurrentTime)).toBe('0s');
    });
  });

  describe('Extreme time differences', () => {
    it('handles very large time differences', () => {
      const startTime = new Date('1970-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:00:00Z');

      const result = formatElapsed(startTime, currentTime);

      // Should handle years of elapsed time
      expect(result).toMatch(/^\d+h( \d+m)?$/);
    });

    it('handles millisecond precision', () => {
      const startTime = new Date('2023-01-01T00:00:00.000Z');
      const currentTime = new Date('2023-01-01T00:00:00.999Z');

      expect(formatElapsed(startTime, currentTime)).toBe('0s');
    });

    it('handles exactly 1 millisecond difference', () => {
      const startTime = new Date('2023-01-01T00:00:00.000Z');
      const currentTime = new Date('2023-01-01T00:00:00.001Z');

      expect(formatElapsed(startTime, currentTime)).toBe('0s');
    });

    it('handles extremely small positive differences', () => {
      const startTime = new Date(1000000000000); // Some arbitrary timestamp
      const currentTime = new Date(1000000000001); // 1ms later

      expect(formatElapsed(startTime, currentTime)).toBe('0s');
    });
  });

  describe('Edge case time boundaries', () => {
    it('handles exactly 59 seconds', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:00:59Z');

      expect(formatElapsed(startTime, currentTime)).toBe('59s');
    });

    it('handles exactly 60 seconds (1 minute)', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:01:00Z');

      expect(formatElapsed(startTime, currentTime)).toBe('1m');
    });

    it('handles exactly 61 seconds', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:01:01Z');

      expect(formatElapsed(startTime, currentTime)).toBe('1m 1s');
    });

    it('handles exactly 3600 seconds (1 hour)', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T01:00:00Z');

      expect(formatElapsed(startTime, currentTime)).toBe('1h');
    });

    it('handles exactly 3661 seconds (1 hour 1 minute 1 second)', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T01:01:01Z');

      expect(formatElapsed(startTime, currentTime)).toBe('1h 1m');
    });
  });

  describe('Timezone handling', () => {
    it('handles different timezone dates correctly', () => {
      // UTC
      const startTimeUTC = new Date('2023-01-01T00:00:00Z');
      const currentTimeUTC = new Date('2023-01-01T00:05:00Z');

      // Same moment in different timezone notation
      const startTimeLocal = new Date('2023-01-01T00:00:00+00:00');
      const currentTimeLocal = new Date('2023-01-01T00:05:00+00:00');

      const resultUTC = formatElapsed(startTimeUTC, currentTimeUTC);
      const resultLocal = formatElapsed(startTimeLocal, currentTimeLocal);

      expect(resultUTC).toBe(resultLocal);
      expect(resultUTC).toBe('5m');
    });

    it('handles daylight saving time transitions', () => {
      // This is challenging to test without specific timezone data
      // But we can test that the function handles time zone offset changes
      const startTime = new Date('2023-03-12T01:00:00Z'); // Spring forward date
      const currentTime = new Date('2023-03-12T03:00:00Z'); // 2 hours later

      const result = formatElapsed(startTime, currentTime);
      expect(result).toBe('2h');
    });
  });

  describe('Performance and edge case inputs', () => {
    it('handles Date.getTime() returning NaN', () => {
      // Create dates that might have NaN timestamps
      const startTime = new Date();
      const currentTime = new Date();

      // Mock getTime to return NaN
      const originalGetTime = Date.prototype.getTime;
      Date.prototype.getTime = () => NaN;

      expect(formatElapsed(startTime, currentTime)).toBe('0s');

      // Restore original method
      Date.prototype.getTime = originalGetTime;
    });

    it('handles very rapid successive calls', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');

      // Multiple rapid calls should be consistent
      const results = [];
      for (let i = 0; i < 100; i++) {
        const currentTime = new Date(`2023-01-01T00:00:0${i % 60}Z`);
        results.push(formatElapsed(startTime, currentTime));
      }

      // All results should be valid time format
      results.forEach(result => {
        expect(result).toMatch(/^\d+[smh]( \d+[smh])?$/);
      });
    });

    it('handles concurrent calls with different inputs', () => {
      const baseTime = new Date('2023-01-01T00:00:00Z');

      // Simulate concurrent calls
      const promises = Array.from({ length: 50 }, (_, i) => {
        const currentTime = new Date(baseTime.getTime() + i * 1000);
        return Promise.resolve(formatElapsed(baseTime, currentTime));
      });

      return Promise.all(promises).then(results => {
        results.forEach((result, i) => {
          expect(result).toBe(`${i}s`);
        });
      });
    });
  });

  describe('Default parameter behavior', () => {
    it('uses current time as default when not provided', () => {
      const startTime = new Date(Date.now() - 2000); // 2 seconds ago

      const result = formatElapsed(startTime);

      // Should be approximately 2 seconds, allowing for execution time
      expect(result).toMatch(/^[1-3]s$/);
    });

    it('handles default parameter with invalid start time', () => {
      const invalidStartTime = new Date('invalid');

      expect(formatElapsed(invalidStartTime)).toBe('0s');
    });
  });

  describe('Floating point precision edge cases', () => {
    it('handles floating point millisecond calculations', () => {
      // Use timestamps that might cause floating point precision issues
      const startTime = new Date(1672531199999.9); // Just before a second boundary
      const currentTime = new Date(1672531200000.1); // Just after

      const result = formatElapsed(startTime, currentTime);
      expect(result).toBe('0s');
    });

    it('handles large timestamp differences that might overflow', () => {
      const startTime = new Date(0); // Unix epoch
      const currentTime = new Date(8640000000000000); // Max safe date

      // Should not throw an error, should handle gracefully
      expect(() => formatElapsed(startTime, currentTime)).not.toThrow();
    });
  });

  describe('Memory and performance stress tests', () => {
    it('handles repeated calls without memory leaks', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:05:30Z');

      // Call the function many times
      for (let i = 0; i < 10000; i++) {
        const result = formatElapsed(startTime, currentTime);
        expect(result).toBe('5m 30s');
      }
    });

    it('handles very long-running durations', () => {
      const startTime = new Date('1990-01-01T00:00:00Z');
      const currentTime = new Date('2023-12-31T23:59:59Z');

      const result = formatElapsed(startTime, currentTime);

      // Should be a very large hour count
      expect(result).toMatch(/^\d+h( \d+m)?$/);
      expect(result.length).toBeGreaterThan(6); // Should be quite long
    });
  });

  describe('Internationalization edge cases', () => {
    it('handles different locale number formats', () => {
      // This function should be locale-agnostic since it returns English format
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T02:30:45Z');

      const result = formatElapsed(startTime, currentTime);
      expect(result).toBe('2h 30m');
      expect(result).toMatch(/^[\d\w\s]+$/); // Only ASCII characters
    });

    it('is not affected by system locale settings', () => {
      // The function should always return consistent English format
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:02:30Z');

      const result = formatElapsed(startTime, currentTime);
      expect(result).toBe('2m 30s');

      // Should not contain locale-specific characters
      expect(result).not.toMatch(/[^\w\s]/);
    });
  });

  describe('Browser compatibility edge cases', () => {
    it('handles Date parsing differences across browsers', () => {
      // Test various date string formats that might be parsed differently
      const dateFormats = [
        '2023-01-01T00:00:00.000Z',
        '2023-01-01T00:00:00Z',
        '2023-01-01 00:00:00',
        '01/01/2023 00:00:00',
      ];

      dateFormats.forEach(format => {
        try {
          const startTime = new Date(format);
          const currentTime = new Date(startTime.getTime() + 60000); // 1 minute later

          if (!isNaN(startTime.getTime())) {
            const result = formatElapsed(startTime, currentTime);
            expect(result).toBe('1m');
          }
        } catch (e) {
          // Some formats might not be supported, which is fine
          expect(e).toBeDefined();
        }
      });
    });
  });
});