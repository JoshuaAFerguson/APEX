import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel showThoughts Functionality', () => {
  const mockAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation', progress: 75 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
    { name: 'devops', status: 'idle' },
  ];

  describe('showThoughts Prop Interface', () => {
    it('should accept showThoughts prop in AgentPanelProps interface', () => {
      // Test that component accepts showThoughts prop
      expect(() => {
        render(
          <AgentPanel
            agents={mockAgents}
            currentAgent="developer"
            showThoughts={true}
          />
        );
      }).not.toThrow();

      expect(() => {
        render(
          <AgentPanel
            agents={mockAgents}
            currentAgent="developer"
            showThoughts={false}
          />
        );
      }).not.toThrow();
    });

    it('should handle undefined showThoughts prop (default behavior)', () => {
      expect(() => {
        render(
          <AgentPanel
            agents={mockAgents}
            currentAgent="developer"
            // showThoughts not provided - should default to false
          />
        );
      }).not.toThrow();

      // Component should render normally
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('should work with showThoughts alongside other props', () => {
      expect(() => {
        render(
          <AgentPanel
            agents={mockAgents}
            currentAgent="developer"
            compact={true}
            showParallel={true}
            parallelAgents={[]}
            useDetailedParallelView={false}
            displayMode="verbose"
            showThoughts={true}
          />
        );
      }).not.toThrow();
    });
  });

  describe('showThoughts with Different Display Modes', () => {
    it('should work with showThoughts in normal display mode', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          displayMode="normal"
          showThoughts={true}
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('should work with showThoughts in compact display mode', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          displayMode="compact"
          showThoughts={true}
        />
      );

      // In compact mode, no "Active Agents" header
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('should work with showThoughts in verbose display mode', () => {
      const verboseAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          debugInfo: {
            tokensUsed: { input: 1500, output: 2500 },
            stageStartedAt: new Date(),
            lastToolCall: 'Edit',
            turnCount: 3,
            errorCount: 1,
          },
        },
      ];

      render(
        <AgentPanel
          agents={verboseAgents}
          currentAgent="developer"
          displayMode="verbose"
          showThoughts={true}
        />
      );

      // Should show verbose information and accept showThoughts
      expect(screen.getByText('🔢 Tokens: 1500→2500')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
    });

    it('should work with showThoughts in compact prop mode', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={true}
          showThoughts={true}
        />
      );

      // Compact mode behavior
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('showThoughts with Parallel Execution', () => {
    const parallelAgents: AgentInfo[] = [
      { name: 'developer', status: 'parallel', stage: 'coding' },
      { name: 'tester', status: 'parallel', stage: 'testing' },
    ];

    it('should work with showThoughts and parallel agents', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
          showThoughts={true}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('should work with showThoughts and detailed parallel view', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
          useDetailedParallelView={true}
          showThoughts={true}
        />
      );

      // Should work with detailed parallel view
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('should work with showThoughts in compact mode with parallel agents', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
          showThoughts={true}
        />
      );

      // Compact mode with parallel execution
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
    });
  });

  describe('showThoughts Behavioral Testing', () => {
    it('should not affect agent rendering when showThoughts=true', () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={false}
        />
      );

      // Capture initial render state
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();

      // Re-render with showThoughts=true
      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // All content should still be there
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
    });

    it('should not affect status icons when showThoughts changes', () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={false}
        />
      );

      // Check status icons
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
      expect(screen.getByText(/·/)).toBeInTheDocument(); // idle

      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Status icons should remain the same
      expect(screen.getByText(/✓/)).toBeInTheDocument();
      expect(screen.getByText(/⚡/)).toBeInTheDocument();
      expect(screen.getByText(/○/)).toBeInTheDocument();
      expect(screen.getByText(/·/)).toBeInTheDocument();
    });

    it('should not affect progress display when showThoughts changes', () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={false}
        />
      );

      expect(screen.getByText(/75%/)).toBeInTheDocument();

      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('should not affect agent highlighting when showThoughts changes', () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={false}
        />
      );

      // Current agent should be highlighted
      expect(screen.getByText('developer')).toBeInTheDocument();

      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="tester"
          showThoughts={true}
        />
      );

      // Different agent should be highlighted
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('showThoughts Edge Cases', () => {
    it('should handle showThoughts with empty agent list', () => {
      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showThoughts={true}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('should handle showThoughts with single agent', () => {
      const singleAgent = [{ name: 'planner', status: 'active' as const }];

      render(
        <AgentPanel
          agents={singleAgent}
          currentAgent="planner"
          showThoughts={true}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('should handle showThoughts with very long agent names', () => {
      const longNameAgent = [
        { name: 'super-long-agent-name-that-might-cause-layout-issues', status: 'active' as const }
      ];

      render(
        <AgentPanel
          agents={longNameAgent}
          currentAgent="super-long-agent-name-that-might-cause-layout-issues"
          showThoughts={true}
        />
      );

      expect(screen.getByText('super-long-agent-name-that-might-cause-layout-issues')).toBeInTheDocument();
    });

    it('should handle showThoughts with agents having special characters', () => {
      const specialAgents = [
        { name: 'agent-with-dashes', status: 'active' as const },
        { name: 'agent_with_underscores', status: 'active' as const },
        { name: 'agent.with.dots', status: 'active' as const },
      ];

      render(
        <AgentPanel
          agents={specialAgents}
          currentAgent="agent-with-dashes"
          showThoughts={true}
        />
      );

      expect(screen.getByText('agent-with-dashes')).toBeInTheDocument();
      expect(screen.getByText('agent_with_underscores')).toBeInTheDocument();
      expect(screen.getByText('agent.with.dots')).toBeInTheDocument();
    });

    it('should handle showThoughts with currentAgent not in list', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="nonexistent-agent"
          showThoughts={true}
        />
      );

      // Should not crash and should show all agents
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('showThoughts Future Enhancement Preparation', () => {
    it('should accept showThoughts prop for future thoughts display features', () => {
      // This test verifies the prop exists and can be passed
      // Future implementations might use this prop to show/hide agent thoughts

      const propsWithThoughts = {
        agents: mockAgents,
        currentAgent: "developer",
        showThoughts: true,
      };

      const propsWithoutThoughts = {
        agents: mockAgents,
        currentAgent: "developer",
        showThoughts: false,
      };

      expect(() => {
        render(<AgentPanel {...propsWithThoughts} />);
      }).not.toThrow();

      expect(() => {
        render(<AgentPanel {...propsWithoutThoughts} />);
      }).not.toThrow();
    });

    it('should maintain component structure for future thoughts integration', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Verify component structure that might be enhanced with thoughts display
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Agent rows should be present for future enhancement
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Stage information should be present
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
    });

    it('should work with all display modes for future thoughts features', () => {
      const displayModes: Array<'normal' | 'compact' | 'verbose'> = ['normal', 'compact', 'verbose'];

      displayModes.forEach(mode => {
        const { unmount } = render(
          <AgentPanel
            agents={mockAgents}
            currentAgent="developer"
            displayMode={mode}
            showThoughts={true}
          />
        );

        // Should render successfully in all modes
        expect(screen.getByText('developer')).toBeInTheDocument();

        unmount();
      });
    });

    it('should preserve all existing functionality when showThoughts is provided', () => {
      // Test that showThoughts doesn't break existing features

      // Test with progress
      const agentsWithProgress = [
        { name: 'developer', status: 'active' as const, progress: 50 }
      ];

      const { rerender } = render(
        <AgentPanel
          agents={agentsWithProgress}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      expect(screen.getByText(/50%/)).toBeInTheDocument();

      // Test with stage
      const agentsWithStage = [
        { name: 'developer', status: 'active' as const, stage: 'testing' }
      ];

      rerender(
        <AgentPanel
          agents={agentsWithStage}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      expect(screen.getByText(/testing/)).toBeInTheDocument();
    });
  });

  describe('showThoughts Component Integration', () => {
    // Mock the useAgentHandoff hook for integration tests
    const mockUseAgentHandoff = vi.fn();

    beforeEach(() => {
      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));
    });

    afterEach(() => {
      vi.clearAllMocks();
      vi.doUnmock('../../../hooks/useAgentHandoff.js');
    });

    it('should work with agent handoff animations when showThoughts=true', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('should work with agent handoff animations when showThoughts=false', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showThoughts={false}
        />
      );

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });
});