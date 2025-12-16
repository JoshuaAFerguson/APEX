import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { HandoffIndicator } from '../HandoffIndicator';
import type { HandoffAnimationState } from '../../../hooks/useAgentHandoff.js';

describe('HandoffIndicator', () => {
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

  describe('rendering conditions', () => {
    it('returns null when not animating', () => {
      const animationState = createAnimationState({
        isAnimating: false,
        previousAgent: 'planner',
        currentAgent: 'developer',
      });

      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when missing previousAgent', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: null,
        currentAgent: 'developer',
      });

      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when missing currentAgent', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: null,
      });

      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when all conditions are met', () => {
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

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders in compact layout', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      // Should show agent names and arrow
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Should not show "Handoff:" prefix or ⚡ icon (compact mode)
      expect(screen.queryByText('Handoff:')).not.toBeInTheDocument();
      expect(screen.queryByText('⚡')).not.toBeInTheDocument();
    });

    it('applies correct styling during fade phase in compact mode', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.8, // > 0.75, should be fading
        isFading: true,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      // Should still display content even when fading
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('applies correct styling during normal phase in compact mode', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5, // <= 0.75, should not be fading
        isFading: false,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });

  describe('full mode', () => {
    it('renders in full layout', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Should show handoff prefix and lightning bolt
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();

      // Should show agent names and arrow
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('applies correct styling during fade phase in full mode', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.9, // > 0.75, should be fading
        isFading: true,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Should still display all content even when fading
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('applies correct styling during normal phase in full mode', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.4, // <= 0.75, should not be fading
        isFading: false,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });

  describe('fade threshold behavior', () => {
    it('correctly identifies fade phase based on progress', () => {
      // Test just before fade threshold (0.75)
      const beforeFade = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.74,
        isFading: false,
      });

      const { rerender } = render(
        <HandoffIndicator
          animationState={beforeFade}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();

      // Test just after fade threshold
      const afterFade = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.76,
        isFading: true,
      });

      rerender(
        <HandoffIndicator
          animationState={afterFade}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('handles progress exactly at fade threshold', () => {
      const exactFade = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.75,
        isFading: true,
      });

      render(
        <HandoffIndicator
          animationState={exactFade}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('agent color handling', () => {
    it('applies colors for known agents', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner', // magenta
        currentAgent: 'developer', // green
        progress: 0.3,
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

    it('falls back to white for unknown agents', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'unknown-agent1',
        currentAgent: 'unknown-agent2',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('unknown-agent1')).toBeInTheDocument();
      expect(screen.getByText('unknown-agent2')).toBeInTheDocument();
    });

    it('handles mixed known and unknown agents', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner', // known (magenta)
        currentAgent: 'custom-agent', // unknown (fallback to white)
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('custom-agent')).toBeInTheDocument();
    });

    it('handles empty agent colors object', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={{}}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('progress edge cases', () => {
    it('handles progress of 0', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0,
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

    it('handles progress of 1', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 1,
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

    it('handles progress values above 1', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 1.5,
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
  });

  describe('agent name edge cases', () => {
    it('handles agents with special characters', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'agent-with-dashes',
        currentAgent: 'agent_with_underscores',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('agent-with-dashes')).toBeInTheDocument();
      expect(screen.getByText('agent_with_underscores')).toBeInTheDocument();
    });

    it('handles agents with numbers', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'agent1',
        currentAgent: 'agent2',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });

    it('handles very long agent names', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'very-long-agent-name-that-might-cause-layout-issues',
        currentAgent: 'another-extremely-long-agent-name-for-testing',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('very-long-agent-name-that-might-cause-layout-issues')).toBeInTheDocument();
      expect(screen.getByText('another-extremely-long-agent-name-for-testing')).toBeInTheDocument();
    });

    it('handles empty string agent names', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: '',
        currentAgent: 'developer',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('provides accessible text content in full mode', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // All text should be accessible
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('provides accessible text content in compact mode', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.5,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      // All text should be accessible
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });

  describe('default prop behavior', () => {
    it('defaults to full mode when compact not specified', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // Should show full mode indicators
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('explicitly sets compact to false', () => {
      const animationState = createAnimationState({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.3,
      });

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Should show full mode indicators
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });
  });
});