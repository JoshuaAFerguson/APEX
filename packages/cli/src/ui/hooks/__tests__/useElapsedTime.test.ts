import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useElapsedTime } from '../useElapsedTime.js';

// Mock timers for consistent test behavior
describe('useElapsedTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "0s" when startTime is null', () => {
    const { result } = renderHook(() => useElapsedTime(null));
    expect(result.current).toBe('0s');
  });

  it('returns "0s" initially for sub-second durations', () => {
    const startTime = new Date();
    const { result } = renderHook(() => useElapsedTime(startTime));
    expect(result.current).toBe('0s');
  });

  it('formats seconds correctly', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T00:00:05Z'); // 5 seconds later

    vi.setSystemTime(currentTime);
    const { result } = renderHook(() => useElapsedTime(startTime));

    act(() => {
      vi.advanceTimersByTime(1000); // Advance by 1 second to trigger update
    });

    expect(result.current).toBe('5s');
  });

  it('formats minutes and seconds correctly', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T00:02:15Z'); // 2 minutes 15 seconds later

    vi.setSystemTime(currentTime);
    const { result } = renderHook(() => useElapsedTime(startTime));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe('2m 15s');
  });

  it('formats hours and minutes correctly', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T01:05:00Z'); // 1 hour 5 minutes later

    vi.setSystemTime(currentTime);
    const { result } = renderHook(() => useElapsedTime(startTime));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe('1h 5m');
  });

  it('updates in real-time with custom interval', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    vi.setSystemTime(startTime);
    const { result } = renderHook(() => useElapsedTime(startTime, 500)); // 500ms intervals

    // Initial state
    expect(result.current).toBe('0s');

    // Advance time and timers
    act(() => {
      vi.advanceTimersByTime(1500); // 1.5 seconds
    });

    expect(result.current).toBe('1s');
  });

  it('handles negative elapsed time gracefully', () => {
    const now = new Date('2023-01-01T00:00:00Z');
    vi.setSystemTime(now);
    const futureTime = new Date(now.getTime() + 5000); // 5 seconds in future
    const { result } = renderHook(() => useElapsedTime(futureTime));
    expect(result.current).toBe('0s');
  });

  it('cleans up timer on unmount', () => {
    const startTime = new Date();
    const { unmount } = renderHook(() => useElapsedTime(startTime));

    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('handles undefined startTime', () => {
    const { result } = renderHook(() => useElapsedTime(undefined));
    expect(result.current).toBe('0s');
  });

  it('handles extremely large elapsed times', () => {
    const startTime = new Date('2020-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T00:00:00Z'); // 3 years later

    vi.setSystemTime(currentTime);
    const { result } = renderHook(() => useElapsedTime(startTime));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should handle very large times gracefully
    expect(result.current).toMatch(/\d+h \d+m/);
  });

  it('stops updating when startTime is set to null', () => {
    const startTime = new Date();
    const { result, rerender } = renderHook(
      ({ time }) => useElapsedTime(time),
      { initialProps: { time: startTime } }
    );

    expect(result.current).toBe('0s');

    // Set to null
    rerender({ time: null });
    expect(result.current).toBe('0s');

    // Advance time - should not change
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBe('0s');
  });
});
