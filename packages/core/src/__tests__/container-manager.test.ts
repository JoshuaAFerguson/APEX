import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { EventEmitter } from 'eventemitter3';
import {
  ContainerManager,
  ContainerLogStream,
  containerManager,
  createTaskContainer,
  generateTaskContainerName,
  type ContainerOperationResult,
  type CreateContainerOptions,
  type ContainerEvent,
  type ContainerOperationEvent,
  type ContainerManagerEvents,
  type ExecCommandOptions,
  type ExecCommandResult,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerConfig, ContainerStats, ContainerStatus } from '../types';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

// Mock ContainerRuntime
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

// Helper to create a mock exec callback
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any; // Mock ChildProcess
  });
}

describe('ContainerManager', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    // Create a mock runtime
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Container Name Generation Tests
  // ============================================================================

  describe('generateContainerName', () => {
    it('should generate name with default configuration', () => {
      const taskId = 'task-123';
      const name = manager.generateContainerName(taskId);

      expect(name).toBe('apex-task-123');
    });

    it('should sanitize invalid characters in task ID', () => {
      const taskId = 'task@123#invalid!';
      const name = manager.generateContainerName(taskId);

      expect(name).toBe('apex-task_123_invalid_');
    });

    it('should include timestamp when configured', () => {
      const taskId = 'task-123';
      const name = manager.generateContainerName(taskId, { includeTimestamp: true });

      expect(name).toMatch(/^apex-task-123-[a-z0-9]+$/);
    });

    it('should exclude task ID when configured', () => {
      const taskId = 'task-123';
      const name = manager.generateContainerName(taskId, { includeTaskId: false });

      expect(name).toBe('apex');
    });

    it('should use custom prefix and separator', () => {
      const taskId = 'task-123';
      const name = manager.generateContainerName(taskId, {
        prefix: 'custom',
        separator: '_',
      });

      expect(name).toBe('custom_task-123');
    });
  });

  // ============================================================================
  // Container Creation Tests
  // ============================================================================

  describe('createContainer', () => {
    const basicConfig: ContainerConfig = {
      image: 'node:20-alpine',
      autoRemove: true,
    };

    const createOptions: CreateContainerOptions = {
      config: basicConfig,
      taskId: 'task-123',
      autoStart: false,
    };

    it('should create container successfully', async () => {
      const containerId = 'abc123';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer(createOptions);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(result.command).toContain('docker create');
      expect(result.command).toContain('--name apex-task-123');
      expect(result.command).toContain('node:20-alpine');
    });

    it('should handle container creation failure', async () => {
      const stderr = 'Error: Unable to find image';
      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.createContainer(createOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container creation failed');
      expect(result.error).toContain(stderr);
    });

    it('should handle no container runtime available', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

      const result = await manager.createContainer(createOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No container runtime available');
    });

    it('should create container with volume mounts', async () => {
      const containerId = 'abc123';
      const configWithVolumes: ContainerConfig = {
        ...basicConfig,
        volumes: {
          '/host/path': '/container/path',
          '/another/host': '/another/container',
        },
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithVolumes,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('-v /host/path:/container/path');
      expect(result.command).toContain('-v /another/host:/another/container');
    });

    it('should create container with environment variables', async () => {
      const containerId = 'abc123';
      const configWithEnv: ContainerConfig = {
        ...basicConfig,
        environment: {
          NODE_ENV: 'development',
          API_KEY: 'secret-key',
        },
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithEnv,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('-e NODE_ENV=development');
      expect(result.command).toContain('-e API_KEY=secret-key');
    });

    it('should create container with resource limits', async () => {
      const containerId = 'abc123';
      const configWithLimits: ContainerConfig = {
        ...basicConfig,
        resourceLimits: {
          memory: '512m',
          cpu: 0.5,
          cpuShares: 1024,
        },
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithLimits,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--memory 512m');
      expect(result.command).toContain('--cpus 0.5');
      expect(result.command).toContain('--cpu-shares 1024');
    });

    it('should create container with security options', async () => {
      const containerId = 'abc123';
      const configWithSecurity: ContainerConfig = {
        ...basicConfig,
        privileged: true,
        capAdd: ['SYS_ADMIN'],
        capDrop: ['NET_RAW'],
        securityOpts: ['apparmor=unconfined'],
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithSecurity,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--privileged');
      expect(result.command).toContain('--cap-add SYS_ADMIN');
      expect(result.command).toContain('--cap-drop NET_RAW');
      expect(result.command).toContain('--security-opt apparmor=unconfined');
    });

    it('should auto-start container when requested', async () => {
      const containerId = 'abc123';

      // Mock container creation
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      // Mock container start
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      // Mock container info for both start and after start
      const inspectOutput = 'abc123|apex-task-123|node:20-alpine|running|2023-01-01T00:00:00Z|2023-01-01T00:00:01Z||0';
      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));
      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const result = await manager.createContainer({
        ...createOptions,
        autoStart: true,
      });

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('docker start'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should use custom container name when provided', async () => {
      const containerId = 'abc123';
      const customName = 'custom-container-name';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        nameOverride: customName,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain(`--name ${customName}`);
    });

    it('should escape shell arguments with special characters', async () => {
      const containerId = 'abc123';
      const configWithSpecialChars: ContainerConfig = {
        ...basicConfig,
        environment: {
          'COMPLEX_VAR': 'value with spaces & special chars',
        },
        workingDir: '/path with spaces',
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        ...createOptions,
        config: configWithSpecialChars,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain("'COMPLEX_VAR=value with spaces & special chars'");
      expect(result.command).toContain("'/path with spaces'");
    });
  });

  // ============================================================================
  // Container Lifecycle Tests
  // ============================================================================

  describe('startContainer', () => {
    it('should start container successfully', async () => {
      const containerId = 'abc123';

      // Mock start command
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      // Mock inspect command
      const inspectOutput = 'abc123|apex-task-123|node:20-alpine|running|2023-01-01T00:00:00Z|2023-01-01T00:00:01Z||0';
      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(result.containerInfo?.status).toBe('running');
    });

    it('should handle container start failure', async () => {
      const containerId = 'abc123';
      const stderr = 'Error: Container is not created';

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container start failed');
      expect(result.error).toContain(stderr);
    });
  });

  describe('stopContainer', () => {
    it('should stop container successfully', async () => {
      const containerId = 'abc123';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.stopContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(result.command).toContain('docker stop --time 10');
    });

    it('should use custom timeout', async () => {
      const containerId = 'abc123';
      const timeout = 30;

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.stopContainer(containerId, 'docker', timeout);

      expect(result.success).toBe(true);
      expect(result.command).toContain(`docker stop --time ${timeout}`);
    });

    it('should handle container stop failure', async () => {
      const containerId = 'abc123';
      const stderr = 'Error: Container not found';

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.stopContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container stop failed');
    });
  });

  describe('removeContainer', () => {
    it('should remove container successfully', async () => {
      const containerId = 'abc123';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.removeContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe(containerId);
      expect(result.command).toContain('docker rm');
    });

    it('should force remove container when requested', async () => {
      const containerId = 'abc123';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.removeContainer(containerId, 'docker', true);

      expect(result.success).toBe(true);
      expect(result.command).toContain('docker rm --force');
    });

    it('should handle container removal failure', async () => {
      const containerId = 'abc123';
      const stderr = 'Error: Container is running';

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      const result = await manager.removeContainer(containerId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container removal failed');
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe('event emission', () => {
    it('should extend EventEmitter3', () => {
      expect(manager).toBeInstanceOf(EventEmitter);
    });

    it('should emit container:created event on successful creation', async () => {
      const containerId = 'abc123';
      const taskId = 'task-123';
      const events: ContainerOperationEvent[] = [];

      // Listen for events
      manager.on('container:created', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId,
      });

      expect(events).toHaveLength(1);
      expect(events[0].containerId).toBe(containerId);
      expect(events[0].taskId).toBe(taskId);
      expect(events[0].success).toBe(true);
      expect(events[0].timestamp).toBeInstanceOf(Date);
    });

    it('should emit container:created event on failed creation', async () => {
      const taskId = 'task-123';
      const stderr = 'Image not found';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:created', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      await manager.createContainer({
        config: { image: 'nonexistent:image' },
        taskId,
      });

      expect(events).toHaveLength(1);
      expect(events[0].containerId).toBe('');
      expect(events[0].taskId).toBe(taskId);
      expect(events[0].success).toBe(false);
      expect(events[0].error).toContain('Container creation failed');
    });

    it('should emit container:started event on successful start', async () => {
      const containerId = 'abc123';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:started', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      // Mock start command
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      // Mock inspect command
      mockExec.mockImplementationOnce(mockExecCallback('abc123|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>'));

      await manager.startContainer(containerId);

      expect(events).toHaveLength(1);
      expect(events[0].containerId).toBe(containerId);
      expect(events[0].success).toBe(true);
      expect(events[0].containerInfo?.status).toBe('running');
    });

    it('should emit container:started event on failed start', async () => {
      const containerId = 'abc123';
      const stderr = 'Container not found';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:started', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      await manager.startContainer(containerId);

      expect(events).toHaveLength(1);
      expect(events[0].containerId).toBe(containerId);
      expect(events[0].success).toBe(false);
      expect(events[0].error).toContain('Container start failed');
    });

    it('should emit container:stopped event on successful stop', async () => {
      const containerId = 'abc123';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:stopped', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      await manager.stopContainer(containerId);

      expect(events).toHaveLength(1);
      expect(events[0].containerId).toBe(containerId);
      expect(events[0].success).toBe(true);
    });

    it('should emit container:stopped event on failed stop', async () => {
      const containerId = 'abc123';
      const stderr = 'Container not running';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:stopped', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      await manager.stopContainer(containerId);

      expect(events).toHaveLength(1);
      expect(events[0].containerId).toBe(containerId);
      expect(events[0].success).toBe(false);
      expect(events[0].error).toContain('Container stop failed');
    });

    it('should emit container:removed event on successful removal', async () => {
      const containerId = 'abc123';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:removed', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      await manager.removeContainer(containerId);

      expect(events).toHaveLength(1);
      expect(events[0].containerId).toBe(containerId);
      expect(events[0].success).toBe(true);
    });

    it('should emit container:removed event on failed removal', async () => {
      const containerId = 'abc123';
      const stderr = 'Container is running';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:removed', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      mockExec.mockImplementationOnce(mockExecCallback('', stderr));

      await manager.removeContainer(containerId);

      expect(events).toHaveLength(1);
      expect(events[0].containerId).toBe(containerId);
      expect(events[0].success).toBe(false);
      expect(events[0].error).toContain('Container removal failed');
    });

    it('should emit container:lifecycle event for all operations', async () => {
      const containerId = 'abc123';
      const lifecycleEvents: Array<{ event: ContainerEvent; operation: string }> = [];

      manager.on('container:lifecycle', (event: ContainerEvent, operation: string) => {
        lifecycleEvents.push({ event, operation });
      });

      // Test creation
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'test-lifecycle',
      });

      // Test start
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      mockExec.mockImplementationOnce(mockExecCallback('abc123|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>'));
      await manager.startContainer(containerId);

      // Test stop
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      await manager.stopContainer(containerId);

      // Test removal
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      await manager.removeContainer(containerId);

      expect(lifecycleEvents).toHaveLength(4);
      expect(lifecycleEvents[0].operation).toBe('created');
      expect(lifecycleEvents[1].operation).toBe('started');
      expect(lifecycleEvents[2].operation).toBe('stopped');
      expect(lifecycleEvents[3].operation).toBe('removed');

      // Verify all events have the same container ID
      lifecycleEvents.forEach(({ event }) => {
        expect(event.containerId).toBe(containerId);
      });
    });

    it('should emit events with correct data when no runtime available', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

      const events: ContainerOperationEvent[] = [];
      manager.on('container:created', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'no-runtime-test',
      });

      expect(events).toHaveLength(1);
      expect(events[0].success).toBe(false);
      expect(events[0].error).toContain('No container runtime available');
      expect(events[0].containerId).toBe('');
    });

    it('should emit events with command information', async () => {
      const containerId = 'abc123';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:created', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      await manager.createContainer({
        config: {
          image: 'node:20-alpine',
          environment: { NODE_ENV: 'test' }
        },
        taskId: 'command-test',
      });

      expect(events).toHaveLength(1);
      expect(events[0].command).toContain('docker create');
      expect(events[0].command).toContain('node:20-alpine');
      expect(events[0].command).toContain('NODE_ENV=test');
    });

    it('should handle multiple event listeners', async () => {
      const containerId = 'abc123';
      const listener1Events: ContainerOperationEvent[] = [];
      const listener2Events: ContainerOperationEvent[] = [];

      manager.on('container:created', (event) => listener1Events.push(event));
      manager.on('container:created', (event) => listener2Events.push(event));

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'multi-listener-test',
      });

      expect(listener1Events).toHaveLength(1);
      expect(listener2Events).toHaveLength(1);
      expect(listener1Events[0].containerId).toBe(containerId);
      expect(listener2Events[0].containerId).toBe(containerId);
    });

    it('should include container info in events when available', async () => {
      const containerId = 'abc123';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:started', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      mockExec.mockImplementationOnce(mockExecCallback('abc123|test-container|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>'));

      await manager.startContainer(containerId);

      expect(events).toHaveLength(1);
      expect(events[0].containerInfo).toBeDefined();
      expect(events[0].containerInfo?.id).toBe(containerId);
      expect(events[0].containerInfo?.name).toBe('test-container');
      expect(events[0].containerInfo?.status).toBe('running');
    });

    it('should emit events with exception handling', async () => {
      const containerId = 'abc123';
      const events: ContainerOperationEvent[] = [];

      manager.on('container:created', (event: ContainerOperationEvent) => {
        events.push(event);
      });

      // Mock an exception during command execution
      mockExec.mockImplementationOnce(() => {
        throw new Error('Command execution failed');
      });

      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'exception-test',
      });

      expect(events).toHaveLength(1);
      expect(events[0].success).toBe(false);
      expect(events[0].error).toContain('Container creation failed');
    });

    it('should preserve event data integrity across operations', async () => {
      const containerId = 'abc123';
      const taskId = 'integrity-test';
      const allEvents: ContainerOperationEvent[] = [];

      // Listen to all event types
      manager.on('container:created', (event) => allEvents.push({ ...event, _type: 'created' }));
      manager.on('container:started', (event) => allEvents.push({ ...event, _type: 'started' }));
      manager.on('container:stopped', (event) => allEvents.push({ ...event, _type: 'stopped' }));
      manager.on('container:removed', (event) => allEvents.push({ ...event, _type: 'removed' }));

      // Perform full lifecycle
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      await manager.createContainer({ config: { image: 'node:20-alpine' }, taskId });

      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      mockExec.mockImplementationOnce(mockExecCallback('abc123|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>'));
      await manager.startContainer(containerId);

      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      await manager.stopContainer(containerId);

      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      await manager.removeContainer(containerId);

      expect(allEvents).toHaveLength(4);

      // Verify all events maintain consistent container ID
      allEvents.forEach(event => {
        expect(event.containerId).toBe(containerId);
        expect(event.timestamp).toBeInstanceOf(Date);
      });

      // Verify task ID is preserved for creation event
      const createEvent = allEvents.find(e => (e as any)._type === 'created');
      expect(createEvent?.taskId).toBe(taskId);
    });
  });

  // ============================================================================
  // Container Information Tests
  // ============================================================================

  // ============================================================================
  // Container Inspection Tests
  // ============================================================================

  describe('inspect', () => {
    it('should return container info using inspect method', async () => {
      const containerId = 'abc123';
      const inspectOutput = 'abc123456|/apex-task-123|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const info = await manager.inspect(containerId);

      expect(info).not.toBeNull();
      expect(info!.id).toBe('abc123456');
      expect(info!.name).toBe('apex-task-123');
      expect(info!.status).toBe('running');
    });

    it('should return null for non-existent container in inspect', async () => {
      const containerId = 'nonexistent';

      mockExec.mockImplementationOnce(mockExecCallback('', '', new Error('No such container')));

      const info = await manager.inspect(containerId);

      expect(info).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should parse container stats correctly', async () => {
      const containerId = 'abc123';
      const statsOutput = 'CONTAINER|CPU %|MEM USAGE / LIMIT|MEM %|NET I/O|BLOCK I/O|PIDS\nabc123|25.50%|512MiB / 1GiB|50.00%|1.2kB / 800B|1.5MB / 900kB|42';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(25.5);
      expect(stats!.memoryUsage).toBe(512 * 1024 * 1024); // 512 MiB in bytes
      expect(stats!.memoryLimit).toBe(1024 * 1024 * 1024); // 1 GiB in bytes
      expect(stats!.memoryPercent).toBe(50.0);
      expect(stats!.networkRxBytes).toBe(1200); // 1.2kB in bytes
      expect(stats!.networkTxBytes).toBe(800); // 800B
      expect(stats!.blockReadBytes).toBe(1500000); // 1.5MB in bytes
      expect(stats!.blockWriteBytes).toBe(900000); // 900kB in bytes
      expect(stats!.pids).toBe(42);
    });

    it('should handle stats command failure', async () => {
      const containerId = 'abc123';

      mockExec.mockImplementationOnce(mockExecCallback('', '', new Error('Container not running')));

      const stats = await manager.getStats(containerId);

      expect(stats).toBeNull();
    });

    it('should handle malformed stats output', async () => {
      const containerId = 'abc123';
      const malformedOutput = 'incomplete-stats-data';

      mockExec.mockImplementationOnce(mockExecCallback(malformedOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).toBeNull();
    });

    it('should parse different memory units correctly', async () => {
      const testCases = [
        { input: '512B / 1KiB', expectedUsage: 512, expectedLimit: 1024 },
        { input: '1.5MiB / 2GiB', expectedUsage: 1.5 * 1024 * 1024, expectedLimit: 2 * 1024 * 1024 * 1024 },
        { input: '2.5GB / 4TB', expectedUsage: 2.5 * 1000000000, expectedLimit: 4 * 1000000000000 },
      ];

      for (const testCase of testCases) {
        const statsOutput = `abc123|0%|${testCase.input}|0%|0B / 0B|0B / 0B|1`;

        mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

        const stats = await manager.getStats('abc123');
        expect(stats!.memoryUsage).toBe(testCase.expectedUsage);
        expect(stats!.memoryLimit).toBe(testCase.expectedLimit);

        vi.clearAllMocks();
      }
    });

    it('should handle stats with podman runtime', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

      const containerId = 'abc123';
      const statsOutput = 'abc123|15.25%|256MiB / 512MiB|50.00%|2kB / 1kB|500kB / 200kB|24';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(15.25);
      expect(stats!.pids).toBe(24);

      // Verify command used podman
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('podman stats'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return null when no runtime available for stats', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

      const stats = await manager.getStats('abc123');

      expect(stats).toBeNull();
    });
  });

  describe('getContainerInfo', () => {
    it('should parse container information correctly', async () => {
      const containerId = 'abc123';
      const inspectOutput = 'abc123456|/apex-task-123|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const info = await manager.getContainerInfo(containerId);

      expect(info).not.toBeNull();
      expect(info!.id).toBe('abc123456');
      expect(info!.name).toBe('apex-task-123');
      expect(info!.image).toBe('node:20-alpine');
      expect(info!.status).toBe('running');
      expect(info!.createdAt).toEqual(new Date('2023-01-01T10:00:00Z'));
      expect(info!.startedAt).toEqual(new Date('2023-01-01T10:00:01Z'));
      expect(info!.finishedAt).toBeUndefined();
      expect(info!.exitCode).toBeUndefined();
    });

    it('should handle container with exit code', async () => {
      const containerId = 'abc123';
      const inspectOutput = 'abc123|apex-task-123|node:20-alpine|exited|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|2023-01-01T10:05:00Z|0';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const info = await manager.getContainerInfo(containerId);

      expect(info).not.toBeNull();
      expect(info!.status).toBe('exited');
      expect(info!.exitCode).toBe(0);
      expect(info!.finishedAt).toEqual(new Date('2023-01-01T10:05:00Z'));
    });

    it('should return null for non-existent container', async () => {
      const containerId = 'nonexistent';

      mockExec.mockImplementationOnce(mockExecCallback('', '', new Error('No such container')));

      const info = await manager.getContainerInfo(containerId);

      expect(info).toBeNull();
    });

    it('should parse different container statuses', async () => {
      const testCases = [
        { statusString: 'created', expected: 'created' },
        { statusString: 'running', expected: 'running' },
        { statusString: 'paused', expected: 'paused' },
        { statusString: 'restarting', expected: 'restarting' },
        { statusString: 'exited', expected: 'exited' },
        { statusString: 'dead', expected: 'dead' },
        { statusString: 'unknown-status', expected: 'exited' }, // fallback
      ];

      for (const testCase of testCases) {
        const inspectOutput = `abc123|test-container|node:20|${testCase.statusString}|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`;

        mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

        const info = await manager.getContainerInfo('abc123');
        expect(info!.status).toBe(testCase.expected);

        // Reset mocks for next iteration
        vi.clearAllMocks();
      }
    });
  });

  describe('listApexContainers', () => {
    it('should list APEX containers successfully', async () => {
      // Mock the ps command
      const psOutput = 'abc123|apex-task-123|node:20-alpine|running|2023-01-01T10:00:00Z\ndef456|apex-task-456|python:3.11|running|2023-01-01T10:05:00Z';
      mockExec.mockImplementationOnce(mockExecCallback(psOutput));

      // Mock inspect commands for each container
      const inspectOutput1 = 'abc123|apex-task-123|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>';
      const inspectOutput2 = 'def456|apex-task-456|python:3.11|running|2023-01-01T10:05:00Z|2023-01-01T10:05:01Z|<no value>|<no value>';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput1));
      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput2));

      const containers = await manager.listApexContainers();

      expect(containers).toHaveLength(2);
      expect(containers[0].name).toBe('apex-task-123');
      expect(containers[1].name).toBe('apex-task-456');
    });

    it('should return empty array when no containers found', async () => {
      mockExec.mockImplementationOnce(mockExecCallback(''));

      const containers = await manager.listApexContainers();

      expect(containers).toHaveLength(0);
    });

    it('should handle command failure gracefully', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('', '', new Error('Command failed')));

      const containers = await manager.listApexContainers();

      expect(containers).toHaveLength(0);
    });
  });

  // ============================================================================
  // Podman Runtime Tests
  // ============================================================================

  describe('podman runtime support', () => {
    beforeEach(() => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');
    });

    it('should create container with podman', async () => {
      const containerId = 'abc123';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'task-123',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman create');
    });

    it('should start container with podman', async () => {
      const containerId = 'abc123';
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      mockExec.mockImplementationOnce(mockExecCallback('abc123|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>'));

      const result = await manager.startContainer(containerId);

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman start');
    });

    it('should inspect container with podman', async () => {
      const containerId = 'abc123';
      const inspectOutput = 'abc123|apex-task-test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>';

      mockExec.mockImplementationOnce(mockExecCallback(inspectOutput));

      const result = await manager.inspect(containerId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('abc123');
      expect(result!.name).toBe('apex-task-test');
    });

    it('should get stats with podman', async () => {
      const containerId = 'abc123';
      const statsOutput = 'abc123|30.25%|128MiB / 256MiB|50.00%|500B / 300B|1MB / 500kB|20';

      mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

      const stats = await manager.getStats(containerId);

      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(30.25);
      expect(stats!.memoryUsage).toBe(128 * 1024 * 1024);
      expect(stats!.pids).toBe(20);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle command timeout', async () => {
      mockExec.mockImplementationOnce(() => {
        throw new Error('Command timed out');
      });

      const result = await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'task-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container creation failed');
    });

    it('should handle malformed inspect output', async () => {
      const containerId = 'abc123';
      const malformedOutput = 'incomplete-data';

      mockExec.mockImplementationOnce(mockExecCallback(malformedOutput));

      const info = await manager.getContainerInfo(containerId);

      expect(info).toBeNull();
    });

    it('should handle empty container config', async () => {
      const containerId = 'abc123';
      const minimalConfig: ContainerConfig = {
        image: 'alpine',
      };

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: minimalConfig,
        taskId: 'task-123',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('alpine');
    });
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('convenience functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTaskContainer', () => {
    it('should create container with task configuration', async () => {
      const config: ContainerConfig = {
        image: 'node:20-alpine',
        autoRemove: true,
      };
      const taskId = 'task-123';

      // Mock getBestRuntime
      const mockRuntimeInstance = containerManager['runtime'];
      vi.spyOn(mockRuntimeInstance, 'getBestRuntime').mockResolvedValue('docker');

      // Mock container creation
      mockExec.mockImplementationOnce(mockExecCallback('abc123'));

      const result = await createTaskContainer(config, taskId, false);

      expect(result.success).toBe(true);
      expect(result.command).toContain('apex-task-123');
    });
  });

  describe('generateTaskContainerName', () => {
    it('should generate name using default manager', () => {
      const taskId = 'task-123';
      const name = generateTaskContainerName(taskId);

      expect(name).toBe('apex-task-123');
    });
  });
});

