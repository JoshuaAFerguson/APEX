'use client'

import React, { useMemo, HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Configuration interface for customizing gauge thresholds
 */
export interface BudgetGaugeThresholds {
  /** Threshold for warning state (default: 75%) */
  warning: number
  /** Threshold for danger state (default: 90%) */
  danger: number
}

/**
 * Props for the BudgetGauge component
 */
export interface BudgetGaugeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current amount spent */
  currentSpend: number
  /** Total budget limit */
  budgetLimit: number
  /** Optional label for the gauge */
  label?: string
  /** Size variant of the gauge */
  size?: 'sm' | 'md' | 'lg'
  /** Custom thresholds for color states */
  thresholds?: Partial<BudgetGaugeThresholds>
  /** Whether to show percentage text */
  showPercentage?: boolean
  /** Whether to show dollar amounts */
  showAmounts?: boolean
  /** Custom class name for styling */
  className?: string
  /** Format function for currency display */
  formatCurrency?: (amount: number) => string
}

/**
 * Color state based on spending percentage
 */
type ColorState = 'safe' | 'warning' | 'danger'

/**
 * Default thresholds for color states
 */
const DEFAULT_THRESHOLDS: BudgetGaugeThresholds = {
  warning: 75,
  danger: 90,
}

/**
 * BudgetGauge - A circular gauge component showing current spend vs budget limit
 *
 * Features:
 * - SVG-based arc rendering for smooth visuals
 * - Color states: green (<75%), yellow (75-90%), red (>90%)
 * - Displays dollar amounts and percentage
 * - Configurable thresholds and sizing
 * - Full accessibility support
 * - Responsive design
 */
