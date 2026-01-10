/**
 * Hook for calculating usage level colors based on percentage of limits
 * Provides consistent color theming for resource limit indicators
 */

import { useThemeColors } from '../../context/ThemeContext.js';
import type { Theme } from '../../types/theme.js';

export type UsageLevel = 'safe' | 'warning' | 'danger';

/**
 * Determine usage level based on current value and limit
 * @param current Current usage value
 * @param limit Maximum allowed value
 * @returns Usage level for color determination
 */
export function getUsageLevel(current: number, limit: number): UsageLevel {
  if (limit <= 0) return 'safe';
  const percentage = (current / limit) * 100;

  if (percentage < 50) return 'safe';       // Green - under 50%
  if (percentage < 80) return 'warning';    // Yellow - 50-80%
  return 'danger';                          // Red - 80%+
}

/**
 * Get usage percentage for display purposes
 * @param current Current usage value
 * @param limit Maximum allowed value
 * @returns Percentage value clamped between 0 and 100
 */
export function getUsagePercentage(current: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, (current / limit) * 100));
}

/**
 * Get color for usage level using theme colors
 * @param level Usage level
 * @param colors Theme colors object
 * @returns Color string for the usage level
 */
export function getUsageColor(level: UsageLevel, colors: Theme['colors']): string {
  switch (level) {
    case 'safe':
      return colors.success;     // Green
    case 'warning':
      return colors.warning;     // Yellow
    case 'danger':
      return colors.error;       // Red
    default:
      return colors.muted;       // Fallback
  }
}

/**
 * Hook to get color information for a given usage and limit
 * @param current Current usage value
 * @param limit Maximum allowed value
 * @returns Object containing usage level, percentage, and color
 */
export function useLimitColors(current: number, limit: number) {
  const colors = useThemeColors();

  const level = getUsageLevel(current, limit);
  const percentage = getUsagePercentage(current, limit);
  const color = getUsageColor(level, colors);

  return {
    level,
    percentage,
    color,
    isExceeded: current > limit,
    isNearLimit: level === 'warning' || level === 'danger',
  };
}