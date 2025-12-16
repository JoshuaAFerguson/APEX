import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo, AgentPanelProps } from '../AgentPanel';

describe('AgentPanel - Final Validation for Parallel Execution Support', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Acceptance Criteria Validation', () => {
    it('AC1: AgentPanel accepts parallelAgents and showParallel props', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'testing' },
        { name: 'reviewer', status: 'parallel', stage: 'reviewing' },
      ];

      // Test: Component should accept these props without TypeScript errors
      const validProps: AgentPanelProps = {
        agents,
        parallelAgents,
        showParallel: true,
        compact: false,
        currentAgent: 'developer',
      };

      render(<AgentPanel {...validProps} />);

      // Verify props are accepted and processed
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('AC2: AgentInfo type includes parallel status', () => {
      // Test: 'parallel' should be a valid status value
      const parallelAgent: AgentInfo = {
        name: 'parallel-agent',
        status: 'parallel', // This should not cause TypeScript compilation errors
        stage: 'processing',
        progress: 75,
      };

      // Test all valid status values are accepted
      const allStatusAgents: AgentInfo[] = [
        { name: 'active-agent', status: 'active' },
        { name: 'waiting-agent', status: 'waiting' },
        { name: 'completed-agent', status: 'completed' },
        { name: 'idle-agent', status: 'idle' },
        { name: 'parallel-agent', status: 'parallel' },
      ];

      render(<AgentPanel agents={allStatusAgents} />);

      // Verify all agents render with correct status icons
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/·/)).toBeInTheDocument(); // idle
      expect(screen.getByText(/⟂/)).toBeInTheDocument(); // parallel

      // Verify parallel agent properties are accessible
      expect(parallelAgent.name).toBe('parallel-agent');
      expect(parallelAgent.status).toBe('parallel');
      expect(parallelAgent.stage).toBe('processing');
      expect(parallelAgent.progress).toBe(75);
    });

    it('AC3: Type definitions are exported correctly', () => {
      // Test: AgentInfo and AgentPanelProps should be importable

      // This test validates that imports work (would fail at compile time if not)
      expect(typeof AgentPanel).toBe('function');

      // Test AgentInfo type can be used
      const testAgent: AgentInfo = {
        name: 'test-agent',
        status: 'parallel',
        stage: 'test-stage',
        progress: 50,
      };

      // Test AgentPanelProps type can be used
      const testProps: AgentPanelProps = {
        agents: [testAgent],
        currentAgent: 'test-agent',
        compact: true,
        showParallel: true,
        parallelAgents: [testAgent],
      };

      render(<AgentPanel {...testProps} />);

      expect(screen.getByText('test-agent')).toBeInTheDocument();
      expect(screen.getByText('⟂')).toBeInTheDocument();
    });
  });

  describe('Comprehensive Functionality Validation', () => {
    it('validates complete parallel execution workflow', () => {
      // Test a realistic development workflow scenario
      const mainAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed', stage: 'planning' },
        { name: 'architect', status: 'completed', stage: 'design' },
        { name: 'developer', status: 'completed', stage: 'implementation' },
        { name: 'coordinator', status: 'active', stage: 'orchestration' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'code-reviewer', status: 'parallel', stage: 'code-review', progress: 85 },
        { name: 'unit-tester', status: 'parallel', stage: 'unit-testing', progress: 70 },
        { name: 'integration-tester', status: 'parallel', stage: 'integration-tests', progress: 40 },
        { name: 'security-scanner', status: 'parallel', stage: 'security-analysis', progress: 60 },
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="coordinator"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Validate main workflow section
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('coordinator')).toBeInTheDocument();

      // Validate parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('code-reviewer')).toBeInTheDocument();
      expect(screen.getByText('unit-tester')).toBeInTheDocument();
      expect(screen.getByText('integration-tester')).toBeInTheDocument();
      expect(screen.getByText('security-scanner')).toBeInTheDocument();

      // Validate stage information
      expect(screen.getByText(/\(orchestration\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(code-review\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(unit-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(integration-tests\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(security-analysis\)/)).toBeInTheDocument();

      // Validate progress information
      expect(screen.getByText(/85%/)).toBeInTheDocument();
      expect(screen.getByText(/70%/)).toBeInTheDocument();
      expect(screen.getByText(/40%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();

      // Validate status icons
      const statusIcons = screen.getAllByText(/✓/); // completed agents
      expect(statusIcons.length).toBeGreaterThanOrEqual(3); // planner, architect, developer

      const parallelIcons = screen.getAllByText(/⟂/); // parallel agents + header
      expect(parallelIcons.length).toBe(5); // 1 header + 4 agents

      const activeIcon = screen.getByText(/⚡/); // active coordinator
      expect(activeIcon).toBeInTheDocument();
    });

    it('validates compact mode with parallel execution', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'dev', status: 'completed' },
        { name: 'ops', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'test1', status: 'parallel' },
        { name: 'test2', status: 'parallel' },
        { name: 'test3', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should not show section headers in compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Should show all agents in line with separators
      expect(screen.getByText('dev')).toBeInTheDocument();
      expect(screen.getByText('ops')).toBeInTheDocument();
      expect(screen.getByText('test1')).toBeInTheDocument();
      expect(screen.getByText('test2')).toBeInTheDocument();
      expect(screen.getByText('test3')).toBeInTheDocument();

      // Should show separators
      const separators = screen.getAllByText('│');
      expect(separators.length).toBeGreaterThanOrEqual(2); // Between main agents and before parallel section

      // Should show parallel indicator
      expect(screen.getByText('⟂')).toBeInTheDocument();
    });

    it('validates prop combinations and edge cases', () => {
      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={false}
          parallelAgents={[]}
        />
      );

      // Test 1: No agents, no parallel
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Test 2: Single parallel agent (should not show section)
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={[{ name: 'solo', status: 'parallel' }]}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Test 3: Multiple parallel agents (should show section)
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={[
            { name: 'agent1', status: 'parallel' },
            { name: 'agent2', status: 'parallel' },
          ]}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();

      // Test 4: showParallel=false should hide section
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={false}
          parallelAgents={[
            { name: 'agent1', status: 'parallel' },
            { name: 'agent2', status: 'parallel' },
          ]}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('validates integration with handoff animations', () => {
      // Mock the useAgentHandoff hook
      const mockUseAgentHandoff = vi.fn();
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.5,
        isFading: false,
      });

      // Mock the hook before component render
      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));

      const agents: AgentInfo[] = [
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'testing' },
        { name: 'deployer', status: 'parallel', stage: 'deployment' },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="reviewer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should call handoff hook with current agent
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('reviewer');

      // Should render both main and parallel sections during animation
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('deployer')).toBeInTheDocument();

      vi.doUnmock('../../../hooks/useAgentHandoff.js');
    });

    it('validates accessibility and usability features', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'accessibility-test-agent-1',
          status: 'parallel',
          stage: 'accessibility-testing',
          progress: 75
        },
        {
          name: 'accessibility-test-agent-2',
          status: 'parallel',
          stage: 'screen-reader-testing',
          progress: 60
        },
      ];

      render(
        <AgentPanel
          agents={[{ name: 'main-agent', status: 'active' }]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // All text should be accessible to screen readers
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('main-agent')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('accessibility-test-agent-1')).toBeInTheDocument();
      expect(screen.getByText('accessibility-test-agent-2')).toBeInTheDocument();
      expect(screen.getByText(/\(accessibility-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(screen-reader-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();

      // Visual indicators should be present
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active status
      const parallelIcons = screen.getAllByText(/⟂/);
      expect(parallelIcons.length).toBe(3); // header + 2 agents
    });
  });

  describe('Error Handling and Resilience', () => {
    it('handles malformed or incomplete agent data gracefully', () => {
      // Test with various edge cases in agent data
      const problematicAgents: AgentInfo[] = [
        { name: '', status: 'active' }, // empty name
        { name: 'agent-with-undefined-stage', status: 'parallel', stage: undefined },
        { name: 'agent-with-null-progress', status: 'parallel', progress: null as any },
        { name: 'agent-with-invalid-progress', status: 'parallel', progress: -10 },
        { name: 'agent-with-over-progress', status: 'parallel', progress: 150 },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'normal-parallel', status: 'parallel', stage: 'working', progress: 50 },
        { name: 'edge-parallel', status: 'parallel' }, // minimal data
      ];

      // Should not crash with problematic data
      expect(() => {
        render(
          <AgentPanel
            agents={problematicAgents}
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );
      }).not.toThrow();

      // Should still render valid content
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('normal-parallel')).toBeInTheDocument();
      expect(screen.getByText('edge-parallel')).toBeInTheDocument();
    });

    it('maintains stability during rapid prop changes', () => {
      const initialAgents: AgentInfo[] = [
        { name: 'initial-agent', status: 'active' },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={initialAgents}
          showParallel={false}
          parallelAgents={[]}
        />
      );

      // Rapidly change props multiple times
      for (let i = 0; i < 5; i++) {
        const dynamicParallelAgents: AgentInfo[] = Array.from({ length: i + 1 }, (_, index) => ({
          name: `dynamic-agent-${i}-${index}`,
          status: 'parallel' as const,
          progress: (i + 1) * 10 + index * 5,
        }));

        rerender(
          <AgentPanel
            agents={initialAgents}
            showParallel={i % 2 === 0}
            parallelAgents={dynamicParallelAgents}
            compact={i % 3 === 0}
            currentAgent={i % 2 === 0 ? 'initial-agent' : undefined}
          />
        );

        // Should maintain basic structure
        if (i % 3 !== 0) {
          expect(screen.getByText('Active Agents')).toBeInTheDocument();
        }
        expect(screen.getByText('initial-agent')).toBeInTheDocument();
      }
    });
  });

  describe('Performance and Scale Validation', () => {
    it('handles large numbers of agents efficiently', () => {
      // Create large agent lists to test performance
      const manyMainAgents: AgentInfo[] = Array.from({ length: 10 }, (_, i) => ({
        name: `main-agent-${i}`,
        status: i % 2 === 0 ? 'completed' : 'active',
        stage: `stage-${i}`,
        progress: i * 10,
      }));

      const manyParallelAgents: AgentInfo[] = Array.from({ length: 15 }, (_, i) => ({
        name: `parallel-agent-${i}`,
        status: 'parallel',
        stage: `parallel-stage-${i}`,
        progress: Math.min(99, (i + 1) * 6), // Keep under 100%
      }));

      const startTime = Date.now();

      render(
        <AgentPanel
          agents={manyMainAgents}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );

      const renderTime = Date.now() - startTime;

      // Should render quickly (under 100ms is reasonable for this test environment)
      expect(renderTime).toBeLessThan(100);

      // Should render all content
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Spot check some agents
      expect(screen.getByText('main-agent-0')).toBeInTheDocument();
      expect(screen.getByText('main-agent-9')).toBeInTheDocument();
      expect(screen.getByText('parallel-agent-0')).toBeInTheDocument();
      expect(screen.getByText('parallel-agent-14')).toBeInTheDocument();

      // Should have appropriate number of status icons
      const parallelIcons = screen.getAllByText(/⟂/);
      expect(parallelIcons.length).toBe(16); // 1 header + 15 agents
    });
  });
});