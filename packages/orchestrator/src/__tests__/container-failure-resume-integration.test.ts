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

describe('Container Failure Resume Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let mockWorkspaceManager: WorkspaceManager;
  let mockContainerManager: EventEmitter;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock store with enhanced functionality for resume tests
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
  });

  afterEach(async () => {
    await orchestrator.cleanup();
  });

  describe('Task Resume After Container Failure', () => {
    it('should allow task resume after container failure with new container', async () => {
      const taskId = 'resume-test-task';
      const oldContainerId = 'old-container-123';
      const newContainerId = 'new-container-456';

      // Setup initial task state
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'Resume Test Task',
        description: 'Test task resume functionality',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Spy on pauseTask and resumeTask methods
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);
      const resumeTaskSpy = vi.spyOn(orchestrator, 'resumeTask').mockResolvedValue(undefined);

      // Simulate container failure
      const containerDiedEvent: ContainerDiedEventData = {
        containerId: oldContainerId,
        containerName: 'apex-test-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      // Step 1: Container dies, task should be paused
      mockContainerManager.emit('container:died', containerDiedEvent);
      await new Promise(process.nextTick);

      // Verify task was paused due to container failure
      expect(pauseTaskSpy).toHaveBeenCalledWith(taskId, 'container_failure');

      // Step 2: Update mock to return paused task
      const pausedTask: Partial<Task> = {
        ...mockTask,
        status: 'paused' as TaskStatus,
        pauseReason: 'container_failure',
      };
      mockStore.getTask = vi.fn().mockResolvedValue(pausedTask);

      // Step 3: Resume task with new container
      await orchestrator.resumeTask(taskId);

      // Verify resume was called
      expect(resumeTaskSpy).toHaveBeenCalledWith(taskId);

      // Verify logs were created for both failure and resume
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'error',
        message: `Container died with exit code 1. Container ID: ${oldContainerId}`,
      });

      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'warn',
        message: `Task paused due to container failure. Container died with exit code 1. Task can be resumed with a new container.`,
      });
    });

    it('should handle multiple container failures and resumes gracefully', async () => {
      const taskId = 'multi-failure-task';
      const containers = ['container-1', 'container-2', 'container-3'];

      // Setup task
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'Multi Failure Test',
        description: 'Test multiple failures',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Spy on methods
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);
      const resumeTaskSpy = vi.spyOn(orchestrator, 'resumeTask').mockResolvedValue(undefined);

      // Simulate multiple container failures
      for (let i = 0; i < containers.length; i++) {
        const containerId = containers[i];
        const exitCode = 1 + i; // Different exit codes

        const containerDiedEvent: ContainerDiedEventData = {
          containerId,
          containerName: `apex-container-${i + 1}`,
          image: 'node:20-alpine',
          taskId,
          timestamp: new Date(),
          exitCode,
          signal: undefined,
          oomKilled: false,
        };

        // Emit container failure
        mockContainerManager.emit('container:died', containerDiedEvent);
        await new Promise(process.nextTick);

        // Mock task as paused after failure
        const pausedTask: Partial<Task> = {
          ...mockTask,
          status: 'paused' as TaskStatus,
          pauseReason: 'container_failure',
        };
        mockStore.getTask = vi.fn().mockResolvedValue(pausedTask);

        // Resume task for next iteration (except last)
        if (i < containers.length - 1) {
          // Mock task as resumed
          mockTask.status = 'in-progress' as TaskStatus;
          mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
          (orchestrator as any).runningTasks = new Set([taskId]);

          await orchestrator.resumeTask(taskId);
        }
      }

      // Verify all failures were handled
      expect(pauseTaskSpy).toHaveBeenCalledTimes(containers.length);
      expect(resumeTaskSpy).toHaveBeenCalledTimes(containers.length - 1);

      // Verify appropriate logs were created for each failure
      containers.forEach((containerId, i) => {
        const exitCode = 1 + i;
        expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
          level: 'error',
          message: `Container died with exit code ${exitCode}. Container ID: ${containerId}`,
        });
      });
    });

    it('should handle OOM container failure with detailed resume information', async () => {
      const taskId = 'oom-resume-task';
      const containerId = 'oom-container-123';

      // Setup task
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'OOM Resume Test',
        description: 'Test OOM failure and resume',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Spy on methods
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Simulate OOM container failure
      const oomContainerEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-memory-intensive-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 137, // Standard OOM exit code
        signal: 'SIGKILL',
        oomKilled: true,
      };

      mockContainerManager.emit('container:died', oomContainerEvent);
      await new Promise(process.nextTick);

      // Verify task was paused
      expect(pauseTaskSpy).toHaveBeenCalledWith(taskId, 'container_failure');

      // Verify detailed OOM logs were created
      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'error',
        message: `Container died with exit code 137 (signal: SIGKILL) - Out of Memory (OOM) killed. Container ID: ${containerId}`,
      });

      expect(mockStore.addLog).toHaveBeenCalledWith(taskId, {
        level: 'warn',
        message: `Task paused due to container failure. Container died with exit code 137 (signal: SIGKILL) - Out of Memory (OOM) killed. Task can be resumed with a new container.`,
      });
    });

    it('should prevent double-pausing when container dies during pause process', async () => {
      const taskId = 'double-pause-test';
      const containerId = 'container-double-pause';

      // Setup task
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'Double Pause Test',
        description: 'Test prevention of double pause',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Mock pauseTask to simulate a slow pause operation
      let pauseCalls = 0;
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockImplementation(async (id, reason) => {
        pauseCalls++;
        // Simulate slow pause operation
        await new Promise(resolve => setTimeout(resolve, 50));
        // Remove from running tasks to simulate completion
        (orchestrator as any).runningTasks.delete(taskId);
        const pausedTask: Partial<Task> = {
          ...mockTask,
          status: 'paused' as TaskStatus,
          pauseReason: reason,
        };
        mockStore.getTask = vi.fn().mockResolvedValue(pausedTask);
      });

      // Create container died event
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-double-pause-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      // Emit the same container death event twice rapidly
      mockContainerManager.emit('container:died', containerDiedEvent);
      mockContainerManager.emit('container:died', containerDiedEvent);

      // Wait for both events to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify pauseTask was called only once despite multiple events
      expect(pauseCalls).toBe(1);
    });

    it('should handle container failure when task is already paused', async () => {
      const taskId = 'already-paused-task';
      const containerId = 'container-already-paused';

      // Setup already paused task
      const pausedTask: Partial<Task> = {
        id: taskId,
        status: 'paused' as TaskStatus,
        pauseReason: 'manual',
        name: 'Already Paused Task',
        description: 'Task that was already paused',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(pausedTask);
      // Task is not in running tasks since it's paused
      (orchestrator as any).runningTasks = new Set([]);

      // Spy on pauseTask
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Simulate container death for already paused task
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-already-paused-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      mockContainerManager.emit('container:died', containerDiedEvent);
      await new Promise(process.nextTick);

      // Verify pauseTask was not called since task was already paused
      expect(pauseTaskSpy).not.toHaveBeenCalled();

      // Verify no additional logs were created
      expect(mockStore.addLog).not.toHaveBeenCalled();
    });
  });

  describe('Container Event Forwarding During Resume', () => {
    it('should continue forwarding container events after task resume', async () => {
      const taskId = 'event-forwarding-resume-test';
      const oldContainerId = 'old-container-events';
      const newContainerId = 'new-container-events';

      // Track forwarded events
      const forwardedEvents: ContainerDiedEventData[] = [];
      orchestrator.on('container:died', (event: ContainerDiedEventData) => {
        forwardedEvents.push(event);
      });

      // Setup task
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'Event Forwarding Test',
        description: 'Test event forwarding during resume',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Mock pause method
      vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Step 1: First container dies
      const firstContainerEvent: ContainerDiedEventData = {
        containerId: oldContainerId,
        containerName: 'apex-first-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      mockContainerManager.emit('container:died', firstContainerEvent);
      await new Promise(process.nextTick);

      // Step 2: Resume task and start new container (simulate)
      const resumedTask: Partial<Task> = {
        ...mockTask,
        status: 'in-progress' as TaskStatus,
      };
      mockStore.getTask = vi.fn().mockResolvedValue(resumedTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Step 3: New container also dies (different scenario)
      const secondContainerEvent: ContainerDiedEventData = {
        containerId: newContainerId,
        containerName: 'apex-second-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 2,
        signal: 'SIGTERM',
        oomKilled: false,
      };

      mockContainerManager.emit('container:died', secondContainerEvent);
      await new Promise(process.nextTick);

      // Verify both events were forwarded
      expect(forwardedEvents).toHaveLength(2);
      expect(forwardedEvents[0].containerId).toBe(oldContainerId);
      expect(forwardedEvents[0].exitCode).toBe(1);
      expect(forwardedEvents[1].containerId).toBe(newContainerId);
      expect(forwardedEvents[1].exitCode).toBe(2);
      expect(forwardedEvents[1].signal).toBe('SIGTERM');
    });
  });

  describe('Container Failure Error Handling During Resume', () => {
    it('should handle errors during container failure processing without affecting resume capability', async () => {
      const taskId = 'error-handling-resume';
      const containerId = 'error-container';

      // Setup task
      const mockTask: Partial<Task> = {
        id: taskId,
        status: 'in-progress' as TaskStatus,
        name: 'Error Handling Test',
        description: 'Test error handling during failure',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStore.getTask = vi.fn().mockResolvedValue(mockTask);
      (orchestrator as any).runningTasks = new Set([taskId]);

      // Mock store.addLog to throw error
      const addLogSpy = vi.spyOn(mockStore, 'addLog').mockRejectedValue(new Error('Log storage failed'));

      // Mock pauseTask to succeed
      const pauseTaskSpy = vi.spyOn(orchestrator, 'pauseTask').mockResolvedValue(undefined);

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate container failure
      const containerDiedEvent: ContainerDiedEventData = {
        containerId,
        containerName: 'apex-error-container',
        image: 'node:20-alpine',
        taskId,
        timestamp: new Date(),
        exitCode: 1,
        signal: undefined,
        oomKilled: false,
      };

      mockContainerManager.emit('container:died', containerDiedEvent);
      await new Promise(process.nextTick);

      // Verify error was logged but operation continued
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Error handling container failure for task ${taskId}:`,
        expect.any(Error)
      );

      // Verify addLog was attempted (even though it failed)
      expect(addLogSpy).toHaveBeenCalled();

      // Task should still be available for resume despite logging error
      expect(pauseTaskSpy).toHaveBeenCalledWith(taskId, 'container_failure');

      // Cleanup
      consoleErrorSpy.mockRestore();
    });
  });
});