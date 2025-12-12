/**
 * Theme hook utilities
 * Additional convenience hooks for working with themes
 */

import { useTheme, useThemeColors } from '../context/ThemeContext.js';
import type { Theme } from '../../types/theme.js';

/**
 * Hook that provides theme utilities and helpers
 */
export function useThemeHelpers() {
  const { theme, themeName, setTheme } = useTheme();
  const colors = useThemeColors();

  /**
   * Get color for a specific agent
   */
  const getAgentColor = (agentName: string): string => {
    const agentKey = agentName.toLowerCase() as keyof Theme['colors']['agents'];
    return colors.agents[agentKey] || colors.primary;
  };

  /**
   * Get status color based on task/operation status
   */
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
      case 'passed':
        return colors.success;
      case 'failed':
      case 'error':
        return colors.error;
      case 'warning':
      case 'pending':
        return colors.warning;
      case 'in-progress':
      case 'running':
        return colors.info;
      case 'cancelled':
      case 'skipped':
        return colors.muted;
      default:
        return colors.text;
    }
  };

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    setTheme(themeName === 'dark' ? 'light' : 'dark');
  };

  /**
   * Check if current theme is dark
   */
  const isDark = themeName === 'dark';

  return {
    theme,
    themeName,
    colors,
    setTheme,
    getAgentColor,
    getStatusColor,
    toggleTheme,
    isDark,
  };
}

// Re-export theme hooks for convenience
export { useTheme, useThemeColors };