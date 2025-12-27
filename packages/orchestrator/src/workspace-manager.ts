import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join, basename, resolve } from 'path';
import { EventEmitter } from 'eventemitter3';
import {
  WorkspaceConfig,
  Task,
  containerRuntime,
  ContainerRuntimeType,
  ContainerManager,
  ContainerHealthMonitor,
  DependencyDetector,
  PackageManagerType,
  ContainerConfig,
  ContainerDefaults
} from '@apexcli/core';

const execAsync = promisify(exec);

export interface WorkspaceManagerOptions {
  projectPath: string;
  defaultStrategy: WorkspaceConfig['strategy'];
  containerDefaults?: ContainerDefaults;
}

export interface WorkspaceInfo {
  taskId: string;
  config: WorkspaceConfig;
  workspacePath: string;
  status: 'active' | 'cleanup-pending' | 'cleaned';
  createdAt: Date;
  lastAccessed: Date;
  /**
   * Container ID for container-based workspaces
   * Undefined for other workspace strategies
   */
  containerId?: string;
  /**
   * Warnings collected during workspace creation
   * Used for graceful degradation scenarios
   */
  warnings?: string[];
  /**
   * Indicates if workspace creation was successful
   * (can be true even with warnings)
   */
  success?: boolean;
}

/**
 * Event data for dependency installation start
 */
export interface DependencyInstallEventData {
  taskId: string;
  containerId: string;
  workspacePath: string;
  installCommand: string;
  packageManager: PackageManagerType;
  language: 'javascript' | 'python' | 'rust';
  timestamp: Date;
}

/**
 * Event data for dependency installation completion
 */
export interface DependencyInstallCompletedEventData extends DependencyInstallEventData {
  success: boolean;
  duration: number;  // milliseconds
  stdout?: string;
  stderr?: string;
  exitCode: number;
  error?: string;
}

/**
 * Manages isolated workspaces for task execution using various strategies
 */
export interface WorkspaceManagerEvents {
  'workspace-created': (taskId: string, workspacePath: string) => void;
  'workspace-cleaned': (taskId: string) => void;
  'dependency-install-started': (data: DependencyInstallEventData) => void;
  'dependency-install-completed': (data: DependencyInstallCompletedEventData) => void;
}

export class WorkspaceManager extends EventEmitter<WorkspaceManagerEvents> {
  private projectPath: string;
  private defaultStrategy: WorkspaceConfig['strategy'];
  private containerDefaults?: ContainerDefaults;
  private workspacesDir: string;
  private activeWorkspaces: Map<string, WorkspaceInfo> = new Map();
  private containerRuntimeType: ContainerRuntimeType | null = null;
  private containerManager: ContainerManager;
  private healthMonitor: ContainerHealthMonitor;
  private dependencyDetector: DependencyDetector;

  constructor(options: WorkspaceManagerOptions) {
    super();
    this.projectPath = options.projectPath;
    this.defaultStrategy = options.defaultStrategy;
    this.containerDefaults = options.containerDefaults;
    this.workspacesDir = join(this.projectPath, '.apex', 'workspaces');

    // Initialize container management
    this.containerManager = new ContainerManager();
    this.healthMonitor = new ContainerHealthMonitor(this.containerManager, {
      containerPrefix: 'apex-task',
      autoStart: false, // We'll start it when we need it
    });

    // Initialize dependency detector
    this.dependencyDetector = new DependencyDetector();
  }

