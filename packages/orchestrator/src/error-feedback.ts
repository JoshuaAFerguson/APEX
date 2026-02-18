/**
 * ErrorFeedbackLoop - Core class for receiving and tracking compiler errors
 *
 * This module provides:
 * - CompilerError: Enhanced error representation with metadata
 * - ErrorFeedbackLoop: EventEmitter class for error reception and tracking
 * - Event types: Typed events for error:received, error:resolved, errors:cleared
 *
 * @module error-feedback
 */

import { EventEmitter } from 'eventemitter3';
import { StructuredError } from '@apexcli/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Compiler error with additional metadata for feedback loop processing
 */
export interface CompilerError {
  /** Unique identifier for this error instance */
  id: string;
  /** The structured error from @apexcli/core */
  error: StructuredError;
  /** When the error was received */
  receivedAt: Date;
  /** Task ID associated with this error (if any) */
  taskId?: string;
  /** Whether the error has been addressed/fixed */
  resolved: boolean;
  /** Resolution timestamp */
  resolvedAt?: Date;
}

/**
 * Event payload for error:received event
 */
export interface ErrorReceivedEvent {
  /** The compiler error that was received */
  error: CompilerError;
  /** Total count of unresolved errors after this one was added */
  unresolvedCount: number;
  /** Timestamp of the event */
  timestamp: Date;
}

/**
 * Event payload for error:resolved event
 */
export interface ErrorResolvedEvent {
  /** The compiler error that was resolved */
  error: CompilerError;
  /** Remaining unresolved error count */
  remainingCount: number;
  /** Timestamp of resolution */
  timestamp: Date;
}

/**
 * Event payload for errors:cleared event
 */
export interface ErrorsClearedEvent {
  /** Number of errors that were cleared */
  clearedCount: number;
  /** Task ID if errors were cleared for a specific task */
  taskId?: string;
  /** Timestamp of the clear operation */
  timestamp: Date;
}

// ============================================================================
// Events Interface
// ============================================================================

export interface ErrorFeedbackLoopEvents {
  /** Emitted when a new error is received */
  'error:received': (event: ErrorReceivedEvent) => void;
  /** Emitted when an error is marked as resolved */
  'error:resolved': (event: ErrorResolvedEvent) => void;
  /** Emitted when errors are cleared */
  'errors:cleared': (event: ErrorsClearedEvent) => void;
}

// ============================================================================
// ErrorFeedbackLoop Class
// ============================================================================

/**
 * ErrorFeedbackLoop - Manages compiler error reception and tracking
 *
 * This class provides a centralized mechanism for receiving, storing, and
 * tracking compiler errors from various sources (TypeScript, ESLint, build tools).
 * It maintains an in-memory store of errors and emits events for real-time
 * notification of error state changes.
 *
 * @example
 * ```typescript
 * const errorLoop = new ErrorFeedbackLoop();
 *
 * // Listen for new errors
 * errorLoop.on('error:received', (event) => {
 *   console.log(`New error: ${event.error.error.message}`);
 *   console.log(`Total unresolved: ${event.unresolvedCount}`);
 * });
 *
 * // Receive an error
 * const compilerError = errorLoop.receiveError(structuredError, 'task-123');
 *
 * // Query errors
 * const unresolved = errorLoop.getUnresolvedErrors('task-123');
 *
 * // Mark as resolved
 * errorLoop.resolveError(compilerError.id);
 * ```
 */
export class ErrorFeedbackLoop extends EventEmitter<ErrorFeedbackLoopEvents> {
  /** In-memory error storage indexed by error ID */
  private errors: Map<string, CompilerError> = new Map();

  /**
   * Creates a new ErrorFeedbackLoop instance
   */
  constructor() {
    super();
  }

  /**
   * Receive a new compiler error
   *
   * Stores the error in memory and emits an 'error:received' event.
   * The error is automatically assigned a unique ID and marked as unresolved.
   *
   * @param error - The structured error to receive
   * @param taskId - Optional task ID to associate with the error
   * @returns The created CompilerError with metadata
   */
  receiveError(error: StructuredError, taskId?: string): CompilerError {
    const compilerError: CompilerError = {
      id: this.generateId(),
      error,
      receivedAt: new Date(),
      taskId,
      resolved: false,
    };

    this.errors.set(compilerError.id, compilerError);

    this.emit('error:received', {
      error: compilerError,
      unresolvedCount: this.getUnresolvedCount(),
      timestamp: new Date(),
    });

    return compilerError;
  }

