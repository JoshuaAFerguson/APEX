import chalk from 'chalk';
import { DaemonManager, ExtendedDaemonStatus } from '@apexcli/orchestrator';
import { CliContext } from '../index.js'; // Adjust path as necessary

export async function handleUsage(ctx: CliContext): Promise<void> {
  const daemonManager = new DaemonManager({ projectPath: ctx.cwd });

  try {
    const status: ExtendedDaemonStatus = await daemonManager.getExtendedStatus();

    console.log(chalk.cyan('\n📊 APEX Daemon Usage & Capacity Status\n'));

    // --- Daemon Running Status ---
    if (status.running) {
      console.log(`  ${chalk.green('●')} Daemon Status: ${chalk.green('Running')}`);
      console.log(`    PID: ${chalk.yellow(status.pid)}`);
      console.log(`    Started: ${chalk.gray(status.startedAt?.toLocaleString())}`);
      if (status.uptime) {
        console.log(`    Uptime: ${chalk.gray(formatUptime(status.uptime))}`);
      }
    } else {
      console.log(`  ${chalk.red('○')} Daemon Status: ${chalk.red('Not Running')}`);
      console.log(chalk.gray('    (Run /daemon start to begin monitoring usage)'));
      console.log();
      return; // No capacity info if daemon is not running
    }

    // --- Capacity Information ---
    if (status.capacity) {
      const capacity = status.capacity;
      console.log(chalk.cyan('\n  Capacity Monitoring:\n'));
      console.log(`    Mode: ${chalk.yellow(capacity.mode.toUpperCase())}`);
      console.log(`    Time-Based Usage: ${capacity.timeBasedUsageEnabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
      console.log(`    Capacity Threshold: ${chalk.magenta((capacity.capacityThreshold * 100).toFixed(0) + '%')}`);
      console.log(`    Current Usage: ${chalk.blue((capacity.currentUsagePercent * 100).toFixed(2) + '%')} of daily budget`);

      if (capacity.isAutoPaused) {
        console.log(`    Auto-Paused: ${chalk.red('Yes')} (${capacity.pauseReason || 'Capacity limit reached'})`);
      } else {
        console.log(`    Auto-Paused: ${chalk.green('No')}`);
      }

      console.log(`    Next Mode Switch: ${chalk.gray(capacity.nextModeSwitch.toLocaleString())}`);
    } else {
      console.log(chalk.yellow('\n  Capacity information not available. Ensure daemon is running and monitoring.\n'));
    }

    console.log();
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to get usage status: ${(error as Error).message}\n`));
    console.log(chalk.gray('  Ensure the APEX daemon is running (/daemon start) and initialized.'));
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let result = [];
  if (days > 0) result.push(`${days}d`);
  if (hours % 24 > 0) result.push(`${hours % 24}h`);
  if (minutes % 60 > 0) result.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 || result.length === 0) result.push(`${seconds % 60}s`); // Always show seconds if nothing else or it's just seconds
  return result.join(' ');
}
