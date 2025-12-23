/**
 * Performance and stress tests for useAgentHandoff hook
 * Tests memory management, cleanup, and high-frequency updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentHandoff } from '../useAgentHandoff.js';

describe('useAgentHandoff Performance Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('memory management', () => {
    it('properly cleans up multiple overlapping animations', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      // Start multiple rapid transitions
      const agents = ['architect', 'developer', 'tester', 'reviewer', 'devops'];

      agents.forEach((agent, index) => {
        act(() => {
          rerender({ agent });
        });
        // Advance slightly but not enough to complete
        act(() => {
          vi.advanceTimersByTime(100);
        });
      });

      // Each transition should clear the previous interval and create a new one
      // We should have 5 setInterval calls (one for each transition)
      expect(setIntervalSpy).toHaveBeenCalledTimes(5);
      // We should have 4 clearInterval calls (each new transition clears the previous)
      expect(clearIntervalSpy).toHaveBeenCalledTimes(4);

      clearIntervalSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });

    it('handles high-frequency agent changes without memory leaks', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { result, rerender, unmount } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      // Simulate very high frequency changes (100 changes)
      for (let i = 0; i < 100; i++) {
        const agent = `agent-${i}`;
        act(() => {
          rerender({ agent });
        });

        // Advance time slightly but not enough to complete any animation
        act(() => {
          vi.advanceTimersByTime(10);
        });
      }

      // Unmount to trigger cleanup
      unmount();

      // Should have called clearInterval for cleanup
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('handles unmount during animation without errors', () => {
      const { result, rerender, unmount } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      // Start animation
      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(true);

      // Unmount during animation
      unmount();

      // Advance timers after unmount - should not cause errors
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not cause any errors
    });
  });

  describe('performance with different frame rates', () => {
    it('handles very high frame rate efficiently', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { frameRate: 120, duration: 1000 }),
        { initialProps: { agent: 'planner' } }
      );

      // Start animation with 120fps
      act(() => {
        rerender({ agent: 'developer' });
      });

      // Check that interval is set with correct timing (1000ms / 120fps ≈ 8.33ms)
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), expect.closeTo(8.33, 1));

      setIntervalSpy.mockRestore();
    });

    it('handles low frame rate without issues', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { frameRate: 5, duration: 1000 }),
        { initialProps: { agent: 'planner' } }
      );

      // Start animation with 5fps
      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(true);

      // Each frame should be 200ms (1000ms / 5fps)
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.progress).toBeCloseTo(0.2, 1);

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(800);
      });

      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('stress testing', () => {
    it('handles rapid succession of agent changes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'agent-0' } }
      );

      // Rapidly change agents 50 times
      for (let i = 1; i <= 50; i++) {
        act(() => {
          rerender({ agent: `agent-${i}` });
        });
      }

      // Should end with the last transition
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.previousAgent).not.toBeNull();
      expect(result.current.currentAgent).toBe('agent-50');
      expect(result.current.previousAgent).not.toBe('agent-50');
      expect(result.current.progress).toBe(0);

      // Complete the final animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('handles animation with very short duration', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 50, fadeDuration: 10 }),
        { initialProps: { agent: 'planner' } }
      );

      // Start animation with very short duration
      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(true);

      // Should complete very quickly
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('handles animation with very long duration', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 60000, fadeDuration: 5000 }), // 1 minute
        { initialProps: { agent: 'planner' } }
      );

      // Start animation with very long duration
      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(true);

      // Advance halfway
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(result.current.progress).toBeCloseTo(0.5, 1);
      expect(result.current.isFading).toBe(false);

      // Advance to fade phase (60000 - 5000 = 55000ms)
      act(() => {
        vi.advanceTimersByTime(25000);
      });

      expect(result.current.isFading).toBe(true);

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('edge case performance', () => {
    it('handles zero duration gracefully', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 0 }),
        { initialProps: { agent: 'planner' } }
      );

      // Start animation with zero duration
      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(true);

      // Should complete immediately on first timer tick
      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('handles negative duration gracefully', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: -1000 }),
        { initialProps: { agent: 'planner' } }
      );

      // Start animation with negative duration
      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(true);

      // Should complete immediately since progress will be >= 1
      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('handles extreme frame rates', () => {
      // Test very high frame rate (1000fps)
      const { result: highFpsResult, rerender: highFpsRerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { frameRate: 1000, duration: 1000 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        highFpsRerender({ agent: 'developer' });
      });

      expect(highFpsResult.current.isAnimating).toBe(true);

      // Test very low frame rate (0.1fps - 1 frame per 10 seconds)
      const { result: lowFpsResult, rerender: lowFpsRerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { frameRate: 0.1, duration: 1000 }),
        { initialProps: { agent: 'architect' } }
      );

      act(() => {
        lowFpsRerender({ agent: 'tester' });
      });

      expect(lowFpsResult.current.isAnimating).toBe(true);

      // Both should work without errors
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(highFpsResult.current.isAnimating).toBe(false);
      expect(lowFpsResult.current.isAnimating).toBe(false);
    });
  });

  describe('concurrent animations', () => {
    it('handles multiple hook instances independently', () => {
      // Create multiple hook instances
      const hooks = Array.from({ length: 5 }, (_, i) =>
        renderHook(
          ({ agent }) => useAgentHandoff(agent),
          { initialProps: { agent: `initial-${i}` } }
        )
      );

      // Start animations on all hooks simultaneously
      hooks.forEach(({ rerender }, i) => {
        act(() => {
          rerender({ agent: `target-${i}` });
        });
      });

      // All should be animating
      hooks.forEach(({ result }, i) => {
        expect(result.current.isAnimating).toBe(true);
        expect(result.current.previousAgent).toBe(`initial-${i}`);
        expect(result.current.currentAgent).toBe(`target-${i}`);
      });

      // Complete all animations
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // All should be complete
      hooks.forEach(({ result }) => {
        expect(result.current.isAnimating).toBe(false);
      });

      // Cleanup
      hooks.forEach(({ unmount }) => unmount());
    });

    it('handles staggered animation starts', () => {
      const hooks = Array.from({ length: 3 }, (_, i) =>
        renderHook(
          ({ agent }) => useAgentHandoff(agent),
          { initialProps: { agent: `initial-${i}` } }
        )
      );

      // Start animations at different times
      hooks.forEach(({ rerender }, i) => {
        act(() => {
          vi.advanceTimersByTime(i * 500); // 0ms, 500ms, 1000ms delays
          rerender({ agent: `target-${i}` });
        });
      });

      // First should be most progressed, last should be just starting
      expect(hooks[0].result.current.progress).toBeGreaterThan(hooks[1].result.current.progress);
      expect(hooks[1].result.current.progress).toBeGreaterThan(hooks[2].result.current.progress);

      // Cleanup
      hooks.forEach(({ unmount }) => unmount());
    });
  });
});
