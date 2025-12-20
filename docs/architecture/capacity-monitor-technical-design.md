# CapacityMonitor Technical Design

## Overview

The `CapacityMonitor` class provides proactive capacity monitoring for the APEX daemon system. It uses timer-based scheduling to detect capacity restoration events (mode switches, budget resets, usage decreases) and emits typed events to notify interested parties.

## Architecture

```
                    ┌─────────────────────┐
                    │   CapacityMonitor   │
                    │  (EventEmitter)     │
                    ├─────────────────────┤
                    │ - Timer scheduling  │
                    │ - State tracking    │
                    │ - Event emission    │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
    │ DaemonScheduler │ │UsageManager │ │EnhancedDaemon│
    │ (calculations)  │ │(via adapter)│ │ (consumer)   │
    └─────────────────┘ └─────────────┘ └─────────────┘
```

## Interface Definitions

### Imports and Existing Types

```typescript
// From daemon-scheduler.ts (already exists)
export interface UsageStatsProvider {
  getCurrentDailyUsage(): {
    totalTokens: number;
    totalCost: number;
    tasksCompleted: number;
    tasksFailed: number;
  };
  getActiveTasks(): number;
  getDailyBudget(): number;
}

export interface TimeWindow {
  mode: 'day' | 'night' | 'off-hours';
  startHour: number;
  endHour: number;
  isActive: boolean;
  nextTransition: Date;
}

export interface CapacityInfo {
  currentPercentage: number;
  threshold: number;
  shouldPause: boolean;
  reason?: string;
}

export type CapacityRestoredReason =
  | 'mode_switch'
  | 'budget_reset'
  | 'usage_decreased';
```

### New Types for CapacityMonitor

```typescript
// File: packages/orchestrator/src/capacity-monitor.ts

import { EventEmitter } from 'eventemitter3';
import { DaemonConfig, LimitsConfig } from '@apex/core';
import {
  UsageStatsProvider,
  TimeWindow,
  CapacityInfo,
  CapacityRestoredReason,
} from './daemon-scheduler';

/**
 * Capacity restoration event payload
 */
export interface CapacityRestoredEvent {
  /** Reason for capacity restoration */
  reason: CapacityRestoredReason;
  /** Capacity state before restoration */
  previousCapacity: CapacityInfo;
  /** Capacity state after restoration */
  newCapacity: CapacityInfo;
  /** Current time window information */
  timeWindow: TimeWindow;
  /** Timestamp of the event */
  timestamp: Date;
}

/**
 * Capacity exhausted event payload
 */
export interface CapacityExhaustedEvent {
  /** Current capacity information */
  capacity: CapacityInfo;
  /** Current time window */
  timeWindow: TimeWindow;
  /** Timestamp of the event */
  timestamp: Date;
}

/**
 * Events emitted by CapacityMonitor
 */
export interface CapacityMonitorEvents {
  /** Emitted when capacity becomes available after being exhausted */
  'capacity:restored': (event: CapacityRestoredEvent) => void;
  /** Emitted when capacity becomes exhausted */
  'capacity:exhausted': (event: CapacityExhaustedEvent) => void;
  /** Emitted when capacity approaches threshold (optional) */
  'capacity:warning': (percentage: number, threshold: number) => void;
  /** Emitted on monitoring lifecycle changes */
  'monitor:started': () => void;
  'monitor:stopped': () => void;
  'monitor:error': (error: Error) => void;
}

/**
 * Configuration options for CapacityMonitor
 */
export interface CapacityMonitorOptions {
  /** Minimum interval between checks in ms (default: 60000) */
  minCheckInterval?: number;
  /** Maximum interval between checks in ms (default: 300000 / 5 min) */
  maxCheckInterval?: number;
  /** Warning threshold as % of capacity threshold (default: 0.9 = 90%) */
  warningThreshold?: number;
  /** Whether to emit warning events (default: false) */
  emitWarnings?: boolean;
  /** Whether to emit exhausted events (default: true) */
  emitExhausted?: boolean;
}
```

