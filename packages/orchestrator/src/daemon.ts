import { fork, ChildProcess, exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { ApexConfig } from '@apexcli/core';

const execAsync = promisify(exec);

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
  /** Poll interval in milliseconds (default: 5000 or from config) */
  pollIntervalMs?: number;
  /** Log level for daemon (default: 'info' or from config) */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Whether to enable debug output to stdout */
  debugMode?: boolean;
  /** Pre-loaded config to pass to daemon (optional, avoids re-loading) */
  config?: ApexConfig;
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

/**
 * Capacity status information for the daemon
 */
export interface CapacityStatusInfo {
  /** Current operating mode */
  mode: 'day' | 'night' | 'off-hours';

  /** Capacity threshold for current mode (0-1, e.g., 0.90 = 90%) */
  capacityThreshold: number;

  /** Current usage as percentage of daily budget (0-1) */
  currentUsagePercent: number;

  /** Whether daemon is auto-paused due to capacity limits */
  isAutoPaused: boolean;

  /** Reason for auto-pause if applicable */
  pauseReason?: string;

  /** When the next mode switch will occur */
  nextModeSwitch: Date;

  /** Whether time-based usage is enabled */
  timeBasedUsageEnabled: boolean;
}

/**
 * Extended daemon status that includes capacity information
 */
export interface ExtendedDaemonStatus extends DaemonStatus {
  capacity?: CapacityStatusInfo;
}

/**
 * State file data stored by the daemon runner
 */
export interface DaemonStateFile {
  timestamp: string;
  pid: number;
  startedAt: string;
  running?: boolean;
  capacity?: {
    mode: 'day' | 'night' | 'off-hours';
    capacityThreshold: number;
    currentUsagePercent: number;
    isAutoPaused: boolean;
    pauseReason?: string;
    nextModeSwitch: string;
    timeBasedUsageEnabled: boolean;
  };
  health?: {
    uptime: number;
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
    taskCounts: {
      processed: number;
      succeeded: number;
      failed: number;
      active: number;
    };
    lastHealthCheck: string;
    healthChecksPassed: number;
    healthChecksFailed: number;
    restartHistory: Array<{
      timestamp: string;
      reason: string;
      exitCode?: number;
      triggeredByWatchdog: boolean;
    }>;
  };
}

interface PidFileData {
  pid: number;
  startedAt: string;
  version?: string;
  projectPath: string;
}

// ============================================================================
// Platform-specific Process Management Utilities
// ============================================================================

/**
 * Check if a process is running using platform-appropriate methods
 * @param pid - Process ID to check
 * @returns Promise<boolean> - True if process is running
 */
async function isProcessRunningCrossPlatform(pid: number): Promise<boolean> {
  if (process.platform === 'win32') {
    try {
      // On Windows, use tasklist command to check if process exists
      const { stdout } = await execAsync(`tasklist /fi "PID eq ${pid}" /fo csv`);
      // Check if the PID appears in the output (excluding header line)
      const lines = stdout.split('\n').filter(line => line.trim().length > 0);
      return lines.length > 1; // Header line + at least one process line
    } catch (error) {
      // If tasklist fails, assume process doesn't exist
      return false;
    }
  } else {
    // On Unix-like systems, use the traditional signal 0 method
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      // ESRCH = process doesn't exist
      // EPERM = exists but no permission (process is still running)
      return nodeError.code === 'EPERM';
    }
  }
}

/**
 * Terminate a process gracefully using platform-appropriate methods
 * @param pid - Process ID to terminate
 * @returns Promise<void>
 */
async function terminateProcessCrossPlatform(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    // On Windows, use taskkill for graceful termination
    await execAsync(`taskkill /pid ${pid}`);
  } else {
    // On Unix-like systems, use SIGTERM
    process.kill(pid, 'SIGTERM');
  }
}

/**
 * Force kill a process using platform-appropriate methods
 * @param pid - Process ID to kill
 * @returns Promise<void>
 */
async function forceKillProcessCrossPlatform(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    // On Windows, use taskkill with /f flag for force kill
    await execAsync(`taskkill /f /pid ${pid}`);
  } else {
    // On Unix-like systems, use SIGKILL
    process.kill(pid, 'SIGKILL');
  }
}

// ============================================================================
// DaemonManager Implementation
// ============================================================================

export class DaemonManager {
  private readonly projectPath: string;
  private readonly pidFilePath: string;
  private readonly logFilePath: string;
  private readonly stateFilePath: string;
  private readonly options: DaemonOptions;

