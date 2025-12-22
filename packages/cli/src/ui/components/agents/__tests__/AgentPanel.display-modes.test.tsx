import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, type AgentInfo } from '../AgentPanel';
import type { DisplayMode } from '@apexcli/core';

/**
 * Integration tests for AgentPanel display mode switching and behavior
 * Tests transitions between normal, compact, and verbose modes
 */
describe('AgentPanel - Display Modes Integration', () => {
  // Mock hooks
  const mockUseAgentHandoff = vi.fn();
  const mockUseElapsedTime = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));
    vi.doMock('../../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));

    mockUseAgentHandoff.mockReturnValue({
      isAnimating: false,
      previousAgent: null,
      currentAgent: null,
      progress: 0,
      isFading: false,
    });
    mockUseElapsedTime.mockReturnValue('03:45');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useAgentHandoff.js');
    vi.doUnmock('../../../hooks/useElapsedTime.js');
  });

  const complexAgents: AgentInfo[] = [
    {
      name: 'planner',
      status: 'completed',
      stage: 'planning',
      startedAt: new Date('2023-01-01T10:00:00Z'),
      debugInfo: {
        tokensUsed: { input: 5000, output: 3500 },
        turnCount: 8,
        lastToolCall: 'PlanningTool',
        errorCount: 0,
      },
    },
    {
      name: 'developer',
      status: 'active',
      stage: 'implementation',
      progress: 65,
      startedAt: new Date('2023-01-01T10:15:00Z'),
      debugInfo: {
        tokensUsed: { input: 15000, output: 12000 },
        turnCount: 23,
        lastToolCall: 'Edit',
        errorCount: 2,
      },
    },
    {
      name: 'tester',
      status: 'waiting',
      stage: 'testing',
      debugInfo: {
        tokensUsed: { input: 2000, output: 1500 },
        turnCount: 5,
        lastToolCall: 'TestRunner',
        errorCount: 1,
      },
    },
    {
      name: 'reviewer',
      status: 'idle',
    },
  ];

  describe('display mode transitions', () => {
    it('transitions smoothly from normal to verbose mode', () => {
      const { rerender } = render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Verify normal mode initial state
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/\[03:45\]/)).toBeInTheDocument();

      // Should not show debug info in normal mode
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();

      // Transition to verbose mode
      rerender(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // All previous content should still be visible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/\[03:45\]/)).toBeInTheDocument();

      // Plus debug information should now be visible
      expect(screen.getByText('🔢 Tokens: 15.0k→12.0k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 23')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 2')).toBeInTheDocument();

      // Debug info for inactive agents should not be shown
      expect(screen.queryByText('🔢 Tokens: 5k→3.5k')).not.toBeInTheDocument();
      expect(screen.queryByText('🔧 Last tool: PlanningTool')).not.toBeInTheDocument();
    });

    it('transitions from verbose back to normal mode', () => {
      const { rerender } = render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Verify verbose mode state
      expect(screen.getByText('🔢 Tokens: 15.0k→12.0k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 23')).toBeInTheDocument();

      // Transition back to normal mode
      rerender(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Basic functionality should remain
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/65%/)).toBeInTheDocument();

      // Debug info should be hidden again
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });

    it('transitions between normal and compact modes', () => {
      const { rerender } = render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Normal mode layout
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Transition to compact mode
      rerender(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="compact"
        />
      );

      // Should switch to compact layout
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(complexAgents.length - 1);

      // Progress should still be visible in compact mode
      expect(screen.getByText(/65%/)).toBeInTheDocument();

      // Transition back to normal
      rerender(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Should return to full layout
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.queryByText('│')).not.toBeInTheDocument();
    });

    it('handles compact prop override with verbose displayMode', () => {
      render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="verbose"
          compact={true}
        />
      );

      // Compact prop should override verbose displayMode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(complexAgents.length - 1);

      // Should not show debug info when compact=true
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();

      // But should still show basic info
      expect(screen.getByText(/65%/)).toBeInTheDocument();
    });
  });

  describe('display mode with agent switching', () => {
    it('maintains display mode when switching active agents', () => {
      const { rerender } = render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Initially shows developer's debug info
      expect(screen.getByText('🔢 Tokens: 15.0k→12.0k')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();
      expect(screen.queryByText('🔧 Last tool: PlanningTool')).not.toBeInTheDocument();

      // Switch to planner (completed agent with debug info)
      rerender(
        <AgentPanel
          agents={complexAgents}
          currentAgent="planner"
          displayMode="verbose"
        />
      );

      // Should now show planner's debug info (but planner is not active)
      // Debug info should only show for active agents, so no debug info should be visible
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();

      // Switch to tester (waiting agent)
      rerender(
        <AgentPanel
          agents={complexAgents}
          currentAgent="tester"
          displayMode="verbose"
        />
      );

      // Tester is waiting, so no debug info should be shown
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
    });

    it('shows debug info only for active agents regardless of currentAgent', () => {
      render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="planner" // planner is completed, not active
          displayMode="verbose"
        />
      );

      // Even though currentAgent is planner, only active agents should show debug info
      // Developer is the only active agent, but since currentAgent is planner, no debug info should show
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();

      // All agent names should still be visible
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });
  });

  describe('complex mode switching scenarios', () => {
    it('handles rapid mode switching without issues', () => {
      const modes: DisplayMode[] = ['normal', 'verbose', 'compact', 'normal', 'verbose'];
      let component = render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode={modes[0]}
        />
      );

      modes.forEach((mode, index) => {
        component.rerender(
          <AgentPanel
            agents={complexAgents}
            currentAgent="developer"
            displayMode={mode}
          />
        );

        // Agent name should always be visible
        expect(screen.getByText('developer')).toBeInTheDocument();

        // Check mode-specific features
        if (mode === 'compact') {
          expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
          expect(screen.getAllByText('│')).toHaveLength(complexAgents.length - 1);
        } else {
          expect(screen.getByText('Active Agents')).toBeInTheDocument();
        }

        if (mode === 'verbose') {
          expect(screen.getByText('🔢 Tokens: 15.0k→12.0k')).toBeInTheDocument();
        } else {
          expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
        }
      });
    });

    it('maintains agent data integrity across mode changes', () => {
      const { rerender } = render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      const modes: DisplayMode[] = ['verbose', 'compact', 'normal', 'verbose'];

      modes.forEach((mode) => {
        rerender(
          <AgentPanel
            agents={complexAgents}
            currentAgent="developer"
            displayMode={mode}
          />
        );

        // Core agent information should always be present
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();

        // Status icons should be consistent
        expect(screen.getByText('✓')).toBeInTheDocument(); // completed (planner)
        expect(screen.getByText('⚡')).toBeInTheDocument(); // active (developer)
        expect(screen.getByText('○')).toBeInTheDocument(); // waiting (tester)
        expect(screen.getByText('·')).toBeInTheDocument(); // idle (reviewer)

        // Stages should be shown when not compact
        if (mode !== 'compact') {
          expect(screen.getByText(/planning/)).toBeInTheDocument();
          expect(screen.getByText(/implementation/)).toBeInTheDocument();
          expect(screen.getByText(/testing/)).toBeInTheDocument();
        }

        // Progress should be shown
        if (mode !== 'compact' || screen.queryByText(/65%/)) {
          expect(screen.getByText(/65%/)).toBeInTheDocument();
        }
      });
    });
  });

  describe('display mode with complex agent states', () => {
    const parallelAgents: AgentInfo[] = [
      {
        name: 'developer',
        status: 'parallel',
        stage: 'coding',
        progress: 40,
        debugInfo: {
          tokensUsed: { input: 8000, output: 6000 },
          turnCount: 12,
          lastToolCall: 'Edit',
        },
      },
      {
        name: 'tester',
        status: 'parallel',
        stage: 'testing',
        progress: 60,
        debugInfo: {
          tokensUsed: { input: 4000, output: 3000 },
          turnCount: 8,
          lastToolCall: 'TestRunner',
        },
      },
    ];

    it('handles parallel agents across different display modes', () => {
      const { rerender } = render(
        <AgentPanel
          agents={parallelAgents}
          currentAgent="developer"
          displayMode="normal"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Normal mode with parallel agents
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getAllByText('⟂')).toHaveLength(3); // 1 header + 2 agents

      // Switch to verbose mode
      rerender(
        <AgentPanel
          agents={parallelAgents}
          currentAgent="developer"
          displayMode="verbose"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should still show parallel section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Debug info should show for active agent only
      // Since developer is active and currentAgent, should show debug info
      expect(screen.getByText('🔢 Tokens: 8k→6k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 12')).toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <AgentPanel
          agents={parallelAgents}
          currentAgent="developer"
          displayMode="compact"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Compact mode should show parallel agents inline
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('⟂')).toBeInTheDocument(); // Parallel indicator
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles agents without debug info in verbose mode', () => {
      const mixedAgents: AgentInfo[] = [
        {
          name: 'agent-with-debug',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 800 },
            turnCount: 5,
            lastToolCall: 'ToolA',
          },
        },
        {
          name: 'agent-without-debug',
          status: 'waiting',
          stage: 'waiting-stage',
          // No debugInfo
        },
      ];

      render(
        <AgentPanel
          agents={mixedAgents}
          currentAgent="agent-with-debug"
          displayMode="verbose"
        />
      );

      // Should show debug info for agent with debug info
      expect(screen.getByText('🔢 Tokens: 1k→800')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: ToolA')).toBeInTheDocument();

      // Should still show normal info for agent without debug info
      expect(screen.getByText('agent-without-debug')).toBeInTheDocument();
      expect(screen.getByText(/waiting-stage/)).toBeInTheDocument();

      // Should not show any debug placeholders for agent without debug info
      expect(screen.getAllByText(/🔢 Tokens:/)).toHaveLength(1);
      expect(screen.getAllByText(/🔄 Turns:/)).toHaveLength(1);
      expect(screen.getAllByText(/🔧 Last tool:/)).toHaveLength(1);
    });
  });

  describe('display mode edge cases', () => {
    it('handles undefined displayMode gracefully', () => {
      render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode={undefined as any}
        />
      );

      // Should default to normal mode behavior
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });

    it('handles invalid displayMode gracefully', () => {
      render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          displayMode={'invalid-mode' as any}
        />
      );

      // Should default to normal mode behavior
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });

    it('handles empty agents array with different display modes', () => {
      const modes: DisplayMode[] = ['normal', 'verbose', 'compact'];

      modes.forEach((mode) => {
        const { unmount } = render(
          <AgentPanel
            agents={[]}
            currentAgent="nonexistent"
            displayMode={mode}
          />
        );

        if (mode === 'compact') {
          // Compact mode doesn't show header with empty agents
          expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
        } else {
          // Normal and verbose modes show header even with empty agents
          expect(screen.getByText('Active Agents')).toBeInTheDocument();
        }

        // No debug info should be shown regardless of mode
        expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();

        unmount();
      });
    });
  });
});