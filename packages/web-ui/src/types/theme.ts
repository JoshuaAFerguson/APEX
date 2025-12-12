/**
 * Theme System Types
 *
 * Types for the theme context, color schemes, and persistence.
 */

/**
 * Theme mode options
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * APEX brand color scale
 */
export interface ApexColorScale {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

/**
 * Full theme color configuration
 */
export interface ThemeColors {
  // Background colors
  background: string
  backgroundSecondary: string
  backgroundTertiary: string

  // Foreground colors
  foreground: string
  foregroundSecondary: string
  foregroundTertiary: string

  // Border colors
  border: string
  borderSecondary: string

  // Brand colors
  apex: ApexColorScale

  // Semantic colors
  success: string
  warning: string
  error: string
  info: string
}

/**
 * Complete theme definition
 */
export interface Theme {
  mode: ThemeMode
  colors: ThemeColors
}

/**
 * Theme context value exposed by useTheme hook
 */
export interface ThemeContextValue {
  /** Current theme configuration */
  theme: Theme
  /** User-selected theme mode (may be 'system') */
  mode: ThemeMode
  /** Update the theme mode */
  setMode: (mode: ThemeMode) => void
  /** Resolved mode after evaluating system preference */
  resolvedMode: 'light' | 'dark'
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void
}

/**
 * Theme provider props
 */
export interface ThemeProviderProps {
  children: React.ReactNode
  /** Default theme mode if none is stored */
  defaultMode?: ThemeMode
  /** Storage key for persistence */
  storageKey?: string
}

/**
 * CSS variable names for theme colors
 */
export const CSS_VARIABLES = {
  background: '--color-background',
  backgroundSecondary: '--color-background-secondary',
  backgroundTertiary: '--color-background-tertiary',
  foreground: '--color-foreground',
  foregroundSecondary: '--color-foreground-secondary',
  foregroundTertiary: '--color-foreground-tertiary',
  border: '--color-border',
  borderSecondary: '--color-border-secondary',
  success: '--color-success',
  warning: '--color-warning',
  error: '--color-error',
  info: '--color-info',
} as const

/**
 * Default dark theme colors (RGB values)
 */
export const DARK_THEME_COLORS: ThemeColors = {
  background: '10 10 10',
  backgroundSecondary: '20 20 20',
  backgroundTertiary: '30 30 30',
  foreground: '250 250 250',
  foregroundSecondary: '161 161 170',
  foregroundTertiary: '113 113 122',
  border: '39 39 42',
  borderSecondary: '63 63 70',
  apex: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },
  success: '74 222 128',
  warning: '250 204 21',
  error: '248 113 113',
  info: '96 165 250',
}

/**
 * Default light theme colors (RGB values)
 */
export const LIGHT_THEME_COLORS: ThemeColors = {
  background: '255 255 255',
  backgroundSecondary: '249 250 251',
  backgroundTertiary: '243 244 246',
  foreground: '17 24 39',
  foregroundSecondary: '107 114 128',
  foregroundTertiary: '156 163 175',
  border: '229 231 235',
  borderSecondary: '209 213 219',
  apex: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },
  success: '34 197 94',
  warning: '234 179 8',
  error: '239 68 68',
  info: '59 130 246',
}

/**
 * Storage key for theme persistence
 */
export const THEME_STORAGE_KEY = 'apex-theme-mode'
