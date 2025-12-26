import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { ApexOrchestrator, ContainerLifecycleOperation } from '../index';
import { WorkspaceManager } from '../workspace-manager';
import { TaskStore } from '../store';
import {
  ContainerEventData,
  ContainerDiedEventData
} from '@apexcli/core';

// Mock the store
vi.mock('../store');

describe('WorkspaceManager Container Strategy Event Integration', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;

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

    // Mock TaskStore constructor
    (TaskStore as any).mockImplementation(() => mockStore);

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({
      configPath: '/test/config.yaml',
      projectRoot: '/test/project'
    });

    // Initialize the orchestrator
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator?.shutdown();
  });

  describe('WorkspaceManager Integration', () => {
    it('should create WorkspaceManager during initialization', () => {
      // Verify WorkspaceManager is available via the private field
      const workspaceManager = (orchestrator as any).workspaceManager;
      expect(workspaceManager).toBeInstanceOf(WorkspaceManager);
    });

    it('should have WorkspaceManager with ContainerManager available', () => {
      const workspaceManager = (orchestrator as any).workspaceManager;
      const containerManager = workspaceManager.getContainerManager();
      expect(containerManager).toBeDefined();
    });

    it('should connect container events from WorkspaceManager to orchestrator events', async () => {
      const workspaceManager = (orchestrator as any).workspaceManager;
      const containerManager = workspaceManager.getContainerManager();

      const containerCreatedEvents: ContainerEventData[] = [];
      orchestrator.on('container:created', (event) => {
        containerCreatedEvents.push(event);
      });

      // Simulate container creation event from the container manager
      const mockEvent: ContainerEventData = {
        containerId: 'integration-test-container',
        taskId: 'integration-test-task',
        containerInfo: {
          id: 'integration-test-container',
          name: 'integration-container',
          status: 'created',
          image: 'node:20-alpine',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'created',
            running: false,
            paused: false,
            restarting: false,
            oomKilled: false,
            dead: false,
            pid: 0,
            exitCode: 0,
            error: '',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        success: true,
        command: 'create'
      };

      containerManager.emit('container:created', mockEvent);

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(containerCreatedEvents).toHaveLength(1);
      expect(containerCreatedEvents[0].containerId).toBe('integration-test-container');
      expect(containerCreatedEvents[0].taskId).toBe('integration-test-task');
    });

    it('should handle complete container lifecycle through WorkspaceManager', async () => {
      const workspaceManager = (orchestrator as any).workspaceManager;
      const containerManager = workspaceManager.getContainerManager();

      const lifecycleEvents: Array<{ event: string; data: ContainerEventData; operation?: ContainerLifecycleOperation }> = [];

      // Listen to all container events
      orchestrator.on('container:created', (event) => {
        lifecycleEvents.push({ event: 'created', data: event });
      });

      orchestrator.on('container:started', (event) => {
        lifecycleEvents.push({ event: 'started', data: event });
      });

      orchestrator.on('container:stopped', (event) => {
        lifecycleEvents.push({ event: 'stopped', data: event });
      });

      orchestrator.on('container:removed', (event) => {
        lifecycleEvents.push({ event: 'removed', data: event });
      });

      orchestrator.on('container:lifecycle', (event, operation) => {
        lifecycleEvents.push({ event: 'lifecycle', data: event, operation });
      });

      const taskId = 'lifecycle-test-task';
      const containerId = 'lifecycle-test-container';

      // Simulate container creation
      containerManager.emit('container:created', {
        containerId,
        taskId,
        containerInfo: {
          id: containerId,
          name: 'lifecycle-container',
          status: 'created',
          image: 'node:20-alpine',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'created',
            running: false,
            paused: false,
            restarting: false,
            oomKilled: false,
            dead: false,
            pid: 0,
            exitCode: 0,
            error: '',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        success: true,
        command: 'create'
      });

      // Simulate container start
      containerManager.emit('container:started', {
        containerId,
        taskId,
        containerInfo: {
          id: containerId,
          name: 'lifecycle-container',
          status: 'running',
          image: 'node:20-alpine',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'running',
            running: true,
            paused: false,
            restarting: false,
            oomKilled: false,
            dead: false,
            pid: 12345,
            exitCode: 0,
            error: '',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        success: true,
        command: 'start'
      });

      // Simulate lifecycle event
      containerManager.emit('container:lifecycle', {
        containerId,
        taskId,
        containerInfo: {
          id: containerId,
          name: 'lifecycle-container',
          status: 'running',
          image: 'node:20-alpine',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'running',
            running: true,
            paused: false,
            restarting: false,
            oomKilled: false,
            dead: false,
            pid: 12345,
            exitCode: 0,
            error: '',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        success: true,
        command: 'start'
      }, 'start');

      // Simulate container stop
      containerManager.emit('container:stopped', {
        containerId,
        taskId,
        containerInfo: {
          id: containerId,
          name: 'lifecycle-container',
          status: 'exited',
          image: 'node:20-alpine',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'exited',
            running: false,
            paused: false,
            restarting: false,
            oomKilled: false,
            dead: false,
            pid: 0,
            exitCode: 0,
            error: '',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        success: true,
        command: 'stop'
      });

      // Simulate container removal
      containerManager.emit('container:removed', {
        containerId,
        taskId,
        containerInfo: {
          id: containerId,
          name: 'lifecycle-container',
          status: 'removed',
          image: 'node:20-alpine',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'removed',
            running: false,
            paused: false,
            restarting: false,
            oomKilled: false,
            dead: true,
            pid: 0,
            exitCode: 0,
            error: '',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        success: true,
        command: 'remove'
      });

      // Wait for all events to process
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify all lifecycle events were received
      expect(lifecycleEvents).toHaveLength(5);

      const createdEvent = lifecycleEvents.find(e => e.event === 'created');
      const startedEvent = lifecycleEvents.find(e => e.event === 'started');
      const lifecycleEvent = lifecycleEvents.find(e => e.event === 'lifecycle');
      const stoppedEvent = lifecycleEvents.find(e => e.event === 'stopped');
      const removedEvent = lifecycleEvents.find(e => e.event === 'removed');

      expect(createdEvent).toBeDefined();
      expect(startedEvent).toBeDefined();
      expect(lifecycleEvent).toBeDefined();
      expect(stoppedEvent).toBeDefined();
      expect(removedEvent).toBeDefined();

      // Verify all events have correct taskId
      lifecycleEvents.forEach(({ data }) => {
        expect(data.taskId).toBe(taskId);
        expect(data.containerId).toBe(containerId);
      });

      // Verify lifecycle event has operation
      expect(lifecycleEvent!.operation).toBe('start');
    });

    it('should handle container died events with proper exit codes', async () => {
      const workspaceManager = (orchestrator as any).workspaceManager;
      const containerManager = workspaceManager.getContainerManager();

      const diedEvents: ContainerDiedEventData[] = [];
      orchestrator.on('container:died', (event) => {
        diedEvents.push(event);
      });

      // Simulate container died with normal exit
      containerManager.emit('container:died', {
        containerId: 'died-container-normal',
        taskId: 'died-task-normal',
        containerInfo: {
          id: 'died-container-normal',
          name: 'died-container',
          status: 'exited',
          image: 'node:20-alpine',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'exited',
            running: false,
            paused: false,
            restarting: false,
            oomKilled: false,
            dead: true,
            pid: 0,
            exitCode: 0,
            error: '',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        exitCode: 0,
        signal: undefined,
        oomKilled: false
      });

      // Simulate container died with error
      containerManager.emit('container:died', {
        containerId: 'died-container-error',
        taskId: 'died-task-error',
        containerInfo: {
          id: 'died-container-error',
          name: 'died-container-error',
          status: 'exited',
          image: 'node:20-alpine',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'exited',
            running: false,
            paused: false,
            restarting: false,
            oomKilled: false,
            dead: true,
            pid: 0,
            exitCode: 1,
            error: 'Container exited with error',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        exitCode: 1,
        signal: 'SIGTERM',
        oomKilled: false
      });

      // Simulate container OOM killed
      containerManager.emit('container:died', {
        containerId: 'died-container-oom',
        taskId: 'died-task-oom',
        containerInfo: {
          id: 'died-container-oom',
          name: 'died-container-oom',
          status: 'oom-killed',
          image: 'node:20-alpine',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'oom-killed',
            running: false,
            paused: false,
            restarting: false,
            oomKilled: true,
            dead: true,
            pid: 0,
            exitCode: 137,
            error: 'Container killed due to memory limit',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        exitCode: 137,
        signal: 'SIGKILL',
        oomKilled: true
      });

      // Wait for events to process
      await new Promise(resolve => setTimeout(resolve, 30));

      expect(diedEvents).toHaveLength(3);

      const normalExit = diedEvents.find(e => e.containerId === 'died-container-normal');
      const errorExit = diedEvents.find(e => e.containerId === 'died-container-error');
      const oomExit = diedEvents.find(e => e.containerId === 'died-container-oom');

      expect(normalExit!.exitCode).toBe(0);
      expect(normalExit!.oomKilled).toBe(false);
      expect(normalExit!.signal).toBeUndefined();

      expect(errorExit!.exitCode).toBe(1);
      expect(errorExit!.signal).toBe('SIGTERM');
      expect(errorExit!.oomKilled).toBe(false);

      expect(oomExit!.exitCode).toBe(137);
      expect(oomExit!.signal).toBe('SIGKILL');
      expect(oomExit!.oomKilled).toBe(true);
    });

    it('should handle events without taskId for standalone containers', async () => {
      const workspaceManager = (orchestrator as any).workspaceManager;
      const containerManager = workspaceManager.getContainerManager();

      const standaloneEvents: ContainerEventData[] = [];
      orchestrator.on('container:created', (event) => {
        standaloneEvents.push(event);
      });

      // Simulate standalone container creation (no taskId)
      containerManager.emit('container:created', {
        containerId: 'standalone-container',
        taskId: undefined,
        containerInfo: {
          id: 'standalone-container',
          name: 'standalone',
          status: 'created',
          image: 'alpine:latest',
          ports: {},
          volumes: {},
          environment: {},
          networks: [],
          created: new Date(),
          state: {
            status: 'created',
            running: false,
            paused: false,
            restarting: false,
            oomKilled: false,
            dead: false,
            pid: 0,
            exitCode: 0,
            error: '',
            startedAt: new Date(),
            finishedAt: new Date()
          }
        },
        timestamp: new Date(),
        success: true,
        command: 'create'
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(standaloneEvents).toHaveLength(1);
      expect(standaloneEvents[0].taskId).toBeUndefined();
      expect(standaloneEvents[0].containerId).toBe('standalone-container');
    });
  });

  describe('Event Performance and Reliability', () => {
    it('should handle high-frequency container events without dropping them', async () => {
      const workspaceManager = (orchestrator as any).workspaceManager;
      const containerManager = workspaceManager.getContainerManager();

      const allEvents: ContainerEventData[] = [];
      orchestrator.on('container:created', (event) => {
        allEvents.push(event);
      });

      const eventCount = 100;
      const promises: Promise<void>[] = [];

      // Emit many events rapidly
      for (let i = 0; i < eventCount; i++) {
        promises.push(new Promise<void>((resolve) => {
          setTimeout(() => {
            containerManager.emit('container:created', {
              containerId: `rapid-container-${i}`,
              taskId: `rapid-task-${i}`,
              containerInfo: {
                id: `rapid-container-${i}`,
                name: `rapid-${i}`,
                status: 'created',
                image: 'node:20-alpine',
                ports: {},
                volumes: {},
                environment: {},
                networks: [],
                created: new Date(),
                state: {
                  status: 'created',
                  running: false,
                  paused: false,
                  restarting: false,
                  oomKilled: false,
                  dead: false,
                  pid: 0,
                  exitCode: 0,
                  error: '',
                  startedAt: new Date(),
                  finishedAt: new Date()
                }
              },
              timestamp: new Date(),
              success: true,
              command: 'create'
            });
            resolve();
          }, Math.random() * 10); // Random timing to simulate real conditions
        }));
      }

      await Promise.all(promises);

      // Wait for all events to process
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(allEvents).toHaveLength(eventCount);

      // Verify all events are unique and correctly formatted
      const containerIds = new Set(allEvents.map(e => e.containerId));
      expect(containerIds.size).toBe(eventCount);
    });

    it('should maintain event order for sequential container operations', async () => {
      const workspaceManager = (orchestrator as any).workspaceManager;
      const containerManager = workspaceManager.getContainerManager();

      const sequentialEvents: Array<{ event: string; containerId: string; timestamp: Date }> = [];

      ['container:created', 'container:started', 'container:stopped', 'container:removed'].forEach(eventType => {
        orchestrator.on(eventType as any, (event: ContainerEventData) => {
          sequentialEvents.push({
            event: eventType,
            containerId: event.containerId,
            timestamp: event.timestamp
          });
        });
      });

      const containerId = 'sequential-container';
      const baseTime = new Date();

      // Emit events in sequence with slight delays
      const events = [
        { type: 'container:created', delay: 0 },
        { type: 'container:started', delay: 10 },
        { type: 'container:stopped', delay: 20 },
        { type: 'container:removed', delay: 30 }
      ];

      const emitPromises = events.map(({ type, delay }) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            containerManager.emit(type, {
              containerId,
              taskId: 'sequential-task',
              containerInfo: {
                id: containerId,
                name: 'sequential',
                status: type.split(':')[1] as any,
                image: 'node:20-alpine',
                ports: {},
                volumes: {},
                environment: {},
                networks: [],
                created: new Date(),
                state: {
                  status: type.split(':')[1] as any,
                  running: type === 'container:started',
                  paused: false,
                  restarting: false,
                  oomKilled: false,
                  dead: type === 'container:removed',
                  pid: type === 'container:started' ? 12345 : 0,
                  exitCode: 0,
                  error: '',
                  startedAt: new Date(),
                  finishedAt: new Date()
                }
              },
              timestamp: new Date(baseTime.getTime() + delay),
              success: true,
              command: type.split(':')[1]
            });
            resolve();
          }, delay);
        })
      );

      await Promise.all(emitPromises);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(sequentialEvents).toHaveLength(4);

      // Verify events are in correct order
      const eventTypes = sequentialEvents.map(e => e.event);
      expect(eventTypes).toEqual([
        'container:created',
        'container:started',
        'container:stopped',
        'container:removed'
      ]);

      // Verify all events are for the same container
      sequentialEvents.forEach(event => {
        expect(event.containerId).toBe(containerId);
      });
    });
  });
});