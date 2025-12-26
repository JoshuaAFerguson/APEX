import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { exec, spawn } from 'child_process';
import {
  ContainerManager,
  ContainerOperationResult,
  CreateContainerOptions,
  ContainerEvent,
  ContainerOperationEvent,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerHealthMonitor } from '../container-health-monitor';
import {
  ContainerConfig,
  ContainerEventData,
  ContainerCreatedEventData,
  ContainerStartedEventData,
  ContainerStoppedEventData,
  ContainerDiedEventData,
  ContainerRemovedEventData,
  ContainerHealthEventData,
  ContainerHealthStatus,
  ContainerNetworkMode,
  ApexEventType,
} from '../types';

// Mock child_process for Docker/Podman command execution
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  })),
}));

// Mock ContainerRuntime
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

// Mock ContainerHealthMonitor
vi.mock('../container-health-monitor');
const MockedContainerHealthMonitor = vi.mocked(ContainerHealthMonitor);

const mockExec = vi.mocked(exec);
const mockSpawn = vi.mocked(spawn);

/**
 * Helper to create a mock exec callback for Docker/Podman commands
 */
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any;
  });
}

/**
 * Helper to create mock spawn for Docker events monitoring
 */
function mockDockerEventsSpawn(events: Array<{ status: string; id: string; name?: string; time?: number }>) {
  const mockProcess = {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    on: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  };

  // Simulate Docker events output
  setTimeout(() => {
    events.forEach((event, index) => {
      setTimeout(() => {
        const dockerEvent = {
          status: event.status,
          id: event.id,
          from: 'node:20-alpine',
          Type: 'container',
          Action: event.status,
          Actor: {
            ID: event.id,
            Attributes: {
              name: event.name || 'apex-test-container',
              'apex.task.id': 'test-task',
            },
          },
          time: event.time || Date.now() / 1000,
          timeNano: (event.time || Date.now()) * 1000000,
        };

        mockProcess.stdout.emit('data', JSON.stringify(dockerEvent) + '\n');
      }, index * 100);
    });
  }, 50);

  return mockProcess;
}

