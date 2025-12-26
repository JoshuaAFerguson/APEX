import { EventEmitter } from 'eventemitter3';
import { ContainerManager, ContainerInfo } from './container-manager';
import { ContainerRuntimeType } from './container-runtime';
import { ContainerHealthStatus, ContainerHealthEventData } from './types';

/**
 * Configuration options for container health monitoring
 */
export interface ContainerHealthMonitorOptions {
  /** Health check interval in milliseconds (default: 30000 - 30 seconds) */
  interval?: number;
  /** Maximum number of consecutive failures before marking unhealthy (default: 3) */
  maxFailures?: number;
  /** Timeout for health checks in milliseconds (default: 5000 - 5 seconds) */
  timeout?: number;
  /** Whether to monitor all containers or only specific ones (default: false) */
  monitorAll?: boolean;
  /** Container name prefix to monitor (default: 'apex') */
  containerPrefix?: string;
  /** Whether to start monitoring automatically (default: true) */
  autoStart?: boolean;
}

/**
 * Health check result for a single container
 */
export interface ContainerHealthCheck {
  /** Container ID */
  containerId: string;
  /** Container name */
  containerName: string;
  /** Health status */
  status: ContainerHealthStatus;
  /** Previous health status (if transitioning) */
  previousStatus?: ContainerHealthStatus;
  /** Number of consecutive failures */
  failingStreak: number;
  /** Output from the last health check */
  lastCheckOutput?: string;
  /** Exit code from the last health check */
  lastCheckExitCode?: number;
  /** Time of the last health check */
  lastCheckTime: Date;
  /** Error message if health check failed */
  error?: string;
}

/**
 * Events emitted by ContainerHealthMonitor
 */
export interface ContainerHealthMonitorEvents {
  /** Emitted when a container's health status changes */
  'container:health': (event: ContainerHealthEventData) => void;
  /** Emitted when health monitoring starts */
  'monitoring:started': () => void;
  /** Emitted when health monitoring stops */
  'monitoring:stopped': () => void;
  /** Emitted when a health check fails */
  'health:check:failed': (containerId: string, error: string) => void;
  /** Emitted when a health check succeeds */
  'health:check:success': (containerId: string) => void;
}

/**
 * Container health monitoring system that tracks container health status
 * and emits events when health changes occur. Integrates with ContainerManager
 * to monitor container lifecycle and health status.
 */
export class ContainerHealthMonitor extends EventEmitter<ContainerHealthMonitorEvents> {
  private containerManager: ContainerManager;
  private options: Required<ContainerHealthMonitorOptions>;
  private isMonitoring: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private containerHealth: Map<string, ContainerHealthCheck> = new Map();
  private runtimeType: ContainerRuntimeType | null = null;

  constructor(containerManager: ContainerManager, options: ContainerHealthMonitorOptions = {}) {
    super();

    this.containerManager = containerManager;
    this.options = {
      interval: options.interval ?? 30000, // 30 seconds
      maxFailures: options.maxFailures ?? 3,
      timeout: options.timeout ?? 5000, // 5 seconds
      monitorAll: options.monitorAll ?? false,
      containerPrefix: options.containerPrefix ?? 'apex',
      autoStart: options.autoStart ?? true,
    };

    // Listen to container lifecycle events from ContainerManager
    this.setupContainerLifecycleHandlers();

    // Auto-start monitoring if enabled
    if (this.options.autoStart) {
      this.startMonitoring().catch(error => {
        console.warn('Failed to auto-start container health monitoring:', error);
      });
    }
  }

  /**
   * Start health monitoring for containers
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return; // Already monitoring
    }

    // Detect container runtime
    this.runtimeType = await this.containerManager['runtime'].getBestRuntime();
    if (this.runtimeType === 'none') {
      throw new Error('No container runtime available for health monitoring');
    }

    this.isMonitoring = true;

    // Start periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch(error => {
        console.warn('Error during health checks:', error);
      });
    }, this.options.interval);

    // Perform initial health check
    await this.performHealthChecks();

    this.emit('monitoring:started');
  }

  /**
   * Stop health monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    this.emit('monitoring:stopped');
  }

  /**
   * Get current health status for all monitored containers
   */
  getHealthStatus(): Map<string, ContainerHealthCheck> {
    return new Map(this.containerHealth);
  }

