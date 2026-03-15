/**
 * Budget status types for the APEX CLI
 * Provides type definitions for tracking API usage costs and budget limits
 */

/**
 * Budget status levels indicating how close spending is to the limit
 */
export type BudgetStatusLevel = 'ok' | 'warning' | 'critical' | 'exceeded';

/**
 * Core budget status information
 * Represents the current state of API spending relative to configured limits
 */
export interface BudgetStatus {
  /** Current accumulated spend in dollars */
  currentSpend: number;
  /** Configured budget limit in dollars */
  budgetLimit: number;
  /** Percentage of budget used (0-100+, can exceed 100 if over budget) */
  percentUsed: number;
  /** Current budget status level based on thresholds */
  status: BudgetStatusLevel;
  /** Timestamp of the last budget status update */
  lastUpdated: Date;
}

/**
 * Budget status state for the useBudgetStatus hook
 * Contains the current budget status along with loading and error states
 */
export interface BudgetStatusState {
  /** Current budget status data, null if not yet loaded */
  budgetStatus: BudgetStatus | null;
  /** Whether budget data is currently being loaded or updated */
  isLoading: boolean;
  /** Error message if budget status fetch failed */
  error: string | null;
  /** Whether budget tracking is enabled */
  isEnabled: boolean;
}

/**
 * Return type for the useBudgetStatus hook
 * Extends BudgetStatusState with methods for budget management
 */
export interface UseBudgetStatusReturn extends BudgetStatusState {
  /** Refresh the budget status from the data source */
  refresh: () => Promise<void>;
  /** Reset the current spend to zero */
  resetSpend: () => Promise<void>;
  /** Update the budget limit */
  setBudgetLimit: (limit: number) => Promise<void>;
}

/**
 * Options for configuring the useBudgetStatus hook
 */
export interface UseBudgetStatusOptions {
  /** Initial budget limit in dollars */
  initialLimit?: number;
  /** Warning threshold as percentage (default: 80) */
  warningThreshold?: number;
  /** Critical threshold as percentage (default: 95) */
  criticalThreshold?: number;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Whether to enable budget tracking (default: true) */
  enabled?: boolean;
}
