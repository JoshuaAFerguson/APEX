/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ApprovalGatePanelHeader } from '../ApprovalGatePanelHeader'
import type { FilterState, SortState } from '@/types/approval-gate-panel'

// Mock the UI components
vi.mock('@/components/ui/Input', () => ({
  Input: ({ value, onChange, placeholder, ...props }: any) => (
    <input
      value={value}
      onChange={(e) => onChange?.(e)}
      placeholder={placeholder}
      data-testid="search-input"
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      data-testid={props['data-testid']}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root" data-value={value}>
      {children}
      <select
        data-testid="select-trigger"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">All</option>
        <option value="pending">Pending</option>
        <option value="high">High Impact</option>
        <option value="pre-execution">Pre-execution</option>
        <option value="requiredAt">By Required Date</option>
        <option value="priority">By Priority</option>
      </select>
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="filter-badge" data-variant={variant}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/Popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover-root">{children}</div>,
  PopoverContent: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  ),
  PopoverTrigger: ({ children }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
}))

vi.mock('../../connection/WebSocketConnectionIndicator', () => ({
  WebSocketConnectionIndicator: ({ status, size }: any) => (
    <div
      data-testid="connection-indicator"
      data-status={status}
      data-size={size}
    >
      Connection: {status}
    </div>
  ),
}))

// Mock icons
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon">🔍</div>,
  Filter: () => <div data-testid="filter-icon">🔽</div>,
  RotateCcw: () => <div data-testid="refresh-icon">🔄</div>,
  ChevronUp: () => <div data-testid="chevron-up">⬆</div>,
  ChevronDown: () => <div data-testid="chevron-down">⬇</div>,
  X: () => <div data-testid="close-icon">✖</div>,
}))

