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

/**
 * Isolation configuration schema for workflows
 * Defines how tasks should be isolated during execution
 */
export const IsolationConfigSchema = z.object({
  /** Isolation mode for this workflow */
  mode: IsolationModeSchema,
  /** Container configuration for 'full' mode (optional) */
  container: z.lazy(() => ContainerConfigSchema).optional(),
  /** Whether to cleanup workspace after task completion (default: true) */
  cleanupOnComplete: z.boolean().optional().default(true),
  /** Whether to preserve workspace on task failure (default: false) */
  preserveOnFailure: z.boolean().optional().default(false),
});
export type IsolationConfig = z.infer<typeof IsolationConfigSchema>;

export const WorkflowDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  trigger: z.array(z.string()).optional(),
  stages: z.array(WorkflowStageSchema),
  /** Task isolation configuration for this workflow (optional) */
  isolation: IsolationConfigSchema.optional(),
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

// ============================================================================
// Git Worktree Configuration
// ============================================================================

/**
 * Status of a git worktree
 */
export const WorktreeStatusSchema = z.enum([
  'active',     // Worktree is active and in use by a task
  'stale',      // Worktree exists but may need cleanup (no active task)
  'locked',     // Worktree is locked (in use by another process)
  'prunable',   // Worktree can be safely removed
]);
export type WorktreeStatus = z.infer<typeof WorktreeStatusSchema>;

/**
 * Information about an existing git worktree
 */
export interface WorktreeInfo {
  /** Absolute path to the worktree directory */
  path: string;
  /** Branch name checked out in this worktree */
  branch: string;
  /** Current HEAD commit SHA */
  head: string;
  /** Current status of the worktree */
  status: WorktreeStatus;
  /** Associated task ID if created by APEX */
  taskId?: string;
  /** Whether this is the main worktree */
  isMain: boolean;
  /** When the worktree was created */
  createdAt?: Date;
  /** When the worktree was last accessed */
  lastUsedAt?: Date;
}

/**
 * Configuration for git worktree management
 */
export const WorktreeConfigSchema = z.object({
  /** Base directory for worktrees (default: sibling to project root, e.g., ../.apex-worktrees) */
  baseDir: z.string().optional(),
  /** Automatically cleanup worktree after task completion (default: true) */
  cleanupOnComplete: z.boolean().optional().default(true),
  /** Maximum number of concurrent worktrees allowed (default: 5) */
  maxWorktrees: z.number().min(1).optional().default(5),
  /** Number of days after which stale worktrees are auto-pruned (default: 7) */
  pruneStaleAfterDays: z.number().min(1).optional().default(7),
  /** Whether to preserve worktree on task failure for debugging (default: false) */
  preserveOnFailure: z.boolean().optional().default(false),
  /** Delay in milliseconds before cleaning up worktree (default: 0) */
  cleanupDelayMs: z.number().min(0).optional().default(0),
});
export type WorktreeConfig = z.infer<typeof WorktreeConfigSchema>;

// ============================================================================
// Git Configuration
// ============================================================================

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
  // Worktree isolation settings (v0.4.0)
  autoWorktree: z.boolean().optional().default(false),         // Enable automatic worktree creation for tasks
  worktree: WorktreeConfigSchema.optional(),                   // Worktree configuration options
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

export const ServiceConfigSchema = z.object({
  enableOnBoot: z.boolean().optional().default(false),
});
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

// ============================================================================
// Idle Task Strategy Configuration
// ============================================================================

export const IdleTaskTypeSchema = z.enum([
  'maintenance',
  'refactoring',
  'docs',
  'tests',
]);
export type IdleTaskType = z.infer<typeof IdleTaskTypeSchema>;

export const StrategyWeightsSchema = z.object({
  maintenance: z.number().min(0).max(1).optional().default(0.25),
  refactoring: z.number().min(0).max(1).optional().default(0.25),
  docs: z.number().min(0).max(1).optional().default(0.25),
  tests: z.number().min(0).max(1).optional().default(0.25),
});
export type StrategyWeights = z.infer<typeof StrategyWeightsSchema>;