  constructor(options: DaemonOptions = {}) {
    this.options = options;
    this.projectPath = options.projectPath || process.cwd();

    // Default paths within .apex directory
    const apexDir = join(this.projectPath, '.apex');
    this.pidFilePath = options.pidFile || join(apexDir, 'daemon.pid');
    this.logFilePath = options.logFile || join(apexDir, 'daemon.log');
    this.stateFilePath = join(apexDir, 'daemon-state.json');
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
          // Pass optional explicit values if provided
          ...(this.options.pollIntervalMs !== undefined && {
            APEX_POLL_INTERVAL: String(this.options.pollIntervalMs)
          }),
          ...(this.options.logLevel !== undefined && {
            APEX_LOG_LEVEL: this.options.logLevel
          }),
          ...(this.options.debugMode !== undefined && {
            APEX_DAEMON_DEBUG: this.options.debugMode ? '1' : '0'
          }),
          // Pass serialized config if provided (for performance)
          ...(this.options.config && {
            APEX_CONFIG_JSON: JSON.stringify(this.options.config)
          }),
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
      // Send platform-appropriate termination signal
      await terminateProcessCrossPlatform(status.pid);
      this.writeToLog(`Sent graceful termination signal to daemon PID: ${status.pid}`);

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

      return await this.isProcessRunning(pidData.pid);
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

      const running = await this.isProcessRunning(pidData.pid);

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
   * Get extended daemon status including capacity information.
   */
  async getExtendedStatus(): Promise<ExtendedDaemonStatus> {
    // Get basic status first
    const basicStatus = await this.getStatus();

    if (!basicStatus.running) {
      return basicStatus;
    }

    // Try to read capacity information from state file
    try {
      const stateData = await this.readStateFile();

      if (stateData && stateData.capacity) {
        const capacity: CapacityStatusInfo = {
          mode: stateData.capacity.mode,
          capacityThreshold: stateData.capacity.capacityThreshold,
          currentUsagePercent: stateData.capacity.currentUsagePercent,
          isAutoPaused: stateData.capacity.isAutoPaused,
          pauseReason: stateData.capacity.pauseReason,
          nextModeSwitch: new Date(stateData.capacity.nextModeSwitch),
          timeBasedUsageEnabled: stateData.capacity.timeBasedUsageEnabled,
        };

        return {
          ...basicStatus,
          capacity,
        };
      }
    } catch (error) {
      // Log error but don't fail - just return basic status
      this.writeToLog(`Failed to read capacity state: ${(error as Error).message}`);
    }

    return basicStatus;
  }

  /**
   * Get comprehensive health report from the running daemon
   * Returns health metrics including uptime, memory usage, task stats, and restart history
   */
  async getHealthReport(): Promise<any> {
    const basicStatus = await this.getStatus();

    if (!basicStatus.running) {
      throw new DaemonError('Daemon is not running', 'NOT_RUNNING');
    }

    // Try to read health information from state file
    try {
      const stateData = await this.readStateFile();

      if (stateData && stateData.health) {
        return {
          ...stateData.health,
          lastHealthCheck: new Date(stateData.health.lastHealthCheck),
          restartHistory: stateData.health.restartHistory.map(record => ({
            ...record,
            timestamp: new Date(record.timestamp),
          })),
        };
      } else {
        throw new DaemonError('Health data not available in daemon state', 'NOT_RUNNING');
      }
    } catch (error) {
      if (error instanceof DaemonError) {
        throw error;
      }
      throw new DaemonError(`Failed to read health data: ${(error as Error).message}`, 'NOT_RUNNING');
    }
  }

  /**
   * Force kill the daemon. Use as last resort.
   */
  async killDaemon(): Promise<boolean> {
    const status = await this.getStatus();

    if (!status.running || !status.pid) {
      return true; // Already stopped
    }

    try {
      await forceKillProcessCrossPlatform(status.pid);
      this.writeToLog(`Sent force kill signal to daemon PID: ${status.pid}`);

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
  private async isProcessRunning(pid: number): Promise<boolean> {
    return await isProcessRunningCrossPlatform(pid);
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
   * Read and parse the daemon state file.
   */
  private async readStateFile(): Promise<DaemonStateFile | null> {
    try {
      const content = await fs.readFile(this.stateFilePath, 'utf-8');
      const data = JSON.parse(content) as DaemonStateFile;

      // Validate required fields
      if (typeof data.pid !== 'number' || !data.timestamp || !data.startedAt) {
        return null; // Invalid state file
      }

      // Check if state file is stale (older than 2 minutes)
      const stateTimestamp = new Date(data.timestamp);
      const now = new Date();
      const ageMs = now.getTime() - stateTimestamp.getTime();

      if (ageMs > 120000) { // 2 minutes
        this.writeToLog(`State file is stale (${Math.floor(ageMs / 1000)}s old), ignoring capacity data`);
        return null;
      }

      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist
      }

      // Log the error but don't throw - capacity info is optional
      this.writeToLog(`Failed to read state file: ${(error as Error).message}`);
      return null;
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
      if (!(await this.isProcessRunning(pid))) {
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