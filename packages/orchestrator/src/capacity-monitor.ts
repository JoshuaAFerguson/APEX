import { EventEmitter } from 'eventemitter3';
import { DaemonConfig, LimitsConfig } from '@apex/core';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Capacity usage information
 */
export interface CapacityUsage {
  currentTokens: number;
  currentCost: number;
  activeTasks: number;
  maxTokensPerTask: number;
  maxCostPerTask: number;
  maxConcurrentTasks: number;
  dailyBudget: number;
  dailySpent: number;
}

/**
 * Capacity threshold check result
 */
export interface CapacityThresholds {
  tokensThreshold: number;
  costThreshold: number;
  budgetThreshold: number;
  concurrentThreshold: number;
}

/**
 * Current mode information
 */
export interface ModeInfo {
  mode: 'day' | 'night' | 'off-hours';
  modeHours: number[];
  nextModeSwitch: Date;
  nextMidnight: Date;
}

/**
 * Capacity restoration reason
 */
export type CapacityRestoredReason =
  | 'mode_switch'      // Time-based mode change (day/night/off-hours)
  | 'budget_reset'     // Daily budget reset at midnight
  | 'capacity_dropped'; // Usage dropped below threshold

/**
 * Capacity restored event data
 */
export interface CapacityRestoredEvent {
  reason: CapacityRestoredReason;
  timestamp: Date;
  previousUsage: CapacityUsage;
  currentUsage: CapacityUsage;
  modeInfo: ModeInfo;
}

/**
 * Usage provider interface for abstracting usage data sources
 */
export interface CapacityUsageProvider {
  /**
   * Get current capacity usage information
   */
  getCurrentUsage(): CapacityUsage;

  /**
   * Get current mode information
   */
  getModeInfo(): ModeInfo;

  /**
   * Get capacity thresholds for monitoring
   */
  getThresholds(): CapacityThresholds;
}

// ============================================================================
// Events Interface
// ============================================================================

export interface CapacityMonitorEvents {
  'capacity:restored': (event: CapacityRestoredEvent) => void;
}

// ============================================================================
// CapacityMonitor Implementation
// ============================================================================

/**
 * Proactively monitors capacity and detects when usage drops below thresholds
 * or when capacity is restored due to mode switches or daily resets.
 */
export class CapacityMonitor extends EventEmitter<CapacityMonitorEvents> {
  private config: DaemonConfig;
  private baseLimits: LimitsConfig;
  private usageProvider: CapacityUsageProvider;

  // Timer management
  private modeSwitchTimer?: ReturnType<typeof setTimeout>;
  private midnightTimer?: ReturnType<typeof setTimeout>;

  // State tracking
  private isRunning = false;
  private lastUsage?: CapacityUsage;
  private lastModeInfo?: ModeInfo;

  // Constants
  private static readonly CHECK_INTERVAL_MS = 60000; // Check every minute for capacity drops
  private static readonly TIMER_BUFFER_MS = 1000;    // 1 second buffer for timer accuracy

  constructor(
    config: DaemonConfig,
    baseLimits: LimitsConfig,
    usageProvider: CapacityUsageProvider
  ) {
    super();
    this.config = config;
    this.baseLimits = baseLimits;
    this.usageProvider = usageProvider;
  }

