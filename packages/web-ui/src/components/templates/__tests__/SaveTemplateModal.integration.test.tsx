import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaveTemplateModal } from '../SaveTemplateModal'
import { apiClient } from '@/lib/api-client'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    createTemplate: vi.fn(),
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">X</span>,
  Save: () => <span data-testid="save-icon">Save</span>,
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
  Tag: () => <span data-testid="tag-icon">Tag</span>,
  Layers: () => <span data-testid="layers-icon">Layers</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">AlertCircle</span>,
  Loader2: () => <span data-testid="loader2-icon">Loading</span>,
}))

// Mock Spinner component
vi.mock('@/components/ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}))

// Mock UI components
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, type, size }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      type={type}
      data-testid="button"
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children, className }: any) => (
    <div data-testid="alert" className={className}>{children}</div>
  ),
  AlertDescription: ({ children }: any) => (
    <div data-testid="alert-description">{children}</div>
  ),
}))

const mockTaskData = {
  description: 'Integration test task description',
  acceptanceCriteria: 'Integration test acceptance criteria',
  workflow: 'feature',
  autonomy: 'review-before-commit' as const,
}

describe('SaveTemplateModal - Integration Tests', () => {
  const mockOnClose = vi.fn()
  const mockOnSaved = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any existing timers
    vi.clearAllTimers()
  })

  describe('Keyboard Interactions', () => {
    it('supports full keyboard navigation through all form elements', async () => {
      const user = userEvent.setup()

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Start at the name input (should be auto-focused)
      expect(screen.getByLabelText(/Template Name/)).toHaveFocus()

      // Tab to description
      await user.tab()
      expect(screen.getByLabelText(/Description/)).toHaveFocus()

      // Tab through category buttons
      await user.tab()
      const firstCategory = screen.getByRole('button', { name: /Feature/ })
      expect(firstCategory).toHaveFocus()

      // Arrow keys should work between category buttons
      await user.keyboard('{ArrowRight}')
      expect(screen.getByRole('button', { name: /Bug Fix/ })).toHaveFocus()

      // Space or Enter should select category
      await user.keyboard('{Enter}')
      expect(screen.getByRole('button', { name: /Bug Fix/ })).toHaveClass('border-apex-500')

      // Continue tabbing to tags input
      await user.tab()
      expect(screen.getByPlaceholderText(/Add tags to help organize/)).toHaveFocus()

      // Tab to Add button
      await user.tab()
      expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus()

      // Tab to Cancel button
      await user.tab()
      expect(screen.getByRole('button', { name: /Cancel/ })).toHaveFocus()

      // Tab to Submit button
      await user.tab()
      expect(screen.getByRole('button', { name: /Save Template/ })).toHaveFocus()

      // Tab to Close button
      await user.tab()
      expect(screen.getByRole('button', { name: /Close modal/ })).toHaveFocus()
    })

    it('handles Escape key to close modal', async () => {
      const user = userEvent.setup()

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      await user.keyboard('{Escape}')
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('prevents Escape from closing during loading', async () => {
      const user = userEvent.setup()
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

      // Fill form and submit to trigger loading
      await user.type(screen.getByLabelText(/Template Name/), 'Test Name')
      await user.type(screen.getByLabelText(/Description/), 'Test Description')
      await user.click(screen.getByRole('button', { name: /Save Template/ }))

      // Try to press Escape during loading
      await user.keyboard('{Escape}')
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('supports form submission with Enter key', async () => {
      const user = userEvent.setup()
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
      await user.type(screen.getByLabelText(/Template Name/), 'Keyboard Test')
      await user.type(screen.getByLabelText(/Description/), 'Testing keyboard submission')

      // Submit with Enter while focused on submit button
      await user.tab() // Tab to category (already filled above)
      await user.tab() // Tab to tags
      await user.tab() // Tab to Add button
      await user.tab() // Tab to Cancel
      await user.tab() // Tab to Submit button

      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(apiClient.createTemplate).toHaveBeenCalled()
      })
    })

    it('handles complex tag management with keyboard', async () => {
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

      // Add multiple tags with Enter
      await user.click(tagInput)
      await user.type(tagInput, 'react{Enter}')
      await user.type(tagInput, 'frontend{Enter}')
      await user.type(tagInput, 'component{Enter}')

      expect(screen.getByText('react')).toBeInTheDocument()
      expect(screen.getByText('frontend')).toBeInTheDocument()
      expect(screen.getByText('component')).toBeInTheDocument()

      // Remove last tag with backspace
      await user.keyboard('{Backspace}')
      expect(screen.queryByText('component')).not.toBeInTheDocument()

      // Add another tag
      await user.type(tagInput, 'typescript{Enter}')
      expect(screen.getByText('typescript')).toBeInTheDocument()
    })
  })

  describe('Accessibility Features', () => {
    it('has proper ARIA labels and roles', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Modal should have dialog role and proper labeling
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')

      // Form should have proper role
      expect(screen.getByRole('form')).toBeInTheDocument()

      // Required fields should be properly marked
      expect(screen.getByLabelText(/Template Name/)).toHaveAttribute('required')

      // Close button should have aria-label
      expect(screen.getByRole('button', { name: /Close modal/ })).toHaveAttribute('aria-label', 'Close modal')

      // Tag remove buttons should have proper labels
      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      fireEvent.change(tagInput, { target: { value: 'test-tag' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      expect(screen.getByLabelText('Remove test-tag tag')).toBeInTheDocument()
    })

    it('supports screen reader announcements for dynamic content', async () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Character count should be announced
      const nameInput = screen.getByLabelText(/Template Name/)
      fireEvent.change(nameInput, { target: { value: 'Test' } })

      expect(screen.getByText('4/100 characters')).toBeInTheDocument()

      // Tag count should be updated
      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      fireEvent.change(tagInput, { target: { value: 'tag1' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      expect(screen.getByText('1/10 tags • Press Enter to add')).toBeInTheDocument()
    })

    it('provides proper focus management', async () => {
      const user = userEvent.setup()

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // When modal opens, focus should be on the name input
      expect(screen.getByLabelText(/Template Name/)).toHaveFocus()

      // When removing tags, focus should return to input
      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      await user.click(tagInput)
      await user.type(tagInput, 'test{Enter}')

      const removeButton = screen.getByLabelText('Remove test tag')
      await user.click(removeButton)

      // Focus should return to tag input after removal
      expect(tagInput).toHaveFocus()
    })

    it('handles high contrast and color accessibility', () => {
      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Required field indicators should be visible
      const requiredIndicators = screen.getAllByText('*')
      expect(requiredIndicators).toHaveLength(2) // Name and Description

      // Error states should be clearly marked
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      waitFor(() => {
        const errorText = screen.getByText('Template name is required')
        expect(errorText).toHaveClass('text-red-700') // Should have error color
      })
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('recovers from network failures and allows retry', async () => {
      let failCount = 0
      const mockTemplate = { id: 'template-123', name: 'Test Template' }

      ;(apiClient.createTemplate as any).mockImplementation(() => {
        failCount++
        if (failCount === 1) {
          return Promise.reject(new Error('Network timeout'))
        }
        return Promise.resolve(mockTemplate)
      })

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
        target: { value: 'Retry Test' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Testing retry functionality' },
      })

      // First attempt - should fail
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('Network timeout')).toBeInTheDocument()
      })

      // Form should still be usable
      expect(screen.getByLabelText(/Template Name/)).not.toBeDisabled()
      expect(screen.getByRole('button', { name: /Save Template/ })).not.toBeDisabled()

      // Second attempt - should succeed
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(mockOnSaved).toHaveBeenCalledWith('template-123')
      })
    })

    it('maintains form data during temporary errors', async () => {
      ;(apiClient.createTemplate as any).mockRejectedValue(new Error('Temporary error'))

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const nameValue = 'Persistent Test Template'
      const descValue = 'This data should persist through errors'

      // Fill form
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: nameValue },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: descValue },
      })

      // Select category
      fireEvent.click(screen.getByRole('button', { name: /Testing/ }))

      // Add tags
      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      fireEvent.change(tagInput, { target: { value: 'persistent' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      // Submit and get error
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('Temporary error')).toBeInTheDocument()
      })

      // All form data should be preserved
      expect(screen.getByDisplayValue(nameValue)).toBeInTheDocument()
      expect(screen.getByDisplayValue(descValue)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Testing/ })).toHaveClass('border-apex-500')
      expect(screen.getByText('persistent')).toBeInTheDocument()
    })

    it('handles validation errors after API errors', async () => {
      ;(apiClient.createTemplate as any).mockRejectedValue(new Error('API Error'))

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
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test' },
      })

      // Submit and get API error
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument()
      })

      // Clear name field to trigger validation
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: '' },
      })

      // Try to submit again - should show validation error, not API error
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('Template name is required')).toBeInTheDocument()
      })

      // API error should be cleared
      expect(screen.queryByText('API Error')).not.toBeInTheDocument()
    })

    it('handles edge case with rapid successive submissions', async () => {
      const mockTemplate = { id: 'template-123', name: 'Test Template' }
      let callCount = 0

      ;(apiClient.createTemplate as any).mockImplementation(() => {
        callCount++
        return new Promise(resolve =>
          setTimeout(() => resolve(mockTemplate), 50)
        )
      })

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
        target: { value: 'Rapid Test' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Testing rapid submission' },
      })

      const submitButton = screen.getByRole('button', { name: /Save Template/ })

      // Rapidly click submit multiple times
      fireEvent.click(submitButton)
      fireEvent.click(submitButton)
      fireEvent.click(submitButton)

      // Should be disabled after first click
      expect(submitButton).toBeDisabled()

      await waitFor(() => {
        expect(mockOnSaved).toHaveBeenCalledWith('template-123')
      })

      // API should only be called once
      expect(callCount).toBe(1)
    })
  })

  describe('Complex Integration Scenarios', () => {
    it('completes full workflow from open to close', async () => {
      const user = userEvent.setup()
      const mockTemplate = { id: 'template-456', name: 'Complete Test' }
      ;(apiClient.createTemplate as any).mockResolvedValue(mockTemplate)

      const { rerender } = render(
        <SaveTemplateModal
          isOpen={false}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Modal should not be visible
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      // Open modal
      rerender(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Modal should be visible and focused
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText(/Template Name/)).toHaveFocus()

      // Complete form using keyboard only
      await user.type(screen.getByLabelText(/Template Name/), 'Complete Workflow Template')
      await user.tab()
      await user.type(screen.getByLabelText(/Description/), 'A comprehensive template for testing the complete workflow')

      // Navigate to categories and select one
      await user.tab()
      await user.keyboard('{ArrowRight}{ArrowRight}') // Navigate to Refactoring
      await user.keyboard('{Enter}') // Select Refactoring

      // Add tags
      await user.tab()
      await user.type(screen.getByPlaceholderText(/Add tags to help organize/), 'workflow{Enter}')
      await user.type(screen.getByPlaceholderText(/Add tags to help organize/), 'integration{Enter}')
      await user.type(screen.getByPlaceholderText(/Add tags to help organize/), 'testing{Enter}')

      // Submit
      await user.tab() // Skip Add button
      await user.tab() // Skip Cancel
      await user.keyboard('{Enter}') // Submit

      // Wait for success
      await waitFor(() => {
        expect(mockOnSaved).toHaveBeenCalledWith('template-456')
      })

      // Verify API call
      expect(apiClient.createTemplate).toHaveBeenCalledWith({
        name: 'Complete Workflow Template',
        description: 'A comprehensive template for testing the complete workflow',
        category: 'refactoring',
        workflow: 'feature',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Integration test task description',
        acceptanceCriteriaTemplate: 'Integration test acceptance criteria',
        tags: ['workflow', 'integration', 'testing'],
        isQuickAction: false,
        priority: 'normal',
        effort: 'medium',
      })

      // Success message should appear
      expect(screen.getByText('Template saved successfully!')).toBeInTheDocument()
    })

    it('handles modal reopening with different task data', async () => {
      const alternateTaskData = {
        description: 'Different task description',
        acceptanceCriteria: 'Different acceptance criteria',
        workflow: 'bugfix',
        autonomy: 'autonomous' as const,
      }

      const { rerender } = render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Verify initial data
      expect(screen.getByText('Integration test task description')).toBeInTheDocument()
      expect(screen.getByText(/Workflow:.*feature/)).toBeInTheDocument()

      // Close modal
      rerender(
        <SaveTemplateModal
          isOpen={false}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Reopen with different data
      rerender(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={alternateTaskData}
        />
      )

      // Should show new data
      expect(screen.getByText('Different task description')).toBeInTheDocument()
      expect(screen.getByText(/Workflow:.*bugfix/)).toBeInTheDocument()
      expect(screen.getByText(/Autonomy:.*autonomous/)).toBeInTheDocument()
    })

    it('preserves user preferences across modal sessions', async () => {
      const user = userEvent.setup()

      const { rerender } = render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // User makes some choices
      await user.click(screen.getByRole('button', { name: /Documentation/ }))

      // Close modal
      rerender(
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

      // Form should be reset to defaults
      expect(screen.getByRole('button', { name: /Custom/ })).toHaveClass('border-apex-500')
      expect(screen.getByLabelText(/Template Name/)).toHaveValue('')
    })
  })

  describe('Performance and Edge Cases', () => {
    it('handles large numbers of tags efficiently', () => {
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

      // Add maximum number of tags
      for (let i = 1; i <= 10; i++) {
        fireEvent.change(tagInput, { target: { value: `tag${i}` } })
        fireEvent.click(addButton)
      }

      // All tags should be visible
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByText(`tag${i}`)).toBeInTheDocument()
      }

      // Input should be disabled
      expect(tagInput).toBeDisabled()
      expect(addButton).toBeDisabled()
    })

    it('handles Unicode and international characters', async () => {
      const user = userEvent.setup()
      const mockTemplate = { id: 'unicode-test', name: 'Unicode Template' }
      ;(apiClient.createTemplate as any).mockResolvedValue(mockTemplate)

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const unicodeName = 'テンプレート名前 🚀 émojis et caractères spéciaux'
      const unicodeDesc = 'Описание с кириллицей и 中文字符'

      await user.type(screen.getByLabelText(/Template Name/), unicodeName)
      await user.type(screen.getByLabelText(/Description/), unicodeDesc)

      // Add unicode tags
      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      await user.type(tagInput, '日本語{Enter}')
      await user.type(tagInput, 'русский{Enter}')

      await user.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(apiClient.createTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: unicodeName,
            description: unicodeDesc,
            tags: ['日本語', 'русский'],
          })
        )
      })
    })

    it('maintains performance with rapid input changes', async () => {
      const user = userEvent.setup()

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const nameInput = screen.getByLabelText(/Template Name/)

      // Rapid typing simulation
      const longText = 'A very long template name that exceeds normal length expectations for testing purposes'

      // Type rapidly
      await user.type(nameInput, longText)

      // Character count should update correctly
      expect(screen.getByText(`${longText.length}/100 characters`)).toBeInTheDocument()

      // Form should remain responsive
      expect(nameInput).toHaveValue(longText)
    })
  })
})