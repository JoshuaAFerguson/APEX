/**
 * Terminal compatibility and integration tests for HandoffIndicator
 * Tests real-world scenarios and terminal-specific behaviors
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { HandoffIndicator } from '../HandoffIndicator';
import type { HandoffAnimationState } from '../../../hooks/useAgentHandoff.js';

describe('HandoffIndicator Terminal Integration', () => {
  const mockAgentColors = {
    planner: 'magenta',
    architect: 'blue',
    developer: 'green',
    reviewer: 'yellow',
    tester: 'cyan',
    devops: 'red',
  };

  const createAnimationState = (
    overrides: Partial<HandoffAnimationState> = {}
  ): HandoffAnimationState => ({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('real-world workflow scenarios', () => {
    it('handles typical workflow progression animation', () => {
      const workflowSteps = [
        { prev: 'planner', curr: 'architect' },
        { prev: 'architect', curr: 'developer' },
        { prev: 'developer', curr: 'tester' },
        { prev: 'tester', curr: 'reviewer' },
        { prev: 'reviewer', curr: 'devops' },
      ];

      workflowSteps.forEach(({ prev, curr }, index) => {
        const animationState = createAnimationState({
          isAnimating: true,
          previousAgent: prev,
          currentAgent: curr,
          progress: 0.3,
        });

        const { rerender } = render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText(prev)).toBeInTheDocument();
        expect(screen.getByText(curr)).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();

        // Cleanup for next iteration
        if (index < workflowSteps.length - 1) {
          rerender(
            <HandoffIndicator
              animationState={createAnimationState({ isAnimating: false })}
              agentColors={mockAgentColors}
            />
          );
        }
      });
    });

    it('handles parallel execution transitions', () => {
      // Transition from single agent to parallel execution
      const singleToParallel = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer', // One of multiple parallel agents
        progress: 0.4,
      });

      const { rerender } = render(
        <HandoffIndicator
          animationState={singleToParallel}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Transition back from parallel to single
      const parallelToSingle = createAnimationState({
        isAnimating: true,
        previousAgent: 'tester', // One of the parallel agents
        currentAgent: 'reviewer',
        progress: 0.6,
      });

      rerender(
        <HandoffIndicator
          animationState={parallelToSingle}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('handles error recovery scenarios', () => {
      // Agent fails and transitions to error recovery agent
      const errorRecovery = createAnimationState({
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'error-recovery-agent',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={errorRecovery}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('error-recovery-agent')).toBeInTheDocument();
    });
  });

  describe('terminal display compatibility', () => {
    it('renders properly in both compact and full modes for status bar integration', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
      });

      // Test compact mode (for status bar)
      const { rerender } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      // Compact mode should show basic transition without decorative elements
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.queryByText('Handoff:')).not.toBeInTheDocument();

      // Test full mode (for main panel)
      rerender(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Full mode should show all decorative elements
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('handles unicode characters and emojis correctly', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'плановщик', // Cyrillic characters
        currentAgent: '開発者', // Japanese characters
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('плановщик')).toBeInTheDocument();
      expect(screen.getByText('開発者')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('maintains layout stability with varying agent name lengths', () => {
      const testCases = [
        { prev: 'a', curr: 'b' }, // Very short names
        { prev: 'planner', curr: 'dev' }, // Mixed lengths
        { prev: 'very-long-agent-name', curr: 'short' }, // Very different lengths
        { prev: 'architect-with-long-descriptive-name', curr: 'another-extremely-long-name' }, // Both long
      ];

      testCases.forEach(({ prev, curr }, index) => {
        const animationState = createAnimationState({
          isAnimating: true,
          previousAgent: prev,
          currentAgent: curr,
          progress: 0.4,
        });

        const { container, rerender } = render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText(prev)).toBeInTheDocument();
        expect(screen.getByText(curr)).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();

        // Layout should be stable regardless of name lengths
        expect(container.firstChild).toBeTruthy();

        if (index < testCases.length - 1) {
          rerender(
            <HandoffIndicator
              animationState={createAnimationState({ isAnimating: false })}
              agentColors={mockAgentColors}
            />
          );
        }
      });
    });
  });

  describe('animation timing integration', () => {
    it('properly displays throughout complete animation cycle', () => {
      // Test at key animation phases
      const animationPhases = [
        { progress: 0, isFading: false, description: 'start' },
        { progress: 0.25, isFading: false, description: 'quarter' },
        { progress: 0.5, isFading: false, description: 'half' },
        { progress: 0.74, isFading: false, description: 'before fade' },
        { progress: 0.75, isFading: true, description: 'fade threshold' },
        { progress: 0.9, isFading: true, description: 'mid fade' },
        { progress: 1.0, isFading: true, description: 'end' },
      ];

      animationPhases.forEach(({ progress, isFading, description }) => {
        const animationState = createAnimationState({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress,
          isFading,
        });

        const { rerender } = render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
          />
        );

        // Should display consistently throughout animation
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();

        // Clean up for next phase
        rerender(
          <HandoffIndicator
            animationState={createAnimationState({ isAnimating: false })}
            agentColors={mockAgentColors}
          />
        );
      });
    });

    it('handles animation state transitions smoothly', () => {
      const { rerender } = render(
        <HandoffIndicator
          animationState={createAnimationState({ isAnimating: false })}
          agentColors={mockAgentColors}
        />
      );

      // Start with no animation
      expect(screen.queryByText('planner')).not.toBeInTheDocument();

      // Begin animation
      rerender(
        <HandoffIndicator
          animationState={createAnimationState({
            isAnimating: true,
            previousAgent: 'planner',
            currentAgent: 'developer',
            progress: 0,
          })}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Mid animation
      rerender(
        <HandoffIndicator
          animationState={createAnimationState({
            isAnimating: true,
            previousAgent: 'planner',
            currentAgent: 'developer',
            progress: 0.5,
          })}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // End animation
      rerender(
        <HandoffIndicator
          animationState={createAnimationState({ isAnimating: false })}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.queryByText('planner')).not.toBeInTheDocument();
      expect(screen.queryByText('developer')).not.toBeInTheDocument();
    });
  });

  describe('integration with different color schemes', () => {
    it('works with custom color schemes', () => {
      const customColors = {
        'custom-agent-1': '#FF6B6B',
        'custom-agent-2': '#4ECDC4',
        'custom-agent-3': '#45B7D1',
      };

      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'custom-agent-1',
        currentAgent: 'custom-agent-2',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={customColors}
        />
      );

      expect(screen.getByText('custom-agent-1')).toBeInTheDocument();
      expect(screen.getByText('custom-agent-2')).toBeInTheDocument();
    });

    it('works with minimal color scheme', () => {
      const minimalColors = {
        main: 'white',
      };

      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'main',
        currentAgent: 'unknown-agent',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={minimalColors}
        />
      );

      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('unknown-agent')).toBeInTheDocument();
    });

    it('works without any color scheme', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'agent1',
        currentAgent: 'agent2',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={{}}
        />
      );

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });
  });

  describe('performance with rapid updates', () => {
    it('handles frequent animation state updates without performance issues', () => {
      const { rerender } = render(
        <HandoffIndicator
          animationState={createAnimationState({ isAnimating: false })}
          agentColors={mockAgentColors}
        />
      );

      // Simulate rapid animation updates (like from real timer)
      for (let i = 0; i <= 100; i++) {
        const progress = i / 100;
        const isFading = progress > 0.75;

        rerender(
          <HandoffIndicator
            animationState={createAnimationState({
              isAnimating: true,
              previousAgent: 'planner',
              currentAgent: 'developer',
              progress,
              isFading,
            })}
            agentColors={mockAgentColors}
          />
        );
      }

      // Should still be rendering correctly after many updates
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles agent changes during animation without flickering', () => {
      const { rerender } = render(
        <HandoffIndicator
          animationState={createAnimationState({ isAnimating: false })}
          agentColors={mockAgentColors}
        />
      );

      // Start first animation
      rerender(
        <HandoffIndicator
          animationState={createAnimationState({
            isAnimating: true,
            previousAgent: 'planner',
            currentAgent: 'architect',
            progress: 0.3,
          })}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Interrupt with new animation
      rerender(
        <HandoffIndicator
          animationState={createAnimationState({
            isAnimating: true,
            previousAgent: 'architect',
            currentAgent: 'developer',
            progress: 0,
          })}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText('planner')).not.toBeInTheDocument();
    });
  });

  describe('accessibility in terminal environment', () => {
    it('maintains readability with screen reader compatible output', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // All text content should be accessible to screen readers
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('provides clear visual hierarchy in terminal output', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
      });

      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Should have clear structure for terminal display
      expect(container.firstChild).toBeTruthy();
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Clear visual indicator
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument(); // Clear context
      expect(screen.getByText('planner')).toBeInTheDocument(); // Source
      expect(screen.getByText('→')).toBeInTheDocument(); // Direction
      expect(screen.getByText('developer')).toBeInTheDocument(); // Target
    });
  });
});