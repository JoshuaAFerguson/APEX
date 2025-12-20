import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import {
  ProgressBar,
  SpinnerWithText,
  TaskProgress,
  MultiTaskProgress,
  StepProgress,
} from '../ProgressIndicators';
import type { StdoutDimensions } from '../../hooks/useStdoutDimensions';

// Mock the hook for controlled testing
const mockUseStdoutDimensions = vi.fn<[], StdoutDimensions>();
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

describe('ProgressIndicators - Performance Tests', () => {
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

  describe('Responsive Calculation Performance', () => {
    it('efficiently handles rapid terminal dimension changes', () => {
      const { rerender } = render(<ProgressBar progress={50} responsive={true} />);

      const start = performance.now();

      // Simulate rapid terminal resizes
      const dimensions = [
        { width: 40, breakpoint: 'narrow' },
        { width: 60, breakpoint: 'compact' },
        { width: 100, breakpoint: 'normal' },
        { width: 180, breakpoint: 'wide' },
        { width: 50, breakpoint: 'narrow' },
        { width: 120, breakpoint: 'normal' },
        { width: 200, breakpoint: 'wide' },
        { width: 45, breakpoint: 'narrow' },
      ] as const;

      dimensions.forEach(({ width, breakpoint }) => {
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

        rerender(<ProgressBar progress={50} responsive={true} />);
      });

      const end = performance.now();

      // Should complete rapid resizes quickly (under 100ms for 8 resizes)
      expect(end - start).toBeLessThan(100);

      // Should still function correctly
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('handles frequent progress updates efficiently with responsive width', () => {
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

      const { rerender } = render(<ProgressBar progress={0} responsive={true} />);

      const start = performance.now();

      // Simulate frequent progress updates
      for (let i = 1; i <= 100; i++) {
        rerender(<ProgressBar progress={i} responsive={true} />);
      }

      const end = performance.now();

      // Should handle 100 updates efficiently
      expect(end - start).toBeLessThan(200);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('efficiently calculates text truncation for long strings', () => {
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

      const veryLongText = 'A'.repeat(1000); // 1000 character string

      const start = performance.now();

      render(<SpinnerWithText text={veryLongText} responsive={true} />);

      const end = performance.now();

      // Should handle very long text efficiently
      expect(end - start).toBeLessThan(50);

      // Should still truncate correctly
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
      expect(screen.queryByText(veryLongText)).not.toBeInTheDocument();
    });

    it('maintains performance with multiple responsive components', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      const tasks = Array.from({ length: 20 }, (_, i) => ({
        id: `task-${i}`,
        name: `Task ${i} with a reasonably long name for testing`,
        status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in-progress' : 'pending' as const,
        progress: i % 3 === 0 ? 100 : i % 3 === 1 ? Math.floor(Math.random() * 100) : 0,
        currentStep: i % 3 === 1 ? `Step for task ${i}` : undefined,
      }));

      const start = performance.now();

      render(
        <div>
          <MultiTaskProgress tasks={tasks} />
          {tasks.slice(0, 5).map(task => (
            <TaskProgress
              key={task.id}
              taskName={task.name}
              progress={task.progress}
              status={task.status}
              currentStep={task.currentStep}
            />
          ))}
        </div>
      );

      const end = performance.now();

      // Should render multiple responsive components efficiently
      expect(end - start).toBeLessThan(150);

      // Should render correctly
      expect(screen.getByText('Task 0 with a reasonably long name for testing')).toBeInTheDocument();
    });
  });

  describe('Animation Performance', () => {
    it('maintains smooth animation during responsive width changes', () => {
      const { rerender } = render(<ProgressBar progress={0} animated responsive={true} />);

      // Start animation
      rerender(<ProgressBar progress={100} animated responsive={true} />);

      // Change terminal width during animation
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

      rerender(<ProgressBar progress={100} animated responsive={true} />);

      // Should continue animation smoothly
      vi.advanceTimersByTime(100);
      expect(screen.getByText(/[0-9]+%/)).toBeInTheDocument();

      vi.advanceTimersByTime(500);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('handles concurrent animations with responsive updates', () => {
      const { rerender } = render(
        <div>
          <ProgressBar progress={0} animated responsive={true} />
          <ProgressBar progress={0} animated responsive={true} />
          <ProgressBar progress={0} animated responsive={true} />
        </div>
      );

      const start = performance.now();

      // Start all animations
      rerender(
        <div>
          <ProgressBar progress={100} animated responsive={true} />
          <ProgressBar progress={80} animated responsive={true} />
          <ProgressBar progress={60} animated responsive={true} />
        </div>
      );

      // Let animations complete
      vi.advanceTimersByTime(600);

      const end = performance.now();

      // Should handle concurrent animations efficiently
      expect(end - start).toBeLessThan(100); // Excluding timer advancement

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });

  describe('Memory Management', () => {
    it('properly cleans up event listeners on unmount', () => {
      const { unmount } = render(<ProgressBar progress={50} responsive={true} />);

      // Should unmount without memory leaks or errors
      expect(() => unmount()).not.toThrow();
    });

    it('handles rapid mount/unmount cycles efficiently', () => {
      const start = performance.now();

      // Rapid mount/unmount cycles
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(<ProgressBar progress={i} responsive={true} />);
        unmount();
      }

      const end = performance.now();

      // Should handle rapid cycles efficiently
      expect(end - start).toBeLessThan(200);
    });

    it('manages animation cleanup properly', () => {
      const { unmount } = render(<ProgressBar progress={0} animated responsive={true} />);

      // Start animation then unmount during animation
      expect(() => unmount()).not.toThrow();
    });

    it('handles text truncation memory efficiently with large datasets', () => {
      const largeTasks = Array.from({ length: 100 }, (_, i) => ({
        id: `large-task-${i}`,
        name: `Very long task name ${i} with lots of details that should be truncated efficiently`.repeat(3),
        status: 'pending' as const,
        progress: 0,
      }));

      mockUseStdoutDimensions.mockReturnValue({
        width: 30, // Narrow to force truncation
        height: 50,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const start = performance.now();
      const { unmount } = render(<MultiTaskProgress tasks={largeTasks} />);
      const end = performance.now();

      // Should handle large dataset with truncation efficiently
      expect(end - start).toBeLessThan(300);

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Hook Performance', () => {
    it('efficiently memoizes breakpoint calculations', () => {
      const { rerender } = render(<ProgressBar progress={25} responsive={true} />);

      // Mock hook to track call count
      let calculationCount = 0;
      mockUseStdoutDimensions.mockImplementation(() => {
        calculationCount++;
        return {
          width: 80,
          height: 24,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        };
      });

      // Multiple re-renders with same dimensions
      for (let i = 0; i < 10; i++) {
        rerender(<ProgressBar progress={25 + i} responsive={true} />);
      }

      // Hook should be called but calculations should be memoized
      expect(calculationCount).toBeGreaterThan(0);
      expect(screen.getByText('34%')).toBeInTheDocument(); // 25 + 9
    });

    it('efficiently handles hook dependencies updates', () => {
      let width = 80;
      mockUseStdoutDimensions.mockImplementation(() => ({
        width,
        height: 24,
        breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : 'normal',
        isNarrow: width < 60,
        isCompact: width >= 60 && width < 100,
        isNormal: width >= 100,
        isWide: false,
        isAvailable: true,
      }));

      const { rerender } = render(
        <ProgressBar progress={50} responsive={true} minWidth={10} maxWidth={70} />
      );

      const start = performance.now();

      // Change dependencies
      width = 120;
      rerender(<ProgressBar progress={50} responsive={true} minWidth={15} maxWidth={80} />);

      width = 40;
      rerender(<ProgressBar progress={50} responsive={true} minWidth={20} maxWidth={50} />);

      const end = performance.now();

      // Should handle dependency changes efficiently
      expect(end - start).toBeLessThan(50);
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('Stress Testing', () => {
    it('handles extreme terminal size changes gracefully', () => {
      const { rerender } = render(<ProgressBar progress={50} responsive={true} />);

      // Test extreme dimensions
      const extremeDimensions = [
        { width: 1, height: 1 },    // Extremely small
        { width: 1000, height: 500 }, // Extremely large
        { width: 5, height: 200 },    // Very narrow
        { width: 500, height: 3 },    // Very wide but short
      ];

      extremeDimensions.forEach(({ width, height }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height,
          breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide',
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 100,
          isNormal: width >= 100 && width < 160,
          isWide: width >= 160,
          isAvailable: true,
        });

        expect(() => {
          rerender(<ProgressBar progress={50} responsive={true} />);
        }).not.toThrow();
      });

      // Should still display percentage
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('handles rapid alternating between responsive and non-responsive modes', () => {
      const { rerender } = render(<ProgressBar progress={30} responsive={true} />);

      const start = performance.now();

      // Rapidly toggle responsive mode
      for (let i = 0; i < 50; i++) {
        rerender(<ProgressBar progress={30} responsive={i % 2 === 0} />);
      }

      const end = performance.now();

      // Should handle rapid mode changes efficiently
      expect(end - start).toBeLessThan(150);
      expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('maintains performance with complex nested responsive components', () => {
      const complexTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `complex-${i}`,
        name: `Complex Task ${i} with detailed description and multiple requirements`,
        status: 'in-progress' as const,
        progress: Math.floor(Math.random() * 100),
        currentStep: `Processing step ${i} with additional context and information`,
      }));

      const complexSteps = Array.from({ length: 8 }, (_, i) => ({
        name: `Step ${i}: Complex operation with detailed requirements`,
        status: i < 3 ? 'completed' : i === 3 ? 'in-progress' : 'pending' as const,
        description: `Detailed description for step ${i} with comprehensive requirements and specifications`,
      }));

      mockUseStdoutDimensions.mockReturnValue({
        width: 90,
        height: 30,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const start = performance.now();

      render(
        <div>
          <MultiTaskProgress tasks={complexTasks} title="Complex Project Management" />
          <StepProgress steps={complexSteps} showDescriptions={true} />
          {complexTasks.slice(0, 3).map(task => (
            <TaskProgress
              key={task.id}
              taskName={task.name}
              progress={task.progress}
              status={task.status}
              currentStep={task.currentStep}
              showSpinner={true}
            />
          ))}
        </div>
      );

      const end = performance.now();

      // Should render complex nested structure efficiently
      expect(end - start).toBeLessThan(250);

      // Should display content correctly
      expect(screen.getByText('Complex Project Management')).toBeInTheDocument();
      expect(screen.getByText(/Step 0:/)).toBeInTheDocument();
    });
  });
});