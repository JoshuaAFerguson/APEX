#!/usr/bin/env node

import chalk from 'chalk';
import boxen from 'boxen';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
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
import { startServer } from '@apexcli/api';

const VERSION = '0.1.0';

// ASCII Art Banner
const banner = `
   █████╗ ██████╗ ███████╗██╗  ██╗
  ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝
  ███████║██████╔╝█████╗   ╚███╔╝
  ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗
  ██║  ██║██║     ███████╗██╔╝ ██╗
  ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝
  Autonomous Product Engineering eXecutor
`;

// ============================================================================
// Types
// ============================================================================

interface ApexContext {
  cwd: string;
  initialized: boolean;
  config: ApexConfig | null;
  orchestrator: ApexOrchestrator | null;
  apiProcess: ChildProcess | null;
  webUIProcess: ChildProcess | null;
  apiPort: number;
  webUIPort: number;
}

interface Command {
  name: string;
  aliases: string[];
  description: string;
  usage?: string;
  handler: (ctx: ApexContext, args: string[]) => Promise<void>;
}

// ============================================================================
// Global Context
// ============================================================================

const ctx: ApexContext = {
  cwd: process.cwd(),
  initialized: false,
  config: null,
  orchestrator: null,
  apiProcess: null,
  webUIProcess: null,
  apiPort: 3000,
  webUIPort: 3001,
};

// ============================================================================
// Commands
// ============================================================================

