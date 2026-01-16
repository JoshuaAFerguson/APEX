import EventEmitter from 'eventemitter3';
import type {
  ConnectionHealthManager,
  HealthCheckResult,
  HealthCheckStats,
  ConnectionHealthState,
} from './connection-health.js';

/**
 * Time window for metrics aggregation
 */
export type MetricsTimeWindow = '1m' | '5m' | '15m' | '1h' | '24h';

/**
 * Health metrics aggregated over time windows
 */
export interface HealthMetricsSnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: Date;
  /** Time window this snapshot covers */
  timeWindow: MetricsTimeWindow;
  /** Connection ID this snapshot is for */
  connectionId: string;
  /** Total number of health checks in window */
  totalChecks: number;
  /** Number of successful health checks */
  successfulChecks: number;
  /** Number of failed health checks */
  failedChecks: number;
  /** Success rate percentage */
  successRate: number;
  /** Average latency in milliseconds */
  avgLatencyMs: number;
  /** Minimum latency in window */
  minLatencyMs: number;
  /** Maximum latency in window */
  maxLatencyMs: number;
  /** 95th percentile latency */
  p95LatencyMs: number;
  /** 99th percentile latency */
  p99LatencyMs: number;
  /** Number of disconnection events */
  disconnections: number;
  /** Number of reconnection attempts */
  reconnectionAttempts: number;
  /** Maximum consecutive failures in window */
  maxConsecutiveFailures: number;
  /** Total downtime in milliseconds */
  downtimeMs: number;
  /** Uptime percentage for the window */
  uptimePercent: number;
}

/**
 * Aggregated health metrics across all connections
 */
export interface SystemHealthMetrics {
  /** Timestamp when metrics were generated */
  timestamp: Date;
  /** Time window for aggregation */
  timeWindow: MetricsTimeWindow;
  /** Total number of monitored connections */
  totalConnections: number;
  /** Number of healthy connections */
  healthyConnections: number;
  /** Number of unhealthy connections */
  unhealthyConnections: number;
  /** Overall system health percentage */
  systemHealthPercent: number;
  /** Average success rate across all connections */
  avgSuccessRate: number;
  /** Average latency across all connections */
  avgLatencyMs: number;
  /** Total number of health checks across all connections */
  totalHealthChecks: number;
  /** Total reconnection attempts */
  totalReconnectionAttempts: number;
  /** Connections with most failures (top 5) */
  topFailingConnections: Array<{
    connectionId: string;
    failureCount: number;
    failureRate: number;
  }>;
  /** Connections with highest latency (top 5) */
  highLatencyConnections: Array<{
    connectionId: string;
    avgLatencyMs: number;
    maxLatencyMs: number;
  }>;
}

/**
 * Health check event for metrics collection
 */
interface HealthCheckEvent {
  timestamp: Date;
  connectionId: string;
  success: boolean;
  latencyMs?: number;
  error?: string;
  consecutiveFailures: number;
}

/**
 * Connection state change event
 */
interface ConnectionStateEvent {
  timestamp: Date;
  connectionId: string;
  previousState: 'healthy' | 'unhealthy';
  newState: 'healthy' | 'unhealthy';
}

/**
 * Events emitted by health metrics collector
 */
export interface HealthMetricsEvents {
  /** Emitted when metrics snapshot is generated */
  'snapshot': (snapshot: HealthMetricsSnapshot) => void;
  /** Emitted when system metrics are generated */
  'system-metrics': (metrics: SystemHealthMetrics) => void;
  /** Emitted when connection health changes significantly */
  'health-alert': (connectionId: string, alert: HealthAlert) => void;
}

/**
 * Health alert types
 */
export type HealthAlertType =
  | 'high-failure-rate'
  | 'high-latency'
  | 'repeated-disconnections'
  | 'extended-downtime'
  | 'connection-recovered';

/**
 * Health alert information
 */
export interface HealthAlert {
  type: HealthAlertType;
  connectionId: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  threshold?: number;
  actualValue?: number;
}

/**
 * Configuration for health metrics collection
 */
