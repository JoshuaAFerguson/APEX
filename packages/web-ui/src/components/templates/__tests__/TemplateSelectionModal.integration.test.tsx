import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateSelectionModal } from '../TemplateSelectionModal'
import type { TaskTemplate, UseTemplatesReturn } from '@/types/task-template'
import * as useTemplatesHook from '@/hooks/useTemplates'

// Mock the useTemplates hook
vi.mock('@/hooks/useTemplates')
const mockUseTemplates = vi.mocked(useTemplatesHook.useTemplates)

// Mock external dependencies
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTemplates: vi.fn(),
  },
}))

// Mock UI components with more realistic implementations
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => {
    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && open) {
          onOpenChange(false)
        }
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open, onOpenChange])

    return open ? <div data-testid="dialog">{children}</div> : null
  },
  DialogContent: ({ children, className }: any) =>
    <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: any) =>
    <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) =>
    <div data-testid="dialog-title">{children}</div>,
  DialogFooter: ({ children }: any) =>
    <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-testid="button"
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children, className }: any) =>
    <div data-testid="alert" className={className}>{children}</div>,
  AlertDescription: ({ children }: any) =>
    <div data-testid="alert-description">{children}</div>,
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}))

// Mock template components with more interactive behavior
vi.mock('@/components/templates', () => ({
  TemplateSearchInput: ({ value, onChange, placeholder }: any) => {
    const [internalValue, setInternalValue] = React.useState(value || '')

    React.useEffect(() => {
      setInternalValue(value || '')
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setInternalValue(newValue)
      onChange(newValue)
    }

    return (
      <input
        data-testid="search-input"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
      />
    )
  },
  TemplateCard: ({ template, isSelected, onClick, onDoubleClick }: any) => (
    <div
      data-testid="template-card"
      data-template-id={template.id}
      data-selected={isSelected}
      onClick={() => onClick(template)}
      onDoubleClick={() => onDoubleClick?.(template)}
      data-template-card
      style={{
        border: isSelected ? '2px solid blue' : '1px solid gray',
        padding: '8px',
        margin: '4px',
        cursor: 'pointer',
      }}
    >
      <div data-testid="template-name">{template.name}</div>
      <div data-testid="template-description">{template.description}</div>
      <div data-testid="template-category">{template.category}</div>
      <div data-testid="template-tags">{template.tags.join(', ')}</div>
    </div>
  ),
  TemplatePreviewPanel: ({ template }: any) => (
    <div data-testid="preview-panel">
      {template ? (
        <div>
          <h3 data-testid="preview-title">{template.name}</h3>
          <p data-testid="preview-description">{template.description}</p>
          <div data-testid="preview-workflow">Workflow: {template.workflow}</div>
          <div data-testid="preview-autonomy">Autonomy: {template.autonomy}</div>
          {template.variables && template.variables.length > 0 && (
            <div data-testid="preview-variables">
              Variables: {template.variables.length}
            </div>
          )}
        </div>
      ) : (
        <div data-testid="preview-empty">No template selected</div>
      )}
    </div>
  ),
  TemplateCategoryFilter: ({ selectedCategory, categoryCounts, onCategoryChange }: any) => {
    const categories = ['all', 'feature', 'bugfix', 'testing', 'refactoring', 'documentation', 'maintenance', 'deployment', 'custom']

    return (
      <div data-testid="category-filter">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            data-testid={`category-${category}`}
            data-selected={selectedCategory === category}
            style={{
              backgroundColor: selectedCategory === category ? 'blue' : 'white',
              color: selectedCategory === category ? 'white' : 'black',
              margin: '2px',
              padding: '4px 8px',
            }}
          >
            {category} ({categoryCounts[category] || 0})
          </button>
        ))}
      </div>
    )
  },
}))

