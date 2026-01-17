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
 * Configuration for browser automation tools (Browser)
 * Extends base config with browser-specific settings
 */
export const BrowserToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Allowed domains for navigation (empty = all allowed) */
  allowedDomains: z.array(z.string()).optional().default([]),
  /** Blocked domains */
  blockedDomains: z.array(z.string()).optional().default([]),
  /** Whether to allow JavaScript execution via evaluate() */
  allowJavaScriptExecution: z.boolean().optional(),
  /** Whether to allow form submissions */
  allowFormSubmission: z.boolean().optional(),
  /** Maximum page load timeout in milliseconds */
  pageLoadTimeout: z.number().int().min(0).optional(),
  /** Whether to allow file downloads */
  allowDownloads: z.boolean().optional(),
  /** Whether to capture screenshots */
  allowScreenshots: z.boolean().optional(),
  /** Whether to block popups/new windows */
  blockPopups: z.boolean().optional(),
  /** Browser engine to use */
  engine: z.enum(['chromium', 'firefox', 'webkit']).optional(),
  /** Browser automation backend */
  backend: z.enum(['playwright', 'puppeteer']).optional(),
  /** Whether to run headless */
  headless: z.boolean().optional(),
  /** User agent override */
  userAgent: z.string().optional(),
  /** Viewport configuration */
  viewport: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  }).optional(),
});
export type BrowserToolConfig = z.infer<typeof BrowserToolConfigSchema>;

// ============================================================================
// Browser Automation Types
// ============================================================================

/**
 * Severity levels for console messages
 * Maps to browser console API levels
 */
export const ConsoleSeveritySchema = z.enum(['log', 'info', 'warn', 'error', 'debug', 'trace']);
export type ConsoleSeverity = z.infer<typeof ConsoleSeveritySchema>;

/**
 * Stack frame representing a single frame in a stack trace
 * Used for error reporting and debugging in browser context
 */
export const StackFrameSchema = z.object({
  /** Function name or anonymous if not available */
  functionName: z.string().optional(),
  /** Source file URL */
  url: z.string(),
  /** Line number in the source file (1-based) */
  lineNumber: z.number().int().min(1),
  /** Column number in the source file (1-based) */
  columnNumber: z.number().int().min(1),
});
export type StackFrame = z.infer<typeof StackFrameSchema>;

/**
 * Console message captured from browser context
 * Represents console.log/info/warn/error messages
 */
export const ConsoleMessageSchema = z.object({
  /** The severity level of the console message */
  severity: ConsoleSeveritySchema,
  /** The message content */
  message: z.string(),
  /** Timestamp when the message was logged */
  timestamp: z.date(),
  /** Source URL where the message originated */
  sourceUrl: z.string().optional(),
  /** Line number in source where the message originated */
  lineNumber: z.number().int().min(1).optional(),
  /** Column number in source where the message originated */
  columnNumber: z.number().int().min(1).optional(),
  /** Stack trace if available */
  stackTrace: z.array(StackFrameSchema).optional(),
});
export type ConsoleMessage = z.infer<typeof ConsoleMessageSchema>;

/**
 * Browser error captured during page interaction
 * Represents JavaScript errors, network errors, etc.
 */
export const BrowserErrorSchema = z.object({
  /** Error name/type (e.g., 'TypeError', 'NetworkError') */
  name: z.string(),
  /** Error message */
  message: z.string(),
  /** Timestamp when the error occurred */
  timestamp: z.date(),
  /** Source URL where the error originated */
  sourceUrl: z.string().optional(),
  /** Line number where the error occurred */
  lineNumber: z.number().int().min(1).optional(),
  /** Column number where the error occurred */
  columnNumber: z.number().int().min(1).optional(),
  /** Stack trace for the error */
  stackTrace: z.array(StackFrameSchema).optional(),
});
export type BrowserError = z.infer<typeof BrowserErrorSchema>;

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
  BrowserToolConfigSchema,
  SearchToolConfigSchema,
  BaseToolPermissionConfigSchema, // Fallback for generic tools
]);
export type ToolPermissionConfig = z.infer<typeof ToolPermissionConfigSchema>;

/**
 * Per-tool configuration map for config.yaml
 */
export const ToolConfigSchema = z.record(ToolPermissionConfigSchema).optional().default({});
export type ToolConfig = z.infer<typeof ToolConfigSchema>;

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

// ============================================================================
// Custom Tool Configuration (v0.5.0)
// ============================================================================

export const CustomToolOutputParserSchema = z.enum(['json', 'text', 'lines']);
export type CustomToolOutputParser = z.infer<typeof CustomToolOutputParserSchema>;

export const CustomToolConfigSchema = z.object({
  /** Unique tool identifier */
  name: z.string().min(1, 'Tool name is required').max(64, 'Tool name must be 64 characters or less'),
  /** Human-readable description of what the tool does */
  description: z.string().min(1, 'Tool description is required'),
  /** Command to execute for the tool */
  command: z.string().min(1, 'Command is required'),
  /** Command-line arguments for the tool */
  args: z.array(z.string()).optional().default([]),
  /** JSON Schema for tool parameters */
  parameters: ToolParametersSchemaSchema.optional().default({
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  }),
  /** How to parse tool output */
  outputParser: CustomToolOutputParserSchema.optional().default('text'),
  /** Timeout for tool execution in milliseconds */
  timeoutMs: z.number().int().min(1).optional().default(60000),
  /** Working directory for tool execution */
  workingDirectory: z.string().optional(),
  /** Environment variables for tool execution */
  env: z.record(z.string()).optional(),
  /** Whether the tool is enabled */
  enabled: z.boolean().optional().default(true),
});
export type CustomToolConfig = z.infer<typeof CustomToolConfigSchema>;

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
 * Complete tool execution record with timing information
 * Tracks the full lifecycle of a tool execution from start to completion
 */
