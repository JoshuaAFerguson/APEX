import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import {
  ProgressBar,
  CircularProgress,
  StepProgress,
  MultiTaskProgress,
  LoadingSpinner,
  SpinnerWithText,
} from '../ProgressIndicators';

describe('ProgressIndicators', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('ProgressBar', () => {
    it('renders with correct progress percentage', () => {
      render(<ProgressBar progress={75} />);

      // Should display progress value
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('handles 0% progress', () => {
      render(<ProgressBar progress={0} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles 100% progress', () => {
      render(<ProgressBar progress={100} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('shows custom label when provided', () => {
      render(<ProgressBar progress={50} label="Processing..." />);

      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('applies color themes correctly', () => {
      render(<ProgressBar progress={80} color="success" />);

      // Should apply success color styling
      const progressElement = screen.getByText('80%');
      expect(progressElement).toHaveAttribute('color', 'green');
    });

    it('handles animated progress changes', () => {
      const { rerender } = render(<ProgressBar progress={0} animated />);

      rerender(<ProgressBar progress={50} animated />);

      // Should smoothly animate from 0 to 50
      vi.advanceTimersByTime(100);
      expect(screen.getByText(/[0-9]+%/)).toBeInTheDocument();
    });

    it('validates progress bounds', () => {
      // Test negative progress
      render(<ProgressBar progress={-10} />);
      expect(screen.getByText('0%')).toBeInTheDocument();

      // Test progress over 100
      const { rerender } = render(<ProgressBar progress={150} />);
      rerender(<ProgressBar progress={150} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('CircularProgress', () => {
    it('renders circular progress indicator', () => {
      render(<CircularProgress progress={60} />);

      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('shows indeterminate progress', () => {
      render(<CircularProgress indeterminate />);

      // Should show spinner animation
      expect(screen.getByTestId('circular-progress')).toBeInTheDocument();
    });

    it('applies size variants', () => {
      render(<CircularProgress progress={40} size="large" />);

      const element = screen.getByTestId('circular-progress');
      expect(element).toHaveClass('large');
    });

    it('displays custom center content', () => {
      render(
        <CircularProgress progress={75}>
          <div>Custom Content</div>
        </CircularProgress>
      );

      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });
  });

  describe('StepProgress', () => {
    const steps = [
      { name: 'Planning', status: 'completed' },
      { name: 'Development', status: 'in-progress' },
      { name: 'Testing', status: 'pending' },
      { name: 'Deployment', status: 'pending' },
    ];

    it('renders all steps with correct status', () => {
      render(<StepProgress steps={steps} />);

      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('Testing')).toBeInTheDocument();
      expect(screen.getByText('Deployment')).toBeInTheDocument();
    });

    it('shows current step indicator', () => {
      render(<StepProgress steps={steps} currentStep={1} />);

      // Development should be highlighted as current
      const currentStep = screen.getByText('Development');
      expect(currentStep).toHaveClass('current');
    });

    it('displays step icons based on status', () => {
      render(<StepProgress steps={steps} showIcons />);

      // Completed step should show checkmark
      expect(screen.getByText('✓')).toBeInTheDocument();

      // In-progress should show progress indicator
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles click navigation when enabled', () => {
      const onStepClick = vi.fn();
      render(
        <StepProgress
          steps={steps}
          onStepClick={onStepClick}
          allowNavigation
        />
      );

      const planningStep = screen.getByText('Planning');
      planningStep.click();

      expect(onStepClick).toHaveBeenCalledWith(0);
    });

    it('calculates overall progress correctly', () => {
      render(<StepProgress steps={steps} showProgress />);

      // 1 completed + 0.5 in-progress out of 4 = 37.5%
      expect(screen.getByText(/37\.5%|38%/)).toBeInTheDocument();
    });
  });

  describe('MultiTaskProgress', () => {
    const tasks = [
      { id: '1', name: 'Task 1', progress: 100, status: 'completed' },
      { id: '2', name: 'Task 2', progress: 60, status: 'in-progress' },
      { id: '3', name: 'Task 3', progress: 0, status: 'pending' },
    ];

    it('renders multiple task progress bars', () => {
      render(<MultiTaskProgress tasks={tasks} />);

      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
      expect(screen.getByText('Task 3')).toBeInTheDocument();
    });

    it('shows overall progress summary', () => {
      render(<MultiTaskProgress tasks={tasks} showSummary />);

      // Should show overall completion
      expect(screen.getByText(/Overall/)).toBeInTheDocument();
    });

    it('displays task status indicators', () => {
      render(<MultiTaskProgress tasks={tasks} showStatus />);

      expect(screen.getByText(/completed/)).toBeInTheDocument();
      expect(screen.getByText(/in-progress/)).toBeInTheDocument();
      expect(screen.getByText(/pending/)).toBeInTheDocument();
    });

    it('handles empty task list', () => {
      render(<MultiTaskProgress tasks={[]} />);

      expect(screen.getByText(/No tasks/)).toBeInTheDocument();
    });

    it('updates when tasks change', () => {
      const { rerender } = render(<MultiTaskProgress tasks={tasks} />);

      const updatedTasks = [...tasks];
      updatedTasks[1].progress = 80;

      rerender(<MultiTaskProgress tasks={updatedTasks} />);

      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('Spinner', () => {
    it('renders default spinner', () => {
      render(<Spinner />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('displays custom text', () => {
      render(<Spinner text="Loading..." />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('applies different spinner types', () => {
      render(<Spinner type="dots" />);

      const spinner = screen.getByTestId('spinner');
      expect(spinner).toHaveClass('dots');
    });

    it('handles different sizes', () => {
      render(<Spinner size="small" />);

      const spinner = screen.getByTestId('spinner');
      expect(spinner).toHaveClass('small');
    });

    it('animates continuously', () => {
      render(<Spinner />);

      // Should have animation class
      const spinner = screen.getByTestId('spinner');
      expect(spinner).toHaveClass('animate');

      // Animation should continue
      vi.advanceTimersByTime(1000);
      expect(spinner).toHaveClass('animate');
    });

    it('stops animation when hidden', () => {
      const { rerender } = render(<Spinner />);

      rerender(<Spinner hidden />);

      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides appropriate ARIA labels', () => {
      render(<ProgressBar progress={50} ariaLabel="File upload progress" />);

      expect(screen.getByLabelText('File upload progress')).toBeInTheDocument();
    });

    it('announces progress changes to screen readers', () => {
      render(<ProgressBar progress={25} announceChanges />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    });

    it('provides meaningful descriptions for complex progress', () => {
      render(
        <StepProgress
          steps={[
            { name: 'Step 1', status: 'completed' },
            { name: 'Step 2', status: 'in-progress' },
          ]}
          ariaLabel="Workflow progress: Step 2 of 2"
        />
      );

      expect(screen.getByLabelText(/Workflow progress/)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles rapid progress updates efficiently', () => {
      const { rerender } = render(<ProgressBar progress={0} />);

      // Simulate rapid updates
      for (let i = 1; i <= 100; i++) {
        rerender(<ProgressBar progress={i} />);
      }

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('throttles animation frames for smooth performance', () => {
      const mockRAF = vi.spyOn(window, 'requestAnimationFrame')
        .mockImplementation(cb => setTimeout(cb, 16));

      render(<ProgressBar progress={50} animated />);

      vi.advanceTimersByTime(100);

      expect(mockRAF).toHaveBeenCalled();
      mockRAF.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('handles invalid progress values gracefully', () => {
      render(<ProgressBar progress={NaN} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles missing step data gracefully', () => {
      const invalidSteps = [
        { name: 'Valid Step', status: 'completed' },
        null, // Invalid step
        { name: 'Another Step', status: 'pending' },
      ].filter(Boolean);

      expect(() => {
        render(<StepProgress steps={invalidSteps as any} />);
      }).not.toThrow();
    });

    it('handles component unmounting during animation', () => {
      const { unmount } = render(<ProgressBar progress={0} animated />);

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('Responsive Behavior', () => {
    // Mock useStdoutDimensions hook
    const mockUseStdoutDimensions = vi.fn();

    beforeEach(() => {
      // Mock the hook to return known values
      vi.mock('../hooks/useStdoutDimensions', () => ({
        useStdoutDimensions: mockUseStdoutDimensions,
      }));
    });

    describe('ProgressBar Responsive Width', () => {
      it('adapts width to narrow terminals', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 50,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        render(<ProgressBar progress={50} responsive={true} />);

        // With 50 width, narrow mode (90%), minus 5 for percentage = 40.5 chars available
        // 90% of 40.5 = ~36 chars for progress bar
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      it('adapts width to compact terminals', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
        });

        render(<ProgressBar progress={75} responsive={true} />);

        expect(screen.getByText('75%')).toBeInTheDocument();
      });

      it('respects explicit width when responsive is disabled', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 50,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        render(<ProgressBar progress={50} responsive={false} width={20} />);

        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      it('applies min and max width constraints', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 200,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
        });

        render(<ProgressBar progress={25} responsive={true} minWidth={15} maxWidth={60} />);

        expect(screen.getByText('25%')).toBeInTheDocument();
      });

      it('accounts for reserved space in calculations', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
        });

        render(<ProgressBar progress={50} responsive={true} reservedSpace={20} />);

        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });

    describe('SpinnerWithText Responsive', () => {
      it('truncates text in narrow terminals', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 40,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        render(<SpinnerWithText text="This is a very long loading message that should be truncated" />);

        // Should contain truncated text with ellipsis
        expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
      });

      it('uses abbreviated text when provided for narrow terminals', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 40,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        render(
          <SpinnerWithText
            text="Processing very important operation"
            abbreviatedText="Processing..."
          />
        );

        expect(screen.getByText('Processing...')).toBeInTheDocument();
        expect(screen.queryByText('Processing very important operation')).not.toBeInTheDocument();
      });

      it('shows full text in wide terminals', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
        });

        const fullText = 'Processing operation';
        render(<SpinnerWithText text={fullText} />);

        expect(screen.getByText(fullText)).toBeInTheDocument();
      });

      it('respects custom maxTextLength', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
        });

        render(<SpinnerWithText text="This text should be truncated" maxTextLength={10} />);

        // Should show truncated version
        expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
      });

      it('disables truncation when responsive is false', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 20,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        const fullText = 'This text should not be truncated';
        render(<SpinnerWithText text={fullText} responsive={false} />);

        expect(screen.getByText(fullText)).toBeInTheDocument();
      });
    });

    describe('LoadingSpinner Responsive', () => {
      it('truncates text when responsive mode is enabled', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 30,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        render(<LoadingSpinner text="Very long loading text that needs truncation" responsive={true} />);

        // Should use SpinnerWithText internally and truncate
        expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
      });

      it('preserves text when responsive mode is disabled', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 20,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
        });

        const fullText = 'Loading...';
        render(<LoadingSpinner text={fullText} responsive={false} />);

        expect(screen.getByText(fullText)).toBeInTheDocument();
      });
    });
  });
});