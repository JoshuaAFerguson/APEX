import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ChildProcess } from 'child_process';
import { ContainerManager } from '../container-manager';
import { ContainerRuntime } from '../container-runtime';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Mock container runtime
vi.mock('../container-runtime', () => ({
  ContainerRuntime: vi.fn().mockImplementation(() => ({
    getBestRuntime: vi.fn().mockResolvedValue('docker'),
  })),
}));

describe('ContainerManager Docker Events - Real-World Integration Tests', () => {
  let containerManager: ContainerManager;
  let mockSpawn: Mock;
  let mockProcess: Partial<ChildProcess>;
  let mockRuntime: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpawn = vi.mocked(vi.requireMock('child_process').spawn);

    mockProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn(),
      kill: vi.fn(),
      killed: false,
    };

    mockSpawn.mockReturnValue(mockProcess as ChildProcess);

    mockRuntime = {
      getBestRuntime: vi.fn().mockResolvedValue('docker'),
    };

    containerManager = new ContainerManager(mockRuntime as ContainerRuntime);
  });

  afterEach(async () => {
    if (containerManager.isEventsMonitoringActive()) {
      await containerManager.stopEventsMonitoring();
    }
  });

  describe('CI/CD Pipeline Container Failures', () => {
    it('should detect and handle build container failures in CI pipeline', async () => {
      await containerManager.startEventsMonitoring();

      const events: any[] = [];
      const diedEventSpy = vi.fn((event) => events.push(event));
      containerManager.on('container:died', diedEventSpy);

      // Mock container info for build containers
      vi.spyOn(containerManager, 'getContainerInfo')
        .mockResolvedValueOnce({
          id: 'build-001',
          name: 'apex-build-frontend-abc123',
          image: 'node:18-alpine',
          status: 'exited',
          createdAt: new Date(),
          exitCode: 1,
        })
        .mockResolvedValueOnce({
          id: 'build-002',
          name: 'apex-build-backend-def456',
          image: 'node:18-alpine',
          status: 'exited',
          createdAt: new Date(),
          exitCode: 130, // SIGINT
        })
        .mockResolvedValueOnce({
          id: 'build-003',
          name: 'apex-test-e2e-ghi789',
          image: 'cypress/included:13',
          status: 'exited',
          createdAt: new Date(),
          exitCode: 137, // SIGKILL/OOM
        });

      // Simulate build container failures
      const buildEvents = [
        {
          // Frontend build fails due to lint errors
          status: 'die',
          id: 'build-001',
          Actor: {
            Attributes: {
              name: 'apex-build-frontend-abc123',
              image: 'node:18-alpine',
              exitCode: '1',
            }
          },
          time: 1640995200,
        },
        {
          // Backend build interrupted
          status: 'die',
          id: 'build-002',
          Actor: {
            Attributes: {
              name: 'apex-build-backend-def456',
              image: 'node:18-alpine',
              exitCode: '130',
              signal: 'SIGINT',
            }
          },
          time: 1640995210,
        },
        {
          // E2E tests killed due to memory limit
          status: 'die',
          id: 'build-003',
          Actor: {
            Attributes: {
              name: 'apex-test-e2e-ghi789',
              image: 'cypress/included:13',
              exitCode: '137',
              oomkilled: 'true',
            }
          },
          time: 1640995220,
        },
      ];

      for (const event of buildEvents) {
        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(diedEventSpy).toHaveBeenCalledTimes(3);

      // Verify frontend build failure
      expect(events[0]).toMatchObject({
        containerId: 'build-001',
        taskId: 'build',
        exitCode: 1,
        oomKilled: false,
        signal: undefined,
      });

      // Verify backend build interruption
      expect(events[1]).toMatchObject({
        containerId: 'build-002',
        taskId: 'build',
        exitCode: 130,
        signal: 'SIGINT',
        oomKilled: false,
      });

      // Verify E2E test OOM kill
      expect(events[2]).toMatchObject({
        containerId: 'build-003',
        taskId: 'test',
        exitCode: 137,
        signal: 'SIGKILL',
        oomKilled: true,
      });
    });
  });

  describe('Production Microservice Monitoring', () => {
    it('should monitor production microservices and detect service crashes', async () => {
      await containerManager.startEventsMonitoring({
        namePrefix: 'apex-prod',
        labelFilters: {
          'environment': 'production',
          'apex.managed': 'true',
        }
      });

      const serviceEvents: any[] = [];
      containerManager.on('container:died', (event) => serviceEvents.push(event));

      // Mock service container info
      vi.spyOn(containerManager, 'getContainerInfo')
        .mockResolvedValueOnce({
          id: 'api-svc-001',
          name: 'apex-prod-api-gateway',
          image: 'my-api:v1.2.3',
          status: 'exited',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'db-svc-001',
          name: 'apex-prod-user-service',
          image: 'my-user-svc:v2.1.0',
          status: 'exited',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'cache-001',
          name: 'apex-prod-redis-cache',
          image: 'redis:7-alpine',
          status: 'exited',
          createdAt: new Date(),
        });

      // Simulate production service failures
      const prodEvents = [
        {
          // API Gateway crashes due to unhandled exception
          status: 'die',
          id: 'api-svc-001',
          Actor: {
            Attributes: {
              name: 'apex-prod-api-gateway',
              image: 'my-api:v1.2.3',
              exitCode: '1',
              'environment': 'production',
            }
          },
          time: 1640995300,
        },
        {
          // User service OOM killed
          status: 'die',
          id: 'db-svc-001',
          Actor: {
            Attributes: {
              name: 'apex-prod-user-service',
              image: 'my-user-svc:v2.1.0',
              exitCode: '137',
              oomkilled: 'true',
              'environment': 'production',
            }
          },
          time: 1640995310,
        },
        {
          // Redis cache gracefully shutdown
          status: 'die',
          id: 'cache-001',
          Actor: {
            Attributes: {
              name: 'apex-prod-redis-cache',
              image: 'redis:7-alpine',
              exitCode: '0',
              signal: 'SIGTERM',
              'environment': 'production',
            }
          },
          time: 1640995320,
        },
      ];

      for (const event of prodEvents) {
        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(serviceEvents).toHaveLength(3);

      // Verify API Gateway crash
      expect(serviceEvents[0]).toMatchObject({
        taskId: 'api',
        exitCode: 1,
        oomKilled: false,
      });

      // Verify User Service OOM
      expect(serviceEvents[1]).toMatchObject({
        taskId: 'user',
        exitCode: 137,
        oomKilled: true,
      });

      // Verify Redis graceful shutdown
      expect(serviceEvents[2]).toMatchObject({
        taskId: 'redis',
        exitCode: 0,
        signal: 'SIGTERM',
        oomKilled: false,
      });
    });
  });

  describe('Development Environment Container Lifecycle', () => {
    it('should monitor development containers with frequent restarts', async () => {
      await containerManager.startEventsMonitoring({
        namePrefix: 'apex-dev',
        eventTypes: ['die', 'start', 'stop'],
      });

      const allEvents: { type: string; data: any }[] = [];

      containerManager.on('container:died', (data) => {
        allEvents.push({ type: 'died', data });
      });

      // Mock development container scenarios
      vi.spyOn(containerManager, 'getContainerInfo')
        .mockResolvedValue({
          id: 'dev-hot-reload',
          name: 'apex-dev-hot-reload-server',
          image: 'node:20-alpine',
          status: 'exited',
          createdAt: new Date(),
        });

      // Simulate rapid development cycle with hot reloads and crashes
      const devEvents = [
        // Hot reload server crashes during file watching
        {
          status: 'die',
          id: 'dev-hot-reload',
          Actor: {
            Attributes: {
              name: 'apex-dev-hot-reload-server',
              exitCode: '1',
            }
          },
          time: 1640995400,
        },
        // Development server crashes due to syntax error
        {
          status: 'die',
          id: 'dev-syntax-error',
          Actor: {
            Attributes: {
              name: 'apex-dev-webpack-server',
              exitCode: '1',
            }
          },
          time: 1640995410,
        },
        // Database development container stopped for maintenance
        {
          status: 'die',
          id: 'dev-db-maintenance',
          Actor: {
            Attributes: {
              name: 'apex-dev-postgres-db',
              exitCode: '0',
              signal: 'SIGTERM',
            }
          },
          time: 1640995420,
        },
      ];

      for (const event of devEvents) {
        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(allEvents.filter(e => e.type === 'died')).toHaveLength(3);

      const diedEvents = allEvents.filter(e => e.type === 'died').map(e => e.data);

      // Hot reload server crash
      expect(diedEvents[0]).toMatchObject({
        taskId: 'hot',
        exitCode: 1,
      });

      // Webpack server crash
      expect(diedEvents[1]).toMatchObject({
        taskId: 'webpack',
        exitCode: 1,
      });

      // Database graceful stop
      expect(diedEvents[2]).toMatchObject({
        taskId: 'postgres',
        exitCode: 0,
        signal: 'SIGTERM',
      });
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should detect various resource-related container deaths', async () => {
      await containerManager.startEventsMonitoring();

      const resourceEvents: any[] = [];
      containerManager.on('container:died', (event) => resourceEvents.push(event));

      vi.spyOn(containerManager, 'getContainerInfo')
        .mockResolvedValue(null);

      // Simulate different resource exhaustion scenarios
      const resourceFailures = [
        {
          // Memory limit exceeded
          status: 'die',
          id: 'memory-exceeded',
          Actor: {
            Attributes: {
              name: 'apex-memory-intensive-task',
              exitCode: '137',
              oomkilled: 'true',
              reason: 'oom',
            }
          },
          time: 1640995500,
        },
        {
          // Process limit exceeded
          status: 'die',
          id: 'process-limit',
          Actor: {
            Attributes: {
              name: 'apex-fork-bomb-protection',
              exitCode: '1',
              reason: 'process-limit-exceeded',
            }
          },
          time: 1640995510,
        },
        {
          // Disk space exhausted
          status: 'die',
          id: 'disk-full',
          Actor: {
            Attributes: {
              name: 'apex-log-aggregator',
              exitCode: '1',
              reason: 'no-space-left',
            }
          },
          time: 1640995520,
        },
        {
          // Network quota exceeded (custom reason)
          status: 'die',
          id: 'network-quota',
          Actor: {
            Attributes: {
              name: 'apex-data-transfer',
              exitCode: '1',
              reason: 'network-quota-exceeded',
            }
          },
          time: 1640995530,
        },
      ];

      for (const event of resourceFailures) {
        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(resourceEvents).toHaveLength(4);

      // Memory OOM kill
      expect(resourceEvents[0]).toMatchObject({
        taskId: 'memory',
        exitCode: 137,
        oomKilled: true,
      });

      // Process limit
      expect(resourceEvents[1]).toMatchObject({
        taskId: 'fork',
        exitCode: 1,
        oomKilled: false,
      });

      // Disk full
      expect(resourceEvents[2]).toMatchObject({
        taskId: 'log',
        exitCode: 1,
      });

      // Network quota
      expect(resourceEvents[3]).toMatchObject({
        taskId: 'data',
        exitCode: 1,
      });
    });
  });

  describe('Multi-Runtime Environment', () => {
    it('should handle mixed Docker and Podman environments', async () => {
      // Start monitoring with Docker
      await containerManager.startEventsMonitoring();

      const mixedEvents: any[] = [];
      containerManager.on('container:died', (event) => mixedEvents.push(event));

      vi.spyOn(containerManager, 'getContainerInfo')
        .mockResolvedValue(null);

      // Docker event
      const dockerEvent = {
        status: 'die',
        id: 'docker-container',
        Actor: {
          Attributes: {
            name: 'apex-docker-workload',
            exitCode: '0',
          }
        },
        time: 1640995600,
      };

      mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(dockerEvent) + '\n'));
      await new Promise(resolve => setTimeout(resolve, 10));

      // Switch to Podman monitoring
      await containerManager.stopEventsMonitoring();
      mockRuntime.getBestRuntime.mockResolvedValue('podman');
      await containerManager.startEventsMonitoring();

      // Podman event (different format)
      const podmanEvent = {
        Action: 'died', // Podman uses Action
        ID: 'podman-container',
        Actor: {
          Attributes: {
            name: 'apex-podman-workload',
            exitCode: '1',
          }
        },
        timeNano: 1640995610000000000, // Podman uses nanoseconds
      };

      mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(podmanEvent) + '\n'));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mixedEvents).toHaveLength(2);

      // Docker event
      expect(mixedEvents[0]).toMatchObject({
        taskId: 'docker',
        exitCode: 0,
      });

      // Podman event
      expect(mixedEvents[1]).toMatchObject({
        taskId: 'podman',
        exitCode: 1,
      });

      // Verify runtime-specific command usage
      expect(mockSpawn).toHaveBeenCalledWith('docker', expect.any(Array), expect.any(Object));
      expect(mockSpawn).toHaveBeenCalledWith('podman', expect.any(Array), expect.any(Object));
    });
  });

  describe('Long-Running Monitoring Session', () => {
    it('should handle extended monitoring sessions with periodic events', async () => {
      await containerManager.startEventsMonitoring();

      const sessionEvents: { timestamp: Date; exitCode: number }[] = [];
      containerManager.on('container:died', (event) => {
        sessionEvents.push({
          timestamp: event.timestamp,
          exitCode: event.exitCode,
        });
      });

      vi.spyOn(containerManager, 'getContainerInfo')
        .mockResolvedValue(null);

      // Simulate periodic events over time
      const periodicEvents = [];
      const baseTime = 1640995700;

      for (let i = 0; i < 50; i++) {
        periodicEvents.push({
          status: 'die',
          id: `periodic-container-${i}`,
          Actor: {
            Attributes: {
              name: `apex-periodic-task-${i}`,
              exitCode: (i % 3 === 0) ? '1' : '0', // Every 3rd task fails
            }
          },
          time: baseTime + (i * 60), // One event per minute
        });
      }

      // Send events in batches to simulate real-world timing
      const batchSize = 5;
      for (let i = 0; i < periodicEvents.length; i += batchSize) {
        const batch = periodicEvents.slice(i, i + batchSize);
        const batchData = batch.map(e => JSON.stringify(e)).join('\n') + '\n';

        mockProcess.stdout!.emit('data', Buffer.from(batchData));
        await new Promise(resolve => setTimeout(resolve, 20)); // Small delay between batches
      }

      expect(sessionEvents).toHaveLength(50);

      // Verify events are processed in order
      for (let i = 0; i < sessionEvents.length - 1; i++) {
        expect(sessionEvents[i].timestamp.getTime()).toBeLessThanOrEqual(
          sessionEvents[i + 1].timestamp.getTime()
        );
      }

      // Verify failure pattern (every 3rd task fails)
      const failedTasks = sessionEvents.filter(e => e.exitCode === 1);
      expect(failedTasks).toHaveLength(17); // 50/3 rounded up = 17
    });
  });

  describe('Container Restart and Recovery', () => {
    it('should track container death and subsequent restart attempts', async () => {
      await containerManager.startEventsMonitoring();

      const restartCycle: { operation: string; containerId: string; timestamp: Date }[] = [];

      containerManager.on('container:died', (event) => {
        restartCycle.push({
          operation: 'died',
          containerId: event.containerId,
          timestamp: event.timestamp,
        });
      });

      vi.spyOn(containerManager, 'getContainerInfo')
        .mockResolvedValue(null);

      // Simulate a service that keeps crashing and getting restarted
      const crashRestartCycle = [
        // Initial crash
        {
          status: 'die',
          id: 'unstable-service-v1',
          Actor: {
            Attributes: {
              name: 'apex-unstable-web-service',
              exitCode: '1',
            }
          },
          time: 1640996000,
        },
        // First restart attempt crashes quickly
        {
          status: 'die',
          id: 'unstable-service-v2',
          Actor: {
            Attributes: {
              name: 'apex-unstable-web-service',
              exitCode: '1',
            }
          },
          time: 1640996010,
        },
        // Second restart attempt also crashes
        {
          status: 'die',
          id: 'unstable-service-v3',
          Actor: {
            Attributes: {
              name: 'apex-unstable-web-service',
              exitCode: '1',
            }
          },
          time: 1640996030,
        },
        // Third attempt killed due to taking too long
        {
          status: 'die',
          id: 'unstable-service-v4',
          Actor: {
            Attributes: {
              name: 'apex-unstable-web-service',
              exitCode: '137',
              signal: 'SIGKILL',
            }
          },
          time: 1640996100,
        },
        // Finally successful (graceful shutdown)
        {
          status: 'die',
          id: 'unstable-service-v5',
          Actor: {
            Attributes: {
              name: 'apex-unstable-web-service',
              exitCode: '0',
              signal: 'SIGTERM',
            }
          },
          time: 1640996500,
        },
      ];

      for (const event of crashRestartCycle) {
        mockProcess.stdout!.emit('data', Buffer.from(JSON.stringify(event) + '\n'));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(restartCycle).toHaveLength(5);

      // Verify crash pattern
      expect(restartCycle[0]).toMatchObject({
        operation: 'died',
        containerId: 'unstable-service-v1',
      });
      expect(restartCycle[1]).toMatchObject({
        operation: 'died',
        containerId: 'unstable-service-v2',
      });
      expect(restartCycle[4]).toMatchObject({
        operation: 'died',
        containerId: 'unstable-service-v5',
      });

      // Verify timing - restarts should be getting slower (backoff)
      const timeBetweenEvents = [];
      for (let i = 1; i < restartCycle.length; i++) {
        timeBetweenEvents.push(
          restartCycle[i].timestamp.getTime() - restartCycle[i-1].timestamp.getTime()
        );
      }

      // Should show increasing time between attempts (except the successful one)
      expect(timeBetweenEvents[0]).toBe(10000); // 10 seconds
      expect(timeBetweenEvents[1]).toBe(20000); // 20 seconds
      expect(timeBetweenEvents[2]).toBe(70000); // 70 seconds
    });
  });
});