/**
 * Unit tests for useQuickActionTemplates hook
 *
 * Tests the hook functionality including:
 * - Template fetching and caching
 * - Task creation from templates
 * - Variable validation
 * - Error handling
 * - Loading states
 * - Refresh functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useQuickActionTemplates, useTemplateVariables } from '../useQuickActionTemplates'
import { apiClient } from '@/lib/api-client'
import type { TaskTemplate, TemplateVariableValues } from '@/types/task-template'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getQuickActionTemplates: vi.fn(),
    createTaskFromTemplate: vi.fn(),
  },
}))

const mockApiClient = vi.mocked(apiClient)

// Mock data helpers
const createMockTemplate = (
  id: string,
  name: string,
  overrides?: Partial<TaskTemplate>
): TaskTemplate => ({
  id,
  name,
  description: `${name} description`,
  category: 'feature',
  workflow: 'feature',
  autonomy: 'review-before-commit',
  descriptionTemplate: `Create ${name.toLowerCase()}`,
  acceptanceCriteriaTemplate: `${name} should work correctly`,
  variables: [],
  tags: ['test'],
  isQuickAction: true,
  priority: 'normal',
  effort: 'medium',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
})

const mockTemplates = [
  createMockTemplate('template_1', 'Template 1'),
  createMockTemplate('template_2', 'Template 2', {
    variables: [
      {
        name: 'componentName',
        label: 'Component Name',
        type: 'string',
        required: true,
      },
    ],
  }),
  createMockTemplate('template_3', 'Template 3', {
    variables: [
      {
        name: 'optional',
        label: 'Optional Field',
        type: 'string',
        required: false,
      },
    ],
  }),
]

describe('useQuickActionTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset API client mocks
    mockApiClient.getQuickActionTemplates.mockResolvedValue(mockTemplates)
    mockApiClient.createTaskFromTemplate.mockResolvedValue({ taskId: 'task_123' })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Initial Loading', () => {
    it('starts in loading state and fetches templates on mount', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      // Should start loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.templates).toEqual([])
      expect(result.current.error).toBe(null)

      // Should call API
      expect(mockApiClient.getQuickActionTemplates).toHaveBeenCalledTimes(1)

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.templates).toEqual(mockTemplates)
      expect(result.current.error).toBe(null)
    })

    it('handles API errors during initial load', async () => {
      const errorMessage = 'Failed to fetch templates'
      mockApiClient.getQuickActionTemplates.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.templates).toEqual([])
      expect(result.current.error).toBe(errorMessage)
    })

    it('handles network errors gracefully', async () => {
      mockApiClient.getQuickActionTemplates.mockRejectedValue('Network error')

      const { result } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe('Failed to fetch quick action templates')
    })
  })

  describe('Refresh Functionality', () => {
    it('refreshes templates when refresh is called', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Clear the mock to test refresh
      mockApiClient.getQuickActionTemplates.mockClear()

      // Call refresh
      await act(async () => {
        await result.current.refresh()
      })

      // Should call API again and show loading state during refresh
      expect(mockApiClient.getQuickActionTemplates).toHaveBeenCalledTimes(1)
    })

    it('handles errors during refresh', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Mock error on refresh
      mockApiClient.getQuickActionTemplates.mockRejectedValue(new Error('Refresh failed'))

      await act(async () => {
        await result.current.refresh()
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Refresh failed')
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('maintains templates during refresh error', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.templates).toEqual(mockTemplates)
      })

      // Mock error on refresh
      mockApiClient.getQuickActionTemplates.mockRejectedValue(new Error('Refresh failed'))

      await act(async () => {
        await result.current.refresh()
      })

      // Templates should still be available from previous successful load
      expect(result.current.templates).toEqual(mockTemplates)
      expect(result.current.error).toBe('Refresh failed')
    })
  })

  describe('Task Creation', () => {
    it('creates task from template without variables', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const template = mockTemplates[0] // Template without variables
      let taskId: string

      await act(async () => {
        taskId = await result.current.createTaskFromTemplate(template)
      })

      expect(mockApiClient.createTaskFromTemplate).toHaveBeenCalledWith({
        templateId: template.id,
        variables: {},
      })
      expect(taskId).toBe('task_123')
    })

    it('creates task from template with variables', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const template = mockTemplates[1] // Template with variables
      const variables = { componentName: 'TestComponent' }
      let taskId: string

      await act(async () => {
        taskId = await result.current.createTaskFromTemplate(template, variables)
      })

      expect(mockApiClient.createTaskFromTemplate).toHaveBeenCalledWith({
        templateId: template.id,
        variables,
      })
      expect(taskId).toBe('task_123')
    })

    it('handles task creation errors', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const errorMessage = 'Task creation failed'
      mockApiClient.createTaskFromTemplate.mockRejectedValue(new Error(errorMessage))

      const template = mockTemplates[0]

      await expect(async () => {
        await act(async () => {
          await result.current.createTaskFromTemplate(template)
        })
      }).rejects.toThrow(errorMessage)
    })

    it('handles non-Error objects during task creation', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockApiClient.createTaskFromTemplate.mockRejectedValue('String error')

      const template = mockTemplates[0]

      await expect(async () => {
        await act(async () => {
          await result.current.createTaskFromTemplate(template)
        })
      }).rejects.toThrow('Failed to create task from template')
    })
  })

  describe('Variable Validation', () => {
    it('correctly identifies templates with required variables', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Template without variables
      expect(result.current.hasRequiredVariables(mockTemplates[0])).toBe(false)

      // Template with required variables
      expect(result.current.hasRequiredVariables(mockTemplates[1])).toBe(true)

      // Template with only optional variables
      expect(result.current.hasRequiredVariables(mockTemplates[2])).toBe(false)
    })

    it('handles templates with undefined variables', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const templateWithoutVariables = createMockTemplate('no_vars', 'No Variables', {
        variables: undefined,
      })

      expect(result.current.hasRequiredVariables(templateWithoutVariables)).toBe(false)
    })

    it('handles templates with empty variables array', async () => {
      const { result } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const templateWithEmptyVariables = createMockTemplate('empty_vars', 'Empty Variables', {
        variables: [],
      })

      expect(result.current.hasRequiredVariables(templateWithEmptyVariables)).toBe(false)
    })
  })

  describe('Hook Stability', () => {
    it('provides stable function references', async () => {
      const { result, rerender } = renderHook(() => useQuickActionTemplates())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const firstRefresh = result.current.refresh
      const firstCreateTask = result.current.createTaskFromTemplate
      const firstHasRequired = result.current.hasRequiredVariables

      rerender()

      expect(result.current.refresh).toBe(firstRefresh)
      expect(result.current.createTaskFromTemplate).toBe(firstCreateTask)
      expect(result.current.hasRequiredVariables).toBe(firstHasRequired)
    })
  })
})

describe('useTemplateVariables', () => {
  const mockTemplate = createMockTemplate('template_with_vars', 'Template With Variables', {
    variables: [
      {
        name: 'requiredString',
        label: 'Required String',
        type: 'string',
        required: true,
        placeholder: 'Enter value',
      },
      {
        name: 'optionalString',
        label: 'Optional String',
        type: 'string',
        required: false,
        defaultValue: 'default',
      },
      {
        name: 'number',
        label: 'Number',
        type: 'number',
        required: true,
        min: 1,
        max: 100,
      },
      {
        name: 'stringWithValidation',
        label: 'String With Validation',
        type: 'string',
        required: true,
        minLength: 3,
        maxLength: 10,
        validationPattern: '^[A-Z][a-z]+$',
        validationMessage: 'Must start with uppercase letter',
      },
    ],
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      expect(result.current.values).toEqual({
        optionalString: 'default',
      })
      expect(result.current.errors).toEqual({})
      expect(result.current.isComplete).toBe(false)
      expect(result.current.isDirty).toBe(false)
    })

    it('handles template without variables', () => {
      const templateWithoutVars = createMockTemplate('no_vars', 'No Variables')
      const { result } = renderHook(() => useTemplateVariables(templateWithoutVars))

      expect(result.current.values).toEqual({})
      expect(result.current.isComplete).toBe(true)
    })
  })

  describe('Setting Values', () => {
    it('sets single variable value', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      act(() => {
        result.current.setValue('requiredString', 'test value')
      })

      expect(result.current.values.requiredString).toBe('test value')
      expect(result.current.isDirty).toBe(true)
      expect(result.current.errors.requiredString).toBeUndefined()
    })

    it('sets multiple variable values', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      const newValues: TemplateVariableValues = {
        requiredString: 'test',
        number: 42,
      }

      act(() => {
        result.current.setValues(newValues)
      })

      expect(result.current.values).toEqual({
        optionalString: 'default',
        requiredString: 'test',
        number: 42,
      })
      expect(result.current.isDirty).toBe(true)
    })

    it('clears field error when setting value', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      // First, validate to create an error
      act(() => {
        result.current.validate()
      })

      expect(result.current.errors.requiredString).toBeDefined()

      // Then set a value to clear the error
      act(() => {
        result.current.setValue('requiredString', 'valid value')
      })

      expect(result.current.errors.requiredString).toBeUndefined()
    })
  })

  describe('Validation', () => {
    it('validates required fields', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      let isValid: boolean

      act(() => {
        isValid = result.current.validate()
      })

      expect(isValid).toBe(false)
      expect(result.current.errors.requiredString).toBe('Required String is required')
      expect(result.current.errors.number).toBe('Number is required')
    })

    it('validates string length constraints', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      act(() => {
        result.current.setValue('stringWithValidation', 'ab') // Too short
        result.current.validate()
      })

      expect(result.current.errors.stringWithValidation).toBe('String With Validation must be at least 3 characters')

      act(() => {
        result.current.setValue('stringWithValidation', 'thisistoolong') // Too long
        result.current.validate()
      })

      expect(result.current.errors.stringWithValidation).toBe('String With Validation must be no more than 10 characters')
    })

    it('validates regex patterns', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      act(() => {
        result.current.setValue('stringWithValidation', 'invalid') // Doesn't match pattern
        result.current.validate()
      })

      expect(result.current.errors.stringWithValidation).toBe('Must start with uppercase letter')
    })

    it('validates number ranges', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      act(() => {
        result.current.setValue('number', 0) // Below min
        result.current.validate()
      })

      expect(result.current.errors.number).toBe('Number must be at least 1')

      act(() => {
        result.current.setValue('number', 150) // Above max
        result.current.validate()
      })

      expect(result.current.errors.number).toBe('Number must be no more than 100')
    })

    it('passes validation with valid values', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      act(() => {
        result.current.setValue('requiredString', 'valid')
        result.current.setValue('number', 50)
        result.current.setValue('stringWithValidation', 'Valid')
      })

      let isValid: boolean

      act(() => {
        isValid = result.current.validate()
      })

      expect(isValid).toBe(true)
      expect(Object.keys(result.current.errors)).toHaveLength(0)
    })

    it('skips validation for optional empty values', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      act(() => {
        result.current.setValue('requiredString', 'valid')
        result.current.setValue('number', 50)
        result.current.setValue('stringWithValidation', 'Valid')
        result.current.setValue('optionalString', '') // Empty optional field
      })

      let isValid: boolean

      act(() => {
        isValid = result.current.validate()
      })

      expect(isValid).toBe(true)
      expect(result.current.errors.optionalString).toBeUndefined()
    })
  })

  describe('Completion Status', () => {
    it('reports incomplete when required fields are missing', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      expect(result.current.isComplete).toBe(false)
    })

    it('reports complete when all required fields are filled', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      act(() => {
        result.current.setValue('requiredString', 'valid')
        result.current.setValue('number', 50)
        result.current.setValue('stringWithValidation', 'Valid')
      })

      expect(result.current.isComplete).toBe(true)
    })

    it('handles templates without required variables', () => {
      const templateAllOptional = createMockTemplate('all_optional', 'All Optional', {
        variables: [
          {
            name: 'optional',
            label: 'Optional',
            type: 'string',
            required: false,
          },
        ],
      })

      const { result } = renderHook(() => useTemplateVariables(templateAllOptional))

      expect(result.current.isComplete).toBe(true)
    })
  })

  describe('Interpolation', () => {
    it('interpolates template strings with values', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      act(() => {
        result.current.setValue('requiredString', 'component')
        result.current.setValue('number', 42)
      })

      const template = 'Create {{requiredString}} with {{number}} instances'
      const interpolated = result.current.interpolate(template)

      expect(interpolated).toBe('Create component with 42 instances')
    })

    it('handles missing variables in interpolation', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      const template = 'Create {{missing}} component'
      const interpolated = result.current.interpolate(template)

      expect(interpolated).toBe('Create {{missing}} component')
    })

    it('interpolates array values as comma-separated strings', () => {
      const templateWithArray = createMockTemplate('with_array', 'With Array', {
        variables: [
          {
            name: 'tags',
            label: 'Tags',
            type: 'multiselect',
            required: false,
          },
        ],
      })

      const { result } = renderHook(() => useTemplateVariables(templateWithArray))

      act(() => {
        result.current.setValue('tags', ['tag1', 'tag2', 'tag3'])
      })

      const template = 'Tags: {{tags}}'
      const interpolated = result.current.interpolate(template)

      expect(interpolated).toBe('Tags: tag1, tag2, tag3')
    })
  })

  describe('Reset Functionality', () => {
    it('resets to default values', () => {
      const { result } = renderHook(() => useTemplateVariables(mockTemplate))

      // Set some values
      act(() => {
        result.current.setValue('requiredString', 'changed')
        result.current.setValue('optionalString', 'changed')
        result.current.setValue('number', 99)
      })

      expect(result.current.isDirty).toBe(true)

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.values).toEqual({
        optionalString: 'default',
      })
      expect(result.current.errors).toEqual({})
      expect(result.current.isDirty).toBe(false)
    })
  })

  describe('Hook Stability', () => {
    it('provides stable function references', () => {
      const { result, rerender } = renderHook(() => useTemplateVariables(mockTemplate))

      const firstSetValue = result.current.setValue
      const firstValidate = result.current.validate
      const firstReset = result.current.reset

      rerender()

      expect(result.current.setValue).toBe(firstSetValue)
      expect(result.current.validate).toBe(firstValidate)
      expect(result.current.reset).toBe(firstReset)
    })
  })
})