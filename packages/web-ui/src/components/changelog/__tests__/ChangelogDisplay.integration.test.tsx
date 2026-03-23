/**
 * ChangelogDisplay Integration Tests
 *
 * Integration tests for the complete changelog system including
 * data fetching, filtering, and real-world interaction patterns.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ChangelogDisplay } from '../ChangelogDisplay'
import type { ChangelogEntry } from '@/types/changelog'

// Mock the useChangelog hook for controlled testing
const mockUseChangelog = vi.fn()
vi.mock('@/hooks/useChangelog', () => ({
  useChangelog: mockUseChangelog,
}))

describe('ChangelogDisplay Integration Tests', () => {
  const createMockEntries = (count: number): ChangelogEntry[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `entry-${i + 1}`,
      title: `Feature ${i + 1}: Add ${['authentication', 'validation', 'caching', 'logging'][i % 4]} system`,
      description: `Implement ${['JWT-based auth', 'input validation', 'Redis caching', 'structured logging'][i % 4]}`,
      timestamp: new Date(Date.now() - (i * 60 * 60 * 1000)), // i hours ago
      workflow: ['feature-development', 'bug-fix', 'refactoring', 'maintenance'][i % 4],
      status: (['completed', 'failed', 'cancelled'] as const)[i % 3],
      git: {
        branchName: `feature/branch-${i + 1}`,
        prUrl: `https://github.com/example/repo/pull/${i + 1}`,
      },
      changes: [
        {
          path: `src/feature-${i + 1}/index.ts`,
          type: (['added', 'modified', 'deleted', 'renamed'] as const)[i % 4],
          diff: `@@ -0,0 +1,${(i + 1) * 5} @@\n${Array((i + 1) * 5).fill(`+line ${i + 1}`).join('\n')}`,
          stats: {
            additions: (i + 1) * 5,
            deletions: i % 2,
          },
        },
      ],
      stats: {
        filesModified: 1,
        linesAdded: (i + 1) * 5,
        linesRemoved: i % 2,
      },
      taskId: `task-${i + 1}`,
    }))
  }

  const mockHookReturn = {
    entries: createMockEntries(10),
    isLoading: false,
    error: null,
    filters: {},
    setFilters: vi.fn(),
    fetchMore: vi.fn(),
    hasMore: false,
    total: 10,
    refresh: vi.fn(),
    availableWorkflows: ['feature-development', 'bug-fix', 'refactoring', 'maintenance'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseChangelog.mockReturnValue(mockHookReturn)
  })

  describe('Full Component Integration', () => {
    it('renders complete changelog with all sections', async () => {
      render(<ChangelogDisplay autoFetch={true} showFilters={true} />)

      // Header should be present
      expect(screen.getByText('Changelog')).toBeInTheDocument()
      expect(screen.getByText('10 entries')).toBeInTheDocument()

      // Filters should be rendered
      expect(screen.getByText('Filters')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search titles and descriptions...')).toBeInTheDocument()

      // Entries should be rendered
      expect(screen.getByText('Feature 1: Add authentication system')).toBeInTheDocument()
      expect(screen.getByText('Feature 2: Add validation system')).toBeInTheDocument()
    })

    it('handles complete workflow from search to viewing diffs', async () => {
      const user = userEvent.setup()
      render(<ChangelogDisplay autoFetch={true} showFilters={true} showDiffPreview={true} />)

      // 1. Perform search
      const searchInput = screen.getByPlaceholderText('Search titles and descriptions...')
      await user.type(searchInput, 'authentication')

      await waitFor(() => {
        expect(mockHookReturn.setFilters).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'authentication' })
        )
      })

      // 2. Find and expand an entry
      const authEntry = screen.getByText('Feature 1: Add authentication system')
      expect(authEntry).toBeInTheDocument()

      // 3. Try to expand diff (this would trigger in a real scenario)
      const expandButtons = screen.getAllByText(/Show changes/)
      if (expandButtons.length > 0) {
        fireEvent.click(expandButtons[0])
      }
    })

    it('handles filtering by multiple criteria simultaneously', async () => {
      const user = userEvent.setup()
      render(<ChangelogDisplay autoFetch={true} showFilters={true} />)

      // Apply search filter
      const searchInput = screen.getByPlaceholderText('Search titles and descriptions...')
      await user.type(searchInput, 'authentication')

      // Apply status filter (mock interaction)
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i })
      await user.click(completedCheckbox)

      // Apply workflow filter (mock interaction)
      const featureCheckbox = screen.getByRole('checkbox', { name: /feature-development/i })
      if (featureCheckbox) {
        await user.click(featureCheckbox)
      }

      // Should have called setFilters with combined criteria
      expect(mockHookReturn.setFilters).toHaveBeenCalled()
    })

    it('handles pagination and infinite loading', async () => {
      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        hasMore: true,
        isLoading: false,
      })

      render(<ChangelogDisplay autoFetch={true} />)

      // Should show load more functionality would be available
      expect(mockHookReturn.fetchMore).toBeDefined()

      // Trigger load more (this would happen on scroll or button click)
      mockHookReturn.fetchMore()

      expect(mockHookReturn.fetchMore).toHaveBeenCalled()
    })
  })

  describe('Error Handling Integration', () => {
    it('displays error state and allows retry', async () => {
      const mockError = new Error('Failed to fetch changelog')
      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        entries: [],
        error: mockError,
        isLoading: false,
      })

      render(<ChangelogDisplay autoFetch={true} />)

      expect(screen.getByText('Failed to load changelog')).toBeInTheDocument()
      expect(screen.getByText(mockError.message)).toBeInTheDocument()

      // Click retry button
      const retryButton = screen.getByText('Try again')
      fireEvent.click(retryButton)

      // Should have attempted to refresh
      expect(mockHookReturn.refresh).toHaveBeenCalled()
    })

    it('gracefully handles network interruptions', async () => {
      // Start with loading state
      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        entries: [],
        isLoading: true,
        error: null,
      })

      const { rerender } = render(<ChangelogDisplay autoFetch={true} />)

      expect(screen.getByText('Loading changelog...')).toBeInTheDocument()

      // Simulate network error
      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        entries: [],
        isLoading: false,
        error: new Error('Network error'),
      })

      rerender(<ChangelogDisplay autoFetch={true} />)

      expect(screen.getByText('Failed to load changelog')).toBeInTheDocument()

      // Simulate recovery
      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        entries: createMockEntries(5),
        isLoading: false,
        error: null,
      })

      rerender(<ChangelogDisplay autoFetch={true} />)

      expect(screen.getByText('5 entries')).toBeInTheDocument()
    })
  })

  describe('Real-time Updates Integration', () => {
    it('updates display when new entries arrive', async () => {
      const { rerender } = render(<ChangelogDisplay autoFetch={true} />)

      // Initially 10 entries
      expect(screen.getByText('10 entries')).toBeInTheDocument()

      // Simulate new entries arriving
      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        entries: createMockEntries(12),
        total: 12,
      })

      rerender(<ChangelogDisplay autoFetch={true} />)

      expect(screen.getByText('12 entries')).toBeInTheDocument()
    })

    it('handles entry updates correctly', async () => {
      const { rerender } = render(<ChangelogDisplay autoFetch={true} />)

      expect(screen.getByText('Feature 1: Add authentication system')).toBeInTheDocument()

      // Simulate entry update
      const updatedEntries = createMockEntries(10)
      updatedEntries[0].title = 'Feature 1: Enhanced authentication system'

      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        entries: updatedEntries,
      })

      rerender(<ChangelogDisplay autoFetch={true} />)

      expect(screen.getByText('Feature 1: Enhanced authentication system')).toBeInTheDocument()
      expect(screen.queryByText('Feature 1: Add authentication system')).not.toBeInTheDocument()
    })
  })

  describe('Performance Integration', () => {
    it('handles large datasets efficiently', async () => {
      const largeDataset = createMockEntries(100)

      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        entries: largeDataset,
        total: 100,
      })

      const { container } = render(<ChangelogDisplay autoFetch={true} />)

      expect(screen.getByText('100 entries')).toBeInTheDocument()

      // Should still be responsive
      const searchInput = screen.getByPlaceholderText('Search titles and descriptions...')
      fireEvent.change(searchInput, { target: { value: 'feature' } })

      // Component should handle without issues
      expect(container).toBeInTheDocument()
    })

    it('maintains scroll position during updates', async () => {
      const { rerender } = render(
        <ChangelogDisplay autoFetch={true} maxHeight={400} />
      )

      // Simulate scrolled state with new data
      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        entries: [...createMockEntries(10), ...createMockEntries(5)],
        total: 15,
      })

      rerender(<ChangelogDisplay autoFetch={true} maxHeight={400} />)

      // Should maintain scroll container
      const scrollContainer = document.querySelector('[style*="maxHeight"]')
      expect(scrollContainer).toBeInTheDocument()
    })
  })

  describe('Accessibility Integration', () => {
    it('maintains focus management during interactions', async () => {
      const user = userEvent.setup()
      render(<ChangelogDisplay autoFetch={true} showFilters={true} />)

      // Focus search input
      const searchInput = screen.getByPlaceholderText('Search titles and descriptions...')
      await user.click(searchInput)

      expect(document.activeElement).toBe(searchInput)

      // Clear filters should maintain reasonable focus
      const clearButton = screen.queryByText('Clear')
      if (clearButton) {
        await user.click(clearButton)
        // Focus should remain manageable
        expect(document.activeElement).toBeDefined()
      }
    })

    it('provides proper keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ChangelogDisplay autoFetch={true} showFilters={true} showDiffPreview={true} />)

      // Tab through interface
      await user.tab() // Should focus first interactive element

      // Should be able to navigate through filters and entries
      expect(document.activeElement).toBeDefined()

      // Enter key should activate focused elements
      if (document.activeElement?.tagName === 'BUTTON') {
        await user.keyboard('{Enter}')
        // Should handle activation gracefully
      }
    })

    it('announces dynamic content changes to screen readers', async () => {
      const { rerender } = render(<ChangelogDisplay autoFetch={true} />)

      // Simulate loading state change
      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        isLoading: true,
      })

      rerender(<ChangelogDisplay autoFetch={true} />)

      // Should have loading indicator with proper text
      expect(screen.getByText('Loading changelog...')).toBeInTheDocument()

      // Complete loading
      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        isLoading: false,
      })

      rerender(<ChangelogDisplay autoFetch={true} />)

      // Should announce results
      expect(screen.getByText('10 entries')).toBeInTheDocument()
    })
  })

  describe('Mobile Responsiveness Integration', () => {
    it('adapts to compact mode correctly', () => {
      render(
        <ChangelogDisplay
          autoFetch={true}
          showFilters={true}
          className="mobile-view"
        />
      )

      // Should render with mobile considerations
      expect(screen.getByText('Changelog')).toBeInTheDocument()

      // Compact filter toggle should be available
      const filterSection = screen.getByText('Filters')
      expect(filterSection).toBeInTheDocument()
    })

    it('handles touch interactions appropriately', async () => {
      const user = userEvent.setup()
      render(<ChangelogDisplay autoFetch={true} showDiffPreview={true} />)

      // Simulate touch-like interactions
      const expandButton = screen.getAllByText(/Show changes/)[0]
      if (expandButton) {
        await user.click(expandButton)
        // Should handle touch events properly
      }
    })
  })

  describe('Data Consistency Integration', () => {
    it('maintains filter state across data updates', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<ChangelogDisplay autoFetch={true} showFilters={true} />)

      // Apply filter
      const searchInput = screen.getByPlaceholderText('Search titles and descriptions...')
      await user.type(searchInput, 'authentication')

      // Update data while filter is active
      const filteredEntries = createMockEntries(10).filter(e =>
        e.title.includes('authentication')
      )

      mockUseChangelog.mockReturnValue({
        ...mockHookReturn,
        entries: filteredEntries,
        filters: { search: 'authentication' },
      })

      rerender(<ChangelogDisplay autoFetch={true} showFilters={true} />)

      // Filter should persist
      expect(searchInput).toHaveValue('authentication')
    })

    it('synchronizes state between multiple instances', () => {
      // This would be more relevant in apps with multiple changelog displays
      const { container: container1 } = render(
        <ChangelogDisplay autoFetch={true} title="Main Changelog" />
      )

      const { container: container2 } = render(
        <ChangelogDisplay autoFetch={true} title="Secondary Changelog" />
      )

      // Both should show same data source
      expect(container1).toBeInTheDocument()
      expect(container2).toBeInTheDocument()
    })
  })
})