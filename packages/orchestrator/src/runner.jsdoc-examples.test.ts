import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DaemonRunner, type DaemonRunnerOptions, type DaemonMetrics, type DaemonLogEntry } from './runner';

// Mock dependencies to test JSDoc examples
vi.mock('fs', () => ({
  createWriteStream: vi.fn(() => ({
    write: vi.fn(),
    end: vi.fn((callback?: () => void) => callback?.()),
    destroyed: false,
  })),
}));

vi.mock('./index', () => ({
  ApexOrchestrator: vi.fn(() => ({
    initialize: vi.fn(),
    shutdown: vi.fn(),
    executeTask: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn(() => ({
    initialize: vi.fn(),
    close: vi.fn(),
    getNextQueuedTask: vi.fn(() => null),
  })),
}));

vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn(() => Promise.resolve({})),
  getEffectiveConfig: vi.fn(() => ({
    limits: { maxConcurrentTasks: 3 },
    daemon: {},
  })),
}));

vi.mock('./usage-manager', () => ({
  UsageManager: vi.fn(() => ({})),
}));

vi.mock('./daemon-scheduler', () => ({
  DaemonScheduler: vi.fn(() => ({
    shouldPauseTasks: vi.fn(() => ({ shouldPause: false })),
  })),
  UsageManagerProvider: vi.fn(() => ({})),
}));

vi.mock('./capacity-monitor', () => ({
  CapacityMonitor: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    on: vi.fn(),
  })),
}));

vi.mock('./capacity-monitor-usage-adapter', () => ({
  CapacityMonitorUsageAdapter: vi.fn(() => ({})),
}));

/**
 * Tests that validate the JSDoc examples actually work as documented
 */
