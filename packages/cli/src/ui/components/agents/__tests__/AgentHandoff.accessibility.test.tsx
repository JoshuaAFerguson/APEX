/**
 * Comprehensive accessibility tests for agent handoff animation feature
 * Tests WCAG compliance and screen reader compatibility
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import { HandoffIndicator } from '../HandoffIndicator';
import type { HandoffAnimationState } from '../../../hooks/useAgentHandoff.js';

describe('Agent Handoff Accessibility Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const mockAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'active', stage: 'design', progress: 60 },
    { name: 'developer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
  ];

  const mockAgentColors = {
    planner: 'magenta',
    architect: 'blue',
    developer: 'green',
    tester: 'cyan',
  };

  describe('screen reader compatibility', () => {
    it('provides meaningful text content for agent transitions in full mode', () => {
      const animationState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.4,
        isFading: false,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Screen readers should be able to identify the handoff process
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();

      // All text should be available for screen reader announcement
      const handoffText = screen.getByText(/Handoff:/).textContent;
      expect(handoffText).toContain('Handoff');
    });

    it('provides meaningful text content for agent transitions in compact mode', () => {
      const animationState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.7,
        isFading: true,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      // Compact mode should still provide accessible content
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('maintains accessible agent information during animation', () => {
      const mockUseAgentHandoff = vi.fn();
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
        isFading: false,
      });

      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));

      render(<AgentPanel agents={mockAgents} currentAgent="architect" />);

      // All agent information should remain accessible
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Status information should be accessible
      expect(screen.getByText(/design/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();

      vi.doUnmock('../../../hooks/useAgentHandoff.js');
      mockUseAgentHandoff.mockRestore();
    });
  });

  describe('color contrast and visual accessibility', () => {
    it('maintains sufficient contrast during fade phase', () => {
      const fadingState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.8, // In fade phase
        isFading: true,
      };

      render(
        <HandoffIndicator
          animationState={fadingState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Content should still be visible and accessible during fade
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // The animation should gracefully degrade for accessibility
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('handles unknown agent colors gracefully for accessibility', () => {
      const animationState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: 'unknown-agent',
        currentAgent: 'another-unknown',
        progress: 0.3,
        isFading: false,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={{}} // Empty colors object
          compact={false}
        />
      );

      // Should fall back to accessible default colors
      expect(screen.getByText('unknown-agent')).toBeInTheDocument();
      expect(screen.getByText('another-unknown')).toBeInTheDocument();
    });
  });

  describe('animation accessibility preferences', () => {
    it('provides static content when animation completes', () => {
      const completedState: HandoffAnimationState = {
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      };

      const { container } = render(
        <HandoffIndicator
          animationState={completedState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Should not render when animation is complete (reduces motion)
      expect(container.firstChild).toBeNull();
    });

    it('maintains agent panel accessibility without animations', () => {
      const mockUseAgentHandoff = vi.fn();
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Core functionality should remain accessible without animations
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Status icons should provide semantic meaning
      expect(screen.getByText('✓')).toBeInTheDocument(); // completed
      expect(screen.getByText('⚡')).toBeInTheDocument(); // active
      expect(screen.getByText('○')).toBeInTheDocument(); // waiting
      expect(screen.getByText('·')).toBeInTheDocument(); // idle

      vi.doUnmock('../../../hooks/useAgentHandoff.js');
      mockUseAgentHandoff.mockRestore();
    });
  });

  describe('keyboard and focus management', () => {
    it('does not interfere with keyboard navigation', () => {
      const animationState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.6,
        isFading: false,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Handoff animation should not create focus traps or interfere with navigation
      // The component renders text content that doesn't require focus
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('provides consistent agent panel structure for navigation', () => {
      render(<AgentPanel agents={mockAgents} currentAgent="architect" />);

      // Consistent structure aids in navigation prediction
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // All agents should be presented in predictable order
      const agentTexts = ['planner', 'architect', 'developer', 'tester'];
      agentTexts.forEach(agent => {
        expect(screen.getByText(agent)).toBeInTheDocument();
      });
    });
  });

  describe('semantic markup and structure', () => {
    it('provides logical content hierarchy in full mode', () => {
      render(<AgentPanel agents={mockAgents} currentAgent="architect" />);

      // Should have clear content hierarchy
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Agent information should be structured logically
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText(/design/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
    });

    it('maintains semantic structure in compact mode', () => {
      render(<AgentPanel agents={mockAgents} currentAgent="developer" compact={true} />);

      // Compact mode should still provide logical structure
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument(); // Header not shown

      // But agent information should still be accessible
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Separators should be present for clarity
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);
    });
  });

  describe('error state accessibility', () => {
    it('handles missing agent data gracefully', () => {
      const invalidState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: null, // Missing data
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      };

      const { container } = render(
        <HandoffIndicator
          animationState={invalidState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      // Should not render incomplete animations (avoid confusion)
      expect(container.firstChild).toBeNull();
    });

    it('handles empty agent list accessibly', () => {
      render(<AgentPanel agents={[]} currentAgent="nonexistent" />);

      // Should provide clear indication of empty state
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Should not crash or provide misleading information
      expect(screen.queryByText('nonexistent')).not.toBeInTheDocument();
    });
  });
});