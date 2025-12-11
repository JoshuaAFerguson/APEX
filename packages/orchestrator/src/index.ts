import { query, type AgentDefinition as SDKAgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'eventemitter3';
import {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  Task,
  TaskStatus,
  TaskUsage,
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
}

export class ApexOrchestrator extends EventEmitter<OrchestratorEvents> {
  private config!: ApexConfig;
  private effectiveConfig!: ReturnType<typeof getEffectiveConfig>;
  private agents: Record<string, AgentDefinition> = {};
  private store!: TaskStore;
  private projectPath: string;
  private apiUrl: string;
  private initialized = false;

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
  }): Promise<Task> {
    await this.ensureInitialized();

    const taskId = generateTaskId();
    const workflow = options.workflow || 'feature';
    const autonomy = options.autonomy || this.effectiveConfig.autonomy.default;

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
      projectPath: this.projectPath,
      branchName,
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
   * Execute a task
   */
  async executeTask(taskId: string): Promise<void> {
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

    try {
      await this.runWorkflow(task, workflow);
      await this.updateTaskStatus(taskId, 'completed');
      const completedTask = await this.store.getTask(taskId);
      this.emit('task:completed', completedTask!);
    } catch (error) {
      await this.updateTaskStatus(taskId, 'failed', (error as Error).message);
      const failedTask = await this.store.getTask(taskId);
      this.emit('task:failed', failedTask!, error as Error);
      throw error;
    }
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
   * Ensure orchestrator is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export { TaskStore } from './store';
export { buildOrchestratorPrompt, buildAgentDefinitions } from './prompts';
export { createHooks } from './hooks';
