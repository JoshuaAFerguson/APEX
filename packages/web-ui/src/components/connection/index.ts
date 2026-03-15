export { WebSocketConnectionIndicator } from './WebSocketConnectionIndicator'
export type { WebSocketConnectionIndicatorProps } from '@/types/websocket-connection'

export { WebSocketConnectionTooltip } from './WebSocketConnectionTooltip'
export type { WebSocketConnectionTooltipProps } from '@/types/websocket-connection'

// Re-export types for convenience
export type {
  WebSocketConnectionStatus,
  WebSocketConnectionHealth
} from '@/types/websocket-connection'

// Re-export hook for convenience
export { useWebSocketConnection } from '@/hooks/useWebSocketConnection'