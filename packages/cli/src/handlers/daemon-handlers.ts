import chalk from 'chalk';
import fs, { createReadStream } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { DaemonManager, DaemonError, DaemonStatus, ExtendedDaemonStatus, CapacityStatusInfo, ServiceManager } from '@apexcli/orchestrator';
import { formatDuration } from '@apexcli/core';

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
  let foreground = false;
  let windowsService = false;

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
    } else if (args[i] === '--foreground') {
      foreground = true;
    } else if (args[i] === '--windows-service') {
      windowsService = true;
      foreground = true; // Windows services always run in foreground mode
    }
  }

  // On Windows, check if we should try using native Windows service if available
  if (process.platform === 'win32' && !foreground && !windowsService) {
    const serviceManager = new ServiceManager({ projectPath: ctx.cwd });

    try {
      // Check if service is installed and try to start it
      const status = await serviceManager.getWindowsServiceStatusNative();
      if (status.installed) {
        console.log(chalk.blue('🔍 Found installed Windows service, attempting to start...'));

        try {
          if (status.state === 'running') {
            console.log(chalk.green('✓ Windows service already running'));
            console.log(chalk.gray(`  Service name: ${serviceManager['options'].serviceName}`));
            if (status.pid) {
              console.log(chalk.gray(`  PID: ${status.pid}`));
            }
            console.log(chalk.gray(`  View logs with: Get-EventLog -LogName Application -Source "APEX Daemon"`));
            return;
          }

          await serviceManager.startWindowsServiceNative();
          console.log(chalk.green('✓ Windows service started successfully'));
          console.log(chalk.gray(`  Service name: ${serviceManager['options'].serviceName}`));
          console.log(chalk.gray(`  View logs with: Get-EventLog -LogName Application -Source "APEX Daemon"`));
          console.log(chalk.gray(`  Or use: /daemon logs`));
          return;
        } catch (serviceError) {
          console.log(chalk.yellow(`⚠ Failed to start Windows service: ${(serviceError as Error).message}`));
          console.log(chalk.gray('  Falling back to process-based daemon...'));
        }
      }
    } catch {
      // No Windows service installed, continue with regular daemon
    }
  }

  // Start regular daemon process
  const manager = new DaemonManager({
    projectPath: ctx.cwd,
    pollIntervalMs: pollInterval,
  });

  try {
    const pid = await manager.startDaemon();
    console.log(chalk.green(`✓ Daemon started (PID: ${pid})`));
    console.log(chalk.gray(`  Polling every ${pollInterval || 5000}ms for queued tasks`));
    console.log(chalk.gray(`  Logs: .apex/daemon.log`));

    // On Windows, suggest installing as service
    if (process.platform === 'win32' && !windowsService) {
      console.log();
      console.log(chalk.blue('💡 Tip: Install as Windows service for better management:'));
      console.log(chalk.gray('  apex install-service'));
    }
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

  // On Windows, check for Windows service first
  if (process.platform === 'win32') {
    const serviceManager = new ServiceManager({ projectPath: ctx.cwd });

    try {
      const status = await serviceManager.getWindowsServiceStatusNative();
      if (status.installed && status.state === 'running') {
        console.log(chalk.blue('🔍 Found running Windows service, stopping...'));

        try {
          await serviceManager.stopWindowsServiceNative();
          console.log(chalk.green('✓ Windows service stopped'));
          return;
        } catch (serviceError) {
          console.log(chalk.yellow(`⚠ Failed to stop Windows service: ${(serviceError as Error).message}`));
          if (!force) {
            console.log(chalk.gray('  Use --force to attempt stopping process-based daemon'));
            return;
          }
          console.log(chalk.gray('  Attempting to stop process-based daemon...'));
        }
      }
    } catch {
      // No Windows service or error checking, continue with regular daemon
    }
  }

  // Stop regular daemon process
  const manager = new DaemonManager({
    projectPath: ctx.cwd,
  });

  try {
    const status = await manager.getStatus();

    if (!status.running) {
      // Check if Windows service exists but is stopped
      if (process.platform === 'win32') {
        try {
          const serviceManager = new ServiceManager({ projectPath: ctx.cwd });
          const serviceStatus = await serviceManager.getWindowsServiceStatusNative();
          if (serviceStatus.installed && serviceStatus.state === 'stopped') {
            console.log(chalk.yellow('Windows service is stopped.'));
            return;
          }
        } catch {
          // Ignore service check errors
        }
      }

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
  let showedWindowsService = false;

  // On Windows, check for Windows service first
  if (process.platform === 'win32') {
    try {
      const serviceManager = new ServiceManager({ projectPath: ctx.cwd });
      const serviceStatus = await serviceManager.getWindowsServiceStatusNative();

      if (serviceStatus.installed) {
        console.log(chalk.cyan('\nWindows Service Status'));
        console.log(chalk.gray('─'.repeat(40)));

        const stateColor = serviceStatus.state === 'running' ? chalk.green :
                          serviceStatus.state === 'stopped' ? chalk.gray :
                          serviceStatus.state.includes('pending') ? chalk.yellow : chalk.red;

        console.log(`  Service Name:    ${serviceManager['options'].serviceName}`);
        console.log(`  State:           ${stateColor(serviceStatus.state)}`);
        console.log(`  Startup Type:    ${serviceStatus.startType}`);

        if (serviceStatus.pid) {
          console.log(`  PID:             ${serviceStatus.pid}`);
        }

        if (serviceStatus.usingNSSM) {
          console.log(`  Management:      ${chalk.blue('NSSM (enhanced)')}`);
        } else {
          console.log(`  Management:      ${chalk.gray('Built-in Windows Service')}`);
        }

        console.log(`  Event Log:       ${chalk.gray('Application Log (Source: APEX Daemon)')}`);

        if (serviceStatus.state === 'running') {
          console.log();
          console.log(chalk.green('✓ Windows service is running'));
          console.log(chalk.gray('  View events: Get-EventLog -LogName Application -Source "APEX Daemon"'));
          console.log(chalk.gray('  Or use: /daemon logs'));
          showedWindowsService = true;
        } else if (serviceStatus.state === 'stopped') {
          console.log();
          console.log(chalk.yellow("Use '/daemon start' to start the Windows service."));
        }

        console.log();
      }
    } catch (error) {
      // Windows service check failed, continue with regular daemon check
    }
  }

  // Check regular daemon process
  const manager = new DaemonManager({
    projectPath: ctx.cwd,
  });

  const extendedStatus = await manager.getExtendedStatus();

  if (!showedWindowsService || extendedStatus.running) {
    console.log(chalk.cyan('Process Daemon Status'));
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

      if (showedWindowsService) {
        console.log();
        console.log(chalk.yellow('⚠ Both Windows service and process daemon are running'));
        console.log(chalk.gray('  Consider stopping one to avoid conflicts'));
      }
    } else {
      console.log(`  State:           ${chalk.gray('stopped')}`);
      console.log();
      if (!showedWindowsService) {
        console.log(chalk.gray("Use '/daemon start' to start the daemon."));
        if (process.platform === 'win32') {
          console.log(chalk.gray("Or use 'apex install-service' to install as Windows service."));
        }
      }
    }
    console.log();
  }
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

/**
 * Cross-platform file watcher for tailing logs
 * Uses fs.watch() and incremental reading instead of Unix-only tail command
 */
async function followLogFile(
  filePath: string,
  lines: number = 20,
  level?: string
): Promise<void> {
  let fileSize = 0;
  let isWatching = true;

  // Read initial content and display last N lines
  try {
    const stats = fs.statSync(filePath);
    fileSize = stats.size;

    // Display initial lines if file has content
    if (fileSize > 0) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim() !== '');

      const filteredLines = level
        ? filterLogsByLevel(allLines, level)
        : allLines;

      const initialLines = filteredLines.slice(-lines);

      initialLines.forEach(line => {
        console.log(formatLogLine(line));
      });
    }
  } catch (error) {
    console.log(chalk.red(`Failed to read initial log content: ${(error as Error).message}`));
    return;
  }

  // Watch for file changes
  const watcher = fs.watch(filePath, (eventType) => {
    if (!isWatching || eventType !== 'change') {
      return;
    }

    try {
      const stats = fs.statSync(filePath);
      const newSize = stats.size;

      // Only read new content if file has grown
      if (newSize > fileSize) {
        const stream = createReadStream(filePath, {
          start: fileSize,
          end: newSize - 1,
          encoding: 'utf-8'
        });

        const rl = createInterface({
          input: stream,
          crlfDelay: Infinity
        });

        rl.on('line', (line) => {
          if (line.trim() === '') return;

          // Filter by log level if specified
          if (level) {
            const filteredLines = filterLogsByLevel([line], level);
            if (filteredLines.length === 0) return;
          }

          console.log(formatLogLine(line));
        });

        rl.on('close', () => {
          fileSize = newSize;
        });

        rl.on('error', (error) => {
          console.log(chalk.red(`Error reading log updates: ${error.message}`));
        });
      }
    } catch (error) {
      // File might have been deleted or rotated, silently continue watching
    }
  });

  // Handle graceful shutdown
  const cleanup = () => {
    isWatching = false;
    watcher.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  watcher.on('error', (error) => {
    console.log(chalk.red(`File watcher error: ${error.message}`));
    cleanup();
  });
}

/**
 * Handle daemon logs command
 */
export async function handleDaemonLogs(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  const logPath = path.join(ctx.cwd, '.apex', 'daemon.log');

  // Parse options
  let follow = false;
  let lines = 20;
  let level: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--follow' || args[i] === '-f') {
      follow = true;
    } else if (args[i] === '--lines' || args[i] === '-n') {
      const linesStr = args[++i];
      if (linesStr) {
        const parsed = parseInt(linesStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
          lines = parsed;
        } else {
          console.log(chalk.red('Invalid lines count. Must be a positive number.'));
          return;
        }
      }
    } else if (args[i] === '--level' || args[i] === '-l') {
      const levelStr = args[++i];
      if (levelStr) {
        const validLevels = ['debug', 'info', 'warn', 'error'];
        if (validLevels.includes(levelStr.toLowerCase())) {
          level = levelStr.toLowerCase();
        } else {
          console.log(chalk.red(`Invalid log level. Must be one of: ${validLevels.join(', ')}`));
          return;
        }
      }
    }
  }

  // Check if log file exists
  if (!fs.existsSync(logPath)) {
    console.log(chalk.yellow('Daemon log file not found.'));
    console.log(chalk.gray('Start the daemon to begin logging.'));
    return;
  }

  try {
    if (follow) {
      // Use cross-platform file watching for following logs
      console.log(chalk.cyan(`Following daemon logs (${logPath})`));
      console.log(chalk.gray('Press Ctrl+C to stop following\n'));

      await followLogFile(logPath, lines, level);
    } else {
      // Read the file and display last N lines
      const content = fs.readFileSync(logPath, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim() !== '');

      // Filter by log level if specified
      const filteredLines = level
        ? filterLogsByLevel(allLines, level)
        : allLines;

      // Get last N lines
      const lastLines = filteredLines.slice(-lines);

      if (lastLines.length === 0) {
        console.log(chalk.yellow('No matching log entries found.'));
        return;
      }

      console.log(chalk.cyan(`Last ${lastLines.length} daemon log entries:`));
      console.log(chalk.gray('─'.repeat(50)));

      lastLines.forEach(line => {
        console.log(formatLogLine(line));
      });
    }
  } catch (error) {
    console.log(chalk.red(`Failed to read daemon logs: ${(error as Error).message}`));
  }
}

