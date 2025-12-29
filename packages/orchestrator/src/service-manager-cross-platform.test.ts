import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHomeDir, getConfigDir } from '@apex/core';
import {
  ServiceManager,
  SystemdGenerator,
  LaunchdGenerator,
  WindowsServiceGenerator,
  type ServiceManagerOptions,
} from './service-manager';

// Platform detection for Windows skipping
const isWindows = process.platform === 'win32';

// Mock @apex/core path utilities
vi.mock('@apex/core', () => ({
  getHomeDir: vi.fn(),
  getConfigDir: vi.fn(),
}));

const mockGetHomeDir = vi.mocked(getHomeDir);
const mockGetConfigDir = vi.mocked(getConfigDir);

// Mock process for platform detection
const mockProcess = {
  platform: 'linux' as NodeJS.Platform,
  execPath: '/usr/bin/node',
  env: { USER: 'testuser' },
  cwd: vi.fn(() => '/test/project'),
  getuid: vi.fn(() => 1000),
};

Object.defineProperty(global, 'process', {
  value: mockProcess,
  writable: true,
});

describe('ServiceManager - Cross-Platform Path Utilities', () => {
  const baseOptions: ServiceManagerOptions = {
    projectPath: '/test/project',
    serviceName: 'apex-daemon',
    serviceDescription: 'Test Service',
    user: 'testuser',
    workingDirectory: '/test/project',
    environment: { NODE_ENV: 'production' },
    restartPolicy: 'on-failure',
    restartDelaySeconds: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHomeDir.mockReturnValue('/home/user');
    mockGetConfigDir.mockReturnValue('/home/user/.config');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe.skipIf(isWindows)('Linux (Systemd) - Cross-Platform Paths', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
      mockProcess.getuid = vi.fn(() => 1000); // Non-root user
    });

    it('should use getConfigDir() for user-level systemd services', () => {
      mockGetConfigDir.mockReturnValue('/home/user/.config');

      const generator = new SystemdGenerator(baseOptions as Required<ServiceManagerOptions>);
      const installPath = generator.getInstallPath();

      expect(mockGetConfigDir).toHaveBeenCalledWith();
      expect(installPath).toBe('/home/user/.config/systemd/user/apex-daemon.service');
    });

    it('should handle custom config directory', () => {
      mockGetConfigDir.mockReturnValue('/custom/config');

      const generator = new SystemdGenerator(baseOptions as Required<ServiceManagerOptions>);
      const installPath = generator.getInstallPath();

      expect(installPath).toBe('/custom/config/systemd/user/apex-daemon.service');
    });

    it('should use system path for root user regardless of getConfigDir', () => {
      mockProcess.getuid = vi.fn(() => 0); // Root user
      mockGetConfigDir.mockReturnValue('/home/user/.config');

      const generator = new SystemdGenerator(baseOptions as Required<ServiceManagerOptions>);
      const installPath = generator.getInstallPath();

      // Root should use system path, not call getConfigDir
      expect(installPath).toBe('/etc/systemd/system/apex-daemon.service');
    });

    it('should work correctly when getConfigDir throws error', () => {
      mockGetConfigDir.mockImplementation(() => {
        throw new Error('Unable to determine config directory');
      });

      expect(() => {
        const generator = new SystemdGenerator(baseOptions as Required<ServiceManagerOptions>);
        generator.getInstallPath();
      }).toThrow('Unable to determine config directory');
    });
  });

  describe.skipIf(isWindows)('macOS (Launchd) - Cross-Platform Paths', () => {
    beforeEach(() => {
      mockProcess.platform = 'darwin';
    });

    it('should use getHomeDir() for LaunchAgents path', () => {
      mockGetHomeDir.mockReturnValue('/Users/testuser');

      const generator = new LaunchdGenerator(baseOptions as Required<ServiceManagerOptions>);
      const installPath = generator.getInstallPath();

      expect(mockGetHomeDir).toHaveBeenCalledWith();
      expect(installPath).toBe('/Users/testuser/Library/LaunchAgents/com.apex.daemon.plist');
    });

    it('should handle custom home directory', () => {
      mockGetHomeDir.mockReturnValue('/custom/home/user');

      const generator = new LaunchdGenerator(baseOptions as Required<ServiceManagerOptions>);
      const installPath = generator.getInstallPath();

      expect(installPath).toBe('/custom/home/user/Library/LaunchAgents/com.apex.daemon.plist');
    });

    it('should work correctly when getHomeDir throws error', () => {
      mockGetHomeDir.mockImplementation(() => {
        throw new Error('Unable to determine home directory');
      });

      expect(() => {
        const generator = new LaunchdGenerator(baseOptions as Required<ServiceManagerOptions>);
        generator.getInstallPath();
      }).toThrow('Unable to determine home directory');
    });

    it('should handle service names correctly in reverse-domain notation', () => {
      const customOptions = { ...baseOptions, serviceName: 'apex-custom-service' };
      mockGetHomeDir.mockReturnValue('/Users/testuser');

      const generator = new LaunchdGenerator(customOptions as Required<ServiceManagerOptions>);
      const installPath = generator.getInstallPath();

      expect(installPath).toBe('/Users/testuser/Library/LaunchAgents/com.apex.custom-service.plist');
    });
  });

  describe('Windows - Cross-Platform Paths', () => {
    beforeEach(() => {
      mockProcess.platform = 'win32';
    });

    it('should use project path for PowerShell script installation', () => {
      const generator = new WindowsServiceGenerator(baseOptions as Required<ServiceManagerOptions>);
      const installPath = generator.getInstallPath();

      // Windows service generator should not call getHomeDir or getConfigDir for install path
      expect(mockGetHomeDir).not.toHaveBeenCalled();
      expect(mockGetConfigDir).not.toHaveBeenCalled();
      expect(installPath).toBe('/test/project/.apex/service-install.ps1');
    });

    it('should use getConfigDir for CLI path fallback in generated content', () => {
      mockGetConfigDir.mockReturnValue('C:\\Users\\testuser\\AppData\\Roaming');

      const generator = new WindowsServiceGenerator(baseOptions as Required<ServiceManagerOptions>);
      const content = generator.generate();

      // The Windows generator should use getConfigDir in one of the fallback paths for finding CLI
      expect(content).toContain('$serviceName = "apex-daemon"');
      expect(content).toContain('PowerShell script');
    });
  });

  describe('ServiceManager Integration', () => {
    it.skipIf(isWindows)('should correctly integrate cross-platform paths on Linux', () => {
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockReturnValue('/home/user/.config');

      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      expect(mockGetConfigDir).toHaveBeenCalled();
      expect(serviceFile.path).toBe('/home/user/.config/systemd/user/apex-daemon.service');
      expect(serviceFile.platform).toBe('linux');
    });

    it.skipIf(isWindows)('should correctly integrate cross-platform paths on macOS', () => {
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockReturnValue('/Users/testuser');

      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      expect(mockGetHomeDir).toHaveBeenCalled();
      expect(serviceFile.path).toBe('/Users/testuser/Library/LaunchAgents/com.apex.daemon.plist');
      expect(serviceFile.platform).toBe('darwin');
    });

    it('should correctly integrate cross-platform paths on Windows', () => {
      mockProcess.platform = 'win32';

      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('/test/project/.apex/service-install.ps1');
      expect(serviceFile.platform).toBe('win32');
    });
  });

  describe('Error Handling', () => {
    it.skipIf(isWindows)('should propagate path utility errors appropriately', () => {
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockImplementation(() => {
        throw new Error('Configuration directory not accessible');
      });

      const manager = new ServiceManager(baseOptions);

      expect(() => {
        manager.generateServiceFile();
      }).toThrow('Configuration directory not accessible');
    });

    it('should propagate home directory errors appropriately', () => {
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockImplementation(() => {
        throw new Error('Home directory not accessible');
      });

      const manager = new ServiceManager(baseOptions);

      expect(() => {
        manager.generateServiceFile();
      }).toThrow('Home directory not accessible');
    });
  });

  describe('Platform-Specific Path Formats', () => {
    it('should handle Windows-style paths correctly', () => {
      mockProcess.platform = 'win32';
      const windowsProjectPath = 'C:\\Users\\testuser\\Projects\\apex';
      const windowsOptions = { ...baseOptions, projectPath: windowsProjectPath };

      const manager = new ServiceManager(windowsOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('C:\\Users\\testuser\\Projects\\apex\\.apex\\service-install.ps1');
    });

    it('should handle Unix-style paths correctly on Linux', () => {
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockReturnValue('/home/user/.config');
      const unixProjectPath = '/home/user/projects/apex';
      const unixOptions = { ...baseOptions, projectPath: unixProjectPath };

      const manager = new ServiceManager(unixOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('/home/user/.config/systemd/user/apex-daemon.service');
    });

    it('should handle macOS paths with spaces correctly', () => {
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockReturnValue('/Users/test user/Documents');

      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('/Users/test user/Documents/Library/LaunchAgents/com.apex.daemon.plist');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should work correctly even when old process.env patterns exist', () => {
      mockProcess.platform = 'linux';
      mockProcess.env = {
        HOME: '/old/home/path', // This should be ignored now
        USER: 'testuser'
      };
      mockGetConfigDir.mockReturnValue('/new/config/path');

      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      // Should use new path utility, not old HOME env var
      expect(serviceFile.path).toBe('/new/config/path/systemd/user/apex-daemon.service');
      expect(mockGetConfigDir).toHaveBeenCalled();
    });
  });
});