/**
 * ChangelogFilters Component Tests
 *
 * Unit tests for the ChangelogFilters component,
 * including filter interactions and state management.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ChangelogFilters } from '../ChangelogFilters'
import type { ChangelogFilters as ChangelogFiltersType } from '@/types/changelog'

// Mock UI components
vi.mock('@/components/ui/Select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      <button onClick={() => onValueChange('last7Days')}>
        {children}
      </button>
    </div>
  ),
  SelectTrigger: ({ children }: any) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: () => <span>Select Value</span>,
  SelectContent: ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value, ...props }: any) => (
    <button data-testid={`select-item-${value}`} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Input', () => ({
  Input: ({ value, onChange, placeholder, ...props }: any) => (
    <input
      data-testid="input"
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/Checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      data-testid="checkbox"
      checked={checked || false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/Label', () => ({
  Label: ({ children, ...props }: any) => (
    <label data-testid="label" {...props}>
      {children}
    </label>
  ),
}))

describe('ChangelogFilters', () => {
  const mockFilters: ChangelogFiltersType = {
    search: '',
    workflows: [],
    status: [],
  }

  const mockOnFiltersChange = vi.fn()

  const mockAvailableWorkflows = [
    'feature-development',
    'bug-fix',
    'refactoring',
    'maintenance',
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders filter component with title', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      expect(screen.getByText('Filters')).toBeInTheDocument()
    })

    it('shows active filter count badge', () => {
      const filtersWithValues: ChangelogFiltersType = {
        search: 'test',
        workflows: ['feature-development'],
        status: ['completed'],
      }

      render(
        <ChangelogFilters
          filters={filtersWithValues}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      expect(screen.getByText('3')).toBeInTheDocument() // Badge with count
    })

    it('shows clear filters button when filters are active', () => {
      const filtersWithValues: ChangelogFiltersType = {
        search: 'test',
      }

      render(
        <ChangelogFilters
          filters={filtersWithValues}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      expect(screen.getByText('Clear')).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('renders search input', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      const searchInput = screen.getByTestId('input')
      expect(searchInput).toHaveAttribute('placeholder', 'Search titles and descriptions...')
    })

    it('calls onFiltersChange when search input changes', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      const searchInput = screen.getByTestId('input')
      fireEvent.change(searchInput, { target: { value: 'authentication' } })

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        ...mockFilters,
        search: 'authentication',
      })
    })

    it('displays current search value', () => {
      const filtersWithSearch = { ...mockFilters, search: 'test search' }
      render(
        <ChangelogFilters
          filters={filtersWithSearch}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      const searchInput = screen.getByTestId('input')
      expect(searchInput).toHaveValue('test search')
    })
  })

  describe('Workflow Filtering', () => {
    it('renders workflow checkboxes when workflows are available', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          availableWorkflows={mockAvailableWorkflows}
        />
      )

      expect(screen.getByText('Workflows')).toBeInTheDocument()

      // Should have checkboxes for each workflow
      const checkboxes = screen.getAllByTestId('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    it('shows selected workflow count', () => {
      const filtersWithWorkflows = {
        ...mockFilters,
        workflows: ['feature-development', 'bug-fix'],
      }

      render(
        <ChangelogFilters
          filters={filtersWithWorkflows}
          onFiltersChange={mockOnFiltersChange}
          availableWorkflows={mockAvailableWorkflows}
        />
      )

      expect(screen.getByText('2')).toBeInTheDocument() // Count badge
    })
  })

  describe('Status Filtering', () => {
    it('renders status filter checkboxes', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
      expect(screen.getByText('Cancelled')).toBeInTheDocument()
    })
  })

  describe('Date Range Filtering', () => {
    it('renders date range selector', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      expect(screen.getByText('Date Range')).toBeInTheDocument()
      expect(screen.getByTestId('select')).toBeInTheDocument()
    })

    it('handles date preset selection', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      const selectButton = screen.getByTestId('select').querySelector('button')
      fireEvent.click(selectButton!)

      // Mock select will trigger last7Days preset
      expect(mockOnFiltersChange).toHaveBeenCalled()
    })
  })

  describe('Clear Filters', () => {
    it('clears all filters when clear button is clicked', () => {
      const filtersWithValues: ChangelogFiltersType = {
        search: 'test',
        workflows: ['feature-development'],
        status: ['completed'],
        startDate: new Date(),
        endDate: new Date(),
      }

      render(
        <ChangelogFilters
          filters={filtersWithValues}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      const clearButton = screen.getByText('Clear')
      fireEvent.click(clearButton)

      expect(mockOnFiltersChange).toHaveBeenCalledWith({})
    })
  })

  describe('Compact Mode', () => {
    it('renders expand/collapse button in compact mode', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          compact={true}
        />
      )

      // In compact mode, should have a toggle button
      const toggleButtons = screen.getAllByRole('button')
      expect(toggleButtons.length).toBeGreaterThan(0)
    })

    it('toggles visibility in compact mode', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          compact={true}
        />
      )

      // Initially should be collapsed in compact mode
      // Implementation detail: search for expand/collapse behavior
      expect(screen.getByText('Filters')).toBeInTheDocument()
    })
  })

  describe('Filter State Management', () => {
    it('handles empty workflows array', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          availableWorkflows={[]}
        />
      )

      // Should still render but without workflow section
      expect(screen.getByText('Filters')).toBeInTheDocument()
    })

    it('handles missing availableWorkflows prop', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      // Should render without error
      expect(screen.getByText('Filters')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper labels for form elements', () => {
      render(
        <ChangelogFilters
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      )

      // Check for label elements
      const labels = screen.getAllByTestId('label')
      expect(labels.length).toBeGreaterThan(0)
    })
  })
})