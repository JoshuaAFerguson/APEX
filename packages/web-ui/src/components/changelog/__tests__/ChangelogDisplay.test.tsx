/**
 * ChangelogDisplay Component Tests
 *
 * Unit tests for the main ChangelogDisplay component,
 * including filtering, rendering, and interaction.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ChangelogDisplay } from '../ChangelogDisplay'
import type { ChangelogEntry } from '@/types/changelog'

// Mock child components
vi.mock('../ChangelogEntry', () => ({
  ChangelogEntry: ({ entry, onClick }: { entry: any; onClick?: any }) => (
    <div
      data-testid={`changelog-entry-${entry.id}`}
      onClick={() => onClick?.(entry)}
    >
      {entry.title}
    </div>
  ),
}))

vi.mock('../ChangelogFilters', () => ({
  ChangelogFilters: ({
    filters,
    onFiltersChange,
    availableWorkflows,
  }: {
    filters: any
    onFiltersChange: any
    availableWorkflows: string[]
  }) => (
    <div data-testid="changelog-filters">
      <button
        data-testid="filter-workflow-btn"
        onClick={() =>
          onFiltersChange({ ...filters, workflows: ['feature-development'] })
        }
      >
        Filter by Workflow
      </button>
      <button
        data-testid="search-btn"
        onClick={() => onFiltersChange({ ...filters, search: 'auth' })}
      >
        Search
      </button>
      <div data-testid="available-workflows">
        {availableWorkflows.join(', ')}
      </div>
    </div>
  ),
}))

describe('ChangelogDisplay', () => {
  const mockEntries: ChangelogEntry[] = [
    {
      id: '1',
      title: 'Add user authentication system',
      description: 'Implement JWT-based authentication',
      timestamp: new Date('2024-03-20T10:00:00Z'),
      workflow: 'feature-development',
      status: 'completed',
      changes: [],
      stats: { filesModified: 2, linesAdded: 100, linesRemoved: 5 },
      taskId: '1',
    },
    {
      id: '2',
      title: 'Fix rate limit error handling',
      description: 'Handle API rate limit errors gracefully',
      timestamp: new Date('2024-03-20T08:00:00Z'),
      workflow: 'bug-fix',
      status: 'completed',
      changes: [],
      stats: { filesModified: 1, linesAdded: 25, linesRemoved: 3 },
      taskId: '2',
    },
    {
      id: '3',
      title: 'Refactor utility functions',
      description: 'Extract common utility functions',
      timestamp: new Date('2024-03-19T16:00:00Z'),
      workflow: 'refactoring',
      status: 'failed',
      changes: [],
      stats: { filesModified: 5, linesAdded: 50, linesRemoved: 80 },
      taskId: '3',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with default title and entries', () => {
      render(<ChangelogDisplay entries={mockEntries} />)

      expect(screen.getByText('Changelog')).toBeInTheDocument()
      expect(screen.getByText('3 entries')).toBeInTheDocument()

      // Check that entries are rendered
      mockEntries.forEach(entry => {
        expect(screen.getByTestId(`changelog-entry-${entry.id}`)).toBeInTheDocument()
      })
    })

    it('renders with custom title', () => {
      render(<ChangelogDisplay entries={mockEntries} title="Project Changes" />)

      expect(screen.getByText('Project Changes')).toBeInTheDocument()
    })

    it('shows loading state when loading', () => {
      render(<ChangelogDisplay entries={[]} loading={true} />)

      expect(screen.getByText(/Loading changelog/)).toBeInTheDocument()
    })

    it('shows empty state when no entries', () => {
      render(<ChangelogDisplay entries={[]} />)

      expect(screen.getByText('No changelog entries')).toBeInTheDocument()
    })

    it('shows custom empty message', () => {
      render(
        <ChangelogDisplay
          entries={[]}
          emptyMessage="No recent changes found"
        />
      )

      expect(screen.getByText('No recent changes found')).toBeInTheDocument()
    })
  })

  describe('Filtering', () => {
    it('renders filters when showFilters is true', () => {
      render(<ChangelogDisplay entries={mockEntries} showFilters={true} />)

      expect(screen.getByTestId('changelog-filters')).toBeInTheDocument()
    })

    it('hides filters when showFilters is false', () => {
      render(<ChangelogDisplay entries={mockEntries} showFilters={false} />)

      expect(screen.queryByTestId('changelog-filters')).not.toBeInTheDocument()
    })

    it('provides available workflows to filters', () => {
      render(<ChangelogDisplay entries={mockEntries} showFilters={true} />)

      const availableWorkflows = screen.getByTestId('available-workflows')
      expect(availableWorkflows).toHaveTextContent('bug-fix, feature-development, refactoring')
    })

    it('filters entries by workflow', async () => {
      render(<ChangelogDisplay entries={mockEntries} showFilters={true} />)

      const filterButton = screen.getByTestId('filter-workflow-btn')
      fireEvent.click(filterButton)

      await waitFor(() => {
        // Should only show entries with 'feature-development' workflow
        expect(screen.getByTestId('changelog-entry-1')).toBeInTheDocument()
        expect(screen.queryByTestId('changelog-entry-2')).not.toBeInTheDocument()
        expect(screen.queryByTestId('changelog-entry-3')).not.toBeInTheDocument()
      })

      // Entry count should update
      expect(screen.getByText(/Showing 1.*of 3/)).toBeInTheDocument()
    })

    it('filters entries by search term', async () => {
      render(<ChangelogDisplay entries={mockEntries} showFilters={true} />)

      const searchButton = screen.getByTestId('search-btn')
      fireEvent.click(searchButton)

      await waitFor(() => {
        // Should only show entries containing 'auth'
        expect(screen.getByTestId('changelog-entry-1')).toBeInTheDocument()
        expect(screen.queryByTestId('changelog-entry-2')).not.toBeInTheDocument()
        expect(screen.queryByTestId('changelog-entry-3')).not.toBeInTheDocument()
      })
    })

    it('shows empty state with filters when no matches', async () => {
      // Create entries that won't match our filter
      const mockNoMatchEntries: ChangelogEntry[] = []

      render(
        <ChangelogDisplay entries={mockNoMatchEntries} showFilters={true} />
      )

      expect(screen.getByText('No changelog entries')).toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('calls onEntryClick when entry is clicked', () => {
      const onEntryClick = vi.fn()
      render(
        <ChangelogDisplay entries={mockEntries} onEntryClick={onEntryClick} />
      )

      const firstEntry = screen.getByTestId('changelog-entry-1')
      fireEvent.click(firstEntry)

      expect(onEntryClick).toHaveBeenCalledWith(mockEntries[0])
    })
  })

  describe('Sorting', () => {
    it('sorts entries by timestamp (most recent first)', () => {
      render(<ChangelogDisplay entries={mockEntries} />)

      const entryElements = screen.getAllByTestId(/changelog-entry-/)
      const entryIds = entryElements.map(el => el.getAttribute('data-testid')?.split('-')[2])

      // Should be sorted: entry-1 (most recent), entry-2, entry-3 (oldest)
      expect(entryIds).toEqual(['1', '2', '3'])
    })
  })

  describe('Edge Cases', () => {
    it('handles entries without git information', () => {
      const entriesWithoutGit = mockEntries.map(entry => ({
        ...entry,
        git: undefined,
      }))

      render(<ChangelogDisplay entries={entriesWithoutGit} />)

      // Should still render entries
      expect(screen.getByTestId('changelog-entry-1')).toBeInTheDocument()
    })

    it('handles entries with different statuses', () => {
      render(<ChangelogDisplay entries={mockEntries} />)

      // Should render entries with different statuses
      expect(screen.getByTestId('changelog-entry-1')).toBeInTheDocument() // completed
      expect(screen.getByTestId('changelog-entry-3')).toBeInTheDocument() // failed
    })
  })

  describe('Performance', () => {
    it('handles large number of entries', () => {
      const largeEntryList = Array.from({ length: 100 }, (_, i) => ({
        ...mockEntries[0],
        id: `entry-${i}`,
        title: `Entry ${i}`,
      }))

      render(<ChangelogDisplay entries={largeEntryList} />)

      expect(screen.getByText('100 entries')).toBeInTheDocument()
    })
  })
})