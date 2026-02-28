import { type AgentDefinition as SDKAgentDefinition, type McpServerConfig, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { RepairLoop, resolveRepairConfig, ErrorClassifier } from './repair-loop/index.js';
import type { RepairLoopHost, RepairQueryOptions, RepairQueryResult, RepairContext, RepairLoopEvents, RepairConfig } from './repair-loop/index.js';
import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import { promises as fs, existsSync, writeFileSync, unlinkSync, readFileSync, statSync } from 'fs';
import type { Stats } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'; // Added js-yaml import
import {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  WorkflowStage,
  WorkflowGate,
  ApprovalGate,
  ApprovalState,
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  ApprovalRequest,
  ApprovalResponse,
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
  PermissionLevel,
  PermissionPreset,
  PermissionNotification,
  ToolExecution,
  ToolStartHookContext,
  ToolStartHookCallback,
  ToolCompleteHookContext,
  ToolCompleteHookCallback,
  ToolErrorHookContext,
  ToolErrorHookCallback,
  loadConfig,
  loadAgents,
  loadWorkflows,
  loadWorkflow,
  getEffectiveConfig,
  generateTaskId,
  generateBranchName,
  generateTaskTemplateId,
  generateApprovalId,
  calculateCost,
  OutdatedDocumentation,
  MissingReadmeSection,
  IdleTask,
  IdleTaskType,
  TaskPriority,
  CreateTaskRequest,
  TaskTemplate,
  WorktreeInfo,
  UndoOperationResult,
  FileSnapshot,
  SecretDetection,
  SecretFinding,
  SecretDetectionBehavior,
  RejectionBehavior,
  PolicyViolation,
  PolicyEnforcementMode,
  PolicyCheckContext,
  PolicyCheckResult,
  ApprovalCheckpointType,
  ApprovalOperationType,
  AutonomyLevel,
  ApexRule, // Added ApexRule
  MCPServerConfig,
  MCPMarketplaceEntry,
  MCPInstallation,
  MCPConnection,
  HealthCheckResult,
  AutoFixStageResults,
  AutoFixStageConfig,
  AutoFixEvent,
  VisualComparisonEventData,
  TestReport,
  TestReportSchema,
  TestResult,
  TestResultSchema,
  TestArtifact,
  TestArtifactSchema,
  TestSummary,
  TestSummarySchema,
  VisualRegressionSummary,
  VisualRegressionSummarySchema,
  TestVisualComparison,
  TestVisualComparisonSchema,
  getMCPServers,
  sanitizeErrorMessage,
  MultimodalInput,
  MultimodalContext,
  ProcessedMultimodalInput,
  MultimodalProcessingStatus,
  MultimodalInputCounts,
  ProjectContextAnalyzer,
} from '@apexcli/core';
import type { ProjectContext } from '@apexcli/core';
import { TaskStore, ToolActionStore } from './store';
import { WorktreeManager } from './worktree-manager';
import { AliasResolver } from './alias-resolver';
import { PolicyEnforcer, createPolicyEnforcer, type ApprovalCheckContext, type ApprovalRequirement } from './policy';
import type { PolicyEngine } from './policy-engine';
import { MultimodalInputHandler } from './tools/multimodal-input-handler';
import { AutonomyEnforcer, type AutonomyEnforcerConfig, type ActionMetadata } from './autonomy-enforcer';
import { WorkspaceManager, type WorkspaceInfo, DependencyInstallEventData, DependencyInstallCompletedEventData, DependencyInstallRecoveryEventData } from './workspace-manager';
import {
  buildOrchestratorPrompt,
  buildAgentDefinitions,
  buildStagePrompt,
  buildStagePromptMultimodal,
  buildPlannerStagePrompt,
  buildPlannerStagePromptMultimodal,
  buildResumePrompt,
  parseDecompositionRequest,
  isPlanningStage,
  isCodeGenerationStage,
  type DecompositionRequest,
  type TextBlockParam,
} from './prompts';
import { createHooks, FILE_MODIFYING_TOOLS, type HookContext } from './hooks';
import { HookManager, type HookExecutionStartEvent, type HookExecutionCompleteEvent } from './hook-manager';
import { estimateConversationTokens, createContextSummary } from './context';
import { IdleProcessor, type ProjectAnalysis } from './idle-processor';
import { ThoughtCaptureManager } from './thought-capture';
import { InteractionManager } from './interaction-manager';
import { PermissionStore } from './permission-store';
import { PermissionManager } from './permission-manager';
import { PermissionPresetManager } from './permission-preset-manager';
import { BrowserManager, type BrowserManagerOptions, type BrowserManagerEvents } from './browser-manager';
import { LinterService, ESLintPlugin, PrettierPlugin } from './linter';
import { ErrorFeedbackLoop } from './error-feedback';
import { SecretScanner, type SecretScannerConfig as OrchestratorSecretScannerConfig } from './scanner';
import { SecretOutputProcessor } from './secret-output-processor';
import { generateFileDiff, type DiffResult } from './utils/diff';
import { buildCustomToolsServer, type CustomToolsServer } from './custom-tools';
import { MCPServerManager } from './mcp/server-manager';
import { MCPInstaller, type InstalledMCPResult } from './mcp-installer';
import { MemoryManager } from './memory-manager.js';
import { LearningExtractor } from './learning-extractor.js';
import { SmartContextManager, type UnifiedContext } from './smart-context-manager.js';
import { MCPMarketplaceService, type AutoConfigurationOptions } from './mcp/marketplace-service';
import { MCPConnectionManager, type MCPConnectionManagerOptions } from './mcp';
import { MCPToolRegistry, type MCPToolRegistryOptions, type MCPToolRegistryStats } from './mcp-tool-registry';
import { buildMCPProxyServer, type MCPProxyServer } from './mcp-proxy-server';
import { type ClaudeSDKTool } from './schema-translator';
import { buildBrowserToolsServer, type BrowserToolsServer } from './browser-mcp';
import { browserTool } from './tools';
import { TDDExecutor, type TDDExecutorConfig, type TDDExecutionResult, type TDDIterationResult } from './tdd-executor';
import { ImportAutoFixer } from './import-auto-fixer/import-auto-fixer';
import type { ImportFixResult, MissingImportAnalysis } from './import-auto-fixer/types';
import { TestReportGenerator, type TestReportGeneratorOptions, type TestStartInfo, type TestCompleteInfo } from './test-report-generator';
import { ReplayBundleBuilder } from './replay-bundle-builder';
export type { ReplayBundle } from './replay-bundle-builder';
import { enrichTaskContext, formatEnrichedContext, type EnrichedContext } from './context-enrichment';
import { CodebaseIntelligenceService } from './codebase-intelligence/codebase-intelligence-service';

const execAsync = promisify(exec);

/**
 * Configuration options for ApexOrchestrator initialization
 *
 * @interface OrchestratorOptions
 */
export interface OrchestratorOptions {
  /** Project root path for file operations and workspace management */
  projectPath: string;
  /** Optional API server URL for external integrations */
  apiUrl?: string;
  /** Optional custom autonomy enforcer for dependency injection */
  autonomyEnforcer?: AutonomyEnforcer;
  /** Optional policy engine for custom policy validation */
  policyEngine?: PolicyEngine;
}

/**
 * Policy violation event payload data
 */
export interface PolicyViolationEventData {
  /** Task ID where the violation occurred */
  taskId: string;
  /** Agent that triggered the violation */
  agent: string;
  /** Action that caused the violation */
  action: string;
  /** Details about the violation */
  violation: PolicyViolation;
  /** Enforcement mode applied */
  enforcementMode: PolicyEnforcementMode;
  /** Timestamp when the violation occurred */
  timestamp: Date;
}

/**
 * Policy blocked event payload data
 */
export interface PolicyBlockedEventData {
  /** Task ID that was blocked */
  taskId: string;
  /** Agent that was blocked */
  agent: string;
  /** Action that was blocked */
  action: string;
  /** Details about the violations that caused the block */
  violations: PolicyViolation[];
  /** Enforcement mode applied */
  enforcementMode: PolicyEnforcementMode;
  /** Timestamp when the block occurred */
  timestamp: Date;
}

/**
 * Policy warning event payload data
 */
export interface PolicyWarnedEventData {
  /** Task ID where the warning occurred */
  taskId: string;
  /** Agent that triggered the warning */
  agent: string;
  /** Action that caused the warning */
  action: string;
  /** Details about the violation that caused the warning */
  violation: PolicyViolation;
  /** Enforcement mode applied */
  enforcementMode: PolicyEnforcementMode;
  /** Timestamp when the warning occurred */
  timestamp: Date;
}

/**
 * Policy audited event payload data
 */
export interface PolicyAuditedEventData {
  /** Task ID where the audit event occurred */
  taskId: string;
  /** Agent that triggered the audit */
  agent: string;
  /** Action that was audited */
  action: string;
  /** Details about the violation that was audited */
  violation: PolicyViolation;
  /** Enforcement mode applied */
  enforcementMode: PolicyEnforcementMode;
  /** Timestamp when the audit occurred */
  timestamp: Date;
}

/**
 * Event interface defining all events emitted by ApexOrchestrator
 *
 * Events are organized into categories:
 * - Task lifecycle: created, started, completed, failed, etc.
 * - Agent interactions: messages, thinking, tool usage, transitions
 * - System events: daemon state, capacity management, auto-resume
 * - Container events: lifecycle and health monitoring
 * - Permission events: requests, grants, denials
 * - Tool events: calls, progress, completion
 * - Security events: secret detection, dangerous operations
 * - Linting events: automated code quality checks
 * - Browser events: automation and error tracking
 * - MCP events: server management and health monitoring
 */
export interface OrchestratorEvents {
  'task:created': (task: Task) => void;
  'task:started': (task: Task) => void;
  'task:stage-changed': (task: Task, stage: string) => void;
  'task:completed': (task: Task) => void;
  'task:failed': (task: Task, error: Error) => void;
  'task:paused': (task: Task, reason: string) => void;
  'task:decomposed': (task: Task, subtaskIds: string[]) => void;
  'task:trashed': (task: Task) => void;
  'task:restored': (task: Task) => void;
  'task:archived': (task: Task) => void;
  'task:unarchived': (task: Task) => void;
  'trash:emptied': (deletedCount: number, taskIds: string[]) => void;
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

  // Permission management events (v0.5.0)
  'permission:request': (event: PermissionRequestEventData) => void;
  'permission:granted': (event: PermissionGrantedEventData) => void;
  'permission:denied': (event: PermissionDeniedEventData) => void;
  'permission:notification': (event: PermissionNotification) => void;
  'dangerous:detected': (event: DangerousOperationDetectedEventData) => void;
  'dangerous:confirmed': (event: DangerousOperationConfirmedEventData) => void;
  'dangerous:blocked': (event: DangerousOperationBlockedEventData) => void;

  // Approval gate events
  'approval:required': (event: ApprovalRequiredEventData) => void;
  'approval:request': (event: ApprovalRequest) => void;
  'approval:approved': (event: ApprovalGrantedEventData) => void;
  'approval:denied': (event: ApprovalDeniedEventData) => void;
  'approval:info-requested': (event: {
    approvalId: string;
    taskId: string;
    requester: string;
    message?: string;
    timestamp: Date;
  }) => void;
  'approval:decision': (event: {
    approvalId: string;
    decision: 'approved' | 'denied';
    approver: string;
    comment?: string;
    reason?: string;
  }) => void;

  // Policy violation events (v0.5.0)
  'policy:violation': (event: PolicyViolationEventData) => void;
  'policy:blocked': (event: PolicyBlockedEventData) => void;
  'policy:warned': (event: PolicyWarnedEventData) => void;
  'policy:audited': (event: PolicyAuditedEventData) => void;

  // Template events
  'template:created': (template: TaskTemplate) => void;
  'template:updated': (template: TaskTemplate) => void;

  // Resource limit events
  'limit:warning': (event: LimitWarningEvent) => void;
  'limit:exceeded': (event: LimitExceededEvent) => void;

  // Tool call events (v0.5.0)
  'tool:start': (event: ToolCallStartEvent) => void;
  'tool:progress': (event: ToolCallProgressEvent) => void;
  'tool:complete': (event: ToolCallCompleteEvent) => void;
  'secret:detected': (event: SecretDetectedEvent) => void;

  // Diff preview events (v0.5.0)
  'diff:preview': (event: DiffPreviewEvent) => void;

  // Lint events (v0.5.0)
  'lint:started': (event: LintStartedEventData) => void;
  'lint:completed': (event: LintCompletedEventData) => void;
  'lint:issue': (event: LintIssueEventData) => void;
  'lint:fix-applied': (event: LintFixAppliedEventData) => void;

  // MCP Connection events (v0.5.0)
  'mcp:connected': (event: MCPConnectionEventData) => void;
  'mcp:disconnected': (event: MCPDisconnectionEventData) => void;
  'mcp:error': (event: MCPErrorEventData) => void;
  'mcp:reconnecting': (event: MCPReconnectingEventData) => void;
  'mcp:health-check': (event: MCPHealthCheckEventData) => void;
  'mcp:state-change': (event: MCPStateChangeEventData) => void;
  'mcp:pool-change': (event: MCPPoolChangeEventData) => void;
  'mcp:tool-start': (event: { serverId: string; serverName: string; toolName: string; callId: string; timestamp: Date }) => void;
  'mcp:tool-complete': (event: { serverId: string; serverName: string; toolName: string; callId: string; durationMs: number; timestamp: Date }) => void;
  'mcp:tool-error': (event: { serverId: string; serverName: string; toolName: string; callId: string; error: string; errorCode?: string; retriable: boolean; timestamp: Date }) => void;

  // Auto-fix events (v0.5.0)
  'autofix:requested': (event: AutoFixRequestedEventData) => void;
  'autofix:started': (event: AutoFixStartedEventData) => void;
  'autofix:progress': (event: AutoFixProgressEventData) => void;
  'autofix:completed': (event: AutoFixCompletedEventData) => void;
  'autofix:failed': (event: AutoFixFailedEventData) => void;
  'autofix:skipped': (event: AutoFixSkippedEventData) => void;

  // Auto-fix events with standardized event names (v0.5.0)
  'auto-fix-start': (event: AutoFixEvent) => void;
  'auto-fix-progress': (event: AutoFixEvent) => void;
  'auto-fix-complete': (event: AutoFixEvent) => void;
  'auto-fix-error': (event: AutoFixEvent) => void;

  // Undo events (v0.5.0)
  'undo:start': (taskId: string) => void;
  'undo:complete': (taskId: string, actionId: string, restoredFiles: string[]) => void;
  'undo:error': (taskId: string, actionId: string | null, error: string) => void;

  // Hook events (v0.5.0)
  'hook:pre:start': (event: HookExecutionStartEvent) => void;
  'hook:pre:complete': (event: HookExecutionCompleteEvent) => void;
  'hook:post:start': (event: HookExecutionStartEvent) => void;
  'hook:post:complete': (event: HookExecutionCompleteEvent) => void;

  // Browser events (v0.5.0) - Integration with browser automation streaming
  'browser:console': (event: BrowserConsoleEvent) => void;
  'browser:error': (event: BrowserErrorEvent) => void;
  'browser:network-error': (event: BrowserNetworkErrorEvent) => void;
  'browser:performance-warning': (event: BrowserPerformanceWarningEvent) => void;
  'browser:security-violation': (event: BrowserSecurityViolationEvent) => void;
  'browser:session-started': (event: BrowserSessionStartedEvent) => void;
  'browser:session-ended': (event: BrowserSessionEndedEvent) => void;

  // Browser Manager events (v0.5.0) - Browser instance lifecycle management
  'browser:launched': (event: BrowserManagerLaunchedEvent) => void;
  'browser:closed': (event: BrowserManagerClosedEvent) => void;
  'browser:context-created': (event: BrowserManagerContextCreatedEvent) => void;
  'browser:context-closed': (event: BrowserManagerContextClosedEvent) => void;
  'browser:page-created': (event: BrowserManagerPageCreatedEvent) => void;
  'browser:page-closed': (event: BrowserManagerPageClosedEvent) => void;
  'browser:manager-error': (event: BrowserManagerErrorEvent) => void;

  // Visual comparison events (v0.5.0)
  'visual:comparison:failed': (event: VisualComparisonEventData) => void;
  'visual:comparison:passed': (event: VisualComparisonEventData) => void;

  // Generic APEX events (v0.5.0) - for TDD and other subsystems
  'apex-event': (event: ApexEvent) => void;

  // Self-repair loop events (v0.5.0) - autonomous error recovery
  'repair:started': RepairLoopEvents['repair:started'];
  'repair:state-change': RepairLoopEvents['repair:state-change'];
  'repair:diagnosis': RepairLoopEvents['repair:diagnosis'];
  'repair:fix-planned': RepairLoopEvents['repair:fix-planned'];
  'repair:fix-applied': RepairLoopEvents['repair:fix-applied'];
  'repair:validation-passed': RepairLoopEvents['repair:validation-passed'];
  'repair:validation-failed': RepairLoopEvents['repair:validation-failed'];
  'repair:resolved': RepairLoopEvents['repair:resolved'];
  'repair:escalated': RepairLoopEvents['repair:escalated'];
  'repair:terminated': RepairLoopEvents['repair:terminated'];
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

/**
 * Event payload for permission:request event
 * Emitted when an agent requests permission to use a tool
 */
export interface PermissionRequestEventData {
  requestId: string;
  tool: string;
  scope?: string;
  description: string;
  isDangerous: boolean;
  agent?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Event payload for permission:granted event
 * Emitted when a permission request is approved
 */
export interface PermissionGrantedEventData {
  requestId: string;
  tool: string;
  scope?: string;
  level: PermissionLevel;
  grantedBy: string;
  timestamp: Date;
  reason?: string;
}

/**
 * Event payload for permission:denied event
 * Emitted when a permission request is rejected
 */
export interface PermissionDeniedEventData {
  requestId: string;
  tool: string;
  scope?: string;
  deniedBy: string;
  timestamp: Date;
  reason: string;
}

/**
 * Event payload for dangerous:detected event
 * Emitted when a potentially dangerous operation is detected
 */
export interface DangerousOperationDetectedEventData {
  operationId: string;
  tool: string;
  operation: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskDescription: string;
  agent: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

/**
 * Event payload for dangerous:confirmed event
 * Emitted when a user confirms a dangerous operation should proceed
 */
export interface DangerousOperationConfirmedEventData {
  operationId: string;
  tool: string;
  operation: string;
  confirmedBy: string;
  timestamp: Date;
  reason?: string;
}

/**
 * Event payload for dangerous:blocked event
 * Emitted when a dangerous operation is blocked for safety
 */
export interface DangerousOperationBlockedEventData {
  operationId: string;
  tool: string;
  operation: string;
  blockedBy: string;
  timestamp: Date;
  reason: string;
}

/**
 * Event payload for limit warning events
 */
export interface LimitWarningEvent {
  taskId: string;
  limitType: 'tokens' | 'cost' | 'time' | 'files';
  currentValue: number;
  limitValue: number;
  percentage: number;
  utilizationPercent?: number;
  timestamp: Date;
}

/**
 * Event payload for limit exceeded events
 */
export interface LimitExceededEvent {
  taskId: string;
  limitType: 'tokens' | 'cost' | 'time' | 'files';
  currentValue: number;
  limitValue: number;
  percentage: number;
  timestamp: Date;
}

/**
 * Event payload for tool:start event (v0.5.0)
 * Emitted when a tool call begins
 */
export interface ToolCallStartEvent {
  taskId: string;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: Date;
  callId: string;
}

/**
 * Event payload for tool:progress event (v0.5.0)
 * Emitted during long-running tool operations
 */
export interface ToolCallProgressEvent {
  taskId: string;
  toolName: string;
  callId: string;
  progress: {
    message: string;
    percentage?: number;
  };
  timestamp: Date;
}

/**
 * Event payload for tool:complete event (v0.5.0)
 * Emitted when a tool call completes
 */
export interface ToolCallCompleteEvent {
  taskId: string;
  toolName: string;
  callId: string;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number; // milliseconds
  };
  timestamp: Date;
}

/**
 * Event payload for secret:detected event (v0.5.0)
 * Emitted when secrets are detected in tool outputs
 */
export interface SecretDetectedEvent {
  taskId: string;
  toolName: string;
  callId: string;
  findings: SecretFinding[];
  count: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  behavior: SecretDetectionBehavior;
  timestamp: Date;
}

/**
 * Event payload for diff:preview event (v0.5.0)
 * Emitted when a file edit is about to be applied and diff preview is enabled
 */
export interface DiffPreviewEvent {
  taskId: string;
  toolName: string;
  callId: string;
  filePath: string;
  diff: string;
  addedLines: number;
  removedLines: number;
  timestamp: Date;
}

/**
 * Event payload for lint:started event (v0.5.0)
 * Emitted when a linter starts execution
 */
export interface LintStartedEventData {
  taskId: string;
  linterId: string;
  files: string[];
  timestamp: Date;
}

/**
 * Event payload for lint:completed event (v0.5.0)
 * Emitted when a linter completes execution
 */
export interface LintCompletedEventData {
  taskId: string;
  linterId: string;
  result: {
    success: boolean;
    issues: unknown[];
    filesChecked: number;
    filesWithIssues: number;
    duration: number; // milliseconds
    error?: string;
  };
  timestamp: Date;
}

/**
 * Event payload for lint:issue event (v0.5.0)
 * Emitted when a linter finds an issue
 */
export interface LintIssueEventData {
  taskId: string;
  linterId: string;
  issue: {
    filePath: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    severity: 'error' | 'warning' | 'info' | 'hint';
    ruleId: string;
    message: string;
    fix?: {
      range: [number, number];
      text: string;
    };
  };
  timestamp: Date;
}

/**
 * Event payload for lint:fix-applied event (v0.5.0)
 * Emitted when a lint fix is successfully applied
 */
export interface LintFixAppliedEventData {
  taskId: string;
  linterId: string;
  filePath: string;
  issuesFixed: number;
  fixDetails: {
    ruleId: string;
    line: number;
    column: number;
    originalText: string;
    fixedText: string;
  }[];
  timestamp: Date;
}

// ============================================================================
// Auto-Fix Event Types (v0.5.0)
// ============================================================================

/**
 * Event payload when auto-fix is requested for a file
 * Emitted when an agent or hook triggers auto-fix for a file
 */
export interface AutoFixRequestedEventData {
  taskId: string;
  filePath: string;
  fixTypes: Array<'syntax' | 'imports' | 'formatting'>;
  triggeredBy: 'agent' | 'hook' | 'manual';
  timestamp: Date;
}

/**
 * Event payload when auto-fix operation begins
 * Emitted when the auto-fixer starts processing a file
 */
export interface AutoFixStartedEventData {
  taskId: string;
  filePath: string;
  fixType: 'syntax' | 'imports' | 'formatting';
  issuesDetected: number;
  timestamp: Date;
}

/**
 * Event payload for auto-fix progress updates
 * Emitted during auto-fix to report incremental progress
 */
export interface AutoFixProgressEventData {
  taskId: string;
  filePath: string;
  fixType: 'syntax' | 'imports' | 'formatting';
  issuesFixed: number;
  issuesRemaining: number;
  currentFix?: string; // Description of current fix being applied
  timestamp: Date;
}

/**
 * Event payload when auto-fix completes successfully
 * Emitted when all requested fixes have been applied to a file
 */
export interface AutoFixCompletedEventData {
  taskId: string;
  filePath: string;
  fixType: 'syntax' | 'imports' | 'formatting';
  issuesDetected: number;
  issuesFixed: number;
  duration: number; // milliseconds
  timestamp: Date;
}

/**
 * Event payload when auto-fix fails
 * Emitted when auto-fix encounters an unrecoverable error
 */
export interface AutoFixFailedEventData {
  taskId: string;
  filePath: string;
  fixType: 'syntax' | 'imports' | 'formatting';
  error: string;
  issuesDetected: number;
  issuesFixed: number; // How many were fixed before failure
  timestamp: Date;
}

/**
 * Event payload when auto-fix is skipped
 * Emitted when auto-fix is not performed for a file
 */
export interface AutoFixSkippedEventData {
  taskId: string;
  filePath: string;
  reason: 'disabled' | 'no_issues' | 'unsupported_file' | 'manual_override';
  timestamp: Date;
}

/**
 * MCP Connection event payload data
 */
export interface MCPConnectionEventData {
  /** Server identifier */
  serverId: string;
  /** Server name */
  serverName: string;
  /** Connection timestamp */
  timestamp: Date;
  /** Server configuration details */
  config: {
    type: string;
    command?: string;
    url?: string;
  };
}

/**
 * MCP Disconnection event payload data
 */
export interface MCPDisconnectionEventData {
  /** Server identifier */
  serverId: string;
  /** Server name */
  serverName: string;
  /** Disconnection reason */
  reason?: string;
  /** Disconnection timestamp */
  timestamp: Date;
}

/**
 * MCP Error event payload data
 */
export interface MCPErrorEventData {
  /** Server identifier */
  serverId: string;
  /** Server name */
  serverName: string;
  /** Error message */
  error: string;
  /** Error timestamp */
  timestamp: Date;
  /** Error code if available */
  code?: string;
}

/**
 * MCP Reconnecting event payload data
 */
export interface MCPReconnectingEventData {
  /** Server identifier */
  serverId: string;
  /** Server name */
  serverName: string;
  /** Current reconnection attempt number */
  attempt: number;
  /** Maximum reconnection attempts */
  maxAttempts: number;
  /** Reconnection timestamp */
  timestamp: Date;
}

/**
 * MCP Health Check event payload data
 */
export interface MCPHealthCheckEventData {
  /** Server identifier */
  serverId: string;
  /** Server name */
  serverName: string;
  /** Health check success status */
  success: boolean;
  /** Response latency in milliseconds (if successful) */
  latencyMs?: number;
  /** Error details (if failed) */
  error?: string;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Whether connection is considered healthy */
  isHealthy: boolean;
  /** Health check timestamp */
  timestamp: Date;
}

/**
 * MCP State Change event payload data
 */
export interface MCPStateChangeEventData {
  /** Server identifier */
  serverId: string;
  /** Server name */
  serverName: string;
  /** Previous connection state */
  previousState: string;
  /** New connection state */
  newState: string;
  /** State change timestamp */
  timestamp: Date;
}

/**
 * MCP Pool Change event payload data
 */
export interface MCPPoolChangeEventData {
  /** Server identifier */
  serverId: string;
  /** Server name */
  serverName: string;
  /** Total pool size */
  poolSize: number;
  /** Number of active connections */
  activeConnections: number;
  /** Pool change timestamp */
  timestamp: Date;
}

/**
 * Browser Events - Integrating browser automation events with orchestrator streaming
 * These events provide real-time visibility into browser automation activities
 * and include task context correlation for proper event tracking.
 */

/**
 * Event payload for browser console messages
 * Emitted when a console message is captured from browser automation
 */
export interface BrowserConsoleEvent {
  taskId: string;
  /** Agent name that initiated the browser action */
  agentName: string;
  /** Console message details */
  message: {
    type: string;
    text: string;
    timestamp: Date;
    level: import('./browser-console-stream').ConsoleLogLevel;
    args?: unknown[];
    location?: {
      url: string;
      lineNumber?: number;
      columnNumber?: number;
    };
    stack?: string;
    sessionId?: string;
    pageContext?: {
      url: string;
      title: string;
      userAgent: string;
    };
  };
  timestamp: Date;
}

/**
 * Event payload for browser runtime errors
 * Emitted when a JavaScript error or runtime error occurs in browser automation
 */
export interface BrowserErrorEvent {
  taskId: string;
  /** Agent name that initiated the browser action */
  agentName: string;
  /** Runtime error details */
  error: {
    message: string;
    name?: string;
    stack?: string;
    timestamp: Date;
    source?: {
      url: string;
      line: number;
      column: number;
    };
    category: 'javascript' | 'network' | 'security' | 'permission' | 'resource' | 'unknown';
    severity: 'low' | 'medium' | 'high' | 'critical';
    context?: {
      userAgent: string;
      pageUrl: string;
      pageTitle: string;
      viewport: { width: number; height: number };
      timestamp: Date;
    };
    sessionId?: string;
  };
  timestamp: Date;
}

/**
 * Event payload for browser network errors
 * Emitted when network requests fail during browser automation
 */
export interface BrowserNetworkErrorEvent {
  taskId: string;
  /** Agent name that initiated the browser action */
  agentName: string;
  /** Network error details */
  error: {
    url: string;
    method: string;
    status: number;
    statusText: string;
    timestamp: Date;
    sessionId?: string;
  };
  timestamp: Date;
}

/**
 * Event payload for browser performance warnings
 * Emitted when performance issues are detected during browser automation
 */
export interface BrowserPerformanceWarningEvent {
  taskId: string;
  /** Agent name that initiated the browser action */
  agentName: string;
  /** Performance warning details */
  warning: {
    type: 'slow-script' | 'memory-high' | 'layout-thrashing' | 'long-task';
    message: string;
    duration?: number;
    timestamp: Date;
    sessionId?: string;
  };
  timestamp: Date;
}

/**
 * Event payload for browser security violations
 * Emitted when security violations are detected during browser automation
 */
export interface BrowserSecurityViolationEvent {
  taskId: string;
  /** Agent name that initiated the browser action */
  agentName: string;
  /** Security violation details */
  violation: {
    type: 'csp' | 'cors' | 'mixed-content' | 'unsafe-eval';
    message: string;
    blockedURI?: string;
    timestamp: Date;
    sessionId?: string;
  };
  timestamp: Date;
}

/**
 * Event payload for browser session start
 * Emitted when a browser automation session starts
 */
export interface BrowserSessionStartedEvent {
  taskId: string;
  /** Agent name that initiated the browser session */
  agentName: string;
  /** Browser session details */
  session: {
    sessionId: string;
    browserType: string;
    userAgent: string;
    viewport: { width: number; height: number };
    headless: boolean;
  };
  timestamp: Date;
}

/**
 * Event payload for browser session end
 * Emitted when a browser automation session ends
 */
export interface BrowserSessionEndedEvent {
  taskId: string;
  /** Agent name that ended the browser session */
  agentName: string;
  /** Browser session details */
  session: {
    sessionId: string;
    duration: number; // milliseconds
    pagesVisited: number;
    errorsCount: number;
    consoleMessagesCount: number;
  };
  timestamp: Date;
}

/**
 * Emitted when a browser instance is launched by BrowserManager
 */
export interface BrowserManagerLaunchedEvent {
  taskId: string;
  /** Agent name that requested the browser launch */
  agentName: string;
  /** Browser instance information */
  browserInfo: {
    id: string;
    engine: string;
    version: string;
    isConnected: boolean;
    pid?: number;
  };
  timestamp: Date;
}

/**
 * Emitted when a browser instance is closed by BrowserManager
 */
export interface BrowserManagerClosedEvent {
  taskId: string;
  /** Agent name that closed the browser */
  agentName: string;
  /** Browser instance ID */
  browserId: string;
  timestamp: Date;
}

/**
 * Emitted when a browser context is created by BrowserManager
 */
export interface BrowserManagerContextCreatedEvent {
  taskId: string;
  /** Agent name that requested the context */
  agentName: string;
  /** Context information */
  contextInfo: {
    id: string;
    browserId: string;
    pageCount: number;
  };
  timestamp: Date;
}

/**
 * Emitted when a browser context is closed by BrowserManager
 */
export interface BrowserManagerContextClosedEvent {
  taskId: string;
  /** Agent name that closed the context */
  agentName: string;
  /** Context ID */
  contextId: string;
  /** Browser ID */
  browserId: string;
  timestamp: Date;
}

/**
 * Emitted when a page is created within a browser context
 */
export interface BrowserManagerPageCreatedEvent {
  taskId: string;
  /** Agent name that triggered the page creation */
  agentName: string;
  /** Context ID */
  contextId: string;
  /** Browser ID */
  browserId: string;
  timestamp: Date;
}

/**
 * Emitted when a page is closed within a browser context
 */
export interface BrowserManagerPageClosedEvent {
  taskId: string;
  /** Agent name that closed the page */
  agentName: string;
  /** Context ID */
  contextId: string;
  /** Browser ID */
  browserId: string;
  timestamp: Date;
}

/**
 * Emitted when an error occurs in BrowserManager operations
 */
export interface BrowserManagerErrorEvent {
  taskId: string;
  /** Agent name that was executing when the error occurred */
  agentName: string;
  /** Error details */
  error: {
    message: string;
    name?: string;
    stack?: string;
    operation?: string; // The BrowserManager operation that failed
  };
  timestamp: Date;
}

export interface PRResult {
  success: boolean;
  prUrl?: string;
  error?: string;
}

export interface MergeTaskBranchResult {
  success: boolean;
  error?: string;
  conflicted?: boolean;
  changedFiles?: string[];
  commitHash?: string;
}

/**
 * Main orchestrator class for managing AI agents, workflows, and task execution
 *
 * Provides high-level coordination of:
 * - Agent lifecycle management and workflow execution
 * - Task storage, checkpointing, and result tracking
 * - Permission management and security controls
 * - Tool execution with hooks and validation
 * - Event emission for real-time monitoring
 * - Integration with Claude Agent SDK
 *
 * @extends EventEmitter<OrchestratorEvents>
 * @example
 * ```typescript
 * const orchestrator = new ApexOrchestrator({ projectPath: '/path/to/project' });
 * await orchestrator.initialize();
 *
 * const task = await orchestrator.executeWorkflow('feature-development', {
 *   description: 'Add user authentication'
 * });
 * ```
 */
export class ApexOrchestrator extends EventEmitter<OrchestratorEvents> {
  private config!: ApexConfig;
  private effectiveConfig!: ReturnType<typeof getEffectiveConfig>;
  private agents: Record<string, AgentDefinition> = {};
  private workflows: Record<string, WorkflowDefinition> = {};
  private gates: Map<string, ApprovalGate> = new Map();
  public store!: TaskStore;
  private toolActionStore!: ToolActionStore;
  private thoughtCaptureManager!: ThoughtCaptureManager;
  private interactionManager!: InteractionManager;
  private worktreeManager?: WorktreeManager;
  private workspaceManager!: WorkspaceManager;
  private _permissionStore!: PermissionStore;
  private _permissionManager!: PermissionManager;
  private _permissionPresetManager!: PermissionPresetManager;
  private browserManager!: BrowserManager;
  private policyEnforcer!: PolicyEnforcer;
  private autonomyEnforcer!: AutonomyEnforcer;
  private policyEngine?: PolicyEngine;  // Optional PolicyEngine instance
  private aliasResolver!: AliasResolver;
  private linterService!: LinterService;
  private errorFeedbackLoop = new ErrorFeedbackLoop();
  private repairLoop!: RepairLoop;
  private repairErrorClassifier = new ErrorClassifier();
  private secretScanner?: SecretScanner;
  private secretOutputProcessor = new SecretOutputProcessor();
  private hookManager!: HookManager;
  private customToolsServer?: CustomToolsServer;
  private mcpServerManager?: MCPServerManager;
  private multimodalInputHandler!: MultimodalInputHandler;
  private mcpInstaller?: MCPInstaller;
  private mcpMarketplaceService?: MCPMarketplaceService;
  private mcpConnectionManager?: MCPConnectionManager;
  private mcpToolRegistry?: MCPToolRegistry;
  private browserToolsServer?: BrowserToolsServer;
  private tddExecutor?: TDDExecutor;
  private driver!: import('./drivers/index.js').AiDriver;
  private projectContextAnalyzer?: ProjectContextAnalyzer;
  private cachedProjectContext?: ProjectContext;
  private codebaseIntelligence?: CodebaseIntelligenceService;
  private cachedEnrichedContext?: EnrichedContext;
  private memoryManager?: MemoryManager;
  private learningExtractor?: LearningExtractor;
  private cachedTaskHistoryContext?: string;
  private cachedStageResults?: Map<string, import('@apexcli/core').StageResult>;
  private smartContextManager?: SmartContextManager;
  private cachedUnifiedContext?: UnifiedContext;
  private replayBundleBuilder?: ReplayBundleBuilder;
  private projectPath: string;
  private apiUrl: string;
  private initialized = false;

  // Task execution tracking
  private currentTaskId: string | null = null;
  private currentAgentName: string | null = null;

  // Combined tools (built-in + MCP) for current task execution
  private currentTaskTools: string[] = [];

  // CLI flags for current task
  private currentTaskCliFlags: { diffPreview?: boolean } | undefined = undefined;

  // Concurrent execution state
  private runningTasks: Map<string, Promise<void>> = new Map();
  private taskRunnerInterval: ReturnType<typeof setInterval> | null = null;
  private isRunnerActive = false;

  // Resource tracking state
  private taskResourceTracker: Map<string, {
    startTime: Date;
    fileChangeCount: number;
    initialUsage: TaskUsage;
    lastCheckTimestamp: Date;
  }> = new Map();
  private fileChangesByTask: Map<string, { created: string[]; modified: string[] }> = new Map();

  // Execution guards: prevent concurrent execution of the same task
  private executingTaskIds: Set<string> = new Set();

  // Decomposition guard: prevent duplicate decomposition of the same task
  private decomposingTaskIds: Set<string> = new Set();

  // Tool call tracking per task: counts mutating tool calls (Write, Edit, Bash)
  private taskToolCallCounts: Map<string, { total: number; mutating: number }> = new Map();

  // Tool execution tracking with full timing information
  private activeToolExecutions: Map<string, ToolExecution> = new Map();

  // Store hooks context for accessing file snapshots during tool completion
  private currentHookContext: HookContext | null = null;

  // Approval promise management for respondToApproval API
  private pendingApprovalPromises: Map<string, {
    resolve: (response: ApprovalResponse) => void;
    reject: (error: Error) => void;
  }> = new Map();

  /**
   * Create a new ApexOrchestrator instance
   * @param options - Configuration options for the orchestrator
   * @param options.projectPath - Project root path for file operations and workspace management
   * @param options.apiUrl - Optional API server URL for external integrations
   * @param options.autonomyEnforcer - Optional custom autonomy enforcer for dependency injection
   * @param options.policyEngine - Optional policy engine for custom policy validation
   */
  constructor(private options: OrchestratorOptions) {
    super();
    this.projectPath = options.projectPath;
    this.apiUrl = options.apiUrl || 'http://localhost:3000';
    this.policyEngine = options.policyEngine;  // Store the optional PolicyEngine
  }

  /** Get the memory manager for external access (CLI commands) */
  get memory(): MemoryManager | undefined {
    return this.memoryManager;
  }

  /**
   * Get context visualization for the /context command.
   * Returns a human-readable string showing token budget allocation
   * across all context sources, or undefined if no context data is available.
   */
  getContextVisualization(): string | undefined {
    if (!this.smartContextManager || !this.cachedUnifiedContext) {
      return undefined;
    }
    return this.smartContextManager.getContextVisualization(this.cachedUnifiedContext.visualization);
  }

  /**
   * Initialize the orchestrator with all required services and components
   *
   * Sets up configuration, database connections, agents, workflows, and all necessary
   * services for task execution including permission management, browser automation,
   * and policy enforcement.
   *
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} When configuration cannot be loaded or services fail to initialize
   *
   * @example
   * ```typescript
   * const orchestrator = new ApexOrchestrator({ projectPath: '/path/to/project' });
   * await orchestrator.initialize();
   * console.log('Orchestrator ready for task execution');
   * ```
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load configuration (with fallback for test environments)
    try {
      this.config = await loadConfig(this.projectPath);
    } catch {
      // Use minimal default config if config file is missing (e.g., test environments)
      this.config = {
        version: '0.1.0',
        project: { name: 'apex-project', language: 'typescript', framework: 'node' },
        autonomy: { level: 'supervised' as const, gates: [], stageOverrides: {}, agentOverrides: {} },
        agents: { enabled: [], disabled: [] },
        workflows: {},
        models: { planning: 'opus', implementation: 'sonnet', review: 'haiku' },
        limits: { maxTokensPerTask: 100000, maxCostPerTask: 10, maxRetries: 3 },
        gates: [],
        git: { branchPrefix: 'apex/', commitFormat: 'conventional', autoPush: false, defaultBranch: 'main' },
        aliases: [],
      } as unknown as ApexConfig;
    }
    this.effectiveConfig = getEffectiveConfig(this.config);

    // Initialize the AI platform driver (v0.6.0)
    await this.initializeDriver();

    // Initialize alias resolver with config aliases
    this.aliasResolver = new AliasResolver(this.config.aliases || []);

    // Initialize MCP server manager and marketplace service (v0.5.0)
    // Note: MCPInstaller requires this.store, which is initialized later
    this.mcpServerManager = new MCPServerManager(this.projectPath, this.config);
    this.mcpMarketplaceService = new MCPMarketplaceService(this.projectPath, this.config);
    this.mcpConnectionManager = new MCPConnectionManager({
      projectPath: this.projectPath,
      config: this.config
    });

    // Set up MCP event forwarding
    this.setupMCPEventForwarding();

    // Initialize multimodal input handler (v0.6.0)
    this.multimodalInputHandler = new MultimodalInputHandler();

    // Initialize MCP tool registry for tool discovery
    if (this.mcpConnectionManager) {
      this.mcpToolRegistry = new MCPToolRegistry({
        operationTimeoutMs: 30000,
        autoRefresh: false, // We'll manually refresh during execution
      });
      this.mcpToolRegistry.setConnectionManager(this.mcpConnectionManager);

      // Connect to enabled servers and discover tools
      await this.discoverAndRegisterMcpTools();
    }

    // Load agent definitions
    this.agents = await loadAgents(this.projectPath);

    // Initialize custom tools (v0.5.0)
    const customToolsServer = buildCustomToolsServer(this.effectiveConfig.customTools, this.projectPath);
    if (customToolsServer) {
      this.customToolsServer = customToolsServer;
    }

    // Load workflow definitions and gates
    await this.loadGates();

    // Load APEX project rules
    await this.loadApexRules();

    // Initialize task store
    this.store = new TaskStore(this.projectPath);
    await this.store.initialize();

    // Initialize memory manager (v0.6.0)
    try {
      this.memoryManager = new MemoryManager(this.store.getDatabase());
      this.memoryManager.initialize();
    } catch (error) {
      console.warn(`Memory system initialization failed: ${(error as Error).message}`);
    }

    // Initialize learning extractor (v0.6.0, depends on memory manager)
    if (this.memoryManager) {
      this.learningExtractor = new LearningExtractor(this.memoryManager);
    }

    // Initialize MCP installer (requires store to be initialized)
    this.mcpInstaller = new MCPInstaller(this.projectPath, this.store);

    // Initialize tool action store
    this.toolActionStore = new ToolActionStore(this.store, this.config.toolActionRetention);

    // Initialize thought capture manager
    this.thoughtCaptureManager = new ThoughtCaptureManager(this.projectPath, this.store);
    await this.thoughtCaptureManager.initialize();

    // Initialize interaction manager
    this.interactionManager = new InteractionManager(this.store);

    // Set up interaction event handlers
    this.setupInteractionEventHandlers();

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

    // Initialize permission managers
    this._permissionStore = new PermissionStore(this.projectPath);
    await this._permissionStore.initialize();

    this._permissionManager = new PermissionManager(this._permissionStore);

    this._permissionPresetManager = new PermissionPresetManager(
      this._permissionStore,
      this.effectiveConfig.permissions.preset
    );

    if (this.effectiveConfig.tools && Object.keys(this.effectiveConfig.tools).length > 0) {
      for (const [toolName, toolConfig] of Object.entries(this.effectiveConfig.tools)) {
        this.permissionManager.setToolConfig(toolName, toolConfig ?? null);
      }
    }

    // Wire browser tool permissions + MCP server
    browserTool.setPermissionManager(this.permissionManager);
    browserTool.setEventEmitter(this);
    const browserToolConfig = this.effectiveConfig.tools?.Browser;
    if (browserToolConfig?.enabled !== false) {
      this.browserToolsServer = buildBrowserToolsServer(browserTool);
    }

    // Initialize browser manager with permission manager integration
    this.browserManager = new BrowserManager({
      permissionManager: this._permissionManager,
      browserTool,
      defaultConfig: (browserToolConfig as Record<string, unknown>)?.browserConfig as Record<string, unknown> || {},
    });

    // Initialize browser event integration with task context correlation
    this.setupBrowserEventIntegration();

    // Setup task and agent context tracking for event correlation
    this.setupContextTracking();

    // Initialize policy enforcer
    this.policyEnforcer = createPolicyEnforcer(this.config.policy);
    this.policyEnforcer.on('policy:violation', event => {
      this.emit('policy:violation', {
        taskId: event.taskId || this.currentTaskId || 'unknown',
        agent: event.agentId || 'unknown',
        action: event.violation.policyType || 'policy',
        violation: event.violation,
        enforcementMode: this.resolvePolicyEnforcementMode(),
        timestamp: event.timestamp || new Date(),
      });
    });

    // Initialize autonomy enforcer
    if (this.options.autonomyEnforcer) {
      this.autonomyEnforcer = this.options.autonomyEnforcer;
    } else {
      this.autonomyEnforcer = new AutonomyEnforcer(
        this.buildAutonomyEnforcerConfig(),
        this
      );
    }
    this.setupAutonomyEnforcerEvents();

    // Setup approval event handlers for external approval resolution
    this.setupApprovalEventHandlers();

    // Initialize linter service
    this.linterService = new LinterService({
      projectPath: this.projectPath,
      defaultTimeout: this.config.linter?.global?.timeoutMs,
      maxConcurrency: this.config.linter?.global?.maxConcurrency,
      autoFix: {
        enabled: this.config.linter?.global?.enabled ?? false,
      },
    });
    await this.linterService.initialize();

    // Register available linter plugins
    await this.registerAvailableLinterPlugins();

    // Initialize secret scanner if configured
    const secretScannerConfig = this.resolveSecretScannerConfig();
    if (secretScannerConfig) {
      this.secretScanner = new SecretScanner(secretScannerConfig);
      console.log('SecretScanner initialized with configuration');
    } else {
      console.log('SecretScanner not configured - scanner will be disabled');
    }

    // Initialize hook manager
    this.hookManager = new HookManager(
      this.projectPath,
      this.store,
      this.config.hooks || [],
      this.config.toolHooks || { pre: [], post: [], enabled: true, defaultTimeoutMs: 30000 }
    );

    // Forward hook events from hook manager
    this.setupHookEventForwarding();

    // Forward linter events from linter service
    this.setupLinterEventForwarding();

    // Forward container events from workspace manager
    this.setupContainerEventForwarding();

    // Forward dependency install events from workspace manager
    this.setupDependencyEventForwarding();

    // Setup automatic workspace cleanup on task completion
    this.setupAutomaticWorkspaceCleanup();

    // Initialize TDD executor if configured
    await this.initializeTDDExecutor();

    // Initialize self-repair loop
    const repairConfig = resolveRepairConfig(this.config.repair);
    this.repairLoop = new RepairLoop(this.createRepairLoopHost(), repairConfig);

    // Initialize project context analyzer (v0.6.0)
    try {
      this.projectContextAnalyzer = new ProjectContextAnalyzer(this.projectPath);
      this.cachedProjectContext = await this.projectContextAnalyzer.analyze();
    } catch (error) {
      // Non-fatal: project context is optional enrichment
      console.warn(`Project context analysis failed: ${(error as Error).message}`);
    }

    // Initialize codebase intelligence (v0.6.0 - opt-in)
    if ((this.effectiveConfig as any).codebaseIntelligence?.enabled !== false) {
      try {
        this.codebaseIntelligence = new CodebaseIntelligenceService({
          enableCaching: true,
          enableIncrementalIndexing: true,
        });
        await this.codebaseIntelligence.initialize(this.projectPath);
      } catch (error) {
        // Non-fatal: codebase intelligence is optional
        console.warn(`Codebase intelligence initialization failed: ${(error as Error).message}`);
        this.codebaseIntelligence = undefined;
      }
    }

    // Initialize smart context manager (v0.6.0)
    this.smartContextManager = new SmartContextManager({
      maxTokensPerTask: this.effectiveConfig.limits.maxTokensPerTask || 100000,
    });

    this.initialized = true;
  }

  /**
   * Initialize the AI platform driver based on configuration
   */
  private async initializeDriver(): Promise<void> {
    const { DriverFactory } = await import('./drivers/index.js');
    const primaryProvider = this.config.providers?.primary || 'anthropic';
    this.driver = DriverFactory.getDriver(primaryProvider);
    await this.driver.initialize();
  }

  // --------------------------------------------------------------------------
  // Self-Repair Loop Helpers
  // --------------------------------------------------------------------------

  /**
   * Get the resolved repair loop configuration from the project config.
   */
  private getRepairConfig(): RepairConfig {
    return resolveRepairConfig(this.config.repair);
  }

  /**
   * Determine whether the repair loop should attempt to fix a stage failure.
   * Returns false for planning stages, unrecoverable errors, or skipped categories.
   */
  private isRepairEligible(stage: WorkflowStage, error: Error, result: StageResult): boolean {
    const config = this.getRepairConfig();

    // Don't repair planning stages — they decompose tasks, not produce code
    if (stage.name.toLowerCase().includes('plan')) return false;

    // Check if error category is in skip list
    const classified = this.repairErrorClassifier.classify(
      error,
      result as unknown as import('./repair-loop/repair-types.js').StageResult,
      [],
    );
    if (classified.length > 0) {
      const primaryCategory = classified[0].category;
      if (config.skipCategories.includes(primaryCategory)) return false;
      if (classified.every(e => !e.isRecoverable)) return false;
    }

    // Check parallel stage setting
    if (stage.parallel && !config.repairParallelStages) return false;

    return true;
  }

  /**
   * Create the RepairLoopHost implementation that bridges the repair loop
   * to the orchestrator's capabilities (Claude queries, file I/O, persistence).
   */
  private createRepairLoopHost(): RepairLoopHost {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const orchestrator = this;
    return {
      async queryAgent(prompt: string, model: string, options?: RepairQueryOptions): Promise<RepairQueryResult> {
        let text = '';
        let inputTokens = 0;
        let outputTokens = 0;

        // Resolve the model alias through the driver
        const resolvedModel = orchestrator.driver.resolveModel(model);

        // Use the platform-agnostic driver instead of the Claude SDK directly
        for await (const event of orchestrator.driver.stream({
          prompt,
          model: resolvedModel,
          maxTurns: options?.maxTurns || 20,
          cwd: options?.cwd || orchestrator.projectPath,
        })) {
          switch (event.type) {
            case 'text':
              text += event.content;
              break;
            case 'usage':
              inputTokens += event.inputTokens;
              outputTokens += event.outputTokens;
              break;
            case 'error':
              // Log error but don't throw - the repair loop handles failures
              text += `\n[Driver Error: ${event.message}]`;
              break;
            // status and complete events are informational, no action needed
          }
        }

        const tokensUsed = inputTokens + outputTokens;
        // Estimate cost based on tokens (rough approximation)
        const costUsd = tokensUsed * 0.000015; // ~$15/MTok average

        return { text, tokensUsed, costUsd };
      },

      async rerunStage(taskId: string, stageName: string): Promise<import('./repair-loop/repair-types.js').StageResult> {
        const task = await orchestrator.store.getTask(taskId);
        if (!task) throw new Error(`Task ${taskId} not found for re-run`);

        const workflow = orchestrator.workflows[task.workflow || 'default'];
        if (!workflow) throw new Error(`Workflow not found for task ${taskId}`);

        const stage = workflow.stages.find(s => s.name === stageName);
        if (!stage) throw new Error(`Stage "${stageName}" not found in workflow`);

        const agent = orchestrator.agents[stage.agent] || { name: stage.agent, role: stage.agent, model: 'sonnet' };
        const stageResults = new Map<string, StageResult>();

        try {
          const result = await orchestrator.executeWorkflowStage(task, stage, agent, workflow, stageResults, undefined);
          return result as unknown as import('./repair-loop/repair-types.js').StageResult;
        } catch (err) {
          return {
            stageName,
            agent: stage.agent,
            status: 'failed' as const,
            outputs: {},
            artifacts: [],
            summary: `Re-run failed: ${(err as Error).message}`,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, totalCostCents: 0, executionTimeMs: 0 },
            error: (err as Error).message,
            startedAt: new Date(),
            completedAt: new Date(),
          };
        }
      },

      async readFiles(filePaths: string[]): Promise<Record<string, string>> {
        const contents: Record<string, string> = {};
        for (const filePath of filePaths) {
          try {
            const fullPath = path.isAbsolute(filePath)
              ? filePath
              : path.join(orchestrator.projectPath, filePath);
            contents[filePath] = await fs.readFile(fullPath, 'utf-8');
          } catch {
            // File not found or unreadable — skip
          }
        }
        return contents;
      },

      async getTask(taskId: string): Promise<Task | null> {
        return orchestrator.store.getTask(taskId);
      },

      async addFixAttempt(taskId: string, attempt: import('@apexcli/core').FixAttempt): Promise<void> {
        await orchestrator.store.addFixAttempt(taskId, attempt);
      },

      async getFixAttemptHistory(taskId: string): Promise<import('@apexcli/core').FixAttemptHistory> {
        return orchestrator.store.getFixAttemptHistory(taskId);
      },

      async getFixAttemptsForError(taskId: string, errorHash: string): Promise<import('@apexcli/core').FixAttempt[]> {
        return orchestrator.store.getFixAttemptsForError(taskId, errorHash);
      },

      emit<K extends keyof RepairLoopEvents>(event: K, ...args: Parameters<RepairLoopEvents[K]>): void {
        (orchestrator as unknown as { emit(event: string, ...args: unknown[]): void }).emit(event, ...args);
      },

      async addLog(taskId: string, log: { level: 'error' | 'debug' | 'info' | 'warn'; message: string; stage?: string }): Promise<void> {
        await orchestrator.store.addLog(taskId, log);
      },
    };
  }

  /**
   * Discover and register MCP tools from all enabled servers
   * Called during initialization and can be called to refresh tools
   */
  private async discoverAndRegisterMcpTools(): Promise<void> {
    if (!this.mcpConnectionManager || !this.mcpToolRegistry) {
      return;
    }

    // Discover available servers from config
    const servers = this.mcpConnectionManager.discoverServers();

    if (servers.length === 0) {
      return;
    }

    // Connect to servers in parallel with a timeout
    const normalizedServers = getMCPServers(this.config);
    const connectionTimeout = 5000; // 5 second timeout per connection

    const connectionPromises = servers.map(async (serverConfig) => {
      // Find the config key by matching the server name
      const serverId = Object.keys(normalizedServers).find(key => {
        const configEntry = normalizedServers[key];
        return configEntry.name === serverConfig.name || key === serverConfig.name;
      });

      if (!serverId) return null;

      try {
        // Add timeout wrapper to prevent slow connections from blocking startup
        const connection = await Promise.race([
          this.mcpConnectionManager!.connect(serverId),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Connection timeout after ${connectionTimeout}ms`)), connectionTimeout)
          )
        ]);
        return { serverId, connection };
      } catch (error) {
        console.warn(`Failed to connect to MCP server '${serverId}':`, error instanceof Error ? error.message : error);
        return null;
      }
    });

    // Wait for all connections to complete (or fail)
    const results = await Promise.allSettled(connectionPromises);

    // Add successful connections to registry
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.connection) {
        try {
          await this.mcpToolRegistry.addConnection(result.value.connection);
        } catch (error) {
          console.warn(`Failed to register MCP server '${result.value.serverId}':`, error);
        }
      }
    }

    // Refresh tools from all connected servers (with timeout)
    try {
      await Promise.race([
        this.mcpToolRegistry.refreshAllTools(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tool refresh timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.warn('MCP tool refresh timed out or failed:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Load workflow definitions and parse gates configuration
   */
  private async loadGates(): Promise<void> {
    // Load all workflows
    this.workflows = await loadWorkflows(this.projectPath);

    // Clear existing gates
    this.gates.clear();

    // Extract gates from config
    if (this.config.autonomy?.gates) {
      for (const gate of this.config.autonomy.gates) {
        const gateId = gate.id || gate.name || `gate-${this.gates.size}`;
        this.gates.set(gateId, { ...gate, id: gateId });
      }
    }

    // Extract gates from workflows
    for (const [workflowName, workflow] of Object.entries(this.workflows)) {
      if (workflow.gates) {
        for (const workflowGate of workflow.gates) {
          // Create an ApprovalGate from the WorkflowGate
          const approvalGate: ApprovalGate = {
            id: workflowGate.id,
            type: 'custom',
            name: workflowGate.name || workflowGate.id,
            description: workflowGate.description || `Gate ${workflowGate.id} for workflow ${workflowName}`,
            required: workflowGate.required !== false, // default to true
            autoApprove: workflowGate.autoApprove || false,
            autoApproveOnTimeout: false,
            minApprovals: 1,
            timeout: workflowGate.timeout,
            tags: workflowGate.tags || [],
          };
          this.gates.set(workflowGate.id, approvalGate);
        }
      }

      // Parse stage.gate references
      if (workflow.stages) {
        for (const stage of workflow.stages) {
          if (stage.gate && !this.gates.has(stage.gate)) {
            // Create a default gate for stage references that don't exist
            const defaultGate: ApprovalGate = {
              id: stage.gate,
              type: 'custom',
              name: stage.gate,
              description: `Approval gate for stage ${stage.name} in workflow ${workflowName}`,
              required: true,
              autoApprove: false,
              autoApproveOnTimeout: false,
              minApprovals: 1,
              tags: [`workflow:${workflowName}`, `stage:${stage.name}`],
            };
            this.gates.set(stage.gate, defaultGate);
          }
        }
      }
    }
  }

  /**
   * Create a new task with specified configuration and options
   *
   * @param options - Task creation options
   * @param options.description - Human-readable description of what needs to be accomplished
   * @param options.acceptanceCriteria - Optional criteria that define when the task is complete
   * @param options.workflow - Workflow name to use (defaults to 'feature')
   * @param options.autonomy - Autonomy level for the task (defaults to config setting)
   * @param options.priority - Task priority: low, normal, high, critical (defaults to 'normal')
   * @param options.effort - Expected effort level: small, medium, large, epic (defaults to 'medium')
   * @param options.maxRetries - Maximum number of retry attempts (defaults to config setting)
   * @param options.dependsOn - Array of task IDs that must complete before this task
   * @param options.parentTaskId - Parent task ID if this is a subtask
   * @param options.subtaskStrategy - Strategy for handling subtask decomposition
   * @param options.dryRun - If true, create task but don't execute (for testing)
   *
   * @returns Promise resolving to the created Task object
   * @throws {Error} When task creation fails or dependencies are invalid
   *
   * @example
   * ```typescript
   * const task = await orchestrator.createTask({
   *   description: 'Add user authentication to the dashboard',
   *   acceptanceCriteria: 'Users can log in and access protected routes',
   *   workflow: 'feature-development',
   *   priority: 'high',
   *   effort: 'medium'
   * });
   * console.log('Created task:', task.id);
   * ```
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
    dryRun?: boolean;
    multimodalInputs?: MultimodalInput[];
  }): Promise<Task> {
    await this.ensureInitialized();

    const taskId = generateTaskId();
    const workflow = options.workflow || 'feature';
    const autonomy = options.autonomy || this.effectiveConfig.autonomy.level;
    const priority = options.priority || 'normal';
    const effort = options.effort || 'medium';
    const maxRetries = options.maxRetries ?? this.effectiveConfig.limits.maxRetries;

    // Process multimodal inputs if provided
    let multimodalContext: MultimodalContext | undefined;
    if (options.multimodalInputs && options.multimodalInputs.length > 0) {
      try {
        multimodalContext = await this.multimodalInputHandler.processInputs(options.multimodalInputs);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Multimodal input processing failed: ${errorMessage}`);
      }
    }

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
      dryRun: options.dryRun || false,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        totalCostCents: 0,
        executionTimeMs: 0,
      },
      logs: [],
      artifacts: [],
      multimodalContext,
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
            preserveOnFailure: this.effectiveConfig.git.worktree?.preserveOnFailure ?? false,
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
   * Execute a task with its assigned workflow and handle retries, failures, and checkpointing
   *
   * Orchestrates the complete task execution including:
   * - Workflow stage progression with designated agents
   * - Automatic retry logic on failures
   * - Progress tracking and event emission
   * - Permission and policy enforcement
   * - Resource usage monitoring
   *
   * @param taskId - Unique identifier of the task to execute
   * @param options - Execution options
   * @param options.autoRetry - Enable automatic retries on failure (defaults to true)
   * @param options.cliFlags - CLI-specific flags for execution behavior
   * @param options.cliFlags.diffPreview - Show diff preview before applying changes
   *
   * @returns Promise that resolves when task execution completes (successfully or failed)
   * @throws {Error} When task is not found, already running, or initialization fails
   *
   * @example
   * ```typescript
   * // Execute a task with automatic retries
   * await orchestrator.executeTask('task-abc123', {
   *   autoRetry: true,
   *   cliFlags: { diffPreview: true }
   * });
   *
   * // Listen to execution events
   * orchestrator.on('task:completed', (task) => {
   *   console.log('Task completed:', task.id);
   * });
   * ```
   */
  async executeTask(taskId: string, options?: { autoRetry?: boolean; cliFlags?: { diffPreview?: boolean } }): Promise<void> {
    await this.ensureInitialized();

    // Concurrent execution guard: prevent the same task from being executed twice
    if (this.executingTaskIds.has(taskId)) {
      await this.store.addLog(taskId, {
        level: 'warn',
        message: `Skipping concurrent execution — task ${taskId} is already being executed`,
      });
      return;
    }
    this.executingTaskIds.add(taskId);

    // Initialize tool call tracking for this task
    this.taskToolCallCounts.set(taskId, { total: 0, mutating: 0 });

    try {
      await this._executeTaskInner(taskId, options);
    } finally {
      this.executingTaskIds.delete(taskId);
    }
  }

  /**
   * Inner task execution logic, wrapped by executeTask's guard
   */
  private async _executeTaskInner(taskId: string, options?: { autoRetry?: boolean; cliFlags?: { diffPreview?: boolean } }): Promise<void> {
    // Store CLI flags for current task
    this.currentTaskCliFlags = options?.cliFlags;

    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Handle dry-run mode - skip actual execution but simulate the process
    if (task.dryRun) {
      await this.store.addLog(taskId, {
        level: 'info',
        message: '🚀 DRY-RUN MODE: Simulating task execution without making actual changes',
      });
      await this.executeDryRunTask(taskId, task);
      return;
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

    // Check policy before task starts execution
    const policyCheckResult = this.policyEnforcer.checkTaskStart(task);

    // Log policy check results
    await this.store.addLog(taskId, {
      level: 'info',
      message: `Policy check completed: ${policyCheckResult.passed ? 'passed' : 'failed'} (${policyCheckResult.failedCount} errors, ${policyCheckResult.warningCount} warnings)`,
    });

    // Map results to PolicyViolation format
    const violations = policyCheckResult.results
      .filter(result => !result.passed)
      .map(result => ({
        id: crypto.randomUUID(),
        rule: result.ruleId,
        message: result.message,
        severity: (result.severity === 'error' ? 'critical' :
                   result.severity === 'warning' ? 'high' : 'low') as 'low' | 'medium' | 'high' | 'critical',
        blocking: result.severity === 'error',
        policyType: result.ruleType,
        timestamp: new Date(),
        resolved: false,
        context: result.details,
      }));

    // Update task with policy check results
    await this.store.updateTask(taskId, {
      policyCheckResult: {
        passed: policyCheckResult.passed,
        blocked: policyCheckResult.failedCount > 0,
        violationCount: violations.length,
        violations,
        checkedAt: policyCheckResult.evaluatedAt,
        policyName: policyCheckResult.policyName,
        enforcementMode: this.policyEnforcer.enforcementMode,
      },
      updatedAt: new Date(),
    });

    // If policy check failed with error-level violations, block the task
    if (!policyCheckResult.passed && policyCheckResult.failedCount > 0) {
      await this.updateTaskStatus(taskId, 'failed', 'Task blocked by policy violations');
      await this.store.addLog(taskId, {
        level: 'error',
        message: `Task blocked by policy violations: ${policyCheckResult.failedCount} error(s) found`,
      });
      throw new Error(`Task blocked by policy violations: ${policyCheckResult.failedCount} error(s) found`);
    }

    // Update status
    await this.updateTaskStatus(taskId, 'in-progress');
    this.emit('task:started', task);

    // Set current task for event tracking
    this.currentTaskId = taskId;

    // Build enriched context from codebase intelligence (v0.6.0)
    if (this.codebaseIntelligence) {
      try {
        this.cachedEnrichedContext = await enrichTaskContext(
          task.description,
          this.codebaseIntelligence,
          { maxTokens: Math.floor((this.effectiveConfig.limits.maxTokensPerTask || 100000) * 0.10) }
        );
        await this.store.addLog(taskId, {
          level: 'info',
          message: `Codebase intelligence: found ${this.cachedEnrichedContext.relevantFiles.length} relevant files, ${this.cachedEnrichedContext.relevantSymbols.length} symbols`,
        });
      } catch (error) {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: `Codebase intelligence enrichment failed: ${(error as Error).message}`,
        });
      }
    }

    // Build task history context from previous learnings (v0.6.0)
    if (this.learningExtractor) {
      try {
        this.cachedTaskHistoryContext = this.learningExtractor.buildTaskHistoryContext(task.description);
      } catch {
        // Non-fatal - learning context is optional
      }
    }

    // Build unified context using SmartContextManager (v0.6.0)
    if (this.smartContextManager) {
      try {
        this.cachedUnifiedContext = this.smartContextManager.buildContext({
          taskDescription: task.description,
          projectContext: this.cachedProjectContext,
          enrichedContext: this.cachedEnrichedContext ? formatEnrichedContext(this.cachedEnrichedContext) : undefined,
          memoryManager: this.memoryManager,
          learningExtractor: this.learningExtractor,
        });
      } catch (error) {
        // Non-fatal
        console.warn(`Smart context build failed: ${(error as Error).message}`);
      }
    }

    // Initialize replay bundle builder if configured (v0.6.0)
    if ((this.effectiveConfig as any).replay?.enabled) {
      this.replayBundleBuilder = new ReplayBundleBuilder({
        taskId,
        taskDescription: task.description,
        workflow: task.workflow,
        projectPath: this.projectPath,
        branchName: task.branchName || undefined,
      });
    }

    // Discover MCP tools at task start and merge with built-in tools
    let discoveredMcpTools: string[] = [];
    let builtInTools: string[] = [];

    try {
      // Refresh MCP tools to ensure we have the latest available tools
      if (this.mcpToolRegistry) {
        await this.mcpToolRegistry.refreshAllTools();
        await this.store.addLog(taskId, {
          level: 'info',
          message: 'Refreshed MCP tool registry at task start',
        });

        // Get available MCP tool names
        const mcpTools = this.mcpToolRegistry.getAvailableTools();
        discoveredMcpTools = mcpTools.map(tool => tool.claudeTool.name);

        await this.store.addLog(taskId, {
          level: 'info',
          message: `Discovered ${discoveredMcpTools.length} MCP tools: ${discoveredMcpTools.join(', ')}`,
        });
      }

      // Define built-in tools that should always be available
      // These are the core Claude Code tools that APEX workflows depend on
      builtInTools = [
        'Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'LSP',
        'Task', 'AskUserQuestion', 'TodoWrite', 'WebFetch', 'WebSearch',
        'EnterPlanMode', 'ExitPlanMode'
      ];

      // Merge discovered MCP tools with built-in tools (remove duplicates)
      const combinedTools = Array.from(new Set([...builtInTools, ...discoveredMcpTools]));

      // Store combined tools for use during workflow execution
      this.currentTaskTools = combinedTools;

      await this.store.addLog(taskId, {
        level: 'info',
        message: `Task ${taskId} configured with ${combinedTools.length} total tools (${builtInTools.length} built-in + ${discoveredMcpTools.length} MCP)`,
      });

    } catch (error) {
      await this.store.addLog(taskId, {
        level: 'warn',
        message: `Failed to discover MCP tools: ${(error as Error).message}. Using built-in tools only.`,
      });

      // Fallback to built-in tools only
      this.currentTaskTools = [
        'Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'LSP',
        'Task', 'AskUserQuestion', 'TodoWrite', 'WebFetch', 'WebSearch',
        'EnterPlanMode', 'ExitPlanMode'
      ];
    }

    // Resource tracking is initialized via the task's usage object
    // No separate initialization needed - usage is tracked incrementally

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
          // Ghost completion detection: if a task completed with no mutating tool calls
          // and minimal tokens, it likely didn't do any actual work
          const toolCounts = this.taskToolCallCounts.get(taskId) || { total: 0, mutating: 0 };
          const currentTask = await this.store.getTask(taskId);
          const totalTokens = currentTask?.usage?.totalTokens || 0;
          const isGhostCompletion = toolCounts.mutating === 0 && totalTokens < 5000;

          if (isGhostCompletion && task.parentTaskId) {
            // Subtask completed without doing any work — flag as no-op
            await this.store.addLog(taskId, {
              level: 'warn',
              message: `Ghost completion detected: task completed with ${toolCounts.total} tool calls (${toolCounts.mutating} mutating) and ${totalTokens} tokens. ` +
                `This task likely found no work to do. Marking as completed but flagging for review.`,
              metadata: {
                ghostCompletion: true,
                ghostCompletionReason: 'no_mutating_tool_calls',
                toolCallCounts: toolCounts,
              },
            });
          }

          // Clean up tool call tracking
          this.taskToolCallCounts.delete(taskId);

          await this.updateTaskStatus(taskId, 'completed');
          const completedTask = await this.store.getTask(taskId);
          this.emit('task:completed', completedTask!);

          // Finalize replay bundle if recording
          if (this.replayBundleBuilder) {
            try {
              const replayPath = await this.replayBundleBuilder.finalize({
                totalTokens: completedTask?.usage?.totalTokens || 0,
                estimatedCost: completedTask?.usage?.estimatedCost || 0,
                agentModels: {},
              });
              await this.store.addLog(taskId, {
                level: 'info',
                message: `Replay bundle saved: ${replayPath}`,
              });
            } catch (error) {
              await this.store.addLog(taskId, {
                level: 'warn',
                message: `Failed to save replay bundle: ${(error as Error).message}`,
              });
            }
            this.replayBundleBuilder = undefined;
          }

          // Extract learnings from completed task (v0.6.0)
          if (this.learningExtractor && completedTask) {
            try {
              const stageResultsForLearning = this.cachedStageResults || new Map();
              const learnings = this.learningExtractor.extractFromTask(
                taskId,
                completedTask.description,
                stageResultsForLearning
              );
              if (learnings.length > 0) {
                await this.store.addLog(taskId, {
                  level: 'info',
                  message: `Extracted ${learnings.length} learnings from task completion`,
                });
              }
            } catch (error) {
              await this.store.addLog(taskId, {
                level: 'warn',
                message: `Learning extraction failed: ${(error as Error).message}`,
              });
            }
            // Clear cached stage results
            this.cachedStageResults = undefined;
          }

          // Clear current task tracking if this was the current task
          if (this.currentTaskId === taskId) {
            this.currentTaskId = null;
            this.currentTaskTools = [];
          }

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

          // If this is a subtask, check if all sibling subtasks are complete
          // and update the parent task status accordingly
          if (task.parentTaskId && completedTask) {
            await this.checkAndCompleteParentTask(task.parentTaskId);
          }
        }
        // If shouldComplete is false, subtasks are paused/incomplete
        // Task stays in-progress and can be resumed later

        return; // Exit the retry loop (either completed or staying in-progress)
      } catch (error) {
        lastError = error as Error;

        // Check if this is a pausable error (rate limit, usage limit, or token limit)
        const pauseReason = this.isPausableError(lastError);
        if (pauseReason) {
          if (pauseReason === 'rate_limit') {
            const retryAfterSeconds = this.extractRetryAfterSeconds(lastError);
            await this.store.addLog(taskId, {
              level: 'warn',
              message: `Rate limit reached. Pausing task for ${retryAfterSeconds} seconds.`,
            });
            await this.pauseTask(taskId, 'rate_limit', retryAfterSeconds);
          } else if (pauseReason === 'token_limit') {
            // Token/context limit - task needs to be resumed with context summarization
            await this.store.addLog(taskId, {
              level: 'warn',
              message: `Token/context limit reached. Task paused. Consider breaking into smaller subtasks or resume to continue with context summarization.`,
            });
            await this.pauseTask(taskId, 'token_limit');
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

          // Clear current task tracking if this was the current task
          if (this.currentTaskId === taskId) {
            this.currentTaskId = null;
            this.currentTaskTools = [];
          }
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
           message.includes('hit your limit') ||
           message.includes("you've hit your limit") ||
           (message.includes('resets') && (message.includes('limit') || message.includes('upgrade'))) ||
           message.includes('/upgrade') ||
           message.includes('extra-usage') ||
           // Token/context limit errors - should pause, not fail
           message.includes('token limit') ||
           message.includes('context length') ||
           message.includes('context window') ||
           message.includes('max_tokens') ||
           message.includes('maximum context') ||
           message.includes('conversation too long') ||
           message.includes('input too long');
  }

  /**
   * Check if an error is specifically a token/context limit error
   */
  private isTokenLimitError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('token limit') ||
           message.includes('context length') ||
           message.includes('context window') ||
           message.includes('max_tokens') ||
           message.includes('maximum context') ||
           message.includes('conversation too long') ||
           message.includes('input too long');
  }

  /**
   * Check if an error should pause the task (rate limit, usage limit, or token limit)
   */
  private isPausableError(error: Error): 'rate_limit' | 'usage_limit' | 'token_limit' | false {
    if (this.isRateLimitError(error)) {
      return 'rate_limit';
    }
    if (this.isTokenLimitError(error)) {
      return 'token_limit';
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
    reason: 'rate_limit' | 'usage_limit' | 'budget' | 'manual' | 'session_limit' | 'container_failure' | 'token_limit' | 'approval_gate',
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
   * Resume a paused task with subtask readiness check and exponential backoff
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

    // Subtask readiness check: if this task was paused because a subtask was paused,
    // verify the subtask is actually ready before resuming the parent
    if (task.pauseReason?.startsWith('subtask_paused:')) {
      const pausedSubtaskId = task.pauseReason.replace('subtask_paused:', '');
      const pausedSubtask = await this.store.getTask(pausedSubtaskId);

      if (pausedSubtask && pausedSubtask.status === 'paused') {
        // The subtask is still paused — don't resume the parent yet.
        // Apply exponential backoff: double the delay each time (capped at 30 minutes)
        const baseDelay = 120_000; // 2 minutes
        const backoffDelay = Math.min(
          baseDelay * Math.pow(2, task.resumeAttempts),
          1_800_000 // 30 minutes max
        );

        await this.store.addLog(taskId, {
          level: 'info',
          message: `Subtask ${pausedSubtaskId} is still paused (${pausedSubtask.pauseReason}). ` +
            `Deferring resume with exponential backoff: ${Math.round(backoffDelay / 1000)}s ` +
            `(attempt ${task.resumeAttempts + 1})`,
        });

        // Schedule the next auto-resume with backoff delay
        this.scheduleAutoResume(taskId, backoffDelay);
        return false;
      }

      // If the subtask is no longer paused (completed, in-progress, etc.), proceed with resume
      if (pausedSubtask && (pausedSubtask.status === 'completed' || pausedSubtask.status === 'in-progress')) {
        await this.store.addLog(taskId, {
          level: 'info',
          message: `Subtask ${pausedSubtaskId} is now ${pausedSubtask.status}. Proceeding with resume.`,
        });
      }
    }

    // Pre-check max resume attempts before clearing pause state
    const maxResumeAttempts = this.effectiveConfig.daemon?.sessionRecovery?.maxResumeAttempts ?? 3;
    const nextAttempt = task.resumeAttempts + 1;

    if (nextAttempt > maxResumeAttempts) {
      await this.failTaskWithMaxResumeError(taskId, nextAttempt, maxResumeAttempts);
      return false;
    }

    // Store original pause state in case we need to rollback
    const originalPauseState = {
      pausedAt: task.pausedAt,
      pauseReason: task.pauseReason,
      resumeAfter: task.resumeAfter,
    };

    // Clear pause-related fields and set to in-progress
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

    try {
      // Resume execution from checkpoint
      const resumed = await this.resumeTask(taskId);

      // If this is a subtask, check if parent should also resume
      if (task.parentTaskId) {
        await this.checkAndResumeParent(task.parentTaskId);
      }

      return resumed;
    } catch (error) {
      // Check if this is a rate limit error - if so, rollback to paused state
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.isUsageLimitError(err)) {
        // Get current task to find current resumeAttempts (which was incremented by resumeTask)
        const currentTask = await this.store.getTask(taskId);
        const rolledBackAttempts = Math.max(0, (currentTask?.resumeAttempts ?? 1) - 1);

        // Rollback to paused state - don't count this as a resume attempt
        await this.store.updateTask(taskId, {
          status: 'paused',
          pausedAt: originalPauseState.pausedAt || new Date(),
          pauseReason: 'usage_limit',
          resumeAfter: originalPauseState.resumeAfter,
          resumeAttempts: rolledBackAttempts,
          updatedAt: new Date(),
        });

        await this.store.addLog(taskId, {
          level: 'warn',
          message: `Resume failed due to usage limit - task remains paused (attempts rolled back to ${rolledBackAttempts}). Error: ${err.message}`,
        });

        // Re-throw so caller knows it failed
        throw err;
      }

      // For other errors, task stays in-progress but we should re-throw
      throw error;
    }
  }

  /**
   * Check if a parent task should resume (all subtasks are no longer paused)
   * Recursively cascades up the parent chain
   */
  private async checkAndResumeParent(parentTaskId: string): Promise<void> {
    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask) {
      return;
    }

    // If parent is completed, failed, or cancelled — nothing to do
    if (['completed', 'failed', 'cancelled'].includes(parentTask.status)) {
      return;
    }

    // If parent is already in-progress, just propagate up
    if (parentTask.status === 'in-progress') {
      if (parentTask.parentTaskId) {
        await this.checkAndResumeParent(parentTask.parentTaskId);
      }
      return;
    }

    // Parent is paused or pending — check if it should become in-progress
    if (parentTask.status === 'paused') {
      // For subtask_paused: check if all subtasks are no longer paused
      if (parentTask.pauseReason?.startsWith('subtask_paused:')) {
        const subtasks = await this.getSubtasks(parentTaskId);
        const anyPaused = subtasks.some(s => s.status === 'paused');
        if (anyPaused) {
          return; // Still have paused subtasks, can't resume
        }
      }
      // For usage_limit/token_limit/other: a child is now running so the limit has passed
    }

    // Resume the parent (from paused or pending)
    await this.store.updateTask(parentTaskId, {
      status: 'in-progress',
      currentStage: 'subtask-execution',
      pausedAt: undefined,
      pauseReason: undefined,
      resumeAfter: undefined,
      updatedAt: new Date(),
    });

    await this.store.addLog(parentTaskId, {
      level: 'info',
      message: `Parent task resumed from ${parentTask.status} - child task is active`,
    });

    // Recursively propagate up
    if (parentTask.parentTaskId) {
      await this.checkAndResumeParent(parentTask.parentTaskId);
    }
  }

  /**
   * Parse and enhance error messages from Claude SDK
   * Extracts specific error types for better user feedback
   */
  private parseErrorMessage(error: Error): string {
    const message = error.message || String(error);
    const lowerMessage = message.toLowerCase();
    const sanitizedMessage = sanitizeErrorMessage(message);

    // Token/context limit errors
    if (lowerMessage.includes('token') || lowerMessage.includes('context length') ||
        lowerMessage.includes('max_tokens') || lowerMessage.includes('context window')) {
      return `Token limit exceeded: The conversation became too long. Consider breaking down the task into smaller subtasks. Original error: ${sanitizedMessage}`;
    }

    // Rate limiting
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests') ||
        lowerMessage.includes('429')) {
      return `Rate limit exceeded: Too many API requests. The task will be retried automatically after a delay. Original error: ${sanitizedMessage}`;
    }

    // Authentication errors
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication') ||
        lowerMessage.includes('api key') || lowerMessage.includes('401')) {
      return `Authentication error: Invalid or missing API credentials. Please check your API key configuration. Original error: ${sanitizedMessage}`;
    }

    // Permission/access errors
    if (lowerMessage.includes('forbidden') || lowerMessage.includes('permission') ||
        lowerMessage.includes('403')) {
      return `Permission denied: You don't have access to the requested resource. Original error: ${sanitizedMessage}`;
    }

    // Network errors
    if (lowerMessage.includes('network') || lowerMessage.includes('connection') ||
        lowerMessage.includes('econnrefused') || lowerMessage.includes('timeout')) {
      return `Network error: Failed to connect to the API. Please check your internet connection and try again. Original error: ${sanitizedMessage}`;
    }

    // Budget exceeded
    if (lowerMessage.includes('budget') || lowerMessage.includes('cost limit')) {
      return `Budget limit exceeded: The task exceeded the configured cost limit. Original error: ${sanitizedMessage}`;
    }

    // Usage/billing limit exceeded
    if (lowerMessage.includes('usage limit') || lowerMessage.includes('credit') ||
        lowerMessage.includes('billing') || lowerMessage.includes('quota') ||
        lowerMessage.includes('spending limit') || lowerMessage.includes('insufficient') ||
        lowerMessage.includes('exceeded your') || lowerMessage.includes('monthly limit') ||
        lowerMessage.includes('daily limit') || lowerMessage.includes('limit reached') ||
        lowerMessage.includes('/upgrade') || lowerMessage.includes('extra-usage')) {
      return `Usage limit reached: Your API usage limit has been exceeded. The task has been paused. Resume when your limit resets or add more credits. Original error: ${sanitizedMessage}`;
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

      return `Process failed with exit code ${exitCode}. Original error: ${sanitizedMessage}`;
    }

    // Server errors
    if (lowerMessage.includes('500') || lowerMessage.includes('502') ||
        lowerMessage.includes('503') || lowerMessage.includes('internal server error')) {
      return `Server error: The API service encountered an internal error. This is usually temporary - please try again. Original error: ${sanitizedMessage}`;
    }

    // Invalid request
    if (lowerMessage.includes('invalid') || lowerMessage.includes('bad request') ||
        lowerMessage.includes('400')) {
      return `Invalid request: The request was malformed or contained invalid parameters. Original error: ${sanitizedMessage}`;
    }

    // Default: return the sanitized original message
    return sanitizedMessage.length > 0 ? sanitizedMessage : 'An unknown error occurred during task execution';
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a stage should pause for approval gate
   */
  private shouldPauseForGate(stage: WorkflowStage): { pause: boolean; gate?: ApprovalGate } {
    // No gate configured
    if (!stage.gate) {
      return { pause: false };
    }

    // Lookup gate definition
    const gate = this.gates.get(stage.gate);
    if (!gate) {
      // Log warning but don't block execution
      console.warn(`Gate "${stage.gate}" referenced by stage "${stage.name}" not found`);
      return { pause: false };
    }

    // Auto-approve gates don't pause
    if (gate.autoApprove) {
      return { pause: false };
    }

    // Non-required gates can be skipped (optional behavior)
    if (!gate.required) {
      // Could emit advisory event but not pause
      return { pause: false };
    }

    return { pause: true, gate };
  }

  /**
   * Summarize completed stages for approval context
   */
  private summarizeCompletedStages(stageResults: Map<string, StageResult>): string {
    if (stageResults.size === 0) {
      return 'No stages completed yet.';
    }

    const summaries = Array.from(stageResults.entries()).map(([stageName, result]) => {
      return `${stageName}: ${result.status} - ${result.summary.substring(0, 100)}`;
    });

    return summaries.join('\n');
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

    // If this task already has subtasks from a previous decomposition, skip workflow stages
    // and go directly to subtask execution. This prevents duplicate subtask creation on retry.
    const currentTaskState = await this.store.getTask(task.id);
    if (currentTaskState?.subtaskIds && currentTaskState.subtaskIds.length > 0) {
      await this.store.addLog(task.id, {
        level: 'info',
        message: `Task already has ${currentTaskState.subtaskIds.length} subtasks from previous decomposition. Resuming subtask execution.`,
      });

      await this.store.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'subtask-execution',
        updatedAt: new Date(),
      });

      const allSubtasksComplete = await this.executeSubtasks(task.id);
      if (allSubtasksComplete) {
        await this.store.addLog(task.id, {
          level: 'info',
          message: `All subtasks completed. Workflow finished via decomposition.`,
        });
        return true;
      } else {
        await this.store.addLog(task.id, {
          level: 'info',
          message: `Subtask execution incomplete. Task will remain in-progress.`,
        });
        return false;
      }
    }

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

      // Check for approval gates before executing stages
      for (const stage of readyStages) {
        const gateCheck = this.shouldPauseForGate(stage);
        if (gateCheck.pause && gateCheck.gate) {
          // Stage has a required gate - pause task for approval
          const agent = this.agents[stage.agent];
          if (!agent) {
            throw new Error(`Agent "${stage.agent}" not found for stage "${stage.name}"`);
          }

          // Create ApprovalState
          const approvalState: ApprovalState = {
            id: generateApprovalId(),
            taskId: task.id,
            gateName: stage.gate!,
            status: 'pending',
            requestedAt: new Date(),
            stage: stage.name,
            agent: stage.agent,
            approvalsReceived: 0,
            approvalsRequired: gateCheck.gate.minApprovals || 1,
            timeoutMinutes: gateCheck.gate.timeout,
            expiresAt: gateCheck.gate.timeout ? new Date(Date.now() + gateCheck.gate.timeout * 60000) : undefined,
            context: {
              workflowName: workflow.name,
              stageDescription: stage.description,
              gateDescription: gateCheck.gate.description,
            },
          };

          // Save approval state to database
          await this.store.saveApprovalState(approvalState);

          // Log approval request for audit
          await this.store.logApprovalRequest(task.id, `Approval gate: ${stage.gate} - ${gateCheck.gate.description || 'No description'}`);

          // Log autonomy mode change for audit (transitioning to approval-required state)
          await this.store.logModeChange(
            task.id,
            task.autonomy,
            'supervised',
            `Approval gate triggered: ${stage.gate} - requiring manual oversight`
          );

          // Get current conversation state for checkpoint
          const currentTask = await this.store.getTask(task.id);
          const conversationState = currentTask?.conversation || [];

          // Save checkpoint with gate context
          const checkpointId = await this.saveCheckpoint(task.id, {
            stage: stage.name,
            stageIndex: workflow.stages.findIndex(s => s.name === stage.name),
            conversationState,
            metadata: {
              pauseReason: 'approval_gate',
              gateName: stage.gate,
              gateId: gateCheck.gate.id,
              approvalId: approvalState.id,
              resumePoint: 'pre_stage_gate',
              completedStages: Array.from(completedStages),
              inProgressStages: [], // Stage hasn't started yet
              stageResults: Object.fromEntries(stageResults),
            },
          });

          // Create Gate record in store
          await this.store.setGate(task.id, {
            name: stage.gate!,
            status: 'pending',
            requiredAt: approvalState.requestedAt,
          });

          // Update task status to awaiting-approval
          await this.store.updateTask(task.id, {
            status: 'awaiting-approval',
            pausedAt: new Date(),
            pauseReason: 'approval_gate',
            updatedAt: new Date(),
          });

          // Approval URL can be configured via environment or passed in context
          const approvalUrl: string | undefined = undefined;

          // Emit approval-required event
          const eventData: ApprovalRequiredEventData = {
            approvalId: approvalState.id,
            taskId: task.id,
            gateName: stage.gate!,
            gateType: gateCheck.gate.type,
            description: gateCheck.gate.description,
            approvers: gateCheck.gate.approvers,
            minApprovals: gateCheck.gate.minApprovals || 1,
            timeoutMinutes: gateCheck.gate.timeout,
            expiresAt: approvalState.expiresAt,
            stage: stage.name,
            agent: stage.agent,
            timestamp: new Date(),
            context: approvalState.context,
            changesSummary: this.summarizeCompletedStages(stageResults),
            blocking: gateCheck.gate.required ?? true,
            approvalUrl,
          };

          this.emit('approval:required', eventData);

          // Emit approval:request event with ApprovalRequest payload
          const approvalRequestData: ApprovalRequest = {
            requestId: approvalState.id,
            taskId: task.id,
            description: `Approval required for ${gateCheck.gate.description || stage.gate}`,
            reason: `Workflow stage "${stage.name}" requires approval via gate "${stage.gate}" before proceeding`,
            resourceImpact: this.calculateResourceImpact(task, stage),
            id: approvalState.id, // Legacy field
            gateName: stage.gate || '',
            gateType: gateCheck.gate.type,
            approvers: gateCheck.gate.approvers,
            minApprovals: gateCheck.gate.minApprovals || 1,
            requestedAt: new Date(),
            timeoutMinutes: gateCheck.gate.timeout,
            expiresAt: approvalState.expiresAt,
            stage: stage.name,
            agent: stage.agent,
            context: {
              taskId: task.id,
              taskDescription: task.description,
              taskPriority: task.priority,
              taskWorkflow: task.workflow,
              acceptanceCriteria: task.acceptanceCriteria,
              currentStage: stage.name,
              currentAgent: stage.agent,
              approvalUrl,
              blocking: gateCheck.gate.required ?? true,
            },
            changesSummary: this.summarizeCompletedStages(stageResults),
            affectedFiles: this.getAffectedFiles(task.id),
          };

          this.emit('approval:request', approvalRequestData);

          await this.store.addLog(task.id, {
            level: 'info',
            message: `Task paused at stage "${stage.name}" for approval gate "${stage.gate}". Checkpoint ${checkpointId} saved.`,
            stage: stage.name,
            agent: stage.agent,
          });

          return false; // Workflow incomplete - task is paused
        }
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

          return { stage, result, error: null as any, decompositionRequest: result.decompositionRequest };
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
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, totalCostCents: 0, executionTimeMs: 0 },
            error: enhancedErrorMessage,
            startedAt: new Date(),
            completedAt: new Date(),
          };

          return { stage, result: failedResult, error: rawError, decompositionRequest: undefined as any };
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

        // Determine the effective error for this stage
        let stageError = error;
        if (!stageError && result.status === 'failed') {
          stageError = new Error(result.error || `Stage "${stage.name}" failed: ${result.summary}`);
        }

        // Attempt self-repair if the stage failed
        if (stageError && !firstError) {
          const repairConfig = this.getRepairConfig();
          if (repairConfig.enabled && this.isRepairEligible(stage, stageError, result)) {
            const history = await this.store.getFixAttemptHistory(task.id);
            const repairContext: RepairContext = {
              taskId: task.id,
              stageName: stage.name,
              stageAgent: stage.agent,
              workflowName: workflow.name,
              failedResult: result as unknown as import('./repair-loop/repair-types.js').StageResult,
              originalError: stageError,
              stageOutput: result.summary ? [result.summary] : [],
              history,
              config: repairConfig,
              currentState: 'idle',
              stateEnteredAt: new Date(),
              iterationCount: 0,
              repairCostSoFar: 0,
              repairTokensUsed: 0,
              loopStartedAt: new Date(),
            };

            const repairResult = await this.repairLoop.attemptRepair(repairContext);

            if (repairResult.resolved && repairResult.stageResult) {
              // Repair succeeded — replace the failed result
              stageResults.set(stage.name, repairResult.stageResult as unknown as StageResult);
              await this.store.addLog(task.id, {
                level: 'info',
                message: `Self-repair resolved stage "${stage.name}" after ${repairResult.attempts.length} attempt(s)`,
                stage: stage.name,
              });
            } else {
              // Repair could not fix — propagate failure
              firstError = stageError;
              if (repairResult.escalationReport) {
                await this.store.addLog(task.id, {
                  level: 'error',
                  message: `Self-repair escalation: ${repairResult.escalationReport.summary}`,
                  stage: stage.name,
                });
              }
            }
          } else {
            firstError = stageError;
          }
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
        // Re-check: task might already have subtasks from a concurrent decomposition
        const freshTask = await this.store.getTask(task.id);
        if (freshTask?.subtaskIds && freshTask.subtaskIds.length > 0) {
          await this.store.addLog(task.id, {
            level: 'warn',
            message: `Decomposition request ignored — task already has ${freshTask.subtaskIds.length} subtasks`,
          });
          // Skip to subtask execution with existing subtasks
          const allSubtasksComplete = await this.executeSubtasks(task.id);
          if (allSubtasksComplete) {
            await this.store.addLog(task.id, {
              level: 'info',
              message: `All subtasks completed. Workflow finished via decomposition.`,
            });
            return true;
          } else {
            await this.store.addLog(task.id, {
              level: 'info',
              message: `Subtask execution paused or incomplete. Task will remain in-progress.`,
            });
            return false;
          }
        }

        await this.store.addLog(task.id, {
          level: 'info',
          message: `Task decomposition requested: creating ${decompositionRequest.subtasks.length} subtasks with ${decompositionRequest.strategy} strategy`,
        });

        // Create subtasks (guarded against duplicates)
        const subtasks = await this.decomposeTask(
          task.id,
          decompositionRequest.subtasks,
          decompositionRequest.strategy
        );

        if (subtasks.length === 0) {
          // Decomposition was skipped (duplicate), check for existing subtasks
          const taskWithSubtasks = await this.store.getTask(task.id);
          if (taskWithSubtasks?.subtaskIds && taskWithSubtasks.subtaskIds.length > 0) {
            const allSubtasksComplete = await this.executeSubtasks(task.id);
            return allSubtasksComplete;
          }
          // No subtasks at all — continue with workflow stages
          continue;
        }

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

    // Cache stage results for post-completion learning extraction (v0.6.0)
    this.cachedStageResults = stageResults;

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
    // Use unified context from SmartContextManager when available, with individual fallbacks
    const stagePromptResult = isPlanner
      ? buildPlannerStagePromptMultimodal({
          task,
          stage,
          agent,
          workflow,
          config: this.effectiveConfig,
          previousStageResults: previousResults,
          projectContext: this.cachedProjectContext,
          enrichedContext: this.cachedUnifiedContext?.enrichedContext || (this.cachedEnrichedContext ? formatEnrichedContext(this.cachedEnrichedContext) : undefined),
          taskHistoryContext: this.cachedUnifiedContext?.taskHistoryContext || this.cachedTaskHistoryContext,
        })
      : buildStagePromptMultimodal({
          task,
          stage,
          agent,
          workflow,
          config: this.effectiveConfig,
          previousStageResults: previousResults,
          projectContext: this.cachedProjectContext,
          enrichedContext: this.cachedUnifiedContext?.enrichedContext || (this.cachedEnrichedContext ? formatEnrichedContext(this.cachedEnrichedContext) : undefined),
          memoryContext: this.cachedUnifiedContext?.memoryContext || this.memoryManager?.buildMemoryContext(task.description) || undefined,
          livingMemory: this.cachedUnifiedContext?.livingMemory || this.memoryManager?.getLivingMemoryContent() || undefined,
          taskHistoryContext: this.cachedUnifiedContext?.taskHistoryContext || this.cachedTaskHistoryContext,
        });

    // Inject resume context if available (only for the first stage being resumed)
    let stagePrompt: string | AsyncIterable<SDKUserMessage>;
    if (resumeContext) {
      if (stagePromptResult.hasMultimodalContent) {
        // For multimodal content, prepend resume context to the text block
        const resumeTextBlock: TextBlockParam = {
          type: 'text',
          text: resumeContext,
        };

        // Update the first text block to include resume context
        const updatedContentBlocks = [...stagePromptResult.contentBlocks];
        const firstTextBlockIndex = updatedContentBlocks.findIndex(block => block.type === 'text');
        if (firstTextBlockIndex >= 0) {
          const firstTextBlock = updatedContentBlocks[firstTextBlockIndex] as TextBlockParam;
          updatedContentBlocks[firstTextBlockIndex] = {
            type: 'text',
            text: `${resumeContext}\n\n${firstTextBlock.text}`,
          };
        } else {
          // If no text block found, insert at the beginning
          updatedContentBlocks.unshift(resumeTextBlock);
        }

        // Create the multimodal prompt
        stagePrompt = (async function* () {
          yield {
            type: 'user' as const,
            message: {
              role: 'user' as const,
              content: updatedContentBlocks,
            },
            parent_tool_use_id: null as string | null,
            session_id: `stage-${stage.name}-${task.id}`,
          };
        })();
      } else {
        // For text-only content, use simple concatenation
        stagePrompt = `${resumeContext}\n\n${stagePromptResult.textPrompt}`;
      }
    } else {
      // No resume context
      if (stagePromptResult.hasMultimodalContent) {
        // Create the multimodal prompt
        stagePrompt = (async function* () {
          yield {
            type: 'user' as const,
            message: {
              role: 'user' as const,
              content: stagePromptResult.contentBlocks,
            },
            parent_tool_use_id: null as string | null,
            session_id: `stage-${stage.name}-${task.id}`,
          };
        })();
      } else {
        // Use simple text prompt
        stagePrompt = stagePromptResult.textPrompt;
      }
    }

    // Create hooks context for this stage
    const hookContext: HookContext = {
      taskId: task.id,
      store: this.store,
      projectPath: this.projectPath,
      errorFeedbackLoop: this.errorFeedbackLoop,
      permissionPresetManager: this._permissionPresetManager,
      onToolUse: (tool, input) => {
        this.emit('agent:tool-use', task.id, tool, input);
      },
      eventEmitter: {
        emit: (event: string, data: unknown) => {
          this.emit(event as any, data);
        },
      },
      linterService: this.linterService,
      toolActionStore: this.toolActionStore,
      currentAgent: agent.name,
      currentStage: stage.name,
      toolStartTimes: new Map(),
      config: this.effectiveConfig,
      cliFlags: this.currentTaskCliFlags,
      aliasResolver: this.aliasResolver,
    };

    // Store the context for access during tool completion
    this.currentHookContext = hookContext;

    // Create hooks for this stage
    const hooks = this.createHooksWithManager(hookContext, agent.name, stage.name, workflow.name);

    // Track usage for this stage
    let stageUsage: TaskUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      totalCostCents: 0,
      executionTimeMs: 0,
    };

    // Collect all messages to extract summary
    const messages: string[] = [];

    // Convert agent model to SDK model format (v0.6.0)
    const sdkModel = this.driver.resolveModel(agent.model);

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
    // Log MCP tool availability for observability (debug level)
    const mcpServers = this.buildQueryMcpServers();
    const registryStats = this.mcpToolRegistry?.getStats();
    if (mcpServers && Object.keys(mcpServers).length > 0 && process.env.DEBUG) {
      console.log(`MCP Integration: ${Object.keys(mcpServers).length} servers available: ${Object.keys(mcpServers).join(', ')}`);
      if (registryStats && registryStats.totalTools > 0) {
        console.log(`MCP Tools: ${registryStats.totalTools} tools discovered across ${registryStats.activeConnections} connections`);
      }

      // Log connection status through MCPConnectionManager
      const connections = this.mcpConnectionManager?.listConnections() ?? [];
      const connectedServers = connections.filter(c => c.state === 'connected').map(c => c.serverId);
      if (connectedServers.length > 0) {
        console.log(`MCP Connections: ${connectedServers.length} active connections: ${connectedServers.join(', ')}`);
      }
    }

    for await (const message of this.driver.stream({
      prompt: typeof stagePrompt === 'string' ? stagePrompt : stagePromptResult.textPrompt,
      systemPrompt: agent.prompt,
      model: sdkModel,
      maxTurns: Math.min(this.effectiveConfig.limits.maxTurns, 50),
      cwd: workingDirectory,
      mcpServers: mcpServers,
    })) {
      // Collect text content for summary extraction and log AI responses
      let textContent = '';
      let thinkingContent = '';

      switch (message.type) {
        case 'text':
          textContent = message.content;
          this.emit('agent:message', task.id, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: message.content }] } });
          break;
        case 'thinking':
          thinkingContent = message.content;
          this.emit('agent:message', task.id, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'thinking', thinking: message.content }] } });
          break;
        case 'tool_call': {
          const callId = message.id;
          const toolName = message.name;
          const input = message.input || {};
          const timestamp = new Date();

          // Create a new ToolExecution record
          const toolExecution: ToolExecution = {
            callId,
            toolName,
            input,
            taskId: task.id,
            agentName: stage.agent,
            stageName: stage.name,
            startTime: timestamp,
            status: 'running',
          };

          // Store the active tool execution
          this.activeToolExecutions.set(callId, toolExecution);

          // Track tool call counts for ghost completion detection
          const counts = this.taskToolCallCounts.get(task.id) || { total: 0, mutating: 0 };
          counts.total++;
          const mutatingTools = ['Write', 'Edit', 'Bash', 'NotebookEdit'];
          if (mutatingTools.includes(toolName)) {
            counts.mutating++;
          }
          this.taskToolCallCounts.set(task.id, counts);

          // Record to replay bundle
          if (this.replayBundleBuilder) {
            this.replayBundleBuilder.recordToolCallStart(callId, toolName, input);
          }

          this.emit('tool:start', {
            taskId: task.id,
            toolName,
            input,
            timestamp,
            callId,
          });
          
          this.emit('agent:message', task.id, { 
            type: 'assistant', 
            message: { 
              role: 'assistant', 
              content: [{ type: 'tool_use', id: callId, name: toolName, input }] 
            } 
          });
          break;
        }
        case 'tool_result': {
          const callId = message.id;
          const result = message.content;
          const isError = message.isError;
          const timestamp = new Date();

          const toolExecution = this.activeToolExecutions.get(callId);
          if (toolExecution) {
            toolExecution.status = isError ? 'failed' : 'completed';
            toolExecution.endTime = timestamp;
            toolExecution.duration = timestamp.getTime() - toolExecution.startTime.getTime();
            toolExecution.result = {
              success: !isError,
              output: result,
              error: isError ? String(result) : undefined,
            };

            this.emit('tool:complete', {
              taskId: task.id,
              toolName: toolExecution.toolName,
              callId,
              result: {
                success: !isError,
                output: result,
                error: isError ? String(result) : undefined,
              },
              timing: {
                startTime: toolExecution.startTime,
                endTime: timestamp,
                duration: toolExecution.duration,
              },
              timestamp,
            });
          }

          // Record tool result to replay bundle
          if (this.replayBundleBuilder) {
            this.replayBundleBuilder.recordToolCallComplete(callId, result, isError);
          }

          this.emit('agent:message', task.id, {
            type: 'assistant',
            message: {
              role: 'assistant', 
              content: [{ type: 'tool_result', tool_use_id: callId, content: result, is_error: isError }] 
            } 
          });
          break;
        }
        case 'usage':
          this.emit('agent:message', task.id, { type: 'usage', input_tokens: message.inputTokens, output_tokens: message.outputTokens });
          
          stageUsage.inputTokens += message.inputTokens;
          stageUsage.outputTokens += message.outputTokens;
          stageUsage.totalTokens = stageUsage.inputTokens + stageUsage.outputTokens;
          stageUsage.estimatedCost = calculateCost(stageUsage.inputTokens, stageUsage.outputTokens);

          // Update task-level usage
          await this.updateUsage(task.id, {
            inputTokens: message.inputTokens,
            outputTokens: message.outputTokens,
          });
          break;
      }

      if (textContent.trim().length > 0) {
        messages.push(textContent);

        // Record message to replay bundle
        if (this.replayBundleBuilder) {
          this.replayBundleBuilder.recordMessage('assistant', textContent);
        }
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
                          fullOutput.includes('hit your limit') ||
                          fullOutput.includes("you've hit your limit") ||
                          fullOutput.includes('/upgrade') ||
                          fullOutput.includes('extra-usage') ||
                          fullOutput.includes('usage limit') ||
                          fullOutput.includes('token limit') ||
                          fullOutput.includes('context length') ||
                          (fullOutput.includes('resets') && (fullOutput.includes('limit') || fullOutput.includes('upgrade')));

      if (isLimitError) {
        // Rethrow with limit-specific message so it can be detected and paused
        throw new Error(`Usage limit reached: ${(error as Error).message}. Recent output: ${messages.slice(-2).join(' ').substring(0, 200)}`);
      }

      // Rethrow original error
      throw error;
    }

    // Extract stage summary and outputs from the final messages
    const { summary, outputs, artifacts } = this.parseStageOutput(messages, stage);

    // Token tracking fix: if the stage produced messages but reported 0 tokens,
    // estimate minimum token usage based on message content length.
    // This catches cases where the SDK doesn't emit usage events (fast exits, resume sessions).
    if (stageUsage.totalTokens === 0 && messages.length > 0) {
      const totalChars = messages.reduce((sum, m) => sum + m.length, 0);
      // Rough estimate: ~4 chars per token, plus input prompt overhead
      const estimatedOutputTokens = Math.ceil(totalChars / 4);
      const estimatedInputTokens = Math.ceil(estimatedOutputTokens * 2); // Input is typically 2x output

      if (estimatedOutputTokens > 0) {
        stageUsage.inputTokens = estimatedInputTokens;
        stageUsage.outputTokens = estimatedOutputTokens;
        stageUsage.totalTokens = estimatedInputTokens + estimatedOutputTokens;
        stageUsage.estimatedCost = calculateCost(estimatedInputTokens, estimatedOutputTokens);

        // Persist the estimated usage to the task
        await this.updateUsage(task.id, {
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
        });

        await this.store.addLog(task.id, {
          level: 'debug',
          message: `Token tracking gap detected: stage "${stage.name}" reported 0 tokens but produced ${messages.length} messages (${totalChars} chars). ` +
            `Estimated ~${stageUsage.totalTokens} tokens.`,
          stage: stage.name,
        });
      }
    }

    // Check if the output indicates the task was blocked by permission restrictions
    // Skip these heuristic checks for planning stages - they don't run tests or write files,
    // and their output often discusses previous failures which triggers false positives
    const fullOutputLower = messages.join('\n').toLowerCase();

    if (isPlanner) {
      // Planning stages skip test failure and permission heuristics entirely
      // They only plan/decompose - false positives here cause "Workflow stuck" errors
      const decompositionRequest2 = parseDecompositionRequest(messages.join('\n'));
      if (decompositionRequest2.shouldDecompose) {
        await this.store.addLog(task.id, {
          level: 'info',
          message: `Planner requested decomposition: ${decompositionRequest2.subtasks.length} subtasks (${decompositionRequest2.strategy})`,
          stage: stage.name,
        });
      }

      const plannerResult = {
        stageName: stage.name,
        agent: agent.name,
        status: 'completed' as const,
        outputs,
        artifacts,
        summary,
        usage: stageUsage,
        startedAt,
        completedAt: new Date(),
        decompositionRequest: decompositionRequest2,
      };

      // Record stage result to replay bundle
      if (this.replayBundleBuilder) {
        this.replayBundleBuilder.recordStageResult(stage.name, plannerResult);
      }

      return plannerResult;
    }

    const permissionBlockedPatterns = [
      'need user confirmation',
      'tool access restrictions',
      'blocked from using',
      'cannot proceed without',
      'requires user confirmation',
      'need to get approval',
      'encountering tool access',
      'need explicit.*confirmation',
      'i apologize.*cannot.*permission',
      'i\'m unable to.*without.*confirmation',
      'waiting for.*permission',
      'permission denied',
    ];

    const isPermissionBlocked = permissionBlockedPatterns.some(pattern =>
      fullOutputLower.includes(pattern) || new RegExp(pattern, 'i').test(fullOutputLower)
    );

    if (isPermissionBlocked) {
      // Task was blocked by permission restrictions - mark as failed
      await this.store.addLog(task.id, {
        level: 'error',
        message: `Stage "${stage.name}" failed: Task was blocked by permission restrictions and could not complete its work`,
        stage: stage.name,
        agent: agent.name,
      });

      return {
        stageName: stage.name,
        agent: agent.name,
        status: 'failed',
        outputs,
        artifacts,
        summary: `Failed: Permission restrictions prevented task completion. ${summary}`,
        usage: stageUsage,
        startedAt,
        completedAt: new Date(),
        error: 'Task was blocked by permission restrictions and could not complete its work',
      };
    }

    // Check for test failures in the agent's output
    // Only apply to testing/review stages - other stages produce false positives
    // when they discuss errors, failures, or code issues in their output text.
    // Genuine build/test failures in implementation stages are caught by tool exit codes.
    const isTestOrReviewStage = ['testing', 'review', 'test', 'qa'].includes(stage.name.toLowerCase());

    // These patterns are designed to match ACTUAL test runner output, not discussions about code.
    // Be specific to avoid false positives when agents discuss potential issues.
    const testFailurePatterns = [
      // Specific test runner output patterns
      'FAIL\\s+[\\w/]+\\.test\\.',     // Jest/Vitest FAIL output
      '✗\\s+\\d+\\s+test',              // Test runner failure symbols
      '×\\s+\\d+\\s+test',              // Test runner failure symbols
      'npm test.*exited.*code [1-9]',   // npm test with exit code
      'vitest.*exited.*code [1-9]',     // vitest with exit code
      'jest.*exited.*code [1-9]',       // jest with exit code
      '[1-9]\\d*\\s+failed,?\\s+\\d+\\s+passed', // "X failed, Y passed" pattern (excludes "0 failed")
      'error:\\s+tests? did not pass',  // Explicit error message
      'test suite failed',              // Jest test suite failure
      'Tests:\\s+[1-9]\\d*\\s+failed',  // Jest summary with failures
      'npm ERR!.*test',                 // npm test errors
      'Error:\\s+Command failed',       // Build command failures
      'error TS\\d+:',                  // TypeScript compiler errors (specific format)
      'SyntaxError:',                   // JavaScript syntax errors
      'ReferenceError:',                // JavaScript reference errors
      'ENOENT.*package\\.json',         // Missing package.json
    ];

    const isTestFailure = isTestOrReviewStage && testFailurePatterns.some(pattern =>
      new RegExp(pattern, 'i').test(fullOutputLower)
    );

    // Also check for explicit "Status: failed" in structured output (testing/review only)
    const hasExplicitFailure = isTestOrReviewStage && (
      /\*\*status\*\*:\s*failed/i.test(fullOutputLower) ||
      /status:\s*failed/i.test(fullOutputLower)
    );

    if (isTestFailure || hasExplicitFailure) {
      // Tests or build failed - mark stage as failed
      await this.store.addLog(task.id, {
        level: 'error',
        message: `Stage "${stage.name}" failed: Tests or build did not pass`,
        stage: stage.name,
        agent: agent.name,
      });

      return {
        stageName: stage.name,
        agent: agent.name,
        status: 'failed',
        outputs,
        artifacts,
        summary: `Failed: Tests or build did not pass. ${summary}`,
        usage: stageUsage,
        startedAt,
        completedAt: new Date(),
        error: 'Tests or build did not pass',
      };
    }

    // Note: Planning stages return early above and never reach this point.
    // Non-planning stages do not produce decomposition requests.

    // Create preliminary stage result for auto-fix processing
    const preliminaryResult: StageResult = {
      stageName: stage.name,
      agent: agent.name,
      status: 'completed',
      outputs,
      artifacts,
      summary,
      usage: stageUsage,
      startedAt,
      completedAt: new Date(),
    };

    // Execute auto-fix if this is a code generation stage
    let autoFixResults: AutoFixStageResults | null = null;
    try {
      autoFixResults = await this.executeAutoFixForStage(task.id, stage, preliminaryResult);
    } catch (error) {
      // Log auto-fix error but don't fail the stage
      await this.store.addLog(task.id, {
        level: 'warn',
        message: `Auto-fix hook failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: stage.name,
        agent: agent.name,
      });
    }

    const finalResult = {
      stageName: stage.name,
      agent: agent.name,
      status: 'completed' as const,
      outputs,
      artifacts,
      summary,
      usage: stageUsage,
      startedAt,
      completedAt: new Date(),
      autoFixResults: autoFixResults || undefined,
    };

    // Record stage result to replay bundle
    if (this.replayBundleBuilder) {
      this.replayBundleBuilder.recordStageResult(stage.name, finalResult);
    }

    return finalResult;
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
   * Execute auto-fix on files modified during a code generation stage
   *
   * @param taskId - The task ID
   * @param stage - The stage that was executed
   * @param stageResult - The stage execution result with artifacts
   * @returns Auto-fix results or null if skipped
   */
  private async executeAutoFixForStage(
    taskId: string,
    stage: WorkflowStage,
    stageResult: StageResult
  ): Promise<AutoFixStageResults | null> {
    // Check if auto-fix is enabled in configuration
    const autoFixConfig = this.effectiveConfig.codeQuality?.autoFix;
    if (!autoFixConfig?.enabled) {
      return {
        applied: false,
        filesProcessed: [],
        filesModified: [],
        totalImportsAdded: 0,
        totalDuration: 0,
        errors: [],
        skipReason: 'disabled',
      };
    }

    // Check if stage failed and we should skip on failure
    if (stageResult.status === 'failed' && autoFixConfig.skipOnStageFailure) {
      return {
        applied: false,
        filesProcessed: [],
        filesModified: [],
        totalImportsAdded: 0,
        totalDuration: 0,
        errors: [],
        skipReason: 'stage_failed',
      };
    }

    // Check if this is a code generation stage that should trigger auto-fix
    const shouldTrigger =
      isCodeGenerationStage(stage) ||
      autoFixConfig.triggerStages.includes(stage.name.toLowerCase()) ||
      autoFixConfig.triggerAgents.includes(stage.agent.toLowerCase());

    if (!shouldTrigger) {
      return {
        applied: false,
        filesProcessed: [],
        filesModified: [],
        totalImportsAdded: 0,
        totalDuration: 0,
        errors: [],
        skipReason: 'no_code_files',
      };
    }

    // Get files modified by this stage from tool action store
    let modifiedFiles: string[] = [];

    try {
      // Get all tool actions for this stage (filter by actionGroup which contains stage name)
      const toolActions = await this.toolActionStore.getToolActions(taskId);
      const stageActions = toolActions.filter(action =>
        action.actionGroup === stage.name &&
        action.modifiedFiles &&
        action.modifiedFiles.length > 0
      );

      // Collect all modified files from this stage
      const allFiles = new Set<string>();
      for (const action of stageActions) {
        for (const file of action.modifiedFiles) {
          allFiles.add(file);
        }
      }

      // Include artifacts from stage result as well
      if (stageResult.artifacts) {
        for (const artifact of stageResult.artifacts) {
          allFiles.add(artifact);
        }
      }

      modifiedFiles = Array.from(allFiles);
    } catch (error) {
      await this.store.addLog(taskId, {
        level: 'warn',
        message: `Failed to get modified files for auto-fix: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: stage.name,
      });

      return {
        applied: false,
        filesProcessed: [],
        filesModified: [],
        totalImportsAdded: 0,
        totalDuration: 0,
        errors: [],
        skipReason: 'failed_to_identify_files',
      };
    }

    if (modifiedFiles.length === 0) {
      return {
        applied: false,
        filesProcessed: [],
        filesModified: [],
        totalImportsAdded: 0,
        totalDuration: 0,
        errors: [],
        skipReason: 'no_code_files',
      };
    }

    // Filter files by supported extensions
    const supportedFiles = modifiedFiles.filter(file => {
      const ext = path.extname(file);
      return autoFixConfig.fileExtensions.includes(ext);
    });

    // Limit number of files to process
    const filesToProcess = supportedFiles.slice(0, autoFixConfig.maxFilesPerStage);

    if (filesToProcess.length === 0) {
      return {
        applied: false,
        filesProcessed: [],
        filesModified: [],
        totalImportsAdded: 0,
        totalDuration: 0,
        errors: [],
        skipReason: 'no_code_files',
      };
    }

    await this.store.addLog(taskId, {
      level: 'info',
      message: `Auto-fix triggered for ${filesToProcess.length} files after ${stage.name} stage completion`,
      stage: stage.name,
    });

    // Emit auto-fix requested event
    for (const filePath of filesToProcess) {
      this.emit('autofix:requested', {
        taskId,
        filePath,
        fixTypes: ['imports'], // Currently only supporting import fixes
        triggeredBy: 'hook',
        timestamp: new Date(),
      });
    }

    try {
      // Create auto-fixer instance
      const autoFixer = new ImportAutoFixer({
        projectPath: this.projectPath,
        detector: 'auto',
      });

      // Check if auto-fixer is available
      if (!(await autoFixer.isAvailable())) {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: 'Auto-fix service unavailable, skipping import fixes',
          stage: stage.name,
        });

        for (const filePath of filesToProcess) {
          this.emit('autofix:skipped', {
            taskId,
            filePath,
            reason: 'no_issues',
            timestamp: new Date(),
          });
        }

        return {
          applied: false,
          filesProcessed: filesToProcess,
          filesModified: [],
          totalImportsAdded: 0,
          totalDuration: 0,
          errors: [],
          skipReason: 'no_code_files',
        };
      }

      // Execute auto-fix on all files
      const fixResults: ImportFixResult[] = [];

      // First analyze files to get accurate issue counts
      const analysisResults = await autoFixer.analyze(filesToProcess);

      // Process files individually to emit started/progress events
      for (let i = 0; i < filesToProcess.length; i++) {
        const filePath = filesToProcess[i];
        const analysis = analysisResults[i];

        // Emit started event with accurate issue count
        this.emit('autofix:started', {
          taskId,
          filePath,
          fixType: 'imports',
          issuesDetected: analysis?.missingImports.length || 0,
          timestamp: new Date(),
        });

        // Emit standardized auto-fix-start event
        this.emit('auto-fix-start', {
          id: `${taskId}-${crypto.randomUUID()}`,
          eventType: 'auto-fix-start',
          taskId,
          filesModified: [],
          issuesFixed: [],
          iterationCount: 0,
          totalIterations: filesToProcess.length,
          currentFile: filePath,
          status: 'running',
          timestamp: new Date(),
          metadata: {
            fixType: 'imports',
            issuesDetected: analysis?.missingImports.length || 0,
          },
        });

        // Execute fix for this file
        const fileResults = await autoFixer.fix([filePath]);
        fixResults.push(...fileResults);

        // Emit progress event
        const result = fileResults[0];
        if (result) {
          const issuesFixed = result.success ? result.importsAdded.length : 0;
          const issuesDetected = analysis?.missingImports.length || 0;
          this.emit('autofix:progress', {
            taskId,
            filePath,
            fixType: 'imports',
            issuesFixed,
            issuesRemaining: Math.max(0, issuesDetected - issuesFixed),
            currentFix: result.success && issuesFixed > 0 ? `Added ${issuesFixed} imports` : undefined,
            timestamp: new Date(),
          });

          // Emit standardized auto-fix-progress event
          this.emit('auto-fix-progress', {
            id: `${taskId}-${crypto.randomUUID()}`,
            eventType: 'auto-fix-progress',
            taskId,
            filesModified: [filePath],
            issuesFixed: result.success && issuesFixed > 0 ? [{
              type: 'import',
              description: `Added ${issuesFixed} imports: ${result.importsAdded.join(', ')}`,
              filePath,
              line: 1,
              column: 1,
              severity: 'warning' as const,
            }] : [],
            iterationCount: i + 1,
            totalIterations: filesToProcess.length,
            currentFile: filePath,
            status: 'running',
            timestamp: new Date(),
            metadata: {
              fixType: 'imports',
              issuesFixed,
              issuesRemaining: Math.max(0, issuesDetected - issuesFixed),
              currentFix: result.success && issuesFixed > 0 ? `Added ${issuesFixed} imports` : undefined,
            },
          });
        }
      }

      const summary = autoFixer.getSummary(fixResults);

      // Emit completion/failure events
      for (const result of fixResults) {
        if (result.success) {
          this.emit('autofix:completed', {
            taskId,
            filePath: result.filePath,
            fixType: 'imports',
            issuesDetected: result.importsAdded.length,
            issuesFixed: result.importsAdded.length,
            duration: result.duration,
            timestamp: new Date(),
          });

          // Emit standardized auto-fix-complete event
          this.emit('auto-fix-complete', {
            id: `${taskId}-${crypto.randomUUID()}`,
            eventType: 'auto-fix-complete',
            taskId,
            filesModified: [result.filePath],
            issuesFixed: result.importsAdded.map(importName => ({
              type: 'import',
              description: `Added import statement for ${importName}`,
              filePath: result.filePath,
              line: 1,
              column: 1,
              severity: 'warning' as const,
            })),
            iterationCount: fixResults.indexOf(result) + 1,
            totalIterations: fixResults.length,
            currentFile: result.filePath,
            status: 'success',
            timestamp: new Date(),
            metadata: {
              fixType: 'imports',
              issuesDetected: result.importsAdded.length,
              issuesFixed: result.importsAdded.length,
              duration: result.duration,
            },
          });
        } else {
          this.emit('autofix:failed', {
            taskId,
            filePath: result.filePath,
            fixType: 'imports',
            error: result.errors.map(e => e.message).join('; '),
            issuesDetected: 0,
            issuesFixed: 0,
            timestamp: new Date(),
          });

          // Emit standardized auto-fix-error event
          this.emit('auto-fix-error', {
            id: `${taskId}-${crypto.randomUUID()}`,
            eventType: 'auto-fix-error',
            taskId,
            filesModified: [],
            issuesFixed: [],
            iterationCount: fixResults.indexOf(result) + 1,
            totalIterations: fixResults.length,
            currentFile: result.filePath,
            status: 'failed',
            timestamp: new Date(),
            error: result.errors.map(e => e.message).join('; '),
            metadata: {
              fixType: 'imports',
              issuesDetected: 0,
              issuesFixed: 0,
              errors: result.errors.map(e => ({
                type: e.type,
                message: e.message,
              })),
            },
          });
        }
      }

      const errors = fixResults.flatMap(result =>
        result.errors.map(error => ({
          filePath: result.filePath,
          error: error.message,
          type: error.type as 'io' | 'resolution' | 'syntax',
        }))
      );

      await this.store.addLog(taskId, {
        level: summary.totalErrors > 0 ? 'warn' : 'info',
        message: `Auto-fix completed: ${summary.filesModified}/${summary.filesProcessed} files modified, ${summary.totalImportsAdded} imports added`,
        stage: stage.name,
      });

      return {
        applied: true,
        filesProcessed: filesToProcess,
        filesModified: fixResults.filter(r => r.importsAdded.length > 0).map(r => r.filePath),
        totalImportsAdded: summary.totalImportsAdded,
        totalDuration: summary.totalDuration,
        errors,
      };
    } catch (error) {
      await this.store.addLog(taskId, {
        level: 'error',
        message: `Auto-fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: stage.name,
      });

      for (const filePath of filesToProcess) {
        this.emit('autofix:failed', {
          taskId,
          filePath,
          fixType: 'imports',
          error: error instanceof Error ? error.message : 'Unknown error',
          issuesDetected: 0,
          issuesFixed: 0,
          timestamp: new Date(),
        });

        // Emit standardized auto-fix-error event
        this.emit('auto-fix-error', {
          id: `${taskId}-${crypto.randomUUID()}`,
          eventType: 'auto-fix-error',
          taskId,
          filesModified: [],
          issuesFixed: [],
          iterationCount: filesToProcess.indexOf(filePath) + 1,
          totalIterations: filesToProcess.length,
          currentFile: filePath,
          status: 'failed',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            fixType: 'imports',
            issuesDetected: 0,
            issuesFixed: 0,
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          },
        });
      }

      return {
        applied: false,
        filesProcessed: filesToProcess,
        filesModified: [],
        totalImportsAdded: 0,
        totalDuration: 0,
        errors: [{
          filePath: 'all',
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'io',
        }],
      };
    }
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
        resumeAttempts: 0,  // Reset resume attempts counter on successful completion
        pauseReason: undefined,  // Clear stale pause metadata
        pausedAt: undefined,
        resumeAfter: undefined,
      } : {}),
    });

    // Propagate in-progress status up the ancestor chain
    if (status === 'in-progress') {
      const task = await this.store.getTask(taskId);
      if (task?.parentTaskId) {
        try {
          await this.checkAndResumeParent(task.parentTaskId);
        } catch (err) {
          // Don't fail the status update if propagation fails
        }
      }
    }

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
      totalCostCents: Math.round(estimatedCost * 100),
      executionTimeMs: 0, // Will be updated by task completion
    };

    await this.store.updateTask(taskId, { usage });
    this.emit('usage:updated', taskId, usage);

    await this.checkResourceLimits(taskId);
  }

  /**
   * Update tracked file changes for a task and check resource limits.
   */
  private async updateFileChanges(
    taskId: string,
    changes: { created?: string[]; modified?: string[] }
  ): Promise<void> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      return;
    }

    const currentChanges = this.fileChangesByTask.get(taskId) || {
      created: [],
      modified: [],
    };

    const created = new Set([...currentChanges.created, ...(changes.created ?? [])]);
    const modified = new Set([...currentChanges.modified, ...(changes.modified ?? [])]);

    const updatedChanges = {
      created: Array.from(created),
      modified: Array.from(modified),
    };

    this.fileChangesByTask.set(taskId, updatedChanges);

    await this.store.updateTask(taskId, {
      fileChanges: updatedChanges,
    } as unknown as Parameters<typeof this.store.updateTask>[1]);

    await this.checkResourceLimits(taskId);
  }

  /**
   * Evaluate resource limits for a task and emit warning/exceeded events.
   */
  private async checkResourceLimits(taskId: string): Promise<void> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      return;
    }

    const limits = this.effectiveConfig.limits;
    const warningThreshold = 80;

    const usage = task.usage || {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      totalCostCents: 0,
      executionTimeMs: 0,
    };

    const checkLimit = (limitType: LimitWarningEvent['limitType'], currentValue: number, limitValue: number) => {
      if (!limitValue || limitValue <= 0) {
        return;
      }

      const utilizationPercent = (currentValue / limitValue) * 100;

      if (utilizationPercent >= 100) {
        this.emit('limit:exceeded', {
          taskId,
          limitType,
          currentValue,
          limitValue,
          percentage: utilizationPercent,
          timestamp: new Date(),
        });
      } else if (utilizationPercent >= warningThreshold) {
        this.emit('limit:warning', {
          taskId,
          limitType,
          currentValue,
          limitValue,
          percentage: utilizationPercent,
          timestamp: new Date(),
        });
      }
    };

    checkLimit('tokens', usage.totalTokens, limits.maxTokensPerTask);
    checkLimit('cost', usage.estimatedCost, limits.maxCostPerTask);

    const executionTime = (task as Task & { executionTime?: number }).executionTime
      ?? usage.executionTimeMs
      ?? 0;
    checkLimit('time', executionTime, limits.maxExecutionTime);

    const fileChanges = this.fileChangesByTask.get(taskId)
      ?? (task as Task & { fileChanges?: { created: string[]; modified: string[] } }).fileChanges
      ?? { created: [], modified: [] };
    const totalFileChanges = (fileChanges.created?.length || 0) + (fileChanges.modified?.length || 0);
    checkLimit('files', totalFileChanges, limits.maxFileChanges);
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    await this.ensureInitialized();
    return this.store.getTask(taskId);
  }

  /**
   * Get the currently active task, if any.
   */
  async getCurrentTask(): Promise<Task | null> {
    await this.ensureInitialized();
    if (!this.currentTaskId) {
      return null;
    }

    return this.store.getTask(this.currentTaskId);
  }

  /**
   * List all tasks
   */
  async listTasks(options?: {
    status?: TaskStatus;
    limit?: number;
    offset?: number;
    orderByPriority?: boolean;
    includeTrashed?: boolean;
    includeArchived?: boolean;
    lightweight?: boolean;
  }): Promise<Task[]> {
    await this.ensureInitialized();
    return this.store.listTasks(options);
  }

  /**
   * Get task statistics (counts and cost, no per-task loading).
   */
  async getTaskStats(): Promise<{
    byStatus: Record<string, number>;
    totalCost: number;
    totalTokens: number;
  }> {
    await this.ensureInitialized();
    return this.store.getTaskStats();
  }

  /**
   * Count tasks matching filters.
   */
  async countTasks(options?: {
    status?: TaskStatus;
    includeTrashed?: boolean;
    includeArchived?: boolean;
  }): Promise<{ total: number; byStatus: Record<string, number> }> {
    await this.ensureInitialized();
    return this.store.countTasks(options);
  }

  /**
   * Get available agents
   */
  async getAgents(): Promise<Record<string, AgentDefinition>> {
    await this.ensureInitialized();
    return this.agents;
  }

  /**
   * Get linter service instance
   */
  getLinterService(): LinterService {
    if (!this.initialized) {
      throw new Error('Orchestrator must be initialized before accessing LinterService');
    }
    return this.linterService;
  }

  /**
   * Get current task ID being executed (for event tracking)
   */
  private getCurrentTaskId(): string | null {
    return this.currentTaskId;
  }

  /**
   * Get configuration
   */
  async getConfig(): Promise<ApexConfig> {
    await this.ensureInitialized();
    return this.config;
  }

  /**
   * Get the currently active permission preset
   */
  async getCurrentPreset(): Promise<PermissionPreset> {
    await this.ensureInitialized();
    return this._permissionPresetManager.getCurrentPreset();
  }

  /**
   * Set the permission preset and apply it
   * @param preset The permission preset to apply
   */
  async setPreset(preset: PermissionPreset): Promise<void> {
    await this.ensureInitialized();
    await this._permissionPresetManager.applyPreset(preset);
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
  // Undo Operations (v0.5.0)
  // ============================================================================

  /**
   * Undo the last action for a task
   * Restores files from snapshot based on operation type:
   * - write: restore content
   * - create: delete file
   * - delete: restore file
   * Emits undo lifecycle events and removes used snapshot from store
   *
   * @param taskId The task ID to undo the last action for
   * @returns UndoOperationResult containing details about the undo operation
   */
  async undoLastAction(taskId: string): Promise<UndoOperationResult> {
    await this.ensureInitialized();

    this.emit('undo:start', taskId);

    try {
      // Get undoable actions for the task
      const undoableActions = await this.toolActionStore.getUndoableActions(taskId);

      if (undoableActions.length === 0) {
        throw new Error('No undoable actions found for task');
      }

      const lastAction = undoableActions[0];
      const restoredFiles: string[] = [];
      const failedFiles: { path: string; error: string; }[] = [];

      // Process each file based on operation type
      for (const snapshot of lastAction.beforeSnapshots) {
        try {
          // Determine operation type based on tool name and file state
          const toolName = lastAction.execution.toolName;
          const filePath = snapshot.filePath;
          const fileExists = existsSync(filePath);

          if (toolName === 'Write' || toolName === 'Edit') {
            // Write/Edit: restore content from snapshot
            if (snapshot.existed) {
              writeFileSync(filePath, snapshot.content, 'utf8');
              restoredFiles.push(filePath);
            } else if (fileExists) {
              // File was created, so delete it
              unlinkSync(filePath);
              restoredFiles.push(filePath);
            }
          } else if (toolName === 'Bash' && snapshot.existed && !fileExists) {
            // File was deleted by bash command, restore it
            writeFileSync(filePath, snapshot.content, 'utf8');
            restoredFiles.push(filePath);
          } else if (!snapshot.existed && fileExists) {
            // File was created, delete it
            unlinkSync(filePath);
            restoredFiles.push(filePath);
          } else if (snapshot.existed) {
            // File was modified, restore original content
            writeFileSync(filePath, snapshot.content, 'utf8');
            restoredFiles.push(filePath);
          }
        } catch (error) {
          failedFiles.push({
            path: snapshot.filePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Mark action as undone in the database
      await this.markActionAsUndone(lastAction.id);

      // Remove used snapshots from store (clean up)
      await this.removeActionSnapshots(lastAction.id);

      const result: UndoOperationResult = {
        success: failedFiles.length === 0,
        actionId: lastAction.id,
        restoredFiles,
        failedFiles,
        completedAt: new Date(),
        error: failedFiles.length > 0 ? `Failed to restore ${failedFiles.length} files` : undefined
      };

      if (result.success) {
        this.emit('undo:complete', taskId, lastAction.id, restoredFiles);
      } else {
        this.emit('undo:error', taskId, lastAction.id, result.error!);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('undo:error', taskId, null, errorMessage);

      return {
        success: false,
        actionId: '',
        restoredFiles: [],
        failedFiles: [],
        completedAt: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Mark a tool action as undone in the database
   */
  private async markActionAsUndone(actionId: string): Promise<void> {
    const db = this.toolActionStore['taskStore']['db'];
    db.prepare(`
      UPDATE tool_actions
      SET was_undone = 1, undone_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), actionId);
  }

  /**
   * Remove snapshots associated with an action from the store
   */
  private async removeActionSnapshots(actionId: string): Promise<void> {
    const db = this.toolActionStore['taskStore']['db'];

    // Get snapshot IDs from the action
    const action = db.prepare(`
      SELECT before_snapshots, after_snapshots FROM tool_actions WHERE id = ?
    `).get(actionId) as { before_snapshots: string; after_snapshots: string } | undefined;

    if (!action) return;

    const beforeSnapshotIds = JSON.parse(action.before_snapshots) as string[];
    const afterSnapshotIds = JSON.parse(action.after_snapshots) as string[];
    const allSnapshotIds = [...beforeSnapshotIds, ...afterSnapshotIds];

    // Remove snapshots from file_snapshots table
    if (allSnapshotIds.length > 0) {
      const placeholders = allSnapshotIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM file_snapshots WHERE id IN (${placeholders})`).run(...allSnapshotIds);
    }
  }

  // ============================================================================
  // Permission Management Operations (v0.5.0)
  // ============================================================================

  /**
   * Request permission for a tool operation and emit a permission:request event
   * @param taskId The task requesting permission
   * @param tool The tool requiring permission
   * @param scope Optional scope/context for the permission
   * @param description Description of what the tool will do
   * @param isDangerous Whether this is flagged as a dangerous operation
   * @param agent The agent requesting the permission
   * @param metadata Additional metadata about the request
   * @returns The generated request ID for tracking the permission request
   */
  async requestPermission(
    taskId: string,
    tool: string,
    scope: string | undefined,
    description: string,
    isDangerous = false,
    agent: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    await this.ensureInitialized();

    const requestId = `perm-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    const eventData: PermissionRequestEventData = {
      requestId,
      tool,
      scope,
      description,
      isDangerous,
      agent,
      timestamp,
      metadata,
    };

    this.emit('permission:request', eventData);

    return requestId;
  }

  /**
   * Grant permission for a pending request
   * @param requestId The permission request ID to grant
   * @param taskId The task ID
   * @param tool The tool being granted permission
   * @param scope Optional scope for the permission
   * @param level The permission level to grant
   * @param grantedBy Who is granting the permission
   * @param reason Optional reason for granting permission
   */
  async grantPermissionConfirmation(
    requestId: string,
    taskId: string,
    tool: string,
    scope: string | undefined,
    level: PermissionLevel,
    grantedBy: string,
    reason?: string
  ): Promise<void> {
    await this.ensureInitialized();

    // Save the permission to the permission store
    await this.permissionManager.grantPermission(tool, scope, level);

    const timestamp = new Date();
    const eventData: PermissionGrantedEventData = {
      requestId,
      tool,
      scope,
      level,
      grantedBy,
      timestamp,
      reason,
    };

    this.emit('permission:granted', eventData);
  }

  /**
   * Deny permission for a pending request
   * @param requestId The permission request ID to deny
   * @param taskId The task ID
   * @param tool The tool being denied permission
   * @param scope Optional scope for the permission
   * @param deniedBy Who is denying the permission
   * @param reason Reason for denying permission
   */
  async denyPermissionConfirmation(
    requestId: string,
    taskId: string,
    tool: string,
    scope: string | undefined,
    deniedBy: string,
    reason: string
  ): Promise<void> {
    await this.ensureInitialized();

    // Save a deny permission to the permission store
    await this.permissionManager.grantPermission(tool, scope, 'deny');

    const timestamp = new Date();
    const eventData: PermissionDeniedEventData = {
      requestId,
      tool,
      scope,
      deniedBy,
      timestamp,
      reason,
    };

    this.emit('permission:denied', eventData);
  }

  /**
   * Detect and flag a dangerous operation
   * @param taskId The task attempting the operation
   * @param tool The tool involved in the dangerous operation
   * @param operation Details about the dangerous operation
   * @param riskLevel The risk level of the operation
   * @param riskDescription Description of the potential risks
   * @param agent The agent attempting the operation
   * @param context Additional context about the operation
   * @returns The generated operation ID for tracking
   */
  async flagDangerousOperation(
    taskId: string,
    tool: string,
    operation: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    riskDescription: string,
    agent: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    await this.ensureInitialized();

    const operationId = `danger-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    const eventData: DangerousOperationDetectedEventData = {
      operationId,
      tool,
      operation,
      riskLevel,
      riskDescription,
      agent,
      timestamp,
      context,
    };

    this.emit('dangerous:detected', eventData);

    return operationId;
  }

  /**
   * Confirm a dangerous operation after user approval
   * @param operationId The dangerous operation ID to confirm
   * @param taskId The task ID
   * @param tool The tool executing the dangerous operation
   * @param operation Details about the operation
   * @param confirmedBy Who confirmed the operation
   * @param reason Optional reason for confirming the operation
   */
  async confirmDangerousOperation(
    operationId: string,
    taskId: string,
    tool: string,
    operation: string,
    confirmedBy: string,
    reason?: string
  ): Promise<void> {
    await this.ensureInitialized();

    const timestamp = new Date();
    const eventData: DangerousOperationConfirmedEventData = {
      operationId,
      tool,
      operation,
      confirmedBy,
      timestamp,
      reason,
    };

    this.emit('dangerous:confirmed', eventData);
  }

  /**
   * Block a dangerous operation after user denial
   * @param operationId The dangerous operation ID to block
   * @param taskId The task ID
   * @param tool The tool that was blocked
   * @param operation Details about the blocked operation
   * @param blockedBy Who blocked the operation
   * @param reason Reason for blocking the operation
   */
  async blockDangerousOperation(
    operationId: string,
    taskId: string,
    tool: string,
    operation: string,
    blockedBy: string,
    reason: string
  ): Promise<void> {
    await this.ensureInitialized();

    const timestamp = new Date();
    const eventData: DangerousOperationBlockedEventData = {
      operationId,
      tool,
      operation,
      blockedBy,
      timestamp,
      reason,
    };

    this.emit('dangerous:blocked', eventData);
  }

  // ============================================================================
  // Approval Operations (v0.5.0)
  // ============================================================================

  /**
   * Grant an approval request and resume the task from checkpoint
   * @param approvalId The approval request ID to grant
   * @param approver Who is granting the approval
   * @param comment Optional comment from the approver
   */
  async grantApproval(
    approvalId: string,
    approver: string,
    comment?: string
  ): Promise<void> {
    await this.ensureInitialized();

    // Get the approval request from storage to validate it exists
    const approvalState = await this.store.getApprovalStateById(approvalId);
    if (!approvalState) {
      throw new Error(`Approval request not found: ${approvalId}`);
    }

    if (approvalState.status !== 'pending') {
      throw new Error(`Approval request ${approvalId} is not pending (status: ${approvalState.status})`);
    }

    const timestamp = new Date();
    const taskId = approvalState.taskId;

    // Verify task exists
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found for approval: ${taskId}`);
    }

    // Update approval state in database
    await this.store.updateApprovalState(approvalId, {
      status: 'approved',
      approver,
      respondedAt: timestamp,
      comment,
      approvalsReceived: (approvalState.approvalsReceived || 0) + 1
    });

    // Create and emit the approval:approved event
    const eventData: ApprovalGrantedEventData = {
      approvalId,
      taskId,
      approver,
      comment,
      timestamp,
    };

    this.emit('approval:approved', eventData);

    // Log approval response for audit
    await this.store.logApprovalResponse(taskId, approver, true, comment || 'No comment provided');

    // Log autonomy mode change for audit (resuming from supervised back to original autonomy)
    await this.store.logModeChange(
      taskId,
      'supervised',
      task.autonomy,
      `Approval granted by ${approver} - resuming with original autonomy level`
    );

    // Resume the task from its checkpoint
    try {
      const resumed = await this.resumeTask(taskId);
      if (!resumed) {
        await this.store.addLog(taskId, {
          level: 'warn',
          message: `Failed to resume task after approval grant: no checkpoint available`,
          metadata: { approvalId, approver },
        });
      } else {
        await this.store.addLog(taskId, {
          level: 'info',
          message: `Task resumed successfully after approval grant`,
          metadata: { approvalId, approver, comment },
        });
      }
    } catch (error) {
      await this.store.addLog(taskId, {
        level: 'error',
        message: `Error resuming task after approval grant: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { approvalId, approver },
      });
      throw error;
    }
  }

  /**
   * Deny an approval request and mark the task as failed
   * @param approvalId The approval request ID to deny
   * @param approver Who is denying the approval
   * @param reason Reason for denying the approval
   */
  async denyApproval(
    approvalId: string,
    approver: string,
    reason: string
  ): Promise<void> {
    await this.ensureInitialized();

    if (!reason || reason.trim().length === 0) {
      throw new Error('Reason is required when denying an approval');
    }

    const timestamp = new Date();

    // Get the approval request from storage to validate it exists
    const approvalState = await this.store.getApprovalStateById(approvalId);
    if (!approvalState) {
      throw new Error(`Approval request not found: ${approvalId}`);
    }

    if (approvalState.status !== 'pending') {
      throw new Error(`Approval request ${approvalId} is not pending (status: ${approvalState.status})`);
    }

    const taskId = approvalState.taskId;

    // Verify task exists
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found for approval: ${taskId}`);
    }

    // Update approval state in database
    await this.store.updateApprovalState(approvalId, {
      status: 'denied',
      approver,
      respondedAt: timestamp,
      comment: reason
    });

    // Create and emit the approval:denied event
    const eventData: ApprovalDeniedEventData = {
      approvalId,
      taskId,
      approver,
      reason,
      timestamp,
    };

    this.emit('approval:denied', eventData);

    // Log approval response for audit
    await this.store.logApprovalResponse(taskId, approver, false, reason);

    // Log autonomy mode change for audit (transitioning to manual due to denial)
    await this.store.logModeChange(
      taskId,
      'supervised',
      'manual',
      `Approval denied by ${approver} - requiring manual intervention: ${reason}`
    );

    // Mark the task as failed with the denial reason
    try {
      await this.updateTaskStatus(taskId, 'failed', `Approval denied by ${approver}: ${reason}`);

      await this.store.addLog(taskId, {
        level: 'info',
        message: `Task failed due to approval denial`,
        metadata: { approvalId, approver, reason },
      });
    } catch (error) {
      await this.store.addLog(taskId, {
        level: 'error',
        message: `Error updating task status after approval denial: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { approvalId, approver },
      });
      throw error;
    }
  }

  /**
   * Wait for an approval response for a specific request
   * This creates a promise that will be resolved when respondToApproval is called
   * @param requestId The approval request ID to wait for
   * @param timeoutMs Optional timeout in milliseconds (default: 30 minutes)
   * @returns Promise<ApprovalResponse> that resolves when the approval is responded to
   */
  waitForApproval(requestId: string, timeoutMs: number = 30 * 60 * 1000): Promise<ApprovalResponse> {
    if (!requestId || requestId.trim().length === 0) {
      throw new Error('Request ID is required');
    }

    // If there's already a pending promise for this request, return it
    const existing = this.pendingApprovalPromises.get(requestId);
    if (existing) {
      throw new Error(`Already waiting for approval response to request: ${requestId}`);
    }

    return new Promise<ApprovalResponse>((resolve, reject) => {
      // Store the promise resolvers
      this.pendingApprovalPromises.set(requestId, { resolve, reject });

      // Set up timeout if specified
      if (timeoutMs > 0) {
        setTimeout(() => {
          const pendingPromise = this.pendingApprovalPromises.get(requestId);
          if (pendingPromise) {
            this.pendingApprovalPromises.delete(requestId);
            pendingPromise.reject(new Error(`Approval request ${requestId} timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }
    });
  }

  /**
   * Respond to an approval request with a decision and resolve pending promises
   * This provides a unified interface that delegates to grantApproval or denyApproval
   * while also resolving any pending approval promises for the request
   * @param requestId The approval request ID to respond to
   * @param response The approval response containing decision and context
   * @returns Promise<void> that resolves when the approval is processed
   */
  async respondToApproval(
    requestId: string,
    response: ApprovalResponse
  ): Promise<void> {
    await this.ensureInitialized();

    // Validate required fields
    if (!requestId || requestId.trim().length === 0) {
      throw new Error('Request ID is required');
    }

    if (!response.response) {
      throw new Error('Approval decision is required');
    }

    try {
      // Delegate to appropriate method based on response type
      if (response.response === 'approved') {
        await this.grantApproval(requestId, response.approver || 'Unknown', response.message);
      } else if (response.response === 'denied') {
        const reason = response.message || 'No reason provided';
        await this.denyApproval(requestId, response.approver || 'Unknown', reason);
      } else if (response.response === 'info-requested') {
        // For info requests, we don't change the approval state but emit an event
        // This allows external systems to handle information requests as needed
        await this.store.addLog(response.taskId, {
          level: 'info',
          message: `Information requested for approval ${requestId}: ${response.message || 'No message provided'}`,
          metadata: {
            approvalId: requestId,
            requester: response.approver || 'Unknown',
            infoRequest: true
          },
        });

        // Emit a custom event for info requests
        this.emit('approval:info-requested', {
          approvalId: requestId,
          taskId: response.taskId,
          requester: response.approver || 'Unknown',
          message: response.message,
          timestamp: new Date(),
        });
      } else {
        throw new Error(`Invalid approval response: ${response.response}`);
      }

      // Resolve any pending approval promises for this request
      const pendingPromise = this.pendingApprovalPromises.get(requestId);
      if (pendingPromise) {
        this.pendingApprovalPromises.delete(requestId);
        pendingPromise.resolve(response);
      }

    } catch (error) {
      // If there's a pending promise, reject it with the error
      const pendingPromise = this.pendingApprovalPromises.get(requestId);
      if (pendingPromise) {
        this.pendingApprovalPromises.delete(requestId);
        pendingPromise.reject(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
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
   * Scan staged files for secrets before committing
   * @returns Promise that resolves to secret findings from all staged files
   */
  private mapSecretDetectionsToFindings(detections: SecretDetection[]): SecretFinding[] {
    return detections.map(detection => {
      const line = detection.lineNumber ?? 1;
      const column = detection.columnNumber ?? 1;
      const endColumn = column + Math.max(0, detection.maskedMatch.length - 1);

      return {
        file: detection.filePath ?? 'unknown',
        line,
        column,
        endColumn,
        secretType: detection.secretType,
        match: detection.maskedMatch,
        confidence: 1,
        patternName: detection.patternName,
        severity: detection.severity,
        context: detection.context,
      };
    });
  }

  private resolveSecretDetectionBehavior(): SecretDetectionBehavior {
    // Check if secret scanning is enabled and get enforcement mode
    const secretScanning = this.effectiveConfig.secretScanning;
    if (secretScanning?.enabled !== false && secretScanning?.enforcementMode) {
      // Map enforcement modes to detection behaviors
      switch (secretScanning.enforcementMode) {
        case 'audit':
          return 'log';   // audit mode logs detections for auditing without blocking
        case 'block':
          return 'block'; // block mode prevents operations when secrets are detected
        case 'warn':
          return 'mask';  // warn mode masks secrets in outputs before storage/emission
      }
    }

    // Fallback to legacy guardrails/scanner configuration
    const guardrails = this.effectiveConfig.guardrails;
    const guardrailsEnabled = guardrails?.enabled !== false;
    const guardrailSecrets = guardrailsEnabled && guardrails?.secrets?.enabled !== false
      ? guardrails.secrets
      : undefined;

    return guardrailSecrets?.onDetection
      ?? this.effectiveConfig.scanner?.onSecretDetected
      ?? 'warn';
  }

  private resolveSecretScannerConfig(): OrchestratorSecretScannerConfig | null {
    const guardrails = this.effectiveConfig.guardrails;
    const guardrailsEnabled = guardrails?.enabled !== false;
    const guardrailSecrets = guardrailsEnabled && guardrails?.secrets?.enabled !== false
      ? guardrails.secrets
      : undefined;
    const baseScanner = this.effectiveConfig.scanner;

    const customPatterns = guardrailSecrets?.customPatterns ?? baseScanner?.customPatterns;
    const includeBuiltInPatterns = guardrailSecrets?.includeBuiltInPatterns ?? baseScanner?.includeBuiltInPatterns;

    if (!customPatterns && includeBuiltInPatterns === undefined && !baseScanner) {
      return null;
    }

    return {
      customPatterns: customPatterns || [],
      includeBuiltInPatterns,
      maxLineLength: baseScanner?.maxLineLength,
      maskSecrets: baseScanner?.maskSecrets,
      contextLength: baseScanner?.contextLength,
    };
  }

  private normalizeSecretScanContent(output: unknown): string {
    if (typeof output === 'string') {
      return output;
    }

    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }

  async scanStagedFilesForSecrets(): Promise<SecretFinding[]> {
    if (!this.secretScanner) {
      return [];
    }

    try {
      // Get list of staged files
      const { stdout } = await execAsync('git diff --cached --name-only', { cwd: this.projectPath });
      const stagedFiles = stdout.trim().split('\n').filter(line => line.length > 0);

      if (stagedFiles.length === 0) {
        return [];
      }

      // Convert relative paths to absolute paths
      const absolutePaths = stagedFiles.map(file =>
        path.resolve(this.projectPath, file)
      );

      // Use the new scanFiles method to scan all staged files
      const detections = await this.secretScanner.scanFiles(absolutePaths);
      return this.mapSecretDetectionsToFindings(detections);
    } catch (error) {
      console.warn('Error scanning staged files for secrets:', error);
      return [];
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
   * Archive a completed task
   * Only tasks with status 'completed' can be archived
   */
  async archiveTask(taskId: string): Promise<void> {
    await this.ensureInitialized();

    // Archive the task - validation is handled by TaskStore
    await this.store.archiveTask(taskId);

    // Get the archived task and emit event
    const archivedTask = await this.store.getTask(taskId);
    if (archivedTask) {
      this.emit('task:archived', archivedTask);
    }
  }

  /**
   * List all archived tasks
   */
  async listArchivedTasks(): Promise<Task[]> {
    await this.ensureInitialized();
    return this.store.listArchived();
  }

  /**
   * Unarchive a task (restore from archive)
   * The task will retain its completed status
   */
  async unarchiveTask(taskId: string): Promise<void> {
    await this.ensureInitialized();

    // Unarchive the task - validation is handled by TaskStore
    await this.store.unarchiveTask(taskId);

    // Get the unarchived task and emit event
    const unarchivedTask = await this.store.getTask(taskId);
    if (unarchivedTask) {
      this.emit('task:unarchived', unarchivedTask);
    }
  }

  /**
   * Trash a task (soft delete)
   * The task status will be set to 'cancelled' and marked as trashed
   */
  async trashTask(taskId: string): Promise<void> {
    await this.ensureInitialized();

    // Validate task exists before trashing
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    // Validate task is not already trashed
    if (task.trashedAt) {
      throw new Error(`Task with ID ${taskId} is already in trash`);
    }

    // Trash the task - validation is handled by TaskStore
    await this.store.trashTask(taskId);

    // Get the trashed task and emit event
    const trashedTask = await this.store.getTask(taskId);
    if (trashedTask) {
      this.emit('task:trashed', trashedTask);
    }
  }

  /**
   * Restore a task from trash
   * The task will be restored to pending status and removed from trash
   */
  async restoreTask(taskId: string): Promise<void> {
    await this.ensureInitialized();

    // Validate task exists and is trashed
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    if (!task.trashedAt) {
      throw new Error(`Task with ID ${taskId} is not in trash`);
    }

    // Restore the task from trash
    await this.store.restoreFromTrash(taskId);

    // Get the restored task and emit event
    const restoredTask = await this.store.getTask(taskId);
    if (restoredTask) {
      this.emit('task:restored', restoredTask);
    }
  }

  /**
   * List all trashed tasks
   */
  async listTrashed(): Promise<Task[]> {
    await this.ensureInitialized();
    return this.store.listTrashed();
  }

  /**
   * List all trashed tasks (alias for listTrashed)
   */
  async listTrashedTasks(): Promise<Task[]> {
    await this.ensureInitialized();
    return this.store.listTrashed();
  }

  /**
   * Permanently delete all trashed tasks
   * Returns the number of tasks that were permanently deleted
   */
  async emptyTrash(): Promise<number> {
    await this.ensureInitialized();

    const trashedTasks = await this.store.listTrashed();
    if (trashedTasks.length === 0) {
      return 0;
    }

    const taskIds = trashedTasks.map(task => task.id);
    const deletedCount = await this.store.emptyTrash();

    // Emit event with count and task IDs
    this.emit('trash:emptied', deletedCount, taskIds);

    return deletedCount;
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

    // Only count resume attempts for non-external pause reasons.
    // External pauses (usage_limit, rate_limit, subtask pauses) are not indicative
    // of a broken task — they're environment constraints that resolve on their own.
    const externalPauseReasons = ['usage_limit', 'rate_limit', 'budget', 'session_limit'];
    const isExternalPause = task.pauseReason && (
      externalPauseReasons.includes(task.pauseReason) ||
      task.pauseReason.startsWith('subtask_paused')
    );

    const newResumeAttempts = isExternalPause ? task.resumeAttempts : task.resumeAttempts + 1;
    await this.store.updateTask(taskId, {
      resumeAttempts: newResumeAttempts,
      updatedAt: new Date(),
    });

    // Check if max resume attempts exceeded (default raised from 3 to 10)
    const maxResumeAttempts = this.effectiveConfig.daemon?.sessionRecovery?.maxResumeAttempts ?? 10;
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

    // Update task status to in-progress (don't pass checkpoint ref as error — it's not an error)
    await this.updateTaskStatus(taskId, 'in-progress');
    await this.store.addLog(taskId, {
      level: 'info',
      message: `Resuming from checkpoint: ${checkpoint.checkpointId}`,
    });

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
    // Note: stageResults is saved as Object.fromEntries(stageResults) in the checkpoint metadata
    const savedStageResults = checkpoint.metadata?.stageResults as Record<string, StageResult> | undefined;
    for (const stageName of completedStageNames) {
      const stageData = savedStageResults?.[stageName];
      if (stageData) {
        stageResults.set(stageName, stageData);
      } else {
        // If no stage data found, create a minimal completed result to satisfy dependency checks
        const now = new Date();
        stageResults.set(stageName, {
          stageName,
          agent: 'unknown',
          status: 'completed',
          outputs: {},
          artifacts: [],
          summary: 'Restored from checkpoint',
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, totalCostCents: 0, executionTimeMs: 0 },
          startedAt: now,
          completedAt: now,
        });
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

      // If this is a subtask, check if all sibling subtasks are complete
      // and update the parent task status accordingly
      if (task.parentTaskId) {
        await this.checkAndCompleteParentTask(task.parentTaskId);
      }
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

    // Decomposition guard: prevent duplicate decomposition of the same task
    if (this.decomposingTaskIds.has(parentTaskId)) {
      await this.store.addLog(parentTaskId, {
        level: 'warn',
        message: `Skipping duplicate decomposition — task ${parentTaskId} is already being decomposed`,
      });
      return [];
    }

    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task not found: ${parentTaskId}`);
    }

    // If subtasks already exist, skip decomposition entirely
    if (parentTask.subtaskIds && parentTask.subtaskIds.length > 0) {
      await this.store.addLog(parentTaskId, {
        level: 'warn',
        message: `Skipping decomposition — task already has ${parentTask.subtaskIds.length} subtasks (race condition prevented)`,
      });
      return [];
    }

    this.decomposingTaskIds.add(parentTaskId);
    try {
      return await this._decomposeTaskInner(parentTaskId, parentTask, subtaskDefinitions, strategy);
    } finally {
      this.decomposingTaskIds.delete(parentTaskId);
    }
  }

  /**
   * Inner decomposition logic, protected by the decomposition guard
   */
  private async _decomposeTaskInner(
    parentTaskId: string,
    parentTask: Task,
    subtaskDefinitions: SubtaskDefinition[],
    strategy: SubtaskStrategy
  ): Promise<Task[]> {
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

    // Initialize completedSubtasks from database - critical for resuming interrupted execution
    // Without this, restarted parent tasks don't recognize previously completed subtasks
    for (const subtaskId of subtaskIds) {
      const subtask = await this.store.getTask(subtaskId);
      if (subtask && (subtask.status === 'completed' || subtask.status === 'cancelled')) {
        completedSubtasks.add(subtaskId);
      }
    }

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
   * Check if all subtasks of a parent task are complete and update parent status
   * Called when a subtask completes to potentially mark the parent as complete
   */
  private async checkAndCompleteParentTask(parentTaskId: string): Promise<void> {
    const parentTask = await this.store.getTask(parentTaskId);
    if (!parentTask) return;

    // Only process if parent is still in-progress
    if (parentTask.status !== 'in-progress') return;

    // Check if all subtasks are complete
    const allComplete = await this.aggregateSubtaskResults(parentTaskId);

    if (allComplete) {
      await this.store.addLog(parentTaskId, {
        level: 'info',
        message: 'All subtasks completed. Marking parent task as complete.',
      });

      await this.updateTaskStatus(parentTaskId, 'completed');
      const completedParent = await this.store.getTask(parentTaskId);
      if (completedParent) {
        this.emit('task:completed', completedParent);

        // Handle git operations for the completed parent task
        try {
          const prResult = await this.handleTaskGitOperations(completedParent);
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
    let ghostCount = 0;

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

      // Detect ghost completions: completed subtasks with 0 tokens and 0 usage
      const isGhost = subtask.status === 'completed' &&
        subtask.usage.totalTokens === 0 &&
        subtask.usage.estimatedCost === 0;
      if (isGhost) {
        ghostCount++;
        subtaskSummaries.push(`- ${subtask.description}: ${subtask.status} (ghost - no work done)`);
      } else {
        subtaskSummaries.push(`- ${subtask.description}: ${subtask.status}`);
      }

      // Track incomplete subtasks (including in-progress!)
      if (subtask.status === 'pending' || subtask.status === 'queued' || subtask.status === 'paused' || subtask.status === 'in-progress') {
        pendingCount++;
      } else if (subtask.status === 'failed') {
        failedCount++;
      }
    }

    // Update parent task with aggregated usage
    const totalCost = calculateCost(totalInputTokens, totalOutputTokens);
    await this.store.updateTask(parentTaskId, {
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCost: totalCost,
        totalCostCents: Math.round(totalCost * 100),
        executionTimeMs: 0,
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

    // Warn about ghost completions
    if (ghostCount > 0) {
      const totalSubtasks = parentTask.subtaskIds?.length || 0;
      await this.store.addLog(parentTaskId, {
        level: 'warn',
        message: `Ghost completion warning: ${ghostCount}/${totalSubtasks} subtasks completed without doing any work. ` +
          `These subtasks may need to be re-executed or investigated.`,
      });
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

    // If ALL subtasks are paused, pause the parent and return
    // This ensures proper cascade of pause state up the hierarchy
    if (pausedCount > 0 && pausedCount === subtasksToProcess.length) {
      await this.store.addLog(parentTaskId, {
        level: 'info',
        message: `All ${pausedCount} subtasks are paused - pausing parent task`,
      });

      // Find the first paused subtask to get the pause reason
      const firstPausedSubtask = await this.store.getTask(subtasksToProcess[0].id);
      const pauseReason = firstPausedSubtask?.pauseReason || 'all_subtasks_paused';

      await this.pauseParentTask(parentTaskId, subtasksToProcess[0].id, pauseReason);
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
   * Set up event forwarding from LinterService events to orchestrator lint events (v0.5.0)
   */
  private setupLinterEventForwarding(): void {
    // Forward linter:started events as lint:started
    this.linterService.on('linter:started', (event) => {
      const lintEvent: LintStartedEventData = {
        taskId: this.getCurrentTaskId() || 'unknown',
        linterId: event.linterId,
        files: event.files,
        timestamp: event.timestamp,
      };
      this.emit('lint:started', lintEvent);
    });

    // Forward linter:completed events as lint:completed
    this.linterService.on('linter:completed', (event) => {
      const lintEvent: LintCompletedEventData = {
        taskId: this.getCurrentTaskId() || 'unknown',
        linterId: event.linterId,
        result: event.result,
        timestamp: event.timestamp,
      };
      this.emit('lint:completed', lintEvent);
    });

    // Forward linter:issue events as lint:issue
    this.linterService.on('linter:issue', (event) => {
      const lintEvent: LintIssueEventData = {
        taskId: this.getCurrentTaskId() || 'unknown',
        linterId: event.linterId,
        issue: {
          ruleId: event.issue.ruleId,
          severity: event.issue.severity,
          message: event.issue.message,
          filePath: event.issue.filePath,
          line: event.issue.line,
          column: event.issue.column,
          endLine: event.issue.endLine,
          endColumn: event.issue.endColumn
        },
        timestamp: new Date(),
      };
      this.emit('lint:issue', lintEvent);
    });

    // Forward fix:completed events as lint:fix-applied
    this.linterService.on('fix:completed', (event) => {
      // Process each fix result to create separate fix-applied events
      for (const [linterId, fixResult] of event.result.fixResultsByLinter) {
        const fixEvent: LintFixAppliedEventData = {
          taskId: this.getCurrentTaskId() || 'unknown',
          linterId,
          filePath: 'unknown',
          issuesFixed: fixResult.issuesFixed,
          fixDetails: [],
          timestamp: event.timestamp,
        };
        this.emit('lint:fix-applied', fixEvent);
      }
    });
  }

  /**
   * Set up hook event forwarding
   * Forwards hook events from hook manager to orchestrator events
   */
  private setupHookEventForwarding(): void {
    // Forward hook:pre:start events
    this.hookManager.on('hook:pre:start', (event) => {
      this.emit('hook:pre:start', event);
    });

    // Forward hook:pre:complete events
    this.hookManager.on('hook:pre:complete', (event) => {
      this.emit('hook:pre:complete', event);
    });

    // Forward hook:post:start events
    this.hookManager.on('hook:post:start', (event) => {
      this.emit('hook:post:start', event);
    });

    // Forward hook:post:complete events
    this.hookManager.on('hook:post:complete', (event) => {
      this.emit('hook:post:complete', event);
    });
  }

  /**
   * Build configuration for the autonomy enforcer from the effective config.
   */
  private buildAutonomyEnforcerConfig(): AutonomyEnforcerConfig {
    return {
      level: this.effectiveConfig.autonomy.level,
      gates: this.effectiveConfig.autonomy.gates ?? [],
      limits: {
        maxTokens: this.effectiveConfig.limits.maxTokensPerTask,
        maxCost: this.effectiveConfig.limits.maxCostPerTask,
        maxTimeMs: this.effectiveConfig.limits.maxExecutionTime || undefined,
        dailyBudget: this.effectiveConfig.limits.dailyBudget,
        maxTurns: this.effectiveConfig.limits.maxTurns,
        maxConcurrentTasks: this.effectiveConfig.limits.maxConcurrentTasks,
      },
      warningThresholds: {
        costWarningPercent: 80,
        tokenWarningPercent: 80,
        timeWarningPercent: 80,
        fileWarningPercent: 80,
      },
    };
  }

  /**
   * Determine operation type based on tool name and input
   */
  private determineOperationType(toolName: string, toolInput: any): 'read' | 'write' | 'execute' | 'network' | 'dangerous' {
    const tool = toolName.toLowerCase();

    // Read operations
    if (['read', 'grep', 'glob'].includes(tool)) {
      return 'read';
    }

    // Write operations
    if (['write', 'edit', 'multiedit', 'notebookedit'].includes(tool)) {
      return 'write';
    }

    // Network operations
    if (['webfetch', 'websearch'].includes(tool)) {
      return 'network';
    }

    // Execute operations (potentially dangerous)
    if (tool === 'bash') {
      const command = toolInput?.command || '';
      // Check for dangerous commands
      const dangerousKeywords = ['rm', 'delete', 'drop', 'truncate', 'format', 'sudo'];
      if (dangerousKeywords.some(keyword => command.includes(keyword))) {
        return 'dangerous';
      }
      return 'execute';
    }

    // Default to read for unknown tools
    return 'read';
  }

  /**
   * Create hooks that integrate both the existing hook system and the HookManager
   */
  private createHooksWithManager(hookContext: HookContext, agentName: string, stageName: string, workflowName: string) {
    // Get the base hooks from the existing system
    const baseHooks = createHooks(hookContext);

    // Create additional hooks that integrate with HookManager
    const hookManagerIntegration = {
      PreToolUse: [
        // Add HookManager pre-hook execution at the beginning
        {
          hooks: [async (input: any, toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
            try {
              const invocationId = toolUseId ?? input.tool_use_id ?? crypto.randomUUID();
              // Create action metadata for autonomy check
              const actionMetadata: ActionMetadata = {
                agentType: agentName,
                actionType: input.tool_name || 'unknown',
                scope: input.tool_input?.file_path || input.tool_input?.path || undefined,
                toolName: input.tool_name || 'unknown',
                operationType: this.determineOperationType(input.tool_name || 'unknown', input.tool_input),
              };

              // Check autonomy requirements first
              const requiresApproval = await this.autonomyEnforcer.checkAction(actionMetadata);
              if (requiresApproval) {
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse' as const,
                    permissionDecision: 'deny' as const,
                    permissionDecisionReason: 'Autonomy enforcer requires approval for this action',
                  },
                };
              }

              const activeTaskId = hookContext.taskId || this.currentTaskId;
              if (activeTaskId && this.policyEnforcer?.isEnabled) {
                const task = await this.store.getTask(activeTaskId);
                if (task && task.status !== 'awaiting-approval') {
                  const toolName = input.tool_name || 'unknown';
                  const filePaths = this.extractApprovalFilePaths(toolName, input.tool_input || {});
                  const enforcementMode = this.resolvePolicyEnforcementMode();

                  if (filePaths.length > 0 && enforcementMode !== 'disabled') {
                    const violations = filePaths.flatMap(filePath =>
                      this.policyEnforcer.validateFilePath(filePath, {
                        taskId: activeTaskId,
                        agentId: agentName,
                        workflowId: workflowName,
                        metadata: {
                          stage: stageName,
                          toolName,
                        },
                      })
                    );

                    if (violations.length > 0) {
                      const approvalViolations = violations.filter(violation =>
                        violation.context?.requiresApproval === true || violation.context?.matchType === 'sensitive'
                      );
                      const enforcementViolations = violations.filter(violation =>
                        !approvalViolations.includes(violation)
                      );

                      if (enforcementViolations.length > 0) {
                        const handled = await this.handlePolicyViolations(
                          enforcementViolations,
                          enforcementMode,
                          task,
                          {
                            action: toolName,
                            agentName,
                          }
                        );

                        if (!handled) {
                          return {
                            hookSpecificOutput: {
                              hookEventName: 'PreToolUse' as const,
                              permissionDecision: 'deny' as const,
                              permissionDecisionReason: 'Policy enforcement blocked this action',
                            },
                          };
                        }
                      }

                      if (approvalViolations.length > 0) {
                        const approvalOperation = this.resolveApprovalOperation(toolName, input.tool_input || {}) ?? 'modify';
                        const tokenUsage = task.usage
                          ? (task.usage.totalTokens ?? ((task.usage.inputTokens ?? 0) + (task.usage.outputTokens ?? 0)))
                          : undefined;

                        const approvalReq: ApprovalRequirement = {
                          required: true,
                          triggeredRules: [],
                          urgency: 'normal',
                          timeoutMinutes: 60,
                          requiredApprovers: [],
                          minApprovals: 1,
                          timeoutAction: 'reject',
                          reason: 'Sensitive path access requires approval',
                        };

                        await this.requestPolicyApproval(task, approvalReq, {
                          action: approvalOperation,
                          toolName,
                          stageName,
                          workflowName,
                          filePaths,
                          agentName,
                        });

                        return {
                          hookSpecificOutput: {
                            hookEventName: 'PreToolUse' as const,
                            permissionDecision: 'deny' as const,
                            permissionDecisionReason: 'Policy approval required: sensitive path access',
                          },
                        };
                      }
                    }
                  }

                  const approvalOperation = this.resolveApprovalOperation(
                    toolName,
                    input.tool_input || {}
                  );
                  if (approvalOperation) {
                    const tokenUsage = task.usage
                      ? (task.usage.totalTokens ?? ((task.usage.inputTokens ?? 0) + (task.usage.outputTokens ?? 0)))
                      : undefined;

                    const approvalContext: ApprovalCheckContext = {
                      filePaths,
                      operation: approvalOperation,
                      estimatedCost: task.usage?.estimatedCost,
                      tokenUsage,
                      customContext: {
                        toolName: input.tool_name || 'unknown',
                        stage: stageName,
                        workflow: workflowName,
                      },
                    };

                    const approvalReq = this.policyEnforcer.checkApprovalRequired(
                      task,
                      approvalOperation,
                      approvalContext
                    );

                    if (approvalReq.required) {
                      await this.requestPolicyApproval(task, approvalReq, {
                        action: approvalOperation,
                        toolName: input.tool_name || 'unknown',
                        stageName,
                        workflowName,
                        filePaths: approvalContext.filePaths ?? [],
                        agentName,
                      });

                      return {
                        hookSpecificOutput: {
                          hookEventName: 'PreToolUse' as const,
                          permissionDecision: 'deny' as const,
                          permissionDecisionReason: `Policy approval required: ${approvalReq.reason}`,
                        },
                      };
                    }
                  }
                }
              }

              // Check policy requirements if PolicyEngine is available
              if (this.policyEngine) {
                try {
                  const policyContext: PolicyCheckContext = {
                    action: input.tool_name || 'unknown',
                    agentId: agentName,
                    toolName: input.tool_name || 'unknown',
                    toolArguments: input.tool_input || {},
                    taskId: this.currentTaskId || 'unknown',
                    stage: stageName,
                    resource: input.tool_input?.file_path || input.tool_input?.path,
                    metadata: {
                      workflowId: workflowName,
                      projectPath: this.projectPath,
                    },
                  };

                  const policyResult: PolicyCheckResult = await this.policyEngine.checkPolicy(policyContext);

                  if (policyResult.status === 'deny') {
                    // Policy violation - deny the action and emit policy:blocked event
                    const violations = policyResult.violations?.map(v => v.message).join('; ') || 'Policy violation';

                    // Emit policy:blocked event when action is blocked by policy
                    const blockedEventData: PolicyBlockedEventData = {
                      taskId: this.currentTaskId || 'unknown',
                      agent: agentName,
                      action: input.tool_name || 'unknown',
                      violations: policyResult.violations,
                      enforcementMode: policyResult.enforcementMode,
                      timestamp: new Date(),
                    };
                    this.emit('policy:blocked', blockedEventData);

                    return {
                      hookSpecificOutput: {
                        hookEventName: 'PreToolUse' as const,
                        permissionDecision: 'deny' as const,
                        permissionDecisionReason: `Policy check failed: ${violations}`,
                      },
                    };
                  } else if (policyResult.status === 'allow' && policyResult.violations && policyResult.violations.length > 0) {
                    // Policy violations exist but action is allowed
                    if (policyResult.enforcementMode === 'audit') {
                      // Audit mode behavior - emit policy:audited events without logging
                      for (const violation of policyResult.violations) {
                        // Emit policy:audited event for each violation
                        const auditedEventData: PolicyAuditedEventData = {
                          taskId: this.currentTaskId || 'unknown',
                          agent: agentName,
                          action: input.tool_name || 'unknown',
                          violation,
                          enforcementMode: policyResult.enforcementMode,
                          timestamp: new Date(),
                        };
                        this.emit('policy:audited', auditedEventData);
                      }
                      // Continue execution silently - no console logging in audit mode
                    } else {
                      // Warn mode behavior - log warnings and emit policy:warned events
                      for (const violation of policyResult.violations) {
                        console.warn(
                          `Policy warning [${violation.severity}]: ${violation.message}`,
                          {
                            taskId: this.currentTaskId,
                            agent: agentName,
                            tool: input.tool_name,
                            resource: violation.resource,
                            enforcementMode: policyResult.enforcementMode,
                            violationId: violation.id,
                          }
                        );

                        // Emit policy:warned event for each violation
                        const warnedEventData: PolicyWarnedEventData = {
                          taskId: this.currentTaskId || 'unknown',
                          agent: agentName,
                          action: input.tool_name || 'unknown',
                          violation,
                          enforcementMode: policyResult.enforcementMode,
                          timestamp: new Date(),
                        };
                        this.emit('policy:warned', warnedEventData);
                      }
                    }
                    // Continue with normal execution - action is allowed despite violations
                  }
                } catch (error) {
                  // Log error but don't block execution unless in strict mode
                  console.warn('PolicyEngine check failed:', error);
                  // In production, you might want to fail-safe by allowing the action
                  // or failing based on configuration
                }
              }

              // Create PreHookContext for the HookManager
              const preHookContext = {
                toolName: input.tool_name || 'unknown',
                arguments: input.tool_input || {},
                invocationId,
                taskId: hookContext.taskId,
                agentName,
                stageName,
                timestamp: new Date(),
              };

              // Execute pre-hooks via HookManager
              const result = await this.hookManager.executePreHooks(preHookContext);

              // Handle hook manager results
              if (!result.success) {
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse' as const,
                    permissionDecision: 'deny' as const,
                    permissionDecisionReason: result.cancelReason || 'Pre-hook failed',
                  },
                };
              }

              if (result.cancelled) {
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse' as const,
                    permissionDecision: 'deny' as const,
                    permissionDecisionReason: result.cancelReason || 'Operation cancelled by hook',
                  },
                };
              }

              if (result.modifiedArgs) {
                // Modify the tool input with the modified arguments
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse' as const,
                    updatedInput: {
                      ...input,
                      tool_input: result.modifiedArgs,
                    },
                  },
                };
              }

              return {};
            } catch (error) {
              // Log error and allow execution to continue
              if (hookContext.taskId) {
                await hookContext.store.addLog(hookContext.taskId, {
                  level: 'error',
                  message: `HookManager pre-hook error: ${error instanceof Error ? error.message : String(error)}`,
                  metadata: { tool: input.tool_name, error: String(error) },
                });
              }
              return {};
            }
          }],
          timeout: 30,
          priority: 1000, // High priority to run before other hooks
        },
        // Include existing pre-hooks
        ...(baseHooks.PreToolUse || []),
      ],
      PostToolUse: [
        // Include existing post-hooks first
        ...(baseHooks.PostToolUse || []),
        // Add HookManager post-hook execution at the end
        {
          hooks: [async (input: any, toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
            try {
              const invocationId = toolUseId ?? input.tool_use_id ?? crypto.randomUUID();
              // Create PostHookContext for the HookManager
              const postHookContext = {
                toolName: input.tool_name || 'unknown',
                arguments: input.tool_input || {},
                invocationId,
                taskId: hookContext.taskId,
                agentName,
                stageName,
                timestamp: new Date(),
                result: {
                  success: true, // Assume success if we reach post-hooks
                  output: input.output || null,
                  error: input.error || undefined,
                  duration: undefined as any, // Would be calculated elsewhere
                },
              };

              // Execute post-hooks via HookManager
              await this.hookManager.executePostHooks(postHookContext);

              return {};
            } catch (error) {
              // Log error but don't fail the operation
              if (hookContext.taskId) {
                await hookContext.store.addLog(hookContext.taskId, {
                  level: 'error',
                  message: `HookManager post-hook error: ${error instanceof Error ? error.message : String(error)}`,
                  metadata: { tool: input.tool_name, error: String(error) },
                });
              }
              return {};
            }
          }],
          timeout: 30,
          priority: -1000, // Low priority to run after other hooks
        },
      ],
    };

    return hookManagerIntegration;
  }

  private buildQueryMcpServers(): Record<string, McpServerConfig> | undefined {
    // Get MCP server configs from manager and transform to SDK format
    const internalServers = this.mcpServerManager?.getSdkServerConfigs() ?? {};
    const servers: Record<string, McpServerConfig> = {};

    // Transform our MCPServerConfig to SDK's McpServerConfig format
    for (const [name, config] of Object.entries(internalServers)) {
      const type = config.type ?? 'stdio';
      if (type === 'stdio') {
        servers[name] = {
          type: 'stdio',
          command: config.command!,
          args: config.args,
          env: config.env,
        };
      } else if (type === 'http') {
        servers[name] = {
          type: 'http',
          url: config.url!,
          headers: config.headers,
        };
      } else if (type === 'sse') {
        servers[name] = {
          type: 'sse',
          url: config.url!,
          headers: config.headers,
        };
      }
    }

    if (this.customToolsServer) {
      servers[this.customToolsServer.name] = this.customToolsServer.config as unknown as McpServerConfig;
    }

    if (this.browserToolsServer) {
      servers[this.browserToolsServer.name] = this.browserToolsServer.config as unknown as McpServerConfig;
    }

    // Add MCP proxy server for routing external MCP tool calls
    if (this.mcpConnectionManager && this.mcpToolRegistry) {
      const proxyServer = buildMCPProxyServer({
        connectionManager: this.mcpConnectionManager,
        toolRegistry: this.mcpToolRegistry,
      });

      if (proxyServer) {
        servers[proxyServer.name] = proxyServer.config as unknown as McpServerConfig;
      }
    }

    return Object.keys(servers).length > 0 ? servers : undefined;
  }

  /**
   * List all configured MCP servers
   *
   * @returns Array of MCP server configurations
   */
  public listMcpServers(): MCPServerConfig[] {
    return this.mcpServerManager?.listServers() ?? [];
  }

  public async listMcpMarketplaceEntries(): Promise<MCPMarketplaceEntry[]> {
    if (!this.mcpMarketplaceService) {
      return [];
    }
    return this.mcpMarketplaceService.getMarketplaceEntries();
  }

  /**
   * Install an MCP server by name
   *
   * @param name - Name of the MCP server to install
   * @returns Promise resolving to the installed server configuration
   * @throws {Error} When MCP server manager is not initialized or installation fails
   */
  public async installMcpServer(name: string): Promise<MCPServerConfig> {
    if (!this.mcpServerManager) {
      throw new Error('MCP server manager not initialized');
    }

    const installed = await this.mcpServerManager.installServer(name);
    this.config = await loadConfig(this.projectPath);
    this.effectiveConfig = getEffectiveConfig(this.config);
    this.mcpServerManager.updateConfig(this.config);

    return installed;
  }

  public async uninstallMcpServer(name: string): Promise<void> {
    if (!this.mcpServerManager) {
      throw new Error('MCP server manager not initialized');
    }

    await this.mcpServerManager.uninstallServer(name);
    this.config = await loadConfig(this.projectPath);
    this.effectiveConfig = getEffectiveConfig(this.config);
    this.mcpServerManager.updateConfig(this.config);
  }

  /**
   * Get the current status of an MCP server
   *
   * @param name - Name of the MCP server to check
   * @returns Promise resolving to server status information
   * @throws {Error} When MCP server manager is not initialized or server not found
   */
  public async getMcpServerStatus(name: string): Promise<{
    name: string;
    status: 'running' | 'stopped' | 'error';
    lastError?: string;
  }> {
    if (!this.mcpServerManager) {
      throw new Error('MCP server manager not initialized');
    }

    return this.mcpServerManager.getServerStatus(name);
  }

  /**
   * Get detailed MCP server information by ID
   * @param id - The server ID/name
   * @returns Full server details including tools, readme, and installation instructions
   */
  public async getMcpServerDetails(id: string): Promise<{
    id: string;
    name: string;
    config: MCPServerConfig;
    status: 'running' | 'stopped' | 'error';
    tools?: string[];
    readme?: string;
    installationInstructions?: string;
    metadata?: {
      version?: string;
      author?: string;
      description?: string;
      lastUpdated?: Date;
    };
  }> {
    if (!this.mcpServerManager) {
      throw new Error('MCP server manager not initialized');
    }

    return this.mcpServerManager.getServerDetails(id);
  }

  public async startMcpServer(name: string): Promise<void> {
    if (!this.mcpServerManager) {
      throw new Error('MCP server manager not initialized');
    }

    await this.mcpServerManager.startServer(name);
  }

  public async stopMcpServer(name: string): Promise<void> {
    if (!this.mcpServerManager) {
      throw new Error('MCP server manager not initialized');
    }

    await this.mcpServerManager.stopServer(name);
  }

  /**
   * Enhanced MCP server installation with SQLite tracking and npm/npx support.
   * Passes the name as a string to MCPInstaller.install(), which handles
   * marketplace lookup automatically.
   */
  public async installMcpServerEnhanced(
    nameOrPackage: string,
    options?: {
      force?: boolean;
      args?: string[];
      env?: Record<string, string>;
      global?: boolean;
    }
  ): Promise<{
    name: string;
    config: MCPServerConfig;
    installedFrom: 'marketplace' | 'npm' | 'npx' | 'manual';
    installedAt: Date;
  }> {
    if (!this.mcpInstaller) {
      throw new Error('MCP installer not initialized');
    }

    // Ensure marketplace cache is populated before install
    try {
      await this.updateMcpMarketplaceCache();
    } catch {
      // Marketplace cache update may fail, proceed with install anyway
    }

    // Use string-based install which handles marketplace lookup
    const result = await this.mcpInstaller.install(nameOrPackage, {
      force: options?.force,
      args: options?.args,
      env: options?.env,
      global: options?.global,
    });

    // Update local config after installation
    try {
      this.config = await loadConfig(this.projectPath);
      this.effectiveConfig = getEffectiveConfig(this.config);
      this.mcpServerManager?.updateConfig(this.config);
    } catch {
      // Config reload may fail in test environments
    }

    return result;
  }

  /**
   * Install MCP server from npm/npx directly
   */
  public async installMcpServerFromNpm(
    packageName: string,
    options?: {
      force?: boolean;
      args?: string[];
      env?: Record<string, string>;
      global?: boolean;
    }
  ): Promise<InstalledMCPResult> {
    if (!this.mcpInstaller) {
      throw new Error('MCP installer not initialized');
    }

    const result = await this.mcpInstaller.installFromNpm(packageName, {
      force: options?.force,
      args: options?.args,
      env: options?.env,
      global: options?.global,
    });

    // Update local config after installation
    try {
      this.config = await loadConfig(this.projectPath);
      this.effectiveConfig = getEffectiveConfig(this.config);
      this.mcpServerManager?.updateConfig(this.config);
    } catch {
      // Config reload may fail in test environments
    }

    return result;
  }

  /**
   * List installed MCP servers with enhanced information
   */
  public async listInstalledMcpServers(): Promise<InstalledMCPResult[]> {
    if (!this.mcpInstaller) {
      return [];
    }

    return this.mcpInstaller.listInstalled();
  }

  /**
   * Alias for listInstalledMcpServers
   */
  public async listMcpServersEnhanced(): Promise<InstalledMCPResult[]> {
    return this.listInstalledMcpServers();
  }

  /**
   * List installed MCP servers as InstalledMCPResult objects
   */
  public async listMcpInstallations(): Promise<InstalledMCPResult[]> {
    if (!this.mcpInstaller) {
      return [];
    }

    return this.mcpInstaller.listInstalled();
  }

  /**
   * Uninstall an MCP server using enhanced tracking
   */
  public async uninstallMcpServerEnhanced(name: string): Promise<void> {
    if (!this.mcpInstaller) {
      throw new Error('MCP installer not initialized');
    }

    await this.mcpInstaller.uninstall(name);
  }

  /**
   * Check if an MCP server is installed
   */
  public async isMcpServerInstalled(name: string): Promise<boolean> {
    if (!this.mcpInstaller) {
      return false;
    }

    return this.mcpInstaller.isInstalled(name);
  }

  /**
   * Update MCP marketplace cache
   */
  public async updateMcpMarketplaceCache(): Promise<void> {
    if (!this.mcpInstaller || !this.mcpMarketplaceService) {
      return;
    }

    // Get entries from marketplace service
    const entries = await this.mcpMarketplaceService.getMarketplaceEntries();

    // Update local SQLite cache
    await this.mcpInstaller.updateMarketplaceCache(entries);
  }

  /**
   * Get marketplace entries with filtering options
   */
  /**
   * Get MCP marketplace entries with optional filtering
   *
   * @param options - Filtering options for marketplace entries
   * @param options.category - Filter by category
   * @param options.search - Search term to filter entries
   * @param options.featured - Show only featured entries
   * @param options.verified - Show only verified entries
   * @returns Promise resolving to filtered marketplace entries
   */
  public async getMcpMarketplaceEntries(options?: {
    category?: string;
    search?: string;
    featured?: boolean;
    verified?: boolean;
  }): Promise<MCPMarketplaceEntry[]> {
    if (!this.mcpMarketplaceService) {
      return [];
    }
    return this.mcpMarketplaceService.getMarketplaceEntries(options);
  }

  /**
   * Get marketplace categories
   */
  public async getMcpMarketplaceCategories(): Promise<Array<{ name: string; count: number }>> {
    if (!this.mcpMarketplaceService) {
      return [];
    }
    return this.mcpMarketplaceService.getCategories();
  }

  /**
   * Get featured marketplace entries
   */
  public async getFeaturedMcpEntries(): Promise<MCPMarketplaceEntry[]> {
    if (!this.mcpMarketplaceService) {
      return [];
    }
    return this.mcpMarketplaceService.getFeaturedEntries();
  }

  /**
   * Auto-configure standard development tools
   */
  public async autoConfigureMcpTools(options?: AutoConfigurationOptions): Promise<{
    configured: MCPServerConfig[];
    skipped: string[];
    errors: Array<{ name: string; error: string }>;
  }> {
    if (!this.mcpMarketplaceService) {
      throw new Error('MCP marketplace service not initialized');
    }

    const result = await this.mcpMarketplaceService.autoConfigureStandardTools(options);

    // Refresh configuration after auto-configuration
    this.config = await loadConfig(this.projectPath);
    this.effectiveConfig = getEffectiveConfig(this.config);
    this.mcpServerManager?.updateConfig(this.config);

    return result;
  }

  /**
   * Get installation recommendations for the current project
   */
  public async getMcpInstallationRecommendations(): Promise<{
    essential: MCPMarketplaceEntry[];
    recommended: MCPMarketplaceEntry[];
    optional: MCPMarketplaceEntry[];
  }> {
    if (!this.mcpMarketplaceService) {
      return { essential: [], recommended: [], optional: [] };
    }
    return this.mcpMarketplaceService.getInstallationRecommendations();
  }

  /**
   * Get MCP marketplace entries from cache
   */
  public async getCachedMcpMarketplaceEntries(): Promise<MCPMarketplaceEntry[]> {
    if (!this.mcpInstaller) {
      return [];
    }

    return this.mcpInstaller.getMarketplaceEntries();
  }

  /**
   * Get all current MCP connections
   *
   * @returns Array of current MCP connections
   */
  public getMCPConnections(): MCPConnection[] {
    return this.mcpConnectionManager?.listConnections() ?? [];
  }

  /**
   * Get a specific MCP connection by server ID
   *
   * @param serverId - The ID of the MCP server
   * @returns The MCP connection or undefined if not found
   */
  public getMCPConnection(serverId: string): MCPConnection | undefined {
    return this.mcpConnectionManager?.getConnection(serverId);
  }

  /**
   * Get available MCP tools translated to Claude Agent SDK format
   * for use in agent execution
   *
   * @returns Array of Claude SDK compatible tools
   */
  public getMcpToolsForAgent(): ClaudeSDKTool[] {
    if (!this.mcpToolRegistry) {
      return [];
    }

    return this.mcpToolRegistry.getAvailableTools()
      .map(entry => entry.claudeTool);
  }

  /**
   * Get statistics about discovered MCP tools
   *
   * @returns Registry statistics or undefined if registry not initialized
   */
  public getMcpToolStats(): MCPToolRegistryStats | undefined {
    return this.mcpToolRegistry?.getStats();
  }

  /**
   * Refresh MCP tools from all connected servers
   *
   * @returns Promise that resolves when refresh is complete
   */
  public async refreshMcpTools(): Promise<void> {
    if (!this.mcpToolRegistry) {
      return;
    }

    await this.mcpToolRegistry.refreshAllTools();
  }

  /**
   * Connect to an MCP server
   *
   * @param serverId - The ID of the MCP server to connect to
   * @returns Promise that resolves to the MCP connection
   */
  public async connectMCPServer(serverId: string): Promise<MCPConnection> {
    if (!this.mcpConnectionManager) {
      throw new Error('MCP Connection Manager is not initialized');
    }
    return this.mcpConnectionManager.connect(serverId);
  }

  /**
   * Disconnect from an MCP server
   *
   * @param serverId - The ID of the MCP server to disconnect from
   * @returns Promise that resolves when disconnected
   */
  public async disconnectMCPServer(serverId: string): Promise<void> {
    if (!this.mcpConnectionManager) {
      throw new Error('MCP Connection Manager is not initialized');
    }
    return this.mcpConnectionManager.disconnect(serverId);
  }

  /**
   * Check the health of an MCP connection
   *
   * @param serverId - The ID of the MCP server to check
   * @returns Promise that resolves to the health check result
   */
  public async checkMCPServerHealth(serverId: string): Promise<HealthCheckResult> {
    if (!this.mcpConnectionManager) {
      throw new Error('MCP Connection Manager is not initialized');
    }
    const mcpResult = await this.mcpConnectionManager.checkHealth(serverId);

    // Convert MCP health check result to core HealthCheckResult format
    return {
      id: `health-${serverId}-${Date.now()}`,
      connectionId: serverId,
      method: 'ping',
      startedAt: mcpResult.timestamp || new Date(),
      completedAt: new Date(),
      success: mcpResult.success,
      latencyMs: mcpResult.latencyMs,
      error: mcpResult.error?.message,
      status: mcpResult.isHealthy ? 'healthy' : 'unhealthy',
      consecutiveFailures: mcpResult.consecutiveFailures,
      isHealthy: mcpResult.isHealthy,
    };
  }

  /**
   * Set up interaction event handlers
   * Handles iteration events emitted by the interaction manager
   */
  private setupInteractionEventHandlers(): void {
    this.interactionManager.on('task:iterate', async (taskId: string, parameters: Record<string, unknown>) => {
      // The iteration has been logged, but we might want to handle it further
      // For now, just complete the iteration to capture the after state
      try {
        const iterationId = parameters.iterationId as string;
        await this.interactionManager.completeIteration(taskId, iterationId);
      } catch (error) {
        console.error(`Failed to complete iteration for task ${taskId}:`, error);
      }
    });
  }

  /**
   * Set up autonomy enforcer event handlers
   * Handles approval:required events from autonomy enforcer for task pausing
   */
  private setupAutonomyEnforcerEvents(): void {
    // Handle approval:required events from autonomy enforcer
    this.autonomyEnforcer.on('approval:required', async (gateName: string, context: any) => {
      try {
        // Extract task ID from context
        const taskId = context?.task?.id || context?.taskId;
        if (!taskId) {
          console.warn('Autonomy enforcer approval:required event missing task context');
          return;
        }

        // Get the task to check current status
        const task = await this.store.getTask(taskId);
        if (!task) {
          console.warn(`Task ${taskId} not found for autonomy enforcer approval`);
          return;
        }

        // Only pause if task is currently running
        if (task.status === 'in-progress') {
          await this.pauseTask(taskId, 'approval_gate');

          await this.store.addLog(taskId, {
            level: 'info',
            message: `Task paused by autonomy enforcer for approval gate: ${gateName}`,
            timestamp: new Date(),
            metadata: { gateName, component: 'autonomy-enforcer' }
          });

          // Log autonomy mode change for audit (autonomy enforcer triggered supervision)
          await this.store.logModeChange(
            taskId,
            task.autonomy,
            'supervised',
            `Autonomy enforcer triggered approval gate: ${gateName}`
          );

          // Create approval state and emit approval:required event
          const approvalId = `approval_${taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const approvalUrl = this.generateApprovalUrl(approvalId);
          const timestamp = new Date();

          // Create approval state in store
          await this.store.saveApprovalState({
            id: approvalId,
            taskId,
            gateName,
            status: 'pending',
            requestedAt: timestamp,
            approvalsReceived: 0,
            approvalsRequired: 1,
            context: {
              autonomyLevel: task.autonomy,
              triggeredBy: 'autonomy-enforcer',
              gateType: this.mapGateNameToType(gateName),
              ...context
            },
            stage: context?.currentStage,
            agent: context?.agent,
          });

          // Emit approval:required event with proper event data structure
          const eventData: ApprovalRequiredEventData = {
            approvalId,
            taskId,
            gateName,
            gateType: this.mapGateNameToType(gateName),
            description: this.generateGateDescription(gateName, task.autonomy),
            minApprovals: 1,
            timestamp,
            stage: context?.currentStage,
            agent: context?.agent,
            context: {
              autonomyLevel: task.autonomy,
              triggeredBy: 'autonomy-enforcer',
              operationType: context?.operationType,
              ...context
            },
            blocking: true,
            approvalUrl,
          };

          this.emit('approval:required', eventData);

          // Emit approval:request event for autonomy enforcer approvals
          const approvalRequestData: ApprovalRequest = {
            requestId: approvalId,
            taskId,
            description: this.generateGateDescription(gateName, task.autonomy),
            reason: `Autonomy level "${task.autonomy}" requires approval for operation "${context?.operationType || 'unknown'}"`,
            resourceImpact: this.calculateResourceImpactForAutonomy(task, gateName, context),
            id: approvalId, // Legacy field
            gateName,
            gateType: this.mapGateNameToType(gateName),
            approvers: ['user'], // Autonomy enforcer approvals typically require user approval
            minApprovals: 1,
            requestedAt: timestamp,
            timeoutMinutes: 30, // Default timeout for autonomy approvals
            expiresAt: new Date(timestamp.getTime() + 30 * 60 * 1000), // 30 minutes from now
            stage: context?.currentStage,
            agent: context?.agent,
            context: {
              taskId,
              taskDescription: task.description,
              taskPriority: task.priority,
              taskWorkflow: task.workflow,
              acceptanceCriteria: task.acceptanceCriteria,
              currentStage: context?.currentStage,
              currentAgent: context?.agent,
              approvalUrl,
              autonomyLevel: task.autonomy,
              triggeredBy: 'autonomy-enforcer',
              operationType: context?.operationType,
              blocking: true,
            },
          };

          this.emit('approval:request', approvalRequestData);
        }
      } catch (error) {
        console.error('Error handling autonomy enforcer approval:required event:', error);
      }
    });

    this.autonomyEnforcer.on('limit:warning', (warning) => {
      const taskId = warning.taskId ?? this.currentTaskId;
      if (!taskId) {
        return;
      }

      const utilizationPercent = warning.limitValue > 0
        ? (warning.currentValue / warning.limitValue) * 100
        : warning.threshold;

      this.emit('limit:warning', {
        taskId,
        limitType: warning.type,
        currentValue: warning.currentValue,
        limitValue: warning.limitValue,
        percentage: utilizationPercent,
        timestamp: new Date(),
      });
    });

    this.autonomyEnforcer.on('limit:exceeded', async (result, task) => {
      if (!result.limitType || result.currentValue === undefined || result.limitValue === undefined) {
        return;
      }

      if (!['tokens', 'cost', 'time', 'files'].includes(result.limitType)) {
        return;
      }

      const limitType = result.limitType as LimitExceededEvent['limitType'];

      this.emit('limit:exceeded', {
        taskId: task.id,
        limitType,
        currentValue: result.currentValue,
        limitValue: result.limitValue,
        percentage: (result.currentValue / result.limitValue) * 100,
        timestamp: new Date(),
      });

      const pauseReason = limitType === 'cost'
        ? 'budget'
        : limitType === 'tokens'
        ? 'token_limit'
        : 'usage_limit';

      await this.pauseTask(task.id, pauseReason);
    });
  }

  /**
   * Set up event-based approval resolution mechanism
   * Allows external systems to resolve approvals via events in addition to direct method calls
   */
  private setupApprovalEventHandlers(): void {
    // Listen for external approval decisions via events
    this.on('approval:decision', async (event: {
      approvalId: string;
      decision: 'approved' | 'denied';
      approver: string;
      comment?: string;
      reason?: string;
    }) => {
      try {
        if (event.decision === 'approved') {
          await this.grantApproval(event.approvalId, event.approver, event.comment);
        } else if (event.decision === 'denied') {
          const reason = event.reason || event.comment || 'No reason provided';
          await this.denyApproval(event.approvalId, event.approver, reason);
        }
      } catch (error) {
        console.error(`Error processing approval decision event for ${event.approvalId}:`, error);

        // Try to log the error to the associated task if possible
        try {
          const approvalState = await this.store.getApprovalStateById(event.approvalId);
          if (approvalState) {
            await this.store.addLog(approvalState.taskId, {
              level: 'error',
              message: `Failed to process approval decision event: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date(),
              metadata: {
                approvalId: event.approvalId,
                decision: event.decision,
                approver: event.approver,
                component: 'approval-event-handler'
              }
            });
          }
        } catch (logError) {
          console.error('Failed to log approval event error:', logError);
        }
      }
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
            metadata: { component: 'workspace-cleanup' }
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
          metadata: { component: 'workspace-cleanup' }
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
              metadata: { component: 'workspace-cleanup' }
            });
          }
        }
      }
    });
  }

  /**
   * Initialize TDD executor with current configuration and agents
   */
  private async initializeTDDExecutor(): Promise<void> {
    // Check if TDD is configured in the project config
    const tddConfig = this.config.tdd;
    if (!tddConfig?.enabled) {
      return; // TDD not enabled
    }

    const config: TDDExecutorConfig = {
      maxIterations: tddConfig.maxIterations || 3,
      testCommand: tddConfig.testCommand || 'npm test',
      workingDirectory: this.projectPath,
      testTimeout: 60000, // Default timeout since not in TDDModeConfig
      enableEvents: true,
    };

    this.tddExecutor = new TDDExecutor(config, this.agents);

    // Forward TDD events to orchestrator events
    this.setupTDDEventForwarding();
  }

  /**
   * Register available linter plugins with the linter service
   *
   * Automatically detects and registers ESLint and Prettier plugins
   * based on configuration and tool availability.
   */
  private async registerAvailableLinterPlugins(): Promise<void> {
    const linterConfig = this.config.linter;

    // Skip if linter is globally disabled
    if (linterConfig?.global?.enabled === false) {
      return;
    }

    // Register ESLint plugin if configured and available
    if (linterConfig?.eslint?.enabled !== false) {
      const eslintPlugin = new ESLintPlugin();
      try {
        const isAvailable = await eslintPlugin.isAvailable();
        if (isAvailable) {
          this.linterService.register(eslintPlugin, {
            priority: 1,
            enabled: true,
            autoFix: linterConfig?.eslint?.autoFix ?? true,
            timeout: linterConfig?.global?.timeoutMs ?? 60000,
            include: linterConfig?.eslint?.include || [],
          });
          console.log('ESLint plugin registered successfully');
        } else {
          console.log('ESLint not found, skipping plugin registration');
        }
      } catch (error) {
        console.warn('Failed to register ESLint plugin:', error);
      }
    }

    // Register Prettier plugin if configured and available
    if (linterConfig?.prettier?.enabled !== false) {
      const prettierPlugin = new PrettierPlugin();
      try {
        const isAvailable = await prettierPlugin.isAvailable();
        if (isAvailable) {
          this.linterService.register(prettierPlugin, {
            priority: 2,
            enabled: true,
            autoFix: linterConfig?.prettier?.autoFix ?? true,
            timeout: linterConfig?.global?.timeoutMs ?? 60000,
            include: linterConfig?.prettier?.include || [],
          });
          console.log('Prettier plugin registered successfully');
        } else {
          console.log('Prettier not found, skipping plugin registration');
        }
      } catch (error) {
        console.warn('Failed to register Prettier plugin:', error);
      }
    }

    // Register custom linters if configured
    const customLinters = linterConfig?.custom || [];
    for (const customConfig of customLinters) {
      if (customConfig.enabled !== false) {
        // TODO: Implement custom linter plugin support in future iteration
        console.log(`Custom linter '${customConfig.name}' configuration found, but custom linter support not yet implemented`);
      }
    }
  }

  /**
   * Setup event forwarding from TDD executor to orchestrator
   */
  private setupTDDEventForwarding(): void {
    if (!this.tddExecutor) return;

    this.tddExecutor.on('tdd:started', (config, taskId) => {
      this.emit('apex-event', {
        type: 'tdd:started' as ApexEventType,
        taskId,
        timestamp: new Date(),
        data: { config },
      });
    });

    this.tddExecutor.on('tdd:iteration-started', (iteration, taskId) => {
      this.emit('apex-event', {
        type: 'tdd:iteration-started' as ApexEventType,
        taskId,
        timestamp: new Date(),
        data: { iteration },
      });
    });

    this.tddExecutor.on('tdd:test-run', (testResult, iteration, taskId) => {
      this.emit('apex-event', {
        type: 'tdd:test-run' as ApexEventType,
        taskId,
        timestamp: new Date(),
        data: { testResult, iteration },
      });
    });

    this.tddExecutor.on('tdd:fix-generated', (fix, iteration, taskId) => {
      this.emit('apex-event', {
        type: 'tdd:fix-generated' as ApexEventType,
        taskId,
        timestamp: new Date(),
        data: { fix, iteration },
      });
    });

    this.tddExecutor.on('tdd:fix-applied', (fixResult, iteration, taskId) => {
      this.emit('apex-event', {
        type: 'tdd:fix-applied' as ApexEventType,
        taskId,
        timestamp: new Date(),
        data: { fixResult, iteration },
      });
    });

    this.tddExecutor.on('tdd:iteration-completed', (result, taskId) => {
      this.emit('apex-event', {
        type: 'tdd:iteration-completed' as ApexEventType,
        taskId,
        timestamp: new Date(),
        data: { result },
      });
    });

    this.tddExecutor.on('tdd:completed', (result, taskId) => {
      this.emit('apex-event', {
        type: 'tdd:completed' as ApexEventType,
        taskId,
        timestamp: new Date(),
        data: { result },
      });
    });

    this.tddExecutor.on('tdd:failed', (error, iteration, taskId) => {
      this.emit('apex-event', {
        type: 'tdd:failed' as ApexEventType,
        taskId,
        timestamp: new Date(),
        data: { error: error.message, iteration },
      });
    });
  }

  /**
   * Setup MCP connection event forwarding
   * Forwards MCP connection events from MCPConnectionManager to the orchestrator's event system
   * with proper metadata and timestamps.
   */
  private setupMCPEventForwarding(): void {
    const connManager = this.mcpConnectionManager;
    if (!connManager) return;

    // Forward connection events
    connManager.on('connected', (connection) => {
      const eventData: MCPConnectionEventData = {
        serverId: connection.serverId,
        serverName: connection.serverName,
        timestamp: new Date(),
        config: {
          type: connection.config.type || 'stdio',
          command: connection.config.command,
          url: connection.config.url,
        },
      };
      this.emit('mcp:connected', eventData);
    });

    // Forward disconnection events
    connManager.on('disconnected', (serverId, reason) => {
      const connection = connManager.getConnection(serverId);
      const eventData: MCPDisconnectionEventData = {
        serverId,
        serverName: connection?.serverName || serverId,
        reason,
        timestamp: new Date(),
      };
      this.emit('mcp:disconnected', eventData);
    });

    // Forward error events
    connManager.on('error', (serverId, error) => {
      const connection = connManager.getConnection(serverId);
      const eventData: MCPErrorEventData = {
        serverId,
        serverName: connection?.serverName || serverId,
        error: error.message,
        timestamp: new Date(),
        code: error.name || 'UNKNOWN_ERROR',
      };
      this.emit('mcp:error', eventData);
    });

    // Forward reconnection events
    connManager.on('reconnecting', (serverId, attempt, maxAttempts) => {
      const connection = connManager.getConnection(serverId);
      const eventData: MCPReconnectingEventData = {
        serverId,
        serverName: connection?.serverName || serverId,
        attempt,
        maxAttempts,
        timestamp: new Date(),
      };
      this.emit('mcp:reconnecting', eventData);
    });

    // Forward health check events
    connManager.on('healthCheck', (serverId, result) => {
      const connection = connManager.getConnection(serverId);
      const eventData: MCPHealthCheckEventData = {
        serverId,
        serverName: connection?.serverName || serverId,
        success: result.success,
        latencyMs: result.latencyMs,
        error: result.error?.message,
        consecutiveFailures: result.consecutiveFailures,
        isHealthy: result.isHealthy,
        timestamp: result.timestamp,
      };
      this.emit('mcp:health-check', eventData);
    });

    // Forward state change events
    connManager.on('stateChange', (serverId, previousState, newState) => {
      const connection = connManager.getConnection(serverId);
      const eventData: MCPStateChangeEventData = {
        serverId,
        serverName: connection?.serverName || serverId,
        previousState,
        newState,
        timestamp: new Date(),
      };
      this.emit('mcp:state-change', eventData);
    });

    // Forward pool change events
    connManager.on('poolChange', (serverId, poolSize, activeConnections) => {
      const connection = connManager.getConnection(serverId);
      const eventData: MCPPoolChangeEventData = {
        serverId,
        serverName: connection?.serverName || serverId,
        poolSize,
        activeConnections,
        timestamp: new Date(),
      };
      this.emit('mcp:pool-change', eventData);
    });

    // Forward tool execution events
    connManager.on('tool:start', (event) => {
      this.emit('mcp:tool-start', {
        serverId: event.serverId,
        serverName: event.serverName,
        toolName: event.toolName,
        callId: event.callId,
        timestamp: event.timestamp,
      });
    });

    connManager.on('tool:complete', (event) => {
      this.emit('mcp:tool-complete', {
        serverId: event.serverId,
        serverName: event.serverName,
        toolName: event.toolName,
        callId: event.callId,
        durationMs: event.durationMs,
        timestamp: event.timestamp,
      });
    });

    connManager.on('tool:error', (event) => {
      this.emit('mcp:tool-error', {
        serverId: event.serverId,
        serverName: event.serverName,
        toolName: event.toolName,
        callId: event.callId,
        error: event.error,
        errorCode: event.errorCode,
        retriable: event.retriable,
        timestamp: event.timestamp,
      });
    });
  }

  /**
   * Setup browser event integration with task context correlation
   * Forwards browser automation events from BrowserTool and BrowserConsoleStream
   * to the orchestrator's event system with proper task and agent context.
   */
  private setupBrowserEventIntegration(): void {
    // Get the console stream from browser tool for event integration
    const consoleStream = browserTool.getConsoleStream();

    if (consoleStream) {
      // Forward console messages with task context
      consoleStream.on('message', (message) => {
        const browserEvent: BrowserConsoleEvent = {
          taskId: this.currentTaskId || 'unknown',
          agentName: this.currentAgentName || 'unknown',
          message: {
            type: message.type,
            text: message.text,
            timestamp: message.timestamp,
            level: message.level,
            args: message.args,
            location: message.location,
            stack: message.stack,
            sessionId: message.sessionId,
            pageContext: message.pageContext,
          },
          timestamp: new Date(),
        };
        this.emit('browser:console', browserEvent);
      });

      // Forward runtime errors with task context
      consoleStream.on('error', (error) => {
        const browserEvent: BrowserErrorEvent = {
          taskId: this.currentTaskId || 'unknown',
          agentName: this.currentAgentName || 'unknown',
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
            timestamp: error.timestamp,
            source: error.source,
            category: error.category,
            severity: error.severity,
            context: error.context,
            sessionId: error.sessionId,
          },
          timestamp: new Date(),
        };
        this.emit('browser:error', browserEvent);
      });

      // Forward network errors with task context
      consoleStream.on('network-error', (networkError) => {
        const browserEvent: BrowserNetworkErrorEvent = {
          taskId: this.currentTaskId || 'unknown',
          agentName: this.currentAgentName || 'unknown',
          error: {
            url: networkError.url,
            method: networkError.method,
            status: networkError.status,
            statusText: networkError.statusText,
            timestamp: networkError.timestamp,
            sessionId: networkError.sessionId,
          },
          timestamp: new Date(),
        };
        this.emit('browser:network-error', browserEvent);
      });

      // Forward performance warnings with task context
      consoleStream.on('performance-warning', (warning) => {
        const browserEvent: BrowserPerformanceWarningEvent = {
          taskId: this.currentTaskId || 'unknown',
          agentName: this.currentAgentName || 'unknown',
          warning: {
            type: warning.type,
            message: warning.message,
            duration: warning.duration,
            timestamp: warning.timestamp,
            sessionId: warning.sessionId,
          },
          timestamp: new Date(),
        };
        this.emit('browser:performance-warning', browserEvent);
      });

      // Forward security violations with task context
      consoleStream.on('security-violation', (violation) => {
        const browserEvent: BrowserSecurityViolationEvent = {
          taskId: this.currentTaskId || 'unknown',
          agentName: this.currentAgentName || 'unknown',
          violation: {
            type: violation.type,
            message: violation.message,
            blockedURI: violation.blockedURI,
            timestamp: violation.timestamp,
            sessionId: violation.sessionId,
          },
          timestamp: new Date(),
        };
        this.emit('browser:security-violation', browserEvent);
      });

      // Forward stream lifecycle events
      consoleStream.on('stream-started', (config) => {
        const browserEvent: BrowserSessionStartedEvent = {
          taskId: this.currentTaskId || 'unknown',
          agentName: this.currentAgentName || 'unknown',
          session: {
            sessionId: config.sessionId || 'unknown',
            browserType: 'chromium', // Default, could be made configurable
            userAgent: 'unknown', // Would need to extract from page context
            viewport: { width: 1280, height: 720 }, // Default, could be made configurable
            headless: true, // Default, could be made configurable
          },
          timestamp: new Date(),
        };
        this.emit('browser:session-started', browserEvent);
      });

      consoleStream.on('stream-stopped', () => {
        const stats = consoleStream.getStats();
        const browserEvent: BrowserSessionEndedEvent = {
          taskId: this.currentTaskId || 'unknown',
          agentName: this.currentAgentName || 'unknown',
          session: {
            sessionId: stats.sessionId,
            duration: 0, // Duration calculation would need to be implemented
            pagesVisited: 1, // Would need to track this
            errorsCount: stats.errorsCount,
            consoleMessagesCount: stats.messagesCount,
          },
          timestamp: new Date(),
        };
        this.emit('browser:session-ended', browserEvent);
      });
    }

    // Forward BrowserManager events with task context correlation
    // These events provide browser instance lifecycle information
    this.browserManager.on('browser:launched', (info) => {
      const event: BrowserManagerLaunchedEvent = {
        taskId: this.currentTaskId || 'unknown',
        agentName: this.currentAgentName || 'unknown',
        browserInfo: {
          id: info.id,
          engine: info.engine,
          version: info.version,
          isConnected: info.isConnected,
          pid: info.pid,
        },
        timestamp: new Date(),
      };
      this.emit('browser:launched', event);
    });

    this.browserManager.on('browser:closed', (browserId) => {
      const event: BrowserManagerClosedEvent = {
        taskId: this.currentTaskId || 'unknown',
        agentName: this.currentAgentName || 'unknown',
        browserId,
        timestamp: new Date(),
      };
      this.emit('browser:closed', event);
    });

    this.browserManager.on('context:created', (info) => {
      const event: BrowserManagerContextCreatedEvent = {
        taskId: this.currentTaskId || 'unknown',
        agentName: this.currentAgentName || 'unknown',
        contextInfo: {
          id: info.id,
          browserId: info.browserId,
          pageCount: info.pageCount,
        },
        timestamp: new Date(),
      };
      this.emit('browser:context-created', event);
    });

    this.browserManager.on('context:closed', (contextId, browserId) => {
      const event: BrowserManagerContextClosedEvent = {
        taskId: this.currentTaskId || 'unknown',
        agentName: this.currentAgentName || 'unknown',
        contextId,
        browserId,
        timestamp: new Date(),
      };
      this.emit('browser:context-closed', event);
    });

    this.browserManager.on('page:created', (page, contextId, browserId) => {
      const event: BrowserManagerPageCreatedEvent = {
        taskId: this.currentTaskId || 'unknown',
        agentName: this.currentAgentName || 'unknown',
        contextId,
        browserId,
        timestamp: new Date(),
      };
      this.emit('browser:page-created', event);
    });

    this.browserManager.on('page:closed', (contextId, browserId) => {
      const event: BrowserManagerPageClosedEvent = {
        taskId: this.currentTaskId || 'unknown',
        agentName: this.currentAgentName || 'unknown',
        contextId,
        browserId,
        timestamp: new Date(),
      };
      this.emit('browser:page-closed', event);
    });

    this.browserManager.on('error', (error, operation) => {
      const event: BrowserManagerErrorEvent = {
        taskId: this.currentTaskId || 'unknown',
        agentName: this.currentAgentName || 'unknown',
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          operation,
        },
        timestamp: new Date(),
      };
      this.emit('browser:manager-error', event);
    });
  }

  /**
   * Setup context tracking for task and agent correlation in events
   * Maintains current task and agent state for proper event attribution
   */
  private setupContextTracking(): void {
    // Track agent transitions to maintain current agent context
    this.on('agent:transition', (taskId: string, fromAgent: string | null, toAgent: string) => {
      // Only update current agent if this is for the current task
      if (this.currentTaskId === taskId) {
        this.currentAgentName = toAgent;
      }
    });

    // Clear agent context when task completes or fails
    this.on('task:completed', (task) => {
      if (this.currentTaskId === task.id) {
        this.currentAgentName = null;
      }
    });

    this.on('task:failed', (task) => {
      if (this.currentTaskId === task.id) {
        this.currentAgentName = null;
      }
    });
  }

  /**
   * Execute TDD loop for the current task or specified task
   */
  async executeTDD(taskId?: string): Promise<TDDExecutionResult> {
    if (!this.tddExecutor) {
      throw new Error('TDD executor not initialized. Ensure TDD is enabled in configuration.');
    }

    const executionTaskId = taskId || this.currentTaskId || generateTaskId();
    return await this.tddExecutor.execute(executionTaskId);
  }

  /**
   * Check if TDD is enabled and available
   */
  isTDDEnabled(): boolean {
    return this.tddExecutor !== undefined;
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

  /**
   * Get the interaction manager instance
   * Provides access to task iteration and interaction capabilities
   */
  getInteractionManager(): InteractionManager {
    return this.interactionManager;
  }

  /**
   * Get the permission manager instance
   * Provides access to permission checking and management capabilities
   */
  get permissionManager(): PermissionManager {
    return this._permissionManager;
  }

  /**
   * Get the permission store instance
   * Provides access to permission storage capabilities
   */
  get permissionStore(): PermissionStore {
    return this._permissionStore;
  }

  /**
   * Get the permission preset manager instance
   * Provides access to permission preset management capabilities
   */
  get presetManager(): PermissionPresetManager {
    return this._permissionPresetManager;
  }

  /**
   * Iterate on a running task with new instructions
   */
  async iterateTask(
    taskId: string,
    instructions: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    await this.ensureInitialized();
    return await this.interactionManager.iterateTask(taskId, instructions, context);
  }

  /**
   * Get the difference between iterations of a task
   */
  async getIterationDiff(
    taskId: string,
    iterationId?: string
  ): Promise<import('@apexcli/core').IterationDiff> {
    await this.ensureInitialized();
    return await this.interactionManager.getIterationDiff(taskId, iterationId);
  }

  /**
   * Get iteration history for a task
   */
  async getIterationHistory(taskId: string): Promise<import('@apexcli/core').IterationHistory> {
    await this.ensureInitialized();
    return await this.store.getIterationHistory(taskId);
  }

  /**
   * Push a task's branch to the remote repository
   */
  async pushTaskBranch(taskId: string): Promise<{ success: boolean; error?: string; remoteBranch?: string }> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      return { success: false, error: `Task not found: ${taskId}` };
    }

    if (!task.branchName) {
      return { success: false, error: 'Task does not have a branch' };
    }

    try {
      // Use existing gitPushTask method which includes build/test validation
      const success = await this.gitPushTask(task);

      if (success) {
        return {
          success: true,
          remoteBranch: `origin/${task.branchName}`
        };
      } else {
        // gitPushTask returned false - check if it's due to configuration or validation
        const logs = await this.store.getLogs(taskId);
        const recentErrorLog = logs
          .filter(log => log.level === 'error' || log.level === 'warn')
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        const errorMessage = recentErrorLog?.message || 'Push failed - check task logs for details';
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Merge a task branch into the main branch
   * @param taskId The task identifier
   * @param options Merge options
   * @returns Promise with merge result
   */
  async mergeTaskBranch(taskId: string, options: { squash?: boolean } = {}): Promise<MergeTaskBranchResult> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      return { success: false, error: `Task not found: ${taskId}` };
    }

    if (!task.branchName) {
      return { success: false, error: 'Task does not have a branch' };
    }

    try {
      await this.store.addLog(taskId, {
        level: 'info',
        message: `Starting ${options.squash ? 'squash ' : ''}merge of branch ${task.branchName}`,
      });

      // Determine the main branch (main or master)
      let mainBranch = 'main';
      try {
        await execAsync('git show-ref --verify --quiet refs/heads/main', {
          cwd: this.projectPath,
        });
      } catch {
        // main branch doesn't exist, try master
        try {
          await execAsync('git show-ref --verify --quiet refs/heads/master', {
            cwd: this.projectPath,
          });
          mainBranch = 'master';
        } catch {
          // Neither main nor master exists, default to main
          mainBranch = 'main';
        }
      }

      // Check if we're already on the task branch
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectPath,
      });

      if (currentBranch.trim() === task.branchName) {
        // Switch to main branch first
        await execAsync(`git checkout ${mainBranch}`, {
          cwd: this.projectPath,
        });

        await this.store.addLog(taskId, {
          level: 'info',
          message: `Switched to ${mainBranch} branch for merge`,
        });
      }

      // Pull latest changes from remote to ensure we're up to date
      try {
        await execAsync(`git pull origin ${mainBranch}`, {
          cwd: this.projectPath,
        });
      } catch (pullError) {
        // If pull fails, log warning but continue (might be working offline)
        await this.store.addLog(taskId, {
          level: 'warn',
          message: 'Could not pull latest changes from remote',
        });
      }

      // Perform the merge
      const mergeCommand = options.squash
        ? `git merge --squash ${task.branchName}`
        : `git merge --no-ff ${task.branchName}`;

      try {
        const { stdout: mergeOutput } = await execAsync(mergeCommand, {
          cwd: this.projectPath,
        });

        await this.store.addLog(taskId, {
          level: 'info',
          message: `Merge completed: ${mergeOutput.substring(0, 200)}`,
        });

        // Get the list of changed files
        const { stdout: diffOutput } = await execAsync('git diff --name-only HEAD~1', {
          cwd: this.projectPath,
        });
        const changedFiles = diffOutput.trim().split('\n').filter(file => file.length > 0);

        let commitHash: string | undefined;

        // For squash merges, we need to commit the changes
        if (options.squash) {
          const commitMessage = `Squash merge of ${task.branchName}: ${task.description}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4 <noreply@anthropic.com>`;

          const { stdout: commitOutput } = await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
            cwd: this.projectPath,
          });

          // Extract commit hash from commit output
          const commitMatch = commitOutput.match(/\[.*?([a-f0-9]+)\]/);
          commitHash = commitMatch?.[1];

          await this.store.addLog(taskId, {
            level: 'info',
            message: `Squash merge commit created: ${commitHash}`,
          });
        } else {
          // For normal merges, get the merge commit hash
          const { stdout: hashOutput } = await execAsync('git rev-parse HEAD', {
            cwd: this.projectPath,
          });
          commitHash = hashOutput.trim().substring(0, 8);
        }

        await this.store.addLog(taskId, {
          level: 'info',
          message: `${options.squash ? 'Squash merge' : 'Merge'} completed successfully. Changed files: ${changedFiles.join(', ')}`,
        });

        return {
          success: true,
          changedFiles,
          commitHash,
        };

      } catch (mergeError) {
        const errorOutput = (mergeError as any).stdout || (mergeError as any).stderr || (mergeError as Error).message;

        // Check for merge conflicts
        if (errorOutput.includes('CONFLICT') || errorOutput.includes('Automatic merge failed')) {
          // Abort the merge to leave the repository in a clean state
          try {
            await execAsync('git merge --abort', { cwd: this.projectPath });
          } catch (abortError) {
            // If abort fails, log warning but continue
            await this.store.addLog(taskId, {
              level: 'warn',
              message: 'Failed to abort merge, repository may be in conflicted state',
            });
          }

          await this.store.addLog(taskId, {
            level: 'error',
            message: 'Merge conflicts detected. Merge has been aborted.',
          });

          return {
            success: false,
            conflicted: true,
            error: 'Merge conflicts detected. Please resolve conflicts manually using git status, edit the conflicted files, then git add and git commit.',
          };
        }

        // Other merge errors
        await this.store.addLog(taskId, {
          level: 'error',
          message: `Merge failed: ${errorOutput}`,
        });

        return {
          success: false,
          error: `Merge failed: ${errorOutput}`,
        };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.store.addLog(taskId, {
        level: 'error',
        message: `Error during merge: ${errorMsg}`,
      });

      return { success: false, error: errorMsg };
    }
  }

  // ============================================================================
  // Task Template Operations
  // ============================================================================

  /**
   * Save a task as a template
   * @param taskId ID of the task to save as template
   * @param name Name for the template
   * @returns The created template
   */
  async saveTemplate(taskId: string, name: string): Promise<TaskTemplate> {
    await this.ensureInitialized();

    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Generate template from the task
    const templateId = generateTaskTemplateId();
    const template = await this.store.createTemplate({
      id: templateId,
      name: name.trim(),
      description: task.description,
      workflow: task.workflow,
      priority: task.priority,
      effort: task.effort,
      acceptanceCriteria: task.acceptanceCriteria,
      tags: [], // Start with empty tags, can be customized later
    });

    await this.store.addLog(taskId, {
      level: 'info',
      message: `Task saved as template: ${name} (ID: ${templateId})`,
    });

    return template;
  }

  /**
   * List all available templates
   * @returns Array of all templates
   */
  async listTemplates(): Promise<TaskTemplate[]> {
    await this.ensureInitialized();
    return this.store.getAllTemplates();
  }

  /**
   * Create a new task from a template
   * @param templateId ID of the template to use
   * @param overrides Optional task property overrides
   * @returns The created task
   */
  async useTemplate(templateId: string, overrides?: Partial<CreateTaskRequest>): Promise<Task> {
    await this.ensureInitialized();

    const template = await this.store.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const task = await this.store.createTaskFromTemplate(templateId, {
      ...overrides,
      projectPath: overrides?.projectPath || this.projectPath,
    });

    await this.store.addLog(task.id, {
      level: 'info',
      message: `Task created from template: ${template.name} (Template ID: ${templateId})`,
    });

    this.emit('task:created', task);
    return task;
  }

  /**
   * Delete a template
   * @param templateId ID of the template to delete
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await this.ensureInitialized();

    const template = await this.store.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    await this.store.deleteTemplate(templateId);
  }

  /**
   * Create a new template directly (not from a task)
   * @param data Template data without timestamps and ID
   * @returns The created template
   */
  async createTemplate(data: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskTemplate> {
    await this.ensureInitialized();

    // Generate template ID
    const templateId = generateTaskTemplateId();

    // Create the template with generated ID
    const template = await this.store.createTemplate({
      id: templateId,
      ...data,
    });

    this.emit('template:created', template);
    return template;
  }

  /**
   * Get a template by ID
   * @param id Template ID
   * @returns The template or null if not found
   */
  async getTemplate(id: string): Promise<TaskTemplate | null> {
    await this.ensureInitialized();
    return this.store.getTemplate(id);
  }

  /**
   * Update a template
   * @param id Template ID
   * @param updates Partial template updates
   * @returns The updated template
   */
  async updateTemplate(id: string, updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TaskTemplate> {
    await this.ensureInitialized();

    // Check if template exists
    const existingTemplate = await this.store.getTemplate(id);
    if (!existingTemplate) {
      throw new Error(`Template not found: ${id}`);
    }

    // Update the template
    await this.store.updateTemplate(id, updates);

    // Get the updated template
    const updatedTemplate = await this.store.getTemplate(id);
    if (!updatedTemplate) {
      throw new Error(`Failed to retrieve updated template: ${id}`);
    }

    this.emit('template:updated', updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Load project-specific APEX rules from the .apexrules file.
   * This is a private helper called during initialization.
   */
  private async loadApexRules(): Promise<void> {
    const apexRulesPath = path.join(this.projectPath, '.apex', '.apexrules');
    
    try {
      const fileContent = await fs.readFile(apexRulesPath, 'utf8');
      const parsedRules = yaml.load(fileContent) as { rules?: ApexRule[] };
      const normalizedRules = (parsedRules?.rules ?? []).map((rule) => ({
        ...rule,
        enabled: rule.enabled ?? true,
      })) as Array<ApexRule & { enabled: boolean }>;

      if (normalizedRules.length > 0) {
        // Assign to config.projectRules directly
        this.config.projectRules = normalizedRules.filter(rule => rule.enabled);
        console.log(`Loaded ${this.config.projectRules.length} APEX rules from ${apexRulesPath}`);
        
        // Register these rules with the PolicyEngine
        if (this.policyEngine) {
          this.policyEngine.registerApexRules(this.config.projectRules as any);
          console.log(`Registered ${this.config.projectRules.length} APEX rules with PolicyEngine.`);
        } else {
          console.warn('PolicyEngine not initialized. APEX rules will not be enforced.');
        }
      } else {
        console.warn(`APEX rules file ${apexRulesPath} is empty or malformed. No rules loaded.`);
        this.config.projectRules = []; // Ensure it's an empty array if malformed
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`No .apexrules file found at ${apexRulesPath}. Proceeding without project rules.`);
      } else {
        console.error(`Failed to load .apexrules from ${apexRulesPath}:`, error);
      }
      this.config.projectRules = []; // Ensure it's an empty array on error
    }
  }

  /**
   * Close the orchestrator and cleanup resources
   */
  close(): void {
    if (this.store) {
      this.store.close();
    }
  }

  /**
   * Get all currently active tool executions
   * @returns Array of currently running tool executions
   */
  getActiveToolExecutions(): ToolExecution[] {
    return Array.from(this.activeToolExecutions.values());
  }

  /**
   * Get a specific tool execution by call ID
   * @param callId The tool call ID
   * @returns The tool execution if found, undefined otherwise
   */
  getToolExecution(callId: string): ToolExecution | undefined {
    return this.activeToolExecutions.get(callId);
  }

  /**
   * Get the count of currently active tool executions
   * @returns Number of active tool executions
   */
  getActiveToolExecutionCount(): number {
    return this.activeToolExecutions.size;
  }

  /**
   * Check if a specific tool call is currently active
   * @param callId The tool call ID
   * @returns True if the tool execution is active, false otherwise
   */
  isToolExecutionActive(callId: string): boolean {
    return this.activeToolExecutions.has(callId);
  }

  /**
   * Create a FileSnapshot object for a given file path
   * @param filePath Absolute path to the file
   * @param existed Whether the file existed before the operation
   * @returns FileSnapshot object or null if file cannot be read
   */
  private async createFileSnapshot(filePath: string, existed: boolean = true): Promise<FileSnapshot | null> {
    try {
      let content = '';
      let fileStats: Stats | null = null;

      if (existed) {
        try {
          content = readFileSync(filePath, 'utf8');
          fileStats = statSync(filePath);
        } catch (error) {
          // File doesn't exist, treat as non-existent
          existed = false;
        }
      }

      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      const now = new Date();

      return {
        id: crypto.randomUUID(),
        filePath,
        content,
        checksum,
        fileSize: content.length,
        lastModified: fileStats?.mtime || now,
        snapshotTime: now,
        existed,
      };
    } catch (error) {
      await this.store.addLog(this.currentHookContext?.taskId || '', {
        level: 'warn',
        message: `Failed to create file snapshot for ${filePath}: ${String(error)}`,
        metadata: { filePath, error: String(error) },
      });
      return null;
    }
  }

  /**
   * Extract file paths from tool input for file-modifying tools
   * @param toolName Name of the tool
   * @param toolInput Input parameters for the tool
   * @returns Array of file paths that might be modified
   */
  private extractFilePathsFromToolInput(toolName: string, toolInput: Record<string, unknown>): string[] {
    const filePaths: string[] = [];

    // Extract file path based on tool type
    if ('file_path' in toolInput && typeof toolInput.file_path === 'string') {
      filePaths.push(toolInput.file_path);
    } else if ('notebook_path' in toolInput && typeof toolInput.notebook_path === 'string') {
      filePaths.push(toolInput.notebook_path);
    } else if ('path' in toolInput && typeof toolInput.path === 'string') {
      filePaths.push(toolInput.path);
    }

    // For MultiEdit, extract all file paths
    if (toolName === 'MultiEdit' && 'edits' in toolInput && Array.isArray(toolInput.edits)) {
      for (const edit of toolInput.edits) {
        if (typeof edit === 'object' && edit && 'file_path' in edit && typeof edit.file_path === 'string') {
          filePaths.push(edit.file_path);
        }
      }
    }

    return filePaths;
  }

  /**
   * Record tool action for file-modifying tools with before/after snapshots
   * @param taskId Task ID
   * @param toolExecution Completed tool execution
   */
  private async recordFileModifyingToolAction(taskId: string, toolExecution: ToolExecution): Promise<void> {
    // Only record for file-modifying tools
    if (!FILE_MODIFYING_TOOLS.includes(toolExecution.toolName)) {
      return;
    }

    // Only record for successful tool executions
    if (toolExecution.status !== 'completed' || !toolExecution.result?.success) {
      return;
    }

    const modifiedFiles: string[] = [];
    const beforeSnapshots: FileSnapshot[] = [];
    const afterSnapshots: FileSnapshot[] = [];

    try {
      // Get file paths from tool input
      const filePaths = this.extractFilePathsFromToolInput(toolExecution.toolName, toolExecution.input);

      // Get before snapshots from hooks context if available
      const hookContext = this.currentHookContext;
      if (hookContext?.fileSnapshots) {
        for (const filePath of filePaths) {
          const beforeContent = hookContext.fileSnapshots.get(filePath);
          if (beforeContent !== undefined) {
            // Create before snapshot from hooks data
            const beforeSnapshot = await this.createFileSnapshotFromContent(
              filePath,
              beforeContent,
              true // existed before
            );
            if (beforeSnapshot) {
              beforeSnapshots.push(beforeSnapshot);
            }
          }
        }
      }

      // Create after snapshots for all modified files
      for (const filePath of filePaths) {
        try {
          const afterSnapshot = await this.createFileSnapshot(filePath, true);
          if (afterSnapshot) {
            afterSnapshots.push(afterSnapshot);
            modifiedFiles.push(filePath);
          }
        } catch (error) {
          // Log but continue with other files
          await this.store.addLog(taskId, {
            level: 'warn',
            message: `Failed to create after snapshot for ${filePath}: ${String(error)}`,
            metadata: { filePath, error: String(error) },
          });
        }
      }

      // Only record if we have modified files
      if (modifiedFiles.length > 0) {
        const createdFiles = beforeSnapshots
          .filter(snapshot => !snapshot.existed)
          .map(snapshot => snapshot.filePath);
        const modifiedFromSnapshots = beforeSnapshots
          .filter(snapshot => snapshot.existed)
          .map(snapshot => snapshot.filePath);
        const remainingModified = modifiedFiles.filter(filePath =>
          !createdFiles.includes(filePath) && !modifiedFromSnapshots.includes(filePath)
        );

        await this.updateFileChanges(taskId, {
          created: createdFiles,
          modified: [...modifiedFromSnapshots, ...remainingModified],
        });

        await this.toolActionStore.recordToolAction(
          taskId,
          toolExecution,
          modifiedFiles,
          beforeSnapshots,
          afterSnapshots
        );

        await this.store.addLog(taskId, {
          level: 'debug',
          message: `Recorded tool action for ${toolExecution.toolName} with ${modifiedFiles.length} file(s)`,
          metadata: {
            toolName: toolExecution.toolName,
            modifiedFiles,
            beforeSnapshotsCount: beforeSnapshots.length,
            afterSnapshotsCount: afterSnapshots.length,
          },
        });
      }
    } catch (error) {
      throw new Error(`Failed to record tool action: ${String(error)}`);
    }
  }

  /**
   * Create a FileSnapshot object from existing content (for before snapshots)
   * @param filePath Absolute path to the file
   * @param content File content
   * @param existed Whether the file existed
   * @returns FileSnapshot object
   */
  private async createFileSnapshotFromContent(
    filePath: string,
    content: string,
    existed: boolean = true
  ): Promise<FileSnapshot | null> {
    try {
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      const now = new Date();

      // Try to get actual file stats if file exists
      let fileStats: Stats | null = null;
      try {
        fileStats = statSync(filePath);
      } catch {
        // File doesn't exist or can't be accessed
      }

      return {
        id: crypto.randomUUID(),
        filePath,
        content,
        checksum,
        fileSize: content.length,
        lastModified: fileStats?.mtime || now,
        snapshotTime: now,
        existed,
      };
    } catch (error) {
      await this.store.addLog(this.currentHookContext?.taskId || '', {
        level: 'warn',
        message: `Failed to create file snapshot from content for ${filePath}: ${String(error)}`,
        metadata: { filePath, error: String(error) },
      });
      return null;
    }
  }

  /**
   * Get the tool action store instance
   */
  getToolActionStore(): ToolActionStore {
    return this.toolActionStore;
  }

  /**
   * Get all pending approvals from the task store
   */
  async getPendingApprovals(): Promise<ApprovalState[]> {
    return await this.store.getPendingApprovals();
  }

  /**
   * List all active task workspaces
   */
  async listAllWorkspaces(): Promise<WorkspaceInfo[]> {
    await this.ensureInitialized();
    return this.workspaceManager.listWorkspaces();
  }

  /**
   * Get an approval state by its ID
   */
  async getApprovalStateById(approvalId: string): Promise<ApprovalState | null> {
    return await this.store.getApprovalStateById(approvalId);
  }

  /**
   * Execute a task in dry-run mode - simulates execution without making actual changes
   */
  private async executeDryRunTask(taskId: string, task: Task): Promise<void> {
    await this.store.updateTaskStatus(taskId, 'in-progress');

    // Load workflow for simulation
    const workflow = await loadWorkflow(this.projectPath, task.workflow);
    if (!workflow) {
      throw new Error(`Workflow not found: ${task.workflow}`);
    }

    await this.store.addLog(taskId, {
      level: 'info',
      message: `🎭 Simulating workflow: ${workflow.name} with ${workflow.stages.length} stages`,
    });

    // Simulate each stage of the workflow
    for (const [index, stage] of workflow.stages.entries()) {
      await this.store.addLog(taskId, {
        level: 'info',
        message: `🎭 Simulating stage ${index + 1}/${workflow.stages.length}: ${stage.name} (agent: ${stage.agent})`,
      });

      // Simulate stage execution time (brief delay to make it feel realistic)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update current stage
      await this.store.updateTask(taskId, {
        currentStage: stage.name,
        updatedAt: new Date(),
      });

      await this.store.addLog(taskId, {
        level: 'info',
        message: `✅ Stage ${stage.name} simulated successfully`,
      });
    }

    // Complete the dry-run task
    await this.store.updateTaskStatus(taskId, 'completed');
    await this.store.updateTask(taskId, {
      completedAt: new Date(),
      updatedAt: new Date(),
      currentStage: undefined,
    });

    await this.store.addLog(taskId, {
      level: 'info',
      message: '✅ DRY-RUN COMPLETE: Task simulation finished successfully',
    });

    // Emit completion event
    const completedTask = await this.store.getTask(taskId);
    if (completedTask) {
      this.emit('task:completed', completedTask);
    }
  }

  private resolveApprovalOperation(
    toolName: string,
    toolInput: Record<string, unknown>
  ): ApprovalOperationType | null {
    if (FILE_MODIFYING_TOOLS.includes(toolName)) {
      if (toolName === 'Write') {
        const overwrite = Boolean(toolInput.overwrite);
        return overwrite ? 'modify' : 'create';
      }
      return 'modify';
    }

    if (toolName === 'Bash') {
      return 'execute';
    }

    return null;
  }

  private extractApprovalFilePaths(toolName: string, toolInput: Record<string, unknown>): string[] {
    return this.extractFilePathsFromToolInput(toolName, toolInput);
  }

  private getStageIndex(workflowName: string, stageName: string): number {
    const workflow = this.workflows[workflowName];
    if (!workflow) {
      return 0;
    }

    const index = workflow.stages.findIndex(stage => stage.name === stageName);
    return index >= 0 ? index : 0;
  }

  private async requestPolicyApproval(
    task: Task,
    approvalReq: ApprovalRequirement,
    context: {
      action: ApprovalOperationType;
      toolName: string;
      stageName: string;
      workflowName: string;
      filePaths: string[];
      agentName: string;
    }
  ): Promise<void> {
    if (task.status === 'awaiting-approval') {
      return;
    }

    const rule = approvalReq.triggeredRules[0];
    const ruleId = rule?.id || rule?.name || 'approval';
    const gateName = `policy-${ruleId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    const requestedAt = new Date();

    const approvalState: ApprovalState = {
      id: generateApprovalId(),
      taskId: task.id,
      gateName,
      status: 'pending',
      requestedAt,
      stage: context.stageName,
      agent: context.agentName,
      approvalsReceived: 0,
      approvalsRequired: approvalReq.minApprovals || 1,
      timeoutMinutes: approvalReq.timeoutMinutes,
      expiresAt: approvalReq.timeoutMinutes ? new Date(Date.now() + approvalReq.timeoutMinutes * 60000) : undefined,
      context: {
        workflowName: context.workflowName,
        toolName: context.toolName,
        action: context.action,
        reason: approvalReq.reason,
        filePaths: context.filePaths,
        triggeredRuleIds: approvalReq.triggeredRules.map(triggered => triggered.id),
      },
    };

    await this.store.saveApprovalState(approvalState);
    await this.store.logApprovalRequest(task.id, `Policy approval: ${gateName} - ${approvalReq.reason}`);
    await this.store.logModeChange(
      task.id,
      task.autonomy,
      'supervised',
      `Policy approval required: ${approvalReq.reason}`
    );

    const currentTask = await this.store.getTask(task.id);
    const conversationState = currentTask?.conversation || [];
    const stageIndex = this.getStageIndex(context.workflowName, context.stageName);

    const checkpointId = await this.saveCheckpoint(task.id, {
      stage: context.stageName,
      stageIndex,
      conversationState,
      metadata: {
        pauseReason: 'policy_approval',
        gateName,
        approvalId: approvalState.id,
        resumePoint: 'pre_tool_gate',
        toolName: context.toolName,
      },
    });

    await this.store.setGate(task.id, {
      name: gateName,
      status: 'pending',
      requiredAt: approvalState.requestedAt,
    });

    await this.store.updateTask(task.id, {
      status: 'awaiting-approval',
      pausedAt: new Date(),
      pauseReason: 'approval_gate',
      updatedAt: new Date(),
    });

    const eventData: ApprovalRequiredEventData = {
      approvalId: approvalState.id,
      taskId: task.id,
      gateName,
      gateType: this.mapGateNameToType(gateName),
      description: rule?.description || approvalReq.reason,
      approvers: approvalReq.requiredApprovers,
      minApprovals: approvalReq.minApprovals,
      timeoutMinutes: approvalReq.timeoutMinutes,
      expiresAt: approvalState.expiresAt,
      stage: context.stageName,
      agent: context.agentName,
      timestamp: new Date(),
      context: approvalState.context,
      blocking: true,
      approvalUrl: this.generateApprovalUrl(approvalState.id),
    };

    this.emit('approval:required', eventData);

    // Emit approval:request event for policy approvals
    const approvalRequestData: ApprovalRequest = {
      requestId: approvalState.id,
      taskId: task.id,
      description: `Policy approval required for ${gateName}`,
      reason: `Tool "${context.toolName}" requires policy approval due to enforcement level`,
      resourceImpact: this.calculateResourceImpactForPolicy(task, context),
      id: approvalState.id, // Legacy field
      gateName,
      gateType: 'before-tool' as any, // Policy gates are typically before tool execution
      approvers: ['user'], // Policy approvals typically require user approval
      minApprovals: 1,
      requestedAt: approvalState.requestedAt,
      timeoutMinutes: 30, // Default timeout for policy approvals
      expiresAt: approvalState.expiresAt,
      stage: context.stageName,
      agent: context.agentName,
      context: {
        taskId: task.id,
        taskDescription: task.description,
        taskPriority: task.priority,
        taskWorkflow: task.workflow,
        acceptanceCriteria: task.acceptanceCriteria,
        currentStage: context.stageName,
        currentAgent: context.agentName,
        approvalUrl: this.generateApprovalUrl(approvalState.id),
        toolName: context.toolName,
        triggeredBy: 'policy-enforcer',
        blocking: true,
      },
    };

    this.emit('approval:request', approvalRequestData);

    await this.store.addLog(task.id, {
      level: 'info',
      message: `Task paused for policy approval "${gateName}". Checkpoint ${checkpointId} saved.`,
      stage: context.stageName,
      agent: context.agentName,
    });
  }

  private resolvePolicyEnforcementMode(): PolicyEnforcementMode {
    const guardrails = this.effectiveConfig.guardrails;
    const guardrailsEnabled = guardrails?.enabled !== false;
    const guardrailPolicies = guardrailsEnabled && guardrails?.policies?.enabled !== false
      ? guardrails.policies
      : undefined;

    const guardrailEnforcement = guardrailPolicies?.enforcement ?? guardrails?.enforcement;
    if (guardrailEnforcement) {
      return guardrailEnforcement === 'block' ? 'strict' : guardrailEnforcement;
    }

    return this.policyEnforcer?.enforcementMode ?? 'warn';
  }

  private async handlePolicyViolations(
    violations: PolicyViolation[],
    enforcementMode: PolicyEnforcementMode,
    task: Task,
    context: {
      action: string;
      agentName: string;
    }
  ): Promise<boolean> {
    if (violations.length === 0 || enforcementMode === 'disabled') {
      return true;
    }

    if (enforcementMode === 'strict') {
      this.emit('policy:blocked', {
        taskId: task.id,
        agent: context.agentName,
        action: context.action,
        violations,
        enforcementMode,
        timestamp: new Date(),
      });

      await this.store.addLog(task.id, {
        level: 'error',
        message: `Policy enforcement blocked action: ${context.action}`,
        metadata: { violations },
      });

      return false;
    }

    const eventType = enforcementMode === 'audit' ? 'policy:audited' : 'policy:warned';
    const logLevel = enforcementMode === 'audit' ? 'info' : 'warn';

    for (const violation of violations) {
      if (eventType === 'policy:audited') {
        this.emit('policy:audited', {
          taskId: task.id,
          agent: context.agentName,
          action: context.action,
          violation,
          enforcementMode,
          timestamp: new Date(),
        });
      } else {
        this.emit('policy:warned', {
          taskId: task.id,
          agent: context.agentName,
          action: context.action,
          violation,
          enforcementMode,
          timestamp: new Date(),
        });
      }
    }

    await this.store.addLog(task.id, {
      level: logLevel,
      message: `Policy violations detected for action: ${context.action}`,
      metadata: { violations, enforcementMode },
    });

    return true;
  }

  /**
   * Maps gate names to approval checkpoint types
   */
  private mapGateNameToType(gateName: string): ApprovalCheckpointType {
    const gateMap: Record<string, ApprovalCheckpointType> = {
      'before-commit': 'before-commit',
      'before-deploy': 'before-deploy',
      'before-destructive': 'before-destructive',
      'review-all': 'before-deploy', // Default for review-all autonomy
      'before-merge': 'before-deploy',
      'before-network': 'before-network',
    };

    return gateMap[gateName] || 'before-destructive'; // Default to safest option
  }

  /**
   * Generates a description for the approval gate based on gate name and autonomy level
   */
  private generateGateDescription(gateName: string, autonomyLevel: AutonomyLevel): string {
    const descriptions: Record<string, string> = {
      'before-commit': 'Approval required before committing changes to version control',
      'before-deploy': 'Approval required before deployment operations',
      'before-destructive': 'Approval required before destructive operations (delete, overwrite)',
      'before-network': 'Approval required before network operations',
      'review-all': `Manual review required (autonomy level: ${autonomyLevel})`,
      'before-merge': 'Approval required before merging changes',
    };

    return descriptions[gateName] || `Approval required for ${gateName} (autonomy level: ${autonomyLevel})`;
  }

  /**
   * Generates approval URL from the configured API URL and approval ID
   */
  private generateApprovalUrl(approvalId: string): string | undefined {
    if (!this.apiUrl) {
      return undefined;
    }

    // Ensure the URL ends with a slash for proper concatenation
    const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl : `${this.apiUrl}/`;
    return `${baseUrl}approvals/${approvalId}`;
  }

  /**
   * Calculates the resource impact level for a task and stage
   */
  private calculateResourceImpact(task: Task, stage: WorkflowStage): string {
    // Determine resource impact based on task priority, stage type, and agent
    if (task.priority === 'urgent' || task.priority === 'high') {
      return 'high';
    }

    // High impact stages
    if (stage.name.toLowerCase().includes('deploy') ||
        stage.name.toLowerCase().includes('production') ||
        stage.name.toLowerCase().includes('security')) {
      return 'high';
    }

    // Medium impact stages
    if (stage.name.toLowerCase().includes('test') ||
        stage.name.toLowerCase().includes('build') ||
        stage.name.toLowerCase().includes('review')) {
      return 'medium';
    }

    // Default to low impact
    return 'low';
  }

  /**
   * Calculates resource impact for autonomy enforcer approvals
   */
  private calculateResourceImpactForAutonomy(task: Task, gateName: string, context: any): string {
    // High impact for dangerous operations or file system modifications
    if (gateName.includes('dangerous') ||
        context?.operationType === 'file-modify' ||
        context?.operationType === 'execute' ||
        task.priority === 'urgent') {
      return 'high';
    }

    // Medium impact for network operations or system changes
    if (context?.operationType === 'network' ||
        context?.operationType === 'system' ||
        task.priority === 'high') {
      return 'medium';
    }

    // Low impact for read operations and normal priority tasks
    return 'low';
  }

  /**
   * Calculates resource impact for policy approvals
   */
  private calculateResourceImpactForPolicy(task: Task, context: any): string {
    // High impact for file system operations or execution commands
    if (context?.toolName === 'Bash' ||
        context?.toolName === 'Write' ||
        context?.toolName === 'Edit' ||
        task.priority === 'urgent') {
      return 'high';
    }

    // Medium impact for network operations or multifile operations
    if (context?.toolName === 'WebFetch' ||
        context?.toolName === 'WebSearch' ||
        context?.toolName === 'MultiEdit' ||
        task.priority === 'high') {
      return 'medium';
    }

    // Low impact for read operations
    return 'low';
  }

  /**
   * Gets the list of files affected by a task
   */
  private getAffectedFiles(taskId: string): string[] | undefined {
    // This would typically track files that have been modified by the task
    // For now, return undefined as this is a basic implementation
    return undefined;
  }

  // ============================================================================
  // Tool Execution Hooks API
  // ============================================================================

  /**
   * Register a callback to be invoked when a tool starts execution
   * @param callback Function to call when a tool starts
   * @returns Unsubscribe function to remove the hook
   */
  onToolStart(callback: ToolStartHookCallback): () => void {
    const handler = (event: ToolCallStartEvent) => {
      const activeExecution = this.getToolExecution(event.callId);
      const context: ToolStartHookContext = {
        toolName: event.toolName,
        input: event.input,
        callId: event.callId,
        taskId: event.taskId,
        timestamp: event.timestamp,
        agentName: activeExecution?.agentName,
        stageName: activeExecution?.stageName,
      };
      callback(context);
    };
    this.on('tool:start', handler);
    return () => this.off('tool:start', handler);
  }

  /**
   * Register a callback to be invoked when a tool completes successfully
   * @param callback Function to call when a tool completes
   * @returns Unsubscribe function to remove the hook
   */
  onToolComplete(callback: ToolCompleteHookCallback): () => void {
    const handler = (event: ToolCallCompleteEvent) => {
      if (!event.result.success) return; // Skip errors, handled by onToolError

      const activeExecution = this.getToolExecution(event.callId);
      const context: ToolCompleteHookContext = {
        toolName: event.toolName,
        input: activeExecution?.input || {},
        callId: event.callId,
        taskId: event.taskId,
        timestamp: event.timestamp,
        result: event.result,
        timing: event.timing,
        agentName: activeExecution?.agentName,
        stageName: activeExecution?.stageName,
      };
      callback(context);
    };
    this.on('tool:complete', handler);
    return () => this.off('tool:complete', handler);
  }

  /**
   * Register a callback to be invoked when a tool execution fails
   * @param callback Function to call when a tool fails
   * @returns Unsubscribe function to remove the hook
   */
  onToolError(callback: ToolErrorHookCallback): () => void {
    const handler = (event: ToolCallCompleteEvent) => {
      if (event.result.success) return; // Skip successes, handled by onToolComplete

      const activeExecution = this.getToolExecution(event.callId);
      const context: ToolErrorHookContext = {
        toolName: event.toolName,
        input: activeExecution?.input || {},
        callId: event.callId,
        taskId: event.taskId,
        timestamp: event.timestamp,
        error: event.result.error || 'Unknown error',
        timing: event.timing,
        agentName: activeExecution?.agentName,
        stageName: activeExecution?.stageName,
      };
      callback(context);
    };
    this.on('tool:complete', handler);
    return () => this.off('tool:complete', handler);
  }

  /**
   * Gracefully shutdown the orchestrator
   * Disconnects all MCP servers and cleans up resources
   */
  async shutdown(): Promise<void> {
    // Disconnect all MCP servers with timeout
    if (this.mcpConnectionManager) {
      try {
        await Promise.race([
          this.mcpConnectionManager.disconnectAll(),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)) // 5 second timeout
        ]);
      } catch (error) {
        console.warn('Error disconnecting MCP servers:', error instanceof Error ? error.message : error);
      }
    }

    // Clear tool registry
    if (this.mcpToolRegistry) {
      this.mcpToolRegistry.clear();
    }

    // Close store
    if (this.store) {
      this.store.close();
    }

    this.initialized = false;
  }
}

export { TaskStore, ToolActionStore } from './store';
export { PermissionStore } from './permission-store';
export { MCPServerStore } from './mcp-store';
// MCPInstaller is exported later with type MCPInstallationOptions
export { MCPConnectionManager, type MCPConnectionManagerOptions, type MCPConnectionManagerEvents } from './mcp/connection-manager';
export {
  MCPToolRegistry,
  type MCPToolRegistryEntry,
  type MCPToolRegistryStats,
  type MCPToolRegistryEvents,
  type MCPToolRegistryOptions,
  type MCPConnectionManager as MCPConnectionManagerInterface
} from './mcp-tool-registry';

// Mock MCP Server Components for Testing
export {
  MockMCPServer,
  MockMCPServerFacade,
  MockTransport,
  MockBehaviorEngine,
  MockMCPProtocolHandler,
  MockMCPServerBuilder,
  createMockServerBuilder,
  createSimpleMockServer,
  createErrorMockServer,
  createSlowMockServer,
  // Preset Factory (ADR-080)
  createMockMCPServer,
  createFileSystemMockServer,
  createDatabaseMockServer,
  createApiMockServer,
  createMinimalMockServer,
  MockAssertionError,
  // Error Simulation Presets (ADR-072)
  ERROR_SIMULATION_PRESETS,
  getErrorPreset,
  mergePresetWithOverrides,
  getAvailablePresets,
  getPresetsByCategory,
  // Test Wrapper Utilities (ADR-081)
  withMockMCP,
  withMockMCPFacade,
  // Types
  type ConnectedClient,
  type MockServerState,
  type MockServerPreset,
  type ServerPresetConfig,
  type CreateMockServerOptions,
  type RecordedRequest,
  type RecordedNotification,
  type MockTransportOptions,
  type ProtocolState,
  type MethodHandler,
  type RegisteredHandler,
  type ErrorInjectionResult,
  type ComputedDelay,
  type MockServerFacadeEvents,
  type MockServerStats,
  type ErrorSimulationCheckResult,
  type ErrorSimulationState,
  type ErrorSimulationEvents,
  type WithMockMCPOptions,
} from './mcp/mock-server/index.js';

export { PermissionManager } from './permission-manager';
export { PermissionPresetManager } from './permission-preset-manager';
export {
  BrowserManager,
  createBrowserManager,
  browserManager,
  type BrowserManagerOptions,
  type BrowserLaunchConfig,
  type BrowserContextConfig,
  type BrowserInfo,
  type BrowserContextInfo,
  type BrowserEngine,
  type CleanupOptions,
  type BrowserManagerEvents,
} from './browser-manager';
export {
  MultimodalInputHandler,
  MultimodalInputError,
  multimodalInputHandler,
  processImageFile,
  processWebPage,
  processGitHubIssueImages,
  processDesignMockup,
  isFigmaUrl,
  parseFigmaUrl,
  type ImageBlockParam,
  type MultimodalInputHandlerConfig,
  type ImageProcessResult,
  type WebPageOptions,
  type WebPageContent,
  type GitHubIssueImageResult,
} from './tools/multimodal-input-handler';

// Design mockup types for MultimodalInputHandler
export {
  DesignMockupError,
  type DesignTool,
  type DesignExportFormat,
  type DesignDimensionUnit,
  type DesignDimensions,
  type TypographyValue,
  type DesignTokens,
  type ComponentBounds,
  type DesignComponent,
  type DesignAnnotation,
  type FigmaUrlInfo,
  type DesignMockupOptions,
  type DesignFileMetadata,
  type DesignMockupProcessResult,
  type FigmaUrlParseResult,
  type DesignMockupHandlerConfig,
  type DesignMockupErrorCode,
} from './tools/design-mockup-types';

// Test utilities for state cleanup and test isolation
export {
  TestCleanup,
  TestHooks,
  createTestHooks,
  TestAssertions,
  TestUtils,
  type CleanupConfig
} from './test-cleanup';
export { buildOrchestratorPrompt, buildAgentDefinitions, buildStagePrompt, buildResumePrompt } from './prompts';
export { createHooks } from './hooks';
export { HookManager, type HookExecutionStartEvent, type HookExecutionCompleteEvent } from './hook-manager';
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
export { HealthMonitor } from './health-monitor';

// Tools
export {
  WebFetchTool,
  webFetchTool,
  webFetch,
  type WebFetchParams,
  type WebFetchResult,
  type HttpMethod,
  BrowserTool,
  browserTool,
  browser,
  type BrowserOperation,
  type BrowserParams,
  type BrowserResult,
  type BrowserNavigateParams,
  type BrowserClickParams,
  type BrowserTypeParams,
  type BrowserScreenshotParams,
  type BrowserEvaluateParams,
  type BrowserSubmitParams,
  type BrowserWaitForSelectorParams,
  type BrowserGetAttributeParams,
  type BrowserGetTextParams,
  type BrowserGetHtmlParams,
  type BrowserScrollParams,
  type BrowserHoverParams,
  type BrowserToolConfig,
} from './tools';

// Browser Console Stream
export {
  BrowserConsoleStream,
  createConsoleStream,
  ConsoleLogLevel,
  ConsoleFilters,
  type ConsoleStreamConfig,
  type BrowserConsoleMessage as EnhancedBrowserConsoleMessage,
  type BrowserRuntimeError as EnhancedBrowserRuntimeError,
  type NetworkError,
  type PerformanceWarning,
  type SecurityViolation,
  type ConsoleStreamEvents,
  type ConsoleMessageFilter,
} from './browser-console-stream';

// Scanner
export {
  SecretScanner,
  type SecretPattern,
  type SecretScannerConfig,
} from './scanner';
export {
  SecretOutputProcessor,
  type SecretProcessingResult,
} from './secret-output-processor';

// Policy
export {
  PolicyEnforcer,
  createPolicyEnforcer,
  type ViolationOptions,
  type PathValidationResult,
} from './policy';

// Policy Engine
export {
  PolicyEngine,
  createPolicyEngine,
  type AgentActionContext,
  type PolicyRule,
  type PolicyEvaluationResult,
  type RuleLoadingConfig,
} from './policy-engine';

// Error Suggestion Matching
export {
  SuggestionMatcher,
  type ErrorPattern,
  type ErrorPatternCategory,
  type SuggestionResult
} from './suggestion-matcher';

// Import Auto-Fixer
export {
  ImportAutoFixer,
  BaseDetector,
  ESLintDetector,
  BaseResolver,
  LocalResolver,
  AliasResolver as ImportAliasResolver,
  PackageResolver,
  type ImportAutoFixerOptions,
  type ImportAutoFixerConfig,
  type ImportAutoFixerEvents,
  type MissingImportAnalysis,
  type MissingImport,
  type ImportFixResult,
  type ImportFixSummary,
  type AddedImport,
  type ImportFixError,
  type IImportDetector,
  type IImportResolver,
  type ResolverContext,
  type ImportResolution,
  type ExistingImport,
  type ImportType,
  type DetectorType,
  type ImportStyle,
  type QuoteStyle,
} from './import-auto-fixer';

// Linter Plugin System
export * from './linter';

// Approval Gate Controller
export {
  ApprovalGateController,
  type ApprovalGateOptions,
  type ApprovalResult,
  type ApprovalGateEvents,
} from './approval-gate-controller';

// Error Feedback Loop
export {
  ErrorFeedbackLoop,
  type CompilerError,
  type ErrorReceivedEvent,
  type ErrorResolvedEvent,
  type ErrorsClearedEvent,
  type ErrorFeedbackLoopEvents,
} from './error-feedback';

// Fix Attempt Tracker
export {
  FixAttemptTracker,
  type FixAttemptTrackerOptions,
  type FixAttemptTrackerEvents,
} from './fix-attempt-tracker';

// TDD Mode
export {
  TDDMode,
  type TDDModeOptions,
  type TDDResult,
  type CorrectionResult,
  type RegressionResult,
  type CommandResult,
} from './tdd/tdd-mode';

// TDD Executor
export {
  TDDExecutor,
  createTDDExecutor,
  executeTDD,
  type TDDExecutorConfig,
  type TDDExecutionResult,
  type TDDIterationResult,
  type TestResult,
  type TestFailure,
  type SuggestedFix,
  type FixResult,
} from './tdd-executor';

// Test Report Generator
export {
  TestReportGenerator,
  type TestReportGeneratorOptions,
  type TestStartInfo,
  type TestCompleteInfo,
} from './test-report-generator';

// MCP (Model Context Protocol) Module
export {
  // JSON-RPC message types
  type JSONRPCError,
  type JSONRPCRequest,
  type JSONRPCSuccessResponse,
  type JSONRPCErrorResponse,
  type JSONRPCResponse,
  type JSONRPCNotification,
  type JSONRPCMessage,

  // Error codes
  JSONRPCErrorCodes,

  // Transport error types
  type MCPTransportErrorCode,
  MCPTransportError,

  // Transport events
  type MCPTransportEvents,

  // Type guards
  isJSONRPCRequest,
  isJSONRPCResponse,
  isJSONRPCNotification,
  isJSONRPCErrorResponse,
  isJSONRPCSuccessResponse,

  // Factory functions
  createJSONRPCRequest,
  createJSONRPCNotification,
  createJSONRPCSuccessResponse,
  createJSONRPCErrorResponse,

  // Base transport
  MCPTransport,
  type TransportState,
  type MCPTransportBaseOptions,

  // Stdio transport
  StdioTransport,
  type StdioTransportOptions,

  // MCP Client
  MCPClient,
  type MCPClientOptions,
  type MCPClientEvents,
  type MCPToolDefinition,
} from './mcp';

// Schema Translator
export {
  SchemaTranslator,
  type JSONSchemaProperty,
  type ClaudeSDKTool,
  type SchemaTranslatorOptions,
} from './schema-translator';

// Tool Alias Resolver
export { AliasResolver, AliasResolutionError } from './alias-resolver';

// MCP Installer
export { MCPInstaller, type MCPInstallationOptions, type InstalledMCPResult } from './mcp-installer';

// MCP Dependency Resolver
export {
  MCPDependencyResolver,
  type MCPDependency,
  type MCPServerWithDependencies,
  type DependencyResolutionResult,
  type DependencyResolutionError,
  type DependencyWarning,
} from './mcp-dependency-resolver';

// MCP Client Utility
export {
  MCPClientUtility,
  createMCPClientUtility,
  connectAndDiscoverMCPServer,
  type MCPClientUtilityOptions,
  type MCPServerConnection,
  type MCPConnectionResult,
  type MCPToolDiscoveryResult,
  type MCPClientUtilityEvents,
} from './mcp-client';

// Self-Repair Loop
export {
  RepairLoop,
  ErrorClassifier,
  resolveRepairConfig,
  DEFAULT_REPAIR_CONFIG,
  RepairConfigSchema,
} from './repair-loop/index.js';
export type {
  RepairLoopHost,
  RepairConfig,
  RepairContext,
  RepairResult,
  RepairDiagnosis,
  RepairFixPlan,
  ClassifiedError,
  RepairTerminationReason,
  EscalationReport,
  RepairLoopEvents,
} from './repair-loop/index.js';

// Parallel Test Execution Support Utilities
export {
  getTestWorkerId,
  isParallelTestExecution,
  getWorkerUniqueDbPath,
  getWorkerUniqueTempDir,
  createWorkerUniqueTempDir,
  createIsolatedEventEmitter,
  assertNoSharedMutation,
  createImmutableSnapshot,
  AsyncMutex,
  ResourceLockManager,
  globalResourceLocks,
  createParallelTestContext,
  createParallelSafeTaskStore,
  createEnvironmentIsolation,
} from './parallel-test-utils.js';
export type {
  EventMap,
  EventHistoryEntry,
  IsolatedEventEmitterContext,
  ReleaseLock,
  ResourceLock,
  ParallelTestContextOptions,
  ParallelTestContext,
  EnvironmentIsolationContext,
} from './parallel-test-utils.js';

// ============================================================================
// TaskStore Test Fixtures (v0.5.0)
// ============================================================================

export {
  createTestTask,
  createTestAgent,
  createTestWorkflow,
  createTestWorkflowStage,
  createTestTasks,
  createTestAgents,
  createTestWorkflows,
} from './fixtures.js';

// ============================================================================
// Tool Invocation Recording (v0.5.0)
// ============================================================================

export {
  ToolInvocationRecorder,
  globalRecorder,
  type ToolInvocationQueryOptions,
  type ToolInvocationRecord,
  type ToolInvocationStats,
} from './tool-invocation-recorder.js';

// ============================================================================
// Approval Flow Testing Utilities (v0.5.0)
// ============================================================================

export {
  createMockApprovalState,
  createMockApprovalGate,
  createApprovalScenario,
  ApprovalFlowTestEnvironment,
  createApprovalFlowTestEnvironment,
  createWorkflowWithApprovals,
  ApprovalTestAssertions,
  type ApprovalStateConfig,
  type ApprovalGateConfig,
  type ApprovalScenario,
  type ApprovalTestEvents,
} from './approval-test-utils.js';

// ============================================================================
// Codebase Analysis (v0.6.0)
// ============================================================================

export {
  createCodebaseAnalyzer,
  CodebaseAnalysisOrchestratorImpl,
} from './codebase-analyzer/index.js';

export type {
  CodebaseAnalysisOrchestrator,
  AnalysisOptions,
  AnalysisProgress,
  AnalysisError,
  AnalysisContext,
  FileInfo,
  DomainAnalysisResult,
  CodebaseAnalyzerBase,
  AnalysisOutputWriter,
  OutputFormat,
  AnalysisPhase,
} from './codebase-analyzer/types.js';

// Codebase analyzer - only export modules that exist
export {
  ConventionAnalyzer,
} from './codebase-analyzer/analyzers/convention-analyzer.js';

// =============================================================================
// Auth & Credentials
// =============================================================================

export {
  CredentialManager,
  type Credentials,
} from './auth/credential-manager.js';

// =============================================================================
// Codebase Intelligence
// =============================================================================

export * from './codebase-intelligence/index.js';

// =============================================================================
// CodebaseMapper Service
// =============================================================================

export {
  CodebaseMapper,
  createCodebaseMapper,
  type CodebaseMapperConfig,
  type AnalysisAgent,
  type CodebaseMapperProgress,
  type CodebaseMapperEvents,
} from './codebase-mapper.js';

// =============================================================================
// Memory Persistence System
// =============================================================================

export {
  MemoryManager,
  type RememberOptions,
  type RecallOptions,
} from './memory-manager.js';

export {
  MemoryStore,
  type Memory,
  type MemoryType,
  type MemorySearchCriteria,
  type LivingMemoryFile,
} from './memory-store.js';
