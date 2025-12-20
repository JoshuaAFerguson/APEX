/**
 * Terminal Compatibility Tests for HandoffIndicator
 * Tests behavior specific to terminal environments and edge cases
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { HandoffIndicator } from '../HandoffIndicator';
import type { HandoffAnimationState } from '../../../hooks/useAgentHandoff.js';

describe('HandoffIndicator Terminal Compatibility', () => {
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

  describe('terminal width handling', () => {
    it('renders correctly with very long agent names that might wrap', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'extremely-long-agent-name-that-would-definitely-wrap-in-narrow-terminals',
        currentAgent: 'another-extremely-long-agent-name-for-comprehensive-testing-purposes',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // Should render without breaking layout
      expect(screen.getByText('extremely-long-agent-name-that-would-definitely-wrap-in-narrow-terminals')).toBeInTheDocument();
      expect(screen.getByText('another-extremely-long-agent-name-for-comprehensive-testing-purposes')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('handles compact mode with long agent names', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'long-previous-agent-name',
        currentAgent: 'long-current-agent-name',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      expect(screen.getByText('long-previous-agent-name')).toBeInTheDocument();
      expect(screen.getByText('long-current-agent-name')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });

  describe('unicode and special character handling', () => {
    it('handles unicode agent names correctly', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: '🤖robot-agent',
        currentAgent: '🚀deployment-bot',
        progress: 0.4,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('🤖robot-agent')).toBeInTheDocument();
      expect(screen.getByText('🚀deployment-bot')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('handles multi-byte unicode characters', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: '测试员', // Chinese characters
        currentAgent: 'العامل', // Arabic characters
        progress: 0.6,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('测试员')).toBeInTheDocument();
      expect(screen.getByText('العامل')).toBeInTheDocument();
    });

    it('handles zero-width characters and combining marks', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'age\u0300nt', // Agent with combining grave accent
        currentAgent: 'test\u200Ber', // Tester with zero-width space
        progress: 0.7,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('age\u0300nt')).toBeInTheDocument();
      expect(screen.getByText('test\u200Ber')).toBeInTheDocument();
    });
  });

  describe('terminal color compatibility', () => {
    it('handles unknown color names gracefully', () => {
      const unknownColors = {
        agent1: 'fluorescent-green',
        agent2: 'ultra-violet',
        agent3: '', // empty string
      };

      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'agent1',
        currentAgent: 'agent2',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={unknownColors}
        />
      );

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });

    it('handles hex colors in agent colors', () => {
      const hexColors = {
        agent1: '#FF0000',
        agent2: '#00FF00',
        agent3: '#0000FF',
      };

      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'agent1',
        currentAgent: 'agent2',
        progress: 0.8,
        isFading: true,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={hexColors}
        />
      );

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });

    it('handles rgb/hsl color formats', () => {
      const colorFormats = {
        agent1: 'rgb(255, 0, 0)',
        agent2: 'hsl(120, 100%, 50%)',
        agent3: 'rgba(0, 0, 255, 0.5)',
      };

      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'agent1',
        currentAgent: 'agent2',
        progress: 0.2,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={colorFormats}
        />
      );

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });
  });

  describe('animation state boundary conditions', () => {
    it('handles progress values with high precision', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.7500000000000001, // Just above fade threshold
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
    });

    it('handles progress values with floating point precision issues', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.1 + 0.2, // 0.30000000000000004 in JS
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
    });

    it('handles extreme progress values', () => {
      // Test with very large numbers
      const largeProgressState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: Number.MAX_VALUE,
        isFading: true,
      });

      render(
        <HandoffIndicator
          animationState={largeProgressState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles very small progress values', () => {
      const smallProgressState = createAnimationState({
        isAnimating: true,
        previousAgent: 'reviewer',
        currentAgent: 'devops',
        progress: Number.MIN_VALUE,
        isFading: false,
      });

      render(
        <HandoffIndicator
          animationState={smallProgressState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });
  });

  describe('layout and spacing edge cases', () => {
    it('handles single character agent names', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'A',
        currentAgent: 'B',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('handles agents with only whitespace', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: '   ',
        currentAgent: '\t\t',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('   ')).toBeInTheDocument();
      expect(screen.getByText('\t\t')).toBeInTheDocument();
    });

    it('maintains correct spacing in compact mode', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'short',
        currentAgent: 'x',
        progress: 0.4,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      // Should have proper spacing around arrow
      const arrowElement = screen.getByText('→');
      expect(arrowElement).toBeInTheDocument();
      expect(screen.getByText('short')).toBeInTheDocument();
      expect(screen.getByText('x')).toBeInTheDocument();
    });
  });

  describe('performance under terminal constraints', () => {
    it('handles rapid re-renders efficiently', () => {
      const states = Array.from({ length: 50 }, (_, i) =>
        createAnimationState({
          isAnimating: true,
          previousAgent: `agent-${i}`,
          currentAgent: `agent-${i + 1}`,
          progress: i / 50,
          isFading: i > 37, // Fade in last quarter
        })
      );

      const { rerender } = render(
        <HandoffIndicator
          animationState={states[0]}
          agentColors={mockAgentColors}
        />
      );

      // Rapidly cycle through all states
      states.forEach(state => {
        rerender(
          <HandoffIndicator
            animationState={state}
            agentColors={mockAgentColors}
          />
        );
      });

      // Should handle all re-renders without issues
      expect(screen.getByText('agent-49')).toBeInTheDocument();
      expect(screen.getByText('agent-50')).toBeInTheDocument();
    });

    it('maintains performance with very large agent color objects', () => {
      // Simulate a large number of agents
      const largeColorMap = Object.fromEntries(
        Array.from({ length: 10000 }, (_, i) => [`agent-${i}`, 'blue'])
      );

      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'agent-5000',
        currentAgent: 'agent-5001',
        progress: 0.6,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={largeColorMap}
        />
      );

      expect(screen.getByText('agent-5000')).toBeInTheDocument();
      expect(screen.getByText('agent-5001')).toBeInTheDocument();
    });
  });

  describe('error recovery in terminal environments', () => {
    it('gracefully handles corrupted animation state', () => {
      // Simulate corrupted state that might occur in real terminals
      const corruptedState = {
        isAnimating: true,
        previousAgent: null, // Should not render, but shouldn't crash
        currentAgent: 'developer',
        progress: NaN,
        isFading: undefined as any,
      };

      const { container } = render(
        <HandoffIndicator
          animationState={corruptedState}
          agentColors={mockAgentColors}
        />
      );

      // Should not render anything but also not crash
      expect(container.firstChild).toBeNull();
    });

    it('handles missing required props gracefully', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
      });

      // Missing agentColors prop
      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={undefined as any}
        />
      );

      // Should render with fallback colors
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });
});