import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { exec, spawn } from 'child_process';
import {
  ContainerManager,
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
  ContainerInfo,
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
function mockDockerEventsSpawn(events: Array<{ status: string; id: string; name?: string; time?: number; exitCode?: number }>) {
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
              exitCode: event.exitCode?.toString(),
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

/**
 * Mock orchestrator for testing event forwarding
 */
class MockOrchestrator extends EventEmitter {
  private containerEvents: Array<{ type: string; event: any; operation?: string }> = [];

  constructor() {
    super();
    this.setupContainerEventForwarding();
  }

  private setupContainerEventForwarding() {
    const eventTypes = ['created', 'started', 'stopped', 'removed', 'died', 'health', 'lifecycle'];

    eventTypes.forEach(eventType => {
      this.on(`container:${eventType}`, (event: any, operation?: string) => {
        this.containerEvents.push({ type: eventType, event, operation });
      });
    });
  }

  getContainerEvents() {
    return this.containerEvents;
  }

  clearEvents() {
    this.containerEvents = [];
  }
}

describe('Container Lifecycle Events - Complete Integration Test Suite', () => {
  let containerManager: ContainerManager;
  let healthMonitor: ContainerHealthMonitor;
  let mockRuntime: ContainerRuntime;
  let mockOrchestrator: MockOrchestrator;

  beforeEach(() => {
    // Create mock runtime
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    // Create container manager
    containerManager = new ContainerManager(mockRuntime);

    // Create health monitor
    healthMonitor = new ContainerHealthMonitor(containerManager);

    // Create mock orchestrator for testing event forwarding
    mockOrchestrator = new MockOrchestrator();

    // Set up event forwarding from container manager to orchestrator
    const forwardEvents = ['created', 'started', 'stopped', 'removed', 'died'];
    forwardEvents.forEach(eventType => {
      containerManager.on(`container:${eventType}`, (event: ContainerEventData) => {
        mockOrchestrator.emit(`container:${eventType}`, {
          type: `container:${eventType}` as ApexEventType,
          taskId: event.taskId || 'unknown',
          timestamp: event.timestamp,
          data: event,
        });
      });
    });

    // Forward lifecycle events
    containerManager.on('container:lifecycle', (event: ContainerEventData, operation: string) => {
      mockOrchestrator.emit('container:lifecycle', {
        type: 'container:lifecycle' as ApexEventType,
        taskId: event.taskId || 'unknown',
        timestamp: event.timestamp,
        data: event,
      }, operation);
    });

    // Forward health events
    healthMonitor.on('container:health', (event: ContainerHealthEventData) => {
      mockOrchestrator.emit('container:health', {
        type: 'container:health' as ApexEventType,
        taskId: event.taskId || 'unknown',
        timestamp: event.timestamp,
        data: event,
      });
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Complete Container Lifecycle with Event Emission', () => {
    it('should emit all lifecycle events for complete container workflow', async () => {
      const events: Array<{ type: string; data: any }> = [];
      const taskId = 'complete-lifecycle-task';
      const containerId = 'complete-lifecycle-container';

      // Listen to all container events
      const eventTypes = ['created', 'started', 'stopped', 'removed', 'lifecycle'];
      eventTypes.forEach(eventType => {
        containerManager.on(`container:${eventType}`, (event: any, operation?: string) => {
          events.push({ type: eventType, data: { event, operation } });
        });
      });

      // Mock all Docker commands for complete lifecycle
      mockExec
        .mockImplementationOnce(mockExecCallback(containerId)) // create
        .mockImplementationOnce(mockExecCallback(containerId)) // start
        .mockImplementationOnce(mockExecCallback(`${containerId}|test-container|node:20-alpine|running|2023-12-01T10:00:00Z|2023-12-01T10:00:05Z|bridge|12345`)) // inspect after start
        .mockImplementationOnce(mockExecCallback(containerId)) // stop
        .mockImplementationOnce(mockExecCallback(containerId)); // remove

      const config: ContainerConfig = {
        image: 'node:20-alpine',
        workingDir: '/app',
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
        },
        labels: {
          'apex.task.id': taskId,
          'apex.component': 'worker',
        },
        networkMode: 'bridge' as ContainerNetworkMode,
        autoRemove: false,
      };

      // Execute complete container lifecycle
      const createResult = await containerManager.createContainer({
        config,
        taskId,
        autoStart: false,
      });
      expect(createResult.success).toBe(true);

      const startResult = await containerManager.startContainer(containerId);
      expect(startResult.success).toBe(true);

      const stopResult = await containerManager.stopContainer(containerId);
      expect(stopResult.success).toBe(true);

      const removeResult = await containerManager.removeContainer(containerId);
      expect(removeResult.success).toBe(true);

      // Verify all lifecycle events were emitted
      expect(events.length).toBeGreaterThanOrEqual(4);

      // Verify event types and order
      const eventTypesList = events.map(e => e.type);
      expect(eventTypesList).toContain('created');
      expect(eventTypesList).toContain('started');
      expect(eventTypesList).toContain('stopped');
      expect(eventTypesList).toContain('removed');

      // Verify each event has correct data
      events.forEach(({ type, data }) => {
        if (type !== 'lifecycle') {
          expect(data.event.containerId).toBe(containerId);
          expect(data.event.taskId).toBe(taskId);
          expect(data.event.success).toBe(true);
          expect(data.event.timestamp).toBeInstanceOf(Date);
        }
      });
    });
  });

  describe('Event Forwarding Through Orchestrator Integration', () => {
    it('should forward all container events through orchestrator with proper task association', async () => {
      const taskId = 'orchestrator-forwarding-task';
      const containerId = 'orchestrator-forwarding-container';

      // Mock Docker commands
      mockExec
        .mockImplementationOnce(mockExecCallback(containerId)) // create
        .mockImplementationOnce(mockExecCallback(containerId)) // start
        .mockImplementationOnce(mockExecCallback(`${containerId}|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|bridge|12345`)) // inspect
        .mockImplementationOnce(mockExecCallback(containerId)); // stop

      // Execute container operations
      await containerManager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId,
        autoStart: false,
      });

      await containerManager.startContainer(containerId);
      await containerManager.stopContainer(containerId);

      // Verify events were forwarded to orchestrator
      const forwardedEvents = mockOrchestrator.getContainerEvents();
      expect(forwardedEvents.length).toBeGreaterThanOrEqual(3);

      // Verify event structure and task association
      forwardedEvents.forEach(({ event }) => {
        expect(event.taskId).toBe(taskId);
        expect(event.data.containerId).toBe(containerId);
        expect(event.timestamp).toBeInstanceOf(Date);
      });

      // Verify specific event types were forwarded
      const eventTypes = forwardedEvents.map(e => e.type);
      expect(eventTypes).toContain('created');
      expect(eventTypes).toContain('started');
      expect(eventTypes).toContain('stopped');
    });

    it('should maintain event ordering through orchestrator forwarding', async () => {
      const taskId = 'event-ordering-task';
      const containerId = 'event-ordering-container';

      // Clear previous events
      mockOrchestrator.clearEvents();

      // Mock Docker commands with delays to simulate real operations
      mockExec
        .mockImplementationOnce(mockExecCallback(containerId))
        .mockImplementationOnce(mockExecCallback(containerId))
        .mockImplementationOnce(mockExecCallback(`${containerId}|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|bridge|12345`));

      // Execute operations with small delays
      await containerManager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await containerManager.startContainer(containerId);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Check event ordering
      const events = mockOrchestrator.getContainerEvents();
      expect(events.length).toBeGreaterThanOrEqual(2);

      // Verify chronological order
      for (let i = 1; i < events.length; i++) {
        expect(events[i].event.timestamp.getTime())
          .toBeGreaterThanOrEqual(events[i - 1].event.timestamp.getTime());
      }
    });
  });

  describe('Health Monitoring Event Emission Integration', () => {
    it('should emit health monitoring events with proper integration', async () => {
      const healthEvents: ContainerHealthEventData[] = [];
      const containerId = 'health-integration-container';

      // Listen to health events
      healthMonitor.on('container:health', (event: ContainerHealthEventData) => {
        healthEvents.push(event);
      });

      // Mock health check commands with status transitions
      mockExec
        .mockImplementationOnce(mockExecCallback('starting'))
        .mockImplementationOnce(mockExecCallback('healthy'))
        .mockImplementationOnce(mockExecCallback('unhealthy'))
        .mockImplementationOnce(mockExecCallback('healthy'));

      // Start health monitoring
      await healthMonitor.startMonitoring();

      // Wait for multiple health checks
      await new Promise(resolve => setTimeout(resolve, 500));

      await healthMonitor.stopMonitoring();

      // Verify health events were emitted
      expect(healthEvents.length).toBeGreaterThan(0);

      // Verify health status transitions
      const statuses = healthEvents.map(e => e.status);
      expect(statuses).toContain('starting' as ContainerHealthStatus);
      expect(statuses).toContain('healthy' as ContainerHealthStatus);

      // Verify event structure
      healthEvents.forEach(event => {
        expect(event.containerId).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(['starting', 'healthy', 'unhealthy', 'none']).toContain(event.status);
      });

      // Verify events were forwarded to orchestrator
      const orchestratorHealthEvents = mockOrchestrator.getContainerEvents()
        .filter(e => e.type === 'health');
      expect(orchestratorHealthEvents.length).toBeGreaterThan(0);
    });

    it('should handle health monitoring lifecycle events', async () => {
      const monitoringEvents: string[] = [];

      // Listen to monitoring lifecycle events
      healthMonitor.on('monitoring:started', () => {
        monitoringEvents.push('started');
      });

      healthMonitor.on('monitoring:stopped', () => {
        monitoringEvents.push('stopped');
      });

      // Mock health checks
      mockExec.mockImplementation(mockExecCallback('healthy'));

      // Start and stop monitoring
      await healthMonitor.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 100));
      await healthMonitor.stopMonitoring();

      expect(monitoringEvents).toEqual(['started', 'stopped']);
    });
  });

  describe('Docker Events Stream Monitoring Integration', () => {
    it('should monitor Docker events stream and emit corresponding events', async () => {
      const dockerEvents: any[] = [];
      const mockEvents = [
        { status: 'create', id: 'stream-container-1', name: 'apex-worker-1' },
        { status: 'start', id: 'stream-container-1', name: 'apex-worker-1' },
        { status: 'die', id: 'stream-container-1', name: 'apex-worker-1', exitCode: 0 },
        { status: 'destroy', id: 'stream-container-1', name: 'apex-worker-1' },
      ];

      // Set up Docker events monitoring
      const mockProcess = mockDockerEventsSpawn(mockEvents);
      mockSpawn.mockReturnValue(mockProcess as any);

      containerManager.on('docker:event', (event: any) => {
        dockerEvents.push(event);
      });

      // Start Docker events monitoring
      await containerManager.startEventsMonitoring({
        namePrefix: 'apex-',
        eventTypes: ['create', 'start', 'die', 'destroy'],
      });

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 600));

      await containerManager.stopEventsMonitoring();

      // Verify Docker events were captured
      expect(dockerEvents.length).toBeGreaterThan(0);

      // Verify event structure
      dockerEvents.forEach(event => {
        expect(event).toHaveProperty('status');
        expect(event).toHaveProperty('id');
        expect(['create', 'start', 'die', 'destroy']).toContain(event.status);
        expect(event.id).toBe('stream-container-1');
      });
    });

    it('should filter Docker events by container labels and prefixes', async () => {
      const filteredEvents: any[] = [];
      const mockEvents = [
        { status: 'create', id: 'apex-task-container', name: 'apex-task-worker' },
        { status: 'create', id: 'other-container', name: 'other-service' },
        { status: 'start', id: 'apex-task-container', name: 'apex-task-worker' },
        { status: 'start', id: 'other-container', name: 'other-service' },
      ];

      const mockProcess = mockDockerEventsSpawn(mockEvents);
      mockSpawn.mockReturnValue(mockProcess as any);

      containerManager.on('docker:event', (event: any) => {
        // Filter for APEX containers only
        if (event.id.startsWith('apex-') ||
            (event.Actor && event.Actor.Attributes && event.Actor.Attributes['apex.task.id'])) {
          filteredEvents.push(event);
        }
      });

      await containerManager.startEventsMonitoring({
        namePrefix: 'apex-',
        labelFilters: {
          'apex.task.id': 'test-task',
        },
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      await containerManager.stopEventsMonitoring();

      // Should only contain APEX container events
      expect(filteredEvents.length).toBeGreaterThan(0);
      filteredEvents.forEach(event => {
        expect(event.id).toContain('apex-');
      });
    });
  });

  describe('Comprehensive Error Scenarios Integration', () => {
    it('should handle Docker command failures with proper event emission', async () => {
      const errorEvents: ContainerOperationEvent[] = [];
      const taskId = 'error-handling-task';

      containerManager.on('container:created', (event: ContainerOperationEvent) => {
        errorEvents.push(event);
      });

      // Mock failing Docker command
      mockExec.mockImplementationOnce(
        mockExecCallback('', 'Error: No such image: nonexistent:latest', new Error('Docker command failed'))
      );

      const result = await containerManager.createContainer({
        config: { image: 'nonexistent:latest' },
        taskId,
      });

      // Verify failure handling
      expect(result.success).toBe(false);
      expect(result.error).toContain('Docker command failed');
      expect(errorEvents).toHaveLength(1);

      const errorEvent = errorEvents[0];
      expect(errorEvent.success).toBe(false);
      expect(errorEvent.error).toBeDefined();
      expect(errorEvent.taskId).toBe(taskId);

      // Verify error was forwarded to orchestrator
      const orchestratorEvents = mockOrchestrator.getContainerEvents();
      const errorForwardedEvent = orchestratorEvents.find(e => e.type === 'created');
      expect(errorForwardedEvent).toBeDefined();
      expect(errorForwardedEvent!.event.data.success).toBe(false);
    });

    it('should handle Docker daemon connection failures', async () => {
      const connectionErrors: any[] = [];

      containerManager.on('docker:connection:error', (error: Error) => {
        connectionErrors.push(error);
      });

      // Mock Docker daemon unavailability
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

    it('should handle Docker events stream connection errors', async () => {
      const streamErrors: any[] = [];

      containerManager.on('docker:events:error', (error: Error) => {
        streamErrors.push(error);
      });

      // Mock failing Docker events stream
      const mockFailingProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Docker events stream failed')), 100);
          }
        }),
        kill: vi.fn(),
        pid: 12345,
      };

      mockSpawn.mockReturnValue(mockFailingProcess as any);

      containerManager.startEventsMonitoring();

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(streamErrors.length).toBeGreaterThan(0);
      expect(streamErrors[0].message).toContain('Docker events stream failed');
    });

    it('should handle OOM killed containers with proper event emission', async () => {
      const oomEvents: any[] = [];

      containerManager.on('docker:event', (event: any) => {
        if (event.status === 'die' &&
            event.Actor?.Attributes?.exitCode === '137') {
          oomEvents.push(event);
        }
      });

      // Mock OOM kill event
      const mockEvents = [
        {
          status: 'die',
          id: 'oom-container',
          name: 'memory-intensive-app',
          exitCode: 137,
        },
      ];

      const mockProcess = mockDockerEventsSpawn(mockEvents);
      mockSpawn.mockReturnValue(mockProcess as any);

      containerManager.startEventsMonitoring({
        eventTypes: ['die'],
      });

      await new Promise(resolve => setTimeout(resolve, 300));
      containerManager.stopEventsMonitoring();

      expect(oomEvents.length).toBeGreaterThan(0);
      expect(oomEvents[0].id).toBe('oom-container');
    });

    it('should handle health monitoring failures gracefully', async () => {
      const healthErrors: any[] = [];

      healthMonitor.on('container:health:error', (error: any) => {
        healthErrors.push(error);
      });

      // Mock failing health checks
      mockExec
        .mockImplementationOnce(mockExecCallback('', 'Health check failed', new Error('Health check error')))
        .mockImplementationOnce(mockExecCallback('', 'Health check failed', new Error('Health check error')))
        .mockImplementationOnce(mockExecCallback('unhealthy'));

      await healthMonitor.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 350));
      await healthMonitor.stopMonitoring();

      // Should handle errors gracefully and continue monitoring
      const healthEvents = mockOrchestrator.getContainerEvents()
        .filter(e => e.type === 'health');
      expect(healthEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Mocked Docker/Podman Command Verification', () => {
    it('should use mocked Docker commands exclusively', async () => {
      const executedCommands: string[] = [];

      // Track all command executions
      mockExec.mockImplementation((command: string, options: any, callback) => {
        executedCommands.push(command);
        if (callback) {
          callback(null, 'test-container-123', '');
        }
        return {} as any;
      });

      const taskId = 'mock-verification-task';
      const config: ContainerConfig = {
        image: 'node:20-alpine',
        workingDir: '/app',
        environment: { NODE_ENV: 'test' },
        labels: { 'apex.test': 'true' },
      };

      // Execute various container operations
      await containerManager.createContainer({ config, taskId });
      await containerManager.startContainer('test-container-123');
      await containerManager.stopContainer('test-container-123');
      await containerManager.removeContainer('test-container-123');
      await containerManager.getContainerInfo('test-container-123');

      // Verify all commands were mocked
      expect(executedCommands.length).toBeGreaterThan(0);
      expect(mockExec).toHaveBeenCalled();

      // Verify specific Docker commands
      expect(executedCommands.some(cmd => cmd.includes('docker create'))).toBe(true);
      expect(executedCommands.some(cmd => cmd.includes('docker start'))).toBe(true);
      expect(executedCommands.some(cmd => cmd.includes('docker stop'))).toBe(true);
      expect(executedCommands.some(cmd => cmd.includes('docker rm'))).toBe(true);
      expect(executedCommands.some(cmd => cmd.includes('docker inspect') || cmd.includes('docker ps'))).toBe(true);
    });

    it('should support both Docker and Podman command mocking', async () => {
      const podmanCommands: string[] = [];

      // Switch to Podman runtime
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

      mockExec.mockImplementation((command: string, options: any, callback) => {
        if (command.includes('podman')) {
          podmanCommands.push(command);
        }
        if (callback) {
          callback(null, 'podman-container-123', '');
        }
        return {} as any;
      });

      const podmanManager = new ContainerManager(mockRuntime);

      await podmanManager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'podman-test-task',
      });

      expect(podmanCommands.length).toBeGreaterThan(0);
      expect(podmanCommands[0]).toContain('podman');
    });

    it('should verify Docker events monitoring uses mocked spawn', async () => {
      const spawnCalls: any[] = [];

      mockSpawn.mockImplementation((...args) => {
        spawnCalls.push(args);
        return {
          stdout: new EventEmitter(),
          stderr: new EventEmitter(),
          on: vi.fn(),
          kill: vi.fn(),
          pid: 12345,
        } as any;
      });

      await containerManager.startEventsMonitoring();
      await containerManager.stopEventsMonitoring();

      expect(spawnCalls.length).toBeGreaterThan(0);

      // Verify Docker events command structure
      const eventsCall = spawnCalls.find(call =>
        call[0].includes('docker') && call[1].includes('events')
      );
      expect(eventsCall).toBeDefined();
    });
  });
});