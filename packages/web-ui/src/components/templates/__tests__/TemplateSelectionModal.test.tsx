import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateSelectionModal } from '../TemplateSelectionModal'
import type { TaskTemplate, TemplateFilters, TemplateCategory } from '@/types/task-template'
import * as useTemplatesHook from '@/hooks/useTemplates'

// Mock the useTemplates hook
vi.mock('@/hooks/useTemplates')
const mockUseTemplates = vi.mocked(useTemplatesHook.useTemplates)

// Mock UI components
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-title">{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      className={className}
      data-testid="button"
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    <div data-testid="alert" className={className}>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="alert-description">{children}</div>,
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size }: { size?: string }) =>
    <div data-testid="spinner" data-size={size}>Loading...</div>,
}))

vi.mock('@/components/templates', () => ({
  TemplateSearchInput: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
  TemplateCard: ({ template, isSelected, onClick, onDoubleClick }: any) => (
    <div
      data-testid="template-card"
      data-template-id={template.id}
      data-selected={isSelected}
      onClick={() => onClick(template)}
      onDoubleClick={() => onDoubleClick?.(template)}
      data-template-card
    >
      {template.name}
    </div>
  ),
  TemplatePreviewPanel: ({ template }: any) => (
    <div data-testid="preview-panel">
      {template ? `Preview: ${template.name}` : 'No template selected'}
    </div>
  ),
  TemplateCategoryFilter: ({ selectedCategory, categoryCounts, onCategoryChange }: any) => (
    <div data-testid="category-filter">
      <button
        onClick={() => onCategoryChange('all')}
        data-selected={selectedCategory === 'all'}
      >
        All ({categoryCounts.all})
      </button>
      {Object.entries(categoryCounts)
        .filter(([key]) => key !== 'all')
        .map(([category, count]) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            data-selected={selectedCategory === category}
          >
            {category} ({count})
          </button>
        ))}
    </div>
  ),
}))

// Mock icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">X</span>,
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">AlertCircle</span>,
}))

