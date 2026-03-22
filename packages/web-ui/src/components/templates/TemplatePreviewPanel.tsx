'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert, AlertDescription } from '@/components/ui/Alert'
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
  Star,
  Settings,
  Users,
  Clock,
  Tag,
  FileCheck,
  AlertCircle
} from 'lucide-react'

export interface TemplatePreviewPanelProps {
  /** Template to preview (null when none selected) */
  template: TaskTemplate | null

  /** Loading state */
  isLoading?: boolean

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
 * Get autonomy level display info
 */
const getAutonomyInfo = (autonomy: string) => {
  const autonomyMap = {
    'full-auto': {
      label: 'Full Auto',
      description: 'Executes automatically without human review',
      color: 'bg-green-100 text-green-700 border-green-200'
    },
    'review-before-commit': {
      label: 'Review Before Commit',
      description: 'Requires approval before committing changes',
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200'
    },
    'review-all': {
      label: 'Review All',
      description: 'Requires approval for all actions',
      color: 'bg-red-100 text-red-700 border-red-200'
    }
  }
  return autonomyMap[autonomy as keyof typeof autonomyMap] || {
    label: autonomy,
    description: 'Unknown autonomy level',
    color: 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

/**
 * Get priority display info
 */
const getPriorityInfo = (priority: string) => {
  const priorityMap = {
    'lowest': { label: 'Lowest', color: 'text-gray-500' },
    'low': { label: 'Low', color: 'text-blue-500' },
    'normal': { label: 'Normal', color: 'text-green-500' },
    'high': { label: 'High', color: 'text-orange-500' },
    'critical': { label: 'Critical', color: 'text-red-500' }
  }
  return priorityMap[priority as keyof typeof priorityMap] || {
    label: priority,
    color: 'text-gray-500'
  }
}

/**
 * Get effort display info
 */
const getEffortInfo = (effort: string) => {
  const effortMap = {
    'trivial': { label: 'Trivial', description: 'Less than 1 hour' },
    'small': { label: 'Small', description: '1-4 hours' },
    'medium': { label: 'Medium', description: '1-3 days' },
    'large': { label: 'Large', description: '1-2 weeks' },
    'epic': { label: 'Epic', description: 'More than 2 weeks' }
  }
  return effortMap[effort as keyof typeof effortMap] || {
    label: effort,
    description: 'Unknown effort level'
  }
}

/**
 * Panel for displaying detailed template preview
 */
export function TemplatePreviewPanel({
  template,
  isLoading = false,
  className
}: TemplatePreviewPanelProps) {
  // Loading state
  if (isLoading) {
    return (
      <Card className={cn('h-full flex items-center justify-center', className)}>
        <CardContent>
          <div className="flex items-center gap-2 text-foreground-secondary">
            <div className="w-4 h-4 border-2 border-border border-t-apex-500 rounded-full animate-spin" />
            Loading template...
          </div>
        </CardContent>
      </Card>
    )
  }

  // No template selected
  if (!template) {
    return (
      <Card className={cn('h-full flex items-center justify-center', className)}>
        <CardContent>
          <div className="text-center text-foreground-secondary space-y-2">
            <FileText className="w-12 h-12 mx-auto opacity-50" />
            <p className="text-sm">Select a template to view details</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const Icon = getCategoryIcon(template.category)
  const categoryConfig = TEMPLATE_CATEGORY_CONFIG[template.category]
  const autonomyInfo = getAutonomyInfo(template.autonomy)
  const priorityInfo = getPriorityInfo(template.priority)
  const effortInfo = getEffortInfo(template.effort)

  // Check if template has required variables
  const hasRequiredVariables = template.variables?.some(v => v.required)

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <Icon className="w-6 h-6 mt-0.5 text-foreground-secondary" />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold leading-6">
              {template.name}
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="default"
                className="text-xs"
              >
                {categoryConfig?.label || template.category}
              </Badge>
              {template.isQuickAction && (
                <Badge variant="default" className="text-xs bg-transparent border-border">
                  Quick Action
                </Badge>
              )}
              {template.archived && (
                <Badge variant="warning" className="text-xs">
                  Archived
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Description */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Description</h4>
          <p className="text-sm text-foreground-secondary leading-relaxed">
            {template.description}
          </p>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
              <Settings className="w-4 h-4" />
              Workflow
            </h4>
            <p className="text-sm text-foreground-secondary capitalize">
              {template.workflow}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
              <Users className="w-4 h-4" />
              Autonomy
            </h4>
            <div className="space-y-1">
              <Badge
                variant="default"
                className={cn('text-xs border', autonomyInfo.color)}
              >
                {autonomyInfo.label}
              </Badge>
              <p className="text-xs text-foreground-secondary">
                {autonomyInfo.description}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Priority
            </h4>
            <p className={cn('text-sm font-medium', priorityInfo.color)}>
              {priorityInfo.label}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Effort
            </h4>
            <div className="space-y-1">
              <p className="text-sm text-foreground-secondary">
                {effortInfo.label}
              </p>
              <p className="text-xs text-foreground-secondary">
                {effortInfo.description}
              </p>
            </div>
          </div>
        </div>

        {/* Tags */}
        {template.tags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
              <Tag className="w-4 h-4" />
              Tags
            </h4>
            <div className="flex flex-wrap gap-2">
              {template.tags.map(tag => (
                <Badge
                  key={tag}
                  variant="default"
                  className="text-xs bg-transparent border-border"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Variables */}
        {template.variables && template.variables.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
              <FileCheck className="w-4 h-4" />
              Variables ({template.variables.length})
            </h4>
            <div className="space-y-2">
              {template.variables.map(variable => (
                <div
                  key={variable.name}
                  className="flex items-center justify-between p-2 bg-background-tertiary rounded-md"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {variable.label}
                      </span>
                      {variable.required && (
                        <Badge variant="error" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-foreground-secondary">
                      {variable.type} • {variable.description || 'No description'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Required Variables Warning */}
        {hasRequiredVariables && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700">
              This template has required variables. You'll be prompted to fill them in before creating the task.
            </AlertDescription>
          </Alert>
        )}

        {/* Usage Stats */}
        {typeof template.usageCount === 'number' && (
          <div className="text-xs text-foreground-secondary pt-2 border-t border-border">
            Used {template.usageCount} time{template.usageCount !== 1 ? 's' : ''}
            {template.createdAt && (
              <span className="ml-2">
                • Created {new Date(template.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}