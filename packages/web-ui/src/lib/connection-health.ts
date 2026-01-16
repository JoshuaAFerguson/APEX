/**
 * Browser-compatible connection health manager
 * Simplified version for WebSocket health monitoring in browser environments
 */

/**
 * Health check method types
 */
export type HealthCheckMethod = 'ping' | 'heartbeat' | 'custom';

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  method: HealthCheckMethod;
  intervalMs: number;
  timeoutMs: number;
  failureThreshold: number;
  latencyHistorySize: number;
  triggerReconnectOnFailure: boolean;
  customHealthCheck?: (connectionId: string) => Promise<{
    success: boolean;
    latencyMs?: number;
    error?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Default health check configuration
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: true,
  method: 'ping',
  intervalMs: 30000,
  timeoutMs: 5000,
  failureThreshold: 3,
  latencyHistorySize: 10,
  triggerReconnectOnFailure: true,
};

/**
 * Health state tracking for a connection
 */
export interface ConnectionHealthState {
  connectionId: string;
  lastHealthyAt?: Date;
  lastCheckAt?: Date;
  consecutiveFailures: number;
  isHealthy: boolean;
  averageLatencyMs: number;
  latencyHistory: number[];
  method: HealthCheckMethod;
  lastPingAt?: Date;
  lastPongAt?: Date;
  pendingPingId?: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  id: string;
  connectionId: string;
  method: HealthCheckMethod;
  success: boolean;
  latencyMs?: number;
  error?: Error | string;
  consecutiveFailures: number;
  isHealthy: boolean;
  startedAt: Date;
  completedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Health check statistics
 */
export interface HealthCheckStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  uptimePercentage: number;
  timeSinceLastSuccessMs?: number;
  timeSinceLastCheckMs?: number;
}

type EventHandler<T extends unknown[]> = (...args: T) => void;

/**
 * Connection health manager for browser environments
 */
export class ConnectionHealthManager {
  private connections = new Map<string, ConnectionHealthState>();
  private configs = new Map<string, HealthCheckConfig>();
  private stats = new Map<string, HealthCheckStats>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private pingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private globalConfig: HealthCheckConfig;
  private handlers: Map<string, Set<EventHandler<any>>> = new Map();

  constructor(globalConfig: Partial<HealthCheckConfig> = {}) {
    this.globalConfig = { ...DEFAULT_HEALTH_CHECK_CONFIG, ...globalConfig };
  }

