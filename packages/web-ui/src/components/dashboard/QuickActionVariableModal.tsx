/**
 * QuickActionVariableModal Component
 *
 * Modal for collecting variable values when creating a task from a template
 * that has required variables. Provides a form interface for variable input
 * with validation and type-specific controls.
 *
 * @module components/dashboard/QuickActionVariableModal
 */

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import { useTemplateVariables } from '@/hooks/useQuickActionTemplates'
import { cn } from '@/lib/utils'
import type { QuickActionVariableModalProps, TemplateVariable } from '@/types/task-template'

/**
 * Modal component for variable input when creating tasks from templates
 *
 * @example
 * ```tsx
 * <QuickActionVariableModal
 *   isOpen={showModal}
 *   template={selectedTemplate}
 *   onClose={() => setShowModal(false)}
 *   onTaskCreated={(taskId) => {
 *     console.log('Task created:', taskId)
 *     setShowModal(false)
 *   }}
 *   onError={(error) => {
 *     console.error('Failed to create task:', error)
 *   }}
 * />
 * ```
 */
export function QuickActionVariableModal({
  isOpen,
  template,
  onClose,
  onTaskCreated,
  onError,
  onVariablesSubmitted,
}: QuickActionVariableModalProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    values,
    errors,
    isComplete,
    setValue,
    validate,
    interpolate,
  } = useTemplateVariables(template)

  /**
   * Handle form submission
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    // Validate all variables
    const isValid = validate()
    if (!isValid) {
      return
    }

    // If onVariablesSubmitted provided, return values instead of creating task
    if (onVariablesSubmitted) {
      try {
        const interpolatedDescription = interpolate(template.descriptionTemplate)
        const interpolatedCriteria = template.acceptanceCriteriaTemplate
          ? interpolate(template.acceptanceCriteriaTemplate)
          : undefined

        onVariablesSubmitted({
          description: interpolatedDescription,
          acceptanceCriteria: interpolatedCriteria,
          workflow: template.workflow,
          autonomy: template.autonomy,
        })
        onClose()
        return
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to interpolate template'
        setSubmitError(errorMessage)
        onError?.(error instanceof Error ? error : new Error(errorMessage))
        return
      }
    }

    // Original flow: create task directly
    try {
      setIsCreating(true)
      setSubmitError(null)

      const response = await apiClient.createTaskFromTemplate({
        templateId: template.id,
        variables: values,
      })

      onTaskCreated(response.taskId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create task'
      setSubmitError(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    } finally {
      setIsCreating(false)
    }
  }

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (!isCreating) {
      setSubmitError(null)
      onClose()
    }
  }

  /**
   * Get the preview text for the template with current variable values
   */
  const getPreviewText = () => {
    try {
      return interpolate(template.descriptionTemplate)
    } catch {
      return template.descriptionTemplate
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            Create from Template: "{template.name}"
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error display */}
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Template description */}
          {template.description && (
            <div className="text-sm text-foreground-secondary">
              {template.description}
            </div>
          )}

          {/* Variable inputs */}
          {template.variables && template.variables.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-foreground">
                Template Variables
              </div>

              {template.variables.map((variable) => (
                <VariableInput
                  key={variable.name}
                  variable={variable}
                  value={values[variable.name]}
                  error={errors[variable.name]}
                  onChange={(value) => setValue(variable.name, value)}
                  disabled={isCreating}
                />
              ))}
            </div>
          )}

          {/* Preview section */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Preview</div>
            <div className="p-3 bg-background-tertiary rounded-md border text-sm">
              {getPreviewText()}
            </div>
          </div>

          {/* Footer buttons */}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !isComplete}
              className="min-w-[120px]"
            >
              {isCreating ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Individual variable input component
 */
interface VariableInputProps {
  variable: TemplateVariable
  value: string | number | boolean | string[] | undefined
  error?: string
  onChange: (value: string | number | boolean | string[]) => void
  disabled?: boolean
}

function VariableInput({
  variable,
  value,
  error,
  onChange,
  disabled = false,
}: VariableInputProps) {
  const inputId = `variable-${variable.name}`

  /**
   * Render the appropriate input control based on variable type
   */
  const renderInput = () => {
    switch (variable.type) {
      case 'text':
        return (
          <Textarea
            id={inputId}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={variable.placeholder}
            disabled={disabled}
            className={cn(error && 'border-red-500')}
            rows={3}
          />
        )

      case 'number':
        return (
          <Input
            id={inputId}
            type="number"
            value={(value as number) || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={variable.placeholder}
            disabled={disabled}
            min={variable.min}
            max={variable.max}
            className={cn(error && 'border-red-500')}
          />
        )

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={(value as boolean) || false}
              onChange={(checked) => onChange(checked)}
              label={variable.placeholder || `Enable ${variable.label}`}
              disabled={disabled}
            />
          </div>
        )

      case 'select':
        return (
          <select
            id={inputId}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
              'w-full px-3 py-2 border rounded-md bg-background',
              'focus:outline-none focus:ring-2 focus:ring-apex-500',
              error && 'border-red-500'
            )}
          >
            <option value="">
              {variable.placeholder || `Select ${variable.label}...`}
            </option>
            {variable.options?.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'multiselect':
        // Simplified multiselect - in a real implementation, you'd want a proper multiselect component
        return (
          <div className="space-y-2">
            {variable.options?.map((option) => {
              const isSelected = Array.isArray(value) && value.includes(option.value)
              return (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    checked={isSelected}
                    onChange={(checked) => {
                      const currentValues = Array.isArray(value) ? value : []
                      if (checked) {
                        onChange([...currentValues, option.value])
                      } else {
                        onChange(currentValues.filter(v => v !== option.value))
                      }
                    }}
                    label={option.label}
                    disabled={disabled || option.disabled}
                  />
                </div>
              )
            })}
          </div>
        )

      case 'file':
      case 'directory':
      case 'string':
      default:
        return (
          <Input
            id={inputId}
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={variable.placeholder}
            disabled={disabled}
            minLength={variable.minLength}
            maxLength={variable.maxLength}
            pattern={variable.validationPattern}
            className={cn(error && 'border-red-500')}
          />
        )
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-sm font-medium">
        {variable.label}
        {variable.required && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </Label>

      {renderInput()}

      {/* Help text */}
      {variable.description && (
        <div className="text-xs text-foreground-secondary">
          {variable.description}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  )
}