/**
 * Integration tests for QuickActionsBar component
 *
 * Tests the complete workflow of the QuickActionsBar including:
 * - End-to-end task creation flows
 * - Real API interactions (mocked)
 * - Complex user interactions
 * - Error scenarios and recovery
 * - Modal and component integration
 * - Performance with large datasets
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickActionsBar } from '../QuickActionsBar'
import type { TaskTemplate, TemplateVariable } from '@/types/task-template'

// Mock the API client with realistic implementations
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getQuickActionTemplates: vi.fn(),
    createTaskFromTemplate: vi.fn(),
  },
}))

// Get reference to mocked functions after mock is set up
import { apiClient } from '@/lib/api-client'
const mockApiClient = vi.mocked(apiClient)

// Mock realistic data
const createMockTemplate = (
  id: string,
  name: string,
  variables: TemplateVariable[] = [],
  overrides?: Partial<TaskTemplate>
): TaskTemplate => ({
  id,
  name,
  description: `${name} description with {{componentName}}`,
  category: 'feature',
  workflow: 'feature',
  autonomy: 'review-before-commit',
  descriptionTemplate: `Create ${name.toLowerCase()} component {{componentName}}`,
  acceptanceCriteriaTemplate: `{{componentName}} should work correctly`,
  variables,
  tags: ['test'],
  isQuickAction: true,
  priority: 'normal',
  effort: 'medium',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
})

const stringVariable: TemplateVariable = {
  name: 'componentName',
  label: 'Component Name',
  type: 'string',
  required: true,
  placeholder: 'Enter component name',
  minLength: 2,
  maxLength: 50,
}

const textVariable: TemplateVariable = {
  name: 'description',
  label: 'Component Description',
  type: 'text',
  required: false,
  placeholder: 'Describe the component',
  maxLength: 200,
}

const booleanVariable: TemplateVariable = {
  name: 'isPublic',
  label: 'Public Component',
  type: 'boolean',
  required: false,
  defaultValue: false,
}

const numberVariable: TemplateVariable = {
  name: 'priority',
  label: 'Priority Level',
  type: 'number',
  required: true,
  min: 1,
  max: 5,
  defaultValue: 3,
}

const selectVariable: TemplateVariable = {
  name: 'framework',
  label: 'Framework',
  type: 'select',
  required: true,
  options: [
    { label: 'React', value: 'react' },
    { label: 'Vue', value: 'vue' },
    { label: 'Angular', value: 'angular' },
  ],
}

// Test templates
const simpleTemplate = createMockTemplate('simple', 'Simple Component')
const complexTemplate = createMockTemplate(
  'complex',
  'Complex Component',
  [stringVariable, textVariable, booleanVariable, numberVariable, selectVariable]
)

const bugfixTemplate = createMockTemplate('bugfix', 'Bug Fix', [], {
  category: 'bugfix',
  description: 'Fix a bug in the application',
})

describe('QuickActionsBar Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default successful API responses
    mockApiClient.getQuickActionTemplates.mockResolvedValue([
      simpleTemplate,
      complexTemplate,
      bugfixTemplate,
    ])
    mockApiClient.createTaskFromTemplate.mockResolvedValue({
      taskId: 'task-123',
      message: 'Task created successfully',
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Complete Task Creation Workflows', () => {
    it('creates a task from simple template (no variables) end-to-end', async () => {
      const onTaskCreated = vi.fn()
      const onError = vi.fn()

      render(
        <QuickActionsBar
          onTaskCreated={onTaskCreated}
          onError={onError}
        />
      )

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Simple Component')).toBeInTheDocument()
      })

      // Click the simple template button
      fireEvent.click(screen.getByText('Simple Component'))

      // Should create task immediately since no variables required
      await waitFor(() => {
        expect(mockApiClient.createTaskFromTemplate).toHaveBeenCalledWith({
          templateId: 'simple',
          variables: {},
        })
        expect(onTaskCreated).toHaveBeenCalledWith('task-123', 'simple')
        expect(onError).not.toHaveBeenCalled()
      })
    })

    it('creates a task with variables through modal workflow', async () => {
      const user = userEvent.setup()
      const onTaskCreated = vi.fn()
      const onError = vi.fn()

      render(
        <QuickActionsBar
          onTaskCreated={onTaskCreated}
          onError={onError}
        />
      )

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Complex Component')).toBeInTheDocument()
      })

      // Click the complex template button
      fireEvent.click(screen.getByText('Complex Component'))

      // Modal should open
      await waitFor(() => {
        expect(screen.getByText('Create Complex Component')).toBeInTheDocument()
      })

      // Fill in required fields
      const componentNameInput = screen.getByLabelText('Component Name')
      await user.clear(componentNameInput)
      await user.type(componentNameInput, 'MyNewComponent')

      const priorityInput = screen.getByLabelText('Priority Level')
      await user.clear(priorityInput)
      await user.type(priorityInput, '4')

      const frameworkSelect = screen.getByLabelText('Framework')
      await user.selectOptions(frameworkSelect, 'react')

      // Optional fields
      const descriptionInput = screen.getByLabelText('Component Description')
      await user.type(descriptionInput, 'A test component for integration testing')

      const publicCheckbox = screen.getByLabelText('Public Component')
      await user.click(publicCheckbox)

      // Submit the form
      const createButton = screen.getByRole('button', { name: /create task/i })
      expect(createButton).toBeEnabled()
      fireEvent.click(createButton)

      // Should call API with variables and close modal
      await waitFor(() => {
        expect(mockApiClient.createTaskFromTemplate).toHaveBeenCalledWith({
          templateId: 'complex',
          variables: {
            componentName: 'MyNewComponent',
            description: 'A test component for integration testing',
            isPublic: true,
            priority: 4,
            framework: 'react',
          },
        })
        expect(onTaskCreated).toHaveBeenCalledWith('task-123', 'complex')
        expect(screen.queryByText('Create Complex Component')).not.toBeInTheDocument()
      })
    })

    it('handles validation errors in modal workflow', async () => {
      const user = userEvent.setup()

      render(<QuickActionsBar />)

      // Wait for templates to load and click complex template
      await waitFor(() => {
        expect(screen.getByText('Complex Component')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Complex Component'))

      // Modal should open
      await waitFor(() => {
        expect(screen.getByText('Create Complex Component')).toBeInTheDocument()
      })

      // Try to submit without filling required fields
      const createButton = screen.getByRole('button', { name: /create task/i })
      expect(createButton).toBeDisabled() // Should be disabled initially

      // Fill in partial data (missing required fields)
      const componentNameInput = screen.getByLabelText('Component Name')
      await user.type(componentNameInput, 'A') // Too short (minLength: 2)

      // Button should still be disabled
      expect(createButton).toBeDisabled()

      // Fix validation by providing valid input
      await user.clear(componentNameInput)
      await user.type(componentNameInput, 'ValidComponent')

      const priorityInput = screen.getByLabelText('Priority Level')
      await user.type(priorityInput, '3')

      const frameworkSelect = screen.getByLabelText('Framework')
      await user.selectOptions(frameworkSelect, 'react')

      // Now button should be enabled
      await waitFor(() => {
        expect(createButton).toBeEnabled()
      })

      // Submit should work
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(mockApiClient.createTaskFromTemplate).toHaveBeenCalled()
      })
    })
  })

  describe('Error Scenarios and Recovery', () => {
    it('handles API errors during template loading', async () => {
      const networkError = new Error('Network error: Unable to fetch templates')
      mockApiClient.getQuickActionTemplates.mockRejectedValue(networkError)

      render(<QuickActionsBar />)

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/Failed to load quick actions/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      })

      // Retry should work
      mockApiClient.getQuickActionTemplates.mockResolvedValue([simpleTemplate])
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

      // Should reload successfully
      await waitFor(() => {
        expect(screen.getByText('Simple Component')).toBeInTheDocument()
        expect(screen.queryByText(/Failed to load quick actions/)).not.toBeInTheDocument()
      })
    })

    it('handles API errors during task creation', async () => {
      const onError = vi.fn()
      const creationError = new Error('API Error: Template not found')
      mockApiClient.createTaskFromTemplate.mockRejectedValue(creationError)

      render(<QuickActionsBar onError={onError} />)

      await waitFor(() => {
        expect(screen.getByText('Simple Component')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Simple Component'))

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(creationError, 'simple')
      })
    })

    it('handles API errors during modal task creation', async () => {
      const user = userEvent.setup()
      const onError = vi.fn()
      const creationError = new Error('Validation failed: Invalid variables')

      render(<QuickActionsBar onError={onError} />)

      await waitFor(() => {
        expect(screen.getByText('Complex Component')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Complex Component'))

      await waitFor(() => {
        expect(screen.getByText('Create Complex Component')).toBeInTheDocument()
      })

      // Fill in valid data
      const componentNameInput = screen.getByLabelText('Component Name')
      await user.type(componentNameInput, 'TestComponent')

      const priorityInput = screen.getByLabelText('Priority Level')
      await user.type(priorityInput, '2')

      const frameworkSelect = screen.getByLabelText('Framework')
      await user.selectOptions(frameworkSelect, 'vue')

      // Mock the API error for this specific call
      mockApiClient.createTaskFromTemplate.mockRejectedValueOnce(creationError)

      const createButton = screen.getByRole('button', { name: /create task/i })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(creationError, 'complex')
        // Modal should show error but stay open
        expect(screen.getByText(/Failed to create task/)).toBeInTheDocument()
      })
    })
  })

  describe('Performance and Large Datasets', () => {
    it('handles many templates efficiently', async () => {
      const manyTemplates = Array.from({ length: 50 }, (_, i) =>
        createMockTemplate(`template-${i}`, `Template ${i}`, [], {
          category: i % 2 === 0 ? 'feature' : 'bugfix',
        })
      )

      mockApiClient.getQuickActionTemplates.mockResolvedValue(manyTemplates)

      const startTime = performance.now()
      render(<QuickActionsBar maxActions={10} />)

      // Should render efficiently even with many templates
      await waitFor(() => {
        expect(screen.getByText('Template 0')).toBeInTheDocument()
      })

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(1000) // Should render in under 1 second

      // Should only show maxActions templates
      expect(screen.getByText('Showing 10 of 50')).toBeInTheDocument()
      expect(screen.queryByText('Template 10')).not.toBeInTheDocument()
    })

    it('handles complex variable validation efficiently', async () => {
      const user = userEvent.setup()
      const complexVariables: TemplateVariable[] = Array.from({ length: 20 }, (_, i) => ({
        name: `field${i}`,
        label: `Field ${i}`,
        type: i % 4 === 0 ? 'string' : i % 4 === 1 ? 'number' : i % 4 === 2 ? 'boolean' : 'text',
        required: i < 10, // First 10 are required
        minLength: i % 4 === 0 ? 2 : undefined,
        maxLength: i % 4 === 0 ? 50 : undefined,
        min: i % 4 === 1 ? 1 : undefined,
        max: i % 4 === 1 ? 100 : undefined,
      }))

      const complexTemplate = createMockTemplate('complex-form', 'Complex Form', complexVariables)
      mockApiClient.getQuickActionTemplates.mockResolvedValue([complexTemplate])

      render(<QuickActionsBar />)

      await waitFor(() => {
        expect(screen.getByText('Complex Form')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Complex Form'))

      await waitFor(() => {
        expect(screen.getByText('Create Complex Form')).toBeInTheDocument()
      })

      // Fill in all required fields efficiently
      for (let i = 0; i < 10; i++) {
        const field = screen.getByLabelText(`Field ${i}`)
        if (i % 4 === 0) { // string
          await user.type(field, `value${i}`)
        } else if (i % 4 === 1) { // number
          await user.type(field, `${i + 1}`)
        } else if (i % 4 === 2) { // boolean
          await user.click(field)
        } else { // text
          await user.type(field, `text value ${i}`)
        }
      }

      const createButton = screen.getByRole('button', { name: /create task/i })
      await waitFor(() => {
        expect(createButton).toBeEnabled()
      }, { timeout: 3000 })

      fireEvent.click(createButton)

      await waitFor(() => {
        expect(mockApiClient.createTaskFromTemplate).toHaveBeenCalled()
      })
    })
  })

  describe('User Experience Flows', () => {
    it('supports canceling modal and reopening', async () => {
      const user = userEvent.setup()

      render(<QuickActionsBar />)

      await waitFor(() => {
        expect(screen.getByText('Complex Component')).toBeInTheDocument()
      })

      // Open modal
      fireEvent.click(screen.getByText('Complex Component'))
      await waitFor(() => {
        expect(screen.getByText('Create Complex Component')).toBeInTheDocument()
      })

      // Fill in some data
      const componentNameInput = screen.getByLabelText('Component Name')
      await user.type(componentNameInput, 'TestComponent')

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      await waitFor(() => {
        expect(screen.queryByText('Create Complex Component')).not.toBeInTheDocument()
      })

      // Reopen modal - should be fresh (data should not persist)
      fireEvent.click(screen.getByText('Complex Component'))
      await waitFor(() => {
        expect(screen.getByText('Create Complex Component')).toBeInTheDocument()
      })

      const newComponentNameInput = screen.getByLabelText('Component Name')
      expect(newComponentNameInput).toHaveValue('')
    })

    it('maintains loading states correctly during async operations', async () => {
      let resolveCreate: (value: any) => void
      mockApiClient.createTaskFromTemplate.mockImplementation(
        () => new Promise((resolve) => {
          resolveCreate = resolve
        })
      )

      render(<QuickActionsBar />)

      await waitFor(() => {
        expect(screen.getByText('Simple Component')).toBeInTheDocument()
      })

      const button = screen.getByText('Simple Component')
      fireEvent.click(button)

      // Should show loading state on button
      await waitFor(() => {
        expect(button).toBeDisabled()
      })

      // Other buttons should still be clickable
      const otherButton = screen.getByText('Complex Component')
      expect(otherButton).not.toBeDisabled()

      // Resolve the creation
      resolveCreate!({ taskId: 'task-123' })

      await waitFor(() => {
        expect(button).not.toBeDisabled()
      })
    })

    it('provides consistent task preview updates', async () => {
      const user = userEvent.setup()

      render(<QuickActionsBar />)

      await waitFor(() => {
        expect(screen.getByText('Complex Component')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Complex Component'))

      await waitFor(() => {
        expect(screen.getByText('Create Complex Component')).toBeInTheDocument()
        expect(screen.getByText('Task Preview')).toBeInTheDocument()
      })

      // Should show initial description template
      expect(screen.getByText(/Create complex component/)).toBeInTheDocument()

      // Type in component name
      const componentNameInput = screen.getByLabelText('Component Name')
      await user.type(componentNameInput, 'MyComponent')

      // Preview should update
      await waitFor(() => {
        expect(screen.getByText(/MyComponent/)).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases and Robustness', () => {
    it('handles empty template response gracefully', async () => {
      mockApiClient.getQuickActionTemplates.mockResolvedValue([])

      render(<QuickActionsBar />)

      await waitFor(() => {
        expect(screen.getByText(/No quick actions available/)).toBeInTheDocument()
        expect(screen.getByText('📋')).toBeInTheDocument()
      })
    })

    it('handles malformed template data', async () => {
      const malformedTemplate = {
        ...simpleTemplate,
        variables: null, // Invalid - should be array
      } as any

      mockApiClient.getQuickActionTemplates.mockResolvedValue([malformedTemplate])

      expect(() => {
        render(<QuickActionsBar />)
      }).not.toThrow()

      // Should handle gracefully and either skip or fix the template
      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      })
    })

    it('handles rapid successive clicks gracefully', async () => {
      render(<QuickActionsBar />)

      await waitFor(() => {
        expect(screen.getByText('Simple Component')).toBeInTheDocument()
      })

      const button = screen.getByText('Simple Component')

      // Click rapidly multiple times
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      // Should only create one task
      await waitFor(() => {
        expect(mockApiClient.createTaskFromTemplate).toHaveBeenCalledTimes(1)
      })
    })

    it('handles network timeouts gracefully', async () => {
      const onError = vi.fn()
      const timeoutError = new Error('Request timeout')
      mockApiClient.createTaskFromTemplate.mockRejectedValue(timeoutError)

      render(<QuickActionsBar onError={onError} />)

      await waitFor(() => {
        expect(screen.getByText('Simple Component')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Simple Component'))

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(timeoutError, 'simple')
      })
    })
  })
})