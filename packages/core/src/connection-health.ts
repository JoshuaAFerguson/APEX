import EventEmitter from 'eventemitter3';

/**
 * Health check method types
 */
export type HealthCheckMethod = 'ping' | 'heartbeat' | 'custom' | 'pooled';

/**
 * Health check result status
 */
export type HealthCheckStatus = 'healthy' | 'unhealthy' | 'unknown' | 'checking';

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  /** Unique identifier for this health check */
  id: string;
  /** Connection identifier being checked */
  connectionId: string;
  /** Health check method used */
  method: HealthCheckMethod;
  /** Check result status */
  status: HealthCheckStatus;
  /** Whether the check was successful */
  success: boolean;
  /** Response latency in milliseconds (if successful) */
  latencyMs?: number;
  /** Error that occurred during health check (if failed) */
  error?: Error | string;
  /** Number of consecutive failures leading up to this check */
  consecutiveFailures: number;
  /** Whether the connection is considered healthy */
  isHealthy: boolean;
  /** Timestamp when the check was started */
  startedAt: Date;
  /** Timestamp when the check was completed */
  completedAt: Date;
  /** Additional metadata for the health check */
  metadata?: Record<string, any>;
}

/**
 * Health state tracking for a connection
 */
export interface ConnectionHealthState {
  /** Connection identifier */
  connectionId: string;
  /** Last successful health check timestamp */
  lastHealthyAt?: Date;
  /** Last health check timestamp (regardless of result) */
  lastCheckAt?: Date;
  /** Consecutive health check failures */
  consecutiveFailures: number;
  /** Whether connection is currently healthy */
  isHealthy: boolean;
  /** Average response latency in ms (rolling window) */
  averageLatencyMs: number;
  /** Response latencies for rolling average (configurable size) */
  latencyHistory: number[];
  /** Health check method currently in use */
  method: HealthCheckMethod;
  /** Health check timer reference */
  healthCheckTimer?: NodeJS.Timeout;
  /** Last successful ping timestamp (when using ping/pong) */
  lastPingAt?: Date;
  /** Last pong received timestamp (when using ping/pong) */
  lastPongAt?: Date;
  /** Pending ping ID (for ping/pong tracking) */
  pendingPingId?: string;
  /** Ping timeout timer reference */
  pingTimeoutTimer?: NodeJS.Timeout;
  /** Custom health check context */
  customContext?: Record<string, any>;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Enable/disable health checks */
  enabled: boolean;
  /** Health check method to use */
  method: HealthCheckMethod;
  /** Interval between health checks in milliseconds */
  intervalMs: number;
  /** Timeout for health check response in milliseconds */
  timeoutMs: number;
  /** Number of consecutive failures before marking unhealthy */
  failureThreshold: number;
  /** Size of latency history rolling window */
  latencyHistorySize: number;
  /** Whether to trigger reconnection on health failure */
  triggerReconnectOnFailure: boolean;
  /** Custom health check function (for 'custom' method) */
  customHealthCheck?: (connectionId: string) => Promise<{ success: boolean; latencyMs?: number; error?: string; metadata?: Record<string, any> }>;
  /** Additional configuration options */
  options?: Record<string, any>;
}

/**
 * Default health check configuration
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: true,
  method: 'ping',
  intervalMs: 30000, // 30 seconds
  timeoutMs: 5000,   // 5 seconds
  failureThreshold: 3,
  latencyHistorySize: 10,
  triggerReconnectOnFailure: true,
};

/**
 * Health check events
 */
export interface HealthCheckEvents {
  /** Emitted when a health check is performed */
  'health:check': (result: HealthCheckResult) => void;
  /** Emitted when a connection becomes healthy */
  'health:healthy': (connectionId: string, state: ConnectionHealthState, result: HealthCheckResult) => void;
  /** Emitted when a connection becomes unhealthy */
  'health:unhealthy': (connectionId: string, state: ConnectionHealthState, result: HealthCheckResult) => void;
  /** Emitted when a connection recovers from unhealthy state */
  'health:recovered': (connectionId: string, state: ConnectionHealthState, result: HealthCheckResult) => void;
  /** Emitted when health check fails and reconnection should be triggered */
  'health:reconnect-required': (connectionId: string, state: ConnectionHealthState, result: HealthCheckResult) => void;
  /** Emitted when a ping is sent (for ping/pong method) */
  'ping:sent': (connectionId: string, pingId: string, timestamp: number) => void;
  /** Emitted when a pong is received (for ping/pong method) */
  'pong:received': (connectionId: string, pingId: string, latencyMs: number) => void;
  /** Emitted when a ping times out (for ping/pong method) */
  'ping:timeout': (connectionId: string, pingId: string) => void;
}

