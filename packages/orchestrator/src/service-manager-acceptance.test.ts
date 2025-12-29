import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHomeDir, getConfigDir } from '@apex/core';
import { ServiceManager, type ServiceManagerOptions } from './service-manager';

// Windows compatibility: These tests involve Unix-specific system service behaviors
// that don't apply on Windows platform
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

describe('ServiceManager - Acceptance Criteria Tests', () => {
  const baseOptions: ServiceManagerOptions = {
    projectPath: '/test/project',
    serviceName: 'apex-daemon',
    serviceDescription: 'APEX Daemon Service',
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
    mockProcess.getuid = vi.fn(() => 1000);
  });

  describe('Acceptance Criteria Verification', () => {
    it.skipIf(isWindows)('ACCEPTANCE: service-manager.ts uses getHomeDir() instead of direct process.env.HOME access', () => {
      // Test on macOS where getHomeDir() is used
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockReturnValue('/Users/testuser');

      const manager = new ServiceManager(baseOptions);
      manager.generateServiceFile();

      // Verify getHomeDir() was called (not process.env.HOME)
      expect(mockGetHomeDir).toHaveBeenCalled();
    });

    it.skipIf(isWindows)('ACCEPTANCE: service-manager.ts uses getConfigDir() instead of direct process.env.HOME access', () => {
      // Test on Linux where getConfigDir() is used
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockReturnValue('/home/user/.config');

      const manager = new ServiceManager(baseOptions);
      manager.generateServiceFile();

      // Verify getConfigDir() was called (not process.env.HOME)
      expect(mockGetConfigDir).toHaveBeenCalled();
    });

    it.skipIf(isWindows)('ACCEPTANCE: Service generation works correctly on Linux platform', () => {
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockReturnValue('/home/user/.config');

      const manager = new ServiceManager(baseOptions);
      const result = manager.generateServiceFile();

      expect(result.platform).toBe('linux');
      expect(result.path).toBe('/home/user/.config/systemd/user/apex-daemon.service');
      expect(result.content).toContain('[Unit]');
      expect(result.content).toContain('Description=APEX Daemon Service');
      expect(result.content).toContain('[Service]');
      expect(result.content).toContain('[Install]');
    });

    it.skipIf(isWindows)('ACCEPTANCE: Service generation works correctly on macOS platform', () => {
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockReturnValue('/Users/testuser');

      const manager = new ServiceManager(baseOptions);
      const result = manager.generateServiceFile();

      expect(result.platform).toBe('darwin');
      expect(result.path).toBe('/Users/testuser/Library/LaunchAgents/com.apex.daemon.plist');
      expect(result.content).toContain('<?xml version="1.0"');
      expect(result.content).toContain('<key>Label</key>');
      expect(result.content).toContain('<string>com.apex.daemon</string>');
    });

    it('ACCEPTANCE: Service generation works correctly on Windows platform', () => {
      mockProcess.platform = 'win32';

      const manager = new ServiceManager(baseOptions);
      const result = manager.generateServiceFile();

      expect(result.platform).toBe('win32');
      expect(result.path).toBe('/test/project/.apex/service-install.ps1');
      expect(result.content).toContain('# APEX Service Installation Script for Windows');
      expect(result.content).toContain('param(');
      expect(result.content).toContain('$serviceName = "apex-daemon"');
    });

    it.skipIf(isWindows)('ACCEPTANCE: No direct process.env.HOME access remains in path generation', () => {
      // Test that even when process.env.HOME is set, we don't use it
      mockProcess.platform = 'linux';
      mockProcess.env.HOME = '/old/deprecated/path';
      mockGetConfigDir.mockReturnValue('/correct/path/.config');

      const manager = new ServiceManager(baseOptions);
      const result = manager.generateServiceFile();

      // Should use the path from getConfigDir(), not process.env.HOME
      expect(result.path).toBe('/correct/path/.config/systemd/user/apex-daemon.service');
      expect(result.path).not.toContain('/old/deprecated/path');
      expect(mockGetConfigDir).toHaveBeenCalled();
    });

    it('ACCEPTANCE: Cross-platform compatibility is maintained', () => {
      const platformTests = [
        {
          platform: 'linux' as NodeJS.Platform,
          mockSetup: () => mockGetConfigDir.mockReturnValue('/home/test/.config'),
          expectedPathContains: '.config/systemd/user',
          expectedContentContains: '[Unit]'
        },
        {
          platform: 'darwin' as NodeJS.Platform,
          mockSetup: () => mockGetHomeDir.mockReturnValue('/Users/test'),
          expectedPathContains: 'Library/LaunchAgents',
          expectedContentContains: '<?xml version'
        },
        {
          platform: 'win32' as NodeJS.Platform,
          mockSetup: () => {}, // No special mock needed for Windows
          expectedPathContains: '.apex/service-install.ps1',
          expectedContentContains: '# APEX Service Installation Script'
        }
      ];

      platformTests.forEach(({ platform, mockSetup, expectedPathContains, expectedContentContains }) => {
        // Reset for each platform test
        vi.clearAllMocks();
        mockGetHomeDir.mockReturnValue('/default/home');
        mockGetConfigDir.mockReturnValue('/default/.config');

        mockProcess.platform = platform;
        mockSetup();

        const manager = new ServiceManager(baseOptions);
        const result = manager.generateServiceFile();

        expect(result.platform).toBe(platform);
        expect(result.path).toContain(expectedPathContains);
        expect(result.content).toContain(expectedContentContains);
      });
    });

    it.skipIf(isWindows)('ACCEPTANCE: Error handling works correctly when path utilities fail', () => {
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockImplementation(() => {
        throw new Error('Unable to determine configuration directory');
      });

      const manager = new ServiceManager(baseOptions);

      expect(() => {
        manager.generateServiceFile();
      }).toThrow('Unable to determine configuration directory');
    });
  });

  describe('Regression Prevention', () => {
    it.skipIf(isWindows)('REGRESSION: Old tests that expected specific paths should still work', () => {
      // Simulate the old test expectation behavior but with new implementation
      mockProcess.platform = 'linux';
      mockGetConfigDir.mockReturnValue('/home/user/.config');

      const manager = new ServiceManager(baseOptions);
      const result = manager.generateServiceFile();

      // These are the kind of expectations that existed in old tests
      expect(result.path).toContain('.config/systemd/user');
      expect(result.path).toContain('apex-daemon.service');
    });

    it.skipIf(isWindows)('REGRESSION: macOS tests should maintain LaunchAgents behavior', () => {
      mockProcess.platform = 'darwin';
      mockGetHomeDir.mockReturnValue('/Users/testuser');

      const manager = new ServiceManager(baseOptions);
      const result = manager.generateServiceFile();

      // Existing test expectations should still pass
      expect(result.path).toContain('Library/LaunchAgents');
      expect(result.path).toContain('com.apex.daemon.plist');
    });
  });
});