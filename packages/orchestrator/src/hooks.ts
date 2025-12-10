import { TaskStore } from './store';

export interface HookContext {
  taskId: string;
  store: TaskStore;
  onToolUse?: (tool: string, input: unknown) => void;
}

export interface HookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export interface HookResult {
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: 'allow' | 'deny';
    permissionDecisionReason?: string;
  };
}

type HookFunction = (
  input: HookInput,
  toolUseId: string | null,
  context: HookContext
) => Promise<HookResult>;

interface HookMatcher {
  matcher?: string;
  hooks: HookFunction[];
  timeout?: number;
}

interface HooksConfig {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
}

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
  'wget .* | sh',
  'curl .* | sh',
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
 * Create hooks for the orchestrator
 */
export function createHooks(context: HookContext): HooksConfig {
  return {
    PreToolUse: [
      // Audit all bash commands
      {
        matcher: 'Bash',
        hooks: [
          (input, toolUseId, ctx) => auditBashCommand(input, toolUseId, ctx),
          (input, toolUseId, ctx) => blockDangerousCommands(input, toolUseId, ctx),
        ],
        timeout: 5000,
      },
      // Audit file writes
      {
        matcher: 'Write',
        hooks: [(input, toolUseId, ctx) => auditFileWrite(input, toolUseId, ctx)],
        timeout: 5000,
      },
      {
        matcher: 'Edit',
        hooks: [(input, toolUseId, ctx) => auditFileWrite(input, toolUseId, ctx)],
        timeout: 5000,
      },
      {
        matcher: 'MultiEdit',
        hooks: [(input, toolUseId, ctx) => auditFileWrite(input, toolUseId, ctx)],
        timeout: 5000,
      },
      // Log all tool usage
      {
        hooks: [(input, toolUseId, ctx) => logToolUsage(input, toolUseId, ctx)],
        timeout: 1000,
      },
    ],
    PostToolUse: [
      // Log results
      {
        hooks: [(input, toolUseId, ctx) => logToolResult(input, toolUseId, ctx)],
        timeout: 1000,
      },
    ],
  };
}

/**
 * Audit bash command execution
 */
async function auditBashCommand(
  input: HookInput,
  _toolUseId: string | null,
  context: HookContext
): Promise<HookResult> {
  const command = (input.tool_input?.command as string) || '';

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
  _toolUseId: string | null,
  context: HookContext
): Promise<HookResult> {
  const command = (input.tool_input?.command as string) || '';
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
  _toolUseId: string | null,
  context: HookContext
): Promise<HookResult> {
  const filePath = (input.tool_input?.file_path as string) || 
                   (input.tool_input?.path as string) || '';

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
  context.onToolUse?.(input.tool_name, { filePath });

  return {};
}

/**
 * Log all tool usage
 */
async function logToolUsage(
  input: HookInput,
  _toolUseId: string | null,
  context: HookContext
): Promise<HookResult> {
  await context.store.addLog(context.taskId, {
    level: 'debug',
    message: `Tool: ${input.tool_name}`,
    metadata: {
      tool: input.tool_name,
      input: summarizeInput(input.tool_input),
    },
  });

  return {};
}

/**
 * Log tool results
 */
async function logToolResult(
  input: HookInput,
  _toolUseId: string | null,
  context: HookContext
): Promise<HookResult> {
  // PostToolUse hook - just log completion
  await context.store.addLog(context.taskId, {
    level: 'debug',
    message: `Completed: ${input.tool_name}`,
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
  const preToolUseHooks: HookMatcher[] = [];

  for (const hook of customHooks) {
    preToolUseHooks.push({
      matcher: hook.tool,
      hooks: [
        async (input: HookInput) => {
          const inputStr = JSON.stringify(input.tool_input);
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