  /**
   * Receive multiple errors at once (e.g., from a build)
   *
   * Convenience method for receiving multiple errors from a single source.
   * Each error is processed individually and emits its own 'error:received' event.
   *
   * @param errors - Array of structured errors to receive
   * @param taskId - Optional task ID to associate with all errors
   * @returns Array of created CompilerError objects with metadata
   */
  receiveErrors(errors: StructuredError[], taskId?: string): CompilerError[] {
    return errors.map(error => this.receiveError(error, taskId));
  }

  /**
   * Mark an error as resolved
   *
   * Updates the error status and emits an 'error:resolved' event.
   * Sets the resolvedAt timestamp to the current time.
   *
   * @param errorId - The ID of the error to resolve
   * @returns true if the error was found and resolved, false if not found
   */
  resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (!error) {
      return false;
    }

    error.resolved = true;
    error.resolvedAt = new Date();

    this.emit('error:resolved', {
      error,
      remainingCount: this.getUnresolvedCount(),
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Get all errors (optionally filtered by task)
   *
   * @param taskId - Optional task ID to filter by
   * @returns Array of all matching CompilerError objects
   */
  getErrors(taskId?: string): CompilerError[] {
    const allErrors = Array.from(this.errors.values());

    if (taskId === undefined) {
      return allErrors;
    }

    return allErrors.filter(error => error.taskId === taskId);
  }

  /**
   * Get unresolved errors
   *
   * @param taskId - Optional task ID to filter by
   * @returns Array of unresolved CompilerError objects
   */
  getUnresolvedErrors(taskId?: string): CompilerError[] {
    return this.getErrors(taskId).filter(error => !error.resolved);
  }

  /**
   * Get resolved errors
   *
   * @param taskId - Optional task ID to filter by
   * @returns Array of resolved CompilerError objects
   */
  getResolvedErrors(taskId?: string): CompilerError[] {
    return this.getErrors(taskId).filter(error => error.resolved);
  }

  /**
   * Clear all errors (optionally for a specific task)
   *
   * Removes errors from memory and emits an 'errors:cleared' event.
   * Can be used to clean up after task completion or system restart.
   *
   * @param taskId - Optional task ID to clear errors for (if not provided, clears all)
   * @returns Number of errors that were cleared
   */
  clearErrors(taskId?: string): number {
    let clearedCount = 0;

    if (taskId === undefined) {
      // Clear all errors
      clearedCount = this.errors.size;
      this.errors.clear();
    } else {
      // Clear errors for specific task
      const errorIdsToDelete: string[] = [];

      for (const [id, error] of this.errors.entries()) {
        if (error.taskId === taskId) {
          errorIdsToDelete.push(id);
        }
      }

      for (const id of errorIdsToDelete) {
        this.errors.delete(id);
      }

      clearedCount = errorIdsToDelete.length;
    }

    if (clearedCount > 0) {
      this.emit('errors:cleared', {
        clearedCount,
        taskId,
        timestamp: new Date(),
      });
    }

    return clearedCount;
  }

  /**
   * Get count of unresolved errors
   *
   * @param taskId - Optional task ID to filter by
   * @returns Number of unresolved errors
   */
  getUnresolvedCount(taskId?: string): number {
    return this.getUnresolvedErrors(taskId).length;
  }

  /**
   * Check if there are any unresolved errors
   *
   * @param taskId - Optional task ID to filter by
   * @returns true if there are unresolved errors, false otherwise
   */
  hasUnresolvedErrors(taskId?: string): boolean {
    return this.getUnresolvedCount(taskId) > 0;
  }

  /**
   * Get error statistics
   *
   * Provides summary statistics about errors in the system.
   *
   * @param taskId - Optional task ID to filter by
   * @returns Object with error counts and statistics
   */
  getErrorStats(taskId?: string): {
    total: number;
    unresolved: number;
    resolved: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const errors = this.getErrors(taskId);
    const unresolved = errors.filter(e => !e.resolved);
    const resolved = errors.filter(e => e.resolved);

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const error of errors) {
      const category = error.error.category;
      const severity = error.error.severity;

      byCategory[category] = (byCategory[category] || 0) + 1;
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    }

    return {
      total: errors.length,
      unresolved: unresolved.length,
      resolved: resolved.length,
      byCategory,
      bySeverity,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate a unique error ID
   *
   * Creates a unique identifier for error instances using timestamp and random data.
   *
   * @returns A unique error identifier string
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `err-${timestamp}-${random}`;
  }
}