export const ToolExecutionSchema = z.object({
  /** Unique identifier for this tool execution */
  callId: z.string().min(1),
  /** Name of the tool that was executed */
  toolName: z.string().min(1),
  /** Input parameters passed to the tool */
  input: z.record(z.string(), z.unknown()),
  /** The task ID that initiated this tool execution */
  taskId: z.string().optional(),
  /** Name of the agent that invoked the tool */
  agentName: z.string().optional(),
  /** Workflow stage name when tool was invoked */
  stageName: z.string().optional(),
  /** Timestamp when tool execution started */
  startTime: z.date(),
  /** Timestamp when tool execution completed (if finished) */
  endTime: z.date().optional(),
  /** Duration of execution in milliseconds (if completed) */
  duration: z.number().min(0).optional(),
  /** Result of the tool execution (if completed) */
  result: z.object({
    success: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional(),
  }).optional(),
  /** Error message if execution failed (top-level for easier access) */
  error: z.string().optional(),
  /** Current status of the tool execution */
  status: z.enum(['running', 'completed', 'failed']),
  /** Additional metadata about the execution */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ToolExecution = z.infer<typeof ToolExecutionSchema>;

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
// Tool Action Tracking Types (v0.5.0)
// ============================================================================

/**
 * File snapshot captured before tool modification
 * Stores the state of a file at a specific point in time for undo functionality
 */
export const FileSnapshotSchema = z.object({
  /** Unique identifier for this snapshot */
  id: z.string().min(1),
  /** Absolute path to the file */
  filePath: z.string().min(1),
  /** Content of the file at the time of snapshot */
  content: z.string(),
  /** Checksum (hash) of the content for integrity verification */
  checksum: z.string().min(1),
  /** File size in bytes */
  fileSize: z.number().min(0),
  /** Last modified timestamp of the original file */
  lastModified: z.date(),
  /** Timestamp when this snapshot was created */
  snapshotTime: z.date(),
  /**
   * Whether the file existed before the snapshot was taken
   * Used for undo operations to know if a file should be deleted (if it didn't exist)
   * or restored to its previous content (if it did exist)
   */
  existed: z.boolean().default(true),
  /** Optional metadata about the snapshot */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type FileSnapshot = z.infer<typeof FileSnapshotSchema>;

/**
 * Tool action record for tracking tool executions with file changes
 * Extends ToolExecution with file modification tracking and undo capability
 */
export const ToolActionSchema = z.object({
  /** Unique identifier for this tool action */
  id: z.string().min(1),
  /** The underlying tool execution record */
  execution: ToolExecutionSchema,
  /** Files that were modified by this tool action */
  modifiedFiles: z.array(z.string()).default([]),
  /** File snapshots taken before modifications */
  beforeSnapshots: z.array(FileSnapshotSchema).default([]),
  /** File snapshots taken after modifications (for verification) */
  afterSnapshots: z.array(FileSnapshotSchema).default([]),
  /** Whether this action can be undone */
  canUndo: z.boolean().default(true),
  /** Whether this action has been undone */
  wasUndone: z.boolean().default(false),
  /** Timestamp when undo was performed (if applicable) */
  undoneAt: z.date().optional(),
  /** Error message if undo failed */
  undoError: z.string().optional(),
  /** Sequence number within the task for ordering */
  sequenceNumber: z.number().min(0),
  /** Optional grouping identifier for related actions */
  actionGroup: z.string().optional(),
});
export type ToolAction = z.infer<typeof ToolActionSchema>;

/**
 * Configuration for tool action store retention policies
 */
export const ToolActionRetentionConfigSchema = z.object({
  /** Maximum number of tool actions to keep per task */
  maxActionsPerTask: z.number().min(1).default(1000),
  /** Maximum age of tool actions in days before cleanup */
  maxAgeDays: z.number().min(1).default(30),
  /** Whether to keep snapshots for undone actions */
  keepUndoneSnapshots: z.boolean().default(false),
  /** Maximum total storage size for snapshots in MB */
  maxSnapshotStorageMB: z.number().min(1).default(100),
});
export type ToolActionRetentionConfig = z.infer<typeof ToolActionRetentionConfigSchema>;

// ============================================================================
// Tool Action Snapshot Types (v0.5.0)
// ============================================================================

/**
 * Represents a collection of file snapshots for a single tool action
 * Enables grouped undo operations by tracking all files modified by a tool
 */
export const ToolActionSnapshotSchema = z.object({
  /** Unique identifier for this action snapshot (typically same as the tool action ID) */
  actionId: z.string().min(1),
  /** Name of the tool that performed the action (e.g., 'Write', 'Edit', 'Bash') */
  toolName: z.string().min(1),
  /** File snapshots taken before the tool action was executed */
  snapshots: z.array(FileSnapshotSchema),
  /** Timestamp when this action snapshot was created */
  timestamp: z.date(),
  /** Optional human-readable description of what the tool action did */
  description: z.string().optional(),
  /** Whether this action snapshot can be used for undo operations */
  canUndo: z.boolean().default(true),
});
export type ToolActionSnapshot = z.infer<typeof ToolActionSnapshotSchema>;

// ============================================================================
// Tool Alias Definitions (v0.5.0)
// ============================================================================

/**
 * Parameter types supported by tool aliases
 */
export const AliasParameterTypeSchema = z.enum(['string', 'number', 'boolean']);
export type AliasParameterType = z.infer<typeof AliasParameterTypeSchema>;

/**
 * Tool alias parameter definition
 * Defines a parameter that can be passed to a tool alias
 */
export const AliasParameterSchema = z.object({
  /** Parameter name */
  name: z.string().min(1),
  /** Parameter type */
  type: AliasParameterTypeSchema,
  /** Parameter description */
  description: z.string().min(1),
  /** Default value for the parameter */
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  /** Allowed values for string parameters */
  values: z.array(z.string()).optional(),
  /** Whether the parameter is required */
  required: z.boolean().optional().default(false),
});
export type AliasParameter = z.infer<typeof AliasParameterSchema>;

/**
 * Tool alias definition schema
 * Defines a reusable tool configuration with parameterization
 */
export const ToolAliasSchema = z.object({
  /** Alias name */
  name: z.string().min(1),
  /** Target tool name */
  tool: z.string().min(1),
  /** Alias description */
  description: z.string().min(1),
  /** Tool parameters with template placeholders */
  parameters: z.record(z.string(), z.unknown()).optional(),
  /** Default parameters for the tool */
  defaults: z.record(z.string(), z.unknown()).optional(),
  /** Parameter templates with placeholder substitution */
  parameterTemplates: z.record(z.string(), z.string()).optional(),
  /** Tool execution timeout in milliseconds */
  timeout: z.number().positive().optional(),
  /** Whether to require confirmation before execution */
  requireConfirmation: z.boolean().optional().default(false),
  /** Tags for organizing aliases */
  tags: z.array(z.string()).optional().default([]),
  /** Whether the alias is enabled */
  enabled: z.boolean().optional().default(true),
  /** Parameter definitions for template substitution */
  aliasParameters: z.array(AliasParameterSchema).optional().default([]),
});
export type ToolAlias = z.infer<typeof ToolAliasSchema>;

/**
 * Tool alias configuration section in config.yaml
 */
export const ToolAliasConfigSchema = z.object({
  /** List of tool aliases */
  aliases: z.array(ToolAliasSchema).optional().default([]),
});
export type ToolAliasConfig = z.infer<typeof ToolAliasConfigSchema>;

/**
 * Expanded tool alias result
 * Result of resolving an alias with parameters
 */
export const ExpandedToolAliasSchema = z.object({
  /** Original alias name */
  aliasName: z.string(),
  /** Target tool name */
  tool: z.string(),
  /** Resolved parameters after template substitution */
  parameters: z.record(z.string(), z.unknown()),
  /** Original alias definition */
  alias: ToolAliasSchema,
});
export type ExpandedToolAlias = z.infer<typeof ExpandedToolAliasSchema>;

/**
 * Tool alias validation result
 */
export const AliasParameterValidationResultSchema = z.object({
  /** Whether validation passed */
  valid: z.boolean(),
  /** Validation errors if any */
  errors: z.array(z.string()).default([]),
  /** Sanitized parameter values */
  sanitizedParams: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type AliasParameterValidationResult = z.infer<typeof AliasParameterValidationResultSchema>;

// ============================================================================
// Undo Event Types (v0.5.0)
// ============================================================================

/**
 * Types of undo/redo events that can occur in the system
 */
export const UndoEventTypeSchema = z.enum([
  'undo:requested',    // User or system requested an undo operation
  'undo:started',      // Undo operation has begun executing
  'undo:completed',    // Undo operation completed successfully
  'undo:failed',       // Undo operation failed
  'redo:requested',    // User or system requested a redo operation
  'redo:started',      // Redo operation has begun executing
  'redo:completed',    // Redo operation completed successfully
  'redo:failed',       // Redo operation failed
]);
export type UndoEventType = z.infer<typeof UndoEventTypeSchema>;

/**
 * Event record for undo/redo operations
 * Tracks the lifecycle of undo operations for auditing and debugging
 */
export const UndoEventSchema = z.object({
  /** Unique identifier for this undo event */
  id: z.string().min(1),
  /** Type of undo event */
  type: UndoEventTypeSchema,
  /** ID of the task this undo event belongs to */
  taskId: z.string().min(1),
  /** ID of the tool action being undone or redone */
  actionId: z.string().min(1),
  /** ID of the tool action snapshot used for the operation (if applicable) */
  snapshotId: z.string().optional(),
  /** Timestamp when this event occurred */
  timestamp: z.date(),
  /** Absolute paths of files affected by the undo/redo operation */
  affectedFiles: z.array(z.string()).default([]),
  /** Error message if the operation failed */
  error: z.string().optional(),
  /** Additional metadata about the operation */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UndoEvent = z.infer<typeof UndoEventSchema>;

/**
 * Result of an undo or redo operation
 * Contains details about which files were restored and any failures
 */
export const UndoOperationResultSchema = z.object({
  /** Whether the overall undo operation succeeded */
  success: z.boolean(),
  /** ID of the tool action that was undone */
  actionId: z.string().min(1),
  /** Absolute paths of files that were successfully restored */
  restoredFiles: z.array(z.string()).default([]),
  /** Files that failed to restore with error details */
  failedFiles: z.array(z.object({
    /** Absolute path to the file that failed to restore */
    path: z.string(),
    /** Error message describing why the restore failed */
    error: z.string(),
  })).default([]),
  /** Timestamp when the undo operation completed */
  completedAt: z.date(),
  /** Error message if the overall operation failed */
  error: z.string().optional(),
});
export type UndoOperationResult = z.infer<typeof UndoOperationResultSchema>;

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
 * - deployment: Requires approval for deployment operations
 * - custom: User-defined checkpoint with custom trigger condition
 */
export const ApprovalCheckpointTypeSchema = z.enum([
  'before-commit',
  'before-deploy',
  'before-destructive',
  'before-network',
  'before-file-write',
  'deployment',
  'custom',
]);
export type ApprovalCheckpointType = z.infer<typeof ApprovalCheckpointTypeSchema>;

/**
 * Configuration for an approval gate (checkpoint)
 * Defines when and how approval is required during task execution
 */
export const ApprovalGateSchema = z.object({
  /** Unique identifier for this gate */
  id: z.string().optional(),
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
  /** Whether to auto-approve always (shortcut for simple gates) */
  autoApprove: z.boolean().default(false),
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
 * Behavior to take when an approval is rejected/denied
 * - 'skip': Skip the current action and continue to the next one
 * - 'abort': Terminate the entire task with 'rejected' status
 */
export const RejectionBehaviorSchema = z.enum([
  'skip',
  'abort',
]);
export type RejectionBehavior = z.infer<typeof RejectionBehaviorSchema>;

/**
 * Per-agent autonomy override settings
 * Allows configuring autonomy behavior for specific agents with more granular control
 * than just the autonomy level. Useful for giving different agents different
 * approval requirements, timeouts, and rejection behaviors.
 */
export const AgentAutonomyOverrideSchema = z.object({
  /** Autonomy level for this agent (overrides the global level) */
  level: AutonomyLevelSchema.optional(),
  /** Approval timeout in minutes for this agent (overrides global approvalTimeout) */
  approvalTimeout: z.number().min(1).optional(),
  /** Rejection behavior for this agent (overrides global rejectionBehavior) */
  rejectionBehavior: RejectionBehaviorSchema.optional(),
  /** Approval gates specific to this agent (merged with global gates) */
  gates: z.array(ApprovalGateSchema).optional(),
});
export type AgentAutonomyOverride = z.infer<typeof AgentAutonomyOverrideSchema>;

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
  /**
   * Per-agent autonomy overrides
   * Can be either a simple autonomy level string or a full AgentAutonomyOverrideSchema
   * for more granular control. Examples:
   *   agentOverrides: { developer: 'supervised' }  // Simple level override
   *   agentOverrides: { developer: { level: 'supervised', approvalTimeout: 30 } }  // Full override
   */
  agentOverrides: z.record(
    z.string(),
    z.union([AutonomyLevelSchema, AgentAutonomyOverrideSchema])
  ).optional(),
  /** Behavior to take when an approval is rejected/denied */
  rejectionBehavior: RejectionBehaviorSchema.default('abort'),
  /**
   * Global approval timeout in minutes
   * Default timeout for approval requests across all gates and agents.
   * Individual gates and agent overrides can specify their own timeouts.
   * If undefined, no global timeout is enforced (individual gate timeouts still apply).
   */
  approvalTimeout: z.number().min(1).optional(),
});
export type AutonomyConfig = z.infer<typeof AutonomyConfigSchema>;

// ============================================================================
// Workflow Definitions
// ============================================================================

export const WorkflowGateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  trigger: z.string(),
  required: z.boolean().default(true),
  autoApprove: z.boolean().default(false),
  approvers: z.array(z.string()).optional(),
  timeout: z.number().optional(), // Minutes
  tags: z.array(z.string()).optional(),
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
  /** Approval gates for this workflow (optional) */
  gates: z.array(WorkflowGateSchema).optional(),
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
  typecheckCommand: z.string().optional().default('npm run typecheck'),
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
  maxExecutionTime: z.number().optional().default(0),
  maxFileChanges: z.number().optional().default(0),
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
  diffPreview: z.boolean().optional().default(true),
});
export type UIConfig = z.infer<typeof UIConfigSchema>;

// ============================================================================
// Linter Configuration
// ============================================================================

/**
 * ESLint-specific configuration options
 */
export const ESLintConfigSchema = z.object({
  /** Enable ESLint linting */
  enabled: z.boolean().optional().default(true),
  /** Path to ESLint configuration file (relative to project root) */
  configPath: z.string().optional(),
  /** Array of file patterns to lint */
  include: z.array(z.string()).optional().default([
    'src/**/*.js',
    'src/**/*.jsx',
    'src/**/*.ts',
    'src/**/*.tsx',
    'lib/**/*.js',
    'lib/**/*.jsx',
    'lib/**/*.ts',
    'lib/**/*.tsx',
    '*.js',
    '*.jsx',
    '*.ts',
    '*.tsx'
  ]),
  /** Array of file patterns to exclude from linting */
  exclude: z.array(z.string()).optional().default([
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '*.d.ts'
  ]),
  /** Enable auto-fix for fixable issues */
  autoFix: z.boolean().optional().default(false),
  /** Maximum number of warnings allowed before failing */
  maxWarnings: z.number().optional().default(0),
  /** Custom ESLint CLI options */
  cliOptions: z.array(z.string()).optional().default([]),
  /** Environment settings for ESLint */
  environments: z.array(z.enum([
    'browser',
    'node',
    'es6',
    'es2017',
    'es2018',
    'es2020',
    'es2021',
    'es2022',
    'worker',
    'serviceworker'
  ])).optional().default(['node', 'es2022']),
  /** Parser options for ESLint */
  parserOptions: z.object({
    ecmaVersion: z.union([
      z.number(),
      z.enum(['latest'])
    ]).optional().default('latest'),
    sourceType: z.enum(['script', 'module']).optional().default('module'),
    ecmaFeatures: z.object({
      jsx: z.boolean().optional().default(false),
      globalReturn: z.boolean().optional().default(false),
      impliedStrict: z.boolean().optional().default(false)
    }).optional()
  }).optional(),
  /** Severity level for linting violations */
  severity: z.enum(['error', 'warn', 'off']).optional().default('warn'),
});
export type ESLintConfig = z.infer<typeof ESLintConfigSchema>;

/**
 * Prettier-specific configuration options
 */
export const PrettierConfigSchema = z.object({
  /** Enable Prettier formatting */
  enabled: z.boolean().optional().default(true),
  /** Path to Prettier configuration file (relative to project root) */
  configPath: z.string().optional(),
  /** Array of file patterns to format */
  include: z.array(z.string()).optional().default([
    'src/**/*.js',
    'src/**/*.jsx',
    'src/**/*.ts',
    'src/**/*.tsx',
    'src/**/*.json',
    'src/**/*.md',
    'src/**/*.css',
    'src/**/*.scss',
    'src/**/*.less',
    'src/**/*.html',
    'lib/**/*.js',
    'lib/**/*.jsx',
    'lib/**/*.ts',
    'lib/**/*.tsx',
    '*.js',
    '*.jsx',
    '*.ts',
    '*.tsx',
    '*.json',
    '*.md'
  ]),
  /** Array of file patterns to exclude from formatting */
  exclude: z.array(z.string()).optional().default([
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml'
  ]),
  /** Enable auto-fix for formatting issues */
  autoFix: z.boolean().optional().default(false),
  /** Prettier formatting options */
  options: z.object({
    /** Print width for line wrapping */
    printWidth: z.number().optional().default(80),
    /** Number of spaces per indentation level */
    tabWidth: z.number().optional().default(2),
    /** Use tabs instead of spaces */
    useTabs: z.boolean().optional().default(false),
    /** Add semicolons at the ends of statements */
    semi: z.boolean().optional().default(true),
    /** Use single quotes instead of double quotes */
    singleQuote: z.boolean().optional().default(true),
    /** Quote style for object properties */
    quoteProps: z.enum(['as-needed', 'consistent', 'preserve']).optional().default('as-needed'),
    /** Use single quotes in JSX */
    jsxSingleQuote: z.boolean().optional().default(true),
    /** Trailing commas */
    trailingComma: z.enum(['all', 'es5', 'none']).optional().default('es5'),
    /** Spaces between brackets in object literals */
    bracketSpacing: z.boolean().optional().default(true),
    /** Put > on the last line instead of at a new line */
    bracketSameLine: z.boolean().optional().default(false),
    /** Arrow function parentheses */
    arrowParens: z.enum(['always', 'avoid']).optional().default('avoid'),
    /** Line ending style */
    endOfLine: z.enum(['lf', 'crlf', 'cr', 'auto']).optional().default('lf'),
    /** Embedded language formatting */
    embeddedLanguageFormatting: z.enum(['auto', 'off']).optional().default('auto')
  }).optional(),
  /** Severity level for formatting violations */
  severity: z.enum(['error', 'warn', 'off']).optional().default('warn'),
});
export type PrettierConfig = z.infer<typeof PrettierConfigSchema>;

/**
 * Custom linter configuration for non-standard tools
 */
export const CustomLinterConfigSchema = z.object({
  /** Unique name for the custom linter */
  name: z.string(),
  /** Enable this custom linter */
  enabled: z.boolean().optional().default(true),
  /** Command to run the linter */
  command: z.string(),
  /** Command-line arguments for the linter */
  args: z.array(z.string()).optional().default([]),
  /** Array of file patterns to lint */
  include: z.array(z.string()).optional().default(['**/*']),
  /** Array of file patterns to exclude from linting */
  exclude: z.array(z.string()).optional().default(['node_modules/**']),
  /** Enable auto-fix for this linter (if supported) */
  autoFix: z.boolean().optional().default(false),
  /** Working directory for the linter command */
  workingDirectory: z.string().optional(),
  /** Environment variables for the linter */
  environment: z.record(z.string()).optional(),
  /** Expected exit codes for success */
  successExitCodes: z.array(z.number()).optional().default([0]),
  /** Timeout for linter execution in milliseconds */
  timeoutMs: z.number().optional().default(30000),
  /** Severity level for linter violations */
  severity: z.enum(['error', 'warn', 'off']).optional().default('warn'),
  /** Description of what this linter does */
  description: z.string().optional(),
});
export type CustomLinterConfig = z.infer<typeof CustomLinterConfigSchema>;

/**
 * Global linter configuration options
 */
export const LinterGlobalConfigSchema = z.object({
  /** Enable linting globally */
  enabled: z.boolean().optional().default(true),
  /** Run linters before commits */
  runOnCommit: z.boolean().optional().default(true),
  /** Run linters before pushes */
  runOnPush: z.boolean().optional().default(false),
  /** Run linters on file save (if supported by IDE) */
  runOnSave: z.boolean().optional().default(false),
  /** Run linters after tool-driven edits */
  runAfterEdit: z.boolean().optional().default(true),
  /** Enable parallel execution of linters */
  parallel: z.boolean().optional().default(true),
  /** Maximum number of linters to run concurrently */
  maxConcurrency: z.number().optional().default(4),
  /** Fail fast on first linter error */
  failFast: z.boolean().optional().default(false),
  /** Cache linter results to improve performance */
  cache: z.boolean().optional().default(true),
  /** Cache directory (relative to project root) */
  cacheDirectory: z.string().optional().default('.apex/cache/linters'),
  /** Default working directory for all linters */
  workingDirectory: z.string().optional(),
  /** Global timeout for all linters in milliseconds */
  timeoutMs: z.number().optional().default(60000),
});
export type LinterGlobalConfig = z.infer<typeof LinterGlobalConfigSchema>;

/**
 * Complete linter configuration schema supporting ESLint, Prettier, and custom linters
 */
export const LinterConfigSchema = z.object({
  /** Global linter settings */
  global: LinterGlobalConfigSchema.optional(),
  /** ESLint configuration */
  eslint: ESLintConfigSchema.optional(),
  /** Prettier configuration */
  prettier: PrettierConfigSchema.optional(),
  /** Custom linter configurations */
  custom: z.array(CustomLinterConfigSchema).optional().default([]),
  /** Linter execution order (names of linters) */
  order: z.array(z.string()).optional().default(['eslint', 'prettier']),
  /** Integration settings */
  integrations: z.object({
    /** Pre-commit hook integration */
    preCommit: z.object({
      enabled: z.boolean().optional().default(true),
      linters: z.array(z.string()).optional().default(['eslint', 'prettier']),
      autoFix: z.boolean().optional().default(true),
      failOnError: z.boolean().optional().default(true),
    }).optional(),
    /** CI/CD integration */
    ci: z.object({
      enabled: z.boolean().optional().default(true),
      linters: z.array(z.string()).optional().default(['eslint', 'prettier']),
      autoFix: z.boolean().optional().default(false),
      failOnError: z.boolean().optional().default(true),
      uploadReports: z.boolean().optional().default(false),
      reportFormat: z.enum(['json', 'xml', 'sarif']).optional().default('json'),
    }).optional(),
    /** IDE integration */
    ide: z.object({
      enabled: z.boolean().optional().default(true),
      autoFixOnSave: z.boolean().optional().default(false),
      showInlineErrors: z.boolean().optional().default(true),
      formatOnSave: z.boolean().optional().default(false),
    }).optional(),
  }).optional(),
});
export type LinterConfig = z.infer<typeof LinterConfigSchema>;

// ============================================================================
// Code Quality Configuration (v0.5.0)
// ============================================================================

export const PreEditValidationModeSchema = z.enum(['warn', 'block']);
export type PreEditValidationMode = z.infer<typeof PreEditValidationModeSchema>;

export const PreEditValidationConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  mode: PreEditValidationModeSchema.optional().default('warn'),
});
export type PreEditValidationConfig = z.infer<typeof PreEditValidationConfigSchema>;

export const TypecheckConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  runAfterEdit: z.boolean().optional().default(false),
  command: z.string().optional(),
  timeoutMs: z.number().optional().default(60000),
  failOnError: z.boolean().optional().default(false),
});
export type TypecheckConfig = z.infer<typeof TypecheckConfigSchema>;

/**
 * Auto-fix configuration for stage completion hooks
 */
export const AutoFixStageConfigSchema = z.object({
  /** Enable auto-fix after code generation stages */
  enabled: z.boolean().optional().default(true),
  /** Stage names that should trigger auto-fix (in addition to agent-based detection) */
  triggerStages: z.array(z.string()).optional().default(['implementation', 'testing', 'development', 'coding']),
  /** Agent names that should trigger auto-fix */
  triggerAgents: z.array(z.string()).optional().default(['developer', 'tester']),
  /** File extensions to process (others will be skipped) */
  fileExtensions: z.array(z.string()).optional().default(['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.go', '.rs']),
  /** Maximum number of files to process in one stage */
  maxFilesPerStage: z.number().optional().default(50),
  /** Skip auto-fix if stage failed */
  skipOnStageFailure: z.boolean().optional().default(true),
});
export type AutoFixStageConfig = z.infer<typeof AutoFixStageConfigSchema>;

export const CodeQualityConfigSchema = z.object({
  preEditValidation: PreEditValidationConfigSchema.optional(),
  typecheck: TypecheckConfigSchema.optional(),
  /** Auto-fix configuration for stage completion (v0.5.0) */
  autoFix: AutoFixStageConfigSchema.optional(),
});
export type CodeQualityConfig = z.infer<typeof CodeQualityConfigSchema>;

// ============================================================================
// Secret Scanner Configuration
// ============================================================================

/**
 * Secret pattern definition for the scanner
 */
export const SecretPatternSchema = z.object({
  /** Human-readable name for the pattern */
  name: z.string(),
  /** Regular expression pattern to match */
  pattern: z.string(),
  /** Severity level of the finding */
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional().default('medium'),
  /** Description of what this pattern detects */
  description: z.string().optional(),
});
export type SecretPattern = z.infer<typeof SecretPatternSchema>;

/**
 * Behavior when secrets are detected in tool outputs.
 *
 * @remarks
 * Available behaviors:
 * - `'log'` - Log the finding without any user-visible warning
 * - `'warn'` - Display a warning to the user (default behavior)
 * - `'mask'` - Replace the detected secret with asterisks in output
 * - `'block'` - Block the operation and prevent output containing secrets
 *
 * @example
 * ```yaml
 * scanner:
 *   onSecretDetected: warn  # Default - shows warning but continues
 * ```
 */
export const SecretDetectionBehaviorSchema = z.enum(['log', 'warn', 'mask', 'block']);
export type SecretDetectionBehavior = z.infer<typeof SecretDetectionBehaviorSchema>;

/**
 * Configuration options for the SecretScanner.
 *
 * The SecretScanner detects sensitive information like API keys, passwords,
 * tokens, and other secrets in tool outputs. It can be configured to warn,
 * mask, or block operations when secrets are detected.
 *
 * @remarks
 * The scanner includes built-in patterns for common secret formats:
 * - AWS access keys and secret keys
 * - GitHub tokens
 * - Generic API keys
 * - Private keys (RSA, DSA, EC)
 * - Connection strings
 *
 * @example
 * ```yaml
 * # .apex/config.yaml
 * scanner:
 *   onSecretDetected: warn        # 'log' | 'warn' | 'mask' | 'block'
 *   maskSecrets: true             # Mask secrets in output
 *   includeBuiltInPatterns: true  # Use built-in detection patterns
 *   customPatterns:
 *     - name: "Internal API Key"
 *       pattern: "INTERNAL_[A-Z0-9]{32}"
 *       severity: high
 * ```
 */
export const SecretScannerConfigSchema = z.object({
  /**
   * Custom patterns to scan for in addition to built-in patterns.
   * Each pattern should have a name, regex pattern, and optional severity.
   */
  customPatterns: z.array(SecretPatternSchema).optional().default([]),
  /**
   * Whether to include built-in patterns for common secrets (default: true).
   * Set to false to only use custom patterns.
   */
  includeBuiltInPatterns: z.boolean().optional().default(true),
  /**
   * Maximum line length to scan (default: 10000).
   * Lines longer than this are truncated to prevent performance issues.
   */
  maxLineLength: z.number().optional().default(10000),
  /**
   * Whether to mask sensitive content in findings (default: true).
   * When true, detected secrets are replaced with asterisks in logs.
   */
  maskSecrets: z.boolean().optional().default(true),
  /**
   * Number of characters to show before/after match for context (default: 20).
   * Helps identify the location of secrets without revealing full content.
   */
  contextLength: z.number().optional().default(20),
  /**
   * Behavior when secrets are detected in tool outputs (default: 'warn').
   * - 'log': Silent logging only
   * - 'warn': Display warning to user (recommended default)
   * - 'mask': Replace secrets with asterisks in output
   * - 'block': Prevent operation from completing
   */
  onSecretDetected: SecretDetectionBehaviorSchema.optional().default('warn'),
});
export type SecretScannerConfig = z.infer<typeof SecretScannerConfigSchema>;

/**
 * Enforcement mode for secret scanning.
 *
 * @remarks
 * Available modes:
 * - `'warn'` - Log warnings when secrets are detected but allow operations to proceed
 * - `'block'` - Block operations when secrets are detected
 * - `'audit'` - Log detections for auditing purposes without blocking or warning
 *
 * @example
 * ```yaml
 * secretScanning:
 *   enforcementMode: warn  # Default - warns but doesn't block
 * ```
 */
export const SecretScanningEnforcementModeSchema = z.enum(['warn', 'block', 'audit']);
export type SecretScanningEnforcementMode = z.infer<typeof SecretScanningEnforcementModeSchema>;

/**
 * Configuration for secret scanning in APEX.
 *
 * This configuration block provides a simplified interface for configuring
 * secret detection with enforcement mode control. It is designed to be
 * easy to configure in `.apex/config.yaml`.
 *
 * @remarks
 * The `secretScanning` config provides:
 * - An `enabled` flag to turn secret scanning on/off
 * - An `enforcementMode` to control behavior when secrets are detected
 * - A `customPatterns` array for defining project-specific secret patterns
 *
 * This is separate from the legacy `scanner` config and the comprehensive
 * `guardrails.secrets` config, providing a streamlined option for projects
 * that only need secret detection.
 *
 * @example
 * ```yaml
 * # .apex/config.yaml
 * secretScanning:
 *   enabled: true
 *   enforcementMode: warn    # 'warn' | 'block' | 'audit'
 *   customPatterns:
 *     - name: "Internal API Key"
 *       pattern: "INTERNAL_[A-Z0-9]{32}"
 *       severity: high
 *     - name: "Database Password"
 *       pattern: "DB_PASSWORD=[^\\s]+"
 *       severity: critical
 * ```
 */
export const SecretScanningConfigSchema = z.object({
  /**
   * Whether secret scanning is enabled (default: true).
   * When disabled, no secret detection will be performed.
   */
  enabled: z.boolean().optional().default(true),

  /**
   * Enforcement mode for secret scanning (default: 'warn').
   * - 'warn': Log warnings when secrets are detected
   * - 'block': Block operations when secrets are detected
   * - 'audit': Log detections for auditing without blocking
   */
  enforcementMode: SecretScanningEnforcementModeSchema.optional().default('warn'),

  /**
   * Custom patterns to scan for in addition to built-in patterns.
   * Each pattern should have a name, regex pattern, and optional severity.
   *
   * @example
   * ```yaml
   * customPatterns:
   *   - name: "Internal Token"
   *     pattern: "INT_TOKEN_[A-Z0-9]{24}"
   *     severity: high
   *     description: "Internal service token"
   * ```
   */
  customPatterns: z.array(SecretPatternSchema).optional().default([]),

  /**
   * Whether to include built-in patterns for common secrets (default: true).
   * Built-in patterns detect AWS keys, GitHub tokens, API keys, etc.
   * Set to false to only use custom patterns.
   */
  includeBuiltInPatterns: z.boolean().optional().default(true),

  /**
   * Paths to exclude from secret scanning.
   * Glob patterns are supported.
   *
   * @example
   * ```yaml
   * excludePaths:
   *   - "*.test.ts"
   *   - "fixtures/**"
   *   - "__mocks__/**"
   * ```
   */
  excludePaths: z.array(z.string()).optional().default([]),
});
export type SecretScanningConfig = z.infer<typeof SecretScanningConfigSchema>;

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
// Logging Configuration (v0.6.0)
// ============================================================================

/**
 * Log level schema
 */
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
export type LogLevelType = z.infer<typeof LogLevelSchema>;

/**
 * Log rotation configuration for file-based logging
 */
export const LogRotationConfigSchema = z.object({
  /** Maximum file size before rotation (e.g., '10M', '100K', '1G') */
  maxSize: z.string().regex(/^\d+[KMG]?$/i).optional().default('10M'),
  /** Number of rotated files to keep */
  maxFiles: z.number().int().min(1).max(100).optional().default(5),
  /** Compress rotated files with gzip */
  compress: z.boolean().optional().default(false),
});
export type LogRotationConfig = z.infer<typeof LogRotationConfigSchema>;

/**
 * Logging configuration for APEX
 *
 * Controls logging behavior across all packages including:
 * - Log levels (global and per-package)
 * - Output format (JSON vs pretty-printed)
 * - File logging with rotation
 * - Sensitive field redaction
 *
 * @example
 * ```yaml
 * logging:
 *   level: info
 *   format: auto
 *   packageLevels:
 *     orchestrator: debug
 *   file:
 *     enabled: true
 *     path: .apex/apex.log
 *     rotation:
 *       maxSize: 10M
 *       maxFiles: 5
 * ```
 */
export const LoggingConfigSchema = z.object({
  /** Default log level for all packages */
  level: LogLevelSchema.optional().default('info'),

  /** Output format: 'json' for production, 'pretty' for development, 'auto' to detect */
  format: z.enum(['json', 'pretty', 'auto']).optional().default('auto'),

  /** Per-package log level overrides (e.g., { orchestrator: 'debug', api: 'warn' }) */
  packageLevels: z.record(z.string(), LogLevelSchema).optional().default({}),

  /** File logging configuration */
  file: z.object({
    /** Enable file logging */
    enabled: z.boolean().optional().default(false),
    /** Log file path (relative to project root) */
    path: z.string().optional().default('.apex/apex.log'),
    /** Rotation configuration */
    rotation: LogRotationConfigSchema.optional(),
  }).optional(),

  /** Daemon-specific logging configuration */
  daemon: z.object({
    /** Daemon log file path */
    path: z.string().optional().default('.apex/daemon.log'),
    /** Rotation configuration for daemon logs */
    rotation: LogRotationConfigSchema.optional(),
  }).optional(),

  /** Include timestamps in console output */
  timestamps: z.boolean().optional().default(true),

  /** Include stack traces for errors */
  stackTraces: z.boolean().optional().default(true),

  /** Fields to redact from logs (prevents leaking secrets) */
  redactFields: z.array(z.string()).optional().default([
    'password',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'ANTHROPIC_API_KEY',
  ]),
});
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

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

// ============================================================================
// MCP Configuration (v0.5.0)
// ============================================================================

/**
 * MCP Connection Configuration Schema (v0.5.0)
 * Configuration for MCP connection management including retry policies,
 * timeouts, connection pooling, and health check settings.
 *
 * Can be specified at the global level (mcp.connection) to apply to all servers,
 * or per-server (mcp.servers.<name>.connection) to override for specific servers.
 */
export const MCPConnectionConfigSchema = z.object({
  /**
   * Maximum number of retry attempts when a connection fails
   * Set to 0 for no retries
   * @default 3
   */
  maxRetries: z.number().int().min(0).optional().default(3),

  /**
   * Initial delay between retry attempts in milliseconds
   * Subsequent retries may use exponential backoff based on backoffFactor
   * @default 1000
   */
  retryDelayMs: z.number().int().min(0).optional().default(1000),

  /**
   * Backoff factor for exponential retry delay
   * Each retry delay = retryDelayMs * (backoffFactor ^ attemptNumber)
   * @default 2
   */
  backoffFactor: z.number().min(1).optional().default(2),

  /**
   * Maximum retry delay in milliseconds (caps exponential backoff)
   * @default 30000
   */
  maxRetryDelayMs: z.number().int().min(0).optional().default(30000),

  /**
   * Connection timeout in milliseconds
   * How long to wait for initial connection before timing out
   * @default 10000
   */
  connectionTimeoutMs: z.number().int().min(0).optional().default(10000),

  /**
   * Request timeout in milliseconds
   * How long to wait for a response to an individual request
   * @default 30000
   */
  requestTimeoutMs: z.number().int().min(0).optional().default(30000),

  /**
   * Idle timeout in milliseconds
   * How long a connection can be idle before being closed
   * Set to 0 for no idle timeout
   * @default 300000 (5 minutes)
   */
  idleTimeoutMs: z.number().int().min(0).optional().default(300000),

  /**
   * Maximum number of concurrent connections to a single MCP server
   * Used for connection pooling
   * @default 1
   */
  poolSize: z.number().int().min(1).max(100).optional().default(1),

  /**
   * Minimum number of connections to keep in the pool
   * These connections are kept alive even when idle
   * @default 0
   */
  poolMinSize: z.number().int().min(0).optional().default(0),

  /**
   * Health check interval in milliseconds
   * How often to check if the connection is still alive
   * Set to 0 to disable health checks
   * @default 30000
   */
  healthCheckIntervalMs: z.number().int().min(0).optional().default(30000),

  /**
   * Health check timeout in milliseconds
   * How long to wait for health check response before considering unhealthy
   * @default 5000
   */
  healthCheckTimeoutMs: z.number().int().min(0).optional().default(5000),

  /**
   * Number of consecutive health check failures before marking connection unhealthy
   * @default 3
   */
  healthCheckFailureThreshold: z.number().int().min(1).optional().default(3),

  /**
   * Whether to automatically reconnect when a connection is lost
   * @default true
   */
  autoReconnect: z.boolean().optional().default(true),

  /**
   * Whether to enable keep-alive for the connection
   * @default true
   */
  keepAlive: z.boolean().optional().default(true),

  /**
   * Keep-alive interval in milliseconds
   * How often to send keep-alive messages
   * @default 15000
   */
  keepAliveIntervalMs: z.number().int().min(0).optional().default(15000),

  /**
   * Whether to enable heartbeat/ping-pong for health monitoring
   * When enabled, uses ping/pong instead of listTools() for health checks
   * @default true
   */
  heartbeatEnabled: z.boolean().optional().default(true),

  /**
   * Heartbeat ping interval in milliseconds
   * How often to send ping messages for heartbeat health checks
   * Only used when heartbeatEnabled is true
   * @default 30000
   */
  heartbeatIntervalMs: z.number().int().min(0).optional().default(30000),
});
export type MCPConnectionConfig = z.infer<typeof MCPConnectionConfigSchema>;

/**
 * MCP Environment Variable Schema (v0.5.0)
 * Defines structured metadata for environment variables used by MCP servers.
 * Provides richer configuration than simple key-value pairs, including
 * descriptions, sensitivity flags, and required/optional status.
 *
 * @example
 * ```yaml
 * envVars:
 *   - name: OPENAI_API_KEY
 *     description: OpenAI API key for model access
 *     required: true
 *     sensitive: true
 *   - name: LOG_LEVEL
 *     description: Logging verbosity level
 *     required: false
 *     defaultValue: info
 * ```
 */
export const MCPEnvironmentVarSchema = z.object({
  /** Name of the environment variable (e.g., 'OPENAI_API_KEY') */
  name: z.string().min(1, 'Environment variable name is required'),
  /** Human-readable description of the variable's purpose */
  description: z.string().optional(),
  /** Whether the variable is required for the server to function */
  required: z.boolean().optional().default(false),
  /** Whether the variable contains sensitive data (API keys, passwords, tokens) */
  sensitive: z.boolean().optional().default(false),
  /** Default value if not provided (ignored for required variables) */
  defaultValue: z.string().optional(),
  /** Current value of the environment variable (may be masked if sensitive) */
  value: z.string().optional(),
  /** Validation pattern for the variable value (regex string) */
  pattern: z.string().optional(),
  /** Source of the variable value: 'config', 'env', 'user', 'default' */
  source: z.enum(['config', 'env', 'user', 'default']).optional(),
});
export type MCPEnvironmentVar = z.infer<typeof MCPEnvironmentVarSchema>;

/**
 * MCP Server configuration schema
 * Defines how to connect to and configure an individual MCP server
 */
export const MCPServerConfigSchema = z.object({
  /** Display name for the server */
  name: z.string().min(1),
  /** Connection type: stdio (subprocess), http, sse (server-sent events), or sdk (direct) */
  type: z.enum(['stdio', 'http', 'sse', 'sdk']).optional().default('stdio'),
  /** Command to execute for stdio connections */
  command: z.string().optional(),
  /** Arguments to pass to the command */
  args: z.array(z.string()).optional(),
  /** Environment variables for the server process (simple key-value pairs) */
  env: z.record(z.string()).optional(),
  /** Structured environment variable definitions with metadata */
  envVars: z.array(MCPEnvironmentVarSchema).optional(),
  /** URL for http/sse connections */
  url: z.string().optional(),
  /** HTTP headers for http/sse connections */
  headers: z.record(z.string()).optional(),
  /** Whether to start this server automatically when MCP is initialized */
  autoStart: z.boolean().optional().default(false),
  /** List of capabilities this server provides */
  capabilities: z.array(z.string()).optional(),
  /** Per-server connection configuration (overrides global mcp.connection) */
  connection: MCPConnectionConfigSchema.optional(),
});
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

/**
 * MCP Marketplace entry schema
 * Represents a server available for installation from a marketplace
 */
export const MCPMarketplaceEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  author: z.string().optional(),
  homepage: z.string().optional(),
  repository: z.string().optional(),
  installCommand: z.string().optional(),
  serverConfig: MCPServerConfigSchema,
  capabilities: z.array(z.string()).optional(),
  verified: z.boolean().optional().default(false),
});
export type MCPMarketplaceEntry = z.infer<typeof MCPMarketplaceEntrySchema>;