/**
 * Health check statistics
 */
export interface HealthCheckStats {
  /** Total number of health checks performed */
  totalChecks: number;
  /** Total number of successful checks */
  successfulChecks: number;
  /** Total number of failed checks */
  failedChecks: number;
  /** Average latency across all successful checks */
  averageLatencyMs: number;
  /** Minimum latency recorded */
  minLatencyMs: number;
  /** Maximum latency recorded */
  maxLatencyMs: number;
  /** Uptime percentage (successful / total) */
  uptimePercentage: number;
  /** Time since last successful check */
  timeSinceLastSuccessMs?: number;
  /** Time since last check */
  timeSinceLastCheckMs?: number;
}

/**
 * Connection health manager
 *
 * Provides unified health checking across different connection types (WebSocket, MCP, etc.)
 * with configurable health check methods, automatic reconnection triggers, and comprehensive
 * event emission for monitoring and metrics collection.
 */
export class ConnectionHealthManager extends EventEmitter<HealthCheckEvents> {
  private connections = new Map<string, ConnectionHealthState>();
  private configs = new Map<string, HealthCheckConfig>();
  private stats = new Map<string, HealthCheckStats>();
  private globalConfig: HealthCheckConfig;

  constructor(globalConfig: Partial<HealthCheckConfig> = {}) {
    super();
    this.globalConfig = { ...DEFAULT_HEALTH_CHECK_CONFIG, ...globalConfig };
  }

  /**
   * Register a connection for health monitoring
   *
   * @param connectionId - Unique identifier for the connection
   * @param config - Health check configuration for this connection
   */
  register(connectionId: string, config?: Partial<HealthCheckConfig>): void {
    const effectiveConfig = { ...this.globalConfig, ...config };

    // Initialize health state
    const healthState: ConnectionHealthState = {
      connectionId,
      consecutiveFailures: 0,
      isHealthy: true,
      averageLatencyMs: 0,
      latencyHistory: [],
      method: effectiveConfig.method,
    };

    // Initialize stats
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

    // Start health monitoring if enabled
    if (effectiveConfig.enabled) {
      this.startHealthMonitoring(connectionId);
    }
  }

  /**
   * Unregister a connection from health monitoring
   *
   * @param connectionId - Connection identifier to unregister
   */
  unregister(connectionId: string): void {
    const state = this.connections.get(connectionId);
    if (state) {
      this.stopHealthMonitoring(connectionId);
      this.connections.delete(connectionId);
      this.configs.delete(connectionId);
      this.stats.delete(connectionId);
    }
  }

