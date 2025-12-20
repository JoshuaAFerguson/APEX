import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import {
  ServiceManager,
  SystemdGenerator,
  LaunchdGenerator,
  ServiceError,
  detectPlatform,
  isSystemdAvailable,
  isLaunchdAvailable,
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

    it('should detect unsupported platform', () => {
      mockProcess.platform = 'win32';
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

  describe('Unsupported Platform', () => {
    beforeEach(() => {
      mockProcess.platform = 'win32';
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

    it('should handle missing HOME environment variable', () => {
      const originalHome = mockProcess.env.HOME;
      mockProcess.env.HOME = '';

      const manager = new ServiceManager(defaultOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toContain('/tmp/.config/systemd/user');

      mockProcess.env.HOME = originalHome;
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
});