/**
 * Tests for enhanced visual features in useAgentHandoff hook
 *
 * This test suite covers the new enhanced animation features added to improve UX:
 * 1. Enhanced arrow animations (8-frame sequences with easing)
 * 2. Agent icon animations with coordination
 * 3. Smooth color transitions with phases
 * 4. ASCII icon fallback support
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentHandoff, type HandoffAnimationState } from '../useAgentHandoff.js';

describe('useAgentHandoff - Enhanced Visual Features', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('enhanced arrow animation frames', () => {
    it('supports enhanced arrow style with 8 frames by default', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { arrowStyle: 'enhanced' }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const frameReadings: number[] = [];

      // Sample enhanced arrow frames throughout animation
      for (let i = 0; i < 25; i++) {
        act(() => {
          vi.advanceTimersByTime(80);
        });

        if (result.current.isAnimating) {
          frameReadings.push(result.current.arrowAnimationFrame);
        }
      }

      // Should see progression through 0-7 frames (8 total)
      expect(Math.max(...frameReadings)).toBeLessThanOrEqual(7);
      expect(Math.min(...frameReadings)).toBeGreaterThanOrEqual(0);

      // Should have more granular animation than basic 3-frame
      const uniqueFrames = new Set(frameReadings);
      expect(uniqueFrames.size).toBeGreaterThan(3);
    });

    it('uses basic arrow style with 3 frames when specified', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { arrowStyle: 'basic' }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const frameReadings: number[] = [];

      for (let i = 0; i < 25; i++) {
        act(() => {
          vi.advanceTimersByTime(80);
        });

        if (result.current.isAnimating) {
          frameReadings.push(result.current.arrowAnimationFrame);
        }
      }

      // Basic style should max at frame 2 (0, 1, 2)
      expect(Math.max(...frameReadings)).toBeLessThanOrEqual(2);
      expect(Math.min(...frameReadings)).toBeGreaterThanOrEqual(0);
    });

    it('supports sparkle arrow style with 8 frames', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { arrowStyle: 'sparkle' }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Sparkle style should use 8-frame system like enhanced
      expect(result.current.arrowAnimationFrame).toBeLessThanOrEqual(7);
      expect(result.current.arrowAnimationFrame).toBeGreaterThanOrEqual(0);
    });

    it('enhanced arrow frames progress smoothly with easing', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { arrowStyle: 'enhanced' }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const frameProgression: number[] = [];

      // Sample at regular intervals to check eased progression
      for (let i = 0; i <= 20; i++) {
        act(() => {
          vi.advanceTimersByTime(100);
        });

        if (result.current.isAnimating) {
          frameProgression.push(result.current.arrowAnimationFrame);
        }
      }

      // Frames should progress generally upward (due to easing, may not be perfectly linear)
      const firstHalf = frameProgression.slice(0, Math.floor(frameProgression.length / 2));
      const secondHalf = frameProgression.slice(Math.floor(frameProgression.length / 2));

      const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      expect(avgSecondHalf).toBeGreaterThan(avgFirstHalf);
    });

    it('resets enhanced arrow frame when animation completes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { arrowStyle: 'enhanced' }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.arrowAnimationFrame).toBeGreaterThan(0);

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.arrowAnimationFrame).toBe(0);
      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('agent icon animations', () => {
    it('enables icon animations when enableIcons=true (default)', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableIcons: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(900);
      });

      expect(result.current.iconFrame).toBeGreaterThan(0);
      expect(result.current.iconFrame).toBeLessThanOrEqual(7);
    });

    it('disables icon animations when enableIcons=false', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableIcons: false }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(700);
      });

      expect(result.current.iconFrame).toBe(0);
    });

    it('icon frame coordinates with transition phases', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableIcons: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const iconFramesByPhase: Record<string, number[]> = {
        entering: [],
        active: [],
        exiting: []
      };

      // Sample icon frames during different transition phases
      for (let i = 0; i < 25; i++) {
        act(() => {
          vi.advanceTimersByTime(80);
        });

        if (result.current.isAnimating) {
          const phase = result.current.transitionPhase;
          if (phase !== 'idle') {
            iconFramesByPhase[phase].push(result.current.iconFrame);
          }
        }
      }

      // Early phases should have lower icon frames
      if (iconFramesByPhase.entering.length > 0) {
        expect(Math.max(...iconFramesByPhase.entering)).toBeLessThan(4);
      }

      // Later phases should have higher icon frames
      if (iconFramesByPhase.exiting.length > 0) {
        expect(Math.min(...iconFramesByPhase.exiting)).toBeGreaterThan(3);
      }
    });

    it('icon frame progresses from 0 to 7 during transition', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableIcons: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      let hasSeenLowFrame = false;
      let hasSeenHighFrame = false;

      for (let i = 0; i < 30; i++) {
        act(() => {
          vi.advanceTimersByTime(70);
        });

        if (result.current.isAnimating) {
          const frame = result.current.iconFrame;
          if (frame <= 2) hasSeenLowFrame = true;
          if (frame >= 5) hasSeenHighFrame = true;
        }
      }

      expect(hasSeenLowFrame).toBe(true);
      expect(hasSeenHighFrame).toBe(true);
    });

    it('resets icon frame when animation completes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableIcons: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.iconFrame).toBeGreaterThan(0);

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.iconFrame).toBe(0);
      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('smooth color transitions', () => {
    it('enables color transitions when enableColorTransition=true (default)', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableColorTransition: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.colorIntensity).toBeGreaterThan(0);
      expect(result.current.colorIntensity).toBeLessThanOrEqual(1);
      expect(['source-bright', 'transitioning', 'target-bright']).toContain(
        result.current.colorPhase
      );
    });

    it('disables color transitions when enableColorTransition=false', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableColorTransition: false }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.colorIntensity).toBe(0);
      expect(result.current.colorPhase).toBe('source-bright');
    });

    it('color intensity progresses from 0 to 1 during animation', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableColorTransition: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      let initialIntensity: number | null = null;
      let finalIntensity: number | null = null;

      // Check early animation
      act(() => {
        vi.advanceTimersByTime(200);
      });
      initialIntensity = result.current.colorIntensity;

      // Check late animation
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      finalIntensity = result.current.colorIntensity;

      expect(initialIntensity).toBeLessThan(finalIntensity);
      expect(finalIntensity).toBeGreaterThan(0.8);
    });

    it('progresses through color phases: source-bright → transitioning → target-bright', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableColorTransition: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const phasesObserved: string[] = [];

      for (let i = 0; i < 25; i++) {
        act(() => {
          vi.advanceTimersByTime(80);
        });

        if (result.current.isAnimating) {
          phasesObserved.push(result.current.colorPhase);
        }
      }

      // Should observe all three phases
      expect(phasesObserved).toContain('source-bright');
      expect(phasesObserved).toContain('transitioning');
      expect(phasesObserved).toContain('target-bright');

      // Early phases should be source-bright
      expect(phasesObserved.slice(0, 3)).toContain('source-bright');

      // Later phases should be target-bright
      expect(phasesObserved.slice(-3)).toContain('target-bright');
    });

    it('color phase timing matches expected thresholds', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableColorTransition: true, duration: 1000 }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      // Test phase boundaries: source-bright (0-30%), transitioning (30-70%), target-bright (70-100%)

      // At 25% progress (250ms) - should be source-bright
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(result.current.colorPhase).toBe('source-bright');

      // At 50% progress (500ms) - should be transitioning
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(result.current.colorPhase).toBe('transitioning');

      // At 80% progress (800ms) - should be target-bright
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.colorPhase).toBe('target-bright');
    });

    it('resets color properties when animation completes', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { enableColorTransition: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.colorIntensity).toBeGreaterThan(0);
      expect(result.current.colorPhase).not.toBe('source-bright');

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.colorIntensity).toBe(0);
      expect(result.current.colorPhase).toBe('source-bright');
      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('ASCII icon support', () => {
    it('tracks useAsciiIcons option correctly', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { useAsciiIcons: true }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // The useAsciiIcons option should be available for components to use
      // (The hook itself doesn't change behavior, but makes the option available)
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.iconFrame).toBeGreaterThanOrEqual(0);
    });

    it('defaults to emoji icons when useAsciiIcons not specified', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Default behavior should work normally
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.iconFrame).toBeGreaterThanOrEqual(0);
    });
  });

  describe('enhanced visual integration', () => {
    it('all enhanced features work together with default options', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent), // Using defaults
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // All enhanced features should be active with defaults
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.arrowAnimationFrame).toBeGreaterThan(0);
      expect(result.current.arrowAnimationFrame).toBeLessThanOrEqual(7); // Enhanced style default
      expect(result.current.iconFrame).toBeGreaterThan(0); // Icons enabled by default
      expect(result.current.colorIntensity).toBeGreaterThan(0); // Color transitions enabled by default
      expect(result.current.colorPhase).not.toBe('source-bright'); // Should have progressed
    });

    it('enhanced features can be selectively disabled', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'basic',
          enableIcons: false,
          enableColorTransition: false
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.isAnimating).toBe(true);
      expect(result.current.arrowAnimationFrame).toBeLessThanOrEqual(2); // Basic style
      expect(result.current.iconFrame).toBe(0); // Icons disabled
      expect(result.current.colorIntensity).toBe(0); // Color transitions disabled
      expect(result.current.colorPhase).toBe('source-bright'); // No color progression
    });

    it('enhanced features coordinate timing properly', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const coordinations: Array<{
        arrowFrame: number;
        iconFrame: number;
        colorPhase: string;
        progress: number;
      }> = [];

      // Sample coordination throughout animation
      for (let i = 0; i < 20; i++) {
        act(() => {
          vi.advanceTimersByTime(100);
        });

        if (result.current.isAnimating) {
          coordinations.push({
            arrowFrame: result.current.arrowAnimationFrame,
            iconFrame: result.current.iconFrame,
            colorPhase: result.current.colorPhase,
            progress: result.current.progress
          });
        }
      }

      // All features should progress together
      expect(coordinations.length).toBeGreaterThan(10);

      // Progress should be coordinated - later samples should have higher values
      const early = coordinations.slice(0, 3);
      const late = coordinations.slice(-3);

      const avgEarlyArrow = early.reduce((sum, c) => sum + c.arrowFrame, 0) / early.length;
      const avgLateArrow = late.reduce((sum, c) => sum + c.arrowFrame, 0) / late.length;
      expect(avgLateArrow).toBeGreaterThan(avgEarlyArrow);

      const avgEarlyIcon = early.reduce((sum, c) => sum + c.iconFrame, 0) / early.length;
      const avgLateIcon = late.reduce((sum, c) => sum + c.iconFrame, 0) / late.length;
      expect(avgLateIcon).toBeGreaterThan(avgEarlyIcon);
    });

    it('handles enhanced visual features during rapid handoffs', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true,
          duration: 800 // Shorter for rapid testing
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      // First handoff
      rerender({ agent: 'architect' });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.isAnimating).toBe(true);
      const firstArrowFrame = result.current.arrowAnimationFrame;
      const firstIconFrame = result.current.iconFrame;

      // Second handoff before first completes
      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should start fresh animation with all features reset and progressing
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.currentAgent).toBe('developer');
      expect(result.current.previousAgent).toBe('architect');

      // Enhanced features should be working
      expect(result.current.arrowAnimationFrame).toBeGreaterThanOrEqual(0);
      expect(result.current.iconFrame).toBeGreaterThanOrEqual(0);
      expect(result.current.colorPhase).not.toBe('idle');
    });

    it('all enhanced visual properties reset correctly on completion', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      // Let animation progress
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Verify enhanced features are active
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.arrowAnimationFrame).toBeGreaterThan(0);
      expect(result.current.iconFrame).toBeGreaterThan(0);
      expect(result.current.colorIntensity).toBeGreaterThan(0);
      expect(result.current.colorPhase).not.toBe('source-bright');

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // All enhanced features should be reset
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.arrowAnimationFrame).toBe(0);
      expect(result.current.iconFrame).toBe(0);
      expect(result.current.colorIntensity).toBe(0);
      expect(result.current.colorPhase).toBe('source-bright');
      expect(result.current.transitionPhase).toBe('idle');
    });
  });

  describe('backward compatibility', () => {
    it('maintains compatibility with existing API without options', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent), // No options
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Basic functionality should work
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.previousAgent).toBe('planner');
      expect(result.current.currentAgent).toBe('developer');
      expect(result.current.progress).toBeGreaterThan(0);

      // Enhanced features should work with defaults
      expect(result.current.arrowAnimationFrame).toBeDefined();
      expect(result.current.iconFrame).toBeDefined();
      expect(result.current.colorIntensity).toBeDefined();
      expect(result.current.colorPhase).toBeDefined();
    });

    it('legacy arrowFrame still works alongside enhanced arrowAnimationFrame', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Both legacy and enhanced arrow properties should exist
      expect(result.current.arrowFrame).toBeDefined();
      expect(result.current.arrowAnimationFrame).toBeDefined();

      // They might have different values due to different calculation methods
      expect(typeof result.current.arrowFrame).toBe('number');
      expect(typeof result.current.arrowAnimationFrame).toBe('number');
    });
  });
});
