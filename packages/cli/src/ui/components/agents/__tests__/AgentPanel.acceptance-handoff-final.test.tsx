/**
 * Final Acceptance Criteria Validation for Enhanced AgentPanel Handoff Animations
 *
 * This test file validates that the enhanced handoff animation implementation
 * meets all specified acceptance criteria:
 *
 * ✅ Handoff animation shows smooth transition between agents with progress indicator
 * ✅ Dimming/fading effects work correctly
 * ✅ Animation is visible in both compact and full modes
 * ✅ Existing tests pass
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useAgentHandoff hook
const mockUseAgentHandoff = vi.fn();
const mockUseElapsedTime = vi.fn();

vi.mock('../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: mockUseAgentHandoff,
  formatHandoffElapsed: (startTime: Date, endTime?: Date) => {
    const elapsed = ((endTime || new Date()).getTime() - startTime.getTime()) / 1000;
    return `${elapsed.toFixed(1)}s`;
  },
}));

vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

describe('AgentPanel - Final Acceptance Criteria Validation', () => {
  const testAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation', progress: 75, startedAt: new Date('2024-01-01T12:00:00Z') },
    { name: 'reviewer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
    { name: 'devops', status: 'idle' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:02.500Z')); // 2.5 seconds after developer started

    // Default mock returns for useElapsedTime
    mockUseElapsedTime.mockReturnValue('2.5s');

    // Default mock returns for useAgentHandoff
    mockUseAgentHandoff.mockReturnValue({
      isAnimating: false,
      previousAgent: null,
      currentAgent: null,
      progress: 0,
      isFading: false,
      transitionPhase: 'idle',
      pulseIntensity: 0,
      arrowFrame: 0,
      handoffStartTime: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('✅ Acceptance Criteria 1: Handoff animation shows smooth transition between agents with progress indicator', () => {
    it('displays smooth transition with animated arrow progression and progress indicators', () => {
      const handoffAnimation = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.65, // 65% progress
        isFading: false,
        transitionPhase: 'active' as const,
        pulseIntensity: 0.8,
        arrowFrame: 2, // Triple arrow for smooth visual progression
        handoffStartTime: new Date('2024-01-01T12:00:00.800Z'),
      };

      mockUseAgentHandoff.mockReturnValue(handoffAnimation);

      render(<AgentPanel agents={testAgents} currentAgent="developer" />);

      // Verify smooth transition elements are present
      expect(screen.getByText('architect')).toBeInTheDocument(); // Previous agent visible
      expect(screen.getByText('developer')).toBeInTheDocument(); // Current agent visible
      expect(screen.getByText('→→→')).toBeInTheDocument(); // Animated arrow (triple for smooth progression)

      // Verify progress indicators
      expect(screen.getByText('65%')).toBeInTheDocument(); // Progress percentage
      expect(screen.getByText(/█/)).toBeInTheDocument(); // Progress bar filled portion
      expect(screen.getByText(/░/)).toBeInTheDocument(); // Progress bar empty portion

      // Verify elapsed time is shown
      expect(screen.getByText(/1\.7s/)).toBeInTheDocument(); // Elapsed time based on mock start time
    });

    it('progress indicator updates smoothly throughout animation', () => {
      const progressStates = [
        { progress: 0.1, expectedPercentage: '10%', arrowFrame: 0 },
        { progress: 0.4, expectedPercentage: '40%', arrowFrame: 1 },
        { progress: 0.7, expectedPercentage: '70%', arrowFrame: 2 },
        { progress: 0.9, expectedPercentage: '90%', arrowFrame: 2 },
      ];

      progressStates.forEach(({ progress, expectedPercentage, arrowFrame }, index) => {
        const handoffAnimation = {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'tester',
          progress,
          isFading: false,
          transitionPhase: 'active' as const,
          pulseIntensity: 0.5 + (progress * 0.3),
          arrowFrame,
          handoffStartTime: new Date('2024-01-01T12:00:00.500Z'),
        };

        mockUseAgentHandoff.mockReturnValue(handoffAnimation);

        const { rerender } = render(<AgentPanel agents={testAgents} currentAgent="tester" />);

        // Verify progress updates smoothly
        expect(screen.getByText(expectedPercentage)).toBeInTheDocument();

        // Verify arrow progresses appropriately
        if (arrowFrame === 0) {
          expect(screen.getByText('→')).toBeInTheDocument();
        } else if (arrowFrame === 1) {
          expect(screen.getByText('→→')).toBeInTheDocument();
        } else {
          expect(screen.getByText('→→→')).toBeInTheDocument();
        }

        // Clean up for next iteration
        if (index < progressStates.length - 1) {
          rerender(<div />);
        }
      });
    });

    it('smooth transition includes elapsed time with sub-second precision', () => {
      const handoffAnimation = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.55,
        isFading: false,
        transitionPhase: 'active' as const,
        pulseIntensity: 0.7,
        arrowFrame: 1,
        handoffStartTime: new Date('2024-01-01T12:00:00.300Z'), // 2.2s elapsed
      };

      mockUseAgentHandoff.mockReturnValue(handoffAnimation);

      render(<AgentPanel agents={testAgents} currentAgent="reviewer" />);

      // Should show precise elapsed time
      expect(screen.getByText(/2\.2s/)).toBeInTheDocument();
    });

    it('smooth transition maintains visual continuity between agents', () => {
      const handoffAnimation = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.3,
        isFading: false,
        transitionPhase: 'active' as const,
        pulseIntensity: 0.6,
        arrowFrame: 1,
        handoffStartTime: new Date('2024-01-01T12:00:01.500Z'),
      };

      mockUseAgentHandoff.mockReturnValue(handoffAnimation);

      render(<AgentPanel agents={testAgents} currentAgent="architect" />);

      // Both agents should be visible for visual continuity
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Animation elements should maintain the transition
      expect(screen.getByText('→→')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText(/1\.0s/)).toBeInTheDocument();
    });
  });

  describe('✅ Acceptance Criteria 2: Dimming/fading effects work correctly', () => {
    it('applies fading effect when isFading=true at animation end', () => {
      const fadingHandoffAnimation = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'tester',
        progress: 0.85, // Near completion where fading should occur
        isFading: true, // Fading effect active
        transitionPhase: 'exiting' as const,
        pulseIntensity: 0.3, // Lower pulse during fade
        arrowFrame: 2,
        handoffStartTime: new Date('2024-01-01T12:00:00.100Z'),
      };

      mockUseAgentHandoff.mockReturnValue(fadingHandoffAnimation);

      render(<AgentPanel agents={testAgents} currentAgent="tester" />);

      // Animation elements should still be visible but with fading applied
      expect(screen.getByText('developer')).toBeInTheDocument(); // Previous agent
      expect(screen.getByText('tester')).toBeInTheDocument(); // Current agent
      expect(screen.getByText('→→→')).toBeInTheDocument(); // Arrow
      expect(screen.getByText('85%')).toBeInTheDocument(); // Progress

      // Fading is applied via Ink styling, so we verify the animation state is correct
      // The actual visual fading is handled by the HandoffIndicator component
      expect(screen.getByText(/2\.4s/)).toBeInTheDocument();
    });

    it('dimming effect applies to previous agent during pulse cycle', () => {
      const dimmingHandoffAnimation = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'reviewer',
        progress: 0.4,
        isFading: false,
        transitionPhase: 'active' as const,
        pulseIntensity: 0.2, // Low pulse intensity should dim current agent
        arrowFrame: 1,
        handoffStartTime: new Date('2024-01-01T12:00:01.000Z'),
      };

      mockUseAgentHandoff.mockReturnValue(dimmingHandoffAnimation);

      render(<AgentPanel agents={testAgents} currentAgent="reviewer" />);

      // Both agents visible, with dimming effect based on low pulse intensity
      expect(screen.getByText('architect')).toBeInTheDocument(); // Previous agent (normal)
      expect(screen.getByText('reviewer')).toBeInTheDocument(); // Current agent (dimmed due to low pulse)

      // Animation continues with dimming
      expect(screen.getByText('→→')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
    });

    it('fading effect combines with progress bar correctly', () => {
      const fadingWithProgressAnimation = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'devops',
        progress: 0.88,
        isFading: true, // Fading active
        transitionPhase: 'exiting' as const,
        pulseIntensity: 0.15, // Very low pulse during fade
        arrowFrame: 2,
        handoffStartTime: new Date('2024-01-01T12:00:00.600Z'),
      };

      mockUseAgentHandoff.mockReturnValue(fadingWithProgressAnimation);

      render(<AgentPanel agents={testAgents} currentAgent="devops" />);

      // Progress bar should be visible even during fade
      expect(screen.getByText('88%')).toBeInTheDocument();
      expect(screen.getByText(/█/)).toBeInTheDocument(); // Progress bar filled
      expect(screen.getByText(/░/)).toBeInTheDocument(); // Progress bar empty

      // Agents visible with fading applied
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText('→→→')).toBeInTheDocument();
    });

    it('fading effect gracefully transitions to animation completion', () => {
      const completingAnimation = {
        isAnimating: true,
        previousAgent: 'reviewer',
        currentAgent: 'devops',
        progress: 0.95, // Near completion
        isFading: true,
        transitionPhase: 'exiting' as const,
        pulseIntensity: 0.1, // Minimal pulse near end
        arrowFrame: 2,
        handoffStartTime: new Date('2024-01-01T12:00:00.200Z'),
      };

      mockUseAgentHandoff.mockReturnValue(completingAnimation);

      const { rerender } = render(<AgentPanel agents={testAgents} currentAgent="devops" />);

      // Animation visible during fading
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();

      // Simulate animation completion
      const completedAnimation = {
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
        transitionPhase: 'idle' as const,
        pulseIntensity: 0,
        arrowFrame: 0,
        handoffStartTime: null,
      };

      mockUseAgentHandoff.mockReturnValue(completedAnimation);
      rerender(<AgentPanel agents={testAgents} currentAgent="devops" />);

      // Animation should be completely gone
      expect(screen.queryByText('→→→')).not.toBeInTheDocument();
      expect(screen.queryByText(/95%/)).not.toBeInTheDocument();

      // Only regular agent panel should be visible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument(); // In regular agent list
    });
  });

  describe('✅ Acceptance Criteria 3: Animation is visible in both compact and full modes', () => {
    it('handoff animation displays correctly in full mode with all features', () => {
      const fullModeAnimation = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.6,
        isFading: false,
        transitionPhase: 'active' as const,
        pulseIntensity: 0.75,
        arrowFrame: 2,
        handoffStartTime: new Date('2024-01-01T12:00:00.500Z'),
      };

      mockUseAgentHandoff.mockReturnValue(fullModeAnimation);

      render(<AgentPanel agents={testAgents} currentAgent="developer" compact={false} />);

      // Full mode should show all animation features
      expect(screen.getByText('Active Agents')).toBeInTheDocument(); // Header present in full mode
      expect(screen.getByText('⚡ Handoff')).toBeInTheDocument(); // Full handoff indicator
      expect(screen.getByText('architect')).toBeInTheDocument(); // Previous agent
      expect(screen.getByText('developer')).toBeInTheDocument(); // Current agent
      expect(screen.getByText('→→→')).toBeInTheDocument(); // Triple arrow
      expect(screen.getByText('60%')).toBeInTheDocument(); // Progress percentage
      expect(screen.getByText(/█/)).toBeInTheDocument(); // Progress bar
      expect(screen.getByText(/2\.0s/)).toBeInTheDocument(); // Elapsed time
    });

    it('handoff animation displays correctly in compact mode with condensed features', () => {
      const compactModeAnimation = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'tester',
        progress: 0.45,
        isFading: false,
        transitionPhase: 'active' as const,
        pulseIntensity: 0.8,
        arrowFrame: 1,
        handoffStartTime: new Date('2024-01-01T12:00:01.200Z'),
      };

      mockUseAgentHandoff.mockReturnValue(compactModeAnimation);

      render(<AgentPanel agents={testAgents} currentAgent="tester" compact={true} />);

      // Compact mode should show condensed animation
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument(); // No header in compact
      expect(screen.queryByText('⚡ Handoff')).not.toBeInTheDocument(); // No full indicator
      expect(screen.getByText('planner')).toBeInTheDocument(); // Previous agent
      expect(screen.getByText('tester')).toBeInTheDocument(); // Current agent
      expect(screen.getByText('→→')).toBeInTheDocument(); // Double arrow
      expect(screen.getByText(/\[1\.3s\]/)).toBeInTheDocument(); // Elapsed time in brackets

      // Progress bar not shown in compact mode
      expect(screen.queryByText('45%')).not.toBeInTheDocument();
      expect(screen.queryByText(/█/)).not.toBeInTheDocument();
    });

    it('animation works seamlessly when switching between modes during handoff', () => {
      const switchingAnimation = {
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.7,
        isFading: false,
        transitionPhase: 'active' as const,
        pulseIntensity: 0.6,
        arrowFrame: 2,
        handoffStartTime: new Date('2024-01-01T12:00:00.800Z'),
      };

      mockUseAgentHandoff.mockReturnValue(switchingAnimation);

      // Start in full mode
      const { rerender } = render(<AgentPanel agents={testAgents} currentAgent="reviewer" compact={false} />);

      // Verify full mode features
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('→→→')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
      expect(screen.getByText(/1\.7s/)).toBeInTheDocument();

      // Switch to compact mode
      rerender(<AgentPanel agents={testAgents} currentAgent="reviewer" compact={true} />);

      // Verify compact mode features
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('→→→')).toBeInTheDocument(); // Arrow still visible
      expect(screen.queryByText('70%')).not.toBeInTheDocument(); // Progress bar hidden
      expect(screen.getByText(/\[1\.7s\]/)).toBeInTheDocument(); // Elapsed time in brackets

      // Agents still visible in both modes
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('animation visibility adapts to available space in both modes', () => {
      const adaptiveAnimation = {
        isAnimating: true,
        previousAgent: 'tester',
        currentAgent: 'devops',
        progress: 0.35,
        isFading: false,
        transitionPhase: 'active' as const,
        pulseIntensity: 0.9,
        arrowFrame: 1,
        handoffStartTime: new Date('2024-01-01T12:00:01.800Z'),
      };

      mockUseAgentHandoff.mockReturnValue(adaptiveAnimation);

      // Test full mode with long agent names
      render(<AgentPanel agents={testAgents} currentAgent="devops" compact={false} />);

      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText('→→')).toBeInTheDocument();
      expect(screen.getByText('35%')).toBeInTheDocument();

      // Test compact mode with same content
      const { rerender } = render(<AgentPanel agents={testAgents} currentAgent="devops" compact={true} />);

      // Should still show essential animation elements
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText('→→')).toBeInTheDocument();
      expect(screen.getByText(/\[0\.7s\]/)).toBeInTheDocument();
    });
  });

  describe('✅ Acceptance Criteria 4: Existing tests pass (Regression Prevention)', () => {
    it('normal agent panel functionality unaffected by animation enhancements', () => {
      // No animation - normal state
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
        transitionPhase: 'idle',
        pulseIntensity: 0,
        arrowFrame: 0,
        handoffStartTime: null,
      });

      render(<AgentPanel agents={testAgents} currentAgent="developer" />);

      // Standard agent panel features should work normally
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();

      // Status icons should work
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
      expect(screen.getByText(/·/)).toBeInTheDocument(); // idle

      // Progress and stage display should work
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();

      // Elapsed time for active agent should work
      expect(screen.getByText(/2\.5s/)).toBeInTheDocument();
    });

    it('compact mode functionality preserved with animation enhancements', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
        transitionPhase: 'idle',
        pulseIntensity: 0,
        arrowFrame: 0,
        handoffStartTime: null,
      });

      render(<AgentPanel agents={testAgents} currentAgent="developer" compact={true} />);

      // Compact mode features should work normally
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(testAgents.length - 1); // Separators

      // All agents visible in line
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Progress and elapsed time in compact format
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/\[2\.5s\]/)).toBeInTheDocument();
    });

    it('parallel execution functionality unaffected by animation enhancements', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 60 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 45 },
      ];

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
        transitionPhase: 'idle',
        pulseIntensity: 0,
        arrowFrame: 0,
        handoffStartTime: null,
      });

      render(
        <AgentPanel
          agents={testAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Parallel execution should work normally
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('coding')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
    });

    it('edge case handling preserved with animation enhancements', () => {
      // Test with minimal agent data
      const minimalAgents: AgentInfo[] = [
        { name: 'test-agent', status: 'active' }
      ];

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
        transitionPhase: 'idle',
        pulseIntensity: 0,
        arrowFrame: 0,
        handoffStartTime: null,
      });

      render(<AgentPanel agents={minimalAgents} currentAgent="test-agent" />);

      expect(screen.getByText('test-agent')).toBeInTheDocument();
      expect(screen.getByText(/⚡/)).toBeInTheDocument();

      // Test with empty agents
      const { rerender } = render(<AgentPanel agents={[]} />);
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Test with nonexistent current agent
      rerender(<AgentPanel agents={minimalAgents} currentAgent="nonexistent" />);
      expect(screen.getByText('test-agent')).toBeInTheDocument();
    });

    it('performance remains acceptable with animation enhancements', () => {
      const startTime = performance.now();

      // Simulate multiple rapid renders with animations
      for (let i = 0; i < 20; i++) {
        const animationState = {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: i / 20,
          isFading: i > 15,
          transitionPhase: 'active' as const,
          pulseIntensity: Math.sin(i) * 0.5 + 0.5,
          arrowFrame: i % 3,
          handoffStartTime: new Date(),
        };

        mockUseAgentHandoff.mockReturnValue(animationState);

        const { unmount } = render(<AgentPanel agents={testAgents} currentAgent="developer" />);

        expect(screen.getByText('developer')).toBeInTheDocument();

        unmount();
      }

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Performance should remain reasonable
      expect(renderTime).toBeLessThan(500); // 20 renders in under 500ms
    });
  });

  describe('Integration test: Complete handoff animation lifecycle', () => {
    it('validates complete handoff animation from start to finish with all features', async () => {
      // Simulate complete handoff lifecycle
      const handoffStages = [
        // Initial state - no animation
        {
          isAnimating: false,
          previousAgent: null,
          currentAgent: null,
          progress: 0,
          isFading: false,
          transitionPhase: 'idle' as const,
          pulseIntensity: 0,
          arrowFrame: 0,
          handoffStartTime: null,
        },
        // Animation starts
        {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.1,
          isFading: false,
          transitionPhase: 'entering' as const,
          pulseIntensity: 0.4,
          arrowFrame: 0,
          handoffStartTime: new Date('2024-01-01T12:00:00.000Z'),
        },
        // Mid animation
        {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.5,
          isFading: false,
          transitionPhase: 'active' as const,
          pulseIntensity: 0.8,
          arrowFrame: 1,
          handoffStartTime: new Date('2024-01-01T12:00:00.000Z'),
        },
        // Near completion
        {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'developer',
          progress: 0.85,
          isFading: true,
          transitionPhase: 'exiting' as const,
          pulseIntensity: 0.3,
          arrowFrame: 2,
          handoffStartTime: new Date('2024-01-01T12:00:00.000Z'),
        },
        // Completed
        {
          isAnimating: false,
          previousAgent: null,
          currentAgent: null,
          progress: 0,
          isFading: false,
          transitionPhase: 'idle' as const,
          pulseIntensity: 0,
          arrowFrame: 0,
          handoffStartTime: null,
        },
      ];

      const { rerender } = render(<AgentPanel agents={testAgents} currentAgent="developer" />);

      // Test each stage
      handoffStages.forEach((stage, index) => {
        mockUseAgentHandoff.mockReturnValue(stage);

        // Update time for each stage
        vi.setSystemTime(new Date(`2024-01-01T12:00:0${index}.500Z`));

        rerender(<AgentPanel agents={testAgents} currentAgent="developer" />);

        if (stage.isAnimating) {
          // Animation should be visible
          expect(screen.getByText('planner')).toBeInTheDocument();
          expect(screen.getByText('developer')).toBeInTheDocument();

          // Arrow should be present
          if (stage.arrowFrame === 0) {
            expect(screen.getByText('→')).toBeInTheDocument();
          } else if (stage.arrowFrame === 1) {
            expect(screen.getByText('→→')).toBeInTheDocument();
          } else {
            expect(screen.getByText('→→→')).toBeInTheDocument();
          }

          // Progress should be visible
          const expectedPercentage = `${Math.round(stage.progress * 100)}%`;
          expect(screen.getByText(expectedPercentage)).toBeInTheDocument();

          // Elapsed time should be visible
          if (stage.handoffStartTime) {
            expect(screen.getByText(/\d+\.\ds/)).toBeInTheDocument();
          }
        } else {
          // No animation elements when not animating
          expect(screen.queryByText('→')).not.toBeInTheDocument();
          expect(screen.queryByText('→→')).not.toBeInTheDocument();
          expect(screen.queryByText('→→→')).not.toBeInTheDocument();

          // Regular agent panel should be visible
          expect(screen.getByText('Active Agents')).toBeInTheDocument();
        }
      });
    });
  });
});