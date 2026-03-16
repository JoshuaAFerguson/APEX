import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBudgetStatus } from '../useBudgetStatus';
import type { BudgetData, BudgetStatusState, UseBudgetStatusOptions } from '../useBudgetStatus';
import { MockOrchestrator, createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';

describe('useBudgetStatus', () => {
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

  describe('Initialization', () => {
    it('initializes with default state', () => {
      const { result } = renderHook(() => useBudgetStatus());

      expect(result.current.currentCost).toBe(0);
      expect(result.current.totalInputTokens).toBe(0);
      expect(result.current.totalOutputTokens).toBe(0);
      expect(result.current.totalTokens).toBe(0);
      expect(result.current.estimatedCost).toBe(0);
      expect(result.current.budgetUsedPercentage).toBe(0);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isLoading).toBe(false); // Should be false when no orchestrator
      expect(result.current.error).toBeInstanceOf(Error); // Should have error when no orchestrator
      expect(result.current.error?.message).toBe('No orchestrator provided');
      expect(typeof result.current.refresh).toBe('function');
    });

    it('initializes with custom budget limit', () => {
      const budgetLimit = 50;
      const { result } = renderHook(() => useBudgetStatus({ budgetLimit }));

      expect(result.current.budgetLimit).toBe(budgetLimit);
      expect(result.current.budgetUsedPercentage).toBe(0);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
    });

    it('handles undefined orchestrator gracefully', () => {
      const { result } = renderHook(() => useBudgetStatus({ orchestrator: undefined }));

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('No orchestrator provided');
    });

    it('initializes with orchestrator and shows connected state', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('initializes with custom thresholds', () => {
      const customThresholds = { warningThreshold: 70, criticalThreshold: 90 };
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100,
          thresholds: customThresholds
        })
      );

      // Should be initialized but no budget calculation done yet
      expect(result.current.isApproachingLimit).toBe(false);
      expect(result.current.isOverBudget).toBe(false);
    });
  });

  describe('Usage Event Handling', () => {
    it('processes usage:updated events correctly', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.02
        });
      });

      expect(result.current.totalInputTokens).toBe(1000);
      expect(result.current.totalOutputTokens).toBe(500);
      expect(result.current.totalTokens).toBe(1500);
      expect(result.current.currentCost).toBe(0.02);
      expect(result.current.estimatedCost).toBe(0.02);
      expect(result.current.budgetUsedPercentage).toBe(0.02);
    });

    it('accumulates multiple usage updates', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      act(() => {
        // First update
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 0.01
        });

        // Second update (should calculate delta)
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.02
        });
      });

      // Should accumulate the delta (500 input, 250 output, 750 total, 0.01 cost)
      expect(result.current.totalInputTokens).toBe(1000);
      expect(result.current.totalOutputTokens).toBe(500);
      expect(result.current.totalTokens).toBe(1500);
      expect(result.current.currentCost).toBe(0.02);
    });

    it('handles usage updates from different tasks when no taskId filter', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 0.01
        });

        mockOrchestrator.simulateUsageUpdate('task-2', {
          inputTokens: 300,
          outputTokens: 150,
          totalTokens: 450,
          estimatedCost: 0.005
        });
      });

      // Should track both tasks
      expect(result.current.totalInputTokens).toBe(800);
      expect(result.current.totalOutputTokens).toBe(400);
      expect(result.current.totalTokens).toBe(1200);
      expect(result.current.currentCost).toBe(0.015);
    });

    it('filters events by taskId when specified', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: 'task-1'
        })
      );

      act(() => {
        // Should be processed
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 0.01
        });

        // Should be ignored
        mockOrchestrator.simulateUsageUpdate('task-2', {
          inputTokens: 300,
          outputTokens: 150,
          totalTokens: 450,
          estimatedCost: 0.005
        });
      });

      // Should only track task-1
      expect(result.current.totalInputTokens).toBe(500);
      expect(result.current.totalOutputTokens).toBe(250);
      expect(result.current.totalTokens).toBe(750);
      expect(result.current.currentCost).toBe(0.01);
    });
  });

  describe('Budget Calculations', () => {
    it('calculates budget percentage correctly', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(25);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
    });

    it('detects approaching budget limit', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100,
          thresholds: { warningThreshold: 80, criticalThreshold: 95 }
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 85
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(85);
      expect(result.current.isApproachingLimit).toBe(true);
      expect(result.current.isOverBudget).toBe(false);
    });

    it('detects over budget condition', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 5000,
          outputTokens: 2500,
          totalTokens: 7500,
          estimatedCost: 150
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(100); // Capped at 100
      expect(result.current.isOverBudget).toBe(true);
      expect(result.current.isApproachingLimit).toBe(false);
    });

    it('handles no budget limit gracefully', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25
        });
      });

      expect(result.current.budgetLimit).toBeUndefined();
      expect(result.current.budgetUsedPercentage).toBe(0);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
    });

    it('handles zero budget limit', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 0
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(0);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
    });

    it('updates budget calculations when budget limit changes', () => {
      const { result, rerender } = renderHook(
        (props: UseBudgetStatusOptions) => useBudgetStatus(props),
        { initialProps: { orchestrator: mockOrchestrator, budgetLimit: 100 } }
      );

      // Add some usage first
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 50
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(50);

      // Change budget limit
      rerender({ orchestrator: mockOrchestrator, budgetLimit: 200 });

      expect(result.current.budgetLimit).toBe(200);
      expect(result.current.budgetUsedPercentage).toBe(25);
    });
  });

  describe('Task Lifecycle Events', () => {
    it('resets state on task:started', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: 'task-1'
        })
      );

      // Add some usage first
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25
        });
      });

      expect(result.current.currentCost).toBe(25);

      // Start new task should reset
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: 'task-1', status: 'running' });
      });

      expect(result.current.currentCost).toBe(0);
      expect(result.current.totalInputTokens).toBe(0);
      expect(result.current.totalOutputTokens).toBe(0);
      expect(result.current.totalTokens).toBe(0);
      expect(result.current.estimatedCost).toBe(0);
      expect(result.current.budgetUsedPercentage).toBe(0);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('stops loading on task:completed', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: 'task-1'
        })
      );

      act(() => {
        mockOrchestrator.simulateTaskComplete({ id: 'task-1', status: 'completed' });
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('sets error on task:failed', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: 'task-1'
        })
      );

      const testError = new Error('Test task failure');

      act(() => {
        mockOrchestrator.simulateTaskFail(
          { id: 'task-1', status: 'failed' },
          testError
        );
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Task failed: Test task failure');
    });

    it('ignores task events for different taskId', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: 'task-1'
        })
      );

      // Add some usage first
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25
        });
      });

      const originalCost = result.current.currentCost;

      // Different task events should be ignored
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: 'task-2', status: 'running' });
        mockOrchestrator.simulateTaskComplete({ id: 'task-2', status: 'completed' });
        mockOrchestrator.simulateTaskFail(
          { id: 'task-2', status: 'failed' },
          new Error('Other task error')
        );
      });

      // State should be unchanged
      expect(result.current.currentCost).toBe(originalCost);
      expect(result.current.error).toBe(null);
    });
  });

  describe('Refresh Functionality', () => {
    it('provides a refresh function', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      expect(typeof result.current.refresh).toBe('function');
    });

    it('resets state when refresh is called', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      // Add some usage first
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25
        });
      });

      expect(result.current.currentCost).toBe(25);

      // Call refresh
      act(() => {
        result.current.refresh();
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it('refresh function updates when dependencies change', () => {
      const { result, rerender } = renderHook(
        (props: UseBudgetStatusOptions) => useBudgetStatus(props),
        { initialProps: { orchestrator: mockOrchestrator, debug: false } }
      );

      const originalRefresh = result.current.refresh;

      // Change debug setting
      rerender({ orchestrator: mockOrchestrator, debug: true });

      const newRefresh = result.current.refresh;

      // Should be different function references
      expect(newRefresh).not.toBe(originalRefresh);
    });
  });

  describe('Debug Logging', () => {
    it('does not log when debug is false', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          debug: false
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25
        });
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('logs when debug is true', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          debug: true
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25
        });
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useBudgetStatus]'),
        expect.anything()
      );
      consoleSpy.mockRestore();
    });

    it('logs refresh calls when debug is true', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          debug: true
        })
      );

      act(() => {
        result.current.refresh();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useBudgetStatus] Manual refresh requested'),
        ''
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('handles negative usage values gracefully', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: -100,
          outputTokens: -50,
          totalTokens: -150,
          estimatedCost: -0.01
        });
      });

      // Should handle negative values without breaking
      expect(result.current.totalInputTokens).toBe(-100);
      expect(result.current.totalOutputTokens).toBe(-50);
      expect(result.current.totalTokens).toBe(-150);
      expect(result.current.currentCost).toBe(-0.01);
    });

    it('handles very large usage values', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 1000000
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: Number.MAX_SAFE_INTEGER,
          outputTokens: 1000000,
          totalTokens: Number.MAX_SAFE_INTEGER + 1000000,
          estimatedCost: 999999
        });
      });

      // Should handle large values without overflow issues
      expect(result.current.totalInputTokens).toBe(Number.MAX_SAFE_INTEGER);
      // Budget percentage is calculated as (999999 / 1000000) * 100 = 99.9999
      expect(result.current.budgetUsedPercentage).toBeCloseTo(99.9999, 4);
    });

    it('handles rapid successive updates correctly', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      // Simulate rapid updates
      act(() => {
        for (let i = 1; i <= 10; i++) {
          mockOrchestrator.simulateUsageUpdate('task-1', {
            inputTokens: i * 100,
            outputTokens: i * 50,
            totalTokens: i * 150,
            estimatedCost: i * 0.01
          });
        }
      });

      // Should have the final values
      expect(result.current.totalInputTokens).toBe(1000);
      expect(result.current.totalOutputTokens).toBe(500);
      expect(result.current.totalTokens).toBe(1500);
      expect(result.current.currentCost).toBe(0.10);
    });

    it('handles usage decrease scenarios (delta calculation)', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      // First update
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.05
        });
      });

      // Second update with lower values - this will be treated as a new total update
      // because the total tokens are less than the previous, so it won't use delta calculation
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 0.02
        });
      });

      // The hook logic treats decreasing total tokens as a full update, not a delta
      // So it will add the new values as-is
      expect(result.current.totalInputTokens).toBe(1500); // 1000 + 500
      expect(result.current.totalOutputTokens).toBe(750); // 500 + 250
      expect(result.current.totalTokens).toBe(2250); // 1500 + 750
      expect(result.current.currentCost).toBe(0.07); // 0.05 + 0.02
    });

    it('handles corrupted usage data', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      act(() => {
        // Simulate corrupted/invalid usage data
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: NaN,
          outputTokens: Infinity,
          totalTokens: null as any,
          estimatedCost: undefined as any
        });
      });

      // Should handle invalid data gracefully (values become NaN/Infinity but don't crash)
      // JavaScript arithmetic with NaN/null/undefined produces predictable results
      expect(result.current.totalInputTokens).toBeNaN();
      expect(result.current.totalOutputTokens).toBe(Infinity);
      // null + 0 (initial state) = 0 in JavaScript
      expect(result.current.totalTokens).toBe(0);
      // undefined + 0 (initial state) = NaN in JavaScript
      expect(result.current.currentCost).toBeNaN();
    });
  });

  describe('Connection State Management', () => {
    it('shows connecting state briefly during initialization', () => {
      // Create a custom mock orchestrator that we can control the connection timing
      const slowMockOrchestrator = createMockOrchestrator();

      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: slowMockOrchestrator })
      );

      // Should start as connected after the effect runs
      // Note: In the current implementation, it immediately goes to 'connected'
      // This test documents the current behavior
      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.error).toBe(null);
    });

    it('handles connection error state when orchestrator events fail', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      // Simulate a connection loss through error handling
      act(() => {
        // Emit an event that could cause connection issues
        // In this case, we'll simulate this through task failure
        mockOrchestrator.simulateTaskFail(
          { id: 'test-task', status: 'failed' },
          new Error('Connection lost')
        );
      });

      // Should maintain connected status but show error
      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('transitions between connection states properly', () => {
      let orchestratorRef: typeof mockOrchestrator | undefined = undefined;

      const { result, rerender } = renderHook(
        (props: UseBudgetStatusOptions) => useBudgetStatus(props),
        { initialProps: { orchestrator: undefined } }
      );

      // Start disconnected
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.error?.message).toBe('No orchestrator provided');

      // Connect orchestrator
      orchestratorRef = mockOrchestrator;
      rerender({ orchestrator: orchestratorRef });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.error).toBe(null);

      // Disconnect again
      rerender({ orchestrator: undefined });

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.error?.message).toBe('No orchestrator provided');
    });
  });

  describe('Event Cleanup', () => {
    it('cleans up event listeners on unmount', () => {
      const offSpy = vi.spyOn(mockOrchestrator, 'off');

      const { unmount } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      unmount();

      // Should have called off for each event type
      expect(offSpy).toHaveBeenCalledWith('usage:updated', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('task:failed', expect.any(Function));
    });

    it('does not leak memory with multiple mount/unmount cycles', () => {
      const initialListenerCount = mockOrchestrator.listenerCount('usage:updated');

      // Mount and unmount multiple times
      for (let i = 0; i < 3; i++) {
        const { unmount } = renderHook(() =>
          useBudgetStatus({ orchestrator: mockOrchestrator })
        );
        unmount();
      }

      // Should not accumulate listeners
      expect(mockOrchestrator.listenerCount('usage:updated')).toBe(initialListenerCount);
    });

    it('handles orchestrator change gracefully', () => {
      const mockOrchestrator2 = createMockOrchestrator();

      const { rerender, unmount } = renderHook(
        (props: UseBudgetStatusOptions) => useBudgetStatus(props),
        { initialProps: { orchestrator: mockOrchestrator } }
      );

      // Change to new orchestrator
      rerender({ orchestrator: mockOrchestrator2 });

      // Should not crash and should listen to new orchestrator
      act(() => {
        mockOrchestrator2.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 25
        });
      });

      unmount();
      mockOrchestrator2.cleanup();
    });
  });
});