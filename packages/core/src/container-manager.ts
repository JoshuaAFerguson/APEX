import { ContainerConfig, ContainerInfo, ContainerStats, ContainerStatus, ResourceLimits, ContainerLogStreamOptions, ContainerLogEntry, ContainerDiedEventData } from './types';
import { ContainerRuntime, ContainerRuntimeType } from './container-runtime';
import { ImageBuilder, ImageBuildConfig, ImageBuildResult } from './image-builder';
import { resolveExecutable } from './shell-utils';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { EventEmitter as TypedEventEmitter } from 'eventemitter3';
import * as path from 'path';
import * as fs from 'fs/promises';

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
 * Options for executing commands in containers
 */
export interface ExecCommandOptions {
  /** Working directory inside the container to execute the command */
  workingDir?: string;
  /** User to run the command as (e.g., "1000:1000", "root", "node") */
  user?: string;
  /** Timeout in milliseconds for command execution (default: 30000ms) */
  timeout?: number;
  /** Environment variables to set for the command execution */
  environment?: Record<string, string>;
  /** Whether to allocate a TTY for the command (default: false) */
  tty?: boolean;
  /** Whether to keep the container's stdin open (default: false) */
  interactive?: boolean;
  /** Whether to run the command as privileged (default: false) */
  privileged?: boolean;
}

/**
 * Result of executing a command in a container
 */
export interface ExecCommandResult {
  /** Whether the command execution was successful */
  success: boolean;
  /** Standard output from the command */
  stdout: string;
  /** Standard error from the command */
  stderr: string;
  /** Exit code from the command (0 for success) */
  exitCode: number;
  /** Error message if execution failed */
  error?: string;
  /** Full command that was executed */
  command?: string;
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
 * Event data for container lifecycle events (internal to ContainerManager)
 */
export interface ContainerManagerEvent {
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
export interface ContainerOperationEvent extends ContainerManagerEvent {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Command that was executed */
  command?: string;
}

/**
 * Docker event data parsed from docker events stream
 */
export interface DockerEventData {
  /** Event status (e.g., 'die', 'start', 'stop') */
  status: string;
  /** Container ID */
  id: string;
  /** Container name (without leading slash) */
  name?: string;
  /** Image name */
  image?: string;
  /** Event timestamp as Unix timestamp */
  time: number;
  /** Exit code for die events */
  exitCode?: number;
  /** Additional attributes */
  attributes?: Record<string, string>;
}

/**
 * Options for Docker events monitoring
 */
export interface DockerEventsMonitorOptions {
  /** Only monitor events for containers with this name prefix */
  namePrefix?: string;
  /** Only monitor events for containers with specific labels */
  labelFilters?: Record<string, string>;
  /** Specific event types to monitor (default: ['die']) */
  eventTypes?: string[];
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
  /** Emitted when a container dies unexpectedly */
  'container:died': (event: ContainerManagerEvent & { exitCode: number; signal?: string; oomKilled?: boolean }) => void;
  /** Emitted when a container is removed */
  'container:removed': (event: ContainerOperationEvent) => void;
  /** Emitted for general container lifecycle events */
  'container:lifecycle': (event: ContainerOperationEvent, operation: 'created' | 'started' | 'stopped' | 'removed' | 'died') => void;
}

/**
 * Container manager for creating and managing containerized workspaces
 * Provides high-level container operations with support for Docker and Podman
 * Extends EventEmitter3 to emit typed lifecycle events
 */
export class ContainerManager extends TypedEventEmitter<ContainerManagerEvents> {
  private runtime: ContainerRuntime;
  private defaultNamingConfig: ContainerNamingConfig;
  private imageBuilder?: ImageBuilder;

