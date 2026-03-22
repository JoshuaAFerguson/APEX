'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import type { TemplateCategory } from '@/types/task-template'
import { TEMPLATE_CATEGORY_CONFIG } from '@/types/task-template'
import {
  Plus,
  Bug,
  RefreshCw,
  CheckCircle,
  BookOpen,
  Wrench,
  Rocket,
  Star,
  Filter,
} from 'lucide-react'

/**
 * Filter type including 'all' option
 */
export type TemplateCategoryFilterType = 'all' | TemplateCategory

/**
 * Props for TemplateCategoryFilter component
 */
export interface TemplateCategoryFilterProps {
  /** Currently selected category */
  selectedCategory: TemplateCategoryFilterType

  /** Category counts for badges */
  categoryCounts: Record<TemplateCategoryFilterType, number>

  /** Callback when category changes */
  onCategoryChange: (category: TemplateCategoryFilterType) => void

  /** Hide categories with zero count */
  hideEmpty?: boolean

  /** Compact mode for smaller screens */
  compact?: boolean

  className?: string
}

/**
 * Category icon mapping
 */
const CATEGORY_ICONS: Record<TemplateCategoryFilterType, React.ComponentType<any>> = {
  all: Filter,
  feature: Plus,
  bugfix: Bug,
  refactoring: RefreshCw,
  testing: CheckCircle,
  documentation: BookOpen,
  maintenance: Wrench,
  deployment: Rocket,
  custom: Star,
}

/**
 * Category color mapping for selected state
 */
const CATEGORY_COLORS: Record<TemplateCategoryFilterType, {
  selected: string
  hover: string
  border: string
}> = {
  all: {
    selected: 'bg-apex-500/20 text-apex-300 border-apex-500/40',
    hover: 'hover:bg-apex-500/30',
    border: 'border-apex-500/40'
  },
  feature: {
    selected: 'bg-green-500/20 text-green-300 border-green-500/40',
    hover: 'hover:bg-green-500/30',
    border: 'border-green-500/40'
  },
  bugfix: {
    selected: 'bg-red-500/20 text-red-300 border-red-500/40',
    hover: 'hover:bg-red-500/30',
    border: 'border-red-500/40'
  },
  refactoring: {
    selected: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    hover: 'hover:bg-blue-500/30',
    border: 'border-blue-500/40'
  },
  testing: {
    selected: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    hover: 'hover:bg-purple-500/30',
    border: 'border-purple-500/40'
  },
  documentation: {
    selected: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    hover: 'hover:bg-orange-500/30',
    border: 'border-orange-500/40'
  },
  maintenance: {
    selected: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
    hover: 'hover:bg-gray-500/30',
    border: 'border-gray-500/40'
  },
  deployment: {
    selected: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    hover: 'hover:bg-cyan-500/30',
    border: 'border-cyan-500/40'
  },
  custom: {
    selected: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    hover: 'hover:bg-yellow-500/30',
    border: 'border-yellow-500/40'
  },
}

/**
 * TemplateCategoryFilter - Category filter chip bar component
 *
 * Provides a horizontal bar of category filter chips for template filtering.
 * Each chip shows the category icon, label, and count badge.
 *
 * @example
 * ```tsx
 * <TemplateCategoryFilter
 *   selectedCategory={selectedCategory}
 *   categoryCounts={categoryCounts}
 *   onCategoryChange={setSelectedCategory}
 *   hideEmpty
 * />
 * ```
 */
export function TemplateCategoryFilter({
  selectedCategory,
  categoryCounts,
  onCategoryChange,
  hideEmpty = false,
  compact = false,
  className
}: TemplateCategoryFilterProps) {
  // Get available categories, optionally hiding empty ones
  const availableCategories = Object.entries(CATEGORY_ICONS).filter(([type, _]) => {
    if (!hideEmpty) return true
    const categoryType = type as TemplateCategoryFilterType
    return (categoryCounts[categoryType] || 0) > 0
  })

  // Get category label
  const getCategoryLabel = (category: TemplateCategoryFilterType): string => {
    if (category === 'all') return 'All'
    return TEMPLATE_CATEGORY_CONFIG[category].label
  }

  // Get category description
  const getCategoryDescription = (category: TemplateCategoryFilterType): string => {
    if (category === 'all') return 'All templates'
    return `${TEMPLATE_CATEGORY_CONFIG[category].label} templates`
  }

  return (
    <div className={cn(
      'flex flex-wrap gap-1.5',
      compact && 'gap-1',
      className
    )}>
      {availableCategories.map(([type, Icon]) => {
        const categoryType = type as TemplateCategoryFilterType
        const count = categoryCounts[categoryType] || 0
        const isSelected = selectedCategory === categoryType
        const label = getCategoryLabel(categoryType)
        const description = getCategoryDescription(categoryType)
        const colors = CATEGORY_COLORS[categoryType]

        return (
          <button
            key={categoryType}
            onClick={() => onCategoryChange(categoryType)}
            title={description}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
              'transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-apex-500/30',
              'hover:bg-background-tertiary/50 active:scale-95',
              compact && 'px-2 py-1 gap-1 text-xs',
              isSelected
                ? [colors.selected, colors.hover, 'shadow-sm']
                : [
                    'text-foreground-secondary border-border',
                    'hover:text-foreground hover:border-border-emphasis'
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
              {label}
            </span>

            {/* Count badge */}
            {count > 0 && (
              <span className={cn(
                'flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium min-w-[1.25rem] text-center leading-none',
                compact && 'px-1 py-0.5 text-xs min-w-[1rem]',
                isSelected
                  ? 'bg-white/20 text-current'
                  : 'bg-background-tertiary text-foreground-secondary'
              )}>
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        )
      })}

      {/* Show message if no categories available */}
      {availableCategories.length === 0 && hideEmpty && (
        <div className="text-sm text-foreground-tertiary py-1">
          No templates to filter
        </div>
      )}
    </div>
  )
}