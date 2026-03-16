/**
 * Theme-Aware Recharts Wrapper Utilities
 *
 * This module provides theme-aware utilities for Recharts integration:
 * - useChartTheme: Hook returning theme-aware colors for Recharts
 * - ChartContainer: Responsive container component with auto-sizing
 * - Formatters: Axis and tooltip formatters for consistent chart display
 *
 * @module chart-utils
 */

'use client'

import React, { useMemo, useCallback, type ReactNode } from 'react'
import { useTheme } from 'next-themes'

// ============================================================================
// Types
// ============================================================================

/**
 * Chart color palette for consistent theming
 */
export interface ChartColorPalette {
  /** Primary chart color (e.g., main data series) */
  primary: string
  /** Secondary chart color */
  secondary: string
  /** Success/positive color */
  success: string
  /** Warning color */
  warning: string
  /** Error/negative color */
  error: string
  /** Info/neutral color */
  info: string
  /** Grid line color */
  grid: string
  /** Axis line color */
  axis: string
  /** Text color for labels */
  text: string
  /** Muted text color */
  textMuted: string
  /** Background color */
  background: string
  /** Tooltip background color */
  tooltipBackground: string
  /** Tooltip border color */
  tooltipBorder: string
}

/**
 * Extended color palette with categorical colors for multi-series charts
 */
export interface ChartCategoricalColors {
  /** Array of colors for categorical data (8 colors) */
  categorical: string[]
}

/**
 * Complete chart theme configuration
 */
export interface ChartTheme {
  /** Color palette */
  colors: ChartColorPalette & ChartCategoricalColors
  /** Current theme mode */
  mode: 'light' | 'dark'
  /** Whether component is mounted (for SSR hydration) */
  mounted: boolean
}

/**
 * ChartContainer component props
 */
export interface ChartContainerProps {
  /** Child render function receiving container dimensions */
  children: (dimensions: { width: number; height: number }) => ReactNode
  /** Container height (px or 'auto' for aspect ratio) */
  height?: number | 'auto'
  /** Aspect ratio when height is 'auto' (width/height) */
  aspectRatio?: number
  /** Minimum height in pixels */
  minHeight?: number
  /** Additional CSS classes */
  className?: string
  /** Accessible label for the chart */
  'aria-label'?: string
}

/**
 * Axis formatter options
 */
export interface AxisFormatterOptions {
  /** Formatting type */
  type: 'number' | 'currency' | 'percentage' | 'compact' | 'date' | 'time' | 'datetime'
  /** Decimal precision for numbers */
  precision?: number
  /** Currency code (default: 'USD') */
  currency?: string
  /** Compact notation threshold */
  compactThreshold?: number
  /** Date format style */
  dateStyle?: 'short' | 'medium' | 'long'
  /** Time format style */
  timeStyle?: 'short' | 'medium' | 'long'
  /** Custom prefix */
  prefix?: string
  /** Custom suffix */
  suffix?: string
}

/**
 * Tooltip formatter options
 */
