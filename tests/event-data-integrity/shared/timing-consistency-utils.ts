/**
 * Timing Consistency Utilities
 *
 * Shared utilities for validating timing consistency across different event types.
 * These utilities enforce timing invariants to ensure event data integrity.
 *
 * @module timing-consistency-utils
 */

import { expect } from 'vitest';

/**
 * Default timing tolerance in milliseconds (accounts for CI variability)
 */
export const TIMING_TOLERANCE_MS = 50;

/**
 * Standard timing data structure found in completion events
 */
export interface TimingData {
  startTime: Date;
  endTime: Date;
  duration: number;
}

/**
 * Generic event with timestamp
 * Uses a minimal interface to allow compatibility with various event types
 */
export interface TimestampedEvent {
  timestamp: Date;
}

/**
 * Event with duration information
 */
export interface DurationEvent {
  timestamp: Date;
  duration: number;
}

/**
 * Event with full timing data (tool:complete style)
 */
export interface TimedEvent {
  timestamp: Date;
  timing: TimingData;
}

/**
 * Result of timing validation
 */
export interface TimingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Core Timing Assertions
// ============================================================================

/**
 * Assert that timing data is internally consistent
 *
 * Validates:
 * - startTime is a valid Date
 * - endTime is a valid Date
 * - startTime <= endTime
 * - duration >= 0
 * - duration matches calculated value (within tolerance)
 *
 * @param timing - The timing data to validate
 * @param tolerance - Allowed deviation in milliseconds (default: TIMING_TOLERANCE_MS)
 */
export function assertTimingConsistency(
  timing: TimingData,
  tolerance: number = TIMING_TOLERANCE_MS
): void {
  // Validate date objects
  expect(timing.startTime).toBeInstanceOf(Date);
  expect(timing.endTime).toBeInstanceOf(Date);
  expect(timing.startTime.toString()).not.toBe('Invalid Date');
  expect(timing.endTime.toString()).not.toBe('Invalid Date');

  // Validate ordering: startTime <= endTime
  expect(timing.startTime.getTime()).toBeLessThanOrEqual(timing.endTime.getTime());

  // Validate duration is non-negative
  expect(timing.duration).toBeGreaterThanOrEqual(0);

  // Validate duration matches calculated value (within tolerance)
  const calculatedDuration = timing.endTime.getTime() - timing.startTime.getTime();
  const difference = Math.abs(timing.duration - calculatedDuration);
  expect(difference).toBeLessThanOrEqual(tolerance);
}

/**
 * Assert that two events are properly ordered in time
 * (earlier event's timestamp < later event's timestamp)
 *
 * @param earlier - The event that should have occurred first
 * @param later - The event that should have occurred second
 * @param allowEqual - Whether equal timestamps are acceptable (default: false)
 */
export function assertEventOrdering(
  earlier: TimestampedEvent,
  later: TimestampedEvent,
  allowEqual: boolean = false
): void {
  expect(earlier.timestamp).toBeInstanceOf(Date);
  expect(later.timestamp).toBeInstanceOf(Date);

  if (allowEqual) {
    expect(earlier.timestamp.getTime()).toBeLessThanOrEqual(later.timestamp.getTime());
  } else {
    expect(earlier.timestamp.getTime()).toBeLessThan(later.timestamp.getTime());
  }
}

/**
 * Assert that child event timing is bounded by parent event timing
 * (child occurs within parent's time span)
 *
 * @param parent - The parent event with start and end times
 * @param child - The child event with start and end times
 * @param tolerance - Allowed deviation in milliseconds
 */
export function assertNestedTiming(
  parent: { startTime: Date; endTime: Date },
  child: { startTime: Date; endTime: Date },
  tolerance: number = TIMING_TOLERANCE_MS
): void {
  // Child should start at or after parent starts (with tolerance)
  expect(child.startTime.getTime()).toBeGreaterThanOrEqual(
    parent.startTime.getTime() - tolerance
  );

  // Child should end at or before parent ends (with tolerance)
  expect(child.endTime.getTime()).toBeLessThanOrEqual(
    parent.endTime.getTime() + tolerance
  );
}

/**
 * Assert that duration is within expected bounds
 *
 * @param actualDuration - The measured duration
 * @param expectedMin - Minimum expected duration (optional)
 * @param expectedMax - Maximum expected duration (optional)
 * @param tolerance - Allowed deviation in milliseconds
 */
export function assertDurationBounds(
  actualDuration: number,
  expectedMin?: number,
  expectedMax?: number,
  tolerance: number = TIMING_TOLERANCE_MS
): void {
  expect(actualDuration).toBeGreaterThanOrEqual(0);

  if (expectedMin !== undefined) {
    expect(actualDuration).toBeGreaterThanOrEqual(expectedMin - tolerance);
  }

  if (expectedMax !== undefined) {
    expect(actualDuration).toBeLessThanOrEqual(expectedMax + tolerance);
  }
}

// ============================================================================
// Event Timing Validator Class
// ============================================================================

/**
 * Tracked event entry in the validator
 */
interface TrackedEvent {
  eventType: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  index: number;
}