## Class Implementation

```typescript
/**
 * Proactively monitors capacity and emits events on state changes
 *
 * Usage:
 * ```typescript
 * const monitor = new CapacityMonitor(config, limits, provider);
 * monitor.on('capacity:restored', (event) => {
 *   console.log(`Capacity restored: ${event.reason}`);
 * });
 * monitor.start();
 * ```
 */
export class CapacityMonitor extends EventEmitter<CapacityMonitorEvents> {
  private readonly config: DaemonConfig;
  private readonly baseLimits: LimitsConfig;
  private readonly usageProvider: UsageStatsProvider;
  private readonly options: Required<CapacityMonitorOptions>;

  // Monitoring state
  private monitoringTimer?: ReturnType<typeof setTimeout>;
  private isMonitoring: boolean = false;
  private lastCapacityState?: {
    shouldPause: boolean;
    capacity: CapacityInfo;
    timeWindow: TimeWindow;
    timestamp: Date;
  };

  // Constants
  private static readonly MIN_TIMER_DELAY = 100; // Prevent tight loops
  private static readonly DEFAULT_OPTIONS: Required<CapacityMonitorOptions> = {
    minCheckInterval: 60000,    // 1 minute
    maxCheckInterval: 300000,   // 5 minutes
    warningThreshold: 0.9,      // 90% of threshold
    emitWarnings: false,
    emitExhausted: true,
  };

  constructor(
    config: DaemonConfig,
    baseLimits: LimitsConfig,
    usageProvider: UsageStatsProvider,
    options?: CapacityMonitorOptions
  ) {
    super();
    this.config = config;
    this.baseLimits = baseLimits;
    this.usageProvider = usageProvider;
    this.options = {
      ...CapacityMonitor.DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Start monitoring capacity
   */
  start(): void {
    if (this.isMonitoring) {
      return; // Already monitoring
    }

    this.isMonitoring = true;
    this.initializeState();
    this.scheduleNextCheck();
    this.emit('monitor:started');
  }

  /**
   * Stop monitoring capacity
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    this.clearTimer();
    this.emit('monitor:stopped');
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.lastCapacityState = undefined;
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get current capacity information
   */
  getCurrentCapacity(): CapacityInfo {
    const timeWindow = this.getCurrentTimeWindow(new Date());
    return this.getCapacityInfo(timeWindow);
  }

  /**
   * Get current time window
   */
  getCurrentTimeWindow(now: Date = new Date()): TimeWindow {
    // Delegate to internal calculation (same logic as DaemonScheduler)
    return this.calculateTimeWindow(now);
  }

  /**
   * Force an immediate capacity check
   */
  checkNow(): void {
    if (!this.isMonitoring) {
      throw new Error('Monitor is not active. Call start() first.');
    }
    this.checkCapacity();
  }

  // ============================================================================
  // Private Methods - Timer Management
  // ============================================================================

  private clearTimer(): void {
    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }

  private scheduleNextCheck(): void {
    if (!this.isMonitoring) {
      return;
    }

    const now = new Date();
    const timeToModeSwitch = this.getTimeUntilModeSwitch(now);
    const timeToBudgetReset = this.getTimeUntilBudgetReset(now);

    // Calculate optimal check time
    const optimalDelay = Math.min(
      timeToModeSwitch,
      timeToBudgetReset,
      this.options.minCheckInterval
    );

    // Clamp to valid range
    const delay = Math.min(
      Math.max(CapacityMonitor.MIN_TIMER_DELAY, optimalDelay),
      this.options.maxCheckInterval
    );

    this.monitoringTimer = setTimeout(() => {
      this.checkCapacity();
      this.scheduleNextCheck();
    }, delay);
  }

  private initializeState(): void {
    const now = new Date();
    const timeWindow = this.calculateTimeWindow(now);
    const capacity = this.getCapacityInfo(timeWindow);

    this.lastCapacityState = {
      shouldPause: capacity.shouldPause || !timeWindow.isActive,
      capacity: { ...capacity },
      timeWindow: { ...timeWindow },
      timestamp: now,
    };
  }

  // ============================================================================
  // Private Methods - Capacity Checking
  // ============================================================================

  private checkCapacity(): void {
    try {
      const now = new Date();
      const timeWindow = this.calculateTimeWindow(now);
      const capacity = this.getCapacityInfo(timeWindow);
      const shouldPause = capacity.shouldPause || !timeWindow.isActive;

      // First check - initialize state
      if (!this.lastCapacityState) {
        this.lastCapacityState = {
          shouldPause,
          capacity: { ...capacity },
          timeWindow: { ...timeWindow },
          timestamp: now,
        };
        return;
      }

      const wasBlocked = this.lastCapacityState.shouldPause;
      const isNowUnblocked = !shouldPause;

      // Check for capacity restoration
      if (wasBlocked && isNowUnblocked) {
        const reason = this.determineRestorationReason(
          this.lastCapacityState,
          timeWindow,
          now
        );

        const event: CapacityRestoredEvent = {
          reason,
          previousCapacity: { ...this.lastCapacityState.capacity },
          newCapacity: { ...capacity },
          timeWindow: { ...timeWindow },
          timestamp: now,
        };

        this.emit('capacity:restored', event);
      }

      // Check for capacity exhaustion
      if (!wasBlocked && shouldPause && this.options.emitExhausted) {
        const event: CapacityExhaustedEvent = {
          capacity: { ...capacity },
          timeWindow: { ...timeWindow },
          timestamp: now,
        };
        this.emit('capacity:exhausted', event);
      }

      // Check for capacity warning
      if (this.options.emitWarnings && !shouldPause) {
        const warningLevel = capacity.threshold * this.options.warningThreshold;
        if (capacity.currentPercentage >= warningLevel) {
          this.emit('capacity:warning', capacity.currentPercentage, capacity.threshold);
        }
      }

      // Update state
      this.lastCapacityState = {
        shouldPause,
        capacity: { ...capacity },
        timeWindow: { ...timeWindow },
        timestamp: now,
      };

    } catch (error) {
      this.emit('monitor:error', error as Error);
    }
  }

  private determineRestorationReason(
    previousState: NonNullable<typeof this.lastCapacityState>,
    currentTimeWindow: TimeWindow,
    currentTimestamp: Date
  ): CapacityRestoredReason {
    // Check if time window mode changed
    if (previousState.timeWindow.mode !== currentTimeWindow.mode) {
      return 'mode_switch';
    }

    // Check if day changed (budget reset)
    if (this.hasDayChanged(previousState.timestamp, currentTimestamp)) {
      return 'budget_reset';
    }

    // Otherwise, usage decreased
    return 'usage_decreased';
  }

  private hasDayChanged(previous: Date, current: Date): boolean {
    return (
      previous.getDate() !== current.getDate() ||
      previous.getMonth() !== current.getMonth() ||
      previous.getFullYear() !== current.getFullYear()
    );
  }

  // ============================================================================
  // Private Methods - Time/Capacity Calculations
  // ============================================================================

  private calculateTimeWindow(now: Date): TimeWindow {
    if (!this.config.timeBasedUsage?.enabled) {
      return {
        mode: 'off-hours',
        startHour: 0,
        endHour: 23,
        isActive: false,
        nextTransition: this.getNextMidnight(now),
      };
    }

    const hour = now.getHours();
    const dayHours = this.config.timeBasedUsage.dayModeHours || [9, 10, 11, 12, 13, 14, 15, 16, 17];
    const nightHours = this.config.timeBasedUsage.nightModeHours || [22, 23, 0, 1, 2, 3, 4, 5, 6];

    let mode: 'day' | 'night' | 'off-hours';
    let isActive: boolean;
    let startHour: number;
    let endHour: number;

    if (dayHours.includes(hour)) {
      mode = 'day';
      isActive = true;
      startHour = Math.min(...dayHours);
      endHour = Math.max(...dayHours);
    } else if (nightHours.includes(hour)) {
      mode = 'night';
      isActive = true;
      startHour = Math.min(...nightHours);
      endHour = Math.max(...nightHours);
    } else {
      mode = 'off-hours';
      isActive = false;
      startHour = 0;
      endHour = 23;
    }

    const nextTransition = this.getNextModeTransition(now, dayHours, nightHours);

    return {
      mode,
      startHour,
      endHour,
      isActive,
      nextTransition,
    };
  }

  private getCapacityInfo(timeWindow: TimeWindow): CapacityInfo {
    const dailyUsage = this.usageProvider.getCurrentDailyUsage();
    const dailyBudget = this.usageProvider.getDailyBudget();

    const currentPercentage = dailyBudget > 0
      ? dailyUsage.totalCost / dailyBudget
      : 0;

    let threshold: number;
    if (!this.config.timeBasedUsage?.enabled || timeWindow.mode === 'off-hours') {
      threshold = 1.0;
    } else if (timeWindow.mode === 'day') {
      threshold = this.config.timeBasedUsage.dayModeCapacityThreshold || 0.90;
    } else {
      threshold = this.config.timeBasedUsage.nightModeCapacityThreshold || 0.96;
    }

    const shouldPause = currentPercentage >= threshold;
    let reason: string | undefined;

    if (shouldPause) {
      reason = `Capacity threshold exceeded (${(currentPercentage * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(1)}%)`;
    }

    return {
      currentPercentage,
      threshold,
      shouldPause,
      reason,
    };
  }

  private getTimeUntilModeSwitch(now: Date): number {
    const timeWindow = this.calculateTimeWindow(now);
    return Math.max(0, timeWindow.nextTransition.getTime() - now.getTime());
  }

  private getTimeUntilBudgetReset(now: Date): number {
    const nextMidnight = this.getNextMidnight(now);
    return Math.max(0, nextMidnight.getTime() - now.getTime());
  }

  private getNextMidnight(now: Date): Date {
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    return nextDay;
  }

  private getNextModeTransition(now: Date, dayHours: number[], nightHours: number[]): Date {
    const currentHour = now.getHours();
    const allTransitions = [...new Set([...dayHours, ...nightHours])].sort((a, b) => a - b);
    const nextTransition = allTransitions.find(hour => hour > currentHour);

    const nextSwitch = new Date(now);
    if (nextTransition !== undefined) {
      nextSwitch.setHours(nextTransition, 0, 0, 0);
    } else {
      nextSwitch.setDate(nextSwitch.getDate() + 1);
      nextSwitch.setHours(allTransitions[0], 0, 0, 0);
    }

    return nextSwitch;
  }
}
```

## Test Plan

### Unit Tests (`capacity-monitor.test.ts`)

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CapacityMonitor, CapacityRestoredEvent } from './capacity-monitor';

