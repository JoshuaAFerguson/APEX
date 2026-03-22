import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

const mockTaskData = {
  description: 'Component test task description',
  acceptanceCriteria: 'Component test acceptance criteria',
  workflow: 'feature',
  autonomy: 'review-before-commit' as const,
}

describe('SaveTemplateModal - Component Behavior Tests', () => {
  const mockOnClose = vi.fn()
  const mockOnSaved = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('Auto-close Behavior', () => {
    it('auto-closes after successful save with correct timing', async () => {
      const mockTemplate = { id: 'auto-close-test', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockResolvedValue(mockTemplate)

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Fill form and submit
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Auto Close Test' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Testing auto-close behavior' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('Template saved successfully!')).toBeInTheDocument()
      })

      // onSaved should be called immediately
      expect(mockOnSaved).toHaveBeenCalledWith('auto-close-test')

      // onClose should not be called yet
      expect(mockOnClose).not.toHaveBeenCalled()

      // Fast-forward 1500ms (the auto-close delay)
      act(() => {
        vi.advanceTimersByTime(1500)
      })

      // Now onClose should be called
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('prevents auto-close if modal is closed manually during success delay', async () => {
      const mockTemplate = { id: 'manual-close-test', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockResolvedValue(mockTemplate)

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Fill form and submit
      fireEvent.change(screen.getByLabelText(/Template Name/), {
        target: { value: 'Manual Close Test' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Testing manual close during success' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('Template saved successfully!')).toBeInTheDocument()
      })

      // Close manually before auto-close triggers
      fireEvent.click(screen.getByRole('button', { name: 'Done' }))

      // Should call onClose immediately
      expect(mockOnClose).toHaveBeenCalledTimes(1)

      // Fast-forward time - onClose shouldn't be called again
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(mockOnClose).toHaveBeenCalledTimes(1) // Still only once
    })
  })

  describe('Form Input Validation Edge Cases', () => {
    it('handles maxLength constraints correctly', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

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

      // Test name maxLength (100 characters)
      const exactLimit = 'a'.repeat(100)
      await user.type(nameInput, exactLimit)
      expect(nameInput).toHaveValue(exactLimit)
      expect(screen.getByText('100/100 characters')).toBeInTheDocument()

      // Browser should prevent typing beyond maxLength
      await user.type(nameInput, 'x')
      expect(nameInput).toHaveValue(exactLimit) // Should still be 100 chars

      // Test description maxLength (500 characters)
      const descLimit = 'b'.repeat(500)
      await user.type(descInput, descLimit)
      expect(descInput).toHaveValue(descLimit)
      expect(screen.getByText('500/500 characters')).toBeInTheDocument()
    })

    it('handles special characters and encoding properly', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const nameInput = screen.getByLabelText(/Template Name/)
      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)

      // Test HTML entities and special characters
      const specialName = 'Template with <script>&amp;"quotes"</script>'
      await user.type(nameInput, specialName)
      expect(nameInput).toHaveValue(specialName)

      // Test emoji and unicode in tags
      await user.type(tagInput, '🚀emoji-tag{Enter}')
      expect(screen.getByText('🚀emoji-tag')).toBeInTheDocument()

      // Test various unicode characters
      await user.type(tagInput, 'café{Enter}')
      await user.type(tagInput, '北京{Enter}')
      await user.type(tagInput, 'Москва{Enter}')

      expect(screen.getByText('café')).toBeInTheDocument()
      expect(screen.getByText('北京')).toBeInTheDocument()
      expect(screen.getByText('москва')).toBeInTheDocument() // Should be lowercase
    })

    it('handles copy-paste operations correctly', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const nameInput = screen.getByLabelText(/Template Name/)

      // Simulate paste operation with very long text
      const longText = 'a'.repeat(200) // Longer than 100 char limit
      await user.click(nameInput)

      // Simulate paste by setting value directly (simulating browser paste behavior)
      fireEvent.change(nameInput, { target: { value: longText } })

      // Input should be truncated to maxLength
      expect(nameInput.value.length).toBeLessThanOrEqual(100)
    })
  })

  describe('Dynamic UI Updates', () => {
    it('updates button states dynamically based on form validity', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

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
      const submitButton = screen.getByRole('button', { name: /Save Template/ })

      // Initially disabled
      expect(submitButton).toBeDisabled()

      // Add name only - still disabled
      await user.type(nameInput, 'Test Name')
      expect(submitButton).toBeDisabled()

      // Add description - should enable
      await user.type(descInput, 'Test Description')
      expect(submitButton).not.toBeDisabled()

      // Clear name - should disable again
      await user.clear(nameInput)
      expect(submitButton).toBeDisabled()

      // Re-add name - should enable again
      await user.type(nameInput, 'Test Name Again')
      expect(submitButton).not.toBeDisabled()

      // Clear description - should disable
      await user.clear(descInput)
      expect(submitButton).toBeDisabled()
    })

    it('updates character counts in real-time', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

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

      // Initial counts
      expect(screen.getByText('0/100 characters')).toBeInTheDocument()
      expect(screen.getByText('0/500 characters')).toBeInTheDocument()

      // Type incrementally and check updates
      await user.type(nameInput, 'Test')
      expect(screen.getByText('4/100 characters')).toBeInTheDocument()

      await user.type(nameInput, ' Template')
      expect(screen.getByText('13/100 characters')).toBeInTheDocument()

      await user.type(descInput, 'A')
      expect(screen.getByText('1/500 characters')).toBeInTheDocument()

      await user.type(descInput, ' description')
      expect(screen.getByText('13/500 characters')).toBeInTheDocument()

      // Test backspace
      await user.keyboard('{Backspace>3}') // Remove 3 characters
      expect(screen.getByText('10/500 characters')).toBeInTheDocument()
    })

    it('updates tag counter dynamically', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)

      // Initial state
      expect(screen.getByText('0/10 tags • Press Enter to add')).toBeInTheDocument()

      // Add tags and check counter updates
      await user.type(tagInput, 'tag1{Enter}')
      expect(screen.getByText('1/10 tags • Press Enter to add')).toBeInTheDocument()

      await user.type(tagInput, 'tag2{Enter}')
      expect(screen.getByText('2/10 tags • Press Enter to add')).toBeInTheDocument()

      // Remove a tag
      const removeButton = screen.getByLabelText('Remove tag1 tag')
      await user.click(removeButton)
      expect(screen.getByText('1/10 tags • Press Enter to add')).toBeInTheDocument()

      // Add more tags to test limit
      for (let i = 2; i <= 10; i++) {
        await user.type(tagInput, `tag${i}{Enter}`)
      }

      expect(screen.getByText('10/10 tags • Press Enter to add')).toBeInTheDocument()
      expect(tagInput).toBeDisabled()
    })
  })

  describe('Error State Management', () => {
    it('clears errors when user corrects input', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

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
      const submitButton = screen.getByRole('button', { name: /Save Template/ })

      // Trigger validation errors
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Template name is required')).toBeInTheDocument()
      })

      // Start typing in name field - error should clear
      await user.type(nameInput, 'T')
      expect(screen.queryByText('Template name is required')).not.toBeInTheDocument()

      // Submit again to trigger description error
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Template description is required')).toBeInTheDocument()
      })

      // Start typing in description field - error should clear
      await user.type(descInput, 'D')
      expect(screen.queryByText('Template description is required')).not.toBeInTheDocument()
    })

    it('handles multiple error states correctly', async () => {
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
      const submitButton = screen.getByRole('button', { name: /Save Template/ })

      // Test length validation
      const longName = 'a'.repeat(101)
      fireEvent.change(nameInput, { target: { value: longName } })
      fireEvent.change(descInput, { target: { value: 'Valid description' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Template name cannot exceed 100 characters')).toBeInTheDocument()
      })

      // Fix name but break description
      fireEvent.change(nameInput, { target: { value: 'Valid name' } })
      fireEvent.change(descInput, { target: { value: 'a'.repeat(501) } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Template description cannot exceed 500 characters')).toBeInTheDocument()
      })

      // Previous error should be gone
      expect(screen.queryByText('Template name cannot exceed 100 characters')).not.toBeInTheDocument()
    })

    it('preserves form state through error cycles', async () => {
      ;(apiClient.createTemplate as any).mockRejectedValue(new Error('Server Error'))

      render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      const nameValue = 'Error Cycle Test'
      const descValue = 'Testing error state preservation'

      // Fill form
      fireEvent.change(screen.getByLabelText(/Template Name/), { target: { value: nameValue } })
      fireEvent.change(screen.getByLabelText(/Description/), { target: { value: descValue } })

      // Select category and add tags
      fireEvent.click(screen.getByRole('button', { name: /Feature/ }))

      const tagInput = screen.getByPlaceholderText(/Add tags to help organize/)
      fireEvent.change(tagInput, { target: { value: 'error-test' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      // Submit and get error
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      await waitFor(() => {
        expect(screen.getByText('Server Error')).toBeInTheDocument()
      })

      // Verify all form state is preserved
      expect(screen.getByDisplayValue(nameValue)).toBeInTheDocument()
      expect(screen.getByDisplayValue(descValue)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Feature/ })).toHaveClass('border-apex-500')
      expect(screen.getByText('error-test')).toBeInTheDocument()
    })
  })

  describe('Loading State Management', () => {
    it('disables all interactive elements during loading', async () => {
      const mockTemplate = { id: 'loading-test', name: 'Test Template' }
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
        target: { value: 'Loading Test' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Testing loading states' },
      })

      // Start submission
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      // Check that all elements are disabled during loading
      expect(screen.getByLabelText(/Template Name/)).toBeDisabled()
      expect(screen.getByLabelText(/Description/)).toBeDisabled()
      expect(screen.getByRole('button', { name: /Feature/ })).toBeDisabled()
      expect(screen.getByPlaceholderText(/Add tags to help organize/)).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Cancel/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Close modal/ })).toBeDisabled()

      // Wait for completion
      await waitFor(() => {
        expect(mockOnSaved).toHaveBeenCalled()
      }, { timeout: 200 })
    })

    it('shows proper loading indicators', async () => {
      const mockTemplate = { id: 'loading-indicator-test', name: 'Test Template' }
      ;(apiClient.createTemplate as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTemplate), 50))
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
        target: { value: 'Loading Indicator Test' },
      })
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Testing loading indicators' },
      })

      // Start submission
      fireEvent.click(screen.getByRole('button', { name: /Save Template/ }))

      // Check for loading text and spinner
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Saving/ })).toBeInTheDocument()

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Template saved successfully!')).toBeInTheDocument()
      }, { timeout: 100 })
    })
  })

  describe('Component Lifecycle', () => {
    it('handles rapid open/close cycles', () => {
      const { rerender } = render(
        <SaveTemplateModal
          isOpen={false}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      // Rapidly toggle open state
      for (let i = 0; i < 5; i++) {
        rerender(
          <SaveTemplateModal
            isOpen={true}
            onClose={mockOnClose}
            onSaved={mockOnSaved}
            taskData={mockTaskData}
          />
        )

        rerender(
          <SaveTemplateModal
            isOpen={false}
            onClose={mockOnClose}
            onSaved={mockOnSaved}
            taskData={mockTaskData}
          />
        )
      }

      // Should end in closed state
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('cleans up resources on unmount', () => {
      const { unmount } = render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={mockTaskData}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      unmount()

      // Should not have any timers or listeners left
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('handles prop changes correctly', () => {
      const initialTaskData = {
        description: 'Initial description',
        workflow: 'feature',
        autonomy: 'review-before-commit' as const,
      }

      const updatedTaskData = {
        description: 'Updated description',
        workflow: 'bugfix',
        autonomy: 'autonomous' as const,
      }

      const { rerender } = render(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={initialTaskData}
        />
      )

      expect(screen.getByText('Initial description')).toBeInTheDocument()
      expect(screen.getByText(/Workflow:.*feature/)).toBeInTheDocument()

      // Update props
      rerender(
        <SaveTemplateModal
          isOpen={true}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
          taskData={updatedTaskData}
        />
      )

      expect(screen.getByText('Updated description')).toBeInTheDocument()
      expect(screen.getByText(/Workflow:.*bugfix/)).toBeInTheDocument()
      expect(screen.getByText(/Autonomy:.*autonomous/)).toBeInTheDocument()
    })
  })
})