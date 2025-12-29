/**
 * Windows Compatibility Tests for ServiceManager
 *
 * Tests Windows-specific functionality including:
 * - Windows service creation via NSSM and sc.exe fallback
 * - PowerShell script generation
 * - Windows path escaping
 * - Service status parsing for Windows states (RUNNING, STOPPED, PENDING variants)
 * - Error handling for Windows-specific failures
 */

import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { getHomeDir, getConfigDir } from '@apexcli/core';
import {
  ServiceManager,
  WindowsServiceGenerator,
  ServiceError,
  detectPlatform,
  isWindowsServiceAvailable,
  isNSSMAvailable,
  type ServiceManagerOptions,
  type ServiceStatus,
} from './service-manager';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
  },
  accessSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('@apexcli/core', () => ({
  getHomeDir: vi.fn(() => 'C:\\Users\\testuser'),
  getConfigDir: vi.fn(() => 'C:\\Users\\testuser\\AppData\\Roaming'),
}));

// Mock OS module for tmpdir
vi.mock('os', () => ({
  tmpdir: vi.fn(() => 'C:\\temp'),
}));

// Mock process for Windows platform
const mockProcess = {
  platform: 'win32' as NodeJS.Platform,
  execPath: 'C:\\Program Files\\nodejs\\node.exe',
  env: { USER: 'testuser', TEMP: 'C:\\temp' },
  cwd: vi.fn(() => 'C:\\test\\project'),
  getuid: undefined, // Windows doesn't have getuid
};

Object.defineProperty(global, 'process', {
  value: mockProcess,
  writable: true,
});

const mockFs = vi.mocked(fs);
const mockExec = vi.mocked(exec) as MockedFunction<typeof exec>;
const mockGetHomeDir = vi.mocked(getHomeDir);
const mockGetConfigDir = vi.mocked(getConfigDir);

// Mock require for resolution
const mockRequire = vi.fn();
Object.defineProperty(global, 'require', {
  value: mockRequire,
  writable: true,
});

// Test configuration
const baseOptions: Required<ServiceManagerOptions> = {
  projectPath: 'C:\\test\\project',
  serviceName: 'apex-daemon',
  serviceDescription: 'APEX Daemon - AI Development Team Automation',
  user: 'testuser',
  workingDirectory: 'C:\\test\\project',
  environment: { NODE_ENV: 'production', APEX_DEBUG: 'true' },
  restartPolicy: 'on-failure',
  restartDelaySeconds: 5,
};

