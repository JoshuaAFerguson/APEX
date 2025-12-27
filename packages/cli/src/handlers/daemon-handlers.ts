import chalk from 'chalk';
import { DaemonManager, DaemonError, DaemonStatus, ExtendedDaemonStatus, CapacityStatusInfo } from '@apex/orchestrator';
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

  const extendedStatus = await manager.getExtendedStatus();

  console.log(chalk.cyan('\nDaemon Status'));
  console.log(chalk.gray('─'.repeat(36)));

  if (extendedStatus.running && extendedStatus.pid && extendedStatus.startedAt && extendedStatus.uptime) {
    console.log(`  State:           ${chalk.green('running')}`);
    console.log(`  PID:             ${extendedStatus.pid}`);
    console.log(`  Started:         ${extendedStatus.startedAt.toLocaleString()}`);
    console.log(`  Uptime:          ${formatDuration(extendedStatus.uptime)}`);
    console.log(`  Log file:        ${chalk.gray('.apex/daemon.log')}`);

    // Display capacity information if available
    if (extendedStatus.capacity) {
      displayCapacityStatus(extendedStatus.capacity);
    } else {
      console.log();
      console.log(chalk.cyan('Capacity Status'));
      console.log(chalk.gray('─'.repeat(36)));
      console.log(`  ${chalk.yellow('⚠')} State file not found. Daemon may be starting up.`);
      console.log('    Capacity information will be available once daemon is fully initialized.');
    }
  } else {
    console.log(`  State:           ${chalk.gray('stopped')}`);
    console.log();
    console.log(chalk.gray("Use '/daemon start' to start the daemon."));
  }
  console.log();
}

/**
 * Display capacity status information
 */
function displayCapacityStatus(capacity: CapacityStatusInfo): void {
  console.log();
  console.log(chalk.cyan('Capacity Status'));
  console.log(chalk.gray('─'.repeat(36)));

  if (!capacity.timeBasedUsageEnabled) {
    console.log('  Time-based usage is disabled.');
    console.log('  Configure in .apex/config.yaml under daemon.timeBasedUsage');
    return;
  }

  // Format mode display
  const modeText = formatModeDisplay(capacity.mode);
  console.log(`  Mode:            ${modeText}`);

  // Format threshold
  const thresholdPercent = (capacity.capacityThreshold * 100).toFixed(0);
  console.log(`  Threshold:       ${thresholdPercent}%`);

  // Format current usage
  const usagePercent = (capacity.currentUsagePercent * 100).toFixed(1);
  const usageColor = capacity.currentUsagePercent >= capacity.capacityThreshold ? chalk.red :
                     capacity.currentUsagePercent >= 0.8 ? chalk.yellow : chalk.green;
  console.log(`  Current Usage:   ${usageColor(usagePercent + '%')}`);

  // Auto-pause status
  const pauseText = capacity.isAutoPaused ?
    `${chalk.red('Yes')}${capacity.pauseReason ? ` (${capacity.pauseReason})` : ''}` :
    chalk.green('No');
  console.log(`  Auto-Pause:      ${pauseText}`);

  // Next mode switch
  const nextModeTime = capacity.nextModeSwitch.toLocaleTimeString();
  const nextModeText = getNextModeText(capacity.mode);
  console.log(`  Next Mode:       ${nextModeText} at ${nextModeTime}`);

  // Show warning if auto-paused
  if (capacity.isAutoPaused) {
    console.log();
    console.log(`  ${chalk.yellow('⚠')} Tasks paused. Will resume when capacity available or mode changes.`);
  }
}

/**
 * Format mode display with time range
 */
function formatModeDisplay(mode: 'day' | 'night' | 'off-hours'): string {
  switch (mode) {
    case 'day':
      return `${chalk.yellow('day')} ${chalk.gray('(9:00 AM - 6:00 PM)')}`;
    case 'night':
      return `${chalk.blue('night')} ${chalk.gray('(10:00 PM - 6:00 AM)')}`;
    case 'off-hours':
      return chalk.gray('off-hours');
    default:
      return mode;
  }
}

/**
 * Get the text for the next mode transition
 */
function getNextModeText(currentMode: 'day' | 'night' | 'off-hours'): string {
  switch (currentMode) {
    case 'day':
      return 'night';
    case 'night':
      return 'day';
    case 'off-hours':
      return 'active hours';
    default:
      return 'next mode';
  }
}

/**
 * Handle daemon health command
 */