export interface HealthMetricsConfig {
  /** Enable metrics collection */
  enabled: boolean;
  /** How often to generate snapshots (in milliseconds) */
  snapshotIntervalMs: number;
  /** Time windows to track */
  timeWindows: MetricsTimeWindow[];
  /** Maximum number of events to keep in memory per connection */
  maxEventsPerConnection: number;
  /** Enable alert generation */
  alertsEnabled: boolean;
  /** Alert thresholds */
  alertThresholds: {
    highFailureRate: number; // percentage
    highLatency: number; // milliseconds
    extendedDowntime: number; // milliseconds
    repeatedDisconnections: number; // count per hour
  };
}

/**
 * Default configuration for health metrics
 */
export const DEFAULT_HEALTH_METRICS_CONFIG: HealthMetricsConfig = {
  enabled: true,
  snapshotIntervalMs: 60000, // 1 minute
  timeWindows: ['1m', '5m', '15m', '1h'],
  maxEventsPerConnection: 1000,
  alertsEnabled: true,
  alertThresholds: {
    highFailureRate: 50, // 50% failure rate
    highLatency: 1000, // 1 second
    extendedDowntime: 300000, // 5 minutes
    repeatedDisconnections: 5, // 5 disconnections per hour
  },
};

/**
 * Health metrics collector
 *
 * Collects and aggregates health check metrics from connection health managers,
 * provides time-windowed analytics, and generates alerts for unhealthy conditions.
 */
export class HealthMetricsCollector extends EventEmitter<HealthMetricsEvents> {
  private config: HealthMetricsConfig;
  private healthChecks: Map<string, HealthCheckEvent[]> = new Map();
  private stateChanges: Map<string, ConnectionStateEvent[]> = new Map();
  private snapshotTimer?: NodeJS.Timeout;
  private connectionManagers: Set<ConnectionHealthManager> = new Set();

  constructor(config: Partial<HealthMetricsConfig> = {}) {
    super();
    this.config = { ...DEFAULT_HEALTH_METRICS_CONFIG, ...config };

    if (this.config.enabled) {
      this.startMetricsCollection();
    }
  }

  /**
   * Register a connection health manager for metrics collection
   */
  registerHealthManager(manager: ConnectionHealthManager): void {
    this.connectionManagers.add(manager);

    // Listen to health check events
    manager.on('health:check', (result) => {
      this.recordHealthCheck(result);
    });

    manager.on('health:healthy', (connectionId) => {
      this.recordStateChange(connectionId, 'unhealthy', 'healthy');
    });

    manager.on('health:unhealthy', (connectionId) => {
      this.recordStateChange(connectionId, 'healthy', 'unhealthy');
    });

    manager.on('health:recovered', (connectionId) => {
      this.recordStateChange(connectionId, 'unhealthy', 'healthy');
    });
  }

  /**
   * Unregister a connection health manager
   */
  unregisterHealthManager(manager: ConnectionHealthManager): void {
    this.connectionManagers.delete(manager);
    // Note: We don't remove event listeners as they should be cleaned up when manager is destroyed
  }

