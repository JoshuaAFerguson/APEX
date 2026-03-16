'use client'

import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { FormField } from './FormField'
import { Input } from '../ui/Input'
import { Select, type SelectOption } from '../ui/Select'
import { MultiSelect, type MultiSelectOption } from '../ui/MultiSelect'
import { Button } from '../ui/Button'
import {
  type AgentFormData,
  type AgentModelOption,
  AGENT_MODEL_OPTIONS,
  AGENT_VALIDATION_LIMITS,
  validateAgentForm,
  getFormErrors,
} from '@/lib/schemas/agent-schema'

/**
 * Properties for the AgentForm component
 */
export interface AgentFormProps {
  /** Initial data for edit mode - if provided, form is in edit mode */
  initialData?: AgentFormData
  /** Callback when form is successfully submitted with validated data */
  onSubmit: (data: AgentFormData) => void | Promise<void>
  /** Callback when form is cancelled */
  onCancel: () => void
  /** Available tools for selection */
  availableTools?: MultiSelectOption[]
  /** Available skills for selection */
  availableSkills?: MultiSelectOption[]
  /** Whether form is in loading/submitting state */
  isSubmitting?: boolean
  /** Additional CSS class names */
  className?: string
}

/**
 * Get default form data values
 */
function getDefaultFormData(): AgentFormData {
  return {
    name: '',
    description: '',
    prompt: '',
    model: 'sonnet',
    tools: [],
    skills: [],
  }
}

/**
 * AgentForm component for creating and editing agent definitions
 *
 * Features:
 * - All 6 agent fields with proper validation
 * - Real-time validation with inline errors
 * - Create and edit modes via optional initialData
 * - Character counters for textareas
 * - Accessible form controls
 */
