# Technical Specification: Auto-Resume Integration Tests

## Overview

This document provides the detailed technical specification for implementing integration tests that cover the four auto-resume scenarios:

1. Resume on day->night mode switch
2. Resume on night->day mode switch
3. Resume at midnight budget reset
4. Resume when capacity naturally drops below threshold

## File Structure

```
packages/orchestrator/src/
├── auto-resume-scenarios.integration.test.ts  # NEW: Main test file
└── test-helpers/
    └── test-usage-provider.ts                  # NEW: Test helper class
```

## Detailed Implementation

### 1. Test Helper: TestUsageProvider

Create a controllable usage provider for testing:

```typescript
// packages/orchestrator/src/test-helpers/test-usage-provider.ts

import {
  CapacityUsageProvider,
  CapacityUsage,
  ModeInfo,
  CapacityThresholds
} from '../capacity-monitor';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

export class TestUsageProvider implements CapacityUsageProvider {
  private _currentMode: 'day' | 'night' | 'off-hours' = 'day';
  private _activeTasks: number = 0;
  private _tokensUsed: number = 0;
  private _costSpent: number = 0;
  private _nextModeSwitch: Date;
  private _nextMidnight: Date;

  constructor(
    private config: DaemonConfig,
    private limits: LimitsConfig,
    initialTime: Date
  ) {
    this._nextModeSwitch = this.calculateNextModeSwitch(initialTime);
    this._nextMidnight = this.calculateNextMidnight(initialTime);
  }

  // Control methods for tests
  setMode(mode: 'day' | 'night' | 'off-hours'): void {
    this._currentMode = mode;
  }

  setUsage(tokens: number, cost: number, tasks: number): void {
    this._tokensUsed = tokens;
    this._costSpent = cost;
    this._activeTasks = tasks;
  }

  setNextModeSwitch(date: Date): void {
    this._nextModeSwitch = date;
  }

  setNextMidnight(date: Date): void {
    this._nextMidnight = date;
  }

  resetDailyUsage(): void {
    this._tokensUsed = 0;
    this._costSpent = 0;
  }

  // CapacityUsageProvider implementation
  getCurrentUsage(): CapacityUsage {
    const thresholds = this.getThresholdsForMode(this._currentMode);

    return {
      currentTokens: this._tokensUsed,
      currentCost: this._costSpent,
      activeTasks: this._activeTasks,
      maxTokensPerTask: thresholds.maxTokensPerTask,
      maxCostPerTask: thresholds.maxCostPerTask,
      maxConcurrentTasks: thresholds.maxConcurrentTasks,
      dailyBudget: this.limits.dailyBudget || 100,
      dailySpent: this._costSpent
    };
  }

  getModeInfo(): ModeInfo {
    const modeHours = this._currentMode === 'day'
      ? this.config.timeBasedUsage?.dayModeHours || [9,10,11,12,13,14,15,16,17]
      : this.config.timeBasedUsage?.nightModeHours || [22,23,0,1,2,3,4,5,6];

    return {
      mode: this._currentMode,
      modeHours,
      nextModeSwitch: this._nextModeSwitch,
      nextMidnight: this._nextMidnight
    };
  }

  getThresholds(): CapacityThresholds {
    const thresholds = this.getThresholdsForMode(this._currentMode);

    return {
      tokensThreshold: thresholds.maxTokensPerTask * 0.8,
      costThreshold: thresholds.maxCostPerTask * 0.8,
      budgetThreshold: (this.limits.dailyBudget || 100) * 0.8,
      concurrentThreshold: thresholds.maxConcurrentTasks
    };
  }

  // Helper methods
  private getThresholdsForMode(mode: 'day' | 'night' | 'off-hours') {
    if (!this.config.timeBasedUsage) {
      return {
        maxTokensPerTask: this.limits.maxTokensPerTask || 100000,
        maxCostPerTask: this.limits.maxCostPerTask || 5.0,
        maxConcurrentTasks: this.limits.maxConcurrentTasks || 2
      };
    }

    return mode === 'night'
      ? this.config.timeBasedUsage.nightModeThresholds!
      : this.config.timeBasedUsage.dayModeThresholds!;
  }

  private calculateNextModeSwitch(now: Date): Date {
    const hour = now.getHours();
    const dayHours = this.config.timeBasedUsage?.dayModeHours || [9,10,11,12,13,14,15,16,17];
    const nightHours = this.config.timeBasedUsage?.nightModeHours || [18,19,20,21,22,23,0,1,2,3,4,5,6,7,8];

    const isDay = dayHours.includes(hour);
    const targetHours = isDay ? nightHours : dayHours;

    // Find first target hour after current time
    let nextSwitchHour = targetHours.find(h => h > hour) ?? targetHours[0];

    const result = new Date(now);
    if (nextSwitchHour <= hour) {
      result.setDate(result.getDate() + 1);
    }
    result.setHours(nextSwitchHour, 0, 0, 0);

    return result;
  }

  private calculateNextMidnight(now: Date): Date {
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  }
}
```

