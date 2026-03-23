'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import type { AgentStatus } from '@/types/agent-metrics'
import type { AgentIndicatorStatus } from '@/types/agent-status-indicator'
import type { StreamingState } from '@/types/agent-log-stream'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'
import { AgentStatusIndicator } from './AgentStatusIndicator'
import { WebSocketConnectionIndicator } from '../connection/WebSocketConnectionIndicator'
import { STREAMING_STATE_STYLES } from '@/types/agent-log-stream'
import {
  Minimize2,
  Maximize2,
  X,
  Pause,
  Play,
  RotateCcw,
  Download
} from 'lucide-react'

/**
 * Props for AgentTerminalPanelHeader component
 */
export interface AgentTerminalPanelHeaderProps {
  /** Panel title/agent name */
  title: string

  /** Agent ID */
  agentId: string

  /** Current agent operational status */
  agentStatus?: AgentStatus

  /** Current streaming state */
  streamingState: StreamingState

  /** Current panel display state (three-state architecture) */
  panelState?: PanelDisplayState

  /** @deprecated Use panelState instead - Whether the panel is minimized */
  isMinimized?: boolean

  /** Whether the panel can be minimized */
  allowMinimize?: boolean

  /** Whether the panel can be maximized */
  allowMaximize?: boolean

  /** Whether the panel can be closed */
  allowClose?: boolean

  /** Whether streaming can be paused/resumed */
  allowPauseResume?: boolean

  /** Whether logs can be cleared */
  allowClear?: boolean

  /** Whether logs can be exported */
  allowExport?: boolean

  /** Show connection status indicator */
  showConnection?: boolean

  /** Custom actions to render in the header */
  customActions?: React.ReactNode

  /** Callback when panel is minimized */
  onMinimize?: () => void

  /** Callback when panel is maximized */
  onMaximize?: () => void

  /** Callback when panel is restored to normal state */
  onRestore?: () => void

  /** Callback when panel is closed */
  onClose?: () => void

  /** Callback when streaming is paused */
  onPause?: () => void

  /** Callback when streaming is resumed */
  onResume?: () => void

  /** Callback when logs are cleared */
  onClear?: () => void

  /** Callback when logs are exported */
  onExport?: () => void

  /** Additional CSS class */
  className?: string
}

/**
 * Map AgentStatus to AgentIndicatorStatus
 */
function mapAgentStatusToIndicatorStatus(status?: AgentStatus): AgentIndicatorStatus {
  switch (status) {
    case 'processing':
      return 'active'
    case 'error':
      return 'error'
    case 'idle':
    case 'offline':
    default:
      return 'idle'
  }
}

/**
 * Action button component
 */
const ActionButton: React.FC<{
  onClick?: () => void
  icon: React.ReactNode
  tooltip: string
  variant?: 'default' | 'danger'
  disabled?: boolean
}> = ({ onClick, icon, tooltip, variant = 'default', disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={tooltip}
    className={cn(
      'p-1.5 rounded-md transition-colors duration-200',
      'hover:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-apex-500/50',
      variant === 'danger' && 'hover:bg-red-900/50 text-red-400',
      disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
      'disabled:hover:bg-transparent'
    )}
  >
    {icon}
  </button>
)

/**
 * Streaming state indicator component
 */
const StreamingStateIndicator: React.FC<{ state: StreamingState }> = ({ state }) => {
  const styles = STREAMING_STATE_STYLES[state]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border',
        styles.bg,
        styles.text,
        'border-current/20'
      )}
      title={`Streaming: ${styles.label}`}
    >
      <span aria-hidden="true">{styles.icon}</span>
      {styles.label}
    </div>
  )
}

/**
 * AgentTerminalPanelHeader - Header component for AgentTerminalPanel
 *
 * Displays agent information, connection status, streaming state, and
 * provides controls for panel management (minimize, maximize, close)
 * and streaming controls (pause, resume, clear, export).
 *
 * @example
 * ```tsx
 * <AgentTerminalPanelHeader
 *   title="Agent-1 Terminal"
 *   agentId="agent-1"
 *   agentStatus="processing"
 *   streamingState="streaming"
 *   allowMinimize
 *   allowClose
 *   allowPauseResume
 *   onMinimize={() => setMinimized(true)}
 *   onClose={() => closePanel()}
 *   onPause={() => pauseStreaming()}
 *   onResume={() => resumeStreaming()}
 * />
 * ```
 */