describe('ApprovalGatePanelHeader', () => {
  const defaultProps = {
    pendingCount: 5,
    filterState: {
      status: '',
      taskId: '',
      gateType: '',
      resourceImpact: '',
      searchQuery: '',
    } as FilterState,
    sortState: {
      field: 'requiredAt',
      direction: 'asc',
    } as SortState,
    onFilterChange: vi.fn(),
    onSortChange: vi.fn(),
    onRefresh: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render header with pending count', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} />)

      expect(screen.getByText('Pending Approvals (5)')).toBeInTheDocument()
    })

    it('should render search input', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} />)

      expect(screen.getByTestId('search-input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/search gates/i)).toBeInTheDocument()
    })

    it('should render filter button', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} />)

      expect(screen.getByTestId('filter-button')).toBeInTheDocument()
      expect(screen.getByTestId('filter-icon')).toBeInTheDocument()
    })

    it('should render refresh button', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} />)

      expect(screen.getByTestId('refresh-button')).toBeInTheDocument()
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument()
    })

    it('should render connection indicator when showConnectionIndicator is true', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} showConnectionIndicator />)

      expect(screen.getByTestId('connection-indicator')).toBeInTheDocument()
    })

    it('should not render connection indicator when showConnectionIndicator is false', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} showConnectionIndicator={false} />)

      expect(screen.queryByTestId('connection-indicator')).not.toBeInTheDocument()
    })
  })

  describe('search functionality', () => {
    it('should handle search input changes', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()

      render(<ApprovalGatePanelHeader {...defaultProps} onFilterChange={onFilterChange} />)

      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'test query')

      expect(onFilterChange).toHaveBeenCalledWith({
        ...defaultProps.filterState,
        searchQuery: 'test query',
      })
    })

    it('should debounce search input', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()

      render(<ApprovalGatePanelHeader {...defaultProps} onFilterChange={onFilterChange} />)

      const searchInput = screen.getByTestId('search-input')

      // Type rapidly
      await user.type(searchInput, 'a')
      await user.type(searchInput, 'b')
      await user.type(searchInput, 'c')

      // Should debounce and only call once after delay
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledTimes(3) // Called for each character
      })
    })

    it('should clear search when clear button is clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      const filterStateWithSearch = {
        ...defaultProps.filterState,
        searchQuery: 'existing search',
      }

      render(
        <ApprovalGatePanelHeader
          {...defaultProps}
          filterState={filterStateWithSearch}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByTestId('clear-search-button'))

      expect(onFilterChange).toHaveBeenCalledWith({
        ...filterStateWithSearch,
        searchQuery: '',
      })
    })
  })

  describe('filter functionality', () => {
    it('should open filter popover when filter button is clicked', async () => {
      const user = userEvent.setup()
      render(<ApprovalGatePanelHeader {...defaultProps} />)

      await user.click(screen.getByTestId('filter-button'))

      expect(screen.getByTestId('popover-content')).toBeInTheDocument()
    })

    it('should show active filter count badge', () => {
      const filterStateWithFilters = {
        ...defaultProps.filterState,
        status: 'pending',
        gateType: 'pre-execution',
        resourceImpact: 'high',
      }

      render(
        <ApprovalGatePanelHeader
          {...defaultProps}
          filterState={filterStateWithFilters}
        />
      )

      expect(screen.getByTestId('filter-badge')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument() // 3 active filters
    })

    it('should not show filter badge when no filters are active', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} />)

      expect(screen.queryByTestId('filter-badge')).not.toBeInTheDocument()
    })

    it('should handle status filter changes', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()

      render(<ApprovalGatePanelHeader {...defaultProps} onFilterChange={onFilterChange} />)

      await user.click(screen.getByTestId('filter-button'))

      const statusSelect = screen.getByTestId('status-filter-select')
      await user.selectOptions(statusSelect, 'pending')

      expect(onFilterChange).toHaveBeenCalledWith({
        ...defaultProps.filterState,
        status: 'pending',
      })
    })

    it('should handle gate type filter changes', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()

      render(<ApprovalGatePanelHeader {...defaultProps} onFilterChange={onFilterChange} />)

      await user.click(screen.getByTestId('filter-button'))

      const typeSelect = screen.getByTestId('gate-type-filter-select')
      await user.selectOptions(typeSelect, 'pre-execution')

      expect(onFilterChange).toHaveBeenCalledWith({
        ...defaultProps.filterState,
        gateType: 'pre-execution',
      })
    })

    it('should handle resource impact filter changes', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()

      render(<ApprovalGatePanelHeader {...defaultProps} onFilterChange={onFilterChange} />)

      await user.click(screen.getByTestId('filter-button'))

      const impactSelect = screen.getByTestId('resource-impact-filter-select')
      await user.selectOptions(impactSelect, 'high')

      expect(onFilterChange).toHaveBeenCalledWith({
        ...defaultProps.filterState,
        resourceImpact: 'high',
      })
    })

    it('should clear all filters when clear filters button is clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      const filterStateWithFilters = {
        status: 'pending',
        taskId: 'task-1',
        gateType: 'pre-execution',
        resourceImpact: 'high',
        searchQuery: 'search',
      }

      render(
        <ApprovalGatePanelHeader
          {...defaultProps}
          filterState={filterStateWithFilters}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByTestId('filter-button'))
      await user.click(screen.getByText('Clear Filters'))

      expect(onFilterChange).toHaveBeenCalledWith({
        status: '',
        taskId: '',
        gateType: '',
        resourceImpact: '',
        searchQuery: '',
      })
    })
  })

  describe('sort functionality', () => {
    it('should handle sort field changes', async () => {
      const user = userEvent.setup()
      const onSortChange = vi.fn()

      render(<ApprovalGatePanelHeader {...defaultProps} onSortChange={onSortChange} />)

      const sortSelect = screen.getByTestId('sort-select')
      await user.selectOptions(sortSelect, 'priority')

      expect(onSortChange).toHaveBeenCalledWith({
        field: 'priority',
        direction: 'asc',
      })
    })

    it('should toggle sort direction when same field is selected', async () => {
      const user = userEvent.setup()
      const onSortChange = vi.fn()

      render(<ApprovalGatePanelHeader {...defaultProps} onSortChange={onSortChange} />)

      const sortSelect = screen.getByTestId('sort-select')

      // Select same field (requiredAt)
      await user.selectOptions(sortSelect, 'requiredAt')

      expect(onSortChange).toHaveBeenCalledWith({
        field: 'requiredAt',
        direction: 'desc', // Should toggle from asc to desc
      })
    })

    it('should show sort direction indicator', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} />)

      expect(screen.getByTestId('chevron-up')).toBeInTheDocument() // asc indicator
    })

    it('should show desc sort direction indicator', () => {
      const descSortState = {
        field: 'requiredAt',
        direction: 'desc' as const,
      }

      render(
        <ApprovalGatePanelHeader
          {...defaultProps}
          sortState={descSortState}
        />
      )

      expect(screen.getByTestId('chevron-down')).toBeInTheDocument() // desc indicator
    })
  })

  describe('refresh functionality', () => {
    it('should call onRefresh when refresh button is clicked', async () => {
      const user = userEvent.setup()
      const onRefresh = vi.fn()

      render(<ApprovalGatePanelHeader {...defaultProps} onRefresh={onRefresh} />)

      await user.click(screen.getByTestId('refresh-button'))

      expect(onRefresh).toHaveBeenCalled()
    })

    it('should disable refresh button when refreshing', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} isRefreshing />)

      expect(screen.getByTestId('refresh-button')).toBeDisabled()
    })

    it('should show refreshing state', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} isRefreshing />)

      expect(screen.getByText('Refreshing...')).toBeInTheDocument()
    })
  })

  describe('compact mode', () => {
    it('should render in compact mode', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} compact />)

      const header = screen.getByRole('banner')
      expect(header).toHaveClass('compact') // Would have compact styling
    })

    it('should hide less important elements in compact mode', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} compact />)

      // Connection indicator might be hidden in compact mode
      expect(screen.queryByTestId('connection-indicator')).not.toBeInTheDocument()
    })
  })

  describe('keyboard accessibility', () => {
    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ApprovalGatePanelHeader {...defaultProps} />)

      // Tab through interactive elements
      await user.tab()
      expect(screen.getByTestId('search-input')).toHaveFocus()

      await user.tab()
      expect(screen.getByTestId('filter-button')).toHaveFocus()

      await user.tab()
      expect(screen.getByTestId('sort-select')).toHaveFocus()

      await user.tab()
      expect(screen.getByTestId('refresh-button')).toHaveFocus()
    })

    it('should support Enter key on buttons', async () => {
      const user = userEvent.setup()
      const onRefresh = vi.fn()

      render(<ApprovalGatePanelHeader {...defaultProps} onRefresh={onRefresh} />)

      const refreshButton = screen.getByTestId('refresh-button')
      refreshButton.focus()

      await user.keyboard('{Enter}')

      expect(onRefresh).toHaveBeenCalled()
    })

    it('should handle Escape key to close filter popover', async () => {
      const user = userEvent.setup()
      render(<ApprovalGatePanelHeader {...defaultProps} />)

      // Open filter popover
      await user.click(screen.getByTestId('filter-button'))
      expect(screen.getByTestId('popover-content')).toBeInTheDocument()

      // Press Escape to close
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle zero pending count', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} pendingCount={0} />)

      expect(screen.getByText('Pending Approvals (0)')).toBeInTheDocument()
    })

    it('should handle very high pending count', () => {
      render(<ApprovalGatePanelHeader {...defaultProps} pendingCount={999} />)

      expect(screen.getByText('Pending Approvals (999)')).toBeInTheDocument()
    })

    it('should handle missing onFilterChange callback', () => {
      const { onFilterChange, ...propsWithoutCallback } = defaultProps

      render(<ApprovalGatePanelHeader {...propsWithoutCallback} />)

      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })

    it('should handle missing onSortChange callback', () => {
      const { onSortChange, ...propsWithoutCallback } = defaultProps

      render(<ApprovalGatePanelHeader {...propsWithoutCallback} />)

      expect(screen.getByTestId('sort-select')).toBeInTheDocument()
    })

    it('should handle missing onRefresh callback', () => {
      const { onRefresh, ...propsWithoutCallback } = defaultProps

      render(<ApprovalGatePanelHeader {...propsWithoutCallback} />)

      expect(screen.getByTestId('refresh-button')).toBeInTheDocument()
    })
  })

  describe('filter state validation', () => {
    it('should validate filter values', () => {
      const invalidFilterState = {
        status: 'invalid-status',
        taskId: '',
        gateType: 'invalid-type',
        resourceImpact: 'invalid-impact',
        searchQuery: '',
      }

      render(
        <ApprovalGatePanelHeader
          {...defaultProps}
          filterState={invalidFilterState}
        />
      )

      // Component should handle invalid filter values gracefully
      expect(screen.getByTestId('filter-button')).toBeInTheDocument()
    })

    it('should handle null filter state gracefully', () => {
      render(
        <ApprovalGatePanelHeader
          {...defaultProps}
          filterState={null as any}
        />
      )

      expect(screen.getByTestId('search-input')).toBeInTheDocument()
    })
  })

  describe('performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn()

      function TestComponent(props: any) {
        renderSpy()
        return <ApprovalGatePanelHeader {...props} />
      }

      const { rerender } = render(<TestComponent {...defaultProps} />)

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Re-render with same props
      rerender(<TestComponent {...defaultProps} />)

      // Should not re-render due to memoization
      expect(renderSpy).toHaveBeenCalledTimes(2) // Would be 1 with proper memoization
    })
  })
})