describe('CapacityMonitor', () => {
  // Test lifecycle management
  describe('lifecycle', () => {
    it('should start and stop monitoring');
    it('should emit monitor:started on start');
    it('should emit monitor:stopped on stop');
    it('should not double-start');
    it('should cleanup on destroy');
  });

  // Test timer scheduling
  describe('timer scheduling', () => {
    it('should schedule check at mode switch time');
    it('should schedule check at midnight');
    it('should respect minCheckInterval');
    it('should respect maxCheckInterval');
    it('should prevent tight loops with MIN_TIMER_DELAY');
  });

  // Test capacity:restored events
  describe('capacity:restored events', () => {
    it('should emit with reason mode_switch on day->night');
    it('should emit with reason mode_switch on night->day');
    it('should emit with reason budget_reset at midnight');
    it('should emit with reason usage_decreased on usage drop');
    it('should include previous and new capacity info');
    it('should include accurate timestamp');
  });

  // Test capacity:exhausted events
  describe('capacity:exhausted events', () => {
    it('should emit when capacity exceeds threshold');
    it('should not emit when emitExhausted is false');
  });

  // Test capacity:warning events
  describe('capacity:warning events', () => {
    it('should emit when approaching threshold');
    it('should not emit when emitWarnings is false');
  });

  // Test edge cases
  describe('edge cases', () => {
    it('should handle DST transitions');
    it('should handle leap years');
    it('should handle exactly midnight');
    it('should handle provider returning null/undefined');
    it('should recover from callback errors');
  });
});
```

### Integration Tests (`capacity-monitor.integration.test.ts`)

```typescript
describe('CapacityMonitor Integration', () => {
  it('should integrate with UsageManagerProvider');
  it('should work with EnhancedDaemon');
  it('should handle multiple listeners');
  it('should maintain event order');
});
```

## Integration with Existing Code

### EnhancedDaemon Integration

```typescript
// In enhanced-daemon.ts
import { CapacityMonitor } from './capacity-monitor';
import { UsageManagerProvider } from './daemon-scheduler';

