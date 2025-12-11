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
  loadAgents,
  loadWorkflows,
  formatCost,
  formatTokens,
  formatDuration,
} from '@apex/core';
import { ApexOrchestrator } from '@apex/orchestrator';

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
  .command('run <description>')
  .description('Execute a development task')
  .option('-w, --workflow <name>', 'Workflow to use', 'feature')
  .option('-a, --autonomy <level>', 'Autonomy level (full, review-before-commit, review-before-merge, manual)')
  .option('-c, --criteria <criteria>', 'Acceptance criteria')
  .option('--dry-run', 'Plan the task without executing')
  .option('--verbose', 'Show detailed output')
  .action(async (description, options) => {
    const cwd = process.cwd();

    if (!(await isApexInitialized(cwd))) {
      console.log(chalk.red('APEX not initialized. Run "apex init" first.'));
      process.exit(1);
    }

    console.log(chalk.cyan('\n🚀 Starting APEX task...\n'));

    const orchestrator = new ApexOrchestrator({ projectPath: cwd });

    try {
      await orchestrator.initialize();

      // Create task
      const task = await orchestrator.createTask({
        description,
        acceptanceCriteria: options.criteria,
        workflow: options.workflow,
        autonomy: options.autonomy,
      });

      console.log(chalk.green(`Task created: ${task.id}`));
      console.log(chalk.gray(`Branch: ${task.branchName}`));
      console.log(chalk.gray(`Workflow: ${task.workflow}`));
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
