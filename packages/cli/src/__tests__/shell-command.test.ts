/**
 * Unit tests for the /shell command functionality
 * Tests the interactive shell attachment to running task containers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { spawn } from 'child_process';
import type { CliContext } from '../index.js';

// Mock chalk to avoid color codes in tests
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

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

// Mock EventEmitter for shell process
class MockChildProcess {
  constructor(
    public exitCode: number | null = null,
    public error: Error | null = null
  ) {}

  on(event: string, callback: (...args: any[]) => void) {
    if (event === 'close' && this.exitCode !== null) {
      setTimeout(() => callback(this.exitCode), 10);
    } else if (event === 'error' && this.error) {
      setTimeout(() => callback(this.error), 10);
    }
    return this;
  }
}

describe('Shell Command', () => {
  let mockContext: CliContext;
  let mockOrchestrator: any;
  let mockWorkspaceManager: any;
  let mockContainerManager: any;

  beforeEach(() => {
    // Create mock container manager
    mockContainerManager = {
      listApexContainers: vi.fn(),
    };

    // Create mock workspace manager
    mockWorkspaceManager = {
      getContainerManager: vi.fn(() => mockContainerManager),
      getContainerRuntime: vi.fn(() => 'docker'),
    };

    // Create mock orchestrator
    mockOrchestrator = {
      listTasks: vi.fn(),
      getWorkspaceManager: vi.fn(() => mockWorkspaceManager),
    };

    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: {
          name: 'Test Project',
          description: 'Test project',
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
      orchestrator: mockOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    mockConsoleLog.mockClear();
    mockSpawn.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validation and error handling', () => {
    it('should require APEX to be initialized', async () => {
      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');
      expect(shellCommand).toBeDefined();

      const uninitializedContext = { ...mockContext, initialized: false, orchestrator: null };

      await shellCommand!.handler(uninitializedContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });

    it('should require task ID parameter', async () => {
      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /shell <task_id> [command]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Examples:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('/shell abc123               # Attach interactive shell')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('/shell abc123 "ls -la"      # Run specific command')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Note: Task must be using container isolation')
      );
    });

    it('should handle task not found', async () => {
      mockOrchestrator.listTasks.mockResolvedValue([
        {
          id: 'different-task-id',
          description: 'Different task',
          status: 'running'
        }
      ]);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Task not found: abc123')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /status to see available tasks or provide a longer task ID.')
      );
    });

    it('should handle task without container', async () => {
      const mockTask = {
        id: 'abc123def456',
        description: 'Test task',
        status: 'running'
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockContainerManager.listApexContainers.mockResolvedValue([
        {
          name: 'different-container',
          id: 'different-id',
          status: 'running'
        }
      ]);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Task abc123def456 is not using container isolation')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('This command only works with tasks running in containers.')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('To enable container isolation, update your .apex/config.yaml:')
      );
    });

    it('should handle stopped container', async () => {
      const mockTask = {
        id: 'abc123def456',
        description: 'Test task',
        status: 'running'
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockContainerManager.listApexContainers.mockResolvedValue([
        {
          name: 'apex-task-abc123def456',
          id: 'container-123',
          status: 'stopped'
        }
      ]);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Container for task abc123def456 is not running')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Container status: stopped')
      );
    });

    it('should handle no container runtime available', async () => {
      const mockTask = {
        id: 'abc123def456',
        description: 'Test task',
        status: 'running'
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockContainerManager.listApexContainers.mockResolvedValue([
        {
          name: 'apex-task-abc123def456',
          id: 'container-123',
          status: 'running'
        }
      ]);
      mockWorkspaceManager.getContainerRuntime.mockReturnValue('none');

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ No container runtime (docker/podman) available')
      );
    });
  });

  describe('successful shell attachment', () => {
    let mockTask: any;
    let mockContainer: any;

    beforeEach(() => {
      mockTask = {
        id: 'abc123def456',
        description: 'Test task description',
        status: 'running'
      };

      mockContainer = {
        name: 'apex-task-abc123def456',
        id: 'container-123',
        status: 'running'
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockContainerManager.listApexContainers.mockResolvedValue([mockContainer]);
    });

    it('should attach interactive bash shell by default', async () => {
      const mockProcess = new MockChildProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🐚 Attaching to container for task abc123def456...')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Container: apex-task-abc123def456')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task: Test task description')
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['exec', '--interactive', '--tty', 'container-123', '/bin/bash'],
        {
          stdio: 'inherit',
          env: process.env
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 Starting interactive shell in container. Use \'exit\' to return to APEX.')
      );
    });

    it('should run specific simple command', async () => {
      const mockProcess = new MockChildProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123', 'ls']);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['exec', '--interactive', '--tty', 'container-123', 'ls'],
        {
          stdio: 'inherit',
          env: process.env
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 Starting ls in container. Use \'exit\' to return to APEX.')
      );
    });

    it('should run complex command with shell interpretation', async () => {
      const mockProcess = new MockChildProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123', 'ls', '-la', '|', 'grep', 'test']);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['exec', '--interactive', '--tty', 'container-123', '/bin/sh', '-c', 'ls -la | grep test'],
        {
          stdio: 'inherit',
          env: process.env
        }
      );
    });

    it('should handle absolute path commands directly', async () => {
      const mockProcess = new MockChildProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123', '/bin/bash']);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['exec', '--interactive', '--tty', 'container-123', '/bin/bash'],
        {
          stdio: 'inherit',
          env: process.env
        }
      );
    });

    it('should work with podman runtime', async () => {
      mockWorkspaceManager.getContainerRuntime.mockReturnValue('podman');
      const mockProcess = new MockChildProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockSpawn).toHaveBeenCalledWith(
        'podman',
        ['exec', '--interactive', '--tty', 'container-123', '/bin/bash'],
        {
          stdio: 'inherit',
          env: process.env
        }
      );
    });

    it('should handle successful shell exit', async () => {
      const mockProcess = new MockChildProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Shell session ended')
      );
    });

    it('should handle shell exit with error code', async () => {
      const mockProcess = new MockChildProcess(1);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Shell session ended with code 1')
      );
    });

    it('should handle shell process error', async () => {
      const mockError = new Error('Failed to exec');
      const mockProcess = new MockChildProcess(null, mockError);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Shell session failed: Failed to exec')
      );
    });
  });

  describe('task ID matching', () => {
    it('should find task by partial ID prefix', async () => {
      const mockTask = {
        id: 'abc123def456ghi789',
        description: 'Test task',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-abc123def456ghi789',
        id: 'container-123',
        status: 'running'
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockContainerManager.listApexContainers.mockResolvedValue([mockContainer]);

      const mockProcess = new MockChildProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      // Use shorter prefix
      await shellCommand!.handler(mockContext, ['abc123']);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['exec', '--interactive', '--tty', 'container-123', '/bin/bash'],
        {
          stdio: 'inherit',
          env: process.env
        }
      );
    });

    it('should handle multiple tasks with same prefix', async () => {
      const mockTasks = [
        {
          id: 'abc123def456',
          description: 'First task',
          status: 'running'
        },
        {
          id: 'abc123ghi789',
          description: 'Second task',
          status: 'running'
        }
      ];

      mockOrchestrator.listTasks.mockResolvedValue(mockTasks);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      // Use ambiguous prefix - should find first match
      await shellCommand!.handler(mockContext, ['abc123']);

      // Should find the first task
      expect(mockContainerManager.listApexContainers).toHaveBeenCalled();
    });
  });

  describe('command help and usage', () => {
    it('should have correct command properties', async () => {
      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      expect(shellCommand).toBeDefined();
      expect(shellCommand!.name).toBe('shell');
      expect(shellCommand!.aliases).toEqual([]);
      expect(shellCommand!.description).toBe('Attach interactive shell to running task container');
      expect(shellCommand!.usage).toBe('/shell <task_id> [command]');
      expect(typeof shellCommand!.handler).toBe('function');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle orchestrator errors gracefully', async () => {
      mockOrchestrator.listTasks.mockRejectedValue(new Error('Database connection failed'));

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Database connection failed')
      );
    });

    it('should handle container manager errors', async () => {
      const mockTask = {
        id: 'abc123def456',
        description: 'Test task',
        status: 'running'
      };

      mockOrchestrator.listTasks.mockResolvedValue([mockTask]);
      mockContainerManager.listApexContainers.mockRejectedValue(new Error('Docker daemon not running'));

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(mockContext, ['abc123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Docker daemon not running')
      );
    });
  });
});