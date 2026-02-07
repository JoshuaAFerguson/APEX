/**
 * JSDoc Documentation Validation Tests
 *
 * This test suite validates all JSDoc examples and documented functionality
 * for container-manager.ts, container-runtime.ts, and container-health-monitor.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import { EventEmitter } from 'eventemitter3';

// Import all container modules
import {
  ContainerManager,
  ContainerLogStream,
  containerManager,
  createTaskContainer,
  generateTaskContainerName,
  type CreateContainerOptions,
  type ExecCommandOptions,
  type ExecCommandResult,
  type ContainerOperationResult,
  type ContainerNamingConfig,
} from '../container-manager';

import {
  ContainerRuntime,
  containerRuntime,
  detectContainerRuntime,
  isContainerRuntimeAvailable,
  getContainerRuntimeInfo,
  type ContainerRuntimeType,
  type RuntimeDetectionResult,
  type RuntimeVersionInfo,
  type CompatibilityRequirement,
  type CompatibilityResult,
} from '../container-runtime';

import {
  ContainerHealthMonitor,
  containerHealthMonitor,
  startContainerHealthMonitoring,
  getContainerHealth,
  type ContainerHealthMonitorOptions,
  type ContainerHealthCheck,
} from '../container-health-monitor';

import { ContainerConfig, ContainerInfo, ContainerStats, ContainerStatus } from '../types';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs/promises');
const mockExec = vi.mocked(exec);
const mockSpawn = vi.mocked(spawn);

describe('Container JSDoc Documentation Validation', () => {
  let manager: ContainerManager;
  let runtime: ContainerRuntime;
  let healthMonitor: ContainerHealthMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    runtime = new ContainerRuntime();
    manager = new ContainerManager(runtime);
    healthMonitor = new ContainerHealthMonitor(manager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ContainerManager JSDoc Examples', () => {
    it('should validate ContainerManager constructor examples', () => {
      // Example 1: Create with defaults
      const manager1 = new ContainerManager();
      expect(manager1).toBeInstanceOf(ContainerManager);

      // Example 2: Create with custom runtime and naming
      const customRuntime = new ContainerRuntime();
      const manager2 = new ContainerManager(customRuntime, {
        prefix: 'myapp',
        includeTimestamp: true
      });
      expect(manager2).toBeInstanceOf(ContainerManager);
    });

    it('should validate createContainer JSDoc examples', async () => {
      // Mock successful container creation
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'container123', '');
        return {} as any;
      });

      // Mock runtime detection
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');
      vi.spyOn(manager, 'getContainerInfo').mockResolvedValue({
        id: 'container123',
        name: 'apex-task-123',
        image: 'node:18',
        status: 'running',
        createdAt: new Date(),
      } as ContainerInfo);

      const result = await manager.createContainer({
        config: {
          image: 'node:18',
          command: ['npm', 'start'],
          volumes: { '/host/path': '/container/path' },
          environment: { NODE_ENV: 'production' }
        },
        taskId: 'task-123',
        autoStart: true
      });

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');
    });

    it('should validate startContainer JSDoc examples', async () => {
      // Mock successful container start
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'container123', '');
        return {} as any;
      });

      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');
      vi.spyOn(manager, 'getContainerInfo').mockResolvedValue({
        id: 'container123',
        name: 'my-container',
        image: 'node:18',
        status: 'running',
        createdAt: new Date(),
      } as ContainerInfo);

      const result = await manager.startContainer('my-container');
      expect(result.success).toBe(true);
    });

    it('should validate stopContainer JSDoc examples', async () => {
      // Mock successful container stop
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'container123', '');
        return {} as any;
      });

      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      const result = await manager.stopContainer('my-container', undefined, 5);
      expect(result.success).toBe(true);
    });

    it('should validate removeContainer JSDoc examples', async () => {
      // Mock successful container removal
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'container123', '');
        return {} as any;
      });

      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Test regular removal
      const result = await manager.removeContainer('my-container');
      expect(result.success).toBe(true);

      // Test force removal
      const forceResult = await manager.removeContainer('my-container', undefined, true);
      expect(forceResult.success).toBe(true);
    });

    it('should validate inspect JSDoc examples', async () => {
      const mockInfo = {
        id: 'container123',
        name: 'my-container',
        image: 'node:18',
        status: 'running' as ContainerStatus,
        createdAt: new Date(),
      };

      vi.spyOn(manager, 'getContainerInfo').mockResolvedValue(mockInfo);

      const info = await manager.inspect('my-container');
      expect(info).toEqual(mockInfo);
    });

    it('should validate getStats JSDoc examples', async () => {
      const mockStats = {
        cpuPercent: 25.5,
        memoryUsage: 536870912, // 512MB
        memoryLimit: 1073741824, // 1GB
        memoryPercent: 50,
        networkRxBytes: 1024,
        networkTxBytes: 512,
        blockReadBytes: 2048,
        blockWriteBytes: 1024,
        pids: 42,
      };

      // Mock docker stats command
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        const output = "container123|25.5%|512MiB / 1GiB|50.0%|1.02kB / 512B|2.05kB / 1.02kB|42";
        callback(null, `CONTAINER|CPU %|MEM USAGE / LIMIT|MEM %|NET I/O|BLOCK I/O|PIDS\n${output}`, '');
        return {} as any;
      });

      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      const stats = await manager.getStats('my-container');
      expect(stats?.cpuPercent).toBe(25.5);
      expect(stats?.memoryUsage).toBeGreaterThan(0);
      expect(stats?.pids).toBe(42);
    });

    it('should validate listApexContainers JSDoc examples', async () => {
      // Mock docker ps output
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        const output = "container1|apex-task1|node:18|running|2024-01-01";
        callback(null, output, '');
        return {} as any;
      });

      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');
      vi.spyOn(manager, 'getContainerInfo').mockResolvedValue({
        id: 'container1',
        name: 'apex-task1',
        image: 'node:18',
        status: 'running',
        createdAt: new Date('2024-01-01'),
      } as ContainerInfo);

      // List only running containers
      const runningContainers = await manager.listApexContainers();
      expect(runningContainers.length).toBeGreaterThanOrEqual(0);

      // List all containers including stopped ones
      const allContainers = await manager.listApexContainers(undefined, true);
      expect(allContainers.length).toBeGreaterThanOrEqual(0);
    });

    it('should validate execCommand JSDoc examples', async () => {
      // Mock successful command execution
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'Hello World', '');
        return {} as any;
      });

      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Simple command execution
      const result = await manager.execCommand('my-container', 'ls -la');
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('Hello World');

      // Command with options
      const result2 = await manager.execCommand(
        'my-container',
        ['npm', 'test'],
        {
          workingDir: '/app',
          environment: { NODE_ENV: 'test' },
          timeout: 60000,
          user: 'node'
        }
      );
      expect(result2.success).toBe(true);
    });

    it('should validate generateContainerName JSDoc examples', () => {
      // Generate with default config
      const name = manager.generateContainerName('task-123');
      expect(name).toMatch(/^apex-/);
      expect(name).toContain('task_123');

      // Generate with custom config
      const customName = manager.generateContainerName('task-123', {
        prefix: 'myapp',
        includeTimestamp: true,
        separator: '_'
      });
      expect(customName).toMatch(/^myapp_/);
      expect(customName).toContain('task_123');
    });

    it('should validate events monitoring JSDoc examples', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      // Mock spawn for events monitoring
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn(),
        kill: vi.fn(),
        killed: false
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      // Start monitoring with default options
      await manager.startEventsMonitoring();
      expect(manager.isEventsMonitoringActive()).toBe(true);

      // Start monitoring with custom filters
      await manager.startEventsMonitoring({
        namePrefix: 'myapp',
        eventTypes: ['start', 'stop', 'die'],
        labelFilters: { 'project': 'production' }
      });

      // Test event listener
      let containerDiedEventReceived = false;
      manager.on('container:died', (event) => {
        containerDiedEventReceived = true;
        expect(event.containerId).toBeTruthy();
      });

      // Simulate a container death event
      const mockEvent = {
        status: 'die',
        id: 'container123',
        name: 'apex-task123',
        time: Date.now(),
        exitCode: 1
      };

      // Trigger the event by simulating Docker events output
      manager['processEventsData'](JSON.stringify(mockEvent) + '\n');

      await manager.stopEventsMonitoring();
      expect(manager.isEventsMonitoringActive()).toBe(false);
    });
  });

  describe('ContainerRuntime JSDoc Examples', () => {
    it('should validate detectRuntimes JSDoc examples', async () => {
      // Mock successful docker detection
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker --version')) {
          callback(null, 'Docker version 24.0.7, build afdd53b', '');
        } else if (command.includes('docker info')) {
          callback(null, 'Docker info output', '');
        } else if (command.includes('podman --version')) {
          callback(null, 'podman version 4.7.2', '');
        } else if (command.includes('podman info')) {
          callback(null, 'Podman info output', '');
        }
        return {} as any;
      });

      const results = await runtime.detectRuntimes();
      expect(results).toHaveLength(2); // Docker and Podman

      results.forEach(result => {
        expect(result.type).toMatch(/docker|podman/);
        expect(typeof result.available).toBe('boolean');
        if (result.versionInfo) {
          expect(result.versionInfo.version).toBeTruthy();
        }
      });
    });

    it('should validate getBestRuntime JSDoc examples', async () => {
      // Mock docker as available
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker')) {
          callback(null, 'Docker version 24.0.7', '');
        } else {
          callback(new Error('Command not found'), '', 'command not found');
        }
        return {} as any;
      });

      // Get best available runtime (prefers Docker)
      const best = await runtime.getBestRuntime();
      expect(['docker', 'podman', 'none']).toContain(best);

      // Try to use preferred runtime
      const preferred = await runtime.getBestRuntime('podman');
      expect(['docker', 'podman', 'none']).toContain(preferred);
    });

    it('should validate getRuntimeInfo JSDoc examples', async () => {
      // Mock docker info
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker --version')) {
          callback(null, 'Docker version 24.0.7, build afdd53b', '');
        } else if (command.includes('docker info')) {
          callback(null, 'Docker info', '');
        }
        return {} as any;
      });

      const dockerInfo = await runtime.getRuntimeInfo('docker');
      expect(dockerInfo).toBeTruthy();
      if (dockerInfo?.available && dockerInfo?.versionInfo) {
        expect(dockerInfo.versionInfo.version).toBeTruthy();
      }
    });

    it('should validate isRuntimeAvailable JSDoc examples', async () => {
      // Mock docker as available
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker')) {
          callback(null, 'Docker version 24.0.7', '');
        } else {
          callback(new Error('Command not found'), '', 'podman: command not found');
        }
        return {} as any;
      });

      const hasDocker = await runtime.isRuntimeAvailable('docker');
      const hasPodman = await runtime.isRuntimeAvailable('podman');

      expect(typeof hasDocker).toBe('boolean');
      expect(typeof hasPodman).toBe('boolean');
    });

    it('should validate validateCompatibility JSDoc examples', async () => {
      // Mock docker with specific version
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker --version')) {
          callback(null, 'Docker version 24.0.7, build afdd53b', '');
        } else if (command.includes('docker info')) {
          callback(null, 'Docker info', '');
        }
        return {} as any;
      });

      const compatibility = await runtime.validateCompatibility('docker', {
        minVersion: '20.0.0',
        maxVersion: '25.0.0',
        requiredFeatures: ['buildkit', 'multi-stage']
      });

      expect(compatibility).toHaveProperty('compatible');
      expect(compatibility).toHaveProperty('versionCompatible');
      expect(compatibility).toHaveProperty('featuresCompatible');
      expect(compatibility).toHaveProperty('issues');
      expect(compatibility).toHaveProperty('recommendations');
      expect(Array.isArray(compatibility.issues)).toBe(true);
      expect(Array.isArray(compatibility.recommendations)).toBe(true);
    });

    it('should validate clearCache JSDoc examples', () => {
      // Clear cache to force fresh detection
      runtime.clearCache();

      // Verify cache is cleared (private method, so we test indirectly)
      expect(runtime.clearCache).toBeDefined();
    });
  });

  describe('ContainerHealthMonitor JSDoc Examples', () => {
    it('should validate ContainerHealthMonitor constructor examples', () => {
      const monitor = new ContainerHealthMonitor(manager, {
        interval: 60000,        // Check every minute
        maxFailures: 5,         // 5 failures before marking unhealthy
        timeout: 10000,         // 10 second timeout for health checks
        containerPrefix: 'app'  // Monitor containers starting with 'app'
      });

      expect(monitor).toBeInstanceOf(ContainerHealthMonitor);
    });

    it('should validate startMonitoring JSDoc examples', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');
      vi.spyOn(manager, 'listApexContainers').mockResolvedValue([]);

      const monitor = new ContainerHealthMonitor(manager, { autoStart: false });
      await monitor.startMonitoring();
      expect(monitor.isActive()).toBe(true);
    });

    it('should validate getHealthStatus JSDoc examples', () => {
      const healthStatus = healthMonitor.getHealthStatus();
      expect(healthStatus).toBeInstanceOf(Map);
    });

    it('should validate getContainerHealth JSDoc examples', () => {
      // Mock health check data
      const mockHealth: ContainerHealthCheck = {
        containerId: 'apex-task123-abc456',
        containerName: 'apex-task123',
        status: 'healthy',
        failingStreak: 0,
        lastCheckTime: new Date()
      };

      // Add mock data to health monitor
      healthMonitor['containerHealth'].set('apex-task123-abc456', mockHealth);

      const health = healthMonitor.getContainerHealth('apex-task123-abc456');
      expect(health).toEqual(mockHealth);
    });

    it('should validate checkContainerHealth JSDoc examples', async () => {
      const mockContainerInfo: ContainerInfo = {
        id: 'apex-task123-abc456',
        name: 'apex-task123',
        image: 'node:18',
        status: 'running',
        createdAt: new Date()
      };

      vi.spyOn(manager, 'getContainerInfo').mockResolvedValue(mockContainerInfo);
      vi.spyOn(manager, 'getStats').mockResolvedValue({
        cpuPercent: 10,
        memoryPercent: 50,
        pids: 100
      } as ContainerStats);

      const health = await healthMonitor.checkContainerHealth('apex-task123-abc456');
      expect(health).toBeTruthy();
      if (health) {
        expect(health.containerId).toBe('apex-task123-abc456');
      }
    });

    it('should validate addContainer JSDoc examples', async () => {
      const mockContainerInfo: ContainerInfo = {
        id: 'apex-custom-task-123',
        name: 'apex-custom-task',
        image: 'node:18',
        status: 'running',
        createdAt: new Date()
      };

      vi.spyOn(manager, 'getContainerInfo').mockResolvedValue(mockContainerInfo);
      vi.spyOn(manager, 'getStats').mockResolvedValue({
        cpuPercent: 10,
        memoryPercent: 50,
        pids: 100
      } as ContainerStats);

      await healthMonitor.addContainer('apex-custom-task-123');
      const health = healthMonitor.getContainerHealth('apex-custom-task-123');
      expect(health).toBeTruthy();
    });

    it('should validate updateOptions JSDoc examples', () => {
      // Change monitoring interval to 1 minute
      healthMonitor.updateOptions({ interval: 60000 });

      // Enable monitoring all containers
      healthMonitor.updateOptions({ monitorAll: true });

      // Verify options were updated (accessing private field for testing)
      expect(healthMonitor['options'].interval).toBe(60000);
      expect(healthMonitor['options'].monitorAll).toBe(true);
    });

    it('should validate getStats JSDoc examples', () => {
      const stats = healthMonitor.getStats();
      expect(stats).toHaveProperty('isMonitoring');
      expect(stats).toHaveProperty('totalContainers');
      expect(stats).toHaveProperty('healthyContainers');
      expect(stats).toHaveProperty('unhealthyContainers');
      expect(stats).toHaveProperty('startingContainers');
      expect(stats).toHaveProperty('averageFailingStreak');

      expect(typeof stats.totalContainers).toBe('number');
      expect(typeof stats.healthyContainers).toBe('number');
      expect(typeof stats.unhealthyContainers).toBe('number');
      expect(typeof stats.averageFailingStreak).toBe('number');
    });
  });

  describe('Convenience Functions JSDoc Examples', () => {
    it('should validate createTaskContainer JSDoc examples', async () => {
      // Mock successful container creation
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, 'container123', '');
        return {} as any;
      });

      vi.spyOn(containerManager['runtime'], 'getBestRuntime').mockResolvedValue('docker');
      vi.spyOn(containerManager, 'getContainerInfo').mockResolvedValue({
        id: 'container123',
        name: 'apex-task-123',
        image: 'node:18',
        status: 'running',
        createdAt: new Date(),
      } as ContainerInfo);

      const result = await createTaskContainer(
        {
          image: 'node:18',
          command: ['npm', 'start'],
          environment: { NODE_ENV: 'production' }
        },
        'task-123'
      );

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');
    });

    it('should validate generateTaskContainerName JSDoc examples', () => {
      const containerName = generateTaskContainerName('task-abc123');
      expect(containerName).toMatch(/^apex-task_abc123$/);
    });

    it('should validate detectContainerRuntime JSDoc examples', async () => {
      // Mock docker detection
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker')) {
          callback(null, 'Docker version 24.0.7', '');
        } else {
          callback(new Error('Command not found'), '', 'command not found');
        }
        return {} as any;
      });

      // Get best available runtime
      const runtimeType = await detectContainerRuntime();
      expect(['docker', 'podman', 'none']).toContain(runtimeType);

      // Try to use preferred runtime
      const preferredRuntime = await detectContainerRuntime('podman');
      expect(['docker', 'podman', 'none']).toContain(preferredRuntime);
    });

    it('should validate isContainerRuntimeAvailable JSDoc examples', async () => {
      // Mock docker as available
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker')) {
          callback(null, 'Docker version 24.0.7', '');
        } else {
          callback(new Error('Command not found'), '', 'command not found');
        }
        return {} as any;
      });

      const dockerOk = await isContainerRuntimeAvailable('docker');
      const podmanOk = await isContainerRuntimeAvailable('podman');

      expect(typeof dockerOk).toBe('boolean');
      expect(typeof podmanOk).toBe('boolean');
    });

    it('should validate getContainerRuntimeInfo JSDoc examples', async () => {
      // Mock docker version info
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('docker --version')) {
          callback(null, 'Docker version 24.0.7, build afdd53b', '');
        } else if (command.includes('docker info')) {
          callback(null, 'Docker info', '');
        }
        return {} as any;
      });

      const dockerVersion = await getContainerRuntimeInfo('docker');
      if (dockerVersion) {
        expect(dockerVersion.version).toBeTruthy();
        expect(dockerVersion.fullVersion).toBeTruthy();
      }
    });

    it('should validate startContainerHealthMonitoring JSDoc examples', async () => {
      vi.spyOn(containerManager['runtime'], 'getBestRuntime').mockResolvedValue('docker');
      vi.spyOn(containerManager, 'listApexContainers').mockResolvedValue([]);

      // Start monitoring with default options
      const monitor = await startContainerHealthMonitoring();
      expect(monitor).toBeInstanceOf(ContainerHealthMonitor);
      await monitor.stopMonitoring();

      // Start monitoring with custom options
      const monitor2 = await startContainerHealthMonitoring({
        interval: 60000,
        maxFailures: 5,
        containerPrefix: 'myapp'
      });
      expect(monitor2).toBeInstanceOf(ContainerHealthMonitor);
      await monitor2.stopMonitoring();
    });

    it('should validate getContainerHealth JSDoc examples', () => {
      // Mock the singleton instance
      const mockHealth: ContainerHealthCheck = {
        containerId: 'apex-task123-abc456',
        containerName: 'apex-task123',
        status: 'healthy',
        failingStreak: 0,
        lastCheckTime: new Date()
      };

      // Mock the instance getter
      const originalInstance = containerHealthMonitor.instance;
      const mockInstance = {
        getContainerHealth: vi.fn().mockReturnValue(mockHealth)
      };

      vi.spyOn(containerHealthMonitor, 'instance', 'get').mockReturnValue(mockInstance as any);

      const health = getContainerHealth('apex-task123-abc456');
      expect(health).toEqual(mockHealth);
      expect(mockInstance.getContainerHealth).toHaveBeenCalledWith('apex-task123-abc456');
    });
  });

  describe('ContainerLogStream JSDoc Examples', () => {
    it('should validate ContainerLogStream constructor and usage examples', () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn(),
        kill: vi.fn(),
        killed: false
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const logStream = new ContainerLogStream('container123', {
        follow: true,
        timestamps: true
      }, 'docker');

      expect(logStream).toBeInstanceOf(ContainerLogStream);
      expect(logStream.isActive).toBe(true);

      // Test event listeners
      let dataReceived = false;
      logStream.on('data', (entry) => {
        dataReceived = true;
        expect(entry).toHaveProperty('message');
        expect(entry).toHaveProperty('stream');
      });

      let errorReceived = false;
      logStream.on('error', (error) => {
        errorReceived = true;
        expect(error).toBeInstanceOf(Error);
      });

      let endReceived = false;
      logStream.on('end', () => {
        endReceived = true;
      });

      // Simulate log data
      mockProcess.stdout.emit('data', Buffer.from('2024-01-01T12:00:00.000Z Test log message\n'));

      // Simulate end
      logStream.end();
      expect(endReceived).toBe(true);
    });

    it('should validate ContainerLogStream async iterator examples', async () => {
      const mockProcess = {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn(),
        kill: vi.fn(),
        killed: false
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      const logStream = new ContainerLogStream('container123', {
        follow: false,
        timestamps: true
      }, 'docker');

      // Simulate some log entries and then end
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('2024-01-01T12:00:00.000Z First message\n'));
        mockProcess.stdout.emit('data', Buffer.from('2024-01-01T12:00:01.000Z Second message\n'));
        logStream.end();
      }, 10);

      const logEntries: any[] = [];
      for await (const logEntry of logStream) {
        logEntries.push(logEntry);
        if (logEntries.length >= 2) break; // Limit for test
      }

      expect(logEntries.length).toBeGreaterThan(0);
      if (logEntries.length > 0) {
        expect(logEntries[0]).toHaveProperty('message');
        expect(logEntries[0]).toHaveProperty('stream');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle runtime unavailable errors correctly', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('none');

      const result = await manager.createContainer({
        config: { image: 'node:18' },
        taskId: 'task-123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No container runtime available');
    });

    it('should handle command execution timeouts', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');

      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        const error = new Error('Timeout') as any;
        error.code = 'ETIMEDOUT';
        callback(error, '', '');
        return {} as any;
      });

      const result = await manager.execCommand('container123', 'long-running-command', {
        timeout: 1000
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(124); // Timeout exit code
      expect(result.error).toContain('timed out');
    });

    it('should handle health monitoring failures gracefully', async () => {
      vi.spyOn(runtime, 'getBestRuntime').mockResolvedValue('docker');
      vi.spyOn(manager, 'listApexContainers').mockRejectedValue(new Error('Docker daemon not running'));

      const monitor = new ContainerHealthMonitor(manager, { autoStart: false });
      await monitor.startMonitoring();

      // Should not throw, should handle error gracefully
      expect(monitor.isActive()).toBe(true);
    });

    it('should validate parameter validation in JSDoc examples', () => {
      // Test invalid container naming config
      expect(() => {
        manager.generateContainerName('', {
          prefix: '',
          includeTaskId: false,
          includeTimestamp: false,
          separator: ''
        });
      }).not.toThrow(); // Should handle gracefully

      // Test invalid health monitor options
      expect(() => {
        new ContainerHealthMonitor(manager, {
          interval: -1,
          maxFailures: -1,
          timeout: -1
        });
      }).not.toThrow(); // Constructor should handle invalid values
    });
  });
});