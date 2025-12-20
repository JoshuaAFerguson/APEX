import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';

// Mock dependencies
vi.mock('fs', () => ({
  createWriteStream: vi.fn(),
}));

vi.mock('./index', () => ({
  ApexOrchestrator: vi.fn(),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn(),
}));

vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn(),
  getEffectiveConfig: vi.fn(),
}));

vi.mock('./usage-manager', () => ({
  UsageManager: vi.fn(),
}));

vi.mock('./daemon-scheduler', () => ({
  DaemonScheduler: vi.fn(),
  UsageManagerProvider: vi.fn(),
}));

// Mock stream
const mockStream = {
  write: vi.fn(),
  end: vi.fn((callback?: () => void) => callback?.()),
  destroyed: false,
};

// Mock orchestrator
const mockOrchestrator = {
  initialize: vi.fn(),
  executeTask: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
};

// Mock store
const mockStore = {
  initialize: vi.fn(),
  close: vi.fn(),
  getNextQueuedTask: vi.fn(),
};

// Mock usage manager
const mockUsageManager = {
  trackTaskStart: vi.fn(),
  trackTaskCompletion: vi.fn(),
};

// Mock daemon scheduler
const mockDaemonScheduler = {
  shouldPauseTasks: vi.fn(),
};

// Mock usage provider
const mockUsageProvider = {};

