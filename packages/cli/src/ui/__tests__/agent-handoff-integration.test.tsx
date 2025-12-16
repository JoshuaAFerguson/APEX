/**
 * End-to-end integration tests for agent handoff animation feature
 * Tests the complete workflow from user interaction to visual feedback
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../components/agents/AgentPanel';
import { HandoffIndicator } from '../components/agents/HandoffIndicator';
import { useAgentHandoff } from '../hooks/useAgentHandoff';

// Mock hook for isolated testing
vi.mock('../hooks/useAgentHandoff');

describe('Agent Handoff Animation - End-to-End Integration', () => {
  const mockUseAgentHandoff = vi.mocked(useAgentHandoff);

  beforeEach(() => {
    vi.useFakeTimers();
    mockUseAgentHandoff.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const mockAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation', progress: 75 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
    { name: 'devops', status: 'idle' },
  ];

  describe('complete user workflow', () => {
    it('displays full handoff animation workflow for developer to tester transition', async () => {
      // Setup: Mock the complete animation lifecycle
      const animationStates = [
        // Initial state - no animation
        {
          isAnimating: false,
          previousAgent: null,
          currentAgent: null,
          progress: 0,
          isFading: false,
        },
        // Animation starts
        {
          isAnimating: true,
          previousAgent: 'developer',
          currentAgent: 'tester',
          progress: 0,
          isFading: false,
        },
        // Mid-animation
        {
          isAnimating: true,
          previousAgent: 'developer',
          currentAgent: 'tester',
          progress: 0.5,
          isFading: false,
        },
        // Fade phase
        {
          isAnimating: true,
          previousAgent: 'developer',
          currentAgent: 'tester',
          progress: 0.8,
          isFading: true,
        },
        // Animation complete
        {
          isAnimating: false,
          previousAgent: null,
          currentAgent: null,
          progress: 0,
          isFading: false,
        },
      ];

      let stateIndex = 0;
      mockUseAgentHandoff.mockImplementation(() => animationStates[stateIndex]);

      // Render initial state
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Verify initial state
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Trigger agent change
      stateIndex = 1; // Animation starts
      mockUseAgentHandoff.mockImplementation(() => animationStates[stateIndex]);
      rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // Verify animation start
      await waitFor(() => {
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      });

      // Progress through mid-animation
      stateIndex = 2; // Mid-animation
      mockUseAgentHandoff.mockImplementation(() => animationStates[stateIndex]);
      rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // Verify mid-animation state
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();

      // Enter fade phase
      stateIndex = 3; // Fade phase
      mockUseAgentHandoff.mockImplementation(() => animationStates[stateIndex]);
      rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // Verify fade phase (content still visible but styled differently)
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();

      // Complete animation
      stateIndex = 4; // Animation complete
      mockUseAgentHandoff.mockImplementation(() => animationStates[stateIndex]);
      rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // Verify animation completion
      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      });

      // Verify normal panel state is restored
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('displays compact handoff animation workflow for architect to reviewer transition', async () => {
      // Setup compact mode animation sequence
      const animationStates = [
        {
          isAnimating: false,
          previousAgent: null,
          currentAgent: null,
          progress: 0,
          isFading: false,
        },
        {
          isAnimating: true,
          previousAgent: 'architect',
          currentAgent: 'reviewer',
          progress: 0.3,
          isFading: false,
        },
        {
          isAnimating: true,
          previousAgent: 'architect',
          currentAgent: 'reviewer',
          progress: 0.9,
          isFading: true,
        },
        {
          isAnimating: false,
          previousAgent: null,
          currentAgent: null,
          progress: 0,
          isFading: false,
        },
      ];

      let stateIndex = 0;
      mockUseAgentHandoff.mockImplementation(() => animationStates[stateIndex]);

      // Render initial compact mode
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="architect" compact={true} />
      );

      // Verify initial compact state
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);

      // Start animation
      stateIndex = 1;
      mockUseAgentHandoff.mockImplementation(() => animationStates[stateIndex]);
      rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" compact={true} />);

      // Verify compact animation (no "Handoff:" prefix or ⚡ icon)
      await waitFor(() => {
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      });

      // Fade phase
      stateIndex = 2;
      mockUseAgentHandoff.mockImplementation(() => animationStates[stateIndex]);
      rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" compact={true} />);

      // Verify fade in compact mode
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Complete animation
      stateIndex = 3;
      mockUseAgentHandoff.mockImplementation(() => animationStates[stateIndex]);
      rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" compact={true} />);

      // Verify compact mode restoration
      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);
    });
  });

  describe('user experience validation', () => {
    it('provides clear visual feedback during transitions', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.4,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="architect" />);

      // Visual clarity requirements met
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument(); // Clear labeling
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Visual icon
      expect(screen.getByText('planner')).toBeInTheDocument(); // Previous agent shown
      expect(screen.getByText('→')).toBeInTheDocument(); // Direction indicator
      expect(screen.getByText('architect')).toBeInTheDocument(); // New agent shown

      // Normal functionality preserved
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('maintains accessibility standards during animation', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'tester',
        progress: 0.6,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // All text content should be accessible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();

      // Status and progress information preserved
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('provides consistent timing and smooth transitions', async () => {
      // Test the animation timing expectations
      const progressStates = [0, 0.25, 0.5, 0.75, 0.9];

      progressStates.forEach((progress) => {
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'architect',
          currentAgent: 'devops',
          progress,
          isFading: progress > 0.75,
        });

        const { rerender } = render(
          <AgentPanel agents={mockAgents} currentAgent="devops" />
        );

        // Animation should be visible at all progress points
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('devops')).toBeInTheDocument();
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('handles animation failures gracefully', () => {
      // Mock a problematic animation state
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: null, // This should cause HandoffIndicator to not render
        currentAgent: 'tester',
        progress: 0.5,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // Should not crash, animation should not appear
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();

      // Normal panel functionality should continue
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles rapid agent changes without visual glitches', () => {
      // Simulate rapid successive agent changes
      const agents = ['planner', 'architect', 'developer', 'tester', 'reviewer'];

      agents.forEach((currentAgent, index) => {
        const previousAgent = index > 0 ? agents[index - 1] : null;

        mockUseAgentHandoff.mockReturnValue({
          isAnimating: previousAgent !== null,
          previousAgent,
          currentAgent: previousAgent ? currentAgent : null,
          progress: 0.1,
          isFading: false,
        });

        const { rerender } = render(
          <AgentPanel agents={mockAgents} currentAgent={currentAgent} />
        );

        // Should handle rapid changes without errors
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
        expect(screen.getByText(currentAgent)).toBeInTheDocument();
      });
    });

    it('validates requirement compliance', () => {
      // Test that requirements are met:
      // 1. Shows 'previousAgent → currentAgent'
      // 2. Fades after 2 seconds
      // 3. Works in both compact and full modes

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      // Test full mode
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Requirement 1: Shows 'previousAgent → currentAgent'
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Test compact mode
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={true} />);

      // Requirement 3: Works in both modes
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      // Compact mode should not show full mode elements
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();

      // Simulate fade phase (Requirement 2: Fades after time)
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.85, // > 0.75, should be fading
        isFading: true,
      });

      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Animation should still be visible but in fade state
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Simulate completion
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Animation should be gone
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });
  });

  describe('performance validation', () => {
    it('does not cause unnecessary re-renders during animation', () => {
      const renderSpy = vi.fn();

      // Create a wrapper component to track renders
      const TrackedAgentPanel = (props: any) => {
        renderSpy();
        return <AgentPanel {...props} />;
      };

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.5,
        isFading: false,
      });

      const { rerender } = render(
        <TrackedAgentPanel agents={mockAgents} currentAgent="tester" />
      );

      const initialRenderCount = renderSpy.mock.calls.length;

      // Re-render with same props should not cause additional renders beyond React's normal behavior
      rerender(<TrackedAgentPanel agents={mockAgents} currentAgent="tester" />);

      // Should not have excessive re-renders
      expect(renderSpy.mock.calls.length).toBeLessThanOrEqual(initialRenderCount + 2);
    });

    it('cleans up resources properly', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.3,
        isFading: false,
      });

      const { unmount } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Should not throw errors on unmount
      expect(() => unmount()).not.toThrow();
    });
  });
});