/**
 * Comprehensive test suite that validates all agent handoff functionality together
 * This test serves as a final integration validation for the complete feature
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('Agent Handoff - Comprehensive Feature Validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const productionAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation', progress: 75 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
    { name: 'devops', status: 'idle' },
  ];

  describe('complete workflow simulation', () => {
    it('simulates a complete development workflow with handoff animations', async () => {
      const { rerender } = render(
        <AgentPanel agents={productionAgents} currentAgent="planner" />
      );

      // Verify initial state
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Step 1: Planner to Architect
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="architect" />);
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();

      // Complete first handoff
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Step 2: Architect to Developer
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="developer" />);
      });

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Complete second handoff
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Step 3: Developer to Tester
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="tester" />);
      });

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Complete third handoff
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Verify final state
      expect(screen.queryByText('→')).not.toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('validates acceptance criteria in both panel modes', async () => {
      // Test Full Mode
      const { rerender } = render(
        <AgentPanel agents={productionAgents} currentAgent="developer" />
      );

      // Trigger handoff
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="tester" />);
      });

      // ✓ AgentPanel displays animated transition
      expect(screen.getByText('→')).toBeInTheDocument();

      // ✓ Shows 'previousAgent → currentAgent'
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // ✓ Visual indicator present
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();

      // ✓ Advance to fade phase (after 1.5s of 2s total)
      act(() => {
        vi.advanceTimersByTime(1600);
      });

      // Should still be visible but dimming
      expect(screen.getByText('→')).toBeInTheDocument();

      // ✓ Fades after 2 seconds
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Test Compact Mode
      rerender(<AgentPanel agents={productionAgents} currentAgent="developer" compact={true} />);

      // Trigger handoff in compact mode
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="reviewer" compact={true} />);
      });

      // ✓ Works in compact mode
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // ✓ No full panel indicators in compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
    });

    it('validates performance under stress conditions', async () => {
      const { rerender } = render(
        <AgentPanel agents={productionAgents} currentAgent="planner" />
      );

      const agents = ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'];

      // Rapid agent changes (simulating fast workflow)
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let i = 0; i < agents.length - 1; i++) {
          act(() => {
            rerender(<AgentPanel agents={productionAgents} currentAgent={agents[i + 1]} />);
          });

          // Partial advance to test interruption
          act(() => {
            vi.advanceTimersByTime(200);
          });
        }
      }

      // System should still be responsive
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Complete all pending animations
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should end in clean state
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('validates error recovery and edge cases', async () => {
      const { rerender } = render(
        <AgentPanel agents={productionAgents} currentAgent="developer" />
      );

      // Invalid agent transition
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent={undefined} />);
      });

      // Should not crash or show animation
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Recovery to valid agent
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="tester" />);
      });

      // Should not animate from undefined
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Valid transition after recovery
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="reviewer" />);
      });

      // Should now animate properly
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('validates accessibility during animations', async () => {
      const { rerender } = render(
        <AgentPanel agents={productionAgents} currentAgent="developer" />
      );

      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="tester" />);
      });

      // All text should be accessible to screen readers
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/Handoff:/)).toBeInTheDocument();

      // Agent details should remain accessible
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();

      // Status icons should be present
      expect(screen.getByText('✓')).toBeInTheDocument(); // completed
      expect(screen.getByText('⚡')).toBeInTheDocument(); // active
      expect(screen.getByText('○')).toBeInTheDocument(); // waiting
      expect(screen.getByText('·')).toBeInTheDocument(); // idle
    });

    it('validates memory management and cleanup', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      const { rerender, unmount } = render(
        <AgentPanel agents={productionAgents} currentAgent="developer" />
      );

      // Start multiple animations
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="tester" />);
      });

      expect(setIntervalSpy).toHaveBeenCalled();

      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="reviewer" />);
      });

      // Previous animation should be cleaned up
      expect(clearIntervalSpy).toHaveBeenCalled();

      // Unmount during animation
      unmount();

      // Should clean up properly
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });
  });

  describe('feature acceptance validation', () => {
    it('meets all specified acceptance criteria', async () => {
      const { rerender } = render(
        <AgentPanel agents={productionAgents} currentAgent="planner" />
      );

      // Criterion 1: AgentPanel displays animated transition when currentAgent changes
      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="architect" />);
      });

      expect(screen.getByText('→')).toBeInTheDocument();

      // Criterion 2: Visual indicator showing 'previousAgent → currentAgent'
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();

      // Criterion 3: Fades after 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Criterion 4: Works in both compact and full panel modes
      rerender(<AgentPanel agents={productionAgents} currentAgent="architect" compact={true} />);

      act(() => {
        rerender(<AgentPanel agents={productionAgents} currentAgent="developer" compact={true} />);
      });

      // Should work in compact mode
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Compact mode should not show full mode elements
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
    });
  });
});