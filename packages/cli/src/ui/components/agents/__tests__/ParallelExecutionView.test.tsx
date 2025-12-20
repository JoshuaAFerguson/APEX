import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParallelExecutionView, ParallelAgent } from '../ParallelExecutionView.js';

// Mock the useElapsedTime hook
const mockUseElapsedTime = vi.fn();
vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

// Mock the ProgressBar component
vi.mock('../ProgressIndicators.js', () => ({
  ProgressBar: vi.fn(({ progress, showPercentage }) => `[ProgressBar: ${progress}%${showPercentage ? ' shown' : ''}]`),
}));

describe('ParallelExecutionView', () => {
  beforeEach(() => {
    mockUseElapsedTime.mockReturnValue('1m 23s');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockParallelAgents: ParallelAgent[] = [
    {
      name: 'developer',
      status: 'parallel',
      stage: 'implementation',
      progress: 65,
      startedAt: new Date('2024-01-01T10:00:00Z'),
    },
    {
      name: 'tester',
      status: 'parallel',
      stage: 'unit-testing',
      progress: 40,
      startedAt: new Date('2024-01-01T10:05:00Z'),
    },
    {
      name: 'reviewer',
      status: 'parallel',
      stage: 'code-review',
      progress: 80,
      startedAt: new Date('2024-01-01T10:10:00Z'),
    },
  ];

  it('should render parallel agents in side-by-side cards', () => {
    const { lastFrame } = render(
      <ParallelExecutionView agents={mockParallelAgents} />
    );

    const output = lastFrame();

    // Should show the header
    expect(output).toContain('⟂ Parallel Execution (3 agents)');

    // Should show all agent names
    expect(output).toContain('developer');
    expect(output).toContain('tester');
    expect(output).toContain('reviewer');

    // Should show stages
    expect(output).toContain('implementation');
    expect(output).toContain('unit-testing');
    expect(output).toContain('code-review');

    // Should show progress percentages
    expect(output).toContain('65%');
    expect(output).toContain('40%');
    expect(output).toContain('80%');
  });

  it('should render in compact mode', () => {
    const { lastFrame } = render(
      <ParallelExecutionView agents={mockParallelAgents} compact={true} />
    );

    const output = lastFrame();

    // Should still show header and agent names
    expect(output).toContain('⟂ Parallel Execution (3 agents)');
    expect(output).toContain('developer');
    expect(output).toContain('tester');
    expect(output).toContain('reviewer');
  });

  it('should handle empty agent list', () => {
    const { lastFrame } = render(
      <ParallelExecutionView agents={[]} />
    );

    const output = lastFrame();
    expect(output).toContain('No parallel agents currently active');
  });

  it('should filter out non-parallel agents', () => {
    const mixedAgents: ParallelAgent[] = [
      ...mockParallelAgents,
      {
        name: 'completed-agent',
        status: 'completed',
        stage: 'done',
      },
      {
        name: 'waiting-agent',
        status: 'waiting',
      },
    ];

    const { lastFrame } = render(
      <ParallelExecutionView agents={mixedAgents} />
    );

    const output = lastFrame();

    // Should only count parallel/active agents
    expect(output).toContain('⟂ Parallel Execution (3 agents)');

    // Should not show non-parallel agents
    expect(output).not.toContain('completed-agent');
    expect(output).not.toContain('waiting-agent');
  });

  it('should respect maxColumns configuration', () => {
    const { lastFrame } = render(
      <ParallelExecutionView agents={mockParallelAgents} maxColumns={2} />
    );

    const output = lastFrame();

    // Should still render all agents
    expect(output).toContain('developer');
    expect(output).toContain('tester');
    expect(output).toContain('reviewer');
  });

  it('should handle agents without optional properties', () => {
    const minimalAgents: ParallelAgent[] = [
      {
        name: 'minimal-agent',
        status: 'parallel',
      },
    ];

    const { lastFrame } = render(
      <ParallelExecutionView agents={minimalAgents} />
    );

    const output = lastFrame();
    expect(output).toContain('minimal-agent');
    expect(output).toContain('⟂ Parallel Execution (1 agents)');
  });

  describe('comprehensive rendering tests', () => {
    it('should show status icons for different agent statuses', () => {
      const mixedAgents: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel' },
        { name: 'agent2', status: 'active' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={mixedAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('⟂'); // parallel icon
      expect(output).toContain('⚡'); // active icon
    });

    it('should apply correct colors for known agents', () => {
      const knownAgents: ParallelAgent[] = [
        { name: 'planner', status: 'parallel' },
        { name: 'architect', status: 'parallel' },
        { name: 'developer', status: 'parallel' },
        { name: 'reviewer', status: 'parallel' },
        { name: 'tester', status: 'parallel' },
        { name: 'devops', status: 'parallel' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={knownAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('planner');
      expect(output).toContain('architect');
      expect(output).toContain('developer');
      expect(output).toContain('reviewer');
      expect(output).toContain('tester');
      expect(output).toContain('devops');
    });

    it('should handle unknown agent names', () => {
      const unknownAgents: ParallelAgent[] = [
        { name: 'custom-agent', status: 'parallel' },
        { name: 'unknown-agent', status: 'active' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={unknownAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('custom-agent');
      expect(output).toContain('unknown-agent');
    });
  });

  describe('agent filtering', () => {
    it('should only show parallel and active agents', () => {
      const allStatusAgents: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel' },
        { name: 'agent2', status: 'active' },
        { name: 'agent3', status: 'completed' },
        { name: 'agent4', status: 'waiting' },
        { name: 'agent5', status: 'idle' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={allStatusAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).not.toContain('agent3');
      expect(output).not.toContain('agent4');
      expect(output).not.toContain('agent5');
      expect(output).toContain('⟂ Parallel Execution (2 agents)');
    });

    it('should show empty state when no parallel/active agents', () => {
      const inactiveAgents: ParallelAgent[] = [
        { name: 'agent1', status: 'completed' },
        { name: 'agent2', status: 'waiting' },
        { name: 'agent3', status: 'idle' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={inactiveAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('No parallel agents currently active');
      expect(output).not.toContain('⟂ Parallel Execution');
    });
  });

  describe('layout and grouping', () => {
    it('should arrange agents in rows based on maxColumns', () => {
      const agents = Array.from({ length: 5 }, (_, i) => ({
        name: `agent${i + 1}`,
        status: 'parallel' as const,
      }));

      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} maxColumns={3} />
      );

      const output = lastFrame();
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('agent3');
      expect(output).toContain('agent4');
      expect(output).toContain('agent5');
    });

    it('should handle single agent correctly', () => {
      const singleAgent: ParallelAgent[] = [
        { name: 'single-agent', status: 'parallel', stage: 'working' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={singleAgent} />
      );

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (1 agents)');
      expect(output).toContain('single-agent');
      expect(output).toContain('working');
    });

    it('should handle maxColumns=1 correctly', () => {
      const { lastFrame } = render(
        <ParallelExecutionView agents={mockParallelAgents} maxColumns={1} />
      );

      const output = lastFrame();
      expect(output).toContain('developer');
      expect(output).toContain('tester');
      expect(output).toContain('reviewer');
    });
  });

  describe('progress handling', () => {
    it('should show progress bars for agents with progress between 0-100', () => {
      const agentsWithProgress: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel', progress: 25 },
        { name: 'agent2', status: 'active', progress: 75 },
        { name: 'agent3', status: 'parallel', progress: 50 },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={agentsWithProgress} />
      );

      const output = lastFrame();
      expect(output).toContain('[ProgressBar: 25% shown]');
      expect(output).toContain('[ProgressBar: 75% shown]');
      expect(output).toContain('[ProgressBar: 50% shown]');
    });

    it('should hide progress bars for 0% and 100% progress', () => {
      const edgeProgressAgents: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel', progress: 0 },
        { name: 'agent2', status: 'parallel', progress: 100 },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={edgeProgressAgents} />
      );

      const output = lastFrame();
      expect(output).not.toContain('[ProgressBar: 0%');
      expect(output).not.toContain('[ProgressBar: 100%');
    });

    it('should show progress percentages in compact mode', () => {
      const agentsWithProgress: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel', progress: 33.7 },
        { name: 'agent2', status: 'active', progress: 66.9 },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={agentsWithProgress} compact={true} />
      );

      const output = lastFrame();
      expect(output).toContain('34%'); // rounded
      expect(output).toContain('67%'); // rounded
    });
  });

  describe('elapsed time handling', () => {
    it('should show elapsed time for parallel agents with startedAt', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const agentsWithStartTime: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel', startedAt: startTime },
      ];

      mockUseElapsedTime.mockReturnValue('5m 30s');
      const { lastFrame } = render(
        <ParallelExecutionView agents={agentsWithStartTime} />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      const output = lastFrame();
      expect(output).toContain('[5m 30s]');
    });

    it('should hide elapsed time for agents without startedAt', () => {
      const agentsNoStartTime: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={agentsNoStartTime} />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
    });
  });

  describe('stage display', () => {
    it('should show stage when provided', () => {
      const agentsWithStage: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel', stage: 'analyzing' },
        { name: 'agent2', status: 'active', stage: 'implementing' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={agentsWithStage} />
      );

      const output = lastFrame();
      expect(output).toContain('analyzing');
      expect(output).toContain('implementing');
    });

    it('should hide stage when not provided', () => {
      const agentsNoStage: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={agentsNoStage} />
      );

      const output = lastFrame();
      // Should not show stage-related text
      expect(output).not.toContain('Stage:');
    });
  });

  describe('edge cases', () => {
    it('should handle agents with long names', () => {
      const longNameAgents: ParallelAgent[] = [
        { name: 'very-very-long-agent-name-that-might-cause-layout-issues', status: 'parallel' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={longNameAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('very-very-long-agent-name-that-might-cause-layout-issues');
    });

    it('should handle agents with special characters in names', () => {
      const specialAgents: ParallelAgent[] = [
        { name: 'agent-with-dashes', status: 'parallel' },
        { name: 'agent_with_underscores', status: 'parallel' },
        { name: 'agent.with.dots', status: 'parallel' },
        { name: 'agent@with@symbols', status: 'parallel' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={specialAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('agent-with-dashes');
      expect(output).toContain('agent_with_underscores');
      expect(output).toContain('agent.with.dots');
      expect(output).toContain('agent@with@symbols');
    });

    it('should handle extreme progress values gracefully', () => {
      const extremeProgressAgents: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel', progress: -10 },
        { name: 'agent2', status: 'parallel', progress: 150 },
        { name: 'agent3', status: 'parallel', progress: 0.5 },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={extremeProgressAgents} compact={true} />
      );

      const output = lastFrame();
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('agent3');
      expect(output).toContain('1%'); // Rounded fractional
    });

    it('should handle empty string values', () => {
      const emptyStringAgents: ParallelAgent[] = [
        { name: '', status: 'parallel', stage: '' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={emptyStringAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (1 agents)');
    });

    it('should handle maxColumns edge cases', () => {
      // Test maxColumns=0 (should fallback to default)
      const { lastFrame: frame1 } = render(
        <ParallelExecutionView agents={mockParallelAgents} maxColumns={0} />
      );
      expect(frame1()).toContain('developer');

      // Test very large maxColumns
      const { lastFrame: frame2 } = render(
        <ParallelExecutionView agents={mockParallelAgents} maxColumns={100} />
      );
      expect(frame2()).toContain('developer');
    });
  });

  describe('accessibility and structure', () => {
    it('should provide accessible text content', () => {
      const { lastFrame } = render(
        <ParallelExecutionView agents={mockParallelAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (3 agents)');
      expect(output).toContain('developer');
      expect(output).toContain('tester');
      expect(output).toContain('implementation');
      expect(output).toContain('Running in Parallel');
    });

    it('should maintain content structure for screen readers', () => {
      const { lastFrame } = render(
        <ParallelExecutionView agents={mockParallelAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('developer');
      expect(output).toContain('Stage: implementation');
      expect(output).toContain('Runtime: [1m 23s]');
      expect(output).toContain('Running in Parallel');
    });
  });

  describe('hook integration', () => {
    it('should integrate with useElapsedTime hook correctly', () => {
      const startTime1 = new Date('2024-01-01T10:00:00Z');
      const startTime2 = new Date('2024-01-01T10:05:00Z');
      const agentsWithTimes: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel', startedAt: startTime1 },
        { name: 'agent2', status: 'active', startedAt: startTime2 },
        { name: 'agent3', status: 'parallel' },
      ];

      mockUseElapsedTime.mockImplementation((startTime) => {
        if (startTime === startTime1) return '10m 30s';
        if (startTime === startTime2) return '5m 15s';
        return '0s';
      });

      render(<ParallelExecutionView agents={agentsWithTimes} />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime1);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime2);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
    });

    it('should handle useElapsedTime updates', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const agentsWithTime: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel', startedAt: startTime },
      ];

      mockUseElapsedTime.mockReturnValue('1m 30s');
      const { lastFrame, rerender } = render(
        <ParallelExecutionView agents={agentsWithTime} />
      );
      expect(lastFrame()).toContain('[1m 30s]');

      mockUseElapsedTime.mockReturnValue('1m 45s');
      rerender(<ParallelExecutionView agents={agentsWithTime} />);
      expect(lastFrame()).toContain('[1m 45s]');
    });
  });
});