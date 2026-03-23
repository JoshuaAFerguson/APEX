'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import type { LogLevel, LogFilter } from '@/types/log-viewer'
import type { LogSource } from '@/types/agent-log-stream'
import { VALID_LOG_LEVELS, VALID_LOG_SOURCES } from '@/types/agent-log-stream'
import { PANEL_TRANSITIONS } from './constants'
import {
  Search,
  Filter,
  X,
  ChevronDown,
} from 'lucide-react'

/**
 * Props for AgentTerminalPanelControls component
 */
export interface AgentTerminalPanelControlsProps {
  /** Current filter state */
  filter: LogFilter

  /** Whether to show the controls */
  show?: boolean

  /** Whether to show search input */
  showSearch?: boolean

  /** Whether to show level filters */
  showLevelFilter?: boolean

  /** Whether to show source filters */
  showSourceFilter?: boolean

  /** Whether to show stage filter */
  showStageFilter?: boolean

  /** Whether to show agent filter */
  showAgentFilter?: boolean

  /** Whether the filter panel is expanded */
  expanded?: boolean

  /** Available stages for filtering */
  availableStages?: string[]

  /** Available agents for filtering */
  availableAgents?: string[]

  /** Callback when filter changes */
  onFilterChange: (filter: Partial<LogFilter>) => void

  /** Callback when filter is reset */
  onResetFilter?: () => void

  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void

  /** Additional CSS class */
  className?: string
}

/**
 * Level filter button component
 */
const LevelFilterButton: React.FC<{
  level: LogLevel
  isActive: boolean
  onClick: () => void
}> = ({ level, isActive, onClick }) => {
  const levelColors = {
    debug: 'text-gray-400 border-gray-600 bg-gray-900/50',
    info: 'text-blue-400 border-blue-600 bg-blue-900/50',
    warn: 'text-yellow-400 border-yellow-600 bg-yellow-900/50',
    error: 'text-red-400 border-red-600 bg-red-900/50',
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-medium border rounded transition-all duration-200',
        isActive
          ? levelColors[level]
          : 'text-gray-500 border-gray-700 bg-gray-900/30 hover:bg-gray-800/50'
      )}
      title={`${isActive ? 'Hide' : 'Show'} ${level} logs`}
    >
      {level.toUpperCase()}
    </button>
  )
}

/**
 * Source filter button component
 */
const SourceFilterButton: React.FC<{
  source: LogSource
  isActive: boolean
  onClick: () => void
}> = ({ source, isActive, onClick }) => {
  const sourceColors = {
    agent: 'text-apex-400 border-apex-600 bg-apex-900/50',
    system: 'text-gray-400 border-gray-600 bg-gray-900/50',
    user: 'text-green-400 border-green-600 bg-green-900/50',
    tool: 'text-purple-400 border-purple-600 bg-purple-900/50',
    error: 'text-red-400 border-red-600 bg-red-900/50',
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-medium border rounded transition-all duration-200',
        isActive
          ? sourceColors[source]
          : 'text-gray-500 border-gray-700 bg-gray-900/30 hover:bg-gray-800/50'
      )}
      title={`${isActive ? 'Hide' : 'Show'} ${source} logs`}
    >
      {source.toUpperCase()}
    </button>
  )
}

/**
 * Select dropdown component
 */
const FilterSelect: React.FC<{
  value: string | null
  options: string[]
  placeholder: string
  onChange: (value: string | null) => void
  label: string
}> = ({ value, options, placeholder, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between w-full px-3 py-1.5',
          'text-sm bg-gray-900/50 border border-gray-700 rounded',
          'hover:bg-gray-800/50 transition-colors duration-200',
          'min-w-[120px]'
        )}
      >
        <span className={cn(value ? 'text-white' : 'text-gray-500')}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4',
            PANEL_TRANSITIONS.transform,
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown menu */}
          <div
            className={cn(
              'absolute top-full mt-1 w-full z-20',
              'bg-gray-900 border border-gray-700 rounded shadow-lg',
              'max-h-40 overflow-y-auto'
            )}
          >
            <button
              onClick={() => {
                onChange(null)
                setIsOpen(false)
              }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm',
                'hover:bg-gray-800 transition-colors duration-200',
                'text-gray-500'
              )}
            >
              All
            </button>
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm',
                  'hover:bg-gray-800 transition-colors duration-200',
                  'text-white'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * AgentTerminalPanelControls - Filter and search controls for AgentTerminalPanel
 *
 * Provides search input, log level filters, source filters, and other
 * filtering options for the agent terminal logs. Can be collapsed/expanded
 * to save space when not needed.
 *
 * @example
 * ```tsx
 * <AgentTerminalPanelControls
 *   filter={currentFilter}
 *   showSearch
 *   showLevelFilter
 *   showSourceFilter
 *   availableStages={['planning', 'execution', 'review']}
 *   availableAgents={['agent-1', 'agent-2']}
 *   onFilterChange={(changes) => updateFilter(changes)}
 *   onResetFilter={() => resetToDefaults()}
 * />
 * ```
 */
