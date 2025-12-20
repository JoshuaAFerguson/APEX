import chalk from 'chalk';
import { DaemonManager, DaemonError, DaemonStatus } from '@apex/orchestrator';
import { formatDuration } from '@apex/core';

/**
 * Interface representing the CLI context
 * This matches the ApexContext interface from index.ts
 */
interface ApexContext {
  cwd: string;
  initialized: boolean;
}

/**
 * Handle daemon start command
 */
export async function handleDaemonStart(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  if (!ctx.initialized) {
    console.log(chalk.red('APEX not initialized. Run /init first.'));
    return;
  }

  // Parse options
  let pollInterval: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--poll-interval' || args[i] === '-i') {
      const intervalStr = args[++i];
      if (intervalStr) {
        const parsed = parseInt(intervalStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
          pollInterval = parsed;
        } else {
          console.log(chalk.red('Invalid poll interval. Must be a positive number.'));
          return;
        }
      }
    }
  }

  const manager = new DaemonManager({
    projectPath: ctx.cwd,
    pollIntervalMs: pollInterval,
  });

  try {
    const pid = await manager.startDaemon();
    console.log(chalk.green(`✓ Daemon started (PID: ${pid})`));
    console.log(chalk.gray(`  Polling every ${pollInterval || 5000}ms for queued tasks`));
    console.log(chalk.gray(`  Logs: .apex/daemon.log`));
  } catch (error) {
    if (error instanceof DaemonError) {
      handleDaemonError(error);
    } else {
      console.log(chalk.red(`Failed to start daemon: ${(error as Error).message}`));
    }
  }
}

/**
 * Handle daemon stop command
 */
export async function handleDaemonStop(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  const force = args.includes('--force') || args.includes('-f');

  const manager = new DaemonManager({
    projectPath: ctx.cwd,
  });

  try {
    const status = await manager.getStatus();

    if (!status.running) {
      console.log(chalk.yellow('Daemon is not running.'));
      return;
    }

    if (force) {
      await manager.killDaemon();
      console.log(chalk.green('✓ Daemon killed (force)'));
    } else {
      await manager.stopDaemon();
      console.log(chalk.green('✓ Daemon stopped'));
    }
  } catch (error) {
    if (error instanceof DaemonError) {
      handleDaemonError(error);
    } else {
      console.log(chalk.red(`Failed to stop daemon: ${(error as Error).message}`));
    }
  }
}

/**
 * Handle daemon status command
 */
export async function handleDaemonStatus(ctx: ApexContext): Promise<void> {
  const manager = new DaemonManager({
    projectPath: ctx.cwd,
  });

  const status = await manager.getStatus();

  console.log(chalk.cyan('\nDaemon Status'));
  console.log(chalk.gray('─'.repeat(36)));

  if (status.running && status.pid && status.startedAt && status.uptime) {
    console.log(`  State:      ${chalk.green('running')}`);
    console.log(`  PID:        ${status.pid}`);
    console.log(`  Started:    ${status.startedAt.toLocaleString()}`);
    console.log(`  Uptime:     ${formatDuration(status.uptime)}`);
    console.log(`  Log file:   ${chalk.gray('.apex/daemon.log')}`);
  } else {
    console.log(`  State:      ${chalk.gray('stopped')}`);
    console.log();
    console.log(chalk.gray("Use '/daemon start' to start the daemon."));
  }
  console.log();
}

/**
 * Handle daemon-specific errors with user-friendly messages
 */
function handleDaemonError(error: DaemonError): void {
  const messages: Record<string, string> = {
    ALREADY_RUNNING: 'Daemon is already running.',
    NOT_RUNNING: 'Daemon is not running.',
    PERMISSION_DENIED: 'Permission denied. Check .apex directory permissions.',
    START_FAILED: `Failed to start daemon: ${error.cause?.message || 'unknown error'}`,
    STOP_FAILED: `Failed to stop daemon: ${error.cause?.message || 'unknown error'}`,
    PID_FILE_CORRUPTED: "PID file is corrupted. Try '/daemon stop --force'.",
    LOCK_FAILED: 'Failed to acquire lock on PID file.',
  };

  console.log(chalk.red(messages[error.code] || error.message));
}