import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionTimer } from '../SessionTimer';

// Mock theme context
vi.mock('../../context/ThemeContext.js', () => ({
  useThemeColors: vi.fn(() => ({
    muted: 'gray',
    info: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  })),
}));

describe('SessionTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render session timer with default label', () => {
    const startTime = new Date('2023-01-01T11:59:50Z'); // 10 seconds ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('session:')).toBeInTheDocument();
    expect(screen.getByText('10s')).toBeInTheDocument();
  });

  it('should render custom label', () => {
    const startTime = new Date('2023-01-01T11:59:50Z');

    render(
      <SessionTimer
        startTime={startTime}
        label="active time"
      />
    );

    expect(screen.getByText('active time:')).toBeInTheDocument();
  });

  it('should format seconds correctly', () => {
    const startTime = new Date('2023-01-01T11:59:45Z'); // 15 seconds ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('15s')).toBeInTheDocument();
  });

  it('should format minutes and seconds correctly', () => {
    const startTime = new Date('2023-01-01T11:58:30Z'); // 1 minute 30 seconds ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('1m 30s')).toBeInTheDocument();
  });

  it('should format exact minutes without seconds', () => {
    const startTime = new Date('2023-01-01T11:58:00Z'); // 2 minutes ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('2m')).toBeInTheDocument();
  });

  it('should format hours and minutes correctly', () => {
    const startTime = new Date('2023-01-01T10:30:00Z'); // 1 hour 30 minutes ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });

  it('should format exact hours without minutes', () => {
    const startTime = new Date('2023-01-01T10:00:00Z'); // 2 hours ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('should update timer every second', () => {
    const startTime = new Date('2023-01-01T11:59:50Z'); // 10 seconds ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('10s')).toBeInTheDocument();

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('11s')).toBeInTheDocument();

    // Advance time by 5 more seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('16s')).toBeInTheDocument();
  });

  it('should transition from seconds to minutes', () => {
    const startTime = new Date('2023-01-01T11:59:05Z'); // 55 seconds ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('55s')).toBeInTheDocument();

    // Advance time by 10 seconds to cross the 1-minute mark
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('1m 5s')).toBeInTheDocument();
  });

  it('should transition from minutes to hours', () => {
    const startTime = new Date('2023-01-01T11:01:00Z'); // 59 minutes ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('59m')).toBeInTheDocument();

    // Advance time by 2 minutes to cross the 1-hour mark
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(screen.getByText('1h 1m')).toBeInTheDocument();
  });

  it('should handle zero elapsed time', () => {
    const startTime = new Date('2023-01-01T12:00:00Z'); // same as current time

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('0s')).toBeInTheDocument();
  });

  it('should handle future start time (edge case)', () => {
    const startTime = new Date('2023-01-01T12:01:00Z'); // 1 minute in the future

    render(<SessionTimer startTime={startTime} />);

    // Should show 0s or handle gracefully
    expect(screen.getByText('0s')).toBeInTheDocument();
  });

  it('should handle large time differences', () => {
    const startTime = new Date('2023-01-01T08:00:00Z'); // 4 hours ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('4h')).toBeInTheDocument();
  });

  it('should handle complex time combinations', () => {
    const startTime = new Date('2023-01-01T09:15:30Z'); // 2h 44m 30s ago

    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('2h 44m')).toBeInTheDocument(); // Seconds are omitted for hours
  });

  it('should cleanup interval on unmount', () => {
    const startTime = new Date('2023-01-01T11:59:50Z');

    const { unmount } = render(<SessionTimer startTime={startTime} />);

    // Verify timer is running
    expect(screen.getByText('10s')).toBeInTheDocument();

    // Unmount component
    unmount();

    // Timer should be cleaned up - no way to directly test this
    // but it ensures no memory leaks
  });

  it('should continue updating after component re-render', () => {
    const startTime = new Date('2023-01-01T11:59:50Z');

    const { rerender } = render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('10s')).toBeInTheDocument();

    // Advance time
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Re-render with same props
    rerender(<SessionTimer startTime={startTime} />);

    expect(screen.getByText('15s')).toBeInTheDocument();

    // Continue advancing time
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('20s')).toBeInTheDocument();
  });

  it('should reset timer when startTime changes', () => {
    const startTime1 = new Date('2023-01-01T11:59:00Z'); // 1 minute ago
    const startTime2 = new Date('2023-01-01T11:59:50Z'); // 10 seconds ago

    const { rerender } = render(<SessionTimer startTime={startTime1} />);

    expect(screen.getByText('1m')).toBeInTheDocument();

    // Change start time
    rerender(<SessionTimer startTime={startTime2} />);

    expect(screen.getByText('10s')).toBeInTheDocument();
  });
});