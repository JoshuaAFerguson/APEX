import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from './index';
import { WorkspaceManager } from './workspace-manager';
import { TaskStore } from './store';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock the agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock container runtime
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    containerRuntime: {
      getBestRuntime: vi.fn().mockResolvedValue('docker'),
    },
  };
});

describe('Workspace Cleanup Integration', () => {
  let orchestrator: ApexOrchestrator;
  let workspaceManager: WorkspaceManager;
  let store: TaskStore;
  let projectPath: string;

  beforeEach(() => {
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);

    // Create orchestrator with test config
    orchestrator = new ApexOrchestrator({
      projectPath,
      config: {
        workspace: {
          cleanupOnComplete: true,
        },
      },
    });

    workspaceManager = (orchestrator as any).workspaceManager;
    store = (orchestrator as any).store;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('automatic cleanup on task completion', () => {
    it('should automatically trigger cleanup when a task completes successfully', async () => {
      // Mock workspace cleanup method
      const cleanupSpy = vi.spyOn(workspaceManager, 'cleanupWorkspace')
        .mockResolvedValue(undefined);

      // Create a task
      const task = await orchestrator.createTask({
        description: 'Integration test task',
      });

      // Simulate task completion by emitting the event
      orchestrator.emit('task:completed', task);

      // Wait for async cleanup handler
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was called
      expect(cleanupSpy).toHaveBeenCalledOnce();
      expect(cleanupSpy).toHaveBeenCalledWith(task.id);
    });

    it('should respect global workspace cleanup configuration', async () => {
      // Create orchestrator with cleanup disabled
      const orchestratorWithoutCleanup = new ApexOrchestrator({
        projectPath,
        config: {
          workspace: {
            cleanupOnComplete: false,
          },
        },
      });

      const workspaceManagerWithoutCleanup = (orchestratorWithoutCleanup as any).workspaceManager;
      const cleanupSpy = vi.spyOn(workspaceManagerWithoutCleanup, 'cleanupWorkspace')
        .mockResolvedValue(undefined);

      // Create a task
      const task = await orchestratorWithoutCleanup.createTask({
        description: 'Integration test task without cleanup',
      });

      // Simulate task completion
      orchestratorWithoutCleanup.emit('task:completed', task);

      // Wait for potential async cleanup handler
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify cleanup was NOT called
      expect(cleanupSpy).not.toHaveBeenCalled();
    });

    it('should handle cleanup failures without affecting task completion', async () => {
      // Mock workspace cleanup to throw an error
      const cleanupError = new Error('Container removal failed');
      const cleanupSpy = vi.spyOn(workspaceManager, 'cleanupWorkspace')
        .mockRejectedValue(cleanupError);

      // Mock store.addLog to verify error logging
      const addLogSpy = vi.spyOn(store, 'addLog')
        .mockResolvedValue(undefined);

      // Mock console.warn to verify error logging
      const consoleWarnSpy = vi.spyOn(console, 'warn')
        .mockImplementation(() => {});

      // Create a task
      const task = await orchestrator.createTask({
        description: 'Integration test task with cleanup failure',
      });

      // Simulate task completion
      orchestrator.emit('task:completed', task);

      // Wait for async cleanup handler and error handling
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify cleanup was attempted
      expect(cleanupSpy).toHaveBeenCalledWith(task.id);

      // Verify error was logged to console
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Failed to cleanup workspace for completed task ${task.id}:`,
        cleanupError
      );

      // Verify error was logged to task store
      expect(addLogSpy).toHaveBeenCalledWith(task.id, {
        level: 'warn',
        message: 'Workspace cleanup failed: Container removal failed',
        timestamp: expect.any(Date),
        component: 'workspace-cleanup'
      });

      consoleWarnSpy.mockRestore();
    });

    it('should handle multiple task completions concurrently', async () => {
      // Mock workspace cleanup with slight delay to test concurrency
      const cleanupSpy = vi.spyOn(workspaceManager, 'cleanupWorkspace')
        .mockImplementation(async (taskId) => {
          await new Promise(resolve => setTimeout(resolve, 5));
          return undefined;
        });

      // Create multiple tasks
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Concurrent test task 1' }),
        orchestrator.createTask({ description: 'Concurrent test task 2' }),
        orchestrator.createTask({ description: 'Concurrent test task 3' }),
      ]);

      // Simulate all tasks completing simultaneously
      tasks.forEach(task => {
        orchestrator.emit('task:completed', task);
      });

      // Wait for all async cleanup handlers
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify cleanup was called for each task
      expect(cleanupSpy).toHaveBeenCalledTimes(3);
      tasks.forEach(task => {
        expect(cleanupSpy).toHaveBeenCalledWith(task.id);
      });
    });
  });

  describe('cleanup event listener setup', () => {
    it('should setup automatic cleanup listener during orchestrator initialization', () => {
      // Verify the event listener is registered by checking if emitting the event triggers cleanup
      const cleanupSpy = vi.spyOn(workspaceManager, 'cleanupWorkspace')
        .mockResolvedValue(undefined);

      // Create a mock task directly
      const mockTask = {
        id: 'test-task-setup',
        description: 'Test setup',
        workflow: 'test',
        autonomy: 'full' as const,
        status: 'completed' as const,
        priority: 'normal' as const,
        effort: 'small' as const,
        currentStage: undefined,
        projectPath: '',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
      };

      // Emit task:completed event
      orchestrator.emit('task:completed', mockTask as any);

      // Give async handler time to execute
      return new Promise(resolve => {
        setTimeout(() => {
          expect(cleanupSpy).toHaveBeenCalledWith('test-task-setup');
          resolve(undefined);
        }, 0);
      });
    });
  });
});