import { fork, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

// ============================================================================
// Error Types
// ============================================================================

export type DaemonErrorCode =
  | 'ALREADY_RUNNING'
  | 'NOT_RUNNING'
  | 'PERMISSION_DENIED'
  | 'LOCK_FAILED'
  | 'START_FAILED'
  | 'STOP_FAILED'
  | 'PID_FILE_CORRUPTED';

export class DaemonError extends Error {
  constructor(
    message: string,
    public readonly code: DaemonErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DaemonError';
  }
}

// ============================================================================
// Interfaces
// ============================================================================

export interface DaemonOptions {
  /** Path to the project directory (default: process.cwd()) */
  projectPath?: string;
  /** Custom PID file path (default: .apex/daemon.pid) */
  pidFile?: string;
  /** Custom log file path (default: .apex/daemon.log) */
  logFile?: string;
  /** Poll interval in milliseconds (default: 5000) */
  pollIntervalMs?: number;
  /** Callback for daemon output */
  onOutput?: (data: string) => void;
  /** Callback for daemon errors */
  onError?: (error: Error) => void;
}

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  startedAt?: Date;
  uptime?: number; // milliseconds
}

interface PidFileData {
  pid: number;
  startedAt: string;
  version?: string;
  projectPath: string;
}

// ============================================================================
// DaemonManager Implementation
// ============================================================================

export class DaemonManager {
  private readonly projectPath: string;
  private readonly pidFilePath: string;
  private readonly logFilePath: string;
  private readonly options: DaemonOptions;

  constructor(options: DaemonOptions = {}) {
    this.options = options;
    this.projectPath = options.projectPath || process.cwd();

    // Default paths within .apex directory
    const apexDir = join(this.projectPath, '.apex');
    this.pidFilePath = options.pidFile || join(apexDir, 'daemon.pid');
    this.logFilePath = options.logFile || join(apexDir, 'daemon.log');
  }