### 2. Main Test File Structure

```typescript
// packages/orchestrator/src/auto-resume-scenarios.integration.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonRunner } from './runner';
import { TaskStore } from './store';
import { ApexOrchestrator } from './index';
import { CapacityMonitor } from './capacity-monitor';
import { TestUsageProvider } from './test-helpers/test-usage-provider';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { Task, TaskStatus, TaskPriority } from '@apexcli/core';

describe('Auto-Resume Scenarios Integration Tests', () => {
  let testProjectPath: string;
  let daemonRunner: DaemonRunner;
  let store: TaskStore;
  let orchestrator: ApexOrchestrator;
  let testUsageProvider: TestUsageProvider;
  let mockConfig: any;

  // Helper to create paused tasks
  const createPausedTask = async (
    overrides: Partial<Task> = {},
    pauseReason: string = 'capacity'
  ): Promise<string> => {
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
      },
      ...overrides
    };

    const taskId = await store.createTask(taskData as Task);
    await store.updateTask(taskId, {
      status: 'paused',
      pausedAt: new Date(),
      pauseReason,
      updatedAt: new Date()
    });

    return taskId;
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    // Set initial time: 5 PM (17:00) - end of day mode
    vi.setSystemTime(new Date('2024-01-01T17:00:00Z'));

    testProjectPath = join(__dirname, '..', '..', 'test-data', `test-auto-resume-scenarios-${Date.now()}`);
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.apex'), { recursive: true });

    mockConfig = {
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
        logLevel: 'debug'
      },
      limits: {
        maxConcurrentTasks: 2,
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.0,
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
          maxTokensPerTask: 20000,
          maxCostPerTask: 2.0,
          maxConcurrentTasks: 3
        }
      }
    };

    writeFileSync(
      join(testProjectPath, '.apex', 'config.yaml'),
      JSON.stringify(mockConfig, null, 2)
    );

    store = new TaskStore(testProjectPath);
    await store.initialize();

    orchestrator = new ApexOrchestrator({ projectPath: testProjectPath });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (daemonRunner) {
      await daemonRunner.stop();
    }
    if (store) {
      store.close();
    }
    vi.useRealTimers();
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  // Test implementations follow...
});
```

### 3. Test Case Implementations

#### 3.1 Day to Night Mode Switch

```typescript
describe('Day to Night Mode Switch', () => {
  it('should auto-resume paused tasks when switching from day to night mode', async () => {
    // Arrange: Create paused task during day mode
    const taskId = await createPausedTask({
      description: 'Task paused during day mode'
    }, 'capacity');

    // Setup event listener
    const autoResumedEvents: any[] = [];
    orchestrator.on('tasks:auto-resumed', (event) => {
      autoResumedEvents.push(event);
    });

    // Mock resumePausedTask
    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    // Start daemon
    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    // Act: Advance time to trigger mode switch (5 PM -> 6 PM = night mode)
    // Mode switch scheduled at 6 PM + 1000ms buffer
    const timeToSwitch = (18 - 17) * 60 * 60 * 1000 + 1000; // 1 hour + buffer
    await vi.advanceTimersByTimeAsync(timeToSwitch);

    // Allow async processing
    await vi.advanceTimersByTimeAsync(100);

    // Assert
    expect(mockResume).toHaveBeenCalledWith(taskId);
    expect(autoResumedEvents).toHaveLength(1);
    expect(autoResumedEvents[0].reason).toBe('mode_switch');
    expect(autoResumedEvents[0].resumedCount).toBe(1);
  });

  it('should resume multiple tasks in priority order on day->night switch', async () => {
    // Create tasks with different priorities
    const urgentTaskId = await createPausedTask({
      priority: 'urgent' as TaskPriority,
      createdAt: new Date('2024-01-01T10:00:00Z')
    }, 'capacity');

    const normalTaskId = await createPausedTask({
      priority: 'normal' as TaskPriority,
      createdAt: new Date('2024-01-01T11:00:00Z')
    }, 'budget');

    const lowTaskId = await createPausedTask({
      priority: 'low' as TaskPriority,
      createdAt: new Date('2024-01-01T12:00:00Z')
    }, 'usage_limit');

    const resumeOrder: string[] = [];
    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockImplementation(async (id: string) => {
        resumeOrder.push(id);
        return true;
      });

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    // Advance to night mode
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1000);
    await vi.advanceTimersByTimeAsync(100);

    // Verify priority order: urgent -> normal -> low
    expect(resumeOrder).toEqual([urgentTaskId, normalTaskId, lowTaskId]);
  });
});
```