/**
 * MCP Marketplace source configuration
 * Configures where to discover available MCP servers
 */
export const MCPMarketplaceSourceSchema = z.object({
  url: z.string().min(1),
  enabled: z.boolean().optional().default(true),
  refreshIntervalMinutes: z.number().min(1).optional().default(1440),
  allowUnverified: z.boolean().optional().default(false),
});
export type MCPMarketplaceSource = z.infer<typeof MCPMarketplaceSourceSchema>;

export const MCPConfigSchema = z.object({
  /** Whether MCP is enabled globally */
  enabled: z.boolean().optional().default(true),
  /** MCP server configurations keyed by server identifier */
  servers: z.record(MCPServerConfigSchema).optional().default({}),
  /** Marketplace source configuration for discovering MCP servers */
  marketplace: MCPMarketplaceSourceSchema.optional(),
  /** Global connection configuration applied to all MCP servers unless overridden */
  connection: MCPConnectionConfigSchema.optional(),
});
export type MCPConfig = z.infer<typeof MCPConfigSchema>;

/**
 * MCP Server Template schema
 * Represents a reusable template for configuring MCP servers.
 * Templates provide pre-configured defaults for common MCP servers,
 * including environment variable requirements and capability declarations.
 *
 * Used by the MCPConfigurator service to provide quick setup options
 * for popular MCP servers from the ecosystem.
 *
 * @example
 * ```yaml
 * templates:
 *   - id: filesystem
 *     name: Filesystem Server
 *     description: Read and write files, list directories
 *     package: '@modelcontextprotocol/server-filesystem'
 *     config:
 *       type: stdio
 *       command: npx
 *       args: ['-y', '@modelcontextprotocol/server-filesystem']
 *     capabilities: ['filesystem', 'read', 'write']
 *     verified: true
 *     defaultEnabled: true
 * ```
 */
export const MCPTemplateSchema = z.object({
  /** Unique identifier for the template (e.g., 'filesystem', 'github', 'postgres') */
  id: z.string().min(1, 'Template ID is required'),
  /** Human-readable display name for the template */
  name: z.string().min(1, 'Template name is required'),
  /** Description of what the MCP server does */
  description: z.string().min(1, 'Template description is required'),
  /** NPM package name for the MCP server (e.g., '@modelcontextprotocol/server-filesystem') */
  package: z.string().min(1, 'Package name is required'),
  /** Base server configuration with pre-filled defaults */
  config: MCPServerConfigSchema.partial(),
  /** Environment variables required or used by this server template */
  envVars: z.array(MCPEnvironmentVarSchema).optional().default([]),
  /** Capabilities this server provides (e.g., ['filesystem', 'read', 'write']) */
  capabilities: z.array(z.string()).optional().default([]),
  /** Whether this template is from a verified/official source */
  verified: z.boolean().optional().default(false),
  /** Whether this server should be enabled by default when the template is applied */
  defaultEnabled: z.boolean().optional().default(false),
  /** Optional category for grouping templates (e.g., 'database', 'api', 'filesystem') */
  category: z.string().optional(),
  /** Optional tags for searchability */
  tags: z.array(z.string()).optional().default([]),
  /** Minimum required version of the MCP server package */
  minVersion: z.string().optional(),
  /** Documentation URL for the MCP server */
  documentationUrl: z.string().optional(),
  /** Repository URL for the MCP server source code */
  repositoryUrl: z.string().optional(),
});
export type MCPTemplate = z.infer<typeof MCPTemplateSchema>;

// Backwards compatibility alias for MCPServerTemplate
export const MCPServerTemplateSchema = MCPTemplateSchema;
export type MCPServerTemplate = MCPTemplate;

/**
 * MCP Server definition schema
 * Represents an MCP server available for installation from a registry/marketplace
 * Contains package information and default configuration
 */
export const MCPServerSchema = z.object({
  /** Unique name identifier for the MCP server */
  name: z.string().min(1, 'MCP server name is required'),
  /** NPM package name or installation source */
  package: z.string().min(1, 'Package name is required'),
  /** Command to execute the MCP server (e.g., 'npx', 'node', path to binary) */
  command: z.string().min(1, 'Command is required'),
  /** Arguments to pass to the command */
  args: z.array(z.string()).optional().default([]),
  /** Environment variables required by the server (simple key-value pairs) */
  env: z.record(z.string(), z.string()).optional().default({}),
  /** Structured environment variable definitions with metadata */
  envVars: z.array(MCPEnvironmentVarSchema).optional().default([]),
  /** Semantic version of the MCP server package */
  version: z.string().min(1, 'Version is required'),
});
export type MCPServer = z.infer<typeof MCPServerSchema>;

/**
 * Installation status for MCP servers
 */
export const MCPInstallationStatusSchema = z.enum([
  'pending',     // Installation has been requested but not started
  'installing',  // Currently being installed
  'installed',   // Successfully installed and ready
  'failed',      // Installation failed
  'uninstalling', // Currently being uninstalled
  'uninstalled', // Has been uninstalled
]);
export type MCPInstallationStatus = z.infer<typeof MCPInstallationStatusSchema>;

/**
 * MCP Installation schema
 * Represents an installed MCP server instance with tracking metadata
 */
export const MCPInstallationSchema = z.object({
  /** Unique identifier for this installation instance */
  id: z.string().min(1, 'Installation ID is required'),
  /** Reference to the MCPServer this installation is based on */
  serverId: z.string().min(1, 'Server ID is required'),
  /** Timestamp when the server was installed */
  installedAt: z.date(),
  /** Current installation status */
  status: MCPInstallationStatusSchema,
  /** Path to the installation's configuration file */
  configPath: z.string().min(1, 'Config path is required'),
});
export type MCPInstallation = z.infer<typeof MCPInstallationSchema>;

// ============================================================================
// MCP Connection Management Types (v0.5.0)
// ============================================================================

/**
 * Connection state for an MCP server
 */
export const MCPConnectionStateSchema = z.enum([
  'disconnected',  // Not connected
  'connecting',    // Connection in progress
  'connected',     // Connected and ready
  'reconnecting',  // Attempting reconnection
  'error',         // Error state
]);
export type MCPConnectionState = z.infer<typeof MCPConnectionStateSchema>;

/**
 * MCP Connection Info Schema
 * Represents runtime information about an active MCP connection,
 * including health status, performance metrics, and connection state.
 *
 * This is aliased as both MCPConnectionInfo and MCPConnection for backwards compatibility.
 */
export const MCPConnectionInfoSchema = z.object({
  /** Server identifier (config key name) */
  serverId: z.string().min(1),
  /** Server name from config */
  serverName: z.string().min(1),
  /** Server configuration */
  config: MCPServerConfigSchema,
  /** Current connection state */
  state: MCPConnectionStateSchema,
  /** When the connection was established */
  connectedAt: z.date().optional(),
  /** When the connection was last active */
  lastActivityAt: z.date().optional(),
  /** Number of reconnection attempts */
  reconnectAttempts: z.number().int().min(0).default(0),
  /** Last error if in error state */
  lastError: z.string().optional(),
  /** Health check status */
  health: z.object({
    /** Whether the connection is considered healthy */
    healthy: z.boolean().default(true),
    /** Timestamp of the last successful health check */
    lastCheckAt: z.date().optional(),
    /** Timestamp of the last successful health check */
    lastSuccessAt: z.date().optional(),
    /** Number of consecutive health check failures */
    consecutiveFailures: z.number().int().min(0).default(0),
    /** Last health check latency in milliseconds */
    latencyMs: z.number().int().min(0).optional(),
    /** Average latency over recent health checks */
    avgLatencyMs: z.number().min(0).optional(),
    /** Health check error message if unhealthy */
    errorMessage: z.string().optional(),
  }).optional(),
  /** Connection pool status (if pooling is enabled) */
  pool: z.object({
    /** Current number of active connections in the pool */
    activeConnections: z.number().int().min(0).default(0),
    /** Number of idle connections in the pool */
    idleConnections: z.number().int().min(0).default(0),
    /** Total number of connections created */
    totalConnections: z.number().int().min(0).default(0),
    /** Number of pending connection requests */
    pendingRequests: z.number().int().min(0).default(0),
  }).optional(),
  /** Connection metrics */
  metrics: z.object({
    /** Total number of requests made through this connection */
    totalRequests: z.number().int().min(0).default(0),
    /** Number of successful requests */
    successfulRequests: z.number().int().min(0).default(0),
    /** Number of failed requests */
    failedRequests: z.number().int().min(0).default(0),
    /** Total bytes sent */
    bytesSent: z.number().int().min(0).default(0),
    /** Total bytes received */
    bytesReceived: z.number().int().min(0).default(0),
    /** Connection uptime in milliseconds */
    uptimeMs: z.number().int().min(0).default(0),
  }).optional(),
});
export type MCPConnectionInfo = z.infer<typeof MCPConnectionInfoSchema>;

// Backwards compatibility aliases
export const MCPConnectionSchema = MCPConnectionInfoSchema;
export type MCPConnection = MCPConnectionInfo;

/**
 * Connection event types
 */
export const MCPConnectionEventTypeSchema = z.enum([
  'connected',
  'disconnected',
  'error',
  'reconnecting',
]);
export type MCPConnectionEventType = z.infer<typeof MCPConnectionEventTypeSchema>;

/**
 * Connection event data
 */
export const MCPConnectionEventSchema = z.object({
  type: MCPConnectionEventTypeSchema,
  serverId: z.string().min(1),
  serverName: z.string().min(1),
  previousState: MCPConnectionStateSchema,
  newState: MCPConnectionStateSchema,
  timestamp: z.date(),
  message: z.string().optional(),
  error: z.any().optional(), // Error objects can't be easily validated with Zod
});
export type MCPConnectionEvent = z.infer<typeof MCPConnectionEventSchema>;

// ============================================================================
// MCP Tool Types (v0.5.0)
// ============================================================================

/**
 * JSON Schema for MCP tool parameters
 * Follows the JSON Schema Draft 7 specification as used by MCP protocol.
 * Provides a complete schema definition for tool input validation.
 */
export const MCPToolSchemaSchema = z.object({
  /** JSON Schema type (typically 'object' for tool parameters) */
  type: z.literal('object').default('object'),

  /** Human-readable title for the schema */
  title: z.string().optional(),

  /** Description of what the parameters represent */
  description: z.string().optional(),

  /** Object properties defining each parameter */
  properties: z
    .record(
      z.string(),
      z.object({
        type: JSONSchemaTypeSchema,
        description: z.string().optional(),
        default: z.unknown().optional(),
        enum: z.array(z.unknown()).optional(),
        const: z.unknown().optional(),
        properties: z.record(z.string(), z.unknown()).optional(),
        items: z.unknown().optional(),
        minimum: z.number().optional(),
        maximum: z.number().optional(),
        minLength: z.number().optional(),
        maxLength: z.number().optional(),
        minItems: z.number().optional(),
        maxItems: z.number().optional(),
        pattern: z.string().optional(),
        format: z.string().optional(),
        oneOf: z.array(z.unknown()).optional(),
        anyOf: z.array(z.unknown()).optional(),
        allOf: z.array(z.unknown()).optional(),
      })
    )
    .optional()
    .default({}),

  /** Array of required property names */
  required: z.array(z.string()).optional().default([]),

  /** Whether additional properties are allowed */
  additionalProperties: z.boolean().optional().default(false),

  /** JSON Schema version identifier */
  $schema: z.string().optional(),
});
export type MCPToolSchema = z.infer<typeof MCPToolSchemaSchema>;

/**
 * Tool capability flags indicating what operations a tool supports
 */
export const MCPToolCapabilitiesSchema = z.object({
  /** Whether the tool supports streaming responses */
  streaming: z.boolean().optional().default(false),

  /** Whether the tool can be cancelled mid-execution */
  cancellable: z.boolean().optional().default(false),

  /** Whether the tool supports progress reporting */
  progressReporting: z.boolean().optional().default(false),

  /** Whether the tool is idempotent (safe to retry) */
  idempotent: z.boolean().optional().default(false),

  /** Whether the tool has side effects */
  hasSideEffects: z.boolean().optional().default(true),
});
export type MCPToolCapabilities = z.infer<typeof MCPToolCapabilitiesSchema>;

/**
 * MCP Tool definition schema
 * Represents a tool exposed by an MCP server with full metadata.
 * This is the canonical representation of tools discovered from MCP servers.
 */
export const MCPToolSchema = z.object({
  /** Unique tool name within the MCP server namespace */
  name: z.string().min(1, 'Tool name is required'),

  /** Human-readable description of what the tool does */
  description: z.string().optional(),

  /** JSON Schema for the tool's input parameters */
  inputSchema: MCPToolSchemaSchema,

  /** JSON Schema for the tool's output (optional, for documentation) */
  outputSchema: MCPToolSchemaSchema.optional(),

  /** ID of the MCP server providing this tool */
  serverId: z.string().min(1, 'Server ID is required'),

  /** Display name of the MCP server */
  serverName: z.string().optional(),

  /** Tool capabilities and features */
  capabilities: MCPToolCapabilitiesSchema.optional(),

  /** Whether the tool is currently available */
  available: z.boolean().default(true),

  /** Reason if the tool is unavailable */
  unavailableReason: z.string().optional(),

  /** Tool version (if provided by MCP server) */
  version: z.string().optional(),

  /** Tags for categorization and filtering */
  tags: z.array(z.string()).optional().default([]),

  /** Deprecation notice if tool is deprecated */
  deprecated: z.string().optional(),

  /** When this tool definition was last updated */
  updatedAt: z.date().optional(),
});
export type MCPTool = z.infer<typeof MCPToolSchema>;

/**
 * Source type for tools in the registry
 */
