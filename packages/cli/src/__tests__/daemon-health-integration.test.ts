import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleDaemonHealth } from '../handlers/daemon-handlers';
import { DaemonManager, DaemonError } from '@apex/orchestrator';
import type { HealthMetrics } from '@apexcli/core';

// Mock DaemonManager
vi.mock('@apex/orchestrator', () => ({
  DaemonManager: vi.fn(),
  DaemonError: class extends Error {
    constructor(message: string, public code: string, public cause?: Error) {
      super(message);
      this.name = 'DaemonError';
    }
  },
}));

// Mock chalk to capture output without color codes
vi.mock('chalk', () => ({
  default: {
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    cyan: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str,
  },
}));

const mockDaemonManager = vi.mocked(DaemonManager);

describe('Daemon Health Integration Tests', () => {
  let mockManager: any;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let ctx: { cwd: string; initialized: boolean };

  beforeEach(() => {
    vi.clearAllMocks();

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    ctx = { cwd: '/test/project', initialized: true };

    mockManager = {
      getHealthReport: vi.fn(),
    };

    mockDaemonManager.mockReturnValue(mockManager);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Complete health report scenarios', () => {
    it('should display comprehensive health report for healthy daemon', async () => {
      const healthReport: HealthMetrics = {
        uptime: 86400000, // 24 hours
        memoryUsage: {
          heapUsed: 134217728,  // 128MB
          heapTotal: 268435456, // 256MB
          rss: 402653184,       // 384MB
        },
        taskCounts: {
          processed: 1000,
          succeeded: 950,
          failed: 45,
          active: 5,
        },
        lastHealthCheck: new Date('2023-10-15T14:30:00Z'),
        healthChecksPassed: 1440, // 24 hours * 60 health checks per hour
        healthChecksFailed: 10,
        restartHistory: [
          {
            timestamp: new Date('2023-10-14T10:00:00Z'),
            reason: 'scheduled maintenance',
            exitCode: 0,
            triggeredByWatchdog: false,
          },
        ],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      // Verify main header
      expect(consoleSpy).toHaveBeenCalledWith('\nDaemon Health Report');
      expect(consoleSpy).toHaveBeenCalledWith('─'.repeat(50));

      // Verify uptime
      expect(consoleSpy).toHaveBeenCalledWith('  Uptime:              24h 0m');

      // Verify memory section
      expect(consoleSpy).toHaveBeenCalledWith('Memory Usage');
      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           128.0 MB / 256.0 MB (50.0%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 384.0 MB');

      // Verify task statistics
      expect(consoleSpy).toHaveBeenCalledWith('Task Statistics');
      expect(consoleSpy).toHaveBeenCalledWith('  Processed:           1000');
      expect(consoleSpy).toHaveBeenCalledWith('  Succeeded:           950');
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              45');
      expect(consoleSpy).toHaveBeenCalledWith('  Active:              5');

      // Verify health check statistics
      expect(consoleSpy).toHaveBeenCalledWith('Health Check Statistics');
      expect(consoleSpy).toHaveBeenCalledWith('  Passed:              1440');
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              10');
      expect(consoleSpy).toHaveBeenCalledWith('  Pass Rate:           99.3%');
      expect(consoleSpy).toHaveBeenCalledWith('  Last Check:          10/15/2023, 2:30:00 PM');

      // Verify restart history
      expect(consoleSpy).toHaveBeenCalledWith('Recent Restart Events (Last 5)');
      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/14/2023, 10:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('     scheduled maintenance [exit: 0]');
    });

    it('should display health report for daemon with issues', async () => {
      const healthReport: HealthMetrics = {
        uptime: 1800000, // 30 minutes
        memoryUsage: {
          heapUsed: 943718400,   // 900MB (high usage)
          heapTotal: 1073741824, // 1GB
          rss: 1610612736,       // 1.5GB
        },
        taskCounts: {
          processed: 150,
          succeeded: 100,
          failed: 45,
          active: 5,
        },
        lastHealthCheck: new Date('2023-10-15T15:00:00Z'),
        healthChecksPassed: 20,
        healthChecksFailed: 10,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T14:30:00Z'),
            reason: 'oom',
            exitCode: 137,
            triggeredByWatchdog: true,
          },
          {
            timestamp: new Date('2023-10-15T14:00:00Z'),
            reason: 'crash',
            exitCode: 1,
            triggeredByWatchdog: false,
          },
        ],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      // Should show high memory usage
      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           900.0 MB / 1.0 GB (87.9%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 1.5 GB');

      // Should show concerning failure rate
      expect(consoleSpy).toHaveBeenCalledWith('  Pass Rate:           66.7%');

      // Should show recent restart events with watchdog indicator
      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 2:30:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     oom (watchdog) [exit: 137]');
      expect(consoleSpy).toHaveBeenCalledWith('  2. 10/15/2023, 2:00:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     crash [exit: 1]');
    });

    it('should display minimal health report for new daemon', async () => {
      const healthReport: HealthMetrics = {
        uptime: 5000, // 5 seconds
        memoryUsage: {
          heapUsed: 20971520,   // 20MB
          heapTotal: 41943040,  // 40MB
          rss: 62914560,        // 60MB
        },
        taskCounts: {
          processed: 0,
          succeeded: 0,
          failed: 0,
          active: 0,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      // Should show minimal uptime
      expect(consoleSpy).toHaveBeenCalledWith('  Uptime:              0h 0m');

      // Should show zero task counts
      expect(consoleSpy).toHaveBeenCalledWith('  Processed:           0');
      expect(consoleSpy).toHaveBeenCalledWith('  Succeeded:           0');
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              0');
      expect(consoleSpy).toHaveBeenCalledWith('  Active:              0');

      // Should show perfect pass rate with minimal data
      expect(consoleSpy).toHaveBeenCalledWith('  Pass Rate:           100.0%');

      // Should show no restart events
      expect(consoleSpy).toHaveBeenCalledWith('  No restart events recorded');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle daemon not running error gracefully', async () => {
      const error = new DaemonError('Daemon not running', 'NOT_RUNNING');
      mockManager.getHealthReport.mockRejectedValue(error);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is not running.');
    });

    it('should handle permission denied error gracefully', async () => {
      const error = new DaemonError('Permission denied', 'PERMISSION_DENIED');
      mockManager.getHealthReport.mockRejectedValue(error);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('Permission denied. Check .apex directory permissions.');
    });

    it('should handle corrupted PID file error gracefully', async () => {
      const error = new DaemonError('PID file corrupted', 'PID_FILE_CORRUPTED');
      mockManager.getHealthReport.mockRejectedValue(error);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith("PID file is corrupted. Try '/daemon stop --force'.");
    });

    it('should handle unknown daemon errors gracefully', async () => {
      const error = new DaemonError('Unknown daemon issue', 'UNKNOWN_ERROR' as any);
      mockManager.getHealthReport.mockRejectedValue(error);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown daemon issue');
    });

    it('should handle generic network/connectivity errors', async () => {
      const error = new Error('Network timeout');
      mockManager.getHealthReport.mockRejectedValue(error);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to get health report: Network timeout');
    });

    it('should handle malformed health report data', async () => {
      const malformedReport = {
        uptime: null,
        memoryUsage: undefined,
        taskCounts: {},
        lastHealthCheck: 'invalid-date',
        healthChecksPassed: 'not-a-number',
        healthChecksFailed: -1,
        restartHistory: null,
      };

      mockManager.getHealthReport.mockResolvedValue(malformedReport);

      // Should not throw an error
      await expect(handleDaemonHealth(ctx)).resolves.not.toThrow();

      // Should still attempt to display something
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Memory formatting edge cases', () => {
    it('should handle very small memory values', async () => {
      const healthReport: HealthMetrics = {
        uptime: 1000,
        memoryUsage: {
          heapUsed: 512,     // 512 bytes
          heapTotal: 1024,   // 1KB
          rss: 2048,         // 2KB
        },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           512.0 B / 1.0 KB (50.0%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 2.0 KB');
    });

    it('should handle very large memory values', async () => {
      const healthReport: HealthMetrics = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 8 * 1024 * 1024 * 1024,   // 8GB
          heapTotal: 16 * 1024 * 1024 * 1024, // 16GB
          rss: 24 * 1024 * 1024 * 1024,       // 24GB
        },
        taskCounts: { processed: 1000, succeeded: 900, failed: 100, active: 5 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 100,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           8.0 GB / 16.0 GB (50.0%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 24.0 GB');
    });

    it('should handle zero memory values', async () => {
      const healthReport: HealthMetrics = {
        uptime: 1000,
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 1048576, // 1MB
          rss: 2097152,       // 2MB
        },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           0 B / 1.0 MB (0.0%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 2.0 MB');
    });

    it('should handle equal heap used and total', async () => {
      const healthReport: HealthMetrics = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 104857600,  // 100MB
          heapTotal: 104857600, // 100MB (same as used)
          rss: 125829120,       // 120MB
        },
        taskCounts: { processed: 50, succeeded: 45, failed: 5, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 60,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           100.0 MB / 100.0 MB (100.0%)');
    });
  });

  describe('Task statistics formatting', () => {
    it('should handle high task failure rates', async () => {
      const healthReport: HealthMetrics = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: {
          processed: 100,
          succeeded: 30,
          failed: 70, // High failure rate
          active: 0,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 60,
        healthChecksFailed: 40,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Processed:           100');
      expect(consoleSpy).toHaveBeenCalledWith('  Succeeded:           30');
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              70');
      expect(consoleSpy).toHaveBeenCalledWith('  Pass Rate:           60.0%'); // Health check pass rate
    });

    it('should handle large task numbers', async () => {
      const healthReport: HealthMetrics = {
        uptime: 86400000, // 24 hours
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: {
          processed: 1000000,  // 1 million
          succeeded: 995000,
          failed: 5000,
          active: 50,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 1440,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Processed:           1000000');
      expect(consoleSpy).toHaveBeenCalledWith('  Succeeded:           995000');
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              5000');
      expect(consoleSpy).toHaveBeenCalledWith('  Active:              50');
    });
  });

  describe('Restart history formatting', () => {
    it('should handle maximum restart history display', async () => {
      const restartEvents = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(`2023-10-${15 - i}T${10 + i}:00:00Z`),
        reason: `restart-${i + 1}`,
        exitCode: i + 1,
        triggeredByWatchdog: i % 2 === 0,
      }));

      const healthReport: HealthMetrics = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 100, succeeded: 90, failed: 10, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 90,
        healthChecksFailed: 10,
        restartHistory: restartEvents,
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      // Should only show the first 5 events (most recent)
      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 10:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('     restart-1 (watchdog) [exit: 1]');

      expect(consoleSpy).toHaveBeenCalledWith('  5. 10/11/2023, 2:00:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     restart-5 (watchdog) [exit: 5]');

      // Should NOT show the 6th event
      expect(consoleSpy).not.toHaveBeenCalledWith('  6. 10/10/2023, 3:00:00 PM');
    });

    it('should handle restart events with missing exit codes', async () => {
      const healthReport: HealthMetrics = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 10, succeeded: 9, failed: 1, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 10,
        healthChecksFailed: 0,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T14:30:00Z'),
            reason: 'signal-termination',
            // No exitCode
            triggeredByWatchdog: false,
          },
          {
            timestamp: new Date('2023-10-15T14:00:00Z'),
            reason: 'graceful-restart',
            exitCode: undefined,
            triggeredByWatchdog: false,
          },
        ],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 2:30:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     signal-termination'); // No exit code

      expect(consoleSpy).toHaveBeenCalledWith('  2. 10/15/2023, 2:00:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     graceful-restart'); // No exit code
    });

    it('should handle restart events with special characters in reason', async () => {
      const healthReport: HealthMetrics = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 10, succeeded: 9, failed: 1, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 10,
        healthChecksFailed: 0,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T14:30:00Z'),
            reason: 'restart with special chars: éñ中文🚀',
            exitCode: 1,
            triggeredByWatchdog: true,
          },
          {
            timestamp: new Date('2023-10-15T14:00:00Z'),
            reason: 'path/with/slashes and "quotes"',
            exitCode: 0,
            triggeredByWatchdog: false,
          },
        ],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 2:30:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     restart with special chars: éñ中文🚀 (watchdog) [exit: 1]');

      expect(consoleSpy).toHaveBeenCalledWith('  2. 10/15/2023, 2:00:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     path/with/slashes and "quotes" [exit: 0]');
    });
  });

  describe('Health check pass rate calculations', () => {
    it('should handle edge case pass rates', async () => {
      const testCases = [
        { passed: 1, failed: 0, expected: '100.0%' },
        { passed: 0, failed: 1, expected: '0.0%' },
        { passed: 1, failed: 1, expected: '50.0%' },
        { passed: 2, failed: 1, expected: '66.7%' },
        { passed: 1, failed: 2, expected: '33.3%' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const healthReport: HealthMetrics = {
          uptime: 3600000,
          memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
          taskCounts: { processed: 10, succeeded: 9, failed: 1, active: 0 },
          lastHealthCheck: new Date(),
          healthChecksPassed: testCase.passed,
          healthChecksFailed: testCase.failed,
          restartHistory: [],
        };

        mockManager.getHealthReport.mockResolvedValue(healthReport);

        await handleDaemonHealth(ctx);

        expect(consoleSpy).toHaveBeenCalledWith(`  Pass Rate:           ${testCase.expected}`);
      }
    });

    it('should handle precision in pass rate calculations', async () => {
      const healthReport: HealthMetrics = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 100, succeeded: 90, failed: 10, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 333,
        healthChecksFailed: 667,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      // 333 / (333 + 667) = 333 / 1000 = 33.3%
      expect(consoleSpy).toHaveBeenCalledWith('  Pass Rate:           33.3%');
    });
  });

  describe('Memory bar visualization', () => {
    it('should include memory bar in output', async () => {
      const healthReport: HealthMetrics = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 52428800,   // 50% of 100MB
          heapTotal: 104857600, // 100MB
          rss: 125829120,
        },
        taskCounts: { processed: 100, succeeded: 90, failed: 10, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 90,
        healthChecksFailed: 10,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(healthReport);

      await handleDaemonHealth(ctx);

      // Should include a line with memory bar visualization
      const barCall = consoleSpy.mock.calls.find(call =>
        call[0] && (call[0].includes('█') || call[0].includes('['))
      );
      expect(barCall).toBeTruthy();
    });
  });
});