export const DaemonConfigSchema = z.object({
  pollInterval: z.number().optional().default(5000),
  autoStart: z.boolean().optional().default(false),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  // v0.4.0 enhancements
  installAsService: z.boolean().optional().default(false),
  serviceName: z.string().optional().default('apex-daemon'),
  service: ServiceConfigSchema.optional(),
  healthCheck: z.object({
    enabled: z.boolean().optional().default(true),
    interval: z.number().optional().default(30000), // 30 seconds
    timeout: z.number().optional().default(5000), // 5 seconds
    retries: z.number().optional().default(3),
  }).optional(),
  watchdog: z.object({
    enabled: z.boolean().optional().default(true),
    restartDelay: z.number().optional().default(5000), // 5 seconds
    maxRestarts: z.number().optional().default(5),
    restartWindow: z.number().optional().default(300000), // 5 minutes
  }).optional(),
  // Time-based usage management
  timeBasedUsage: z.object({
    enabled: z.boolean().optional().default(false),
    dayModeHours: z.array(z.number().min(0).max(23)).optional().default([9, 10, 11, 12, 13, 14, 15, 16, 17]),
    nightModeHours: z.array(z.number().min(0).max(23)).optional().default([22, 23, 0, 1, 2, 3, 4, 5, 6]),
    dayModeCapacityThreshold: z.number().min(0).max(1).optional().default(0.90),
    nightModeCapacityThreshold: z.number().min(0).max(1).optional().default(0.96),
    dayModeThresholds: z.object({
      maxTokensPerTask: z.number().optional().default(100000),
      maxCostPerTask: z.number().optional().default(5.0),
      maxConcurrentTasks: z.number().optional().default(2),
    }).optional(),
    nightModeThresholds: z.object({
      maxTokensPerTask: z.number().optional().default(1000000),
      maxCostPerTask: z.number().optional().default(20.0),
      maxConcurrentTasks: z.number().optional().default(5),
    }).optional(),
  }).optional(),
  // Session recovery settings
  sessionRecovery: z.object({
    enabled: z.boolean().optional().default(true),
    autoResume: z.boolean().optional().default(true),
    checkpointInterval: z.number().optional().default(60000), // 1 minute
    contextSummarizationThreshold: z.number().optional().default(50), // messages
    maxResumeAttempts: z.number().optional().default(3), // Maximum number of resume attempts before giving up
    contextWindowThreshold: z.number().min(0).max(1).optional().default(0.8), // Percentage (0-1) of context window before summarization
  }).optional(),
  // Idle processing
  idleProcessing: z.object({
    enabled: z.boolean().optional().default(false),
    idleThreshold: z.number().optional().default(300000), // 5 minutes
    taskGenerationInterval: z.number().optional().default(3600000), // 1 hour
    maxIdleTasks: z.number().optional().default(3),
    strategyWeights: StrategyWeightsSchema.optional(),
  }).optional(),
  // Orphan detection - detect and recover stuck in-progress tasks
  orphanDetection: z.object({
    enabled: z.boolean().optional().default(true),
    stalenessThreshold: z.number().optional().default(3600000), // 1 hour
    recoveryPolicy: z.enum(['pending', 'fail', 'retry']).optional().default('pending'),
    periodicCheck: z.boolean().optional().default(false),
    periodicCheckInterval: z.number().optional().default(300000), // 5 minutes
  }).optional(),
});
export type DaemonConfig = z.infer<typeof DaemonConfigSchema>;

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
  daemon: DaemonConfigSchema.optional(),
  documentation: z.lazy(() => DocumentationAnalysisConfigSchema).optional(),
  workspace: WorkspaceDefaultsSchema.optional(),
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

export const TaskPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskEffortSchema = z.enum(['xs', 'small', 'medium', 'large', 'xl']);
export type TaskEffort = z.infer<typeof TaskEffortSchema>;

