/**
 * QuickActionButton Component
 *
 * Renders a single quick action button within the QuickActionsBar.
 * Displays template information as a clickable button with category styling.
 *
 * @module components/dashboard/QuickActionButton
 */

import React from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { TEMPLATE_CATEGORY_CONFIG } from '@/types/task-template'
import { cn } from '@/lib/utils'
import type { QuickActionButtonProps } from '@/types/task-template'

/**
 * Individual quick action button component
 *
 * @example
 * ```tsx
 * <QuickActionButton
 *   template={template}
 *   onClick={(template) => handleTemplateClick(template)}
 *   loading={isCreating}
 *   showIcon={true}
 *   compact={false}
 * />
 * ```
 */
export function QuickActionButton({
  template,
  onClick,
  loading = false,
  showIcon = true,
  compact = false,
  className,
}: QuickActionButtonProps) {
  const categoryConfig = TEMPLATE_CATEGORY_CONFIG[template.category] || TEMPLATE_CATEGORY_CONFIG.custom

  const handleClick = () => {
    if (!loading) {
      onClick(template)
    }
  }

  return (
    <Button
      variant="ghost"
      size={compact ? "sm" : "md"}
      className={cn(
        'flex items-center gap-2 h-auto',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        'border border-border hover:border-apex-500/50',
        'hover:bg-background-tertiary transition-all duration-200',
        'text-left justify-start min-w-0',
        loading && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={handleClick}
      disabled={loading}
      aria-label={`Create ${template.name} task`}
      title={template.description}
    >
      {/* Loading spinner */}
      {loading && (
        <Spinner size="sm" className="flex-shrink-0" />
      )}

      {/* Template icon (when not loading) */}
      {!loading && showIcon && (
        <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {/* Icon placeholder - could be enhanced with actual icon support */}
          <div
            className={cn(
              'w-3 h-3 rounded-full',
              'bg-current opacity-60'
            )}
            style={{ color: getCategoryColor(template.category) }}
          />
        </div>
      )}

      {/* Template content */}
      <div className="flex flex-col min-w-0 flex-1">
        {/* Template name */}
        <div className={cn(
          'font-medium text-foreground truncate',
          compact ? 'text-sm' : 'text-base'
        )}>
          {template.name}
        </div>

        {/* Category badge and description */}
        {!compact && (
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="default"
              className={cn(
                'text-xs flex-shrink-0',
                getCategoryBadgeClasses(template.category)
              )}
            >
              {categoryConfig.label}
            </Badge>
            {template.description && (
              <span className="text-xs text-foreground-secondary truncate">
                {template.description}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Quick indicator for templates with variables */}
      {template.variables && template.variables.some(v => v.required) && (
        <div className="flex-shrink-0">
          <div
            className="text-xs text-foreground-secondary"
            title="Requires input"
            aria-label="This template requires variable input"
          >
            •••
          </div>
        </div>
      )}
    </Button>
  )
}

/**
 * Get the color for a template category
 */
function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    feature: '#10b981',    // green
    bugfix: '#ef4444',     // red
    refactoring: '#3b82f6', // blue
    testing: '#8b5cf6',    // purple
    documentation: '#f59e0b', // orange
    maintenance: '#6b7280', // gray
    deployment: '#06b6d4',  // cyan
    custom: '#eab308',     // yellow
  }
  return colorMap[category] || colorMap.custom
}

/**
 * Get category-specific badge classes
 */
function getCategoryBadgeClasses(category: string): string {
  const classMap: Record<string, string> = {
    feature: 'bg-green-100 text-green-700 border-green-300',
    bugfix: 'bg-red-100 text-red-700 border-red-300',
    refactoring: 'bg-blue-100 text-blue-700 border-blue-300',
    testing: 'bg-purple-100 text-purple-700 border-purple-300',
    documentation: 'bg-orange-100 text-orange-700 border-orange-300',
    maintenance: 'bg-gray-100 text-gray-700 border-gray-300',
    deployment: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    custom: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  }
  return classMap[category] || classMap.custom
}