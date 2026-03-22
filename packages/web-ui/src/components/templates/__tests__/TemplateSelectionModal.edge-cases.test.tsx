import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateSelectionModal } from '../TemplateSelectionModal'
import type { TaskTemplate } from '@/types/task-template'
import * as useTemplatesHook from '@/hooks/useTemplates'

// Mock the useTemplates hook
vi.mock('@/hooks/useTemplates')
const mockUseTemplates = vi.mocked(useTemplatesHook.useTemplates)

// Mock all UI components
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: any) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button">{children}</button>
  ),
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}))

vi.mock('@/components/templates', () => ({
  TemplateSearchInput: ({ value, onChange }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  TemplateCard: ({ template, onClick, onDoubleClick }: any) => (
    <div
      data-testid="template-card"
      data-template-id={template.id}
      onClick={() => onClick(template)}
      onDoubleClick={() => onDoubleClick?.(template)}
    >
      {template.name}
    </div>
  ),
  TemplatePreviewPanel: ({ template }: any) => (
    <div data-testid="preview-panel">
      {template ? `Preview: ${template.name}` : 'No template selected'}
    </div>
  ),
  TemplateCategoryFilter: ({ onCategoryChange, categoryCounts }: any) => (
    <div data-testid="category-filter">
      <button onClick={() => onCategoryChange('all')}>All ({categoryCounts.all})</button>
    </div>
  ),
}))

vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  FileText: () => <span>FileText</span>,
  AlertCircle: () => <span>AlertCircle</span>,
}))

