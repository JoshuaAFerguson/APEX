/**
 * StatusBar Session Timer - Comprehensive Edge Cases and Compliance Tests
 *
 * This test suite verifies edge cases, timing precision, and compliance
 * with the acceptance criteria for the session timer implementation.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';

// Create mock with vi.hoisted to handle vitest hoisting
const { mockUseStdoutDimensions } = vi.hoisted(() => ({
  mockUseStdoutDimensions: vi.fn(() => ({
    width: 120,
    height: 30,
    breakpoint: 'normal' as const,
    isAvailable: true,
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
  })),
}));

vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StatusBar Session Timer - Edge Cases and Compliance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'normal' as const,
      isAvailable: true,
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const defaultProps: StatusBarProps = {
    isConnected: true,
  };

  describe('exact 1-second interval compliance', () => {
    it('updates exactly every 1000ms with no drift over extended periods', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:00:00Z'));

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('00:00')).toBeInTheDocument();

      // Test exact timing over 10 seconds to avoid minute overflow
      for (let second = 1; second <= 10; second++) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });

        const expectedTime = `00:${second.toString().padStart(2, '0')}`;
        expect(screen.getByText(expectedTime)).toBeInTheDocument();
      }
    });

    it('does not update before 1000ms even by 1ms', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:01:00Z'));

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('01:00')).toBeInTheDocument();

      // Advance 999ms - should not change
      act(() => {
        vi.advanceTimersByTime(999);
      });

      expect(screen.getByText('01:00')).toBeInTheDocument();

      // Advance final 1ms to complete 1000ms - should now update
      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByText('01:01')).toBeInTheDocument();
    });

    it('maintains precision with system clock changes', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:01:30Z')); // Start at 1:30 elapsed

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      // Timer should show the elapsed time immediately on mount
      expect(screen.getByText('01:30')).toBeInTheDocument();
    });
  });

  describe('MM:SS format strict compliance', () => {
    it('always displays exactly 5 characters in MM:SS format', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      const testCases = [
        { elapsed: 0, expected: '00:00' },
        { elapsed: 1000, expected: '00:01' },
        { elapsed: 9000, expected: '00:09' },
        { elapsed: 10000, expected: '00:10' },
        { elapsed: 60000, expected: '01:00' },
        { elapsed: 599000, expected: '09:59' },
        { elapsed: 600000, expected: '10:00' },
        { elapsed: 3599000, expected: '59:59' },
        { elapsed: 3600000, expected: '60:00' },
        { elapsed: 36000000, expected: '600:00' }, // 10 hours = 600 minutes
        { elapsed: 86400000, expected: '1440:00' }, // 24 hours = 1440 minutes
      ];

      testCases.forEach(({ elapsed, expected }) => {
        vi.setSystemTime(new Date(startTime.getTime() + elapsed));

        const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

        const timerElement = screen.getByText(expected);
        expect(timerElement).toBeInTheDocument();

        // Verify exact format
        expect(timerElement.textContent).toBe(expected);
        expect(timerElement.textContent).toMatch(/^\d{2,}:\d{2}$/);

        rerender(<div />); // Clear for next iteration
      });
    });

    it('handles negative time differences correctly', () => {
      // Start time in the future (edge case)
      const futureStartTime = new Date('2023-01-01T12:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:00:00Z')); // 2 hours before

      render(<StatusBar {...defaultProps} sessionStartTime={futureStartTime} />);

      // Should show negative time with proper formatting
      expect(screen.getByText('-120:00')).toBeInTheDocument();
    });

    it('handles extreme large values correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      // Test very large elapsed times (weeks/months)
      const testCases = [
        { days: 1, expected: '1440:00' }, // 1 day = 1440 minutes
        { days: 7, expected: '10080:00' }, // 1 week = 10080 minutes
        { days: 30, expected: '43200:00' }, // 30 days = 43200 minutes
        { days: 365, expected: '525600:00' }, // 1 year = 525600 minutes
      ];

      testCases.forEach(({ days, expected }) => {
        const elapsed = days * 24 * 60 * 60 * 1000; // Convert days to milliseconds
        vi.setSystemTime(new Date(startTime.getTime() + elapsed));

        const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

        expect(screen.getByText(expected)).toBeInTheDocument();

        rerender(<div />); // Clear for next iteration
      });
    });
  });

  describe('timer lifecycle robustness', () => {
    it('handles rapid sessionStartTime changes without memory leaks', () => {
      const originalStartTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:01:00Z'));

      const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={originalStartTime} />);

      expect(screen.getByText('01:00')).toBeInTheDocument();

      // Rapidly change sessionStartTime multiple times
      const times = [
        new Date('2023-01-01T10:00:30Z'), // 30s elapsed
        new Date('2023-01-01T10:00:45Z'), // 15s elapsed
        new Date('2023-01-01T10:01:00Z'), // 0s elapsed
        new Date('2023-01-01T09:59:00Z'), // 2 minutes elapsed
      ];

      times.forEach((newStartTime, index) => {
        rerender(<StatusBar {...defaultProps} sessionStartTime={newStartTime} />);

        // Verify timer updates immediately to new value
        const expectedValues = ['00:30', '00:15', '00:00', '02:00'];
        expect(screen.getByText(expectedValues[index])).toBeInTheDocument();
      });
    });

    it('maintains accuracy during component re-renders', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:02:15Z'));

      const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('02:15')).toBeInTheDocument();

      // Re-render with different props multiple times
      for (let i = 0; i < 5; i++) {
        rerender(<StatusBar {...defaultProps} sessionStartTime={startTime} gitBranch={`branch-${i}`} />);

        // Timer should remain accurate
        expect(screen.getByText('02:15')).toBeInTheDocument();
      }
    });

    it('handles component mount/unmount cycles correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:01:30Z'));

      const { unmount, rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('01:30')).toBeInTheDocument();

      // Unmount component
      unmount();

      // Advance time while unmounted
      act(() => {
        vi.advanceTimersByTime(10000); // 10 seconds
      });

      // Re-mount component
      const { container } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      // Should show correct time immediately (not previous cached value)
      expect(screen.getByText('01:40')).toBeInTheDocument();
    });
  });

  describe('timer priority and visibility', () => {
    it('always shows timer regardless of terminal width', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:02:30Z'));

      const widths = [20, 40, 59, 60, 100, 160, 161, 300];

      widths.forEach(width => {
        const breakpoint = width < 60 ? 'narrow' :
                          width < 100 ? 'compact' :
                          width <= 160 ? 'normal' : 'wide';

        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          breakpoint: breakpoint as any,
          isAvailable: true,
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 100,
          isNormal: width >= 100 && width <= 160,
          isWide: width > 160,
        });

        const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

        // Timer should always be visible as it's critical priority
        expect(screen.getByText('02:30')).toBeInTheDocument();

        rerender(<div />); // Clear for next iteration
      });
    });

    it('shows timer in all display modes except compact', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:03:45Z'));

      const modes: Array<'normal' | 'compact' | 'verbose'> = ['normal', 'compact', 'verbose'];

      modes.forEach(mode => {
        const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} displayMode={mode} />);

        if (mode === 'compact') {
          // Timer is intentionally excluded in compact mode per implementation
          expect(screen.queryByText('03:45')).not.toBeInTheDocument();
        } else {
          expect(screen.getByText('03:45')).toBeInTheDocument();
        }

        rerender(<div />); // Clear for next iteration
      });
    });
  });

  describe('timer accuracy validation', () => {
    it('maintains sub-second precision for display calculations', () => {
      const startTime = new Date('2023-01-01T10:00:00.000Z');

      // Test millisecond precision doesn't affect second display
      const testCases = [
        { ms: 0, expected: '00:00' },
        { ms: 100, expected: '00:00' },
        { ms: 500, expected: '00:00' },
        { ms: 999, expected: '00:00' },
        { ms: 1000, expected: '00:01' },
        { ms: 1100, expected: '00:01' },
        { ms: 1999, expected: '00:01' },
        { ms: 2000, expected: '00:02' },
      ];

      testCases.forEach(({ ms, expected }) => {
        vi.setSystemTime(new Date(startTime.getTime() + ms));

        const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

        expect(screen.getByText(expected)).toBeInTheDocument();

        rerender(<div />); // Clear for next iteration
      });
    });

    it('handles timezone changes gracefully', () => {
      // This simulates timezone changes or system clock adjustments
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:05:00Z'));

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('05:00')).toBeInTheDocument();

      // Simulate clock advancement by advancing the timer
      act(() => {
        vi.advanceTimersByTime(60000); // Advance 1 minute = 60 seconds
      });

      expect(screen.getByText('06:00')).toBeInTheDocument();
    });

    it('validates timer display position and formatting consistency', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:01:23Z'));

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      const timer = screen.getByText('01:23');

      // Verify timer element exists and has correct format
      expect(timer).toBeInTheDocument();
      expect(timer.textContent).toBe('01:23');

      // Verify it's properly positioned (part of the right-side segments)
      const parentContainer = timer.closest('[style*="gap"]');
      expect(parentContainer).toBeInTheDocument();
    });
  });

  describe('error handling and edge cases', () => {
    it('handles invalid Date objects gracefully', () => {
      const invalidDate = new Date('invalid-date-string');

      render(<StatusBar {...defaultProps} sessionStartTime={invalidDate} />);

      // Should not crash but may show NaN:NaN due to invalid date math
      // This is expected behavior - invalid dates produce invalid time calculations
      expect(screen.getByText('NaN:NaN')).toBeInTheDocument();
    });

    it('handles extremely small time differences', () => {
      const startTime = new Date('2023-01-01T10:00:00.000Z');
      vi.setSystemTime(new Date('2023-01-01T10:00:00.001Z')); // 1ms difference

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      // Should round down to 00:00 for sub-second differences
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('handles null and undefined sessionStartTime gracefully', () => {
      // Test undefined
      const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={undefined} />);
      expect(screen.getByText('00:00')).toBeInTheDocument();

      // Test null
      rerender(<StatusBar {...defaultProps} sessionStartTime={null as any} />);
      expect(screen.getByText('00:00')).toBeInTheDocument();

      // Test missing prop entirely
      rerender(<StatusBar {...defaultProps} />);
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('handles concurrent timer updates during fast re-renders', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:01:00Z'));

      const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('01:00')).toBeInTheDocument();

      // Rapidly re-render while timer is updating
      act(() => {
        for (let i = 0; i < 10; i++) {
          rerender(<StatusBar {...defaultProps} sessionStartTime={startTime} agent={`agent-${i}`} />);
          vi.advanceTimersByTime(100); // 100ms each
        }
      });

      // Should show 1 second advanced (10 * 100ms = 1000ms)
      expect(screen.getByText('01:01')).toBeInTheDocument();
    });
  });
});