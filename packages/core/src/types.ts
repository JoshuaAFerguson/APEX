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
  'NotebookEdit',
  'Bash',
  'Grep',
  'Glob',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
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
// Tool Definitions
// ============================================================================

/**
 * Tool categories for organizing tools by function
 */
export const ToolCategorySchema = z.enum([
  'filesystem',  // File reading/writing operations (Read, Write, Edit)
  'search',      // Content/file searching (Grep, Glob)
  'shell',       // Command execution (Bash)
  'web',         // Web operations (WebFetch, WebSearch)
  'system',      // System-level operations
  'custom',      // User-defined tools
]);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

/**
 * Permission levels required for tool execution
 */
export const ToolPermissionSchema = z.enum([
  'read',        // Read-only access to files
  'write',       // Write access to files
  'execute',     // Execute commands/scripts
  'network',     // Network access
  'admin',       // Administrative operations
]);
export type ToolPermission = z.infer<typeof ToolPermissionSchema>;

// ============================================================================
// User Permission Management
// ============================================================================

/**
 * Permission level for user-granted tool permissions
 * - 'allow-always': Permanently allow the tool/scope combination
 * - 'allow-once': Allow for a single invocation only
 * - 'deny': Deny the tool/scope combination
 */
export const PermissionLevelSchema = z.enum([
  'allow-always',  // Permanently allow the tool/scope combination
  'allow-once',    // Allow for a single invocation only
  'deny',          // Deny the tool/scope combination
]);
export type PermissionLevel = z.infer<typeof PermissionLevelSchema>;

/**
 * A stored permission record for tool access
 * Tracks user decisions about whether agents can use specific tools
 */
export const PermissionSchema = z.object({
  /** Name of the tool this permission applies to */
  tool: z.string().min(1, 'Tool name is required'),
  /** Optional scope to narrow the permission (e.g., file path pattern, command pattern) */
  scope: z.string().optional(),
  /** The permission level granted */
  level: PermissionLevelSchema,
  /** Optional expiration timestamp after which the permission is no longer valid */
  expiry: z.date().optional(),
  /** Timestamp when the permission was created */
  createdAt: z.date(),
});
export type Permission = z.infer<typeof PermissionSchema>;

/**
 * Query parameters for looking up permissions
 * Used to check if a permission exists for a specific tool/scope combination
 */
export const PermissionQuerySchema = z.object({
  /** Tool name to query permission for */
  tool: z.string().min(1, 'Tool name is required'),
  /** Optional scope to narrow the query */
  scope: z.string().optional(),
});
export type PermissionQuery = z.infer<typeof PermissionQuerySchema>;

// ============================================================================
// Per-Tool Permission Configuration (v0.5.0)
// ============================================================================

/**
 * Directory access configuration for filesystem-related tools
 * Controls which directories a tool can access using allowlist/blocklist patterns
 */
export const DirectoryAccessConfigSchema = z.object({
  /** Paths that are explicitly allowed (glob patterns supported) */
  allowlist: z.array(z.string()).optional().default([]),

  /** Paths that are explicitly blocked (glob patterns supported) */
  blocklist: z.array(z.string()).optional().default([]),

  /**
   * Whether to allow access to paths not in allowlist/blocklist
   * Default: false if allowlist is non-empty, true otherwise
   */
  defaultAllow: z.boolean().optional(),

  /** Whether to resolve symlinks when checking paths (default: true) */
  resolveSymlinks: z.boolean().optional().default(true),

  /** Maximum directory depth for recursive operations (0 = unlimited) */
  maxDepth: z.number().int().min(0).optional().default(0),
});
export type DirectoryAccessConfig = z.infer<typeof DirectoryAccessConfigSchema>;

/**
 * Base configuration shared by all tool permission configs
 * Contains common settings applicable to any tool type
 */
export const BaseToolPermissionConfigSchema = z.object({
  /** Whether the tool is enabled */
  enabled: z.boolean().optional().default(true),

  /** Maximum execution time in milliseconds (0 = no limit) */
  timeout: z.number().int().min(0).optional().default(0),

  /** Whether to require confirmation before execution */
  requireConfirmation: z.boolean().optional().default(false),

  /** Rate limiting: maximum calls per minute (0 = no limit) */
  rateLimitPerMinute: z.number().int().min(0).optional().default(0),

  /** Custom metadata for the tool configuration */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type BaseToolPermissionConfig = z.infer<typeof BaseToolPermissionConfigSchema>;

/**
 * Configuration for filesystem tools (Read, Write, Edit, Glob)
 * Extends base config with file-specific settings
 */
export const FilesystemToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Directory access control */
  directoryAccess: DirectoryAccessConfigSchema.optional(),

  /** Maximum file size in bytes for read/write operations (0 = no limit) */
  maxFileSize: z.number().int().min(0).optional().default(0),

  /** Allowed file extensions (empty = all allowed) */
  allowedExtensions: z.array(z.string()).optional().default([]),

  /** Blocked file extensions */
  blockedExtensions: z.array(z.string()).optional().default([]),
});
export type FilesystemToolConfig = z.infer<typeof FilesystemToolConfigSchema>;

/**
 * Configuration for shell/command execution tools (Bash)
 * Extends base config with command-specific settings
 */
export const ShellToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Directory access control for working directory */
  directoryAccess: DirectoryAccessConfigSchema.optional(),

  /** Command patterns to block (regex strings) */
  blockedCommands: z.array(z.string()).optional().default([]),

  /** Whether to allow running commands as root/admin */
  allowElevatedPrivileges: z.boolean().optional().default(false),

  /** Environment variables to inject */
  environment: z.record(z.string(), z.string()).optional(),

  /** Working directory override */
  workingDirectory: z.string().optional(),
});
export type ShellToolConfig = z.infer<typeof ShellToolConfigSchema>;

/**
 * Configuration for web access tools (WebFetch, WebSearch)
 * Extends base config with network-specific settings
 */
export const WebToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Allowed domains for web access (empty = all allowed) */
  allowedDomains: z.array(z.string()).optional().default([]),

  /** Blocked domains */
  blockedDomains: z.array(z.string()).optional().default([]),

  /** Maximum response size in bytes */
  maxResponseSize: z.number().int().min(0).optional().default(0),

  /** Whether to follow redirects */
  followRedirects: z.boolean().optional().default(true),

  /** Custom headers to include in requests */
  headers: z.record(z.string(), z.string()).optional(),
});
export type WebToolConfig = z.infer<typeof WebToolConfigSchema>;

/**
 * Configuration for search tools (Grep)
 * Extends base config with search-specific settings
 */
export const SearchToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Directory access control for search scope */
  directoryAccess: DirectoryAccessConfigSchema.optional(),

  /** Maximum number of results */
  maxResults: z.number().int().min(1).optional().default(1000),

  /** File patterns to include in search */
  includePatterns: z.array(z.string()).optional().default([]),

  /** File patterns to exclude from search */
  excludePatterns: z.array(z.string()).optional().default([]),
});
export type SearchToolConfig = z.infer<typeof SearchToolConfigSchema>;