describe('TemplateSelectionModal Edge Cases', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onTemplateSelected: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Template Data Edge Cases', () => {
    it('handles templates with null/undefined values gracefully', () => {
      const edgeCaseTemplate: TaskTemplate = {
        id: 'edge-template',
        name: 'Edge Case Template',
        description: '',
        category: 'custom',
        workflow: '',
        autonomy: 'review-before-commit',
        descriptionTemplate: '',
        acceptanceCriteriaTemplate: undefined,
        variables: undefined,
        tags: [],
        isQuickAction: false,
        priority: 'normal',
        effort: 'small',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TaskTemplate

      mockUseTemplates.mockReturnValue({
        filteredTemplates: [edgeCaseTemplate],
        isLoading: false,
        error: null,
        categoryCounts: { all: 1, custom: 1 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      expect(() => {
        render(<TemplateSelectionModal {...defaultProps} />)
      }).not.toThrow()

      expect(screen.getByText('Edge Case Template')).toBeInTheDocument()
    })

    it('handles templates with extremely long names and descriptions', () => {
      const longTemplate: TaskTemplate = {
        id: 'long-template',
        name: 'A'.repeat(1000), // Very long name
        description: 'B'.repeat(2000), // Very long description
        category: 'custom',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'C'.repeat(500),
        tags: ['tag1', 'tag2', ...Array(100).fill('tag').map((t, i) => `${t}${i}`)], // Many tags
        isQuickAction: false,
        priority: 'normal',
        effort: 'small',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockUseTemplates.mockReturnValue({
        filteredTemplates: [longTemplate],
        isLoading: false,
        error: null,
        categoryCounts: { all: 1, custom: 1 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      expect(() => {
        render(<TemplateSelectionModal {...defaultProps} />)
      }).not.toThrow()

      expect(screen.getByTestId('template-card')).toBeInTheDocument()
    })

    it('handles templates with complex variable configurations', () => {
      const complexTemplate: TaskTemplate = {
        id: 'complex-template',
        name: 'Complex Template',
        description: 'Template with complex variables',
        category: 'custom',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Test {{var1}} and {{var2}}',
        variables: [
          {
            name: 'var1',
            label: 'Variable 1',
            type: 'string',
            required: true,
            defaultValue: 'default',
            placeholder: 'Enter value',
            description: 'This is variable 1',
            validationPattern: '^[a-zA-Z0-9]+$',
            validationMessage: 'Only alphanumeric characters allowed',
            minLength: 1,
            maxLength: 100,
          },
          {
            name: 'var2',
            label: 'Variable 2',
            type: 'select',
            required: false,
            options: [
              { label: 'Option 1', value: 'opt1', description: 'First option' },
              { label: 'Option 2', value: 'opt2', disabled: true },
              { label: 'Option 3', value: 'opt3' },
            ],
          },
          {
            name: 'var3',
            label: 'Number Variable',
            type: 'number',
            required: true,
            min: 0,
            max: 100,
            defaultValue: 50,
          },
        ],
        tags: ['complex', 'variables'],
        isQuickAction: false,
        priority: 'normal',
        effort: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockUseTemplates.mockReturnValue({
        filteredTemplates: [complexTemplate],
        isLoading: false,
        error: null,
        categoryCounts: { all: 1, custom: 1 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      const templateCard = screen.getByTestId('template-card')
      fireEvent.click(templateCard)

      // Should show "Configure & Use" because of required variables
      expect(screen.getByText('Configure & Use')).toBeInTheDocument()
    })

    it('handles templates with invalid dates', () => {
      const invalidDateTemplate: TaskTemplate = {
        id: 'invalid-date-template',
        name: 'Invalid Date Template',
        description: 'Template with invalid dates',
        category: 'custom',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Test template',
        tags: [],
        isQuickAction: false,
        priority: 'normal',
        effort: 'small',
        createdAt: new Date('invalid-date'),
        updatedAt: new Date(NaN),
      }

      mockUseTemplates.mockReturnValue({
        filteredTemplates: [invalidDateTemplate],
        isLoading: false,
        error: null,
        categoryCounts: { all: 1, custom: 1 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      expect(() => {
        render(<TemplateSelectionModal {...defaultProps} />)
      }).not.toThrow()
    })
  })

  describe('Hook Error Edge Cases', () => {
    it('handles hook returning null/undefined values', () => {
      mockUseTemplates.mockReturnValue({
        filteredTemplates: null as any,
        isLoading: false,
        error: null,
        categoryCounts: null as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      expect(() => {
        render(<TemplateSelectionModal {...defaultProps} />)
      }).not.toThrow()
    })

    it('handles missing hook functions', () => {
      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: false,
        error: null,
        categoryCounts: { all: 0 } as any,
        setFilters: undefined as any,
        refresh: undefined as any,
      })

      expect(() => {
        render(<TemplateSelectionModal {...defaultProps} />)
      }).not.toThrow()
    })

    it('handles simultaneous loading and error states', () => {
      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: true,
        error: 'Error while loading',
        categoryCounts: { all: 0 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      // Should prioritize error display over loading
      expect(screen.getByTestId('alert')).toBeInTheDocument()
      expect(screen.getByText('Error while loading')).toBeInTheDocument()
    })

    it('handles very long error messages', () => {
      const longError = 'E'.repeat(1000)
      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: false,
        error: longError,
        categoryCounts: { all: 0 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      expect(screen.getByTestId('alert')).toBeInTheDocument()
      expect(screen.getByText(longError)).toBeInTheDocument()
    })
  })

  describe('Interaction Edge Cases', () => {
    it('handles rapid successive clicks on template cards', async () => {
      const onTemplateSelected = vi.fn()
      const template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test',
        category: 'custom' as const,
        workflow: 'test',
        autonomy: 'review-before-commit' as const,
        descriptionTemplate: 'Test',
        tags: [],
        isQuickAction: false,
        priority: 'normal' as const,
        effort: 'small' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockUseTemplates.mockReturnValue({
        filteredTemplates: [template],
        isLoading: false,
        error: null,
        categoryCounts: { all: 1, custom: 1 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      render(<TemplateSelectionModal {...defaultProps} onTemplateSelected={onTemplateSelected} />)

      const templateCard = screen.getByTestId('template-card')

      // Rapid clicks
      fireEvent.click(templateCard)
      fireEvent.click(templateCard)
      fireEvent.click(templateCard)
      fireEvent.doubleClick(templateCard)

      // Should only call once for double click
      expect(onTemplateSelected).toHaveBeenCalledTimes(1)
    })

    it('handles keyboard events when no template is selected', () => {
      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: false,
        error: null,
        categoryCounts: { all: 0 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      const onTemplateSelected = vi.fn()
      render(<TemplateSelectionModal {...defaultProps} onTemplateSelected={onTemplateSelected} />)

      // Pressing Enter with no selection should not do anything
      fireEvent.keyDown(document, { key: 'Enter' })
      expect(onTemplateSelected).not.toHaveBeenCalled()

      // Arrow keys should not crash
      fireEvent.keyDown(document, { key: 'ArrowDown' })
      fireEvent.keyDown(document, { key: 'ArrowUp' })

      expect(() => {
        fireEvent.keyDown(document, { key: 'Tab' })
        fireEvent.keyDown(document, { key: 'Space' })
      }).not.toThrow()
    })

    it('handles invalid keyboard events gracefully', () => {
      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: false,
        error: null,
        categoryCounts: { all: 0 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      expect(() => {
        fireEvent.keyDown(document, { key: null as any })
        fireEvent.keyDown(document, { key: undefined as any })
        fireEvent.keyDown(document, { key: '' })
        fireEvent.keyDown(document, { key: 'InvalidKey' })
      }).not.toThrow()
    })

    it('handles search input with special characters and emojis', async () => {
      const user = userEvent.setup()
      const setFilters = vi.fn()

      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: false,
        error: null,
        categoryCounts: { all: 0 } as any,
        setFilters,
        refresh: vi.fn(),
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      const searchInput = screen.getByTestId('search-input')

      // Special characters and emojis
      const specialInputs = [
        '🚀 feature',
        '@#$%^&*()',
        '<script>alert("xss")</script>',
        '    spaces    ',
        '\n\t\r',
        '中文',
        'اللغة العربية',
      ]

      for (const input of specialInputs) {
        await user.clear(searchInput)
        await user.type(searchInput, input)

        await waitFor(() => {
          expect(setFilters).toHaveBeenCalledWith({
            search: input,
            category: undefined,
          })
        })
      }
    })

    it('handles very rapid filter changes', async () => {
      const user = userEvent.setup()
      const setFilters = vi.fn()

      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: false,
        error: null,
        categoryCounts: {
          all: 0,
          feature: 0,
          bugfix: 0,
          testing: 0,
          refactoring: 0,
          documentation: 0,
          maintenance: 0,
          deployment: 0,
          custom: 0,
        },
        setFilters,
        refresh: vi.fn(),
      })

      render(<TemplateSelectionModal {...defaultProps} />)

      const searchInput = screen.getByTestId('search-input')

      // Rapid typing
      await user.type(searchInput, 'abcdefghijklmnopqrstuvwxyz', { delay: 1 })

      // Should handle all rapid changes
      expect(setFilters).toHaveBeenCalled()
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('handles large number of templates', () => {
      const manyTemplates = Array.from({ length: 1000 }, (_, i) => ({
        id: `template-${i}`,
        name: `Template ${i}`,
        description: `Description for template ${i}`,
        category: 'custom' as const,
        workflow: 'test',
        autonomy: 'review-before-commit' as const,
        descriptionTemplate: `Template ${i}`,
        tags: [`tag${i}`, `category${i % 10}`],
        isQuickAction: i % 2 === 0,
        priority: 'normal' as const,
        effort: 'small' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      mockUseTemplates.mockReturnValue({
        filteredTemplates: manyTemplates,
        isLoading: false,
        error: null,
        categoryCounts: { all: 1000, custom: 1000 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      expect(() => {
        render(<TemplateSelectionModal {...defaultProps} />)
      }).not.toThrow()

      expect(screen.getByText('1000 templates')).toBeInTheDocument()
    })

    it('handles templates with deeply nested or circular references safely', () => {
      const templateWithCircular = {
        id: 'circular-template',
        name: 'Circular Template',
        description: 'Template with potential circular reference',
        category: 'custom' as const,
        workflow: 'test',
        autonomy: 'review-before-commit' as const,
        descriptionTemplate: 'Test',
        tags: [],
        isQuickAction: false,
        priority: 'normal' as const,
        effort: 'small' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Simulate circular reference in variables
      const circularVar = {
        name: 'circular',
        label: 'Circular',
        type: 'string' as const,
        required: true,
        options: [],
      }
      // Create circular reference (though TypeScript will prevent this in real code)
      ;(circularVar as any).self = circularVar
      templateWithCircular.variables = [circularVar as any]

      mockUseTemplates.mockReturnValue({
        filteredTemplates: [templateWithCircular],
        isLoading: false,
        error: null,
        categoryCounts: { all: 1, custom: 1 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      expect(() => {
        render(<TemplateSelectionModal {...defaultProps} />)
      }).not.toThrow()
    })
  })

  describe('Modal State Edge Cases', () => {
    it('handles rapid open/close cycles', () => {
      const { rerender } = render(<TemplateSelectionModal {...defaultProps} isOpen={false} />)

      // Rapid open/close
      for (let i = 0; i < 10; i++) {
        rerender(<TemplateSelectionModal {...defaultProps} isOpen={true} />)
        rerender(<TemplateSelectionModal {...defaultProps} isOpen={false} />)
      }

      expect(() => {
        rerender(<TemplateSelectionModal {...defaultProps} isOpen={true} />)
      }).not.toThrow()
    })

    it('handles undefined/null props gracefully', () => {
      expect(() => {
        render(
          <TemplateSelectionModal
            isOpen={true}
            onClose={null as any}
            onTemplateSelected={undefined as any}
            initialFilters={null as any}
            quickSelect={undefined}
            className={null as any}
          />
        )
      }).not.toThrow()
    })

    it('handles function props that throw errors', () => {
      const throwingOnClose = vi.fn(() => {
        throw new Error('onClose error')
      })
      const throwingOnSelect = vi.fn(() => {
        throw new Error('onSelect error')
      })

      mockUseTemplates.mockReturnValue({
        filteredTemplates: [],
        isLoading: false,
        error: null,
        categoryCounts: { all: 0 } as any,
        setFilters: vi.fn(),
        refresh: vi.fn(),
      })

      render(
        <TemplateSelectionModal
          isOpen={true}
          onClose={throwingOnClose}
          onTemplateSelected={throwingOnSelect}
        />
      )

      // These should be handled gracefully
      const cancelButton = screen.getByText('Cancel')
      expect(() => {
        fireEvent.click(cancelButton)
      }).not.toThrow()
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('handles missing browser APIs gracefully', () => {
      // Mock missing addEventListener
      const originalAddEventListener = document.addEventListener
      ;(document as any).addEventListener = undefined

      expect(() => {
        render(<TemplateSelectionModal {...defaultProps} />)
      }).not.toThrow()

      // Restore
      document.addEventListener = originalAddEventListener
    })

    it('handles focus management when elements are not focusable', () => {
      // Mock querySelector to return null
      const originalQuerySelector = HTMLElement.prototype.querySelector
      HTMLElement.prototype.querySelector = vi.fn().mockReturnValue(null)

      render(<TemplateSelectionModal {...defaultProps} />)

      // Arrow key navigation should not crash when no focusable elements exist
      fireEvent.keyDown(document, { key: 'ArrowDown' })
      fireEvent.keyDown(document, { key: 'ArrowUp' })

      // Restore
      HTMLElement.prototype.querySelector = originalQuerySelector
    })
  })
})