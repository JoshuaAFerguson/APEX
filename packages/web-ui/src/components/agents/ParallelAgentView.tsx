import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import {
  LayoutGrid,
  List,
  Clock,
  Minimize,
  RotateCcw,
  Settings,
  Filter,
  SortAsc,
  SortDesc,
} from 'lucide-react'
import { AgentLane } from './AgentLane'
import type {
  ParallelAgentViewProps,
  ParallelAgentViewData,
  ParallelAgentViewConfig,
  ParallelAgentViewLayout,
  AgentSortCriteria,
  AgentSortDirection,
  AgentLane as AgentLaneType,
  AgentExecution,
} from '@/types/parallel-agent-view'
import {
  DEFAULT_PARALLEL_AGENT_VIEW_CONFIG,
  DEFAULT_PARALLEL_AGENT_VIEW_PROPS,
  calculateParallelExecutionSummary,
} from '@/types/parallel-agent-view'

/**
 * ParallelAgentView component displays parallel agent executions
 * in a kanban-style interface with lanes, cards, and real-time updates.
 *
 * Features:
 * - Multiple layout modes (lanes, grid, timeline, compact)
 * - Real-time status updates with animations
 * - Sorting and filtering capabilities
 * - Collapsible lanes with statistics
 * - Interactive agent cards with actions
 * - Progress tracking and metrics display
 */