  /**
   * Perform a manual health check on a connection
   *
   * @param connectionId - Connection identifier
   * @returns Promise resolving to health check result
   */
  async performHealthCheck(connectionId: string): Promise<HealthCheckResult> {
    const state = this.connections.get(connectionId);
    const config = this.configs.get(connectionId);

    if (!state || !config) {
      throw new Error(`Connection '${connectionId}' not registered for health monitoring`);
    }

    const checkId = crypto?.randomUUID?.() || `health-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date();

    try {
      let result: HealthCheckResult;

      switch (config.method) {
        case 'ping':
          result = await this.performPingHealthCheck(connectionId, checkId, startedAt, config, state);
          break;
        case 'heartbeat':
          result = await this.performHeartbeatHealthCheck(connectionId, checkId, startedAt, config, state);
          break;
        case 'custom':
          result = await this.performCustomHealthCheck(connectionId, checkId, startedAt, config, state);
          break;
        case 'pooled':
          result = await this.performPooledHealthCheck(connectionId, checkId, startedAt, config, state);
          break;
        default:
          throw new Error(`Unsupported health check method: ${config.method}`);
      }

      // Update state based on result
      this.updateHealthState(connectionId, result);

      // Update statistics
      this.updateHealthStats(connectionId, result);

      // Emit health check event
      this.emit('health:check', result);

      return result;

    } catch (error) {
      const result: HealthCheckResult = {
        id: checkId,
        connectionId,
        method: config.method,
        status: 'unhealthy',
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        consecutiveFailures: state.consecutiveFailures + 1,
        isHealthy: false,
        startedAt,
        completedAt: new Date(),
      };

      // Update state and stats for error case
      this.updateHealthState(connectionId, result);
      this.updateHealthStats(connectionId, result);

      // Emit events
      this.emit('health:check', result);

      return result;
    }
  }

  /**
   * Get current health state for a connection
   *
   * @param connectionId - Connection identifier
   * @returns Health state or undefined if not found
   */
  getHealthState(connectionId: string): ConnectionHealthState | undefined {
    const state = this.connections.get(connectionId);
    return state ? { ...state } : undefined;
  }

  /**
   * Get health statistics for a connection
   *
   * @param connectionId - Connection identifier
   * @returns Health statistics or undefined if not found
   */
  getHealthStats(connectionId: string): HealthCheckStats | undefined {
    const stats = this.stats.get(connectionId);
    if (!stats) return undefined;

    // Update time-based metrics
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

  /**
   * Update health check configuration for a connection
   *
   * @param connectionId - Connection identifier
   * @param config - Updated configuration
   */
  updateConfig(connectionId: string, config: Partial<HealthCheckConfig>): void {
    const existingConfig = this.configs.get(connectionId);
    if (!existingConfig) {
      throw new Error(`Connection '${connectionId}' not registered`);
    }

    const newConfig = { ...existingConfig, ...config };
    this.configs.set(connectionId, newConfig);

    // Restart monitoring if enabled status changed
    if (existingConfig.enabled !== newConfig.enabled) {
      if (newConfig.enabled) {
        this.startHealthMonitoring(connectionId);
      } else {
        this.stopHealthMonitoring(connectionId);
      }
    } else if (newConfig.enabled && existingConfig.intervalMs !== newConfig.intervalMs) {
      // Restart with new interval
      this.stopHealthMonitoring(connectionId);
      this.startHealthMonitoring(connectionId);
    }
  }

  /**
   * Notify about external ping being sent (for integration with existing ping/pong systems)
   *
   * @param connectionId - Connection identifier
   * @param pingId - Unique ping identifier
   * @param timestamp - Ping timestamp
   */
  notifyPingSent(connectionId: string, pingId: string, timestamp: number): void {
    const state = this.connections.get(connectionId);
    if (state) {
      state.pendingPingId = pingId;
      state.lastPingAt = new Date(timestamp);
      this.emit('ping:sent', connectionId, pingId, timestamp);
    }
  }

  /**
   * Notify about external pong being received (for integration with existing ping/pong systems)
   *
   * @param connectionId - Connection identifier
   * @param pingId - Ping identifier that was responded to
   * @param latencyMs - Round-trip latency
   */
  notifyPongReceived(connectionId: string, pingId: string, latencyMs: number): void {
    const state = this.connections.get(connectionId);
    if (state && state.pendingPingId === pingId) {
      state.lastPongAt = new Date();
      state.pendingPingId = undefined;

      // Clear any pending timeout
      if (state.pingTimeoutTimer) {
        clearTimeout(state.pingTimeoutTimer);
        state.pingTimeoutTimer = undefined;
      }

      // Update latency metrics
      this.updateLatencyMetrics(connectionId, latencyMs);

      // Create successful health check result
      const result: HealthCheckResult = {
        id: crypto?.randomUUID?.() || `health-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        connectionId,
        method: 'ping',
        status: 'healthy',
        success: true,
        latencyMs,
        consecutiveFailures: 0,
        isHealthy: true,
        startedAt: state.lastPingAt || new Date(),
        completedAt: new Date(),
      };

      this.updateHealthState(connectionId, result);
      this.updateHealthStats(connectionId, result);

