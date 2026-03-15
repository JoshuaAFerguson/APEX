/**
 * Timing Consistency Utilities
 *
 * Provides constants and utilities for ensuring consistent timing
 * validation across all event data integrity tests.
 */

/**
 * Default timing tolerance in milliseconds for cross-event consistency checks.
 * This accounts for system clock precision and test execution variations.
 */
export const TIMING_TOLERANCE_MS = 50;

/**
 * Extended timing tolerance for integration tests that involve actual tool execution.
 */
export const INTEGRATION_TIMING_TOLERANCE_MS = 500;

/**
 * Maximum reasonable duration for any tool execution (5 minutes).
 * Used to detect potential hanging tools or infinite loops.
 */
export const MAX_REASONABLE_DURATION_MS = 5 * 60 * 1000;

/**
 * Minimum reasonable duration for tool execution (1ms).
 * Zero duration events are flagged as warnings but not errors.
 */
export const MIN_REASONABLE_DURATION_MS = 1;

/**
 * Calculate the difference between two timestamps
 */
export function calculateTimeDifference(time1: Date, time2: Date): number {
  return Math.abs(time1.getTime() - time2.getTime());
}

/**
 * Check if two timestamps are within the specified tolerance
 */
export function areTimestampsWithinTolerance(
  time1: Date,
  time2: Date,
  tolerance: number = TIMING_TOLERANCE_MS
): boolean {
  return calculateTimeDifference(time1, time2) <= tolerance;
}

/**
 * Check if a duration is within reasonable bounds
 */
export function isReasonableDuration(duration: number): {
  isReasonable: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (duration < 0) {
    issues.push('Duration cannot be negative');
  }

  if (duration > MAX_REASONABLE_DURATION_MS) {
    issues.push(`Duration exceeds maximum reasonable limit (${MAX_REASONABLE_DURATION_MS}ms)`);
  }

  if (duration === 0) {
    issues.push('Zero duration detected (instant execution)');
  }

  return {
    isReasonable: issues.length === 0,
    issues
  };
}

/**
 * Format a duration in human-readable form
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = ((durationMs % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Interface for timing event data
 */
export interface TimingEvent {
  id: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for timing validation result
 */
export interface TimingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * EventTimingValidator class for validating chronological ordering of events
 */
export class EventTimingValidator {
  private events: TimingEvent[] = [];

  /**
   * Add an event to the validator
   */
  addEvent(id: string, timestamp: Date, metadata?: Record<string, unknown>): void {
    this.events.push({ id, timestamp, metadata });
  }

  /**
   * Clear all events from the validator
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Validate the chronological ordering of events
   */
  validateOrdering(): TimingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.events.length === 0) {
      return { isValid: true, errors, warnings };
    }

    // Sort events by timestamp for validation
    const sortedEvents = [...this.events].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Check for chronological ordering issues
    for (let i = 1; i < sortedEvents.length; i++) {
      const prevEvent = sortedEvents[i - 1];
      const currentEvent = sortedEvents[i];

      // Check if timestamps are in correct order
      if (currentEvent.timestamp.getTime() < prevEvent.timestamp.getTime()) {
        errors.push(
          `Event '${currentEvent.id}' has timestamp before event '${prevEvent.id}'`
        );
      }

      // Check for identical timestamps (potential race condition)
      if (currentEvent.timestamp.getTime() === prevEvent.timestamp.getTime()) {
        warnings.push(
          `Events '${prevEvent.id}' and '${currentEvent.id}' have identical timestamps`
        );
      }
    }

    // Validate timing metadata if present
    for (const event of this.events) {
      if (event.metadata?.startTime && event.metadata?.endTime) {
        const startTime = event.metadata.startTime as Date;
        const endTime = event.metadata.endTime as Date;

        if (endTime.getTime() < startTime.getTime()) {
          errors.push(
            `Event '${event.id}' has endTime before startTime`
          );
        }

        // Check if timing duration is reasonable
        const duration = endTime.getTime() - startTime.getTime();
        const durationCheck = isReasonableDuration(duration);

        if (!durationCheck.isReasonable) {
          durationCheck.issues.forEach(issue => {
            if (issue.includes('cannot be negative')) {
              errors.push(`Event '${event.id}': ${issue}`);
            } else {
              warnings.push(`Event '${event.id}': ${issue}`);
            }
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get all events in chronological order
   */
  getEvents(): TimingEvent[] {
    return [...this.events].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  /**
   * Get the total duration from first to last event
   */
  getTotalDuration(): number {
    if (this.events.length < 2) {
      return 0;
    }

    const sorted = this.getEvents();
    return sorted[sorted.length - 1].timestamp.getTime() - sorted[0].timestamp.getTime();
  }
}

/**
 * Create a sequence of timed events for testing
 */
export function createEventSequence(
  events: Array<{ id: string; delayMs: number; metadata?: Record<string, unknown> }>
): TimingEvent[] {
  const startTime = new Date();
  let currentTime = startTime.getTime();

  return events.map(event => {
    currentTime += event.delayMs;
    return {
      id: event.id,
      timestamp: new Date(currentTime),
      metadata: event.metadata
    };
  });
}

/**
 * Assert that events are in chronological order
 */
export function assertEventOrdering(
  events: TimingEvent[],
  toleranceMs: number = TIMING_TOLERANCE_MS
): void {
  for (let i = 1; i < events.length; i++) {
    const prevTime = events[i - 1].timestamp.getTime();
    const currentTime = events[i].timestamp.getTime();

    if (currentTime < prevTime - toleranceMs) {
      throw new Error(
        `Event ordering violation: '${events[i].id}' (${currentTime}) ` +
        `occurs before '${events[i - 1].id}' (${prevTime}) outside tolerance (${toleranceMs}ms)`
      );
    }
  }
}