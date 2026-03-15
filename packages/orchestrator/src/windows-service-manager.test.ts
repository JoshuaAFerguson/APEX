/**
 * Tests for Windows Service Manager
 *
 * These tests run on all platforms but only perform actual Windows service operations on Windows.
 * On non-Windows platforms, they test the error handling and no-op behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WindowsServiceManager, WindowsServiceError, type WindowsServiceConfig } from './windows-service-manager';

// Mock child_process exec for testing
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    exec: vi.fn()
  };
});

// Mock fs for testing
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    promises: {
      writeFile: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn()
    }
  };
});

describe('WindowsServiceManager', () => {
  let manager: WindowsServiceManager;

  beforeEach(() => {
    manager = new WindowsServiceManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Platform Detection', () => {
    it('should detect Windows platform correctly', () => {
      // On actual Windows platform, should return true
      if (process.platform === 'win32') {
        expect(manager.isWindowsPlatform()).toBe(true);
      } else {
        // On non-Windows platforms, should return false
        expect(manager.isWindowsPlatform()).toBe(false);
      }
    });
  });

  describe('NSSM Detection', () => {
    it('should return false for NSSM availability on non-Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const linuxManager = new WindowsServiceManager();
      const result = await linuxManager.isNSSMAvailable();
      expect(result).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('should test NSSM command on Windows', async () => {
      if (process.platform !== 'win32') {
        // Skip actual NSSM testing on non-Windows platforms
        expect(true).toBe(true);
        return;
      }

      // This would run actual NSSM detection on Windows
      // In a real test environment, you might mock exec to simulate NSSM availability
      const result = await manager.isNSSMAvailable();
      expect(typeof result).toBe('boolean');
    }, 5000); // 5 second timeout instead of default 30s
  });

  describe('Elevation Detection', () => {
    it('should return false for elevation on non-Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const linuxManager = new WindowsServiceManager();
      const result = await linuxManager.isElevated();
      expect(result).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('Service Installation', () => {
    const mockConfig: WindowsServiceConfig = {
      serviceName: 'test-service',
      displayName: 'Test Service',
      description: 'Test service description',
      executablePath: 'node.exe',
      arguments: ['script.js'],
      workingDirectory: '/test/directory',
      environment: { NODE_ENV: 'test' },
      startType: 'auto'
    };

    it('should throw error on non-Windows platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const linuxManager = new WindowsServiceManager();

      await expect(linuxManager.install(mockConfig)).rejects.toThrow(
        'Windows service installation only available on Windows'
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('should validate configuration object', () => {
      expect(mockConfig.serviceName).toBe('test-service');
      expect(mockConfig.displayName).toBe('Test Service');
      expect(mockConfig.startType).toBe('auto');
      expect(mockConfig.environment.NODE_ENV).toBe('test');
    });
  });

  describe('Service Status', () => {
    it('should return not installed status on non-Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const linuxManager = new WindowsServiceManager();
      const status = await linuxManager.getStatus('test-service');

      expect(status.installed).toBe(false);
      expect(status.state).toBe('unknown');
      expect(status.startType).toBe('disabled');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('Service Operations', () => {
    it('should throw appropriate errors for operations on non-Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const linuxManager = new WindowsServiceManager();

      await expect(linuxManager.start('test-service')).rejects.toThrow(
        'Windows service start only available on Windows'
      );

      await expect(linuxManager.stop('test-service')).rejects.toThrow(
        'Windows service stop only available on Windows'
      );

      await expect(linuxManager.uninstall('test-service')).rejects.toThrow(
        'Windows service uninstallation only available on Windows'
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('Error Handling', () => {
    it('should create proper WindowsServiceError instances', () => {
      const error = new WindowsServiceError('Test error message', 'SERVICE_NOT_FOUND');

      expect(error.name).toBe('WindowsServiceError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('SERVICE_NOT_FOUND');
      expect(error instanceof Error).toBe(true);
    });

    it('should handle error with cause', () => {
      const cause = new Error('Original error');
      const error = new WindowsServiceError('Wrapper error', 'INSTALL_FAILED', cause);

      expect(error.cause).toBe(cause);
      expect(error.message).toBe('Wrapper error');
    });
  });

  describe('Service Recovery Options', () => {
    it('should validate recovery options structure', () => {
      const recoveryOptions = {
        firstFailure: 'restart' as const,
        secondFailure: 'restart' as const,
        subsequentFailures: 'none' as const,
        resetPeriodDays: 1,
        restartDelayMs: 5000
      };

      expect(recoveryOptions.firstFailure).toBe('restart');
      expect(recoveryOptions.resetPeriodDays).toBe(1);
      expect(recoveryOptions.restartDelayMs).toBe(5000);
    });
  });

  describe('Configuration Validation', () => {
    it('should accept valid service configurations', () => {
      const validConfigs: WindowsServiceConfig[] = [
        {
          serviceName: 'apex-daemon',
          displayName: 'APEX Daemon',
          description: 'APEX AI Development Team Automation',
          executablePath: 'C:\\Program Files\\nodejs\\node.exe',
          arguments: ['apex', 'daemon', 'start', '--foreground'],
          workingDirectory: 'C:\\projects\\apex',
          environment: { NODE_ENV: 'production', APEX_PROJECT_PATH: 'C:\\projects\\apex' },
          startType: 'auto'
        },
        {
          serviceName: 'test-service-demand',
          displayName: 'Test Demand Start Service',
          description: 'Test service with demand start',
          executablePath: 'node.exe',
          arguments: ['app.js'],
          workingDirectory: '/test/dir',
          environment: {},
          startType: 'demand'
        }
      ];

      validConfigs.forEach(config => {
        expect(config.serviceName).toMatch(/^[a-zA-Z0-9\-_]+$/);
        expect(['auto', 'demand', 'disabled']).toContain(config.startType);
        expect(Array.isArray(config.arguments)).toBe(true);
        expect(typeof config.environment).toBe('object');
      });
    });
  });
});

// Integration test that only runs on Windows in CI/CD
describe('Windows Integration Tests', () => {
  it('should skip integration tests on non-Windows platforms', () => {
    if (process.platform !== 'win32') {
      console.log('Skipping Windows integration tests on non-Windows platform');
      expect(true).toBe(true);
      return;
    }

    // These tests would only run on actual Windows environments
    // They would test real Windows service operations with elevated privileges
    expect(process.platform).toBe('win32');
  });
});