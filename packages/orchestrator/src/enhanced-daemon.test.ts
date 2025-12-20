import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedDaemon } from './enhanced-daemon';
import { ApexConfig, DaemonConfig, LimitsConfig, Task } from '@apexcli/core';

// Mock all dependencies
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

describe('EnhancedDaemon', () => {
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

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(enhancedDaemon).toBeDefined();
    });

    it('should load config when none provided', () => {
      const { loadConfig } = require('@apexcli/core');
      vi.mocked(loadConfig).mockReturnValue(mockConfig);

      const daemon = new EnhancedDaemon(mockProjectPath);
      expect(loadConfig).toHaveBeenCalledWith(mockProjectPath);
      expect(daemon).toBeDefined();
    });

    it('should handle config loading errors', () => {
      const { loadConfig } = require('@apexcli/core');
      vi.mocked(loadConfig).mockImplementation(() => {
        throw new Error('Config not found');
      });

      const daemon = new EnhancedDaemon(mockProjectPath);
      expect(daemon).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start all components successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await enhancedDaemon.start();

      // Should emit started event
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Enhanced APEX Daemon started')
      );

      consoleSpy.mockRestore();
    });

    it('should emit daemon:started event', async () => {
      const startedSpy = vi.fn();
      enhancedDaemon.on('daemon:started', startedSpy);

      await enhancedDaemon.start();

      expect(startedSpy).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const mockStore = enhancedDaemon['store'];
      vi.mocked(mockStore.initialize).mockRejectedValue(new Error('Init failed'));

      const errorSpy = vi.fn();
      enhancedDaemon.on('daemon:error', errorSpy);

      await expect(enhancedDaemon.start()).rejects.toThrow('Init failed');
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should setup health monitoring when enabled', async () => {
      await enhancedDaemon.start();

      // Advance time to trigger health check
      vi.advanceTimersByTime(30000);

      const serviceManager = enhancedDaemon['serviceManager'];
      expect(serviceManager.performHealthCheck).toHaveBeenCalled();
    });

    it('should setup watchdog when enabled', async () => {
      const errorSpy = vi.fn();
      enhancedDaemon.on('daemon:error', errorSpy);

      await enhancedDaemon.start();

      // Simulate an error
      enhancedDaemon.emit('daemon:error', new Error('Test error'));

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      await enhancedDaemon.start();
    });

    it('should stop all components successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await enhancedDaemon.stop();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🛑 Enhanced APEX Daemon stopped')
      );

      consoleSpy.mockRestore();
    });

    it('should emit daemon:stopped event', async () => {
      const stoppedSpy = vi.fn();
      enhancedDaemon.on('daemon:stopped', stoppedSpy);

      await enhancedDaemon.stop();

      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should handle stop errors', async () => {
      const mockRunner = enhancedDaemon['daemonRunner'];
      vi.mocked(mockRunner.stop).mockRejectedValue(new Error('Stop failed'));

      const errorSpy = vi.fn();
      enhancedDaemon.on('daemon:error', errorSpy);

      await expect(enhancedDaemon.stop()).rejects.toThrow('Stop failed');
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should cleanup workspaces and checkpoints', async () => {
      const workspaceManager = enhancedDaemon['workspaceManager'];
      const sessionManager = enhancedDaemon['sessionManager'];

      await enhancedDaemon.stop();

      expect(workspaceManager.cleanupOldWorkspaces).toHaveBeenCalled();
      expect(sessionManager.cleanupCheckpoints).toHaveBeenCalled();
    });
  });

  describe('service management', () => {
    it('should install service successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const installedSpy = vi.fn();
      enhancedDaemon.on('service:installed', installedSpy);

      await enhancedDaemon.installService();

      expect(installedSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ APEX Daemon installed as system service')
      );

      consoleSpy.mockRestore();
    });

    it('should uninstall service successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const uninstalledSpy = vi.fn();
      enhancedDaemon.on('service:uninstalled', uninstalledSpy);

      await enhancedDaemon.uninstallService();

      expect(uninstalledSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ APEX Daemon service uninstalled')
      );

      consoleSpy.mockRestore();
    });

    it('should handle service installation errors', async () => {
      const serviceManager = enhancedDaemon['serviceManager'];
      vi.mocked(serviceManager.installService).mockRejectedValue(new Error('Install failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(enhancedDaemon.installService()).rejects.toThrow('Install failed');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to install service:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive status', async () => {
      const status = await enhancedDaemon.getStatus();

      expect(status).toHaveProperty('daemon');
      expect(status).toHaveProperty('service');
      expect(status).toHaveProperty('usage');
      expect(status).toHaveProperty('workspaces');
      expect(status).toHaveProperty('thoughts');
      expect(status).toHaveProperty('health');

      expect(status.daemon.uptime).toBe(1000);
      expect(status.service.installed).toBe(true);
      expect(status.usage.current.currentMode).toBe('day');
      expect(status.workspaces.activeWorkspaces).toBe(2);
      expect(status.health.healthy).toBe(true);
    });
  });

  describe('orchestrator event handlers', () => {
    let mockTask: Task;

    beforeEach(() => {
      mockTask = {
        id: 'test-task-123',
        title: 'Test Task',
        description: 'A test task',
        status: 'running',
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.05,
        },
        workspace: {
          path: '/test/workspace',
          cleanup: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Task;
    });

    it('should handle task:created event', async () => {
      await enhancedDaemon.start();

      const orchestrator = enhancedDaemon['orchestrator'];
      const usageManager = enhancedDaemon['usageManager'];
      const workspaceManager = enhancedDaemon['workspaceManager'];

      // Simulate task creation event
      const eventHandler = vi.mocked(orchestrator.on).mock.calls.find(
        call => call[0] === 'task:created'
      )?.[1] as Function;

      await eventHandler(mockTask);

      expect(usageManager.trackTaskStart).toHaveBeenCalledWith('test-task-123');
      expect(workspaceManager.createWorkspace).toHaveBeenCalledWith(mockTask);
    });

    it('should handle task:completed event', async () => {
      await enhancedDaemon.start();

      const orchestrator = enhancedDaemon['orchestrator'];
      const usageManager = enhancedDaemon['usageManager'];
      const workspaceManager = enhancedDaemon['workspaceManager'];

      // Simulate task completion event
      const eventHandler = vi.mocked(orchestrator.on).mock.calls.find(
        call => call[0] === 'task:completed'
      )?.[1] as Function;

      await eventHandler(mockTask);

      expect(usageManager.trackTaskCompletion).toHaveBeenCalledWith(
        'test-task-123',
        mockTask.usage,
        true
      );
      expect(workspaceManager.cleanupWorkspace).toHaveBeenCalledWith('test-task-123');
    });

    it('should handle task:failed event', async () => {
      await enhancedDaemon.start();

      const orchestrator = enhancedDaemon['orchestrator'];
      const usageManager = enhancedDaemon['usageManager'];

      // Simulate task failure event
      const eventHandler = vi.mocked(orchestrator.on).mock.calls.find(
        call => call[0] === 'task:failed'
      )?.[1] as Function;

      await eventHandler(mockTask);

      expect(usageManager.trackTaskCompletion).toHaveBeenCalledWith(
        'test-task-123',
        mockTask.usage,
        false
      );
    });

    it('should not cleanup workspace for failed task when cleanup is disabled', async () => {
      await enhancedDaemon.start();

      const taskWithoutCleanup = {
        ...mockTask,
        workspace: { path: '/test/workspace', cleanup: false },
      };

      const orchestrator = enhancedDaemon['orchestrator'];
      const workspaceManager = enhancedDaemon['workspaceManager'];

      // Simulate task failure event
      const eventHandler = vi.mocked(orchestrator.on).mock.calls.find(
        call => call[0] === 'task:failed'
      )?.[1] as Function;

      await eventHandler(taskWithoutCleanup);

      expect(workspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await enhancedDaemon.start();
    });

    it('should perform periodic health checks', () => {
      vi.advanceTimersByTime(30000); // Advance by health check interval

      const serviceManager = enhancedDaemon['serviceManager'];
      expect(serviceManager.performHealthCheck).toHaveBeenCalled();
    });

    it('should trigger restart on health check failure', async () => {
      const serviceManager = enhancedDaemon['serviceManager'];
      vi.mocked(serviceManager.performHealthCheck).mockResolvedValue({
        healthy: false,
        errors: ['Service unavailable'],
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.advanceTimersByTime(30000);

      // Allow for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Health check failed:'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should not start health monitoring when disabled', async () => {
      // Stop current daemon
      await enhancedDaemon.stop();

      // Create new daemon with health monitoring disabled
      const configWithoutHealth = {
        ...mockConfig,
        daemon: {
          ...mockConfig.daemon,
          healthCheck: { enabled: false },
        },
      };

      const daemonWithoutHealth = new EnhancedDaemon(mockProjectPath, configWithoutHealth);
      await daemonWithoutHealth.start();

      vi.advanceTimersByTime(60000); // Wait longer than health check interval

      // No health checks should have been performed
      const serviceManager = daemonWithoutHealth['serviceManager'];
      expect(serviceManager.performHealthCheck).not.toHaveBeenCalled();

      await daemonWithoutHealth.stop();
    });
  });

  describe('watchdog functionality', () => {
    beforeEach(async () => {
      await enhancedDaemon.start();
    });

    it('should restart daemon on error when within restart limits', async () => {
      const stopSpy = vi.spyOn(enhancedDaemon, 'stop').mockResolvedValue();
      const startSpy = vi.spyOn(enhancedDaemon, 'start').mockResolvedValue();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Simulate daemon error
      enhancedDaemon.emit('daemon:error', new Error('Test error'));

      // Advance time past restart delay
      vi.advanceTimersByTime(5000);

      // Allow for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Restarting daemon in')
      );

      consoleSpy.mockRestore();
      stopSpy.mockRestore();
      startSpy.mockRestore();
    });

    it('should not restart when watchdog is disabled', async () => {
      // Stop current daemon
      await enhancedDaemon.stop();

      // Create new daemon with watchdog disabled
      const configWithoutWatchdog = {
        ...mockConfig,
        daemon: {
          ...mockConfig.daemon,
          watchdog: { enabled: false },
        },
      };

      const daemonWithoutWatchdog = new EnhancedDaemon(mockProjectPath, configWithoutWatchdog);
      await daemonWithoutWatchdog.start();

      const stopSpy = vi.spyOn(daemonWithoutWatchdog, 'stop');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Simulate daemon error
      daemonWithoutWatchdog.emit('daemon:error', new Error('Test error'));

      // Advance time
      vi.advanceTimersByTime(10000);

      expect(stopSpy).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🔄 Restarting daemon')
      );

      consoleSpy.mockRestore();
      stopSpy.mockRestore();
      await daemonWithoutWatchdog.stop();
    });
  });

  describe('component access methods', () => {
    it('should provide access to usage manager', () => {
      const usageManager = enhancedDaemon.getUsageManager();
      expect(usageManager).toBeDefined();
    });

    it('should provide access to workspace manager', () => {
      const workspaceManager = enhancedDaemon.getWorkspaceManager();
      expect(workspaceManager).toBeDefined();
    });

    it('should provide access to interaction manager', () => {
      const interactionManager = enhancedDaemon.getInteractionManager();
      expect(interactionManager).toBeDefined();
    });

    it('should provide access to thought capture manager', () => {
      const thoughtCapture = enhancedDaemon.getThoughtCapture();
      expect(thoughtCapture).toBeDefined();
    });

    it('should provide access to idle processor', () => {
      const idleProcessor = enhancedDaemon.getIdleProcessor();
      expect(idleProcessor).toBeDefined();
    });

    it('should provide access to service manager', () => {
      const serviceManager = enhancedDaemon.getServiceManager();
      expect(serviceManager).toBeDefined();
    });
  });

  describe('feature status logging', () => {
    it('should log v0.4.0 feature status on start', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await enhancedDaemon.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📋 v0.4.0 Feature Status:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Service Installation')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Time-based Usage')
      );

      consoleSpy.mockRestore();
    });
  });
});