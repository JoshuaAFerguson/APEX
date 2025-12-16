/**
 * Integration tests for enhanced useAgentHandoff hook
 *
 * Tests integration between the hook and actual visual components,
 * ensuring the enhanced animation features provide the expected
 * visual feedback and coordinate properly with UI rendering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentHandoff, formatHandoffElapsed } from '../useAgentHandoff.js';

describe('useAgentHandoff - Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('visual component integration', () => {
    it('provides all data needed for enhanced HandoffIndicator component', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true,
          useAsciiIcons: false
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const state = result.current;

      // Essential animation state
      expect(state.isAnimating).toBe(true);
      expect(state.previousAgent).toBe('planner');
      expect(state.currentAgent).toBe('developer');
      expect(state.progress).toBeGreaterThan(0);
      expect(state.isFading).toBe(false);

      // Enhanced visual properties for component rendering
      expect(typeof state.arrowAnimationFrame).toBe('number');
      expect(typeof state.iconFrame).toBe('number');
      expect(typeof state.colorIntensity).toBe('number');
      expect(['source-bright', 'transitioning', 'target-bright']).toContain(state.colorPhase);

      // Timing information for progress indicators
      expect(state.handoffStartTime).toBeInstanceOf(Date);

      // Legacy compatibility
      expect(typeof state.arrowFrame).toBe('number');
      expect(typeof state.pulseIntensity).toBe('number');
      expect(['entering', 'active', 'exiting', 'idle']).toContain(state.transitionPhase);
    });

    it('provides smooth arrow animation sequence for visual rendering', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, { arrowStyle: 'enhanced' }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const arrowSequence: number[] = [];

      // Collect arrow frames for component rendering
      for (let i = 0; i < 30; i++) {
        act(() => {
          vi.advanceTimersByTime(70);
        });

        if (result.current.isAnimating) {
          arrowSequence.push(result.current.arrowAnimationFrame);
        }
      }

      // Sequence should be smooth for visual rendering
      expect(arrowSequence.length).toBeGreaterThan(15);

      // Should show progression suitable for smooth animation
      const uniqueFrames = new Set(arrowSequence);
      expect(uniqueFrames.size).toBeGreaterThanOrEqual(4); // Multiple distinct frames

      // All frames should be within valid range for component rendering
      arrowSequence.forEach(frame => {
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThanOrEqual(7);
      });
    });

    it('coordinates icon and color transitions for synchronized visuals', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          enableIcons: true,
          enableColorTransition: true
        }),
        { initialProps: { agent: 'architect' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      const coordinationData: Array<{
        iconFrame: number;
        colorPhase: string;
        colorIntensity: number;
        progress: number;
      }> = [];

      // Collect coordination data for synchronized rendering
      for (let i = 0; i < 25; i++) {
        act(() => {
          vi.advanceTimersByTime(80);
        });

        if (result.current.isAnimating) {
          coordinationData.push({
            iconFrame: result.current.iconFrame,
            colorPhase: result.current.colorPhase,
            colorIntensity: result.current.colorIntensity,
            progress: result.current.progress
          });
        }
      }

      // Should have coordination data for rendering
      expect(coordinationData.length).toBeGreaterThan(15);

      // Test early-stage coordination (source emphasis)
      const earlyStage = coordinationData.slice(0, 5);
      earlyStage.forEach(data => {
        expect(data.iconFrame).toBeLessThan(4); // Icon should favor source
        expect(data.colorIntensity).toBeLessThan(0.5); // Color should favor source
      });

      // Test late-stage coordination (target emphasis)
      const lateStage = coordinationData.slice(-5);
      lateStage.forEach(data => {
        expect(data.iconFrame).toBeGreaterThan(3); // Icon should favor target
        expect(data.colorIntensity).toBeGreaterThan(0.5); // Color should favor target
      });
    });

    it('provides proper elapsed time formatting for progress display', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'tester' });

      act(() => {
        vi.advanceTimersByTime(750);
      });

      const startTime = result.current.handoffStartTime!;
      expect(startTime).toBeInstanceOf(Date);

      // Test formatting at different elapsed times
      const currentTime = new Date(startTime.getTime() + 750);
      const elapsedText = formatHandoffElapsed(startTime, currentTime);

      expect(elapsedText).toBe('0.8s'); // Should round 0.75s to 0.8s
      expect(elapsedText).toMatch(/^\d+\.\d+s$/); // Should match pattern for display
    });

    it('handles rapid agent changes smoothly for UI responsiveness', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true,
          duration: 800 // Shorter for responsiveness testing
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      const agents = ['architect', 'developer', 'tester', 'reviewer'];
      const transitionStates: Array<{
        from: string;
        to: string;
        visualState: {
          arrowFrame: number;
          iconFrame: number;
          colorPhase: string;
        };
      }> = [];

      // Simulate rapid agent changes
      for (let i = 0; i < agents.length; i++) {
        rerender({ agent: agents[i] });

        act(() => {
          vi.advanceTimersByTime(200); // Rapid transitions
        });

        if (result.current.isAnimating) {
          transitionStates.push({
            from: result.current.previousAgent!,
            to: result.current.currentAgent!,
            visualState: {
              arrowFrame: result.current.arrowAnimationFrame,
              iconFrame: result.current.iconFrame,
              colorPhase: result.current.colorPhase,
            }
          });
        }
      }

      // Should handle rapid changes without visual artifacts
      expect(transitionStates.length).toBeGreaterThan(2);

      transitionStates.forEach(state => {
        // All visual properties should be valid
        expect(state.visualState.arrowFrame).toBeGreaterThanOrEqual(0);
        expect(state.visualState.iconFrame).toBeGreaterThanOrEqual(0);
        expect(['source-bright', 'transitioning', 'target-bright']).toContain(state.visualState.colorPhase);
      });
    });
  });

  describe('accessibility and fallback integration', () => {
    it('supports ASCII icon mode for terminal compatibility', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          enableIcons: true,
          useAsciiIcons: true // Terminal-compatible mode
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Icon frame should still work for ASCII rendering
      expect(result.current.iconFrame).toBeGreaterThan(0);
      expect(result.current.iconFrame).toBeLessThanOrEqual(7);

      // Animation state should be normal
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.currentAgent).toBe('developer');
    });

    it('gracefully degrades when enhanced features are disabled', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'basic',
          enableIcons: false,
          enableColorTransition: false,
          enablePulse: false
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should still provide core animation
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.previousAgent).toBe('planner');
      expect(result.current.currentAgent).toBe('developer');
      expect(result.current.progress).toBeGreaterThan(0);

      // Enhanced features should be disabled/minimal
      expect(result.current.arrowAnimationFrame).toBeLessThanOrEqual(2); // Basic style
      expect(result.current.iconFrame).toBe(0); // Disabled
      expect(result.current.colorIntensity).toBe(0); // Disabled
      expect(result.current.colorPhase).toBe('source-bright'); // No progression
      expect(result.current.pulseIntensity).toBe(0); // Disabled
    });

    it('maintains performance with enhanced features enabled', () => {
      const startTime = performance.now();

      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true,
          frameRate: 60 // High frame rate for performance test
        }),
        { initialProps: { agent: 'planner' as string | undefined } }
      );

      rerender({ agent: 'developer' });

      // Run extensive animation to test performance
      for (let i = 0; i < 100; i++) {
        act(() => {
          vi.advanceTimersByTime(20);
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete without significant performance impact
      expect(duration).toBeLessThan(1000); // Should be well under 1 second
      expect(result.current.isAnimating).toBe(true);
    });
  });

  describe('real-world usage patterns', () => {
    it('handles typical agent workflow progression', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true
        }),
        { initialProps: { agent: undefined } }
      );

      // Simulate typical workflow: undefined → planner → architect → developer → tester
      const workflow = [undefined, 'planner', 'architect', 'developer', 'tester'];
      const transitionData: Array<{
        transition: string;
        peakArrowFrame: number;
        peakIconFrame: number;
        finalColorPhase: string;
      }> = [];

      for (let i = 1; i < workflow.length; i++) {
        rerender({ agent: workflow[i] });

        let peakArrowFrame = 0;
        let peakIconFrame = 0;
        let finalColorPhase = 'source-bright';

        // Let transition complete
        for (let frame = 0; frame < 25; frame++) {
          act(() => {
            vi.advanceTimersByTime(80);
          });

          if (result.current.isAnimating) {
            peakArrowFrame = Math.max(peakArrowFrame, result.current.arrowAnimationFrame);
            peakIconFrame = Math.max(peakIconFrame, result.current.iconFrame);
            finalColorPhase = result.current.colorPhase;
          }
        }

        // Should have meaningful transition data only for valid handoffs
        if (workflow[i - 1] && workflow[i]) {
          transitionData.push({
            transition: `${workflow[i - 1]} → ${workflow[i]}`,
            peakArrowFrame,
            peakIconFrame,
            finalColorPhase
          });

          expect(peakArrowFrame).toBeGreaterThan(0);
          expect(peakIconFrame).toBeGreaterThan(0);
        }
      }

      // Should have recorded meaningful transitions
      expect(transitionData.length).toBe(3); // planner→architect, architect→developer, developer→tester

      transitionData.forEach(transition => {
        expect(transition.peakArrowFrame).toBeGreaterThan(3); // Should show significant progression
        expect(transition.peakIconFrame).toBeGreaterThan(3); // Should show significant progression
      });
    });

    it('supports custom timing configurations for different use cases', () => {
      // Test quick transitions (for responsive UIs)
      const quickHook = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          duration: 500,
          fadeDuration: 100,
          frameRate: 60,
          arrowStyle: 'enhanced'
        }),
        { initialProps: { agent: 'agent1' as string | undefined } }
      );

      quickHook.rerender({ agent: 'agent2' });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(quickHook.result.current.progress).toBeCloseTo(0.5, 1);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(quickHook.result.current.isAnimating).toBe(false);

      // Test slow transitions (for prominent handoffs)
      const slowHook = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          duration: 4000,
          fadeDuration: 1000,
          frameRate: 30,
          arrowStyle: 'enhanced',
          pulseFrequency: 8
        }),
        { initialProps: { agent: 'agent1' as string | undefined } }
      );

      slowHook.rerender({ agent: 'agent2' });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(slowHook.result.current.progress).toBeCloseTo(0.5, 1);
      expect(slowHook.result.current.isAnimating).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(slowHook.result.current.isAnimating).toBe(false);

      // Clean up
      quickHook.unmount();
      slowHook.unmount();
    });

    it('maintains consistent visual feedback across multiple handoffs', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          arrowStyle: 'enhanced',
          enableIcons: true,
          enableColorTransition: true
        }),
        { initialProps: { agent: 'initial' as string | undefined } }
      );

      const handoffResults: Array<{
        from: string;
        to: string;
        maxArrow: number;
        maxIcon: number;
        completedColorTransition: boolean;
      }> = [];

      const agents = ['planner', 'architect', 'developer', 'tester', 'reviewer'];

      for (const agent of agents) {
        rerender({ agent });

        let maxArrow = 0;
        let maxIcon = 0;
        let completedColorTransition = false;

        // Let handoff complete
        for (let i = 0; i < 30; i++) {
          act(() => {
            vi.advanceTimersByTime(70);
          });

          if (result.current.isAnimating) {
            maxArrow = Math.max(maxArrow, result.current.arrowAnimationFrame);
            maxIcon = Math.max(maxIcon, result.current.iconFrame);
            if (result.current.colorPhase === 'target-bright') {
              completedColorTransition = true;
            }
          }
        }

        if (result.current.currentAgent) {
          handoffResults.push({
            from: result.current.previousAgent || 'initial',
            to: result.current.currentAgent,
            maxArrow,
            maxIcon,
            completedColorTransition
          });
        }
      }

      // All handoffs should show consistent visual progression
      expect(handoffResults.length).toBeGreaterThan(3);

      handoffResults.forEach(handoff => {
        expect(handoff.maxArrow).toBeGreaterThan(3); // Significant arrow progression
        expect(handoff.maxIcon).toBeGreaterThan(3); // Significant icon progression
        expect(handoff.completedColorTransition).toBe(true); // Full color transition
      });

      // Consistency check - all handoffs should have similar peak values
      const arrowValues = handoffResults.map(h => h.maxArrow);
      const iconValues = handoffResults.map(h => h.maxIcon);

      const arrowVariance = Math.max(...arrowValues) - Math.min(...arrowValues);
      const iconVariance = Math.max(...iconValues) - Math.min(...iconValues);

      expect(arrowVariance).toBeLessThan(3); // Should be reasonably consistent
      expect(iconVariance).toBeLessThan(3); // Should be reasonably consistent
    });
  });
});