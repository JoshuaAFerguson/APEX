/**
 * Windows Event Log Integration Module
 *
 * Provides integration with Windows Event Log system for APEX daemon logging.
 * Uses PowerShell Write-EventLog for reliable cross-version compatibility.
 *
 * Part of ADR-0005: Windows Service Management Architecture
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types and Interfaces
// ============================================================================

export enum WindowsEventLogType {
  Error = 1,
  Warning = 2,
  Information = 4,
  SuccessAudit = 8,
  FailureAudit = 16
}

export interface WindowsEventLogEntry {
  /** Event source name (e.g., "APEX Daemon") */
  source: string;
  /** Event ID (1000-1999 range for APEX events) */
  eventId: number;
  /** Event type/level */
  type: WindowsEventLogType;
  /** Event category (optional) */
  category?: number;
  /** Event message */
  message: string;
  /** Additional binary data (optional) */
  data?: Buffer;
}

export interface EventLogConfig {
  /** Event source name */
  source: string;
  /** Target event log name */
  logName: string;
  /** Maximum message length (default: 32766) */
  maxMessageLength?: number;
  /** Whether to truncate long messages or throw error */
  truncateMessages?: boolean;
}

// ============================================================================
// APEX Event ID Definitions
// ============================================================================

export const APEX_EVENT_IDS = {
  // Service lifecycle events (1000-1099)
  SERVICE_STARTED: 1000,
  SERVICE_STOPPED: 1001,
  SERVICE_PAUSED: 1002,
  SERVICE_RESUMED: 1003,
  SERVICE_INSTALLED: 1004,
  SERVICE_UNINSTALLED: 1005,

  // Task execution events (1100-1199)
  TASK_STARTED: 1100,
  TASK_COMPLETED: 1101,
  TASK_FAILED: 1102,
  TASK_QUEUED: 1103,
  TASK_CANCELLED: 1104,
  TASK_TIMEOUT: 1105,

  // Capacity management events (1200-1299)
  CAPACITY_LIMIT_REACHED: 1200,
  CAPACITY_RESTORED: 1201,
  AUTO_PAUSE_ACTIVATED: 1202,
  AUTO_PAUSE_DEACTIVATED: 1203,
  MODE_CHANGED: 1204,

  // Configuration events (1300-1399)
  CONFIG_LOADED: 1300,
  CONFIG_ERROR: 1301,
  CONFIG_UPDATED: 1302,
  CONFIG_VALIDATION_FAILED: 1303,

  // Health and monitoring events (1400-1499)
  HEALTH_CHECK_PASSED: 1400,
  HEALTH_CHECK_FAILED: 1401,
  WATCHDOG_TRIGGERED: 1402,
  MEMORY_WARNING: 1403,
  PERFORMANCE_WARNING: 1404,

  // Error events (9000-9999)
  GENERAL_ERROR: 9000,
  PERMISSION_ERROR: 9001,
  NETWORK_ERROR: 9002,
  DATABASE_ERROR: 9003,
  CRITICAL_ERROR: 9999
} as const;

export type ApexEventId = typeof APEX_EVENT_IDS[keyof typeof APEX_EVENT_IDS];

// ============================================================================
// Windows Event Logger Implementation
// ============================================================================

export class WindowsEventLogger {
  private readonly config: Required<EventLogConfig>;
  private readonly isWindows: boolean;
  private isRegistered: boolean = false;

  constructor(config?: Partial<EventLogConfig>) {
    this.isWindows = process.platform === 'win32';
    this.config = {
      source: config?.source || 'APEX Daemon',
      logName: config?.logName || 'Application',
      maxMessageLength: config?.maxMessageLength || 32766,
      truncateMessages: config?.truncateMessages ?? true
    };
  }

  // ============================================================================
  // Event Source Management
  // ============================================================================

  /**
   * Register the event source with Windows Event Log
   * This only needs to be done once and requires administrator privileges
   */
  async registerSource(): Promise<void> {
    if (!this.isWindows) {
      return; // No-op on non-Windows platforms
    }

    try {
      // Check if source already exists
      const checkCommand = `powershell.exe -Command "Get-WinEvent -ListProvider '${this.config.source}' -ErrorAction SilentlyContinue | Select-Object Name"`;

      try {
        const { stdout } = await execAsync(checkCommand, { timeout: 5000 });
        if (stdout.includes(this.config.source)) {
          this.isRegistered = true;
          return; // Already registered
        }
      } catch {
        // Provider doesn't exist, continue with registration
      }

      // Register the event source
      const registerCommand = `powershell.exe -Command "New-EventLog -LogName '${this.config.logName}' -Source '${this.config.source}' -ErrorAction SilentlyContinue"`;
      await execAsync(registerCommand, { timeout: 10000 });

      this.isRegistered = true;
    } catch (error) {
      // Registration failed, but we can still try to write events
      // Windows will create a default source if needed
      console.warn(`Failed to register event source '${this.config.source}': ${(error as Error).message}`);
      this.isRegistered = false;
    }
  }