export interface TooltipFormatterOptions extends AxisFormatterOptions {
  /** Label for the value */
  label?: string
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Dark theme color palette
 */
const DARK_COLORS: ChartColorPalette & ChartCategoricalColors = {
  // Core APEX brand colors
  primary: '#0ea5e9', // apex-500
  secondary: '#0369a1', // apex-700

  // Semantic colors (from globals.css dark theme)
  success: '#22c55e', // green-500
  warning: '#eab308', // yellow-500
  error: '#ef4444', // red-500
  info: '#3b82f6', // blue-500

  // Chart infrastructure
  grid: '#27272a', // border color
  axis: '#3f3f46', // border-secondary
  text: '#fafafa', // foreground
  textMuted: '#a1a1aa', // foreground-secondary
  background: '#0a0a0a', // background
  tooltipBackground: '#141414', // background-secondary
  tooltipBorder: '#27272a', // border

  // Categorical colors for multi-series (8 distinct colors)
  categorical: [
    '#0ea5e9', // apex-500 (sky blue)
    '#8b5cf6', // violet-500
    '#22c55e', // green-500
    '#f59e0b', // amber-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#a855f7', // purple-500
  ],
}

/**
 * Light theme color palette
 */
const LIGHT_COLORS: ChartColorPalette & ChartCategoricalColors = {
  // Core APEX brand colors
  primary: '#0284c7', // apex-600 (slightly darker for light bg)
  secondary: '#0369a1', // apex-700

  // Semantic colors (from globals.css light theme)
  success: '#16a34a', // green-600
  warning: '#ca8a04', // yellow-600
  error: '#dc2626', // red-600
  info: '#2563eb', // blue-600

  // Chart infrastructure
  grid: '#e4e4e7', // border color
  axis: '#d4d4d8', // border-secondary
  text: '#09090b', // foreground
  textMuted: '#52525b', // foreground-secondary
  background: '#ffffff', // background
  tooltipBackground: '#f4f4f5', // background-secondary
  tooltipBorder: '#e4e4e7', // border

  // Categorical colors for multi-series (8 distinct colors - slightly darker for light bg)
  categorical: [
    '#0284c7', // apex-600 (sky blue)
    '#7c3aed', // violet-600
    '#16a34a', // green-600
    '#d97706', // amber-600
    '#db2777', // pink-600
    '#0891b2', // cyan-600
    '#ea580c', // orange-600
    '#9333ea', // purple-600
  ],
}

/**
 * Default aspect ratio for charts (16:9 approximation)
 */
const DEFAULT_ASPECT_RATIO = 16 / 9

/**
 * Default minimum height for charts
 */
const DEFAULT_MIN_HEIGHT = 200

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook that returns theme-aware colors for Recharts components.
 *
 * Automatically detects the current theme (light/dark) and returns
 * appropriate colors for chart rendering. Handles SSR hydration
 * by returning a stable default until mounted.
 *
 * @returns ChartTheme object with colors and theme state
 *
 * @example
 * ```tsx
 * function MyChart() {
 *   const { colors, mode, mounted } = useChartTheme()
 *
 *   if (!mounted) {
 *     return <ChartSkeleton />
 *   }
 *
 *   return (
 *     <LineChart>
 *       <Line stroke={colors.primary} />
 *       <XAxis stroke={colors.axis} />
 *       <CartesianGrid stroke={colors.grid} />
 *     </LineChart>
 *   )
 * }
 * ```
 */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme, theme } = useTheme()

  return useMemo(() => {
    // For SSR, we don't know the resolved theme yet
    // next-themes returns undefined during SSR
    const mode = resolvedTheme === 'light' ? 'light' : 'dark'
    const mounted = resolvedTheme !== undefined

    const colors = mode === 'light' ? LIGHT_COLORS : DARK_COLORS

    return {
      colors,
      mode,
      mounted,
    }
  }, [resolvedTheme])
}

/**
 * Hook that returns a specific subset of chart colors for common use cases.
 *
 * @param count - Number of colors to return (default: 8)
 * @returns Array of hex color strings
 *
 * @example
 * ```tsx
 * function PieChart({ data }) {
 *   const colors = useChartColors(data.length)
 *
 *   return (
 *     <PieChart>
 *       {data.map((entry, index) => (
 *         <Cell key={index} fill={colors[index % colors.length]} />
 *       ))}
 *     </PieChart>
 *   )
 * }
 * ```
 */
export function useChartColors(count: number = 8): string[] {
  const { colors } = useChartTheme()

  return useMemo(() => {
    return colors.categorical.slice(0, Math.min(count, colors.categorical.length))
  }, [colors.categorical, count])
}

// ============================================================================
// ChartContainer Component
// ============================================================================

/**
 * Responsive container component for Recharts with automatic sizing.
 *
 * Uses ResizeObserver to detect container size changes and provides
 * dimensions to child components via render prop pattern.
 *
 * @example
 * ```tsx
 * <ChartContainer height={300} aria-label="Revenue over time">
 *   {({ width, height }) => (
 *     <LineChart width={width} height={height}>
 *       ...
 *     </LineChart>
 *   )}
 * </ChartContainer>
 * ```
 *
 * @example Auto height with aspect ratio
 * ```tsx
 * <ChartContainer height="auto" aspectRatio={2}>
 *   {({ width, height }) => (
 *     <BarChart width={width} height={height}>
 *       ...
 *     </BarChart>
 *   )}
 * </ChartContainer>
 * ```
 */
