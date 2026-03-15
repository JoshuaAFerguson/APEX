/**
 * Theme context for providing theme throughout the component tree
 * Allows dynamic theme switching and consistent theme access
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Theme, ThemeName } from '../../types/theme.js';
import { getTheme, isValidThemeName } from '../themes/index.js';

interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeName;
  initialTheme?: ThemeName;
  theme?: Theme;
}

/**
 * Theme provider component that wraps the app and provides theme context
 */
export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  initialTheme,
  theme: customTheme
}: ThemeProviderProps): React.ReactElement {
  // Use initialTheme if provided and valid, then defaultTheme, then fall back to 'dark'
  const getValidThemeName = (themeCandidate?: string): ThemeName => {
    if (themeCandidate && isValidThemeName(themeCandidate)) {
      return themeCandidate as ThemeName;
    }
    return 'dark';
  };

  const initialThemeName = getValidThemeName(initialTheme || defaultTheme);
  const [themeName, setThemeName] = useState<ThemeName>(initialThemeName);

  // Use custom theme if provided, otherwise get theme by name
  const theme = customTheme || getTheme(themeName);

  const handleSetTheme = useCallback((newThemeName: ThemeName) => {
    if (isValidThemeName(newThemeName)) {
      setThemeName(newThemeName);
    }
  }, []);

  const value: ThemeContextType = {
    theme,
    themeName: customTheme ? customTheme.name as ThemeName : themeName,
    setTheme: handleSetTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme context
 * Must be used within a ThemeProvider
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to get just the current theme object (convenience hook)
 */
export function useThemeColors(): Theme['colors'] {
  const { theme } = useTheme();
  return theme.colors;
}