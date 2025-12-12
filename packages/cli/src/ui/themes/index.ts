/**
 * Theme registry and utilities
 * Central place for theme management and resolution
 */

import { darkTheme } from './dark.js';
import { lightTheme } from './light.js';
import type { Theme, ThemeName } from '../../types/theme.js';

// Available themes registry
export const themes: Record<ThemeName, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};

/**
 * Get a theme by name, fallback to dark theme if not found
 */
export function getTheme(themeName?: string): Theme {
  if (themeName && themeName in themes) {
    return themes[themeName as ThemeName];
  }
  return darkTheme; // Default fallback
}

/**
 * Get list of available theme names
 */
export function getThemeNames(): ThemeName[] {
  return Object.keys(themes) as ThemeName[];
}

/**
 * Validate if a theme name is valid
 */
export function isValidThemeName(name: string): name is ThemeName {
  return name in themes;
}

// Re-export themes for direct access
export { darkTheme, lightTheme };
export type { Theme, ThemeName };