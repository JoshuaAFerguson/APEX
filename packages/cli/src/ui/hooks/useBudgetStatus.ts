/**
 * Hook for tracking budget status from orchestrator events
 * Subscribes to usage:updated WebSocket events and provides budget monitoring capabilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

export interface BudgetData {
  /** Current cost in USD */
  currentCost: number;
  /** Budget limit in USD */
  budgetLimit?: number;
  /** Percentage of budget used (0-100) */
  budgetUsedPercentage: number;
  /** Total input tokens used */
  totalInputTokens: number;
  /** Total output tokens used */
  totalOutputTokens: number;
  /** Total tokens used (input + output) */
  totalTokens: number;
  /** Estimated cost for current session */
  estimatedCost: number;
  /** Whether budget threshold has been exceeded */
  isOverBudget: boolean;
  /** Whether approaching budget limit (configurable threshold) */
  isApproachingLimit: boolean;
}

export interface BudgetThresholds {
  /** Warning threshold as percentage of budget (default: 80) */
  warningThreshold?: number;
  /** Critical threshold as percentage of budget (default: 95) */
  criticalThreshold?: number;
}

export interface UseBudgetStatusOptions {
  /** The orchestrator instance to listen to */
  orchestrator?: ApexOrchestrator;
  /** Task ID to filter events for */
  taskId?: string;
  /** Budget limit in USD */
  budgetLimit?: number;
  /** Budget warning thresholds */
  thresholds?: BudgetThresholds;
  /** Whether to enable debug logging */
  debug?: boolean;
}

export interface BudgetStatusState extends BudgetData {
  /** WebSocket connection status */
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  /** Whether the hook is currently loading initial data */
  isLoading: boolean;
  /** Last error that occurred */
  error: Error | null;
  /** Function to manually refresh budget data */
  refresh: () => void;
}

/**
 * Custom hook that bridges orchestrator usage events to budget tracking
 * Listens to usage:updated events and maintains budget state accordingly
 */
