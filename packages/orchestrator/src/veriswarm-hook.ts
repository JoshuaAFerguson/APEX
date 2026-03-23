/**
 * VeriSwarm Integration Hook for APEX
 *
 * Integrates VeriSwarm trust scoring into APEX's tool execution lifecycle.
 *
 * Workflow:
 *   1. User sets VERISWARM_API_KEY (or configures in apex.yaml)
 *   2. On first run, APEX auto-registers as an agent on VeriSwarm
 *   3. Credentials stored locally in .apex/veriswarm.json
 *   4. User gets a claim URL to connect the agent to their VeriSwarm account
 *   5. All tool calls are automatically reported to VeriSwarm
 *   6. Optionally, VeriSwarm can enforce allow/deny on tool calls
 *
 * Configuration in apex.yaml:
 *   veriswarm:
 *     enabled: true
 *     apiUrl: "https://api.veriswarm.ai"
 *     apiKey: "vs_..."
 *     enforce: false          # If true, denied tools are blocked
 *     onDeny: "log"           # "block" | "log" | "skip"
 *     reportEvents: true      # Report tool calls to VeriSwarm
 *     ownerEmail: ""          # Optional: your email for ownership claim notification
 *
 * Or via environment variables:
 *   VERISWARM_API_KEY, VERISWARM_API_URL, VERISWARM_OWNER_EMAIL
 *
 * Agent ID is auto-generated and stored — you do NOT need to set it manually.
 */

import type {
  HookCallback,
  HookCallbackMatcher,
  HookInput,
  HookJSONOutput,
} from '@anthropic-ai/claude-agent-sdk';
import type { HookContext, HooksConfig } from './hooks';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ── Configuration ─────────────────────────────────────────────

export interface VeriSwarmConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  agentId: string;
  agentApiKey: string;
  enforce: boolean;
  onDeny: 'block' | 'log' | 'skip';
  reportEvents: boolean;
  ownerEmail: string;
  projectPath: string;
  registered: boolean;
}

interface StoredCredentials {
  agentId: string;
  agentApiKey: string;
  agentSlug: string;
  registeredAt: string;
  claimUrl?: string;
  workspaceApiKey?: string;
}

const CREDENTIALS_DIR = '.apex';
const CREDENTIALS_FILE = 'veriswarm.json';

function getCredentialsPath(projectPath: string): string {
  return path.join(projectPath, CREDENTIALS_DIR, CREDENTIALS_FILE);
}

function loadStoredCredentials(projectPath: string): StoredCredentials | null {
  try {
    const credPath = getCredentialsPath(projectPath);
    if (fs.existsSync(credPath)) {
      return JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    }
  } catch {
    // Corrupted file — will re-register
  }
  return null;
}

function saveCredentials(projectPath: string, creds: StoredCredentials): void {
  try {
    const dir = path.join(projectPath, CREDENTIALS_DIR);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(getCredentialsPath(projectPath), JSON.stringify(creds, null, 2));

    // Add to .gitignore if not already there
    const gitignorePath = path.join(projectPath, '.gitignore');
    const gitignoreEntry = `\n# VeriSwarm agent credentials (do not commit)\n${CREDENTIALS_DIR}/${CREDENTIALS_FILE}\n`;
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      if (!content.includes(CREDENTIALS_FILE)) {
        fs.appendFileSync(gitignorePath, gitignoreEntry);
      }
    }
  } catch {
    // Non-fatal — credentials just won't persist
  }
}

export function resolveVeriSwarmConfig(
  config?: Partial<VeriSwarmConfig>,
  projectPath?: string,
): VeriSwarmConfig {
  const resolvedProjectPath = projectPath ?? config?.projectPath ?? process.cwd();

  // Try to load stored credentials
  const stored = loadStoredCredentials(resolvedProjectPath);

  // VeriSwarm is enabled if: explicitly enabled, or stored credentials exist, or API key is set, or VERISWARM_ENABLED=true
  const hasStoredCreds = !!stored;
  const hasApiKey = !!(config?.apiKey ?? process.env.VERISWARM_API_KEY);
  const explicitlyEnabled = config?.enabled ?? (process.env.VERISWARM_ENABLED === 'true');

  return {
    enabled: explicitlyEnabled || hasStoredCreds || hasApiKey,
    apiUrl: config?.apiUrl ?? process.env.VERISWARM_API_URL ?? 'https://api.veriswarm.ai',
    apiKey: config?.apiKey ?? process.env.VERISWARM_API_KEY ?? stored?.workspaceApiKey ?? '',
    agentId: config?.agentId ?? stored?.agentId ?? '',
    agentApiKey: config?.agentApiKey ?? stored?.agentApiKey ?? '',
    enforce: config?.enforce ?? false,
    onDeny: config?.onDeny ?? 'log',
    reportEvents: config?.reportEvents ?? true,
    ownerEmail: config?.ownerEmail ?? process.env.VERISWARM_OWNER_EMAIL ?? '',
    projectPath: resolvedProjectPath,
    registered: hasStoredCreds,
  };
}

