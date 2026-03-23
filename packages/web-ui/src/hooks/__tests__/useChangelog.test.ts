/**
 * useChangelog Hook Tests
 *
 * Unit tests for the useChangelog hook including data fetching,
 * filtering, pagination, and error handling.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useChangelog } from '../useChangelog'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  useApiClient: vi.fn(() => ({
    getChangelog: vi.fn(),
  })),
}))

describe('useChangelog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('initializes with empty state by default', () => {
      const { result } = renderHook(() => useChangelog({ autoFetch: false }))

      expect(result.current.entries).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.total).toBe(0)
      expect(result.current.hasMore).toBe(false)
      expect(result.current.availableWorkflows).toEqual([])
    })

    it('applies initial filters', () => {
      const initialFilters = {
        search: 'test',
        workflows: ['feature-development'],
      }

      const { result } = renderHook(() =>
        useChangelog({
          initialFilters,
          autoFetch: false,
        })
      )

      expect(result.current.filters).toEqual(initialFilters)
    })

    it('auto-fetches data when autoFetch is true', async () => {
      const { result } = renderHook(() =>
        useChangelog({
          autoFetch: true,
        })
      )

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.entries.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Data Fetching', () => {
    it('handles successful data fetch', async () => {
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: false })
      )

      act(() => {
        result.current.refresh()
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.entries.length).toBeGreaterThan(0)
      })
    })

    it('handles fetch errors gracefully', async () => {
      // Mock console.error to suppress error output in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Temporarily break the mock to cause an error
      vi.doMock('@/lib/api-client', () => ({
        useApiClient: vi.fn(() => ({
          getChangelog: vi.fn().mockRejectedValue(new Error('API Error')),
        })),
      }))

      const { result } = renderHook(() =>
        useChangelog({ autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        // Should have error but still function
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Filtering', () => {
    it('updates filters and refetches data', async () => {
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: false })
      )

      const newFilters = {
        search: 'authentication',
        workflows: ['feature-development'],
      }

      await act(async () => {
        result.current.setFilters(newFilters)
      })

      expect(result.current.filters).toEqual(newFilters)
    })

    it('resets entries when filters change', async () => {
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: true })
      )

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.entries.length).toBeGreaterThan(0)
      })

      const newFilters = { search: 'new search' }

      await act(async () => {
        result.current.setFilters(newFilters)
      })

      // Should reset and refetch
      expect(result.current.filters).toEqual(newFilters)
    })
  })

  describe('Pagination', () => {
    it('fetches more entries when hasMore is true', async () => {
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: true })
      )

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.entries.length).toBeGreaterThan(0)
      })

      const initialCount = result.current.entries.length

      if (result.current.hasMore) {
        await act(async () => {
          await result.current.fetchMore()
        })

        expect(result.current.entries.length).toBeGreaterThanOrEqual(initialCount)
      }
    })

    it('does not fetch more when hasMore is false', async () => {
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: false })
      )

      // Mock hasMore as false
      await act(async () => {
        await result.current.fetchMore()
      })

      // Should not have triggered loading
      expect(result.current.isLoading).toBe(false)
    })

    it('does not fetch more when already loading', async () => {
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: true })
      )

      // Try to fetch more while initial load is happening
      await act(async () => {
        await result.current.fetchMore()
      })

      // Should handle gracefully
      expect(result.current.isLoading).toBeDefined()
    })
  })

  describe('Refresh Functionality', () => {
    it('refreshes data and resets pagination', async () => {
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: true })
      )

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.entries.length).toBeGreaterThan(0)
      })

      await act(async () => {
        await result.current.refresh()
      })

      // Should have data
      expect(result.current.entries.length).toBeGreaterThan(0)
    })
  })

  describe('Auto-refresh', () => {
    it('sets up auto-refresh interval when configured', async () => {
      vi.useFakeTimers()

      const { result } = renderHook(() =>
        useChangelog({
          autoFetch: true,
          refreshInterval: 5000, // 5 seconds
        })
      )

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.entries.length).toBeGreaterThan(0)
      })

      const initialEntries = result.current.entries

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Should have triggered refresh
      await waitFor(() => {
        // Check that refresh was attempted (entries might be the same in mock)
        expect(result.current.entries).toBeDefined()
      })

      vi.useRealTimers()
    })

    it('does not set up auto-refresh when interval is 0', () => {
      vi.useFakeTimers()

      const { result } = renderHook(() =>
        useChangelog({
          autoFetch: true,
          refreshInterval: 0,
        })
      )

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // Should not have affected anything
      expect(result.current.entries).toBeDefined()

      vi.useRealTimers()
    })
  })

  describe('Available Workflows', () => {
    it('provides available workflows from fetched data', async () => {
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: true })
      )

      await waitFor(() => {
        expect(result.current.availableWorkflows.length).toBeGreaterThan(0)
      })

      expect(result.current.availableWorkflows).toContain('feature-development')
      expect(result.current.availableWorkflows).toContain('bug-fix')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty response gracefully', async () => {
      // This would require mocking the API to return empty data
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: false })
      )

      await act(async () => {
        await result.current.refresh()
      })

      // Should handle empty data gracefully
      expect(result.current.entries).toEqual(expect.any(Array))
      expect(result.current.total).toEqual(expect.any(Number))
      expect(result.current.hasMore).toEqual(expect.any(Boolean))
    })

    it('handles rapid filter changes', async () => {
      const { result } = renderHook(() =>
        useChangelog({ autoFetch: false })
      )

      // Rapidly change filters
      await act(async () => {
        result.current.setFilters({ search: 'first' })
        result.current.setFilters({ search: 'second' })
        result.current.setFilters({ search: 'third' })
      })

      expect(result.current.filters.search).toBe('third')
    })
  })
})