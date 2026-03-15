import { describe, it, expect } from 'vitest';
import {
  formatLatency,
  formatUptime,
  getConnectionStatus,
  CONNECTION_STATUS_LABELS,
  CONNECTION_STATUS_STYLES,
  type WebSocketConnectionStatus,
} from '../websocket-connection';

describe('WebSocket Connection Utilities', () => {
  describe('formatLatency', () => {
    it('returns "N/A" for null latency', () => {
      expect(formatLatency(null)).toBe('N/A');
    });

    it('formats milliseconds for values under 1000ms', () => {
      expect(formatLatency(0)).toBe('0ms');
      expect(formatLatency(45)).toBe('45ms');
      expect(formatLatency(999)).toBe('999ms');
      expect(formatLatency(123.7)).toBe('124ms'); // Rounds
    });

    it('formats seconds for values 1000ms and above', () => {
      expect(formatLatency(1000)).toBe('1.0s');
      expect(formatLatency(1500)).toBe('1.5s');
      expect(formatLatency(2345)).toBe('2.3s');
      expect(formatLatency(10000)).toBe('10.0s');
    });

    it('handles edge cases', () => {
      expect(formatLatency(0.1)).toBe('0ms');
      expect(formatLatency(999.9)).toBe('1000ms');
      expect(formatLatency(1000.1)).toBe('1.0s');
    });
  });

  describe('formatUptime', () => {
    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;

    it('returns "N/A" for null uptime', () => {
      expect(formatUptime(null)).toBe('N/A');
    });

    it('formats seconds only for values under 1 minute', () => {
      expect(formatUptime(0)).toBe('0s');
      expect(formatUptime(30 * SECOND)).toBe('30s');
      expect(formatUptime(59 * SECOND)).toBe('59s');
    });

    it('formats minutes and seconds for values under 1 hour', () => {
      expect(formatUptime(1 * MINUTE)).toBe('1m');
      expect(formatUptime(1 * MINUTE + 30 * SECOND)).toBe('1m 30s');
      expect(formatUptime(45 * MINUTE)).toBe('45m');
      expect(formatUptime(59 * MINUTE + 59 * SECOND)).toBe('59m 59s');
    });

    it('formats hours and minutes for values under 1 day', () => {
      expect(formatUptime(1 * HOUR)).toBe('1h');
      expect(formatUptime(1 * HOUR + 30 * MINUTE)).toBe('1h 30m');
      expect(formatUptime(12 * HOUR)).toBe('12h');
      expect(formatUptime(23 * HOUR + 59 * MINUTE)).toBe('23h 59m');
    });

    it('formats days and hours for values 1 day and above', () => {
      expect(formatUptime(1 * DAY)).toBe('1d');
      expect(formatUptime(1 * DAY + 5 * HOUR)).toBe('1d 5h');
      expect(formatUptime(7 * DAY)).toBe('7d');
      expect(formatUptime(30 * DAY + 12 * HOUR)).toBe('30d 12h');
    });

    it('omits zero components', () => {
      expect(formatUptime(2 * MINUTE)).toBe('2m'); // No seconds
      expect(formatUptime(3 * HOUR)).toBe('3h'); // No minutes
      expect(formatUptime(5 * DAY)).toBe('5d'); // No hours
    });

    it('handles edge cases', () => {
      expect(formatUptime(500)).toBe('0s'); // Less than 1 second
      expect(formatUptime(999)).toBe('0s'); // Just under 1 second
      expect(formatUptime(1001)).toBe('1s'); // Just over 1 second
    });
  });

  describe('getConnectionStatus', () => {
    it('returns "disconnected" when not connected and not reconnecting', () => {
      expect(getConnectionStatus(false, false, true, 0)).toBe('disconnected');
    });

    it('returns "error" when not connected and has consecutive failures', () => {
      expect(getConnectionStatus(false, false, true, 1)).toBe('error');
      expect(getConnectionStatus(false, false, true, 5)).toBe('error');
    });

    it('returns "reconnecting" when not connected but reconnecting', () => {
      expect(getConnectionStatus(false, true, true, 0)).toBe('reconnecting');
      expect(getConnectionStatus(false, true, false, 3)).toBe('reconnecting');
    });

    it('returns "connecting" when connected but reconnecting', () => {
      expect(getConnectionStatus(true, true, true, 0)).toBe('connecting');
      expect(getConnectionStatus(true, true, false, 2)).toBe('connecting');
    });

    it('returns "connected" when connected, healthy, and not reconnecting', () => {
      expect(getConnectionStatus(true, false, true, 0)).toBe('connected');
    });

    it('returns "error" when connected but not healthy', () => {
      expect(getConnectionStatus(true, false, false, 0)).toBe('error');
      expect(getConnectionStatus(true, false, false, 3)).toBe('error');
    });

    it('handles all possible state combinations', () => {
      // Test matrix of all combinations
      const testCases: Array<{
        isConnected: boolean;
        isReconnecting: boolean;
        isHealthy: boolean;
        consecutiveFailures: number;
        expected: WebSocketConnectionStatus;
      }> = [
        // Not connected, not reconnecting
        { isConnected: false, isReconnecting: false, isHealthy: true, consecutiveFailures: 0, expected: 'disconnected' },
        { isConnected: false, isReconnecting: false, isHealthy: true, consecutiveFailures: 1, expected: 'error' },
        { isConnected: false, isReconnecting: false, isHealthy: false, consecutiveFailures: 0, expected: 'disconnected' },
        { isConnected: false, isReconnecting: false, isHealthy: false, consecutiveFailures: 1, expected: 'error' },

        // Not connected, reconnecting
        { isConnected: false, isReconnecting: true, isHealthy: true, consecutiveFailures: 0, expected: 'reconnecting' },
        { isConnected: false, isReconnecting: true, isHealthy: true, consecutiveFailures: 1, expected: 'reconnecting' },
        { isConnected: false, isReconnecting: true, isHealthy: false, consecutiveFailures: 0, expected: 'reconnecting' },
        { isConnected: false, isReconnecting: true, isHealthy: false, consecutiveFailures: 1, expected: 'reconnecting' },

        // Connected, not reconnecting
        { isConnected: true, isReconnecting: false, isHealthy: true, consecutiveFailures: 0, expected: 'connected' },
        { isConnected: true, isReconnecting: false, isHealthy: true, consecutiveFailures: 1, expected: 'connected' },
        { isConnected: true, isReconnecting: false, isHealthy: false, consecutiveFailures: 0, expected: 'error' },
        { isConnected: true, isReconnecting: false, isHealthy: false, consecutiveFailures: 1, expected: 'error' },

        // Connected, reconnecting
        { isConnected: true, isReconnecting: true, isHealthy: true, consecutiveFailures: 0, expected: 'connecting' },
        { isConnected: true, isReconnecting: true, isHealthy: true, consecutiveFailures: 1, expected: 'connecting' },
        { isConnected: true, isReconnecting: true, isHealthy: false, consecutiveFailures: 0, expected: 'connecting' },
        { isConnected: true, isReconnecting: true, isHealthy: false, consecutiveFailures: 1, expected: 'connecting' },
      ];

      testCases.forEach(({ isConnected, isReconnecting, isHealthy, consecutiveFailures, expected }) => {
        const result = getConnectionStatus(isConnected, isReconnecting, isHealthy, consecutiveFailures);
        expect(result).toBe(expected);
      });
    });
  });

  describe('CONNECTION_STATUS_LABELS', () => {
    it('has labels for all status values', () => {
      const expectedStatuses: WebSocketConnectionStatus[] = [
        'connected',
        'disconnected',
        'connecting',
        'reconnecting',
        'error'
      ];

      expectedStatuses.forEach(status => {
        expect(CONNECTION_STATUS_LABELS).toHaveProperty(status);
        expect(typeof CONNECTION_STATUS_LABELS[status]).toBe('string');
        expect(CONNECTION_STATUS_LABELS[status].length).toBeGreaterThan(0);
      });
    });

    it('has expected label values', () => {
      expect(CONNECTION_STATUS_LABELS.connected).toBe('Connected');
      expect(CONNECTION_STATUS_LABELS.disconnected).toBe('Disconnected');
      expect(CONNECTION_STATUS_LABELS.connecting).toBe('Connecting...');
      expect(CONNECTION_STATUS_LABELS.reconnecting).toBe('Reconnecting');
      expect(CONNECTION_STATUS_LABELS.error).toBe('Connection Error');
    });
  });

  describe('CONNECTION_STATUS_STYLES', () => {
    it('has style configurations for all status values', () => {
      const expectedStatuses: WebSocketConnectionStatus[] = [
        'connected',
        'disconnected',
        'connecting',
        'reconnecting',
        'error'
      ];

      expectedStatuses.forEach(status => {
        expect(CONNECTION_STATUS_STYLES).toHaveProperty(status);

        const styles = CONNECTION_STATUS_STYLES[status];
        expect(styles).toHaveProperty('bg');
        expect(styles).toHaveProperty('text');
        expect(styles).toHaveProperty('border');
        expect(styles).toHaveProperty('icon');
        expect(styles).toHaveProperty('dot');
        expect(styles).toHaveProperty('glow');

        // Ensure all style values are strings
        Object.values(styles).forEach(styleValue => {
          expect(typeof styleValue).toBe('string');
          expect(styleValue.length).toBeGreaterThan(0);
        });
      });
    });

    it('has consistent color schemes for status groups', () => {
      // Connected should use green colors
      expect(CONNECTION_STATUS_STYLES.connected.text).toContain('green');
      expect(CONNECTION_STATUS_STYLES.connected.icon).toContain('green');

      // Disconnected and error should use red colors
      expect(CONNECTION_STATUS_STYLES.disconnected.text).toContain('red');
      expect(CONNECTION_STATUS_STYLES.disconnected.icon).toContain('red');
      expect(CONNECTION_STATUS_STYLES.error.text).toContain('red');
      expect(CONNECTION_STATUS_STYLES.error.icon).toContain('red');

      // Connecting should use apex colors
      expect(CONNECTION_STATUS_STYLES.connecting.text).toContain('apex');
      expect(CONNECTION_STATUS_STYLES.connecting.icon).toContain('apex');

      // Reconnecting should use yellow colors
      expect(CONNECTION_STATUS_STYLES.reconnecting.text).toContain('yellow');
      expect(CONNECTION_STATUS_STYLES.reconnecting.icon).toContain('yellow');
    });

    it('follows consistent naming patterns', () => {
      Object.values(CONNECTION_STATUS_STYLES).forEach(styles => {
        // Background should start with 'bg-'
        expect(styles.bg).toMatch(/^bg-/);

        // Text should start with 'text-'
        expect(styles.text).toMatch(/^text-/);

        // Border should start with 'border-'
        expect(styles.border).toMatch(/^border-/);

        // Icon should start with 'text-'
        expect(styles.icon).toMatch(/^text-/);

        // Dot should start with 'bg-'
        expect(styles.dot).toMatch(/^bg-/);

        // Glow should start with 'shadow-'
        expect(styles.glow).toMatch(/^shadow-/);
      });
    });
  });

  describe('Edge Cases and Type Safety', () => {
    it('handles extreme latency values', () => {
      expect(formatLatency(0)).toBe('0ms');
      expect(formatLatency(Number.MAX_SAFE_INTEGER)).toMatch(/^\d+\.\ds$/);
    });

    it('handles extreme uptime values', () => {
      expect(formatUptime(0)).toBe('0s');
      expect(formatUptime(Number.MAX_SAFE_INTEGER)).toMatch(/^\d+d/);
    });

    it('getConnectionStatus returns valid status for any input combination', () => {
      const booleanValues = [true, false];
      const failureCounts = [0, 1, 5, 100];

      booleanValues.forEach(isConnected => {
        booleanValues.forEach(isReconnecting => {
          booleanValues.forEach(isHealthy => {
            failureCounts.forEach(failures => {
              const status = getConnectionStatus(isConnected, isReconnecting, isHealthy, failures);
              const validStatuses: WebSocketConnectionStatus[] = [
                'connected', 'disconnected', 'connecting', 'reconnecting', 'error'
              ];
              expect(validStatuses).toContain(status);
            });
          });
        });
      });
    });
  });

  describe('Performance Considerations', () => {
    it('formatLatency performs consistently for large datasets', () => {
      const testValues = Array.from({ length: 1000 }, (_, i) => i * 10);

      const start = performance.now();
      testValues.forEach(value => formatLatency(value));
      const end = performance.now();

      // Should complete in reasonable time (less than 10ms for 1000 operations)
      expect(end - start).toBeLessThan(10);
    });

    it('formatUptime performs consistently for large datasets', () => {
      const testValues = Array.from({ length: 1000 }, (_, i) => i * 60000); // minute intervals

      const start = performance.now();
      testValues.forEach(value => formatUptime(value));
      const end = performance.now();

      // Should complete in reasonable time (less than 20ms for 1000 operations)
      expect(end - start).toBeLessThan(20);
    });

    it('getConnectionStatus performs consistently for large datasets', () => {
      const testCombinations = [];
      const booleans = [true, false];
      const failures = [0, 1, 2, 3, 4, 5];

      // Generate all combinations
      booleans.forEach(connected => {
        booleans.forEach(reconnecting => {
          booleans.forEach(healthy => {
            failures.forEach(fail => {
              testCombinations.push([connected, reconnecting, healthy, fail]);
            });
          });
        });
      });

      const start = performance.now();
      testCombinations.forEach(([connected, reconnecting, healthy, fail]) => {
        getConnectionStatus(connected, reconnecting, healthy, fail);
      });
      const end = performance.now();

      // Should complete in reasonable time (less than 5ms for all combinations)
      expect(end - start).toBeLessThan(5);
    });
  });
});