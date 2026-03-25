/**
 * Unit tests for QuickActionButton component
 *
 * Tests the individual quick action button component functionality including:
 * - Template display and styling
 * - Click interactions
 * - Loading states
 * - Category-based styling
 * - Icon display
 * - Compact mode
 * - Accessibility features
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuickActionButton } from '../QuickActionButton'
import type { TaskTemplate } from '@/types/task-template'

// Mock the ui components
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, className }: any) => (
    <span className={`badge ${className}`}>{children}</span>
  ),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ className }: any) => (
    <div className={`spinner ${className}`} data-testid="spinner">
      Loading...
    </div>
  ),
}))

// Mock data helpers
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

describe('QuickActionButton', () => {
  const mockOnClick = vi.fn()
  const defaultTemplate = createMockTemplate('test_template', 'Test Template')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders template name and description', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
        />
      )

      expect(screen.getByText('Test Template')).toBeInTheDocument()
      expect(screen.getByText('Feature')).toBeInTheDocument() // Category badge
      expect(screen.getByText('Test Template description')).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      const { container } = render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('shows category icon when showIcon is true', () => {
      const { container } = render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          showIcon={true}
        />
      )

      // Check for icon element
      const icon = container.querySelector('.w-3.h-3.rounded-full')
      expect(icon).toBeInTheDocument()
    })

    it('hides icon when showIcon is false', () => {
      const { container } = render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          showIcon={false}
        />
      )

      // Should not have icon element
      const icon = container.querySelector('.w-3.h-3.rounded-full')
      expect(icon).not.toBeInTheDocument()
    })
  })

  describe('Category Styling', () => {
    const categoryTests = [
      { category: 'feature' as const, expectedColor: '#10b981' },
      { category: 'bugfix' as const, expectedColor: '#ef4444' },
      { category: 'refactoring' as const, expectedColor: '#3b82f6' },
      { category: 'testing' as const, expectedColor: '#8b5cf6' },
      { category: 'documentation' as const, expectedColor: '#f59e0b' },
      { category: 'maintenance' as const, expectedColor: '#6b7280' },
      { category: 'deployment' as const, expectedColor: '#06b6d4' },
      { category: 'custom' as const, expectedColor: '#eab308' },
    ]

    categoryTests.forEach(({ category, expectedColor }) => {
      it(`applies correct color for ${category} category`, () => {
        const template = createMockTemplate('test', 'Test', { category })
        const { container } = render(
          <QuickActionButton
            template={template}
            onClick={mockOnClick}
            showIcon={true}
          />
        )

        const icon = container.querySelector('.w-3.h-3.rounded-full')
        expect(icon).toHaveStyle({ color: expectedColor })
      })
    })

    it('falls back to custom category color for unknown category', () => {
      const template = createMockTemplate('test', 'Test', {
        category: 'unknown' as any,
      })
      const { container } = render(
        <QuickActionButton
          template={template}
          onClick={mockOnClick}
          showIcon={true}
        />
      )

      const icon = container.querySelector('.w-3.h-3.rounded-full')
      expect(icon).toHaveStyle({ color: '#eab308' }) // custom color
    })

    it('renders correct category badge classes', () => {
      const template = createMockTemplate('test', 'Test', { category: 'bugfix' })
      render(
        <QuickActionButton
          template={template}
          onClick={mockOnClick}
        />
      )

      const badge = screen.getByText('Bug Fix')
      expect(badge).toHaveClass('bg-red-100', 'text-red-700', 'border-red-300')
    })
  })

  describe('Compact Mode', () => {
    it('renders in compact mode without description', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          compact={true}
        />
      )

      expect(screen.getByText('Test Template')).toBeInTheDocument()
      // Description and category badge should not be visible in compact mode
      expect(screen.queryByText('Test Template description')).not.toBeInTheDocument()
      expect(screen.queryByText('Feature')).not.toBeInTheDocument()
    })

    it('applies compact sizing classes', () => {
      const { container } = render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          compact={true}
        />
      )

      // Should have compact padding and text size
      expect(container.firstChild).toHaveClass('px-3', 'py-2')

      const nameElement = screen.getByText('Test Template')
      expect(nameElement).toHaveClass('text-sm')
    })

    it('renders normally when compact is false', () => {
      const { container } = render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          compact={false}
        />
      )

      // Should have normal padding
      expect(container.firstChild).toHaveClass('px-4', 'py-3')

      // Should show description and badge
      expect(screen.getByText('Test Template description')).toBeInTheDocument()
      expect(screen.getByText('Feature')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('shows spinner when loading', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          loading={true}
        />
      )

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()
      expect(screen.getByRole('button')).toHaveClass('opacity-50', 'cursor-not-allowed')
    })

    it('hides icon when loading', () => {
      const { container } = render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          loading={true}
          showIcon={true}
        />
      )

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      // Icon should not be present when loading
      const icon = container.querySelector('.w-3.h-3.rounded-full')
      expect(icon).not.toBeInTheDocument()
    })

    it('does not call onClick when loading', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          loading={true}
        />
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(mockOnClick).not.toHaveBeenCalled()
    })

    it('renders normally when not loading', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          loading={false}
        />
      )

      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      expect(screen.getByRole('button')).not.toBeDisabled()
      expect(screen.getByRole('button')).not.toHaveClass('opacity-50', 'cursor-not-allowed')
    })
  })

  describe('Variables Indicator', () => {
    it('shows variables indicator for templates with required variables', () => {
      const templateWithVariables = createMockTemplate('with_vars', 'With Variables', {
        variables: [
          {
            name: 'name',
            label: 'Name',
            type: 'string',
            required: true,
          },
        ],
      })

      render(
        <QuickActionButton
          template={templateWithVariables}
          onClick={mockOnClick}
        />
      )

      const indicator = screen.getByText('•••')
      expect(indicator).toBeInTheDocument()
      expect(indicator).toHaveAttribute('title', 'Requires input')
      expect(indicator).toHaveAttribute('aria-label', 'This template requires variable input')
    })

    it('shows variables indicator for templates with mixed required/optional variables', () => {
      const templateWithMixedVariables = createMockTemplate('mixed_vars', 'Mixed Variables', {
        variables: [
          {
            name: 'required',
            label: 'Required',
            type: 'string',
            required: true,
          },
          {
            name: 'optional',
            label: 'Optional',
            type: 'string',
            required: false,
          },
        ],
      })

      render(
        <QuickActionButton
          template={templateWithMixedVariables}
          onClick={mockOnClick}
        />
      )

      expect(screen.getByText('•••')).toBeInTheDocument()
    })

    it('hides variables indicator for templates with only optional variables', () => {
      const templateWithOptionalVariables = createMockTemplate('optional_vars', 'Optional Variables', {
        variables: [
          {
            name: 'optional',
            label: 'Optional',
            type: 'string',
            required: false,
          },
        ],
      })

      render(
        <QuickActionButton
          template={templateWithOptionalVariables}
          onClick={mockOnClick}
        />
      )

      expect(screen.queryByText('•••')).not.toBeInTheDocument()
    })

    it('hides variables indicator for templates without variables', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
        />
      )

      expect(screen.queryByText('•••')).not.toBeInTheDocument()
    })
  })

  describe('Click Interactions', () => {
    it('calls onClick with template when clicked', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
        />
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(mockOnClick).toHaveBeenCalledTimes(1)
      expect(mockOnClick).toHaveBeenCalledWith(defaultTemplate)
    })

    it('does not call onClick when disabled/loading', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          loading={true}
        />
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(mockOnClick).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-label', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', 'Create Test Template task')
    })

    it('has proper title attribute', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Test Template description')
    })

    it('is focusable and keyboard accessible', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
        />
      )

      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()

      // Should respond to Enter and Space keys
      fireEvent.keyDown(button, { key: 'Enter' })
      fireEvent.keyDown(button, { key: ' ' })
      // Click handler is called by button's native behavior
    })

    it('has proper disabled state for screen readers', () => {
      render(
        <QuickActionButton
          template={defaultTemplate}
          onClick={mockOnClick}
          loading={true}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('disabled')
    })
  })

  describe('Edge Cases', () => {
    it('handles template with empty description', () => {
      const templateWithEmptyDescription = createMockTemplate('empty_desc', 'Empty Description', {
        description: '',
      })

      render(
        <QuickActionButton
          template={templateWithEmptyDescription}
          onClick={mockOnClick}
        />
      )

      expect(screen.getByText('Empty Description')).toBeInTheDocument()
      // Should not render description span for empty description
      const container = screen.getByText('Empty Description').closest('button')
      const descriptionSpans = container?.querySelectorAll('span.text-foreground-secondary')
      expect(descriptionSpans?.length).toBe(0)
    })

    it('handles template with very long name', () => {
      const longName = 'This is a very long template name that should be truncated appropriately'
      const templateWithLongName = createMockTemplate('long_name', longName)

      render(
        <QuickActionButton
          template={templateWithLongName}
          onClick={mockOnClick}
        />
      )

      expect(screen.getByText(longName)).toBeInTheDocument()
      // Truncation is handled by CSS classes, so just ensure it renders
    })

    it('handles template with special characters in name', () => {
      const specialName = 'Template with "quotes" & symbols!'
      const templateWithSpecialName = createMockTemplate('special_name', specialName)

      render(
        <QuickActionButton
          template={templateWithSpecialName}
          onClick={mockOnClick}
        />
      )

      expect(screen.getByText(specialName)).toBeInTheDocument()
    })

    it('handles undefined variables array', () => {
      const templateWithUndefinedVariables = createMockTemplate('undefined_vars', 'Undefined Variables', {
        variables: undefined,
      })

      render(
        <QuickActionButton
          template={templateWithUndefinedVariables}
          onClick={mockOnClick}
        />
      )

      // Should not show variables indicator
      expect(screen.queryByText('•••')).not.toBeInTheDocument()
      expect(screen.getByText('Undefined Variables')).toBeInTheDocument()
    })

    it('handles empty variables array', () => {
      const templateWithEmptyVariables = createMockTemplate('empty_vars', 'Empty Variables', {
        variables: [],
      })

      render(
        <QuickActionButton
          template={templateWithEmptyVariables}
          onClick={mockOnClick}
        />
      )

      // Should not show variables indicator
      expect(screen.queryByText('•••')).not.toBeInTheDocument()
      expect(screen.getByText('Empty Variables')).toBeInTheDocument()
    })
  })
})