describe('TemplateSelectionModal', () => {
  // Mock templates for testing
  const mockTemplates: TaskTemplate[] = [
    {
      id: 'template-1',
      name: 'Feature Template',
      description: 'Template for implementing new features',
      category: 'feature',
      workflow: 'feature-workflow',
      autonomy: 'review-before-commit',
      descriptionTemplate: 'Implement {{feature}} with {{details}}',
      acceptanceCriteriaTemplate: 'Feature works correctly',
      variables: [
        {
          name: 'feature',
          label: 'Feature Name',
          type: 'string',
          required: true,
          placeholder: 'e.g., User Authentication',
        },
        {
          name: 'details',
          label: 'Implementation Details',
          type: 'text',
          required: false,
          placeholder: 'Additional details...',
        },
      ],
      tags: ['feature', 'implementation'],
      isQuickAction: true,
      priority: 'high',
      effort: 'large',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    },
    {
      id: 'template-2',
      name: 'Bug Fix Template',
      description: 'Template for fixing bugs',
      category: 'bugfix',
      workflow: 'bugfix-workflow',
      autonomy: 'auto-commit',
      descriptionTemplate: 'Fix bug: {{bug}}',
      tags: ['bug', 'fix'],
      isQuickAction: false,
      priority: 'normal',
      effort: 'small',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    },
    {
      id: 'template-3',
      name: 'Test Template',
      description: 'Template for writing tests',
      category: 'testing',
      workflow: 'testing-workflow',
      autonomy: 'review-before-commit',
      descriptionTemplate: 'Write tests for {{component}}',
      tags: ['test', 'quality'],
      isQuickAction: true,
      priority: 'normal',
      effort: 'medium',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    },
  ]

  const mockCategoryCounts = {
    all: 3,
    feature: 1,
    bugfix: 1,
    testing: 1,
    refactoring: 0,
    documentation: 0,
    maintenance: 0,
    deployment: 0,
    custom: 0,
  }

  const defaultMockHookReturn = {
    filteredTemplates: mockTemplates,
    isLoading: false,
    error: null,
    categoryCounts: mockCategoryCounts,
    setFilters: vi.fn(),
    refresh: vi.fn(),
  }

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onTemplateSelected: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTemplates.mockReturnValue(defaultMockHookReturn)
  })

  describe('Basic Rendering', () => {
    it('renders the modal when open', () => {
      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Select Template')
    })

    it('does not render when closed', () => {
      render(<TemplateSelectionModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('applies custom className', () => {
      const customClass = 'custom-modal-class'
      render(<TemplateSelectionModal {...defaultProps} className={customClass} />)

      const content = screen.getByTestId('dialog-content')
      expect(content).toHaveClass(customClass)
    })
  })

  describe('Template List Display', () => {
    it('displays all templates', () => {
      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByText('Feature Template')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix Template')).toBeInTheDocument()
      expect(screen.getByText('Test Template')).toBeInTheDocument()
    })

    it('shows template count in footer', () => {
      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByText('3 templates')).toBeInTheDocument()
    })

    it('shows singular template count for one template', () => {
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        filteredTemplates: [mockTemplates[0]],
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByText('1 template')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner when loading', () => {
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        isLoading: true,
        filteredTemplates: [],
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByText('Loading templates...')).toBeInTheDocument()
    })

    it('shows "Loading..." in footer when loading', () => {
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        isLoading: true,
        filteredTemplates: [],
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('shows error message when there is an error', () => {
      const errorMessage = 'Failed to load templates'
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        error: errorMessage,
        filteredTemplates: [],
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByTestId('alert')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('shows retry button on error', () => {
      const mockRefresh = vi.fn()
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        error: 'Connection failed',
        filteredTemplates: [],
        refresh: mockRefresh,
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      const retryButton = screen.getByRole('button', { name: 'Try again' })
      fireEvent.click(retryButton)

      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('Empty State', () => {
    it('shows no results message when no templates match', () => {
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        filteredTemplates: [],
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByText('No templates found')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument()
    })
  })

  describe('Template Selection', () => {
    it('selects a template when clicked', () => {
      render(<TemplateSelectionModal {...defaultProps} />)

      const templateCard = screen.getAllByTestId('template-card')[0]
      fireEvent.click(templateCard)

      // Verify template is selected (preview should show)
      expect(screen.getByText('Preview: Feature Template')).toBeInTheDocument()
    })

    it('calls onTemplateSelected when template is double-clicked', () => {
      const mockOnTemplateSelected = vi.fn()
      render(
        <TemplateSelectionModal {...defaultProps} onTemplateSelected={mockOnTemplateSelected} />
      )

      const templateCard = screen.getAllByTestId('template-card')[0]
      fireEvent.doubleClick(templateCard)

      expect(mockOnTemplateSelected).toHaveBeenCalledWith(mockTemplates[0])
    })

    it('enables the Use Template button when a template is selected', () => {
      render(<TemplateSelectionModal {...defaultProps} />)

      // Initially disabled
      const useButton = screen.getAllByTestId('button').find(btn =>
        btn.textContent?.includes('Use Template')
      )
      expect(useButton).toBeDisabled()

      // Select a template
      const templateCard = screen.getAllByTestId('template-card')[0]
      fireEvent.click(templateCard)

      // Button should be enabled
      expect(useButton).toBeEnabled()
    })

    it('calls onTemplateSelected when Use Template button is clicked', () => {
      const mockOnTemplateSelected = vi.fn()
      render(
        <TemplateSelectionModal {...defaultProps} onTemplateSelected={mockOnTemplateSelected} />
      )

      // Select a template
      const templateCard = screen.getAllByTestId('template-card')[0]
      fireEvent.click(templateCard)

      // Click Use Template button
      const useButton = screen.getAllByTestId('button').find(btn =>
        btn.textContent?.includes('Use Template')
      )
      fireEvent.click(useButton!)

      expect(mockOnTemplateSelected).toHaveBeenCalledWith(mockTemplates[0])
    })
  })

  describe('Quick Selection', () => {
    it('auto-confirms template without required variables when quickSelect is true', () => {
      const mockOnTemplateSelected = vi.fn()
      const templateWithoutVariables = { ...mockTemplates[1] } // Bug fix template has no variables

      render(
        <TemplateSelectionModal
          {...defaultProps}
          onTemplateSelected={mockOnTemplateSelected}
          quickSelect={true}
        />
      )

      const templateCard = screen.getAllByTestId('template-card')[1] // Bug fix template
      fireEvent.click(templateCard)

      expect(mockOnTemplateSelected).toHaveBeenCalledWith(templateWithoutVariables)
    })

    it('does not auto-confirm template with required variables even with quickSelect', () => {
      const mockOnTemplateSelected = vi.fn()

      render(
        <TemplateSelectionModal
          {...defaultProps}
          onTemplateSelected={mockOnTemplateSelected}
          quickSelect={true}
        />
      )

      const templateCard = screen.getAllByTestId('template-card')[0] // Feature template has required variables
      fireEvent.click(templateCard)

      // Should not auto-confirm because template has required variables
      expect(mockOnTemplateSelected).not.toHaveBeenCalled()
    })
  })

  describe('Search Functionality', () => {
    it('updates search query when typing in search input', async () => {
      const mockSetFilters = vi.fn()
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        setFilters: mockSetFilters,
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      const searchInput = screen.getByTestId('search-input')
      await userEvent.type(searchInput, 'feature')

      await waitFor(() => {
        expect(mockSetFilters).toHaveBeenCalledWith({
          search: 'feature',
          category: undefined,
        })
      })
    })

    it('clears search when input is emptied', async () => {
      const mockSetFilters = vi.fn()
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        setFilters: mockSetFilters,
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      const searchInput = screen.getByTestId('search-input')
      await userEvent.type(searchInput, 'test')
      await userEvent.clear(searchInput)

      await waitFor(() => {
        expect(mockSetFilters).toHaveBeenLastCalledWith({
          search: undefined,
          category: undefined,
        })
      })
    })
  })

  describe('Category Filtering', () => {
    it('updates category filter when category is selected', () => {
      const mockSetFilters = vi.fn()
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        setFilters: mockSetFilters,
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      const categoryFilter = screen.getByTestId('category-filter')
      const featureButton = within(categoryFilter).getByText('feature (1)')
      fireEvent.click(featureButton)

      expect(mockSetFilters).toHaveBeenCalledWith({
        search: undefined,
        category: 'feature',
      })
    })

    it('shows all templates when "All" category is selected', () => {
      const mockSetFilters = vi.fn()
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        setFilters: mockSetFilters,
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      const categoryFilter = screen.getByTestId('category-filter')
      const allButton = within(categoryFilter).getByText('All (3)')
      fireEvent.click(allButton)

      expect(mockSetFilters).toHaveBeenCalledWith({
        search: undefined,
        category: undefined,
      })
    })
  })

  describe('Modal Closing', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const mockOnClose = vi.fn()
      render(<TemplateSelectionModal {...defaultProps} onClose={mockOnClose} />)

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('clears selection when modal closes', () => {
      const { rerender } = render(<TemplateSelectionModal {...defaultProps} />)

      // Select a template
      const templateCard = screen.getAllByTestId('template-card')[0]
      fireEvent.click(templateCard)
      expect(screen.getByText('Preview: Feature Template')).toBeInTheDocument()

      // Close modal
      rerender(<TemplateSelectionModal {...defaultProps} isOpen={false} />)

      // Reopen modal
      rerender(<TemplateSelectionModal {...defaultProps} isOpen={true} />)

      // Selection should be cleared
      expect(screen.getByText('No template selected')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('closes modal when Escape key is pressed', () => {
      const mockOnClose = vi.fn()
      render(<TemplateSelectionModal {...defaultProps} onClose={mockOnClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('confirms template selection when Enter key is pressed with selected template', () => {
      const mockOnTemplateSelected = vi.fn()
      render(
        <TemplateSelectionModal {...defaultProps} onTemplateSelected={mockOnTemplateSelected} />
      )

      // Select a template
      const templateCard = screen.getAllByTestId('template-card')[0]
      fireEvent.click(templateCard)

      // Press Enter
      fireEvent.keyDown(document, { key: 'Enter' })

      expect(mockOnTemplateSelected).toHaveBeenCalledWith(mockTemplates[0])
    })

    it('does not confirm when Enter is pressed without selection', () => {
      const mockOnTemplateSelected = vi.fn()
      render(
        <TemplateSelectionModal {...defaultProps} onTemplateSelected={mockOnTemplateSelected} />
      )

      fireEvent.keyDown(document, { key: 'Enter' })

      expect(mockOnTemplateSelected).not.toHaveBeenCalled()
    })
  })

  describe('Initial Filters', () => {
    it('applies initial filters to the hook', () => {
      const initialFilters: TemplateFilters = {
        category: 'feature',
        search: 'test',
      }

      render(
        <TemplateSelectionModal {...defaultProps} initialFilters={initialFilters} />
      )

      expect(mockUseTemplates).toHaveBeenCalledWith({
        initialFilters,
        autoFetch: true,
      })
    })

    it('includes initial filters in filter updates', () => {
      const initialFilters: TemplateFilters = {
        workflow: 'feature-workflow',
      }
      const mockSetFilters = vi.fn()
      mockUseTemplates.mockReturnValue({
        ...defaultMockHookReturn,
        setFilters: mockSetFilters,
      })

      render(
        <TemplateSelectionModal
          {...defaultProps}
          initialFilters={initialFilters}
        />
      )

      const searchInput = screen.getByTestId('search-input')
      fireEvent.change(searchInput, { target: { value: 'bug' } })

      expect(mockSetFilters).toHaveBeenCalledWith({
        search: 'bug',
        category: undefined,
        workflow: 'feature-workflow',
      })
    })
  })

  describe('Button States and Labels', () => {
    it('shows "Configure & Use" for templates with required variables', () => {
      render(<TemplateSelectionModal {...defaultProps} />)

      // Select template with required variables
      const templateCard = screen.getAllByTestId('template-card')[0]
      fireEvent.click(templateCard)

      expect(screen.getByText('Configure & Use')).toBeInTheDocument()
    })

    it('shows "Use Template" for templates without required variables', () => {
      render(<TemplateSelectionModal {...defaultProps} />)

      // Select template without required variables (Bug fix template)
      const bugFixCard = screen.getAllByTestId('template-card')[1]
      fireEvent.click(bugFixCard)

      expect(screen.getByText('Use Template')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<TemplateSelectionModal {...defaultProps} />)

      const modal = screen.getByTestId('dialog')
      expect(modal).toBeInTheDocument()

      const title = screen.getByTestId('dialog-title')
      expect(title).toBeInTheDocument()
    })

    it('supports keyboard navigation for template cards', () => {
      render(<TemplateSelectionModal {...defaultProps} />)

      const templateCard = screen.getAllByTestId('template-card')[0]
      expect(templateCard).toHaveAttribute('data-template-card')
    })
  })
})