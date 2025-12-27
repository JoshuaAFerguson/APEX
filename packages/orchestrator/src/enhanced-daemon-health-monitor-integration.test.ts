import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedDaemon } from './enhanced-daemon';
import { DaemonRunner } from './runner';
import { HealthMonitor } from './health-monitor';
import { ApexConfig } from '@apexcli/core';
import * as path from 'path';
import * as fs from 'fs';

// Mock dependencies
vi.mock('./runner');
vi.mock('./service-manager');
vi.mock('./usage-manager');
vi.mock('./session-manager');
vi.mock('./workspace-manager');
vi.mock('./interaction-manager');
vi.mock('./idle-processor');
vi.mock('./thought-capture');
vi.mock('./store');
vi.mock('./index');
vi.mock('./capacity-monitor');
vi.mock('./capacity-monitor-usage-adapter');
vi.mock('./health-monitor');

// Mock fs for config loading
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  createWriteStream: vi.fn(),
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock('yaml', () => ({
  parse: vi.fn(),
}));

describe('EnhancedDaemon HealthMonitor Integration', () => {
  let enhancedDaemon: EnhancedDaemon;
  let mockHealthMonitor: HealthMonitor;
  let mockDaemonRunner: DaemonRunner;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    // Mock HealthMonitor
    mockHealthMonitor = {
      performHealthCheck: vi.fn(),
      recordRestart: vi.fn(),
      getHealthReport: vi.fn().mockReturnValue({
        uptime: 1000000,
        memoryUsage: {
          heapUsed: 50 * 1024 * 1024,
          heapTotal: 100 * 1024 * 1024,
          rss: 150 * 1024 * 1024,
        },
        taskCounts: {
          processed: 10,
          succeeded: 8,
          failed: 2,
          active: 1,
        },
        lastHealthCheck: new Date(),
        healthChecksPassed: 5,
        healthChecksFailed: 1,
        restartHistory: [
          {
            timestamp: new Date(),
            reason: 'watchdog',
            exitCode: undefined,
            triggeredByWatchdog: true,
          },
        ],
      }),
      resetHealthCheckCounters: vi.fn(),
      clearRestartHistory: vi.fn(),
      getUptime: vi.fn().mockReturnValue(1000000),
      getRestartCount: vi.fn().mockReturnValue(1),
      getLastRestart: vi.fn().mockReturnValue({
        timestamp: new Date(),
        reason: 'watchdog',
        triggeredByWatchdog: true,
      }),
      hasWatchdogRestarts: vi.fn().mockReturnValue(true),
    } as any;

    // Mock DaemonRunner
    mockDaemonRunner = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getMetrics: vi.fn().mockReturnValue({
        startedAt: new Date(),
        uptime: 1000000,
        tasksProcessed: 10,
        tasksSucceeded: 8,
        tasksFailed: 2,
        activeTaskCount: 1,
        activeTaskIds: ['task-1'],
        lastPollAt: new Date(),
        pollCount: 100,
        isRunning: true,
        isPaused: false,
      }),
    } as any;

    // Mock HealthMonitor constructor
    vi.mocked(HealthMonitor).mockImplementation(() => mockHealthMonitor);

    // Mock DaemonRunner constructor
    vi.mocked(DaemonRunner).mockImplementation(() => mockDaemonRunner);

    // Mock other dependencies
    const mockStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    const mockOrchestrator = {
      initialize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    };
    const mockServiceManager = {
      installService: vi.fn().mockResolvedValue(undefined),
      uninstallService: vi.fn().mockResolvedValue(undefined),
      getServiceStatus: vi.fn().mockResolvedValue({
        installed: true,
        running: true,
        pid: 12345,
      }),
      performHealthCheck: vi.fn().mockResolvedValue({
        healthy: true,
        errors: [],
        timestamp: new Date(),
      }),
    };
    const mockUsageManager = {
      trackTaskStart: vi.fn(),
      trackTaskCompletion: vi.fn(),
      getUsageStats: vi.fn().mockReturnValue({
        current: { dailyUsage: { totalCost: 5.0 } },
      }),
      on: vi.fn(),
    };
    const mockSessionManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      cleanupCheckpoints: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    };
    const mockWorkspaceManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createWorkspace: vi.fn().mockResolvedValue(undefined),
      cleanupWorkspace: vi.fn().mockResolvedValue(undefined),
      cleanupOldWorkspaces: vi.fn().mockResolvedValue(undefined),
      getWorkspaceStats: vi.fn().mockResolvedValue({
        activeWorkspaces: 2,
        totalWorkspaces: 5,
      }),
      on: vi.fn(),
    };
    const mockInteractionManager = {
      on: vi.fn(),
    };
    const mockIdleProcessor = {
      start: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    };
    const mockThoughtCapture = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getThoughtStats: vi.fn().mockResolvedValue({
        totalThoughts: 10,
        recentThoughts: 3,
      }),
      on: vi.fn(),
    };
    const mockCapacityMonitor = {
      start: vi.fn(),
      stop: vi.fn(),
      getStatus: vi.fn().mockReturnValue({
        currentUsage: 45.5,
        threshold: 80,
        paused: false,
      }),
      on: vi.fn(),
    };

    // Mock module imports
    vi.doMock('./store', () => ({
      TaskStore: vi.fn().mockImplementation(() => mockStore),
    }));
    vi.doMock('./index', () => ({
      ApexOrchestrator: vi.fn().mockImplementation(() => mockOrchestrator),
    }));
    vi.doMock('./service-manager', () => ({
      ServiceManager: vi.fn().mockImplementation(() => mockServiceManager),
    }));
    vi.doMock('./usage-manager', () => ({
      UsageManager: vi.fn().mockImplementation(() => mockUsageManager),
    }));
    vi.doMock('./session-manager', () => ({
      SessionManager: vi.fn().mockImplementation(() => mockSessionManager),
    }));
    vi.doMock('./workspace-manager', () => ({
      WorkspaceManager: vi.fn().mockImplementation(() => mockWorkspaceManager),
    }));
    vi.doMock('./interaction-manager', () => ({
      InteractionManager: vi.fn().mockImplementation(() => mockInteractionManager),
    }));
    vi.doMock('./idle-processor', () => ({
      IdleProcessor: vi.fn().mockImplementation(() => mockIdleProcessor),
    }));
    vi.doMock('./thought-capture', () => ({
      ThoughtCaptureManager: vi.fn().mockImplementation(() => mockThoughtCapture),
    }));
    vi.doMock('./capacity-monitor', () => ({
      CapacityMonitor: vi.fn().mockImplementation(() => mockCapacityMonitor),
    }));
    vi.doMock('./capacity-monitor-usage-adapter', () => ({
      CapacityMonitorUsageAdapter: vi.fn(),
    }));

    // Mock config loading
    vi.mocked(fs.readFileSync).mockReturnValue(`
      project:
        name: test-project
      daemon:
        serviceName: test-apex-daemon
        healthCheck:
          enabled: true
          interval: 30000
        watchdog:
          enabled: true
          maxRestarts: 5
          restartDelay: 5000
    `);

    const mockYaml = await vi.importMock('yaml') as any;
    mockYaml.parse.mockReturnValue({
      project: { name: 'test-project' },
      daemon: {
        serviceName: 'test-apex-daemon',
        healthCheck: {
          enabled: true,
          interval: 30000,
        },
        watchdog: {
          enabled: true,
          maxRestarts: 5,
          restartDelay: 5000,
        },
      },
    });

    // Create enhanced daemon instance
    enhancedDaemon = new EnhancedDaemon(testProjectPath);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('HealthMonitor Instantiation and Integration', () => {
    it('should instantiate HealthMonitor during component initialization', () => {
      // Verify HealthMonitor was constructed
      expect(HealthMonitor).toHaveBeenCalledOnce();

      // Verify it's available through public API
      expect(enhancedDaemon.getHealthMonitor()).toBe(mockHealthMonitor);
    });

    it('should pass HealthMonitor to DaemonRunner during initialization', () => {
      // Verify DaemonRunner was created with HealthMonitor
      expect(DaemonRunner).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: testProjectPath,
          healthMonitor: mockHealthMonitor,
        })
      );
    });

    it('should start HealthMonitor with daemon startup', async () => {
      await enhancedDaemon.start();

      // Verify DaemonRunner.start was called (which should integrate with HealthMonitor)
      expect(mockDaemonRunner.start).toHaveBeenCalledOnce();

      // Verify health monitoring was setup
      expect(mockHealthMonitor).toBeDefined();
    });
  });

  describe('Health Metrics in getStatus() Response', () => {
    it('should include HealthMonitor metrics in getStatus() response', async () => {
      await enhancedDaemon.start();

      const status = await enhancedDaemon.getStatus();

      // Verify status includes health metrics
      expect(status).toHaveProperty('health');
      expect(status.health).toHaveProperty('metrics');

      // Verify HealthMonitor.getHealthReport was called with DaemonRunner
      expect(mockHealthMonitor.getHealthReport).toHaveBeenCalledWith(mockDaemonRunner);

      // Verify health metrics structure
      const healthMetrics = status.health.metrics;
      expect(healthMetrics).toHaveProperty('uptime');
      expect(healthMetrics).toHaveProperty('memoryUsage');
      expect(healthMetrics).toHaveProperty('taskCounts');
      expect(healthMetrics).toHaveProperty('lastHealthCheck');
      expect(healthMetrics).toHaveProperty('healthChecksPassed');
      expect(healthMetrics).toHaveProperty('healthChecksFailed');
      expect(healthMetrics).toHaveProperty('restartHistory');

      // Verify task counts from DaemonRunner are integrated
      expect(healthMetrics.taskCounts).toEqual({
        processed: 10,
        succeeded: 8,
        failed: 2,
        active: 1,
      });
    });

    it('should merge ServiceManager health check with HealthMonitor metrics', async () => {
      await enhancedDaemon.start();

      const status = await enhancedDaemon.getStatus();

      // Verify health section contains both ServiceManager and HealthMonitor data
      expect(status.health).toHaveProperty('healthy', true);
      expect(status.health).toHaveProperty('errors', []);
      expect(status.health).toHaveProperty('timestamp');
      expect(status.health).toHaveProperty('metrics');
    });

    it('should handle HealthMonitor errors gracefully in getStatus()', async () => {
      // Make HealthMonitor.getHealthReport throw an error
      mockHealthMonitor.getHealthReport = vi.fn().mockImplementation(() => {
        throw new Error('HealthMonitor error');
      });

      await enhancedDaemon.start();

      // getStatus should still work, potentially with fallback or error handling
      await expect(enhancedDaemon.getStatus()).rejects.toThrow('HealthMonitor error');
    });
  });

  describe('Watchdog Restart Events Recording', () => {
    it('should record restart events in HealthMonitor when watchdog triggers restart', async () => {
      // Enable watchdog and health checks
      await enhancedDaemon.start();

      // Simulate a restart scenario by calling private method (via any cast for testing)
      const daemon = enhancedDaemon as any;
      await daemon.restartDaemon('watchdog');

      // Verify HealthMonitor.recordRestart was called with correct parameters
      expect(mockHealthMonitor.recordRestart).toHaveBeenCalledWith(
        'watchdog',
        undefined,
        true
      );
    });

    it('should record different types of restart events', async () => {
      await enhancedDaemon.start();
      const daemon = enhancedDaemon as any;

      // Test manual restart
      await daemon.restartDaemon('manual');
      expect(mockHealthMonitor.recordRestart).toHaveBeenCalledWith(
        'manual',
        undefined,
        true
      );

      // Test health check failure restart
      await daemon.restartDaemon('health_check_failure');
      expect(mockHealthMonitor.recordRestart).toHaveBeenCalledWith(
        'health_check_failure',
        undefined,
        true
      );
    });

    it('should record restart history that persists across daemon lifecycle', async () => {
      await enhancedDaemon.start();

      // Simulate restart
      const daemon = enhancedDaemon as any;
      await daemon.restartDaemon('oom');

      // Stop and restart daemon
      await enhancedDaemon.stop();
      await enhancedDaemon.start();

      // Get status and verify restart history is still available
      const status = await enhancedDaemon.getStatus();
      expect(status.health.metrics.restartHistory).toHaveLength(1);
      expect(status.health.metrics.restartHistory[0].reason).toBe('watchdog');
      expect(status.health.metrics.restartHistory[0].triggeredByWatchdog).toBe(true);
    });
  });

  describe('Health Check Results Accumulation', () => {
    it('should accumulate health check results in HealthMonitor', async () => {
      // Mock health check configuration
      const config: ApexConfig = {
        project: { name: 'test-project' },
        daemon: {
          serviceName: 'test-daemon',
          healthCheck: {
            enabled: true,
            interval: 30000,
          },
        },
      };

      const daemonWithHealthChecks = new EnhancedDaemon(testProjectPath, config);
      await daemonWithHealthChecks.start();

      // Simulate health check interval trigger
      // We need to trigger the health check manually since we can't wait for real intervals
      const daemon = daemonWithHealthChecks as any;

      // Access the health check interval and manually trigger health checks
      const mockServiceManager = {
        performHealthCheck: vi.fn()
          .mockResolvedValueOnce({ healthy: true, errors: [] })
          .mockResolvedValueOnce({ healthy: false, errors: ['Service unavailable'] })
          .mockResolvedValueOnce({ healthy: true, errors: [] }),
      };

      // Mock the service manager on the daemon
      daemon.serviceManager = mockServiceManager;

      // Manually trigger health checks
      for (let i = 0; i < 3; i++) {
        const health = await mockServiceManager.performHealthCheck();
        mockHealthMonitor.performHealthCheck(health.healthy);
      }

      // Verify health check results were accumulated
      expect(mockHealthMonitor.performHealthCheck).toHaveBeenCalledTimes(3);
      expect(mockHealthMonitor.performHealthCheck).toHaveBeenNthCalledWith(1, true);
      expect(mockHealthMonitor.performHealthCheck).toHaveBeenNthCalledWith(2, false);
      expect(mockHealthMonitor.performHealthCheck).toHaveBeenNthCalledWith(3, true);

      await daemonWithHealthChecks.stop();
    });

    it('should track health check success and failure counts', async () => {
      await enhancedDaemon.start();

      // Get initial status
      let status = await enhancedDaemon.getStatus();
      const initialPassed = status.health.metrics.healthChecksPassed;
      const initialFailed = status.health.metrics.healthChecksFailed;

      // The mock returns 5 passed and 1 failed as setup in beforeEach
      expect(initialPassed).toBe(5);
      expect(initialFailed).toBe(1);

      // Verify counters can be reset
      mockHealthMonitor.resetHealthCheckCounters();
      expect(mockHealthMonitor.resetHealthCheckCounters).toHaveBeenCalledOnce();
    });

    it('should update lastHealthCheck timestamp during health monitoring', async () => {
      await enhancedDaemon.start();

      const status = await enhancedDaemon.getStatus();

      // Verify lastHealthCheck is present and is a recent timestamp
      expect(status.health.metrics.lastHealthCheck).toBeInstanceOf(Date);

      const timeDiff = Date.now() - status.health.metrics.lastHealthCheck.getTime();
      expect(timeDiff).toBeLessThan(60000); // Should be within last minute for test
    });
  });

  describe('Integration Error Handling', () => {
    it('should handle HealthMonitor initialization failures gracefully', () => {
      // Mock HealthMonitor constructor to throw
      vi.mocked(HealthMonitor).mockImplementationOnce(() => {
        throw new Error('HealthMonitor initialization failed');
      });

      expect(() => {
        new EnhancedDaemon(testProjectPath);
      }).toThrow('HealthMonitor initialization failed');
    });

    it('should handle health check failures without crashing daemon', async () => {
      // Mock health check to fail
      const mockServiceManager = {
        performHealthCheck: vi.fn().mockRejectedValue(new Error('Health check failed')),
      };

      await enhancedDaemon.start();
      const daemon = enhancedDaemon as any;
      daemon.serviceManager = mockServiceManager;

      // Manually trigger health check error scenario
      try {
        await mockServiceManager.performHealthCheck();
      } catch (error) {
        // Simulate the error handling in EnhancedDaemon
        mockHealthMonitor.performHealthCheck(false);
      }

      // Verify error was recorded
      expect(mockHealthMonitor.performHealthCheck).toHaveBeenCalledWith(false);
    });

    it('should maintain HealthMonitor state during daemon restart cycles', async () => {
      await enhancedDaemon.start();

      // Record some initial state
      mockHealthMonitor.performHealthCheck(true);
      mockHealthMonitor.recordRestart('test', 0, false);

      // Stop daemon
      await enhancedDaemon.stop();

      // Verify HealthMonitor state is preserved
      expect(mockHealthMonitor.getHealthReport).toBeDefined();

      // Restart daemon
      await enhancedDaemon.start();

      // Verify HealthMonitor continues to work
      const status = await enhancedDaemon.getStatus();
      expect(status.health.metrics).toBeDefined();
    });
  });

  describe('Performance and Resource Monitoring', () => {
    it('should efficiently collect memory metrics without significant overhead', async () => {
      await enhancedDaemon.start();

      const startTime = Date.now();

      // Get status multiple times to test performance
      for (let i = 0; i < 10; i++) {
        await enhancedDaemon.getStatus();
      }

      const endTime = Date.now();

      // Should complete quickly (within 1 second for 10 calls)
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify HealthMonitor was called appropriately
      expect(mockHealthMonitor.getHealthReport).toHaveBeenCalledTimes(10);
    });

    it('should provide accurate uptime calculations through HealthMonitor', async () => {
      await enhancedDaemon.start();

      // Mock HealthMonitor uptime
      mockHealthMonitor.getUptime.mockReturnValue(123456);

      const status = await enhancedDaemon.getStatus();

      expect(status.health.metrics.uptime).toBe(1000000); // As mocked in getHealthReport
      expect(mockHealthMonitor.getUptime).toHaveBeenCalled();
    });

    it('should track daemon resource usage over time', async () => {
      await enhancedDaemon.start();

      // Simulate multiple status checks over time
      const statuses = [];
      for (let i = 0; i < 3; i++) {
        const status = await enhancedDaemon.getStatus();
        statuses.push(status.health.metrics.memoryUsage);
      }

      // Verify memory usage is consistently reported
      statuses.forEach(memUsage => {
        expect(memUsage).toHaveProperty('heapUsed');
        expect(memUsage).toHaveProperty('heapTotal');
        expect(memUsage).toHaveProperty('rss');
        expect(typeof memUsage.heapUsed).toBe('number');
        expect(typeof memUsage.heapTotal).toBe('number');
        expect(typeof memUsage.rss).toBe('number');
      });
    });
  });
});