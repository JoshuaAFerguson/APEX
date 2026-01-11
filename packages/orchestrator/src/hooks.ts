import type {
  HookCallback,
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
  HookEvent,
  PreToolUseHookInput,
  PostToolUseHookInput,
} from '@anthropic-ai/claude-agent-sdk';
import { TaskStore, ToolActionStore } from './store';
import { DangerousOperationDetector, type RiskSeverity } from './dangerous-operation-detector';
import { PermissionPresetManager } from './permission-preset-manager';
import { AliasResolver } from './alias-resolver';
import {
  createStructuredError,
  type ToolExecution,
  type FileSnapshot,
  type LinterConfig,
  type CodeQualityConfig,
  type ProjectConfig,
  type StructuredError,
} from '@apexcli/core';
import * as fs from 'fs';
import * as crypto from 'crypto';
import type { LinterService } from './linter';
import type { ErrorFeedbackLoop } from './error-feedback';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as yaml from 'js-yaml';

export type { HookInput };

const execAsync = promisify(exec);

export interface HookContext {
  taskId: string;
  store: TaskStore;
  projectPath?: string;
  errorFeedbackLoop?: ErrorFeedbackLoop;
  permissionPresetManager?: PermissionPresetManager;
  onToolUse?: (tool: string, input: unknown) => void;
  eventEmitter?: {
    emit: (event: string, data: unknown) => void;
  };
  fileSnapshots?: Map<string, string>;
  linterService?: LinterService;
  // New fields for tool action tracking
  toolActionStore?: ToolActionStore;
  currentAgent?: string;
  currentStage?: string;
  toolStartTimes?: Map<string, Date>; // toolUseId -> start time
  config?: {
    ui?: {
      diffPreview?: boolean;
    };
    linter?: LinterConfig;
    codeQuality?: CodeQualityConfig;
    project?: Partial<ProjectConfig>;
  };
  cliFlags?: {
    diffPreview?: boolean;
  };
  aliasResolver?: AliasResolver;
}

export type HooksConfig = Partial<Record<HookEvent, HookCallbackMatcher[]>>;

// Dangerous command patterns to block
const DANGEROUS_PATTERNS = [
  'rm -rf /',
  'rm -rf ~',
  'rm -rf /*',
  ':(){:|:&};:', // Fork bomb
  'mkfs.',
  'dd if=/dev/zero',
  'chmod -R 777 /',
  '> /dev/sda',
  'mv ~ /dev/null',
  '| sh',
  '| bash',
  'DROP DATABASE',
  'DROP TABLE',
  'TRUNCATE TABLE',
  '--no-preserve-root',
];

// Restricted URL patterns for WebFetch
const RESTRICTED_URL_PATTERNS = [
  /^file:\/\//i, // Local file system access
  /^ftp:\/\//i, // FTP protocols
  /localhost/i, // Localhost access
  /127\.0\.0\.1/, // Loopback IP
  /192\.168\./, // Private network ranges
  /10\./, // Private network ranges
  /172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private network ranges
  /169\.254\./, // Link-local addresses
  /\.local/i, // mDNS/Bonjour local domains
];

// Allowed schemes for WebFetch
const ALLOWED_SCHEMES = ['http:', 'https:'];

// Sensitive file patterns that require extra caution
const SENSITIVE_PATHS = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/hosts',
  '.env',
  '.env.local',
  '.env.production',
  'id_rsa',
  'id_ed25519',
  '.ssh/config',
  '.gitconfig',
  '.npmrc',
  '.pypirc',
];

// Tools that modify files and require snapshot capture
const FILE_MODIFYING_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
const FILE_MODIFYING_TOOLS_MATCHER = FILE_MODIFYING_TOOLS.join('|');

// Export for use in other modules
export { FILE_MODIFYING_TOOLS };

/**
 * Create a hook callback that wraps our internal function with context
 */
function createHookCallback(
  context: HookContext,
  fn: (input: HookInput, toolUseId: string | undefined, context: HookContext) => Promise<HookJSONOutput>
): HookCallback {
  return async (input: HookInput, toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
    return fn(input, toolUseId, context);
  };
}

/**
 * Create a singleton instance of DangerousOperationDetector
 */
const dangerousOperationDetector = new DangerousOperationDetector();

/**
 * Map risk severity to operation type for event emission
 */
function mapSeverityToOperationType(toolName: string, severity: RiskSeverity): 'file-deletion' | 'system-command' | 'network-request' | 'privilege-escalation' | 'data-modification' {
  switch (toolName) {
    case 'Bash':
      return severity === 'critical' || severity === 'high' ? 'system-command' : 'privilege-escalation';
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return severity === 'critical' || severity === 'high' ? 'file-deletion' : 'data-modification';
    case 'WebFetch':
      return 'network-request';
    default:
      return 'data-modification';
  }
}

/**
 * Detect and handle dangerous operations
 */
