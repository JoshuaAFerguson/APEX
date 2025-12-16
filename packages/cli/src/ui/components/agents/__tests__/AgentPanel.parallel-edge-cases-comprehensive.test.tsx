/**
 * Comprehensive Edge Cases for Parallel Agent Execution
 *
 * This test suite focuses specifically on edge cases, boundary conditions,
 * and error scenarios for parallel agent execution state tracking.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Parallel Execution Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Boundary Value Testing', () => {
    it('handles progress boundary values (0, 1, 99, 100)', () => {
      const boundaryAgents: AgentInfo[] = [
        { name: 'agent-0', status: 'parallel', progress: 0 },
        { name: 'agent-1', status: 'parallel', progress: 1 },
        { name: 'agent-99', status: 'parallel', progress: 99 },
        { name: 'agent-100', status: 'parallel', progress: 100 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={boundaryAgents}
        />
      );

      // 0% and 100% should not be displayed
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
      expect(screen.queryByText('100%')).not.toBeInTheDocument();

      // 1% and 99% should be displayed
      expect(screen.getByText('1%')).toBeInTheDocument();
      expect(screen.getByText('99%')).toBeInTheDocument();

      // All agents should be present
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-1')).toBeInTheDocument();
      expect(screen.getByText('agent-99')).toBeInTheDocument();
      expect(screen.getByText('agent-100')).toBeInTheDocument();
    });

    it('handles invalid progress values gracefully', () => {
      const invalidProgressAgents: AgentInfo[] = [
        { name: 'negative-agent', status: 'parallel', progress: -10 },
        { name: 'overflow-agent', status: 'parallel', progress: 150 },
        { name: 'float-agent', status: 'parallel', progress: 45.7 },
        { name: 'infinity-agent', status: 'parallel', progress: Infinity },
        { name: 'nan-agent', status: 'parallel', progress: NaN },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={invalidProgressAgents}
          />
        );
      }).not.toThrow();

      // All agents should still render
      expect(screen.getByText('negative-agent')).toBeInTheDocument();
      expect(screen.getByText('overflow-agent')).toBeInTheDocument();
      expect(screen.getByText('float-agent')).toBeInTheDocument();
      expect(screen.getByText('infinity-agent')).toBeInTheDocument();
      expect(screen.getByText('nan-agent')).toBeInTheDocument();

      // Invalid values should be handled gracefully
      expect(screen.queryByText('-10%')).not.toBeInTheDocument(); // negative
      expect(screen.getByText('150%')).toBeInTheDocument(); // overflow (displayed as is)
      expect(screen.getByText('46%')).toBeInTheDocument(); // float rounded (45.7 -> 46%)
    });

    it('handles extremely long agent names and stages', () => {
      const longNameAgent: AgentInfo[] = [
        {
          name: 'extremely-long-agent-name-that-might-cause-layout-issues-in-the-ui-component',
          status: 'parallel',
          stage: 'extremely-long-stage-name-that-might-cause-wrapping-or-overflow-issues-in-the-display',
          progress: 50
        },
        {
          name: 'a'.repeat(100), // 100 character name
          status: 'parallel',
          stage: 'b'.repeat(200), // 200 character stage
          progress: 75
        },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={longNameAgent}
          />
        );
      }).not.toThrow();

      // Should handle long names gracefully
      expect(screen.getByText('extremely-long-agent-name-that-might-cause-layout-issues-in-the-ui-component')).toBeInTheDocument();
      expect(screen.getByText('a'.repeat(100))).toBeInTheDocument();
    });
  });

  describe('Temporal Edge Cases', () => {
    it('handles agents with future startedAt dates', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute in future
      const futureAgents: AgentInfo[] = [
        {
          name: 'future-agent',
          status: 'parallel',
          startedAt: futureDate,
          stage: 'time-travel-task'
        },
        {
          name: 'present-agent',
          status: 'parallel',
          startedAt: new Date(),
          stage: 'current-task'
        },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={futureAgents}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('future-agent')).toBeInTheDocument();
      expect(screen.getByText('present-agent')).toBeInTheDocument();
    });

    it('handles agents with very old startedAt dates', () => {
      const ancientDate = new Date('1970-01-01T00:00:00Z');
      const oldAgents: AgentInfo[] = [
        {
          name: 'ancient-agent',
          status: 'parallel',
          startedAt: ancientDate,
          stage: 'legacy-task'
        },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={oldAgents}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('ancient-agent')).toBeInTheDocument();
    });

    it('handles agents with invalid Date objects', () => {
      const invalidDateAgents: AgentInfo[] = [
        {
          name: 'invalid-date-agent',
          status: 'parallel',
          startedAt: new Date('invalid-date-string'),
          stage: 'invalid-time-task'
        },
        {
          name: 'null-date-agent',
          status: 'parallel',
          startedAt: null as any,
          stage: 'null-time-task'
        },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={invalidDateAgents}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('invalid-date-agent')).toBeInTheDocument();
      expect(screen.getByText('null-date-agent')).toBeInTheDocument();
    });
  });

  describe('State Consistency Edge Cases', () => {
    it('handles inconsistent status between main agents and parallel agents', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'consistent-agent', status: 'active', stage: 'main-task' },
        { name: 'duplicate-agent', status: 'completed', stage: 'finished-task' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'duplicate-agent', status: 'parallel', stage: 'parallel-task' }, // Same name, different status
        { name: 'parallel-only-agent', status: 'parallel', stage: 'side-task' },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={mainAgents}
            currentAgent="consistent-agent"
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );
      }).not.toThrow();

      // Both instances should be displayed
      expect(screen.getAllByText('duplicate-agent')).toHaveLength(2);
      expect(screen.getByText('consistent-agent')).toBeInTheDocument();
      expect(screen.getByText('parallel-only-agent')).toBeInTheDocument();
    });

    it('handles empty and undefined properties', () => {
      const emptyPropertyAgents: AgentInfo[] = [
        { name: '', status: 'parallel' }, // empty name
        { name: 'empty-stage-agent', status: 'parallel', stage: '' }, // empty stage
        { name: 'undefined-props-agent', status: 'parallel', stage: undefined, progress: undefined }, // undefined optional props
        { name: 'null-props-agent', status: 'parallel', stage: null as any, progress: null as any }, // null optional props
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={emptyPropertyAgents}
          />
        );
      }).not.toThrow();

      // Agents with valid names should render
      expect(screen.getByText('empty-stage-agent')).toBeInTheDocument();
      expect(screen.getByText('undefined-props-agent')).toBeInTheDocument();
      expect(screen.getByText('null-props-agent')).toBeInTheDocument();
    });

    it('handles circular references in agent data', () => {
      // Create objects with circular references (edge case for JSON serialization)
      const circularAgent: any = {
        name: 'circular-agent',
        status: 'parallel',
        stage: 'circular-task'
      };
      circularAgent.self = circularAgent; // circular reference

      const circularAgents: AgentInfo[] = [circularAgent];

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={circularAgents}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('circular-agent')).toBeInTheDocument();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles rapid creation and destruction of parallel agents', () => {
      const { rerender, unmount } = render(
        <AgentPanel agents={[]} showParallel={true} parallelAgents={[]} />
      );

      // Rapidly create and destroy agents
      for (let cycle = 0; cycle < 20; cycle++) {
        const rapidAgents: AgentInfo[] = Array.from({ length: 10 }, (_, i) => ({
          name: `rapid-${cycle}-${i}`,
          status: 'parallel' as const,
          stage: `cycle-${cycle}-task-${i}`,
          progress: Math.random() * 100,
          startedAt: new Date(Date.now() - Math.random() * 60000),
        }));

        expect(() => {
          rerender(
            <AgentPanel
              agents={[]}
              showParallel={true}
              parallelAgents={rapidAgents}
            />
          );
        }).not.toThrow();

        // Clear agents
        rerender(
          <AgentPanel agents={[]} showParallel={true} parallelAgents={[]} />
        );
      }

      // Should handle cleanup without memory leaks
      unmount();
    });

    it('handles deeply nested or complex agent objects', () => {
      const complexAgent: AgentInfo = {
        name: 'complex-agent',
        status: 'parallel',
        stage: 'complex-task',
        progress: 50,
        startedAt: new Date(),
        // Add extra properties that might be passed in
        ...(Array.from({ length: 100 }, (_, i) => ({ [`extra_prop_${i}`]: `value_${i}` })).reduce((acc, obj) => ({ ...acc, ...obj }), {}) as any)
      };

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={[complexAgent]}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('complex-agent')).toBeInTheDocument();
    });
  });

  describe('React State Management Edge Cases', () => {
    it('handles component unmount during parallel agent updates', () => {
      const { rerender, unmount } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={[{ name: 'unmount-test', status: 'parallel' }]}
        />
      );

      expect(screen.getByText('unmount-test')).toBeInTheDocument();

      // Unmount component during potential state update
      unmount();

      // Should not cause any errors
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('handles prop changes during component re-render cycles', () => {
      let renderCount = 0;

      const TestWrapper = ({ shouldRender }: { shouldRender: boolean }) => {
        renderCount++;

        if (!shouldRender) {
          return null;
        }

        return (
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={[
              { name: `render-${renderCount}`, status: 'parallel', stage: `cycle-${renderCount}` }
            ]}
          />
        );
      };

      const { rerender } = render(<TestWrapper shouldRender={true} />);

      // Cause multiple re-render cycles
      rerender(<TestWrapper shouldRender={false} />);
      rerender(<TestWrapper shouldRender={true} />);
      rerender(<TestWrapper shouldRender={false} />);
      rerender(<TestWrapper shouldRender={true} />);

      // Should handle re-render cycles gracefully
      expect(screen.queryByText(/render-/)).toBeInTheDocument();
    });
  });

  describe('Integration with React Hooks Edge Cases', () => {
    it('handles useElapsedTime hook edge cases', () => {
      const hookEdgeCaseAgents: AgentInfo[] = [
        {
          name: 'hook-test-1',
          status: 'parallel',
          startedAt: null as any, // Null start time
          stage: 'hook-task-1'
        },
        {
          name: 'hook-test-2',
          status: 'parallel',
          startedAt: undefined as any, // Undefined start time
          stage: 'hook-task-2'
        },
        {
          name: 'hook-test-3',
          status: 'parallel',
          startedAt: new Date('invalid'), // Invalid date
          stage: 'hook-task-3'
        },
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={hookEdgeCaseAgents}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('hook-test-1')).toBeInTheDocument();
      expect(screen.getByText('hook-test-2')).toBeInTheDocument();
      expect(screen.getByText('hook-test-3')).toBeInTheDocument();
    });

    it('handles handoff animation hook integration edge cases', () => {
      const mockUseAgentHandoff = vi.fn();

      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));

      // Test with various edge case return values
      const edgeReturnValues = [
        null,
        undefined,
        { isAnimating: null, previousAgent: undefined, currentAgent: null, progress: NaN, isFading: undefined },
        { isAnimating: true, previousAgent: '', currentAgent: '', progress: -1, isFading: true },
        { isAnimating: false, previousAgent: 'agent'.repeat(50), currentAgent: 'agent'.repeat(50), progress: Infinity, isFading: false },
      ];

      edgeReturnValues.forEach((returnValue, index) => {
        mockUseAgentHandoff.mockReturnValue(returnValue);

        expect(() => {
          render(
            <AgentPanel
              agents={[{ name: `edge-test-${index}`, status: 'active' }]}
              currentAgent={`edge-test-${index}`}
              showParallel={true}
              parallelAgents={[
                { name: 'edge-parallel-1', status: 'parallel' },
                { name: 'edge-parallel-2', status: 'parallel' },
              ]}
            />
          );
        }).not.toThrow();
      });

      vi.doUnmock('../../../hooks/useAgentHandoff.js');
    });
  });
});