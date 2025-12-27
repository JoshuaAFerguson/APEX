import { query, type AgentDefinition as SDKAgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  WorkflowStage,
  Task,
  TaskStatus,
  TaskUsage,
  TaskCheckpoint,
  TaskSessionData,
  WorkspaceConfig,
  StageResult,
  ApexEvent,
  ApexEventType,
  SubtaskStrategy,
  SubtaskDefinition,
  TaskDecomposition,
  SessionLimitStatus,
  loadConfig,
  loadAgents,
  loadWorkflow,
  getEffectiveConfig,
  generateTaskId,
  generateBranchName,
  calculateCost,
  OutdatedDocumentation,
  MissingReadmeSection,
  IdleTask,
  IdleTaskType,
  TaskPriority,
  CreateTaskRequest,
  WorktreeInfo,
} from '@apexcli/core';
import { TaskStore } from './store';
import { WorktreeManager } from './worktree-manager';
import { WorkspaceManager, DependencyInstallEventData, DependencyInstallCompletedEventData, DependencyInstallRecoveryEventData } from './workspace-manager';
import {
  buildOrchestratorPrompt,
  buildAgentDefinitions,
  buildStagePrompt,
  buildPlannerStagePrompt,
  buildResumePrompt,
  parseDecompositionRequest,
  isPlanningStage,
  type DecompositionRequest,
} from './prompts';
import { createHooks } from './hooks';
import { estimateConversationTokens, createContextSummary } from './context';
import { IdleProcessor, type ProjectAnalysis } from './idle-processor';
import { ThoughtCaptureManager } from './thought-capture';

const execAsync = promisify(exec);

export interface OrchestratorOptions {
  projectPath: string;
  apiUrl?: string;
}

export interface OrchestratorEvents {
  'task:created': (task: Task) => void;
  'task:started': (task: Task) => void;
  'task:stage-changed': (task: Task, stage: string) => void;
  'task:completed': (task: Task) => void;
  'task:failed': (task: Task, error: Error) => void;
  'task:paused': (task: Task, reason: string) => void;
  'task:decomposed': (task: Task, subtaskIds: string[]) => void;
  'subtask:created': (subtask: Task, parentTaskId: string) => void;
  'subtask:completed': (subtask: Task, parentTaskId: string) => void;
  'subtask:failed': (subtask: Task, parentTaskId: string, error: Error) => void;
  'agent:message': (taskId: string, message: unknown) => void;
  'agent:thinking': (taskId: string, agent: string, thinking: string) => void;
  'agent:tool-use': (taskId: string, tool: string, input: unknown) => void;
  'agent:turn': (event: { taskId: string; agentName: string; turnNumber: number }) => void;
  'agent:error': (event: { taskId: string; agentName: string; error: Error }) => void;
  'usage:updated': (taskId: string, usage: TaskUsage) => void;
  'pr:created': (taskId: string, prUrl: string) => void;
  'pr:failed': (taskId: string, error: string) => void;

  // Daemon capacity events
  'daemon:paused': (reason: string) => void;
  'daemon:resumed': () => void;

  // New events for parallel execution
  'stage:parallel-started': (taskId: string, stages: string[], agents: string[]) => void;
  'stage:parallel-completed': (taskId: string) => void;

  // Agent transition event (more explicit than task:stage-changed)
  'agent:transition': (taskId: string, fromAgent: string | null, toAgent: string) => void;

  // Auto-resume event (emitted when capacity is restored and tasks are auto-resumed)
  'tasks:auto-resumed': (event: TasksAutoResumedEvent) => void;

  // Task session resumed event (emitted when a task session is resumed from a checkpoint)
  'task:session-resumed': (event: TaskSessionResumedEvent) => void;

  // Orphan detection events
  'orphan:detected': (event: OrphanDetectedEvent) => void;
  'orphan:recovered': (event: OrphanRecoveredEvent) => void;

  // Worktree events (v0.4.0)
  'worktree:created': (taskId: string, worktreePath: string) => void;
  'worktree:cleaned': (taskId: string, worktreePath: string) => void;
  'worktree:merge-cleaned': (taskId: string, worktreePath: string, prUrl: string) => void;

  // Container events (v0.4.0)
  'container:created': (event: ContainerEventData) => void;
  'container:started': (event: ContainerEventData) => void;
  'container:stopped': (event: ContainerEventData) => void;
  'container:died': (event: ContainerDiedEventData) => void;
  'container:removed': (event: ContainerEventData) => void;
  'container:lifecycle': (event: ContainerEventData, operation: ContainerLifecycleOperation) => void;

  // Dependency installation events
  'dependency:install-started': (event: DependencyInstallEventData) => void;
  'dependency:install-completed': (event: DependencyInstallCompletedEventData) => void;
}

/**
 * Event payload for tasks:auto-resumed event
 */
export interface TasksAutoResumedEvent {
  reason: string;           // Capacity restoration reason (mode_switch, budget_reset, capacity_dropped)
  totalTasks: number;       // Total paused tasks found
  resumedCount: number;     // Successfully resumed count
  errors: Array<{           // Failed resume attempts
    taskId: string;
    error: string;
  }>;
  timestamp: Date;
  // v0.4.0 enhancements
  resumeReason?: string;    // Detailed string description of why tasks were resumed
  contextSummary?: string;  // Aggregated context summary for all resumed tasks
}

/**
 * Event payload for task:session-resumed event
 */
export interface TaskSessionResumedEvent {
  taskId: string;              // The task that was resumed
  resumeReason: string;        // Reason for resuming (e.g., 'checkpoint_restore', 'manual_resume', 'auto_resume')
  contextSummary: string;      // Summary of the task context being resumed
  previousStatus: TaskStatus;  // Status the task had before being resumed
  sessionData: TaskSessionData; // Session recovery data
  timestamp: Date;             // When the resume occurred
}

/**
 * Event payload when orphaned tasks are detected
 */
export interface OrphanDetectedEvent {
  tasks: Task[];
  detectedAt: Date;
  reason: 'startup_check' | 'periodic_check';
  stalenessThreshold: number;
}

/**
 * Event payload when an orphaned task is recovered
 */
export interface OrphanRecoveredEvent {
  taskId: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  action: 'marked_failed' | 'reset_pending' | 'retry';
  message: string;
  timestamp: Date;
}

/**
 * Event payload for container lifecycle events
 */
export interface ContainerEventData {
  containerId: string;
  taskId?: string; // Associated task ID when available
  containerInfo?: any; // Container information from the runtime
  timestamp: Date;
  success?: boolean; // For operation events
  error?: string; // Error message if operation failed
  command?: string; // Command that was executed
}

/**
 * Event payload for container died events
 */
export interface ContainerDiedEventData extends ContainerEventData {
  exitCode: number;
  signal?: string;
  oomKilled?: boolean;
}

/**
 * Container lifecycle operation types
 */
export type ContainerLifecycleOperation = 'created' | 'started' | 'stopped' | 'removed' | 'died';

export interface PRResult {
  success: boolean;
  prUrl?: string;
  error?: string;
}

export class ApexOrchestrator extends EventEmitter<OrchestratorEvents> {
  private config!: ApexConfig;
  private effectiveConfig!: ReturnType<typeof getEffectiveConfig>;
  private agents: Record<string, AgentDefinition> = {};
  private store!: TaskStore;
  private thoughtCaptureManager!: ThoughtCaptureManager;
  private worktreeManager?: WorktreeManager;
  private workspaceManager!: WorkspaceManager;
  private projectPath: string;
  private apiUrl: string;
  private initialized = false;

  // Concurrent execution state
  private runningTasks: Map<string, Promise<void>> = new Map();
  private taskRunnerInterval: ReturnType<typeof setInterval> | null = null;
  private isRunnerActive = false;

  constructor(options: OrchestratorOptions) {
    super();
    this.projectPath = options.projectPath;
    this.apiUrl = options.apiUrl || 'http://localhost:3000';
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load configuration
    this.config = await loadConfig(this.projectPath);
    this.effectiveConfig = getEffectiveConfig(this.config);

    // Load agent definitions
    this.agents = await loadAgents(this.projectPath);

    // Initialize task store
    this.store = new TaskStore(this.projectPath);
    await this.store.initialize();

    // Initialize thought capture manager
    this.thoughtCaptureManager = new ThoughtCaptureManager(this.projectPath, this.store);
    await this.thoughtCaptureManager.initialize();

    // Initialize worktree manager if autoWorktree is enabled
    if (this.effectiveConfig.git.autoWorktree) {
      this.worktreeManager = new WorktreeManager({
        projectPath: this.projectPath,
        config: this.effectiveConfig.git.worktree,
      });
    }

    // Initialize workspace manager
    this.workspaceManager = new WorkspaceManager({
      projectPath: this.projectPath,
      defaultStrategy: this.effectiveConfig.workspace?.defaultStrategy || 'none',
      containerDefaults: this.effectiveConfig.workspace?.container,
    });
    await this.workspaceManager.initialize();

    // Forward container events from workspace manager
    this.setupContainerEventForwarding();

    // Forward dependency install events from workspace manager
    this.setupDependencyEventForwarding();

    // Setup automatic workspace cleanup on task completion
    this.setupAutomaticWorkspaceCleanup();

    this.initialized = true;
  }

  /**
   * Create a new task
   */
  async createTask(options: {
    description: string;
    acceptanceCriteria?: string;
    workflow?: string;
    autonomy?: Task['autonomy'];
    priority?: Task['priority'];
    effort?: Task['effort'];
    maxRetries?: number;
    dependsOn?: string[];
    parentTaskId?: string;
    subtaskStrategy?: SubtaskStrategy;
  }): Promise<Task> {
    await this.ensureInitialized();

    const taskId = generateTaskId();
    const workflow = options.workflow || 'feature';
    const autonomy = options.autonomy || this.effectiveConfig.autonomy.default;
    const priority = options.priority || 'normal';
    const effort = options.effort || 'medium';
    const maxRetries = options.maxRetries ?? this.effectiveConfig.limits.maxRetries;

    // Subtasks share the parent's branch, parent tasks get a new branch
    let branchName: string | undefined;
    if (options.parentTaskId) {
      const parentTask = await this.store.getTask(options.parentTaskId);
      branchName = parentTask?.branchName;
    } else {
      branchName = generateBranchName(
        this.effectiveConfig.git.branchPrefix,
        taskId,
        options.description
      );
    }

    const task: Task = {
      id: taskId,
      description: options.description,
      acceptanceCriteria: options.acceptanceCriteria,
      workflow,
      autonomy,
      status: 'pending',
      priority,
      effort,
      projectPath: this.projectPath,
      branchName,
      retryCount: 0,
      maxRetries,
      resumeAttempts: 0,
      dependsOn: options.dependsOn || [],
      blockedBy: options.dependsOn || [], // Initially blocked by all dependencies
      parentTaskId: options.parentTaskId,
      subtaskIds: [],
      subtaskStrategy: options.subtaskStrategy,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      logs: [],
      artifacts: [],
    };

    await this.store.createTask(task);
    this.emit('task:created', task);

    // Create worktree if autoWorktree is enabled and this is not a subtask
    if (this.worktreeManager && !options.parentTaskId && branchName) {
      try {
        const worktreePath = await this.worktreeManager.createWorktree(taskId, branchName);

        // Update task with workspace configuration
        const updatedTask = {
          ...task,
          workspace: {
            strategy: 'worktree' as const,
            path: worktreePath,
            cleanup: this.effectiveConfig.git.worktree?.cleanupOnComplete ?? true,
          },
        };

        await this.store.updateTask(taskId, {
          workspace: updatedTask.workspace,
          updatedAt: new Date(),
        });

        this.emit('worktree:created', taskId, worktreePath);

        // Update the task object to return
        task.workspace = updatedTask.workspace;
      } catch (error) {
        console.warn(`Failed to create worktree for task ${taskId}:`, error);
        // Don't fail task creation if worktree creation fails
      }
    }

    // If this is a subtask, emit subtask:created and update parent
    if (options.parentTaskId) {
      this.emit('subtask:created', task, options.parentTaskId);

      // Add this subtask ID to the parent's subtaskIds array
      const parentTask = await this.store.getTask(options.parentTaskId);
      if (parentTask) {
        const updatedSubtaskIds = [...(parentTask.subtaskIds || []), taskId];
        await this.store.updateTask(options.parentTaskId, {
          subtaskIds: updatedSubtaskIds,
          updatedAt: new Date(),
        });
      }
    }

    return task;
  }

  /**
   * Execute a task with automatic retries
   */
  async executeTask(taskId: string, options?: { autoRetry?: boolean }): Promise<void> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Check if this task already has subtasks that need to be continued
    // This happens when resuming a task that was previously decomposed
    if (task.subtaskIds && task.subtaskIds.length > 0) {
      const hasWorkToDo = await this.hasPendingSubtasks(taskId, true);
      if (hasWorkToDo) {
        await this.store.addLog(taskId, {
          level: 'info',
          message: `Task has existing subtasks - continuing those instead of re-running workflow`,
        });
        await this.continuePendingSubtasks(taskId);
        return;
      }
      // All subtasks are done - aggregate and complete
      const allComplete = await this.aggregateSubtaskResults(taskId);
      if (allComplete) {
        await this.updateTaskStatus(taskId, 'completed');
        const completedTask = await this.store.getTask(taskId);
        if (completedTask) {
          this.emit('task:completed', completedTask);
          // Handle git operations for completed task
          if (!task.parentTaskId) {
            try {
              await this.handleTaskGitOperations(completedTask);
            } catch (error) {
              await this.store.addLog(taskId, {
                level: 'warn',
                message: `Git operations failed: ${(error as Error).message}`,
              });
            }
          }
        }
        return;
      }
    }

    // Load workflow
    const workflow = await loadWorkflow(this.projectPath, task.workflow);
    if (!workflow) {
      throw new Error(`Workflow not found: ${task.workflow}`);
    }

    // Create feature branch before starting
    if (task.branchName) {
      await this.createFeatureBranch(task.branchName);
      await this.store.addLog(taskId, {
        level: 'info',
        message: `Created feature branch: ${task.branchName}`,
      });
    }

    // Update status
    await this.updateTaskStatus(taskId, 'in-progress');
    this.emit('task:started', task);

    const autoRetry = options?.autoRetry ?? true;
    const maxRetries = task.maxRetries;
    const retryDelayMs = this.effectiveConfig.limits.retryDelayMs;
    const backoffFactor = this.effectiveConfig.limits.retryBackoffFactor;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Calculate backoff delay: retryDelayMs * (backoffFactor ^ (attempt - 1))
          const delay = retryDelayMs * Math.pow(backoffFactor, attempt - 1);
          await this.sleep(delay);

          // Update retry count
          await this.store.updateTask(taskId, {
            retryCount: attempt,
            updatedAt: new Date(),
          });