export const ParallelAgentView: React.FC<ParallelAgentViewProps> = ({
  data,
  config: configProp,
  onAgentClick,
  onAgentHover,
  onLaneClick,
  onLaneToggle,
  onAgentPause,
  onAgentResume,
  onAgentCancel,
  onAgentRetry,
  loading = DEFAULT_PARALLEL_AGENT_VIEW_PROPS.loading,
  error,
  className,
  emptyMessage = DEFAULT_PARALLEL_AGENT_VIEW_PROPS.emptyMessage,
  testId,
}) => {
  // Merge provided config with defaults
  const config: ParallelAgentViewConfig = useMemo(
    () => ({ ...DEFAULT_PARALLEL_AGENT_VIEW_CONFIG, ...configProp }),
    [configProp]
  )

  // Local state for view controls
  const [localLayout, setLocalLayout] = useState<ParallelAgentViewLayout>(config.layout)
  const [localSortBy, setLocalSortBy] = useState<AgentSortCriteria>(config.sortBy)
  const [localSortDirection, setLocalSortDirection] = useState<AgentSortDirection>(config.sortDirection)

  // Calculate summary statistics
  const summary = useMemo(() => calculateParallelExecutionSummary(data), [data])

  // Filter and limit lanes
  const displayedLanes = useMemo(() => {
    return data.lanes.slice(0, config.maxLanes)
  }, [data.lanes, config.maxLanes])

  const layoutIcons = {
    lanes: List,
    grid: LayoutGrid,
    timeline: Clock,
    compact: Minimize,
  }

  const sortCriteriaOptions: { value: AgentSortCriteria; label: string }[] = [
    { value: 'name', label: 'Name' },
    { value: 'status', label: 'Status' },
    { value: 'progress', label: 'Progress' },
    { value: 'startTime', label: 'Start Time' },
    { value: 'duration', label: 'Duration' },
  ]

  const handleLayoutChange = (layout: ParallelAgentViewLayout) => {
    setLocalLayout(layout)
  }

  const handleSortChange = (criteria: AgentSortCriteria) => {
    if (criteria === localSortBy) {
      // Toggle direction if same criteria
      setLocalSortDirection(localSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setLocalSortBy(criteria)
      setLocalSortDirection('asc')
    }
  }

  const handleRefresh = () => {
    // Trigger refresh through parent component
    // This could be handled by the hook or passed as a prop
    if (onLaneClick) {
      // Use lane click as a refresh mechanism
      onLaneClick(displayedLanes[0])
    }
  }

  // Render loading state
  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-64 bg-background-secondary rounded-lg border border-border-secondary',
          className
        )}
        data-testid={testId}
      >
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <p className="text-foreground-secondary">Loading parallel agents...</p>
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-64 bg-background-secondary rounded-lg border border-border-secondary',
          className
        )}
        data-testid={testId}
      >
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button variant="secondary" onClick={handleRefresh}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // Render empty state
  if (data.lanes.length === 0 || summary.executionCount === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-64 bg-background-secondary rounded-lg border border-border-secondary',
          className
        )}
        data-testid={testId}
      >
        <div className="text-center">
          <p className="text-foreground-secondary mb-4">{emptyMessage}</p>
          <Button variant="secondary" onClick={handleRefresh}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    )
  }

  // Layout-specific rendering
  const renderContent = () => {
    switch (localLayout) {
      case 'lanes':
        return (
          <div className={cn(
            'grid gap-4',
            config.size === 'sm' && 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
            config.size === 'md' && 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
            config.size === 'lg' && 'grid-cols-1 lg:grid-cols-2'
          )}>
            {displayedLanes.map((lane) => (
              <AgentLane
                key={lane.id}
                lane={lane}
                size={config.size}
                sortBy={localSortBy}
                sortDirection={localSortDirection}
                maxAgents={config.maxAgentsPerLane}
                showProgress={config.showProgress}
                showElapsedTime={config.showElapsedTime}
                showTokenUsage={config.showTokenUsage}
                showCost={config.showCost}
                showStages={config.showStages}
                animated={config.animated}
                onLaneClick={onLaneClick}
                onLaneToggle={onLaneToggle}
                onAgentClick={onAgentClick}
                onAgentHover={onAgentHover}
                onAgentPause={onAgentPause}
                onAgentResume={onAgentResume}
                onAgentCancel={onAgentCancel}
                onAgentRetry={onAgentRetry}
                testId={`lane-${lane.id}`}
              />
            ))}
          </div>
        )

      case 'grid':
        // Flatten all executions into a grid
        const allExecutions = displayedLanes.flatMap(lane => lane.executions)
        return (
          <div className={cn(
            'grid gap-3',
            config.size === 'sm' && 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
            config.size === 'md' && 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
            config.size === 'lg' && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          )}>
            {allExecutions.map((execution) => (
              <div key={execution.id} className="flex justify-center">
                {/* Individual agent cards would go here - simplified for now */}
                <div className="w-full max-w-xs p-3 bg-background-tertiary rounded-lg border">
                  <p className="font-medium text-sm">{execution.agentName}</p>
                  <p className="text-xs text-foreground-secondary mt-1">
                    {execution.status} • {execution.progress}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        )

      case 'timeline':
      case 'compact':
        // Simplified layout for now
        return (
          <div className="space-y-2">
            {displayedLanes.map((lane) => (
              <div key={lane.id} className="p-3 bg-background-tertiary rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{lane.label}</h4>
                  <Badge variant="secondary">{lane.executions.length}</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {lane.executions.slice(0, 8).map((execution) => (
                    <div
                      key={execution.id}
                      className="h-2 bg-apex-500 rounded-full"
                      style={{
                        backgroundColor: execution.status === 'completed' ? '#10b981' :
                          execution.status === 'failed' ? '#ef4444' :
                          execution.status === 'running' ? '#3b82f6' : '#6b7280'
                      }}
                      title={`${execution.agentName}: ${execution.status}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div
      className={cn(
        'w-full bg-background-primary border border-border-secondary rounded-lg overflow-hidden',
        className
      )}
      data-testid={testId}
    >
      {/* Header with controls and stats */}
      <div className="flex items-center justify-between p-4 border-b border-border-secondary bg-background-secondary">
        {/* Left side: Stats and summary */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg text-foreground-primary">
              Parallel Agents
            </h3>
            <Badge variant="apex" className="text-xs">
              {summary.executionCount} total
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {summary.activeCount > 0 && (
              <Badge variant="success" className="text-xs">
                {summary.activeCount} active
              </Badge>
            )}
            {summary.statusCounts.completed > 0 && (
              <Badge variant="secondary" className="text-xs">
                {summary.statusCounts.completed} completed
              </Badge>
            )}
            {summary.statusCounts.failed > 0 && (
              <Badge variant="danger" className="text-xs">
                {summary.statusCounts.failed} failed
              </Badge>
            )}
          </div>
        </div>

        {/* Right side: View controls */}
        <div className="flex items-center gap-2">
          {/* Sort controls */}
          <div className="flex items-center gap-1 mr-2">
            {sortCriteriaOptions.map(({ value, label }) => (
              <Button
                key={value}
                variant={localSortBy === value ? "primary" : "ghost"}
                size="sm"
                onClick={() => handleSortChange(value)}
                className="text-xs"
                title={`Sort by ${label}`}
              >
                {label}
                {localSortBy === value && (
                  localSortDirection === 'asc' ?
                    <SortAsc className="w-3 h-3 ml-1" /> :
                    <SortDesc className="w-3 h-3 ml-1" />
                )}
              </Button>
            ))}
          </div>

          {/* Layout toggle */}
          <div className="flex items-center rounded-md border border-border-secondary overflow-hidden">
            {Object.entries(layoutIcons).map(([layout, Icon]) => (
              <Button
                key={layout}
                variant={localLayout === layout ? "primary" : "ghost"}
                size="sm"
                onClick={() => handleLayoutChange(layout as ParallelAgentViewLayout)}
                className="rounded-none border-0"
                title={`${layout} view`}
              >
                <Icon className="w-4 h-4" />
              </Button>
            ))}
          </div>

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            title="Refresh data"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          {/* Settings (placeholder) */}
          <Button
            variant="ghost"
            size="sm"
            title="View settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="p-4">
        {renderContent()}
      </div>

      {/* Footer with additional info */}
      {data.lastUpdated && (
        <div className="px-4 py-2 border-t border-border-secondary bg-background-secondary">
          <p className="text-xs text-foreground-secondary">
            Last updated: {data.lastUpdated.toLocaleTimeString()}
            {summary.averageProgress > 0 && (
              <span className="ml-4">
                Average progress: {Math.round(summary.averageProgress)}%
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}