/**
 * Cross-event timing validator for validating sequences of related events
 *
 * @example
 * ```typescript
 * const validator = new EventTimingValidator();
 * validator.addEvent('task:created', taskCreatedEvent.timestamp);
 * validator.addEvent('task:started', taskStartedEvent.timestamp);
 * validator.addEvent('tool:start', toolStartEvent.timestamp);
 * validator.addEvent('tool:complete', toolCompleteEvent.timestamp);
 * validator.addEvent('task:completed', taskCompletedEvent.timestamp);
 *
 * const result = validator.validateOrdering();
 * expect(result.isValid).toBe(true);
 * ```
 */
export class EventTimingValidator {
  private events: TrackedEvent[] = [];

  /**
   * Add an event to the validation sequence
   *
   * @param eventType - The type of event (e.g., 'task:created', 'tool:start')
   * @param timestamp - The event's timestamp
   * @param metadata - Optional additional metadata
   */
  addEvent(
    eventType: string,
    timestamp: Date,
    metadata: Record<string, unknown> = {}
  ): void {
    this.events.push({
      eventType,
      timestamp,
      metadata,
      index: this.events.length,
    });
  }

  /**
   * Validate that all events are in chronological order
   */
  validateOrdering(): TimingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < this.events.length; i++) {
      const prev = this.events[i - 1];
      const curr = this.events[i];

      if (curr.timestamp.getTime() < prev.timestamp.getTime()) {
        errors.push(
          `Event ordering violation: ${curr.eventType} (${curr.timestamp.toISOString()}) ` +
            `occurred before ${prev.eventType} (${prev.timestamp.toISOString()})`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate that no significant time gaps exist between events
   *
   * @param maxGapMs - Maximum allowed gap in milliseconds
   */
  validateNoGaps(maxGapMs: number): TimingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < this.events.length; i++) {
      const prev = this.events[i - 1];
      const curr = this.events[i];
      const gap = curr.timestamp.getTime() - prev.timestamp.getTime();

      if (gap > maxGapMs) {
        warnings.push(
          `Large time gap detected: ${gap}ms between ` +
            `${prev.eventType} and ${curr.eventType}`
        );
      }
    }

    return {
      isValid: true, // Gaps are warnings, not errors
      errors,
      warnings,
    };
  }

  /**
   * Validate that events with timing ranges don't overlap incorrectly
   * (Only applicable to events with start/end times in metadata)
   */
  validateNoOverlaps(): TimingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const timedEvents = this.events.filter(
      (e) => e.metadata.startTime && e.metadata.endTime
    );

    for (let i = 0; i < timedEvents.length; i++) {
      for (let j = i + 1; j < timedEvents.length; j++) {
        const a = timedEvents[i];
        const b = timedEvents[j];

        const aStart = (a.metadata.startTime as Date).getTime();
        const aEnd = (a.metadata.endTime as Date).getTime();
        const bStart = (b.metadata.startTime as Date).getTime();
        const bEnd = (b.metadata.endTime as Date).getTime();

        // Check for overlaps (excluding proper nesting)
        const overlaps = aStart < bEnd && bStart < aEnd;
        const aContainsB = aStart <= bStart && aEnd >= bEnd;
        const bContainsA = bStart <= aStart && bEnd >= aEnd;

        if (overlaps && !aContainsB && !bContainsA) {
          warnings.push(
            `Timing overlap detected between ${a.eventType} and ${b.eventType}`
          );
        }
      }
    }

    return {
      isValid: true, // Overlaps are warnings for now
      errors,
      warnings,
    };
  }

  /**
   * Get all tracked events
   */
  getEvents(): TrackedEvent[] {
    return [...this.events];
  }

  /**
   * Clear all tracked events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get total duration from first to last event
   */
  getTotalDuration(): number {
    if (this.events.length < 2) return 0;
    const first = this.events[0];
    const last = this.events[this.events.length - 1];
    return last.timestamp.getTime() - first.timestamp.getTime();
  }
}

// ============================================================================
// Event Sequence Helpers
// ============================================================================

/**
 * Event sequence configuration
 */
export interface EventSequenceConfig {
  taskDuration: number;
  toolCount: number;
  toolDuration?: number;
  includeApproval?: boolean;
  includeFailures?: boolean;
  includeProgress?: boolean;
}

/**
 * Generated event sequence
 */
export interface EventSequence {
  events: Array<{
    type: string;
    timestamp: Date;
    data: Record<string, unknown>;
  }>;
  totalDuration: number;
  taskId: string;
}

/**
 * Create a realistic event sequence with proper timing
 *
 * @param config - Configuration for the sequence
 * @returns Generated event sequence
 */
