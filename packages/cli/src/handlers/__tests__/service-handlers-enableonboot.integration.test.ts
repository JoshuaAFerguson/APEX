import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleInstallService } from '../service-handlers';
import { ServiceManager } from '@apexcli/orchestrator';
import { loadConfig, getEffectiveConfig } from '@apexcli/core';

// Windows compatibility: Service management with enableOnBoot functionality
// depends on Unix-specific service managers that don't exist on Windows
const isWindows = process.platform === 'win32';

// Mock dependencies
vi.mock('@apexcli/orchestrator');
vi.mock('@apexcli/core');
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    green: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
    cyan: (str: string) => str,
  },
}));

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

const mockServiceManager = vi.mocked(ServiceManager);
const mockLoadConfig = vi.mocked(loadConfig);
const mockGetEffectiveConfig = vi.mocked(getEffectiveConfig);

// Helper to create mock context
const createMockContext = (initialized = true) => ({
  cwd: '/test/project',
  initialized,
});

// Helper to create mock service manager instance
const createMockManager = () => {
  const mockManager = {
    isSupported: vi.fn().mockReturnValue(true),
    getPlatform: vi.fn().mockReturnValue('linux'),
    install: vi.fn().mockResolvedValue({
      success: true,
      servicePath: '/test/.config/systemd/user/apex-daemon.service',
      platform: 'linux',
      enabled: false,
      warnings: [],
    }),
  };

  mockServiceManager.mockImplementation(() => mockManager as any);
  return mockManager;
};