export const ToolSourceTypeSchema = z.enum([
  'builtin', // Built-in APEX tools (Read, Write, Bash, etc.)
  'custom', // User-defined custom tools from config
  'mcp', // Tools provided by MCP servers
  'plugin', // Tools from plugins (future)
]);
export type ToolSourceType = z.infer<typeof ToolSourceTypeSchema>;

/**
 * Tool source information tracking where a tool came from
 */
export const ToolSourceSchema = z.object({
  /** Type of tool source */
  type: ToolSourceTypeSchema,

  /** Source identifier (server ID for MCP, config path for custom) */
  sourceId: z.string().optional(),

  /** Human-readable source name */
  sourceName: z.string().optional(),

  /** When the tool was registered from this source */
  registeredAt: z.date(),

  /** Version of the tool from this source */
  version: z.string().optional(),
});
export type ToolSource = z.infer<typeof ToolSourceSchema>;

/**
 * Extended tool registry entry for MCP tools
 * Extends the base ToolRegistryEntry with MCP-specific metadata
 */
export const MCPToolRegistryEntrySchema = z.object({
  /** The MCP tool definition */
  tool: MCPToolSchema,

  /** Source information */
  source: ToolSourceSchema,

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

  /** Average execution time in milliseconds */
  avgExecutionTimeMs: z.number().min(0).optional(),

  /** Permission configuration for this tool */
  permissionConfig: ToolPermissionConfigSchema.optional(),
});
export type MCPToolRegistryEntry = z.infer<typeof MCPToolRegistryEntrySchema>;

/**
 * Unified tool registry entry that can represent any tool type
 * Provides a consistent interface for all tools regardless of source
 */
export const UnifiedToolRegistryEntrySchema = z.object({
  /** Unique identifier for the registry entry (tool name + source) */
  id: z.string().min(1),

  /** Tool name */
  name: z.string().min(1),

  /** Tool description */
  description: z.string().optional(),

  /** Source information */
  source: ToolSourceSchema,

  /** JSON Schema for input parameters */
  inputSchema: MCPToolSchemaSchema,

  /** Whether the tool is currently available */
  available: z.boolean().default(true),

  /** Reason if unavailable */
  unavailableReason: z.string().optional(),

  /** Tool capabilities */
  capabilities: MCPToolCapabilitiesSchema.optional(),

  /** Runtime statistics */
  stats: z
    .object({
      lastInvoked: z.date().optional(),
      invocationCount: z.number().min(0).default(0),
      successCount: z.number().min(0).default(0),
      failureCount: z.number().min(0).default(0),
      avgExecutionTimeMs: z.number().min(0).optional(),
      lastErrorMessage: z.string().optional(),
      lastErrorAt: z.date().optional(),
    })
    .optional(),

  /** Permission configuration */
  permissionConfig: ToolPermissionConfigSchema.optional(),

  /** Version */
  version: z.string().optional(),

  /** Tags */
  tags: z.array(z.string()).optional().default([]),

  /** Deprecation notice */
  deprecated: z.string().optional(),

  /** When the entry was last updated */
  updatedAt: z.date().optional(),
});
export type UnifiedToolRegistryEntry = z.infer<typeof UnifiedToolRegistryEntrySchema>;

/**
 * Tool registry state snapshot
 * Represents the complete state of all registered tools
 */
export const ToolRegistryStateSchema = z.object({
  /** All registered tools keyed by their unique ID */
  tools: z.record(z.string(), UnifiedToolRegistryEntrySchema),

  /** Tools grouped by source type */
  bySource: z.object({
    builtin: z.array(z.string()).default([]),
    custom: z.array(z.string()).default([]),
    mcp: z.array(z.string()).default([]),
    plugin: z.array(z.string()).default([]),
  }),

  /** Tools grouped by MCP server ID */
  byMCPServer: z.record(z.string(), z.array(z.string())).default({}),

  /** Last time the registry was updated */
  lastUpdated: z.date(),

  /** Total number of registered tools */
  totalCount: z.number().int().min(0),

  /** Number of available tools */
  availableCount: z.number().int().min(0),
});
export type ToolRegistryState = z.infer<typeof ToolRegistryStateSchema>;

/**
 * Tool discovery event types
 */
export const ToolDiscoveryEventTypeSchema = z.enum([
  'tool_registered', // New tool added to registry
  'tool_unregistered', // Tool removed from registry
  'tool_updated', // Tool metadata updated
  'tool_available', // Tool became available
  'tool_unavailable', // Tool became unavailable
  'server_tools_refreshed', // All tools from a server were refreshed
]);
export type ToolDiscoveryEventType = z.infer<typeof ToolDiscoveryEventTypeSchema>;

/**
 * Tool discovery event data
 */
export const ToolDiscoveryEventSchema = z.object({
  /** Event type */
  type: ToolDiscoveryEventTypeSchema,

  /** Tool ID affected */
  toolId: z.string().min(1),

  /** Tool name */
  toolName: z.string().min(1),

  /** Source of the tool */
  source: ToolSourceSchema,

  /** When the event occurred */
  timestamp: z.date(),

  /** Previous state (for updates) */
  previousState: UnifiedToolRegistryEntrySchema.optional(),

  /** New state (for registrations and updates) */
  newState: UnifiedToolRegistryEntrySchema.optional(),

  /** Additional event context */
  context: z.record(z.string(), z.unknown()).optional(),
});
export type ToolDiscoveryEvent = z.infer<typeof ToolDiscoveryEventSchema>;

/**
 * MCP tool invocation request
 */
export const MCPToolInvocationRequestSchema = z.object({
  /** Tool name to invoke */
  toolName: z.string().min(1),

  /** MCP server ID */
  serverId: z.string().min(1),

  /** Tool arguments */
  arguments: z.record(z.string(), z.unknown()).default({}),

  /** Request ID for correlation */
  requestId: z.string().optional(),

  /** Timeout in milliseconds */
  timeoutMs: z.number().int().min(0).optional(),

  /** Whether to stream the response */
  stream: z.boolean().optional().default(false),
});
export type MCPToolInvocationRequest = z.infer<typeof MCPToolInvocationRequestSchema>;

/**
 * MCP tool invocation result content types
 */
export const MCPToolResultContentTypeSchema = z.enum([
  'text', // Plain text content
  'image', // Base64 encoded image
  'resource', // Resource reference
  'error', // Error content
]);
export type MCPToolResultContentType = z.infer<typeof MCPToolResultContentTypeSchema>;

/**
 * MCP tool result content item
 */
export const MCPToolResultContentSchema = z.object({
  /** Content type */
  type: MCPToolResultContentTypeSchema,

  /** Text content (for text type) */
  text: z.string().optional(),

  /** Image data (base64) for image type */
  data: z.string().optional(),

  /** MIME type for image/resource */
  mimeType: z.string().optional(),

  /** Resource URI for resource type */
  uri: z.string().optional(),

  /** Error message for error type */
  error: z.string().optional(),
});
export type MCPToolResultContent = z.infer<typeof MCPToolResultContentSchema>;

/**
 * MCP tool invocation response
 */
export const MCPToolInvocationResponseSchema = z.object({
  /** Request ID for correlation */
  requestId: z.string().optional(),

  /** Whether the invocation was successful */
  success: z.boolean(),

  /** Result content array */
  content: z.array(MCPToolResultContentSchema).default([]),

  /** Whether this is a partial/streaming response */
  isPartial: z.boolean().optional().default(false),

  /** Error details if failed */
  error: z
    .object({
      code: z.string().optional(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),

  /** Execution metrics */
  metrics: z
    .object({
      startedAt: z.date(),
      completedAt: z.date().optional(),
      durationMs: z.number().int().min(0).optional(),
    })
    .optional(),
});
export type MCPToolInvocationResponse = z.infer<typeof MCPToolInvocationResponseSchema>;

// ============================================================================
// TDD Mode Configuration (v0.5.0)
// ============================================================================

export const TDDModeConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  testCommand: z.string().optional().default('npm test'),
  watchMode: z.boolean().optional().default(false),
  maxIterations: z.number().int().min(1).optional().default(5),
  regressionGuard: z.boolean().optional().default(true),
});
export type TDDModeConfig = z.infer<typeof TDDModeConfigSchema>;

// ============================================================================
// Visual Regression Configuration (v0.5.0)
// ============================================================================

/**
 * Configuration for visual regression testing with screenshot comparison
 *
 * This configuration controls how visual regression tests are executed,
 * including similarity thresholds, diff highlighting, and snapshot management.
 */
export const VisualRegressionConfigSchema = z.object({
  /** Enable visual regression testing (default: false) */
  enabled: z.boolean().optional().default(false),

  /**
   * Similarity threshold for comparison (0-1, where 1 is exact match).
   * A value of 0.99 means 99% of pixels must match for the comparison to pass.
   * Default: 0.99
   */
  threshold: z.number().min(0).max(1).optional().default(0.99),

  /**
   * Color for highlighting different pixels in diff image.
   * Format: [r, g, b] values 0-255.
   * Default: [255, 0, 255] (magenta)
   */
  diffColor: z.tuple([
    z.number().min(0).max(255),
    z.number().min(0).max(255),
    z.number().min(0).max(255)
  ]).optional().default([255, 0, 255]),

  /**
   * Directory for storing baseline snapshots (relative to project root).
   * Default: '.apex/snapshots'
   */
  snapshotDir: z.string().optional().default('.apex/snapshots'),

  /**
   * Whether to fail the test/comparison when mismatch is detected.
   * Default: true
   */
  failOnMismatch: z.boolean().optional().default(true),

  /** Whether to include alpha channel in comparison (default: false) */
  includeAlpha: z.boolean().optional().default(false),

  /** Whether to output diff image (default: false) */
  outputDiff: z.boolean().optional().default(false),

  /** Path to save diff image (required if outputDiff is true) */
  diffOutputPath: z.string().optional(),
});
export type VisualRegressionConfig = z.infer<typeof VisualRegressionConfigSchema>;