describe('TemplateSelectionModal Integration Tests', () => {
  // Comprehensive test data
  const mockTemplates: TaskTemplate[] = [
    {
      id: 'feature-template',
      name: 'Feature Implementation',
      description: 'Template for implementing new features with comprehensive requirements',
      category: 'feature',
      workflow: 'feature-workflow',
      autonomy: 'review-before-commit',
      descriptionTemplate: 'Implement {{featureName}} feature with {{requirements}}',
      acceptanceCriteriaTemplate: 'Feature meets requirements and passes all tests',
      variables: [
        {
          name: 'featureName',
          label: 'Feature Name',
          type: 'string',
          required: true,
          placeholder: 'e.g., User Profile Management',
        },
        {
          name: 'requirements',
          label: 'Requirements',
          type: 'text',
          required: true,
          placeholder: 'Detailed requirements...',
        },
      ],
      tags: ['feature', 'implementation', 'frontend'],
      isQuickAction: true,
      priority: 'high',
      effort: 'large',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 'bugfix-template',
      name: 'Bug Fix',
      description: 'Template for fixing bugs and issues',
      category: 'bugfix',
      workflow: 'hotfix-workflow',
      autonomy: 'auto-commit',
      descriptionTemplate: 'Fix: {{bugDescription}}',
      acceptanceCriteriaTemplate: 'Bug is resolved and no regression occurs',
      tags: ['bug', 'fix', 'urgent'],
      isQuickAction: true,
      priority: 'high',
      effort: 'small',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-10'),
    },
    {
      id: 'testing-template',
      name: 'Test Implementation',
      description: 'Template for writing comprehensive tests',
      category: 'testing',
      workflow: 'testing-workflow',
      autonomy: 'review-before-commit',
      descriptionTemplate: 'Write tests for {{component}} covering {{scenarios}}',
      variables: [
        {
          name: 'component',
          label: 'Component to Test',
          type: 'string',
          required: true,
          placeholder: 'e.g., UserAuthService',
        },
        {
          name: 'scenarios',
          label: 'Test Scenarios',
          type: 'multiselect',
          required: false,
          options: [
            { label: 'Unit Tests', value: 'unit' },
            { label: 'Integration Tests', value: 'integration' },
            { label: 'Edge Cases', value: 'edge' },
          ],
        },
      ],
      tags: ['test', 'quality', 'automation'],
      isQuickAction: false,
      priority: 'normal',
      effort: 'medium',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-12'),
    },
    {
      id: 'refactor-template',
      name: 'Code Refactoring',
      description: 'Template for refactoring existing code',
      category: 'refactoring',
      workflow: 'refactor-workflow',
      autonomy: 'review-before-commit',
      descriptionTemplate: 'Refactor {{codeSection}} to improve {{goals}}',
      variables: [
        {
          name: 'codeSection',
          label: 'Code Section',
          type: 'string',
          required: true,
        },
        {
          name: 'goals',
          label: 'Refactoring Goals',
          type: 'multiselect',
          required: true,
          options: [
            { label: 'Performance', value: 'performance' },
            { label: 'Maintainability', value: 'maintainability' },
            { label: 'Readability', value: 'readability' },
          ],
        },
      ],
      tags: ['refactor', 'performance', 'maintainability'],
      isQuickAction: false,
      priority: 'normal',
      effort: 'medium',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-08'),
    },
    {
      id: 'doc-template',
      name: 'Documentation',
      description: 'Template for creating and updating documentation',
      category: 'documentation',
      workflow: 'documentation-workflow',
      autonomy: 'auto-commit',
      descriptionTemplate: 'Update documentation for {{subject}}',
      tags: ['docs', 'documentation'],
      isQuickAction: true,
      priority: 'low',
      effort: 'small',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-05'),
    },
  ]

  const mockCategoryCounts = {
    all: mockTemplates.length,
    feature: mockTemplates.filter(t => t.category === 'feature').length,
    bugfix: mockTemplates.filter(t => t.category === 'bugfix').length,
    testing: mockTemplates.filter(t => t.category === 'testing').length,
    refactoring: mockTemplates.filter(t => t.category === 'refactoring').length,
    documentation: mockTemplates.filter(t => t.category === 'documentation').length,
    maintenance: 0,
    deployment: 0,
    custom: 0,
  }

  let mockSetFilters: ReturnType<typeof vi.fn>
  let mockRefresh: ReturnType<typeof vi.fn>

  const createMockHookReturn = (overrides?: Partial<UseTemplatesReturn>): UseTemplatesReturn => ({
    filteredTemplates: mockTemplates,
    isLoading: false,
    error: null,
    categoryCounts: mockCategoryCounts,
    setFilters: mockSetFilters,
    refresh: mockRefresh,
    ...overrides,
  })

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onTemplateSelected: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetFilters = vi.fn()
    mockRefresh = vi.fn()
    mockUseTemplates.mockReturnValue(createMockHookReturn())
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Complete Template Selection Workflow', () => {
    it('completes full template selection workflow', async () => {
      const user = userEvent.setup()
      const onTemplateSelected = vi.fn()

      render(
        <TemplateSelectionModal {...defaultProps} onTemplateSelected={onTemplateSelected} />
      )

      // 1. Modal should be open and show all templates
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getAllByTestId('template-card')).toHaveLength(5)

      // 2. Search for specific templates
      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'feature')

      expect(mockSetFilters).toHaveBeenCalledWith({
        search: 'feature',
        category: undefined,
      })

      // 3. Filter by category
      const categoryFilter = screen.getByTestId('category-filter')
      const featureButton = within(categoryFilter).getByTestId('category-feature')
      await user.click(featureButton)

      expect(mockSetFilters).toHaveBeenCalledWith({
        search: 'feature',
        category: 'feature',
      })

      // 4. Select a template
      const featureTemplate = screen.getByTestId('template-card')
      await user.click(featureTemplate)

      // Preview should show template details
      expect(screen.getByTestId('preview-title')).toHaveTextContent('Feature Implementation')
      expect(screen.getByTestId('preview-workflow')).toHaveTextContent('feature-workflow')
      expect(screen.getByTestId('preview-variables')).toHaveTextContent('Variables: 2')

      // 5. Confirm selection
      const useButton = screen.getByText('Configure & Use')
      expect(useButton).toBeEnabled()
      await user.click(useButton)

      expect(onTemplateSelected).toHaveBeenCalledWith(mockTemplates[0])
    })

    it('handles quick template selection for templates without variables', async () => {
      const user = userEvent.setup()
      const onTemplateSelected = vi.fn()

      render(
        <TemplateSelectionModal
          {...defaultProps}
          onTemplateSelected={onTemplateSelected}
          quickSelect={true}
        />
      )

      // Select template without variables (bug fix template)
      const bugfixCard = screen.getAllByTestId('template-card')[1]
      await user.click(bugfixCard)

      // Should auto-confirm since template has no required variables
      expect(onTemplateSelected).toHaveBeenCalledWith(mockTemplates[1])
    })

    it('does not quick-select templates with required variables', async () => {
      const user = userEvent.setup()
      const onTemplateSelected = vi.fn()

      render(
        <TemplateSelectionModal
          {...defaultProps}
          onTemplateSelected={onTemplateSelected}
          quickSelect={true}
        />
      )

      // Select template with required variables
      const featureCard = screen.getByTestId('template-card')
      await user.click(featureCard)

      // Should NOT auto-confirm because template has required variables
      expect(onTemplateSelected).not.toHaveBeenCalled()

      // Preview should show template is selected
      expect(screen.getByTestId('preview-title')).toHaveTextContent('Feature Implementation')
    })

    it('handles double-click template selection', async () => {
      const user = userEvent.setup()
      const onTemplateSelected = vi.fn()

      render(
        <TemplateSelectionModal {...defaultProps} onTemplateSelected={onTemplateSelected} />
      )

      const templateCard = screen.getByTestId('template-card')
      await user.dblClick(templateCard)

      expect(onTemplateSelected).toHaveBeenCalledWith(mockTemplates[0])
    })
  })

  describe('Search and Filter Integration', () => {
    it('filters templates by search query dynamically', async () => {
      const user = userEvent.setup()

      // Start with filtered results based on search
      mockUseTemplates.mockReturnValue(createMockHookReturn({
        filteredTemplates: mockTemplates.filter(t =>
          t.name.toLowerCase().includes('test') ||
          t.description.toLowerCase().includes('test') ||
          t.tags.some(tag => tag.includes('test'))
        ),
      }))

      render(<TemplateSelectionModal {...defaultProps} />)

      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'test')

      // Should show only testing-related templates
      const templateCards = screen.getAllByTestId('template-card')
      expect(templateCards).toHaveLength(1)
      expect(screen.getByText('Test Implementation')).toBeInTheDocument()
    })

    it('combines search and category filters correctly', async () => {
      const user = userEvent.setup()

      render(<TemplateSelectionModal {...defaultProps} />)

      // First set search
      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'impl')

      // Then set category
      const bugfixButton = screen.getByTestId('category-bugfix')
      await user.click(bugfixButton)

      // Both filters should be applied
      expect(mockSetFilters).toHaveBeenLastCalledWith({
        search: 'impl',
        category: 'bugfix',
      })
    })

    it('clears search filter when input is cleared', async () => {
      const user = userEvent.setup()

      render(<TemplateSelectionModal {...defaultProps} />)

      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'feature')
      await user.clear(searchInput)

      expect(mockSetFilters).toHaveBeenLastCalledWith({
        search: undefined,
        category: undefined,
      })
    })

    it('resets to all categories when "all" is selected', async () => {
      const user = userEvent.setup()

      render(<TemplateSelectionModal {...defaultProps} />)

      // First select a specific category
      const featureButton = screen.getByTestId('category-feature')
      await user.click(featureButton)

      // Then select "all"
      const allButton = screen.getByTestId('category-all')
      await user.click(allButton)

      expect(mockSetFilters).toHaveBeenLastCalledWith({
        search: undefined,
        category: undefined,
      })
    })
  })

  describe('Template Preview Integration', () => {
    it('updates preview when different templates are selected', async () => {
      const user = userEvent.setup()

      render(<TemplateSelectionModal {...defaultProps} />)

      // Initially no template selected
      expect(screen.getByTestId('preview-empty')).toHaveTextContent('No template selected')

      // Select first template
      const featureCard = screen.getAllByTestId('template-card')[0]
      await user.click(featureCard)

      expect(screen.getByTestId('preview-title')).toHaveTextContent('Feature Implementation')
      expect(screen.getByTestId('preview-workflow')).toHaveTextContent('feature-workflow')

      // Select different template
      const bugfixCard = screen.getAllByTestId('template-card')[1]
      await user.click(bugfixCard)

      expect(screen.getByTestId('preview-title')).toHaveTextContent('Bug Fix')
      expect(screen.getByTestId('preview-workflow')).toHaveTextContent('hotfix-workflow')
    })

    it('shows variable information in preview for templates with variables', async () => {
      const user = userEvent.setup()

      render(<TemplateSelectionModal {...defaultProps} />)

      // Select template with variables
      const testingCard = screen.getAllByTestId('template-card')[2]
      await user.click(testingCard)

      expect(screen.getByTestId('preview-variables')).toHaveTextContent('Variables: 2')
    })

    it('does not show variables section for templates without variables', async () => {
      const user = userEvent.setup()

      render(<TemplateSelectionModal {...defaultProps} />)

      // Select template without variables
      const bugfixCard = screen.getAllByTestId('template-card')[1]
      await user.click(bugfixCard)

      expect(screen.queryByTestId('preview-variables')).not.toBeInTheDocument()
    })
  })

  describe('Loading and Error States Integration', () => {
    it('handles loading to success state transition', async () => {
      // Start with loading state
      mockUseTemplates.mockReturnValue(createMockHookReturn({
        isLoading: true,
        filteredTemplates: [],
      }))

      const { rerender } = render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()

      // Transition to loaded state
      mockUseTemplates.mockReturnValue(createMockHookReturn())
      rerender(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      expect(screen.getAllByTestId('template-card')).toHaveLength(5)
      expect(screen.getByText('5 templates')).toBeInTheDocument()
    })

    it('handles error state with retry functionality', async () => {
      const user = userEvent.setup()
      const mockRefreshFn = vi.fn().mockResolvedValue(undefined)

      mockUseTemplates.mockReturnValue(createMockHookReturn({
        error: 'Failed to load templates from server',
        filteredTemplates: [],
        refresh: mockRefreshFn,
      }))

      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByTestId('alert')).toBeInTheDocument()
      expect(screen.getByText('Failed to load templates from server')).toBeInTheDocument()

      const retryButton = screen.getByText('Try again')
      await user.click(retryButton)

      expect(mockRefreshFn).toHaveBeenCalledTimes(1)
    })

    it('handles empty state correctly', () => {
      mockUseTemplates.mockReturnValue(createMockHookReturn({
        filteredTemplates: [],
      }))

      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByText('No templates found')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument()
      expect(screen.getByText('0 templates')).toBeInTheDocument()
    })
  })

  describe('Modal State Management', () => {
    it('resets all state when modal is reopened', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      const { rerender } = render(
        <TemplateSelectionModal {...defaultProps} onClose={onClose} />
      )

      // Set up some state (search, selection)
      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'feature')

      const templateCard = screen.getByTestId('template-card')
      await user.click(templateCard)

      expect(screen.getByTestId('preview-title')).toHaveTextContent('Feature Implementation')

      // Close modal
      rerender(
        <TemplateSelectionModal {...defaultProps} isOpen={false} onClose={onClose} />
      )

      // Reopen modal
      rerender(
        <TemplateSelectionModal {...defaultProps} isOpen={true} onClose={onClose} />
      )

      // State should be reset
      const newSearchInput = screen.getByTestId('search-input')
      expect(newSearchInput).toHaveValue('')
      expect(screen.getByTestId('preview-empty')).toHaveTextContent('No template selected')
    })

    it('handles keyboard navigation for closing modal', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      render(<TemplateSelectionModal {...defaultProps} onClose={onClose} />)

      await user.keyboard('{Escape}')

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('confirms selection with Enter key when template is selected', async () => {
      const user = userEvent.setup()
      const onTemplateSelected = vi.fn()

      render(
        <TemplateSelectionModal {...defaultProps} onTemplateSelected={onTemplateSelected} />
      )

      // Select a template
      const templateCard = screen.getByTestId('template-card')
      await user.click(templateCard)

      // Press Enter to confirm
      await user.keyboard('{Enter}')

      expect(onTemplateSelected).toHaveBeenCalledWith(mockTemplates[0])
    })
  })

  describe('Initial Filters Integration', () => {
    it('applies and maintains initial filters through interactions', async () => {
      const user = userEvent.setup()
      const initialFilters = {
        category: 'feature' as const,
        workflow: 'feature-workflow',
      }

      render(
        <TemplateSelectionModal {...defaultProps} initialFilters={initialFilters} />
      )

      // Hook should be called with initial filters
      expect(mockUseTemplates).toHaveBeenCalledWith({
        initialFilters,
        autoFetch: true,
      })

      // When search is updated, initial filters should be preserved
      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'impl')

      expect(mockSetFilters).toHaveBeenCalledWith({
        search: 'impl',
        category: 'feature',
        workflow: 'feature-workflow',
      })

      // When category is changed, other initial filters should be preserved
      const bugfixButton = screen.getByTestId('category-bugfix')
      await user.click(bugfixButton)

      expect(mockSetFilters).toHaveBeenCalledWith({
        search: 'impl',
        category: 'bugfix',
        workflow: 'feature-workflow',
      })
    })
  })

  describe('Accessibility and User Experience', () => {
    it('maintains focus management during interactions', async () => {
      const user = userEvent.setup()

      render(<TemplateSelectionModal {...defaultProps} />)

      // Search input should be focusable
      const searchInput = screen.getByTestId('search-input')
      await user.click(searchInput)
      expect(searchInput).toHaveFocus()

      // Template cards should be keyboard navigable
      const templateCard = screen.getByTestId('template-card')
      expect(templateCard).toHaveAttribute('data-template-card')
    })

    it('provides clear visual feedback for selected templates', async () => {
      const user = userEvent.setup()

      render(<TemplateSelectionModal {...defaultProps} />)

      const templateCard = screen.getByTestId('template-card')

      // Initially not selected
      expect(templateCard).toHaveAttribute('data-selected', 'false')

      // After selection
      await user.click(templateCard)
      expect(templateCard).toHaveAttribute('data-selected', 'true')
    })

    it('shows appropriate button labels based on template variables', async () => {
      const user = userEvent.setup()

      render(<TemplateSelectionModal {...defaultProps} />)

      // Select template with required variables
      const featureCard = screen.getAllByTestId('template-card')[0]
      await user.click(featureCard)
      expect(screen.getByText('Configure & Use')).toBeInTheDocument()

      // Select template without required variables
      const bugfixCard = screen.getAllByTestId('template-card')[1]
      await user.click(bugfixCard)
      expect(screen.getByText('Use Template')).toBeInTheDocument()
    })
  })
})