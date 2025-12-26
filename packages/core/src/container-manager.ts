import { ContainerConfig, ContainerInfo, ContainerStats, ContainerStatus, ResourceLimits, ContainerLogStreamOptions, ContainerLogEntry } from './types';
import { ContainerRuntime, ContainerRuntimeType } from './container-runtime';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { EventEmitter as TypedEventEmitter } from 'eventemitter3';

const execAsync = promisify(exec);

/**
 * Container management result for creation and lifecycle operations
 */
export interface ContainerOperationResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Container ID (if operation succeeded) */
  containerId?: string;
  /** Container information (if available) */
  containerInfo?: ContainerInfo;
  /** Error message (if operation failed) */
  error?: string;
  /** Full command that was executed */
  command?: string;
  /** Command output */
  output?: string;
}

/**
 * Options for container creation
 */
export interface CreateContainerOptions {
  /** Container configuration */
  config: ContainerConfig;
  /** Associated task ID for naming and tracking */
  taskId: string;
  /** Whether to start the container immediately after creation */
  autoStart?: boolean;
  /** Override the default container name */
  nameOverride?: string;
}

/**
 * Container naming convention settings
 */
export interface ContainerNamingConfig {
  /** Prefix for all APEX containers */
  prefix: string;
  /** Include task ID in the name */
  includeTaskId: boolean;
  /** Include timestamp in the name */
  includeTimestamp: boolean;
  /** Custom separator between name components */
  separator: string;
}

/**
 * Event data for container lifecycle events
 */
export interface ContainerEvent {
  /** Container ID */
  containerId: string;
  /** Task ID associated with the container */
  taskId?: string;
  /** Container information (if available) */
  containerInfo?: ContainerInfo;
  /** Timestamp when the event occurred */
  timestamp: Date;
}

/**
 * Event data for container operation events (includes success/failure info)
 */
export interface ContainerOperationEvent extends ContainerEvent {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Command that was executed */
  command?: string;
}

/**
 * Typed events emitted by ContainerManager
 */
export interface ContainerManagerEvents {
  /** Emitted when a container is created */
  'container:created': (event: ContainerOperationEvent) => void;
  /** Emitted when a container is started */
  'container:started': (event: ContainerOperationEvent) => void;
  /** Emitted when a container is stopped */
  'container:stopped': (event: ContainerOperationEvent) => void;
  /** Emitted when a container is removed */
  'container:removed': (event: ContainerOperationEvent) => void;
  /** Emitted for general container lifecycle events */
  'container:lifecycle': (event: ContainerEvent, operation: 'created' | 'started' | 'stopped' | 'removed') => void;
}

/**
 * Container manager for creating and managing containerized workspaces
 * Provides high-level container operations with support for Docker and Podman
 * Extends EventEmitter3 to emit typed lifecycle events
 */
export class ContainerManager extends TypedEventEmitter<ContainerManagerEvents> {
  private runtime: ContainerRuntime;
  private defaultNamingConfig: ContainerNamingConfig;

  constructor(
    runtime?: ContainerRuntime,
    namingConfig?: Partial<ContainerNamingConfig>
  ) {
    super();
    this.runtime = runtime || new ContainerRuntime();
    this.defaultNamingConfig = {
      prefix: 'apex',
      includeTaskId: true,
      includeTimestamp: false,
      separator: '-',
      ...namingConfig,
    };
  }

