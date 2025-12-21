import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentHandoff } from '../useAgentHandoff.js';

describe('useAgentHandoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with non-animating state', () => {
      const { result } = renderHook(() => useAgentHandoff('developer'));

      expect(result.current).toEqual({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
        transitionPhase: 'idle',
        pulseIntensity: 0,
        arrowFrame: 0,
        handoffStartTime: null,
        arrowAnimationFrame: 0,
        iconFrame: 0,
        colorIntensity: 0,
        colorPhase: 'source-bright',
      });
    });

    it('handles undefined initial agent', () => {
      const { result } = renderHook(() => useAgentHandoff(undefined));

      expect(result.current.isAnimating).toBe(false);
      expect(result.current.previousAgent).toBe(null);
      expect(result.current.currentAgent).toBe(null);
    });
  });

  describe('agent transitions', () => {
    it('triggers animation when agent changes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      // Initial state should not be animating
      expect(result.current.isAnimating).toBe(false);

      // Change to a different agent
      act(() => {
        rerender({ agent: 'developer' });
      });

      // Should now be animating
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.previousAgent).toBe('planner');
      expect(result.current.currentAgent).toBe('developer');
      expect(result.current.progress).toBe(0);
      expect(result.current.isFading).toBe(false);
    });

    it('does not animate when agent changes to undefined', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: undefined });
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('does not animate when agent changes from undefined to a value on first render', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: undefined } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('does not animate when agent stays the same', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'planner' });
      });

      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('animation progression', () => {
    it('progresses animation over time with default duration', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // Initially at 0 progress
      expect(result.current.progress).toBe(0);
      expect(result.current.isFading).toBe(false);

      // Advance time by half the default duration (1000ms)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.progress).toBeCloseTo(0.5, 1);
      expect(result.current.isFading).toBe(false);

      // Advance to fade phase (1500ms, fade starts at 1500ms for default 2000ms duration)
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.progress).toBeCloseTo(0.75, 1);
      expect(result.current.isFading).toBe(true);

      // Complete animation (2000ms total)
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.isAnimating).toBe(false);
      expect(result.current.progress).toBe(0);
    });

    it('respects custom duration options', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 1000, fadeDuration: 200 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // Advance to fade phase (800ms, fade starts at 800ms for 1000ms duration - 200ms fade)
      act(() => {
        vi.advanceTimersByTime(800);
      });

      expect(result.current.progress).toBeCloseTo(0.8, 1);
      expect(result.current.isFading).toBe(true);

      // Complete animation (1000ms total)
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('respects custom frame rate', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { frameRate: 10, duration: 1000 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // With 10fps, each frame should be 100ms
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.progress).toBeCloseTo(0.1, 1);
    });
  });

  describe('animation interruption', () => {
    it('clears previous animation when new transition starts', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      // Start first animation
      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(true);
      expect(result.current.previousAgent).toBe('planner');
      expect(result.current.currentAgent).toBe('developer');

      // Advance partway through first animation
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.progress).toBeGreaterThan(0);

      // Start second animation before first completes
      act(() => {
        rerender({ agent: 'tester' });
      });

      // Should start new animation with updated agents
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.previousAgent).toBe('developer');
      expect(result.current.currentAgent).toBe('tester');
      expect(result.current.progress).toBe(0); // Reset to beginning
    });

    it('handles rapid agent changes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      // Rapid succession of agent changes
      act(() => {
        rerender({ agent: 'architect' });
        rerender({ agent: 'developer' });
        rerender({ agent: 'tester' });
      });

      // Should show the last transition
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.previousAgent).toBe('developer');
      expect(result.current.currentAgent).toBe('tester');
    });
  });

  describe('cleanup', () => {
    it('cleans up animation interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const { result, rerender, unmount } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      // Start animation
      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(true);

      // Unmount component
      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('cleans up interval when animation completes naturally', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      // Start animation
      act(() => {
        rerender({ agent: 'developer' });
      });

      expect(result.current.isAnimating).toBe(true);

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2050);
      });

      expect(result.current.isAnimating).toBe(false);
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('handles very short duration', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 100, fadeDuration: 20 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('handles fade duration longer than total duration', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 1000, fadeDuration: 1500 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // Should start fading immediately since fade duration > total duration
      act(() => {
        vi.advanceTimersByTime(34);
      });
      expect(result.current.isFading).toBe(true);
    });

    it('handles zero duration', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 0 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // Should complete immediately
      act(() => {
        vi.advanceTimersByTime(34);
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('handles high frame rate', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { frameRate: 120, duration: 1000 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // With 120fps, each frame should be ~8.33ms
      act(() => {
        vi.advanceTimersByTime(9);
      });

      expect(result.current.progress).toBeCloseTo(0.009, 2);
    });
  });

  describe('progress calculation', () => {
    it('calculates progress correctly throughout animation', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 1000 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // Test progress at various points
      const testPoints = [0, 100, 250, 500, 750, 900, 1000];

      let elapsed = 0;
      const frameInterval = 34;
      for (const time of testPoints) {
        if (time === 0) {
          expect(result.current.progress).toBeCloseTo(0, 2);
          continue;
        }

        act(() => {
          const advanceBy = Math.max(time - elapsed, 0) + frameInterval;
          vi.advanceTimersByTime(advanceBy);
          elapsed += advanceBy;
        });

        const expectedProgress = Math.min(elapsed / 1000, 1);
        expect(result.current.progress).toBeCloseTo(expectedProgress, 2);
      }
    });

    it('never exceeds progress of 1', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 1000 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // Advance way beyond animation duration
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.progress).toBeLessThanOrEqual(1);
      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('fade timing', () => {
    it('calculates fade timing correctly with default options', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // Default: 2000ms total, 500ms fade = fade starts at 1500ms
      act(() => {
        vi.advanceTimersByTime(1400);
        vi.advanceTimersByTime(34);
      });
      expect(result.current.isFading).toBe(false);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.isFading).toBe(true);
    });

    it('calculates fade timing correctly with custom options', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { duration: 3000, fadeDuration: 1000 }),
        { initialProps: { agent: 'planner' } }
      );

      act(() => {
        rerender({ agent: 'developer' });
      });

      // 3000ms total, 1000ms fade = fade starts at 2000ms
      act(() => {
        vi.advanceTimersByTime(1900);
        vi.advanceTimersByTime(34);
      });
      expect(result.current.isFading).toBe(false);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.isFading).toBe(true);
    });
  });
});
