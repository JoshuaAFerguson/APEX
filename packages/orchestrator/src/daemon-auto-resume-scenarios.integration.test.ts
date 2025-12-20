import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonRunner } from './runner';
import { TaskStore } from './store';
import { ApexOrchestrator } from './index';
import { CapacityMonitor } from './capacity-monitor';
import { UsageManager } from './usage-manager';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { Task, TaskStatus, TaskPriority, AutonomyLevel } from '@apexcli/core';

/**
 * Integration tests for auto-resume scenarios covering time-based and capacity-based triggers.
 * Tests use Vitest fake timers to mock time progression and validate auto-resume behavior.
 *
 * Scenarios tested:
 * 1. Resume on day→night mode switch (expanded limits)
 * 2. Resume on night→day mode switch (different limits)
 * 3. Resume at midnight budget reset (daily budget refresh)
 * 4. Resume when capacity naturally drops below threshold (task completion)
 */
describe('Auto-Resume Scenarios Integration', () => {
  let testProjectPath: string;
  let daemonRunner: DaemonRunner;
  let store: TaskStore;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    // Enable fake timers for time-based testing
    vi.useFakeTimers();

    // Create test project directory
    testProjectPath = join(__dirname, '..', '..', 'test-data', `test-auto-resume-scenarios-${Date.now()}`);
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.apex'), { recursive: true });

    // Create minimal config file with time-based usage enabled
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
        maxTokensPerTask: 5000,   // Lower day limits
        maxCostPerTask: 0.5,
        dailyBudget: 10.0
      },
      timeBasedUsage: {
        enabled: true,
        dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nightModeHours: [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8],
        dayModeThresholds: {
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.5,
          maxConcurrentTasks: 1
        },
        nightModeThresholds: {
          maxTokensPerTask: 15000,   // Higher night limits
          maxCostPerTask: 1.5,
          maxConcurrentTasks: 3
        }
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
    vi.useRealTimers();
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

  /**
   * Helper to create a paused task for testing
   */
  async function createPausedTask(pauseReason: string, description: string = 'Test paused task'): Promise<string> {
    const taskData: Partial<Task> = {
      description,
      acceptanceCriteria: 'Should be auto-resumed',
      workflow: 'test-workflow',
      autonomy: 'full',
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
      pauseReason,
      updatedAt: new Date()
    });

    return taskId;
  }

  /**
   * Helper to wait for async event processing
   */
  async function waitForEventProcessing(): Promise<void> {
    await vi.advanceTimersByTimeAsync(100);
  }

  describe('Scenario 1: Day→Night Mode Switch Auto-Resume', () => {
    it('should auto-resume paused tasks when switching from day mode to night mode', async () => {
      // Set time to afternoon (day mode)
      vi.setSystemTime(new Date('2024-01-01T15:00:00Z')); // 3 PM UTC

      // Create a task paused due to day mode limits
      const taskId = await createPausedTask('usage_limit', 'Task paused due to day mode token limit');

      // Verify task is resumable
      const resumableTasks = await store.getPausedTasksForResume();
      expect(resumableTasks.length).toBe(1);
      expect(resumableTasks[0].id).toBe(taskId);
      expect(resumableTasks[0].pauseReason).toBe('usage_limit');

      let autoResumedEvent: any = null;

      // Start daemon and listen for auto-resume event
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      // Mock resumePausedTask to avoid actual execution
      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Advance time to night mode transition (6 PM UTC)
      vi.setSystemTime(new Date('2024-01-01T18:00:00Z'));
      await vi.advanceTimersByTimeAsync(2000); // Allow timer to trigger + buffer

      await waitForEventProcessing();

      // Verify auto-resume was triggered
      expect(mockResumePausedTask).toHaveBeenCalledWith(taskId);
      expect(autoResumedEvent).toBeDefined();
      expect(autoResumedEvent.reason).toBe('mode_switch');
      expect(autoResumedEvent.resumedCount).toBe(1);
      expect(autoResumedEvent.totalTasks).toBe(1);
      expect(autoResumedEvent.errors).toEqual([]);

      await daemonRunner.stop();
    });

    it('should handle multiple tasks during day→night mode switch', async () => {
      vi.setSystemTime(new Date('2024-01-01T16:00:00Z')); // 4 PM UTC

      // Create multiple paused tasks
      const taskId1 = await createPausedTask('capacity', 'Task 1 paused for capacity');
      const taskId2 = await createPausedTask('usage_limit', 'Task 2 paused for usage limit');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Transition to night mode
      vi.setSystemTime(new Date('2024-01-01T18:00:00Z'));
      await vi.advanceTimersByTimeAsync(2000);
      await waitForEventProcessing();

      // Both tasks should be resumed
      expect(mockResumePausedTask).toHaveBeenCalledTimes(2);
      expect(mockResumePausedTask).toHaveBeenCalledWith(taskId1);
      expect(mockResumePausedTask).toHaveBeenCalledWith(taskId2);
      expect(autoResumedEvent.resumedCount).toBe(2);
      expect(autoResumedEvent.totalTasks).toBe(2);

      await daemonRunner.stop();
    });
  });

  describe('Scenario 2: Night→Day Mode Switch Auto-Resume', () => {
    it('should auto-resume paused tasks when switching from night mode to day mode', async () => {
      // Set time to early morning (night mode)
      vi.setSystemTime(new Date('2024-01-01T06:00:00Z')); // 6 AM UTC

      const taskId = await createPausedTask('budget', 'Task paused due to night budget constraints');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Advance time to day mode transition (9 AM UTC)
      vi.setSystemTime(new Date('2024-01-01T09:00:00Z'));
      await vi.advanceTimersByTimeAsync(2000);
      await waitForEventProcessing();

      // Verify auto-resume
      expect(mockResumePausedTask).toHaveBeenCalledWith(taskId);
      expect(autoResumedEvent).toBeDefined();
      expect(autoResumedEvent.reason).toBe('mode_switch');
      expect(autoResumedEvent.resumedCount).toBe(1);

      await daemonRunner.stop();
    });

    it('should handle transition from night mode with different threshold validation', async () => {
      vi.setSystemTime(new Date('2024-01-01T08:00:00Z')); // 8 AM UTC (still night mode)

      // Create task paused due to night mode specific limits
      const taskId = await createPausedTask('capacity', 'Task paused despite higher night limits');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Move to day mode
      vi.setSystemTime(new Date('2024-01-01T09:00:00Z'));
      await vi.advanceTimersByTimeAsync(2000);
      await waitForEventProcessing();

      expect(autoResumedEvent.reason).toBe('mode_switch');
      expect(autoResumedEvent.modeInfo?.mode).toBe('day');
      expect(autoResumedEvent.resumedCount).toBe(1);

      await daemonRunner.stop();
    });
  });

  describe('Scenario 3: Midnight Budget Reset Auto-Resume', () => {
    it('should auto-resume paused tasks at midnight when daily budget resets', async () => {
      // Set time to late evening before midnight
      vi.setSystemTime(new Date('2024-01-01T23:30:00Z')); // 11:30 PM UTC

      const taskId = await createPausedTask('budget', 'Task paused due to daily budget exhaustion');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Advance time to midnight (budget reset)
      vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
      await vi.advanceTimersByTimeAsync(2000);
      await waitForEventProcessing();

      // Verify budget reset triggered auto-resume
      expect(mockResumePausedTask).toHaveBeenCalledWith(taskId);
      expect(autoResumedEvent).toBeDefined();
      expect(autoResumedEvent.reason).toBe('budget_reset');
      expect(autoResumedEvent.resumedCount).toBe(1);

      await daemonRunner.stop();
    });

    it('should handle multiple budget-paused tasks at midnight reset', async () => {
      vi.setSystemTime(new Date('2024-01-01T23:45:00Z')); // 11:45 PM UTC

      // Create multiple budget-paused tasks
      const taskId1 = await createPausedTask('budget', 'Task 1 paused - budget exhausted');
      const taskId2 = await createPausedTask('budget', 'Task 2 paused - budget exhausted');
      const taskId3 = await createPausedTask('capacity', 'Task 3 paused - capacity (should also resume)');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Cross midnight
      vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
      await vi.advanceTimersByTimeAsync(2000);
      await waitForEventProcessing();

      // All tasks should be resumed
      expect(mockResumePausedTask).toHaveBeenCalledTimes(3);
      expect(autoResumedEvent.reason).toBe('budget_reset');
      expect(autoResumedEvent.resumedCount).toBe(3);
      expect(autoResumedEvent.totalTasks).toBe(3);

      await daemonRunner.stop();
    });

    it('should handle midnight reset during mode transition correctly', async () => {
      // Set to 11:50 PM (night mode) approaching midnight
      vi.setSystemTime(new Date('2024-01-01T23:50:00Z'));

      const taskId = await createPausedTask('budget', 'Task paused at end of day');

      let autoResumedEvents: any[] = [];
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvents.push(event);
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Jump to midnight (this should trigger budget reset, not mode switch)
      vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
      await vi.advanceTimersByTimeAsync(2000);
      await waitForEventProcessing();

      // Should get budget_reset event specifically
      expect(autoResumedEvents.length).toBe(1);
      expect(autoResumedEvents[0].reason).toBe('budget_reset');
      expect(autoResumedEvents[0].resumedCount).toBe(1);

      await daemonRunner.stop();
    });
  });

  describe('Scenario 4: Capacity Drop Auto-Resume', () => {
    it('should auto-resume paused tasks when capacity naturally drops below threshold', async () => {
      vi.setSystemTime(new Date('2024-01-01T14:00:00Z')); // 2 PM UTC (day mode)

      const taskId = await createPausedTask('capacity', 'Task paused due to capacity constraints');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Get access to capacity monitor for direct event emission
      const capacityMonitor = (daemonRunner as any).capacityMonitor;
      expect(capacityMonitor).toBeInstanceOf(CapacityMonitor);

      // Simulate a capacity drop event (e.g., task completion freeing resources)
      const mockEvent = {
        reason: 'capacity_dropped' as const,
        timestamp: new Date(),
        previousUsage: {
          currentTokens: 8000,
          currentCost: 0.8,
          activeTasks: 2,   // Was at limit
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.5,
          maxConcurrentTasks: 1,
          dailyBudget: 10.0,
          dailySpent: 2.5,
        },
        currentUsage: {
          currentTokens: 4000,
          currentCost: 0.4,
          activeTasks: 1,   // Now below limit
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.5,
          maxConcurrentTasks: 1,
          dailyBudget: 10.0,
          dailySpent: 2.5,
        },
        modeInfo: {
          mode: 'day' as const,
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date(Date.now() + 3600000), // 1 hour from now
          nextMidnight: new Date(Date.now() + 36000000), // 10 hours from now
        }
      };

      // Emit the capacity:restored event
      capacityMonitor.emit('capacity:restored', mockEvent);
      await waitForEventProcessing();

      // Verify auto-resume
      expect(mockResumePausedTask).toHaveBeenCalledWith(taskId);
      expect(autoResumedEvent).toBeDefined();
      expect(autoResumedEvent.reason).toBe('capacity_dropped');
      expect(autoResumedEvent.resumedCount).toBe(1);

      await daemonRunner.stop();
    });

    it('should handle token threshold drop scenario', async () => {
      vi.setSystemTime(new Date('2024-01-01T10:00:00Z')); // 10 AM UTC

      const taskId = await createPausedTask('usage_limit', 'Task paused due to token usage');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);
      const capacityMonitor = (daemonRunner as any).capacityMonitor;

      // Simulate token usage dropping below threshold
      const mockEvent = {
        reason: 'capacity_dropped' as const,
        timestamp: new Date(),
        previousUsage: {
          currentTokens: 9000,  // Was over day limit
          currentCost: 0.3,
          activeTasks: 1,
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.5,
          maxConcurrentTasks: 1,
          dailyBudget: 10.0,
          dailySpent: 1.2,
        },
        currentUsage: {
          currentTokens: 2000,  // Now well below limit
          currentCost: 0.3,
          activeTasks: 1,
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.5,
          maxConcurrentTasks: 1,
          dailyBudget: 10.0,
          dailySpent: 1.2,
        },
        modeInfo: {
          mode: 'day' as const,
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date(Date.now() + 28800000), // 8 hours
          nextMidnight: new Date(Date.now() + 50400000), // 14 hours
        }
      };

      capacityMonitor.emit('capacity:restored', mockEvent);
      await waitForEventProcessing();

      expect(autoResumedEvent.reason).toBe('capacity_dropped');
      expect(autoResumedEvent.resumedCount).toBe(1);

      await daemonRunner.stop();
    });

    it('should handle cost threshold drop scenario', async () => {
      vi.setSystemTime(new Date('2024-01-01T19:00:00Z')); // 7 PM UTC (night mode)

      const taskId = await createPausedTask('budget', 'Task paused due to cost limits');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);
      const capacityMonitor = (daemonRunner as any).capacityMonitor;

      // Simulate cost dropping in night mode
      const mockEvent = {
        reason: 'capacity_dropped' as const,
        timestamp: new Date(),
        previousUsage: {
          currentTokens: 5000,
          currentCost: 2.0,  // Was over night limit
          activeTasks: 2,
          maxTokensPerTask: 15000,
          maxCostPerTask: 1.5,
          maxConcurrentTasks: 3,
          dailyBudget: 10.0,
          dailySpent: 8.0,
        },
        currentUsage: {
          currentTokens: 5000,
          currentCost: 1.0,  // Now below limit
          activeTasks: 2,
          maxTokensPerTask: 15000,
          maxCostPerTask: 1.5,
          maxConcurrentTasks: 3,
          dailyBudget: 10.0,
          dailySpent: 8.0,
        },
        modeInfo: {
          mode: 'night' as const,
          modeHours: [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8],
          nextModeSwitch: new Date(Date.now() + 43200000), // 12 hours to day
          nextMidnight: new Date(Date.now() + 18000000), // 5 hours to midnight
        }
      };

      capacityMonitor.emit('capacity:restored', mockEvent);
      await waitForEventProcessing();

      expect(autoResumedEvent.reason).toBe('capacity_dropped');
      expect(autoResumedEvent.resumedCount).toBe(1);
      expect(autoResumedEvent.modeInfo?.mode).toBe('night');

      await daemonRunner.stop();
    });
  });

  describe('Error Handling in Auto-Resume Scenarios', () => {
    it('should handle errors during mode switch auto-resume', async () => {
      vi.setSystemTime(new Date('2024-01-01T17:30:00Z')); // 5:30 PM UTC

      const taskId1 = await createPausedTask('capacity', 'Task that will resume successfully');
      const taskId2 = await createPausedTask('usage_limit', 'Task that will fail to resume');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      // Mock resumePausedTask to succeed for first task, fail for second
      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask')
        .mockImplementation(async (taskId: string) => {
          if (taskId === taskId1) {
            return true;
          } else {
            throw new Error('Failed to resume task');
          }
        });

      // Transition to night mode
      vi.setSystemTime(new Date('2024-01-01T18:00:00Z'));
      await vi.advanceTimersByTimeAsync(2000);
      await waitForEventProcessing();

      expect(autoResumedEvent).toBeDefined();
      expect(autoResumedEvent.reason).toBe('mode_switch');
      expect(autoResumedEvent.totalTasks).toBe(2);
      expect(autoResumedEvent.resumedCount).toBe(1);
      expect(autoResumedEvent.errors.length).toBe(1);
      expect(autoResumedEvent.errors[0].taskId).toBe(taskId2);
      expect(autoResumedEvent.errors[0].error).toBe('Failed to resume task');

      await daemonRunner.stop();
    });

    it('should handle errors during capacity drop auto-resume', async () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z')); // Noon UTC

      const taskId = await createPausedTask('capacity', 'Task that will error on resume');

      let autoResumedEvent: any = null;
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvent = event;
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask')
        .mockRejectedValue(new Error('Network error during resume'));

      const capacityMonitor = (daemonRunner as any).capacityMonitor;

      const mockEvent = {
        reason: 'capacity_dropped' as const,
        timestamp: new Date(),
        previousUsage: {
          currentTokens: 6000,
          currentCost: 0.6,
          activeTasks: 1,
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.5,
          maxConcurrentTasks: 1,
          dailyBudget: 10.0,
          dailySpent: 3.0,
        },
        currentUsage: {
          currentTokens: 1000,
          currentCost: 0.1,
          activeTasks: 0,
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.5,
          maxConcurrentTasks: 1,
          dailyBudget: 10.0,
          dailySpent: 3.0,
        },
        modeInfo: {
          mode: 'day' as const,
          modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nextModeSwitch: new Date(Date.now() + 21600000),
          nextMidnight: new Date(Date.now() + 43200000),
        }
      };

      capacityMonitor.emit('capacity:restored', mockEvent);
      await waitForEventProcessing();

      expect(autoResumedEvent).toBeDefined();
      expect(autoResumedEvent.reason).toBe('capacity_dropped');
      expect(autoResumedEvent.totalTasks).toBe(1);
      expect(autoResumedEvent.resumedCount).toBe(0);
      expect(autoResumedEvent.errors.length).toBe(1);
      expect(autoResumedEvent.errors[0].error).toBe('Network error during resume');

      await daemonRunner.stop();
    });
  });

  describe('Complex Timing Scenarios', () => {
    it('should handle rapid mode switches without duplicate resumes', async () => {
      // Start at the edge of day mode
      vi.setSystemTime(new Date('2024-01-01T17:59:00Z')); // 5:59 PM UTC

      const taskId = await createPausedTask('usage_limit', 'Task to test rapid mode switches');

      let autoResumedEvents: any[] = [];
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvents.push(event);
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Transition to night mode
      vi.setSystemTime(new Date('2024-01-01T18:00:00Z'));
      await vi.advanceTimersByTimeAsync(2000);
      await waitForEventProcessing();

      // Quickly transition back (edge case testing)
      vi.setSystemTime(new Date('2024-01-01T17:58:00Z')); // Go back to day mode
      await vi.advanceTimersByTimeAsync(1000);
      await waitForEventProcessing();

      // Should only have one auto-resume event despite rapid changes
      expect(autoResumedEvents.length).toBe(1);
      expect(autoResumedEvents[0].reason).toBe('mode_switch');
      expect(mockResumePausedTask).toHaveBeenCalledWith(taskId);

      await daemonRunner.stop();
    });

    it('should prioritize budget reset over mode switch at midnight', async () => {
      // Set time just before midnight during a mode transition period
      vi.setSystemTime(new Date('2024-01-01T23:59:30Z')); // 11:59:30 PM UTC

      const taskId = await createPausedTask('budget', 'Task paused by budget at end of day');

      let autoResumedEvents: any[] = [];
      await daemonRunner.start();
      orchestrator.on('tasks:auto-resumed', (event) => {
        autoResumedEvents.push(event);
      });

      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Jump to midnight
      vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
      await vi.advanceTimersByTimeAsync(3000); // Allow both timers to potentially fire
      await waitForEventProcessing();

      // Should get budget reset, not mode switch
      expect(autoResumedEvents.length).toBe(1);
      expect(autoResumedEvents[0].reason).toBe('budget_reset');
      expect(mockResumePausedTask).toHaveBeenCalledWith(taskId);

      await daemonRunner.stop();
    });
  });
});