  /**
   * Get health status for a specific container
   */
  getContainerHealth(containerId: string): ContainerHealthCheck | null {
    return this.containerHealth.get(containerId) || null;
  }

  /**
   * Force a health check for a specific container
   */
  async checkContainerHealth(containerId: string): Promise<ContainerHealthCheck | null> {
    const containerInfo = await this.containerManager.getContainerInfo(containerId);
    if (!containerInfo) {
      return null;
    }

    const healthCheck = await this.performContainerHealthCheck(containerInfo);
    if (healthCheck) {
      this.updateContainerHealth(healthCheck);
    }

    return healthCheck;
  }

  /**
   * Add a container to monitoring (useful when not monitoring all containers)
   */
  async addContainer(containerId: string): Promise<void> {
    const containerInfo = await this.containerManager.getContainerInfo(containerId);
    if (!containerInfo) {
      throw new Error(`Container not found: ${containerId}`);
    }

    // Perform initial health check
    const healthCheck = await this.performContainerHealthCheck(containerInfo);
    if (healthCheck) {
      this.updateContainerHealth(healthCheck);
    }
  }

  /**
   * Remove a container from monitoring
   */
  removeContainer(containerId: string): void {
    this.containerHealth.delete(containerId);
  }

  /**
   * Update monitoring configuration
   */
  updateOptions(newOptions: Partial<ContainerHealthMonitorOptions>): void {
    const wasMonitoring = this.isMonitoring;

    // Stop monitoring if running
    if (wasMonitoring) {
      this.stopMonitoring();
    }

    // Update options
    Object.assign(this.options, newOptions);

    // Restart monitoring if it was running
    if (wasMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Get current monitoring status
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    isMonitoring: boolean;
    totalContainers: number;
    healthyContainers: number;
    unhealthyContainers: number;
    startingContainers: number;
    averageFailingStreak: number;
    lastCheckTime?: Date;
  } {
    const containers = Array.from(this.containerHealth.values());
    const totalContainers = containers.length;
    const healthyContainers = containers.filter(c => c.status === 'healthy').length;
    const unhealthyContainers = containers.filter(c => c.status === 'unhealthy').length;
    const startingContainers = containers.filter(c => c.status === 'starting').length;
    const averageFailingStreak = totalContainers > 0
      ? containers.reduce((sum, c) => sum + c.failingStreak, 0) / totalContainers
      : 0;
    const lastCheckTime = containers.length > 0
      ? new Date(Math.max(...containers.map(c => c.lastCheckTime.getTime())))
      : undefined;

    return {
      isMonitoring: this.isMonitoring,
      totalContainers,
      healthyContainers,
      unhealthyContainers,
      startingContainers,
      averageFailingStreak,
      lastCheckTime,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Setup listeners for container lifecycle events from ContainerManager
   */
  private setupContainerLifecycleHandlers(): void {
    // When a container is created, add it to monitoring
    this.containerManager.on('container:created', (event) => {
      if (this.shouldMonitorContainer(event.containerInfo?.name || '')) {
        this.addContainer(event.containerId).catch(error => {
          console.warn(`Failed to add container ${event.containerId} to health monitoring:`, error);
        });
      }
    });

    // When a container is started, reset health status
    this.containerManager.on('container:started', (event) => {
      const existingHealth = this.containerHealth.get(event.containerId);
      if (existingHealth) {
        existingHealth.status = 'starting';
        existingHealth.failingStreak = 0;
        existingHealth.lastCheckTime = new Date();
        this.emitHealthEvent(existingHealth);
      }
    });

    // When a container is stopped or removed, remove from monitoring
    this.containerManager.on('container:stopped', (event) => {
      this.removeContainer(event.containerId);
    });

    this.containerManager.on('container:removed', (event) => {
      this.removeContainer(event.containerId);
    });

    // When a container dies unexpectedly, mark as unhealthy
    this.containerManager.on('container:died', (event) => {
      const existingHealth = this.containerHealth.get(event.containerId);
      if (existingHealth) {
        const previousStatus = existingHealth.status;
        existingHealth.status = 'unhealthy';
        existingHealth.previousStatus = previousStatus;
        existingHealth.failingStreak = this.options.maxFailures; // Mark as max failures
        existingHealth.lastCheckTime = new Date();
        existingHealth.error = `Container died unexpectedly (exit code: ${event.exitCode})`;

        this.emitHealthEvent(existingHealth);
      }
    });
  }

  /**
   * Perform health checks for all monitored containers
   */
  private async performHealthChecks(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    try {
      // Get list of containers to monitor
      const containers = await this.getContainersToMonitor();

      // Perform health checks concurrently
      const healthCheckPromises = containers.map(container =>
        this.performContainerHealthCheck(container)
      );

      const healthChecks = await Promise.allSettled(healthCheckPromises);

      // Process results
      healthChecks.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          this.updateContainerHealth(result.value);
        } else if (result.status === 'rejected') {
          const container = containers[index];
          console.warn(`Health check failed for container ${container.id}:`, result.reason);
          this.emit('health:check:failed', container.id, String(result.reason));
        }
      });

    } catch (error) {
      console.warn('Error performing health checks:', error);
    }
  }

