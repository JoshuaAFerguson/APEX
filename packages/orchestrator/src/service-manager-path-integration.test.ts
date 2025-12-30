import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHomeDir, getConfigDir } from '@apexcli/core';
import { promises as fs } from 'fs';
import {
  SystemdGenerator,
  LaunchdGenerator,
  WindowsServiceGenerator,
  type ServiceManagerOptions,
} from './service-manager';

// Platform detection for test skipping
// Skip Unix/Linux-specific path integration tests on Windows since they test systemd/launchd paths
const isWindows = process.platform === 'win32';

// Mock dependencies
vi.mock('@apexcli/core', () => ({
  getHomeDir: vi.fn(),
  getConfigDir: vi.fn(),
}));

vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
  },
  accessSync: vi.fn(),
}));

const mockGetHomeDir = vi.mocked(getHomeDir);
const mockGetConfigDir = vi.mocked(getConfigDir);
const mockFsAccessSync = vi.mocked(require('fs').accessSync);

// Mock process
const mockProcess = {
  platform: 'linux' as NodeJS.Platform,
  getuid: vi.fn(() => 1000),
  cwd: vi.fn(() => '/test/project'),
};

Object.defineProperty(global, 'process', {
  value: mockProcess,
  writable: true,
});

describe('ServiceManager - Path Integration Tests', () => {
  const requiredOptions: Required<ServiceManagerOptions> = {
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
    mockFsAccessSync.mockImplementation(() => {
      throw new Error('File not found');
    });
  });

  describe.skipIf(isWindows)('SystemdGenerator Path Integration', () => {
    it('should call getConfigDir when generating user-level service path', () => {
      mockProcess.getuid = vi.fn(() => 1000); // Non-root
      mockGetConfigDir.mockReturnValue('/custom/config');

      const generator = new SystemdGenerator(requiredOptions);
      const installPath = generator.getInstallPath();

      expect(mockGetConfigDir).toHaveBeenCalledWith();
      expect(installPath).toBe('/custom/config/systemd/user/apex-daemon.service');
    });

    it('should not call getConfigDir for root user', () => {
      mockProcess.getuid = vi.fn(() => 0); // Root

      const generator = new SystemdGenerator(requiredOptions);
      const installPath = generator.getInstallPath();

      expect(mockGetConfigDir).not.toHaveBeenCalled();
      expect(installPath).toBe('/etc/systemd/system/apex-daemon.service');
    });
  });

  describe.skipIf(isWindows)('LaunchdGenerator Path Integration', () => {
    beforeEach(() => {
      mockProcess.platform = 'darwin';
    });

    it('should call getHomeDir when generating LaunchAgents path', () => {
      mockGetHomeDir.mockReturnValue('/Users/testuser');

      const generator = new LaunchdGenerator(requiredOptions);
      const installPath = generator.getInstallPath();

      expect(mockGetHomeDir).toHaveBeenCalledWith();
      expect(installPath).toBe('/Users/testuser/Library/LaunchAgents/com.apex.daemon.plist');
    });
  });

  describe('WindowsServiceGenerator Path Integration', () => {
    beforeEach(() => {
      mockProcess.platform = 'win32';
    });

    it('should use getConfigDir in CLI path fallback detection', () => {
      mockGetConfigDir.mockReturnValue('C:\\Users\\user\\AppData\\Roaming');

      // Mock require.resolve to fail (forcing fallback path detection)
      const originalRequire = global.require;
      global.require = vi.fn().mockImplementation((id) => {
        if (id === '@apex/cli/dist/index.js') {
          throw new Error('Module not found');
        }
        return originalRequire(id);
      }) as any;

      // Mock fs.accessSync to fail for the first few paths but succeed for the config dir path
      mockFsAccessSync.mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('AppData\\Roaming')) {
          return; // Success
        }
        throw new Error('File not found');
      });

      const generator = new WindowsServiceGenerator(requiredOptions);
      const content = generator.generate();

      // Verify getConfigDir was called for CLI path detection
      expect(mockGetConfigDir).toHaveBeenCalled();
      expect(content).toContain('$apexCliPath = ');

      // Restore require
      global.require = originalRequire;
    });

    it('should not call path utilities for install path (uses project directory)', () => {
      const generator = new WindowsServiceGenerator(requiredOptions);
      const installPath = generator.getInstallPath();

      // Windows service generator should not use getHomeDir or getConfigDir for install path
      expect(installPath).toBe('/test/project/.apex/service-install.ps1');
    });
  });

  describe.skipIf(isWindows)('Cross-Platform Path Behavior Verification', () => {
    it('should handle empty paths from path utilities', () => {
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockReturnValue('');

      const generator = new SystemdGenerator(requiredOptions);
      const installPath = generator.getInstallPath();

      // Empty config dir should still work with path.join
      expect(installPath).toBe('systemd/user/apex-daemon.service');
    });

    it('should handle paths with special characters', () => {
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockReturnValue('/Users/test user (admin)');

      const generator = new LaunchdGenerator(requiredOptions);
      const installPath = generator.getInstallPath();

      expect(installPath).toBe('/Users/test user (admin)/Library/LaunchAgents/com.apex.daemon.plist');
    });

    it('should handle Windows drive letters correctly', () => {
      mockProcess.platform = 'win32';
      const windowsOptions = { ...requiredOptions, projectPath: 'D:\\Projects\\apex' };

      const generator = new WindowsServiceGenerator(windowsOptions);
      const installPath = generator.getInstallPath();

      expect(installPath).toBe('D:\\Projects\\apex\\.apex\\service-install.ps1');
    });
  });

  describe.skipIf(isWindows)('Error Handling in Path Operations', () => {
    it('should propagate getConfigDir errors in SystemdGenerator', () => {
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockImplementation(() => {
        throw new Error('Config directory access denied');
      });

      const generator = new SystemdGenerator(requiredOptions);

      expect(() => {
        generator.getInstallPath();
      }).toThrow('Config directory access denied');
    });

    it('should propagate getHomeDir errors in LaunchdGenerator', () => {
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockImplementation(() => {
        throw new Error('Home directory access denied');
      });

      const generator = new LaunchdGenerator(requiredOptions);

      expect(() => {
        generator.getInstallPath();
      }).toThrow('Home directory access denied');
    });

    it('should handle getConfigDir errors gracefully in Windows CLI detection', () => {
      mockProcess.platform = 'win32';
      mockGetConfigDir.mockImplementation(() => {
        throw new Error('Config directory error');
      });

      // Mock require.resolve to fail
      const originalRequire = global.require;
      global.require = vi.fn().mockImplementation((id) => {
        if (id === '@apex/cli/dist/index.js') {
          throw new Error('Module not found');
        }
        return originalRequire(id);
      }) as any;

      // All fs.accessSync calls fail
      mockFsAccessSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const generator = new WindowsServiceGenerator(requiredOptions);

      // Should not throw even if getConfigDir fails - should use default fallback
      expect(() => {
        const content = generator.generate();
        expect(content).toContain('$apexCliPath = ');
      }).not.toThrow();

      // Restore require
      global.require = originalRequire;
    });
  });
});