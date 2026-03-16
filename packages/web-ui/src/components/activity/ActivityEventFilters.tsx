'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import type { ActivityEventCategory } from '@/types/dashboard'
import {
  Activity,
  Bot,
  Wrench,
  ShieldCheck,
  Lock,
  Info,
  AlertCircle,
  Filter,
} from 'lucide-react'

/**
 * Filter type including 'all' option
 */
export type ActivityFilterType = 'all' | ActivityEventCategory

/**
 * Props for ActivityEventFilters component
 */
export interface ActivityEventFiltersProps {
  /** Current selected filter */
  selectedFilter: ActivityFilterType

  /** Available filter counts */
  filterCounts: Record<ActivityFilterType, number>

  /** Callback when filter changes */
  onFilterChange: (filter: ActivityFilterType) => void

  /** Whether to show count badges */
  showCounts?: boolean

  /** Whether to hide filters with zero counts */
  hideEmpty?: boolean

  /** Compact mode for smaller displays */
  compact?: boolean

  /** Custom className */
  className?: string
}

/**
 * Filter configuration with icons and labels
 */
const FILTER_CONFIG: Record<ActivityFilterType, {
  label: string
  icon: React.ComponentType<any>
  description: string
}> = {
  all: {
    label: 'All',
    icon: Filter,
    description: 'All events',
  },
  task: {
    label: 'Tasks',
    icon: Activity,
    description: 'Task lifecycle events',
  },
  agent: {
    label: 'Agents',
    icon: Bot,
    description: 'Agent execution events',
  },
  tool: {
    label: 'Tools',
    icon: Wrench,
    description: 'Tool usage events',
  },
  gate: {
    label: 'Gates',
    icon: ShieldCheck,
    description: 'Approval gate events',
  },
  permission: {
    label: 'Permissions',
    icon: Lock,
    description: 'Permission and security events',
  },
  system: {
    label: 'System',
    icon: Info,
    description: 'System and connection events',
  },
  error: {
    label: 'Errors',
    icon: AlertCircle,
    description: 'Error and failure events',
  },
}

/**
 * ActivityEventFilters - Filter chip bar component
 *
 * Provides a horizontal bar of filter chips for activity event categories.
 * Each chip shows the category icon, label, and optional count badge.
 *
 * @example
 * ```tsx
 * <ActivityEventFilters
 *   selectedFilter={selectedFilter}
 *   filterCounts={filterCounts}
 *   onFilterChange={setSelectedFilter}
 *   showCounts
 * />
 * ```
 */
export const ActivityEventFilters: React.FC<ActivityEventFiltersProps> = ({
  selectedFilter,
  filterCounts,
  onFilterChange,
  showCounts = true,
  hideEmpty = false,
  compact = false,
  className,
}) => {
  // Get available filters, optionally hiding empty ones
  const availableFilters = Object.entries(FILTER_CONFIG).filter(([type, _]) => {
    if (!hideEmpty) return true
    const filterType = type as ActivityFilterType
    return (filterCounts[filterType] || 0) > 0
  })

  return (
    <div className={cn(
      'flex flex-wrap gap-1.5',
      compact && 'gap-1',
      className
    )}>
      {availableFilters.map(([type, config]) => {
        const filterType = type as ActivityFilterType
        const count = filterCounts[filterType] || 0
        const isSelected = selectedFilter === filterType
        const Icon = config.icon

        return (
          <button
            key={filterType}
            onClick={() => onFilterChange(filterType)}
            title={config.description}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
              'transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-apex-500/30',
              'hover:bg-background-tertiary/50 active:scale-95',
              compact && 'px-2 py-1 gap-1 text-xs',
              isSelected
                ? [
                    // Selected state styling
                    'bg-apex-500/20 text-apex-300 border-apex-500/40',
                    'hover:bg-apex-500/30 shadow-sm',
                    // Special styling for error filter when selected
                    filterType === 'error' && 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30',
                  ]
                : [
                    // Unselected state styling
                    'text-foreground-secondary border-border',
                    'hover:text-foreground hover:border-border-emphasis',
                    // Special styling for error filter when not selected
                    filterType === 'error' && count > 0 && 'text-red-400 hover:text-red-300',
                  ]
            )}
          >
            {/* Icon */}
            <Icon className={cn(
              'flex-shrink-0',
              compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
            )} />

            {/* Label */}
            <span className="whitespace-nowrap">
              {config.label}
            </span>

            {/* Count badge */}
            {showCounts && count > 0 && (
              <span className={cn(
                'flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium min-w-[1.25rem] text-center leading-none',
                compact && 'px-1 py-0.5 text-xs min-w-[1rem]',
                isSelected
                  ? [
                      // Selected badge styling
                      'bg-apex-400/30 text-apex-200',
                      filterType === 'error' && 'bg-red-400/30 text-red-200',
                    ]
                  : [
                      // Unselected badge styling
                      'bg-background-tertiary text-foreground-secondary',
                      filterType === 'error' && count > 0 && 'bg-red-500/20 text-red-300',
                    ]
              )}>
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        )
      })}

      {/* Show message if no filters available */}
      {availableFilters.length === 0 && hideEmpty && (
        <div className="text-sm text-foreground-tertiary py-1">
          No events to filter
        </div>
      )}
    </div>
  )
}

/**
 * Helper function to calculate filter counts from events
 */
export function calculateFilterCounts(
  events: Array<{ category: ActivityEventCategory }>
): Record<ActivityFilterType, number> {
  const counts: Record<ActivityFilterType, number> = {
    all: events.length,
    task: 0,
    agent: 0,
    tool: 0,
    gate: 0,
    permission: 0,
    system: 0,
    error: 0,
  }

  events.forEach(event => {
    const category = event.category
    if (category in counts) {
      counts[category]++
    }
  })

  return counts
}

export default ActivityEventFilters