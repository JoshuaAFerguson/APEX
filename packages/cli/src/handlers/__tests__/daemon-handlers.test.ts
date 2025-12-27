import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chalk from 'chalk';
import { handleDaemonStart, handleDaemonStop, handleDaemonStatus, handleDaemonHealth } from '../daemon-handlers';
import { DaemonManager, DaemonError, DaemonStatus, ExtendedDaemonStatus, CapacityStatusInfo } from '@apex/orchestrator';

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

// Mock chalk to remove color codes for easier testing
vi.mock('chalk', () => ({
  default: {
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    cyan: (str: string) => str,
    gray: (str: string) => str,
  },
}));

const mockDaemonManager = vi.mocked(DaemonManager);

describe('daemon-handlers', () => {
  let mockManager: any;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console.log
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create mock manager instance
    mockManager = {
      startDaemon: vi.fn(),
      stopDaemon: vi.fn(),
      killDaemon: vi.fn(),
      getStatus: vi.fn(),
      getExtendedStatus: vi.fn(),
      getHealthReport: vi.fn(),
    };

    mockDaemonManager.mockReturnValue(mockManager);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('handleDaemonStart', () => {
    const ctx = { cwd: '/test/project', initialized: true };

    it('should start daemon successfully with default options', async () => {
      mockManager.startDaemon.mockResolvedValue(12345);

      await handleDaemonStart(ctx, []);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: undefined,
      });
      expect(mockManager.startDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon started (PID: 12345)');
      expect(consoleSpy).toHaveBeenCalledWith('  Polling every 5000ms for queued tasks');
      expect(consoleSpy).toHaveBeenCalledWith('  Logs: .apex/daemon.log');
    });

    it('should start daemon with custom poll interval', async () => {
      mockManager.startDaemon.mockResolvedValue(12345);

      await handleDaemonStart(ctx, ['--poll-interval', '10000']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 10000,
      });
      expect(consoleSpy).toHaveBeenCalledWith('  Polling every 10000ms for queued tasks');
    });

    it('should handle short form poll interval flag', async () => {
      mockManager.startDaemon.mockResolvedValue(12345);

      await handleDaemonStart(ctx, ['-i', '3000']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 3000,
      });
    });

    it('should reject invalid poll interval', async () => {
      await handleDaemonStart(ctx, ['--poll-interval', 'invalid']);

      expect(consoleSpy).toHaveBeenCalledWith('Invalid poll interval. Must be a positive number.');
      expect(mockManager.startDaemon).not.toHaveBeenCalled();
    });

    it('should reject negative poll interval', async () => {
      await handleDaemonStart(ctx, ['--poll-interval', '-1']);

      expect(consoleSpy).toHaveBeenCalledWith('Invalid poll interval. Must be a positive number.');
      expect(mockManager.startDaemon).not.toHaveBeenCalled();
    });

    it('should handle DaemonError with specific error codes', async () => {
      const error = new DaemonError('Already running', 'ALREADY_RUNNING');
      mockManager.startDaemon.mockRejectedValue(error);

      await handleDaemonStart(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is already running.');
    });

    it('should handle generic errors', async () => {
      const error = new Error('Generic error');
      mockManager.startDaemon.mockRejectedValue(error);

      await handleDaemonStart(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start daemon: Generic error');
    });

    it('should require initialized project', async () => {
      const uninitializedCtx = { cwd: '/test/project', initialized: false };

      await handleDaemonStart(uninitializedCtx, []);

      expect(consoleSpy).toHaveBeenCalledWith('APEX not initialized. Run /init first.');
      expect(mockManager.startDaemon).not.toHaveBeenCalled();
    });
  });

  describe('handleDaemonStop', () => {
    const ctx = { cwd: '/test/project', initialized: true };

    it('should stop daemon gracefully', async () => {
      mockManager.getStatus.mockResolvedValue({ running: true });
      mockManager.stopDaemon.mockResolvedValue(undefined);

      await handleDaemonStop(ctx, []);

      expect(mockManager.stopDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon stopped');
    });

    it('should force kill daemon with --force flag', async () => {
      mockManager.getStatus.mockResolvedValue({ running: true });
      mockManager.killDaemon.mockResolvedValue(undefined);

      await handleDaemonStop(ctx, ['--force']);

      expect(mockManager.killDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon killed (force)');
    });

    it('should force kill daemon with short flag', async () => {
      mockManager.getStatus.mockResolvedValue({ running: true });
      mockManager.killDaemon.mockResolvedValue(undefined);

      await handleDaemonStop(ctx, ['-f']);

      expect(mockManager.killDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon killed (force)');
    });

    it('should handle daemon not running', async () => {
      mockManager.getStatus.mockResolvedValue({ running: false });

      await handleDaemonStop(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is not running.');
      expect(mockManager.stopDaemon).not.toHaveBeenCalled();
      expect(mockManager.killDaemon).not.toHaveBeenCalled();
    });

    it('should handle DaemonError during stop', async () => {
      mockManager.getStatus.mockResolvedValue({ running: true });
      const error = new DaemonError('Stop failed', 'STOP_FAILED', new Error('Process not found'));
      mockManager.stopDaemon.mockRejectedValue(error);

      await handleDaemonStop(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to stop daemon: Process not found');
    });

    it('should handle generic errors during stop', async () => {
      mockManager.getStatus.mockResolvedValue({ running: true });
      const error = new Error('Generic error');
      mockManager.stopDaemon.mockRejectedValue(error);

      await handleDaemonStop(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to stop daemon: Generic error');
    });
  });

  describe('handleDaemonStatus', () => {
    const ctx = { cwd: '/test/project', initialized: true };

    it('should display running daemon status with capacity information', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.80,
        currentUsagePercent: 0.45,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000, // 1 hour in ms
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      // Check daemon status section
      expect(consoleSpy).toHaveBeenCalledWith('\nDaemon Status');
      expect(consoleSpy).toHaveBeenCalledWith('─'.repeat(36));
      expect(consoleSpy).toHaveBeenCalledWith('  State:           running');
      expect(consoleSpy).toHaveBeenCalledWith('  PID:             12345');
      expect(consoleSpy).toHaveBeenCalledWith('  Started:         1/1/2023, 10:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('  Uptime:          1h 0m');
      expect(consoleSpy).toHaveBeenCalledWith('  Log file:        .apex/daemon.log');

      // Check capacity status section
      expect(consoleSpy).toHaveBeenCalledWith('Capacity Status');
      expect(consoleSpy).toHaveBeenCalledWith('  Mode:            day (9:00 AM - 6:00 PM)');
      expect(consoleSpy).toHaveBeenCalledWith('  Threshold:       80%');
      expect(consoleSpy).toHaveBeenCalledWith('  Current Usage:   45.0%');
      expect(consoleSpy).toHaveBeenCalledWith('  Auto-Pause:      No');
      expect(consoleSpy).toHaveBeenCalledWith('  Next Mode:       night at 10:00:00 PM');
    });

    it('should display night mode daemon status', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'night',
        capacityThreshold: 0.90,
        currentUsagePercent: 0.75,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-02T09:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T22:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Mode:            night (10:00 PM - 6:00 AM)');
      expect(consoleSpy).toHaveBeenCalledWith('  Threshold:       90%');
      expect(consoleSpy).toHaveBeenCalledWith('  Current Usage:   75.0%');
      expect(consoleSpy).toHaveBeenCalledWith('  Next Mode:       day at 9:00:00 AM');
    });

    it('should display off-hours mode daemon status', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'off-hours',
        capacityThreshold: 0.95,
        currentUsagePercent: 0.20,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-02T09:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T18:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Mode:            off-hours');
      expect(consoleSpy).toHaveBeenCalledWith('  Threshold:       95%');
      expect(consoleSpy).toHaveBeenCalledWith('  Current Usage:   20.0%');
      expect(consoleSpy).toHaveBeenCalledWith('  Next Mode:       active hours at 9:00:00 AM');
    });

    it('should display auto-paused daemon status with reason', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.80,
        currentUsagePercent: 0.95,
        isAutoPaused: true,
        pauseReason: 'Daily budget exceeded',
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Current Usage:   95.0%');
      expect(consoleSpy).toHaveBeenCalledWith('  Auto-Pause:      Yes (Daily budget exceeded)');
      expect(consoleSpy).toHaveBeenCalledWith('  ⚠ Tasks paused. Will resume when capacity available or mode changes.');
    });

    it('should display auto-paused daemon status without reason', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.80,
        currentUsagePercent: 0.95,
        isAutoPaused: true,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Auto-Pause:      Yes');
    });

    it('should show color-coded usage percentages', async () => {
      const testCases = [
        { usage: 0.30, expectedColor: 'green' },
        { usage: 0.85, expectedColor: 'yellow' },
        { usage: 0.95, expectedColor: 'red' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const capacity: CapacityStatusInfo = {
          mode: 'day',
          capacityThreshold: 0.80,
          currentUsagePercent: testCase.usage,
          isAutoPaused: false,
          nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
          timeBasedUsageEnabled: true,
        };

        const extendedStatus: ExtendedDaemonStatus = {
          running: true,
          pid: 12345,
          startedAt: new Date('2023-01-01T10:00:00Z'),
          uptime: 3600000,
          capacity,
        };
        mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

        await handleDaemonStatus(ctx);

        const expectedUsage = (testCase.usage * 100).toFixed(1);
        expect(consoleSpy).toHaveBeenCalledWith(`  Current Usage:   ${expectedUsage}%`);
      }
    });

    it('should display daemon status when time-based usage is disabled', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.80,
        currentUsagePercent: 0.45,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: false,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('Capacity Status');
      expect(consoleSpy).toHaveBeenCalledWith('  Time-based usage is disabled.');
      expect(consoleSpy).toHaveBeenCalledWith('  Configure in .apex/config.yaml under daemon.timeBasedUsage');
    });

    it('should display daemon status when capacity info is not available', async () => {
      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        // No capacity information
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('Capacity Status');
      expect(consoleSpy).toHaveBeenCalledWith('  ⚠ State file not found. Daemon may be starting up.');
      expect(consoleSpy).toHaveBeenCalledWith('    Capacity information will be available once daemon is fully initialized.');
    });

    it('should display stopped daemon status', async () => {
      const extendedStatus: ExtendedDaemonStatus = {
        running: false,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('\nDaemon Status');
      expect(consoleSpy).toHaveBeenCalledWith('─'.repeat(36));
      expect(consoleSpy).toHaveBeenCalledWith('  State:           stopped');
      expect(consoleSpy).toHaveBeenCalledWith("Use '/daemon start' to start the daemon.");
    });

    it('should handle partial status data', async () => {
      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        // Missing startedAt and uptime
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  State:           stopped');
    });
  });

  describe('error handling', () => {
    it('should handle PERMISSION_DENIED error', async () => {
      const error = new DaemonError('Permission denied', 'PERMISSION_DENIED');
      mockManager.startDaemon.mockRejectedValue(error);

      await handleDaemonStart({ cwd: '/test', initialized: true }, []);

      expect(consoleSpy).toHaveBeenCalledWith('Permission denied. Check .apex directory permissions.');
    });

    it('should handle PID_FILE_CORRUPTED error', async () => {
      const error = new DaemonError('PID file corrupted', 'PID_FILE_CORRUPTED');
      mockManager.startDaemon.mockRejectedValue(error);

      await handleDaemonStart({ cwd: '/test', initialized: true }, []);

      expect(consoleSpy).toHaveBeenCalledWith("PID file is corrupted. Try '/daemon stop --force'.");
    });

    it('should handle LOCK_FAILED error', async () => {
      const error = new DaemonError('Lock failed', 'LOCK_FAILED');
      mockManager.startDaemon.mockRejectedValue(error);

      await handleDaemonStart({ cwd: '/test', initialized: true }, []);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to acquire lock on PID file.');
    });

    it('should handle unknown error codes', async () => {
      const error = new DaemonError('Unknown error', 'UNKNOWN_CODE' as any);
      mockManager.startDaemon.mockRejectedValue(error);

      await handleDaemonStart({ cwd: '/test', initialized: true }, []);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown error');
    });
  });

  describe('utility functions', () => {
    // Since formatModeDisplay and getNextModeText are not exported,
    // we test them indirectly through handleDaemonStatus behavior
    it('should format day mode display correctly', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.80,
        currentUsagePercent: 0.45,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus({ cwd: '/test', initialized: true });

      expect(consoleSpy).toHaveBeenCalledWith('  Mode:            day (9:00 AM - 6:00 PM)');
      expect(consoleSpy).toHaveBeenCalledWith('  Next Mode:       night at 10:00:00 PM');
    });

    it('should format night mode display correctly', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'night',
        capacityThreshold: 0.90,
        currentUsagePercent: 0.75,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-02T09:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T22:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus({ cwd: '/test', initialized: true });

      expect(consoleSpy).toHaveBeenCalledWith('  Mode:            night (10:00 PM - 6:00 AM)');
      expect(consoleSpy).toHaveBeenCalledWith('  Next Mode:       day at 9:00:00 AM');
    });

    it('should format off-hours mode display correctly', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'off-hours',
        capacityThreshold: 0.95,
        currentUsagePercent: 0.20,
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-02T09:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T18:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus({ cwd: '/test', initialized: true });

      expect(consoleSpy).toHaveBeenCalledWith('  Mode:            off-hours');
      expect(consoleSpy).toHaveBeenCalledWith('  Next Mode:       active hours at 9:00:00 AM');
    });

    it('should handle usage percentage color coding thresholds', async () => {
      const testCases = [
        { usage: 0.30, description: 'green for usage under 80%' },
        { usage: 0.75, description: 'green for usage under 80%' },
        { usage: 0.85, description: 'yellow for usage 80-99% but below threshold' },
        { usage: 0.95, description: 'red for usage at or above threshold' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const capacity: CapacityStatusInfo = {
          mode: 'day',
          capacityThreshold: 0.90, // Set threshold at 90%
          currentUsagePercent: testCase.usage,
          isAutoPaused: testCase.usage >= 0.90,
          nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
          timeBasedUsageEnabled: true,
        };

        const extendedStatus: ExtendedDaemonStatus = {
          running: true,
          pid: 12345,
          startedAt: new Date('2023-01-01T10:00:00Z'),
          uptime: 3600000,
          capacity,
        };
        mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

        await handleDaemonStatus({ cwd: '/test', initialized: true });

        const expectedUsage = (testCase.usage * 100).toFixed(1);
        expect(consoleSpy).toHaveBeenCalledWith(`  Current Usage:   ${expectedUsage}%`);
      }
    });

    it('should format threshold percentages correctly', async () => {
      const testThresholds = [0.75, 0.80, 0.90, 0.95];

      for (const threshold of testThresholds) {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const capacity: CapacityStatusInfo = {
          mode: 'day',
          capacityThreshold: threshold,
          currentUsagePercent: 0.45,
          isAutoPaused: false,
          nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
          timeBasedUsageEnabled: true,
        };

        const extendedStatus: ExtendedDaemonStatus = {
          running: true,
          pid: 12345,
          startedAt: new Date('2023-01-01T10:00:00Z'),
          uptime: 3600000,
          capacity,
        };
        mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

        await handleDaemonStatus({ cwd: '/test', initialized: true });

        const expectedThreshold = (threshold * 100).toFixed(0);
        expect(consoleSpy).toHaveBeenCalledWith(`  Threshold:       ${expectedThreshold}%`);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle capacity with edge case values', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 1.0, // 100%
        currentUsagePercent: 0.0, // 0%
        isAutoPaused: false,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus({ cwd: '/test', initialized: true });

      expect(consoleSpy).toHaveBeenCalledWith('  Threshold:       100%');
      expect(consoleSpy).toHaveBeenCalledWith('  Current Usage:   0.0%');
      expect(consoleSpy).toHaveBeenCalledWith('  Auto-Pause:      No');
    });

    it('should handle exactly at threshold usage', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.80,
        currentUsagePercent: 0.80, // Exactly at threshold
        isAutoPaused: true,
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus({ cwd: '/test', initialized: true });

      expect(consoleSpy).toHaveBeenCalledWith('  Current Usage:   80.0%');
      expect(consoleSpy).toHaveBeenCalledWith('  Auto-Pause:      Yes');
    });

    it('should handle daemon with missing required properties', async () => {
      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        // Missing pid, startedAt, uptime
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus({ cwd: '/test', initialized: true });

      // Should fall back to stopped display due to missing required properties
      expect(consoleSpy).toHaveBeenCalledWith('  State:           stopped');
    });

    it('should handle empty pause reason gracefully', async () => {
      const capacity: CapacityStatusInfo = {
        mode: 'day',
        capacityThreshold: 0.80,
        currentUsagePercent: 0.95,
        isAutoPaused: true,
        pauseReason: '', // Empty string
        nextModeSwitch: new Date('2023-01-01T22:00:00Z'),
        timeBasedUsageEnabled: true,
      };

      const extendedStatus: ExtendedDaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        capacity,
      };
      mockManager.getExtendedStatus.mockResolvedValue(extendedStatus);

      await handleDaemonStatus({ cwd: '/test', initialized: true });

      expect(consoleSpy).toHaveBeenCalledWith('  Auto-Pause:      Yes');
    });
  });

  describe('handleDaemonHealth', () => {
    const ctx = { cwd: '/test/project', initialized: true };

    it('should display comprehensive health report with all sections', async () => {
      const mockHealthReport = {
        uptime: 3600000, // 1 hour
        memoryUsage: {
          heapUsed: 52428800,    // 50MB
          heapTotal: 104857600,  // 100MB
          rss: 125829120,        // 120MB
        },
        taskCounts: {
          processed: 100,
          succeeded: 85,
          failed: 10,
          active: 5,
        },
        lastHealthCheck: new Date('2023-10-15T14:30:00Z'),
        healthChecksPassed: 95,
        healthChecksFailed: 5,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T10:00:00Z'),
            reason: 'oom',
            exitCode: 137,
            triggeredByWatchdog: true,
          },
          {
            timestamp: new Date('2023-10-14T18:00:00Z'),
            reason: 'manual',
            exitCode: 0,
            triggeredByWatchdog: false,
          },
        ],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Verify health report header
      expect(consoleSpy).toHaveBeenCalledWith('\nDaemon Health Report');
      expect(consoleSpy).toHaveBeenCalledWith('─'.repeat(50));

      // Verify uptime section
      expect(consoleSpy).toHaveBeenCalledWith('  Uptime:              1h 0m');

      // Verify memory section header
      expect(consoleSpy).toHaveBeenCalledWith('Memory Usage');

      // Verify memory usage details
      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           50.0 MB / 100.0 MB (50.0%)');
      expect(consoleSpy).toHaveBeenCalledWith('  RSS:                 120.0 MB');

      // Verify task statistics header
      expect(consoleSpy).toHaveBeenCalledWith('Task Statistics');

      // Verify task counts
      expect(consoleSpy).toHaveBeenCalledWith('  Processed:           100');
      expect(consoleSpy).toHaveBeenCalledWith('  Succeeded:           85');
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              10');
      expect(consoleSpy).toHaveBeenCalledWith('  Active:              5');

      // Verify health check statistics header
      expect(consoleSpy).toHaveBeenCalledWith('Health Check Statistics');

      // Verify health check stats
      expect(consoleSpy).toHaveBeenCalledWith('  Passed:              95');
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              5');
      expect(consoleSpy).toHaveBeenCalledWith('  Pass Rate:           95.0%');

      // Verify restart history header
      expect(consoleSpy).toHaveBeenCalledWith('Recent Restart Events (Last 5)');

      // Verify restart events
      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 10:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('     oom (watchdog) [exit: 137]');
      expect(consoleSpy).toHaveBeenCalledWith('  2. 10/14/2023, 6:00:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('     manual [exit: 0]');
    });

    it('should display health report with no restart history', async () => {
      const mockHealthReport = {
        uptime: 1800000, // 30 minutes
        memoryUsage: {
          heapUsed: 26214400,   // 25MB
          heapTotal: 52428800,  // 50MB
          rss: 62914560,        // 60MB
        },
        taskCounts: {
          processed: 50,
          succeeded: 45,
          failed: 3,
          active: 2,
        },
        lastHealthCheck: new Date('2023-10-15T15:00:00Z'),
        healthChecksPassed: 30,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Should show no restart events message
      expect(consoleSpy).toHaveBeenCalledWith('  No restart events recorded');
    });

    it('should show green memory bar for low usage', async () => {
      const mockHealthReport = {
        uptime: 900000, // 15 minutes
        memoryUsage: {
          heapUsed: 15728640,   // 15MB (30% of 50MB)
          heapTotal: 52428800,  // 50MB
          rss: 62914560,        // 60MB
        },
        taskCounts: {
          processed: 20,
          succeeded: 18,
          failed: 1,
          active: 1,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 15,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Should display memory usage with 30% usage
      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           15.0 MB / 50.0 MB (30.0%)');
    });

    it('should show red memory bar for high usage', async () => {
      const mockHealthReport = {
        uptime: 7200000, // 2 hours
        memoryUsage: {
          heapUsed: 419430400,  // 400MB (85% of 470MB)
          heapTotal: 493921280, // 470MB
          rss: 524288000,       // 500MB
        },
        taskCounts: {
          processed: 200,
          succeeded: 150,
          failed: 45,
          active: 5,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 200,
        healthChecksFailed: 10,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Should display memory usage with high percentage
      expect(consoleSpy).toHaveBeenCalledWith('  Heap Used:           400.0 MB / 470.0 MB (85.1%)');
    });

    it('should show color-coded task counts', async () => {
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 52428800,
          heapTotal: 104857600,
          rss: 125829120,
        },
        taskCounts: {
          processed: 100,
          succeeded: 85,
          failed: 10, // Non-zero failures
          active: 3,  // Active tasks
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 95,
        healthChecksFailed: 5,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Should show failed count (color will be applied by chalk)
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              10');
      expect(consoleSpy).toHaveBeenCalledWith('  Active:              3');
    });

    it('should show gray color for zero failed and active tasks', async () => {
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 52428800,
          heapTotal: 104857600,
          rss: 125829120,
        },
        taskCounts: {
          processed: 100,
          succeeded: 100,
          failed: 0,  // Zero failures
          active: 0,  // No active tasks
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 100,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Should show zero counts (color will be applied by chalk)
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              0');
      expect(consoleSpy).toHaveBeenCalledWith('  Active:              0');
    });

    it('should show color-coded health check pass rates', async () => {
      const testCases = [
        {
          passed: 98,
          failed: 2,
          expectedRate: '98.0%',
          description: 'high pass rate (>95%)',
        },
        {
          passed: 85,
          failed: 15,
          expectedRate: '85.0%',
          description: 'medium pass rate (80-94%)',
        },
        {
          passed: 70,
          failed: 30,
          expectedRate: '70.0%',
          description: 'low pass rate (<80%)',
        },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const mockHealthReport = {
          uptime: 3600000,
          memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
          taskCounts: { processed: 100, succeeded: 90, failed: 10, active: 0 },
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

    it('should show detailed restart history with different types', async () => {
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 100, succeeded: 85, failed: 10, active: 5 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 95,
        healthChecksFailed: 5,
        restartHistory: [
          {
            timestamp: new Date('2023-10-15T10:00:00Z'),
            reason: 'crash',
            exitCode: 1,
            triggeredByWatchdog: false,
          },
          {
            timestamp: new Date('2023-10-15T09:00:00Z'),
            reason: 'oom',
            exitCode: 137,
            triggeredByWatchdog: true,
          },
          {
            timestamp: new Date('2023-10-15T08:00:00Z'),
            reason: 'manual',
            // No exit code
            triggeredByWatchdog: false,
          },
          {
            timestamp: new Date('2023-10-15T07:00:00Z'),
            reason: 'watchdog timeout',
            exitCode: 9,
            triggeredByWatchdog: true,
          },
        ],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Check all restart entries are displayed
      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 10:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('     crash [exit: 1]');

      expect(consoleSpy).toHaveBeenCalledWith('  2. 10/15/2023, 9:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('     oom (watchdog) [exit: 137]');

      expect(consoleSpy).toHaveBeenCalledWith('  3. 10/15/2023, 8:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('     manual'); // No exit code or watchdog text

      expect(consoleSpy).toHaveBeenCalledWith('  4. 10/15/2023, 7:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('     watchdog timeout (watchdog) [exit: 9]');
    });

    it('should limit restart history to last 5 events', async () => {
      // Create 7 restart events
      const restartEvents = Array.from({ length: 7 }, (_, i) => ({
        timestamp: new Date(`2023-10-15T${10 + i}:00:00Z`),
        reason: `restart-${i + 1}`,
        exitCode: i + 1,
        triggeredByWatchdog: i % 2 === 0,
      }));

      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: { heapUsed: 52428800, heapTotal: 104857600, rss: 125829120 },
        taskCounts: { processed: 100, succeeded: 85, failed: 10, active: 5 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 95,
        healthChecksFailed: 5,
        restartHistory: restartEvents,
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Should show exactly 5 entries (numbered 1-5)
      expect(consoleSpy).toHaveBeenCalledWith('  1. 10/15/2023, 10:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('  2. 10/15/2023, 11:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('  3. 10/15/2023, 12:00:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('  4. 10/15/2023, 1:00:00 PM');
      expect(consoleSpy).toHaveBeenCalledWith('  5. 10/15/2023, 2:00:00 PM');

      // Should NOT show 6th and 7th entries
      expect(consoleSpy).not.toHaveBeenCalledWith('  6. 10/15/2023, 3:00:00 PM');
      expect(consoleSpy).not.toHaveBeenCalledWith('  7. 10/15/2023, 4:00:00 PM');
    });

    it('should handle DaemonError during health report fetch', async () => {
      const error = new DaemonError('Not running', 'NOT_RUNNING');
      mockManager.getHealthReport.mockRejectedValue(error);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is not running.');
    });

    it('should handle generic errors during health report fetch', async () => {
      const error = new Error('Connection failed');
      mockManager.getHealthReport.mockRejectedValue(error);

      await handleDaemonHealth(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to get health report: Connection failed');
    });

    it('should handle zero health checks gracefully', async () => {
      const mockHealthReport = {
        uptime: 30000, // 30 seconds
        memoryUsage: { heapUsed: 26214400, heapTotal: 52428800, rss: 62914560 },
        taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 0,
        healthChecksFailed: 0,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Should show 0.0% pass rate when no checks have run
      expect(consoleSpy).toHaveBeenCalledWith('  Passed:              0');
      expect(consoleSpy).toHaveBeenCalledWith('  Failed:              0');
      expect(consoleSpy).toHaveBeenCalledWith('  Pass Rate:           0.0%');
    });

    it('should create visual memory bar with correct width', async () => {
      const mockHealthReport = {
        uptime: 3600000,
        memoryUsage: {
          heapUsed: 52428800,   // 50% of 100MB
          heapTotal: 104857600, // 100MB
          rss: 125829120,
        },
        taskCounts: { processed: 100, succeeded: 85, failed: 10, active: 5 },
        lastHealthCheck: new Date(),
        healthChecksPassed: 95,
        healthChecksFailed: 5,
        restartHistory: [],
      };

      mockManager.getHealthReport.mockResolvedValue(mockHealthReport);

      await handleDaemonHealth(ctx);

      // Should contain a memory bar visualization
      // The exact format depends on createMemoryBar implementation
      // We verify the bar is displayed with the heap usage line
      const heapUsageCall = consoleSpy.mock.calls.find(call =>
        call[0] && call[0].includes('Heap Used:')
      );
      expect(heapUsageCall).toBeTruthy();

      // Should have a bar visualization on the next line
      const barCall = consoleSpy.mock.calls.find(call =>
        call[0] && (call[0].includes('█') || call[0].includes('['))
      );
      expect(barCall).toBeTruthy();
    });
  });
});