  /**
   * Start the daemon process. Returns the child PID.
   * Throws DaemonError if already running or start fails.
   */
  async startDaemon(): Promise<number> {
    // Check if daemon is already running
    if (await this.isDaemonRunning()) {
      throw new DaemonError('Daemon is already running', 'ALREADY_RUNNING');
    }

    // Ensure .apex directory exists
    await this.ensureApexDirectory();

    try {
      // Fork the daemon entry point script
      const entryPoint = join(__dirname, 'daemon-entry.js'); // Compiled output

      const child = fork(entryPoint, [], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        env: {
          ...process.env,
          APEX_DAEMON_MODE: '1',
          APEX_PROJECT_PATH: this.projectPath,
          APEX_POLL_INTERVAL: String(this.options.pollIntervalMs ?? 5000),
          APEX_DAEMON_DEBUG: process.env.APEX_DAEMON_DEBUG || '0',
        },
      });

      if (!child.pid) {
        throw new DaemonError('Failed to get child process PID', 'START_FAILED');
      }

      // Write PID file with process information
      await this.writePidFile(child.pid, new Date());

      // Set up logging if log file is configured
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          this.writeToLog(`STDOUT: ${data}`);
          this.options.onOutput?.(data.toString());
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          this.writeToLog(`STDERR: ${data}`);
          this.options.onError?.(new Error(data.toString()));
        });
      }

      // Handle process exit
      child.on('exit', async (code) => {
        this.writeToLog(`Daemon process exited with code: ${code}`);
        await this.removePidFile();
      });

      // Detach the child process so parent can exit independently
      child.unref();

      this.writeToLog(`Daemon started with PID: ${child.pid}`);
      return child.pid;

    } catch (error) {
      throw new DaemonError(
        'Failed to start daemon process',
        'START_FAILED',
        error as Error
      );
    }
  }

  /**
   * Stop the daemon gracefully. Returns true if stopped successfully.
   */
  async stopDaemon(): Promise<boolean> {
    const status = await this.getStatus();

    if (!status.running || !status.pid) {
      return true; // Already stopped
    }

    try {
      // Send SIGTERM for graceful shutdown
      process.kill(status.pid, 'SIGTERM');
      this.writeToLog(`Sent SIGTERM to daemon PID: ${status.pid}`);

      // Wait for process to exit (with timeout)
      const stopped = await this.waitForExit(status.pid, 10000);

      if (stopped) {
        await this.removePidFile();
        this.writeToLog(`Daemon stopped gracefully`);
        return true;
      }

      // Force kill if graceful shutdown failed
      this.writeToLog(`Graceful shutdown failed, forcing kill...`);
      return await this.killDaemon();

    } catch (error) {
      throw new DaemonError(
        'Failed to stop daemon process',
        'STOP_FAILED',
        error as Error
      );
    }
  }

  /**
   * Check if the daemon is currently running.
   */
  async isDaemonRunning(): Promise<boolean> {
    try {
      const pidData = await this.readPidFile();
      if (!pidData) {
        return false;
      }

      return this.isProcessRunning(pidData.pid);
    } catch {
      return false;
    }
  }

  /**
   * Get detailed daemon status.
   */
  async getStatus(): Promise<DaemonStatus> {
    try {
      const pidData = await this.readPidFile();

      if (!pidData) {
        return { running: false };
      }

      const running = this.isProcessRunning(pidData.pid);

      if (!running) {
        // Clean up stale PID file
        await this.removePidFile();
        return { running: false };
      }

      const startedAt = new Date(pidData.startedAt);
      const uptime = Date.now() - startedAt.getTime();

      return {
        running: true,
        pid: pidData.pid,
        startedAt,
        uptime,
      };
    } catch {
      return { running: false };
    }
  }

  /**
   * Force kill the daemon (SIGKILL). Use as last resort.
   */
  async killDaemon(): Promise<boolean> {
    const status = await this.getStatus();

    if (!status.running || !status.pid) {
      return true; // Already stopped
    }

    try {
      process.kill(status.pid, 'SIGKILL');
      this.writeToLog(`Sent SIGKILL to daemon PID: ${status.pid}`);

      // Wait a bit for the kill to take effect
      await this.sleep(1000);

      // Clean up PID file
      await this.removePidFile();
      this.writeToLog(`Daemon killed forcefully`);

      return true;
    } catch (error) {
      throw new DaemonError(
        'Failed to kill daemon process',
        'STOP_FAILED',
        error as Error
      );
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check if a process with given PID is running.
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Signal 0 doesn't kill the process, just checks if it exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      // ESRCH = process doesn't exist
      // EPERM = exists but no permission (process is still running)
      return nodeError.code === 'EPERM';
    }
  }

  /**
   * Read and parse the PID file.
   */
  private async readPidFile(): Promise<PidFileData | null> {
    try {
      const content = await fs.readFile(this.pidFilePath, 'utf-8');
      const data = JSON.parse(content) as PidFileData;

      // Validate required fields
      if (typeof data.pid !== 'number' || !data.startedAt) {
        throw new DaemonError(
          'PID file is corrupted or invalid',
          'PID_FILE_CORRUPTED'
        );
      }

      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist
      }

      if (error instanceof DaemonError) {
        throw error;
      }

      throw new DaemonError(
        'Failed to read PID file',
        'PID_FILE_CORRUPTED',
        error as Error
      );
    }
  }

  /**
   * Write daemon information to the PID file.
   */
  private async writePidFile(pid: number, startedAt: Date): Promise<void> {
    const data: PidFileData = {
      pid,
      startedAt: startedAt.toISOString(),
      version: process.env.npm_package_version,
      projectPath: this.projectPath,
    };

    try {
      await fs.writeFile(
        this.pidFilePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new DaemonError(
        'Failed to write PID file',
        'LOCK_FAILED',
        error as Error
      );
    }
  }

  /**
   * Remove the PID file.
   */
  private async removePidFile(): Promise<void> {
    try {
      await fs.unlink(this.pidFilePath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      // Ignore if file doesn't exist
      if (nodeError.code !== 'ENOENT') {
        throw new DaemonError(
          'Failed to remove PID file',
          'LOCK_FAILED',
          error as Error
        );
      }
    }
  }

  /**
   * Ensure the .apex directory exists.
   */
  private async ensureApexDirectory(): Promise<void> {
    const apexDir = join(this.projectPath, '.apex');
    try {
      await fs.mkdir(apexDir, { recursive: true });
    } catch (error) {
      throw new DaemonError(
        'Failed to create .apex directory',
        'PERMISSION_DENIED',
        error as Error
      );
    }
  }

  /**
   * Write a message to the daemon log file.
   */
  private writeToLog(message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;

    // Use sync write to avoid blocking async operations
    fs.appendFile(this.logFilePath, logLine).catch(() => {
      // Ignore log write errors to prevent cascading failures
    });
  }

  /**
   * Wait for a process to exit with timeout.
   */
  private async waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
    const checkInterval = 100; // Check every 100ms
    const maxChecks = Math.floor(timeoutMs / checkInterval);

    for (let i = 0; i < maxChecks; i++) {
      if (!this.isProcessRunning(pid)) {
        return true; // Process has exited
      }
      await this.sleep(checkInterval);
    }

    return false; // Timeout reached
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}