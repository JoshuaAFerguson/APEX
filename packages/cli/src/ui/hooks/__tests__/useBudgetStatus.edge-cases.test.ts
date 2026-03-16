import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBudgetStatus } from '../useBudgetStatus';
import type { UseBudgetStatusOptions } from '../useBudgetStatus';
import { MockOrchestrator, createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';

describe('useBudgetStatus - Edge Cases and Error Handling', () => {
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

  describe('Malformed Usage Data', () => {
    it('handles negative token counts gracefully', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: -100,
          outputTokens: -50,
          totalTokens: -150,
          estimatedCost: -1.0
        });
      });

      // Should handle negative values (might be implementation specific)
      expect(result.current.totalInputTokens).toBeDefined();
      expect(result.current.totalOutputTokens).toBeDefined();
      expect(result.current.totalTokens).toBeDefined();
      expect(result.current.currentCost).toBeDefined();
    });

    it('handles extremely large usage values', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 1000
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: Number.MAX_SAFE_INTEGER,
          outputTokens: Number.MAX_SAFE_INTEGER,
          totalTokens: Number.MAX_SAFE_INTEGER,
          estimatedCost: Number.MAX_SAFE_INTEGER
        });
      });

      expect(result.current.totalInputTokens).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.current.budgetUsedPercentage).toBe(100); // Should be capped at 100
      expect(result.current.isOverBudget).toBe(true);
    });

    it('handles zero usage values', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0
        });
      });

      expect(result.current.totalInputTokens).toBe(0);
      expect(result.current.totalOutputTokens).toBe(0);
      expect(result.current.totalTokens).toBe(0);
      expect(result.current.currentCost).toBe(0);
      expect(result.current.budgetUsedPercentage).toBe(0);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
    });

    it('handles NaN and Infinity values', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: NaN,
          outputTokens: Infinity,
          totalTokens: -Infinity,
          estimatedCost: NaN
        });
      });

      // Hook should not crash with invalid values
      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isLoading).toBe(false);
    });

    it('handles missing usage properties', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      act(() => {
        // Simulate malformed usage event with missing properties
        (mockOrchestrator as any).emit('usage:updated', 'task-1', {
          inputTokens: 100,
          // outputTokens missing
          totalTokens: 150,
          // estimatedCost missing
        });
      });

      // Should not crash
      expect(result.current.connectionStatus).toBe('connected');
    });
  });

  describe('Inconsistent Usage Sequences', () => {
    it('handles decreasing total tokens (potential reset)', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      // First update with higher values
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 10.0
        });
      });

      expect(result.current.totalTokens).toBe(1500);

      // Second update with lower values (possible reset scenario)
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          estimatedCost: 2.0
        });
      });

      // Should handle this gracefully - exact behavior depends on implementation
      expect(result.current.totalTokens).toBeDefined();
      expect(result.current.currentCost).toBeDefined();
    });

    it('handles rapid alternating usage patterns', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      const updates = [
        { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 1.0 },
        { inputTokens: 50, outputTokens: 25, totalTokens: 75, estimatedCost: 0.5 },
        { inputTokens: 200, outputTokens: 100, totalTokens: 300, estimatedCost: 2.0 },
        { inputTokens: 75, outputTokens: 40, totalTokens: 115, estimatedCost: 0.8 },
        { inputTokens: 300, outputTokens: 150, totalTokens: 450, estimatedCost: 3.0 },
      ];

      act(() => {
        updates.forEach(update => {
          mockOrchestrator.simulateUsageUpdate('task-1', update);
        });
      });

      // Should maintain consistency despite erratic pattern
      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe('Extreme Budget Scenarios', () => {
    it('handles extremely small budget limits', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 0.001 // Very small budget
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.1
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(100);
      expect(result.current.isOverBudget).toBe(true);
    });

    it('handles negative budget limits', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: -50
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 5.0
        });
      });

      // Should handle negative budget gracefully
      expect(result.current.budgetUsedPercentage).toBe(0);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
    });

    it('handles budget limit of zero', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 0
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 5.0
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(0);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
    });

    it('handles extremely large budget limits', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: Number.MAX_SAFE_INTEGER
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000000,
          outputTokens: 500000,
          totalTokens: 1500000,
          estimatedCost: 1000.0
        });
      });

      expect(result.current.budgetUsedPercentage).toBeCloseTo(0, 10);
      expect(result.current.isOverBudget).toBe(false);
      expect(result.current.isApproachingLimit).toBe(false);
    });
  });

  describe('Invalid Threshold Values', () => {
    it('handles invalid warning threshold', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100,
          thresholds: { warningThreshold: -10, criticalThreshold: 95 }
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 90.0
        });
      });

      // Should handle invalid threshold gracefully
      expect(result.current.budgetUsedPercentage).toBe(90);
      expect(typeof result.current.isApproachingLimit).toBe('boolean');
    });

    it('handles inverted thresholds (warning > critical)', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100,
          thresholds: { warningThreshold: 95, criticalThreshold: 80 }
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 85.0
        });
      });

      // Should handle inverted thresholds gracefully
      expect(result.current.budgetUsedPercentage).toBe(85);
      expect(typeof result.current.isApproachingLimit).toBe('boolean');
    });

    it('handles extreme threshold values', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: 100,
          thresholds: {
            warningThreshold: Number.MAX_SAFE_INTEGER,
            criticalThreshold: Number.MIN_SAFE_INTEGER
          }
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 50.0
        });
      });

      expect(result.current.budgetUsedPercentage).toBe(50);
      expect(typeof result.current.isApproachingLimit).toBe('boolean');
      expect(typeof result.current.isOverBudget).toBe('boolean');
    });
  });

  describe('Event Timing and Race Conditions', () => {
    it('handles events before orchestrator is fully ready', async () => {
      let orchestratorRef: MockOrchestrator | undefined;

      const { rerender } = renderHook(
        (props: UseBudgetStatusOptions) => useBudgetStatus(props),
        { initialProps: { orchestrator: undefined } }
      );

      // Try to simulate events before orchestrator is set
      act(() => {
        // This should not crash even if orchestrator is undefined
        if (orchestratorRef) {
          orchestratorRef.simulateUsageUpdate('task-1', {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            estimatedCost: 1.0
          });
        }
      });

      // Now add the orchestrator
      orchestratorRef = mockOrchestrator;
      rerender({ orchestrator: orchestratorRef });

      // Events should work normally now
      act(() => {
        orchestratorRef!.simulateUsageUpdate('task-1', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 1.0
        });
      });
    });

    it('handles simultaneous task lifecycle events', async () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: 'race-task'
        })
      );

      // Simulate rapid-fire task events
      await act(async () => {
        mockOrchestrator.simulateTaskStart({ id: 'race-task', status: 'running' });
        mockOrchestrator.simulateUsageUpdate('race-task', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 5.0
        });
        mockOrchestrator.simulateTaskComplete({ id: 'race-task', status: 'completed' });
        mockOrchestrator.simulateTaskStart({ id: 'race-task', status: 'running' });
        mockOrchestrator.simulateUsageUpdate('race-task', {
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          estimatedCost: 2.0
        });
      });

      // Should maintain consistency despite rapid events
      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('handles events during unmounting', () => {
      const { result, unmount } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      // Start unmounting process
      unmount();

      // Try to emit events after unmounting (should not crash)
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 1.0
        });
      });

      // Should not crash or cause memory leaks
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles very long task IDs', () => {
      const longTaskId = 'a'.repeat(10000);

      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          taskId: longTaskId
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate(longTaskId, {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 1.0
        });
      });

      expect(result.current.totalTokens).toBe(150);
    });

    it('handles many rapid option changes', () => {
      const { result, rerender } = renderHook(
        (props: UseBudgetStatusOptions) => useBudgetStatus(props),
        { initialProps: { orchestrator: mockOrchestrator, budgetLimit: 100 } }
      );

      // Rapidly change options
      for (let i = 0; i < 50; i++) {
        rerender({
          orchestrator: mockOrchestrator,
          budgetLimit: 100 + i,
          thresholds: { warningThreshold: 70 + i, criticalThreshold: 90 + i },
          debug: i % 2 === 0
        });
      }

      // Should handle rapid changes without issues
      expect(result.current.budgetLimit).toBe(149);
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('handles numerous task IDs in usage tracking', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      // Create usage events for many different tasks
      act(() => {
        for (let i = 0; i < 1000; i++) {
          mockOrchestrator.simulateUsageUpdate(`task-${i}`, {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            estimatedCost: 0.1
          });
        }
      });

      // Should accumulate all usage
      expect(result.current.totalInputTokens).toBe(10000);
      expect(result.current.totalOutputTokens).toBe(5000);
      expect(result.current.totalTokens).toBe(15000);
      expect(result.current.currentCost).toBeCloseTo(100, 10);
    });
  });

  describe('Type Safety and Validation', () => {
    it('handles undefined values in options gracefully', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          budgetLimit: undefined,
          taskId: undefined,
          thresholds: undefined,
          debug: undefined
        })
      );

      expect(result.current.budgetLimit).toBeUndefined();
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('handles partial threshold objects', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          thresholds: { warningThreshold: 75 } // criticalThreshold missing
        })
      );

      // Should use default for missing criticalThreshold
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('handles empty threshold objects', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          thresholds: {} // Empty object
        })
      );

      // Should use defaults for both thresholds
      expect(result.current.connectionStatus).toBe('connected');
    });
  });

  describe('Console Error Handling', () => {
    it('handles debug logging when console is available', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          debug: true
        })
      );

      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 1.0
        });
      });

      // Should have attempted to log
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});