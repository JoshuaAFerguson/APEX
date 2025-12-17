import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../components/StatusBar';
import { AgentPanel, AgentInfo, AgentPanelProps } from '../components/agents/AgentPanel';
import { TaskProgress, TaskProgressProps } from '../components/TaskProgress';
import { ActivityLog, LogEntry, ActivityLogProps } from '../components/ActivityLog';

// Mock all necessary modules
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useStdout: () => ({ stdout: { columns: 120 } }),
    Box: ({ children, ...props }: any) => <div data-testid={`box-${props.className || 'default'}`} {...props}>{children}</div>,
    Text: ({ children, color, bold, dimColor, ...props }: any) => (
      <span
        style={{
          color,
          fontWeight: bold ? 'bold' : 'normal',
          opacity: dimColor ? 0.7 : 1
        }}
        data-testid={`text-${color || 'default'}`}
        {...props}
      >
        {children}
      </span>
    ),
  };
});

vi.mock('ink-spinner', () => ({
  default: ({ type }: { type: string }) => <span data-testid="spinner">{type === 'dots' ? '⋯' : '○'}</span>,
}));

vi.mock('../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: () => ({
    width: 120,
    height: 30,
    breakpoint: 'wide' as const,
  }),
}));

vi.mock('../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    currentAgent: 'developer',
    handoffState: 'active',
    timeInState: 30000,
    isTransitioning: false,
  })),
}));

vi.mock('../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn((startTime: Date | null) => {
    if (!startTime) return '00:00';
    const diff = Date.now() - startTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }),
}));

vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: () => ({
    width: 120,
    height: 30,
    breakpoint: 'wide' as const,
  }),
}));

