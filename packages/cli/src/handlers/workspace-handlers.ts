import chalk from 'chalk';
import { CliContext } from '../index.js';
import { WorkspaceInfo } from '@apexcli/orchestrator'; // Corrected import path for WorkspaceInfo

// Helper to format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let result = [];
  if (days > 0) result.push(`${days}d`);
  if (hours % 24 > 0) result.push(`${hours % 24}h`);
  if (minutes % 60 > 0) result.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 || result.length === 0) result.push(`${seconds % 60}s`);
  return result.join(' ');
}


export async function handleWorkspaceList(ctx: CliContext): Promise<void> {
  if (!ctx.orchestrator) {
    console.log(chalk.red('❌ Orchestrator not available'));
    return;
  }

  try {
    const workspaces = await ctx.orchestrator.listAllWorkspaces();

    if (workspaces.length === 0) {
      console.log(chalk.gray('\nNo active task workspaces found.\n'));
      return;
    }

    console.log(chalk.cyan('\n📋 Active Task Workspaces:\n'));

    for (const ws of workspaces) {
      console.log(`  ${chalk.bold(ws.taskId.substring(0, 12))}`);
      console.log(`    Strategy: ${chalk.yellow(ws.config.strategy)}`);
      console.log(`    Path: ${chalk.gray(ws.workspacePath)}`);
      console.log(`    Status: ${ws.status === 'active' ? chalk.green('active') : chalk.red(ws.status)}`);
      console.log(`    Created: ${chalk.gray(ws.createdAt.toLocaleString())}`);
      console.log(`    Last Accessed: ${chalk.gray(ws.lastAccessed.toLocaleString())}`);
      if (ws.containerId) {
        console.log(`    Container ID: ${chalk.blue(ws.containerId.substring(0, 12))}`);
      }
      if (ws.warnings && ws.warnings.length > 0) {
        console.log(chalk.yellow('    Warnings:'));
        ws.warnings.forEach(w => console.log(chalk.yellow(`      - ${w}`)));
      }
      console.log();
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to list workspaces: ${(error as Error).message}\n`));
  }
}

export async function handleWorkspaceInfo(ctx: CliContext, args: string[]): Promise<void> {
  if (!ctx.orchestrator) {
    console.log(chalk.red('❌ Orchestrator not available'));
    return;
  }

  const taskId = args[0];
  if (!taskId) {
    console.log(chalk.red('Usage: /workspace info <task-id>'));
    return;
  }

  try {
    const workspaceManager = ctx.orchestrator.getWorkspaceManager();
    const workspace = workspaceManager.getWorkspace(taskId);

    if (!workspace) {
      console.log(chalk.red(`\nWorkspace not found for task: ${taskId}\n`));
      return;
    }

    console.log(chalk.cyan(`\n📊 Workspace Info for Task ${chalk.bold(workspace.taskId.substring(0, 12))}:\n`));
    console.log(`  Strategy: ${chalk.yellow(workspace.config.strategy)}`);
    console.log(`  Path: ${chalk.gray(workspace.workspacePath)}`);
    console.log(`  Status: ${workspace.status === 'active' ? chalk.green('active') : chalk.red(workspace.status)}`);
    console.log(`  Created: ${chalk.gray(workspace.createdAt.toLocaleString())}`);
    console.log(`  Last Accessed: ${chalk.gray(workspace.lastAccessed.toLocaleString())}`);
    if (workspace.containerId) {
      console.log(`  Container ID: ${chalk.blue(workspace.containerId.substring(0, 12))}`);
      try {
        const containerHealth = await workspaceManager.getContainerHealth(workspace.taskId);
        if (containerHealth) {
          console.log(chalk.magenta('\n  Container Health:'));
          console.log(`    Status: ${containerHealth.status}`);
          console.log(`    Running: ${containerHealth.running ? chalk.green('Yes') : chalk.red('No')}`);
          console.log(`    CPU Usage: ${containerHealth.cpuUsage}%`);
          console.log(`    Memory Usage: ${(containerHealth.memoryUsageMb / 1024).toFixed(2)} GB`);
          console.log(`    Restarts: ${containerHealth.restarts}`);
          console.log(`    Uptime: ${formatDuration(containerHealth.uptimeMs)}`);
        }
      } catch (healthError) {
        console.log(chalk.yellow(`  Failed to get container health: ${(healthError as Error).message}`));
      }
    }
    if (workspace.warnings && workspace.warnings.length > 0) {
      console.log(chalk.yellow('\n  Warnings:'));
      workspace.warnings.forEach(w => console.log(chalk.yellow(`    - ${w}`)));
    }
    console.log();
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to get workspace info: ${(error as Error).message}\n`));
  }
}

