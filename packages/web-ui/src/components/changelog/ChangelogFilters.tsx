/**
 * ChangelogFilters Component
 *
 * Provides filtering controls for changelog entries including date ranges,
 * workflow selection, status filtering, and search functionality.
 */

'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { FILTER_PRESETS } from './constants'
import type { ChangelogFiltersProps, ChangelogFilters } from '@/types/changelog'

interface DateRangePickerProps {
  startDate?: Date
  endDate?: Date
  onChange: (startDate?: Date, endDate?: Date) => void
  className?: string
}

/**
 * Simple date range picker component
 */
function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
  const handleStartDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const date = event.target.value ? new Date(event.target.value) : undefined
    onChange(date, endDate)
  }

  const handleEndDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const date = event.target.value ? new Date(event.target.value) : undefined
    onChange(startDate, date)
  }

  const formatDateForInput = (date?: Date) => {
    if (!date) return ''
    return date.toISOString().split('T')[0]
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <div className="flex-1">
        <Label htmlFor="start-date" className="text-xs text-foreground-secondary">
          From
        </Label>
        <Input
          id="start-date"
          type="date"
          value={formatDateForInput(startDate)}
          onChange={handleStartDateChange}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex-1">
        <Label htmlFor="end-date" className="text-xs text-foreground-secondary">
          To
        </Label>
        <Input
          id="end-date"
          type="date"
          value={formatDateForInput(endDate)}
          onChange={handleEndDateChange}
          className="h-8 text-sm"
        />
      </div>
    </div>
  )
}

/**
 * Workflow multi-select component
 */
function WorkflowMultiSelect({
  workflows,
  availableWorkflows = [],
  onChange,
}: {
  workflows?: string[]
  availableWorkflows: string[]
  onChange: (workflows: string[]) => void
}) {
  const handleWorkflowToggle = (workflow: string) => {
    const current = workflows || []
    const updated = current.includes(workflow)
      ? current.filter(w => w !== workflow)
      : [...current, workflow]
    onChange(updated)
  }

  const selectedCount = workflows?.length || 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Workflows</Label>
        {selectedCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selectedCount}
          </Badge>
        )}
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {availableWorkflows.map(workflow => (
          <Checkbox
            key={workflow}
            checked={workflows?.includes(workflow) || false}
            onChange={() => handleWorkflowToggle(workflow)}
            label={workflow}
            data-testid={`workflow-${workflow}`}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Status filter checkboxes
 */
function StatusFilter({
  status,
  onChange,
}: {
  status?: ('completed' | 'failed' | 'cancelled')[]
  onChange: (status: ('completed' | 'failed' | 'cancelled')[]) => void
}) {
  const statusOptions: ('completed' | 'failed' | 'cancelled')[] = [
    'completed',
    'failed',
    'cancelled'
  ]

  const handleStatusToggle = (statusValue: 'completed' | 'failed' | 'cancelled') => {
    const current = status || []
    const updated = current.includes(statusValue)
      ? current.filter(s => s !== statusValue)
      : [...current, statusValue]
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Status</Label>
      <div className="space-y-1">
        {statusOptions.map(statusValue => (
          <Checkbox
            key={statusValue}
            checked={status?.includes(statusValue) || false}
            onChange={() => handleStatusToggle(statusValue)}
            label={statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
            data-testid={`status-${statusValue}`}
          />
        ))}
      </div>
    </div>
  )
}

export function ChangelogFilters({
  filters,
  onFiltersChange,
  availableWorkflows = [],
  compact = false,
  className,
}: ChangelogFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(!compact)
  const [customDateRange, setCustomDateRange] = useState(false)

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.startDate || filters.endDate) count++
    if (filters.workflows && filters.workflows.length > 0) count++
    if (filters.status && filters.status.length > 0) count++
    if (filters.search) count++
    return count
  }, [filters])

  // Handle search input
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const search = event.target.value || undefined
    onFiltersChange({ ...filters, search })
  }, [filters, onFiltersChange])

  // Handle date preset selection
  const handleDatePresetChange = useCallback((presetKey: string) => {
    if (presetKey === 'custom') {
      setCustomDateRange(true)
      return
    }

    if (presetKey === 'all') {
      setCustomDateRange(false)
      onFiltersChange({
        ...filters,
        startDate: undefined,
        endDate: undefined
      })
      return
    }

    const preset = FILTER_PRESETS[presetKey as keyof typeof FILTER_PRESETS]
    if (preset) {
      setCustomDateRange(false)
      onFiltersChange({
        ...filters,
        startDate: preset.startDate(),
        endDate: preset.endDate()
      })
    }
  }, [filters, onFiltersChange])

  // Handle custom date range changes
  const handleDateRangeChange = useCallback((startDate?: Date, endDate?: Date) => {
    onFiltersChange({
      ...filters,
      startDate,
      endDate
    })
  }, [filters, onFiltersChange])

  // Handle workflow changes
  const handleWorkflowsChange = useCallback((workflows: string[]) => {
    onFiltersChange({
      ...filters,
      workflows: workflows.length > 0 ? workflows : undefined
    })
  }, [filters, onFiltersChange])

  // Handle status changes
  const handleStatusChange = useCallback((status: ('completed' | 'failed' | 'cancelled')[]) => {
    onFiltersChange({
      ...filters,
      status: status.length > 0 ? status : undefined
    })
  }, [filters, onFiltersChange])

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setCustomDateRange(false)
    onFiltersChange({})
  }, [onFiltersChange])

  // Determine current date preset
  const getCurrentDatePreset = () => {
    if (!filters.startDate && !filters.endDate) return 'all'
    if (customDateRange) return 'custom'

    // Check if matches any preset
    for (const [key, preset] of Object.entries(FILTER_PRESETS)) {
      const presetStart = preset.startDate()
      const presetEnd = preset.endDate()

      if (
        filters.startDate?.toDateString() === presetStart.toDateString() &&
        filters.endDate?.toDateString() === presetEnd.toDateString()
      ) {
        return key
      }
    }

    return 'custom'
  }

  return (
    <Card className={cn('', className)}>
      {/* Filter header with toggle */}
      <CardHeader className={cn('pb-3', compact && 'py-2')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}

            {compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 p-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Filter content */}
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Search */}
          <div>
            <Label htmlFor="search" className="text-sm font-medium">
              Search
            </Label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-2 w-4 h-4 text-foreground-secondary" />
              <Input
                id="search"
                type="text"
                placeholder="Search titles and descriptions..."
                value={filters.search || ''}
                onChange={handleSearchChange}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* Date Range */}
          <div>
            <Label className="text-sm font-medium">Date Range</Label>
            <div className="mt-1 space-y-2">
              <Select
                value={getCurrentDatePreset()}
                onChange={handleDatePresetChange}
                options={[
                  { value: 'all', label: 'All time' },
                  ...Object.entries(FILTER_PRESETS).map(([key, preset]) => ({
                    value: key,
                    label: preset.label
                  })),
                  { value: 'custom', label: 'Custom range' }
                ]}
                className="h-9"
              />

              {customDateRange && (
                <DateRangePicker
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  onChange={handleDateRangeChange}
                />
              )}
            </div>
          </div>

          {/* Workflows */}
          {availableWorkflows.length > 0 && (
            <WorkflowMultiSelect
              workflows={filters.workflows}
              availableWorkflows={availableWorkflows}
              onChange={handleWorkflowsChange}
            />
          )}

          {/* Status */}
          <StatusFilter
            status={filters.status}
            onChange={handleStatusChange}
          />
        </CardContent>
      )}
    </Card>
  )
}