  // Docker events monitoring properties
  private eventsMonitorProcess?: ChildProcess;
  private isMonitoring: boolean = false;
  private monitorOptions: DockerEventsMonitorOptions = {
    namePrefix: 'apex',
    eventTypes: ['die', 'start', 'stop', 'create', 'destroy']
  };

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
   * Build an image if dockerfile is specified and image is missing or stale
   * @param config Container configuration
   * @param projectRoot Project root directory for resolving relative paths
   * @returns Image tag to use for container creation
   */
  private async buildImageIfNeeded(config: ContainerConfig, projectRoot?: string): Promise<string> {
    // If no dockerfile specified, return the original image
    if (!config.dockerfile) {
      return config.image;
    }

    // Initialize ImageBuilder if needed
    if (!this.imageBuilder) {
      const resolvedProjectRoot = projectRoot || process.cwd();
      this.imageBuilder = new ImageBuilder(resolvedProjectRoot);
      await this.imageBuilder.initialize();
    }

    // Check if Dockerfile exists
    const dockerfilePath = path.resolve(
      projectRoot || process.cwd(),
      config.buildContext || '.',
      config.dockerfile
    );

    try {
      await fs.access(dockerfilePath);
    } catch (error) {
      // Dockerfile doesn't exist, fall back to config.image
      return config.image;
    }

    // Build image configuration
    const buildConfig: ImageBuildConfig = {
      dockerfilePath: config.dockerfile,
      buildContext: config.buildContext,
      imageTag: config.imageTag,
    };

    try {
      const buildResult: ImageBuildResult = await this.imageBuilder.buildImage(buildConfig);

      if (buildResult.success && buildResult.imageInfo) {
        // Return the built image tag
        return buildResult.imageInfo.tag;
      } else {
        // Build failed, fall back to config.image
        console.warn(`Image build failed: ${buildResult.error}. Falling back to ${config.image}`);
        return config.image;
      }
    } catch (error) {
      // Build error, fall back to config.image
      console.warn(`Image build error: ${error}. Falling back to ${config.image}`);
      return config.image;
    }
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

      // Build image if dockerfile is specified
      const imageToUse = await this.buildImageIfNeeded(options.config);

      // Create modified config with the resolved image
      const configWithResolvedImage = {
        ...options.config,
        image: imageToUse,
      };

      const containerName = options.nameOverride || this.generateContainerName(options.taskId);
      const command = this.buildCreateCommand(runtimeType, configWithResolvedImage, containerName);

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

      const containerInfo = await this.getContainerInfo(containerId, runtimeType) ?? undefined;

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

      const containerInfo = await this.getContainerInfo(containerId, runtime) ?? undefined;

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
   * Execute a command inside a running container
   * @param containerId Container ID or name
   * @param command Command string or array of command parts to execute
   * @param options Execution options (working directory, user, timeout, etc.)
   * @param runtimeType Optional runtime type (auto-detected if not provided)
   * @returns Result of command execution with stdout, stderr, exit code
   */
  async execCommand(
    containerId: string,
    command: string | string[],
    options: ExecCommandOptions = {},
    runtimeType?: ContainerRuntimeType
  ): Promise<ExecCommandResult> {
    try {
      const runtime = runtimeType || await this.runtime.getBestRuntime();

      if (runtime === 'none') {
        return {
          success: false,
          stdout: '',
          stderr: '',
          exitCode: 1,
          error: 'No container runtime available',
        };
      }

      const execCommand = this.buildExecCommand(runtime, containerId, command, options);
      const timeout = options.timeout || 30000; // Default 30 seconds

      try {
        const { stdout, stderr } = await execAsync(execCommand, { timeout });

        return {
          success: true,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: 0,
          command: execCommand,
        };
      } catch (error: any) {
        // Check if this is a timeout error
        if (error.code === 'ETIMEDOUT') {
          return {
            success: false,
            stdout: '',
            stderr: '',
            exitCode: 124, // Standard timeout exit code
            error: `Command timed out after ${timeout}ms`,
            command: execCommand,
          };
        }

        // Check if this is a command execution error with exit code
        if (error.code && typeof error.code === 'number') {
          return {
            success: false,
            stdout: error.stdout || '',
            stderr: error.stderr || '',
            exitCode: error.code,
            command: execCommand,
          };
        }

        // Generic error
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          stdout: error.stdout || '',
          stderr: error.stderr || errorMessage,
          exitCode: 1,
          error: `Command execution failed: ${errorMessage}`,
          command: execCommand,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        stdout: '',
        stderr: '',
        exitCode: 1,
        error: `Failed to execute command: ${errorMessage}`,
      };
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
  // Docker Events Monitoring
  // ============================================================================

  /**
   * Start monitoring Docker/Podman events for container lifecycle changes
   * @param options Optional monitoring configuration
   * @returns Promise that resolves when monitoring starts
   */
  async startEventsMonitoring(options?: Partial<DockerEventsMonitorOptions>): Promise<void> {
    if (this.isMonitoring) {
      return; // Already monitoring
    }

    const runtime = await this.runtime.getBestRuntime();
    if (runtime === 'none') {
      throw new Error('No container runtime available for events monitoring');
    }

    // Merge provided options with defaults
    this.monitorOptions = {
      ...this.monitorOptions,
      ...options
    };

    try {
      await this.startDockerEventsProcess(runtime);
      this.isMonitoring = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start Docker events monitoring: ${errorMessage}`);
    }
  }

  /**
   * Stop monitoring Docker/Podman events
   * @returns Promise that resolves when monitoring stops
   */
  async stopEventsMonitoring(): Promise<void> {
    if (!this.isMonitoring || !this.eventsMonitorProcess) {
      return;
    }

    this.isMonitoring = false;

    try {
      // Gracefully terminate the events process
      if (!this.eventsMonitorProcess.killed) {
        this.eventsMonitorProcess.kill('SIGTERM');

        // Wait a bit for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (this.eventsMonitorProcess && !this.eventsMonitorProcess.killed) {
              this.eventsMonitorProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          this.eventsMonitorProcess?.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
    } catch (error) {
      console.warn('Error stopping Docker events monitoring:', error);
    } finally {
      this.eventsMonitorProcess = undefined;
    }
  }

  /**
   * Check if Docker events monitoring is currently active
   * @returns True if monitoring is active
   */
  isEventsMonitoringActive(): boolean {
    return this.isMonitoring && !!this.eventsMonitorProcess && !this.eventsMonitorProcess.killed;
  }

  /**
   * Get current monitoring options
   * @returns Current monitoring configuration
   */
  getMonitoringOptions(): DockerEventsMonitorOptions {
    return { ...this.monitorOptions };
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
   * Start the Docker events monitoring process
   * @param runtime Container runtime type
   */
  private async startDockerEventsProcess(runtime: ContainerRuntimeType): Promise<void> {
    const command = this.buildEventsCommand(runtime);
    const args = command.split(' ').slice(1); // Remove the runtime command

    this.eventsMonitorProcess = spawn(resolveExecutable(runtime), args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Process stdout for events data
    if (this.eventsMonitorProcess.stdout) {
      this.eventsMonitorProcess.stdout.on('data', (chunk: Buffer) => {
        this.processEventsData(chunk.toString('utf8'));
      });
    }

    // Log errors from stderr
    if (this.eventsMonitorProcess.stderr) {
      this.eventsMonitorProcess.stderr.on('data', (chunk: Buffer) => {
        console.warn(`Docker events monitoring stderr: ${chunk.toString('utf8').trim()}`);
      });
    }

    // Handle process events
    this.eventsMonitorProcess.on('error', (error) => {
      console.error('Docker events monitoring process error:', error);
      this.isMonitoring = false;
    });

    this.eventsMonitorProcess.on('exit', (code, signal) => {
      console.log(`Docker events monitoring process exited with code ${code}, signal ${signal}`);
      this.isMonitoring = false;
      this.eventsMonitorProcess = undefined;
    });

    // Give the process a moment to start
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!this.eventsMonitorProcess || this.eventsMonitorProcess.killed) {
      throw new Error('Failed to start Docker events monitoring process');
    }
  }

  /**
   * Build the Docker events command with filters
   * @param runtime Container runtime type
   * @returns Complete command string
   */
  private buildEventsCommand(runtime: ContainerRuntimeType): string {
    const parts = [runtime, 'events', '--format', '{{json .}}'];

    // Add event type filters
    if (this.monitorOptions.eventTypes && this.monitorOptions.eventTypes.length > 0) {
      for (const eventType of this.monitorOptions.eventTypes) {
        parts.push('--filter', `event=${eventType}`);
      }
    }

    // Add container name prefix filter
    if (this.monitorOptions.namePrefix) {
      parts.push('--filter', `container=${this.monitorOptions.namePrefix}-*`);
    }

    // Add label filters
    if (this.monitorOptions.labelFilters) {
      for (const [key, value] of Object.entries(this.monitorOptions.labelFilters)) {
        parts.push('--filter', `label=${key}=${value}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Process raw events data from Docker events stream
   * @param data Raw text data from events stream
   */
  private processEventsData(data: string): void {
    const lines = data.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const eventData = this.parseDockerEvent(line);
        if (eventData) {
          this.handleDockerEvent(eventData);
        }
      } catch (error) {
        console.warn('Error parsing Docker event:', error, 'Raw line:', line);
      }
    }
  }

  /**
   * Parse a single Docker event JSON line
   * @param line JSON line from Docker events
   * @returns Parsed event data or null if invalid
   */
  private parseDockerEvent(line: string): DockerEventData | null {
    try {
      const rawEvent = JSON.parse(line);

      // Extract relevant data from Docker event format
      const eventData: DockerEventData = {
        status: rawEvent.status || rawEvent.Action,
        id: rawEvent.id || rawEvent.ID,
        name: rawEvent.Actor?.Attributes?.name,
        image: rawEvent.Actor?.Attributes?.image || rawEvent.from,
        time: rawEvent.time || rawEvent.timeNano ? Math.floor(rawEvent.timeNano / 1000000) : Date.now(),
        exitCode: rawEvent.Actor?.Attributes?.exitCode ? parseInt(rawEvent.Actor.Attributes.exitCode, 10) : undefined,
        attributes: rawEvent.Actor?.Attributes || {}
      };

      // Filter for APEX containers if name prefix is specified
      if (this.monitorOptions.namePrefix && eventData.name) {
        if (!eventData.name.startsWith(this.monitorOptions.namePrefix)) {
          return null; // Skip non-APEX containers
        }
      }

      return eventData;
    } catch (error) {
      return null;
    }
  }

  /**
   * Handle a processed Docker event
   * @param eventData Parsed event data
   */
  private async handleDockerEvent(eventData: DockerEventData): Promise<void> {
    if (eventData.status === 'die') {
      await this.handleContainerDiedEvent(eventData);
    }
    // We can extend this to handle other event types in the future
  }

  /**
   * Handle container died event and emit appropriate APEX event
   * @param eventData Docker event data for container death
   */
  private async handleContainerDiedEvent(eventData: DockerEventData): Promise<void> {
    try {
      // Get container info to extract task ID and additional details
      const containerInfo = await this.getContainerInfo(eventData.id);

      // Extract task ID from container name if possible
      let taskId: string | undefined;
      if (eventData.name || containerInfo?.name) {
        const containerName = eventData.name || containerInfo?.name || '';
        // Try to extract task ID from APEX container naming convention
        // Expected format: apex-{taskId} or apex-{taskId}-{timestamp}
        const match = containerName.match(/^apex-([^-]+)/);
        if (match) {
          taskId = match[1];
        }
      }

      // Determine if this was an OOM kill (exit code 137 is typical for SIGKILL/OOM)
      const oomKilled = eventData.exitCode === 137 ||
                       eventData.attributes?.oomkilled === 'true' ||
                       eventData.attributes?.reason === 'oom';

      // Extract signal information
      let signal: string | undefined;
      if (eventData.attributes?.signal) {
        signal = eventData.attributes.signal;
      } else if (eventData.exitCode === 137) {
        signal = 'SIGKILL'; // Most likely signal for exit code 137
      }

      const containerEvent: ContainerManagerEvent & { exitCode: number; signal?: string; oomKilled?: boolean } = {
        containerId: eventData.id,
        taskId,
        containerInfo: containerInfo ?? undefined,
        timestamp: new Date(eventData.time),
        exitCode: eventData.exitCode || 1,
        signal,
        oomKilled
      };

      // Emit container:died event
      this.emit('container:died', containerEvent);

      // Emit general lifecycle event with ContainerOperationEvent shape
      const lifecycleEvent: ContainerOperationEvent = {
        containerId: containerEvent.containerId,
        taskId: containerEvent.taskId,
        containerInfo: containerEvent.containerInfo,
        timestamp: containerEvent.timestamp,
        success: false, // Container died, so operation was not successful
        error: `Container died with exit code ${containerEvent.exitCode}${signal ? ` (signal: ${signal})` : ''}`,
      };
      this.emit('container:lifecycle', lifecycleEvent, 'died');

    } catch (error) {
      console.warn('Error handling container died event:', error);
    }
  }

  /**
   * Build the exec command for running commands in containers
   * @param runtimeType Container runtime type
   * @param containerId Container ID or name
   * @param command Command to execute (string or array)
   * @param options Execution options
   * @returns Complete exec command string
   */
  private buildExecCommand(
    runtimeType: ContainerRuntimeType,
    containerId: string,
    command: string | string[],
    options: ExecCommandOptions
  ): string {
    const parts = [runtimeType, 'exec'];

    // Add options flags
    if (options.tty) {
      parts.push('--tty');
    }

    if (options.interactive) {
      parts.push('--interactive');
    }

    if (options.privileged) {
      parts.push('--privileged');
    }

    // Add working directory
    if (options.workingDir) {
      parts.push('--workdir', options.workingDir);
    }

    // Add user
    if (options.user) {
      parts.push('--user', options.user);
    }

    // Add environment variables
    if (options.environment) {
      for (const [key, value] of Object.entries(options.environment)) {
        parts.push('--env', `${key}=${value}`);
      }
    }

    // Add container ID
    parts.push(containerId);

    // Add command (handle both string and array formats)
    if (Array.isArray(command)) {
      parts.push(...command);
    } else {
      // For string commands, we need to handle shell parsing
      // Split by spaces but respect quotes
      const commandParts = this.parseCommandString(command);
      parts.push(...commandParts);
    }

    return parts.map(part => this.escapeShellArg(part)).join(' ');
  }

  /**
   * Parse a command string into individual arguments
   * Handles quoted strings and escapes
   * @param command Command string to parse
   * @returns Array of command arguments
   */
  private parseCommandString(command: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        continue;
      }

      if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        continue;
      }

      if (!inQuotes && /\s/.test(char)) {
        if (current) {
          args.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current) {
      args.push(current);
    }

    return args;
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