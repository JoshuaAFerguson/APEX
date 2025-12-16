/**
 * Edge case and stress tests for HandoffIndicator component
 * Tests unusual scenarios, error conditions, and boundary cases
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { HandoffIndicator } from '../HandoffIndicator';
import type { HandoffAnimationState } from '../../../hooks/useAgentHandoff.js';

describe('HandoffIndicator Edge Cases', () => {
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

  const mockAgentColors = {
    planner: 'magenta',
    architect: 'blue',
    developer: 'green',
    reviewer: 'yellow',
    tester: 'cyan',
    devops: 'red',
  };

  describe('extreme animation states', () => {
    it('handles progress values far beyond normal range', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 999.99,
        isFading: true,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // Should still render without errors
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('handles negative progress values', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: -5.5,
        isFading: false,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('handles NaN progress values', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: NaN,
        isFading: false,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles Infinity progress values', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: Infinity,
        isFading: true,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });
  });

  describe('unusual agent names', () => {
    it('handles extremely long agent names', () => {
      const longAgentName = 'a'.repeat(1000);
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: longAgentName,
        currentAgent: 'tester',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText(longAgentName)).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles agent names with unicode characters', () => {
      const unicodeAgents = ['🤖agent', '测试员', 'агент', '🚀deployer'];

      unicodeAgents.forEach((prevAgent, index) => {
        const nextAgent = unicodeAgents[(index + 1) % unicodeAgents.length];
        const animationState = createAnimationState({
          isAnimating: true,
          previousAgent: prevAgent,
          currentAgent: nextAgent,
          progress: 0.5,
        });

        render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText(prevAgent)).toBeInTheDocument();
        expect(screen.getByText(nextAgent)).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
      });
    });

    it('handles agent names with control characters and whitespace', () => {
      const weirdAgents = [
        '\n\t\r agent',
        'agent\u0000with\u0001nulls',
        '  spaced  agent  ',
        'agent\u200Bwith\u200Czero\u200Dwidth',
      ];

      weirdAgents.forEach((agent, index) => {
        const animationState = createAnimationState({
          isAnimating: true,
          previousAgent: agent,
          currentAgent: 'normal-agent',
          progress: 0.3,
        });

        render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
          />
        );

        expect(screen.getByText(agent)).toBeInTheDocument();
        expect(screen.getByText('normal-agent')).toBeInTheDocument();
      });
    });

    it('handles agent names that look like HTML/markup', () => {
      const htmlLikeAgents = [
        '<script>alert("xss")</script>',
        '&lt;bold&gt;agent&lt;/bold&gt;',
        '<div>nested<span>agent</span></div>',
        '<!-- comment -->agent',
      ];

      htmlLikeAgents.forEach((agent) => {
        const animationState = createAnimationState({
          isAnimating: true,
          previousAgent: agent,
          currentAgent: 'safe-agent',
          progress: 0.4,
        });

        render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
          />
        );

        // Should render as text, not execute as markup
        expect(screen.getByText(agent)).toBeInTheDocument();
        expect(screen.getByText('safe-agent')).toBeInTheDocument();
      });
    });

    it('handles identical agent names', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'same-agent',
        currentAgent: 'same-agent',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // Should render both instances of the same name
      const sameAgentTexts = screen.getAllByText('same-agent');
      expect(sameAgentTexts).toHaveLength(2);
      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });

  describe('corrupted or invalid agent colors', () => {
    it('handles null agent colors object', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={null as any}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles undefined agent colors object', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={undefined as any}
        />
      );

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles agent colors with non-string values', () => {
      const corruptedColors = {
        planner: 123 as any,
        architect: null as any,
        developer: undefined as any,
        tester: {} as any,
        reviewer: [] as any,
      };

      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.6,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={corruptedColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles agent colors with invalid color names', () => {
      const invalidColors = {
        planner: 'definitely-not-a-color',
        developer: 'rgb(999, 999, 999)',
        architect: '#GGGGGG',
        tester: 'hsl(400deg, 150%, 150%)',
      };

      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.7,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={invalidColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('extreme rendering scenarios', () => {
    it('handles rapid re-renders with changing states', () => {
      const states = [
        createAnimationState({
          isAnimating: true,
          previousAgent: 'a',
          currentAgent: 'b',
          progress: 0.1,
        }),
        createAnimationState({
          isAnimating: true,
          previousAgent: 'b',
          currentAgent: 'c',
          progress: 0.5,
        }),
        createAnimationState({
          isAnimating: true,
          previousAgent: 'c',
          currentAgent: 'd',
          progress: 0.9,
          isFading: true,
        }),
        createAnimationState({
          isAnimating: false,
          previousAgent: null,
          currentAgent: null,
          progress: 0,
        }),
      ];

      const { rerender } = render(
        <HandoffIndicator
          animationState={states[0]}
          agentColors={mockAgentColors}
        />
      );

      // Rapidly cycle through all states
      states.forEach((state) => {
        rerender(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
          />
        );
      });

      // Should end with no content (last state is not animating)
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('handles switching between compact and full mode rapidly', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
      });

      const { rerender } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Should start in full mode
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      // Should switch to compact mode
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      expect(screen.queryByText('⚡')).not.toBeInTheDocument();

      // Switch back to full mode
      rerender(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Should switch back to full mode
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('handles animation state with conflicting flags', () => {
      // Conflicting state: not animating but has agents and progress
      const conflictingState = createAnimationState({
        isAnimating: false, // This should make it not render
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: true,
      });

      const { container } = render(
        <HandoffIndicator
          animationState={conflictingState}
          agentColors={mockAgentColors}
        />
      );

      // Should respect isAnimating: false and not render
      expect(container.firstChild).toBeNull();
    });
  });

  describe('boundary conditions', () => {
    it('handles exact fade threshold boundary', () => {
      // Test exactly at fade threshold (0.75)
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.75,
        isFading: true,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('handles progress just below and above fade threshold', () => {
      const belowThreshold = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.7499999,
        isFading: false,
      });

      const { rerender } = render(
        <HandoffIndicator
          animationState={belowThreshold}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('architect')).toBeInTheDocument();

      const aboveThreshold = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.7500001,
        isFading: true,
      });

      rerender(
        <HandoffIndicator
          animationState={aboveThreshold}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles zero and one progress values', () => {
      // Progress 0
      const zeroProgress = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(
        <HandoffIndicator
          animationState={zeroProgress}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();

      // Progress 1
      const fullProgress = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 1,
        isFading: true,
      });

      rerender(
        <HandoffIndicator
          animationState={fullProgress}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('memory and performance edge cases', () => {
    it('handles many rapid state changes without memory issues', () => {
      const { rerender } = render(
        <HandoffIndicator
          animationState={createAnimationState()}
          agentColors={mockAgentColors}
        />
      );

      // Rapidly change states 100 times
      for (let i = 0; i < 100; i++) {
        const state = createAnimationState({
          isAnimating: i % 2 === 0,
          previousAgent: `agent-${i}`,
          currentAgent: `agent-${i + 1}`,
          progress: Math.random(),
          isFading: Math.random() > 0.5,
        });

        rerender(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
            compact={i % 3 === 0}
          />
        );
      }

      // Should handle all changes without errors
    });

    it('handles very large agent colors object', () => {
      // Create object with 1000 agent colors
      const largeColors = Object.fromEntries(
        Array.from({ length: 1000 }, (_, i) => [`agent-${i}`, 'blue'])
      );

      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'agent-500',
        currentAgent: 'agent-501',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={largeColors}
        />
      );

      expect(screen.getByText('agent-500')).toBeInTheDocument();
      expect(screen.getByText('agent-501')).toBeInTheDocument();
    });
  });
});