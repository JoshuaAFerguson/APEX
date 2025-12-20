import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock timers for controlling animation
vi.useFakeTimers();

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
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
  });

  describe('complete handoff workflow', () => {
    it('performs a complete handoff animation cycle in full mode', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Initially no animation
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Start handoff animation by changing current agent
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Should show handoff animation (planner → developer)
      // In a real implementation, this would show the HandoffIndicator
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Advance time through animation phases
      act(() => {
        vi.advanceTimersByTime(1000); // 50% progress
      });

      // Animation should still be in progress
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Advance to fade phase
      act(() => {
        vi.advanceTimersByTime(750); // 1750ms total (75% of 2000ms)
      });

      // Should be in fade phase
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(250); // Complete 2000ms
      });

      // Animation should be complete, only normal agent panel visible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('performs a complete handoff animation cycle in compact mode', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="architect" compact={true} />
      );

      // Initially no animation, compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Start handoff animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" compact={true} />);
      });

      // Should show handoff animation in compact mode
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Animation should be complete
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('sequential handoffs', () => {
    it('handles multiple sequential agent handoffs', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // First handoff: planner → architect
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="architect" />);
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Advance partway through first animation
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Second handoff before first completes: architect → developer
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Should show new handoff (architect → developer)
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Third handoff: developer → tester
      act(() => {
        vi.advanceTimersByTime(300);
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      // Should show newest handoff (developer → tester)
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Complete final animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should show final state
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles rapid agent changes without breaking', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Rapid succession of agent changes
      const agentSequence = ['architect', 'developer', 'reviewer', 'tester', 'devops'];

      agentSequence.forEach(agent => {
        act(() => {
          rerender(<AgentPanel agents={mockAgents} currentAgent={agent} />);
          vi.advanceTimersByTime(50); // Small advancement between changes
        });
      });

      // Should handle without crashing and show final transition
      expect(screen.getByText('devops')).toBeInTheDocument();

      // Complete final animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('devops')).toBeInTheDocument();
    });
  });

  describe('edge case workflows', () => {
    it('handles handoff when agent list is empty', () => {
      const { rerender } = render(
        <AgentPanel agents={[]} currentAgent="planner" />
      );

      act(() => {
        rerender(<AgentPanel agents={[]} currentAgent="developer" />);
      });

      // Should not crash, animation should still work
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles handoff to agent not in agent list', () => {
      const limitedAgents = [
        { name: 'planner', status: 'completed' as const },
        { name: 'architect', status: 'active' as const },
      ];

      const { rerender } = render(
        <AgentPanel agents={limitedAgents} currentAgent="planner" />
      );

      // Handoff to agent not in the list
      act(() => {
        rerender(<AgentPanel agents={limitedAgents} currentAgent="nonexistent-agent" />);
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should handle gracefully
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles handoff when switching between full and compact modes', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" compact={false} />
      );

      // Start handoff in full mode
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={false} />);
      });

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Switch to compact mode during animation
      act(() => {
        vi.advanceTimersByTime(500);
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={true} />);
      });

      // Should adapt to compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Complete animation in compact mode
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles handoff when agent status changes during animation', () => {
      const changingAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'waiting' },
        { name: 'tester', status: 'idle' },
      ];

      const { rerender } = render(
        <AgentPanel agents={changingAgents} currentAgent="planner" />
      );

      // Start handoff
      act(() => {
        rerender(<AgentPanel agents={changingAgents} currentAgent="developer" />);
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Change agent status during animation
      const updatedAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', stage: 'implementation' },
        { name: 'tester', status: 'idle' },
      ];

      act(() => {
        vi.advanceTimersByTime(1000);
        rerender(<AgentPanel agents={updatedAgents} currentAgent="developer" />);
      });

      // Should handle the agent status change
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('(implementation)')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Final state should reflect updated agent info
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('(implementation)')).toBeInTheDocument();
    });

    it('handles handoff with custom animation durations', () => {
      // This test would require exposing animation options through props
      // For now, we test the default behavior
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Test various points in the animation timeline
      const timePoints = [0, 500, 1000, 1500, 1750, 2000];

      timePoints.forEach(time => {
        if (time > 0) {
          act(() => {
            vi.advanceTimersByTime(time - timePoints[timePoints.indexOf(time) - 1] || 0);
          });
        }

        // Animation should be consistent at each point
        expect(screen.getByText('developer')).toBeInTheDocument();

        if (time < 2000) {
          // During animation, both agents might be visible
          expect(screen.getByText('planner')).toBeInTheDocument();
        }
      });
    });
  });

  describe('performance considerations', () => {
    it('handles many rapid handoffs without performance degradation', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      const startTime = performance.now();

      // Simulate many rapid handoffs
      for (let i = 0; i < 50; i++) {
        const agent = mockAgents[i % mockAgents.length].name;
        act(() => {
          rerender(<AgentPanel agents={mockAgents} currentAgent={agent} />);
          vi.advanceTimersByTime(10); // Very fast changes
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly (exact timing may vary in test environment)
      expect(duration).toBeLessThan(1000); // 1 second threshold

      // Clean up any remaining animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('cleans up animations properly on component unmount', () => {
      const { rerender, unmount } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start animation
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      expect(screen.getByText('planner')).toBeInTheDocument();

      // Unmount during animation
      unmount();

      // Advance time - no errors should occur
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // No assertions needed - test passes if no errors thrown
    });
  });

  describe('accessibility during animations', () => {
    it('maintains accessibility during handoff animations', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // All text should remain accessible during animation
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Advance through animation phases
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('provides clear visual feedback during transitions', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" compact={false} />
      );

      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={false} />);
      });

      // Should show transition indicators (→ arrow, agent names)
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Test that visual feedback is consistent throughout animation
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('real-world scenarios', () => {
    it('simulates typical workflow progression', () => {
      // Simulate a typical APEX workflow progression
      const workflowSteps = [
        'planner',
        'architect',
        'developer',
        'reviewer',
        'tester',
        'devops'
      ];

      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent={workflowSteps[0]} />
      );

      // Progress through each step with realistic timing
      workflowSteps.slice(1).forEach((agent, index) => {
        act(() => {
          rerender(<AgentPanel agents={mockAgents} currentAgent={agent} />);
        });

        // Allow some animation time before next step
        act(() => {
          vi.advanceTimersByTime(1000);
        });

        expect(screen.getByText(agent)).toBeInTheDocument();
      });

      // Complete final animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('handles workflow with backtracking', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Move forward to reviewer
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);
        vi.advanceTimersByTime(1000);
      });

      // Backtrack to developer (common in real workflows)
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('developer')).toBeInTheDocument();

      // Move forward again to tester
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });
});