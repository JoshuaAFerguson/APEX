#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import inquirer from 'inquirer';
import * as path from 'path';
import * as fs from 'fs/promises';
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
} from '@apex/core';
import { ApexOrchestrator, TaskStore } from '@apex/orchestrator';
import { startServer } from '@apex/api';

const VERSION = '0.1.0';

const program = new Command();

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

program
  .name('apex')
  .description('AI-powered development team automation')
  .version(VERSION);

// ============================================================================
// INIT Command
// ============================================================================

program
  .command('init')
  .description('Initialize APEX in the current project')
  .option('-n, --name <name>', 'Project name')
  .option('-l, --language <language>', 'Primary language (typescript, python, etc.)')
  .option('-f, --framework <framework>', 'Framework (nextjs, fastapi, etc.)')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (options) => {
    const cwd = process.cwd();

    // Check if already initialized
    if (await isApexInitialized(cwd)) {
      console.log(chalk.yellow('APEX is already initialized in this directory.'));
      return;
    }

    console.log(chalk.cyan(banner));

    let projectName = options.name;
    let language = options.language;
    let framework = options.framework;

    if (!options.yes) {
      // Interactive prompts
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: path.basename(cwd),
          when: !projectName,
        },
        {
          type: 'list',
          name: 'language',
          message: 'Primary language:',
          choices: ['typescript', 'javascript', 'python', 'go', 'rust', 'other'],
          when: !language,
        },
        {
          type: 'input',
          name: 'framework',
          message: 'Framework (optional):',
          when: !framework,
        },
      ]);

      projectName = projectName || answers.projectName;
      language = language || answers.language;
      framework = framework || answers.framework;
    }

    projectName = projectName || path.basename(cwd);

    const spinner = ora('Initializing APEX...').start();

    try {
      await initializeApex(cwd, {
        projectName,
        language,
        framework,
      });

      // Copy default agent templates
      await copyDefaultAgents(cwd);

      // Copy default workflow templates
      await copyDefaultWorkflows(cwd);

      // Create helper scripts
      await createHelperScripts(cwd);

      spinner.succeed('APEX initialized successfully!');

      console.log(
        boxen(
          `${chalk.green('APEX is ready!')}\n\n` +
            `Configuration: ${chalk.cyan('.apex/config.yaml')}\n` +
            `Agents: ${chalk.cyan('.apex/agents/')}\n` +
            `Workflows: ${chalk.cyan('.apex/workflows/')}\n\n` +
            `Next steps:\n` +
            `  1. Review and customize .apex/config.yaml\n` +
            `  2. Add custom agents in .apex/agents/\n` +
            `  3. Run ${chalk.cyan('apex run "your task"')} to start`,
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        )
      );
    } catch (error) {
      spinner.fail('Failed to initialize APEX');
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// RUN Command
// ============================================================================

program
  .command('run [description]')
  .description('Execute a development task')
  .option('-w, --workflow <name>', 'Workflow to use')
  .option('-a, --autonomy <level>', 'Autonomy level (full, review-before-commit, review-before-merge, manual)')
  .option('-p, --priority <level>', 'Task priority (low, normal, high, urgent)')
  .option('-c, --criteria <criteria>', 'Acceptance criteria')
  .option('-i, --interactive', 'Use interactive mode for all options')
  .option('--dry-run', 'Plan the task without executing')
  .option('--verbose', 'Show detailed output')
  .action(async (description, options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    // Interactive mode: prompt for missing values
    const interactive = options.interactive || !description;
    let taskDescription = description;
    let taskWorkflow = options.workflow;
    let taskAutonomy = options.autonomy;
    let taskPriority = options.priority;
    let taskCriteria = options.criteria;

    if (interactive) {
      const workflowsMap = await loadWorkflows(cwd);
      const workflowChoices = Object.values(workflowsMap).map((w) => ({
        name: `${w.name} - ${w.description}`,
        value: w.name,
      }));

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'What would you like to do?',
          when: !taskDescription,
          validate: (input: string) => (input.trim() ? true : 'Description is required'),
        },
        {
          type: 'list',
          name: 'workflow',
          message: 'Select a workflow:',
          choices: workflowChoices,
          default: 'feature',
          when: !taskWorkflow,
        },
        {
          type: 'list',
          name: 'autonomy',
          message: 'Select autonomy level:',
          choices: [
            { name: 'Full - Execute without human intervention', value: 'full' },
            { name: 'Review before commit - Pause for review before commits', value: 'review-before-commit' },
            { name: 'Review before merge - Pause for review before merging', value: 'review-before-merge' },
            { name: 'Manual - Require approval for each step', value: 'manual' },
          ],
          default: 'full',
          when: !taskAutonomy,
        },
        {
          type: 'list',
          name: 'priority',
          message: 'Select task priority:',
          choices: [
            { name: 'Urgent - Execute immediately', value: 'urgent' },
            { name: 'High - Prioritize over other tasks', value: 'high' },
            { name: 'Normal - Standard priority', value: 'normal' },
            { name: 'Low - Execute when resources available', value: 'low' },
          ],
          default: 'normal',
          when: !taskPriority,
        },
        {
          type: 'input',
          name: 'criteria',
          message: 'Acceptance criteria (optional):',
          when: !taskCriteria,
        },
      ]);

      taskDescription = taskDescription || answers.description;
      taskWorkflow = taskWorkflow || answers.workflow;
      taskAutonomy = taskAutonomy || answers.autonomy;
      taskPriority = taskPriority || answers.priority;
      taskCriteria = taskCriteria || answers.criteria;
    }

    // Apply defaults for non-interactive mode
    taskWorkflow = taskWorkflow || 'feature';
    taskPriority = taskPriority || 'normal';

    console.log(chalk.cyan('\n🚀 Starting APEX task...\n'));

    const orchestrator = new ApexOrchestrator({ projectPath: cwd });

    try {
      await orchestrator.initialize();

      // Create task
      const task = await orchestrator.createTask({
        description: taskDescription!,
        acceptanceCriteria: taskCriteria,
        workflow: taskWorkflow,
        autonomy: taskAutonomy,
        priority: taskPriority,
      });

      console.log(chalk.green(`Task created: ${task.id}`));
      console.log(chalk.gray(`Branch: ${task.branchName}`));
      console.log(chalk.gray(`Workflow: ${task.workflow}`));
      console.log(chalk.gray(`Priority: ${task.priority}`));
      console.log(chalk.gray(`Autonomy: ${task.autonomy}\n`));

      if (options.dryRun) {
        console.log(chalk.yellow('Dry run - task not executed.'));
        return;
      }

      // Set up event handlers
      orchestrator.on('task:stage-changed', (t, stage) => {
        console.log(chalk.blue(`\n📍 Stage: ${stage}`));
      });

      orchestrator.on('agent:message', (taskId, message) => {
        if (options.verbose) {
          console.log(chalk.gray(JSON.stringify(message, null, 2)));
        }
      });

      orchestrator.on('agent:tool-use', (taskId, tool, input) => {
        console.log(chalk.gray(`  🔧 ${tool}`));
      });

      orchestrator.on('usage:updated', (taskId, usage) => {
        if (options.verbose) {
          console.log(
            chalk.gray(`  📊 Tokens: ${formatTokens(usage.totalTokens)} | Cost: ${formatCost(usage.estimatedCost)}`)
          );
        }
      });

      // Execute task
      const spinner = ora('Executing task...').start();

      await orchestrator.executeTask(task.id);

      spinner.succeed('Task completed!');

      // Show summary
      const completedTask = await orchestrator.getTask(task.id);
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
      console.error(chalk.red(`\n❌ Task failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// ============================================================================
// STATUS Command
// ============================================================================

program
  .command('status [taskId]')
  .description('Check task status')
  .option('-a, --all', 'Show all tasks')
  .option('-n, --limit <number>', 'Number of tasks to show', '10')
  .action(async (taskId, options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const orchestrator = new ApexOrchestrator({ projectPath: cwd });
    await orchestrator.initialize();

    if (taskId) {
      // Show specific task
      const task = await orchestrator.getTask(taskId);
      if (!task) {
        console.log(chalk.red(`Task not found: ${taskId}`));
        process.exit(1);
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
      // List tasks
      const tasks = await orchestrator.listTasks({ limit: parseInt(options.limit) });

      if (tasks.length === 0) {
        console.log(chalk.gray('No tasks found.'));
        return;
      }

      console.log(chalk.cyan('\nRecent Tasks:\n'));

      for (const task of tasks) {
        const status = `${getStatusEmoji(task.status)} ${task.status.padEnd(12)}`;
        const cost = formatCost(task.usage.estimatedCost).padStart(10);
        console.log(
          `${chalk.gray(task.id.substring(0, 16))} ${status} ${cost}  ${task.description.substring(0, 50)}`
        );
      }
    }
  });

// ============================================================================
// AGENTS Command
// ============================================================================

program
  .command('agents')
  .description('List available agents')
  .action(async () => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const agents = await loadAgents(cwd);
    const config = await loadConfig(cwd);

    console.log(chalk.cyan('\nAvailable Agents:\n'));

    for (const [name, agent] of Object.entries(agents)) {
      const enabled = !config.agents?.disabled?.includes(name);
      const status = enabled ? chalk.green('✓') : chalk.red('✗');
      const model = agent.model || 'sonnet';
      const tools = agent.tools?.join(', ') || 'all';

      console.log(`${status} ${chalk.bold(name)} (${model})`);
      console.log(`  ${chalk.gray(agent.description)}`);
      console.log(`  ${chalk.gray(`Tools: ${tools}`)}\n`);
    }
  });

// ============================================================================
// WORKFLOWS Command
// ============================================================================

program
  .command('workflows')
  .description('List available workflows')
  .action(async () => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const workflows = await loadWorkflows(cwd);

    console.log(chalk.cyan('\nAvailable Workflows:\n'));

    for (const [name, workflow] of Object.entries(workflows)) {
      console.log(chalk.bold(name));
      console.log(`  ${chalk.gray(workflow.description)}`);
      console.log(`  Stages: ${workflow.stages.map((s) => s.name).join(' → ')}\n`);
    }
  });

// ============================================================================
// LOGS Command
// ============================================================================

program
  .command('logs <taskId>')
  .description('Show task logs')
  .option('-f, --follow', 'Follow log output')
  .option('-l, --level <level>', 'Filter by log level (debug, info, warn, error)')
  .action(async (taskId, options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const orchestrator = new ApexOrchestrator({ projectPath: cwd });
    await orchestrator.initialize();

    const task = await orchestrator.getTask(taskId);
    if (!task) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      process.exit(1);
    }

    console.log(chalk.cyan(`\nLogs for task: ${taskId}\n`));

    for (const log of task.logs) {
      if (options.level && log.level !== options.level) continue;

      const level = getLevelColor(log.level);
      const time = log.timestamp.toLocaleTimeString();
      const agent = log.agent ? `[${log.agent}]` : '';

      console.log(`${chalk.gray(time)} ${level} ${agent} ${log.message}`);
    }
  });

// ============================================================================
// SERVE Command
// ============================================================================

program
  .command('serve')
  .description('Start the APEX API server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-H, --host <host>', 'Host to bind to', '0.0.0.0')
  .action(async (options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const port = parseInt(options.port, 10);
    const host = options.host;

    console.log(chalk.cyan(banner));

    try {
      await startServer({ projectPath: cwd, port, host });
    } catch (error) {
      console.error(chalk.red(`Failed to start server: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// ============================================================================
// CANCEL Command
// ============================================================================

program
  .command('cancel <taskId>')
  .description('Cancel a running task')
  .option('-f, --force', 'Force cancel without confirmation')
  .action(async (taskId, options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const store = new TaskStore(cwd);
    await store.initialize();

    const task = await store.getTask(taskId);
    if (!task) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      store.close();
      process.exit(1);
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      console.log(chalk.yellow(`Task is already ${task.status}.`));
      store.close();
      return;
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Cancel task ${taskId}?`,
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray('Cancelled.'));
        store.close();
        return;
      }
    }

    await store.updateTask(taskId, {
      status: 'cancelled',
      error: 'Cancelled by user',
      updatedAt: new Date(),
    });

    console.log(chalk.green(`Task ${taskId} cancelled.`));
    store.close();
  });

// ============================================================================
// RETRY Command
// ============================================================================

program
  .command('retry <taskId>')
  .description('Retry a failed task')
  .option('-w, --workflow <name>', 'Use different workflow')
  .action(async (taskId, options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const orchestrator = new ApexOrchestrator({ projectPath: cwd });
    await orchestrator.initialize();

    const originalTask = await orchestrator.getTask(taskId);
    if (!originalTask) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      process.exit(1);
    }

    if (originalTask.status !== 'failed' && originalTask.status !== 'cancelled') {
      console.log(chalk.yellow(`Task is ${originalTask.status}. Only failed or cancelled tasks can be retried.`));
      process.exit(1);
    }

    console.log(chalk.cyan('\n🔄 Retrying task...\n'));
    console.log(chalk.gray(`Original task: ${taskId}`));
    console.log(chalk.gray(`Description: ${originalTask.description}`));

    // Create a new task with the same parameters
    const newTask = await orchestrator.createTask({
      description: originalTask.description,
      acceptanceCriteria: originalTask.acceptanceCriteria,
      workflow: options.workflow || originalTask.workflow,
      autonomy: originalTask.autonomy,
    });

    console.log(chalk.green(`\nNew task created: ${newTask.id}`));
    console.log(chalk.gray(`Branch: ${newTask.branchName}`));

    // Set up event handlers
    orchestrator.on('agent:tool-use', (tId, tool) => {
      console.log(chalk.gray(`  🔧 ${tool}`));
    });

    // Execute the new task
    const spinner = ora('Executing task...').start();

    try {
      await orchestrator.executeTask(newTask.id);
      spinner.succeed('Task completed!');

      const completedTask = await orchestrator.getTask(newTask.id);
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
      spinner.fail('Task failed');
      console.error(chalk.red(`\n❌ ${(error as Error).message}`));
      process.exit(1);
    }
  });

// ============================================================================
// CONFIG Command
// ============================================================================

program
  .command('config')
  .description('View or edit APEX configuration')
  .option('-g, --get <key>', 'Get a specific config value')
  .option('-s, --set <key=value>', 'Set a config value')
  .option('--json', 'Output as JSON')
  .option('-e, --edit', 'Open config in editor')
  .action(async (options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const config = await loadConfig(cwd);

    if (options.edit) {
      const editor = process.env.EDITOR || 'vim';
      const configPath = path.join(cwd, '.apex', 'config.yaml');
      const { spawn } = await import('child_process');

      const child = spawn(editor, [configPath], { stdio: 'inherit' });
      child.on('exit', (code) => {
        process.exit(code || 0);
      });
      return;
    }

    if (options.set) {
      const [key, value] = options.set.split('=');
      if (!key || value === undefined) {
        console.log(chalk.red('Invalid format. Use --set key=value'));
        process.exit(1);
      }

      // Parse nested keys (e.g., "limits.maxCostPerTask")
      const keys = key.split('.');
      let current: Record<string, unknown> = config as unknown as Record<string, unknown>;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
          current[keys[i]] = {};
        }
        current = current[keys[i]] as Record<string, unknown>;
      }

      // Parse value (try to detect type)
      let parsedValue: unknown = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(Number(value))) parsedValue = Number(value);

      current[keys[keys.length - 1]] = parsedValue;

      await saveConfig(cwd, config);
      console.log(chalk.green(`Set ${key} = ${value}`));
      return;
    }

    if (options.get) {
      const keys = options.get.split('.');
      let current: unknown = config;

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = (current as Record<string, unknown>)[k];
        } else {
          console.log(chalk.red(`Key not found: ${options.get}`));
          process.exit(1);
        }
      }

      if (options.json) {
        console.log(JSON.stringify(current, null, 2));
      } else {
        console.log(current);
      }
      return;
    }

    // Show full config
    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      const effective = getEffectiveConfig(config);

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

      console.log(chalk.bold('\nGit:'));
      console.log(`  Branch Prefix: ${effective.git.branchPrefix}`);
      console.log(`  Commit Format: ${effective.git.commitFormat}`);
      console.log(`  Auto Push: ${effective.git.autoPush}`);
      console.log(`  Default Branch: ${effective.git.defaultBranch}`);

      console.log(chalk.bold('\nLimits:'));
      console.log(`  Max Tokens/Task: ${formatTokens(effective.limits.maxTokensPerTask)}`);
      console.log(`  Max Cost/Task: ${formatCost(effective.limits.maxCostPerTask)}`);
      console.log(`  Daily Budget: ${formatCost(effective.limits.dailyBudget)}`);
      console.log(`  Max Turns: ${effective.limits.maxTurns}`);
      console.log(`  Max Concurrent Tasks: ${effective.limits.maxConcurrentTasks}`);

      console.log(chalk.bold('\nAPI:'));
      console.log(`  URL: ${effective.api.url}`);
      console.log(`  Port: ${effective.api.port}`);

      console.log(chalk.gray('\nConfig file: .apex/config.yaml'));
    }
  });

// ============================================================================
// PR Command
// ============================================================================

program
  .command('pr <taskId>')
  .description('Create a pull request for a completed task')
  .option('-d, --draft', 'Create as draft PR')
  .option('-t, --title <title>', 'Custom PR title')
  .option('-b, --body <body>', 'Custom PR body')
  .action(async (taskId, options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const orchestrator = new ApexOrchestrator({ projectPath: cwd });
    await orchestrator.initialize();

    const task = await orchestrator.getTask(taskId);
    if (!task) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      process.exit(1);
    }

    if (task.status !== 'completed') {
      console.log(chalk.yellow(`Task is ${task.status}. PRs can only be created for completed tasks.`));
      process.exit(1);
    }

    if (task.prUrl) {
      console.log(chalk.yellow(`PR already exists: ${task.prUrl}`));
      return;
    }

    console.log(chalk.cyan('\n📝 Creating pull request...\n'));

    const spinner = ora('Creating PR...').start();

    const result = await orchestrator.createPullRequest(taskId, {
      draft: options.draft,
      title: options.title,
      body: options.body,
    });

    if (result.success) {
      spinner.succeed('Pull request created!');
      console.log(
        boxen(
          `${chalk.green('✅ PR Created')}\n\n` +
            `${chalk.cyan(result.prUrl)}\n\n` +
            `Task: ${task.description.substring(0, 50)}`,
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        )
      );
    } else {
      spinner.fail('Failed to create PR');
      console.error(chalk.red(`\n❌ ${result.error}`));
      process.exit(1);
    }
  });

// ============================================================================
// CLEAN Command
// ============================================================================

program
  .command('clean')
  .description('Clean up merged APEX branches')
  .option('-r, --remote', 'Also delete remote branches')
  .option('-f, --force', 'Delete without confirmation')
  .option('-a, --all', 'Clean all APEX branches (not just merged)')
  .action(async (options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    const config = await loadConfig(cwd);
    const branchPrefix = config.git?.branchPrefix || 'apex/';

    console.log(chalk.cyan('\n🧹 Cleaning APEX branches...\n'));

    const { execSync } = await import('child_process');

    try {
      // Get current branch
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf-8',
        cwd,
      }).trim();

      // Get merged branches matching the prefix
      let branchListCmd = options.all
        ? `git branch --list '${branchPrefix}*'`
        : `git branch --merged | grep '${branchPrefix}'`;

      let branches: string[];
      try {
        const output = execSync(branchListCmd, {
          encoding: 'utf-8',
          cwd,
        });
        branches = output
          .split('\n')
          .map((b) => b.trim().replace(/^\*\s*/, ''))
          .filter((b) => b && b !== currentBranch);
      } catch {
        branches = [];
      }

      if (branches.length === 0) {
        console.log(chalk.green('No APEX branches to clean.'));
        return;
      }

      console.log(chalk.bold('Branches to delete:'));
      for (const branch of branches) {
        console.log(`  ${chalk.yellow(branch)}`);
      }
      console.log();

      if (!options.force) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete ${branches.length} branch(es)?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }
      }

      const spinner = ora('Deleting branches...').start();

      let deletedCount = 0;
      let failedCount = 0;

      for (const branch of branches) {
        try {
          // Delete local branch
          execSync(`git branch -d "${branch}"`, { cwd, stdio: 'pipe' });
          deletedCount++;

          // Delete remote branch if requested
          if (options.remote) {
            try {
              execSync(`git push origin --delete "${branch}"`, {
                cwd,
                stdio: 'pipe',
              });
            } catch {
              // Remote branch may not exist
            }
          }
        } catch {
          // Try force delete if regular delete fails
          try {
            execSync(`git branch -D "${branch}"`, { cwd, stdio: 'pipe' });
            deletedCount++;

            if (options.remote) {
              try {
                execSync(`git push origin --delete "${branch}"`, {
                  cwd,
                  stdio: 'pipe',
                });
              } catch {
                // Ignore remote errors
              }
            }
          } catch {
            failedCount++;
          }
        }
      }

      spinner.succeed(`Cleaned ${deletedCount} branch(es)`);

      if (failedCount > 0) {
        console.log(chalk.yellow(`  ${failedCount} branch(es) could not be deleted (may contain unmerged changes)`));
      }

      if (options.remote) {
        console.log(chalk.gray('  Remote branches also deleted where available'));
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ ${(error as Error).message}`));
      process.exit(1);
    }
  });

