/**
 * Hook for managing quick action templates
 *
 * Provides quick action templates and utilities for creating tasks from templates.
 * Handles caching, error states, and template variable validation.
 *
 * @module hooks/useQuickActionTemplates
 */

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type {
  TaskTemplate,
  TemplateVariableValues,
  UseQuickActionTemplatesReturn,
} from '@/types/task-template'

/**
 * Custom hook for managing quick action templates
 *
 * @example
 * ```tsx
 * const {
 *   templates,
 *   isLoading,
 *   error,
 *   refresh,
 *   createTaskFromTemplate,
 *   hasRequiredVariables
 * } = useQuickActionTemplates()
 *
 * const handleQuickAction = async (template: TaskTemplate) => {
 *   if (hasRequiredVariables(template)) {
 *     // Open modal for variable input
 *     setModalTemplate(template)
 *   } else {
 *     // Create task directly
 *     try {
 *       const taskId = await createTaskFromTemplate(template)
 *       onTaskCreated?.(taskId, template.id)
 *     } catch (error) {
 *       onError?.(error as Error, template.id)
 *     }
 *   }
 * }
 * ```
 */
export function useQuickActionTemplates(): UseQuickActionTemplatesReturn {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch quick action templates from the API
   */
  const fetchTemplates = useCallback(async () => {
    try {
      setError(null)
      const fetchedTemplates = await apiClient.getQuickActionTemplates()
      setTemplates(fetchedTemplates)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch quick action templates'
      setError(errorMessage)
      console.error('Error fetching quick action templates:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Refresh templates manually
   */
  const refresh = useCallback(async () => {
    setIsLoading(true)
    await fetchTemplates()
  }, [fetchTemplates])

  /**
   * Create a task from a template
   * Returns the task ID if successful
   */
  const createTaskFromTemplate = useCallback(async (
    template: TaskTemplate,
    variables?: TemplateVariableValues
  ): Promise<string> => {
    try {
      const response = await apiClient.createTaskFromTemplate({
        templateId: template.id,
        variables: variables || {},
      })
      return response.taskId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task from template'
      throw new Error(errorMessage)
    }
  }, [])

  /**
   * Check if a template has required variables
   */
  const hasRequiredVariables = useCallback((template: TaskTemplate): boolean => {
    return (
      Array.isArray(template.variables) &&
      template.variables.some((variable) => variable.required)
    )
  }, [])

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return {
    templates,
    isLoading,
    error,
    refresh,
    createTaskFromTemplate,
    hasRequiredVariables,
  }
}

/**
 * Hook for managing template variable values and validation
 *
 * @param template - The template to manage variables for
 * @example
 * ```tsx
 * const {
 *   values,
 *   errors,
 *   isComplete,
 *   setValue,
 *   validate,
 *   interpolate
 * } = useTemplateVariables(template)
 * ```
 */
export function useTemplateVariables(template: TaskTemplate) {
  const [values, setValues] = useState<TemplateVariableValues>(() => {
    // Initialize with default values
    const defaultValues: TemplateVariableValues = {}
    template.variables?.forEach((variable) => {
      if (variable.defaultValue !== undefined) {
        defaultValues[variable.name] = variable.defaultValue
      }
    })
    return defaultValues
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)

  /**
   * Set a single variable value
   */
  const setValue = useCallback((name: string, value: string | number | boolean | string[]) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setIsDirty(true)
    // Clear error for this field
    setErrors((prev) => {
      const { [name]: _, ...rest } = prev
      return rest
    })
  }, [])

  /**
   * Set multiple variable values
   */
  const setValuesMultiple = useCallback((newValues: TemplateVariableValues) => {
    setValues((prev) => ({ ...prev, ...newValues }))
    setIsDirty(true)
  }, [])

  /**
   * Reset to default values
   */
  const reset = useCallback(() => {
    const defaultValues: TemplateVariableValues = {}
    template.variables?.forEach((variable) => {
      if (variable.defaultValue !== undefined) {
        defaultValues[variable.name] = variable.defaultValue
      }
    })
    setValues(defaultValues)
    setErrors({})
    setIsDirty(false)
  }, [template.variables])

  /**
   * Validate all variables
   */
  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {}
    let isValid = true

    template.variables?.forEach((variable) => {
      const value = values[variable.name]

      // Check required fields
      if (variable.required && (value === undefined || value === '' || value === null)) {
        newErrors[variable.name] = `${variable.label} is required`
        isValid = false
        return
      }

      // Skip validation for optional empty values
      if (!variable.required && (value === undefined || value === '' || value === null)) {
        return
      }

      // Type-specific validation
      if (variable.type === 'string' && typeof value === 'string') {
        if (variable.minLength && value.length < variable.minLength) {
          newErrors[variable.name] = `${variable.label} must be at least ${variable.minLength} characters`
          isValid = false
        }
        if (variable.maxLength && value.length > variable.maxLength) {
          newErrors[variable.name] = `${variable.label} must be no more than ${variable.maxLength} characters`
          isValid = false
        }
        if (variable.validationPattern) {
          const regex = new RegExp(variable.validationPattern)
          if (!regex.test(value)) {
            newErrors[variable.name] = variable.validationMessage || `${variable.label} format is invalid`
            isValid = false
          }
        }
      }

      if (variable.type === 'number' && typeof value === 'number') {
        if (variable.min !== undefined && value < variable.min) {
          newErrors[variable.name] = `${variable.label} must be at least ${variable.min}`
          isValid = false
        }
        if (variable.max !== undefined && value > variable.max) {
          newErrors[variable.name] = `${variable.label} must be no more than ${variable.max}`
          isValid = false
        }
      }
    })

    setErrors(newErrors)
    return isValid
  }, [template.variables, values])

  /**
   * Interpolate a template string with current values
   */
  const interpolate = useCallback((templateString: string): string => {
    // Import interpolation helper from types
    return templateString.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = values[varName]
      if (value === undefined) return match
      if (Array.isArray(value)) return value.join(', ')
      return String(value)
    })
  }, [values])

  /**
   * Check if all required variables are filled
   */
  const isComplete = useCallback(() => {
    if (!template.variables) return true

    return template.variables.every((variable) => {
      if (!variable.required) return true
      const value = values[variable.name]
      return value !== undefined && value !== '' && value !== null
    })
  }, [template.variables, values])

  return {
    values,
    errors,
    isComplete: isComplete(),
    isDirty,
    setValue,
    setValues: setValuesMultiple,
    reset,
    validate,
    interpolate,
  }
}