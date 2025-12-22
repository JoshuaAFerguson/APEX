/**
 * Enhanced useAgentHandoff hook tests - testing new animation features
 *
 * Tests for:
 * 1. Elapsed time display during handoff with sub-second precision
 * 2. Visual pulse/highlight effect for new agent using sinusoidal intensity cycling
 * 3. Animated transition arrow that progresses from → to →→ to →→→
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentHandoff, formatHandoffElapsed, type HandoffAnimationState } from '../useAgentHandoff.js';

describe('useAgentHandoff - Enhanced Animation Features', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('elapsed time display', () => {
    it('tracks handoff start time when animation begins', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(50); // Advance slightly to start animation
      });

      expect(result.current.handoffStartTime).toBeInstanceOf(Date);
      expect(result.current.handoffStartTime?.getTime()).toBe(Date.now() - 50);
    });

    it('maintains handoff start time throughout animation', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      // Trigger handoff
      rerender({ agent: 'developer' });

      let initialStartTime: Date | null = null;

      act(() => {
        vi.advanceTimersByTime(100);
        initialStartTime = result.current.handoffStartTime;
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.handoffStartTime).toBe(initialStartTime);
      expect(result.current.isAnimating).toBe(true);
    });

    it('clears handoff start time when animation completes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.handoffStartTime).toBeTruthy();

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.handoffStartTime).toBe(null);
      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('formatHandoffElapsed utility', () => {
    it('formats elapsed time with sub-second precision', () => {
      const startTime = new Date('2024-01-01T12:00:00.000Z');

      // Test various durations
      expect(formatHandoffElapsed(startTime, new Date('2024-01-01T12:00:00.500Z'))).toBe('0.5s');
      expect(formatHandoffElapsed(startTime, new Date('2024-01-01T12:00:01.200Z'))).toBe('1.2s');
      expect(formatHandoffElapsed(startTime, new Date('2024-01-01T12:00:02.750Z'))).toBe('2.8s');
    });

    it('handles zero elapsed time', () => {
      const startTime = new Date('2024-01-01T12:00:00.000Z');
      expect(formatHandoffElapsed(startTime, startTime)).toBe('0.0s');
    });

    it('rounds to one decimal place', () => {
      const startTime = new Date('2024-01-01T12:00:00.000Z');

      // Test rounding behavior
      expect(formatHandoffElapsed(startTime, new Date('2024-01-01T12:00:00.123Z'))).toBe('0.1s');
      expect(formatHandoffElapsed(startTime, new Date('2024-01-01T12:00:00.456Z'))).toBe('0.5s');
      expect(formatHandoffElapsed(startTime, new Date('2024-01-01T12:00:00.789Z'))).toBe('0.8s');
    });

    it('uses current time when no endTime provided', () => {
      const startTime = new Date('2024-01-01T12:00:00.000Z');

      // Mock current time to be 1.5 seconds later
      vi.setSystemTime(new Date('2024-01-01T12:00:01.500Z'));

      expect(formatHandoffElapsed(startTime)).toBe('1.5s');
    });
  });

  describe('pulse intensity for visual highlight', () => {
    it('starts with initial pulse intensity when enablePulse=true', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enablePulse: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(50); // Small advance to start animation
      });

      expect(result.current.pulseIntensity).toBeGreaterThan(0);
      expect(result.current.pulseIntensity).toBeLessThanOrEqual(1);
    });

    it('pulse intensity oscillates during animation', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enablePulse: true, pulseFrequency: 4 }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const intensityReadings: number[] = [];

      // Sample pulse intensity at different points in animation
      for (let i = 0; i <= 10; i++) {
        act(() => {
          vi.advanceTimersByTime(200); // 200ms steps over 2s animation
        });

        if (result.current.isAnimating) {
          intensityReadings.push(result.current.pulseIntensity);
        }
      }

      // Should have varying intensities (oscillation)
      expect(intensityReadings.length).toBeGreaterThan(5);

      // Check for variation in values (not all the same)
      const uniqueValues = new Set(intensityReadings.map(v => Math.round(v * 10)));
      expect(uniqueValues.size).toBeGreaterThan(2);

      // All values should be between 0 and 1
      expect(Math.min(...intensityReadings)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...intensityReadings)).toBeLessThanOrEqual(1);
    });

    it('pulse intensity is 0 when enablePulse=false', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enablePulse: false }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.pulseIntensity).toBe(0);
    });

    it('pulse frequency affects oscillation rate', () => {
      // Test different frequencies
      const testFrequency = (frequency: number) => {
        const { result, rerender } = renderHook(
          ({ agent }) => useAgentHandoff(agent, { enablePulse: true, pulseFrequency: frequency }),
          { initialProps: { agent: 'planner' as string | undefined } }
        );

        rerender({ agent: 'developer' });

        const readings: number[] = [];

        // Sample at regular intervals
        for (let i = 0; i < 20; i++) {
          act(() => {
            vi.advanceTimersByTime(100);
          });
          if (result.current.isAnimating) {
            readings.push(result.current.pulseIntensity);
          }
        }

        return readings;
      };

      const lowFreqReadings = testFrequency(1);
      const highFreqReadings = testFrequency(8);

      const averageDelta = (values: number[]) => {
        if (values.length < 2) return 0;
        let total = 0;
        for (let i = 1; i < values.length; i++) {
          total += Math.abs(values[i] - values[i - 1]);
        }
        return total / (values.length - 1);
      };

      const lowFreqVariation = averageDelta(lowFreqReadings);
      const highFreqVariation = averageDelta(highFreqReadings);

      expect(highFreqVariation).toBeGreaterThan(lowFreqVariation);
    });

    it('resets pulse intensity when animation completes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enablePulse: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.pulseIntensity).toBeGreaterThan(0);

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.pulseIntensity).toBe(0);
      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('animated arrow progression', () => {
    it('starts with first arrow frame', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(result.current.arrowFrame).toBe(0);
    });

    it('progresses through arrow frames during animation', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const frameReadings: number[] = [];

      // Sample arrow frames throughout animation
      for (let i = 0; i < 20; i++) {
        act(() => {
          vi.advanceTimersByTime(100); // 100ms steps
        });

        if (result.current.isAnimating) {
          frameReadings.push(result.current.arrowFrame);
        }
      }

      // Should see progression from 0 to higher frames
      expect(frameReadings).toContain(0);
      expect(Math.max(...frameReadings)).toBeGreaterThan(0);
      expect(Math.max(...frameReadings)).toBeLessThanOrEqual(2);
    });

    it('arrow frame progresses in sequence (0, 1, 2)', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      let hasSeenFrame0 = false;
      let hasSeenFrame1 = false;
      let hasSeenFrame2 = false;

      // Sample throughout animation
      for (let i = 0; i < 25; i++) {
        act(() => {
          vi.advanceTimersByTime(80);
        });

        if (result.current.isAnimating) {
          const frame = result.current.arrowFrame;
          if (frame === 0) hasSeenFrame0 = true;
          if (frame === 1) hasSeenFrame1 = true;
          if (frame === 2) hasSeenFrame2 = true;
        }
      }

      expect(hasSeenFrame0).toBe(true);
      expect(hasSeenFrame1).toBe(true);
      expect(hasSeenFrame2).toBe(true);
    });

    it('resets arrow frame when animation completes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.arrowFrame).toBeGreaterThan(0);

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.arrowFrame).toBe(0);
      expect(result.current.isAnimating).toBe(false);
    });

    it('arrow frame never exceeds maximum value of 2', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const allFrames: number[] = [];

      // Sample throughout entire animation
      for (let i = 0; i < 30; i++) {
        act(() => {
          vi.advanceTimersByTime(70);
        });

        if (result.current.isAnimating) {
          allFrames.push(result.current.arrowFrame);
        }
      }

      expect(Math.max(...allFrames)).toBeLessThanOrEqual(2);
      expect(Math.min(...allFrames)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('transition phase tracking', () => {
    it('progresses through all transition phases', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const phases: string[] = [];

      // Sample phases throughout animation
      for (let i = 0; i < 25; i++) {
        act(() => {
          vi.advanceTimersByTime(80);
        });

        if (result.current.isAnimating) {
          phases.push(result.current.transitionPhase);
        }
      }

      // Should see progression through phases
      expect(phases).toContain('entering');
      expect(phases).toContain('active');
      expect(phases).toContain('exiting');
    });

    it('returns to idle phase when animation completes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.transitionPhase).not.toBe('idle');

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.transitionPhase).toBe('idle');
    });
  });

  describe('enhanced animation integration', () => {
    it('all enhanced features work together during single handoff', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          enablePulse: true,
          pulseFrequency: 4,
          duration: 2000
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(700);
      });

      // All enhanced features should be active mid-animation
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.handoffStartTime).toBeInstanceOf(Date);
      expect(result.current.pulseIntensity).toBeGreaterThan(0);
      expect(result.current.arrowFrame).toBeGreaterThan(0);
      expect(result.current.transitionPhase).not.toBe('idle');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Features should still be active late in animation
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.arrowFrame).toBeGreaterThan(0);

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // All should be reset
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.handoffStartTime).toBe(null);
      expect(result.current.pulseIntensity).toBe(0);
      expect(result.current.arrowFrame).toBe(0);
      expect(result.current.transitionPhase).toBe('idle');
    });

    it('handles multiple rapid handoffs with enhanced features', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          enablePulse: true,
          duration: 1000 // Shorter for rapid testing
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      // First handoff
      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.isAnimating).toBe(true);
      const firstStartTime = result.current.handoffStartTime;

      // Second handoff before first completes
      rerender({ agent: 'tester' });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should have new animation with new start time
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.currentAgent).toBe('tester');
      expect(result.current.previousAgent).toBe('developer');
      expect(result.current.handoffStartTime).not.toBe(firstStartTime);
    });
  });
});
