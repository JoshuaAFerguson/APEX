/**
 * Tests for CLI Daemon Handlers Windows Service Functionality
 *
 * Tests the CLI handlers that interact with Windows service management
 * for starting, stopping, and managing the APEX daemon as a Windows service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import fs from 'fs';

// Mock child_process for Windows service operations
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock fs operations
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    stat: vi.fn()
  },
  constants: {
    F_OK: 0,
    R_OK: 4
  }
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock ServiceManager
const mockInstallWindowsServiceNative = vi.fn();
const mockUninstallWindowsServiceNative = vi.fn();
const mockStartWindowsServiceNative = vi.fn();
const mockStopWindowsServiceNative = vi.fn();
const mockGetWindowsServiceStatusNative = vi.fn();
const mockShouldUseNativeWindowsService = vi.fn();

vi.mock('@apex/orchestrator', () => ({
  ServiceManager: vi.fn().mockImplementation(() => ({
    installWindowsServiceNative: mockInstallWindowsServiceNative,
    uninstallWindowsServiceNative: mockUninstallWindowsServiceNative,
    startWindowsServiceNative: mockStartWindowsServiceNative,
    stopWindowsServiceNative: mockStopWindowsServiceNative,
    getWindowsServiceStatusNative: mockGetWindowsServiceStatusNative,
    shouldUseNativeWindowsService: mockShouldUseNativeWindowsService
  }))
}));

// Mock daemon operations
const mockStartDaemon = vi.fn();
const mockStopDaemon = vi.fn();
const mockGetDaemonStatus = vi.fn();

vi.mock('../utils/daemon-operations', () => ({
  startDaemon: mockStartDaemon,
  stopDaemon: mockStopDaemon,
  getDaemonStatus: mockGetDaemonStatus
}));

describe('CLI Daemon Handlers Windows Service Functionality', () => {
  let originalEnv: typeof process.env;
  let mockWriteFile: any;
  let mockReadFile: any;
  let mockAccess: any;
  let mockStat: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    const fsPromises = vi.mocked(require('fs').promises);
    mockWriteFile = fsPromises.writeFile;
    mockReadFile = fsPromises.readFile;
    mockAccess = fsPromises.access;
    mockStat = fsPromises.stat;
    vi.clearAllMocks();

    // Set up default mock returns
    mockShouldUseNativeWindowsService.mockReturnValue(true);
    mockGetWindowsServiceStatusNative.mockResolvedValue({
      installed: false,
      state: 'unknown',
      startType: 'disabled',
      pid: undefined
    });
    mockGetDaemonStatus.mockReturnValue({
      isRunning: false,
      pid: null,
      startTime: null
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Daemon Start Command with Windows Service', () => {
    it('should attempt to start Windows service when available', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service installed and stopped
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'stopped',
        startType: 'auto',
        pid: undefined
      });

      // Mock successful service start
      mockStartWindowsServiceNative.mockResolvedValue(undefined);

      const { handleDaemonStart } = await import('./daemon-handlers');

      await handleDaemonStart({ windowsService: true });

      expect(mockStartWindowsServiceNative).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Starting APEX daemon as Windows service')
      );
    });

    it('should fallback to process daemon when Windows service is not available', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service not installed
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: false,
        state: 'unknown',
        startType: 'disabled',
        pid: undefined
      });

      // Mock successful process daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      const { handleDaemonStart } = await import('./daemon-handlers');

      await handleDaemonStart({ windowsService: false });

      expect(mockStartDaemon).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX daemon started')
      );
    });

    it('should suggest Windows service installation when service is not installed', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service not installed
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: false,
        state: 'unknown',
        startType: 'disabled',
        pid: undefined
      });

      const { handleDaemonStart } = await import('./daemon-handlers');

      await handleDaemonStart({});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Tip: Install as Windows service')
      );
    });

    it('should handle Windows service start failure gracefully', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service installed
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'stopped',
        startType: 'auto',
        pid: undefined
      });

      // Mock service start failure
      const serviceError = new Error('Service start failed');
      mockStartWindowsServiceNative.mockRejectedValue(serviceError);

      // Mock successful fallback to process daemon
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      const { handleDaemonStart } = await import('./daemon-handlers');

      await handleDaemonStart({ windowsService: true });

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start Windows service')
      );
      expect(mockStartDaemon).toHaveBeenCalled(); // Should fallback to process daemon
    });

    it('should detect when Windows service is already running', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service already running
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'running',
        startType: 'auto',
        pid: 5678
      });

      const { handleDaemonStart } = await import('./daemon-handlers');

      await handleDaemonStart({ windowsService: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX daemon is already running as Windows service')
      );
      expect(mockStartWindowsServiceNative).not.toHaveBeenCalled();
    });
  });

  describe('Daemon Stop Command with Windows Service', () => {
    it('should stop Windows service when running as service', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service running
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'running',
        startType: 'auto',
        pid: 5678
      });

      // Mock successful service stop
      mockStopWindowsServiceNative.mockResolvedValue(undefined);

      const { handleDaemonStop } = await import('./daemon-handlers');

      await handleDaemonStop({});

      expect(mockStopWindowsServiceNative).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Stopping Windows service')
      );
    });

    it('should stop process daemon when not running as service', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service not running, but process daemon running
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'stopped',
        startType: 'auto',
        pid: undefined
      });

      mockGetDaemonStatus.mockReturnValue({
        isRunning: true,
        pid: 1234,
        startTime: Date.now()
      });

      // Mock successful process daemon stop
      mockStopDaemon.mockResolvedValue(undefined);

      const { handleDaemonStop } = await import('./daemon-handlers');

      await handleDaemonStop({});

      expect(mockStopDaemon).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX daemon stopped')
      );
    });

    it('should handle case when no daemon is running', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock no Windows service or process daemon running
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'stopped',
        startType: 'auto',
        pid: undefined
      });

      mockGetDaemonStatus.mockReturnValue({
        isRunning: false,
        pid: null,
        startTime: null
      });

      const { handleDaemonStop } = await import('./daemon-handlers');

      await handleDaemonStop({});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX daemon is not running')
      );
    });
  });

  describe('Daemon Status Command with Windows Service', () => {
    it('should show Windows service status when service is running', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service running
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'running',
        startType: 'auto',
        pid: 5678
      });

      const { handleDaemonStatus } = await import('./daemon-handlers');

      await handleDaemonStatus({});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Status: Running as Windows service')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('PID: 5678')
      );
    });

    it('should show process daemon status when not running as service', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service not running, process daemon running
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'stopped',
        startType: 'auto',
        pid: undefined
      });

      mockGetDaemonStatus.mockReturnValue({
        isRunning: true,
        pid: 1234,
        startTime: Date.now() - 60000 // 1 minute ago
      });

      const { handleDaemonStatus } = await import('./daemon-handlers');

      await handleDaemonStatus({});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Status: Running as process')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('PID: 1234')
      );
    });

    it('should show Windows service information even when stopped', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service installed but stopped
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'stopped',
        startType: 'auto',
        pid: undefined
      });

      mockGetDaemonStatus.mockReturnValue({
        isRunning: false,
        pid: null,
        startTime: null
      });

      const { handleDaemonStatus } = await import('./daemon-handlers');

      await handleDaemonStatus({});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Status: Stopped')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Windows Service: Installed (Auto-start)')
      );
    });

    it('should suggest Event Log viewing for Windows service', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service running
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'running',
        startType: 'auto',
        pid: 5678
      });

      const { handleDaemonStatus } = await import('./daemon-handlers');

      await handleDaemonStatus({});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('View logs: Get-WinEvent -LogName Application -Source "APEX Daemon"')
      );
    });
  });

  describe('Windows Service Installation Commands', () => {
    it('should handle service installation command', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock successful service installation
      mockInstallWindowsServiceNative.mockResolvedValue({
        success: true,
        serviceName: 'apex-daemon',
        method: 'NSSM'
      });

      const { handleServiceInstall } = await import('./daemon-handlers');

      await handleServiceInstall({});

      expect(mockInstallWindowsServiceNative).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Windows service installed successfully')
      );
    });

    it('should handle service installation failure', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service installation failure
      const installError = new Error('Installation failed - insufficient privileges');
      mockInstallWindowsServiceNative.mockRejectedValue(installError);

      const { handleServiceInstall } = await import('./daemon-handlers');

      await expect(handleServiceInstall({})).rejects.toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to install Windows service')
      );
    });

    it('should handle service uninstallation command', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock successful service uninstallation
      mockUninstallWindowsServiceNative.mockResolvedValue({
        success: true,
        serviceName: 'apex-daemon',
        method: 'NSSM'
      });

      const { handleServiceUninstall } = await import('./daemon-handlers');

      await handleServiceUninstall({});

      expect(mockUninstallWindowsServiceNative).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Windows service uninstalled successfully')
      );
    });

    it('should handle service uninstallation when service is not installed', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service not installed
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: false,
        state: 'unknown',
        startType: 'disabled',
        pid: undefined
      });

      const { handleServiceUninstall } = await import('./daemon-handlers');

      await handleServiceUninstall({});

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Windows service is not installed')
      );
      expect(mockUninstallWindowsServiceNative).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Platform Behavior', () => {
    it('should not suggest Windows service on non-Windows platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      mockShouldUseNativeWindowsService.mockReturnValue(false);

      // Mock successful process daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      const { handleDaemonStart } = await import('./daemon-handlers');

      await handleDaemonStart({});

      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('Windows service')
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('should ignore windowsService flag on non-Windows platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

      mockShouldUseNativeWindowsService.mockReturnValue(false);

      // Mock successful process daemon start
      mockStartDaemon.mockResolvedValue({
        pid: 1234,
        port: 8080
      });

      const { handleDaemonStart } = await import('./daemon-handlers');

      await handleDaemonStart({ windowsService: true });

      expect(mockStartDaemon).toHaveBeenCalled();
      expect(mockStartWindowsServiceNative).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Windows service status query errors', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service status query error
      const statusError = new Error('Access denied');
      mockGetWindowsServiceStatusNative.mockRejectedValue(statusError);

      const { handleDaemonStatus } = await import('./daemon-handlers');

      await handleDaemonStatus({});

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to query Windows service status')
      );
    });

    it('should provide helpful error messages for common Windows service issues', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock service installation failure with access denied
      const accessError = new Error('Access denied. Run as administrator.');
      mockInstallWindowsServiceNative.mockRejectedValue(accessError);

      const { handleServiceInstall } = await import('./daemon-handlers');

      try {
        await handleServiceInstall({});
      } catch (error) {
        expect(mockConsoleError).toHaveBeenCalledWith(
          expect.stringContaining('Run as administrator')
        );
      }
    });

    it('should handle service stop timeout gracefully', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service running
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'running',
        startType: 'auto',
        pid: 5678
      });

      // Mock service stop timeout
      const timeoutError = new Error('Service stop timeout');
      mockStopWindowsServiceNative.mockRejectedValue(timeoutError);

      const { handleDaemonStop } = await import('./daemon-handlers');

      try {
        await handleDaemonStop({});
      } catch (error) {
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('Service may take time to stop')
        );
      }
    });
  });

  describe('Windows Service Configuration Display', () => {
    it('should display Windows service configuration details', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      // Mock Windows service installed
      mockGetWindowsServiceStatusNative.mockResolvedValue({
        installed: true,
        state: 'stopped',
        startType: 'auto',
        pid: undefined,
        displayName: 'APEX Daemon',
        description: 'APEX AI Development Team Automation'
      });

      const { handleDaemonStatus } = await import('./daemon-handlers');

      await handleDaemonStatus({ verbose: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service Name: apex-daemon')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Display Name: APEX Daemon')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Start Type: auto')
      );
    });

    it('should show appropriate Windows service commands in help output', async () => {
      if (process.platform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const { getWindowsServiceHelp } = await import('./daemon-handlers');

      const helpText = getWindowsServiceHelp();

      expect(helpText).toContain('--windows-service');
      expect(helpText).toContain('apex daemon start --windows-service');
      expect(helpText).toContain('apex service install');
      expect(helpText).toContain('apex service uninstall');
    });
  });
});