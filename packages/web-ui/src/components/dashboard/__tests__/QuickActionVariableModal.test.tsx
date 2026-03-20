/**
 * Unit tests for QuickActionVariableModal component
 *
 * Tests the modal component for collecting template variable values including:
 * - Modal display and visibility
 * - Form input rendering for different variable types
 * - Form validation and error handling
 * - Task creation with variables
 * - Modal interactions (cancel, submit)
 * - Loading states
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickActionVariableModal } from '../QuickActionVariableModal'
import type { TaskTemplate, TemplateVariable } from '@/types/task-template'

// Mock the api client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    createTaskFromTemplate: vi.fn(),
  },
}))

// Get reference to mocked API client after mock is set up
import { apiClient } from '@/lib/api-client'
const mockApiClient = vi.mocked(apiClient)

// Mock the hook
const mockUseTemplateVariables = {
  values: {},
  errors: {},
  isComplete: false,
  setValue: vi.fn(),
  validate: vi.fn(),
  interpolate: vi.fn(),
}
vi.mock('@/hooks/useQuickActionTemplates', () => ({
  useTemplateVariables: () => mockUseTemplateVariables,
}))

// Mock UI components
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, type, variant, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Input', () => ({
  Input: ({ value, onChange, placeholder, type, ...props }: any) => (
    <input
      value={value || ''}
      onChange={(e) => onChange?.(e)}
      placeholder={placeholder}
      type={type}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/Textarea', () => ({
  Textarea: ({ value, onChange, placeholder, ...props }: any) => (
    <textarea
      value={value || ''}
      onChange={(e) => onChange?.(e)}
      placeholder={placeholder}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/Checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked || false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/Label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}))

// Mock template data
const createMockTemplate = (variables: TemplateVariable[]): TaskTemplate => ({
  id: 'test-template',
  name: 'Test Template',
  description: 'Test description for {{componentName}}',
  category: 'feature',
  workflow: 'feature',
  autonomy: 'review-before-commit',
  descriptionTemplate: 'Create {{componentName}} component',
  acceptanceCriteriaTemplate: '{{componentName}} should work correctly',
  variables,
  tags: ['test'],
  isQuickAction: true,
  priority: 'normal',
  effort: 'medium',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
})

const mockStringVariable: TemplateVariable = {
  name: 'componentName',
  label: 'Component Name',
  type: 'string',
  required: true,
  placeholder: 'Enter component name',
}

const mockTextVariable: TemplateVariable = {
  name: 'description',
  label: 'Description',
  type: 'text',
  required: false,
  placeholder: 'Enter description',
}

const mockBooleanVariable: TemplateVariable = {
  name: 'isPublic',
  label: 'Is Public',
  type: 'boolean',
  required: false,
  defaultValue: false,
}

const mockNumberVariable: TemplateVariable = {
  name: 'priority',
  label: 'Priority Level',
  type: 'number',
  required: true,
  min: 1,
  max: 5,
}

describe('QuickActionVariableModal', () => {
  const defaultProps = {
    isOpen: true,
    template: createMockTemplate([mockStringVariable]),
    onClose: vi.fn(),
    onTaskCreated: vi.fn(),
    onError: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTemplateVariables.values = {}
    mockUseTemplateVariables.errors = {}
    mockUseTemplateVariables.isComplete = false
    mockUseTemplateVariables.interpolate.mockReturnValue('Interpolated description')
    mockApiClient.createTaskFromTemplate.mockResolvedValue({ taskId: 'task-123' })
  })

  describe('Rendering', () => {
    it('renders when open', () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Create Test Template')
    })

    it('does not render when closed', () => {
      render(<QuickActionVariableModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('renders variable inputs based on template', () => {
      const template = createMockTemplate([
        mockStringVariable,
        mockTextVariable,
        mockBooleanVariable,
        mockNumberVariable,
      ])

      render(<QuickActionVariableModal {...defaultProps} template={template} />)

      expect(screen.getByLabelText('Component Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
      expect(screen.getByLabelText('Is Public')).toBeInTheDocument()
      expect(screen.getByLabelText('Priority Level')).toBeInTheDocument()
    })

    it('shows required indicators for required variables', () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('renders task preview', () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      expect(screen.getByText('Task Preview')).toBeInTheDocument()
      expect(screen.getByText('Interpolated description')).toBeInTheDocument()
      expect(mockUseTemplateVariables.interpolate).toHaveBeenCalled()
    })
  })

  describe('Variable Input Types', () => {
    it('renders string input correctly', () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      const input = screen.getByLabelText('Component Name')
      expect(input).toHaveAttribute('type', 'text')
      expect(input).toHaveAttribute('placeholder', 'Enter component name')
    })

    it('renders textarea for text variables', () => {
      const template = createMockTemplate([mockTextVariable])
      render(<QuickActionVariableModal {...defaultProps} template={template} />)

      const textarea = screen.getByLabelText('Description')
      expect(textarea.tagName).toBe('TEXTAREA')
      expect(textarea).toHaveAttribute('placeholder', 'Enter description')
    })

    it('renders checkbox for boolean variables', () => {
      const template = createMockTemplate([mockBooleanVariable])
      render(<QuickActionVariableModal {...defaultProps} template={template} />)

      const checkbox = screen.getByLabelText('Is Public')
      expect(checkbox).toHaveAttribute('type', 'checkbox')
    })

    it('renders number input with constraints', () => {
      const template = createMockTemplate([mockNumberVariable])
      render(<QuickActionVariableModal {...defaultProps} template={template} />)

      const input = screen.getByLabelText('Priority Level')
      expect(input).toHaveAttribute('type', 'number')
      expect(input).toHaveAttribute('min', '1')
      expect(input).toHaveAttribute('max', '5')
    })
  })

  describe('User Interactions', () => {
    it('calls setValue when input changes', async () => {
      const user = userEvent.setup()
      render(<QuickActionVariableModal {...defaultProps} />)

      const input = screen.getByLabelText('Component Name')
      await user.type(input, 'MyComponent')

      expect(mockUseTemplateVariables.setValue).toHaveBeenCalledWith(
        'componentName',
        expect.any(String)
      )
    })

    it('calls onClose when cancel button is clicked', () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when close button (X) is clicked', () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      // Assuming there's a close button with aria-label
      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Form Validation', () => {
    it('validates form before submission', async () => {
      mockUseTemplateVariables.validate.mockReturnValue(false)

      render(<QuickActionVariableModal {...defaultProps} />)

      const submitButton = screen.getByText('Create Task')
      fireEvent.click(submitButton)

      expect(mockUseTemplateVariables.validate).toHaveBeenCalledTimes(1)
      expect(mockApiClient.createTaskFromTemplate).not.toHaveBeenCalled()
    })

    it('shows validation errors', () => {
      mockUseTemplateVariables.errors = {
        componentName: 'Component name is required',
      }

      render(<QuickActionVariableModal {...defaultProps} />)

      expect(screen.getByText('Component name is required')).toBeInTheDocument()
    })

    it('disables submit button when form is incomplete', () => {
      mockUseTemplateVariables.isComplete = false

      render(<QuickActionVariableModal {...defaultProps} />)

      const submitButton = screen.getByText('Create Task')
      expect(submitButton).toBeDisabled()
    })

    it('enables submit button when form is complete', () => {
      mockUseTemplateVariables.isComplete = true

      render(<QuickActionVariableModal {...defaultProps} />)

      const submitButton = screen.getByText('Create Task')
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('Task Creation', () => {
    beforeEach(() => {
      mockUseTemplateVariables.validate.mockReturnValue(true)
      mockUseTemplateVariables.isComplete = true
      mockUseTemplateVariables.values = { componentName: 'MyComponent' }
    })

    it('creates task with variables on successful validation', async () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      const submitButton = screen.getByText('Create Task')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockApiClient.createTaskFromTemplate).toHaveBeenCalledWith({
          templateId: 'test-template',
          variables: { componentName: 'MyComponent' },
        })
        expect(defaultProps.onTaskCreated).toHaveBeenCalledWith('task-123')
      })
    })

    it('shows loading state during creation', async () => {
      let resolveCreate: (value: any) => void
      mockApiClient.createTaskFromTemplate.mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve
        })
      )

      render(<QuickActionVariableModal {...defaultProps} />)

      const submitButton = screen.getByText('Create Task')
      fireEvent.click(submitButton)

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByTestId('spinner')).toBeInTheDocument()
        expect(submitButton).toBeDisabled()
      })

      // Resolve the promise
      resolveCreate!({ taskId: 'task-123' })

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      })
    })

    it('handles creation errors', async () => {
      const error = new Error('Failed to create task')
      mockApiClient.createTaskFromTemplate.mockRejectedValue(error)

      render(<QuickActionVariableModal {...defaultProps} />)

      const submitButton = screen.getByText('Create Task')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(error)
      })
    })

    it('shows error message in modal on creation failure', async () => {
      mockApiClient.createTaskFromTemplate.mockRejectedValue(
        new Error('API Error: Invalid template')
      )

      render(<QuickActionVariableModal {...defaultProps} />)

      const submitButton = screen.getByText('Create Task')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
        expect(screen.getByText(/Failed to create task/)).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles template with no variables', () => {
      const emptyTemplate = createMockTemplate([])
      render(<QuickActionVariableModal {...defaultProps} template={emptyTemplate} />)

      expect(screen.getByText('Create Test Template')).toBeInTheDocument()
      expect(screen.getByText('Create Task')).toBeInTheDocument()
    })

    it('handles undefined template gracefully', () => {
      const props = { ...defaultProps, template: undefined }

      expect(() => {
        render(<QuickActionVariableModal {...props} />)
      }).not.toThrow()
    })

    it('handles variables with special characters', () => {
      const specialVariable: TemplateVariable = {
        name: 'special-var_name',
        label: 'Special Variable',
        type: 'string',
        required: false,
      }
      const template = createMockTemplate([specialVariable])

      render(<QuickActionVariableModal {...defaultProps} template={template} />)

      expect(screen.getByLabelText('Special Variable')).toBeInTheDocument()
    })

    it('handles very long variable labels', () => {
      const longLabelVariable: TemplateVariable = {
        name: 'longLabel',
        label: 'This is a very long variable label that might wrap to multiple lines',
        type: 'string',
        required: true,
      }
      const template = createMockTemplate([longLabelVariable])

      render(<QuickActionVariableModal {...defaultProps} template={template} />)

      expect(screen.getByLabelText(/This is a very long variable label/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and structure', () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      expect(screen.getByTestId('dialog-title')).toBeInTheDocument()
      expect(screen.getByLabelText('Component Name')).toBeInTheDocument()
    })

    it('supports keyboard navigation', () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      const input = screen.getByLabelText('Component Name')
      const cancelButton = screen.getByText('Cancel')
      const submitButton = screen.getByText('Create Task')

      // Elements should be focusable
      input.focus()
      expect(input).toHaveFocus()

      cancelButton.focus()
      expect(cancelButton).toHaveFocus()

      submitButton.focus()
      expect(submitButton).toHaveFocus()
    })

    it('manages focus properly when opened', () => {
      render(<QuickActionVariableModal {...defaultProps} />)

      // First input should be focused when modal opens
      const firstInput = screen.getByLabelText('Component Name')
      expect(firstInput).toHaveFocus()
    })
  })
})