// TODO: These integration tests have complex mocking issues that need to be fixed
import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import {
  handleInstallService,
  handleUninstallService,
  handleServiceStatus,
} from '../service-handlers';
import {
  ServiceManager,
  ServiceError,
  type ServiceStatus,
} from '@apexcli/orchestrator';

// Windows compatibility: Service integration tests use Unix-specific system calls
// (systemctl, launchctl) and service file formats that don't apply to Windows
const isWindows = process.platform === 'win32';

// Mock external dependencies
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
}));

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((str) => str),
    green: vi.fn((str) => str),
    blue: vi.fn((str) => str),
    yellow: vi.fn((str) => str),
    gray: vi.fn((str) => str),
    cyan: vi.fn((str) => str),
  },
}));

interface ApexContext {
  cwd: string;
  initialized: boolean;
}

// Windows compatibility: Skip service integration tests as Windows service management
// is not yet implemented (requires systemd/launchd which are Unix-only)
describe.skipIf(isWindows)('Service Handlers Integration Tests', () => {
  let ctx: ApexContext;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let consoleOutputs: string[];

  const mockFs = vi.mocked(fs);
  const mockExec = vi.mocked(exec) as MockedFunction<typeof exec>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutputs = [];

    // Capture console output
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    console.log = (...args) => {
      consoleOutputs.push(args.join(' '));
    };
    console.error = (...args) => {
      consoleOutputs.push(args.join(' '));
    };

    ctx = {
      cwd: '/test/project',
      initialized: true,
    };

    // Set up default platform detection
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
    });

    // Mock home directory
    process.env.HOME = '/home/testuser';
    process.env.USER = 'testuser';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Linux systemd integration', () => {
    beforeEach(() => {
      // Mock systemd availability
      mockFs.access.mockImplementation(async (path: any) => {
        if (path.includes('systemctl')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      // Mock successful systemctl commands
      mockExec.mockImplementation((command: any, callback: any) => {
        if (command.includes('systemctl')) {
          callback(null, { stdout: 'success', stderr: '' });
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });
    });

    it('should install service on Linux with systemd', async () => {
      // Mock directory creation
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await handleInstallService(ctx, ['--enable']);

      // Verify that systemd user directory was created
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.config/systemd/user'),
        { recursive: true }
      );

      // Verify service file was written
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('apex-daemon.service'),
        expect.stringContaining('[Unit]')
      );

      // Check console output for success messages
      const output = consoleOutputs.join(' ');
      expect(output).toContain('Installing APEX daemon');
      expect(output).toContain('Service installed successfully');
      expect(output).toContain('systemctl --user start apex-daemon');
    });

    it('should uninstall service on Linux', async () => {
      // Mock service file exists
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      await handleUninstallService(ctx, []);

      // Verify service file was deleted
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('apex-daemon.service')
      );

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Uninstalling APEX daemon');
      expect(output).toContain('Service uninstalled successfully');
    });

    it('should check service status on Linux', async () => {
      // Mock systemctl status command
      mockExec.mockImplementation((command: any, callback: any) => {
        if (command.includes('systemctl --user is-active')) {
          callback(null, { stdout: 'active', stderr: '' });
        } else if (command.includes('systemctl --user is-enabled')) {
          callback(null, { stdout: 'enabled', stderr: '' });
        } else if (command.includes('systemctl --user show')) {
          callback(null, { stdout: 'MainPID=12345', stderr: '' });
        } else {
          callback(new Error('Command failed'));
        }
        return {} as any;
      });

      await handleServiceStatus(ctx);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Service Status');
      expect(output).toContain('Linux (systemd)');
      expect(output).toContain('Running:    yes');
      expect(output).toContain('Enabled:    yes');
    });
  });

  describe('macOS launchd integration', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      process.env.HOME = '/Users/testuser';

      // Mock launchctl availability
      mockExec.mockImplementation((command: any, callback: any) => {
        if (command.includes('launchctl')) {
          callback(null, { stdout: 'success', stderr: '' });
        } else {
          callback(new Error('Command not found'));
        }
        return {} as any;
      });
    });

    it('should install service on macOS with launchd', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await handleInstallService(ctx, []);

      // Verify LaunchAgents directory was created
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('Library/LaunchAgents'),
        { recursive: true }
      );

      // Verify plist file was written
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('com.apex.daemon.plist'),
        expect.stringContaining('<plist version')
      );

      const output = consoleOutputs.join(' ');
      expect(output).toContain('launchctl start com.apex.daemon');
      expect(output).toContain('.apex/daemon.out.log');
    });

    it('should uninstall service on macOS', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      await handleUninstallService(ctx, []);

      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('com.apex.daemon.plist')
      );

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Service uninstalled successfully');
      expect(output).toContain('macOS (launchd)');
    });

    it('should check service status on macOS', async () => {
      mockExec.mockImplementation((command: any, callback: any) => {
        if (command.includes('launchctl list')) {
          callback(null, { stdout: '12345\t0\tcom.apex.daemon', stderr: '' });
        } else {
          callback(new Error('Command failed'));
        }
        return {} as any;
      });

      await handleServiceStatus(ctx);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('macOS (launchd)');
      expect(output).toContain('Running:    yes');
    });
  });

  describe('error scenarios integration', () => {
    it('should handle permission denied during service installation', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('EACCES: permission denied'));

      await handleInstallService(ctx, []);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Permission denied');
    });

    it('should handle service already exists during installation', async () => {
      // Mock service file already exists
      mockFs.access.mockResolvedValue(undefined); // File exists
      mockFs.writeFile.mockImplementation(async () => {
        throw new ServiceError('Service file already exists', 'SERVICE_EXISTS');
      });

      await handleInstallService(ctx, []);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('A service file already exists');
      expect(output).toContain('Use --force to overwrite');
    });

    it('should handle service not found during uninstall', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await handleUninstallService(ctx, []);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('No service file found');
    });

    it('should handle systemctl command failures', async () => {
      mockExec.mockImplementation((command: any, callback: any) => {
        callback(new Error('systemctl: command not found'));
        return {} as any;
      });

      await handleServiceStatus(ctx);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Failed to get service status');
    });

    it('should handle unsupported platform gracefully', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      await handleInstallService(ctx, []);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Platform not supported');
      expect(output).toContain('Linux (systemd) and macOS (launchd)');
      expect(output).toContain('Current platform: win32');
    });
  });

  describe('end-to-end workflow tests', () => {
    it('should complete install -> status -> uninstall workflow', async () => {
      // Setup successful mocks
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: any, callback: any) => {
        if (command.includes('systemctl --user is-active')) {
          callback(null, { stdout: 'active', stderr: '' });
        } else if (command.includes('systemctl --user is-enabled')) {
          callback(null, { stdout: 'enabled', stderr: '' });
        } else if (command.includes('systemctl --user show')) {
          callback(null, { stdout: 'MainPID=12345', stderr: '' });
        } else {
          callback(null, { stdout: 'success', stderr: '' });
        }
        return {} as any;
      });

      // 1. Install service
      await handleInstallService(ctx, ['--enable']);
      let output = consoleOutputs.join(' ');
      expect(output).toContain('Service installed successfully');

      consoleOutputs.length = 0; // Clear output

      // 2. Check status
      await handleServiceStatus(ctx);
      output = consoleOutputs.join(' ');
      expect(output).toContain('Running:    yes');
      expect(output).toContain('Enabled:    yes');
      expect(output).toContain('PID:        12345');

      consoleOutputs.length = 0; // Clear output

      // 3. Uninstall service
      await handleUninstallService(ctx, []);
      output = consoleOutputs.join(' ');
      expect(output).toContain('Service uninstalled successfully');
      expect(output).toContain('Was running: yes');
    });

    it('should handle install with custom name and settings', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await handleInstallService(ctx, [
        '--name', 'my-custom-apex',
        '--enable',
        '--force'
      ]);

      // Verify custom service name was used
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('my-custom-apex.service'),
        expect.any(String)
      );

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Service installed successfully');
      expect(output).toContain('Enabled: yes');
    });

    it('should handle graceful timeout during uninstall', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      // Mock service running and needing graceful stop
      mockExec.mockImplementation((command: any, callback: any) => {
        if (command.includes('systemctl --user stop')) {
          // Simulate slow stop that succeeds
          setTimeout(() => callback(null, { stdout: 'success', stderr: '' }), 100);
        } else {
          callback(null, { stdout: 'success', stderr: '' });
        }
        return {} as any;
      });

      await handleUninstallService(ctx, ['--timeout', '2000']);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Service uninstalled successfully');
    });

    it('should handle force uninstall when graceful stop fails', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      // Mock service stop failure
      mockExec.mockImplementation((command: any, callback: any) => {
        if (command.includes('systemctl --user stop')) {
          callback(new Error('Service stuck'));
        } else {
          callback(null, { stdout: 'success', stderr: '' });
        }
        return {} as any;
      });

      await handleUninstallService(ctx, ['--force']);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Service uninstalled successfully');
    });
  });

  describe('configuration validation', () => {
    it('should validate service configuration with project context', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const projectPath = '/custom/project/path';
      ctx.cwd = projectPath;

      await handleInstallService(ctx, []);

      // Verify service file includes correct project path
      const writeFileCall = mockFs.writeFile.mock.calls.find(call =>
        call[0].toString().includes('.service')
      );

      expect(writeFileCall).toBeDefined();
      const serviceContent = writeFileCall![1] as string;
      expect(serviceContent).toContain(projectPath);
    });

    it('should handle complex project paths with spaces', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      ctx.cwd = '/path/with spaces/my project';

      await handleInstallService(ctx, []);

      const output = consoleOutputs.join(' ');
      expect(output).toContain('Service installed successfully');

      // Verify no errors occurred with the space-containing path
      expect(output).not.toContain('Failed to install');
    });
  });
});