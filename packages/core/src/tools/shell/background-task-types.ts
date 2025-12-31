/**
 * @fileoverview Type definitions for background task execution
 *
 * This module defines the types and interfaces for managing background
 * shell command execution in the APEX platform.
 *
 * @module @apex/core/tools/shell/background-task-types
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Unique identifier for a background task
 */
export type BackgroundTaskId = string;

/**
 * Status of a background task
 */
export type BackgroundTaskStatus =
  | 'running'    // Process is actively running
  | 'completed'  // Process exited with code 0
  | 'failed'     // Process exited with non-zero code
  | 'killed'     // Process was killed by signal
  | 'unknown';   // Status cannot be determined

// ============================================================================
// Information and Output Interfaces
// ============================================================================

/**
 * Information about a background task (public view, no process handle)
 */
export interface BackgroundTaskInfo {
  /** Unique task identifier */
  taskId: BackgroundTaskId;
  /** Operating system process ID */
  pid: number;
  /** Original command that was executed */
  command: string;
  /** When the task was started */
  startedAt: Date;
  /** When the task completed (if applicable) */
  completedAt?: Date;
  /** Current status */
  status: BackgroundTaskStatus;
  /** Exit code if completed/failed */
  exitCode?: number;
  /** Signal that killed the process (if applicable) */
  signal?: string;
  /** Working directory */
  workingDirectory?: string;
  /** Description from the original command */
  description?: string;
}

/**
 * Output from a background task
 */
export interface BackgroundTaskOutput {
  /** Buffered stdout (may be truncated) */
  stdout: string;
  /** Buffered stderr (may be truncated) */
  stderr: string;
  /** Exit code if process has exited */
  exitCode?: number;
  /** Whether process is still running */
  isRunning: boolean;
  /** Whether output was truncated due to buffer limits */
  truncated: boolean;
}

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Configuration options for the BackgroundTaskManager
 */
export interface BackgroundTaskManagerConfig {
  /** Maximum stdout/stderr buffer per task in bytes (default: 1MB) */
  maxBufferSize?: number;
  /** Auto-cleanup completed tasks after this duration in ms (default: 1 hour) */
  cleanupAfterMs?: number;
  /** Maximum concurrent background tasks (default: 10) */
  maxConcurrentTasks?: number;
  /** Cleanup interval in ms (default: 5 minutes) */
  cleanupIntervalMs?: number;
}

/**
 * Options for registering a background task
 */
export interface BackgroundTaskRegisterOptions {
  /** Working directory for the command */
  workingDirectory?: string;
  /** Human-readable description of what the command does */
  description?: string;
}

// ============================================================================
// Event Interfaces
// ============================================================================

/**
 * Events emitted by the BackgroundTaskManager
 */
export interface BackgroundTaskManagerEvents {
  /** Emitted when stdout data is received */
  stdout: (taskId: BackgroundTaskId, data: string) => void;
  /** Emitted when stderr data is received */
  stderr: (taskId: BackgroundTaskId, data: string) => void;
  /** Emitted when a task exits */
  exit: (taskId: BackgroundTaskId, code: number | null, signal: NodeJS.Signals | null) => void;
  /** Emitted when a task encounters an error */
  error: (taskId: BackgroundTaskId, error: Error) => void;
  /** Emitted when a task is registered */
  registered: (taskId: BackgroundTaskId, info: BackgroundTaskInfo) => void;
  /** Emitted when a task is cleaned up */
  cleaned: (taskId: BackgroundTaskId) => void;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of killing a background task
 */
export interface BackgroundTaskKillResult {
  /** Whether the kill was successful */
  success: boolean;
  /** Human-readable message about the result */
  message: string;
  /** The task ID that was targeted */
  taskId: BackgroundTaskId;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration values for BackgroundTaskManager
 */
export const BACKGROUND_TASK_DEFAULTS: Required<BackgroundTaskManagerConfig> = {
  maxBufferSize: 1024 * 1024,        // 1MB
  cleanupAfterMs: 60 * 60 * 1000,    // 1 hour
  maxConcurrentTasks: 10,
  cleanupIntervalMs: 5 * 60 * 1000,  // 5 minutes
} as const;
