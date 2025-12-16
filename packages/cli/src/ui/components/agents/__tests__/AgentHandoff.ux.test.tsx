/**
 * User Experience and Advanced Animation Tests for Agent Handoff
 * Tests complex real-world scenarios and user interaction patterns
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import { HandoffIndicator } from '../HandoffIndicator';
import type { HandoffAnimationState } from '../../../hooks/useAgentHandoff.js';

describe('Agent Handoff UX Tests', () => {
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

  const mockAgentColors = {
    planner: 'magenta',
    architect: 'blue',
    developer: 'green',
    reviewer: 'yellow',
    tester: 'cyan',
    devops: 'red',
  };

  describe('real-world workflow scenarios', () => {
    it('handles typical development workflow progression', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Simulate progression through typical workflow: planner -> architect -> developer

      // Transition 1: planner to architect
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="architect" />);
      });

      await act(async () => {
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();

        // Let first animation complete
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Transition 2: architect to developer
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      await act(async () => {
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();

        // Let second animation complete
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('handles parallel agent execution scenario', () => {
      // Simulate scenario where multiple agents might be active
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'active', stage: 'coding' },
        { name: 'tester', status: 'active', stage: 'writing-tests' },
        { name: 'reviewer', status: 'active', stage: 'reviewing' },
      ];

      const { rerender } = render(
        <AgentPanel agents={parallelAgents} currentAgent="developer" />
      );

      // Switch focus between active agents
      act(() => {
        rerender(<AgentPanel agents={parallelAgents} currentAgent="tester" />);
      });

      // Should show transition animation
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // All agents should remain visible during transition
      expect(screen.getAllByText('developer')).toHaveLength(2); // One in list, one in animation
      expect(screen.getAllByText('tester')).toHaveLength(2);
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('handles error recovery workflow transitions', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Simulate error: developer -> reviewer (skipping normal flow)
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);
      });

      // Should still show smooth transition
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Back to developer for retry
      act(() => {
        vi.advanceTimersByTime(1000);
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Should start new animation
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('responsive design and layout', () => {
    it('adapts handoff animation to different terminal widths', () => {
      // Simulate narrow terminal in compact mode
      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={true}
        />
      );

      // Compact mode should work well in narrow spaces
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles very long agent names in animations', () => {
      const longNameAgents: AgentInfo[] = [
        { name: 'very-long-specialized-agent-name', status: 'active' },
        { name: 'another-extremely-verbose-agent-identifier', status: 'waiting' },
      ];

      const animationState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: 'very-long-specialized-agent-name',
        currentAgent: 'another-extremely-verbose-agent-identifier',
        progress: 0.5,
        isFading: false,
      };

      // Should handle long names gracefully in both modes
      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      expect(screen.getByText('very-long-specialized-agent-name')).toBeInTheDocument();
      expect(screen.getByText('another-extremely-verbose-agent-identifier')).toBeInTheDocument();

      const { rerender } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      expect(screen.getByText('very-long-specialized-agent-name')).toBeInTheDocument();
      expect(screen.getByText('another-extremely-verbose-agent-identifier')).toBeInTheDocument();
    });
  });

  describe('performance under realistic conditions', () => {
    it('handles busy development session with frequent handoffs', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Simulate busy session: 20 agent changes in quick succession
      const agentSequence = [
        'architect', 'planner', 'developer', 'reviewer', 'tester',
        'devops', 'developer', 'reviewer', 'tester', 'devops',
        'developer', 'tester', 'reviewer', 'developer', 'tester',
        'devops', 'reviewer', 'developer', 'tester', 'devops'
      ];

      for (const agent of agentSequence) {
        act(() => {
          rerender(<AgentPanel agents={mockAgents} currentAgent={agent} />);
          // Small delays to simulate real usage
          vi.advanceTimersByTime(100);
        });
      }

      // Should end with last agent transition
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();

      // Complete final animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('maintains smooth animation during high system load simulation', () => {
      const animationState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'tester',
        progress: 0.3,
        isFading: false,
      };

      // Render multiple instances to simulate load
      const instances = Array.from({ length: 10 }, (_, i) =>
        render(
          <HandoffIndicator
            key={i}
            animationState={animationState}
            agentColors={mockAgentColors}
            compact={i % 2 === 0}
          />
        )
      );

      // All instances should render successfully
      instances.forEach(instance => {
        expect(instance.container.textContent).toContain('developer');
        expect(instance.container.textContent).toContain('tester');
        expect(instance.container.textContent).toContain('→');
      });
    });
  });

  describe('visual feedback and timing', () => {
    it('provides appropriate visual feedback throughout animation lifecycle', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start transition
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="architect" />);
      });

      // Beginning of animation - should be bright/prominent
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();

      // Mid-animation - should maintain visibility
      act(() => {
        vi.advanceTimersByTime(1000); // 50% through
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Fade phase - should start dimming
      act(() => {
        vi.advanceTimersByTime(600); // 80% through (fade phase)
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // End of animation - should disappear
      act(() => {
        vi.advanceTimersByTime(400); // 100% complete
      });

      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('maintains consistent timing across different agent combinations', () => {
      const agentPairs = [
        ['planner', 'architect'],
        ['developer', 'tester'],
        ['reviewer', 'devops'],
      ];

      agentPairs.forEach(([from, to]) => {
        const { rerender, unmount } = render(
          <AgentPanel agents={mockAgents} currentAgent={from} />
        );

        const startTime = Date.now();

        act(() => {
          rerender(<AgentPanel agents={mockAgents} currentAgent={to} />);
        });

        // Animation should be visible
        expect(screen.getByText('→')).toBeInTheDocument();

        // Complete animation
        act(() => {
          vi.advanceTimersByTime(2000);
        });

        // Should complete in consistent time regardless of agent names
        expect(screen.queryByText('→')).not.toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('cross-mode consistency', () => {
    it('maintains consistent behavior between compact and full modes', () => {
      const animationState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.6,
        isFading: false,
      };

      // Test full mode
      const { rerender } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      // Core animation content should remain
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      // But full mode indicators should be gone
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
    });

    it('handles mode switching during live animation', async () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" compact={false} />
      );

      // Start animation in full mode
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={false} />);
      });

      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();

      // Switch to compact mode during animation
      act(() => {
        vi.advanceTimersByTime(500); // Partway through
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" compact={true} />);
      });

      // Should adapt to compact mode layout
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);

      // Animation should continue smoothly
      act(() => {
        vi.advanceTimersByTime(1500); // Complete remaining time
      });

      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });
  });

  describe('edge case user scenarios', () => {
    it('handles user rapidly switching between views during animation', () => {
      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="planner" />
      );

      // Start transition
      act(() => {
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Rapidly switch views (compact/full) multiple times
      for (let i = 0; i < 10; i++) {
        act(() => {
          vi.advanceTimersByTime(50);
          rerender(
            <AgentPanel
              agents={mockAgents}
              currentAgent="developer"
              compact={i % 2 === 0}
            />
          );
        });
      }

      // Should handle rapid changes gracefully
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('handles system with custom agent definitions', () => {
      const customAgents: AgentInfo[] = [
        { name: 'security-scanner', status: 'active', stage: 'scanning' },
        { name: 'performance-analyzer', status: 'waiting' },
        { name: 'ui-validator', status: 'idle' },
      ];

      const customColors = {
        'security-scanner': 'red',
        'performance-analyzer': 'yellow',
        'ui-validator': 'magenta',
      };

      const animationState: HandoffAnimationState = {
        isAnimating: true,
        previousAgent: 'security-scanner',
        currentAgent: 'performance-analyzer',
        progress: 0.4,
        isFading: false,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={customColors}
          compact={false}
        />
      );

      // Should handle custom agent names and colors
      expect(screen.getByText('security-scanner')).toBeInTheDocument();
      expect(screen.getByText('performance-analyzer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
    });
  });
});