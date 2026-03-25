/**
 * WebSocket Connection Types
 *
 * Type definitions for the WebSocketConnectionIndicator component and related
 * connection status visualization components.
 *
 * @packageDocumentation
 */

/**
 * WebSocket connection states matching existing infrastructure
 */
export type WebSocketConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'error';

/**
 * Connection health details for display
 */
export interface WebSocketConnectionHealth {
  status: WebSocketConnectionStatus;
  isHealthy: boolean;
  latencyMs: number | null;
  averageLatencyMs: number | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  consecutiveFailures: number;
  lastHealthyAt: Date | null;
  lastCheckAt: Date | null;
  connectionUptime: number | null; // milliseconds since connected
}

/**
 * Props for WebSocketConnectionIndicator
 */
export interface WebSocketConnectionIndicatorProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show latency when connected */
  showLatency?: boolean;
  /** Show reconnection attempts when reconnecting */
  showReconnectAttempts?: boolean;
  /** Enable tooltip with detailed health info */
  showTooltip?: boolean;
  /** Enable pulse animation for status changes */
  animated?: boolean;
  /** Custom className */
  className?: string;
  /** Override health data (for testing/storybook) */
  healthOverride?: Partial<WebSocketConnectionHealth>;
}

/**
 * Props for WebSocketConnectionTooltip
 */
export interface WebSocketConnectionTooltipProps {
  /** Health data to display */
  health: WebSocketConnectionHealth;
  /** Custom className */
  className?: string;
  /** Children to wrap with tooltip */
  children: React.ReactNode;
}

/**
 * Status-related style mappings for connection states
 */
export const CONNECTION_STATUS_STYLES = {
  connected: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    border: 'border-green-900',
    icon: 'text-green-500',
    dot: 'bg-green-500',
    glow: 'shadow-green-500/20',
  },
  disconnected: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/20',
  },
  connecting: {
    bg: 'bg-apex-950/50',
    text: 'text-apex-400',
    border: 'border-apex-900',
    icon: 'text-apex-500',
    dot: 'bg-apex-500',
    glow: 'shadow-apex-500/20',
  },
  reconnecting: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-900',
    icon: 'text-yellow-500',
    dot: 'bg-yellow-500',
    glow: 'shadow-yellow-500/20',
  },
  error: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/20',
  },
} as const;

/**
 * Status labels for display
 */
export const CONNECTION_STATUS_LABELS: Record<WebSocketConnectionStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  reconnecting: 'Reconnecting',
  error: 'Connection Error',
};

/**
 * Format latency for display
 */
export function formatLatency(latencyMs: number | null): string {
  if (latencyMs === null) return 'N/A';
  if (latencyMs < 1000) {
    return `${Math.round(latencyMs)}ms`;
  }
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

/**
 * Format uptime for display
 */
export function formatUptime(uptimeMs: number | null): string {
  if (uptimeMs === null) return 'N/A';

  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Get connection status from WebSocket client state
 */
export function getConnectionStatus(
  isConnected: boolean,
  isReconnecting: boolean,
  isHealthy: boolean,
  consecutiveFailures: number
): WebSocketConnectionStatus {
  if (!isConnected) {
    if (isReconnecting) {
      return 'reconnecting';
    }
    return consecutiveFailures > 0 ? 'error' : 'disconnected';
  }

  if (isReconnecting) {
    return 'connecting';
  }

  return isHealthy ? 'connected' : 'error';
}