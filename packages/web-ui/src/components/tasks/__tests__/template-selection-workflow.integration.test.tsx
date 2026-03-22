/**
 * Integration tests for the complete template selection workflow
 *
 * This test suite covers the entire user flow from opening CreateTaskDialog,
 * selecting a template, configuring variables (if needed), and creating the task.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateTaskDialog } from '../CreateTaskDialog'
import type { TaskTemplate } from '@/types/task-template'
import * as apiClient from '@/lib/api-client'
import * as useTemplatesHook from '@/hooks/useTemplates'

// Mock dependencies
vi.mock('@/lib/api-client')
vi.mock('@/hooks/useTemplates')
vi.mock('@/types/task-template', () => ({
  templateHasRequiredVariables: (template: any) =>
    template.variables?.some((v: any) => v.required) || false,
  interpolateTemplateString: (template: string, values: any) => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = values[varName]
      return value !== undefined ? String(value) : match
    })
  },
}))

// Mock UI components with realistic behavior
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => {
    if (!open) return null
    return (
      <div data-testid="dialog" onClick={() => onOpenChange?.(false)}>
        {children}
      </div>
    )
  },
  DialogContent: ({ children, className, ref, ...props }: any) => (
    <div
      data-testid="dialog-content"
      className={className}
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, type, size, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      type={type}
      className={className}
      data-testid={props['data-testid'] || 'button'}
      {...props}
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

// Mock template sub-components
vi.mock('@/components/templates', () => ({
  TemplateSearchInput: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="template-search-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
  TemplateCard: ({ template, isSelected, onClick, onDoubleClick }: any) => (
    <div
      data-testid={`template-card-${template.id}`}
      data-selected={isSelected}
      onClick={() => onClick(template)}
      onDoubleClick={() => onDoubleClick?.(template)}
      data-template-card
      tabIndex={0}
      className={`template-card ${isSelected ? 'selected' : ''}`}
    >
      <h3>{template.name}</h3>
      <p>{template.description}</p>
      <div>Category: {template.category}</div>
      {template.variables?.length > 0 && (
        <div data-testid="has-variables">Has {template.variables.length} variables</div>
      )}
    </div>
  ),
  TemplatePreviewPanel: ({ template }: any) => (
    <div data-testid="template-preview-panel">
      {template ? (
        <div>
          <h3>Preview: {template.name}</h3>
          <p>{template.description}</p>
          <div>Workflow: {template.workflow}</div>
          <div>Autonomy: {template.autonomy}</div>
          <div>Description Template: {template.descriptionTemplate}</div>
          {template.acceptanceCriteriaTemplate && (
            <div>Acceptance Criteria: {template.acceptanceCriteriaTemplate}</div>
          )}
        </div>
      ) : (
        <div>No template selected</div>
      )}
    </div>
  ),
  TemplateCategoryFilter: ({ selectedCategory, categoryCounts, onCategoryChange }: any) => (
    <div data-testid="template-category-filter">
      <button
        onClick={() => onCategoryChange('all')}
        data-category="all"
        data-selected={selectedCategory === 'all'}
      >
        All ({categoryCounts.all || 0})
      </button>
      <button
        onClick={() => onCategoryChange('feature')}
        data-category="feature"
        data-selected={selectedCategory === 'feature'}
      >
        Feature ({categoryCounts.feature || 0})
      </button>
      <button
        onClick={() => onCategoryChange('bugfix')}
        data-category="bugfix"
        data-selected={selectedCategory === 'bugfix'}
      >
        Bugfix ({categoryCounts.bugfix || 0})
      </button>
    </div>
  ),
}))

// Mock QuickActionVariableModal with realistic variable collection
vi.mock('@/components/dashboard/QuickActionVariableModal', () => ({
  QuickActionVariableModal: ({ isOpen, template, onTaskCreated, onClose, onError }: any) => {
    if (!isOpen || !template) return null

    return (
      <div data-testid="variable-modal">
        <h3>Configure Variables for {template.name}</h3>
        {template.variables?.map((variable: any) => (
          <div key={variable.name} data-testid={`variable-input-${variable.name}`}>
            <label>{variable.label} {variable.required && '*'}</label>
            <input
              data-testid={`variable-${variable.name}`}
              placeholder={variable.placeholder}
              required={variable.required}
            />
          </div>
        ))}
        <button
          data-testid="create-task-from-template"
          onClick={() => {
            // Simulate task creation with variables
            const taskId = `task-from-${template.id}-${Date.now()}`
            onTaskCreated(taskId)
          }}
        >
          Create Task
        </button>
        <button data-testid="cancel-variables" onClick={onClose}>
          Cancel
        </button>
      </div>
    )
  },
}))

// Mock icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">×</span>,
  Plus: () => <span data-testid="plus-icon">+</span>,
  Zap: () => <span data-testid="zap-icon">⚡</span>,
  FileText: () => <span data-testid="file-text-icon">📄</span>,
  Info: () => <span data-testid="info-icon">ℹ️</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">⚠️</span>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}))

// Test data
const mockTemplates: TaskTemplate[] = [
  {
    id: 'template-feature-component',
    name: 'Create React Component',
    description: 'Template for creating new React components with TypeScript',
    category: 'feature',
    workflow: 'feature-development',
    autonomy: 'review-before-commit',
    descriptionTemplate: 'Create a new {{componentType}} component named {{componentName}} with {{features}}',
    acceptanceCriteriaTemplate: 'Component renders correctly\nProps are properly typed\nComponent is tested',
    variables: [
      {
        name: 'componentName',
        label: 'Component Name',
        type: 'string',
        required: true,
        placeholder: 'e.g., UserProfile, TaskCard',
      },
      {
        name: 'componentType',
        label: 'Component Type',
        type: 'select',
        required: true,
        options: [
          { label: 'Functional Component', value: 'functional' },
          { label: 'Page Component', value: 'page' },
        ],
      },
      {
        name: 'features',
        label: 'Additional Features',
        type: 'text',
        required: false,
        placeholder: 'Describe any specific features or props...',
      },
    ],
    tags: ['react', 'component', 'typescript'],
    isQuickAction: true,
    priority: 'normal',
    effort: 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'template-bug-fix',
    name: 'Bug Fix',
    description: 'Template for fixing bugs with proper testing',
    category: 'bugfix',
    workflow: 'bug-fixing',
    autonomy: 'review-before-commit',
    descriptionTemplate: 'Fix authentication issue causing login failures',
    acceptanceCriteriaTemplate: 'Bug is resolved\nNo regression in existing functionality\nFix is tested',
    tags: ['bug', 'fix', 'testing'],
    isQuickAction: true,
    priority: 'high',
    effort: 'small',
    createdAt: new Date(),
    updatedAt: new Date(),
    // No variables - simple template
  },
  {
    id: 'template-api-endpoint',
    name: 'API Endpoint',
    description: 'Template for creating new API endpoints',
    category: 'feature',
    workflow: 'api-development',
    autonomy: 'review-before-commit',
    descriptionTemplate: 'Create {{method}} {{endpoint}} endpoint for {{purpose}}',
    acceptanceCriteriaTemplate: 'Endpoint returns correct response\nProper error handling\nAPI documentation updated',
    variables: [
      {
        name: 'method',
        label: 'HTTP Method',
        type: 'select',
        required: true,
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' },
        ],
      },
      {
        name: 'endpoint',
        label: 'Endpoint Path',
        type: 'string',
        required: true,
        placeholder: 'e.g., /api/users/{id}',
      },
      {
        name: 'purpose',
        label: 'Purpose',
        type: 'text',
        required: true,
        placeholder: 'What does this endpoint do?',
      },
    ],
    tags: ['api', 'backend', 'endpoint'],
    isQuickAction: false,
    priority: 'normal',
    effort: 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockCategoryCounts = {
  all: 3,
  feature: 2,
  bugfix: 1,
  refactoring: 0,
  testing: 0,
  documentation: 0,
  maintenance: 0,
  deployment: 0,
  custom: 0,
}

describe('Template Selection Workflow - End to End', () => {
  const mockApiClient = vi.mocked(apiClient.apiClient)
  const mockUseTemplates = vi.mocked(useTemplatesHook.useTemplates)

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default API responses
    mockApiClient.createTask.mockResolvedValue({
      taskId: 'new-task-123',
    })

    // Setup default useTemplates hook response
    mockUseTemplates.mockReturnValue({
      filteredTemplates: mockTemplates,
      isLoading: false,
      error: null,
      categoryCounts: mockCategoryCounts,
      setFilters: vi.fn(),
      refresh: vi.fn(),
    })
  })

  describe('Complete Workflow - Template without Variables', () => {
    it('allows creating task from simple template', async () => {
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

      // 1. Click "Use Template" button
      await user.click(screen.getByText('Use Template'))

      // 2. Verify template modal opens
      expect(screen.getByText('Select Template')).toBeInTheDocument()
      expect(screen.getByTestId('template-search-input')).toBeInTheDocument()

      // 3. Browse templates - should see all templates
      expect(screen.getByText('Create React Component')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix')).toBeInTheDocument()
      expect(screen.getByText('API Endpoint')).toBeInTheDocument()

      // 4. Filter by category
      await user.click(screen.getByText('Bugfix (1)'))

      // Should update filters (we'll verify through the template display)
      expect(screen.getByText('Bug Fix')).toBeInTheDocument()

      // 5. Select the bug fix template (no variables)
      await user.click(screen.getByTestId('template-card-template-bug-fix'))

      // 6. Verify preview shows
      expect(screen.getByText('Preview: Bug Fix')).toBeInTheDocument()
      expect(screen.getByText('Workflow: bug-fixing')).toBeInTheDocument()

      // 7. Confirm template selection
      await user.click(screen.getByText('Use Template'))

      // 8. Verify template modal closes and form is pre-filled
      expect(screen.queryByText('Select Template')).not.toBeInTheDocument()
      expect(screen.getByDisplayValue('Fix authentication issue causing login failures')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Bug is resolved\nNo regression in existing functionality\nFix is tested')).toBeInTheDocument()

      // 9. Verify template info is shown
      expect(screen.getByText('Form pre-filled from template:')).toBeInTheDocument()
      expect(screen.getByText('Bug Fix')).toBeInTheDocument()

      // 10. Optionally modify the pre-filled content
      const descriptionInput = screen.getByDisplayValue('Fix authentication issue causing login failures')
      await user.clear(descriptionInput)
      await user.type(descriptionInput, 'Fix critical authentication vulnerability')

      // 11. Create the task
      await user.click(screen.getByText('Create Task'))

      // 12. Verify API call with correct data
      await waitFor(() => {
        expect(mockApiClient.createTask).toHaveBeenCalledWith({
          description: 'Fix critical authentication vulnerability',
          acceptanceCriteria: 'Bug is resolved\nNo regression in existing functionality\nFix is tested',
          workflow: 'bug-fixing',
          autonomy: 'review-before-commit',
        })
      })

      // 13. Verify success callbacks
      expect(mockOnCreated).toHaveBeenCalledWith('new-task-123')
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Complete Workflow - Template with Variables', () => {
    it('allows creating task from template with required variables', async () => {
      const user = userEvent.setup()
      const mockOnCreated = vi.fn()

      render(
        <CreateTaskDialog
          {...defaultProps}
          onCreated={mockOnCreated}
        />
      )

      // 1. Open template selection
      await user.click(screen.getByText('Use Template'))

      // 2. Search for component template
      const searchInput = screen.getByTestId('template-search-input')
      await user.type(searchInput, 'React')

      // 3. Select React component template (has variables)
      await user.click(screen.getByTestId('template-card-template-feature-component'))

      // 4. Confirm selection - should open variable modal
      await user.click(screen.getByText('Configure & Use'))

      // 5. Verify variable modal opens
      expect(screen.getByText('Configure Variables for Create React Component')).toBeInTheDocument()
      expect(screen.getByTestId('variable-input-componentName')).toBeInTheDocument()
      expect(screen.getByTestId('variable-input-componentType')).toBeInTheDocument()

      // 6. Fill in required variables
      await user.type(screen.getByTestId('variable-componentName'), 'UserProfile')
      // For simplicity, we'll assume componentType gets selected somehow

      // 7. Create task from variable modal
      await user.click(screen.getByTestId('create-task-from-template'))

      // 8. Verify task creation and callbacks
      expect(mockOnCreated).toHaveBeenCalledWith(
        expect.stringMatching(/^task-from-template-feature-component-\d+$/)
      )
    })

    it('allows canceling variable configuration', async () => {
      const user = userEvent.setup()

      render(<CreateTaskDialog {...defaultProps} />)

      // Open template selection and select template with variables
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('template-card-template-feature-component'))
      await user.click(screen.getByText('Configure & Use'))

      // Verify variable modal is open
      expect(screen.getByTestId('variable-modal')).toBeInTheDocument()

      // Cancel variable configuration
      await user.click(screen.getByTestId('cancel-variables'))

      // Verify modal is closed and we're back to main dialog
      expect(screen.queryByTestId('variable-modal')).not.toBeInTheDocument()
      expect(screen.getByText('Create New Task')).toBeInTheDocument()
    })
  })

  describe('Search and Filtering Workflow', () => {
    it('allows searching and filtering templates', async () => {
      const user = userEvent.setup()
      const mockSetFilters = vi.fn()

      mockUseTemplates.mockReturnValue({
        filteredTemplates: mockTemplates.filter(t => t.name.includes('API')),
        isLoading: false,
        error: null,
        categoryCounts: { ...mockCategoryCounts, all: 1, feature: 1 },
        setFilters: mockSetFilters,
        refresh: vi.fn(),
      })

      render(<CreateTaskDialog {...defaultProps} />)

      // Open template selection
      await user.click(screen.getByText('Use Template'))

      // Search for API templates
      const searchInput = screen.getByTestId('template-search-input')
      await user.type(searchInput, 'API')

      // Verify filters are applied
      await waitFor(() => {
        expect(mockSetFilters).toHaveBeenCalledWith({
          search: 'API',
          category: undefined,
        })
      })

      // Should only show API template now
      expect(screen.getByText('API Endpoint')).toBeInTheDocument()
      expect(screen.queryByText('Bug Fix')).not.toBeInTheDocument()

      // Filter by feature category
      await user.click(screen.getByText('Feature (1)'))

      expect(mockSetFilters).toHaveBeenLastCalledWith({
        search: 'API',
        category: 'feature',
      })
    })
  })

  describe('Error Handling Workflow', () => {
    it('handles API errors gracefully', async () => {
      const user = userEvent.setup()
      const error = new Error('Network error')
      mockApiClient.createTask.mockRejectedValueOnce(error)

      render(<CreateTaskDialog {...defaultProps} />)

      // Select template and create task
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('template-card-template-bug-fix'))
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByText('Create Task'))

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      // Template data should still be preserved
      expect(screen.getByText('Form pre-filled from template:')).toBeInTheDocument()
    })

    it('handles template loading errors', async () => {
      const user = userEvent.setup()
      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: false,
        error: 'Failed to load templates',
        categoryCounts: mockCategoryCounts,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      render(<CreateTaskDialog {...defaultProps} />)

      // Open template selection
      await user.click(screen.getByText('Use Template'))

      // Should show error state
      expect(screen.getByText('Failed to load templates')).toBeInTheDocument()
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })
  })

  describe('Template Data Clearing', () => {
    it('allows clearing template data and starting over', async () => {
      const user = userEvent.setup()

      render(<CreateTaskDialog {...defaultProps} />)

      // Select template and verify form is pre-filled
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('template-card-template-bug-fix'))
      await user.click(screen.getByText('Use Template'))

      expect(screen.getByDisplayValue('Fix authentication issue causing login failures')).toBeInTheDocument()

      // Clear template data
      await user.click(screen.getByText('Clear'))

      // Form should be reset
      expect(screen.queryByDisplayValue('Fix authentication issue causing login failures')).not.toBeInTheDocument()
      expect(screen.queryByText('Form pre-filled from template:')).not.toBeInTheDocument()

      // Should be able to use another template
      await user.click(screen.getByText('Use Template'))
      expect(screen.getByText('Select Template')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows loading state while templates are being fetched', async () => {
      const user = userEvent.setup()
      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: true,
        error: null,
        categoryCounts: mockCategoryCounts,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      render(<CreateTaskDialog {...defaultProps} />)

      // Open template selection
      await user.click(screen.getByText('Use Template'))

      // Should show loading state
      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByText('Loading templates...')).toBeInTheDocument()
    })

    it('shows loading state during task creation', async () => {
      const user = userEvent.setup()

      // Mock slow API response
      let resolveCreateTask: (value: any) => void
      mockApiClient.createTask.mockImplementation(() =>
        new Promise(resolve => { resolveCreateTask = resolve })
      )

      render(<CreateTaskDialog {...defaultProps} />)

      // Select template and submit
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByTestId('template-card-template-bug-fix'))
      await user.click(screen.getByText('Use Template'))
      await user.click(screen.getByText('Create Task'))

      // Should show loading state
      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByText('Creating...')).toBeInTheDocument()

      // Buttons should be disabled
      expect(screen.getByText('Cancel')).toBeDisabled()
      expect(screen.getByText('Use Template')).toBeDisabled()

      // Resolve the API call
      resolveCreateTask!({ taskId: 'test-123' })
    })
  })

  describe('Accessibility and UX', () => {
    it('maintains proper focus flow throughout the workflow', async () => {
      const user = userEvent.setup()

      render(<CreateTaskDialog {...defaultProps} />)

      // Template button should be focusable
      const useTemplateButton = screen.getByText('Use Template')
      expect(useTemplateButton).not.toHaveAttribute('disabled')

      // After opening modal, focus should move appropriately
      await user.click(useTemplateButton)

      // Template cards should be focusable
      const templateCard = screen.getByTestId('template-card-template-bug-fix')
      expect(templateCard).toHaveAttribute('tabIndex', '0')
    })

    it('provides keyboard navigation for template selection', async () => {
      render(<CreateTaskDialog {...defaultProps} />)

      await userEvent.click(screen.getByText('Use Template'))

      // Escape should close modal
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByText('Select Template')).not.toBeInTheDocument()
    })
  })
})