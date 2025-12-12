/**
 * Session timer component showing elapsed time
 * Updates every second to show session duration
 */

import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { useThemeColors } from '../../context/ThemeContext.js';

export interface SessionTimerProps {
  startTime: Date;
  label?: string;
}

export function SessionTimer({
  startTime,
  label = 'session'
}: SessionTimerProps): React.ReactElement {
  const colors = useThemeColors();
  const [now, setNow] = useState(new Date());

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Format duration in human-readable format
   */
  const formatDuration = (start: Date, end: Date): string => {
    const diffMs = end.getTime() - start.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return `${diffSeconds}s`;
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      const remainingSeconds = diffSeconds % 60;
      return `${diffMinutes}m${remainingSeconds > 0 ? ` ${remainingSeconds}s` : ''}`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    return `${diffHours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`;
  };

  const duration = formatDuration(startTime, now);

  // Color changes based on session length
  const getDurationColor = (seconds: number): string => {
    const diffSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    if (diffSeconds < 300) return colors.success; // < 5 minutes
    if (diffSeconds < 1800) return colors.info;   // < 30 minutes
    if (diffSeconds < 3600) return colors.warning; // < 1 hour
    return colors.error; // > 1 hour
  };

  const durationColor = getDurationColor(Math.floor((now.getTime() - startTime.getTime()) / 1000));

  return (
    <>
      <Text color={colors.muted}>{label}:</Text>
      <Text color={durationColor}>{duration}</Text>
    </>
  );
}