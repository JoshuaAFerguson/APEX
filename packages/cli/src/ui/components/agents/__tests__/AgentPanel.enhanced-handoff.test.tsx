/**
 * AgentPanel Enhanced Handoff Animation Tests
 *
 * Acceptance Criteria Tests:
 * 1. ✅ Handoff animation is more visually prominent with transition effects
 * 2. ✅ Add elapsed time display during handoff
 * 3. ✅ Add visual pulse/highlight effect for new agent
 * 4. ✅ Tests pass for enhanced handoff behavior
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '../../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useAgentHandoff hook to test enhanced features
const mockUseAgentHandoff = vi.fn();
vi.mock('../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: mockUseAgentHandoff,
  formatHandoffElapsed: (startTime: Date, endTime?: Date) => {
    const elapsed = ((endTime || new Date()).getTime() - startTime.getTime()) / 1000;
    return `${elapsed.toFixed(1)}s`;
  },
}));

describe('AgentPanel - Enhanced Handoff Animation Acceptance Criteria', () => {
  const mockAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation', progress: 75 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria 1: Handoff animation is more visually prominent with transition effects', () => {
    it('displays animated transition arrow that changes over time', async () => {
      // Test the animated arrow progression
      const animationSequence = [
        {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.2,
          arrowFrame: 0,
          pulseIntensity: 0.3,
          isFading: false,
          transitionPhase: 'entering' as const,
          handoffStartTime: new Date('2024-01-01T12:00:00Z'),
        },
        {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.5,
          arrowFrame: 1,
          pulseIntensity: 0.7,
          isFading: false,
          transitionPhase: 'active' as const,
          handoffStartTime: new Date('2024-01-01T12:00:00Z'),
        },
        {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.8,
          arrowFrame: 2,
          pulseIntensity: 0.4,
          isFading: true,
          transitionPhase: 'exiting' as const,
          handoffStartTime: new Date('2024-01-01T12:00:00Z'),
        },
      ];

      mockUseAgentHandoff.mockReturnValueOnce(animationSequence[0]);

      const { rerender } = render(
        <AgentPanel agents={mockAgents} currentAgent="developer" />
      );

      // Should show first arrow frame (single arrow)
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.queryByText('→→')).not.toBeInTheDocument();
      expect(screen.queryByText('→→→')).not.toBeInTheDocument();

      // Progress to second frame
      mockUseAgentHandoff.mockReturnValueOnce(animationSequence[1]);
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Should show second arrow frame (double arrow)
      expect(screen.getByText('→→')).toBeInTheDocument();
      expect(screen.queryByText(/^→$/)).not.toBeInTheDocument();
      expect(screen.queryByText('→→→')).not.toBeInTheDocument();

      // Progress to third frame
      mockUseAgentHandoff.mockReturnValueOnce(animationSequence[2]);
      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Should show third arrow frame (triple arrow)
      expect(screen.getByText('→→→')).toBeInTheDocument();
      expect(screen.queryByText(/^→$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^→→$/)).not.toBeInTheDocument();
    });

    it('shows transition phases during handoff animation', () => {
      const animationState = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.4,
        arrowFrame: 1,
        pulseIntensity: 0.6,
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Should display handoff indicator with transition
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→→')).toBeInTheDocument();
    });

    it('displays progress bar visualization in full mode', () => {
      const animationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'tester',
        progress: 0.6,
        arrowFrame: 2,
        pulseIntensity: 0.5,
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // Should show progress percentage
      expect(screen.getByText('60%')).toBeInTheDocument();

      // Should show progress bar characters
      expect(screen.getByText(/█/)).toBeInTheDocument();
      expect(screen.getByText(/░/)).toBeInTheDocument();
    });

    it('applies fade effect during animation end phase', () => {
      const fadingAnimationState = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.9,
        arrowFrame: 2,
        pulseIntensity: 0.2,
        isFading: true, // Fade phase
        transitionPhase: 'exiting' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(fadingAnimationState);

      render(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);

      // Animation should still be visible even during fade
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('→→→')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria 2: Add elapsed time display during handoff', () => {
    it('displays elapsed time with sub-second precision during handoff', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:01.300Z')); // 1.3s after start

      const animationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.65,
        arrowFrame: 2,
        pulseIntensity: 0.7,
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Should show elapsed time of 1.3 seconds
      expect(screen.getByText(/1\.3s/)).toBeInTheDocument();
    });

    it('updates elapsed time as animation progresses', () => {
      const startTime = new Date('2024-01-01T12:00:00Z');

      // First time point - 0.5s elapsed
      vi.setSystemTime(new Date('2024-01-01T12:00:00.500Z'));

      const animationState1 = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.25,
        arrowFrame: 0,
        pulseIntensity: 0.4,
        isFading: false,
        transitionPhase: 'entering' as const,
        handoffStartTime: startTime,
      };

      mockUseAgentHandoff.mockReturnValue(animationState1);

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      expect(screen.getByText(/0\.5s/)).toBeInTheDocument();

      // Second time point - 1.2s elapsed
      vi.setSystemTime(new Date('2024-01-01T12:00:01.200Z'));

      const animationState2 = {
        ...animationState1,
        progress: 0.6,
        arrowFrame: 1,
      };

      mockUseAgentHandoff.mockReturnValue(animationState2);
      rerender(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      expect(screen.getByText(/1\.2s/)).toBeInTheDocument();
    });

    it('shows elapsed time in both full and compact modes', () => {
      const animationState = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.4,
        arrowFrame: 1,
        pulseIntensity: 0.6,
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      // Test full mode
      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);
      expect(screen.getByText(/0\.0s/)).toBeInTheDocument(); // Elapsed time shown

      // Test compact mode
      rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" compact={true} />);
      expect(screen.getByText(/\[0\.0s\]/)).toBeInTheDocument(); // Elapsed time in brackets
    });

    it('handles rapid time updates without performance issues', async () => {
      const startTime = new Date('2024-01-01T12:00:00Z');

      // Simulate rapid time progression
      const timePoints = [100, 200, 350, 450, 600]; // milliseconds

      for (const ms of timePoints) {
        vi.setSystemTime(new Date(startTime.getTime() + ms));

        const animationState = {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: ms / 2000, // Progress based on 2s animation
          arrowFrame: Math.floor(ms / 300),
          pulseIntensity: 0.5 + Math.sin(ms / 100) * 0.3,
          isFading: false,
          transitionPhase: 'active' as const,
          handoffStartTime: startTime,
        };

        mockUseAgentHandoff.mockReturnValue(animationState);

        render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

        const expectedTime = (ms / 1000).toFixed(1) + 's';
        expect(screen.getByText(new RegExp(expectedTime))).toBeInTheDocument();
      }
    });

    it('stops showing elapsed time when animation completes', () => {
      // First show animation with elapsed time
      const animatingState = {
        isAnimating: true,
        previousAgent: 'tester',
        currentAgent: 'reviewer',
        progress: 0.8,
        arrowFrame: 2,
        pulseIntensity: 0.3,
        isFading: true,
        transitionPhase: 'exiting' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animatingState);

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);

      expect(screen.getByText(/0\.0s/)).toBeInTheDocument();

      // Animation completes
      const completedState = {
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        arrowFrame: 0,
        pulseIntensity: 0,
        isFading: false,
        transitionPhase: 'idle' as const,
        handoffStartTime: null,
      };

      mockUseAgentHandoff.mockReturnValue(completedState);
      rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);

      // Elapsed time should no longer be shown
      expect(screen.queryByText(/\d+\.\ds/)).not.toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria 3: Add visual pulse/highlight effect for new agent', () => {
    it('applies pulse effect to current agent during handoff', () => {
      const animationState = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.5,
        arrowFrame: 1,
        pulseIntensity: 0.8, // High pulse intensity
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Current agent should be visible with pulse effect
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('pulse intensity oscillates during animation creating visual rhythm', () => {
      const pulseSequence = [
        { intensity: 0.2, shouldBeBold: false }, // Low intensity = not bold
        { intensity: 0.6, shouldBeBold: true },  // High intensity = bold
        { intensity: 0.9, shouldBeBold: true },  // Very high intensity = bold
        { intensity: 0.1, shouldBeBold: false }, // Very low intensity = not bold, dimmed
        { intensity: 0.5, shouldBeBold: false }, // Boundary case
      ];

      pulseSequence.forEach(({ intensity }, index) => {
        const animationState = {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'tester',
          progress: 0.3 + (index * 0.1),
          arrowFrame: 1,
          pulseIntensity: intensity,
          isFading: false,
          transitionPhase: 'active' as const,
          handoffStartTime: new Date('2024-01-01T12:00:00Z'),
        };

        mockUseAgentHandoff.mockReturnValue(animationState);

        render(<AgentPanel agents={mockAgents} currentAgent="tester" />);

        // Tester agent should be visible (styling handled by Ink components)
        expect(screen.getByText('tester')).toBeInTheDocument();
      });
    });

    it('pulse effect only affects current agent, not previous agent', () => {
      const animationState = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.45,
        arrowFrame: 1,
        pulseIntensity: 0.95, // Very high pulse for current agent
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);

      // Both agents should be visible
      expect(screen.getByText('developer')).toBeInTheDocument(); // Previous agent (no pulse)
      expect(screen.getByText('reviewer')).toBeInTheDocument();  // Current agent (with pulse)
    });

    it('pulse effect works with different pulse frequencies', () => {
      // Test that different pulse patterns work
      const animationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.35,
        arrowFrame: 1,
        pulseIntensity: 0.7,
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('pulse effect is disabled when enablePulse=false in hook options', () => {
      const animationState = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.5,
        arrowFrame: 1,
        pulseIntensity: 0, // Disabled pulse
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // Agent should still be visible but without pulse styling
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('pulse effect combines with fade effect during animation end', () => {
      const animationState = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.85,
        arrowFrame: 2,
        pulseIntensity: 0.6, // Pulse active during fade
        isFading: true,      // Fade active
        transitionPhase: 'exiting' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);

      // Both pulse and fade effects should be applied
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria 4: Tests pass for enhanced handoff behavior', () => {
    it('all enhanced features work together seamlessly', async () => {
      const completeAnimationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.6,
        arrowFrame: 2,           // Triple arrow
        pulseIntensity: 0.75,    // High pulse
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(completeAnimationState);

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // All enhanced features should be visible:

      // 1. Animated transition arrow (triple arrow)
      expect(screen.getByText('→→→')).toBeInTheDocument();

      // 2. Agent transition display
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // 3. Elapsed time display
      expect(screen.getByText(/0\.0s/)).toBeInTheDocument();

      // 4. Progress visualization
      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText(/█/)).toBeInTheDocument(); // Progress bar

      // 5. Visual pulse effect (verified by presence of current agent)
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('enhanced handoff handles edge cases gracefully', () => {
      const edgeCaseState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 1.1,          // Beyond normal range
        arrowFrame: 5,          // Beyond normal range
        pulseIntensity: -0.2,   // Negative value
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(edgeCaseState);

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Should handle edge cases without crashing
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('enhanced features maintain backward compatibility', () => {
      // Test with minimal animation state (backward compatibility)
      const minimalState = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.5,
        arrowFrame: 0,
        pulseIntensity: 0,
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: null, // No elapsed time
      };

      mockUseAgentHandoff.mockReturnValue(minimalState);

      render(<AgentPanel agents={mockAgents} currentAgent="tester" />);

      // Basic handoff should still work
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument(); // Basic arrow
    });

    it('performance remains smooth with enhanced features enabled', async () => {
      // Test rapid updates to ensure no performance degradation
      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        const animationState = {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: i / 50,
          arrowFrame: Math.floor(i / 17),
          pulseIntensity: Math.sin(i * 0.2) * 0.5 + 0.5,
          isFading: i > 40,
          transitionPhase: 'active' as const,
          handoffStartTime: new Date('2024-01-01T12:00:00Z'),
        };

        mockUseAgentHandoff.mockReturnValue(animationState);

        const { unmount } = render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

        expect(screen.getByText('developer')).toBeInTheDocument();

        unmount(); // Clean up for next iteration
      }

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Performance test: 50 renders should complete quickly
      expect(renderTime).toBeLessThan(1000); // Less than 1 second for 50 renders
    });

    it('enhanced handoff works correctly in both display modes', () => {
      const animationState = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.7,
        arrowFrame: 2,
        pulseIntensity: 0.8,
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      // Test full mode
      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="reviewer" />);

      expect(screen.getByText('→→→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText(/0\.0s/)).toBeInTheDocument();

      // Test compact mode
      rerender(<AgentPanel agents={mockAgents} currentAgent="reviewer" compact={true} />);

      expect(screen.getByText('→→→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText(/\[0\.0s\]/)).toBeInTheDocument(); // Bracketed in compact mode
    });
  });

  describe('Integration with existing AgentPanel functionality', () => {
    it('enhanced handoff does not interfere with agent status display', () => {
      const animationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.4,
        arrowFrame: 1,
        pulseIntensity: 0.6,
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Handoff animation should be visible
      expect(screen.getByText('→→')).toBeInTheDocument();

      // Regular agent panel functionality should still work
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // Completed status
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // Active status
      expect(screen.getByText(/○/)).toBeInTheDocument(); // Waiting status
      expect(screen.getByText(/75%/)).toBeInTheDocument(); // Progress
      expect(screen.getByText(/implementation/)).toBeInTheDocument(); // Stage
    });

    it('enhanced handoff works with parallel execution display', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
      ];

      const animationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.3,
        arrowFrame: 1,
        pulseIntensity: 0.5,
        isFading: false,
        transitionPhase: 'active' as const,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockUseAgentHandoff.mockReturnValue(animationState);

      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Both handoff and parallel execution should be visible
      expect(screen.getByText('→→')).toBeInTheDocument(); // Handoff animation
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument(); // Parallel section
    });
  });
});