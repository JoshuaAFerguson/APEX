import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ApexOrchestrator, ContainerLifecycleOperation } from '../index';
import { WorkspaceManager } from '../workspace-manager';
import { TaskStore } from '../store';
import {
  ContainerEventData,
  ContainerDiedEventData,
  ContainerManager,
  ContainerInfo
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

describe('ApexOrchestrator Container Event Forwarding', () => {
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
    } as any;

    // Create mock container manager that extends EventEmitter
    mockContainerManager = new EventEmitter();

    // Create mock workspace manager
    mockWorkspaceManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      getContainerManager: vi.fn().mockReturnValue(mockContainerManager),
    } as any;

    // Mock TaskStore constructor
    (TaskStore as any).mockImplementation(() => mockStore);

    // Mock WorkspaceManager constructor
    (WorkspaceManager as any).mockImplementation(() => mockWorkspaceManager);

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({
      configPath: '/test/config.yaml',
      projectRoot: '/test/project'
    });

    // Initialize the orchestrator to set up event forwarding
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator?.shutdown();
  });

  describe('Container Event Forwarding Setup', () => {
    it('should set up container event forwarding during initialization', async () => {
      // Verify that workspace manager was asked for container manager
      expect(mockWorkspaceManager.getContainerManager).toHaveBeenCalled();
    });

    it('should forward container:created events with taskId association', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'created'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'create'
      };

      orchestrator.on('container:created', (event: ContainerEventData) => {
        expect(event.containerId).toBe('container123');
        expect(event.taskId).toBe('task456');
        expect(event.containerInfo.id).toBe('container123');
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.success).toBe(true);
        expect(event.command).toBe('create');
        done();
      });

      mockContainerManager.emit('container:created', mockEvent);
    });

    it('should forward container:started events with proper data structure', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'running'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'start'
      };

      orchestrator.on('container:started', (event: ContainerEventData) => {
        expect(event).toEqual(mockEvent);
        done();
      });

      mockContainerManager.emit('container:started', mockEvent);
    });

    it('should forward container:stopped events', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'exited'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'stop'
      };

      orchestrator.on('container:stopped', (event: ContainerEventData) => {
        expect(event.containerId).toBe('container123');
        expect(event.taskId).toBe('task456');
        expect(event.success).toBe(true);
        done();
      });

      mockContainerManager.emit('container:stopped', mockEvent);
    });

    it('should forward container:removed events', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'removed'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'remove'
      };

      orchestrator.on('container:removed', (event: ContainerEventData) => {
        expect(event.containerId).toBe('container123');
        expect(event.taskId).toBe('task456');
        done();
      });

      mockContainerManager.emit('container:removed', mockEvent);
    });
  });

  describe('Container Died Events', () => {
    it('should forward container:died events with exit code information', (done) => {
      const mockEvent: ContainerDiedEventData = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'exited'
        } as ContainerInfo,
        timestamp: new Date(),
        exitCode: 1,
        signal: 'SIGTERM',
        oomKilled: false
      };

      orchestrator.on('container:died', (event: ContainerDiedEventData) => {
        expect(event.containerId).toBe('container123');
        expect(event.taskId).toBe('task456');
        expect(event.exitCode).toBe(1);
        expect(event.signal).toBe('SIGTERM');
        expect(event.oomKilled).toBe(false);
        done();
      });

      mockContainerManager.emit('container:died', mockEvent);
    });

    it('should forward container:died events with OOM kill information', (done) => {
      const mockEvent: ContainerDiedEventData = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'oom-killed'
        } as ContainerInfo,
        timestamp: new Date(),
        exitCode: 137,
        signal: 'SIGKILL',
        oomKilled: true
      };

      orchestrator.on('container:died', (event: ContainerDiedEventData) => {
        expect(event.exitCode).toBe(137);
        expect(event.oomKilled).toBe(true);
        expect(event.signal).toBe('SIGKILL');
        done();
      });

      mockContainerManager.emit('container:died', mockEvent);
    });

    it('should handle container:died events without taskId association', (done) => {
      const mockEvent: ContainerDiedEventData = {
        containerId: 'container123',
        taskId: undefined, // No task association
        containerInfo: {
          id: 'container123',
          name: 'standalone-container',
          status: 'exited'
        } as ContainerInfo,
        timestamp: new Date(),
        exitCode: 0,
        signal: undefined,
        oomKilled: false
      };

      orchestrator.on('container:died', (event: ContainerDiedEventData) => {
        expect(event.containerId).toBe('container123');
        expect(event.taskId).toBeUndefined();
        expect(event.exitCode).toBe(0);
        done();
      });

      mockContainerManager.emit('container:died', mockEvent);
    });
  });

  describe('Container Lifecycle Events', () => {
    it('should forward container:lifecycle events with operation parameter', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'running'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'start'
      };

      const operation: ContainerLifecycleOperation = 'start';

      orchestrator.on('container:lifecycle', (event: ContainerEventData, op: ContainerLifecycleOperation) => {
        expect(event.containerId).toBe('container123');
        expect(event.taskId).toBe('task456');
        expect(op).toBe('start');
        done();
      });

      mockContainerManager.emit('container:lifecycle', mockEvent, operation);
    });

    it('should forward container:lifecycle events for stop operation', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'exited'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'stop'
      };

      const operation: ContainerLifecycleOperation = 'stop';

      orchestrator.on('container:lifecycle', (event: ContainerEventData, op: ContainerLifecycleOperation) => {
        expect(op).toBe('stop');
        expect(event.success).toBe(true);
        done();
      });

      mockContainerManager.emit('container:lifecycle', mockEvent, operation);
    });

    it('should forward container:lifecycle events for remove operation', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'removed'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'remove'
      };

      const operation: ContainerLifecycleOperation = 'remove';

      orchestrator.on('container:lifecycle', (event: ContainerEventData, op: ContainerLifecycleOperation) => {
        expect(op).toBe('remove');
        done();
      });

      mockContainerManager.emit('container:lifecycle', mockEvent, operation);
    });
  });

  describe('Event Error Handling', () => {
    it('should forward container events with error information', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'error'
        } as ContainerInfo,
        timestamp: new Date(),
        success: false,
        error: 'Failed to start container',
        command: 'start'
      };

      orchestrator.on('container:started', (event: ContainerEventData) => {
        expect(event.success).toBe(false);
        expect(event.error).toBe('Failed to start container');
        done();
      });

      mockContainerManager.emit('container:started', mockEvent);
    });

    it('should handle container events without error field when successful', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'running'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'start'
      };

      orchestrator.on('container:started', (event: ContainerEventData) => {
        expect(event.success).toBe(true);
        expect(event.error).toBeUndefined();
        done();
      });

      mockContainerManager.emit('container:started', mockEvent);
    });
  });

  describe('Task ID Association', () => {
    it('should preserve taskId association in forwarded events', (done) => {
      const taskIds = ['task1', 'task2', 'task3'];
      let eventCount = 0;

      orchestrator.on('container:created', (event: ContainerEventData) => {
        expect(taskIds).toContain(event.taskId);
        eventCount++;
        if (eventCount === taskIds.length) {
          done();
        }
      });

      taskIds.forEach((taskId, index) => {
        const mockEvent = {
          containerId: `container${index}`,
          taskId: taskId,
          containerInfo: {
            id: `container${index}`,
            name: `test-container-${index}`,
            status: 'created'
          } as ContainerInfo,
          timestamp: new Date(),
          success: true,
          command: 'create'
        };

        mockContainerManager.emit('container:created', mockEvent);
      });
    });

    it('should handle events with undefined taskId', (done) => {
      const mockEvent = {
        containerId: 'container123',
        taskId: undefined,
        containerInfo: {
          id: 'container123',
          name: 'standalone-container',
          status: 'created'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'create'
      };

      orchestrator.on('container:created', (event: ContainerEventData) => {
        expect(event.taskId).toBeUndefined();
        expect(event.containerId).toBe('container123');
        done();
      });

      mockContainerManager.emit('container:created', mockEvent);
    });
  });

  describe('Event Forwarding Isolation', () => {
    it('should not interfere with other orchestrator events', async () => {
      const containerEventReceived = vi.fn();
      const otherEventReceived = vi.fn();

      orchestrator.on('container:created', containerEventReceived);
      orchestrator.on('task:created' as any, otherEventReceived);

      // Emit container event
      const mockContainerEvent = {
        containerId: 'container123',
        taskId: 'task456',
        containerInfo: {
          id: 'container123',
          name: 'test-container',
          status: 'created'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'create'
      };

      mockContainerManager.emit('container:created', mockContainerEvent);

      // Emit other event directly on orchestrator
      orchestrator.emit('task:created' as any, { taskId: 'task123' });

      // Wait for events to process
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(containerEventReceived).toHaveBeenCalledTimes(1);
      expect(otherEventReceived).toHaveBeenCalledTimes(1);
    });
  });

  describe('Container Manager Integration', () => {
    it('should call getContainerManager on workspace manager during setup', () => {
      expect(mockWorkspaceManager.getContainerManager).toHaveBeenCalled();
    });

    it('should handle multiple container managers if workspace manager changes', async () => {
      // Create a new container manager
      const newMockContainerManager = new EventEmitter();
      mockWorkspaceManager.getContainerManager = vi.fn().mockReturnValue(newMockContainerManager);

      // Re-initialize to trigger new setup
      await orchestrator.shutdown();
      await orchestrator.initialize();

      const eventReceived = vi.fn();
      orchestrator.on('container:created', eventReceived);

      // Emit from new container manager
      const mockEvent = {
        containerId: 'new-container',
        taskId: 'new-task',
        containerInfo: {
          id: 'new-container',
          name: 'new-test-container',
          status: 'created'
        } as ContainerInfo,
        timestamp: new Date(),
        success: true,
        command: 'create'
      };

      newMockContainerManager.emit('container:created', mockEvent);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(eventReceived).toHaveBeenCalledWith(mockEvent);
    });
  });
});