export async function handleWorkspaceCleanup(ctx: CliContext, args: string[]): Promise<void> {
  if (!ctx.orchestrator) {
    console.log(chalk.red('❌ Orchestrator not available'));
    return;
  }

  const taskId = args[0];

  try {
    const workspaceManager = ctx.orchestrator.getWorkspaceManager();

    if (taskId) {
      // Clean up specific workspace
      console.log(chalk.blue(`\n🧹 Cleaning up workspace for task ${taskId}...`));
      await workspaceManager.cleanupWorkspace(taskId);
      console.log(chalk.green(`✅ Workspace for task ${taskId} cleaned up successfully.`));
    } else {
      // Clean up old workspaces
      console.log(chalk.blue('\n🧹 Cleaning up all old workspaces...\n'));
      await workspaceManager.cleanupOldWorkspaces();
      console.log(chalk.green('✅ Old workspaces cleanup initiated. Check logs for details.'));
    }
    console.log();
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to cleanup workspaces: ${(error as Error).message}\n`));
  }
}

export async function handleWorkspaceStats(ctx: CliContext): Promise<void> {
  if (!ctx.orchestrator) {
    console.log(chalk.red('❌ Orchestrator not available'));
    return;
  }

  try {
    const workspaceManager = ctx.orchestrator.getWorkspaceManager();
    const stats = await workspaceManager.getWorkspaceStats();

    console.log(chalk.cyan('\n📈 Workspace Statistics:\n'));
    console.log(`  Active Workspaces: ${chalk.green(stats.activeCount)}`);
    console.log(`  Cleanup Pending: ${chalk.yellow(stats.cleanupPendingCount)}`);
    console.log(`  Total Disk Usage: ${chalk.magenta((stats.totalDiskUsage / (1024 * 1024)).toFixed(2))} MB`); // Convert bytes to MB

    console.log(chalk.blue('\n  Workspaces by Strategy:'));
    for (const strategy in stats.workspacesByStrategy) {
      console.log(`    ${chalk.yellow(strategy)}: ${stats.workspacesByStrategy[strategy]}`);
    }

    if (stats.oldestWorkspace) {
      console.log(chalk.blue('\n  Oldest Workspace:'));
      console.log(`    Task ID: ${chalk.gray(stats.oldestWorkspace.taskId.substring(0, 12))}`);
      console.log(`    Created: ${chalk.gray(stats.oldestWorkspace.createdAt.toLocaleString())}`);
    }

    if (stats.containerHealthStats) {
      console.log(chalk.magenta('\n  Container Health Stats:'));
      console.log(`    Monitored Containers: ${stats.containerHealthStats.monitoredContainers}`);
      console.log(`    Healthy Containers: ${chalk.green(stats.containerHealthStats.healthyContainers)}`);
      console.log(`    Unhealthy Containers: ${chalk.red(stats.containerHealthStats.unhealthyContainers)}`);
      console.log(`    Total Restarts: ${stats.containerHealthStats.totalRestarts}`);
    }
    console.log();
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to get workspace stats: ${(error as Error).message}\n`));
  }
}