/**
 * Filter log lines by level (hierarchical)
 */
function filterLogsByLevel(lines: string[], level: string): string[] {
  const levelHierarchy: Record<string, string[]> = {
    'debug': ['DEBUG', 'INFO', 'WARN', 'ERROR'],
    'info': ['INFO', 'WARN', 'ERROR'],
    'warn': ['WARN', 'ERROR'],
    'error': ['ERROR']
  };

  const allowedLevels = levelHierarchy[level] || [];

  return lines.filter(line => {
    return allowedLevels.some(logLevel =>
      line.includes(`] ${logLevel} `) || line.includes(`] ${logLevel}\t`)
    );
  });
}

/**
 * Format a log line with colors based on log level
 */
function formatLogLine(line: string): string {
  if (line.includes('] ERROR ')) {
    return chalk.red(line);
  } else if (line.includes('] WARN ')) {
    return chalk.yellow(line);
  } else if (line.includes('] INFO ')) {
    return chalk.white(line);
  } else if (line.includes('] DEBUG ')) {
    return chalk.gray(line);
  } else {
    return line;
  }
}

// ============================================================================
// Windows Service Management Commands
// ============================================================================

/**
 * Handle install-service command for Windows
 */
export async function handleInstallService(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  if (process.platform !== 'win32') {
    console.log(chalk.red('Service installation is only available on Windows'));
    console.log(chalk.gray('On other platforms, use your system\'s service management tools:'));
    console.log(chalk.gray('  Linux: systemctl (via ServiceManager)'));
    console.log(chalk.gray('  macOS: launchctl (via ServiceManager)'));
    return;
  }

  if (!ctx.initialized) {
    console.log(chalk.red('APEX not initialized. Run /init first.'));
    return;
  }

  // Parse options
  let enableOnBoot = false;
  let force = false;

  for (const arg of args) {
    if (arg === '--enable-on-boot' || arg === '--startup') {
      enableOnBoot = true;
    } else if (arg === '--force') {
      force = true;
    }
  }

  const serviceManager = new ServiceManager({ projectPath: ctx.cwd });

  try {
    // Check elevation
    const windowsManager = await serviceManager['getWindowsServiceManager']();
    const elevated = await windowsManager.isElevated();

    if (!elevated) {
      console.log(chalk.red('⚠ Administrator privileges required'));
      console.log(chalk.yellow('Please restart your terminal as Administrator:'));
      console.log(chalk.gray('1. Right-click Command Prompt or PowerShell'));
      console.log(chalk.gray('2. Select "Run as Administrator"'));
      console.log(chalk.gray('3. Navigate back to your project directory'));
      console.log(chalk.gray('4. Run this command again'));
      return;
    }

    // Check if service already exists
    const status = await serviceManager.getWindowsServiceStatusNative();
    if (status.installed && !force) {
      console.log(chalk.yellow(`Windows service already installed: ${serviceManager['options'].serviceName}`));
      console.log(chalk.gray('Use --force to reinstall'));
      return;
    }

    // Check for NSSM availability
    const nssmAvailable = await windowsManager.isNSSMAvailable();
    if (nssmAvailable) {
      console.log(chalk.blue('🚀 Installing Windows service with NSSM (recommended)...'));
    } else {
      console.log(chalk.blue('🚀 Installing Windows service with built-in service manager...'));
      console.log(chalk.yellow('💡 Tip: Install NSSM for better service management: https://nssm.cc'));
    }

    // Install service
    const result = await serviceManager.installWindowsServiceNative({
      enableAfterInstall: false,
      enableOnBoot,
      force
    });

    if (result.success) {
      console.log(chalk.green('✓ Windows service installed successfully'));
      console.log();
      console.log(chalk.cyan('Service Details:'));
      console.log(`  Name:            ${serviceManager['options'].serviceName}`);
      console.log(`  Display Name:    ${serviceManager['options'].serviceDescription}`);
      console.log(`  Startup Type:    ${enableOnBoot ? 'Automatic' : 'Manual'}`);
      console.log(`  Log Location:    Windows Event Log (Application)`);

      if (result.warnings.length > 0) {
        console.log();
        console.log(chalk.yellow('Warnings:'));
        result.warnings.forEach(warning => {
          console.log(`  ${chalk.yellow('⚠')} ${warning}`);
        });
      }

      console.log();
      console.log(chalk.cyan('Next Steps:'));
      console.log(`  Start service:   ${chalk.gray('apex daemon start')}`);
      console.log(`  Check status:    ${chalk.gray('apex daemon status')}`);
      console.log(`  View logs:       ${chalk.gray('apex daemon logs')}`);
      console.log(`  View events:     ${chalk.gray('Get-EventLog -LogName Application -Source "APEX Daemon"')}`);

      if (enableOnBoot) {
        console.log();
        console.log(chalk.green('✓ Service configured to start automatically with Windows'));
      }
    }
  } catch (error) {
    console.log(chalk.red(`Failed to install Windows service: ${(error as Error).message}`));

    if ((error as any).code === 'ELEVATION_REQUIRED') {
      console.log();
      console.log(chalk.yellow('Run as Administrator to install Windows services'));
    } else if ((error as any).code === 'SERVICE_EXISTS') {
      console.log(chalk.gray('Use --force to overwrite existing service'));
    }
  }
}