export interface Task {
  id: string;
  description: string;
  acceptanceCriteria?: string;
  workflow: string;
  autonomy: AutonomyLevel;
  status: TaskStatus;
  priority: TaskPriority;
  effort: TaskEffort;
  currentStage?: string;
  projectPath: string;
  branchName?: string;
  prUrl?: string;
  retryCount: number;
  maxRetries: number;
  resumeAttempts: number; // Number of times this task has been resumed from checkpoint
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
  trashedAt?: Date;          // When the task was moved to trash (soft delete)
  archivedAt?: Date;         // When the task was archived
  usage: TaskUsage;
  logs: TaskLog[];
  artifacts: TaskArtifact[];
  error?: string;
  conversation?: AgentMessage[];
  // v0.4.0 enhancements
  workspace?: WorkspaceConfig;  // Workspace isolation settings
  sessionData?: TaskSessionData; // Session recovery data
  thoughtCaptures?: ThoughtCapture[]; // Quick ideas related to this task
  iterationHistory?: IterationHistory; // Iteration history for the task
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
  effort?: TaskEffort;
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
// v0.4.0 - New Types for Enhanced Features
// ============================================================================

// ============================================================================
// Container Configuration Types (v0.4.0)
// ============================================================================

/**
 * Resource limits for container execution
 * Defines CPU and memory constraints for containerized workspaces
 */
export const ResourceLimitsSchema = z.object({
  /** CPU limit in cores (e.g., 0.5 for half a core, 2 for 2 cores) */
  cpu: z.number().min(0.1).max(64).optional(),
  /** Memory limit with unit suffix (e.g., "256m", "1g", "2048m") */
  memory: z.string().regex(/^\d+[kmgKMG]?$/).optional(),
  /** Memory reservation (soft limit) with unit suffix */
  memoryReservation: z.string().regex(/^\d+[kmgKMG]?$/).optional(),
  /** Maximum memory swap with unit suffix */
  memorySwap: z.string().regex(/^\d+[kmgKMG]?$/).optional(),
  /** CPU shares for relative weighting (1024 = 1 share) */
  cpuShares: z.number().min(2).max(262144).optional(),
  /** Number of PIDs allowed in the container */
  pidsLimit: z.number().min(1).optional(),
});
export type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;

/**
 * Network mode for container networking configuration
 */
export const ContainerNetworkModeSchema = z.enum([
  'bridge',   // Default Docker bridge network
  'host',     // Use host networking (shares host network namespace)
  'none',     // No networking
  'container', // Share networking with another container
]);
export type ContainerNetworkMode = z.infer<typeof ContainerNetworkModeSchema>;

/**
 * Container configuration schema for workspace isolation
 * Defines all settings for running tasks in containerized environments
 */
export const ContainerConfigSchema = z.object({
  /** Docker/OCI image to use (e.g., "node:20-alpine", "python:3.11-slim") */
  image: z.string()
    .min(1, 'Container image cannot be empty')
    .regex(/^[a-z0-9][a-z0-9\-._]*([\/][a-z0-9][a-z0-9\-._]*)*(:[\w][\w.-]*)?$/i,
           'Invalid container image format. Use format: [registry/]name[:tag]'),
  /** Path to Dockerfile for building custom images (relative to build context) */
  dockerfile: z.string().min(1).optional(),
  /** Build context path for Docker image builds (defaults to current directory) */
  buildContext: z.string().min(1).optional(),
  /** Custom tag for built images (e.g., "my-app:latest") */
  imageTag: z.string().min(1).optional(),
  /** Volume mounts mapping host paths to container paths */
  volumes: z.record(z.string(), z.string()).optional(),
  /** Environment variables to set in the container */
  environment: z.record(z.string(), z.string()).optional(),
  /** Resource limits for the container */
  resourceLimits: ResourceLimitsSchema.optional(),
  /** Network mode for container networking */
  networkMode: ContainerNetworkModeSchema.optional().default('bridge'),
  /** Working directory inside the container */
  workingDir: z.string().optional(),
  /** User to run as inside the container (e.g., "1000:1000", "node") */
  user: z.string().optional(),
  /** Additional container labels for identification */
  labels: z.record(z.string(), z.string()).optional(),
  /** Entrypoint override for the container */
  entrypoint: z.array(z.string()).optional(),
  /** Command to run in the container */
  command: z.array(z.string()).optional(),
  /** Whether to remove the container after it stops */
  autoRemove: z.boolean().optional().default(true),
  /** Whether to run in privileged mode (use with caution) */
  privileged: z.boolean().optional().default(false),
  /** Security options for the container */
  securityOpts: z.array(z.string()).optional(),
  /** Capabilities to add to the container */
  capAdd: z.array(z.string()).optional(),
  /** Capabilities to drop from the container */
  capDrop: z.array(z.string()).optional(),
  /** Whether to automatically install dependencies (defaults to true) */
  autoDependencyInstall: z.boolean().optional().default(true),
  /** Custom command to install dependencies (overrides default detection) */
  customInstallCommand: z.string().optional(),
  /** Whether to use frozen lockfile installation (npm ci, yarn --frozen-lockfile, etc.) */
  useFrozenLockfile: z.boolean().optional().default(true),
  /** Timeout for dependency installation in milliseconds */
  installTimeout: z.number().positive().optional(),
  /** Number of retry attempts for dependency installation on failure */
  installRetries: z.number().int().min(0).optional(),
});
export type ContainerConfig = z.infer<typeof ContainerConfigSchema>;

/**
 * Status of a running container
 */
export const ContainerStatusSchema = z.enum([
  'created',    // Container created but not started
  'running',    // Container is running
  'paused',     // Container is paused
  'restarting', // Container is restarting
  'removing',   // Container is being removed
  'exited',     // Container has exited
  'dead',       // Container is dead (failed to stop cleanly)
]);
export type ContainerStatus = z.infer<typeof ContainerStatusSchema>;

/**
 * Runtime information about a container
 */
export interface ContainerInfo {
  /** Container ID (full or short form) */
  id: string;
  /** Container name */
  name: string;
  /** Image used to create the container */
  image: string;
  /** Current status of the container */
  status: ContainerStatus;
  /** When the container was created */
  createdAt: Date;
  /** When the container started (if running) */
  startedAt?: Date;
  /** When the container finished (if exited) */
  finishedAt?: Date;
  /** Exit code (if exited) */
  exitCode?: number;
  /** Associated task ID */
  taskId?: string;
  /** Resource usage statistics */
  stats?: ContainerStats;
}

/**
 * Runtime statistics for a container
 */
export interface ContainerStats {
  /** CPU usage percentage */
  cpuPercent: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Memory limit in bytes */
  memoryLimit: number;
  /** Memory usage percentage */
  memoryPercent: number;
  /** Network I/O bytes received */
  networkRxBytes: number;
  /** Network I/O bytes transmitted */
  networkTxBytes: number;
  /** Block I/O bytes read */
  blockReadBytes: number;
  /** Block I/O bytes written */
  blockWriteBytes: number;
  /** Number of PIDs in the container */
  pids: number;
}

/**
 * Options for streaming container logs
 */
export interface ContainerLogStreamOptions {
  /** Follow logs (stream live logs as they are produced) */
  follow?: boolean;
  /** Show timestamps in log output */
  timestamps?: boolean;
  /** Only show logs since this timestamp (ISO string or unix timestamp) */
  since?: string | number | Date;
  /** Only show logs until this timestamp (ISO string or unix timestamp) */
  until?: string | number | Date;
  /** Filter log output to stdout, stderr, or both */
  stdout?: boolean;
  /** Filter log output to stderr */
  stderr?: boolean;
  /** Maximum number of lines to retrieve from the end of the logs */
  tail?: number | 'all';
}

/**
 * A single log entry from a container
 */
export interface ContainerLogEntry {
  /** Log message content */
  message: string;
  /** Timestamp when the log was generated */
  timestamp?: Date;
  /** Stream source (stdout or stderr) */
  stream: 'stdout' | 'stderr';
  /** Raw log line as received from the container runtime */
  raw?: string;
}

/**
 * Task isolation mode enumeration
 * - 'full': Full isolation with container + worktree
 * - 'worktree': Git worktree isolation only (no container)
 * - 'shared': Shared workspace with current directory (current behavior)
 */
export const IsolationModeSchema = z.enum(['full', 'worktree', 'shared']);
export type IsolationMode = z.infer<typeof IsolationModeSchema>;

/**
 * Workspace isolation strategy enumeration
 */
export const WorkspaceStrategySchema = z.enum(['worktree', 'container', 'directory', 'none']);
export type WorkspaceStrategy = z.infer<typeof WorkspaceStrategySchema>;

/**
 * Default container configuration schema for workspace settings
 * Provides project-wide defaults that can be overridden per-task
 */
export const ContainerDefaultsSchema = z.object({
  /** Default Docker/OCI image to use for container workspaces */
  image: z.string()
    .min(1, 'Container image cannot be empty')
    .regex(/^[a-z0-9][a-z0-9\-._]*([\/][a-z0-9][a-z0-9\-._]*)*(:[\w][\w.-]*)?$/i,
           'Invalid container image format. Use format: [registry/]name[:tag]')
    .optional(),
  /** Default resource limits for containers */
  resourceLimits: ResourceLimitsSchema.optional(),
  /** Default network mode for container networking */
  networkMode: ContainerNetworkModeSchema.optional(),
  /** Default environment variables to set in containers */
  environment: z.record(z.string(), z.string()).optional(),
  /** Whether to automatically remove containers after they stop (default: true) */
  autoRemove: z.boolean().optional().default(true),
  /** Default timeout for dependency installation in milliseconds */
  installTimeout: z.number().positive().optional(),
  /** Default number of retry attempts for dependency installation on failure */
  installRetries: z.number().int().min(0).optional(),
});
export type ContainerDefaults = z.infer<typeof ContainerDefaultsSchema>;

/**
 * Workspace defaults configuration schema for project-level settings
 * Defines default workspace isolation behavior and container settings
 */
export const WorkspaceDefaultsSchema = z.object({
  /** Default isolation strategy for tasks (default: 'none') */
  defaultStrategy: WorkspaceStrategySchema.optional().default('none'),
  /** Whether to cleanup workspace after task completion (default: true) */
  cleanupOnComplete: z.boolean().optional().default(true),
  /** Default container configuration for container-based workspaces */
  container: ContainerDefaultsSchema.optional(),
});
export type WorkspaceDefaults = z.infer<typeof WorkspaceDefaultsSchema>;

/**
 * Workspace isolation configuration schema for tasks
 */
export const WorkspaceConfigSchema = z.object({
  /** Isolation strategy */
  strategy: WorkspaceStrategySchema,
  /** Path to workspace (for worktree/directory strategies) */
  path: z.string().optional(),
  /** Container configuration (for container strategy) */
  container: ContainerConfigSchema.optional(),
  /** Whether to cleanup workspace after task completion */
  cleanup: z.boolean(),
  /** Whether to preserve workspace on task failure */
  preserveOnFailure: z.boolean().optional().default(false),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

// ============================================================================
// Iteration History Types (v0.4.0)
// ============================================================================

/**
 * Snapshot of task state at a specific point in time for iteration tracking
 */
export interface IterationSnapshot {
  /** Timestamp when the snapshot was taken */
  timestamp: Date;
  /** Current stage of the task */
  stage?: string;
  /** Current status of the task */
  status: TaskStatus;
  /** Files that have been created or modified */
  files: {
    created: string[];
    modified: string[];
  };
  /** Current usage statistics */
  usage: TaskUsage;
  /** Number of artifacts associated with the task */
  artifactCount: number;
}

/**
 * Difference computation between two iterations
 */
export interface IterationDiff {
  /** ID of the iteration being compared */
  iterationId: string;
  /** ID of the previous iteration being compared against (if any) */
  previousIterationId?: string;
  /** Change in stage between iterations */
  stageChange?: { from: string; to: string };
  /** Files that changed between iterations */
  filesChanged: {
    added: string[];
    modified: string[];
    removed: string[];
  };
  /** Change in task status between iterations */
  statusChange?: { from: TaskStatus; to: TaskStatus };
  /** Difference in token usage */
  tokenUsageDelta: number;
  /** Difference in estimated cost */
  costDelta: number;
  /** Human-readable summary of the changes */
  summary: string;
}

/**
 * Represents a single iteration entry containing user feedback and system response
 */
export interface IterationEntry {
  /** Unique identifier for this iteration */
  id: string;
  /** User feedback provided for this iteration */
  feedback: string;
  /** Timestamp when the iteration was created */
  timestamp: Date;
  /** Summary of changes made in response to feedback */
  diffSummary?: string;
  /** Stage where the iteration occurred */
  stage?: string;
  /** Files that were modified in this iteration */
  modifiedFiles?: string[];
  /** Agent that processed the iteration */
  agent?: string;
  /** Snapshot of task state before the iteration */
  beforeState?: IterationSnapshot;
  /** Snapshot of task state after the iteration */
  afterState?: IterationSnapshot;
}

/**
 * Collection of iteration entries for a task, maintaining chronological order
 */
export interface IterationHistory {
  /** Array of iteration entries in chronological order */
  entries: IterationEntry[];
  /** Total number of iterations performed */
  totalIterations: number;
  /** Timestamp of the most recent iteration */
  lastIterationAt?: Date;
}

/**
 * Session recovery and context data for tasks
 */
export interface TaskSessionData {
  /** Last checkpoint timestamp */
  lastCheckpoint: Date;
  /** Current conversation context (summarized) */
  contextSummary?: string;
  /** Full conversation history (limited size) */
  conversationHistory?: AgentMessage[];
  /** Stage-specific state data */
  stageState?: Record<string, unknown>;
  /** Resumable execution point */
  resumePoint?: {
    stage: string;
    stepIndex: number;
    metadata?: Record<string, unknown>;
  };
  /** Iteration history for this task session */
  iterationHistory?: IterationHistory;
}

/**
 * Quick thought capture for ideas related to tasks
 */
export interface ThoughtCapture {
  id: string;
  content: string;
  tags?: string[];
  priority: 'low' | 'medium' | 'high';
  taskId?: string;
  createdAt: Date;
  implementedAt?: Date;
  status: 'captured' | 'planned' | 'implemented' | 'discarded';
}

/**
 * Task interaction commands for managing running tasks
 */
export interface TaskInteraction {
  taskId: string;
  command: 'iterate' | 'inspect' | 'diff' | 'iteration-diff' | 'pause' | 'resume' | 'cancel';
  parameters?: Record<string, unknown>;
  requestedBy: string;
  requestedAt: Date;
  processedAt?: Date;
  result?: string;
}

/**
 * Service installation configuration
 */
export interface ServiceInstallConfig {
  name: string;
  description: string;
  execPath: string;
  workingDirectory: string;
  user?: string;
  group?: string;
  environment?: Record<string, string>;
  dependencies?: string[];
  restartPolicy: 'always' | 'on-failure' | 'no';
  maxRestarts?: number;
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
  effort?: TaskEffort;
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
  | 'task:session-resumed'
  | 'task:decomposed'
  | 'task:iteration-started'
  | 'task:iteration-completed'
  | 'task:trashed'
  | 'task:restored'
  | 'task:archived'
  | 'task:unarchived'
  | 'trash:emptied'
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
  | 'log:entry'
  | 'worktree:merge-cleaned'
  | 'container:created'
  | 'container:started'
  | 'container:stopped'
  | 'container:died'
  | 'container:removed'
  | 'container:health';

export interface ApexEvent {
  type: ApexEventType;
  taskId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ============================================================================
// Container Lifecycle Event Data Types (v0.4.0)
// ============================================================================

/**
 * Base interface for all container event data
 * Contains common fields shared across all container lifecycle events
 */
export interface ContainerEventDataBase {
  /** Container ID (full or short form) */
  containerId: string;
  /** Container name */
  containerName: string;
  /** Docker/OCI image used */
  image: string;
  /** Associated task ID */
  taskId?: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
}

/**
 * Event data for 'container:created' event
 * Emitted when a new container is created (but not yet started)
 */
export interface ContainerCreatedEventData extends ContainerEventDataBase {
  /** Container configuration used for creation */
  config?: ContainerConfig;
  /** Labels applied to the container */
  labels?: Record<string, string>;
}

/**
 * Event data for 'container:started' event
 * Emitted when a container begins running
 */
export interface ContainerStartedEventData extends ContainerEventDataBase {
  /** Process ID of the container's main process (if available) */
  pid?: number;
  /** Port mappings (host:container) */
  ports?: Record<string, string>;
  /** Network mode the container is running in */
  networkMode?: ContainerNetworkMode;
}

/**
 * Event data for 'container:stopped' event
 * Emitted when a container is gracefully stopped
 */
export interface ContainerStoppedEventData extends ContainerEventDataBase {
  /** Exit code from the container's main process */
  exitCode: number;
  /** Duration the container was running (in milliseconds) */
  runDuration?: number;
  /** Whether the stop was requested (graceful) or unexpected */
  graceful: boolean;
}

/**
 * Event data for 'container:died' event
 * Emitted when a container terminates unexpectedly or crashes
 */
export interface ContainerDiedEventData extends ContainerEventDataBase {
  /** Exit code from the container's main process */
  exitCode: number;
  /** Signal that caused the container to die (if applicable) */
  signal?: string;
  /** OOM (Out of Memory) killed indicator */
  oomKilled: boolean;
  /** Error message if available */
  error?: string;
  /** Duration the container was running before death (in milliseconds) */
  runDuration?: number;
}

/**
 * Event data for 'container:removed' event
 * Emitted when a container is removed from the system
 */
export interface ContainerRemovedEventData extends ContainerEventDataBase {
  /** Whether the removal was forced */
  forced: boolean;
  /** Final exit code of the container before removal */
  exitCode?: number;
  /** Whether volumes were also removed */
  volumesRemoved?: boolean;
}

/**
 * Health check status values
 */
export type ContainerHealthStatus = 'starting' | 'healthy' | 'unhealthy' | 'none';

/**
 * Event data for 'container:health' event
 * Emitted when a container's health status changes
 */
export interface ContainerHealthEventData extends ContainerEventDataBase {
  /** Current health status */
  status: ContainerHealthStatus;
  /** Previous health status (if transitioning) */
  previousStatus?: ContainerHealthStatus;
  /** Number of consecutive health check failures */
  failingStreak?: number;
  /** Output from the last health check */
  lastCheckOutput?: string;
  /** Exit code from the last health check */
  lastCheckExitCode?: number;
  /** Time of the last health check */
  lastCheckTime?: Date;
}

/**
 * Union type for all container event data types
 * Use this for type-safe event handling
 */
export type ContainerEventData =
  | ContainerCreatedEventData
  | ContainerStartedEventData
  | ContainerStoppedEventData
  | ContainerDiedEventData
  | ContainerRemovedEventData
  | ContainerHealthEventData;

/**
 * Type-safe container event interface
 * Provides strong typing for container lifecycle events
 */
export interface ContainerEvent<T extends ContainerEventData = ContainerEventData> {
  type: Extract<ApexEventType, `container:${string}`>;
  taskId: string;
  timestamp: Date;
  data: T;
}

/**
 * Helper type to get the event data type for a specific container event type
 */
export type ContainerEventDataFor<T extends ApexEventType> =
  T extends 'container:created' ? ContainerCreatedEventData :
  T extends 'container:started' ? ContainerStartedEventData :
  T extends 'container:stopped' ? ContainerStoppedEventData :
  T extends 'container:died' ? ContainerDiedEventData :
  T extends 'container:removed' ? ContainerRemovedEventData :
  T extends 'container:health' ? ContainerHealthEventData :
  never;

// ============================================================================
// Enhanced Complexity Metrics Types (v0.4.0)
// ============================================================================

/**
 * Represents a complexity hotspot in the codebase
 */
export interface ComplexityHotspot {
  /** File path relative to project root */
  file: string;
  /** Cyclomatic complexity score */
  cyclomaticComplexity: number;
  /** Cognitive complexity score */
  cognitiveComplexity: number;
  /** Number of lines in the file */
  lineCount: number;
}

/**
 * Represents a code smell detected in the codebase
 */
export interface CodeSmell {
  /** File path relative to project root */
  file: string;
  /** Type of code smell */
  type: 'long-method' | 'large-class' | 'duplicate-code' | 'dead-code' | 'magic-numbers' | 'feature-envy' | 'data-clumps' | 'deep-nesting';
  /** Severity level of the code smell */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Additional details about the code smell */
  details: string;
}

/**
 * Represents a pattern of duplicated code in the codebase
 */
export interface DuplicatePattern {
  /** The duplicated code pattern or snippet */
  pattern: string;
  /** Array of file locations where this pattern appears */
  locations: string[];
  /** Similarity percentage (0-1) */
  similarity: number;
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

/**
 * Session limit detection status
 */
export interface SessionLimitStatus {
  /** Whether the session is approaching the context window limit */
  nearLimit: boolean;
  /** Current token usage estimate */
  currentTokens: number;
  /** Current utilization percentage (0-1) */
  utilization: number;
  /** Recommended action based on utilization */
  recommendation: 'continue' | 'summarize' | 'checkpoint' | 'handoff';
  /** Human-readable description of the status */
  message: string;
}

// ============================================================================
// Detector Finding Event Types (v0.4.0)
// ============================================================================

/**
 * Supported detector types for event emission
 */
export type DetectorType =
  | 'outdated-docs'
  | 'version-mismatch'
  | 'stale-comment'
  | 'code-smell'
  | 'complexity-hotspot'
  | 'duplicate-code'
  | 'undocumented-export'
  | 'missing-readme-section'
  | 'security-vulnerability'
  | 'deprecated-dependency';

/**
 * Generic detector finding event payload
 */
export interface DetectorFinding {
  /** Type of detector that found the issue */
  detectorType: DetectorType;
  /** Severity level of the finding */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** File where the issue was found */
  file: string;
  /** Line number (if applicable) */
  line?: number;
  /** Human-readable description */
  description: string;
  /** Additional metadata specific to the detector type */
  metadata?: Record<string, unknown>;
}

/**
 * Version mismatch finding specific structure
 */
export interface VersionMismatchFinding {
  file: string;
  line: number;
  foundVersion: string;
  expectedVersion: string;
  lineContent: string;
}

/**
 * Stale comment finding specific structure
 */
export interface StaleCommentFinding {
  file: string;
  line: number;
  text: string;
  type: 'TODO' | 'FIXME' | 'HACK';
  author?: string;
  date?: Date;
  daysSinceAdded: number;
}

// ============================================================================
// Enhanced Documentation Analysis Types (v0.4.0)
// ============================================================================

/**
 * Configuration for outdated documentation detection
 */
export const OutdatedDocsConfigSchema = z.object({
  /** Number of days after which a TODO comment is considered outdated */
  todoAgeThresholdDays: z.number().min(1).optional().default(30),
  /** Array of regex patterns for detecting version references in documentation */
  versionCheckPatterns: z.array(z.string()).optional().default([
    'v\\d+\\.\\d+\\.\\d+',
    'version\\s+\\d+\\.\\d+',
    '\\d+\\.\\d+\\s+release',
    'npm\\s+install.*@\\d+\\.\\d+\\.\\d+',
  ]),
  /** Whether deprecated APIs require migration documentation */
  deprecationRequiresMigration: z.boolean().optional().default(true),
  /** Whether to enable cross-reference validation between documentation and code */
  crossReferenceEnabled: z.boolean().optional().default(true),
});
export type OutdatedDocsConfig = z.infer<typeof OutdatedDocsConfigSchema>;

/**
 * Configuration wrapper for documentation analysis settings
 */
export const DocumentationAnalysisConfigSchema = z.object({
  /** Enable documentation analysis features */
  enabled: z.boolean().optional().default(true),
  /** Configuration for outdated documentation detection */
  outdatedDocs: OutdatedDocsConfigSchema.optional(),
  /** Configuration for JSDoc analysis (existing functionality) */
  jsdocAnalysis: z.object({
    enabled: z.boolean().optional().default(true),
    requirePublicExports: z.boolean().optional().default(true),
    checkReturnTypes: z.boolean().optional().default(true),
    checkParameterTypes: z.boolean().optional().default(true),
  }).optional(),
  /** Configuration for README section analysis */
  readmeSections: z.object({
    /** Enable README section analysis */
    enabled: z.boolean().optional().default(true),
    /** Required sections that must be present */
    required: z.array(z.string()).optional().default(['title', 'description', 'installation', 'usage']),
    /** Recommended sections that should be present */
    recommended: z.array(z.string()).optional().default(['api', 'contributing', 'license']),
    /** Optional sections that are nice to have */
    optional: z.array(z.string()).optional().default(['testing', 'troubleshooting', 'faq', 'changelog']),
    /** Custom section definitions with their detection patterns */
    customSections: z.record(z.object({
      /** Display name for the section */
      displayName: z.string(),
      /** Priority level for this section */
      priority: z.enum(['required', 'recommended', 'optional']),
      /** Keywords or patterns to detect this section */
      indicators: z.array(z.string()),
      /** Description of what this section should contain */
      description: z.string(),
    })).optional().default({}),
  }).optional(),
});
export type DocumentationAnalysisConfig = z.infer<typeof DocumentationAnalysisConfigSchema>;

/**
 * Represents an export that is missing JSDoc documentation
 */
export interface UndocumentedExport {
  /** File path where the export is located */
  file: string;
  /** Name of the exported function, class, or variable */
  name: string;
  /** Type of export (function, class, interface, type, variable, etc.) */
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'namespace';
  /** Line number where the export is defined */
  line: number;
  /** Whether the export is publicly accessible (not internal) */
  isPublic: boolean;
}

/**
 * Represents documentation that is outdated or references deprecated APIs
 */
export interface OutdatedDocumentation {
  /** File path of the documentation */
  file: string;
  /** Type of outdated content */
  type: 'version-mismatch' | 'deprecated-api' | 'broken-link' | 'outdated-example' | 'stale-reference';
  /** Description of the outdated content */
  description: string;
  /** Line number where the issue occurs (if applicable) */
  line?: number;
  /** Suggested fix or update */
  suggestion?: string;
  /** Severity of the issue */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Standard sections that should be present in a README
 */
export type ReadmeSection =
  | 'title'
  | 'description'
  | 'installation'
  | 'usage'
  | 'api'
  | 'examples'
  | 'contributing'
  | 'license'
  | 'changelog'
  | 'troubleshooting'
  | 'faq'
  | 'dependencies'
  | 'testing'
  | 'deployment';

/**
 * Information about missing README sections
 */
export interface MissingReadmeSection {
  /** The section that is missing */
  section: ReadmeSection;
  /** Priority/importance of this section */
  priority: 'required' | 'recommended' | 'optional';
  /** Brief description of what this section should contain */
  description: string;
}

/**
 * Detailed information about API documentation completeness
 */
export interface APIDocumentationDetails {
  /** Total number of public API endpoints/methods/functions */
  totalEndpoints: number;
  /** Number of documented endpoints */
  documentedEndpoints: number;
  /** List of undocumented API items */
  undocumentedItems: Array<{
    name: string;
    file: string;
    type: 'endpoint' | 'method' | 'function' | 'class';
    line?: number;
  }>;
  /** Examples of well-documented items */
  wellDocumentedExamples: string[];
  /** Common documentation issues found */
  commonIssues: string[];
}

/**
 * Overall API documentation completeness assessment
 */
export interface APICompleteness {
  /** Percentage of API coverage (0-100) */
  percentage: number;
  /** Detailed breakdown of what's documented and what isn't */
  details: APIDocumentationDetails;
}

/**
 * Enhanced documentation analysis result structure
 */
export interface EnhancedDocumentationAnalysis {
  /** Current coverage percentage */
  coverage: number;
  /** Files that might need documentation (legacy field) */
  missingDocs: string[];
  /** List of exports missing JSDoc documentation */
  undocumentedExports: UndocumentedExport[];
  /** Documentation that references outdated or deprecated content */
  outdatedDocs: OutdatedDocumentation[];
  /** Missing sections in README files */
  missingReadmeSections: MissingReadmeSection[];
  /** API documentation completeness analysis */
  apiCompleteness: APICompleteness;
}

// ============================================================================
// Test Analysis Types (v0.4.0)
// ============================================================================

/**
 * Represents branch coverage statistics for a specific area of code
 */
export interface BranchCoverage {
  /** Coverage percentage (0-100) */
  percentage: number;
  /** List of uncovered code branches */
  uncoveredBranches: Array<{
    /** File path relative to project root */
    file: string;
    /** Line number where the branch starts */
    line: number;
    /** Type of branch (if/else, switch case, try/catch, etc.) */
    type: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical';
    /** Brief description of the uncovered branch */
    description: string;
  }>;
}

/**
 * Represents an export that lacks test coverage
 */
export interface UntestedExport {
  /** File path relative to project root */
  file: string;
  /** Name of the exported symbol */
  exportName: string;
  /** Type of export (function, class, interface, etc.) */
  exportType: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'namespace';
  /** Line number where the export is defined */
  line?: number;
  /** Whether this is a public API export */
  isPublic: boolean;
}

/**
 * Represents a missing integration test for a critical code path
 */
export interface MissingIntegrationTest {
  /** Description of the critical path or user journey */
  criticalPath: string;
  /** Detailed description of what should be tested */
  description: string;
  /** Priority level based on business impact */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Related files or components involved in this path */
  relatedFiles?: string[];
}

/**
 * Represents a testing anti-pattern found in the codebase
 */
export interface TestingAntiPattern {
  /** File path where the anti-pattern was found */
  file: string;
  /** Line number where the anti-pattern occurs */
  line: number;
  /** Type of anti-pattern detected */
  type: 'brittle-test' | 'test-pollution' | 'mystery-guest' | 'eager-test' | 'assertion-roulette' | 'slow-test' | 'flaky-test' | 'test-code-duplication' | 'no-assertion' | 'commented-out' | 'console-only' | 'empty-test' | 'hardcoded-timeout';
  /** Detailed description of the anti-pattern */
  description: string;
  /** Severity of the anti-pattern */
  severity: 'low' | 'medium' | 'high';
  /** Suggested fix or improvement */
  suggestion?: string;
}

/**
 * Comprehensive test analysis data structure
 */
export interface TestAnalysis {
  /** Branch coverage statistics */
  branchCoverage: BranchCoverage;
  /** Exports that lack test coverage */
  untestedExports: UntestedExport[];
  /** Missing integration tests for critical paths */
  missingIntegrationTests: MissingIntegrationTest[];
  /** Testing anti-patterns found in the codebase */
  antiPatterns: TestingAntiPattern[];
}

// ============================================================================
// Task Template Types
// ============================================================================

export const TaskTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Template name is required').max(100, 'Template name must be 100 characters or less'),
  description: z.string().min(1, 'Template description is required'),
  workflow: z.string().min(1, 'Workflow is required'),
  priority: TaskPrioritySchema.default('normal'),
  effort: TaskEffortSchema.default('medium'),
  acceptanceCriteria: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>;

// ============================================================================
// Idle Task Types (v0.4.0)
// ============================================================================

export const IdleTaskSchema = z.object({
  id: z.string(),
  type: IdleTaskTypeSchema,
  title: z.string(),
  description: z.string(),
  priority: TaskPrioritySchema,
  estimatedEffort: TaskEffortSchema,
  suggestedWorkflow: z.string(),
  rationale: z.string(),
  createdAt: z.date(),
  implemented: z.boolean().default(false),
  implementedTaskId: z.string().optional(),
});
export type IdleTask = z.infer<typeof IdleTaskSchema>;
