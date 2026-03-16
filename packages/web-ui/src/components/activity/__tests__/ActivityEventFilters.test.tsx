import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActivityEventCategory } from '@/types/dashboard'
import {
  ActivityEventFilters,
  calculateFilterCounts,
  type ActivityFilterType,
} from '../ActivityEventFilters'

// Mock the utils module
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Activity: ({ className }: any) => <div data-testid="activity-icon" className={className} />,
  Bot: ({ className }: any) => <div data-testid="bot-icon" className={className} />,
  Wrench: ({ className }: any) => <div data-testid="wrench-icon" className={className} />,
  ShieldCheck: ({ className }: any) => <div data-testid="shield-check-icon" className={className} />,
  Lock: ({ className }: any) => <div data-testid="lock-icon" className={className} />,
  Info: ({ className }: any) => <div data-testid="info-icon" className={className} />,
  AlertCircle: ({ className }: any) => <div data-testid="alert-circle-icon" className={className} />,
  Filter: ({ className }: any) => <div data-testid="filter-icon" className={className} />,
}))

describe('ActivityEventFilters', () => {
  const defaultProps = {
    selectedFilter: 'all' as ActivityFilterType,
    filterCounts: {
      all: 100,
      task: 30,
      agent: 25,
      tool: 20,
      gate: 10,
      permission: 8,
      system: 5,
      error: 2,
    },
    onFilterChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all filter options with correct labels', () => {
    render(<ActivityEventFilters {...defaultProps} />)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
    expect(screen.getByText('Gates')).toBeInTheDocument()
    expect(screen.getByText('Permissions')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Errors')).toBeInTheDocument()
  })

  it('displays correct icons for each filter', () => {
    render(<ActivityEventFilters {...defaultProps} />)

    expect(screen.getByTestId('filter-icon')).toBeInTheDocument() // All
    expect(screen.getByTestId('activity-icon')).toBeInTheDocument() // Tasks
    expect(screen.getByTestId('bot-icon')).toBeInTheDocument() // Agents
    expect(screen.getByTestId('wrench-icon')).toBeInTheDocument() // Tools
    expect(screen.getByTestId('shield-check-icon')).toBeInTheDocument() // Gates
    expect(screen.getByTestId('lock-icon')).toBeInTheDocument() // Permissions
    expect(screen.getByTestId('info-icon')).toBeInTheDocument() // System
    expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument() // Errors
  })

  it('shows count badges when showCounts is true', () => {
    render(<ActivityEventFilters {...defaultProps} showCounts />)

    expect(screen.getByText('100')).toBeInTheDocument() // All
    expect(screen.getByText('30')).toBeInTheDocument() // Tasks
    expect(screen.getByText('25')).toBeInTheDocument() // Agents
    expect(screen.getByText('20')).toBeInTheDocument() // Tools
    expect(screen.getByText('10')).toBeInTheDocument() // Gates
    expect(screen.getByText('8')).toBeInTheDocument() // Permissions
    expect(screen.getByText('5')).toBeInTheDocument() // System
    expect(screen.getByText('2')).toBeInTheDocument() // Errors
  })

  it('hides count badges when showCounts is false', () => {
    render(<ActivityEventFilters {...defaultProps} showCounts={false} />)

    expect(screen.queryByText('100')).not.toBeInTheDocument()
    expect(screen.queryByText('30')).not.toBeInTheDocument()
  })

  it('highlights selected filter correctly', () => {
    render(<ActivityEventFilters {...defaultProps} selectedFilter="task" />)

    const taskButton = screen.getByRole('button', { name: /Tasks/i })
    const allButton = screen.getByRole('button', { name: /All/i })

    // Selected filter should have selected styling
    expect(taskButton).toHaveClass('bg-apex-500/20', 'text-apex-300')

    // Unselected filter should not have selected styling
    expect(allButton).not.toHaveClass('bg-apex-500/20', 'text-apex-300')
  })

  it('calls onFilterChange when filter is clicked', () => {
    const onFilterChange = vi.fn()
    render(<ActivityEventFilters {...defaultProps} onFilterChange={onFilterChange} />)

    const agentButton = screen.getByRole('button', { name: /Agents/i })
    fireEvent.click(agentButton)

    expect(onFilterChange).toHaveBeenCalledWith('agent')
  })

  it('shows tooltips with descriptions on hover', () => {
    render(<ActivityEventFilters {...defaultProps} />)

    const taskButton = screen.getByRole('button', { name: /Tasks/i })
    expect(taskButton).toHaveAttribute('title', 'Task lifecycle events')

    const agentButton = screen.getByRole('button', { name: /Agents/i })
    expect(agentButton).toHaveAttribute('title', 'Agent execution events')
  })

  it('hides filters with zero counts when hideEmpty is true', () => {
    const propsWithZeroCounts = {
      ...defaultProps,
      filterCounts: {
        ...defaultProps.filterCounts,
        permission: 0,
        system: 0,
      },
    }

    render(<ActivityEventFilters {...propsWithZeroCounts} hideEmpty />)

    expect(screen.queryByText('Permissions')).not.toBeInTheDocument()
    expect(screen.queryByText('System')).not.toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument() // Should still show non-zero
  })

  it('shows all filters when hideEmpty is false', () => {
    const propsWithZeroCounts = {
      ...defaultProps,
      filterCounts: {
        ...defaultProps.filterCounts,
        permission: 0,
        system: 0,
      },
    }

    render(<ActivityEventFilters {...propsWithZeroCounts} hideEmpty={false} />)

    expect(screen.getByText('Permissions')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('applies compact styles when compact is true', () => {
    render(<ActivityEventFilters {...defaultProps} compact />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toHaveClass('px-2', 'py-1', 'gap-1', 'text-xs')
    })
  })

  it('shows large counts correctly', () => {
    const propsWithLargeCounts = {
      ...defaultProps,
      filterCounts: {
        ...defaultProps.filterCounts,
        all: 150,
        task: 99,
        agent: 100,
      },
    }

    render(<ActivityEventFilters {...propsWithLargeCounts} showCounts />)

    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('99')).toBeInTheDocument()
    expect(screen.getByText('99+')).toBeInTheDocument() // Should cap at 99+
  })

  it('shows special styling for error filter', () => {
    const { rerender } = render(
      <ActivityEventFilters {...defaultProps} selectedFilter="error" />
    )

    const errorButton = screen.getByRole('button', { name: /Errors/i })

    // When selected, should have error styling
    expect(errorButton).toHaveClass('bg-red-500/20', 'text-red-300')

    // When not selected but has count > 0, should have error text color
    rerender(<ActivityEventFilters {...defaultProps} selectedFilter="all" />)
    expect(errorButton).toHaveClass('text-red-400')
  })

  it('shows empty message when no filters available and hideEmpty is true', () => {
    const propsWithAllZeroCounts = {
      ...defaultProps,
      filterCounts: {
        all: 0,
        task: 0,
        agent: 0,
        tool: 0,
        gate: 0,
        permission: 0,
        system: 0,
        error: 0,
      },
    }

    render(<ActivityEventFilters {...propsWithAllZeroCounts} hideEmpty />)

    expect(screen.getByText('No events to filter')).toBeInTheDocument()
  })

  it('handles keyboard navigation', () => {
    const onFilterChange = vi.fn()
    render(<ActivityEventFilters {...defaultProps} onFilterChange={onFilterChange} />)

    const taskButton = screen.getByRole('button', { name: /Tasks/i })

    // Test keyboard interaction
    taskButton.focus()
    fireEvent.keyDown(taskButton, { key: 'Enter' })
    expect(onFilterChange).toHaveBeenCalledWith('task')
  })
})

describe('calculateFilterCounts', () => {
  const mockEvents = [
    { category: 'task' as ActivityEventCategory },
    { category: 'task' as ActivityEventCategory },
    { category: 'agent' as ActivityEventCategory },
    { category: 'tool' as ActivityEventCategory },
    { category: 'error' as ActivityEventCategory },
  ]

  it('correctly calculates filter counts', () => {
    const counts = calculateFilterCounts(mockEvents)

    expect(counts).toEqual({
      all: 5,
      task: 2,
      agent: 1,
      tool: 1,
      gate: 0,
      permission: 0,
      system: 0,
      error: 1,
    })
  })

  it('handles empty events array', () => {
    const counts = calculateFilterCounts([])

    expect(counts).toEqual({
      all: 0,
      task: 0,
      agent: 0,
      tool: 0,
      gate: 0,
      permission: 0,
      system: 0,
      error: 0,
    })
  })

  it('handles unknown categories gracefully', () => {
    const eventsWithUnknownCategory = [
      { category: 'task' as ActivityEventCategory },
      { category: 'unknown' as any },
    ]

    const counts = calculateFilterCounts(eventsWithUnknownCategory)

    expect(counts.all).toBe(2)
    expect(counts.task).toBe(1)
    // Unknown category should not increment any specific count
  })
})