import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { commands } from '../index';
import { DaemonManager, DaemonError } from '@apex/orchestrator';

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

// Mock chalk
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

describe('Daemon CLI Integration', () => {
  let mockManager: any;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let daemonCommand: any;

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

    // Find daemon command from commands array
    daemonCommand = commands.find(cmd => cmd.name === 'daemon');
    expect(daemonCommand).toBeDefined();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('daemon command registration', () => {
    it('should be registered with correct properties', () => {
      expect(daemonCommand.name).toBe('daemon');
      expect(daemonCommand.aliases).toContain('d');
      expect(daemonCommand.description).toBe('Manage background daemon process');
      expect(daemonCommand.usage).toBe('/daemon <start|stop|status> [options]');
      expect(typeof daemonCommand.handler).toBe('function');
    });
  });

  describe('daemon start subcommand', () => {
    it('should start daemon with default settings', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManager.startDaemon.mockResolvedValue(12345);

      await daemonCommand.handler(ctx, ['start']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: undefined,
      });
      expect(mockManager.startDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon started (PID: 12345)');
    });

    it('should start daemon with custom poll interval', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManager.startDaemon.mockResolvedValue(54321);

      await daemonCommand.handler(ctx, ['start', '--poll-interval', '2000']);

      expect(mockDaemonManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        pollIntervalMs: 2000,
      });
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon started (PID: 54321)');
    });

    it('should handle already running error', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      const error = new DaemonError('Already running', 'ALREADY_RUNNING');
      mockManager.startDaemon.mockRejectedValue(error);

      await daemonCommand.handler(ctx, ['start']);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is already running.');
    });
  });

  describe('daemon stop subcommand', () => {
    it('should stop running daemon gracefully', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManager.getStatus.mockResolvedValue({ running: true });
      mockManager.stopDaemon.mockResolvedValue(undefined);

      await daemonCommand.handler(ctx, ['stop']);

      expect(mockManager.stopDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon stopped');
    });

    it('should force kill daemon when requested', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManager.getStatus.mockResolvedValue({ running: true });
      mockManager.killDaemon.mockResolvedValue(undefined);

      await daemonCommand.handler(ctx, ['stop', '--force']);

      expect(mockManager.killDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon killed (force)');
    });

    it('should handle daemon not running', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManager.getStatus.mockResolvedValue({ running: false });

      await daemonCommand.handler(ctx, ['stop']);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is not running.');
    });
  });

  describe('daemon status subcommand', () => {
    it('should show running daemon status', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManager.getStatus.mockResolvedValue({
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
      });

      await daemonCommand.handler(ctx, ['status']);

      expect(consoleSpy).toHaveBeenCalledWith('\nDaemon Status');
      expect(consoleSpy).toHaveBeenCalledWith('  State:      running');
      expect(consoleSpy).toHaveBeenCalledWith('  PID:        12345');
    });

    it('should show stopped daemon status', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManager.getStatus.mockResolvedValue({ running: false });

      await daemonCommand.handler(ctx, ['status']);

      expect(consoleSpy).toHaveBeenCalledWith('  State:      stopped');
      expect(consoleSpy).toHaveBeenCalledWith("Use '/daemon start' to start the daemon.");
    });
  });

  describe('invalid subcommands', () => {
    it('should show usage for unknown subcommand', async () => {
      const ctx = { cwd: '/test/project', initialized: true };

      await daemonCommand.handler(ctx, ['unknown']);

      expect(consoleSpy).toHaveBeenCalledWith('Usage: /daemon <start|stop|status>');
      expect(consoleSpy).toHaveBeenCalledWith('\nSubcommands:');
      expect(consoleSpy).toHaveBeenCalledWith('  start [--poll-interval <ms>]   Start the daemon');
      expect(consoleSpy).toHaveBeenCalledWith('  stop [--force]                 Stop the daemon');
      expect(consoleSpy).toHaveBeenCalledWith('  status                         Show daemon status');
    });

    it('should show usage when no subcommand provided', async () => {
      const ctx = { cwd: '/test/project', initialized: true };

      await daemonCommand.handler(ctx, []);

      expect(consoleSpy).toHaveBeenCalledWith('Usage: /daemon <start|stop|status>');
    });
  });

  describe('uninitialized project handling', () => {
    it('should reject start command on uninitialized project', async () => {
      const ctx = { cwd: '/test/project', initialized: false };

      await daemonCommand.handler(ctx, ['start']);

      expect(consoleSpy).toHaveBeenCalledWith('APEX not initialized. Run /init first.');
      expect(mockManager.startDaemon).not.toHaveBeenCalled();
    });

    it('should allow status command on uninitialized project', async () => {
      const ctx = { cwd: '/test/project', initialized: false };
      mockManager.getStatus.mockResolvedValue({ running: false });

      await daemonCommand.handler(ctx, ['status']);

      expect(mockManager.getStatus).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('  State:      stopped');
    });

    it('should allow stop command on uninitialized project', async () => {
      const ctx = { cwd: '/test/project', initialized: false };
      mockManager.getStatus.mockResolvedValue({ running: false });

      await daemonCommand.handler(ctx, ['stop']);

      expect(mockManager.getStatus).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Daemon is not running.');
    });
  });

  describe('argument parsing edge cases', () => {
    it('should handle mixed case subcommands', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManager.startDaemon.mockResolvedValue(12345);

      await daemonCommand.handler(ctx, ['START']);

      expect(mockManager.startDaemon).toHaveBeenCalled();
    });

    it('should handle extra arguments gracefully', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManager.startDaemon.mockResolvedValue(12345);

      await daemonCommand.handler(ctx, ['start', 'extra', 'args']);

      expect(mockManager.startDaemon).toHaveBeenCalled();
    });

    it('should handle poll interval with missing value', async () => {
      const ctx = { cwd: '/test/project', initialized: true };

      await daemonCommand.handler(ctx, ['start', '--poll-interval']);

      expect(mockManager.startDaemon).not.toHaveBeenCalled();
      // Should not crash, but poll interval should be undefined
    });
  });

  describe('error propagation', () => {
    it('should propagate unexpected errors', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      const error = new Error('Unexpected system error');
      mockManager.startDaemon.mockRejectedValue(error);

      await daemonCommand.handler(ctx, ['start']);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start daemon: Unexpected system error');
    });

    it('should handle errors during status check', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      const error = new Error('Status check failed');
      mockManager.getStatus.mockRejectedValue(error);

      // Should not throw, but errors may be handled internally
      await expect(daemonCommand.handler(ctx, ['status'])).resolves.not.toThrow();
    });
  });
});