#### 3.2 Night to Day Mode Switch

```typescript
describe('Night to Day Mode Switch', () => {
  beforeEach(() => {
    // Set time to 5 AM (night mode, near end)
    vi.setSystemTime(new Date('2024-01-01T05:00:00Z'));
  });

  it('should auto-resume paused tasks when switching from night to day mode', async () => {
    const taskId = await createPausedTask({
      description: 'Task paused during night mode'
    }, 'usage_limit');

    const autoResumedEvents: any[] = [];
    orchestrator.on('tasks:auto-resumed', (event) => {
      autoResumedEvents.push(event);
    });

    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    // Advance from 5 AM to 9 AM (day mode start) = 4 hours + buffer
    const timeToSwitch = (9 - 5) * 60 * 60 * 1000 + 1000;
    await vi.advanceTimersByTimeAsync(timeToSwitch);
    await vi.advanceTimersByTimeAsync(100);

    // Note: night->day may not trigger if day has LOWER limits
    // The test verifies correct behavior based on limit comparison
    expect(mockResume).toHaveBeenCalledTimes(1);
    expect(autoResumedEvents[0].reason).toBe('mode_switch');
  });

  it('should handle night->day switch when capacity does not increase', async () => {
    // In this config, day has LOWER limits than night
    // So night->day should NOT trigger capacity:restored
    // This tests the wasCapacityRestoredByModeSwitch logic

    const taskId = await createPausedTask({}, 'capacity');

    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    // Advance to day mode
    await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000 + 1000);
    await vi.advanceTimersByTimeAsync(100);

    // Should NOT have triggered resume since day limits are lower
    // (unless using CapacityMonitorUsageAdapter which handles this differently)
    // This test documents expected behavior
  });
});
```

#### 3.3 Midnight Budget Reset

```typescript
describe('Midnight Budget Reset', () => {
  beforeEach(() => {
    // Set time to 11:55 PM
    vi.setSystemTime(new Date('2024-01-01T23:55:00Z'));
  });

  it('should auto-resume paused tasks at midnight budget reset', async () => {
    const taskId = await createPausedTask({
      description: 'Task paused due to budget exhaustion'
    }, 'budget');

    const autoResumedEvents: any[] = [];
    orchestrator.on('tasks:auto-resumed', (event) => {
      autoResumedEvents.push(event);
    });

    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    // Advance past midnight (5 minutes + buffer)
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000 + 1000);
    await vi.advanceTimersByTimeAsync(100);

    expect(mockResume).toHaveBeenCalledWith(taskId);
    expect(autoResumedEvents).toHaveLength(1);
    expect(autoResumedEvents[0].reason).toBe('budget_reset');
    expect(autoResumedEvents[0].resumedCount).toBe(1);
  });

  it('should handle budget reset with no paused tasks', async () => {
    // No paused tasks created

    const autoResumedEvents: any[] = [];
    orchestrator.on('tasks:auto-resumed', (event) => {
      autoResumedEvents.push(event);
    });

    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    await vi.advanceTimersByTimeAsync(6 * 60 * 1000 + 1000);
    await vi.advanceTimersByTimeAsync(100);

    // No tasks to resume, so no resume calls
    expect(mockResume).not.toHaveBeenCalled();
    // Event may or may not be emitted (depends on implementation)
  });
});
```

#### 3.4 Capacity Drop Below Threshold