// ============================================================================
// Integration-like Tests
// ============================================================================

describe('container lifecycle integration', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  it('should handle complete container lifecycle', async () => {
    const config: ContainerConfig = {
      image: 'node:20-alpine',
      autoRemove: false,
    };
    const taskId = 'integration-test';
    const containerId = 'abc123';

    // Mock create
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    // Mock start
    mockExec.mockImplementationOnce(mockExecCallback(containerId));
    mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-${taskId}|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`));

    // Mock stop
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    // Mock remove
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    // Create container
    const createResult = await manager.createContainer({
      config,
      taskId,
      autoStart: false,
    });
    expect(createResult.success).toBe(true);

    // Start container
    const startResult = await manager.startContainer(containerId);
    expect(startResult.success).toBe(true);
    expect(startResult.containerInfo?.status).toBe('running');

    // Stop container
    const stopResult = await manager.stopContainer(containerId);
    expect(stopResult.success).toBe(true);

    // Remove container
    const removeResult = await manager.removeContainer(containerId);
    expect(removeResult.success).toBe(true);
  });

  it('should cleanup failed container creation with auto-start', async () => {
    const config: ContainerConfig = {
      image: 'node:20-alpine',
    };
    const taskId = 'cleanup-test';
    const containerId = 'abc123';

    // Mock successful create
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    // Mock failed start
    mockExec.mockImplementationOnce(mockExecCallback('', 'Container failed to start'));

    // Mock cleanup removal
    mockExec.mockImplementationOnce(mockExecCallback(containerId));

    const createResult = await manager.createContainer({
      config,
      taskId,
      autoStart: true,
    });

    expect(createResult.success).toBe(false);
    expect(createResult.error).toContain('Container start failed');

    // Verify cleanup was attempted
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('docker rm'),
      expect.any(Object),
      expect.any(Function)
    );
  });

  // ============================================================================
  // execCommand Tests
  // ============================================================================

  describe('execCommand', () => {
    const containerId = 'test-container-123';

    it('should execute a simple command successfully', async () => {
      const stdout = 'Hello World\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'echo "Hello World"');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(stdout);
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(result.command).toContain('docker exec');
      expect(result.command).toContain(containerId);
      expect(result.command).toContain('echo');
    });

    it('should execute command with array format', async () => {
      const stdout = 'current directory: /app\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, ['pwd']);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(stdout);
      expect(result.exitCode).toBe(0);
      expect(result.command).toContain('docker exec');
      expect(result.command).toContain('pwd');
    });

    it('should handle command with working directory option', async () => {
      const stdout = '/tmp\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'pwd', {
        workingDir: '/tmp',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--workdir /tmp');
    });

    it('should handle command with user option', async () => {
      const stdout = 'root\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'whoami', {
        user: 'root',
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--user root');
    });

    it('should handle command with environment variables', async () => {
      const stdout = 'production\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'echo $NODE_ENV', {
        environment: {
          NODE_ENV: 'production',
          DEBUG: 'true',
        },
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--env NODE_ENV=production');
      expect(result.command).toContain('--env DEBUG=true');
    });

    it('should handle command with TTY and interactive options', async () => {
      const stdout = 'interactive output\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'bash', {
        tty: true,
        interactive: true,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--tty');
      expect(result.command).toContain('--interactive');
    });

    it('should handle command with privileged option', async () => {
      const stdout = 'privileged command result\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'mount', {
        privileged: true,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--privileged');
    });

    it('should handle command with all options', async () => {
      const stdout = 'comprehensive test\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'ls -la', {
        workingDir: '/app',
        user: 'node',
        timeout: 10000,
        environment: { PATH: '/usr/local/bin:/usr/bin:/bin' },
        tty: true,
        interactive: false,
        privileged: false,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--workdir /app');
      expect(result.command).toContain('--user node');
      expect(result.command).toContain('--env PATH=/usr/local/bin:/usr/bin:/bin');
      expect(result.command).toContain('--tty');
      expect(result.command).not.toContain('--interactive');
      expect(result.command).not.toContain('--privileged');
    });

    it('should handle command execution failure with exit code', async () => {
      const error = new Error('Command failed') as any;
      error.code = 1;
      error.stdout = '';
      error.stderr = 'file not found';

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(error, '', 'file not found'), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(containerId, 'cat /nonexistent');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('file not found');
      expect(result.stdout).toBe('');
    });

    it('should handle command timeout', async () => {
      const error = new Error('Command timed out') as any;
      error.code = 'ETIMEDOUT';

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(error, '', ''), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(containerId, 'sleep 60', {
        timeout: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124);
      expect(result.error).toContain('timed out after 1000ms');
    });

    it('should handle stderr output with successful exit code', async () => {
      const stderr = 'warning: deprecated option\n';
      mockExec.mockImplementationOnce(mockExecCallback('output', stderr));

      const result = await manager.execCommand(containerId, 'some-command --deprecated');

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('output');
      expect(result.stderr).toBe(stderr);
    });

    it('should handle runtime not available', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('none');

      const result = await manager.execCommand(containerId, 'echo test');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBe('No container runtime available');
    });

    it('should use custom timeout value', async () => {
      const stdout = 'slow command result\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'sleep 1', {
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function)
      );
    });

    it('should use default timeout when not specified', async () => {
      const stdout = 'default timeout test\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'echo test');

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should parse command string with quotes correctly', async () => {
      const stdout = 'parsed command\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'echo "hello world" \'single quotes\'');

      expect(result.success).toBe(true);
      expect(result.command).toContain('hello world');
      expect(result.command).toContain('single quotes');
    });

    it('should handle generic command execution errors', async () => {
      const error = new Error('Network error');

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(error, '', ''), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(containerId, 'echo test');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Network error');
    });

    it('should work with podman runtime', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('podman');
      const stdout = 'podman result\n';
      mockExec.mockImplementationOnce(mockExecCallback(stdout));

      const result = await manager.execCommand(containerId, 'echo test');

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman exec');
    });

    it('should handle empty stdout and stderr', async () => {
      mockExec.mockImplementationOnce(mockExecCallback('', ''));

      const result = await manager.execCommand(containerId, 'true');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    // ============================================================================
    // Additional Edge Case Tests for execCommand
    // ============================================================================

    describe('execCommand edge cases', () => {
      it('should handle very long command output', async () => {
        const longOutput = 'a'.repeat(100000) + '\n';
        mockExec.mockImplementationOnce(mockExecCallback(longOutput));

        const result = await manager.execCommand(containerId, 'cat /large-file');

        expect(result.success).toBe(true);
        expect(result.stdout).toBe(longOutput);
        expect(result.stdout.length).toBe(100001);
      });

      it('should handle commands with complex shell escaping', async () => {
        const stdout = 'escaped output\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const result = await manager.execCommand(containerId, 'echo "test $(date)" && echo \'$PWD\' | grep -v "null"');

        expect(result.success).toBe(true);
        expect(result.command).toContain('echo');
        expect(result.command).toContain('test $(date)');
        expect(result.command).toContain('$PWD');
      });

      it('should handle environment variables with special characters', async () => {
        const stdout = 'special chars test\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const result = await manager.execCommand(containerId, 'printenv', {
          environment: {
            'SPECIAL_VAR': 'value with spaces & symbols $@#!',
            'PATH_VAR': '/usr/bin:/usr/local/bin',
            'JSON_VAR': '{"key": "value", "array": [1, 2, 3]}',
          },
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('--env SPECIAL_VAR=');
        expect(result.command).toContain('--env JSON_VAR=');
      });

      it('should handle working directory with spaces and special characters', async () => {
        const stdout = '/app/folder with spaces\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const result = await manager.execCommand(containerId, 'pwd', {
          workingDir: '/app/folder with spaces & symbols',
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain("'/app/folder with spaces & symbols'");
      });

      it('should handle container not found error', async () => {
        const error = new Error('No such container: nonexistent-container') as any;
        error.code = 125; // Docker's exit code for container not found

        mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
          setTimeout(() => callback!(error, '', 'No such container: nonexistent-container'), 0);
          return {} as any;
        }));

        const result = await manager.execCommand('nonexistent-container', 'echo test');

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(125);
        expect(result.stderr).toContain('No such container');
      });

      it('should handle invalid timeout values gracefully', async () => {
        const stdout = 'output\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        // Test with negative timeout (should use default)
        const result = await manager.execCommand(containerId, 'echo test', {
          timeout: -1000,
        });

        expect(result.success).toBe(true);
        // Should still work, as the implementation should handle invalid timeouts
        expect(mockExec).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ timeout: -1000 }),
          expect.any(Function)
        );
      });

      it('should handle command with multi-line output', async () => {
        const multiLineOutput = 'line 1\nline 2\nline 3\nline 4\n';
        mockExec.mockImplementationOnce(mockExecCallback(multiLineOutput));

        const result = await manager.execCommand(containerId, 'cat /multi-line-file');

        expect(result.success).toBe(true);
        expect(result.stdout).toBe(multiLineOutput);
        expect(result.stdout.split('\n')).toHaveLength(5); // 4 lines + empty string after last \n
      });

      it('should handle binary output in stdout', async () => {
        // Simulate binary output with special characters
        const binaryOutput = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]).toString();
        mockExec.mockImplementationOnce(mockExecCallback(binaryOutput));

        const result = await manager.execCommand(containerId, 'cat /binary-file');

        expect(result.success).toBe(true);
        expect(result.stdout).toBe(binaryOutput);
      });

      it('should handle command execution with stderr containing warnings but exit code 0', async () => {
        const stdout = 'command completed successfully\n';
        const stderr = 'WARNING: deprecated feature used\nWARNING: consider upgrading\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout, stderr));

        const result = await manager.execCommand(containerId, 'legacy-command --deprecated-flag');

        expect(result.success).toBe(true);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe(stdout);
        expect(result.stderr).toBe(stderr);
      });

      it('should handle command that produces no output but succeeds', async () => {
        mockExec.mockImplementationOnce(mockExecCallback('', ''));

        const result = await manager.execCommand(containerId, 'touch /tmp/test-file');

        expect(result.success).toBe(true);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('');
      });

      it('should handle extremely long command strings', async () => {
        const longCommandArg = 'x'.repeat(1000);
        const stdout = 'long command executed\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const result = await manager.execCommand(containerId, `echo "${longCommandArg}"`);

        expect(result.success).toBe(true);
        expect(result.command).toContain(longCommandArg);
      });

      it('should properly escape shell arguments to prevent injection', async () => {
        const maliciousInput = 'test; rm -rf /; echo "hacked"';
        const stdout = 'safe output\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const result = await manager.execCommand(containerId, ['echo', maliciousInput]);

        expect(result.success).toBe(true);
        // Verify that the malicious input is properly escaped
        expect(result.command).toContain("'test; rm -rf /; echo \"hacked\"'");
      });

      it('should handle user with colon separator format', async () => {
        const stdout = 'user test output\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const result = await manager.execCommand(containerId, 'whoami', {
          user: '1000:1000',
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('--user 1000:1000');
      });

      it('should handle commands with stdout and stderr both containing data', async () => {
        const stdout = 'normal output\nline 2\n';
        const stderr = 'error message\nwarning message\n';

        // Mock exec with specific exit code 2
        const error = new Error('Command failed') as any;
        error.code = 2;
        error.stdout = stdout;
        error.stderr = stderr;

        mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
          setTimeout(() => callback!(error, stdout, stderr), 0);
          return {} as any;
        }));

        const result = await manager.execCommand(containerId, 'mixed-output-command');

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(2);
        expect(result.stdout).toBe(stdout);
        expect(result.stderr).toBe(stderr);
      });

      it('should handle command with extremely short timeout', async () => {
        const error = new Error('Command timed out') as any;
        error.code = 'ETIMEDOUT';

        mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
          setTimeout(() => callback!(error, '', ''), 0);
          return {} as any;
        }));

        const result = await manager.execCommand(containerId, 'sleep 1', {
          timeout: 1, // 1ms timeout
        });

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(124);
        expect(result.error).toContain('timed out after 1ms');
      });

      it('should handle command parsing with escaped quotes and spaces', async () => {
        const stdout = 'parsed complex command\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const complexCommand = 'echo "quoted \\"nested\\" quotes" \'single quotes\' normal\\ escaped\\ spaces';
        const result = await manager.execCommand(containerId, complexCommand);

        expect(result.success).toBe(true);
        expect(result.command).toContain('echo');
        expect(result.command).toContain('quoted');
        expect(result.command).toContain('nested');
      });

      it('should handle environment variable with empty value', async () => {
        const stdout = 'env test\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const result = await manager.execCommand(containerId, 'printenv', {
          environment: {
            EMPTY_VAR: '',
            NORMAL_VAR: 'value',
          },
        });

        expect(result.success).toBe(true);
        expect(result.command).toContain('--env EMPTY_VAR=');
        expect(result.command).toContain('--env NORMAL_VAR=value');
      });

      it('should handle runtime-specific command execution (docker vs podman)', async () => {
        // Test that different runtimes produce appropriate commands
        const stdout = 'runtime test\n';

        // Test with Docker
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('docker');
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        let result = await manager.execCommand(containerId, 'echo docker-test');
        expect(result.success).toBe(true);
        expect(result.command).toContain('docker exec');

        // Test with Podman
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('podman');
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        result = await manager.execCommand(containerId, 'echo podman-test');
        expect(result.success).toBe(true);
        expect(result.command).toContain('podman exec');
      });

      it('should handle concurrent execCommand calls', async () => {
        const stdout1 = 'result 1\n';
        const stdout2 = 'result 2\n';
        const stdout3 = 'result 3\n';

        // Set up multiple mock exec calls
        mockExec
          .mockImplementationOnce(mockExecCallback(stdout1))
          .mockImplementationOnce(mockExecCallback(stdout2))
          .mockImplementationOnce(mockExecCallback(stdout3));

        // Execute multiple commands concurrently
        const promises = [
          manager.execCommand(containerId, 'echo "test 1"'),
          manager.execCommand(containerId, 'echo "test 2"'),
          manager.execCommand(containerId, 'echo "test 3"'),
        ];

        const results = await Promise.all(promises);

        results.forEach(result => {
          expect(result.success).toBe(true);
          expect(result.exitCode).toBe(0);
        });

        expect(results[0].stdout).toBe(stdout1);
        expect(results[1].stdout).toBe(stdout2);
        expect(results[2].stdout).toBe(stdout3);
      });

      it('should handle command execution when container is not running', async () => {
        const error = new Error('Container is not running') as any;
        error.code = 125;
        error.stderr = 'Error: Container abc123 is not running';

        mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
          setTimeout(() => callback!(error, '', 'Error: Container abc123 is not running'), 0);
          return {} as any;
        }));

        const result = await manager.execCommand(containerId, 'echo test');

        expect(result.success).toBe(false);
        expect(result.exitCode).toBe(125);
        expect(result.stderr).toContain('Container abc123 is not running');
      });

      it('should preserve command options across different scenarios', async () => {
        const stdout = 'options preserved\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const options: ExecCommandOptions = {
          workingDir: '/custom/path',
          user: 'testuser',
          timeout: 15000,
          environment: { TEST: 'value' },
          tty: false,
          interactive: false,
          privileged: true,
        };

        const result = await manager.execCommand(containerId, 'test-command', options);

        expect(result.success).toBe(true);
        expect(result.command).toContain('--workdir /custom/path');
        expect(result.command).toContain('--user testuser');
        expect(result.command).toContain('--env TEST=value');
        expect(result.command).toContain('--privileged');
        expect(result.command).not.toContain('--tty');
        expect(result.command).not.toContain('--interactive');
      });

      it('should handle invalid container ID characters', async () => {
        const invalidContainerId = 'container@with#special$chars';
        const stdout = 'test output\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const result = await manager.execCommand(invalidContainerId, 'echo test');

        expect(result.success).toBe(true);
        expect(result.command).toContain(invalidContainerId);
      });

      it('should handle maximum timeout value', async () => {
        const stdout = 'max timeout test\n';
        mockExec.mockImplementationOnce(mockExecCallback(stdout));

        const result = await manager.execCommand(containerId, 'echo test', {
          timeout: Number.MAX_SAFE_INTEGER,
        });

        expect(result.success).toBe(true);
        expect(mockExec).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ timeout: Number.MAX_SAFE_INTEGER }),
          expect.any(Function)
        );
      });
    });
  });

  // Additional comprehensive test coverage for 90%+ requirement
  describe('Resource Limits and Stats Parsing', () => {
    describe('buildResourceLimitsArgs', () => {
      it('should build complete resource limits arguments', async () => {
        const config: ContainerConfig = {
          image: 'test-image',
          resourceLimits: {
            memory: '1g',
            memoryReservation: '512m',
            memorySwap: '2g',
            cpu: 2.5,
            cpuShares: 1024,
            pidsLimit: 100
          }
        };

        mockExec.mockImplementationOnce(mockExecCallback('abc123'));

        const result = await manager.createContainer({
          config,
          taskId: 'test-task'
        });

        expect(result.success).toBe(true);
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('--memory 1g'),
          expect.any(Object),
          expect.any(Function)
        );
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('--memory-reservation 512m'),
          expect.any(Object),
          expect.any(Function)
        );
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('--memory-swap 2g'),
          expect.any(Object),
          expect.any(Function)
        );
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('--cpus 2.5'),
          expect.any(Object),
          expect.any(Function)
        );
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('--cpu-shares 1024'),
          expect.any(Object),
          expect.any(Function)
        );
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('--pids-limit 100'),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should handle partial resource limits', async () => {
        const config: ContainerConfig = {
          image: 'test-image',
          resourceLimits: {
            memory: '512m',
            cpu: 1.0
          }
        };

        mockExec.mockImplementationOnce(mockExecCallback('abc123'));

        await manager.createContainer({
          config,
          taskId: 'test-task'
        });

        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('--memory 512m'),
          expect.any(Object),
          expect.any(Function)
        );
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('--cpus 1'),
          expect.any(Object),
          expect.any(Function)
        );
        // Should not contain other limits
        expect(mockExec).not.toHaveBeenCalledWith(
          expect.stringContaining('--memory-swap'),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should handle no resource limits', async () => {
        const config: ContainerConfig = {
          image: 'test-image'
        };

        mockExec.mockImplementationOnce(mockExecCallback('abc123'));

        await manager.createContainer({
          config,
          taskId: 'test-task'
        });

        expect(mockExec).not.toHaveBeenCalledWith(
          expect.stringContaining('--memory'),
          expect.any(Object),
          expect.any(Function)
        );
        expect(mockExec).not.toHaveBeenCalledWith(
          expect.stringContaining('--cpus'),
          expect.any(Object),
          expect.any(Function)
        );
      });
    });

    describe('Stats Parsing', () => {
      it('should parse comprehensive container stats', async () => {
        const statsOutput = 'test-container|85.67%|1.5GiB / 2GiB|75.00%|1.2MB / 500kB|45MB / 12MB|42';
        mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

        const stats = await manager.getStats('test-container');

        expect(stats).toEqual({
          cpuPercent: 85.67,
          memoryUsage: 1610612736, // 1.5GiB in bytes
          memoryLimit: 2147483648, // 2GiB in bytes
          memoryPercent: 75.00,
          networkRxBytes: 1200000, // 1.2MB in bytes
          networkTxBytes: 512000, // 500kB in bytes
          blockRxBytes: 47185920, // 45MB in bytes
          blockTxBytes: 12582912, // 12MB in bytes
          pids: 42
        });
      });

      it('should handle various memory unit formats', async () => {
        const testCases = [
          { input: '1.5GiB / 2GiB', expectedUsage: 1610612736, expectedLimit: 2147483648 },
          { input: '512MiB / 1024MiB', expectedUsage: 536870912, expectedLimit: 1073741824 },
          { input: '100MB / 200MB', expectedUsage: 100000000, expectedLimit: 200000000 },
          { input: '1024KB / 2048KB', expectedUsage: 1048576, expectedLimit: 2097152 },
          { input: '2048B / 4096B', expectedUsage: 2048, expectedLimit: 4096 }
        ];

        for (const testCase of testCases) {
          const statsOutput = `test-container|50%|${testCase.input}|50%|0B / 0B|0B / 0B|1`;
          mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

          const stats = await manager.getStats('test-container');
          expect(stats?.memoryUsage).toBe(testCase.expectedUsage);
          expect(stats?.memoryLimit).toBe(testCase.expectedLimit);
        }
      });

      it('should handle extreme CPU percentages', async () => {
        const testCases = [
          { input: '0.01%', expected: 0.01 },
          { input: '99.99%', expected: 99.99 },
          { input: '100.00%', expected: 100.00 },
          { input: '250.50%', expected: 250.50 } // Multi-core scenarios
        ];

        for (const testCase of testCases) {
          const statsOutput = `test-container|${testCase.input}|1GB / 2GB|50%|0B / 0B|0B / 0B|1`;
          mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

          const stats = await manager.getStats('test-container');
          expect(stats?.cpuPercent).toBe(testCase.expected);
        }
      });

      it('should handle malformed stats gracefully', async () => {
        const malformedOutputs = [
          'incomplete|line',
          'too|many|fields|here|extra|data|fields|overflow|data',
          'invalid|cpu|invalid/memory|invalid%|invalid/net|invalid/block|invalid',
          ''
        ];

        for (const output of malformedOutputs) {
          mockExec.mockImplementationOnce(mockExecCallback(output));
          const stats = await manager.getStats('test-container');
          // Should return null for malformed data
          expect(stats).toBeNull();
        }
      });

      it('should handle very high PID counts', async () => {
        const statsOutput = 'test-container|50%|1GB / 2GB|50%|0B / 0B|0B / 0B|65536';
        mockExec.mockImplementationOnce(mockExecCallback(statsOutput));

        const stats = await manager.getStats('test-container');
        expect(stats?.pids).toBe(65536);
      });
    });
  });

  describe('Container Events Monitoring', () => {
    const mockSpawn = vi.fn();
    let mockProcess: any;

    beforeEach(() => {
      // Import and mock spawn
      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        killed: false
      };
      mockSpawn.mockReturnValue(mockProcess);
    });

    afterEach(() => {
      mockSpawn.mockReset();
    });

    describe('startEventsMonitoring', () => {
      it('should start Docker events monitoring with default options', async () => {
        await manager.startEventsMonitoring();

        expect(mockSpawn).toHaveBeenCalledWith('docker', [
          'events',
          '--format',
          '{{json .}}',
          '--filter',
          'event=die',
          '--filter',
          'event=start',
          '--filter',
          'event=stop',
          '--filter',
          'event=create',
          '--filter',
          'event=destroy'
        ]);
      });

      it('should start monitoring with custom options', async () => {
        const options = {
          namePrefix: 'custom-apex',
          eventTypes: ['die', 'start'],
          labelFilters: { 'com.apex.service': 'worker' }
        };

        await manager.startEventsMonitoring(options);

        expect(mockSpawn).toHaveBeenCalledWith('docker', [
          'events',
          '--format',
          '{{json .}}',
          '--filter',
          'event=die',
          '--filter',
          'event=start',
          '--filter',
          'label=com.apex.service=worker'
        ]);
      });

      it('should handle runtime unavailable', async () => {
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

        await expect(manager.startEventsMonitoring())
          .rejects
          .toThrow('No container runtime available for events monitoring');
      });

      it('should not start if already monitoring', async () => {
        await manager.startEventsMonitoring();
        const firstCallCount = mockSpawn.mock.calls.length;

        await manager.startEventsMonitoring();

        // Should not spawn again
        expect(mockSpawn).toHaveBeenCalledTimes(firstCallCount);
      });

      it('should handle process spawn failure', async () => {
        mockProcess.killed = true;

        await expect(manager.startEventsMonitoring())
          .rejects
          .toThrow('Failed to start Docker events monitoring process');
      });
    });

    describe('stopEventsMonitoring', () => {
      beforeEach(async () => {
        await manager.startEventsMonitoring();
      });

      it('should stop monitoring gracefully', async () => {
        await manager.stopEventsMonitoring();

        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
        expect(manager.isEventsMonitoringActive()).toBe(false);
      });

      it('should handle timeout when stopping', async () => {
        // Mock process that doesn't exit on SIGTERM
        mockProcess.kill.mockImplementation(() => {
          // Don't call exit callback
        });

        const stopPromise = manager.stopEventsMonitoring();

        // Should timeout and force kill
        await expect(stopPromise).resolves.toBeUndefined();
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      });

      it('should not fail if already stopped', async () => {
        await manager.stopEventsMonitoring();

        // Should not throw
        await expect(manager.stopEventsMonitoring()).resolves.toBeUndefined();
      });
    });

    describe('Docker event processing', () => {
      beforeEach(async () => {
        await manager.startEventsMonitoring();
      });

      it('should emit container:died event when container dies', async () => {
        const diedEventSpy = vi.fn();
        manager.on('container:died', diedEventSpy);

        // Mock container info lookup
        vi.spyOn(manager, 'getContainerInfo').mockResolvedValue({
          id: 'abc123',
          name: 'apex-test-task-123',
          status: ContainerStatus.Exited,
          image: 'test-image',
          command: ['echo', 'test'],
          created: new Date(),
          started: new Date(),
          finished: new Date(),
          exitCode: 1,
          ports: [],
          mounts: [],
          labels: {}
        });

        // Simulate Docker event
        const eventData = JSON.stringify({
          status: 'die',
          id: 'abc123',
          from: 'test-image',
          Type: 'container',
          Action: 'die',
          Actor: {
            ID: 'abc123',
            Attributes: {
              name: 'apex-test-task-123',
              exitCode: '1'
            }
          },
          time: Math.floor(Date.now() / 1000)
        });

        // Trigger data event
        const dataCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1];
        dataCallback(Buffer.from(eventData + '\n'));

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
          containerId: 'abc123',
          exitCode: 1,
          taskId: 'test-task-123'
        }));
      });

      it('should handle OOM killed containers', async () => {
        const diedEventSpy = vi.fn();
        manager.on('container:died', diedEventSpy);

        // Mock container info with OOM kill
        vi.spyOn(manager, 'getContainerInfo').mockResolvedValue({
          id: 'abc123',
          name: 'apex-test-task-oom',
          status: ContainerStatus.Exited,
          image: 'test-image',
          command: ['stress', '--vm', '1'],
          created: new Date(),
          started: new Date(),
          finished: new Date(),
          exitCode: 137,
          oomKilled: true,
          ports: [],
          mounts: [],
          labels: {}
        });

        const eventData = JSON.stringify({
          status: 'die',
          id: 'abc123',
          Actor: {
            Attributes: {
              name: 'apex-test-task-oom',
              exitCode: '137'
            }
          },
          time: Math.floor(Date.now() / 1000)
        });

        const dataCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1];
        dataCallback(Buffer.from(eventData + '\n'));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
          containerId: 'abc123',
          oomKilled: true,
          exitCode: 137
        }));
      });

      it('should handle malformed JSON events gracefully', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();

        // Send malformed JSON
        const dataCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1];
        dataCallback(Buffer.from('invalid json\n'));

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to parse Docker event:',
          expect.any(Error)
        );

        consoleWarnSpy.mockRestore();
      });

      it('should filter events by name prefix', async () => {
        await manager.stopEventsMonitoring();

        await manager.startEventsMonitoring({
          namePrefix: 'apex'
        });

        const diedEventSpy = vi.fn();
        manager.on('container:died', diedEventSpy);

        // Events for non-APEX containers should be filtered out
        const nonApexEvent = JSON.stringify({
          status: 'die',
          id: 'other123',
          Actor: {
            Attributes: {
              name: 'redis-cache',
              exitCode: '0'
            }
          },
          time: Math.floor(Date.now() / 1000)
        });

        // APEX container event should be processed
        const apexEvent = JSON.stringify({
          status: 'die',
          id: 'apex123',
          Actor: {
            Attributes: {
              name: 'apex-worker-task',
              exitCode: '1'
            }
          },
          time: Math.floor(Date.now() / 1000)
        });

        vi.spyOn(manager, 'getContainerInfo').mockResolvedValue(null);

        const dataCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1];
        dataCallback(Buffer.from(nonApexEvent + '\n' + apexEvent + '\n'));

        await new Promise(resolve => setTimeout(resolve, 50));

        // Should only have been called once for the APEX container
        expect(diedEventSpy).toHaveBeenCalledTimes(1);
        expect(diedEventSpy).toHaveBeenCalledWith(expect.objectContaining({
          containerId: 'apex123'
        }));
      });
    });

    describe('isEventsMonitoringActive', () => {
      it('should return true when monitoring is active', async () => {
        await manager.startEventsMonitoring();
        expect(manager.isEventsMonitoringActive()).toBe(true);
      });

      it('should return false when not monitoring', () => {
        expect(manager.isEventsMonitoringActive()).toBe(false);
      });

      it('should return false after stopping monitoring', async () => {
        await manager.startEventsMonitoring();
        await manager.stopEventsMonitoring();
        expect(manager.isEventsMonitoringActive()).toBe(false);
      });

      it('should return false when process is killed', async () => {
        await manager.startEventsMonitoring();
        mockProcess.killed = true;
        expect(manager.isEventsMonitoringActive()).toBe(false);
      });
    });
  });

  describe('Health Monitoring Integration', () => {
    describe('Container Health Status Detection', () => {
      it('should detect healthy running containers', async () => {
        const healthyContainerInfo = {
          id: 'healthy123',
          name: 'apex-healthy-task',
          status: ContainerStatus.Running,
          image: 'test-image',
          command: ['sleep', '3600'],
          created: new Date(Date.now() - 300000), // 5 minutes ago
          started: new Date(Date.now() - 300000),
          finished: undefined,
          exitCode: undefined,
          ports: [],
          mounts: [],
          labels: {}
        };

        mockExec.mockImplementationOnce(mockExecCallback(JSON.stringify([healthyContainerInfo])));

        const info = await manager.getContainerInfo('healthy123');

        expect(info).toEqual(expect.objectContaining({
          status: ContainerStatus.Running,
          exitCode: undefined
        }));
      });

      it('should detect unhealthy exited containers with non-zero exit codes', async () => {
        const unhealthyContainerInfo = {
          id: 'unhealthy123',
          name: 'apex-failed-task',
          status: ContainerStatus.Exited,
          image: 'test-image',
          command: ['node', 'app.js'],
          created: new Date(Date.now() - 60000),
          started: new Date(Date.now() - 60000),
          finished: new Date(Date.now() - 30000),
          exitCode: 1,
          ports: [],
          mounts: [],
          labels: {}
        };

        mockExec.mockImplementationOnce(mockExecCallback(JSON.stringify([unhealthyContainerInfo])));

        const info = await manager.getContainerInfo('unhealthy123');

        expect(info).toEqual(expect.objectContaining({
          status: ContainerStatus.Exited,
          exitCode: 1
        }));
      });

      it('should detect OOM killed containers', async () => {
        const oomContainerInfo = {
          id: 'oom123',
          name: 'apex-memory-task',
          status: ContainerStatus.Exited,
          image: 'test-image',
          command: ['stress', '--vm', '1', '--vm-bytes', '2G'],
          created: new Date(Date.now() - 120000),
          started: new Date(Date.now() - 120000),
          finished: new Date(Date.now() - 60000),
          exitCode: 137,
          oomKilled: true,
          ports: [],
          mounts: [],
          labels: {}
        };

        mockExec.mockImplementationOnce(mockExecCallback(JSON.stringify([oomContainerInfo])));

        const info = await manager.getContainerInfo('oom123');

        expect(info).toEqual(expect.objectContaining({
          status: ContainerStatus.Exited,
          exitCode: 137,
          oomKilled: true
        }));
      });
    });

    describe('Resource Usage Monitoring', () => {
      it('should monitor high CPU usage', async () => {
        const highCpuStats = 'high-cpu-container|95.45%|512MB / 1GB|50%|100KB / 50KB|10MB / 5MB|25';
        mockExec.mockImplementationOnce(mockExecCallback(highCpuStats));

        const stats = await manager.getStats('high-cpu-container');

        expect(stats).toEqual(expect.objectContaining({
          cpuPercent: 95.45
        }));

        // CPU usage above 90% should be flagged for health monitoring
        expect(stats!.cpuPercent).toBeGreaterThan(90);
      });

      it('should monitor high memory usage', async () => {
        const highMemoryStats = 'high-mem-container|25%|950MB / 1GB|95%|100KB / 50KB|10MB / 5MB|30';
        mockExec.mockImplementationOnce(mockExecCallback(highMemoryStats));

        const stats = await manager.getStats('high-mem-container');

        expect(stats).toEqual(expect.objectContaining({
          memoryPercent: 95
        }));

        // Memory usage above 90% should be flagged for health monitoring
        expect(stats!.memoryPercent).toBeGreaterThan(90);
      });

      it('should monitor high PID usage', async () => {
        const highPidStats = 'high-pid-container|25%|512MB / 1GB|50%|100KB / 50KB|10MB / 5MB|4095';
        mockExec.mockImplementationOnce(mockExecCallback(highPidStats));

        const stats = await manager.getStats('high-pid-container');

        expect(stats).toEqual(expect.objectContaining({
          pids: 4095
        }));

        // High PID count (near default limit of 4096) should be flagged
        expect(stats!.pids).toBeGreaterThan(4000);
      });

      it('should handle containers with resource limits enforcement', async () => {
        // Container hitting memory limit should show specific behavior
        const limitedStats = 'limited-container|15%|1GB / 1GB|100%|100KB / 50KB|10MB / 5MB|50';
        mockExec.mockImplementationOnce(mockExecCallback(limitedStats));

        const stats = await manager.getStats('limited-container');

        expect(stats).toEqual(expect.objectContaining({
          memoryUsage: 1073741824, // 1GB
          memoryLimit: 1073741824, // 1GB
          memoryPercent: 100
        }));

        // Usage equals limit indicates potential constraint
        expect(stats!.memoryUsage).toBe(stats!.memoryLimit);
      });
    });

    describe('Container Lifecycle Health Events', () => {
      it('should emit comprehensive lifecycle events', async () => {
        const lifecycleEvents: Array<{operation: string, data: any}> = [];

        manager.on('container:created', (event) => {
          lifecycleEvents.push({ operation: 'created', data: event });
        });

        manager.on('container:started', (event) => {
          lifecycleEvents.push({ operation: 'started', data: event });
        });

        manager.on('container:stopped', (event) => {
          lifecycleEvents.push({ operation: 'stopped', data: event });
        });

        manager.on('container:removed', (event) => {
          lifecycleEvents.push({ operation: 'removed', data: event });
        });

        // Simulate full container lifecycle
        mockExec.mockImplementationOnce(mockExecCallback('container123')); // create
        mockExec.mockImplementationOnce(mockExecCallback('')); // start
        mockExec.mockImplementationOnce(mockExecCallback('')); // stop
        mockExec.mockImplementationOnce(mockExecCallback('')); // remove

        const config: ContainerConfig = { image: 'test-image' };

        // Create container
        const createResult = await manager.createContainer({
          config,
          taskId: 'lifecycle-test',
          autoStart: true
        });

        // Stop container
        await manager.stopContainer('container123');

        // Remove container
        await manager.removeContainer('container123');

        expect(lifecycleEvents).toHaveLength(4);
        expect(lifecycleEvents[0].operation).toBe('created');
        expect(lifecycleEvents[1].operation).toBe('started');
        expect(lifecycleEvents[2].operation).toBe('stopped');
        expect(lifecycleEvents[3].operation).toBe('removed');

        // All events should have container ID and task ID
        lifecycleEvents.forEach(event => {
          expect(event.data.containerId).toBe('container123');
          expect(event.data.taskId).toBe('lifecycle-test');
        });
      });
    });

    describe('streamLogs', () => {
      it('should create log stream successfully', async () => {
        const logStream = await manager.streamLogs('container123');

        expect(logStream).toBeInstanceOf(ContainerLogStream);
        expect(logStream.isActive).toBe(true);
      });

      it('should handle runtime not available for log streaming', async () => {
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

        await expect(manager.streamLogs('container123')).rejects.toThrow(
          'No container runtime available'
        );
      });

      it('should create log stream with options', async () => {
        const options = {
          follow: true,
          timestamps: true,
          since: '1h',
          tail: 100
        };

        const logStream = await manager.streamLogs('container123', options);

        expect(logStream).toBeInstanceOf(ContainerLogStream);
        expect(logStream.isActive).toBe(true);
      });

      it('should create log stream with podman runtime', async () => {
        vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

        const logStream = await manager.streamLogs('container123');

        expect(logStream).toBeInstanceOf(ContainerLogStream);
        expect(logStream.isActive).toBe(true);
      });
    });

    describe('buildImageIfNeeded', () => {
      it('should return original image when no dockerfile specified', async () => {
        const config: ContainerConfig = {
          image: 'node:18-alpine'
        };

        // Use reflection to access private method
        const buildImageIfNeeded = (manager as any).buildImageIfNeeded.bind(manager);
        const result = await buildImageIfNeeded(config);

        expect(result).toBe('node:18-alpine');
      });

      it('should fallback to original image when dockerfile not found', async () => {
        const config: ContainerConfig = {
          image: 'node:18-alpine',
          dockerfile: './non-existent.Dockerfile'
        };

        // Use reflection to access private method
        const buildImageIfNeeded = (manager as any).buildImageIfNeeded.bind(manager);
        const result = await buildImageIfNeeded(config);

        expect(result).toBe('node:18-alpine');
      });

      it('should handle build context correctly', async () => {
        const config: ContainerConfig = {
          image: 'node:18-alpine',
          dockerfile: 'Dockerfile',
          buildContext: './build-context'
        };

        // Use reflection to access private method
        const buildImageIfNeeded = (manager as any).buildImageIfNeeded.bind(manager);
        const result = await buildImageIfNeeded(config, '/project/root');

        expect(result).toBe('node:18-alpine'); // Falls back since no real dockerfile exists
      });
    });

    describe('container command building', () => {
      it('should build create command with all options', async () => {
        const config: ContainerConfig = {
          image: 'test-image',
          volumes: { '/host/path': '/container/path' },
          environment: { NODE_ENV: 'production', DEBUG: 'true' },
          resourceLimits: {
            memory: '512m',
            cpu: 0.5,
            pidsLimit: 100
          },
          networkMode: 'bridge',
          workingDir: '/app',
          user: 'node',
          labels: { 'app': 'test' },
          entrypoint: ['/bin/sh', '-c'],
          autoRemove: true,
          privileged: true,
          securityOpts: ['no-new-privileges:true'],
          capAdd: ['SYS_ADMIN'],
          capDrop: ['MKNOD'],
          command: ['npm', 'start']
        };

        // Mock successful container creation
        mockExec.mockImplementationOnce(mockExecCallback('container-123'));

        const result = await manager.createContainer({
          config,
          taskId: 'test-task',
          nameOverride: 'test-container'
        });

        expect(result.success).toBe(true);
        expect(result.containerId).toBe('container-123');
        expect(result.command).toContain('docker create');
        expect(result.command).toContain('--name test-container');
        expect(result.command).toContain('-v \'/host/path:/container/path\'');
        expect(result.command).toContain('-e \'NODE_ENV=production\'');
        expect(result.command).toContain('-e \'DEBUG=true\'');
        expect(result.command).toContain('--memory 512m');
        expect(result.command).toContain('--cpus \'0.5\'');
        expect(result.command).toContain('--pids-limit 100');
        expect(result.command).toContain('--network bridge');
        expect(result.command).toContain('-w /app');
        expect(result.command).toContain('--user node');
        expect(result.command).toContain('--label \'app=test\'');
        expect(result.command).toContain('--label \'apex.managed=true\'');
        expect(result.command).toContain('--entrypoint \'/bin/sh -c\'');
        expect(result.command).toContain('--rm');
        expect(result.command).toContain('--privileged');
        expect(result.command).toContain('--security-opt no-new-privileges:true');
        expect(result.command).toContain('--cap-add SYS_ADMIN');
        expect(result.command).toContain('--cap-drop MKNOD');
        expect(result.command).toContain('test-image');
        expect(result.command).toContain('npm');
        expect(result.command).toContain('start');
      });

      it('should handle shell argument escaping correctly', () => {
        // Test the private escapeShellArg method
        const escapeShellArg = (manager as any).escapeShellArg.bind(manager);

        expect(escapeShellArg('simple')).toBe('simple');
        expect(escapeShellArg('with spaces')).toBe('\'with spaces\'');
        expect(escapeShellArg("with'quotes")).toBe("'with'\"'\"'quotes'");
        expect(escapeShellArg('with$dollar')).toBe("'with$dollar'");
        expect(escapeShellArg('with|pipe')).toBe("'with|pipe'");
        expect(escapeShellArg('with;semicolon')).toBe("'with;semicolon'");
        expect(escapeShellArg('with&ampersand')).toBe("'with&ampersand'");
        expect(escapeShellArg('with<redirect')).toBe("'with<redirect'");
        expect(escapeShellArg('with>redirect')).toBe("'with>redirect'");
        expect(escapeShellArg('with(parens)')).toBe("'with(parens)'");
        expect(escapeShellArg('with{braces}')).toBe("'with{braces}'");
        expect(escapeShellArg('with[brackets]')).toBe("'with[brackets]'");
        expect(escapeShellArg('with*glob')).toBe("'with*glob'");
        expect(escapeShellArg('with?wildcard')).toBe("'with?wildcard'");
        expect(escapeShellArg('with~tilde')).toBe("'with~tilde'");
        expect(escapeShellArg('with`backtick')).toBe("'with`backtick'");
        expect(escapeShellArg('with\\backslash')).toBe("'with\\backslash'");
        expect(escapeShellArg('with"doublequotes')).toBe("'with\"doublequotes'");
      });

      it('should parse command strings with quotes correctly', () => {
        // Test the private parseCommandString method
        const parseCommandString = (manager as any).parseCommandString.bind(manager);

        expect(parseCommandString('simple command')).toEqual(['simple', 'command']);
        expect(parseCommandString('"quoted string"')).toEqual(['quoted string']);
        expect(parseCommandString("'single quoted'")).toEqual(['single quoted']);
        expect(parseCommandString('mixed "double quotes" and \'single quotes\'')).toEqual([
          'mixed', 'double quotes', 'and', 'single quotes'
        ]);
        expect(parseCommandString('escaped\\ space')).toEqual(['escaped space']);
        expect(parseCommandString('escaped\\"quote')).toEqual(['escaped"quote']);
        expect(parseCommandString("escaped\\'quote")).toEqual(["escaped'quote"]);
        expect(parseCommandString('multiple   spaces')).toEqual(['multiple', 'spaces']);
        expect(parseCommandString('  leading and trailing  ')).toEqual(['leading', 'and', 'trailing']);
        expect(parseCommandString('')).toEqual([]);
        expect(parseCommandString('   ')).toEqual([]);
      });
    });

    describe('resource limits parsing', () => {
      it('should build resource limits arguments correctly', () => {
        // Test the private buildResourceLimitsArgs method
        const buildResourceLimitsArgs = (manager as any).buildResourceLimitsArgs.bind(manager);

        const limits = {
          memory: '1g',
          memoryReservation: '512m',
          memorySwap: '2g',
          cpu: 1.5,
          cpuShares: 1024,
          pidsLimit: 4096
        };

        const args = buildResourceLimitsArgs(limits);

        expect(args).toEqual([
          '--memory', '1g',
          '--memory-reservation', '512m',
          '--memory-swap', '2g',
          '--cpus', '1.5',
          '--cpu-shares', '1024',
          '--pids-limit', '4096'
        ]);
      });

      it('should handle partial resource limits', () => {
        const buildResourceLimitsArgs = (manager as any).buildResourceLimitsArgs.bind(manager);

        const limits = {
          memory: '512m',
          cpu: 0.5
        };

        const args = buildResourceLimitsArgs(limits);

        expect(args).toEqual([
          '--memory', '512m',
          '--cpus', '0.5'
        ]);
      });

      it('should handle empty resource limits', () => {
        const buildResourceLimitsArgs = (manager as any).buildResourceLimitsArgs.bind(manager);

        const limits = {};

        const args = buildResourceLimitsArgs(limits);

        expect(args).toEqual([]);
      });
    });

    describe('date parsing', () => {
      it('should parse valid dates correctly', () => {
        // Test the private parseDate method
        const parseDate = (manager as any).parseDate.bind(manager);

        const isoDate = '2023-12-01T12:00:00.000Z';
        const parsed = parseDate(isoDate);
        expect(parsed).toBeInstanceOf(Date);
        expect(parsed!.toISOString()).toBe(isoDate);

        const rfc2822Date = 'Fri, 01 Dec 2023 12:00:00 GMT';
        const parsed2 = parseDate(rfc2822Date);
        expect(parsed2).toBeInstanceOf(Date);
      });

      it('should handle invalid dates gracefully', () => {
        const parseDate = (manager as any).parseDate.bind(manager);

        expect(parseDate('')).toBeUndefined();
        expect(parseDate('<no value>')).toBeUndefined();
        expect(parseDate('invalid-date')).toBeUndefined();
        expect(parseDate('2023-13-45T25:61:61.000Z')).toBeUndefined();
      });
    });

    describe('container status parsing', () => {
      it('should parse various container statuses correctly', () => {
        // Test the private parseContainerStatus method
        const parseContainerStatus = (manager as any).parseContainerStatus.bind(manager);

        expect(parseContainerStatus('created')).toBe('created');
        expect(parseContainerStatus('Created')).toBe('created');
        expect(parseContainerStatus('CREATED')).toBe('created');

        expect(parseContainerStatus('running')).toBe('running');
        expect(parseContainerStatus('Running')).toBe('running');
        expect(parseContainerStatus('up')).toBe('running');
        expect(parseContainerStatus('Up')).toBe('running');

        expect(parseContainerStatus('paused')).toBe('paused');
        expect(parseContainerStatus('Paused')).toBe('paused');

        expect(parseContainerStatus('restarting')).toBe('restarting');
        expect(parseContainerStatus('Restarting')).toBe('restarting');

        expect(parseContainerStatus('removing')).toBe('removing');
        expect(parseContainerStatus('Removing')).toBe('removing');

        expect(parseContainerStatus('exited')).toBe('exited');
        expect(parseContainerStatus('Exited')).toBe('exited');
        expect(parseContainerStatus('stopped')).toBe('exited');
        expect(parseContainerStatus('Stopped')).toBe('exited');

        expect(parseContainerStatus('dead')).toBe('dead');
        expect(parseContainerStatus('Dead')).toBe('dead');

        // Test fallback patterns
        expect(parseContainerStatus('Up 3 minutes')).toBe('running');
        expect(parseContainerStatus('Exited (0) 2 minutes ago')).toBe('exited');
        expect(parseContainerStatus('unknown-status')).toBe('exited');
        expect(parseContainerStatus('')).toBe('exited');
      });
    });

    describe('byte value parsing', () => {
      it('should parse byte values with various units', () => {
        // Test the private parseByteValue method
        const parseByteValue = (manager as any).parseByteValue.bind(manager);

        expect(parseByteValue('100B')).toBe(100);
        expect(parseByteValue('1KB')).toBe(1000);
        expect(parseByteValue('1MB')).toBe(1000000);
        expect(parseByteValue('1GB')).toBe(1000000000);
        expect(parseByteValue('1TB')).toBe(1000000000000);
        expect(parseByteValue('1PB')).toBe(1000000000000000);

        expect(parseByteValue('1.5KB')).toBe(1500);
        expect(parseByteValue('2.5MB')).toBe(2500000);

        expect(parseByteValue('100b')).toBe(100);
        expect(parseByteValue('1kb')).toBe(1000);
        expect(parseByteValue('1mb')).toBe(1000000);

        expect(parseByteValue('invalid')).toBe(0);
        expect(parseByteValue('')).toBe(0);
        expect(parseByteValue('100')).toBe(0);
        expect(parseByteValue('100X')).toBe(0);
      });
    });

    describe('percentage parsing', () => {
      it('should parse percentage values correctly', () => {
        // Test the private parsePercentage method
        const parsePercentage = (manager as any).parsePercentage.bind(manager);

        expect(parsePercentage('25%')).toBe(25);
        expect(parsePercentage('25.5%')).toBe(25.5);
        expect(parsePercentage('100%')).toBe(100);
        expect(parsePercentage('0%')).toBe(0);
        expect(parsePercentage('150%')).toBe(150); // Multi-core systems can exceed 100%

        expect(parsePercentage('25')).toBe(25); // Without % symbol
        expect(parsePercentage('  25%  ')).toBe(25); // With whitespace

        expect(parsePercentage('invalid')).toBe(0);
        expect(parsePercentage('')).toBe(0);
        expect(parsePercentage('%')).toBe(0);
      });
    });

    describe('PIDs parsing', () => {
      it('should parse PID counts correctly', () => {
        // Test the private parsePids method
        const parsePids = (manager as any).parsePids.bind(manager);

        expect(parsePids('42')).toBe(42);
        expect(parsePids('1024')).toBe(1024);
        expect(parsePids('0')).toBe(0);
        expect(parsePids('  100  ')).toBe(100);

        expect(parsePids('invalid')).toBe(0);
        expect(parsePids('')).toBe(0);
        expect(parsePids('42.5')).toBe(42); // parseInt truncates
      });
    });
  });
});

describe('ContainerLogStream', () => {
  let mockSpawn: any;

  beforeEach(() => {
    // Mock child_process spawn
    const { spawn } = require('child_process');
    mockSpawn = vi.fn();
    vi.doMock('child_process', () => ({
      spawn: mockSpawn,
      exec: vi.fn()
    }));

    // Create mock child process
    const mockChildProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn(),
      kill: vi.fn(),
      killed: false
    };

    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log streaming', () => {
    it('should create log stream and start streaming', () => {
      const logStream = new ContainerLogStream('container123', {}, 'docker');

      expect(logStream.isActive).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['logs']), expect.any(Object));
    });

    it('should emit data events for log lines', (done) => {
      const logStream = new ContainerLogStream('container123', { timestamps: true }, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;

      logStream.on('data', (logEntry) => {
        expect(logEntry.message).toBe('test log message');
        expect(logEntry.stream).toBe('stdout');
        expect(logEntry.raw).toBe('2023-12-01T12:00:00.123456789Z test log message');
        done();
      });

      // Simulate log data
      mockProcess.stdout.emit('data', Buffer.from('2023-12-01T12:00:00.123456789Z test log message\n'));
    });

    it('should handle stderr log data', (done) => {
      const logStream = new ContainerLogStream('container123', {}, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;

      logStream.on('data', (logEntry) => {
        expect(logEntry.message).toBe('error message');
        expect(logEntry.stream).toBe('stderr');
        done();
      });

      // Simulate stderr data
      mockProcess.stderr.emit('data', Buffer.from('error message\n'));
    });

    it('should handle process errors', (done) => {
      const logStream = new ContainerLogStream('container123', {}, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;

      logStream.on('error', (error) => {
        expect(error.message).toBe('Process failed');
        done();
      });

      mockProcess.on.mock.calls.find(([event]) => event === 'error')[1](new Error('Process failed'));
    });

    it('should handle process exit', (done) => {
      const logStream = new ContainerLogStream('container123', {}, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;

      logStream.on('exit', (code) => {
        expect(code).toBe(0);
        done();
      });

      mockProcess.on.mock.calls.find(([event]) => event === 'exit')[1](0);
    });

    it('should handle multiple log lines in single chunk', (done) => {
      const logStream = new ContainerLogStream('container123', {}, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;
      const receivedEntries: any[] = [];

      logStream.on('data', (logEntry) => {
        receivedEntries.push(logEntry);
        if (receivedEntries.length === 3) {
          expect(receivedEntries[0].message).toBe('line 1');
          expect(receivedEntries[1].message).toBe('line 2');
          expect(receivedEntries[2].message).toBe('line 3');
          done();
        }
      });

      mockProcess.stdout.emit('data', Buffer.from('line 1\nline 2\nline 3\n'));
    });

    it('should filter streams based on options', (done) => {
      const logStream = new ContainerLogStream('container123', { stdout: true, stderr: false }, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;
      let dataEvents = 0;

      logStream.on('data', () => {
        dataEvents++;
      });

      // Only stdout should emit data events
      mockProcess.stdout.emit('data', Buffer.from('stdout message\n'));
      mockProcess.stderr.emit('data', Buffer.from('stderr message\n'));

      setTimeout(() => {
        expect(dataEvents).toBe(1);
        done();
      }, 10);
    });

    it('should build logs command with options', () => {
      const options = {
        follow: true,
        timestamps: true,
        since: '1h',
        until: '2023-12-01T12:00:00Z',
        tail: 100
      };

      const logStream = new ContainerLogStream('container123', options, 'docker');

      expect(mockSpawn).toHaveBeenCalledWith('docker',
        expect.arrayContaining([
          'logs',
          '--follow',
          '--timestamps',
          '--since', '1h',
          '--until', '2023-12-01T12:00:00.000Z',
          '--tail', '100',
          'container123'
        ]),
        expect.any(Object)
      );
    });

    it('should handle tail all option', () => {
      const logStream = new ContainerLogStream('container123', { tail: 'all' }, 'docker');

      expect(mockSpawn).toHaveBeenCalledWith('docker',
        expect.arrayContaining(['--tail', 'all']),
        expect.any(Object)
      );
    });

    it('should work with podman runtime', () => {
      const logStream = new ContainerLogStream('container123', {}, 'podman');

      expect(mockSpawn).toHaveBeenCalledWith('podman', expect.arrayContaining(['logs']), expect.any(Object));
    });

    it('should end stream properly', () => {
      const logStream = new ContainerLogStream('container123', {}, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;

      logStream.end();

      expect(logStream.isActive).toBe(false);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should parse stream prefixes correctly', (done) => {
      const logStream = new ContainerLogStream('container123', {}, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;

      logStream.on('data', (logEntry) => {
        expect(logEntry.message).toBe('actual message');
        expect(logEntry.stream).toBe('stdout');
        done();
      });

      mockProcess.stdout.emit('data', Buffer.from('stdout: actual message\n'));
    });

    it('should handle timestamp parsing with various formats', (done) => {
      const logStream = new ContainerLogStream('container123', { timestamps: true }, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;

      logStream.on('data', (logEntry) => {
        expect(logEntry.timestamp).toBeInstanceOf(Date);
        expect(logEntry.timestamp!.getTime()).toBe(new Date('2023-12-01T12:00:00.123Z').getTime());
        done();
      });

      mockProcess.stdout.emit('data', Buffer.from('2023-12-01T12:00:00.123000000Z message with timestamp\n'));
    });

    it('should handle async iteration', async () => {
      const logStream = new ContainerLogStream('container123', {}, 'docker');
      const mockProcess = mockSpawn.mock.results[0].value;

      // Simulate some log data then end
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('log line 1\n'));
        mockProcess.stdout.emit('data', Buffer.from('log line 2\n'));
        logStream.end();
      }, 10);

      const logLines: string[] = [];
      for await (const logEntry of logStream) {
        logLines.push(logEntry.message);
        if (logLines.length >= 2) break;
      }

      expect(logLines).toEqual(['log line 1', 'log line 2']);
    });
  });
});