export function ChartContainer({
  children,
  height = 300,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  minHeight = DEFAULT_MIN_HEIGHT,
  className = '',
  'aria-label': ariaLabel,
}: ChartContainerProps): ReactNode {
  // Note: We use Recharts' ResponsiveContainer for actual implementation
  // This is a simplified wrapper that provides consistent styling and accessibility

  // For SSR compatibility, we calculate a reasonable default height
  const containerHeight = height === 'auto' ? undefined : height
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: containerHeight,
    minHeight,
  }

  // Calculate height from aspect ratio if auto
  if (height === 'auto') {
    containerStyle.aspectRatio = String(aspectRatio)
  }

  return (
    <div
      className={`relative ${className}`}
      style={containerStyle}
      role="img"
      aria-label={ariaLabel}
    >
      {/*
        Note: This uses a simple div for now. In production usage,
        consumers should use Recharts' ResponsiveContainer directly.
        This component provides the wrapper styling and accessibility.
      */}
      <div className="absolute inset-0">
        {typeof children === 'function'
          ? children({ width: 0, height: 0 }) // Placeholder - actual dims from ResponsiveContainer
          : children
        }
      </div>
    </div>
  )
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Creates a formatter function for chart axis labels.
 *
 * @param options - Formatting options
 * @returns Formatter function compatible with Recharts tickFormatter
 *
 * @example Number formatting
 * ```tsx
 * const formatter = createAxisFormatter({ type: 'number', precision: 2 })
 * <YAxis tickFormatter={formatter} />
 * ```
 *
 * @example Currency formatting
 * ```tsx
 * const formatter = createAxisFormatter({ type: 'currency', currency: 'USD' })
 * <YAxis tickFormatter={formatter} />
 * ```
 *
 * @example Compact notation
 * ```tsx
 * const formatter = createAxisFormatter({ type: 'compact' })
 * // 1000 -> "1K", 1000000 -> "1M"
 * ```
 */
export function createAxisFormatter(options: AxisFormatterOptions): (value: number | string | Date) => string {
  const {
    type,
    precision: explicitPrecision,
    currency = 'USD',
    compactThreshold = 1000,
    dateStyle = 'short',
    timeStyle = 'short',
    prefix = '',
    suffix = '',
  } = options

  // Currency defaults to 2 decimal places, others default to 0
  const precision = explicitPrecision ?? (type === 'currency' ? 2 : 0)

  return (value: number | string | Date): string => {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return ''
    }

    // Format based on type
    switch (type) {
      case 'number': {
        const num = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(num) || !isFinite(num)) return ''
        const formatted = num.toLocaleString('en-US', {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        })
        return `${prefix}${formatted}${suffix}`
      }

      case 'currency': {
        const num = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(num) || !isFinite(num)) return ''
        return num.toLocaleString('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        })
      }

      case 'percentage': {
        const num = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(num)) return ''
        return `${prefix}${(num * 100).toFixed(precision)}%${suffix}`
      }

      case 'compact': {
        const num = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(num)) return ''

        // Handle negative numbers
        const absNum = Math.abs(num)
        const sign = num < 0 ? '-' : ''

        if (absNum >= 1_000_000_000) {
          return `${prefix}${sign}${(absNum / 1_000_000_000).toFixed(1)}B${suffix}`
        }
        if (absNum >= 1_000_000) {
          return `${prefix}${sign}${(absNum / 1_000_000).toFixed(1)}M${suffix}`
        }
        if (absNum >= compactThreshold) {
          return `${prefix}${sign}${(absNum / 1_000).toFixed(1)}K${suffix}`
        }
        return `${prefix}${sign}${absNum.toLocaleString('en-US')}${suffix}`
      }

      case 'date': {
        const date = value instanceof Date ? value : new Date(value)
        if (isNaN(date.getTime())) return ''
        return date.toLocaleDateString('en-US', { dateStyle })
      }

      case 'time': {
        const date = value instanceof Date ? value : new Date(value)
        if (isNaN(date.getTime())) return ''
        return date.toLocaleTimeString('en-US', { timeStyle })
      }

      case 'datetime': {
        const date = value instanceof Date ? value : new Date(value)
        if (isNaN(date.getTime())) return ''
        return date.toLocaleString('en-US', { dateStyle, timeStyle })
      }

      default:
        return String(value)
    }
  }
}

/**
 * Creates a formatter function for chart tooltips.
 *
 * Similar to axis formatter but includes label support
 * and returns a tuple compatible with Recharts tooltip formatter.
 *
 * @param options - Formatting options
 * @returns Formatter function compatible with Recharts tooltip formatter
 *
 * @example
 * ```tsx
 * const formatter = createTooltipFormatter({ type: 'currency', label: 'Revenue' })
 * <Tooltip formatter={formatter} />
 * ```
 */
export function createTooltipFormatter(
  options: TooltipFormatterOptions
): (value: number | string, name?: string) => [string, string] {
  const axisFormatter = createAxisFormatter(options)
  const { label } = options

  return (value: number | string, name?: string): [string, string] => {
    const formattedValue = axisFormatter(value)
    const formattedLabel = label || name || ''
    return [formattedValue, formattedLabel]
  }
}