export async function handleDaemonHealth(ctx: ApexContext): Promise<void> {
  const manager = new DaemonManager({
    projectPath: ctx.cwd,
  });

  try {
    const healthReport = await manager.getHealthReport();
    displayHealthReport(healthReport);
  } catch (error) {
    if (error instanceof DaemonError) {
      handleDaemonError(error);
    } else {
      console.log(chalk.red(`Failed to get health report: ${(error as Error).message}`));
    }
  }
}

/**
 * Display formatted health report with bar charts and color coding
 */
function displayHealthReport(healthReport: any): void {
  console.log(chalk.cyan('\nDaemon Health Report'));
  console.log(chalk.gray('─'.repeat(50)));

  // Uptime
  console.log(`  Uptime:              ${formatDuration(healthReport.uptime)}`);

  // Memory usage with bar chart
  console.log();
  console.log(chalk.cyan('Memory Usage'));
  console.log(chalk.gray('─'.repeat(50)));

  const memUsage = healthReport.memoryUsage;
  const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const heapBar = createMemoryBar(heapUsagePercent);

  console.log(`  Heap Used:           ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)} (${heapUsagePercent.toFixed(1)}%)`);
  console.log(`                       ${heapBar}`);
  console.log(`  RSS:                 ${formatBytes(memUsage.rss)}`);

  // Task statistics
  console.log();
  console.log(chalk.cyan('Task Statistics'));
  console.log(chalk.gray('─'.repeat(50)));

  const taskCounts = healthReport.taskCounts;
  console.log(`  Processed:           ${chalk.green(taskCounts.processed)}`);
  console.log(`  Succeeded:           ${chalk.green(taskCounts.succeeded)}`);
  console.log(`  Failed:              ${taskCounts.failed > 0 ? chalk.red(taskCounts.failed) : chalk.gray(taskCounts.failed)}`);
  console.log(`  Active:              ${taskCounts.active > 0 ? chalk.yellow(taskCounts.active) : chalk.gray(taskCounts.active)}`);

  // Health check statistics
  console.log();
  console.log(chalk.cyan('Health Check Statistics'));
  console.log(chalk.gray('─'.repeat(50)));

  const totalChecks = healthReport.healthChecksPassed + healthReport.healthChecksFailed;
  const passRate = totalChecks > 0 ? (healthReport.healthChecksPassed / totalChecks * 100).toFixed(1) : '0.0';
  const passRateColor = parseFloat(passRate) >= 95 ? chalk.green : parseFloat(passRate) >= 80 ? chalk.yellow : chalk.red;

  console.log(`  Passed:              ${chalk.green(healthReport.healthChecksPassed)}`);
  console.log(`  Failed:              ${healthReport.healthChecksFailed > 0 ? chalk.red(healthReport.healthChecksFailed) : chalk.gray(healthReport.healthChecksFailed)}`);
  console.log(`  Pass Rate:           ${passRateColor(passRate + '%')}`);
  console.log(`  Last Check:          ${healthReport.lastHealthCheck.toLocaleString()}`);

  // Restart history (last 5 events)
  console.log();
  console.log(chalk.cyan('Recent Restart Events (Last 5)'));
  console.log(chalk.gray('─'.repeat(50)));

  if (healthReport.restartHistory.length === 0) {
    console.log(`  ${chalk.gray('No restart events recorded')}`);
  } else {
    const recentRestarts = healthReport.restartHistory.slice(0, 5);
    recentRestarts.forEach((restart: any, index: number) => {
      const timeStr = restart.timestamp.toLocaleString();
      const reasonColor = restart.triggeredByWatchdog ? chalk.red : chalk.yellow;
      const watchdogText = restart.triggeredByWatchdog ? ' (watchdog)' : '';
      const exitCodeText = restart.exitCode !== undefined ? ` [exit: ${restart.exitCode}]` : '';

      console.log(`  ${index + 1}. ${timeStr}`);
      console.log(`     ${reasonColor(restart.reason)}${watchdogText}${exitCodeText}`);
    });
  }

  console.log();
}

/**
 * Create a visual memory usage bar chart
 */
function createMemoryBar(percentage: number, width: number = 30): string {
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  let color = chalk.green;
  if (percentage > 80) color = chalk.red;
  else if (percentage > 60) color = chalk.yellow;

  const filledBar = '█'.repeat(filled);
  const emptyBar = '░'.repeat(empty);

  return `[${color(filledBar)}${chalk.gray(emptyBar)}]`;
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
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