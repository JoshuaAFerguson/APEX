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
  ContainerHealthMonitor
} from '@apexcli/core';

const execAsync = promisify(exec);

export interface WorkspaceManagerOptions {
  projectPath: string;
  defaultStrategy: WorkspaceConfig['strategy'];
}

export interface WorkspaceInfo {
  taskId: string;
  config: WorkspaceConfig;
  workspacePath: string;
  status: 'active' | 'cleanup-pending' | 'cleaned';
  createdAt: Date;
  lastAccessed: Date;
}

/**
 * Manages isolated workspaces for task execution using various strategies
 */
export interface WorkspaceManagerEvents {
  'workspace-created': (taskId: string, workspacePath: string) => void;
  'workspace-cleaned': (taskId: string) => void;
}

export class WorkspaceManager extends EventEmitter<WorkspaceManagerEvents> {
  private projectPath: string;
  private defaultStrategy: WorkspaceConfig['strategy'];
  private workspacesDir: string;
  private activeWorkspaces: Map<string, WorkspaceInfo> = new Map();
  private containerRuntimeType: ContainerRuntimeType | null = null;
  private containerManager: ContainerManager;
  private healthMonitor: ContainerHealthMonitor;

  constructor(options: WorkspaceManagerOptions) {
    super();
    this.projectPath = options.projectPath;
    this.defaultStrategy = options.defaultStrategy;
    this.workspacesDir = join(this.projectPath, '.apex', 'workspaces');

    // Initialize container management
    this.containerManager = new ContainerManager();
    this.healthMonitor = new ContainerHealthMonitor(this.containerManager, {
      containerPrefix: 'apex-task',
      autoStart: false, // We'll start it when we need it
    });
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
    };

    switch (config.strategy) {
      case 'worktree':
        workspaceInfo.workspacePath = await this.createWorktreeWorkspace(task);
        break;
      case 'container':
        workspaceInfo.workspacePath = await this.createContainerWorkspace(task, config);
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

  private async createContainerWorkspace(task: Task, config: WorkspaceConfig): Promise<string> {
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

      // Build container configuration
      const containerConfig = {
        ...config.container,
        // Use project Dockerfile if it exists
        ...(hasProjectDockerfile && {
          dockerfile: '.apex/Dockerfile',
          buildContext: this.projectPath,
        }),
        // Ensure default image fallback
        image: config.container.image || 'node:20-alpine',
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
        config: containerConfig,
        taskId: task.id,
        autoStart: true,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create container');
      }

      return workspacePath;
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
  // Private Utility Methods
  // ============================================================================

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
