/**
 * Unit tests for archive management CLI commands
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApexContext, ApexOrchestrator } from '@apexcli/orchestrator';
import { Task, AutonomyLevel, TaskStatus, TaskPriority, TaskEffort } from '@apexcli/core';

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock chalk for color output
vi.mock('chalk', () => ({
  default: {
    red: (text: string) => text,
    green: (text: string) => text,
    yellow: (text: string) => text,
    cyan: (text: string) => text,
    gray: (text: string) => text,
  },
}));

// Import the commands after mocking - we'll need to access the command handlers
import { commands } from '../index.js';

// Get the archive and unarchive command handlers
const archiveCommand = commands.find(cmd => cmd.name === 'archive');
const unarchiveCommand = commands.find(cmd => cmd.name === 'unarchive');
const statusCommand = commands.find(cmd => cmd.name === 'status');

// Mock task data
const mockTask: Task = {
  id: 'test-task-12345678',
  description: 'Test task for archive functionality',
  workflow: 'test-workflow',
  autonomy: 'guided' as AutonomyLevel,
  status: 'completed' as TaskStatus,
  priority: 'normal' as TaskPriority,
  effort: 'medium' as TaskEffort,
  projectPath: '/test/project',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  trashedAt: null,
  archivedAt: null,
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    estimatedCost: 0.01,
  },
  logs: [],
  artifacts: [],
};

const mockArchivedTask: Task = {
  ...mockTask,
  id: 'archived-task-87654321',
  description: 'Task that is archived',
  status: 'completed' as TaskStatus,
  archivedAt: new Date('2023-01-02'),
};

const mockActiveTask: Task = {
  ...mockTask,
  id: 'active-task-11111111',
  description: 'Active task not archived',
  status: 'running' as TaskStatus,
  archivedAt: null,
};

describe('Archive Commands', () => {
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let mockContext: ApexContext;

  beforeEach(() => {
    mockOrchestrator = {
      archiveTask: vi.fn(),
      unarchiveTask: vi.fn(),
      listArchivedTasks: vi.fn(),
      listTasks: vi.fn(),
      getTask: vi.fn(),
    };

    mockContext = {
      initialized: true,
      orchestrator: mockOrchestrator as ApexOrchestrator,
    } as ApexContext;

    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('/archive command', () => {
    it('should display usage when no args provided', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      await archiveCommand.handler(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /archive <taskId> or /archive list')
      );
    });

    it('should display error when context not initialized', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      mockContext.initialized = false;

      await archiveCommand.handler(mockContext, ['task123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
    });

    it('should archive a task successfully', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      const allTasks = [mockTask, mockActiveTask];
      (mockOrchestrator.listTasks as any).mockResolvedValue(allTasks);
      (mockOrchestrator.archiveTask as any).mockResolvedValue(undefined);

      await archiveCommand.handler(mockContext, ['test-task']);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 100, includeArchived: true });
      expect(mockOrchestrator.archiveTask).toHaveBeenCalledWith(mockTask.id);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task test-task-12 archived successfully')
      );
    });

    it('should handle task not found', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      (mockOrchestrator.listTasks as any).mockResolvedValue([]);

      await archiveCommand.handler(mockContext, ['nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: nonexistent')
      );
    });

    it('should warn when task already archived', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      const allTasks = [mockArchivedTask];
      (mockOrchestrator.listTasks as any).mockResolvedValue(allTasks);

      await archiveCommand.handler(mockContext, ['archived-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('already archived')
      );
      expect(mockOrchestrator.archiveTask).not.toHaveBeenCalled();
    });

    it('should handle archive operation errors', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      const allTasks = [mockTask];
      (mockOrchestrator.listTasks as any).mockResolvedValue(allTasks);
      (mockOrchestrator.archiveTask as any).mockRejectedValue(new Error('Database error'));

      await archiveCommand.handler(mockContext, ['test-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Database error')
      );
    });

    it('should find task by partial ID', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      const allTasks = [mockTask, mockActiveTask];
      (mockOrchestrator.listTasks as any).mockResolvedValue(allTasks);
      (mockOrchestrator.archiveTask as any).mockResolvedValue(undefined);

      await archiveCommand.handler(mockContext, [mockTask.id.substring(0, 8)]);

      expect(mockOrchestrator.archiveTask).toHaveBeenCalledWith(mockTask.id);
    });
  });

  describe('/archive list command', () => {
    it('should display empty message when no archived tasks', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue([]);

      await archiveCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No archived tasks found')
      );
    });

    it('should list archived tasks with details', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      const archivedTasks = [mockArchivedTask, { ...mockArchivedTask, id: 'another-task' }];
      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue(archivedTasks);

      await archiveCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📁 Archived Tasks (2)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('archived-task')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Archived Test Task')
      );
    });

    it('should handle list errors', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      (mockOrchestrator.listArchivedTasks as any).mockRejectedValue(new Error('Database error'));

      await archiveCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Database error')
      );
    });

    it('should display task details including dates and cost', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      const taskWithUsage = {
        ...mockArchivedTask,
        usage: { estimatedCost: 0.0245 }
      };
      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue([taskWithUsage]);

      await archiveCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Created: 1/1/2023')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Archived: 1/2/2023')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('$0.0245')
      );
    });
  });

  describe('/unarchive command', () => {
    it('should display usage when no args provided', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      await unarchiveCommand.handler(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /unarchive <taskId>')
      );
    });

    it('should display error when context not initialized', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      mockContext.initialized = false;

      await unarchiveCommand.handler(mockContext, ['task123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
    });

    it('should unarchive a task successfully', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue([mockArchivedTask]);
      (mockOrchestrator.unarchiveTask as any).mockResolvedValue(undefined);

      await unarchiveCommand.handler(mockContext, ['archived-task']);

      expect(mockOrchestrator.listArchivedTasks).toHaveBeenCalled();
      expect(mockOrchestrator.unarchiveTask).toHaveBeenCalledWith(mockArchivedTask.id);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task archived-tas unarchived successfully')
      );
    });

    it('should handle task not found in archived tasks', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue([]);

      await unarchiveCommand.handler(mockContext, ['nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Archived task not found: nonexistent')
      );
    });

    it('should handle unarchive errors', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue([mockArchivedTask]);
      (mockOrchestrator.unarchiveTask as any).mockRejectedValue(new Error('Database error'));

      await unarchiveCommand.handler(mockContext, ['archived-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error: Database error')
      );
    });

    it('should find task by partial ID in archived tasks', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue([mockArchivedTask]);
      (mockOrchestrator.unarchiveTask as any).mockResolvedValue(undefined);

      await unarchiveCommand.handler(mockContext, [mockArchivedTask.id.substring(0, 8)]);

      expect(mockOrchestrator.unarchiveTask).toHaveBeenCalledWith(mockArchivedTask.id);
    });

    it('should provide helpful guidance after unarchiving', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue([mockArchivedTask]);
      (mockOrchestrator.unarchiveTask as any).mockResolvedValue(undefined);

      await unarchiveCommand.handler(mockContext, ['archived-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task is now visible in /status output')
      );
    });
  });

  describe('/status --include-archived flag', () => {
    it('should include archived tasks when flag is present', async () => {
      if (!statusCommand) throw new Error('Status command not found');

      const allTasks = [mockTask, mockArchivedTask, mockActiveTask];
      (mockOrchestrator.listTasks as any).mockResolvedValue(allTasks);

      await statusCommand.handler(mockContext, ['--include-archived']);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 10, includeArchived: true });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Recent Tasks (including archived)')
      );
    });

    it('should exclude archived tasks by default', async () => {
      if (!statusCommand) throw new Error('Status command not found');

      const activeTasks = [mockTask, mockActiveTask];
      (mockOrchestrator.listTasks as any).mockResolvedValue(activeTasks);

      await statusCommand.handler(mockContext, []);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ limit: 10, includeArchived: false });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Recent Tasks:')
      );
    });

    it('should show archived indicator for archived tasks', async () => {
      if (!statusCommand) throw new Error('Status command not found');

      const allTasks = [mockTask, mockArchivedTask];
      (mockOrchestrator.listTasks as any).mockResolvedValue(allTasks);

      await statusCommand.handler(mockContext, ['--include-archived']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[archived]')
      );
    });

    it('should show archived status emoji and text for archived tasks', async () => {
      if (!statusCommand) throw new Error('Status command not found');

      const allTasks = [mockArchivedTask];
      (mockOrchestrator.listTasks as any).mockResolvedValue(allTasks);

      await statusCommand.handler(mockContext, ['--include-archived']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📁 archived')
      );
    });

    it('should suggest using --include-archived flag when no tasks found', async () => {
      if (!statusCommand) throw new Error('Status command not found');

      (mockOrchestrator.listTasks as any).mockResolvedValue([]);

      await statusCommand.handler(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use /status --include-archived to see archived tasks')
      );
    });

    it('should handle combining task ID with --include-archived flag', async () => {
      if (!statusCommand) throw new Error('Status command not found');

      const task = mockArchivedTask;
      (mockOrchestrator.getTask as any).mockResolvedValue(task);

      await statusCommand.handler(mockContext, [task.id, '--include-archived']);

      // Should find and display the specific archived task
      expect(mockOrchestrator.getTask).toHaveBeenCalledWith(task.id);
    });
  });

  describe('Context Validation', () => {
    it('should handle missing orchestrator in archive command', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      mockContext.orchestrator = undefined;

      await archiveCommand.handler(mockContext, ['task123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
    });

    it('should handle missing orchestrator in unarchive command', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      mockContext.orchestrator = undefined;

      await unarchiveCommand.handler(mockContext, ['task123']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
    });

    it('should handle uninitialized context in archive list', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      mockContext.initialized = false;

      await archiveCommand.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle archive command with extra arguments', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      const allTasks = [mockTask];
      (mockOrchestrator.listTasks as any).mockResolvedValue(allTasks);
      (mockOrchestrator.archiveTask as any).mockResolvedValue(undefined);

      // Extra arguments should be ignored, first arg used as taskId
      await archiveCommand.handler(mockContext, ['test-task', 'extra', 'args']);

      expect(mockOrchestrator.archiveTask).toHaveBeenCalledWith(mockTask.id);
    });

    it('should handle unarchive command with extra arguments', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue([mockArchivedTask]);
      (mockOrchestrator.unarchiveTask as any).mockResolvedValue(undefined);

      // Extra arguments should be ignored, first arg used as taskId
      await unarchiveCommand.handler(mockContext, ['archived-task', 'extra', 'args']);

      expect(mockOrchestrator.unarchiveTask).toHaveBeenCalledWith(mockArchivedTask.id);
    });

    it('should handle case when multiple tasks match partial ID in archive', async () => {
      if (!archiveCommand) throw new Error('Archive command not found');

      const similarTasks = [
        { ...mockTask, id: 'test-task-12345678' },
        { ...mockTask, id: 'test-task-12399999' }
      ];
      (mockOrchestrator.listTasks as any).mockResolvedValue(similarTasks);
      (mockOrchestrator.archiveTask as any).mockResolvedValue(undefined);

      await archiveCommand.handler(mockContext, ['test-task-123']);

      // Should use the first matching task
      expect(mockOrchestrator.archiveTask).toHaveBeenCalledWith('test-task-12345678');
    });

    it('should handle case when multiple archived tasks match partial ID in unarchive', async () => {
      if (!unarchiveCommand) throw new Error('Unarchive command not found');

      const similarArchivedTasks = [
        { ...mockArchivedTask, id: 'archived-task-87654321' },
        { ...mockArchivedTask, id: 'archived-task-87699999' }
      ];
      (mockOrchestrator.listArchivedTasks as any).mockResolvedValue(similarArchivedTasks);
      (mockOrchestrator.unarchiveTask as any).mockResolvedValue(undefined);

      await unarchiveCommand.handler(mockContext, ['archived-task-876']);

      // Should use the first matching task
      expect(mockOrchestrator.unarchiveTask).toHaveBeenCalledWith('archived-task-87654321');
    });
  });
});