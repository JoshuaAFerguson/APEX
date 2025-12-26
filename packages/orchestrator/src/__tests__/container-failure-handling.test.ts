import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ApexOrchestrator } from '../index';
import { WorkspaceManager } from '../workspace-manager';
import { TaskStore } from '../store';
import {
  ContainerDiedEventData,
  ContainerManager,
  ContainerInfo,
  Task,
  TaskStatus
} from '@apexcli/core';

// Mock the dependencies
vi.mock('../store');
vi.mock('../workspace-manager');
vi.mock('@apexcli/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ContainerManager: vi.fn(() => new EventEmitter()),
  };
});

describe('ApexOrchestrator Container Failure Handling', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let mockWorkspaceManager: WorkspaceManager;
  let mockContainerManager: EventEmitter;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock store
    mockStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createTask: vi.fn(),
      updateTask: vi.fn(),
      getTask: vi.fn(),
      deleteTask: vi.fn(),
      getTasks: vi.fn().mockResolvedValue([]),
      addLog: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Create mock container manager that extends EventEmitter
    mockContainerManager = new EventEmitter();

    // Create mock workspace manager
    mockWorkspaceManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      createWorkspace: vi.fn(),
      removeWorkspace: vi.fn(),
      getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
    } as any;

    // Create orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: '/test/project',
    });

    // Set mocked dependencies
    (orchestrator as any).store = mockStore;
    (orchestrator as any).workspaceManager = mockWorkspaceManager;

    // Initialize to set up event listeners
    await orchestrator.initialize();

    // Verify that container manager event listeners were set up
    expect(mockWorkspaceManager.getContainerManager).toHaveBeenCalled();
  });

  afterEach(async () => {
    await orchestrator.cleanup();
  });

  describe('Container Death Event Handling', () => {
    it('should handle container death during task execution', async () => {
      const taskId = 'test-task-123';
      const containerId = 'container-abc123';

      // Mock task as in-progress
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'Test Task',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Spy on pauseTask method
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Create container died event data
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-task-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      // Emit container died event
      mockContainerManager.emit('container:died', containerDiedEvent);

      // Wait for async operations
      await new Promise(process.nextTick);

      // Verify task was paused with container_failure reason
      expect(pauseTaskSpy).toHaveBeenCalledWith(taskId, 'container_failure');

      // Verify error log was added
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'error',
        message: `Container died with exit code 1. Container ID: ${containerId}`,
      });

      // Verify warning log was added
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'warn',
        message: `Task paused due to container failure. Container died with exit code 1. Task can be resumed with a new container.`,
      });
    });

    it('should handle container death with OOM kill information', async () => {
      const taskId = 'test-task-456';
      const containerId = 'container-def456';

      // Mock task as in-progress
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'OOM Test Task',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Spy on pauseTask method
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Create container died event data with OOM kill
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-task-container-oom',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 137,
        signal: 'SIGKILL',
        oomKilled: true,
      };

      // Emit container died event
      mockContainerManager.emit('container:died', containerDiedEvent);

      // Wait for async operations
      await new Promise(process.nextTick);

      // Verify task was paused with container_failure reason
      expect(pauseTaskSpy).toHaveBeenCalledWith(taskId, 'container_failure');

      // Verify error log was added with OOM information
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'error',
        message: `Container died with exit code 137 (signal: SIGKILL) - Out of Memory (OOM) killed. Container ID: ${containerId}`,
      });

      // Verify warning log was added with OOM information
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'warn',
        message: `Task paused due to container failure. Container died with exit code 137 (signal: SIGKILL) - Out of Memory (OOM) killed. Task can be resumed with a new container.`,
      });
    });

    it('should handle container death with signal information but no OOM', async () => {
      const taskId = 'test-task-789';
      const containerId = 'container-ghi789';

      // Mock task as in-progress
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'Signal Test Task',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Spy on pauseTask method
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Create container died event data with signal but no OOM
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-task-container-signal',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 143,
        signal: 'SIGTERM',
        oomKilled: false,
      };

      // Emit container died event
      mockContainerManager.emit('container:died', containerDiedEvent);

      // Wait for async operations
      await new Promise(process.nextTick);

      // Verify task was paused with container_failure reason
      expect(pauseTaskSpy).toHaveBeenCalledWith(taskId, 'container_failure');

      // Verify error log was added with signal information
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'error',
        message: `Container died with exit code 143 (signal: SIGTERM). Container ID: ${containerId}`,
      });
    });

    it('should ignore container death events without task ID', async () => {
      const containerId = 'container-no-task';

      // Spy on pauseTask method
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Create container died event data without task ID
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-unassociated-container',
        image: 'node:20-alpine',
        taskId: undefined, // No task associated
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      // Emit container died event
      mockContainerManager.emit('container:died', containerDiedEvent);

      // Wait for async operations
      await new Promise(process.nextTick);

      // Verify pauseTask was not called
      expect(pauseTaskSpy).not.toHaveBeenCalled();

      // Verify no logs were added
      expect(mockStore.addLog).not.toHaveBeenCalled();
    });

    it('should ignore container death events for non-running tasks', async () => {
      const taskId = 'test-task-not-running';
      const containerId = 'container-jkl012';

      // Mock task exists but not running
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'completed' as TaskStatus,
        name: 'Completed Task',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      // Task is not in runningTasks set
      (orchestrator as any).runningTasks = new Set([]);

      // Spy on pauseTask method
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Create container died event data
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-completed-task-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      // Emit container died event
      mockContainerManager.emit('container:died', containerDiedEvent);

      // Wait for async operations
      await new Promise(process.nextTick);

      // Verify pauseTask was not called
      expect(pauseTaskSpy).not.toHaveBeenCalled();

      // Verify no logs were added
      expect(mockStore.addLog).not.toHaveBeenCalled();
    });

    it('should ignore container death events for tasks with non-progress status', async () => {
      const taskId = 'test-task-paused';
      const containerId = 'container-mno345';

      // Mock task as paused, not in-progress
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'paused' as TaskStatus,
        name: 'Paused Task',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Spy on pauseTask method
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Create container died event data
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-paused-task-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      // Emit container died event
      mockContainerManager.emit('container:died', containerDiedEvent);

      // Wait for async operations
      await new Promise(process.nextTick);

      // Verify pauseTask was not called
      expect(pauseTaskSpy).not.toHaveBeenCalled();

      // Verify no logs were added
      expect(mockStore.addLog).not.toHaveBeenCalled();
    });

    it('should handle errors during container failure processing gracefully', async () => {
      const taskId = 'test-task-error';
      const containerId = 'container-error-test';

      // Mock task as in-progress
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'Error Test Task',
        description: 'Test description',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Mock pauseTask to throw error
      vi.spyOn(orchestrator, 'pauseTask').mockRejectedValue(new Error('Pause task failed'));

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create container died event data
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-error-test-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      // Emit container died event
      mockContainerManager.emit('container:died', containerDiedEvent);

      // Wait for async operations
      await new Promise(process.nextTick);

      // Verify error was logged to console but didn't crash
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Error handling container failure for task ${taskId}:`,
        expect.any(Error)
      );

      // Clean up
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Container Failure Event Forwarding', () => {
    it('should forward container:died events with proper task association', (done) => {
      const taskId = 'test-task-forward';
      const containerId = 'container-forward-test';

      const mockEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-forward-test-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      orchestrator.on('container:died', (event: ContainerDiedEventData) => {
        try {
          expect(event.containerId).toBe(containerId);
          expect(event.taskId).toBe(taskId);
          expect(event.exitCode).toBe(1);
          expect(event.oomKilled).toBe(false);
          done();
        } catch (error) {
          done(error);
        }
      });

      mockContainerManager.emit('container:died', mockEvent);
    });

    it('should forward container:died events with OOM information', (done) => {
      const taskId = 'test-task-oom-forward';
      const containerId = 'container-oom-forward';

      const mockEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-oom-forward-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 137,
        signal: 'SIGKILL',
        oomKilled: true,
      };

      orchestrator.on('container:died', (event: ContainerDiedEventData) => {
        try {
          expect(event.oomKilled).toBe(true);
          expect(event.exitCode).toBe(137);
          expect(event.signal).toBe('SIGKILL');
          done();
        } catch (error) {
          done(error);
        }
      });

      mockContainerManager.emit('container:died', mockEvent);
    });
  });

  describe('Container Failure Pause Reason Integration', () => {
    it('should support container_failure as a valid pause reason', async () => {
      const taskId = 'test-task-pause-reason';

      // Mock store update
      const updateTaskSpy = vi.spyOn(mockStore, 'updateTask').mockResolvedValue(undefined);

      // Call pauseTask with container_failure reason
      await orchestrator.pauseTask(taskId, 'container_failure');

      // Verify store was updated with correct pause reason
      expect(updateTaskSpy).toHaveBeenCalledWith(taskId, expect.objectContaining({
        status: 'paused',
        pauseReason: 'container_failure',
      }));
    });
  });
});