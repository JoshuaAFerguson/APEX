/**
 * useChangelog Hook
 *
 * Custom hook for managing changelog data, including fetching, filtering,
 * pagination, and real-time updates. Follows patterns from existing hooks.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import type {
  ChangelogFilters,
  ChangelogEntry,
  UseChangelogOptions,
  UseChangelogReturn
} from '@/types/changelog'

const DEFAULT_PAGE_SIZE = 20

/**
 * Custom hook for changelog data management
 */
export function useChangelog(options: UseChangelogOptions = {}): UseChangelogReturn {
  const {
    initialFilters = {},
    autoFetch = true,
    refreshInterval = 0,
    pageSize = DEFAULT_PAGE_SIZE,
  } = options

  // State
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [filters, setFilters] = useState<ChangelogFilters>(initialFilters)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [availableWorkflows, setAvailableWorkflows] = useState<string[]>([])

  // Fetch changelog entries
  const fetchChangelog = useCallback(async (
    currentFilters: ChangelogFilters = filters,
    append: boolean = false
  ) => {
    try {
      setIsLoading(true)
      setError(null)

      // Build filters with pagination
      const fetchFilters: ChangelogFilters = {
        ...currentFilters,
        limit: pageSize,
        offset: append ? entries.length : 0,
      }

      // This would call the actual API method when implemented
      // For now, we'll simulate the API call with mock data
      const response = await simulateApiCall(fetchFilters)

      if (append) {
        setEntries(prev => [...prev, ...response.entries])
      } else {
        setEntries(response.entries)
      }

      setTotal(response.total)
      setHasMore(response.hasMore)
      setAvailableWorkflows(response.workflows)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch changelog'))
    } finally {
      setIsLoading(false)
    }
  // Note: apiClient from @/lib/api-client is available if needed
  }, [filters, pageSize, entries.length])

  // Simulated API call - replace with actual API client call
  const simulateApiCall = async (filters: ChangelogFilters) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Mock data - in real implementation, this would be:
    // return apiClient.getChangelog(filters)
    const mockEntries: ChangelogEntry[] = [
      {
        id: '1',
        title: 'Add user authentication system',
        description: 'Implement JWT-based authentication with login/logout functionality',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        workflow: 'feature-development',
        status: 'completed',
        git: {
          branchName: 'feature/auth-system',
          prUrl: 'https://github.com/example/repo/pull/123',
        },
        changes: [
          {
            path: 'src/auth/AuthProvider.tsx',
            type: 'added',
            diff: `@@ -0,0 +1,89 @@
+import React, { createContext, useContext, useState } from 'react'
+
+export interface AuthContextValue {
+  user: User | null
+  login: (credentials: Credentials) => Promise<void>
+  logout: () => void
+}
+
+const AuthContext = createContext<AuthContextValue | null>(null)
+
+export function AuthProvider({ children }: { children: React.ReactNode }) {
+  const [user, setUser] = useState<User | null>(null)
+
+  const login = async (credentials: Credentials) => {
+    // Implementation
+  }
+
+  const logout = () => {
+    setUser(null)
+  }
+
+  return (
+    <AuthContext.Provider value={{ user, login, logout }}>
+      {children}
+    </AuthContext.Provider>
+  )
+}`,
            stats: { additions: 89, deletions: 0 },
          },
          {
            path: 'src/auth/useAuth.ts',
            type: 'added',
            diff: `@@ -0,0 +1,34 @@
+import { useContext } from 'react'
+import { AuthContext } from './AuthProvider'
+
+export function useAuth() {
+  const context = useContext(AuthContext)
+  if (!context) {
+    throw new Error('useAuth must be used within AuthProvider')
+  }
+  return context
+}`,
            stats: { additions: 34, deletions: 0 },
          },
        ],
        stats: {
          filesModified: 2,
          linesAdded: 123,
          linesRemoved: 0,
        },
        taskId: '1',
      },
      {
        id: '2',
        title: 'Fix rate limit error handling',
        description: 'Handle API rate limit errors gracefully with retry logic',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        workflow: 'bug-fix',
        status: 'completed',
        changes: [
          {
            path: 'src/api/client.ts',
            type: 'modified',
            diff: `@@ -15,6 +15,18 @@ export class ApiClient {
   }

   private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
+    let retries = 0
+    const maxRetries = 3
+
+    while (retries < maxRetries) {
+      try {
+        const response = await fetch(\`\${this.baseUrl}\${path}\`, options)
+
+        if (response.status === 429) {
+          const retryAfter = response.headers.get('retry-after')
+          await this.delay(parseInt(retryAfter || '1') * 1000)
+          retries++
+          continue
+        }
+
+        if (!response.ok) {
+          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
+        }
+
+        return response.json()
+      } catch (error) {
+        if (retries === maxRetries - 1) throw error
+        retries++
+        await this.delay(1000 * Math.pow(2, retries))
+      }
+    }
+
+    throw new Error('Max retries exceeded')
   }
+
+  private delay(ms: number): Promise<void> {
+    return new Promise(resolve => setTimeout(resolve, ms))
+  }
 }`,
            stats: { additions: 25, deletions: 3 },
          },
        ],
        stats: {
          filesModified: 1,
          linesAdded: 25,
          linesRemoved: 3,
        },
        taskId: '2',
      },
    ]

    // Apply basic filtering for demonstration
    let filtered = mockEntries

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(searchLower) ||
        entry.description?.toLowerCase().includes(searchLower)
      )
    }

    if (filters.workflows && filters.workflows.length > 0) {
      filtered = filtered.filter(entry => filters.workflows!.includes(entry.workflow))
    }

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(entry => filters.status!.includes(entry.status))
    }

    // Pagination
    const offset = filters.offset || 0
    const limit = filters.limit || pageSize
    const paginatedEntries = filtered.slice(offset, offset + limit)

    return {
      entries: paginatedEntries,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
      workflows: ['feature-development', 'bug-fix', 'refactoring', 'maintenance'],
    }
  }

  // Update filters and refetch
  const updateFilters = useCallback((newFilters: ChangelogFilters) => {
    setFilters(newFilters)
    // Reset entries when filters change
    setEntries([])
    fetchChangelog(newFilters, false)
  }, [fetchChangelog])

  // Fetch more entries (pagination)
  const fetchMore = useCallback(async () => {
    if (!hasMore || isLoading) return
    await fetchChangelog(filters, true)
  }, [hasMore, isLoading, fetchChangelog, filters])

  // Refresh entries
  const refresh = useCallback(async () => {
    setEntries([])
    await fetchChangelog(filters, false)
  }, [fetchChangelog, filters])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && entries.length === 0) {
      fetchChangelog(filters, false)
    }
  }, [autoFetch, entries.length, fetchChangelog, filters])

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return

    const interval = setInterval(() => {
      refresh()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval, refresh])

  // Memoized return object
  return useMemo(
    () => ({
      entries,
      isLoading,
      error,
      filters,
      setFilters: updateFilters,
      fetchMore,
      hasMore,
      total,
      refresh,
      availableWorkflows,
    }),
    [
      entries,
      isLoading,
      error,
      filters,
      updateFilters,
      fetchMore,
      hasMore,
      total,
      refresh,
      availableWorkflows,
    ]
  )
}