// Windows compatibility: Skip enable-on-boot integration tests as Windows service
// management is not implemented (requires Unix-specific systemd/launchd APIs)
describe.skipIf(isWindows)('install-service command with --enable flags integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('CLI flag parsing for enableOnBoot', () => {
    it('should parse --enable flag correctly', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({
        daemon: { service: { enableOnBoot: false } }
      } as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: false,
        enableOnBoot: true, // Should be true due to --enable flag
      });
    });

    it('should parse --no-enable flag correctly', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({
        daemon: { service: { enableOnBoot: true } }
      } as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--no-enable']);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: false,
        force: false,
        enableOnBoot: false, // Should be false due to --no-enable flag
      });
    });

    it('should handle both --enable and --force flags', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable', '--force']);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: true,
        enableOnBoot: true,
      });
    });

    it('should handle mixed flag order', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--force', '--enable', '--name', 'custom-service']);

      expect(mockServiceManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        serviceName: 'custom-service',
      });
      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: true,
        enableOnBoot: true,
      });
    });

    it('should prioritize --no-enable over config when both are present', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({
        daemon: { service: { enableOnBoot: true } }
      } as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--no-enable']);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: false,
        force: false,
        enableOnBoot: false, // CLI flag overrides config
      });
    });

    it('should prioritize --enable over config when both are present', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({
        daemon: { service: { enableOnBoot: false } }
      } as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: false,
        enableOnBoot: true, // CLI flag overrides config
      });
    });
  });

  describe('Configuration loading and integration', () => {
    it('should use config enableOnBoot setting when no CLI flags provided', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({
        daemon: { service: { enableOnBoot: true } }
      } as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, []);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: false,
        force: false,
        enableOnBoot: true, // From config
      });
    });

    it('should default to false when config is missing service section', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({
        daemon: {}
      } as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, []);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: false,
        force: false,
        enableOnBoot: false, // Default value
      });
    });

    it('should default to false when config is missing daemon section', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, []);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: false,
        force: false,
        enableOnBoot: false, // Default value
      });
    });

    it('should handle config loading errors gracefully', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockRejectedValue(new Error('Config file not found'));

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Could not load config')
      );
      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: false,
        enableOnBoot: true, // CLI flag still works
      });
    });

    it('should handle malformed config gracefully', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue(null as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, []);

      // Should not throw and use defaults
      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: false,
        force: false,
        enableOnBoot: false,
      });
    });
  });

  describe('Success message output for enableOnBoot', () => {
    it('should display enableOnBoot status in success message', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      mockManager.install.mockResolvedValue({
        success: true,
        servicePath: '/test/service/path',
        platform: 'linux',
        enabled: false,
        warnings: [],
      });

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Auto-start on boot: yes')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service will start automatically when the system boots')
      );
    });

    it('should show correct status when enableOnBoot is false', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      mockManager.install.mockResolvedValue({
        success: true,
        servicePath: '/test/service/path',
        platform: 'linux',
        enabled: false,
        warnings: [],
      });

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--no-enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Auto-start on boot: no')
      );
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('Service will start automatically when the system boots')
      );
    });

    it('should show both enabled and enableOnBoot status', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      mockManager.install.mockResolvedValue({
        success: true,
        servicePath: '/test/service/path',
        platform: 'linux',
        enabled: true,
        warnings: [],
      });

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Enabled: yes')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Auto-start on boot: yes')
      );
    });
  });

  describe('Error handling with enableOnBoot', () => {
    it('should handle ServiceError gracefully', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      const serviceError = new Error('Platform not supported');
      serviceError.name = 'ServiceError';
      (serviceError as any).code = 'PLATFORM_UNSUPPORTED';

      mockManager.install.mockRejectedValue(serviceError);

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Platform not supported')
      );
    });

    it('should handle generic errors', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      mockManager.install.mockRejectedValue(new Error('Unexpected error'));

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to install service: Unexpected error')
      );
    });

    it('should refuse to install when not initialized', async () => {
      const ctx = createMockContext(false);
      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
      expect(mockServiceManager).not.toHaveBeenCalled();
    });

    it('should handle platform not supported', async () => {
      const mockManager = createMockManager();
      mockManager.isSupported.mockReturnValue(false);
      mockManager.getPlatform.mockReturnValue('unsupported');

      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Platform not supported')
      );
      expect(mockManager.install).not.toHaveBeenCalled();
    });
  });

  describe('Complex scenarios', () => {
    it('should handle service already exists with --force and --enable', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      mockManager.install.mockResolvedValue({
        success: true,
        servicePath: '/test/service/path',
        platform: 'linux',
        enabled: true,
        warnings: ['Service file was overwritten'],
      });

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--force', '--enable']);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: true,
        enableOnBoot: true,
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service installed successfully')
      );
    });

    it('should work with custom service name and enableOnBoot', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--name', 'my-custom-service', '--enable']);

      expect(mockServiceManager).toHaveBeenCalledWith({
        projectPath: '/test/project',
        serviceName: 'my-custom-service',
      });
      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: false,
        enableOnBoot: true,
      });
    });

    it('should handle warnings from install with enableOnBoot', async () => {
      const mockManager = createMockManager();
      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      mockManager.install.mockResolvedValue({
        success: true,
        servicePath: '/test/service/path',
        platform: 'linux',
        enabled: false,
        warnings: ['Could not enable service automatically'],
      });

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service installed successfully')
      );
      // Warnings are typically displayed by the ServiceManager
    });
  });

  describe('Platform-specific behavior', () => {
    it('should work on macOS with enableOnBoot', async () => {
      const mockManager = createMockManager();
      mockManager.getPlatform.mockReturnValue('darwin');

      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      mockManager.install.mockResolvedValue({
        success: true,
        servicePath: '/Users/test/Library/LaunchAgents/com.apex.daemon.plist',
        platform: 'darwin',
        enabled: false,
        warnings: [],
      });

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockManager.install).toHaveBeenCalledWith({
        enableAfterInstall: true,
        force: false,
        enableOnBoot: true,
      });
    });

    it('should show platform-specific hints after installation', async () => {
      const mockManager = createMockManager();
      mockManager.getPlatform.mockReturnValue('linux');

      mockLoadConfig.mockResolvedValue({});
      mockGetEffectiveConfig.mockReturnValue({} as any);

      mockManager.install.mockResolvedValue({
        success: true,
        servicePath: '/test/service/path',
        platform: 'linux',
        enabled: false,
        warnings: [],
      });

      const ctx = createMockContext();
      await handleInstallService(ctx, ['--enable']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To start the service: systemctl --user start apex-daemon')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To check status: systemctl --user status apex-daemon')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To view logs: journalctl --user -u apex-daemon -f')
      );
    });
  });
});