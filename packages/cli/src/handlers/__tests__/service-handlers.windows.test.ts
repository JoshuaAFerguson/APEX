import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import chalk from 'chalk';
import {
  handleInstallService,
  handleUninstallService,
  handleServiceStatus,
} from '../service-handlers';
import {
  ServiceManager,
  ServiceError,
  type InstallResult,
  type UninstallResult,
  type ServiceStatus,
} from '@apexcli/orchestrator';

/**
 * Windows-specific tests for service handlers error handling
 *
 * This test suite specifically validates that service handlers:
 * 1. Return proper error messages when running on Windows
 * 2. Platform detection correctly identifies Windows
 * 3. No crashes occur when service functions are called on Windows
 *
 * These tests ensure Windows compatibility and graceful degradation
 * when service management functionality is not available.
 */

// Mock chalk to avoid ANSI codes in test output
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((str) => str),
    green: vi.fn((str) => str),
    blue: vi.fn((str) => str),
    yellow: vi.fn((str) => str),
    gray: vi.fn((str) => str),
    cyan: vi.fn((str) => str),
  },
}));

// Mock console methods to capture output
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();

// Mock ServiceManager for Windows-specific scenarios
const mockServiceManager = {
  isSupported: vi.fn(),
  getPlatform: vi.fn(),
  install: vi.fn(),
  uninstall: vi.fn(),
  getStatus: vi.fn(),
  isNSSMSupported: vi.fn(),
};

vi.mock('@apexcli/orchestrator', () => ({
  ServiceManager: vi.fn(() => mockServiceManager),
  ServiceError: class MockServiceError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'ServiceError';
    }
  },
}));

// Mock process.platform to simulate Windows environment
const originalPlatform = process.platform;

interface ApexContext {
  cwd: string;
  initialized: boolean;
}

