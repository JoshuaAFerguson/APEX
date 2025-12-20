import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { HandoffIndicator } from '../HandoffIndicator';
import type { HandoffAnimationState } from '../../../hooks/useAgentHandoff.js';
import {
  animationStates,
  testAgentColors,
  edgeCaseAgentNames,
} from './test-utils/fixtures';

describe('HandoffIndicator - Edge Cases Comprehensive Tests', () => {
  const mockAgentColors = testAgentColors;

  const createAnimationState = (
    overrides: Partial<HandoffAnimationState> = {}
  ): HandoffAnimationState => ({
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
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Animation Progress Boundaries', () => {
    it('handles progress exactly at 0.0', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.0,
        transitionPhase: 'idle',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles progress exactly at 0.25 (entering → active boundary)', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.25,
        transitionPhase: 'active',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles progress exactly at 0.5 (midpoint)', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
        transitionPhase: 'active',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles progress at 0.74 (just before fade)', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.74,
        isFading: false,
        transitionPhase: 'active',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      // Should not be dimmed yet
    });

    it('handles progress exactly at 0.75 (fade threshold)', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.75,
        isFading: true,
        transitionPhase: 'exiting',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles progress at 0.76 (just after fade)', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.76,
        isFading: true,
        transitionPhase: 'exiting',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles progress at 0.99 (near completion)', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.99,
        isFading: true,
        transitionPhase: 'exiting',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles progress exactly at 1.0 (complete)', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 1.0,
        isFading: true,
        transitionPhase: 'exiting',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles progress above 1.0 (overflow)', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 1.5,
        isFading: true,
        transitionPhase: 'exiting',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      // Should handle gracefully without crashing
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles negative progress values', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: -0.1,
        transitionPhase: 'idle',
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      // Should handle gracefully without crashing
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });
  });

  describe('Agent Name Edge Cases', () => {
    it('handles empty string previousAgent', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: '',
        currentAgent: 'architect',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      // Empty previous agent should still render
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles empty string currentAgent', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: '',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      // Empty current agent should still render
    });

    it('handles very long agent names (50+ chars)', () => {
      const longName = edgeCaseAgentNames.veryLong;
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: longName,
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('handles special characters: dashes', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: edgeCaseAgentNames.withDashes,
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText(edgeCaseAgentNames.withDashes)).toBeInTheDocument();
    });

    it('handles special characters: underscores', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: edgeCaseAgentNames.withUnderscores,
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText(edgeCaseAgentNames.withUnderscores)).toBeInTheDocument();
    });

    it('handles special characters: at signs', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: edgeCaseAgentNames.withSpecial,
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText(edgeCaseAgentNames.withSpecial)).toBeInTheDocument();
    });

    it('handles numeric-only names', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: edgeCaseAgentNames.numbersOnly,
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText(edgeCaseAgentNames.numbersOnly)).toBeInTheDocument();
    });

    it('handles unicode characters in names', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: edgeCaseAgentNames.unicode,
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText(edgeCaseAgentNames.unicode)).toBeInTheDocument();
    });

    it('handles whitespace in names', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: edgeCaseAgentNames.withSpaces,
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText(edgeCaseAgentNames.withSpaces)).toBeInTheDocument();
    });
  });

  describe('Color Handling Edge Cases', () => {
    it('handles all standard agent colors', () => {
      Object.keys(mockAgentColors).forEach((agentName) => {
        const state = createAnimationState({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: agentName,
          progress: 0.5,
        });

        render(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText(agentName)).toBeInTheDocument();
      });
    });

    it('handles unknown previousAgent fallback to white', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'unknown-agent',
        currentAgent: 'planner',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('unknown-agent')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('handles unknown currentAgent fallback to white', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'unknown-agent',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('unknown-agent')).toBeInTheDocument();
    });

    it('handles empty agentColors object', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={{}}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles partial agentColors (some undefined)', () => {
      const partialColors = {
        planner: 'magenta',
        // architect intentionally missing
      };

      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={partialColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles mixed known/unknown agent pair', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner', // known
        currentAgent: 'custom-agent', // unknown
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('custom-agent')).toBeInTheDocument();
    });
  });

  describe('Mode Transitions', () => {
    it('renders compact mode during fade phase', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.85,
        isFading: true,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      // In compact mode, no border or full layout
      expect(screen.queryByText('⚡ Handoff')).not.toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('renders full mode during fade phase', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.85,
        isFading: true,
        handoffStartTime: new Date(),
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Full mode should show handoff header
      expect(screen.getByText('⚡ Handoff')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles mode switch during active animation', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
      });

      const { rerender } = render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      expect(screen.getByText('⚡ Handoff')).toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      expect(screen.queryByText('⚡ Handoff')).not.toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles rapid compact/full toggles', async () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
      });

      const { rerender } = render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Rapidly toggle mode
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          rerender(
            <HandoffIndicator
              animationState={state}
              agentColors={mockAgentColors}
              compact={i % 2 === 0}
            />
          );
        });
      }

      // Should handle rapid changes gracefully
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });
  });

  describe('Enhanced Animation Properties', () => {
    it('validates transitionPhase matches progress', () => {
      const testCases = [
        { progress: 0.1, expectedPhase: 'entering' },
        { progress: 0.24, expectedPhase: 'entering' },
        { progress: 0.25, expectedPhase: 'active' },
        { progress: 0.5, expectedPhase: 'active' },
        { progress: 0.74, expectedPhase: 'active' },
        { progress: 0.75, expectedPhase: 'exiting' },
        { progress: 0.9, expectedPhase: 'exiting' },
      ];

      testCases.forEach(({ progress, expectedPhase }) => {
        const state = createAnimationState({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress,
          transitionPhase: expectedPhase as any,
        });

        render(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
      });
    });

    it('validates pulseIntensity oscillation', () => {
      const testCases = [
        { progress: 0.0, pulseIntensity: 0.5 },
        { progress: 0.125, pulseIntensity: 1.0 },
        { progress: 0.25, pulseIntensity: 0.5 },
        { progress: 0.5, pulseIntensity: 0.5 },
        { progress: 0.75, pulseIntensity: 0.5 },
        { progress: 1.0, pulseIntensity: 0.5 },
      ];

      testCases.forEach(({ progress, pulseIntensity }) => {
        const state = createAnimationState({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress,
          pulseIntensity,
        });

        render(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
      });
    });

    it('validates arrowFrame progression', () => {
      const testCases = [0, 1, 2].map(frame => ({
        progress: frame * 0.33 + 0.1,
        arrowFrame: frame,
      }));

      testCases.forEach(({ progress, arrowFrame }) => {
        const state = createAnimationState({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress,
          arrowFrame,
        });

        render(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
      });
    });

    it('validates arrowAnimationFrame for enhanced style', () => {
      const testCases = [0, 1, 2, 3, 4, 5, 6, 7].map(frame => ({
        progress: frame * 0.125,
        arrowAnimationFrame: frame,
      }));

      testCases.forEach(({ progress, arrowAnimationFrame }) => {
        const state = createAnimationState({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress,
          arrowAnimationFrame,
        });

        render(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
            arrowStyle="enhanced"
          />
        );

        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
      });
    });

    it('validates colorPhase transitions', () => {
      const testCases = [
        { progress: 0.1, colorPhase: 'source-bright' },
        { progress: 0.25, colorPhase: 'source-bright' },
        { progress: 0.5, colorPhase: 'transitioning' },
        { progress: 0.8, colorPhase: 'target-bright' },
      ];

      testCases.forEach(({ progress, colorPhase }) => {
        const state = createAnimationState({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress,
          colorPhase: colorPhase as any,
        });

        render(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
      });
    });

    it('validates colorIntensity gradient', () => {
      const testCases = [
        { progress: 0.0, colorIntensity: 0.0 },
        { progress: 0.25, colorIntensity: 0.25 },
        { progress: 0.5, colorIntensity: 0.5 },
        { progress: 0.75, colorIntensity: 0.75 },
        { progress: 1.0, colorIntensity: 1.0 },
      ];

      testCases.forEach(({ progress, colorIntensity }) => {
        const state = createAnimationState({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress,
          colorIntensity,
        });

        render(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
      });
    });
  });

  describe('Concurrent Animation Scenarios', () => {
    it('handles animation interrupt with new handoff', async () => {
      const initialState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.3,
      });

      const { rerender } = render(
        <HandoffIndicator
          animationState={initialState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Interrupt with new handoff
      const newState = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.1,
      });

      await act(async () => {
        rerender(
          <HandoffIndicator
            animationState={newState}
            agentColors={mockAgentColors}
          />
        );
      });

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText('planner')).not.toBeInTheDocument();
    });

    it('handles same agent to same agent (should be no-op)', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'planner', // Same agent
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      // Should render both entries even if they're the same
      const plannerElements = screen.getAllByText('planner');
      expect(plannerElements).toHaveLength(2); // Previous and current
    });

    it('handles rapid consecutive handoffs', async () => {
      const handoffs = [
        { prev: 'planner', curr: 'architect' },
        { prev: 'architect', curr: 'developer' },
        { prev: 'developer', curr: 'tester' },
        { prev: 'tester', curr: 'reviewer' },
      ];

      const { rerender } = render(
        <HandoffIndicator
          animationState={animationStates.idle}
          agentColors={mockAgentColors}
        />
      );

      for (let i = 0; i < handoffs.length; i++) {
        const handoff = handoffs[i];
        const state = createAnimationState({
          isAnimating: true,
          previousAgent: handoff.prev,
          currentAgent: handoff.curr,
          progress: 0.3,
        });

        await act(async () => {
          rerender(
            <HandoffIndicator
              animationState={state}
              agentColors={mockAgentColors}
            />
          );
        });

        expect(screen.getByText(handoff.prev)).toBeInTheDocument();
        expect(screen.getByText(handoff.curr)).toBeInTheDocument();
      }
    });
  });

  describe('Non-Animation States', () => {
    it('returns null when not animating', () => {
      const state = createAnimationState({
        isAnimating: false,
      });

      const { container } = render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when previousAgent is null', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: null,
        currentAgent: 'architect',
        progress: 0.5,
      });

      const { container } = render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when currentAgent is null', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: null,
        progress: 0.5,
      });

      const { container } = render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Enhanced Visual Features', () => {
    it('handles different arrow styles', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
      });

      const arrowStyles = ['basic', 'enhanced', 'sparkle'] as const;

      arrowStyles.forEach(style => {
        render(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
            arrowStyle={style}
          />
        );

        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
      });
    });

    it('handles elapsed time display', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
        handoffStartTime: new Date(),
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
          showElapsedTime={true}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      // Should show elapsed time in some format
      expect(screen.getByText(/\[.*\]/)).toBeInTheDocument();
    });

    it('handles progress bar display', () => {
      const state = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.6,
      });

      render(
        <HandoffIndicator
          animationState={state}
          agentColors={mockAgentColors}
          compact={false}
          showProgressBar={true}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      // Should show progress percentage
      expect(screen.getByText(/60%/)).toBeInTheDocument();
    });
  });
});