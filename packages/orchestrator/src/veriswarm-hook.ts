/**
 * VeriSwarm Integration Hook for APEX
 *
 * Integrates VeriSwarm trust scoring into APEX's tool execution lifecycle.
 * Pre-tool-use: optionally checks VeriSwarm decision API before allowing tool execution.
 * Post-tool-use: reports tool calls to VeriSwarm using the standardized event taxonomy.
 *
 * Configuration in apex.yaml:
 *   veriswarm:
 *     enabled: true
 *     apiUrl: "https://api.veriswarm.ai"
 *     apiKey: "vs_..."
 *     agentId: "agt_..."
 *     enforce: false          # If true, denied tools are blocked
 *     onDeny: "log"           # "block" | "log" | "skip"
 *     reportEvents: true      # Report tool calls to VeriSwarm
 *
 * Or via environment variables:
 *   VERISWARM_API_URL, VERISWARM_API_KEY, VERISWARM_AGENT_ID
 */

import type {
  HookCallback,
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
} from '@anthropic-ai/claude-agent-sdk';
import type { HookContext, HooksConfig } from './hooks';

// ── Configuration ─────────────────────────────────────────────

export interface VeriSwarmConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  agentId: string;
  enforce: boolean;
  onDeny: 'block' | 'log' | 'skip';
  reportEvents: boolean;
}

export function resolveVeriSwarmConfig(config?: Partial<VeriSwarmConfig>): VeriSwarmConfig {
  return {
    enabled: config?.enabled ?? (!!process.env.VERISWARM_API_KEY),
    apiUrl: config?.apiUrl ?? process.env.VERISWARM_API_URL ?? 'https://api.veriswarm.ai',
    apiKey: config?.apiKey ?? process.env.VERISWARM_API_KEY ?? '',
    agentId: config?.agentId ?? process.env.VERISWARM_AGENT_ID ?? '',
    enforce: config?.enforce ?? false,
    onDeny: config?.onDeny ?? 'log',
    reportEvents: config?.reportEvents ?? true,
  };
}

// ── HTTP Client (minimal, no dependencies) ────────────────────

