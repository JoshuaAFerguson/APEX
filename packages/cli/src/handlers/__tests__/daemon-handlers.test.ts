import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chalk from 'chalk';
import { handleDaemonStart, handleDaemonStop, handleDaemonStatus } from '../daemon-handlers';
import { DaemonManager, DaemonError, DaemonStatus } from '@apex/orchestrator';

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

    it('should display running daemon status', async () => {
      const status: DaemonStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000, // 1 hour in ms
      };
      mockManager.getStatus.mockResolvedValue(status);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('\nDaemon Status');
      expect(consoleSpy).toHaveBeenCalledWith('─'.repeat(36));
      expect(consoleSpy).toHaveBeenCalledWith('  State:      running');
      expect(consoleSpy).toHaveBeenCalledWith('  PID:        12345');
      expect(consoleSpy).toHaveBeenCalledWith('  Started:    1/1/2023, 10:00:00 AM');
      expect(consoleSpy).toHaveBeenCalledWith('  Uptime:     1h 0m');
      expect(consoleSpy).toHaveBeenCalledWith('  Log file:   .apex/daemon.log');
    });

    it('should display stopped daemon status', async () => {
      const status: DaemonStatus = {
        running: false,
      };
      mockManager.getStatus.mockResolvedValue(status);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('\nDaemon Status');
      expect(consoleSpy).toHaveBeenCalledWith('─'.repeat(36));
      expect(consoleSpy).toHaveBeenCalledWith('  State:      stopped');
      expect(consoleSpy).toHaveBeenCalledWith("Use '/daemon start' to start the daemon.");
    });

    it('should handle partial status data', async () => {
      const status: DaemonStatus = {
        running: true,
        pid: 12345,
        // Missing startedAt and uptime
      };
      mockManager.getStatus.mockResolvedValue(status);

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  State:      stopped');
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
});