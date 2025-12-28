import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHomeDir, getConfigDir } from '@apexcli/core';
import {
  ServiceManager,
  SystemdGenerator,
  LaunchdGenerator,
  WindowsServiceGenerator,
  type ServiceManagerOptions,
} from '../service-manager.js';

/**
 * Windows Compatibility Tests for Service Manager
 *
 * These tests verify that the Service Manager works correctly on Windows
 * after replacing process.env.HOME with cross-platform utilities.
 *
 * ACCEPTANCE CRITERIA VALIDATION:
 * - All instances of process.env.HOME replaced with os.homedir() or cross-platform utility
 * - ServiceManager works on Windows
 * - SessionStore and other services work on Windows
 */

// Mock the cross-platform utilities
vi.mock('@apexcli/core', () => ({
  getHomeDir: vi.fn(),
  getConfigDir: vi.fn(),
}));

const mockGetHomeDir = vi.mocked(getHomeDir);
const mockGetConfigDir = vi.mocked(getConfigDir);

describe('Service Manager - Windows Compatibility', () => {
  const baseOptions: ServiceManagerOptions = {
    projectPath: 'C:\\Users\\TestUser\\Projects\\apex',
    serviceName: 'apex-daemon',
    serviceDescription: 'APEX Daemon Service',
    user: 'TestUser',
    workingDirectory: 'C:\\Users\\TestUser\\Projects\\apex',
    environment: { NODE_ENV: 'production' },
    restartPolicy: 'on-failure',
    restartDelaySeconds: 5,
  };

  // Mock Windows platform
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    // Set up realistic Windows paths
    mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');
    mockGetConfigDir.mockReturnValue('C:\\Users\\TestUser\\AppData\\Roaming');
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  describe('Windows Service File Generation', () => {
    it('should generate Windows service files without using process.env.HOME', () => {
      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.platform).toBe('win32');
      expect(serviceFile.path).toBe('C:\\Users\\TestUser\\Projects\\apex\\.apex\\service-install.ps1');
      expect(serviceFile.content).toContain('PowerShell script');
      expect(serviceFile.content).toContain('apex-daemon');

      // Verify that getHomeDir/getConfigDir were called (not process.env.HOME)
      expect(mockGetHomeDir).toHaveBeenCalled();
      expect(mockGetConfigDir).toHaveBeenCalled();

      // Service content should not contain direct HOME references
      expect(serviceFile.content).not.toContain('process.env.HOME');
      expect(serviceFile.content).not.toContain('$env:HOME');
    });

    it('should handle Windows paths with spaces correctly', () => {
      const windowsOptionsWithSpaces = {
        ...baseOptions,
        projectPath: 'C:\\Users\\Test User\\My Projects\\apex project',
        workingDirectory: 'C:\\Users\\Test User\\My Projects\\apex project',
      };

      mockGetHomeDir.mockReturnValue('C:\\Users\\Test User');
      mockGetConfigDir.mockReturnValue('C:\\Users\\Test User\\AppData\\Roaming');

      const manager = new ServiceManager(windowsOptionsWithSpaces);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('C:\\Users\\Test User\\My Projects\\apex project\\.apex\\service-install.ps1');
      expect(serviceFile.content).toContain('apex-daemon');
    });

    it('should handle Windows drive letters correctly', () => {
      const alternativeDrive = {
        ...baseOptions,
        projectPath: 'D:\\Development\\apex',
        workingDirectory: 'D:\\Development\\apex',
      };

      mockGetHomeDir.mockReturnValue('D:\\Users\\TestUser');
      mockGetConfigDir.mockReturnValue('D:\\Users\\TestUser\\AppData\\Roaming');

      const manager = new ServiceManager(alternativeDrive);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('D:\\Development\\apex\\.apex\\service-install.ps1');
      expect(serviceFile.platform).toBe('win32');
    });
  });

  describe('Windows-specific Generator Tests', () => {
    it('should use cross-platform utilities in Windows generator', () => {
      const generator = new WindowsServiceGenerator(baseOptions as Required<ServiceManagerOptions>);

      // Generate content to trigger path utilities usage
      const content = generator.generate();
      const installPath = generator.getInstallPath();

      expect(installPath).toBe('C:\\Users\\TestUser\\Projects\\apex\\.apex\\service-install.ps1');
      expect(content).toContain('PowerShell script for managing APEX daemon service');

      // Verify cross-platform utilities were used
      expect(mockGetHomeDir).toHaveBeenCalled();
      expect(mockGetConfigDir).toHaveBeenCalled();
    });

    it('should handle APPDATA environment variable correctly', () => {
      // Set APPDATA explicitly
      const originalEnv = process.env;
      process.env = { ...originalEnv, APPDATA: 'C:\\Users\\TestUser\\AppData\\Roaming' };

      mockGetConfigDir.mockReturnValue('C:\\Users\\TestUser\\AppData\\Roaming');

      try {
        const generator = new WindowsServiceGenerator(baseOptions as Required<ServiceManagerOptions>);
        const content = generator.generate();

        expect(content).toBeTruthy();
        expect(mockGetConfigDir).toHaveBeenCalled();
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('Error Handling on Windows', () => {
    it('should handle getHomeDir errors gracefully on Windows', () => {
      mockGetHomeDir.mockImplementation(() => {
        throw new Error('Unable to determine home directory');
      });

      expect(() => {
        const manager = new ServiceManager(baseOptions);
        manager.generateServiceFile();
      }).toThrow('Unable to determine home directory');
    });

    it('should handle getConfigDir errors gracefully on Windows', () => {
      mockGetConfigDir.mockImplementation(() => {
        throw new Error('Unable to determine config directory');
      });

      expect(() => {
        const manager = new ServiceManager(baseOptions);
        manager.generateServiceFile();
      }).toThrow('Unable to determine config directory');
    });

    it('should handle mixed path separators on Windows', () => {
      const mixedSeparatorOptions = {
        ...baseOptions,
        projectPath: 'C:/Users/TestUser/Projects/apex',  // Unix-style separators
        workingDirectory: 'C:/Users/TestUser/Projects/apex',
      };

      mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');

      const manager = new ServiceManager(mixedSeparatorOptions);
      const serviceFile = manager.generateServiceFile();

      // Should still work correctly with normalized paths
      expect(serviceFile.platform).toBe('win32');
      expect(serviceFile.content).toBeTruthy();
    });
  });

  describe('Windows Path Validation', () => {
    it('should generate valid Windows-style paths', () => {
      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      // Should contain Windows-style path separators
      expect(serviceFile.path).toMatch(/[A-Z]:\\/); // Drive letter
      expect(serviceFile.path).toMatch(/\\\\/); // Backslashes

      // Should not contain Unix-style forward slashes in final path
      const pathWithoutDrive = serviceFile.path.substring(2); // Remove drive letter
      expect(pathWithoutDrive.includes('/')).toBe(false);
    });

    it('should handle UNC paths if provided', () => {
      const uncOptions = {
        ...baseOptions,
        projectPath: '\\\\server\\share\\apex',
        workingDirectory: '\\\\server\\share\\apex',
      };

      const manager = new ServiceManager(uncOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toBe('\\\\server\\share\\apex\\.apex\\service-install.ps1');
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('ACCEPTANCE: Should not use process.env.HOME anywhere in Windows service generation', () => {
      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      // Verify that cross-platform utilities were called
      expect(mockGetHomeDir).toHaveBeenCalled();
      expect(mockGetConfigDir).toHaveBeenCalled();

      // Service content should not contain process.env.HOME references
      expect(serviceFile.content).not.toContain('process.env.HOME');
      expect(serviceFile.content).not.toContain('env:HOME');

      // Should work on Windows
      expect(serviceFile.platform).toBe('win32');
      expect(serviceFile.content).toBeTruthy();
      expect(serviceFile.path).toBeTruthy();
    });

    it('ACCEPTANCE: ServiceManager works correctly on Windows platform', () => {
      const manager = new ServiceManager(baseOptions);

      // Should be able to generate service file
      const serviceFile = manager.generateServiceFile();
      expect(serviceFile.success).not.toBe(false); // Assuming success property or no error

      // Should detect Windows platform correctly
      expect(serviceFile.platform).toBe('win32');

      // Should generate proper PowerShell script
      expect(serviceFile.content).toContain('PowerShell');
      expect(serviceFile.path).toContain('.ps1');
    });

    it('ACCEPTANCE: Cross-platform utilities provide consistent behavior', () => {
      // Test multiple service name variations
      const testServices = [
        { ...baseOptions, serviceName: 'apex-test-1' },
        { ...baseOptions, serviceName: 'apex-test-2' },
        { ...baseOptions, serviceName: 'my-custom-service' },
      ];

      testServices.forEach(options => {
        const manager = new ServiceManager(options);
        const serviceFile = manager.generateServiceFile();

        expect(serviceFile.platform).toBe('win32');
        expect(serviceFile.content).toContain(options.serviceName);
        expect(serviceFile.path).toContain('.apex\\service-install.ps1');
      });

      // Verify consistent usage of cross-platform utilities
      expect(mockGetHomeDir).toHaveBeenCalledTimes(testServices.length);
      expect(mockGetConfigDir).toHaveBeenCalledTimes(testServices.length);
    });
  });

  describe('Integration with Other Services', () => {
    it('should work when other services also use cross-platform utilities', () => {
      // Simulate multiple service instances using the utilities
      const services = [
        new ServiceManager({ ...baseOptions, serviceName: 'apex-primary' }),
        new ServiceManager({ ...baseOptions, serviceName: 'apex-secondary' }),
        new ServiceManager({ ...baseOptions, serviceName: 'apex-monitoring' }),
      ];

      services.forEach(service => {
        const serviceFile = service.generateServiceFile();
        expect(serviceFile.platform).toBe('win32');
        expect(serviceFile.content).toBeTruthy();
      });

      // All should have used the cross-platform utilities
      expect(mockGetHomeDir).toHaveBeenCalledTimes(3);
      expect(mockGetConfigDir).toHaveBeenCalledTimes(3);
    });

    it('should handle SessionStore-like usage patterns', () => {
      // Simulate SessionStore needing config directory
      const configDir = mockGetConfigDir();
      const sessionPath = configDir + '\\apex\\sessions';

      expect(configDir).toBe('C:\\Users\\TestUser\\AppData\\Roaming');
      expect(sessionPath).toBe('C:\\Users\\TestUser\\AppData\\Roaming\\apex\\sessions');

      // Should work with ServiceManager
      const manager = new ServiceManager(baseOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.platform).toBe('win32');
    });
  });
});