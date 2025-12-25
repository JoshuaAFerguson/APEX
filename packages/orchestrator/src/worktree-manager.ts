import { exec } from 'child_process';
import { promisify } from 'util';
import { join, resolve, basename } from 'path';
import { promises as fs } from 'fs';
import { WorktreeInfo, WorktreeStatus, WorktreeConfig } from '@apexcli/core';

const execAsync = promisify(exec);

/**
 * Error thrown when worktree operations fail
 */
export class WorktreeError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'WorktreeError';
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/**
 * Options for creating a WorktreeManager instance
 */
export interface WorktreeManagerOptions {
  /** The project root directory */
  projectPath: string;
  /** Configuration for worktree management */
  config?: Partial<WorktreeConfig>;
}

/**
 * Manages git worktrees for task isolation
 */
export class WorktreeManager {
  private projectPath: string;
  private config: WorktreeConfig;
  private worktreeBaseDir: string;

  constructor(options: WorktreeManagerOptions) {
    this.projectPath = resolve(options.projectPath);

    // Set default configuration
    this.config = {
      cleanupOnComplete: true,
      maxWorktrees: 5,
      pruneStaleAfterDays: 7,
      preserveOnFailure: false,
      cleanupDelayMs: 0,
      ...options.config,
    };

    // Set base directory for worktrees
    this.worktreeBaseDir = this.config.baseDir ||
      join(this.projectPath, '..', '.apex-worktrees');
  }

