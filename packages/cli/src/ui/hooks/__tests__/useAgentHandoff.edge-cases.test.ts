/**
 * Edge case and error condition tests for enhanced useAgentHandoff features
 *
 * Tests boundary conditions, error handling, and edge cases for the enhanced
 * animation features to ensure robustness and reliability.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentHandoff } from '../useAgentHandoff.js';

describe('useAgentHandoff - Enhanced Features Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('enhanced arrow frame boundary conditions', () => {
    it('handles zero duration with enhanced arrow style', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          duration: 0
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1);
      });

      // Should complete immediately without errors
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.arrowAnimationFrame).toBe(0);
    });

    it('handles very short duration with enhanced arrow style', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          duration: 10
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(5);
      });

      // Frame should be valid even with very short duration
      expect(result.current.arrowAnimationFrame).toBeGreaterThanOrEqual(0);
      expect(result.current.arrowAnimationFrame).toBeLessThanOrEqual(7);

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('handles very long duration with enhanced arrow style', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          duration: 60000 // 1 minute
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      // Test at various points in very long animation
      const testPoints = [1000, 5000, 15000, 30000];

      for (const time of testPoints) {
        act(() => {
          vi.advanceTimersByTime(time);
        });

        expect(result.current.arrowAnimationFrame).toBeGreaterThanOrEqual(0);
        expect(result.current.arrowAnimationFrame).toBeLessThanOrEqual(7);
      }
    });

    it('arrow frame never exceeds maximum for enhanced style', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { arrowStyle: 'enhanced' }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const allFrames: number[] = [];

      // Sample extensively throughout animation
      for (let i = 0; i < 100; i++) {
        act(() => {
          vi.advanceTimersByTime(20);
        });

        allFrames.push(result.current.arrowAnimationFrame);
      }

      // No frame should exceed 7
      expect(Math.max(...allFrames)).toBeLessThanOrEqual(7);
      expect(Math.min(...allFrames)).toBeGreaterThanOrEqual(0);
    });

    it('handles invalid arrow style gracefully', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'invalid' as any
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should fallback gracefully without throwing
      expect(result.current.arrowAnimationFrame).toBeGreaterThanOrEqual(0);
      expect(typeof result.current.arrowAnimationFrame).toBe('number');
    });
  });

  describe('icon animation edge cases', () => {
    it('icon frame never exceeds maximum value of 7', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableIcons: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const allIconFrames: number[] = [];

      for (let i = 0; i < 100; i++) {
        act(() => {
          vi.advanceTimersByTime(20);
        });

        allIconFrames.push(result.current.iconFrame);
      }

      expect(Math.max(...allIconFrames)).toBeLessThanOrEqual(7);
      expect(Math.min(...allIconFrames)).toBeGreaterThanOrEqual(0);
    });

    it('icon animation handles zero duration', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          enableIcons: true,
          duration: 0
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.iconFrame).toBe(0);
      expect(result.current.isAnimating).toBe(false);
    });

    it('icon animation with extreme frame rates', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          enableIcons: true,
          frameRate: 240 // Very high frame rate
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.iconFrame).toBeGreaterThanOrEqual(0);
      expect(result.current.iconFrame).toBeLessThanOrEqual(7);
    });

    it('icon animation with very low frame rate', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          enableIcons: true,
          frameRate: 1 // Very low frame rate
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.iconFrame).toBeGreaterThanOrEqual(0);
      expect(result.current.iconFrame).toBeLessThanOrEqual(7);
    });
  });

  describe('color transition edge cases', () => {
    it('color intensity always stays within 0-1 range', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableColorTransition: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const allIntensities: number[] = [];

      for (let i = 0; i < 100; i++) {
        act(() => {
          vi.advanceTimersByTime(20);
        });

        allIntensities.push(result.current.colorIntensity);
      }

      expect(Math.min(...allIntensities)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...allIntensities)).toBeLessThanOrEqual(1);
    });

    it('color phase always returns valid values', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableColorTransition: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const validPhases = ['source-bright', 'transitioning', 'target-bright'];
      const allPhases: string[] = [];

      for (let i = 0; i < 100; i++) {
        act(() => {
          vi.advanceTimersByTime(20);
        });

        allPhases.push(result.current.colorPhase);
      }

      // All observed phases should be valid
      allPhases.forEach(phase => {
        expect(validPhases).toContain(phase);
      });
    });

    it('color transition handles zero duration', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          enableColorTransition: true,
          duration: 0
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.colorIntensity).toBe(0);
      expect(result.current.colorPhase).toBe('source-bright');
      expect(result.current.isAnimating).toBe(false);
    });

    it('color transition handles extremely short durations', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          enableColorTransition: true,
          duration: 1 // 1ms
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1);
      });

      // Should complete without errors
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.colorIntensity).toBe(0);
      expect(result.current.colorPhase).toBe('source-bright');
    });
  });

  describe('memory and performance edge cases', () => {
    it('handles rapid handoffs without memory leaks', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true,
          duration: 100 // Short for rapid testing
        }),
        { initialProps: { agent: 'agent1' as string | undefined } }
      );

      // Perform many rapid handoffs
      const agents = ['agent1', 'agent2', 'agent3', 'agent4', 'agent5'];

      for (let cycle = 0; cycle < 20; cycle++) {
        for (let i = 0; i < agents.length; i++) {
          rerender({ agent: agents[i] });

          act(() => {
            vi.advanceTimersByTime(50);
          });

          // Should maintain valid state throughout
          expect(typeof result.current.arrowAnimationFrame).toBe('number');
          expect(typeof result.current.iconFrame).toBe('number');
          expect(typeof result.current.colorIntensity).toBe('number');
        }
      }

      // Final state should be valid
      expect(result.current.arrowAnimationFrame).toBeGreaterThanOrEqual(0);
      expect(result.current.iconFrame).toBeGreaterThanOrEqual(0);
      expect(result.current.colorIntensity).toBeGreaterThanOrEqual(0);
    });

    it('handles very high frame rates without issues', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          frameRate: 1000, // Extremely high frame rate
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should still function correctly
      expect(result.current.arrowAnimationFrame).toBeGreaterThanOrEqual(0);
      expect(result.current.iconFrame).toBeGreaterThanOrEqual(0);
      expect(result.current.colorIntensity).toBeGreaterThanOrEqual(0);
    });

    it('handles animation interruption during cleanup', () => {
      const { result, rerender, unmount } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.isAnimating).toBe(true);

      // Unmount during active animation
      unmount();

      // Should not throw errors or cause issues
      expect(true).toBe(true); // If we get here, no errors were thrown
    });
  });

  describe('cross-browser compatibility edge cases', () => {
    it('handles missing or altered timer functions gracefully', () => {
      // Temporarily mock interval functions to simulate browser issues
      const originalSetInterval = global.setInterval;
      const originalClearInterval = global.clearInterval;

      // Mock potentially problematic setInterval behavior
      global.setInterval = vi.fn((callback, delay) => {
        return originalSetInterval(callback, Math.max(delay, 1)); // Ensure minimum delay
      });

      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isAnimating).toBe(true);

      // Restore original functions
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    });

    it('handles mathematical edge cases in frame calculations', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      // Test at mathematical boundary points
      const boundaryPoints = [0, 0.25, 0.3, 0.5, 0.7, 0.75, 1.0];

      for (const point of boundaryPoints) {
        act(() => {
          vi.advanceTimersByTime(2000 * point);
        });

        // Should not produce NaN or invalid values
        expect(isNaN(result.current.arrowAnimationFrame)).toBe(false);
        expect(isNaN(result.current.iconFrame)).toBe(false);
        expect(isNaN(result.current.colorIntensity)).toBe(false);
        expect(isFinite(result.current.arrowAnimationFrame)).toBe(true);
        expect(isFinite(result.current.iconFrame)).toBe(true);
        expect(isFinite(result.current.colorIntensity)).toBe(true);
      }
    });
  });

  describe('concurrent animation handling', () => {
    it('handles multiple hook instances without interference', () => {
      // Create two separate hook instances
      const hook1 = renderHook(
        ({ agent }) => useAgentHandoff(agent, { arrowStyle: 'enhanced' }),
        { initialProps: { agent: 'agent1' as string | undefined } }
      );

      const hook2 = renderHook(
        ({ agent }) => useAgentHandoff(agent, { arrowStyle: 'basic' }),
        { initialProps: { agent: 'agent2' as string | undefined } }
      );

      // Start animations on both
      hook1.rerender({ agent: 'new-agent1' });
      hook2.rerender({ agent: 'new-agent2' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Both should animate independently
      expect(hook1.result.current.isAnimating).toBe(true);
      expect(hook2.result.current.isAnimating).toBe(true);

      // They should have different arrow frame limits due to different styles
      expect(hook1.result.current.arrowAnimationFrame).toBeLessThanOrEqual(7); // Enhanced
      expect(hook2.result.current.arrowAnimationFrame).toBeLessThanOrEqual(2); // Basic

      // Clean up both
      hook1.unmount();
      hook2.unmount();
    });
  });
});