export interface EnhancedDaemonEvents {
  // ... existing events ...
  'capacity:restored': (event: CapacityRestoredEvent) => void;
  'capacity:exhausted': (event: CapacityExhaustedEvent) => void;
}

class EnhancedDaemon extends EventEmitter<EnhancedDaemonEvents> {
  private capacityMonitor: CapacityMonitor;

  constructor() {
    // ... existing code ...

    // Create capacity monitor
    const daemonConfig = this.config.daemon || {};
    const limitsConfig = this.config.limits || {};
    const usageProvider = new UsageManagerProvider(this.usageManager);

    this.capacityMonitor = new CapacityMonitor(
      daemonConfig,
      limitsConfig,
      usageProvider
    );

    // Forward events
    this.capacityMonitor.on('capacity:restored', (event) => {
      this.emit('capacity:restored', event);
      this.handleCapacityRestored(event);
    });
  }

  async start(): Promise<void> {
    // ... existing start code ...
    this.capacityMonitor.start();
  }

  async stop(): Promise<void> {
    this.capacityMonitor.stop();
    // ... existing stop code ...
  }

  private handleCapacityRestored(event: CapacityRestoredEvent): void {
    console.log(`Capacity restored (${event.reason}), resuming paused tasks...`);
    // Resume paused tasks
    this.resumePausedTasks();
  }
}
```

### Export from Package

```typescript
// In packages/orchestrator/src/index.ts
export {
  CapacityMonitor,
  type CapacityMonitorEvents,
  type CapacityMonitorOptions,
  type CapacityRestoredEvent,
  type CapacityExhaustedEvent,
} from './capacity-monitor';
```

## File Structure

```
packages/orchestrator/src/
├── capacity-monitor.ts              # Main class implementation
├── capacity-monitor.test.ts         # Unit tests
├── capacity-monitor.integration.test.ts  # Integration tests
├── daemon-scheduler.ts              # Existing (shared types)
└── index.ts                         # Add exports
```

## Migration Notes

1. The existing `DaemonScheduler.onCapacityRestored()` callback system remains functional for backward compatibility
2. New consumers should prefer `CapacityMonitor` events
3. Future versions may deprecate `onCapacityRestored()` in favor of `CapacityMonitor`
4. `DaemonScheduler` calculation methods can be refactored to shared utilities if needed

## Success Criteria

1. `CapacityMonitor` emits `capacity:restored` events with correct reasons
2. Timer-based monitoring wakes at mode switches and midnight
3. All unit tests pass with >90% coverage
4. Integration with `EnhancedDaemon` works correctly
5. No memory leaks (timers properly cleaned up)
6. Error resilience (continues after callback errors)
