import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  ContainerManager,
  type ExecCommandOptions,
  type ExecCommandResult,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

// Mock ContainerRuntime
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

// Helper to create a mock exec callback
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any; // Mock ChildProcess
  });
}

// Helper to create an exec error with specific properties
function createExecError(code: number, stdout: string = '', stderr: string = '', message: string = 'Command failed') {
  const error = new Error(message) as any;
  error.code = code;
  error.stdout = stdout;
  error.stderr = stderr;
  return error;
}

/**
 * Acceptance Criteria Validation Tests
 *
 * This test suite validates that the execCommand method meets all acceptance criteria:
 * - ContainerManager has an async execCommand(containerId, command, options?) method
 * - Runs docker/podman exec and returns {success, stdout, stderr, exitCode}
 * - Method supports timeout, working directory, and user options
 * - Unit tests pass
 */
describe('ContainerManager execCommand - Acceptance Criteria Validation', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;
  const testContainerId = 'acceptance-test-container-123';

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('AC1: ContainerManager has async execCommand method with correct signature', () => {
    it('should have execCommand method that is async', () => {
      expect(typeof manager.execCommand).toBe('function');
      expect(manager.execCommand.constructor.name).toBe('AsyncFunction');
    });

    it('should accept containerId, command, and optional options parameters', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('test output\n'));

      // Test with string command
      const result1 = await manager.execCommand(testContainerId, 'echo test');
      expect(result1).toBeDefined();

      mockExec.mockImplementationOnce(mockExecCallback('test output\n'));

      // Test with array command
      const result2 = await manager.execCommand(testContainerId, ['echo', 'test']);
      expect(result2).toBeDefined();

      mockExec.mockImplementationOnce(mockExecCallback('test output\n'));

      // Test with options
      const result3 = await manager.execCommand(testContainerId, 'echo test', {
        timeout: 5000,
        workingDir: '/tmp',
        user: 'testuser',
      });
      expect(result3).toBeDefined();
    });
  });

  describe('AC2: Runs docker/podman exec and returns correct response format', () => {
    it('should execute docker exec command and return success response', async () => {
      const expectedStdout = 'Hello from container\n';
      const expectedStderr = '';

      mockExec.mockImplementationOnce(mockExecCallback(expectedStdout, expectedStderr));

      const result: ExecCommandResult = await manager.execCommand(testContainerId, 'echo "Hello from container"');

      // Validate return type structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('command');

      // Validate success case values
      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedStdout);
      expect(result.stderr).toBe(expectedStderr);
      expect(result.exitCode).toBe(0);
      expect(result.command).toContain('docker exec');
      expect(result.command).toContain(testContainerId);
    });

    it('should execute podman exec command when podman runtime is available', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('podman');

      const expectedStdout = 'Podman output\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedStdout));

      const result = await manager.execCommand(testContainerId, 'echo "Podman test"');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedStdout);
      expect(result.exitCode).toBe(0);
      expect(result.command).toContain('podman exec');
    });

    it('should return failure response with correct exit code on command failure', async () => {
      const expectedStdout = '';
      const expectedStderr = 'Command not found: nonexistent-command';
      const expectedExitCode = 127;

      const error = createExecError(expectedExitCode, expectedStdout, expectedStderr);

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(error, expectedStdout, expectedStderr), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(testContainerId, 'nonexistent-command');

      expect(result.success).toBe(false);
      expect(result.stdout).toBe(expectedStdout);
      expect(result.stderr).toBe(expectedStderr);
      expect(result.exitCode).toBe(expectedExitCode);
    });

    it('should capture both stdout and stderr in mixed output scenarios', async () => {
      const expectedStdout = 'Normal output line\nAnother normal line\n';
      const expectedStderr = 'Warning: deprecated option\nError: file not found\n';
      const expectedExitCode = 2;

      const error = createExecError(expectedExitCode, expectedStdout, expectedStderr);

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(error, expectedStdout, expectedStderr), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(testContainerId, 'mixed-output-command');

      expect(result.success).toBe(false);
      expect(result.stdout).toBe(expectedStdout);
      expect(result.stderr).toBe(expectedStderr);
      expect(result.exitCode).toBe(expectedExitCode);
    });
  });

  describe('AC3: Method supports timeout, working directory, and user options', () => {
    it('should support timeout option and handle timeout correctly', async () => {
      const timeoutMs = 2000;
      const timeoutError = new Error('Command timed out') as any;
      timeoutError.code = 'ETIMEDOUT';

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        // Verify timeout is passed to exec
        expect(options.timeout).toBe(timeoutMs);
        setTimeout(() => callback!(timeoutError, '', ''), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(testContainerId, 'sleep 10', {
        timeout: timeoutMs,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124); // Standard timeout exit code
      expect(result.error).toContain(`timed out after ${timeoutMs}ms`);
    });

    it('should support working directory option', async () => {
      const workingDir = '/app/src';
      const expectedOutput = '/app/src\n';

      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await manager.execCommand(testContainerId, 'pwd', {
        workingDir: workingDir,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain(`--workdir ${workingDir}`);
      expect(result.stdout).toBe(expectedOutput);
    });

    it('should support user option in various formats', async () => {
      const testCases = [
        { user: 'root', expectedOutput: 'root\n' },
        { user: 'node', expectedOutput: 'node\n' },
        { user: '1000:1000', expectedOutput: 'uid=1000(user) gid=1000(user)\n' },
        { user: '0', expectedOutput: 'root\n' },
      ];

      for (const testCase of testCases) {
        mockExec.mockImplementationOnce(mockExecCallback(testCase.expectedOutput));

        const result = await manager.execCommand(testContainerId, 'whoami', {
          user: testCase.user,
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain(`--user ${testCase.user}`);
        expect(result.stdout).toBe(testCase.expectedOutput);

        vi.clearAllMocks();
      }
    });

    it('should support all three required options together', async () => {
      const options: ExecCommandOptions = {
        timeout: 10000,
        workingDir: '/workspace/project',
        user: 'developer',
      };

      const expectedOutput = 'Command executed successfully from /workspace/project as developer\n';
      mockExec.mockImplementationOnce(mockExecCallback(expectedOutput));

      const result = await manager.execCommand(
        testContainerId,
        'echo "Command executed successfully from $(pwd) as $(whoami)"',
        options
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(expectedOutput);

      // Verify all options are included in the command
      expect(result.command).toContain(`--workdir ${options.workingDir}`);
      expect(result.command).toContain(`--user ${options.user}`);

      // Verify timeout was passed to exec
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: options.timeout }),
        expect.any(Function)
      );
    });

    it('should use default timeout when not specified', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('default timeout test\n'));

      const result = await manager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 30000 }), // Default 30 seconds
        expect.any(Function)
      );
    });
  });

  describe('AC4: Extended functionality beyond minimum requirements', () => {
    it('should support environment variables option', async () => {
      const environment = {
        NODE_ENV: 'test',
        API_URL: 'https://api.test.com',
        DEBUG: 'true',
      };

      mockExec.mockImplementationOnce(mockExecCallback('Environment variables set\n'));

      const result = await manager.execCommand(testContainerId, 'printenv', {
        environment,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--env NODE_ENV=test');
      expect(result.command).toContain('--env API_URL=https://api.test.com');
      expect(result.command).toContain('--env DEBUG=true');
    });

    it('should support TTY and interactive options', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('Interactive session output\n'));

      const result = await manager.execCommand(testContainerId, 'bash', {
        tty: true,
        interactive: true,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--tty');
      expect(result.command).toContain('--interactive');
    });

    it('should support privileged option', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('Privileged command output\n'));

      const result = await manager.execCommand(testContainerId, 'mount', {
        privileged: true,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--privileged');
    });
  });

  describe('AC5: Error handling and edge cases', () => {
    it('should handle no container runtime available', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('none');

      const result = await manager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBe('No container runtime available');
    });

    it('should handle command execution exceptions gracefully', async () => {
      mockExec.mockImplementationOnce(() => {
        throw new Error('Unexpected system error');
      });

      const result = await manager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Failed to execute command');
    });

    it('should handle empty stdout and stderr', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('', ''));

      const result = await manager.execCommand(testContainerId, 'true');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should properly escape shell arguments to prevent injection', async () => {
      const potentialInjection = 'test; rm -rf /; echo hacked';
      mockExec.mockImplementationOnce(mockExecCallback('safe output\n'));

      const result = await manager.execCommand(testContainerId, ['echo', potentialInjection]);

      expect(result.success).toBe(true);
      // Command should be properly escaped
      expect(result.command).toContain("'test; rm -rf /; echo hacked'");
    });
  });

  describe('AC6: Type safety and interface compliance', () => {
    it('should return ExecCommandResult with correct TypeScript types', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('type test\n'));

      const result = await manager.execCommand(testContainerId, 'echo test');

      // TypeScript compile-time checks ensure these properties exist and have correct types
      const success: boolean = result.success;
      const stdout: string = result.stdout;
      const stderr: string = result.stderr;
      const exitCode: number = result.exitCode;
      const command: string | undefined = result.command;
      const error: string | undefined = result.error;

      expect(typeof success).toBe('boolean');
      expect(typeof stdout).toBe('string');
      expect(typeof stderr).toBe('string');
      expect(typeof exitCode).toBe('number');
      if (command) expect(typeof command).toBe('string');
      if (error) expect(typeof error).toBe('string');
    });

    it('should accept ExecCommandOptions with correct TypeScript types', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('options test\n'));

      const options: ExecCommandOptions = {
        workingDir: '/test',
        user: 'testuser',
        timeout: 5000,
        environment: { TEST: 'value' },
        tty: false,
        interactive: false,
        privileged: false,
      };

      const result = await manager.execCommand(testContainerId, 'echo test', options);

      expect(result.success).toBe(true);
    });
  });
});