      this.emit('pong:received', connectionId, pingId, latencyMs);
      this.emit('health:check', result);
    }
  }

  /**
   * Notify about ping timeout (for integration with existing ping/pong systems)
   *
   * @param connectionId - Connection identifier
   * @param pingId - Ping identifier that timed out
   */
  notifyPingTimeout(connectionId: string, pingId: string): void {
    const state = this.connections.get(connectionId);
    if (state && state.pendingPingId === pingId) {
      state.pendingPingId = undefined;

      // Create failed health check result
      const result: HealthCheckResult = {
        id: crypto?.randomUUID?.() || `health-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        connectionId,
        method: 'ping',
        status: 'unhealthy',
        success: false,
        error: 'Ping timeout',
        consecutiveFailures: state.consecutiveFailures + 1,
        isHealthy: false,
        startedAt: state.lastPingAt || new Date(),
        completedAt: new Date(),
      };

      this.updateHealthState(connectionId, result);
      this.updateHealthStats(connectionId, result);

      this.emit('ping:timeout', connectionId, pingId);
      this.emit('health:check', result);
    }
  }

  /**
   * Get list of all registered connection IDs
   *
   * @returns Array of connection identifiers
   */
  getRegisteredConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Cleanup all resources and stop monitoring
   */
  destroy(): void {
    // Stop all health monitoring
    for (const connectionId of this.connections.keys()) {
      this.stopHealthMonitoring(connectionId);
    }

    // Clear all data
    this.connections.clear();
    this.configs.clear();
    this.stats.clear();

    // Remove all listeners
    this.removeAllListeners();
  }

  // Private methods

  private async performPingHealthCheck(
    connectionId: string,
    checkId: string,
    startedAt: Date,
    config: HealthCheckConfig,
    state: ConnectionHealthState
  ): Promise<HealthCheckResult> {
    // For ping health checks, we rely on external ping/pong notification
    // This method is for cases where we need to trigger a ping manually
    const pingId = crypto.randomUUID();
    const timestamp = Date.now();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutTimer = setTimeout(() => {
        const result: HealthCheckResult = {
          id: checkId,
          connectionId,
          method: 'ping',
          status: 'unhealthy',
          success: false,
          error: 'Ping timeout',
          consecutiveFailures: state.consecutiveFailures + 1,
          isHealthy: false,
          startedAt,
          completedAt: new Date(),
          metadata: { pingId, timeout: true },
        };
        resolve(result);
      }, config.timeoutMs);

      // Store ping info
      state.pendingPingId = pingId;
      state.lastPingAt = startedAt;
      state.pingTimeoutTimer = timeoutTimer;

      // Emit ping sent event - external system should handle sending actual ping
      this.emit('ping:sent', connectionId, pingId, timestamp);
    });
  }

  private async performHeartbeatHealthCheck(
    connectionId: string,
    checkId: string,
    startedAt: Date,
    config: HealthCheckConfig,
    state: ConnectionHealthState
  ): Promise<HealthCheckResult> {
    // For heartbeat, check if we've received a recent heartbeat
    const now = Date.now();
    const heartbeatThreshold = config.intervalMs * 2; // Allow up to 2x interval

    let isHealthy = false;
    let latencyMs: number | undefined;

    if (state.lastPongAt) {
      const timeSinceLastHeartbeat = now - state.lastPongAt.getTime();
      isHealthy = timeSinceLastHeartbeat <= heartbeatThreshold;

      if (state.lastPingAt && state.lastPongAt > state.lastPingAt) {
        latencyMs = state.lastPongAt.getTime() - state.lastPingAt.getTime();
      }
    }

    return {
      id: checkId,
      connectionId,
      method: 'heartbeat',
      status: isHealthy ? 'healthy' : 'unhealthy',
      success: isHealthy,
      latencyMs,
      error: isHealthy ? undefined : 'Heartbeat timeout',
      consecutiveFailures: isHealthy ? 0 : state.consecutiveFailures + 1,
      isHealthy,
      startedAt,
      completedAt: new Date(),
      metadata: {
        timeSinceLastHeartbeat: state.lastPongAt ? now - state.lastPongAt.getTime() : undefined,
        heartbeatThreshold,
      },
    };
  }

  private async performCustomHealthCheck(
    connectionId: string,
    checkId: string,
    startedAt: Date,
    config: HealthCheckConfig,
    state: ConnectionHealthState
  ): Promise<HealthCheckResult> {
    if (!config.customHealthCheck) {
      throw new Error(`Custom health check function not provided for connection '${connectionId}'`);
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Custom health check timeout')), config.timeoutMs);
      });

      // Execute custom health check with timeout
      const checkResult = await Promise.race([
        config.customHealthCheck(connectionId),
        timeoutPromise,
      ]);

      return {
        id: checkId,
        connectionId,
        method: 'custom',
        status: checkResult.success ? 'healthy' : 'unhealthy',
        success: checkResult.success,
        latencyMs: checkResult.latencyMs,
        error: checkResult.error,
        consecutiveFailures: checkResult.success ? 0 : state.consecutiveFailures + 1,
        isHealthy: checkResult.success,
        startedAt,
        completedAt: new Date(),
        metadata: checkResult.metadata,
      };
    } catch (error) {
      return {
        id: checkId,
        connectionId,
        method: 'custom',
        status: 'unhealthy',
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        consecutiveFailures: state.consecutiveFailures + 1,
        isHealthy: false,
        startedAt,
        completedAt: new Date(),
      };
    }
  }

  private async performPooledHealthCheck(
    connectionId: string,
    checkId: string,
    startedAt: Date,
    config: HealthCheckConfig,
    state: ConnectionHealthState
  ): Promise<HealthCheckResult> {
    // For pooled connections, this would check the overall pool health
    // Implementation would depend on specific pool management system
    // For now, return a basic implementation that checks connection state

    const isHealthy = state.isHealthy && (state.lastHealthyAt ?
      Date.now() - state.lastHealthyAt.getTime() < config.intervalMs * 2 : false);

    return {
      id: checkId,
      connectionId,
      method: 'pooled',
      status: isHealthy ? 'healthy' : 'unhealthy',
      success: isHealthy,
      error: isHealthy ? undefined : 'Pool connection unhealthy',
      consecutiveFailures: isHealthy ? 0 : state.consecutiveFailures + 1,
      isHealthy,
      startedAt,
      completedAt: new Date(),
      metadata: {
        poolStatus: 'active', // This would be determined by actual pool manager
      },
    };
  }

  private updateHealthState(connectionId: string, result: HealthCheckResult): void {
    const state = this.connections.get(connectionId);
    const config = this.configs.get(connectionId);

    if (!state || !config) return;

    const wasHealthy = state.isHealthy;

    // Update basic state
    state.lastCheckAt = result.completedAt;
    state.consecutiveFailures = result.consecutiveFailures;
    state.isHealthy = result.isHealthy;

    // Update health status
    if (result.success) {
      state.lastHealthyAt = result.completedAt;

      // Update latency if provided
      if (result.latencyMs !== undefined) {
        this.updateLatencyMetrics(connectionId, result.latencyMs);
      }
    }

    // Emit appropriate events
    if (!wasHealthy && result.isHealthy) {
      this.emit('health:recovered', connectionId, state, result);
    } else if (wasHealthy && !result.isHealthy) {
      this.emit('health:unhealthy', connectionId, state, result);
    } else if (result.isHealthy) {
      this.emit('health:healthy', connectionId, state, result);
    }

    // Check if reconnection should be triggered
    if (!result.isHealthy &&
        config.triggerReconnectOnFailure &&
        state.consecutiveFailures >= config.failureThreshold) {
      this.emit('health:reconnect-required', connectionId, state, result);
    }
  }

  private updateLatencyMetrics(connectionId: string, latencyMs: number): void {
    const state = this.connections.get(connectionId);
    const config = this.configs.get(connectionId);

    if (!state || !config) return;

    // Update latency history
    state.latencyHistory.push(latencyMs);
    if (state.latencyHistory.length > config.latencyHistorySize) {
      state.latencyHistory.shift();
    }

    // Calculate rolling average
    state.averageLatencyMs = state.latencyHistory.reduce((sum, lat) => sum + lat, 0) / state.latencyHistory.length;
  }

  private updateHealthStats(connectionId: string, result: HealthCheckResult): void {
    const stats = this.stats.get(connectionId);
    if (!stats) return;

    stats.totalChecks++;

    if (result.success) {
      stats.successfulChecks++;

      if (result.latencyMs !== undefined) {
        // Update latency stats
        const allLatencies = [...(this.connections.get(connectionId)?.latencyHistory || [])];
        if (allLatencies.length > 0) {
          stats.averageLatencyMs = allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length;
          stats.minLatencyMs = Math.min(stats.minLatencyMs, ...allLatencies);
          stats.maxLatencyMs = Math.max(stats.maxLatencyMs, ...allLatencies);
        }
      }
    } else {
      stats.failedChecks++;
    }

    // Update uptime percentage
    stats.uptimePercentage = (stats.successfulChecks / stats.totalChecks) * 100;
  }

  private startHealthMonitoring(connectionId: string): void {
    const state = this.connections.get(connectionId);
    const config = this.configs.get(connectionId);

    if (!state || !config || !config.enabled) return;

    // Clear any existing timer
    this.stopHealthMonitoring(connectionId);

    // Start periodic health checks
    state.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck(connectionId);
      } catch (error) {
        console.error(`Error in health check for ${connectionId}:`, error);
      }
    }, config.intervalMs);
  }

  private stopHealthMonitoring(connectionId: string): void {
    const state = this.connections.get(connectionId);
    if (!state) return;

    // Clear health check timer
    if (state.healthCheckTimer) {
      clearInterval(state.healthCheckTimer);
      state.healthCheckTimer = undefined;
    }

    // Clear ping timeout timer
    if (state.pingTimeoutTimer) {
      clearTimeout(state.pingTimeoutTimer);
      state.pingTimeoutTimer = undefined;
    }

    // Clear pending ping
    state.pendingPingId = undefined;
  }
}

/**
 * Global instance for convenient access
 */
export const globalHealthManager = new ConnectionHealthManager();