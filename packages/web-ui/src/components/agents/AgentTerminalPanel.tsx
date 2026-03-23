'use client'

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { AgentTerminalPanelProps } from '@/types/agent-log-stream'
import type { AgentLogEntry } from '@/types/agent-log-stream'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'
import { useAgentLogStream } from '@/hooks/useAgentLogStream'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { AgentTerminalPanelHeader } from './AgentTerminalPanelHeader'
import { AgentTerminalPanelControls } from './AgentTerminalPanelControls'
import { AgentTerminalPanelLogEntry } from './AgentTerminalPanelLogEntry'
import {
  PANEL_HEIGHTS,
  PANEL_WIDTHS,
  PANEL_TRANSITIONS,
  PANEL_PERFORMANCE,
  PANEL_CONTENT_CLASSES,
} from './constants'
import { ChevronDown } from 'lucide-react'

/**
 * AgentTerminalPanel - Terminal-like interface for viewing agent logs
 *
 * Provides real-time streaming of agent logs with filtering, search,
 * auto-scroll behavior, and terminal-like appearance. Integrates with
 * the WebSocket log stream and provides controls for managing the display.
 *
 * Features:
 * - Real-time log streaming via WebSocket
 * - Auto-scroll with pause/resume when user scrolls
 * - Configurable filtering by level, source, stage, agent
 * - Search functionality
 * - Export capabilities
 * - Panel controls (minimize, maximize, close)
 * - Responsive design with configurable sizing
 *
 * @example
 * ```tsx
 * <AgentTerminalPanel
 *   panelId="agent-1-terminal"
 *   agentId="agent-1"
 *   title="Agent 1 Terminal"
 *   maxHeight="600px"
 *   autoConnect
 *   autoScroll
 *   showFilters
 *   showSearch
 *   onLogSelect={(log) => console.log('Selected log:', log)}
 * />
 * ```
 */
