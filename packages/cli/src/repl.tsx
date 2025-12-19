#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  isApexInitialized,
  initializeApex,
  loadConfig,
  saveConfig,
  loadAgents,
  loadWorkflows,
  formatCost,
  formatTokens,
  formatDuration,
  getEffectiveConfig,
  ApexConfig,
} from '@apexcli/core';
import { ApexOrchestrator, TaskStore } from '@apexcli/orchestrator';
import { startInkApp, type InkAppInstance } from './ui/index.js';
import { SessionStore } from './services/SessionStore.js';
import { SessionAutoSaver } from './services/SessionAutoSaver.js';
import { ConversationManager } from './services/ConversationManager.js';

// ============================================================================
// Context
// ============================================================================

interface ApexContext {
  cwd: string;
  initialized: boolean;
  config: ApexConfig | null;
  orchestrator: ApexOrchestrator | null;
  apiProcess: ChildProcess | null;
  webUIProcess: ChildProcess | null;
  apiPort: number | undefined;
  webUIPort: number | undefined;
  app: InkAppInstance | null;
  sessionStore: SessionStore | null;
  sessionAutoSaver: SessionAutoSaver | null;
  conversationManager: ConversationManager | null;
}

const ctx: ApexContext = {
  cwd: process.cwd(),
  initialized: false,
  config: null,
  orchestrator: null,
  apiProcess: null,
  webUIProcess: null,
  apiPort: 3000,
  webUIPort: 3001,
  app: null,
  sessionStore: null,
  sessionAutoSaver: null,
  conversationManager: null,
};

// ============================================================================
// Git Utilities
// ============================================================================

function getGitBranch(): string | undefined {
  try {
    const branch = execSync('git branch --show-current', {
      cwd: ctx.cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleInit(args: string[]): Promise<void> {
  if (ctx.initialized) {
    ctx.app?.addMessage({
      type: 'system',
      content: 'APEX is already initialized in this directory.',
    });
    return;
  }

  const options = {
    skipPrompts: args.includes('--yes') || args.includes('-y'),
    name: '',
    language: 'typescript',
    framework: '',
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' || args[i] === '-n') {
      options.name = args[++i];
    } else if (args[i] === '--language' || args[i] === '-l') {
      options.language = args[++i];
    } else if (args[i] === '--framework' || args[i] === '-f') {
      options.framework = args[++i];
    }
  }

  if (!options.name) {
    options.name = path.basename(ctx.cwd);
  }

  ctx.app?.addMessage({
    type: 'system',
    content: 'Initializing APEX...',
  });

  try {
    await initializeApex(ctx.cwd, {
      projectName: options.name,
      language: options.language,
      framework: options.framework,
    });

    ctx.initialized = true;
    ctx.config = await loadConfig(ctx.cwd);
    ctx.orchestrator = new ApexOrchestrator({ projectPath: ctx.cwd });
    await ctx.orchestrator.initialize();

    // Initialize session management
    ctx.sessionStore = new SessionStore(ctx.cwd);
    await ctx.sessionStore.initialize();
    ctx.sessionAutoSaver = new SessionAutoSaver(ctx.sessionStore);

    // Try to restore the last active session or create a new one
    const activeSessionId = await ctx.sessionStore.getActiveSessionId();
    await ctx.sessionAutoSaver.start(activeSessionId || undefined);

    ctx.app?.addMessage({
      type: 'assistant',
      content: `APEX initialized successfully!\n\n  Configuration: .apex/config.yaml\n  Agents: .apex/agents/\n  Workflows: .apex/workflows/`,
    });

    ctx.app?.updateState({
      initialized: true,
      config: ctx.config,
      orchestrator: ctx.orchestrator,
    });
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to initialize: ${(error as Error).message}`,
    });
  }
}

async function handleStatus(args: string[]): Promise<void> {
  if (!ctx.initialized || !ctx.orchestrator) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const taskId = args[0];

  if (taskId) {
    const task = await ctx.orchestrator.getTask(taskId);
    if (!task) {
      ctx.app?.addMessage({
        type: 'error',
        content: `Task not found: ${taskId}`,
      });
      return;
    }

    const lines = [
      `**Task:** ${task.id}`,
      `**Status:** ${task.status}`,
      `**Description:** ${task.description}`,
      `**Workflow:** ${task.workflow || 'default'}`,
      `**Created:** ${task.createdAt.toISOString()}`,
    ];

    if (task.usage) {
      lines.push(`**Tokens:** ${formatTokens(task.usage.inputTokens + task.usage.outputTokens)}`);
      lines.push(`**Cost:** ${formatCost(task.usage.estimatedCost)}`);
    }

    ctx.app?.addMessage({
      type: 'assistant',
      content: lines.join('\n'),
    });
  } else {
    const tasks = await ctx.orchestrator.listTasks({ limit: 10 });

    if (tasks.length === 0) {
      ctx.app?.addMessage({
        type: 'system',
        content: 'No tasks found.',
      });
      return;
    }

    const lines = ['**Recent Tasks:**\n'];
    for (const task of tasks) {
      const statusIcon = getStatusIcon(task.status);
      const cost = task.usage ? formatCost(task.usage.estimatedCost) : '$0.00';
      const desc =
        task.description.length > 50 ? task.description.slice(0, 47) + '...' : task.description;
      lines.push(`  ${task.id.slice(0, 12)} ${statusIcon} ${task.status.padEnd(14)} ${cost.padStart(7)}  ${desc}`);
    }

    ctx.app?.addMessage({
      type: 'assistant',
      content: lines.join('\n'),
    });
  }
}

async function handleAgents(): Promise<void> {
  if (!ctx.initialized) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const agentsRecord = await loadAgents(ctx.cwd);
  const agents = Object.values(agentsRecord);

  if (agents.length === 0) {
    ctx.app?.addMessage({
      type: 'system',
      content: 'No agents found.',
    });
    return;
  }

  const lines = ['**Available Agents:**\n'];
  for (const agent of agents) {
    lines.push(`  **${agent.name}** - ${agent.description}`);
    lines.push(`    Model: ${agent.model || 'default'}, Tools: ${agent.tools?.join(', ') || 'none'}`);
  }

  ctx.app?.addMessage({
    type: 'assistant',
    content: lines.join('\n'),
  });
}

async function handleWorkflows(): Promise<void> {
  if (!ctx.initialized) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const workflowsRecord = await loadWorkflows(ctx.cwd);
  const workflows = Object.values(workflowsRecord);

  if (workflows.length === 0) {
    ctx.app?.addMessage({
      type: 'system',
      content: 'No workflows found.',
    });
    return;
  }

  const lines = ['**Available Workflows:**\n'];
  for (const workflow of workflows) {
    lines.push(`  **${workflow.name}** - ${workflow.description || 'No description'}`);
    const stages = workflow.stages?.map((s: { name?: string; agent: string }) => s.name || s.agent).join(' → ') || 'No stages';
    lines.push(`    Stages: ${stages}`);
  }

  ctx.app?.addMessage({
    type: 'assistant',
    content: lines.join('\n'),
  });
}

async function handleConfig(args: string[]): Promise<void> {
  if (!ctx.initialized || !ctx.config) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const action = args[0];

  if (action === 'get' && args[1]) {
    const key = args[1];
    const value = getConfigValue(ctx.config, key);
    ctx.app?.addMessage({
      type: 'assistant',
      content: `${key} = ${JSON.stringify(value)}`,
    });
  } else if (action === 'set' && args[1] && args[2]) {
    const key = args[1];
    const value = args[2];
    setConfigValue(ctx.config, key, value);
    await saveConfig(ctx.cwd, ctx.config);
    ctx.app?.addMessage({
      type: 'system',
      content: `Configuration updated: ${key} = ${value}`,
    });
  } else {
    // Show full config
    ctx.app?.addMessage({
      type: 'assistant',
      content: '```yaml\n' + JSON.stringify(ctx.config, null, 2) + '\n```',
    });
  }
}

async function handleServe(args: string[]): Promise<void> {
  if (!ctx.initialized) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  if (ctx.apiProcess) {
    ctx.app?.addMessage({
      type: 'system',
      content: 'API server is already running.',
    });
    return;
  }

  let port = ctx.apiPort ?? 3000;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      port = parseInt(args[++i], 10);
    }
  }

  ctx.app?.addMessage({
    type: 'system',
    content: `Starting API server on port ${port}...`,
  });

  try {
    // Find the API package path
    const apiPath = path.resolve(__dirname, '../../api');

    // Spawn the API server as a background process
    const proc = spawn('node', [path.join(apiPath, 'dist/index.js')], {
      cwd: ctx.cwd,
      env: {
        ...process.env,
        PORT: port.toString(),
        APEX_PROJECT: ctx.cwd,
        APEX_SILENT: '1',
      },
      stdio: 'ignore',
      detached: true,
    });

    proc.unref();
    ctx.apiProcess = proc;
    ctx.apiPort = port;
    const apiUrl = `http://localhost:${port}`;

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1500));

    ctx.app?.updateState({ apiUrl });
    ctx.app?.addMessage({
      type: 'assistant',
      content: `API server running at ${apiUrl}`,
    });
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to start API server: ${(error as Error).message}`,
    });
  }
}

async function handleWeb(args: string[]): Promise<void> {
  if (!ctx.initialized) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  let port = ctx.webUIPort ?? 3001;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      port = parseInt(args[++i], 10);
    }
  }

  ctx.app?.addMessage({
    type: 'system',
    content: `Starting Web UI on port ${port}...`,
  });

  // Start web UI as detached process
  const webUIPath = path.resolve(__dirname, '../../web-ui');

  try {
    await fs.access(webUIPath);
  } catch {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Web UI package not found.',
    });
    return;
  }

  const apiUrl = ctx.config?.api?.url || `http://localhost:${ctx.apiPort ?? 3000}`;
  const proc = spawn('npx', ['next', 'dev', '-p', String(port)], {
    cwd: webUIPath,
    env: { ...process.env, PORT: String(port), NEXT_PUBLIC_APEX_API_URL: apiUrl },
    stdio: 'ignore',
    detached: true,
  });

  proc.unref();
  ctx.webUIProcess = proc;
  ctx.webUIPort = port;
  const webUrl = `http://localhost:${port}`;

  await new Promise((resolve) => setTimeout(resolve, 2000));

  ctx.app?.updateState({ webUrl });
  ctx.app?.addMessage({
    type: 'assistant',
    content: `Web UI running at ${webUrl}`,
  });
}

async function handleStop(): Promise<void> {
  const stopped: string[] = [];
  const stateUpdates: { apiUrl?: undefined; webUrl?: undefined } = {};

  if (ctx.apiProcess) {
    ctx.apiProcess.kill();
    ctx.apiProcess = null;
    stopped.push('API server');
    stateUpdates.apiUrl = undefined;
  }

  if (ctx.webUIProcess) {
    ctx.webUIProcess.kill();
    ctx.webUIProcess = null;
    stopped.push('Web UI');
    stateUpdates.webUrl = undefined;
  }

  if (stopped.length > 0) {
    ctx.app?.updateState(stateUpdates);
    ctx.app?.addMessage({
      type: 'system',
      content: `Stopped: ${stopped.join(', ')}`,
    });
  } else {
    ctx.app?.addMessage({
      type: 'system',
      content: 'No services running.',
    });
  }
}

async function handleCancel(args: string[]): Promise<void> {
  if (!ctx.initialized || !ctx.orchestrator) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const taskId = args[0];
  if (!taskId) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Usage: /cancel <task_id>',
    });
    return;
  }

  const cancelled = await ctx.orchestrator.cancelTask(taskId);
  if (cancelled) {
    ctx.app?.addMessage({
      type: 'system',
      content: `Task ${taskId} cancelled.`,
    });
  } else {
    ctx.app?.addMessage({
      type: 'error',
      content: `Could not cancel task ${taskId}. It may already be completed or not exist.`,
    });
  }
}

