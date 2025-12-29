import { describe, it, expect, vi } from 'vitest';
import { getHomeDir, getConfigDir } from '@apex/core';
import {
  ServiceManager,
  SystemdGenerator,
  LaunchdGenerator,
  WindowsServiceGenerator,
  type ServiceManagerOptions,
} from './service-manager';

// Platform detection for test skipping
// Skip Unix/Linux-specific tests on Windows since they test systemd/launchd functionality
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

describe('ServiceManager - Cross-Platform Coverage Tests', () => {
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

  describe.skipIf(isWindows)('Path Utilities Integration', () => {
    it('should successfully import and use getHomeDir from @apex/core', () => {
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockReturnValue('/Users/testuser');

      const manager = new ServiceManager(baseOptions);
      const result = manager.generateServiceFile();

      expect(mockGetHomeDir).toHaveBeenCalled();
      expect(result.path).toContain('/Users/testuser');
      expect(result.platform).toBe('darwin');
    });

    it('should successfully import and use getConfigDir from @apex/core', () => {
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockReturnValue('/home/user/.config');

      const manager = new ServiceManager(baseOptions);
      const result = manager.generateServiceFile();

      expect(mockGetConfigDir).toHaveBeenCalled();
      expect(result.path).toContain('/home/user/.config');
      expect(result.platform).toBe('linux');
    });

    it('should handle Windows platform without calling getHomeDir or getConfigDir for service path', () => {
      mockProcess.platform = 'win32';

      const manager = new ServiceManager(baseOptions);
      const result = manager.generateServiceFile();

      expect(result.path).toBe('/test/project/.apex/service-install.ps1');
      expect(result.platform).toBe('win32');
      // Note: getConfigDir might still be called for CLI path detection in the generated content
    });
  });

  describe.skipIf(isWindows)('Platform-Specific Behavior', () => {
    it('should use correct Linux systemd paths with cross-platform utilities', () => {
      mockProcess.platform = 'linux';
      mockProcess.getuid = vi.fn(() => 1000); // Non-root
      mockGetConfigDir.mockReturnValue('/custom/config');

      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('/custom/config/systemd/user/apex-daemon.service');
      expect(serviceFile.content).toContain('[Unit]');
      expect(serviceFile.content).toContain('Description=Test Service');
    });

    it('should use correct macOS LaunchAgents paths with cross-platform utilities', () => {
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockReturnValue('/Users/customuser');

      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('/Users/customuser/Library/LaunchAgents/com.apex.daemon.plist');
      expect(serviceFile.content).toContain('<?xml version="1.0"');
      expect(serviceFile.content).toContain('<key>Label</key>');
    });

    it('should use correct Windows PowerShell script paths', () => {
      mockProcess.platform = 'win32';

      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('/test/project/.apex/service-install.ps1');
      expect(serviceFile.content).toContain('# APEX Service Installation Script for Windows');
      expect(serviceFile.content).toContain('param(');
    });
  });

  describe.skipIf(isWindows)('Error Handling Coverage', () => {
    it('should handle path utility failures gracefully', () => {
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockImplementation(() => {
        throw new Error('Configuration directory not accessible');
      });

      const manager = new ServiceManager(baseOptions);

      expect(() => {
        manager.generateServiceFile();
      }).toThrow('Configuration directory not accessible');
    });

    it('should handle home directory access failures', () => {
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

  describe.skipIf(isWindows)('Backwards Compatibility', () => {
    it('should no longer depend on process.env.HOME', () => {
      mockProcess.platform = 'linux';
      mockProcess.env = { USER: 'testuser' }; // Remove HOME
      mockGetConfigDir.mockReturnValue('/new/config');

      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      // Should use getConfigDir, not process.env.HOME
      expect(serviceFile.path).toBe('/new/config/systemd/user/apex-daemon.service');
      expect(mockGetConfigDir).toHaveBeenCalled();
    });

    it('should work correctly on all supported platforms', () => {
      const platforms: Array<{ platform: NodeJS.Platform; expectedPath: string }> = [
        { platform: 'linux', expectedPath: '/home/user/.config/systemd/user/apex-daemon.service' },
        { platform: 'darwin', expectedPath: '/home/user/Library/LaunchAgents/com.apex.daemon.plist' },
        { platform: 'win32', expectedPath: '/test/project/.apex/service-install.ps1' },
      ];

      platforms.forEach(({ platform, expectedPath }) => {
        mockProcess.platform = platform;
        vi.clearAllMocks();
        mockGetHomeDir.mockReturnValue('/home/user');
        mockGetConfigDir.mockReturnValue('/home/user/.config');

        const manager = new ServiceManager(baseOptions);
        const serviceFile = manager.generateServiceFile();

        expect(serviceFile.path).toBe(expectedPath);
        expect(serviceFile.platform).toBe(platform);
      });
    });
  });
});