const commands: Command[] = [
  {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    handler: async () => {
      console.log(chalk.cyan('\nAvailable Commands:\n'));

      const maxNameLen = Math.max(...commands.map(c => c.name.length));

      for (const cmd of commands) {
        const aliases = cmd.aliases.length > 0 ? chalk.gray(` (${cmd.aliases.join(', ')})`) : '';
        const padding = ' '.repeat(maxNameLen - cmd.name.length + 2);
        console.log(`  ${chalk.yellow('/' + cmd.name)}${aliases}${padding}${cmd.description}`);
      }

      console.log(chalk.gray('\nOr just type a natural language task description to execute it.\n'));
    },
  },

  {
    name: 'init',
    aliases: [],
    description: 'Initialize APEX in the current project',
    usage: '/init [--yes] [--name <name>] [--language <lang>] [--framework <fw>]',
    handler: async (ctx, args) => {
      if (ctx.initialized) {
        console.log(chalk.yellow('APEX is already initialized in this directory.'));
        return;
      }

      // Parse args
      let projectName = path.basename(ctx.cwd);
      let language: string | undefined;
      let framework: string | undefined;
      let skipPrompts = false;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--name' || args[i] === '-n') {
          projectName = args[++i];
        } else if (args[i] === '--language' || args[i] === '-l') {
          language = args[++i];
        } else if (args[i] === '--framework' || args[i] === '-f') {
          framework = args[++i];
        } else if (args[i] === '--yes' || args[i] === '-y') {
          skipPrompts = true;
        }
      }

      console.log(chalk.cyan('\nInitializing APEX...\n'));

      try {
        await initializeApex(ctx.cwd, { projectName, language, framework });
        await copyDefaultAgents(ctx.cwd);
        await copyDefaultWorkflows(ctx.cwd);
        await createHelperScripts(ctx.cwd);

        ctx.initialized = true;
        ctx.config = await loadConfig(ctx.cwd);
        ctx.orchestrator = new ApexOrchestrator({ projectPath: ctx.cwd });
        await ctx.orchestrator.initialize();

        console.log(chalk.green('✓ APEX initialized successfully!\n'));
        console.log(chalk.gray(`  Configuration: .apex/config.yaml`));
        console.log(chalk.gray(`  Agents: .apex/agents/`));
        console.log(chalk.gray(`  Workflows: .apex/workflows/\n`));

        // Check if auto-start is configured
        await checkAutoStart(ctx);
      } catch (error) {
        console.error(chalk.red(`Failed to initialize: ${(error as Error).message}`));
      }
    },
  },

  {
    name: 'status',
    aliases: ['s'],
    description: 'Show task status',
    usage: '/status [task_id]',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      const taskId = args[0];

      if (taskId) {
        const task = await ctx.orchestrator.getTask(taskId);
        if (!task) {
          console.log(chalk.red(`Task not found: ${taskId}`));
          return;
        }

        console.log(chalk.cyan(`\nTask: ${task.id}`));
        console.log(`Status: ${getStatusEmoji(task.status)} ${task.status}`);
        console.log(`Description: ${task.description}`);
        console.log(`Workflow: ${task.workflow}`);
        console.log(`Branch: ${task.branchName || 'N/A'}`);
        console.log(`Created: ${task.createdAt.toLocaleString()}`);
        console.log(`Tokens: ${formatTokens(task.usage.totalTokens)}`);
        console.log(`Cost: ${formatCost(task.usage.estimatedCost)}`);

        if (task.error) {
          console.log(chalk.red(`Error: ${task.error}`));
        }
      } else {
        const tasks = await ctx.orchestrator.listTasks({ limit: 10 });

        if (tasks.length === 0) {
          console.log(chalk.gray('\nNo tasks found.\n'));
          return;
        }

        console.log(chalk.cyan('\nRecent Tasks:\n'));

        for (const task of tasks) {
          const status = `${getStatusEmoji(task.status)} ${task.status.padEnd(12)}`;
          const cost = formatCost(task.usage.estimatedCost).padStart(10);
          console.log(
            `  ${chalk.gray(task.id.substring(0, 16))} ${status} ${cost}  ${task.description.substring(0, 50)}`
          );
        }
        console.log();
      }
    },
  },

  {
    name: 'agents',
    aliases: ['a'],
    description: 'List available agents',
    handler: async (ctx) => {
      if (!ctx.initialized) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      const agents = await loadAgents(ctx.cwd);
      const config = ctx.config!;

      console.log(chalk.cyan('\nAvailable Agents:\n'));

      for (const [name, agent] of Object.entries(agents)) {
        const enabled = !config.agents?.disabled?.includes(name);
        const status = enabled ? chalk.green('✓') : chalk.red('✗');
        const model = agent.model || 'sonnet';
        const tools = agent.tools?.join(', ') || 'all';

        console.log(`  ${status} ${chalk.bold(name)} (${model})`);
        console.log(`    ${chalk.gray(agent.description)}`);
        console.log(`    ${chalk.gray(`Tools: ${tools}`)}\n`);
      }
    },
  },

  {
    name: 'workflows',
    aliases: ['w'],
    description: 'List available workflows',
    handler: async (ctx) => {
      if (!ctx.initialized) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      const workflows = await loadWorkflows(ctx.cwd);

      console.log(chalk.cyan('\nAvailable Workflows:\n'));

      for (const [name, workflow] of Object.entries(workflows)) {
        console.log(`  ${chalk.bold(name)}`);
        console.log(`    ${chalk.gray(workflow.description)}`);
        console.log(`    Stages: ${workflow.stages.map(s => s.name).join(' → ')}\n`);
      }
    },
  },

  {
    name: 'config',
    aliases: ['c'],
    description: 'View or edit configuration',
    usage: '/config [--json] [--get <key>] [--set <key>=<value>]',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.config) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      // Parse flags
      let outputJson = false;
      let getKey: string | null = null;
      let setKeyValue: string | null = null;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--json') {
          outputJson = true;
        } else if (args[i] === '--get' && args[i + 1]) {
          getKey = args[++i];
        } else if (args[i] === '--set' && args[i + 1]) {
          setKeyValue = args[++i];
        } else if (args[i] === 'get' && args[i + 1]) {
          getKey = args[++i];
        } else if (args[i] === 'set' && args[i + 1]) {
          setKeyValue = args[++i];
        }
      }

      if (getKey) {
        const keys = getKey.split('.');
        let current: unknown = ctx.config;

        for (const k of keys) {
          if (current && typeof current === 'object' && k in current) {
            current = (current as Record<string, unknown>)[k];
          } else {
            console.log(chalk.red(`Key not found: ${getKey}`));
            return;
          }
        }

        console.log(current);
        return;
      }

      if (setKeyValue) {
        const [key, value] = setKeyValue.split('=');
        if (!key || value === undefined) {
          console.log(chalk.red('Invalid format. Use: /config set key=value'));
          return;
        }

        const keys = key.split('.');
        let current: Record<string, unknown> = ctx.config as unknown as Record<string, unknown>;

        for (let i = 0; i < keys.length - 1; i++) {
          if (!(keys[i] in current)) {
            current[keys[i]] = {};
          }
          current = current[keys[i]] as Record<string, unknown>;
        }

        let parsedValue: unknown = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);

        current[keys[keys.length - 1]] = parsedValue;

        await saveConfig(ctx.cwd, ctx.config);
        console.log(chalk.green(`Set ${key} = ${value}`));
        return;
      }

      // Show config
      if (outputJson) {
        console.log(JSON.stringify(ctx.config, null, 2));
        return;
      }

      const effective = getEffectiveConfig(ctx.config);

      console.log(chalk.cyan('\nAPEX Configuration\n'));

      console.log(chalk.bold('Project:'));
      console.log(`  Name: ${effective.project.name}`);
      if (effective.project.language) console.log(`  Language: ${effective.project.language}`);
      if (effective.project.framework) console.log(`  Framework: ${effective.project.framework}`);

      console.log(chalk.bold('\nAutonomy:'));
      console.log(`  Default: ${effective.autonomy.default}`);

      console.log(chalk.bold('\nModels:'));
      console.log(`  Planning: ${effective.models.planning}`);
      console.log(`  Implementation: ${effective.models.implementation}`);
      console.log(`  Review: ${effective.models.review}`);

      console.log(chalk.bold('\nLimits:'));
      console.log(`  Max Tokens/Task: ${formatTokens(effective.limits.maxTokensPerTask)}`);
      console.log(`  Max Cost/Task: ${formatCost(effective.limits.maxCostPerTask)}`);
      console.log(`  Daily Budget: ${formatCost(effective.limits.dailyBudget)}`);

      console.log(chalk.bold('\nAPI:'));
      console.log(`  URL: ${effective.api.url}`);
      console.log(`  Port: ${effective.api.port}`);
      console.log(`  Auto-start: ${(effective.api as any).autoStart ? 'yes' : 'no'}`);

      const webUIConfig = (effective as any).webUI || {};
      console.log(chalk.bold('\nWeb UI:'));
      console.log(`  Port: ${webUIConfig.port || 3001}`);
      console.log(`  Auto-start: ${webUIConfig.autoStart ? 'yes' : 'no'}`);

      console.log(chalk.bold('\nServers:'));
      console.log(`  API: ${ctx.apiProcess ? chalk.green('running') : chalk.gray('stopped')}`);
      console.log(`  Web UI: ${ctx.webUIProcess ? chalk.green('running') : chalk.gray('stopped')}`);

      console.log();
    },
  },

  {
    name: 'logs',
    aliases: ['l'],
    description: 'Show task logs',
    usage: '/logs <task_id>',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      const taskId = args[0];
      if (!taskId) {
        console.log(chalk.red('Usage: /logs <task_id>'));
        return;
      }

      const task = await ctx.orchestrator.getTask(taskId);
      if (!task) {
        console.log(chalk.red(`Task not found: ${taskId}`));
        return;
      }

      console.log(chalk.cyan(`\nLogs for task: ${taskId}\n`));

      for (const log of task.logs) {
        const level = getLevelColor(log.level);
        const time = log.timestamp.toLocaleTimeString();
        const agent = log.agent ? `[${log.agent}]` : '';

        console.log(`${chalk.gray(time)} ${level} ${agent} ${log.message}`);
      }
      console.log();
    },
  },

  {
    name: 'cancel',
    aliases: [],
    description: 'Cancel a running task',
    usage: '/cancel <task_id>',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      const taskId = args[0];
      if (!taskId) {
        console.log(chalk.red('Usage: /cancel <task_id>'));
        return;
      }

      const success = await ctx.orchestrator.cancelTask(taskId);
      if (success) {
        console.log(chalk.green(`Task ${taskId} cancelled.`));
      } else {
        console.log(chalk.yellow('Could not cancel task. It may be already completed or not found.'));
      }
    },
  },

  {
    name: 'retry',
    aliases: [],
    description: 'Retry a failed task',
    usage: '/retry <task_id>',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      const taskId = args[0];
      if (!taskId) {
        console.log(chalk.red('Usage: /retry <task_id>'));
        return;
      }

      const originalTask = await ctx.orchestrator.getTask(taskId);
      if (!originalTask) {
        console.log(chalk.red(`Task not found: ${taskId}`));
        return;
      }

      if (originalTask.status !== 'failed' && originalTask.status !== 'cancelled') {
        console.log(chalk.yellow(`Task is ${originalTask.status}. Only failed or cancelled tasks can be retried.`));
        return;
      }

      console.log(chalk.cyan('\nRetrying task...\n'));

      const newTask = await ctx.orchestrator.createTask({
        description: originalTask.description,
        acceptanceCriteria: originalTask.acceptanceCriteria,
        workflow: originalTask.workflow,
        autonomy: originalTask.autonomy,
      });

      console.log(chalk.green(`New task created: ${newTask.id}`));

      // Execute in background
      executeTaskWithOutput(ctx, newTask.id);
    },
  },

  {
    name: 'serve',
    aliases: [],
    description: 'Start the API server',
    usage: '/serve [--port <port>]',
    handler: async (ctx, args) => {
      if (!ctx.initialized) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      if (ctx.apiProcess) {
        console.log(chalk.yellow('API server is already running.'));
        return;
      }

      let port = ctx.apiPort;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      await startAPIServer(ctx, port);
    },
  },

  {
    name: 'web',
    aliases: [],
    description: 'Start the Web UI server',
    usage: '/web [--port <port>]',
    handler: async (ctx, args) => {
      if (!ctx.initialized) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      if (ctx.webUIProcess) {
        console.log(chalk.yellow('Web UI is already running.'));
        return;
      }

      let port = ctx.webUIPort;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      await startWebUI(ctx, port);
    },
  },

  {
    name: 'stop',
    aliases: [],
    description: 'Stop background servers',
    usage: '/stop [api|web|all]',
    handler: async (ctx, args) => {
      const target = args[0] || 'all';

      if (target === 'api' || target === 'all') {
        if (ctx.apiProcess) {
          ctx.apiProcess.kill();
          ctx.apiProcess = null;
          console.log(chalk.green('API server stopped.'));
        } else if (target === 'api') {
          console.log(chalk.gray('API server is not running.'));
        }
      }

      if (target === 'web' || target === 'all') {
        if (ctx.webUIProcess) {
          ctx.webUIProcess.kill();
          ctx.webUIProcess = null;
          console.log(chalk.green('Web UI stopped.'));
        } else if (target === 'web') {
          console.log(chalk.gray('Web UI is not running.'));
        }
      }
    },
  },

  {
    name: 'pr',
    aliases: [],
    description: 'Create a pull request for a completed task',
    usage: '/pr <task_id> [--draft]',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      const taskId = args[0];
      if (!taskId) {
        console.log(chalk.red('Usage: /pr <task_id>'));
        return;
      }

      const isDraft = args.includes('--draft') || args.includes('-d');

      const task = await ctx.orchestrator.getTask(taskId);
      if (!task) {
        console.log(chalk.red(`Task not found: ${taskId}`));
        return;
      }

      if (task.status !== 'completed') {
        console.log(chalk.yellow(`Task is ${task.status}. PRs can only be created for completed tasks.`));
        return;
      }

      if (task.prUrl) {
        console.log(chalk.yellow(`PR already exists: ${task.prUrl}`));
        return;
      }

      console.log(chalk.cyan('\nCreating pull request...\n'));

      const result = await ctx.orchestrator.createPullRequest(taskId, { draft: isDraft });

      if (result.success) {
        console.log(chalk.green(`✓ PR created: ${result.prUrl}`));
      } else {
        console.log(chalk.red(`Failed: ${result.error}`));
      }
    },
  },

  {
    name: 'run',
    aliases: ['r'],
    description: 'Run a task with specific options',
    usage: '/run "<description>" [--workflow <name>] [--autonomy <level>]',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      // Parse description (handle quoted strings)
      let description = '';
      let workflow = 'feature';
      let autonomy: string | undefined;
      let priority: string | undefined;

      let i = 0;
      // Check if first arg is a quoted string
      if (args[0]?.startsWith('"')) {
        const parts: string[] = [];
        while (i < args.length) {
          parts.push(args[i]);
          if (args[i].endsWith('"')) {
            i++;
            break;
          }
          i++;
        }
        description = parts.join(' ').replace(/^"|"$/g, '');
      } else {
        description = args[i++] || '';
      }

      // Parse remaining options
      while (i < args.length) {
        if (args[i] === '--workflow' || args[i] === '-w') {
          workflow = args[++i];
        } else if (args[i] === '--autonomy' || args[i] === '-a') {
          autonomy = args[++i];
        } else if (args[i] === '--priority' || args[i] === '-p') {
          priority = args[++i];
        } else if (!description) {
          description = args[i];
        }
        i++;
      }

      if (!description) {
        console.log(chalk.red('Usage: /run "<description>" [--workflow <name>]'));
        return;
      }

      await executeTask(ctx, description, { workflow, autonomy, priority });
    },
  },

  {
    name: 'clear',
    aliases: ['cls'],
    description: 'Clear the screen',
    handler: async () => {
      console.clear();
    },
  },

  {
    name: 'exit',
    aliases: ['quit', 'q'],
    description: 'Exit APEX',
    handler: async (ctx) => {
      console.log(chalk.cyan('\nShutting down...\n'));

      if (ctx.apiProcess) {
        ctx.apiProcess.kill();
      }
      if (ctx.webUIProcess) {
        ctx.webUIProcess.kill();
      }

      process.exit(0);
    },
  },

  {
    name: 'version',
    aliases: ['v'],
    description: 'Show version',
    handler: async () => {
      console.log(`APEX v${VERSION}`);
    },
  },

  {
    name: 'thoughts',
    aliases: ['t'],
    description: 'Toggle thought visibility',
    usage: '/thoughts [on|off|toggle|status]',
    handler: async (ctx, args) => {
      // Note: In classic CLI mode, this command has limited functionality
      // as the classic mode doesn't have the same state management as the Ink UI
      const action = args[0]?.toLowerCase();

      switch (action) {
        case 'on':
          console.log(chalk.green('✓ Thought visibility enabled (Note: Classic CLI has limited thought display)'));
          break;
        case 'off':
          console.log(chalk.green('✓ Thought visibility disabled'));
          break;
        case 'status':
          console.log(chalk.gray('Thought visibility status is managed per session in Ink UI mode'));
          break;
        case 'toggle':
        case undefined:
          console.log(chalk.blue('💭 Thought visibility toggled (Use --classic flag for rich UI)'));
          break;
        default:
          console.log(chalk.red('Usage: /thoughts [on|off|toggle|status]'));
      }
    },
  },
];

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(
  ctx: ApexContext,
  description: string,
  options: { workflow?: string; autonomy?: string; priority?: string } = {}
): Promise<void> {
  if (!ctx.orchestrator) return;

  console.log(chalk.cyan('\n🚀 Starting task...\n'));

  const task = await ctx.orchestrator.createTask({
    description,
    workflow: options.workflow || 'feature',
    autonomy: options.autonomy as any,
    priority: options.priority as any,
  });

  console.log(chalk.green(`Task created: ${task.id}`));
  console.log(chalk.gray(`Branch: ${task.branchName}`));
  console.log(chalk.gray(`Workflow: ${task.workflow}\n`));

  await executeTaskWithOutput(ctx, task.id);
}

