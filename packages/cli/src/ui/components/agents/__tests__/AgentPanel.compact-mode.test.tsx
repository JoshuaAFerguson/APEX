import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo, AgentPanelProps } from '../AgentPanel';

// Mock hooks
vi.mock('../../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    currentAgent: null,
    handoffState: 'idle',
    timeInState: 0,
    isTransitioning: false,
  })),
}));

vi.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn((startTime: Date | null) => {
    if (!startTime) return '00:00';
    const diff = Date.now() - startTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }),
}));

// Mock ink components
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    Box: ({ children, ...props }: any) => <div data-testid="agent-panel-box" {...props}>{children}</div>,
    Text: ({ children, color, ...props }: any) => <span style={{ color }} data-testid="agent-panel-text" {...props}>{children}</span>,
  };
});

describe('AgentPanel - Compact Mode Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockAgents: AgentInfo[] = [
    {
      name: 'planner',
      status: 'completed',
      stage: 'planning',
      progress: 100,
      startedAt: new Date(Date.now() - 60000), // 1 minute ago
    },
    {
      name: 'architect',
      status: 'completed',
      stage: 'architecture',
      progress: 100,
      startedAt: new Date(Date.now() - 45000),
    },
    {
      name: 'developer',
      status: 'active',
      stage: 'implementation',
      progress: 65,
      startedAt: new Date(Date.now() - 30000), // 30 seconds ago
    },
    {
      name: 'tester',
      status: 'waiting',
      stage: 'testing',
      progress: 0,
    },
    {
      name: 'reviewer',
      status: 'idle',
      stage: 'review',
      progress: 0,
    },
  ];

  const baseProps: AgentPanelProps = {
    agents: mockAgents,
    currentAgent: 'developer',
  };

  describe('Compact Mode via compact prop', () => {
    it('should display agents in single line when compact=true', () => {
      render(<AgentPanel {...baseProps} compact={true} />);

      // Should show all agent names in single line format
      expect(screen.getByText('✓')).toBeInTheDocument(); // Completed icon for planner
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument(); // Completed icon for architect
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Active icon for developer
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('○')).toBeInTheDocument(); // Waiting icon for tester
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('·')).toBeInTheDocument(); // Idle icon for reviewer
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Should show separators between agents
      expect(screen.getAllByText('│')).toHaveLength(4); // 5 agents = 4 separators
    });

    it('should show progress percentage for active agent in compact mode', () => {
      render(<AgentPanel {...baseProps} compact={true} />);

      // Developer should show progress since it's active and has progress > 0 < 100
      expect(screen.getByText(/developer.*65%/)).toBeInTheDocument();

      // Completed agents (100%) should not show percentage
      expect(screen.queryByText(/planner.*100%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/architect.*100%/)).not.toBeInTheDocument();

      // Waiting/idle agents (0%) should not show percentage
      expect(screen.queryByText(/tester.*0%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/reviewer.*0%/)).not.toBeInTheDocument();
    });

    it('should show elapsed time for active agent in compact mode', () => {
      render(<AgentPanel {...baseProps} compact={true} />);

      // Developer is active and has startedAt, should show elapsed time
      expect(screen.getByText(/developer.*\[00:30\]/)).toBeInTheDocument();

      // Completed agents should not show elapsed time in compact mode
      expect(screen.queryByText(/planner.*\[\d+:\d+\]/)).not.toBeInTheDocument();
      expect(screen.queryByText(/architect.*\[\d+:\d+\]/)).not.toBeInTheDocument();

      // Waiting/idle agents should not show elapsed time
      expect(screen.queryByText(/tester.*\[\d+:\d+\]/)).not.toBeInTheDocument();
      expect(screen.queryByText(/reviewer.*\[\d+:\d+\]/)).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode via displayMode prop', () => {
    it('should display agents in compact format when displayMode="compact"', () => {
      render(<AgentPanel {...baseProps} displayMode="compact" />);

      // Should show all agents with icons and names
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Should show separators
      expect(screen.getAllByText('│')).toHaveLength(4);
    });

    it('should prioritize displayMode over compact prop', () => {
      render(<AgentPanel {...baseProps} compact={false} displayMode="compact" />);

      // Should still display in compact format despite compact={false}
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(4);
    });
  });

  describe('Agent Status Icons in Compact Mode', () => {
    it('should display correct status icons for each agent', () => {
      render(<AgentPanel {...baseProps} compact={true} />);

      const statusElements = screen.getAllByTestId('agent-panel-text');

      // Find elements containing status icons
      const completedIcon = statusElements.find(el => el.textContent?.includes('✓'));
      const activeIcon = statusElements.find(el => el.textContent?.includes('⚡'));
      const waitingIcon = statusElements.find(el => el.textContent?.includes('○'));
      const idleIcon = statusElements.find(el => el.textContent?.includes('·'));

      expect(completedIcon).toBeTruthy();
      expect(activeIcon).toBeTruthy();
      expect(waitingIcon).toBeTruthy();
      expect(idleIcon).toBeTruthy();
    });

    it('should apply correct colors for current agent', () => {
      render(<AgentPanel {...baseProps} compact={true} />);

      // Current agent (developer) should have different styling
      const developerElement = screen.getByText('developer');
      expect(developerElement).toHaveStyle({ color: 'green' }); // Developer's color

      // Non-current agents should be grayed out
      const plannerElement = screen.getByText('planner');
      expect(plannerElement).toHaveStyle({ color: 'gray' });
    });
  });

  describe('Parallel Execution in Compact Mode', () => {
    const parallelAgents: AgentInfo[] = [
      {
        name: 'tester1',
        status: 'parallel',
        progress: 45,
        startedAt: new Date(Date.now() - 15000), // 15 seconds ago
      },
      {
        name: 'tester2',
        status: 'parallel',
        progress: 60,
        startedAt: new Date(Date.now() - 20000), // 20 seconds ago
      },
    ];

    it('should display parallel agents in compact mode', () => {
      render(
        <AgentPanel
          {...baseProps}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show parallel execution indicator
      expect(screen.getByText('⟂')).toBeInTheDocument();

      // Should show parallel agent names
      expect(screen.getByText('tester1')).toBeInTheDocument();
      expect(screen.getByText('tester2')).toBeInTheDocument();

      // Should show progress for parallel agents
      expect(screen.getByText(/tester1.*45%/)).toBeInTheDocument();
      expect(screen.getByText(/tester2.*60%/)).toBeInTheDocument();

      // Should show elapsed time for parallel agents
      expect(screen.getByText(/tester1.*\[00:15\]/)).toBeInTheDocument();
      expect(screen.getByText(/tester2.*\[00:20\]/)).toBeInTheDocument();
    });

    it('should separate parallel agents with commas', () => {
      render(
        <AgentPanel
          {...baseProps}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should have one comma between the two parallel agents
      expect(screen.getByText(',')).toBeInTheDocument();
    });

    it('should not show parallel section when no parallel agents', () => {
      render(
        <AgentPanel
          {...baseProps}
          compact={true}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      // Should not show parallel execution indicator
      expect(screen.queryByText('⟂')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases in Compact Mode', () => {
    it('should handle empty agents list', () => {
      render(<AgentPanel agents={[]} compact={true} />);

      // Should render without crashing
      expect(screen.getByTestId('agent-panel-box')).toBeInTheDocument();

      // Should not show any agent names or separators
      expect(screen.queryByText('│')).not.toBeInTheDocument();
    });

    it('should handle single agent', () => {
      const singleAgent: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          progress: 50,
          startedAt: new Date(Date.now() - 30000),
        },
      ];

      render(<AgentPanel agents={singleAgent} compact={true} />);

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/\[00:30\]/)).toBeInTheDocument();

      // Should not show separators with only one agent
      expect(screen.queryByText('│')).not.toBeInTheDocument();
    });

    it('should handle agents without startedAt', () => {
      const agentsWithoutStartTime: AgentInfo[] = [
        {
          name: 'planner',
          status: 'active',
          progress: 25,
          // No startedAt
        },
      ];

      render(<AgentPanel agents={agentsWithoutStartTime} compact={true} />);

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText(/25%/)).toBeInTheDocument();

      // Should not show elapsed time when startedAt is missing
      expect(screen.queryByText(/\[\d+:\d+\]/)).not.toBeInTheDocument();
    });

    it('should handle agents with 0% progress', () => {
      const agentsWithZeroProgress: AgentInfo[] = [
        {
          name: 'tester',
          status: 'active',
          progress: 0,
          startedAt: new Date(Date.now() - 10000),
        },
      ];

      render(<AgentPanel agents={agentsWithZeroProgress} compact={true} />);

      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/\[00:10\]/)).toBeInTheDocument();

      // Should not show 0% progress
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    });

    it('should handle agents with 100% progress', () => {
      const agentsWithFullProgress: AgentInfo[] = [
        {
          name: 'reviewer',
          status: 'active',
          progress: 100,
          startedAt: new Date(Date.now() - 5000),
        },
      ];

      render(<AgentPanel agents={agentsWithFullProgress} compact={true} />);

      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText(/\[00:05\]/)).toBeInTheDocument();

      // Should not show 100% progress
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    });
  });

  describe('Non-Compact Mode Comparison', () => {
    it('should display differently in normal mode', () => {
      const { rerender } = render(<AgentPanel {...baseProps} compact={false} />);

      // Normal mode should have different layout (not single line)
      // This is a basic check since we don't know the exact normal mode implementation
      expect(screen.getByTestId('agent-panel-box')).toBeInTheDocument();

      // Switch to compact mode for comparison
      rerender(<AgentPanel {...baseProps} compact={true} />);

      // Should show separators in compact mode
      expect(screen.getAllByText('│')).toHaveLength(4);
    });
  });
});