// ── HTTP Client (minimal, no dependencies) ────────────────────

async function veriswarmRequest(
  vsConfig: VeriSwarmConfig,
  method: string,
  apiPath: string,
  body?: Record<string, unknown>,
  useAgentKey: boolean = false,
): Promise<Record<string, unknown> | null> {
  try {
    const url = `${vsConfig.apiUrl}${apiPath}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (useAgentKey && vsConfig.agentApiKey) {
      headers['x-agent-api-key'] = vsConfig.agentApiKey;
    } else if (vsConfig.apiKey) {
      headers['x-api-key'] = vsConfig.apiKey;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      // Log error details for debugging (only for non-event-reporting calls)
      if (!apiPath.includes('/events')) {
        try {
          const errorBody = await response.text();
          console.log(`🐝 VeriSwarm: ${method} ${apiPath} → ${response.status}: ${errorBody.slice(0, 200)}`);
        } catch { /* ignore */ }
      }
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json() as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Auto-Registration ─────────────────────────────────────────

/**
 * Automatically register this APEX instance as an agent on VeriSwarm.
 * Called on first run when API key is set but no agent ID exists.
 * Returns the updated config with agent credentials, or the original if registration fails.
 */
export async function autoRegisterAgent(vsConfig: VeriSwarmConfig): Promise<VeriSwarmConfig> {
  if (vsConfig.registered || vsConfig.agentId) {
    return vsConfig; // Already registered
  }

  // No API key required — self-registration creates a workspace automatically

  // Derive agent slug from project directory name
  const projectName = path.basename(vsConfig.projectPath);
  const slug = `apex-${projectName}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60);

  const registrationBody: Record<string, unknown> = {
    slug,
    display_name: `APEX: ${projectName}`,
    description: `APEX autonomous development agent for ${projectName}. Auto-registered by APEX orchestrator.`,
    runtime_name: 'apex',
    runtime_version: '0.7.0',
  };

  if (vsConfig.ownerEmail) {
    registrationBody.owner_email = vsConfig.ownerEmail;
  }

  console.log(`\n🐝 VeriSwarm: Registering agent "${slug}" ...`);

  const result = await veriswarmRequest(vsConfig, 'POST', '/v1/public/agents/register', registrationBody);

  if (!result || !result.agent_id) {
    console.log('🐝 VeriSwarm: Registration failed (non-fatal). Will retry next run.\n');
    return vsConfig;
  }

  const agentId = result.agent_id as string;
  const agentApiKey = result.agent_api_key as string ?? '';
  const workspaceApiKey = result.workspace_api_key as string ?? '';
  const claimUrl = result.owner_claim_url as string ?? '';
  const tenantId = result.tenant_id as string ?? '';

  // Store credentials locally
  const storedCreds: StoredCredentials = {
    agentId,
    agentApiKey,
    agentSlug: slug,
    registeredAt: new Date().toISOString(),
    claimUrl: claimUrl || undefined,
    workspaceApiKey: workspaceApiKey || undefined,
  };
  saveCredentials(vsConfig.projectPath, storedCreds);

  // Print registration success with claim instructions
  const dashboardBase = vsConfig.apiUrl.replace('api.', '').replace(/\/$/, '');
  console.log(`🐝 VeriSwarm: Agent registered successfully!`);
  console.log(`   Agent ID:   ${agentId}`);
  console.log(`   Slug:       ${slug}`);
  console.log(`   Tenant:     ${tenantId}`);
  console.log(`   Dashboard:  ${dashboardBase}/agents/${agentId}`);
  console.log(`   Tracker:    ${dashboardBase}/operations`);
  if (claimUrl) {
    console.log(`   Claim URL:  ${claimUrl}`);
    console.log(`   ℹ  Claim this agent to connect it to your VeriSwarm account and boost its identity score.`);
  }
  console.log(`   Credentials stored in ${CREDENTIALS_DIR}/${CREDENTIALS_FILE}\n`);

  return {
    ...vsConfig,
    agentId,
    agentApiKey,
    apiKey: workspaceApiKey || vsConfig.apiKey,
    registered: true,
  };
}

