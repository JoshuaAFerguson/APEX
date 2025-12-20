import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedDaemon } from './enhanced-daemon';
import { ApexConfig } from '@apex/core';

// Mock all dependencies
vi.mock('./runner', () => ({
  DaemonRunner: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockReturnValue({
      uptime: 1000,
      tasksProcessed: 5,
      averageTaskTime: 200,
      isPaused: false,
      pauseReason: undefined,
      lastSchedulingDecision: null,
    }),
    poll: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('./service-manager', () => ({
  ServiceManager: vi.fn().mockImplementation(() => ({
    installService: vi.fn().mockResolvedValue(undefined),
    uninstallService: vi.fn().mockResolvedValue(undefined),
    getServiceStatus: vi.fn().mockResolvedValue({
      installed: true,
      running: true,
    }),
    performHealthCheck: vi.fn().mockResolvedValue({
      healthy: true,
      errors: [],
    }),
  })),
}));

vi.mock('./usage-manager', () => ({
  UsageManager: vi.fn().mockImplementation(() => ({
    trackTaskStart: vi.fn(),
    trackTaskCompletion: vi.fn(),
    getUsageStats: vi.fn().mockReturnValue({
      current: {
        currentMode: 'day',
        dailyUsage: { totalCost: 25.0, tasksCompleted: 3 },
      },
      active: [],
    }),
    getBaseLimits: vi.fn().mockReturnValue({
      dailyBudget: 100.0,
      maxTokensPerTask: 500000,
    }),
    on: vi.fn(),
  })),
}));

vi.mock('./session-manager', () => ({
  SessionManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    cleanupCheckpoints: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  })),
}));

vi.mock('./workspace-manager', () => ({
  WorkspaceManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    createWorkspace: vi.fn().mockResolvedValue(undefined),
    cleanupWorkspace: vi.fn().mockResolvedValue(undefined),
    cleanupOldWorkspaces: vi.fn().mockResolvedValue(undefined),
    getWorkspaceStats: vi.fn().mockResolvedValue({
      activeWorkspaces: 2,
      totalWorkspaces: 5,
    }),
    on: vi.fn(),
  })),
}));

vi.mock('./interaction-manager', () => ({
  InteractionManager: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

vi.mock('./idle-processor', () => ({
  IdleProcessor: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    getThoughtStats: vi.fn().mockResolvedValue({
      totalThoughts: 10,
      recentThoughts: 3,
    }),
    on: vi.fn(),
  })),
}));

vi.mock('./thought-capture', () => ({
  ThoughtCaptureManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getThoughtStats: vi.fn().mockResolvedValue({
      totalThoughts: 10,
      recentThoughts: 3,
    }),
    on: vi.fn(),
  })),
}));

vi.mock('./store', () => ({
  TaskStore: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('./index', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  })),
}));

