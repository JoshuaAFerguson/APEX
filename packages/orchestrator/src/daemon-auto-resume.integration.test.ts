import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonRunner } from './runner';
import { TaskStore } from './store';
import { ApexOrchestrator } from './index';
import { CapacityMonitor } from './capacity-monitor';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';
import { UsageManager } from './usage-manager';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { Task, TaskStatus, TaskPriority } from '@apexcli/core';

describe('DaemonRunner Auto-Resume Integration', () => {
  let testProjectPath: string;
  let daemonRunner: DaemonRunner;
  let store: TaskStore;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    // Create test project directory
    testProjectPath = join(__dirname, '..', '..', 'test-data', `test-auto-resume-${Date.now()}`);
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.apex'), { recursive: true });

    // Create minimal config file
    const config = {
      version: '1.0',
      agents: {
        'test-agent': {
          description: 'Test agent',
          capabilities: ['test']
        }
      },
      workflows: {
        'test-workflow': {
          name: 'Test workflow',
          stages: ['test']
        }
      },
      daemon: {
        enabled: true,
        pollInterval: 1000,
        logLevel: 'debug' as const
      },
      limits: {
        maxConcurrentTasks: 2,
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.0,
        dailyBudget: 10.0
      }
    };

    writeFileSync(
      join(testProjectPath, '.apex', 'config.yaml'),
      JSON.stringify(config, null, 2)
    );

    // Initialize components
    store = new TaskStore(testProjectPath);
    await store.initialize();

    orchestrator = new ApexOrchestrator({ projectPath: testProjectPath });
    await orchestrator.initialize();

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config
    });
  });

  afterEach(async () => {
    // Cleanup
    if (daemonRunner) {
      await daemonRunner.stop();
    }
    if (store) {
      store.close();
    }
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  it('should integrate CapacityMonitor successfully', async () => {
    // Start the daemon runner
    await daemonRunner.start();

    const metrics = daemonRunner.getMetrics();
    expect(metrics.isRunning).toBe(true);

    // Stop the daemon
    await daemonRunner.stop();

    const finalMetrics = daemonRunner.getMetrics();
    expect(finalMetrics.isRunning).toBe(false);
  });

  it('should have CapacityMonitor initialized', async () => {
    await daemonRunner.start();

    // Access private field through reflection for testing
    const capacityMonitor = (daemonRunner as any).capacityMonitor;
    expect(capacityMonitor).toBeDefined();
    expect(capacityMonitor instanceof CapacityMonitor).toBe(true);

    await daemonRunner.stop();
  });

  it('should create paused tasks and verify auto-resume flow', async () => {
    // Create a paused task
    const taskData: Partial<Task> = {
      description: 'Test paused task',
      acceptanceCriteria: 'Should be auto-resumed',
      workflow: 'test-workflow',
      autonomy: 'autonomous',
      status: 'paused' as TaskStatus,
      priority: 'normal' as TaskPriority,
      projectPath: testProjectPath,
      branchName: 'test-branch',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };

    const taskId = await store.createTask(taskData as Task);

    // Set pause reason to be resumable
    await store.updateTask(taskId, {
      status: 'paused',
      pausedAt: new Date(),
      pauseReason: 'capacity',
      updatedAt: new Date()
    });

    // Verify the task is resumable
    const resumableTasks = await store.getPausedTasksForResume();
    expect(resumableTasks.length).toBe(1);
    expect(resumableTasks[0].id).toBe(taskId);
    expect(resumableTasks[0].status).toBe('paused');
    expect(resumableTasks[0].pauseReason).toBe('capacity');

    // Start daemon runner
    await daemonRunner.start();

    // Simulate capacity restoration event
    const capacityMonitor = (daemonRunner as any).capacityMonitor;
    const usageManager = (daemonRunner as any).usageManager;

    // Mock resumePausedTask to avoid actual execution
    const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

    if (capacityMonitor) {
      // Create a mock capacity restored event
      const mockEvent = {
        reason: 'capacity_dropped' as const,
        timestamp: new Date(),
        previousUsage: {
          currentTokens: 10000,
          currentCost: 1.0,
          activeTasks: 2,
          maxTokensPerTask: 10000,
          maxCostPerTask: 1.0,
          maxConcurrentTasks: 2,
          dailyBudget: 10.0,
          dailySpent: 1.0,
        },
        currentUsage: {
          currentTokens: 5000,
          currentCost: 0.5,
          activeTasks: 1,
          maxTokensPerTask: 10000,
          maxCostPerTask: 1.0,
          maxConcurrentTasks: 2,
          dailyBudget: 10.0,
          dailySpent: 0.5,
        },
        modeInfo: {
          mode: 'day' as const,
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date(Date.now() + 60000),
          nextMidnight: new Date(Date.now() + 86400000),
        }
      };

      // Emit the capacity:restored event
      capacityMonitor.emit('capacity:restored', mockEvent);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify resumePausedTask was called
      expect(mockResumePausedTask).toHaveBeenCalledWith(taskId);
    }

    await daemonRunner.stop();
  });

  it('should emit tasks:auto-resumed event with correct data', async () => {
    let autoResumedEvent: any = null;

    await daemonRunner.start();

    // Listen for the auto-resumed event
    orchestrator.on('tasks:auto-resumed', (event) => {
      autoResumedEvent = event;
    });

    // Create a paused task
    const taskData: Partial<Task> = {
      description: 'Test paused task for event',
      acceptanceCriteria: 'Should emit auto-resumed event',
      workflow: 'test-workflow',
      autonomy: 'autonomous',
      status: 'paused' as TaskStatus,
      priority: 'normal' as TaskPriority,
      projectPath: testProjectPath,
      branchName: 'test-branch',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };

    const taskId = await store.createTask(taskData as Task);

    await store.updateTask(taskId, {
      status: 'paused',
      pausedAt: new Date(),
      pauseReason: 'budget',
      updatedAt: new Date()
    });

    // Mock resumePausedTask
    vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

    const capacityMonitor = (daemonRunner as any).capacityMonitor;

    if (capacityMonitor) {
      const mockEvent = {
        reason: 'budget_reset' as const,
        timestamp: new Date(),
        previousUsage: {
          currentTokens: 10000,
          currentCost: 10.0,
          activeTasks: 0,
          maxTokensPerTask: 10000,
          maxCostPerTask: 1.0,
          maxConcurrentTasks: 2,
          dailyBudget: 10.0,
          dailySpent: 10.0,
        },
        currentUsage: {
          currentTokens: 0,
          currentCost: 0,
          activeTasks: 0,
          maxTokensPerTask: 10000,
          maxCostPerTask: 1.0,
          maxConcurrentTasks: 2,
          dailyBudget: 10.0,
          dailySpent: 0,
        },
        modeInfo: {
          mode: 'day' as const,
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date(Date.now() + 60000),
          nextMidnight: new Date(Date.now() + 86400000),
        }
      };

      // Emit the capacity:restored event
      capacityMonitor.emit('capacity:restored', mockEvent);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the auto-resumed event was emitted
      expect(autoResumedEvent).toBeDefined();
      expect(autoResumedEvent.reason).toBe('budget_reset');
      expect(autoResumedEvent.totalTasks).toBe(1);
      expect(autoResumedEvent.resumedCount).toBe(1);
      expect(autoResumedEvent.errors).toEqual([]);
      expect(autoResumedEvent.timestamp).toBeInstanceOf(Date);

      // Verify enhanced fields (v0.4.0)
      expect(autoResumedEvent.resumeReason).toBeDefined();
      expect(typeof autoResumedEvent.resumeReason).toBe('string');
      expect(autoResumedEvent.resumeReason).toContain('budget');

      expect(autoResumedEvent.contextSummary).toBeDefined();
      expect(typeof autoResumedEvent.contextSummary).toBe('string');
      expect(autoResumedEvent.contextSummary).toContain('1'); // task count
    }

    await daemonRunner.stop();
  });

  it('should handle errors gracefully during auto-resume', async () => {
    let autoResumedEvent: any = null;

    await daemonRunner.start();

    orchestrator.on('tasks:auto-resumed', (event) => {
      autoResumedEvent = event;
    });

    // Create a paused task
    const taskData: Partial<Task> = {
      description: 'Test paused task for error handling',
      acceptanceCriteria: 'Should handle resume errors',
      workflow: 'test-workflow',
      autonomy: 'autonomous',
      status: 'paused' as TaskStatus,
      priority: 'normal' as TaskPriority,
      projectPath: testProjectPath,
      branchName: 'test-branch',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };

    const taskId = await store.createTask(taskData as Task);

    await store.updateTask(taskId, {
      status: 'paused',
      pausedAt: new Date(),
      pauseReason: 'usage_limit',
      updatedAt: new Date()
    });

    // Mock resumePausedTask to throw an error
    vi.spyOn(orchestrator, 'resumePausedTask').mockRejectedValue(new Error('Resume failed'));

    const capacityMonitor = (daemonRunner as any).capacityMonitor;

    if (capacityMonitor) {
      const mockEvent = {
        reason: 'mode_switch' as const,
        timestamp: new Date(),
        previousUsage: {
          currentTokens: 8000,
          currentCost: 0.8,
          activeTasks: 0,
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.5,
          maxConcurrentTasks: 1,
          dailyBudget: 5.0,
          dailySpent: 2.5,
        },
        currentUsage: {
          currentTokens: 8000,
          currentCost: 0.8,
          activeTasks: 0,
          maxTokensPerTask: 10000,
          maxCostPerTask: 1.0,
          maxConcurrentTasks: 2,
          dailyBudget: 10.0,
          dailySpent: 2.5,
        },
        modeInfo: {
          mode: 'night' as const,
          modeHours: [18, 19, 20, 21, 22, 23],
          nextModeSwitch: new Date(Date.now() + 60000),
          nextMidnight: new Date(Date.now() + 86400000),
        }
      };

      // Emit the capacity:restored event
      capacityMonitor.emit('capacity:restored', mockEvent);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the auto-resumed event captures the error
      expect(autoResumedEvent).toBeDefined();
      expect(autoResumedEvent.reason).toBe('mode_switch');
      expect(autoResumedEvent.totalTasks).toBe(1);
      expect(autoResumedEvent.resumedCount).toBe(0);
      expect(autoResumedEvent.errors.length).toBe(1);
      expect(autoResumedEvent.errors[0].taskId).toBe(taskId);
      expect(autoResumedEvent.errors[0].error).toBe('Resume failed');
    }

    await daemonRunner.stop();
  });
});