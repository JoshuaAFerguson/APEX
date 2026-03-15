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
 * Supports Windows service mode when APEX_WINDOWS_SERVICE=1
 */
async function main(): Promise<void> {
  // Get configuration from environment
  const projectPath = process.env.APEX_PROJECT_PATH;
  const isWindowsService = process.env.APEX_WINDOWS_SERVICE === '1';

  // Windows Service-specific initialization
  let eventLogger: any = null;
  if (isWindowsService && process.platform === 'win32') {
    try {
      const { createApexEventLogger, APEX_EVENT_IDS } = await import('./windows-event-log');
      eventLogger = createApexEventLogger();

      // Try to register event source (might fail without admin privileges, but events can still be written)
      try {
        await eventLogger.registerSource();
      } catch {
        // Ignore registration errors - events can still be written with default source
      }

      // Write startup event to Windows Event Log
      await eventLogger.writeInfo(
        `APEX Daemon service starting (Project: ${projectPath || 'unknown'})`,
        APEX_EVENT_IDS.SERVICE_STARTED
      );
    } catch (error) {
      // If event logging fails, continue without it
      if (projectPath) {
        writeStartupLog(projectPath, `Warning: Windows Event Log initialization failed: ${(error as Error).message}`);
      }
    }
  }

  // Install global crash handlers to prevent silent daemon death
  process.on('uncaughtException', (error) => {
    const errorMessage = `[FATAL] Uncaught exception: ${error.message}\n${error.stack}`;

    if (projectPath) {
      writeStartupLog(projectPath, errorMessage);
    }

    // Log critical error to Windows Event Log if in service mode
    if (eventLogger) {
      try {
        eventLogger.logCriticalError(error.message, 'uncaughtException');
      } catch {
        // Ignore event log errors during shutdown
      }
    }

    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
    const errorMessage = `[FATAL] Unhandled rejection: ${message}`;

    if (projectPath) {
      writeStartupLog(projectPath, errorMessage);
    }

    // Log critical error to Windows Event Log if in service mode
    if (eventLogger) {
      try {
        eventLogger.logCriticalError(message, 'unhandledRejection');
      } catch {
        // Ignore event log errors during shutdown
      }
    }

    process.exit(1);
  });

  // Handle Windows service control signals
  if (isWindowsService) {
    process.on('SIGTERM', async () => {
      if (projectPath) {
        writeStartupLog(projectPath, 'Received SIGTERM signal, shutting down Windows service...');
      }

      if (eventLogger) {
        try {
          await eventLogger.writeInfo(
            'APEX Daemon service stopping (SIGTERM received)',
            (await import('./windows-event-log')).APEX_EVENT_IDS.SERVICE_STOPPED
          );
        } catch {
          // Ignore event log errors during shutdown
        }
      }

      // Graceful shutdown
      if (runner) {
        try {
          await runner.stop();
        } catch (error) {
          if (projectPath) {
            writeStartupLog(projectPath, `Error during graceful shutdown: ${(error as Error).message}`);
          }
        }
      }

      process.exit(0);
    });

    process.on('SIGINT', async () => {
      if (projectPath) {
        writeStartupLog(projectPath, 'Received SIGINT signal, shutting down Windows service...');
      }

      if (eventLogger) {
        try {
          await eventLogger.writeInfo(
            'APEX Daemon service stopping (SIGINT received)',
            (await import('./windows-event-log')).APEX_EVENT_IDS.SERVICE_STOPPED
          );
        } catch {
          // Ignore event log errors during shutdown
        }
      }

      // Graceful shutdown
      if (runner) {
        try {
          await runner.stop();
        } catch (error) {
          if (projectPath) {
            writeStartupLog(projectPath, `Error during graceful shutdown: ${(error as Error).message}`);
          }
        }
      }

      process.exit(0);
    });
  }

  if (!projectPath) {
    const errorMessage = 'APEX_PROJECT_PATH environment variable not set';

    if (eventLogger) {
      try {
        eventLogger.logCriticalError(errorMessage, 'configuration');
      } catch {
        // Ignore event log errors
      }
    }

    // Can't log to stdout (it's ignored), exit silently
    process.exit(1);
  }

  // Parse optional configuration values from environment
  // These take priority over config file if explicitly set
  const pollIntervalMs = process.env.APEX_POLL_INTERVAL ? parseInt(process.env.APEX_POLL_INTERVAL, 10) : undefined;
  const logLevel = process.env.APEX_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined;
  const logToStdout = process.env.APEX_DAEMON_DEBUG === '1' || isWindowsService; // Always log to stdout for Windows services

  // Check for pre-serialized config (for performance optimization)
  let config: ApexConfig | undefined;
  if (process.env.APEX_CONFIG_JSON) {
    try {
      config = JSON.parse(process.env.APEX_CONFIG_JSON);
    } catch (error) {
      const configErrorMsg = 'Failed to parse APEX_CONFIG_JSON, will load config from file';
      writeStartupLog(projectPath, configErrorMsg);

      if (eventLogger) {
        try {
          await eventLogger.logConfigError(`Failed to parse APEX_CONFIG_JSON: ${(error as Error).message}`);
        } catch {
          // Ignore event log errors
        }
      }
    }
  }

  // Create HealthMonitor for tracking daemon health metrics
  const healthMonitor = new HealthMonitor();

  // Store runner in outer scope for signal handlers
  let runner: DaemonRunner;

  runner = new DaemonRunner({
    projectPath,
    pollIntervalMs,
    logLevel,
    logToStdout,
    config, // Pass pre-loaded config if available
    healthMonitor, // Enable health monitoring
  });

  try {
    writeStartupLog(projectPath, `Starting APEX daemon${isWindowsService ? ' (Windows Service mode)' : ''}`);

    if (eventLogger) {
      await eventLogger.logServiceStarted(process.pid);
    }

    await runner.start();
  } catch (error) {
    const startupError = `Failed to start daemon: ${(error as Error).message}`;
    writeStartupLog(projectPath, startupError);

    if (eventLogger) {
      try {
        await eventLogger.logCriticalError(startupError, 'startup');
      } catch {
        // Ignore event log errors
      }
    }

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