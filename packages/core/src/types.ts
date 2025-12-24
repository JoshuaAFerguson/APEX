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

export type TaskEffort = 'xs' | 'small' | 'medium' | 'large' | 'xl';

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
  usage: TaskUsage;
  logs: TaskLog[];
  artifacts: TaskArtifact[];
  error?: string;
  conversation?: AgentMessage[];
  // v0.4.0 enhancements
  workspace?: WorkspaceConfig;  // Workspace isolation settings
  sessionData?: TaskSessionData; // Session recovery data
  thoughtCaptures?: ThoughtCapture[]; // Quick ideas related to this task
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

/**
 * Workspace isolation configuration for tasks
 */
export interface WorkspaceConfig {
  /** Isolation strategy */
  strategy: 'worktree' | 'container' | 'directory' | 'none';
  /** Path to workspace (for worktree/directory strategies) */
  path?: string;
  /** Container configuration (for container strategy) */
  container?: {
    image: string;
    volumes?: Record<string, string>;
    environment?: Record<string, string>;
  };
  /** Whether to cleanup workspace after task completion */
  cleanup: boolean;
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
  command: 'iterate' | 'inspect' | 'diff' | 'pause' | 'resume' | 'cancel';
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
