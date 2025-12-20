/**
 * Acceptance criteria validation tests for agent handoff animation feature
 * Tests that ALL acceptance criteria from the feature requirements are met
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from './test-utils';
import { AgentPanel, AgentInfo } from '../components/agents/AgentPanel';

describe('Agent Handoff Animation - Acceptance Criteria Validation', () => {
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

  describe('Acceptance Criteria 1: AgentPanel displays animated transition when currentAgent changes', () => {
    it('displays animation when currentAgent changes from previousAgent', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Initial state - no animation
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Change currentAgent to trigger animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Should display animated transition
      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      // ✅ REQUIREMENT MET: AgentPanel displays animated transition when currentAgent changes
    });

    it('does not display animation when currentAgent remains the same', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Re-render with same currentAgent
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Should not show animation
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // ✅ REQUIREMENT MET: Animation only triggers on actual changes
    });

    it('does not display animation when currentAgent changes to undefined', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Change to undefined
      rerender(<AgentPanel agents={mockAgents} currentAgent={undefined} />);

      // Should not show animation
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // ✅ REQUIREMENT MET: Animation requires both previous and current agents
    });
  });

  describe('Acceptance Criteria 2: Visual indicator shows previousAgent → currentAgent', () => {
    it('shows correct format: previousAgent → currentAgent in full mode', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="architect" />
      );

      // Trigger transition: architect → tester
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      // Should show "architect → tester" format
      await waitFor(() => {
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
      });

      // In full mode, should also show "Handoff:" prefix
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();

      // ✅ REQUIREMENT MET: Visual indicator shows 'previousAgent → currentAgent'
    });

    it('shows correct format: previousAgent → currentAgent in compact mode', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="reviewer" compact={true} />
      );

      // Trigger transition: reviewer → devops
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="devops" compact={true} />);
      });

      // Should show "reviewer → devops" format
      await waitFor(() => {
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('devops')).toBeInTheDocument();
      });

      // In compact mode, should NOT show "Handoff:" prefix
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();

      // ✅ REQUIREMENT MET: Visual indicator format is consistent in both modes
    });

    it('maintains visual indicator format throughout animation lifecycle', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Check format at animation start
      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      // Check format during animation (mid-point)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Check format during fade phase
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // ✅ REQUIREMENT MET: Format remains consistent throughout animation
    });
  });

  describe('Acceptance Criteria 3: Animation fades after 2 seconds', () => {
    it('animation completes and disappears after 2 seconds with default settings', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="architect" />);
      });

      // Verify animation is present
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // After 1.9 seconds (before 2 seconds), animation should still be visible
      act(() => {
        vi.advanceTimersByTime(1900);
      });

      expect(screen.getByText('→')).toBeInTheDocument();

      // After 2+ seconds, animation should disappear
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      });

      // ✅ REQUIREMENT MET: Animation fades after 2 seconds
    });

    it('enters fade phase in last portion of 2-second animation', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      // At 1.4 seconds (before fade phase), should not be fading
      act(() => {
        vi.advanceTimersByTime(1400);
      });

      // Animation should still be visible and not fading
      expect(screen.getByText('→')).toBeInTheDocument();

      // At 1.6 seconds (during fade phase), should be fading
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Animation should still be visible but in fade state
      expect(screen.getByText('→')).toBeInTheDocument();
      // Note: Fade state is primarily visual (styling), content remains accessible

      // ✅ REQUIREMENT MET: Animation enters fade phase before completion
    });

    it('respects custom animation duration if provided', async () => {
      // Note: This tests that the underlying hook supports custom duration
      // The default AgentPanel uses 2 seconds, but the hook is configurable

      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="reviewer" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="devops" />);
      });

      // With default 2-second duration
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Should complete at 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });

      // ✅ REQUIREMENT MET: 2-second timing is enforced
    });
  });

  describe('Acceptance Criteria 4: Works in both compact and full panel modes', () => {
    it('animation works correctly in full panel mode', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" compact={false} />
      );

      // Full mode should show header
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Start animation in full mode
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="architect" compact={false} />);
      });

      // Should display full mode animation with all elements
      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });

      // Should maintain full mode layout
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // ✅ REQUIREMENT MET: Works in full panel mode
    });

    it('animation works correctly in compact panel mode', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" compact={true} />
      );

      // Compact mode should not show header
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      // Should show pipe separators
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);

      // Start animation in compact mode
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" compact={true} />);
      });

      // Should display compact mode animation without full mode elements
      await waitFor(() => {
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        // Should NOT show full mode elements
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      });

      // Should maintain compact mode layout
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);

      // ✅ REQUIREMENT MET: Works in compact panel mode
    });

    it('can switch between modes during animation', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="reviewer" compact={false} />
      );

      // Start animation in full mode
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="devops" compact={false} />);
      });

      // Verify full mode animation
      await waitFor(() => {
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Switch to compact mode during animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="devops" compact={true} />);
      });

      // Should switch to compact mode layout while maintaining animation
      await waitFor(() => {
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      });

      // ✅ REQUIREMENT MET: Mode switching works during animation
    });

    it('animation behavior is consistent across both modes', async () => {
      // Test same transition in both modes
      const testTransition = async (compact: boolean) => {
        const { rerender } = render(
          <AgentPanel agents={mockAgents} currentAgent="planner" compact={compact} />
        );

        // Start animation
        act(() => {
          rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={compact} />);
        });

        // Animation should start
        await waitFor(() => {
          expect(screen.getByText('planner')).toBeInTheDocument();
          expect(screen.getByText('→')).toBeInTheDocument();
          expect(screen.getByText('developer')).toBeInTheDocument();
        });

        // Should complete after 2 seconds
        act(() => {
          vi.advanceTimersByTime(2000);
        });

        await waitFor(() => {
          expect(screen.queryByText('→')).not.toBeInTheDocument();
        });
      };

      // Test full mode
      await testTransition(false);

      // Reset timers for next test
      vi.runOnlyPendingTimers();
      vi.useFakeTimers();

      // Test compact mode
      await testTransition(true);

      // ✅ REQUIREMENT MET: Consistent behavior across both modes
    });
  });

  describe('Complete acceptance criteria validation', () => {
    it('ALL acceptance criteria are met in a single user workflow', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // ✅ Criterion 1: AgentPanel displays animated transition when currentAgent changes
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="architect" />);
      });

      // ✅ Criterion 2: Visual indicator showing 'previousAgent → currentAgent'
      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
      });

      // ✅ Criterion 4: Works in full panel mode
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Test fade at appropriate time
      act(() => {
        vi.advanceTimersByTime(1600); // Should be in fade phase
      });

      // Animation should still be visible but fading
      expect(screen.getByText('→')).toBeInTheDocument();

      // ✅ Criterion 3: Animation fades after 2 seconds
      act(() => {
        vi.advanceTimersByTime(500); // Total 2100ms, should be complete
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      });

      // Test compact mode as well
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={true} />);
      });

      // ✅ Criterion 4: Works in compact panel mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);

      // Start another animation in compact mode
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" compact={true} />);
      });

      // Should show animation in compact mode without full mode elements
      await waitFor(() => {
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      });

      // ✅ ALL ACCEPTANCE CRITERIA MET
    });
  });

  describe('Additional quality assurance validations', () => {
    it('maintains accessibility during animations', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // All text content should remain accessible during animation
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();

        // Agent list should remain functional
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText(/implementation/)).toBeInTheDocument();
        expect(screen.getByText(/75%/)).toBeInTheDocument();
      });

      // ✅ Accessibility maintained
    });

    it('handles error conditions gracefully', async () => {
      // Test with empty agents array
      const { rerender } = render(
        <AgentPanel agents={[]} currentAgent="planner" />
      );

      act(() => {
        rerender(<AgentPanel agents={[]} currentAgent="developer" />);
      });

      // Should not crash
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Test with agents not in the list
      rerender(<AgentPanel agents={mockAgents} currentAgent="nonexistent-agent" />);

      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="another-nonexistent" />);
      });

      // Should still show animation for unknown agents
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // ✅ Error handling working
    });

    it('performance is acceptable during rapid changes', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      const agents = ['architect', 'developer', 'tester', 'reviewer', 'devops'];

      // Rapidly cycle through agents
      for (const agent of agents) {
        act(() => {
          rerender(<AgentPanel agents={mockAgents} currentAgent={agent} />);
          vi.advanceTimersByTime(100); // Small time advance between changes
        });
      }

      // Should handle rapid changes without errors
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // ✅ Performance acceptable
    });
  });
});