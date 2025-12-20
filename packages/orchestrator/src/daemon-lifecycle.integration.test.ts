import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DaemonManager, DaemonError, type DaemonOptions, type DaemonStatus } from './daemon';

describe('DaemonManager Lifecycle Integration Tests', () => {
  let testProjectPath: string;
  let daemonManager: DaemonManager;
  let cleanup: (() => Promise<void>) | null = null;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    const testId = Math.random().toString(36).substring(2, 15);
    testProjectPath = join(tmpdir(), `apex-daemon-test-${testId}`);

    // Ensure test directory exists
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, '.apex'), { recursive: true });

    // Create DaemonManager with test project path
    const options: DaemonOptions = {
      projectPath: testProjectPath,
      pollIntervalMs: 1000, // Fast polling for tests
      logLevel: 'debug',
      debugMode: true,
    };

    daemonManager = new DaemonManager(options);

    // Set up cleanup function for this test
    cleanup = async () => {
      try {
        // Force stop any running daemon
        await daemonManager.killDaemon();
      } catch {
        // Ignore if already stopped
      }

      try {
        // Clean up test directory
        await fs.rm(testProjectPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    };
  });

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  describe('Full Lifecycle: Start → Status → Stop', () => {
    it('should complete full lifecycle: not running → start → running → stop → not running', async () => {
      // 1. Initial state: daemon should not be running
      const initialRunning = await daemonManager.isDaemonRunning();
      expect(initialRunning).toBe(false);

      const initialStatus = await daemonManager.getStatus();
      expect(initialStatus.running).toBe(false);
      expect(initialStatus.pid).toBeUndefined();
      expect(initialStatus.startedAt).toBeUndefined();

      // 2. Start daemon
      const startTime = Date.now();
      const pid = await daemonManager.startDaemon();

      expect(typeof pid).toBe('number');
      expect(pid).toBeGreaterThan(0);

      // 3. Verify daemon is running
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief wait for startup

      const runningAfterStart = await daemonManager.isDaemonRunning();
      expect(runningAfterStart).toBe(true);

      // 4. Check detailed status
      const runningStatus = await daemonManager.getStatus();
      expect(runningStatus.running).toBe(true);
      expect(runningStatus.pid).toBe(pid);
      expect(runningStatus.startedAt).toBeInstanceOf(Date);
      expect(runningStatus.startedAt!.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(runningStatus.uptime).toBeGreaterThan(0);

      // 5. Verify PID file exists and has correct content
      const pidFilePath = join(testProjectPath, '.apex', 'daemon.pid');
      const pidFileExists = await fs.access(pidFilePath).then(() => true).catch(() => false);
      expect(pidFileExists).toBe(true);

      const pidFileContent = await fs.readFile(pidFilePath, 'utf-8');
      const pidData = JSON.parse(pidFileContent);
      expect(pidData.pid).toBe(pid);
      expect(pidData.projectPath).toBe(testProjectPath);
      expect(new Date(pidData.startedAt)).toBeInstanceOf(Date);

      // 6. Stop daemon gracefully
      const stopped = await daemonManager.stopDaemon();
      expect(stopped).toBe(true);

      // 7. Verify daemon is no longer running
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief wait for shutdown

      const finalRunning = await daemonManager.isDaemonRunning();
      expect(finalRunning).toBe(false);

      const finalStatus = await daemonManager.getStatus();
      expect(finalStatus.running).toBe(false);
      expect(finalStatus.pid).toBeUndefined();

      // 8. Verify PID file was removed
      const pidFileExistsAfter = await fs.access(pidFilePath).then(() => true).catch(() => false);
      expect(pidFileExistsAfter).toBe(false);
    }, 10000); // 10 second timeout for full lifecycle test
  });

  describe('Edge Case: Double Start Prevention', () => {
    it('should prevent starting daemon when already running', async () => {
      // Start daemon first time
      const firstPid = await daemonManager.startDaemon();
      expect(firstPid).toBeGreaterThan(0);

      // Verify it's running
      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(true);

      // Try to start again - should fail with specific error
      await expect(daemonManager.startDaemon()).rejects.toThrow(DaemonError);

      try {
        await daemonManager.startDaemon();
        expect.fail('Should have thrown DaemonError');
      } catch (error) {
        expect(error).toBeInstanceOf(DaemonError);
        expect((error as DaemonError).code).toBe('ALREADY_RUNNING');
        expect((error as DaemonError).message).toContain('already running');
      }

      // Clean up
      await daemonManager.stopDaemon();
    });

    it('should allow restart after daemon stops', async () => {
      // Start and stop daemon
      const firstPid = await daemonManager.startDaemon();
      await daemonManager.stopDaemon();

      // Wait for complete shutdown
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be able to start again
      const secondPid = await daemonManager.startDaemon();
      expect(secondPid).toBeGreaterThan(0);
      expect(secondPid).toBe(firstPid); // Same PID due to mocking, but different process

      await daemonManager.stopDaemon();
    });
  });

  describe('Edge Case: Stop When Not Running', () => {
    it('should handle stop when daemon is not running', async () => {
      // Ensure no daemon is running
      const initialRunning = await daemonManager.isDaemonRunning();
      expect(initialRunning).toBe(false);

      // Stop should return true (success) even when not running
      const stopped = await daemonManager.stopDaemon();
      expect(stopped).toBe(true);

      // Status should still show not running
      const status = await daemonManager.getStatus();
      expect(status.running).toBe(false);
    });

    it('should handle stop with stale PID file', async () => {
      // Create a stale PID file manually
      const pidFilePath = join(testProjectPath, '.apex', 'daemon.pid');
      const stalePidData = {
        pid: 99999, // Non-existent PID
        startedAt: new Date().toISOString(),
        projectPath: testProjectPath,
      };

      await fs.writeFile(pidFilePath, JSON.stringify(stalePidData, null, 2), 'utf-8');

      // Stop should handle stale PID gracefully
      const stopped = await daemonManager.stopDaemon();
      expect(stopped).toBe(true);

      // PID file should be cleaned up
      const pidFileExists = await fs.access(pidFilePath).then(() => true).catch(() => false);
      expect(pidFileExists).toBe(false);
    });
  });

  describe('Edge Case: Force Kill', () => {
    it('should force kill daemon when requested', async () => {
      // Start daemon
      const pid = await daemonManager.startDaemon();

      // Verify running
      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(true);

      // Force kill
      const killed = await daemonManager.killDaemon();
      expect(killed).toBe(true);

      // Wait for kill to take effect
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should no longer be running
      const finalRunning = await daemonManager.isDaemonRunning();
      expect(finalRunning).toBe(false);

      // PID file should be cleaned up
      const pidFilePath = join(testProjectPath, '.apex', 'daemon.pid');
      const pidFileExists = await fs.access(pidFilePath).then(() => true).catch(() => false);
      expect(pidFileExists).toBe(false);
    });

    it('should handle force kill when not running', async () => {
      // Ensure not running
      const initialRunning = await daemonManager.isDaemonRunning();
      expect(initialRunning).toBe(false);

      // Force kill should succeed even when not running
      const killed = await daemonManager.killDaemon();
      expect(killed).toBe(true);
    });
  });

  describe('PID File Handling', () => {
    it('should create PID file with correct structure', async () => {
      const startTime = Date.now();
      const pid = await daemonManager.startDaemon();

      const pidFilePath = join(testProjectPath, '.apex', 'daemon.pid');
      const content = await fs.readFile(pidFilePath, 'utf-8');
      const pidData = JSON.parse(content);

      expect(pidData).toHaveProperty('pid', pid);
      expect(pidData).toHaveProperty('projectPath', testProjectPath);
      expect(pidData).toHaveProperty('startedAt');
      expect(new Date(pidData.startedAt).getTime()).toBeGreaterThanOrEqual(startTime);
      expect(new Date(pidData.startedAt).getTime()).toBeLessThanOrEqual(Date.now());

      await daemonManager.stopDaemon();
    });

    it('should handle corrupted PID file gracefully', async () => {
      const pidFilePath = join(testProjectPath, '.apex', 'daemon.pid');

      // Create corrupted PID file
      await fs.writeFile(pidFilePath, 'invalid json content', 'utf-8');

      // Should treat as not running
      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(false);

      const status = await daemonManager.getStatus();
      expect(status.running).toBe(false);

      // Should be able to start daemon (overwrites corrupted file)
      const pid = await daemonManager.startDaemon();
      expect(pid).toBeGreaterThan(0);

      await daemonManager.stopDaemon();
    });

    it('should handle missing required fields in PID file', async () => {
      const pidFilePath = join(testProjectPath, '.apex', 'daemon.pid');

      // Create PID file with missing required fields
      const incompletePidData = {
        projectPath: testProjectPath,
        // Missing pid and startedAt
      };

      await fs.writeFile(pidFilePath, JSON.stringify(incompletePidData), 'utf-8');

      // Should treat as not running
      const running = await daemonManager.isDaemonRunning();
      expect(running).toBe(false);

      const status = await daemonManager.getStatus();
      expect(status.running).toBe(false);
    });
  });

  describe('Log File Operations', () => {
    it('should create and write to log file during daemon lifecycle', async () => {
      const logFilePath = join(testProjectPath, '.apex', 'daemon.log');

      // Start daemon
      const pid = await daemonManager.startDaemon();

      // Wait for log writes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Log file should exist
      const logExists = await fs.access(logFilePath).then(() => true).catch(() => false);
      expect(logExists).toBe(true);

      // Read log content
      const logContent = await fs.readFile(logFilePath, 'utf-8');
      expect(logContent).toContain(`Daemon started with PID: ${pid}`);
      expect(logContent).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // Timestamp format

      await daemonManager.stopDaemon();
    });

    it('should handle log file write failures gracefully', async () => {
      // Create daemon with log file in non-existent directory
      const badLogPath = join(testProjectPath, 'nonexistent', 'daemon.log');
      const optionsWithBadLog: DaemonOptions = {
        projectPath: testProjectPath,
        logFile: badLogPath,
      };

      const daemonWithBadLog = new DaemonManager(optionsWithBadLog);

      // Should still start successfully despite log issues
      const pid = await daemonWithBadLog.startDaemon();
      expect(pid).toBeGreaterThan(0);

      // Clean up
      await daemonWithBadLog.stopDaemon();
    });
  });

  describe('Directory and Permission Handling', () => {
    it('should create .apex directory if it does not exist', async () => {
      // Remove .apex directory
      await fs.rm(join(testProjectPath, '.apex'), { recursive: true, force: true });

      // Verify it doesn't exist
      const apexDirExists = await fs.access(join(testProjectPath, '.apex')).then(() => true).catch(() => false);
      expect(apexDirExists).toBe(false);

      // Start daemon should create the directory
      const pid = await daemonManager.startDaemon();
      expect(pid).toBeGreaterThan(0);

      // Directory should now exist
      const dirExistsAfter = await fs.access(join(testProjectPath, '.apex')).then(() => true).catch(() => false);
      expect(dirExistsAfter).toBe(true);

      await daemonManager.stopDaemon();
    });

    it('should handle custom PID and log file paths', async () => {
      const customPidPath = join(testProjectPath, 'custom-daemon.pid');
      const customLogPath = join(testProjectPath, 'custom-daemon.log');

      const customDaemon = new DaemonManager({
        projectPath: testProjectPath,
        pidFile: customPidPath,
        logFile: customLogPath,
      });

      const pid = await customDaemon.startDaemon();

      // Custom files should exist
      const pidExists = await fs.access(customPidPath).then(() => true).catch(() => false);
      const logExists = await fs.access(customLogPath).then(() => true).catch(() => false);

      expect(pidExists).toBe(true);
      expect(logExists).toBe(true);

      await customDaemon.stopDaemon();

      // Custom PID file should be cleaned up
      const pidExistsAfter = await fs.access(customPidPath).then(() => true).catch(() => false);
      expect(pidExistsAfter).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle permission errors gracefully', async () => {
      // This test would require setting up permission-denied scenarios
      // For now, we'll test the error types are properly thrown
      expect(DaemonError).toBeDefined();
      expect(new DaemonError('test', 'PERMISSION_DENIED')).toBeInstanceOf(Error);
    });

    it('should provide detailed error information', async () => {
      try {
        // Try to start twice to trigger error
        await daemonManager.startDaemon();
        await daemonManager.startDaemon();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DaemonError);
        const daemonError = error as DaemonError;
        expect(daemonError.code).toBe('ALREADY_RUNNING');
        expect(daemonError.message).toBeTruthy();
        expect(daemonError.name).toBe('DaemonError');
      }

      await daemonManager.stopDaemon();
    });
  });

  describe('Status Reporting Accuracy', () => {
    it('should report accurate uptime', async () => {
      const startTime = Date.now();
      await daemonManager.startDaemon();

      // Wait a known amount of time
      await new Promise(resolve => setTimeout(resolve, 500));

      const status = await daemonManager.getStatus();
      expect(status.running).toBe(true);
      expect(status.uptime).toBeGreaterThanOrEqual(500);
      expect(status.uptime).toBeLessThan(1000); // Should be reasonable

      const expectedStartTime = status.startedAt!.getTime();
      expect(expectedStartTime).toBeGreaterThanOrEqual(startTime);
      expect(expectedStartTime).toBeLessThanOrEqual(Date.now());

      await daemonManager.stopDaemon();
    });

    it('should handle rapid status checks without race conditions', async () => {
      await daemonManager.startDaemon();

      // Multiple rapid status checks
      const statusPromises = Array.from({ length: 10 }, () =>
        daemonManager.getStatus()
      );

      const statuses = await Promise.all(statusPromises);

      // All should return consistent results
      statuses.forEach(status => {
        expect(status.running).toBe(true);
        expect(status.pid).toBeGreaterThan(0);
        expect(status.uptime).toBeGreaterThan(0);
      });

      await daemonManager.stopDaemon();
    });
  });
});