  /**
   * Start capacity monitoring
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Initialize state
    this.lastUsage = this.usageProvider.getCurrentUsage();
    this.lastModeInfo = this.usageProvider.getModeInfo();

    // Schedule timers
    this.scheduleModeSwitch();
    this.scheduleMidnight();

    console.log('🔍 CapacityMonitor started');
  }

  /**
   * Stop capacity monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear timers
    this.clearTimers();

    console.log('🔍 CapacityMonitor stopped');
  }

  /**
   * Check current capacity and detect if restoration occurred
   */
  checkCapacity(): void {
    if (!this.isRunning) {
      return;
    }

    const currentUsage = this.usageProvider.getCurrentUsage();
    const currentModeInfo = this.usageProvider.getModeInfo();

    if (!this.lastUsage || !this.lastModeInfo) {
      this.lastUsage = currentUsage;
      this.lastModeInfo = currentModeInfo;
      return;
    }

    // Check for capacity restoration due to usage drop
    if (this.hasCapacityDropped(this.lastUsage, currentUsage)) {
      this.emitCapacityRestored('capacity_dropped', this.lastUsage, currentUsage, currentModeInfo);
    }

    // Update state
    this.lastUsage = currentUsage;
    this.lastModeInfo = currentModeInfo;
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasModeSwitchTimer: !!this.modeSwitchTimer,
      hasMidnightTimer: !!this.midnightTimer,
      nextModeSwitch: this.lastModeInfo?.nextModeSwitch,
      nextMidnight: this.lastModeInfo?.nextMidnight,
      lastUsage: this.lastUsage,
    };
  }

  // ============================================================================
  // Timer Management
  // ============================================================================

  /**
   * Schedule timer for next mode switch
   */
  private scheduleModeSwitch(): void {
    if (this.modeSwitchTimer) {
      clearTimeout(this.modeSwitchTimer);
    }

    const modeInfo = this.usageProvider.getModeInfo();
    const now = new Date();
    const timeToSwitch = modeInfo.nextModeSwitch.getTime() - now.getTime();

    if (timeToSwitch <= 0) {
      // Mode switch time has passed, check immediately and reschedule
      this.handleModeSwitch();
      return;
    }

    // Schedule timer with buffer
    this.modeSwitchTimer = setTimeout(() => {
      this.handleModeSwitch();
    }, timeToSwitch + CapacityMonitor.TIMER_BUFFER_MS);
  }

  /**
   * Schedule timer for next midnight (daily budget reset)
   */
  private scheduleMidnight(): void {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
    }

    const modeInfo = this.usageProvider.getModeInfo();
    const now = new Date();
    const timeToMidnight = modeInfo.nextMidnight.getTime() - now.getTime();

    if (timeToMidnight <= 0) {
      // Midnight has passed, check immediately and reschedule
      this.handleMidnight();
      return;
    }

    // Schedule timer with buffer
    this.midnightTimer = setTimeout(() => {
      this.handleMidnight();
    }, timeToMidnight + CapacityMonitor.TIMER_BUFFER_MS);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.modeSwitchTimer) {
      clearTimeout(this.modeSwitchTimer);
      this.modeSwitchTimer = undefined;
    }

    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
      this.midnightTimer = undefined;
    }
  }

  // ============================================================================
  // Timer Event Handlers
  // ============================================================================

  /**
   * Handle mode switch event
   */
  private handleModeSwitch(): void {
    if (!this.isRunning) {
      return;
    }

    const previousUsage = this.lastUsage;
    const currentUsage = this.usageProvider.getCurrentUsage();
    const currentModeInfo = this.usageProvider.getModeInfo();

    // Check if capacity was restored due to mode switch
    if (previousUsage && this.wasCapacityRestoredByModeSwitch(previousUsage, currentUsage)) {
      this.emitCapacityRestored('mode_switch', previousUsage, currentUsage, currentModeInfo);
    }

    // Update state and reschedule
    this.lastUsage = currentUsage;
    this.lastModeInfo = currentModeInfo;
    this.scheduleModeSwitch();
  }

  /**
   * Handle midnight budget reset event
   */
  private handleMidnight(): void {
    if (!this.isRunning) {
      return;
    }

    const previousUsage = this.lastUsage;
    const currentUsage = this.usageProvider.getCurrentUsage();
    const currentModeInfo = this.usageProvider.getModeInfo();

    // Always emit budget reset event at midnight
    if (previousUsage) {
      this.emitCapacityRestored('budget_reset', previousUsage, currentUsage, currentModeInfo);
    }

    // Update state and reschedule
    this.lastUsage = currentUsage;
    this.lastModeInfo = currentModeInfo;
    this.scheduleMidnight();
  }

  // ============================================================================
  // Capacity Detection Logic
  // ============================================================================

  /**
   * Check if capacity has dropped below threshold levels
   */
  private hasCapacityDropped(previousUsage: CapacityUsage, currentUsage: CapacityUsage): boolean {
    const thresholds = this.usageProvider.getThresholds();

    // Check if any of the usage metrics dropped significantly
    const tokensDrop = previousUsage.currentTokens - currentUsage.currentTokens;
    const costDrop = previousUsage.currentCost - currentUsage.currentCost;
    const tasksDrop = previousUsage.activeTasks - currentUsage.activeTasks;

    // Consider capacity "dropped" if any significant decrease occurred
    return (
      tokensDrop > thresholds.tokensThreshold * 0.1 ||  // 10% of threshold
      costDrop > thresholds.costThreshold * 0.1 ||      // 10% of threshold
      tasksDrop > 0                                      // Any task completion
    );
  }

  /**
   * Check if capacity was restored by mode switch (e.g., day -> night with higher limits)
   */
  private wasCapacityRestoredByModeSwitch(previousUsage: CapacityUsage, currentUsage: CapacityUsage): boolean {
    // Check if limits increased (indicating move to more permissive mode)
    return (
      currentUsage.maxTokensPerTask > previousUsage.maxTokensPerTask ||
      currentUsage.maxCostPerTask > previousUsage.maxCostPerTask ||
      currentUsage.maxConcurrentTasks > previousUsage.maxConcurrentTasks
    );
  }

  /**
   * Emit capacity restored event
   */
  private emitCapacityRestored(
    reason: CapacityRestoredReason,
    previousUsage: CapacityUsage,
    currentUsage: CapacityUsage,
    modeInfo: ModeInfo
  ): void {
    const event: CapacityRestoredEvent = {
      reason,
      timestamp: new Date(),
      previousUsage,
      currentUsage,
      modeInfo,
    };

    this.emit('capacity:restored', event);

    console.log(`🔋 Capacity restored (${reason}):`, {
      reason,
      mode: modeInfo.mode,
      previousCost: previousUsage.currentCost,
      currentCost: currentUsage.currentCost,
      previousTasks: previousUsage.activeTasks,
      currentTasks: currentUsage.activeTasks,
    });
  }
}