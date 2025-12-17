import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { TaskProgress, TaskProgressProps } from '../TaskProgress';
import { useStdoutDimensions } from '../../hooks/index';

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

// Mock the useStdoutDimensions hook
vi.mock('../../hooks/index', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 80,
    height: 24,
    breakpoint: 'normal' as const,
    isAvailable: true,
  })),
}));

describe('TaskProgress - Comprehensive Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const mockHook = useStdoutDimensions as Mock;

  const baseProps: TaskProgressProps = {
    taskId: 'task-abc123def456ghi789',
    description: 'Test task with comprehensive edge case coverage',
    status: 'in-progress',
    workflow: 'comprehensive-testing',
    currentStage: 'edge-case-testing',
    agent: 'tester',
  };

  describe('Extreme Terminal Dimensions', () => {
    it('should handle extremely narrow terminal (20 cols)', () => {
      mockHook.mockReturnValue({
        width: 20,
        height: 10,
        breakpoint: 'narrow' as const,
        isAvailable: true,
      });

      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Should auto-compact and not crash
      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.getByText('task-abc')).toBeInTheDocument(); // 8 chars

      // Should have minimal but readable description
      const description = screen.getByText(/Test task/);
      expect(description).toBeInTheDocument();
      expect(description.textContent!.length).toBeGreaterThanOrEqual(15); // Minimum readability
    });

    it('should handle extremely wide terminal (300 cols)', () => {
      mockHook.mockReturnValue({
        width: 300,
        height: 50,
        breakpoint: 'wide' as const,
        isAvailable: true,
      });

      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Should render full layout but cap description for readability
      expect(screen.getByText('comprehensive-testing')).toBeInTheDocument();
      expect(screen.getByText('edge-case-testing')).toBeInTheDocument();

      const description = screen.getByText(/Test task with comprehensive edge case coverage/);
      expect(description).toBeInTheDocument();
      // Description should be full since it's under 120 char limit
      expect(description.textContent).toBe('Test task with comprehensive edge case coverage');
    });

    it('should handle extremely tall terminal (100 rows)', () => {
      mockHook.mockReturnValue({
        width: 120,
        height: 100,
        breakpoint: 'normal' as const,
        isAvailable: true,
      });

      const manySubtasks = Array.from({ length: 20 }, (_, i) => ({
        id: `subtask-${i + 1}`,
        description: `Subtask ${i + 1}: Testing with many subtasks`,
        status: i < 5 ? 'completed' : i < 10 ? 'in-progress' : 'pending' as const,
      }));

      render(<TaskProgress {...baseProps} subtasks={manySubtasks} displayMode="verbose" />);

      // Verbose mode with height=100: Math.max(3, Math.min(15, Math.floor(100/3))) = 15 subtasks max
      expect(screen.getByText(/Subtasks \(5\/20\)/)).toBeInTheDocument(); // 5 completed out of 20 total
      expect(screen.getByText('Subtask 1: Testing with many subtasks')).toBeInTheDocument();
      expect(screen.getByText('... and 5 more')).toBeInTheDocument(); // 20 - 15 = 5 more
    });

    it('should handle extremely short terminal (5 rows)', () => {
      mockHook.mockReturnValue({
        width: 80,
        height: 5,
        breakpoint: 'normal' as const,
        isAvailable: true,
      });

      const subtasks = [
        { id: 'sub1', description: 'First subtask', status: 'completed' as const },
        { id: 'sub2', description: 'Second subtask', status: 'in-progress' as const },
        { id: 'sub3', description: 'Third subtask', status: 'pending' as const },
      ];

      render(<TaskProgress {...baseProps} subtasks={subtasks} displayMode="normal" />);

      // Normal mode with height=5: Math.max(2, Math.min(5, Math.floor(5/4))) = Math.max(2, 1) = 2 subtasks max
      expect(screen.getByText(/Subtasks \(1\/3\)/)).toBeInTheDocument();
      expect(screen.getByText('First subtask')).toBeInTheDocument();
      expect(screen.getByText('Second subtask')).toBeInTheDocument();
      expect(screen.getByText('... and 1 more')).toBeInTheDocument();
    });
  });

  describe('Complex Content Edge Cases', () => {
    it('should handle very long task ID (100+ chars)', () => {
      const longTaskId = 'task-' + 'a'.repeat(100) + '-very-long-id-that-should-be-truncated-properly';

      render(<TaskProgress {...baseProps} taskId={longTaskId} displayMode="normal" />);

      // Should use 12-char truncation for normal mode
      expect(screen.getByText('task-aaaaaaa')).toBeInTheDocument(); // 'task-' + 7 'a's = 12 chars
    });

    it('should handle very long description (500+ chars)', () => {
      const longDescription = 'This is an extremely long task description that goes on and on and contains many details about what needs to be accomplished in this particular task including various requirements specifications and implementation details that span multiple sentences and could easily overflow terminal width boundaries if not handled properly by the truncation logic in the TaskProgress component which should intelligently calculate available space and truncate appropriately while maintaining readability for the user who needs to understand what the task is about without being overwhelmed by excessive text that does not fit in the available terminal space.';

      mockHook.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: true,
      });

      render(<TaskProgress {...baseProps} description={longDescription} displayMode="normal" />);

      const displayedText = screen.getByText(/This is an extremely long task description/);
      expect(displayedText).toBeInTheDocument();
      expect(displayedText.textContent!.length).toBeLessThanOrEqual(77); // width(80) - borders/padding(6) = 74, with margin for ellipsis
      expect(displayedText.textContent).toMatch(/\.\.\.$/); // Should end with ellipsis
    });

    it('should handle Unicode characters in description', () => {
      const unicodeDescription = 'Task with émojis 🚀 and üñíçødé characters 中文 русский';

      render(<TaskProgress {...baseProps} description={unicodeDescription} displayMode="normal" />);

      const description = screen.getByText(/Task with émojis 🚀 and üñíçødé/);
      expect(description).toBeInTheDocument();
    });

    it('should handle empty/whitespace-only values gracefully', () => {
      render(
        <TaskProgress
          taskId="   "
          description="   "
          status="pending"
          workflow="   "
          currentStage="   "
          agent="   "
          displayMode="normal"
        />
      );

      // Should render without crashing
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  describe('Complex Metrics Edge Cases', () => {
    it('should handle very large token counts', () => {
      const largeTokens = { input: 999999, output: 888888 };

      render(<TaskProgress {...baseProps} tokens={largeTokens} displayMode="compact" />);

      // Should format large numbers correctly: (999999 + 888888) / 1000 = 1888.9k
      expect(screen.getByText('1888.9tk')).toBeInTheDocument();
    });

    it('should handle very small costs', () => {
      const tinyCost = 0.000001;

      render(<TaskProgress {...baseProps} cost={tinyCost} displayMode="compact" />);

      // Should format tiny costs with 4 decimal places
      expect(screen.getByText('$0.0000')).toBeInTheDocument();
    });

    it('should handle very large costs', () => {
      const largeCost = 999.999;

      render(<TaskProgress {...baseProps} cost={largeCost} displayMode="compact" />);

      // Should format large costs with 2 decimal places
      expect(screen.getByText('$1000.00')).toBeInTheDocument();
    });

    it('should handle negative values gracefully', () => {
      const negativeTokens = { input: -100, output: 200 };
      const negativeCost = -0.05;

      render(<TaskProgress {...baseProps} tokens={negativeTokens} cost={negativeCost} displayMode="compact" />);

      // Should handle negative totals: (-100 + 200) = 100
      expect(screen.getByText('100tk')).toBeInTheDocument();
      expect(screen.getByText('$-0.0500')).toBeInTheDocument();
    });
  });

  describe('Breakpoint Transition Edge Cases', () => {
    it('should handle breakpoint exactly at boundaries', () => {
      // Test exactly at 60 cols boundary
      mockHook.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'compact' as const, // useStdoutDimensions returns 'compact' for 60-99 cols
        isAvailable: true,
      });

      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // At width=60, should not auto-compact (only < 60 auto-compacts)
      expect(screen.getByText('comprehensive-testing')).toBeInTheDocument();
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars for non-narrow
    });

    it('should handle breakpoint exactly at 59 cols (narrow boundary)', () => {
      mockHook.mockReturnValue({
        width: 59,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
      });

      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // At width=59, should auto-compact
      expect(screen.queryByText('comprehensive-testing')).not.toBeInTheDocument();
      expect(screen.getByText('task-abc')).toBeInTheDocument(); // 8 chars for narrow
    });
  });

  describe('Dynamic Recalculation Edge Cases', () => {
    it('should recalculate properly when switching between all breakpoints', () => {
      const { rerender } = render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Start with narrow
      mockHook.mockReturnValue({
        width: 50,
        height: 20,
        breakpoint: 'narrow' as const,
        isAvailable: true,
      });
      rerender(<TaskProgress {...baseProps} displayMode="normal" />);
      expect(screen.queryByText('comprehensive-testing')).not.toBeInTheDocument(); // Auto-compact
      expect(screen.getByText('task-abc')).toBeInTheDocument(); // 8 chars

      // Switch to compact
      mockHook.mockReturnValue({
        width: 80,
        height: 20,
        breakpoint: 'compact' as const,
        isAvailable: true,
      });
      rerender(<TaskProgress {...baseProps} displayMode="normal" />);
      expect(screen.getByText('comprehensive-testing')).toBeInTheDocument(); // Full layout
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars

      // Switch to normal
      mockHook.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal' as const,
        isAvailable: true,
      });
      rerender(<TaskProgress {...baseProps} displayMode="normal" />);
      expect(screen.getByText('comprehensive-testing')).toBeInTheDocument(); // Full layout
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars

      // Switch to wide
      mockHook.mockReturnValue({
        width: 180,
        height: 40,
        breakpoint: 'wide' as const,
        isAvailable: true,
      });
      rerender(<TaskProgress {...baseProps} displayMode="normal" />);
      expect(screen.getByText('comprehensive-testing')).toBeInTheDocument(); // Full layout
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars
    });

    it('should handle dimensions unavailable scenario', () => {
      mockHook.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: false, // Dimensions not available
      });

      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Should still render using fallback dimensions
      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.getByText(/Test task/)).toBeInTheDocument();
    });
  });

  describe('Complex Display Mode Interactions', () => {
    it('should handle verbose mode in narrow terminal with many subtasks', () => {
      mockHook.mockReturnValue({
        width: 50,
        height: 30,
        breakpoint: 'narrow' as const,
        isAvailable: true,
      });

      const manySubtasks = Array.from({ length: 10 }, (_, i) => ({
        id: `sub-${i}`,
        description: `Verbose subtask ${i + 1}`,
        status: 'pending' as const,
      }));

      render(<TaskProgress {...baseProps} subtasks={manySubtasks} displayMode="verbose" />);

      // Verbose mode should override narrow auto-compact
      expect(screen.getByText('comprehensive-testing')).toBeInTheDocument();
      expect(screen.getByText('task-abc')).toBeInTheDocument(); // Still use narrow task ID length

      // Verbose with height=30: Math.max(3, Math.min(15, Math.floor(30/3))) = 10 subtasks
      expect(screen.getByText(/Subtasks \(0\/10\)/)).toBeInTheDocument();
      expect(screen.getByText('Verbose subtask 1')).toBeInTheDocument();
      expect(screen.getByText('Verbose subtask 10')).toBeInTheDocument();
    });
  });
});