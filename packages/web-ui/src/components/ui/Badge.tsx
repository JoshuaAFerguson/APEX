import { HTMLAttributes, forwardRef } from 'react'
import { cn, getStatusVariant, formatStatus } from '@/lib/utils'
import type { TaskStatus } from '@apex/core'

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  status?: TaskStatus
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', status, children, ...props }, ref) => {
    // If status is provided, derive variant from it
    const derivedVariant = status ? getStatusVariant(status) : variant

    const variantStyles = {
      default: 'bg-background-tertiary text-foreground-secondary border-border-secondary',
      success: 'bg-green-950/50 text-green-400 border-green-900',
      warning: 'bg-yellow-950/50 text-yellow-400 border-yellow-900',
      error: 'bg-red-950/50 text-red-400 border-red-900',
      info: 'bg-apex-950/50 text-apex-400 border-apex-900',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
          variantStyles[derivedVariant],
          className
        )}
        {...props}
      >
        {children || (status && formatStatus(status))}
      </div>
    )
  }
)
Badge.displayName = 'Badge'

export { Badge }