  on<T extends unknown[]>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off<T extends unknown[]>(event: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (e) {
          console.error(`Error in health event handler for ${event}:`, e);
        }
      });
    }
  }

  register(connectionId: string, config?: Partial<HealthCheckConfig>): void {
    const effectiveConfig = { ...this.globalConfig, ...config };

    const healthState: ConnectionHealthState = {
      connectionId,
      consecutiveFailures: 0,
      isHealthy: true,
      averageLatencyMs: 0,
      latencyHistory: [],
      method: effectiveConfig.method,
    };

    const healthStats: HealthCheckStats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageLatencyMs: 0,
      minLatencyMs: Number.MAX_SAFE_INTEGER,
      maxLatencyMs: 0,
      uptimePercentage: 100,
    };

    this.connections.set(connectionId, healthState);
    this.configs.set(connectionId, effectiveConfig);
    this.stats.set(connectionId, healthStats);
  }

  unregister(connectionId: string): void {
    const timer = this.timers.get(connectionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(connectionId);
    }

    const pingTimeout = this.pingTimeouts.get(connectionId);
    if (pingTimeout) {
      clearTimeout(pingTimeout);
      this.pingTimeouts.delete(connectionId);
    }

    this.connections.delete(connectionId);
    this.configs.delete(connectionId);
    this.stats.delete(connectionId);
  }

  getHealthState(connectionId: string): ConnectionHealthState | undefined {
    const state = this.connections.get(connectionId);
    return state ? { ...state } : undefined;
  }

  getHealthStats(connectionId: string): HealthCheckStats | undefined {
    const stats = this.stats.get(connectionId);
    if (!stats) return undefined;

    const state = this.connections.get(connectionId);
    if (state) {
      const now = Date.now();
      if (state.lastHealthyAt) {
        stats.timeSinceLastSuccessMs = now - state.lastHealthyAt.getTime();
      }
      if (state.lastCheckAt) {
        stats.timeSinceLastCheckMs = now - state.lastCheckAt.getTime();
      }
    }

    return { ...stats };
  }

  notifyPingSent(connectionId: string, pingId: string, timestamp: number): void {
    const state = this.connections.get(connectionId);
    if (state) {
      state.pendingPingId = pingId;
      state.lastPingAt = new Date(timestamp);
      this.emit('ping:sent', connectionId, pingId, timestamp);
    }
  }

  notifyPongReceived(connectionId: string, pingId: string, latencyMs: number): void {
    const state = this.connections.get(connectionId);
    const config = this.configs.get(connectionId);

    if (state && state.pendingPingId === pingId) {
      state.lastPongAt = new Date();
      state.pendingPingId = undefined;

      const pingTimeout = this.pingTimeouts.get(connectionId);
      if (pingTimeout) {
        clearTimeout(pingTimeout);
        this.pingTimeouts.delete(connectionId);
      }

      // Update latency metrics
      state.latencyHistory.push(latencyMs);
      if (config && state.latencyHistory.length > config.latencyHistorySize) {
        state.latencyHistory.shift();
      }
      state.averageLatencyMs = state.latencyHistory.reduce((sum, lat) => sum + lat, 0) / state.latencyHistory.length;

      // Update health
      const wasUnhealthy = !state.isHealthy;
      state.isHealthy = true;
      state.consecutiveFailures = 0;
      state.lastHealthyAt = new Date();
      state.lastCheckAt = new Date();

      // Update stats
      const stats = this.stats.get(connectionId);
      if (stats) {
        stats.totalChecks++;
        stats.successfulChecks++;
        stats.averageLatencyMs = state.averageLatencyMs;
        stats.minLatencyMs = Math.min(stats.minLatencyMs, latencyMs);
        stats.maxLatencyMs = Math.max(stats.maxLatencyMs, latencyMs);
        stats.uptimePercentage = (stats.successfulChecks / stats.totalChecks) * 100;
      }

      this.emit('pong:received', connectionId, pingId, latencyMs);

      if (wasUnhealthy) {
        this.emit('health:recovered');
      } else {
        this.emit('health:healthy');
      }

      this.emit('health:check', {
        id: crypto.randomUUID(),
        connectionId,
        method: 'ping',
        success: true,
        latencyMs,
        consecutiveFailures: 0,
        isHealthy: true,
        startedAt: state.lastPingAt || new Date(),
        completedAt: new Date(),
      });
    }
  }

  notifyPingTimeout(connectionId: string, pingId: string): void {
    const state = this.connections.get(connectionId);
    const config = this.configs.get(connectionId);

    if (state && state.pendingPingId === pingId) {
      state.pendingPingId = undefined;
      state.consecutiveFailures++;
      state.lastCheckAt = new Date();

      const wasHealthy = state.isHealthy;

      // Update stats
      const stats = this.stats.get(connectionId);
      if (stats) {
        stats.totalChecks++;
        stats.failedChecks++;
        stats.uptimePercentage = (stats.successfulChecks / stats.totalChecks) * 100;
      }

      this.emit('ping:timeout', connectionId, pingId);

      // Check if should mark unhealthy
      if (config && state.consecutiveFailures >= config.failureThreshold) {
        state.isHealthy = false;

        if (wasHealthy) {
          this.emit('health:unhealthy');
        }

        if (config.triggerReconnectOnFailure) {
          this.emit('health:reconnect-required');
        }
      }

      this.emit('health:check', {
        id: crypto.randomUUID(),
        connectionId,
        method: 'ping',
        success: false,
        error: 'Ping timeout',
        consecutiveFailures: state.consecutiveFailures,
        isHealthy: state.isHealthy,
        startedAt: state.lastPingAt || new Date(),
        completedAt: new Date(),
      });
    }
  }

  destroy(): void {
    for (const connectionId of this.connections.keys()) {
      this.unregister(connectionId);
    }
    this.handlers.clear();
  }
}
