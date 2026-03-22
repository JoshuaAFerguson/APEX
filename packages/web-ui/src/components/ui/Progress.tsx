/**
 * Progress Component
 *
 * A progress bar component for displaying task completion status.
 * This is a wrapper around ProgressIndicator for backward compatibility.
 */

import React, { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Progress value between 0 and 100 */
  value?: number
  /** Whether to show an indeterminate/animated progress bar for running tasks */
  indeterminate?: boolean
  /** Size of the progress bar */
  size?: 'sm' | 'md' | 'lg'
  /** Color variant */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  /** Custom class for the progress indicator (fill) */
  indicatorClassName?: string
}

/**
 * Progress bar component for showing task completion status
 * Supports both determinate progress (with value) and indeterminate animation for running tasks
 */
const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indeterminate = false, size = 'md', variant = 'default', indicatorClassName, ...props }, ref) => {
    // Ensure value is between 0 and 100
    const clampedValue = Math.max(0, Math.min(100, value))

    const sizeStyles = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    }

    const variantStyles = {
      default: 'bg-background-tertiary',
      success: 'bg-green-950/30',
      warning: 'bg-yellow-950/30',
      error: 'bg-red-950/30',
      info: 'bg-apex-950/30',
    }

    const fillStyles = {
      default: 'bg-foreground-secondary',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500',
      info: 'bg-apex-500',
    }

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          'relative rounded-full overflow-hidden',
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            fillStyles[variant],
            indeterminate && 'animate-pulse',
            indicatorClassName
          )}
          style={{
            width: indeterminate ? '100%' : `${clampedValue}%`,
          }}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