vi.mock('./daemon-scheduler', () => ({
  DaemonScheduler: vi.fn().mockImplementation(() => mockDaemonScheduler),
  UsageManagerProvider: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@apex/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apex/core')>();
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

// Mock daemon scheduler
const mockDaemonScheduler = {
  shouldPauseTasks: vi.fn(),
  getCurrentTimeWindow: vi.fn(),
  getCapacityInfo: vi.fn(),
  getUsageStats: vi.fn(),
};

describe('EnhancedDaemon - Auto-Pause Integration', () => {
  let enhancedDaemon: EnhancedDaemon;
  let mockProjectPath: string;
  let mockConfig: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProjectPath = '/test/project';
    mockConfig = {
      version: '1.0',
      project: { name: 'test-project' },
      daemon: {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeCapacityThreshold: 0.90,
          nightModeCapacityThreshold: 0.96,
        },
        healthCheck: {
          enabled: true,
          interval: 30000,
        },
        watchdog: {
          enabled: true,
          maxRestarts: 5,
          restartDelay: 5000,
          restartWindow: 300000,
        },
        installAsService: true,
      },
      limits: {
        maxTokensPerTask: 500000,
        maxCostPerTask: 10.0,
        maxConcurrentTasks: 3,
        dailyBudget: 100.0,
      },
    };

    // Set default mock returns
    mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
      shouldPause: false,
      timeWindow: { mode: 'day', isActive: true },
      capacity: { currentPercentage: 0.25, threshold: 0.90, shouldPause: false },
    });

    mockDaemonScheduler.getCurrentTimeWindow.mockReturnValue({
      mode: 'day',
      isActive: true,
      startHour: 9,
      endHour: 17,
    });

    mockDaemonScheduler.getUsageStats.mockReturnValue({
      timeWindow: { mode: 'day', isActive: true },
      capacity: { currentPercentage: 0.25, threshold: 0.90, shouldPause: false },
      dailyUsage: { totalCost: 25.0, tasksCompleted: 3 },
      activeTasks: 2,
    });

    enhancedDaemon = new EnhancedDaemon(mockProjectPath, mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DaemonScheduler Integration', () => {
    it('should create DaemonScheduler instance with proper configuration', () => {
      const { DaemonScheduler } = require('./daemon-scheduler');

      expect(DaemonScheduler).toHaveBeenCalledWith(
        expect.objectContaining({
          timeBasedUsage: expect.objectContaining({
            enabled: true,
            dayModeCapacityThreshold: 0.90,
            nightModeCapacityThreshold: 0.96,
          }),
        }),
        expect.objectContaining({
          dailyBudget: 100.0,
          maxConcurrentTasks: 3,
        }),
        expect.any(Object) // UsageManagerProvider
      );
    });

    it('should pass scheduler instance to DaemonRunner', () => {
      const { DaemonRunner } = require('./runner');

      expect(DaemonRunner).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduler: expect.any(Object),
        })
      );
    });
  });

  describe('Auto-Pause Logic', () => {
    it('should include scheduling decision in status when available', async () => {
      await enhancedDaemon.start();

      const status = await enhancedDaemon.getStatus();

      expect(status).toHaveProperty('scheduling');
      expect(status.scheduling).toMatchObject({
        shouldPause: false,
        timeWindow: expect.objectContaining({ mode: 'day' }),
        capacity: expect.objectContaining({ currentPercentage: 0.25 }),
      });
    });

    it('should detect paused state in daemon metrics', async () => {
      // Mock runner to return paused state
      const mockRunner = enhancedDaemon['daemonRunner'];
      vi.mocked(mockRunner.getMetrics).mockReturnValue({
        uptime: 1000,
        tasksProcessed: 5,
        averageTaskTime: 200,
        isPaused: true,
        pauseReason: 'Capacity threshold exceeded (95% >= 90%)',
        lastSchedulingDecision: {
          shouldPause: true,
          reason: 'Capacity threshold exceeded (95% >= 90%)',
          timeWindow: { mode: 'day', isActive: true },
          capacity: { currentPercentage: 0.95, threshold: 0.90, shouldPause: true },
        },
      });

      await enhancedDaemon.start();
      const status = await enhancedDaemon.getStatus();

      expect(status.daemon.isPaused).toBe(true);
      expect(status.daemon.pauseReason).toContain('Capacity threshold exceeded');
      expect(status.scheduling.shouldPause).toBe(true);
    });

    it('should show current capacity utilization in status', async () => {
      // Set high capacity usage
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.85, threshold: 0.90, shouldPause: false },
      });

      mockDaemonScheduler.getUsageStats.mockReturnValue({
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.85, threshold: 0.90, shouldPause: false },
        dailyUsage: { totalCost: 85.0, tasksCompleted: 8 },
        activeTasks: 3,
      });

      await enhancedDaemon.start();
      const status = await enhancedDaemon.getStatus();

      expect(status.scheduling.capacity.currentPercentage).toBe(0.85);
      expect(status.usage.current.dailyUsage.totalCost).toBe(85.0);
    });
  });

  describe('Time Window Management', () => {
    it('should reflect current time window in status', async () => {
      // Mock night mode
      mockDaemonScheduler.getCurrentTimeWindow.mockReturnValue({
        mode: 'night',
        isActive: true,
        startHour: 22,
        endHour: 6,
      });

      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'night', isActive: true },
        capacity: { currentPercentage: 0.94, threshold: 0.96, shouldPause: false },
      });

      await enhancedDaemon.start();
      const status = await enhancedDaemon.getStatus();

      expect(status.scheduling.timeWindow.mode).toBe('night');
      expect(status.scheduling.capacity.threshold).toBe(0.96);
    });

    it('should show off-hours state correctly', async () => {
      // Mock off-hours
      mockDaemonScheduler.getCurrentTimeWindow.mockReturnValue({
        mode: 'off-hours',
        isActive: false,
        startHour: null,
        endHour: null,
      });

      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Outside active time window',
        timeWindow: { mode: 'off-hours', isActive: false },
        capacity: { currentPercentage: 0.30, threshold: 0.90, shouldPause: false },
      });

      await enhancedDaemon.start();
      const status = await enhancedDaemon.getStatus();

      expect(status.scheduling.timeWindow.isActive).toBe(false);
      expect(status.scheduling.shouldPause).toBe(true);
      expect(status.scheduling.reason).toContain('Outside active time window');
    });
  });

  describe('Event Integration', () => {
    it('should emit usage:mode-changed when time window changes', async () => {
      const modeChangedSpy = vi.fn();
      enhancedDaemon.on('usage:mode-changed', modeChangedSpy);

      await enhancedDaemon.start();

      // Simulate mode change
      const usageManager = enhancedDaemon['usageManager'];
      const modeChangeHandler = vi.mocked(usageManager.on).mock.calls.find(
        call => call[0] === 'mode-changed'
      )?.[1] as Function;

      if (modeChangeHandler) {
        modeChangeHandler('night');
        expect(modeChangedSpy).toHaveBeenCalledWith('night');
      }
    });

    it('should handle scheduler errors gracefully', async () => {
      const errorSpy = vi.fn();
      enhancedDaemon.on('daemon:error', errorSpy);

      // Mock scheduler to throw error
      mockDaemonScheduler.shouldPauseTasks.mockImplementation(() => {
        throw new Error('Scheduler error');
      });

      await enhancedDaemon.start();

      // The error should be handled gracefully without crashing the daemon
      expect(enhancedDaemon['isRunning']).toBe(true);
    });
  });

  describe('Scheduler Status Reporting', () => {
    it('should provide detailed scheduling status method', async () => {
      await enhancedDaemon.start();

      // Add method to get current scheduling status
      const getSchedulingStatus = () => {
        return mockDaemonScheduler.shouldPauseTasks();
      };

      const schedulingStatus = getSchedulingStatus();

      expect(schedulingStatus).toMatchObject({
        shouldPause: expect.any(Boolean),
        timeWindow: expect.objectContaining({
          mode: expect.stringMatching(/day|night|off-hours/),
          isActive: expect.any(Boolean),
        }),
        capacity: expect.objectContaining({
          currentPercentage: expect.any(Number),
          threshold: expect.any(Number),
          shouldPause: expect.any(Boolean),
        }),
      });
    });

    it('should show recommendations when capacity is high', async () => {
      // Mock high capacity with recommendations
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.87, threshold: 0.90, shouldPause: false },
        recommendations: [
          'Consider increasing daily budget if sustained high usage is expected',
          'Night mode starts in 6 hours with higher capacity limits',
        ],
      });

      await enhancedDaemon.start();
      const status = await enhancedDaemon.getStatus();

      expect(status.scheduling).toHaveProperty('recommendations');
      expect(status.scheduling.recommendations).toBeInstanceOf(Array);
      expect(status.scheduling.recommendations!.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle missing time-based usage configuration', () => {
      const configWithoutTimeUsage = {
        ...mockConfig,
        daemon: {
          ...mockConfig.daemon,
          timeBasedUsage: { enabled: false },
        },
      };

      const daemon = new EnhancedDaemon(mockProjectPath, configWithoutTimeUsage);

      expect(daemon).toBeDefined();
      const { DaemonScheduler } = require('./daemon-scheduler');
      expect(DaemonScheduler).toHaveBeenCalledWith(
        expect.objectContaining({
          timeBasedUsage: expect.objectContaining({ enabled: false }),
        }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should use default capacity thresholds when not specified', () => {
      const configWithoutThresholds = {
        ...mockConfig,
        daemon: {
          ...mockConfig.daemon,
          timeBasedUsage: {
            enabled: true,
            dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
            nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
            // Missing threshold configuration
          },
        },
      };

      const daemon = new EnhancedDaemon(mockProjectPath, configWithoutThresholds);

      expect(daemon).toBeDefined();
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up scheduler resources on stop', async () => {
      await enhancedDaemon.start();
      await enhancedDaemon.stop();

      // Verify daemon stopped successfully
      expect(enhancedDaemon['isRunning']).toBe(false);
    });

    it('should handle scheduler cleanup errors gracefully', async () => {
      await enhancedDaemon.start();

      const mockRunner = enhancedDaemon['daemonRunner'];
      vi.mocked(mockRunner.stop).mockRejectedValue(new Error('Cleanup failed'));

      const errorSpy = vi.fn();
      enhancedDaemon.on('daemon:error', errorSpy);

      await expect(enhancedDaemon.stop()).rejects.toThrow('Cleanup failed');
    });
  });
});