  /**
   * Unregister the event source (cleanup)
   * Requires administrator privileges
   */
  async unregisterSource(): Promise<void> {
    if (!this.isWindows || !this.isRegistered) {
      return;
    }

    try {
      const command = `powershell.exe -Command "Remove-EventLog -Source '${this.config.source}' -ErrorAction SilentlyContinue"`;
      await execAsync(command, { timeout: 10000 });
      this.isRegistered = false;
    } catch (error) {
      console.warn(`Failed to unregister event source '${this.config.source}': ${(error as Error).message}`);
    }
  }

  // ============================================================================
  // Event Writing Methods
  // ============================================================================

  /**
   * Write an information event
   */
  async writeInfo(message: string, eventId?: ApexEventId): Promise<void> {
    return this.writeEvent({
      source: this.config.source,
      type: WindowsEventLogType.Information,
      eventId: eventId || APEX_EVENT_IDS.GENERAL_ERROR,
      message
    });
  }

  /**
   * Write a warning event
   */
  async writeWarning(message: string, eventId?: ApexEventId): Promise<void> {
    return this.writeEvent({
      source: this.config.source,
      type: WindowsEventLogType.Warning,
      eventId: eventId || APEX_EVENT_IDS.GENERAL_ERROR,
      message
    });
  }

  /**
   * Write an error event
   */
  async writeError(message: string, eventId?: ApexEventId): Promise<void> {
    return this.writeEvent({
      source: this.config.source,
      type: WindowsEventLogType.Error,
      eventId: eventId || APEX_EVENT_IDS.GENERAL_ERROR,
      message
    });
  }

  /**
   * Write a success audit event
   */
  async writeSuccessAudit(message: string, eventId?: ApexEventId): Promise<void> {
    return this.writeEvent({
      source: this.config.source,
      type: WindowsEventLogType.SuccessAudit,
      eventId: eventId || APEX_EVENT_IDS.GENERAL_ERROR,
      message
    });
  }

  /**
   * Write a failure audit event
   */
  async writeFailureAudit(message: string, eventId?: ApexEventId): Promise<void> {
    return this.writeEvent({
      source: this.config.source,
      type: WindowsEventLogType.FailureAudit,
      eventId: eventId || APEX_EVENT_IDS.GENERAL_ERROR,
      message
    });
  }

  /**
   * Write a custom event entry
   */
  async writeEvent(entry: WindowsEventLogEntry): Promise<void> {
    if (!this.isWindows) {
      // On non-Windows platforms, log to console as fallback
      const levelName = this.getEventTypeName(entry.type);
      console.log(`[${levelName}] ${entry.source} (${entry.eventId}): ${entry.message}`);
      return;
    }

    try {
      // Prepare the message
      let message = this.sanitizeMessage(entry.message);
      if (message.length > this.config.maxMessageLength) {
        if (this.config.truncateMessages) {
          message = message.substring(0, this.config.maxMessageLength - 3) + '...';
        } else {
          throw new Error(`Event message too long (${message.length} > ${this.config.maxMessageLength})`);
        }
      }

      // Map event type to PowerShell EntryType
      const entryType = this.mapEventTypeToPS(entry.type);

      // Construct PowerShell command
      const command = `powershell.exe -Command "Write-EventLog -LogName '${this.config.logName}' -Source '${entry.source}' -EntryType '${entryType}' -EventId ${entry.eventId} -Message '${message}'"`;

      // Execute the command
      await execAsync(command, { timeout: 5000 });
    } catch (error) {
      // If event writing fails, fall back to console logging
      console.error(`Failed to write Windows event log: ${(error as Error).message}`);
      const levelName = this.getEventTypeName(entry.type);
      console.log(`[${levelName}] ${entry.source} (${entry.eventId}): ${entry.message}`);
    }
  }