export const ApexConfigSchema = z.object({
  version: z.string().default('1.0'),
  project: ProjectConfigSchema,
  autonomy: AutonomyConfigSchema.optional(),
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
  /** Linter configuration for code quality enforcement (v0.5.0) */
  linter: LinterConfigSchema.optional(),
  /** Code quality automation configuration (v0.5.0) */
  codeQuality: CodeQualityConfigSchema.optional(),
  /** Secret scanner configuration for detecting sensitive information (v0.5.0) */
  scanner: SecretScannerConfigSchema.optional(),
  /** Secret scanning configuration with enforcement mode control (v0.5.0) */
  secretScanning: SecretScanningConfigSchema.optional(),
  daemon: DaemonConfigSchema.optional(),
  /** Logging configuration for structured logging across all packages (v0.6.0) */
  logging: LoggingConfigSchema.optional(),
  documentation: z.lazy(() => DocumentationAnalysisConfigSchema).optional(),
  workspace: z.lazy(() => WorkspaceDefaultsSchema).optional(),
  /** Permission preset configuration for tool access control (v0.5.0) */
  permissions: z.lazy(() => PermissionsConfigSchema).optional(),
  /** Policy-as-code configuration for governance and compliance (v0.5.0) */
  policy: z.lazy(() => PolicyConfigSchema).optional(),
  /** Array of policy definitions for enhanced governance (v0.5.0) */
  policies: z.lazy(() => z.array(PolicySchema)).optional().default([]),
  /** Tool action tracking and retention configuration (v0.5.0) */
  toolActionRetention: ToolActionRetentionConfigSchema.optional(),
  /** Hook configuration for custom lifecycle events (v0.5.0) */
  hooks: z.lazy(() => z.array(HookConfigSchema)).optional().default([]),
  /** Tool hook configuration for pre/post tool execution hooks (v0.5.0) */
  toolHooks: z.lazy(() => ToolHookConfigSchema).optional(),
  /** Per-tool configuration overrides */
  tools: ToolConfigSchema.optional(),
  /** Custom tool definitions (v0.5.0) */
  customTools: z.array(CustomToolConfigSchema).optional().default([]),
  /** MCP server configuration and marketplace settings (v0.5.0) */
  mcp: MCPConfigSchema.optional(),
  /** TDD mode configuration for test-first workflows (v0.5.0) */
  tdd: TDDModeConfigSchema.optional(),
  /** Visual regression configuration for screenshot comparison testing (v0.5.0) */
  visualRegression: VisualRegressionConfigSchema.optional(),
  /** Project-specific rules defined in .apexrules (v0.4.0) */
  projectRules: z.lazy(() => z.array(ApexRuleSchema)).optional().default([]),
  /** Unified guardrails configuration for policies, secrets, and access control (v0.5.0) */
  guardrails: z.lazy(() => GuardrailConfigSchema).optional(),
  /** Tool aliases for reusable tool configurations (v0.5.0) */
  aliases: z.array(ToolAliasSchema).optional().default([]),
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
  'awaiting-approval',
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
  // v0.5.0 dry-run support
  dryRun?: boolean;         // If true, task execution simulates without making actual API calls
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
  // v0.5.0 policy check result
  policyCheckResult?: TaskPolicyCheckResult; // Result of policy evaluation for this task
  // v0.5.0 approval state
  approvalState?: ApprovalState; // Current approval state if task is awaiting approval
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
  totalCostCents: number;
  executionTimeMs: number;
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
  autoFixResults?: AutoFixStageResults;  // Auto-fix results if applied to this stage
}

/**
 * Auto-fix results for a workflow stage
 * Contains summary of auto-fix operations applied after stage completion
 */
export interface AutoFixStageResults {
  /** Whether auto-fix was applied to this stage */
  applied: boolean;
  /** Files that were processed by auto-fix */
  filesProcessed: string[];
  /** Files that were actually modified */
  filesModified: string[];
  /** Total number of imports added across all files */
  totalImportsAdded: number;
  /** Total duration of auto-fix operations in milliseconds */
  totalDuration: number;
  /** Any errors encountered during auto-fix */
  errors: Array<{
    filePath: string;
    error: string;
    type: 'io' | 'resolution' | 'syntax';
  }>;
  /** Reason auto-fix was skipped (if not applied) */
  skipReason?: 'disabled' | 'no_code_files' | 'failed_to_identify_files' | 'stage_failed';
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
// Approval State Types (v0.5.0)
// ============================================================================

/**
 * Status values for approval state
 * - pending: Awaiting approval decision
 * - approved: Approval granted
 * - denied: Approval denied/rejected
 */
export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'denied']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

/**
 * Approval actions that can be taken on an approval request
 * - approve: Grant approval to proceed
 * - deny: Deny approval and block proceeding
 * - request-info: Request more information before deciding
 */
export const ApprovalActionSchema = z.enum(['approve', 'deny', 'request-info']);
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

/**
 * Approval request data structure
 * Represents a request for approval with all necessary context
 */
export const ApprovalRequestSchema = z.object({
  /** Unique identifier for this approval request (new field) */
  requestId: z.string().min(1, 'Request ID is required'),
  /** ID of the task requiring approval */
  taskId: z.string().min(1, 'Task ID is required'),
  /** Description of what this approval is for */
  description: z.string().min(1, 'Description is required'),
  /** Impact on resources (e.g., high, medium, low) */
  resourceImpact: z.string().optional(),
  /** Reason for requiring approval */
  reason: z.string().min(1, 'Reason is required'),

  // Legacy fields for backward compatibility
  /** Unique identifier for this approval request (legacy field - use requestId) */
  id: z.string().min(1, 'Approval ID is required'),
  /** Name of the gate/checkpoint requiring approval */
  gateName: z.string().min(1, 'Gate name is required'),
  /** Type of approval checkpoint */
  gateType: ApprovalCheckpointTypeSchema,
  /** Who can approve this request (list of usernames, emails, or roles) */
  approvers: z.array(z.string()).optional(),
  /** Minimum number of approvals required */
  minApprovals: z.number().int().min(1).optional().default(1),
  /** When the approval was requested */
  requestedAt: z.date(),
  /** Timeout in minutes (undefined = no timeout) */
  timeoutMinutes: z.number().min(1).optional(),
  /** When the approval will expire */
  expiresAt: z.date().optional(),
  /** Current workflow stage */
  stage: z.string().optional(),
  /** Agent that triggered the approval request */
  agent: z.string().optional(),
  /** Additional context about what is being approved */
  context: z.record(z.string(), z.unknown()).optional(),
  /** Summary of changes or actions pending approval */
  changesSummary: z.string().optional(),
  /** Files affected by the pending changes */
  affectedFiles: z.array(z.string()).optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

/**
 * Approval response data structure
 * Represents a response to an approval request with decision and context
 */
export const ApprovalResponseSchema = z.object({
  /** Unique identifier for this approval request (new field) */
  requestId: z.string().min(1, 'Request ID is required'),
  /** ID of the task that received the approval response */
  taskId: z.string().min(1, 'Task ID is required'),
  /** Response status (approved, denied, info-requested) */
  response: z.enum(['approved', 'denied', 'info-requested']),
  /** Optional message explaining the decision */
  message: z.string().optional(),

  // Legacy fields for backward compatibility
  /** Unique identifier for this approval request (legacy field - use requestId) */
  approvalId: z.string().min(1, 'Approval ID is required'),
  /** Name of the gate/checkpoint */
  gateName: z.string().min(1, 'Gate name is required'),
  /** Action taken (approve, deny, request-info) */
  action: ApprovalActionSchema,
  /** Who provided the response */
  approver: z.string().min(1, 'Approver is required'),
  /** Comment or reason for the decision */
  comment: z.string().optional(),
  /** Timestamp when the response was provided */
  timestamp: z.date(),
  /** Timestamp when the approval was originally requested */
  requestedAt: z.date(),
  /** Duration in milliseconds between request and response */
  responseTimeMs: z.number().int().min(0).optional(),
  /** Current workflow stage */
  stage: z.string().optional(),
  /** Number of approvals received so far */
  approvalsReceived: z.number().int().min(0).optional(),
  /** Number of approvals required */
  approvalsRequired: z.number().int().min(1).optional().default(1),
  /** Whether this response resolves the approval requirement */
  resolved: z.boolean().optional().default(false),
});
export type ApprovalResponse = z.infer<typeof ApprovalResponseSchema>;

/**
 * Approval state representing the current state of an approval request
 * Tracks the decision, who made it, when, and additional context
 */
export const ApprovalStateSchema = z.object({
  /** Unique identifier for this approval request */
  id: z.string().min(1, 'Approval ID is required'),
  /** ID of the associated task */
  taskId: z.string().min(1, 'Task ID is required'),
  /** Name of the gate/checkpoint this approval is for */
  gateName: z.string().min(1, 'Gate name is required'),
  /** Current status of the approval */
  status: ApprovalStatusSchema,
  /** Who provided the approval/denial decision (username, email, or identifier) */
  approver: z.string().optional(),
  /** When the approval was requested */
  requestedAt: z.date(),
  /** When the approval was responded to (approved or denied) */
  respondedAt: z.date().optional(),
  /** Comment or reason provided with the decision */
  comment: z.string().optional(),
  /** Additional context about the approval request */
  context: z.record(z.string(), z.unknown()).optional(),
  /** Stage in the workflow where approval was requested */
  stage: z.string().optional(),
  /** Agent that triggered the approval request */
  agent: z.string().optional(),
  /** Number of approvals received (for multi-approval gates) */
  approvalsReceived: z.number().int().min(0).optional().default(0),
  /** Number of approvals required */
  approvalsRequired: z.number().int().min(1).optional().default(1),
  /** Timeout configuration (in minutes, undefined = no timeout) */
  timeoutMinutes: z.number().min(1).optional(),
  /** When the approval will timeout (calculated from requestedAt + timeoutMinutes) */
  expiresAt: z.date().optional(),
});
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;

/**
 * Event data for 'approval-required' event
 * Emitted when a task reaches an approval gate and requires human approval
 */
export const ApprovalRequiredEventDataSchema = z.object({
  /** Unique identifier for this approval request */
  approvalId: z.string().min(1),
  /** ID of the task requiring approval */
  taskId: z.string().min(1),
  /** Name of the gate/checkpoint requiring approval */
  gateName: z.string().min(1),
  /** Type of approval checkpoint */
  gateType: ApprovalCheckpointTypeSchema,
  /** Description of what this approval is for */
  description: z.string().optional(),
  /** Who can approve this request (list of usernames, emails, or roles) */
  approvers: z.array(z.string()).optional(),
  /** Minimum number of approvals required */
  minApprovals: z.number().int().min(1).optional().default(1),
  /** Timeout in minutes (undefined = no timeout) */
  timeoutMinutes: z.number().min(1).optional(),
  /** When the approval will expire */
  expiresAt: z.date().optional(),
  /** Current workflow stage */
  stage: z.string().optional(),
  /** Agent that triggered the approval request */
  agent: z.string().optional(),
  /** Timestamp when approval was requested */
  timestamp: z.date(),
  /** Additional context about what is being approved */
  context: z.record(z.string(), z.unknown()).optional(),
  /** Summary of changes or actions pending approval */
  changesSummary: z.string().optional(),
  /** Files affected by the pending changes */
  affectedFiles: z.array(z.string()).optional(),
  /** Whether this is a blocking gate (task cannot proceed without approval) */
  blocking: z.boolean().optional().default(true),
  /** URL for the approval interface (generated from apiUrl config) */
  approvalUrl: z.string().url().optional(),
});
export type ApprovalRequiredEventData = z.infer<typeof ApprovalRequiredEventDataSchema>;

/**
 * Event data for 'gate:approved' and 'gate:rejected' events
 * Emitted when an approval request receives a response
 */
export const ApprovalResponseEventDataSchema = z.object({
  /** Unique identifier for this approval request */
  approvalId: z.string().min(1),
  /** ID of the task that received the approval response */
  taskId: z.string().min(1),
  /** Name of the gate/checkpoint */
  gateName: z.string().min(1),
  /** Type of approval checkpoint */
  gateType: ApprovalCheckpointTypeSchema,
  /** Whether the request was approved or denied */
  approved: z.boolean(),
  /** Who provided the approval/denial decision */
  approver: z.string().min(1, 'Approver is required'),
  /** Comment or reason for the decision */
  comment: z.string().optional(),
  /** Timestamp when the response was provided */
  timestamp: z.date(),
  /** Timestamp when the approval was originally requested */
  requestedAt: z.date(),
  /** Duration in milliseconds between request and response */
  responseTimeMs: z.number().int().min(0).optional(),
  /** Current workflow stage */
  stage: z.string().optional(),
  /** Number of approvals received so far */
  approvalsReceived: z.number().int().min(0).optional(),
  /** Number of approvals required */
  approvalsRequired: z.number().int().min(1).optional(),
  /** Whether all required approvals have been received */
  allApprovalsReceived: z.boolean().optional(),
  /** Additional context about the approval response */
  context: z.record(z.string(), z.unknown()).optional(),
});
export type ApprovalResponseEventData = z.infer<typeof ApprovalResponseEventDataSchema>;

/**
 * Event data for when an approval has been granted
 */
export const ApprovalGrantedEventDataSchema = z.object({
  /** Unique identifier for the approval request that was granted */
  approvalId: z.string().min(1),
  /** ID of the task associated with the approval */
  taskId: z.string().min(1),
  /** Who granted the approval */
  approver: z.string().min(1),
  /** Optional comment from the approver */
  comment: z.string().optional(),
  /** Timestamp when the approval was granted */
  timestamp: z.date(),
});
export type ApprovalGrantedEventData = z.infer<typeof ApprovalGrantedEventDataSchema>;

/**
 * Event data for when an approval has been denied
 */
export const ApprovalDeniedEventDataSchema = z.object({
  /** Unique identifier for the approval request that was denied */
  approvalId: z.string().min(1),
  /** ID of the task associated with the approval */
  taskId: z.string().min(1),
  /** Who denied the approval */
  approver: z.string().min(1),
  /** Reason for denying the approval */
  reason: z.string().min(1, 'Reason is required for denial'),
  /** Timestamp when the approval was denied */
  timestamp: z.date(),
});
export type ApprovalDeniedEventData = z.infer<typeof ApprovalDeniedEventDataSchema>;

/**
 * Event data for when an approval has been fully resolved
 * Emitted when an approval request reaches a final state (approved, denied, or timeout)
 */
export const ApprovalResolvedEventDataSchema = z.object({
  /** Unique identifier for the approval request that was resolved */
  approvalId: z.string().min(1),
  /** ID of the task associated with the approval */
  taskId: z.string().min(1),
  /** Name of the gate/checkpoint */
  gateName: z.string().min(1),
  /** Final resolution status */
  resolution: z.enum(['approved', 'denied', 'timeout', 'cancelled']),
  /** Who provided the final resolution (if applicable) */
  resolvedBy: z.string().optional(),
  /** Final comment or reason for the resolution */
  comment: z.string().optional(),
  /** Timestamp when the approval was resolved */
  timestamp: z.date(),
  /** Timestamp when the approval was originally requested */
  requestedAt: z.date(),
  /** Total duration in milliseconds from request to resolution */
  totalDurationMs: z.number().int().min(0).optional(),
  /** Number of approvals received (for multi-approval gates) */
  approvalsReceived: z.number().int().min(0).optional(),
  /** Number of approvals required */
  approvalsRequired: z.number().int().min(1).optional().default(1),
});
export type ApprovalResolvedEventData = z.infer<typeof ApprovalResolvedEventDataSchema>;

/**
 * Combined approval event type for gate events
 * Used for type discrimination in event handlers
 */
export type ApprovalEventData = ApprovalRequiredEventData | ApprovalResponseEventData | ApprovalGrantedEventData | ApprovalDeniedEventData | ApprovalResolvedEventData;

/**
 * Request to submit an approval decision
 */
export const ApprovalDecisionRequestSchema = z.object({
  /** ID of the approval request to respond to */
  approvalId: z.string().min(1, 'Approval ID is required'),
  /** Who is making the decision */
  approver: z.string().min(1, 'Approver is required'),
  /** Decision: approved, denied, or info-requested */
  decision: z.enum(['approved', 'denied', 'info-requested']),
  /** Optional comments explaining the decision */
  comments: z.string().optional(),
});
export type ApprovalDecisionRequest = z.infer<typeof ApprovalDecisionRequestSchema>;

/**
 * Response after submitting an approval decision
 */
export const ApprovalDecisionResponseSchema = z.object({
  /** Whether the decision was successfully recorded */
  success: z.boolean(),
  /** Updated approval state after the decision */
  approvalState: ApprovalStateSchema.optional(),
  /** Error message if the decision failed */
  error: z.string().optional(),
  /** Whether the task will now proceed (all approvals received) */
  willProceed: z.boolean(),
});
export type ApprovalDecisionResponse = z.infer<typeof ApprovalDecisionResponseSchema>;

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
  | 'tool:start'
  | 'tool:progress'
  | 'tool:complete'
  | 'tool:timing'
  | 'gate:required'
  | 'approval-required'
  | 'approval-resolved'
  | 'gate:approved'
  | 'gate:rejected'
  | 'approval:granted'
  | 'approval:denied'
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
  | 'dangerous:blocked'
  // Policy events (v0.5.0)
  | 'policy:blocked'
  | 'policy:warned'
  | 'policy:audited'
  // Undo/Redo events (v0.5.0)
  | 'undo:requested'
  | 'undo:started'
  | 'undo:completed'
  | 'undo:failed'
  | 'redo:requested'
  | 'redo:started'
  | 'redo:completed'
  | 'redo:failed'
  // Auto-fix events (v0.5.0)
  | 'autofix:requested'
  | 'autofix:started'
  | 'autofix:progress'
  | 'autofix:completed'
  | 'autofix:failed'
  | 'autofix:skipped'
  // TDD execution events (v0.5.0)
  | 'tdd:started'
  | 'tdd:iteration-started'
  | 'tdd:test-run'
  | 'tdd:fix-generated'
  | 'tdd:fix-applied'
  | 'tdd:regression-detected'
  | 'tdd:fix-reverted'
  | 'tdd:iteration-completed'
  | 'tdd:completed'
  | 'tdd:failed'
  // Visual comparison events (v0.5.0)
  | 'visual:comparison:failed'
  | 'visual:comparison:passed'
  // Browser automation events (v0.5.0)
  | 'browser:console'
  | 'browser:error'
  | 'browser:network-error'
  | 'browser:performance-warning'
  | 'browser:security-violation'
  | 'browser:session-started'
  | 'browser:session-ended';

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

// ============================================================================
// Policy Event Data Types (v0.5.0)
// ============================================================================

/**
 * Event data for 'policy:blocked' event
 * Emitted when an action is blocked by policy enforcement
 */
export interface PolicyBlockedEventData {
  /** Task ID where the policy block occurred */
  taskId: string;
  /** Agent that attempted the action */
  agent: string;
  /** Action that was blocked */
  action: string;
  /** Tool name that was blocked */
  toolName?: string;
  /** Policy violations that caused the block */
  violations: PolicyViolation[];
  /** Policy enforcement mode at time of block */
  enforcementMode: PolicyEnforcementMode;
  /** Timestamp when the action was blocked */
  timestamp: Date;
  /** Additional context about the block */
  context?: Record<string, unknown>;
}

/**
 * Event data for 'policy:warned' event
 * Emitted when an action triggers a policy warning but continues
 */
export interface PolicyWarnedEventData {
  /** Task ID where the policy warning occurred */
  taskId: string;
  /** Agent that performed the action */
  agent: string;
  /** Action that triggered the warning */
  action: string;
  /** Tool name that triggered the warning */
  toolName?: string;
  /** Policy violation that caused the warning */
  violation: PolicyViolation;
  /** Policy enforcement mode at time of warning */
  enforcementMode: PolicyEnforcementMode;
  /** Timestamp when the warning was issued */
  timestamp: Date;
  /** Additional context about the warning */
  context?: Record<string, unknown>;
}

/**
 * Event data for 'policy:audited' event
 * Emitted when an action is logged for audit purposes
 */
export interface PolicyAuditedEventData {
  /** Task ID where the policy audit occurred */
  taskId: string;
  /** Agent that performed the action */
  agent: string;
  /** Action that was audited */
  action: string;
  /** Tool name that was audited */
  toolName?: string;
  /** Policy violations found during audit (if any) */
  violations: PolicyViolation[];
  /** Policy enforcement mode at time of audit */
  enforcementMode: PolicyEnforcementMode;
  /** Timestamp when the action was audited */
  timestamp: Date;
  /** Additional context about the audit */
  context?: Record<string, unknown>;
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
  | DangerousOperationBlockedEventData
  | PolicyBlockedEventData
  | PolicyWarnedEventData
  | PolicyAuditedEventData;

/**
 * Type-safe permission event interface
 * Provides strong typing for permission-related events
 */
export interface PermissionEvent<T extends PermissionEventData = PermissionEventData> {
  type: Extract<ApexEventType, `permission:${string}` | `dangerous:${string}` | `policy:${string}`>;
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
  T extends 'policy:blocked' ? PolicyBlockedEventData :
  T extends 'policy:warned' ? PolicyWarnedEventData :
  T extends 'policy:audited' ? PolicyAuditedEventData :
  never;

// ============================================================================
// TDD Event Data Types (v0.5.0)
// ============================================================================

/**
 * Event data for 'tdd:started' event
 * Emitted when TDD execution begins
 */
export interface TDDStartedEventData {
  /** TDD executor configuration */
  config: {
    maxIterations: number;
    testCommand: string;
    workingDirectory?: string;
    testTimeout?: number;
    enableEvents?: boolean;
  };
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when TDD execution started */
  timestamp: Date;
}

/**
 * Event data for 'tdd:iteration-started' event
 * Emitted when a new TDD iteration begins
 */
export interface TDDIterationStartedEventData {
  /** Current iteration number (1-based) */
  iteration: number;
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when iteration started */
  timestamp: Date;
}

/**
 * Event data for 'tdd:test-run' event
 * Emitted when tests are executed
 */
export interface TDDTestRunEventData {
  /** Results of the test execution */
  testResult: {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    failures: Array<{
      file: string;
      test: string;
      message: string;
      stack?: string;
      expected?: string;
      actual?: string;
    }>;
  };
  /** Current iteration number */
  iteration: number;
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when test run completed */
  timestamp: Date;
}

/**
 * Event data for 'tdd:fix-generated' event
 * Emitted when Claude generates a fix for test failures
 */
export interface TDDFixGeneratedEventData {
  /** The suggested fix from Claude */
  fix: {
    description: string;
    file: string;
    originalContent: string;
    newContent: string;
    confidence: number;
    reasoning?: string;
  };
  /** Current iteration number */
  iteration: number;
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when fix was generated */
  timestamp: Date;
}

/**
 * Event data for 'tdd:fix-applied' event
 * Emitted when a fix is applied to the codebase
 */
export interface TDDFixAppliedEventData {
  /** Result of applying the fix */
  fixResult: {
    success: boolean;
    error?: string;
    modifiedFiles: string[];
  };
  /** Current iteration number */
  iteration: number;
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when fix was applied */
  timestamp: Date;
}

/**
 * Event data for 'tdd:regression-detected' event
 * Emitted when regression is detected after applying a fix
 */
export interface TDDRegressionDetectedEventData {
  /** Regression detection result */
  regressionResult: {
    detected: boolean;
    error?: string;
    testResult?: {
      success: boolean;
      exitCode: number;
      stdout: string;
      stderr: string;
      failures: Array<{
        file: string;
        test: string;
        message: string;
      }>;
    };
  };
  /** Current iteration number */
  iteration: number;
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when regression was detected */
  timestamp: Date;
}

/**
 * Event data for 'tdd:fix-reverted' event
 * Emitted when a fix is reverted due to regression
 */
export interface TDDFixRevertedEventData {
  /** Result of reverting the fix */
  revertResult: {
    success: boolean;
    error?: string;
    modifiedFiles: string[];
  };
  /** Current iteration number */
  iteration: number;
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when fix was reverted */
  timestamp: Date;
}

/**
 * Event data for 'tdd:iteration-completed' event
 * Emitted when a TDD iteration is completed
 */
export interface TDDIterationCompletedEventData {
  /** Complete iteration result */
  result: {
    iteration: number;
    testResult: {
      success: boolean;
      exitCode: number;
      stdout: string;
      stderr: string;
      duration: number;
      failures: Array<{
        file: string;
        test: string;
        message: string;
        stack?: string;
        expected?: string;
        actual?: string;
      }>;
    };
    suggestedFix?: {
      description: string;
      file: string;
      originalContent: string;
      newContent: string;
      confidence: number;
      reasoning?: string;
    };
    fixResult?: {
      success: boolean;
      error?: string;
      modifiedFiles: string[];
    };
    resolved: boolean;
    duration: number;
    startTime: Date;
    endTime: Date;
  };
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when iteration completed */
  timestamp: Date;
}

/**
 * Event data for 'tdd:completed' event
 * Emitted when TDD execution completes (success or failure)
 */
export interface TDDCompletedEventData {
  /** Final TDD execution result */
  result: {
    success: boolean;
    totalIterations: number;
    iterations: Array<{
      iteration: number;
      testResult: {
        success: boolean;
        exitCode: number;
        stdout: string;
        stderr: string;
        duration: number;
        failures: Array<{
          file: string;
          test: string;
          message: string;
          stack?: string;
          expected?: string;
          actual?: string;
        }>;
      };
      suggestedFix?: {
        description: string;
        file: string;
        originalContent: string;
        newContent: string;
        confidence: number;
        reasoning?: string;
      };
      fixResult?: {
        success: boolean;
        error?: string;
        modifiedFiles: string[];
      };
      resolved: boolean;
      duration: number;
      startTime: Date;
      endTime: Date;
    }>;
    totalDuration: number;
    finalTestResult: {
      success: boolean;
      exitCode: number;
      stdout: string;
      stderr: string;
      duration: number;
      failures: Array<{
        file: string;
        test: string;
        message: string;
        stack?: string;
        expected?: string;
        actual?: string;
      }>;
    };
    stopReason?: 'max_iterations' | 'fix_failed' | 'test_error' | 'no_failures';
  };
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when TDD execution completed */
  timestamp: Date;
}

/**
 * Event data for 'tdd:failed' event
 * Emitted when TDD execution encounters an error
 */
export interface TDDFailedEventData {
  /** Error that caused the failure */
  error: {
    message: string;
    stack?: string;
    name: string;
  };
  /** Current iteration when failure occurred */
  iteration: number;
  /** Task ID for tracking TDD execution */
  taskId: string;
  /** Timestamp when failure occurred */
  timestamp: Date;
}

/**
 * TDD-specific event with typed data
 */
export interface TDDEvent<T = unknown> {
  type: Extract<ApexEventType, `tdd:${string}`>;
  taskId: string;
  timestamp: Date;
  data: T;
}

/**
 * Helper type to get the event data type for a specific TDD event type
 */
export type TDDEventDataFor<T extends ApexEventType> =
  T extends 'tdd:started' ? TDDStartedEventData :
  T extends 'tdd:iteration-started' ? TDDIterationStartedEventData :
  T extends 'tdd:test-run' ? TDDTestRunEventData :
  T extends 'tdd:fix-generated' ? TDDFixGeneratedEventData :
  T extends 'tdd:fix-applied' ? TDDFixAppliedEventData :
  T extends 'tdd:regression-detected' ? TDDRegressionDetectedEventData :
  T extends 'tdd:fix-reverted' ? TDDFixRevertedEventData :
  T extends 'tdd:iteration-completed' ? TDDIterationCompletedEventData :
  T extends 'tdd:completed' ? TDDCompletedEventData :
  T extends 'tdd:failed' ? TDDFailedEventData :
  never;

// ============================================================================
// Visual Comparison Event Data Types (v0.5.0)
// ============================================================================

/**
 * Event data for visual comparison results
 * Emitted when compareScreenshot() completes with comparison result
 */
export const VisualComparisonEventDataSchema = z.object({
  /** Unique test/comparison identifier */
  testId: z.string().min(1),
  /** Path to baseline image */
  baseline: z.string().min(1),
  /** Path to actual (current) image or base64 data URI */
  actual: z.string().min(1),
  /** Path to diff image (if generated) */
  diffImage: z.string().optional(),
  /** Percentage of pixels that differ (0-100) */
  diffPercentage: z.number().min(0).max(100),
  /** Threshold percentage for acceptable difference (0-100) */
  threshold: z.number().min(0).max(100),
  /** Whether the comparison passed (diffPercentage <= threshold) */
  passed: z.boolean(),
  /** Task ID associated with this comparison */
  taskId: z.string().optional(),
  /** Timestamp when comparison occurred */
  timestamp: z.date(),
  /** URL of the page being compared (if applicable) */
  pageUrl: z.string().optional(),
  /** Selector if element-specific comparison */
  selector: z.string().optional(),
});
export type VisualComparisonEventData = z.infer<typeof VisualComparisonEventDataSchema>;

/**
 * Visual comparison-specific event with typed data
 */
export interface VisualComparisonEvent<T = unknown> {
  type: Extract<ApexEventType, `visual:${string}`>;
  taskId: string;
  timestamp: Date;
  data: T;
}

/**
 * Type helper for visual comparison event data by type
 */
export type VisualComparisonEventDataFor<T extends ApexEventType> =
  T extends 'visual:comparison:failed' ? VisualComparisonEventData :
  T extends 'visual:comparison:passed' ? VisualComparisonEventData :
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
  | 'deprecated-dependency'
  | 'secret-leak';

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

/**
 * Secret finding specific structure
 */
/**
 * Severity levels for secret findings
 */
export type SecretSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecretFinding {
  /** File path where the secret was found */
  file: string;
  /** Line number where the secret was found */
  line: number;
  /** Column where the secret starts */
  column: number;
  /** Column where the secret ends */
  endColumn: number;
  /** Type of secret detected */
  secretType: string;
  /** Matched content (may be partially masked for security) */
  match: string;
  /** Confidence level of the match (0-1) */
  confidence: number;
  /** Name of the pattern that matched */
  patternName: string;
  /** Severity level of the finding */
  severity: SecretSeverity;
  /** Additional context around the finding */
  context?: string;
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
 * Legacy validation result for a single policy rule (for backward compatibility)
 */
export interface LegacyPolicyValidationResult {
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
 * Policy validation result with passed status and violations array (defined after PolicyViolationSchema)
 */

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
  results: LegacyPolicyValidationResult[];
  /** Whether human approval is required */
  requiresApproval: boolean;
  /** IDs of approval rules that were triggered */
  triggeredApprovalRules: string[];
  /** Timestamp of evaluation */
  evaluatedAt: Date;
  /** Policy configuration that was used */
  policyName?: string;
}

// ============================================================================
// Policy Types - Core Domain Types
// ============================================================================

/**
 * Severity level schema for policy rules and violations
 */
export const PolicySeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type PolicySeverity = z.infer<typeof PolicySeveritySchema>;

/**
 * Base policy rule definition with condition, action, and severity
 */
export const PolicyRuleSchema = z.object({
  /** Unique identifier for this rule */
  id: z.string(),
  /** Human-readable name for this rule */
  name: z.string(),
  /** Description of what this rule enforces */
  description: z.string().optional(),
  /** Condition that triggers this rule (as a string expression or pattern) */
  condition: z.string(),
  /** Action to take when condition is met */
  action: z.enum(['allow', 'deny', 'warn', 'require_approval']),
  /** Severity level of this rule */
  severity: PolicySeveritySchema,
  /** Whether this rule is enabled */
  enabled: z.boolean().optional().default(true),
  /** Enforcement mode for this specific rule */
  enforcement: PolicyEnforcementModeSchema.optional(),
  /** Tags for categorizing this rule */
  tags: z.array(z.string()).optional().default([]),
  /** Custom metadata for this rule */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

/**
 * Path policy rule for filesystem access control
 */
export const PathPolicySchema = PolicyRuleSchema.extend({
  /** Type discriminator */
  type: z.literal('path'),
  /** Path configuration for this rule */
  config: AllowedPathsConfigSchema,
});
export type PathPolicy = z.infer<typeof PathPolicySchema>;

/**
 * Test policy rule for test requirements
 */
export const TestPolicySchema = PolicyRuleSchema.extend({
  /** Type discriminator */
  type: z.literal('test'),
  /** Test configuration for this rule */
  config: RequiredTestsConfigSchema,
});
export type TestPolicy = z.infer<typeof TestPolicySchema>;

/**
 * Approval policy rule for human approval requirements
 */
export const ApprovalPolicySchema = PolicyRuleSchema.extend({
  /** Type discriminator */
  type: z.literal('approval'),
  /** Approval configuration for this rule */
  config: ApprovalRulesConfigSchema,
});
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

/**
 * Policy definition with id, name, rules, and severity levels
 */
export const PolicySchema = z.object({
  /** Unique identifier for this policy */
  id: z.string(),
  /** Human-readable name for this policy */
  name: z.string(),
  /** Description of what this policy enforces */
  description: z.string().optional(),
  /** Array of policy rules that define the policy behavior */
  rules: z.array(PolicyRuleSchema),
  /** Severity levels configuration for this policy */
  severityLevels: z.object({
    /** Default severity for violations */
    default: PolicySeveritySchema,
    /** Override severity levels for specific rule types */
    overrides: z.record(z.string(), PolicySeveritySchema).optional(),
  }).optional(),
  /** Whether this policy is enabled */
  enabled: z.boolean().optional().default(true),
  /** Global enforcement mode for this policy */
  enforcement: PolicyEnforcementModeSchema.optional().default('warn'),
  /** Version of this policy for change tracking */
  version: z.string().optional(),
  /** Tags for categorizing this policy */
  tags: z.array(z.string()).optional().default([]),
  /** Metadata for this policy */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Timestamp when policy was created */
  createdAt: z.date().optional(),
  /** Timestamp when policy was last updated */
  updatedAt: z.date().optional(),
});
export type Policy = z.infer<typeof PolicySchema>;

/**
 * Legacy policy types for backward compatibility
 * Union type for all policy rule types
 */
export const LegacyPolicySchema = z.discriminatedUnion('type', [
  PathPolicySchema,
  TestPolicySchema,
  ApprovalPolicySchema,
]);
export type LegacyPolicy = z.infer<typeof LegacyPolicySchema>;

/**
 * Policy violation details
 */
export const PolicyViolationSchema = z.object({
  /** Unique identifier for this violation */
  id: z.string(),
  /** The policy rule that was violated */
  rule: z.string(),
  /** Human-readable message describing the violation */
  message: z.string(),
  /** Severity of the violation */
  severity: PolicySeveritySchema,
  /** Whether this violation blocks further execution */
  blocking: z.boolean(),
  /** Type of policy that was violated */
  policyType: z.enum(['path', 'test', 'approval']).optional(),
  /** Detailed description of the violation */
  description: z.string().optional(),
  /** Resource or context that triggered the violation */
  resource: z.string().optional(),
  /** Additional context about the violation */
  context: z.record(z.string(), z.unknown()).optional(),
  /** Timestamp when the violation occurred */
  timestamp: z.date(),
  /** Whether this violation was resolved */
  resolved: z.boolean().optional().default(false),
  /** Timestamp when the violation was resolved */
  resolvedAt: z.date().optional(),
  /** How the violation was resolved */
  resolution: z.string().optional(),
});
export type PolicyViolation = z.infer<typeof PolicyViolationSchema>;

/**
 * Policy validation result with passed status and violations array
 */
export const PolicyValidationResultSchema = z.object({
  /** Whether the validation passed overall */
  passed: z.boolean(),
  /** Array of policy violations found during validation */
  violations: z.array(PolicyViolationSchema),
  /** Timestamp when validation was performed */
  validatedAt: z.date().optional(),
  /** Additional context about the validation */
  context: z.record(z.string(), z.unknown()).optional(),
});
export type PolicyValidationResult = z.infer<typeof PolicyValidationResultSchema>;

/**
 * Policy violation event for real-time notifications
 */
export const PolicyViolationEventSchema = z.object({
  /** Event type */
  type: z.literal('policy_violation'),
  /** Event ID */
  id: z.string(),
  /** Timestamp when the event occurred */
  timestamp: z.date(),
  /** The policy violation that triggered this event */
  violation: PolicyViolationSchema,
  /** Task ID associated with this violation */
  taskId: z.string().optional(),
  /** Agent ID that triggered this violation */
  agentId: z.string().optional(),
  /** Workflow ID associated with this violation */
  workflowId: z.string().optional(),
  /** Additional event metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PolicyViolationEvent = z.infer<typeof PolicyViolationEventSchema>;

/**
 * Task-level policy check result
 * Captures the outcome of policy evaluation for a task
 */
export const TaskPolicyCheckResultSchema = z.object({
  /** Whether the policy check passed overall */
  passed: z.boolean(),
  /** Whether the task was blocked due to policy violations */
  blocked: z.boolean(),
  /** Number of violations found */
  violationCount: z.number().int().min(0),
  /** List of policy violations */
  violations: z.array(PolicyViolationSchema),
  /** Timestamp when the policy check was performed */
  checkedAt: z.date(),
  /** Policy name/configuration used */
  policyName: z.string().optional(),
  /** Enforcement mode that was applied */
  enforcementMode: PolicyEnforcementModeSchema.optional(),
});
export type TaskPolicyCheckResult = z.infer<typeof TaskPolicyCheckResultSchema>;

// ============================================================================
// Policy Engine Types (v0.5.0)
// ============================================================================

/**
 * Policy check decision status
 * - 'allow': The policy check passed and the action is permitted
 * - 'deny': The policy check failed and the action is blocked
 *
 * @remarks
 * This is the primary decision outcome from a policy check.
 * Unlike boolean passed/blocked fields, this provides a clear semantic status.
 */
export const PolicyCheckStatusSchema = z.enum(['allow', 'deny']);
export type PolicyCheckStatus = z.infer<typeof PolicyCheckStatusSchema>;

/**
 * Result of a policy check operation.
 * Contains the allow/deny decision, any violations found, and the enforcement mode applied.
 *
 * @remarks
 * This is the standard result type returned by the PolicyEngine.checkPolicy() method.
 * It provides a complete picture of the policy evaluation including:
 * - The final decision (allow/deny)
 * - All violations that were detected
 * - The enforcement mode that was applied
 * - Optional metadata for debugging and auditing
 *
 * @example
 * ```typescript
 * const result: PolicyCheckResult = {
 *   status: 'deny',
 *   violations: [{
 *     id: 'v-123',
 *     rule: 'no-secrets-in-code',
 *     message: 'API key detected in source file',
 *     severity: 'critical',
 *     blocking: true,
 *     timestamp: new Date(),
 *   }],
 *   enforcementMode: 'strict',
 *   checkedAt: new Date(),
 * };
 * ```
 */
export const PolicyCheckResultSchema = z.object({
  /** The policy check decision: allow or deny */
  status: PolicyCheckStatusSchema,

  /** Array of policy violations detected during the check */
  violations: z.array(PolicyViolationSchema),

  /** The enforcement mode that was applied during this check */
  enforcementMode: PolicyEnforcementModeSchema,

  /** Timestamp when the policy check was performed */
  checkedAt: z.date(),

  /** Name of the policy or policy set that was evaluated */
  policyName: z.string().optional(),

  /** ID of the policy or policy set that was evaluated */
  policyId: z.string().optional(),

  /** Number of rules evaluated */
  rulesEvaluated: z.number().int().min(0).optional(),

  /** Number of rules that passed */
  rulesPassed: z.number().int().min(0).optional(),

  /** Number of rules that failed */
  rulesFailed: z.number().int().min(0).optional(),

  /** Duration of the policy check in milliseconds */
  durationMs: z.number().int().min(0).optional(),

  /** Additional context or metadata about the check */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PolicyCheckResult = z.infer<typeof PolicyCheckResultSchema>;

/**
 * Context provided to the policy engine for evaluation.
 * Contains all relevant information about the action being checked.
 *
 * @remarks
 * This context object provides the PolicyEngine with everything it needs
 * to evaluate policies against a specific action or request.
 */
export const PolicyCheckContextSchema = z.object({
  /** The action being performed (e.g., 'file_write', 'command_execute', 'api_call') */
  action: z.string(),

  /** Resource being accessed (e.g., file path, API endpoint, command) */
  resource: z.string().optional(),

  /** Agent performing the action */
  agentId: z.string().optional(),

  /** Task context */
  taskId: z.string().optional(),

  /** Workflow stage */
  stage: z.string().optional(),

  /** Tool being used */
  toolName: z.string().optional(),

  /** Tool arguments */
  toolArguments: z.record(z.string(), z.unknown()).optional(),

  /** File paths involved in the action */
  filePaths: z.array(z.string()).optional(),

  /** Content being written or modified (for content scanning) */
  content: z.string().optional(),

  /** User or session identifier */
  userId: z.string().optional(),

  /** Additional context data */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PolicyCheckContext = z.infer<typeof PolicyCheckContextSchema>;

/**
 * Options for policy check operations
 */
export const PolicyCheckOptionsSchema = z.object({
  /** Override the default enforcement mode for this check */
  enforcementMode: PolicyEnforcementModeSchema.optional(),

  /** Specific policy IDs to evaluate (if not specified, all applicable policies are checked) */
  policyIds: z.array(z.string()).optional(),

  /** Whether to continue checking after first violation (default: true) */
  continueOnViolation: z.boolean().optional().default(true),

  /** Maximum violations to report (0 = unlimited) */
  maxViolations: z.number().int().min(0).optional().default(0),

  /** Whether to include non-blocking violations in the result */
  includeWarnings: z.boolean().optional().default(true),

  /** Timeout for policy evaluation in milliseconds */
  timeoutMs: z.number().int().min(0).optional(),
});
export type PolicyCheckOptions = z.infer<typeof PolicyCheckOptionsSchema>;

/**
 * Interface for the PolicyEngine that evaluates policies against actions.
 *
 * @remarks
 * The PolicyEngine is responsible for:
 * - Loading and managing policy definitions
 * - Evaluating policies against given contexts
 * - Reporting violations with appropriate severity
 * - Supporting different enforcement modes
 *
 * Implementations should be stateless for policy evaluation but may
 * maintain internal caches for policy definitions.
 *
 * @example
 * ```typescript
 * class ApexPolicyEngine implements PolicyEngine {
 *   async checkPolicy(
 *     context: PolicyCheckContext,
 *     options?: PolicyCheckOptions
 *   ): Promise<PolicyCheckResult> {
 *     // Evaluate all applicable policies against the context
 *     const violations = await this.evaluatePolicies(context);
 *
 *     return {
 *       status: violations.some(v => v.blocking) ? 'deny' : 'allow',
 *       violations,
 *       enforcementMode: options?.enforcementMode ?? this.defaultEnforcementMode,
 *       checkedAt: new Date(),
 *     };
 *   }
 * }
 * ```
 */
export interface PolicyEngine {
  /**
   * Check policies against the given context.
   *
   * @param context - The context describing the action to check
   * @param options - Optional configuration for this check
   * @returns A promise resolving to the policy check result
   *
   * @remarks
   * This is the primary method for policy evaluation. It should:
   * 1. Identify all applicable policies based on the context
   * 2. Evaluate each policy's rules against the context
   * 3. Collect all violations
   * 4. Determine the final allow/deny status based on violations and enforcement mode
   */
  checkPolicy(
    context: PolicyCheckContext,
    options?: PolicyCheckOptions
  ): Promise<PolicyCheckResult>;

  /**
   * Get the current enforcement mode.
   *
   * @returns The current default enforcement mode
   */
  getEnforcementMode(): PolicyEnforcementMode;

  /**
   * Set the default enforcement mode.
   *
   * @param mode - The enforcement mode to set as default
   */
  setEnforcementMode(mode: PolicyEnforcementMode): void;

  /**
   * Register a policy for evaluation.
   *
   * @param policy - The policy to register
   */
  registerPolicy(policy: Policy): void;

  /**
   * Unregister a policy.
   *
   * @param policyId - The ID of the policy to unregister
   * @returns true if the policy was found and removed, false otherwise
   */
  unregisterPolicy(policyId: string): boolean;

  /**
   * Get all registered policies.
   *
   * @returns Array of all registered policies
   */
  getPolicies(): Policy[];

  /**
   * Get a specific policy by ID.
   *
   * @param policyId - The ID of the policy to retrieve
   * @returns The policy if found, undefined otherwise
   */
  getPolicy(policyId: string): Policy | undefined;

  /**
   * Check if a specific policy is registered.
   *
   * @param policyId - The ID of the policy to check
   * @returns true if the policy is registered, false otherwise
   */
  hasPolicy(policyId: string): boolean;

  /**
   * Clear all registered policies.
   */
  clearPolicies(): void;
}

// ============================================================================
// Guardrails System Types
// ============================================================================

/**
 * Enforcement mode for guardrails (simplified from PolicyEnforcementMode).
 * - 'warn': Violations generate warnings but don't block operations
 * - 'block': Violations block operations immediately
 * - 'audit': Violations are logged for analysis but operations proceed
 *
 * @remarks
 * This is the recommended enforcement mode schema for guardrails.
 * For backward compatibility, PolicyEnforcementModeSchema is also available.
 */
export const EnforcementModeSchema = z.enum(['warn', 'block', 'audit']);
export type EnforcementMode = z.infer<typeof EnforcementModeSchema>;

/**
 * Individual secret detection result.
 * Represents a single detected secret in content.
 *
 * @remarks
 * This schema captures the result of scanning content for secrets.
 * It includes information about what was detected, where it was found,
 * and the severity of the finding.
 */
export const SecretDetectionSchema = z.object({
  /** Unique identifier for this detection */
  id: z.string(),
  /** The pattern that matched (from SecretPattern) */
  patternName: z.string(),
  /** Type of secret detected (e.g., 'api_key', 'password', 'token') */
  secretType: z.string(),
  /** Severity of the finding */
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  /** File path where the secret was detected (if applicable) */
  filePath: z.string().optional(),
  /** Line number where the secret was found (1-based) */
  lineNumber: z.number().int().positive().optional(),
  /** Column number where the secret starts (1-based) */
  columnNumber: z.number().int().positive().optional(),
  /** The matched content (masked for security) */
  maskedMatch: z.string(),
  /** Context around the detection (with secret masked) */
  context: z.string().optional(),
  /** Timestamp when the detection occurred */
  detectedAt: z.date(),
  /** Whether this detection has been acknowledged/resolved */
  acknowledged: z.boolean().optional().default(false),
  /** Reason for acknowledgment (if acknowledged) */
  acknowledgmentReason: z.string().optional(),
});
export type SecretDetection = z.infer<typeof SecretDetectionSchema>;

/**
 * Result of a secret scan operation.
 * Aggregates all detections from scanning content.
 */
export const SecretScanResultSchema = z.object({
  /** Whether any secrets were detected */
  hasSecrets: z.boolean(),
  /** Number of secrets detected */
  count: z.number().int().min(0),
  /** List of individual detections */
  detections: z.array(SecretDetectionSchema),
  /** Content that was scanned (identifier or description) */
  scannedContent: z.string().optional(),
  /** Timestamp when the scan was performed */
  scannedAt: z.date(),
  /** Duration of the scan in milliseconds */
  scanDurationMs: z.number().optional(),
});
export type SecretScanResult = z.infer<typeof SecretScanResultSchema>;

/**
 * Unified guardrails configuration schema.
 * Brings together all guardrail-related settings including policies,
 * secret scanning, and enforcement modes.
 *
 * @remarks
 * This is the top-level configuration for the guardrails system.
 * It can be included in the main ApexConfig to enable guardrails.
 *
 * @example
 * ```yaml
 * # .apex/config.yaml
 * guardrails:
 *   enabled: true
 *   enforcement: warn
 *   policies:
 *     enabled: true
 *     enforcement: warn
 *   secrets:
 *     enabled: true
 *     enforcement: block
 *     onDetection: mask
 *   reporting:
 *     enabled: true
 *     format: json
 * ```
 */
export const GuardrailConfigSchema = z.object({
  /** Whether guardrails are enabled globally */
  enabled: z.boolean().optional().default(true),

  /** Global enforcement mode for all guardrails */
  enforcement: EnforcementModeSchema.optional().default('warn'),

  /**
   * Policy enforcement configuration
   */
  policies: z.object({
    /** Whether policy enforcement is enabled */
    enabled: z.boolean().optional().default(true),
    /** Enforcement mode for policy violations */
    enforcement: EnforcementModeSchema.optional(),
    /** Path to policy files or directory */
    policyPath: z.string().optional(),
    /** Inline policy rules */
    rules: z.array(PolicyRuleSchema).optional().default([]),
  }).optional(),

  /**
   * Secret detection configuration
   */
  secrets: z.object({
    /** Whether secret detection is enabled */
    enabled: z.boolean().optional().default(true),
    /** Enforcement mode for secret detections */
    enforcement: EnforcementModeSchema.optional(),
    /** Behavior when secrets are detected */
    onDetection: SecretDetectionBehaviorSchema.optional().default('warn'),
    /** Include built-in secret patterns */
    includeBuiltInPatterns: z.boolean().optional().default(true),
    /** Custom secret patterns to detect */
    customPatterns: z.array(SecretPatternSchema).optional().default([]),
    /** Paths to exclude from secret scanning */
    excludePaths: z.array(z.string()).optional().default([]),
    /** File patterns to exclude from scanning */
    excludePatterns: z.array(z.string()).optional().default([]),
  }).optional(),

  /**
   * Reporting configuration for guardrail violations
   */
  reporting: z.object({
    /** Whether reporting is enabled */
    enabled: z.boolean().optional().default(true),
    /** Report format */
    format: z.enum(['json', 'text', 'sarif']).optional().default('json'),
    /** Output path for reports */
    outputPath: z.string().optional(),
    /** Whether to include context in reports */
    includeContext: z.boolean().optional().default(true),
    /** Maximum violations to include in report */
    maxViolations: z.number().int().positive().optional(),
  }).optional(),

  /**
   * Path access control configuration
   */
  pathAccess: z.object({
    /** Whether path access control is enabled */
    enabled: z.boolean().optional().default(true),
    /** Enforcement mode for path access violations */
    enforcement: EnforcementModeSchema.optional(),
    /** Allowed paths configuration */
    config: AllowedPathsConfigSchema.optional(),
  }).optional(),

  /**
   * Custom metadata for guardrails
   */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type GuardrailConfig = z.infer<typeof GuardrailConfigSchema>;

/**
 * Guardrail violation event (extends policy violation with guardrail context)
 */
export const GuardrailViolationSchema = z.object({
  /** Unique identifier for this violation */
  id: z.string(),
  /** Type of guardrail that was violated */
  guardrailType: z.enum(['policy', 'secret', 'path', 'custom']),
  /** The specific rule or pattern that was violated */
  rule: z.string(),
  /** Human-readable message describing the violation */
  message: z.string(),
  /** Severity of the violation */
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  /** Enforcement mode that applies to this violation */
  enforcement: EnforcementModeSchema,
  /** Whether this violation blocks further execution */
  blocking: z.boolean(),
  /** Resource or context that triggered the violation */
  resource: z.string().optional(),
  /** File path associated with the violation */
  filePath: z.string().optional(),
  /** Line number where the violation occurred */
  lineNumber: z.number().int().positive().optional(),
  /** Additional context about the violation */
  context: z.record(z.string(), z.unknown()).optional(),
  /** Timestamp when the violation occurred */
  timestamp: z.date(),
  /** Task ID associated with this violation */
  taskId: z.string().optional(),
  /** Agent ID that triggered this violation */
  agentId: z.string().optional(),
});
export type GuardrailViolation = z.infer<typeof GuardrailViolationSchema>;

/**
 * Result of guardrail evaluation
 */
export const GuardrailEvaluationResultSchema = z.object({
  /** Whether the evaluation passed (no blocking violations) */
  passed: z.boolean(),
  /** Whether execution was blocked */
  blocked: z.boolean(),
  /** Total number of violations */
  violationCount: z.number().int().min(0),
  /** Violations by severity */
  violationsBySeverity: z.object({
    critical: z.number().int().min(0),
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
  }),
  /** List of all violations */
  violations: z.array(GuardrailViolationSchema),
  /** Secret scan results (if applicable) */
  secretScanResult: SecretScanResultSchema.optional(),
  /** Policy check result (if applicable) */
  policyCheckResult: TaskPolicyCheckResultSchema.optional(),
  /** Timestamp when evaluation was performed */
  evaluatedAt: z.date(),
  /** Duration of evaluation in milliseconds */
  evaluationDurationMs: z.number().optional(),
});
export type GuardrailEvaluationResult = z.infer<typeof GuardrailEvaluationResultSchema>;

// ============================================================================
// Hook Configuration
// ============================================================================

/**
 * Hook types that define when hooks are triggered
 */
export const HookTypeSchema = z.enum([
  'before-task',     // Triggered before a task starts
  'after-task',      // Triggered after a task completes
  'before-stage',    // Triggered before a workflow stage starts
  'after-stage',     // Triggered after a workflow stage completes
  'before-commit',   // Triggered before code is committed
  'after-commit',    // Triggered after code is committed
  'before-push',     // Triggered before code is pushed
  'after-push',      // Triggered after code is pushed
  'on-error',        // Triggered when an error occurs
  'on-success',      // Triggered on successful completion
]);
export type HookType = z.infer<typeof HookTypeSchema>;

/**
 * Hook handler configuration
 * Can be either a file path or inline code
 */
export const HookHandlerSchema = z.union([
  // File path to script
  z.object({
    type: z.literal('file'),
    path: z.string().min(1, 'Handler file path is required'),
    args: z.array(z.string()).optional(),
  }),
  // Inline script content
  z.object({
    type: z.literal('inline'),
    code: z.string().min(1, 'Handler code is required'),
    language: z.enum(['bash', 'javascript', 'typescript']).optional().default('bash'),
  }),
]);
export type HookHandler = z.infer<typeof HookHandlerSchema>;

/**
 * Hook configuration schema
 * Defines when and how hooks are executed
 */
export const HookConfigSchema = z.object({
  /** Unique name for the hook */
  name: z.string().min(1, 'Hook name is required'),
  /** Hook type defining when it's triggered */
  type: HookTypeSchema,
  /** Hook handler configuration */
  handler: HookHandlerSchema,
  /** Priority for hook execution order (higher = earlier) */
  priority: z.number().int().optional().default(100),
  /** Whether this hook is enabled */
  enabled: z.boolean().optional().default(true),
  /** Optional description of what this hook does */
  description: z.string().optional(),
  /** Optional conditions for hook execution */
  conditions: z.object({
    /** Only run for specific workflow stages */
    stages: z.array(z.string()).optional(),
    /** Only run for specific agents */
    agents: z.array(z.string()).optional(),
    /** Only run for specific file patterns */
    filePatterns: z.array(z.string()).optional(),
    /** Environment variables that must be set */
    env: z.record(z.string(), z.string()).optional(),
  }).optional(),
  /** Hook timeout in milliseconds */
  timeoutMs: z.number().int().min(1000).optional().default(30000),
  /** Whether hook failure should fail the operation */
  failOnError: z.boolean().optional().default(true),
});
export type HookConfig = z.infer<typeof HookConfigSchema>;

// ============================================================================
// Tool Hook Configuration (v0.5.0)
// ============================================================================
// Tool hooks are triggered before (pre) and after (post) tool executions,
// allowing interception, modification, or cancellation of tool calls.

/**
 * Tool hook type enum - defines when the hook is triggered relative to tool execution
 * - 'pre': Triggered before a tool executes, can modify arguments or cancel
 * - 'post': Triggered after a tool executes, receives the result
 */
export const ToolHookTypeSchema = z.enum([
  'pre',   // Before tool execution - can modify args or cancel
  'post',  // After tool execution - receives result
]);
export type ToolHookType = z.infer<typeof ToolHookTypeSchema>;

/**
 * Tool hook definition schema
 * Defines a hook that runs before or after tool execution
 */
export const ToolHookDefinitionSchema = z.object({
  /** Unique name for this hook */
  name: z.string().min(1, 'Hook name is required'),
  /** Whether this is a pre or post execution hook */
  type: ToolHookTypeSchema,
  /** Path to the handler module/script */
  handlerPath: z.string().min(1, 'Handler path is required'),
  /** Priority for hook execution order (higher = earlier, default: 100) */
  priority: z.number().int().optional().default(100),
  /** Whether this hook is enabled (default: true) */
  enabled: z.boolean().optional().default(true),
  /** Optional description of what this hook does */
  description: z.string().optional(),
  /** Tool names this hook applies to (empty = all tools) */
  tools: z.array(z.string()).optional().default([]),
  /** Hook timeout in milliseconds (default: 30000) */
  timeoutMs: z.number().int().min(100).optional().default(30000),
  /** Whether hook failure should fail the tool execution (default: true for pre, false for post) */
  failOnError: z.boolean().optional(),
});
export type ToolHookDefinition = z.infer<typeof ToolHookDefinitionSchema>;

/**
 * Tool hook configuration for config.yaml
 * Contains arrays of pre and post tool hooks
 */
export const ToolHookConfigSchema = z.object({
  /** Pre-execution hooks that run before tools */
  pre: z.array(ToolHookDefinitionSchema).optional().default([]),
  /** Post-execution hooks that run after tools */
  post: z.array(ToolHookDefinitionSchema).optional().default([]),
  /** Global setting to enable/disable all tool hooks */
  enabled: z.boolean().optional().default(true),
  /** Default timeout for all hooks in milliseconds */
  defaultTimeoutMs: z.number().int().min(100).optional().default(30000),
});
export type ToolHookConfig = z.infer<typeof ToolHookConfigSchema>;

/**
 * Context provided to pre-execution hooks
 * Contains information available before tool execution
 */
export const PreHookContextSchema = z.object({
  /** Name of the tool being invoked */
  toolName: z.string(),
  /** Arguments being passed to the tool */
  arguments: z.record(z.string(), z.unknown()),
  /** Unique identifier for this tool invocation */
  invocationId: z.string(),
  /** Task ID that initiated this tool call (if any) */
  taskId: z.string().optional(),
  /** Agent name that is invoking the tool (if any) */
  agentName: z.string().optional(),
  /** Workflow stage when tool was invoked (if any) */
  stageName: z.string().optional(),
  /** Timestamp when the tool invocation was requested */
  timestamp: z.date(),
});
export type PreHookContext = z.infer<typeof PreHookContextSchema>;

/**
 * Context provided to post-execution hooks
 * Contains information available after tool execution including the result
 */
export const PostHookContextSchema = z.object({
  /** Name of the tool that was invoked */
  toolName: z.string(),
  /** Arguments that were passed to the tool */
  arguments: z.record(z.string(), z.unknown()),
  /** Unique identifier for this tool invocation */
  invocationId: z.string(),
  /** Task ID that initiated this tool call (if any) */
  taskId: z.string().optional(),
  /** Agent name that invoked the tool (if any) */
  agentName: z.string().optional(),
  /** Workflow stage when tool was invoked (if any) */
  stageName: z.string().optional(),
  /** Timestamp when the tool invocation was requested */
  timestamp: z.date(),
  /** Result from the tool execution */
  result: z.object({
    /** Whether the tool execution was successful */
    success: z.boolean(),
    /** Output data from the tool (if successful) */
    output: z.unknown().optional(),
    /** Error message (if failed) */
    error: z.string().optional(),
    /** Execution duration in milliseconds */
    duration: z.number().optional(),
  }),
});
export type PostHookContext = z.infer<typeof PostHookContextSchema>;

/**
 * Pre-hook action type - what action the hook wants to take
 * - 'continue': Proceed with tool execution using original or modified arguments
 * - 'modify': Proceed with tool execution using modified arguments (requires modifiedArguments)
 * - 'cancel': Cancel the tool execution entirely
 */
export const PreHookActionSchema = z.enum([
  'continue',  // Proceed with original arguments
  'modify',    // Proceed with modified arguments
  'cancel',    // Cancel tool execution
]);
export type PreHookAction = z.infer<typeof PreHookActionSchema>;

/**
 * Result returned from a pre-execution hook
 * Determines whether and how tool execution should proceed
 */
export const PreHookResultSchema = z.object({
  /** Action to take after hook execution */
  action: PreHookActionSchema,
  /** Modified arguments when action is 'modify' */
  modifiedArguments: z.record(z.string(), z.unknown()).optional(),
  /** Reason for the action (especially useful for 'cancel') */
  reason: z.string().optional(),
  /** Custom result to return when action is 'cancel' */
  cancelResult: z.object({
    success: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional(),
  }).optional(),
  /** Additional metadata from the hook */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PreHookResult = z.infer<typeof PreHookResultSchema>;

/**
 * Behavior mode for configurable tool hook actions
 * - 'warn': Emit event and pass output through unchanged
 * - 'block': Emit event and block/return error
 * - 'redact': Replace sensitive content with [REDACTED] placeholders
 */
export const BehaviorModeSchema = z.enum([
  'warn',   // Emit event, pass through unchanged
  'block',  // Emit event, block output with error
  'redact', // Replace secrets with [REDACTED]
]);
export type BehaviorMode = z.infer<typeof BehaviorModeSchema>;

/**
 * Event data for behavior mode actions
 * Emitted when warn, block, or redact behaviors are triggered
 */
export const BehaviorEventDataSchema = z.object({
  /** Type of behavior that was triggered */
  behaviorMode: BehaviorModeSchema,
  /** Tool name that triggered the behavior */
  toolName: z.string(),
  /** Reason why the behavior was triggered */
  reason: z.string(),
  /** Original tool output (may be redacted for security) */
  originalOutput: z.unknown().optional(),
  /** Modified output (for redact mode) */
  modifiedOutput: z.unknown().optional(),
  /** Timestamp when behavior was triggered */
  timestamp: z.date(),
  /** Task ID associated with this behavior */
  taskId: z.string().optional(),
  /** Additional context or metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type BehaviorEventData = z.infer<typeof BehaviorEventDataSchema>;

/**
 * Result returned from a post-execution hook
 * Can optionally modify the result before it's returned
 */
export const PostHookResultSchema = z.object({
  /** Whether to modify the original result */
  modifyResult: z.boolean().optional().default(false),
  /** Modified result (if modifyResult is true) */
  modifiedResult: z.object({
    success: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional(),
  }).optional(),
  /** Behavior mode to apply to the result */
  behaviorMode: BehaviorModeSchema.optional(),
  /** Reason for applying behavior mode */
  behaviorReason: z.string().optional(),
  /** Additional metadata from the hook */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PostHookResult = z.infer<typeof PostHookResultSchema>;

// ============================================================================
// Error Tracking and Fix Attempts (v0.5.0)
// ============================================================================

/**
 * Backoff strategy for retry delays
 */
export const BackoffStrategySchema = z.enum([
  'none',           // No delay between attempts
  'constant',       // Fixed delay (e.g., 5s every time)
  'linear',         // Linearly increasing delay (e.g., 5s, 10s, 15s)
  'exponential',    // Exponentially increasing delay (e.g., 5s, 10s, 20s, 40s)
]);
export type BackoffStrategy = z.infer<typeof BackoffStrategySchema>;

/**
 * Configuration for fix attempt tracking
 */
export const FixAttemptConfigSchema = z.object({
  /** Maximum attempts per unique error (default: 3) */
  maxAttemptsPerError: z.number().min(1).max(20).default(3),
  /** Maximum total fix attempts per task (default: 10) */
  maxTotalAttempts: z.number().min(1).max(100).default(10),
  /** Backoff strategy for retries (default: 'exponential') */
  backoffStrategy: BackoffStrategySchema.default('exponential'),
  /** Base delay in milliseconds for backoff (default: 1000) */
  baseDelayMs: z.number().min(0).max(60000).default(1000),
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs: z.number().min(0).max(300000).default(30000),
  /** Whether to consider similar errors as the same (default: true) */
  groupSimilarErrors: z.boolean().default(true),
  /** Similarity threshold for error grouping (0-1, default: 0.8) */
  similarityThreshold: z.number().min(0).max(1).default(0.8),
});
export type FixAttemptConfig = z.infer<typeof FixAttemptConfigSchema>;

/**
 * Unique identifier for an error instance
 */
export interface ErrorFingerprint {
  /** Hash of error message and context for deduplication */
  hash: string;
  /** Original error message */
  message: string;
  /** Error category */
  category: string;
  /** Optional file path where error occurred */
  filePath?: string;
  /** Optional line number */
  line?: number;
  /** Optional column number */
  column?: number;
  /** Error code if available (e.g., TS2322, ESLint rule) */
  code?: string;
}

/**
 * Snapshot of task state at time of fix attempt
 */
export interface FixAttemptSnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: Date;
  /** Current stage of the task */
  stage?: string;
  /** Current status of the task */
  status: TaskStatus;
  /** Files created or modified */
  files: {
    created: string[];
    modified: string[];
  };
  /** Usage statistics at this point */
  usage: TaskUsage;
  /** Number of active errors */
  errorCount: number;
}

/**
 * Record of a single fix attempt
 */
export interface FixAttempt {
  /** Unique identifier for this fix attempt */
  id: string;
  /** ID of the task this attempt belongs to */
  taskId: string;
  /** Sequential number within the task (1-based) */
  attemptNumber: number;
  /** Error being fixed */
  error: ErrorFingerprint;
  /** Timestamp when fix attempt started */
  startedAt: Date;
  /** Timestamp when fix attempt completed */
  completedAt?: Date;
  /** Description of the fix approach taken */
  approach: string;
  /** Agent that performed the fix */
  agent?: string;
  /** Stage where the fix was attempted */
  stage?: string;
  /** State before the fix */
  beforeState?: FixAttemptSnapshot;
  /** State after the fix */
  afterState?: FixAttemptSnapshot;
  /** Result of the fix attempt */
  result: {
    /** Whether the fix was applied successfully (no errors during fix) */
    success: boolean;
    /** Whether the original error was resolved */
    resolved: boolean;
    /** Reason if not resolved */
    reason?: string;
    /** New errors introduced by the fix (if any) */
    newErrors?: ErrorFingerprint[];
  };
  /** Delay applied before this attempt (backoff) */
  delayAppliedMs?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated history of fix attempts for a task
 */
export interface FixAttemptHistory {
  /** All fix attempt entries */
  entries: FixAttempt[];
  /** Total number of fix attempts */
  totalAttempts: number;
  /** Number of successful resolutions */
  resolvedCount: number;
  /** Number of failed attempts */
  failedCount: number;
  /** Timestamp of the most recent attempt */
  lastAttemptAt?: Date;
  /** Current error being worked on (if any) */
  currentError?: {
    fingerprint: ErrorFingerprint;
    attemptCount: number;
    firstSeenAt: Date;
    lastAttemptAt: Date;
  };
  /** Map of error fingerprint hashes to attempt counts */
  errorAttemptCounts: Record<string, number>;
}

/**
 * Result of checking if a fix should be attempted
 */
export interface FixAttemptDecision {
  /** Whether to proceed with the fix */
  shouldAttempt: boolean;
  /** If not attempting, the reason why */
  reason?: 'max_per_error' | 'max_total' | 'backoff_active' | 'loop_detected';
  /** If backoff is active, when the next attempt can be made */
  retryAfter?: Date;
  /** Current attempt count for this error */
  attemptCount: number;
  /** Maximum attempts allowed for this error */
  maxAttempts: number;
  /** Delay to apply before this attempt (if proceeding) */
  suggestedDelayMs?: number;
}

/**
 * Loop detection result
 */
export interface LoopDetectionResult {
  /** Whether a loop was detected */
  loopDetected: boolean;
  /** Type of loop if detected */
  loopType?: 'same_error' | 'circular_fixes' | 'oscillating_state';
  /** Detailed description of the loop */
  description?: string;
  /** Errors involved in the loop pattern */
  involvedErrors?: ErrorFingerprint[];
  /** Suggested action to break the loop */
  suggestedAction?: string;
}

// ============================================================================
// Audit Log Types (v0.5.0)
// ============================================================================

/**
 * Audit log event types for tracking significant system events
 */
export const AuditEventTypeSchema = z.enum([
  // Task lifecycle events
  'task.created',
  'task.started',
  'task.completed',
  'task.failed',
  'task.cancelled',
  'task.paused',
  'task.resumed',
  'task.trashed',
  'task.restored',
  'task.archived',

  // Agent events
  'agent.started',
  'agent.completed',
  'agent.failed',
  'agent.handoff',

  // Approval events
  'approval.requested',
  'approval.granted',
  'approval.denied',
  'approval.timeout',

  // Configuration events
  'config.updated',
  'permission.granted',
  'permission.revoked',

  // Tool events
  'tool.executed',
  'tool.undone',

  // Security events
  'security.policy_violation',
  'security.rate_limited',
]);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

/**
 * Severity levels for audit log entries
 */
export const AuditSeveritySchema = z.enum(['debug', 'info', 'warn', 'error', 'critical']);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

/**
 * Audit log entry schema for tracking significant system events
 * Provides comprehensive context for compliance, debugging, and security monitoring
 */
export const AuditLogEntrySchema = z.object({
  /** Unique identifier for the audit log entry */
  id: z.string().min(1),

  /** Associated task ID (optional - some events are system-wide) */
  taskId: z.string().optional(),

  /** Type of event being logged */
  eventType: AuditEventTypeSchema,

  /** Severity level of the event */
  severity: AuditSeveritySchema,

  /** ISO 8601 timestamp when the event occurred */
  timestamp: z.date(),

  /** Actor that triggered the event (user, agent, system) */
  actor: z.string(),

  /** Human-readable description of the event */
  message: z.string(),

  /** Stage during which the event occurred (if applicable) */
  stage: z.string().optional(),

  /** Agent that was active when the event occurred (if applicable) */
  agent: z.string().optional(),

  /** Structured metadata about the event (JSON serialized in DB) */
  metadata: z.record(z.unknown()).optional(),

  /** Previous state before the event (for state changes) */
  previousState: z.string().optional(),

  /** New state after the event (for state changes) */
  newState: z.string().optional(),

  /** Duration of the operation in milliseconds (if applicable) */
  durationMs: z.number().optional(),

  /** Whether the event was successful */
  success: z.boolean().default(true),

  /** Error details if the event represents a failure */
  error: z.string().optional(),

  /** Correlation ID for linking related events */
  correlationId: z.string().optional(),

  /** Session ID for grouping events within a session */
  sessionId: z.string().optional(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// ============================================================================
// AutoFix Configuration and Events
// ============================================================================

/**
 * Configuration for auto-fix functionality
 * Controls which types of fixes can be automatically applied
 */
export const AutoFixConfigSchema = z.object({
  /** Whether auto-fix functionality is enabled globally */
  enabled: z.boolean().optional().default(false),

  /** Configuration for syntax error fixes */
  syntax: z.object({
    /** Whether to automatically fix syntax errors */
    enabled: z.boolean().optional().default(false),
    /** Types of syntax errors to auto-fix */
    types: z.array(z.enum(['missing_semicolons', 'missing_brackets', 'indentation', 'quotes'])).optional().default([]),
  }).optional(),

  /** Configuration for import/require fixes */
  imports: z.object({
    /** Whether to automatically fix import/require statements */
    enabled: z.boolean().optional().default(false),
    /** Whether to add missing imports */
    addMissing: z.boolean().optional().default(false),
    /** Whether to remove unused imports */
    removeUnused: z.boolean().optional().default(false),
    /** Whether to sort imports */
    sort: z.boolean().optional().default(false),
  }).optional(),
});
export type AutoFixConfig = z.infer<typeof AutoFixConfigSchema>;

/**
 * Result of an auto-fix operation
 * Contains information about what was fixed and the outcome
 */
export const AutoFixResultSchema = z.object({
  /** Unique identifier for this auto-fix operation */
  id: z.string().min(1),

  /** ID of the task this auto-fix belongs to */
  taskId: z.string().min(1),

  /** Absolute path of the file that was fixed */
  filePath: z.string().min(1),

  /** Type of fix that was applied */
  fixType: z.enum(['syntax', 'imports', 'formatting']),

  /** Whether the fix was successful */
  success: z.boolean(),

  /** Detailed description of what was fixed */
  description: z.string(),

  /** Number of issues that were fixed */
  issuesFixed: z.number().min(0).default(0),

  /** Error message if the fix failed */
  error: z.string().optional(),

  /** Timestamp when the fix was applied */
  timestamp: z.date(),

  /** Original file content before the fix */
  originalContent: z.string().optional(),

  /** File content after the fix */
  fixedContent: z.string().optional(),

  /** Additional metadata about the fix operation */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AutoFixResult = z.infer<typeof AutoFixResultSchema>;

/**
 * Event types for auto-fix operations
 */
export const AutoFixEventTypeSchema = z.enum([
  'auto-fix-start',      // Auto-fix operation began
  'auto-fix-progress',   // Auto-fix operation progress update
  'auto-fix-complete',   // Auto-fix operation completed successfully
  'auto-fix-error',      // Auto-fix operation failed
]);
export type AutoFixEventType = z.infer<typeof AutoFixEventTypeSchema>;

/**
 * Status types for auto-fix operations
 */
export const AutoFixStatusSchema = z.enum([
  'running',    // Auto-fix operation is in progress
  'success',    // Auto-fix operation completed successfully
  'failed',     // Auto-fix operation failed
]);
export type AutoFixStatus = z.infer<typeof AutoFixStatusSchema>;

/**
 * Details of an issue that was fixed during auto-fix
 */
export const AutoFixIssueDetailSchema = z.object({
  /** Type of issue that was fixed */
  type: z.string(),
  /** Description of the issue */
  description: z.string(),
  /** File path where the issue was found */
  filePath: z.string(),
  /** Line number where the issue was found (optional) */
  line: z.number().optional(),
  /** Column number where the issue was found (optional) */
  column: z.number().optional(),
  /** Severity of the issue */
  severity: z.enum(['error', 'warning', 'info']).optional(),
});
export type AutoFixIssueDetail = z.infer<typeof AutoFixIssueDetailSchema>;

/**
 * Event record for auto-fix operations
 * Tracks the lifecycle of auto-fix operations for auditing and debugging
 */
export const AutoFixEventSchema = z.object({
  /** Unique identifier for this auto-fix event */
  id: z.string().min(1),

  /** Type of auto-fix event */
  eventType: AutoFixEventTypeSchema,

  /** ID of the task this auto-fix event belongs to */
  taskId: z.string().min(1),

  /** List of files that were modified during this auto-fix operation */
  filesModified: z.array(z.string()),

  /** Array of issues that were fixed with detailed information */
  issuesFixed: z.array(AutoFixIssueDetailSchema),

  /** Current iteration number in the auto-fix process */
  iterationCount: z.number().min(0),

  /** Total number of iterations planned for this auto-fix process */
  totalIterations: z.number().min(1),

  /** Currently active file being processed */
  currentFile: z.string(),

  /** Current status of the auto-fix operation */
  status: AutoFixStatusSchema,

  /** Timestamp when this event occurred */
  timestamp: z.date(),

  /** Error message if the operation failed */
  error: z.string().optional(),

  /** Additional metadata about the operation */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AutoFixEvent = z.infer<typeof AutoFixEventSchema>;

// ============================================================================
// APEX Rules (.apexrules) Types
// ============================================================================

export type RuleTriggerEvent = 'task.start' | 'task.update' | 'tool.use' | 'git.commit' | 'git.push' | 'agent.thought';

export interface RuleTrigger {
  event: RuleTriggerEvent;
  // Optional tool name for tool.use triggers
  toolName?: string;
}

export interface RuleCondition {
  expression: string; // Use a string-based expression for initial implementation
}

export type RuleActionType = 'block' | 'warn' | 'inject_prompt';

export interface RuleAction {
  type: RuleActionType;
  message?: string; // Message for block, warn actions
  prompt?: string;  // Prompt to inject for inject_prompt action
  // Future: metadata?: Record<string, unknown>;
}

export interface ApexRule {
  name: string;
  description?: string;
  trigger: RuleTrigger;
  condition?: RuleCondition;
  action: RuleAction;
  enabled?: boolean;
}

export const RuleTriggerEventSchema = z.enum(['task.start', 'task.update', 'tool.use', 'git.commit', 'git.push', 'agent.thought']);
export const RuleTriggerSchema = z.object({
  event: RuleTriggerEventSchema,
  toolName: z.string().optional(), // For tool.use event
  // Add other event-specific fields as needed
});

export const RuleConditionSchema = z.object({
  expression: z.string(),
});

export const RuleActionTypeSchema = z.enum(['block', 'warn', 'inject_prompt']);
export const RuleActionSchema = z.object({
  type: RuleActionTypeSchema,
  message: z.string().optional(),
  prompt: z.string().optional(),
});

export const ApexRuleSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  trigger: RuleTriggerSchema,
  condition: RuleConditionSchema.optional(),
  action: RuleActionSchema,
  enabled: z.boolean().optional().default(true),
});

// ============================================================================
// Screenshot Comparison
// ============================================================================

/** Legacy alias for backward compatibility */
export const ScreenshotComparisonOptionsSchema = VisualRegressionConfigSchema;
export type ScreenshotComparisonOptions = z.infer<typeof ScreenshotComparisonOptionsSchema>;

/**
 * Result of a screenshot comparison operation
 */
export const ScreenshotComparisonResultSchema = z.object({
  /** Similarity score between 0 (completely different) and 1 (identical) */
  similarity: z.number().min(0).max(1),
  /** Number of different pixels */
  differentPixels: z.number().min(0),
  /** Total number of pixels compared */
  totalPixels: z.number().min(1),
  /** Whether the images pass the similarity threshold */
  isMatch: z.boolean(),
  /** Path to diff image if generated */
  diffImagePath: z.string().optional(),
});
export type ScreenshotComparisonResult = z.infer<typeof ScreenshotComparisonResultSchema>;

/**
 * Image metadata for screenshot comparison
 */
export const ImageMetadataSchema = z.object({
  /** Image width in pixels */
  width: z.number().min(1),
  /** Image height in pixels */
  height: z.number().min(1),
  /** Number of color channels (3 for RGB, 4 for RGBA) */
  channels: z.number().min(3).max(4),
  /** File path or identifier */
  path: z.string(),
});
export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;

// ----------------------------------------------------------------------------
// Screenshot Capture Options & Results
// ----------------------------------------------------------------------------

/**
 * Supported screenshot image formats
 */
export const ScreenshotFormatSchema = z.enum(['png', 'jpeg']);
export type ScreenshotFormat = z.infer<typeof ScreenshotFormatSchema>;

/**
 * Screenshot output mode - determines how the screenshot is returned
 */
export const ScreenshotOutputModeSchema = z.enum(['buffer', 'file']);
export type ScreenshotOutputMode = z.infer<typeof ScreenshotOutputModeSchema>;

/**
 * Options for capturing screenshots
 * Used by browser automation tools to configure screenshot capture behavior
 */
export const ScreenshotOptionsSchema = z.object({
  /** Image format for the screenshot (default: 'png') */
  format: ScreenshotFormatSchema.optional().default('png'),

  /** Image quality (1-100), only applicable for JPEG format (default: 80) */
  quality: z.number().int().min(1).max(100).optional().default(80),

  /** How to return the screenshot - as a buffer or saved to file */
  output: ScreenshotOutputModeSchema.optional().default('buffer'),

  /** File path to save the screenshot (required when output is 'file') */
  path: z.string().optional(),

  /** Whether to capture the full scrollable page (default: false) */
  fullPage: z.boolean().optional().default(false),

  /** Whether to hide default white background and allow capturing with transparency (PNG only) */
  omitBackground: z.boolean().optional().default(false),
}).refine(
  (data) => data.output !== 'file' || (data.output === 'file' && data.path !== undefined),
  { message: "Path is required when output mode is 'file'", path: ['path'] }
);
export type ScreenshotOptions = z.infer<typeof ScreenshotOptionsSchema>;

/**
 * Result of a screenshot capture operation
 * Contains either the image buffer or file path, along with dimensions
 */
export const ScreenshotResultSchema = z.object({
  /** Image data as a Buffer (present when output mode is 'buffer') */
  buffer: z.instanceof(Buffer).optional(),

  /** File path where screenshot was saved (present when output mode is 'file') */
  path: z.string().optional(),

  /** Width of the captured screenshot in pixels */
  width: z.number().int().min(1),

  /** Height of the captured screenshot in pixels */
  height: z.number().int().min(1),

  /** Format of the captured image */
  format: ScreenshotFormatSchema.optional(),

  /** Timestamp when the screenshot was captured */
  capturedAt: z.date().optional(),
}).refine(
  (data) => data.buffer !== undefined || data.path !== undefined,
  { message: 'Either buffer or path must be provided' }
);
export type ScreenshotResult = z.infer<typeof ScreenshotResultSchema>;

/**
 * Options for capturing a screenshot of a specific element
 * Extends base screenshot options with element selector
 */
export const CaptureElementOptionsSchema = ScreenshotOptionsSchema.innerType().extend({
  /** CSS selector for the element to capture */
  selector: z.string().min(1, 'Selector is required'),

  /** Padding around the element in pixels (default: 0) */
  padding: z.number().int().min(0).optional().default(0),
});
export type CaptureElementOptions = z.infer<typeof CaptureElementOptionsSchema>;

/**
 * Options for capturing a screenshot of a specific viewport region
 */
export const CaptureRegionOptionsSchema = ScreenshotOptionsSchema.innerType().extend({
  /** X coordinate of the region's top-left corner */
  x: z.number().int().min(0),

  /** Y coordinate of the region's top-left corner */
  y: z.number().int().min(0),

  /** Width of the region to capture */
  width: z.number().int().min(1),

  /** Height of the region to capture */
  height: z.number().int().min(1),
});
export type CaptureRegionOptions = z.infer<typeof CaptureRegionOptionsSchema>;

// ============================================================================
// Tool Execution Hooks
// ============================================================================

/**
 * Context provided to onToolStart hooks
 * Contains information available at tool execution start
 */
export const ToolStartHookContextSchema = z.object({
  /** Name of the tool being executed */
  toolName: z.string().min(1),
  /** Input parameters passed to the tool */
  input: z.record(z.string(), z.unknown()),
  /** Unique identifier for this tool call */
  callId: z.string().min(1),
  /** Task ID that initiated this tool call */
  taskId: z.string().min(1),
  /** Timestamp when the tool execution started */
  timestamp: z.date(),
  /** Agent name executing the tool (if available) */
  agentName: z.string().optional(),
  /** Workflow stage name (if available) */
  stageName: z.string().optional(),
});
export type ToolStartHookContext = z.infer<typeof ToolStartHookContextSchema>;

/**
 * Context provided to onToolComplete hooks
 * Contains full execution details including result
 */
export const ToolCompleteHookContextSchema = z.object({
  /** Name of the tool that was executed */
  toolName: z.string().min(1),
  /** Input parameters that were passed to the tool */
  input: z.record(z.string(), z.unknown()),
  /** Unique identifier for this tool call */
  callId: z.string().min(1),
  /** Task ID that initiated this tool call */
  taskId: z.string().min(1),
  /** Timestamp when the tool execution completed */
  timestamp: z.date(),
  /** Result of the tool execution */
  result: z.object({
    success: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional(),
  }),
  /** Timing information */
  timing: z.object({
    startTime: z.date(),
    endTime: z.date(),
    duration: z.number().min(0),
  }),
  /** Agent name that executed the tool (if available) */
  agentName: z.string().optional(),
  /** Workflow stage name (if available) */
  stageName: z.string().optional(),
});
export type ToolCompleteHookContext = z.infer<typeof ToolCompleteHookContextSchema>;

/**
 * Context provided to onToolError hooks
 * Focused on error details for failed tool executions
 */
export const ToolErrorHookContextSchema = z.object({
  /** Name of the tool that failed */
  toolName: z.string().min(1),
  /** Input parameters that were passed to the tool */
  input: z.record(z.string(), z.unknown()),
  /** Unique identifier for this tool call */
  callId: z.string().min(1),
  /** Task ID that initiated this tool call */
  taskId: z.string().min(1),
  /** Timestamp when the error occurred */
  timestamp: z.date(),
  /** Error message describing the failure */
  error: z.string().min(1),
  /** Timing information (if available) */
  timing: z.object({
    startTime: z.date(),
    endTime: z.date(),
    duration: z.number().min(0),
  }).optional(),
  /** Agent name that executed the tool (if available) */
  agentName: z.string().optional(),
  /** Workflow stage name (if available) */
  stageName: z.string().optional(),
});
export type ToolErrorHookContext = z.infer<typeof ToolErrorHookContextSchema>;

/**
 * Callback types for hook registration
 */
export type ToolStartHookCallback = (context: ToolStartHookContext) => void;
export type ToolCompleteHookCallback = (context: ToolCompleteHookContext) => void;
export type ToolErrorHookCallback = (context: ToolErrorHookContext) => void;

// ============================================================================
// Screenshot API Types (v0.5.0)
// ============================================================================

/**
 * Screenshot API request for viewport capture
 */
export const ScreenshotViewportRequestSchema = z.object({
  url: z.string().url(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(0).max(100).optional(),
  omitBackground: z.boolean().optional(),
  viewport: z.object({
    width: z.number().min(100).max(4000),
    height: z.number().min(100).max(4000),
  }).optional(),
  savePath: z.string().optional(),
});
export type ScreenshotViewportRequest = z.infer<typeof ScreenshotViewportRequestSchema>;

/**
 * Screenshot API request for full page capture
 */
export const ScreenshotFullPageRequestSchema = z.object({
  url: z.string().url(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(0).max(100).optional(),
  omitBackground: z.boolean().optional(),
  viewport: z.object({
    width: z.number().min(100).max(4000),
    height: z.number().min(100).max(4000),
  }).optional(),
  savePath: z.string().optional(),
});
export type ScreenshotFullPageRequest = z.infer<typeof ScreenshotFullPageRequestSchema>;

/**
 * Screenshot API request for element capture
 */
export const ScreenshotElementRequestSchema = z.object({
  url: z.string().url(),
  selector: z.string().min(1),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(0).max(100).optional(),
  omitBackground: z.boolean().optional(),
  timeout: z.number().min(1000).max(60000).optional(),
  viewport: z.object({
    width: z.number().min(100).max(4000),
    height: z.number().min(100).max(4000),
  }).optional(),
  savePath: z.string().optional(),
});
export type ScreenshotElementRequest = z.infer<typeof ScreenshotElementRequestSchema>;

/**
 * Screenshot API response
 */
export const ScreenshotResponseSchema = z.object({
  success: z.boolean(),
  format: z.string().optional(),
  duration: z.number().min(0).optional(),
  filePath: z.string().optional(),
  dimensions: z.object({
    width: z.number().min(1),
    height: z.number().min(1),
  }).optional(),
  error: z.string().optional(),
});
export type ScreenshotResponse = z.infer<typeof ScreenshotResponseSchema>;

// ----------------------------------------------------------------------------
// Test Report Types
// ----------------------------------------------------------------------------

/**
 * Visual comparison information for test reports
 */
export const TestVisualComparisonSchema = z.object({
  /** Path to baseline image */
  baseline: z.string().optional(),
  /** Path to actual image */
  actual: z.string().optional(),
  /** Percentage of pixels that differ (0-100) */
  diffPercentage: z.number().min(0).max(100),
  /** Threshold percentage for acceptable difference (0-100) */
  threshold: z.number().min(0).max(100),
  /** Whether the comparison passed */
  passed: z.boolean(),
  /** Path to diff image if generated */
  diffImage: z.string().optional(),
  /** Timestamp when comparison occurred */
  timestamp: z.date().optional(),
  /** URL of the page being compared (if applicable) */
  pageUrl: z.string().optional(),
  /** CSS selector if element-specific comparison */
  selector: z.string().optional(),
});
export type TestVisualComparison = z.infer<typeof TestVisualComparisonSchema>;

/**
 * Test artifact information
 */
export const TestArtifactSchema = z.object({
  /** Type of artifact */
  type: z.enum(['screenshot', 'diff', 'log', 'video', 'trace']),
  /** File path to the artifact */
  path: z.string().min(1),
  /** Test ID this artifact belongs to */
  testId: z.string().min(1),
  /** Human-readable description of the artifact */
  description: z.string().min(1),
  /** Size of the artifact file in bytes */
  size: z.number().min(0).optional(),
  /** MIME type of the artifact */
  mimeType: z.string().optional(),
});
export type TestArtifact = z.infer<typeof TestArtifactSchema>;

/**
 * Individual test result information
 */
export const TestResultSchema = z.object({
  /** Unique identifier for the test */
  testId: z.string().min(1),
  /** Name or title of the test */
  name: z.string().min(1),
  /** Test category */
  category: z.enum(['functional', 'visual', 'integration', 'unit', 'e2e', 'performance']),
  /** Test execution status */
  status: z.enum(['passed', 'failed', 'skipped', 'pending']),
  /** Execution time in milliseconds */
  executionTime: z.number().min(0),
  /** Visual comparison data if this is a visual test */
  visualComparison: TestVisualComparisonSchema.optional(),
  /** Error details if the test failed */
  errorDetails: z.string().optional(),
  /** Stack trace if the test failed */
  stackTrace: z.string().optional(),
  /** Tags associated with the test */
  tags: z.array(z.string()).optional(),
});
export type TestResult = z.infer<typeof TestResultSchema>;

/**
 * Visual regression summary statistics
 */
export const VisualRegressionSummarySchema = z.object({
  /** Total number of visual comparisons performed */
  totalComparisons: z.number().min(0),
  /** Number of comparisons that passed */
  passedComparisons: z.number().min(0),
  /** Number of comparisons that failed */
  failedComparisons: z.number().min(0),
  /** Average difference percentage across all comparisons */
  averageDiffPercentage: z.number().min(0).max(100),
  /** Number of comparisons that exceeded threshold */
  thresholdViolations: z.number().min(0),
  /** Number of diff images generated */
  diffImageCount: z.number().min(0),
  /** Most significant regression (highest diff percentage) */
  maxDiffPercentage: z.number().min(0).max(100).optional(),
  /** Baseline coverage percentage */
  baselineCoverage: z.number().min(0).max(100).optional(),
});
export type VisualRegressionSummary = z.infer<typeof VisualRegressionSummarySchema>;

/**
 * Test execution summary statistics
 */
export const TestSummarySchema = z.object({
  /** Name of the test suite */
  testSuite: z.string().min(1),
  /** Total number of tests executed */
  totalTests: z.number().min(0),
  /** Number of tests that passed */
  passedTests: z.number().min(0),
  /** Number of tests that failed */
  failedTests: z.number().min(0),
  /** Number of tests that were skipped */
  skippedTests: z.number().min(0),
  /** Number of tests that are pending */
  pendingTests: z.number().min(0).optional(),
  /** Pass rate as a percentage (0-100) */
  passRate: z.number().min(0).max(100),
  /** Total execution time in milliseconds */
  executionTime: z.number().min(0),
  /** Timestamp when the test execution started */
  timestamp: z.date(),
  /** Environment where tests were executed */
  environment: z.string().optional(),
  /** Version of the application under test */
  version: z.string().optional(),
});
export type TestSummary = z.infer<typeof TestSummarySchema>;

/**
 * Comprehensive test execution report
 * Includes summary statistics, visual regression data, detailed test results, and artifacts
 */
export const TestReportSchema = z.object({
  /** Unique identifier for this test report */
  reportId: z.string().min(1),
  /** Task ID associated with this test execution */
  taskId: z.string().min(1).optional(),
  /** Name of the agent that generated this report */
  agentName: z.string().min(1).optional(),
  /** Test execution summary */
  summary: TestSummarySchema,
  /** Visual regression testing summary (if any visual tests were run) */
  visualRegression: VisualRegressionSummarySchema.optional(),
  /** Array of visual comparison results */
  visualComparisons: z.array(TestVisualComparisonSchema).optional(),
  /** Detailed results for each test */
  testResults: z.array(TestResultSchema),
  /** Test artifacts (screenshots, diff images, logs, etc.) */
  artifacts: z.array(TestArtifactSchema),
  /** Additional metadata about the test execution */
  metadata: z.record(z.string(), z.any()).optional(),
  /** Timestamp when the report was generated */
  generatedAt: z.date(),
  /** Version of the test report schema */
  schemaVersion: z.string().optional().default('1.0.0'),
});
export type TestReport = z.infer<typeof TestReportSchema>;
