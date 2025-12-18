import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import {
  ProgressBar,
  SpinnerWithText,
  LoadingSpinner,
  TaskProgress,
  MultiTaskProgress,
  StepProgress,
} from '../ProgressIndicators';
import type { StdoutDimensions } from '../../hooks/useStdoutDimensions';

// Mock the hook to avoid real terminal dependency
const mockUseStdoutDimensions = vi.fn<[], StdoutDimensions>();
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

describe('ProgressIndicators - Responsive Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('ProgressBar Edge Cases', () => {
    it('handles extremely narrow terminals (width < 20)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 15,
        height: 10,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(<ProgressBar progress={50} responsive={true} />);

      // Should still show percentage even in extremely narrow terminals
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('respects minWidth constraint in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25,
        height: 10,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(<ProgressBar progress={75} responsive={true} minWidth={15} />);

      // Should enforce minWidth even when calculated width would be smaller
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('respects maxWidth constraint in wide terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 300,
        height: 50,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      render(<ProgressBar progress={25} responsive={true} maxWidth={50} />);

      // Should enforce maxWidth even in very wide terminals
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('handles large reservedSpace values', () => {
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

      render(<ProgressBar progress={40} responsive={true} reservedSpace={60} />);

      // Should handle cases where reservedSpace leaves minimal room
      expect(screen.getByText('40%')).toBeInTheDocument();
    });

    it('handles percentage display toggle correctly across breakpoints', () => {
      const { rerender } = render(<ProgressBar progress={60} showPercentage={false} responsive={true} />);

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

      rerender(<ProgressBar progress={60} showPercentage={false} responsive={true} />);

      // Should not show percentage when disabled
      expect(screen.queryByText('60%')).not.toBeInTheDocument();
    });

    it('handles zero-width scenarios gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 10, // Very small
        height: 5,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(<ProgressBar progress={50} responsive={true} showPercentage={true} />);

      // Should still render something meaningful
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('handles breakpoint transitions consistently', () => {
      const { rerender } = render(<ProgressBar progress={30} responsive={true} />);

      // Start in narrow mode
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 20,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      rerender(<ProgressBar progress={30} responsive={true} />);
      expect(screen.getByText('30%')).toBeInTheDocument();

      // Transition to compact
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 20,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      rerender(<ProgressBar progress={30} responsive={true} />);
      expect(screen.getByText('30%')).toBeInTheDocument();
    });
  });

  describe('SpinnerWithText Edge Cases', () => {
    it('handles extremely long text in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20,
        height: 5,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const veryLongText = 'This is an extremely long text that should definitely be truncated in a narrow terminal window';

      render(<SpinnerWithText text={veryLongText} responsive={true} />);

      // Should truncate to fit available space
      expect(screen.queryByText(veryLongText)).not.toBeInTheDocument();
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('respects minTextLength when truncating', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 10, // Very narrow
        height: 5,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <SpinnerWithText
          text="Short text"
          responsive={true}
          minTextLength={5}
        />
      );

      // Should respect minimum length constraint
      const textElement = screen.getByText(/\S/);
      expect(textElement).toBeInTheDocument();
    });

    it('uses abbreviatedText over truncation when provided', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30,
        height: 5,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <SpinnerWithText
          text="Processing very important operation with detailed status"
          abbreviatedText="Processing"
          responsive={true}
        />
      );

      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.queryByText(/very important operation/)).not.toBeInTheDocument();
    });

    it('handles empty or null text gracefully', () => {
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

      const { rerender } = render(<SpinnerWithText text="" responsive={true} />);

      // Should handle empty text
      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();

      // Should handle undefined text
      rerender(<SpinnerWithText text={undefined} responsive={true} />);
      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
    });

    it('handles custom maxTextLength across breakpoints', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      render(
        <SpinnerWithText
          text="This text should be truncated at custom length"
          responsive={true}
          maxTextLength={15}
        />
      );

      // Should respect custom maxTextLength over breakpoint defaults
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('preserves text when disabled responsive mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 15, // Very narrow
        height: 5,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const fullText = 'This text should not be truncated when responsive is disabled';

      render(<SpinnerWithText text={fullText} responsive={false} />);

      expect(screen.getByText(fullText)).toBeInTheDocument();
      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
    });
  });

  describe('LoadingSpinner Edge Cases', () => {
    it('defaults to non-responsive behavior for backward compatibility', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20, // Very narrow
        height: 5,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const longText = 'This is a long text that should not be truncated by default';

      render(<LoadingSpinner text={longText} />);

      // Should preserve full text when responsive is not enabled (default)
      expect(screen.getByText(longText)).toBeInTheDocument();
      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
    });

    it('enables responsive behavior when explicitly requested', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25,
        height: 5,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const longText = 'This is a long text that should be truncated when responsive is enabled';

      render(<LoadingSpinner text={longText} responsive={true} />);

      // Should use SpinnerWithText internally and truncate
      expect(screen.queryByText(longText)).not.toBeInTheDocument();
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });
  });

  describe('Container Component Integration', () => {
    it('TaskProgress uses responsive ProgressBar in normal mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 20,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <TaskProgress
          taskName="Test Task"
          progress={65}
          status="in-progress"
          showSpinner={true}
        />
      );

      // Should show progress percentage
      expect(screen.getByText('65%')).toBeInTheDocument();
    });

    it('MultiTaskProgress adapts ProgressBar width appropriately', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 15,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const tasks = [
        { id: '1', name: 'Task 1', status: 'completed' as const, progress: 100 },
        { id: '2', name: 'Task 2', status: 'in-progress' as const, progress: 45 },
      ];

      render(<MultiTaskProgress tasks={tasks} compact={false} />);

      // Should show overall progress adapting to narrow width
      expect(screen.getByText('50%')).toBeInTheDocument(); // (1 completed / 2 total) * 100
    });

    it('StepProgress shows responsive LoadingSpinner in in-progress steps', () => {
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

      const steps = [
        { name: 'Planning', status: 'completed' as const },
        { name: 'Development with very long description', status: 'in-progress' as const },
        { name: 'Testing', status: 'pending' as const },
      ];

      render(<StepProgress steps={steps} compact={false} />);

      // Should show steps with responsive spinner
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText(/Development/)).toBeInTheDocument();
    });
  });

  describe('Boundary Conditions', () => {
    it('handles terminal dimension unavailability', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // Fallback value
        height: 24, // Fallback value
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: false, // Indicates fallback values
      });

      render(<ProgressBar progress={50} responsive={true} />);

      // Should still work with fallback dimensions
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('handles rapid terminal size changes', () => {
      const { rerender } = render(<ProgressBar progress={30} responsive={true} />);

      // Simulate rapid size changes
      const sizes = [
        { width: 50, breakpoint: 'narrow' as const },
        { width: 80, breakpoint: 'compact' as const },
        { width: 120, breakpoint: 'normal' as const },
        { width: 200, breakpoint: 'wide' as const },
        { width: 40, breakpoint: 'narrow' as const },
      ];

      sizes.forEach(({ width, breakpoint }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          breakpoint,
          isNarrow: breakpoint === 'narrow',
          isCompact: breakpoint === 'compact',
          isNormal: breakpoint === 'normal',
          isWide: breakpoint === 'wide',
          isAvailable: true,
        });

        rerender(<ProgressBar progress={30} responsive={true} />);
        expect(screen.getByText('30%')).toBeInTheDocument();
      });
    });

    it('handles min/max width edge case where minWidth > maxWidth', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      // Test invalid configuration where minWidth > maxWidth
      render(<ProgressBar progress={50} responsive={true} minWidth={60} maxWidth={40} />);

      // Should handle gracefully without crashing
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('handles text truncation with Unicode characters', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 25,
        height: 5,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const unicodeText = 'Processing 📊 データ処理中... 🚀 Loading αβγδε';

      render(<SpinnerWithText text={unicodeText} responsive={true} />);

      // Should handle Unicode characters in truncation
      expect(screen.queryByText(unicodeText)).not.toBeInTheDocument();
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('handles very large terminal widths efficiently', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 500, // Very wide terminal
        height: 100,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      render(<ProgressBar progress={25} responsive={true} />);

      // Should handle very large widths without performance issues
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('preserves animation behavior across responsive changes', () => {
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

      const { rerender } = render(<ProgressBar progress={0} animated responsive={true} />);

      // Change progress with animation
      rerender(<ProgressBar progress={50} animated responsive={true} />);

      // Change terminal size during animation
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      rerender(<ProgressBar progress={50} animated responsive={true} />);

      // Animation should continue working
      vi.advanceTimersByTime(100);
      expect(screen.getByText(/[0-9]+%/)).toBeInTheDocument();
    });
  });

  describe('Performance and Memory', () => {
    it('does not create memory leaks with frequent responsive updates', () => {
      const { rerender, unmount } = render(<ProgressBar progress={10} responsive={true} />);

      // Simulate many updates
      for (let i = 0; i < 100; i++) {
        mockUseStdoutDimensions.mockReturnValue({
          width: 50 + (i % 50), // Varying width
          height: 24,
          breakpoint: i % 2 === 0 ? 'compact' : 'normal',
          isNarrow: false,
          isCompact: i % 2 === 0,
          isNormal: i % 2 !== 0,
          isWide: false,
          isAvailable: true,
        });

        rerender(<ProgressBar progress={10 + i} responsive={true} />);
      }

      // Should unmount cleanly without errors
      expect(() => unmount()).not.toThrow();
    });

    it('handles concurrent responsive component instances', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 20,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <div>
          <ProgressBar progress={25} responsive={true} />
          <ProgressBar progress={50} responsive={true} />
          <ProgressBar progress={75} responsive={true} />
          <SpinnerWithText text="Loading..." responsive={true} />
          <SpinnerWithText text="Processing..." responsive={true} />
        </div>
      );

      // All components should render correctly
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });
});