async function executeTaskWithOutput(ctx: ApexContext, taskId: string): Promise<void> {
  if (!ctx.orchestrator) return;

  // Set up event handlers
  const stageHandler = (task: any, stage: string) => {
    if (task.id === taskId) {
      console.log(chalk.blue(`\n📍 Stage: ${stage}`));
    }
  };

  const toolHandler = (tId: string, tool: string) => {
    if (tId === taskId) {
      console.log(chalk.gray(`  🔧 ${tool}`));
    }
  };

  ctx.orchestrator.on('task:stage-changed', stageHandler);
  ctx.orchestrator.on('agent:tool-use', toolHandler);

  try {
    await ctx.orchestrator.executeTask(taskId);

    const completedTask = await ctx.orchestrator.getTask(taskId);
    if (completedTask) {
      console.log(
        boxen(
          `${chalk.green('✅ Task Completed')}\n\n` +
            `Tokens: ${formatTokens(completedTask.usage.totalTokens)}\n` +
            `Cost: ${formatCost(completedTask.usage.estimatedCost)}\n` +
            `Duration: ${formatDuration(Date.now() - completedTask.createdAt.getTime())}`,
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        )
      );
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Task failed: ${(error as Error).message}\n`));
  } finally {
    ctx.orchestrator.off('task:stage-changed', stageHandler);
    ctx.orchestrator.off('agent:tool-use', toolHandler);
  }
}

// ============================================================================
// Server Management
// ============================================================================

async function startAPIServer(ctx: ApexContext, port: number, silent: boolean = false): Promise<void> {
  if (!silent) {
    console.log(chalk.cyan(`Starting API server on port ${port}...`));
  }

  try {
    await startServer({ projectPath: ctx.cwd, port, host: '0.0.0.0', silent });
    ctx.apiPort = port;

    if (!silent) {
      console.log(chalk.green(`✓ API server running at http://localhost:${port}`));
    }
  } catch (error) {
    console.error(chalk.red(`Failed to start API server: ${(error as Error).message}`));
  }
}

