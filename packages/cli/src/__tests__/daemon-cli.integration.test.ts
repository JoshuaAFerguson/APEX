import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { commands } from '../index';

// Create mock manager instance that will be configured in beforeEach
const mockManagerInstance = {
  startDaemon: vi.fn(),
  stopDaemon: vi.fn(),
  killDaemon: vi.fn(),
  getStatus: vi.fn(),
  getExtendedStatus: vi.fn(),
};

// Mock DaemonManager as a proper class
vi.mock('@apex/orchestrator', () => {
  return {
    DaemonManager: class MockDaemonManager {
      constructor() {
        return mockManagerInstance;
      }
    },
    DaemonError: class extends Error {
      code: string;
      cause?: Error;
      constructor(message: string, code: string, cause?: Error) {
        super(message);
        this.name = 'DaemonError';
        this.code = code;
        this.cause = cause;
      }
    },
  };
});

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

// Import after mocks are set up
import { DaemonError } from '@apex/orchestrator';

describe('Daemon CLI Integration', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let daemonCommand: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console.log
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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
      mockManagerInstance.startDaemon.mockResolvedValue(12345);

      await daemonCommand.handler(ctx, ['start']);

      expect(mockManagerInstance.startDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon started (PID: 12345)');
    });

    it('should start daemon with custom poll interval', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManagerInstance.startDaemon.mockResolvedValue(54321);

      await daemonCommand.handler(ctx, ['start', '--poll-interval', '2000']);

      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon started (PID: 54321)');
    });

    it('should handle already running error', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      const error = new DaemonError('Already running', 'ALREADY_RUNNING');
      mockManagerInstance.startDaemon.mockRejectedValue(error);

      await daemonCommand.handler(ctx, ['start']);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is already running.');
    });
  });

  describe('daemon stop subcommand', () => {
    it('should stop running daemon gracefully', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManagerInstance.getStatus.mockResolvedValue({ running: true });
      mockManagerInstance.stopDaemon.mockResolvedValue(undefined);

      await daemonCommand.handler(ctx, ['stop']);

      expect(mockManagerInstance.stopDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon stopped');
    });

    it('should force kill daemon when requested', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManagerInstance.getStatus.mockResolvedValue({ running: true });
      mockManagerInstance.killDaemon.mockResolvedValue(undefined);

      await daemonCommand.handler(ctx, ['stop', '--force']);

      expect(mockManagerInstance.killDaemon).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Daemon killed (force)');
    });

    it('should handle daemon not running', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManagerInstance.getStatus.mockResolvedValue({ running: false });

      await daemonCommand.handler(ctx, ['stop']);

      expect(consoleSpy).toHaveBeenCalledWith('Daemon is not running.');
    });
  });

  describe('daemon status subcommand', () => {
    it('should show running daemon status', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManagerInstance.getExtendedStatus.mockResolvedValue({
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
      });

      await daemonCommand.handler(ctx, ['status']);

      expect(consoleSpy).toHaveBeenCalledWith('\nDaemon Status');
      // Check that running state and PID are shown (exact formatting may vary)
      expect(consoleSpy.mock.calls.some(call => call[0]?.includes?.('running'))).toBe(true);
      expect(consoleSpy.mock.calls.some(call => call[0]?.includes?.('12345'))).toBe(true);
    });

    it('should show stopped daemon status', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManagerInstance.getExtendedStatus.mockResolvedValue({ running: false });

      await daemonCommand.handler(ctx, ['status']);

      // Check that stopped state is shown (exact formatting may vary)
      expect(consoleSpy.mock.calls.some(call => call[0]?.includes?.('stopped'))).toBe(true);
      expect(consoleSpy.mock.calls.some(call => call[0]?.includes?.('/daemon start'))).toBe(true);
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
      expect(mockManagerInstance.startDaemon).not.toHaveBeenCalled();
    });

    it('should allow status command on uninitialized project', async () => {
      const ctx = { cwd: '/test/project', initialized: false };
      mockManagerInstance.getExtendedStatus.mockResolvedValue({ running: false });

      await daemonCommand.handler(ctx, ['status']);

      expect(mockManagerInstance.getExtendedStatus).toHaveBeenCalled();
      // Check that stopped state is shown (exact formatting may vary)
      expect(consoleSpy.mock.calls.some(call => call[0]?.includes?.('stopped'))).toBe(true);
    });

    it('should allow stop command on uninitialized project', async () => {
      const ctx = { cwd: '/test/project', initialized: false };
      mockManagerInstance.getStatus.mockResolvedValue({ running: false });

      await daemonCommand.handler(ctx, ['stop']);

      expect(mockManagerInstance.getStatus).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Daemon is not running.');
    });
  });

  describe('argument parsing edge cases', () => {
    it('should handle mixed case subcommands', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManagerInstance.startDaemon.mockResolvedValue(12345);

      await daemonCommand.handler(ctx, ['START']);

      expect(mockManagerInstance.startDaemon).toHaveBeenCalled();
    });

    it('should handle extra arguments gracefully', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManagerInstance.startDaemon.mockResolvedValue(12345);

      await daemonCommand.handler(ctx, ['start', 'extra', 'args']);

      expect(mockManagerInstance.startDaemon).toHaveBeenCalled();
    });

    it('should handle poll interval with missing value', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      mockManagerInstance.startDaemon.mockResolvedValue(12345);

      await daemonCommand.handler(ctx, ['start', '--poll-interval']);

      // Should start daemon with undefined poll interval (uses default)
      expect(mockManagerInstance.startDaemon).toHaveBeenCalled();
    });
  });

  describe('error propagation', () => {
    it('should propagate unexpected errors', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      const error = new Error('Unexpected system error');
      mockManagerInstance.startDaemon.mockRejectedValue(error);

      await daemonCommand.handler(ctx, ['start']);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start daemon: Unexpected system error');
    });

    it('should handle errors during status check', async () => {
      const ctx = { cwd: '/test/project', initialized: true };
      const error = new Error('Status check failed');
      mockManagerInstance.getExtendedStatus.mockRejectedValue(error);

      // The status handler currently propagates errors - this test verifies the behavior
      await expect(daemonCommand.handler(ctx, ['status'])).rejects.toThrow('Status check failed');
    });
  });
});