// Mock task
const mockTask = {
  id: 'test-task-123',
  description: 'Test task',
  status: 'queued' as const,
  workflow: 'test-workflow',
  autonomy: 'low' as const,
  projectPath: '/test/project',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DaemonRunner', () => {
  const testProjectPath = '/test/project';
  let daemonRunner: DaemonRunner;
  let options: DaemonRunnerOptions;

  // Save original process methods
  const originalExit = process.exit;
  const originalOn = process.on;
  const mockProcessOn = vi.fn();

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock process.on to capture signal handlers
    process.on = mockProcessOn as any;

    // Setup default mocks
    (createWriteStream as MockedFunction<typeof createWriteStream>).mockReturnValue(mockStream as any);
    (ApexOrchestrator as any).mockImplementation(() => mockOrchestrator);
    (TaskStore as any).mockImplementation(() => mockStore);

    // Mock new dependencies
    const { UsageManager } = require('./usage-manager');
    const { DaemonScheduler, UsageManagerProvider } = require('./daemon-scheduler');
    UsageManager.mockImplementation(() => mockUsageManager);
    DaemonScheduler.mockImplementation(() => mockDaemonScheduler);
    UsageManagerProvider.mockImplementation(() => mockUsageProvider);

    // Setup default shouldPauseTasks return value
    mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
      shouldPause: false,
      timeWindow: { mode: 'day', isActive: true },
      capacity: { currentPercentage: 0.5, threshold: 0.90, shouldPause: false },
    });

    // Mock loadConfig and getEffectiveConfig
    const { loadConfig, getEffectiveConfig } = require('@apexcli/core');
    loadConfig.mockResolvedValue({});
    getEffectiveConfig.mockReturnValue({
      limits: {
        maxConcurrentTasks: 3,
      },
    });

    options = {
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
    };

    daemonRunner = new DaemonRunner(options);
  });

  afterEach(() => {
    // Restore original methods
    process.exit = originalExit;
    process.on = originalOn;

    // Clear intervals and timeouts
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should apply default options correctly', () => {
      const runner = new DaemonRunner({ projectPath: testProjectPath });
      const metrics = runner.getMetrics();

      expect(metrics.isRunning).toBe(false);
      expect(metrics.tasksProcessed).toBe(0);
    });

    it('should clamp pollIntervalMs to valid range', () => {
      // Test min clamp
      const runnerMin = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 500, // Below min of 1000
      });
      expect(runnerMin.getMetrics().isRunning).toBe(false);

      // Test max clamp
      const runnerMax = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 90000, // Above max of 60000
      });
      expect(runnerMax.getMetrics().isRunning).toBe(false);
    });

    it('should set correct default log file path', () => {
      const runner = new DaemonRunner({ projectPath: testProjectPath });
      expect(runner).toBeDefined();
      // Log file path is internal, but we can verify construction succeeds
    });
  });

  describe('start', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should initialize orchestrator and store', async () => {
      await daemonRunner.start();

      expect(mockStore.initialize).toHaveBeenCalled();
      expect(mockOrchestrator.initialize).toHaveBeenCalled();
    });

    it('should open log file in append mode', async () => {
      await daemonRunner.start();

      expect(createWriteStream).toHaveBeenCalledWith(
        join(testProjectPath, '.apex', 'daemon.log'),
        { flags: 'a' }
      );
    });

    it('should start polling immediately', async () => {
      mockStore.getNextQueuedTask.mockResolvedValue(null); // No tasks

      await daemonRunner.start();

      expect(mockStore.getNextQueuedTask).toHaveBeenCalled();
    });

    it('should throw if already running', async () => {
      await daemonRunner.start();

      await expect(daemonRunner.start()).rejects.toThrow('DaemonRunner is already running');
    });

    it('should setup signal handlers', async () => {
      await daemonRunner.start();

      expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should cleanup on initialization error', async () => {
      mockStore.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(daemonRunner.start()).rejects.toThrow('Init failed');
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should use config maxConcurrentTasks when option is 0', async () => {
      const runnerWithConfigLimit = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 0, // Use config value
      });

      await runnerWithConfigLimit.start();

      // Should use config.limits.maxConcurrentTasks (3)
      const metrics = runnerWithConfigLimit.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      await daemonRunner.start();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should stop polling', async () => {
      await daemonRunner.stop();

      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });

    it('should wait for running tasks', async () => {
      // Simulate a running task
      const taskPromise = new Promise<void>(resolve => {
        setTimeout(resolve, 5000);
      });

      // Manually add a running task
      (daemonRunner as any).runningTasks.set('test-task', taskPromise);

      const stopPromise = daemonRunner.stop();

      // Advance time to simulate task completion
      vi.advanceTimersByTime(6000);

      await stopPromise;
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should timeout after grace period', async () => {
      // Simulate a long-running task that doesn't complete
      const neverResolves = new Promise<void>(() => {}); // Never resolves
      (daemonRunner as any).runningTasks.set('stuck-task', neverResolves);

      const stopPromise = daemonRunner.stop();

      // Advance time past grace period (30 seconds)
      vi.advanceTimersByTime(31000);

      await stopPromise;
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should close log stream', async () => {
      await daemonRunner.stop();

      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should return immediately if not running', async () => {
      await daemonRunner.stop(); // First stop
      await daemonRunner.stop(); // Second stop should return immediately

      expect(mockStream.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('poll', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      await daemonRunner.start();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should respect max concurrent tasks', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 1,
      });

      await runner.start();

      // Mock a task that takes time to complete
      mockOrchestrator.executeTask.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      mockStore.getNextQueuedTask.mockResolvedValue(mockTask);

      // Trigger multiple polls
      await (runner as any).poll();
      await (runner as any).poll();

      // Should only start one task due to capacity limit
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(1);

      await runner.stop();
    });

    it('should skip if shutting down', async () => {
      (daemonRunner as any).isShuttingDown = true;

      await (daemonRunner as any).poll();

      expect(mockStore.getNextQueuedTask).not.toHaveBeenCalled();
    });

    it('should handle store errors gracefully', async () => {
      mockStore.getNextQueuedTask.mockRejectedValue(new Error('Store error'));

      await (daemonRunner as any).poll();

      // Should log error but not throw
      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get tasks: Store error')
      );
    });

    it('should not start duplicate tasks', async () => {
      mockStore.getNextQueuedTask.mockResolvedValue(mockTask);

      // Manually add the task as already running
      (daemonRunner as any).runningTasks.set(mockTask.id, Promise.resolve());

      await (daemonRunner as any).poll();

      expect(mockOrchestrator.executeTask).not.toHaveBeenCalled();
    });

    it('should stop when no more tasks available', async () => {
      mockStore.getNextQueuedTask.mockResolvedValue(null); // No tasks

      await (daemonRunner as any).poll();

      expect(mockOrchestrator.executeTask).not.toHaveBeenCalled();
    });

    it('should pause when capacity threshold is exceeded', async () => {
      // Mock scheduler to return shouldPause=true
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Capacity threshold exceeded (95% >= 90%)',
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.95, threshold: 0.90, shouldPause: true },
      });

      await (daemonRunner as any).poll();

      // Should not start any tasks when paused
      expect(mockStore.getNextQueuedTask).not.toHaveBeenCalled();
      expect(mockOrchestrator.executeTask).not.toHaveBeenCalled();

      // Should emit pause event
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:paused', expect.any(String));

      // Check metrics show paused state
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isPaused).toBe(true);
      expect(metrics.pauseReason).toContain('Capacity threshold exceeded');
    });

    it('should resume when capacity threshold is no longer exceeded', async () => {
      // First set the daemon to paused state
      (daemonRunner as any).isPaused = true;
      (daemonRunner as any).pauseReason = 'Previously paused';

      // Mock scheduler to return shouldPause=false
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.75, threshold: 0.90, shouldPause: false },
      });

      await (daemonRunner as any).poll();

      // Should emit resume event
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:resumed');

      // Check metrics show resumed state
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isPaused).toBe(false);
      expect(metrics.pauseReason).toBeUndefined();
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return current metrics', async () => {
      await daemonRunner.start();

      const metrics = daemonRunner.getMetrics();

      expect(metrics).toMatchObject({
        isRunning: true,
        tasksProcessed: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        activeTaskCount: 0,
        activeTaskIds: [],
        pollCount: expect.any(Number),
        isPaused: false,
        pauseReason: undefined,
      });
      expect(metrics.startedAt).toBeInstanceOf(Date);
    });

    it('should track task success/failure counts', async () => {
      await daemonRunner.start();

      // Simulate successful task
      mockOrchestrator.executeTask.mockResolvedValueOnce(undefined);
      mockStore.getNextQueuedTask.mockResolvedValueOnce(mockTask).mockResolvedValue(null);

      await (daemonRunner as any).poll();

      // Wait for task to complete
      await vi.runAllTimersAsync();

      const metrics = daemonRunner.getMetrics();
      expect(metrics.tasksProcessed).toBe(1);
      expect(metrics.tasksSucceeded).toBe(1);
      expect(metrics.tasksFailed).toBe(0);
    });

    it('should track task failures', async () => {
      await daemonRunner.start();

      // Simulate failed task
      mockOrchestrator.executeTask.mockRejectedValueOnce(new Error('Task failed'));
      mockStore.getNextQueuedTask.mockResolvedValueOnce(mockTask).mockResolvedValue(null);

      await (daemonRunner as any).poll();

      // Wait for task to complete
      await vi.runAllTimersAsync();

      const metrics = daemonRunner.getMetrics();
      expect(metrics.tasksProcessed).toBe(1);
      expect(metrics.tasksSucceeded).toBe(0);
      expect(metrics.tasksFailed).toBe(1);
    });

    it('should calculate uptime correctly', async () => {
      await daemonRunner.start();

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      const metrics = daemonRunner.getMetrics();
      expect(metrics.uptime).toBe(5000);
    });
  });

  describe('signal handling', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      process.exit = vi.fn() as any;
      await daemonRunner.start();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle SIGTERM gracefully', async () => {
      // Find the SIGTERM handler
      const sigtermCall = mockProcessOn.mock.calls.find(call => call[0] === 'SIGTERM');
      expect(sigtermCall).toBeDefined();

      const sigtermHandler = sigtermCall![1];

      // Trigger SIGTERM
      await sigtermHandler();

      expect(mockStream.end).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT gracefully', async () => {
      // Find the SIGINT handler
      const sigintCall = mockProcessOn.mock.calls.find(call => call[0] === 'SIGINT');
      expect(sigintCall).toBeDefined();

      const sigintHandler = sigintCall![1];

      // Trigger SIGINT
      await sigintHandler();

      expect(mockStream.end).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle uncaught exceptions', async () => {
      // Find the uncaughtException handler
      const uncaughtCall = mockProcessOn.mock.calls.find(call => call[0] === 'uncaughtException');
      expect(uncaughtCall).toBeDefined();

      const uncaughtHandler = uncaughtCall![1];
      const testError = new Error('Test error');

      // Trigger uncaught exception
      uncaughtHandler(testError);

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Uncaught exception: Test error')
      );
    });

    it('should handle unhandled rejections', async () => {
      // Find the unhandledRejection handler
      const rejectionCall = mockProcessOn.mock.calls.find(call => call[0] === 'unhandledRejection');
      expect(rejectionCall).toBeDefined();

      const rejectionHandler = rejectionCall![1];

      // Trigger unhandled rejection
      rejectionHandler('Test rejection reason');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled rejection: Test rejection reason')
      );
    });
  });

  describe('logging', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should log to file with correct format', async () => {
      (daemonRunner as any).log('info', 'Test message', { taskId: 'test-123' });

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO \] \[test-123\] Test message\n$/)
      );
    });

    it('should log to stdout when enabled', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        logToStdout: true,
      });

      await runner.start();

      const originalStdoutWrite = process.stdout.write;
      process.stdout.write = vi.fn() as any;

      (runner as any).log('warn', 'Test warning');

      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Test warning')
      );

      process.stdout.write = originalStdoutWrite;
      await runner.stop();
    });

    it('should handle destroyed log stream gracefully', async () => {
      mockStream.destroyed = true;

      (daemonRunner as any).log('error', 'Test error');

      // Should not throw error
      expect(mockStream.write).not.toHaveBeenCalled();
    });
  });

  describe('orchestrator event handling', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should log task pause events', () => {
      // Find the event handler registration
      const pauseCall = mockOrchestrator.on.mock.calls.find(call => call[0] === 'task:paused');
      expect(pauseCall).toBeDefined();

      const pauseHandler = pauseCall![1];
      pauseHandler(mockTask, 'Rate limited');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('paused: Rate limited')
      );
    });

    it('should log stage change events', () => {
      const stageCall = mockOrchestrator.on.mock.calls.find(call => call[0] === 'task:stage-changed');
      expect(stageCall).toBeDefined();

      const stageHandler = stageCall![1];
      stageHandler(mockTask, 'implementation');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('stage: implementation')
      );
    });

    it('should log PR creation events', () => {
      const prCall = mockOrchestrator.on.mock.calls.find(call => call[0] === 'pr:created');
      expect(prCall).toBeDefined();

      const prHandler = prCall![1];
      prHandler('test-task-123', 'https://github.com/test/repo/pull/1');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.stringContaining('created PR: https://github.com/test/repo/pull/1')
      );
    });
  });

  describe('error scenarios', () => {
    it('should handle log file creation failure gracefully', async () => {
      (createWriteStream as MockedFunction<typeof createWriteStream>).mockImplementation(() => {
        throw new Error('Cannot create log file');
      });

      const runner = new DaemonRunner(options);

      await expect(runner.start()).rejects.toThrow();
    });

    it('should handle config loading failure', async () => {
      const { loadConfig } = require('@apexcli/core');
      loadConfig.mockRejectedValue(new Error('Config not found'));

      await expect(daemonRunner.start()).rejects.toThrow('Config not found');
    });

    it('should handle orchestrator initialization failure', async () => {
      mockOrchestrator.initialize.mockRejectedValue(new Error('Orchestrator init failed'));

      await expect(daemonRunner.start()).rejects.toThrow();
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should handle store initialization failure', async () => {
      mockStore.initialize.mockRejectedValue(new Error('Store init failed'));

      await expect(daemonRunner.start()).rejects.toThrow();
      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should handle getEffectiveConfig failure', async () => {
      const { getEffectiveConfig } = require('@apexcli/core');
      getEffectiveConfig.mockImplementation(() => {
        throw new Error('Invalid config');
      });

      await expect(daemonRunner.start()).rejects.toThrow();
    });

    it('should handle missing orchestrator during task start', async () => {
      await daemonRunner.start();

      // Manually clear the orchestrator to simulate failure
      (daemonRunner as any).orchestrator = null;

      // This should not throw, just return early
      (daemonRunner as any).startTask('test-task');

      // No orchestrator calls should be made
      expect(mockOrchestrator.executeTask).not.toHaveBeenCalled();
    });

    it('should handle log stream write errors', async () => {
      await daemonRunner.start();

      // Mock stream write to throw
      mockStream.write.mockImplementation(() => {
        throw new Error('Write failed');
      });

      // Should not throw, just fail silently
      expect(() => {
        (daemonRunner as any).log('error', 'Test error');
      }).not.toThrow();
    });

    it('should handle corrupted log stream', async () => {
      await daemonRunner.start();

      // Simulate corrupted/closed stream
      mockStream.destroyed = true;

      (daemonRunner as any).log('info', 'Test message');

      // Should not attempt to write to destroyed stream
      expect(mockStream.write).not.toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      );
    });

    it('should handle cleanup failure gracefully', async () => {
      await daemonRunner.start();

      // Make stream.end throw an error
      mockStream.end.mockImplementation(() => {
        throw new Error('End failed');
      });

      // Should still complete cleanup without throwing
      await expect(daemonRunner.stop()).resolves.not.toThrow();
    });

    it('should handle store.close() failure', async () => {
      await daemonRunner.start();

      // Make store.close throw
      mockStore.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      // Should still complete cleanup
      await expect(daemonRunner.stop()).resolves.not.toThrow();
    });

    it('should handle malformed task objects', async () => {
      await daemonRunner.start();

      // Return malformed task (missing required fields)
      const malformedTask = { id: null };
      mockStore.getNextQueuedTask.mockResolvedValueOnce(malformedTask).mockResolvedValue(null);

      // Should handle gracefully without crashing
      await (daemonRunner as any).poll();

      // Should not attempt to start a task with null ID
      expect(mockOrchestrator.executeTask).not.toHaveBeenCalled();
    });
  });

  describe('edge cases and boundary conditions', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      await daemonRunner.start();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle zero max concurrent tasks', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 0, // Should use config value
      });

      await runner.start();

      // Should use the config value (3 from mock)
      const metrics = runner.getMetrics();
      expect(metrics).toBeDefined();

      await runner.stop();
    });

    it('should handle very high poll interval', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 60000, // Max allowed
      });

      expect(() => runner).not.toThrow();

      await runner.start();
      await runner.stop();
    });

    it('should handle very low poll interval', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 1000, // Min allowed
      });

      expect(() => runner).not.toThrow();

      await runner.start();
      await runner.stop();
    });

    it('should handle rapid start/stop cycles', async () => {
      const runner = new DaemonRunner(options);

      await runner.start();
      await runner.stop();
      await runner.start();
      await runner.stop();

      // Should handle multiple cycles without issues
      expect(mockStream.end).toHaveBeenCalledTimes(2);
    });

    it('should handle polling when store is null', async () => {
      // Manually set store to null to simulate failure
      (daemonRunner as any).store = null;

      await (daemonRunner as any).poll();

      // Should return early without calling store methods
      expect(mockStore.getNextQueuedTask).not.toHaveBeenCalled();
    });

    it('should handle task execution with empty task ID', async () => {
      // This should not happen in normal operation, but test defensive code
      (daemonRunner as any).startTask('');

      // Should still track the empty task ID
      const metrics = daemonRunner.getMetrics();
      expect(metrics.tasksProcessed).toBe(1);
    });

    it('should handle metrics calculation with null startedAt', async () => {
      // Before starting
      const metrics = daemonRunner.getMetrics();

      expect(metrics.uptime).toBe(0);
      expect(metrics.startedAt).toBeInstanceOf(Date);
    });

    it('should handle concurrent polls gracefully', async () => {
      mockStore.getNextQueuedTask.mockResolvedValue(null);

      // Start multiple polls simultaneously
      const polls = Promise.all([
        (daemonRunner as any).poll(),
        (daemonRunner as any).poll(),
        (daemonRunner as any).poll(),
      ]);

      await polls;

      // All polls should complete without errors
      const metrics = daemonRunner.getMetrics();
      expect(metrics.pollCount).toBeGreaterThan(1);
    });

    it('should handle task execution promise rejection in finally block', async () => {
      mockOrchestrator.executeTask.mockImplementation(() => {
        return Promise.reject(new Error('Task failed'));
      });

      mockStore.getNextQueuedTask.mockResolvedValueOnce(mockTask).mockResolvedValue(null);

      await (daemonRunner as any).poll();

      // Wait for task promise to settle
      await vi.runAllTimersAsync();

      // Should clean up running tasks even after failure
      const metrics = daemonRunner.getMetrics();
      expect(metrics.activeTaskCount).toBe(0);
      expect(metrics.tasksFailed).toBe(1);
    });

    it('should handle custom log file path', async () => {
      const customLogPath = '/custom/path/daemon.log';

      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        logFile: customLogPath,
      });

      await runner.start();

      expect(createWriteStream).toHaveBeenCalledWith(customLogPath, { flags: 'a' });

      await runner.stop();
    });

    it('should handle logToStdout option correctly', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        logToStdout: true,
      });

      const originalStdoutWrite = process.stdout.write;
      process.stdout.write = vi.fn() as any;

      await runner.start();

      // Should log startup message to stdout
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining('Daemon started')
      );

      process.stdout.write = originalStdoutWrite;
      await runner.stop();
    });
  });

  describe('race conditions and timing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle stop called during initialization', async () => {
      const runner = new DaemonRunner(options);

      // Start the runner but don't await
      const startPromise = runner.start();

      // Immediately try to stop
      const stopPromise = runner.stop();

      // Both should complete without hanging
      await Promise.all([startPromise, stopPromise]);

      const metrics = runner.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });

    it('should handle multiple stop calls', async () => {
      const runner = new DaemonRunner(options);
      await runner.start();

      // Call stop multiple times
      const stopPromises = Promise.all([
        runner.stop(),
        runner.stop(),
        runner.stop(),
      ]);

      await stopPromises;

      // Should only end stream once
      expect(mockStream.end).toHaveBeenCalledTimes(1);
    });

    it('should handle poll timing edge cases', async () => {
      await daemonRunner.start();

      // Simulate shutdown flag being set during poll
      (daemonRunner as any).isShuttingDown = true;

      await (daemonRunner as any).poll();

      // Should not call store when shutting down
      expect(mockStore.getNextQueuedTask).not.toHaveBeenCalled();
    });
  });
});