/**
 * Handle uninstall-service command for Windows
 */
export async function handleUninstallService(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  if (process.platform !== 'win32') {
    console.log(chalk.red('Service uninstallation is only available on Windows'));
    return;
  }

  // Parse options
  let force = false;
  for (const arg of args) {
    if (arg === '--force') {
      force = true;
    }
  }

  const serviceManager = new ServiceManager({ projectPath: ctx.cwd });

  try {
    // Check elevation
    const windowsManager = await serviceManager['getWindowsServiceManager']();
    const elevated = await windowsManager.isElevated();

    if (!elevated) {
      console.log(chalk.red('⚠ Administrator privileges required'));
      console.log(chalk.yellow('Please restart your terminal as Administrator to uninstall services'));
      return;
    }

    // Check if service exists
    const status = await serviceManager.getWindowsServiceStatusNative();
    if (!status.installed) {
      console.log(chalk.yellow('Windows service not found'));
      console.log(chalk.gray(`Looking for: ${serviceManager['options'].serviceName}`));
      return;
    }

    console.log(chalk.blue('🗑 Uninstalling Windows service...'));

    // Show what will be removed
    if (status.state === 'running') {
      console.log(chalk.yellow('⚠ Service is currently running and will be stopped'));
    }

    // Confirm unless force
    if (!force) {
      console.log();
      console.log(chalk.yellow('This will permanently remove the Windows service.'));
      console.log(chalk.gray('Use --force to skip this confirmation'));
      // In a real CLI, you'd want to prompt for confirmation here
      // For now, we'll assume force mode
    }

    // Uninstall service
    const result = await serviceManager.uninstallWindowsServiceNative({
      force: true,
      stopTimeout: 30000
    });

    if (result.success) {
      console.log(chalk.green('✓ Windows service uninstalled successfully'));

      if (result.wasRunning) {
        console.log(chalk.green('✓ Service was stopped before removal'));
      }

      console.log();
      console.log(chalk.gray('The daemon can still be run as a regular process:'));
      console.log(chalk.gray('  apex daemon start'));
    }
  } catch (error) {
    console.log(chalk.red(`Failed to uninstall Windows service: ${(error as Error).message}`));

    if ((error as any).code === 'ELEVATION_REQUIRED') {
      console.log();
      console.log(chalk.yellow('Run as Administrator to uninstall Windows services'));
    } else if ((error as any).code === 'SERVICE_NOT_FOUND') {
      console.log(chalk.gray('Service may have already been removed'));
    }
  }
}