  /**
   * Get list of containers that should be monitored
   */
  private async getContainersToMonitor(): Promise<ContainerInfo[]> {
    try {
      if (this.options.monitorAll) {
        // Monitor all running containers
        return await this.containerManager.listApexContainers(this.runtimeType!, false);
      } else {
        // Monitor only containers that match our criteria
        const allContainers = await this.containerManager.listApexContainers(this.runtimeType!, false);
        return allContainers.filter(container =>
          this.shouldMonitorContainer(container.name)
        );
      }
    } catch (error) {
      console.warn('Error getting containers to monitor:', error);
      return [];
    }
  }

  /**
   * Check if a container should be monitored based on configuration
   */
  private shouldMonitorContainer(containerName: string): boolean {
    if (this.options.monitorAll) {
      return true;
    }

    // Check if container name starts with the configured prefix
    return containerName.startsWith(this.options.containerPrefix);
  }

  /**
   * Perform health check for a specific container
   */
  private async performContainerHealthCheck(containerInfo: ContainerInfo): Promise<ContainerHealthCheck | null> {
    const existingHealth = this.containerHealth.get(containerInfo.id);
    const now = new Date();

    try {
      // Check if container is running
      if (containerInfo.status !== 'running') {
        const status: ContainerHealthStatus = containerInfo.status === 'created' ? 'starting' : 'unhealthy';

        return {
          containerId: containerInfo.id,
          containerName: containerInfo.name,
          status,
          previousStatus: existingHealth?.status,
          failingStreak: status === 'unhealthy' ? (existingHealth?.failingStreak || 0) + 1 : 0,
          lastCheckTime: now,
          lastCheckExitCode: containerInfo.exitCode,
          error: status === 'unhealthy' ? `Container is not running (status: ${containerInfo.status})` : undefined,
        };
      }

      // For running containers, check if they're responsive by getting stats
      const stats = await this.containerManager.getStats(containerInfo.id, this.runtimeType!);

      if (!stats) {
        // Failed to get stats, consider unhealthy
        const failingStreak = (existingHealth?.failingStreak || 0) + 1;

        return {
          containerId: containerInfo.id,
          containerName: containerInfo.name,
          status: failingStreak >= this.options.maxFailures ? 'unhealthy' : 'starting',
          previousStatus: existingHealth?.status,
          failingStreak,
          lastCheckTime: now,
          error: 'Failed to get container statistics',
        };
      }

      // Check if container is healthy based on stats
      const isHealthy = this.evaluateContainerHealth(stats, containerInfo);

      if (isHealthy) {
        this.emit('health:check:success', containerInfo.id);

        return {
          containerId: containerInfo.id,
          containerName: containerInfo.name,
          status: 'healthy',
          previousStatus: existingHealth?.status,
          failingStreak: 0,
          lastCheckTime: now,
          lastCheckOutput: 'Container is responsive and healthy',
        };
      } else {
        const failingStreak = (existingHealth?.failingStreak || 0) + 1;
        const status: ContainerHealthStatus = failingStreak >= this.options.maxFailures ? 'unhealthy' : 'starting';

        this.emit('health:check:failed', containerInfo.id, 'Container health evaluation failed');

        return {
          containerId: containerInfo.id,
          containerName: containerInfo.name,
          status,
          previousStatus: existingHealth?.status,
          failingStreak,
          lastCheckTime: now,
          error: 'Container health evaluation failed',
        };
      }

    } catch (error) {
      const failingStreak = (existingHealth?.failingStreak || 0) + 1;
      const status: ContainerHealthStatus = failingStreak >= this.options.maxFailures ? 'unhealthy' : 'starting';
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.emit('health:check:failed', containerInfo.id, errorMessage);

      return {
        containerId: containerInfo.id,
        containerName: containerInfo.name,
        status,
        previousStatus: existingHealth?.status,
        failingStreak,
        lastCheckTime: now,
        error: errorMessage,
      };
    }
  }