// ============================================================================
// CHANGELOG Command
// ============================================================================

program
  .command('changelog')
  .description('Generate changelog from conventional commits')
  .option('-f, --from <ref>', 'Starting ref (tag or commit)', 'HEAD~20')
  .option('-t, --to <ref>', 'Ending ref', 'HEAD')
  .option('-v, --version <version>', 'Version number for changelog', 'Unreleased')
  .option('-o, --output <file>', 'Write to file instead of stdout')
  .option('--repo-url <url>', 'Repository URL for commit links')
  .option('--no-hashes', 'Exclude commit hashes')
  .option('--authors', 'Include author names')
  .action(async (options) => {
    const cwd = process.cwd();

    console.log(chalk.cyan('\n📋 Generating changelog...\n'));

    const { execSync } = await import('child_process');

    try {
      // Get git log
      const logOutput = execSync(`git log ${options.from}..${options.to} --format=medium`, {
        encoding: 'utf-8',
        cwd,
      });

      if (!logOutput.trim()) {
        console.log(chalk.yellow('No commits found in the specified range.'));
        return;
      }

      // Import changelog utilities
      const { parseGitLog, groupCommitsByType, generateChangelogMarkdown } = await import('@apex/core');

      // Parse commits
      const entries = parseGitLog(logOutput);
      const groups = groupCommitsByType(entries);

      // Get repo URL from git remote if not provided
      let repoUrl = options.repoUrl;
      if (!repoUrl) {
        try {
          const remoteUrl = execSync('git remote get-url origin', {
            encoding: 'utf-8',
            cwd,
          }).trim();

          // Convert SSH URL to HTTPS if needed
          if (remoteUrl.startsWith('git@')) {
            repoUrl = remoteUrl
              .replace('git@', 'https://')
              .replace(':', '/')
              .replace(/\.git$/, '');
          } else if (remoteUrl.startsWith('https://')) {
            repoUrl = remoteUrl.replace(/\.git$/, '');
          }
        } catch {
          // No remote URL available
        }
      }

      // Generate changelog
      const markdown = generateChangelogMarkdown(options.version, new Date(), groups, {
        includeHashes: options.hashes !== false,
        includeAuthors: options.authors,
        repoUrl,
      });

      // Output
      if (options.output) {
        await fs.writeFile(options.output, markdown);
        console.log(chalk.green(`Changelog written to ${options.output}`));
      } else {
        console.log(markdown);
      }

      // Summary
      const totalCommits = entries.length;
      const conventionalCount = entries.filter((e) => e.conventional).length;

      console.log(chalk.gray(`\nProcessed ${totalCommits} commits (${conventionalCount} conventional)`));

      if (conventionalCount < totalCommits * 0.5) {
        console.log(
          chalk.yellow(`\n⚠️  Only ${Math.round((conventionalCount / totalCommits) * 100)}% of commits follow conventional format.`)
        );
        console.log(chalk.gray('   Consider using conventional commits for better changelogs.'));
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ ${(error as Error).message}`));
      process.exit(1);
    }
  });

// ============================================================================
// CONFLICTS Command
// ============================================================================

program
  .command('conflicts')
  .description('Detect and suggest resolutions for merge conflicts')
  .option('-f, --file <path>', 'Check specific file for conflicts')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const cwd = process.cwd();

    console.log(chalk.cyan('\n🔍 Checking for merge conflicts...\n'));

    const { execSync } = await import('child_process');

    try {
      // Get list of files with conflicts
      let filesToCheck: string[] = [];

      if (options.file) {
        filesToCheck = [options.file];
      } else {
        // Check for unmerged paths
        try {
          const unmergedOutput = execSync('git diff --name-only --diff-filter=U', {
            encoding: 'utf-8',
            cwd,
          }).trim();

          if (unmergedOutput) {
            filesToCheck = unmergedOutput.split('\n').filter(Boolean);
          }
        } catch {
          // Not in a git repo or no conflicts
        }

        // Also check all tracked files if no unmerged paths found
        if (filesToCheck.length === 0) {
          console.log(chalk.gray('No unmerged paths detected. Checking working directory...\n'));
        }
      }

      // Import conflict detection utilities
      const { detectConflicts, formatConflictReport } = await import('@apex/core');

      const allConflicts: Array<{
        file: string;
        conflictMarkers: Array<{
          startLine: number;
          endLine: number;
          currentContent: string;
          incomingContent: string;
          baseContent?: string;
        }>;
        baseBranch?: string;
        incomingBranch?: string;
      }> = [];

      for (const file of filesToCheck) {
        const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const conflicts = detectConflicts(content, file);
          if (conflicts) {
            allConflicts.push(conflicts);
          }
        } catch (error) {
          console.log(chalk.yellow(`Could not read ${file}: ${(error as Error).message}`));
        }
      }

      // Output results
      if (options.json) {
        console.log(JSON.stringify(allConflicts, null, 2));
      } else if (allConflicts.length === 0) {
        console.log(chalk.green('✅ No merge conflicts detected!'));
      } else {
        const report = formatConflictReport(allConflicts);
        console.log(report);

        // Summary
        const totalConflicts = allConflicts.reduce((sum, c) => sum + c.conflictMarkers.length, 0);
        console.log(
          boxen(
            `${chalk.yellow('⚠️  Conflicts Found')}\n\n` +
              `Files: ${allConflicts.length}\n` +
              `Conflict regions: ${totalConflicts}\n\n` +
              `Run ${chalk.cyan('git mergetool')} or manually resolve conflicts`,
            { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
          )
        );
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ ${(error as Error).message}`));
      process.exit(1);
    }
  });