  /**
   * Write multiple events in a batch
   * Note: This implementation writes them sequentially as PowerShell doesn't have native batch support
   */
  async writeBatch(entries: WindowsEventLogEntry[]): Promise<void> {
    const results = await Promise.allSettled(
      entries.map(entry => this.writeEvent(entry))
    );

    // Report any failures
    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
      const failureMessages = failures.map(
        ({ result, index }) => `Event ${index}: ${(result as PromiseRejectedResult).reason}`
      ).join(', ');

      console.warn(`Failed to write ${failures.length}/${entries.length} event log entries: ${failureMessages}`);
    }
  }

  // ============================================================================
  // Convenience Methods for Common APEX Events
  // ============================================================================

  /**
   * Log service start event
   */
  async logServiceStarted(pid?: number): Promise<void> {
    const message = pid
      ? `APEX Daemon service started successfully (PID: ${pid})`
      : 'APEX Daemon service started successfully';

    await this.writeInfo(message, APEX_EVENT_IDS.SERVICE_STARTED);
  }

  /**
   * Log service stop event
   */
  async logServiceStopped(reason?: string): Promise<void> {
    const message = reason
      ? `APEX Daemon service stopped: ${reason}`
      : 'APEX Daemon service stopped normally';

    await this.writeInfo(message, APEX_EVENT_IDS.SERVICE_STOPPED);
  }

  /**
   * Log task execution start
   */
  async logTaskStarted(taskId: string, taskType?: string): Promise<void> {
    const message = taskType
      ? `Task started: ${taskId} (type: ${taskType})`
      : `Task started: ${taskId}`;

    await this.writeInfo(message, APEX_EVENT_IDS.TASK_STARTED);
  }

  /**
   * Log task completion
   */
  async logTaskCompleted(taskId: string, duration?: number): Promise<void> {
    const message = duration
      ? `Task completed: ${taskId} (duration: ${duration}ms)`
      : `Task completed: ${taskId}`;

    await this.writeInfo(message, APEX_EVENT_IDS.TASK_COMPLETED);
  }

  /**
   * Log task failure
   */
  async logTaskFailed(taskId: string, error: string): Promise<void> {
    const message = `Task failed: ${taskId} - ${error}`;
    await this.writeError(message, APEX_EVENT_IDS.TASK_FAILED);
  }

  /**
   * Log capacity limit reached
   */
  async logCapacityLimitReached(currentUsage: number, threshold: number): Promise<void> {
    const message = `Capacity limit reached: ${(currentUsage * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`;
    await this.writeWarning(message, APEX_EVENT_IDS.CAPACITY_LIMIT_REACHED);
  }

  /**
   * Log auto-pause activation
   */
  async logAutoPauseActivated(reason: string): Promise<void> {
    const message = `Auto-pause activated: ${reason}`;
    await this.writeWarning(message, APEX_EVENT_IDS.AUTO_PAUSE_ACTIVATED);
  }

  /**
   * Log configuration error
   */
  async logConfigError(error: string): Promise<void> {
    const message = `Configuration error: ${error}`;
    await this.writeError(message, APEX_EVENT_IDS.CONFIG_ERROR);
  }

  /**
   * Log critical error
   */
  async logCriticalError(error: string, context?: string): Promise<void> {
    const message = context
      ? `Critical error in ${context}: ${error}`
      : `Critical error: ${error}`;

    await this.writeError(message, APEX_EVENT_IDS.CRITICAL_ERROR);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Sanitize message for PowerShell command line
   */
  private sanitizeMessage(message: string): string {
    // Escape single quotes and other special characters for PowerShell
    return message
      .replace(/'/g, "''")  // Escape single quotes
      .replace(/\r\n/g, ' ') // Replace CRLF with space
      .replace(/\n/g, ' ')   // Replace LF with space
      .replace(/\t/g, ' ')   // Replace tabs with space
      .trim();
  }

  /**
   * Map WindowsEventLogType to PowerShell EntryType
   */
  private mapEventTypeToPS(type: WindowsEventLogType): string {
    switch (type) {
      case WindowsEventLogType.Error: return 'Error';
      case WindowsEventLogType.Warning: return 'Warning';
      case WindowsEventLogType.Information: return 'Information';
      case WindowsEventLogType.SuccessAudit: return 'SuccessAudit';
      case WindowsEventLogType.FailureAudit: return 'FailureAudit';
      default: return 'Information';
    }
  }

  /**
   * Get human-readable event type name
   */
  private getEventTypeName(type: WindowsEventLogType): string {
    switch (type) {
      case WindowsEventLogType.Error: return 'ERROR';
      case WindowsEventLogType.Warning: return 'WARNING';
      case WindowsEventLogType.Information: return 'INFO';
      case WindowsEventLogType.SuccessAudit: return 'AUDIT_SUCCESS';
      case WindowsEventLogType.FailureAudit: return 'AUDIT_FAILURE';
      default: return 'INFO';
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a pre-configured Windows Event Logger for APEX
 */
export function createApexEventLogger(): WindowsEventLogger {
  return new WindowsEventLogger({
    source: 'APEX Daemon',
    logName: 'Application',
    maxMessageLength: 32766,
    truncateMessages: true
  });
}

/**
 * Create a Windows Event Logger with custom configuration
 */
export function createCustomEventLogger(config: Partial<EventLogConfig>): WindowsEventLogger {
  return new WindowsEventLogger(config);
}