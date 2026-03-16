import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ContextInjectionModal } from '../ContextInjectionModal'
import { apiClient } from '@/lib/api-client'
import type { InjectContextResponse } from '@apexcli/core'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    injectContext: vi.fn(),
  },
}))

const mockApiClient = apiClient as {
  injectContext: ReturnType<typeof vi.fn>
}

describe('ContextInjectionModal', () => {
  const defaultProps = {
    isOpen: true,
    taskId: 'test-task-123',
    onClose: vi.fn(),
    onInjected: vi.fn(),
  }

  const mockSuccessResponse: InjectContextResponse = {
    ok: true,
    taskId: 'test-task-123',
    contextInjected: true,
    timestamp: new Date('2024-01-01T10:00:00Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApiClient.injectContext.mockResolvedValue(mockSuccessResponse)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<ContextInjectionModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should render modal when isOpen is true', () => {
      render(<ContextInjectionModal {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()
      expect(screen.getByLabelText('Context *')).toBeInTheDocument()
      expect(screen.getByLabelText('Source (optional)')).toBeInTheDocument()
      expect(screen.getByText('Priority')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /inject context/i })).toBeInTheDocument()
    })

    it('should have context textarea focused on open', () => {
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      expect(textarea).toHaveFocus()
    })

    it('should display modal title', () => {
      render(<ContextInjectionModal {...defaultProps} taskId="my-special-task" />)

      // The component should have a clear modal title
      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()
    })

    it('should show priority options', () => {
      render(<ContextInjectionModal {...defaultProps} />)

      expect(screen.getByText('Low')).toBeInTheDocument()
      expect(screen.getByText('Normal')).toBeInTheDocument()
      expect(screen.getByText('High')).toBeInTheDocument()
      expect(screen.getByText('Standard context (Recommended)')).toBeInTheDocument()
    })

    it('should have Normal priority selected by default', () => {
      render(<ContextInjectionModal {...defaultProps} />)

      const normalOption = screen.getByText('Normal').closest('button')
      expect(normalOption).toHaveClass('border-apex-500', 'bg-apex-500/10')
    })
  })

  describe('Form Behavior', () => {
    it('should disable submit button when context is empty', () => {
      render(<ContextInjectionModal {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: /inject context/i })
      expect(submitButton).toBeDisabled()
    })

    it('should enable submit button when context has value', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Some context information')
      })

      const submitButton = screen.getByRole('button', { name: /inject context/i })
      expect(submitButton).toBeEnabled()
    })

    it('should update character count as user types', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Hello')
      })

      expect(screen.getByText('99,995 characters remaining')).toBeInTheDocument()
    })

    it('should show error when exceeding character limit', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      const longText = 'a'.repeat(100001)

      await act(async () => {
        fireEvent.change(textarea, { target: { value: longText } })
      })

      expect(screen.getByText(/exceeds limit by/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /inject context/i })).toBeDisabled()
    })

    it('should update source character count', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const sourceInput = screen.getByLabelText('Source (optional)')
      await act(async () => {
        await user.type(sourceInput, 'Test')
      })

      expect(screen.getByText('4/50 characters')).toBeInTheDocument()
    })

    it('should allow priority selection', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const highOption = screen.getByText('High').closest('button')!
      await act(async () => {
        await user.click(highOption)
      })

      expect(highOption).toHaveClass('border-apex-500', 'bg-apex-500/10')

      const normalOption = screen.getByText('Normal').closest('button')
      expect(normalOption).not.toHaveClass('border-apex-500', 'bg-apex-500/10')
    })
  })

  describe('Form Validation', () => {
    it('should show error for empty context submission', async () => {
      render(<ContextInjectionModal {...defaultProps} />)

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      expect(screen.getByText('Context is required')).toBeInTheDocument()
      expect(mockApiClient.injectContext).not.toHaveBeenCalled()
    })

    it('should show error for context exceeding limit', async () => {
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      const longText = 'a'.repeat(100001)

      await act(async () => {
        fireEvent.change(textarea, { target: { value: longText } })
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      expect(screen.getByText('Context cannot exceed 100,000 characters')).toBeInTheDocument()
      expect(mockApiClient.injectContext).not.toHaveBeenCalled()
    })

    it('should trim whitespace from context', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, '  Some context  ')
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalledWith('test-task-123', {
          context: 'Some context',
          priority: 'normal',
        })
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading state during submission', async () => {
      const user = userEvent.setup()
      let resolvePromise: (value: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockApiClient.injectContext.mockReturnValue(pendingPromise)

      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Some context')
      })

      const submitButton = screen.getByRole('button', { name: /inject context/i })
      await act(async () => {
        await user.click(submitButton)
      })

      expect(screen.getByText('Injecting...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()

      // Resolve the promise to clean up
      act(() => {
        resolvePromise!(mockSuccessResponse)
      })
    })

    it('should disable all inputs during loading', async () => {
      const user = userEvent.setup()
      let resolvePromise: (value: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockApiClient.injectContext.mockReturnValue(pendingPromise)

      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Some context')
      })

      const submitButton = screen.getByRole('button', { name: /inject context/i })
      await act(async () => {
        await user.click(submitButton)
      })

      expect(textarea).toBeDisabled()
      expect(screen.getByLabelText('Source (optional)')).toBeDisabled()

      // Priority buttons should be disabled
      const priorityButtons = screen.getAllByText(/Low|Normal|High/).map(el => el.closest('button'))
      priorityButtons.forEach(button => {
        expect(button).toBeDisabled()
      })

      // Resolve the promise to clean up
      act(() => {
        resolvePromise!(mockSuccessResponse)
      })
    })

    it('should disable close button during loading', async () => {
      const user = userEvent.setup()
      let resolvePromise: (value: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockApiClient.injectContext.mockReturnValue(pendingPromise)

      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Some context')
      })

      const submitButton = screen.getByRole('button', { name: /inject context/i })
      await act(async () => {
        await user.click(submitButton)
      })

      const closeButton = screen.getByLabelText(/close modal/i)
      expect(closeButton).toBeDisabled()

      // Resolve the promise to clean up
      act(() => {
        resolvePromise!(mockSuccessResponse)
      })
    })
  })

  describe('API Integration', () => {
    it('should call API with correct parameters', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      const sourceInput = screen.getByLabelText('Source (optional)')

      await act(async () => {
        await user.type(textarea, 'Important context information')
        await user.type(sourceInput, 'User feedback')
      })

      const highOption = screen.getByText('High').closest('button')!
      await act(async () => {
        await user.click(highOption)
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalledWith('test-task-123', {
          context: 'Important context information',
          source: 'User feedback',
          priority: 'high',
        })
      })
    })

    it('should omit empty source from request', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Context without source')
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalledWith('test-task-123', {
          context: 'Context without source',
          priority: 'normal',
        })
      })
    })
  })

  describe('Callbacks', () => {
    it('should call onClose when cancel clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<ContextInjectionModal {...defaultProps} onClose={onClose} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await act(async () => {
        await user.click(cancelButton)
      })

      expect(onClose).toHaveBeenCalled()
    })

    it('should call onClose when backdrop clicked', async () => {
      const onClose = vi.fn()
      render(<ContextInjectionModal {...defaultProps} onClose={onClose} />)

      const backdrop = screen.getByRole('dialog').previousElementSibling as HTMLElement
      await act(async () => {
        fireEvent.click(backdrop)
      })

      expect(onClose).toHaveBeenCalled()
    })

    it('should not close when backdrop clicked during loading', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      let resolvePromise: (value: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockApiClient.injectContext.mockReturnValue(pendingPromise)

      render(<ContextInjectionModal {...defaultProps} onClose={onClose} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Some context')
      })

      const submitButton = screen.getByRole('button', { name: /inject context/i })
      await act(async () => {
        await user.click(submitButton)
      })

      const backdrop = screen.getByRole('dialog').previousElementSibling as HTMLElement
      await act(async () => {
        fireEvent.click(backdrop)
      })

      expect(onClose).not.toHaveBeenCalled()

      // Resolve the promise to clean up
      act(() => {
        resolvePromise!(mockSuccessResponse)
      })
    })

    it('should call onInjected on successful submission', async () => {
      const user = userEvent.setup()
      const onInjected = vi.fn()
      render(<ContextInjectionModal {...defaultProps} onInjected={onInjected} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Success context')
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(onInjected).toHaveBeenCalledWith(mockSuccessResponse)
      })
    })

    it('should call onClose after successful submission', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<ContextInjectionModal {...defaultProps} onClose={onClose} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Success context')
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('should reset form state after successful submission', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      const sourceInput = screen.getByLabelText('Source (optional)')

      await act(async () => {
        await user.type(textarea, 'Test context')
        await user.type(sourceInput, 'Test source')
      })

      const highOption = screen.getByText('High').closest('button')!
      await act(async () => {
        await user.click(highOption)
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(textarea).toHaveValue('')
        expect(sourceInput).toHaveValue('')

        // Priority should reset to normal
        const normalOption = screen.getByText('Normal').closest('button')
        expect(normalOption).toHaveClass('border-apex-500', 'bg-apex-500/10')
      })
    })
  })

  describe('Error Handling', () => {
    it('should display API error messages', async () => {
      const user = userEvent.setup()
      const errorMessage = 'Context injection failed: Task not found'
      mockApiClient.injectContext.mockRejectedValue(new Error(errorMessage))

      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Error context')
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should display generic error for non-Error objects', async () => {
      const user = userEvent.setup()
      mockApiClient.injectContext.mockRejectedValue('String error')

      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Error context')
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText('Failed to inject context')).toBeInTheDocument()
      })
    })

    it('should preserve form state on error', async () => {
      const user = userEvent.setup()
      mockApiClient.injectContext.mockRejectedValue(new Error('API Error'))

      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      const sourceInput = screen.getByLabelText('Source (optional)')

      await act(async () => {
        await user.type(textarea, 'Error context')
        await user.type(sourceInput, 'Error source')
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument()
      })

      // Form state should be preserved
      expect(textarea).toHaveValue('Error context')
      expect(sourceInput).toHaveValue('Error source')
    })

    it('should clear error on new input', async () => {
      const user = userEvent.setup()
      mockApiClient.injectContext.mockRejectedValue(new Error('API Error'))

      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Error context')
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument()
      })

      // Clear and type new content
      await act(async () => {
        await user.clear(textarea)
        await user.type(textarea, 'New context')
      })

      expect(screen.queryByText('API Error')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper form structure', () => {
      render(<ContextInjectionModal {...defaultProps} />)

      expect(screen.getByRole('form')).toBeInTheDocument()
      expect(screen.getByLabelText('Context *')).toBeInTheDocument()
      expect(screen.getByLabelText('Source (optional)')).toBeInTheDocument()
    })

    it('should have proper button roles', () => {
      render(<ContextInjectionModal {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /inject context/i })).toBeInTheDocument()
    })

    it('should indicate required fields', () => {
      render(<ContextInjectionModal {...defaultProps} />)

      const requiredIndicator = screen.getByText('*')
      expect(requiredIndicator).toBeInTheDocument()
    })

    it('should have proper dialog accessibility', () => {
      render(<ContextInjectionModal {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long source input within maxLength', async () => {
      const user = userEvent.setup()
      render(<ContextInjectionModal {...defaultProps} />)

      const sourceInput = screen.getByLabelText('Source (optional)')
      const maxLengthText = 'a'.repeat(50)

      await act(async () => {
        await user.type(sourceInput, maxLengthText)
      })

      expect(screen.getByText('50/50 characters')).toBeInTheDocument()
    })

    it('should handle form submission with only whitespace in context', async () => {
      render(<ContextInjectionModal {...defaultProps} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        fireEvent.change(textarea, { target: { value: '   \n\t   ' } })
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      expect(screen.getByText('Context is required')).toBeInTheDocument()
      expect(mockApiClient.injectContext).not.toHaveBeenCalled()
    })

    it('should handle missing onInjected callback gracefully', async () => {
      const user = userEvent.setup()
      const { onInjected, ...propsWithoutCallback } = defaultProps
      render(<ContextInjectionModal {...propsWithoutCallback} />)

      const textarea = screen.getByLabelText('Context *')
      await act(async () => {
        await user.type(textarea, 'Test context')
      })

      const form = screen.getByRole('form')
      await act(async () => {
        fireEvent.submit(form)
      })

      // Should not throw error and should still call API
      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalled()
      })
    })
  })
})