/**
 * Union of all tool-specific configuration schemas
 * Provides per-tool settings that control how tools operate
 */
export const ToolPermissionConfigSchema = z.union([
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  WebToolConfigSchema,
  SearchToolConfigSchema,
  BaseToolPermissionConfigSchema, // Fallback for generic tools
]);
export type ToolPermissionConfig = z.infer<typeof ToolPermissionConfigSchema>;

/**
 * Extended permission schema with per-tool configuration
 * Adds tool-specific settings, grant metadata, and categorization
 */
export const ExtendedPermissionSchema = PermissionSchema.extend({
  /** Per-tool configuration settings */
  config: ToolPermissionConfigSchema.optional(),

  /** Description of why this permission was granted */
  grantReason: z.string().optional(),

  /** Who/what granted this permission (user, system, agent name) */
  grantedBy: z.string().optional(),

  /** Tags for categorizing and filtering permissions */
  tags: z.array(z.string()).optional().default([]),
});
export type ExtendedPermission = z.infer<typeof ExtendedPermissionSchema>;

// ============================================================================
// PermissionManager Extension Interfaces (v0.5.0)
// ============================================================================

/**
 * Options for checkToolPermission method
 */
export interface ToolPermissionCheckOptions {
  /** Optional scope for the permission check */
  scope?: string;
  /** Optional path to validate against directory access rules */
  path?: string;
  /** Whether to consume allow-once permissions (default: true) */
  consumeAllowOnce?: boolean;
  /** Optional base directory for path validation */
  baseDir?: string;
}

/**
 * Result of a comprehensive tool permission check
 */
export interface ToolPermissionResult {
  /** Whether the tool is allowed to execute */
  allowed: boolean;
  /** The permission level (null if no permission exists) */
  level: PermissionLevel | null;
  /** Whether user confirmation is required */
  requiresConfirmation: boolean;
  /** Reason for denial (if not allowed) */
  denialReason?: string;
  /** Tool-specific configuration (if available) */
  config?: ToolPermissionConfig;
  /** Path validation result (if path was provided) */
  pathValidation?: import('./directory-access-validator.js').PathValidationResult;
}

/**
 * Options for checkDirectoryAccess method
 */
export interface DirectoryAccessCheckOptions {
  /** Tool name for tool-specific directory access config */
  tool?: string;
  /** Scope for the permission check */
  scope?: string;
  /** Base directory for resolving relative paths */
  baseDir?: string;
}

/**
 * Result of directory access validation
 */
export interface DirectoryAccessResult {
  /** Whether access to the path is allowed */
  allowed: boolean;
  /** Reason for the decision */
  reason: string;
  /** The matched pattern (if any) */
  matchedPattern?: string;
  /** Whether it matched allowlist, blocklist, or defaulted */
  matchType?: 'allowlist' | 'blocklist' | 'default';
  /** The directory access config that was used */
  configUsed?: DirectoryAccessConfig;
}

/**
 * JSON Schema type for tool parameters
 */
export const JSONSchemaTypeSchema = z.enum([
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
  'null',
]);
export type JSONSchemaType = z.infer<typeof JSONSchemaTypeSchema>;

/**
 * Tool parameter definition with JSON Schema-compatible structure
 * Supports nested object and array types for complex parameter definitions
 */
export const ToolParameterSchema: z.ZodType<ToolParameter> = z.lazy(() =>
  z.object({
    /** Parameter name */
    name: z.string().min(1, 'Parameter name is required'),
    /** JSON Schema type */
    type: JSONSchemaTypeSchema,
    /** Human-readable description */
    description: z.string().optional(),
    /** Whether the parameter is required */
    required: z.boolean().optional().default(false),
    /** Default value for the parameter */
    default: z.unknown().optional(),
    /** Allowed values (for enum-like constraints) */
    enum: z.array(z.unknown()).optional(),
    /** Nested properties for object types */
    properties: z.record(z.string(), ToolParameterSchema).optional(),
    /** Schema for array items */
    items: ToolParameterSchema.optional(),
    /** Minimum value for numbers */
    minimum: z.number().optional(),
    /** Maximum value for numbers */
    maximum: z.number().optional(),
    /** Minimum length for strings/arrays */
    minLength: z.number().optional(),
    /** Maximum length for strings/arrays */
    maxLength: z.number().optional(),
    /** Pattern for string validation (regex) */
    pattern: z.string().optional(),
  })
);

/**
 * Tool parameter interface for TypeScript
 */