describe('ServiceManager - Windows Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHomeDir.mockReturnValue('C:\\Users\\testuser');
    mockGetConfigDir.mockReturnValue('C:\\Users\\testuser\\AppData\\Roaming');

    // Mock child_process.execSync for platform detection
    const mockExecSync = vi.fn();
    mockRequire.mockImplementation((module: string) => {
      if (module === 'child_process') {
        return { execSync: mockExecSync };
      }
      if (module === 'fs') {
        return { accessSync: vi.fn() };
      }
      throw new Error(`Module not found: ${module}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Windows Platform Detection', () => {
    it('should detect Windows platform correctly', () => {
      expect(detectPlatform()).toBe('win32');
    });

    it('should check Windows service availability', () => {
      const mockExecSync = vi.fn().mockReturnValue('');
      mockRequire.mockReturnValue({ execSync: mockExecSync });

      expect(isWindowsServiceAvailable()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('sc query', { stdio: 'ignore' });
    });

    it('should handle Windows service unavailability', () => {
      const mockExecSync = vi.fn().mockImplementation(() => {
        throw new Error('sc command not found');
      });
      mockRequire.mockReturnValue({ execSync: mockExecSync });

      expect(isWindowsServiceAvailable()).toBe(false);
    });

    it('should check NSSM availability', () => {
      const mockExecSync = vi.fn().mockReturnValue('');
      mockRequire.mockReturnValue({ execSync: mockExecSync });

      expect(isNSSMAvailable()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('nssm version', { stdio: 'ignore' });
    });

    it('should handle NSSM unavailability', () => {
      const mockExecSync = vi.fn().mockImplementation(() => {
        throw new Error('nssm command not found');
      });
      mockRequire.mockReturnValue({ execSync: mockExecSync });

      expect(isNSSMAvailable()).toBe(false);
    });

    it('should return false for NSSM on non-Windows platforms', () => {
      const originalPlatform = mockProcess.platform;
      mockProcess.platform = 'linux';

      expect(isNSSMAvailable()).toBe(false);

      mockProcess.platform = originalPlatform;
    });
  });

  describe('WindowsServiceGenerator', () => {
    let generator: WindowsServiceGenerator;

    beforeEach(() => {
      generator = new WindowsServiceGenerator(baseOptions, false);
      mockRequire.mockImplementation((module: string) => {
        if (module === '@apex/cli/dist/index.js') {
          return {};
        }
        if (module === 'fs') {
          return { accessSync: vi.fn() };
        }
        throw new Error(`Cannot resolve module ${module}`);
      });
    });

    describe('PowerShell Script Generation', () => {
      it('should generate complete PowerShell script with NSSM support', () => {
        const content = generator.generate();

        expect(content).toContain('# APEX Service Installation Script for Windows');
        expect(content).toContain('param(');
        expect(content).toContain('[switch]$Install');
        expect(content).toContain('[switch]$Uninstall');
        expect(content).toContain('[switch]$UseNSSM = $true');
        expect(content).toContain('function Install-ApexService');
        expect(content).toContain('function Uninstall-ApexService');
      });

      it('should escape Windows paths correctly in PowerShell script', () => {
        const windowsOptions = {
          ...baseOptions,
          projectPath: 'C:\\Program Files\\My App\\Project',
          workingDirectory: 'C:\\Program Files\\My App\\Project',
        };

        generator = new WindowsServiceGenerator(windowsOptions, false);
        const content = generator.generate();

        expect(content).toContain('C:\\\\Program Files\\\\My App\\\\Project');
        expect(content).toContain('$workingDirectory = "C:\\\\Program Files\\\\My App\\\\Project"');
        expect(content).toContain('APEX_PROJECT_PATH=C:\\\\Program Files\\\\My App\\\\Project');
      });

      it('should handle environment variables correctly', () => {
        const envOptions = {
          ...baseOptions,
          environment: {
            NODE_ENV: 'production',
            CUSTOM_VAR: 'test value',
            PATH_VAR: 'C:\\some\\path',
          },
        };

        generator = new WindowsServiceGenerator(envOptions, false);
        const content = generator.generate();

        expect(content).toContain('NODE_ENV=production');
        expect(content).toContain('CUSTOM_VAR=test value');
        expect(content).toContain('PATH_VAR=C:\\some\\path');
      });

      it('should configure service for boot startup when enableOnBoot is true', () => {
        generator = new WindowsServiceGenerator(baseOptions, true);
        const content = generator.generate();

        expect(content).toContain('$enableOnBoot = $true');
        expect(content).toContain('if ($enableOnBoot) {');
        expect(content).toContain('SERVICE_AUTO_START');
      });

      it('should configure service for manual startup when enableOnBoot is false', () => {
        generator = new WindowsServiceGenerator(baseOptions, false);
        const content = generator.generate();

        expect(content).toContain('$enableOnBoot = $false');
        expect(content).toContain('SERVICE_DEMAND_START');
      });

      it('should include NSSM configuration', () => {
        const content = generator.generate();

        expect(content).toContain('if ($UseNSSM -and (Get-Command "nssm" -ErrorAction SilentlyContinue))');
        expect(content).toContain('& nssm install $serviceName');
        expect(content).toContain('& nssm set $serviceName DisplayName');
        expect(content).toContain('& nssm set $serviceName AppEnvironmentExtra');
        expect(content).toContain('& nssm set $serviceName AppExit Default');
      });

      it('should include fallback sc.exe configuration', () => {
        const content = generator.generate();

        expect(content).toContain('Installing service using built-in Windows Service Manager');
        expect(content).toContain('& sc.exe create $serviceName');
        expect(content).toContain('& sc.exe description $serviceName');
        expect(content).toContain('apex-service-wrapper.bat');
      });

      it('should map restart policies correctly for NSSM', () => {
        const testCases = [
          { policy: 'always', expected: 'Restart' },
          { policy: 'on-failure', expected: 'Restart' },
          { policy: 'never', expected: 'Exit' },
        ] as const;

        testCases.forEach(({ policy, expected }) => {
          const policyOptions = { ...baseOptions, restartPolicy: policy };
          generator = new WindowsServiceGenerator(policyOptions, false);
          const content = generator.generate();

          expect(content).toContain(`AppExit Default ${expected}`);
        });
      });
    });

    describe('Windows Path Handling', () => {
      it('should return correct install path for PowerShell script', () => {
        const installPath = generator.getInstallPath();
        expect(installPath).toBe('C:\\test\\project\\.apex\\service-install.ps1');
      });

      it('should handle paths with spaces', () => {
        const spaceOptions = {
          ...baseOptions,
          projectPath: 'C:\\Program Files\\My Project',
        };

        generator = new WindowsServiceGenerator(spaceOptions, false);
        const installPath = generator.getInstallPath();
        expect(installPath).toBe('C:\\Program Files\\My Project\\.apex\\service-install.ps1');
      });

      it('should handle complex Windows paths correctly', () => {
        const complexOptions = {
          ...baseOptions,
          projectPath: 'D:\\Users\\test user\\Documents\\Projects\\apex-app',
          workingDirectory: 'D:\\Users\\test user\\Documents\\Projects\\apex-app',
        };

        generator = new WindowsServiceGenerator(complexOptions, false);
        const content = generator.generate();

        expect(content).toContain('D:\\\\Users\\\\test user\\\\Documents\\\\Projects\\\\apex-app');
      });
    });

    describe('CLI Path Resolution', () => {
      it('should resolve @apex/cli path correctly', () => {
        mockRequire.mockImplementation((module: string) => {
          if (module === '@apex/cli/dist/index.js') {
            return {};
          }
          throw new Error(`Cannot resolve module ${module}`);
        });

        const content = generator.generate();
        expect(content).toContain('$apexCliPath');
      });

      it('should use fallback paths when @apex/cli is not resolvable', () => {
        mockRequire.mockImplementation((module: string) => {
          throw new Error(`Cannot resolve module ${module}`);
        });

        const mockAccessSync = vi.fn().mockImplementation((path: string) => {
          if (path.includes('packages\\cli\\dist\\index.js')) {
            return; // Success for this path
          }
          throw new Error('ENOENT');
        });

        mockRequire.mockImplementation((module: string) => {
          if (module === 'fs') {
            return { accessSync: mockAccessSync };
          }
          throw new Error(`Cannot resolve module ${module}`);
        });

        const content = generator.generate();
        expect(content).toContain('$apexCliPath');
      });

      it('should use default path when no CLI path is found', () => {
        mockRequire.mockImplementation((module: string) => {
          throw new Error(`Cannot resolve module ${module}`);
        });

        const content = generator.generate();
        expect(content).toContain('$apexCliPath');
        expect(content).toBeDefined();
      });
    });
  });

  describe('ServiceManager Windows Integration', () => {
    let manager: ServiceManager;

    beforeEach(() => {
      manager = new ServiceManager(baseOptions);
    });

    describe('Service File Generation', () => {
      it('should generate Windows service file with correct platform', () => {
        const serviceFile = manager.generateServiceFile();

        expect(serviceFile.platform).toBe('win32');
        expect(serviceFile.path).toBe('C:\\test\\project\\.apex\\service-install.ps1');
        expect(serviceFile.content).toContain('# APEX Service Installation Script for Windows');
      });

      it('should support NSSM when available', () => {
        expect(manager.isNSSMSupported()).toBe(true);
      });
    });

    describe('Service Installation', () => {
      beforeEach(() => {
        mockFs.access.mockRejectedValue(new Error('ENOENT'));
        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(null, { stdout: 'Success', stderr: '' });
        });
      });

      it('should install Windows service successfully', async () => {
        const result = await manager.install({ enableAfterInstall: true });

        expect(result.success).toBe(true);
        expect(result.platform).toBe('win32');
        expect(result.servicePath).toBe('C:\\test\\project\\.apex\\service-install.ps1');
        expect(mockFs.mkdir).toHaveBeenCalledWith('C:\\test\\project\\.apex', { recursive: true });
        expect(mockFs.writeFile).toHaveBeenCalled();
      });

      it('should handle permission denied errors', async () => {
        mockFs.mkdir.mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));

        await expect(manager.install()).rejects.toThrow(ServiceError);
        await expect(manager.install()).rejects.toThrow('Permission denied creating directory');
      });

      it('should handle service already exists error', async () => {
        mockFs.access.mockResolvedValue(undefined); // File exists

        await expect(manager.install()).rejects.toThrow(ServiceError);
        await expect(manager.install()).rejects.toThrow('Service file already exists');
      });

      it('should overwrite existing service with force option', async () => {
        mockFs.access.mockResolvedValue(undefined); // File exists

        const result = await manager.install({ force: true });

        expect(result.success).toBe(true);
        expect(mockFs.writeFile).toHaveBeenCalled();
      });
    });

    describe('Direct Windows Service Management', () => {
      it('should install service directly using sc.exe', async () => {
        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(null, { stdout: 'Success', stderr: '' });
        });
        mockFs.writeFile.mockResolvedValue(undefined);

        await manager.installWindowsServiceDirect();

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('apex-service-wrapper.bat'),
          expect.any(String),
          'utf-8'
        );
      });

      it('should uninstall service directly using sc.exe', async () => {
        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(null, { stdout: 'Success', stderr: '' });
        });
        mockFs.unlink.mockResolvedValue(undefined);

        await manager.uninstallWindowsServiceDirect();

        expect(mockFs.unlink).toHaveBeenCalled();
      });

      it('should handle install failures', async () => {
        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(new Error('Service creation failed'), null);
        });

        await expect(manager.installWindowsServiceDirect()).rejects.toThrow(ServiceError);
        await expect(manager.installWindowsServiceDirect()).rejects.toThrow('Failed to install Windows service directly');
      });
    });

    describe('Service Status Parsing', () => {
      it('should parse RUNNING service status correctly', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((cmd, callback) => {
          if (cmd.includes('sc query')) {
            (callback as Function)(null, { stdout: 'SERVICE_NAME: apex-daemon\nSTATE: 4  RUNNING\nWIN32_EXIT_CODE: 0', stderr: '' });
          } else if (cmd.includes('sc qc')) {
            (callback as Function)(null, { stdout: 'START_TYPE: 2  AUTO_START', stderr: '' });
          } else if (cmd.includes('wmic')) {
            (callback as Function)(null, { stdout: 'ProcessId=1234', stderr: '' });
          }
        });

        const status = await manager.getServiceStatus();

        expect(status.installed).toBe(true);
        expect(status.running).toBe(true);
        expect(status.enabled).toBe(true);
        expect(status.pid).toBe(1234);
        expect(status.platform).toBe('win32');
      });

      it('should parse STOPPED service status correctly', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((cmd, callback) => {
          if (cmd.includes('sc query')) {
            (callback as Function)(null, { stdout: 'SERVICE_NAME: apex-daemon\nSTATE: 1  STOPPED\nWIN32_EXIT_CODE: 0', stderr: '' });
          } else if (cmd.includes('sc qc')) {
            (callback as Function)(null, { stdout: 'START_TYPE: 3  DEMAND_START', stderr: '' });
          }
        });

        const status = await manager.getServiceStatus();

        expect(status.installed).toBe(true);
        expect(status.running).toBe(false);
        expect(status.enabled).toBe(true);
        expect(status.pid).toBeUndefined();
      });

      it('should parse START_PENDING service status correctly', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((cmd, callback) => {
          if (cmd.includes('sc query')) {
            (callback as Function)(null, { stdout: 'SERVICE_NAME: apex-daemon\nSTATE: 2  START_PENDING\nWIN32_EXIT_CODE: 0', stderr: '' });
          } else if (cmd.includes('sc qc')) {
            (callback as Function)(null, { stdout: 'START_TYPE: 2  AUTO_START', stderr: '' });
          } else if (cmd.includes('wmic')) {
            (callback as Function)(null, { stdout: 'ProcessId=0', stderr: '' });
          }
        });

        const status = await manager.getServiceStatus();

        expect(status.installed).toBe(true);
        expect(status.running).toBe(false); // START_PENDING is not considered running
        expect(status.enabled).toBe(true);
        expect(status.pid).toBeUndefined(); // PID 0 should be filtered out
      });

      it('should parse STOP_PENDING service status correctly', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((cmd, callback) => {
          if (cmd.includes('sc query')) {
            (callback as Function)(null, { stdout: 'SERVICE_NAME: apex-daemon\nSTATE: 3  STOP_PENDING\nWIN32_EXIT_CODE: 0', stderr: '' });
          } else if (cmd.includes('sc qc')) {
            (callback as Function)(null, { stdout: 'START_TYPE: 2  AUTO_START', stderr: '' });
          }
        });

        const status = await manager.getServiceStatus();

        expect(status.installed).toBe(true);
        expect(status.running).toBe(false); // STOP_PENDING means stopping, so not running
        expect(status.enabled).toBe(true);
      });

      it('should handle service not found error', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((_cmd, callback) => {
          const error = new Error('The specified service does not exist') as Error & { stderr: string };
          error.stderr = 'The specified service does not exist as an installed service.';
          (callback as Function)(error, null);
        });

        const status = await manager.getServiceStatus();

        expect(status.installed).toBe(false);
        expect(status.running).toBe(false);
        expect(status.enabled).toBe(false);
      });

      it('should fallback to PowerShell for PID detection when wmic fails', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((cmd, callback) => {
          if (cmd.includes('sc query')) {
            (callback as Function)(null, { stdout: 'SERVICE_NAME: apex-daemon\nSTATE: 4  RUNNING\nWIN32_EXIT_CODE: 0', stderr: '' });
          } else if (cmd.includes('sc qc')) {
            (callback as Function)(null, { stdout: 'START_TYPE: 2  AUTO_START', stderr: '' });
          } else if (cmd.includes('wmic')) {
            (callback as Function)(new Error('wmic failed'), null);
          } else if (cmd.includes('powershell') && cmd.includes('Get-WmiObject')) {
            (callback as Function)(null, { stdout: 'ProcessId\n--------\n   5678\n', stderr: '' });
          }
        });

        const status = await manager.getServiceStatus();

        expect(status.installed).toBe(true);
        expect(status.running).toBe(true);
        expect(status.pid).toBe(5678);
      });

      it('should handle PID detection failures gracefully', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((cmd, callback) => {
          if (cmd.includes('sc query')) {
            (callback as Function)(null, { stdout: 'SERVICE_NAME: apex-daemon\nSTATE: 4  RUNNING\nWIN32_EXIT_CODE: 0', stderr: '' });
          } else if (cmd.includes('sc qc')) {
            (callback as Function)(null, { stdout: 'START_TYPE: 2  AUTO_START', stderr: '' });
          } else if (cmd.includes('wmic') || cmd.includes('powershell')) {
            (callback as Function)(new Error('PID detection failed'), null);
          }
        });

        const status = await manager.getServiceStatus();

        expect(status.installed).toBe(true);
        expect(status.running).toBe(true);
        expect(status.pid).toBeUndefined(); // Should handle PID detection failure gracefully
      });
    });

    describe('Error Handling', () => {
      it('should handle Windows-specific service start errors', async () => {
        const startError = new Error('Service already running') as Error & { stderr: string };
        startError.stderr = 'An instance of the service is already running.';

        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(startError, null);
        });

        // Should not throw error for already running service
        await expect(manager.start()).resolves.not.toThrow();
      });

      it('should handle Windows-specific service stop errors', async () => {
        const stopError = new Error('Service not started') as Error & { stderr: string };
        stopError.stderr = 'The service has not been started.';

        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(stopError, null);
        });

        // Should not throw error for already stopped service
        await expect(manager.stop()).resolves.not.toThrow();
      });

      it('should handle service not found errors correctly', async () => {
        const notFoundError = new Error('Service not found') as Error & { stderr: string };
        notFoundError.stderr = 'The specified service does not exist as an installed service.';

        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(notFoundError, null);
        });

        await expect(manager.start()).rejects.toThrow(ServiceError);
      });

      it('should handle permission denied errors correctly', async () => {
        const permissionError = new Error('Access denied') as Error & { stderr: string };
        permissionError.stderr = 'Access is denied.';

        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(permissionError, null);
        });

        await expect(manager.start()).rejects.toThrow(ServiceError);
      });

      it('should handle PowerShell install failures', async () => {
        const installError = new Error('Service already exists') as Error & { stderr: string };
        installError.stderr = 'The specified service already exists.';

        mockExec.mockImplementation((cmd, callback) => {
          if (cmd.includes('-Install')) {
            (callback as Function)(installError, null);
          } else {
            (callback as Function)(null, { stdout: 'Success', stderr: '' });
          }
        });

        await expect(manager.enable()).rejects.toThrow(ServiceError);
      });

      it('should handle PowerShell uninstall failures', async () => {
        const uninstallError = new Error('Uninstall failed');

        mockExec.mockImplementation((cmd, callback) => {
          if (cmd.includes('-Uninstall')) {
            (callback as Function)(uninstallError, null);
          } else {
            (callback as Function)(null, { stdout: 'Success', stderr: '' });
          }
        });

        await expect(manager.disable()).rejects.toThrow(ServiceError);
      });
    });

    describe('Service Control Operations', () => {
      beforeEach(() => {
        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(null, { stdout: 'SUCCESS', stderr: '' });
        });
      });

      it('should start Windows service correctly', async () => {
        await manager.start();

        expect(mockExec).toHaveBeenCalledWith(
          'sc start "apex-daemon"',
          expect.any(Function)
        );
      });

      it('should stop Windows service correctly', async () => {
        await manager.stop();

        expect(mockExec).toHaveBeenCalledWith(
          'sc stop "apex-daemon"',
          expect.any(Function)
        );
      });

      it('should restart Windows service correctly', async () => {
        await manager.restart();

        expect(mockExec).toHaveBeenCalledWith(
          'sc stop "apex-daemon"',
          expect.any(Function)
        );
        expect(mockExec).toHaveBeenCalledWith(
          'sc start "apex-daemon"',
          expect.any(Function)
        );
      });

      it('should enable Windows service using PowerShell', async () => {
        await manager.enable();

        expect(mockExec).toHaveBeenCalledWith(
          'powershell.exe -ExecutionPolicy Bypass -File "C:\\test\\project\\.apex\\service-install.ps1" -Install',
          expect.any(Function)
        );
      });

      it('should disable Windows service using PowerShell', async () => {
        await manager.disable();

        expect(mockExec).toHaveBeenCalledWith(
          'powershell.exe -ExecutionPolicy Bypass -File "C:\\test\\project\\.apex\\service-install.ps1" -Uninstall',
          expect.any(Function)
        );
      });
    });

    describe('Health Checks', () => {
      it('should perform health check on Windows', async () => {
        // Mock isSupported to return true
        const mockExecSync = vi.fn().mockReturnValue('');
        mockRequire.mockReturnValue({ execSync: mockExecSync });

        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(null, { stdout: 'STATE: 4  RUNNING', stderr: '' });
        });

        const health = await manager.performHealthCheck();

        expect(health.healthy).toBe(true);
        expect(health.errors).toHaveLength(0);
      });

      it('should detect unhealthy service state', async () => {
        // Mock isSupported to return true
        const mockExecSync = vi.fn().mockReturnValue('');
        mockRequire.mockReturnValue({ execSync: mockExecSync });

        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((_cmd, callback) => {
          (callback as Function)(null, { stdout: 'STATE: 1  STOPPED', stderr: '' });
        });

        const health = await manager.performHealthCheck();

        expect(health.healthy).toBe(false);
        expect(health.errors).toContain('Service not running');
      });
    });
  });

  describe('Windows-specific Edge Cases', () => {
    let manager: ServiceManager;

    beforeEach(() => {
      manager = new ServiceManager(baseOptions);
    });

    it('should handle Windows long file paths correctly', () => {
      const longPathOptions = {
        ...baseOptions,
        projectPath: 'C:\\very\\long\\path\\that\\exceeds\\normal\\windows\\path\\limits\\and\\might\\cause\\issues\\with\\some\\apis\\project',
      };

      const longPathManager = new ServiceManager(longPathOptions);
      const serviceFile = longPathManager.generateServiceFile();

      expect(serviceFile.path).toContain('.apex\\service-install.ps1');
      expect(serviceFile.content).toContain('very\\\\long\\\\path');
    });

    it('should handle special characters in Windows paths', () => {
      const specialCharOptions = {
        ...baseOptions,
        projectPath: 'C:\\Program Files (x86)\\My-App_v2.0\\project',
        workingDirectory: 'C:\\Program Files (x86)\\My-App_v2.0\\project',
      };

      const specialCharManager = new ServiceManager(specialCharOptions);
      const serviceFile = specialCharManager.generateServiceFile();

      expect(serviceFile.content).toContain('C:\\\\Program Files (x86)\\\\My-App_v2.0\\\\project');
    });

    it('should handle environment variables with Windows-specific values', () => {
      const windowsEnvOptions = {
        ...baseOptions,
        environment: {
          PATH: 'C:\\Windows\\System32;C:\\Program Files\\nodejs',
          PROGRAMFILES: 'C:\\Program Files',
          USERPROFILE: 'C:\\Users\\testuser',
        },
      };

      const windowsEnvManager = new ServiceManager(windowsEnvOptions);
      const serviceFile = windowsEnvManager.generateServiceFile();

      expect(serviceFile.content).toContain('PATH=C:\\Windows\\System32;C:\\Program Files\\nodejs');
      expect(serviceFile.content).toContain('PROGRAMFILES=C:\\Program Files');
      expect(serviceFile.content).toContain('USERPROFILE=C:\\Users\\testuser');
    });

    it('should handle service names with special characters', () => {
      const specialNameOptions = {
        ...baseOptions,
        serviceName: 'apex-daemon-v2.0_prod',
      };

      const specialNameManager = new ServiceManager(specialNameOptions);
      const serviceFile = specialNameManager.generateServiceFile();

      expect(serviceFile.content).toContain('$serviceName = "apex-daemon-v2.0_prod"');
    });

    it('should handle Windows network drive paths', () => {
      const networkOptions = {
        ...baseOptions,
        projectPath: '\\\\server\\share\\apex\\project',
        workingDirectory: '\\\\server\\share\\apex\\project',
      };

      const networkManager = new ServiceManager(networkOptions);
      const serviceFile = networkManager.generateServiceFile();

      expect(serviceFile.content).toContain('\\\\\\\\server\\\\share\\\\apex\\\\project');
    });
  });
});