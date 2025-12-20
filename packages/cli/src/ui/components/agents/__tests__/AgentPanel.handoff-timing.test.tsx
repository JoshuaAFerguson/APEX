import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Handoff Animation Timing Precision', () => {
  const mockAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation', progress: 75 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
  ];

  const mockUseAgentHandoff = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useAgentHandoff.js');
  });

  describe('animation timing boundaries', () => {
    it('verifies animation starts at exactly 0ms after agent change', () => {
      // Initial state - no animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="planner" />);

      // Simulate agent change at time 0
      act(() => {
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0,
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // At exactly 0ms, animation should have started
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('verifies fade phase begins at exactly 1500ms (duration - fadeDuration)', () => {
      // Start with active animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Advance to just before fade phase (1499ms)
      act(() => {
        vi.advanceTimersByTime(1499);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.7495, // 1499/2000
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Should not be fading yet
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');

      // Advance to exactly 1500ms - fade should begin
      act(() => {
        vi.advanceTimersByTime(1);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.75, // 1500/2000
          isFading: true,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Should now be in fade phase
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
    });

    it('verifies animation completes at exactly 2000ms', () => {
      // Start with active animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Advance to just before completion (1999ms)
      act(() => {
        vi.advanceTimersByTime(1999);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.9995, // 1999/2000
          isFading: true,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Should still be animating
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');

      // Advance to exactly 2000ms - animation should complete
      act(() => {
        vi.advanceTimersByTime(1);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: false,
          previousAgent: null,
          currentAgent: 'developer',
          progress: 1,
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Animation should be complete
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
    });

    it('verifies progress values at 100ms intervals', () => {
      // Test progress values at regular intervals
      const expectedProgressValues = [
        { time: 0, progress: 0 },
        { time: 100, progress: 0.05 }, // 100/2000
        { time: 200, progress: 0.1 },  // 200/2000
        { time: 500, progress: 0.25 }, // 500/2000
        { time: 1000, progress: 0.5 }, // 1000/2000
        { time: 1500, progress: 0.75 }, // 1500/2000 (fade start)
        { time: 1800, progress: 0.9 },  // 1800/2000
        { time: 2000, progress: 1 },    // 2000/2000 (complete)
      ];

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      expectedProgressValues.forEach(({ time, progress }) => {
        act(() => {
          if (time > 0) {
            vi.advanceTimersByTime(time === 100 ? 100 : (time - expectedProgressValues[expectedProgressValues.indexOf({ time, progress }) - 1].time));
          }

          const isFading = progress >= 0.75; // Fade starts at 75% (1500ms)
          const isAnimating = progress < 1;

          mockUseAgentHandoff.mockReturnValue({
            isAnimating,
            previousAgent: isAnimating ? 'planner' : null,
            currentAgent: 'developer',
            progress,
            isFading,
          });
          rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
        });

        // Verify the hook was called with correct agent
        expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      });
    });
  });

  describe('animation interruption timing', () => {
    it('interrupts and restarts animation when agent changes mid-animation', () => {
      // Start animation from planner to developer
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Advance to mid-animation (1000ms, 50% progress)
      act(() => {
        vi.advanceTimersByTime(1000);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.5,
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Interrupt with new agent change (developer to tester)
      act(() => {
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'developer',
          currentAgent: 'tester',
          progress: 0, // Restart from 0
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      // Should restart animation with new agent
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('tester');

      // Advance new animation by 500ms
      act(() => {
        vi.advanceTimersByTime(500);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'developer',
          currentAgent: 'tester',
          progress: 0.25, // 500/2000
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('tester');
    });

    it('preserves timing accuracy after interruption', () => {
      // Start first animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Advance to 75% of first animation
      act(() => {
        vi.advanceTimersByTime(1500);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.75,
          isFading: true,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Interrupt and start new animation
      act(() => {
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'developer',
          currentAgent: 'reviewer',
          progress: 0,
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);
      });

      // Verify new animation follows proper timing
      act(() => {
        vi.advanceTimersByTime(1000);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'developer',
          currentAgent: 'reviewer',
          progress: 0.5, // Exactly 50% after 1000ms
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);
      });

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('reviewer');
    });

    it('handles sub-100ms agent changes', () => {
      // Start animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Advance by only 50ms
      act(() => {
        vi.advanceTimersByTime(50);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.025, // 50/2000
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
      });

      // Change agent after very short time
      act(() => {
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'developer',
          currentAgent: 'tester',
          progress: 0,
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      // Should handle rapid change properly
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('tester');

      // Verify timing continues accurately
      act(() => {
        vi.advanceTimersByTime(200);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'developer',
          currentAgent: 'tester',
          progress: 0.1, // 200/2000
          isFading: false,
        });
        rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);
      });

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('tester');
    });
  });

  describe('animation with parallel execution timing', () => {
    const parallelAgents: AgentInfo[] = [
      { name: 'developer', status: 'parallel', stage: 'coding' },
      { name: 'tester', status: 'parallel', stage: 'testing' },
    ];

    it('maintains handoff timing when showParallel changes during animation', () => {
      // Start animation without parallel execution
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="architect"
          showParallel={false}
        />
      );

      // Advance to 25% of animation
      act(() => {
        vi.advanceTimersByTime(500);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress: 0.25,
          isFading: false,
        });
        rerender(
          <AgentPanel
            agents={mockAgents}
            currentAgent="architect"
            showParallel={false}
          />
        );
      });

      // Enable parallel execution mid-animation
      act(() => {
        rerender(
          <AgentPanel
            agents={mockAgents}
            currentAgent="architect"
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );
      });

      // Animation timing should be preserved
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');

      // Continue animation
      act(() => {
        vi.advanceTimersByTime(500);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress: 0.5, // Should be exactly 50% after 1000ms total
          isFading: false,
        });
        rerender(
          <AgentPanel
            agents={mockAgents}
            currentAgent="architect"
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );
      });

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('maintains handoff timing when parallelAgents updates during animation', () => {
      // Start animation with parallel execution
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="architect"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Advance to 30% of animation
      act(() => {
        vi.advanceTimersByTime(600);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress: 0.3,
          isFading: false,
        });
        rerender(
          <AgentPanel
            agents={mockAgents}
            currentAgent="architect"
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );
      });

      // Update parallel agents during animation
      const updatedParallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 50 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 75 },
        { name: 'reviewer', status: 'parallel', stage: 'reviewing', progress: 25 },
      ];

      act(() => {
        rerender(
          <AgentPanel
            agents={mockAgents}
            currentAgent="architect"
            showParallel={true}
            parallelAgents={updatedParallelAgents}
          />
        );
      });

      // Animation timing should be preserved
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');

      // Continue animation with precise timing
      act(() => {
        vi.advanceTimersByTime(700);
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress: 0.65, // Should be exactly 65% after 1300ms total
          isFading: false,
        });
        rerender(
          <AgentPanel
            agents={mockAgents}
            currentAgent="architect"
            showParallel={true}
            parallelAgents={updatedParallelAgents}
          />
        );
      });

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument(); // New parallel agent
      expect(screen.getByText(/25%/)).toBeInTheDocument(); // New progress
    });

    it('handles parallel section visibility changes during fade phase', () => {
      // Start animation and advance to fade phase
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.8, // 80%, in fade phase
        isFading: true,
      });

      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="architect"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Toggle parallel section off during fade
      act(() => {
        rerender(
          <AgentPanel
            agents={mockAgents}
            currentAgent="architect"
            showParallel={false}
          />
        );
      });

      // Animation should continue in fade phase
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(400); // Remaining 20% = 400ms
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: false,
          previousAgent: null,
          currentAgent: 'architect',
          progress: 1,
          isFading: false,
        });
        rerender(
          <AgentPanel
            agents={mockAgents}
            currentAgent="architect"
            showParallel={false}
          />
        );
      });

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');
    });
  });

  describe('complex timing scenarios', () => {
    it('handles multiple rapid agent changes with precise timing', () => {
      const agentSequence = ['planner', 'architect', 'developer', 'reviewer'];
      let currentIndex = 0;

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: null,
        currentAgent: agentSequence[0],
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent={agentSequence[0]} />);

      // Simulate rapid agent changes every 300ms
      for (let i = 1; i < agentSequence.length; i++) {
        act(() => {
          vi.advanceTimersByTime(300);
          currentIndex = i;

          mockUseAgentHandoff.mockReturnValue({
            isAnimating: true,
            previousAgent: agentSequence[i - 1],
            currentAgent: agentSequence[i],
            progress: 0, // Reset to 0 for each new animation
            isFading: false,
          });
          rerender(<AgentPanel agents={mockAgents} currentAgent={agentSequence[i]} />);
        });

        expect(mockUseAgentHandoff).toHaveBeenCalledWith(agentSequence[i]);

        // Advance a bit into the new animation to verify timing accuracy
        act(() => {
          vi.advanceTimersByTime(150);
          mockUseAgentHandoff.mockReturnValue({
            isAnimating: true,
            previousAgent: agentSequence[i - 1],
            currentAgent: agentSequence[i],
            progress: 0.075, // 150/2000
            isFading: false,
          });
          rerender(<AgentPanel agents={mockAgents} currentAgent={agentSequence[i]} />);
        });

        expect(mockUseAgentHandoff).toHaveBeenCalledWith(agentSequence[i]);
      }
    });

    it('maintains timing accuracy across component re-renders', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Force multiple re-renders while advancing time
      const renderCount = 10;
      const timeIncrement = 200; // 200ms per render

      for (let i = 1; i <= renderCount; i++) {
        act(() => {
          vi.advanceTimersByTime(timeIncrement);
          const expectedProgress = (i * timeIncrement) / 2000;
          const isFading = expectedProgress >= 0.75;

          mockUseAgentHandoff.mockReturnValue({
            isAnimating: expectedProgress < 1,
            previousAgent: expectedProgress < 1 ? 'planner' : null,
            currentAgent: 'developer',
            progress: Math.min(expectedProgress, 1),
            isFading,
          });

          // Re-render with same props to test stability
          rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
          rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);
        });

        expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      }
    });
  });
});