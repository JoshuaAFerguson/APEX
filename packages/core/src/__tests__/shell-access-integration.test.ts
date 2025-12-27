/**
 * Shell Access Integration Tests
 *
 * Comprehensive integration tests covering:
 * - execCommand functionality
 * - Working directory handling
 * - Environment variables
 * - TTY allocation
 * - User context
 * - Command timeout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContainerManager, type ExecCommandOptions, type ExecCommandResult } from '../container-manager';
import { ContainerRuntime, type ContainerRuntimeType } from '../container-runtime';
import { exec, spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

const mockExec = vi.mocked(exec);
const mockSpawn = vi.mocked(spawn);

// Mock ContainerRuntime
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

// Mock EventEmitter for realistic process simulation
class MockProcess extends EventEmitter {
  stdin = { write: vi.fn(), end: vi.fn() };
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  constructor(
    private exitCode: number = 0,
    private stdout_data: string = '',
    private stderr_data: string = '',
    private error?: Error,
    private delay: number = 10
  ) {
    super();
  }

  start() {
    setTimeout(() => {
      if (this.stdout_data) {
        this.stdout.emit('data', Buffer.from(this.stdout_data));
      }
      if (this.stderr_data) {
        this.stderr.emit('data', Buffer.from(this.stderr_data));
      }

      if (this.error) {
        this.emit('error', this.error);
      } else {
        this.emit('close', this.exitCode);
      }
    }, this.delay);
  }
}

// Helper to create mock exec callback with various scenarios
function mockExecCallback(
  stdout: string,
  stderr: string = '',
  error?: Error | null,
  delay: number = 10
) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr), delay);
    }
    return {} as ChildProcess;
  });
}

// Helper to create exec error with properties
function createExecError(
  code: number,
  stdout: string = '',
  stderr: string = '',
  message: string = 'Command failed'
) {
  const error = new Error(message) as any;
  error.code = code;
  error.stdout = stdout;
  error.stderr = stderr;
  return error;
}

describe('Shell Access Integration Tests', () => {
  let containerManager: ContainerManager;
  let mockRuntime: ContainerRuntime;
  const testContainerId = 'shell-test-container-abc123';

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    containerManager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('execCommand Core Functionality', () => {
    it('should execute simple commands successfully', async () => {
      const expectedOutput = 'Hello World\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'echo "Hello World"');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(result.command).toContain('docker exec');
      expect(result.command).toContain(testContainerId);
    });

    it('should handle command arrays with proper escaping', async () => {
      const commandArgs = ['echo', 'test with spaces', 'special;chars'];
      const expectedOutput = 'test with spaces special;chars\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, commandArgs);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);
      // Verify proper argument escaping in the generated command
      expect(result.command).toContain("'test with spaces'");
      expect(result.command).toContain("'special;chars'");
    });

    it('should handle command failures with exit codes', async () => {
      const exitCode = 127;
      const stderr = 'command not found: nonexistent\n';
      const error = createExecError(exitCode, '', stderr);

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(error, '', stderr), 10);
        return {} as ChildProcess;
      }));

      const result = await containerManager.execCommand(testContainerId, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(stderr);
      expect(result.exitCode).toBe(exitCode);
    });

    it('should handle mixed stdout and stderr output', async () => {
      const stdout = 'This is normal output\nAnother line\n';
      const stderr = 'Warning: deprecated option\nError details\n';
      const exitCode = 2;
      const error = createExecError(exitCode, stdout, stderr);

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(error, stdout, stderr), 10);
        return {} as ChildProcess;
      }));

      const result = await containerManager.execCommand(testContainerId, 'complex-command');

      expect(result.success).toBe(false);
      expect(result.stdout).toBe(stdout);
      expect(result.stderr).toBe(stderr);
      expect(result.exitCode).toBe(exitCode);
    });
  });

  describe('Working Directory Handling', () => {
    it('should execute commands in specified working directory', async () => {
      const workingDir = '/app/src';
      const expectedOutput = '/app/src\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'pwd', {
        workingDir,
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);
      expect(result.command).toContain(`--workdir ${workingDir}`);
    });

    it('should handle relative working directory paths', async () => {
      const workingDir = './src/components';
      const expectedOutput = '/workspace/src/components\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'pwd', {
        workingDir,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain(`--workdir ${workingDir}`);
    });

    it('should handle working directories with spaces', async () => {
      const workingDir = '/app/my project/src';
      const expectedOutput = '/app/my project/src\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'pwd', {
        workingDir,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain(`--workdir "${workingDir}"`);
    });

    it('should work with file operations in specific directories', async () => {
      const workingDir = '/tmp/workspace';
      const expectedOutput = 'total 4\n-rw-r--r-- 1 user user 13 Jan 1 12:00 test.txt\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'ls -la', {
        workingDir,
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);
      expect(result.command).toContain(`--workdir ${workingDir}`);
    });
  });

  describe('Environment Variables', () => {
    it('should pass environment variables to container', async () => {
      const environment = {
        NODE_ENV: 'test',
        API_URL: 'https://test.api.com',
        DEBUG: 'true',
      };

      const expectedOutput = 'NODE_ENV=test\nAPI_URL=https://test.api.com\nDEBUG=true\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'printenv | grep -E "(NODE_ENV|API_URL|DEBUG)"', {
        environment,
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);
      expect(result.command).toContain('--env NODE_ENV=test');
      expect(result.command).toContain('--env API_URL=https://test.api.com');
      expect(result.command).toContain('--env DEBUG=true');
    });

    it('should handle environment variables with special characters', async () => {
      const environment = {
        PATH_WITH_SPACES: '/usr/local/my app/bin',
        PASSWORD: 'p@ssw0rd!',
        JSON_CONFIG: '{"key": "value", "nested": {"prop": true}}',
      };

      mockExec.mockImplementationOnce(mockExecCallback('Env vars set successfully\n'));

      const result = await containerManager.execCommand(testContainerId, 'env', {
        environment,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--env PATH_WITH_SPACES=');
      expect(result.command).toContain('--env PASSWORD=');
      expect(result.command).toContain('--env JSON_CONFIG=');
    });

    it('should handle empty environment variables', async () => {
      const environment = {
        EMPTY_VAR: '',
        ANOTHER_VAR: 'value',
      };

      mockExec.mockImplementationOnce(mockExecCallback('Environment configured\n'));

      const result = await containerManager.execCommand(testContainerId, 'env', {
        environment,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--env EMPTY_VAR=');
      expect(result.command).toContain('--env ANOTHER_VAR=value');
    });
  });

  describe('TTY and Interactive Mode', () => {
    it('should allocate TTY when requested', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('TTY allocated\n'));

      const result = await containerManager.execCommand(testContainerId, 'tty', {
        tty: true,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--tty');
    });

    it('should enable interactive mode when requested', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('Interactive session\n'));

      const result = await containerManager.execCommand(testContainerId, 'bash --version', {
        interactive: true,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--interactive');
    });

    it('should enable both TTY and interactive mode together', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('Interactive TTY session\n'));

      const result = await containerManager.execCommand(testContainerId, 'bash', {
        tty: true,
        interactive: true,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--tty');
      expect(result.command).toContain('--interactive');
    });

    it('should not include TTY flags when explicitly disabled', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('Non-interactive output\n'));

      const result = await containerManager.execCommand(testContainerId, 'echo test', {
        tty: false,
        interactive: false,
      });

      expect(result.success).toBe(true);
      expect(result.command).not.toContain('--tty');
      expect(result.command).not.toContain('--interactive');
    });
  });

  describe('User Context', () => {
    it('should execute commands as specified user', async () => {
      const user = 'developer';
      const expectedOutput = 'developer\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'whoami', {
        user,
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);
      expect(result.command).toContain(`--user ${user}`);
    });

    it('should support numeric user IDs', async () => {
      const user = '1000';
      const expectedOutput = 'uid=1000(developer) gid=1000(developer)\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'id', {
        user,
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);
      expect(result.command).toContain(`--user ${user}`);
    });

    it('should support user:group format', async () => {
      const user = 'developer:developers';
      const expectedOutput = 'uid=1000(developer) gid=1001(developers)\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'id', {
        user,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain(`--user ${user}`);
    });

    it('should support numeric user:group format', async () => {
      const user = '1000:1001';
      const expectedOutput = 'uid=1000 gid=1001\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'id', {
        user,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain(`--user ${user}`);
    });

    it('should execute as root when user is 0', async () => {
      const user = '0';
      const expectedOutput = 'root\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, 'whoami', {
        user,
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);
      expect(result.command).toContain(`--user ${user}`);
    });
  });

  describe('Command Timeout Handling', () => {
    it('should respect custom timeout values', async () => {
      const timeout = 5000;
      mockExec.mockImplementationOnce(mockExecCallback('Completed within timeout\n'));

      const result = await containerManager.execCommand(testContainerId, 'echo test', {
        timeout,
      });

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout }),
        expect.any(Function)
      );
    });

    it('should use default timeout when not specified', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('Default timeout test\n'));

      const result = await containerManager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 30000 }), // Default 30 seconds
        expect.any(Function)
      );
    });

    it('should handle command timeouts gracefully', async () => {
      const timeout = 1000;
      const timeoutError = new Error('Command timed out') as any;
      timeoutError.code = 'ETIMEDOUT';

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        expect(options.timeout).toBe(timeout);
        setTimeout(() => callback!(timeoutError, '', ''), 10);
        return {} as ChildProcess;
      }));

      const result = await containerManager.execCommand(testContainerId, 'sleep 10', {
        timeout,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124); // Standard timeout exit code
      expect(result.error).toContain(`timed out after ${timeout}ms`);
    });

    it('should handle very short timeouts', async () => {
      const timeout = 100; // Very short timeout
      const timeoutError = new Error('Command timed out') as any;
      timeoutError.code = 'ETIMEDOUT';

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(timeoutError, '', ''), 10);
        return {} as ChildProcess;
      }));

      const result = await containerManager.execCommand(testContainerId, 'sleep 1', {
        timeout,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124);
      expect(result.error).toContain('timed out after 100ms');
    });

    it('should handle very long timeouts', async () => {
      const timeout = 300000; // 5 minutes
      mockExec.mockImplementationOnce(mockExecCallback('Long running command completed\n'));

      const result = await containerManager.execCommand(testContainerId, 'echo "long task"', {
        timeout,
      });

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout }),
        expect.any(Function)
      );
    });
  });

  describe('Combined Options Integration', () => {
    it('should handle all options together successfully', async () => {
      const options: ExecCommandOptions = {
        workingDir: '/app/project',
        user: 'developer:developers',
        timeout: 10000,
        environment: {
          NODE_ENV: 'production',
          DEBUG: 'false',
          API_URL: 'https://api.production.com',
        },
        tty: true,
        interactive: true,
      };

      const expectedOutput = 'All options configured successfully\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(
        testContainerId,
        'echo "All options test"',
        options
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);

      // Verify all options are included in the command
      expect(result.command).toContain(`--workdir ${options.workingDir}`);
      expect(result.command).toContain(`--user ${options.user}`);
      expect(result.command).toContain('--env NODE_ENV=production');
      expect(result.command).toContain('--env DEBUG=false');
      expect(result.command).toContain('--env API_URL=https://api.production.com');
      expect(result.command).toContain('--tty');
      expect(result.command).toContain('--interactive');

      // Verify timeout was passed to exec
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: options.timeout }),
        expect.any(Function)
      );
    });

    it('should work with Podman runtime', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('podman');

      const options: ExecCommandOptions = {
        workingDir: '/workspace',
        user: 'root',
        environment: { CONTAINER_ENGINE: 'podman' },
      };

      mockExec.mockImplementationOnce(mockExecCallback('Podman execution successful\n'));

      const result = await containerManager.execCommand(testContainerId, 'echo "Podman test"', options);

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman exec');
      expect(result.command).toContain('--workdir /workspace');
      expect(result.command).toContain('--user root');
      expect(result.command).toContain('--env CONTAINER_ENGINE=podman');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle no container runtime available', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('none');

      const result = await containerManager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBe('No container runtime available');
    });

    it('should handle command execution exceptions', async () => {
      mockExec.mockImplementationOnce(() => {
        throw new Error('Unexpected execution error');
      });

      const result = await containerManager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Failed to execute command');
    });

    it('should handle empty commands', async () => {
      mockExec.mockImplementationOnce(mockExecCallback(''));

      const result = await containerManager.execCommand(testContainerId, '');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('');
    });

    it('should handle commands with special shell characters', async () => {
      const command = 'echo "test"; ls /tmp && echo "done"';
      const expectedOutput = 'test\nfile1.txt\nfile2.txt\ndone\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await containerManager.execCommand(testContainerId, command);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);
    });

    it('should handle very large command output', async () => {
      const largeOutput = 'line\n'.repeat(10000); // 10k lines
      mockExec.mockImplementationOnce(mockExecCallback(largeOutput));

      const result = await containerManager.execCommand(testContainerId, 'cat large-file.txt');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(largeOutput);
      expect(result.stdout.split('\n')).toHaveLength(10001); // 10k lines + 1 empty
    });

    it('should handle unicode characters in output', async () => {
      const unicodeOutput = '🚀 Deployment successful ✅\n日本語テスト\némoji: 💯\n';
      mockExec.mockImplementationOnce(mockExecCallback(unicodeOutput));

      const result = await containerManager.execCommand(testContainerId, 'echo "unicode test"');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(unicodeOutput);
    });
  });

  describe('Container Runtime Compatibility', () => {
    it('should work with Docker runtime', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('docker');
      mockExec.mockImplementationOnce(mockExecCallback('Docker runtime\n'));

      const result = await containerManager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(true);
      expect(result.command).toContain('docker exec');
    });

    it('should work with Podman runtime', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('podman');
      mockExec.mockImplementationOnce(mockExecCallback('Podman runtime\n'));

      const result = await containerManager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman exec');
    });

    it('should accept explicit runtime type override', async () => {
      // Default runtime is Docker
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('docker');
      mockExec.mockImplementationOnce(mockExecCallback('Explicit podman\n'));

      // Override to use Podman
      const result = await containerManager.execCommand(
        testContainerId,
        'echo test',
        {},
        'podman' as ContainerRuntimeType
      );

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman exec');
    });
  });

  describe('Security and Safety', () => {
    it('should properly escape shell injection attempts', async () => {
      const maliciousCommand = ['echo', 'hello; rm -rf /; echo hacked'];
      mockExec.mockImplementationOnce(mockExecCallback('hello; rm -rf /; echo hacked\n'));

      const result = await containerManager.execCommand(testContainerId, maliciousCommand);

      expect(result.success).toBe(true);
      // Verify command is properly escaped (shell injection prevented)
      expect(result.command).toContain("'hello; rm -rf /; echo hacked'");
    });

    it('should handle privileged mode when requested', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('Privileged operation completed\n'));

      const result = await containerManager.execCommand(testContainerId, 'mount /dev/sda1', {
        privileged: true,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--privileged');
    });

    it('should not include privileged flag when not requested', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('Normal operation\n'));

      const result = await containerManager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(true);
      expect(result.command).not.toContain('--privileged');
    });
  });
});