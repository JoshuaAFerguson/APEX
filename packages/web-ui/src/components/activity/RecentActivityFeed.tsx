/**
 * RecentActivityFeed Component
 *
 * Displays a scrollable, filterable list of recent activity events with:
 * - Event type icons and severity-based styling
 * - Category filtering with tabs
 * - Auto-scrolling behavior
 * - Limit to 20 events for performance
 * - Empty state handling
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ActivityEventItem } from './ActivityEventItem'
import { ActivityCategoryIcon } from './ActivityCategoryIcon'
import { WebSocketConnectionIndicator } from '../connection/WebSocketConnectionIndicator'
import { Card, CardHeader, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { cn } from '../../lib/utils'
import { Activity, ChevronDown, List, Wifi, WifiOff, RefreshCw, Trash2 } from 'lucide-react'
import { useRealtimeUpdates } from '../../lib/useRealtimeUpdates'
import { useWebSocketConnection } from '../../hooks/useWebSocketConnection'
import type {
  RecentActivityFeedProps,
  FilterTab,
} from '../../types/activity-feed'
import type { ActivityEventCategory, DashboardActivityEvent } from '../../types/dashboard'

/**
 * Filter tab configurations following ActiveTasksPanel pattern
 */
const FILTER_TABS: FilterTab[] = [
  { type: 'all', label: 'All', icon: List },
  { type: 'task', label: 'Tasks', icon: ({ className, size }) => <ActivityCategoryIcon category="task" className={className} size={size} /> },
  { type: 'agent', label: 'Agents', icon: ({ className, size }) => <ActivityCategoryIcon category="agent" className={className} size={size} /> },
  { type: 'tool', label: 'Tools', icon: ({ className, size }) => <ActivityCategoryIcon category="tool" className={className} size={size} /> },
  { type: 'gate', label: 'Gates', icon: ({ className, size }) => <ActivityCategoryIcon category="gate" className={className} size={size} /> },
  { type: 'permission', label: 'Permissions', icon: ({ className, size }) => <ActivityCategoryIcon category="permission" className={className} size={size} /> },
  { type: 'error', label: 'Errors', icon: ({ className, size }) => <ActivityCategoryIcon category="error" className={className} size={size} /> },
] as const

/**
 * RecentActivityFeed component displays recent activity events in a scrollable list
 * with real-time WebSocket updates when useRealTimeUpdates is enabled
 */
