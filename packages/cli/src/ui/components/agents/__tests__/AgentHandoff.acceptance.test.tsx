/**
 * Acceptance tests for Agent Handoff Animation Feature
 * Validates that the implementation meets all acceptance criteria
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('Agent Handoff Animation - Acceptance Criteria', () => {
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

  describe('Acceptance Criteria Validation', () => {
    it('AC1: Displays animated transition when currentAgent changes from previousAgent', async () => {
      // GIVEN: AgentPanel is rendered with an initial agent
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // WHEN: currentAgent changes to a different agent
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // THEN: An animated transition should be displayed
      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      // AND: The animation should be active
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('AC2: Shows visual indicator with "previousAgent → currentAgent" format', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="architect" />
      );

      // Change from architect to tester
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      // Verify the exact format: previousAgent → currentAgent
      await waitFor(() => {
        const plannerText = screen.getByText('architect');
        const arrow = screen.getByText('→');
        const developerText = screen.getByText('tester');

        expect(plannerText).toBeInTheDocument();
        expect(arrow).toBeInTheDocument();
        expect(developerText).toBeInTheDocument();

        // Verify they appear in the correct order by checking their positions
        const container = plannerText.parentElement?.parentElement?.textContent;
        expect(container).toMatch(/architect.*→.*tester/);
      });
    });

    it('AC3: Animation fades after 2 seconds', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Animation should be visible initially
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // After 1.5 seconds, should start fading (default fade starts at 1.5s)
      act(() => {
        vi.advanceTimersByTime(1600);
      });

      // Should still be visible but in fade phase
      expect(screen.getByText('→')).toBeInTheDocument();

      // After 2 seconds total, should be completely gone
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      });
    });

    it('AC4: Works in compact panel mode', async () => {
      // GIVEN: AgentPanel in compact mode
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" compact={true} />
      );

      // Verify compact mode characteristics
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);

      // WHEN: currentAgent changes
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" compact={true} />);
      });

      // THEN: Animation should display in compact format
      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
      });

      // AND: Should not show full mode indicators
      expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
    });

    it('AC5: Works in full panel mode', async () => {
      // GIVEN: AgentPanel in full mode
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="devops" compact={false} />
      );

      // Verify full mode characteristics
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // WHEN: currentAgent changes
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" compact={false} />);
      });

      // THEN: Animation should display in full format
      await waitFor(() => {
        expect(screen.getByText('devops')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
      });

      // AND: Should show full mode indicators
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
    });
  });

  describe('Additional Quality Assurance', () => {
    it('maintains accessibility during handoff animation', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // All text should remain accessible to screen readers
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();

        // Agent list should still be fully accessible
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText(/implementation/)).toBeInTheDocument();
        expect(screen.getByText(/75%/)).toBeInTheDocument();
      });
    });

    it('handles no agent transition gracefully', () => {
      // Should not animate when no previous agent exists
      const { container } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // No animation should be present initially
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();

      // But normal panel should render
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles undefined agent transitions correctly', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Change to undefined should not trigger animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent={undefined} />);
      });

      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
    });

    it('supports custom agent names not in predefined list', async () => {
      const customAgents: AgentInfo[] = [
        { name: 'custom-agent-1', status: 'active' },
        { name: 'special_agent_2', status: 'waiting' },
      ];

      const { rerender } = render(
        <AgentPanel agents={customAgents} currentAgent="custom-agent-1" />
      );

      act(() => {
        rerender(<AgentPanel agents={customAgents} currentAgent="special_agent_2" />);
      });

      // Should work with custom agent names
      await waitFor(() => {
        expect(screen.getByText('custom-agent-1')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('special_agent_2')).toBeInTheDocument();
      });
    });

    it('performs well under rapid agent changes', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Simulate rapid agent changes
      const agentSequence = ['architect', 'developer', 'tester', 'reviewer', 'devops'];

      agentSequence.forEach(agent => {
        act(() => {
          rerender(<AgentPanel agents={mockAgents} currentAgent={agent} />);
        });

        // Small time advance between changes
        act(() => {
          vi.advanceTimersByTime(50);
        });
      });

      // Should show the final transition
      await waitFor(() => {
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('devops')).toBeInTheDocument();
      });
    });

    it('cleans up properly when component unmounts during animation', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { rerender, unmount } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Unmount during animation
      unmount();

      // Should clean up interval
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Feature Integration Validation', () => {
    it('integrates seamlessly with existing AgentPanel functionality', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      // During animation, all existing AgentPanel features should work
      await waitFor(() => {
        // Animation present
        expect(screen.getByText('→')).toBeInTheDocument();

        // All agents visible with correct status icons
        expect(screen.getByText('✓')).toBeInTheDocument(); // completed
        expect(screen.getByText('⚡')).toBeInTheDocument(); // active (in status + animation)
        expect(screen.getByText('○')).toBeInTheDocument(); // waiting
        expect(screen.getByText('·')).toBeInTheDocument(); // idle

        // Stage and progress still displayed
        expect(screen.getByText(/implementation/)).toBeInTheDocument();
        expect(screen.getByText(/75%/)).toBeInTheDocument();

        // Header still present
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });
    });

    it('maintains visual consistency between modes', async () => {
      // Test compact mode
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" compact={true} />
      );

      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={true} />);
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Switch to full mode during animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={false} />);
      });

      // Should adapt to new mode
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
        expect(screen.getByText('⚡')).toBeInTheDocument();
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      });
    });
  });
});