export function createEventSequence(config: EventSequenceConfig): EventSequence {
  const {
    taskDuration,
    toolCount,
    toolDuration = 50,
    includeApproval = false,
    includeFailures = false,
    includeProgress = false,
  } = config;

  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const events: EventSequence['events'] = [];
  let currentTime = Date.now();

  // Task created
  events.push({
    type: 'task:created',
    timestamp: new Date(currentTime),
    data: { taskId },
  });
  currentTime += 10;

  // Task started
  events.push({
    type: 'task:started',
    timestamp: new Date(currentTime),
    data: { taskId, stage: 'implementation' },
  });

  // Tool events
  const timePerTool = (taskDuration - 50) / toolCount;

  for (let i = 0; i < toolCount; i++) {
    const toolCallId = `call-${i}`;
    const isFailure = includeFailures && i === toolCount - 1;

    // Tool start
    currentTime += 10;
    const toolStartTime = currentTime;
    events.push({
      type: 'tool:start',
      timestamp: new Date(currentTime),
      data: { taskId, callId: toolCallId, toolName: `Tool${i}` },
    });

    // Tool progress (optional)
    if (includeProgress) {
      currentTime += toolDuration / 2;
      events.push({
        type: 'tool:progress',
        timestamp: new Date(currentTime),
        data: { taskId, callId: toolCallId, progress: 50 },
      });
    }

    // Tool complete
    currentTime += toolDuration;
    const toolEndTime = currentTime;
    events.push({
      type: 'tool:complete',
      timestamp: new Date(currentTime),
      data: {
        taskId,
        callId: toolCallId,
        success: !isFailure,
        timing: {
          startTime: new Date(toolStartTime),
          endTime: new Date(toolEndTime),
          duration: toolEndTime - toolStartTime,
        },
      },
    });

    currentTime += Math.max(0, timePerTool - toolDuration - 20);
  }

  // Approval events (optional)
  if (includeApproval) {
    const approvalId = `approval-${Date.now()}`;
    currentTime += 10;

    events.push({
      type: 'approval-required',
      timestamp: new Date(currentTime),
      data: { taskId, approvalId, requestedAt: new Date(currentTime) },
    });

    currentTime += 100;

    events.push({
      type: 'approval-resolved',
      timestamp: new Date(currentTime),
      data: {
        taskId,
        approvalId,
        resolution: 'approved',
        resolvedAt: new Date(currentTime),
      },
    });
  }

  // Task completed
  currentTime += 10;
  const taskCompletedTime = currentTime;
  const actualDuration = taskCompletedTime - events[0].timestamp.getTime();

  events.push({
    type: 'task:completed',
    timestamp: new Date(currentTime),
    data: { taskId, duration: actualDuration },
  });

  return {
    events,
    totalDuration: actualDuration,
    taskId,
  };
}

// ============================================================================
// Timing Comparison Helpers
// ============================================================================

/**
 * Compare two timestamps and return the relationship
 */
export function compareTimestamps(
  a: Date,
  b: Date
): 'before' | 'equal' | 'after' {
  const diff = a.getTime() - b.getTime();
  if (diff < 0) return 'before';
  if (diff > 0) return 'after';
  return 'equal';
}

/**
 * Calculate the overlap between two time ranges
 *
 * @returns Overlap in milliseconds (0 if no overlap)
 */
export function calculateOverlap(
  range1: { start: Date; end: Date },
  range2: { start: Date; end: Date }
): number {
  const start = Math.max(range1.start.getTime(), range2.start.getTime());
  const end = Math.min(range1.end.getTime(), range2.end.getTime());
  return Math.max(0, end - start);
}

/**
 * Check if a timestamp is within a time range
 */
export function isWithinRange(
  timestamp: Date,
  range: { start: Date; end: Date },
  tolerance: number = TIMING_TOLERANCE_MS
): boolean {
  const time = timestamp.getTime();
  return (
    time >= range.start.getTime() - tolerance &&
    time <= range.end.getTime() + tolerance
  );
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Validate that timing data survives JSON serialization round-trip
 */
export function validateTimingSerializationRoundTrip(timing: TimingData): {
  isValid: boolean;
  original: TimingData;
  deserialized: TimingData;
  errors: string[];
} {
  const errors: string[] = [];

  // Serialize
  const serialized = JSON.stringify(timing);
  const parsed = JSON.parse(serialized);

  // Reconstruct dates
  const deserialized: TimingData = {
    startTime: new Date(parsed.startTime),
    endTime: new Date(parsed.endTime),
    duration: parsed.duration,
  };

  // Validate
  if (timing.startTime.getTime() !== deserialized.startTime.getTime()) {
    errors.push('startTime mismatch after serialization');
  }

  if (timing.endTime.getTime() !== deserialized.endTime.getTime()) {
    errors.push('endTime mismatch after serialization');
  }

  if (timing.duration !== deserialized.duration) {
    errors.push('duration mismatch after serialization');
  }

  return {
    isValid: errors.length === 0,
    original: timing,
    deserialized,
    errors,
  };
}

/**
 * Validate ISO 8601 timestamp parsing
 */
export function validateISOTimestamp(isoString: string): {
  isValid: boolean;
  parsedDate: Date | null;
  error?: string;
} {
  const parsed = new Date(isoString);

  if (isNaN(parsed.getTime())) {
    return {
      isValid: false,
      parsedDate: null,
      error: `Invalid ISO 8601 timestamp: ${isoString}`,
    };
  }

  return {
    isValid: true,
    parsedDate: parsed,
  };
}
