import { EventEmitter } from 'eventemitter3';
import {
  TaskInteraction,
  Task,
  TaskStatus,
  IterationEntry,
  IterationHistory,
  IterationSnapshot,
  IterationDiff
} from '@apexcli/core';
import { TaskStore } from './store';

export interface InteractionManagerEvents {
  'interaction:received': (interaction: TaskInteraction) => void;
  'interaction:processed': (interaction: TaskInteraction) => void;
  'task:iterate': (taskId: string, parameters: Record<string, unknown>) => void;
  'task:pause-requested': (taskId: string) => void;
  'task:resume-requested': (taskId: string) => void;
  'task:cancel-requested': (taskId: string) => void;
}

export interface TaskDiff {
  added: string[];
  modified: string[];
  removed: string[];
  summary: string;
}

export interface TaskInspection {
  taskId: string;
  currentStatus: TaskStatus;
  currentStage?: string;
  progress: {
    stagesCompleted: string[];
    currentStage?: string;
    remainingStages: string[];
    estimatedCompletion?: Date;
  };
  files: {
    created: string[];
    modified: string[];
    branches: string[];
  };
  usage: {
    tokens: number;
    cost: number;
    duration: number; // milliseconds
  };
  errors: string[];
  warnings: string[];
}

/**
 * Manages real-time interaction with running tasks
 */
export class InteractionManager extends EventEmitter<InteractionManagerEvents> {
  private store: TaskStore;
  private pendingInteractions: Map<string, TaskInteraction> = new Map();

  constructor(store: TaskStore) {
    super();
    this.store = store;
  }

  /**
   * Submit an interaction request for a task
   */
  async submitInteraction(
    taskId: string,
    command: TaskInteraction['command'],
    parameters: Record<string, unknown> = {},
    requestedBy: string = 'user'
  ): Promise<string> {
    const interactionId = `${taskId}-${Date.now()}`;

    const interaction: TaskInteraction = {
      taskId,
      command,
      parameters,
      requestedBy,
      requestedAt: new Date(),
    };

    this.pendingInteractions.set(interactionId, interaction);
    this.emit('interaction:received', interaction);

    // Process interaction based on command type
    try {
      const result = await this.processInteraction(interaction);
      interaction.processedAt = new Date();
      interaction.result = result;

      this.emit('interaction:processed', interaction);
      this.pendingInteractions.delete(interactionId);

      return result;
    } catch (error) {
      interaction.processedAt = new Date();
      interaction.result = `Error: ${error}`;

      this.emit('interaction:processed', interaction);
      this.pendingInteractions.delete(interactionId);

      throw error;
    }
  }

  /**
   * Iterate on a running task with new instructions
   */
  async iterateTask(
    taskId: string,
    instructions: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'in-progress') {
      throw new Error(`Task ${taskId} is not in progress (status: ${task.status})`);
    }

    // Capture snapshot of current task state before iteration
    const beforeState = await this.captureSnapshot(taskId);

    // Create iteration entry
    const iterationId = `${taskId}-iter-${Date.now()}`;
    const iterationEntry: Omit<IterationEntry, 'id'> & { id: string } = {
      id: iterationId,
      feedback: instructions,
      timestamp: new Date(),
      stage: task.currentStage,
      beforeState,
    };

    // Store the initial iteration entry
    await this.store.addIterationEntry(taskId, iterationEntry);

    // Emit iteration event for the orchestrator to handle
    this.emit('task:iterate', taskId, {
      iterationId,
      instructions,
      context,
      timestamp: new Date().toISOString(),
    });

