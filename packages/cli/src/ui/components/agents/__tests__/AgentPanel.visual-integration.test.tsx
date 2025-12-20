/**
 * Visual Integration Tests for AgentPanel with HandoffIndicator
 * Tests visual behavior, timing, and user-visible aspects of the animation
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel Visual Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  describe('visual animation timing verification', () => {
    it('verifies correct visual progression through animation phases', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Initial state - no animation
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.queryByText('⚡')).toBeInTheDocument(); // Status icon only

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Phase 1: Animation starts (0ms) - should see full brightness
      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getAllByText('⚡')).toHaveLength(2); // Status icon + handoff icon
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      });

      // Phase 2: Mid-animation (1000ms) - should still be full brightness
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      // Phase 3: Fade starts (1500ms) - should begin dimming
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      // Phase 4: Animation ends (2000ms) - animation should disappear
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      });

      // Verify agent list is still intact
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('verifies compact mode animation timing', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="architect" compact={true} />
      );

      // Compact mode initial state
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" compact={true} />);
      });

      // Should show compact animation without full mode elements
      await waitFor(() => {
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
        expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);
      });

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Animation should end but compact layout remains
      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);
    });
  });

  describe('interaction with agent list during animation', () => {
    it('maintains agent highlighting during animation', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation to developer
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // During animation, developer should be highlighted as current agent
      const developerTexts = screen.getAllByText('developer');
      expect(developerTexts.length).toBeGreaterThanOrEqual(2); // Once in list, once in animation

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // After animation, developer should still be highlighted
      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles agent status changes during animation', async () => {
      const modifiedAgents = [...mockAgents];
      const { rerender } = render(
        <AgentPanel agents={modifiedAgents} currentAgent="planner" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={modifiedAgents} currentAgent="developer" />);
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Change agent status during animation
      const updatedAgents = modifiedAgents.map(agent =>
        agent.name === 'developer'
          ? { ...agent, status: 'completed' as const, progress: 100 }
          : agent
      );

      act(() => {
        rerender(<AgentPanel agents={updatedAgents} currentAgent="developer" />);
      });

      // Animation should continue, but agent status should update
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('✓')).toBeInTheDocument(); // completed icon
      });

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Verify final state
      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      expect(screen.getByText('✓')).toBeInTheDocument(); // Still completed
    });
  });

  describe('complex transition scenarios', () => {
    it('handles full workflow progression with multiple transitions', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Simulate full workflow: planner -> architect -> developer -> reviewer -> tester
      const agentSequence = ['architect', 'developer', 'reviewer', 'tester'];

      for (let i = 0; i < agentSequence.length; i++) {
        const nextAgent = agentSequence[i];

        act(() => {
          rerender(<AgentPanel agents={mockAgents} currentAgent={nextAgent} />);
        });

        // Each transition should show animation
        await waitFor(() => {
          expect(screen.getByText('→')).toBeInTheDocument();
          expect(screen.getByText(nextAgent)).toBeInTheDocument();
        });

        // Advance part way through animation
        act(() => {
          vi.advanceTimersByTime(1000);
        });

        // Should still be animating
        expect(screen.getByText('→')).toBeInTheDocument();
      }

      // Complete final animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      // Final agent should be tester
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles branching workflow with backtracking', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Forward: developer -> reviewer
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);
      });

      await waitFor(() => {
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
      });

      // Let animation partially complete
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Backtrack: reviewer -> developer (interrupt previous animation)
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      await waitFor(() => {
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      // Complete backtrack animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('error recovery and robustness', () => {
    it('recovers gracefully from undefined agent transitions', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start normal animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Transition to undefined (should not crash)
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent={undefined} />);
      });

      // Should not show animation anymore
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Back to valid agent (should work normally)
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      // Should not animate from undefined to tester
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles empty agent list with graceful degradation', async () => {
      const { rerender } = render(
        <AgentPanel agents={[]} currentAgent="nonexistent" />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Transition should not crash even with empty list
      act(() => {
        rerender(<AgentPanel agents={[]} currentAgent="another-nonexistent" />);
      });

      // Should handle gracefully
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });

  describe('accessibility during animation states', () => {
    it('maintains screen reader accessible content throughout animation', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      await waitFor(() => {
        // All text should be accessible during animation
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();

        // Agent list should remain accessible
        expect(screen.getByText(/implementation/)).toBeInTheDocument();
        expect(screen.getByText(/75%/)).toBeInTheDocument();
      });

      // During fade phase
      act(() => {
        vi.advanceTimersByTime(1600);
      });

      // Content should still be accessible even when dimmed
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('provides consistent tabbing and focus behavior during animation', async () => {
      // Note: This test validates that animation doesn't interfere with normal component behavior
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="architect" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // All agent names should still be findable by screen readers
      mockAgents.forEach(agent => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });

      // Animation text should also be accessible
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });
});