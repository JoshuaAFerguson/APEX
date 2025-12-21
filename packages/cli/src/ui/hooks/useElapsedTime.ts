import { useState, useEffect } from 'react';
import { formatElapsed } from '@apex/core';

/**
 * Custom hook for tracking elapsed time since a start date
 * @param startTime - The start time to calculate elapsed time from
 * @param updateInterval - How often to update the elapsed time in milliseconds (default: 1000ms)
 * @returns The formatted elapsed time string that updates in real-time
 */
export function useElapsedTime(
  startTime: Date | null | undefined,
  updateInterval: number = 1000
): string {
  const [elapsedTime, setElapsedTime] = useState<string>('0s');

  useEffect(() => {
    // Return early if no start time provided
    if (!startTime) {
      setElapsedTime('0s');
      return;
    }

    // Update immediately
    const updateElapsedTime = () => {
      const now = new Date();
      const formatted = formatElapsed(startTime, now);
      setElapsedTime(formatted);
    };

    updateElapsedTime();

    // Set up interval for regular updates
    const interval = setInterval(updateElapsedTime, updateInterval);

    // Cleanup interval on unmount or when startTime changes
    return () => {
      clearInterval(interval);
    };
  }, [startTime, updateInterval]);

  return elapsedTime;
}