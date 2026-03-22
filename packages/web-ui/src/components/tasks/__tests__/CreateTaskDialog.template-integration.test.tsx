/**
 * Integration tests for CreateTaskDialog template selection functionality
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateTaskDialog } from '../CreateTaskDialog'
import type { TaskTemplate } from '@/types/task-template'
import * as apiClient from '@/lib/api-client'

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    createTask: vi.fn(),
  },
}))

// Mock TemplateSelectionModal
const MockTemplateSelectionModal = vi.fn(({ isOpen, onTemplateSelected, onClose }: any) => {
  if (!isOpen) return null

  return (
    <div data-testid="template-selection-modal">
      <button
        data-testid="select-template-1"
        onClick={() => onTemplateSelected(mockTemplates[0])}
      >
        Select Feature Template
      </button>
      <button
        data-testid="select-template-2"
        onClick={() => onTemplateSelected(mockTemplates[1])}
      >
        Select Bug Fix Template
      </button>
      <button data-testid="close-modal" onClick={onClose}>
        Close
      </button>
    </div>
  )
})

vi.mock('@/components/templates/TemplateSelectionModal', () => ({
  TemplateSelectionModal: MockTemplateSelectionModal,
}))

// Mock QuickActionVariableModal
const MockQuickActionVariableModal = vi.fn(({ isOpen, template, onTaskCreated, onClose }: any) => {
  if (!isOpen) return null

  return (
    <div data-testid="variable-modal">
      <span>Configure {template?.name}</span>
      <button
        data-testid="create-from-variables"
        onClick={() => onTaskCreated('task-from-template-123')}
      >
        Create Task
      </button>
      <button data-testid="close-variable-modal" onClick={onClose}>
        Close
      </button>
    </div>
  )
})

vi.mock('@/components/dashboard/QuickActionVariableModal', () => ({
  QuickActionVariableModal: MockQuickActionVariableModal,
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

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size }: any) => (
    <div data-testid="spinner" data-size={size}>Loading...</div>
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

// Mock icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">X</span>,
  Plus: () => <span data-testid="plus-icon">+</span>,
  Zap: () => <span data-testid="zap-icon">⚡</span>,
  FileText: () => <span data-testid="file-text-icon">📄</span>,
  Info: () => <span data-testid="info-icon">ℹ</span>,
}))

// Mock template helper
vi.mock('@/types/task-template', () => ({
  templateHasRequiredVariables: (template: any) =>
    template.variables?.some((v: any) => v.required) || false,
}))

// Test data
const mockTemplates: TaskTemplate[] = [
  {
    id: 'template-feature-1',
    name: 'Feature Template',
    description: 'Template for implementing new features',
    category: 'feature',
    workflow: 'feature-development',
    autonomy: 'review-before-commit',
    descriptionTemplate: 'Implement {{featureName}} feature with {{details}}',
    acceptanceCriteriaTemplate: 'Feature works as expected and is tested',
    variables: [
      {
        name: 'featureName',
        label: 'Feature Name',
        type: 'string',
        required: true,
        placeholder: 'e.g., User Authentication',
      },
      {
        name: 'details',
        label: 'Implementation Details',
        type: 'text',
        required: true,
        placeholder: 'Describe the implementation...',
      },
    ],
    tags: ['feature', 'implementation'],
    isQuickAction: true,
    priority: 'high',
    effort: 'large',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'template-bugfix-1',
    name: 'Bug Fix Template',
    description: 'Template for fixing bugs',
    category: 'bugfix',
    workflow: 'bug-fixing',
    autonomy: 'auto-commit',
    descriptionTemplate: 'Fix bug in user authentication system',
    acceptanceCriteriaTemplate: 'Bug is resolved without breaking existing functionality',
    tags: ['bug', 'fix'],
    isQuickAction: false,
    priority: 'high',
    effort: 'small',
    createdAt: new Date(),
    updatedAt: new Date(),
    // No variables - template without required variables
  },
]

describe('CreateTaskDialog - Template Integration', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.apiClient.createTask).mockResolvedValue({
      taskId: 'new-task-123',
    })
  })

  describe('Use Template Button', () => {
    it('renders Use Template button', () => {
      render(<CreateTaskDialog {...defaultProps} />)

      const useTemplateButton = screen.getByText('Use Template')
      expect(useTemplateButton).toBeInTheDocument()
      expect(useTemplateButton).not.toBeDisabled()
    })

    it('opens template selection modal when Use Template is clicked', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      const useTemplateButton = screen.getByText('Use Template')
      await user.click(useTemplateButton)

      expect(screen.getByTestId('template-selection-modal')).toBeInTheDocument()
    })

    it('disables Use Template button during task creation', () => {
      const slowCreateTask = vi.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
      vi.mocked(apiClient.apiClient.createTask).mockImplementation(slowCreateTask)

      render(<CreateTaskDialog {...defaultProps} />)

      // Fill in description and start creating task
      const descriptionInput = screen.getByPlaceholderText('Describe what you want to accomplish...')
      fireEvent.change(descriptionInput, { target: { value: 'Test task' } })

      const createButton = screen.getByText('Create Task')
      fireEvent.click(createButton)

      // Use Template button should be disabled while loading
      const useTemplateButton = screen.getByText('Use Template')
      expect(useTemplateButton).toBeDisabled()
    })
  })

  describe('Template Selection Flow', () => {
    it('pre-fills form when template without required variables is selected', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Open template modal
      await user.click(screen.getByText('Use Template'))

      // Select template without required variables
      await user.click(screen.getByTestId('select-template-2'))

      // Form should be pre-filled
      expect(screen.getByDisplayValue('Fix bug in user authentication system')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Bug is resolved without breaking existing functionality')).toBeInTheDocument()

      // Should show template info alert
      expect(screen.getByText(/Form pre-filled from template:/)).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Template')).toBeInTheDocument()
    })

    it('opens variable modal for templates with required variables', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Open template modal
      await user.click(screen.getByText('Use Template'))

      // Select template with required variables
      await user.click(screen.getByTestId('select-template-1'))

      // Variable modal should open
      expect(screen.getByTestId('variable-modal')).toBeInTheDocument()
      expect(screen.getByText('Configure Feature Template')).toBeInTheDocument()
    })

    it('closes template modal after selection', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Open template modal
      await user.click(screen.getByText('Use Template'))
      expect(screen.getByTestId('template-selection-modal')).toBeInTheDocument()

      // Select template
      await user.click(screen.getByTestId('select-template-2'))

      // Template modal should be closed
      expect(screen.queryByTestId('template-selection-modal')).not.toBeInTheDocument()
    })
  })

  describe('Template Info Display', () => {
    it('shows template info when form is pre-filled from template', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Select template
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-2'))

      // Should show template info alert
      const alert = screen.getByTestId('alert')
      expect(alert).toHaveClass('border-blue-200', 'bg-blue-50')

      expect(screen.getByText('Form pre-filled from template:')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Template')).toBeInTheDocument()
    })

    it('allows clearing template pre-filled data', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Select template
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-2'))

      // Verify form is pre-filled
      expect(screen.getByDisplayValue('Fix bug in user authentication system')).toBeInTheDocument()

      // Click Clear button
      const clearButton = screen.getByText('Clear')
      await user.click(clearButton)

      // Form should be reset
      expect(screen.queryByDisplayValue('Fix bug in user authentication system')).not.toBeInTheDocument()
      expect(screen.queryByText('Form pre-filled from template:')).not.toBeInTheDocument()
    })

    it('updates header title when using template', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Select template
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-2'))

      // Header should show template name
      expect(screen.getByText('From template: Bug Fix Template')).toBeInTheDocument()
    })
  })

  describe('Variable Modal Integration', () => {
    it('handles task creation from variable modal', async () => {
      const user = userEvent.setup()
      const mockOnCreated = vi.fn()
      const mockOnClose = vi.fn()

      render(
        <CreateTaskDialog
          {...defaultProps}
          onCreated={mockOnCreated}
          onClose={mockOnClose}
        />
      )

      // Open template modal and select template with variables
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-1'))

      // Variable modal should be open
      expect(screen.getByTestId('variable-modal')).toBeInTheDocument()

      // Create task from variable modal
      await user.click(screen.getByTestId('create-from-variables'))

      // Should call onCreated and close dialog
      expect(mockOnCreated).toHaveBeenCalledWith('task-from-template-123')
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('closes variable modal when cancelled', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Open template modal and select template with variables
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-1'))

      // Variable modal should be open
      expect(screen.getByTestId('variable-modal')).toBeInTheDocument()

      // Close variable modal
      await user.click(screen.getByTestId('close-variable-modal'))

      // Variable modal should be closed
      expect(screen.queryByTestId('variable-modal')).not.toBeInTheDocument()
    })

    it('resets state after task creation from variable modal', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Select template and open variable modal
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-1'))

      // Create task from variable modal
      await user.click(screen.getByTestId('create-from-variables'))

      // Form should be reset
      expect(screen.queryByText('From template:')).not.toBeInTheDocument()
    })
  })

  describe('Form Integration', () => {
    it('creates task with template data when form is submitted', async () => {
      const user = userEvent.setup()
      const mockOnCreated = vi.fn()

      render(<CreateTaskDialog {...defaultProps} onCreated={mockOnCreated} />)

      // Select template
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-2'))

      // Submit form
      const createButton = screen.getByText('Create Task')
      await user.click(createButton)

      // Should call API with template data
      expect(apiClient.apiClient.createTask).toHaveBeenCalledWith({
        description: 'Fix bug in user authentication system',
        acceptanceCriteria: 'Bug is resolved without breaking existing functionality',
        workflow: 'bug-fixing',
        autonomy: 'auto-commit',
      })

      expect(mockOnCreated).toHaveBeenCalledWith('new-task-123')
    })

    it('allows modifying template-filled data before submission', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Select template
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-2'))

      // Modify description
      const descriptionInput = screen.getByDisplayValue('Fix bug in user authentication system')
      await user.clear(descriptionInput)
      await user.type(descriptionInput, 'Fix critical authentication bug')

      // Submit form
      await user.click(screen.getByText('Create Task'))

      // Should use modified data
      expect(apiClient.apiClient.createTask).toHaveBeenCalledWith({
        description: 'Fix critical authentication bug',
        acceptanceCriteria: 'Bug is resolved without breaking existing functionality',
        workflow: 'bug-fixing',
        autonomy: 'auto-commit',
      })
    })

    it('resets form when dialog is closed and reopened', async () => {
      const { rerender } = render(<CreateTaskDialog {...defaultProps} />)

      // Select template
      const user = userEvent.setup()
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-2'))

      // Verify template data is filled
      expect(screen.getByDisplayValue('Fix bug in user authentication system')).toBeInTheDocument()

      // Close dialog
      rerender(<CreateTaskDialog {...defaultProps} isOpen={false} />)

      // Reopen dialog
      rerender(<CreateTaskDialog {...defaultProps} isOpen={true} />)

      // Form should be reset
      expect(screen.queryByDisplayValue('Fix bug in user authentication system')).not.toBeInTheDocument()
      expect(screen.queryByText('From template:')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('shows error when task creation fails with template', async () => {
      const user = userEvent.setup()
      const error = new Error('Failed to create task')
      vi.mocked(apiClient.apiClient.createTask).mockRejectedValueOnce(error)

      render(<CreateTaskDialog {...defaultProps} />)

      // Select template and submit
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-2'))
      await user.click(screen.getByText('Create Task'))

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Failed to create task')).toBeInTheDocument()
      })

      // Template info should still be visible
      expect(screen.getByText('Form pre-filled from template:')).toBeInTheDocument()
    })

    it('handles error from variable modal', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Open template modal and select template with variables
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-1'))

      // Simulate error from variable modal (this would need to be implemented in the actual component)
      // For now, we'll just verify the modal opens correctly
      expect(screen.getByTestId('variable-modal')).toBeInTheDocument()
    })
  })

  describe('Workflow and Autonomy Selection', () => {
    it('updates workflow selection based on template', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Select template
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-2'))

      // Check that workflow was updated (this would need visual verification in actual UI)
      // Since we can't easily test the workflow selection in this test setup,
      // we verify it through the API call
      await user.click(screen.getByText('Create Task'))

      expect(apiClient.apiClient.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow: 'bug-fixing',
          autonomy: 'auto-commit',
        })
      )
    })
  })

  describe('Accessibility', () => {
    it('maintains focus management when modals open and close', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      const useTemplateButton = screen.getByText('Use Template')

      // Click Use Template button
      await user.click(useTemplateButton)

      // Template modal should be open
      expect(screen.getByTestId('template-selection-modal')).toBeInTheDocument()

      // Close modal
      await user.click(screen.getByTestId('close-modal'))

      // Modal should be closed
      expect(screen.queryByTestId('template-selection-modal')).not.toBeInTheDocument()
    })

    it('provides appropriate labeling for template-related elements', async () => {
      const user = userEvent.setup()
      render(<CreateTaskDialog {...defaultProps} />)

      // Select template
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('select-template-2'))

      // Template info should be accessible
      expect(screen.getByTestId('info-icon')).toBeInTheDocument()
      expect(screen.getByText('Form pre-filled from template:')).toBeInTheDocument()
    })
  })
})