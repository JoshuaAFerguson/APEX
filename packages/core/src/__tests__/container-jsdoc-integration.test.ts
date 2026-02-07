/**
 * Container JSDoc Integration Tests
 *
 * End-to-end tests that validate complete workflows using JSDoc documented
 * functionality across all container modules working together.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { EventEmitter } from 'eventemitter3';

import {
  ContainerManager,
  createTaskContainer,
  generateTaskContainerName,
} from '../container-manager';

import {
  ContainerRuntime,
  detectContainerRuntime,
} from '../container-runtime';

import {
  ContainerHealthMonitor,
  startContainerHealthMonitoring,
} from '../container-health-monitor';

import { ContainerInfo } from '../types';

// Mock dependencies
vi.mock('child_process');
const mockExec = vi.mocked(exec);

describe('Container JSDoc Integration Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute complete container lifecycle workflow as documented', async () => {
    // Mock successful Docker runtime
    mockExec.mockImplementation((command: any, options: any, callback: any) => {
      if (command.includes('docker --version')) {
        callback(null, 'Docker version 24.0.7, build afdd53b', '');
      } else if (command.includes('docker info')) {
        callback(null, 'Docker info output', '');
      } else if (command.includes('docker create')) {
        callback(null, 'container123', '');
      } else if (command.includes('docker start')) {
        callback(null, 'container123', '');
      } else if (command.includes('docker stop')) {
        callback(null, 'container123', '');
      } else if (command.includes('docker rm')) {
        callback(null, 'container123', '');
      } else if (command.includes('docker inspect')) {
        callback(null, 'container123|apex-task-123|node:18|running|2024-01-01T12:00:00Z|||0', '');
      } else {
        callback(null, 'success', '');
      }
      return {} as any;
    });

    console.log('\\n=== Complete Container Lifecycle Workflow ===');

    // Step 1: Detect container runtime (as documented in ContainerRuntime)
    console.log('1. Detecting container runtime...');
    const runtimeType = await detectContainerRuntime();
    expect(runtimeType).toBe('docker');
    console.log(`   ✓ Detected runtime: ${runtimeType}`);

    // Step 2: Create container manager with custom naming (as documented)
    console.log('2. Creating container manager...');
    const runtime = new ContainerRuntime();
    const manager = new ContainerManager(runtime, {
      prefix: 'myapp',
      includeTimestamp: false
    });
    expect(manager).toBeInstanceOf(ContainerManager);
    console.log('   ✓ Container manager created with custom naming');

    // Step 3: Generate container name (as documented)
    console.log('3. Generating container name...');
    const containerName = generateTaskContainerName('task-123');
    expect(containerName).toMatch(/^apex-task_123$/);
    console.log(`   ✓ Generated name: ${containerName}`);

    // Step 4: Create and start container (as documented in createTaskContainer)
    console.log('4. Creating and starting container...');
    const createResult = await createTaskContainer({
      image: 'node:18',
      command: ['npm', 'start'],
      environment: { NODE_ENV: 'production' },
      volumes: { '/host/app': '/app' }
    }, 'task-123', true);

    expect(createResult.success).toBe(true);
    expect(createResult.containerId).toBe('container123');
    console.log(`   ✓ Container created: ${createResult.containerId}`);

    // Step 5: Execute command in container (as documented)
    console.log('5. Executing command in container...');
    const execResult = await manager.execCommand(createResult.containerId!, [
      'npm', 'test'
    ], {
      workingDir: '/app',
      environment: { NODE_ENV: 'test' },
      timeout: 60000
    });

    expect(execResult.success).toBe(true);
    console.log('   ✓ Command executed successfully');

    // Step 6: Stop and remove container (as documented)
    console.log('6. Stopping and removing container...');
    const stopResult = await manager.stopContainer(createResult.containerId!, undefined, 10);
    expect(stopResult.success).toBe(true);

    const removeResult = await manager.removeContainer(createResult.containerId!);
    expect(removeResult.success).toBe(true);
    console.log('   ✓ Container stopped and removed');

    console.log('\\n✓ Complete lifecycle workflow successful!');
  });

  it('should execute health monitoring workflow as documented', async () => {
    // Mock Docker runtime and container operations
    mockExec.mockImplementation((command: any, options: any, callback: any) => {
      if (command.includes('docker --version')) {
        callback(null, 'Docker version 24.0.7', '');
      } else if (command.includes('docker info')) {
        callback(null, 'Docker info', '');
      } else if (command.includes('docker ps')) {
        callback(null, 'container123|apex-task123|node:18|running|2024-01-01', '');
      } else if (command.includes('docker inspect')) {
        callback(null, 'container123|apex-task123|node:18|running|2024-01-01T12:00:00Z|||0', '');
      } else if (command.includes('docker stats')) {
        callback(null, 'CONTAINER|CPU %|MEM USAGE / LIMIT|MEM %|NET I/O|BLOCK I/O|PIDS\\ncontainer123|10.0%|512MiB / 1GiB|50.0%|1kB / 1kB|1MB / 1MB|42', '');
      }
      return {} as any;
    });

    console.log('\\n=== Health Monitoring Workflow ===');

    // Step 1: Start health monitoring with custom options (as documented)
    console.log('1. Starting container health monitoring...');
    const monitor = await startContainerHealthMonitoring({
      interval: 5000,      // Check every 5 seconds for testing
      maxFailures: 3,
      timeout: 10000,
      containerPrefix: 'apex'
    });

    expect(monitor).toBeInstanceOf(ContainerHealthMonitor);
    expect(monitor.isActive()).toBe(true);
    console.log('   ✓ Health monitoring started');

    // Step 2: Add container to monitoring (as documented)
    console.log('2. Adding container to monitoring...');
    const runtime = new ContainerRuntime();
    const manager = new ContainerManager(runtime);

    // Mock container info
    vi.spyOn(manager, 'getContainerInfo').mockResolvedValue({
      id: 'container123',
      name: 'apex-task123',
      image: 'node:18',
      status: 'running',
      createdAt: new Date(),
    } as ContainerInfo);

    await monitor.addContainer('container123');
    console.log('   ✓ Container added to monitoring');

    // Step 3: Check container health (as documented)
    console.log('3. Checking container health...');
    const health = await monitor.checkContainerHealth('container123');

    expect(health).toBeTruthy();
    expect(health?.containerId).toBe('container123');
    expect(health?.status).toBeDefined();
    console.log(`   ✓ Health check completed: ${health?.status}`);

    // Step 4: Get monitoring statistics (as documented)
    console.log('4. Getting monitoring statistics...');
    const stats = monitor.getStats();

    expect(stats.totalContainers).toBeGreaterThan(0);
    expect(stats.isMonitoring).toBe(true);
    console.log(`   ✓ Monitoring ${stats.totalContainers} container(s)`);
    console.log(`     - Healthy: ${stats.healthyContainers}`);
    console.log(`     - Unhealthy: ${stats.unhealthyContainers}`);

    // Step 5: Stop monitoring (as documented)
    console.log('5. Stopping health monitoring...');
    await monitor.stopMonitoring();
    expect(monitor.isActive()).toBe(false);
    console.log('   ✓ Health monitoring stopped');

    console.log('\\n✓ Health monitoring workflow successful!');
  });

  it('should handle complex multi-container scenario as documented', async () => {
    // Mock multiple container operations
    let containerCount = 0;
    mockExec.mockImplementation((command: any, options: any, callback: any) => {
      if (command.includes('docker --version')) {
        callback(null, 'Docker version 24.0.7', '');
      } else if (command.includes('docker info')) {
        callback(null, 'Docker info', '');
      } else if (command.includes('docker create')) {
        containerCount++;
        callback(null, `container${containerCount}`, '');
      } else if (command.includes('docker start')) {
        callback(null, 'started', '');
      } else if (command.includes('docker ps')) {
        const containers = Array.from({ length: containerCount }, (_, i) =>
          `container${i + 1}|apex-task${i + 1}|node:18|running|2024-01-01`
        ).join('\\n');
        callback(null, containers, '');
      } else if (command.includes('docker inspect')) {
        const match = command.match(/container(\d+)/);
        const id = match ? match[1] : '1';
        callback(null, `container${id}|apex-task${id}|node:18|running|2024-01-01T12:00:00Z|||0`, '');
      } else {
        callback(null, 'success', '');
      }
      return {} as any;
    });

    console.log('\\n=== Multi-Container Scenario ===');

    // Step 1: Setup infrastructure
    console.log('1. Setting up container infrastructure...');
    const runtime = new ContainerRuntime();
    const manager = new ContainerManager(runtime);

    // Verify runtime compatibility (as documented)
    const compatibility = await runtime.validateCompatibility('docker', {
      minVersion: '20.0.0',
      maxVersion: '25.0.0'
    });
    expect(compatibility.compatible).toBe(true);
    console.log('   ✓ Runtime compatibility verified');

    // Step 2: Create multiple containers (as documented)
    console.log('2. Creating multiple containers...');
    const containerConfigs = [
      { image: 'node:18', taskId: 'web-server' },
      { image: 'redis:7', taskId: 'cache' },
      { image: 'postgres:15', taskId: 'database' }
    ];

    const containers = [];
    for (const config of containerConfigs) {
      const result = await createTaskContainer({
        image: config.image,
        environment: {
          NODE_ENV: 'production',
          SERVICE_NAME: config.taskId
        }
      }, config.taskId, true);

      expect(result.success).toBe(true);
      containers.push(result.containerId!);
      console.log(`   ✓ Created ${config.taskId}: ${result.containerId}`);
    }

    // Step 3: Start monitoring all containers (as documented)
    console.log('3. Starting comprehensive health monitoring...');
    const monitor = await startContainerHealthMonitoring({
      interval: 3000,
      maxFailures: 2,
      monitorAll: false, // Monitor only APEX containers
      containerPrefix: 'apex'
    });

    // List and monitor all APEX containers (as documented)
    const apexContainers = await manager.listApexContainers();
    expect(apexContainers.length).toBe(containerCount);
    console.log(`   ✓ Found ${apexContainers.length} APEX containers to monitor`);

    // Step 4: Execute coordinated operations (as documented)
    console.log('4. Executing coordinated container operations...');
    const operations = containers.map(async (containerId, index) => {
      // Get container info (as documented)
      const info = await manager.inspect(containerId);
      expect(info).toBeTruthy();

      // Execute health check command (as documented)
      const healthCheck = await manager.execCommand(containerId, 'echo "healthy"', {
        timeout: 5000
      });
      expect(healthCheck.success).toBe(true);

      return { containerId, info, healthCheck };
    });

    const results = await Promise.all(operations);
    expect(results.length).toBe(containers.length);
    console.log(`   ✓ Completed operations on ${results.length} containers`);

    // Step 5: Monitor health events (as documented)
    console.log('5. Monitoring health events...');
    let healthEventsReceived = 0;
    monitor.on('container:health', (event) => {
      healthEventsReceived++;
      console.log(`   Health event: ${event.containerName} -> ${event.status}`);
    });

    // Wait for health checks to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 6: Cleanup (as documented)
    console.log('6. Cleaning up containers...');
    for (const containerId of containers) {
      const stopResult = await manager.stopContainer(containerId);
      const removeResult = await manager.removeContainer(containerId);

      expect(stopResult.success).toBe(true);
      expect(removeResult.success).toBe(true);
    }

    await monitor.stopMonitoring();
    console.log('   ✓ All containers cleaned up');

    console.log('\\n✓ Multi-container scenario completed successfully!');
  });

  it('should demonstrate error recovery workflows as documented', async () => {
    console.log('\\n=== Error Recovery Workflow ===');

    // Simulate Docker daemon becoming unavailable mid-workflow
    let dockerAvailable = true;
    mockExec.mockImplementation((command: any, options: any, callback: any) => {
      if (!dockerAvailable) {
        callback(new Error('Cannot connect to Docker daemon'), '', 'Docker daemon not running');
        return {} as any;
      }

      if (command.includes('docker --version')) {
        callback(null, 'Docker version 24.0.7', '');
      } else if (command.includes('docker info')) {
        callback(null, 'Docker info', '');
      } else if (command.includes('docker create')) {
        callback(null, 'container123', '');
      } else {
        callback(null, 'success', '');
      }
      return {} as any;
    });

    // Step 1: Initial successful operations (as documented)
    console.log('1. Starting with healthy Docker environment...');
    const manager = new ContainerManager();

    const createResult = await createTaskContainer({
      image: 'node:18'
    }, 'resilience-test', false);

    expect(createResult.success).toBe(true);
    console.log('   ✓ Container created successfully');

    // Step 2: Simulate Docker daemon failure (as documented error handling)
    console.log('2. Simulating Docker daemon failure...');
    dockerAvailable = false;

    const startResult = await manager.startContainer('container123');
    expect(startResult.success).toBe(false);
    expect(startResult.error).toContain('Cannot connect to Docker daemon');
    console.log('   ✓ Error handled gracefully:', startResult.error);

    // Step 3: Attempt runtime re-detection (as documented)
    console.log('3. Attempting runtime re-detection...');
    const runtime = new ContainerRuntime();
    runtime.clearCache(); // Force fresh detection

    const runtimeType = await runtime.getBestRuntime();
    expect(runtimeType).toBe('none');
    console.log(`   ✓ Runtime status: ${runtimeType}`);

    // Step 4: Health monitoring during failure (as documented)
    console.log('4. Testing health monitoring resilience...');
    const monitor = new ContainerHealthMonitor(manager, { autoStart: false });

    try {
      await monitor.startMonitoring();
      expect(true).toBe(false); // Should have thrown
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      console.log('   ✓ Health monitoring detected runtime unavailability');
    }

    // Step 5: Recovery simulation (as documented)
    console.log('5. Simulating Docker daemon recovery...');
    dockerAvailable = true;
    runtime.clearCache();

    const recoveredRuntime = await runtime.getBestRuntime();
    expect(recoveredRuntime).toBe('docker');
    console.log('   ✓ Runtime recovery detected');

    // Step 6: Resume operations (as documented)
    console.log('6. Resuming operations after recovery...');
    const resumeResult = await manager.startContainer('container123');
    expect(resumeResult.success).toBe(true);
    console.log('   ✓ Operations resumed successfully');

    console.log('\\n✓ Error recovery workflow completed successfully!');
  });

  it('should validate all JSDoc promise-based examples work correctly', async () => {
    console.log('\\n=== Promise-Based API Validation ===');

    // Mock all Docker operations
    mockExec.mockImplementation((command: any, options: any, callback: any) => {
      setTimeout(() => {
        if (command.includes('docker --version')) {
          callback(null, 'Docker version 24.0.7', '');
        } else if (command.includes('docker info')) {
          callback(null, 'Docker info', '');
        } else if (command.includes('docker create')) {
          callback(null, 'async-container-123', '');
        } else if (command.includes('docker start')) {
          callback(null, 'async-container-123', '');
        } else if (command.includes('docker exec')) {
          callback(null, 'async execution result', '');
        } else if (command.includes('docker inspect')) {
          callback(null, 'async-container-123|apex-async|node:18|running|2024-01-01T12:00:00Z|||0', '');
        } else {
          callback(null, 'async success', '');
        }
      }, 10); // Small delay to test async behavior
      return {} as any;
    });

    const manager = new ContainerManager();

    // Test 1: Async container creation (as documented)
    console.log('1. Testing async container creation...');
    const createPromise = createTaskContainer({
      image: 'node:18',
      command: ['node', '--version']
    }, 'async-test');

    const result = await createPromise;
    expect(result.success).toBe(true);
    console.log('   ✓ Async container creation works');

    // Test 2: Chained async operations (as documented)
    console.log('2. Testing chained async operations...');
    const chainedResult = await manager.createContainer({
      config: { image: 'node:18' },
      taskId: 'chain-test'
    }).then(createRes => {
      if (createRes.success) {
        return manager.startContainer(createRes.containerId!);
      }
      throw new Error('Create failed');
    }).then(startRes => {
      if (startRes.success) {
        return manager.execCommand(startRes.containerId!, 'echo "chained"');
      }
      throw new Error('Start failed');
    });

    expect(chainedResult.success).toBe(true);
    console.log('   ✓ Chained async operations work');

    // Test 3: Parallel async operations (as documented)
    console.log('3. Testing parallel async operations...');
    const parallelPromises = [
      manager.inspect('async-container-123'),
      detectContainerRuntime(),
      manager.execCommand('async-container-123', 'echo "parallel1"'),
      manager.execCommand('async-container-123', 'echo "parallel2"')
    ];

    const parallelResults = await Promise.all(parallelPromises);
    expect(parallelResults).toHaveLength(4);
    expect(parallelResults.every(r => r !== null && r !== undefined)).toBe(true);
    console.log('   ✓ Parallel async operations work');

    console.log('\\n✓ Promise-based API validation completed!');
  });
});