import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaveTemplateModal } from '../SaveTemplateModal'
import { apiClient } from '@/lib/api-client'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    createTemplate: vi.fn(),
  },
}))

const mockTaskData = {
  description: 'Test task description',
  acceptanceCriteria: 'Test acceptance criteria',
  workflow: 'feature',
  autonomy: 'review-before-commit' as const,
}

const mockTaskDataWithoutCriteria = {
  description: 'Test task description without criteria',
  workflow: 'bugfix',
  autonomy: 'autonomous' as const,
}

describe('SaveTemplateModal', () => {
  const mockOnClose = vi.fn()
  const mockOnSaved = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering and Visibility', () => {
    it('renders when open with all expected elements', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Save as Template')).toBeInTheDocument()
      expect(screen.getByLabelText(/Template Name/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Tags')).toBeInTheDocument()
      expect(screen.getByText('Template Preview')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Save Template/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Close modal/ })).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      render(
        <SaveTemplateModal
          isOpen={false}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      expect(screen.queryByText('Save as Template')).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('has proper ARIA attributes for accessibility', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')

      const form = screen.getByRole('form')
      expect(form).toBeInTheDocument()

      const closeButton = screen.getByRole('button', { name: /Close modal/ })
      expect(closeButton).toHaveAttribute('aria-label', 'Close modal')
    })
  })

  describe('Form State Management', () => {
    it('resets form when modal opens', () => {
      const { rerender } = render(
        <SaveTemplateModal
          isOpen={false}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Reopen modal
      rerender(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const nameInput = screen.getByLabelText(/Template Name/)
      const descInput = screen.getByLabelText(/Description/)
      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)

      expect(nameInput).toHaveValue('')
      expect(descInput).toHaveValue('')
      expect(tagInput).toHaveValue('')

      // Check that 'custom' category is selected by default
      const customCategory = screen.getByRole('button', { name: /Custom/ })
      expect(customCategory).toHaveClass('border-apex-500')
    })

    it('autofocuses the name input when modal opens', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const nameInput = screen.getByLabelText(/Template Name/)
      expect(nameInput).toHaveFocus()
    })

    it('tracks character count for name and description fields', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const nameInput = screen.getByLabelText(/Template Name/)
      const descInput = screen.getByLabelText(/Description/)

      // Initial state
      expect(screen.getByText('0/100 characters')).toBeInTheDocument()
      expect(screen.getByText('0/500 characters')).toBeInTheDocument()

      // Type in name field
      fireEvent.change(nameInput, { target: { value: 'Test Name' } })
      expect(screen.getByText('9/100 characters')).toBeInTheDocument()

      // Type in description field
      fireEvent.change(descInput, { target: { value: 'Test description' } })
      expect(screen.getByText('16/500 characters')).toBeInTheDocument()
    })

    it('clears errors when user starts typing', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Trigger validation error
      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      fireEvent.click(submitButton)

      // Error should appear
      expect(screen.getByText('Template name is required')).toBeInTheDocument()

      // Start typing in name field
      const nameInput = screen.getByLabelText(/Template Name/)
      fireEvent.change(nameInput, { target: { value: 'T' } })

      // Error should disappear
      expect(screen.queryByText('Template name is required')).not.toBeInTheDocument()
    })
  })

  describe('Validation', () => {
    it('shows required field validation for empty name', async () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Template name is required')).toBeInTheDocument()
      })

      expect(apiClient.createTemplate).not.toHaveBeenCalled()
    })

    it('shows required field validation for empty description', async () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Fill name but leave description empty
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test Template' },
      })

      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Template description is required')).toBeInTheDocument()
      })

      expect(apiClient.createTemplate).not.toHaveBeenCalled()
    })

    it('validates name length (max 100 characters)', async () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const longName = 'a'.repeat(101)
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: longName },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Valid description' },
      })

      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Template name cannot exceed 100 characters')).toBeInTheDocument()
      })

      expect(apiClient.createTemplate).not.toHaveBeenCalled()
    })

    it('validates description length (max 500 characters)', async () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const longDescription = 'a'.repeat(501)
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Valid name' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: longDescription },
      })

      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Template description cannot exceed 500 characters')).toBeInTheDocument()
      })

      expect(apiClient.createTemplate).not.toHaveBeenCalled()
    })

    it('trims whitespace from name and description before validation', async () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: '   ' }, // Only whitespace
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: '   ' }, // Only whitespace
      })

      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Template name is required')).toBeInTheDocument()
      })
    })

    it('disables submit button when form is invalid', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      expect(submitButton).toBeDisabled()

      // Fill only name
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test Template' },
      })
      expect(submitButton).toBeDisabled()

      // Fill description too
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      })
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('Category Selection', () => {
    it('allows selecting different categories', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Initially 'custom' should be selected
      const customButton = screen.getByRole('button', { name: /Custom/ })
      expect(customButton).toHaveClass('border-apex-500')

      // Click on feature category
      const featureButton = screen.getByRole('button', { name: /Feature/ })
      fireEvent.click(featureButton)

      // Feature should now be selected
      expect(featureButton).toHaveClass('border-apex-500')
      expect(customButton).not.toHaveClass('border-apex-500')
    })

    it('shows all category options with descriptions', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const expectedCategories = [
        { label: 'Feature', description: 'New feature implementation' },
        { label: 'Bug Fix', description: 'Bug fixes and patches' },
        { label: 'Refactoring', description: 'Code refactoring tasks' },
        { label: 'Testing', description: 'Test creation and improvements' },
        { label: 'Documentation', description: 'Documentation tasks' },
        { label: 'Maintenance', description: 'Maintenance and chores' },
        { label: 'Deployment', description: 'Deployment and release tasks' },
        { label: 'Custom', description: 'User-defined category' },
      ]

      expectedCategories.forEach(({ label, description }) => {
        expect(screen.getByText(label)).toBeInTheDocument()
        expect(screen.getByText(description)).toBeInTheDocument()
      })
    })

    it('disables category buttons during loading and success states', () => {
      const { rerender } = render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const featureButton = screen.getByRole('button', { name: /Feature/ })
      expect(featureButton).not.toBeDisabled()

      // Mock loading state by triggering form submission
      const mockTemplate = { id: 'template-123', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockTemplate), 100))
      )

      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test Name' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      })

      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      fireEvent.click(submitButton)

      // During loading, buttons should be disabled
      expect(featureButton).toBeDisabled()
    })
  })

  describe('Tag Management', () => {
    it('allows adding tags via button click', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      const addButton = screen.getByRole('button', { name: 'Add' })

      fireEvent.change(tagInput, { target: { value: 'frontend' } })
      fireEvent.click(addButton)

      expect(screen.getByText('frontend')).toBeInTheDocument()
      expect(tagInput).toHaveValue('')
    })

    it('allows adding tags via Enter key', async () => {
      const user = userEvent.setup()

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)

      await user.type(tagInput, 'react')
      await user.keyboard('{Enter}')

      expect(screen.getByText('react')).toBeInTheDocument()
    })

    it('allows removing tags via backspace when input is empty', async () => {
      const user = userEvent.setup()

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)

      // Add a tag first
      await user.type(tagInput, 'test-tag')
      await user.keyboard('{Enter}')
      expect(screen.getByText('test-tag')).toBeInTheDocument()

      // Remove it with backspace
      await user.keyboard('{Backspace}')
      expect(screen.queryByText('test-tag')).not.toBeInTheDocument()
    })

    it('allows removing tags by clicking the X button', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      const addButton = screen.getByRole('button', { name: 'Add' })

      // Add a tag
      fireEvent.change(tagInput, { target: { value: 'test-tag' } })
      fireEvent.click(addButton)
      expect(screen.getByText('test-tag')).toBeInTheDocument()

      // Remove the tag
      const removeButton = screen.getByLabelText('Remove test-tag tag')
      fireEvent.click(removeButton)
      expect(screen.queryByText('test-tag')).not.toBeInTheDocument()
    })

    it('converts tags to lowercase', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      const addButton = screen.getByRole('button', { name: 'Add' })

      fireEvent.change(tagInput, { target: { value: 'UPPERCASE' } })
      fireEvent.click(addButton)

      expect(screen.getByText('uppercase')).toBeInTheDocument()
    })

    it('trims whitespace from tags', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      const addButton = screen.getByRole('button', { name: 'Add' })

      fireEvent.change(tagInput, { target: { value: '  spaced  ' } })
      fireEvent.click(addButton)

      expect(screen.getByText('spaced')).toBeInTheDocument()
    })

    it('prevents duplicate tags', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      const addButton = screen.getByRole('button', { name: 'Add' })

      // Add first tag
      fireEvent.change(tagInput, { target: { value: 'duplicate' } })
      fireEvent.click(addButton)
      expect(screen.getByText('duplicate')).toBeInTheDocument()

      // Try to add same tag again
      fireEvent.change(tagInput, { target: { value: 'duplicate' } })
      fireEvent.click(addButton)

      // Should only have one instance
      const tags = screen.getAllByText('duplicate')
      expect(tags).toHaveLength(1)
    })

    it('limits tags to 10', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      const addButton = screen.getByRole('button', { name: 'Add' })

      // Add 10 tags
      for (let i = 1; i <= 10; i++) {
        fireEvent.change(tagInput, { target: { value: `tag${i}` } })
        fireEvent.click(addButton)
      }

      expect(screen.getByText('10/10 tags')).toBeInTheDocument()
      expect(tagInput).toBeDisabled()
      expect(addButton).toBeDisabled()

      // Try to add 11th tag (shouldn't work)
      fireEvent.change(tagInput, { target: { value: 'tag11' } })
      fireEvent.click(addButton)
      expect(screen.queryByText('tag11')).not.toBeInTheDocument()
    })

    it('shows tag counter', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      expect(screen.getByText('0/10 tags • Press Enter to add')).toBeInTheDocument()

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      const addButton = screen.getByRole('button', { name: 'Add' })

      fireEvent.change(tagInput, { target: { value: 'test' } })
      fireEvent.click(addButton)

      expect(screen.getByText('1/10 tags • Press Enter to add')).toBeInTheDocument()
    })

    it('disables add button when tag input is empty', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const addButton = screen.getByRole('button', { name: 'Add' })
      expect(addButton).toBeDisabled()

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      fireEvent.change(tagInput, { target: { value: 'test' } })
      expect(addButton).not.toBeDisabled()
    })
  })

  describe('Preview Section', () => {
    it('displays task data in preview section', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      expect(screen.getByText('Template Preview')).toBeInTheDocument()
      expect(screen.getByText('Test task description')).toBeInTheDocument()
      expect(screen.getByText('Test acceptance criteria')).toBeInTheDocument()
      expect(screen.getByText(/Workflow:.*feature/)).toBeInTheDocument()
      expect(screen.getByText(/Autonomy:.*review-before-commit/)).toBeInTheDocument()
    })

    it('handles task data without acceptance criteria', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskDataWithoutCriteria}
        />
      )

      expect(screen.getByText('Test task description without criteria')).toBeInTheDocument()
      expect(screen.queryByText('Acceptance Criteria:')).not.toBeInTheDocument()
      expect(screen.getByText(/Workflow:.*bugfix/)).toBeInTheDocument()
      expect(screen.getByText(/Autonomy:.*autonomous/)).toBeInTheDocument()
    })

    it('shows fallback text for empty description', () => {
      const emptyTaskData = {
        description: '',
        workflow: 'feature',
        autonomy: 'review-before-commit' as const,
      }

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={emptyTaskData}
        />
      )

      expect(screen.getByText('No description provided')).toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('submits form with valid data and includes tags', async () => {
      const mockTemplate = { id: 'template-123', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockResolvedValue(mockTemplate)

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Fill form
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'My Test Template' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'This is a test template' },
      })

      // Select feature category
      const featureButton = screen.getByRole('button', { name: /Feature/ })
      fireEvent.click(featureButton)

      // Add tags
      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      const addButton = screen.getByRole('button', { name: 'Add' })

      fireEvent.change(tagInput, { target: { value: 'react' } })
      fireEvent.click(addButton)
      fireEvent.change(tagInput, { target: { value: 'frontend' } })
      fireEvent.click(addButton)

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(apiClient.createTemplate).toHaveBeenCalledWith({
          name: 'My Test Template',
          description: 'This is a test template',
          category: 'feature',
          workflow: 'feature',
          autonomy: 'review-before-commit',
          descriptionTemplate: 'Test task description',
          acceptanceCriteriaTemplate: 'Test acceptance criteria',
          tags: ['react', 'frontend'],
          isQuickAction: false,
          priority: 'normal',
          effort: 'medium',
        })
      })

      await waitFor(() => {
        expect(mockOnSaved).toHaveBeenCalledWith('template-123')
      })
    })

    it('submits form without tags when none are added', async () => {
      const mockTemplate = { id: 'template-123', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockResolvedValue(mockTemplate)

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'No Tags Template' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Template without tags' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(apiClient.createTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'No Tags Template',
            description: 'Template without tags',
            tags: undefined, // Should be undefined when no tags
          })
        )
      })
    })

    it('shows loading state during submission', async () => {
      const mockTemplate = { id: 'template-123', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTemplate), 100))
      )

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Fill form
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test Template' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      })

      // Submit
      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      fireEvent.click(submitButton)

      // Check loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
      expect(screen.getByRole('button', { name: /Cancel/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Close modal/ })).toBeDisabled()

      // Wait for completion
      await waitFor(() => {
        expect(mockOnSaved).toHaveBeenCalled()
      })
    })

    it('shows success message and auto-closes after success', async () => {
      const mockTemplate = { id: 'template-123', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockResolvedValue(mockTemplate)

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test Template' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('Template saved successfully! Closing in a moment...')).toBeInTheDocument()
      })

      // Form fields should be disabled during success state
      expect(screen.getByLabelText(/Template Name/)).toBeDisabled()
      expect(screen.getByLabelText(/Description/)).toBeDisabled()

      // Cancel button should say "Done"
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()

      // Should auto-close after timeout (we can't easily test the setTimeout)
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      ;(apiClient.createTemplate as any).mockRejectedValue(new Error('Network error'))

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test Template' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      expect(mockOnSaved).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('handles non-Error exceptions', async () => {
      ;(apiClient.createTemplate as any).mockRejectedValue('String error')

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test Template' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('Failed to save template')).toBeInTheDocument()
      })
    })

    it('resets loading state after error', async () => {
      ;(apiClient.createTemplate as any).mockRejectedValue(new Error('API Error'))

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test Template' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      })

      const submitButton = screen.getByRole('button', { name: /Save Template/ })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument()
      })

      // Loading state should be reset
      expect(submitButton).not.toBeDisabled()
      expect(screen.getByText('Save Template')).toBeInTheDocument() // Not "Saving..."
    })
  })

  describe('Modal Interaction', () => {
    it('closes modal when clicking backdrop', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const backdrop = screen.getByRole('dialog').previousSibling as Element
      fireEvent.click(backdrop)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('closes modal when clicking close button', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Close modal/ }))
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('closes modal when clicking cancel button', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('prevents closing during loading', () => {
      const mockTemplate = { id: 'template-123', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTemplate), 100))
      )

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Start submission to trigger loading
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test' },
      })
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      // Try to close while loading
      const closeButton = screen.getByRole('button', { name: /Close modal/ })
      fireEvent.click(closeButton)

      // Should not close during loading
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('handles keyboard navigation properly', async () => {
      const user = userEvent.setup()

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Tab through form elements
      expect(screen.getByLabelText(/Template Name/)).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText(/Description/)).toHaveFocus()

      // More extensive tab navigation testing could be added here
    })
  })

  describe('Edge Cases', () => {
    it('handles task data with very long strings', () => {
      const longTaskData = {
        description: 'A'.repeat(1000),
        acceptanceCriteria: 'B'.repeat(1000),
        workflow: 'feature',
        autonomy: 'review-before-commit' as const,
      }

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={longTaskData}
        />
      )

      expect(screen.getByText(longTaskData.description)).toBeInTheDocument()
      expect(screen.getByText(longTaskData.acceptanceCriteria)).toBeInTheDocument()
    })

    it('handles special characters in task data', () => {
      const specialTaskData = {
        description: 'Task with <script>alert("xss")</script> & special chars',
        acceptanceCriteria: 'Criteria with "quotes" & ampersands',
        workflow: 'feature',
        autonomy: 'review-before-commit' as const,
      }

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={specialTaskData}
        />
      )

      // Should display the raw text, not execute any scripts
      expect(screen.getByText(specialTaskData.description)).toBeInTheDocument()
      expect(screen.getByText(specialTaskData.acceptanceCriteria)).toBeInTheDocument()
    })

    it('handles missing onSaved callback gracefully', async () => {
      const mockTemplate = { id: 'template-123', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockResolvedValue(mockTemplate)

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          taskData={mockTaskData}
          // onSaved is undefined
        />
      )

      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      // Should not throw error even without onSaved callback
      await waitFor(() => {
        expect(screen.getByText('Template saved successfully!')).toBeInTheDocument()
      })
    })
  })
})