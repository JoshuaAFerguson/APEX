/**
 * @fileoverview Agent Error Fixtures
 *
 * Error scenarios for Claude Agent SDK and orchestrator testing.
 * Provides realistic error conditions that can occur during agent operations.
 */

import { ApexError, ApexErrorCode } from '../../apex-error.js';
import type { ErrorSimulationOptions } from '../types.js';

/**
 * Claude Agent SDK error scenarios
 */
export const ClaudeAgentErrors = {
  /** Session context window limits */
  contextWindowExceeded: new Error(
    'Session limit reached: Context window utilization is 95%. Consider starting a new session or summarizing the conversation.'
  ),

  /** Budget and usage limits */
  budgetExceeded: new Error(
    'Task exceeded budget limit of $50.00. Current usage: $52.30'
  ),

  dailyLimitReached: new Error(
    'Daily usage limit reached. Limit resets at midnight UTC.'
  ),

  /** Model availability issues */
  modelUnavailable: new Error(
    'Model "opus" is temporarily unavailable. Try again later or use "sonnet"'
  ),

  modelOverloaded: new Error(
    'Model is experiencing high demand. Request queued.'
  ),

  /** Authentication and authorization */
  invalidApiKey: new Error(
    'Invalid API key. Please check your authentication credentials.'
  ),

  insufficientPermissions: new Error(
    'Insufficient permissions for this operation. Contact your administrator.'
  ),

  /** Network and connectivity */
  networkTimeout: new Error(
    'Network timeout after 30 seconds. Please check your connection.'
  ),

  serviceUnavailable: new Error(
    'Claude API service is temporarily unavailable. Status: 503'
  ),

  /** Rate limiting */
  rateLimitExceeded: new Error(
    'Rate limit exceeded. Requests per minute: 60/50. Retry after 42 seconds.'
  ),

  /** Input validation */
  invalidInput: new Error(
    'Invalid input: Message exceeds maximum length of 200,000 characters'
  ),

  unsupportedContentType: new Error(
    'Unsupported content type. Expected text/plain or application/json'
  ),

  /** Tool execution errors */
  toolExecutionFailed: new Error(
    'Tool execution failed: Read tool returned non-zero exit code'
  ),

  toolNotFound: new Error(
    'Tool not found: "CustomTool" is not registered in the current session'
  ),

  toolTimeout: new Error(
    'Tool execution timed out after 120 seconds'
  ),

  /** Workflow and orchestration errors */
  workflowValidationFailed: new Error(
    'Workflow validation failed: Missing required stage "testing"'
  ),

  agentHandoffFailed: new Error(
    'Agent handoff failed: Target agent "reviewer" is not available'
  ),

  stageExecutionFailed: new Error(
    'Stage execution failed: "implementation" stage returned error'
  ),
} as const;

/**
 * APEX-specific error scenarios using ApexError class
 */
export const ApexErrors = {
  /** Configuration errors */
  configNotFound: new ApexError(
    ApexErrorCode.CONFIG_NOT_FOUND,
    'APEX configuration not found',
    { path: '.apex/config.yaml' }
  ),

  configInvalid: new ApexError(
    ApexErrorCode.CONFIG_INVALID,
    'Invalid configuration format',
    { errors: ['missing required field: project_name'] }
  ),

  /** Project errors */
  projectNotInitialized: new ApexError(
    ApexErrorCode.PROJECT_NOT_INITIALIZED,
    'Project not initialized. Run "apex init" first.',
    { directory: '/current/path' }
  ),

  /** Workflow errors */
  workflowNotFound: new ApexError(
    ApexErrorCode.WORKFLOW_NOT_FOUND,
    'Workflow not found: "custom-flow"',
    { workflow: 'custom-flow', available: ['feature', 'hotfix', 'bugfix'] }
  ),

  /** Agent errors */
  agentNotFound: new ApexError(
    ApexErrorCode.AGENT_NOT_FOUND,
    'Agent not found: "custom-agent"',
    { agent: 'custom-agent', available: ['planner', 'developer', 'tester'] }
  ),

  /** Task errors */
  taskNotFound: new ApexError(
    ApexErrorCode.TASK_NOT_FOUND,
    'Task not found: "task-12345"',
    { taskId: 'task-12345' }
  ),

  taskExecutionFailed: new ApexError(
    ApexErrorCode.TASK_EXECUTION_FAILED,
    'Task execution failed in stage "implementation"',
    { taskId: 'task-67890', stage: 'implementation', error: 'Tool execution timeout' }
  ),

  /** Tool errors */
  toolExecutionFailed: new ApexError(
    ApexErrorCode.TOOL_EXECUTION_FAILED,
    'Tool execution failed: Read',
    { tool: 'Read', error: 'File not found' }
  ),

  /** Permission errors */
  permissionDenied: new ApexError(
    ApexErrorCode.PERMISSION_DENIED,
    'Permission denied for operation',
    { operation: 'file_write', path: '/restricted/file.txt' }
  ),

  /** Validation errors */
  validationFailed: new ApexError(
    ApexErrorCode.VALIDATION_FAILED,
    'Input validation failed',
    { field: 'task.description', reason: 'required' }
  ),
} as const;

/**
 * Network and infrastructure errors
 */