async function detectDangerousOperation(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const result = await dangerousOperationDetector.detectDangerousOperation(input);

  if (result.isDangerous && result.details) {
    const { details } = result;
    const operationType = mapSeverityToOperationType(details.tool, details.severity);

    // Log the detection
    await context.store.addLog(context.taskId, {
      level: details.severity === 'critical' || details.severity === 'high' ? 'error' : 'warn',
      message: `Dangerous operation detected: ${details.operation}`,
      metadata: {
        tool: details.tool,
        severity: details.severity,
        operation: details.operation,
        reason: details.reason,
        requiresConfirmation: details.requiresConfirmation,
        ...details.metadata,
      },
    });

    // Emit dangerous:detected event
    context.eventEmitter?.emit('dangerous:detected', {
      taskId: context.taskId,
      timestamp: new Date(),
      tool: details.tool,
      operationType,
      riskLevel: details.severity,
      description: details.reason,
      metadata: {
        operation: details.operation,
        ...details.metadata,
      },
    });

    // Block critical operations that require confirmation
    if (details.severity === 'critical' || details.requiresConfirmation) {
      // Emit dangerous:blocked event
      context.eventEmitter?.emit('dangerous:blocked', {
        taskId: context.taskId,
        timestamp: new Date(),
        tool: details.tool,
        operationType,
        blockReason: details.reason,
        blockedBy: 'DangerousOperationDetector',
      });

      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Blocked dangerous operation: ${details.reason}`,
        },
      };
    }
  }

  return {};
}

/**
 * Check tool permissions via permission preset manager
 */
async function checkToolPermissions(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  // Skip permission checks if no permission preset manager is available
  if (!context.permissionPresetManager) {
    return {};
  }

  const toolName = getToolName(input);
  const toolInput = getToolInput(input);

  // Determine scope based on tool type and input
  let scope: string | undefined;
  if ('file_path' in toolInput && typeof toolInput.file_path === 'string') {
    scope = toolInput.file_path;
  } else if ('path' in toolInput && typeof toolInput.path === 'string') {
    scope = toolInput.path;
  } else if ('url' in toolInput && typeof toolInput.url === 'string') {
    scope = toolInput.url;
  } else if ('command' in toolInput && typeof toolInput.command === 'string') {
    scope = toolInput.command;
  }

  try {
    // Check if tool is explicitly denied
    const isDenied = await context.permissionPresetManager.isToolDenied(toolName, scope);
    if (isDenied) {
      // Log the denial
      await context.store.addLog(context.taskId, {
        level: 'warn',
        message: `Tool usage denied by permission preset: ${toolName}`,
        metadata: {
          tool: toolName,
          scope,
          preset: context.permissionPresetManager.getCurrentPreset(),
          denied: true,
        },
      });

      // Emit permission:denied event
      context.eventEmitter?.emit('permission:denied', {
        taskId: context.taskId,
        toolName,
        scope,
        timestamp: new Date(),
        denialReason: `Tool ${toolName} is not allowed by current permission preset: ${context.permissionPresetManager.getCurrentPreset()}`,
        deniedBy: `permission-preset:${context.permissionPresetManager.getCurrentPreset()}`,
      });

      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Tool ${toolName} is not allowed by current permission preset`,
        },
      };
    }

    // Check if tool is allowed without confirmation
    const isAllowed = await context.permissionPresetManager.isToolAllowed(toolName, scope);
    if (isAllowed) {
      // Log the allowed usage
      await context.store.addLog(context.taskId, {
        level: 'debug',
        message: `Tool usage allowed by permission preset: ${toolName}`,
        metadata: {
          tool: toolName,
          scope,
          preset: context.permissionPresetManager.getCurrentPreset(),
          allowed: true,
        },
      });

      // Emit permission:granted event
      context.eventEmitter?.emit('permission:granted', {
        taskId: context.taskId,
        toolName,
        scope,
        timestamp: new Date(),
        level: 'allow-always',
        grantedBy: `permission-preset:${context.permissionPresetManager.getCurrentPreset()}`,
        grantReason: `Tool ${toolName} is automatically allowed by permission preset`,
      });

      return {};
    }

    // Check if confirmation is required
    const requiresConfirmation = await context.permissionPresetManager.isConfirmationRequired(toolName, scope);
    if (requiresConfirmation) {
      // Log the confirmation request
      await context.store.addLog(context.taskId, {
        level: 'info',
        message: `Tool usage requires confirmation: ${toolName}`,
        metadata: {
          tool: toolName,
          scope,
          preset: context.permissionPresetManager.getCurrentPreset(),
          requiresConfirmation: true,
        },
      });

      // Emit permission:request event
      context.eventEmitter?.emit('permission:request', {
        taskId: context.taskId,
        toolName,
        scope,
        timestamp: new Date(),
        reason: `Tool ${toolName} requires user confirmation under current permission preset: ${context.permissionPresetManager.getCurrentPreset()}`,
        agentName: 'orchestrator', // TODO: Could be passed from context if available
      });

      // For now, deny the request and wait for user action
      // In a full implementation, this would integrate with a user interaction system
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Tool ${toolName} requires user confirmation before execution`,
        },
      };
    }

    // Default fallback - should not reach here if preset manager is working correctly
    return {};

  } catch (error) {
    // Log error and allow the tool to proceed (fail open)
    await context.store.addLog(context.taskId, {
      level: 'error',
      message: `Error checking tool permissions: ${String(error)}`,
      metadata: {
        tool: toolName,
        scope,
        error: String(error),
      },
    });

    return {};
  }
}

/**
 * Resolve tool aliases to actual tool invocations
 */
async function resolveToolAlias(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  // Skip if no alias resolver is available
  if (!context.aliasResolver) {
    return {};
  }

  const toolName = getToolName(input);
  const toolInput = getToolInput(input);

  // Check if this tool name is actually an alias
  if (!context.aliasResolver.hasAlias(toolName)) {
    // Not an alias, pass through unchanged
    return {};
  }

  try {
    // Resolve the alias with the provided parameters
    const expandedAlias = context.aliasResolver.resolve(toolName, toolInput);

    // Return the resolved tool and parameters
    return {
      tool_name: expandedAlias.tool,
      tool_input: expandedAlias.parameters
    };
  } catch (error) {
    // If alias resolution fails, log the error and block the tool execution
    await context.store.addLog(context.taskId, {
      level: 'error',
      message: `Failed to resolve alias '${toolName}': ${String(error)}`,
      metadata: {
        aliasName: toolName,
        originalInput: toolInput,
        error: String(error),
      },
    });

    // Return an error to block the tool execution
    return {
      error: {
        type: 'AliasResolutionError',
        message: `Failed to resolve alias '${toolName}': ${String(error)}`,
      },
    };
  }
}

/**
 * Create hooks for the orchestrator
 */
export function createHooks(context: HookContext): HooksConfig {
  return {
    PreToolUse: [
      // Check tool permissions via preset manager (runs first to enforce permission policies)
      {
        hooks: [createHookCallback(context, checkToolPermissions)],
        timeout: 5,
      },
      // Resolve tool aliases (runs after permission checks, before other validations)
      {
        hooks: [createHookCallback(context, resolveToolAlias)],
        timeout: 5,
      },
      // Detect dangerous operations (runs after permission checks and alias resolution)
      {
        hooks: [createHookCallback(context, detectDangerousOperation)],
        timeout: 10,
      },
      // Capture file snapshots for file-modifying tools
      {
        matcher: FILE_MODIFYING_TOOLS_MATCHER,
        hooks: [createHookCallback(context, captureFileSnapshot)],
        timeout: 5,
      },
      // Validate JSON/YAML syntax before edits (v0.5.0)
      {
        matcher: FILE_MODIFYING_TOOLS_MATCHER,
        hooks: [createHookCallback(context, validatePreEditSyntax)],
        timeout: 5,
      },
      // Generate diff preview for file-modifying tools (v0.5.0)
      {
        matcher: FILE_MODIFYING_TOOLS_MATCHER,
        hooks: [createHookCallback(context, generateDiffPreview)],
        timeout: 5,
      },
      // Audit all bash commands
      {
        matcher: 'Bash',
        hooks: [
          createHookCallback(context, auditBashCommand),
          createHookCallback(context, blockDangerousCommands),
        ],
        timeout: 5,
      },
      // Audit file writes
      {
        matcher: 'Write',
        hooks: [createHookCallback(context, auditFileWrite)],
        timeout: 5,
      },
      {
        matcher: 'Edit',
        hooks: [createHookCallback(context, auditFileWrite)],
        timeout: 5,
      },
      {
        matcher: 'MultiEdit',
        hooks: [createHookCallback(context, auditFileWrite)],
        timeout: 5,
      },
      // Audit WebFetch requests
      {
        matcher: 'WebFetch',
        hooks: [
          createHookCallback(context, auditWebFetchRequest),
          createHookCallback(context, validateNetworkPermissions),
        ],
        timeout: 5,
      },
      // Record tool start time for duration tracking
      {
        hooks: [createHookCallback(context, recordToolStartTime)],
        timeout: 1,
      },
      // Log all tool usage
      {
        hooks: [createHookCallback(context, logToolUsage)],
        timeout: 1,
      },
    ],
    PostToolUse: [
      // Record file-modifying tool actions with snapshots
      {
        matcher: FILE_MODIFYING_TOOLS_MATCHER,
        hooks: [createHookCallback(context, recordFileModifyingToolAction)],
        timeout: 10,
      },
      // Run linting after file edits (v0.5.0)
      {
        matcher: FILE_MODIFYING_TOOLS_MATCHER,
        hooks: [createHookCallback(context, lintAfterEdit)],
        timeout: 30,
      },
      // Run typecheck after file edits (v0.5.0)
      {
        matcher: FILE_MODIFYING_TOOLS_MATCHER,
        hooks: [createHookCallback(context, runTypecheckAfterEdit)],
        timeout: 60,
      },
      // Log results
      {
        hooks: [createHookCallback(context, logToolResult)],
        timeout: 1,
      },
    ],
  };
}

/**
 * Get tool input safely handling different input types
 */
function getToolInput(input: HookInput): Record<string, unknown> {
  if ('tool_input' in input && input.tool_input != null) {
    if (typeof input.tool_input === 'object') {
      return input.tool_input as Record<string, unknown>;
    }
  }
  return {};
}

/**
 * Get tool name from hook input
 */
function getToolName(input: HookInput): string {
  if ('tool_name' in input) {
    return input.tool_name;
  }
  return 'unknown';
}

function extractToolFilePaths(toolInput: Record<string, unknown>): string[] {
  const paths = new Set<string>();

  if (typeof toolInput.file_path === 'string') {
    paths.add(toolInput.file_path);
  }

  if (typeof toolInput.notebook_path === 'string') {
    paths.add(toolInput.notebook_path);
  }

  if (typeof toolInput.path === 'string') {
    paths.add(toolInput.path);
  }

  if (Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) {
      if (edit && typeof edit === 'object') {
        const editRecord = edit as Record<string, unknown>;
        if (typeof editRecord.file_path === 'string') {
          paths.add(editRecord.file_path);
        }
        if (typeof editRecord.path === 'string') {
          paths.add(editRecord.path);
        }
      }
    }
  }

  return Array.from(paths);
}

/**
 * Capture file snapshots for file-modifying tools
 */
async function captureFileSnapshot(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);

  // Only capture snapshots for file-modifying tools
  if (!FILE_MODIFYING_TOOLS.includes(toolName)) {
    return {};
  }

  const toolInput = getToolInput(input);
  const [filePath] = extractToolFilePaths(toolInput);

  if (!filePath) {
    return {};
  }

  // Initialize fileSnapshots map if not exists
  if (!context.fileSnapshots) {
    context.fileSnapshots = new Map();
  }

  try {
    // Read and store file content snapshot
    const content = fs.readFileSync(filePath, 'utf8');
    context.fileSnapshots.set(filePath, content);

    // Log the snapshot capture
    await context.store.addLog(context.taskId, {
      level: 'debug',
      message: `File snapshot captured: ${filePath}`,
      metadata: {
        tool: toolName,
        filePath,
        contentLength: content.length,
      },
    });
  } catch (error) {
    // Handle non-existent files gracefully
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Store empty string for non-existent files
      context.fileSnapshots.set(filePath, '');

      await context.store.addLog(context.taskId, {
        level: 'debug',
        message: `File snapshot captured (new file): ${filePath}`,
        metadata: {
          tool: toolName,
          filePath,
          isNewFile: true,
        },
      });
    } else {
      // Log other filesystem errors
      await context.store.addLog(context.taskId, {
        level: 'warn',
        message: `Failed to capture file snapshot: ${filePath} - ${String(error)}`,
        metadata: {
          tool: toolName,
          filePath,
          error: String(error),
        },
      });
    }
  }

  return {};
}

function getExistingContent(filePath: string, context: HookContext): string {
  if (context.fileSnapshots?.has(filePath)) {
    return context.fileSnapshots.get(filePath) ?? '';
  }

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function applyEditToContent(content: string, oldString: string, newString: string, replaceAll?: boolean): string {
  if (replaceAll) {
    return content.replaceAll(oldString, newString);
  }

  return content.replace(oldString, newString);
}

function collectNewContentByFile(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: HookContext
): Map<string, string> {
  const updates = new Map<string, string>();

  if (toolName === 'Write' && typeof toolInput.file_path === 'string' && typeof toolInput.content === 'string') {
    updates.set(toolInput.file_path, toolInput.content);
    return updates;
  }

  if (toolName === 'Edit' && typeof toolInput.file_path === 'string' && typeof toolInput.old_string === 'string' && typeof toolInput.new_string === 'string') {
    const current = getExistingContent(toolInput.file_path, context);
    const next = applyEditToContent(
      current,
      toolInput.old_string,
      toolInput.new_string,
      Boolean(toolInput.replace_all)
    );
    updates.set(toolInput.file_path, next);
    return updates;
  }

  if (toolName === 'MultiEdit' && Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) {
      if (!edit || typeof edit !== 'object') {
        continue;
      }

      const editRecord = edit as Record<string, unknown>;
      const filePath = typeof editRecord.file_path === 'string' ? editRecord.file_path : (
        typeof editRecord.path === 'string' ? editRecord.path : undefined
      );

      if (!filePath || typeof editRecord.old_string !== 'string' || typeof editRecord.new_string !== 'string') {
        continue;
      }

      const current = updates.has(filePath)
        ? (updates.get(filePath) ?? '')
        : getExistingContent(filePath, context);

      const next = applyEditToContent(
        current,
        editRecord.old_string,
        editRecord.new_string,
        Boolean(editRecord.replace_all)
      );

      updates.set(filePath, next);
    }
  }

  return updates;
}

function validateJsonOrYaml(filePath: string, content: string): string | null {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.json') {
    if (content.trim().length === 0) {
      return 'JSON content is empty';
    }

    JSON.parse(content);
    return null;
  }

  if (extension === '.yaml' || extension === '.yml') {
    if (content.trim().length === 0) {
      return null;
    }

    yaml.load(content);
    return null;
  }

  return null;
}

async function validatePreEditSyntax(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);
  if (!FILE_MODIFYING_TOOLS.includes(toolName)) {
    return {};
  }

  const preEditConfig = context.config?.codeQuality?.preEditValidation;
  if (!preEditConfig?.enabled) {
    return {};
  }

  const toolInput = getToolInput(input);
  const updatedContent = collectNewContentByFile(toolName, toolInput, context);

  if (updatedContent.size === 0) {
    return {};
  }

  for (const [filePath, content] of updatedContent.entries()) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension !== '.json' && extension !== '.yaml' && extension !== '.yml') {
      continue;
    }

    try {
      const validationError = validateJsonOrYaml(filePath, content);
      if (!validationError) {
        continue;
      }

      const mode = preEditConfig.mode || 'warn';
      await context.store.addLog(context.taskId, {
        level: mode === 'block' ? 'error' : 'warn',
        message: `Pre-edit validation failed for ${filePath}: ${validationError}`,
        metadata: {
          tool: toolName,
          filePath,
          mode,
          reason: validationError,
        },
      });

      if (mode === 'block') {
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `Blocked: invalid ${extension.replace('.', '').toUpperCase()} content in ${filePath}`,
          },
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const mode = preEditConfig.mode || 'warn';
      await context.store.addLog(context.taskId, {
        level: mode === 'block' ? 'error' : 'warn',
        message: `Pre-edit validation failed for ${filePath}: ${message}`,
        metadata: {
          tool: toolName,
          filePath,
          mode,
          error: message,
        },
      });

      if (mode === 'block') {
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `Blocked: invalid ${extension.replace('.', '').toUpperCase()} content in ${filePath}`,
          },
        };
      }
    }
  }

  return {};
}

async function lintAfterEdit(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);
  if (!FILE_MODIFYING_TOOLS.includes(toolName)) {
    return {};
  }

  const linterConfig = context.config?.linter;
  if (!context.linterService || !linterConfig?.global?.enabled || !linterConfig.global.runAfterEdit) {
    return {};
  }

  const toolInput = getToolInput(input);
  const filePaths = extractToolFilePaths(toolInput);
  if (filePaths.length === 0) {
    return {};
  }

  const autoFixEnabled = Boolean(
    linterConfig.integrations?.ide?.autoFixOnSave ||
    linterConfig.eslint?.autoFix ||
    linterConfig.prettier?.autoFix ||
    (linterConfig.custom || []).some((linter) => linter.autoFix)
  );

  try {
    await context.linterService.execute({
      files: filePaths,
      mode: linterConfig.global.parallel ? 'parallel' : 'sequential',
      fix: autoFixEnabled,
      stopOnError: linterConfig.global.failFast,
      timeout: linterConfig.global.timeoutMs,
    });
  } catch (error) {
    await context.store.addLog(context.taskId, {
      level: 'warn',
      message: 'Lint after edit failed',
      metadata: {
        tool: toolName,
        filePaths,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return {};
}

function parseTypecheckErrors(output: string, context: HookContext, command: string): StructuredError[] {
  const errors: StructuredError[] = [];
  const lines = output.split('\n');
  const errorRegex = /^(.*)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s+(.*)$/i;

  for (const line of lines) {
    const match = line.match(errorRegex);
    if (!match) {
      continue;
    }

    const [, file, lineNumber, columnNumber, severityLabel, code, message] = match;
    const severity = severityLabel.toLowerCase() === 'warning' ? 'warning' : 'error';

    errors.push(createStructuredError(message.trim(), {
      severity,
      category: 'type',
      code: `TS${code}`,
      rawText: line,
      location: {
        file: file.trim(),
        line: Number(lineNumber),
        column: Number(columnNumber),
      },
      context: {
        tool: 'typecheck',
        taskId: context.taskId,
        stage: context.currentStage,
        agent: context.currentAgent,
        command,
        workingDir: context.projectPath,
        timestamp: new Date(),
      },
    }));
  }

  return errors;
}

async function runTypecheckAfterEdit(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);
  if (!FILE_MODIFYING_TOOLS.includes(toolName)) {
    return {};
  }

  const typecheckConfig = context.config?.codeQuality?.typecheck;
  if (!typecheckConfig?.enabled || !typecheckConfig.runAfterEdit) {
    return {};
  }

  if (!context.projectPath) {
    await context.store.addLog(context.taskId, {
      level: 'warn',
      message: 'Typecheck skipped: projectPath not available',
      metadata: {
        tool: toolName,
      },
    });
    return {};
  }

  const command = typecheckConfig.command || context.config?.project?.typecheckCommand || 'npm run typecheck';
  const timeoutMs = typecheckConfig.timeoutMs ?? 60000;

  try {
    await execAsync(command, { cwd: context.projectPath, timeout: timeoutMs });

    const clearedCount = context.errorFeedbackLoop?.clearErrors(context.taskId);
    await context.store.addLog(context.taskId, {
      level: 'info',
      message: 'Typecheck completed successfully',
      metadata: {
        tool: toolName,
        command,
        clearedErrors: clearedCount ?? 0,
      },
    });
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string; code?: number | string };
    const output = [execError.stdout, execError.stderr, execError.message].filter(Boolean).join('\n');
    const parsedErrors = output ? parseTypecheckErrors(output, context, command) : [];
    const errorsToReport = parsedErrors.length > 0 ? parsedErrors : [
      createStructuredError('Typecheck failed', {
        category: 'type',
        severity: 'error',
        rawText: output || execError.message,
        context: {
          tool: 'typecheck',
          taskId: context.taskId,
          stage: context.currentStage,
          agent: context.currentAgent,
          command,
          workingDir: context.projectPath,
          timestamp: new Date(),
        },
      }),
    ];

    context.errorFeedbackLoop?.receiveErrors(errorsToReport, context.taskId);

    await context.store.addLog(context.taskId, {
      level: 'warn',
      message: 'Typecheck failed after edit',
      metadata: {
        tool: toolName,
        command,
        errorCount: errorsToReport.length,
        exitCode: execError.code,
      },
    });
  }

  return {};
}

/**
 * Generate and emit diff preview for file edits when enabled
 * This hook runs after snapshot capture to show what changes will be made
 */
async function generateDiffPreview(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);

  // Only generate diff preview for file-modifying tools
  if (!FILE_MODIFYING_TOOLS.includes(toolName)) {
    return {};
  }

  // Skip if no event emitter available
  if (!context.eventEmitter) {
    return {};
  }

  // Check CLI flag override first, then fallback to config (default is enabled)
  let shouldGeneratePreview = true;
  if (context.cliFlags?.diffPreview !== undefined) {
    // CLI flag overrides config
    shouldGeneratePreview = context.cliFlags.diffPreview;
  } else {
    // Use config setting (default enabled if not specified)
    shouldGeneratePreview = context.config?.ui?.diffPreview !== false;
  }

  if (!shouldGeneratePreview) {
    return {};
  }

  const toolInput = getToolInput(input);
  let filePath: string | undefined;
  let newContent: string | undefined;

  // Extract file path and new content based on tool type
  if (toolName === 'Write' && 'file_path' in toolInput && 'content' in toolInput) {
    filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : undefined;
    newContent = typeof toolInput.content === 'string' ? toolInput.content : undefined;
  } else if (toolName === 'Edit' && 'file_path' in toolInput && 'new_string' in toolInput && 'old_string' in toolInput) {
    filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : undefined;

    // For Edit tool, we need to apply the edit to get the new content
    if (filePath) {
      try {
        const currentContent = context.fileSnapshots?.get(filePath) || '';
        const oldString = typeof toolInput.old_string === 'string' ? toolInput.old_string : '';
        const newString = typeof toolInput.new_string === 'string' ? toolInput.new_string : '';

        if ('replace_all' in toolInput && toolInput.replace_all) {
          newContent = currentContent.replaceAll(oldString, newString);
        } else {
          newContent = currentContent.replace(oldString, newString);
        }
      } catch (error) {
        // If we can't generate the new content, skip diff preview
        return {};
      }
    }
  } else if (toolName === 'MultiEdit' && 'edits' in toolInput && Array.isArray(toolInput.edits)) {
    // For MultiEdit, process each edit separately and emit events for each file
    const edits = toolInput.edits as Array<{
      file_path: string;
      old_string: string;
      new_string: string;
      replace_all?: boolean;
    }>;

    for (const edit of edits) {
      if (typeof edit.file_path !== 'string' || typeof edit.old_string !== 'string' || typeof edit.new_string !== 'string') {
        continue; // Skip invalid edits
      }

      try {
        const editFilePath = edit.file_path;
        const currentContent = context.fileSnapshots?.get(editFilePath) || '';
        const oldString = edit.old_string;
        const newString = edit.new_string;

        let editNewContent: string;
        if (edit.replace_all) {
          editNewContent = currentContent.replaceAll(oldString, newString);
        } else {
          editNewContent = currentContent.replace(oldString, newString);
        }

        // Import the diff utility
        const { generateFileDiff } = await import('./utils/diff.js');

        // Generate the diff for this file
        const diffResult = generateFileDiff(editFilePath, editNewContent);

        // Only emit if there are differences
        if (diffResult.hasDifferences) {
          context.eventEmitter.emit('diff:preview', {
            taskId: context.taskId,
            toolName,
            callId: toolUseId || `multiedit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            filePath: editFilePath,
            diff: diffResult.diff,
            addedLines: diffResult.addedLines,
            removedLines: diffResult.removedLines,
            timestamp: new Date(),
          });

          // Log the diff preview generation
          await context.store.addLog(context.taskId, {
            level: 'debug',
            message: `Diff preview generated for: ${editFilePath}`,
            metadata: {
              tool: toolName,
              filePath: editFilePath,
              addedLines: diffResult.addedLines,
              removedLines: diffResult.removedLines,
              callId: toolUseId,
            },
          });
        }
      } catch (error) {
        // Log diff generation errors but don't fail the tool execution
        await context.store.addLog(context.taskId, {
          level: 'warn',
          message: `Failed to generate diff preview for MultiEdit: ${edit.file_path} - ${String(error)}`,
          metadata: {
            tool: toolName,
            filePath: edit.file_path,
            error: String(error),
            callId: toolUseId,
          },
        });
      }
    }

    // Return early since we've handled all the edits
    return {};
  } else if (toolName === 'NotebookEdit' && 'notebook_path' in toolInput && 'new_source' in toolInput) {
    filePath = typeof toolInput.notebook_path === 'string' ? toolInput.notebook_path : undefined;
    // For notebook edits, we'd need more complex logic to handle cell modifications
    // For now, skip diff preview for notebook edits
    return {};
  }

  if (!filePath || !newContent || !toolUseId) {
    return {};
  }

  try {
    // Import the diff utility (dynamic import to avoid circular dependencies)
    const { generateFileDiff } = await import('./utils/diff.js');

    // Generate the diff
    const diffResult = generateFileDiff(filePath, newContent);

    // Only emit if there are differences
    if (diffResult.hasDifferences) {
      context.eventEmitter.emit('diff:preview', {
        taskId: context.taskId,
        toolName,
        callId: toolUseId,
        filePath,
        diff: diffResult.diff,
        addedLines: diffResult.addedLines,
        removedLines: diffResult.removedLines,
        timestamp: new Date(),
      });

      // Log the diff preview generation
      await context.store.addLog(context.taskId, {
        level: 'debug',
        message: `Diff preview generated for: ${filePath}`,
        metadata: {
          tool: toolName,
          filePath,
          addedLines: diffResult.addedLines,
          removedLines: diffResult.removedLines,
          callId: toolUseId,
        },
      });
    }
  } catch (error) {
    // Log diff generation errors but don't fail the tool execution
    await context.store.addLog(context.taskId, {
      level: 'warn',
      message: `Failed to generate diff preview: ${filePath} - ${String(error)}`,
      metadata: {
        tool: toolName,
        filePath,
        error: String(error),
        callId: toolUseId,
      },
    });
  }

  return {};
}