          // Log retry attempt
          await this.store.addLog(taskId, {
            level: 'info',
            message: `Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`,
          });
        }

        const shouldComplete = await this.runWorkflow(task, workflow);

        if (shouldComplete) {
          await this.updateTaskStatus(taskId, 'completed');
          const completedTask = await this.store.getTask(taskId);
          this.emit('task:completed', completedTask!);

          // Handle git operations (push and PR creation) for parent tasks only
          if (!task.parentTaskId && completedTask) {
            try {
              const prResult = await this.handleTaskGitOperations(completedTask);
              if (prResult?.success && prResult.prUrl) {
                await this.store.addLog(taskId, {
                  level: 'info',
                  message: `Pull request created: ${prResult.prUrl}`,
                });
              }
            } catch (error) {
              // Log but don't fail the task if git operations fail
              await this.store.addLog(taskId, {
                level: 'warn',
                message: `Git operations failed: ${(error as Error).message}`,
              });
            }
          }
        }
        // If shouldComplete is false, subtasks are paused/incomplete
        // Task stays in-progress and can be resumed later

        return; // Exit the retry loop (either completed or staying in-progress)
      } catch (error) {
        lastError = error as Error;

        // Check if this is a pausable error (rate limit or usage limit)
        const pauseReason = this.isPausableError(lastError);
        if (pauseReason) {
          if (pauseReason === 'rate_limit') {
            const retryAfterSeconds = this.extractRetryAfterSeconds(lastError);
            await this.store.addLog(taskId, {
              level: 'warn',
              message: `Rate limit reached. Pausing task for ${retryAfterSeconds} seconds.`,
            });
            await this.pauseTask(taskId, 'rate_limit', retryAfterSeconds);
          } else {
            // Usage limit - no auto-resume, user needs to add credits or wait for reset
            await this.store.addLog(taskId, {
              level: 'warn',
              message: `Usage limit reached. Task paused. Resume manually when limit resets or credits are added.`,
            });
            await this.pauseTask(taskId, 'usage_limit');
          }
          return; // Exit - task is paused, not failed
        }

        // Check if we should retry
        const canRetry = autoRetry && attempt < maxRetries && this.isRetryableError(lastError);

        if (!canRetry) {
          // No more retries - fail the task with enhanced error message
          const enhancedError = this.parseErrorMessage(lastError);
          await this.updateTaskStatus(taskId, 'failed', enhancedError);
          const failedTask = await this.store.getTask(taskId);
          this.emit('task:failed', failedTask!, lastError);
          throw lastError;
        }

        // Log the failure before retry with enhanced message
        const enhancedRetryMessage = this.parseErrorMessage(lastError);
        await this.store.addLog(taskId, {
          level: 'warn',
          message: `Task failed (attempt ${attempt + 1}/${maxRetries + 1}): ${enhancedRetryMessage}. Retrying...`,
        });
      }
    }

    // This shouldn't be reached, but just in case
    if (lastError) {
      throw lastError;
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      'Task not found',
      'Workflow not found',
      'exceeded budget',
      'cancelled',
      'Invalid',
      'token limit',
      'context length',
      'rate limit exceeded',
      'authentication',
      'unauthorized',
      'forbidden',
      // Usage limit patterns - don't retry, just pause
      'usage limit',
      'limit reached',
      '/upgrade',
      'extra-usage',
      'credit',
      'billing',
      'quota',
    ];

    return !nonRetryablePatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if an error is a rate limit error that should pause the task
   */
  private isRateLimitError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') ||
           message.includes('too many requests') ||
           message.includes('429') ||
           message.includes('overloaded');
  }

  /**
   * Check if an error is a usage/billing limit error that should pause the task
   */
  private isUsageLimitError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('usage limit') ||
           message.includes('credit') ||
           message.includes('billing') ||
           message.includes('quota') ||
           message.includes('spending limit') ||
           message.includes('insufficient') ||
           message.includes('exceeded your') ||
           message.includes('limit exceeded') ||
           message.includes('monthly limit') ||
           message.includes('daily limit') ||
           // Claude Code specific patterns
           message.includes('limit reached') ||
           (message.includes('resets') && message.includes('upgrade')) ||
           message.includes('/upgrade') ||
           message.includes('extra-usage');
  }

  /**
   * Check if an error should pause the task (rate limit or usage limit)
   */
  private isPausableError(error: Error): 'rate_limit' | 'usage_limit' | false {
    if (this.isRateLimitError(error)) {
      return 'rate_limit';
    }
    if (this.isUsageLimitError(error)) {
      return 'usage_limit';
    }
    return false;
  }

  /**
   * Extract retry-after time from rate limit error (in seconds)
   * Returns default of 60 seconds if not found
   */
  private extractRetryAfterSeconds(error: Error): number {
    const message = error.message;

    // Try to extract retry-after from error message
    // Common patterns: "retry after 60 seconds", "retry-after: 60", "wait 60s"
    const patterns = [
      /retry[- ]?after[:\s]+(\d+)/i,
      /wait[:\s]+(\d+)\s*s/i,
      /(\d+)\s*seconds?/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const seconds = parseInt(match[1], 10);
        if (seconds > 0 && seconds < 3600) { // Sanity check: max 1 hour
          return seconds;
        }
      }
    }

    // Default: 60 seconds
    return 60;
  }

  /**
   * Pause a task due to rate limiting or other pausable conditions
   */
  async pauseTask(
    taskId: string,
    reason: 'rate_limit' | 'usage_limit' | 'budget' | 'manual' | 'session_limit' | 'container_failure',
    resumeAfterSeconds?: number
  ): Promise<void> {
    await this.ensureInitialized();

    const now = new Date();
    const resumeAfter = resumeAfterSeconds
      ? new Date(now.getTime() + resumeAfterSeconds * 1000)
      : undefined;

    await this.store.updateTask(taskId, {
      status: 'paused',
      pausedAt: now,
      pauseReason: reason,
      resumeAfter,
      updatedAt: now,
    });

    await this.store.addLog(taskId, {
      level: 'info',
      message: resumeAfter
        ? `Task paused (${reason}). Will auto-resume after ${resumeAfter.toISOString()}`
        : `Task paused (${reason}). Use /resume ${taskId} to continue.`,
    });

    const task = await this.store.getTask(taskId);
    if (task) {
      this.emit('task:paused', task, reason);

      // If this is a subtask, pause the parent task too
      if (task.parentTaskId) {
        await this.pauseParentTask(task.parentTaskId, taskId, reason);
      }
    }

    // Schedule auto-resume if resumeAfter is set
    if (resumeAfter && resumeAfterSeconds) {
      this.scheduleAutoResume(taskId, resumeAfterSeconds * 1000);
    }
  }

  /**
   * Fail a task when maximum resume attempts have been exceeded
   */
  private async failTaskWithMaxResumeError(
    taskId: string,
    attemptCount: number,
    maxAttempts: number
  ): Promise<void> {
    const errorMessage = `Task failed: Maximum resume attempts exceeded (${attemptCount}/${maxAttempts}). ` +
      `This task has been resumed too many times without completing successfully. ` +
      `Consider: (1) Breaking the task into smaller subtasks, ` +
      `(2) Increasing maxResumeAttempts in daemon.sessionRecovery config, ` +
      `(3) Manually investigating the root cause of repeated pauses.`;

    await this.store.addLog(taskId, {
      level: 'error',
      message: errorMessage,
      metadata: {
        resumeAttempts: attemptCount,
        maxResumeAttempts: maxAttempts,
        failureReason: 'max_resume_attempts_exceeded',
      },
    });

    await this.updateTaskStatus(taskId, 'failed', errorMessage);

    const failedTask = await this.store.getTask(taskId);
    if (failedTask) {
      this.emit('task:failed', failedTask, new Error(errorMessage));
    }
  }

  /**
   * Pause a parent task because a subtask was paused
   */
  private async pauseParentTask(
    parentTaskId: string,
    subtaskId: string,
    reason: string
  ): Promise<void> {
    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask || parentTask.status === 'paused') {
      return; // Already paused or doesn't exist
    }

    await this.store.updateTask(parentTaskId, {
      status: 'paused',
      pausedAt: new Date(),
      pauseReason: `subtask_paused:${subtaskId}`,
      updatedAt: new Date(),
    });

    await this.store.addLog(parentTaskId, {
      level: 'info',
      message: `Parent task paused because subtask ${subtaskId} was paused (${reason})`,
    });

    this.emit('task:paused', parentTask, `subtask_paused:${subtaskId}`);
  }

  /**
   * Schedule auto-resume of a task after a delay
   */
  private scheduleAutoResume(taskId: string, delayMs: number): void {
    setTimeout(async () => {
      try {
        const task = await this.store.getTask(taskId);
        if (task && task.status === 'paused' && task.resumeAfter) {
          // Only resume if the task is still paused and the resume time has passed
          if (new Date() >= task.resumeAfter) {
            await this.store.addLog(taskId, {
              level: 'info',
              message: 'Auto-resuming task after rate limit cooldown',
            });
            await this.resumePausedTask(taskId);
          }
        }
      } catch (error) {
        console.error(`Failed to auto-resume task ${taskId}:`, error);
      }
    }, delayMs);
  }

  /**
   * Resume a paused task
   */
  async resumePausedTask(taskId: string): Promise<boolean> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      return false;
    }

    if (task.status !== 'paused') {
      return false; // Not paused
    }

    // Pre-check max resume attempts before clearing pause state
    const maxResumeAttempts = this.effectiveConfig.daemon?.sessionRecovery?.maxResumeAttempts ?? 3;
    const nextAttempt = task.resumeAttempts + 1;

    if (nextAttempt > maxResumeAttempts) {
      await this.failTaskWithMaxResumeError(taskId, nextAttempt, maxResumeAttempts);
      return false;
    }

    // Clear pause-related fields
    await this.store.updateTask(taskId, {
      status: 'in-progress',
      pausedAt: undefined,
      pauseReason: undefined,
      resumeAfter: undefined,
      updatedAt: new Date(),
    });

    await this.store.addLog(taskId, {
      level: 'info',
      message: 'Task resumed',
    });

    // Resume execution from checkpoint
    const resumed = await this.resumeTask(taskId);

    // If this is a subtask, check if parent should also resume
    if (task.parentTaskId) {
      await this.checkAndResumeParent(task.parentTaskId);
    }

    return resumed;
  }

  /**
   * Check if a parent task should resume (all subtasks are no longer paused)
   */
  private async checkAndResumeParent(parentTaskId: string): Promise<void> {
    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask || parentTask.status !== 'paused') {
      return;
    }

    // Check if the pause was due to a subtask
    if (!parentTask.pauseReason?.startsWith('subtask_paused:')) {
      return;
    }

    // Check if all subtasks are no longer paused
    const subtasks = await this.getSubtasks(parentTaskId);
    const anyPaused = subtasks.some(s => s.status === 'paused');

    if (!anyPaused) {
      // All subtasks are no longer paused, resume parent
      await this.store.updateTask(parentTaskId, {
        status: 'in-progress',
        pausedAt: undefined,
        pauseReason: undefined,
        resumeAfter: undefined,
        updatedAt: new Date(),
      });

      await this.store.addLog(parentTaskId, {
        level: 'info',
        message: 'Parent task resumed - all subtasks unpaused',
      });
    }
  }

  /**
   * Parse and enhance error messages from Claude SDK
   * Extracts specific error types for better user feedback
   */
  private parseErrorMessage(error: Error): string {
    const message = error.message || String(error);
    const lowerMessage = message.toLowerCase();

    // Token/context limit errors
    if (lowerMessage.includes('token') || lowerMessage.includes('context length') ||
        lowerMessage.includes('max_tokens') || lowerMessage.includes('context window')) {
      return `Token limit exceeded: The conversation became too long. Consider breaking down the task into smaller subtasks. Original error: ${message}`;
    }

    // Rate limiting
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests') ||
        lowerMessage.includes('429')) {
      return `Rate limit exceeded: Too many API requests. The task will be retried automatically after a delay. Original error: ${message}`;
    }

    // Authentication errors
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication') ||
        lowerMessage.includes('api key') || lowerMessage.includes('401')) {
      return `Authentication error: Invalid or missing API credentials. Please check your API key configuration. Original error: ${message}`;
    }

    // Permission/access errors
    if (lowerMessage.includes('forbidden') || lowerMessage.includes('permission') ||
        lowerMessage.includes('403')) {
      return `Permission denied: You don't have access to the requested resource. Original error: ${message}`;
    }

    // Network errors
    if (lowerMessage.includes('network') || lowerMessage.includes('connection') ||
        lowerMessage.includes('econnrefused') || lowerMessage.includes('timeout')) {
      return `Network error: Failed to connect to the API. Please check your internet connection and try again. Original error: ${message}`;
    }

    // Budget exceeded
    if (lowerMessage.includes('budget') || lowerMessage.includes('cost limit')) {
      return `Budget limit exceeded: The task exceeded the configured cost limit. Original error: ${message}`;
    }

    // Usage/billing limit exceeded
    if (lowerMessage.includes('usage limit') || lowerMessage.includes('credit') ||
        lowerMessage.includes('billing') || lowerMessage.includes('quota') ||
        lowerMessage.includes('spending limit') || lowerMessage.includes('insufficient') ||
        lowerMessage.includes('exceeded your') || lowerMessage.includes('monthly limit') ||
        lowerMessage.includes('daily limit') || lowerMessage.includes('limit reached') ||
        lowerMessage.includes('/upgrade') || lowerMessage.includes('extra-usage')) {
      return `Usage limit reached: Your API usage limit has been exceeded. The task has been paused. Resume when your limit resets or add more credits. Original error: ${message}`;
    }

    // Process exit errors
    if (lowerMessage.includes('exited with code') || lowerMessage.includes('process exit')) {
      const codeMatch = message.match(/code\s*(\d+)/i);
      const exitCode = codeMatch ? codeMatch[1] : 'unknown';

      // Common exit codes
      if (exitCode === '1') {
        return `Process failed (exit code 1): The operation encountered an error. This could be due to token limits, API errors, or internal failures. Check the task logs for more details.`;
      } else if (exitCode === '137') {
        return `Process killed (exit code 137): The process was terminated, possibly due to memory limits or manual cancellation.`;
      } else if (exitCode === '143') {
        return `Process terminated (exit code 143): The process was gracefully terminated by a signal.`;
      }

      return `Process failed with exit code ${exitCode}. Original error: ${message}`;
    }

    // Server errors
    if (lowerMessage.includes('500') || lowerMessage.includes('502') ||
        lowerMessage.includes('503') || lowerMessage.includes('internal server error')) {
      return `Server error: The API service encountered an internal error. This is usually temporary - please try again. Original error: ${message}`;
    }

    // Invalid request
    if (lowerMessage.includes('invalid') || lowerMessage.includes('bad request') ||
        lowerMessage.includes('400')) {
      return `Invalid request: The request was malformed or contained invalid parameters. Original error: ${message}`;
    }

    // Default: return the original message but ensure it's informative
    return message.length > 0 ? message : 'An unknown error occurred during task execution';
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a feature branch for a task
   */
  private async createFeatureBranch(branchName: string): Promise<void> {
    try {
      // Check if branch already exists
      const { stdout: existingBranches } = await execAsync(
        `git branch --list "${branchName}"`,
        { cwd: this.projectPath }
      );

      if (existingBranches.trim()) {
        // Branch exists, just check it out
        await execAsync(`git checkout "${branchName}"`, { cwd: this.projectPath });
      } else {
        // Create and checkout new branch
        await execAsync(`git checkout -b "${branchName}"`, { cwd: this.projectPath });
      }
    } catch (error) {
      // If checkout fails (e.g., uncommitted changes), log but don't fail
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Could not create/checkout branch ${branchName}: ${errorMessage}`);
    }
  }

  /**
   * Run the workflow for a task - with parallel stage execution
   * Returns true if the task should be marked as completed, false if it should stay in-progress
   */
  private async runWorkflow(task: Task, workflow: WorkflowDefinition): Promise<boolean> {
    const stageResults = new Map<string, StageResult>();
    const completedStages = new Set<string>();
    const inProgressStages = new Set<string>();
    const allStages = new Set(workflow.stages.map(s => s.name));

    // Set up workspace isolation based on workflow configuration
    if (workflow.isolation) {
      try {
        await this.store.addLog(task.id, {
          level: 'info',
          message: `Setting up isolation mode: ${workflow.isolation.mode}`,
        });

        const workspaceInfo = await this.workspaceManager.createWorkspaceWithIsolation(task, workflow.isolation);

        await this.store.addLog(task.id, {
          level: 'info',
          message: `Isolated workspace created at: ${workspaceInfo.workspacePath}`,
        });
      } catch (error) {
        await this.store.addLog(task.id, {
          level: 'error',
          message: `Failed to setup workspace isolation: ${(error as Error).message}`,
        });
        throw error;
      }
    }

    await this.store.addLog(task.id, {
      level: 'info',
      message: `Starting workflow "${workflow.name}" with ${workflow.stages.length} stages`,
    });

    // Continue until all stages are complete
    while (completedStages.size < allStages.size) {
      // Check if task was cancelled
      const currentTask = await this.store.getTask(task.id);
      if (currentTask?.status === 'cancelled') {
        await this.store.addLog(task.id, {
          level: 'info',
          message: 'Task was cancelled, stopping workflow execution',
        });
        return false; // Task was cancelled, don't mark as completed
      }

      // Check session limits before continuing workflow execution
      const sessionLimitStatus = await this.detectSessionLimit(task.id);

      if (sessionLimitStatus.recommendation === 'checkpoint' || sessionLimitStatus.recommendation === 'handoff') {
        // Session is approaching or at limit - save checkpoint and pause workflow
        await this.store.addLog(task.id, {
          level: 'warn',
          message: `Session limit detected in workflow: ${sessionLimitStatus.message}. Saving checkpoint and pausing task.`,
        });

        // Get current conversation state for checkpoint
        const conversationState = currentTask?.conversation || [];

        // Save checkpoint with current workflow state
        const checkpointId = await this.saveCheckpoint(task.id, {
          stage: 'workflow',
          stageIndex: 0, // workflow level checkpoint
          conversationState,
          metadata: {
            sessionLimitStatus,
            pauseReason: 'session_limit',
            resumePoint: 'workflow_continue',
            completedStages: Array.from(completedStages),
            inProgressStages: Array.from(inProgressStages),
            stageResults: Object.fromEntries(stageResults),
          },
        });

        // Pause task with session_limit reason
        await this.pauseTask(task.id, 'session_limit');

        // Log session limit event
        await this.store.addLog(task.id, {
          level: 'info',
          message: `Workflow paused due to session limit. Checkpoint ${checkpointId} saved. Use /resume ${task.id} to continue from this point.`,
        });

        return false; // Task should not be marked as completed, it's paused
      }

      // Find all stages ready to run (dependencies met, not completed, not in progress)
      const readyStages = workflow.stages.filter(stage =>
        !completedStages.has(stage.name) &&
        !inProgressStages.has(stage.name) &&
        this.areDependenciesMet(stage, stageResults)
      );

      if (readyStages.length === 0) {
        // No stages ready - check if we're stuck
        if (inProgressStages.size === 0) {
          // No stages in progress and none ready - we're stuck (circular dependency or all done)
          const remaining = workflow.stages.filter(s => !completedStages.has(s.name));
          if (remaining.length > 0) {
            throw new Error(`Workflow stuck: stages ${remaining.map(s => s.name).join(', ')} cannot be executed (check dependencies)`);
          }
          break;
        }
        // Wait a bit for in-progress stages to complete
        await this.sleep(100);
        continue;
      }

      // Log parallel execution
      if (readyStages.length > 1) {
        await this.store.addLog(task.id, {
          level: 'info',
          message: `Running ${readyStages.length} stages in parallel: ${readyStages.map(s => s.name).join(', ')}`,
        });

        // Emit parallel execution started event
        const stageNames = readyStages.map(s => s.name);
        const agentNames = readyStages.map(s => s.agent);
        this.emit('stage:parallel-started', task.id, stageNames, agentNames);
      }

      // Mark stages as in progress
      for (const stage of readyStages) {
        inProgressStages.add(stage.name);
      }

      // Execute ready stages in parallel
      const stagePromises = readyStages.map(async (stage) => {
        const agent = this.agents[stage.agent];
        if (!agent) {
          throw new Error(`Agent "${stage.agent}" not found for stage "${stage.name}"`);
        }

        // Update task stage (for single stage) or log parallel
        if (readyStages.length === 1) {
          await this.store.updateTask(task.id, {
            currentStage: stage.name,
            updatedAt: new Date(),
          });
        }
        this.emit('task:stage-changed', task, stage.name);

        // Emit agent transition event - we'll let the REPL track previous agent
        this.emit('agent:transition', task.id, null, stage.agent);

        await this.store.addLog(task.id, {
          level: 'info',
          message: `Starting stage "${stage.name}" with agent "${agent.name}"`,
          stage: stage.name,
          agent: agent.name,
        });

        try {
          const result = await this.executeWorkflowStage(task, stage, agent, workflow, stageResults, undefined);

          await this.store.addLog(task.id, {
            level: 'info',
            message: `Stage "${stage.name}" completed: ${result.summary.substring(0, 200)}`,
            stage: stage.name,
            agent: agent.name,
          });

          return { stage, result, error: null, decompositionRequest: result.decompositionRequest };
        } catch (error) {
          // Parse and enhance the error message for better feedback
          const rawError = error instanceof Error ? error : new Error(String(error));
          const enhancedErrorMessage = this.parseErrorMessage(rawError);

          await this.store.addLog(task.id, {
            level: 'error',
            message: `Stage "${stage.name}" failed: ${enhancedErrorMessage}`,
            stage: stage.name,
            agent: agent.name,
          });

          const failedResult: StageResult = {
            stageName: stage.name,
            agent: agent.name,
            status: 'failed',
            outputs: {},
            artifacts: [],
            summary: `Stage failed: ${enhancedErrorMessage}`,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
            error: enhancedErrorMessage,
            startedAt: new Date(),
            completedAt: new Date(),
          };

          return { stage, result: failedResult, error: rawError };
        }
      });

      // Wait for all parallel stages to complete
      const results = await Promise.all(stagePromises);

      // Process results
      let firstError: Error | null = null;
      let decompositionRequest: DecompositionRequest | undefined;

      for (const { stage, result, error, decompositionRequest: decompReq } of results) {
        inProgressStages.delete(stage.name);
        completedStages.add(stage.name);
        stageResults.set(stage.name, result);

        // Save checkpoint
        await this.saveCheckpoint(task.id, {
          stage: stage.name,
          stageIndex: workflow.stages.findIndex(s => s.name === stage.name),
          metadata: {
            stageResult: result,
            completedStages: Array.from(completedStages),
          },
        });

        if (error && !firstError) {
          firstError = error;
        }

        // Capture decomposition request from planning stage
        if (decompReq?.shouldDecompose) {
          decompositionRequest = decompReq;
        }
      }

      // Emit parallel execution completed event if we just finished parallel execution
      if (results.length > 1) {
        this.emit('stage:parallel-completed', task.id);
      }

      // If any stage failed, throw the first error
      if (firstError) {
        throw firstError;
      }

      // Handle decomposition request from planner
      if (decompositionRequest && decompositionRequest.shouldDecompose) {
        await this.store.addLog(task.id, {
          level: 'info',
          message: `Task decomposition requested: creating ${decompositionRequest.subtasks.length} subtasks with ${decompositionRequest.strategy} strategy`,
        });

        // Create subtasks
        const subtasks = await this.decomposeTask(
          task.id,
          decompositionRequest.subtasks,
          decompositionRequest.strategy
        );

        await this.store.addLog(task.id, {
          level: 'info',
          message: `Created ${subtasks.length} subtasks. Switching to subtask execution mode.`,
        });

        // Update parent task status to indicate it's waiting on subtasks
        await this.store.updateTask(task.id, {
          status: 'in-progress',
          currentStage: 'subtask-execution',
          updatedAt: new Date(),
        });

        // Execute subtasks according to strategy
        const allSubtasksComplete = await this.executeSubtasks(task.id);

        if (allSubtasksComplete) {
          // All subtasks completed successfully - workflow is done
          await this.store.addLog(task.id, {
            level: 'info',
            message: `All subtasks completed. Workflow finished via decomposition.`,
          });
          return true; // Task can be marked as completed
        } else {
          // Some subtasks are incomplete (paused, pending, or failed)
          // Task should stay in-progress, not be marked as completed
          await this.store.addLog(task.id, {
            level: 'info',
            message: `Subtask execution paused or incomplete. Task will remain in-progress.`,
          });
          return false; // Task should NOT be marked as completed
        }
      }
    }

    await this.store.addLog(task.id, {
      level: 'info',
      message: `Workflow "${workflow.name}" completed successfully. Stages completed: ${Array.from(completedStages).join(', ')}`,
    });

    return true; // Workflow completed, task can be marked as completed
  }

  /**
   * Execute a single workflow stage with its designated agent
   * Returns a StageResult, which may include a decomposition request for planning stages
   */
  private async executeWorkflowStage(
    task: Task,
    stage: WorkflowStage,
    agent: AgentDefinition,
    workflow: WorkflowDefinition,
    previousResults: Map<string, StageResult>,
    resumeContext?: string
  ): Promise<StageResult & { decompositionRequest?: DecompositionRequest }> {
    const startedAt = new Date();
    const isPlanner = isPlanningStage(stage);

    // Build focused prompt for this stage
    // Use special planner prompt if this is a planning stage
    let stagePrompt = isPlanner
      ? buildPlannerStagePrompt({
          task,
          stage,
          agent,
          workflow,
          config: this.effectiveConfig,
          previousStageResults: previousResults,
        })
      : buildStagePrompt({
          task,
          stage,
          agent,
          workflow,
          config: this.effectiveConfig,
          previousStageResults: previousResults,
        });

    // Inject resume context if available (only for the first stage being resumed)
    if (resumeContext) {
      stagePrompt = `${resumeContext}\n\n${stagePrompt}`;
    }

    // Create hooks for this stage
    const hooks = createHooks({
      taskId: task.id,
      store: this.store,
      onToolUse: (tool, input) => {
        this.emit('agent:tool-use', task.id, tool, input);
      },
    });

    // Track usage for this stage
    let stageUsage: TaskUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };

    // Collect all messages to extract summary
    const messages: string[] = [];

    // Convert agent model to SDK model format
    const sdkModel = agent.model === 'opus' ? 'claude-opus-4-5-20251101' :
                     agent.model === 'haiku' ? 'claude-3-5-haiku-20241022' :
                     'claude-sonnet-4-20250514';

    // Check session limits before starting agent query
    const sessionLimitStatus = await this.detectSessionLimit(task.id);

    if (sessionLimitStatus.recommendation === 'checkpoint' || sessionLimitStatus.recommendation === 'handoff') {
      // Session is approaching or at limit - save checkpoint and pause task
      await this.store.addLog(task.id, {
        level: 'warn',
        message: `Session limit detected: ${sessionLimitStatus.message}. Saving checkpoint and pausing task.`,
        stage: stage.name,
        agent: agent.name,
      });

      // Get current conversation state for checkpoint
      const currentTask = await this.store.getTask(task.id);
      const conversationState = currentTask?.conversation || [];

      // Save checkpoint with current conversation state
      const checkpointId = await this.saveCheckpoint(task.id, {
        stage: stage.name,
        stageIndex: workflow.stages.findIndex(s => s.name === stage.name),
        conversationState,
        metadata: {
          sessionLimitStatus,
          pauseReason: 'session_limit',
          resumePoint: 'stage_start',
        },
      });

      // Pause task with session_limit reason
      await this.pauseTask(task.id, 'session_limit');

      // Log session limit event
      await this.store.addLog(task.id, {
        level: 'info',
        message: `Task paused due to session limit. Checkpoint ${checkpointId} saved. Use /resume ${task.id} to continue from this point.`,
        stage: stage.name,
        agent: agent.name,
      });

      // Throw a specific error to halt execution gracefully
      throw new Error(`Session limit reached: ${sessionLimitStatus.message}. Task paused at checkpoint ${checkpointId}.`);
    }

    // Check if task has container workspace for execution context
    let workspaceInfo: any = null;
    let containerId: string | undefined = undefined;

    try {
      workspaceInfo = this.workspaceManager.getWorkspace(task.id);
    } catch (error) {
      // Log warning but continue with default behavior
      await this.store.addLog(task.id, {
        level: 'warn',
        message: `Failed to get workspace info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: stage.name,
        agent: agent.name,
      });
    }

    try {
      containerId = this.workspaceManager.getContainerIdForTask(task.id);
    } catch (error) {
      // Log warning but continue with default behavior
      await this.store.addLog(task.id, {
        level: 'warn',
        message: `Failed to get container ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: stage.name,
        agent: agent.name,
      });
    }

    // Determine working directory based on workspace configuration
    // Also validate that workspace path is not empty
    const workingDirectory = (workspaceInfo && workspaceInfo.workspacePath && workspaceInfo.workspacePath.trim() !== '')
      ? workspaceInfo.workspacePath
      : this.projectPath;

    // Execute stage via Claude Agent SDK
    // Wrap in try-catch to detect limit errors from collected messages
    try {
    for await (const message of query({
      prompt: stagePrompt,
      options: {
        model: sdkModel,
        permissionMode: 'acceptEdits',
        maxTurns: Math.min(this.effectiveConfig.limits.maxTurns, 50), // Limit per-stage turns
        settingSources: ['project'],
        cwd: workingDirectory,
        env: {
          ...process.env,
          APEX_API: this.apiUrl,
          APEX_TASK_ID: task.id,
          APEX_PROJECT: this.projectPath,
          APEX_BRANCH: task.branchName || '',
          APEX_STAGE: stage.name,
          APEX_AGENT: agent.name,
          // Container execution context environment variables
          // Only set if containerId exists and is not empty
          ...(containerId && containerId.trim() !== '' && { APEX_CONTAINER_ID: containerId }),
          // Only set if workspaceInfo exists and has non-empty workspacePath
          ...(workspaceInfo && workspaceInfo.workspacePath && workspaceInfo.workspacePath.trim() !== '' && { APEX_WORKSPACE_PATH: workspaceInfo.workspacePath }),
        },
        hooks,
      },
    })) {
      // Emit message for streaming
      this.emit('agent:message', task.id, message);

      // Collect text content for summary extraction and log AI responses
      if (message && typeof message === 'object') {
        // Extract text content and thinking from SDK message format
        // SDK messages have type: 'assistant' with nested message.content array
        // or type: 'result' with result string
        let textContent = '';
        let thinkingContent = '';

        const msg = message as Record<string, unknown>;

        if (msg.type === 'assistant' && msg.message && typeof msg.message === 'object') {
          // Assistant messages have content as array of blocks
          const apiMessage = msg.message as {
            content?: Array<{
              type: string;
              text?: string;
              thinking?: string;
            }>;
            thinking?: string;
          };

          if (Array.isArray(apiMessage.content)) {
            for (const block of apiMessage.content) {
              if (block.type === 'text' && block.text) {
                textContent += block.text + '\n';
              } else if (block.type === 'thinking' && 'thinking' in block && typeof block.thinking === 'string') {
                // Extract thinking content from content blocks
                thinkingContent += block.thinking;
              }
            }
          }

          // Fallback: Extract thinking content if available as direct property (legacy support)
          if (typeof apiMessage.thinking === 'string' && !thinkingContent) {
            thinkingContent = apiMessage.thinking;
          }
        } else if (msg.type === 'result' && typeof msg.result === 'string') {
          textContent = msg.result;
        } else if ('content' in msg && typeof msg.content === 'string') {
          // Fallback for simple content string
          textContent = msg.content;
        }

        if (textContent.trim().length > 0) {
          messages.push(textContent);

          // Log AI text responses (truncate long messages)
          const truncated = textContent.length > 500
            ? textContent.substring(0, 500) + '...'
            : textContent;
          await this.store.addLog(task.id, {
            level: 'info',
            message: truncated,
            stage: stage.name,
            agent: agent.name,
          });
        }

        // Emit thinking content if available
        if (thinkingContent.trim().length > 0) {
          this.emit('agent:thinking', task.id, agent.name, thinkingContent);

          // Log thinking content for debugging (verbose only)
          await this.store.addLog(task.id, {
            level: 'debug',
            message: `[THINKING] ${thinkingContent.length > 200 ? thinkingContent.substring(0, 200) + '...' : thinkingContent}`,
            stage: stage.name,
            agent: agent.name,
          });
        }
      }

      // Track usage
      if (message && typeof message === 'object' && 'usage' in message) {
        const usage = message.usage as { input_tokens?: number; output_tokens?: number };
        const inputDelta = usage.input_tokens || 0;
        const outputDelta = usage.output_tokens || 0;

        stageUsage.inputTokens += inputDelta;
        stageUsage.outputTokens += outputDelta;
        stageUsage.totalTokens = stageUsage.inputTokens + stageUsage.outputTokens;
        stageUsage.estimatedCost = calculateCost(stageUsage.inputTokens, stageUsage.outputTokens);

        // Update task-level usage
        await this.updateUsage(task.id, {
          inputTokens: inputDelta,
          outputTokens: outputDelta,
        });
      }

      // Check budget
      const currentTask = await this.store.getTask(task.id);
      if (currentTask && currentTask.usage.estimatedCost > this.effectiveConfig.limits.maxCostPerTask) {
        throw new Error(
          `Task exceeded budget: $${currentTask.usage.estimatedCost.toFixed(4)} > $${this.effectiveConfig.limits.maxCostPerTask}`
        );
      }
    }
    } catch (error) {
      // Check if collected messages contain limit-related text
      // This catches cases where "Limit reached" is logged before process exits
      const fullOutput = messages.join('\n').toLowerCase();
      const isLimitError = fullOutput.includes('limit reached') ||
                          fullOutput.includes('/upgrade') ||
                          fullOutput.includes('extra-usage') ||
                          fullOutput.includes('resets') && fullOutput.includes('upgrade');

      if (isLimitError) {
        // Rethrow with limit-specific message so it can be detected and paused
        throw new Error(`Usage limit reached: ${(error as Error).message}. Recent output: ${messages.slice(-2).join(' ').substring(0, 200)}`);
      }

      // Rethrow original error
      throw error;
    }

    // Extract stage summary and outputs from the final messages
    const { summary, outputs, artifacts } = this.parseStageOutput(messages, stage);

    // For planning stages, check if the output contains a decomposition request
    let decompositionRequest: DecompositionRequest | undefined;
    if (isPlanner) {
      const fullOutput = messages.join('\n');
      decompositionRequest = parseDecompositionRequest(fullOutput);

      if (decompositionRequest.shouldDecompose) {
        await this.store.addLog(task.id, {
          level: 'info',
          message: `Planner requested decomposition: ${decompositionRequest.subtasks.length} subtasks (${decompositionRequest.strategy})`,
          stage: stage.name,
        });
      }
    }

    return {
      stageName: stage.name,
      agent: agent.name,
      status: 'completed',
      outputs,
      artifacts,
      summary,
      usage: stageUsage,
      startedAt,
      completedAt: new Date(),
      decompositionRequest,
    };
  }

  /**
   * Parse the agent's output to extract summary, outputs, and artifacts
   */
  private parseStageOutput(
    messages: string[],
    stage: WorkflowStage
  ): { summary: string; outputs: Record<string, unknown>; artifacts: string[] } {
    const fullOutput = messages.join('\n');

    // Try to find the structured summary block
    const summaryMatch = fullOutput.match(/### Stage Summary:[\s\S]*?\*\*Status\*\*:\s*(completed|failed)[\s\S]*?\*\*Summary\*\*:\s*([^\n]+)[\s\S]*?(?:\*\*Files Modified\*\*:\s*([^\n]+))?[\s\S]*?(?:\*\*Outputs\*\*:\s*([^\n]+))?/i);

    let summary = `Completed ${stage.name} stage`;
    let artifacts: string[] = [];
    const outputs: Record<string, unknown> = {};

    if (summaryMatch) {
      summary = summaryMatch[2]?.trim() || summary;

      // Parse files modified
      if (summaryMatch[3]) {
        artifacts = summaryMatch[3].split(',').map(f => f.trim()).filter(Boolean);
      }

      // Parse outputs
      if (summaryMatch[4]) {
        outputs['result'] = summaryMatch[4].trim();
      }
    } else {
      // Fallback: use the last substantive message as summary
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        summary = lastMessage.substring(0, 500);
      }
    }

    // Extract file paths mentioned in the output
    const fileMatches = fullOutput.match(/(?:created|modified|wrote|edited|updated)[\s:]+([^\s,]+\.[a-z]+)/gi);
    if (fileMatches) {
      for (const match of fileMatches) {
        const fileMatch = match.match(/([^\s,]+\.[a-z]+)/i);
        if (fileMatch && fileMatch[1]) {
          artifacts.push(fileMatch[1]);
        }
      }
    }

    // Populate expected outputs from stage definition
    if (stage.outputs) {
      for (const outputName of stage.outputs) {
        if (!outputs[outputName]) {
          // Try to find the output in the full text
          const outputRegex = new RegExp(`${outputName}[:\\s]+([^\\n]+)`, 'i');
          const outputMatch = fullOutput.match(outputRegex);
          if (outputMatch) {
            outputs[outputName] = outputMatch[1].trim();
          }
        }
      }
    }

    return {
      summary,
      outputs,
      artifacts: [...new Set(artifacts)], // Deduplicate
    };
  }

  /**
   * Get stages in execution order, respecting dependencies
   */
  private getStageExecutionOrder(stages: WorkflowStage[]): WorkflowStage[] {
    const ordered: WorkflowStage[] = [];
    const completed = new Set<string>();
    const remaining = [...stages];

    while (remaining.length > 0) {
      const readyIndex = remaining.findIndex(stage => {
        if (!stage.dependsOn || stage.dependsOn.length === 0) {
          return true;
        }
        return stage.dependsOn.every(dep => completed.has(dep));
      });

      if (readyIndex === -1) {
        // Circular dependency or unresolvable - add remaining in order
        ordered.push(...remaining);
        break;
      }

      const readyStage = remaining.splice(readyIndex, 1)[0];
      ordered.push(readyStage);
      completed.add(readyStage.name);
    }

    return ordered;
  }

  /**
   * Check if a stage's dependencies are met
   */
  private areDependenciesMet(stage: WorkflowStage, completedResults: Map<string, StageResult>): boolean {
    if (!stage.dependsOn || stage.dependsOn.length === 0) {
      return true;
    }

    return stage.dependsOn.every(depName => {
      const result = completedResults.get(depName);
      return result && result.status === 'completed';
    });
  }

  /**
   * Build the initial task prompt
   */
  private buildTaskPrompt(task: Task): string {
    let prompt = `# Task: ${task.description}\n\n`;

    if (task.acceptanceCriteria) {
      prompt += `## Acceptance Criteria\n${task.acceptanceCriteria}\n\n`;
    }

    prompt += `## Instructions\n`;
    prompt += `You are already on branch \`${task.branchName}\`.\n\n`;
    prompt += `1. Follow the workflow stages in order\n`;
    prompt += `2. Delegate to appropriate subagents for each stage\n`;
    prompt += `3. Run tests before completing\n`;
    prompt += `4. Commit changes with conventional commit messages\n`;

    return prompt;
  }

  /**
   * Update task status
   * SAFEGUARD: Prevents marking a parent task as 'completed' if it has incomplete subtasks
   */
  async updateTaskStatus(taskId: string, status: TaskStatus, error?: string): Promise<void> {
    // SAFEGUARD: Check for incomplete subtasks before allowing completion
    if (status === 'completed') {
      const task = await this.store.getTask(taskId);
      if (task && task.subtaskIds && task.subtaskIds.length > 0) {
        // Check all subtask statuses
        let incompleteCount = 0;
        let failedCount = 0;
        for (const subtaskId of task.subtaskIds) {
          const subtask = await this.store.getTask(subtaskId);
          if (subtask) {
            if (subtask.status === 'failed') {
              failedCount++;
            } else if (subtask.status !== 'completed' && subtask.status !== 'cancelled') {
              incompleteCount++;
            }
          }
        }

        // If any subtasks are incomplete, don't allow completion
        if (incompleteCount > 0) {
          await this.store.addLog(taskId, {
            level: 'warn',
            message: `BLOCKED: Cannot mark task as completed - ${incompleteCount} subtasks are still incomplete`,
          });
          return; // Don't update status
        }

        // If any subtasks failed, mark parent as failed instead
        if (failedCount > 0) {
          await this.store.addLog(taskId, {
            level: 'warn',
            message: `BLOCKED: Cannot mark task as completed - ${failedCount} subtasks failed`,
          });
          status = 'failed' as TaskStatus;
          error = error || `${failedCount} subtask(s) failed`;
        }
      }
    }

    await this.store.updateTask(taskId, {
      status,
      error,
      updatedAt: new Date(),
      ...(status === 'completed' ? {
        completedAt: new Date(),
        resumeAttempts: 0  // Reset resume attempts counter on successful completion
      } : {}),
    });

    // Handle worktree cleanup for completed, failed, or cancelled tasks
    if ((status === 'completed' || status === 'failed' || status === 'cancelled') && this.worktreeManager) {
      await this.cleanupWorktree(taskId, status);
    }
  }

  /**
   * Get worktree information for a specific task
   * @param taskId The task identifier
   * @returns WorktreeInfo if found, null otherwise
   */
  async getTaskWorktree(taskId: string): Promise<WorktreeInfo | null> {
    if (!this.worktreeManager) {
      return null;
    }
    return this.worktreeManager.getWorktree(taskId);
  }

  /**
   * List all task worktrees
   * @returns Array of WorktreeInfo objects
   */
  async listTaskWorktrees(): Promise<WorktreeInfo[]> {
    if (!this.worktreeManager) {
      return [];
    }
    const allWorktrees = await this.worktreeManager.listWorktrees();
    // Filter to only include task worktrees (those with taskId)
    return allWorktrees.filter(w => w.taskId && !w.isMain);
  }

  /**
   * Switch to a worktree for a specific task
   * @param taskId The task identifier
   * @returns The absolute path to the worktree directory
   */
  async switchToTaskWorktree(taskId: string): Promise<string> {
    if (!this.worktreeManager) {
      throw new Error('Worktree management is not enabled for this project');
    }
    return this.worktreeManager.switchToWorktree(taskId);
  }

  /**
   * Clean up orphaned worktrees
   * @returns Array of taskIds for worktrees that were cleaned up
   */
  async cleanupOrphanedWorktrees(): Promise<string[]> {
    if (!this.worktreeManager) {
      return [];
    }
    return this.worktreeManager.cleanupOrphanedWorktrees();
  }

  /**
   * Clean up worktree for a specific task
   * @param taskId The ID of the task to cleanup
   * @returns boolean indicating if the worktree was successfully cleaned up
   */
  async cleanupTaskWorktree(taskId: string): Promise<boolean> {
    if (!this.worktreeManager) {
      throw new Error('Worktree management is not enabled');
    }

    if (!taskId) {
      throw new Error('Task ID is required');
    }

    return this.worktreeManager.deleteWorktree(taskId);
  }

  /**
   * Clean up worktree for a merged task after verifying PR merge status
   * @param taskId The ID of the task to cleanup
   * @returns Promise<boolean> indicating if the worktree was successfully cleaned up
   */
  async cleanupMergedWorktree(taskId: string): Promise<boolean> {
    if (!this.worktreeManager) {
      throw new Error('Worktree management is not enabled');
    }

    if (!taskId) {
      throw new Error('Task ID is required');
    }

    await this.ensureInitialized();

    // Get task information
    const task = await this.store.getTask(taskId);
    if (!task) {
      await this.store.addLog(taskId, {
        level: 'warn',
        message: 'Cannot cleanup worktree: task not found',
      });
      return false;
    }

    // Verify PR is merged before cleanup
    const isMerged = await this.checkPRMerged(taskId);
    if (!isMerged) {
      await this.store.addLog(taskId, {
        level: 'info',
        message: 'PR not merged yet, skipping worktree cleanup',
      });
      return false;
    }

    // Get worktree info for the event
    const worktreeInfo = await this.worktreeManager.getWorktree(taskId);
    if (!worktreeInfo) {
      await this.store.addLog(taskId, {
        level: 'warn',
        message: 'No worktree found for task, cleanup not needed',
      });
      return false;
    }

    const worktreePath = worktreeInfo.path;
    const prUrl = task.prUrl || 'unknown';

    // Delete the worktree
    try {
      const deleted = await this.worktreeManager.deleteWorktree(taskId);

      if (deleted) {
        // Emit the merge-cleaned event
        this.emit('worktree:merge-cleaned', taskId, worktreePath, prUrl);

        // Log the cleanup action
        await this.store.addLog(taskId, {
          level: 'info',
          message: `Cleaned up worktree after merge detected: ${worktreePath}`,
        });

        return true;
      } else {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: 'Failed to delete worktree (worktree may not exist)',
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.store.addLog(taskId, {
        level: 'error',
        message: `Error cleaning up worktree after merge: ${errorMessage}`,
      });
      return false;
    }
  }

  /**
   * Clean up worktree for a task based on its final status and configuration
   */
  private async cleanupWorktree(taskId: string, status: TaskStatus): Promise<void> {
    try {
      const task = await this.store.getTask(taskId);
      if (!task || !task.workspace || task.workspace.strategy !== 'worktree') {
        return;
      }

      const worktreePath = task.workspace.path;
      if (!worktreePath) {
        return;
      }

      // Determine if we should cleanup based on status and configuration
      let shouldCleanup = false;

      if (status === 'completed') {
        // Always cleanup on successful completion if configured to do so
        shouldCleanup = task.workspace.cleanup;
      } else if (status === 'cancelled') {
        // Always cleanup cancelled tasks
        shouldCleanup = true;
      } else if (status === 'failed') {
        // For failed tasks, only cleanup if not configured to preserve on failure
        const preserveOnFailure = this.effectiveConfig.git.worktree?.preserveOnFailure ?? false;
        shouldCleanup = task.workspace.cleanup && !preserveOnFailure;
      }

      if (shouldCleanup) {
        const delayMs = this.effectiveConfig.git.worktree?.cleanupDelayMs ?? 0;

        if (delayMs > 0) {
          await this.store.addLog(taskId, {
            level: 'info',
            message: `Scheduling worktree cleanup in ${delayMs}ms: ${worktreePath}`,
          });

          // Use setTimeout to delay the cleanup
          setTimeout(async () => {
            try {
              const deleted = await this.worktreeManager!.deleteWorktree(taskId);
              if (deleted) {
                this.emit('worktree:cleaned', taskId, worktreePath);

                await this.store.addLog(taskId, {
                  level: 'info',
                  message: `Cleaned up worktree after delay: ${worktreePath}`,
                });
              }
            } catch (error) {
              console.warn(`Failed to cleanup worktree for task ${taskId} after delay:`, error);

              await this.store.addLog(taskId, {
                level: 'warn',
                message: `Failed to cleanup worktree after delay: ${error instanceof Error ? error.message : error}`,
              });
            }
          }, delayMs);
        } else {
          // Immediate cleanup
          const deleted = await this.worktreeManager!.deleteWorktree(taskId);
          if (deleted) {
            this.emit('worktree:cleaned', taskId, worktreePath);

            await this.store.addLog(taskId, {
              level: 'info',
              message: `Cleaned up worktree: ${worktreePath}`,
            });
          }
        }
      } else {
        await this.store.addLog(taskId, {
          level: 'info',
          message: `Preserved worktree for debugging: ${worktreePath}`,
        });
      }
    } catch (error) {
      console.warn(`Failed to cleanup worktree for task ${taskId}:`, error);

      await this.store.addLog(taskId, {
        level: 'warn',
        message: `Failed to cleanup worktree: ${error instanceof Error ? error.message : error}`,
      });
    }
  }

  /**
   * Update task usage
   */
  private async updateUsage(
    taskId: string,
    delta: { inputTokens: number; outputTokens: number }
  ): Promise<void> {
    const task = await this.store.getTask(taskId);
    if (!task) return;

    const inputTokens = task.usage.inputTokens + delta.inputTokens;
    const outputTokens = task.usage.outputTokens + delta.outputTokens;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = calculateCost(inputTokens, outputTokens);

    const usage: TaskUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
    };

    await this.store.updateTask(taskId, { usage });
    this.emit('usage:updated', taskId, usage);
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    await this.ensureInitialized();
    return this.store.getTask(taskId);
  }

  /**
   * List all tasks
   */
  async listTasks(options?: { status?: TaskStatus; limit?: number }): Promise<Task[]> {
    await this.ensureInitialized();
    return this.store.listTasks(options);
  }

  /**
   * Get available agents
   */
  async getAgents(): Promise<Record<string, AgentDefinition>> {
    await this.ensureInitialized();
    return this.agents;
  }

  /**
   * Get configuration
   */
  async getConfig(): Promise<ApexConfig> {
    await this.ensureInitialized();
    return this.config;
  }

  /**
   * Get task logs
   */
  async getTaskLogs(taskId: string, options?: { level?: string; limit?: number; offset?: number }): Promise<import('@apexcli/core').TaskLog[]> {
    await this.ensureInitialized();
    return this.store.getLogs(taskId, options);
  }

  /**
   * Approve a gate
   */
  async approveGate(taskId: string, gateName: string, approver: string, comment?: string): Promise<void> {
    await this.ensureInitialized();
    await this.store.approveGate(taskId, gateName, approver, comment);
  }

  /**
   * Reject a gate
   */
  async rejectGate(taskId: string, gateName: string, rejector: string, comment?: string): Promise<void> {
    await this.ensureInitialized();
    await this.store.rejectGate(taskId, gateName, rejector, comment);
  }

  /**
   * Get a gate
   */
  async getGate(taskId: string, gateName: string): Promise<import('@apexcli/core').Gate | null> {
    await this.ensureInitialized();
    return this.store.getGate(taskId, gateName);
  }

  /**
   * Get all gates for a task
   */
  async getAllGates(taskId: string): Promise<import('@apexcli/core').Gate[]> {
    await this.ensureInitialized();
    return this.store.getAllGates(taskId);
  }

  /**
   * Get pending gates for a task
   */
  async getPendingGates(taskId: string): Promise<import('@apexcli/core').Gate[]> {
    await this.ensureInitialized();
    return this.store.getPendingGates(taskId);
  }

  // ============================================================================
  // Thought Capture Operations
  // ============================================================================

  /**
   * Capture a new thought or idea
   */
  async captureThought(
    content: string,
    options: {
      tags?: string[];
      priority?: import('@apexcli/core').ThoughtCapture['priority'];
      taskId?: string;
    } = {}
  ): Promise<import('@apexcli/core').ThoughtCapture> {
    await this.ensureInitialized();
    return this.thoughtCaptureManager.captureThought(content, options);
  }

  /**
   * Get a thought by ID
   */
  async getThought(thoughtId: string): Promise<import('@apexcli/core').ThoughtCapture | null> {
    await this.ensureInitialized();
    return this.thoughtCaptureManager.getThought(thoughtId);
  }

  /**
   * Get all thoughts
   */
  async getAllThoughts(): Promise<import('@apexcli/core').ThoughtCapture[]> {
    await this.ensureInitialized();
    return this.thoughtCaptureManager.getAllThoughts();
  }

  /**
   * Search thoughts based on criteria
   */
  async searchThoughts(criteria: {
    query: string;
    tags?: string[];
    priority?: import('@apexcli/core').ThoughtCapture['priority'];
    status?: import('@apexcli/core').ThoughtCapture['status'];
    fromDate?: Date;
    toDate?: Date;
  }): Promise<import('@apexcli/core').ThoughtCapture[]> {
    await this.ensureInitialized();
    return this.thoughtCaptureManager.searchThoughts(criteria);
  }

  /**
   * Convert a thought into a task for implementation
   */
  async promoteThought(
    thoughtId: string,
    options: {
      workflow?: string;
      priority?: CreateTaskRequest['priority'];
      acceptanceCriteria?: string;
    } = {}
  ): Promise<string> {
    await this.ensureInitialized();
    return this.thoughtCaptureManager.implementThought(thoughtId, options);
  }

  /**
   * Update a thought's status or properties
   */
  async updateThought(
    thoughtId: string,
    updates: Partial<Pick<import('@apexcli/core').ThoughtCapture, 'status' | 'priority' | 'tags' | 'taskId'>>
  ): Promise<import('@apexcli/core').ThoughtCapture | null> {
    await this.ensureInitialized();
    return this.thoughtCaptureManager.updateThought(thoughtId, updates);
  }

  /**
   * Get thought statistics
   */
  async getThoughtStats(): Promise<{
    total: number;
    byStatus: Record<import('@apexcli/core').ThoughtCapture['status'], number>;
    byPriority: Record<import('@apexcli/core').ThoughtCapture['priority'], number>;
    byTag: Record<string, number>;
    implementationRate: number;
    avgTimeToImplementation: number;
  }> {
    await this.ensureInitialized();
    return this.thoughtCaptureManager.getThoughtStats();
  }

  /**
   * Export thoughts to markdown
   */
  async exportThoughtsToMarkdown(outputPath?: string): Promise<string> {
    await this.ensureInitialized();
    return this.thoughtCaptureManager.exportToMarkdown(outputPath);
  }

  // ============================================================================
  // Git Operations
  // ============================================================================

  /**
   * Check if there are uncommitted changes in the repository
   */
  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.projectPath });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Commit changes after a subtask completes
   */
  async gitCommitSubtask(subtask: Task, parentTask: Task): Promise<boolean> {
    // Check if commit after subtask is enabled
    if (!this.effectiveConfig.git.commitAfterSubtask) {
      return false;
    }

    // Check if there are changes to commit
    const hasChanges = await this.hasUncommittedChanges();
    if (!hasChanges) {
      await this.store.addLog(subtask.id, {
        level: 'debug',
        message: 'No changes to commit after subtask',
      });
      return false;
    }

    try {
      // Stage all changes
      await execAsync('git add -A', { cwd: this.projectPath });

      // Generate commit message based on format
      const commitMessage = this.generateSubtaskCommitMessage(subtask, parentTask);

      // Commit
      await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: this.projectPath });

      await this.store.addLog(subtask.id, {
        level: 'info',
        message: `Committed changes: ${commitMessage.split('\n')[0]}`,
      });

      return true;
    } catch (error) {
      await this.store.addLog(subtask.id, {
        level: 'warn',
        message: `Failed to commit changes: ${(error as Error).message}`,
      });
      return false;
    }
  }

  /**
   * Generate a commit message for a subtask
   */
  private generateSubtaskCommitMessage(subtask: Task, parentTask: Task): string {
    const format = this.effectiveConfig.git.commitFormat;

    if (format === 'conventional') {
      // Extract type from workflow
      const typeMap: Record<string, string> = {
        feature: 'feat',
        bugfix: 'fix',
        refactor: 'refactor',
        docs: 'docs',
        test: 'test',
        devops: 'ci',
      };
      const type = typeMap[parentTask.workflow] || 'chore';

      // Truncate description for first line
      const desc = subtask.description.length > 50
        ? subtask.description.slice(0, 47) + '...'
        : subtask.description;

      return `${type}: ${desc}

Subtask of: ${parentTask.description.slice(0, 72)}
Task ID: ${parentTask.id}
Subtask ID: ${subtask.id}

🤖 Generated by APEX`;
    } else {
      // Simple format
      return `[APEX] ${subtask.description}

Parent: ${parentTask.description}`;
    }
  }

  /**
   * Push changes to remote after a task completes
   * Validates build and tests pass before pushing
   */
  async gitPushTask(task: Task): Promise<boolean> {
    // Check if push after task is enabled
    if (!this.effectiveConfig.git.pushAfterTask) {
      return false;
    }

    if (!task.branchName) {
      await this.store.addLog(task.id, {
        level: 'debug',
        message: 'No branch name set, skipping push',
      });
      return false;
    }

    // Validate build and tests before pushing
    const validation = await this.validateBuildAndTests(task.id);
    if (!validation.success) {
      await this.store.addLog(task.id, {
        level: 'error',
        message: `Cannot push - validation failed: ${validation.error}`,
      });
      // Throw error so the task doesn't complete - agent needs to fix the issues
      throw new Error(`Pre-push validation failed: ${validation.error}\n\n${validation.buildOutput || validation.testOutput || ''}`);
    }

    try {
      // Push to remote
      await execAsync(`git push -u origin ${task.branchName}`, { cwd: this.projectPath });

      await this.store.addLog(task.id, {
        level: 'info',
        message: `Pushed changes to origin/${task.branchName}`,
      });

      return true;
    } catch (error) {
      await this.store.addLog(task.id, {
        level: 'warn',
        message: `Failed to push changes: ${(error as Error).message}`,
      });
      return false;
    }
  }

  /**
   * Validate build and tests pass before allowing commits/pushes
   * Returns { success: true } if validation passes, or { success: false, error, output } if it fails
   */
  async validateBuildAndTests(taskId: string): Promise<{ success: boolean; error?: string; buildOutput?: string; testOutput?: string }> {
    await this.store.addLog(taskId, {
      level: 'info',
      message: 'Validating build and tests before commit...',
    });

    // Run build
    try {
      const { stdout: buildOutput, stderr: buildStderr } = await execAsync('npm run build', {
        cwd: this.projectPath,
        timeout: 300000, // 5 minute timeout
      });

      await this.store.addLog(taskId, {
        level: 'info',
        message: 'Build passed successfully',
      });
    } catch (error) {
      const buildError = error as { stdout?: string; stderr?: string; message?: string };
      const output = buildError.stdout || buildError.stderr || buildError.message || 'Unknown build error';

      await this.store.addLog(taskId, {
        level: 'error',
        message: `Build failed - code must be fixed before committing:\n${output.slice(0, 2000)}`,
      });

      return {
        success: false,
        error: 'Build failed - please fix compilation errors before committing',
        buildOutput: output.slice(0, 5000),
      };
    }

    // Run tests
    try {
      const { stdout: testOutput, stderr: testStderr } = await execAsync('npm run test', {
        cwd: this.projectPath,
        timeout: 600000, // 10 minute timeout for tests
      });

      await this.store.addLog(taskId, {
        level: 'info',
        message: 'All tests passed successfully',
      });
    } catch (error) {
      const testError = error as { stdout?: string; stderr?: string; message?: string };
      const output = testError.stdout || testError.stderr || testError.message || 'Unknown test error';

      await this.store.addLog(taskId, {
        level: 'error',
        message: `Tests failed - code must be fixed before committing:\n${output.slice(0, 2000)}`,
      });

      return {
        success: false,
        error: 'Tests failed - please fix failing tests before committing',
        testOutput: output.slice(0, 5000),
      };
    }

    await this.store.addLog(taskId, {
      level: 'info',
      message: 'Build and tests passed - ready to commit',
    });

    return { success: true };
  }

  /**
   * Handle git operations after a task completes (push and optionally create PR)
   */
  async handleTaskGitOperations(task: Task): Promise<PRResult | null> {
    // Push changes if enabled
    const pushed = await this.gitPushTask(task);

    // Check if we should create a PR
    const createPR = this.effectiveConfig.git.createPR;

    if (createPR === 'never') {
      return null;
    }

    if (createPR === 'ask') {
      // For 'ask' mode, we just log that a PR could be created
      // The user can use /pr command to create it manually
      if (pushed) {
        await this.store.addLog(task.id, {
          level: 'info',
          message: `Changes pushed. Use /pr ${task.id} to create a pull request.`,
        });
      }
      return null;
    }

    // createPR === 'always' - create PR automatically
    if (!pushed && !task.prUrl) {
      // Nothing pushed and no existing PR
      return null;
    }

    // Skip if PR already exists
    if (task.prUrl) {
      return { success: true, prUrl: task.prUrl };
    }

    // Create PR
    const prOptions = {
      draft: this.effectiveConfig.git.prDraft,
    };

    const result = await this.createPullRequest(task.id, prOptions);

    // Add labels if configured
    if (result.success && result.prUrl && this.effectiveConfig.git.prLabels?.length) {
      try {
        const prNumber = result.prUrl.split('/').pop();
        const labels = this.effectiveConfig.git.prLabels.join(',');
        await execAsync(`gh pr edit ${prNumber} --add-label "${labels}"`, { cwd: this.projectPath });
      } catch (error) {
        await this.store.addLog(task.id, {
          level: 'warn',
          message: `Failed to add labels to PR: ${(error as Error).message}`,
        });
      }
    }

    // Request reviewers if configured
    if (result.success && result.prUrl && this.effectiveConfig.git.prReviewers?.length) {
      try {
        const prNumber = result.prUrl.split('/').pop();
        const reviewers = this.effectiveConfig.git.prReviewers.join(',');
        await execAsync(`gh pr edit ${prNumber} --add-reviewer "${reviewers}"`, { cwd: this.projectPath });
      } catch (error) {
        await this.store.addLog(task.id, {
          level: 'warn',
          message: `Failed to add reviewers to PR: ${(error as Error).message}`,
        });
      }
    }

    return result;
  }

  /**
   * Check if gh CLI is available
   */
  async isGitHubCliAvailable(): Promise<boolean> {
    try {
      await execAsync('gh --version', { cwd: this.projectPath });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if the current directory is in a GitHub repo
   */
  async isGitHubRepo(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: this.projectPath });
      return stdout.includes('github.com');
    } catch {
      return false;
    }
  }

  /**
   * Create a pull request for a task
   */
  async createPullRequest(taskId: string, options?: {
    draft?: boolean;
    title?: string;
    body?: string;
  }): Promise<PRResult> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      return { success: false, error: `Task not found: ${taskId}` };
    }

    if (!task.branchName) {
      return { success: false, error: 'Task has no branch name' };
    }

    // Check prerequisites
    const ghAvailable = await this.isGitHubCliAvailable();
    if (!ghAvailable) {
      return { success: false, error: 'GitHub CLI (gh) not installed or not authenticated. Install from https://cli.github.com/' };
    }

    const isGitHub = await this.isGitHubRepo();
    if (!isGitHub) {
      return { success: false, error: 'Not a GitHub repository' };
    }

    try {
      // Ensure branch is pushed
      await execAsync(`git push -u origin ${task.branchName}`, { cwd: this.projectPath });

      // Generate PR title and body
      const prTitle = options?.title || this.generatePRTitle(task);
      const prBody = options?.body || this.generatePRBody(task);

      // Create PR using gh CLI
      const draftFlag = options?.draft ? '--draft' : '';
      const baseBranch = this.effectiveConfig.git.defaultBranch;

      const { stdout } = await execAsync(
        `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"')}" --base ${baseBranch} ${draftFlag}`,
        { cwd: this.projectPath }
      );

      const prUrl = stdout.trim();

      // Update task with PR URL
      await this.store.updateTask(taskId, {
        prUrl,
        updatedAt: new Date(),
      });

      this.emit('pr:created', taskId, prUrl);
      return { success: true, prUrl };
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.emit('pr:failed', taskId, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if a pull request for a task has been merged
   * @param taskId The task identifier
   * @returns Promise<boolean> - true if PR is merged, false otherwise
   */
  async checkPRMerged(taskId: string): Promise<boolean> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.prUrl) {
      // No PR URL means no PR was created, so it can't be merged
      return false;
    }

    // Check if gh CLI is available
    const ghAvailable = await this.isGitHubCliAvailable();
    if (!ghAvailable) {
      // If gh CLI is not available, we can't check the status
      // Return false rather than throwing to handle gracefully
      await this.store.addLog(taskId, {
        level: 'warn',
        message: 'GitHub CLI (gh) not available - cannot check PR merge status',
      });
      return false;
    }

    try {
      // Extract PR number from URL
      // PR URLs are typically: https://github.com/owner/repo/pull/123
      const prUrlMatch = task.prUrl.match(/\/pull\/(\d+)/);
      if (!prUrlMatch) {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: `Invalid PR URL format: ${task.prUrl}`,
        });
        return false;
      }

      const prNumber = prUrlMatch[1];

      // Use gh pr view to check if the PR is merged
      // The --json flag allows us to get structured data
      const { stdout } = await execAsync(
        `gh pr view ${prNumber} --json state`,
        { cwd: this.projectPath }
      );

      const prData = JSON.parse(stdout);

      // Check if the state is 'MERGED'
      const isMerged = prData.state === 'MERGED';

      if (isMerged) {
        await this.store.addLog(taskId, {
          level: 'info',
          message: `Pull request #${prNumber} has been merged`,
        });
      }

      return isMerged;
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Handle specific error cases gracefully
      if (errorMessage.includes('authentication')) {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: 'GitHub CLI authentication required - cannot check PR merge status',
        });
        return false;
      }

      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: `Pull request not found or access denied: ${task.prUrl}`,
        });
        return false;
      }

      if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: 'Network error while checking PR merge status',
        });
        return false;
      }

      // For any other error, log it but return false to handle gracefully
      await this.store.addLog(taskId, {
        level: 'warn',
        message: `Error checking PR merge status: ${errorMessage}`,
      });

      return false;
    }
  }

  /**
   * Generate PR title from task
   */
  private generatePRTitle(task: Task): string {
    // Extract type from workflow
    const typeMap: Record<string, string> = {
      feature: 'feat',
      bugfix: 'fix',
      refactor: 'refactor',
      docs: 'docs',
      test: 'test',
    };
    const type = typeMap[task.workflow] || 'feat';

    // Clean up description for title
    const description = task.description
      .toLowerCase()
      .replace(/^(add|fix|update|implement|create)\s+/i, '')
      .substring(0, 60);

    return `${type}: ${description}`;
  }

  /**
   * Generate PR body from task
   */
  private generatePRBody(task: Task): string {
    let body = `## Summary\n\n`;
    body += `${task.description}\n\n`;

    if (task.acceptanceCriteria) {
      body += `## Acceptance Criteria\n\n${task.acceptanceCriteria}\n\n`;
    }

    body += `## Task Details\n\n`;
    body += `- **Task ID:** \`${task.id}\`\n`;
    body += `- **Workflow:** ${task.workflow}\n`;
    body += `- **Branch:** \`${task.branchName}\`\n`;
    body += `- **Tokens Used:** ${task.usage.totalTokens.toLocaleString()}\n`;
    body += `- **Estimated Cost:** $${task.usage.estimatedCost.toFixed(4)}\n\n`;

    body += `---\n\n`;
    body += `🤖 Generated by [APEX](https://github.com/JoshuaAFerguson/apex) - Autonomous Product Engineering eXecutor`;

    return body;
  }

  /**
   * Ensure orchestrator is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ============================================================================
  // Concurrent Task Execution
  // ============================================================================

  /**
   * Get the number of currently running tasks
   */
  getRunningTaskCount(): number {
    return this.runningTasks.size;
  }

  /**
   * Check if a specific task is currently running
   */
  isTaskRunning(taskId: string): boolean {
    return this.runningTasks.has(taskId);
  }

  /**
   * Get all running task IDs
   */
  getRunningTaskIds(): string[] {
    return Array.from(this.runningTasks.keys());
  }

  /**
   * Start the background task runner
   * Continuously picks up pending tasks and executes them up to the concurrency limit
   */
  async startTaskRunner(options?: { pollIntervalMs?: number }): Promise<void> {
    await this.ensureInitialized();

    if (this.isRunnerActive) {
      return; // Already running
    }

    this.isRunnerActive = true;
    const pollInterval = options?.pollIntervalMs ?? 1000;

    // Initial check
    await this.processTaskQueue();

    // Set up polling interval
    this.taskRunnerInterval = setInterval(async () => {
      if (this.isRunnerActive) {
        await this.processTaskQueue();
      }
    }, pollInterval);
  }

  /**
   * Stop the background task runner
   * Note: This does not cancel currently running tasks
   */
  stopTaskRunner(): void {
    this.isRunnerActive = false;
    if (this.taskRunnerInterval) {
      clearInterval(this.taskRunnerInterval);
      this.taskRunnerInterval = null;
    }
  }

  /**
   * Process the task queue, starting new tasks up to the concurrency limit
   */
  private async processTaskQueue(): Promise<void> {
    const maxConcurrent = this.effectiveConfig.limits.maxConcurrentTasks;
    const availableSlots = maxConcurrent - this.runningTasks.size;

    if (availableSlots <= 0) {
      return; // At capacity
    }

    // Get pending tasks ordered by priority
    const pendingTasks = await this.store.listTasks({
      status: 'pending',
      orderByPriority: true,
    });

    // Start tasks up to available capacity
    for (const task of pendingTasks.slice(0, availableSlots)) {
      if (!this.runningTasks.has(task.id)) {
        this.startTaskExecution(task.id);
      }
    }
  }

  /**
   * Start executing a task in the background
   * The task promise is tracked and cleaned up on completion
   */
  private startTaskExecution(taskId: string): void {
    const taskPromise = this.executeTask(taskId)
      .finally(() => {
        // Remove from running tasks when done (success or failure)
        this.runningTasks.delete(taskId);
      });

    this.runningTasks.set(taskId, taskPromise);
  }

  /**
   * Wait for all currently running tasks to complete
   */
  async waitForAllTasks(): Promise<void> {
    const promises = Array.from(this.runningTasks.values());
    await Promise.allSettled(promises);
  }

  /**
   * Cancel a running task
   * Note: This marks the task as cancelled but cannot interrupt the Claude SDK call
   */
  async cancelTask(taskId: string): Promise<boolean> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      return false;
    }

    // Only cancel if task is running or pending
    if (task.status !== 'in-progress' && task.status !== 'pending') {
      return false;
    }

    await this.updateTaskStatus(taskId, 'cancelled', 'Task was cancelled by user');

    // If it's in our running map, we can't actually stop the SDK call,
    // but we mark it cancelled so subsequent processing knows to stop
    if (this.runningTasks.has(taskId)) {
      // The task will complete and see the cancelled status
      this.runningTasks.delete(taskId);
    }

    // Always cleanup workspace after marking task as cancelled
    try {
      await this.workspaceManager.cleanupWorkspace(taskId);
    } catch (error) {
      console.warn(`Failed to cleanup workspace for cancelled task ${taskId}:`, error);
      // Don't fail cancelTask due to cleanup error, but log the issue
    }

    return true;
  }

  /**
   * Queue a task for execution with optional priority override
   * The task will be picked up by the task runner
   */
  async queueTask(taskId: string, priority?: Task['priority']): Promise<void> {
    await this.ensureInitialized();

    const updates: Partial<{ status: TaskStatus; priority: Task['priority']; updatedAt: Date }> = {
      status: 'pending',
      updatedAt: new Date(),
    };

    if (priority) {
      updates.priority = priority;
    }

    await this.store.updateTask(taskId, updates);

    // Trigger immediate queue processing if runner is active
    if (this.isRunnerActive) {
      await this.processTaskQueue();
    }
  }

  /**
   * Execute multiple tasks concurrently
   * Returns when all tasks are complete (or failed)
   */
  async executeTasksConcurrently(
    taskIds: string[],
    options?: { maxConcurrent?: number }
  ): Promise<Map<string, { success: boolean; error?: string }>> {
    await this.ensureInitialized();

    const maxConcurrent = options?.maxConcurrent ?? this.effectiveConfig.limits.maxConcurrentTasks;
    const results = new Map<string, { success: boolean; error?: string }>();

    // Process in batches
    for (let i = 0; i < taskIds.length; i += maxConcurrent) {
      const batch = taskIds.slice(i, i + maxConcurrent);

      const batchPromises = batch.map(async (taskId) => {
        try {
          await this.executeTask(taskId);
          results.set(taskId, { success: true });
        } catch (error) {
          results.set(taskId, {
            success: false,
            error: (error as Error).message,
          });
        }
      });

      await Promise.allSettled(batchPromises);
    }

    return results;
  }

  /**
   * Get the maximum concurrent task limit from config
   */
  getMaxConcurrentTasks(): number {
    return this.effectiveConfig?.limits?.maxConcurrentTasks ?? 3;
  }

  /**
   * Check if the task runner is active
   */
  isTaskRunnerActive(): boolean {
    return this.isRunnerActive;
  }

  // ============================================================================
  // Checkpoint Management
  // ============================================================================

  /**
   * Save a checkpoint for a task
   * Checkpoints can be used to resume long-running tasks from where they left off
   */
  async saveCheckpoint(
    taskId: string,
    options: {
      stage?: string;
      stageIndex?: number;
      conversationState?: unknown[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    await this.ensureInitialized();

    const checkpointId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const checkpoint: TaskCheckpoint = {
      taskId,
      checkpointId,
      stage: options.stage,
      stageIndex: options.stageIndex ?? 0,
      conversationState: options.conversationState as TaskCheckpoint['conversationState'],
      metadata: options.metadata,
      createdAt: new Date(),
    };

    await this.store.saveCheckpoint(checkpoint);

    await this.store.addLog(taskId, {
      level: 'info',
      message: `Checkpoint saved: ${checkpointId}`,
      stage: options.stage,
    });

    return checkpointId;
  }

  /**
   * Get the latest checkpoint for a task
   */
  async getLatestCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
    await this.ensureInitialized();
    return this.store.getLatestCheckpoint(taskId);
  }

  /**
   * Get a specific checkpoint
   */
  async getCheckpoint(taskId: string, checkpointId: string): Promise<TaskCheckpoint | null> {
    await this.ensureInitialized();
    return this.store.getCheckpoint(taskId, checkpointId);
  }

  /**
   * List all checkpoints for a task
   */
  async listCheckpoints(taskId: string): Promise<TaskCheckpoint[]> {
    await this.ensureInitialized();
    return this.store.listCheckpoints(taskId);
  }

  /**
   * Delete all checkpoints for a task
   */
  async deleteCheckpoints(taskId: string): Promise<void> {
    await this.ensureInitialized();
    await this.store.deleteAllCheckpoints(taskId);
  }

  /**
   * Resume a task from its latest checkpoint
   * Returns false if no checkpoint exists
   */
  async resumeTask(taskId: string, options?: { checkpointId?: string }): Promise<boolean> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Increment resume attempts counter
    const newResumeAttempts = task.resumeAttempts + 1;
    await this.store.updateTask(taskId, {
      resumeAttempts: newResumeAttempts,
      updatedAt: new Date(),
    });

    // Check if max resume attempts exceeded
    const maxResumeAttempts = this.effectiveConfig.daemon?.sessionRecovery?.maxResumeAttempts ?? 3;
    if (newResumeAttempts > maxResumeAttempts) {
      await this.failTaskWithMaxResumeError(taskId, newResumeAttempts, maxResumeAttempts);
      return false;
    }

    // Get checkpoint to resume from
    let checkpoint: TaskCheckpoint | null;
    if (options?.checkpointId) {
      checkpoint = await this.store.getCheckpoint(taskId, options.checkpointId);
    } else {
      checkpoint = await this.store.getLatestCheckpoint(taskId);
    }

    if (!checkpoint) {
      return false; // No checkpoint to resume from
    }

    // Update task status to in-progress
    await this.updateTaskStatus(taskId, 'in-progress', `Resuming from checkpoint: ${checkpoint.checkpointId}`);

    // Generate resume context from checkpoint conversation state
    let resumeContext: string | undefined;
    if (checkpoint.conversationState && checkpoint.conversationState.length > 0) {
      const contextSummary = createContextSummary(checkpoint.conversationState);
      resumeContext = buildResumePrompt(task, checkpoint, contextSummary);

      await this.store.addLog(taskId, {
        level: 'debug',
        message: `Generated resume context for checkpoint: ${checkpoint.checkpointId}`,
        stage: checkpoint.stage,
        metadata: {
          checkpointId: checkpoint.checkpointId,
          contextSummaryLength: contextSummary.length,
          resumeContextLength: resumeContext.length,
          conversationMessageCount: checkpoint.conversationState.length,
        },
      });
    } else {
      await this.store.addLog(taskId, {
        level: 'info',
        message: `No conversation state available in checkpoint: ${checkpoint.checkpointId}`,
        stage: checkpoint.stage,
        metadata: {
          checkpointId: checkpoint.checkpointId,
        },
      });
    }

    await this.store.addLog(taskId, {
      level: 'info',
      message: `Resuming task from checkpoint: ${checkpoint.checkpointId}`,
      stage: checkpoint.stage,
      metadata: {
        checkpointId: checkpoint.checkpointId,
        stageIndex: checkpoint.stageIndex,
        checkpointCreatedAt: checkpoint.createdAt.toISOString(),
        hasResumeContext: !!resumeContext,
      },
    });

    // Load workflow and continue execution
    const workflow = await loadWorkflow(this.projectPath, task.workflow);
    if (!workflow) {
      throw new Error(`Workflow not found: ${task.workflow}`);
    }

    // Find the stage to resume from
    const startIndex = checkpoint.stageIndex;

    // Get previously completed stages from checkpoint metadata
    const stageResults = new Map<string, StageResult>();
    const completedStageNames = (checkpoint.metadata?.completedStages as string[]) || [];

    // Reconstruct stage results from checkpoint
    for (const stageName of completedStageNames) {
      const stageData = checkpoint.metadata?.[`stage_${stageName}`] as StageResult | undefined;
      if (stageData) {
        stageResults.set(stageName, stageData);
      }
    }

    // Execute remaining stages
    const remainingStages = workflow.stages.slice(startIndex);
    let isFirstStage = true;

    for (const stage of remainingStages) {
      // Check if task was cancelled during execution
      const currentTask = await this.store.getTask(taskId);
      if (currentTask?.status === 'cancelled') {
        return true; // Task was cancelled, stop execution
      }

      // Check dependencies are met
      if (!this.areDependenciesMet(stage, stageResults)) {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: `Skipping stage "${stage.name}" - dependencies not met`,
          stage: stage.name,
        });
        continue;
      }

      // Update stage
      await this.store.updateTask(taskId, { currentStage: stage.name, updatedAt: new Date() });
      this.emit('task:stage-changed', task, stage.name);

      // Load agent for this stage
      const agentDef = this.agents[stage.agent];
      if (!agentDef) {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: `Agent not found for stage: ${stage.agent}, skipping`,
          stage: stage.name,
        });
        continue;
      }

      // Execute the stage using the new stage execution method
      // Pass resume context only to the first stage being resumed
      const result = await this.executeWorkflowStage(
        task,
        stage,
        agentDef,
        workflow,
        stageResults,
        isFirstStage ? resumeContext : undefined
      );
      stageResults.set(stage.name, result);

      // After the first stage, don't pass resume context anymore
      isFirstStage = false;

      // Save checkpoint after each stage
      await this.saveCheckpoint(taskId, {
        stage: stage.name,
        stageIndex: workflow.stages.indexOf(stage),
        metadata: {
          completedStages: Array.from(stageResults.keys()),
          ...Object.fromEntries(
            Array.from(stageResults.entries()).map(([name, res]) => [`stage_${name}`, res])
          ),
        },
      });
    }

    // Mark task as completed
    await this.updateTaskStatus(taskId, 'completed');
    const completedTask = await this.store.getTask(taskId);
    if (completedTask) {
      this.emit('task:completed', completedTask);
    }

    return true;
  }

  // ============================================================================
  // Subtask Management
  // ============================================================================

  /**
   * Decompose a task into subtasks
   * This creates subtasks from the provided definitions and links them to the parent
   */
  async decomposeTask(
    parentTaskId: string,
    subtaskDefinitions: SubtaskDefinition[],
    strategy: SubtaskStrategy = 'sequential'
  ): Promise<Task[]> {
    await this.ensureInitialized();

    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task not found: ${parentTaskId}`);
    }

    // Update parent task strategy
    await this.store.updateTask(parentTaskId, {
      subtaskStrategy: strategy,
      updatedAt: new Date(),
    });

    await this.store.addLog(parentTaskId, {
      level: 'info',
      message: `Decomposing task into ${subtaskDefinitions.length} subtasks (strategy: ${strategy})`,
    });

    // Create a map to resolve dependencies between subtasks
    const subtaskMap = new Map<string, Task>();
    const subtasks: Task[] = [];

    // First pass: create all subtasks
    for (const definition of subtaskDefinitions) {
      const subtask = await this.createTask({
        description: definition.description,
        acceptanceCriteria: definition.acceptanceCriteria,
        workflow: definition.workflow || parentTask.workflow,
        priority: definition.priority || parentTask.priority,
        effort: definition.effort || parentTask.effort,
        parentTaskId,
        autonomy: parentTask.autonomy,
      });

      subtaskMap.set(definition.description, subtask);
      subtasks.push(subtask);
    }

    // Second pass: resolve dependencies between subtasks
    for (let i = 0; i < subtaskDefinitions.length; i++) {
      const definition = subtaskDefinitions[i];
      const subtask = subtasks[i];

      if (definition.dependsOn && definition.dependsOn.length > 0) {
        const resolvedDeps: string[] = [];

        for (const dep of definition.dependsOn) {
          // Check if dep is a subtask description
          const depTask = subtaskMap.get(dep);
          if (depTask) {
            resolvedDeps.push(depTask.id);
          } else if (dep.startsWith('task_')) {
            // It's already a task ID
            resolvedDeps.push(dep);
          }
        }

        if (resolvedDeps.length > 0) {
          await this.store.updateTask(subtask.id, {
            dependsOn: resolvedDeps,
            blockedBy: resolvedDeps,
            updatedAt: new Date(),
          });
        }
      }
    }

    // Emit decomposition event
    const subtaskIds = subtasks.map(s => s.id);
    this.emit('task:decomposed', parentTask, subtaskIds);

    await this.store.addLog(parentTaskId, {
      level: 'info',
      message: `Created ${subtasks.length} subtasks: ${subtaskIds.join(', ')}`,
    });

    return subtasks;
  }

  /**
   * Execute subtasks according to their strategy
   * Returns true if all subtasks completed successfully, false if any are incomplete/paused
   */
  async executeSubtasks(parentTaskId: string): Promise<boolean> {
    await this.ensureInitialized();

    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task not found: ${parentTaskId}`);
    }

    if (!parentTask.subtaskIds || parentTask.subtaskIds.length === 0) {
      throw new Error(`Task ${parentTaskId} has no subtasks to execute`);
    }

    const strategy = parentTask.subtaskStrategy || 'sequential';

    await this.store.addLog(parentTaskId, {
      level: 'info',
      message: `Executing ${parentTask.subtaskIds.length} subtasks with strategy: ${strategy}`,
    });

    switch (strategy) {
      case 'parallel':
        await this.executeSubtasksParallel(parentTask);
        break;
      case 'dependency-based':
        await this.executeSubtasksDependencyBased(parentTask);
        break;
      case 'sequential':
      default:
        await this.executeSubtasksSequential(parentTask);
        break;
    }

    // After subtask execution, aggregate results and check if all are complete
    const allComplete = await this.aggregateSubtaskResults(parentTaskId);
    return allComplete;
  }

  /**
   * Execute subtasks sequentially
   */
  private async executeSubtasksSequential(parentTask: Task): Promise<void> {
    for (const subtaskId of parentTask.subtaskIds || []) {
      // Check if parent was cancelled
      const currentParent = await this.store.getTask(parentTask.id);
      if (currentParent?.status === 'cancelled') {
        return;
      }

      try {
        await this.executeTask(subtaskId);
        const completedSubtask = await this.store.getTask(subtaskId);
        if (completedSubtask) {
          this.emit('subtask:completed', completedSubtask, parentTask.id);

          // Commit changes after subtask completes
          await this.gitCommitSubtask(completedSubtask, parentTask);
        }
      } catch (error) {
        const failedSubtask = await this.store.getTask(subtaskId);
        if (failedSubtask) {
          this.emit('subtask:failed', failedSubtask, parentTask.id, error as Error);
        }
        throw error; // Re-throw to fail the parent
      }
    }
  }

  /**
   * Execute subtasks in parallel
   */
  private async executeSubtasksParallel(parentTask: Task): Promise<void> {
    const maxConcurrent = this.effectiveConfig.limits.maxConcurrentTasks;
    const subtaskIds = parentTask.subtaskIds || [];

    // Execute in batches up to max concurrent
    for (let i = 0; i < subtaskIds.length; i += maxConcurrent) {
      // Check if parent was cancelled
      const currentParent = await this.store.getTask(parentTask.id);
      if (currentParent?.status === 'cancelled') {
        return;
      }

      const batch = subtaskIds.slice(i, i + maxConcurrent);
      const completedSubtasks: Task[] = [];

      const results = await Promise.allSettled(
        batch.map(async (subtaskId) => {
          await this.executeTask(subtaskId);
          const completedSubtask = await this.store.getTask(subtaskId);
          if (completedSubtask) {
            this.emit('subtask:completed', completedSubtask, parentTask.id);
            completedSubtasks.push(completedSubtask);
          }
        })
      );

      // Check for failures
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failures.length > 0) {
        // Emit failure events for failed subtasks
        for (let j = 0; j < batch.length; j++) {
          if (results[j].status === 'rejected') {
            const failedSubtask = await this.store.getTask(batch[j]);
            if (failedSubtask) {
              this.emit('subtask:failed', failedSubtask, parentTask.id, failures[0].reason as Error);
            }
          }
        }
        throw failures[0].reason;
      }

      // Commit changes after each batch of parallel subtasks completes
      // Use the first completed subtask as the representative for the commit message
      if (completedSubtasks.length > 0) {
        // Generate a combined commit for the batch
        const hasChanges = await this.hasUncommittedChanges();
        if (hasChanges && this.effectiveConfig.git.commitAfterSubtask) {
          try {
            await execAsync('git add -A', { cwd: this.projectPath });
            const descriptions = completedSubtasks.map(s => `- ${s.description.slice(0, 50)}`).join('\n');
            const format = this.effectiveConfig.git.commitFormat;
            const typeMap: Record<string, string> = { feature: 'feat', bugfix: 'fix', refactor: 'refactor', docs: 'docs', test: 'test', devops: 'ci' };
            const type = typeMap[parentTask.workflow] || 'chore';
            const message = format === 'conventional'
              ? `${type}: complete ${completedSubtasks.length} subtask(s)\n\n${descriptions}\n\nTask ID: ${parentTask.id}\n\n🤖 Generated by APEX`
              : `[APEX] Complete ${completedSubtasks.length} subtask(s)\n\n${descriptions}`;
            await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: this.projectPath });
            await this.store.addLog(parentTask.id, {
              level: 'info',
              message: `Committed batch of ${completedSubtasks.length} subtask(s)`,
            });
          } catch (error) {
            await this.store.addLog(parentTask.id, {
              level: 'warn',
              message: `Failed to commit batch: ${(error as Error).message}`,
            });
          }
        }
      }
    }
  }

  /**
   * Execute subtasks based on their dependencies
   */
  private async executeSubtasksDependencyBased(parentTask: Task): Promise<void> {
    const subtaskIds = new Set(parentTask.subtaskIds || []);
    const completedSubtasks = new Set<string>();
    const inProgressSubtasks = new Set<string>();

    while (completedSubtasks.size < subtaskIds.size) {
      // Check if parent was cancelled
      const currentParent = await this.store.getTask(parentTask.id);
      if (currentParent?.status === 'cancelled') {
        return;
      }

      // Find subtasks ready to run (dependencies met, not completed, not in progress)
      const readySubtasks: string[] = [];

      for (const subtaskId of subtaskIds) {
        if (completedSubtasks.has(subtaskId) || inProgressSubtasks.has(subtaskId)) {
          continue;
        }

        const subtask = await this.store.getTask(subtaskId);
        if (!subtask) continue;

        // Check if all dependencies are completed
        const deps = subtask.dependsOn || [];
        const depsCompleted = deps.every(dep => completedSubtasks.has(dep));

        if (depsCompleted) {
          readySubtasks.push(subtaskId);
        }
      }

      if (readySubtasks.length === 0) {
        if (inProgressSubtasks.size === 0) {
          // No ready subtasks and none in progress - we're stuck
          throw new Error('Subtask dependencies cannot be resolved');
        }
        // Wait for in-progress subtasks
        await this.sleep(100);
        continue;
      }

      // Execute ready subtasks in parallel (up to max concurrent)
      const maxConcurrent = this.effectiveConfig.limits.maxConcurrentTasks;
      const batch = readySubtasks.slice(0, maxConcurrent);

      for (const subtaskId of batch) {
        inProgressSubtasks.add(subtaskId);
      }

      const results = await Promise.allSettled(
        batch.map(async (subtaskId) => {
          try {
            await this.executeTask(subtaskId);
            const completedSubtask = await this.store.getTask(subtaskId);
            if (completedSubtask) {
              this.emit('subtask:completed', completedSubtask, parentTask.id);
            }
            return { subtaskId, success: true };
          } catch (error) {
            const failedSubtask = await this.store.getTask(subtaskId);
            if (failedSubtask) {
              this.emit('subtask:failed', failedSubtask, parentTask.id, error as Error);
            }
            throw error;
          }
        })
      );

      // Process results and collect completed subtasks for commit
      const completedInBatch: Task[] = [];
      let firstError: Error | null = null;

      for (let i = 0; i < batch.length; i++) {
        const subtaskId = batch[i];
        inProgressSubtasks.delete(subtaskId);
        completedSubtasks.add(subtaskId);

        if (results[i].status === 'rejected') {
          if (!firstError) {
            firstError = (results[i] as PromiseRejectedResult).reason;
          }
        } else {
          const completedSubtask = await this.store.getTask(subtaskId);
          if (completedSubtask) {
            completedInBatch.push(completedSubtask);
          }
        }
      }

      // Commit changes after batch completes (before throwing any error)
      if (completedInBatch.length > 0) {
        const hasChanges = await this.hasUncommittedChanges();
        if (hasChanges && this.effectiveConfig.git.commitAfterSubtask) {
          try {
            await execAsync('git add -A', { cwd: this.projectPath });
            const descriptions = completedInBatch.map(s => `- ${s.description.slice(0, 50)}`).join('\n');
            const format = this.effectiveConfig.git.commitFormat;
            const typeMap: Record<string, string> = { feature: 'feat', bugfix: 'fix', refactor: 'refactor', docs: 'docs', test: 'test', devops: 'ci' };
            const type = typeMap[parentTask.workflow] || 'chore';
            const message = format === 'conventional'
              ? `${type}: complete ${completedInBatch.length} subtask(s)\n\n${descriptions}\n\nTask ID: ${parentTask.id}\n\n🤖 Generated by APEX`
              : `[APEX] Complete ${completedInBatch.length} subtask(s)\n\n${descriptions}`;
            await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: this.projectPath });
            await this.store.addLog(parentTask.id, {
              level: 'info',
              message: `Committed batch of ${completedInBatch.length} subtask(s)`,
            });
          } catch (error) {
            await this.store.addLog(parentTask.id, {
              level: 'warn',
              message: `Failed to commit batch: ${(error as Error).message}`,
            });
          }
        }
      }

      // Now throw if there was an error
      if (firstError) {
        throw firstError;
      }
    }
  }

  /**
   * Aggregate results from all subtasks into the parent task
   * Returns true if all subtasks are complete, false if some are still pending
   */
  private async aggregateSubtaskResults(parentTaskId: string): Promise<boolean> {
    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask) return true;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const allArtifacts: string[] = [];
    const subtaskSummaries: string[] = [];
    let pendingCount = 0;
    let failedCount = 0;

    for (const subtaskId of parentTask.subtaskIds || []) {
      const subtask = await this.store.getTask(subtaskId);
      if (!subtask) continue;

      totalInputTokens += subtask.usage.inputTokens;
      totalOutputTokens += subtask.usage.outputTokens;

      // Collect artifacts
      for (const artifact of subtask.artifacts) {
        if (artifact.path) {
          allArtifacts.push(artifact.path);
        }
      }

      subtaskSummaries.push(`- ${subtask.description}: ${subtask.status}`);

      // Track incomplete subtasks (including in-progress!)
      if (subtask.status === 'pending' || subtask.status === 'queued' || subtask.status === 'paused' || subtask.status === 'in-progress') {
        pendingCount++;
      } else if (subtask.status === 'failed') {
        failedCount++;
      }
    }

    // Update parent task with aggregated usage
    await this.store.updateTask(parentTaskId, {
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCost: calculateCost(totalInputTokens, totalOutputTokens),
      },
      updatedAt: new Date(),
    });

    if (pendingCount > 0) {
      await this.store.addLog(parentTaskId, {
        level: 'warn',
        message: `Subtask execution incomplete: ${pendingCount} pending, ${failedCount} failed\n${subtaskSummaries.join('\n')}`,
      });
      return false;
    }

    await this.store.addLog(parentTaskId, {
      level: 'info',
      message: `Subtask execution complete:\n${subtaskSummaries.join('\n')}`,
    });
    return true;
  }

  /**
   * Continue executing pending/failed subtasks for a parent task
   * This is used when resuming a parent task that was interrupted
   * Processes subtasks in their ORIGINAL order (respects sequential dependencies)
   */
  async continuePendingSubtasks(parentTaskId: string): Promise<void> {
    await this.ensureInitialized();

    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task not found: ${parentTaskId}`);
    }

    if (!parentTask.subtaskIds || parentTask.subtaskIds.length === 0) {
      throw new Error(`Task ${parentTaskId} has no subtasks`);
    }

    // Collect subtasks that need processing IN ORIGINAL ORDER
    // This respects sequential dependencies
    const subtasksToProcess: Array<{ id: string; status: string; isRetry: boolean }> = [];
    let failedCount = 0;
    let pausedCount = 0;
    let pendingCount = 0;

    for (const subtaskId of parentTask.subtaskIds) {
      const subtask = await this.store.getTask(subtaskId);
      if (!subtask) continue;

      if (subtask.status === 'failed') {
        subtasksToProcess.push({ id: subtaskId, status: 'failed', isRetry: true });
        failedCount++;
      } else if (subtask.status === 'paused') {
        subtasksToProcess.push({ id: subtaskId, status: 'paused', isRetry: false });
        pausedCount++;
      } else if (subtask.status === 'pending' || subtask.status === 'queued') {
        subtasksToProcess.push({ id: subtaskId, status: 'pending', isRetry: false });
        pendingCount++;
      }
      // Skip completed/cancelled subtasks
    }

    if (subtasksToProcess.length === 0) {
      await this.store.addLog(parentTaskId, {
        level: 'info',
        message: 'No subtasks need processing (all completed or cancelled)',
      });
      return;
    }

    await this.store.addLog(parentTaskId, {
      level: 'info',
      message: `Continuing ${subtasksToProcess.length} subtasks in order: ${failedCount} failed, ${pausedCount} paused, ${pendingCount} pending`,
    });

    // Update parent status to in-progress
    await this.store.updateTask(parentTaskId, {
      status: 'in-progress',
      currentStage: 'subtask-execution',
      updatedAt: new Date(),
    });

    this.emit('task:started', parentTask);

    const strategy = parentTask.subtaskStrategy || 'sequential';

    // Helper to execute a subtask and check for pause/cancel
    // Handles nested subtasks recursively
    const executeSubtaskWithCheck = async (subtaskId: string, isRetry: boolean): Promise<boolean> => {
      const currentParent = await this.store.getTask(parentTaskId);
      if (currentParent?.status === 'cancelled') {
        return false; // Stop execution
      }

      const subtask = await this.store.getTask(subtaskId);
      if (!subtask) return true;

      // Check if this subtask has its own pending/failed subtasks
      // If so, recursively continue those first
      if (subtask.subtaskIds && subtask.subtaskIds.length > 0) {
        const hasNestedWork = await this.hasPendingSubtasks(subtaskId, false);
        if (hasNestedWork) {
          await this.store.addLog(parentTaskId, {
            level: 'info',
            message: `Subtask ${subtaskId} has nested subtasks to process`,
          });

          // Update subtask status to in-progress and recursively continue its subtasks
          await this.store.updateTask(subtaskId, {
            status: 'in-progress',
            updatedAt: new Date(),
          });

          try {
            await this.continuePendingSubtasks(subtaskId);
            const afterContinue = await this.store.getTask(subtaskId);
            if (afterContinue?.status === 'paused') {
              // Nested subtask hit a limit, propagate pause up
              await this.pauseParentTask(parentTaskId, subtaskId, afterContinue.pauseReason || 'usage_limit');
              return false;
            }
          } catch (error) {
            // Nested continuation failed
            const failedSubtask = await this.store.getTask(subtaskId);
            if (failedSubtask?.status === 'paused') {
              await this.pauseParentTask(parentTaskId, subtaskId, failedSubtask.pauseReason || 'usage_limit');
              return false;
            }
            throw error;
          }

          return true; // Continue with next subtask
        }
      }

      // For failed subtasks without nested work, reset status before retry
      if (isRetry) {
        await this.store.updateTask(subtaskId, {
          status: 'pending',
          error: undefined,
          updatedAt: new Date(),
        });
        await this.store.addLog(parentTaskId, {
          level: 'info',
          message: `Retrying failed subtask: ${subtaskId}`,
        });
      }

      await this.executeTask(subtaskId);

      // Check if subtask was paused (limit hit)
      const completedSubtask = await this.store.getTask(subtaskId);
      if (completedSubtask?.status === 'paused') {
        // Propagate pause to parent
        await this.pauseParentTask(parentTaskId, subtaskId, completedSubtask.pauseReason || 'usage_limit');
        return false; // Stop execution - we're paused
      }

      if (completedSubtask?.status === 'completed') {
        this.emit('subtask:completed', completedSubtask, parentTaskId);
        await this.gitCommitSubtask(completedSubtask, parentTask);
      }

      return true; // Continue execution
    };

    try {
      // Process subtasks in ORIGINAL ORDER to respect sequential dependencies
      // Each subtask is handled based on its status (failed=retry, paused=resume, pending=execute)

      if (strategy === 'sequential') {
        // Sequential: process one at a time in order
        for (const { id: subtaskId, status, isRetry } of subtasksToProcess) {
          // Handle paused subtasks: clear pause state first
          if (status === 'paused') {
            await this.store.updateTask(subtaskId, {
              status: 'pending',
              pausedAt: undefined,
              pauseReason: undefined,
              resumeAfter: undefined,
              updatedAt: new Date(),
            });
            await this.store.addLog(parentTaskId, {
              level: 'info',
              message: `Resuming paused subtask: ${subtaskId}`,
            });
          }

          const shouldContinue = await executeSubtaskWithCheck(subtaskId, isRetry);
          if (!shouldContinue) return;
        }
      } else {
        // For parallel/dependency-based, execute in batches but respect order within batches
        const maxConcurrent = this.effectiveConfig.limits.maxConcurrentTasks;
        for (let i = 0; i < subtasksToProcess.length; i += maxConcurrent) {
          const currentParent = await this.store.getTask(parentTaskId);
          if (currentParent?.status === 'cancelled' || currentParent?.status === 'paused') {
            return;
          }

          const batch = subtasksToProcess.slice(i, i + maxConcurrent);

          // Clear pause state for paused subtasks in this batch
          for (const { id: subtaskId, status } of batch) {
            if (status === 'paused') {
              await this.store.updateTask(subtaskId, {
                status: 'pending',
                pausedAt: undefined,
                pauseReason: undefined,
                resumeAfter: undefined,
                updatedAt: new Date(),
              });
            }
          }

          await Promise.all(batch.map(async ({ id: subtaskId, isRetry }) => {
            if (isRetry) {
              await this.store.updateTask(subtaskId, {
                status: 'pending',
                error: undefined,
                updatedAt: new Date(),
              });
            }
            await this.executeTask(subtaskId);
            const completedSubtask = await this.store.getTask(subtaskId);
            if (completedSubtask?.status === 'completed') {
              this.emit('subtask:completed', completedSubtask, parentTaskId);
            }
          }));
        }
      }

      // Check if all subtasks are now complete
      const allComplete = await this.aggregateSubtaskResults(parentTaskId);

      if (allComplete) {
        await this.updateTaskStatus(parentTaskId, 'completed');
        const completedTask = await this.store.getTask(parentTaskId);
        if (completedTask) {
          this.emit('task:completed', completedTask);

          // Handle git operations for parent task
          try {
            const prResult = await this.handleTaskGitOperations(completedTask);
            if (prResult?.success && prResult.prUrl) {
              await this.store.addLog(parentTaskId, {
                level: 'info',
                message: `Pull request created: ${prResult.prUrl}`,
              });
            }
          } catch (error) {
            await this.store.addLog(parentTaskId, {
              level: 'warn',
              message: `Git operations failed: ${(error as Error).message}`,
            });
          }
        }
      }
    } catch (error) {
      // Check if it was a rate limit that caused pausing
      const updatedParent = await this.store.getTask(parentTaskId);
      if (updatedParent?.status === 'paused') {
        // Task was paused due to rate limit, don't mark as failed
        return;
      }

      await this.updateTaskStatus(parentTaskId, 'failed', (error as Error).message);
      const failedTask = await this.store.getTask(parentTaskId);
      if (failedTask) {
        this.emit('task:failed', failedTask, error as Error);
      }
      throw error;
    }
  }

  /**
   * Check if a parent task has pending subtasks (recursive)
   * Also checks if any subtask has its own pending/failed subtasks
   */
  async hasPendingSubtasks(parentTaskId: string, recursive = true): Promise<boolean> {
    await this.ensureInitialized();

    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask || !parentTask.subtaskIds) {
      return false;
    }

    for (const subtaskId of parentTask.subtaskIds) {
      const subtask = await this.store.getTask(subtaskId);
      if (!subtask) continue;

      // Include in-progress and failed subtasks - they still have work to do
      if (
        subtask.status === 'pending' ||
        subtask.status === 'queued' ||
        subtask.status === 'paused' ||
        subtask.status === 'in-progress' ||
        subtask.status === 'failed'
      ) {
        return true;
      }

      // Recursively check if this subtask has its own pending/failed subtasks
      if (recursive && subtask.subtaskIds && subtask.subtaskIds.length > 0) {
        const hasNestedPending = await this.hasPendingSubtasks(subtaskId, true);
        if (hasNestedPending) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all subtasks for a parent task
   */
  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    await this.ensureInitialized();

    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask || !parentTask.subtaskIds) {
      return [];
    }

    const subtasks: Task[] = [];
    for (const subtaskId of parentTask.subtaskIds) {
      const subtask = await this.store.getTask(subtaskId);
      if (subtask) {
        subtasks.push(subtask);
      }
    }

    return subtasks;
  }

  /**
   * Get the parent task for a subtask
   */
  async getParentTask(subtaskId: string): Promise<Task | null> {
    await this.ensureInitialized();

    const subtask = await this.store.getTask(subtaskId);
    if (!subtask || !subtask.parentTaskId) {
      return null;
    }

    return this.store.getTask(subtask.parentTaskId);
  }

  /**
   * Check if a task is a subtask
   */
  async isSubtask(taskId: string): Promise<boolean> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    return task?.parentTaskId != null;
  }

  /**
   * Check if a task has subtasks
   */
  async hasSubtasks(taskId: string): Promise<boolean> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    return (task?.subtaskIds || []).length > 0;
  }

  /**
   * Get the status summary of all subtasks
   */
  async getSubtaskStatus(parentTaskId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    inProgress: number;
  }> {
    await this.ensureInitialized();

    const subtasks = await this.getSubtasks(parentTaskId);

    return {
      total: subtasks.length,
      completed: subtasks.filter(s => s.status === 'completed').length,
      failed: subtasks.filter(s => s.status === 'failed').length,
      pending: subtasks.filter(s => s.status === 'pending').length,
      inProgress: subtasks.filter(s => s.status === 'in-progress').length,
    };
  }

  /**
   * Detect if the session is approaching context window limits
   *
   * @param taskId - The task ID to check
   * @param contextWindowSize - The context window size in tokens (defaults to Claude's common 200k)
   * @returns SessionLimitStatus indicating current status and recommendations
   */
  async detectSessionLimit(taskId: string, contextWindowSize: number = 200000): Promise<SessionLimitStatus> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Get the conversation history for the task
    const conversation = task.conversation || [];

    // Estimate current token usage
    const currentTokens = estimateConversationTokens(conversation);

    // Calculate utilization percentage
    const utilization = currentTokens / contextWindowSize;

    // Get the configured threshold (default 0.8 = 80%)
    const threshold = this.effectiveConfig.daemon?.sessionRecovery?.contextWindowThreshold || 0.8;

    // Determine if we're near the limit
    const nearLimit = utilization >= threshold;

    // Determine recommendation based on utilization levels
    let recommendation: SessionLimitStatus['recommendation'];
    let message: string;

    if (utilization < 0.6) {
      recommendation = 'continue';
      message = `Session healthy: ${(utilization * 100).toFixed(1)}% of context window used`;
    } else if (utilization < threshold) {
      recommendation = 'summarize';
      message = `Consider summarization: ${(utilization * 100).toFixed(1)}% of context window used`;
    } else if (utilization < 0.95) {
      recommendation = 'checkpoint';
      message = `Context window near limit: ${(utilization * 100).toFixed(1)}% used - checkpoint recommended`;
    } else {
      recommendation = 'handoff';
      message = `Context window critical: ${(utilization * 100).toFixed(1)}% used - handoff required`;
    }

    return {
      nearLimit,
      currentTokens,
      utilization,
      recommendation,
      message,
    };
  }

  /**
   * Get documentation analysis including outdated documentation findings
   */
  async getDocumentationAnalysis(): Promise<OutdatedDocumentation[]> {
    if (!this.initialized) {
      throw new Error('Orchestrator must be initialized first');
    }

    try {
      // Create a temporary IdleProcessor to get documentation analysis
      const daemonConfig = this.config.daemon || {
        pollInterval: 5000,
        autoStart: false,
        logLevel: 'info' as const,
        installAsService: false,
        serviceName: 'apex-daemon',
      };
      const idleProcessor = new IdleProcessor(this.projectPath, daemonConfig, this.store);

      // Start the processor to initialize it
      await idleProcessor.start();

      // Process idle time to generate analysis
      await idleProcessor.processIdleTime();

      // Get the last analysis
      const analysis = idleProcessor.getLastAnalysis();

      if (!analysis) {
        return [];
      }

      return analysis.documentation.outdatedDocs || [];
    } catch (error) {
      // Log error but don't throw - return empty array for graceful fallback
      console.warn('Failed to get documentation analysis:', error);
      return [];
    }
  }

  /**
   * Get missing README sections analysis
   */
  async getMissingReadmeSections(): Promise<MissingReadmeSection[]> {
    if (!this.initialized) {
      throw new Error('Orchestrator must be initialized first');
    }

    try {
      // Create a temporary IdleProcessor to get README section analysis
      const daemonConfig = this.config.daemon || {
        pollInterval: 5000,
        autoStart: false,
        logLevel: 'info' as const,
        installAsService: false,
        serviceName: 'apex-daemon',
      };
      const idleProcessor = new IdleProcessor(this.projectPath, daemonConfig, this.store);

      // Start the processor to initialize it
      await idleProcessor.start();

      // Process idle time to generate analysis
      await idleProcessor.processIdleTime();

      // Get the last analysis
      const analysis = idleProcessor.getLastAnalysis();

      if (!analysis) {
        return [];
      }

      return analysis.documentation.missingReadmeSections || [];
    } catch (error) {
      // Log error but don't throw - return empty array for graceful fallback
      console.warn('Failed to get missing README sections analysis:', error);
      return [];
    }
  }

  /**
   * List idle tasks with optional filtering
   */
  async listIdleTasks(options?: {
    implemented?: boolean;
    type?: IdleTaskType;
    priority?: TaskPriority;
    limit?: number;
  }): Promise<IdleTask[]> {
    if (!this.initialized) {
      throw new Error('Orchestrator must be initialized first');
    }

    return this.store.listIdleTasks(options);
  }

  /**
   * Promote an idle task to a regular task
   */
  async promoteIdleTask(idleTaskId: string): Promise<Task> {
    if (!this.initialized) {
      throw new Error('Orchestrator must be initialized first');
    }

    return this.store.promoteIdleTask(idleTaskId, {
      projectPath: this.projectPath,
    });
  }

  /**
   * Delete an idle task
   */
  async deleteIdleTask(idleTaskId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Orchestrator must be initialized first');
    }

    return this.store.deleteIdleTask(idleTaskId);
  }

  /**
   * Set up event forwarding from WorkspaceManager container events to orchestrator events
   */
  private setupContainerEventForwarding(): void {
    const containerManager = this.workspaceManager.getContainerManager();

    // Forward container lifecycle events with task ID association
    containerManager.on('container:created', (event) => {
      const containerEvent: ContainerEventData = {
        containerId: event.containerId,
        taskId: event.taskId,
        containerInfo: event.containerInfo,
        timestamp: event.timestamp,
        success: event.success,
        error: event.error,
        command: event.command,
      };
      this.emit('container:created', containerEvent);
    });

    containerManager.on('container:started', (event) => {
      const containerEvent: ContainerEventData = {
        containerId: event.containerId,
        taskId: event.taskId,
        containerInfo: event.containerInfo,
        timestamp: event.timestamp,
        success: event.success,
        error: event.error,
        command: event.command,
      };
      this.emit('container:started', containerEvent);
    });

    containerManager.on('container:stopped', (event) => {
      const containerEvent: ContainerEventData = {
        containerId: event.containerId,
        taskId: event.taskId,
        containerInfo: event.containerInfo,
        timestamp: event.timestamp,
        success: event.success,
        error: event.error,
        command: event.command,
      };
      this.emit('container:stopped', containerEvent);
    });

    containerManager.on('container:died', (event) => {
      const containerEvent: ContainerDiedEventData = {
        containerId: event.containerId,
        taskId: event.taskId,
        containerInfo: event.containerInfo,
        timestamp: event.timestamp,
        exitCode: event.exitCode,
        signal: event.signal,
        oomKilled: event.oomKilled,
      };
      this.emit('container:died', containerEvent);

      // Handle container failure during task execution
      this.handleContainerFailure(containerEvent).catch((error) => {
        // Log container failure handling error but don't re-throw
        console.error(`Failed to handle container failure for container ${event.containerId}:`, error);
      });
    });

    containerManager.on('container:removed', (event) => {
      const containerEvent: ContainerEventData = {
        containerId: event.containerId,
        taskId: event.taskId,
        containerInfo: event.containerInfo,
        timestamp: event.timestamp,
        success: event.success,
        error: event.error,
        command: event.command,
      };
      this.emit('container:removed', containerEvent);
    });

    containerManager.on('container:lifecycle', (event, operation) => {
      const containerEvent: ContainerEventData = {
        containerId: event.containerId,
        taskId: event.taskId,
        containerInfo: event.containerInfo,
        timestamp: event.timestamp,
        success: event.success,
        error: event.error,
        command: event.command,
      };
      this.emit('container:lifecycle', containerEvent, operation);
    });
  }

  /**
   * Set up event forwarding from WorkspaceManager dependency events to orchestrator events
   */
  private setupDependencyEventForwarding(): void {
    this.workspaceManager.on('dependency-install-started', (event) => {
      this.emit('dependency:install-started', event);
    });

    this.workspaceManager.on('dependency-install-completed', (event) => {
      this.emit('dependency:install-completed', event);
    });
  }

  /**
   * Set up automatic workspace cleanup when tasks are completed or failed
   * Listens to 'task:completed' and 'task:failed' events and calls workspaceManager.cleanupWorkspace
   * Respects the workspace.cleanup configuration flag and preserveOnFailure setting
   */
  private setupAutomaticWorkspaceCleanup(): void {
    this.on('task:completed', async (task: Task) => {
      // Only cleanup if the task has a workspace and global cleanup is enabled
      if (this.effectiveConfig.workspace?.cleanupOnComplete !== false) {
        try {
          await this.workspaceManager.cleanupWorkspace(task.id);
        } catch (error) {
          // Log cleanup error but don't fail the task completion
          console.warn(`Failed to cleanup workspace for completed task ${task.id}:`, error);
          await this.store.addLog(task.id, {
            level: 'warn',
            message: `Workspace cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            component: 'workspace-cleanup'
          });
        }
      }
    });

    // Handle task:failed event
    this.on('task:failed', async (task: Task, error: Error) => {
      // Check if workspace should be preserved on failure for debugging
      const preserveOnFailure = this.shouldPreserveOnFailure(task);

      if (preserveOnFailure) {
        // Log that workspace is being preserved for debugging
        console.log(`Preserving workspace for failed task ${task.id} for debugging`);
        await this.store.addLog(task.id, {
          level: 'info',
          message: `Workspace preserved for debugging (preserveOnFailure=true). Strategy: ${task.workspace?.strategy || 'unknown'}, Path: ${task.workspace?.path || 'unknown'}`,
          timestamp: new Date(),
          component: 'workspace-cleanup'
        });
      } else {
        // Clean up workspace since preserveOnFailure is false
        if (this.effectiveConfig.workspace?.cleanupOnComplete !== false) {
          try {
            await this.workspaceManager.cleanupWorkspace(task.id);
          } catch (cleanupError) {
            console.warn(`Failed to cleanup workspace for failed task ${task.id}:`, cleanupError);
            await this.store.addLog(task.id, {
              level: 'warn',
              message: `Workspace cleanup failed after task failure: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`,
              timestamp: new Date(),
              component: 'workspace-cleanup'
            });
          }
        }
      }
    });
  }

  /**
   * Determine if workspace should be preserved on task failure for debugging
   * Checks task-level config first, then strategy-specific config
   */
  private shouldPreserveOnFailure(task: Task): boolean {
    // First, check task-level workspace configuration (highest priority)
    if (task.workspace?.preserveOnFailure !== undefined) {
      return task.workspace.preserveOnFailure;
    }

    // For worktree strategy, check git.worktree config
    if (task.workspace?.strategy === 'worktree') {
      return this.effectiveConfig.git?.worktree?.preserveOnFailure ?? false;
    }

    // For other strategies, default to false (cleanup on failure)
    return false;
  }

  /**
   * Handle container failure during task execution
   * Pauses tasks when their associated container dies unexpectedly
   */
  private async handleContainerFailure(event: ContainerDiedEventData): Promise<void> {
    // Only handle container failures for tasks that have an associated task ID
    if (!event.taskId) {
      return;
    }

    // Check if the task is currently running
    if (!this.runningTasks.has(event.taskId)) {
      return;
    }

    try {
      // Get the current task to verify it's in-progress
      const task = await this.store.getTask(event.taskId);
      if (!task || task.status !== 'in-progress') {
        return;
      }

      // Determine failure reason based on exit code and OOM status
      const isOomKilled = event.oomKilled || false;
      const exitCode = event.exitCode;

      // Create detailed failure message
      let failureReason = `Container died with exit code ${exitCode}`;
      if (event.signal) {
        failureReason += ` (signal: ${event.signal})`;
      }
      if (isOomKilled) {
        failureReason += ` - Out of Memory (OOM) killed`;
      }

      // Log the container failure
      await this.store.addLog(event.taskId, {
        level: 'error',
        message: `${failureReason}. Container ID: ${event.containerId}`,
      });

      // Pause the task due to container failure
      await this.pauseTask(event.taskId, 'container_failure');

      // Log the task pause
      await this.store.addLog(event.taskId, {
        level: 'warn',
        message: `Task paused due to container failure. ${failureReason}. Task can be resumed with a new container.`,
      });

      console.log(`Task ${event.taskId} paused due to container failure: ${failureReason}`);
    } catch (error) {
      console.error(`Error handling container failure for task ${event.taskId}:`, error);
      // Don't re-throw - we don't want container failures to crash the orchestrator
    }
  }

  /**
   * Get the workspace manager instance
   * Provides access to container operations and workspace management
   */
  getWorkspaceManager(): WorkspaceManager {
    return this.workspaceManager;
  }
}