describe('JSDoc Examples Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('DaemonRunner Class Examples', () => {
    it('should work as shown in the basic daemon setup example', async () => {
      // This is exactly from the JSDoc example
      const daemon = new DaemonRunner({
        projectPath: '/path/to/apex/project',
        pollIntervalMs: 5000,
        maxConcurrentTasks: 3,
        logLevel: 'info'
      });

      // Start the daemon (as shown in example)
      await daemon.start();

      // Monitor metrics (as shown in example)
      const metrics = daemon.getMetrics();
      expect(metrics.tasksProcessed).toBeDefined();
      expect(metrics.activeTaskCount).toBeDefined();

      // Stop gracefully (as shown in example)
      await daemon.stop();

      expect(metrics.isRunning).toBe(false);
    });

    it('should support advanced setup with health monitoring example', () => {
      // Create a mock health monitor
      const healthMonitor = {
        getHealthReport: vi.fn(() => ({
          uptime: 1000,
          memoryUsage: { used: 100, total: 1000 },
          taskCounts: { running: 1, completed: 5 },
          lastHealthCheck: new Date(),
          healthChecksPassed: 10,
          healthChecksFailed: 0,
          restartHistory: [],
        })),
      };

      // This follows the JSDoc example structure
      const daemon = new DaemonRunner({
        projectPath: '/path/to/apex/project',
        healthMonitor,
        logToStdout: true
      });

      expect(daemon).toBeInstanceOf(DaemonRunner);

      // Check service status (as shown in example)
      const { api, webui } = daemon.hasServicesRunning();
      expect(typeof api).toBe('boolean');
      expect(typeof webui).toBe('boolean');
    });
  });

  describe('start() Method Examples', () => {
    it('should demonstrate proper error handling as shown in JSDoc', async () => {
      const daemon = new DaemonRunner({
        projectPath: '/path/to/project',
        pollIntervalMs: 3000,
        maxConcurrentTasks: 2
      });

      let errorCaught = false;
      try {
        await daemon.start();
        // console.log('Daemon started successfully'); // Would be in real usage
      } catch (error) {
        errorCaught = true;
        // console.error('Failed to start daemon:', error.message); // Would be in real usage
      }

      // First start should succeed (with mocked dependencies)
      expect(errorCaught).toBe(false);

      // Second start should throw error as documented
      errorCaught = false;
      try {
        await daemon.start(); // Should throw "already running" error
      } catch (error) {
        errorCaught = true;
        expect((error as Error).message).toContain('already running');
      }

      expect(errorCaught).toBe(true);
      await daemon.stop();
    });
  });

  describe('stop() Method Examples', () => {
    it('should demonstrate basic graceful stop', async () => {
      const daemon = new DaemonRunner({
        projectPath: '/test/project'
      });

      await daemon.start();

      // Basic graceful stop (as shown in JSDoc)
      await daemon.stop();
      // console.log('Daemon stopped gracefully'); // Would be in real usage

      const metrics = daemon.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });

    it('should handle monitoring of running tasks during stop', async () => {
      const daemon = new DaemonRunner({
        projectPath: '/test/project',
        maxConcurrentTasks: 2
      });

      await daemon.start();

      // Simulate the monitoring pattern from JSDoc
      const metrics = daemon.getMetrics();
      if (metrics.activeTaskCount > 0) {
        // console.log(`Stopping daemon with ${metrics.activeTaskCount} active tasks...`);
        await daemon.stop();
      } else {
        await daemon.stop();
      }

      expect(metrics.isRunning).toBe(false);
    });
  });

  describe('getMetrics() Method Examples', () => {
    it('should provide all metrics shown in the first JSDoc example', async () => {
      const daemon = new DaemonRunner({
        projectPath: '/test/project'
      });

      await daemon.start();

      // This follows the exact pattern from JSDoc
      const metrics = daemon.getMetrics();

      expect(metrics.isRunning).toBeDefined();
      expect(metrics.uptime).toBeDefined();
      expect(metrics.tasksProcessed).toBeDefined();
      expect(metrics.tasksSucceeded).toBeDefined();
      expect(metrics.activeTaskCount).toBeDefined();

      // Verify the structure matches what's documented
      expect(typeof metrics.isRunning).toBe('boolean');
      expect(typeof metrics.uptime).toBe('number');
      expect(typeof metrics.tasksProcessed).toBe('number');

      if (metrics.isPaused) {
        expect(typeof metrics.pauseReason).toBe('string');
      }

      await daemon.stop();
    });

    it('should support the periodic monitoring pattern from JSDoc', async () => {
      const daemon = new DaemonRunner({
        projectPath: '/test/project'
      });

      await daemon.start();

      // Simulate the monitoring pattern from the second JSDoc example
      const metrics = daemon.getMetrics();
      if (metrics.activeTaskCount === 0 && metrics.tasksProcessed > 0) {
        // console.log('Daemon idle - all tasks completed');
      }

      // Even with no tasks processed, should work
      expect(metrics.activeTaskCount).toBe(0);
      expect(metrics.tasksProcessed).toBeGreaterThanOrEqual(0);

      await daemon.stop();
    });
  });

  describe('Interface Usage Examples', () => {
    it('should demonstrate proper DaemonRunnerOptions usage', () => {
      // Test the interface as documented
      const options: DaemonRunnerOptions = {
        projectPath: '/path/to/project',
        pollIntervalMs: 5000,
        maxConcurrentTasks: 3,
        logFile: '/custom/daemon.log',
        logToStdout: true,
        logLevel: 'debug'
      };

      const daemon = new DaemonRunner(options);
      expect(daemon).toBeInstanceOf(DaemonRunner);
    });

    it('should demonstrate DaemonMetrics interface structure', async () => {
      const daemon = new DaemonRunner({
        projectPath: '/test/project'
      });

      await daemon.start();

      const metrics: DaemonMetrics = daemon.getMetrics();

      // Verify all documented properties exist
      expect(metrics.startedAt).toBeInstanceOf(Date);
      expect(typeof metrics.uptime).toBe('number');
      expect(typeof metrics.tasksProcessed).toBe('number');
      expect(typeof metrics.tasksSucceeded).toBe('number');
      expect(typeof metrics.tasksFailed).toBe('number');
      expect(typeof metrics.activeTaskCount).toBe('number');
      expect(Array.isArray(metrics.activeTaskIds)).toBe(true);
      expect(typeof metrics.pollCount).toBe('number');
      expect(typeof metrics.isRunning).toBe('boolean');
      expect(typeof metrics.isPaused).toBe('boolean');

      await daemon.stop();
    });

    it('should demonstrate DaemonLogEntry interface structure', () => {
      // Test the structure as documented
      const logEntry: DaemonLogEntry = {
        timestamp: new Date(),
        level: 'info',
        message: 'Test message',
        taskId: 'task-123',
        metadata: {
          custom: 'data'
        }
      };

      expect(logEntry.timestamp).toBeInstanceOf(Date);
      expect(['debug', 'info', 'warn', 'error']).toContain(logEntry.level);
      expect(typeof logEntry.message).toBe('string');
      expect(typeof logEntry.taskId).toBe('string');
      expect(typeof logEntry.metadata).toBe('object');
    });
  });

  describe('Error Scenarios from JSDoc', () => {
    it('should handle initialization failure as documented', async () => {
      // Mock a failure scenario
      const { loadConfig } = await import('@apexcli/core');
      vi.mocked(loadConfig).mockRejectedValueOnce(new Error('Config not found'));

      const daemon = new DaemonRunner({
        projectPath: '/invalid/path'
      });

      let errorThrown = false;
      try {
        await daemon.start();
      } catch (error) {
        errorThrown = true;
        expect((error as Error).message).toContain('Config not found');
      }

      expect(errorThrown).toBe(true);
    });

    it('should demonstrate the "already running" error from JSDoc', async () => {
      const daemon = new DaemonRunner({
        projectPath: '/test/path'
      });

      await daemon.start();

      // This should throw as documented
      await expect(daemon.start()).rejects.toThrow('DaemonRunner is already running');

      await daemon.stop();
    });
  });
});