  /**
   * Generate metrics snapshot for a specific connection and time window
   */
  generateSnapshot(connectionId: string, timeWindow: MetricsTimeWindow): HealthMetricsSnapshot {
    const now = new Date();
    const windowMs = this.getTimeWindowMs(timeWindow);
    const cutoff = new Date(now.getTime() - windowMs);

    const healthChecks = this.getHealthChecksInWindow(connectionId, cutoff, now);
    const stateChanges = this.getStateChangesInWindow(connectionId, cutoff, now);

    const successfulChecks = healthChecks.filter(check => check.success).length;
    const failedChecks = healthChecks.length - successfulChecks;
    const latencies = healthChecks
      .filter(check => check.latencyMs !== undefined)
      .map(check => check.latencyMs!);

    const disconnections = stateChanges.filter(change => change.newState === 'unhealthy').length;
    const reconnections = stateChanges.filter(change => change.newState === 'healthy').length;

    // Calculate downtime
    let downtimeMs = 0;
    let lastUnhealthyTime: Date | null = null;

    for (const change of stateChanges.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
      if (change.newState === 'unhealthy') {
        lastUnhealthyTime = change.timestamp;
      } else if (change.newState === 'healthy' && lastUnhealthyTime) {
        downtimeMs += change.timestamp.getTime() - lastUnhealthyTime.getTime();
        lastUnhealthyTime = null;
      }
    }

    // If still unhealthy, add time from last unhealthy to now
    if (lastUnhealthyTime) {
      downtimeMs += now.getTime() - lastUnhealthyTime.getTime();
    }

    // Calculate consecutive failures
    const maxConsecutiveFailures = this.calculateMaxConsecutiveFailures(healthChecks);

    const snapshot: HealthMetricsSnapshot = {
      timestamp: now,
      timeWindow,
      connectionId,
      totalChecks: healthChecks.length,
      successfulChecks,
      failedChecks,
      successRate: healthChecks.length > 0 ? (successfulChecks / healthChecks.length) * 100 : 100,
      avgLatencyMs: latencies.length > 0 ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0,
      minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
      p95LatencyMs: this.calculatePercentile(latencies, 95),
      p99LatencyMs: this.calculatePercentile(latencies, 99),
      disconnections,
      reconnectionAttempts: reconnections,
      maxConsecutiveFailures,
      downtimeMs,
      uptimePercent: windowMs > 0 ? ((windowMs - downtimeMs) / windowMs) * 100 : 100,
    };

    this.emit('snapshot', snapshot);
    return snapshot;
  }

  /**
   * Generate system-wide health metrics
   */
  generateSystemMetrics(timeWindow: MetricsTimeWindow): SystemHealthMetrics {
    const now = new Date();
    const allConnections = this.getAllConnectionIds();
    const snapshots = allConnections.map(id => this.generateSnapshot(id, timeWindow));

    const healthyConnections = snapshots.filter(s => s.uptimePercent > 95).length;
    const unhealthyConnections = allConnections.length - healthyConnections;

    const totalHealthChecks = snapshots.reduce((sum, s) => sum + s.totalChecks, 0);
    const totalReconnections = snapshots.reduce((sum, s) => sum + s.reconnectionAttempts, 0);

    const avgSuccessRate = snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + s.successRate, 0) / snapshots.length
      : 100;