export function AgentForm({
  initialData,
  onSubmit,
  onCancel,
  availableTools = [],
  availableSkills = [],
  isSubmitting = false,
  className,
}: AgentFormProps) {
  // Form state
  const [formData, setFormData] = useState<AgentFormData>(
    initialData ?? getDefaultFormData()
  )

  // Validation errors state
  const [errors, setErrors] = useState<Partial<Record<keyof AgentFormData, string>>>({})

  // Touched fields for on-blur validation
  const [touchedFields, setTouchedFields] = useState<Set<keyof AgentFormData>>(new Set())

  // Model options for the Select component
  const modelOptions: SelectOption[] = AGENT_MODEL_OPTIONS.map((model) => ({
    value: model,
    label: model.charAt(0).toUpperCase() + model.slice(1),
    description: model === 'inherit' ? 'Use system default model' : `Use ${model} model`,
  }))

  // Individual field validation using the zod schema
  const validateField = useCallback((field: keyof AgentFormData, value: any): string | undefined => {
    try {
      // Create partial data with only this field for validation
      const testData = { ...formData, [field]: value }
      const result = validateAgentForm(testData)

      if (!result.success) {
        const fieldErrors = getFormErrors(result.error)
        return fieldErrors[field]
      }

      return undefined
    } catch (error) {
      // Fallback error message
      return 'Invalid value'
    }
  }, [formData])

  // Handle field changes with validation
  const handleFieldChange = useCallback((field: keyof AgentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Clear previous errors for this field
    setErrors(prev => ({ ...prev, [field]: undefined }))

    // Validate field immediately if it's been touched
    if (touchedFields.has(field)) {
      const error = validateField(field, value)
      if (error) {
        setErrors(prev => ({ ...prev, [field]: error }))
      }
    }
  }, [touchedFields, validateField])

  // Handle field blur (mark as touched and validate)
  const handleFieldBlur = useCallback((field: keyof AgentFormData) => {
    setTouchedFields(prev => new Set([...prev, field]))

    // Validate field on blur
    const value = formData[field]
    const error = validateField(field, value)
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }))
    }
  }, [formData, validateField])

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    // Mark all fields as touched
    setTouchedFields(new Set(['name', 'description', 'prompt', 'model', 'tools', 'skills']))

    // Validate entire form
    const result = validateAgentForm(formData)

    if (!result.success) {
      const formErrors = getFormErrors(result.error)
      setErrors(formErrors)
      return
    }

    // Clear any previous errors
    setErrors({})

    // Submit validated data
    try {
      await onSubmit(result.data)
    } catch (error) {
      // Let parent handle submission errors
      console.error('Form submission error:', error)
    }
  }, [formData, onSubmit])

  // Check if form is valid (for submit button state)
  const isFormValid = validateAgentForm(formData).success

  // Character counter helper
  const getCharacterCount = (text: string, maxLength: number) => (
    <span className={cn(
      'text-xs text-muted-foreground',
      text.length > maxLength * 0.9 && 'text-amber-600',
      text.length > maxLength && 'text-red-600'
    )}>
      {text.length}/{maxLength}
    </span>
  )

  return (
    <div className={cn('space-y-6', className)}>
      <form onSubmit={handleSubmit} data-testid="agent-form">
        {/* Agent Name */}
        <FormField
          label="Agent Name"
          required
          error={errors.name}
          hint="Lowercase letters, numbers, and hyphens only"
          data-testid="name-field"
        >
          <Input
            data-testid="name-input"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            onBlur={() => handleFieldBlur('name')}
            error={!!errors.name}
            placeholder="my-agent"
          />
        </FormField>

        {/* Agent Description */}
        <FormField
          label="Description"
          required
          error={errors.description}
          hint="Brief description of what this agent does"
          data-testid="description-field"
        >
          <div className="space-y-1">
            <textarea
              data-testid="description-textarea"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              onBlur={() => handleFieldBlur('description')}
              placeholder="A helpful agent that..."
              rows={3}
              className={cn(
                'flex w-full rounded-md border border-border-secondary bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-apex-500 focus:ring-offset-2 focus:ring-offset-background',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'resize-none',
                errors.description && 'border-red-500 focus:ring-red-500'
              )}
            />
            <div className="flex justify-end">
              {getCharacterCount(formData.description, AGENT_VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH)}
            </div>
          </div>
        </FormField>

        {/* Agent Prompt */}
        <FormField
          label="System Prompt"
          required
          error={errors.prompt}
          hint="Instructions that define the agent's behavior and capabilities"
          data-testid="prompt-field"
        >
          <div className="space-y-1">
            <textarea
              data-testid="prompt-textarea"
              value={formData.prompt}
              onChange={(e) => handleFieldChange('prompt', e.target.value)}
              onBlur={() => handleFieldBlur('prompt')}
              placeholder="You are a helpful assistant that..."
              rows={6}
              className={cn(
                'flex w-full rounded-md border border-border-secondary bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-apex-500 focus:ring-offset-2 focus:ring-offset-background',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'resize-vertical',
                errors.prompt && 'border-red-500 focus:ring-red-500'
              )}
            />
            <div className="flex justify-end">
              {getCharacterCount(formData.prompt, AGENT_VALIDATION_LIMITS.PROMPT_MAX_LENGTH)}
            </div>
          </div>
        </FormField>

        {/* Model Selection */}
        <FormField
          label="Model"
          error={errors.model}
          hint="AI model to use for this agent"
          data-testid="model-field"
        >
          <Select
            data-testid="model-select"
            options={modelOptions}
            value={formData.model}
            onChange={(value) => handleFieldChange('model', value as AgentModelOption)}
            placeholder="Select a model..."
          />
        </FormField>

        {/* Tools Selection */}
        <FormField
          label="Tools"
          error={errors.tools}
          hint="Tools this agent can use (optional)"
          data-testid="tools-field"
        >
          <MultiSelect
            data-testid="tools-multiselect"
            options={availableTools}
            value={formData.tools}
            onChange={(values) => handleFieldChange('tools', values)}
            placeholder="Select tools..."
            maxSelections={AGENT_VALIDATION_LIMITS.MAX_TOOLS}
          />
        </FormField>

        {/* Skills Selection */}
        <FormField
          label="Skills"
          error={errors.skills}
          hint="Skills and capabilities this agent has (optional)"
          data-testid="skills-field"
        >
          <MultiSelect
            data-testid="skills-multiselect"
            options={availableSkills}
            value={formData.skills}
            onChange={(values) => handleFieldChange('skills', values)}
            placeholder="Select skills..."
            maxSelections={AGENT_VALIDATION_LIMITS.MAX_SKILLS}
          />
        </FormField>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!isFormValid || isSubmitting}
            data-testid="submit-button"
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Update Agent' : 'Create Agent'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="cancel-button"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

// Export default for easier imports
export default AgentForm