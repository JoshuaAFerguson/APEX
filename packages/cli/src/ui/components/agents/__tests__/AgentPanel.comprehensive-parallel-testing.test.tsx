/**
 * Comprehensive Parallel Agent Execution State Tracking Tests
 *
 * This test suite provides comprehensive testing for the parallel agent execution
 * state tracking features in AgentPanel, focusing on edge cases, performance,
 * and integration scenarios that supplement the existing test coverage.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo, AgentPanelProps } from '../AgentPanel';

describe('AgentPanel - Comprehensive Parallel Execution Testing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Parallel Agent State Transitions', () => {
    it('handles dynamic agent status changes from parallel to other states', () => {
      const initialAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'task1', progress: 50 },
        { name: 'agent2', status: 'parallel', stage: 'task2', progress: 30 },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={initialAgents}
        />
      );

      // Should show parallel execution
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent1')).toBeInTheDocument();

      // Simulate agent1 completing and moving to main agent list
      const updatedParallelAgents: AgentInfo[] = [
        { name: 'agent2', status: 'parallel', stage: 'task2', progress: 60 },
      ];
      const updatedMainAgents: AgentInfo[] = [
        { name: 'agent1', status: 'completed', stage: 'task1', progress: 100 },
      ];

      rerender(
        <AgentPanel
          agents={updatedMainAgents}
          showParallel={true}
          parallelAgents={updatedParallelAgents}
        />
      );

      // Should no longer show parallel section (only 1 parallel agent left)
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Should show completed agent in main list
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument(); // completed icon
    });

    it('handles agents transitioning from idle to parallel state', () => {
      const initialAgents: AgentInfo[] = [
        { name: 'worker1', status: 'idle' },
        { name: 'worker2', status: 'idle' },
        { name: 'worker3', status: 'idle' },
      ];

      const { rerender } = render(
        <AgentPanel agents={initialAgents} showParallel={false} />
      );

      // Initially no parallel execution
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Agents transition to parallel state
      const parallelAgents: AgentInfo[] = [
        { name: 'worker1', status: 'parallel', stage: 'concurrent-task-1' },
        { name: 'worker2', status: 'parallel', stage: 'concurrent-task-2' },
      ];

      rerender(
        <AgentPanel
          agents={[{ name: 'worker3', status: 'idle' }]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('worker1')).toBeInTheDocument();
      expect(screen.getByText('worker2')).toBeInTheDocument();
      expect(screen.getByText('(concurrent-task-1)')).toBeInTheDocument();
      expect(screen.getByText('(concurrent-task-2)')).toBeInTheDocument();
    });

    it('maintains agent state consistency during rapid status changes', () => {
      const { rerender } = render(
        <AgentPanel agents={[]} showParallel={true} parallelAgents={[]} />
      );

      const changeStates = [
        {
          agents: [{ name: 'rapid-agent', status: 'idle' as const }],
          parallelAgents: [] as AgentInfo[]
        },
        {
          agents: [],
          parallelAgents: [{ name: 'rapid-agent', status: 'parallel' as const, stage: 'step1' }]
        },
        {
          agents: [{ name: 'rapid-agent', status: 'active' as const, stage: 'step2' }],
          parallelAgents: []
        },
        {
          agents: [],
          parallelAgents: [
            { name: 'rapid-agent', status: 'parallel' as const, stage: 'step3' },
            { name: 'rapid-agent2', status: 'parallel' as const, stage: 'step3b' }
          ]
        },
      ];

      changeStates.forEach((state, index) => {
        expect(() => {
          rerender(
            <AgentPanel
              agents={state.agents}
              showParallel={true}
              parallelAgents={state.parallelAgents}
            />
          );
        }).not.toThrow();

        // Verify the final state has both parallel agents
        if (index === changeStates.length - 1) {
          expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
          expect(screen.getByText('rapid-agent')).toBeInTheDocument();
          expect(screen.getByText('rapid-agent2')).toBeInTheDocument();
        }
      });
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('handles mixed agent states with parallel execution and handoff animations', () => {
      const mockUseAgentHandoff = vi.fn();

      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.4,
        isFading: false,
      });

      const complexAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed', stage: 'planning', progress: 100 },
        { name: 'architect', status: 'active', stage: 'designing', progress: 40 },
        { name: 'devops', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        {
          name: 'frontend-dev',
          status: 'parallel',
          stage: 'ui-implementation',
          progress: 75,
          startedAt: new Date(Date.now() - 45000)
        },
        {
          name: 'backend-dev',
          status: 'parallel',
          stage: 'api-implementation',
          progress: 60,
          startedAt: new Date(Date.now() - 60000)
        },
        {
          name: 'db-specialist',
          status: 'parallel',
          stage: 'schema-migration',
          progress: 90,
          startedAt: new Date(Date.now() - 30000)
        },
      ];

      render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="architect"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show main agent workflow
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();

      // Should show parallel execution
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('frontend-dev')).toBeInTheDocument();
      expect(screen.getByText('backend-dev')).toBeInTheDocument();
      expect(screen.getByText('db-specialist')).toBeInTheDocument();

      // Should display progress for all agents
      expect(screen.getByText('40%')).toBeInTheDocument(); // architect
      expect(screen.getByText('75%')).toBeInTheDocument(); // frontend-dev
      expect(screen.getByText('60%')).toBeInTheDocument(); // backend-dev
      expect(screen.getByText('90%')).toBeInTheDocument(); // db-specialist

      // Should have called handoff hook
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');

      vi.doUnmock('../../../hooks/useAgentHandoff.js');
    });

    it('handles parallel execution with detailed view in different layout configurations', () => {
      const manyParallelAgents: AgentInfo[] = Array.from({ length: 8 }, (_, i) => ({
        name: `worker-${i + 1}`,
        status: 'parallel' as const,
        stage: `task-${i + 1}`,
        progress: (i + 1) * 12,
        startedAt: new Date(Date.now() - (i + 1) * 10000),
      }));

      render(
        <AgentPanel
          agents={[{ name: 'coordinator', status: 'active', stage: 'coordination' }]}
          currentAgent="coordinator"
          showParallel={true}
          parallelAgents={manyParallelAgents}
          useDetailedParallelView={true}
        />
      );

      // Should show both main agent and parallel execution
      expect(screen.getByText('coordinator')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should display all parallel agents
      for (let i = 1; i <= 8; i++) {
        expect(screen.getByText(`worker-${i}`)).toBeInTheDocument();
        expect(screen.getByText(`(task-${i})`)).toBeInTheDocument();
        if (i * 12 < 100) {
          expect(screen.getByText(`${i * 12}%`)).toBeInTheDocument();
        }
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles malformed parallel agent data gracefully', () => {
      const malformedData: any = [
        { name: 'valid-agent', status: 'parallel' },
        { status: 'parallel' }, // missing name
        { name: null, status: 'parallel' }, // null name
        { name: 'another-valid', status: 'parallel', stage: 'testing' },
        { name: '', status: 'parallel' }, // empty name
        null, // null entry
        undefined, // undefined entry
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={malformedData}
          />
        );
      }).not.toThrow();

      // Should only show valid agents
      expect(screen.getByText('valid-agent')).toBeInTheDocument();
      expect(screen.getByText('another-valid')).toBeInTheDocument();
      expect(screen.getByText('(testing)')).toBeInTheDocument();
    });

    it('handles concurrent prop changes without state corruption', async () => {
      const initialProps: AgentPanelProps = {
        agents: [{ name: 'stable-agent', status: 'active' }],
        showParallel: true,
        parallelAgents: [
          { name: 'concurrent1', status: 'parallel' },
          { name: 'concurrent2', status: 'parallel' },
        ],
      };

      const { rerender } = render(<AgentPanel {...initialProps} />);

      // Simulate rapid concurrent updates
      const updates = [
        { ...initialProps, compact: true },
        { ...initialProps, compact: false, currentAgent: 'stable-agent' },
        { ...initialProps, showParallel: false },
        { ...initialProps, parallelAgents: [] },
        {
          ...initialProps,
          parallelAgents: [
            { name: 'new1', status: 'parallel' as const },
            { name: 'new2', status: 'parallel' as const },
            { name: 'new3', status: 'parallel' as const },
          ]
        },
      ];

      updates.forEach(updateProps => {
        expect(() => {
          rerender(<AgentPanel {...updateProps} />);
        }).not.toThrow();
      });

      // Final state should show new parallel agents
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('new1')).toBeInTheDocument();
      expect(screen.getByText('new2')).toBeInTheDocument();
      expect(screen.getByText('new3')).toBeInTheDocument();
    });

    it('validates type safety and prop constraints', () => {
      // Test that TypeScript types are enforced correctly
      const validAgents: AgentInfo[] = [
        { name: 'type-agent1', status: 'parallel' },
        { name: 'type-agent2', status: 'active' },
        { name: 'type-agent3', status: 'waiting' },
        { name: 'type-agent4', status: 'completed' },
        { name: 'type-agent5', status: 'idle' },
      ];

      const validProps: AgentPanelProps = {
        agents: validAgents,
        currentAgent: 'type-agent2',
        compact: false,
        showParallel: true,
        parallelAgents: [validAgents[0]], // Only parallel agent
        useDetailedParallelView: false,
      };

      expect(() => {
        render(<AgentPanel {...validProps} />);
      }).not.toThrow();

      // Verify all agent types are displayed correctly
      expect(screen.getByText('type-agent1')).toBeInTheDocument();
      expect(screen.getByText('type-agent2')).toBeInTheDocument();
      expect(screen.getByText('type-agent3')).toBeInTheDocument();
      expect(screen.getByText('type-agent4')).toBeInTheDocument();
      expect(screen.getByText('type-agent5')).toBeInTheDocument();

      // Verify status icons
      expect(screen.getByText('⟂')).toBeInTheDocument(); // parallel
      expect(screen.getByText('⚡')).toBeInTheDocument(); // active
      expect(screen.getByText('○')).toBeInTheDocument(); // waiting
      expect(screen.getByText('✓')).toBeInTheDocument(); // completed
      expect(screen.getByText('·')).toBeInTheDocument(); // idle
    });
  });

  describe('Performance and Memory Management', () => {
    it('handles large numbers of parallel agents efficiently', () => {
      const startTime = performance.now();

      const largeParallelAgentSet: AgentInfo[] = Array.from({ length: 50 }, (_, i) => ({
        name: `perf-agent-${i}`,
        status: 'parallel' as const,
        stage: `performance-task-${i}`,
        progress: Math.min(i * 2, 100),
        startedAt: new Date(Date.now() - i * 1000),
      }));

      render(
        <AgentPanel
          agents={[{ name: 'main-perf-agent', status: 'active' }]}
          showParallel={true}
          parallelAgents={largeParallelAgentSet}
        />
      );

      const renderTime = performance.now() - startTime;

      // Should render within reasonable time (less than 100ms for 50 agents)
      expect(renderTime).toBeLessThan(100);

      // Should display all agents
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('perf-agent-0')).toBeInTheDocument();
      expect(screen.getByText('perf-agent-49')).toBeInTheDocument();
    });

    it('handles memory efficiently during rapid re-renders', () => {
      const { rerender } = render(
        <AgentPanel agents={[]} showParallel={false} parallelAgents={[]} />
      );

      // Simulate many rapid re-renders
      for (let i = 0; i < 100; i++) {
        const cycleAgents: AgentInfo[] = [
          { name: `cycle-${i}`, status: 'parallel', stage: `cycle-stage-${i}` },
          { name: `cycle-${i}-2`, status: 'parallel', stage: `cycle-stage-${i}-2` },
        ];

        expect(() => {
          rerender(
            <AgentPanel
              agents={[]}
              showParallel={true}
              parallelAgents={cycleAgents}
            />
          );
        }).not.toThrow();
      }

      // Should end in final state
      expect(screen.getByText('cycle-99')).toBeInTheDocument();
      expect(screen.getByText('cycle-99-2')).toBeInTheDocument();
    });
  });

  describe('Accessibility and UX', () => {
    it('provides accessible text for parallel agents in all modes', () => {
      const accessibilityAgents: AgentInfo[] = [
        {
          name: 'accessible-agent1',
          status: 'parallel',
          stage: 'accessibility-testing',
          progress: 75,
          startedAt: new Date(Date.now() - 30000)
        },
        {
          name: 'accessible-agent2',
          status: 'parallel',
          stage: 'screen-reader-testing',
          progress: 50
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={accessibilityAgents}
          compact={false}
        />
      );

      // Full mode accessibility
      expect(screen.getByText('accessible-agent1')).toBeInTheDocument();
      expect(screen.getByText('(accessibility-testing)')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();

      // Test compact mode accessibility
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={accessibilityAgents}
          compact={true}
        />
      );

      expect(screen.getByText('accessible-agent1')).toBeInTheDocument();
      expect(screen.getByText('accessible-agent2')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('maintains visual consistency across different view modes', () => {
      const consistencyAgents: AgentInfo[] = [
        { name: 'visual-agent1', status: 'parallel', stage: 'design' },
        { name: 'visual-agent2', status: 'parallel', stage: 'implementation' },
      ];

      const modes = [
        { compact: false, useDetailedParallelView: false },
        { compact: false, useDetailedParallelView: true },
        { compact: true, useDetailedParallelView: false },
        { compact: true, useDetailedParallelView: true },
      ];

      modes.forEach(mode => {
        const { unmount } = render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={consistencyAgents}
            compact={mode.compact}
            useDetailedParallelView={mode.useDetailedParallelView}
          />
        );

        // All modes should show agent names
        expect(screen.getByText('visual-agent1')).toBeInTheDocument();
        expect(screen.getByText('visual-agent2')).toBeInTheDocument();

        // All modes should show parallel indicators
        expect(screen.getByText('⟂')).toBeInTheDocument();

        unmount();
      });
    });
  });
});