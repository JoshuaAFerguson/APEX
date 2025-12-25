import { ContainerConfig, ContainerInfo, ContainerStats, ContainerStatus, ResourceLimits } from './types';
import { ContainerRuntime, ContainerRuntimeType } from './container-runtime';
import { exec } from 'child_process';
import { promisify } from 'util';

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
 * Container manager for creating and managing containerized workspaces
 * Provides high-level container operations with support for Docker and Podman
 */
export class ContainerManager {
  private runtime: ContainerRuntime;
  private defaultNamingConfig: ContainerNamingConfig;

  constructor(
    runtime?: ContainerRuntime,
    namingConfig?: Partial<ContainerNamingConfig>
  ) {
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
        return {
          success: false,
          error: 'No container runtime available. Please install Docker or Podman.',
        };
      }

      const containerName = options.nameOverride || this.generateContainerName(options.taskId);
      const command = this.buildCreateCommand(runtimeType, options.config, containerName);

      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

      if (stderr && stderr.trim()) {
        return {
          success: false,
          error: `Container creation failed: ${stderr.trim()}`,
          command,
          output: stdout,
        };
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

      return {
        success: true,
        containerId,
        containerInfo,
        command,
        output: stdout,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Container creation failed: ${errorMessage}`,
      };
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
        return {
          success: false,
          error: 'No container runtime available',
        };
      }

      const command = `${runtime} start ${containerId}`;
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

      if (stderr && stderr.trim()) {
        return {
          success: false,
          error: `Container start failed: ${stderr.trim()}`,
          command,
          output: stdout,
        };
      }

      const containerInfo = await this.getContainerInfo(containerId, runtime);

      return {
        success: true,
        containerId,
        containerInfo,
        command,
        output: stdout,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Container start failed: ${errorMessage}`,
      };
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
        return {
          success: false,
          error: 'No container runtime available',
        };
      }

      const command = `${runtime} stop --time ${timeout} ${containerId}`;
      const { stdout, stderr } = await execAsync(command, { timeout: (timeout + 10) * 1000 });

      if (stderr && stderr.trim()) {
        return {
          success: false,
          error: `Container stop failed: ${stderr.trim()}`,
          command,
          output: stdout,
        };
      }

      return {
        success: true,
        containerId,
        command,
        output: stdout,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Container stop failed: ${errorMessage}`,
      };
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
        return {
          success: false,
          error: 'No container runtime available',
        };
      }

      const forceFlag = force ? ' --force' : '';
      const command = `${runtime} rm${forceFlag} ${containerId}`;
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

      if (stderr && stderr.trim()) {
        return {
          success: false,
          error: `Container removal failed: ${stderr.trim()}`,
          command,
          output: stdout,
        };
      }

      return {
        success: true,
        containerId,
        command,
        output: stdout,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Container removal failed: ${errorMessage}`,
      };
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