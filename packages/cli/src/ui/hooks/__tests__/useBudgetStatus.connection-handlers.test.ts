import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBudgetStatus } from '../useBudgetStatus';
import { MockOrchestrator, createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';

describe('useBudgetStatus - Additional Coverage Tests', () => {
  let mockOrchestrator: MockOrchestrator;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockOrchestrator.cleanup();
    consoleSpy.mockRestore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Debug Logging Coverage', () => {
    it('logs when setting up orchestrator event listeners', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          debug: true
        })
      );

      // Should log setup and registration messages
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useBudgetStatus] Setting up orchestrator event listeners',
        ''
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useBudgetStatus] Event listeners registered',
        ''
      );
    });

    it('logs when cleaning up event listeners on unmount', () => {
      const { unmount } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          debug: true
        })
      );

      // Clear previous logs
      consoleSpy.mockClear();

      unmount();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useBudgetStatus] Event listeners cleaned up',
        ''
      );
    });

    it('does not log setup messages when debug is false', () => {
      renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator,
          debug: false
        })
      );

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Connection Status Based on Orchestrator Presence', () => {
    it('sets connected status when orchestrator is provided', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: mockOrchestrator
        })
      );

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('sets disconnected status with error when no orchestrator', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({
          orchestrator: undefined
        })
      );

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error?.message).toBe('No orchestrator provided');
    });

    it('transitions from disconnected to connected when orchestrator is provided', () => {
      const { result, rerender } = renderHook(
        (props) => useBudgetStatus(props),
        { initialProps: { orchestrator: undefined } }
      );

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.error?.message).toBe('No orchestrator provided');

      rerender({ orchestrator: mockOrchestrator });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.error).toBe(null);
    });

    it('clears error when transitioning to connected state', () => {
      const { result, rerender } = renderHook(
        (props) => useBudgetStatus(props),
        { initialProps: { orchestrator: undefined, debug: true } }
      );

      expect(result.current.error).toBeInstanceOf(Error);

      rerender({ orchestrator: mockOrchestrator, debug: true });

      expect(result.current.error).toBe(null);
      expect(result.current.connectionStatus).toBe('connected');
    });
  });

  describe('Event Listener Registration Patterns', () => {
    it('registers all required event listeners on mount', () => {
      const onSpy = vi.spyOn(mockOrchestrator, 'on');

      renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      // Verify all expected event listeners are registered
      expect(onSpy).toHaveBeenCalledWith('usage:updated', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('task:failed', expect.any(Function));
    });

    it('removes all event listeners on unmount', () => {
      const offSpy = vi.spyOn(mockOrchestrator, 'off');

      const { unmount } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      unmount();

      // Verify all event listeners are cleaned up
      expect(offSpy).toHaveBeenCalledWith('usage:updated', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('task:failed', expect.any(Function));
    });

    it('re-registers listeners when orchestrator changes', () => {
      const onSpy = vi.spyOn(mockOrchestrator, 'on');
      const offSpy = vi.spyOn(mockOrchestrator, 'off');

      const newMockOrchestrator = createMockOrchestrator();
      const newOnSpy = vi.spyOn(newMockOrchestrator, 'on');

      const { rerender } = renderHook(
        (props) => useBudgetStatus(props),
        { initialProps: { orchestrator: mockOrchestrator } }
      );

      // Clear call counts
      onSpy.mockClear();

      // Change orchestrator
      rerender({ orchestrator: newMockOrchestrator });

      // Should clean up old listeners
      expect(offSpy).toHaveBeenCalledTimes(4);

      // Should register new listeners
      expect(newOnSpy).toHaveBeenCalledWith('usage:updated', expect.any(Function));
      expect(newOnSpy).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(newOnSpy).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(newOnSpy).toHaveBeenCalledWith('task:failed', expect.any(Function));

      newMockOrchestrator.cleanup();
    });
  });

  describe('useOrchestratorEvents Pattern Compatibility', () => {
    it('follows the same event subscription pattern as useOrchestratorEvents', () => {
      const onSpy = vi.spyOn(mockOrchestrator, 'on');
      const offSpy = vi.spyOn(mockOrchestrator, 'off');

      const { unmount } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      // Should register event listeners like useOrchestratorEvents pattern
      expect(onSpy).toHaveBeenCalledWith('usage:updated', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('task:failed', expect.any(Function));

      unmount();

      // Should clean up listeners on unmount like useOrchestratorEvents
      expect(offSpy).toHaveBeenCalledWith('usage:updated', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith('task:failed', expect.any(Function));
    });

    it('provides the same state structure as similar hooks', () => {
      const { result } = renderHook(() =>
        useBudgetStatus({ orchestrator: mockOrchestrator })
      );

      // Should match expected interface structure
      expect(result.current).toMatchObject({
        // Budget data fields
        currentCost: expect.any(Number),
        budgetUsedPercentage: expect.any(Number),
        totalInputTokens: expect.any(Number),
        totalOutputTokens: expect.any(Number),
        totalTokens: expect.any(Number),
        estimatedCost: expect.any(Number),
        isOverBudget: expect.any(Boolean),
        isApproachingLimit: expect.any(Boolean),

        // Standard hook fields (like useOrchestratorEvents)
        connectionStatus: expect.stringMatching(/^(connected|disconnected|connecting)$/),
        isLoading: expect.any(Boolean),
        refresh: expect.any(Function),
      });

      // Test specific fields that can be undefined/null
      expect(['string', 'number', 'undefined']).toContain(typeof result.current.budgetLimit);
      expect([null, undefined]).toContain(result.current.error) ||
        expect(result.current.error).toBeInstanceOf(Error);
    });

    it('handles orchestrator dependency updates like useOrchestratorEvents', () => {
      const { result, rerender } = renderHook(
        (props) => useBudgetStatus(props),
        { initialProps: { orchestrator: mockOrchestrator } }
      );

      // Initial state should be connected
      expect(result.current.connectionStatus).toBe('connected');

      // Change orchestrator instance
      const newMockOrchestrator = createMockOrchestrator();
      rerender({ orchestrator: newMockOrchestrator });

      expect(result.current.connectionStatus).toBe('connected');

      // Remove orchestrator
      rerender({ orchestrator: undefined });

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.error?.message).toBe('No orchestrator provided');

      newMockOrchestrator.cleanup();
    });

    it('maintains consistent event handler behavior across re-renders', () => {
      const { result, rerender } = renderHook(
        (props) => useBudgetStatus(props),
        { initialProps: { orchestrator: mockOrchestrator, debug: true } }
      );

      // Add some budget data
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 500,
          outputTokens: 250,
          totalTokens: 750,
          estimatedCost: 5.0
        });
      });

      expect(result.current.currentCost).toBe(5.0);

      // Change non-orchestrator props
      rerender({ orchestrator: mockOrchestrator, debug: false, budgetLimit: 100 });

      // Event handlers should still work
      act(() => {
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 10.0
        });
      });

      expect(result.current.currentCost).toBe(10.0);
      expect(result.current.budgetLimit).toBe(100);
      expect(result.current.budgetUsedPercentage).toBe(10);
    });
  });
});