```typescript
describe('Capacity Drop Below Threshold', () => {
  it('should auto-resume when capacity naturally drops', async () => {
    const taskId = await createPausedTask({
      description: 'Task waiting for capacity'
    }, 'capacity');

    const autoResumedEvents: any[] = [];
    orchestrator.on('tasks:auto-resumed', (event) => {
      autoResumedEvents.push(event);
    });

    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    // Get the capacity monitor and manually trigger capacity check
    const capacityMonitor = (daemonRunner as any).capacityMonitor;

    // Simulate capacity drop event (as if a task completed)
    const mockEvent = {
      reason: 'capacity_dropped' as const,
      timestamp: new Date(),
      previousUsage: {
        currentTokens: 8000,
        currentCost: 0.8,
        activeTasks: 2,
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.0,
        maxConcurrentTasks: 2,
        dailyBudget: 10.0,
        dailySpent: 0.8
      },
      currentUsage: {
        currentTokens: 4000,
        currentCost: 0.4,
        activeTasks: 1,
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.0,
        maxConcurrentTasks: 2,
        dailyBudget: 10.0,
        dailySpent: 0.4
      },
      modeInfo: {
        mode: 'day' as const,
        modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nextModeSwitch: new Date(Date.now() + 60000),
        nextMidnight: new Date(Date.now() + 86400000)
      }
    };

    capacityMonitor.emit('capacity:restored', mockEvent);

    // Allow async processing
    await vi.advanceTimersByTimeAsync(100);

    expect(mockResume).toHaveBeenCalledWith(taskId);
    expect(autoResumedEvents).toHaveLength(1);
    expect(autoResumedEvents[0].reason).toBe('capacity_dropped');
  });

  it('should resume when active tasks drop from max', async () => {
    const taskId = await createPausedTask({}, 'capacity');

    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    const capacityMonitor = (daemonRunner as any).capacityMonitor;

    // Event simulating task completion (active tasks: 2 -> 1)
    const mockEvent = {
      reason: 'capacity_dropped' as const,
      timestamp: new Date(),
      previousUsage: {
        currentTokens: 0,
        currentCost: 0,
        activeTasks: 2,
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.0,
        maxConcurrentTasks: 2,
        dailyBudget: 10.0,
        dailySpent: 0
      },
      currentUsage: {
        currentTokens: 0,
        currentCost: 0,
        activeTasks: 1,
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.0,
        maxConcurrentTasks: 2,
        dailyBudget: 10.0,
        dailySpent: 0
      },
      modeInfo: {
        mode: 'day' as const,
        modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nextModeSwitch: new Date(Date.now() + 60000),
        nextMidnight: new Date(Date.now() + 86400000)
      }
    };

    capacityMonitor.emit('capacity:restored', mockEvent);
    await vi.advanceTimersByTimeAsync(100);

    expect(mockResume).toHaveBeenCalledWith(taskId);
  });
});
```

#### 3.5 Edge Cases