async function handleRetry(args: string[]): Promise<void> {
  if (!ctx.initialized || !ctx.orchestrator) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const taskId = args[0];
  if (!taskId) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Usage: /retry <task_id>',
    });
    return;
  }

  const task = await ctx.orchestrator.getTask(taskId);
  if (!task) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Task not found: ${taskId}`,
    });
    return;
  }

  // Allow retry for failed, cancelled, or stuck in-progress tasks
  const retryableStatuses = ['failed', 'cancelled', 'in-progress', 'planning'];
  if (!retryableStatuses.includes(task.status)) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Only failed, cancelled, or stuck tasks can be retried.',
    });
    return;
  }

  await ctx.orchestrator.updateTaskStatus(taskId, 'pending');
  ctx.orchestrator.executeTask(taskId).catch((error) => {
    ctx.app?.addMessage({
      type: 'error',
      content: `Task failed: ${error.message}`,
    });
  });

  ctx.app?.addMessage({
    type: 'system',
    content: `Retrying task ${taskId}...`,
  });
}

async function handleResume(args: string[]): Promise<void> {
  if (!ctx.initialized || !ctx.orchestrator) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const taskId = args[0];
  if (!taskId) {
    // If no task ID provided, show all paused tasks
    const tasks = await ctx.orchestrator.listTasks({ status: 'paused' });
    if (tasks.length === 0) {
      ctx.app?.addMessage({
        type: 'system',
        content: 'No paused tasks found.',
      });
      return;
    }

    const lines = ['**Paused Tasks:**\n'];
    for (const task of tasks) {
      const reason = task.pauseReason || 'unknown';
      const resumeAfter = task.resumeAfter
        ? `Auto-resume: ${task.resumeAfter.toLocaleTimeString()}`
        : 'Manual resume required';
      const desc = task.description.length > 40
        ? task.description.slice(0, 37) + '...'
        : task.description;
      lines.push(`  ${task.id.slice(0, 12)} │ ${reason.padEnd(12)} │ ${resumeAfter.padEnd(25)} │ ${desc}`);
    }
    lines.push('\nUse /resume <task_id> to resume a specific task.');

    ctx.app?.addMessage({
      type: 'assistant',
      content: lines.join('\n'),
    });
    return;
  }

  const task = await ctx.orchestrator.getTask(taskId);
  if (!task) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Task not found: ${taskId}`,
    });
    return;
  }

  if (task.status !== 'paused') {
    ctx.app?.addMessage({
      type: 'error',
      content: `Task ${taskId} is not paused (status: ${task.status}). Use /retry for failed tasks.`,
    });
    return;
  }

  const resumed = await ctx.orchestrator.resumePausedTask(taskId);
  if (resumed) {
    ctx.app?.addMessage({
      type: 'system',
      content: `Resuming task ${taskId}...`,
    });

    ctx.app?.updateState({
      currentTask: task,
    });
  } else {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to resume task ${taskId}. Check if the task has a valid checkpoint.`,
    });
  }
}

async function handleLogs(args: string[]): Promise<void> {
  if (!ctx.initialized || !ctx.orchestrator) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const taskId = args[0];
  if (!taskId) {
    // Show logs for the most recent task
    const tasks = await ctx.orchestrator.listTasks({ limit: 1 });
    if (tasks.length === 0) {
      ctx.app?.addMessage({
        type: 'system',
        content: 'No tasks found. Usage: /logs [task_id] [--level <level>] [--limit <n>]',
      });
      return;
    }
    args[0] = tasks[0].id;
  }

  // Parse options
  let level: string | undefined;
  let limit = 20;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--level' || args[i] === '-l') {
      level = args[++i];
    } else if (args[i] === '--limit' || args[i] === '-n') {
      limit = parseInt(args[++i], 10) || 20;
    }
  }

  const logs = await ctx.orchestrator.getTaskLogs(args[0], { level, limit });

  if (logs.length === 0) {
    ctx.app?.addMessage({
      type: 'system',
      content: `No logs found for task ${args[0]}`,
    });
    return;
  }

  const lines = [`**Logs for task ${args[0].slice(0, 12)}** (${logs.length} entries)\n`];

  for (const log of logs.reverse()) {
    const time = log.timestamp.toLocaleTimeString();
    const levelIcon = getLevelIcon(log.level);
    const stage = log.stage ? `[${log.stage}]` : '';
    const agent = log.agent ? `(${log.agent})` : '';
    lines.push(`  ${time} ${levelIcon} ${stage}${agent} ${log.message}`);
  }

  ctx.app?.addMessage({
    type: 'assistant',
    content: lines.join('\n'),
  });
}

function getLevelIcon(level: string): string {
  const icons: Record<string, string> = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };
  return icons[level] || '•';
}

// ============================================================================
// Session Command Handlers
// ============================================================================

async function handleSession(args: string[]): Promise<void> {
  if (!ctx.initialized || !ctx.sessionStore) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized. Run /init first.',
    });
    return;
  }

  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
      await handleSessionList(args.slice(1));
      break;
    case 'load':
      await handleSessionLoad(args[1]);
      break;
    case 'save':
      await handleSessionSave(args.slice(1));
      break;
    case 'branch':
      await handleSessionBranch(args.slice(1));
      break;
    case 'export':
      await handleSessionExport(args.slice(1));
      break;
    case 'delete':
      await handleSessionDelete(args[1]);
      break;
    case 'info':
      await handleSessionInfo();
      break;
    default:
      ctx.app?.addMessage({
        type: 'error',
        content: `Unknown session command: ${subcommand || 'none'}\n\nUsage:\n  /session list [--all] [--search <query>]\n  /session load <id|name>\n  /session save <name> [--tags <tags>]\n  /session branch [<name>] [--from <index>]\n  /session export [--format md|json|html] [--output <file>]\n  /session delete <id>\n  /session info`,
      });
  }
}

async function handleSessionList(args: string[]): Promise<void> {
  if (!ctx.sessionStore) return;

  const all = args.includes('--all');
  const searchIndex = args.indexOf('--search');
  const search = searchIndex >= 0 ? args[searchIndex + 1] : undefined;

  const sessions = await ctx.sessionStore.listSessions({ all, search, limit: 20 });

  if (sessions.length === 0) {
    ctx.app?.addMessage({
      type: 'system',
      content: 'No sessions found.',
    });
    return;
  }

  const lines = ['**Sessions:**\n'];
  for (const session of sessions) {
    const name = session.name || 'Unnamed';
    const date = new Date(session.updatedAt).toLocaleDateString();
    const archived = session.isArchived ? ' (archived)' : '';
    lines.push(`  ${session.id.slice(0, 12)} │ ${name.padEnd(20)} │ ${session.messageCount} msgs │ $${session.totalCost.toFixed(2)} │ ${date}${archived}`);
  }

  ctx.app?.addMessage({
    type: 'assistant',
    content: lines.join('\n'),
  });
}

async function handleSessionLoad(sessionId: string): Promise<void> {
  if (!ctx.sessionStore || !ctx.sessionAutoSaver || !sessionId) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Usage: /session load <session_id>',
    });
    return;
  }

  try {
    const session = await ctx.sessionStore.getSession(sessionId);
    if (!session) {
      ctx.app?.addMessage({
        type: 'error',
        content: `Session not found: ${sessionId}`,
      });
      return;
    }

    // Save current session before switching
    await ctx.sessionAutoSaver.save();

    // Load the new session
    await ctx.sessionAutoSaver.start(sessionId);
    await ctx.sessionStore.setActiveSession(sessionId);

    ctx.app?.addMessage({
      type: 'system',
      content: `Loaded session: ${session.name || sessionId}\nMessages: ${session.messages.length}, Cost: $${session.state.totalCost.toFixed(4)}`,
    });

    // Update app state with session info
    ctx.app?.updateState({
      sessionName: session.name,
      sessionStartTime: session.lastAccessedAt,
    });

  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to load session: ${(error as Error).message}`,
    });
  }
}

