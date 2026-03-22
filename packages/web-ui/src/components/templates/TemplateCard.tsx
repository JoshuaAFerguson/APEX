'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { TaskTemplate, TemplateCategory } from '@/types/task-template'
import { TEMPLATE_CATEGORY_CONFIG } from '@/types/task-template'
import {
  FileText,
  Plus,
  Bug,
  RotateCcw,
  Check,
  BookOpen,
  Wrench,
  Rocket,
  Star
} from 'lucide-react'

export interface TemplateCardProps {
  /** Template to display */
  template: TaskTemplate

  /** Whether this card is selected */
  isSelected?: boolean

  /** Callback when card is clicked */
  onClick: (template: TaskTemplate) => void

  /** Callback when card is double-clicked (quick select) */
  onDoubleClick?: (template: TaskTemplate) => void

  /** Compact mode */
  compact?: boolean

  /** Tab index for keyboard navigation */
  tabIndex?: number

  /** Custom data attributes */
  'data-template-card'?: boolean

  className?: string
}

/**
 * Icon mapping for template categories
 */
const getCategoryIcon = (category: TemplateCategory) => {
  const iconMap = {
    feature: Plus,
    bugfix: Bug,
    refactoring: RotateCcw,
    testing: Check,
    documentation: BookOpen,
    maintenance: Wrench,
    deployment: Rocket,
    custom: Star
  }
  return iconMap[category] || FileText
}

/**
 * Get category badge styling based on category
 */
const getCategoryBadgeClasses = (category: TemplateCategory): string => {
  const config = TEMPLATE_CATEGORY_CONFIG[category]

  // Map color names to Tailwind classes
  const colorMap = {
    green: 'bg-green-100 text-green-700 border-green-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200'
  }

  return colorMap[config?.color as keyof typeof colorMap] || 'bg-gray-100 text-gray-700 border-gray-200'
}

/**
 * Card component for displaying a template in the template selection modal
 */
export function TemplateCard({
  template,
  isSelected = false,
  onClick,
  onDoubleClick,
  compact = false,
  tabIndex,
  'data-template-card': dataTemplateCard,
  className
}: TemplateCardProps) {
  const Icon = getCategoryIcon(template.category)
  const categoryConfig = TEMPLATE_CATEGORY_CONFIG[template.category]

  const handleClick = () => {
    onClick(template)
  }

  const handleDoubleClick = () => {
    onDoubleClick?.(template)
  }

  // Limit tags displayed to avoid overflow
  const maxTags = compact ? 2 : 3
  const displayTags = template.tags.slice(0, maxTags)
  const hiddenTagCount = Math.max(0, template.tags.length - maxTags)

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md group',
        isSelected && 'ring-2 ring-apex-500 bg-background-tertiary',
        !isSelected && 'hover:border-border-secondary',
        compact && 'py-2',
        className
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <CardContent className={cn('p-4', compact && 'p-3')}>
        <div className="space-y-3">
          {/* Header: Icon + Name */}
          <div className="flex items-start gap-3">
            {/* Category Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <Icon className={cn(
                'w-5 h-5',
                compact && 'w-4 h-4'
              )} />
            </div>

            {/* Template Name */}
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                'font-semibold text-foreground truncate',
                compact ? 'text-sm' : 'text-base'
              )}>
                {template.name}
              </h3>
            </div>
          </div>

          {/* Category and Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Badge */}
            <Badge
              variant="default"
              className={cn(
                'text-xs border',
                getCategoryBadgeClasses(template.category)
              )}
            >
              {categoryConfig?.label || template.category}
            </Badge>

            {/* Tags */}
            {displayTags.map(tag => (
              <Badge
                key={tag}
                variant="default"
                className="text-xs text-foreground-secondary bg-transparent border-border"
              >
                {tag}
              </Badge>
            ))}

            {/* Hidden tag count indicator */}
            {hiddenTagCount > 0 && (
              <Badge
                variant="default"
                className="text-xs text-foreground-secondary bg-transparent border-border"
              >
                +{hiddenTagCount}
              </Badge>
            )}
          </div>

          {/* Description */}
          <div className={cn(
            'text-sm text-foreground-secondary leading-relaxed',
            compact && 'text-xs'
          )}>
            <p className="line-clamp-2">
              {template.description}
            </p>
          </div>

          {/* Footer: Metadata */}
          {!compact && (
            <div className="flex items-center justify-between text-xs text-foreground-secondary pt-1 border-t border-border">
              <div className="flex items-center gap-3">
                {/* Workflow */}
                <span className="capitalize">
                  {template.workflow}
                </span>

                {/* Autonomy */}
                <span className="capitalize">
                  {template.autonomy.replace('-', ' ')}
                </span>
              </div>

              {/* Usage count (if available) */}
              {typeof template.usageCount === 'number' && (
                <span>
                  Used {template.usageCount} times
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}