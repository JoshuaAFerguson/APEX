import { query, type AgentDefinition as SDKAgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  Task,
  TaskStatus,
  TaskUsage,
  TaskCheckpoint,
  ApexEvent,
  ApexEventType,
  loadConfig,
  loadAgents,
  loadWorkflow,
  getEffectiveConfig,
  generateTaskId,
  generateBranchName,
  calculateCost,
} from '@apex/core';
import { TaskStore } from './store';
import { buildOrchestratorPrompt, buildAgentDefinitions } from './prompts';
import { createHooks } from './hooks';

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
  'task:paused': (task: Task, gate: string) => void;
  'agent:message': (taskId: string, message: unknown) => void;
  'agent:tool-use': (taskId: string, tool: string, input: unknown) => void;
  'usage:updated': (taskId: string, usage: TaskUsage) => void;
  'pr:created': (taskId: string, prUrl: string) => void;
  'pr:failed': (taskId: string, error: string) => void;
}

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
    maxRetries?: number;
    dependsOn?: string[];
  }): Promise<Task> {
    await this.ensureInitialized();

    const taskId = generateTaskId();
    const workflow = options.workflow || 'feature';
    const autonomy = options.autonomy || this.effectiveConfig.autonomy.default;
    const priority = options.priority || 'normal';
    const maxRetries = options.maxRetries ?? this.effectiveConfig.limits.maxRetries;

    const branchName = generateBranchName(
      this.effectiveConfig.git.branchPrefix,
      taskId,
      options.description
    );

    const task: Task = {
      id: taskId,
      description: options.description,
      acceptanceCriteria: options.acceptanceCriteria,
      workflow,
      autonomy,
      status: 'pending',
      priority,
      projectPath: this.projectPath,
      branchName,
      retryCount: 0,
      maxRetries,
      dependsOn: options.dependsOn || [],
      blockedBy: options.dependsOn || [], // Initially blocked by all dependencies
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

    // Load workflow
    const workflow = await loadWorkflow(this.projectPath, task.workflow);
    if (!workflow) {
      throw new Error(`Workflow not found: ${task.workflow}`);
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

        await this.runWorkflow(task, workflow);
        await this.updateTaskStatus(taskId, 'completed');
        const completedTask = await this.store.getTask(taskId);
        this.emit('task:completed', completedTask!);
        return; // Success - exit the retry loop
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        const canRetry = autoRetry && attempt < maxRetries && this.isRetryableError(lastError);

        if (!canRetry) {
          // No more retries - fail the task
          await this.updateTaskStatus(taskId, 'failed', lastError.message);
          const failedTask = await this.store.getTask(taskId);
          this.emit('task:failed', failedTask!, lastError);
          throw lastError;
        }

        // Log the failure before retry
        await this.store.addLog(taskId, {
          level: 'warn',
          message: `Task failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}. Retrying...`,
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
    ];

    return !nonRetryablePatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run the workflow for a task
   */
  private async runWorkflow(task: Task, workflow: WorkflowDefinition): Promise<void> {
    // Build orchestrator prompt
    const systemPrompt = buildOrchestratorPrompt({
      config: this.effectiveConfig,
      workflow,
      task,
      agents: this.agents,
    });

    // Build agent definitions for SDK
    const agentDefinitions = buildAgentDefinitions(this.agents, this.effectiveConfig);

    // Create hooks
    const hooks = createHooks({
      taskId: task.id,
      store: this.store,
      onToolUse: (tool, input) => {
        this.emit('agent:tool-use', task.id, tool, input);
      },
    });

    // Execute via Claude Agent SDK
    const queryPrompt = this.buildTaskPrompt(task);

    for await (const message of query({
      prompt: queryPrompt,
      options: {
        systemPrompt,
        agents: agentDefinitions,
        permissionMode: 'acceptEdits',
        maxTurns: this.effectiveConfig.limits.maxTurns,
        settingSources: ['project'],
        cwd: this.projectPath,
        env: {
          ...process.env,
          APEX_API: this.apiUrl,
          APEX_TASK_ID: task.id,
          APEX_PROJECT: this.projectPath,
          APEX_BRANCH: task.branchName || '',
        },
        hooks,
      },
    })) {
      // Emit message for streaming
      this.emit('agent:message', task.id, message);

      // Track usage
      if (message && typeof message === 'object' && 'usage' in message) {
        const usage = message.usage as { input_tokens?: number; output_tokens?: number };
        await this.updateUsage(task.id, {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
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
    prompt += `1. Create a new branch: \`git checkout -b ${task.branchName}\`\n`;
    prompt += `2. Follow the workflow stages in order\n`;
    prompt += `3. Delegate to appropriate subagents for each stage\n`;
    prompt += `4. Run tests before completing\n`;
    prompt += `5. Commit changes with conventional commit messages\n`;

    return prompt;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: TaskStatus, error?: string): Promise<void> {
    await this.store.updateTask(taskId, {
      status,
      error,
      updatedAt: new Date(),
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
    });
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

    await this.store.addLog(taskId, {
      level: 'info',
      message: `Resuming task from checkpoint: ${checkpoint.checkpointId}`,
      stage: checkpoint.stage,
      metadata: {
        checkpointId: checkpoint.checkpointId,
        stageIndex: checkpoint.stageIndex,
        checkpointCreatedAt: checkpoint.createdAt.toISOString(),
      },
    });

    // Load workflow and continue execution
    const workflow = await loadWorkflow(this.projectPath, task.workflow);
    if (!workflow) {
      throw new Error(`Workflow not found: ${task.workflow}`);
    }

    // Find the stage to resume from
    const startIndex = checkpoint.stageIndex;

    // Execute remaining stages
    const remainingStages = workflow.stages.slice(startIndex);

    for (const stage of remainingStages) {
      // Check if task was cancelled during execution
      const currentTask = await this.store.getTask(taskId);
      if (currentTask?.status === 'cancelled') {
        return true; // Task was cancelled, stop execution
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

      // Execute the stage (simplified - in real implementation would use full agent execution)
      await this.executeStage(taskId, task, stage, agentDef, workflow);
    }

    // Mark task as completed
    await this.updateTaskStatus(taskId, 'completed');
    const completedTask = await this.store.getTask(taskId);
    if (completedTask) {
      this.emit('task:completed', completedTask);
    }

    return true;
  }

  /**
   * Execute a single workflow stage (helper for resumeTask)
   */
  private async executeStage(
    taskId: string,
    task: Task,
    stage: { name: string; agent: string },
    agentDef: AgentDefinition,
    workflow: WorkflowDefinition
  ): Promise<void> {
    const prompt = buildOrchestratorPrompt({
      task,
      workflow,
      config: this.effectiveConfig,
      agents: this.agents,
    });

    const sdkAgentDefs = buildAgentDefinitions(Object.values(this.agents));

    const hooks = createHooks(
      this.effectiveConfig,
      taskId,
      (tool: string, input: unknown) => this.emit('agent:tool-use', taskId, tool, input),
      (tool: string, result: unknown) => {},
      async (command: string) => this.store.logCommand(taskId, command)
    );

    try {
      for await (const event of query({
        prompt,
        model: agentDef.model === 'opus' ? 'claude-opus-4-5-20251101' :
               agentDef.model === 'haiku' ? 'claude-haiku-3-5-20241022' : 'claude-sonnet-4-20250514',
        maxTurns: this.effectiveConfig.limits.maxTurns,
        hooks,
        agents: sdkAgentDefs,
        options: {
          maxTokens: 8192,
        },
      })) {
        if (event.type === 'assistant') {
          this.emit('agent:message', taskId, event);

          // Save checkpoint after each assistant message
          await this.saveCheckpoint(taskId, {
            stage: stage.name,
            stageIndex: 0, // Would need proper index tracking
            metadata: { lastEvent: 'assistant_message' },
          });
        }

        if (event.type === 'result' && event.usage) {
          const usage: TaskUsage = {
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            totalTokens: event.usage.inputTokens + event.usage.outputTokens,
            estimatedCost: calculateCost(event.usage.inputTokens, event.usage.outputTokens, agentDef.model || 'sonnet'),
          };

          await this.store.updateTask(taskId, { usage });
          this.emit('usage:updated', taskId, usage);
        }
      }
    } catch (error) {
      await this.store.addLog(taskId, {
        level: 'error',
        message: `Stage execution failed: ${(error as Error).message}`,
        stage: stage.name,
      });
      throw error;
    }
  }
}

export { TaskStore } from './store';
export { buildOrchestratorPrompt, buildAgentDefinitions } from './prompts';
export { createHooks } from './hooks';
