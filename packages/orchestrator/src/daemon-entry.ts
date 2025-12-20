import { DaemonRunner } from './runner';

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

  const pollInterval = parseInt(process.env.APEX_POLL_INTERVAL || '5000', 10);
  const logToStdout = process.env.APEX_DAEMON_DEBUG === '1';

  console.log('Starting APEX daemon...');
  console.log(`Project path: ${projectPath}`);
  console.log(`Poll interval: ${pollInterval}ms`);
  console.log(`Debug logging: ${logToStdout}`);

  const runner = new DaemonRunner({
    projectPath,
    pollIntervalMs: pollInterval,
    logToStdout,
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