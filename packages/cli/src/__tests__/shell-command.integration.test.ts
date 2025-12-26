/**
 * Integration tests for the /shell command
 * Tests the command with real container manager and workspace manager interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { spawn } from 'child_process';
import type { CliContext } from '../index.js';

// Mock external dependencies
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    cyan: (str: string) => str,
    bold: (str: string) => str,
    magenta: { bold: (str: string) => str },
  },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock process for spawn
class MockShellProcess {
  private listeners: { [key: string]: ((...args: any[]) => void)[] } = {};

  constructor(
    private exitCode: number = 0,
    private error?: Error
  ) {}

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Simulate async events
    if (event === 'close' && this.error === undefined) {
      setTimeout(() => callback(this.exitCode), 5);
    } else if (event === 'error' && this.error) {
      setTimeout(() => callback(this.error), 5);
    }

    return this;
  }

  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => listener(...args));
    }
  }
}

describe('Shell Command Integration Tests', () => {
  let mockContext: CliContext;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: {
          name: 'Test Project',
          description: 'Test project description',
        },
        agents: {},
        workflows: {},
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          timeoutMs: 300000,
        },
        autonomy: {
          default: 'medium',
          autoApprove: false,
        },
        api: {
          url: 'http://localhost:3000',
          port: 3000,
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
      },
      orchestrator: null as any, // Will be mocked per test
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle complete workflow with Docker runtime', async () => {
    // Setup mock orchestrator with realistic data
    const mockTask = {
      id: 'task_12345abcdef',
      description: 'Build React application',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContainer = {
      name: 'apex-task-task_12345abcdef',
      id: 'docker_container_456789',
      status: 'running',
      image: 'node:18-alpine',
      ports: ['3000:3000']
    };

    const mockContainerManager = {
      listApexContainers: vi.fn().mockResolvedValue([mockContainer]),
      getContainerInfo: vi.fn().mockResolvedValue(mockContainer),
    };

    const mockWorkspaceManager = {
      getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getContainerRuntime: vi.fn().mockReturnValue('docker'),
    };

    const mockOrchestrator = {
      listTasks: vi.fn().mockResolvedValue([mockTask]),
      getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
    };

    mockContext.orchestrator = mockOrchestrator;

    // Setup spawn mock to return successful process
    const mockProcess = new MockShellProcess(0);
    mockSpawn.mockReturnValue(mockProcess as any);

    const { commands } = await import('../index.js');
    const shellCommand = commands.find(cmd => cmd.name === 'shell');
    expect(shellCommand).toBeDefined();

    // Execute shell command
    await shellCommand!.handler(mockContext, ['task_12345']);

    // Allow async operations to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify orchestrator interactions
    expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 100 });
    expect(mockOrchestrator.getWorkspaceManager).toHaveBeenCalled();
    expect(mockWorkspaceManager.getContainerManager).toHaveBeenCalled();
    expect(mockWorkspaceManager.getContainerRuntime).toHaveBeenCalled();
    expect(mockContainerManager.listApexContainers).toHaveBeenCalled();

    // Verify container matching logic
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('🐚 Attaching to container for task task_12345abc...')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Container: apex-task-task_12345abcdef')
    );

    // Verify spawn call with correct parameters
    expect(mockSpawn).toHaveBeenCalledWith(
      'docker',
      ['exec', '--interactive', '--tty', 'docker_container_456789', '/bin/bash'],
      {
        stdio: 'inherit',
        env: process.env
      }
    );
  });

  it('should handle Podman runtime correctly', async () => {
    const mockTask = {
      id: 'podman_task_987654',
      description: 'Deploy microservice',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContainer = {
      name: 'apex-task-podman_task_987654',
      id: 'podman_container_321',
      status: 'running'
    };

    const mockContainerManager = {
      listApexContainers: vi.fn().mockResolvedValue([mockContainer]),
    };

    const mockWorkspaceManager = {
      getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getContainerRuntime: vi.fn().mockReturnValue('podman'),
    };

    const mockOrchestrator = {
      listTasks: vi.fn().mockResolvedValue([mockTask]),
      getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
    };

    mockContext.orchestrator = mockOrchestrator;

    const mockProcess = new MockShellProcess(0);
    mockSpawn.mockReturnValue(mockProcess as any);

    const { commands } = await import('../index.js');
    const shellCommand = commands.find(cmd => cmd.name === 'shell');

    await shellCommand!.handler(mockContext, ['podman_task']);

    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify podman runtime is used
    expect(mockSpawn).toHaveBeenCalledWith(
      'podman',
      ['exec', '--interactive', '--tty', 'podman_container_321', '/bin/bash'],
      {
        stdio: 'inherit',
        env: process.env
      }
    );
  });

  it('should handle complex command execution scenarios', async () => {
    const mockTask = {
      id: 'complex_command_task_123',
      description: 'Data processing pipeline',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContainer = {
      name: 'apex-task-complex_command_task_123',
      id: 'container_abc789',
      status: 'running'
    };

    const mockContainerManager = {
      listApexContainers: vi.fn().mockResolvedValue([mockContainer]),
    };

    const mockWorkspaceManager = {
      getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getContainerRuntime: vi.fn().mockReturnValue('docker'),
    };

    const mockOrchestrator = {
      listTasks: vi.fn().mockResolvedValue([mockTask]),
      getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
    };

    mockContext.orchestrator = mockOrchestrator;

    const testCases = [
      {
        args: ['complex_command', 'ps', 'aux'],
        expectedCommand: ['ps', 'aux'],
        description: 'simple multi-word command'
      },
      {
        args: ['complex_command', 'find', '/app', '-name', '*.js'],
        expectedCommand: ['/bin/sh', '-c', 'find /app -name *.js'],
        description: 'complex command with shell interpretation'
      },
      {
        args: ['complex_command', '/bin/zsh'],
        expectedCommand: ['/bin/zsh'],
        description: 'absolute path command'
      },
      {
        args: ['complex_command', 'echo', 'hello world'],
        expectedCommand: ['/bin/sh', '-c', 'echo hello world'],
        description: 'command with spaces needing shell interpretation'
      }
    ];

    for (const testCase of testCases) {
      const mockProcess = new MockShellProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, testCase.args);
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['exec', '--interactive', '--tty', 'container_abc789', ...testCase.expectedCommand],
        {
          stdio: 'inherit',
          env: process.env
        }
      );

      mockSpawn.mockClear();
    }
  });

  it('should handle real container lifecycle events', async () => {
    const mockTask = {
      id: 'lifecycle_test_task_456',
      description: 'Container lifecycle test',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContainer = {
      name: 'apex-task-lifecycle_test_task_456',
      id: 'lifecycle_container_789',
      status: 'running'
    };

    const mockContainerManager = {
      listApexContainers: vi.fn().mockResolvedValue([mockContainer]),
    };

    const mockWorkspaceManager = {
      getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getContainerRuntime: vi.fn().mockReturnValue('docker'),
    };

    const mockOrchestrator = {
      listTasks: vi.fn().mockResolvedValue([mockTask]),
      getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
    };

    mockContext.orchestrator = mockOrchestrator;

    // Test different exit scenarios
    const exitScenarios = [
      { exitCode: 0, expectedMessage: '✅ Shell session ended' },
      { exitCode: 1, expectedMessage: '⚠️  Shell session ended with code 1' },
      { exitCode: 130, expectedMessage: '⚠️  Shell session ended with code 130' } // Ctrl+C
    ];

    for (const scenario of exitScenarios) {
      const mockProcess = new MockShellProcess(scenario.exitCode);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      mockConsoleLog.mockClear();

      await shellCommand!.handler(mockContext, ['lifecycle_test']);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(scenario.expectedMessage)
      );
    }
  });

  it('should handle error scenarios in integration context', async () => {
    const mockTask = {
      id: 'error_test_task_789',
      description: 'Error scenario test',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContainer = {
      name: 'apex-task-error_test_task_789',
      id: 'error_container_123',
      status: 'running'
    };

    const mockContainerManager = {
      listApexContainers: vi.fn().mockResolvedValue([mockContainer]),
    };

    const mockWorkspaceManager = {
      getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getContainerRuntime: vi.fn().mockReturnValue('docker'),
    };

    const mockOrchestrator = {
      listTasks: vi.fn().mockResolvedValue([mockTask]),
      getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
    };

    mockContext.orchestrator = mockOrchestrator;

    // Test process error
    const processError = new Error('Container not accessible');
    const mockProcess = new MockShellProcess(0, processError);
    mockSpawn.mockReturnValue(mockProcess as any);

    const { commands } = await import('../index.js');
    const shellCommand = commands.find(cmd => cmd.name === 'shell');

    await shellCommand!.handler(mockContext, ['error_test']);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('❌ Shell session failed: Container not accessible')
    );
  });

  it('should verify comprehensive container name matching', async () => {
    const tasks = [
      {
        id: 'short_id_123',
        description: 'Short task',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'long_complex_task_id_with_many_segments_456789abcdef',
        description: 'Long task',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const containers = [
      {
        name: 'apex-task-short_id_123',
        id: 'container_short',
        status: 'running'
      },
      {
        name: 'apex-task-long_complex_task_id_with_many_segments_456789abcdef',
        id: 'container_long',
        status: 'running'
      }
    ];

    const mockContainerManager = {
      listApexContainers: vi.fn().mockResolvedValue(containers),
    };

    const mockWorkspaceManager = {
      getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getContainerRuntime: vi.fn().mockReturnValue('docker'),
    };

    const mockOrchestrator = {
      listTasks: vi.fn().mockResolvedValue(tasks),
      getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
    };

    mockContext.orchestrator = mockOrchestrator;

    const testCases = [
      { taskIdPrefix: 'short', expectedContainer: 'container_short' },
      { taskIdPrefix: 'long_complex', expectedContainer: 'container_long' }
    ];

    for (const testCase of testCases) {
      const mockProcess = new MockShellProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, [testCase.taskIdPrefix]);
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['exec', '--interactive', '--tty', testCase.expectedContainer, '/bin/bash'],
        {
          stdio: 'inherit',
          env: process.env
        }
      );

      mockSpawn.mockClear();
    }
  });

  it('should handle environment variable inheritance', async () => {
    // Set up test environment variables
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      CUSTOM_VAR: 'test-value',
      PATH: '/usr/bin:/bin'
    };

    const mockTask = {
      id: 'env_test_task',
      description: 'Environment test',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContainer = {
      name: 'apex-task-env_test_task',
      id: 'env_container',
      status: 'running'
    };

    const mockContainerManager = {
      listApexContainers: vi.fn().mockResolvedValue([mockContainer]),
    };

    const mockWorkspaceManager = {
      getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getContainerRuntime: vi.fn().mockReturnValue('docker'),
    };

    const mockOrchestrator = {
      listTasks: vi.fn().mockResolvedValue([mockTask]),
      getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
    };

    mockContext.orchestrator = mockOrchestrator;

    const mockProcess = new MockShellProcess(0);
    mockSpawn.mockReturnValue(mockProcess as any);

    const { commands } = await import('../index.js');
    const shellCommand = commands.find(cmd => cmd.name === 'shell');

    await shellCommand!.handler(mockContext, ['env_test']);
    await new Promise(resolve => setTimeout(resolve, 5));

    // Verify environment is passed through
    expect(mockSpawn).toHaveBeenCalledWith(
      'docker',
      ['exec', '--interactive', '--tty', 'env_container', '/bin/bash'],
      {
        stdio: 'inherit',
        env: expect.objectContaining({
          CUSTOM_VAR: 'test-value',
          PATH: '/usr/bin:/bin'
        })
      }
    );

    // Restore original environment
    process.env = originalEnv;
  });
});