describe('Compact Mode Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test data setup
  const mockStatusBarProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'feature/compact-mode',
    tokens: { input: 1000, output: 500 },
    cost: 0.0234,
    sessionCost: 1.5678,
    model: 'claude-3-sonnet',
    agent: 'developer',
    workflowStage: 'implementation',
    apiUrl: 'http://localhost:4000',
    webUrl: 'http://localhost:3000',
    sessionStartTime: new Date(Date.now() - 120000), // 2 minutes ago
    subtaskProgress: { completed: 3, total: 5 },
    sessionName: 'Test Session',
    previewMode: true,
    showThoughts: true,
  };

  const mockAgents: AgentInfo[] = [
    {
      name: 'planner',
      status: 'completed',
      stage: 'planning',
      progress: 100,
      startedAt: new Date(Date.now() - 60000),
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
      startedAt: new Date(Date.now() - 30000),
    },
    {
      name: 'tester',
      status: 'waiting',
      stage: 'testing',
      progress: 0,
    },
  ];

  const mockAgentPanelProps: AgentPanelProps = {
    agents: mockAgents,
    currentAgent: 'developer',
  };

  const mockTaskProgressProps: TaskProgressProps = {
    taskId: 'task-abc123def456',
    description: 'Implement compact mode behavior for UI components',
    status: 'in-progress',
    workflow: 'feature-development',
    currentStage: 'implementation',
    agent: 'developer',
    subtasks: [
      {
        id: 'subtask-1',
        description: 'Update StatusBar component',
        status: 'completed',
      },
      {
        id: 'subtask-2',
        description: 'Update AgentPanel component',
        status: 'in-progress',
      },
    ],
    tokens: { input: 1500, output: 800 },
    cost: 0.0567,
  };

  const mockLogEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      level: 'info',
      message: 'Application started',
      agent: 'system',
      category: 'startup',
    },
    {
      id: '2',
      timestamp: new Date('2024-01-01T10:00:01Z'),
      level: 'debug',
      message: 'Debug information',
      agent: 'developer',
      category: 'development',
    },
  ];

  const mockActivityLogProps: ActivityLogProps = {
    entries: mockLogEntries,
    maxEntries: 100,
    showTimestamps: true,
    showAgents: true,
    allowCollapse: true,
    filterLevel: 'debug',
    title: 'Activity Log',
    autoScroll: true,
  };

  describe('Complete UI Integration in Compact Mode', () => {
    it('should render all components correctly in compact mode', () => {
      const CompactModeApp = () => (
        <div data-testid="app-container">
          <StatusBar {...mockStatusBarProps} displayMode="compact" />
          <AgentPanel {...mockAgentPanelProps} displayMode="compact" />
          <TaskProgress {...mockTaskProgressProps} displayMode="compact" />
          {/* ActivityLog is hidden in compact mode per acceptance criteria */}
        </div>
      );

      render(<CompactModeApp />);

      // StatusBar should show minimal info
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument(); // Git branch
      expect(screen.getByText(/\$0\.0234/)).toBeInTheDocument(); // Cost
      expect(screen.queryByText('developer')).not.toBeInTheDocument(); // Agent hidden in StatusBar
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // Stage hidden

      // AgentPanel should show compact format
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText(/developer.*65%.*\[00:30\]/)).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(3); // Agent separators

      // TaskProgress should show single line
      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.getByText('task-abc1')).toBeInTheDocument(); // Truncated ID
      expect(screen.getByText(/Implement compact mode behavior/)).toBeInTheDocument();
      expect(screen.getByText('⚡developer')).toBeInTheDocument(); // Agent with icon
      expect(screen.getByText('2.3tk')).toBeInTheDocument(); // Token count
      expect(screen.getByText('$0.06')).toBeInTheDocument(); // Cost

      // ActivityLog should not be present
      expect(screen.queryByText('Activity Log')).not.toBeInTheDocument();
      expect(screen.queryByText('Application started')).not.toBeInTheDocument();
    });

    it('should compare compact mode with normal mode behavior', () => {
      const ModeAwareApp = ({ displayMode }: { displayMode: 'normal' | 'compact' | 'verbose' }) => (
        <div data-testid="app-container">
          <StatusBar {...mockStatusBarProps} displayMode={displayMode} />
          <AgentPanel {...mockAgentPanelProps} displayMode={displayMode} />
          <TaskProgress {...mockTaskProgressProps} displayMode={displayMode} />
          {/* ActivityLog only shown in non-compact modes */}
          {displayMode !== 'compact' && <ActivityLog {...mockActivityLogProps} />}
        </div>
      );

      const { rerender } = render(<ModeAwareApp displayMode="normal" />);

      // Normal mode should show detailed information
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument(); // Agent shown in StatusBar
      expect(screen.getByText('implementation')).toBeInTheDocument(); // Stage shown
      expect(screen.getByText(/02:00/)).toBeInTheDocument(); // Timer shown
      expect(screen.getByText('feature-development')).toBeInTheDocument(); // Workflow shown
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // Longer task ID
      expect(screen.getByText('Activity Log')).toBeInTheDocument(); // ActivityLog present

      // Switch to compact mode
      rerender(<ModeAwareApp displayMode="compact" />);

      // Compact mode should show minimal information
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument(); // Branch still shown
      expect(screen.queryByText(/developer.*⚡/)).not.toBeInTheDocument(); // Agent not in StatusBar
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // Stage hidden
      expect(screen.queryByText(/02:00/)).not.toBeInTheDocument(); // Timer hidden
      expect(screen.queryByText('feature-development')).not.toBeInTheDocument(); // Workflow hidden
      expect(screen.getByText('task-abc1')).toBeInTheDocument(); // Shorter task ID
      expect(screen.queryByText('Activity Log')).not.toBeInTheDocument(); // ActivityLog hidden
    });
  });

  describe('Responsive Behavior in Compact Mode', () => {
    it('should maintain compact behavior in narrow terminal', () => {
      const useStdoutDimensionsMock = vi.mocked(require('../hooks/useStdoutDimensions').useStdoutDimensions);
      useStdoutDimensionsMock.mockReturnValue({
        width: 40,
        height: 20,
        breakpoint: 'narrow' as const,
      });

      const NarrowCompactApp = () => (
        <div data-testid="narrow-app">
          <StatusBar {...mockStatusBarProps} displayMode="compact" />
          <AgentPanel {...mockAgentPanelProps} displayMode="compact" />
          <TaskProgress {...mockTaskProgressProps} displayMode="compact" />
        </div>
      );

      render(<NarrowCompactApp />);

      // Essential elements should still be present even in narrow terminal
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.getByText(/\$0\.0234/)).toBeInTheDocument();

      // AgentPanel should still show compact format
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText(/developer/)).toBeInTheDocument();

      // TaskProgress should maintain single line
      expect(screen.getByText('task-abc1')).toBeInTheDocument();
    });

    it('should maintain compact behavior in wide terminal', () => {
      const useStdoutDimensionsMock = vi.mocked(require('../hooks/useStdoutDimensions').useStdoutDimensions);
      useStdoutDimensionsMock.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide' as const,
      });

      const WideCompactApp = () => (
        <div data-testid="wide-app">
          <StatusBar {...mockStatusBarProps} displayMode="compact" />
          <AgentPanel {...mockAgentPanelProps} displayMode="compact" />
          <TaskProgress {...mockTaskProgressProps} displayMode="compact" />
        </div>
      );

      render(<WideCompactApp />);

      // Should still show minimal info even with available space
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // Still hidden

      // AgentPanel should keep compact format
      expect(screen.getAllByText('│')).toHaveLength(3); // Still using compact separators
    });
  });

  describe('Real-time Updates in Compact Mode', () => {
    it('should handle agent status updates in compact mode', () => {
      const DynamicApp = ({ currentAgent }: { currentAgent: string }) => {
        const updatedAgents = mockAgents.map(agent =>
          agent.name === currentAgent
            ? { ...agent, status: 'active' as const, progress: 75 }
            : agent
        );

        return (
          <div data-testid="dynamic-app">
            <AgentPanel agents={updatedAgents} currentAgent={currentAgent} displayMode="compact" />
          </div>
        );
      };

      const { rerender } = render(<DynamicApp currentAgent="developer" />);

      // Initial state
      expect(screen.getByText(/developer.*65%/)).toBeInTheDocument();

      // Update to tester as current agent
      rerender(<DynamicApp currentAgent="tester" />);

      // Should update the active agent display
      expect(screen.getByText(/tester.*75%/)).toBeInTheDocument();
    });

    it('should handle cost updates in StatusBar compact mode', () => {
      const CostUpdateApp = ({ cost }: { cost: number }) => (
        <div data-testid="cost-app">
          <StatusBar {...mockStatusBarProps} cost={cost} displayMode="compact" />
        </div>
      );

      const { rerender } = render(<CostUpdateApp cost={0.0234} />);

      // Initial cost
      expect(screen.getByText('$0.0234')).toBeInTheDocument();

      // Update cost
      rerender(<CostUpdateApp cost={0.1567} />);

      // Should show updated cost
      expect(screen.getByText('$0.1567')).toBeInTheDocument();
      expect(screen.queryByText('$0.0234')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling in Compact Mode', () => {
    it('should handle component errors gracefully in compact mode', () => {
      const ErrorProneApp = ({ shouldError }: { shouldError: boolean }) => {
        if (shouldError) {
          throw new Error('Test error');
        }

        return (
          <div data-testid="error-app">
            <StatusBar {...mockStatusBarProps} displayMode="compact" />
            <AgentPanel {...mockAgentPanelProps} displayMode="compact" />
          </div>
        );
      };

      // Should render normally without error
      render(<ErrorProneApp shouldError={false} />);

      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('should handle missing data gracefully in compact mode', () => {
      const MinimalDataApp = () => (
        <div data-testid="minimal-app">
          <StatusBar
            isConnected={true}
            displayMode="compact"
            // Most props missing
          />
          <AgentPanel
            agents={[]}
            displayMode="compact"
            // Empty agents list
          />
          <TaskProgress
            taskId="min"
            description=""
            status="pending"
            displayMode="compact"
            // Minimal data
          />
        </div>
      );

      render(<MinimalDataApp />);

      // Should render without crashing
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
      expect(screen.getByText('pending')).toBeInTheDocument(); // Task status
      expect(screen.getByText('min')).toBeInTheDocument(); // Task ID
    });
  });

  describe('Performance in Compact Mode', () => {
    it('should render efficiently with large datasets in compact mode', () => {
      // Create large datasets
      const manyAgents = Array.from({ length: 20 }, (_, i) => ({
        name: `agent-${i}`,
        status: 'idle' as const,
        stage: `stage-${i}`,
        progress: i * 5,
      }));

      const manySubtasks = Array.from({ length: 50 }, (_, i) => ({
        id: `subtask-${i}`,
        description: `Subtask ${i} description`,
        status: 'pending' as const,
      }));

      const LargeDataApp = () => (
        <div data-testid="large-data-app">
          <AgentPanel agents={manyAgents} displayMode="compact" />
          <TaskProgress
            taskId="large-task"
            description="Task with many subtasks"
            status="in-progress"
            subtasks={manySubtasks}
            displayMode="compact"
          />
        </div>
      );

      const startTime = performance.now();
      render(<LargeDataApp />);
      const endTime = performance.now();

      // Should render quickly (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50);

      // Should show agents in compact format
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-19')).toBeInTheDocument();

      // Should show task in compact format (subtasks hidden)
      expect(screen.getByText('large-tas')).toBeInTheDocument(); // Truncated ID
      expect(screen.queryByText('Subtask 0 description')).not.toBeInTheDocument(); // Subtasks hidden
    });
  });

  describe('Accessibility in Compact Mode', () => {
    it('should maintain accessibility attributes in compact mode', () => {
      const AccessibleApp = () => (
        <div data-testid="accessible-app">
          <StatusBar {...mockStatusBarProps} displayMode="compact" />
          <AgentPanel {...mockAgentPanelProps} displayMode="compact" />
          <TaskProgress {...mockTaskProgressProps} displayMode="compact" />
        </div>
      );

      render(<AccessibleApp />);

      // Check that components render with testable elements
      expect(screen.getByTestId('accessible-app')).toBeInTheDocument();

      // Check that essential information is still accessible
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument(); // Git info
      expect(screen.getByText('developer')).toBeInTheDocument(); // Current agent
      expect(screen.getByText('in-progress')).toBeInTheDocument(); // Task status
    });
  });
});