export const InfrastructureErrors = {
  /** Database errors */
  databaseConnectionFailed: new Error(
    'Database connection failed: Unable to connect to SQLite database at .apex/apex.db'
  ),

  databaseLocked: new Error(
    'Database is locked by another process. Please wait and try again.'
  ),

  databaseCorrupted: new Error(
    'Database file is corrupted. Consider restoring from backup.'
  ),

  /** File system errors */
  diskSpaceFull: new Error(
    'Insufficient disk space. Required: 100MB, Available: 50MB'
  ),

  fileSystemPermission: new Error(
    'Permission denied: Unable to create directory .apex/'
  ),

  /** Git repository errors */
  gitNotFound: new Error(
    'Git not found in PATH. Please install Git to use APEX.'
  ),

  gitRepoNotClean: new Error(
    'Git repository has uncommitted changes. Please commit or stash changes first.'
  ),

  gitBranchConflict: new Error(
    'Branch "apex/feature-123" already exists. Use --force to override.'
  ),

  /** MCP server errors */
  mcpServerStartFailed: new Error(
    'Failed to start MCP server: Port 8080 is already in use'
  ),

  mcpServerCrashed: new Error(
    'MCP server crashed unexpectedly. Exit code: 1'
  ),

  mcpConnectionLost: new Error(
    'Lost connection to MCP server. Attempting to reconnect...'
  ),
} as const;

/**
 * Utility functions for creating custom error scenarios
 */

/**
 * Creates a timeout error with custom duration
 */
export const createTimeoutError = (operation: string, timeoutMs: number): Error =>
  new Error(`Operation timed out: ${operation} after ${timeoutMs}ms`);

/**
 * Creates a validation error with field details
 */
export const createValidationError = (field: string, reason: string): ApexError =>
  new ApexError(
    ApexErrorCode.VALIDATION_FAILED,
    `Validation failed for field: ${field}`,
    { field, reason, timestamp: new Date().toISOString() }
  );

/**
 * Creates a resource not found error
 */
export const createResourceNotFoundError = (resource: string, id: string): ApexError =>
  new ApexError(
    ApexErrorCode.TASK_NOT_FOUND, // Reusing for generic not found
    `${resource} not found: ${id}`,
    { resource, id, timestamp: new Date().toISOString() }
  );

/**
 * Creates a permission denied error with context
 */
export const createPermissionError = (operation: string, context?: Record<string, unknown>): ApexError =>
  new ApexError(
    ApexErrorCode.PERMISSION_DENIED,
    `Permission denied: ${operation}`,
    { operation, timestamp: new Date().toISOString(), ...context }
  );

/**
 * Error preset collections organized by category
 */
export const AgentErrorPresets = {
  /** Claude SDK errors */
  claude: {
    contextLimit: () => ClaudeAgentErrors.contextWindowExceeded,
    budgetExceeded: () => ClaudeAgentErrors.budgetExceeded,
    modelUnavailable: () => ClaudeAgentErrors.modelUnavailable,
    rateLimited: () => ClaudeAgentErrors.rateLimitExceeded,
    networkTimeout: () => ClaudeAgentErrors.networkTimeout,
    invalidInput: () => ClaudeAgentErrors.invalidInput,
  },

  /** APEX system errors */
  apex: {
    configNotFound: () => ApexErrors.configNotFound,
    projectNotInitialized: () => ApexErrors.projectNotInitialized,
    workflowNotFound: () => ApexErrors.workflowNotFound,
    taskExecutionFailed: () => ApexErrors.taskExecutionFailed,
    validationFailed: () => ApexErrors.validationFailed,
  },

  /** Infrastructure errors */
  infrastructure: {
    databaseFailed: () => InfrastructureErrors.databaseConnectionFailed,
    diskFull: () => InfrastructureErrors.diskSpaceFull,
    gitNotClean: () => InfrastructureErrors.gitRepoNotClean,
    mcpServerFailed: () => InfrastructureErrors.mcpServerStartFailed,
  },

  /** Tool execution errors */
  tools: {
    executionFailed: () => ClaudeAgentErrors.toolExecutionFailed,
    notFound: () => ClaudeAgentErrors.toolNotFound,
    timeout: () => ClaudeAgentErrors.toolTimeout,
  },

  /** Workflow and orchestration */
  workflow: {
    validationFailed: () => ClaudeAgentErrors.workflowValidationFailed,
    handoffFailed: () => ClaudeAgentErrors.agentHandoffFailed,
    stageExecutionFailed: () => ClaudeAgentErrors.stageExecutionFailed,
  },
} as const;

/**
 * Error scenario builders for testing different error patterns
 */
export const ErrorScenarios = {
  /** Cascading failure scenario */
  cascadingFailure: () => [
    ClaudeAgentErrors.networkTimeout,
    InfrastructureErrors.mcpConnectionLost,
    ApexErrors.taskExecutionFailed,
  ],

  /** Recovery scenario */
  recoveryScenario: () => [
    ClaudeAgentErrors.rateLimitExceeded,
    ClaudeAgentErrors.modelOverloaded,
    // Eventual success implied
  ],

  /** Configuration issues */
  configurationIssues: () => [
    ApexErrors.configNotFound,
    ApexErrors.projectNotInitialized,
    InfrastructureErrors.gitNotFound,
  ],

  /** Permission escalation needed */
  permissionEscalation: () => [
    ApexErrors.permissionDenied,
    InfrastructureErrors.fileSystemPermission,
    ClaudeAgentErrors.insufficientPermissions,
  ],
} as const;