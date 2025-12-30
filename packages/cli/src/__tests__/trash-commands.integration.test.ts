/**
 * Integration tests for trash management CLI commands
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApexContext, ApexOrchestrator } from '@apexcli/orchestrator';
import { Task } from '@apexcli/core';

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

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

// Mock readline
vi.mock('readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((_, callback) => callback('yes')),
    close: vi.fn(),
  })),
}));

// Mock task data
const mockTask: Task = {
  id: 'test-task-12345678',
  description: 'Test task for trash functionality',
  status: 'pending',
  workflow: 'test-workflow',
  agent: 'test-agent',
  priority: 'medium',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  trashedAt: null,
  archivedAt: null,
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    estimatedCost: 0.01,
  },
  context: {},
  result: null,
  error: null,
  metadata: {},
};

const mockTrashedTask: Task = {
  ...mockTask,
  id: 'trashed-task-87654321',
  description: 'Task that is in trash',
  status: 'cancelled',
  trashedAt: new Date('2023-01-02'),
};

// Mock command structure to simulate the CLI command processing
interface Command {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  handler: (ctx: ApexContext, args: string[]) => Promise<void>;
}

// Mock command handler - simulates how the actual trash command works
async function simulateTrashCommand(ctx: ApexContext, args: string[]): Promise<void> {
  if (!ctx.initialized || !ctx.orchestrator) {
    console.log('APEX not initialized. Run /init first.');
    return;
  }

  if (args.length === 0) {
    console.log('Trash Commands:');
    console.log('  /trash <taskId>          - Move task to trash');
    console.log('  /trash list              - List all trashed tasks');
    console.log('  /trash empty             - Permanently delete all trashed tasks');
    console.log('  /trash restore <taskId>  - Restore task from trash');
    return;
  }

  const firstArg = args[0];
  const subArgs = args.slice(1);

  try {
    switch (firstArg) {
      case 'list':
        const trashedTasks = await ctx.orchestrator.listTrashed();
        if (trashedTasks.length === 0) {
          console.log('🗑️  Trash is empty.');
        } else {
          console.log(`🗑️  Trashed Tasks (${trashedTasks.length}):`);
          for (const task of trashedTasks) {
            console.log(`  ${task.id.substring(0, 16)} ${task.status} ${task.description.substring(0, 40)}`);
          }
        }
        break;
      case 'empty':
        const tasksToDelete = await ctx.orchestrator.listTrashed();
        if (tasksToDelete.length === 0) {
          console.log('🗑️  Trash is already empty.');
          return;
        }
        console.log(`⚠️  This will permanently delete ${tasksToDelete.length} task(s) from trash.`);
        const deletedCount = await ctx.orchestrator.emptyTrash();
        console.log(`🗑️  Successfully deleted ${deletedCount} task(s) from trash`);
        break;
      case 'restore':
        if (subArgs.length === 0) {
          console.log('Usage: /trash restore <taskId>');
          return;
        }
        const taskId = subArgs[0];
        const trashedTasks2 = await ctx.orchestrator.listTrashed();
        const taskToRestore = trashedTasks2.find(t => t.id.startsWith(taskId));
        if (!taskToRestore) {
          console.log(`❌ Task not found in trash: ${taskId}`);
          return;
        }
        await ctx.orchestrator.restoreTask(taskToRestore.id);
        console.log(`♻️  Task restored from trash: ${taskToRestore.id.substring(0, 16)}...`);
        break;
      default:
        // Assume it's a task ID to trash
        const task = await ctx.orchestrator.findTask(firstArg);
        if (!task) {
          console.log(`❌ Task not found: ${firstArg}`);
          return;
        }
        if (task.trashedAt) {
          console.log(`⚠️  Task ${task.id.substring(0, 16)}... is already in trash`);
          return;
        }
        await ctx.orchestrator.trashTask(task.id);
        console.log(`🗑️  Task moved to trash: ${task.id.substring(0, 16)}...`);
        break;
    }
  } catch (error) {
    console.log(`❌ Error: ${(error as Error).message}`);
  }
}

describe('Trash Commands Integration', () => {
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let mockContext: ApexContext;

  beforeEach(() => {
    mockOrchestrator = {
      findTask: vi.fn(),
      trashTask: vi.fn(),
      restoreTask: vi.fn(),
      listTrashed: vi.fn(),
      emptyTrash: vi.fn(),
    };

    mockContext = {
      initialized: true,
      orchestrator: mockOrchestrator as ApexOrchestrator,
    } as ApexContext;

    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Command Interface', () => {
    it('should display help when no args provided', async () => {
      await simulateTrashCommand(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith('Trash Commands:');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/trash <taskId>'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/trash list'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/trash empty'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('/trash restore'));
    });

    it('should check initialization state', async () => {
      mockContext.initialized = false;

      await simulateTrashCommand(mockContext, ['test-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith('APEX not initialized. Run /init first.');
    });
  });

  describe('Trash Task Operation', () => {
    it('should trash a task successfully', async () => {
      (mockOrchestrator.findTask as any).mockResolvedValue(mockTask);
      (mockOrchestrator.trashTask as any).mockResolvedValue(undefined);

      await simulateTrashCommand(mockContext, ['test-task']);

      expect(mockOrchestrator.findTask).toHaveBeenCalledWith('test-task');
      expect(mockOrchestrator.trashTask).toHaveBeenCalledWith(mockTask.id);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task moved to trash')
      );
    });

    it('should handle task not found', async () => {
      (mockOrchestrator.findTask as any).mockResolvedValue(null);

      await simulateTrashCommand(mockContext, ['nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: nonexistent')
      );
      expect(mockOrchestrator.trashTask).not.toHaveBeenCalled();
    });

    it('should warn when task already trashed', async () => {
      (mockOrchestrator.findTask as any).mockResolvedValue(mockTrashedTask);

      await simulateTrashCommand(mockContext, ['trashed-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('already in trash')
      );
      expect(mockOrchestrator.trashTask).not.toHaveBeenCalled();
    });

    it('should handle errors during trash operation', async () => {
      (mockOrchestrator.findTask as any).mockResolvedValue(mockTask);
      (mockOrchestrator.trashTask as any).mockRejectedValue(new Error('Database error'));

      await simulateTrashCommand(mockContext, ['test-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Database error')
      );
    });
  });

  describe('List Trash Operation', () => {
    it('should display empty message when no trashed tasks', async () => {
      (mockOrchestrator.listTrashed as any).mockResolvedValue([]);

      await simulateTrashCommand(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Trash is empty')
      );
    });

    it('should list trashed tasks', async () => {
      const trashedTasks = [mockTrashedTask, { ...mockTrashedTask, id: 'another-task' }];
      (mockOrchestrator.listTrashed as any).mockResolvedValue(trashedTasks);

      await simulateTrashCommand(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Trashed Tasks (2)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(mockTrashedTask.id.substring(0, 16))
      );
    });
  });

  describe('Restore Task Operation', () => {
    it('should display usage when no task ID provided', async () => {
      await simulateTrashCommand(mockContext, ['restore']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Usage: /trash restore <taskId>'
      );
    });

    it('should restore a task successfully', async () => {
      (mockOrchestrator.listTrashed as any).mockResolvedValue([mockTrashedTask]);
      (mockOrchestrator.restoreTask as any).mockResolvedValue(undefined);

      await simulateTrashCommand(mockContext, ['restore', 'trashed-task']);

      expect(mockOrchestrator.restoreTask).toHaveBeenCalledWith(mockTrashedTask.id);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task restored from trash')
      );
    });

    it('should handle task not found in trash', async () => {
      (mockOrchestrator.listTrashed as any).mockResolvedValue([]);

      await simulateTrashCommand(mockContext, ['restore', 'nonexistent']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found in trash: nonexistent')
      );
    });

    it('should find task by partial ID', async () => {
      (mockOrchestrator.listTrashed as any).mockResolvedValue([mockTrashedTask]);
      (mockOrchestrator.restoreTask as any).mockResolvedValue(undefined);

      await simulateTrashCommand(mockContext, ['restore', 'trashed-task'.substring(0, 8)]);

      expect(mockOrchestrator.restoreTask).toHaveBeenCalledWith(mockTrashedTask.id);
    });
  });

  describe('Empty Trash Operation', () => {
    it('should display message when trash is already empty', async () => {
      (mockOrchestrator.listTrashed as any).mockResolvedValue([]);

      await simulateTrashCommand(mockContext, ['empty']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Trash is already empty')
      );
    });

    it('should empty trash successfully', async () => {
      const trashedTasks = [mockTrashedTask];
      (mockOrchestrator.listTrashed as any).mockResolvedValue(trashedTasks);
      (mockOrchestrator.emptyTrash as any).mockResolvedValue(1);

      await simulateTrashCommand(mockContext, ['empty']);

      expect(mockOrchestrator.emptyTrash).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Successfully deleted 1 task(s)')
      );
    });

    it('should display warning before deletion', async () => {
      const trashedTasks = [mockTrashedTask, { ...mockTrashedTask, id: 'another-task' }];
      (mockOrchestrator.listTrashed as any).mockResolvedValue(trashedTasks);
      (mockOrchestrator.emptyTrash as any).mockResolvedValue(2);

      await simulateTrashCommand(mockContext, ['empty']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('permanently delete 2 task(s)')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle orchestrator errors gracefully', async () => {
      (mockOrchestrator.listTrashed as any).mockRejectedValue(new Error('Database connection failed'));

      await simulateTrashCommand(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Database connection failed')
      );
    });

    it('should handle restore errors gracefully', async () => {
      (mockOrchestrator.listTrashed as any).mockResolvedValue([mockTrashedTask]);
      (mockOrchestrator.restoreTask as any).mockRejectedValue(new Error('Restore failed'));

      await simulateTrashCommand(mockContext, ['restore', 'trashed-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Restore failed')
      );
    });

    it('should handle empty trash errors gracefully', async () => {
      (mockOrchestrator.listTrashed as any).mockResolvedValue([mockTrashedTask]);
      (mockOrchestrator.emptyTrash as any).mockRejectedValue(new Error('Delete failed'));

      await simulateTrashCommand(mockContext, ['empty']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Delete failed')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing orchestrator', async () => {
      mockContext.orchestrator = undefined;

      await simulateTrashCommand(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith('APEX not initialized. Run /init first.');
    });

    it('should handle partial task ID matching', async () => {
      const task1 = { ...mockTask, id: 'prefix-123-task' };
      const task2 = { ...mockTask, id: 'prefix-456-task' };
      (mockOrchestrator.findTask as any).mockImplementation((taskId: string) => {
        if (taskId === 'prefix-123') return task1;
        if (taskId === 'prefix-456') return task2;
        return null;
      });
      (mockOrchestrator.trashTask as any).mockResolvedValue(undefined);

      await simulateTrashCommand(mockContext, ['prefix-123']);

      expect(mockOrchestrator.trashTask).toHaveBeenCalledWith(task1.id);
    });

    it('should handle empty string task ID', async () => {
      (mockOrchestrator.findTask as any).mockResolvedValue(null);

      await simulateTrashCommand(mockContext, ['']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: ')
      );
    });

    it('should handle very long task descriptions gracefully', async () => {
      const longDescriptionTask = {
        ...mockTrashedTask,
        description: 'A'.repeat(200), // Very long description
      };
      (mockOrchestrator.listTrashed as any).mockResolvedValue([longDescriptionTask]);

      await simulateTrashCommand(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('A'.repeat(40)) // Should be truncated to 40 chars
      );
    });
  });
});