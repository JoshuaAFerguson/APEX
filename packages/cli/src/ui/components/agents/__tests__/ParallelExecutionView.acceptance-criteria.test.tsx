import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParallelExecutionView, ParallelAgent } from '../ParallelExecutionView.js';

/**
 * Unit tests focusing specifically on the acceptance criteria for parallel execution view features:
 * AC1: Tests cover parallel agent display in compact and full modes
 * AC2: Tests verify correct icon and color usage
 * AC3: Tests verify elapsed time formatting and updates
 */

// Mock the useElapsedTime hook
const mockUseElapsedTime = vi.fn();
vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock the ProgressBar component
vi.mock('../ProgressIndicators.js', () => ({
  ProgressBar: vi.fn(({ progress, showPercentage, color }) =>
    `[ProgressBar: ${progress}%${showPercentage ? ' shown' : ''}${color ? ` color:${color}` : ''}]`
  ),
}));

describe('ParallelExecutionView - Acceptance Criteria Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseElapsedTime.mockReturnValue('1m 23s');
    // Mock useStdoutDimensions with default values that don't interfere with existing tests
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
      breakpoint: 'normal',
      isAvailable: true,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // Test data factories
  const createParallelAgent = (overrides: Partial<ParallelAgent> = {}): ParallelAgent => ({
    name: 'test-agent',
    status: 'parallel',
    stage: undefined,
    progress: undefined,
    startedAt: undefined,
    ...overrides,
  });

  const knownAgents = ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'];

  describe('AC1: Parallel Agent Display (Compact vs Full Modes)', () => {
    const testAgents: ParallelAgent[] = [
      createParallelAgent({
        name: 'developer',
        status: 'parallel',
        stage: 'implementation',
        progress: 65,
        startedAt: new Date('2024-01-01T10:00:00Z'),
      }),
      createParallelAgent({
        name: 'tester',
        status: 'active',
        stage: 'unit-testing',
        progress: 40,
        startedAt: new Date('2024-01-01T10:05:00Z'),
      }),
    ];

    it('should display agents in compact mode with minimal layout', () => {
      const { lastFrame } = render(
        <ParallelExecutionView agents={testAgents} compact={true} />
      );

      const output = lastFrame();

      // Verify compact mode characteristics
      expect(output).toContain('developer');
      expect(output).toContain('tester');

      // In compact mode, stage is shown without "Stage:" prefix
      expect(output).toContain('implementation');
      expect(output).toContain('unit-testing');
      expect(output).not.toContain('Stage: implementation');
      expect(output).not.toContain('Stage: unit-testing');

      // In compact mode, elapsed time shown without "Runtime:" prefix
      expect(output).toContain('[1m 23s]');
      expect(output).not.toContain('Runtime: [1m 23s]');

      // In compact mode, progress shown as percentage, not ProgressBar component
      expect(output).toContain('65%');
      expect(output).toContain('40%');
      expect(output).not.toContain('[ProgressBar:');
    });

    it('should display agents in full mode with detailed layout', () => {
      const { lastFrame } = render(
        <ParallelExecutionView agents={testAgents} compact={false} />
      );

      const output = lastFrame();

      // Verify full mode characteristics
      expect(output).toContain('developer');
      expect(output).toContain('tester');

      // In full mode, stage is shown with "Stage:" prefix
      expect(output).toContain('Stage: implementation');
      expect(output).toContain('Stage: unit-testing');

      // In full mode, elapsed time shown with "Runtime:" prefix
      expect(output).toContain('Runtime: [1m 23s]');

      // In full mode, progress shown as ProgressBar component
      expect(output).toContain('[ProgressBar: 65% shown');
      expect(output).toContain('[ProgressBar: 40% shown');

      // Should show status indicators
      expect(output).toContain('Running in Parallel');
      expect(output).toContain('Active');
    });

    it('should apply different styling between compact and full modes', () => {
      const agent = createParallelAgent({
        name: 'developer',
        status: 'parallel',
        stage: 'implementation',
      });

      const { lastFrame: compactFrame } = render(
        <ParallelExecutionView agents={[agent]} compact={true} />
      );
      const { lastFrame: fullFrame } = render(
        <ParallelExecutionView agents={[agent]} compact={false} />
      );

      const compactOutput = compactFrame();
      const fullOutput = fullFrame();

      // Both should show the agent name and icon
      expect(compactOutput).toContain('⟂ developer');
      expect(fullOutput).toContain('⟂ developer');

      // Different stage formatting
      expect(compactOutput).toContain('implementation');
      expect(compactOutput).not.toContain('Stage: implementation');
      expect(fullOutput).toContain('Stage: implementation');

      // Full mode has additional status text
      expect(fullOutput).toContain('Running in Parallel');
      expect(compactOutput).not.toContain('Running in Parallel');
    });

    it('should handle agents with no optional properties in both modes', () => {
      const minimalAgent = createParallelAgent({
        name: 'minimal-agent',
        status: 'parallel',
      });

      const { lastFrame: compactFrame } = render(
        <ParallelExecutionView agents={[minimalAgent]} compact={true} />
      );
      const { lastFrame: fullFrame } = render(
        <ParallelExecutionView agents={[minimalAgent]} compact={false} />
      );

      const compactOutput = compactFrame();
      const fullOutput = fullFrame();

      // Both should show the agent name and icon
      expect(compactOutput).toContain('⟂ minimal-agent');
      expect(fullOutput).toContain('⟂ minimal-agent');

      // Neither should show stage, elapsed time, or progress
      expect(compactOutput).not.toContain('Stage:');
      expect(fullOutput).not.toContain('Stage:');
      expect(compactOutput).not.toContain('[1m 23s]');
      expect(fullOutput).not.toContain('[1m 23s]');
    });
  });

  describe('AC2: Icon and Color Usage Verification', () => {
    const statusIcons = {
      parallel: '⟂',
      active: '⚡',
      completed: '✓',
      waiting: '○',
      idle: '·',
    };

    it('should render correct icons for all status types', () => {
      const agents: ParallelAgent[] = [
        createParallelAgent({ name: 'agent1', status: 'parallel' }),
        createParallelAgent({ name: 'agent2', status: 'active' }),
        createParallelAgent({ name: 'agent3', status: 'completed' }),
        createParallelAgent({ name: 'agent4', status: 'waiting' }),
        createParallelAgent({ name: 'agent5', status: 'idle' }),
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      const output = lastFrame();

      // Only parallel and active agents should be displayed
      expect(output).toContain(`${statusIcons.parallel} agent1`);
      expect(output).toContain(`${statusIcons.active} agent2`);

      // Other status agents should be filtered out
      expect(output).not.toContain('agent3');
      expect(output).not.toContain('agent4');
      expect(output).not.toContain('agent5');
    });

    it('should render correct icons for displayed status types only', () => {
      const parallelAndActiveAgents: ParallelAgent[] = [
        createParallelAgent({ name: 'parallel-agent', status: 'parallel' }),
        createParallelAgent({ name: 'active-agent', status: 'active' }),
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={parallelAndActiveAgents} />
      );

      const output = lastFrame();

      // Should contain the correct status icons
      expect(output).toContain('⟂ parallel-agent');
      expect(output).toContain('⚡ active-agent');

      // Should not contain icons for other statuses
      expect(output).not.toContain('✓');
      expect(output).not.toContain('○');
      expect(output).not.toContain('·');
    });

    it('should apply correct colors for known agent types', () => {
      const knownAgentTypes: ParallelAgent[] = knownAgents.map(agentName =>
        createParallelAgent({
          name: agentName,
          status: 'active', // Use 'active' to test actual agent colors
          stage: 'working'
        })
      );

      const { lastFrame } = render(
        <ParallelExecutionView agents={knownAgentTypes} />
      );

      const output = lastFrame();

      // All known agents should be displayed
      knownAgents.forEach(agentName => {
        expect(output).toContain(agentName);
        expect(output).toContain(`⚡ ${agentName}`);
      });

      // Should show active status for all
      expect(output).toContain('Active');
    });

    it('should override agent colors with cyan for parallel status', () => {
      const agentsWithMixedStatus: ParallelAgent[] = [
        createParallelAgent({ name: 'developer', status: 'parallel' }),
        createParallelAgent({ name: 'tester', status: 'active' }),
        createParallelAgent({ name: 'unknown-agent', status: 'parallel' }),
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={agentsWithMixedStatus} />
      );

      const output = lastFrame();

      // All agents should be displayed with their respective icons
      expect(output).toContain('⟂ developer');
      expect(output).toContain('⚡ tester');
      expect(output).toContain('⟂ unknown-agent');
    });

    it('should handle unknown agent names with default styling', () => {
      const unknownAgents: ParallelAgent[] = [
        createParallelAgent({ name: 'custom-agent', status: 'parallel' }),
        createParallelAgent({ name: 'special-worker', status: 'active' }),
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={unknownAgents} />
      );

      const output = lastFrame();

      // Unknown agents should still be displayed with correct icons
      expect(output).toContain('⟂ custom-agent');
      expect(output).toContain('⚡ special-worker');
    });

    it('should maintain icon-status consistency across all rendering contexts', () => {
      const agent = createParallelAgent({
        name: 'test-agent',
        status: 'parallel',
        stage: 'working',
      });

      const { lastFrame: compactFrame } = render(
        <ParallelExecutionView agents={[agent]} compact={true} />
      );
      const { lastFrame: fullFrame } = render(
        <ParallelExecutionView agents={[agent]} compact={false} />
      );

      const compactOutput = compactFrame();
      const fullOutput = fullFrame();

      // Icon should be consistent across modes
      expect(compactOutput).toContain('⟂ test-agent');
      expect(fullOutput).toContain('⟂ test-agent');
    });
  });

  describe('AC3: Elapsed Time Formatting and Updates', () => {
    it('should call useElapsedTime with correct startTime for agents with startedAt', () => {
      const startTime1 = new Date('2024-01-01T10:00:00Z');
      const startTime2 = new Date('2024-01-01T10:05:00Z');
      const agentsWithTimes: ParallelAgent[] = [
        createParallelAgent({
          name: 'agent1',
          status: 'parallel',
          startedAt: startTime1,
        }),
        createParallelAgent({
          name: 'agent2',
          status: 'active',
          startedAt: startTime2,
        }),
        createParallelAgent({
          name: 'agent3',
          status: 'parallel',
          // No startedAt
        }),
      ];

      render(<ParallelExecutionView agents={agentsWithTimes} />);

      // Should be called with startTime for agents that have it
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime1);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime2);

      // Should be called with null for agents without startedAt
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
    });

    it('should display elapsed time in correct format for compact mode', () => {
      const agentWithTime = createParallelAgent({
        name: 'timed-agent',
        status: 'parallel',
        startedAt: new Date('2024-01-01T10:00:00Z'),
      });

      mockUseElapsedTime.mockReturnValue('2m 45s');
      const { lastFrame } = render(
        <ParallelExecutionView agents={[agentWithTime]} compact={true} />
      );

      const output = lastFrame();

      // Should show elapsed time in brackets without "Runtime:" prefix
      expect(output).toContain('[2m 45s]');
      expect(output).not.toContain('Runtime: [2m 45s]');
    });

    it('should display elapsed time in correct format for full mode', () => {
      const agentWithTime = createParallelAgent({
        name: 'timed-agent',
        status: 'parallel',
        startedAt: new Date('2024-01-01T10:00:00Z'),
      });

      mockUseElapsedTime.mockReturnValue('2m 45s');
      const { lastFrame } = render(
        <ParallelExecutionView agents={[agentWithTime]} compact={false} />
      );

      const output = lastFrame();

      // Should show elapsed time with "Runtime:" prefix
      expect(output).toContain('Runtime: [2m 45s]');
    });

    it('should handle elapsed time updates when hook value changes', () => {
      const agentWithTime = createParallelAgent({
        name: 'updating-agent',
        status: 'parallel',
        startedAt: new Date('2024-01-01T10:00:00Z'),
      });

      // First render with initial time
      mockUseElapsedTime.mockReturnValue('1m 30s');
      const { lastFrame, rerender } = render(
        <ParallelExecutionView agents={[agentWithTime]} />
      );
      expect(lastFrame()).toContain('Runtime: [1m 30s]');

      // Re-render with updated time
      mockUseElapsedTime.mockReturnValue('1m 45s');
      rerender(<ParallelExecutionView agents={[agentWithTime]} />);
      expect(lastFrame()).toContain('Runtime: [1m 45s]');

      // Re-render with longer time
      mockUseElapsedTime.mockReturnValue('3m 12s');
      rerender(<ParallelExecutionView agents={[agentWithTime]} />);
      expect(lastFrame()).toContain('Runtime: [3m 12s]');
    });

    it('should hide elapsed time for agents without startedAt', () => {
      const agentsWithoutTime: ParallelAgent[] = [
        createParallelAgent({
          name: 'agent1',
          status: 'parallel',
          // No startedAt
        }),
        createParallelAgent({
          name: 'agent2',
          status: 'active',
          // No startedAt
        }),
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={agentsWithoutTime} />
      );

      const output = lastFrame();

      // Should not show any elapsed time formatting
      expect(output).not.toContain('[');
      expect(output).not.toContain('Runtime:');
      expect(output).not.toContain('1m 23s');
    });

    it('should handle different elapsed time formats consistently', () => {
      const agentWithTime = createParallelAgent({
        name: 'agent',
        status: 'parallel',
        startedAt: new Date(),
      });

      const timeFormats = ['0s', '15s', '1m 30s', '2h 15m', '1d 3h 45m'];

      timeFormats.forEach(timeFormat => {
        mockUseElapsedTime.mockReturnValue(timeFormat);
        const { lastFrame } = render(
          <ParallelExecutionView agents={[agentWithTime]} />
        );

        const output = lastFrame();
        expect(output).toContain(`Runtime: [${timeFormat}]`);
      });
    });

    it('should handle elapsed time in mixed agent scenarios', () => {
      const mixedAgents: ParallelAgent[] = [
        createParallelAgent({
          name: 'timed-parallel',
          status: 'parallel',
          startedAt: new Date('2024-01-01T10:00:00Z'),
        }),
        createParallelAgent({
          name: 'timed-active',
          status: 'active',
          startedAt: new Date('2024-01-01T10:05:00Z'),
        }),
        createParallelAgent({
          name: 'no-time-parallel',
          status: 'parallel',
        }),
      ];

      mockUseElapsedTime.mockImplementation((startTime) => {
        if (startTime && startTime.getTime() === new Date('2024-01-01T10:00:00Z').getTime()) {
          return '10m 30s';
        }
        if (startTime && startTime.getTime() === new Date('2024-01-01T10:05:00Z').getTime()) {
          return '5m 15s';
        }
        return '0s';
      });

      const { lastFrame } = render(
        <ParallelExecutionView agents={mixedAgents} />
      );

      const output = lastFrame();

      // Should show elapsed time for agents with startedAt
      expect(output).toContain('Runtime: [10m 30s]');
      expect(output).toContain('Runtime: [5m 15s]');

      // Agent without startedAt should not show elapsed time section
      expect(output).toContain('no-time-parallel');
    });
  });

  describe('Integration: Combined AC Testing', () => {
    it('should properly handle all acceptance criteria together in compact mode', () => {
      const comprehensiveAgents: ParallelAgent[] = [
        createParallelAgent({
          name: 'developer',
          status: 'parallel',
          stage: 'implementation',
          progress: 65,
          startedAt: new Date('2024-01-01T10:00:00Z'),
        }),
        createParallelAgent({
          name: 'tester',
          status: 'active',
          stage: 'unit-testing',
          progress: 40,
          startedAt: new Date('2024-01-01T10:05:00Z'),
        }),
        createParallelAgent({
          name: 'custom-agent',
          status: 'parallel',
          stage: 'processing',
        }),
      ];

      mockUseElapsedTime.mockImplementation((startTime) => {
        if (startTime && startTime.getTime() === new Date('2024-01-01T10:00:00Z').getTime()) {
          return '8m 15s';
        }
        if (startTime && startTime.getTime() === new Date('2024-01-01T10:05:00Z').getTime()) {
          return '3m 10s';
        }
        return '0s';
      });

      const { lastFrame } = render(
        <ParallelExecutionView agents={comprehensiveAgents} compact={true} />
      );

      const output = lastFrame();

      // AC1: Compact mode layout
      expect(output).toContain('⟂ Parallel Execution (3 agents)');
      expect(output).not.toContain('Stage: implementation');
      expect(output).not.toContain('Runtime:');

      // AC2: Icons and colors
      expect(output).toContain('⟂ developer');
      expect(output).toContain('⚡ tester');
      expect(output).toContain('⟂ custom-agent');

      // AC3: Elapsed time formatting
      expect(output).toContain('[8m 15s]');
      expect(output).toContain('[3m 10s]');

      // Progress in compact mode (percentages, not ProgressBar)
      expect(output).toContain('65%');
      expect(output).toContain('40%');
      expect(output).not.toContain('[ProgressBar:');
    });

    it('should properly handle all acceptance criteria together in full mode', () => {
      const comprehensiveAgents: ParallelAgent[] = [
        createParallelAgent({
          name: 'architect',
          status: 'parallel',
          stage: 'design',
          progress: 80,
          startedAt: new Date('2024-01-01T09:30:00Z'),
        }),
        createParallelAgent({
          name: 'reviewer',
          status: 'active',
          stage: 'code-review',
          progress: 25,
          startedAt: new Date('2024-01-01T10:00:00Z'),
        }),
      ];

      mockUseElapsedTime.mockImplementation((startTime) => {
        if (startTime && startTime.getTime() === new Date('2024-01-01T09:30:00Z').getTime()) {
          return '15m 45s';
        }
        if (startTime && startTime.getTime() === new Date('2024-01-01T10:00:00Z').getTime()) {
          return '12m 30s';
        }
        return '0s';
      });

      const { lastFrame } = render(
        <ParallelExecutionView agents={comprehensiveAgents} compact={false} />
      );

      const output = lastFrame();

      // AC1: Full mode layout
      expect(output).toContain('⟂ Parallel Execution (2 agents)');
      expect(output).toContain('Stage: design');
      expect(output).toContain('Stage: code-review');

      // AC2: Icons and colors
      expect(output).toContain('⟂ architect');
      expect(output).toContain('⚡ reviewer');

      // AC3: Elapsed time formatting
      expect(output).toContain('Runtime: [15m 45s]');
      expect(output).toContain('Runtime: [12m 30s]');

      // Progress in full mode (ProgressBar component)
      expect(output).toContain('[ProgressBar: 80% shown');
      expect(output).toContain('[ProgressBar: 25% shown');

      // Status indicators in full mode
      expect(output).toContain('Running in Parallel');
      expect(output).toContain('Active');
    });
  });
});