describe('Windows-specific Service Handlers Error Handling', () => {
  let ctx: ApexContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    global.console.log = mockConsoleLog;
    global.console.error = mockConsoleError;

    // Set up test context
    ctx = {
      cwd: 'C:\\test\\project',
      initialized: true,
    };

    // Mock platform detection to return Windows
    mockServiceManager.getPlatform.mockReturnValue('win32');

    // By default, mock Windows as unsupported to test error handling
    mockServiceManager.isSupported.mockReturnValue(false);
    mockServiceManager.isNSSMSupported.mockReturnValue(false);

    // Mock process.platform to be Windows
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();

    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('Platform Detection on Windows', () => {
    it('should correctly identify Windows platform', async () => {
      await handleServiceStatus(ctx);

      expect(mockServiceManager.getPlatform).toHaveBeenCalled();
      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: 'C:\\test\\project',
        serviceName: 'apex-daemon',
      });
    });

    it('should handle Windows paths correctly in service manager initialization', async () => {
      // Test with Windows-style path
      const windowsCtx = {
        cwd: 'C:\\Users\\TestUser\\Documents\\MyProject',
        initialized: true,
      };

      await handleServiceStatus(windowsCtx);

      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: 'C:\\Users\\TestUser\\Documents\\MyProject',
        serviceName: 'apex-daemon',
      });
    });
  });

  describe('handleInstallService on Windows', () => {
    it('should return proper error message when Windows service management is unsupported', async () => {
      // Mock unsupported Windows environment
      mockServiceManager.isSupported.mockReturnValue(false);
      mockServiceManager.getPlatform.mockReturnValue('win32');

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Platform not supported')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Linux (systemd) and macOS (launchd)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Current platform: win32')
      );
      expect(mockServiceManager.install).not.toHaveBeenCalled();
    });

    it('should not crash when Windows service installation fails', async () => {
      // Mock supported Windows environment but installation fails
      mockServiceManager.isSupported.mockReturnValue(true);
      const windowsServiceError = new (vi.mocked(ServiceError))(
        'Windows service creation failed: Access denied to Service Control Manager',
        'PERMISSION_DENIED'
      );
      mockServiceManager.install.mockRejectedValue(windowsServiceError);

      // Should not throw - should handle error gracefully
      await expect(handleInstallService(ctx, [])).resolves.not.toThrow();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      );
    });

    it('should handle Windows-specific ServiceError codes properly', async () => {
      mockServiceManager.isSupported.mockReturnValue(true);

      // Test PLATFORM_UNSUPPORTED error on Windows
      const platformError = new (vi.mocked(ServiceError))(
        'Windows service manager not available',
        'PLATFORM_UNSUPPORTED'
      );
      mockServiceManager.install.mockRejectedValue(platformError);

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service installation is only available on Linux')
      );
    });

    it('should handle Windows permission errors with Windows-specific hints', async () => {
      mockServiceManager.isSupported.mockReturnValue(true);

      // Test permission error that doesn't contain systemd or launchd
      const windowsPermissionError = new (vi.mocked(ServiceError))(
        'Access denied to Windows Service Control Manager',
        'PERMISSION_DENIED'
      );
      mockServiceManager.install.mockRejectedValue(windowsPermissionError);

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      );
      // Should not show systemd or launchd specific hints
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('systemd/user/')
      );
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('LaunchAgents/')
      );
    });

    it('should handle generic errors on Windows without crashing', async () => {
      mockServiceManager.isSupported.mockReturnValue(true);
      const genericError = new Error('Windows system error: The system cannot find the path specified');
      mockServiceManager.install.mockRejectedValue(genericError);

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to install service: Windows system error: The system cannot find the path specified')
      );
    });

    it('should handle successful Windows installation with NSSM support', async () => {
      mockServiceManager.isSupported.mockReturnValue(true);
      mockServiceManager.isNSSMSupported.mockReturnValue(true);

      const mockWindowsResult: InstallResult = {
        success: true,
        servicePath: 'C:\\test\\project\\.apex\\service-install.ps1',
        platform: 'win32' as const,
        enabled: true,
        warnings: [],
      };

      mockServiceManager.install.mockResolvedValue(mockWindowsResult);

      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service installed successfully')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Platform: Unsupported') // Because getPlatformName returns 'Unsupported' for win32 in current implementation
      );
    });
  });

  describe('handleUninstallService on Windows', () => {
    it('should handle Windows uninstallation without crashing', async () => {
      const mockUninstallResult: UninstallResult = {
        success: true,
        servicePath: 'C:\\test\\project\\.apex\\service-install.ps1',
        wasRunning: false,
        warnings: ['Windows service cleanup may require manual registry cleanup'],
      };

      mockServiceManager.uninstall.mockResolvedValue(mockUninstallResult);

      await handleUninstallService(ctx, []);

      expect(mockServiceManager.uninstall).toHaveBeenCalledWith({
        force: false,
        stopTimeout: 5000,
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service uninstalled successfully')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Windows service cleanup may require manual registry cleanup')
      );
    });

    it('should handle Windows SERVICE_NOT_FOUND errors properly', async () => {
      const windowsServiceError = new (vi.mocked(ServiceError))(
        'Windows service not found in Service Control Manager',
        'SERVICE_NOT_FOUND'
      );
      mockServiceManager.uninstall.mockRejectedValue(windowsServiceError);

      await handleUninstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No service file found')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('may not be installed')
      );
    });

    it('should handle Windows-specific uninstall errors', async () => {
      const windowsError = new Error('Windows error: The service has not been started');
      mockServiceManager.uninstall.mockRejectedValue(windowsError);

      await handleUninstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to uninstall service: Windows error: The service has not been started')
      );
    });
  });

  describe('handleServiceStatus on Windows', () => {
    it('should display Windows platform information correctly', async () => {
      const mockWindowsStatus: ServiceStatus = {
        installed: false,
        enabled: false,
        running: false,
        platform: 'win32',
      };

      mockServiceManager.getStatus.mockResolvedValue(mockWindowsStatus);
      mockServiceManager.getPlatform.mockReturnValue('win32');

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service Status')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Platform:   Unsupported') // Current implementation returns 'Unsupported' for Windows
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Installed:  no')
      );
    });

    it('should handle Windows service status errors without crashing', async () => {
      const windowsStatusError = new (vi.mocked(ServiceError))(
        'Windows service query failed',
        'PLATFORM_UNSUPPORTED'
      );
      mockServiceManager.getStatus.mockRejectedValue(windowsStatusError);

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service installation is only available on Linux')
      );
    });

    it('should handle generic Windows status errors', async () => {
      const windowsError = new Error('Windows access denied: Insufficient privileges');
      mockServiceManager.getStatus.mockRejectedValue(windowsError);

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get service status: Windows access denied: Insufficient privileges')
      );
    });

    it('should show Windows service is installed but not running', async () => {
      const mockWindowsStatus: ServiceStatus = {
        installed: true,
        enabled: false,
        running: false,
        platform: 'win32',
        servicePath: 'C:\\test\\project\\.apex\\service-install.ps1',
      };

      mockServiceManager.getStatus.mockResolvedValue(mockWindowsStatus);
      mockServiceManager.getPlatform.mockReturnValue('win32');

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Installed:  yes')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Running:    no')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service start commands not available') // Windows shows this message
      );
    });
  });

  describe('Windows Path Handling', () => {
    it('should handle Windows UNC paths correctly', async () => {
      const uncCtx = {
        cwd: '\\\\server\\share\\project',
        initialized: true,
      };

      await handleServiceStatus(uncCtx);

      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: '\\\\server\\share\\project',
        serviceName: 'apex-daemon',
      });
    });

    it('should handle Windows paths with spaces', async () => {
      const spacesCtx = {
        cwd: 'C:\\Program Files\\My Company\\APEX Project',
        initialized: true,
      };

      await handleServiceStatus(spacesCtx);

      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: 'C:\\Program Files\\My Company\\APEX Project',
        serviceName: 'apex-daemon',
      });
    });
  });

  describe('Command Line Argument Parsing on Windows', () => {
    it('should parse Windows-style arguments correctly', async () => {
      mockServiceManager.isSupported.mockReturnValue(true);
      const mockInstallResult: InstallResult = {
        success: true,
        servicePath: 'C:\\test\\service-install.ps1',
        platform: 'win32' as const,
        enabled: false,
        warnings: [],
      };

      mockServiceManager.install.mockResolvedValue(mockInstallResult);

      await handleInstallService(ctx, ['--enable', '--force', '--name', 'windows-daemon']);

      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: 'C:\\test\\project',
        serviceName: 'windows-daemon',
      });

      expect(mockServiceManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: true,
        enableOnBoot: false, // Default value
      });
    });
  });

  describe('Error Resilience on Windows', () => {
    it('should not crash when ServiceManager constructor throws on Windows', async () => {
      // Mock ServiceManager constructor to throw
      vi.mocked(ServiceManager).mockImplementationOnce(() => {
        throw new Error('Windows service manager initialization failed');
      });

      // Should handle the error gracefully without crashing the process
      await expect(handleServiceStatus(ctx)).resolves.not.toThrow();
    });

    it('should handle Windows registry access errors gracefully', async () => {
      mockServiceManager.isSupported.mockReturnValue(true);
      const registryError = new Error('Registry access denied: HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services');
      mockServiceManager.getStatus.mockRejectedValue(registryError);

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Registry access denied')
      );
    });
  });
});