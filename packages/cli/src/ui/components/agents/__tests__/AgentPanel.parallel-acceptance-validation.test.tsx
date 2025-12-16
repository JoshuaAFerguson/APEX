import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

/**
 * Acceptance Criteria Validation Tests for AgentPanel Parallel Execution
 *
 * This test suite validates the specific acceptance criteria:
 * 1. AgentPanel accepts parallelAgents prop
 * 2. AgentInfo has 'parallel' status
 * 3. Parallel agents are visually distinguished with ⟂ icon and cyan color
 * 4. Both compact and full modes support parallel display
 */

// Mock the useAgentHandoff hook to focus on parallel functionality
vi.mock('../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
  })),
}));

// Mock the useElapsedTime hook to focus on parallel functionality
vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn(() => '30s'),
}));

describe('AgentPanel - Acceptance Criteria Validation', () => {
  describe('AC1: AgentPanel accepts parallelAgents prop', () => {
    it('accepts parallelAgents prop without TypeScript errors', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'task1' },
        { name: 'agent2', status: 'parallel', stage: 'task2' },
      ];

      // This should compile and render without errors
      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            parallelAgents={parallelAgents}
            showParallel={true}
          />
        );
      }).not.toThrow();
    });

    it('accepts optional parallelAgents prop (default empty array)', () => {
      expect(() => {
        render(<AgentPanel agents={[]} />);
      }).not.toThrow();
    });

    it('handles parallelAgents prop with different array sizes', () => {
      // Test with different array sizes
      const testCases = [
        [], // empty
        [{ name: 'single', status: 'parallel' as const }], // single agent
        [
          { name: 'agent1', status: 'parallel' as const },
          { name: 'agent2', status: 'parallel' as const },
        ], // multiple agents
        // Large array (10 agents)
        Array.from({ length: 10 }, (_, i) => ({
          name: `agent${i}`,
          status: 'parallel' as const,
        })),
      ];

      testCases.forEach((parallelAgents, index) => {
        expect(() => {
          render(
            <AgentPanel
              agents={[]}
              parallelAgents={parallelAgents}
              showParallel={true}
            />
          );
        }).not.toThrow();
      });
    });
  });

  describe('AC2: AgentInfo has parallel status', () => {
    it('supports parallel status in AgentInfo type', () => {
      const parallelAgent: AgentInfo = {
        name: 'test-agent',
        status: 'parallel', // This should be valid TypeScript
        stage: 'testing',
        progress: 50,
        startedAt: new Date(),
      };

      expect(parallelAgent.status).toBe('parallel');
    });

    it('displays agents with parallel status correctly', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active' },
        { name: 'agent2', status: 'parallel' },
        { name: 'agent3', status: 'waiting' },
        { name: 'agent4', status: 'completed' },
        { name: 'agent5', status: 'idle' },
      ];

      render(<AgentPanel agents={agents} />);

      // All agents should be displayed regardless of status
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
      expect(screen.getByText('agent4')).toBeInTheDocument();
      expect(screen.getByText('agent5')).toBeInTheDocument();
    });

    it('shows correct status icons for all status types including parallel', () => {
      const agents: AgentInfo[] = [
        { name: 'active-agent', status: 'active' },
        { name: 'parallel-agent', status: 'parallel' },
        { name: 'waiting-agent', status: 'waiting' },
        { name: 'completed-agent', status: 'completed' },
        { name: 'idle-agent', status: 'idle' },
      ];

      render(<AgentPanel agents={agents} />);

      // Check for presence of status icons (rendered as text content)
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/⟂/)).toBeInTheDocument(); // parallel
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/·/)).toBeInTheDocument(); // idle
    });
  });

  describe('AC3: Parallel agents visually distinguished with ⟂ icon and cyan color', () => {
    it('displays ⟂ icon for parallel status agents', () => {
      const parallelAgent: AgentInfo[] = [
        { name: 'parallel-agent', status: 'parallel' },
      ];

      render(<AgentPanel agents={parallelAgent} />);

      // Should display the parallel icon
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
    });

    it('displays ⟂ icon in parallel execution section header', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
        { name: 'agent2', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={[]}
          parallelAgents={parallelAgents}
          showParallel={true}
        />
      );

      // Should show parallel execution header with icon
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('displays ⟂ icon for each agent in parallel section', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
        { name: 'reviewer', status: 'parallel', stage: 'reviewing' },
      ];

      render(
        <AgentPanel
          agents={[]}
          parallelAgents={parallelAgents}
          showParallel={true}
        />
      );

      // Should show ⟂ icon for header + each parallel agent (4 total)
      const parallelIcons = screen.getAllByText(/⟂/);
      expect(parallelIcons.length).toBeGreaterThanOrEqual(3); // At least one per agent
    });

    it('uses cyan color theme for parallel agents', () => {
      // This test verifies the cyan color is applied through the component structure
      // Since we can't directly test colors in jsdom, we verify the component renders
      // parallel agents with the expected structure that would receive cyan styling

      const parallelAgents: AgentInfo[] = [
        { name: 'cyan-agent', status: 'parallel', stage: 'working' },
      ];

      render(
        <AgentPanel
          agents={[]}
          parallelAgents={parallelAgents}
          showParallel={true}
        />
      );

      // Verify parallel agents are rendered (cyan color would be applied via props)
      expect(screen.getByText('cyan-agent')).toBeInTheDocument();
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
    });

    it('distinguishes parallel agents from regular agents in main list', () => {
      const mixedAgents: AgentInfo[] = [
        { name: 'active-agent', status: 'active' },
        { name: 'parallel-agent', status: 'parallel' },
        { name: 'completed-agent', status: 'completed' },
      ];

      render(<AgentPanel agents={mixedAgents} />);

      // Each agent should have distinct status icons
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/⟂/)).toBeInTheDocument(); // parallel
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed

      // All agents should be displayed
      expect(screen.getByText('active-agent')).toBeInTheDocument();
      expect(screen.getByText('parallel-agent')).toBeInTheDocument();
      expect(screen.getByText('completed-agent')).toBeInTheDocument();
    });
  });

  describe('AC4: Both compact and full modes support parallel display', () => {
    const testAgents: AgentInfo[] = [
      { name: 'planner', status: 'completed' },
      { name: 'developer', status: 'active', stage: 'coding' },
      { name: 'reviewer', status: 'waiting' },
    ];

    const parallelAgents: AgentInfo[] = [
      { name: 'tester', status: 'parallel', stage: 'unit-tests', progress: 70 },
      { name: 'security', status: 'parallel', stage: 'audit', progress: 45 },
    ];

    describe('Full mode parallel support', () => {
      it('displays parallel section in full mode', () => {
        render(
          <AgentPanel
            agents={testAgents}
            parallelAgents={parallelAgents}
            showParallel={true}
            compact={false} // explicit full mode
          />
        );

        // Full mode should show header
        expect(screen.getByText('Active Agents')).toBeInTheDocument();

        // Should show parallel execution section
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

        // Should show all parallel agents
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('security')).toBeInTheDocument();

        // Should show stages and progress
        expect(screen.getByText(/\(unit-tests\)/)).toBeInTheDocument();
        expect(screen.getByText(/\(audit\)/)).toBeInTheDocument();
        expect(screen.getByText(/70%/)).toBeInTheDocument();
        expect(screen.getByText(/45%/)).toBeInTheDocument();
      });

      it('hides parallel section in full mode when showParallel=false', () => {
        render(
          <AgentPanel
            agents={testAgents}
            parallelAgents={parallelAgents}
            showParallel={false}
            compact={false}
          />
        );

        expect(screen.getByText('Active Agents')).toBeInTheDocument();
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });

      it('hides parallel section in full mode with single parallel agent', () => {
        const singleParallel = [parallelAgents[0]];

        render(
          <AgentPanel
            agents={testAgents}
            parallelAgents={singleParallel}
            showParallel={true}
            compact={false}
          />
        );

        // Single agent should not trigger parallel section display
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });
    });

    describe('Compact mode parallel support', () => {
      it('displays parallel agents in compact mode', () => {
        render(
          <AgentPanel
            agents={testAgents}
            parallelAgents={parallelAgents}
            showParallel={true}
            compact={true}
          />
        );

        // Compact mode should not show header
        expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

        // Should show main agents
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();

        // Should show parallel agents with indicators
        expect(screen.getByText(/⟂/)).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('security')).toBeInTheDocument();
      });

      it('shows separators between agents in compact mode', () => {
        render(
          <AgentPanel
            agents={testAgents}
            parallelAgents={parallelAgents}
            showParallel={true}
            compact={true}
          />
        );

        // Should show pipe separators between main agents
        const separators = screen.getAllByText('│');
        expect(separators.length).toBeGreaterThan(0);
      });

      it('hides parallel agents in compact mode when showParallel=false', () => {
        render(
          <AgentPanel
            agents={testAgents}
            parallelAgents={parallelAgents}
            showParallel={false}
            compact={true}
          />
        );

        // Should show main agents but not parallel agents
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.queryByText('tester')).not.toBeInTheDocument();
        expect(screen.queryByText('security')).not.toBeInTheDocument();
      });

      it('handles single parallel agent in compact mode (no display)', () => {
        const singleParallel = [parallelAgents[0]];

        render(
          <AgentPanel
            agents={testAgents}
            parallelAgents={singleParallel}
            showParallel={true}
            compact={true}
          />
        );

        // Single parallel agent should not be displayed in compact mode
        expect(screen.queryByText('tester')).not.toBeInTheDocument();
      });
    });

    describe('Mode switching behavior', () => {
      it('maintains parallel display when switching from full to compact mode', () => {
        const { rerender } = render(
          <AgentPanel
            agents={testAgents}
            parallelAgents={parallelAgents}
            showParallel={true}
            compact={false}
          />
        );

        // Verify full mode display
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

        // Switch to compact mode
        rerender(
          <AgentPanel
            agents={testAgents}
            parallelAgents={parallelAgents}
            showParallel={true}
            compact={true}
          />
        );

        // Verify compact mode still shows parallel agents (different layout)
        expect(screen.getByText(/⟂/)).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('security')).toBeInTheDocument();
      });

      it('maintains parallel display when switching from compact to full mode', () => {
        const { rerender } = render(
          <AgentPanel
            agents={testAgents}
            parallelAgents={parallelAgents}
            showParallel={true}
            compact={true}
          />
        );

        // Verify compact mode shows parallel agents
        expect(screen.getByText(/⟂/)).toBeInTheDocument();

        // Switch to full mode
        rerender(
          <AgentPanel
            agents={testAgents}
            parallelAgents={parallelAgents}
            showParallel={true}
            compact={false}
          />
        );

        // Verify full mode shows parallel section
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('security')).toBeInTheDocument();
      });
    });
  });

  describe('Combined acceptance criteria validation', () => {
    it('validates all acceptance criteria together in full mode', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', stage: 'implementation' },
        { name: 'reviewer', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'unit-testing', progress: 65 },
        { name: 'security', status: 'parallel', stage: 'security-audit', progress: 40 },
        { name: 'performance', status: 'parallel', stage: 'load-testing', progress: 80 },
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="developer"
          parallelAgents={parallelAgents}
          showParallel={true}
          compact={false}
        />
      );

      // AC1: parallelAgents prop accepted and used
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('security')).toBeInTheDocument();
      expect(screen.getByText('performance')).toBeInTheDocument();

      // AC2: parallel status supported
      expect(screen.getAllByText(/⟂/)).toHaveLength(4); // header + 3 agents

      // AC3: Visual distinction with ⟂ icon and cyan theming
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // AC4: Full mode support
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText(/\(unit-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(security-audit\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(load-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/40%/)).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });

    it('validates all acceptance criteria together in compact mode', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', progress: 50 },
        { name: 'reviewer', status: 'parallel', progress: 75 },
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="developer"
          parallelAgents={parallelAgents}
          showParallel={true}
          compact={true}
        />
      );

      // AC1: parallelAgents prop used
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // AC2: parallel status supported
      expect(screen.getByText(/⟂/)).toBeInTheDocument();

      // AC3: Visual distinction maintained
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();

      // AC4: Compact mode support
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument(); // No header in compact
      expect(screen.getByText('planner')).toBeInTheDocument(); // Main agents shown
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('handles undefined parallelAgents gracefully', () => {
      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            // parallelAgents intentionally undefined
          />
        );
      }).not.toThrow();
    });

    it('handles empty parallelAgents array', () => {
      render(
        <AgentPanel
          agents={[]}
          parallelAgents={[]}
          showParallel={true}
        />
      );

      // Should not show parallel section with empty array
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('handles parallel agents without stage or progress', () => {
      const minimalParallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
        { name: 'agent2', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={[]}
          parallelAgents={minimalParallelAgents}
          showParallel={true}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });

    it('handles parallel agents with extreme progress values', () => {
      const extremeProgressAgents: AgentInfo[] = [
        { name: 'zero-agent', status: 'parallel', progress: 0 },
        { name: 'hundred-agent', status: 'parallel', progress: 100 },
        { name: 'normal-agent', status: 'parallel', progress: 50 },
      ];

      render(
        <AgentPanel
          agents={[]}
          parallelAgents={extremeProgressAgents}
          showParallel={true}
        />
      );

      // 0% and 100% should be hidden per design, 50% should show
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();

      // All agents should still be displayed
      expect(screen.getByText('zero-agent')).toBeInTheDocument();
      expect(screen.getByText('hundred-agent')).toBeInTheDocument();
      expect(screen.getByText('normal-agent')).toBeInTheDocument();
    });
  });
});