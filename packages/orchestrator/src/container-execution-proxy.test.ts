/**
 * Comprehensive unit tests for ContainerExecutionProxy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import {
  ContainerExecutionProxy,
  createContainerExecutionProxy,
  type ExecutionContext,
  type CommandExecutionOptions,
  type CommandExecutionResult,
  type ContainerExecutionProxyEvents,
  type ExecutionStartedEvent,
  type ExecutionCompletedEvent,
  type ExecutionFailedEvent,
} from './container-execution-proxy';
import type {
  ContainerManager,
  ExecCommandOptions,
  ExecCommandResult,
  ContainerRuntimeType,
} from '@apexcli/core';

// Mock child_process exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock util promisify
vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn),
}));

describe('ContainerExecutionProxy', () => {
  let mockContainerManager: ContainerManager;
  let proxy: ContainerExecutionProxy;

  beforeEach(() => {
    // Create mock ContainerManager
    mockContainerManager = {
      execCommand: vi.fn(),
    } as unknown as ContainerManager;

    proxy = new ContainerExecutionProxy(mockContainerManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create proxy with default timeout', () => {
      const newProxy = new ContainerExecutionProxy(mockContainerManager);
      expect(newProxy).toBeInstanceOf(ContainerExecutionProxy);
    });

    it('should create proxy with custom timeout', () => {
      const newProxy = new ContainerExecutionProxy(mockContainerManager, { defaultTimeout: 60000 });
      expect(newProxy).toBeInstanceOf(ContainerExecutionProxy);
    });
  });

  describe('determineExecutionMode', () => {
    it('should return "container" when container workspace is active with containerId', () => {
      const context: ExecutionContext = {
        taskId: 'task-123',
        containerId: 'container-abc',
        isContainerWorkspace: true,
        runtimeType: 'docker',
      };

      expect(proxy.isContainerExecutionAvailable(context)).toBe(true);
    });

    it('should return "local" when isContainerWorkspace is false', () => {
      const context: ExecutionContext = {
        taskId: 'task-123',
        isContainerWorkspace: false,
      };

      expect(proxy.isContainerExecutionAvailable(context)).toBe(false);
    });

    it('should return "local" when containerId is missing', () => {
      const context: ExecutionContext = {
        taskId: 'task-123',
        isContainerWorkspace: true,
        // No containerId
      };

      expect(proxy.isContainerExecutionAvailable(context)).toBe(false);
    });
  });

  describe('execute - container mode', () => {
    const containerContext: ExecutionContext = {
      taskId: 'task-123',
      containerId: 'container-abc',
      isContainerWorkspace: true,
      runtimeType: 'docker',
      workingDir: '/workspace',
    };

    it('should route command to containerManager.execCommand', async () => {
      const mockResult: ExecCommandResult = {
        success: true,
        stdout: 'command output',
        stderr: '',
        exitCode: 0,
        command: 'echo hello',
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue(mockResult);

      const result = await proxy.execute('echo hello', containerContext);

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'container-abc',
        'echo hello',
        expect.objectContaining({
          timeout: 30000,
          workingDir: '/workspace',
        }),
        'docker'
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('command output');
      expect(result.mode).toBe('container');
    });

    it('should pass custom timeout to container execution', async () => {
      const mockResult: ExecCommandResult = {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue(mockResult);

      await proxy.execute('npm install', containerContext, { timeout: 120000 });

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'container-abc',
        'npm install',
        expect.objectContaining({
          timeout: 120000,
        }),
        'docker'
      );
    });

    it('should handle container execution failure', async () => {
      const mockResult: ExecCommandResult = {
        success: false,
        stdout: '',
        stderr: 'command not found',
        exitCode: 127,
        error: 'Command not found',
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue(mockResult);

      const result = await proxy.execute('unknown-command', containerContext);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(127);
      expect(result.error).toBe('Command not found');
      expect(result.mode).toBe('container');
    });

    it('should pass environment variables to container', async () => {
      const mockResult: ExecCommandResult = {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue(mockResult);

      await proxy.execute('env', containerContext, {
        environment: { NODE_ENV: 'test' },
      });

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'container-abc',
        'env',
        expect.objectContaining({
          environment: { NODE_ENV: 'test' },
        }),
        'docker'
      );
    });

    it('should pass user option to container', async () => {
      const mockResult: ExecCommandResult = {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue(mockResult);

      await proxy.execute('whoami', containerContext, { user: 'node' });

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'container-abc',
        'whoami',
        expect.objectContaining({
          user: 'node',
        }),
        'docker'
      );
    });

    it('should handle array command format', async () => {
      const mockResult: ExecCommandResult = {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue(mockResult);

      await proxy.execute(['npm', 'test', '--coverage'], containerContext);

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'container-abc',
        ['npm', 'test', '--coverage'],
        expect.any(Object),
        'docker'
      );
    });
  });

  describe('execute - local mode', () => {
    const localContext: ExecutionContext = {
      taskId: 'task-456',
      isContainerWorkspace: false,
    };

    it('should execute command locally when not in container', async () => {
      // Mock the exec function
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation(((_cmd: string, _opts: unknown, callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void) => {
        if (callback) {
          callback(null, { stdout: 'local output', stderr: '' });
        }
        return {} as ReturnType<typeof exec>;
      }) as typeof exec);

      const result = await proxy.execute('echo hello', localContext);

      expect(result.mode).toBe('local');
      expect(mockContainerManager.execCommand).not.toHaveBeenCalled();
    });

    it('should use local execution when containerId is missing', async () => {
      const contextWithoutContainer: ExecutionContext = {
        taskId: 'task-789',
        isContainerWorkspace: true,
        // containerId is missing
      };

      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation(((_cmd: string, _opts: unknown, callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void) => {
        if (callback) {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as ReturnType<typeof exec>;
      }) as typeof exec);

      const result = await proxy.execute('ls', contextWithoutContainer);

      expect(result.mode).toBe('local');
    });
  });

  describe('executeSequential', () => {
    const containerContext: ExecutionContext = {
      taskId: 'task-123',
      containerId: 'container-abc',
      isContainerWorkspace: true,
      runtimeType: 'docker',
    };

    it('should execute commands in sequence', async () => {
      vi.mocked(mockContainerManager.execCommand)
        .mockResolvedValueOnce({
          success: true,
          stdout: 'first',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          success: true,
          stdout: 'second',
          stderr: '',
          exitCode: 0,
        });

      const results = await proxy.executeSequential(
        ['cmd1', 'cmd2'],
        containerContext
      );

      expect(results).toHaveLength(2);
      expect(results[0].stdout).toBe('first');
      expect(results[1].stdout).toBe('second');
    });

    it('should stop on first failure', async () => {
      vi.mocked(mockContainerManager.execCommand)
        .mockResolvedValueOnce({
          success: false,
          stdout: '',
          stderr: 'error',
          exitCode: 1,
        })
        .mockResolvedValueOnce({
          success: true,
          stdout: 'should not reach',
          stderr: '',
          exitCode: 0,
        });

      const results = await proxy.executeSequential(
        ['cmd1', 'cmd2'],
        containerContext
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(mockContainerManager.execCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe('events', () => {
    const containerContext: ExecutionContext = {
      taskId: 'task-123',
      containerId: 'container-abc',
      isContainerWorkspace: true,
      runtimeType: 'docker',
    };

    it('should emit execution:started event', async () => {
      const startedHandler = vi.fn();
      proxy.on('execution:started', startedHandler);

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await proxy.execute('echo test', containerContext);

      expect(startedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-123',
          command: 'echo test',
          mode: 'container',
          containerId: 'container-abc',
        })
      );
    });

    it('should emit execution:completed event on success', async () => {
      const completedHandler = vi.fn();
      proxy.on('execution:completed', completedHandler);

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue({
        success: true,
        stdout: 'output',
        stderr: '',
        exitCode: 0,
      });

      await proxy.execute('echo success', containerContext);

      expect(completedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-123',
          command: 'echo success',
          mode: 'container',
          result: expect.objectContaining({
            success: true,
            stdout: 'output',
          }),
        })
      );
    });

    it('should emit execution:failed event on failure', async () => {
      const failedHandler = vi.fn();
      proxy.on('execution:failed', failedHandler);

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'error output',
        exitCode: 1,
        error: 'Command failed',
      });

      await proxy.execute('bad-command', containerContext);

      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-123',
          command: 'bad-command',
          mode: 'container',
          error: 'Command failed',
          exitCode: 1,
        })
      );
    });

    it('should emit execution:failed on exception', async () => {
      const failedHandler = vi.fn();
      proxy.on('execution:failed', failedHandler);

      vi.mocked(mockContainerManager.execCommand).mockRejectedValue(
        new Error('Container not running')
      );

      const result = await proxy.execute('echo test', containerContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Container not running');
      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Container not running',
        })
      );
    });
  });

  describe('timeout handling', () => {
    const containerContext: ExecutionContext = {
      taskId: 'task-123',
      containerId: 'container-abc',
      isContainerWorkspace: true,
      runtimeType: 'docker',
    };

    it('should use default timeout when not specified', async () => {
      vi.mocked(mockContainerManager.execCommand).mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await proxy.execute('cmd', containerContext);

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          timeout: 30000,
        }),
        expect.any(String)
      );
    });

    it('should use custom default timeout from constructor', async () => {
      const customProxy = new ContainerExecutionProxy(mockContainerManager, {
        defaultTimeout: 60000,
      });

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await customProxy.execute('cmd', containerContext);

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          timeout: 60000,
        }),
        expect.any(String)
      );
    });

    it('should prefer execution option timeout over default', async () => {
      vi.mocked(mockContainerManager.execCommand).mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await proxy.execute('cmd', containerContext, { timeout: 120000 });

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          timeout: 120000,
        }),
        expect.any(String)
      );
    });
  });

  describe('error propagation', () => {
    const containerContext: ExecutionContext = {
      taskId: 'task-123',
      containerId: 'container-abc',
      isContainerWorkspace: true,
      runtimeType: 'docker',
    };

    it('should propagate container manager errors', async () => {
      vi.mocked(mockContainerManager.execCommand).mockRejectedValue(
        new Error('Docker daemon not running')
      );

      const result = await proxy.execute('cmd', containerContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Docker daemon not running');
      expect(result.exitCode).toBe(1);
    });

    it('should include duration even on error', async () => {
      vi.mocked(mockContainerManager.execCommand).mockRejectedValue(
        new Error('Test error')
      );

      const result = await proxy.execute('cmd', containerContext);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getContainerManager', () => {
    it('should return the container manager instance', () => {
      expect(proxy.getContainerManager()).toBe(mockContainerManager);
    });
  });

  // === Enhanced and Additional Tests ===

  describe('Factory Function', () => {
    it('should create proxy via factory function', () => {
      const testProxy = createContainerExecutionProxy(mockContainerManager);
      expect(testProxy).toBeInstanceOf(ContainerExecutionProxy);
    });

    it('should create proxy via factory function with options', () => {
      const testProxy = createContainerExecutionProxy(mockContainerManager, {
        defaultTimeout: 45000,
      });
      expect(testProxy).toBeInstanceOf(ContainerExecutionProxy);
    });
  });

  describe('Local Execution - Enhanced Tests', () => {
    const localContext: ExecutionContext = {
      taskId: 'local-enhanced-test',
      isContainerWorkspace: false,
    };

    beforeEach(() => {
      // Reset exec mock for each test
      vi.mocked(exec).mockReset();
    });

    it('should handle local execution with custom working directory and environment', async () => {
      let actualOptions: any;
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        actualOptions = options;
        if (typeof callback === 'function') {
          callback(null, { stdout: 'Custom env output', stderr: '' });
        }
        return {} as any;
      });

      const options: CommandExecutionOptions = {
        workingDir: '/custom/path',
        environment: { NODE_ENV: 'test', DEBUG: 'true' },
      };

      const result = await proxy.execute('pwd', localContext, options);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('Custom env output');
      expect(actualOptions).toMatchObject({
        cwd: '/custom/path',
        env: expect.objectContaining({
          NODE_ENV: 'test',
          DEBUG: 'true',
        }),
      });
    });

    it('should handle local execution timeout gracefully', async () => {
      const timeoutError = new Error('Command timeout') as any;
      timeoutError.code = 'ETIMEDOUT';

      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(timeoutError, null);
        }
        return {} as any;
      });

      const result = await proxy.execute('sleep 100', localContext, { timeout: 5000 });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124); // Standard timeout exit code
      expect(result.error).toContain('timed out after 5000ms');
      expect(result.mode).toBe('local');
    });

    it('should handle undefined stdout/stderr in local execution', async () => {
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: undefined, stderr: undefined } as any);
        }
        return {} as any;
      });

      const result = await proxy.execute('echo test', localContext);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('should handle non-numeric exit codes', async () => {
      const execError = new Error('Command failed') as any;
      execError.code = 'ENOENT'; // String code
      execError.stdout = 'partial output';
      execError.stderr = 'file not found';

      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(execError, null);
        }
        return {} as any;
      });

      const result = await proxy.execute('nonexistent-command', localContext);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1); // Default for non-numeric codes
      expect(result.error).toContain('Command execution failed');
    });
  });

  describe('Container Execution - Enhanced Tests', () => {
    const containerContext: ExecutionContext = {
      taskId: 'container-enhanced-test',
      containerId: 'test-container',
      isContainerWorkspace: true,
      runtimeType: 'docker',
      workingDir: '/workspace',
    };

    it('should handle container execution with podman runtime', async () => {
      const podmanContext: ExecutionContext = {
        ...containerContext,
        runtimeType: 'podman',
      };

      const mockResult: ExecCommandResult = {
        success: true,
        stdout: 'podman output',
        stderr: '',
        exitCode: 0,
        command: 'echo podman',
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue(mockResult);

      const result = await proxy.execute('echo podman', podmanContext);

      expect(result.mode).toBe('container');
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'echo podman',
        expect.any(Object),
        'podman'
      );
    });

    it('should handle container execution without runtime type', async () => {
      const noRuntimeContext: ExecutionContext = {
        taskId: 'no-runtime-test',
        containerId: 'test-container',
        isContainerWorkspace: true,
        // runtimeType is undefined
      };

      const mockResult: ExecCommandResult = {
        success: true,
        stdout: 'output',
        stderr: '',
        exitCode: 0,
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue(mockResult);

      const result = await proxy.execute('echo test', noRuntimeContext);

      expect(result.mode).toBe('container');
      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'echo test',
        expect.any(Object),
        undefined
      );
    });

    it('should prioritize options.workingDir over context.workingDir', async () => {
      const mockResult: ExecCommandResult = {
        success: true,
        stdout: 'output',
        stderr: '',
        exitCode: 0,
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue(mockResult);

      const options: CommandExecutionOptions = {
        workingDir: '/override/dir',
      };

      await proxy.execute('pwd', containerContext, options);

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'test-container',
        'pwd',
        expect.objectContaining({
          workingDir: '/override/dir',
        }),
        'docker'
      );
    });

    it('should throw error when container ID is required but missing', async () => {
      const invalidContext: ExecutionContext = {
        taskId: 'invalid-test',
        isContainerWorkspace: true,
        runtimeType: 'docker',
        // containerId is missing but required
      };

      // Mock the private method to force container mode
      const spy = vi.spyOn(proxy as any, 'determineExecutionMode').mockReturnValue('container');

      try {
        const result = await proxy.execute('echo test', invalidContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Container ID required');
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('Event System - Enhanced Tests', () => {
    let eventsReceived: Array<{ event: string; data: any }>;

    beforeEach(() => {
      eventsReceived = [];

      // Set up event listeners
      proxy.on('execution:started', (data) => {
        eventsReceived.push({ event: 'execution:started', data });
      });
      proxy.on('execution:completed', (data) => {
        eventsReceived.push({ event: 'execution:completed', data });
      });
      proxy.on('execution:failed', (data) => {
        eventsReceived.push({ event: 'execution:failed', data });
      });
      proxy.on('command:blocked', (data) => {
        eventsReceived.push({ event: 'command:blocked', data });
      });
    });

    afterEach(() => {
      proxy.removeAllListeners();
    });

    it('should emit events with correct timestamps and data structure', async () => {
      const startTime = Date.now();

      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'success', stderr: '' });
        }
        return {} as any;
      });

      const context: ExecutionContext = {
        taskId: 'event-timing-test',
        isContainerWorkspace: false,
      };

      await proxy.execute('echo test', context, { workingDir: '/test/dir' });

      const endTime = Date.now();

      const startedEvents = eventsReceived.filter(e => e.event === 'execution:started');
      const completedEvents = eventsReceived.filter(e => e.event === 'execution:completed');

      expect(startedEvents).toHaveLength(1);
      expect(completedEvents).toHaveLength(1);

      const startedEvent = startedEvents[0].data as ExecutionStartedEvent;
      expect(startedEvent).toMatchObject({
        taskId: 'event-timing-test',
        command: 'echo test',
        mode: 'local',
        workingDir: '/test/dir',
        timestamp: expect.any(Date),
      });

      const completedEvent = completedEvents[0].data as ExecutionCompletedEvent;
      expect(completedEvent).toMatchObject({
        taskId: 'event-timing-test',
        command: 'echo test',
        mode: 'local',
        result: expect.objectContaining({
          success: true,
          stdout: 'success',
        }),
        timestamp: expect.any(Date),
      });

      // Verify timestamps are reasonable
      expect(startedEvent.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(completedEvent.timestamp.getTime()).toBeLessThanOrEqual(endTime);
    });

    it('should emit failed events for both command failures and exceptions', async () => {
      // First test: command failure
      const execError = new Error('Command failed') as any;
      execError.code = 42;
      execError.stdout = 'partial';
      execError.stderr = 'error msg';

      vi.mocked(exec).mockImplementationOnce((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(execError, null);
        }
        return {} as any;
      });

      const context: ExecutionContext = {
        taskId: 'failure-test',
        isContainerWorkspace: false,
      };

      await proxy.execute('failing-command', context);

      let failedEvents = eventsReceived.filter(e => e.event === 'execution:failed');
      expect(failedEvents).toHaveLength(1);

      const failedEvent1 = failedEvents[0].data as ExecutionFailedEvent;
      expect(failedEvent1).toMatchObject({
        taskId: 'failure-test',
        command: 'failing-command',
        mode: 'local',
        exitCode: 42,
        timestamp: expect.any(Date),
      });

      // Clear events for second test
      eventsReceived = [];

      // Second test: exception during execution
      vi.mocked(exec).mockImplementationOnce(() => {
        throw new Error('Unexpected exception');
      });

      await proxy.execute('exception-command', context);

      failedEvents = eventsReceived.filter(e => e.event === 'execution:failed');
      expect(failedEvents).toHaveLength(1);

      const failedEvent2 = failedEvents[0].data as ExecutionFailedEvent;
      expect(failedEvent2).toMatchObject({
        taskId: 'failure-test',
        command: 'exception-command',
        mode: 'local',
        error: 'Unexpected exception',
        exitCode: 1,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined commands gracefully', async () => {
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'handled', stderr: '' });
        }
        return {} as any;
      });

      const context: ExecutionContext = {
        taskId: 'null-test',
        isContainerWorkspace: false,
      };

      // Test null command
      const result1 = await proxy.execute(null as any, context);
      expect(result1.command).toBe('null');

      // Test undefined command
      const result2 = await proxy.execute(undefined as any, context);
      expect(result2.command).toBe('undefined');

      // Test empty string
      const result3 = await proxy.execute('', context);
      expect(result3.command).toBe('');

      // Test empty array
      const result4 = await proxy.execute([], context);
      expect(result4.command).toBe('');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      vi.mocked(exec).mockImplementation(() => {
        throw 'String error message';
      });

      const context: ExecutionContext = {
        taskId: 'non-error-exception',
        isContainerWorkspace: false,
      };

      const result = await proxy.execute('echo test', context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error message');
      expect(result.exitCode).toBe(1);
    });

    it('should maintain result consistency across all execution modes', async () => {
      const contexts = [
        {
          taskId: 'consistency-local',
          isContainerWorkspace: false,
        },
        {
          taskId: 'consistency-container',
          containerId: 'test-container',
          isContainerWorkspace: true,
          runtimeType: 'docker' as ContainerRuntimeType,
        },
      ];

      // Mock both execution paths
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'local output', stderr: 'local warning' });
        }
        return {} as any;
      });

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue({
        success: true,
        stdout: 'container output',
        stderr: 'container warning',
        exitCode: 0,
        command: 'echo test',
      });

      const results = await Promise.all(
        contexts.map(context => proxy.execute('echo test', context))
      );

      for (const result of results) {
        // Verify all required fields are present with correct types
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('stdout');
        expect(result).toHaveProperty('stderr');
        expect(result).toHaveProperty('exitCode');
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('mode');
        expect(result).toHaveProperty('command');

        expect(typeof result.success).toBe('boolean');
        expect(typeof result.stdout).toBe('string');
        expect(typeof result.stderr).toBe('string');
        expect(typeof result.exitCode).toBe('number');
        expect(typeof result.duration).toBe('number');
        expect(['container', 'local']).toContain(result.mode);
        expect(typeof result.command).toBe('string');

        // Duration should be positive
        expect(result.duration).toBeGreaterThanOrEqual(0);
      }

      expect(results[0].mode).toBe('local');
      expect(results[1].mode).toBe('container');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle rapid sequential execution without memory leaks', async () => {
      let callCount = 0;
      vi.mocked(exec).mockImplementation((command, options, callback) => {
        callCount++;
        if (typeof callback === 'function') {
          callback(null, { stdout: `output ${callCount}`, stderr: '' });
        }
        return {} as any;
      });

      const context: ExecutionContext = {
        taskId: 'performance-test',
        isContainerWorkspace: false,
      };

      const promises = Array.from({ length: 100 }, (_, i) =>
        proxy.execute(`echo ${i}`, context)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every(r => r.success)).toBe(true);
      expect(callCount).toBe(100);

      // Verify results are in correct order (though they may complete out of order)
      results.forEach((result, index) => {
        expect(result.mode).toBe('local');
        expect(result.command).toBe(`echo ${index}`);
      });
    });

    it('should clean up event listeners properly', () => {
      const testProxy = new ContainerExecutionProxy(mockContainerManager);

      // Add multiple listeners
      const listeners = Array.from({ length: 10 }, () => vi.fn());
      listeners.forEach((listener, i) => {
        testProxy.on('execution:started', listener);
        testProxy.on('execution:completed', listener);
        testProxy.on('execution:failed', listener);
      });

      expect(testProxy.listenerCount('execution:started')).toBe(10);
      expect(testProxy.listenerCount('execution:completed')).toBe(10);
      expect(testProxy.listenerCount('execution:failed')).toBe(10);

      testProxy.removeAllListeners();

      expect(testProxy.listenerCount('execution:started')).toBe(0);
      expect(testProxy.listenerCount('execution:completed')).toBe(0);
      expect(testProxy.listenerCount('execution:failed')).toBe(0);
    });
  });

  describe('Integration with ContainerManager', () => {
    it('should pass all ExecCommandOptions correctly to ContainerManager', async () => {
      const fullOptions: CommandExecutionOptions = {
        timeout: 45000,
        workingDir: '/custom/workspace',
        environment: { NODE_ENV: 'production', API_KEY: 'secret' },
        user: 'appuser',
      };

      const context: ExecutionContext = {
        taskId: 'full-options-test',
        containerId: 'prod-container',
        isContainerWorkspace: true,
        runtimeType: 'podman',
        workingDir: '/default/workspace', // Should be overridden by options
      };

      vi.mocked(mockContainerManager.execCommand).mockResolvedValue({
        success: true,
        stdout: 'success',
        stderr: '',
        exitCode: 0,
      });

      await proxy.execute(['npm', 'run', 'build'], context, fullOptions);

      expect(mockContainerManager.execCommand).toHaveBeenCalledWith(
        'prod-container',
        ['npm', 'run', 'build'],
        {
          timeout: 45000,
          workingDir: '/custom/workspace',
          environment: { NODE_ENV: 'production', API_KEY: 'secret' },
          user: 'appuser',
        },
        'podman'
      );
    });

    it('should handle ContainerManager exceptions gracefully', async () => {
      const containerError = new Error('Container runtime not available');
      vi.mocked(mockContainerManager.execCommand).mockRejectedValue(containerError);

      const context: ExecutionContext = {
        taskId: 'container-error-test',
        containerId: 'failing-container',
        isContainerWorkspace: true,
        runtimeType: 'docker',
      };

      const result = await proxy.execute('echo test', context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Container runtime not available');
      expect(result.mode).toBe('container');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Command Format Handling', () => {
    it('should handle various command formats consistently', async () => {
      const testCases = [
        { input: 'echo hello', expected: 'echo hello' },
        { input: ['echo', 'hello'], expected: 'echo hello' },
        { input: ['npm', 'run', 'test', '--coverage'], expected: 'npm run test --coverage' },
        { input: '', expected: '' },
        { input: [], expected: '' },
      ];

      vi.mocked(exec).mockImplementation((command, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, { stdout: 'output', stderr: '' });
        }
        return {} as any;
      });

      const context: ExecutionContext = {
        taskId: 'format-test',
        isContainerWorkspace: false,
      };

      for (const testCase of testCases) {
        const result = await proxy.execute(testCase.input as any, context);
        expect(result.command).toBe(testCase.expected);
        expect(result.success).toBe(true);
      }
    });
  });
});