async function startWebUI(ctx: ApexContext, port: number, silent: boolean = false): Promise<void> {
  if (!silent) {
    console.log(chalk.cyan(`Starting Web UI on port ${port}...`));
  }

  // Find the web-ui package
  const webUIPath = path.resolve(__dirname, '../../web-ui');

  try {
    await fs.access(webUIPath);
  } catch {
    if (!silent) {
      console.log(chalk.yellow('Web UI package not found. Skipping.'));
    }
    return;
  }

  // Get API URL from config
  const apiUrl = ctx.config?.api?.url || `http://localhost:${ctx.apiPort}`;

  // Check if .next build exists
  const nextBuildPath = path.join(webUIPath, '.next');
  let useDevMode = false;
  try {
    await fs.access(nextBuildPath);
  } catch {
    useDevMode = true;
  }

  // Use npx next directly with port argument
  const args = useDevMode
    ? ['next', 'dev', '-p', port.toString()]
    : ['next', 'start', '-p', port.toString()];

  const proc = spawn('npx', args, {
    cwd: webUIPath,
    env: {
      ...process.env,
      PORT: port.toString(),
      NEXT_PUBLIC_APEX_API_URL: apiUrl,
    },
    stdio: 'ignore', // Completely ignore all output
    detached: true,  // Run detached from parent
  });

  // Don't wait for the child process
  proc.unref();

  proc.on('error', (err) => {
    console.error(chalk.red(`Web UI error: ${err.message}`));
    ctx.webUIProcess = null;
  });

  ctx.webUIProcess = proc;
  ctx.webUIPort = port;

  // Wait a bit for startup
  await new Promise(resolve => setTimeout(resolve, 2000));

  if (!silent) {
    console.log(chalk.green(`✓ Web UI running at http://localhost:${port}`));
  }
}

