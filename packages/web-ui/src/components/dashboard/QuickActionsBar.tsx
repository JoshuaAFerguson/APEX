/**
 * QuickActionsBar Component
 *
 * Main component that displays templates marked as isQuickAction=true
 * as clickable buttons for rapid task creation. Handles both direct
 * task creation (for templates without variables) and modal-based
 * variable input (for templates with required variables).
 *
 * @module components/dashboard/QuickActionsBar
 */

import React, { useState, useCallback } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { QuickActionButton } from './QuickActionButton'
import { QuickActionVariableModal } from './QuickActionVariableModal'
import { useQuickActionTemplates } from '@/hooks/useQuickActionTemplates'
import { cn } from '@/lib/utils'
import type { QuickActionsBarProps, TaskTemplate } from '@/types/task-template'

/**
 * QuickActionsBar component for rapid task creation from templates
 *
 * @example
 * ```tsx
 * <QuickActionsBar
 *   onTaskCreated={(taskId, templateId) => {
 *     console.log(`Task ${taskId} created from template ${templateId}`)
 *     router.push(`/tasks/${taskId}`)
 *   }}
 *   onError={(error, templateId) => {
 *     console.error(`Failed to create task from template ${templateId}:`, error)
 *     toast.error(error.message)
 *   }}
 *   maxActions={6}
 *   compact={false}
 *   className="mb-8"
 * />
 * ```
 */
export function QuickActionsBar({
  onTaskCreated,
  onError,
  maxActions = 8,
  showIcons = true,
  compact = false,
  className,
}: QuickActionsBarProps) {
  const {
    templates,
    isLoading,
    error,
    refresh,
    createTaskFromTemplate,
    hasRequiredVariables,
  } = useQuickActionTemplates()

  const [creatingTaskForTemplate, setCreatingTaskForTemplate] = useState<string | null>(null)
  const [modalTemplate, setModalTemplate] = useState<TaskTemplate | null>(null)

  /**
   * Handle quick action button click
   */
  const handleQuickAction = useCallback(async (template: TaskTemplate) => {
    try {
      if (hasRequiredVariables(template)) {
        // Open modal for variable input
        setModalTemplate(template)
      } else {
        // Create task directly (no variables required)
        setCreatingTaskForTemplate(template.id)
        const taskId = await createTaskFromTemplate(template)
        onTaskCreated?.(taskId, template.id)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to create task')
      onError?.(err, template.id)
    } finally {
      setCreatingTaskForTemplate(null)
    }
  }, [hasRequiredVariables, createTaskFromTemplate, onTaskCreated, onError])

  /**
   * Handle task creation from modal
   */
  const handleModalTaskCreated = useCallback((taskId: string) => {
    if (modalTemplate) {
      onTaskCreated?.(taskId, modalTemplate.id)
    }
    setModalTemplate(null)
  }, [modalTemplate, onTaskCreated])

  /**
   * Handle modal error
   */
  const handleModalError = useCallback((error: Error) => {
    if (modalTemplate) {
      onError?.(error, modalTemplate.id)
    }
  }, [modalTemplate, onError])

  /**
   * Close modal
   */
  const handleModalClose = useCallback(() => {
    setModalTemplate(null)
  }, [])

  // Limit the number of displayed actions
  const displayedTemplates = templates.slice(0, maxActions)

  // Show loading state
  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className={compact ? 'pb-3' : undefined}>
          <h3 className={cn(
            'font-semibold flex items-center gap-2',
            compact ? 'text-base' : 'text-lg'
          )}>
            <span>⚡</span>
            Quick Actions
          </h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
            <span className="ml-2 text-foreground-secondary">Loading quick actions...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show error state
  if (error) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className={compact ? 'pb-3' : undefined}>
          <h3 className={cn(
            'font-semibold flex items-center gap-2',
            compact ? 'text-base' : 'text-lg'
          )}>
            <span>⚡</span>
            Quick Actions
          </h3>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load quick actions: {error}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={refresh}
                className="ml-4 flex-shrink-0"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // Show empty state
  if (displayedTemplates.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className={compact ? 'pb-3' : undefined}>
          <h3 className={cn(
            'font-semibold flex items-center gap-2',
            compact ? 'text-base' : 'text-lg'
          )}>
            <span>⚡</span>
            Quick Actions
          </h3>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-4xl mb-4 opacity-50">📋</div>
            <div className="text-foreground-secondary">
              No quick actions available. Create templates with "Quick Action" enabled to see them here.
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Main render with quick action buttons
  return (
    <>
      <Card className={cn('w-full', className)}>
        <CardHeader className={cn('flex flex-row items-center justify-between', compact ? 'pb-3' : undefined)}>
          <h3 className={cn(
            'font-semibold flex items-center gap-2',
            compact ? 'text-base' : 'text-lg'
          )}>
            <span>⚡</span>
            Quick Actions
          </h3>
          {templates.length > maxActions && (
            <div className="text-sm text-foreground-secondary">
              Showing {maxActions} of {templates.length}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Quick action buttons grid */}
          <div className={cn(
            'grid gap-3',
            // Responsive grid based on compact mode and screen size
            compact
              ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          )}>
            {displayedTemplates.map((template) => (
              <QuickActionButton
                key={template.id}
                template={template}
                onClick={handleQuickAction}
                loading={creatingTaskForTemplate === template.id}
                showIcon={showIcons}
                compact={compact}
              />
            ))}
          </div>

          {/* Show more templates hint */}
          {templates.length > maxActions && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <span className="text-sm text-foreground-secondary">
                  {templates.length - maxActions} more quick actions available in templates
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variable input modal */}
      {modalTemplate && (
        <QuickActionVariableModal
          isOpen={true}
          template={modalTemplate}
          onClose={handleModalClose}
          onTaskCreated={handleModalTaskCreated}
          onError={handleModalError}
        />
      )}
    </>
  )
}