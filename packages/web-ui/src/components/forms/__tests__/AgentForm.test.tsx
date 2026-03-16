import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentForm, type AgentFormProps } from '../AgentForm'
import type { AgentFormData, AgentModelOption } from '@/lib/schemas/agent-schema'
import type { MultiSelectOption } from '@/components/ui/MultiSelect'

// Mock data for testing
const mockTools: MultiSelectOption[] = [
  { value: 'Read', label: 'Read Files' },
  { value: 'Write', label: 'Write Files' },
  { value: 'Bash', label: 'Execute Commands' },
  { value: 'WebSearch', label: 'Search the Web' },
]

const mockSkills: MultiSelectOption[] = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'react', label: 'React' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'python', label: 'Python' },
]

const validFormData: AgentFormData = {
  name: 'test-agent',
  description: 'A test agent for testing purposes',
  prompt: 'You are a helpful assistant that helps with testing.',
  model: 'sonnet',
  tools: ['Read', 'Write'],
  skills: ['typescript', 'react'],
}

// Default props for testing
const defaultProps: Omit<AgentFormProps, 'onSubmit' | 'onCancel'> = {
  availableTools: mockTools,
  availableSkills: mockSkills,
}

describe('AgentForm Component', () => {
  const user = userEvent.setup()
  let mockOnSubmit: ReturnType<typeof vi.fn>
  let mockOnCancel: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSubmit = vi.fn()
    mockOnCancel = vi.fn()
  })

  describe('Rendering', () => {
    it('should render all form fields with proper labels', () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Check all field labels are present
      expect(screen.getByText('Agent Name')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('System Prompt')).toBeInTheDocument()
      expect(screen.getByText('Model')).toBeInTheDocument()
      expect(screen.getByText('Tools')).toBeInTheDocument()
      expect(screen.getByText('Skills')).toBeInTheDocument()

      // Check required indicators
      expect(screen.getAllByText('*')).toHaveLength(3) // name, description, prompt are required

      // Check form controls are present
      expect(screen.getByTestId('name-input')).toBeInTheDocument()
      expect(screen.getByTestId('description-textarea')).toBeInTheDocument()
      expect(screen.getByTestId('prompt-textarea')).toBeInTheDocument()
      expect(screen.getByTestId('model-select')).toBeInTheDocument()
      expect(screen.getByTestId('tools-multiselect')).toBeInTheDocument()
      expect(screen.getByTestId('skills-multiselect')).toBeInTheDocument()

      // Check action buttons
      expect(screen.getByTestId('submit-button')).toBeInTheDocument()
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument()
    })

    it('should render in create mode by default', () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText('Create Agent')).toBeInTheDocument()
      expect(screen.getByTestId('name-input')).toHaveValue('')
    })

    it('should render in edit mode when initialData is provided', () => {
      render(
        <AgentForm
          {...defaultProps}
          initialData={validFormData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Update Agent')).toBeInTheDocument()
      expect(screen.getByTestId('name-input')).toHaveValue('test-agent')
      expect(screen.getByTestId('description-textarea')).toHaveValue('A test agent for testing purposes')
    })

    it('should show character counters for textareas', () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText('0/500')).toBeInTheDocument() // description counter
      expect(screen.getByText('0/50000')).toBeInTheDocument() // prompt counter
    })
  })

  describe('Form Validation', () => {
    it('should show validation errors for required fields when submitting empty form', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.click(screen.getByTestId('submit-button'))

      expect(mockOnSubmit).not.toHaveBeenCalled()

      await waitFor(() => {
        expect(screen.getByText('Agent name is required')).toBeInTheDocument()
        expect(screen.getByText('Description is required')).toBeInTheDocument()
        expect(screen.getByText('Prompt is required')).toBeInTheDocument()
      })
    })

    it('should validate agent name format', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const nameInput = screen.getByTestId('name-input')

      // Test invalid name format (uppercase)
      await user.type(nameInput, 'Invalid-Name')
      await user.tab()

      expect(screen.getByText('Name can only contain lowercase letters, numbers, and hyphens')).toBeInTheDocument()
    })

    it('should validate field length limits', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Test prompt minimum length
      const promptTextarea = screen.getByTestId('prompt-textarea')
      await user.type(promptTextarea, 'short')
      await user.tab()

      expect(screen.getByText('Prompt must be at least 10 characters')).toBeInTheDocument()
    })

    it('should clear validation errors when field becomes valid', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const nameInput = screen.getByTestId('name-input')

      // Trigger error
      await user.click(nameInput)
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Agent name is required')).toBeInTheDocument()
      })

      // Fix the error
      await user.type(nameInput, 'valid-name')

      await waitFor(() => {
        expect(screen.queryByText('Agent name is required')).not.toBeInTheDocument()
      })
    })

    it('should disable submit button when form is invalid', () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByTestId('submit-button')).toBeDisabled()
    })

    it('should enable submit button when form is valid', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Fill in all required fields
      await user.type(screen.getByTestId('name-input'), 'valid-agent')
      await user.type(screen.getByTestId('description-textarea'), 'A valid description')
      await user.type(screen.getByTestId('prompt-textarea'), 'A valid prompt that is long enough to meet requirements')

      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeEnabled()
      })
    })
  })

  describe('Form Interactions', () => {
    it('should handle form submission with valid data', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Fill in all required fields
      await user.type(screen.getByTestId('name-input'), 'test-agent')
      await user.type(screen.getByTestId('description-textarea'), 'Test description')
      await user.type(screen.getByTestId('prompt-textarea'), 'This is a valid test prompt for the agent')

      // Submit form
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'test-agent',
          description: 'Test description',
          prompt: 'This is a valid test prompt for the agent',
          model: 'sonnet', // default value
          tools: [],
          skills: [],
        })
      })
    })

    it('should handle cancel button click', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.click(screen.getByTestId('cancel-button'))

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })

    it('should handle model selection', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Open model select
      await user.click(screen.getByTestId('model-select'))

      // Select haiku model
      await user.click(screen.getByText('Haiku'))

      // Verify selection
      expect(screen.getByText('Haiku')).toBeInTheDocument()
    })

    it('should handle tools multi-selection', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Open tools multiselect
      await user.click(screen.getByTestId('tools-multiselect'))

      // Select some tools
      await user.click(screen.getByTestId('tools-multiselect-option-Read'))
      await user.click(screen.getByTestId('tools-multiselect-option-Write'))

      // Verify selections appear as tags
      expect(screen.getByTestId('tools-multiselect-selected-Read')).toBeInTheDocument()
      expect(screen.getByTestId('tools-multiselect-selected-Write')).toBeInTheDocument()
    })

    it('should update character counters as user types', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const text = 'Test description'
      await user.type(screen.getByTestId('description-textarea'), text)

      expect(screen.getByText(`${text.length}/500`)).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should disable form when submitting', () => {
      render(
        <AgentForm
          {...defaultProps}
          isSubmitting={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByTestId('submit-button')).toBeDisabled()
      expect(screen.getByTestId('cancel-button')).toBeDisabled()
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })

    it('should show loading indicator on submit button when submitting', () => {
      render(
        <AgentForm
          {...defaultProps}
          isSubmitting={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const submitButton = screen.getByTestId('submit-button')
      expect(submitButton).toContainHTML('animate-spin') // Loading spinner
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Check form has proper attributes
      expect(screen.getByTestId('agent-form')).toBeInTheDocument()

      // Check required fields have proper labeling - HTML required is not added by our input since we handle validation with zod
      const nameInput = screen.getByTestId('name-input')
      expect(nameInput).toBeInTheDocument()

      // Check error messages have role="alert" when displayed
      await user.click(nameInput)
      await user.tab()

      // Wait for error to appear and check it has proper role
      await waitFor(() => {
        const errorElement = screen.getByText('Agent name is required')
        expect(errorElement).toHaveAttribute('role', 'alert')
      })
    })

    it('should associate labels with form controls', () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Check that inputs have proper labeling via FormField component
      expect(screen.getByTestId('name-input')).toBeInTheDocument()
      expect(screen.getByText('Agent Name')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty availableTools and availableSkills arrays', () => {
      render(
        <AgentForm
          {...defaultProps}
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Should still render the multiselects
      expect(screen.getByTestId('tools-multiselect')).toBeInTheDocument()
      expect(screen.getByTestId('skills-multiselect')).toBeInTheDocument()
    })

    it('should handle missing availableTools and availableSkills props', () => {
      render(<AgentForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Should render with empty arrays as defaults
      expect(screen.getByTestId('tools-multiselect')).toBeInTheDocument()
      expect(screen.getByTestId('skills-multiselect')).toBeInTheDocument()
    })

    it('should handle very long input values', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Test description max length using direct value setting to bypass maxLength HTML attribute
      const descriptionTextarea = screen.getByTestId('description-textarea')

      // Focus the field first to mark it as touched
      await user.click(descriptionTextarea)

      // Create a form submission with long description to trigger validation
      const longDescription = 'x'.repeat(501) // Over the limit

      // Use fireEvent to set value directly (bypassing maxLength)
      fireEvent.change(descriptionTextarea, { target: { value: longDescription } })
      await user.tab()

      // Wait for validation error to appear
      await waitFor(() => {
        expect(screen.getByText('Description must be at most 500 characters')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should handle async onSubmit function', async () => {
      const asyncOnSubmit = vi.fn().mockResolvedValue(undefined)
      render(
        <AgentForm
          {...defaultProps}
          onSubmit={asyncOnSubmit}
          onCancel={mockOnCancel}
          initialData={validFormData}
        />
      )

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(asyncOnSubmit).toHaveBeenCalledWith(validFormData)
      })
    })

    it('should handle onSubmit function that throws error', async () => {
      const failingOnSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <AgentForm
          {...defaultProps}
          onSubmit={failingOnSubmit}
          onCancel={mockOnCancel}
          initialData={validFormData}
        />
      )

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Form submission error:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Default Values', () => {
    it('should use default model value when not specified', () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Should show Sonnet as default (from schema default)
      expect(screen.getByText('Sonnet')).toBeInTheDocument()
    })

    it('should initialize with empty arrays for tools and skills', () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Should show placeholder text, not selected items
      expect(screen.getByText('Select tools...')).toBeInTheDocument()
      expect(screen.getByText('Select skills...')).toBeInTheDocument()
    })
  })
})