import { z } from 'zod';

// ============================================================================
// Agent Definitions
// ============================================================================

export const AgentModelSchema = z.enum(['opus', 'sonnet', 'haiku', 'inherit']);
export type AgentModel = z.infer<typeof AgentModelSchema>;

export const AgentToolSchema = z.enum([
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Bash',
  'Grep',
  'Glob',
  'WebFetch',
  'WebSearch',
]);
export type AgentTool = z.infer<typeof AgentToolSchema>;

export const AgentDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  prompt: z.string(),
  tools: z.array(z.string()).optional(),
  model: AgentModelSchema.optional().default('sonnet'),
  skills: z.array(z.string()).optional(),
});
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

// ============================================================================
// Workflow Definitions
// ============================================================================

export const AutonomyLevelSchema = z.enum([
  'full',
  'review-before-commit',
  'review-before-merge',
  'manual',
]);
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;

export const WorkflowGateSchema = z.object({
  name: z.string(),
  trigger: z.string(),
  required: z.boolean().default(true),
  approvers: z.array(z.string()).optional(),
  timeout: z.number().optional(), // Minutes
});
export type WorkflowGate = z.infer<typeof WorkflowGateSchema>;

export const WorkflowStageSchema = z.object({
  name: z.string(),
  agent: z.string(),
  description: z.string().optional(),
  dependsOn: z.array(z.string()).optional(),
  parallel: z.boolean().optional().default(false),
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  condition: z.string().optional(),
  actions: z.array(z.string()).optional(),
  gate: z.string().nullable().optional(),
  maxRetries: z.number().optional().default(2),
});
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;

export const WorkflowDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  trigger: z.array(z.string()).optional(),
  stages: z.array(WorkflowStageSchema),
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// ============================================================================
// Project Configuration
// ============================================================================

