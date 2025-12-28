import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { getHomeDir, getConfigDir } from '@apex/core';
import {
  ServiceManager,
  SystemdGenerator,
  LaunchdGenerator,
  WindowsServiceGenerator,
  ServiceError,
  detectPlatform,
  isSystemdAvailable,
  isLaunchdAvailable,
  isWindowsServiceAvailable,
  isNSSMAvailable,
  type ServiceManagerOptions,
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

vi.mock('@apex/core', () => ({
  getHomeDir: vi.fn(() => '/home/user'),
  getConfigDir: vi.fn(() => '/home/user/.config'),
}));

// Mock process for platform detection
const mockProcess = {
  platform: 'linux',
  execPath: '/usr/bin/node',
  env: { HOME: '/home/user', USER: 'testuser' },
  cwd: vi.fn(() => '/test/project'),
  getuid: vi.fn(() => 1000),
};

Object.defineProperty(global, 'process', {
  value: mockProcess,
  writable: true,
});

const mockFs = vi.mocked(fs);
const mockExec = vi.mocked(exec) as MockedFunction<typeof exec>;
const mockGetHomeDir = vi.mocked(getHomeDir);
const mockGetConfigDir = vi.mocked(getConfigDir);

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  // Set default return values that match the old behavior
  mockGetHomeDir.mockReturnValue('/home/user');
  mockGetConfigDir.mockReturnValue('/home/user/.config');
});

describe('ServiceError', () => {
  it('should create ServiceError with correct properties', () => {
    const cause = new Error('Original error');
    const serviceError = new ServiceError('Test error', 'PLATFORM_UNSUPPORTED', cause);

    expect(serviceError.message).toBe('Test error');
    expect(serviceError.code).toBe('PLATFORM_UNSUPPORTED');
    expect(serviceError.cause).toBe(cause);
    expect(serviceError.name).toBe('ServiceError');
    expect(serviceError).toBeInstanceOf(Error);
  });

  it('should create ServiceError without cause', () => {
    const serviceError = new ServiceError('Test error', 'SERVICE_NOT_FOUND');

    expect(serviceError.message).toBe('Test error');
    expect(serviceError.code).toBe('SERVICE_NOT_FOUND');
    expect(serviceError.cause).toBeUndefined();
    expect(serviceError.name).toBe('ServiceError');
  });

  it('should support all error codes', () => {
    const errorCodes = [
      'PLATFORM_UNSUPPORTED',
      'SERVICE_EXISTS',
      'SERVICE_NOT_FOUND',
      'PERMISSION_DENIED',
      'INSTALL_FAILED',
      'UNINSTALL_FAILED',
      'GENERATION_FAILED',
    ];

    errorCodes.forEach(code => {
      const error = new ServiceError(`Test ${code}`, code as any);
      expect(error.code).toBe(code);
    });
  });
});

