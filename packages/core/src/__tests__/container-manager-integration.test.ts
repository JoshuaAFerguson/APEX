import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  ContainerManager,
  containerManager,
  createTaskContainer,
  generateTaskContainerName,
  type ContainerOperationResult,
  type CreateContainerOptions,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerConfig, ContainerInfo, ContainerStats } from '../types';

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

describe('ContainerManager Integration Tests', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
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
  // Real-World Scenario Testing
  // ============================================================================

  describe('real-world scenarios', () => {
    it('should handle complete Node.js development container workflow', async () => {
      const devConfig: ContainerConfig = {
        image: 'node:20-alpine',
        workingDir: '/app',
        user: '1000:1000',
        environment: {
          NODE_ENV: 'development',
          PORT: '3000',
          DEBUG: 'app:*',
        },
        volumes: {
          '/host/project': '/app',
          '/host/node_modules': '/app/node_modules',
          '/host/.npm': '/home/node/.npm',
        },
        resourceLimits: {
          memory: '2g',
          cpu: 1.0,
        },
        networkMode: 'bridge',
        command: ['npm', 'run', 'dev'],
      };

      const taskId = 'node-dev-task';
      const containerId = 'node-dev-container';

      // Mock complete lifecycle
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // start
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-${taskId}|node:20-alpine|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>`)); // inspect after start
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|50.5%|1.5GiB / 2GiB|75%|125kB / 89kB|15MB / 8MB|45`)); // stats
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // stop
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // remove

      // Create and auto-start
      const createResult = await manager.createContainer({
        config: devConfig,
        taskId,
        autoStart: true,
      });

      expect(createResult.success).toBe(true);
      expect(createResult.containerInfo?.status).toBe('running');

      // Get runtime stats
      const stats = await manager.getStats(containerId);
      expect(stats).not.toBeNull();
      expect(stats!.cpuPercent).toBe(50.5);
      expect(stats!.memoryUsage).toBe(1.5 * 1024 * 1024 * 1024); // 1.5 GiB
      expect(stats!.pids).toBe(45);

      // Stop gracefully
      const stopResult = await manager.stopContainer(containerId, 'docker', 30);
      expect(stopResult.success).toBe(true);

      // Clean up
      const removeResult = await manager.removeContainer(containerId);
      expect(removeResult.success).toBe(true);
    });

    it('should handle Python data science container with Jupyter', async () => {
      const dataScienceConfig: ContainerConfig = {
        image: 'jupyter/datascience-notebook:latest',
        workingDir: '/home/jovyan/work',
        environment: {
          JUPYTER_TOKEN: 'secret-token-123',
          GRANT_SUDO: 'yes',
          JUPYTER_ENABLE_LAB: 'yes',
        },
        volumes: {
          '/host/notebooks': '/home/jovyan/work',
          '/host/data': '/data',
        },
        resourceLimits: {
          memory: '8g',
          cpu: 4.0,
        },
        networkMode: 'bridge',
        user: 'root',
      };

      const taskId = 'jupyter-analysis';
      const containerId = 'jupyter-container';

      // Mock lifecycle operations
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // start
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-${taskId}|jupyter/datascience-notebook:latest|running|2023-01-01T11:00:00Z|2023-01-01T11:00:05Z|<no value>|<no value>`)); // inspect

      const result = await manager.createContainer({
        config: dataScienceConfig,
        taskId,
        autoStart: true,
      });

      expect(result.success).toBe(true);
      expect(result.containerInfo?.status).toBe('running');
      expect(result.command).toContain('jupyter/datascience-notebook:latest');
      expect(result.command).toContain('--memory 8g');
      expect(result.command).toContain('--cpus 4');
    });

    it('should handle database container with persistence', async () => {
      const dbConfig: ContainerConfig = {
        image: 'postgres:15-alpine',
        environment: {
          POSTGRES_DB: 'apex_db',
          POSTGRES_USER: 'apex_user',
          POSTGRES_PASSWORD: 'secure_password_123',
          PGDATA: '/var/lib/postgresql/data/pgdata',
        },
        volumes: {
          '/host/postgres-data': '/var/lib/postgresql/data',
          '/host/postgres-init': '/docker-entrypoint-initdb.d',
        },
        resourceLimits: {
          memory: '4g',
          cpu: 2.0,
        },
        networkMode: 'bridge',
        autoRemove: false, // Persistent database
      };

      const taskId = 'postgres-db';
      const containerId = 'postgres-container';

      // Mock database startup sequence
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // start
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-${taskId}|postgres:15-alpine|running|2023-01-01T12:00:00Z|2023-01-01T12:00:10Z|<no value>|<no value>`)); // inspect

      const result = await manager.createContainer({
        config: dbConfig,
        taskId,
        autoStart: true,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('postgres:15-alpine');
      expect(result.command).toContain('-e POSTGRES_DB=apex_db');
      expect(result.command).toContain('-v /host/postgres-data:/var/lib/postgresql/data');
      expect(result.command).not.toContain('--rm'); // Should not auto-remove
    });

    it('should handle microservice deployment scenario', async () => {
      const microservices = [
        {
          name: 'api-gateway',
          config: {
            image: 'nginx:alpine',
            environment: { SERVICE_NAME: 'gateway' },
            resourceLimits: { memory: '256m', cpu: 0.5 },
          },
        },
        {
          name: 'auth-service',
          config: {
            image: 'node:18-alpine',
            environment: { SERVICE_NAME: 'auth', PORT: '3001' },
            resourceLimits: { memory: '512m', cpu: 1.0 },
          },
        },
        {
          name: 'user-service',
          config: {
            image: 'node:18-alpine',
            environment: { SERVICE_NAME: 'users', PORT: '3002' },
            resourceLimits: { memory: '512m', cpu: 1.0 },
          },
        },
        {
          name: 'redis-cache',
          config: {
            image: 'redis:7-alpine',
            environment: { REDIS_PASSWORD: 'cache_password' },
            resourceLimits: { memory: '256m', cpu: 0.5 },
          },
        },
      ];

      const deploymentPromises = microservices.map((service, index) => {
        const containerId = `${service.name}-container`;

        // Mock operations for each service
        mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create
        mockExec.mockImplementationOnce(mockExecCallback(containerId)); // start
        mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-${service.name}|${service.config.image}|running|2023-01-01T13:00:00Z|2023-01-01T13:00:0${index + 1}Z|<no value>|<no value>`)); // inspect

        return manager.createContainer({
          config: service.config as ContainerConfig,
          taskId: service.name,
          autoStart: true,
        });
      });

      const results = await Promise.all(deploymentPromises);

      // All microservices should deploy successfully
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.containerInfo?.status).toBe('running');
        expect(result.command).toContain(microservices[index].config.image);
      });
    });

    it('should handle container cleanup after task failure', async () => {
      const failConfig: ContainerConfig = {
        image: 'alpine:latest',
        command: ['sh', '-c', 'exit 1'], // Command that will fail
        autoRemove: false,
      };

      const taskId = 'failing-task';
      const containerId = 'failing-container';

      // Mock create success, start success, but container exits with error
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // start
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-${taskId}|alpine:latest|running|2023-01-01T14:00:00Z|2023-01-01T14:00:01Z|<no value>|<no value>`)); // initial inspect

      // Simulate container running then exiting
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-${taskId}|alpine:latest|exited|2023-01-01T14:00:00Z|2023-01-01T14:00:01Z|2023-01-01T14:00:05Z|1`)); // inspect after exit

      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // remove

      // Create and start container
      const createResult = await manager.createContainer({
        config: failConfig,
        taskId,
        autoStart: true,
      });

      expect(createResult.success).toBe(true);
      expect(createResult.containerInfo?.status).toBe('running');

      // Check status after some time (simulated)
      const laterInfo = await manager.inspect(containerId);
      expect(laterInfo).not.toBeNull();
      expect(laterInfo!.status).toBe('exited');
      expect(laterInfo!.exitCode).toBe(1);

      // Clean up failed container
      const removeResult = await manager.removeContainer(containerId, 'docker', true);
      expect(removeResult.success).toBe(true);
    });
  });

  // ============================================================================
  // Multi-Runtime Integration Testing
  // ============================================================================

  describe('multi-runtime integration', () => {
    it('should handle Docker-to-Podman migration scenario', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
        command: ['echo', 'hello world'],
      };

      const taskId = 'migration-test';
      const containerId = 'migration-container';

      // Start with Docker
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('docker');
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const dockerResult = await manager.createContainer({
        config,
        taskId: `${taskId}-docker`,
      });

      expect(dockerResult.success).toBe(true);
      expect(dockerResult.command).toContain('docker create');

      // Switch to Podman for next operation
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('podman');
      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const podmanResult = await manager.createContainer({
        config,
        taskId: `${taskId}-podman`,
      });

      expect(podmanResult.success).toBe(true);
      expect(podmanResult.command).toContain('podman create');
    });

    it('should handle runtime availability changes during operations', async () => {
      const config: ContainerConfig = {
        image: 'alpine:latest',
      };

      const operations = [];

      // Initially Docker is available
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('docker');
      mockExec.mockImplementationOnce(mockExecCallback('docker-container'));

      operations.push(
        manager.createContainer({
          config,
          taskId: 'runtime-available-1',
        })
      );

      // Then no runtime becomes available
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('none');

      operations.push(
        manager.createContainer({
          config,
          taskId: 'runtime-unavailable',
        })
      );

      // Then Podman becomes available
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('podman');
      mockExec.mockImplementationOnce(mockExecCallback('podman-container'));

      operations.push(
        manager.createContainer({
          config,
          taskId: 'runtime-available-2',
        })
      );

      const results = await Promise.all(operations);

      expect(results[0].success).toBe(true);
      expect(results[0].command).toContain('docker');
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('No container runtime available');
      expect(results[2].success).toBe(true);
      expect(results[2].command).toContain('podman');
    });
  });

  // ============================================================================
  // Monitoring and Observability Integration
  // ============================================================================

  describe('monitoring and observability', () => {
    it('should handle continuous monitoring scenario', async () => {
      const monitoringConfig: ContainerConfig = {
        image: 'prom/prometheus:latest',
        volumes: {
          '/host/prometheus.yml': '/etc/prometheus/prometheus.yml',
          '/host/prometheus-data': '/prometheus',
        },
        resourceLimits: {
          memory: '1g',
          cpu: 1.0,
        },
        environment: {
          PROMETHEUS_RETENTION_TIME: '7d',
        },
        command: [
          '--config.file=/etc/prometheus/prometheus.yml',
          '--storage.tsdb.path=/prometheus',
          '--web.console.libraries=/etc/prometheus/console_libraries',
          '--web.console.templates=/etc/prometheus/consoles',
        ],
      };

      const taskId = 'prometheus-monitoring';
      const containerId = 'prometheus-container';

      // Mock monitoring container lifecycle
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // start
      mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-${taskId}|prom/prometheus:latest|running|2023-01-01T15:00:00Z|2023-01-01T15:00:05Z|<no value>|<no value>`)); // inspect

      // Mock several stats collection calls for monitoring
      const statsCalls = 5;
      for (let i = 0; i < statsCalls; i++) {
        const cpuUsage = 15 + Math.random() * 10; // Simulated varying CPU
        const memoryMB = 800 + Math.random() * 200; // Simulated memory usage
        const statsOutput = `${containerId}|${cpuUsage.toFixed(2)}%|${memoryMB}MB / 1GB|${(memoryMB / 1024 * 100).toFixed(2)}%|5kB / 3kB|50MB / 25MB|25`;
        mockExec.mockImplementationOnce(mockExecCallback(statsOutput));
      }

      // Create monitoring container
      const createResult = await manager.createContainer({
        config: monitoringConfig,
        taskId,
        autoStart: true,
      });

      expect(createResult.success).toBe(true);
      expect(createResult.containerInfo?.status).toBe('running');

      // Collect stats over time (simulated)
      const statsCollection: ContainerStats[] = [];
      for (let i = 0; i < statsCalls; i++) {
        const stats = await manager.getStats(containerId);
        expect(stats).not.toBeNull();
        statsCollection.push(stats!);
      }

      // Verify we collected meaningful metrics
      expect(statsCollection).toHaveLength(statsCalls);
      statsCollection.forEach(stats => {
        expect(stats.cpuPercent).toBeGreaterThan(0);
        expect(stats.memoryUsage).toBeGreaterThan(0);
        expect(stats.pids).toBeGreaterThan(0);
      });
    });

    it('should handle log aggregation container workflow', async () => {
      const logConfig: ContainerConfig = {
        image: 'grafana/loki:latest',
        volumes: {
          '/host/loki-data': '/loki',
          '/host/loki-config.yaml': '/etc/loki/local-config.yaml',
        },
        resourceLimits: {
          memory: '2g',
          cpu: 1.5,
        },
        environment: {
          LOKI_CONFIG: '/etc/loki/local-config.yaml',
        },
        labels: {
          'apex.component': 'logging',
          'apex.environment': 'production',
          'monitoring.type': 'logs',
        },
      };

      const taskId = 'loki-logging';
      const containerId = 'loki-container';

      // Mock log aggregation container
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create

      const result = await manager.createContainer({
        config: logConfig,
        taskId,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('grafana/loki:latest');
      expect(result.command).toContain('--label apex.component=logging');
      expect(result.command).toContain('--label monitoring.type=logs');
    });
  });

  // ============================================================================
  // Security and Compliance Integration
  // ============================================================================

  describe('security and compliance', () => {
    it('should handle secure container deployment', async () => {
      const secureConfig: ContainerConfig = {
        image: 'alpine:latest',
        user: '1000:1000', // Non-root user
        privileged: false,
        capDrop: ['ALL'],
        capAdd: ['NET_BIND_SERVICE'], // Only specific capabilities
        securityOpts: [
          'no-new-privileges:true',
          'apparmor=docker-default',
        ],
        resourceLimits: {
          memory: '256m',
          cpu: 0.5,
          pidsLimit: 100,
        },
        environment: {
          // No sensitive data in environment
          APP_ENV: 'production',
        },
        volumes: {
          // Read-only mounts where appropriate
        },
        labels: {
          'security.scan': 'passed',
          'compliance.level': 'high',
        },
      };

      const taskId = 'secure-deployment';
      const containerId = 'secure-container';

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      const result = await manager.createContainer({
        config: secureConfig,
        taskId,
      });

      expect(result.success).toBe(true);
      expect(result.command).toContain('--user 1000:1000');
      expect(result.command).toContain('--cap-drop ALL');
      expect(result.command).toContain('--cap-add NET_BIND_SERVICE');
      expect(result.command).toContain('--security-opt no-new-privileges:true');
      expect(result.command).not.toContain('--privileged');
    });
  });

  // ============================================================================
  // Performance and Scaling Integration
  // ============================================================================

  describe('performance and scaling', () => {
    it('should handle horizontal scaling scenario', async () => {
      const baseConfig: ContainerConfig = {
        image: 'nginx:alpine',
        resourceLimits: {
          memory: '128m',
          cpu: 0.25,
        },
        environment: {
          NGINX_PORT: '80',
        },
      };

      const instanceCount = 10;
      const scaleUpPromises = [];

      // Scale up: create multiple instances
      for (let i = 0; i < instanceCount; i++) {
        const containerId = `nginx-instance-${i}`;
        const config = {
          ...baseConfig,
          environment: {
            ...baseConfig.environment,
            INSTANCE_ID: i.toString(),
          },
        };

        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        mockExec.mockImplementationOnce(mockExecCallback(`${containerId}|apex-nginx-${i}|nginx:alpine|running|2023-01-01T16:00:00Z|2023-01-01T16:00:0${i}Z|<no value>|<no value>`));

        scaleUpPromises.push(
          manager.createContainer({
            config,
            taskId: `nginx-${i}`,
            autoStart: true,
          })
        );
      }

      const scaleUpResults = await Promise.all(scaleUpPromises);

      // Verify all instances started successfully
      scaleUpResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.containerInfo?.status).toBe('running');
      });

      // Scale down: stop some instances
      const scaleDownCount = 5;
      const scaleDownPromises = [];

      for (let i = 0; i < scaleDownCount; i++) {
        const containerId = `nginx-instance-${i}`;
        mockExec.mockImplementationOnce(mockExecCallback(containerId));
        scaleDownPromises.push(manager.stopContainer(containerId));
      }

      const scaleDownResults = await Promise.all(scaleDownPromises);

      // Verify instances stopped successfully
      scaleDownResults.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});