import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBudgetStatus } from '../useBudgetStatus';
import type { UseBudgetStatusOptions } from '../useBudgetStatus';
import { MockOrchestrator, createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';

describe('useBudgetStatus - Integration Tests', () => {
  let mockOrchestrator: MockOrchestrator;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockOrchestrator.cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Complete Task Lifecycle with Budget Tracking', () => {
    it('tracks budget through complete workflow execution', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: 'workflow-task',
          budgetLimit: 50,
          debug: true
        })
      );

      // Initial state
      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.currentCost).toBe(0);

      // Task starts - should reset state
      await act(async () => {
        mockOrchestrator.simulateTaskStart({
          id: 'workflow-task',
          status: 'running'
        });
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);

      // Planning stage - some token usage
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('workflow-task', {
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
          estimatedCost: 2.5
        });
      });

      expect(result.current.currentCost).toBe(2.5);
      expect(result.current.budgetUsedPercentage).toBe(5);

      // Implementation stage - more usage
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('workflow-task', {
          inputTokens: 1200,
          outputTokens: 600,
          totalTokens: 1800,
          estimatedCost: 8.0
        });
      });

      // Should accumulate properly (deltas: 700 input, 400 output, 1100 total, 5.5 cost)
      expect(result.current.totalInputTokens).toBe(1200);
      expect(result.current.totalOutputTokens).toBe(600);
      expect(result.current.totalTokens).toBe(1800);
      expect(result.current.currentCost).toBe(8.0);
      expect(result.current.budgetUsedPercentage).toBe(16);

      // Testing stage - approach warning threshold
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('workflow-task', {
          inputTokens: 3000,
          outputTokens: 1500,
          totalTokens: 4500,
          estimatedCost: 42.0
        });
      });

      expect(result.current.currentCost).toBe(42.0);
      expect(result.current.budgetUsedPercentage).toBe(84);
      expect(result.current.isApproachingLimit).toBe(true);
      expect(result.current.isOverBudget).toBe(false);

      // Task completes
      await act(async () => {
        mockOrchestrator.simulateTaskComplete({
          id: 'workflow-task',
          status: 'completed'
        });
      });

      expect(result.current.isLoading).toBe(false);
      // Budget data should persist after completion
      expect(result.current.currentCost).toBe(42.0);
    });

    it('handles budget exceeded scenario', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 10,
          thresholds: { warningThreshold: 70, criticalThreshold: 90 }
        })
      );

      // Simulate heavy usage that exceeds budget
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 5000,
          outputTokens: 2500,
          totalTokens: 7500,
          estimatedCost: 15.0
        });
      });

      expect(result.current.currentCost).toBe(15.0);
      expect(result.current.budgetUsedPercentage).toBe(100); // Capped at 100
      expect(result.current.isOverBudget).toBe(true);
      expect(result.current.isApproachingLimit).toBe(false);
    });

    it('tracks multiple incremental updates correctly', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      const updates = [
        { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.5 },
        { inputTokens: 250, outputTokens: 125, totalTokens: 375, estimatedCost: 1.2 },
        { inputTokens: 500, outputTokens: 250, totalTokens: 750, estimatedCost: 2.5 },
        { inputTokens: 800, outputTokens: 400, totalTokens: 1200, estimatedCost: 4.0 },
        { inputTokens: 1200, outputTokens: 600, totalTokens: 1800, estimatedCost: 6.0 }
      ];

      for (const update of updates) {
        await act(async () => {
          mockOrchestrator.simulateUsageUpdate('task-1', update);
        });
      }

      // Final accumulated state
      expect(result.current.totalInputTokens).toBe(1200);
      expect(result.current.totalOutputTokens).toBe(600);
      expect(result.current.totalTokens).toBe(1800);
      expect(result.current.currentCost).toBe(6.0);
      expect(result.current.budgetUsedPercentage).toBe(6);
    });
  });

  describe('Multi-Task Scenarios', () => {
    it('tracks separate tasks independently when no filter', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      await act(async () => {
        // Task 1 usage
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 2.0
        });

        // Task 2 usage
        mockOrchestrator.simulateUsageUpdate('task-2', {
          inputTokens: 300,
          outputTokens: 150,
          totalTokens: 450,
          estimatedCost: 1.5
        });

        // More task 1 usage
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 800,
          outputTokens: 400,
          totalTokens: 1200,
          estimatedCost: 3.2
        });
      });

      // Should track both tasks
      expect(result.current.totalInputTokens).toBe(1100); // 800 + 300
      expect(result.current.totalOutputTokens).toBe(550); // 400 + 150
      expect(result.current.totalTokens).toBe(1650); // 1200 + 450
      expect(result.current.currentCost).toBe(4.7); // 3.2 + 1.5
    });

    it('isolates task events when taskId filter is used', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: 'target-task'
        })
      );

      await act(async () => {
        // Target task events - should be processed
        mockOrchestrator.simulateTaskStart({ id: 'target-task', status: 'running' });
        mockOrchestrator.simulateUsageUpdate('target-task', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 2.0
        });

        // Other task events - should be ignored
        mockOrchestrator.simulateTaskStart({ id: 'other-task', status: 'running' });
        mockOrchestrator.simulateUsageUpdate('other-task', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 5.0
        });
        mockOrchestrator.simulateTaskFail(
          { id: 'other-task', status: 'failed' },
          new Error('Other task failed')
        );
      });

      // Should only reflect target task data
      expect(result.current.currentCost).toBe(2.0);
      expect(result.current.totalTokens).toBe(750);
      expect(result.current.error).toBe(null);
    });
  });

  describe('Real-time Budget Monitoring', () => {
    it('provides real-time budget status during execution', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 25,
          thresholds: { warningThreshold: 60, criticalThreshold: 80 }
        })
      );

      // Start below warning threshold
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 10.0
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(40);
      expect(result.current.isApproachingLimit).toBe(false);
      expect(result.current.isOverBudget).toBe(false);

      // Enter warning zone
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 16.0
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(64);
      expect(result.current.isApproachingLimit).toBe(true);
      expect(result.current.isOverBudget).toBe(false);

      // Exceed budget
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          estimatedCost: 30.0
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(100); // Capped
      expect(result.current.isApproachingLimit).toBe(false);
      expect(result.current.isOverBudget).toBe(true);
    });

    it('responds to budget limit changes immediately', async () => {
      const { result, rerender } = renderHook(
        (props: UseBudgetStatusOptions) => useBudgetStatus(props),
        { initialProps: { orchestrator: mockOrchestrator, budgetLimit: 50 } }
      );

      // Set some usage
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25.0
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(50);
      expect(result.current.isOverBudget).toBe(false);

      // Lower the budget limit
      rerender({ orchestrator: mockOrchestrator, budgetLimit: 20 });

      expect(result.current.budgetUsedPercentage).toBe(100); // 25/20 capped at 100
      expect(result.current.isOverBudget).toBe(true);

      // Raise the budget limit
      rerender({ orchestrator: mockOrchestrator, budgetLimit: 100 });

      expect(result.current.budgetUsedPercentage).toBe(25);
      expect(result.current.isOverBudget).toBe(false);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('recovers from task failures', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: 'resilient-task',
          budgetLimit: 50
        })
      );

      // Task starts and accumulates some usage
      await act(async () => {
        mockOrchestrator.simulateTaskStart({ id: 'resilient-task', status: 'running' });
        mockOrchestrator.simulateUsageUpdate('resilient-task', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 5.0
        });
      });

      expect(result.current.currentCost).toBe(5.0);
      expect(result.current.error).toBe(null);

      // Task fails
      await act(async () => {
        mockOrchestrator.simulateTaskFail(
          { id: 'resilient-task', status: 'failed' },
          new Error('Simulated task failure')
        );
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error?.message).toBe('Task failed: Simulated task failure');
      // Budget data should persist after failure
      expect(result.current.currentCost).toBe(5.0);

      // New task starts - should reset
      await act(async () => {
        mockOrchestrator.simulateTaskStart({ id: 'resilient-task', status: 'running' });
      });

      expect(result.current.currentCost).toBe(0);
      expect(result.current.error).toBe(null);
    });

    it('handles connection issues gracefully', async () => {
      const { result, rerender } = renderHook(
        (props: UseBudgetStatusOptions) => useBudgetStatus(props),
        { initialProps: { orchestrator: mockOrchestrator } }
      );

      expect(result.current.connectionStatus).toBe('connected');

      // Simulate connection loss by removing orchestrator
      rerender({ orchestrator: undefined });

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error?.message).toBe('No orchestrator provided');

      // Reconnect
      rerender({ orchestrator: mockOrchestrator });

      expect(result.current.connectionStatus).toBe('connected');
      // Error should clear when orchestrator is reconnected
      expect(result.current.error).toBe(null);
    });

    it('maintains state consistency during rapid events', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      // Simulate rapid sequence of usage updates
      await act(async () => {
        const rapidUpdates = [
          { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 1.0 },
          { inputTokens: 200, outputTokens: 100, totalTokens: 300, estimatedCost: 2.0 },
          { inputTokens: 300, outputTokens: 150, totalTokens: 450, estimatedCost: 3.0 },
          { inputTokens: 400, outputTokens: 200, totalTokens: 600, estimatedCost: 4.0 },
          { inputTokens: 500, outputTokens: 250, totalTokens: 750, estimatedCost: 5.0 }
        ];

        for (const update of rapidUpdates) {
          mockOrchestrator.simulateUsageUpdate('rapid-task', update);
        }
      });

      // Should maintain consistency despite rapid updates
      expect(result.current.totalInputTokens).toBe(500);
      expect(result.current.totalOutputTokens).toBe(250);
      expect(result.current.totalTokens).toBe(750);
      expect(result.current.currentCost).toBe(5.0);
      expect(result.current.budgetUsedPercentage).toBe(5);
    });
  });

  describe('Parallel Task Execution', () => {
    it('tracks budget across parallel task execution', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 50
        })
      );

      // Simulate parallel task execution with multiple tasks
      await act(async () => {
        // Start multiple tasks in "parallel"
        mockOrchestrator.simulateTaskStart({ id: 'parallel-1', status: 'running' });
        mockOrchestrator.simulateTaskStart({ id: 'parallel-2', status: 'running' });

        // Each task generates usage
        mockOrchestrator.simulateUsageUpdate('parallel-1', {
          inputTokens: 300,
          outputTokens: 150,
          totalTokens: 450,
          estimatedCost: 3.0
        });

        mockOrchestrator.simulateUsageUpdate('parallel-2', {
          inputTokens: 400,
          outputTokens: 200,
          totalTokens: 600,
          estimatedCost: 4.0
        });

        // More updates from each task
        mockOrchestrator.simulateUsageUpdate('parallel-1', {
          inputTokens: 600,
          outputTokens: 300,
          totalTokens: 900,
          estimatedCost: 6.0
        });

        mockOrchestrator.simulateUsageUpdate('parallel-2', {
          inputTokens: 800,
          outputTokens: 400,
          totalTokens: 1200,
          estimatedCost: 8.0
        });
      });

      // Should track all parallel usage
      expect(result.current.totalInputTokens).toBe(1400); // 600 + 800
      expect(result.current.totalOutputTokens).toBe(700); // 300 + 400
      expect(result.current.totalTokens).toBe(2100); // 900 + 1200
      expect(result.current.currentCost).toBe(14.0); // 6.0 + 8.0
      expect(result.current.budgetUsedPercentage).toBeCloseTo(28, 1);
    });
  });

  describe('Refresh Integration', () => {
    it('refresh resets tracking state for new calculations', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100,
          debug: true
        })
      );

      // Accumulate some usage
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 15.0
        });
      });

      expect(result.current.currentCost).toBe(15.0);

      // Call refresh
      await act(async () => {
        result.current.refresh();
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe(null);

      // New usage after refresh should start fresh
      await act(async () => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 7.5
        });
      });

      // After refresh, the previous usage tracking is reset so new usage is added fresh
      // The accumulated state persists but new calculations start fresh from the tracking
      expect(result.current.currentCost).toBe(22.5); // 15.0 + 7.5 (accumulated)
      expect(result.current.totalInputTokens).toBe(1500); // 1000 + 500 (accumulated)
      expect(result.current.isLoading).toBe(false);
    });
  });
});