  /**
   * Initialize workspace manager
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.workspacesDir, { recursive: true });
    await this.loadActiveWorkspaces();

    // Detect available container runtime for container workspaces
    this.containerRuntimeType = await containerRuntime.getBestRuntime();

    // Start container health monitoring if containers are supported
    if (this.containerRuntimeType !== 'none') {
      try {
        await this.healthMonitor.startMonitoring();

        // Start container events monitoring to capture lifecycle events
        await this.containerManager.startEventsMonitoring({
          namePrefix: 'apex',
          eventTypes: ['die', 'start', 'stop', 'create', 'destroy']
        });
      } catch (error) {
        console.warn('Failed to start container monitoring:', error);
      }
    }
  }

  /**
   * Create a new isolated workspace for a task
   */
  async createWorkspace(task: Task): Promise<WorkspaceInfo> {
    const config = task.workspace || {
      strategy: this.defaultStrategy,
      cleanup: true,
    };

    const workspaceInfo: WorkspaceInfo = {
      taskId: task.id,
      config,
      workspacePath: '',
      status: 'active',
      createdAt: new Date(),
      lastAccessed: new Date(),
      warnings: [],
      success: true,
    };

    switch (config.strategy) {
      case 'worktree':
        workspaceInfo.workspacePath = await this.createWorktreeWorkspace(task);
        break;
      case 'container':
        await this.createContainerWorkspace(task, config, workspaceInfo);
        break;
      case 'directory':
        workspaceInfo.workspacePath = await this.createDirectoryWorkspace(task);
        break;
      case 'none':
        workspaceInfo.workspacePath = this.projectPath;
        break;
      default:
        throw new Error(`Unknown workspace strategy: ${config.strategy}`);
    }

    this.activeWorkspaces.set(task.id, workspaceInfo);
    await this.saveWorkspaceInfo(workspaceInfo);
    this.emit('workspace-created', task.id, workspaceInfo.workspacePath);

    return workspaceInfo;
  }

  /**
   * Get workspace information for a task
   */
  getWorkspace(taskId: string): WorkspaceInfo | null {
    return this.activeWorkspaces.get(taskId) || null;
  }

  /**
   * Update workspace access time
   */
  async accessWorkspace(taskId: string): Promise<void> {
    const workspace = this.activeWorkspaces.get(taskId);
    if (workspace) {
      workspace.lastAccessed = new Date();
      await this.saveWorkspaceInfo(workspace);
    }
  }

  /**
   * Clean up a workspace after task completion
   */
  async cleanupWorkspace(taskId: string): Promise<void> {
    const workspace = this.activeWorkspaces.get(taskId);
    if (!workspace) {
      return;
    }

    if (!workspace.config.cleanup) {
      // Mark as cleanup-pending but don't actually clean
      workspace.status = 'cleanup-pending';
      await this.saveWorkspaceInfo(workspace);
      return;
    }

    try {
      switch (workspace.config.strategy) {
        case 'worktree':
          await this.cleanupWorktree(workspace);
          break;
        case 'container':
          await this.cleanupContainer(workspace);
          break;
        case 'directory':
          await this.cleanupDirectory(workspace);
          break;
        case 'none':
          // Nothing to clean up
          break;
      }

      workspace.status = 'cleaned';
      await this.saveWorkspaceInfo(workspace);
      this.activeWorkspaces.delete(taskId);
      this.emit('workspace-cleaned', taskId);
    } catch (error) {
      console.warn(`Failed to cleanup workspace for task ${taskId}:`, error);
      workspace.status = 'cleanup-pending';
      await this.saveWorkspaceInfo(workspace);
    }
  }

  /**
   * Clean up all old workspaces
   */
  async cleanupOldWorkspaces(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();

    for (const [taskId, workspace] of this.activeWorkspaces.entries()) {
      const age = now - workspace.lastAccessed.getTime();

      if (age > maxAge && workspace.status === 'active') {
        await this.cleanupWorkspace(taskId);
      }
    }
  }

  /**
   * Get the detected container runtime type
   */
  getContainerRuntime(): ContainerRuntimeType | null {
    return this.containerRuntimeType;
  }

  /**
   * Check if container workspaces are supported
   */
  supportsContainerWorkspaces(): boolean {
    return this.containerRuntimeType !== null && this.containerRuntimeType !== 'none';
  }

  /**
   * Get the container health monitor instance
   */
  getHealthMonitor(): ContainerHealthMonitor {
    return this.healthMonitor;
  }

  /**
   * Get the container manager instance
   */
  getContainerManager(): ContainerManager {
    return this.containerManager;
  }

  /**
   * Get the container ID for a specific task
   * Returns the active container ID if the task uses a container workspace
   * @param taskId - The task identifier
   * @returns The container ID or undefined if not using a container workspace
   */
  getContainerIdForTask(taskId: string): string | undefined {
    const workspace = this.activeWorkspaces.get(taskId);
    if (!workspace || workspace.config.strategy !== 'container') {
      return undefined;
    }
    return workspace.containerId;
  }

  /**
   * Get container health status for a specific task
   */
  async getContainerHealth(taskId: string): Promise<any> {
    const containerName = `apex-task-${taskId}`;
    const containers = await this.containerManager.listApexContainers(this.containerRuntimeType!);
    const container = containers.find(c => c.name === containerName);

    if (container) {
      return this.healthMonitor.getContainerHealth(container.id);
    }

    return null;
  }

