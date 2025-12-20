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
} from '@apex/orchestrator';

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

// Mock ServiceManager
const mockServiceManager = {
  isSupported: vi.fn(),
  getPlatform: vi.fn(),
  install: vi.fn(),
  uninstall: vi.fn(),
  getStatus: vi.fn(),
};

vi.mock('@apex/orchestrator', () => ({
  ServiceManager: vi.fn(() => mockServiceManager),
  ServiceError: class MockServiceError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'ServiceError';
    }
  },
}));

interface ApexContext {
  cwd: string;
  initialized: boolean;
}

describe('Service Handlers', () => {
  let ctx: ApexContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    global.console.log = mockConsoleLog;
    global.console.error = mockConsoleError;

    ctx = {
      cwd: '/test/project',
      initialized: true,
    };

    // Reset mocks
    mockServiceManager.isSupported.mockReturnValue(true);
    mockServiceManager.getPlatform.mockReturnValue('linux');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleInstallService', () => {
    it('should fail when APEX is not initialized', async () => {
      ctx.initialized = false;

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Run 'apex init' first")
      );
      expect(ServiceManager).not.toHaveBeenCalled();
    });

    it('should install service successfully with default options', async () => {
      const mockInstallResult: InstallResult = {
        success: true,
        servicePath: '/home/user/.config/systemd/user/apex-daemon.service',
        platform: 'linux' as const,
        enabled: false,
        warnings: [],
      };

      mockServiceManager.install.mockResolvedValue(mockInstallResult);

      await handleInstallService(ctx, []);

      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        serviceName: 'apex-daemon',
      });

      expect(mockServiceManager.isSupported).toHaveBeenCalled();
      expect(mockServiceManager.install).toHaveBeenCalledWith({
        enableAfterInstall: false,
        force: false,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Installing APEX daemon')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service installed successfully')
      );
    });

    it('should parse command line options correctly', async () => {
      const mockInstallResult: InstallResult = {
        success: true,
        servicePath: '/home/user/.config/systemd/user/custom-daemon.service',
        platform: 'linux' as const,
        enabled: true,
        warnings: [],
      };

      mockServiceManager.install.mockResolvedValue(mockInstallResult);

      await handleInstallService(ctx, ['--enable', '--force', '--name', 'custom-daemon']);

      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        serviceName: 'custom-daemon',
      });

      expect(mockServiceManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: true,
      });
    });

    it('should handle unsupported platform gracefully', async () => {
      mockServiceManager.isSupported.mockReturnValue(false);
      mockServiceManager.getPlatform.mockReturnValue('unsupported');

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Platform not supported')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Linux (systemd) and macOS (launchd)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Current platform: unsupported')
      );
      expect(mockServiceManager.install).not.toHaveBeenCalled();
    });

    it('should handle ServiceError with specific error codes', async () => {
      const serviceError = new (vi.mocked(ServiceError))('Service already exists', 'SERVICE_EXISTS');
      mockServiceManager.install.mockRejectedValue(serviceError);

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('A service file already exists')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use --force to overwrite')
      );
    });

    it('should handle permission denied errors with platform-specific hints', async () => {
      const serviceError = new (vi.mocked(ServiceError))('Permission denied accessing systemd directory', 'PERMISSION_DENIED');
      mockServiceManager.install.mockRejectedValue(serviceError);

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('systemd/user/')
      );
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Network timeout');
      mockServiceManager.install.mockRejectedValue(genericError);

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to install service: Network timeout')
      );
    });

    it('should display platform-specific command hints', async () => {
      const mockInstallResult: InstallResult = {
        success: true,
        servicePath: '/Users/user/Library/LaunchAgents/com.apex.daemon.plist',
        platform: 'darwin' as const,
        enabled: false,
        warnings: [],
      };

      mockServiceManager.install.mockResolvedValue(mockInstallResult);
      mockServiceManager.getPlatform.mockReturnValue('darwin');

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('launchctl start com.apex.daemon')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('launchctl list | grep apex')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('.apex/daemon.out.log')
      );
    });
  });

  describe('handleUninstallService', () => {
    it('should uninstall service successfully', async () => {
      const mockUninstallResult: UninstallResult = {
        success: true,
        servicePath: '/home/user/.config/systemd/user/apex-daemon.service',
        wasRunning: true,
        warnings: [],
      };

      mockServiceManager.uninstall.mockResolvedValue(mockUninstallResult);

      await handleUninstallService(ctx, []);

      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        serviceName: 'apex-daemon',
      });

      expect(mockServiceManager.uninstall).toHaveBeenCalledWith({
        force: false,
        stopTimeout: 5000,
      });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Uninstalling APEX daemon')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service uninstalled successfully')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Was running: yes')
      );
    });

    it('should parse uninstall options correctly', async () => {
      const mockUninstallResult: UninstallResult = {
        success: true,
        servicePath: '/home/user/.config/systemd/user/custom-daemon.service',
        wasRunning: false,
        warnings: [],
      };

      mockServiceManager.uninstall.mockResolvedValue(mockUninstallResult);

      await handleUninstallService(ctx, ['--force', '--timeout', '10000', '--name', 'custom-daemon']);

      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        serviceName: 'custom-daemon',
      });

      expect(mockServiceManager.uninstall).toHaveBeenCalledWith({
        force: true,
        stopTimeout: 10000,
      });
    });

    it('should display warnings if any', async () => {
      const mockUninstallResult: UninstallResult = {
        success: true,
        servicePath: '/home/user/.config/systemd/user/apex-daemon.service',
        wasRunning: false,
        warnings: ['Service was not enabled', 'Log files remain in .apex/'],
      };

      mockServiceManager.uninstall.mockResolvedValue(mockUninstallResult);

      await handleUninstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Warnings:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service was not enabled')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Log files remain in .apex/')
      );
    });

    it('should handle ServiceError during uninstall', async () => {
      const serviceError = new (vi.mocked(ServiceError))('Service not found', 'SERVICE_NOT_FOUND');
      mockServiceManager.uninstall.mockRejectedValue(serviceError);

      await handleUninstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No service file found')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('may not be installed')
      );
    });

    it('should handle generic errors during uninstall', async () => {
      const genericError = new Error('Disk full');
      mockServiceManager.uninstall.mockRejectedValue(genericError);

      await handleUninstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to uninstall service: Disk full')
      );
    });

    it('should work without APEX initialization (for cleanup)', async () => {
      ctx.initialized = false;

      const mockUninstallResult: UninstallResult = {
        success: true,
        servicePath: '/home/user/.config/systemd/user/apex-daemon.service',
        wasRunning: false,
        warnings: [],
      };

      mockServiceManager.uninstall.mockResolvedValue(mockUninstallResult);

      await handleUninstallService(ctx, []);

      expect(mockServiceManager.uninstall).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service uninstalled successfully')
      );
    });
  });

  describe('handleServiceStatus', () => {
    it('should display service status when installed and running', async () => {
      const mockStatus: ServiceStatus = {
        installed: true,
        enabled: true,
        running: true,
        pid: 12345,
        uptime: 3600,
        platform: 'linux',
        servicePath: '/home/user/.config/systemd/user/apex-daemon.service',
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service Status')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Platform:   Linux (systemd)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Installed:  yes')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Running:    yes')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Enabled:    yes')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('PID:        12345')
      );
    });

    it('should display service status when installed but not running', async () => {
      const mockStatus: ServiceStatus = {
        installed: true,
        enabled: false,
        running: false,
        platform: 'darwin',
        servicePath: '/Users/user/Library/LaunchAgents/com.apex.daemon.plist',
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);
      mockServiceManager.getPlatform.mockReturnValue('darwin');

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Platform:   macOS (launchd)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Running:    no')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('launchctl start com.apex.daemon')
      );
    });

    it('should display status when service is not installed', async () => {
      const mockStatus: ServiceStatus = {
        installed: false,
        enabled: false,
        running: false,
        platform: 'linux',
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Installed:  no')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Use 'apex install-service' to install")
      );
    });

    it('should handle ServiceError during status check', async () => {
      const serviceError = new (vi.mocked(ServiceError))('Platform not supported', 'PLATFORM_UNSUPPORTED');
      mockServiceManager.getStatus.mockRejectedValue(serviceError);

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service installation is only available on Linux')
      );
    });

    it('should handle generic errors during status check', async () => {
      const genericError = new Error('Permission denied');
      mockServiceManager.getStatus.mockRejectedValue(genericError);

      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get service status: Permission denied')
      );
    });
  });

  describe('argument parsing', () => {
    it('should ignore invalid timeout values', async () => {
      const mockUninstallResult: UninstallResult = {
        success: true,
        servicePath: '/test/service',
        wasRunning: false,
        warnings: [],
      };

      mockServiceManager.uninstall.mockResolvedValue(mockUninstallResult);

      await handleUninstallService(ctx, ['--timeout', 'invalid']);

      expect(mockServiceManager.uninstall).toHaveBeenCalledWith({
        force: false,
        stopTimeout: 5000, // default value should be used
      });
    });

    it('should handle negative timeout values', async () => {
      const mockUninstallResult: UninstallResult = {
        success: true,
        servicePath: '/test/service',
        wasRunning: false,
        warnings: [],
      };

      mockServiceManager.uninstall.mockResolvedValue(mockUninstallResult);

      await handleUninstallService(ctx, ['--timeout', '-100']);

      expect(mockServiceManager.uninstall).toHaveBeenCalledWith({
        force: false,
        stopTimeout: 5000, // default value should be used for negative numbers
      });
    });

    it('should handle missing argument after option flags', async () => {
      const mockInstallResult: InstallResult = {
        success: true,
        servicePath: '/test/service',
        platform: 'linux' as const,
        enabled: false,
        warnings: [],
      };

      mockServiceManager.install.mockResolvedValue(mockInstallResult);

      await handleInstallService(ctx, ['--name']);

      expect(ServiceManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        serviceName: 'apex-daemon', // default name should be used
      });
    });
  });

  describe('platform-specific behavior', () => {
    it('should show correct platform names', async () => {
      // Test Linux
      let mockStatus: ServiceStatus = {
        installed: true,
        enabled: true,
        running: true,
        platform: 'linux',
        servicePath: '/test/service',
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);
      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Linux (systemd)')
      );

      vi.clearAllMocks();

      // Test macOS
      mockStatus = {
        ...mockStatus,
        platform: 'darwin',
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);
      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('macOS (launchd)')
      );

      vi.clearAllMocks();

      // Test unsupported
      mockStatus = {
        ...mockStatus,
        platform: 'unsupported' as any,
      };

      mockServiceManager.getStatus.mockResolvedValue(mockStatus);
      await handleServiceStatus(ctx);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported')
      );
    });

    it('should provide platform-specific permission hints', async () => {
      // Test systemd permission error
      let serviceError = new (vi.mocked(ServiceError))('Permission denied accessing systemd user directory', 'PERMISSION_DENIED');
      mockServiceManager.install.mockRejectedValue(serviceError);

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('systemd/user/')
      );

      vi.clearAllMocks();

      // Test launchd permission error
      serviceError = new (vi.mocked(ServiceError))('Permission denied accessing launchd agents directory', 'PERMISSION_DENIED');
      mockServiceManager.install.mockRejectedValue(serviceError);

      await handleInstallService(ctx, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('LaunchAgents/')
      );
    });
  });
});