    const avgLatency = snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + s.avgLatencyMs, 0) / snapshots.length
      : 0;

    // Top failing connections
    const topFailingConnections = snapshots
      .filter(s => s.totalChecks > 0)
      .map(s => ({
        connectionId: s.connectionId,
        failureCount: s.failedChecks,
        failureRate: 100 - s.successRate,
      }))
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, 5);

    // High latency connections
    const highLatencyConnections = snapshots
      .filter(s => s.avgLatencyMs > 0)
      .map(s => ({
        connectionId: s.connectionId,
        avgLatencyMs: s.avgLatencyMs,
        maxLatencyMs: s.maxLatencyMs,
      }))
      .sort((a, b) => b.avgLatencyMs - a.avgLatencyMs)
      .slice(0, 5);

    const systemMetrics: SystemHealthMetrics = {
      timestamp: now,
      timeWindow,
      totalConnections: allConnections.length,
      healthyConnections,
      unhealthyConnections,
      systemHealthPercent: allConnections.length > 0 ? (healthyConnections / allConnections.length) * 100 : 100,
      avgSuccessRate,
      avgLatencyMs: avgLatency,
      totalHealthChecks,
      totalReconnectionAttempts: totalReconnections,
      topFailingConnections,
      highLatencyConnections,
    };

    this.emit('system-metrics', systemMetrics);
    return systemMetrics;
  }

  /**
   * Get metrics for a specific connection
   */
  getConnectionMetrics(connectionId: string, timeWindow: MetricsTimeWindow = '1h'): HealthMetricsSnapshot {
    return this.generateSnapshot(connectionId, timeWindow);
  }

  /**
   * Get system-wide metrics
   */
  getSystemMetrics(timeWindow: MetricsTimeWindow = '1h'): SystemHealthMetrics {
    return this.generateSystemMetrics(timeWindow);
  }

  /**
   * Get all available connection IDs
   */
  getAllConnectionIds(): string[] {
    const connectionIds = new Set<string>();

    // Get from recorded health checks
    for (const id of this.healthChecks.keys()) {
      connectionIds.add(id);
    }

    // Get from active health managers
    for (const manager of this.connectionManagers) {
      const activeIds = manager.getRegisteredConnections();
      activeIds.forEach(id => connectionIds.add(id));
    }

    return Array.from(connectionIds);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealthMetricsConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (!wasEnabled && this.config.enabled) {
      this.startMetricsCollection();
    } else if (wasEnabled && !this.config.enabled) {
      this.stopMetricsCollection();
    }
  }

  /**
   * Clear all collected metrics
   */
  clearMetrics(): void {
    this.healthChecks.clear();
    this.stateChanges.clear();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopMetricsCollection();
    this.clearMetrics();
    this.connectionManagers.clear();
    this.removeAllListeners();
  }

  // Private methods

  private startMetricsCollection(): void {
    if (this.snapshotTimer) return;

    this.snapshotTimer = setInterval(() => {
      this.generatePeriodicSnapshots();
    }, this.config.snapshotIntervalMs);
  }

  private stopMetricsCollection(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
  }

  private generatePeriodicSnapshots(): void {
    const connectionIds = this.getAllConnectionIds();

    for (const connectionId of connectionIds) {
      for (const timeWindow of this.config.timeWindows) {
        const snapshot = this.generateSnapshot(connectionId, timeWindow);
        this.checkForAlerts(snapshot);
      }
    }

    // Generate system metrics for primary time window
    const primaryWindow = this.config.timeWindows[0] || '1m';
    this.generateSystemMetrics(primaryWindow);
  }

  private recordHealthCheck(result: HealthCheckResult): void {
    const event: HealthCheckEvent = {
      timestamp: result.startedAt,
      connectionId: result.connectionId,
      success: result.success,
      latencyMs: result.latencyMs,
      error: result.error instanceof Error ? result.error.message : String(result.error || ''),
      consecutiveFailures: result.consecutiveFailures,
    };

    if (!this.healthChecks.has(result.connectionId)) {
      this.healthChecks.set(result.connectionId, []);
    }

    const events = this.healthChecks.get(result.connectionId)!;
    events.push(event);

    // Limit memory usage
    if (events.length > this.config.maxEventsPerConnection) {
      events.shift();
    }
  }

  private recordStateChange(connectionId: string, previousState: 'healthy' | 'unhealthy', newState: 'healthy' | 'unhealthy'): void {
    const event: ConnectionStateEvent = {
      timestamp: new Date(),
      connectionId,
      previousState,
      newState,
    };

    if (!this.stateChanges.has(connectionId)) {
      this.stateChanges.set(connectionId, []);
    }

    const events = this.stateChanges.get(connectionId)!;
    events.push(event);

    // Limit memory usage
    if (events.length > this.config.maxEventsPerConnection) {
      events.shift();
    }
  }

  private getHealthChecksInWindow(connectionId: string, start: Date, end: Date): HealthCheckEvent[] {
    const events = this.healthChecks.get(connectionId) || [];
    return events.filter(event =>
      event.timestamp >= start && event.timestamp <= end
    );
  }

  private getStateChangesInWindow(connectionId: string, start: Date, end: Date): ConnectionStateEvent[] {
    const events = this.stateChanges.get(connectionId) || [];
    return events.filter(event =>
      event.timestamp >= start && event.timestamp <= end
    );
  }

  private getTimeWindowMs(timeWindow: MetricsTimeWindow): number {
    switch (timeWindow) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      default: return 60 * 1000;
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateMaxConsecutiveFailures(healthChecks: HealthCheckEvent[]): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const check of healthChecks.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
      if (!check.success) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }

  private checkForAlerts(snapshot: HealthMetricsSnapshot): void {
    if (!this.config.alertsEnabled) return;

    const { connectionId } = snapshot;
    const alerts: HealthAlert[] = [];

    // High failure rate alert
    if (snapshot.successRate < (100 - this.config.alertThresholds.highFailureRate) && snapshot.totalChecks > 5) {
      alerts.push({
        type: 'high-failure-rate',
        connectionId,
        timestamp: snapshot.timestamp,
        severity: snapshot.successRate < 25 ? 'critical' : snapshot.successRate < 50 ? 'high' : 'medium',
        message: `High failure rate detected: ${(100 - snapshot.successRate).toFixed(1)}%`,
        details: {
          successRate: snapshot.successRate,
          failedChecks: snapshot.failedChecks,
          totalChecks: snapshot.totalChecks,
        },
        threshold: this.config.alertThresholds.highFailureRate,
        actualValue: 100 - snapshot.successRate,
      });
    }

    // High latency alert
    if (snapshot.avgLatencyMs > this.config.alertThresholds.highLatency && snapshot.totalChecks > 0) {
      alerts.push({
        type: 'high-latency',
        connectionId,
        timestamp: snapshot.timestamp,
        severity: snapshot.avgLatencyMs > 5000 ? 'critical' : snapshot.avgLatencyMs > 2000 ? 'high' : 'medium',
        message: `High latency detected: ${snapshot.avgLatencyMs.toFixed(1)}ms average`,
        details: {
          avgLatency: snapshot.avgLatencyMs,
          maxLatency: snapshot.maxLatencyMs,
          p95Latency: snapshot.p95LatencyMs,
        },
        threshold: this.config.alertThresholds.highLatency,
        actualValue: snapshot.avgLatencyMs,
      });
    }

    // Extended downtime alert
    if (snapshot.downtimeMs > this.config.alertThresholds.extendedDowntime) {
      alerts.push({
        type: 'extended-downtime',
        connectionId,
        timestamp: snapshot.timestamp,
        severity: snapshot.downtimeMs > 1800000 ? 'critical' : 'high', // 30 minutes
        message: `Extended downtime detected: ${(snapshot.downtimeMs / 1000 / 60).toFixed(1)} minutes`,
        details: {
          downtimeMs: snapshot.downtimeMs,
          uptimePercent: snapshot.uptimePercent,
          disconnections: snapshot.disconnections,
        },
        threshold: this.config.alertThresholds.extendedDowntime,
        actualValue: snapshot.downtimeMs,
      });
    }

    // Repeated disconnections alert (only for 1h window)
    if (snapshot.timeWindow === '1h' && snapshot.disconnections > this.config.alertThresholds.repeatedDisconnections) {
      alerts.push({
        type: 'repeated-disconnections',
        connectionId,
        timestamp: snapshot.timestamp,
        severity: snapshot.disconnections > 20 ? 'critical' : snapshot.disconnections > 10 ? 'high' : 'medium',
        message: `Frequent disconnections detected: ${snapshot.disconnections} in the last hour`,
        details: {
          disconnections: snapshot.disconnections,
          reconnectionAttempts: snapshot.reconnectionAttempts,
          maxConsecutiveFailures: snapshot.maxConsecutiveFailures,
        },
        threshold: this.config.alertThresholds.repeatedDisconnections,
        actualValue: snapshot.disconnections,
      });
    }

    // Recovery alert (when connection becomes healthy after being unhealthy)
    if (snapshot.uptimePercent > 95 && snapshot.reconnectionAttempts > 0) {
      alerts.push({
        type: 'connection-recovered',
        connectionId,
        timestamp: snapshot.timestamp,
        severity: 'low',
        message: `Connection has recovered and is now healthy`,
        details: {
          uptimePercent: snapshot.uptimePercent,
          reconnectionAttempts: snapshot.reconnectionAttempts,
          successRate: snapshot.successRate,
        },
      });
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.emit('health-alert', connectionId, alert);
    });
  }
}

/**
 * Global health metrics collector instance
 */
export const globalHealthMetricsCollector = new HealthMetricsCollector();