  /**
   * Get workspace statistics
   */
  async getWorkspaceStats(): Promise<{
    activeCount: number;
    cleanupPendingCount: number;
    totalDiskUsage: number;
    workspacesByStrategy: Record<string, number>;
    oldestWorkspace?: WorkspaceInfo;
    containerHealthStats?: any;
  }> {
    let activeCount = 0;
    let cleanupPendingCount = 0;
    let totalDiskUsage = 0;
    const workspacesByStrategy: Record<string, number> = {};
    let oldestWorkspace: WorkspaceInfo | undefined;

    for (const workspace of this.activeWorkspaces.values()) {
      if (workspace.status === 'active') {
        activeCount++;
      } else if (workspace.status === 'cleanup-pending') {
        cleanupPendingCount++;
      }

      workspacesByStrategy[workspace.config.strategy] =
        (workspacesByStrategy[workspace.config.strategy] || 0) + 1;

      if (!oldestWorkspace || workspace.createdAt < oldestWorkspace.createdAt) {
        oldestWorkspace = workspace;
      }

      // Calculate disk usage (approximate)
      try {
        if (workspace.workspacePath && workspace.workspacePath !== this.projectPath) {
          const { stdout } = await execAsync(`du -s "${workspace.workspacePath}" 2>/dev/null || echo "0"`);
          const sizeKB = parseInt(stdout.split('\t')[0]) || 0;
          totalDiskUsage += sizeKB * 1024; // Convert to bytes
        }
      } catch {
        // Ignore errors in disk usage calculation
      }
    }

    // Include container health statistics
    let containerHealthStats;
    try {
      containerHealthStats = this.healthMonitor.getStats();
    } catch (error) {
      console.warn('Failed to get container health stats:', error);
    }

    return {
      activeCount,
      cleanupPendingCount,
      totalDiskUsage,
      workspacesByStrategy,
      oldestWorkspace,
      containerHealthStats,
    };
  }

  // ============================================================================
  // Git Worktree Implementation
  // ============================================================================

  private async createWorktreeWorkspace(task: Task): Promise<string> {
    const branchName = task.branchName || `apex-${task.id}`;
    const workspacePath = join(this.workspacesDir, `worktree-${task.id}`);

    try {
      // Create new worktree
      await execAsync(`git worktree add "${workspacePath}" -b "${branchName}"`);

      return workspacePath;
    } catch (error) {
      throw new Error(`Failed to create git worktree: ${error}`);
    }
  }

  private async cleanupWorktree(workspace: WorkspaceInfo): Promise<void> {
    try {
      // Remove worktree
      await execAsync(`git worktree remove "${workspace.workspacePath}" --force`);
    } catch (error) {
      console.warn(`Failed to remove worktree ${workspace.workspacePath}:`, error);
      // Try manual cleanup
      await fs.rm(workspace.workspacePath, { recursive: true, force: true });
    }
  }

  // ============================================================================
  // Container Implementation
  // ============================================================================