export const AgentTerminalPanelControls: React.FC<AgentTerminalPanelControlsProps> = ({
  filter,
  show = true,
  showSearch = true,
  showLevelFilter = true,
  showSourceFilter = false,
  showStageFilter = true,
  showAgentFilter = true,
  expanded: controlledExpanded,
  availableStages = [],
  availableAgents = [],
  onFilterChange,
  onResetFilter,
  onExpandedChange,
  className,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = controlledExpanded ?? internalExpanded

  // Check if any filters are active
  const hasActiveFilters =
    filter.searchText !== '' ||
    filter.levels.size !== VALID_LOG_LEVELS.length ||
    filter.stage !== null ||
    filter.agent !== null

  if (!show) {
    return null
  }

  const toggleExpanded = () => {
    const newExpanded = !expanded
    setInternalExpanded(newExpanded)
    onExpandedChange?.(newExpanded)
  }

  const handleSearchChange = (searchText: string) => {
    onFilterChange({ searchText })
  }

  const handleLevelToggle = (level: LogLevel) => {
    const newLevels = new Set(filter.levels)
    if (newLevels.has(level)) {
      newLevels.delete(level)
    } else {
      newLevels.add(level)
    }
    onFilterChange({ levels: newLevels })
  }

  const clearSearch = () => {
    onFilterChange({ searchText: '' })
  }

  return (
    <div className={cn('border-b border-gray-800', className)}>
      {/* Main search bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Search input */}
        {showSearch && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={filter.searchText}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={cn(
                'w-full pl-10 pr-10 py-2 text-sm',
                'bg-gray-900/50 border border-gray-700 rounded',
                'focus:border-apex-500 focus:outline-none',
                'placeholder-gray-500 text-white'
              )}
            />
            {filter.searchText && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Filter toggle button */}
        <button
          onClick={toggleExpanded}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm font-medium',
            'bg-gray-900/50 border border-gray-700 rounded',
            'hover:bg-gray-800/50 transition-colors duration-200',
            hasActiveFilters && 'text-apex-400 border-apex-600 bg-apex-900/30'
          )}
          title={expanded ? 'Hide filters' : 'Show filters'}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-apex-500 rounded-full" />
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4',
              PANEL_TRANSITIONS.transform,
              expanded && 'rotate-180'
            )}
          />
        </button>

        {/* Reset button */}
        {hasActiveFilters && onResetFilter && (
          <button
            onClick={onResetFilter}
            className={cn(
              'px-3 py-2 text-sm font-medium text-red-400',
              'border border-red-600 bg-red-900/30 rounded',
              'hover:bg-red-900/50 transition-colors duration-200'
            )}
            title="Reset all filters"
          >
            Reset
          </button>
        )}
      </div>

      {/* Expanded filter controls */}
      {expanded && (
        <div className="px-4 pb-3 space-y-3 border-t border-gray-800/50">
          {/* Level filters */}
          {showLevelFilter && (
            <div>
              <label className="block text-xs text-gray-400 mb-2">Log Levels</label>
              <div className="flex items-center gap-2 flex-wrap">
                {VALID_LOG_LEVELS.map((level) => (
                  <LevelFilterButton
                    key={level}
                    level={level}
                    isActive={filter.levels.has(level)}
                    onClick={() => handleLevelToggle(level)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Source filters */}
          {showSourceFilter && (
            <div>
              <label className="block text-xs text-gray-400 mb-2">Log Sources</label>
              <div className="flex items-center gap-2 flex-wrap">
                {VALID_LOG_SOURCES.map((source) => (
                  <SourceFilterButton
                    key={source}
                    source={source}
                    isActive={true} // TODO: Implement source filtering in LogFilter type
                    onClick={() => {
                      // TODO: Implement source filtering
                      console.log('Source filter not implemented yet:', source)
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Stage and Agent filters */}
          <div className="flex items-start gap-4">
            {/* Stage filter */}
            {showStageFilter && availableStages.length > 0 && (
              <FilterSelect
                value={filter.stage}
                options={availableStages}
                placeholder="All stages"
                onChange={(stage) => onFilterChange({ stage })}
                label="Stage"
              />
            )}

            {/* Agent filter */}
            {showAgentFilter && availableAgents.length > 0 && (
              <FilterSelect
                value={filter.agent}
                options={availableAgents}
                placeholder="All agents"
                onChange={(agent) => onFilterChange({ agent })}
                label="Agent"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

AgentTerminalPanelControls.displayName = 'AgentTerminalPanelControls'

export default AgentTerminalPanelControls