async function veriswarmRequest(
  vsConfig: VeriSwarmConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  try {
    const url = `${vsConfig.apiUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': vsConfig.apiKey,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json() as Record<string, unknown>;
    }
    return null;
  } catch {
    // VeriSwarm integration should never break APEX — swallow errors
    return null;
  }
}

// ── Tool Name to Event Type Mapping ───────────────────────────

function mapToolToEventType(toolName: string, success: boolean): string {
  if (!success) return 'tool.call.failure';

  // Map APEX tool names to VeriSwarm taxonomy
  switch (toolName) {
    case 'Bash':
    case 'bash':
      return 'tool.call.success';
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return 'tool.call.success';
    case 'WebFetch':
      return 'tool.call.success';
    case 'Grep':
    case 'Glob':
    case 'LS':
      return 'tool.call.success';
    default:
      return 'tool.call.success';
  }
}

function getToolCategory(toolName: string): string {
  switch (toolName) {
    case 'Bash':
    case 'bash':
      return 'shell';
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return 'filesystem';
    case 'WebFetch':
      return 'network';
    case 'Grep':
    case 'Glob':
    case 'LS':
      return 'search';
    default:
      return 'other';
  }
}

// ── Pre-Tool-Use Hook: Decision Check ─────────────────────────

async function veriswarmPreToolCheck(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext,
  vsConfig: VeriSwarmConfig,
): Promise<HookJSONOutput> {
  if (!vsConfig.enforce || !vsConfig.agentId) {
    return { decision: 'approve' };
  }

  const toolName = (input as Record<string, unknown>).tool_name as string ?? 'unknown';

  const result = await veriswarmRequest(vsConfig, 'POST', '/api/veriswarm/v1/decisions/check', {
    agent_id: vsConfig.agentId,
    action_type: 'tool_call',
    resource_type: toolName,
  });

  if (!result) {
    // VeriSwarm unreachable — fail open (allow)
    return { decision: 'approve' };
  }

  const decision = result.decision as string;

  if (decision === 'deny') {
    const reason = result.reason_code as string ?? 'unknown';

    if (vsConfig.onDeny === 'block') {
      return {
        decision: 'block',
        reason: `VeriSwarm denied tool '${toolName}': ${reason}`,
      };
    }

    if (vsConfig.onDeny === 'log') {
      // Log but allow
      context.eventEmitter?.emit('veriswarm:denied', {
        toolName,
        toolUseId,
        reason,
        decision: 'allowed (onDeny=log)',
      });
    }

    // 'skip' or 'log' — allow execution
  }

  return { decision: 'approve' };
}

// ── Post-Tool-Use Hook: Event Reporting ───────────────────────

async function veriswarmPostToolReport(
  input: HookInput,
  toolUseId: string | undefined,
  context: HookContext,
  vsConfig: VeriSwarmConfig,
): Promise<HookJSONOutput> {
  if (!vsConfig.reportEvents || !vsConfig.agentId) {
    return {};
  }

  const inputRecord = input as Record<string, unknown>;
  const toolName = inputRecord.tool_name as string ?? 'unknown';
  const error = inputRecord.error as string | undefined;
  const success = !error;

  // Calculate duration if we have start times
  let durationMs: number | undefined;
  if (context.toolStartTimes && toolUseId) {
    const startTime = context.toolStartTimes.get(toolUseId);
    if (startTime) {
      durationMs = Date.now() - startTime.getTime();
    }
  }

  const eventType = mapToolToEventType(toolName, success);
  const eventId = `apex-${toolUseId ?? crypto.randomUUID().slice(0, 16)}`;

  const payload: Record<string, unknown> = {
    tool_name: toolName,
    tool_category: getToolCategory(toolName),
    apex_task_id: context.taskId,
  };

  if (durationMs !== undefined) {
    payload.duration_ms = durationMs;
  }

  if (context.currentAgent) {
    payload.apex_agent = context.currentAgent;
  }

  if (context.currentStage) {
    payload.apex_stage = context.currentStage;
  }

  if (error) {
    payload.error_type = 'tool_error';
    payload.error_summary = String(error).slice(0, 200);
  }

  // Fire and forget — don't block APEX on VeriSwarm reporting
  veriswarmRequest(vsConfig, 'POST', '/api/veriswarm/v1/events', {
    event_id: eventId,
    agent_id: vsConfig.agentId,
    source_type: 'agent',
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    payload,
  }).catch(() => {
    // Swallow — never break APEX
  });

  return {};
}

// ── Task Lifecycle Events ─────────────────────────────────────

export async function reportTaskStarted(vsConfig: VeriSwarmConfig, taskId: string, taskType: string): Promise<void> {
  if (!vsConfig.enabled || !vsConfig.reportEvents || !vsConfig.agentId) return;

  await veriswarmRequest(vsConfig, 'POST', '/api/veriswarm/v1/events', {
    event_id: `apex-task-start-${taskId}`,
    agent_id: vsConfig.agentId,
    source_type: 'agent',
    event_type: 'task.started',
    occurred_at: new Date().toISOString(),
    payload: { task_type: taskType, apex_task_id: taskId },
  }).catch(() => {});
}

export async function reportTaskCompleted(vsConfig: VeriSwarmConfig, taskId: string, taskType: string, durationMs?: number): Promise<void> {
  if (!vsConfig.enabled || !vsConfig.reportEvents || !vsConfig.agentId) return;

  await veriswarmRequest(vsConfig, 'POST', '/api/veriswarm/v1/events', {
    event_id: `apex-task-complete-${taskId}`,
    agent_id: vsConfig.agentId,
    source_type: 'agent',
    event_type: 'task.completed',
    occurred_at: new Date().toISOString(),
    payload: { task_type: taskType, apex_task_id: taskId, duration_ms: durationMs },
  }).catch(() => {});
}

export async function reportTaskFailed(vsConfig: VeriSwarmConfig, taskId: string, taskType: string, errorType: string): Promise<void> {
  if (!vsConfig.enabled || !vsConfig.reportEvents || !vsConfig.agentId) return;

  await veriswarmRequest(vsConfig, 'POST', '/api/veriswarm/v1/events', {
    event_id: `apex-task-fail-${taskId}`,
    agent_id: vsConfig.agentId,
    source_type: 'agent',
    event_type: 'task.failed',
    occurred_at: new Date().toISOString(),
    payload: { task_type: taskType, apex_task_id: taskId, error_type: errorType },
  }).catch(() => {});
}

// ── Hook Registration ─────────────────────────────────────────

/**
 * Creates VeriSwarm hooks that integrate into APEX's existing hook system.
 * Returns PreToolUse and PostToolUse hook matchers that can be merged
 * into the hooks config returned by createHooks().
 */
export function createVeriSwarmHooks(
  context: HookContext,
  vsConfig: VeriSwarmConfig,
): HooksConfig {
  if (!vsConfig.enabled || !vsConfig.apiKey) {
    return {};
  }

  const preHook: HookCallback = async (
    input: HookInput,
    toolUseId: string | undefined,
    _options: { signal: AbortSignal },
  ) => {
    return veriswarmPreToolCheck(input, toolUseId, context, vsConfig);
  };

  const postHook: HookCallback = async (
    input: HookInput,
    toolUseId: string | undefined,
    _options: { signal: AbortSignal },
  ) => {
    return veriswarmPostToolReport(input, toolUseId, context, vsConfig);
  };

  const hooks: HooksConfig = {};

  // Pre-tool-use: decision check (only if enforce mode is on)
  if (vsConfig.enforce) {
    hooks.PreToolUse = [
      {
        hooks: [preHook],
        timeout: 6, // Slightly longer than the 5s fetch timeout
      },
    ];
  }

  // Post-tool-use: event reporting (always, if reporting is enabled)
  if (vsConfig.reportEvents) {
    hooks.PostToolUse = [
      {
        hooks: [postHook],
        timeout: 2, // Fire-and-forget, don't block
      },
    ];
  }

  return hooks;
}

/**
 * Merge VeriSwarm hooks into an existing HooksConfig.
 * Appends VeriSwarm hooks after existing hooks in each event category.
 */
export function mergeHooks(base: HooksConfig, veriswarm: HooksConfig): HooksConfig {
  const merged = { ...base };

  for (const [event, matchers] of Object.entries(veriswarm)) {
    const key = event as keyof HooksConfig;
    if (merged[key]) {
      merged[key] = [...(merged[key] as HookCallbackMatcher[]), ...(matchers as HookCallbackMatcher[])];
    } else {
      merged[key] = matchers as HookCallbackMatcher[];
    }
  }

  return merged;
}