  /**
   * Create a new container with the specified configuration
   * @param options Container creation options
   * @returns Container operation result
   */
  async createContainer(options: CreateContainerOptions): Promise<ContainerOperationResult> {
    try {
      const runtimeType = await this.runtime.getBestRuntime();

      if (runtimeType === 'none') {
        const result = {
          success: false,
          error: 'No container runtime available. Please install Docker or Podman.',
        };

        // Emit creation failed event
        this.emitContainerEvent('created', {
          containerId: '',
          taskId: options.taskId,
          timestamp: new Date(),
          success: false,
          error: result.error,
        });

        return result;
      }

      const containerName = options.nameOverride || this.generateContainerName(options.taskId);
      const command = this.buildCreateCommand(runtimeType, options.config, containerName);

      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

      if (stderr && stderr.trim()) {
        const result = {
          success: false,
          error: `Container creation failed: ${stderr.trim()}`,
          command,
          output: stdout,
        };

        // Emit creation failed event
        this.emitContainerEvent('created', {
          containerId: '',
          taskId: options.taskId,
          timestamp: new Date(),
          success: false,
          error: result.error,
          command: result.command,
        });

        return result;
      }

      // Extract container ID from output
      const containerId = stdout.trim();

      // Start container if auto-start is enabled
      if (options.autoStart) {
        const startResult = await this.startContainer(containerId, runtimeType);
        if (!startResult.success) {
          // Clean up created container if start failed
          await this.removeContainer(containerId, runtimeType);
          return startResult;
        }
      }

      const containerInfo = await this.getContainerInfo(containerId, runtimeType);

      const result = {
        success: true,
        containerId,
        containerInfo,
        command,
        output: stdout,
      };

      // Emit creation success event
      this.emitContainerEvent('created', {
        containerId,
        taskId: options.taskId,
        containerInfo,
        timestamp: new Date(),
        success: true,
        command,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result = {
        success: false,
        error: `Container creation failed: ${errorMessage}`,
      };

      // Emit creation failed event
      this.emitContainerEvent('created', {
        containerId: '',
        taskId: options.taskId,
        timestamp: new Date(),
        success: false,
        error: result.error,
      });

      return result;
    }
  }

  /**
   * Start an existing container
   * @param containerId Container ID or name
   * @param runtimeType Optional runtime type (auto-detected if not provided)
   * @returns Container operation result
   */
  async startContainer(containerId: string, runtimeType?: ContainerRuntimeType): Promise<ContainerOperationResult> {
    try {
      const runtime = runtimeType || await this.runtime.getBestRuntime();

      if (runtime === 'none') {
        const result = {
          success: false,
          error: 'No container runtime available',
        };

        // Emit start failed event
        this.emitContainerEvent('started', {
          containerId,
          timestamp: new Date(),
          success: false,
          error: result.error,
        });

        return result;
      }

      const command = `${runtime} start ${containerId}`;
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

      if (stderr && stderr.trim()) {
        const result = {
          success: false,
          error: `Container start failed: ${stderr.trim()}`,
          command,
          output: stdout,
        };

        // Emit start failed event
        this.emitContainerEvent('started', {
          containerId,
          timestamp: new Date(),
          success: false,
          error: result.error,
          command: result.command,
        });

        return result;
      }

      const containerInfo = await this.getContainerInfo(containerId, runtime);

      const result = {
        success: true,
        containerId,
        containerInfo,
        command,
        output: stdout,
      };

      // Emit start success event
      this.emitContainerEvent('started', {
        containerId,
        containerInfo,
        timestamp: new Date(),
        success: true,
        command,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result = {
        success: false,
        error: `Container start failed: ${errorMessage}`,
      };

      // Emit start failed event
      this.emitContainerEvent('started', {
        containerId,
        timestamp: new Date(),
        success: false,
        error: result.error,
      });

      return result;
    }
  }

  /**
   * Stop a running container
   * @param containerId Container ID or name
   * @param runtimeType Optional runtime type (auto-detected if not provided)
   * @param timeout Timeout in seconds for graceful shutdown
   * @returns Container operation result
   */
  async stopContainer(
    containerId: string,
    runtimeType?: ContainerRuntimeType,
    timeout: number = 10
  ): Promise<ContainerOperationResult> {
    try {
      const runtime = runtimeType || await this.runtime.getBestRuntime();

      if (runtime === 'none') {
        const result = {
          success: false,
          error: 'No container runtime available',
        };

        // Emit stop failed event
        this.emitContainerEvent('stopped', {
          containerId,
          timestamp: new Date(),
          success: false,
          error: result.error,
        });

        return result;
      }

      const command = `${runtime} stop --time ${timeout} ${containerId}`;
      const { stdout, stderr } = await execAsync(command, { timeout: (timeout + 10) * 1000 });

      if (stderr && stderr.trim()) {
        const result = {
          success: false,
          error: `Container stop failed: ${stderr.trim()}`,
          command,
          output: stdout,
        };

        // Emit stop failed event
        this.emitContainerEvent('stopped', {
          containerId,
          timestamp: new Date(),
          success: false,
          error: result.error,
          command: result.command,
        });

        return result;
      }

      const result = {
        success: true,
        containerId,
        command,
        output: stdout,
      };

      // Emit stop success event
      this.emitContainerEvent('stopped', {
        containerId,
        timestamp: new Date(),
        success: true,
        command,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result = {
        success: false,
        error: `Container stop failed: ${errorMessage}`,
      };

      // Emit stop failed event
      this.emitContainerEvent('stopped', {
        containerId,
        timestamp: new Date(),
        success: false,
        error: result.error,
      });

      return result;
    }
  }

  /**
   * Remove a container
   * @param containerId Container ID or name
   * @param runtimeType Optional runtime type (auto-detected if not provided)
   * @param force Whether to force removal of running containers
   * @returns Container operation result
   */
  async removeContainer(
    containerId: string,
    runtimeType?: ContainerRuntimeType,
    force: boolean = false
  ): Promise<ContainerOperationResult> {
    try {
      const runtime = runtimeType || await this.runtime.getBestRuntime();

      if (runtime === 'none') {
        const result = {
          success: false,
          error: 'No container runtime available',
        };

        // Emit remove failed event
        this.emitContainerEvent('removed', {
          containerId,
          timestamp: new Date(),
          success: false,
          error: result.error,
        });

        return result;
      }

      const forceFlag = force ? ' --force' : '';
      const command = `${runtime} rm${forceFlag} ${containerId}`;
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

      if (stderr && stderr.trim()) {
        const result = {
          success: false,
          error: `Container removal failed: ${stderr.trim()}`,
          command,
          output: stdout,
        };

        // Emit remove failed event
        this.emitContainerEvent('removed', {
          containerId,
          timestamp: new Date(),
          success: false,
          error: result.error,
          command: result.command,
        });

        return result;
      }

      const result = {
        success: true,
        containerId,
        command,
        output: stdout,
      };

      // Emit remove success event
      this.emitContainerEvent('removed', {
        containerId,
        timestamp: new Date(),
        success: true,
        command,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result = {
        success: false,
        error: `Container removal failed: ${errorMessage}`,
      };

      // Emit remove failed event
      this.emitContainerEvent('removed', {
        containerId,
        timestamp: new Date(),
        success: false,
        error: result.error,
      });

      return result;
    }
  }

  /**
   * Inspect a container and return detailed information
   * @param containerId Container ID or name
   * @param runtimeType Optional runtime type (auto-detected if not provided)
   * @returns Container information or null if not found
   */
  async inspect(containerId: string, runtimeType?: ContainerRuntimeType): Promise<ContainerInfo | null> {
    return this.getContainerInfo(containerId, runtimeType);
  }

  /**
   * Get runtime statistics for a container
   * @param containerId Container ID or name
   * @param runtimeType Optional runtime type (auto-detected if not provided)
   * @returns Container statistics or null if not found
   */
  async getStats(containerId: string, runtimeType?: ContainerRuntimeType): Promise<ContainerStats | null> {
    try {
      const runtime = runtimeType || await this.runtime.getBestRuntime();

      if (runtime === 'none') {
        return null;
      }

      // Use docker/podman stats --no-stream to get a one-time snapshot of stats
      const command = `${runtime} stats --no-stream --format "table {{.Container}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}" ${containerId}`;

      const { stdout } = await execAsync(command, { timeout: 10000 });
      const lines = stdout.trim().split('\n');

      // Skip header line if present (starts with "CONTAINER")
      const dataLine = lines.find(line => !line.toLowerCase().startsWith('container'));

      if (!dataLine) {
        return null;
      }

      const parts = dataLine.split('|');
      if (parts.length < 7) {
        return null;
      }

      // Parse stats - format: container|cpu%|mem usage/limit|mem%|net rx/tx|block rx/tx|pids
      const stats: ContainerStats = {
        cpuPercent: this.parsePercentage(parts[1]),
        memoryUsage: this.parseMemoryValue(parts[2], true), // usage part of "used / limit"
        memoryLimit: this.parseMemoryValue(parts[2], false), // limit part of "used / limit"
        memoryPercent: this.parsePercentage(parts[3]),
        networkRxBytes: this.parseNetworkIO(parts[4], true), // rx part of "rx / tx"
        networkTxBytes: this.parseNetworkIO(parts[4], false), // tx part of "rx / tx"
        blockReadBytes: this.parseBlockIO(parts[5], true), // read part of "read / write"
        blockWriteBytes: this.parseBlockIO(parts[5], false), // write part of "read / write"
        pids: this.parsePids(parts[6]),
      };

      return stats;
    } catch (error) {
      // Container not found or error getting stats
      return null;
    }
  }

  /**
   * Get information about a container
   * @param containerId Container ID or name
   * @param runtimeType Optional runtime type (auto-detected if not provided)
   * @returns Container information or null if not found
   */
  async getContainerInfo(containerId: string, runtimeType?: ContainerRuntimeType): Promise<ContainerInfo | null> {
    try {
      const runtime = runtimeType || await this.runtime.getBestRuntime();

      if (runtime === 'none') {
        return null;
      }

      const format = '{{.ID}}|{{.Name}}|{{.Image}}|{{.State.Status}}|{{.CreatedAt}}|{{.State.StartedAt}}|{{.State.FinishedAt}}|{{.State.ExitCode}}';
      const command = `${runtime} inspect --format "${format}" ${containerId}`;

      const { stdout } = await execAsync(command, { timeout: 10000 });
      const parts = stdout.trim().split('|');

      if (parts.length < 4) {
        return null;
      }

      const containerInfo: ContainerInfo = {
        id: parts[0] || containerId,
        name: parts[1]?.replace(/^\//, '') || containerId, // Remove leading slash from name
        image: parts[2] || 'unknown',
        status: this.parseContainerStatus(parts[3] || 'unknown'),
        createdAt: this.parseDate(parts[4]) || new Date(),
        startedAt: this.parseDate(parts[5]),
        finishedAt: this.parseDate(parts[6]),
        exitCode: parts[7] && parts[7] !== '<no value>' ? parseInt(parts[7], 10) : undefined,
      };

      return containerInfo;
    } catch (error) {
      // Container not found or other error
      return null;
    }
  }

  /**
   * List all APEX containers
   * @param runtimeType Optional runtime type (auto-detected if not provided)
   * @param includeExited Whether to include exited containers
   * @returns Array of container information
   */
  async listApexContainers(
    runtimeType?: ContainerRuntimeType,
    includeExited: boolean = false
  ): Promise<ContainerInfo[]> {
    try {
      const runtime = runtimeType || await this.runtime.getBestRuntime();

      if (runtime === 'none') {
        return [];
      }

      const statusFilter = includeExited ? '' : ' --filter status=running';
      const nameFilter = ` --filter name=${this.defaultNamingConfig.prefix}${this.defaultNamingConfig.separator}`;
      const format = '{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.CreatedAt}}';

      const command = `${runtime} ps${statusFilter}${nameFilter} --format "${format}"`;
      const { stdout } = await execAsync(command, { timeout: 10000 });

      const containers: ContainerInfo[] = [];
      const lines = stdout.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          const containerInfo = await this.getContainerInfo(parts[0], runtime);
          if (containerInfo) {
            containers.push(containerInfo);
          }
        }
      }

      return containers;
    } catch (error) {
      return [];
    }
  }

  /**
   * Stream logs from a container
   * @param containerId Container ID or name
   * @param options Log streaming options
   * @param runtimeType Optional runtime type (auto-detected if not provided)
   * @returns EventEmitter that emits 'data' events with ContainerLogEntry objects
   */
  async streamLogs(
    containerId: string,
    options: ContainerLogStreamOptions = {},
    runtimeType?: ContainerRuntimeType
  ): Promise<ContainerLogStream> {
    const runtime = runtimeType || await this.runtime.getBestRuntime();

    if (runtime === 'none') {
      throw new Error('No container runtime available');
    }

    return new ContainerLogStream(containerId, options, runtime);
  }

  /**
   * Generate a container name following APEX naming conventions
   * @param taskId Task ID to include in the name
   * @param config Optional naming configuration override
   * @returns Generated container name
   */
  generateContainerName(taskId: string, config?: Partial<ContainerNamingConfig>): string {
    const namingConfig = { ...this.defaultNamingConfig, ...config };
    const parts = [namingConfig.prefix];

    if (namingConfig.includeTaskId) {
      // Sanitize task ID for container name (remove invalid characters)
      const sanitizedTaskId = taskId.replace(/[^a-zA-Z0-9_.-]/g, '_');
      parts.push(sanitizedTaskId);
    }

    if (namingConfig.includeTimestamp) {
      const timestamp = Date.now().toString(36); // Base36 for shorter representation
      parts.push(timestamp);
    }

    return parts.join(namingConfig.separator);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Emit container lifecycle events
   * @param operation Type of operation performed
   * @param event Event data
   */
  private emitContainerEvent(
    operation: 'created' | 'started' | 'stopped' | 'removed',
    event: ContainerOperationEvent
  ): void {
    // Emit specific operation event
    this.emit(`container:${operation}`, event);

    // Emit general lifecycle event
    this.emit('container:lifecycle', event, operation);
  }

  /**
   * Build the container creation command
   * @param runtimeType Container runtime type
   * @param config Container configuration
   * @param containerName Container name
   * @returns Complete command string
   */
  private buildCreateCommand(
    runtimeType: ContainerRuntimeType,
    config: ContainerConfig,
    containerName: string
  ): string {
    const parts = [runtimeType, 'create'];

    // Add container name
    parts.push('--name', containerName);

    // Add volume mounts
    if (config.volumes) {
      for (const [hostPath, containerPath] of Object.entries(config.volumes)) {
        parts.push('-v', `${hostPath}:${containerPath}`);
      }
    }

    // Add environment variables
    if (config.environment) {
      for (const [key, value] of Object.entries(config.environment)) {
        parts.push('-e', `${key}=${value}`);
      }
    }

    // Add resource limits
    if (config.resourceLimits) {
      const limits = this.buildResourceLimitsArgs(config.resourceLimits);
      parts.push(...limits);
    }

    // Add network mode
    if (config.networkMode) {
      parts.push('--network', config.networkMode);
    }

    // Add working directory
    if (config.workingDir) {
      parts.push('-w', config.workingDir);
    }

    // Add user
    if (config.user) {
      parts.push('--user', config.user);
    }

    // Add labels
    if (config.labels) {
      for (const [key, value] of Object.entries(config.labels)) {
        parts.push('--label', `${key}=${value}`);
      }
    }

    // Add APEX-specific labels
    parts.push('--label', `apex.managed=true`);
    parts.push('--label', `apex.container-name=${containerName}`);

    // Add entrypoint override
    if (config.entrypoint && config.entrypoint.length > 0) {
      parts.push('--entrypoint', config.entrypoint.join(' '));
    }

    // Add auto-remove flag
    if (config.autoRemove) {
      parts.push('--rm');
    }

    // Add privileged mode
    if (config.privileged) {
      parts.push('--privileged');
    }

    // Add security options
    if (config.securityOpts && config.securityOpts.length > 0) {
      for (const securityOpt of config.securityOpts) {
        parts.push('--security-opt', securityOpt);
      }
    }

    // Add capabilities
    if (config.capAdd && config.capAdd.length > 0) {
      for (const cap of config.capAdd) {
        parts.push('--cap-add', cap);
      }
    }

    if (config.capDrop && config.capDrop.length > 0) {
      for (const cap of config.capDrop) {
        parts.push('--cap-drop', cap);
      }
    }

    // Add image
    parts.push(config.image);

    // Add command
    if (config.command && config.command.length > 0) {
      parts.push(...config.command);
    }

    return parts.map(part => this.escapeShellArg(part)).join(' ');
  }

  /**
   * Build resource limits arguments
   * @param limits Resource limits configuration
   * @returns Array of command arguments
   */
  private buildResourceLimitsArgs(limits: ResourceLimits): string[] {
    const args: string[] = [];

    if (limits.memory) {
      args.push('--memory', limits.memory);
    }

    if (limits.memoryReservation) {
      args.push('--memory-reservation', limits.memoryReservation);
    }

    if (limits.memorySwap) {
      args.push('--memory-swap', limits.memorySwap);
    }

    if (limits.cpu) {
      args.push('--cpus', limits.cpu.toString());
    }

    if (limits.cpuShares) {
      args.push('--cpu-shares', limits.cpuShares.toString());
    }

    if (limits.pidsLimit) {
      args.push('--pids-limit', limits.pidsLimit.toString());
    }

    return args;
  }

  /**
   * Parse container status from runtime output
   * @param statusString Status string from runtime
   * @returns Normalized container status
   */
  private parseContainerStatus(statusString: string): ContainerStatus {
    const status = statusString.toLowerCase().trim();

    switch (status) {
      case 'created':
        return 'created';
      case 'running':
      case 'up':
        return 'running';
      case 'paused':
        return 'paused';
      case 'restarting':
        return 'restarting';
      case 'removing':
        return 'removing';
      case 'exited':
      case 'stopped':
        return 'exited';
      case 'dead':
        return 'dead';
      default:
        // Fallback for unknown statuses
        if (status.includes('up') || status.includes('running')) {
          return 'running';
        } else if (status.includes('exit') || status.includes('stop')) {
          return 'exited';
        }
        return 'exited';
    }
  }

  /**
   * Parse date string from container runtime output
   * @param dateString Date string to parse
   * @returns Parsed date or undefined if invalid
   */
  private parseDate(dateString: string): Date | undefined {
    if (!dateString || dateString === '<no value>' || dateString.trim() === '') {
      return undefined;
    }

    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }

  /**
   * Parse percentage value from container stats
   * @param percentageString Percentage string (e.g., "25.5%")
   * @returns Parsed percentage as number
   */
  private parsePercentage(percentageString: string): number {
    const cleaned = percentageString.replace('%', '').trim();
    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
  }

  /**
   * Parse memory value from container stats
   * @param memoryString Memory string (e.g., "512MiB / 1GiB")
   * @param getUsage If true, return usage; if false, return limit
   * @returns Memory value in bytes
   */
  private parseMemoryValue(memoryString: string, getUsage: boolean): number {
    try {
      const parts = memoryString.split('/');
      const target = getUsage ? parts[0] : parts[1];

      if (!target) return 0;

      const cleaned = target.trim();
      const match = cleaned.match(/^([\d.]+)\s*([KMGTPE]?i?B?)$/i);

      if (!match) return 0;

      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();

      const multipliers: Record<string, number> = {
        'B': 1,
        'KB': 1000, 'KIB': 1024,
        'MB': 1000000, 'MIB': 1024 * 1024,
        'GB': 1000000000, 'GIB': 1024 * 1024 * 1024,
        'TB': 1000000000000, 'TIB': 1024 * 1024 * 1024 * 1024,
        'PB': 1000000000000000, 'PIB': 1024 * 1024 * 1024 * 1024 * 1024,
      };

      return Math.floor(value * (multipliers[unit] || 1));
    } catch {
      return 0;
    }
  }

  /**
   * Parse network I/O values from container stats
   * @param networkString Network I/O string (e.g., "1.2kB / 800B")
   * @param getRx If true, return RX bytes; if false, return TX bytes
   * @returns Network bytes
   */
  private parseNetworkIO(networkString: string, getRx: boolean): number {
    try {
      const parts = networkString.split('/');
      const target = getRx ? parts[0] : parts[1];

      if (!target) return 0;

      return this.parseByteValue(target.trim());
    } catch {
      return 0;
    }
  }

  /**
   * Parse block I/O values from container stats
   * @param blockString Block I/O string (e.g., "1.2MB / 800kB")
   * @param getRead If true, return read bytes; if false, return write bytes
   * @returns Block I/O bytes
   */
  private parseBlockIO(blockString: string, getRead: boolean): number {
    try {
      const parts = blockString.split('/');
      const target = getRead ? parts[0] : parts[1];

      if (!target) return 0;

      return this.parseByteValue(target.trim());
    } catch {
      return 0;
    }
  }

  /**
   * Parse PIDs count from container stats
   * @param pidsString PIDs string (e.g., "42")
   * @returns Number of PIDs
   */
  private parsePids(pidsString: string): number {
    const value = parseInt(pidsString.trim(), 10);
    return isNaN(value) ? 0 : value;
  }

  /**
   * Parse byte value with unit suffix
   * @param byteString Byte string (e.g., "1.2kB", "800B")
   * @returns Byte value as number
   */
  private parseByteValue(byteString: string): number {
    try {
      const match = byteString.match(/^([\d.]+)\s*([KMGTPE]?B?)$/i);

      if (!match) return 0;

      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();

      const multipliers: Record<string, number> = {
        'B': 1,
        'KB': 1000,
        'MB': 1000000,
        'GB': 1000000000,
        'TB': 1000000000000,
        'PB': 1000000000000000,
      };

      return Math.floor(value * (multipliers[unit] || 1));
    } catch {
      return 0;
    }
  }

  /**
   * Escape shell argument to prevent injection
   * @param arg Argument to escape
   * @returns Escaped argument
   */
  private escapeShellArg(arg: string): string {
    // If argument contains spaces or special characters, quote it
    if (/[\s'"$`\\|&;<>(){}[\]*?~]/.test(arg)) {
      // Escape single quotes and wrap in single quotes
      return `'${arg.replace(/'/g, "'\"'\"'")}'`;
    }
    return arg;
  }
}

/**
 * Container log stream implementation
 * EventEmitter that streams logs from a container with async iterator support
 */
export class ContainerLogStream extends EventEmitter {
  private process?: ChildProcess;
  private containerId: string;
  private options: ContainerLogStreamOptions;
  private runtime: ContainerRuntimeType;
  private isStreaming: boolean = false;
  private ended: boolean = false;

  constructor(containerId: string, options: ContainerLogStreamOptions, runtime: ContainerRuntimeType) {
    super();
    this.containerId = containerId;
    this.options = options;
    this.runtime = runtime;
    this.startStreaming();
  }

  /**
   * Start streaming logs from the container
   */
  private startStreaming(): void {
    if (this.isStreaming || this.ended) {
      return;
    }

    try {
      const command = this.buildLogsCommand();
      const args = command.split(' ').slice(1); // Remove the runtime command

      this.process = spawn(this.runtime, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.isStreaming = true;

      // Handle stdout and stderr
      if (this.process.stdout) {
        this.process.stdout.on('data', (chunk: Buffer) => {
          this.processLogData(chunk, 'stdout');
        });
      }

      if (this.process.stderr) {
        this.process.stderr.on('data', (chunk: Buffer) => {
          this.processLogData(chunk, 'stderr');
        });
      }

      // Handle process events
      this.process.on('error', (error) => {
        this.emit('error', error);
        this.end();
      });

      this.process.on('exit', (code) => {
        this.emit('exit', code);
        this.end();
      });

      this.process.on('close', () => {
        this.end();
      });

    } catch (error) {
      this.emit('error', error);
      this.end();
    }
  }

  /**
   * Process log data from stdout/stderr and emit parsed log entries
   */
  private processLogData(chunk: Buffer, stream: 'stdout' | 'stderr'): void {
    if (this.ended) {
      return;
    }

    const data = chunk.toString('utf8');
    const lines = data.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) {
        continue;
      }

      // Check stream filtering options
      if (this.options.stdout === false && stream === 'stdout') {
        continue;
      }
      if (this.options.stderr === false && stream === 'stderr') {
        continue;
      }
      if (this.options.stdout === true && stream === 'stderr') {
        continue;
      }

      const logEntry = this.parseLogLine(line, stream);
      if (logEntry) {
        this.emit('data', logEntry);
      }
    }
  }

  /**
   * Parse a log line into a ContainerLogEntry
   */
  private parseLogLine(line: string, defaultStream: 'stdout' | 'stderr'): ContainerLogEntry | null {
    try {
      // Check if line has timestamp prefix (when timestamps option is enabled)
      let message = line;
      let timestamp: Date | undefined;
      let stream = defaultStream;

      // Docker/Podman timestamp format: 2024-01-01T12:00:00.000000000Z message
      if (this.options.timestamps) {
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
        if (timestampMatch) {
          timestamp = new Date(timestampMatch[1]);
          message = timestampMatch[2];
        }
      }

      // Check for stream prefixes in some Docker outputs
      const streamMatch = message.match(/^(stdout|stderr):\s*(.*)$/);
      if (streamMatch) {
        stream = streamMatch[1] as 'stdout' | 'stderr';
        message = streamMatch[2];
      }

      return {
        message: message.trim(),
        timestamp,
        stream,
        raw: line,
      };
    } catch (error) {
      // If parsing fails, return a basic log entry
      return {
        message: line.trim(),
        stream: defaultStream,
        raw: line,
      };
    }
  }

  /**
   * Build the logs command based on options
   */
  private buildLogsCommand(): string {
    const parts = [this.runtime, 'logs'];

    // Add follow flag
    if (this.options.follow) {
      parts.push('--follow');
    }

    // Add timestamps flag
    if (this.options.timestamps) {
      parts.push('--timestamps');
    }

    // Add since option
    if (this.options.since) {
      const since = this.formatTimestamp(this.options.since);
      if (since) {
        parts.push('--since', since);
      }
    }

    // Add until option
    if (this.options.until) {
      const until = this.formatTimestamp(this.options.until);
      if (until) {
        parts.push('--until', until);
      }
    }

    // Add tail option
    if (this.options.tail !== undefined) {
      if (this.options.tail === 'all') {
        parts.push('--tail', 'all');
      } else if (typeof this.options.tail === 'number' && this.options.tail > 0) {
        parts.push('--tail', this.options.tail.toString());
      }
    }

    // Add container ID
    parts.push(this.containerId);

    return parts.join(' ');
  }

  /**
   * Format timestamp for docker/podman logs command
   */
  private formatTimestamp(timestamp: string | number | Date): string | null {
    try {
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }

      if (typeof timestamp === 'number') {
        return new Date(timestamp).toISOString();
      }

      if (typeof timestamp === 'string') {
        // Try to parse as ISO string first
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }

        // If it's a unix timestamp string
        const unixTime = parseInt(timestamp, 10);
        if (!isNaN(unixTime)) {
          return new Date(unixTime * 1000).toISOString();
        }

        // Return as-is for relative timestamps like "1h", "30m", etc.
        return timestamp;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Stop streaming and clean up resources
   */
  end(): void {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.isStreaming = false;

    if (this.process) {
      this.process.removeAllListeners();

      if (!this.process.killed) {
        this.process.kill('SIGTERM');

        // Force kill after timeout
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 5000);
      }

      this.process = undefined;
    }

    this.emit('end');
    this.removeAllListeners();
  }

  /**
   * Check if the stream is currently active
   */
  get isActive(): boolean {
    return this.isStreaming && !this.ended;
  }

  /**
   * Async iterator implementation for convenient log consumption
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<ContainerLogEntry> {
    const entries: ContainerLogEntry[] = [];
    let resolve: ((value: IteratorResult<ContainerLogEntry>) => void) | null = null;
    let streamEnded = false;

    // Set up event handlers
    const onData = (entry: ContainerLogEntry) => {
      if (resolve) {
        resolve({ value: entry, done: false });
        resolve = null;
      } else {
        entries.push(entry);
      }
    };

    const onEnd = () => {
      streamEnded = true;
      if (resolve) {
        resolve({ value: undefined, done: true });
        resolve = null;
      }
    };

    const onError = (error: Error) => {
      streamEnded = true;
      if (resolve) {
        resolve({ value: undefined, done: true });
        resolve = null;
      }
      throw error;
    };

    this.on('data', onData);
    this.on('end', onEnd);
    this.on('error', onError);

    try {
      while (!streamEnded) {
        if (entries.length > 0) {
          yield entries.shift()!;
        } else {
          await new Promise<void>(r => {
            resolve = (result) => {
              if (result.done) {
                r();
              } else if (result.value) {
                entries.push(result.value);
                r();
              }
            };
          });
        }
      }
    } finally {
      this.off('data', onData);
      this.off('end', onEnd);
      this.off('error', onError);
      this.end();
    }
  }
}

/**
 * Default container manager instance
 */
export const containerManager = new ContainerManager();

/**
 * Convenience function to create a container with a task ID
 * @param config Container configuration
 * @param taskId Associated task ID
 * @param autoStart Whether to start the container immediately
 * @returns Container operation result
 */
export async function createTaskContainer(
  config: ContainerConfig,
  taskId: string,
  autoStart: boolean = true
): Promise<ContainerOperationResult> {
  return containerManager.createContainer({
    config,
    taskId,
    autoStart,
  });
}

/**
 * Convenience function to generate a container name for a task
 * @param taskId Task ID
 * @returns Generated container name
 */
export function generateTaskContainerName(taskId: string): string {
  return containerManager.generateContainerName(taskId);
}