import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo, AgentPanelProps } from '../AgentPanel';

describe('AgentPanel - Type Definitions and Props Interface', () => {
  describe('AgentInfo interface', () => {
    it('accepts all valid status types including parallel', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active' },
        { name: 'agent2', status: 'waiting' },
        { name: 'agent3', status: 'completed' },
        { name: 'agent4', status: 'idle' },
        { name: 'agent5', status: 'parallel' },
      ];

      // This test passes if TypeScript compilation succeeds
      expect(agents).toHaveLength(5);
      expect(agents[4].status).toBe('parallel');
    });

    it('requires name and status properties', () => {
      // Minimal valid AgentInfo
      const minimalAgent: AgentInfo = {
        name: 'test-agent',
        status: 'active',
      };

      expect(minimalAgent.name).toBe('test-agent');
      expect(minimalAgent.status).toBe('active');
      expect(minimalAgent.stage).toBeUndefined();
      expect(minimalAgent.progress).toBeUndefined();
    });

    it('accepts optional stage and progress properties', () => {
      const fullAgent: AgentInfo = {
        name: 'full-agent',
        status: 'parallel',
        stage: 'implementation',
        progress: 75,
      };

      expect(fullAgent.stage).toBe('implementation');
      expect(fullAgent.progress).toBe(75);
    });

    it('enforces progress range constraints through usage', () => {
      // Valid progress values
      const validProgressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: 0 },
        { name: 'agent2', status: 'active', progress: 50 },
        { name: 'agent3', status: 'active', progress: 100 },
      ];

      expect(validProgressAgents[0].progress).toBe(0);
      expect(validProgressAgents[1].progress).toBe(50);
      expect(validProgressAgents[2].progress).toBe(100);
    });
  });

  describe('AgentPanelProps interface', () => {
    it('requires agents array as minimum props', () => {
      const minimalProps: AgentPanelProps = {
        agents: [],
      };

      render(<AgentPanel {...minimalProps} />);
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('accepts all optional props including parallel execution props', () => {
      const agents: AgentInfo[] = [
        { name: 'main-agent', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'parallel-agent1', status: 'parallel' },
        { name: 'parallel-agent2', status: 'parallel' },
      ];

      const fullProps: AgentPanelProps = {
        agents,
        currentAgent: 'main-agent',
        compact: false,
        showParallel: true,
        parallelAgents,
      };

      render(<AgentPanel {...fullProps} />);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('main-agent')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('parallel-agent1')).toBeInTheDocument();
      expect(screen.getByText('parallel-agent2')).toBeInTheDocument();
    });

    it('has proper default values for optional props', () => {
      const agents: AgentInfo[] = [
        { name: 'test-agent', status: 'active' },
      ];

      // Test implicit defaults
      render(<AgentPanel agents={agents} />);

      // Should render in full mode (not compact)
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Should not show parallel execution section (showParallel defaults to false)
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('handles undefined/null props gracefully', () => {
      const agents: AgentInfo[] = [
        { name: 'test-agent', status: 'active' },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent={undefined}
          parallelAgents={undefined}
        />
      );

      expect(screen.getByText('test-agent')).toBeInTheDocument();
      // Should not crash with undefined props
    });
  });

  describe('type compatibility and prop validation', () => {
    it('ensures parallelAgents prop accepts AgentInfo[] type', () => {
      const regularAgents: AgentInfo[] = [
        { name: 'regular', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'parallel1', status: 'parallel', stage: 'testing' },
        { name: 'parallel2', status: 'parallel', progress: 60 },
        { name: 'parallel3', status: 'parallel', stage: 'review', progress: 80 },
      ];

      // This should compile without TypeScript errors
      render(
        <AgentPanel
          agents={regularAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('parallel1')).toBeInTheDocument();
      expect(screen.getByText('parallel2')).toBeInTheDocument();
      expect(screen.getByText('parallel3')).toBeInTheDocument();
      expect(screen.getByText(/\(testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });

    it('validates status string literal types', () => {
      // All status types should be accepted
      const allStatusTypes: AgentInfo['status'][] = [
        'active',
        'waiting',
        'completed',
        'idle',
        'parallel'
      ];

      expect(allStatusTypes).toHaveLength(5);
      expect(allStatusTypes.includes('parallel')).toBe(true);
    });

    it('ensures currentAgent prop accepts string type', () => {
      const agents: AgentInfo[] = [
        { name: 'target-agent', status: 'active' },
      ];

      const agentName: string = 'target-agent';

      render(
        <AgentPanel
          agents={agents}
          currentAgent={agentName}
        />
      );

      expect(screen.getByText('target-agent')).toBeInTheDocument();
    });

    it('handles mixed status types in agent arrays', () => {
      const mixedAgents: AgentInfo[] = [
        { name: 'completed-agent', status: 'completed' },
        { name: 'active-agent', status: 'active' },
        { name: 'parallel-agent', status: 'parallel' },
        { name: 'waiting-agent', status: 'waiting' },
        { name: 'idle-agent', status: 'idle' },
      ];

      render(<AgentPanel agents={mixedAgents} />);

      // All agents should be rendered regardless of status
      expect(screen.getByText('completed-agent')).toBeInTheDocument();
      expect(screen.getByText('active-agent')).toBeInTheDocument();
      expect(screen.getByText('parallel-agent')).toBeInTheDocument();
      expect(screen.getByText('waiting-agent')).toBeInTheDocument();
      expect(screen.getByText('idle-agent')).toBeInTheDocument();
    });
  });

  describe('parallel execution specific type handling', () => {
    it('validates showParallel boolean prop', () => {
      const agents: AgentInfo[] = [{ name: 'test', status: 'active' }];
      const parallelAgents: AgentInfo[] = [
        { name: 'p1', status: 'parallel' },
        { name: 'p2', status: 'parallel' },
      ];

      // Test explicit true
      const { rerender } = render(
        <AgentPanel
          agents={agents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Test explicit false
      rerender(
        <AgentPanel
          agents={agents}
          showParallel={false}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('ensures parallel status is properly typed in AgentInfo', () => {
      // This test validates that 'parallel' is a valid status value
      const parallelAgent: AgentInfo = {
        name: 'typed-parallel-agent',
        status: 'parallel', // This should not cause TypeScript errors
        stage: 'processing',
        progress: 45,
      };

      render(<AgentPanel agents={[parallelAgent]} />);

      expect(screen.getByText('typed-parallel-agent')).toBeInTheDocument();
      expect(screen.getByText(/\(processing\)/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
    });

    it('validates parallelAgents prop is optional and defaults correctly', () => {
      const agents: AgentInfo[] = [{ name: 'test', status: 'active' }];

      // Should not error when parallelAgents is omitted
      render(
        <AgentPanel
          agents={agents}
          showParallel={true}
          // parallelAgents prop intentionally omitted
        />
      );

      // Should not show parallel section when no parallel agents
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });

  describe('export validation', () => {
    it('exports AgentInfo type correctly', () => {
      // This test ensures AgentInfo is properly exported
      const agent: AgentInfo = {
        name: 'exported-agent',
        status: 'parallel',
      };

      expect(agent.name).toBe('exported-agent');
      expect(agent.status).toBe('parallel');
    });

    it('exports AgentPanelProps interface correctly', () => {
      // This test ensures AgentPanelProps is properly exported
      const props: AgentPanelProps = {
        agents: [],
        showParallel: true,
        parallelAgents: [],
      };

      expect(props.agents).toEqual([]);
      expect(props.showParallel).toBe(true);
      expect(props.parallelAgents).toEqual([]);
    });

    it('exports AgentPanel component correctly', () => {
      // Component should be importable and renderable
      expect(AgentPanel).toBeDefined();
      expect(typeof AgentPanel).toBe('function');

      render(<AgentPanel agents={[]} />);
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });
});