export interface ToolParameter {
  name: string;
  type: JSONSchemaType;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, ToolParameter>;
  items?: ToolParameter;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

/**
 * JSON Schema representation of tool parameters
 * Compatible with JSON Schema Draft 7 for tool parameter definitions
 */
export const ToolParametersSchemaSchema = z.object({
  /** JSON Schema type (typically 'object' for tool parameters) */
  type: z.literal('object').default('object'),
  /** Object properties defining each parameter */
  properties: z.record(z.string(), z.object({
    type: JSONSchemaTypeSchema,
    description: z.string().optional(),
    default: z.unknown().optional(),
    enum: z.array(z.unknown()).optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    items: z.unknown().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  })).optional().default({}),
  /** Array of required property names */
  required: z.array(z.string()).optional().default([]),
  /** Whether additional properties are allowed */
  additionalProperties: z.boolean().optional().default(false),
});
export type ToolParametersSchema = z.infer<typeof ToolParametersSchemaSchema>;

/**
 * Example usage for a tool
 */
export const ToolExampleSchema = z.object({
  /** Name/title of the example */
  name: z.string().min(1),
  /** Description of what this example demonstrates */
  description: z.string().optional(),
  /** Input parameters for the example */
  input: z.record(z.string(), z.unknown()),
  /** Expected output (optional) */
  output: z.unknown().optional(),
});
export type ToolExample = z.infer<typeof ToolExampleSchema>;

/**
 * Complete tool definition schema
 * Defines all metadata and configuration for a tool that agents can use
 */
export const ToolDefinitionSchema = z.object({
  /** Unique tool identifier */
  name: z.string().min(1, 'Tool name is required').max(64, 'Tool name must be 64 characters or less'),
  /** Human-readable description of what the tool does */
  description: z.string().min(1, 'Tool description is required'),
  /** JSON Schema definition for tool parameters */
  parameters: ToolParametersSchemaSchema,
  /** Whether this tool performs dangerous operations requiring confirmation */
  dangerous: z.boolean().default(false),
  /** Permission requirements for executing this tool */
  permissions: z.array(ToolPermissionSchema).default([]),
  /** Category for organizing and filtering tools */
  category: ToolCategorySchema,
  /** Optional usage examples */
  examples: z.array(ToolExampleSchema).optional(),
  /** Deprecation notice if tool is deprecated */
  deprecated: z.string().optional(),
  /** Version of the tool (semver) */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format').optional(),
  /** Whether the tool is enabled by default */
  enabled: z.boolean().default(true),
  /** Tags for additional categorization */
  tags: z.array(z.string()).optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

/**
 * Result of a tool execution
 */
export const ToolResultSchema = z.object({
  /** Whether the tool execution was successful */
  success: z.boolean(),
  /** The output data from the tool */
  output: z.unknown().optional(),
  /** Error message if the execution failed */
  error: z.string().optional(),
  /** Execution duration in milliseconds */
  duration: z.number().min(0).optional(),
  /** Additional metadata about the execution */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Tool name that was executed */
  toolName: z.string().optional(),
  /** Timestamp when the tool was invoked */
  invokedAt: z.date().optional(),
  /** Timestamp when the tool completed */
  completedAt: z.date().optional(),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * Tool invocation request
 */
export const ToolInvocationSchema = z.object({
  /** Tool to invoke */
  toolName: z.string().min(1),
  /** Parameters to pass to the tool */
  parameters: z.record(z.string(), z.unknown()),
  /** Optional timeout in milliseconds */
  timeout: z.number().min(0).optional(),
  /** Request ID for tracking */
  requestId: z.string().optional(),
  /** Context about who/what is invoking the tool */
  context: z.object({
    taskId: z.string().optional(),
    agentName: z.string().optional(),
    stageName: z.string().optional(),
  }).optional(),
});
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;

/**
 * Tool registry entry combining definition with runtime state
 */
export const ToolRegistryEntrySchema = z.object({
  /** The tool definition */
  definition: ToolDefinitionSchema,
  /** Whether the tool is currently available */
  available: z.boolean().default(true),
  /** Reason if the tool is unavailable */
  unavailableReason: z.string().optional(),
  /** Last time the tool was invoked */
  lastInvoked: z.date().optional(),
  /** Number of times the tool has been invoked */
  invocationCount: z.number().min(0).default(0),
  /** Number of successful invocations */
  successCount: z.number().min(0).default(0),
  /** Number of failed invocations */
  failureCount: z.number().min(0).default(0),
});
export type ToolRegistryEntry = z.infer<typeof ToolRegistryEntrySchema>;

// ============================================================================
// Autonomy Control Types
// ============================================================================

/**
 * Autonomy levels that control how much human oversight is required
 * - full-auto: Agent operates autonomously with no approval checkpoints
 * - review-before-commit: Agent pauses for human review before committing changes
 * - review-all: Agent pauses for human review at all major decision points
 */
export const AutonomyLevelSchema = z.enum([
  'full-auto',
  'review-before-commit',
  'review-all',
]);
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;

/**
 * @deprecated Use AutonomyLevelSchema instead. This is kept for backward compatibility.
 * Maps legacy values to new autonomy levels:
 * - 'full' -> 'full-auto'
 * - 'review-before-commit' -> 'review-before-commit'
 * - 'review-before-merge' -> 'review-before-commit'
 * - 'manual' -> 'review-all'
 */
export const LegacyAutonomyLevelSchema = z.enum([
  'full',
  'review-before-commit',
  'review-before-merge',
  'manual',
]);
export type LegacyAutonomyLevel = z.infer<typeof LegacyAutonomyLevelSchema>;

/**
 * Converts a legacy autonomy level to the new format
 */
export function migrateLegacyAutonomyLevel(legacy: LegacyAutonomyLevel): AutonomyLevel {
  switch (legacy) {
    case 'full':
      return 'full-auto';
    case 'review-before-commit':
    case 'review-before-merge':
      return 'review-before-commit';
    case 'manual':
      return 'review-all';
  }
}

/**
 * Types of approval checkpoints that can be configured
 * - before-commit: Requires approval before committing changes to version control
 * - before-deploy: Requires approval before deployment operations
 * - before-destructive: Requires approval before destructive operations (delete, overwrite)
 * - custom: User-defined checkpoint with custom trigger condition
 */
export const ApprovalCheckpointTypeSchema = z.enum([
  'before-commit',
  'before-deploy',
  'before-destructive',
  'custom',
]);
export type ApprovalCheckpointType = z.infer<typeof ApprovalCheckpointTypeSchema>;

/**
 * Configuration for an approval gate (checkpoint)
 * Defines when and how approval is required during task execution
 */
export const ApprovalGateSchema = z.object({
  /** Type of checkpoint */
  type: ApprovalCheckpointTypeSchema,
  /** Human-readable name for this gate */
  name: z.string().optional(),
  /** Description of what this gate protects */
  description: z.string().optional(),
  /** Whether this gate is required or can be skipped */
  required: z.boolean().default(true),
  /** Custom trigger condition (for 'custom' type) - evaluated as expression */
  trigger: z.string().optional(),
  /** List of approver identifiers (usernames, roles, or emails) */
  approvers: z.array(z.string()).optional(),
  /** Timeout in minutes before the gate auto-rejects (undefined = no timeout) */
  timeout: z.number().min(1).optional(),
  /** Whether to auto-approve if timeout is reached (default: false = auto-reject) */
  autoApproveOnTimeout: z.boolean().default(false),
  /** Minimum number of approvals required (default: 1) */
  minApprovals: z.number().min(1).default(1),
  /** Tags/labels for categorizing this gate */
  tags: z.array(z.string()).optional(),
});
export type ApprovalGate = z.infer<typeof ApprovalGateSchema>;

/**
 * Resource limits for task execution
 * Controls budget, token usage, time, and change scope
 */
export const TaskResourceLimitsSchema = z.object({
  /** Maximum cost in USD for this task (e.g., 10.0 for $10) */
  maxCost: z.number().min(0).optional(),
  /** Maximum tokens that can be consumed (input + output) */
  maxTokens: z.number().min(0).optional(),
  /** Maximum execution time in milliseconds */
  maxTimeMs: z.number().min(0).optional(),
  /** Maximum number of files that can be created */
  maxFilesCreated: z.number().min(0).optional(),
  /** Maximum number of files that can be modified */
  maxFilesModified: z.number().min(0).optional(),
  /** Maximum number of files that can be deleted */
  maxFilesDeleted: z.number().min(0).optional(),
  /** Maximum total lines of code that can be changed (added + removed) */
  maxLinesChanged: z.number().min(0).optional(),
  /** Maximum number of API/agent turns */
  maxTurns: z.number().min(1).optional(),
  /** Daily budget limit in USD (shared across all tasks) */
  dailyBudget: z.number().min(0).optional(),
  /** Maximum concurrent tasks allowed */
  maxConcurrentTasks: z.number().min(1).optional(),
});
export type TaskResourceLimits = z.infer<typeof TaskResourceLimitsSchema>;

/**
 * Autonomy configuration for a workflow or task
 * Combines autonomy level with approval gates and resource limits
 */
export const AutonomyConfigSchema = z.object({
  /** Base autonomy level */
  level: AutonomyLevelSchema.default('review-before-commit'),
  /** Approval gates/checkpoints for this configuration */
  gates: z.array(ApprovalGateSchema).optional(),
  /** Resource limits for task execution */
  limits: TaskResourceLimitsSchema.optional(),
  /** Per-stage autonomy overrides (stage name -> autonomy level) */
  stageOverrides: z.record(z.string(), AutonomyLevelSchema).optional(),
  /** Per-agent autonomy overrides (agent name -> autonomy level) */
  agentOverrides: z.record(z.string(), AutonomyLevelSchema).optional(),
});
export type AutonomyConfig = z.infer<typeof AutonomyConfigSchema>;

// ============================================================================
// Workflow Definitions
// ============================================================================

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
  mode: z.lazy(() => IsolationModeSchema),
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
  // Integrated services - API and Web UI
  services: z.object({
    api: z.object({
      enabled: z.boolean().optional().default(false),
      port: z.number().optional().default(4000),
      host: z.string().optional().default('localhost'),
    }).optional(),
    webui: z.object({
      enabled: z.boolean().optional().default(false),
      port: z.number().optional().default(3000),
      host: z.string().optional().default('localhost'),
    }).optional(),
  }).optional(),
  // Task restart behavior
  taskRestart: z.object({
    // Only restart root parent tasks, let orchestrator manage children
    restartParentOnly: z.boolean().optional().default(true),
  }).optional(),
});
export type DaemonConfig = z.infer<typeof DaemonConfigSchema>;

// ============================================================================
// Daemon Health Metrics Types (v0.4.0)
// ============================================================================

/**
 * Memory usage statistics for the daemon process
 * Mirrors Node.js process.memoryUsage() structure for easy population
 */
export interface DaemonMemoryUsage {
  /** V8 heap memory in use (bytes) */
  heapUsed: number;
  /** Total V8 heap memory allocated (bytes) */
  heapTotal: number;
  /** Resident Set Size - total memory allocated for the process (bytes) */
  rss: number;
}

/**
 * Task processing statistics for the daemon
 * Tracks the lifecycle of tasks through the system
 */
export interface DaemonTaskCounts {
  /** Total number of tasks processed since daemon start */
  processed: number;
  /** Number of tasks that completed successfully */
  succeeded: number;
  /** Number of tasks that failed */
  failed: number;
  /** Number of tasks currently being processed */
  active: number;
}

/**
 * Record of a daemon restart event
 * Used to track restart history for monitoring and debugging
 */
export interface RestartRecord {
  /** When the restart occurred */
  timestamp: Date;
  /** Reason for the restart (e.g., 'crash', 'oom', 'watchdog', 'manual') */
  reason: string;
  /** Exit code from the previous instance (if applicable) */
  exitCode?: number;
  /** Whether the restart was triggered by the watchdog */
  triggeredByWatchdog: boolean;
}

/**
 * Health metrics for the APEX daemon
 * Tracks system health, resource usage, and operational statistics
 * Used by the daemon health monitor, API endpoints, and CLI status command
 */
export interface HealthMetrics {
  /** Daemon uptime in milliseconds */
  uptime: number;
  /** Current memory usage statistics */
  memoryUsage: DaemonMemoryUsage;
  /** Task processing statistics */
  taskCounts: DaemonTaskCounts;
  /** Timestamp of the last health check */
  lastHealthCheck: Date;
  /** Number of health checks that passed since daemon start */
  healthChecksPassed: number;
  /** Number of health checks that failed since daemon start */
  healthChecksFailed: number;
  /** History of daemon restarts (most recent first, limited to last N entries) */
  restartHistory: RestartRecord[];
}

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
  workspace: z.lazy(() => WorkspaceDefaultsSchema).optional(),
  /** Permission preset configuration for tool access control (v0.5.0) */
  permissions: z.lazy(() => PermissionsConfigSchema).optional(),
  /** Policy-as-code configuration for governance and compliance (v0.5.0) */
  policy: z.lazy(() => PolicyConfigSchema).optional(),
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
  | 'container:health'
  | 'permission:request'
  | 'permission:granted'
  | 'permission:denied'
  | 'dangerous:detected'
  | 'dangerous:confirmed'
  | 'dangerous:blocked';

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
// Permission Event Data Types (v0.5.0)
// ============================================================================

/**
 * Event data for 'permission:request' event
 * Emitted when an agent requests permission to use a tool with specific parameters
 */
export interface PermissionRequestEventData {
  /** Unique identifier for this permission request */
  requestId: string;
  /** The tool that requires permission */
  tool: string;
  /** Optional scope/context for the permission (e.g., file path, command pattern) */
  scope?: string;
  /** Description of what the tool will do (for user confirmation) */
  description: string;
  /** Whether this is flagged as a dangerous operation */
  isDangerous: boolean;
  /** The agent requesting the permission */
  agent: string;
  /** Timestamp when the request was made */
  timestamp: Date;
  /** Additional metadata about the request */
  metadata?: Record<string, unknown>;
}

/**
 * Event data for 'permission:granted' event
 * Emitted when a permission request has been approved by the user
 */
export interface PermissionGrantedEventData {
  /** The permission request ID that was granted */
  requestId: string;
  /** The tool that was granted permission */
  tool: string;
  /** The scope for which permission was granted */
  scope?: string;
  /** The permission level that was granted */
  level: PermissionLevel;
  /** Who granted the permission (user, system, etc.) */
  grantedBy: string;
  /** Timestamp when permission was granted */
  timestamp: Date;
  /** Optional reason provided for granting permission */
  reason?: string;
}

/**
 * Event data for 'permission:denied' event
 * Emitted when a permission request has been denied by the user
 */
export interface PermissionDeniedEventData {
  /** The permission request ID that was denied */
  requestId: string;
  /** The tool that was denied permission */
  tool: string;
  /** The scope for which permission was denied */
  scope?: string;
  /** Who denied the permission (user, system, etc.) */
  deniedBy: string;
  /** Timestamp when permission was denied */
  timestamp: Date;
  /** Reason provided for denying permission */
  reason: string;
}

/**
 * Event data for 'dangerous:detected' event
 * Emitted when a dangerous operation is detected and requires confirmation
 */
export interface DangerousOperationDetectedEventData {
  /** Unique identifier for this dangerous operation detection */
  operationId: string;
  /** The tool involved in the dangerous operation */
  tool: string;
  /** Details about the dangerous operation */
  operation: string;
  /** Risk level (low, medium, high, critical) */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Description of the potential risks */
  riskDescription: string;
  /** The agent attempting the operation */
  agent: string;
  /** Timestamp when the dangerous operation was detected */
  timestamp: Date;
  /** Additional context about the operation */
  context?: Record<string, unknown>;
}

/**
 * Event data for 'dangerous:confirmed' event
 * Emitted when a dangerous operation has been confirmed by the user
 */
export interface DangerousOperationConfirmedEventData {
  /** The operation ID that was confirmed */
  operationId: string;
  /** The tool that will execute the dangerous operation */
  tool: string;
  /** Details about the confirmed operation */
  operation: string;
  /** Who confirmed the operation (user, system, etc.) */
  confirmedBy: string;
  /** Timestamp when operation was confirmed */
  timestamp: Date;
  /** Optional reason provided for confirming the operation */
  reason?: string;
}

/**
 * Event data for 'dangerous:blocked' event
 * Emitted when a dangerous operation has been blocked by the user
 */
export interface DangerousOperationBlockedEventData {
  /** The operation ID that was blocked */
  operationId: string;
  /** The tool that was blocked from executing the operation */
  tool: string;
  /** Details about the blocked operation */
  operation: string;
  /** Who blocked the operation (user, system, etc.) */
  blockedBy: string;
  /** Timestamp when operation was blocked */
  timestamp: Date;
  /** Reason provided for blocking the operation */
  reason: string;
}

/**
 * Union type for all permission-related event data
 */
export type PermissionEventData =
  | PermissionRequestEventData
  | PermissionGrantedEventData
  | PermissionDeniedEventData
  | DangerousOperationDetectedEventData
  | DangerousOperationConfirmedEventData
  | DangerousOperationBlockedEventData;

/**
 * Type-safe permission event interface
 * Provides strong typing for permission-related events
 */
export interface PermissionEvent<T extends PermissionEventData = PermissionEventData> {
  type: Extract<ApexEventType, `permission:${string}` | `dangerous:${string}`>;
  taskId: string;
  timestamp: Date;
  data: T;
}

/**
 * Helper type to get the event data type for a specific permission event type
 */
export type PermissionEventDataFor<T extends ApexEventType> =
  T extends 'permission:request' ? PermissionRequestEventData :
  T extends 'permission:granted' ? PermissionGrantedEventData :
  T extends 'permission:denied' ? PermissionDeniedEventData :
  T extends 'dangerous:detected' ? DangerousOperationDetectedEventData :
  T extends 'dangerous:confirmed' ? DangerousOperationConfirmedEventData :
  T extends 'dangerous:blocked' ? DangerousOperationBlockedEventData :
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

// ============================================================================
// Todo Management Types (TodoWrite Tool)
// ============================================================================

/**
 * Todo status enumeration
 * Represents the current state of a todo item
 */
export const TodoStatusSchema = z.enum(['pending', 'in_progress', 'completed']);
export type TodoStatus = z.infer<typeof TodoStatusSchema>;

/**
 * Individual todo item (input format for TodoWrite tool)
 * Minimal representation used when creating/updating todos
 */
export const TodoItemSchema = z.object({
  /** Display content describing the task in imperative form (e.g., "Run tests") */
  content: z.string().min(1, 'Todo content is required'),
  /** Current status of the todo */
  status: TodoStatusSchema,
  /** Present continuous form for active display (e.g., "Running tests") */
  activeForm: z.string().min(1, 'Active form is required'),
});
export type TodoItem = z.infer<typeof TodoItemSchema>;

/**
 * Full todo with metadata (used internally)
 * Complete representation with database fields and timestamps
 */
export const TodoSchema = z.object({
  /** Unique identifier for this todo */
  id: z.string().min(1),
  /** Display content describing the task */
  content: z.string().min(1),
  /** Current status */
  status: TodoStatusSchema,
  /** Present continuous form for active display */
  activeForm: z.string().min(1),
  /** Associated task ID (if any) */
  taskId: z.string().optional(),
  /** Order/position in the list */
  orderIndex: z.number().int().min(0),
  /** When the todo was created */
  createdAt: z.date(),
  /** When the todo was last updated */
  updatedAt: z.date(),
  /** When the todo was completed (if completed) */
  completedAt: z.date().optional(),
});
export type Todo = z.infer<typeof TodoSchema>;

/**
 * TodoWrite tool input schema
 * Contains the complete updated todo list
 */
export const TodoWriteInputSchema = z.object({
  /** The complete updated todo list */
  todos: z.array(TodoItemSchema),
});
export type TodoWriteInput = z.infer<typeof TodoWriteInputSchema>;

/**
 * TodoWrite tool output schema
 * Summary information about the updated todo list
 */
export const TodoWriteOutputSchema = z.object({
  /** Whether the operation was successful */
  success: z.boolean(),
  /** Total number of todos */
  todosCount: z.number().int().min(0),
  /** Number of pending todos */
  pendingCount: z.number().int().min(0),
  /** Number of in-progress todos */
  inProgressCount: z.number().int().min(0),
  /** Number of completed todos */
  completedCount: z.number().int().min(0),
  /** The complete updated todo list with metadata */
  todos: z.array(TodoSchema),
});
export type TodoWriteOutput = z.infer<typeof TodoWriteOutputSchema>;

// ============================================================================
// Permission Presets (v0.5.0)
// ============================================================================

/**
 * Permission preset enumeration
 * Defines predefined permission configurations for agent tool access:
 * - 'autonomous': All tools allowed without confirmation (full autonomy)
 * - 'review-all': All tools require user confirmation before execution
 * - 'read-only': Only read-only tools allowed (Read, Grep, Glob, WebFetch, WebSearch)
 */
export const PermissionPresetSchema = z.enum([
  'autonomous',   // All tools allowed without confirmation
  'review-all',   // All tools require confirmation before execution
  'read-only',    // Only read-only tools allowed
]);
export type PermissionPreset = z.infer<typeof PermissionPresetSchema>;

/**
 * Tool permission behavior for a specific tool
 * - 'allow': Tool is allowed without confirmation
 * - 'confirm': Tool requires user confirmation before execution
 * - 'deny': Tool is not allowed
 */
export const ToolPermissionBehaviorSchema = z.enum([
  'allow',    // Tool is allowed without confirmation
  'confirm',  // Tool requires user confirmation
  'deny',     // Tool is not allowed
]);
export type ToolPermissionBehavior = z.infer<typeof ToolPermissionBehaviorSchema>;

/**
 * Read-only tools that don't modify the filesystem or execute commands
 * These tools are safe to use in read-only mode
 */
export const READ_ONLY_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'WebFetch',
  'WebSearch',
] as const;
export type ReadOnlyTool = typeof READ_ONLY_TOOLS[number];

/**
 * Write/execute tools that can modify the filesystem or execute commands
 * These tools require elevated permissions in restricted modes
 */
export const WRITE_TOOLS = [
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'Bash',
  'TodoWrite',
] as const;
export type WriteTool = typeof WRITE_TOOLS[number];

/**
 * All available tools combining read-only and write tools
 */
export const ALL_TOOLS = [...READ_ONLY_TOOLS, ...WRITE_TOOLS] as const;
export type AllTool = typeof ALL_TOOLS[number];

/**
 * Tool permission rule schema
 * Defines the permission behavior for a specific tool or tool pattern
 */
export const ToolPermissionRuleSchema = z.object({
  /** Tool name or pattern (supports wildcards like 'Web*') */
  tool: z.string().min(1, 'Tool name is required'),
  /** Permission behavior for this tool */
  behavior: ToolPermissionBehaviorSchema,
  /** Optional scope restriction (e.g., file path pattern for file tools) */
  scope: z.string().optional(),
  /** Optional reason for this permission rule */
  reason: z.string().optional(),
});
export type ToolPermissionRule = z.infer<typeof ToolPermissionRuleSchema>;

/**
 * Permission preset configuration schema
 * Defines the complete permission configuration for a preset
 */
export const PermissionPresetConfigSchema = z.object({
  /** Name of the preset */
  name: PermissionPresetSchema,
  /** Human-readable description of what this preset allows */
  description: z.string(),
  /** Default behavior for tools not explicitly listed */
  defaultBehavior: ToolPermissionBehaviorSchema,
  /** Specific tool permission rules (overrides default behavior) */
  rules: z.array(ToolPermissionRuleSchema).optional().default([]),
  /** Whether this preset allows creating new files */
  allowFileCreation: z.boolean().default(false),
  /** Whether this preset allows executing shell commands */
  allowShellExecution: z.boolean().default(false),
  /** Whether this preset allows network access */
  allowNetworkAccess: z.boolean().default(true),
});
export type PermissionPresetConfig = z.infer<typeof PermissionPresetConfigSchema>;

/**
 * Predefined permission preset configurations
 * These are the built-in presets that can be used out of the box
 */
export const PERMISSION_PRESET_CONFIGS: Record<PermissionPreset, PermissionPresetConfig> = {
  /**
   * Autonomous preset: All tools allowed without confirmation
   * Use when you want agents to operate with full autonomy
   */
  autonomous: {
    name: 'autonomous',
    description: 'All tools allowed without confirmation. Agents operate with full autonomy.',
    defaultBehavior: 'allow',
    rules: [],
    allowFileCreation: true,
    allowShellExecution: true,
    allowNetworkAccess: true,
  },

  /**
   * Review-all preset: All tools require confirmation
   * Use when you want to review every tool invocation before execution
   */
  'review-all': {
    name: 'review-all',
    description: 'All tools require user confirmation before execution.',
    defaultBehavior: 'confirm',
    rules: [],
    allowFileCreation: true,
    allowShellExecution: true,
    allowNetworkAccess: true,
  },

  /**
   * Read-only preset: Only read-only tools allowed
   * Use when you want agents to only observe without making changes
   */
  'read-only': {
    name: 'read-only',
    description: 'Only read-only tools allowed. No file modifications or command execution.',
    defaultBehavior: 'deny',
    rules: [
      { tool: 'Read', behavior: 'allow' },
      { tool: 'Grep', behavior: 'allow' },
      { tool: 'Glob', behavior: 'allow' },
      { tool: 'WebFetch', behavior: 'allow' },
      { tool: 'WebSearch', behavior: 'allow' },
    ],
    allowFileCreation: false,
    allowShellExecution: false,
    allowNetworkAccess: true,
  },
};

/**
 * Helper function to get the permission behavior for a tool given a preset
 * @param preset - The permission preset to use
 * @param toolName - The name of the tool to check
 * @returns The permission behavior for the tool
 */
export function getToolBehaviorForPreset(
  preset: PermissionPreset,
  toolName: string
): ToolPermissionBehavior {
  const config = PERMISSION_PRESET_CONFIGS[preset];

  // Check for specific rule for this tool
  const rule = config.rules?.find(r => r.tool === toolName);
  if (rule) {
    return rule.behavior;
  }

  // Return default behavior
  return config.defaultBehavior;
}

/**
 * Helper function to check if a tool is allowed (without confirmation) for a preset
 * @param preset - The permission preset to use
 * @param toolName - The name of the tool to check
 * @returns True if the tool is allowed without confirmation
 */
export function isToolAllowedForPreset(
  preset: PermissionPreset,
  toolName: string
): boolean {
  return getToolBehaviorForPreset(preset, toolName) === 'allow';
}

/**
 * Helper function to check if a tool requires confirmation for a preset
 * @param preset - The permission preset to use
 * @param toolName - The name of the tool to check
 * @returns True if the tool requires confirmation
 */
export function isToolConfirmRequiredForPreset(
  preset: PermissionPreset,
  toolName: string
): boolean {
  return getToolBehaviorForPreset(preset, toolName) === 'confirm';
}

/**
 * Helper function to check if a tool is denied for a preset
 * @param preset - The permission preset to use
 * @param toolName - The name of the tool to check
 * @returns True if the tool is denied
 */
export function isToolDeniedForPreset(
  preset: PermissionPreset,
  toolName: string
): boolean {
  return getToolBehaviorForPreset(preset, toolName) === 'deny';
}

/**
 * Helper function to get the preset configuration
 * @param preset - The permission preset name
 * @returns The full preset configuration
 */
export function getPresetConfig(preset: PermissionPreset): PermissionPresetConfig {
  return PERMISSION_PRESET_CONFIGS[preset];
}

/**
 * Type guard to check if a string is a valid PermissionPreset
 * @param value - The value to check
 * @returns True if the value is a valid PermissionPreset
 */
export function isPermissionPreset(value: unknown): value is PermissionPreset {
  return PermissionPresetSchema.safeParse(value).success;
}

/**
 * Permissions configuration schema for ApexConfig
 * Defines the permission preset and optional custom rules for tool access control
 */
export const PermissionsConfigSchema = z.object({
  /**
   * Permission preset to use for tool access control
   * - 'autonomous': All tools allowed without confirmation (full autonomy)
   * - 'review-all': All tools require user confirmation before execution (default)
   * - 'read-only': Only read-only tools allowed (Read, Grep, Glob, WebFetch, WebSearch)
   */
  preset: PermissionPresetSchema.optional().default('review-all'),

  /**
   * Custom per-tool permission rules that override the preset defaults
   * Use this to fine-tune permissions for specific tools while using a preset as the base
   */
  customRules: z.array(ToolPermissionRuleSchema).optional().default([]),
});
export type PermissionsConfig = z.infer<typeof PermissionsConfigSchema>;

// ============================================================================
// Policy-as-Code Configuration (v0.5.0)
// ============================================================================

/**
 * Path access mode for policy enforcement
 * - 'allowlist': Only paths matching the patterns are allowed (deny by default)
 * - 'blocklist': Paths matching the patterns are blocked (allow by default)
 */
export const PathAccessModeSchema = z.enum(['allowlist', 'blocklist']);
export type PathAccessMode = z.infer<typeof PathAccessModeSchema>;

/**
 * Configuration for allowed filesystem paths in policy-as-code
 * Uses glob patterns to define which paths agents can access
 */
export const AllowedPathsConfigSchema = z.object({
  /**
   * Access control mode
   * - 'allowlist': Only explicitly allowed paths are accessible (default)
   * - 'blocklist': All paths are accessible except explicitly blocked ones
   */
  mode: PathAccessModeSchema.optional().default('allowlist'),

  /**
   * Glob patterns for paths that are allowed
   * Examples: ['src/**', 'tests/**', '*.md', 'package.json']
   * When mode is 'allowlist', only these paths are accessible
   * When mode is 'blocklist', these patterns are ignored
   */
  allow: z.array(z.string()).optional().default([]),

  /**
   * Glob patterns for paths that are blocked
   * Examples: ['node_modules/**', '.env*', '**\/*.key', 'secrets/**']
   * These take precedence over allow patterns in allowlist mode
   * When mode is 'blocklist', these paths are blocked
   */
  block: z.array(z.string()).optional().default([]),

  /**
   * Sensitive file patterns that always require confirmation
   * Examples: ['.env*', '**\/config.json', '**\/*.secret']
   * Access to these files will prompt for human approval even if otherwise allowed
   */
  sensitivePatterns: z.array(z.string()).optional().default([]),

  /**
   * Whether to follow symlinks when validating paths (default: false for security)
   */
  followSymlinks: z.boolean().optional().default(false),

  /**
   * Maximum depth for recursive operations (0 = unlimited, default: 10)
   */
  maxDepth: z.number().int().min(0).optional().default(10),
});
export type AllowedPathsConfig = z.infer<typeof AllowedPathsConfigSchema>;

/**
 * Test requirement enforcement level
 * - 'none': No test requirements enforced
 * - 'warn': Warn when test requirements are not met but allow proceeding
 * - 'require': Block operations when test requirements are not met
 */
export const TestEnforcementLevelSchema = z.enum(['none', 'warn', 'require']);
export type TestEnforcementLevel = z.infer<typeof TestEnforcementLevelSchema>;

/**
 * A single test requirement rule
 * Defines when tests are required and what tests should exist
 */
export const TestRequirementRuleSchema = z.object({
  /**
   * Name/identifier for this rule
   */
  name: z.string().min(1, 'Rule name is required'),

  /**
   * Description of what this rule enforces
   */
  description: z.string().optional(),

  /**
   * Glob patterns for source files that trigger this rule
   * Examples: ['src/**\/*.ts', 'lib/**\/*.js']
   * When any of these files are modified, the rule is evaluated
   */
  sourcePatterns: z.array(z.string()).min(1, 'At least one source pattern is required'),

  /**
   * Glob patterns for test files that satisfy this rule
   * Examples: ['tests/**\/*.test.ts', '**\/*.spec.js']
   * At least one matching test file must exist for modified source files
   */
  testPatterns: z.array(z.string()).min(1, 'At least one test pattern is required'),

  /**
   * Naming convention for mapping source files to test files
   * Variables: {filename}, {basename}, {ext}, {dir}
   * Example: '{dir}/__tests__/{basename}.test.ts' means src/utils.ts -> src/__tests__/utils.test.ts
   */
  testNamingConvention: z.string().optional(),

  /**
   * Minimum test coverage percentage required (0-100)
   * Set to 0 to disable coverage requirement
   */
  minCoverage: z.number().min(0).max(100).optional().default(0),

  /**
   * Enforcement level for this specific rule (overrides global setting)
   */
  enforcement: TestEnforcementLevelSchema.optional(),

  /**
   * Whether tests must pass before changes can be committed
   */
  mustPass: z.boolean().optional().default(true),

  /**
   * Whether this rule is enabled (default: true)
   */
  enabled: z.boolean().optional().default(true),

  /**
   * Tags for categorizing rules (e.g., 'unit', 'integration', 'e2e')
   */
  tags: z.array(z.string()).optional().default([]),
});
export type TestRequirementRule = z.infer<typeof TestRequirementRuleSchema>;

/**
 * Configuration for required tests in policy-as-code
 * Defines rules for when and what tests are required
 */
export const RequiredTestsConfigSchema = z.object({
  /**
   * Global enforcement level for test requirements
   * Can be overridden per-rule
   */
  enforcement: TestEnforcementLevelSchema.optional().default('warn'),

  /**
   * Individual test requirement rules
   */
  rules: z.array(TestRequirementRuleSchema).optional().default([]),

  /**
   * Command to run tests (defaults to project.testCommand or 'npm test')
   */
  testCommand: z.string().optional(),

  /**
   * Command to generate coverage report
   */
  coverageCommand: z.string().optional(),

  /**
   * Path to coverage report file (for parsing coverage data)
   */
  coverageReportPath: z.string().optional(),

  /**
   * File patterns to exclude from test requirements
   * Examples: ['**\/*.d.ts', '**\/index.ts', 'types/**']
   */
  excludePatterns: z.array(z.string()).optional().default([]),

  /**
   * Whether to block commits when test requirements are not met
   * Only applies when enforcement is 'require'
   */
  blockOnFailure: z.boolean().optional().default(true),
});
export type RequiredTestsConfig = z.infer<typeof RequiredTestsConfigSchema>;

/**
 * Condition type for approval rules
 * - 'file-pattern': Triggered by file path patterns
 * - 'content-pattern': Triggered by content/code patterns (regex)
 * - 'operation': Triggered by specific operations (e.g., 'delete', 'create')
 * - 'cost-threshold': Triggered when estimated cost exceeds threshold
 * - 'token-threshold': Triggered when token usage exceeds threshold
 * - 'custom': Custom expression-based condition
 */
export const ApprovalConditionTypeSchema = z.enum([
  'file-pattern',
  'content-pattern',
  'operation',
  'cost-threshold',
  'token-threshold',
  'custom',
]);
export type ApprovalConditionType = z.infer<typeof ApprovalConditionTypeSchema>;

/**
 * Operation types that can trigger approval
 */
export const ApprovalOperationTypeSchema = z.enum([
  'create',
  'modify',
  'delete',
  'execute',
  'deploy',
  'commit',
  'push',
  'merge',
]);
export type ApprovalOperationType = z.infer<typeof ApprovalOperationTypeSchema>;

/**
 * A single approval condition that triggers human review
 */
export const ApprovalConditionSchema = z.object({
  /**
   * Type of condition
   */
  type: ApprovalConditionTypeSchema,

  /**
   * Description of what this condition checks for
   */
  description: z.string().optional(),

  /**
   * Patterns to match (interpretation depends on type)
   * - file-pattern: Glob patterns for file paths
   * - content-pattern: Regex patterns for file content
   * - operation: Not used (use 'operations' field instead)
   * - cost-threshold: Not used (use 'threshold' field instead)
   * - token-threshold: Not used (use 'threshold' field instead)
   * - custom: Not used (use 'expression' field instead)
   */
  patterns: z.array(z.string()).optional(),

  /**
   * Operations that trigger this condition (for 'operation' type)
   */
  operations: z.array(ApprovalOperationTypeSchema).optional(),

  /**
   * Numeric threshold value (for threshold-based conditions)
   * - cost-threshold: Maximum cost in USD before requiring approval
   * - token-threshold: Maximum tokens before requiring approval
   */
  threshold: z.number().min(0).optional(),

  /**
   * Custom expression for evaluation (for 'custom' type)
   * Can reference variables like: {cost}, {tokens}, {files}, {operation}
   */
  expression: z.string().optional(),
});
export type ApprovalCondition = z.infer<typeof ApprovalConditionSchema>;

/**
 * Approval urgency level affecting timeout behavior
 * - 'low': Long timeout (24h), can be auto-approved
 * - 'normal': Standard timeout (1h)
 * - 'high': Short timeout (15m), must be reviewed promptly
 * - 'critical': Very short timeout (5m), blocks everything until resolved
 */
export const ApprovalUrgencySchema = z.enum(['low', 'normal', 'high', 'critical']);
export type ApprovalUrgency = z.infer<typeof ApprovalUrgencySchema>;

/**
 * A single approval rule defining when human approval is required
 */
export const ApprovalRuleSchema = z.object({
  /**
   * Unique identifier for this rule
   */
  id: z.string().min(1, 'Rule ID is required'),

  /**
   * Human-readable name for this rule
   */
  name: z.string().min(1, 'Rule name is required'),

  /**
   * Description of what this rule protects and why approval is needed
   */
  description: z.string().optional(),

  /**
   * Whether this rule is enabled (default: true)
   */
  enabled: z.boolean().optional().default(true),

  /**
   * Conditions that trigger this approval rule (ANY match triggers)
   * Use multiple conditions to create OR logic
   */
  conditions: z.array(ApprovalConditionSchema).min(1, 'At least one condition is required'),

  /**
   * Whether ALL conditions must match (default: false = ANY condition triggers)
   */
  requireAllConditions: z.boolean().optional().default(false),

  /**
   * Urgency level affecting timeout and notification behavior
   */
  urgency: ApprovalUrgencySchema.optional().default('normal'),

  /**
   * Specific approvers required (usernames, emails, or roles)
   * If empty, any authorized user can approve
   */
  approvers: z.array(z.string()).optional().default([]),

  /**
   * Minimum number of approvals required (default: 1)
   */
  minApprovals: z.number().int().min(1).optional().default(1),

  /**
   * Timeout in minutes before the request expires
   * Default varies by urgency: low=1440, normal=60, high=15, critical=5
   */
  timeoutMinutes: z.number().int().min(1).optional(),

  /**
   * Action to take on timeout
   * - 'reject': Reject the operation (default for high/critical)
   * - 'approve': Auto-approve (only for 'low' urgency)
   * - 'escalate': Escalate to higher authority
   */
  timeoutAction: z.enum(['reject', 'approve', 'escalate']).optional().default('reject'),

  /**
   * Message template shown to approvers
   * Can use variables: {operation}, {files}, {cost}, {agent}, {task}
   */
  messageTemplate: z.string().optional(),

  /**
   * Tags for categorizing and filtering rules
   */
  tags: z.array(z.string()).optional().default([]),

  /**
   * Priority when multiple rules match (higher = evaluated first)
   */
  priority: z.number().int().min(0).optional().default(0),
});
export type ApprovalRule = z.infer<typeof ApprovalRuleSchema>;

/**
 * Configuration for approval rules in policy-as-code
 * Defines conditions that require human approval before proceeding
 */
export const ApprovalRulesConfigSchema = z.object({
  /**
   * Whether approval rules are enabled (default: true)
   */
  enabled: z.boolean().optional().default(true),

  /**
   * Individual approval rules
   */
  rules: z.array(ApprovalRuleSchema).optional().default([]),

  /**
   * Default timeout in minutes for rules without explicit timeout
   */
  defaultTimeoutMinutes: z.number().int().min(1).optional().default(60),

  /**
   * Default action when approval request times out
   */
  defaultTimeoutAction: z.enum(['reject', 'approve', 'escalate']).optional().default('reject'),

  /**
   * Global approvers who can approve any request
   */
  globalApprovers: z.array(z.string()).optional().default([]),

  /**
   * Whether to send notifications for approval requests
   */
  notificationsEnabled: z.boolean().optional().default(true),

  /**
   * Notification channels configuration
   */
  notificationChannels: z.object({
    /** Slack webhook URL for notifications */
    slack: z.string().optional(),
    /** Email addresses for notifications */
    email: z.array(z.string()).optional(),
    /** Custom webhook URL for notifications */
    webhook: z.string().optional(),
  }).optional(),

  /**
   * Whether to log all approval decisions for audit
   */
  auditLog: z.boolean().optional().default(true),

  /**
   * Path to store audit logs (relative to .apex directory)
   */
  auditLogPath: z.string().optional().default('approval-audit.log'),
});
export type ApprovalRulesConfig = z.infer<typeof ApprovalRulesConfigSchema>;

/**
 * Policy enforcement mode
 * - 'strict': All policy violations block operations
 * - 'warn': Policy violations generate warnings but don't block
 * - 'audit': Policy violations are logged but operations proceed silently
 * - 'disabled': Policy checks are disabled
 */
export const PolicyEnforcementModeSchema = z.enum(['strict', 'warn', 'audit', 'disabled']);
export type PolicyEnforcementMode = z.infer<typeof PolicyEnforcementModeSchema>;

/**
 * Complete policy-as-code configuration
 * Combines allowed paths, required tests, and approval rules for comprehensive policy control
 */
export const PolicyConfigSchema = z.object({
  /**
   * Schema version for policy configuration (for migration support)
   */
  version: z.string().optional().default('1.0'),

  /**
   * Human-readable name for this policy
   */
  name: z.string().optional(),

  /**
   * Description of what this policy enforces
   */
  description: z.string().optional(),

  /**
   * Global enforcement mode for all policy rules
   */
  enforcement: PolicyEnforcementModeSchema.optional().default('warn'),

  /**
   * Filesystem path access control configuration
   * Controls which paths agents can read from and write to
   */
  allowedPaths: AllowedPathsConfigSchema.optional(),

  /**
   * Required tests configuration
   * Ensures code changes have corresponding tests
   */
  requiredTests: RequiredTestsConfigSchema.optional(),

  /**
   * Approval rules configuration
   * Defines conditions that require human approval
   */
  approvalRules: ApprovalRulesConfigSchema.optional(),

  /**
   * Whether this policy is enabled (default: true)
   */
  enabled: z.boolean().optional().default(true),

  /**
   * Tags for categorizing policies
   */
  tags: z.array(z.string()).optional().default([]),

  /**
   * Custom metadata for extensibility
   */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

/**
 * Validation result for a single policy rule
 */
export interface PolicyValidationResult {
  /** Whether the validation passed */
  passed: boolean;
  /** Rule ID that was evaluated */
  ruleId: string;
  /** Rule name for display */
  ruleName: string;
  /** Type of rule (path, test, approval) */
  ruleType: 'path' | 'test' | 'approval';
  /** Detailed message about the result */
  message: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'error';
  /** Additional context/details */
  details?: Record<string, unknown>;
}

/**
 * Complete policy evaluation result
 */
export interface PolicyEvaluationResult {
  /** Overall policy evaluation passed */
  passed: boolean;
  /** Number of rules that passed */
  passedCount: number;
  /** Number of rules that failed */
  failedCount: number;
  /** Number of rules that generated warnings */
  warningCount: number;
  /** Individual rule results */
  results: PolicyValidationResult[];
  /** Whether human approval is required */
  requiresApproval: boolean;
  /** IDs of approval rules that were triggered */
  triggeredApprovalRules: string[];
  /** Timestamp of evaluation */
  evaluatedAt: Date;
  /** Policy configuration that was used */
  policyName?: string;
}
