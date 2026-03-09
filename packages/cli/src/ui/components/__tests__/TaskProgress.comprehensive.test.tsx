import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../__tests__/test-utils';
import { TaskProgress } from '../ProgressIndicators';
import type { StdoutDimensions } from '../../hooks/useStdoutDimensions';

// Mock the hook for controlled testing
const mockUseStdoutDimensions = vi.fn<[], StdoutDimensions>();
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

describe('TaskProgress - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set default dimensions
    mockUseStdoutDimensions.mockReturnValue({
      width: 80,
      height: 24,
      breakpoint: 'normal',
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
      isAvailable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Basic TaskProgress Functionality', () => {
    it('renders task with all status types', () => {
      const statuses = ['pending', 'in-progress', 'completed', 'failed'] as const;

      statuses.forEach(status => {
        const { unmount } = render(
          <TaskProgress
            taskName={`Test Task - ${status}`}
            status={status}
          />
        );

        expect(screen.getByText(`Test Task - ${status}`)).toBeInTheDocument();

        // Check status display
        switch (status) {
          case 'completed':
            expect(screen.getByText('Completed')).toBeInTheDocument();
            expect(screen.getByText('✅')).toBeInTheDocument();
            break;
          case 'failed':
            expect(screen.getByText('Failed')).toBeInTheDocument();
            expect(screen.getByText('❌')).toBeInTheDocument();
            break;
          case 'in-progress':
            expect(screen.getByText('In Progress')).toBeInTheDocument();
            expect(screen.getByText('🔄')).toBeInTheDocument();
            break;
          case 'pending':
            expect(screen.getByText('Pending')).toBeInTheDocument();
            expect(screen.getByText('⏳')).toBeInTheDocument();
            break;
        }

        unmount();
      });
    });

    it('renders current step for in-progress tasks', () => {
      render(
        <TaskProgress
          taskName="Processing Task"
          currentStep="Validating inputs"
          status="in-progress"
          showSpinner={true}
        />
      );

      expect(screen.getByText('Processing Task')).toBeInTheDocument();
      expect(screen.getByText('Validating inputs')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('does not show current step for non-in-progress tasks', () => {
      render(
        <TaskProgress
          taskName="Completed Task"
          currentStep="Should not show"
          status="completed"
        />
      );

      expect(screen.getByText('Completed Task')).toBeInTheDocument();
      expect(screen.queryByText('Should not show')).not.toBeInTheDocument();
    });

    it('renders time information when provided', () => {
      render(
        <TaskProgress
          taskName="Timed Task"
          status="in-progress"
          estimatedTime="5 minutes"
          elapsed="2 minutes"
        />
      );

      expect(screen.getByText('Elapsed: 2 minutes')).toBeInTheDocument();
      expect(screen.getByText('ETA: 5 minutes')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Animation', () => {
    it('renders progress bar for in-progress tasks with animation', async () => {
      render(
        <TaskProgress
          taskName="Animation Task"
          progress={75}
          status="in-progress"
        />
      );

      // Initially, animated progress bar starts at 0
      expect(screen.getByText('0%')).toBeInTheDocument();

      // Advance timers to complete the animation (500ms duration + buffer)
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // After animation, should show target progress
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('does not render progress bar for non-in-progress tasks', () => {
      render(
        <TaskProgress
          taskName="Completed Task"
          progress={100}
          status="completed"
        />
      );

      // Should not show progress percentage for completed tasks
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });

    it('handles progress bar without progress value', () => {
      render(
        <TaskProgress
          taskName="No Progress Task"
          status="in-progress"
        />
      );

      // Should not show progress bar when progress is undefined
      expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    });
  });

  describe('Spinner Behavior', () => {
    it('shows spinner for in-progress tasks when enabled', () => {
      render(
        <TaskProgress
          taskName="Spinner Task"
          currentStep="Processing"
          status="in-progress"
          showSpinner={true}
        />
      );

      // Should show spinner (braille character from ink-spinner)
      expect(screen.getByText(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/)).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });

    it('hides spinner when showSpinner is false', () => {
      render(
        <TaskProgress
          taskName="No Spinner Task"
          currentStep="Processing"
          status="in-progress"
          showSpinner={false}
        />
      );

      // Should not show spinner
      expect(screen.queryByText(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/)).not.toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to narrow terminals', async () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 10,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <TaskProgress
          taskName="Narrow Task"
          currentStep="Processing data"
          progress={50}
          status="in-progress"
          showSpinner={true}
        />
      );

      // Should show task name
      expect(screen.getByText('Narrow Task')).toBeInTheDocument();

      // Progress bar should adapt to narrow width
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('provides reserved space for progress bar calculations', async () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 20,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      render(
        <TaskProgress
          taskName="Reserved Space Task"
          progress={60}
          status="in-progress"
        />
      );

      // Progress bar should account for border and padding (reservedSpace: 6)
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText('60%')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles extremely long task names', () => {
      const longTaskName = 'Very Long Task Name That Exceeds Normal Terminal Width And Should Be Handled Gracefully';

      render(
        <TaskProgress
          taskName={longTaskName}
          status="in-progress"
        />
      );

      expect(screen.getByText(longTaskName)).toBeInTheDocument();
    });

    it('handles progress values at boundaries', async () => {
      const { rerender } = render(
        <TaskProgress
          taskName="Boundary Task"
          progress={0}
          status="in-progress"
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
      });

      rerender(
        <TaskProgress
          taskName="Boundary Task"
          progress={100}
          status="in-progress"
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });

    it('handles status transitions', async () => {
      const { rerender } = render(
        <TaskProgress
          taskName="Transition Task"
          progress={50}
          status="in-progress"
        />
      );

      // Should show in-progress state with progress
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      // Transition to completed
      rerender(
        <TaskProgress
          taskName="Transition Task"
          progress={100}
          status="completed"
        />
      );

      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.queryByText('100%')).not.toBeInTheDocument(); // No progress bar for completed
    });
  });

  describe('Component Cleanup', () => {
    it('handles unmounting during progress animation', async () => {
      const { unmount } = render(
        <TaskProgress
          taskName="Cleanup Task"
          progress={75}
          status="in-progress"
        />
      );

      // Start animation
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Unmount during animation
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('provides appropriate task status information', () => {
      render(
        <TaskProgress
          taskName="Accessible Task"
          currentStep="Validating data"
          progress={33}
          status="in-progress"
          estimatedTime="3 minutes"
          elapsed="1 minute"
        />
      );

      // All important information should be accessible
      expect(screen.getByText('Accessible Task')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Validating data')).toBeInTheDocument();
      expect(screen.getByText('Elapsed: 1 minute')).toBeInTheDocument();
      expect(screen.getByText('ETA: 3 minutes')).toBeInTheDocument();
    });
  });
});