describe('Container Lifecycle Events - Comprehensive Integration Tests', () => {
  let containerManager: ContainerManager;
  let healthMonitor: ContainerHealthMonitor;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    // Create mock runtime
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    // Create container manager
    containerManager = new ContainerManager(mockRuntime);

    // Create health monitor
    healthMonitor = new ContainerHealthMonitor(containerManager);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Container Lifecycle Operation Event Emission', () => {
    it('should emit container:created events with complete data', async () => {
      const events: ContainerOperationEvent[] = [];
      const taskId = 'test-task-created';
      const containerId = 'container-abc123';

      // Set up event listener
      containerManager.on('container:created', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      // Mock Docker create command
      mockExec.mockImplementationOnce(
        mockExecCallback(containerId)
      );

      const config: ContainerConfig = {
        image: 'node:20-alpine',
        workingDir: '/app',
        environment: {
          NODE_ENV: 'test',
          PORT: '3000',
        },
        labels: {
          'apex.task.id': taskId,
          'apex.component': 'worker',
        },
        networkMode: 'bridge' as ContainerNetworkMode,
        autoRemove: false,
      };

      // Create container
      const result = await containerManager.createContainer({
        config,
        taskId,
        autoStart: false,
      });

      expect(result.success).toBe(true);
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.containerId).toBe(containerId);
      expect(event.taskId).toBe(taskId);
      expect(event.success).toBe(true);
      expect(event.command).toContain('docker create');
      expect(event.command).toContain('node:20-alpine');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit container:started events with runtime details', async () => {
      const events: ContainerOperationEvent[] = [];
      const containerId = 'container-xyz789';

      containerManager.on('container:started', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      // Mock Docker start command
      mockExec.mockImplementationOnce(
        mockExecCallback(containerId)
      );

      // Mock inspect command to get runtime details
      mockExec.mockImplementationOnce(
        mockExecCallback(
          'abc123|test-container|node:20-alpine|running|2023-12-01T10:00:00Z|2023-12-01T10:00:05Z|bridge|12345'
        )
      );

      await containerManager.startContainer(containerId);

      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.containerId).toBe(containerId);
      expect(event.success).toBe(true);
      expect(event.command).toContain('docker start');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit container:stopped events with exit information', async () => {
      const events: ContainerOperationEvent[] = [];
      const containerId = 'container-stopped-123';

      containerManager.on('container:stopped', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      // Mock Docker stop command
      mockExec.mockImplementationOnce(
        mockExecCallback(containerId)
      );

      await containerManager.stopContainer(containerId);

      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.containerId).toBe(containerId);
      expect(event.success).toBe(true);
      expect(event.command).toContain('docker stop');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit container:removed events', async () => {
      const events: ContainerOperationEvent[] = [];
      const containerId = 'container-removed-456';

      containerManager.on('container:removed', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      // Mock Docker remove command
      mockExec.mockImplementationOnce(
        mockExecCallback(containerId)
      );

      await containerManager.removeContainer(containerId);

      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.containerId).toBe(containerId);
      expect(event.success).toBe(true);
      expect(event.command).toContain('docker rm');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit container:lifecycle events for all operations', async () => {
      const lifecycleEvents: Array<{ event: ContainerEvent; operation: string }> = [];
      const taskId = 'lifecycle-task';
      const containerId = 'lifecycle-container-789';

      containerManager.on('container:lifecycle', (event: ContainerEvent, operation: string) => {
        lifecycleEvents.push({ event, operation });
      });

      // Mock all Docker commands
      mockExec
        .mockImplementationOnce(mockExecCallback(containerId)) // create
        .mockImplementationOnce(mockExecCallback(containerId)) // start
        .mockImplementationOnce(mockExecCallback('abc123|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|bridge|12345')) // inspect
        .mockImplementationOnce(mockExecCallback(containerId)) // stop
        .mockImplementationOnce(mockExecCallback(containerId)); // remove

      // Execute full lifecycle
      await containerManager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId,
        autoStart: false,
      });

      await containerManager.startContainer(containerId);
      await containerManager.stopContainer(containerId);
      await containerManager.removeContainer(containerId);

      expect(lifecycleEvents).toHaveLength(4);
      expect(lifecycleEvents.map(e => e.operation)).toEqual([
        'created', 'started', 'stopped', 'removed'
      ]);

      lifecycleEvents.forEach(({ event }) => {
        expect(event.containerId).toBe(containerId);
        expect(event.taskId).toBe(taskId);
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('Health Monitoring Event Emission', () => {
    it('should emit health status change events', async () => {
      const healthEvents: ContainerHealthEventData[] = [];
      const containerId = 'health-monitored-container';

      healthMonitor.on('container:health', (event: ContainerHealthEventData) => {
        healthEvents.push(event);
      });

      // Mock health check commands
      mockExec
        .mockImplementationOnce(mockExecCallback('starting')) // First check
        .mockImplementationOnce(mockExecCallback('healthy')) // Second check
        .mockImplementationOnce(mockExecCallback('unhealthy')); // Third check

      // Start monitoring
      await healthMonitor.startMonitoring();

      // Wait for health checks
      await new Promise(resolve => setTimeout(resolve, 350));

      await healthMonitor.stopMonitoring();

      expect(healthEvents.length).toBeGreaterThan(0);

      // Verify health status transitions
      const statuses = healthEvents.map(e => e.status);
      expect(statuses).toContain('starting' as ContainerHealthStatus);
      expect(statuses).toContain('healthy' as ContainerHealthStatus);

      // Verify event data structure
      healthEvents.forEach(event => {
        expect(event.containerId).toBe(containerId);
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(['starting', 'healthy', 'unhealthy', 'none']).toContain(event.status);
      });
    });

    it('should emit health monitoring lifecycle events', async () => {
      const monitoringEvents: string[] = [];
      const containerId = 'monitoring-lifecycle-container';

      healthMonitor.on('monitoring:started', () => {
        monitoringEvents.push('started');
      });

      healthMonitor.on('monitoring:stopped', () => {
        monitoringEvents.push('stopped');
      });

      // Mock health check
      mockExec.mockImplementation(mockExecCallback('healthy'));

      await healthMonitor.startMonitoring();

      await new Promise(resolve => setTimeout(resolve, 100));

      await healthMonitor.stopMonitoring();

      expect(monitoringEvents).toEqual(['started', 'stopped']);
    });

    it('should handle health check failures with proper event emission', async () => {
      const healthEvents: ContainerHealthEventData[] = [];
      const containerId = 'failing-health-container';

      healthMonitor.on('container:health', (event: ContainerHealthEventData) => {
        healthEvents.push(event);
      });

      // Mock failing health checks
      mockExec
        .mockImplementationOnce(mockExecCallback('', 'Health check failed', new Error('Check failed')))
        .mockImplementationOnce(mockExecCallback('', 'Health check failed', new Error('Check failed')))
        .mockImplementationOnce(mockExecCallback('unhealthy'));

      await healthMonitor.startMonitoring();

      await new Promise(resolve => setTimeout(resolve, 350));

      await healthMonitor.stopMonitoring();

      expect(healthEvents.length).toBeGreaterThan(0);

      // Should eventually emit unhealthy status
      const finalEvent = healthEvents[healthEvents.length - 1];
      expect(finalEvent.status).toBe('unhealthy');
      expect(finalEvent.containerId).toBe(containerId);
    });
  });

  describe('Docker Events Stream Monitoring', () => {
    it('should monitor Docker events stream and emit corresponding events', async () => {
      const dockerEvents: any[] = [];
      const mockEvents = [
        { status: 'create', id: 'container-create-123', name: 'apex-worker-1' },
        { status: 'start', id: 'container-create-123', name: 'apex-worker-1' },
        { status: 'die', id: 'container-create-123', name: 'apex-worker-1' },
      ];

      // Mock spawn for Docker events
      const mockProcess = mockDockerEventsSpawn(mockEvents);
      mockSpawn.mockReturnValue(mockProcess as any);

      containerManager.on('docker:event', (event: any) => {
        dockerEvents.push(event);
      });

      // Start Docker events monitoring
      await containerManager.startEventsMonitoring({
        namePrefix: 'apex-',
      });

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      await containerManager.stopEventsMonitoring();

      expect(dockerEvents.length).toBeGreaterThan(0);

      // Verify Docker events were properly parsed and emitted
      dockerEvents.forEach(event => {
        expect(event).toHaveProperty('status');
        expect(event).toHaveProperty('id');
        expect(event.id).toBe('container-create-123');
        expect(['create', 'start', 'die']).toContain(event.status);
      });
    });

    it('should filter Docker events by container labels', async () => {
      const filteredEvents: any[] = [];
      const mockEvents = [
        { status: 'create', id: 'apex-container-1', name: 'apex-task-worker' },
        { status: 'create', id: 'other-container-1', name: 'other-service' },
        { status: 'start', id: 'apex-container-1', name: 'apex-task-worker' },
      ];

      const mockProcess = mockDockerEventsSpawn(mockEvents);
      mockSpawn.mockReturnValue(mockProcess as any);

      containerManager.on('docker:event', (event: any) => {
        // Only capture events from APEX containers
        if (event.id.startsWith('apex-') || (event.Actor && event.Actor.Attributes && event.Actor.Attributes['apex.task.id'])) {
          filteredEvents.push(event);
        }
      });

      await containerManager.startEventsMonitoring({
        namePrefix: 'apex-',
        labelFilters: {
          'apex.task.id': 'test-task',
        },
      });

      await new Promise(resolve => setTimeout(resolve, 400));

      await containerManager.stopEventsMonitoring();

      // Should only receive events from APEX containers
      expect(filteredEvents.length).toBeGreaterThan(0);
      filteredEvents.forEach(event => {
        expect(event.id).toContain('apex-');
      });
    });

    it('should handle Docker events stream connection errors', async () => {
      const errorEvents: any[] = [];

      containerManager.on('docker:events:error', (error: Error) => {
        errorEvents.push(error);
      });

      // Mock spawn that fails
      const mockFailingProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Docker daemon not running')), 100);
          }
        }),
        kill: vi.fn(),
        pid: 12345,
      };

      mockSpawn.mockReturnValue(mockFailingProcess as any);

      containerManager.startEventsMonitoring();

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].message).toContain('Docker daemon not running');
    });
  });

  describe('Event Forwarding Through Orchestrator', () => {
    it('should forward container events to orchestrator with task association', async () => {
      const forwardedEvents: any[] = [];
      const mockOrchestrator = new EventEmitter();

      // Set up orchestrator event forwarding
      containerManager.on('container:lifecycle', (event, operation) => {
        mockOrchestrator.emit('container:' + operation, {
          type: 'container:' + operation as ApexEventType,
          taskId: event.taskId || 'unknown',
          timestamp: event.timestamp,
          data: {
            containerId: event.containerId,
            containerName: 'test-container',
            image: 'node:20-alpine',
            timestamp: event.timestamp,
            ...event,
          },
        });
      });

      mockOrchestrator.on('container:created', (event) => {
        forwardedEvents.push({ type: 'created', event });
      });

      mockOrchestrator.on('container:started', (event) => {
        forwardedEvents.push({ type: 'started', event });
      });

      mockOrchestrator.on('container:stopped', (event) => {
        forwardedEvents.push({ type: 'stopped', event });
      });

      // Mock Docker commands
      const taskId = 'orchestrator-task';
      const containerId = 'orchestrator-container-123';

      mockExec
        .mockImplementationOnce(mockExecCallback(containerId))
        .mockImplementationOnce(mockExecCallback(containerId))
        .mockImplementationOnce(mockExecCallback('abc123|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|bridge|12345'))
        .mockImplementationOnce(mockExecCallback(containerId));

      // Execute container operations
      await containerManager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId,
      });

      await containerManager.startContainer(containerId);
      await containerManager.stopContainer(containerId);

      expect(forwardedEvents).toHaveLength(3);

      const types = forwardedEvents.map(e => e.type);
      expect(types).toEqual(['created', 'started', 'stopped']);

      forwardedEvents.forEach(({ event }) => {
        expect(event.taskId).toBe(taskId);
        expect(event.data.containerId).toBe(containerId);
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should maintain event ordering through orchestrator forwarding', async () => {
      const eventSequence: Array<{ type: string; timestamp: Date }> = [];
      const mockOrchestrator = new EventEmitter();

      // Track all forwarded events with timestamps
      ['created', 'started', 'health', 'stopped', 'removed'].forEach(operation => {
        mockOrchestrator.on('container:' + operation, (event) => {
          eventSequence.push({
            type: operation,
            timestamp: new Date(),
          });
        });
      });

      // Set up forwarding
      containerManager.on('container:lifecycle', (event, operation) => {
        mockOrchestrator.emit('container:' + operation, {
          type: 'container:' + operation,
          taskId: event.taskId,
          timestamp: new Date(),
          data: event,
        });
      });

      // Mock all operations
      const containerId = 'sequence-container-456';
      mockExec
        .mockImplementationOnce(mockExecCallback(containerId))
        .mockImplementationOnce(mockExecCallback(containerId))
        .mockImplementationOnce(mockExecCallback('abc123|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|bridge|12345'))
        .mockImplementationOnce(mockExecCallback(containerId))
        .mockImplementationOnce(mockExecCallback(containerId));

      // Execute operations with small delays to ensure ordering
      await containerManager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'sequence-task',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await containerManager.startContainer(containerId);

      await new Promise(resolve => setTimeout(resolve, 10));

      await containerManager.stopContainer(containerId);

      await new Promise(resolve => setTimeout(resolve, 10));

      await containerManager.removeContainer(containerId);

      expect(eventSequence.length).toBeGreaterThanOrEqual(4);

      // Verify events are in correct chronological order
      for (let i = 1; i < eventSequence.length; i++) {
        expect(eventSequence[i].timestamp.getTime())
          .toBeGreaterThanOrEqual(eventSequence[i - 1].timestamp.getTime());
      }
    });
  });

  describe('Error Scenarios and Event Emission', () => {
    it('should emit failure events when container operations fail', async () => {
      const errorEvents: ContainerOperationEvent[] = [];

      containerManager.on('container:created', (event: ContainerOperationEvent) => {
        errorEvents.push(event);
      });

      // Mock Docker command failure
      mockExec.mockImplementationOnce(
        mockExecCallback('', 'Error: image not found', new Error('Docker create failed'))
      );

      const result = await containerManager.createContainer({
        config: { image: 'nonexistent:latest' },
        taskId: 'error-task',
      });

      expect(result.success).toBe(false);
      expect(errorEvents).toHaveLength(1);

      const errorEvent = errorEvents[0];
      expect(errorEvent.success).toBe(false);
      expect(errorEvent.error).toBeDefined();
      expect(errorEvent.command).toContain('docker create');
    });

    it('should handle Docker daemon connection failures gracefully', async () => {
      const connectionErrors: any[] = [];

      containerManager.on('docker:connection:error', (error: Error) => {
        connectionErrors.push(error);
      });

      // Mock Docker command that fails due to daemon unavailability
      mockExec.mockImplementationOnce(
        mockExecCallback('', 'Cannot connect to the Docker daemon', new Error('Docker daemon not available'))
      );

      const result = await containerManager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'daemon-error-task',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Docker daemon');
    });

    it('should emit timeout events for long-running operations', async () => {
      const timeoutEvents: ContainerOperationEvent[] = [];

      containerManager.on('container:started', (event: ContainerOperationEvent) => {
        timeoutEvents.push(event);
      });

      // Mock Docker command that times out
      mockExec.mockImplementationOnce(
        vi.fn((command: string, options: any, callback) => {
          // Never call callback to simulate timeout
          return {} as any;
        })
      );

      const result = await containerManager.startContainer('timeout-container');

      // Should handle timeout gracefully
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should emit events for OOM killed containers', async () => {
      const oomEvents: any[] = [];

      containerManager.on('docker:event', (event: any) => {
        if (event.status === 'die' && event.Actor?.Attributes?.exitCode === '137') {
          oomEvents.push(event);
        }
      });

      // Mock Docker events for OOM kill
      const mockEvents = [
        {
          status: 'die',
          id: 'oom-container-123',
          name: 'memory-intensive-app',
          exitCode: 137,
        },
      ];

      const mockProcess = mockDockerEventsSpawn(mockEvents);
      mockSpawn.mockReturnValue(mockProcess as any);

      containerManager.startDockerEventsMonitoring({
        eventTypes: ['die'],
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      containerManager.stopDockerEventsMonitoring();

      expect(oomEvents.length).toBeGreaterThanOrEqual(1);
      expect(oomEvents[0].id).toBe('oom-container-123');
    });
  });

  describe('Mocked Docker/Podman Command Verification', () => {
    it('should use mocked Docker commands for all operations', async () => {
      const executedCommands: string[] = [];

      // Track all executed commands
      mockExec.mockImplementation((command: string, options: any, callback) => {
        executedCommands.push(command);
        if (callback) {
          callback(null, 'container-123', '');
        }
        return {} as any;
      });

      const taskId = 'mock-verification-task';
      const config: ContainerConfig = {
        image: 'node:20-alpine',
        workingDir: '/app',
        environment: { NODE_ENV: 'test' },
      };

      // Execute various operations
      await containerManager.createContainer({ config, taskId });
      await containerManager.startContainer('container-123');
      await containerManager.stopContainer('container-123');
      await containerManager.removeContainer('container-123');
      await containerManager.getContainerInfo('container-123');

      expect(executedCommands.length).toBeGreaterThan(0);

      // Verify Docker commands were mocked
      expect(mockExec).toHaveBeenCalled();
      expect(executedCommands.some(cmd => cmd.includes('docker create'))).toBe(true);
      expect(executedCommands.some(cmd => cmd.includes('docker start'))).toBe(true);
      expect(executedCommands.some(cmd => cmd.includes('docker stop'))).toBe(true);
      expect(executedCommands.some(cmd => cmd.includes('docker rm'))).toBe(true);
    });

    it('should support both Docker and Podman command mocking', async () => {
      const podmanCommands: string[] = [];

      // Mock Podman runtime
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

      mockExec.mockImplementation((command: string, options: any, callback) => {
        if (command.includes('podman')) {
          podmanCommands.push(command);
        }
        if (callback) {
          callback(null, 'container-podman-123', '');
        }
        return {} as any;
      });

      const podmanManager = new ContainerManager(mockRuntime);

      await podmanManager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'podman-task',
      });

      expect(podmanCommands.length).toBeGreaterThan(0);
      expect(podmanCommands[0]).toContain('podman');
    });

    it('should mock Docker events monitoring without real Docker daemon', async () => {
      const monitoringEvents: any[] = [];

      containerManager.on('docker:events:monitoring:started', () => {
        monitoringEvents.push('monitoring-started');
      });

      containerManager.on('docker:events:monitoring:stopped', () => {
        monitoringEvents.push('monitoring-stopped');
      });

      // Verify spawn is mocked
      expect(mockSpawn).toBeDefined();

      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345,
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      await containerManager.startEventsMonitoring();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('docker'),
        expect.arrayContaining(['events']),
        expect.any(Object)
      );

      await containerManager.stopEventsMonitoring();

      // Verify no real Docker daemon was contacted
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });
});