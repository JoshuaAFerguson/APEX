import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

/**
 * Integration tests specifically for new AgentPanel features:
 * - Handoff animations with enhanced timing
 * - Parallel view with progress tracking
 * - Progress bars for active/parallel agents
 * - Elapsed time tracking with startedAt timestamps
 */

describe('AgentPanel - New Features Integration Tests', () => {
  const mockUseElapsedTime = vi.fn();
  const mockUseAgentHandoff = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));

    vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));

    // Mock HandoffIndicator to focus on AgentPanel logic
    vi.doMock('../HandoffIndicator.js', () => ({
      HandoffIndicator: ({ animationState, agentColors, compact }: any) =>
        React.createElement('div', {
          'data-testid': 'handoff-indicator',
          'data-compact': compact,
          'data-animating': animationState.isAnimating,
        }, 'HandoffIndicator')
    }));

    // Mock ProgressBar component
    vi.doMock('../../ProgressIndicators.js', () => ({
      ProgressBar: ({ progress, width, showPercentage, color, animated }: any) =>
        React.createElement('div', {
          'data-testid': 'progress-bar',
          'data-progress': progress,
          'data-width': width,
          'data-show-percentage': showPercentage,
          'data-color': color,
          'data-animated': animated,
        }, `Progress: ${progress}%`)
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useElapsedTime.js');
    vi.doUnmock('../../../hooks/useAgentHandoff.js');
    vi.doUnmock('../HandoffIndicator.js');
    vi.doUnmock('../../ProgressIndicators.js');
  });

  describe('Enhanced Handoff Animations Integration', () => {
    it('integrates handoff animations with progress tracking during agent transitions', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed', stage: 'planning' },
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 75,
          startedAt: startTime,
        },
        { name: 'tester', status: 'waiting', stage: 'testing' },
      ];

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.6,
        isFading: false,
      });

      mockUseElapsedTime.mockImplementation((date) => {
        if (date === startTime) return '12m 45s';
        return null;
      });

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Verify handoff animation integration
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');

      const handoffIndicator = screen.getByTestId('handoff-indicator');
      expect(handoffIndicator).toHaveAttribute('data-animating', 'true');
      expect(handoffIndicator).toHaveAttribute('data-compact', 'false');

      // Verify progress bar integration during handoff
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveAttribute('data-progress', '75');
      expect(progressBar).toHaveAttribute('data-color', 'green'); // developer color

      // Verify elapsed time during handoff
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText(/\[12m 45s\]/)).toBeInTheDocument();

      // Verify agent state display during animation
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('handles handoff animations with parallel agents simultaneously', () => {
      const mainAgent = {
        name: 'developer',
        status: 'active' as const,
        stage: 'implementation',
        progress: 65,
        startedAt: new Date('2023-01-01T10:00:00Z'),
      };

      const parallelAgents: AgentInfo[] = [
        {
          name: 'tester',
          status: 'parallel' as const,
          stage: 'testing',
          progress: 40,
          startedAt: new Date('2023-01-01T10:05:00Z'),
        },
        {
          name: 'security',
          status: 'parallel' as const,
          stage: 'scan',
          progress: 80,
          startedAt: new Date('2023-01-01T10:10:00Z'),
        },
      ];

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.75,
        isFading: false,
      });

      mockUseElapsedTime.mockImplementation((date) => {
        if (date?.getTime() === new Date('2023-01-01T10:00:00Z').getTime()) return '15m 20s';
        if (date?.getTime() === new Date('2023-01-01T10:05:00Z').getTime()) return '10m 30s';
        if (date?.getTime() === new Date('2023-01-01T10:10:00Z').getTime()) return '5m 45s';
        return null;
      });

      render(
        <AgentPanel
          agents={[mainAgent]}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Verify handoff animation with parallel execution
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');

      // Verify main agent during handoff
      expect(screen.getByText('developer')).toBeInTheDocument();
      const mainProgressBar = screen.getAllByTestId('progress-bar')[0];
      expect(mainProgressBar).toHaveAttribute('data-progress', '65');
      expect(mainProgressBar).toHaveAttribute('data-color', 'green');

      // Verify parallel agents during handoff
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('security')).toBeInTheDocument();

      const parallelProgressBars = screen.getAllByTestId('progress-bar');
      expect(parallelProgressBars).toHaveLength(3); // 1 main + 2 parallel

      // Check parallel progress bars
      expect(parallelProgressBars[1]).toHaveAttribute('data-progress', '40');
      expect(parallelProgressBars[1]).toHaveAttribute('data-color', 'cyan');
      expect(parallelProgressBars[2]).toHaveAttribute('data-progress', '80');
      expect(parallelProgressBars[2]).toHaveAttribute('data-color', 'cyan');

      // Verify elapsed times for all agents
      expect(screen.getByText(/\[15m 20s\]/)).toBeInTheDocument(); // main
      expect(screen.getByText(/\[10m 30s\]/)).toBeInTheDocument(); // tester
      expect(screen.getByText(/\[5m 45s\]/)).toBeInTheDocument(); // security
    });
  });

  describe('Parallel View with Progress Tracking', () => {
    it('displays parallel agents with individual progress tracking', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'unit-tester',
          status: 'parallel',
          stage: 'unit-tests',
          progress: 25,
          startedAt: new Date('2023-01-01T10:00:00Z'),
        },
        {
          name: 'integration-tester',
          status: 'parallel',
          stage: 'integration-tests',
          progress: 60,
          startedAt: new Date('2023-01-01T10:05:00Z'),
        },
        {
          name: 'e2e-tester',
          status: 'parallel',
          stage: 'e2e-tests',
          progress: 90,
          startedAt: new Date('2023-01-01T10:10:00Z'),
        },
      ];

      mockUseElapsedTime.mockImplementation((date) => {
        if (date?.getTime() === new Date('2023-01-01T10:00:00Z').getTime()) return '18m 30s';
        if (date?.getTime() === new Date('2023-01-01T10:05:00Z').getTime()) return '13m 15s';
        if (date?.getTime() === new Date('2023-01-01T10:10:00Z').getTime()) return '8m 42s';
        return null;
      });

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Verify parallel execution header
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Verify all parallel agents are displayed
      expect(screen.getByText('unit-tester')).toBeInTheDocument();
      expect(screen.getByText('integration-tester')).toBeInTheDocument();
      expect(screen.getByText('e2e-tester')).toBeInTheDocument();

      // Verify stages
      expect(screen.getByText(/\(unit-tests\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(integration-tests\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(e2e-tests\)/)).toBeInTheDocument();

      // Verify progress bars
      const progressBars = screen.getAllByTestId('progress-bar');
      expect(progressBars).toHaveLength(3);

      expect(progressBars[0]).toHaveAttribute('data-progress', '25');
      expect(progressBars[0]).toHaveAttribute('data-color', 'cyan');
      expect(progressBars[1]).toHaveAttribute('data-progress', '60');
      expect(progressBars[1]).toHaveAttribute('data-color', 'cyan');
      expect(progressBars[2]).toHaveAttribute('data-progress', '90');
      expect(progressBars[2]).toHaveAttribute('data-color', 'cyan');

      // Verify elapsed times
      expect(screen.getByText(/\[18m 30s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[13m 15s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[8m 42s\]/)).toBeInTheDocument();

      // Verify progress percentages are shown
      expect(screen.getByText(/25%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/90%/)).toBeInTheDocument();
    });

    it('handles parallel view in compact mode with progress tracking', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'developer', status: 'active', progress: 75 },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester1', status: 'parallel', progress: 30 },
        { name: 'tester2', status: 'parallel', progress: 70 },
      ];

      mockUseElapsedTime.mockReturnValue('5m 20s');
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      render(
        <AgentPanel
          agents={mainAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Verify compact layout (no headers)
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Verify main agent in compact mode
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();

      // Verify parallel agents in compact mode
      expect(screen.getByText('tester1')).toBeInTheDocument();
      expect(screen.getByText('tester2')).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/70%/)).toBeInTheDocument();

      // Verify parallel indicator
      expect(screen.getByText('⟂')).toBeInTheDocument();

      // Verify separators
      expect(screen.getAllByText('│')).toHaveLength(1); // Main to parallel separator

      // Verify handoff indicator in compact mode
      const handoffIndicator = screen.getByTestId('handoff-indicator');
      expect(handoffIndicator).toHaveAttribute('data-compact', 'true');
    });
  });

  describe('Progress Bar Integration for Active and Parallel Agents', () => {
    it('shows progress bars only for active and parallel agents with valid progress', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed', progress: 100 }, // Completed: no progress bar
        { name: 'architect', status: 'active', progress: 0 }, // Active with 0%: no progress bar
        { name: 'developer', status: 'active', progress: 55 }, // Active with valid progress: show bar
        { name: 'reviewer', status: 'waiting', progress: 30 }, // Waiting: no progress bar
        { name: 'tester', status: 'parallel', progress: 80 }, // Parallel: show bar
        { name: 'devops', status: 'idle' }, // Idle: no progress bar
      ];

      mockUseElapsedTime.mockReturnValue('3m 15s');
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Verify all agents are displayed
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();

      // Verify progress bars (only for developer and tester with valid progress)
      const progressBars = screen.getAllByTestId('progress-bar');
      expect(progressBars).toHaveLength(2);

      // Developer progress bar
      expect(progressBars[0]).toHaveAttribute('data-progress', '55');
      expect(progressBars[0]).toHaveAttribute('data-color', 'green');
      expect(progressBars[0]).toHaveAttribute('data-width', '30');
      expect(progressBars[0]).toHaveAttribute('data-show-percentage', 'true');
      expect(progressBars[0]).toHaveAttribute('data-animated', 'false');

      // Tester progress bar
      expect(progressBars[1]).toHaveAttribute('data-progress', '80');
      expect(progressBars[1]).toHaveAttribute('data-color', 'cyan'); // Parallel agent color

      // Verify percentage display in agent text (for agents without progress bars)
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument(); // Hidden for 100%
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument(); // Hidden for 0%
      expect(screen.getByText(/55%/)).toBeInTheDocument(); // Shown for valid progress
      expect(screen.queryByText(/30%/)).not.toBeInTheDocument(); // Not shown for waiting agent
      expect(screen.getByText(/80%/)).toBeInTheDocument(); // Shown for parallel agent
    });

    it('configures progress bar properties correctly for different agent types', () => {
      const activeAgent: AgentInfo = {
        name: 'developer',
        status: 'active',
        progress: 42,
        stage: 'coding',
        startedAt: new Date(),
      };

      const parallelAgent: AgentInfo = {
        name: 'tester',
        status: 'parallel',
        progress: 67,
        stage: 'testing',
        startedAt: new Date(),
      };

      mockUseElapsedTime.mockReturnValue('7m 33s');
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      render(
        <AgentPanel
          agents={[activeAgent]}
          showParallel={true}
          parallelAgents={[parallelAgent]}
        />
      );

      const progressBars = screen.getAllByTestId('progress-bar');
      expect(progressBars).toHaveLength(2);

      // Active agent progress bar configuration
      expect(progressBars[0]).toHaveAttribute('data-progress', '42');
      expect(progressBars[0]).toHaveAttribute('data-color', 'green'); // Developer color
      expect(progressBars[0]).toHaveAttribute('data-width', '30');
      expect(progressBars[0]).toHaveAttribute('data-show-percentage', 'true');
      expect(progressBars[0]).toHaveAttribute('data-animated', 'false');

      // Parallel agent progress bar configuration
      expect(progressBars[1]).toHaveAttribute('data-progress', '67');
      expect(progressBars[1]).toHaveAttribute('data-color', 'cyan'); // Parallel color
      expect(progressBars[1]).toHaveAttribute('data-width', '30');
      expect(progressBars[1]).toHaveAttribute('data-show-percentage', 'true');
      expect(progressBars[1]).toHaveAttribute('data-animated', 'false');

      // Verify progress text in agent display
      expect(screen.getByText(/42%/)).toBeInTheDocument();
      expect(screen.getByText(/67%/)).toBeInTheDocument();
    });
  });

  describe('Elapsed Time Tracking with StartedAt Timestamps', () => {
    it('tracks elapsed time for active agents with startedAt timestamps', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:15:00Z');

      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' }, // No elapsed time for completed
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime1,
        },
        {
          name: 'architect',
          status: 'active',
          startedAt: startTime2,
        },
        { name: 'tester', status: 'active' }, // No startedAt: no elapsed time
        { name: 'reviewer', status: 'waiting', startedAt: startTime1 }, // Not active: no elapsed time
      ];

      mockUseElapsedTime.mockImplementation((date) => {
        if (date === startTime1) return '22m 30s';
        if (date === startTime2) return '7m 15s';
        if (date === null) return null;
        return '0s';
      });

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Verify elapsed time calls
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime1); // developer
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime2); // architect
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null); // tester (no startedAt)
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null); // planner (completed)
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null); // reviewer (not active)

      // Verify elapsed time display
      expect(screen.getByText(/\[22m 30s\]/)).toBeInTheDocument(); // developer
      expect(screen.getByText(/\[7m 15s\]/)).toBeInTheDocument(); // architect

      // Verify no elapsed time for other agents
      const elapsedTimeMatches = screen.getAllByText(/\[.*\]/);
      expect(elapsedTimeMatches).toHaveLength(2); // Only developer and architect
    });

    it('tracks elapsed time for parallel agents with startedAt timestamps', () => {
      const parallelStart1 = new Date('2023-01-01T10:00:00Z');
      const parallelStart2 = new Date('2023-01-01T10:05:00Z');
      const parallelStart3 = new Date('2023-01-01T10:10:00Z');

      const parallelAgents: AgentInfo[] = [
        {
          name: 'security-check',
          status: 'parallel',
          startedAt: parallelStart1,
        },
        {
          name: 'performance-test',
          status: 'parallel',
          startedAt: parallelStart2,
        },
        {
          name: 'lint-check',
          status: 'parallel',
          startedAt: parallelStart3,
        },
        {
          name: 'doc-gen',
          status: 'parallel',
          // No startedAt: should not show elapsed time
        },
      ];

      mockUseElapsedTime.mockImplementation((date) => {
        if (date === parallelStart1) return '25m 45s';
        if (date === parallelStart2) return '20m 30s';
        if (date === parallelStart3) return '15m 12s';
        if (date === null) return null;
        return '1m 0s';
      });

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Verify elapsed time calls for parallel agents
      expect(mockUseElapsedTime).toHaveBeenCalledWith(parallelStart1);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(parallelStart2);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(parallelStart3);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null); // doc-gen

      // Verify elapsed time display for parallel agents
      expect(screen.getByText(/\[25m 45s\]/)).toBeInTheDocument(); // security-check
      expect(screen.getByText(/\[20m 30s\]/)).toBeInTheDocument(); // performance-test
      expect(screen.getByText(/\[15m 12s\]/)).toBeInTheDocument(); // lint-check

      // Verify no elapsed time for doc-gen (no startedAt)
      const elapsedTimeMatches = screen.getAllByText(/\[.*\]/);
      expect(elapsedTimeMatches).toHaveLength(3); // Only first three agents
    });
  });

  describe('Complex Feature Interaction Scenarios', () => {
    it('handles all new features together in a complex workflow', () => {
      const complexStartTime = new Date('2023-01-01T10:00:00Z');

      // Main workflow with mixed states and features
      const mainAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed', stage: 'initial-planning' },
        {
          name: 'architect',
          status: 'active',
          stage: 'system-design',
          progress: 85,
          startedAt: complexStartTime,
        },
        { name: 'reviewer', status: 'waiting', stage: 'code-review' },
      ];

      // Multiple parallel agents with various configurations
      const parallelAgents: AgentInfo[] = [
        {
          name: 'unit-tests',
          status: 'parallel',
          stage: 'unit-testing',
          progress: 95,
          startedAt: new Date('2023-01-01T10:05:00Z'),
        },
        {
          name: 'integration-tests',
          status: 'parallel',
          stage: 'integration-testing',
          progress: 60,
          startedAt: new Date('2023-01-01T10:08:00Z'),
        },
        {
          name: 'security-scan',
          status: 'parallel',
          stage: 'security-scanning',
          progress: 30,
          // No startedAt to test mixed scenarios
        },
      ];

      // Complex handoff animation scenario
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.85,
        isFading: false,
      });

      // Complex elapsed time scenarios
      mockUseElapsedTime.mockImplementation((date) => {
        if (date === complexStartTime) return '45m 30s';
        if (date?.getTime() === new Date('2023-01-01T10:05:00Z').getTime()) return '40m 15s';
        if (date?.getTime() === new Date('2023-01-01T10:08:00Z').getTime()) return '37m 45s';
        if (date === null) return null;
        return '1m 0s';
      });

      render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="architect"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Verify handoff animation integration
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');
      const handoffIndicator = screen.getByTestId('handoff-indicator');
      expect(handoffIndicator).toHaveAttribute('data-animating', 'true');

      // Verify main agent with all features
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText(/\(system-design\)/)).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();
      expect(screen.getByText(/\[45m 30s\]/)).toBeInTheDocument();

      // Verify parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('unit-tests')).toBeInTheDocument();
      expect(screen.getByText('integration-tests')).toBeInTheDocument();
      expect(screen.getByText('security-scan')).toBeInTheDocument();

      // Verify parallel agent features
      expect(screen.getByText(/95%/)).toBeInTheDocument(); // unit-tests
      expect(screen.getByText(/60%/)).toBeInTheDocument(); // integration-tests
      expect(screen.getByText(/30%/)).toBeInTheDocument(); // security-scan

      expect(screen.getByText(/\[40m 15s\]/)).toBeInTheDocument(); // unit-tests
      expect(screen.getByText(/\[37m 45s\]/)).toBeInTheDocument(); // integration-tests
      // No elapsed time for security-scan (no startedAt)

      // Verify progress bars for all applicable agents
      const progressBars = screen.getAllByTestId('progress-bar');
      expect(progressBars).toHaveLength(4); // 1 main + 3 parallel

      // Main agent progress bar
      expect(progressBars[0]).toHaveAttribute('data-progress', '85');
      expect(progressBars[0]).toHaveAttribute('data-color', 'blue'); // architect color

      // Parallel agent progress bars (all cyan)
      expect(progressBars[1]).toHaveAttribute('data-progress', '95');
      expect(progressBars[1]).toHaveAttribute('data-color', 'cyan');
      expect(progressBars[2]).toHaveAttribute('data-progress', '60');
      expect(progressBars[2]).toHaveAttribute('data-color', 'cyan');
      expect(progressBars[3]).toHaveAttribute('data-progress', '30');
      expect(progressBars[3]).toHaveAttribute('data-color', 'cyan');

      // Verify all stages are displayed
      expect(screen.getByText(/\(initial-planning\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(system-design\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(code-review\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(unit-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(integration-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(security-scanning\)/)).toBeInTheDocument();
    });
  });
});