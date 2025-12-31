import { DaemonRunner } from './runner';
import { HealthMonitor } from './health-monitor';
import { ApexConfig } from '@apexcli/core';
import { appendFileSync } from 'fs';
import { join } from 'path';

/**
 * Write to the daemon log file directly (for startup messages before runner is initialized)
 */
function writeStartupLog(projectPath: string, message: string): void {
  try {
    const logPath = join(projectPath, '.apex', 'daemon.log');
    const timestamp = new Date().toISOString();
    appendFileSync(logPath, `[${timestamp}] [INFO ] ${message}\n`);
  } catch {
    // Ignore errors - logging is best effort
  }
}

/**
 * Entry point for forked daemon process
 * Reads configuration from environment variables and starts the DaemonRunner
 * Note: stdout/stderr are ignored to prevent EPIPE errors when parent exits
 */
async function main(): Promise<void> {
  // Get configuration from environment
  const projectPath = process.env.APEX_PROJECT_PATH;
  if (!projectPath) {
    // Can't log to stdout (it's ignored), exit silently
    process.exit(1);
  }

  // Parse optional configuration values from environment
  // These take priority over config file if explicitly set
  const pollIntervalMs = process.env.APEX_POLL_INTERVAL ? parseInt(process.env.APEX_POLL_INTERVAL, 10) : undefined;
  const logLevel = process.env.APEX_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined;
  const logToStdout = process.env.APEX_DAEMON_DEBUG === '1';

  // Check for pre-serialized config (for performance optimization)
  let config: ApexConfig | undefined;
  if (process.env.APEX_CONFIG_JSON) {
    try {
      config = JSON.parse(process.env.APEX_CONFIG_JSON);
    } catch {
      writeStartupLog(projectPath, 'Failed to parse APEX_CONFIG_JSON, will load config from file');
    }
  }

  // Create HealthMonitor for tracking daemon health metrics
  const healthMonitor = new HealthMonitor();

  const runner = new DaemonRunner({
    projectPath,
    pollIntervalMs,
    logLevel,
    logToStdout,
    config, // Pass pre-loaded config if available
    healthMonitor, // Enable health monitoring
  });

  try {
    await runner.start();
  } catch (error) {
    writeStartupLog(projectPath, `Failed to start daemon: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  main().catch(() => {
    // Error already logged in main(), just exit
    process.exit(1);
  });
}