export const BudgetGauge = forwardRef<HTMLDivElement, BudgetGaugeProps>(
  ({
    currentSpend,
    budgetLimit,
    label,
    size = 'md',
    thresholds = {},
    showPercentage = true,
    showAmounts = true,
    className,
    formatCurrency = (amount: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount),
    ...props
  }, ref) => {
    // Merge custom thresholds with defaults
    const mergedThresholds = useMemo(() => ({ ...DEFAULT_THRESHOLDS, ...thresholds }), [thresholds])

    // Calculate percentage and determine color state
    const { percentage, colorState, displayPercentage } = useMemo(() => {
      // Prevent division by zero
      if (budgetLimit <= 0) {
        return { percentage: 0, colorState: 'safe' as ColorState, displayPercentage: 0 }
      }

      const pct = Math.max(0, (currentSpend / budgetLimit) * 100) // Don't allow negative percentages
      const displayPct = Math.min(pct, 100) // Cap at 100% for display

      let state: ColorState = 'safe'
      if (pct >= mergedThresholds.danger) {
        state = 'danger'
      } else if (pct >= mergedThresholds.warning) {
        state = 'warning'
      }

      return {
        percentage: pct,
        colorState: state,
        displayPercentage: displayPct
      }
    }, [currentSpend, budgetLimit, mergedThresholds])

    // Size configurations
    const sizeConfig = {
      sm: { size: 80, strokeWidth: 6, fontSize: 'text-xs', spacing: 'space-y-1' },
      md: { size: 120, strokeWidth: 8, fontSize: 'text-sm', spacing: 'space-y-2' },
      lg: { size:160, strokeWidth: 10, fontSize: 'text-base', spacing: 'space-y-3' },
    }[size]

    // SVG calculations
    const { center, radius, circumference, strokeDasharray, strokeDashoffset } = useMemo(() => {
      const center = sizeConfig.size / 2
      const radius = center - sizeConfig.strokeWidth / 2
      const circumference = 2 * Math.PI * radius

      // Create arc (3/4 circle) instead of full circle
      const arcLength = circumference * 0.75
      const progress = (displayPercentage / 100) * arcLength

      return {
        center,
        radius,
        circumference: arcLength,
        strokeDasharray: `${arcLength} ${circumference}`,
        strokeDashoffset: arcLength - progress,
      }
    }, [sizeConfig.size, sizeConfig.strokeWidth, displayPercentage])

    // Color mappings
    const colorClasses = {
      safe: {
        stroke: 'stroke-green-500',
        text: 'text-green-600',
        bg: 'text-green-100',
      },
      warning: {
        stroke: 'stroke-yellow-500',
        text: 'text-yellow-600',
        bg: 'text-yellow-100',
      },
      danger: {
        stroke: 'stroke-red-500',
        text: 'text-red-600',
        bg: 'text-red-100',
      },
    }

    // Accessibility properties
    const ariaLabel = `Budget gauge: ${formatCurrency(currentSpend)} spent of ${formatCurrency(budgetLimit)} budget (${Math.round(percentage)}%)`
    const ariaValueNow = Math.round(percentage)
    const ariaValueText = `${Math.round(percentage)} percent of budget used`

    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center', sizeConfig.spacing, className)}
        {...props}
      >
        {/* Optional Label */}
        {label && (
          <h3 className={cn('font-medium text-foreground text-center', sizeConfig.fontSize)}>
            {label}
          </h3>
        )}

        {/* SVG Gauge */}
        <div className="relative">
          <svg
            width={sizeConfig.size}
            height={sizeConfig.size}
            viewBox={`0 0 ${sizeConfig.size} ${sizeConfig.size}`}
            role="img"
            aria-label={ariaLabel}
            className="transform -rotate-135"
          >
            {/* Background arc */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={sizeConfig.strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
              className="text-background-tertiary"
            />

            {/* Progress arc */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth={sizeConfig.strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={cn('transition-all duration-700 ease-out', colorClasses[colorState].stroke)}
              style={{
                transformOrigin: 'center',
              }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Percentage display */}
            {showPercentage && (
              <div
                className={cn('font-bold leading-tight', colorClasses[colorState].text)}
                style={{ fontSize: size === 'sm' ? '1rem' : size === 'md' ? '1.25rem' : '1.5rem' }}
                role="text"
                aria-live="polite"
                aria-atomic="true"
              >
                {Math.round(displayPercentage)}%
              </div>
            )}

            {/* Amounts display */}
            {showAmounts && (
              <div className={cn('text-center leading-tight', sizeConfig.fontSize)}>
                <div className={cn('font-medium', colorClasses[colorState].text)}>
                  {formatCurrency(currentSpend)}
                </div>
                <div className="text-foreground-secondary text-xs">
                  of {formatCurrency(budgetLimit)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Screen reader only status */}
        <div className="sr-only">
          <div
            role="progressbar"
            aria-valuenow={ariaValueNow}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={ariaValueText}
          >
            Budget usage: {ariaValueText}
          </div>
        </div>

        {/* Status indicator text */}
        <div className={cn('text-center', sizeConfig.fontSize)}>
          {percentage >= mergedThresholds.danger && (
            <span className={colorClasses[colorState].text} role="alert">
              Over budget
            </span>
          )}
          {percentage >= mergedThresholds.warning && percentage < mergedThresholds.danger && (
            <span className={colorClasses[colorState].text} role="alert">
              Approaching limit
            </span>
          )}
          {percentage < mergedThresholds.warning && (
            <span className={colorClasses[colorState].text}>
              Within budget
            </span>
          )}
        </div>
      </div>
    )
  }
)

BudgetGauge.displayName = 'BudgetGauge'

/**
 * Utility component for mini budget gauge in cards/lists
 */
export interface BudgetGaugeMiniProps {
  /** Current amount spent */
  currentSpend: number
  /** Total budget limit */
  budgetLimit: number
  /** Custom class name */
  className?: string
  /** Custom thresholds */
  thresholds?: Partial<BudgetGaugeThresholds>
  /** Format function for currency display */
  formatCurrency?: (amount: number) => string
}

export const BudgetGaugeMini = ({
  currentSpend,
  budgetLimit,
  className,
  thresholds = {},
  formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount),
}: BudgetGaugeMiniProps) => {
  const mergedThresholds = useMemo(() => ({ ...DEFAULT_THRESHOLDS, ...thresholds }), [thresholds])

  const { percentage, colorState } = useMemo(() => {
    if (budgetLimit <= 0) return { percentage: 0, colorState: 'safe' as ColorState }

    const pct = Math.max(0, (currentSpend / budgetLimit) * 100) // Don't allow negative percentages
    let state: ColorState = 'safe'

    if (pct >= mergedThresholds.danger) {
      state = 'danger'
    } else if (pct >= mergedThresholds.warning) {
      state = 'warning'
    }

    return { percentage: Math.min(pct, 100), colorState: state }
  }, [currentSpend, budgetLimit, mergedThresholds])

  const colorClasses = {
    safe: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-background-tertiary">
        <div
          className={cn('h-full transition-all duration-500', colorClasses[colorState])}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(percentage)}% of budget used`}
        />
      </div>
      <span className="text-xs text-foreground-secondary whitespace-nowrap">
        {formatCurrency(currentSpend)} / {formatCurrency(budgetLimit)}
      </span>
    </div>
  )
}

export type { ColorState }