async function handleSessionSave(args: string[]): Promise<void> {
  if (!ctx.sessionAutoSaver || !args[0]) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Usage: /session save <name> [--tags tag1,tag2]',
    });
    return;
  }

  const name = args[0];
  const tagsIndex = args.indexOf('--tags');
  const tags = tagsIndex >= 0 ? args[tagsIndex + 1]?.split(',') || [] : [];

  try {
    await ctx.sessionAutoSaver.updateSessionInfo({ name, tags });
    await ctx.sessionAutoSaver.save();

    ctx.app?.addMessage({
      type: 'system',
      content: `Session saved as "${name}"${tags.length > 0 ? ` with tags: ${tags.join(', ')}` : ''}`,
    });

    ctx.app?.updateState({ sessionName: name });
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to save session: ${(error as Error).message}`,
    });
  }
}

async function handleSessionBranch(args: string[]): Promise<void> {
  if (!ctx.sessionStore || !ctx.sessionAutoSaver) return;

  const currentSession = ctx.sessionAutoSaver.getSession();
  if (!currentSession) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'No active session to branch from.',
    });
    return;
  }

  const name = args[0];
  const fromIndex = args.includes('--from') ?
    parseInt(args[args.indexOf('--from') + 1], 10) :
    currentSession.messages.length - 1;

  if (isNaN(fromIndex) || fromIndex < 0 || fromIndex >= currentSession.messages.length) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Invalid message index: ${fromIndex}. Must be between 0 and ${currentSession.messages.length - 1}`,
    });
    return;
  }

  try {
    const branchedSession = await ctx.sessionStore.branchSession(
      currentSession.id,
      fromIndex,
      name
    );

    // Switch to the new branch
    await ctx.sessionAutoSaver.start(branchedSession.id);
    await ctx.sessionStore.setActiveSession(branchedSession.id);

    ctx.app?.addMessage({
      type: 'system',
      content: `Created and switched to branch: ${branchedSession.name}\nBranched from message ${fromIndex + 1} of ${currentSession.messages.length}`,
    });

    ctx.app?.updateState({
      sessionName: branchedSession.name,
      sessionStartTime: branchedSession.createdAt,
    });
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to create branch: ${(error as Error).message}`,
    });
  }
}

async function handleSessionExport(args: string[]): Promise<void> {
  if (!ctx.sessionStore || !ctx.sessionAutoSaver) return;

  const currentSession = ctx.sessionAutoSaver.getSession();
  if (!currentSession) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'No active session to export.',
    });
    return;
  }

  const formatIndex = args.indexOf('--format');
  const format = (formatIndex >= 0 ? args[formatIndex + 1] : 'md') as 'md' | 'json' | 'html';

  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : undefined;

  try {
    const exported = await ctx.sessionStore.exportSession(currentSession.id, format);

    if (outputFile) {
      await fs.writeFile(outputFile, exported, 'utf-8');
      ctx.app?.addMessage({
        type: 'system',
        content: `Session exported to ${outputFile} (${format.toUpperCase()} format)`,
      });
    } else {
      // Show first 500 characters as preview
      const preview = exported.length > 500 ? exported.slice(0, 500) + '...' : exported;
      ctx.app?.addMessage({
        type: 'assistant',
        content: `**Session Export (${format.toUpperCase()}):**\n\`\`\`${format}\n${preview}\n\`\`\``,
      });
    }
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to export session: ${(error as Error).message}`,
    });
  }
}

async function handleSessionDelete(sessionId: string): Promise<void> {
  if (!ctx.sessionStore || !sessionId) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'Usage: /session delete <session_id>',
    });
    return;
  }

  try {
    const session = await ctx.sessionStore.getSession(sessionId);
    if (!session) {
      ctx.app?.addMessage({
        type: 'error',
        content: `Session not found: ${sessionId}`,
      });
      return;
    }

    await ctx.sessionStore.deleteSession(sessionId);
    ctx.app?.addMessage({
      type: 'system',
      content: `Deleted session: ${session.name || sessionId}`,
    });
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to delete session: ${(error as Error).message}`,
    });
  }
}