export function RecentActivityFeed({
  events: propEvents = [],
  maxEvents = 20,
  maxHeight = 400,
  showFilters = true,
  autoScroll = true,
  compact = false,
  onEventClick,
  onMarkRead,
  loading = false,
  className,
  title = 'Recent Activity',
  useRealTimeUpdates = false,
  showConnectionIndicator = true,
  autoConnect = true,
  initialFilters
}: RecentActivityFeedProps) {
  const [selectedFilter, setSelectedFilter] = useState<ActivityEventCategory | 'all'>('all')
  const [isAutoScrolling, setIsAutoScrolling] = useState(autoScroll)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use real-time updates if enabled
  const realtimeHook = useRealtimeUpdates({
    autoConnect: useRealTimeUpdates ? autoConnect : false,
  })

  const connectionHook = useWebSocketConnection()

  // Choose event source (wrapped in useMemo to prevent unnecessary recalculations)
  const allEvents = useMemo(
    () => useRealTimeUpdates ? (realtimeHook.state.events || []) : (propEvents || []),
    [useRealTimeUpdates, realtimeHook.state.events, propEvents]
  )

  // Filter and limit events
  const filteredEvents = useMemo(() => {
    let filtered = allEvents || []

    // Apply category filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(event => event.category === selectedFilter)
    }

    // Sort by timestamp (most recent first)
    filtered = filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Apply initial filters if provided
    if (initialFilters) {
      if (initialFilters.severities?.length) {
        filtered = filtered.filter(event =>
          initialFilters.severities!.includes(event.severity)
        )
      }
      if (initialFilters.unreadOnly) {
        filtered = filtered.filter(event => !event.isRead)
      }
      if (initialFilters.taskIds?.length) {
        filtered = filtered.filter(event =>
          initialFilters.taskIds!.includes(event.taskId)
        )
      }
    }

    // Limit to maxEvents
    return filtered.slice(0, maxEvents)
  }, [allEvents, selectedFilter, maxEvents, initialFilters])

  // Calculate stats for filter tabs
  const stats = useMemo(() => {
    const sourceEvents = allEvents || []
    const total = sourceEvents.length
    const counts: Record<ActivityEventCategory | 'all', number> = {
      all: total,
      task: 0,
      agent: 0,
      tool: 0,
      gate: 0,
      permission: 0,
      system: 0,
      error: 0,
    }

    sourceEvents.forEach(event => {
      counts[event.category] = (counts[event.category] || 0) + 1
    })

    return counts
  }, [allEvents])

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (isAutoScrolling && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [filteredEvents, isAutoScrolling])

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10
    setIsAutoScrolling(isAtBottom)
  }

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setIsAutoScrolling(true)
    }
  }

  // Handle event interactions
  const handleEventClick = (event: DashboardActivityEvent) => {
    if (onEventClick) {
      onEventClick(event)
    }
  }

  const handleMarkRead = (eventId: string) => {
    if (useRealTimeUpdates) {
      realtimeHook.markEventRead(eventId)
    }
    if (onMarkRead) {
      onMarkRead(eventId)
    }
  }

  const handleClearEvents = () => {
    if (useRealTimeUpdates) {
      realtimeHook.clearEvents()
    }
  }

  const handleRetryConnection = () => {
    if (useRealTimeUpdates) {
      realtimeHook.connect()
    }
  }

  // Determine loading state
  const isLoading = loading || (useRealTimeUpdates && realtimeHook.state.connectionState === 'connecting')

  // Determine if showing connection status
  const showConnectionStatus = useRealTimeUpdates && showConnectionIndicator

  return (
    <Card className={cn('w-full', compact && 'text-sm', className)}>
      <CardHeader className={cn('pb-3', compact && 'p-3 pb-2')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-apex-500" />
            <h3 className={cn('font-semibold text-foreground', compact ? 'text-base' : 'text-lg')}>
              {title}
            </h3>
            {filteredEvents.length > 0 && (
              <Badge variant="default" className="text-xs">
                {filteredEvents.length}
                {filteredEvents.length === maxEvents && '+'}
              </Badge>
            )}
          </div>

          {/* Connection status and controls */}
          <div className="flex items-center gap-2">
            {showConnectionStatus && (
              <div className="flex items-center gap-1 text-xs">
                {realtimeHook.state.connectionState === 'connected' && (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" data-testid="icon-wifi" />
                    <span className="text-green-600">Live updates active</span>
                  </>
                )}
                {realtimeHook.state.connectionState === 'connecting' && (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" data-testid="icon-refresh" />
                    <span className="text-amber-600">Connecting...</span>
                  </>
                )}
                {realtimeHook.state.connectionState === 'disconnected' && (
                  <>
                    <WifiOff className="w-4 h-4 text-red-500" data-testid="icon-wifi-off" />
                    <span className="text-red-600">Disconnected</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRetryConnection}
                      className="ml-2 text-xs"
                    >
                      Retry connection
                    </Button>
                  </>
                )}
                {realtimeHook.state.connectionState === 'error' && (
                  <>
                    <WifiOff className="w-4 h-4 text-red-500" data-testid="icon-wifi-off" />
                    <div className="text-red-600">
                      <div>Connection Error</div>
                      {realtimeHook.state.error && (
                        <div className="text-xs">{realtimeHook.state.error.message}</div>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRetryConnection}
                      className="ml-2 text-xs"
                    >
                      Retry
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Clear all button */}
            {useRealTimeUpdates && filteredEvents.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearEvents}
                className="text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        {showFilters && (
          <div className="flex flex-wrap gap-1 mt-3">
            {FILTER_TABS.map(({ type, label, icon: Icon }) => {
              const count = stats[type] || 0
              return (
                <button
                  key={type}
                  onClick={() => setSelectedFilter(type)}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    'hover:bg-background-tertiary/50',
                    selectedFilter === type
                      ? 'bg-apex-500/20 text-apex-400 border border-apex-500/30'
                      : 'text-foreground-secondary hover:text-foreground',
                    compact && 'px-2 py-1 text-xs'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" size={14} />
                  {label}
                  {count > 0 && (
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-xs',
                      selectedFilter === type
                        ? 'bg-apex-500/30 text-apex-300'
                        : 'bg-background-tertiary text-foreground-secondary'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className={cn('pt-0', compact && 'p-3 pt-0')}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
            <span className="ml-2 text-foreground-secondary">
              {useRealTimeUpdates ? 'Connecting...' : 'Loading activity...'}
            </span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-foreground-secondary">
            <Activity className="w-8 h-8 mb-2 opacity-50" data-testid="icon-activity" />
            <p className="text-sm">
              {selectedFilter === 'all'
                ? (useRealTimeUpdates ? 'No recent activity' : 'No activity found')
                : `No ${selectedFilter} activity`
              }
            </p>
            <p className="text-xs mt-1">
              {useRealTimeUpdates
                ? 'Activity events will appear here as tasks are executed.'
                : 'Activity events will appear here as they occur.'
              }
            </p>
            {selectedFilter !== 'all' && (
              <button
                onClick={() => setSelectedFilter('all')}
                className="text-xs text-apex-500 hover:text-apex-400 mt-2"
              >
                View all events
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* Scrollable event list */}
            <div
              ref={containerRef}
              onScroll={handleScroll}
              style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
              className="overflow-y-auto space-y-2 pr-1"
              role="log"
              aria-live="polite"
              aria-label="Activity events"
              data-auto-scroll={autoScroll.toString()}
              data-auto-scroll-paused={(!isAutoScrolling).toString()}
            >
              {filteredEvents.map((event) => (
                <ActivityEventItem
                  key={event.id}
                  event={event}
                  compact={compact}
                  onClick={() => handleEventClick(event)}
                  onMarkRead={() => handleMarkRead(event.id)}
                  showReadIndicator={true}
                />
              ))}
            </div>

            {/* Scroll to bottom button */}
            {!isAutoScrolling && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-4 right-4 flex items-center gap-1 px-3 py-1.5 text-xs bg-apex-600 text-white rounded-full shadow-lg hover:bg-apex-700 transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
                New events
              </button>
            )}

            {/* Show message if there are more events */}
            {filteredEvents.length === maxEvents && (
              <div className="text-center text-xs text-foreground-secondary py-2 border-t border-border mt-2">
                Showing {maxEvents} most recent events
                {selectedFilter !== 'all' && ` (${selectedFilter})`}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}