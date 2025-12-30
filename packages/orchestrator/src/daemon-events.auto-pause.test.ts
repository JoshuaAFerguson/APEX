import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { createWriteStream } from 'fs';

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
  getNextQueuedTask: vi.fn().mockResolvedValue(null),
  updateTaskStatus: vi.fn(),
};

// Mock usage manager
const mockUsageManager = {
  trackTaskStart: vi.fn(),
  trackTaskCompletion: vi.fn(),
  getUsageStats: vi.fn().mockReturnValue({
    current: {
      dailyUsage: { totalCost: 25.0, tasksCompleted: 3 },
    },
    active: [],
  }),
  getBaseLimits: vi.fn().mockReturnValue({
    dailyBudget: 100.0,
  }),
};

// Mock daemon scheduler
const mockDaemonScheduler = {
  shouldPauseTasks: vi.fn(),
};

// Mock usage provider
const mockUsageProvider = {};

describe('DaemonRunner - Auto-Pause Events', () => {
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
    vi.useFakeTimers();

    // Mock process.on to capture signal handlers
    process.on = mockProcessOn as any;

    // Setup default mocks
    (createWriteStream as any).mockReturnValue(mockStream);
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
    vi.useRealTimers();
    process.exit = originalExit;
    process.on = originalOn;
    vi.clearAllTimers();
  });

  describe('daemon:paused Event Emission', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should emit daemon:paused event when capacity threshold is exceeded', async () => {
      // Mock scheduler to return shouldPause=true
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Capacity threshold exceeded (95% >= 90%)',
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.95, threshold: 0.90, shouldPause: true },
      });

      // Trigger polling cycle
      await (daemonRunner as any).poll();

      // Should emit daemon:paused event with reason
      expect(mockOrchestrator.emit).toHaveBeenCalledWith(
        'daemon:paused',
        'Capacity threshold exceeded (95% >= 90%)'
      );
    });

    it('should emit daemon:paused event when outside active time window', async () => {
      // Mock scheduler to return shouldPause=true for off-hours
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Outside active time window (off-hours)',
        timeWindow: { mode: 'off-hours', isActive: false },
        capacity: { currentPercentage: 0.30, threshold: 0.90, shouldPause: false },
      });

      // Trigger polling cycle
      await (daemonRunner as any).poll();

      // Should emit daemon:paused event with time window reason
      expect(mockOrchestrator.emit).toHaveBeenCalledWith(
        'daemon:paused',
        'Outside active time window (off-hours)'
      );
    });

    it('should emit daemon:paused event with custom reason', async () => {
      const customReason = 'Daily budget exceeded - system intervention required';

      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: customReason,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 1.2, threshold: 0.90, shouldPause: true },
      });

      await (daemonRunner as any).poll();

      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:paused', customReason);
    });

    it('should not emit duplicate daemon:paused events when already paused', async () => {
      // Set initial paused state
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'High capacity usage',
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.95, threshold: 0.90, shouldPause: true },
      });

      // First poll - should emit pause event
      await (daemonRunner as any).poll();
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:paused', 'High capacity usage');

      // Clear previous calls
      mockOrchestrator.emit.mockClear();

      // Second poll with same paused state - should not emit again
      await (daemonRunner as any).poll();
      expect(mockOrchestrator.emit).not.toHaveBeenCalledWith('daemon:paused', expect.any(String));
    });
  });

  describe('daemon:resumed Event Emission', () => {
    beforeEach(async () => {
      await daemonRunner.start();

      // Set initial paused state
      (daemonRunner as any).isPaused = true;
      (daemonRunner as any).pauseReason = 'Previously paused for testing';
    });

    it('should emit daemon:resumed event when capacity threshold is no longer exceeded', async () => {
      // Mock scheduler to return shouldPause=false (resuming)
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.75, threshold: 0.90, shouldPause: false },
      });

      // Trigger polling cycle
      await (daemonRunner as any).poll();

      // Should emit daemon:resumed event
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:resumed');

      // Should clear pause state
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isPaused).toBe(false);
      expect(metrics.pauseReason).toBeUndefined();
    });

    it('should emit daemon:resumed event when entering active time window', async () => {
      // Mock scheduler to return shouldPause=false (entering active hours)
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.20, threshold: 0.90, shouldPause: false },
      });

      await (daemonRunner as any).poll();

      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:resumed');
    });

    it('should not emit duplicate daemon:resumed events when already running', async () => {
      // First resume
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.60, threshold: 0.90, shouldPause: false },
      });

      await (daemonRunner as any).poll();
      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:resumed');

      // Clear previous calls
      mockOrchestrator.emit.mockClear();

      // Second poll with same running state - should not emit again
      await (daemonRunner as any).poll();
      expect(mockOrchestrator.emit).not.toHaveBeenCalledWith('daemon:resumed');
    });

    it('should emit daemon:resumed with proper state reset', async () => {
      // Start with complex paused state
      (daemonRunner as any).isPaused = true;
      (daemonRunner as any).pauseReason = 'Night mode capacity threshold exceeded (97% >= 96%)';

      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'night', isActive: true },
        capacity: { currentPercentage: 0.85, threshold: 0.96, shouldPause: false },
      });

      await (daemonRunner as any).poll();

      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:resumed');

      // Verify complete state reset
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isPaused).toBe(false);
      expect(metrics.pauseReason).toBeUndefined();
    });
  });

  describe('State Transition Event Sequences', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should emit correct sequence for pause -> resume -> pause transitions', async () => {
      const emitCalls: any[] = [];
      mockOrchestrator.emit.mockImplementation((event, ...args) => {
        emitCalls.push({ event, args });
      });

      // 1. Normal -> Paused
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Capacity threshold exceeded',
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.95, threshold: 0.90, shouldPause: true },
      });

      await (daemonRunner as any).poll();

      // 2. Paused -> Resumed
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.80, threshold: 0.90, shouldPause: false },
      });

      await (daemonRunner as any).poll();

      // 3. Resumed -> Paused again
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Different reason - off hours',
        timeWindow: { mode: 'off-hours', isActive: false },
        capacity: { currentPercentage: 0.80, threshold: 0.90, shouldPause: false },
      });

      await (daemonRunner as any).poll();

      // Verify event sequence
      const pauseResumeEvents = emitCalls.filter(call =>
        call.event === 'daemon:paused' || call.event === 'daemon:resumed'
      );

      expect(pauseResumeEvents).toHaveLength(3);
      expect(pauseResumeEvents[0]).toMatchObject({
        event: 'daemon:paused',
        args: ['Capacity threshold exceeded'],
      });
      expect(pauseResumeEvents[1]).toMatchObject({
        event: 'daemon:resumed',
        args: [],
      });
      expect(pauseResumeEvents[2]).toMatchObject({
        event: 'daemon:paused',
        args: ['Different reason - off hours'],
      });
    });

    it('should handle rapid state changes without losing events', async () => {
      const emitCalls: any[] = [];
      mockOrchestrator.emit.mockImplementation((event, ...args) => {
        emitCalls.push({ event, args });
      });

      // Simulate rapid state changes
      const stateSequence = [
        { shouldPause: false }, // running
        { shouldPause: true, reason: 'Threshold 1' }, // paused
        { shouldPause: false }, // resumed
        { shouldPause: true, reason: 'Threshold 2' }, // paused again
        { shouldPause: false }, // resumed again
      ];

      for (const state of stateSequence) {
        mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
          ...state,
          timeWindow: { mode: 'day', isActive: true },
          capacity: { currentPercentage: 0.50, threshold: 0.90, shouldPause: false },
        });

        await (daemonRunner as any).poll();
      }

      // Count pause/resume events
      const pauseEvents = emitCalls.filter(call => call.event === 'daemon:paused');
      const resumeEvents = emitCalls.filter(call => call.event === 'daemon:resumed');

      expect(pauseEvents).toHaveLength(2); // Two pauses
      expect(resumeEvents).toHaveLength(2); // Two resumes

      // Verify reasons are preserved
      expect(pauseEvents[0].args[0]).toBe('Threshold 1');
      expect(pauseEvents[1].args[0]).toBe('Threshold 2');
    });
  });

  describe('Error Handling in Event Emission', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should handle orchestrator emit errors gracefully', async () => {
      mockOrchestrator.emit.mockImplementation(() => {
        throw new Error('Event emission failed');
      });

      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Test pause',
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.95, threshold: 0.90, shouldPause: true },
      });

      // Should not throw even if emit fails
      await expect((daemonRunner as any).poll()).resolves.not.toThrow();

      // Should still update internal state
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isPaused).toBe(true);
      expect(metrics.pauseReason).toBe('Test pause');
    });

    it('should continue operation after event emission failures', async () => {
      let emitCallCount = 0;
      mockOrchestrator.emit.mockImplementation(() => {
        emitCallCount++;
        if (emitCallCount === 1) {
          throw new Error('First emit fails');
        }
        return true; // Subsequent emits succeed
      });

      // First transition (should fail to emit but continue)
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'First pause',
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.95, threshold: 0.90, shouldPause: true },
      });

      await (daemonRunner as any).poll();

      // Second transition (should emit successfully)
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.70, threshold: 0.90, shouldPause: false },
      });

      await (daemonRunner as any).poll();

      expect(emitCallCount).toBe(2);

      // State should be correct regardless of emit failures
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isPaused).toBe(false);
    });
  });

  describe('Event Emission with Metrics Integration', () => {
    beforeEach(async () => {
      await daemonRunner.start();
    });

    it('should update metrics consistently with event emissions', async () => {
      // Transition to paused
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Metrics test pause',
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.92, threshold: 0.90, shouldPause: true },
      });

      await (daemonRunner as any).poll();

      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:paused', 'Metrics test pause');

      const pausedMetrics = daemonRunner.getMetrics();
      expect(pausedMetrics.isPaused).toBe(true);
      expect(pausedMetrics.pauseReason).toBe('Metrics test pause');

      // Transition to resumed
      mockOrchestrator.emit.mockClear();
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.75, threshold: 0.90, shouldPause: false },
      });

      await (daemonRunner as any).poll();

      expect(mockOrchestrator.emit).toHaveBeenCalledWith('daemon:resumed');

      const resumedMetrics = daemonRunner.getMetrics();
      expect(resumedMetrics.isPaused).toBe(false);
      expect(resumedMetrics.pauseReason).toBeUndefined();
    });

    it('should include scheduling decision in metrics', async () => {
      const schedulingDecision = {
        shouldPause: true,
        reason: 'Night mode capacity exceeded',
        timeWindow: { mode: 'night', isActive: true },
        capacity: { currentPercentage: 0.98, threshold: 0.96, shouldPause: true },
      };

      mockDaemonScheduler.shouldPauseTasks.mockReturnValue(schedulingDecision);

      await (daemonRunner as any).poll();

      const metrics = daemonRunner.getMetrics();
      expect(metrics.lastSchedulingDecision).toEqual(schedulingDecision);
    });
  });
});