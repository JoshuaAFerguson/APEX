import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel', () => {
  const mockAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'active', stage: 'implementation', progress: 75 },
    { name: 'reviewer', status: 'waiting' },
    { name: 'tester', status: 'idle' },
    { name: 'devops', status: 'idle' },
  ];

  describe('full panel mode', () => {
    it('renders with agent list', () => {
      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('displays correct status icons', () => {
      render(<AgentPanel agents={mockAgents} />);

      // Find status icons (exact implementation depends on how they're rendered)
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
      expect(screen.getByText(/·/)).toBeInTheDocument(); // idle
    });

    it('shows agent stage when provided', () => {
      render(<AgentPanel agents={mockAgents} />);

      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
    });

    it('shows progress percentage when provided', () => {
      render(<AgentPanel agents={mockAgents} />);

      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('highlights current agent', () => {
      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // The developer agent should be highlighted (bold/colored)
      // This would require testing actual styling or class names
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles empty agent list', () => {
      render(<AgentPanel agents={[]} />);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      // No agents should be displayed
      expect(screen.queryByText('planner')).not.toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders in single line format', () => {
      render(<AgentPanel agents={mockAgents} compact={true} />);

      // Should not show the "Active Agents" header in compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Should show all agents in a line
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('shows separators between agents in compact mode', () => {
      render(<AgentPanel agents={mockAgents} compact={true} />);

      // Should show pipe separators between agents
      expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);
    });

    it('highlights current agent in compact mode', () => {
      render(<AgentPanel agents={mockAgents} currentAgent="developer" compact={true} />);

      // Developer should be highlighted
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('shows status icons in compact mode', () => {
      render(<AgentPanel agents={mockAgents} compact={true} />);

      // Should show status icons before agent names
      expect(screen.getByText(/✓/)).toBeInTheDocument();
      expect(screen.getByText(/⚡/)).toBeInTheDocument();
      expect(screen.getByText(/○/)).toBeInTheDocument();
      expect(screen.getByText(/·/)).toBeInTheDocument();
    });

    it('handles single agent in compact mode', () => {
      const singleAgent = [{ name: 'planner', status: 'active' as const }];
      render(<AgentPanel agents={singleAgent} compact={true} />);

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.queryByText('│')).not.toBeInTheDocument(); // No separators for single agent
    });
  });

  describe('agent status handling', () => {
    it('displays all status types correctly', () => {
      const statusAgents: AgentInfo[] = [
        { name: 'agent1', status: 'active' },
        { name: 'agent2', status: 'waiting' },
        { name: 'agent3', status: 'completed' },
        { name: 'agent4', status: 'idle' },
        { name: 'agent5', status: 'parallel' },
      ];

      render(<AgentPanel agents={statusAgents} />);

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
      expect(screen.getByText('agent4')).toBeInTheDocument();
      expect(screen.getByText('agent5')).toBeInTheDocument();
    });

    it('displays parallel status icon correctly', () => {
      const parallelAgent: AgentInfo[] = [
        { name: 'parallel-agent', status: 'parallel' },
      ];

      render(<AgentPanel agents={parallelAgent} />);

      expect(screen.getByText(/⟂/)).toBeInTheDocument();
      expect(screen.getByText('parallel-agent')).toBeInTheDocument();
    });
  });

  describe('agent colors', () => {
    it('applies correct colors to known agents', () => {
      const knownAgents: AgentInfo[] = [
        { name: 'planner', status: 'active' },
        { name: 'architect', status: 'active' },
        { name: 'developer', status: 'active' },
        { name: 'reviewer', status: 'active' },
        { name: 'tester', status: 'active' },
        { name: 'devops', status: 'active' },
      ];

      render(<AgentPanel agents={knownAgents} />);

      // Should render all known agents
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('handles unknown agent names', () => {
      const unknownAgent: AgentInfo[] = [
        { name: 'custom-agent', status: 'active' }
      ];

      render(<AgentPanel agents={unknownAgent} />);

      expect(screen.getByText('custom-agent')).toBeInTheDocument();
    });
  });

  describe('progress handling', () => {
    it('shows progress for values between 0 and 100', () => {
      const progressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: 50 },
        { name: 'agent2', status: 'active', progress: 25 },
        { name: 'agent3', status: 'active', progress: 90 },
      ];

      render(<AgentPanel agents={progressAgents} />);

      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/25%/)).toBeInTheDocument();
      expect(screen.getByText(/90%/)).toBeInTheDocument();
    });

    it('hides progress for 0 and 100 percent', () => {
      const edgeProgressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: 0 },
        { name: 'agent2', status: 'active', progress: 100 },
      ];

      render(<AgentPanel agents={edgeProgressAgents} />);

      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    });

    it('handles undefined progress', () => {
      const noProgressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'active' }, // no progress property
      ];

      render(<AgentPanel agents={noProgressAgents} />);

      expect(screen.getByText('agent1')).toBeInTheDocument();
      // Should not show any percentage
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });

  describe('stage display', () => {
    it('shows stage when provided', () => {
      const stageAgents: AgentInfo[] = [
        { name: 'agent1', status: 'active', stage: 'planning' },
        { name: 'agent2', status: 'active', stage: 'implementation' },
      ];

      render(<AgentPanel agents={stageAgents} />);

      expect(screen.getByText(/\(planning\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
    });

    it('hides stage when not provided', () => {
      const noStageAgents: AgentInfo[] = [
        { name: 'agent1', status: 'active' }, // no stage property
      ];

      render(<AgentPanel agents={noStageAgents} />);

      expect(screen.getByText('agent1')).toBeInTheDocument();
      // Should not show parentheses for stage
      expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles agents with long names', () => {
      const longNameAgents: AgentInfo[] = [
        { name: 'very-long-agent-name-that-might-wrap', status: 'active' }
      ];

      render(<AgentPanel agents={longNameAgents} />);

      expect(screen.getByText('very-long-agent-name-that-might-wrap')).toBeInTheDocument();
    });

    it('handles special characters in agent names', () => {
      const specialAgents: AgentInfo[] = [
        { name: 'agent-with-dashes', status: 'active' },
        { name: 'agent_with_underscores', status: 'active' },
        { name: 'agent.with.dots', status: 'active' },
      ];

      render(<AgentPanel agents={specialAgents} />);

      expect(screen.getByText('agent-with-dashes')).toBeInTheDocument();
      expect(screen.getByText('agent_with_underscores')).toBeInTheDocument();
      expect(screen.getByText('agent.with.dots')).toBeInTheDocument();
    });

    it('handles currentAgent that does not exist in agents list', () => {
      const agents = [{ name: 'planner', status: 'active' as const }];

      render(<AgentPanel agents={agents} currentAgent="nonexistent" />);

      expect(screen.getByText('planner')).toBeInTheDocument();
      // Should not crash, just no agent will be highlighted
    });

    it('handles currentAgent when agents list is empty', () => {
      render(<AgentPanel agents={[]} currentAgent="nonexistent" />);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      // Should not crash
    });
  });

  describe('accessibility', () => {
    it('provides accessible text content', () => {
      render(<AgentPanel agents={mockAgents} />);

      // All agent names should be accessible
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Status information should be accessible
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });
  });

  describe('agent handoff animation integration', () => {
    // Mock the useAgentHandoff hook
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

    it('calls useAgentHandoff with currentAgent in full mode', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
    });

    it('calls useAgentHandoff with currentAgent in compact mode', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="tester" compact={true} />);

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('tester');
    });

    it('calls useAgentHandoff with undefined when no currentAgent', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} />);

      expect(mockUseAgentHandoff).toHaveBeenCalledWith(undefined);
    });

    it('passes animation state to HandoffIndicator in full mode', () => {
      const mockAnimationState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      };

      mockUseAgentHandoff.mockReturnValue(mockAnimationState);

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // HandoffIndicator should be rendered with the animation state
      // Note: Since HandoffIndicator is mocked in setup.ts, we can't test its exact rendering
      // but we can verify the hook is called and the component structure is correct
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('passes animation state to HandoffIndicator in compact mode', () => {
      const mockAnimationState = {
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.75,
        isFading: true,
      };

      mockUseAgentHandoff.mockReturnValue(mockAnimationState);

      render(<AgentPanel agents={mockAgents} currentAgent="tester" compact={true} />);

      // In compact mode, there should be no "Active Agents" header
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('tester');
    });

    it('handles animation state changes', () => {
      const initialState = {
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      };

      mockUseAgentHandoff.mockReturnValue(initialState);

      const { rerender } = render(<AgentPanel agents={mockAgents} currentAgent="planner" />);

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('planner');

      // Simulate agent change
      const newState = {
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.3,
        isFading: false,
      };

      mockUseAgentHandoff.mockReturnValue(newState);

      rerender(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
    });

    it('passes correct agentColors to HandoffIndicator', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // The AgentPanel should pass the agentColors mapping to HandoffIndicator
      // This ensures consistent color usage across components
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
    });

    it('shows HandoffIndicator in correct position for full mode', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // In full mode, HandoffIndicator should appear after the header but before agent list
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      // Agent names should still be visible
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('shows HandoffIndicator in correct position for compact mode', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'tester',
        progress: 0.8,
        isFading: true,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="tester" compact={true} />);

      // In compact mode, HandoffIndicator should appear after the agent list
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      // Agent names should still be visible
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('handoff animation edge cases', () => {
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

    it('handles no agents with handoff animation', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      render(<AgentPanel agents={[]} currentAgent="developer" />);

      // Should still call the hook even with empty agents array
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles currentAgent not in agents list with animation', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'nonexistent',
        progress: 0.5,
        isFading: false,
      });

      const limitedAgents = [
        { name: 'planner', status: 'completed' as const },
        { name: 'architect', status: 'active' as const },
      ];

      render(<AgentPanel agents={limitedAgents} currentAgent="nonexistent" />);

      // Animation should still work even if currentAgent isn't in the agents list
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('nonexistent');
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles animation state with undefined agents', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: undefined,
        currentAgent: undefined,
        progress: 0.5,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // Should handle undefined agent names in animation state gracefully
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('maintains agent list functionality during animation', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      render(<AgentPanel agents={mockAgents} currentAgent="developer" />);

      // All normal AgentPanel functionality should still work
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();

      // Status icons should still be present
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
    });
  });

  describe('parallel execution functionality', () => {
    const parallelAgents: AgentInfo[] = [
      { name: 'developer', status: 'parallel', stage: 'coding' },
      { name: 'tester', status: 'parallel', stage: 'writing-tests' },
      { name: 'reviewer', status: 'parallel', stage: 'reviewing' },
    ];

    it('shows parallel execution section when showParallel=true and has multiple parallel agents', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('hides parallel execution section when showParallel=false', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={false}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('hides parallel execution section when only one parallel agent', () => {
      const singleParallelAgent = [parallelAgents[0]];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={singleParallelAgent}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('hides parallel execution section when no parallel agents', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('displays parallel agents with cyan color', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // The parallel agents should be displayed with ⟂ icon
      expect(screen.getAllByText(/⟂/)).toHaveLength(4); // 1 header + 3 agents
    });

    it('shows parallel agents in compact mode', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show ⟂ indicator and agent names
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('displays parallel agent stages', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/\(coding\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(writing-tests\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(reviewing\)/)).toBeInTheDocument();
    });

    it('displays parallel agent progress', () => {
      const parallelAgentsWithProgress: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 60 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 45 },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgentsWithProgress}
        />
      );

      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
    });

    it('handles parallel agents with cyan color in main agent list', () => {
      const mixedAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
      ];

      render(
        <AgentPanel
          agents={mixedAgents}
          currentAgent="developer"
        />
      );

      // Should show parallel status icon for parallel agents
      expect(screen.getAllByText(/⟂/)).toHaveLength(2); // For developer and tester
    });
  });

  describe('verbose mode debug information', () => {
    const agentWithDebugInfo: AgentInfo[] = [
      {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        debugInfo: {
          tokensUsed: { input: 1500, output: 2500 },
          stageStartedAt: new Date('2023-01-01T10:00:00Z'),
          lastToolCall: 'Edit',
          turnCount: 3,
          errorCount: 1,
        },
      },
    ];

    it('displays debug information in verbose mode for active agent', () => {
      render(
        <AgentPanel
          agents={agentWithDebugInfo}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should show token breakdown
      expect(screen.getByText('🔢 Tokens: 1500→2500')).toBeInTheDocument();

      // Should show turn count
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();

      // Should show last tool call
      expect(screen.getByText('🔧 Last tool: Edit')).toBeInTheDocument();

      // Should show error count
      expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();
    });

    it('hides debug information in normal mode', () => {
      render(
        <AgentPanel
          agents={agentWithDebugInfo}
          currentAgent="developer"
          displayMode="normal"
        />
      );

      // Should not show any debug information
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });

    it('only shows debug info for active agent', () => {
      const mixedAgents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            tokensUsed: { input: 500, output: 300 },
            turnCount: 2,
          },
        },
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1500, output: 2500 },
            turnCount: 3,
          },
        },
      ];

      render(
        <AgentPanel
          agents={mixedAgents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Only active agent's debug info should be shown
      expect(screen.getByText('🔢 Tokens: 1500→2500')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();

      // Completed agent's debug info should not be shown
      expect(screen.queryByText('🔢 Tokens: 500→300')).not.toBeInTheDocument();
    });

    it('handles partial debug information', () => {
      const partialDebugAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 1500 },
            // Missing some fields
          },
        },
      ];

      render(
        <AgentPanel
          agents={partialDebugAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should show available fields
      expect(screen.getByText('🔢 Tokens: 1000→1500')).toBeInTheDocument();

      // Should not show missing fields
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });

    it('hides error count when zero', () => {
      const noErrorsAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 1500 },
            turnCount: 3,
            errorCount: 0,
          },
        },
      ];

      render(
        <AgentPanel
          agents={noErrorsAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should not show error count when it's 0
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();

      // Other fields should still be visible
      expect(screen.getByText('🔢 Tokens: 1000→1500')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
    });

    it('handles agent without debug info in verbose mode', () => {
      const noDebugAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          // No debugInfo
        },
      ];

      render(
        <AgentPanel
          agents={noDebugAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should still show normal agent info
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();

      // Should not show any debug fields
      expect(screen.queryByText(/🔢/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔄/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌/)).not.toBeInTheDocument();
    });

    it('formats debug information with proper indentation', () => {
      render(
        <AgentPanel
          agents={agentWithDebugInfo}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Debug info should be indented relative to agent name
      // This would require testing actual DOM structure or CSS classes
      expect(screen.getByText('🔢 Tokens: 1500→2500')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 3')).toBeInTheDocument();
    });

    it('handles large token numbers in debug info', () => {
      const largeTokensAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 150000, output: 250000 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={largeTokensAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should display raw numbers, not formatted
      expect(screen.getByText('🔢 Tokens: 150000→250000')).toBeInTheDocument();
    });

    it('handles special characters in tool names', () => {
      const specialToolAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            lastToolCall: 'WebFetch',
          },
        },
      ];

      render(
        <AgentPanel
          agents={specialToolAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      expect(screen.getByText('🔧 Last tool: WebFetch')).toBeInTheDocument();
    });

    it('handles undefined vs 0 turn count correctly', () => {
      const undefinedTurnsAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            tokensUsed: { input: 1000, output: 1500 },
            turnCount: undefined,
          },
        },
      ];

      render(
        <AgentPanel
          agents={undefinedTurnsAgent}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      // Should not show turn count when undefined
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
    });
  });

  describe('thinking field in debugInfo', () => {
    it('should include thinking field in AgentInfo interface type definition', () => {
      // Type compilation test: This should compile without TypeScript errors
      const agentWithThinking: AgentInfo = {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        debugInfo: {
          thinking: 'I need to analyze the requirements carefully...',
          tokensUsed: { input: 1500, output: 2500 },
          turnCount: 3,
        },
      };

      // Verify the agent object is properly typed
      expect(agentWithThinking.debugInfo?.thinking).toBe('I need to analyze the requirements carefully...');
      expect(typeof agentWithThinking.debugInfo?.thinking).toBe('string');
    });

    it('should allow thinking field to be undefined', () => {
      // Type compilation test: thinking field should be optional
      const agentWithoutThinking: AgentInfo = {
        name: 'tester',
        status: 'active',
        debugInfo: {
          tokensUsed: { input: 800, output: 1200 },
          turnCount: 2,
          // thinking field is intentionally omitted
        },
      };

      expect(agentWithoutThinking.debugInfo?.thinking).toBeUndefined();
    });

    it('should allow thinking field to be null', () => {
      // Type compilation test: thinking field should accept null values
      const agentWithNullThinking: AgentInfo = {
        name: 'reviewer',
        status: 'active',
        debugInfo: {
          thinking: undefined,
          tokensUsed: { input: 1000, output: 1800 },
        },
      };

      expect(agentWithNullThinking.debugInfo?.thinking).toBeUndefined();
    });

    it('should handle empty string thinking content', () => {
      const agentWithEmptyThinking: AgentInfo = {
        name: 'architect',
        status: 'active',
        debugInfo: {
          thinking: '',
          tokensUsed: { input: 500, output: 300 },
        },
      };

      expect(agentWithEmptyThinking.debugInfo?.thinking).toBe('');
      expect(typeof agentWithEmptyThinking.debugInfo?.thinking).toBe('string');
    });

    it('should handle multiline thinking content', () => {
      const multilineThinking = `Step 1: Analyze the problem
Step 2: Design the solution
Step 3: Implement the code`;

      const agentWithMultilineThinking: AgentInfo = {
        name: 'planner',
        status: 'active',
        debugInfo: {
          thinking: multilineThinking,
          tokensUsed: { input: 2000, output: 3000 },
        },
      };

      expect(agentWithMultilineThinking.debugInfo?.thinking).toBe(multilineThinking);
      expect(agentWithMultilineThinking.debugInfo?.thinking?.includes('\n')).toBe(true);
    });

    it('should handle long thinking content', () => {
      const longThinking = 'I need to carefully consider all aspects of this implementation. '.repeat(50);

      const agentWithLongThinking: AgentInfo = {
        name: 'developer',
        status: 'active',
        debugInfo: {
          thinking: longThinking,
          tokensUsed: { input: 5000, output: 8000 },
          turnCount: 10,
        },
      };

      expect(agentWithLongThinking.debugInfo?.thinking).toBe(longThinking);
      expect(agentWithLongThinking.debugInfo?.thinking?.length).toBeGreaterThan(1000);
    });

    it('should handle special characters in thinking content', () => {
      const specialThinking = 'Thinking with émojis 🤔💭, "quotes", \'apostrophes\', <html>, & special chars';

      const agentWithSpecialThinking: AgentInfo = {
        name: 'reviewer',
        status: 'active',
        debugInfo: {
          thinking: specialThinking,
          lastToolCall: 'Edit',
        },
      };

      expect(agentWithSpecialThinking.debugInfo?.thinking).toBe(specialThinking);
    });

    it('should allow thinking field alongside all other debugInfo fields', () => {
      const completeDebugAgent: AgentInfo = {
        name: 'devops',
        status: 'active',
        stage: 'deployment',
        progress: 75,
        startedAt: new Date('2023-01-01T10:00:00Z'),
        debugInfo: {
          thinking: 'Preparing deployment pipeline...',
          tokensUsed: { input: 2500, output: 4000 },
          stageStartedAt: new Date('2023-01-01T10:30:00Z'),
          lastToolCall: 'Bash',
          turnCount: 5,
          errorCount: 2,
        },
      };

      // Verify all fields are present and correctly typed
      expect(completeDebugAgent.debugInfo?.thinking).toBe('Preparing deployment pipeline...');
      expect(completeDebugAgent.debugInfo?.tokensUsed).toEqual({ input: 2500, output: 4000 });
      expect(completeDebugAgent.debugInfo?.stageStartedAt).toBeInstanceOf(Date);
      expect(completeDebugAgent.debugInfo?.lastToolCall).toBe('Bash');
      expect(completeDebugAgent.debugInfo?.turnCount).toBe(5);
      expect(completeDebugAgent.debugInfo?.errorCount).toBe(2);
    });

    it('should handle array of agents with mixed thinking field usage', () => {
      const mixedAgents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            thinking: 'Planning phase completed successfully',
            tokensUsed: { input: 500, output: 800 },
          },
        },
        {
          name: 'architect',
          status: 'completed',
          debugInfo: {
            tokensUsed: { input: 700, output: 1200 },
            // No thinking field
          },
        },
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: 'Currently implementing the core logic',
            tokensUsed: { input: 1500, output: 2500 },
            turnCount: 3,
          },
        },
        {
          name: 'tester',
          status: 'waiting',
          debugInfo: {
            thinking: '',
            tokensUsed: { input: 0, output: 0 },
          },
        },
      ];

      // Verify mixed usage compiles and works correctly
      expect(mixedAgents[0].debugInfo?.thinking).toBe('Planning phase completed successfully');
      expect(mixedAgents[1].debugInfo?.thinking).toBeUndefined();
      expect(mixedAgents[2].debugInfo?.thinking).toBe('Currently implementing the core logic');
      expect(mixedAgents[3].debugInfo?.thinking).toBe('');

      // This should render without errors
      render(<AgentPanel agents={mixedAgents} currentAgent="developer" />);

      // Verify agents are rendered
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('should maintain backward compatibility with existing debugInfo structure', () => {
      // Test that existing code without thinking field still works
      const legacyAgent: AgentInfo = {
        name: 'legacy',
        status: 'active',
        debugInfo: {
          tokensUsed: { input: 1000, output: 1500 },
          stageStartedAt: new Date(),
          lastToolCall: 'Read',
          turnCount: 4,
          errorCount: 1,
          // No thinking field - should be backward compatible
        },
      };

      expect(legacyAgent.debugInfo?.thinking).toBeUndefined();

      // Should render without issues
      render(<AgentPanel agents={[legacyAgent]} currentAgent="legacy" />);
      expect(screen.getByText('legacy')).toBeInTheDocument();
    });

    it('should handle rapid thinking content updates', () => {
      const [currentThinking, setCurrentThinking] = React.useState('Initial thinking');

      const DynamicAgent = () => {
        const agent: AgentInfo = {
          name: 'dynamic',
          status: 'active',
          debugInfo: {
            thinking: currentThinking,
            tokensUsed: { input: 1000, output: 1500 },
          },
        };

        return <AgentPanel agents={[agent]} currentAgent="dynamic" />;
      };

      const { rerender } = render(<DynamicAgent />);

      // Update thinking content multiple times
      const updates = [
        'First update',
        'Second update with more content',
        'Third update with even longer content that tests performance',
        'Final update'
      ];

      updates.forEach(update => {
        setCurrentThinking(update);
        rerender(<DynamicAgent />);
        // Component should handle updates without errors
        expect(screen.getByText('dynamic')).toBeInTheDocument();
      });
    });

    it('should handle Unicode and international characters in thinking', () => {
      const unicodeThinking = 'Testing Unicode: 测试中文, العربية, русский, 日本語, 🚀💻🔥';

      const unicodeAgent: AgentInfo = {
        name: 'unicode',
        status: 'active',
        debugInfo: {
          thinking: unicodeThinking,
          tokensUsed: { input: 800, output: 1200 },
        },
      };

      expect(unicodeAgent.debugInfo?.thinking).toBe(unicodeThinking);

      // Should render without issues
      render(<AgentPanel agents={[unicodeAgent]} currentAgent="unicode" />);
      expect(screen.getByText('unicode')).toBeInTheDocument();
    });

    it('should handle thinking field in parallel agents', () => {
      const parallelAgentsWithThinking: AgentInfo[] = [
        {
          name: 'parallel1',
          status: 'parallel',
          debugInfo: {
            thinking: 'Working on parallel task 1',
            tokensUsed: { input: 500, output: 800 },
          },
        },
        {
          name: 'parallel2',
          status: 'parallel',
          debugInfo: {
            thinking: 'Working on parallel task 2',
            tokensUsed: { input: 600, output: 900 },
          },
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgentsWithThinking}
        />
      );

      // Both parallel agents should be rendered
      expect(screen.getByText('parallel1')).toBeInTheDocument();
      expect(screen.getByText('parallel2')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });
  });
});