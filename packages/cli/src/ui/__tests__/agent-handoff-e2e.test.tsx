/**
 * End-to-End Integration Tests for Agent Handoff Animation
 * Tests complete user workflows and cross-component integration
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AgentPanel, AgentInfo } from '../components/agents/AgentPanel';

describe('Agent Handoff Animation - End-to-End Tests', () => {
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

  describe('complete handoff workflow', () => {
    it('shows complete handoff animation from planner to developer in full mode', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="planner"
          compact={false}
        />
      );

      // Initial state - no animation
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Trigger handoff from planner to developer
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={false}
        />
      );

      // Animation should start immediately
      await waitFor(() => {
        expect(screen.getByText('Handoff:')).toBeInTheDocument();
        expect(screen.getByText('⚡')).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      // Advance to middle of animation (1000ms of 2000ms)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should still be showing handoff (not fading yet)
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();

      // Advance to fade phase (1600ms of 2000ms, fade starts at 1500ms)
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Should still be visible but in fade state
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Complete animation (2000ms total)
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Animation should be complete and hidden
      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      // Normal agent panel should still be visible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('shows complete handoff animation from developer to tester in compact mode', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={true}
        />
      );

      // Initial compact mode - no "Active Agents" header, no animation
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Trigger handoff from developer to tester
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="tester"
          compact={true}
        />
      );

      // Animation should start in compact mode (no "Handoff:" prefix or ⚡)
      await waitFor(() => {
        expect(screen.queryByText('Handoff:')).not.toBeInTheDocument();
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
      });

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Animation should be complete
      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      // Normal compact panel should still be visible
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('rapid agent transitions', () => {
    it('handles multiple rapid handoffs correctly', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="planner"
          compact={false}
        />
      );

      // Rapid sequence: planner → architect → developer → tester
      const sequence = ['architect', 'developer', 'tester'];

      for (let i = 0; i < sequence.length; i++) {
        rerender(
          <AgentPanel
            agents={mockAgents}
            currentAgent={sequence[i]}
            compact={false}
          />
        );

        // Each should start new animation
        await waitFor(() => {
          expect(screen.getByText('→')).toBeInTheDocument();
        });

        // Advance partway through animation
        act(() => {
          vi.advanceTimersByTime(500);
        });
      }

      // Final animation should show tester
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Complete final animation
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });
    });

    it('handles mode switching during active animation', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="planner"
          compact={false}
        />
      );

      // Start handoff in full mode
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={false}
        />
      );

      // Verify full mode animation started
      await waitFor(() => {
        expect(screen.getByText('Handoff:')).toBeInTheDocument();
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });

      // Switch to compact mode during animation
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={true}
        />
      );

      // Should switch to compact mode display
      await waitFor(() => {
        expect(screen.queryByText('Handoff:')).not.toBeInTheDocument();
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument(); // Animation still active
      });

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });
    });
  });

  describe('edge case workflows', () => {
    it('handles agent changing to non-existent agent', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="planner"
          compact={false}
        />
      );

      // Change to agent not in the list
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="unknown-agent"
          compact={false}
        />
      );

      // Should still show animation
      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('unknown-agent')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });
    });

    it('handles empty agent list with handoff animation', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={[]}
          currentAgent="agent1"
          compact={false}
        />
      );

      // Change agent even with empty list
      rerender(
        <AgentPanel
          agents={[]}
          currentAgent="agent2"
          compact={false}
        />
      );

      // Should show animation despite empty agent list
      await waitFor(() => {
        expect(screen.getByText('agent1')).toBeInTheDocument();
        expect(screen.getByText('agent2')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      // Should still show "Active Agents" header
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles agent changing to undefined', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="planner"
          compact={false}
        />
      );

      // Change to undefined (no current agent)
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent={undefined}
          compact={false}
        />
      );

      // Should not show animation for transition to undefined
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Normal agent list should be visible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('accessibility and user experience', () => {
    it('maintains accessible text content during animation', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="planner"
          compact={false}
        />
      );

      // Start animation
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={false}
        />
      );

      // All text should be accessible during animation
      await waitFor(() => {
        expect(screen.getByText('Handoff:')).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Agent list should still be accessible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Stage and progress info should be accessible
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('preserves agent list functionality during animation', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="planner"
          compact={false}
        />
      );

      // Start animation
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={false}
        />
      );

      // All agent information should remain visible and functional
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Check all agents are displayed
      mockAgents.forEach(agent => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });

      // Check status icons are displayed
      expect(screen.getByText('✓')).toBeInTheDocument(); // completed
      expect(screen.getByText('⚡')).toBeInTheDocument(); // active (multiple instances)
      expect(screen.getByText('○')).toBeInTheDocument(); // waiting
      expect(screen.getByText('·')).toBeInTheDocument(); // idle

      // Check progress and stage info
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });
  });

  describe('performance validation', () => {
    it('completes animation within expected timeframe', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="planner"
          compact={false}
        />
      );

      const startTime = Date.now();

      // Start animation
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={false}
        />
      );

      // Animation should be active
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Animation should complete
      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      // Should complete in reasonable time (allowing for test overhead)
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete quickly in tests
    });
  });
});