    return iterationId;
  }

  /**
   * Complete an iteration after the orchestrator has processed it
   * This captures the after state and computes the diff summary
   */
  async completeIteration(
    taskId: string,
    iterationId: string,
    agent?: string
  ): Promise<void> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Capture snapshot of task state after iteration
    const afterState = await this.captureSnapshot(taskId);

    // Get the iteration entry to compare with before state
    const iterationHistory = await this.store.getIterationHistory(taskId);
    const iterationEntry = iterationHistory.entries.find(e => e.id === iterationId);

    if (!iterationEntry) {
      throw new Error(`Iteration ${iterationId} not found for task ${taskId}`);
    }

    // Compute diff summary
    let diffSummary = 'No changes detected';
    const modifiedFiles: string[] = [];

    if (iterationEntry.beforeState && afterState) {
      const before = iterationEntry.beforeState;
      const after = afterState;

      const changes: string[] = [];

      // Stage change
      if (before.stage !== after.stage) {
        changes.push(`stage changed from '${before.stage}' to '${after.stage}'`);
      }

      // Status change
      if (before.status !== after.status) {
        changes.push(`status changed from '${before.status}' to '${after.status}'`);
      }

      // File changes
      const addedFiles = after.files.created.filter(f => !before.files.created.includes(f));
      const newModifiedFiles = after.files.modified.filter(f => !before.files.modified.includes(f));
      modifiedFiles.push(...addedFiles, ...newModifiedFiles);

      if (addedFiles.length > 0) {
        changes.push(`${addedFiles.length} files added`);
      }
      if (newModifiedFiles.length > 0) {
        changes.push(`${newModifiedFiles.length} files modified`);
      }

      // Usage changes
      const tokenDelta = after.usage.totalTokens - before.usage.totalTokens;
      if (tokenDelta > 0) {
        changes.push(`${tokenDelta} tokens used`);
      }

      const artifactDelta = after.artifactCount - before.artifactCount;
      if (artifactDelta > 0) {
        changes.push(`${artifactDelta} artifacts created`);
      }

      if (changes.length > 0) {
        diffSummary = changes.join(', ');
      }
    }

    // Update the iteration entry with after state and diff summary
    await this.store.updateIterationEntry(
      iterationId,
      afterState,
      diffSummary,
      modifiedFiles.length > 0 ? modifiedFiles : undefined
    );
  }

  /**
   * Get the difference between two iterations of a task
   * If iterationId is not provided, compares the last two iterations
   */
  async getIterationDiff(
    taskId: string,
    iterationId?: string
  ): Promise<IterationDiff> {
    const iterationHistory = await this.store.getIterationHistory(taskId);

    if (iterationHistory.entries.length === 0) {
      throw new Error(`No iterations found for task ${taskId}`);
    }

    let currentIteration: IterationEntry;
    let previousIteration: IterationEntry | undefined;

    if (iterationId) {
      // Find the specific iteration and the one before it
      const currentIndex = iterationHistory.entries.findIndex(e => e.id === iterationId);
      if (currentIndex === -1) {
        throw new Error(`Iteration ${iterationId} not found for task ${taskId}`);
      }
      currentIteration = iterationHistory.entries[currentIndex];
      previousIteration = currentIndex > 0 ? iterationHistory.entries[currentIndex - 1] : undefined;
    } else {
      // Compare the last two iterations
      if (iterationHistory.entries.length < 2) {
        throw new Error(`Insufficient iterations to compare for task ${taskId}`);
      }
      currentIteration = iterationHistory.entries[iterationHistory.entries.length - 1];
      previousIteration = iterationHistory.entries[iterationHistory.entries.length - 2];
    }

    // If we don't have complete state data, fall back to basic comparison
    if (!currentIteration.beforeState || !currentIteration.afterState) {
      return {
        iterationId: currentIteration.id,
        previousIterationId: previousIteration?.id,
        filesChanged: {
          added: [],
          modified: currentIteration.modifiedFiles || [],
          removed: [],
        },
        tokenUsageDelta: 0,
        costDelta: 0,
        summary: currentIteration.diffSummary || 'No detailed diff available',
      };
    }

    const currentBefore = currentIteration.beforeState;
    const currentAfter = currentIteration.afterState;

    // Compare with previous iteration's after state if available
    const compareAgainst = previousIteration?.afterState || currentBefore;

    // Calculate file changes
    const addedFiles = currentAfter.files.created.filter(f => !compareAgainst.files.created.includes(f));
    const removedFiles = compareAgainst.files.created.filter(f => !currentAfter.files.created.includes(f));
    const modifiedFiles = [
      ...currentAfter.files.modified.filter(f => !compareAgainst.files.modified.includes(f)),
      ...currentAfter.files.created.filter(f => compareAgainst.files.modified.includes(f)), // File moved from modified to created
    ];

    // Calculate usage deltas
    const tokenUsageDelta = currentAfter.usage.totalTokens - compareAgainst.usage.totalTokens;
    const costDelta = currentAfter.usage.estimatedCost - compareAgainst.usage.estimatedCost;

    // Stage and status changes
    const stageChange = currentBefore.stage !== currentAfter.stage
      ? { from: currentBefore.stage || 'unknown', to: currentAfter.stage || 'unknown' }
      : undefined;

    const statusChange = currentBefore.status !== currentAfter.status
      ? { from: currentBefore.status, to: currentAfter.status }
      : undefined;

    // Generate summary
    const changes: string[] = [];
    if (stageChange) {
      changes.push(`Stage: ${stageChange.from} → ${stageChange.to}`);
    }
    if (statusChange) {
      changes.push(`Status: ${statusChange.from} → ${statusChange.to}`);
    }
    if (addedFiles.length > 0) {
      changes.push(`${addedFiles.length} files added`);
    }
    if (modifiedFiles.length > 0) {
      changes.push(`${modifiedFiles.length} files modified`);
    }
    if (removedFiles.length > 0) {
      changes.push(`${removedFiles.length} files removed`);
    }
    if (tokenUsageDelta > 0) {
      changes.push(`${tokenUsageDelta} tokens used`);
    }

    const summary = changes.length > 0 ? changes.join('; ') : 'No significant changes detected';

    return {
      iterationId: currentIteration.id,
      previousIterationId: previousIteration?.id,
      stageChange,
      statusChange,
      filesChanged: {
        added: addedFiles,
        modified: modifiedFiles,
        removed: removedFiles,
      },
      tokenUsageDelta,
      costDelta,
      summary,
    };
  }

  /**
   * Inspect the current state of a task
   */
  async inspectTask(taskId: string): Promise<TaskInspection> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Calculate progress information
    const stagesCompleted = task.logs
      .filter(log => log.message.includes('completed'))
      .map(log => log.stage)
      .filter(Boolean) as string[];

    const remainingStages = this.estimateRemainingStages(task);

    // Calculate usage metrics
    const duration = task.completedAt
      ? task.completedAt.getTime() - task.createdAt.getTime()
      : Date.now() - task.createdAt.getTime();

    // Extract errors and warnings from logs
    const errors = task.logs
      .filter(log => log.level === 'error')
      .map(log => log.message);

    const warnings = task.logs
      .filter(log => log.level === 'warn')
      .map(log => log.message);

    // Get file changes (this would be enhanced with actual git diff)
    const files = this.extractFileChanges(task);

    return {
      taskId,
      currentStatus: task.status,
      currentStage: task.currentStage,
      progress: {
        stagesCompleted: [...new Set(stagesCompleted)],
        currentStage: task.currentStage,
        remainingStages,
        estimatedCompletion: this.estimateCompletion(task),
      },
      files,
      usage: {
        tokens: task.usage.totalTokens,
        cost: task.usage.estimatedCost,
        duration,
      },
      errors,
      warnings,
    };
  }

  /**
   * Get diff of changes made by a task
   */
  async getTaskDiff(taskId: string, staged: boolean = false): Promise<TaskDiff> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // This would integrate with git to get actual diffs
    // For now, return information from task artifacts
    const artifacts = task.artifacts.filter(artifact => artifact.type === 'diff');

    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    // Extract file changes from artifacts
    for (const artifact of artifacts) {
      if (artifact.content) {
        const lines = artifact.content.split('\n');
        for (const line of lines) {
          if (line.startsWith('+++ ')) {
            added.push(line.substring(4));
          } else if (line.startsWith('--- ')) {
            removed.push(line.substring(4));
          }
        }
      }
    }

    // Get modified files from task logs
    const modifiedFiles = task.logs
      .filter(log => log.message.includes('modified') || log.message.includes('updated'))
      .map(log => this.extractFilePathFromMessage(log.message))
      .filter(Boolean) as string[];

    modified.push(...modifiedFiles);

    const summary = this.generateDiffSummary(added, modified, removed);

    return {
      added: [...new Set(added)],
      modified: [...new Set(modified)],
      removed: [...new Set(removed)],
      summary,
    };
  }

  /**
   * Pause a running task
   */
  async pauseTask(taskId: string, reason?: string): Promise<void> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'in-progress') {
      throw new Error(`Cannot pause task ${taskId} - not in progress`);
    }

    this.emit('task:pause-requested', taskId);

    // Update task status in store
    await this.store.updateTaskStatus(taskId, 'paused', undefined, reason || 'User requested pause');
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId: string): Promise<void> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'paused') {
      throw new Error(`Cannot resume task ${taskId} - not paused (status: ${task.status})`);
    }

    this.emit('task:resume-requested', taskId);

    // Update task status in store
    await this.store.updateTaskStatus(taskId, 'in-progress');
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      throw new Error(`Cannot cancel task ${taskId} - already ${task.status}`);
    }

    this.emit('task:cancel-requested', taskId);

    // Update task status in store
    await this.store.updateTaskStatus(taskId, 'cancelled', undefined, 'User requested cancellation');
  }

  /**
   * Get all pending interactions
   */
  getPendingInteractions(): TaskInteraction[] {
    return Array.from(this.pendingInteractions.values());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Capture a snapshot of the current task state for iteration tracking
   */
  private async captureSnapshot(taskId: string): Promise<IterationSnapshot> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Extract file changes from task
    const files = this.extractFileChanges(task);

    return {
      timestamp: new Date(),
      stage: task.currentStage,
      status: task.status,
      files: {
        created: files.created,
        modified: files.modified,
      },
      usage: task.usage,
      artifactCount: task.artifacts.length,
    };
  }

  private async processInteraction(interaction: TaskInteraction): Promise<string> {
    const params = interaction.parameters ?? {};

    switch (interaction.command) {
      case 'iterate':
        return await this.iterateTask(
          interaction.taskId,
          typeof params.instructions === 'string' ? params.instructions : '',
          (params.context as Record<string, unknown>) || {}
        );

      case 'inspect':
        const inspection = await this.inspectTask(interaction.taskId);
        return JSON.stringify(inspection, null, 2);

      case 'diff':
        const diff = await this.getTaskDiff(
          interaction.taskId,
          Boolean(params.staged)
        );
        return JSON.stringify(diff, null, 2);

      case 'iteration-diff':
        const iterDiff = await this.getIterationDiff(
          interaction.taskId,
          typeof params.iterationId === 'string' ? params.iterationId : undefined
        );
        return JSON.stringify(iterDiff, null, 2);

      case 'pause':
        await this.pauseTask(
          interaction.taskId,
          typeof params.reason === 'string' ? params.reason : undefined
        );
        return 'Task paused successfully';

      case 'resume':
        await this.resumeTask(interaction.taskId);
        return 'Task resumed successfully';

      case 'cancel':
        await this.cancelTask(interaction.taskId);
        return 'Task cancelled successfully';

      default:
        throw new Error(`Unknown interaction command: ${interaction.command}`);
    }
  }

  private estimateRemainingStages(task: Task): string[] {
    // This would be enhanced with actual workflow definition parsing
    const commonStages = ['planning', 'architecture', 'implementation', 'testing', 'review'];
    const completed = task.logs
      .filter(log => log.stage && log.message.includes('completed'))
      .map(log => log.stage) as string[];

    return commonStages.filter(stage => !completed.includes(stage));
  }

  private estimateCompletion(task: Task): Date | undefined {
    if (task.status === 'completed') {
      return task.completedAt;
    }

    // Simple estimation based on average stage duration
    const stageCompletions = task.logs
      .filter(log => log.message.includes('completed'))
      .map(log => log.timestamp);

    if (stageCompletions.length < 2) {
      return undefined; // Not enough data
    }

    const averageStageDuration = stageCompletions.reduce((total, time, index) => {
      if (index === 0) return total;
      return total + (time.getTime() - stageCompletions[index - 1].getTime());
    }, 0) / (stageCompletions.length - 1);

    const remainingStages = this.estimateRemainingStages(task).length;
    const estimatedRemainingTime = remainingStages * averageStageDuration;

    return new Date(Date.now() + estimatedRemainingTime);
  }

  private extractFileChanges(task: Task): {
    created: string[];
    modified: string[];
    branches: string[];
  } {
    const created: string[] = [];
    const modified: string[] = [];
    const branches: string[] = [];

    // Extract from artifacts
    for (const artifact of task.artifacts) {
      if (artifact.type === 'file' && artifact.path) {
        if (artifact.name.includes('created')) {
          created.push(artifact.path);
        } else {
          modified.push(artifact.path);
        }
      }
    }

    // Extract from logs
    for (const log of task.logs) {
      const filePath = this.extractFilePathFromMessage(log.message);
      if (filePath) {
        if (log.message.includes('created') || log.message.includes('added')) {
          created.push(filePath);
        } else if (log.message.includes('modified') || log.message.includes('updated')) {
          modified.push(filePath);
        }
      }

      // Extract branch information
      if (log.message.includes('branch')) {
        const branchMatch = log.message.match(/branch\s+([^\s]+)/);
        if (branchMatch) {
          branches.push(branchMatch[1]);
        }
      }
    }

    // Add task branch if available
    if (task.branchName) {
      branches.push(task.branchName);
    }

    return {
      created: [...new Set(created)],
      modified: [...new Set(modified)],
      branches: [...new Set(branches)],
    };
  }

  private extractFilePathFromMessage(message: string): string | null {
    // Simple regex to extract file paths from log messages
    const patterns = [
      /(?:created|modified|updated|added)\s+([^\s]+\.[a-zA-Z]+)/,
      /file\s+([^\s]+\.[a-zA-Z]+)/,
      /path\s+([^\s]+\.[a-zA-Z]+)/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private generateDiffSummary(added: string[], modified: string[], removed: string[]): string {
    const parts: string[] = [];

    if (added.length > 0) {
      parts.push(`${added.length} files added`);
    }
    if (modified.length > 0) {
      parts.push(`${modified.length} files modified`);
    }
    if (removed.length > 0) {
      parts.push(`${removed.length} files removed`);
    }

    if (parts.length === 0) {
      return 'No changes detected';
    }

    return parts.join(', ');
  }
}