export { TaskStore } from './store';
export { buildOrchestratorPrompt, buildAgentDefinitions, buildStagePrompt, buildResumePrompt } from './prompts';
export { createHooks } from './hooks';
export {
  estimateTokens,
  estimateMessageTokens,
  estimateConversationTokens,
  truncateToolResult,
  summarizeMessage,
  compactConversation,
  pruneToolResults,
  createContextSummary,
  createContextSummaryData,
  extractKeyDecisions,
  extractProgressInfo,
  extractFileModifications,
  analyzeConversation,
  type ContextCompactionOptions,
  type KeyDecision,
  type ProgressInfo,
  type FileModification,
  type ContextSummaryData,
} from './context';
export {
  DaemonManager,
  DaemonError,
  type DaemonOptions,
  type DaemonStatus,
  type ExtendedDaemonStatus,
  type CapacityStatusInfo,
  type DaemonStateFile,
  type DaemonErrorCode
} from './daemon';
export {
  DaemonRunner,
  type DaemonRunnerOptions,
  type DaemonMetrics,
  type DaemonLogEntry
} from './runner';
export {
  ServiceManager,
  SystemdGenerator,
  LaunchdGenerator,
  ServiceError,
  detectPlatform,
  isSystemdAvailable,
  isLaunchdAvailable,
  type ServiceManagerOptions,
  type ServiceStatus,
  type ServiceFileResult,
  type InstallOptions,
  type UninstallOptions,
  type InstallResult,
  type UninstallResult,
  type ServiceErrorCode,
  type Platform,
} from './service-manager';
export {
  DaemonScheduler,
  UsageManagerProvider,
  type UsageStatsProvider,
  type TimeWindow,
  type CapacityInfo,
  type SchedulingDecision,
  type CapacityRestoredReason,
  type CapacityRestoredEvent,
  type CapacityRestoredCallback,
} from './daemon-scheduler';
export {
  IdleTaskGenerator,
  MaintenanceAnalyzer,
  RefactoringAnalyzer,
  DocsAnalyzer,
  TestsAnalyzer,
  type TaskCandidate,
  type StrategyAnalyzer,
  type RemediationSuggestion,
  type RemediationActionType,
} from './idle-task-generator';
export { WorktreeManager, WorktreeError, type WorktreeManagerOptions } from './worktree-manager';
export {
  WorkspaceManager,
  type WorkspaceManagerOptions,
  type WorkspaceInfo,
  type WorkspaceManagerEvents,
  type DependencyInstallEventData,
  type DependencyInstallCompletedEventData,
  type DependencyInstallRecoveryEventData
} from './workspace-manager';
export {
  ContainerExecutionProxy,
  createContainerExecutionProxy,
  type ExecutionContext,
  type CommandExecutionOptions,
  type CommandExecutionResult,
  type ContainerExecutionProxyEvents,
  type ExecutionStartedEvent,
  type ExecutionCompletedEvent,
  type ExecutionFailedEvent,
  type CommandBlockedEvent,
} from './container-execution-proxy';
