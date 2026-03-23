/**
 * ChangelogDisplay Component
 *
 * Main component that orchestrates the changelog display with filtering,
 * pagination, and real-time updates. Follows patterns from RecentActivityFeed.
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import {
  FileText,
  RefreshCw,
  ChevronDown,
  GitCommit,
  Clock
} from 'lucide-react'
import { ChangelogEntry } from './ChangelogEntry'
import { ChangelogFilters } from './ChangelogFilters'
import { DEFAULT_CHANGELOG_CONFIG } from './constants'
import type {
  ChangelogDisplayProps,
  ChangelogEntry as ChangelogEntryType,
  ChangelogFilters as ChangelogFiltersType
} from '@/types/changelog'

/**
 * Header component with title and stats
 */
function ChangelogHeader({
  title,
  totalEntries,
  filteredEntries,
  loading,
}: {
  title: string
  totalEntries: number
  filteredEntries: number
  loading: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <GitCommit className="w-5 h-5" />
        <h2 className="text-lg font-semibold">{title}</h2>
        {loading && <Spinner size="sm" />}
      </div>

      <div className="flex items-center gap-2 text-sm text-foreground-secondary">
        {totalEntries !== filteredEntries && (
          <>
            <span>Showing {filteredEntries}</span>
            <span>of {totalEntries}</span>
          </>
        )}
        {totalEntries === filteredEntries && (
          <span>{totalEntries} entries</span>
        )}
      </div>
    </div>
  )
}

/**
 * Empty state component
 */
function EmptyState({ message, hasFilters }: { message: string; hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileText className="w-12 h-12 mb-4 text-foreground-secondary opacity-50" />
      <h3 className="text-lg font-medium mb-2 text-foreground">
        {hasFilters ? 'No matching entries' : 'No changelog entries'}
      </h3>
      <p className="text-sm text-foreground-secondary max-w-md">
        {hasFilters
          ? 'Try adjusting your filters to see more entries.'
          : message
        }
      </p>
    </div>
  )
}

/**
 * Error state component
 */
function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-red-500 mb-4">
        <FileText className="w-12 h-12 opacity-50" />
      </div>
      <h3 className="text-lg font-medium mb-2 text-foreground">
        Failed to load changelog
      </h3>
      <p className="text-sm text-foreground-secondary max-w-md mb-4">
        {error.message}
      </p>
      <Button onClick={onRetry} variant="secondary" size="sm">
        <RefreshCw className="w-4 h-4 mr-2" />
        Try again
      </Button>
    </div>
  )
}

export function ChangelogDisplay({
  entries: propEntries,
  autoFetch = true,
  initialFilters = {},
  showFilters = true,
  showDiffPreview = true,
  maxHeight = DEFAULT_CHANGELOG_CONFIG.maxHeight,
  onEntryClick,
  loading: propLoading = false,
  className,
  title = DEFAULT_CHANGELOG_CONFIG.title,
  emptyMessage = DEFAULT_CHANGELOG_CONFIG.emptyMessage,
}: ChangelogDisplayProps) {
  // Local state
  const [filters, setFilters] = useState<ChangelogFiltersType>(initialFilters)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const [error, setError] = useState<Error | null>(null)

  // For this implementation, we'll use the prop entries
  // In a real implementation, this would integrate with useChangelog hook
  const entries = useMemo(() => propEntries || [], [propEntries])
  const loading = propLoading

  // Filter entries based on current filters
  const filteredEntries = useMemo(() => {
    let filtered = [...entries]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(searchLower) ||
        entry.description?.toLowerCase().includes(searchLower)
      )
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      filtered = filtered.filter(entry => {
        const entryDate = entry.timestamp
        if (filters.startDate && entryDate < filters.startDate) return false
        if (filters.endDate && entryDate > filters.endDate) return false
        return true
      })
    }

    // Workflow filter
    if (filters.workflows && filters.workflows.length > 0) {
      filtered = filtered.filter(entry =>
        filters.workflows!.includes(entry.workflow)
      )
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(entry =>
        filters.status!.includes(entry.status)
      )
    }

    // Sort by timestamp (most recent first)
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [entries, filters])

  // Get available workflows for filter dropdown
  const availableWorkflows = useMemo(() => {
    const workflows = Array.from(new Set(entries.map(e => e.workflow)))
    return workflows.sort()
  }, [entries])

  // Handle entry expansion toggle
  const toggleEntryExpansion = (entryId: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  // Handle entry click
  const handleEntryClick = (entry: ChangelogEntryType) => {
    onEntryClick?.(entry)
  }

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.startDate ||
      filters.endDate ||
      (filters.workflows && filters.workflows.length > 0) ||
      (filters.status && filters.status.length > 0)
    )
  }, [filters])

  // Retry function for error state
  const handleRetry = () => {
    setError(null)
    // In a real implementation, this would trigger a refetch
  }

  if (error) {
    return (
      <Card className={className}>
        <ErrorState error={error} onRetry={handleRetry} />
      </Card>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <ChangelogHeader
            title={title}
            totalEntries={entries.length}
            filteredEntries={filteredEntries.length}
            loading={loading}
          />
        </CardHeader>
      </Card>

      {/* Filters */}
      {showFilters && (
        <ChangelogFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableWorkflows={availableWorkflows}
          compact={false}
        />
      )}

      {/* Content */}
      <Card>
        <CardContent className="p-0">
          {/* Loading state */}
          {loading && entries.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Spinner className="mr-2" />
              <span className="text-foreground-secondary">Loading changelog...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredEntries.length === 0 && (
            <EmptyState
              message={emptyMessage}
              hasFilters={hasActiveFilters}
            />
          )}

          {/* Entries list */}
          {filteredEntries.length > 0 && (
            <div
              className="space-y-3 p-4"
              style={{ maxHeight, overflowY: 'auto' }}
            >
              {filteredEntries.map((entry) => (
                <ChangelogEntry
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedEntries.has(entry.id)}
                  onToggleExpand={() => toggleEntryExpansion(entry.id)}
                  showDiffToggle={showDiffPreview}
                  onClick={() => handleEntryClick(entry)}
                  compact={false}
                />
              ))}

              {/* Loading more indicator */}
              {loading && entries.length > 0 && (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" className="mr-2" />
                  <span className="text-sm text-foreground-secondary">
                    Loading more entries...
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary footer */}
      {filteredEntries.length > 0 && (
        <div className="text-xs text-foreground-secondary text-center">
          {hasActiveFilters && (
            <>Showing {filteredEntries.length} of {entries.length} entries • </>
          )}
          Last updated {new Date().toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}