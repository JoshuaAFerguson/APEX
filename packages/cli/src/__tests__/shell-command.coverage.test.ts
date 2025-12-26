/**
 * Coverage-focused tests for the shell command
 * Ensures comprehensive test coverage of all code paths and edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CliContext } from '../index.js';

// Mock dependencies
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

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Shell Command Coverage Tests', () => {
  let baseContext: CliContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    baseContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: { name: 'Test', description: 'Test project' },
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

  describe('command definition verification', () => {
    it('should export shell command with correct metadata', async () => {
      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      // Verify command exists and has required properties
      expect(shellCommand).toBeDefined();
      expect(shellCommand!.name).toBe('shell');
      expect(shellCommand!.aliases).toEqual([]);
      expect(shellCommand!.description).toBe('Attach interactive shell to running task container');
      expect(shellCommand!.usage).toBe('/shell <task_id> [command]');
      expect(typeof shellCommand!.handler).toBe('function');
    });

    it('should be included in commands export', async () => {
      const { commands } = await import('../index.js');
      const shellCommands = commands.filter(cmd => cmd.name === 'shell');

      // Should have exactly one shell command
      expect(shellCommands).toHaveLength(1);
    });
  });

  describe('uninitialized context handling', () => {
    it('should handle null orchestrator', async () => {
      const uninitContext = { ...baseContext, initialized: false, orchestrator: null };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(uninitContext, ['task123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]APEX not initialized. Run /init first.[/RED]')
      );
    });

    it('should handle missing orchestrator even when initialized flag is true', async () => {
      const badContext = { ...baseContext, initialized: true, orchestrator: null };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(badContext, ['task123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]APEX not initialized. Run /init first.[/RED]')
      );
    });
  });

  describe('help text verification', () => {
    it('should display complete usage help when no arguments provided', async () => {
      const mockOrchestrator = {
        listTasks: vi.fn(),
        getWorkspaceManager: vi.fn(),
      };

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, []);

      // Verify all help text is displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]Usage: /shell <task_id> [command][/RED]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[GRAY]\nExamples:[/GRAY]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[GRAY]  /shell abc123               # Attach interactive shell[/GRAY]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[GRAY]  /shell abc123 "ls -la"      # Run specific command[/GRAY]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[GRAY]  /shell abc123 bash          # Start bash shell[/GRAY]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[GRAY]\nNote: Task must be using container isolation[/GRAY]')
      );

      // Should not proceed to orchestrator calls
      expect(mockOrchestrator.listTasks).not.toHaveBeenCalled();
    });

    it('should display help with empty string argument', async () => {
      const mockOrchestrator = {
        listTasks: vi.fn(),
        getWorkspaceManager: vi.fn(),
      };

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]Usage: /shell <task_id> [command][/RED]')
      );
    });
  });

  describe('task resolution edge cases', () => {
    it('should handle empty task list', async () => {
      const mockOrchestrator = {
        listTasks: vi.fn().mockResolvedValue([]),
        getWorkspaceManager: vi.fn(),
      };

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['task123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]❌ Task not found: task123[/RED]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[GRAY]Use /status to see available tasks or provide a longer task ID.[/GRAY]')
      );
    });

    it('should handle task list with null/undefined values', async () => {
      const mockOrchestrator = {
        listTasks: vi.fn().mockResolvedValue([null, undefined, { id: 'valid-task', description: 'Valid' }]),
        getWorkspaceManager: vi.fn(),
      };

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['invalid']);

      // Should not crash and should handle the search properly
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]❌ Task not found: invalid[/RED]')
      );
    });
  });

  describe('container status variations', () => {
    it('should handle container with status "stopped"', async () => {
      const mockTask = { id: 'test-task-123', description: 'Test task', status: 'running' };
      const mockContainer = { name: 'apex-task-test-task-123', id: 'container-123', status: 'stopped' };

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

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['test-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]❌ Container for task test-task-123 is not running[/RED]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[GRAY]Container status: stopped[/GRAY]')
      );
    });

    it('should handle container with status "paused"', async () => {
      const mockTask = { id: 'paused-task-456', description: 'Paused task', status: 'running' };
      const mockContainer = { name: 'apex-task-paused-task-456', id: 'container-456', status: 'paused' };

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

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['paused-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]❌ Container for task paused-task-4 is not running[/RED]')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[GRAY]Container status: paused[/GRAY]')
      );
    });
  });

  describe('runtime variations', () => {
    it('should handle null runtime', async () => {
      const mockTask = { id: 'runtime-test-789', description: 'Runtime test', status: 'running' };
      const mockContainer = { name: 'apex-task-runtime-test-789', id: 'container-789', status: 'running' };

      const mockContainerManager = {
        listApexContainers: vi.fn().mockResolvedValue([mockContainer]),
      };

      const mockWorkspaceManager = {
        getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
        getContainerRuntime: vi.fn().mockReturnValue(null),
      };

      const mockOrchestrator = {
        listTasks: vi.fn().mockResolvedValue([mockTask]),
        getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
      };

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['runtime-test']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]❌ No container runtime (docker/podman) available[/RED]')
      );
    });

    it('should handle undefined runtime', async () => {
      const mockTask = { id: 'undefined-runtime-123', description: 'Undefined runtime test', status: 'running' };
      const mockContainer = { name: 'apex-task-undefined-runtime-123', id: 'container-123', status: 'running' };

      const mockContainerManager = {
        listApexContainers: vi.fn().mockResolvedValue([mockContainer]),
      };

      const mockWorkspaceManager = {
        getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
        getContainerRuntime: vi.fn().mockReturnValue(undefined),
      };

      const mockOrchestrator = {
        listTasks: vi.fn().mockResolvedValue([mockTask]),
        getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
      };

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['undefined-runtime']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]❌ No container runtime (docker/podman) available[/RED]')
      );
    });
  });

  describe('command argument parsing edge cases', () => {
    it('should handle whitespace-only command arguments', async () => {
      const mockTask = { id: 'whitespace-test', description: 'Whitespace test', status: 'running' };
      const mockContainer = { name: 'apex-task-whitespace-test', id: 'container-ws', status: 'running' };

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

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { spawn } = await import('child_process');
      const mockSpawn = vi.mocked(spawn);

      // Mock spawn to return a process that exits successfully
      const mockProcess = {
        on: vi.fn((event: string, callback: (code?: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 5);
          }
          return mockProcess;
        })
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      // Test with whitespace arguments
      await shellCommand!.handler(context, ['whitespace-test', '   ', '\t', '  ']);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should join whitespace args and treat as complex command needing shell interpretation
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker',
        ['exec', '--interactive', '--tty', 'container-ws', '/bin/sh', '-c', '       \t    '],
        expect.any(Object)
      );
    });
  });

  describe('error handling completeness', () => {
    it('should handle async errors in orchestrator methods', async () => {
      const mockOrchestrator = {
        listTasks: vi.fn().mockRejectedValue(new Error('Database connection timeout')),
        getWorkspaceManager: vi.fn(),
      };

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['error-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]❌ Error: Database connection timeout[/RED]')
      );
    });

    it('should handle errors in workspace manager calls', async () => {
      const mockWorkspaceManager = {
        getContainerManager: vi.fn(() => {
          throw new Error('Container manager initialization failed');
        }),
        getContainerRuntime: vi.fn(),
      };

      const mockOrchestrator = {
        listTasks: vi.fn().mockResolvedValue([{ id: 'test-task', description: 'Test', status: 'running' }]),
        getWorkspaceManager: vi.fn().mockReturnValue(mockWorkspaceManager),
      };

      const context = { ...baseContext, orchestrator: mockOrchestrator };

      const { commands } = await import('../index.js');
      const shellCommand = commands.find(cmd => cmd.name === 'shell');

      await shellCommand!.handler(context, ['test-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[RED]❌ Error: Container manager initialization failed[/RED]')
      );
    });
  });
});