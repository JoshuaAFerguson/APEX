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
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { startServer } from '@apexcli/api';
import { handleDaemonStart, handleDaemonStop, handleDaemonStatus } from './handlers/daemon-handlers.js';
import { handleInstallService, handleUninstallService, handleServiceStatus } from './handlers/service-handlers.js';

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

export type CliContext = ApexContext;
export const commands: Command[] = [
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
    description: 'Show task status or check outdated documentation',
    usage: '/status [task_id] [--check-docs]',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      // Check for --check-docs flag
      const checkDocs = args.includes('--check-docs');
      const filteredArgs = args.filter(arg => arg !== '--check-docs');
      const taskId = filteredArgs[0];

      // If --check-docs flag is provided, show documentation analysis findings
      if (checkDocs) {
        console.log(chalk.cyan('\n📋 Documentation Analysis:\n'));

        try {
          // Get both outdated docs and missing README sections
          const [outdatedDocs, missingReadmeSections] = await Promise.all([
            ctx.orchestrator.getDocumentationAnalysis(),
            ctx.orchestrator.getMissingReadmeSections()
          ]);

          let hasAnyIssues = false;

          // Display missing README sections
          if (missingReadmeSections.length > 0) {
            hasAnyIssues = true;
            console.log(chalk.magenta.bold('📝 Missing README Sections:\n'));

            // Group by priority
            const priorityGroups = {
              required: missingReadmeSections.filter(section => section.priority === 'required'),
              recommended: missingReadmeSections.filter(section => section.priority === 'recommended'),
              optional: missingReadmeSections.filter(section => section.priority === 'optional')
            };

            // Display required sections first (highest priority)
            if (priorityGroups.required.length > 0) {
              console.log(chalk.red.bold('🔴 Required Sections:'));
              priorityGroups.required.forEach(section => {
                console.log(chalk.red(`  • ${getReadmeSectionEmoji(section.section)} ${section.section}`));
                console.log(chalk.gray(`    Description: ${section.description}`));
                console.log();
              });
            }

            // Display recommended sections
            if (priorityGroups.recommended.length > 0) {
              console.log(chalk.yellow.bold('🟡 Recommended Sections:'));
              priorityGroups.recommended.forEach(section => {
                console.log(chalk.yellow(`  • ${getReadmeSectionEmoji(section.section)} ${section.section}`));
                console.log(chalk.gray(`    Description: ${section.description}`));
                console.log();
              });
            }

            // Display optional sections
            if (priorityGroups.optional.length > 0) {
              console.log(chalk.blue.bold('🔵 Optional Sections:'));
              priorityGroups.optional.forEach(section => {
                console.log(chalk.blue(`  • ${getReadmeSectionEmoji(section.section)} ${section.section}`));
                console.log(chalk.gray(`    Description: ${section.description}`));
                console.log();
              });
            }
          }

          // Display outdated documentation issues
          if (outdatedDocs.length > 0) {
            hasAnyIssues = true;
            if (missingReadmeSections.length > 0) {
              console.log(chalk.cyan('─'.repeat(60)));
            }
            console.log(chalk.cyan.bold('📋 Outdated Documentation Issues:\n'));

            // Group findings by severity for better display
            const severityGroups = {
              high: outdatedDocs.filter(doc => doc.severity === 'high'),
              medium: outdatedDocs.filter(doc => doc.severity === 'medium'),
              low: outdatedDocs.filter(doc => doc.severity === 'low')
            };

            // Display high severity findings first
            if (severityGroups.high.length > 0) {
              console.log(chalk.red.bold('🔴 High Severity Issues:'));
              severityGroups.high.forEach(doc => {
                const location = doc.line ? `${doc.file}:${doc.line}` : doc.file;
                console.log(chalk.red(`  • ${getDocTypeEmoji(doc.type)} ${doc.description}`));
                console.log(chalk.gray(`    Location: ${location}`));
                if (doc.suggestion) {
                  console.log(chalk.gray(`    Suggestion: ${doc.suggestion}`));
                }
                console.log();
              });
            }

            // Display medium severity findings
            if (severityGroups.medium.length > 0) {
              console.log(chalk.yellow.bold('🟡 Medium Severity Issues:'));
              severityGroups.medium.forEach(doc => {
                const location = doc.line ? `${doc.file}:${doc.line}` : doc.file;
                console.log(chalk.yellow(`  • ${getDocTypeEmoji(doc.type)} ${doc.description}`));
                console.log(chalk.gray(`    Location: ${location}`));
                if (doc.suggestion) {
                  console.log(chalk.gray(`    Suggestion: ${doc.suggestion}`));
                }
                console.log();
              });
            }

            // Display low severity findings
            if (severityGroups.low.length > 0) {
              console.log(chalk.blue.bold('🔵 Low Severity Issues:'));
              severityGroups.low.forEach(doc => {
                const location = doc.line ? `${doc.file}:${doc.line}` : doc.file;
                console.log(chalk.blue(`  • ${getDocTypeEmoji(doc.type)} ${doc.description}`));
                console.log(chalk.gray(`    Location: ${location}`));
                if (doc.suggestion) {
                  console.log(chalk.gray(`    Suggestion: ${doc.suggestion}`));
                }
                console.log();
              });
            }

            // Show outdated docs summary
            const total = outdatedDocs.length;
            console.log(chalk.cyan.bold('📊 Outdated Documentation Summary:'));
            console.log(`  Total Issues: ${total}`);
            console.log(`  High: ${chalk.red(severityGroups.high.length)} | Medium: ${chalk.yellow(severityGroups.medium.length)} | Low: ${chalk.blue(severityGroups.low.length)}`);
          }

          // Show overall summary
          if (hasAnyIssues) {
            console.log(chalk.cyan('─'.repeat(60)));
            console.log(chalk.cyan.bold('📈 Overall Documentation Status:'));

            const readmeSummary = missingReadmeSections.length > 0
              ? `Missing README sections: ${missingReadmeSections.length} (${missingReadmeSections.filter(s => s.priority === 'required').length} required)`
              : 'README sections: Complete';

            const outdatedSummary = outdatedDocs.length > 0
              ? `Outdated documentation: ${outdatedDocs.length} issues`
              : 'Documentation: Up to date';

            console.log(`  ${readmeSummary}`);
            console.log(`  ${outdatedSummary}`);
            console.log();
          } else {
            console.log(chalk.green('✅ No documentation issues detected!\n'));
            console.log(chalk.gray('  • README sections: Complete'));
            console.log(chalk.gray('  • Documentation: Up to date\n'));
          }

        } catch (error) {
          console.log(chalk.red(`❌ Failed to analyze documentation: ${error}`));
        }
        return;
      }

      // Regular status command logic
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
      let keepAlive = false;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        } else if (args[i] === '--keep-alive' || args[i] === '--foreground') {
          keepAlive = true;
        }
      }

      // When running non-interactively (e.g., `apex serve`), keep the server alive
      const isNonInteractive = !process.stdin.isTTY || args.includes('--keep-alive') || args.includes('--foreground');
      await startAPIServer(ctx, port, false, isNonInteractive || keepAlive);
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
    name: 'daemon',
    aliases: ['d'],
    description: 'Manage background daemon process',
    usage: '/daemon <start|stop|status> [options]',
    handler: async (ctx, args) => {
      const subcommand = args[0]?.toLowerCase();

      switch (subcommand) {
        case 'start':
          await handleDaemonStart(ctx, args.slice(1));
          break;
        case 'stop':
          await handleDaemonStop(ctx, args.slice(1));
          break;
        case 'status':
          await handleDaemonStatus(ctx);
          break;
        default:
          console.log(chalk.red('Usage: /daemon <start|stop|status>'));
          console.log(chalk.gray('\nSubcommands:'));
          console.log(chalk.gray('  start [--poll-interval <ms>]   Start the daemon'));
          console.log(chalk.gray('  stop [--force]                 Stop the daemon'));
          console.log(chalk.gray('  status                         Show daemon status'));
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
    aliases: [],
    description: 'Toggle thought visibility',
    usage: '/thoughts [on|off|toggle|status]',
    handler: async (ctx, args) => {
      // Note: In classic CLI mode, this command has limited functionality
      // as the classic mode doesn't have the same state management as the Ink UI
      const hasArgs = Array.isArray(args) && args.length > 0;
      const rawAction = hasArgs ? (args[0] ?? '') : '';
      const trimmedAction = typeof rawAction === 'string' ? rawAction.trim() : String(rawAction).trim();
      const action = trimmedAction.toLowerCase();

      if (hasArgs && trimmedAction.length === 0) {
        console.log(chalk.red('💭 Usage: /thoughts [on|off|toggle|status]'));
        return;
      }

      switch (action) {
        case 'on':
          console.log(chalk.green('💭 Thought visibility enabled'));
          break;
        case 'off':
          console.log(chalk.green('💭 Thought visibility disabled'));
          break;
        case 'status':
          console.log(chalk.gray('💭 Thought visibility status is managed per session in Ink UI mode'));
          break;
        case 'toggle':
        case '':
          console.log(chalk.blue('💭 Thought visibility toggled (Use --classic flag for rich UI)'));
          break;
        default:
          console.log(chalk.red('💭 Usage: /thoughts [on|off|toggle|status]'));
      }
    },
  },
  // v0.4.0 Commands
  {
    name: 'service',
    aliases: ['svc'],
    description: 'Manage daemon as system service',
    usage: '/service [install|uninstall|status]',
    handler: async (ctx, args) => {
      const action = args[0]?.toLowerCase();

      switch (action) {
        case 'install':
          await handleInstallService(ctx, args.slice(1));
          break;
        case 'uninstall':
          await handleUninstallService(ctx, args.slice(1));
          break;
        case 'status':
        case undefined:
          await handleServiceStatus(ctx);
          break;
        default:
          console.log(chalk.red('Usage: /service [install|uninstall|status]'));
          console.log(chalk.gray('Available actions:'));
          console.log(chalk.gray('  install   - Install APEX daemon as system service'));
          console.log(chalk.gray('  uninstall - Remove APEX daemon system service'));
          console.log(chalk.gray('  status    - Show service status'));
      }
    },
  },
  {
    name: 'interact',
    aliases: ['i'],
    description: 'Interact with running tasks',
    usage: '/interact <task-id> <command> [options]',
    handler: async (ctx, args) => {
      if (!ctx.orchestrator) {
        console.log(chalk.red('❌ Orchestrator not available'));
        return;
      }

      if (args.length < 2) {
        console.log(chalk.red('Usage: /interact <task-id> <command> [options]'));
        console.log(chalk.gray('Commands: iterate, inspect, diff, pause, resume, cancel'));
        return;
      }

      const [taskId, command, ...options] = args;

      try {
        console.log(chalk.blue(`🔄 Interacting with task ${taskId}...`));
        // Implementation would use InteractionManager
        console.log(chalk.green('✅ Task interaction not yet implemented'));
      } catch (error) {
        console.log(chalk.red(`❌ Interaction failed: ${error}`));
      }
    },
  },
  {
    name: 'iterate',
    aliases: [],
    description: 'Iterate on a running task with feedback',
    usage: '/iterate <task-id> [feedback] [--diff]',
    handler: async (ctx, args) => {
      if (!ctx.orchestrator) {
        console.log(chalk.red('❌ Orchestrator not available'));
        return;
      }

      if (args.length < 1) {
        console.log(chalk.red('Usage: /iterate <task-id> [feedback] [--diff]'));
        console.log(chalk.gray('Interactive mode: /iterate <task-id>'));
        console.log(chalk.gray('Direct mode: /iterate <task-id> "your feedback here"'));
        console.log(chalk.gray('Show diff: /iterate <task-id> --diff'));
        return;
      }

      const taskId = args[0];

      // Check if --diff flag is present
      if (args.includes('--diff')) {
        try {
          console.log(chalk.blue(`📊 Getting iteration diff for task ${taskId}...`));
          const diff = await ctx.orchestrator.getIterationDiff(taskId);

          console.log(chalk.cyan('\n📈 Iteration Diff:'));
          console.log(chalk.gray(`Iteration: ${diff.iterationId}`));
          if (diff.previousIterationId) {
            console.log(chalk.gray(`Previous: ${diff.previousIterationId}`));
          }

          if (diff.stageChange) {
            console.log(chalk.yellow(`Stage: ${diff.stageChange.from} → ${diff.stageChange.to}`));
          }

          if (diff.statusChange) {
            console.log(chalk.yellow(`Status: ${diff.statusChange.from} → ${diff.statusChange.to}`));
          }

          if (diff.filesChanged.added.length > 0) {
            console.log(chalk.green(`Added files (${diff.filesChanged.added.length}):`));
            diff.filesChanged.added.forEach(file => console.log(chalk.green(`  + ${file}`)));
          }

          if (diff.filesChanged.modified.length > 0) {
            console.log(chalk.blue(`Modified files (${diff.filesChanged.modified.length}):`));
            diff.filesChanged.modified.forEach(file => console.log(chalk.blue(`  M ${file}`)));
          }

          if (diff.filesChanged.removed.length > 0) {
            console.log(chalk.red(`Removed files (${diff.filesChanged.removed.length}):`));
            diff.filesChanged.removed.forEach(file => console.log(chalk.red(`  - ${file}`)));
          }

          if (diff.tokenUsageDelta > 0) {
            console.log(chalk.gray(`Token usage: +${diff.tokenUsageDelta}`));
          }

          if (diff.costDelta > 0) {
            console.log(chalk.gray(`Cost: +$${diff.costDelta.toFixed(4)}`));
          }

          console.log(chalk.gray(`\nSummary: ${diff.summary}`));

        } catch (error) {
          console.log(chalk.red(`❌ Failed to get iteration diff: ${error}`));
        }
        return;
      }

      // Check if task exists first
      try {
        const task = await ctx.orchestrator.getTask(taskId);
        if (!task) {
          console.log(chalk.red(`❌ Task ${taskId} not found`));
          return;
        }

        if (task.status !== 'in-progress') {
          console.log(chalk.red(`❌ Task ${taskId} is not in progress (status: ${task.status})`));
          console.log(chalk.gray('Only in-progress tasks can be iterated'));
          return;
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to check task: ${error}`));
        return;
      }

      // Check if feedback is provided directly
      const feedbackArg = args.slice(1).filter(arg => arg !== '--diff').join(' ');

      if (feedbackArg.trim()) {
        // Direct feedback mode
        try {
          console.log(chalk.blue(`🔄 Processing feedback for task ${taskId}...`));
          console.log(chalk.gray(`Feedback: "${feedbackArg}"`));

          const iterationId = await ctx.orchestrator.iterateTask(taskId, feedbackArg);
          console.log(chalk.green(`✅ Iteration started with ID: ${iterationId}`));
          console.log(chalk.gray('Use "/iterate <task-id> --diff" to see changes'));

        } catch (error) {
          console.log(chalk.red(`❌ Iteration failed: ${error}`));
        }
      } else {
        // Interactive mode - prompt for feedback
        try {
          console.log(chalk.cyan(`\n💭 Providing feedback for task ${taskId}`));
          console.log(chalk.gray('Enter your feedback below. Press Ctrl+C to cancel.\n'));

          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const feedback = await new Promise<string>((resolve, reject) => {
            rl.question('Feedback: ', (answer) => {
              rl.close();
              if (!answer.trim()) {
                reject(new Error('No feedback provided'));
              } else {
                resolve(answer);
              }
            });
          });

          console.log(chalk.blue(`🔄 Processing feedback for task ${taskId}...`));
          const iterationId = await ctx.orchestrator.iterateTask(taskId, feedback);
          console.log(chalk.green(`✅ Iteration started with ID: ${iterationId}`));
          console.log(chalk.gray('Use "/iterate <task-id> --diff" to see changes'));

        } catch (error) {
          if (error.message === 'No feedback provided') {
            console.log(chalk.yellow('⚠️  No feedback provided, iteration cancelled'));
          } else {
            console.log(chalk.red(`❌ Iteration failed: ${error}`));
          }
        }
      }
    },
  },
  {
    name: 'workspace',
    aliases: ['ws'],
    description: 'Manage task workspaces',
    usage: '/workspace [list|cleanup|info <task-id>]',
    handler: async (ctx, args) => {
      if (!ctx.orchestrator) {
        console.log(chalk.red('❌ Orchestrator not available'));
        return;
      }

      const action = args[0]?.toLowerCase();

      switch (action) {
        case 'list':
          console.log(chalk.blue('📋 Active Workspaces:'));
          console.log(chalk.gray('Workspace listing not yet implemented'));
          break;
        case 'cleanup':
          console.log(chalk.blue('🧹 Cleaning up old workspaces...'));
          console.log(chalk.green('✅ Workspace cleanup not yet implemented'));
          break;
        case 'info':
          const taskId = args[1];
          if (!taskId) {
            console.log(chalk.red('Usage: /workspace info <task-id>'));
            return;
          }
          console.log(chalk.blue(`📊 Workspace info for task ${taskId}:`));
          console.log(chalk.gray('Workspace info not yet implemented'));
          break;
        default:
          console.log(chalk.red('Usage: /workspace [list|cleanup|info <task-id>]'));
      }
    },
  },
  {
    name: 'think',
    aliases: ['t'],
    description: 'Thought capture system - capture, list, search, and promote thoughts',
    usage: '/think <thought> | /think --list | /think --search <query> | /think --promote <id>',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      if (args.length === 0) {
        console.log(chalk.red('Usage: /think <thought> [options] | /think --list | /think --search <query> | /think --promote <id>'));
        console.log(chalk.gray('\nOptions for capturing thoughts:'));
        console.log(chalk.gray('  --priority high|medium|low   Set thought priority (default: medium)'));
        console.log(chalk.gray('  --tag tag1,tag2              Add tags to the thought'));
        console.log(chalk.gray('\nManagement commands:'));
        console.log(chalk.gray('  --list                       List all captured thoughts'));
        console.log(chalk.gray('  --search <query>             Search thoughts by content or tags'));
        console.log(chalk.gray('  --promote <id>               Convert thought to task'));
        console.log(chalk.gray('  --stats                      Show thought statistics'));
        console.log(chalk.gray('  --export [file]              Export thoughts to markdown'));
        return;
      }

      const action = args[0];

      try {
        // List thoughts
        if (action === '--list') {
          const thoughts = await ctx.orchestrator.getAllThoughts();

          if (thoughts.length === 0) {
            console.log(chalk.gray('\n💭 No thoughts captured yet.\n'));
            console.log(chalk.gray('  Use: /think "your idea here" to capture thoughts'));
            return;
          }

          console.log(chalk.cyan(`\n💭 Captured Thoughts (${thoughts.length})\n`));

          for (const thought of thoughts.slice(0, 20)) { // Limit to 20 most recent
            const statusEmoji = getThoughtStatusEmoji(thought.status);
            const priorityColor = getThoughtPriorityColor(thought.priority);
            const shortId = thought.id.substring(0, 12);
            const timeAgo = getTimeAgo(thought.createdAt);

            console.log(`${statusEmoji} ${chalk.cyan(shortId)} ${priorityColor(thought.priority.toUpperCase())}`);
            console.log(`  ${chalk.bold(thought.content)}`);

            if (thought.tags && thought.tags.length > 0) {
              const tags = thought.tags.map(tag => chalk.gray(`#${tag}`)).join(' ');
              console.log(`  ${tags}`);
            }

            console.log(`  ${chalk.gray(timeAgo)}`);
            console.log();
          }

          if (thoughts.length > 20) {
            console.log(chalk.gray(`  ... and ${thoughts.length - 20} more. Use --search to find specific thoughts.`));
          }

          return;
        }

        // Search thoughts
        if (action === '--search') {
          if (args.length < 2) {
            console.log(chalk.red('Usage: /think --search <query>'));
            return;
          }

          const query = args.slice(1).join(' ');
          const results = await ctx.orchestrator.searchThoughts({ query });

          if (results.length === 0) {
            console.log(chalk.gray(`\n🔍 No thoughts found matching: "${query}"\n`));
            return;
          }

          console.log(chalk.cyan(`\n🔍 Search Results for "${query}" (${results.length})\n`));

          for (const thought of results) {
            const statusEmoji = getThoughtStatusEmoji(thought.status);
            const priorityColor = getThoughtPriorityColor(thought.priority);
            const shortId = thought.id.substring(0, 12);

            console.log(`${statusEmoji} ${chalk.cyan(shortId)} ${priorityColor(thought.priority.toUpperCase())}`);
            console.log(`  ${chalk.bold(thought.content)}`);

            if (thought.tags && thought.tags.length > 0) {
              const tags = thought.tags.map(tag => chalk.gray(`#${tag}`)).join(' ');
              console.log(`  ${tags}`);
            }
            console.log();
          }

          return;
        }

        // Promote thought to task
        if (action === '--promote') {
          if (args.length < 2) {
            console.log(chalk.red('Usage: /think --promote <thought_id>'));
            return;
          }

          const thoughtId = args[1];

          // Find thought that starts with this ID
          const thoughts = await ctx.orchestrator.getAllThoughts();
          const thought = thoughts.find(t => t.id.startsWith(thoughtId));

          if (!thought) {
            console.log(chalk.red(`Thought not found: ${thoughtId}`));
            console.log(chalk.gray('Use /think --list to see available thoughts'));
            return;
          }

          if (thought.status === 'implemented') {
            console.log(chalk.yellow(`Thought ${thoughtId} has already been implemented`));
            if (thought.taskId) {
              console.log(chalk.gray(`  Task ID: ${thought.taskId}`));
            }
            return;
          }

          console.log(chalk.blue(`\n🚀 Promoting thought to task...`));
          console.log(chalk.gray(`   Thought: ${thought.content}`));

          const taskId = await ctx.orchestrator.promoteThought(thought.id);

          console.log(chalk.green('✅ Thought promoted successfully!'));
          console.log(chalk.cyan(`   New task ID: ${taskId}`));
          console.log(chalk.gray(`   Use /status ${taskId} to track progress`));

          return;
        }

        // Show statistics
        if (action === '--stats') {
          const stats = await ctx.orchestrator.getThoughtStats();

          console.log(chalk.cyan('\n📊 Thought Statistics\n'));
          console.log(`  Total thoughts: ${stats.total}`);

          if (stats.total > 0) {
            console.log(`  Implementation rate: ${(stats.implementationRate * 100).toFixed(1)}%\n`);

            console.log(chalk.bold('By Status:'));
            Object.entries(stats.byStatus).forEach(([status, count]) => {
              if (count > 0) {
                const emoji = getThoughtStatusEmoji(status as any);
                console.log(`  ${emoji} ${status}: ${count}`);
              }
            });

            console.log(chalk.bold('\nBy Priority:'));
            Object.entries(stats.byPriority).forEach(([priority, count]) => {
              if (count > 0) {
                const color = getThoughtPriorityColor(priority as any);
                console.log(`  ${color(`${priority}: ${count}`)}`);
              }
            });

            if (Object.keys(stats.byTag).length > 0) {
              console.log(chalk.bold('\nTop Tags:'));
              const topTags = Object.entries(stats.byTag)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);

              topTags.forEach(([tag, count]) => {
                console.log(`  ${chalk.gray('#')}${tag}: ${count}`);
              });
            }
          }

          console.log();
          return;
        }

        // Export thoughts
        if (action === '--export') {
          const outputFile = args[1] ? args[1] : undefined;

          console.log(chalk.blue('\n📄 Exporting thoughts to markdown...'));

          const markdown = await ctx.orchestrator.exportThoughtsToMarkdown(outputFile);

          if (outputFile) {
            console.log(chalk.green(`✅ Thoughts exported to: ${outputFile}`));
          } else {
            console.log(chalk.green('✅ Thoughts exported:'));
            console.log(chalk.gray('\n' + markdown));
          }

          return;
        }

        // Capture new thought
        if (!action.startsWith('--')) {
          // Parse options
          let priority: 'low' | 'medium' | 'high' = 'medium';
          let tags: string[] = [];
          let content = args.join(' ');

          // Extract priority
          const priorityMatch = content.match(/--priority\s+(high|medium|low)/);
          if (priorityMatch) {
            priority = priorityMatch[1] as 'high' | 'medium' | 'low';
            content = content.replace(/--priority\s+(high|medium|low)/, '').trim();
          }

          // Extract tags
          const tagMatch = content.match(/--tag\s+([^\s]+)/);
          if (tagMatch) {
            tags = tagMatch[1].split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            content = content.replace(/--tag\s+[^\s]+/, '').trim();
          }

          if (!content) {
            console.log(chalk.red('Please provide thought content'));
            return;
          }

          console.log(chalk.blue('💭 Capturing thought...'));

          const thought = await ctx.orchestrator.captureThought(content, { priority, tags });

          console.log(chalk.green('✅ Thought captured successfully!'));
          console.log(chalk.cyan(`   ID: ${thought.id.substring(0, 12)}`));
          console.log(chalk.gray(`   Priority: ${priority}`));

          if (tags.length > 0) {
            console.log(chalk.gray(`   Tags: ${tags.map(tag => `#${tag}`).join(' ')}`));
          }

          console.log(chalk.gray(`   Use /think --promote ${thought.id.substring(0, 12)} to convert to task`));

          return;
        }

        // Unknown action
        console.log(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.gray('Use /think for usage help'));

      } catch (error) {
        console.log(chalk.red(`❌ Error: ${(error as Error).message}`));
      }
    },
  },
  {
    name: 'idle',
    aliases: ['suggestions'],
    description: 'View and manage improvement suggestions and idle processing',
    usage: '/idle [enable|disable|status|list|implement <id>|accept <id>|dismiss <id>|analyze]',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      const action = args[0]?.toLowerCase();

      switch (action) {
        case 'enable':
          try {
            // Load current config
            const config = await loadConfig(ctx.cwd);

            // Ensure daemon and idleProcessing objects exist
            if (!config.daemon) {
              (config as any).daemon = {};
            }
            if (!config.daemon!.idleProcessing) {
              (config.daemon as any).idleProcessing = {};
            }

            // Enable idle processing
            config.daemon!.idleProcessing!.enabled = true;

            // Save the updated config
            await saveConfig(ctx.cwd, config);

            console.log(chalk.green('✅ Idle processing enabled'));
            console.log(chalk.cyan('   APEX will now generate improvement suggestions during idle time'));

            // Show current status
            console.log(chalk.gray(`   Current status: ${chalk.green('ENABLED')}`));

          } catch (error) {
            console.log(chalk.red(`❌ Failed to enable idle processing: ${(error as Error).message}`));
          }
          break;
        case 'disable':
          try {
            // Load current config
            const config = await loadConfig(ctx.cwd);

            // Ensure daemon and idleProcessing objects exist
            if (!config.daemon) {
              (config as any).daemon = {};
            }
            if (!config.daemon!.idleProcessing) {
              (config.daemon as any).idleProcessing = {};
            }

            // Disable idle processing
            config.daemon!.idleProcessing!.enabled = false;

            // Save the updated config
            await saveConfig(ctx.cwd, config);

            console.log(chalk.green('✅ Idle processing disabled'));
            console.log(chalk.cyan('   APEX will no longer generate improvement suggestions during idle time'));

            // Show current status
            console.log(chalk.gray(`   Current status: ${chalk.red('DISABLED')}`));

          } catch (error) {
            console.log(chalk.red(`❌ Failed to disable idle processing: ${(error as Error).message}`));
          }
          break;
        case 'status':
        case 'list':
        case undefined:
          try {
            // First, show idle processing status
            const config = await loadConfig(ctx.cwd);
            const idleEnabled = config.daemon?.idleProcessing?.enabled ?? false;

            console.log(chalk.blue('\n⚙️ Idle Processing Status:\n'));
            console.log(`   Status: ${idleEnabled ? chalk.green('ENABLED') : chalk.red('DISABLED')}`);

            if (idleEnabled) {
              const idleThreshold = config.daemon?.idleProcessing?.idleThreshold ?? 300000;
              const generationInterval = config.daemon?.idleProcessing?.taskGenerationInterval ?? 3600000;
              const maxIdleTasks = config.daemon?.idleProcessing?.maxIdleTasks ?? 3;

              console.log(chalk.gray(`   Idle threshold: ${idleThreshold / 1000} seconds`));
              console.log(chalk.gray(`   Generation interval: ${generationInterval / 60000} minutes`));
              console.log(chalk.gray(`   Max idle tasks: ${maxIdleTasks}`));
            }

            const idleTasks = await ctx.orchestrator.listIdleTasks({
              implemented: false,
              limit: 10
            });

            if (idleTasks.length === 0) {
              console.log(chalk.green('\n✅ No pending idle tasks found.\n'));
              console.log(chalk.gray('  All improvement suggestions have been addressed or no suggestions have been generated yet.\n'));
              return;
            }

            console.log(chalk.blue(`\n💡 Pending Idle Tasks (${idleTasks.length}):\n`));

            for (const task of idleTasks) {
              const typeEmoji = getIdleTaskTypeEmoji(task.type);
              const priorityColor = getPriorityColor(task.priority);
              const effortEmoji = getEffortEmoji(task.estimatedEffort);

              console.log(`  ${chalk.cyan(task.id.substring(0, 12))} ${typeEmoji} ${task.type.toUpperCase()}`);
              console.log(`    ${chalk.bold(task.title)}`);
              console.log(`    ${priorityColor(`Priority: ${task.priority}`)} | ${chalk.gray(`Effort: ${effortEmoji} ${task.estimatedEffort}`)}`);
              console.log(`    ${chalk.gray(task.rationale)}`);
              console.log();
            }

          } catch (error) {
            console.log(chalk.red(`❌ Failed to list idle tasks: ${(error as Error).message}`));
          }
          break;
        case 'implement':
          const implementId = args[1];
          if (!implementId) {
            console.log(chalk.red('Usage: /idle implement <id>'));
            return;
          }
          console.log(chalk.blue(`🚀 Implementing suggestion ${implementId}...`));
          console.log(chalk.green('✅ Suggestion implementation not yet implemented'));
          break;
        case 'accept':
          const acceptId = args[1];
          if (!acceptId) {
            console.log(chalk.red('Usage: /idle accept <id>'));
            return;
          }
          try {
            console.log(chalk.blue(`🎯 Promoting idle task ${acceptId} to real task...`));
            const newTask = await ctx.orchestrator.promoteIdleTask(acceptId);
            console.log(chalk.green(`✅ Idle task promoted successfully!`));
            console.log(chalk.cyan(`   New task ID: ${newTask.id}`));
            console.log(chalk.gray(`   Branch: ${newTask.branchName || 'N/A'}`));
            console.log(chalk.gray(`   Workflow: ${newTask.workflow}`));
          } catch (error) {
            if ((error as Error).message.includes('not found')) {
              console.log(chalk.red(`❌ Idle task with ID ${acceptId} not found`));
            } else if ((error as Error).message.includes('already been implemented')) {
              console.log(chalk.red(`❌ Idle task ${acceptId} has already been implemented`));
            } else {
              console.log(chalk.red(`❌ Failed to promote idle task: ${(error as Error).message}`));
            }
          }
          break;
        case 'dismiss':
          const dismissId = args[1];
          if (!dismissId) {
            console.log(chalk.red('Usage: /idle dismiss <id>'));
            return;
          }
          try {
            console.log(chalk.blue(`🗑️ Dismissing suggestion ${dismissId}...`));
            await ctx.orchestrator.deleteIdleTask(dismissId);
            console.log(chalk.green('✅ Suggestion dismissed successfully'));
          } catch (error) {
            if ((error as Error).message.includes('not found')) {
              console.log(chalk.red(`❌ Idle task with ID ${dismissId} not found`));
            } else {
              console.log(chalk.red(`❌ Failed to dismiss idle task: ${(error as Error).message}`));
            }
          }
          break;
        case 'analyze':
          console.log(chalk.blue('🔍 Analyzing project for improvements...'));
          console.log(chalk.green('✅ Project analysis not yet implemented'));
          break;
        default:
          console.log(chalk.red('Usage: /idle [enable|disable|status|list|implement <id>|accept <id>|dismiss <id>|analyze]'));
          console.log(chalk.gray('\nCommands:'));
          console.log(chalk.gray('  enable    - Enable idle processing and suggestion generation'));
          console.log(chalk.gray('  disable   - Disable idle processing and suggestion generation'));
          console.log(chalk.gray('  status    - Show idle processing status and list pending tasks'));
          console.log(chalk.gray('  list      - List pending idle tasks'));
          console.log(chalk.gray('  accept    - Promote idle task to real task'));
          console.log(chalk.gray('  dismiss   - Remove idle task'));
          console.log(chalk.gray('  analyze   - Analyze project for improvements'));
      }
    },
  },
  {
    name: 'usage',
    aliases: ['budget'],
    description: 'View usage statistics and budget management',
    usage: '/usage [stats|budget|mode]',
    handler: async (ctx, args) => {
      const action = args[0]?.toLowerCase();

      switch (action) {
        case 'stats':
        case undefined:
          console.log(chalk.blue('📊 Usage Statistics:'));
          console.log(chalk.gray('Usage statistics not yet implemented'));
          break;
        case 'budget':
          console.log(chalk.blue('💰 Budget Status:'));
          console.log(chalk.gray('Budget management not yet implemented'));
          break;
        case 'mode':
          console.log(chalk.blue('🌓 Current Mode:'));
          console.log(chalk.gray('Time-based mode detection not yet implemented'));
          break;
        default:
          console.log(chalk.red('Usage: /usage [stats|budget|mode]'));
      }
    },
  },
  {
    name: 'checkout',
    aliases: ['co'],
    description: 'Switch to task worktree or manage worktrees',
    usage: '/checkout <task_id> | /checkout --list | /checkout --cleanup [<task_id>]',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      if (args.length === 0) {
        console.log(chalk.red('Usage: /checkout <task_id> | /checkout --list | /checkout --cleanup [<task_id>]'));
        console.log(chalk.gray('\nOptions:'));
        console.log(chalk.gray('  <task_id>           Switch to the worktree for the specified task'));
        console.log(chalk.gray('  --list              List all task worktrees'));
        console.log(chalk.gray('  --cleanup           Remove orphaned/stale worktrees'));
        console.log(chalk.gray('  --cleanup <task_id> Remove worktree for specific task'));
        return;
      }

      const action = args[0];

      try {
        // List all task worktrees
        if (action === '--list') {
          const worktrees = await ctx.orchestrator.listTaskWorktrees();

          if (worktrees.length === 0) {
            console.log(chalk.gray('\n📁 No task worktrees found.\n'));
            console.log(chalk.gray('  Task worktrees are created automatically when worktree management is enabled.'));
            return;
          }

          console.log(chalk.cyan(`\n📁 Task Worktrees (${worktrees.length})\n`));

          for (const worktree of worktrees) {
            const statusEmoji = getWorktreeStatusEmoji(worktree.status);
            const taskIdShort = worktree.taskId?.substring(0, 12) || 'unknown';
            const branchName = worktree.branch;
            const timeAgo = worktree.lastUsedAt ? getTimeAgo(worktree.lastUsedAt) : 'unknown';

            console.log(`${statusEmoji} ${chalk.cyan(taskIdShort)} ${chalk.bold(branchName)}`);
            console.log(`  Path: ${chalk.gray(worktree.path)}`);
            console.log(`  Last used: ${chalk.gray(timeAgo)}`);
            console.log();
          }

          console.log(chalk.gray('Use /checkout <task_id> to switch to a worktree'));
          return;
        }

        // Clean up orphaned worktrees or specific task worktree
        if (action === '--cleanup') {
          // Check if a specific taskId was provided as the second argument
          const targetTaskId = args[1];

          if (targetTaskId) {
            // Clean up specific task worktree
            console.log(chalk.blue(`\n🧹 Cleaning up worktree for task ${targetTaskId}...\n`));

            try {
              // Find the full task ID from partial ID
              const tasks = await ctx.orchestrator.listTasks({ limit: 100 });
              const task = tasks.find(t => t.id.startsWith(targetTaskId));

              if (!task) {
                console.log(chalk.red(`❌ Task not found: ${targetTaskId}`));
                console.log(chalk.gray('Use /status to see available tasks or provide a longer task ID.'));
                return;
              }

              const success = await ctx.orchestrator.cleanupTaskWorktree(task.id);

              if (success) {
                console.log(chalk.green(`✅ Worktree for task ${task.id.substring(0, 12)} cleaned up successfully.`));
                console.log(chalk.gray(`   Task: ${task.description}`));
              } else {
                console.log(chalk.yellow(`⚠️  No worktree found for task ${task.id.substring(0, 12)} or cleanup failed.`));
              }
            } catch (error) {
              console.log(chalk.red(`❌ Failed to cleanup worktree: ${(error as Error).message}`));
            }
          } else {
            // Clean up all orphaned worktrees
            console.log(chalk.blue('\n🧹 Cleaning up orphaned worktrees...\n'));

            const cleaned = await ctx.orchestrator.cleanupOrphanedWorktrees();

            if (cleaned.length === 0) {
              console.log(chalk.green('✅ No orphaned worktrees found to clean up.\n'));
            } else {
              console.log(chalk.green(`✅ Cleaned up ${cleaned.length} orphaned worktree(s):\n`));
              cleaned.forEach(taskId => {
                console.log(`  ${chalk.gray('•')} ${chalk.cyan(taskId.substring(0, 12))}`);
              });
              console.log();
            }
          }
          return;
        }

        // Switch to task worktree
        const taskId = action;

        // Find the full task ID from partial ID
        const tasks = await ctx.orchestrator.listTasks({ limit: 100 });
        const task = tasks.find(t => t.id.startsWith(taskId));

        if (!task) {
          console.log(chalk.red(`❌ Task not found: ${taskId}`));
          console.log(chalk.gray('Use /status to see available tasks or provide a longer task ID.'));
          return;
        }

        // Check if task has a worktree
        const worktree = await ctx.orchestrator.getTaskWorktree(task.id);

        if (!worktree) {
          console.log(chalk.yellow(`⚠️  No worktree found for task ${task.id.substring(0, 12)}`));
          console.log(chalk.gray('This task may have been created before worktree management was enabled,'));
          console.log(chalk.gray('or worktree management may not be enabled for this project.'));
          return;
        }

        // Switch to the worktree
        const worktreePath = await ctx.orchestrator.switchToTaskWorktree(task.id);

        console.log(chalk.green(`✅ Switched to worktree for task ${task.id.substring(0, 12)}`));
        console.log(chalk.cyan(`   Path: ${worktreePath}`));
        console.log(chalk.gray(`   Branch: ${worktree.branch}`));
        console.log(chalk.gray(`   Task: ${task.description}`));
        console.log();
        console.log(chalk.yellow('💡 To continue working on this task, change to the worktree directory:'));
        console.log(chalk.bold(`   cd "${worktreePath}"`));
        console.log();

      } catch (error) {
        console.log(chalk.red(`❌ Error: ${(error as Error).message}`));

        // Provide helpful suggestions based on the error
        if ((error as Error).message.includes('not enabled')) {
          console.log(chalk.gray('\n💡 To enable worktree management, add this to your .apex/config.yaml:'));
          console.log(chalk.gray('```yaml'));
          console.log(chalk.gray('git:'));
          console.log(chalk.gray('  autoWorktree: true'));
          console.log(chalk.gray('```'));
        }
      }
    },
  },

  {
    name: 'shell',
    aliases: [],
    description: 'Attach interactive shell to running task container',
    usage: '/shell <task_id> [command]',
    handler: async (ctx, args) => {
      if (!ctx.initialized || !ctx.orchestrator) {
        console.log(chalk.red('APEX not initialized. Run /init first.'));
        return;
      }

      const taskId = args[0];
      if (!taskId) {
        console.log(chalk.red('Usage: /shell <task_id> [command]'));
        console.log(chalk.gray('\nExamples:'));
        console.log(chalk.gray('  /shell abc123               # Attach interactive shell'));
        console.log(chalk.gray('  /shell abc123 "ls -la"      # Run specific command'));
        console.log(chalk.gray('  /shell abc123 bash          # Start bash shell'));
        console.log(chalk.gray('\nNote: Task must be using container isolation'));
        return;
      }

      try {
        // Find the full task ID from partial ID
        const tasks = await ctx.orchestrator.listTasks({ limit: 100 });
        const task = tasks.find(t => t.id.startsWith(taskId));

        if (!task) {
          console.log(chalk.red(`❌ Task not found: ${taskId}`));
          console.log(chalk.gray('Use /status to see available tasks or provide a longer task ID.'));
          return;
        }

        // Get workspace manager and container manager
        const workspaceManager = ctx.orchestrator.getWorkspaceManager();
        const containerManager = workspaceManager.getContainerManager();

        // Check if task is using container isolation
        // Look for a container with the naming pattern: apex-task-{taskId}
        const containerName = `apex-task-${task.id}`;
        const containers = await containerManager.listApexContainers();
        const taskContainer = containers.find(c => c.name === containerName);

        if (!taskContainer) {
          console.log(chalk.red(`❌ Task ${task.id.substring(0, 12)} is not using container isolation`));
          console.log(chalk.gray('This command only works with tasks running in containers.'));
          console.log(chalk.gray('To enable container isolation, update your .apex/config.yaml:'));
          console.log(chalk.gray('```yaml'));
          console.log(chalk.gray('workspace:'));
          console.log(chalk.gray('  defaultStrategy: container'));
          console.log(chalk.gray('```'));
          return;
        }

        // Check if container is running
        if (taskContainer.status !== 'running') {
          console.log(chalk.red(`❌ Container for task ${task.id.substring(0, 12)} is not running`));
          console.log(chalk.gray(`Container status: ${taskContainer.status}`));
          return;
        }

        console.log(chalk.blue(`🐚 Attaching to container for task ${task.id.substring(0, 12)}...`));
        console.log(chalk.gray(`   Container: ${taskContainer.name}`));
        console.log(chalk.gray(`   Task: ${task.description}`));
        console.log();

        // Determine command to run
        const userCommand = args.slice(1).join(' ');
        let execArgs: string[];

        if (userCommand) {
          // If user provided a command, determine if it needs shell interpretation
          if (userCommand.includes(' ') && !userCommand.startsWith('/')) {
            // Complex command that likely needs shell interpretation
            execArgs = ['/bin/sh', '-c', userCommand];
          } else {
            // Simple command, run directly
            execArgs = userCommand.split(' ');
          }
        } else {
          // Default to bash shell
          execArgs = ['/bin/bash'];
        }

        // Use spawn for interactive shell
        const { spawn } = await import('child_process');

        // Get container runtime (docker or podman)
        const runtime = workspaceManager.getContainerRuntime();
        if (!runtime || runtime === 'none') {
          console.log(chalk.red('❌ No container runtime (docker/podman) available'));
          return;
        }

        console.log(chalk.gray(`💡 Starting ${userCommand || 'interactive shell'} in container. Use 'exit' to return to APEX.`));
        console.log();

        // Start interactive shell with TTY
        const shellProcess = spawn(runtime, [
          'exec',
          '--interactive',
          '--tty',
          taskContainer.id,
          ...execArgs
        ], {
          stdio: 'inherit',
          env: process.env
        });

        // Handle shell exit
        shellProcess.on('close', (code) => {
          console.log();
          if (code === 0) {
            console.log(chalk.green('✅ Shell session ended'));
          } else {
            console.log(chalk.yellow(`⚠️  Shell session ended with code ${code}`));
          }
        });

        shellProcess.on('error', (error) => {
          console.log();
          console.log(chalk.red(`❌ Shell session failed: ${error.message}`));
        });

      } catch (error) {
        console.log(chalk.red(`❌ Error: ${(error as Error).message}`));
      }
    },
  },

  // Service management commands
  {
    name: 'install-service',
    aliases: ['install-svc'],
    description: 'Install APEX daemon as system service',
    usage: 'install-service [--enable|--no-enable] [--force] [--name <name>]',
    handler: async (ctx, args) => {
      await handleInstallService(ctx, args);
    },
  },
  {
    name: 'uninstall-service',
    aliases: ['uninstall-svc'],
    description: 'Remove APEX daemon system service',
    usage: 'uninstall-service [--force] [--timeout <ms>] [--name <name>]',
    handler: async (ctx, args) => {
      await handleUninstallService(ctx, args);
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

async function startAPIServer(ctx: ApexContext, port: number, silent: boolean = false, keepAlive: boolean = false): Promise<void> {
  if (!silent) {
    console.log(chalk.cyan(`Starting API server on port ${port}...`));
  }

  try {
    await startServer({ projectPath: ctx.cwd, port, host: '0.0.0.0', silent });
    ctx.apiPort = port;

    if (!silent) {
      console.log(chalk.green(`✓ API server running at http://localhost:${port}`));
    }

    // If keepAlive is true, don't return until the process is killed
    if (keepAlive) {
      await new Promise(() => {
        // This promise never resolves, keeping the server alive
        process.on('SIGINT', () => process.exit(0));
        process.on('SIGTERM', () => process.exit(0));
      });
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

function getDocTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    'version-mismatch': '🔢',
    'deprecated-api': '⚠️',
    'broken-link': '🔗',
    'outdated-example': '📝',
    'stale-reference': '🗓️',
  };
  return emojis[type] || '📄';
}

function getReadmeSectionEmoji(section: string): string {
  const emojis: Record<string, string> = {
    'title': '📝',
    'description': '📋',
    'installation': '⚙️',
    'usage': '💡',
    'api': '📚',
    'examples': '💡',
    'contributing': '🤝',
    'license': '⚖️',
    'changelog': '📅',
    'troubleshooting': '🔧',
    'faq': '❓',
    'dependencies': '📦',
    'testing': '🧪',
    'deployment': '🚀',
  };
  return emojis[section] || '📄';
}

function getIdleTaskTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    'maintenance': '🔧',
    'refactoring': '🔄',
    'docs': '📚',
    'tests': '🧪',
  };
  return emojis[type] || '📋';
}

function getPriorityColor(priority: string): (text: string) => string {
  switch (priority) {
    case 'urgent':
      return chalk.red.bold;
    case 'high':
      return chalk.red;
    case 'normal':
      return chalk.yellow;
    case 'low':
      return chalk.green;
    default:
      return chalk.gray;
  }
}

function getEffortEmoji(effort: string): string {
  const emojis: Record<string, string> = {
    'xs': '🔵',
    'small': '🟢',
    'medium': '🟡',
    'large': '🔴',
    'xl': '⭐',
  };
  return emojis[effort] || '⚫';
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
// Thought Helper Functions
// ============================================================================

function getThoughtStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    captured: '💭',
    planned: '📋',
    implemented: '✅',
    discarded: '🗑️',
  };
  return emojis[status] || '❓';
}

function getThoughtPriorityColor(priority: string): (text: string) => string {
  switch (priority) {
    case 'high':
      return chalk.red.bold;
    case 'medium':
      return chalk.yellow;
    case 'low':
      return chalk.green;
    default:
      return chalk.gray;
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else {
    return 'just now';
  }
}

function getWorktreeStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    active: '✅',
    stale: '⚠️',
    prunable: '🗑️',
    broken: '❌',
  };
  return emojis[status] || '❓';
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
  status [task_id] [--check-docs]  Show task status or check outdated docs
  agents                  List available agents
  workflows               List available workflows
  config [get|set]        View or edit configuration
  logs <task_id>          Show task logs
  cancel <task_id>        Cancel a running task
  retry <task_id>         Retry a failed task
  checkout <task_id>      Switch to task worktree or manage worktrees
                          Also supports: checkout --list, checkout --cleanup [<task_id>]
  shell <task_id>         Attach interactive shell to running task container
  serve [--port]          Start the API server
  daemon <cmd>            Manage background daemon (start|stop|status)
  install-service         Install APEX daemon as system service
  uninstall-service       Remove APEX daemon system service
  pr <task_id>            Create a pull request
  think <thought>         Capture, manage, and promote thoughts and ideas

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
