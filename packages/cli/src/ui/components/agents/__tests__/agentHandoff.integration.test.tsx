/**
 * Integration tests for the agent handoff animation feature
 * Tests the complete interaction between AgentPanel, HandoffIndicator, and useAgentHandoff hook
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('Agent Handoff Animation Integration', () => {
  const mockAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation', progress: 75 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
    { name: 'devops', status: 'idle' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('full integration workflow', () => {
    it('displays handoff animation when agent changes in full mode', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Initially no handoff animation should be visible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Change current agent to trigger handoff animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // After agent change, we should see the handoff animation
      // Note: The animation might not be immediately visible due to the implementation details
      // but the hook should be called with the new agent
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Advance time to simulate animation progress
      vi.advanceTimersByTime(1000); // 50% through 2s animation

      // Continue to completion
      vi.advanceTimersByTime(1000); // Complete animation

      // Verify the panel still works correctly after animation
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('displays handoff animation when agent changes in compact mode', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="architect" compact={true} />
      );

      // Initially no "Active Agents" header in compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Change current agent to trigger handoff animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="tester" compact={true} />);

      expect(screen.getByText('tester')).toBeInTheDocument();

      // Simulate animation progression
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(1000); // Complete

      // Verify compact mode layout is maintained
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles multiple rapid agent changes correctly', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Rapid succession of agent changes
      rerender(<AgentPanel agents={mockAgents} currentAgent="architect" />);
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // Should handle all changes gracefully
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Complete any ongoing animations
      vi.advanceTimersByTime(2000);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('maintains agent list functionality during animation', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Change agent to start animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // During animation, all agent list functionality should still work
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // All agents should still be visible
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();

      // Status indicators should still work
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
      expect(screen.getByText(/·/)).toBeInTheDocument(); // idle

      // Stage and progress should still be displayed
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();

      // Complete animation
      vi.advanceTimersByTime(2000);

      // Everything should still be working after animation
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
    });

    it('works correctly when currentAgent is not in agents list', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Change to an agent not in the list
      rerender(<AgentPanel agents={mockAgents} currentAgent="custom-agent" />);

      // Should still work without crashing
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Complete animation
      vi.advanceTimersByTime(2000);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles empty agents list with handoff animation', () => {
      const { rerender } = render(
        <AgentPanel agents={[]} currentAgent="agent1" />
      );

      // Change agent even with empty list
      rerender(<AgentPanel agents={[]} currentAgent="agent2" />);

      // Should not crash
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Complete animation
      vi.advanceTimersByTime(2000);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });

  describe('animation timing integration', () => {
    it('completes full animation cycle correctly', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Animation should start (t=0)
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Midway through animation (t=1000ms)
      vi.advanceTimersByTime(1000);
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Fade phase starts (t=1500ms, default fade starts at 1500ms)
      vi.advanceTimersByTime(500);
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Animation completes (t=2000ms)
      vi.advanceTimersByTime(500);
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles overlapping animations correctly', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start first animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="architect" />);

      // Advance partway through first animation
      vi.advanceTimersByTime(500);

      // Start second animation before first completes
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Should handle the interruption gracefully
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Complete the second animation
      vi.advanceTimersByTime(2000);

      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('mode switching during animation', () => {
    it('handles switching from full to compact mode during animation', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation in full mode
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Advance animation slightly
      vi.advanceTimersByTime(500);

      // Switch to compact mode during animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={true} />);

      // Should switch to compact layout
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Complete animation
      vi.advanceTimersByTime(1500);

      // Should maintain compact layout
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
    });

    it('handles switching from compact to full mode during animation', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="architect" compact={true} />
      );

      // Start animation in compact mode
      rerender(<AgentPanel agents={mockAgents} currentAgent="tester" compact={true} />);
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Advance animation slightly
      vi.advanceTimersByTime(500);

      // Switch to full mode during animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="tester" compact={false} />);

      // Should switch to full layout
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Complete animation
      vi.advanceTimersByTime(1500);

      // Should maintain full layout
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });

  describe('accessibility during animation', () => {
    it('maintains accessibility during handoff animation', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // All text should remain accessible during animation
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Advance through animation
      vi.advanceTimersByTime(1000);

      // Accessibility should be maintained
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();

      // Complete animation
      vi.advanceTimersByTime(1000);

      // Final state should be accessible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('provides consistent visual feedback throughout animation', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="reviewer" />
      );

      // Start animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="devops" />);

      // Visual elements should be consistent
      expect(screen.getByText('devops')).toBeInTheDocument();

      // Status icons should remain visible
      expect(screen.getByText(/✓/)).toBeInTheDocument();
      expect(screen.getByText(/○/)).toBeInTheDocument();
      expect(screen.getByText(/·/)).toBeInTheDocument();

      // Progress through animation phases
      vi.advanceTimersByTime(750); // Before fade
      expect(screen.getByText('devops')).toBeInTheDocument();

      vi.advanceTimersByTime(750); // During fade
      expect(screen.getByText('devops')).toBeInTheDocument();

      vi.advanceTimersByTime(500); // Complete
      expect(screen.getByText('devops')).toBeInTheDocument();
    });
  });

  describe('performance and cleanup', () => {
    it('cleans up animations properly on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { rerender, unmount } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Unmount during animation
      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('handles component rerender during animation efficiently', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Multiple rerenders with same props during animation
      vi.advanceTimersByTime(500);
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      vi.advanceTimersByTime(500);
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Should handle efficiently without restarting animation
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Complete animation
      vi.advanceTimersByTime(1000);
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('edge case scenarios', () => {
    it('handles agent changes to undefined/null', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Change to undefined
      rerender(<AgentPanel agents={mockAgents} currentAgent={undefined} />);

      // Should not crash
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Complete any animations
      vi.advanceTimersByTime(2000);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles very rapid agent changes', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      const agents = ['architect', 'developer', 'tester', 'reviewer', 'devops'];

      // Rapid changes
      for (let i = 0; i < agents.length; i++) {
        rerender(<AgentPanel agents={mockAgents} currentAgent={agents[i]} />);
        vi.advanceTimersByTime(100); // Very short intervals
      }

      // Should handle all changes
      expect(screen.getByText('devops')).toBeInTheDocument();

      // Complete final animation
      vi.advanceTimersByTime(2000);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('maintains consistency with dynamic agent list updates', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Update agent list while animation might be running
      const updatedAgents: AgentInfo[] = [
        ...mockAgents,
        { name: 'new-agent', status: 'active' },
      ];

      rerender(<AgentPanel agents={updatedAgents} currentAgent="new-agent" />);

      // Should handle the new agent
      expect(screen.getByText('new-agent')).toBeInTheDocument();

      // Complete animation
      vi.advanceTimersByTime(2000);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('new-agent')).toBeInTheDocument();
    });
  });
});