  private async createContainerWorkspace(task: Task, config: WorkspaceConfig, workspaceInfo: WorkspaceInfo): Promise<void> {
    if (!config.container) {
      throw new Error('Container configuration required for container strategy');
    }

    if (!this.containerRuntimeType || this.containerRuntimeType === 'none') {
      throw new Error('No container runtime available (Docker or Podman required)');
    }

    const workspacePath = join(this.workspacesDir, `container-${task.id}`);

    // Create local workspace directory for container volumes
    await fs.mkdir(workspacePath, { recursive: true });

    try {
      // Check for project-specific Dockerfile
      const dockerfilePath = join(this.projectPath, '.apex', 'Dockerfile');
      const hasProjectDockerfile = await this.fileExists(dockerfilePath);

      // Merge global container defaults with task-specific config
      const mergedContainerConfig: ContainerConfig = {
        // Start with global defaults (lowest priority)
        ...this.containerDefaults,
        // Task-specific overrides (highest priority)
        ...config.container,
        // Deep merge for nested objects
        resourceLimits: {
          ...this.containerDefaults?.resourceLimits,
          ...config.container?.resourceLimits,
        },
        environment: {
          ...this.containerDefaults?.environment,
          ...config.container?.environment,
        },
        // Use project Dockerfile if it exists
        ...(hasProjectDockerfile && {
          dockerfile: '.apex/Dockerfile',
          buildContext: this.projectPath,
        }),
        // Required fields with fallback hierarchy
        image: config.container.image || this.containerDefaults?.image || 'node:20-alpine',
        networkMode: config.container.networkMode || this.containerDefaults?.networkMode || 'bridge',
        autoRemove: config.container.autoRemove ?? this.containerDefaults?.autoRemove ?? true,
        volumes: {
          [this.projectPath]: '/workspace',
          ...config.container.volumes,
        },
        workingDir: config.container.workingDir || '/workspace',
        labels: {
          'apex.task-id': task.id,
          'apex.workspace-type': 'container',
          ...config.container.labels,
        },
      };

      // Create and start container using ContainerManager
      const result = await this.containerManager.createContainer({
        config: mergedContainerConfig,
        taskId: task.id,
        autoStart: true,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create container');
      }

      // Store workspace path and container ID in workspace info
      workspaceInfo.workspacePath = workspacePath;
      workspaceInfo.containerId = result.containerId;

      // Install dependencies after container starts
      if (result.containerId) {
        await this.installDependencies(
          task,
          result.containerId,
          workspacePath,
          mergedContainerConfig,
          workspaceInfo
        );
      }
    } catch (error) {
      throw new Error(`Failed to create container workspace: ${error}`);
    }
  }

  private async cleanupContainer(workspace: WorkspaceInfo): Promise<void> {
    const containerName = `apex-task-${workspace.taskId}`;

    try {
      // Get container info to find the container ID
      const containers = await this.containerManager.listApexContainers(this.containerRuntimeType!);
      const container = containers.find(c => c.name === containerName);

      if (container) {
        // Stop and remove container using ContainerManager
        await this.containerManager.stopContainer(container.id, this.containerRuntimeType!);
        await this.containerManager.removeContainer(container.id, this.containerRuntimeType!, true);
      }

      // Remove local workspace directory
      await fs.rm(workspace.workspacePath, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup container workspace:`, error);
    }
  }

  // ============================================================================
  // Directory Copy Implementation
  // ============================================================================

  private async createDirectoryWorkspace(task: Task): Promise<string> {
    const workspacePath = join(this.workspacesDir, `directory-${task.id}`);

    try {
      // Copy entire project to workspace directory
      await fs.mkdir(workspacePath, { recursive: true });

      // Use cp command for efficient copying
      await execAsync(`cp -r "${this.projectPath}/." "${workspacePath}"`);

      // Remove .git directory to avoid confusion (optional)
      await fs.rm(join(workspacePath, '.git'), { recursive: true, force: true });

      return workspacePath;
    } catch (error) {
      throw new Error(`Failed to create directory workspace: ${error}`);
    }
  }

  private async cleanupDirectory(workspace: WorkspaceInfo): Promise<void> {
    try {
      await fs.rm(workspace.workspacePath, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup directory workspace:`, error);
    }
  }

  // ============================================================================
  // Dependency Installation
  // ============================================================================

  /**
   * Install dependencies inside a container after it starts
   * @param task - The task associated with this workspace
   * @param containerId - The container ID where dependencies should be installed
   * @param workspacePath - Local workspace path
   * @param containerConfig - Container configuration including install settings
   */
  private async installDependencies(
    task: Task,
    containerId: string,
    workspacePath: string,
    containerConfig: ContainerConfig,
    workspaceInfo: WorkspaceInfo
  ): Promise<void> {
    // Check if auto-install is disabled
    if (containerConfig.autoDependencyInstall === false) {
      return;
    }

    // Determine install command
    let installCommand: string | null = null;
    let packageManagerType: PackageManagerType = 'unknown';
    let language: 'javascript' | 'python' | 'rust' | undefined;

    if (containerConfig.customInstallCommand) {
      // Use custom command if provided
      installCommand = containerConfig.customInstallCommand;
      packageManagerType = 'unknown';
    } else {
      // Auto-detect using DependencyDetector
      const detection = await this.dependencyDetector.detectPackageManagers(this.projectPath);

      if (detection.primaryManager?.installCommand) {
        installCommand = detection.primaryManager.installCommand;
        packageManagerType = detection.primaryManager.type;
        language = detection.primaryManager.language;
      }
    }

    // No dependencies detected or disabled
    if (!installCommand) {
      return;
    }

    const startTime = Date.now();
    const workingDir = containerConfig.workingDir || '/workspace';
    const timeout = containerConfig.installTimeout || 300000; // Default 5 minutes

    // Emit started event
    const startedData: DependencyInstallEventData = {
      taskId: task.id,
      containerId,
      workspacePath,
      installCommand,
      packageManager: packageManagerType,
      language: language || 'javascript',
      timestamp: new Date(),
    };

    // Get retry configuration
    const maxRetries = containerConfig.installRetries || 0;
    let attempt = 0;
    let lastError = '';
    let finalResult: any = null;

    // Emit initial started event
    this.emit('dependency-install-started', startedData);

    while (attempt <= maxRetries) {
      try {
        const attemptStartTime = Date.now();

        // Apply recovery strategies based on previous failures
        let currentCommand = installCommand;
        if (attempt > 0) {
          currentCommand = await this.applyRecoveryStrategy(
            installCommand,
            packageManagerType,
            lastError,
            attempt
          );

          // Emit recovery event
          this.emit('dependency-install-recovery', {
            taskId: task.id,
            attempt: attempt + 1,
            previousError: lastError,
            strategy: this.getRecoveryStrategyName(lastError, packageManagerType),
            command: currentCommand
          });

          // Apply exponential backoff delay
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // Execute install command inside container
        const result = await this.containerManager.execCommand(
          containerId,
          currentCommand,
          {
            workingDir,
            timeout,
          },
          this.containerRuntimeType!
        );

        const duration = Date.now() - attemptStartTime;
        finalResult = result;

        // Log output
        if (result.stdout) {
          console.log(`[${task.id}] Dependency install stdout (attempt ${attempt + 1}):\n${result.stdout}`);
        }
        if (result.stderr) {
          console.warn(`[${task.id}] Dependency install stderr (attempt ${attempt + 1}):\n${result.stderr}`);
        }

        // Emit completed event for this attempt
        const completedData: DependencyInstallCompletedEventData = {
          ...startedData,
          success: result.success,
          duration,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          error: result.error,
        };
        this.emit('dependency-install-completed', completedData);

        if (result.success) {
          console.log(`[${task.id}] Dependency installation succeeded on attempt ${attempt + 1}`);
          return; // Success! Exit retry loop
        } else {
          lastError = result.stderr || result.error || `Exit code: ${result.exitCode}`;
          console.warn(`[${task.id}] Dependency installation failed on attempt ${attempt + 1}: ${lastError}`);
        }

      } catch (error) {
        const duration = Date.now() - attemptStartTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        lastError = errorMessage;

        console.error(`[${task.id}] Dependency installation error on attempt ${attempt + 1}: ${errorMessage}`);

        // Emit failed completion event for this attempt
        const completedData: DependencyInstallCompletedEventData = {
          ...startedData,
          success: false,
          duration,
          exitCode: 1,
          error: errorMessage,
        };
        this.emit('dependency-install-completed', completedData);
      }

      attempt++;
    }

    // All retry attempts failed - graceful degradation
    const suggestionMessage = this.getErrorSuggestion(lastError);
    const warningMessage = `Dependency installation failed after ${maxRetries + 1} attempts. ${suggestionMessage}`;

    if (workspaceInfo.warnings) {
      workspaceInfo.warnings.push(warningMessage);
    }

    // Emit a final completion event with suggestion for graceful degradation tests
    const finalCompletedData: DependencyInstallCompletedEventData = {
      ...startedData,
      success: false,
      duration: Date.now() - startTime,
      exitCode: 1,
      error: suggestionMessage, // Include suggestion in error for tests
      stderr: lastError
    };
    this.emit('dependency-install-completed', finalCompletedData);

    console.warn(`[${task.id}] ${warningMessage}`);
    console.log(`[${task.id}] Workspace created successfully despite dependency installation failure`);
  }

  // ============================================================================
  // Private Utility Methods
  // ============================================================================

  /**
   * Apply recovery strategy based on previous failure
   */
  private async applyRecoveryStrategy(
    originalCommand: string,
    packageManagerType: PackageManagerType,
    lastError: string,
    attempt: number
  ): Promise<string> {
    // Network-related errors
    if (lastError.includes('ECONNRESET') || lastError.includes('ETIMEDOUT') || lastError.includes('network')) {
      return originalCommand; // Retry same command for transient network issues
    }

    // Permission errors
    if (lastError.includes('EACCES') || lastError.includes('permission denied')) {
      if (packageManagerType === 'pip') {
        return originalCommand.replace('pip install', 'pip install --user');
      }
      // For npm/yarn, try using cache clean and retry
      if (packageManagerType === 'npm') {
        return `npm cache clean --force && ${originalCommand}`;
      }
    }

    // Disk space errors
    if (lastError.includes('ENOSPC') || lastError.includes('no space left')) {
      return originalCommand; // Can't fix disk space programmatically, but retry anyway
    }

    // Registry/DNS resolution errors
    if (lastError.includes('getaddrinfo') || lastError.includes('failed to connect')) {
      if (packageManagerType === 'npm') {
        return `${originalCommand} --registry https://registry.npmjs.org/`;
      }
    }

    // Default: retry same command
    return originalCommand;
  }

  /**
   * Get human-readable recovery strategy name
   */
  private getRecoveryStrategyName(lastError: string, packageManagerType: PackageManagerType): string {
    if (lastError.includes('ECONNRESET') || lastError.includes('ETIMEDOUT') || lastError.includes('network')) {
      return 'Network retry with exponential backoff';
    }

    if (lastError.includes('EACCES') || lastError.includes('permission denied')) {
      if (packageManagerType === 'pip') {
        return 'Permission escalation (--user flag)';
      }
      return 'Cache cleanup and permission retry';
    }

    if (lastError.includes('ENOSPC') || lastError.includes('no space left')) {
      return 'Disk space retry';
    }

    if (lastError.includes('getaddrinfo') || lastError.includes('failed to connect')) {
      return 'Registry fallback strategy';
    }

    return 'Standard retry';
  }

  /**
   * Get helpful error suggestions for common failure patterns
   */
  private getErrorSuggestion(lastError: string): string {
    if (lastError.includes('ENOSPC') || lastError.includes('no space left')) {
      return 'Free up disk space or increase container storage';
    }

    if (lastError.includes('Could not find a version') || lastError.includes('No matching version')) {
      return 'Check package name spelling and version requirements';
    }

    if (lastError.includes('failed to connect') || lastError.includes('getaddrinfo') || lastError.includes('network')) {
      return 'Check network connectivity or use alternative registry';
    }

    if (lastError.includes('EACCES') || lastError.includes('permission denied')) {
      return 'Check file system permissions in container';
    }

    if (lastError.includes('timeout') || lastError.includes('ETIMEDOUT')) {
      return 'Consider increasing installTimeout or check network speed';
    }

    if (lastError.includes('lockfile') || lastError.includes('EEXIST')) {
      return 'Remove lockfiles and retry installation';
    }

    return 'Review error logs and package manager documentation';
  }

  private async loadActiveWorkspaces(): Promise<void> {
    try {
      const workspaceFiles = await fs.readdir(this.workspacesDir);

      for (const file of workspaceFiles) {
        if (file.endsWith('.workspace.json')) {
          try {
            const workspaceData = await fs.readFile(join(this.workspacesDir, file), 'utf-8');
            const workspace = JSON.parse(workspaceData) as WorkspaceInfo;

            // Convert date strings back to Date objects
            workspace.createdAt = new Date(workspace.createdAt);
            workspace.lastAccessed = new Date(workspace.lastAccessed);

            this.activeWorkspaces.set(workspace.taskId, workspace);
          } catch (error) {
            console.warn(`Failed to load workspace info from ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // Workspace directory doesn't exist or is empty
    }
  }

  private async saveWorkspaceInfo(workspace: WorkspaceInfo): Promise<void> {
    const filename = `${workspace.taskId}.workspace.json`;
    const filepath = join(this.workspacesDir, filename);

    await fs.writeFile(filepath, JSON.stringify(workspace, null, 2), 'utf-8');
  }

  /**
   * Cleanup workspace manager resources
   */
  async cleanup(): Promise<void> {
    // Stop container events monitoring
    if (this.containerManager.isEventsMonitoringActive()) {
      try {
        await this.containerManager.stopEventsMonitoring();
      } catch (error) {
        console.warn('Failed to stop container events monitoring:', error);
      }
    }

    // Stop health monitoring
    try {
      await this.healthMonitor.stopMonitoring();
    } catch (error) {
      console.warn('Failed to stop container health monitoring:', error);
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