/**
 * Audit bash command execution
 */
async function auditBashCommand(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolInput = getToolInput(input);
  const command = (toolInput.command as string) || '';

  // Log the command
  await context.store.logCommand(context.taskId, command);

  // Notify callback if provided
  context.onToolUse?.('Bash', { command });

  return {};
}

/**
 * Block dangerous commands
 */
async function blockDangerousCommands(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolInput = getToolInput(input);
  const command = (toolInput.command as string) || '';
  const lowerCommand = command.toLowerCase();

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (lowerCommand.includes(pattern.toLowerCase())) {
      await context.store.addLog(context.taskId, {
        level: 'warn',
        message: `Blocked dangerous command: ${command.substring(0, 100)}`,
        metadata: { pattern, blocked: true },
      });

      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Blocked: Command matches dangerous pattern "${pattern}"`,
        },
      };
    }
  }

  // Warn about potentially risky commands
  const riskyPatterns = ['sudo ', 'chmod ', 'chown ', 'rm -r', 'git push -f', 'git reset --hard'];
  for (const pattern of riskyPatterns) {
    if (command.includes(pattern)) {
      await context.store.addLog(context.taskId, {
        level: 'info',
        message: `Executing risky command: ${command.substring(0, 100)}`,
        metadata: { pattern, warning: true },
      });
    }
  }

  return {};
}

/**
 * Audit file write operations
 */
async function auditFileWrite(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolInput = getToolInput(input);
  const filePath = (toolInput.file_path as string) ||
                   (toolInput.path as string) || '';
  const toolName = getToolName(input);

  // Check for sensitive files
  for (const sensitive of SENSITIVE_PATHS) {
    if (filePath.includes(sensitive)) {
      await context.store.addLog(context.taskId, {
        level: 'warn',
        message: `Writing to sensitive file: ${filePath}`,
        metadata: { filePath, sensitive: true },
      });

      // For .env files, allow but log prominently
      if (filePath.includes('.env')) {
        await context.store.addLog(context.taskId, {
          level: 'warn',
          message: 'Writing to environment file - ensure no secrets are committed',
        });
      }
    }
  }

  // Notify callback
  context.onToolUse?.(toolName, { filePath });

  return {};
}

/**
 * Audit WebFetch requests
 */
async function auditWebFetchRequest(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolInput = getToolInput(input);
  const url = (toolInput.url as string) || '';
  const method = (toolInput.method as string) || 'GET';
  const toolName = getToolName(input);

  // Log the WebFetch request
  await context.store.addLog(context.taskId, {
    level: 'info',
    message: `WebFetch request: ${method} ${url}`,
    metadata: {
      tool: toolName,
      url,
      method,
      hasPrompt: !!toolInput.prompt,
    },
  });

  // Notify callback if provided
  context.onToolUse?.(toolName, { url, method });

  return {};
}

/**
 * Validate network permissions for WebFetch
 */
async function validateNetworkPermissions(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolInput = getToolInput(input);
  const url = (toolInput.url as string) || '';

  try {
    const parsedUrl = new URL(url);

    // Check if scheme is allowed
    if (!ALLOWED_SCHEMES.includes(parsedUrl.protocol)) {
      await context.store.addLog(context.taskId, {
        level: 'error',
        message: `Blocked WebFetch: Invalid protocol "${parsedUrl.protocol}"`,
        metadata: { url, blocked: true, reason: 'invalid_protocol' },
      });

      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Blocked: Only HTTP and HTTPS protocols are allowed. Found: ${parsedUrl.protocol}`,
        },
      };
    }

    // Check against restricted patterns
    for (const pattern of RESTRICTED_URL_PATTERNS) {
      if (pattern.test(url)) {
        await context.store.addLog(context.taskId, {
          level: 'warn',
          message: `Blocked WebFetch: Restricted URL pattern`,
          metadata: { url, pattern: pattern.source, blocked: true },
        });

        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `Blocked: URL matches restricted pattern for security reasons`,
          },
        };
      }
    }

    // Warn about potentially sensitive requests
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api.?key/i,
      /credential/i,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(url)) {
        await context.store.addLog(context.taskId, {
          level: 'warn',
          message: `WebFetch to potentially sensitive endpoint: ${url}`,
          metadata: { url, pattern: pattern.source, warning: true },
        });
      }
    }

  } catch (urlError) {
    // Invalid URL format
    await context.store.addLog(context.taskId, {
      level: 'error',
      message: `Blocked WebFetch: Invalid URL format`,
      metadata: { url, blocked: true, error: String(urlError) },
    });

    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Blocked: Invalid URL format`,
      },
    };
  }

  return {};
}

/**
 * Log all tool usage
 */
async function logToolUsage(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolInput = getToolInput(input);
  const toolName = getToolName(input);

  await context.store.addLog(context.taskId, {
    level: 'debug',
    message: `Tool: ${toolName}`,
    metadata: {
      tool: toolName,
      input: summarizeInput(toolInput),
    },
  });

  return {};
}

/**
 * Log tool results
 */
async function logToolResult(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);

  // PostToolUse hook - just log completion
  await context.store.addLog(context.taskId, {
    level: 'debug',
    message: `Completed: ${toolName}`,
  });

  return {};
}

/**
 * Summarize tool input for logging (avoid logging sensitive data)
 */
function summarizeInput(input: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      // Truncate long strings
      if (value.length > 200) {
        summary[key] = value.substring(0, 200) + '...';
      } else {
        summary[key] = value;
      }
    } else {
      summary[key] = value;
    }
  }

  return summary;
}

/**
 * Record tool start time for duration calculation
 */
async function recordToolStartTime(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  if (!context.toolStartTimes) {
    context.toolStartTimes = new Map();
  }

  if (toolUseId) {
    context.toolStartTimes.set(toolUseId, new Date());
  }

  return {};
}

/**
 * Create a FileSnapshot object with checksum
 */
function createFileSnapshot(
  filePath: string,
  content: string,
  timestamp: Date,
  metadata: Record<string, unknown> = {}
): FileSnapshot {
  const checksum = crypto.createHash('md5').update(content, 'utf8').digest('hex');

  return {
    id: crypto.randomUUID(),
    filePath,
    content,
    checksum,
    fileSize: Buffer.byteLength(content, 'utf8'),
    lastModified: timestamp,
    snapshotTime: timestamp,
    existed: metadata.isNewFile !== true,
    metadata,
  };
}

/**
 * Extract file path from tool input based on tool type
 */
function extractFilePath(toolInput: Record<string, unknown>, toolName: string): string | undefined {
  if ('file_path' in toolInput && typeof toolInput.file_path === 'string') {
    return toolInput.file_path;
  } else if ('notebook_path' in toolInput && typeof toolInput.notebook_path === 'string') {
    return toolInput.notebook_path;
  } else if ('path' in toolInput && typeof toolInput.path === 'string') {
    return toolInput.path;
  }
  return undefined;
}

/**
 * Record completed file-modifying tool action with snapshots
 */
async function recordFileModifyingToolAction(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolName = getToolName(input);

  // Only process file-modifying tools
  if (!FILE_MODIFYING_TOOLS.includes(toolName)) {
    return {};
  }

  // Skip if no toolActionStore available
  if (!context.toolActionStore) {
    return {};
  }

  const toolInput = getToolInput(input);
  const filePath = extractFilePath(toolInput, toolName);

  if (!filePath) {
    return {};
  }

  try {
    // Get before-snapshot content from context
    const beforeContent = context.fileSnapshots?.get(filePath);

    // Capture after-snapshot
    let afterContent: string | null = null;
    let afterExists = true;
    try {
      afterContent = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // File was deleted
        afterContent = '';
        afterExists = false;
      } else {
        throw err;
      }
    }

    // Create FileSnapshot objects
    const now = new Date();
    const beforeSnapshot = createFileSnapshot(filePath, beforeContent ?? '', now, {
      isNewFile: beforeContent === '',
      capturedAt: 'before',
    });

    const afterSnapshot = createFileSnapshot(filePath, afterContent ?? '', now, {
      exists: afterExists,
      capturedAt: 'after',
    });

    // Build ToolExecution
    const startTime = context.toolStartTimes?.get(toolUseId ?? '') ?? now;
    const endTime = now;

    const execution: ToolExecution = {
      callId: toolUseId ?? crypto.randomUUID(),
      toolName,
      input: toolInput,
      taskId: context.taskId,
      agentName: context.currentAgent,
      stageName: context.currentStage,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      status: 'completed',
    };

    // Record the action
    await context.toolActionStore.recordToolAction(
      context.taskId,
      execution,
      [filePath],
      [beforeSnapshot],
      [afterSnapshot]
    );

    // Clean up context
    context.fileSnapshots?.delete(filePath);
    context.toolStartTimes?.delete(toolUseId ?? '');

    // Log success
    await context.store.addLog(context.taskId, {
      level: 'debug',
      message: `Tool action recorded: ${toolName} on ${filePath}`,
      metadata: {
        tool: toolName,
        filePath,
        actionId: execution.callId,
      },
    });
  } catch (error) {
    // Log error but don't fail the hook
    await context.store.addLog(context.taskId, {
      level: 'warn',
      message: `Failed to record tool action: ${toolName} on ${filePath} - ${String(error)}`,
      metadata: {
        tool: toolName,
        filePath,
        error: String(error),
      },
    });
  }

  return {};
}

/**
 * Create custom hooks from configuration
 */
export function createCustomHooks(
  customHooks: Array<{
    tool: string;
    action: 'allow' | 'deny' | 'warn';
    pattern?: string;
    message?: string;
  }>,
  context: HookContext
): HooksConfig {
  const preToolUseHooks: HookCallbackMatcher[] = [];

  for (const hook of customHooks) {
    preToolUseHooks.push({
      matcher: hook.tool,
      hooks: [
        async (input: HookInput, _toolUseId: string | undefined, _options: { signal: AbortSignal }): Promise<HookJSONOutput> => {
          const toolInput = getToolInput(input);
          const inputStr = JSON.stringify(toolInput);
          const matches = hook.pattern ? new RegExp(hook.pattern).test(inputStr) : true;

          if (matches) {
            if (hook.action === 'deny') {
              return {
                hookSpecificOutput: {
                  hookEventName: 'PreToolUse',
                  permissionDecision: 'deny',
                  permissionDecisionReason: hook.message || `Custom hook blocked ${hook.tool}`,
                },
              };
            } else if (hook.action === 'warn') {
              await context.store.addLog(context.taskId, {
                level: 'warn',
                message: hook.message || `Custom hook warning for ${hook.tool}`,
              });
            }
          }

          return {};
        },
      ],
    });
  }

  return {
    PreToolUse: preToolUseHooks,
  };
}
