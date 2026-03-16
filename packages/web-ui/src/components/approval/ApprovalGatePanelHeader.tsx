'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { WebSocketConnectionIndicator } from '@/components/connection/WebSocketConnectionIndicator'
import {
  GATE_TYPE_CONFIG,
  RESOURCE_IMPACT_CONFIG,
  GATE_STATUS_LABELS,
  SIZE_VARIANTS,
} from '@/types/approval-gate-panel-constants'
import type { WebSocketConnectionStatus } from '@/types/websocket-connection'
import type { PendingApprovalGate } from '@/types/approval-gate-panel'
import { cn } from '@/lib/utils'
import {
  Filter,
  Search,
  SortAsc,
  SortDesc,
  RefreshCw,
  X,
  ChevronDown,
} from 'lucide-react'

/**
 * Filter state interface
 */
interface FilterState {
  status: 'all' | 'pending' | 'approved' | 'rejected' | 'timeout' | 'skipped'
  taskId: string | null
  gateType: PendingApprovalGate['gateType'] | null
  resourceImpact: PendingApprovalGate['resourceImpact'] | null
  searchQuery: string
}

/**
 * Sort state interface
 */
interface SortState {
  field: 'requiredAt' | 'priority' | 'taskId' | 'name'
  direction: 'asc' | 'desc'
}

/**
 * Props for ApprovalGatePanelHeader component
 */
interface ApprovalGatePanelHeaderProps {
  /** Number of pending gates */
  pendingCount: number
  /** WebSocket connection status */
  connectionStatus: WebSocketConnectionStatus
  /** Whether to show connection indicator */
  showConnectionIndicator: boolean
  /** Current filter state */
  filterState: FilterState
  /** Current sort state */
  sortState: SortState
  /** Filter change handler */
  onFilterChange: (filterState: FilterState) => void
  /** Sort change handler */
  onSortChange: (sortState: SortState) => void
  /** Refresh handler */
  onRefresh: () => Promise<void>
  /** Compact mode */
  compact?: boolean
  /** Custom className */
  className?: string
}

/**
 * Header component for ApprovalGatePanel with filters, sort, and connection status
 */
export function ApprovalGatePanelHeader({
  pendingCount,
  connectionStatus,
  showConnectionIndicator,
  filterState,
  sortState,
  onFilterChange,
  onSortChange,
  onRefresh,
  compact = false,
  className,
}: ApprovalGatePanelHeaderProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  /**
   * Handle search query change
   */
  const handleSearchChange = (value: string) => {
    onFilterChange({
      ...filterState,
      searchQuery: value,
    })
  }

  /**
   * Handle filter change
   */
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    onFilterChange({
      ...filterState,
      [key]: value === 'all' || value === '' ? null : value,
    })
  }

  /**
   * Handle sort change
   */
  const handleSortChange = (field: SortState['field']) => {
    const newDirection =
      sortState.field === field && sortState.direction === 'desc' ? 'asc' : 'desc'

    onSortChange({
      field,
      direction: newDirection,
    })
  }

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    onFilterChange({
      status: 'all',
      taskId: null,
      gateType: null,
      resourceImpact: null,
      searchQuery: '',
    })
  }

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  /**
   * Check if any filters are active
   */
  const hasActiveFilters =
    filterState.searchQuery ||
    filterState.status !== 'all' ||
    filterState.taskId ||
    filterState.gateType ||
    filterState.resourceImpact

  return (
    <div className={cn('space-y-3', compact && 'space-y-2', className)}>
      {/* Main header row */}
      <div className="flex items-center justify-between gap-4">
        {/* Title with pending count */}
        <div className="flex items-center gap-3">
          <h1 className={cn(
            'font-bold text-foreground',
            compact ? 'text-lg' : 'text-xl'
          )}>
            Approval Gates
          </h1>
          {pendingCount > 0 && (
            <Badge
              variant="warning"
              className="px-2 py-0.5 text-xs font-medium"
            >
              {pendingCount} pending
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          {showConnectionIndicator && (
            <WebSocketConnectionIndicator
              status={connectionStatus}
              className={compact ? 'scale-90' : ''}
            />
          )}

          {/* Refresh button */}
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'md'}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3"
          >
            <RefreshCw className={cn(
              'w-4 h-4',
              isRefreshing && 'animate-spin'
            )} />
            {!compact && <span className="ml-2">Refresh</span>}
          </Button>

          {/* Filter toggle */}
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'md'}
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'px-3',
              (hasActiveFilters || showFilters) && 'bg-background-secondary'
            )}
          >
            <Filter className="w-4 h-4" />
            {!compact && <span className="ml-2">Filters</span>}
            {hasActiveFilters && (
              <Badge variant="primary" className="ml-2 px-1 py-0 text-xs">
                {[
                  filterState.searchQuery && 'search',
                  filterState.status !== 'all' && 'status',
                  filterState.taskId && 'task',
                  filterState.gateType && 'type',
                  filterState.resourceImpact && 'impact',
                ].filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Search bar - always visible in compact mode for quick access */}
      {(compact || showFilters) && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
          <Input
            placeholder="Search gates, tasks, or descriptions..."
            value={filterState.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-4"
          />
        </div>
      )}

      {/* Advanced filters */}
      {showFilters && (
        <div className="bg-background-secondary rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Filters & Sort</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs px-2 py-1 h-auto"
              >
                <X className="w-3 h-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground-secondary">
                Status
              </label>
              <Select
                value={filterState.status}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="timeout">Timed out</option>
                <option value="skipped">Skipped</option>
              </Select>
            </div>

            {/* Gate type filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground-secondary">
                Gate Type
              </label>
              <Select
                value={filterState.gateType || 'all'}
                onValueChange={(value) => handleFilterChange('gateType', value)}
              >
                <option value="all">All types</option>
                {Object.values(GATE_TYPE_CONFIG).map(config => (
                  <option key={config.type} value={config.type}>
                    {config.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Resource impact filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground-secondary">
                Resource Impact
              </label>
              <Select
                value={filterState.resourceImpact || 'all'}
                onValueChange={(value) => handleFilterChange('resourceImpact', value)}
              >
                <option value="all">All impacts</option>
                {Object.values(RESOURCE_IMPACT_CONFIG).map(config => (
                  <option key={config.level} value={config.level}>
                    {config.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Task ID filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground-secondary">
                Task ID
              </label>
              <Input
                placeholder="Enter task ID..."
                value={filterState.taskId || ''}
                onChange={(e) => handleFilterChange('taskId', e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Sort options */}
          <div className="border-t border-border pt-4">
            <label className="text-xs font-medium text-foreground-secondary mb-2 block">
              Sort by
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { field: 'requiredAt' as const, label: 'Date' },
                { field: 'priority' as const, label: 'Priority' },
                { field: 'taskId' as const, label: 'Task' },
                { field: 'name' as const, label: 'Name' },
              ].map(({ field, label }) => (
                <Button
                  key={field}
                  variant={sortState.field === field ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => handleSortChange(field)}
                  className="text-xs px-3 py-1 h-auto"
                >
                  {label}
                  {sortState.field === field && (
                    sortState.direction === 'desc' ? (
                      <SortDesc className="w-3 h-3 ml-1" />
                    ) : (
                      <SortAsc className="w-3 h-3 ml-1" />
                    )
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}