// ── Tool Name to Event Type Mapping ───────────────────────────

function mapToolToEventType(_toolName: string, success: boolean): string {
  return success ? 'tool.call.success' : 'tool.call.failure';
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

  const result = await veriswarmRequest(vsConfig, 'POST', '/v1/decisions/check', {
    agent_id: vsConfig.agentId,
    action_type: 'tool_call',
    resource_type: toolName,
  });

  if (!result) {
    return { decision: 'approve' }; // Fail open
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
      context.eventEmitter?.emit('veriswarm:denied', {
        toolName,
        toolUseId,
        reason,
        decision: 'allowed (onDeny=log)',
      });
    }
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

  if (durationMs !== undefined) payload.duration_ms = durationMs;
  if (context.currentAgent) payload.apex_agent = context.currentAgent;
  if (context.currentStage) payload.apex_stage = context.currentStage;

  if (error) {
    payload.error_type = 'tool_error';
    payload.error_summary = String(error).slice(0, 200);
  }

  // Fire and forget
  veriswarmRequest(vsConfig, 'POST', '/v1/events', {
    event_id: eventId,
    agent_id: vsConfig.agentId,
    source_type: 'agent',
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    payload,
  }).catch(() => {});

  return {};
}

// ── Task Lifecycle Events ─────────────────────────────────────

export async function reportTaskStarted(vsConfig: VeriSwarmConfig, taskId: string, taskType: string): Promise<void> {
  if (!vsConfig.enabled || !vsConfig.reportEvents || !vsConfig.agentId) return;

  await veriswarmRequest(vsConfig, 'POST', '/v1/events', {
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

  await veriswarmRequest(vsConfig, 'POST', '/v1/events', {
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

  await veriswarmRequest(vsConfig, 'POST', '/v1/events', {
    event_id: `apex-task-fail-${taskId}`,
    agent_id: vsConfig.agentId,
    source_type: 'agent',
    event_type: 'task.failed',
    occurred_at: new Date().toISOString(),
    payload: { task_type: taskType, apex_task_id: taskId, error_type: errorType },
  }).catch(() => {});
}

// ── Trust Score Check ─────────────────────────────────────────

/**
 * Check the agent's current trust score on VeriSwarm.
 * Returns the score data or null if unavailable.
 */
export async function checkMyTrustScore(vsConfig: VeriSwarmConfig): Promise<Record<string, unknown> | null> {
  if (!vsConfig.agentId || !vsConfig.agentApiKey) return null;

  return veriswarmRequest(vsConfig, 'GET', '/v1/agents/me/scores', undefined, true);
}

// ── Hook Registration ─────────────────────────────────────────

/**
 * Initialize VeriSwarm integration. Auto-registers if needed, then creates hooks.
 * This should be called during APEX initialization, before the first task runs.
 */
export async function initializeVeriSwarm(
  context: HookContext,
  config?: Partial<VeriSwarmConfig>,
): Promise<{ hooks: HooksConfig; config: VeriSwarmConfig }> {
  let vsConfig = resolveVeriSwarmConfig(config, context.projectPath);

  if (!vsConfig.enabled) {
    return { hooks: {}, config: vsConfig };
  }

  // Auto-register if no agent ID stored (no API key required — self-registration)
  if (!vsConfig.agentId) {
    vsConfig = await autoRegisterAgent(vsConfig);
  }

  const hooks = createVeriSwarmHooks(context, vsConfig);
  return { hooks, config: vsConfig };
}

/**
 * Creates VeriSwarm hooks for an already-configured integration.
 * Use initializeVeriSwarm() for the full flow including auto-registration.
 */
export function createVeriSwarmHooks(
  context: HookContext,
  vsConfig: VeriSwarmConfig,
): HooksConfig {
  if (!vsConfig.enabled || !vsConfig.apiKey || !vsConfig.agentId) {
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

  if (vsConfig.enforce) {
    hooks.PreToolUse = [
      {
        hooks: [preHook],
        timeout: 11, // Slightly longer than the 10s fetch timeout
      },
    ];
  }

  if (vsConfig.reportEvents) {
    hooks.PostToolUse = [
      {
        hooks: [postHook],
        timeout: 2,
      },
    ];
  }

  return hooks;
}

/**
 * Merge VeriSwarm hooks into an existing HooksConfig.
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