export function useBudgetStatus(options: UseBudgetStatusOptions = {}): BudgetStatusState {
  const {
    orchestrator,
    taskId,
    budgetLimit,
    thresholds = {},
    debug = false
  } = options;

  const {
    warningThreshold = 80,
    criticalThreshold = 95
  } = thresholds;

  // Main state for budget tracking
  const [state, setState] = useState<BudgetStatusState>(() => ({
    currentCost: 0,
    budgetLimit,
    budgetUsedPercentage: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    isOverBudget: false,
    isApproachingLimit: false,
    connectionStatus: 'disconnected',
    isLoading: true,
    error: null,
    refresh: () => {},
  }));

  // Ref to track latest usage data for delta calculations
  const lastUsageRef = useRef<Record<string, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  }>>({});

  // Ref to track if initial data load has happened
  const hasInitialDataRef = useRef(false);

  // Debug logging helper
  const log = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[useBudgetStatus] ${message}`, data || '');
    }
  }, [debug]);

  // Helper to calculate budget metrics
  const calculateBudgetMetrics = useCallback((
    totalCost: number,
    limit?: number
  ): Pick<BudgetData, 'budgetUsedPercentage' | 'isOverBudget' | 'isApproachingLimit'> => {
    if (!limit || limit <= 0) {
      return {
        budgetUsedPercentage: 0,
        isOverBudget: false,
        isApproachingLimit: false,
      };
    }

    const percentage = (totalCost / limit) * 100;

    return {
      budgetUsedPercentage: Math.min(percentage, 100),
      isOverBudget: percentage > 100,
      isApproachingLimit: percentage >= warningThreshold && percentage < criticalThreshold,
    };
  }, [warningThreshold, criticalThreshold]);

  // Manual refresh function
  const refresh = useCallback(() => {
    log('Manual refresh requested');
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    // Reset usage tracking for fresh calculation
    lastUsageRef.current = {};
    hasInitialDataRef.current = false;

    // Note: In a real implementation, you might want to emit a request
    // for current budget status here or query an API endpoint
  }, [log]);

  // Set up refresh function in state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      refresh,
    }));
  }, [refresh]);

  // Main effect for setting up orchestrator event listeners
  useEffect(() => {
    if (!orchestrator) {
      setState(prev => ({
        ...prev,
        connectionStatus: 'disconnected',
        isLoading: false,
        error: new Error('No orchestrator provided'),
      }));
      return;
    }

    log('Setting up orchestrator event listeners');
    setState(prev => ({
      ...prev,
      connectionStatus: 'connecting',
      error: null, // Clear any previous errors when orchestrator is available
    }));

    // Handler for usage:updated events
    const handleUsageUpdated = (
      eventTaskId: string,
      usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCost: number;
      }
    ) => {
      // Filter by taskId if specified
      if (taskId && eventTaskId !== taskId) return;

      log('Usage updated', { taskId: eventTaskId, usage });

      // Calculate delta from previous usage
      const previousUsage = lastUsageRef.current[eventTaskId];
      const isTotalUpdate = previousUsage
        ? usage.totalTokens >= previousUsage.totalTokens
        : true;

      const deltaInput = isTotalUpdate && previousUsage
        ? Math.max(0, usage.inputTokens - previousUsage.inputTokens)
        : usage.inputTokens;
      const deltaOutput = isTotalUpdate && previousUsage
        ? Math.max(0, usage.outputTokens - previousUsage.outputTokens)
        : usage.outputTokens;
      const deltaTotal = isTotalUpdate && previousUsage
        ? Math.max(0, usage.totalTokens - previousUsage.totalTokens)
        : usage.totalTokens;
      const deltaCost = isTotalUpdate && previousUsage
        ? Math.max(0, usage.estimatedCost - previousUsage.estimatedCost)
        : usage.estimatedCost;

      // Update usage tracking
      if (isTotalUpdate || !previousUsage) {
        lastUsageRef.current[eventTaskId] = {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          estimatedCost: usage.estimatedCost,
        };
      }

      // Update state with new budget data
      setState(prev => {
        const newTotalInputTokens = prev.totalInputTokens + deltaInput;
        const newTotalOutputTokens = prev.totalOutputTokens + deltaOutput;
        const newTotalTokens = prev.totalTokens + deltaTotal;
        const newCurrentCost = prev.currentCost + deltaCost;
        const newEstimatedCost = prev.estimatedCost + deltaCost;

        // Calculate budget metrics
        const budgetMetrics = calculateBudgetMetrics(newCurrentCost, budgetLimit);

        return {
          ...prev,
          currentCost: newCurrentCost,
          totalInputTokens: newTotalInputTokens,
          totalOutputTokens: newTotalOutputTokens,
          totalTokens: newTotalTokens,
          estimatedCost: newEstimatedCost,
          ...budgetMetrics,
          connectionStatus: 'connected',
          isLoading: false,
          error: null,
        };
      });

      // Mark initial data as loaded
      if (!hasInitialDataRef.current) {
        hasInitialDataRef.current = true;
      }
    };

    // Connection status handlers
    const handleConnectionEstablished = () => {
      log('Orchestrator connection established');
      setState(prev => ({
        ...prev,
        connectionStatus: 'connected',
        error: null,
      }));
    };

    const handleConnectionLost = () => {
      log('Orchestrator connection lost');
      setState(prev => ({
        ...prev,
        connectionStatus: 'disconnected',
        error: new Error('Connection to orchestrator lost'),
      }));
    };

    // Task lifecycle handlers for resetting state
    const handleTaskStart = (task: any) => {
      if (taskId && task.id !== taskId) return;

      log('Task started, resetting budget tracking', { taskId: task.id });

      // Reset budget tracking for new task
      lastUsageRef.current = {};
      hasInitialDataRef.current = false;

      setState(prev => ({
        ...prev,
        currentCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        budgetUsedPercentage: 0,
        isOverBudget: false,
        isApproachingLimit: false,
        isLoading: false,
        error: null,
      }));
    };

    const handleTaskComplete = (task: any) => {
      if (taskId && task.id !== taskId) return;

      log('Task completed', { taskId: task.id });

      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    };

    const handleTaskFail = (task: any, error: Error) => {
      if (taskId && task.id !== taskId) return;

      log('Task failed', { taskId: task.id, error: error.message });

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: new Error(`Task failed: ${error.message}`),
      }));
    };

    // Register event listeners
    orchestrator.on('usage:updated', handleUsageUpdated);
    orchestrator.on('task:started', handleTaskStart);
    orchestrator.on('task:completed', handleTaskComplete);
    orchestrator.on('task:failed', handleTaskFail);

    // Check if we can determine connection status
    // In a real implementation, you might check orchestrator.isConnected or similar
    setState(prev => ({
      ...prev,
      connectionStatus: 'connected',
      isLoading: false,
    }));

    log('Event listeners registered');

    // Cleanup function
    return () => {
      orchestrator.off('usage:updated', handleUsageUpdated);
      orchestrator.off('task:started', handleTaskStart);
      orchestrator.off('task:completed', handleTaskComplete);
      orchestrator.off('task:failed', handleTaskFail);
      log('Event listeners cleaned up');
    };
  }, [orchestrator, taskId, budgetLimit, log, calculateBudgetMetrics]);

  // Update budget metrics when budgetLimit changes
  useEffect(() => {
    setState(prev => {
      const budgetMetrics = calculateBudgetMetrics(prev.currentCost, budgetLimit);
      return {
        ...prev,
        budgetLimit,
        ...budgetMetrics,
      };
    });
  }, [budgetLimit, calculateBudgetMetrics]);

  return state;
}