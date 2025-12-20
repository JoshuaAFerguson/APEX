import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { TaskProgress, TaskProgressProps, SubtaskInfo } from '../TaskProgress';
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

describe('TaskProgress - Responsive Behavior', () => {
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
    description: 'Implement responsive TaskProgress component with terminal width adaptation and dynamic truncation',
    status: 'in-progress',
    workflow: 'feature-development',
    currentStage: 'implementation',
    agent: 'developer',
    subtasks: [
      {
        id: 'subtask-1',
        description: 'Add useStdoutDimensions hook integration',
        status: 'completed',
      },
      {
        id: 'subtask-2',
        description: 'Implement calculateTruncationConfig function',
        status: 'completed',
      },
      {
        id: 'subtask-3',
        description: 'Update rendering with responsive behavior',
        status: 'in-progress',
      },
      {
        id: 'subtask-4',
        description: 'Create comprehensive test suite',
        status: 'pending',
      },
      {
        id: 'subtask-5',
        description: 'Validate implementation across breakpoints',
        status: 'pending',
      },
    ],
    tokens: { input: 1500, output: 800 },
    cost: 0.0567,
  };

  describe('Breakpoint: narrow (<60 cols)', () => {
    beforeEach(() => {
      mockHook.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow' as const,
        isAvailable: true,
      });
    });

    it('should auto-switch to compact layout when displayMode=normal', () => {
      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Should show compact layout elements
      expect(screen.getByTestId('spinner')).toBeInTheDocument(); // In-progress spinner
      expect(screen.getByText('in-progress')).toBeInTheDocument();

      // Should use 8-char task ID in narrow mode
      expect(screen.getByText('task-abc')).toBeInTheDocument(); // First 8 chars

      // Should show truncated description based on available width (~25 chars after reserving space)
      const truncatedText = screen.getByText(/Implement responsive TaskProgress/);
      expect(truncatedText).toBeInTheDocument();

      // Should NOT show workflow, stage, or subtasks (compact mode behavior)
      expect(screen.queryByText('feature-development')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText('Subtasks')).not.toBeInTheDocument();
    });

    it('should stay verbose when displayMode=verbose even in narrow', () => {
      render(<TaskProgress {...baseProps} displayMode="verbose" />);

      // Should preserve verbose mode even in narrow terminal
      expect(screen.getByText('feature-development')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();

      // Should still use narrow task ID truncation
      expect(screen.getByText('task-abc')).toBeInTheDocument(); // 8 chars

      // Should show subtasks with limit based on height
      expect(screen.getByText(/Subtasks/)).toBeInTheDocument();
      expect(screen.getByText('Add useStdoutDimensions hook integration')).toBeInTheDocument();
    });

    it('should truncate description aggressively (15-30 chars minimum)', () => {
      const longDescription = 'This is an extremely long task description that needs aggressive truncation in narrow terminals to prevent overflow';

      render(<TaskProgress {...baseProps} description={longDescription} displayMode="normal" />);

      // With width=50 and reserved space for status, taskId, agent, tokens, cost
      // Expected remaining space for description should be minimal
      const displayedText = screen.getByText(/This is an extremely long/);
      expect(displayedText.textContent!.length).toBeLessThanOrEqual(35); // Should be truncated
      expect(displayedText.textContent).toMatch(/\.\.\./); // Should have ellipsis
    });

    it('should show 8-char task ID', () => {
      render(<TaskProgress {...baseProps} displayMode="normal" />);

      expect(screen.getByText('task-abc')).toBeInTheDocument(); // 8 chars
      expect(screen.queryByText('task-abc123de')).not.toBeInTheDocument(); // Not 12 chars
    });

    it('should hide subtasks in auto-compact mode', () => {
      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Auto-compact should hide subtasks
      expect(screen.queryByText('Subtasks')).not.toBeInTheDocument();
      expect(screen.queryByText('Add useStdoutDimensions hook integration')).not.toBeInTheDocument();
    });
  });

  describe('Breakpoint: normal (60-119 cols)', () => {
    beforeEach(() => {
      mockHook.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: true,
      });
    });

    it('should use normal layout when displayMode=normal', () => {
      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Should show full normal layout
      expect(screen.getByText('feature-development')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();

      // Should show 12-char task ID in normal mode
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars

      // Should show subtasks
      expect(screen.getByText(/Subtasks/)).toBeInTheDocument();
    });

    it('should truncate description to available width', () => {
      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Description should be shown with appropriate truncation for width=80
      // Available width after borders/padding/margin: ~74 chars
      // Should use Math.max(50, 74) = 74 for normal breakpoint
      const description = screen.getByText(/Implement responsive TaskProgress component/);
      expect(description).toBeInTheDocument();
      expect(description.textContent!.length).toBeLessThanOrEqual(80); // Should fit in available space
    });

    it('should show 12-char task ID', () => {
      render(<TaskProgress {...baseProps} displayMode="normal" />);

      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars
      expect(screen.queryByText('task-abc')).not.toBeInTheDocument(); // Not 8 chars
    });

    it('should show limited subtasks based on height', () => {
      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Normal mode should show 2-5 subtasks based on height
      // With height=24, Math.max(2, Math.min(5, Math.floor(24/4))) = Math.max(2, Math.min(5, 6)) = 5
      expect(screen.getByText(/Subtasks/)).toBeInTheDocument();
      expect(screen.getByText('Add useStdoutDimensions hook integration')).toBeInTheDocument();
      expect(screen.getByText('Implement calculateTruncationConfig function')).toBeInTheDocument();
    });
  });

  describe('Breakpoint: wide (>=120 cols)', () => {
    beforeEach(() => {
      mockHook.mockReturnValue({
        width: 140,
        height: 30,
        breakpoint: 'wide' as const,
        isAvailable: true,
      });
    });

    it('should use full layout with generous truncation', () => {
      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Should show full layout
      expect(screen.getByText('feature-development')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();

      // Should show 12-char task ID in wide mode
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars

      // Description should have generous truncation
      // Available width: 140-6=134, capped at 120 for readability
      const description = screen.getByText(/Implement responsive TaskProgress component/);
      expect(description).toBeInTheDocument();
    });

    it('should show more subtasks in verbose mode', () => {
      render(<TaskProgress {...baseProps} displayMode="verbose" />);

      // Verbose mode with height=30: Math.max(3, Math.min(15, Math.floor(30/3))) = Math.max(3, Math.min(15, 10)) = 10
      expect(screen.getByText(/Subtasks/)).toBeInTheDocument();
      expect(screen.getByText('Add useStdoutDimensions hook integration')).toBeInTheDocument();
      expect(screen.getByText('Implement calculateTruncationConfig function')).toBeInTheDocument();
      expect(screen.getByText('Update rendering with responsive behavior')).toBeInTheDocument();
      expect(screen.getByText('Create comprehensive test suite')).toBeInTheDocument();
      expect(screen.getByText('Validate implementation across breakpoints')).toBeInTheDocument();
    });

    it('should cap description at 120 chars for readability', () => {
      const veryLongDescription = 'A'.repeat(200); // 200 character description

      render(<TaskProgress {...baseProps} description={veryLongDescription} displayMode="normal" />);

      const description = screen.getByText(/A+/);
      expect(description.textContent!.length).toBeLessThanOrEqual(123); // 120 + "..."
    });
  });

  describe('Explicit width override', () => {
    beforeEach(() => {
      mockHook.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: true,
      });
    });

    it('should use explicit width prop over terminal width', () => {
      render(<TaskProgress {...baseProps} width={60} displayMode="normal" />);

      // With explicit width=60, should use normal breakpoint from hook but width=60
      expect(screen.getByText('feature-development')).toBeInTheDocument();
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars (normal breakpoint)

      // Description truncation should be based on width=60, not 80
      const description = screen.getByText(/Implement responsive TaskProgress/);
      expect(description).toBeInTheDocument();
    });

    it('should calculate truncation based on explicit width', () => {
      // Test with very narrow explicit width that should force compact-like truncation
      render(<TaskProgress {...baseProps} width={40} displayMode="normal" />);

      // Should still show normal layout (breakpoint is 'normal' from hook)
      expect(screen.getByText('feature-development')).toBeInTheDocument();

      // But description should be heavily truncated due to width=40
      const description = screen.getByText(/Implement/);
      expect(description.textContent!.length).toBeLessThan(40); // Should be aggressively truncated
    });
  });

  describe('Dynamic content adaptation', () => {
    beforeEach(() => {
      mockHook.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: true,
      });
    });

    it('should recalculate on terminal resize', () => {
      const { rerender } = render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Initially normal layout
      expect(screen.getByText('feature-development')).toBeInTheDocument();
      expect(screen.getByText('task-abc123de')).toBeInTheDocument(); // 12 chars

      // Simulate terminal resize to narrow
      mockHook.mockReturnValue({
        width: 50,
        height: 20,
        breakpoint: 'narrow' as const,
        isAvailable: true,
      });

      rerender(<TaskProgress {...baseProps} displayMode="normal" />);

      // Should auto-switch to compact
      expect(screen.queryByText('feature-development')).not.toBeInTheDocument();
      expect(screen.getByText('task-abc')).toBeInTheDocument(); // 8 chars
    });

    it('should adjust description truncation when metrics present', () => {
      const { rerender } = render(<TaskProgress {...baseProps} displayMode="compact" />);

      // With metrics, description should be more truncated
      const withMetricsText = screen.getByText(/Implement responsive/);
      const withMetricsLength = withMetricsText.textContent!.length;

      // Remove metrics and rerender
      rerender(
        <TaskProgress
          {...baseProps}
          displayMode="compact"
          tokens={undefined}
          cost={undefined}
          agent={undefined}
        />
      );

      // Without metrics, description should have more space
      const withoutMetricsText = screen.getByText(/Implement responsive/);
      const withoutMetricsLength = withoutMetricsText.textContent!.length;

      expect(withoutMetricsLength).toBeGreaterThan(withMetricsLength);
    });

    it('should adjust description truncation when no metrics', () => {
      render(
        <TaskProgress
          {...baseProps}
          displayMode="compact"
          tokens={undefined}
          cost={undefined}
          agent={undefined}
        />
      );

      // Without any metrics, more space available for description
      const description = screen.getByText(/Implement responsive TaskProgress/);
      expect(description).toBeInTheDocument();
      expect(description.textContent!.length).toBeGreaterThan(30); // Should have reasonable length
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle missing dimensions gracefully', () => {
      mockHook.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal' as const,
        isAvailable: false,
      });

      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Should still render without errors
      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.getByText(/Implement responsive/)).toBeInTheDocument();
    });

    it('should handle very narrow terminals gracefully', () => {
      mockHook.mockReturnValue({
        width: 20,
        height: 10,
        breakpoint: 'narrow' as const,
        isAvailable: true,
      });

      render(<TaskProgress {...baseProps} displayMode="normal" />);

      // Should auto-compact and not crash
      expect(screen.getByText('task-abc')).toBeInTheDocument();

      // Description should be minimal but present
      const description = screen.getByText(/Implement/);
      expect(description).toBeInTheDocument();
      expect(description.textContent!.length).toBeGreaterThanOrEqual(18); // Math.max(15, ...)
    });

    it('should handle very wide terminals gracefully', () => {
      mockHook.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide' as const,
        isAvailable: true,
      });

      render(<TaskProgress {...baseProps} displayMode="verbose" />);

      // Should render without issues and cap description appropriately
      expect(screen.getByText('feature-development')).toBeInTheDocument();

      const description = screen.getByText(/Implement responsive TaskProgress/);
      expect(description).toBeInTheDocument();
      // Description should still be capped for readability
      expect(description.textContent!.length).toBeLessThanOrEqual(123); // 120 + "..."
    });

    it('should handle empty subtasks array', () => {
      render(<TaskProgress {...baseProps} subtasks={[]} displayMode="normal" />);

      // Should not show subtasks section
      expect(screen.queryByText('Subtasks')).not.toBeInTheDocument();
      expect(screen.getByText(/Implement responsive/)).toBeInTheDocument();
    });

    it('should handle single subtask', () => {
      const singleSubtask: SubtaskInfo[] = [{
        id: 'subtask-1',
        description: 'Single subtask item',
        status: 'completed',
      }];

      render(<TaskProgress {...baseProps} subtasks={singleSubtask} displayMode="normal" />);

      expect(screen.getByText(/Subtasks \(1\/1\)/)).toBeInTheDocument();
      expect(screen.getByText('Single subtask item')).toBeInTheDocument();
    });
  });
});