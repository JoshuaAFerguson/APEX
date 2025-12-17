import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { TaskProgress, TaskProgressProps, SubtaskInfo } from '../TaskProgress';

// Mock ink components
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    Box: ({ children, ...props }: any) => <div data-testid="task-progress-box" {...props}>{children}</div>,
    Text: ({ children, color, bold, dimColor, ...props }: any) => (
      <span
        style={{
          color,
          fontWeight: bold ? 'bold' : 'normal',
          opacity: dimColor ? 0.7 : 1
        }}
        data-testid="task-progress-text"
        {...props}
      >
        {children}
      </span>
    ),
  };
});

// Mock ink-spinner
vi.mock('ink-spinner', () => ({
  default: ({ type }: { type: string }) => <span data-testid="spinner">{type === 'dots' ? '⋯' : '○'}</span>,
}));

describe('TaskProgress - Compact Mode Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps: TaskProgressProps = {
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
      {
        id: 'subtask-3',
        description: 'Update TaskProgress component',
        status: 'pending',
      },
    ],
    tokens: { input: 1500, output: 800 },
    cost: 0.0567,
  };

  describe('Compact Mode Layout', () => {
    it('should display single line layout in compact mode', () => {
      render(<TaskProgress {...baseProps} displayMode="compact" />);

      // Should show status icon and text
      expect(screen.getByTestId('spinner')).toBeInTheDocument(); // In-progress spinner
      expect(screen.getByText('in-progress')).toBeInTheDocument();

      // Should show truncated task ID
      expect(screen.getByText('task-abc1')).toBeInTheDocument(); // First 8 chars

      // Should show truncated description
      expect(screen.getByText(/Implement compact mode behavior for UI/)).toBeInTheDocument();

      // Should show agent with icon
      expect(screen.getByText('⚡developer')).toBeInTheDocument();

      // Should show token count
      expect(screen.getByText('2.3tk')).toBeInTheDocument(); // 1500 + 800 = 2300 → 2.3k

      // Should show cost
      expect(screen.getByText('$0.06')).toBeInTheDocument(); // Formatted cost
    });

    it('should not show workflow, stage, or subtasks in compact mode', () => {
      render(<TaskProgress {...baseProps} displayMode="compact" />);

      // Should not show detailed workflow information
      expect(screen.queryByText('feature-development')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();

      // Should not show subtasks
      expect(screen.queryByText('Update StatusBar component')).not.toBeInTheDocument();
      expect(screen.queryByText('Update AgentPanel component')).not.toBeInTheDocument();
      expect(screen.queryByText('Subtasks')).not.toBeInTheDocument();

      // Should not show labels
      expect(screen.queryByText('tokens:')).not.toBeInTheDocument();
      expect(screen.queryByText('cost:')).not.toBeInTheDocument();
    });
  });

  describe('Status Icons and Colors', () => {
    it('should display correct icon for pending status', () => {
      render(<TaskProgress {...baseProps} status="pending" displayMode="compact" />);

      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('○')).toBeInTheDocument(); // Pending icon
    });

    it('should display correct icon for queued status', () => {
      render(<TaskProgress {...baseProps} status="queued" displayMode="compact" />);

      expect(screen.getByText('queued')).toBeInTheDocument();
      expect(screen.getByText('◐')).toBeInTheDocument(); // Queued icon
    });

    it('should display correct icon for planning status', () => {
      render(<TaskProgress {...baseProps} status="planning" displayMode="compact" />);

      expect(screen.getByText('planning')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument(); // Planning spinner
    });

    it('should display correct icon for in-progress status', () => {
      render(<TaskProgress {...baseProps} status="in-progress" displayMode="compact" />);

      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument(); // In-progress spinner
    });

    it('should display correct icon for waiting-approval status', () => {
      render(<TaskProgress {...baseProps} status="waiting-approval" displayMode="compact" />);

      expect(screen.getByText('waiting-approval')).toBeInTheDocument();
      expect(screen.getByText('⏸')).toBeInTheDocument(); // Waiting approval icon
    });

    it('should display correct icon for completed status', () => {
      render(<TaskProgress {...baseProps} status="completed" displayMode="compact" />);

      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument(); // Completed icon
    });

    it('should display correct icon for failed status', () => {
      render(<TaskProgress {...baseProps} status="failed" displayMode="compact" />);

      expect(screen.getByText('failed')).toBeInTheDocument();
      expect(screen.getByText('✗')).toBeInTheDocument(); // Failed icon
    });

    it('should display correct icon for cancelled status', () => {
      render(<TaskProgress {...baseProps} status="cancelled" displayMode="compact" />);

      expect(screen.getByText('cancelled')).toBeInTheDocument();
      expect(screen.getByText('⊘')).toBeInTheDocument(); // Cancelled icon
    });
  });

  describe('Data Formatting', () => {
    it('should truncate long descriptions to 40 characters', () => {
      const longDescription = 'This is a very long task description that should be truncated in compact mode to fit the single line layout appropriately';

      render(<TaskProgress {...baseProps} description={longDescription} displayMode="compact" />);

      // Should show truncated description (40 chars - 3 for ellipsis = 37 + "...")
      expect(screen.getByText('This is a very long task description t...')).toBeInTheDocument();
    });

    it('should format token counts correctly', () => {
      const testCases = [
        { input: 500, output: 300, expected: '800' }, // < 1000
        { input: 700, output: 500, expected: '1.2k' }, // >= 1000
        { input: 5000, output: 3000, expected: '8.0k' }, // Large numbers
      ];

      testCases.forEach(({ input, output, expected }) => {
        const { rerender } = render(
          <TaskProgress
            {...baseProps}
            tokens={{ input, output }}
            displayMode="compact"
          />
        );

        expect(screen.getByText(`${expected}tk`)).toBeInTheDocument();

        // Clean up for next test
        rerender(<TaskProgress {...baseProps} displayMode="compact" />);
      });
    });

    it('should format cost correctly', () => {
      const testCases = [
        { cost: 0.0001, expected: '$0.0001' }, // Very small amount
        { cost: 0.005, expected: '$0.0050' }, // Small amount < 0.01
        { cost: 0.15, expected: '$0.15' }, // Regular amount >= 0.01
        { cost: 1.234, expected: '$1.23' }, // Rounded to 2 decimals
      ];

      testCases.forEach(({ cost, expected }) => {
        const { rerender } = render(
          <TaskProgress {...baseProps} cost={cost} displayMode="compact" />
        );

        expect(screen.getByText(expected)).toBeInTheDocument();

        // Clean up for next test
        rerender(<TaskProgress {...baseProps} displayMode="compact" />);
      });
    });

    it('should truncate task ID to 8 characters', () => {
      const longTaskId = 'task-very-long-task-id-that-should-be-truncated';

      render(<TaskProgress {...baseProps} taskId={longTaskId} displayMode="compact" />);

      expect(screen.getByText('task-ver')).toBeInTheDocument(); // First 8 chars
      expect(screen.queryByText(longTaskId)).not.toBeInTheDocument();
    });
  });

  describe('Optional Props Handling', () => {
    it('should handle missing agent gracefully', () => {
      const propsWithoutAgent = { ...baseProps, agent: undefined };

      render(<TaskProgress {...propsWithoutAgent} displayMode="compact" />);

      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.queryByText('⚡')).not.toBeInTheDocument(); // No agent icon
    });

    it('should handle missing tokens gracefully', () => {
      const propsWithoutTokens = { ...baseProps, tokens: undefined };

      render(<TaskProgress {...propsWithoutTokens} displayMode="compact" />);

      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.queryByText(/tk$/)).not.toBeInTheDocument(); // No token count
    });

    it('should handle missing cost gracefully', () => {
      const propsWithoutCost = { ...baseProps, cost: undefined };

      render(<TaskProgress {...propsWithoutCost} displayMode="compact" />);

      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument(); // No cost
    });

    it('should handle all optional props missing', () => {
      const minimalProps: TaskProgressProps = {
        taskId: 'task-123',
        description: 'Minimal task',
        status: 'pending',
        displayMode: 'compact',
      };

      render(<TaskProgress {...minimalProps} />);

      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('task-123')).toBeInTheDocument();
      expect(screen.getByText('Minimal task')).toBeInTheDocument();
      expect(screen.getByText('○')).toBeInTheDocument(); // Pending icon

      // Should not show optional elements
      expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      expect(screen.queryByText(/tk$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });
  });

  describe('Compact vs Normal Mode Comparison', () => {
    it('should show single line in compact mode vs multi-line in normal mode', () => {
      const { rerender } = render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Normal mode should show detailed layout with workflow and stage
      expect(screen.getByText('feature-development')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars in normal
      expect(screen.getByText(/tokens:/)).toBeInTheDocument(); // Labels shown

      // Switch to compact mode
      rerender(<TaskProgress {...baseProps} displayMode="compact" />);

      // Compact mode should hide detailed info
      expect(screen.queryByText('feature-development')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.getByText('task-abc1')).toBeInTheDocument(); // 8 chars in compact
      expect(screen.queryByText(/tokens:/)).not.toBeInTheDocument(); // No labels
    });

    it('should hide subtasks in compact mode', () => {
      const { rerender } = render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Normal mode should show subtasks
      expect(screen.getByText(/Subtasks/)).toBeInTheDocument();
      expect(screen.getByText('Update StatusBar component')).toBeInTheDocument();

      // Switch to compact mode
      rerender(<TaskProgress {...baseProps} displayMode="compact" />);

      // Compact mode should hide subtasks
      expect(screen.queryByText(/Subtasks/)).not.toBeInTheDocument();
      expect(screen.queryByText('Update StatusBar component')).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode Edge Cases', () => {
    it('should handle empty description', () => {
      render(<TaskProgress {...baseProps} description="" displayMode="compact" />);

      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.getByText('task-abc1')).toBeInTheDocument();
      // Empty description should not crash
    });

    it('should handle very short task ID', () => {
      render(<TaskProgress {...baseProps} taskId="t1" displayMode="compact" />);

      expect(screen.getByText('t1')).toBeInTheDocument(); // Should show full short ID
    });

    it('should handle zero token counts', () => {
      render(
        <TaskProgress
          {...baseProps}
          tokens={{ input: 0, output: 0 }}
          displayMode="compact"
        />
      );

      expect(screen.getByText('0tk')).toBeInTheDocument();
    });

    it('should handle zero cost', () => {
      render(<TaskProgress {...baseProps} cost={0} displayMode="compact" />);

      expect(screen.getByText('$0.0000')).toBeInTheDocument(); // Small cost format
    });

    it('should handle unknown status', () => {
      render(<TaskProgress {...baseProps} status="unknown" as any displayMode="compact" />);

      expect(screen.getByText('unknown')).toBeInTheDocument();
      expect(screen.getByText('?')).toBeInTheDocument(); // Unknown status icon
    });
  });
});