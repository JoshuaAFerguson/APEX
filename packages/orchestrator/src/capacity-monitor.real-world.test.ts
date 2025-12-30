import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CapacityMonitor, CapacityUsageProvider, CapacityUsage, ModeInfo, CapacityThresholds, CapacityRestoredEvent } from './capacity-monitor';
import { DaemonConfig, LimitsConfig } from '@apexcli/core';

describe('CapacityMonitor - Real-World Scenarios', () => {
  let capacityMonitor: CapacityMonitor;
  let mockConfig: DaemonConfig;
  let mockLimits: LimitsConfig;
  let events: CapacityRestoredEvent[] = [];

  // Simulate a realistic usage provider with state
  let currentUsage: CapacityUsage;
  let currentMode: 'day' | 'night' | 'off-hours' = 'day';
  let dailySpent = 0;

  const createRealisticUsageProvider = (): CapacityUsageProvider => {
    return {
      getCurrentUsage: () => ({
        ...currentUsage,
        dailySpent,
      }),
      getModeInfo: () => ({
        mode: currentMode,
        modeHours: currentMode === 'day' ? [9, 10, 11, 12, 13, 14, 15, 16, 17] : [22, 23, 0, 1, 2, 3, 4, 5, 6],
        nextModeSwitch: currentMode === 'day'
          ? new Date('2024-01-01T18:00:00Z')
          : new Date('2024-01-02T09:00:00Z'),
        nextMidnight: new Date('2024-01-02T00:00:00Z'),
      }),
      getThresholds: () => ({
        tokensThreshold: currentMode === 'day' ? 80000 : 800000,
        costThreshold: currentMode === 'day' ? 4.0 : 16.0,
        budgetThreshold: 80.0,
        concurrentThreshold: currentMode === 'day' ? 2 : 5,
      }),
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T14:00:00Z')); // 2 PM

    mockConfig = {
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
    };

    mockLimits = {
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      maxConcurrentTasks: 3,
      dailyBudget: 100.0,
    };

    // Reset state
    currentUsage = {
      currentTokens: 50000,
      currentCost: 2.5,
      activeTasks: 1,
      maxTokensPerTask: 100000,
      maxCostPerTask: 5.0,
      maxConcurrentTasks: 2,
      dailyBudget: 100.0,
      dailySpent: 25.0,
    };
    currentMode = 'day';
    dailySpent = 25.0;
    events = [];

    const usageProvider = createRealisticUsageProvider();
    capacityMonitor = new CapacityMonitor(mockConfig, mockLimits, usageProvider);

    // Track all events
    capacityMonitor.on('capacity:restored', (event) => {
      events.push(event);
    });
  });

  afterEach(() => {
    capacityMonitor.stop();
    vi.useRealTimers();
  });

  describe('Typical Development Team Workflow', () => {
    it('should monitor a typical work day with multiple task completions', () => {
      capacityMonitor.start();

      // Morning: Start with moderate usage
      currentUsage = {
        currentTokens: 30000,
        currentCost: 1.5,
        activeTasks: 2,
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        maxConcurrentTasks: 2,
        dailyBudget: 100.0,
        dailySpent: 15.0,
      };
      dailySpent = 15.0;

      // Complete first task
      currentUsage.activeTasks = 1;
      currentUsage.currentTokens = 25000;
      capacityMonitor.checkCapacity();

      expect(events).toHaveLength(1);
      expect(events[0].reason).toBe('capacity_dropped');

      // Complete second task
      currentUsage.activeTasks = 0;
      currentUsage.currentTokens = 20000;
      capacityMonitor.checkCapacity();

      expect(events).toHaveLength(2);
      expect(events[1].reason).toBe('capacity_dropped');

      // Start new batch of tasks
      currentUsage.activeTasks = 2;
      currentUsage.currentTokens = 45000;
      capacityMonitor.checkCapacity();

      // Complete tasks with significant token usage drop
      currentUsage.activeTasks = 0;
      currentUsage.currentTokens = 10000;
      capacityMonitor.checkCapacity();

      expect(events).toHaveLength(3);
      expect(events[2].reason).toBe('capacity_dropped');
    });

    it('should handle transition from day to night mode', () => {
      capacityMonitor.start();

      // Simulate approaching end of day mode
      vi.setSystemTime(new Date('2024-01-01T17:59:00Z'));

      // Trigger mode switch to night
      currentMode = 'night';
      currentUsage.maxTokensPerTask = 1000000;
      currentUsage.maxCostPerTask = 20.0;
      currentUsage.maxConcurrentTasks = 5;

      // Fast forward to mode switch time
      vi.advanceTimersByTime(61000); // 61 seconds to account for buffer

      expect(events.some(e => e.reason === 'mode_switch')).toBe(true);
      const modeSwitchEvent = events.find(e => e.reason === 'mode_switch')!;
      expect(modeSwitchEvent.currentUsage.maxTokensPerTask).toBe(1000000);
      expect(modeSwitchEvent.modeInfo.mode).toBe('night');
    });

    it('should handle daily budget reset at midnight', () => {
      capacityMonitor.start();

      // Set high daily spending
      dailySpent = 80.0;
      currentUsage.dailySpent = 80.0;

      // Fast forward to midnight
      const timeToMidnight = new Date('2024-01-02T00:00:00Z').getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToMidnight + 1000);

      // Simulate budget reset
      dailySpent = 0;
      currentUsage.dailySpent = 0;

      expect(events.some(e => e.reason === 'budget_reset')).toBe(true);
      const budgetResetEvent = events.find(e => e.reason === 'budget_reset')!;
      expect(budgetResetEvent.timestamp).toEqual(new Date('2024-01-02T00:00:01Z'));
    });
  });

  describe('High-Load Scenarios', () => {
    it('should handle rapid task execution during peak hours', () => {
      capacityMonitor.start();

      // Simulate high concurrency
      currentUsage.activeTasks = 2; // At capacity
      currentUsage.currentTokens = 80000; // Near threshold
      currentUsage.currentCost = 4.5; // Near threshold

      let completedTasks = 0;

      // Simulate rapid task completions
      for (let i = 0; i < 20; i++) {
        // Complete a task
        currentUsage.activeTasks = Math.max(0, currentUsage.activeTasks - 1);
        currentUsage.currentTokens -= 5000;
        currentUsage.currentCost -= 0.25;
        completedTasks++;

        capacityMonitor.checkCapacity();

        // Start new task if capacity available
        if (currentUsage.activeTasks < currentUsage.maxConcurrentTasks) {
          currentUsage.activeTasks++;
          currentUsage.currentTokens += 3000;
          currentUsage.currentCost += 0.15;
        }
      }

      // Should detect multiple capacity drops
      const capacityDropEvents = events.filter(e => e.reason === 'capacity_dropped');
      expect(capacityDropEvents.length).toBeGreaterThan(5);
    });

    it('should handle resource exhaustion and recovery', () => {
      capacityMonitor.start();

      // Simulate hitting limits
      currentUsage = {
        currentTokens: 95000, // Close to day mode limit
        currentCost: 4.8, // Close to day mode limit
        activeTasks: 2, // At concurrent task limit
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        maxConcurrentTasks: 2,
        dailyBudget: 100.0,
        dailySpent: 95.0, // Near budget limit
      };
      dailySpent = 95.0;

      // Complete all tasks (should trigger capacity restored)
      currentUsage.activeTasks = 0;
      currentUsage.currentTokens = 50000;
      currentUsage.currentCost = 2.5;
      capacityMonitor.checkCapacity();

      expect(events.some(e => e.reason === 'capacity_dropped')).toBe(true);

      // Simulate switching to night mode with more capacity
      currentMode = 'night';
      currentUsage.maxTokensPerTask = 1000000;
      currentUsage.maxCostPerTask = 20.0;
      currentUsage.maxConcurrentTasks = 5;

      // Trigger mode switch
      const timeToSwitch = new Date('2024-01-01T18:00:00Z').getTime() - new Date().getTime();
      vi.advanceTimersByTime(timeToSwitch + 1000);

      const modeSwitchEvents = events.filter(e => e.reason === 'mode_switch');
      expect(modeSwitchEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Case Scenarios', () => {
    it('should handle erratic usage patterns', () => {
      capacityMonitor.start();

      // Simulate erratic usage spikes and drops
      const usagePatterns = [
        { tokens: 90000, cost: 4.5, tasks: 2 },
        { tokens: 10000, cost: 0.5, tasks: 0 },
        { tokens: 70000, cost: 3.5, tasks: 1 },
        { tokens: 5000, cost: 0.25, tasks: 0 },
        { tokens: 85000, cost: 4.25, tasks: 2 },
        { tokens: 15000, cost: 0.75, tasks: 0 },
      ];

      usagePatterns.forEach((pattern, index) => {
        currentUsage.currentTokens = pattern.tokens;
        currentUsage.currentCost = pattern.cost;
        currentUsage.activeTasks = pattern.tasks;

        capacityMonitor.checkCapacity();

        // Add some time delay between checks
        vi.advanceTimersByTime(1000);
      });

      // Should detect capacity drops for the drop patterns
      const dropEvents = events.filter(e => e.reason === 'capacity_dropped');
      expect(dropEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle long-running monitoring session', () => {
      capacityMonitor.start();

      let totalEvents = 0;

      // Simulate 24-hour monitoring with periodic activity
      for (let hour = 0; hour < 24; hour++) {
        // Advance time by 1 hour
        vi.advanceTimersByTime(3600000);

        // Switch modes at appropriate times
        if (hour === 4) { // 6 PM (18:00)
          currentMode = 'night';
          currentUsage.maxTokensPerTask = 1000000;
          currentUsage.maxCostPerTask = 20.0;
          currentUsage.maxConcurrentTasks = 5;
        } else if (hour === 19) { // 9 AM next day
          currentMode = 'day';
          currentUsage.maxTokensPerTask = 100000;
          currentUsage.maxCostPerTask = 5.0;
          currentUsage.maxConcurrentTasks = 2;
          // Reset daily spending at midnight
          if (hour >= 10) {
            dailySpent = 0;
            currentUsage.dailySpent = 0;
          }
        }

        // Simulate some activity every few hours
        if (hour % 3 === 0) {
          currentUsage.activeTasks = Math.floor(Math.random() * (currentUsage.maxConcurrentTasks + 1));
          currentUsage.currentTokens = Math.floor(Math.random() * currentUsage.maxTokensPerTask);
          currentUsage.currentCost = Math.random() * currentUsage.maxCostPerTask;

          capacityMonitor.checkCapacity();
        }

        const currentEventCount = events.length;
        if (currentEventCount > totalEvents) {
          totalEvents = currentEventCount;
        }
      }

      // Should have detected mode switches and budget resets
      const modeEvents = events.filter(e => e.reason === 'mode_switch');
      const budgetEvents = events.filter(e => e.reason === 'budget_reset');

      expect(modeEvents.length).toBeGreaterThan(0);
      expect(budgetEvents.length).toBeGreaterThan(0);
      expect(capacityMonitor.getStatus().isRunning).toBe(true);
    });

    it('should handle system resource constraints gracefully', () => {
      capacityMonitor.start();

      // Simulate system under heavy load with slow provider responses
      const slowProvider: CapacityUsageProvider = {
        getCurrentUsage: () => {
          // Simulate slow response
          const start = Date.now();
          while (Date.now() - start < 5) {
            // Busy wait for 5ms
          }
          return currentUsage;
        },
        getModeInfo: createRealisticUsageProvider().getModeInfo,
        getThresholds: createRealisticUsageProvider().getThresholds,
      };

      const slowMonitor = new CapacityMonitor(mockConfig, mockLimits, slowProvider);
      const slowEvents: CapacityRestoredEvent[] = [];
      slowMonitor.on('capacity:restored', (event) => {
        slowEvents.push(event);
      });

      slowMonitor.start();

      // Perform multiple checks despite slow provider
      for (let i = 0; i < 10; i++) {
        currentUsage.activeTasks = i % 2; // Alternate to trigger events
        slowMonitor.checkCapacity();
      }

      // Should still function despite slow provider
      expect(slowEvents.length).toBeGreaterThan(0);
      expect(slowMonitor.getStatus().isRunning).toBe(true);

      slowMonitor.stop();
    });
  });

  describe('Production-Like Integration', () => {
    it('should work correctly when integrated with actual daemon operations', () => {
      // This test simulates how the monitor would work in actual production
      capacityMonitor.start();

      const productionEvents: Array<{
        type: 'task_start' | 'task_complete' | 'mode_change' | 'budget_reset';
        timestamp: Date;
        data: any;
      }> = [];

      // Simulate production event sequence
      const workflowEvents = [
        { type: 'task_start', data: { id: 'task-1', priority: 'high' } },
        { type: 'task_start', data: { id: 'task-2', priority: 'normal' } },
        { type: 'task_complete', data: { id: 'task-1', tokens: 8000, cost: 0.8 } },
        { type: 'task_complete', data: { id: 'task-2', tokens: 6000, cost: 0.6 } },
        { type: 'mode_change', data: { from: 'day', to: 'night' } },
        { type: 'task_start', data: { id: 'task-3', priority: 'high' } },
        { type: 'task_start', data: { id: 'task-4', priority: 'high' } },
        { type: 'task_complete', data: { id: 'task-3', tokens: 15000, cost: 1.5 } },
        { type: 'budget_reset', data: { newBudget: 100 } },
      ];

      workflowEvents.forEach((event, index) => {
        // Advance time
        vi.advanceTimersByTime(300000); // 5 minutes between events

        switch (event.type) {
          case 'task_start':
            currentUsage.activeTasks++;
            currentUsage.currentTokens += 2000; // Initial allocation
            break;

          case 'task_complete':
            currentUsage.activeTasks = Math.max(0, currentUsage.activeTasks - 1);
            currentUsage.currentTokens -= event.data.tokens;
            currentUsage.currentCost -= event.data.cost;
            dailySpent += event.data.cost;
            break;

          case 'mode_change':
            currentMode = event.data.to as 'day' | 'night';
            if (currentMode === 'night') {
              currentUsage.maxTokensPerTask = 1000000;
              currentUsage.maxCostPerTask = 20.0;
              currentUsage.maxConcurrentTasks = 5;
            }
            break;

          case 'budget_reset':
            dailySpent = 0;
            currentUsage.dailySpent = 0;
            break;
        }

        productionEvents.push({
          type: event.type as any,
          timestamp: new Date(),
          data: event.data,
        });

        capacityMonitor.checkCapacity();
      });

      // Verify monitoring detected expected events
      const capacityEvents = events.filter(e => e.reason === 'capacity_dropped');
      expect(capacityEvents.length).toBeGreaterThan(0);

      // Verify monitor is still healthy
      const status = capacityMonitor.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.hasModeSwitchTimer).toBe(true);
      expect(status.hasMidnightTimer).toBe(true);
    });
  });
});