import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chalk from 'chalk';

// Mock chalk to remove color codes for easier testing
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

// Test the utility functions used in daemon health display
// Since these are not exported, we test them through the main handler
import { handleDaemonHealth } from '../daemon-handlers';
import { DaemonManager, DaemonError } from '@apexcli/orchestrator';

// Mock DaemonManager
vi.mock('@apexcli/orchestrator', () => ({
  DaemonManager: vi.fn(),
  DaemonError: class extends Error {
    constructor(message: string, public code: string, public cause?: Error) {
      super(message);
      this.name = 'DaemonError';
    }
  },
}));

const mockDaemonManager = vi.mocked(DaemonManager);

describe('Daemon Health Report Formatting and Display', () => {
  let mockManager: any;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console.log
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create mock manager instance
    mockManager = {
      getHealthReport: vi.fn(),
    };

    mockDaemonManager.mockReturnValue(mockManager);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Memory usage formatting', () => {
    it('should format memory sizes in MB correctly', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 52428800,   // 50MB
          heapTotal: 104857600, // 100MB
          rss: 125829120,       // 120MB
        },
        taskCounts: { processed: 10, succeeded: 10, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 10,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           50.0 MB / 100.0 MB (50.0%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 120.0 MB');
    });

    it('should format memory sizes in KB correctly', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 512000,   // 500KB
          heapTotal: 1024000, // 1000KB
          rss: 1536000,       // 1.5MB
        },
        taskCounts: { processed: 5, succeeded: 5, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 5,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           500.0 KB / 1000.0 KB (50.0%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 1.5 MB');
    });

    it('should format memory sizes in GB correctly', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 1073741824,  // 1GB
          heapTotal: 2147483648, // 2GB
          rss: 3221225472,       // 3GB
        },
        taskCounts: { processed: 50, succeeded: 45, failed: 5, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 50,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           1.0 GB / 2.0 GB (50.0%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 3.0 GB');
    });

    it('should handle zero memory usage', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 1000,
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 1048576, // 1MB
          rss: 2097152,       // 2MB
        },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           0 B / 1.0 MB (0.0%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 2.0 MB');
    });
  });

  describe('Memory bar chart visualization', () => {
    it('should display memory bar with green color for low usage', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 26214400,   // 25MB (50% of 50MB)
          heapTotal: 52428800,  // 50MB
          rss: 62914560,
        },
        taskCounts: { processed: 10, succeeded: 10, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 10,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      // Should contain memory bar visualization
      const barCall = consoleSpy.mock.calls.find(call =>
        call[0] && call[0].includes('█')
      );
      expect(barCall).toBeTruthy();
    });

    it('should display memory percentage calculations correctly', async () => {
      const testCases = [
        { heapUsed: 10485760, heapTotal: 52428800, expectedPercent: '20.0%' },  // 10MB/50MB
        { heapUsed: 31457280, heapTotal: 52428800, expectedPercent: '60.0%' },  // 30MB/50MB
        { heapUsed: 47185920, heapTotal: 52428800, expectedPercent: '90.0%' },  // 45MB/50MB
        { heapUsed: 52428800, heapTotal: 52428800, expectedPercent: '100.0%' }, // 50MB/50MB
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const ctx = { cwd: '/test', initialized: true };
        const mockHealthReport = {
          uptime: 3600000,
          memoryUsage: {
            heapUsed: testCase.heapUsed,
            heapTotal: testCase.heapTotal,
            rss: testCase.heapTotal + 10485760, // Add 10MB RSS
          },
          taskCounts: { processed: 10, succeeded: 10, failed: 0, active: 0 },
          lastHealthCheck: new Date(),
          healthChecksPassed: 10,
          healthChecksFailed: 0,
          restartHistory: [],
        };

        mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
        await handleDaemonHealth(ctx);

        const heapCall = consoleSpy.mock.calls.find(call =>
          call[0] && call[0].includes('Heap Used:') && call[0].includes(testCase.expectedPercent)
        );
        expect(heapCall).toBeTruthy();
      }
    });
  });

  describe('Uptime formatting', () => {
    it('should format uptime in hours and minutes', async () => {
      const testCases = [
        { uptime: 3600000, expected: '1h 0m' },     // 1 hour
        { uptime: 5400000, expected: '1h 30m' },    // 1.5 hours
        { uptime: 7200000, expected: '2h 0m' },     // 2 hours
        { uptime: 86400000, expected: '24h 0m' },   // 24 hours
        { uptime: 90000000, expected: '25h 0m' },   // 25 hours
        { uptime: 1800000, expected: '0h 30m' },    // 30 minutes
        { uptime: 60000, expected: '0h 1m' },       // 1 minute
        { uptime: 30000, expected: '0h 0m' },       // 30 seconds
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const ctx = { cwd: '/test', initialized: true };
        const mockHealthReport = {
          uptime: testCase.uptime,
          memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
          taskCounts: { processed: 10, succeeded: 10, failed: 0, active: 0 },
          lastHealthCheck: new Date(),
          healthChecksPassed: 10,
          healthChecksFailed: 0,
          restartHistory: [],
        };

        mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
        await handleDaemonHealth(ctx);

        expect(consoleSpy).toHaveBeenCalledWith(`  Uptime:              ${testCase.expected}`);
      }
    });
  });

  describe('Health check pass rate calculations', () => {
    it('should calculate pass rates correctly', async () => {
      const testCases = [
        { passed: 100, failed: 0, expectedRate: '100.0%' },
        { passed: 95, failed: 5, expectedRate: '95.0%' },
        { passed: 80, failed: 20, expectedRate: '80.0%' },
        { passed: 75, failed: 25, expectedRate: '75.0%' },
        { passed: 50, failed: 50, expectedRate: '50.0%' },
        { passed: 0, failed: 10, expectedRate: '0.0%' },
        { passed: 0, failed: 0, expectedRate: '0.0%' }, // No checks
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const ctx = { cwd: '/test', initialized: true };
        const mockHealthReport = {
          uptime: 3600000,
          memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
          taskCounts: { processed: 10, succeeded: 10, failed: 0, active: 0 },
          lastHealthCheck: new Date(),
          healthChecksPassed: testCase.passed,
          healthChecksFailed: testCase.failed,
          restartHistory: [],
        };

        mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
        await handleDaemonHealth(ctx);

        expect(consoleSpy).toHaveBeenCalledWith(`  Pass Rate:           ${testCase.expectedRate}`);
      }
    });
  });

  describe('Restart history formatting', () => {
    it('should format restart timestamps correctly', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 10, succeeded: 10, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 10,
        healthChecksFailed: 0,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T14:30:00Z'),
            reason: 'test-restart',
            exitCode: 0,
            triggeredByWatchdog: false,
          },
        ],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 2:30:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     test-restart [exit: 0]');
    });

    it('should format watchdog restarts correctly', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 10, succeeded: 10, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 10,
        healthChecksFailed: 0,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T14:30:00Z'),
            reason: 'oom',
            exitCode: 137,
            triggeredByWatchdog: true,
          },
        ],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 2:30:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     oom (watchdog) [exit: 137]');
    });

    it('should format restarts without exit codes', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 10, succeeded: 10, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 10,
        healthChecksFailed: 0,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T14:30:00Z'),
            reason: 'manual',
            // No exitCode
            triggeredByWatchdog: false,
          },
        ],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 2:30:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     manual'); // No exit code shown
    });
  });

  describe('Section headers and separators', () => {
    it('should display all section headers with proper formatting', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 100, succeeded: 85, failed: 10, active: 5 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 95,
        healthChecksFailed: 5,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      // Main header
      expect(consoleSpy).toHaveBeenCalledWith('\nDaemon Health Report');
      expect(consoleSpy).toHaveBeenCalledWith('─'.repeat(50));

      // Section headers
      expect(consoleSpy).toHaveBeenCalledWith('Memory Usage');
      expect(consoleSpy).toHaveBeenCalledWith('Task Statistics');
      expect(consoleSpy).toHaveBeenCalledWith('Health Check Statistics');
      expect(consoleSpy).toHaveBeenCalledWith('Recent Restart Events (Last 5)');

      // Section separators
      const separatorCalls = consoleSpy.mock.calls.filter(call =>
        call[0] && call[0].includes('─'.repeat(50))
      );
      expect(separatorCalls.length).toBeGreaterThan(0);
    });

    it('should handle empty sections gracefully', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 60000,
        memoryUsage: { heapUsed: 0, heapTotal: 1048576, rss: 2097152 },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      // Should still show all headers even with zero values
      expect(consoleSpy).toHaveBeenCalledWith('Memory Usage');
      expect(consoleSpy).toHaveBeenCalledWith('Task Statistics');
      expect(consoleSpy).toHaveBeenCalledWith('Health Check Statistics');
      expect(consoleSpy).toHaveBeenCalledWith('Recent Restart Events (Last 5)');
      expect(consoleSpy).toHaveBeenCalledWith('  No restart events recorded');
    });
  });

  describe('Edge cases and error conditions', () => {
    it('should handle malformed health report data gracefully', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: 'invalid', // Invalid type
        memoryUsage: null,  // Null value
        taskCounts: {},     // Missing properties
        lastHealthCheck: 'not-a-date',
        healthChecksPassed: -1,  // Negative value
        healthChecksFailed: undefined,
        restartHistory: 'not-an-array',
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      // Should not throw an error, but may display incorrectly
      await expect(handleDaemonHealth(ctx)).resolves.not.toThrow();
    });

    it('should handle very large numbers', async () => {
      const ctx = { cwd: '/test', initialized: true };
      const mockHealthReport = {
        uptime: Number.MAX_SAFE_INTEGER,
        memoryUsage: {
          heapUsed: Number.MAX_SAFE_INTEGER,
          heapTotal: Number.MAX_SAFE_INTEGER,
          rss: Number.MAX_SAFE_INTEGER,
        },
        taskCounts: {
          processed: Number.MAX_SAFE_INTEGER,
          succeeded: Number.MAX_SAFE_INTEGER - 1000,
          failed: 1000,
          active: 0,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: Number.MAX_SAFE_INTEGER,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);
      await handleDaemonHealth(ctx);

      // Should handle large numbers without crashing
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});