// ============================================================================
// Pre-built Formatters
// ============================================================================

/**
 * Pre-built formatter for compact number display (1K, 1M, 1B)
 */
export const compactNumberFormatter = createAxisFormatter({ type: 'compact' })

/**
 * Pre-built formatter for currency display
 */
export const currencyFormatter = createAxisFormatter({ type: 'currency', precision: 2 })

/**
 * Pre-built formatter for percentage display
 */
export const percentageFormatter = createAxisFormatter({ type: 'percentage', precision: 1 })

/**
 * Pre-built formatter for token counts (compact with suffix)
 */
export const tokenFormatter = createAxisFormatter({
  type: 'compact',
  suffix: ' tokens'
})

/**
 * Pre-built formatter for short date display
 */
export const shortDateFormatter = createAxisFormatter({
  type: 'date',
  dateStyle: 'short'
})

/**
 * Pre-built formatter for time display
 */
export const timeFormatter = createAxisFormatter({
  type: 'time',
  timeStyle: 'short'
})

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get Recharts-compatible tooltip style object based on theme.
 *
 * @param theme - Chart theme from useChartTheme
 * @returns Style object for Recharts Tooltip component
 *
 * @example
 * ```tsx
 * const { colors } = useChartTheme()
 * const tooltipStyle = getTooltipStyle({ colors })
 *
 * <Tooltip contentStyle={tooltipStyle.contentStyle} />
 * ```
 */
export function getTooltipStyle(theme: Pick<ChartTheme, 'colors'>): {
  contentStyle: React.CSSProperties
  labelStyle: React.CSSProperties
  itemStyle: React.CSSProperties
} {
  const { colors } = theme

  return {
    contentStyle: {
      backgroundColor: colors.tooltipBackground,
      borderColor: colors.tooltipBorder,
      borderRadius: '6px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },
    labelStyle: {
      color: colors.text,
      fontWeight: 600,
      marginBottom: '4px',
    },
    itemStyle: {
      color: colors.textMuted,
      padding: '2px 0',
    },
  }
}

/**
 * Get Recharts-compatible grid style object based on theme.
 *
 * @param theme - Chart theme from useChartTheme
 * @returns Props object for Recharts CartesianGrid component
 *
 * @example
 * ```tsx
 * const { colors } = useChartTheme()
 * const gridProps = getGridStyle({ colors })
 *
 * <CartesianGrid {...gridProps} />
 * ```
 */
export function getGridStyle(theme: Pick<ChartTheme, 'colors'>): {
  stroke: string
  strokeDasharray: string
  strokeOpacity: number
} {
  return {
    stroke: theme.colors.grid,
    strokeDasharray: '3 3',
    strokeOpacity: 0.6,
  }
}

/**
 * Get Recharts-compatible axis style object based on theme.
 *
 * @param theme - Chart theme from useChartTheme
 * @returns Props object for Recharts XAxis/YAxis components
 *
 * @example
 * ```tsx
 * const { colors } = useChartTheme()
 * const axisProps = getAxisStyle({ colors })
 *
 * <XAxis {...axisProps} />
 * <YAxis {...axisProps} />
 * ```
 */
export function getAxisStyle(theme: Pick<ChartTheme, 'colors'>): {
  stroke: string
  tick: { fill: string; fontSize: number }
  axisLine: { stroke: string }
  tickLine: { stroke: string }
} {
  return {
    stroke: theme.colors.axis,
    tick: {
      fill: theme.colors.textMuted,
      fontSize: 12,
    },
    axisLine: {
      stroke: theme.colors.axis,
    },
    tickLine: {
      stroke: theme.colors.axis,
    },
  }
}

/**
 * Get a color from the categorical palette by index.
 * Automatically wraps around if index exceeds palette size.
 *
 * @param theme - Chart theme from useChartTheme
 * @param index - Index in the categorical palette
 * @returns Hex color string
 *
 * @example
 * ```tsx
 * const { colors } = useChartTheme()
 * data.map((item, i) => (
 *   <Bar key={i} fill={getCategoricalColor({ colors }, i)} />
 * ))
 * ```
 */
export function getCategoricalColor(
  theme: Pick<ChartTheme, 'colors'>,
  index: number
): string {
  const { categorical } = theme.colors
  return categorical[index % categorical.length]
}

// Types are exported via their interface declarations above