async function checkAutoStart(ctx: ApexContext): Promise<void> {
  if (!ctx.config) return;

  const effective = getEffectiveConfig(ctx.config);

  // Check for API auto-start configuration
  const apiConfig = effective.api as any;
  const webUIConfig = (effective as any).webUI;

  const startingServices: string[] = [];

  if (apiConfig?.autoStart) {
    startingServices.push(`API (port ${effective.api.port})`);
  }
  if (webUIConfig?.autoStart) {
    startingServices.push(`Web UI (port ${webUIConfig.port || 3001})`);
  }

  if (startingServices.length > 0) {
    console.log(chalk.gray(`Starting: ${startingServices.join(', ')}...`));
  }

  // Start services silently
  if (apiConfig?.autoStart) {
    await startAPIServer(ctx, effective.api.port, true);
  }

  if (webUIConfig?.autoStart) {
    await startWebUI(ctx, webUIConfig.port || 3001, true);
  }

  if (startingServices.length > 0) {
    console.log(chalk.green(`✓ Services ready`));
  }
}

// ============================================================================
// REPL Interface
// ============================================================================

async function startREPL(): Promise<void> {
  console.clear();
  console.log(chalk.cyan(banner));
  console.log(chalk.gray(`  v${VERSION}\n`));

  // Check initialization
  ctx.initialized = await isApexInitialized(ctx.cwd);

  if (ctx.initialized) {
    try {
      ctx.config = await loadConfig(ctx.cwd);
      ctx.orchestrator = new ApexOrchestrator({ projectPath: ctx.cwd });
      await ctx.orchestrator.initialize();

      console.log(chalk.green(`✓ APEX initialized in ${ctx.cwd}\n`));

      // Check for auto-start
      await checkAutoStart(ctx);
    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not load configuration: ${(error as Error).message}\n`));
    }
  } else {
    console.log(chalk.yellow('APEX not initialized. Run /init to get started.\n'));
  }

  console.log(chalk.gray('Type /help for commands or enter a task description.\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('apex> '),
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input.startsWith('/')) {
      // Command
      const parts = parseInput(input.slice(1));
      const cmdName = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      const cmd = commands.find(c => c.name === cmdName || c.aliases.includes(cmdName));

      if (cmd) {
        await cmd.handler(ctx, args);
      } else {
        console.log(chalk.red(`Unknown command: ${cmdName}. Type /help for available commands.`));
      }
    } else {
      // Natural language task
      if (!ctx.initialized) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
      } else {
        await executeTask(ctx, input);
      }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.cyan('\nGoodbye!\n'));

    if (ctx.apiProcess) ctx.apiProcess.kill();
    if (ctx.webUIProcess) ctx.webUIProcess.kill();

    process.exit(0);
  });
}

function parseInput(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of input) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    pending: '⏳',
    queued: '📋',
    planning: '🤔',
    'in-progress': '🔄',
    'waiting-approval': '✋',
    paused: '⏸️',
    completed: '✅',
    failed: '❌',
    cancelled: '🚫',
  };
  return emojis[status] || '❓';
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'debug':
      return chalk.gray('DEBUG');
    case 'info':
      return chalk.blue('INFO ');
    case 'warn':
      return chalk.yellow('WARN ');
    case 'error':
      return chalk.red('ERROR');
    default:
      return level;
  }
}

async function copyDefaultAgents(projectPath: string): Promise<void> {
  const agentsDir = path.join(projectPath, '.apex', 'agents');

  const agents = {
    'planner.md': `---
name: planner
description: Creates implementation plans and breaks down tasks into subtasks
tools: Read, Grep, Glob
model: opus
---

You are a technical project planner. When given a task:

1. Analyze the requirements thoroughly
2. Break down into concrete subtasks
3. Identify dependencies between subtasks
4. Estimate complexity for each subtask
5. Suggest an implementation order

Output a structured plan with:
- Overview of approach
- List of subtasks with descriptions
- Dependency graph
- Risk assessment
- Recommended agent assignments

Be thorough but concise. Focus on actionable items.`,

    'architect.md': `---
name: architect
description: Designs system architecture and makes technical decisions
tools: Read, Grep, Glob, Write
model: opus
---

You are a senior software architect. When designing systems:

1. Analyze existing codebase structure
2. Propose clean, maintainable architecture
3. Define clear interfaces and contracts
4. Consider scalability and performance
5. Document architectural decisions

Create ADRs (Architecture Decision Records) for major decisions.
Follow SOLID principles and established patterns.
Prioritize simplicity over cleverness.`,

    'developer.md': `---
name: developer
description: Implements features and writes production code
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
model: sonnet
---

You are a senior software developer. When implementing:

1. Follow existing code patterns and conventions
2. Write clean, readable, documented code
3. Handle errors appropriately
4. Add inline comments for complex logic
5. Run linting and tests after changes

Use conventional commits: feat:, fix:, refactor:, etc.
Keep commits atomic and focused.
Always test your changes before completing.`,

    'reviewer.md': `---
name: reviewer
description: Reviews code for quality, bugs, and security issues
tools: Read, Grep, Glob
model: haiku
---

You are a code reviewer. When reviewing:

1. Check for bugs and logic errors
2. Identify security vulnerabilities
3. Assess code quality and readability
4. Verify error handling
5. Check test coverage

Output findings as:
FILE:LINE - ISSUE - SEVERITY (high/medium/low)

Be direct and actionable. No praise needed, just findings.
Focus on what needs to change.`,

    'tester.md': `---
name: tester
description: Creates and runs tests, analyzes coverage
tools: Read, Write, Bash, Grep
model: sonnet
---

You are a QA engineer. When testing:

1. Analyze code to identify test cases
2. Write comprehensive unit tests
3. Create integration tests where needed
4. Test edge cases and error paths
5. Run tests and verify coverage

Use the project's testing framework.
Aim for meaningful coverage, not just high numbers.
Focus on testing behavior, not implementation.`,

    'devops.md': `---
name: devops
description: Handles infrastructure, CI/CD, and deployment
tools: Read, Write, Bash, Grep, Glob
model: sonnet
---

You are a DevOps engineer. When working on infrastructure:

1. Follow infrastructure as code principles
2. Write clear, documented configurations
3. Implement proper health checks
4. Set up appropriate resource limits
5. Consider security best practices

Use declarative configurations where possible.
Test changes in isolation before applying.
Document any manual steps required.`,
  };

  for (const [filename, content] of Object.entries(agents)) {
    await fs.writeFile(path.join(agentsDir, filename), content);
  }
}

async function copyDefaultWorkflows(projectPath: string): Promise<void> {
  const workflowsDir = path.join(projectPath, '.apex', 'workflows');

  const workflows = {
    'feature.yaml': `name: feature
description: Full feature implementation workflow
trigger:
  - manual
  - apex:feature

stages:
  - name: planning
    agent: planner
    description: Create implementation plan
    outputs:
      - implementation_plan
      - subtasks

  - name: architecture
    agent: architect
    description: Design technical solution
    dependsOn: [planning]
    outputs:
      - technical_design

  - name: implementation
    agent: developer
    description: Write the code
    dependsOn: [architecture]
    outputs:
      - code_changes
      - branch_name

  - name: testing
    agent: tester
    description: Create and run tests
    dependsOn: [implementation]
    outputs:
      - test_files
      - coverage_report

  - name: review
    agent: reviewer
    description: Review code quality
    dependsOn: [implementation, testing]
    outputs:
      - review_findings
`,

    'bugfix.yaml': `name: bugfix
description: Bug investigation and fix workflow
trigger:
  - manual
  - apex:bugfix

stages:
  - name: investigation
    agent: developer
    description: Investigate and locate the bug
    outputs:
      - root_cause
      - affected_files

  - name: fix
    agent: developer
    description: Implement the fix
    dependsOn: [investigation]
    outputs:
      - code_changes

  - name: testing
    agent: tester
    description: Add regression tests
    dependsOn: [fix]
    outputs:
      - test_files

  - name: review
    agent: reviewer
    description: Review the fix
    dependsOn: [fix, testing]
    outputs:
      - review_findings
`,

    'refactor.yaml': `name: refactor
description: Code refactoring workflow
trigger:
  - manual
  - apex:refactor

stages:
  - name: analysis
    agent: architect
    description: Analyze current code and plan refactoring
    outputs:
      - refactoring_plan

  - name: refactor
    agent: developer
    description: Execute refactoring
    dependsOn: [analysis]
    outputs:
      - code_changes

  - name: testing
    agent: tester
    description: Verify no regressions
    dependsOn: [refactor]
    outputs:
      - test_results

  - name: review
    agent: reviewer
    description: Review refactored code
    dependsOn: [refactor, testing]
    outputs:
      - review_findings
`,
  };

  for (const [filename, content] of Object.entries(workflows)) {
    await fs.writeFile(path.join(workflowsDir, filename), content);
  }
}

async function createHelperScripts(projectPath: string): Promise<void> {
  const scriptsDir = path.join(projectPath, '.apex', 'scripts');

  const scripts = {
    'lint.sh': `#!/bin/bash
# Run project linting

if [ -f "package.json" ]; then
  npm run lint 2>/dev/null || npx eslint . 2>/dev/null || echo "No linter configured"
elif [ -f "pyproject.toml" ]; then
  ruff check . 2>/dev/null || flake8 . 2>/dev/null || echo "No linter configured"
else
  echo "Unknown project type"
fi
`,

    'test.sh': `#!/bin/bash
# Run project tests

if [ -f "package.json" ]; then
  npm test 2>/dev/null || npx jest 2>/dev/null || echo "No tests configured"
elif [ -f "pyproject.toml" ]; then
  pytest 2>/dev/null || python -m unittest discover 2>/dev/null || echo "No tests configured"
else
  echo "Unknown project type"
fi
`,

    'build.sh': `#!/bin/bash
# Build the project

if [ -f "package.json" ]; then
  npm run build 2>/dev/null || echo "No build script"
elif [ -f "pyproject.toml" ]; then
  python -m build 2>/dev/null || echo "No build configured"
else
  echo "Unknown project type"
fi
`,

    'typecheck.sh': `#!/bin/bash
# Run type checking

if [ -f "tsconfig.json" ]; then
  npx tsc --noEmit
elif [ -f "pyproject.toml" ]; then
  mypy . 2>/dev/null || pyright . 2>/dev/null || echo "No type checker configured"
else
  echo "No type checking available"
fi
`,
  };

  for (const [filename, content] of Object.entries(scripts)) {
    const filePath = path.join(scriptsDir, filename);
    await fs.writeFile(filePath, content);
    await fs.chmod(filePath, 0o755);
  }
}

// ============================================================================
// Non-interactive command execution
// ============================================================================

async function executeNonInteractiveCommand(cmdName: string, args: string[]): Promise<void> {
  // Initialize context
  ctx.initialized = await isApexInitialized(ctx.cwd);

  if (ctx.initialized) {
    try {
      ctx.config = await loadConfig(ctx.cwd);
      ctx.orchestrator = new ApexOrchestrator({ projectPath: ctx.cwd });
      await ctx.orchestrator.initialize();
    } catch {
      // Ignore initialization errors for commands that don't need it
    }
  }

  const cmd = commands.find(c => c.name === cmdName || c.aliases.includes(cmdName));

  if (cmd) {
    await cmd.handler(ctx, args);
  } else {
    console.log(chalk.red(`Unknown command: ${cmdName}. Use 'apex --help' for available commands.`));
    process.exit(1);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

// Check for --help or --version flags
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${chalk.cyan('APEX')} - Autonomous Product Engineering eXecutor

${chalk.bold('Usage:')}
  apex                    Start interactive REPL (rich UI)
  apex --classic          Start with classic readline UI
  apex <command> [args]   Run a command directly
  apex --help             Show this help
  apex --version          Show version

${chalk.bold('Commands:')}
  init [options]          Initialize APEX in the current project
  status [task_id]        Show task status
  agents                  List available agents
  workflows               List available workflows
  config [get|set]        View or edit configuration
  logs <task_id>          Show task logs
  cancel <task_id>        Cancel a running task
  retry <task_id>         Retry a failed task
  serve [--port]          Start the API server
  pr <task_id>            Create a pull request

${chalk.bold('Init Options:')}
  --yes, -y               Skip prompts, use defaults
  --name, -n <name>       Project name
  --language, -l <lang>   Primary language
  --framework, -f <fw>    Framework

${chalk.bold('Examples:')}
  apex                              # Start interactive mode
  apex init --yes                   # Initialize with defaults
  apex status                       # List recent tasks
  apex agents                       # List agents
  Add a login form                  # Run a task (in REPL)
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(`APEX v${VERSION}`);
  process.exit(0);
}

// Check if a command was provided
if (args.length > 0 && !args[0].startsWith('-')) {
  // Non-interactive mode - run the command directly
  const cmdName = args[0].toLowerCase();
  const cmdArgs = args.slice(1);

  // Handle --yes flag for init
  if (cmdName === 'init' && cmdArgs.includes('--yes')) {
    // Remove --yes from args, it's handled specially
  }

  executeNonInteractiveCommand(cmdName, cmdArgs).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  });
} else {
  // Check for --classic flag to use old readline UI (Ink is now default)
  const useClassic = args.includes('--classic') || process.env.APEX_CLASSIC_UI === '1';

  if (useClassic) {
    // Start the classic readline REPL
    startREPL();
  } else {
    // Start the new Ink-based REPL (default)
    import('./repl.js').then(({ startInkREPL }) => {
      startInkREPL().catch((error) => {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      });
    });
  }
}