  /**
   * Evaluate container health based on stats and other criteria
   */
  private evaluateContainerHealth(stats: any, containerInfo: ContainerInfo): boolean {
    // Basic health checks:
    // 1. Container is running
    // 2. Not using excessive resources
    // 3. No OOM conditions

    // Check memory usage - if over 95%, consider unhealthy
    if (stats.memoryPercent > 95) {
      return false;
    }

    // Check if PIDs are reasonable (not hitting limits)
    if (stats.pids > 10000) { // Arbitrary high limit
      return false;
    }

    // Container seems healthy
    return true;
  }

  /**
   * Update container health status and emit events if changed
   */
  private updateContainerHealth(healthCheck: ContainerHealthCheck): void {
    const existingHealth = this.containerHealth.get(healthCheck.containerId);
    const statusChanged = !existingHealth || existingHealth.status !== healthCheck.status;

    // Update the health record
    this.containerHealth.set(healthCheck.containerId, healthCheck);

    // Emit health event if status changed
    if (statusChanged) {
      this.emitHealthEvent(healthCheck);
    }
  }

  /**
   * Emit a container health event
   */
  private emitHealthEvent(healthCheck: ContainerHealthCheck): void {
    const eventData: ContainerHealthEventData = {
      containerId: healthCheck.containerId,
      containerName: healthCheck.containerName,
      image: 'unknown', // We could get this from container info if needed
      taskId: this.extractTaskIdFromContainerName(healthCheck.containerName),
      timestamp: healthCheck.lastCheckTime,
      status: healthCheck.status,
      previousStatus: healthCheck.previousStatus,
      failingStreak: healthCheck.failingStreak,
      lastCheckOutput: healthCheck.lastCheckOutput,
      lastCheckExitCode: healthCheck.lastCheckExitCode,
      lastCheckTime: healthCheck.lastCheckTime,
    };

    this.emit('container:health', eventData);
  }

  /**
   * Extract task ID from container name if it follows APEX naming convention
   */
  private extractTaskIdFromContainerName(containerName: string): string | undefined {
    // Expected format: apex-{taskId} or apex-{taskId}-{timestamp}
    const match = containerName.match(/^apex-([^-]+)/);
    return match ? match[1] : undefined;
  }
}

/**
 * Default container health monitor instance
 * Note: Initialized lazily to avoid circular dependency issues
 */
let _defaultMonitor: ContainerHealthMonitor | null = null;

export const containerHealthMonitor = {
  get instance(): ContainerHealthMonitor {
    if (!_defaultMonitor) {
      const { containerManager } = require('./container-manager');
      _defaultMonitor = new ContainerHealthMonitor(containerManager);
    }
    return _defaultMonitor;
  }
};

/**
 * Convenience function to start container health monitoring
 */
export async function startContainerHealthMonitoring(
  options?: ContainerHealthMonitorOptions
): Promise<ContainerHealthMonitor> {
  const { containerManager } = require('./container-manager');
  const monitor = new ContainerHealthMonitor(containerManager, options);
  await monitor.startMonitoring();
  return monitor;
}

/**
 * Convenience function to get container health status
 */
export function getContainerHealth(containerId: string): ContainerHealthCheck | null {
  return containerHealthMonitor.instance.getContainerHealth(containerId);
}