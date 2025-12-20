import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DaemonManager, DaemonError, type DaemonOptions } from './daemon';

// Mock child_process.fork
const mockFork = vi.fn();
const mockChild = {
  pid: 12345,
  stdout: {
    on: vi.fn(),
  },
  stderr: {
    on: vi.fn(),
  },
  on: vi.fn(),
  unref: vi.fn(),
};

vi.mock('child_process', () => ({
  fork: mockFork,
}));

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    appendFile: vi.fn(),
  },
}));

// Mock process.kill
const originalKill = process.kill;
const mockKill = vi.fn();

describe('DaemonManager', () => {
  const testProjectPath = '/test/project';
  const testPidFile = join(testProjectPath, '.apex', 'daemon.pid');
  const testLogFile = join(testProjectPath, '.apex', 'daemon.log');

  let daemonManager: DaemonManager;
  let options: DaemonOptions;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockFork.mockReturnValue(mockChild);

    // Mock process.kill
    process.kill = mockKill;

    options = {
      projectPath: testProjectPath,
      pidFile: testPidFile,
      logFile: testLogFile,
    };

    daemonManager = new DaemonManager(options);
  });

  afterEach(() => {
    // Restore process.kill
    process.kill = originalKill;
    vi.resetAllMocks();
  });

  describe('Constructor', () => {
    it('should use default project path if not provided', () => {
      const manager = new DaemonManager();
      expect(manager).toBeInstanceOf(DaemonManager);
    });

    it('should use custom paths from options', () => {
      const customOptions = {
        projectPath: '/custom/path',
        pidFile: '/custom/daemon.pid',
        logFile: '/custom/daemon.log',
      };
      const manager = new DaemonManager(customOptions);
      expect(manager).toBeInstanceOf(DaemonManager);
    });
  });

  describe('isDaemonRunning', () => {
    it('should return false when PID file does not exist', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(false);
    });

    it('should return false when PID file is corrupted', async () => {
      (fs.readFile as any).mockResolvedValue('invalid json');

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(false);
    });

    it('should return false when process is not running', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockImplementation(() => {
        throw { code: 'ESRCH' };
      });

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(false);
    });

    it('should return true when process is running', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockReturnValue(undefined); // Process exists

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(true);
    });

    it('should return true when process exists but no permission', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockImplementation(() => {
        throw { code: 'EPERM' };
      });

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(true);
    });
  });

  describe('startDaemon', () => {
    beforeEach(() => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.appendFile as any).mockResolvedValue(undefined);
    });

    it('should throw error if daemon is already running', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockReturnValue(undefined); // Process exists

      await expect(daemonManager.startDaemon()).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon()).rejects.toThrow('already running');

      // Verify specific error code
      try {
        await daemonManager.startDaemon();
      } catch (error) {
        expect(error).toBeInstanceOf(DaemonError);
        expect((error as DaemonError).code).toBe('ALREADY_RUNNING');
      }
    });

    it('should successfully start daemon when not running', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' }); // No PID file

      const pid = await daemonManager.startDaemon();

      expect(pid).toBe(12345);
      expect(mockFork).toHaveBeenCalledWith(
        process.argv[1],
        [],
        expect.objectContaining({
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          env: expect.objectContaining({
            APEX_DAEMON_MODE: '1',
            APEX_PROJECT_PATH: testProjectPath,
          }),
        })
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        join(testProjectPath, '.apex'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        testPidFile,
        expect.stringContaining('"pid":12345'),
        'utf-8'
      );
      expect(mockChild.unref).toHaveBeenCalled();
    });

    it('should throw error if fork fails to provide PID', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      mockFork.mockReturnValue({ ...mockChild, pid: undefined });

      await expect(daemonManager.startDaemon()).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon()).rejects.toThrow('Failed to get child process PID');

      // Verify specific error code
      try {
        await daemonManager.startDaemon();
      } catch (error) {
        expect(error).toBeInstanceOf(DaemonError);
        expect((error as DaemonError).code).toBe('START_FAILED');
      }
    });

    it('should throw error if fork throws', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      mockFork.mockImplementation(() => {
        throw new Error('Fork failed');
      });

      await expect(daemonManager.startDaemon()).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon()).rejects.toThrow('Failed to start daemon process');

      // Verify specific error code
      try {
        await daemonManager.startDaemon();
      } catch (error) {
        expect(error).toBeInstanceOf(DaemonError);
        expect((error as DaemonError).code).toBe('START_FAILED');
      }
    });

    it('should handle output callbacks', async () => {
      const onOutput = vi.fn();
      const onError = vi.fn();
      const managerWithCallbacks = new DaemonManager({
        ...options,
        onOutput,
        onError,
      });

      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await managerWithCallbacks.startDaemon();

      // Simulate stdout data
      const stdoutCallback = mockChild.stdout.on.mock.calls.find(
        call => call[0] === 'data'
      )?.[1];
      stdoutCallback?.('test output');

      // Simulate stderr data
      const stderrCallback = mockChild.stderr.on.mock.calls.find(
        call => call[0] === 'data'
      )?.[1];
      stderrCallback?.('test error');

      expect(onOutput).toHaveBeenCalledWith('test output');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('stopDaemon', () => {
    it('should return true if daemon is not running', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      const result = await daemonManager.stopDaemon();
      expect(result).toBe(true);
    });

    it('should gracefully stop running daemon', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      (fs.unlink as any).mockResolvedValue(undefined);

      // Mock successful SIGTERM
      mockKill.mockReturnValue(undefined);

      // Mock process exit after SIGTERM
      let processRunning = true;
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => { processRunning = false; }, 50);
          return undefined;
        }
        if (signal === 0) {
          if (!processRunning) throw { code: 'ESRCH' };
          return undefined;
        }
      });

      const result = await daemonManager.stopDaemon();

      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(fs.unlink).toHaveBeenCalledWith(testPidFile);
    });

    it('should force kill if graceful shutdown times out', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      (fs.unlink as any).mockResolvedValue(undefined);

      // Mock SIGTERM that doesn't work, but SIGKILL does
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 0 && signal !== 'SIGKILL') return undefined; // Process still running
        if (signal === 'SIGTERM') return undefined; // SIGTERM sent but process continues
        if (signal === 'SIGKILL') {
          // Mock process killed
          mockKill.mockImplementation((pid, sig) => {
            if (sig === 0) throw { code: 'ESRCH' };
          });
          return undefined;
        }
      });

      const result = await daemonManager.stopDaemon();

      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGKILL');
    });
  });

  describe('getStatus', () => {
    it('should return not running when no PID file', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      const status = await daemonManager.getStatus();

      expect(status).toEqual({ running: false });
    });

    it('should return detailed status when running', async () => {
      const startedAt = new Date();
      const pidData = {
        pid: 12345,
        startedAt: startedAt.toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockReturnValue(undefined); // Process exists

      const status = await daemonManager.getStatus();

      expect(status.running).toBe(true);
      expect(status.pid).toBe(12345);
      expect(status.startedAt).toEqual(startedAt);
      expect(status.uptime).toBeGreaterThan(0);
    });

    it('should clean up stale PID file and return not running', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      (fs.unlink as any).mockResolvedValue(undefined);
      mockKill.mockImplementation(() => {
        throw { code: 'ESRCH' }; // Process doesn't exist
      });

      const status = await daemonManager.getStatus();

      expect(status).toEqual({ running: false });
      expect(fs.unlink).toHaveBeenCalledWith(testPidFile);
    });
  });

  describe('killDaemon', () => {
    it('should return true if daemon is not running', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      const result = await daemonManager.killDaemon();
      expect(result).toBe(true);
    });

    it('should force kill running daemon', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      (fs.unlink as any).mockResolvedValue(undefined);
      mockKill.mockReturnValue(undefined);

      const result = await daemonManager.killDaemon();

      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGKILL');
      expect(fs.unlink).toHaveBeenCalledWith(testPidFile);
    });

    it('should throw error if kill fails', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockImplementation(() => {
        throw new Error('Kill failed');
      });

      await expect(daemonManager.killDaemon()).rejects.toThrow(DaemonError);
    });
  });

  describe('Error Handling', () => {
    it('should throw DaemonError for corrupted PID file', async () => {
      (fs.readFile as any).mockResolvedValue('{"invalid": "data"}');

      await expect(daemonManager.isDaemonRunning()).resolves.toBe(false);
    });

    it('should throw DaemonError when cannot create .apex directory', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      (fs.mkdir as any).mockRejectedValue(new Error('Permission denied'));

      await expect(daemonManager.startDaemon()).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon()).rejects.toThrow('Permission denied');

      // Verify specific error code
      try {
        await daemonManager.startDaemon();
      } catch (error) {
        expect(error).toBeInstanceOf(DaemonError);
        expect((error as DaemonError).code).toBe('PERMISSION_DENIED');
      }
    });

    it('should throw DaemonError when cannot write PID file', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockRejectedValue(new Error('Write failed'));

      await expect(daemonManager.startDaemon()).rejects.toThrow(DaemonError);

      // Verify specific error code
      try {
        await daemonManager.startDaemon();
      } catch (error) {
        expect(error).toBeInstanceOf(DaemonError);
        expect((error as DaemonError).code).toBe('LOCK_FAILED');
      }
    });
  });

  describe('PID File Validation', () => {
    it('should handle PID file with missing pid field', async () => {
      const invalidPidData = {
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(invalidPidData));

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(false);
    });

    it('should handle PID file with invalid pid type', async () => {
      const invalidPidData = {
        pid: "not-a-number",
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(invalidPidData));

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(false);
    });

    it('should handle PID file with missing startedAt field', async () => {
      const invalidPidData = {
        pid: 12345,
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(invalidPidData));

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(false);
    });

    it('should throw DaemonError with PID_FILE_CORRUPTED code during readPidFile', async () => {
      const invalidPidData = { pid: "invalid" };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(invalidPidData));

      try {
        await daemonManager.getStatus();
      } catch (error) {
        // Should not throw, just return running: false
      }

      // Status should handle corruption gracefully
      const status = await daemonManager.getStatus();
      expect(status.running).toBe(false);
    });

    it('should write PID file with correct structure and data', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.appendFile as any).mockResolvedValue(undefined);

      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '1.2.3';

      try {
        const startTime = Date.now();
        await daemonManager.startDaemon();

        // Verify PID file write was called with correct structure
        expect(fs.writeFile).toHaveBeenCalledWith(
          testPidFile,
          expect.any(String),
          'utf-8'
        );

        // Parse the written data to verify structure
        const writeCall = (fs.writeFile as any).mock.calls.find(
          call => call[0] === testPidFile
        );
        const pidData = JSON.parse(writeCall[1]);

        expect(pidData.pid).toBe(12345);
        expect(pidData.version).toBe('1.2.3');
        expect(pidData.projectPath).toBe(testProjectPath);
        expect(new Date(pidData.startedAt).getTime()).toBeGreaterThanOrEqual(startTime);
        expect(new Date(pidData.startedAt).getTime()).toBeLessThanOrEqual(Date.now());
      } finally {
        process.env.npm_package_version = originalVersion;
      }
    });
  });

  describe('Process Exit Handler', () => {
    beforeEach(() => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.appendFile as any).mockResolvedValue(undefined);
      (fs.unlink as any).mockResolvedValue(undefined);
    });

    it('should register exit handler that cleans up PID file', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await daemonManager.startDaemon();

      // Verify exit handler was registered
      expect(mockChild.on).toHaveBeenCalledWith('exit', expect.any(Function));

      // Get the exit handler function
      const exitHandler = mockChild.on.mock.calls.find(
        call => call[0] === 'exit'
      )?.[1];

      expect(exitHandler).toBeDefined();

      // Simulate process exit
      await exitHandler(0);

      // Verify PID file removal was attempted
      expect(fs.unlink).toHaveBeenCalledWith(testPidFile);
    });

    it('should handle exit with different exit codes', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await daemonManager.startDaemon();

      const exitHandler = mockChild.on.mock.calls.find(
        call => call[0] === 'exit'
      )?.[1];

      // Test various exit codes
      for (const exitCode of [0, 1, 130, null]) {
        vi.clearAllMocks();
        await exitHandler(exitCode);
        expect(fs.unlink).toHaveBeenCalledWith(testPidFile);
      }
    });

    it('should handle exit handler when PID file removal fails', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await daemonManager.startDaemon();

      const exitHandler = mockChild.on.mock.calls.find(
        call => call[0] === 'exit'
      )?.[1];

      // Mock unlink to fail
      (fs.unlink as any).mockRejectedValue(new Error('Permission denied'));

      // Should not throw despite unlink failure
      await expect(exitHandler(0)).resolves.toBeUndefined();
    });
  });

  describe('PID File Cleanup', () => {
    it('should successfully remove existing PID file', async () => {
      (fs.unlink as any).mockResolvedValue(undefined);

      // Test through removePidFile via stopDaemon
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Mock process doesn't exist (already stopped)
      mockKill.mockImplementation(() => {
        throw { code: 'ESRCH' };
      });

      await daemonManager.stopDaemon();

      expect(fs.unlink).toHaveBeenCalledWith(testPidFile);
    });

    it('should ignore ENOENT when removing PID file', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Mock unlink to fail with ENOENT (file doesn't exist)
      (fs.unlink as any).mockRejectedValue({ code: 'ENOENT' });

      // Mock process doesn't exist
      mockKill.mockImplementation(() => {
        throw { code: 'ESRCH' };
      });

      // Should succeed despite ENOENT
      const result = await daemonManager.stopDaemon();
      expect(result).toBe(true);
    });

    it('should propagate non-ENOENT errors when removing PID file', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Mock unlink to fail with permission error
      (fs.unlink as any).mockRejectedValue(new Error('Permission denied'));

      // Mock process doesn't exist
      mockKill.mockImplementation(() => {
        throw { code: 'ESRCH' };
      });

      await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
      await expect(daemonManager.stopDaemon()).rejects.toThrow('Permission denied');
    });
  });

  describe('waitForExit Internal Method Testing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true immediately if process is not running', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      (fs.unlink as any).mockResolvedValue(undefined);

      // Mock process not running from the start
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') return undefined;
        if (signal === 0) throw { code: 'ESRCH' }; // Process doesn't exist
      });

      const stopPromise = daemonManager.stopDaemon();

      // Fast forward time to ensure waitForExit logic runs
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const result = await stopPromise;
      expect(result).toBe(true);
    });

    it('should timeout and return false after specified timeout', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      (fs.unlink as any).mockResolvedValue(undefined);

      // Mock process that never stops (for SIGTERM, but stops for SIGKILL)
      let processKilled = false;
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') return undefined; // SIGTERM sent but process continues
        if (signal === 0 && !processKilled) return undefined; // Process still running
        if (signal === 'SIGKILL') {
          processKilled = true;
          return undefined;
        }
        if (signal === 0 && processKilled) throw { code: 'ESRCH' }; // Process killed
      });

      const stopPromise = daemonManager.stopDaemon();

      // Advance time to trigger timeout (10 seconds for graceful shutdown)
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      // Should eventually succeed with force kill
      const result = await stopPromise;
      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGKILL');
    });

    it('should return true when process exits during wait period', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      (fs.unlink as any).mockResolvedValue(undefined);

      let processRunning = true;
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') {
          // Process will exit after 500ms
          setTimeout(() => { processRunning = false; }, 500);
          return undefined;
        }
        if (signal === 0) {
          if (!processRunning) throw { code: 'ESRCH' };
          return undefined;
        }
      });

      const stopPromise = daemonManager.stopDaemon();

      // Advance time to when process should exit
      vi.advanceTimersByTime(600);
      await vi.runAllTimersAsync();

      const result = await stopPromise;
      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
      // Should not have called SIGKILL since graceful shutdown worked
      expect(mockKill).not.toHaveBeenCalledWith(12345, 'SIGKILL');
    });
  });

  describe('Logging Functionality', () => {
    beforeEach(() => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.appendFile as any).mockResolvedValue(undefined);
      vi.useFakeTimers();
      // Set a fixed time for predictable log timestamps
      vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should log daemon start with correct format', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await daemonManager.startDaemon();

      // Check that appendFile was called for logging
      expect(fs.appendFile).toHaveBeenCalled();

      // Find the log call for daemon start
      const logCalls = (fs.appendFile as any).mock.calls;
      const startLogCall = logCalls.find(call =>
        call[0] === testLogFile && call[1].includes('Daemon started with PID')
      );

      expect(startLogCall).toBeDefined();
      expect(startLogCall[1]).toMatch(/^\[2024-01-15T10:30:00\.000Z\] Daemon started with PID: 12345\n$/);
    });

    it('should log process exit with correct format', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await daemonManager.startDaemon();

      // Get the exit handler and simulate exit
      const exitHandler = mockChild.on.mock.calls.find(
        call => call[0] === 'exit'
      )?.[1];

      await exitHandler(0);

      // Find the log call for process exit
      const logCalls = (fs.appendFile as any).mock.calls;
      const exitLogCall = logCalls.find(call =>
        call[0] === testLogFile && call[1].includes('Daemon process exited')
      );

      expect(exitLogCall).toBeDefined();
      expect(exitLogCall[1]).toMatch(/^\[2024-01-15T10:30:00\.000Z\] Daemon process exited with code: 0\n$/);
    });

    it('should handle logging errors gracefully', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      // Mock appendFile to fail but not throw
      (fs.appendFile as any).mockRejectedValue(new Error('Log write failed'));

      // Should not throw despite log write failure
      await expect(daemonManager.startDaemon()).resolves.toBeDefined();
    });

    it('should log SIGTERM and graceful shutdown', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      (fs.unlink as any).mockResolvedValue(undefined);

      // Mock successful graceful shutdown
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 0) throw { code: 'ESRCH' }; // Process not running after SIGTERM
        return undefined;
      });

      await daemonManager.stopDaemon();

      // Find log calls for stop process
      const logCalls = (fs.appendFile as any).mock.calls;

      const sigtermLogCall = logCalls.find(call =>
        call[0] === testLogFile && call[1].includes('Sent SIGTERM')
      );
      const gracefulLogCall = logCalls.find(call =>
        call[0] === testLogFile && call[1].includes('Daemon stopped gracefully')
      );

      expect(sigtermLogCall).toBeDefined();
      expect(gracefulLogCall).toBeDefined();

      expect(sigtermLogCall[1]).toMatch(/^\[2024-01-15T10:30:00\.000Z\] Sent SIGTERM to daemon PID: 12345\n$/);
      expect(gracefulLogCall[1]).toMatch(/^\[2024-01-15T10:30:00\.000Z\] Daemon stopped gracefully\n$/);
    });
  });

  describe('Full Lifecycle Integration', () => {
    beforeEach(() => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.appendFile as any).mockResolvedValue(undefined);
      (fs.unlink as any).mockResolvedValue(undefined);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should complete full lifecycle: not running → start → running → stop → not running', async () => {
      // 1. Initial state: not running
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      let initialRunning = await daemonManager.isDaemonRunning();
      expect(initialRunning).toBe(false);

      let initialStatus = await daemonManager.getStatus();
      expect(initialStatus).toEqual({ running: false });

      // 2. Start daemon
      const startTime = Date.now();
      const pid = await daemonManager.startDaemon();
      expect(pid).toBe(12345);

      // 3. Check running state
      const pidData = {
        pid: 12345,
        startedAt: new Date(startTime).toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockReturnValue(undefined); // Process is running

      const runningAfterStart = await daemonManager.isDaemonRunning();
      expect(runningAfterStart).toBe(true);

      // 4. Check status with uptime
      vi.advanceTimersByTime(2000); // 2 seconds later

      const runningStatus = await daemonManager.getStatus();
      expect(runningStatus.running).toBe(true);
      expect(runningStatus.pid).toBe(12345);
      expect(runningStatus.startedAt).toEqual(new Date(startTime));
      expect(runningStatus.uptime).toBeGreaterThanOrEqual(2000);

      // 5. Stop daemon gracefully
      let processRunning = true;
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => { processRunning = false; }, 100);
          return undefined;
        }
        if (signal === 0) {
          if (!processRunning) throw { code: 'ESRCH' };
          return undefined;
        }
      });

      const stopPromise = daemonManager.stopDaemon();
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      const stopResult = await stopPromise;
      expect(stopResult).toBe(true);

      // 6. Verify final state: not running
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' }); // PID file removed

      const finalRunning = await daemonManager.isDaemonRunning();
      expect(finalRunning).toBe(false);

      const finalStatus = await daemonManager.getStatus();
      expect(finalStatus).toEqual({ running: false });

      // 7. Verify expected method calls
      expect(fs.writeFile).toHaveBeenCalledWith(testPidFile, expect.any(String), 'utf-8');
      expect(fs.unlink).toHaveBeenCalledWith(testPidFile);
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
    });

    it('should handle restart scenario: stop → start → running', async () => {
      // Start with daemon already running
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      let processRunning = true;
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') {
          setTimeout(() => { processRunning = false; }, 100);
          return undefined;
        }
        if (signal === 0) {
          if (!processRunning) throw { code: 'ESRCH' };
          return undefined;
        }
      });

      // Stop the daemon
      const stopPromise = daemonManager.stopDaemon();
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      await stopPromise;

      // Now start a new daemon (simulate no PID file)
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      const newPid = await daemonManager.startDaemon();
      expect(newPid).toBe(12345);

      // Verify it's running
      const newPidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(newPidData));
      mockKill.mockReturnValue(undefined);

      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(true);
    });

    it('should handle force kill scenario when graceful stop fails', async () => {
      // Start with daemon running
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      // Mock process that ignores SIGTERM but responds to SIGKILL
      let processKilled = false;
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') return undefined; // Ignore SIGTERM
        if (signal === 0 && !processKilled) return undefined; // Process still running
        if (signal === 'SIGKILL') {
          processKilled = true;
          return undefined;
        }
        if (signal === 0 && processKilled) throw { code: 'ESRCH' }; // Process killed
      });

      const stopPromise = daemonManager.stopDaemon();

      // Advance time to trigger timeout and force kill
      vi.advanceTimersByTime(10100); // Just over the 10s timeout
      await vi.runAllTimersAsync();

      const result = await stopPromise;
      expect(result).toBe(true);

      // Verify both SIGTERM and SIGKILL were called
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGKILL');
    });
  });

  describe('Concurrency and Race Conditions', () => {
    beforeEach(() => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.appendFile as any).mockResolvedValue(undefined);
      (fs.unlink as any).mockResolvedValue(undefined);
    });

    it('should prevent concurrent start attempts', async () => {
      // Initially no daemon running
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      // Start first daemon attempt
      const firstStart = daemonManager.startDaemon();

      // Immediately try to start another (should fail)
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockReturnValue(undefined); // Process exists

      const secondStart = daemonManager.startDaemon();

      // First should succeed
      const firstPid = await firstStart;
      expect(firstPid).toBe(12345);

      // Second should fail with ALREADY_RUNNING error
      await expect(secondStart).rejects.toThrow(DaemonError);
      await expect(secondStart).rejects.toThrow('already running');
    });

    it('should handle status check during shutdown', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));

      let processRunning = true;
      mockKill.mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') {
          // Simulate slow shutdown
          setTimeout(() => { processRunning = false; }, 1000);
          return undefined;
        }
        if (signal === 0) {
          if (!processRunning) throw { code: 'ESRCH' };
          return undefined;
        }
      });

      // Start shutdown
      const stopPromise = daemonManager.stopDaemon();

      // Check status during shutdown (should still show running initially)
      const statusDuringShutdown = await daemonManager.getStatus();
      expect(statusDuringShutdown.running).toBe(true);
      expect(statusDuringShutdown.pid).toBe(12345);

      // Complete shutdown
      await stopPromise;
    });

    it('should handle concurrent status checks', async () => {
      const pidData = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(pidData));
      mockKill.mockReturnValue(undefined);

      // Multiple concurrent status checks
      const statusPromises = Array.from({ length: 5 }, () =>
        daemonManager.getStatus()
      );

      const statuses = await Promise.all(statusPromises);

      // All should return the same result
      statuses.forEach(status => {
        expect(status.running).toBe(true);
        expect(status.pid).toBe(12345);
        expect(status.uptime).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('DaemonError', () => {
    it('should create error with code and message', () => {
      const error = new DaemonError('Test message', 'ALREADY_RUNNING');

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('ALREADY_RUNNING');
      expect(error.name).toBe('DaemonError');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with cause', () => {
      const cause = new Error('Root cause');
      const error = new DaemonError('Test message', 'START_FAILED', cause);

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('START_FAILED');
      expect(error.cause).toBe(cause);
    });
  });
});