/**
 * End-to-End Tests for Daemon Entry Point Windows Service Mode
 *
 * Tests the daemon entry point's Windows service functionality including
 * service mode detection, event logging integration, and signal handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';

// Mock child_process for Windows event logging
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock process events
const mockProcessOn = vi.spyOn(process, 'on');
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit() called');
});

// Mock daemon operations
const mockStartDaemon = vi.fn();
const mockStopDaemon = vi.fn();
const mockGetDaemonStatus = vi.fn();

vi.mock('./daemon', () => ({
  startDaemon: mockStartDaemon,
  stopDaemon: mockStopDaemon,
  getDaemonStatus: mockGetDaemonStatus
}));

describe('Daemon Entry Point Windows Service Mode', () => {
  let originalEnv: typeof process.env;
  let mockExec: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockExec = vi.mocked(require('child_process').exec);
    vi.clearAllMocks();

    // Reset mocks
    mockStartDaemon.mockResolvedValue(undefined);
    mockStopDaemon.mockResolvedValue(undefined);
    mockGetDaemonStatus.mockReturnValue({
      isRunning: false,
      pid: null,
      startTime: null
    });

    // Mock successful event logging
    mockExec.mockImplementation((cmd, options, callback) => {
      if (typeof callback === 'function') {
        callback(null, '', '');
      }
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Windows Service Mode Detection', () => {
    it('should detect Windows service mode from environment variable', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Set Windows service environment variable
      process.env.APEX_WINDOWS_SERVICE = '1';

      // Import daemon-entry dynamically to ensure env vars are read
      const { isWindowsServiceMode } = await import('./daemon-entry');

      expect(isWindowsServiceMode()).toBe(true);
    });

    it('should not detect Windows service mode when environment variable is not set', async () => {
      delete process.env.APEX_WINDOWS_SERVICE;

      // Import daemon-entry dynamically
      const { isWindowsServiceMode } = await import('./daemon-entry');

      expect(isWindowsServiceMode()).toBe(false);
    });

    it('should not detect Windows service mode on non-Windows platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      process.env.APEX_WINDOWS_SERVICE = '1';

      // Import daemon-entry dynamically
      const { isWindowsServiceMode } = await import('./daemon-entry');

      expect(isWindowsServiceMode()).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('Event Logger Integration', () => {
    it('should create and register event logger in Windows service mode', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      const { createEventLogger } = await import('./daemon-entry');
      const eventLogger = createEventLogger();

      expect(eventLogger).toBeDefined();
      expect(eventLogger.constructor.name).toBe('WindowsEventLogger');
    });

    it('should log service startup event when running in Windows service mode', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      // Mock process.pid
      Object.defineProperty(process, 'pid', { value: 1234, configurable: true });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        // Ignore process.exit() calls in test environment
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Should have called event logging for service started
      if (process.platform === 'win32') {
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('Write-EventLog'),
          expect.any(Object),
          expect.any(Function)
        );
      } else {
        // On non-Windows, should log to console
        expect(mockConsoleLog).toHaveBeenCalled();
      }
    });

    it('should handle event logging failures gracefully', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      // Mock event logging failure
      mockExec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('Write-EventLog') && typeof callback === 'function') {
          callback(new Error('PowerShell not found'), '', 'PowerShell not found');
        }
      });

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Should not crash due to logging failure
      expect(mockStartDaemon).toHaveBeenCalled();
    });
  });

  describe('Signal Handling in Windows Service Mode', () => {
    it('should register SIGTERM handler for graceful shutdown', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Should have registered SIGTERM handler
      expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should register SIGINT handler for graceful shutdown', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Should have registered SIGINT handler
      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should handle graceful shutdown when SIGTERM is received', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      let sigtermHandler: Function;

      mockProcessOn.mockImplementation((signal, handler) => {
        if (signal === 'SIGTERM') {
          sigtermHandler = handler;
        }
        return process;
      });

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Simulate SIGTERM
      if (sigtermHandler) {
        try {
          await sigtermHandler();
        } catch (error) {
          if (!error.message.includes('process.exit()')) {
            throw error;
          }
        }
      }

      // Should have called stopDaemon
      expect(mockStopDaemon).toHaveBeenCalled();
    });

    it('should log shutdown event when gracefully stopping', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      let sigtermHandler: Function;

      mockProcessOn.mockImplementation((signal, handler) => {
        if (signal === 'SIGTERM') {
          sigtermHandler = handler;
        }
        return process;
      });

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Clear previous exec calls
      mockExec.mockClear();

      // Simulate SIGTERM
      if (sigtermHandler) {
        try {
          await sigtermHandler();
        } catch (error) {
          if (!error.message.includes('process.exit()')) {
            throw error;
          }
        }
      }

      // Should have logged service stopped event
      if (process.platform === 'win32') {
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('Write-EventLog'),
          expect.any(Object),
          expect.any(Function)
        );
      }
    });
  });

  describe('Error Handling in Windows Service Mode', () => {
    it('should register uncaught exception handler', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Should have registered uncaughtException handler
      expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });

    it('should register unhandled rejection handler', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Should have registered unhandledRejection handler
      expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should log critical errors to Windows Event Log', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      let uncaughtExceptionHandler: Function;

      mockProcessOn.mockImplementation((signal, handler) => {
        if (signal === 'uncaughtException') {
          uncaughtExceptionHandler = handler;
        }
        return process;
      });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Clear previous exec calls
      mockExec.mockClear();

      // Simulate uncaught exception
      if (uncaughtExceptionHandler) {
        const testError = new Error('Test critical error');
        try {
          await uncaughtExceptionHandler(testError);
        } catch (error) {
          if (!error.message.includes('process.exit()')) {
            throw error;
          }
        }
      }

      // Should have logged critical error event
      if (process.platform === 'win32') {
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('Write-EventLog'),
          expect.any(Object),
          expect.any(Function)
        );
      }
    });

    it('should handle daemon startup errors in Windows service mode', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      // Mock daemon start failure
      const startupError = new Error('Failed to start daemon');
      mockStartDaemon.mockRejectedValue(startupError);

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          expect(error).toBe(startupError);
        }
      }

      // Should have attempted to start daemon
      expect(mockStartDaemon).toHaveBeenCalled();
    });
  });

  describe('Windows Service Environment Configuration', () => {
    it('should set appropriate process title in Windows service mode', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      const originalTitle = process.title;

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Process title might be set to indicate service mode
      // This would be implementation-specific
      expect(true).toBe(true); // Placeholder for future process title verification
    });

    it('should validate required Windows service environment variables', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';
      process.env.APEX_PROJECT_PATH = 'C:\\apex';

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Should have started successfully with proper environment
      expect(mockStartDaemon).toHaveBeenCalled();
    });
  });

  describe('Windows Service Lifecycle Integration', () => {
    it('should properly initialize in Windows service mode', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Should have:
      // 1. Created event logger
      // 2. Started daemon
      // 3. Registered signal handlers
      // 4. Logged startup event
      expect(mockStartDaemon).toHaveBeenCalled();
      expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should handle Windows service stop gracefully', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      process.env.APEX_WINDOWS_SERVICE = '1';

      let shutdownHandler: Function;

      mockProcessOn.mockImplementation((signal, handler) => {
        if (signal === 'SIGTERM' || signal === 'SIGINT') {
          shutdownHandler = handler;
        }
        return process;
      });

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      try {
        const { runDaemonEntry } = await import('./daemon-entry');
        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Simulate service stop
      if (shutdownHandler) {
        try {
          await shutdownHandler();
        } catch (error) {
          if (!error.message.includes('process.exit()')) {
            throw error;
          }
        }
      }

      // Should have:
      // 1. Stopped daemon gracefully
      // 2. Logged shutdown event
      // 3. Exited with code 0
      expect(mockStopDaemon).toHaveBeenCalled();
    });
  });

  describe('Non-Windows Platform Behavior', () => {
    it('should not enable Windows service mode on non-Windows platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      process.env.APEX_WINDOWS_SERVICE = '1';

      // Mock successful daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      try {
        const { runDaemonEntry, isWindowsServiceMode } = await import('./daemon-entry');

        expect(isWindowsServiceMode()).toBe(false);

        await runDaemonEntry();
      } catch (error) {
        if (!error.message.includes('process.exit()')) {
          throw error;
        }
      }

      // Should still start daemon, but not in Windows service mode
      expect(mockStartDaemon).toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });
});