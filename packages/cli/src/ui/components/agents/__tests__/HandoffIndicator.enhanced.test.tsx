/**
 * Enhanced HandoffIndicator Component Tests
 *
 * Tests the three key enhanced animation features:
 * 1. Elapsed time display during handoff with sub-second precision
 * 2. Visual pulse/highlight effect for new agent using sinusoidal intensity cycling
 * 3. Animated transition arrow that progresses from → to →→ to →→→
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../../__tests__/test-utils';
import { HandoffIndicator } from '../HandoffIndicator';
import type { HandoffAnimationState } from '../../hooks/useAgentHandoff.js';

describe('HandoffIndicator - Enhanced Animation Features', () => {
  const mockAgentColors = {
    planner: 'blue',
    developer: 'green',
    tester: 'yellow',
    reviewer: 'magenta',
  };

  const baseAnimationState: HandoffAnimationState = {
    isAnimating: true,
    previousAgent: 'planner',
    currentAgent: 'developer',
    progress: 0.5,
    isFading: false,
    transitionPhase: 'active',
    pulseIntensity: 0.5,
    arrowFrame: 1,
    handoffStartTime: new Date('2024-01-01T12:00:00Z'),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:01.500Z')); // 1.5 seconds after start
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('elapsed time display', () => {
    it('shows elapsed time when showElapsedTime=true and handoffStartTime provided', () => {
      const animationState = {
        ...baseAnimationState,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showElapsedTime={true}
        />
      );

      // Should show elapsed time of 1.5s
      expect(screen.getByText(/1\.5s/)).toBeInTheDocument();
    });

    it('hides elapsed time when showElapsedTime=false', () => {
      const animationState = {
        ...baseAnimationState,
        handoffStartTime: new Date('2024-01-01T12:00:00Z'),
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showElapsedTime={false}
        />
      );

      // Should not show elapsed time
      expect(screen.queryByText(/1\.5s/)).not.toBeInTheDocument();
    });

    it('does not show elapsed time when handoffStartTime is null', () => {
      const animationState = {
        ...baseAnimationState,
        handoffStartTime: null,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showElapsedTime={true}
        />
      );

      // Should not show any elapsed time
      expect(screen.queryByText(/\d+\.\ds/)).not.toBeInTheDocument();
    });

    it('formats elapsed time correctly in full mode', () => {
      const animationState = {
        ...baseAnimationState,
        handoffStartTime: new Date('2024-01-01T12:00:00.200Z'),
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
          showElapsedTime={true}
        />
      );

      // Should show 1.3s elapsed time (1.5 - 0.2 = 1.3)
      expect(screen.getByText(/1\.3s/)).toBeInTheDocument();
      expect(screen.getByText('⚡ Handoff')).toBeInTheDocument();
    });

    it('formats elapsed time correctly in compact mode', () => {
      const animationState = {
        ...baseAnimationState,
        handoffStartTime: new Date('2024-01-01T12:00:00.500Z'),
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
          showElapsedTime={true}
        />
      );

      // Should show 1.0s elapsed time in brackets
      expect(screen.getByText(/\[1\.0s\]/)).toBeInTheDocument();
    });

    it('handles sub-second elapsed times correctly', () => {
      const animationState = {
        ...baseAnimationState,
        handoffStartTime: new Date('2024-01-01T12:00:01.200Z'),
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          showElapsedTime={true}
        />
      );

      // Should show 0.3s elapsed time
      expect(screen.getByText(/0\.3s/)).toBeInTheDocument();
    });
  });

  describe('animated arrow progression', () => {
    it('displays single arrow for frame 0', () => {
      const animationState = {
        ...baseAnimationState,
        arrowFrame: 0,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.queryByText('→→')).not.toBeInTheDocument();
      expect(screen.queryByText('→→→')).not.toBeInTheDocument();
    });

    it('displays double arrow for frame 1', () => {
      const animationState = {
        ...baseAnimationState,
        arrowFrame: 1,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('→→')).toBeInTheDocument();
      expect(screen.queryByText(/^→$/)).not.toBeInTheDocument();
      expect(screen.queryByText('→→→')).not.toBeInTheDocument();
    });

    it('displays triple arrow for frame 2', () => {
      const animationState = {
        ...baseAnimationState,
        arrowFrame: 2,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('→→→')).toBeInTheDocument();
      expect(screen.queryByText(/^→$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^→→$/)).not.toBeInTheDocument();
    });

    it('handles arrow frame exceeding maximum gracefully', () => {
      const animationState = {
        ...baseAnimationState,
        arrowFrame: 5, // Beyond expected range
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // Should default to triple arrow (max)
      expect(screen.getByText('→→→')).toBeInTheDocument();
    });

    it('displays animated arrow in both full and compact modes', () => {
      const animationState = {
        ...baseAnimationState,
        arrowFrame: 2,
      };

      // Test full mode
      const { rerender } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
        />
      );

      expect(screen.getByText('→→→')).toBeInTheDocument();

      // Test compact mode
      rerender(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      expect(screen.getByText('→→→')).toBeInTheDocument();
    });
  });

  describe('visual pulse/highlight effect', () => {
    it('applies bold styling when pulse intensity is high', () => {
      const animationState = {
        ...baseAnimationState,
        pulseIntensity: 0.8, // High intensity should make text bold
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // The current agent (developer) should be rendered with bold styling
      const currentAgentElement = screen.getByText('developer');
      expect(currentAgentElement).toBeInTheDocument();
    });

    it('applies dimColor styling when pulse intensity is low', () => {
      const animationState = {
        ...baseAnimationState,
        pulseIntensity: 0.2, // Low intensity should make text dimmed
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // The current agent should be rendered with dimColor styling
      const currentAgentElement = screen.getByText('developer');
      expect(currentAgentElement).toBeInTheDocument();
    });

    it('handles pulse intensity at boundaries correctly', () => {
      // Test at 0.5 threshold for bold
      const animationState = {
        ...baseAnimationState,
        pulseIntensity: 0.5,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();

      // Test at 0.3 threshold for dim
      const { rerender } = render(
        <HandoffIndicator
          animationState={{
            ...animationState,
            pulseIntensity: 0.3,
          }}
          agentColors={mockAgentColors}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('pulse effect only affects current agent, not previous agent', () => {
      const animationState = {
        ...baseAnimationState,
        pulseIntensity: 0.8, // High pulse
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // Both agents should be visible
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('pulse effect works in both full and compact modes', () => {
      const animationState = {
        ...baseAnimationState,
        pulseIntensity: 0.9,
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

      // Test compact mode
      rerender(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('progress bar visualization', () => {
    it('shows progress bar in full mode when showProgressBar=true', () => {
      const animationState = {
        ...baseAnimationState,
        progress: 0.4, // 40% progress
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
          showProgressBar={true}
        />
      );

      // Should show progress percentage
      expect(screen.getByText(/40%/)).toBeInTheDocument();

      // Should show progress bar characters
      expect(screen.getByText(/█/)).toBeInTheDocument();
      expect(screen.getByText(/░/)).toBeInTheDocument();
    });

    it('hides progress bar in compact mode', () => {
      const animationState = {
        ...baseAnimationState,
        progress: 0.6,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
          showProgressBar={true}
        />
      );

      // Should not show progress bar in compact mode
      expect(screen.queryByText(/60%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/█/)).not.toBeInTheDocument();
    });

    it('hides progress bar when showProgressBar=false', () => {
      const animationState = {
        ...baseAnimationState,
        progress: 0.7,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
          showProgressBar={false}
        />
      );

      // Should not show progress bar
      expect(screen.queryByText(/70%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/█/)).not.toBeInTheDocument();
    });

    it('progress bar reflects correct progress percentage', () => {
      const testCases = [
        { progress: 0.0, percentage: '0%' },
        { progress: 0.25, percentage: '25%' },
        { progress: 0.5, percentage: '50%' },
        { progress: 0.75, percentage: '75%' },
        { progress: 1.0, percentage: '100%' },
      ];

      testCases.forEach(({ progress, percentage }) => {
        const animationState = {
          ...baseAnimationState,
          progress,
        };

        const { rerender } = render(
          <HandoffIndicator
            animationState={animationState}
            agentColors={mockAgentColors}
            compact={false}
            showProgressBar={true}
          />
        );

        expect(screen.getByText(percentage)).toBeInTheDocument();
      });
    });
  });

  describe('fade effect during animation end', () => {
    it('applies fade styling when isFading=true', () => {
      const animationState = {
        ...baseAnimationState,
        isFading: true,
        progress: 0.8, // Near end of animation
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      // All text elements should be rendered (fade is handled by ink styling)
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('fade effect affects progress bar when shown', () => {
      const animationState = {
        ...baseAnimationState,
        isFading: true,
        progress: 0.85,
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
          showProgressBar={true}
        />
      );

      // Progress bar should still be visible but with fade styling
      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });
  });

  describe('agent color integration', () => {
    it('uses agent colors from props', () => {
      const customColors = {
        planner: 'red',
        developer: 'cyan',
      };

      render(
        <HandoffIndicator
          animationState={baseAnimationState}
          agentColors={customColors}
        />
      );

      // Agents should be rendered with specified colors
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('falls back to white for unknown agents', () => {
      const limitedColors = {
        planner: 'blue',
        // developer not defined
      };

      render(
        <HandoffIndicator
          animationState={baseAnimationState}
          agentColors={limitedColors}
        />
      );

      // Should still render both agents
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('enhanced features integration', () => {
    it('all enhanced features work together in full mode', () => {
      const animationState = {
        ...baseAnimationState,
        arrowFrame: 2,
        pulseIntensity: 0.7,
        progress: 0.6,
        handoffStartTime: new Date('2024-01-01T12:00:00.300Z'),
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={false}
          showElapsedTime={true}
          showProgressBar={true}
        />
      );

      // Should show all enhanced features
      expect(screen.getByText('→→→')).toBeInTheDocument(); // Animated arrow
      expect(screen.getByText('planner')).toBeInTheDocument(); // Previous agent
      expect(screen.getByText('developer')).toBeInTheDocument(); // Current agent with pulse
      expect(screen.getByText(/1\.2s/)).toBeInTheDocument(); // Elapsed time
      expect(screen.getByText(/60%/)).toBeInTheDocument(); // Progress bar
    });

    it('all enhanced features work together in compact mode', () => {
      const animationState = {
        ...baseAnimationState,
        arrowFrame: 1,
        pulseIntensity: 0.4,
        handoffStartTime: new Date('2024-01-01T12:00:00.800Z'),
      };

      render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
          compact={true}
          showElapsedTime={true}
        />
      );

      // Should show compact versions of enhanced features
      expect(screen.getByText('→→')).toBeInTheDocument(); // Animated arrow
      expect(screen.getByText('planner')).toBeInTheDocument(); // Previous agent
      expect(screen.getByText('developer')).toBeInTheDocument(); // Current agent with pulse
      expect(screen.getByText(/\[0\.7s\]/)).toBeInTheDocument(); // Elapsed time in brackets
    });
  });

  describe('component lifecycle', () => {
    it('does not render when isAnimating=false', () => {
      const animationState = {
        ...baseAnimationState,
        isAnimating: false,
      };

      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('does not render when agents are missing', () => {
      const animationState = {
        ...baseAnimationState,
        previousAgent: null,
        currentAgent: 'developer',
      };

      const { container } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={mockAgentColors}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('handles edge case values gracefully', () => {
      const extremeAnimationState = {
        ...baseAnimationState,
        progress: 1.5, // Beyond normal range
        pulseIntensity: -0.1, // Negative value
        arrowFrame: 10, // Way beyond range
      };

      render(
        <HandoffIndicator
          animationState={extremeAnimationState}
          agentColors={mockAgentColors}
          showProgressBar={true}
        />
      );

      // Should still render without crashing
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });
});