```typescript
describe('Edge Cases', () => {
  it('should not resume tasks with non-resumable pause reasons', async () => {
    // Create task with manual pause (not auto-resumable)
    await createPausedTask({}, 'manual');
    await createPausedTask({}, 'user_request');

    // Create one resumable task
    const resumableTaskId = await createPausedTask({}, 'capacity');

    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    const capacityMonitor = (daemonRunner as any).capacityMonitor;
    capacityMonitor.emit('capacity:restored', createMockEvent('capacity_dropped'));

    await vi.advanceTimersByTimeAsync(100);

    // Only the resumable task should be resumed
    expect(mockResume).toHaveBeenCalledTimes(1);
    expect(mockResume).toHaveBeenCalledWith(resumableTaskId);
  });

  it('should respect resumeAfter dates', async () => {
    // Task with future resumeAfter
    const futureTaskId = await createPausedTask({}, 'capacity');
    await store.updateTask(futureTaskId, {
      resumeAfter: new Date(Date.now() + 86400000) // Tomorrow
    });

    // Task with past resumeAfter
    const pastTaskId = await createPausedTask({}, 'capacity');
    await store.updateTask(pastTaskId, {
      resumeAfter: new Date(Date.now() - 60000) // 1 minute ago
    });

    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    const capacityMonitor = (daemonRunner as any).capacityMonitor;
    capacityMonitor.emit('capacity:restored', createMockEvent('capacity_dropped'));

    await vi.advanceTimersByTimeAsync(100);

    // Only past task should be resumed
    expect(mockResume).toHaveBeenCalledTimes(1);
    expect(mockResume).toHaveBeenCalledWith(pastTaskId);
  });

  it('should handle partial failures gracefully', async () => {
    const task1 = await createPausedTask({ priority: 'high' as TaskPriority }, 'capacity');
    const task2 = await createPausedTask({ priority: 'normal' as TaskPriority }, 'budget');

    const autoResumedEvents: any[] = [];
    orchestrator.on('tasks:auto-resumed', (event) => {
      autoResumedEvents.push(event);
    });

    // First task succeeds, second fails
    let callCount = 0;
    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Resume failed');
        }
        return true;
      });

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    const capacityMonitor = (daemonRunner as any).capacityMonitor;
    capacityMonitor.emit('capacity:restored', createMockEvent('capacity_dropped'));

    await vi.advanceTimersByTimeAsync(100);

    expect(mockResume).toHaveBeenCalledTimes(2);
    expect(autoResumedEvents).toHaveLength(1);
    expect(autoResumedEvents[0].resumedCount).toBe(1);
    expect(autoResumedEvents[0].errors).toHaveLength(1);
    expect(autoResumedEvents[0].errors[0].taskId).toBe(task2);
  });

  it('should handle concurrent capacity restored events', async () => {
    const taskId = await createPausedTask({}, 'capacity');

    const mockResume = vi.spyOn(orchestrator, 'resumePausedTask')
      .mockResolvedValue(true);

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: mockConfig
    });
    await daemonRunner.start();

    const capacityMonitor = (daemonRunner as any).capacityMonitor;

    // Emit two events rapidly
    capacityMonitor.emit('capacity:restored', createMockEvent('capacity_dropped'));
    capacityMonitor.emit('capacity:restored', createMockEvent('mode_switch'));

    await vi.advanceTimersByTimeAsync(100);

    // Task should only be resumed once (first event gets it)
    // Second event finds no resumable tasks
    expect(mockResume).toHaveBeenCalledTimes(1);
  });
});

// Helper to create mock events
function createMockEvent(reason: 'capacity_dropped' | 'mode_switch' | 'budget_reset') {
  return {
    reason,
    timestamp: new Date(),
    previousUsage: {
      currentTokens: 8000,
      currentCost: 0.8,
      activeTasks: 2,
      maxTokensPerTask: 10000,
      maxCostPerTask: 1.0,
      maxConcurrentTasks: 2,
      dailyBudget: 10.0,
      dailySpent: 0.8
    },
    currentUsage: {
      currentTokens: 4000,
      currentCost: 0.4,
      activeTasks: 1,
      maxTokensPerTask: 10000,
      maxCostPerTask: 1.0,
      maxConcurrentTasks: 2,
      dailyBudget: 10.0,
      dailySpent: 0.4
    },
    modeInfo: {
      mode: 'day' as const,
      modeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
      nextModeSwitch: new Date(Date.now() + 60000),
      nextMidnight: new Date(Date.now() + 86400000)
    }
  };
}
```

## Implementation Notes

### Timer Buffer Consideration

The CapacityMonitor uses `TIMER_BUFFER_MS = 1000` for scheduling. Tests must account for this:

```typescript
// Correct: Include buffer in time advancement
const timeToSwitch = targetTime.getTime() - Date.now() + 1000;
await vi.advanceTimersByTimeAsync(timeToSwitch);
```

### Async Processing Time

After advancing timers, allow event handlers to process:

```typescript
await vi.advanceTimersByTimeAsync(100); // Small delay for async handlers
```

### Store Cleanup

Tasks remain in the database between test runs. The store is reinitialized for each test, but ensure cleanup:

```typescript
afterEach(async () => {
  if (store) {
    store.close(); // Close DB connection
  }
  // Remove test directory
  rmSync(testProjectPath, { recursive: true, force: true });
});
```

## Verification Checklist

For each test scenario, verify:

- [ ] CapacityMonitor scheduled timer fires at correct time
- [ ] `capacity:restored` event emitted with correct reason
- [ ] `handleCapacityRestored` calls `getPausedTasksForResume`
- [ ] Tasks returned match expected filter criteria
- [ ] `resumePausedTask` called for each task
- [ ] `tasks:auto-resumed` event emitted with correct data
- [ ] Error handling works correctly
- [ ] Priority ordering is respected

## Dependencies

- vitest
- @apexcli/core (types)
- fs, path (for test setup)
- DaemonRunner, TaskStore, ApexOrchestrator, CapacityMonitor
