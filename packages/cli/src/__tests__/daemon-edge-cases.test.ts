import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleDaemonStart, handleDaemonStop, handleDaemonStatus } from '../handlers/daemon-handlers';
import { DaemonManager, DaemonError } from '@apex/orchestrator';

// Mock DaemonManager and dependencies
vi.mock('@apex/orchestrator', () => ({
  DaemonManager: vi.fn(),
  DaemonError: class extends Error {
    constructor(message: string, public code: string, public cause?: Error) {
      super(message);
      this.name = 'DaemonError';
    }
  },
}));

vi.mock('chalk', () => ({
  default: {
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    cyan: (str: string) => str,
    gray: (str: string) => str,
  },
}));

vi.mock('@apex/core', () => ({
  formatDuration: (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  },
}));

const mockDaemonManager = vi.mocked(DaemonManager);

describe('Daemon Edge Cases and Error Handling', () => {
  let mockManager: any;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

  describe('handleDaemonStart edge cases', () => {
    const ctx = { cwd: '/test/project', initialized: true };

    it('should handle poll interval with leading/trailing whitespace', async () => {
      mockManager.startDaemon.mockResolvedValue(12345);

      await handleDaemonStart(ctx, ['--poll-interval', '  5000  ']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 5000,
      });
    });

    it('should handle zero poll interval', async () => {
      await handleDaemonStart(ctx, ['--poll-interval', '0']);

      expect(consoleSpy).toHaveBeenCalledWith('Invalid poll interval. Must be a positive number.');
      expect(mockManager.startDaemon).not.toHaveBeenCalled();
    });

    it('should handle floating point poll interval', async () => {
      await handleDaemonStart(ctx, ['--poll-interval', '1000.5']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 1000,
      });
    });

    it('should handle extremely large poll interval', async () => {
      mockManager.startDaemon.mockResolvedValue(12345);

      await handleDaemonStart(ctx, ['--poll-interval', '2147483647']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 2147483647,
      });
    });

    it('should handle multiple poll interval flags (use last one)', async () => {
      mockManager.startDaemon.mockResolvedValue(12345);

      await handleDaemonStart(ctx, ['--poll-interval', '1000', '-i', '2000']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 2000,
      });
    });

    it('should handle poll interval flag without value', async () => {
      // This should not crash but should not set the interval
      await handleDaemonStart(ctx, ['--poll-interval']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: undefined,
      });
    });

    it('should handle mixed valid and invalid arguments', async () => {
      mockManager.startDaemon.mockResolvedValue(12345);

      await handleDaemonStart(ctx, ['--unknown-flag', '--poll-interval', '3000', '--another-unknown']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 3000,
      });
    });

    it('should handle DaemonError with nested cause', async () => {
      const rootCause = new Error('Permission denied accessing PID file');
      const daemonError = new DaemonError('Start failed', 'START_FAILED', rootCause);
      mockManager.startDaemon.mockRejectedValue(daemonError);

      await handleDaemonStart(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start daemon: Permission denied accessing PID file');
    });

    it('should handle DaemonError without cause', async () => {
      const daemonError = new DaemonError('Start failed', 'START_FAILED');
      mockManager.startDaemon.mockRejectedValue(daemonError);

      await handleDaemonStart(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start daemon: unknown error');
    });
  });

  describe('handleDaemonStop edge cases', () => {
    const ctx = { cwd: '/test/project', initialized: true };

    it('should handle multiple force flags', async () => {
      mockManager.getStatus.mockResolvedValue({ running: true });
      mockManager.killDaemon.mockResolvedValue(undefined);

      await handleDaemonStop(ctx, ['--force', '-f', '--force']);

      expect(mockManager.killDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon killed (force)');
    });

    it('should handle getStatus throwing error', async () => {
      const error = new Error('Failed to read PID file');
      mockManager.getStatus.mockRejectedValue(error);

      await expect(handleDaemonStop(ctx, [])).resolves.not.toThrow();
      // Error should be propagated up and handled by the calling code
    });

    it('should handle force kill on already stopped daemon', async () => {
      mockManager.getStatus.mockResolvedValue({ running: false });

      await handleDaemonStop(ctx, ['--force']);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is not running.');
      expect(mockManager.killDaemon).not.toHaveBeenCalled();
    });

    it('should handle mixed arguments with force flag', async () => {
      mockManager.getStatus.mockResolvedValue({ running: true });
      mockManager.killDaemon.mockResolvedValue(undefined);

      await handleDaemonStop(ctx, ['--unknown', '--force', '--other']);

      expect(mockManager.killDaemon).toHaveBeenCalled();
    });

    it('should handle stop failure with specific error code', async () => {
      mockManager.getStatus.mockResolvedValue({ running: true });
      const error = new DaemonError('Process not found', 'NOT_RUNNING');
      mockManager.stopDaemon.mockRejectedValue(error);

      await handleDaemonStop(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is not running.');
    });
  });

  describe('handleDaemonStatus edge cases', () => {
    const ctx = { cwd: '/test/project', initialized: true };

    it('should handle status with missing optional fields', async () => {
      mockManager.getStatus.mockResolvedValue({
        running: true,
        pid: 12345,
        // Missing startedAt and uptime
      });

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  State:      stopped');
    });

    it('should handle status with null/undefined values', async () => {
      mockManager.getStatus.mockResolvedValue({
        running: true,
        pid: null,
        startedAt: null,
        uptime: undefined,
      });

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  State:      stopped');
    });

    it('should handle status with invalid date', async () => {
      mockManager.getStatus.mockResolvedValue({
        running: true,
        pid: 12345,
        startedAt: new Date('invalid'),
        uptime: 3600000,
      });

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  State:      stopped');
    });

    it('should handle very long uptime', async () => {
      const longUptime = 365 * 24 * 3600 * 1000; // 1 year
      mockManager.getStatus.mockResolvedValue({
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01'),
        uptime: longUptime,
      });

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  State:      running');
      expect(consoleSpy).toHaveBeenCalledWith('  Uptime:     8760h 0m');
    });

    it('should handle zero uptime', async () => {
      mockManager.getStatus.mockResolvedValue({
        running: true,
        pid: 12345,
        startedAt: new Date(),
        uptime: 0,
      });

      await handleDaemonStatus(ctx);

      expect(consoleSpy).toHaveBeenCalledWith('  Uptime:     0h 0m');
    });

    it('should handle getStatus throwing error', async () => {
      const error = new Error('Status check failed');
      mockManager.getStatus.mockRejectedValue(error);

      await expect(handleDaemonStatus(ctx)).rejects.toThrow('Status check failed');
    });
  });

  describe('error message handling', () => {
    const ctx = { cwd: '/test/project', initialized: true };

    it('should handle all defined daemon error codes', async () => {
      const errorCodes: Array<[string, string]> = [
        ['ALREADY_RUNNING', 'Daemon is already running.'],
        ['NOT_RUNNING', 'Daemon is not running.'],
        ['PERMISSION_DENIED', 'Permission denied. Check .apex directory permissions.'],
        ['LOCK_FAILED', 'Failed to acquire lock on PID file.'],
        ['PID_FILE_CORRUPTED', "PID file is corrupted. Try '/daemon stop --force'."],
      ];

      for (const [code, expectedMessage] of errorCodes) {
        vi.clearAllMocks();
        const error = new DaemonError('Test error', code);
        mockManager.startDaemon.mockRejectedValue(error);

        await handleDaemonStart(ctx, []);

        expect(consoleSpy).toHaveBeenCalledWith(expectedMessage);
      }
    });

    it('should handle START_FAILED with cause', async () => {
      const cause = new Error('Port already in use');
      const error = new DaemonError('Start failed', 'START_FAILED', cause);
      mockManager.startDaemon.mockRejectedValue(error);

      await handleDaemonStart(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start daemon: Port already in use');
    });

    it('should handle STOP_FAILED with cause', async () => {
      mockManager.getStatus.mockResolvedValue({ running: true });
      const cause = new Error('Process not responding');
      const error = new DaemonError('Stop failed', 'STOP_FAILED', cause);
      mockManager.stopDaemon.mockRejectedValue(error);

      await handleDaemonStop(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to stop daemon: Process not responding');
    });
  });

  describe('context validation', () => {
    it('should handle context with undefined cwd', async () => {
      const invalidCtx = { cwd: undefined as any, initialized: true };

      await handleDaemonStart(invalidCtx, []);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: undefined,
        pollIntervalMs: undefined,
      });
    });

    it('should handle context with empty cwd', async () => {
      const invalidCtx = { cwd: '', initialized: true };

      await handleDaemonStart(invalidCtx, []);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '',
        pollIntervalMs: undefined,
      });
    });

    it('should handle context with relative path', async () => {
      const ctx = { cwd: './relative/path', initialized: true };
      mockManager.startDaemon.mockResolvedValue(12345);

      await handleDaemonStart(ctx, []);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: './relative/path',
        pollIntervalMs: undefined,
      });
    });
  });

  describe('concurrent operation scenarios', () => {
    const ctx = { cwd: '/test/project', initialized: true };

    it('should handle rapid start/stop cycles', async () => {
      // Simulate quick start followed by stop
      mockManager.startDaemon.mockResolvedValue(12345);
      mockManager.getStatus.mockResolvedValue({ running: true });
      mockManager.stopDaemon.mockResolvedValue(undefined);

      await handleDaemonStart(ctx, []);
      await handleDaemonStop(ctx, []);

      expect(mockManager.startDaemon).toHaveBeenCalled();
      expect(mockManager.stopDaemon).toHaveBeenCalled();
    });

    it('should handle concurrent status checks', async () => {
      mockManager.getStatus.mockResolvedValue({
        running: true,
        pid: 12345,
        startedAt: new Date(),
        uptime: 1000,
      });

      // Simulate multiple concurrent status calls
      await Promise.all([
        handleDaemonStatus(ctx),
        handleDaemonStatus(ctx),
        handleDaemonStatus(ctx),
      ]);

      expect(mockManager.getStatus).toHaveBeenCalledTimes(3);
    });
  });
});