export const AgentTerminalPanelHeader: React.FC<AgentTerminalPanelHeaderProps> = ({
  title,
  agentId,
  agentStatus,
  streamingState,
  panelState,
  isMinimized: legacyIsMinimized = false,
  allowMinimize = true,
  allowMaximize = true,
  allowClose = true,
  allowPauseResume = true,
  allowClear = true,
  allowExport = true,
  showConnection = true,
  customActions,
  onMinimize,
  onMaximize,
  onRestore,
  onClose,
  onPause,
  onResume,
  onClear,
  onExport,
  className,
}) => {
  // Determine effective panel state (controlled vs uncontrolled/legacy)
  const effectivePanelState = panelState || (legacyIsMinimized ? 'minimized' : 'normal')
  const indicatorStatus = mapAgentStatusToIndicatorStatus(agentStatus)
  const isPaused = streamingState === 'paused'
  const isStreaming = streamingState === 'streaming'
  const canPause = allowPauseResume && isStreaming && onPause
  const canResume = allowPauseResume && isPaused && onResume

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3',
        'bg-gray-950/80 border-b border-gray-800',
        'backdrop-blur-sm',
        className
      )}
    >
      {/* Left side - Agent info and status */}
      <div className="flex items-center gap-3">
        {/* Agent status indicator */}
        <AgentStatusIndicator
          status={indicatorStatus}
          size="sm"
          showLabel={false}
          animated={indicatorStatus === 'active'}
        />

        {/* Panel title */}
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white truncate">
            {title}
          </h3>
          <span className="text-xs text-gray-500 font-mono">
            ({agentId})
          </span>
        </div>

        {/* Streaming state indicator */}
        <StreamingStateIndicator state={streamingState} />

        {/* Connection indicator */}
        {showConnection && (
          <WebSocketConnectionIndicator
            size="sm"
            showTooltip={false}
          />
        )}
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-1">
        {/* Custom actions */}
        {customActions}

        {/* Streaming controls - hidden when minimized */}
        {effectivePanelState !== 'minimized' && (
          <div className="flex items-center gap-1 border-r border-gray-700 pr-2 mr-2">
          {/* Pause/Resume */}
          {canPause && (
            <ActionButton
              onClick={onPause}
              icon={<Pause className="w-4 h-4" />}
              tooltip="Pause streaming"
            />
          )}
          {canResume && (
            <ActionButton
              onClick={onResume}
              icon={<Play className="w-4 h-4" />}
              tooltip="Resume streaming"
            />
          )}

          {/* Clear logs */}
          {allowClear && onClear && (
            <ActionButton
              onClick={onClear}
              icon={<RotateCcw className="w-4 h-4" />}
              tooltip="Clear logs"
              variant="danger"
            />
          )}

          {/* Export logs */}
          {allowExport && onExport && (
            <ActionButton
              onClick={onExport}
              icon={<Download className="w-4 h-4" />}
              tooltip="Export logs"
            />
          )}
          </div>
        )}

        {/* Panel controls */}
        <div className="flex items-center gap-1">
          {/* Three-state panel controls */}
          {/* Minimized state: Show restore/expand button only */}
          {effectivePanelState === 'minimized' && allowMaximize && onRestore && (
            <ActionButton
              onClick={onRestore}
              icon={<Maximize2 className="w-4 h-4" />}
              tooltip="Restore panel"
            />
          )}

          {/* Normal state: Show minimize and maximize buttons */}
          {effectivePanelState === 'normal' && (
            <>
              {allowMinimize && onMinimize && (
                <ActionButton
                  onClick={onMinimize}
                  icon={<Minimize2 className="w-4 h-4" />}
                  tooltip="Minimize panel"
                />
              )}
              {allowMaximize && onMaximize && (
                <ActionButton
                  onClick={onMaximize}
                  icon={<Maximize2 className="w-4 h-4" />}
                  tooltip="Maximize panel"
                />
              )}
            </>
          )}

          {/* Maximized state: Show restore button only */}
          {effectivePanelState === 'maximized' && onRestore && (
            <ActionButton
              onClick={onRestore}
              icon={<Minimize2 className="w-4 h-4" />}
              tooltip="Restore panel"
            />
          )}

          {/* Close */}
          {allowClose && onClose && (
            <ActionButton
              onClick={onClose}
              icon={<X className="w-4 h-4" />}
              tooltip="Close panel"
              variant="danger"
            />
          )}
        </div>
      </div>
    </div>
  )
}

AgentTerminalPanelHeader.displayName = 'AgentTerminalPanelHeader'

export default AgentTerminalPanelHeader