// ============================================================================
// UPGRADE Command
// ============================================================================

program
  .command('upgrade')
  .description('Check for and install APEX updates')
  .option('-c, --check', 'Check for updates without installing')
  .option('--pre', 'Include pre-release versions')
  .action(async (options) => {
    const packageName = '@apex/cli';

    console.log(chalk.cyan('\n🔍 Checking for updates...\n'));

    const spinner = ora('Fetching latest version...').start();

    try {
      // Get current version
      const currentVersion = VERSION;

      // Get latest version from npm
      const { execSync } = await import('child_process');
      const npmTag = options.pre ? 'next' : 'latest';

      let latestVersion: string;
      try {
        const npmInfo = execSync(`npm info ${packageName}@${npmTag} version 2>/dev/null`, {
          encoding: 'utf-8',
        }).trim();
        latestVersion = npmInfo;
      } catch {
        // Package not published yet, use current version
        spinner.info('Package not yet published to npm. Using local version.');
        console.log(chalk.gray(`Current version: ${currentVersion}`));
        console.log(chalk.gray('\nTo publish: npm publish'));
        return;
      }

      spinner.stop();

      // Compare versions
      const current = parseVersion(currentVersion);
      const latest = parseVersion(latestVersion);

      if (compareVersions(current, latest) >= 0) {
        console.log(chalk.green('✓ You are using the latest version!'));
        console.log(chalk.gray(`  Current: ${currentVersion}`));
        return;
      }

      // Update available
      console.log(
        boxen(
          `${chalk.yellow('Update available!')}\n\n` +
            `Current: ${chalk.red(currentVersion)}\n` +
            `Latest:  ${chalk.green(latestVersion)}\n\n` +
            `Run ${chalk.cyan('apex upgrade')} to update`,
          { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
        )
      );

      if (options.check) {
        return;
      }

      // Ask for confirmation
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Upgrade APEX from ${currentVersion} to ${latestVersion}?`,
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray('Upgrade cancelled.'));
        return;
      }

      // Perform upgrade
      const upgradeSpinner = ora('Upgrading APEX...').start();

      try {
        // Detect package manager
        const packageManager = detectPackageManager();

        let upgradeCmd: string;
        switch (packageManager) {
          case 'yarn':
            upgradeCmd = `yarn global add ${packageName}@${npmTag}`;
            break;
          case 'pnpm':
            upgradeCmd = `pnpm add -g ${packageName}@${npmTag}`;
            break;
          case 'bun':
            upgradeCmd = `bun add -g ${packageName}@${npmTag}`;
            break;
          default:
            upgradeCmd = `npm install -g ${packageName}@${npmTag}`;
        }

        execSync(upgradeCmd, { stdio: 'pipe' });

        upgradeSpinner.succeed('APEX upgraded successfully!');
        console.log(chalk.green(`\nNow running APEX ${latestVersion}`));
        console.log(chalk.gray('Run "apex --version" to verify.'));
      } catch (error) {
        upgradeSpinner.fail('Upgrade failed');
        console.error(chalk.red(`\n${(error as Error).message}`));
        console.log(chalk.gray('\nTry upgrading manually:'));
        console.log(chalk.cyan(`  npm install -g ${packageName}@${npmTag}`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Failed to check for updates');
      console.error(chalk.red(`\n${(error as Error).message}`));
      process.exit(1);
    }
  });

// ============================================================================
// Helper Functions
// ============================================================================

interface Version {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

function parseVersion(version: string): Version {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0 };
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
  };
}

function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // Pre-release versions are lower than release versions
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;

  return 0;
}

function detectPackageManager(): string {
  const { execSync } = require('child_process');

  try {
    execSync('bun --version', { stdio: 'pipe' });
    return 'bun';
  } catch {}

  try {
    execSync('pnpm --version', { stdio: 'pipe' });
    return 'pnpm';
  } catch {}

  try {
    execSync('yarn --version', { stdio: 'pipe' });
    return 'yarn';
  } catch {}

  return 'npm';
}

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

  // Default agent templates
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

  // Default workflow templates
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

// Run CLI
program.parse();
