import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor } from './health-monitor';
import type { RestartRecord } from '@apexcli/core';

describe('HealthMonitor Restart History Tracking', () => {
  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    healthMonitor = new HealthMonitor({ maxRestartHistorySize: 10 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Restart record management', () => {
    it('should track restart events with complete metadata', () => {
      const timestamp = new Date('2023-10-15T14:30:00Z');
      vi.setSystemTime(timestamp);

      healthMonitor.recordRestart('application-crash', 1, false);

      const lastRestart = healthMonitor.getLastRestart();
      expect(lastRestart).toBeDefined();
      expect(lastRestart!.timestamp).toEqual(timestamp);
      expect(lastRestart!.reason).toBe('application-crash');
      expect(lastRestart!.exitCode).toBe(1);
      expect(lastRestart!.triggeredByWatchdog).toBe(false);
    });

    it('should maintain chronological order with most recent first', () => {
      const events = [
        { reason: 'first-restart', time: '2023-10-15T10:00:00Z' },
        { reason: 'second-restart', time: '2023-10-15T11:00:00Z' },
        { reason: 'third-restart', time: '2023-10-15T12:00:00Z' },
      ];

      events.forEach(event => {
        vi.setSystemTime(new Date(event.time));
        healthMonitor.recordRestart(event.reason, 0, false);
      });

      const history = healthMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(3);
      expect(history[0].reason).toBe('third-restart'); // Most recent
      expect(history[1].reason).toBe('second-restart');
      expect(history[2].reason).toBe('first-restart'); // Oldest
    });

    it('should enforce maximum restart history size', () => {
      const smallMonitor = new HealthMonitor({ maxRestartHistorySize: 3 });

      // Add more events than the limit
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(1000);
        smallMonitor.recordRestart(`restart-${i}`, i, false);
      }

      const history = smallMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(3);

      // Should keep the 3 most recent
      expect(history[0].reason).toBe('restart-4');
      expect(history[1].reason).toBe('restart-3');
      expect(history[2].reason).toBe('restart-2');
    });

    it('should handle zero maximum history size', () => {
      const noHistoryMonitor = new HealthMonitor({ maxRestartHistorySize: 0 });

      noHistoryMonitor.recordRestart('test-restart', 1, true);

      expect(noHistoryMonitor.getRestartCount()).toBe(0);
      expect(noHistoryMonitor.getLastRestart()).toBeUndefined();
      expect(noHistoryMonitor.hasWatchdogRestarts()).toBe(false);
    });

    it('should handle negative maximum history size gracefully', () => {
      const negativeHistoryMonitor = new HealthMonitor({ maxRestartHistorySize: -5 });

      negativeHistoryMonitor.recordRestart('test-restart', 1, true);

      expect(negativeHistoryMonitor.getRestartCount()).toBe(0);
      expect(negativeHistoryMonitor.getLastRestart()).toBeUndefined();
    });
  });

  describe('Watchdog restart tracking', () => {
    it('should correctly identify watchdog restarts', () => {
      healthMonitor.recordRestart('manual-restart', 0, false);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(false);

      healthMonitor.recordRestart('oom-kill', 137, true);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);
    });

    it('should maintain watchdog tracking across history trimming', () => {
      const smallMonitor = new HealthMonitor({ maxRestartHistorySize: 2 });

      // Add non-watchdog restart
      smallMonitor.recordRestart('manual-1', 0, false);

      // Add watchdog restart
      vi.advanceTimersByTime(1000);
      smallMonitor.recordRestart('watchdog-restart', 9, true);

      // Add more non-watchdog restarts (should push out the first manual)
      vi.advanceTimersByTime(1000);
      smallMonitor.recordRestart('manual-2', 0, false);

      vi.advanceTimersByTime(1000);
      smallMonitor.recordRestart('manual-3', 0, false);

      // History should only have the 2 most recent
      const history = smallMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(2);
      expect(history[0].reason).toBe('manual-3');
      expect(history[1].reason).toBe('manual-2');

      // But watchdog tracking should still be true (checks all current history)
      expect(smallMonitor.hasWatchdogRestarts()).toBe(false);
    });

    it('should handle mixed restart types in history', () => {
      const restartTypes = [
        { reason: 'manual', watchdog: false },
        { reason: 'crash', watchdog: false },
        { reason: 'oom', watchdog: true },
        { reason: 'timeout', watchdog: true },
        { reason: 'signal', watchdog: false },
      ];

      restartTypes.forEach((restart, i) => {
        vi.advanceTimersByTime(1000);
        healthMonitor.recordRestart(restart.reason, i, restart.watchdog);
      });

      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);

      const history = healthMonitor.getHealthReport().restartHistory;
      const watchdogRestarts = history.filter(r => r.triggeredByWatchdog);
      const manualRestarts = history.filter(r => !r.triggeredByWatchdog);

      expect(watchdogRestarts).toHaveLength(2);
      expect(manualRestarts).toHaveLength(3);
    });
  });

  describe('Restart reason handling', () => {
    it('should handle various restart reason formats', () => {
      const reasons = [
        'simple-restart',
        'restart with spaces',
        'restart/with/paths',
        'restart-with-numbers-123',
        'UPPERCASE-RESTART',
        'MiXeD-CaSe-ReStArT',
        '',  // Empty string
        '   whitespace-padded   ',
      ];

      reasons.forEach(reason => {
        vi.advanceTimersByTime(1000);
        healthMonitor.recordRestart(reason, 0, false);
      });

      const history = healthMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(8);

      // Check that all reasons are preserved exactly as provided
      expect(history[0].reason).toBe('   whitespace-padded   ');
      expect(history[1].reason).toBe('');
      expect(history[2].reason).toBe('UPPERCASE-RESTART');
    });

    it('should handle unicode and special characters in restart reasons', () => {
      const unicodeReasons = [
        'restart-éñ-test',
        'restart-中文-test',
        'restart-🚀-emoji',
        'restart-\n-newline',
        'restart-\t-tab',
        'restart-"quotes"-test',
        "restart-'apostrophe'-test",
        'restart-[brackets]-test',
      ];

      unicodeReasons.forEach(reason => {
        vi.advanceTimersByTime(1000);
        healthMonitor.recordRestart(reason, 0, false);
      });

      const history = healthMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(8);

      // Verify unicode preservation
      expect(history.find(r => r.reason.includes('éñ'))).toBeDefined();
      expect(history.find(r => r.reason.includes('中文'))).toBeDefined();
      expect(history.find(r => r.reason.includes('🚀'))).toBeDefined();
    });

    it('should handle very long restart reasons', () => {
      const longReason = 'a'.repeat(1000); // 1000 character reason
      const veryLongReason = 'b'.repeat(10000); // 10000 character reason

      healthMonitor.recordRestart(longReason, 1, false);
      healthMonitor.recordRestart(veryLongReason, 2, true);

      const history = healthMonitor.getHealthReport().restartHistory;
      expect(history[0].reason).toBe(veryLongReason);
      expect(history[0].reason).toHaveLength(10000);
      expect(history[1].reason).toBe(longReason);
      expect(history[1].reason).toHaveLength(1000);
    });
  });

  describe('Exit code tracking', () => {
    it('should handle various exit code scenarios', () => {
      const exitCodeScenarios = [
        { reason: 'success', exitCode: 0 },
        { reason: 'general-error', exitCode: 1 },
        { reason: 'permission-denied', exitCode: 126 },
        { reason: 'command-not-found', exitCode: 127 },
        { reason: 'invalid-exit', exitCode: 128 },
        { reason: 'sigterm', exitCode: 143 },
        { reason: 'sigkill', exitCode: 137 },
        { reason: 'no-exit-code', exitCode: undefined },
        { reason: 'zero-exit', exitCode: 0 },
        { reason: 'negative-exit', exitCode: -1 },
        { reason: 'large-exit', exitCode: 999 },
      ];

      exitCodeScenarios.forEach(scenario => {
        vi.advanceTimersByTime(1000);
        healthMonitor.recordRestart(scenario.reason, scenario.exitCode, false);
      });

      const history = healthMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(11);

      // Verify exit codes are preserved
      const largeExitRecord = history.find(r => r.reason === 'large-exit');
      expect(largeExitRecord?.exitCode).toBe(999);

      const negativeExitRecord = history.find(r => r.reason === 'negative-exit');
      expect(negativeExitRecord?.exitCode).toBe(-1);

      const undefinedExitRecord = history.find(r => r.reason === 'no-exit-code');
      expect(undefinedExitRecord?.exitCode).toBeUndefined();

      const zeroExitRecord = history.find(r => r.reason === 'zero-exit');
      expect(zeroExitRecord?.exitCode).toBe(0);
    });

    it('should differentiate between undefined and zero exit codes', () => {
      healthMonitor.recordRestart('undefined-exit', undefined, false);
      vi.advanceTimersByTime(1000);
      healthMonitor.recordRestart('zero-exit', 0, false);

      const history = healthMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(2);

      const zeroExit = history.find(r => r.reason === 'zero-exit');
      const undefinedExit = history.find(r => r.reason === 'undefined-exit');

      expect(zeroExit?.exitCode).toBe(0);
      expect(undefinedExit?.exitCode).toBeUndefined();
      expect(zeroExit?.exitCode !== undefinedExit?.exitCode).toBe(true);
    });
  });

  describe('Timestamp accuracy and ordering', () => {
    it('should use precise timestamps for restart events', () => {
      const baseTime = new Date('2023-10-15T14:30:00.000Z');

      // Record restarts with precise timing
      vi.setSystemTime(baseTime);
      healthMonitor.recordRestart('first', 1, false);

      vi.setSystemTime(new Date(baseTime.getTime() + 1)); // 1ms later
      healthMonitor.recordRestart('second', 2, false);

      vi.setSystemTime(new Date(baseTime.getTime() + 100)); // 100ms later
      healthMonitor.recordRestart('third', 3, false);

      const history = healthMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(3);

      // Should maintain precise order
      expect(history[0].reason).toBe('third');
      expect(history[0].timestamp.getTime()).toBe(baseTime.getTime() + 100);

      expect(history[1].reason).toBe('second');
      expect(history[1].timestamp.getTime()).toBe(baseTime.getTime() + 1);

      expect(history[2].reason).toBe('first');
      expect(history[2].timestamp.getTime()).toBe(baseTime.getTime());
    });

    it('should handle simultaneous restarts with same timestamp', () => {
      const exactTime = new Date('2023-10-15T14:30:00.000Z');
      vi.setSystemTime(exactTime);

      // Record multiple restarts at the exact same time
      healthMonitor.recordRestart('simultaneous-1', 1, false);
      healthMonitor.recordRestart('simultaneous-2', 2, false);
      healthMonitor.recordRestart('simultaneous-3', 3, false);

      const history = healthMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(3);

      // All should have the same timestamp
      history.forEach(record => {
        expect(record.timestamp).toEqual(exactTime);
      });

      // Order should be based on insertion (most recent first)
      expect(history[0].reason).toBe('simultaneous-3');
      expect(history[1].reason).toBe('simultaneous-2');
      expect(history[2].reason).toBe('simultaneous-1');
    });
  });

  describe('History clearing and resetting', () => {
    it('should completely clear restart history', () => {
      // Add several restart events
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(1000);
        healthMonitor.recordRestart(`restart-${i}`, i, i % 2 === 0);
      }

      expect(healthMonitor.getRestartCount()).toBe(5);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);

      healthMonitor.clearRestartHistory();

      expect(healthMonitor.getRestartCount()).toBe(0);
      expect(healthMonitor.getLastRestart()).toBeUndefined();
      expect(healthMonitor.hasWatchdogRestarts()).toBe(false);

      const history = healthMonitor.getHealthReport().restartHistory;
      expect(history).toHaveLength(0);
    });

    it('should allow new restarts after clearing history', () => {
      // Add and clear
      healthMonitor.recordRestart('before-clear', 1, true);
      healthMonitor.clearRestartHistory();

      // Add new restarts
      healthMonitor.recordRestart('after-clear', 2, false);

      expect(healthMonitor.getRestartCount()).toBe(1);
      expect(healthMonitor.getLastRestart()?.reason).toBe('after-clear');
      expect(healthMonitor.hasWatchdogRestarts()).toBe(false);
    });

    it('should not affect other monitoring data when clearing restart history', () => {
      // Setup other monitoring data
      healthMonitor.performHealthCheck(true);
      healthMonitor.performHealthCheck(false);
      healthMonitor.recordRestart('test-restart', 1, true);

      const beforeClear = healthMonitor.getHealthReport();
      expect(beforeClear.healthChecksPassed).toBe(1);
      expect(beforeClear.healthChecksFailed).toBe(1);

      healthMonitor.clearRestartHistory();

      const afterClear = healthMonitor.getHealthReport();
      expect(afterClear.healthChecksPassed).toBe(1); // Should be preserved
      expect(afterClear.healthChecksFailed).toBe(1); // Should be preserved
      expect(afterClear.restartHistory).toHaveLength(0); // Should be cleared
      expect(afterClear.uptime).toBeGreaterThan(0); // Should be preserved
    });
  });

  describe('Comprehensive restart scenarios', () => {
    it('should handle complex restart patterns realistically', () => {
      const restartScenarios = [
        // Normal operation start
        { time: 0, reason: 'initial-start', exitCode: undefined, watchdog: false },

        // Manual restarts for maintenance
        { time: 3600000, reason: 'scheduled-maintenance', exitCode: 0, watchdog: false },
        { time: 3660000, reason: 'config-reload', exitCode: 0, watchdog: false },

        // Application issues
        { time: 7200000, reason: 'memory-leak-detected', exitCode: 1, watchdog: false },
        { time: 7260000, reason: 'database-connection-lost', exitCode: 2, watchdog: false },

        // Watchdog interventions
        { time: 10800000, reason: 'health-check-timeout', exitCode: 143, watchdog: true },
        { time: 10860000, reason: 'resource-exhaustion', exitCode: 137, watchdog: true },

        // System-level issues
        { time: 14400000, reason: 'disk-space-critical', exitCode: 28, watchdog: true },
        { time: 14460000, reason: 'network-interface-down', exitCode: 1, watchdog: false },

        // Recovery
        { time: 18000000, reason: 'automatic-recovery', exitCode: 0, watchdog: false },
      ];

      restartScenarios.forEach(scenario => {
        vi.setSystemTime(scenario.time);
        healthMonitor.recordRestart(scenario.reason, scenario.exitCode, scenario.watchdog);
      });

      const report = healthMonitor.getHealthReport();

      expect(report.restartHistory).toHaveLength(10);
      expect(healthMonitor.hasWatchdogRestarts()).toBe(true);

      // Verify specific patterns
      const watchdogRestarts = report.restartHistory.filter(r => r.triggeredByWatchdog);
      expect(watchdogRestarts).toHaveLength(3);

      const successfulRestarts = report.restartHistory.filter(r => r.exitCode === 0);
      expect(successfulRestarts).toHaveLength(3);

      const criticalRestarts = report.restartHistory.filter(r =>
        r.exitCode && r.exitCode > 100
      );
      expect(criticalRestarts).toHaveLength(2);
    });

    it('should maintain performance with frequent restart events', () => {
      const monitor = new HealthMonitor({ maxRestartHistorySize: 100 });

      const startTime = Date.now();

      // Simulate high-frequency restart scenario
      for (let i = 0; i < 1000; i++) {
        vi.advanceTimersByTime(100); // 100ms intervals
        monitor.recordRestart(`frequent-restart-${i}`, i % 10, i % 5 === 0);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly despite many events
      expect(duration).toBeLessThan(50);

      // Should maintain bounded memory usage
      expect(monitor.getRestartCount()).toBe(100);
      expect(monitor.hasWatchdogRestarts()).toBe(true);

      // Should maintain correct ordering
      const lastRestart = monitor.getLastRestart();
      expect(lastRestart?.reason).toBe('frequent-restart-999');
    });
  });
});