/**
 * Additional coverage tests for agent handoff animation feature
 * Targets specific edge cases and integration scenarios that may have been missed
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../__tests__/test-utils';
import { renderHook } from '@testing-library/react';
import { AgentPanel, AgentInfo } from '../components/agents/AgentPanel';
import { HandoffIndicator } from '../components/agents/HandoffIndicator';
import { useAgentHandoff } from '../hooks/useAgentHandoff';

describe('Agent Handoff Animation - Coverage Gap Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const standardAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation', progress: 75 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
    { name: 'devops', status: 'idle' },
  ];

  describe('AgentRow component edge cases', () => {
    it('handles agent with progress exactly at boundary values', () => {
      // Test agents with progress at exact boundary values (0, 100)
      const boundaryAgents: AgentInfo[] = [
        { name: 'agent-zero', status: 'active', progress: 0 },
        { name: 'agent-hundred', status: 'active', progress: 100 },
        { name: 'agent-normal', status: 'active', progress: 50 },
      ];

      render(<AgentPanel agents={boundaryAgents} currentAgent="agent-normal" />);

      // Progress 0 and 100 should not be displayed (per implementation logic)
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
      expect(screen.queryByText('100%')).not.toBeInTheDocument();

      // Normal progress should be displayed
      expect(screen.getByText('50%')).toBeInTheDocument();

      // All agents should be visible
      expect(screen.getByText('agent-zero')).toBeInTheDocument();
      expect(screen.getByText('agent-hundred')).toBeInTheDocument();
      expect(screen.getByText('agent-normal')).toBeInTheDocument();
    });

    it('handles agents with decimal progress values', () => {
      const decimalAgents: AgentInfo[] = [
        { name: 'agent-decimal', status: 'active', progress: 33.33 },
        { name: 'agent-float', status: 'active', progress: 66.7 },
      ];

      render(<AgentPanel agents={decimalAgents} currentAgent="agent-decimal" />);

      // Should display decimal values
      expect(screen.getByText('33.33%')).toBeInTheDocument();
      expect(screen.getByText('66.7%')).toBeInTheDocument();
    });

    it('handles agents with very long stage names', () => {
      const longStageAgents: AgentInfo[] = [
        {
          name: 'agent-long-stage',
          status: 'active',
          stage: 'very-long-stage-name-that-might-cause-layout-issues-in-terminal',
          progress: 45
        },
      ];

      render(<AgentPanel agents={longStageAgents} currentAgent="agent-long-stage" />);

      expect(screen.getByText(/very-long-stage-name-that-might-cause-layout-issues-in-terminal/)).toBeInTheDocument();
    });
  });

  describe('agentColors mapping edge cases', () => {
    it('handles multiple unknown agents consistently', () => {
      const unknownAgents: AgentInfo[] = [
        { name: 'custom-agent-1', status: 'active' },
        { name: 'custom-agent-2', status: 'waiting' },
        { name: 'custom-agent-3', status: 'completed' },
      ];

      const { rerender } = render(
        <AgentPanel agents={unknownAgents} currentAgent="custom-agent-1" />
      );

      // All unknown agents should be rendered
      expect(screen.getByText('custom-agent-1')).toBeInTheDocument();
      expect(screen.getByText('custom-agent-2')).toBeInTheDocument();
      expect(screen.getByText('custom-agent-3')).toBeInTheDocument();

      // Trigger handoff between unknown agents
      rerender(
        <AgentPanel agents={unknownAgents} currentAgent="custom-agent-2" />
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should show handoff animation even for unknown agents
      expect(screen.getByText('custom-agent-1')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('custom-agent-2')).toBeInTheDocument();
    });

    it('handles case sensitivity in agent names vs color mapping', () => {
      const caseAgents: AgentInfo[] = [
        { name: 'PLANNER', status: 'active' }, // Uppercase
        { name: 'Architect', status: 'waiting' }, // Title case
        { name: 'developer', status: 'completed' }, // Lowercase (should match)
      ];

      render(<AgentPanel agents={caseAgents} currentAgent="PLANNER" />);

      // All agents should render regardless of case
      expect(screen.getByText('PLANNER')).toBeInTheDocument();
      expect(screen.getByText('Architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('animation timing precision', () => {
    it('handles very precise timing requirements', () => {
      const { result } = renderHook(() =>
        useAgentHandoff('initial-agent', {
          duration: 1000,
          fadeDuration: 250,
          frameRate: 60 // High precision
        })
      );

      const { rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          duration: 1000,
          fadeDuration: 250,
          frameRate: 60
        }),
        { initialProps: { agent: 'initial-agent' } }
      );

      // Start animation
      act(() => {
        rerender({ agent: 'target-agent' });
      });

      // Test precise timing points
      const timingTests = [
        { time: 100, expectedProgress: 0.1 },
        { time: 250, expectedProgress: 0.25 },
        { time: 500, expectedProgress: 0.5 },
        { time: 750, expectedProgress: 0.75, shouldBeFading: true },
        { time: 900, expectedProgress: 0.9, shouldBeFading: true },
      ];

      timingTests.forEach(({ time, expectedProgress, shouldBeFading = false }) => {
        act(() => {
          vi.advanceTimersByTime(time - (result.current.progress * 1000));
        });

        expect(result.current.progress).toBeCloseTo(expectedProgress, 1);
        expect(result.current.isFading).toBe(shouldBeFading);
      });
    });

    it('handles sub-frame timing edge cases', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          duration: 100, // Very short duration
          fadeDuration: 25,
          frameRate: 120 // High frame rate
        }),
        { initialProps: { agent: 'agent1' } }
      );

      // Start animation
      act(() => {
        rerender({ agent: 'agent2' });
      });

      expect(result.current.isAnimating).toBe(true);

      // Advance by sub-frame amounts
      act(() => {
        vi.advanceTimersByTime(8); // Less than one frame at 120fps (8.33ms)
      });

      expect(result.current.progress).toBeGreaterThan(0);
      expect(result.current.progress).toBeLessThan(1);
    });
  });

  describe('concurrent component instances', () => {
    it('handles multiple AgentPanel instances with independent animations', () => {
      const panel1Agents = [
        { name: 'panel1-agent1', status: 'active' as const },
        { name: 'panel1-agent2', status: 'waiting' as const },
      ];

      const panel2Agents = [
        { name: 'panel2-agent1', status: 'completed' as const },
        { name: 'panel2-agent2', status: 'idle' as const },
      ];

      const MultiPanelComponent = () => (
        <>
          <AgentPanel
            agents={panel1Agents}
            currentAgent="panel1-agent1"
            compact={false}
          />
          <AgentPanel
            agents={panel2Agents}
            currentAgent="panel2-agent1"
            compact={true}
          />
        </>
      );

      const { rerender } = render(<MultiPanelComponent />);

      // Both panels should be visible
      expect(screen.getByText('panel1-agent1')).toBeInTheDocument();
      expect(screen.getByText('panel2-agent1')).toBeInTheDocument();

      // Trigger animations on both panels simultaneously
      const UpdatedMultiPanelComponent = () => (
        <>
          <AgentPanel
            agents={panel1Agents}
            currentAgent="panel1-agent2"
            compact={false}
          />
          <AgentPanel
            agents={panel2Agents}
            currentAgent="panel2-agent2"
            compact={true}
          />
        </>
      );

      rerender(<UpdatedMultiPanelComponent />);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Both animations should work independently
      // Panel 1 (full mode) should show handoff indicator
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();

      // Both panels should show their respective transitions
      const arrowElements = screen.getAllByText('→');
      expect(arrowElements).toHaveLength(2); // One from each panel
    });
  });

  describe('React lifecycle edge cases', () => {
    it('handles component unmount during animation setup', () => {
      const TestComponent = ({ shouldRender }: { shouldRender: boolean }) => {
        if (!shouldRender) return null;

        return (
          <AgentPanel
            agents={standardAgents}
            currentAgent="planner"
          />
        );
      };

      const { rerender } = render(<TestComponent shouldRender={true} />);

      // Start animation
      rerender(<TestComponent shouldRender={true} />);

      act(() => {
        rerender(<TestComponent shouldRender={true} />);
      });

      // Unmount during animation
      act(() => {
        rerender(<TestComponent shouldRender={false} />);
      });

      // Advance timers after unmount - should not cause errors
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not crash
      expect(screen.queryByText('planner')).not.toBeInTheDocument();
    });

    it('handles rapid prop changes during render cycle', () => {
      const { rerender } = render(
        <AgentPanel agents={standardAgents} currentAgent="planner" />
      );

      // Simulate rapid prop changes that might happen in real app
      const rapidChanges = ['architect', 'developer', 'tester', 'reviewer', 'devops'];

      rapidChanges.forEach((agent, index) => {
        act(() => {
          rerender(<AgentPanel agents={standardAgents} currentAgent={agent} />);
          // Small delay to simulate realistic timing
          vi.advanceTimersByTime(50);
        });
      });

      // Should end up with the last transition
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should show the final transition (reviewer → devops)
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });
  });

  describe('integration with Ink components', () => {
    it('handles Box and Text prop edge cases', () => {
      // Test that HandoffIndicator works with various Ink component edge cases
      const animationState = {
        isAnimating: true,
        previousAgent: 'test-agent-1',
        currentAgent: 'test-agent-2',
        progress: 0.5,
        isFading: false,
      };

      const edgeCaseColors = {
        'test-agent-1': 'magenta',
        'test-agent-2': 'cyan',
      };

      // Test with compact=true
      const { rerender } = render(
        <HandoffIndicator
          animationState={animationState}
          agentColors={edgeCaseColors}
          compact={true}
        />
      );

      expect(screen.getByText('test-agent-1')).toBeInTheDocument();
      expect(screen.getByText('test-agent-2')).toBeInTheDocument();

      // Test with compact=false (different Box structure)
      rerender(
        <HandoffIndicator
          animationState={animationState}
          agentColors={edgeCaseColors}
          compact={false}
        />
      );

      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      expect(screen.getByText('test-agent-1')).toBeInTheDocument();
      expect(screen.getByText('test-agent-2')).toBeInTheDocument();
    });
  });

  describe('mathematical edge cases', () => {
    it('handles floating point precision issues', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          duration: 333, // Odd number that might cause FP issues
          fadeDuration: 111,
          frameRate: 29.97 // Non-integer frame rate
        }),
        { initialProps: { agent: 'agent1' } }
      );

      act(() => {
        rerender({ agent: 'agent2' });
      });

      // Progress through animation with potentially problematic timing
      act(() => {
        vi.advanceTimersByTime(111); // 1/3 through
      });

      expect(result.current.progress).toBeCloseTo(0.333, 2);
      expect(result.current.isAnimating).toBe(true);

      // Advance to near end
      act(() => {
        vi.advanceTimersByTime(220); // Near completion
      });

      expect(result.current.progress).toBeCloseTo(0.993, 2);
      expect(result.current.isFading).toBe(true);

      // Complete
      act(() => {
        vi.advanceTimersByTime(50); // Should complete
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('handles timer drift and accumulation errors', () => {
      const { result, rerender } = renderHook(
        ({ agent }) => useAgentHandoff(agent, {
          duration: 1000,
          frameRate: 60
        }),
        { initialProps: { agent: 'agent1' } }
      );

      act(() => {
        rerender({ agent: 'agent2' });
      });

      // Simulate timer drift by advancing in irregular intervals
      const irregularIntervals = [17, 15, 18, 16, 17, 15]; // Simulate browser timer irregularity
      let totalAdvanced = 0;

      irregularIntervals.forEach(interval => {
        act(() => {
          vi.advanceTimersByTime(interval);
          totalAdvanced += interval;
        });

        // Progress should still be reasonably accurate despite timer irregularity
        const expectedProgress = totalAdvanced / 1000;
        expect(Math.abs(result.current.progress - expectedProgress)).toBeLessThan(0.1);
      });
    });
  });
});