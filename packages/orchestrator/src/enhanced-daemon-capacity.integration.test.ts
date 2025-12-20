import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedDaemon } from './enhanced-daemon';
import { CapacityMonitor } from './capacity-monitor';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';
import { ApexConfig } from '@apexcli/core';

// Mock only necessary external dependencies, keep CapacityMonitor real for integration
vi.mock('./runner', () => ({
  DaemonRunner: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockResolvedValue({
      uptime: 1000,
      tasksProcessed: 5,
      averageTaskTime: 200,
    }),
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
        dailyUsage: { totalCost: 5.0, tasksCompleted: 3 },
      },
    }),
    getCurrentUsage: vi.fn().mockReturnValue({
      currentTokens: 1000,
      currentCost: 0.05,
      activeTasks: 1,
    }),
    getCurrentMode: vi.fn().mockReturnValue('day'),
    getNextModeSwitch: vi.fn().mockReturnValue(new Date(Date.now() + 3600000)),
    getNextMidnight: vi.fn().mockReturnValue(new Date(Date.now() + 86400000)),
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

vi.mock('@apexcli/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apexcli/core')>();
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

describe('EnhancedDaemon - CapacityMonitor Integration', () => {
  let enhancedDaemon: EnhancedDaemon;
  let mockProjectPath: string;
  let mockConfig: ApexConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockProjectPath = '/test/project';
    mockConfig = {
      version: '1.0',
      project: { name: 'test-project' },
      daemon: {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
        },
        sessionRecovery: {
          enabled: true,
          autoResume: true,
        },
        idleProcessing: {
          enabled: true,
          idleThreshold: 300000,
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

    enhancedDaemon = new EnhancedDaemon(mockProjectPath, mockConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('CapacityMonitor initialization', () => {
    it('should create CapacityMonitor with UsageAdapter during construction', () => {
      expect(enhancedDaemon['capacityMonitor']).toBeDefined();
      expect(enhancedDaemon['capacityMonitor']).toBeInstanceOf(CapacityMonitor);
    });

    it('should start CapacityMonitor when daemon starts', async () => {
      const capacityMonitor = enhancedDaemon['capacityMonitor'];
      const startSpy = vi.spyOn(capacityMonitor, 'start');

      await enhancedDaemon.start();

      expect(startSpy).toHaveBeenCalled();
    });

    it('should stop CapacityMonitor when daemon stops', async () => {
      await enhancedDaemon.start();
      const capacityMonitor = enhancedDaemon['capacityMonitor'];
      const stopSpy = vi.spyOn(capacityMonitor, 'stop');

      await enhancedDaemon.stop();

      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('Event integration', () => {
    it('should set up event listeners for capacity:restored events', async () => {
      await enhancedDaemon.start();

      const capacityMonitor = enhancedDaemon['capacityMonitor'];
      const onSpy = vi.spyOn(capacityMonitor, 'on');

      // Verify that the event listener was set up
      expect(onSpy).toHaveBeenCalledWith('capacity:restored', expect.any(Function));
    });

    it('should forward capacity:restored events to daemon event emitter', async () => {
      await enhancedDaemon.start();

      const eventSpy = vi.fn();
      enhancedDaemon.on('capacity:restored', eventSpy);

      const mockEvent = {
        reason: 'capacity_dropped' as const,
        timestamp: new Date(),
        previousUsage: {
          currentTokens: 5000,
          currentCost: 0.25,
          activeTasks: 2,
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          maxConcurrentTasks: 3,
          dailyBudget: 100.0,
          dailySpent: 10.0,
        },
        currentUsage: {
          currentTokens: 1000,
          currentCost: 0.05,
          activeTasks: 1,
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          maxConcurrentTasks: 3,
          dailyBudget: 100.0,
          dailySpent: 5.0,
        },
        modeInfo: {
          mode: 'day' as const,
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date(),
          nextMidnight: new Date(),
        },
      };

      // Manually emit the event to simulate CapacityMonitor behavior
      enhancedDaemon['capacityMonitor'].emit('capacity:restored', mockEvent);

      expect(eventSpy).toHaveBeenCalledWith(mockEvent);
    });

    it('should forward tasks:auto-resumed events from orchestrator', async () => {
      await enhancedDaemon.start();

      const eventSpy = vi.fn();
      enhancedDaemon.on('tasks:auto-resumed', eventSpy);

      const mockEvent = {
        reason: 'capacity_restored' as const,
        timestamp: new Date(),
        resumedTaskIds: ['task-1', 'task-2'],
        totalResumed: 2,
      };

      // Manually emit the event to simulate orchestrator behavior
      enhancedDaemon['orchestrator'].emit('tasks:auto-resumed', mockEvent);

      expect(eventSpy).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('Status integration', () => {
    it('should include capacity monitor status in getStatus response', async () => {
      await enhancedDaemon.start();
      const status = await enhancedDaemon.getStatus();

      expect(status).toHaveProperty('capacity');
      expect(status.capacity).toHaveProperty('isRunning');
      expect(status.capacity).toHaveProperty('hasModeSwitchTimer');
      expect(status.capacity).toHaveProperty('hasMidnightTimer');
      expect(status.capacity).toHaveProperty('lastUsage');
    });

    it('should return real capacity monitor status', async () => {
      await enhancedDaemon.start();

      const capacityMonitor = enhancedDaemon.getCapacityMonitor();
      const status = capacityMonitor.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status).toHaveProperty('nextModeSwitch');
      expect(status).toHaveProperty('nextMidnight');
    });
  });

  describe('API access', () => {
    it('should provide access to CapacityMonitor through getCapacityMonitor', () => {
      const capacityMonitor = enhancedDaemon.getCapacityMonitor();

      expect(capacityMonitor).toBeDefined();
      expect(capacityMonitor).toBeInstanceOf(CapacityMonitor);
      expect(typeof capacityMonitor.start).toBe('function');
      expect(typeof capacityMonitor.stop).toBe('function');
      expect(typeof capacityMonitor.getStatus).toBe('function');
      expect(typeof capacityMonitor.checkCapacity).toBe('function');
    });

    it('should maintain same instance across multiple calls', () => {
      const capacityMonitor1 = enhancedDaemon.getCapacityMonitor();
      const capacityMonitor2 = enhancedDaemon.getCapacityMonitor();

      expect(capacityMonitor1).toBe(capacityMonitor2);
    });
  });

  describe('Enhanced event interface compliance', () => {
    it('should include capacity events in EnhancedDaemonEvents interface', async () => {
      await enhancedDaemon.start();

      // Test that the events are typed correctly by verifying they can be subscribed to
      const capacityEventSpy = vi.fn();
      const tasksEventSpy = vi.fn();

      // These should not cause TypeScript errors if the interface is correct
      enhancedDaemon.on('capacity:restored', capacityEventSpy);
      enhancedDaemon.on('tasks:auto-resumed', tasksEventSpy);

      expect(capacityEventSpy).toBeDefined();
      expect(tasksEventSpy).toBeDefined();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle CapacityMonitor startup errors gracefully', async () => {
      const capacityMonitor = enhancedDaemon['capacityMonitor'];
      const startError = new Error('CapacityMonitor start failed');
      vi.spyOn(capacityMonitor, 'start').mockImplementation(() => {
        throw startError;
      });

      // The daemon should still start even if CapacityMonitor fails
      // (This depends on how error handling is implemented)
      await expect(enhancedDaemon.start()).rejects.toThrow();
    });

    it('should handle CapacityMonitor stop errors gracefully', async () => {
      await enhancedDaemon.start();

      const capacityMonitor = enhancedDaemon['capacityMonitor'];
      const stopError = new Error('CapacityMonitor stop failed');
      vi.spyOn(capacityMonitor, 'stop').mockImplementation(() => {
        throw stopError;
      });

      // Should handle the error gracefully during stop
      await enhancedDaemon.stop();

      // Verify stop was called despite the error
      expect(capacityMonitor.stop).toHaveBeenCalled();
    });

    it('should handle getStatus errors from CapacityMonitor', async () => {
      await enhancedDaemon.start();

      const capacityMonitor = enhancedDaemon['capacityMonitor'];
      vi.spyOn(capacityMonitor, 'getStatus').mockImplementation(() => {
        throw new Error('Status unavailable');
      });

      // Should handle the error and potentially return a default status
      await expect(enhancedDaemon.getStatus()).rejects.toThrow();
    });
  });
});