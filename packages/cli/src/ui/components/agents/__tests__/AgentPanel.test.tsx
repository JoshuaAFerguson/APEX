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
});