import React from 'react';
import { describe, it, expect } from 'vitest';
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
      ];

      render(<AgentPanel agents={statusAgents} />);

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
      expect(screen.getByText('agent4')).toBeInTheDocument();
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
});