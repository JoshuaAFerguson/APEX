export { ParallelAgentView } from './ParallelAgentView'
export { ParallelAgentTerminalView } from './ParallelAgentTerminalView'
export { ConnectedParallelAgentTerminalView } from './ConnectedParallelAgentTerminalView'
export { ParallelAgentGrid } from './ParallelAgentGrid'
export { AgentLane } from './AgentLane'
export { AgentExecutionCard } from './AgentExecutionCard'
export { AgentTerminalPanel } from './AgentTerminalPanel'
export { AgentTerminalPanelHeader } from './AgentTerminalPanelHeader'
export { AgentTerminalPanelControls } from './AgentTerminalPanelControls'
export { AgentTerminalPanelLogEntry } from './AgentTerminalPanelLogEntry'
export { AgentStatusIndicator } from './AgentStatusIndicator'

// Animation constants
export {
  PANEL_HEIGHTS,
  PANEL_WIDTHS,
  PANEL_TRANSITIONS,
  PANEL_PERFORMANCE,
  PANEL_CONTENT_CLASSES,
  ANIMATION_DURATIONS,
} from './constants'

export type { ParallelAgentViewProps } from '@/types/parallel-agent-view'
export type {
  ParallelAgentTerminalViewProps,
  ParallelAgentTerminalViewRef,
  AgentTerminalPanelConfig,
  GridGap,
  PanelDisplayMode
} from './ParallelAgentTerminalView.types'
export type {
  ConnectedParallelAgentTerminalViewProps,
  ConnectedParallelAgentTerminalViewRef,
  ConnectedAgentConfig
} from './ConnectedParallelAgentTerminalView.types'
export type { ParallelAgentGridProps, ParallelAgentGridPanelConfig } from './ParallelAgentGrid'
export type { AgentLaneProps } from './AgentLane'
export type { AgentExecutionCardProps } from './AgentExecutionCard'
export type { AgentTerminalPanelProps } from '@/types/agent-log-stream'
export type { AgentTerminalPanelHeaderProps } from './AgentTerminalPanelHeader'
export type { AgentTerminalPanelControlsProps } from './AgentTerminalPanelControls'
export type { AgentTerminalPanelLogEntryProps } from './AgentTerminalPanelLogEntry'
export type { AgentStatusIndicatorProps } from '@/types/agent-status-indicator'

// Animation constants types
export type {
  PanelHeightState,
  PanelWidthState,
  PanelTransitionType,
  PanelPerformanceHint,
} from './constants'
