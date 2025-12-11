import type {
  HookCallback,
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
  HookEvent,
  PreToolUseHookInput,
  PostToolUseHookInput,
} from '@anthropic-ai/claude-agent-sdk';
import { TaskStore } from './store';

export type { HookInput };

export interface HookContext {
  taskId: string;
  store: TaskStore;
  onToolUse?: (tool: string, input: unknown) => void;
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
 * Create hooks for the orchestrator
 */
export function createHooks(context: HookContext): HooksConfig {
  return {
    PreToolUse: [
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
      // Log all tool usage
      {
        hooks: [createHookCallback(context, logToolUsage)],
        timeout: 1,
      },
    ],
    PostToolUse: [
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