export const AgentTerminalPanel: React.FC<AgentTerminalPanelProps> = ({
  // Required props
  panelId,
  agentId,

  // Display props
  title,
  agentStatus,
  panelState,
  isMinimized: legacyIsMinimized = false, // Backward compatibility
  maxHeight = '400px',
  minHeight = '200px',

  // Streaming props
  autoConnect = true,
  autoScroll: initialAutoScroll = true,
  maxLogs = 1000,

  // Filter props
  showFilters = true,
  showSearch = true,
  initialFilter,
  visibleLevels,

  // UI props
  showTimestamps = true,
  showLevelBadges = true,
  showSourceBadges = false,
  wrapLines = true,
  fontSize = 'sm',
  theme = 'dark',

  // Event callbacks
  onLogSelect,
  onFilterChange,
  onStreamStateChange,
  onError,
  onClear,
  onMinimize,
  onMaximize,
  onRestore,
  onClose,
  onPause,
  onResume,

  // Styling
  className,
}) => {
  // Determine effective panel state (controlled vs uncontrolled pattern)
  const [internalPanelState, setInternalPanelState] = useState<PanelDisplayState>(
    panelState || (legacyIsMinimized ? 'minimized' : 'normal')
  )

  // Use controlled panelState if provided, otherwise use internal state
  const effectivePanelState: PanelDisplayState = panelState || internalPanelState

  // Backward compatibility: sync internal state with legacy isMinimized
  useEffect(() => {
    if (!panelState && legacyIsMinimized !== (internalPanelState === 'minimized')) {
      setInternalPanelState(legacyIsMinimized ? 'minimized' : 'normal')
    }
  }, [panelState, legacyIsMinimized, internalPanelState])

  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

  // Log stream hook
  const {
    filteredLogs,
    filter,
    streamState,
    stats,
    isConnecting,
    isStreaming,
    isPaused,
    error,
    connect,
    disconnect,
    pause,
    resume,
    clearLogs,
    setFilter,
    resetFilter,
    exportLogs,
    scrollToLog,
  } = useAgentLogStream({
    agentId,
    autoConnect,
    maxLogs,
    filter: initialFilter,
    onConnectionChange: (status) => {
      // Convert WebSocketConnectionStatus to StreamingState if needed
      // The streamState.state already tracks the streaming state properly
      // so we mainly just need to call the callback if provided
      onStreamStateChange?.(streamState.state)
    },
    onError,
  })

  // Call onStreamStateChange when streamState.state changes
  const prevStreamingStateRef = useRef(streamState.state)
  useEffect(() => {
    if (prevStreamingStateRef.current !== streamState.state) {
      onStreamStateChange?.(streamState.state)
      prevStreamingStateRef.current = streamState.state
    }
  }, [streamState.state, onStreamStateChange])

  // Auto-scroll hook
  const {
    containerRef,
    handleScroll,
    scrollToBottom,
    autoScroll,
    newItemsSinceScroll,
    notifyNewItems,
  } = useAutoScroll({
    initialAutoScroll,
    onNewContentWhileScrolledUp: (count) => {
      // Could add toast notification here
      console.log(`${count} new logs available`)
    },
  })

  // Track previous log count to detect new logs
  const prevLogCountRef = useRef(filteredLogs.length)

  // Notify auto-scroll when new logs arrive
  useEffect(() => {
    const currentCount = filteredLogs.length
    const prevCount = prevLogCountRef.current

    if (currentCount > prevCount) {
      notifyNewItems(currentCount - prevCount)
    }

    prevLogCountRef.current = currentCount
  }, [filteredLogs.length, notifyNewItems])

  // Extract available values for filter dropdowns
  const { availableStages, availableAgents } = useMemo(() => {
    const stages = new Set<string>()
    const agents = new Set<string>()

    filteredLogs.forEach((log) => {
      if (log.metadata?.stage) {
        stages.add(log.metadata.stage)
      }
      if (log.metadata?.agentName) {
        agents.add(log.metadata.agentName)
      }
    })

    return {
      availableStages: Array.from(stages).sort(),
      availableAgents: Array.from(agents).sort(),
    }
  }, [filteredLogs])

  // Panel control handlers
  const handleMinimize = useCallback(() => {
    if (!panelState) {
      setInternalPanelState('minimized')
    }
    onMinimize?.()
  }, [panelState, onMinimize])

  const handleMaximize = useCallback(() => {
    if (!panelState) {
      setInternalPanelState('maximized')
    }
    onMaximize?.()
  }, [panelState, onMaximize])

  const handleRestore = useCallback(() => {
    if (!panelState) {
      setInternalPanelState('normal')
    }
    onRestore?.()
  }, [panelState, onRestore])

  const handleClose = useCallback(() => {
    disconnect()
    onClose?.()
  }, [disconnect, onClose])

  const handlePause = useCallback(() => {
    pause()
    onPause?.()
  }, [pause, onPause])

  const handleResume = useCallback(() => {
    resume()
    onResume?.()
  }, [resume, onResume])

  const handleClear = () => {
    clearLogs()
    setSelectedLogId(null)
    onClear?.()
  }

  const handleExport = () => {
    try {
      const exported = exportLogs('json')
      const blob = new Blob([exported], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `agent-${agentId}-logs-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export logs:', error)
    }
  }

  const handleFilterChange = (changes: Parameters<typeof setFilter>[0]) => {
    setFilter(changes)
    onFilterChange?.(changes)
  }

  const handleLogSelect = (log: AgentLogEntry) => {
    setSelectedLogId(log.id)
    scrollToLog(log.id)
    onLogSelect?.(log)
  }

  // Panel title with fallback
  const panelTitle = title || agentId || 'Agent Terminal'

  // Dynamic panel height calculation for normal state
  const dynamicPanelHeights = {
    ...PANEL_HEIGHTS,
    normal: maxHeight === 'none' ? PANEL_HEIGHTS.normal : '', // Use h-80 or custom via style
  }

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return // Only handle when focused on container

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (effectivePanelState === 'minimized') {
          handleRestore()
        } else {
          handleMinimize()
        }
        break
      case 'M':
      case 'm':
        event.preventDefault()
        if (effectivePanelState === 'maximized') {
          handleRestore()
        } else {
          handleMaximize()
        }
        break
      case 'Escape':
        event.preventDefault()
        if (effectivePanelState === 'maximized') {
          handleRestore()
        }
        break
      case '-':
      case '_': // Shift + minus
        event.preventDefault()
        // Minus key minimizes the panel
        if (effectivePanelState !== 'minimized') {
          handleMinimize()
        }
        break
      case '+':
      case '=': // Plus key (shift + equals) or equals key
        event.preventDefault()
        // Plus key restores panel from minimized state
        if (effectivePanelState === 'minimized') {
          handleRestore()
        }
        break
    }
  }, [effectivePanelState, handleRestore, handleMinimize, handleMaximize])

  // Render minimized state
  if (effectivePanelState === 'minimized') {
    return (
      <div
        className={cn(
          'border border-gray-800 rounded-lg overflow-hidden',
          dynamicPanelHeights.minimized,
          PANEL_WIDTHS.minimized,
          PANEL_TRANSITIONS.height,
          PANEL_PERFORMANCE.willChange,
          className
        )}
        role="region"
        aria-label={`Agent terminal panel: ${panelTitle}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <AgentTerminalPanelHeader
          title={panelTitle}
          agentId={agentId}
          agentStatus={agentStatus}
          streamingState={streamState.state}
          panelState={effectivePanelState}
          onRestore={handleRestore}
          onClose={handleClose}
        />
      </div>
    )
  }

  // Normal and maximized states
  return (
    <div
      className={cn(
        'flex flex-col border border-gray-800 rounded-lg overflow-hidden',
        'bg-gray-950/90 backdrop-blur-sm',
        theme === 'light' && 'bg-white/90 border-gray-200',
        dynamicPanelHeights[effectivePanelState],
        PANEL_WIDTHS[effectivePanelState],
        PANEL_TRANSITIONS.height,
        PANEL_PERFORMANCE.willChange,
        effectivePanelState === 'maximized' && 'z-10', // Bring maximized panel to front
        className
      )}
      style={{
        minHeight: effectivePanelState === 'maximized' ? undefined : minHeight,
        maxHeight: effectivePanelState === 'maximized' ? undefined :
          (maxHeight === 'none' ? undefined : maxHeight),
      }}
      role="region"
      aria-label={`Agent terminal panel: ${panelTitle}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <AgentTerminalPanelHeader
        title={panelTitle}
        agentId={agentId}
        agentStatus={agentStatus}
        streamingState={streamState.state}
        panelState={effectivePanelState}
        onMinimize={effectivePanelState === 'normal' ? handleMinimize : undefined}
        onMaximize={effectivePanelState === 'normal' ? handleMaximize : undefined}
        onRestore={effectivePanelState !== 'normal' ? handleRestore : undefined}
        onClose={handleClose}
        onPause={handlePause}
        onResume={handleResume}
        onClear={handleClear}
        onExport={handleExport}
      />

      {/* Content section with fade animation */}
      {/* Note: This block only renders for 'normal' and 'maximized' states
          since 'minimized' state has an early return above */}
      <div
        className={cn(
          PANEL_CONTENT_CLASSES.animate,
          'opacity-100 visible'
        )}
        data-expanded={true}
        aria-hidden={false}
      >
        <div className={PANEL_CONTENT_CLASSES.inner}>
          {/* Controls */}
          <AgentTerminalPanelControls
            filter={filter}
            show={showFilters || showSearch}
            showSearch={showSearch}
            showLevelFilter={showFilters}
            showSourceFilter={showSourceBadges}
            availableStages={availableStages}
            availableAgents={availableAgents}
            onFilterChange={handleFilterChange}
            onResetFilter={resetFilter}
          />

          {/* Log viewport */}
          <div className="flex-1 relative overflow-hidden">
        {/* Log container */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className={cn(
            'h-full overflow-y-auto scrollbar-thin',
            'scrollbar-track-gray-900 scrollbar-thumb-gray-700',
            'hover:scrollbar-thumb-gray-600'
          )}
        >
          {/* Empty state */}
          {filteredLogs.length === 0 && !isConnecting && (
            <div className="flex items-center justify-center h-full p-8 text-center">
              <div className="text-gray-500">
                <p className="text-lg font-medium">No logs yet</p>
                <p className="text-sm mt-2">
                  {!isStreaming
                    ? 'Connect to start streaming logs'
                    : 'Logs will appear here as they arrive'}
                </p>
                {!isStreaming && (
                  <button
                    onClick={connect}
                    className="mt-4 px-4 py-2 bg-apex-600 text-white rounded hover:bg-apex-700"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Connecting state */}
          {isConnecting && filteredLogs.length === 0 && (
            <div className="flex items-center justify-center h-full p-8 text-center">
              <div className="text-gray-500">
                <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-apex-500 rounded-full mx-auto mb-4" />
                <p className="text-lg font-medium">Connecting to log stream...</p>
              </div>
            </div>
          )}

          {/* Log entries */}
          {filteredLogs.map((log) => (
            <AgentTerminalPanelLogEntry
              key={log.id}
              log={log}
              showTimestamps={showTimestamps}
              showLevelBadges={showLevelBadges}
              showSourceBadges={showSourceBadges}
              wrapLines={wrapLines}
              fontSize={fontSize}
              isSelected={selectedLogId === log.id}
              onClick={onLogSelect ? handleLogSelect : undefined}
            />
          ))}

          {/* Error state */}
          {error && (
            <div className="p-4 m-4 bg-red-950/50 border border-red-900 rounded">
              <p className="text-red-400 font-medium">Stream Error</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
              <button
                onClick={connect}
                className="mt-3 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Reconnect
              </button>
            </div>
          )}
        </div>

        {/* Auto-scroll button */}
        {!autoScroll && newItemsSinceScroll > 0 && (
          <button
            onClick={scrollToBottom}
            className={cn(
              'absolute bottom-4 right-4 z-10',
              'flex items-center gap-2 px-3 py-2',
              'bg-apex-600 text-white rounded-lg shadow-lg',
              'hover:bg-apex-700 transition-colors duration-200',
              'text-sm font-medium'
            )}
          >
            <span>{newItemsSinceScroll} new log{newItemsSinceScroll !== 1 ? 's' : ''}</span>
            <ChevronDown className={cn('w-4 h-4', PANEL_TRANSITIONS.transform)} />
          </button>
        )}

            {/* Connection status overlay */}
            {streamState.state === 'disconnected' && (
              <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <p className="text-lg font-medium">Disconnected</p>
                  <p className="text-sm mt-1">Lost connection to log stream</p>
                  <button
                    onClick={connect}
                    className="mt-3 px-4 py-2 bg-apex-600 text-white rounded hover:bg-apex-700"
                  >
                    Reconnect
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-t border-gray-800 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                Showing {filteredLogs.length} of {stats.totalLogs} logs
              </span>
              {stats.errorCount > 0 && (
                <span className="text-red-400">
                  {stats.errorCount} error{stats.errorCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {isStreaming && stats.logsPerSecond > 0 && (
                <span>{stats.logsPerSecond.toFixed(1)} logs/sec</span>
              )}
              {autoScroll && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Auto-scrolling
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

AgentTerminalPanel.displayName = 'AgentTerminalPanel'

export default AgentTerminalPanel