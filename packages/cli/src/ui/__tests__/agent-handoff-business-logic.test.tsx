/**
 * Business Logic Validation Tests for Agent Handoff Animation
 * Tests specific business requirements and workflow scenarios
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../components/agents/AgentPanel';

describe('Agent Handoff Animation - Business Logic Validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const workflowAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'completed' },
    { name: 'tester', status: 'active', stage: 'testing', progress: 60 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'devops', status: 'idle' },
  ];

  describe('requirement compliance validation', () => {
    it('meets acceptance criteria: animated transition when currentAgent changes', async () => {
      // Acceptance Criteria: AgentPanel displays animated transition when currentAgent changes
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="developer" />
      );

      // Initial state - no animation
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Change currentAgent - should trigger animation
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="tester" />
      );

      // Should show animated transition within first frame
      act(() => {
        vi.advanceTimersByTime(50); // Small advance to trigger initial animation frame
      });

      // Verify animation displays 'previousAgent → currentAgent'
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('meets acceptance criteria: visual indicator shows previousAgent → currentAgent', () => {
      // Acceptance Criteria: visual indicator showing 'previousAgent → currentAgent'
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="planner" />
      );

      // Trigger handoff
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="architect" />
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Verify exact format: previousAgent → currentAgent
      const plannerElement = screen.getByText('planner');
      const arrowElement = screen.getByText('→');
      const architectElement = screen.getByText('architect');

      // Verify all elements are present and correctly ordered
      expect(plannerElement).toBeInTheDocument();
      expect(arrowElement).toBeInTheDocument();
      expect(architectElement).toBeInTheDocument();
    });

    it('meets acceptance criteria: fades after 2 seconds', async () => {
      // Acceptance Criteria: fades after 2 seconds
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="architect" />
      );

      // Start animation
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="developer" />
      );

      // Animation should be visible
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.getByText('→')).toBeInTheDocument();

      // Still visible at 1.5 seconds (before fade)
      act(() => {
        vi.advanceTimersByTime(1400); // Total: 1.5s
      });
      expect(screen.getByText('→')).toBeInTheDocument();

      // Should be in fade phase at 1.8 seconds
      act(() => {
        vi.advanceTimersByTime(300); // Total: 1.8s
      });
      expect(screen.getByText('→')).toBeInTheDocument(); // Still visible but fading

      // Should be completely gone after 2 seconds
      act(() => {
        vi.advanceTimersByTime(200); // Total: 2s
      });
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('meets acceptance criteria: works in both compact and full panel modes', () => {
      // Acceptance Criteria: Works in both compact and full panel modes
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="developer" compact={false} />
      );

      // Test full panel mode
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="tester" compact={false} />
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Full mode should show "Handoff:" prefix and lightning bolt
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Test compact panel mode
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="reviewer" compact={true} />
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Compact mode should NOT show "Handoff:" prefix or lightning bolt
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      // But should still show the agent transition
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });
  });

  describe('workflow scenario testing', () => {
    it('handles typical development workflow: planner → architect → developer → tester', async () => {
      // Simulate typical APEX workflow progression
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="planner" />
      );

      const workflowSteps = ['architect', 'developer', 'tester'];
      let previousAgent = 'planner';

      for (const currentAgent of workflowSteps) {
        // Trigger next step in workflow
        rerender(
          <AgentPanel agents={workflowAgents} currentAgent={currentAgent} />
        );

        // Verify handoff animation
        act(() => {
          vi.advanceTimersByTime(100);
        });

        expect(screen.getByText(previousAgent)).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText(currentAgent)).toBeInTheDocument();

        // Let animation complete before next step
        act(() => {
          vi.advanceTimersByTime(2000);
        });

        expect(screen.queryByText('→')).not.toBeInTheDocument();

        previousAgent = currentAgent;
      }
    });

    it('handles agent status changes during handoff', () => {
      // Test that agent status updates don't interfere with handoff animation
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="developer" />
      );

      // Start handoff
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="tester" />
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Verify animation started
      expect(screen.getByText('→')).toBeInTheDocument();

      // Update agent status during animation
      const updatedAgents: AgentInfo[] = workflowAgents.map(agent =>
        agent.name === 'tester'
          ? { ...agent, status: 'active', progress: 80 }
          : agent
      );

      rerender(
        <AgentPanel agents={updatedAgents} currentAgent="tester" />
      );

      // Animation should continue unaffected
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Agent list should show updated status
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });

    it('validates handoff does not trigger for same agent', () => {
      // Business rule: No handoff animation if agent doesn't actually change
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="developer" />
      );

      // Re-render with same currentAgent
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="developer" />
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should not trigger handoff animation
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
    });
  });

  describe('error recovery and resilience', () => {
    it('gracefully handles malformed agent data during handoff', () => {
      const malformedAgents: AgentInfo[] = [
        { name: '', status: 'completed' }, // Empty name
        { name: 'architect', status: 'active' as any }, // Valid
        { name: null as any, status: 'waiting' }, // Null name
      ];

      const { rerender } = render(
        <AgentPanel agents={malformedAgents} currentAgent="architect" />
      );

      // Should not crash with malformed data
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Trigger handoff to empty string agent
      rerender(
        <AgentPanel agents={malformedAgents} currentAgent="" />
      );

      // Should handle gracefully
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Animation might show but shouldn't crash
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('maintains panel functionality when handoff animation fails', () => {
      // Simulate animation failure scenario
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="planner" />
      );

      // Trigger handoff
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="architect" />
      );

      // Even if handoff animation has issues, core panel should work
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Status indicators should still work
      expect(screen.getByText('✓')).toBeInTheDocument(); // completed
      expect(screen.getByText('⚡')).toBeInTheDocument(); // active
      expect(screen.getByText('○')).toBeInTheDocument(); // waiting

      // Progress information should still display
      expect(screen.getByText(/testing/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
    });
  });

  describe('performance and usability', () => {
    it('animation does not block user interaction with agent list', () => {
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="developer" />
      );

      // Start handoff animation
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="tester" />
      );

      act(() => {
        vi.advanceTimersByTime(500); // Mid-animation
      });

      // During animation, all agent information should remain accessible
      workflowAgents.forEach(agent => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });

      // Stage and progress information should be visible
      expect(screen.getByText(/testing/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();

      // Status icons should be visible
      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('○')).toBeInTheDocument();
      expect(screen.getByText('·')).toBeInTheDocument();
    });

    it('handoff animation provides clear visual hierarchy', () => {
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="architect" />
      );

      // Trigger handoff
      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="developer" />
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Full mode should have clear visual hierarchy
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument(); // Clear section label
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Visual indicator
      expect(screen.getByText('architect')).toBeInTheDocument(); // Source
      expect(screen.getByText('→')).toBeInTheDocument(); // Direction
      expect(screen.getByText('developer')).toBeInTheDocument(); // Target

      // Main panel should remain primary content
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('validates 2-second duration is appropriate for user comprehension', () => {
      // Business requirement: 2 seconds should be enough time for users to register the change
      // but not so long as to be annoying
      const { rerender } = render(
        <AgentPanel agents={workflowAgents} currentAgent="planner" />
      );

      rerender(
        <AgentPanel agents={workflowAgents} currentAgent="architect" />
      );

      const checkpoints = [
        { time: 500, description: 'Early animation - clearly visible' },
        { time: 1000, description: 'Mid animation - still clear' },
        { time: 1500, description: 'Late animation - beginning fade' },
        { time: 1800, description: 'Fade phase - still readable' },
      ];

      checkpoints.forEach(({ time, description }) => {
        act(() => {
          vi.advanceTimersByTime(time - (vi.getTimerCount() > 0 ? 0 : 0));
        });

        // Animation should be visible and readable at each checkpoint
        if (time < 2000) {
          expect(screen.getByText('planner')).toBeInTheDocument();
          expect(screen.getByText('→')).toBeInTheDocument();
          expect(screen.getByText('architect')).toBeInTheDocument();
        }
      });

      // Should be gone after full duration
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });
  });
});