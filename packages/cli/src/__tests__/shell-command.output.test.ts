/**
 * Output and messaging tests for the shell command
 * Validates all user-facing messages and formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import type { CliContext } from '../index.js';

// Mock chalk to capture exact output formatting
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => `[BLUE]${str}[/BLUE]`,
    red: (str: string) => `[RED]${str}[/RED]`,
    green: (str: string) => `[GREEN]${str}[/GREEN]`,
    yellow: (str: string) => `[YELLOW]${str}[/YELLOW]`,
    gray: (str: string) => `[GRAY]${str}[/GRAY]`,
    cyan: (str: string) => `[CYAN]${str}[/CYAN]`,
    bold: (str: string) => `[BOLD]${str}[/BOLD]`,
    magenta: { bold: (str: string) => `[MAGENTA][BOLD]${str}[/BOLD][/MAGENTA]` },
  },
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock process for testing different exit scenarios
class MockProcess {
  private listeners: { [key: string]: Array<(...args: any[]) => void> } = {};

  constructor(
    private exitCode?: number,
    private error?: Error,
    private delay = 5
  ) {}

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    if (event === 'close' && this.exitCode !== undefined && !this.error) {
      setTimeout(() => callback(this.exitCode), this.delay);
    } else if (event === 'error' && this.error) {
      setTimeout(() => callback(this.error), this.delay);
    }

    return this;
  }
}

describe('Shell Command Output Tests', () => {
  let context: CliContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    context = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: { name: 'Test Project', description: 'Test description' },
        agents: {},
        workflows: {},
        limits: { maxTokensPerTask: 1000, maxCostPerTask: 1, dailyBudget: 10, timeoutMs: 30000 },
        autonomy: { default: 'medium', autoApprove: false },
        api: { url: 'http://localhost:3000', port: 3000 },
        models: { planning: 'opus', implementation: 'sonnet', review: 'haiku' },
      },
      orchestrator: null as any,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('success messages', () => {
    it('should display proper attachment messages for interactive shell', async () => {
      const mockTask = {
        id: 'interactive_test_task_12345',
        description: 'Interactive shell test with a longer description',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-interactive_test_task_12345',
        id: 'container_interactive_12345',
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

      context.orchestrator = mockOrchestrator;

      const mockProcess = new MockProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['interactive_test']);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify attachment messages
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[BLUE]🐚 Attaching to container for task interactive_test_...[/BLUE]'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]   Container: apex-task-interactive_test_task_12345[/GRAY]'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]   Task: Interactive shell test with a longer description[/GRAY]'
      );

      // Verify instruction message for interactive shell
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]💡 Starting interactive shell in container. Use \'exit\' to return to APEX.[/GRAY]'
      );

      // Verify exit message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GREEN]✅ Shell session ended[/GREEN]'
      );
    });

    it('should display proper messages for specific command execution', async () => {
      const mockTask = {
        id: 'command_test_task_67890',
        description: 'Command execution test',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-command_test_task_67890',
        id: 'container_command_67890',
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

      context.orchestrator = mockOrchestrator;

      const mockProcess = new MockProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['command_test', 'npm', 'test']);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify instruction message for specific command
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]💡 Starting npm test in container. Use \'exit\' to return to APEX.[/GRAY]'
      );
    });
  });

  describe('error message formatting', () => {
    it('should format uninitialized error correctly', async () => {
      const uninitContext = { ...context, initialized: false, orchestrator: null };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(uninitContext, ['task123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[RED]APEX not initialized. Run /init first.[/RED]'
      );
    });

    it('should format task not found error with helpful message', async () => {
      const mockOrchestrator = {
        listTasks: vi.fn().mockResolvedValue([
          { id: 'different-task-id-123', description: 'Different task', status: 'running' },
          { id: 'another-task-id-456', description: 'Another task', status: 'running' }
        ]),
        getWorkspaceManager: vi.fn(),
      };

      context.orchestrator = mockOrchestrator;

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[RED]❌ Task not found: nonexistent[/RED]'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]Use /status to see available tasks or provide a longer task ID.[/GRAY]'
      );
    });

    it('should format container isolation error with configuration help', async () => {
      const mockTask = {
        id: 'no_container_task_789',
        description: 'Task without container',
        status: 'running'
      };

      const mockContainerManager = {
        listApexContainers: vi.fn().mockResolvedValue([
          { name: 'different-container', id: 'diff-id', status: 'running' }
        ]),
      };

      const mockWorkspaceManager = {
        getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
        getContainerRuntime: vi.fn().mockReturnValue('docker'),
      };

      const mockOrchestrator = {
        listTasks: vi.fn().mockResolvedValue([mockTask]),
        getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
      };

      context.orchestrator = mockOrchestrator;

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['no_container']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[RED]❌ Task no_container_ta is not using container isolation[/RED]'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]This command only works with tasks running in containers.[/GRAY]'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]To enable container isolation, update your .apex/config.yaml:[/GRAY]'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]```yaml[/GRAY]');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]workspace:[/GRAY]');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]  defaultStrategy: container[/GRAY]');
      expect(mockConsoleLog).toHaveBeenCalledWith('[GRAY]```[/GRAY]');
    });

    it('should format container not running error', async () => {
      const mockTask = {
        id: 'stopped_container_task_321',
        description: 'Task with stopped container',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-stopped_container_task_321',
        id: 'stopped_container_321',
        status: 'exited'
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

      context.orchestrator = mockOrchestrator;

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['stopped_container']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[RED]❌ Container for task stopped_contai is not running[/RED]'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GRAY]Container status: exited[/GRAY]'
      );
    });

    it('should format runtime unavailable error', async () => {
      const mockTask = {
        id: 'no_runtime_task_654',
        description: 'Task without runtime',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-no_runtime_task_654',
        id: 'no_runtime_container_654',
        status: 'running'
      };

      const mockContainerManager = {
        listApexContainers: vi.fn().mockResolvedValue([mockContainer]),
      };

      const mockWorkspaceManager = {
        getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
        getContainerRuntime: vi.fn().mockReturnValue('none'),
      };

      const mockOrchestrator = {
        listTasks: vi.fn().mockResolvedValue([mockTask]),
        getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
      };

      context.orchestrator = mockOrchestrator;

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['no_runtime']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[RED]❌ No container runtime (docker/podman) available[/RED]'
      );
    });
  });

  describe('shell exit status messages', () => {
    it('should format successful exit message', async () => {
      const mockTask = {
        id: 'success_exit_task_111',
        description: 'Success exit test',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-success_exit_task_111',
        id: 'success_container_111',
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

      context.orchestrator = mockOrchestrator;

      const mockProcess = new MockProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['success_exit']);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[GREEN]✅ Shell session ended[/GREEN]'
      );
    });

    it('should format error exit code message', async () => {
      const mockTask = {
        id: 'error_exit_task_222',
        description: 'Error exit test',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-error_exit_task_222',
        id: 'error_container_222',
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

      context.orchestrator = mockOrchestrator;

      const mockProcess = new MockProcess(130); // Ctrl+C exit code
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['error_exit']);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[YELLOW]⚠️  Shell session ended with code 130[/YELLOW]'
      );
    });

    it('should format process error message', async () => {
      const mockTask = {
        id: 'process_error_task_333',
        description: 'Process error test',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-process_error_task_333',
        id: 'error_container_333',
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

      context.orchestrator = mockOrchestrator;

      const processError = new Error('Permission denied: unable to exec into container');
      const mockProcess = new MockProcess(undefined, processError);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['process_error']);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[RED]❌ Shell session failed: Permission denied: unable to exec into container[/RED]'
      );
    });
  });

  describe('task ID truncation in messages', () => {
    it('should properly truncate long task IDs in success messages', async () => {
      const mockTask = {
        id: 'very_long_task_id_that_should_be_truncated_in_display_messages_123456789abcdef',
        description: 'Long ID test task',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-very_long_task_id_that_should_be_truncated_in_display_messages_123456789abcdef',
        id: 'long_container_id',
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

      context.orchestrator = mockOrchestrator;

      const mockProcess = new MockProcess(0);
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['very_long_task']);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that task ID is truncated to 12 characters in display message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[BLUE]🐚 Attaching to container for task very_long_ta...[/BLUE]'
      );
    });

    it('should properly truncate task IDs in error messages', async () => {
      const mockTask = {
        id: 'another_very_long_task_id_for_error_testing_123456789abcdef',
        description: 'Another long ID test',
        status: 'running'
      };

      const mockContainer = {
        name: 'apex-task-another_very_long_task_id_for_error_testing_123456789abcdef',
        id: 'error_container_long',
        status: 'stopped'
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

      context.orchestrator = mockOrchestrator;

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['another_very_long']);

      // Check that task ID is truncated in error message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[RED]❌ Container for task another_very is not running[/RED]'
      );
    });
  });
});