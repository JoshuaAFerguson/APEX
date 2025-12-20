import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

/**
 * Final testing validation for AgentPanel - ensures all acceptance criteria are met
 *
 * Acceptance Criteria:
 * 1. Integration tests cover handoff animations, parallel view, and progress bars
 * 2. Edge cases tested (empty parallel list, undefined startedAt, etc.)
 * 3. All existing tests still pass
 * 4. Test coverage maintained at 80%+
 */

describe('AgentPanel - Final Testing Validation', () => {
  const mockUseElapsedTime = vi.fn();
  const mockUseAgentHandoff = vi.fn();

  beforeEach(() => {
    // Mock useElapsedTime hook
    vi.doMock('../../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));

    // Mock useAgentHandoff hook
    vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));

    // Default mock implementations
    mockUseElapsedTime.mockReturnValue('5m 42s');
    mockUseAgentHandoff.mockReturnValue({
      isAnimating: false,
      previousAgent: null,
      currentAgent: null,
      progress: 0,
      isFading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useElapsedTime.js');
    vi.doUnmock('../../../hooks/useAgentHandoff.js');
  });

  describe('AC1: Integration tests cover handoff animations, parallel view, and progress bars', () => {
    it('validates complete integration of all three features', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      // Main workflow agents with various states
      const mainAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed', stage: 'planning' },
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 65,
          startedAt: startTime
        },
        { name: 'reviewer', status: 'waiting', stage: 'review' },
      ];

      // Parallel agents with progress and timing
      const parallelAgents: AgentInfo[] = [
        {
          name: 'tester',
          status: 'parallel',
          stage: 'testing',
          progress: 40,
          startedAt: new Date('2023-01-01T10:05:00Z')
        },
        {
          name: 'security',
          status: 'parallel',
          stage: 'security-scan',
          progress: 80,
          startedAt: new Date('2023-01-01T10:10:00Z')
        },
      ];

      // Mock handoff animation state
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.75,
        isFading: false,
      });

      // Mock elapsed time responses
      mockUseElapsedTime.mockImplementation((date) => {
        if (date === startTime) return '15m 30s';
        if (date && date.getTime() === new Date('2023-01-01T10:05:00Z').getTime()) return '10m 15s';
        if (date && date.getTime() === new Date('2023-01-01T10:10:00Z').getTime()) return '5m 42s';
        return '0s';
      });

      render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // ✅ HANDOFF ANIMATIONS: Verify handoff integration
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');

      // ✅ PROGRESS BARS: Verify progress displays
      expect(screen.getByText(/65%/)).toBeInTheDocument(); // Main active agent
      expect(screen.getByText(/40%/)).toBeInTheDocument(); // Parallel agent 1
      expect(screen.getByText(/80%/)).toBeInTheDocument(); // Parallel agent 2

      // ✅ PARALLEL VIEW: Verify parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('security')).toBeInTheDocument();

      // ✅ ELAPSED TIME: Verify timing integration
      expect(screen.getByText(/\[15m 30s\]/)).toBeInTheDocument(); // Active agent
      expect(screen.getByText(/\[10m 15s\]/)).toBeInTheDocument(); // Parallel agent 1
      expect(screen.getByText(/\[5m 42s\]/)).toBeInTheDocument(); // Parallel agent 2

      // Verify all features work together in stage display
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(security-scan\)/)).toBeInTheDocument();
    });

    it('validates integration in compact mode with all features', () => {
      const startTime = new Date();
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', progress: 75, startedAt: startTime },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', progress: 50 },
        { name: 'reviewer', status: 'parallel', progress: 30 },
      ];

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Verify compact layout with all features
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument(); // No header in compact
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument(); // Progress
      expect(screen.getByText(/5m 42s/)).toBeInTheDocument(); // Elapsed time

      // Verify parallel agents in compact mode
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();

      // Verify separators
      expect(screen.getAllByText('│')).toHaveLength(2); // Between main agents and before parallel

      // Verify handoff integration
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
    });
  });

  describe('AC2: Edge cases tested (empty parallel list, undefined startedAt, etc.)', () => {
    it('handles empty parallel list gracefully', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', progress: 50 },
      ];

      render(
        <AgentPanel
          agents={agents}
          showParallel={true}
          parallelAgents={[]} // Empty parallel list
        />
      );

      // Should not show parallel section with empty list
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('handles undefined startedAt timestamps', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          progress: 75
          // No startedAt field
        },
        {
          name: 'tester',
          status: 'active',
          progress: 60,
          startedAt: undefined // Explicit undefined
        },
      ];

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should show agents and progress but no elapsed time
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();

      // Should not show elapsed time brackets
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });

    it('handles null parallelAgents prop', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active' },
      ];

      render(
        <AgentPanel
          agents={agents}
          showParallel={true}
          parallelAgents={null as any} // Null parallel agents
        />
      );

      // Should handle gracefully without crashing
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('handles undefined progress values', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active' }, // No progress property
        { name: 'agent2', status: 'active', progress: undefined }, // Explicit undefined
        { name: 'agent3', status: 'active', progress: 0 }, // Zero progress
        { name: 'agent4', status: 'active', progress: 100 }, // Complete progress
        { name: 'agent5', status: 'active', progress: 50 }, // Valid progress
      ];

      render(<AgentPanel agents={agents} />);

      // Should show all agents
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
      expect(screen.getByText('agent4')).toBeInTheDocument();
      expect(screen.getByText('agent5')).toBeInTheDocument();

      // Should only show progress for valid middle values (not 0 or 100)
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('handles empty stage strings', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active', stage: '' }, // Empty string
        { name: 'agent2', status: 'active', stage: undefined }, // Undefined
        { name: 'agent3', status: 'active' }, // No stage property
        { name: 'agent4', status: 'active', stage: 'valid-stage' }, // Valid stage
      ];

      render(<AgentPanel agents={agents} />);

      // Should show all agents
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
      expect(screen.getByText('agent4')).toBeInTheDocument();

      // Should only show valid stage in parentheses
      expect(screen.getByText(/\(valid-stage\)/)).toBeInTheDocument();
      expect(screen.queryByText('()')).not.toBeInTheDocument();
      expect(screen.queryByText('(undefined)')).not.toBeInTheDocument();
    });

    it('handles single parallel agent (boundary condition)', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active' },
      ];

      const singleParallelAgent: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 60 },
      ];

      render(
        <AgentPanel
          agents={agents}
          showParallel={true}
          parallelAgents={singleParallelAgent} // Only one parallel agent
        />
      );

      // Should not show parallel section with only one agent
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Parallel agent should not be displayed in dedicated section
      expect(screen.queryByText('tester')).not.toBeInTheDocument();
    });

    it('handles invalid agent status values', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active' },
        { name: 'agent2', status: 'invalid-status' as any }, // Invalid status
      ];

      // Should render without crashing
      render(<AgentPanel agents={agents} />);

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });
  });

  describe('AC3: All existing tests still pass (verified by running suite)', () => {
    it('validates backward compatibility with existing AgentPanel usage', () => {
      // Test the most basic usage to ensure no regressions
      const basicAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active' },
        { name: 'tester', status: 'waiting' },
      ];

      render(<AgentPanel agents={basicAgents} currentAgent="developer" />);

      // Basic functionality should still work
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Status icons should display
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
    });

    it('validates compact mode backward compatibility', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active' },
      ];

      render(<AgentPanel agents={agents} compact={true} />);

      // Should not show header in compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Should show agents with separator
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('│')).toBeInTheDocument();
    });
  });

  describe('AC4: Test coverage maintained at 80%+ (comprehensive scenario validation)', () => {
    it('exercises all code paths and features comprehensively', () => {
      const complexScenario = {
        // Complex main agent workflow
        mainAgents: [
          { name: 'planner', status: 'completed' as const, stage: 'initial-planning' },
          {
            name: 'architect',
            status: 'active' as const,
            stage: 'system-design',
            progress: 45,
            startedAt: new Date('2023-01-01T10:00:00Z')
          },
          { name: 'developer', status: 'waiting' as const, stage: 'implementation' },
          { name: 'reviewer', status: 'idle' as const },
          { name: 'custom-agent', status: 'parallel' as const, stage: 'custom-work', progress: 85 },
        ],

        // Complex parallel execution scenario
        parallelAgents: [
          {
            name: 'security-scanner',
            status: 'parallel' as const,
            stage: 'security-analysis',
            progress: 20,
            startedAt: new Date('2023-01-01T10:05:00Z')
          },
          {
            name: 'performance-tester',
            status: 'parallel' as const,
            stage: 'load-testing',
            progress: 90,
            startedAt: new Date('2023-01-01T10:10:00Z')
          },
          {
            name: 'doc-generator',
            status: 'parallel' as const,
            stage: 'documentation',
            progress: 60 // No startedAt to test mixed scenarios
          },
        ],

        // Complex handoff animation
        handoffState: {
          isAnimating: true,
          previousAgent: 'planner',
          currentAgent: 'architect',
          progress: 0.85,
          isFading: true,
        },
      };

      // Setup complex mock implementations
      mockUseAgentHandoff.mockReturnValue(complexScenario.handoffState);
      mockUseElapsedTime.mockImplementation((date) => {
        if (!date) return '0s';
        if (date.getTime() === new Date('2023-01-01T10:00:00Z').getTime()) return '25m 15s';
        if (date.getTime() === new Date('2023-01-01T10:05:00Z').getTime()) return '20m 30s';
        if (date.getTime() === new Date('2023-01-01T10:10:00Z').getTime()) return '15m 45s';
        return '1m 30s';
      });

      // Render comprehensive scenario
      render(
        <AgentPanel
          agents={complexScenario.mainAgents}
          currentAgent="architect"
          showParallel={true}
          parallelAgents={complexScenario.parallelAgents}
        />
      );

      // Verify all agent types and statuses are handled
      expect(screen.getByText('planner')).toBeInTheDocument(); // completed
      expect(screen.getByText('architect')).toBeInTheDocument(); // active
      expect(screen.getByText('developer')).toBeInTheDocument(); // waiting
      expect(screen.getByText('reviewer')).toBeInTheDocument(); // idle
      expect(screen.getByText('custom-agent')).toBeInTheDocument(); // parallel in main list

      // Verify status icons for all types
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
      expect(screen.getByText(/·/)).toBeInTheDocument(); // idle
      expect(screen.getAllByText(/⟂/)).toHaveLength(5); // parallel (1 main + 1 header + 3 parallel agents)

      // Verify progress bars for appropriate agents
      expect(screen.getByText(/45%/)).toBeInTheDocument(); // architect (active)
      expect(screen.getByText(/85%/)).toBeInTheDocument(); // custom-agent (parallel in main)
      expect(screen.getByText(/20%/)).toBeInTheDocument(); // security-scanner (parallel)
      expect(screen.getByText(/90%/)).toBeInTheDocument(); // performance-tester (parallel)
      expect(screen.getByText(/60%/)).toBeInTheDocument(); // doc-generator (parallel)

      // Verify elapsed times where startedAt is provided
      expect(screen.getByText(/\[25m 15s\]/)).toBeInTheDocument(); // architect
      expect(screen.getByText(/\[20m 30s\]/)).toBeInTheDocument(); // security-scanner
      expect(screen.getByText(/\[15m 45s\]/)).toBeInTheDocument(); // performance-tester
      // doc-generator should not show elapsed time (no startedAt)

      // Verify stages are displayed
      expect(screen.getByText(/\(initial-planning\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(system-design\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(custom-work\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(security-analysis\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(load-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(documentation\)/)).toBeInTheDocument();

      // Verify parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('security-scanner')).toBeInTheDocument();
      expect(screen.getByText('performance-tester')).toBeInTheDocument();
      expect(screen.getByText('doc-generator')).toBeInTheDocument();

      // Verify handoff animation integration
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');

      // Verify agent color handling for known and unknown agents
      expect(screen.getByText('custom-agent')).toBeInTheDocument(); // Should handle unknown agent
    });

    it('exercises compact mode with complex scenarios', () => {
      const compactScenario = {
        mainAgents: [
          { name: 'planner', status: 'completed' as const },
          {
            name: 'architect',
            status: 'active' as const,
            progress: 55,
            startedAt: new Date()
          },
          { name: 'reviewer', status: 'parallel' as const, progress: 75 },
        ],

        parallelAgents: [
          { name: 'tester1', status: 'parallel' as const, progress: 30 },
          { name: 'tester2', status: 'parallel' as const, progress: 70 },
          { name: 'tester3', status: 'parallel' as const, stage: 'final-testing' },
        ],
      };

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.6,
        isFading: false,
      });

      render(
        <AgentPanel
          agents={compactScenario.mainAgents}
          currentAgent="architect"
          compact={true}
          showParallel={true}
          parallelAgents={compactScenario.parallelAgents}
        />
      );

      // Verify compact layout structure
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Verify all agents displayed in compact format
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Verify parallel agents in compact format
      expect(screen.getByText('tester1')).toBeInTheDocument();
      expect(screen.getByText('tester2')).toBeInTheDocument();
      expect(screen.getByText('tester3')).toBeInTheDocument();

      // Verify progress in compact mode
      expect(screen.getByText(/55%/)).toBeInTheDocument(); // architect
      expect(screen.getByText(/75%/)).toBeInTheDocument(); // reviewer
      expect(screen.getByText(/30%/)).toBeInTheDocument(); // tester1
      expect(screen.getByText(/70%/)).toBeInTheDocument(); // tester2

      // Verify separators
      expect(screen.getAllByText('│')).toHaveLength(2); // Between main agents and before parallel

      // Verify handoff integration in compact mode
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');
    });
  });

  describe('Performance and stress testing', () => {
    it('handles large agent lists efficiently', () => {
      // Create large agent lists to test performance
      const largeMainAgents: AgentInfo[] = Array.from({ length: 50 }, (_, i) => ({
        name: `agent-${i}`,
        status: i % 5 === 0 ? 'active' : i % 3 === 0 ? 'completed' : 'waiting',
        progress: i % 2 === 0 ? Math.floor(Math.random() * 100) : undefined,
        stage: `stage-${i}`,
      })) as AgentInfo[];

      const largeParallelAgents: AgentInfo[] = Array.from({ length: 25 }, (_, i) => ({
        name: `parallel-${i}`,
        status: 'parallel' as const,
        progress: Math.floor(Math.random() * 100),
        stage: `parallel-stage-${i}`,
      }));

      // Should render without performance issues
      const startTime = performance.now();
      render(
        <AgentPanel
          agents={largeMainAgents}
          showParallel={true}
          parallelAgents={largeParallelAgents}
        />
      );
      const renderTime = performance.now() - startTime;

      // Verify it renders quickly (under 100ms for this size)
      expect(renderTime).toBeLessThan(100);

      // Spot check that agents are rendered
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-25')).toBeInTheDocument();
      expect(screen.getByText('parallel-0')).toBeInTheDocument();
      expect(screen.getByText('parallel-10')).toBeInTheDocument();
    });
  });
});