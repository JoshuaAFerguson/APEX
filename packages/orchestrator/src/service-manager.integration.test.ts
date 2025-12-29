import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import {
  ServiceManager,
  ServiceError,
  detectPlatform,
  type ServiceManagerOptions,
  type InstallOptions,
  type UninstallOptions,
} from './service-manager';

// Windows compatibility: Skip service integration tests that involve Unix-specific
// systemd/launchd behaviors not available on Windows
const isWindows = process.platform === 'win32';

/**
 * Integration tests for ServiceManager install/uninstall functionality.
 * These tests focus on end-to-end scenarios and edge cases for the
 * install and uninstall methods that were recently enhanced.
 */

// Mock dependencies for integration testing
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

// Mock process for consistent testing environment
const mockProcess = {
  platform: 'linux',
  execPath: '/usr/bin/node',
  env: { HOME: '/home/testuser', USER: 'testuser' },
  cwd: vi.fn(() => '/test/project'),
  getuid: vi.fn(() => 1000),
};

Object.defineProperty(global, 'process', {
  value: mockProcess,
  writable: true,
});

const mockFs = vi.mocked(fs);
const mockExec = vi.mocked(exec);

describe('ServiceManager Integration Tests - Install/Uninstall', () => {
  const testOptions: ServiceManagerOptions = {
    projectPath: '/test/project',
    serviceName: 'test-service',
    serviceDescription: 'Test Service for Integration Tests',
    user: 'testuser',
    workingDirectory: '/test/project',
    environment: { NODE_ENV: 'test', TEST_VAR: 'integration' },
    restartPolicy: 'on-failure',
    restartDelaySeconds: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess.platform = 'linux';
    mockProcess.getuid = vi.fn(() => 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full Service Lifecycle Scenarios', () => {
    it.skipIf(isWindows)('should handle complete service lifecycle from scratch', async () => {
      let serviceExists = false;
      let serviceEnabled = false;
      let serviceRunning = false;

      // Mock filesystem operations
      mockFs.access.mockImplementation(() => {
        if (serviceExists) {
          return Promise.resolve();
        }
        const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });

      mockFs.mkdir.mockResolvedValue(undefined);

      mockFs.writeFile.mockImplementation(() => {
        serviceExists = true;
        return Promise.resolve();
      });

      mockFs.unlink.mockImplementation(() => {
        serviceExists = false;
        serviceEnabled = false;
        serviceRunning = false;
        return Promise.resolve();
      });

      // Mock system commands
      mockExec.mockImplementation((command: string, callback?: any) => {
        const cmdStr = command.toString();

        if (cmdStr.includes('daemon-reload')) {
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('enable')) {
          serviceEnabled = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('disable')) {
          serviceEnabled = false;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('start') && !cmdStr.includes('restart')) {
          serviceRunning = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('stop')) {
          serviceRunning = false;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('restart')) {
          serviceRunning = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('show')) {
          const state = serviceRunning ? 'active' : 'inactive';
          const loadState = serviceEnabled ? 'loaded' : 'masked';
          const pid = serviceRunning ? '12345' : '0';
          const output = `ActiveState=${state}\nLoadState=${loadState}\nMainPID=${pid}\n`;
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(testOptions);

      // 1. Install service
      const installResult = await manager.install();
      expect(installResult.success).toBe(true);
      expect(installResult.enabled).toBe(false);
      expect(installResult.platform).toBe('linux');
      expect(installResult.warnings).toEqual([]);

      // 2. Enable service
      await manager.enable();

      // 3. Start service
      await manager.start();

      // 4. Check status
      const runningStatus = await manager.getStatus();
      expect(runningStatus.installed).toBe(true);
      expect(runningStatus.enabled).toBe(true);
      expect(runningStatus.running).toBe(true);
      expect(runningStatus.pid).toBe(12345);

      // 5. Restart service
      await manager.restart();
      const restartedStatus = await manager.getStatus();
      expect(restartedStatus.running).toBe(true);

      // 6. Stop service
      await manager.stop();
      const stoppedStatus = await manager.getStatus();
      expect(stoppedStatus.running).toBe(false);

      // 7. Uninstall service
      const uninstallResult = await manager.uninstall();
      expect(uninstallResult.success).toBe(true);
      expect(uninstallResult.wasRunning).toBe(false);

      // 8. Verify service is completely removed
      const finalStatus = await manager.getStatus();
      expect(finalStatus.installed).toBe(false);
      expect(finalStatus.enabled).toBe(false);
      expect(finalStatus.running).toBe(false);
    });

    it.skipIf(isWindows)('should handle install with auto-enable successfully', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(testOptions);
      const installOptions: InstallOptions = { enableAfterInstall: true };

      const result = await manager.install(installOptions);

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it.skipIf(isWindows)('should handle force reinstall over existing service', async () => {
      mockFs.access.mockResolvedValue(undefined); // Service exists
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(testOptions);
      const installOptions: InstallOptions = { force: true, enableAfterInstall: true };

      const result = await manager.install(installOptions);

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it.skipIf(isWindows)('should handle partial failures during install gracefully', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      let reloadFailures = 0;
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.toString().includes('daemon-reload')) {
          reloadFailures++;
          if (reloadFailures === 1) {
            const error = new Error('systemd temporarily unavailable');
            if (callback) callback(error);
          } else {
            if (callback) callback(null, { stdout: '', stderr: '' });
          }
        } else if (command.toString().includes('enable')) {
          const error = new Error('systemctl enable failed');
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(testOptions);
      const result = await manager.install({ enableAfterInstall: true });

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false); // Enable failed
      expect(result.warnings).toContain('Service installed but systemctl reload failed: systemd temporarily unavailable');
      expect(result.warnings).toContain('Service installed but could not be enabled: systemctl enable failed');
    });

    it.skipIf(isWindows)('should handle graceful uninstall of running service', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      let serviceRunning = true;
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.toString().includes('show')) {
          const state = serviceRunning ? 'active' : 'inactive';
          const pid = serviceRunning ? '9999' : '0';
          const output = `ActiveState=${state}\nLoadState=loaded\nMainPID=${pid}\n`;
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.toString().includes('stop')) {
          serviceRunning = false;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(testOptions);
      const result = await manager.uninstall();

      expect(result.success).toBe(true);
      expect(result.wasRunning).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it.skipIf(isWindows)('should handle forced uninstall when service won\'t stop', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command.toString().includes('show')) {
          const output = 'ActiveState=active\nLoadState=loaded\nMainPID=8888\n';
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else if (command.toString().includes('stop')) {
          const error = new Error('Service is stuck and cannot be stopped');
          if (callback) callback(error);
        } else if (command.toString().includes('disable')) {
          const error = new Error('Cannot disable running service');
          if (callback) callback(error);
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(testOptions);
      const uninstallOptions: UninstallOptions = { force: true, stopTimeout: 1000 };

      const result = await manager.uninstall(uninstallOptions);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Could not stop service gracefully');
    });
  });

  describe('Platform-Specific Behavior', () => {
    it.skipIf(isWindows)('should handle macOS service lifecycle correctly', async () => {
      mockProcess.platform = 'darwin';

      let launchAgentLoaded = false;
      let serviceRunning = false;

      mockFs.access.mockImplementation(() => {
        if (launchAgentLoaded) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT: file not found'));
      });

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockImplementation(() => {
        launchAgentLoaded = true;
        return Promise.resolve();
      });

      mockFs.unlink.mockImplementation(() => {
        launchAgentLoaded = false;
        serviceRunning = false;
        return Promise.resolve();
      });

      mockExec.mockImplementation((command: string, callback?: any) => {
        const cmdStr = command.toString();

        if (cmdStr.includes('launchctl load')) {
          serviceRunning = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('launchctl unload')) {
          serviceRunning = false;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('launchctl start')) {
          serviceRunning = true;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('launchctl stop')) {
          serviceRunning = false;
          if (callback) callback(null, { stdout: '', stderr: '' });
        } else if (cmdStr.includes('launchctl list')) {
          const pid = serviceRunning ? '7777' : '-';
          const status = serviceRunning ? '0' : '1';
          const output = `${pid}\t${status}\tcom.apex.test-service`;
          if (callback) callback(null, { stdout: output, stderr: '' });
        } else {
          if (callback) callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const manager = new ServiceManager(testOptions);

      // Install with auto-enable for macOS
      const installResult = await manager.install({ enableAfterInstall: true });
      expect(installResult.success).toBe(true);
      expect(installResult.enabled).toBe(true);
      expect(installResult.platform).toBe('darwin');

      // Check service status
      const status = await manager.getStatus();
      expect(status.installed).toBe(true);
      expect(status.running).toBe(true);
      expect(status.pid).toBe(7777);

      // Restart on macOS (uses stop + start)
      await manager.restart();
      const restartedStatus = await manager.getStatus();
      expect(restartedStatus.running).toBe(true);

      // Uninstall
      const uninstallResult = await manager.uninstall();
      expect(uninstallResult.success).toBe(true);
      expect(uninstallResult.wasRunning).toBe(true);
    });

    it('should reject operations on unsupported platforms', async () => {
      mockProcess.platform = 'win32';

      const manager = new ServiceManager(testOptions);

      expect(manager.getPlatform()).toBe('unsupported');
      expect(manager.isSupported()).toBe(false);

      await expect(manager.install()).rejects.toThrow(ServiceError);
      await expect(manager.install()).rejects.toThrow(/Service management not available on unsupported/);
    });
  });

  describe('Permission and Security Handling', () => {
    it.skipIf(isWindows)('should handle permission denied scenarios with helpful messages', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);

      const permError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      mockFs.writeFile.mockRejectedValue(permError);

      const manager = new ServiceManager(testOptions);

      await expect(manager.install()).rejects.toThrow(ServiceError);

      try {
        await manager.install();
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).code).toBe('PERMISSION_DENIED');
        expect((error as ServiceError).message).toContain('Permission denied writing to');
        expect((error as ServiceError).message).toContain('Check directory permissions');
      }
    });

    it.skipIf(isWindows)('should handle root user installation paths correctly', async () => {
      mockProcess.getuid = vi.fn(() => 0); // Root user
      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(testOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.path).toContain('/etc/systemd/system');

      const result = await manager.install();
      expect(result.success).toBe(true);
      expect(result.servicePath).toContain('/etc/systemd/system');
    });
  });

  describe('Advanced Configuration Scenarios', () => {
    it.skipIf(isWindows)('should handle complex service configurations', async () => {
      const complexOptions: ServiceManagerOptions = {
        projectPath: '/complex/project/path',
        serviceName: 'apex-complex-service',
        serviceDescription: 'Complex APEX Service with Multiple Features',
        user: 'complexuser',
        workingDirectory: '/complex/working/dir',
        environment: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'debug',
          COMPLEX_CONFIG: 'value with spaces and "quotes"',
          NUMERIC_VALUE: '42',
          EMPTY_VALUE: '',
        },
        restartPolicy: 'always',
        restartDelaySeconds: 10,
      };

      mockFs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, callback?: any) => {
        if (callback) callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const manager = new ServiceManager(complexOptions);
      const serviceFile = manager.generateServiceFile();

      expect(serviceFile.content).toContain('User=complexuser');
      expect(serviceFile.content).toContain('WorkingDirectory=/complex/working/dir');
      expect(serviceFile.content).toContain('Environment=NODE_ENV=production');
      expect(serviceFile.content).toContain('Environment=LOG_LEVEL=debug');
      expect(serviceFile.content).toContain('Restart=always');
      expect(serviceFile.content).toContain('RestartSec=10');

      const result = await manager.install();
      expect(result.success).toBe(true);
    });
  });
});