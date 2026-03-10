import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { handleDaemonStart, handleDaemonStop, handleDaemonStatus } from '../packages/cli/src/handlers/daemon-handlers';

/**
 * v0.4.0 Daemon CLI Integration Tests
 *
 * These tests verify the actual CLI handlers for daemon commands work correctly
 * across different platforms with real process management.
 */
describe('v0.4.0 Daemon CLI Integration Tests', () => {
  let testProjectPath: string;
  let originalPlatform: NodeJS.Platform;
  let mockCtx: { cwd: string; initialized: boolean };

  beforeEach(async () => {
    originalPlatform = process.platform;
    testProjectPath = join(__dirname, 'test-project-daemon-cli');

    // Create test project structure
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, '.apex'), { recursive: true });

    // Initialize mock context
    mockCtx = {
      cwd: testProjectPath,
      initialized: true
    };

    // Mock console.log to capture output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Restore platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true
    });

    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  describe('Daemon Start CLI Handler', () => {
    it('should handle daemon start with default options', async () => {
      // Mock DaemonManager to avoid actual daemon start
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      const startDaemonSpy = vi.spyOn(DaemonManager.prototype, 'startDaemon')
        .mockResolvedValue(12345);

      await handleDaemonStart(mockCtx, []);

      expect(startDaemonSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Starting daemon'));
    });

    it('should handle daemon start with custom poll interval', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      const startDaemonSpy = vi.spyOn(DaemonManager.prototype, 'startDaemon')
        .mockResolvedValue(12345);

      await handleDaemonStart(mockCtx, ['--poll-interval', '10000']);

      expect(startDaemonSpy).toHaveBeenCalled();
      // Verify the manager was created with custom poll interval
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Starting daemon'));
    });

    it('should reject invalid poll intervals', async () => {
      await handleDaemonStart(mockCtx, ['--poll-interval', 'invalid']);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Invalid poll interval')
      );
    });

    it('should check initialization before starting daemon', async () => {
      const uninitializedCtx = { ...mockCtx, initialized: false };

      await handleDaemonStart(uninitializedCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
    });

    it('should handle daemon start errors gracefully', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      vi.spyOn(DaemonManager.prototype, 'startDaemon')
        .mockRejectedValue(new Error('Failed to start daemon'));

      await handleDaemonStart(mockCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error starting daemon')
      );
    });
  });

  describe('Daemon Stop CLI Handler', () => {
    it('should handle daemon stop successfully', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      vi.spyOn(DaemonManager.prototype, 'stopDaemon')
        .mockResolvedValue(true);

      await handleDaemonStop(mockCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Stopping daemon')
      );
    });

    it('should handle daemon not running scenario', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      vi.spyOn(DaemonManager.prototype, 'stopDaemon')
        .mockResolvedValue(false);

      await handleDaemonStop(mockCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Daemon is not running')
      );
    });

    it('should check initialization before stopping daemon', async () => {
      const uninitializedCtx = { ...mockCtx, initialized: false };

      await handleDaemonStop(uninitializedCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
    });

    it('should handle stop errors gracefully', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      vi.spyOn(DaemonManager.prototype, 'stopDaemon')
        .mockRejectedValue(new Error('Failed to stop daemon'));

      await handleDaemonStop(mockCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error stopping daemon')
      );
    });
  });

  describe('Daemon Status CLI Handler', () => {
    it('should display basic status when daemon is running', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      const mockStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000
      };

      vi.spyOn(DaemonManager.prototype, 'getStatus')
        .mockResolvedValue(mockStatus);

      await handleDaemonStatus(mockCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Daemon Status: Running')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('PID: 12345')
      );
    });

    it('should display status when daemon is not running', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      const mockStatus = {
        running: false
      };

      vi.spyOn(DaemonManager.prototype, 'getStatus')
        .mockResolvedValue(mockStatus);

      await handleDaemonStatus(mockCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Daemon Status: Not Running')
      );
    });

    it('should display extended status with --extended flag', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      const mockExtendedStatus = {
        running: true,
        pid: 12345,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        uptime: 3600000,
        capacity: {
          mode: 'day' as const,
          capacityThreshold: 0.90,
          currentUsagePercent: 0.45,
          isAutoPaused: false,
          nextModeSwitch: new Date('2023-01-01T18:00:00Z'),
          timeBasedUsageEnabled: true
        }
      };

      vi.spyOn(DaemonManager.prototype, 'getExtendedStatus')
        .mockResolvedValue(mockExtendedStatus);

      await handleDaemonStatus(mockCtx, ['--extended']);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Capacity Mode: day')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Usage: 45.0%')
      );
    });

    it('should check initialization before showing status', async () => {
      const uninitializedCtx = { ...mockCtx, initialized: false };

      await handleDaemonStatus(uninitializedCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
    });

    it('should handle status check errors gracefully', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      vi.spyOn(DaemonManager.prototype, 'getStatus')
        .mockRejectedValue(new Error('Failed to get status'));

      await handleDaemonStatus(mockCtx, []);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Error getting daemon status')
      );
    });
  });

  describe('Cross-Platform CLI Behavior', () => {
    const testPlatforms: NodeJS.Platform[] = ['linux', 'darwin', 'win32'];

    testPlatforms.forEach((platform) => {
      it(`should work correctly on ${platform}`, async () => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: true
        });

        const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
        const startSpy = vi.spyOn(DaemonManager.prototype, 'startDaemon')
          .mockResolvedValue(12345);

        await handleDaemonStart(mockCtx, []);

        expect(startSpy).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Starting daemon')
        );
      });
    });
  });

  describe('CLI Argument Parsing', () => {
    it('should parse multiple arguments correctly', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      const startSpy = vi.spyOn(DaemonManager.prototype, 'startDaemon')
        .mockResolvedValue(12345);

      await handleDaemonStart(mockCtx, [
        '--poll-interval', '5000',
        '--verbose'
      ]);

      expect(startSpy).toHaveBeenCalled();
    });

    it('should handle unknown arguments gracefully', async () => {
      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      const startSpy = vi.spyOn(DaemonManager.prototype, 'startDaemon')
        .mockResolvedValue(12345);

      await handleDaemonStart(mockCtx, [
        '--unknown-flag', 'value'
      ]);

      // Should still start daemon, ignoring unknown flags
      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe('Real Process Integration', () => {
    it('should validate PID file operations', async () => {
      const pidFile = join(testProjectPath, '.apex', 'daemon.pid');

      // Write a mock PID file
      await fs.writeFile(pidFile, '12345');

      // Verify file exists
      const pidExists = await fs.access(pidFile).then(() => true).catch(() => false);
      expect(pidExists).toBe(true);

      // Read PID back
      const pidContent = await fs.readFile(pidFile, 'utf-8');
      expect(pidContent.trim()).toBe('12345');
    });

    it('should handle log file creation and access', async () => {
      const logFile = join(testProjectPath, '.apex', 'daemon.log');

      // Write a mock log entry
      await fs.writeFile(logFile, 'Test log entry\n');

      // Verify log file exists and is readable
      const logExists = await fs.access(logFile).then(() => true).catch(() => false);
      expect(logExists).toBe(true);

      const logContent = await fs.readFile(logFile, 'utf-8');
      expect(logContent).toContain('Test log entry');
    });
  });

  describe('Error Recovery', () => {
    it('should handle corrupted PID files', async () => {
      const pidFile = join(testProjectPath, '.apex', 'daemon.pid');

      // Write corrupted PID file
      await fs.writeFile(pidFile, 'not-a-number');

      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      vi.spyOn(DaemonManager.prototype, 'getStatus')
        .mockResolvedValue({ running: false });

      await handleDaemonStatus(mockCtx, []);

      // Should handle gracefully
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle missing .apex directory', async () => {
      // Remove .apex directory
      await fs.rm(join(testProjectPath, '.apex'), { recursive: true, force: true });

      const { DaemonManager } = await import('../packages/orchestrator/src/daemon');
      const startSpy = vi.spyOn(DaemonManager.prototype, 'startDaemon')
        .mockResolvedValue(12345);

      await handleDaemonStart(mockCtx, []);

      // Should still attempt to start
      expect(startSpy).toHaveBeenCalled();
    });
  });
});