  /**
   * Create a new worktree for a task
   * @param taskId The unique task identifier
   * @param branchName The branch name to create and checkout
   * @returns The absolute path to the worktree directory
   */
  async createWorktree(taskId: string, branchName: string): Promise<string> {
    if (!taskId || !branchName) {
      throw new WorktreeError('TaskId and branchName are required');
    }

    // Check if we've hit the max worktrees limit
    const existingWorktrees = await this.listWorktrees();
    const activeWorktrees = existingWorktrees.filter(w => w.status === 'active');

    if (activeWorktrees.length >= this.config.maxWorktrees!) {
      throw new WorktreeError(`Maximum number of worktrees (${this.config.maxWorktrees}) reached`);
    }

    // Check if worktree already exists for this task
    const existing = existingWorktrees.find(w => w.taskId === taskId);
    if (existing) {
      throw new WorktreeError(`Worktree already exists for task ${taskId} at ${existing.path}`);
    }

    // Ensure base directory exists
    await fs.mkdir(this.worktreeBaseDir, { recursive: true });

    const worktreePath = join(this.worktreeBaseDir, `task-${taskId}`);

    try {
      // Create the worktree with a new branch
      await execAsync(
        `git worktree add "${worktreePath}" -b "${branchName}"`,
        { cwd: this.projectPath }
      );

      // Verify the worktree was created successfully
      const worktreeInfo = await this.getWorktreeInfo(worktreePath);
      if (!worktreeInfo) {
        throw new WorktreeError('Failed to verify worktree creation');
      }

      return worktreePath;
    } catch (error) {
      // Clean up any partial creation
      try {
        await fs.rm(worktreePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      throw new WorktreeError(
        `Failed to create worktree for task ${taskId}: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get information about a specific worktree by task ID
   * @param taskId The task identifier
   * @returns WorktreeInfo if found, null otherwise
   */
  async getWorktree(taskId: string): Promise<WorktreeInfo | null> {
    if (!taskId) {
      return null;
    }

    const worktrees = await this.listWorktrees();
    return worktrees.find(w => w.taskId === taskId) || null;
  }

  /**
   * Switch to a worktree for a specific task
   * @param taskId The task identifier
   * @returns The absolute path to the worktree directory
   */
  async switchToWorktree(taskId: string): Promise<string> {
    if (!taskId) {
      throw new WorktreeError('TaskId is required');
    }

    const worktree = await this.getWorktree(taskId);
    if (!worktree) {
      throw new WorktreeError(`No worktree found for task ${taskId}`);
    }

    try {
      // Switch to the worktree directory (conceptually - caller will need to cd)
      // For now, just verify the path exists and is accessible
      await fs.access(worktree.path);

      // Update last used timestamp
      await this.updateWorktreeTimestamp(worktree.path);

      return worktree.path;
    } catch (error) {
      throw new WorktreeError(
        `Failed to switch to worktree for task ${taskId}: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a worktree for a specific task
   * @param taskId The task identifier
   * @returns True if worktree was deleted, false if it didn't exist
   */
  async deleteWorktree(taskId: string): Promise<boolean> {
    if (!taskId) {
      return false;
    }

    const worktree = await this.getWorktree(taskId);
    if (!worktree) {
      return false;
    }

    try {
      // Remove the worktree using git
      await execAsync(
        `git worktree remove "${worktree.path}" --force`,
        { cwd: this.projectPath }
      );

      return true;
    } catch (error) {
      // If git worktree remove fails, try manual cleanup
      try {
        await fs.rm(worktree.path, { recursive: true, force: true });
        // Also try to prune the worktree from git's perspective
        await execAsync('git worktree prune', { cwd: this.projectPath });
        return true;
      } catch (cleanupError) {
        throw new WorktreeError(
          `Failed to delete worktree for task ${taskId}: ${error instanceof Error ? error.message : error}`,
          error instanceof Error ? error : undefined
        );
      }
    }
  }

  /**
   * List all worktrees with their status and metadata
   * @returns Array of WorktreeInfo objects
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      // Get list of worktrees from git
      const { stdout } = await execAsync(
        'git worktree list --porcelain',
        { cwd: this.projectPath }
      );

      const worktrees: WorktreeInfo[] = [];
      const lines = stdout.trim().split('\n');

      let currentWorktree: Partial<WorktreeInfo> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          // Start of new worktree entry
          if (currentWorktree.path) {
            // Finalize previous worktree
            const info = await this.finalizeWorktreeInfo(currentWorktree);
            if (info) worktrees.push(info);
          }
          currentWorktree = {
            path: line.slice(9), // Remove 'worktree ' prefix
            isMain: false,
          };
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.head = line.slice(5); // Remove 'HEAD ' prefix
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.slice(7); // Remove 'branch ' prefix
        } else if (line === 'bare') {
          // This is a bare repository - skip
          currentWorktree = {};
        } else if (line === 'detached') {
          currentWorktree.branch = 'HEAD'; // Detached HEAD
        }
      }

      // Don't forget the last worktree
      if (currentWorktree.path) {
        const info = await this.finalizeWorktreeInfo(currentWorktree);
        if (info) worktrees.push(info);
      }

      return worktrees;
    } catch (error) {
      throw new WorktreeError(
        `Failed to list worktrees: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clean up orphaned worktrees that are no longer associated with active tasks
   * @returns Array of taskIds for worktrees that were cleaned up
   */
  async cleanupOrphanedWorktrees(): Promise<string[]> {
    const worktrees = await this.listWorktrees();
    const cleanedUp: string[] = [];

    for (const worktree of worktrees) {
      // Skip main worktree
      if (worktree.isMain) {
        continue;
      }

      // Check if this is a stale worktree
      if (worktree.status === 'stale' || worktree.status === 'prunable') {
        try {
          if (worktree.taskId) {
            await this.deleteWorktree(worktree.taskId);
            cleanedUp.push(worktree.taskId);
          } else {
            // No task ID, remove manually
            await execAsync(
              `git worktree remove "${worktree.path}" --force`,
              { cwd: this.projectPath }
            );
          }
        } catch (error) {
          // Log error but continue with cleanup
          console.warn(`Failed to cleanup worktree ${worktree.path}:`, error);
        }
      }
    }

    return cleanedUp;
  }

  /**
   * Get the base directory where worktrees are stored
   */
  getWorktreeBaseDir(): string {
    return this.worktreeBaseDir;
  }

  /**
   * Get the current worktree configuration
   */
  getConfig(): WorktreeConfig {
    return { ...this.config };
  }

  // Private helper methods

  /**
   * Get detailed information about a specific worktree path
   */
  private async getWorktreeInfo(worktreePath: string): Promise<WorktreeInfo | null> {
    try {
      const worktrees = await this.listWorktrees();
      return worktrees.find(w => w.path === worktreePath) || null;
    } catch {
      return null;
    }
  }

  /**
   * Finalize WorktreeInfo from partial data gathered during listing
   */
  private async finalizeWorktreeInfo(partial: Partial<WorktreeInfo>): Promise<WorktreeInfo | null> {
    if (!partial.path || !partial.head) {
      return null;
    }

    // Determine if this is the main worktree
    const isMain = partial.path === this.projectPath;

    // Extract task ID from path if it follows our naming convention
    let taskId: string | undefined;
    const pathBasename = basename(partial.path);
    if (pathBasename.startsWith('task-')) {
      taskId = pathBasename.slice(5); // Remove 'task-' prefix
    }

    // Determine status
    let status: WorktreeStatus = 'active';

    if (isMain) {
      status = 'active';
    } else {
      // Check if worktree directory exists and is accessible
      try {
        await fs.access(partial.path);

        // If it has a taskId but the directory is old, it might be stale
        if (taskId) {
          const stats = await fs.stat(partial.path);
          const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceModified > this.config.pruneStaleAfterDays!) {
            status = 'stale';
          }
        } else {
          // No task ID, might be prunable
          status = 'prunable';
        }
      } catch {
        // Directory doesn't exist or not accessible
        status = 'prunable';
      }
    }

    // Get creation and last used times
    let createdAt: Date | undefined;
    let lastUsedAt: Date | undefined;

    try {
      const stats = await fs.stat(partial.path);
      createdAt = stats.birthtime;
      lastUsedAt = stats.mtime;
    } catch {
      // Ignore errors getting timestamps
    }

    return {
      path: partial.path,
      branch: partial.branch || 'unknown',
      head: partial.head,
      status,
      taskId,
      isMain,
      createdAt,
      lastUsedAt,
    };
  }

  /**
   * Update the last used timestamp for a worktree
   */
  private async updateWorktreeTimestamp(worktreePath: string): Promise<void> {
    try {
      const now = new Date();
      await fs.utimes(worktreePath, now, now);
    } catch {
      // Ignore errors updating timestamp
    }
  }
}