describe('ServiceManager', () => {
  const defaultOptions: ServiceManagerOptions = {
    projectPath: '/test/project',
    serviceName: 'apex-daemon',
    serviceDescription: 'Test Service',
    user: 'testuser',
    workingDirectory: '/test/project',
    environment: { FOO: 'bar' },
    restartPolicy: 'on-failure',
    restartDelaySeconds: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess.platform = 'linux';
    mockProcess.getuid = vi.fn(() => 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Platform Detection', () => {
    it('should detect Linux platform', () => {
      mockProcess.platform = 'linux';
      expect(detectPlatform()).toBe('linux');
    });

    it('should detect macOS platform', () => {
      mockProcess.platform = 'darwin';
      expect(detectPlatform()).toBe('darwin');
    });

    it('should detect Windows platform', () => {
      mockProcess.platform = 'win32';
      expect(detectPlatform()).toBe('win32');
    });

    it('should detect unsupported platform for other platforms', () => {
      mockProcess.platform = 'freebsd';
      expect(detectPlatform()).toBe('unsupported');
    });

    it('should check systemd availability', () => {
      const execSync = require('child_process').execSync;
      vi.mocked(execSync).mockImplementationOnce(() => 'systemd version');
      expect(isSystemdAvailable()).toBe(true);

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Command not found');
      });
      expect(isSystemdAvailable()).toBe(false);
    });

    it('should check launchd availability', () => {
      mockProcess.platform = 'darwin';
      expect(isLaunchdAvailable()).toBe(true);

      mockProcess.platform = 'linux';
      expect(isLaunchdAvailable()).toBe(false);
    });

    it('should check Windows service availability', () => {
      mockProcess.platform = 'win32';
      const execSync = require('child_process').execSync;

      vi.mocked(execSync).mockImplementationOnce(() => 'SERVICE CONTROL MANAGER');
      expect(isWindowsServiceAvailable()).toBe(true);

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Command not found');
      });
      expect(isWindowsServiceAvailable()).toBe(false);

      mockProcess.platform = 'linux';
      expect(isWindowsServiceAvailable()).toBe(false);
    });

    it('should check NSSM availability', () => {
      mockProcess.platform = 'win32';
      const execSync = require('child_process').execSync;

      vi.mocked(execSync).mockImplementationOnce(() => 'NSSM 2.24');
      expect(isNSSMAvailable()).toBe(true);

      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('nssm is not recognized');
      });
      expect(isNSSMAvailable()).toBe(false);

      mockProcess.platform = 'linux';
      expect(isNSSMAvailable()).toBe(false);
    });
  });

  describe('ServiceManager - Linux', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
    });

    it('should construct with default options', () => {
      const manager = new ServiceManager();
      expect(manager.getPlatform()).toBe('linux');
      expect(manager.isSupported()).toBeDefined();
    });

    it('should generate service file', () => {
      const manager = new ServiceManager(defaultOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.platform).toBe('linux');
      expect(serviceFile.content).toContain('[Unit]');
      expect(serviceFile.content).toContain('[Service]');
      expect(serviceFile.content).toContain('[Install]');
      expect(serviceFile.content).toContain('User=testuser');
      expect(serviceFile.content).toContain('Environment=FOO=bar');
      expect(serviceFile.path).toContain('.config/systemd/user');
    });

    it('should use system path for root user', () => {
      mockProcess.getuid = vi.fn(() => 0);
      const manager = new ServiceManager(defaultOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toContain('/etc/systemd/system');
    });

    it('should install service successfully', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      // Mock exec for systemctl daemon-reload
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.install()).resolves.not.toThrow();

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle install errors', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.install()).rejects.toThrow(ServiceError);
    });

    it('should uninstall service successfully', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      // Mock exec for systemctl commands
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.uninstall()).resolves.not.toThrow();
    });

    it('should get service status', async () => {
      mockFs.access.mockResolvedValue(undefined);

      // Mock systemctl show output
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('systemctl --user show')) {
          const output = 'ActiveState=active\nLoadState=loaded\nMainPID=1234\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const status = await manager.getStatus();

      expect(status.installed).toBe(true);
      expect(status.running).toBe(true);
      expect(status.pid).toBe(1234);
      expect(status.platform).toBe('linux');
    });
  });

  describe('ServiceManager - macOS', () => {
    beforeEach(() => {
      mockProcess.platform = 'darwin';
    });

    it('should construct for macOS platform', () => {
      const manager = new ServiceManager(defaultOptions);
      expect(manager.getPlatform()).toBe('darwin');
      expect(manager.isSupported()).toBe(true);
    });

    it('should generate plist file', () => {
      const manager = new ServiceManager(defaultOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.platform).toBe('darwin');
      expect(serviceFile.content).toContain('<?xml version="1.0"');
      expect(serviceFile.content).toContain('<!DOCTYPE plist');
      expect(serviceFile.content).toContain('<key>Label</key>');
      expect(serviceFile.content).toContain('<string>com.apex.daemon</string>');
      expect(serviceFile.content).toContain('<key>KeepAlive</key>');
      expect(serviceFile.path).toContain('Library/LaunchAgents');
    });

    it('should install plist successfully', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.install()).resolves.not.toThrow();

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should get launchd service status', async () => {
      mockFs.access.mockResolvedValue(undefined);

      // Mock launchctl list output
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('launchctl list')) {
          const output = '1234\t0\tcom.apex.daemon';
          if (callback) callback(null, { stdout: output, stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const status = await manager.getStatus();

      expect(status.installed).toBe(true);
      expect(status.running).toBe(true);
      expect(status.pid).toBe(1234);
      expect(status.platform).toBe('darwin');
    });
  });

  describe('SystemdGenerator', () => {
    const requiredOptions = {
      ...defaultOptions,
      projectPath: '/test/project',
      serviceName: 'apex-daemon',
      serviceDescription: 'Test Service',
      user: 'testuser',
      workingDirectory: '/test/project',
      environment: { FOO: 'bar' },
      restartPolicy: 'on-failure' as const,
      restartDelaySeconds: 5,
    };

    it('should generate valid systemd unit file', () => {
      const generator = new SystemdGenerator(requiredOptions);
      const content = generator.generate();

      expect(content).toContain('[Unit]');
      expect(content).toContain('[Service]');
      expect(content).toContain('[Install]');
      expect(content).toContain('User=testuser');
      expect(content).toContain('Restart=on-failure');
      expect(content).toContain('Environment=FOO=bar');
      expect(content).toContain('ExecStart=/usr/bin/node');
    });

    it('should map restart policies correctly', () => {
      const alwaysGenerator = new SystemdGenerator({
        ...requiredOptions,
        restartPolicy: 'always',
      });
      expect(alwaysGenerator.generate()).toContain('Restart=always');

      const neverGenerator = new SystemdGenerator({
        ...requiredOptions,
        restartPolicy: 'never',
      });
      expect(neverGenerator.generate()).toContain('Restart=no');
    });

    it('should use user-level path for non-root', () => {
      const generator = new SystemdGenerator(requiredOptions);
      const path = generator.getInstallPath();
      expect(path).toContain('.config/systemd/user');
      expect(path).toContain('apex-daemon.service');
    });

    it('should use system-level path for root', () => {
      mockProcess.getuid = vi.fn(() => 0);
      const generator = new SystemdGenerator(requiredOptions);
      const path = generator.getInstallPath();
      expect(path).toContain('/etc/systemd/system');
    });
  });

  describe('LaunchdGenerator', () => {
    const requiredOptions = {
      ...defaultOptions,
      projectPath: '/test/project',
      serviceName: 'apex-daemon',
      serviceDescription: 'Test Service',
      user: 'testuser',
      workingDirectory: '/test/project',
      environment: { FOO: 'bar' },
      restartPolicy: 'on-failure' as const,
      restartDelaySeconds: 5,
    };

    it('should generate valid plist XML', () => {
      const generator = new LaunchdGenerator(requiredOptions);
      const content = generator.generate();

      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain('<!DOCTYPE plist');
      expect(content).toContain('<key>Label</key>');
      expect(content).toContain('<string>com.apex.daemon</string>');
      expect(content).toContain('<key>ProgramArguments</key>');
      expect(content).toContain('<key>KeepAlive</key>');
      expect(content).toContain('<key>FOO</key>');
      expect(content).toContain('<string>bar</string>');
    });

    it('should handle different restart policies', () => {
      const alwaysGenerator = new LaunchdGenerator({
        ...requiredOptions,
        restartPolicy: 'always',
      });
      const alwaysContent = alwaysGenerator.generate();
      expect(alwaysContent).toContain('<key>Crashed</key>');
      expect(alwaysContent).toContain('<true/>');

      const neverGenerator = new LaunchdGenerator({
        ...requiredOptions,
        restartPolicy: 'never',
      });
      const neverContent = neverGenerator.generate();
      expect(neverContent).toContain('<false/>');
    });

    it('should use LaunchAgents path', () => {
      const generator = new LaunchdGenerator(requiredOptions);
      const path = generator.getInstallPath();
      expect(path).toContain('Library/LaunchAgents');
      expect(path).toContain('com.apex.daemon.plist');
    });

    it('should escape XML properly', () => {
      const generator = new LaunchdGenerator({
        ...requiredOptions,
        environment: { 'TEST&VAR': 'value<with>quotes"and\'apostrophes' },
      });
      const content = generator.generate();

      expect(content).toContain('&amp;');
      expect(content).toContain('&lt;');
      expect(content).toContain('&gt;');
      expect(content).toContain('&quot;');
      expect(content).toContain('&apos;');
    });
  });

  describe('ServiceManager - Windows', () => {
    beforeEach(() => {
      mockProcess.platform = 'win32';
    });

    it('should construct for Windows platform', () => {
      const manager = new ServiceManager(defaultOptions);
      expect(manager.getPlatform()).toBe('win32');
      expect(manager.isSupported()).toBeDefined();
    });

    it('should check NSSM support on Windows', () => {
      const execSync = require('child_process').execSync;
      const manager = new ServiceManager(defaultOptions);

      // Mock NSSM available
      vi.mocked(execSync).mockImplementationOnce(() => 'NSSM 2.24');
      expect(manager.isNSSMSupported()).toBe(true);

      // Mock NSSM not available
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('nssm is not recognized');
      });
      expect(manager.isNSSMSupported()).toBe(false);
    });

    it('should generate PowerShell script file', () => {
      const manager = new ServiceManager(defaultOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.platform).toBe('win32');
      expect(serviceFile.content).toContain('# APEX Service Installation Script for Windows');
      expect(serviceFile.content).toContain('param(');
      expect(serviceFile.content).toContain('$Install');
      expect(serviceFile.content).toContain('$Uninstall');
      expect(serviceFile.content).toContain('$UseNSSM');
      expect(serviceFile.content).toContain('Install-ApexService');
      expect(serviceFile.content).toContain('Uninstall-ApexService');
      expect(serviceFile.path).toContain('service-install.ps1');
      expect(serviceFile.path).toContain('.apex');
    });

    it('should install PowerShell script successfully', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.install()).resolves.not.toThrow();

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should get Windows service status', async () => {
      mockFs.access.mockResolvedValue(undefined);

      // Mock sc query output for running service
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('sc query')) {
          const output = 'SERVICE_NAME: apex-daemon\n        TYPE               : 10  WIN32_OWN_PROCESS\n        STATE              : 4  RUNNING';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('sc qc')) {
          const output = 'START_TYPE         : 2   AUTO_START';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('wmic service')) {
          const output = 'ProcessId=1234';
          if (callback) callback(null, { stdout: output, stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const status = await manager.getStatus();

      expect(status.installed).toBe(true);
      expect(status.running).toBe(true);
      expect(status.enabled).toBe(true);
      expect(status.pid).toBe(1234);
      expect(status.platform).toBe('win32');
    });

    it('should handle Windows service operations', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      await expect(manager.enable()).resolves.not.toThrow();
      await expect(manager.disable()).resolves.not.toThrow();
      await expect(manager.start()).resolves.not.toThrow();
      await expect(manager.stop()).resolves.not.toThrow();
      await expect(manager.restart()).resolves.not.toThrow();
    });

    it('should handle Windows restart correctly', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.restart()).resolves.not.toThrow();

      // Should call both stop and start for Windows
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('sc stop'),
        expect.any(Function)
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('sc start'),
        expect.any(Function)
      );
    });

    it('should install and enable service when enableAfterInstall is true', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.install({ enableAfterInstall: true });

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.platform).toBe('win32');
    });

    it('should install with enableOnBoot option', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.install({ enableOnBoot: true });

      expect(result.success).toBe(true);
      expect(result.platform).toBe('win32');

      // Check that the service file contains enableOnBoot configuration
      const serviceFile = manager.generateServiceFile();
      expect(serviceFile.content).toContain('$enableOnBoot = $true');
    });
  });

  describe('Unsupported Platform', () => {
    beforeEach(() => {
      mockProcess.platform = 'freebsd';
    });

    it('should throw error for unsupported platform', () => {
      const manager = new ServiceManager(defaultOptions);
      expect(manager.getPlatform()).toBe('unsupported');
      expect(manager.isSupported()).toBe(false);

      expect(() => manager.generateServiceFile()).toThrow(ServiceError);
      expect(() => manager.getServiceFilePath()).toThrow(ServiceError);
    });

    it('should reject operations on unsupported platform', async () => {
      const manager = new ServiceManager(defaultOptions);

      await expect(manager.install()).rejects.toThrow(ServiceError);
      await expect(manager.start()).resolves.not.toThrow(); // Should not throw but do nothing
      await expect(manager.getStatus()).resolves.toMatchObject({
        installed: false,
        enabled: false,
        running: false,
        platform: 'unsupported',
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
    });

    it('should handle file system errors during install', async () => {
      const manager = new ServiceManager(defaultOptions);
      mockFs.mkdir.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(manager.install()).rejects.toThrow(ServiceError);
    });

    it('should handle command execution errors', async () => {
      const manager = new ServiceManager(defaultOptions);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) {
          const error = new Error('Command failed') as Error & { stderr?: string };
          error.stderr = 'systemctl: command not found';
          callback(error);
        }
        return {} as any;
      });

      await expect(manager.start()).rejects.toThrow(ServiceError);
    });

    it('should handle missing service file gracefully', async () => {
      const manager = new ServiceManager(defaultOptions);
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));

      const status = await manager.getStatus();
      expect(status.installed).toBe(false);
    });
  });

  describe('Service Operations', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';

      // Mock successful exec calls by default
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });
    });

    it('should enable service', async () => {
      const manager = new ServiceManager(defaultOptions);
      await expect(manager.enable()).resolves.not.toThrow();
    });

    it('should disable service', async () => {
      const manager = new ServiceManager(defaultOptions);
      await expect(manager.disable()).resolves.not.toThrow();
    });

    it('should start service', async () => {
      const manager = new ServiceManager(defaultOptions);
      await expect(manager.start()).resolves.not.toThrow();
    });

    it('should stop service', async () => {
      const manager = new ServiceManager(defaultOptions);
      await expect(manager.stop()).resolves.not.toThrow();
    });

    it('should restart service', async () => {
      const manager = new ServiceManager(defaultOptions);
      await expect(manager.restart()).resolves.not.toThrow();
    });
  });

  describe('macOS-specific Operations', () => {
    beforeEach(() => {
      mockProcess.platform = 'darwin';

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });
    });

    it('should handle macOS restart correctly', async () => {
      const manager = new ServiceManager(defaultOptions);
      await expect(manager.restart()).resolves.not.toThrow();

      // Should call both stop and start for macOS
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('launchctl stop'),
        expect.any(Function)
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('launchctl start'),
        expect.any(Function)
      );
    });

    it('should use correct launchd label format', async () => {
      const manager = new ServiceManager(defaultOptions);
      await manager.start();

      expect(mockExec).toHaveBeenCalledWith(
        'launchctl start com.apex.daemon',
        expect.any(Function)
      );
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
    });

    it('should handle path utility errors gracefully', () => {
      mockGetConfigDir.mockImplementationOnce(() => {
        throw new Error('Unable to determine config directory');
      });

      const manager = new ServiceManager(defaultOptions);

      expect(() => {
        manager.generateServiceFile();
      }).toThrow('Unable to determine config directory');
    });

    it('should handle missing USER environment variable', () => {
      const originalUser = mockProcess.env.USER;
      delete mockProcess.env.USER;

      const manager = new ServiceManager();
      expect(manager.getPlatform()).toBeDefined();

      mockProcess.env.USER = originalUser;
    });

    it('should handle empty environment variables', () => {
      const options = {
        ...defaultOptions,
        environment: {},
      };
      const manager = new ServiceManager(options);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.content).toContain('Environment=NODE_ENV=production');
    });

    it('should handle service name with special characters', () => {
      const options = {
        ...defaultOptions,
        serviceName: 'apex-dev-v1.0',
      };
      const manager = new ServiceManager(options);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toContain('apex-dev-v1.0.service');
    });

    it('should handle very long paths', () => {
      const longPath = '/very/long/project/path/that/exceeds/normal/filesystem/limits/and/tests/edge/cases/in/path/handling';
      const options = {
        ...defaultOptions,
        projectPath: longPath,
      };
      const manager = new ServiceManager(options);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.content).toContain(`APEX_PROJECT_PATH=${longPath}`);
    });

    it('should handle concurrent service operations gracefully', async () => {
      const manager = new ServiceManager(defaultOptions);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockExec.mockImplementation((command: string, callback?: any) => {
        setTimeout(() => {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }, 10);
        return {} as any;
      });

      // Run multiple operations concurrently
      const promises = [
        manager.start(),
        manager.stop(),
        manager.restart(),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
    });

    it('should handle full service lifecycle', async () => {
      const manager = new ServiceManager(defaultOptions);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: 'ActiveState=active\nLoadState=loaded\nMainPID=1234\n', stderr: '' });
        return {} as any;
      });

      // Full lifecycle: install -> enable -> start -> status -> stop -> disable -> uninstall
      await expect(manager.install()).resolves.not.toThrow();
      await expect(manager.enable()).resolves.not.toThrow();
      await expect(manager.start()).resolves.not.toThrow();

      const status = await manager.getStatus();
      expect(status.running).toBe(true);

      await expect(manager.stop()).resolves.not.toThrow();
      await expect(manager.disable()).resolves.not.toThrow();
      await expect(manager.uninstall()).resolves.not.toThrow();
    });

    it('should handle service recovery after crash', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const manager = new ServiceManager({
        ...defaultOptions,
        restartPolicy: 'always',
      });

      // Simulate crashed service
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('systemctl --user show')) {
          if (callback) callback(null, { stdout: 'ActiveState=failed\nLoadState=loaded\nMainPID=0\n', stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const status = await manager.getStatus();
      expect(status.running).toBe(false);

      // Restart should work
      await expect(manager.restart()).resolves.not.toThrow();
    });

    it('should handle permission denied scenarios gracefully', async () => {
      const manager = new ServiceManager(defaultOptions);

      const permissionError = new Error('Permission denied') as Error & { stderr?: string };
      permissionError.stderr = 'systemctl: permission denied';

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(permissionError);
        return {} as any;
      });

      await expect(manager.start()).rejects.toThrow(ServiceError);
      await expect(manager.start()).rejects.toThrow(/permission denied/i);
    });
  });

  describe('WindowsServiceGenerator', () => {
    const requiredOptions = {
      ...defaultOptions,
      projectPath: 'C:\\test\\project',
      serviceName: 'apex-daemon',
      serviceDescription: 'Test Service',
      user: 'testuser',
      workingDirectory: 'C:\\test\\project',
      environment: { FOO: 'bar', PATH_VAR: 'C:\\some\\path' },
      restartPolicy: 'on-failure' as const,
      restartDelaySeconds: 5,
    };

    beforeEach(() => {
      mockProcess.platform = 'win32';
      mockProcess.execPath = 'C:\\Program Files\\nodejs\\node.exe';
    });

    it('should generate valid PowerShell script', () => {
      const generator = new WindowsServiceGenerator(requiredOptions);
      const content = generator.generate();

      expect(content).toContain('# APEX Service Installation Script for Windows');
      expect(content).toContain('param(');
      expect(content).toContain('[Parameter(Mandatory=$false)]');
      expect(content).toContain('[switch]$Install');
      expect(content).toContain('[switch]$Uninstall');
      expect(content).toContain('[switch]$UseNSSM = $true');
      expect(content).toContain('$serviceName = "apex-daemon"');
      expect(content).toContain('$serviceDisplayName = "Test Service"');
      expect(content).toContain('$nodePath = "C:\\\\Program Files\\\\nodejs\\\\node.exe"');
      expect(content).toContain('function Install-ApexService');
      expect(content).toContain('function Uninstall-ApexService');
    });

    it('should handle NSSM installation path', () => {
      const generator = new WindowsServiceGenerator(requiredOptions);
      const content = generator.generate();

      expect(content).toContain('if ($UseNSSM -and (Get-Command "nssm" -ErrorAction SilentlyContinue))');
      expect(content).toContain('& nssm install $serviceName $nodePath');
      expect(content).toContain('& nssm set $serviceName DisplayName "$serviceDisplayName"');
      expect(content).toContain('& nssm set $serviceName AppDirectory "$workingDirectory"');
      expect(content).toContain('& nssm set $serviceName AppEnvironmentExtra "NODE_ENV=production"');
    });

    it('should handle fallback to sc.exe when NSSM not available', () => {
      const generator = new WindowsServiceGenerator(requiredOptions);
      const content = generator.generate();

      expect(content).toContain('Write-Warning "NSSM not available. Using basic service creation.');
      expect(content).toContain('$wrapperScript = @"');
      expect(content).toContain('& sc.exe create $serviceName binPath=');
      expect(content).toContain('& sc.exe description $serviceName');
    });

    it('should map restart policies correctly for NSSM', () => {
      const alwaysGenerator = new WindowsServiceGenerator({
        ...requiredOptions,
        restartPolicy: 'always',
      });
      expect(alwaysGenerator.generate()).toContain('AppExit Default Restart');

      const neverGenerator = new WindowsServiceGenerator({
        ...requiredOptions,
        restartPolicy: 'never',
      });
      expect(neverGenerator.generate()).toContain('AppExit Default Exit');

      const onFailureGenerator = new WindowsServiceGenerator({
        ...requiredOptions,
        restartPolicy: 'on-failure',
      });
      expect(onFailureGenerator.generate()).toContain('AppExit Default Restart');
    });

    it('should handle environment variables for NSSM', () => {
      const generator = new WindowsServiceGenerator({
        ...requiredOptions,
        environment: { VAR1: 'value1', VAR2: 'value2', COMPLEX_VAR: 'value with spaces' },
      });
      const content = generator.generate();

      expect(content).toContain('& nssm set $serviceName AppEnvironmentExtra "VAR1=value1"');
      expect(content).toContain('& nssm set $serviceName AppEnvironmentExtra "VAR2=value2"');
      expect(content).toContain('& nssm set $serviceName AppEnvironmentExtra "COMPLEX_VAR=value with spaces"');
    });

    it('should handle environment variables for batch script fallback', () => {
      const generator = new WindowsServiceGenerator({
        ...requiredOptions,
        environment: { VAR1: 'value1', VAR2: 'value2' },
      });
      const content = generator.generate();

      expect(content).toContain('set VAR1=value1');
      expect(content).toContain('set VAR2=value2');
    });

    it('should handle enableOnBoot option', () => {
      const generator = new WindowsServiceGenerator(requiredOptions, true);
      const content = generator.generate();

      expect(content).toContain('$enableOnBoot = $true');
      expect(content).toContain('if ($enableOnBoot)');
      expect(content).toContain('& nssm set $serviceName Start SERVICE_AUTO_START');
      expect(content).toContain('} else {');
      expect(content).toContain('& nssm set $serviceName Start SERVICE_DEMAND_START');
    });

    it('should handle restart delay configuration', () => {
      const generator = new WindowsServiceGenerator({
        ...requiredOptions,
        restartDelaySeconds: 30,
      });
      const content = generator.generate();

      expect(content).toContain('& nssm set $serviceName AppRestartDelay 30000'); // Should be in milliseconds
    });

    it('should use project .apex directory for install path', () => {
      const generator = new WindowsServiceGenerator(requiredOptions);
      const path = generator.getInstallPath();
      expect(path).toBe('C:\\test\\project\\.apex\\service-install.ps1');
    });

    it('should handle log file configuration', () => {
      const generator = new WindowsServiceGenerator(requiredOptions);
      const content = generator.generate();

      expect(content).toContain('$logDir = Join-Path "C:\\\\test\\\\project" ".apex"');
      expect(content).toContain('if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force }');
      expect(content).toContain('& nssm set $serviceName AppStdout (Join-Path $logDir "daemon.out.log")');
      expect(content).toContain('& nssm set $serviceName AppStderr (Join-Path $logDir "daemon.err.log")');
    });

    it('should handle Windows path escaping', () => {
      const generator = new WindowsServiceGenerator({
        ...requiredOptions,
        projectPath: 'C:\\Program Files\\My App\\project',
        workingDirectory: 'C:\\Program Files\\My App\\project',
      });
      const content = generator.generate();

      expect(content).toContain('$workingDirectory = "C:\\\\Program Files\\\\My App\\\\project"');
      expect(content).toContain('"APEX_PROJECT_PATH=C:\\\\Program Files\\\\My App\\\\project"');
    });

    it('should handle service uninstallation', () => {
      const generator = new WindowsServiceGenerator(requiredOptions);
      const content = generator.generate();

      expect(content).toContain('function Uninstall-ApexService');
      expect(content).toContain('$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue');
      expect(content).toContain('if ($service -and $service.Status -eq "Running")');
      expect(content).toContain('Stop-Service -Name $serviceName -Force');
      expect(content).toContain('& nssm remove $serviceName confirm');
      expect(content).toContain('& sc.exe delete $serviceName');
    });

    it('should handle CLI path resolution fallbacks', () => {
      const originalResolve = require.resolve;
      require.resolve = vi.fn().mockImplementation((path) => {
        if (path === '@apex/cli/dist/index.js') {
          throw new Error('Module not found');
        }
        return originalResolve(path);
      });

      // Mock fs.accessSync to simulate file not found
      const originalAccessSync = require('fs').accessSync;
      require('fs').accessSync = vi.fn().mockImplementation(() => {
        throw new Error('ENOENT: file not found');
      });

      const generator = new WindowsServiceGenerator(requiredOptions);
      const content = generator.generate();

      expect(content).toContain('$apexCliPath = "');

      require.resolve = originalResolve;
      require('fs').accessSync = originalAccessSync;
    });

    it('should handle empty environment variables', () => {
      const generator = new WindowsServiceGenerator({
        ...requiredOptions,
        environment: {},
      });
      const content = generator.generate();

      // Should still contain NODE_ENV and APEX_PROJECT_PATH
      expect(content).toContain('& nssm set $serviceName AppEnvironmentExtra "NODE_ENV=production"');
      expect(content).toContain('"APEX_PROJECT_PATH=C:\\\\test\\\\project"');
    });

    it('should handle different restart delay values', () => {
      const generator = new WindowsServiceGenerator({
        ...requiredOptions,
        restartDelaySeconds: 0,
      });
      const content = generator.generate();
      expect(content).toContain('& nssm set $serviceName AppRestartDelay 0');

      const generator2 = new WindowsServiceGenerator({
        ...requiredOptions,
        restartDelaySeconds: 3600,
      });
      const content2 = generator2.generate();
      expect(content2).toContain('& nssm set $serviceName AppRestartDelay 3600000');
    });

    it('should include main execution logic', () => {
      const generator = new WindowsServiceGenerator(requiredOptions);
      const content = generator.generate();

      expect(content).toContain('# Main execution');
      expect(content).toContain('if ($Install) {');
      expect(content).toContain('Install-ApexService');
      expect(content).toContain('} elseif ($Uninstall) {');
      expect(content).toContain('Uninstall-ApexService');
      expect(content).toContain('} else {');
      expect(content).toContain('Write-Host "Usage: .\\service-install.ps1 -Install or .\\service-install.ps1 -Uninstall"');
      expect(content).toContain('Write-Host "Optional: Add -UseNSSM:$false to use basic Windows service manager"');
    });
  });

  describe('Platform-specific Generator Edge Cases', () => {
    const requiredOptions = {
      ...defaultOptions,
      projectPath: '/test/project',
      serviceName: 'apex-daemon',
      serviceDescription: 'Test Service',
      user: 'testuser',
      workingDirectory: '/test/project',
      environment: { FOO: 'bar', COMPLEX_VAR: 'value with spaces and "quotes"' },
      restartPolicy: 'on-failure' as const,
      restartDelaySeconds: 5,
    };

    describe('SystemdGenerator Edge Cases', () => {
      it('should handle CLI path resolution fallbacks', () => {
        const originalResolve = require.resolve;
        require.resolve = vi.fn().mockImplementation((path) => {
          if (path === '@apex/cli/dist/index.js') {
            throw new Error('Module not found');
          }
          return originalResolve(path);
        });

        // Mock fs.accessSync to simulate file not found
        const originalAccessSync = require('fs').accessSync;
        require('fs').accessSync = vi.fn().mockImplementation(() => {
          throw new Error('ENOENT: file not found');
        });

        const generator = new SystemdGenerator(requiredOptions);
        const content = generator.generate();

        expect(content).toContain('ExecStart=/usr/bin/node');

        require.resolve = originalResolve;
        require('fs').accessSync = originalAccessSync;
      });

      it('should handle complex environment variables', () => {
        const generator = new SystemdGenerator({
          ...requiredOptions,
          environment: {
            VAR1: 'simple',
            VAR2: 'with spaces',
            VAR3: 'with=equals',
            VAR4: 'with\nnewlines',
          },
        });
        const content = generator.generate();

        expect(content).toContain('Environment=VAR1=simple');
        expect(content).toContain('Environment=VAR2=with spaces');
        expect(content).toContain('Environment=VAR3=with=equals');
      });

      it('should handle different restart delay values', () => {
        const generator = new SystemdGenerator({
          ...requiredOptions,
          restartDelaySeconds: 0,
        });
        const content = generator.generate();
        expect(content).toContain('RestartSec=0');

        const generator2 = new SystemdGenerator({
          ...requiredOptions,
          restartDelaySeconds: 3600,
        });
        const content2 = generator2.generate();
        expect(content2).toContain('RestartSec=3600');
      });
    });

    describe('LaunchdGenerator Edge Cases', () => {
      beforeEach(() => {
        mockProcess.platform = 'darwin';
      });

      it('should handle complex data types in plist', () => {
        const generator = new LaunchdGenerator({
          ...requiredOptions,
          environment: {
            STRING_VAR: 'test',
            NUMERIC_VAR: '123',
            BOOLEAN_VAR: 'true',
            EMPTY_VAR: '',
          },
        });
        const content = generator.generate();

        expect(content).toContain('<key>STRING_VAR</key>');
        expect(content).toContain('<string>test</string>');
        expect(content).toContain('<key>NUMERIC_VAR</key>');
        expect(content).toContain('<string>123</string>');
      });

      it('should handle different throttle intervals', () => {
        const generator = new LaunchdGenerator({
          ...requiredOptions,
          restartDelaySeconds: 30,
        });
        const content = generator.generate();

        expect(content).toContain('<key>ThrottleInterval</key>');
        expect(content).toContain('<integer>30</integer>');
      });

      it('should handle service names with special patterns', () => {
        const generator = new LaunchdGenerator({
          ...requiredOptions,
          serviceName: 'apex-custom-service-v2',
        });
        const label = generator.getInstallPath();

        expect(label).toContain('com.apex.custom-service-v2.plist');
      });

      it('should handle nested objects in plist generation', () => {
        // Test the private plist generation with nested structures
        const generator = new LaunchdGenerator(requiredOptions);
        const content = generator.generate();

        // Should handle KeepAlive object structure
        expect(content).toContain('<key>KeepAlive</key>');
        expect(content).toContain('<dict>');
        expect(content).toContain('<key>SuccessfulExit</key>');
        expect(content).toContain('<false/>');
      });

      it('should handle array values in program arguments', () => {
        const generator = new LaunchdGenerator(requiredOptions);
        const content = generator.generate();

        expect(content).toContain('<key>ProgramArguments</key>');
        expect(content).toContain('<array>');
        expect(content).toContain('<string>/usr/bin/node</string>');
        expect(content).toContain('<string>daemon</string>');
        expect(content).toContain('<string>start</string>');
        expect(content).toContain('<string>--foreground</string>');
      });
    });
  });

  describe('Service Status Parsing Edge Cases', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
      mockFs.access.mockResolvedValue(undefined);
    });

    it('should handle malformed systemctl output', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('systemctl --user show')) {
          // Malformed output missing equals signs
          const output = 'ActiveState\nLoadState=loaded\nMainPID';
          if (callback) callback(null, { stdout: output, stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const status = await manager.getStatus();

      expect(status.installed).toBe(true);
      expect(status.running).toBe(false); // Should default to false for malformed data
    });

    it('should handle systemctl command failure', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('systemctl --user show')) {
          if (callback) callback(new Error('Unit not found'));
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const status = await manager.getStatus();

      expect(status.installed).toBe(true);
      expect(status.enabled).toBe(false);
      expect(status.running).toBe(false);
    });

    it('should handle different MainPID values', async () => {
      const testCases = [
        { pid: '0', expectedPid: undefined },
        { pid: '1234', expectedPid: 1234 },
        { pid: '', expectedPid: undefined },
        { pid: 'invalid', expectedPid: undefined },
      ];

      for (const { pid, expectedPid } of testCases) {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('systemctl --user show')) {
            const output = `ActiveState=active\nLoadState=loaded\nMainPID=${pid}\n`;
            if (callback) callback(null, { stdout: output, stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        const status = await manager.getStatus();

        expect(status.pid).toBe(expectedPid);
      }
    });
  });

  describe('macOS Status Parsing Edge Cases', () => {
    beforeEach(() => {
      mockProcess.platform = 'darwin';
      mockFs.access.mockResolvedValue(undefined);
    });

    it('should handle different launchctl list formats', async () => {
      const testCases = [
        { output: '1234\t0\tcom.apex.daemon', expectedPid: 1234, expectedRunning: true },
        { output: '-\t0\tcom.apex.daemon', expectedPid: undefined, expectedRunning: false },
        { output: '0\t1\tcom.apex.daemon', expectedPid: undefined, expectedRunning: false },
        { output: 'invalid format', expectedPid: undefined, expectedRunning: false },
        { output: '', expectedPid: undefined, expectedRunning: false },
      ];

      for (const { output, expectedPid, expectedRunning } of testCases) {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('launchctl list')) {
            if (callback) callback(null, { stdout: output, stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        const status = await manager.getStatus();

        expect(status.pid).toBe(expectedPid);
        expect(status.running).toBe(expectedRunning);
      }
    });

    it('should handle launchctl command failure', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('launchctl list')) {
          if (callback) callback(new Error('Service not found'));
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const status = await manager.getStatus();

      expect(status.installed).toBe(true);
      expect(status.enabled).toBe(false);
      expect(status.running).toBe(false);
    });
  });

  describe('Windows Status Parsing Edge Cases', () => {
    beforeEach(() => {
      mockProcess.platform = 'win32';
      mockFs.access.mockResolvedValue(undefined);
    });

    it('should handle different sc query output formats', async () => {
      const testCases = [
        {
          queryOutput: 'SERVICE_NAME: apex-daemon\n        STATE              : 4  RUNNING',
          configOutput: 'START_TYPE         : 2   AUTO_START',
          wmicOutput: 'ProcessId=1234',
          expectedRunning: true,
          expectedEnabled: true,
          expectedPid: 1234,
        },
        {
          queryOutput: 'SERVICE_NAME: apex-daemon\n        STATE              : 1  STOPPED',
          configOutput: 'START_TYPE         : 3   DEMAND_START',
          wmicOutput: 'ProcessId=0',
          expectedRunning: false,
          expectedEnabled: false,
          expectedPid: undefined,
        },
        {
          queryOutput: 'SERVICE_NAME: apex-daemon\n        STATE              : 2  START_PENDING',
          configOutput: 'START_TYPE         : 2   AUTO_START',
          wmicOutput: 'ProcessId=5678',
          expectedRunning: false, // START_PENDING is not considered running
          expectedEnabled: true,
          expectedPid: 5678,
        },
        {
          queryOutput: 'SERVICE_NAME: apex-daemon\n        STATE              : 3  STOP_PENDING',
          configOutput: 'START_TYPE         : 4   DISABLED',
          wmicOutput: '',
          expectedRunning: false,
          expectedEnabled: false,
          expectedPid: undefined,
        },
      ];

      for (const { queryOutput, configOutput, wmicOutput, expectedRunning, expectedEnabled, expectedPid } of testCases) {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc query')) {
            if (callback) callback(null, { stdout: queryOutput, stderr: '' });
          } else if (command.includes('sc qc')) {
            if (callback) callback(null, { stdout: configOutput, stderr: '' });
          } else if (command.includes('wmic service')) {
            if (callback) callback(null, { stdout: wmicOutput, stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        const status = await manager.getStatus();

        expect(status.running).toBe(expectedRunning);
        expect(status.enabled).toBe(expectedEnabled);
        expect(status.pid).toBe(expectedPid);
      }
    });

    it('should handle sc query command failure', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('sc query')) {
          if (callback) callback(new Error('Service not found'));
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const status = await manager.getStatus();

      expect(status.installed).toBe(true);
      expect(status.enabled).toBe(false);
      expect(status.running).toBe(false);
    });

    it('should handle sc qc config command failure', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('sc query')) {
          const output = 'SERVICE_NAME: apex-daemon\n        STATE              : 4  RUNNING';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('sc qc')) {
          if (callback) callback(new Error('Access denied'));
        } else if (command.includes('wmic service')) {
          const output = 'ProcessId=1234';
          if (callback) callback(null, { stdout: output, stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const status = await manager.getStatus();

      expect(status.running).toBe(true);
      expect(status.enabled).toBe(false); // Should default to false when config can't be read
      expect(status.pid).toBe(1234);
    });

    it('should handle wmic command failure gracefully', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('sc query')) {
          const output = 'SERVICE_NAME: apex-daemon\n        STATE              : 4  RUNNING';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('sc qc')) {
          const output = 'START_TYPE         : 2   AUTO_START';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('wmic service')) {
          if (callback) callback(new Error('WMI service unavailable'));
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const status = await manager.getStatus();

      expect(status.running).toBe(true);
      expect(status.enabled).toBe(true);
      expect(status.pid).toBeUndefined(); // Should be undefined when wmic fails
    });

    it('should handle malformed wmic output', async () => {
      const testCases = [
        { wmicOutput: 'ProcessId=0', expectedPid: undefined }, // PID 0 means not actually running
        { wmicOutput: 'ProcessId=invalid', expectedPid: undefined },
        { wmicOutput: 'SomethingElse=1234', expectedPid: undefined },
        { wmicOutput: '', expectedPid: undefined },
        { wmicOutput: 'ProcessId=', expectedPid: undefined },
      ];

      for (const { wmicOutput, expectedPid } of testCases) {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc query')) {
            const output = 'SERVICE_NAME: apex-daemon\n        STATE              : 4  RUNNING';
            if (callback) callback(null, { stdout: output, stderr: '' });
          } else if (command.includes('sc qc')) {
            const output = 'START_TYPE         : 2   AUTO_START';
            if (callback) callback(null, { stdout: output, stderr: '' });
          } else if (command.includes('wmic service')) {
            if (callback) callback(null, { stdout: wmicOutput, stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        const status = await manager.getStatus();

        expect(status.pid).toBe(expectedPid);
      }
    });

    it('should handle different Windows service state strings', async () => {
      const testCases = [
        { state: 'RUNNING', expectedRunning: true },
        { state: 'STOPPED', expectedRunning: false },
        { state: 'START_PENDING', expectedRunning: false },
        { state: 'STOP_PENDING', expectedRunning: false },
        { state: 'CONTINUE_PENDING', expectedRunning: false },
        { state: 'PAUSE_PENDING', expectedRunning: false },
        { state: 'PAUSED', expectedRunning: false },
        { state: 'UNKNOWN_STATE', expectedRunning: false },
      ];

      for (const { state, expectedRunning } of testCases) {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc query')) {
            const output = `SERVICE_NAME: apex-daemon\n        STATE              : 4  ${state}`;
            if (callback) callback(null, { stdout: output, stderr: '' });
          } else if (command.includes('sc qc')) {
            const output = 'START_TYPE         : 2   AUTO_START';
            if (callback) callback(null, { stdout: output, stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        const status = await manager.getStatus();

        expect(status.running).toBe(expectedRunning);
      }
    });

    it('should handle different Windows service startup types', async () => {
      const testCases = [
        { startType: 'AUTO_START', expectedEnabled: true },
        { startType: 'DEMAND_START', expectedEnabled: false },
        { startType: 'DISABLED', expectedEnabled: false },
        { startType: 'BOOT_START', expectedEnabled: true },
        { startType: 'SYSTEM_START', expectedEnabled: true },
        { startType: 'UNKNOWN_START', expectedEnabled: false },
      ];

      for (const { startType, expectedEnabled } of testCases) {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc query')) {
            const output = 'SERVICE_NAME: apex-daemon\n        STATE              : 1  STOPPED';
            if (callback) callback(null, { stdout: output, stderr: '' });
          } else if (command.includes('sc qc')) {
            const output = `START_TYPE         : 2   ${startType}`;
            if (callback) callback(null, { stdout: output, stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        const status = await manager.getStatus();

        expect(status.enabled).toBe(expectedEnabled);
      }
    });
  });

  describe('Windows Direct Service Management Methods', () => {
    beforeEach(() => {
      mockProcess.platform = 'win32';
    });

    describe('installWindowsServiceDirect', () => {
      it('should install Windows service directly using sc.exe', async () => {
        mockFs.writeFile.mockResolvedValue(undefined);
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (callback) callback(null, { stdout: '', stderr: '' });
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.installWindowsServiceDirect()).resolves.not.toThrow();

        // Should create wrapper script
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('apex-service-wrapper.bat'),
          expect.stringContaining('@echo off'),
          'utf-8'
        );

        // Should call sc create with correct parameters
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('sc create "apex-daemon"'),
          expect.any(Function)
        );

        // Should set service description
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('sc description "apex-daemon"'),
          expect.any(Function)
        );
      });

      it('should install with auto start when enableOnBoot is true', async () => {
        mockFs.writeFile.mockResolvedValue(undefined);
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (callback) callback(null, { stdout: '', stderr: '' });
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        manager.setEnableOnBoot(true);
        await manager.installWindowsServiceDirect();

        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('start= auto'),
          expect.any(Function)
        );
      });

      it('should install with demand start when enableOnBoot is false', async () => {
        mockFs.writeFile.mockResolvedValue(undefined);
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (callback) callback(null, { stdout: '', stderr: '' });
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        manager.setEnableOnBoot(false);
        await manager.installWindowsServiceDirect();

        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('start= demand'),
          expect.any(Function)
        );
      });

      it('should include environment variables in wrapper script', async () => {
        mockFs.writeFile.mockResolvedValue(undefined);
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (callback) callback(null, { stdout: '', stderr: '' });
          return {} as any;
        });

        const manager = new ServiceManager({
          ...defaultOptions,
          environment: { TEST_VAR: 'test_value', ANOTHER_VAR: 'another_value' },
        });

        await manager.installWindowsServiceDirect();

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.anything(),
          expect.stringMatching(/set TEST_VAR=test_value/),
          'utf-8'
        );
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.anything(),
          expect.stringMatching(/set ANOTHER_VAR=another_value/),
          'utf-8'
        );
      });

      it('should throw error on non-Windows platform', async () => {
        mockProcess.platform = 'linux';
        const manager = new ServiceManager(defaultOptions);

        await expect(manager.installWindowsServiceDirect()).rejects.toThrow(ServiceError);
        await expect(manager.installWindowsServiceDirect()).rejects.toThrow(/Direct Windows service install only available on Windows/);
      });

      it('should handle sc create command failure', async () => {
        mockFs.writeFile.mockResolvedValue(undefined);
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc create')) {
            const error = new Error('Access denied') as Error & { stderr?: string };
            error.stderr = 'Access denied';
            if (callback) callback(error);
          } else {
            if (callback) callback(null, { stdout: '', stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.installWindowsServiceDirect()).rejects.toThrow(ServiceError);
        await expect(manager.installWindowsServiceDirect()).rejects.toThrow(/Failed to install Windows service directly/);
      });

      it('should handle wrapper script creation failure', async () => {
        mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.installWindowsServiceDirect()).rejects.toThrow(ServiceError);
        await expect(manager.installWindowsServiceDirect()).rejects.toThrow(/Failed to install Windows service directly/);
      });
    });

    describe('uninstallWindowsServiceDirect', () => {
      it('should uninstall Windows service directly using sc.exe', async () => {
        mockFs.unlink.mockResolvedValue(undefined);
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (callback) callback(null, { stdout: '', stderr: '' });
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.uninstallWindowsServiceDirect()).resolves.not.toThrow();

        // Should call sc delete
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('sc delete "apex-daemon"'),
          expect.any(Function)
        );

        // Should clean up wrapper script
        expect(mockFs.unlink).toHaveBeenCalledWith(
          expect.stringContaining('apex-service-wrapper.bat')
        );
      });

      it('should stop service before uninstalling', async () => {
        mockFs.unlink.mockResolvedValue(undefined);
        let stopCalled = false;

        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc stop')) {
            stopCalled = true;
          }
          if (callback) callback(null, { stdout: '', stderr: '' });
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await manager.uninstallWindowsServiceDirect();

        expect(stopCalled).toBe(true);
      });

      it('should continue with uninstall even if stop fails', async () => {
        mockFs.unlink.mockResolvedValue(undefined);
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc stop')) {
            const error = new Error('Service not running');
            if (callback) callback(error);
          } else {
            if (callback) callback(null, { stdout: '', stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.uninstallWindowsServiceDirect()).resolves.not.toThrow();
      });

      it('should continue with cleanup even if wrapper script removal fails', async () => {
        mockFs.unlink.mockRejectedValue(new Error('File not found'));
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (callback) callback(null, { stdout: '', stderr: '' });
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.uninstallWindowsServiceDirect()).resolves.not.toThrow();
      });

      it('should throw error on non-Windows platform', async () => {
        mockProcess.platform = 'linux';
        const manager = new ServiceManager(defaultOptions);

        await expect(manager.uninstallWindowsServiceDirect()).rejects.toThrow(ServiceError);
        await expect(manager.uninstallWindowsServiceDirect()).rejects.toThrow(/Direct Windows service uninstall only available on Windows/);
      });

      it('should handle sc delete command failure', async () => {
        mockFs.unlink.mockResolvedValue(undefined);
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc delete')) {
            const error = new Error('Service not found') as Error & { stderr?: string };
            error.stderr = 'Service not found';
            if (callback) callback(error);
          } else {
            if (callback) callback(null, { stdout: '', stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.uninstallWindowsServiceDirect()).rejects.toThrow(ServiceError);
        await expect(manager.uninstallWindowsServiceDirect()).rejects.toThrow(/Failed to uninstall Windows service/);
      });
    });
  });

  describe('Windows Service Enhanced Error Handling', () => {
    beforeEach(() => {
      mockProcess.platform = 'win32';
    });

    describe('sc start command error handling', () => {
      it('should not throw error when service is already running', async () => {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc start')) {
            const error = new Error('Service already running') as Error & { stderr?: string };
            error.stderr = 'The service is already running';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.start()).resolves.not.toThrow();
      });

      it('should not throw error when service is already started', async () => {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc start')) {
            const error = new Error('Already started') as Error & { stderr?: string };
            error.stderr = 'Service already started';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.start()).resolves.not.toThrow();
      });

      it('should throw SERVICE_NOT_FOUND when service does not exist', async () => {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc start')) {
            const error = new Error('Service not found') as Error & { stderr?: string };
            error.stderr = 'The specified service does not exist';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.start()).rejects.toThrow(ServiceError);
        await expect(manager.start()).rejects.toThrow(/specified service does not exist/);
      });

      it('should throw PERMISSION_DENIED on access denied', async () => {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc start')) {
            const error = new Error('Access denied') as Error & { stderr?: string };
            error.stderr = 'Access is denied';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.start()).rejects.toThrow(ServiceError);
        await expect(manager.start()).rejects.toThrow(/Access is denied/);
      });
    });

    describe('sc stop command error handling', () => {
      it('should not throw error when service is not running', async () => {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc stop')) {
            const error = new Error('Service not running') as Error & { stderr?: string };
            error.stderr = 'The service is not started';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.stop()).resolves.not.toThrow();
      });

      it('should not throw error when service is not running (alternative message)', async () => {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc stop')) {
            const error = new Error('Not running') as Error & { stderr?: string };
            error.stderr = 'Service not running';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.stop()).resolves.not.toThrow();
      });

      it('should throw SERVICE_NOT_FOUND when service does not exist', async () => {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc stop')) {
            const error = new Error('Service not found') as Error & { stderr?: string };
            error.stderr = 'The specified service does not exist';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.stop()).rejects.toThrow(ServiceError);
        await expect(manager.stop()).rejects.toThrow(/specified service does not exist/);
      });
    });

    describe('sc query command error handling', () => {
      it('should handle non-existent service in query commands', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc query')) {
            const error = new Error('Service does not exist') as Error & { stderr?: string };
            error.stderr = 'The specified service does not exist';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        const status = await manager.getStatus();

        expect(status.installed).toBe(false);
        expect(status.running).toBe(false);
      });
    });

    describe('PowerShell script error handling', () => {
      it('should handle PowerShell install script failures', async () => {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('powershell') && command.includes('-Install')) {
            const error = new Error('PowerShell execution failed') as Error & { stderr?: string };
            error.stderr = 'PowerShell script failed';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.enable()).rejects.toThrow(ServiceError);
      });

      it('should handle service already exists error during install', async () => {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('powershell') && command.includes('-Install')) {
            const error = new Error('Service exists') as Error & { stderr?: string };
            error.stderr = 'Service already exists';
            if (callback) callback(error);
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        await expect(manager.enable()).rejects.toThrow(ServiceError);
      });
    });
  });

  describe('Advanced Integration Tests', () => {
    it('should handle rapid successive operations', async () => {
      mockProcess.platform = 'linux';
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      let callCount = 0;
      mockExec.mockImplementation((command: string, callback?: any) => {
        callCount++;
        setTimeout(() => {
          if (callback) callback(null, { stdout: 'ActiveState=active\nLoadState=loaded\nMainPID=1234\n', stderr: '' });
        }, 1); // Small delay to simulate real async behavior
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // Perform rapid operations
      await manager.install();
      await manager.start();
      await manager.stop();
      await manager.restart();
      const status = await manager.getStatus();
      await manager.uninstall();

      expect(callCount).toBeGreaterThan(0);
      expect(status.platform).toBe('linux');
    });

    it('should handle mixed platform checks', () => {
      // Test platform detection consistency
      mockProcess.platform = 'linux';
      const linuxManager = new ServiceManager(defaultOptions);
      expect(linuxManager.getPlatform()).toBe('linux');

      mockProcess.platform = 'darwin';
      const macManager = new ServiceManager(defaultOptions);
      expect(macManager.getPlatform()).toBe('darwin');

      mockProcess.platform = 'win32';
      const windowsManager = new ServiceManager(defaultOptions);
      expect(windowsManager.getPlatform()).toBe('win32');

      mockProcess.platform = 'freebsd';
      const unsupportedManager = new ServiceManager(defaultOptions);
      expect(unsupportedManager.getPlatform()).toBe('unsupported');
    });

    it('should maintain state consistency during error recovery', async () => {
      mockProcess.platform = 'linux';
      mockFs.access.mockResolvedValue(undefined);

      let failFirst = true;
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('systemctl --user start') && failFirst) {
          failFirst = false;
          const error = new Error('Service temporarily unavailable') as Error & { stderr?: string };
          error.stderr = 'systemctl: temporarily unavailable';
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: 'ActiveState=active\nLoadState=loaded\nMainPID=1234\n', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // First start should fail
      await expect(manager.start()).rejects.toThrow(ServiceError);

      // Second start should succeed
      await expect(manager.start()).resolves.not.toThrow();

      // Status should work
      const status = await manager.getStatus();
      expect(status.running).toBe(true);
    });
  });

  describe('Resource Management and Cleanup', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
    });

    it('should handle cleanup when install partially fails', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.install()).rejects.toThrow(ServiceError);

      // Ensure no partial state remains (this is implicitly tested by the error being thrown)
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle uninstall when service is already partially removed', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File not found'));

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('stop') || command.includes('disable')) {
          const error = new Error('Service not found');
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // Should not throw even if components are missing
      await expect(manager.uninstall()).resolves.not.toThrow();
    });
  });

  describe('Install Method Comprehensive Testing', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
    });

    it('should install service with default options successfully', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.install();

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(result.platform).toBe('linux');
      expect(result.servicePath).toContain('.config/systemd/user/apex-daemon.service');
    });

    it('should install and enable service when enableAfterInstall is true', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.install({ enableAfterInstall: true });

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('should throw SERVICE_EXISTS error when service already exists and force is false', async () => {
      mockFs.access.mockResolvedValue(undefined); // File exists

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.install({ force: false })).rejects.toThrow(ServiceError);
      await expect(manager.install({ force: false })).rejects.toThrow(/already exists/);
    });

    it('should overwrite existing service when force is true', async () => {
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.install({ force: true });

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle permission denied error during directory creation', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      const permError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      mockFs.mkdir.mockRejectedValue(permError);

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.install()).rejects.toThrow(ServiceError);
      await expect(manager.install()).rejects.toThrow(/Permission denied creating directory/);
    });

    it('should handle permission denied error during file write', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      const permError = new Error('EPERM: operation not permitted') as NodeJS.ErrnoException;
      permError.code = 'EPERM';
      mockFs.writeFile.mockRejectedValue(permError);

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.install()).rejects.toThrow(ServiceError);
      await expect(manager.install()).rejects.toThrow(/Permission denied writing to/);
    });

    it('should add warnings when systemctl reload fails but continue', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('daemon-reload')) {
          const error = new Error('Failed to reload systemd');
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.install();

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Service installed but systemctl reload failed: Failed to reload systemd');
    });

    it('should add warnings when enable fails but continue', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('daemon-reload')) {
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('enable')) {
          const error = new Error('Failed to enable service');
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.install({ enableAfterInstall: true });

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
      expect(result.warnings).toContain('Service installed but could not be enabled: Failed to enable service');
    });

    it('should install service on macOS platform', async () => {
      mockProcess.platform = 'darwin';
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.install();

      expect(result.success).toBe(true);
      expect(result.platform).toBe('darwin');
      expect(result.servicePath).toContain('Library/LaunchAgents');
    });

    it('should install and enable on macOS when enableAfterInstall is true', async () => {
      mockProcess.platform = 'darwin';
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.install({ enableAfterInstall: true });

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.platform).toBe('darwin');
    });

    it('should throw error for unsupported platform', async () => {
      mockProcess.platform = 'win32';

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.install()).rejects.toThrow(ServiceError);
      await expect(manager.install()).rejects.toThrow(/Service management not available on unsupported/);
    });
  });

  describe('Uninstall Method Comprehensive Testing', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
    });

    it('should uninstall service successfully', async () => {
      mockFs.access.mockResolvedValue(undefined); // Service exists
      mockFs.unlink.mockResolvedValue(undefined);
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          // Service not running
          const output = 'ActiveState=inactive\nLoadState=loaded\nMainPID=0\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.uninstall();

      expect(result.success).toBe(true);
      expect(result.wasRunning).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should stop running service during uninstall', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      let serviceStopped = false;
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          const isRunning = !serviceStopped;
          const output = `ActiveState=${isRunning ? 'active' : 'inactive'}\nLoadState=loaded\nMainPID=${isRunning ? '1234' : '0'}\n`;
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('stop')) {
          serviceStopped = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.uninstall();

      expect(result.success).toBe(true);
      expect(result.wasRunning).toBe(true);
    });

    it('should throw error when service file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.uninstall()).rejects.toThrow(ServiceError);
      await expect(manager.uninstall()).rejects.toThrow(/Service not found at/);
    });

    it('should handle stop timeout and fail without force', async () => {
      mockFs.access.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          const output = 'ActiveState=active\nLoadState=loaded\nMainPID=1234\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('stop')) {
          const error = new Error('Service stop timeout');
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.uninstall()).rejects.toThrow(ServiceError);
      await expect(manager.uninstall()).rejects.toThrow(/Could not stop service gracefully/);
    });

    it('should continue with warnings when stop fails with force option', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          const output = 'ActiveState=active\nLoadState=loaded\nMainPID=1234\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('stop')) {
          const error = new Error('Service stop failed');
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.uninstall({ force: true });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Could not stop service gracefully: Service stop failed');
    });

    it('should handle permission denied during service file removal', async () => {
      mockFs.access.mockResolvedValue(undefined);
      const permError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      mockFs.unlink.mockRejectedValue(permError);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          const output = 'ActiveState=inactive\nLoadState=loaded\nMainPID=0\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      await expect(manager.uninstall()).rejects.toThrow(ServiceError);
      await expect(manager.uninstall()).rejects.toThrow(/Permission denied removing/);
    });

    it('should add warnings when disable fails but continue', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          const output = 'ActiveState=inactive\nLoadState=loaded\nMainPID=0\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('disable')) {
          const error = new Error('Failed to disable service');
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.uninstall();

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Could not disable service: Failed to disable service');
    });

    it('should uninstall service on macOS platform', async () => {
      mockProcess.platform = 'darwin';
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('list')) {
          const output = '-\t0\tcom.apex.daemon'; // Not running
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.uninstall();

      expect(result.success).toBe(true);
      expect(result.wasRunning).toBe(false);
    });

    it('should handle custom stop timeout', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const stopStartTime = Date.now();
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          const output = 'ActiveState=active\nLoadState=loaded\nMainPID=1234\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('stop')) {
          // Simulate a delay to test timeout behavior
          setTimeout(() => {
            if (callback) callback(null, { stdout: '', stderr: '' });
          }, 50);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.uninstall({ stopTimeout: 100 });

      expect(result.success).toBe(true);
      expect(Date.now() - stopStartTime).toBeLessThan(200); // Should complete within reasonable time
    });

    it('should ignore ENOENT error when removing already-deleted file', async () => {
      mockFs.access.mockResolvedValue(undefined);
      const enoentError = new Error('ENOENT: file not found') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockFs.unlink.mockRejectedValue(enoentError);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          const output = 'ActiveState=inactive\nLoadState=loaded\nMainPID=0\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.uninstall();

      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(['Could not disable service: Failed to disable service']); // Only disable warning
    });

    it('should uninstall Windows service successfully', async () => {
      mockProcess.platform = 'win32';
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('sc query')) {
          const output = 'SERVICE_NAME: apex-daemon\n        STATE              : 1  STOPPED';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.uninstall();

      expect(result.success).toBe(true);
      expect(result.wasRunning).toBe(false);
    });

    it('should stop running Windows service during uninstall', async () => {
      mockProcess.platform = 'win32';
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      let serviceStopped = false;
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('sc query')) {
          const isRunning = !serviceStopped;
          const state = isRunning ? 'RUNNING' : 'STOPPED';
          const output = `SERVICE_NAME: apex-daemon\n        STATE              : 4  ${state}`;
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('sc stop')) {
          serviceStopped = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      const result = await manager.uninstall();

      expect(result.success).toBe(true);
      expect(result.wasRunning).toBe(true);
    });
  });

  describe('Service Lifecycle Integration Tests', () => {
    beforeEach(() => {
      mockProcess.platform = 'linux';
    });

    it('should handle complete install-start-stop-uninstall lifecycle', async () => {
      let serviceInstalled = false;
      let serviceRunning = false;

      mockFs.access.mockImplementation(() => {
        if (serviceInstalled) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT: file not found'));
      });

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockImplementation(() => {
        serviceInstalled = true;
        return Promise.resolve();
      });

      mockFs.unlink.mockImplementation(() => {
        serviceInstalled = false;
        return Promise.resolve();
      });

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          const state = serviceRunning ? 'active' : 'inactive';
          const pid = serviceRunning ? '1234' : '0';
          const output = `ActiveState=${state}\nLoadState=loaded\nMainPID=${pid}\n`;
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('start')) {
          serviceRunning = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('stop')) {
          serviceRunning = false;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // Install
      const installResult = await manager.install();
      expect(installResult.success).toBe(true);

      // Start
      await expect(manager.start()).resolves.not.toThrow();

      // Check running status
      const runningStatus = await manager.getStatus();
      expect(runningStatus.running).toBe(true);
      expect(runningStatus.pid).toBe(1234);

      // Stop
      await expect(manager.stop()).resolves.not.toThrow();

      // Check stopped status
      const stoppedStatus = await manager.getStatus();
      expect(stoppedStatus.running).toBe(false);

      // Uninstall
      const uninstallResult = await manager.uninstall();
      expect(uninstallResult.success).toBe(true);
      expect(uninstallResult.wasRunning).toBe(false);

      // Check not installed status
      const notInstalledStatus = await manager.getStatus();
      expect(notInstalledStatus.installed).toBe(false);
    });

    it('should handle restart during service lifecycle', async () => {
      let restartCount = 0;
      mockFs.access.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('show')) {
          const output = 'ActiveState=active\nLoadState=loaded\nMainPID=1234\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('restart')) {
          restartCount++;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);
      await manager.restart();

      expect(restartCount).toBe(1);
    });

    it('should handle enable/disable operations', async () => {
      mockFs.access.mockResolvedValue(undefined);
      let isEnabled = false;

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('enable')) {
          isEnabled = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('disable')) {
          isEnabled = false;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('show')) {
          const loadState = isEnabled ? 'loaded' : 'masked';
          const output = `ActiveState=inactive\nLoadState=${loadState}\nMainPID=0\n`;
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      await manager.enable();
      const enabledStatus = await manager.getStatus();
      expect(enabledStatus.enabled).toBe(true);

      await manager.disable();
      const disabledStatus = await manager.getStatus();
      expect(disabledStatus.enabled).toBe(false);
    });

    it('should handle service recovery scenarios', async () => {
      mockFs.access.mockResolvedValue(undefined);
      let attemptCount = 0;

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('start')) {
          attemptCount++;
          if (attemptCount === 1) {
            // First attempt fails
            const error = new Error('Service temporarily unavailable');
            if (callback) callback(error);
          } else {
            // Subsequent attempts succeed
            if (callback) callback(null, { stdout: '', stderr: '' });
          }
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // First start attempt should fail
      await expect(manager.start()).rejects.toThrow();

      // Second start attempt should succeed
      await expect(manager.start()).resolves.not.toThrow();

      expect(attemptCount).toBe(2);
    });

    it('should handle Windows service complete lifecycle with direct methods', async () => {
      mockProcess.platform = 'win32';
      let serviceInstalled = false;
      let serviceRunning = false;

      mockFs.writeFile.mockImplementation(() => {
        serviceInstalled = true;
        return Promise.resolve();
      });

      mockFs.unlink.mockImplementation(() => {
        serviceInstalled = false;
        return Promise.resolve();
      });

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('sc create')) {
          serviceInstalled = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('sc delete')) {
          serviceInstalled = false;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('sc start')) {
          serviceRunning = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('sc stop')) {
          serviceRunning = false;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('sc query')) {
          const state = serviceRunning ? 'RUNNING' : 'STOPPED';
          const output = `SERVICE_NAME: apex-daemon\n        STATE              : 4  ${state}`;
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.includes('sc qc')) {
          const output = 'START_TYPE         : 2   AUTO_START';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // Test direct installation
      await manager.installWindowsServiceDirect();
      expect(serviceInstalled).toBe(true);

      // Test start
      await manager.start();
      expect(serviceRunning).toBe(true);

      // Test restart (should call both stop and start on Windows)
      await manager.restart();
      expect(serviceRunning).toBe(true); // Should be running after restart

      // Test stop
      await manager.stop();
      expect(serviceRunning).toBe(false);

      // Test direct uninstallation
      await manager.uninstallWindowsServiceDirect();
      expect(serviceInstalled).toBe(false);
    });

    it('should handle Windows service operations with PowerShell fallback scenarios', async () => {
      mockProcess.platform = 'win32';
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      let enableCalled = false;
      let disableCalled = false;

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('powershell') && command.includes('-Install')) {
          enableCalled = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('powershell') && command.includes('-Uninstall')) {
          disableCalled = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // Test PowerShell script-based enable (used by regular install)
      await manager.enable();
      expect(enableCalled).toBe(true);

      // Test PowerShell script-based disable (used by regular uninstall)
      await manager.disable();
      expect(disableCalled).toBe(true);
    });
  });

  describe('Windows Service Integration Test Scenarios', () => {
    beforeEach(() => {
      mockProcess.platform = 'win32';
    });

    it('should handle mixed Windows service installation approaches', async () => {
      // Test scenario where NSSM is preferred but fallback to sc.exe is needed
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      let nssmUsed = false;
      let scUsed = false;

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('nssm install')) {
          nssmUsed = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('sc create')) {
          scUsed = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // Regular install should use PowerShell script (which may use NSSM or sc.exe)
      await manager.install();

      // Direct install should always use sc.exe
      await manager.installWindowsServiceDirect();
      expect(scUsed).toBe(true);
    });

    it('should handle Windows service status with various edge cases', async () => {
      mockFs.access.mockResolvedValue(undefined);

      // Test different status combinations
      const statusTests = [
        {
          queryOutput: 'SERVICE_NAME: apex-daemon\n        STATE              : 4  RUNNING',
          configOutput: 'START_TYPE         : 2   AUTO_START',
          wmicOutput: 'ProcessId=1234',
          expectedRunning: true,
          expectedEnabled: true,
          expectedPid: 1234,
        },
        {
          queryOutput: 'SERVICE_NAME: apex-daemon\n        STATE              : 1  STOPPED',
          configOutput: 'START_TYPE         : 4   DISABLED',
          wmicOutput: 'ProcessId=0',
          expectedRunning: false,
          expectedEnabled: false,
          expectedPid: undefined,
        },
        {
          queryOutput: 'SERVICE_NAME: apex-daemon\n        STATE              : 2  START_PENDING',
          configOutput: 'START_TYPE         : 3   DEMAND_START',
          wmicOutput: 'ProcessId=5678',
          expectedRunning: false, // START_PENDING is not considered running
          expectedEnabled: false,
          expectedPid: 5678,
        },
      ];

      for (const test of statusTests) {
        mockExec.mockImplementation((command: string, callback?: any) => {
          if (command.includes('sc query')) {
            if (callback) callback(null, { stdout: test.queryOutput, stderr: '' });
          } else if (command.includes('sc qc')) {
            if (callback) callback(null, { stdout: test.configOutput, stderr: '' });
          } else if (command.includes('wmic service')) {
            if (callback) callback(null, { stdout: test.wmicOutput, stderr: '' });
          }
          return {} as any;
        });

        const manager = new ServiceManager(defaultOptions);
        const status = await manager.getStatus();

        expect(status.running).toBe(test.expectedRunning);
        expect(status.enabled).toBe(test.expectedEnabled);
        expect(status.pid).toBe(test.expectedPid);
        expect(status.platform).toBe('win32');
        expect(status.installed).toBe(true);
      }
    });

    it('should handle Windows service recovery and error resilience', async () => {
      mockFs.access.mockResolvedValue(undefined);
      let operationCount = 0;

      mockExec.mockImplementation((command: string, callback?: any) => {
        operationCount++;

        if (command.includes('sc start') && operationCount === 1) {
          // First start attempt fails with permission error
          const error = new Error('Access denied') as Error & { stderr?: string };
          error.stderr = 'Access is denied';
          if (callback) callback(error);
        } else if (command.includes('sc start') && operationCount === 2) {
          // Second start attempt fails with service already running (should succeed)
          const error = new Error('Already running') as Error & { stderr?: string };
          error.stderr = 'The service is already running';
          if (callback) callback(error);
        } else if (command.includes('sc stop') && operationCount === 3) {
          // Stop attempt fails with service not running (should succeed)
          const error = new Error('Not running') as Error & { stderr?: string };
          error.stderr = 'The service is not started';
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // First start should fail due to permission
      await expect(manager.start()).rejects.toThrow(ServiceError);

      // Second start should succeed (service already running)
      await expect(manager.start()).resolves.not.toThrow();

      // Stop should succeed (service not running)
      await expect(manager.stop()).resolves.not.toThrow();

      expect(operationCount).toBe(3);
    });

    it('should handle Windows service PowerShell execution fallback gracefully', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      // PowerShell script execution fails
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.includes('powershell') && command.includes('-Install')) {
          const error = new Error('PowerShell execution failed') as Error & { stderr?: string };
          error.stderr = 'PowerShell execution policy restrictions';
          if (callback) callback(error);
        } else if (command.includes('daemon-reload')) {
          // Skip on Windows
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(defaultOptions);

      // Install should succeed but enableAfterInstall should add warnings
      const result = await manager.install({ enableAfterInstall: true });
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false); // Should be false because enable failed
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('could not be enabled');
    });
  });
});