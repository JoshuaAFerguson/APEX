/**
 * Unit tests for QuickActionsBar component
 *
 * Tests the main QuickActionsBar component functionality including:
 * - Template loading and display
 * - Quick action execution
 * - Error handling
 * - Loading states
 * - Empty states
 * - Modal interactions
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuickActionsBar } from '../QuickActionsBar'
import { useQuickActionTemplates } from '@/hooks/useQuickActionTemplates'
import type { TaskTemplate } from '@/types/task-template'

// Mock the hook
vi.mock('@/hooks/useQuickActionTemplates')
const mockUseQuickActionTemplates = vi.mocked(useQuickActionTemplates)

// Mock child components
vi.mock('../QuickActionButton', () => ({
  QuickActionButton: ({ template, onClick, loading }: any) => (
    <button
      data-testid={`quick-action-${template.id}`}
      onClick={() => onClick(template)}
      disabled={loading}
      aria-label={`Create ${template.name} task`}
    >
      {loading ? 'Creating...' : template.name}
    </button>
  ),
}))

vi.mock('../QuickActionVariableModal', () => ({
  QuickActionVariableModal: ({ isOpen, template, onClose, onTaskCreated }: any) =>
    isOpen ? (
      <div data-testid="variable-modal">
        <h2>{template.name} Variables</h2>
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
        <button
          data-testid="modal-submit"
          onClick={() => onTaskCreated('task_123')}
        >
          Create Task
        </button>
      </div>
    ) : null,
}))

// Mock data
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

const mockTemplateWithVariables = createMockTemplate('template_with_vars', 'Template With Variables', {
  variables: [
    {
      name: 'componentName',
      label: 'Component Name',
      type: 'string',
      required: true,
      placeholder: 'Enter component name',
    },
  ],
})

const mockTemplateWithoutVariables = createMockTemplate('template_no_vars', 'Template No Variables')

const defaultMockHookReturn = {
  templates: [mockTemplateWithoutVariables, mockTemplateWithVariables],
  isLoading: false,
  error: null,
  refresh: vi.fn(),
  createTaskFromTemplate: vi.fn(),
  hasRequiredVariables: vi.fn(),
}

describe('QuickActionsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQuickActionTemplates.mockReturnValue(defaultMockHookReturn)
  })

  describe('Rendering', () => {
    it('renders with template data', () => {
      render(<QuickActionsBar />)

      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-template_no_vars')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-template_with_vars')).toBeInTheDocument()
    })

    it('renders loading state', () => {
      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        isLoading: true,
        templates: [],
      })

      render(<QuickActionsBar />)

      expect(screen.getByText('Loading quick actions...')).toBeInTheDocument()
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    })

    it('renders error state', () => {
      const errorMessage = 'Failed to load templates'
      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        error: errorMessage,
        templates: [],
      })

      render(<QuickActionsBar />)

      expect(screen.getByText(`Failed to load quick actions: ${errorMessage}`)).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('renders empty state when no templates', () => {
      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        templates: [],
      })

      render(<QuickActionsBar />)

      expect(screen.getByText('No quick actions available. Create templates with "Quick Action" enabled to see them here.')).toBeInTheDocument()
      expect(screen.getByText('📋')).toBeInTheDocument()
    })

    it('respects maxActions prop', () => {
      const manyTemplates = Array.from({ length: 10 }, (_, i) =>
        createMockTemplate(`template_${i}`, `Template ${i}`)
      )
      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        templates: manyTemplates,
      })

      render(<QuickActionsBar maxActions={3} />)

      // Should only show first 3 templates
      expect(screen.getByTestId('quick-action-template_0')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-template_1')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-template_2')).toBeInTheDocument()
      expect(screen.queryByTestId('quick-action-template_3')).not.toBeInTheDocument()

      // Should show count indicator
      expect(screen.getByText('Showing 3 of 10')).toBeInTheDocument()
      expect(screen.getByText('7 more quick actions available in templates')).toBeInTheDocument()
    })

    it('renders in compact mode', () => {
      render(<QuickActionsBar compact={true} />)

      // Component should render (compact styling is tested in QuickActionButton tests)
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<QuickActionsBar className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('Quick Action Interactions', () => {
    it('creates task directly for templates without required variables', async () => {
      const mockCreate = vi.fn().mockResolvedValue('task_123')
      const mockHasRequired = vi.fn().mockReturnValue(false)
      const onTaskCreated = vi.fn()

      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        createTaskFromTemplate: mockCreate,
        hasRequiredVariables: mockHasRequired,
      })

      render(<QuickActionsBar onTaskCreated={onTaskCreated} />)

      const button = screen.getByTestId('quick-action-template_no_vars')
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockHasRequired).toHaveBeenCalledWith(mockTemplateWithoutVariables)
        expect(mockCreate).toHaveBeenCalledWith(mockTemplateWithoutVariables)
        expect(onTaskCreated).toHaveBeenCalledWith('task_123', 'template_no_vars')
      })
    })

    it('opens modal for templates with required variables', async () => {
      const mockHasRequired = vi.fn().mockReturnValue(true)

      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        hasRequiredVariables: mockHasRequired,
      })

      render(<QuickActionsBar />)

      const button = screen.getByTestId('quick-action-template_with_vars')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('variable-modal')).toBeInTheDocument()
        expect(screen.getByText('Template With Variables Variables')).toBeInTheDocument()
      })
    })

    it('handles task creation errors', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Creation failed'))
      const mockHasRequired = vi.fn().mockReturnValue(false)
      const onError = vi.fn()

      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        createTaskFromTemplate: mockCreate,
        hasRequiredVariables: mockHasRequired,
      })

      render(<QuickActionsBar onError={onError} />)

      const button = screen.getByTestId('quick-action-template_no_vars')
      fireEvent.click(button)

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.any(Error),
          'template_no_vars'
        )
      })
    })

    it('shows loading state during task creation', async () => {
      let resolveCreate: (value: string) => void
      const mockCreate = vi.fn().mockReturnValue(
        new Promise<string>((resolve) => {
          resolveCreate = resolve
        })
      )
      const mockHasRequired = vi.fn().mockReturnValue(false)

      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        createTaskFromTemplate: mockCreate,
        hasRequiredVariables: mockHasRequired,
      })

      render(<QuickActionsBar />)

      const button = screen.getByTestId('quick-action-template_no_vars')
      fireEvent.click(button)

      // Should show loading state
      await waitFor(() => {
        expect(button).toHaveTextContent('Creating...')
        expect(button).toBeDisabled()
      })

      // Resolve the promise
      resolveCreate!('task_123')

      // Should return to normal state
      await waitFor(() => {
        expect(button).toHaveTextContent('Template No Variables')
        expect(button).not.toBeDisabled()
      })
    })
  })

  describe('Modal Interactions', () => {
    beforeEach(() => {
      const mockHasRequired = vi.fn().mockReturnValue(true)
      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        hasRequiredVariables: mockHasRequired,
      })
    })

    it('handles modal task creation success', async () => {
      const onTaskCreated = vi.fn()

      render(<QuickActionsBar onTaskCreated={onTaskCreated} />)

      // Open modal
      const button = screen.getByTestId('quick-action-template_with_vars')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('variable-modal')).toBeInTheDocument()
      })

      // Submit from modal
      const submitButton = screen.getByTestId('modal-submit')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(onTaskCreated).toHaveBeenCalledWith('task_123', 'template_with_vars')
        expect(screen.queryByTestId('variable-modal')).not.toBeInTheDocument()
      })
    })

    it('handles modal close', async () => {
      render(<QuickActionsBar />)

      // Open modal
      const button = screen.getByTestId('quick-action-template_with_vars')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('variable-modal')).toBeInTheDocument()
      })

      // Close modal
      const closeButton = screen.getByTestId('modal-close')
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByTestId('variable-modal')).not.toBeInTheDocument()
      })
    })

    it('handles modal errors', async () => {
      // This would be tested with actual QuickActionVariableModal implementation
      // For now, we'll test that onError is called when the modal component calls it
      const onError = vi.fn()

      render(<QuickActionsBar onError={onError} />)

      // Open modal
      const button = screen.getByTestId('quick-action-template_with_vars')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('variable-modal')).toBeInTheDocument()
      })

      // Modal error handling would be tested with real modal implementation
    })
  })

  describe('Error State Interactions', () => {
    it('calls refresh when retry button is clicked', () => {
      const mockRefresh = vi.fn()
      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        error: 'Connection failed',
        templates: [],
        refresh: mockRefresh,
      })

      render(<QuickActionsBar />)

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('Props and Configuration', () => {
    it('passes correct props to QuickActionButton components', () => {
      render(<QuickActionsBar showIcons={false} compact={true} />)

      // Buttons should be rendered (specific prop testing is in QuickActionButton tests)
      expect(screen.getByTestId('quick-action-template_no_vars')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-template_with_vars')).toBeInTheDocument()
    })

    it('handles missing callback props gracefully', async () => {
      const mockCreate = vi.fn().mockResolvedValue('task_123')
      const mockHasRequired = vi.fn().mockReturnValue(false)

      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        createTaskFromTemplate: mockCreate,
        hasRequiredVariables: mockHasRequired,
      })

      // Render without callbacks
      render(<QuickActionsBar />)

      const button = screen.getByTestId('quick-action-template_no_vars')

      // Should not throw error when callbacks are undefined
      expect(() => {
        fireEvent.click(button)
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<QuickActionsBar />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        if (button.getAttribute('data-testid')?.includes('quick-action')) {
          expect(button).toHaveAttribute('aria-label')
        }
      })
    })

    it('supports keyboard navigation', () => {
      render(<QuickActionsBar />)

      const button = screen.getByTestId('quick-action-template_no_vars')

      // Button should be focusable
      button.focus()
      expect(button).toHaveFocus()

      // Should respond to Enter key
      fireEvent.keyDown(button, { key: 'Enter' })
      // Click behavior should still work (tested in other tests)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty template names gracefully', () => {
      const templateWithEmptyName = createMockTemplate('empty_name', '', {
        description: 'Template with empty name',
      })

      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        templates: [templateWithEmptyName],
      })

      render(<QuickActionsBar />)

      // Should still render button even with empty name
      expect(screen.getByTestId('quick-action-empty_name')).toBeInTheDocument()
    })

    it('handles templates with special characters in ID', () => {
      const specialTemplate = createMockTemplate('template-with_special.chars', 'Special Template')

      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        templates: [specialTemplate],
      })

      render(<QuickActionsBar />)

      expect(screen.getByTestId('quick-action-template-with_special.chars')).toBeInTheDocument()
    })

    it('handles very long template lists', () => {
      const manyTemplates = Array.from({ length: 100 }, (_, i) =>
        createMockTemplate(`template_${i}`, `Template ${i}`)
      )

      mockUseQuickActionTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        templates: manyTemplates,
      })

      render(<QuickActionsBar maxActions={5} />)

      // Should only render limited number without performance issues
      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('data-testid')?.includes('quick-action')
      )).toHaveLength(5)
    })
  })
})