export const ProjectConfigSchema = z.object({
  name: z.string(),
  language: z.string().optional(),
  framework: z.string().optional(),
  testCommand: z.string().optional().default('npm test'),
  lintCommand: z.string().optional().default('npm run lint'),
  buildCommand: z.string().optional().default('npm run build'),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export const GitConfigSchema = z.object({
  branchPrefix: z.string().optional().default('apex/'),
  commitFormat: z.enum(['conventional', 'simple']).optional().default('conventional'),
  autoPush: z.boolean().optional().default(true),
  defaultBranch: z.string().optional().default('main'),
  // New options for automatic git operations
  commitAfterSubtask: z.boolean().optional().default(true),   // Commit after each subtask completes
  pushAfterTask: z.boolean().optional().default(true),         // Push after parent task completes
  createPR: z.enum(['always', 'never', 'ask']).optional().default('always'), // When to create PR
  prDraft: z.boolean().optional().default(false),              // Create PR as draft
  prLabels: z.array(z.string()).optional(),                    // Labels to add to PR
  prReviewers: z.array(z.string()).optional(),                 // Reviewers to request
});
export type GitConfig = z.infer<typeof GitConfigSchema>;

export const LimitsConfigSchema = z.object({
  maxTokensPerTask: z.number().optional().default(500000),
  maxCostPerTask: z.number().optional().default(10.0),
  dailyBudget: z.number().optional().default(100.0),
  maxTurns: z.number().optional().default(100),
  maxConcurrentTasks: z.number().optional().default(3),
  maxRetries: z.number().optional().default(3),
  retryDelayMs: z.number().optional().default(1000),
  retryBackoffFactor: z.number().optional().default(2),
});
export type LimitsConfig = z.infer<typeof LimitsConfigSchema>;

export const ModelsConfigSchema = z.object({
  planning: AgentModelSchema.optional().default('opus'),
  implementation: AgentModelSchema.optional().default('sonnet'),
  review: AgentModelSchema.optional().default('haiku'),
});
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

export const UIConfigSchema = z.object({
  previewMode: z.boolean().optional().default(true),
  previewConfidence: z.number().min(0).max(1).optional().default(0.7),
  autoExecuteHighConfidence: z.boolean().optional().default(false),
  previewTimeout: z.number().min(1000).optional().default(5000),
});
export type UIConfig = z.infer<typeof UIConfigSchema>;

export const ApexConfigSchema = z.object({
  version: z.string().default('1.0'),
  project: ProjectConfigSchema,
  autonomy: z
    .object({
      default: AutonomyLevelSchema.default('review-before-merge'),
      overrides: z.record(z.string(), AutonomyLevelSchema).optional(),
    })
    .optional(),
  agents: z
    .object({
      enabled: z.array(z.string()).optional(),
      disabled: z.array(z.string()).optional(),
    })
    .optional(),
  models: ModelsConfigSchema.optional(),
  gates: z.array(WorkflowGateSchema).optional(),
  git: GitConfigSchema.optional(),
  limits: LimitsConfigSchema.optional(),
  api: z
    .object({
      url: z.string().optional().default('http://localhost:3000'),
      port: z.number().optional().default(3000),
      autoStart: z.boolean().optional().default(false),
    })
    .optional(),
  ui: UIConfigSchema.optional(),
  webUI: z
    .object({
      port: z.number().optional().default(3001),
      autoStart: z.boolean().optional().default(false),
    })
    .optional(),
});
export type ApexConfig = z.infer<typeof ApexConfigSchema>;

// ============================================================================
// Task Management
// ============================================================================

export const TaskStatusSchema = z.enum([
  'pending',
  'queued',
  'planning',
  'in-progress',
  'waiting-approval',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  description: string;
  acceptanceCriteria?: string;
  workflow: string;
  autonomy: AutonomyLevel;
  status: TaskStatus;
  priority: TaskPriority;
  currentStage?: string;
  projectPath: string;
  branchName?: string;
  prUrl?: string;
  retryCount: number;
  maxRetries: number;
  resumeAttempts: number;
  dependsOn?: string[];  // Task IDs this task depends on
  blockedBy?: string[];  // Computed: tasks that are blocking this one
  // Subtask support
  parentTaskId?: string;   // If this is a subtask, the parent task ID
  subtaskIds?: string[];   // If this is a parent task, IDs of its subtasks
  subtaskStrategy?: SubtaskStrategy; // How subtasks should be executed
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  pausedAt?: Date;           // When the task was paused
  resumeAfter?: Date;        // When to auto-resume (e.g., after rate limit reset)
  pauseReason?: string;      // Why the task was paused (e.g., 'rate_limit', 'budget', 'manual')
  usage: TaskUsage;
  logs: TaskLog[];
  artifacts: TaskArtifact[];
  error?: string;
}

/**
 * Strategy for how subtasks should be executed
 */
export type SubtaskStrategy = 'sequential' | 'parallel' | 'dependency-based';

/**
 * Request to decompose a task into subtasks
 */
export interface TaskDecomposition {
  parentTaskId: string;
  subtasks: SubtaskDefinition[];
  strategy: SubtaskStrategy;
}

/**
 * Definition for creating a subtask
 */
export interface SubtaskDefinition {
  description: string;
  acceptanceCriteria?: string;
  workflow?: string;
  priority?: TaskPriority;
  dependsOn?: string[];  // References other subtask descriptions or IDs
}

export interface TaskUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface TaskLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  stage?: string;
  agent?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface TaskArtifact {
  name: string;
  type: 'file' | 'diff' | 'report' | 'log';
  path?: string;
  content?: string;
  createdAt: Date;
}

// ============================================================================
// Stage Execution Results
// ============================================================================

export interface StageResult {
  stageName: string;
  agent: string;
  status: 'completed' | 'failed' | 'skipped';
  outputs: Record<string, unknown>;
  artifacts: string[];  // File paths created/modified
  summary: string;      // Agent's summary of what was done
  usage: TaskUsage;
  error?: string;
  startedAt: Date;
  completedAt: Date;
}

// ============================================================================
// Gate Management
// ============================================================================

export const GateStatusSchema = z.enum(['pending', 'approved', 'rejected', 'skipped', 'timeout']);
export type GateStatus = z.infer<typeof GateStatusSchema>;

export interface Gate {
  taskId: string;
  name: string;
  status: GateStatus;
  requiredAt: Date;
  respondedAt?: Date;
  approver?: string;
  comment?: string;
}

// ============================================================================
// Checkpoint Management
// ============================================================================

export interface TaskCheckpoint {
  taskId: string;
  checkpointId: string;
  stage?: string;
  stageIndex: number;
  conversationState?: AgentMessage[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// API Types
// ============================================================================

export interface CreateTaskRequest {
  description: string;
  acceptanceCriteria?: string;
  workflow?: string;
  autonomy?: AutonomyLevel;
  priority?: TaskPriority;
  projectPath?: string; // Optional when calling via API (server knows the project path)
}

export interface CreateTaskResponse {
  taskId: string;
  status: TaskStatus;
  message: string;
}

export interface TaskStatusResponse {
  task: Task;
  pendingGates: Gate[];
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
  stage?: string;
  message?: string;
}

export interface ApproveGateRequest {
  approver: string;
  comment?: string;
}

// ============================================================================
// Event Types (for WebSocket streaming)
// ============================================================================

export type ApexEventType =
  | 'task:created'
  | 'task:started'
  | 'task:stage-changed'
  | 'task:completed'
  | 'task:failed'
  | 'task:paused'
  | 'task:decomposed'
  | 'subtask:created'
  | 'subtask:completed'
  | 'subtask:failed'
  | 'agent:message'
  | 'agent:thinking'
  | 'agent:tool-use'
  | 'agent:tool-result'
  | 'gate:required'
  | 'gate:approved'
  | 'gate:rejected'
  | 'usage:updated'
  | 'log:entry';

export interface ApexEvent {
  type: ApexEventType;
  taskId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ============================================================================
// UI Display Types
// ============================================================================

/**
 * Display mode for the APEX CLI interface
 * - normal: Standard display with all components shown
 * - compact: Minimized display for experienced users
 * - verbose: Detailed debug information for troubleshooting
 */
export type DisplayMode = 'normal' | 'compact' | 'verbose';

// ============================================================================
// Agent SDK Types (mirrors Claude Agent SDK)
// ============================================================================

export interface AgentMessage {
  type: 'assistant' | 'user' | 'system';
  content: AgentContentBlock[];
}

export interface AgentContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  estimatedCost?: number;
}

/**
 * Extended debug data for verbose logging and analysis
 * Provides detailed breakdowns of agent execution, timing, and performance metrics
 */
export interface VerboseDebugData {
  /** Per-agent token usage breakdown */
  agentTokens: Record<string, AgentUsage>;
  /** Execution timing information */
  timing: {
    stageStartTime: Date;
    stageEndTime?: Date;
    stageDuration?: number; // milliseconds
    agentResponseTimes: Record<string, number>; // agent name -> response time in ms
    toolUsageTimes: Record<string, number>; // tool name -> cumulative usage time in ms
  };
  /** Agent-specific debug information */
  agentDebug: {
    conversationLength: Record<string, number>; // agent name -> number of messages
    toolCallCounts: Record<string, Record<string, number>>; // agent -> tool -> count
    errorCounts: Record<string, number>; // agent name -> error count
    retryAttempts: Record<string, number>; // agent name -> retry count
  };
  /** Performance and efficiency metrics */
  metrics: {
    tokensPerSecond: number;
    averageResponseTime: number; // milliseconds
    toolEfficiency: Record<string, number>; // tool name -> success rate (0-1)
    memoryUsage?: number; // bytes
    cpuUtilization?: number; // percentage
  };
}