async function handleSessionInfo(): Promise<void> {
  if (!ctx.sessionAutoSaver) return;

  const currentSession = ctx.sessionAutoSaver.getSession();
  if (!currentSession) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'No active session.',
    });
    return;
  }

  const lines = [
    `**Current Session:**`,
    `  ID: ${currentSession.id}`,
    `  Name: ${currentSession.name || 'Unnamed'}`,
    `  Messages: ${currentSession.messages.length}`,
    `  Created: ${currentSession.createdAt.toLocaleString()}`,
    `  Updated: ${currentSession.updatedAt.toLocaleString()}`,
    `  Total Cost: $${currentSession.state.totalCost.toFixed(4)}`,
    `  Tokens: ${formatTokens(currentSession.state.totalTokens.input + currentSession.state.totalTokens.output)}`,
  ];

  if (currentSession.tags.length > 0) {
    lines.push(`  Tags: ${currentSession.tags.join(', ')}`);
  }

  if (currentSession.parentSessionId) {
    lines.push(`  Branched from: ${currentSession.parentSessionId}`);
  }

  if (currentSession.childSessionIds.length > 0) {
    lines.push(`  Branches: ${currentSession.childSessionIds.length}`);
  }

  const unsavedChanges = ctx.sessionAutoSaver.getUnsavedChangesCount();
  if (unsavedChanges > 0) {
    lines.push(`  Unsaved changes: ${unsavedChanges}`);
  }

  ctx.app?.addMessage({
    type: 'assistant',
    content: lines.join('\n'),
  });
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(description: string): Promise<void> {
  if (!ctx.orchestrator) {
    ctx.app?.addMessage({
      type: 'error',
      content: 'APEX not initialized.',
    });
    return;
  }

  // Track user input in conversation context
  if (ctx.conversationManager) {
    ctx.conversationManager.addMessage({
      role: 'user',
      content: description,
    });
  }

  // Track user input in session
  if (ctx.sessionAutoSaver) {
    await ctx.sessionAutoSaver.addInputToHistory(description);
    await ctx.sessionAutoSaver.addMessage({
      role: 'user',
      content: description,
    });
  }

  ctx.app?.addMessage({
    type: 'system',
    content: 'Creating task...',
  });

  try {
    const task = await ctx.orchestrator.createTask({ description });

    // Track task in conversation context
    if (ctx.conversationManager) {
      ctx.conversationManager.setTask(task.id);
      ctx.conversationManager.setAgent('planner');
      ctx.conversationManager.addMessage({
        role: 'assistant',
        content: `Task created: ${task.id}\nStarting execution...`,
      });
    }

    ctx.app?.updateState({
      currentTask: task,
      activeAgent: 'planner',
    });

    ctx.app?.addMessage({
      type: 'assistant',
      content: `Task created: ${task.id}\nStarting execution...`,
    });

    // Track task creation in session
    if (ctx.sessionAutoSaver) {
      await ctx.sessionAutoSaver.addMessage({
        role: 'assistant',
        content: `Task created: ${task.id}`,
        taskId: task.id,
        agent: 'system',
      });
      await ctx.sessionAutoSaver.updateState({
        tasksCreated: [...(ctx.sessionAutoSaver.getSession()?.state.tasksCreated || []), task.id],
        currentTaskId: task.id,
      });
    }

    // Start execution
    ctx.orchestrator.executeTask(task.id).then(async () => {
      // Fetch the completed task to get its final status
      const completedTask = await ctx.orchestrator?.getTask(task.id);
      ctx.app?.addMessage({
        type: 'assistant',
        content: `Task completed: ${completedTask?.status || 'unknown'}`,
      });

      // Track completion in session
      if (ctx.sessionAutoSaver && completedTask?.status === 'completed') {
        await ctx.sessionAutoSaver.addMessage({
          role: 'assistant',
          content: `Task completed: ${completedTask.status}`,
          taskId: task.id,
          agent: 'system',
        });
        await ctx.sessionAutoSaver.updateState({
          tasksCompleted: [...(ctx.sessionAutoSaver.getSession()?.state.tasksCompleted || []), task.id],
          currentTaskId: undefined,
        });
      }

      ctx.app?.updateState({ currentTask: undefined, activeAgent: undefined });
    }).catch(async (error) => {
      ctx.app?.addMessage({
        type: 'error',
        content: `Task failed: ${error.message}`,
      });

      // Track failure in session
      if (ctx.sessionAutoSaver) {
        await ctx.sessionAutoSaver.addMessage({
          role: 'assistant',
          content: `Task failed: ${error.message}`,
          taskId: task.id,
          agent: 'system',
        });
        await ctx.sessionAutoSaver.updateState({
          currentTaskId: undefined,
        });
      }

      ctx.app?.updateState({ currentTask: undefined, activeAgent: undefined });
    });
  } catch (error) {
    const errorMessage = `Failed to create task: ${(error as Error).message}`;
    ctx.app?.addMessage({
      type: 'error',
      content: errorMessage,
    });

    // Track error in session
    if (ctx.sessionAutoSaver) {
      await ctx.sessionAutoSaver.addMessage({
        role: 'assistant',
        content: errorMessage,
        agent: 'system',
      });
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: '○',
    queued: '◐',
    planning: '◑',
    'in-progress': '●',
    'waiting-approval': '◎',
    paused: '◫',
    completed: '✓',
    failed: '✗',
    cancelled: '⊘',
  };
  return icons[status] || '?';
}

function getConfigValue(config: ApexConfig, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function setConfigValue(config: ApexConfig, key: string, value: string): void {
  const parts = key.split('.');
  let current: Record<string, unknown> = config as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }

  // Try to parse as JSON, otherwise use as string
  try {
    current[parts[parts.length - 1]] = JSON.parse(value);
  } catch {
    current[parts[parts.length - 1]] = value;
  }
}

// ============================================================================
// Display Mode Command Handlers
// ============================================================================

async function handleCompact(): Promise<void> {
  // Get current state to implement toggle behavior
  const currentState = ctx.app?.getState();
  const newMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';

  ctx.app?.updateState({ displayMode: newMode });
  ctx.app?.addMessage({
    type: 'system',
    content: newMode === 'compact'
      ? 'Display mode set to compact: Single-line status, condensed output'
      : 'Display mode set to normal: Standard display with all components shown',
  });
}

async function handleVerbose(): Promise<void> {
  // Get current state to implement toggle behavior
  const currentState = ctx.app?.getState();
  const newMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';

  ctx.app?.updateState({ displayMode: newMode });
  ctx.app?.addMessage({
    type: 'system',
    content: newMode === 'verbose'
      ? 'Display mode set to verbose: Detailed debug output, full information'
      : 'Display mode set to normal: Standard display with all components shown',
  });
}

// Helper function to persist preview configuration changes to disk
async function persistPreviewConfig(previewConfig: {
  confidenceThreshold: number;
  autoExecuteHighConfidence: boolean;
  timeoutMs: number;
}): Promise<void> {
  if (!ctx.config || !ctx.initialized) return;

  // Update config object with current state
  ctx.config.ui = {
    ...ctx.config.ui,
    previewMode: ctx.app?.getState()?.previewMode ?? ctx.config.ui?.previewMode ?? true,
    previewConfidence: previewConfig.confidenceThreshold,
    autoExecuteHighConfidence: previewConfig.autoExecuteHighConfidence,
    previewTimeout: previewConfig.timeoutMs,
  };

  // Persist to file
  try {
    await saveConfig(ctx.cwd, ctx.config);
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to persist config: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function handlePreview(args: string[]): Promise<void> {
  const action = args[0]?.toLowerCase();
  const value = args[1];

  // Get current state
  const currentState = ctx.app?.getState();

  switch (action) {
    case 'on':
      ctx.app?.updateState({ previewMode: true, pendingPreview: undefined });
      ctx.app?.addMessage({
        type: 'system',
        content: 'Preview mode enabled. You will see a preview before each execution.',
      });
      // Persist the preview mode change
      if (currentState?.previewConfig) {
        await persistPreviewConfig(currentState.previewConfig);
      }
      break;

    case 'off':
      ctx.app?.updateState({ previewMode: false, pendingPreview: undefined });
      ctx.app?.addMessage({
        type: 'system',
        content: 'Preview mode disabled.',
      });
      // Persist the preview mode change
      if (currentState?.previewConfig) {
        await persistPreviewConfig(currentState.previewConfig);
      }
      break;

    case undefined:
    case 'toggle':
      const newMode = !currentState?.previewMode;
      ctx.app?.updateState({ previewMode: newMode, pendingPreview: undefined });
      ctx.app?.addMessage({
        type: 'system',
        content: `Preview mode ${newMode ? 'enabled' : 'disabled'}.`,
      });
      // Persist the preview mode change
      if (currentState?.previewConfig) {
        await persistPreviewConfig(currentState.previewConfig);
      }
      break;

    case 'confidence':
      if (value === undefined) {
        ctx.app?.addMessage({
          type: 'assistant',
          content: `Preview confidence threshold: ${(currentState?.previewConfig.confidenceThreshold * 100).toFixed(0)}%`,
        });
      } else {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
          ctx.app?.addMessage({
            type: 'error',
            content: 'Confidence must be a number between 0-1 (e.g., 0.7) or 0-100 (e.g., 70).',
          });
        } else {
          // Auto-detect range: 0-1 vs 0-100
          const threshold = parsed > 1 ? parsed / 100 : parsed;

          if (threshold < 0 || threshold > 1) {
            ctx.app?.addMessage({
              type: 'error',
              content: 'Confidence threshold must be between 0-1 (or 0-100).',
            });
          } else {
            const newConfig = {
              ...currentState?.previewConfig,
              confidenceThreshold: threshold,
            };
            ctx.app?.updateState({ previewConfig: newConfig });

            // Persist to config file
            await persistPreviewConfig(newConfig);

            ctx.app?.addMessage({
              type: 'system',
              content: `Preview confidence threshold set to ${(threshold * 100).toFixed(0)}%.`,
            });
          }
        }
      }
      break;

    case 'timeout':
      if (value === undefined) {
        ctx.app?.addMessage({
          type: 'assistant',
          content: `Preview timeout: ${currentState?.previewConfig.timeoutMs / 1000}s`,
        });
      } else {
        const timeout = parseInt(value, 10);
        if (isNaN(timeout) || timeout < 1) {
          ctx.app?.addMessage({
            type: 'error',
            content: 'Timeout must be a positive number (in seconds).',
          });
        } else {
          const newConfig = {
            ...currentState?.previewConfig,
            timeoutMs: timeout * 1000,
          };
          ctx.app?.updateState({ previewConfig: newConfig });

          // Persist to config file
          await persistPreviewConfig(newConfig);

          ctx.app?.addMessage({
            type: 'system',
            content: `Preview timeout set to ${timeout}s.`,
          });
        }
      }
      break;

    case 'auto':
      if (value === undefined) {
        ctx.app?.addMessage({
          type: 'assistant',
          content: `Auto-execute high confidence: ${currentState?.previewConfig.autoExecuteHighConfidence ? 'enabled' : 'disabled'}`,
        });
      } else if (value === 'on' || value === 'true') {
        const newConfig = {
          ...currentState?.previewConfig,
          autoExecuteHighConfidence: true,
        };
        ctx.app?.updateState({ previewConfig: newConfig });

        // Persist to config file
        await persistPreviewConfig(newConfig);

        ctx.app?.addMessage({
          type: 'system',
          content: 'Auto-execute for high confidence inputs enabled.',
        });
      } else if (value === 'off' || value === 'false') {
        const newConfig = {
          ...currentState?.previewConfig,
          autoExecuteHighConfidence: false,
        };
        ctx.app?.updateState({ previewConfig: newConfig });

        // Persist to config file
        await persistPreviewConfig(newConfig);

        ctx.app?.addMessage({
          type: 'system',
          content: 'Auto-execute for high confidence inputs disabled.',
        });
      } else {
        ctx.app?.addMessage({
          type: 'error',
          content: 'Usage: /preview auto [on|off]',
        });
      }
      break;

    case 'status':
    case 'settings':  // Add alias for settings
      const config = currentState?.previewConfig;
      ctx.app?.addMessage({
        type: 'assistant',
        content: `Preview Settings:
• Mode: ${currentState?.previewMode ? 'enabled' : 'disabled'}
• Confidence threshold: ${(config?.confidenceThreshold * 100).toFixed(0)}%
• Auto-execute high confidence: ${config?.autoExecuteHighConfidence ? 'enabled' : 'disabled'}
• Timeout: ${config?.timeoutMs / 1000}s`,
      });
      break;

    default:
      ctx.app?.addMessage({
        type: 'error',
        content: 'Usage: /preview [on|off|toggle|status|settings|confidence|timeout|auto]',
      });
  }
}

async function handleThoughts(args: string[]): Promise<void> {
  const action = args[0]?.toLowerCase();

  // Get current state
  const currentState = ctx.app?.getState();

  switch (action) {
    case 'on':
      ctx.app?.updateState({ showThoughts: true });
      ctx.app?.addMessage({
        type: 'system',
        content: 'Thought visibility enabled: AI reasoning will be shown',
      });
      break;

    case 'off':
      ctx.app?.updateState({ showThoughts: false });
      ctx.app?.addMessage({
        type: 'system',
        content: 'Thought visibility disabled: AI reasoning will be hidden',
      });
      break;

    case undefined:
    case 'toggle':
      const newShowThoughts = !currentState?.showThoughts;
      ctx.app?.updateState({ showThoughts: newShowThoughts });
      ctx.app?.addMessage({
        type: 'system',
        content: newShowThoughts
          ? 'Thought visibility enabled: AI reasoning will be shown'
          : 'Thought visibility disabled: AI reasoning will be hidden',
      });
      break;

    case 'status':
      ctx.app?.addMessage({
        type: 'assistant',
        content: `Thought visibility is currently ${currentState?.showThoughts ? 'enabled' : 'disabled'}.`,
      });
      break;

    default:
      ctx.app?.addMessage({
        type: 'error',
        content: 'Usage: /thoughts [on|off|toggle|status]',
      });
  }
}

// ============================================================================
// Command Router
// ============================================================================

async function handleCommand(command: string, args: string[]): Promise<void> {
  switch (command) {
    case 'init':
      await handleInit(args);
      break;
    case 'status':
    case 's':
      await handleStatus(args);
      break;
    case 'agents':
      await handleAgents();
      break;
    case 'workflows':
      await handleWorkflows();
      break;
    case 'config':
      await handleConfig(args);
      break;
    case 'serve':
      await handleServe(args);
      break;
    case 'web':
      await handleWeb(args);
      break;
    case 'stop':
      await handleStop();
      break;
    case 'cancel':
      await handleCancel(args);
      break;
    case 'retry':
      await handleRetry(args);
      break;
    case 'resume':
      await handleResume(args);
      break;
    case 'logs':
    case 'log':
      await handleLogs(args);
      break;
    case 'session':
      await handleSession(args);
      break;
    case 'compact':
      await handleCompact();
      break;
    case 'verbose':
      await handleVerbose();
      break;
    case 'preview':
    case 'p':
      await handlePreview(args);
      break;
    case 'thoughts':
      await handleThoughts(args);
      break;
    default:
      ctx.app?.addMessage({
        type: 'error',
        content: `Unknown command: ${command}. Type /help for available commands.`,
      });
  }
}

// ============================================================================
// Auto-Start Services
// ============================================================================

async function checkAutoStart(): Promise<void> {
  if (!ctx.config) return;

  const effective = getEffectiveConfig(ctx.config);
  const apiConfig = effective.api as { autoStart?: boolean; port?: number };
  const webUIConfig = (effective as { webUI?: { autoStart?: boolean; port?: number } }).webUI;

  if (apiConfig?.autoStart) {
    try {
      const port = apiConfig.port || 3000;
      const apiPath = path.resolve(__dirname, '../../api');

      const proc = spawn('node', [path.join(apiPath, 'dist/index.js')], {
        cwd: ctx.cwd,
        env: {
          ...process.env,
          PORT: port.toString(),
          APEX_PROJECT: ctx.cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });
      proc.unref();
      ctx.apiProcess = proc;
      ctx.apiPort = port;
      ctx.app?.updateState({ apiUrl: `http://localhost:${port}` });
    } catch {
      // Ignore errors - port might be in use
    }
  }

  if (webUIConfig?.autoStart) {
    const webUIPath = path.resolve(__dirname, '../../web-ui');
    try {
      await fs.access(webUIPath);
      const apiUrl = ctx.config?.api?.url || `http://localhost:${ctx.apiPort}`;
      const port = webUIConfig.port || 3001;

      const proc = spawn('npx', ['next', 'dev', '-p', port.toString()], {
        cwd: webUIPath,
        env: { ...process.env, PORT: port.toString(), NEXT_PUBLIC_APEX_API_URL: apiUrl },
        stdio: 'ignore',
        detached: true,
      });
      proc.unref();
      ctx.webUIProcess = proc;
      ctx.webUIPort = port;
      ctx.app?.updateState({ webUrl: `http://localhost:${port}` });
    } catch {
      // Ignore errors
    }
  }
}

// ============================================================================
// Console Utilities
// ============================================================================

/**
 * Clear the console screen
 */
function clearConsole(): void {
  // ANSI escape codes to clear screen and move cursor to top-left
  process.stdout.write('\x1b[2J\x1b[H');
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function startInkREPL(): Promise<void> {
  // Clear console on startup for clean UI
  clearConsole();

  // Initialize context
  ctx.initialized = await isApexInitialized(ctx.cwd);

  if (ctx.initialized) {
    try {
      ctx.config = await loadConfig(ctx.cwd);
      ctx.orchestrator = new ApexOrchestrator({ projectPath: ctx.cwd });
      await ctx.orchestrator.initialize();

      // Set up orchestrator event listeners for subtask progress tracking
      ctx.orchestrator.on('subtask:created', (subtask, parentTaskId) => {
        // Update subtask progress in app state
        const currentProgress = ctx.app?.getState()?.subtaskProgress || { completed: 0, total: 0 };
        ctx.app?.updateState({
          subtaskProgress: { completed: currentProgress.completed, total: currentProgress.total + 1 },
        });
      });

      ctx.orchestrator.on('subtask:completed', (subtask, parentTaskId) => {
        // Update subtask progress in app state
        const currentProgress = ctx.app?.getState()?.subtaskProgress || { completed: 0, total: 0 };
        ctx.app?.updateState({
          subtaskProgress: { completed: currentProgress.completed + 1, total: currentProgress.total },
        });
      });

      ctx.orchestrator.on('task:started', (task) => {
        // Reset subtask progress when a new task starts
        ctx.app?.updateState({
          subtaskProgress: { completed: 0, total: 0 },
        });
      });

      ctx.orchestrator.on('task:completed', (task) => {
        // Clear subtask progress and agent state when task completes
        ctx.app?.updateState({
          subtaskProgress: undefined,
          previousAgent: undefined,
          parallelAgents: [],
          showParallelPanel: false,
        });
      });

      ctx.orchestrator.on('task:failed', (task, error) => {
        // Clear subtask progress and agent state when task fails
        ctx.app?.updateState({
          subtaskProgress: undefined,
          previousAgent: undefined,
          parallelAgents: [],
          showParallelPanel: false,
        });
      });

      // Handle task paused events (rate limits, etc.)
      ctx.orchestrator.on('task:paused', (task, reason) => {
        const resumeInfo = task.resumeAfter
          ? `Will auto-resume at ${task.resumeAfter.toLocaleTimeString()}.`
          : 'Use /resume to continue.';

        ctx.app?.addMessage({
          type: 'system',
          content: `Task ${task.id.slice(0, 12)} paused (${reason}). ${resumeInfo}`,
        });

        // Clear current task since it's now paused
        ctx.app?.updateState({
          currentTask: undefined,
          activeAgent: undefined,
        });
      });

      // Stream agent messages to the UI in real-time
      ctx.orchestrator.on('agent:message', (taskId, message) => {
        // Extract text content from the message
        let textContent = '';

        if (message && typeof message === 'object') {
          const msg = message as Record<string, unknown>;

          if (msg.type === 'assistant' && msg.message && typeof msg.message === 'object') {
            // Assistant messages have content as array of blocks
            const apiMessage = msg.message as { content?: Array<{ type: string; text?: string }> };
            if (Array.isArray(apiMessage.content)) {
              for (const block of apiMessage.content) {
                if (block.type === 'text' && block.text) {
                  textContent += block.text;
                }
              }
            }
          } else if (msg.type === 'result' && typeof msg.result === 'string') {
            textContent = msg.result;
          }
        }

        // Only display non-empty text content
        if (textContent.trim().length > 0) {
          // Truncate very long messages for display
          const displayText = textContent.length > 1000
            ? textContent.substring(0, 1000) + '...'
            : textContent;

          ctx.app?.addMessage({
            type: 'assistant',
            content: displayText,
          });
        }
      });

      // Stream agent thinking to the UI
      ctx.orchestrator.on('agent:thinking', (taskId, agent, thinking) => {
        // Add thinking content as a separate message type
        ctx.app?.addMessage({
          type: 'assistant',
          content: '', // No visible content, thinking is stored separately
          agent,
          thinking,
        });
      });

      // Stream tool use events to the UI
      ctx.orchestrator.on('agent:tool-use', (taskId, tool, input) => {
        // Display tool usage in a compact format
        const toolDisplay = typeof input === 'object' && input !== null
          ? `${tool}: ${JSON.stringify(input).substring(0, 100)}${JSON.stringify(input).length > 100 ? '...' : ''}`
          : `${tool}`;

        ctx.app?.addMessage({
          type: 'system',
          content: `Tool: ${toolDisplay}`,
        });
      });

      // Update token/cost display in real-time
      ctx.orchestrator.on('usage:updated', (taskId, usage) => {
        ctx.app?.updateState({
          tokens: { input: usage.inputTokens, output: usage.outputTokens },
          cost: usage.estimatedCost,
        });
      });

      // Track agent transitions for handoff animation
      ctx.orchestrator.on('task:stage-changed', async (task, stageName) => {
        // Look up the agent for this stage from the workflow
        try {
          const { loadWorkflow } = await import('@apexcli/core');
          const workflow = await loadWorkflow(ctx.cwd, task.workflow);
          const stage = workflow?.stages.find(s => s.name === stageName);

          if (stage?.agent) {
            const currentState = ctx.app?.getState();
            ctx.app?.updateState({
              previousAgent: currentState?.activeAgent,  // Save current as previous
              activeAgent: stage.agent,                   // Set new current
            });
          }
        } catch (error) {
          // Gracefully handle workflow lookup failures
          console.warn(`Failed to lookup workflow for agent transition: ${error}`);
        }
      });

      // Track parallel execution
      ctx.orchestrator.on('stage:parallel-started', (taskId, stages, agents) => {
        const parallelAgents = agents.map(name => ({
          name,
          status: 'parallel' as const,
          stage: stages[agents.indexOf(name)] || undefined,
        }));

        ctx.app?.updateState({
          parallelAgents,
          showParallelPanel: parallelAgents.length > 1,
        });
      });

      ctx.orchestrator.on('stage:parallel-completed', (taskId) => {
        ctx.app?.updateState({
          parallelAgents: [],
          showParallelPanel: false,
        });
      });

      // Aggregate verbose debug data from orchestrator events
      let currentVerboseData: VerboseDebugData | undefined;
      let stageStartTime: Date | undefined;

      // Helper to initialize verbose data for a task
      const initializeVerboseData = () => {
        currentVerboseData = {
          agentTokens: {},
          timing: {
            stageStartTime: new Date(),
            agentResponseTimes: {},
            toolUsageTimes: {},
          },
          agentDebug: {
            conversationLength: {},
            toolCallCounts: {},
            errorCounts: {},
            retryAttempts: {},
          },
          metrics: {
            tokensPerSecond: 0,
            averageResponseTime: 0,
            toolEfficiency: {},
          },
        };
        stageStartTime = new Date();
      };

      // Helper to calculate performance metrics
      const updatePerformanceMetrics = () => {
        if (!currentVerboseData) return;

        const agents = Object.keys(currentVerboseData.agentTokens);
        const responseTimes = Object.values(currentVerboseData.timing.agentResponseTimes);

        if (responseTimes.length > 0) {
          currentVerboseData.metrics.averageResponseTime =
            responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        }

        // Calculate tokens per second based on total tokens and elapsed time
        const totalTokens = agents.reduce((sum, agent) => {
          const usage = currentVerboseData!.agentTokens[agent];
          return sum + usage.inputTokens + usage.outputTokens;
        }, 0);

        if (stageStartTime && totalTokens > 0) {
          const elapsedSeconds = (Date.now() - stageStartTime.getTime()) / 1000;
          currentVerboseData.metrics.tokensPerSecond = elapsedSeconds > 0 ? totalTokens / elapsedSeconds : 0;
        }

        // Calculate tool efficiency based on usage vs errors
        Object.keys(currentVerboseData.timing.toolUsageTimes).forEach(tool => {
          const errorCounts = Object.values(currentVerboseData!.agentDebug.errorCounts).reduce((sum, count) => sum + count, 0);
          const toolUsages = Object.values(currentVerboseData!.agentDebug.toolCallCounts).reduce((sum, toolCounts) =>
            sum + (toolCounts[tool] || 0), 0);
          currentVerboseData!.metrics.toolEfficiency[tool] = toolUsages > 0 ? 1 - (errorCounts / toolUsages) : 1;
        });
      };

      // Track task lifecycle for verbose data
      ctx.orchestrator.on('task:started', (task) => {
        initializeVerboseData();
        ctx.app?.updateState({ verboseData: currentVerboseData });
      });

      ctx.orchestrator.on('task:stage-changed', (task, stageName) => {
        if (currentVerboseData) {
          // Complete previous stage timing
          const now = new Date();
          if (stageStartTime) {
            currentVerboseData.timing.stageEndTime = now;
            currentVerboseData.timing.stageDuration = now.getTime() - stageStartTime.getTime();
          }
          // Start new stage
          stageStartTime = now;
          currentVerboseData.timing.stageStartTime = now;
          updatePerformanceMetrics();
          ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
        }
      });

      // Track agent token usage
      ctx.orchestrator.on('usage:updated', (taskId, usage) => {
        if (currentVerboseData && ctx.app?.getState()?.activeAgent) {
          const agent = ctx.app.getState()?.activeAgent || 'unknown';
          currentVerboseData.agentTokens[agent] = {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            estimatedCost: usage.estimatedCost,
          };
          updatePerformanceMetrics();
          ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
        }
      });

      // Track agent response times and tool usage
      const agentResponseStartTimes = new Map<string, number>();
      const toolUsageStartTimes = new Map<string, number>();

      ctx.orchestrator.on('agent:message', (taskId, message) => {
        if (currentVerboseData && ctx.app?.getState()?.activeAgent) {
          const agent = ctx.app.getState()?.activeAgent || 'unknown';
          const endTime = Date.now();
          const startTime = agentResponseStartTimes.get(agent);

          if (startTime) {
            currentVerboseData.timing.agentResponseTimes[agent] = endTime - startTime;
            agentResponseStartTimes.delete(agent);
          }

          // Update conversation length
          currentVerboseData.agentDebug.conversationLength[agent] =
            (currentVerboseData.agentDebug.conversationLength[agent] || 0) + 1;

          updatePerformanceMetrics();
          ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
        }
      });

      ctx.orchestrator.on('agent:thinking', (taskId, agent, thinking) => {
        // Mark agent response start time
        agentResponseStartTimes.set(agent, Date.now());
      });

      ctx.orchestrator.on('agent:tool-use', (taskId, tool, input) => {
        if (currentVerboseData && ctx.app?.getState()?.activeAgent) {
          const agent = ctx.app.getState()?.activeAgent || 'unknown';

          // Track tool usage start time
          toolUsageStartTimes.set(tool, Date.now());

          // Update tool call counts
          if (!currentVerboseData.agentDebug.toolCallCounts[agent]) {
            currentVerboseData.agentDebug.toolCallCounts[agent] = {};
          }
          currentVerboseData.agentDebug.toolCallCounts[agent][tool] =
            (currentVerboseData.agentDebug.toolCallCounts[agent][tool] || 0) + 1;

          ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
        }
      });

      // Track task completion/failure for final metrics
      ctx.orchestrator.on('task:completed', (task) => {
        if (currentVerboseData) {
          const now = new Date();
          if (stageStartTime) {
            currentVerboseData.timing.stageEndTime = now;
            currentVerboseData.timing.stageDuration = now.getTime() - stageStartTime.getTime();
          }
          updatePerformanceMetrics();
          ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
        }
      });

      ctx.orchestrator.on('task:failed', (task, error) => {
        if (currentVerboseData && ctx.app?.getState()?.activeAgent) {
          const agent = ctx.app.getState()?.activeAgent || 'unknown';
          currentVerboseData.agentDebug.errorCounts[agent] =
            (currentVerboseData.agentDebug.errorCounts[agent] || 0) + 1;
          updatePerformanceMetrics();
          ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
        }
      });

      // Initialize session management
      ctx.sessionStore = new SessionStore(ctx.cwd);
      await ctx.sessionStore.initialize();
      ctx.sessionAutoSaver = new SessionAutoSaver(ctx.sessionStore);

      // Initialize conversation management
      ctx.conversationManager = new ConversationManager();

      // Try to restore the last active session or create a new one
      const activeSessionId = await ctx.sessionStore.getActiveSessionId();
      await ctx.sessionAutoSaver.start(activeSessionId || undefined);

      await checkAutoStart();
    } catch {
      // Ignore initialization errors
    }
  }

  const gitBranch = getGitBranch();

  // Start the Ink app
  ctx.app = await startInkApp({
    projectPath: ctx.cwd,
    initialized: ctx.initialized,
    config: ctx.config,
    orchestrator: ctx.orchestrator,
    gitBranch,
    onCommand: handleCommand,
    onTask: executeTask,
    onExit: async () => {
      if (ctx.sessionAutoSaver) {
        await ctx.sessionAutoSaver.stop();
      }
      cleanupProcesses();
    },
  });

  // Update session info in app state after app is started
  if (ctx.initialized && ctx.sessionAutoSaver) {
    const session = ctx.sessionAutoSaver.getSession();
    if (session) {
      ctx.app.updateState({
        sessionStartTime: session.createdAt,
        sessionName: session.name,
      });
    }
  }

  // Handle process signals for cleanup
  process.on('SIGINT', async () => {
    if (ctx.sessionAutoSaver) {
      await ctx.sessionAutoSaver.stop();
    }
    cleanupProcesses();
    clearConsole();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    if (ctx.sessionAutoSaver) {
      await ctx.sessionAutoSaver.stop();
    }
    cleanupProcesses();
    clearConsole();
    process.exit(0);
  });

  // Wait for the app to exit
  await ctx.app.waitUntilExit();

  // Final cleanup and clear console
  if (ctx.sessionAutoSaver) {
    await ctx.sessionAutoSaver.stop();
  }
  cleanupProcesses();
  clearConsole();
}

/**
 * Kill a process listening on a specific port
 */
function killProcessOnPort(port: number): void {
  try {
    // Get PID of process listening on port (works on macOS and Linux)
    const result = execSync(`lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf-8' });
    const pids = result.trim().split('\n').filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(parseInt(pid, 10), 'SIGTERM');
      } catch {
        // Process already dead
      }
    }
  } catch {
    // lsof not available or other error
  }
}

/**
 * Kill spawned processes (API server, Web UI)
 */
function cleanupProcesses(): void {
  // Kill API process by reference
  if (ctx.apiProcess && ctx.apiProcess.pid) {
    try {
      // Kill the process group (negative PID) for detached processes
      process.kill(-ctx.apiProcess.pid, 'SIGTERM');
    } catch {
      try {
        ctx.apiProcess.kill('SIGTERM');
      } catch {
        // Process already dead
      }
    }
    ctx.apiProcess = null;
  }

  // Kill Web UI process by reference
  if (ctx.webUIProcess && ctx.webUIProcess.pid) {
    try {
      // Kill the process group (negative PID) for detached processes
      process.kill(-ctx.webUIProcess.pid, 'SIGTERM');
    } catch {
      try {
        ctx.webUIProcess.kill('SIGTERM');
      } catch {
        // Process already dead
      }
    }
    ctx.webUIProcess = null;
  }

  // Fallback: Kill any orphaned APEX processes by port
  // This handles cases where process references were lost (crash, new session)
  if (ctx.apiPort) {
    killProcessOnPort(ctx.apiPort);
    ctx.apiPort = undefined;
  }
  if (ctx.webUIPort) {
    killProcessOnPort(ctx.webUIPort);
    ctx.webUIPort = undefined;
  }
}
