import { DaemonRunner } from './runner';
import { HealthMonitor } from './health-monitor';
import { ApexConfig } from '@apexcli/core';

/**
 * Entry point for forked daemon process
 * Reads configuration from environment variables and starts the DaemonRunner
 */
async function main(): Promise<void> {
  // Get configuration from environment
  const projectPath = process.env.APEX_PROJECT_PATH;
  if (!projectPath) {
    console.error('APEX_PROJECT_PATH environment variable is required');
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
    } catch (error) {
      console.warn('Failed to parse APEX_CONFIG_JSON, will load config from file:', error);
    }
  }

  console.log('Starting APEX daemon...');
  console.log(`Project path: ${projectPath}`);
  if (pollIntervalMs !== undefined) {
    console.log(`Poll interval: ${pollIntervalMs}ms (from env)`);
  }
  if (logLevel !== undefined) {
    console.log(`Log level: ${logLevel} (from env)`);
  }
  console.log(`Debug logging: ${logToStdout}`);

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
    console.error('Failed to start daemon:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    console.error('Daemon startup error:', error);
    process.exit(1);
  });
}