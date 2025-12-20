import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { EnhancedDaemon } from './enhanced-daemon';
import { ApexConfig } from '@apexcli/core';

describe('EnhancedDaemon Integration Tests', () => {
  let enhancedDaemon: EnhancedDaemon;
  let testProjectPath: string;
  let testConfig: ApexConfig;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Create a temporary test directory
    testProjectPath = join(process.cwd(), 'test-temp-project');

    // Ensure test directory exists
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, '.apex'), { recursive: true });

    testConfig = {
      version: '1.0',
      project: { name: 'integration-test-project' },
      daemon: {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeThresholds: {
            maxTokensPerTask: 100000,
            maxCostPerTask: 5.0,
            maxConcurrentTasks: 2,
          },
          nightModeThresholds: {
            maxTokensPerTask: 1000000,
            maxCostPerTask: 20.0,
            maxConcurrentTasks: 5,
          },
        },
        sessionRecovery: {
          enabled: true,
          autoResume: true,
          contextSummarizationThreshold: 50,
        },
        idleProcessing: {
          enabled: true,
          idleThreshold: 60000, // 1 minute for faster testing
          taskGenerationInterval: 120000, // 2 minutes for faster testing
          maxIdleTasks: 2,
        },
        healthCheck: {
          enabled: true,
          interval: 10000, // 10 seconds for faster testing
        },
        watchdog: {
          enabled: true,
          maxRestarts: 3,
          restartDelay: 1000, // 1 second for faster testing
          restartWindow: 60000, // 1 minute for faster testing
        },
        installAsService: false, // Disabled for testing
      },
      limits: {
        maxTokensPerTask: 500000,
        maxCostPerTask: 10.0,
        maxConcurrentTasks: 3,
        dailyBudget: 100.0,
      },
    };

    // Create package.json for project analysis
    await fs.writeFile(
      join(testProjectPath, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: {
          'react': '^18.0.0',
          'old-lib': '^0.1.0',
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'old-test': '~0.5.0',
        },
      }),
      'utf-8'
    );

    // Create some test source files
    await fs.mkdir(join(testProjectPath, 'src'), { recursive: true });
    await fs.writeFile(
      join(testProjectPath, 'src', 'component.ts'),
      'export function component() {\n  return "hello";\n}\n',
      'utf-8'
    );
    await fs.writeFile(
      join(testProjectPath, 'src', 'utils.js'),
      'function util() {\n  return true;\n}\n',
      'utf-8'
    );

    enhancedDaemon = new EnhancedDaemon(testProjectPath, testConfig);
  });

  afterEach(async () => {
    vi.useRealTimers();

    // Stop daemon if running
    try {
      await enhancedDaemon.stop();
    } catch {
      // Ignore if already stopped
    }

    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('full daemon lifecycle', () => {
    it('should start, run, and stop without errors', async () => {
      let daemonStarted = false;
      let daemonStopped = false;

      enhancedDaemon.on('daemon:started', () => {
        daemonStarted = true;
      });

      enhancedDaemon.on('daemon:stopped', () => {
        daemonStopped = true;
      });

      // Start the daemon
      await enhancedDaemon.start();
      expect(daemonStarted).toBe(true);

      // Verify daemon is running by getting status
      const status = await enhancedDaemon.getStatus();
      expect(status.daemon).toBeDefined();
      expect(status.service).toBeDefined();
      expect(status.usage).toBeDefined();

      // Stop the daemon
      await enhancedDaemon.stop();
      expect(daemonStopped).toBe(true);
    });

    it('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await enhancedDaemon.start();
        const status = await enhancedDaemon.getStatus();
        expect(status).toBeDefined();

        await enhancedDaemon.stop();
      }
    });
  });

  describe('component integration', () => {
    beforeEach(async () => {
      await enhancedDaemon.start();
    });

    it('should integrate usage tracking with task lifecycle', async () => {
      const usageManager = enhancedDaemon.getUsageManager();

      // Check initial state
      const initialStats = usageManager.getUsageStats();
      expect(initialStats.active).toHaveLength(0);

      // Simulate task start
      usageManager.trackTaskStart('integration-test-task');

      const afterStartStats = usageManager.getUsageStats();
      expect(afterStartStats.active).toHaveLength(1);
      expect(afterStartStats.current.dailyUsage.peakConcurrentTasks).toBe(1);

      // Simulate task completion
      usageManager.trackTaskCompletion('integration-test-task', {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.05,
      }, true);

      const afterCompletionStats = usageManager.getUsageStats();
      expect(afterCompletionStats.active).toHaveLength(0);
      expect(afterCompletionStats.current.dailyUsage.tasksCompleted).toBe(1);
      expect(afterCompletionStats.current.dailyUsage.totalCost).toBe(0.05);
    });

    it('should integrate session recovery with checkpoints', async () => {
      const sessionManager = enhancedDaemon['sessionManager'];

      // Create a checkpoint
      const mockTask = {
        id: 'test-recovery-task',
        title: 'Test Recovery Task',
        description: 'Testing session recovery',
        status: 'running',
        currentStage: 'implementation',
        usage: {
          inputTokens: 500,
          outputTokens: 300,
          totalTokens: 800,
          estimatedCost: 0.03,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockConversation = [
        {
          type: 'user' as const,
          timestamp: new Date(),
          content: [{ type: 'text' as const, text: 'Start task' }],
        },
        {
          type: 'assistant' as const,
          timestamp: new Date(),
          content: [{ type: 'text' as const, text: 'Task started successfully' }],
        },
      ];

      const checkpoint = await sessionManager.createCheckpoint(
        mockTask as any,
        mockConversation,
        { progress: 0.5 }
      );

      expect(checkpoint.taskId).toBe('test-recovery-task');
      expect(checkpoint.stage).toBe('implementation');

      // Restore the session
      const restored = await sessionManager.restoreSession('test-recovery-task');
      expect(restored.canResume).toBe(true);
      expect(restored.checkpoint?.taskId).toBe('test-recovery-task');
    });

    it('should integrate workspace management', async () => {
      const workspaceManager = enhancedDaemon.getWorkspaceManager();

      const mockTask = {
        id: 'workspace-test-task',
        workspace: {
          path: join(testProjectPath, 'workspace'),
          cleanup: true,
        },
      };

      // Create workspace
      await workspaceManager.createWorkspace(mockTask as any);

      // Verify workspace was created
      const stats = await workspaceManager.getWorkspaceStats();
      expect(stats.activeWorkspaces).toBeGreaterThanOrEqual(1);

      // Cleanup workspace
      await workspaceManager.cleanupWorkspace('workspace-test-task');
    });
  });

  describe('idle processing integration', () => {
    beforeEach(async () => {
      await enhancedDaemon.start();
    });

    it('should detect idle time and generate suggestions', async () => {
      const idleProcessor = enhancedDaemon.getIdleProcessor();
      let taskSuggested = false;

      idleProcessor.on('task:suggested', () => {
        taskSuggested = true;
      });

      // Manually trigger idle processing
      await idleProcessor.processIdleTime();

      // Should have generated some improvement suggestions
      const generatedTasks = idleProcessor.getGeneratedTasks();
      expect(generatedTasks.length).toBeGreaterThan(0);

      // Check for dependency update task (since we have old dependencies)
      const depTask = generatedTasks.find(task =>
        task.type === 'maintenance' && task.title.includes('Dependencies')
      );
      expect(depTask).toBeDefined();

      expect(taskSuggested).toBe(true);
    });

    it('should implement idle tasks', async () => {
      const idleProcessor = enhancedDaemon.getIdleProcessor();

      // Generate tasks
      await idleProcessor.processIdleTime();
      const tasks = idleProcessor.getGeneratedTasks();
      expect(tasks.length).toBeGreaterThan(0);

      // Mock task creation
      const mockStore = enhancedDaemon['store'];
      vi.mocked(mockStore.createTask).mockResolvedValue({
        id: 'implemented-task-123',
      } as any);

      // Implement the first task
      const firstTask = tasks[0];
      const implementedTaskId = await idleProcessor.implementIdleTask(firstTask.id);

      expect(implementedTaskId).toBe('implemented-task-123');
      expect(firstTask.implemented).toBe(true);
    });
  });

  describe('health monitoring integration', () => {
    beforeEach(async () => {
      await enhancedDaemon.start();
    });

    it('should perform periodic health checks', async () => {
      const serviceManager = enhancedDaemon.getServiceManager();
      const healthCheckSpy = vi.spyOn(serviceManager, 'performHealthCheck');

      // Wait for health check interval
      vi.advanceTimersByTime(10000);

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(healthCheckSpy).toHaveBeenCalled();
    });

    it('should handle health check failures gracefully', async () => {
      const serviceManager = enhancedDaemon.getServiceManager();

      // Mock health check failure
      vi.mocked(serviceManager.performHealthCheck).mockResolvedValue({
        healthy: false,
        errors: ['Service connection failed', 'Database unavailable'],
      });

      let errorLogged = false;
      const originalWarn = console.warn;
      console.warn = (...args) => {
        if (args[0]?.toString().includes('Health check failed')) {
          errorLogged = true;
        }
        originalWarn(...args);
      };

      // Trigger health check
      vi.advanceTimersByTime(10000);

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(errorLogged).toBe(true);

      console.warn = originalWarn;
    });
  });

  describe('error handling and recovery', () => {
    beforeEach(async () => {
      await enhancedDaemon.start();
    });

    it('should handle component initialization failures gracefully', async () => {
      // Stop current daemon
      await enhancedDaemon.stop();

      // Create daemon with failing component
      const mockStore = {
        initialize: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      const daemonWithFailingStore = Object.create(enhancedDaemon);
      daemonWithFailingStore.store = mockStore;

      let errorEmitted = false;
      daemonWithFailingStore.on('daemon:error', () => {
        errorEmitted = true;
      });

      await expect(daemonWithFailingStore.start()).rejects.toThrow('Database connection failed');
      expect(errorEmitted).toBe(true);
    });

    it('should handle watchdog restart scenarios', async () => {
      const restartSpy = vi.fn();
      enhancedDaemon['restartDaemon'] = restartSpy.mockResolvedValue(undefined);

      // Simulate multiple errors within restart window
      enhancedDaemon.emit('daemon:error', new Error('Error 1'));
      vi.advanceTimersByTime(1000);

      enhancedDaemon.emit('daemon:error', new Error('Error 2'));
      vi.advanceTimersByTime(1000);

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(restartSpy).toHaveBeenCalled();
    });
  });

  describe('configuration scenarios', () => {
    it('should handle minimal configuration', async () => {
      await enhancedDaemon.stop();

      const minimalConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'minimal-test' },
      };

      const minimalDaemon = new EnhancedDaemon(testProjectPath, minimalConfig);

      await expect(minimalDaemon.start()).resolves.toBeUndefined();
      await expect(minimalDaemon.stop()).resolves.toBeUndefined();
    });

    it('should respect disabled features', async () => {
      await enhancedDaemon.stop();

      const disabledConfig: ApexConfig = {
        ...testConfig,
        daemon: {
          timeBasedUsage: { enabled: false },
          sessionRecovery: { enabled: false },
          idleProcessing: { enabled: false },
          healthCheck: { enabled: false },
          watchdog: { enabled: false },
        },
      };

      const disabledDaemon = new EnhancedDaemon(testProjectPath, disabledConfig);

      await disabledDaemon.start();

      // Advance time to check that disabled features don't activate
      vi.advanceTimersByTime(60000);

      const idleProcessor = disabledDaemon.getIdleProcessor();
      const tasks = idleProcessor.getGeneratedTasks();
      expect(tasks).toHaveLength(0); // No tasks should be generated

      await disabledDaemon.stop();
    });
  });

  describe('time-based usage integration', () => {
    beforeEach(async () => {
      await enhancedDaemon.start();
    });

    it('should apply different thresholds for day and night modes', () => {
      const usageManager = enhancedDaemon.getUsageManager();

      // Set time to day mode (2 PM)
      vi.setSystemTime(new Date('2024-01-01T14:00:00Z'));

      const dayUsage = usageManager.getCurrentUsage();
      expect(dayUsage.currentMode).toBe('day');
      expect(dayUsage.thresholds.maxCostPerTask).toBe(5.0);
      expect(dayUsage.thresholds.maxConcurrentTasks).toBe(2);

      // Set time to night mode (2 AM)
      vi.setSystemTime(new Date('2024-01-01T02:00:00Z'));

      const nightUsage = usageManager.getCurrentUsage();
      expect(nightUsage.currentMode).toBe('night');
      expect(nightUsage.thresholds.maxCostPerTask).toBe(20.0);
      expect(nightUsage.thresholds.maxConcurrentTasks).toBe(5);
    });

    it('should enforce usage limits correctly', () => {
      const usageManager = enhancedDaemon.getUsageManager();

      // Set to day mode with strict limits
      vi.setSystemTime(new Date('2024-01-01T14:00:00Z'));

      // Start maximum concurrent tasks
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      const canStartResult = usageManager.canStartTask();
      expect(canStartResult.allowed).toBe(false);
      expect(canStartResult.reason).toContain('Maximum concurrent tasks reached');
    });
  });
});