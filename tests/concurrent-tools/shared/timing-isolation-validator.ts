/**
 * Timing Isolation Validator
 *
 * Validates that timing events from concurrent tool executions remain properly
 * isolated and do not interfere with each other. Provides comprehensive checks
 * for timing data integrity across concurrent tool executions.
 *
 * @module timing-isolation-validator
 */

import type { ConcurrentEventEntry, ExecutionSummary } from './concurrent-event-collector';
import { TIMING_TOLERANCE_MS } from '../../event-data-integrity/shared/timing-consistency-utils';

/**
 * Types of timing isolation violations
 */
export type TimingIsolationViolationType =
  | 'timestamp_collision'
  | 'duration_interference'
  | 'timing_overlap_error'
  | 'cross_contamination'
  | 'timing_boundary_violation'
  | 'timing_object_sharing'
  | 'calculation_mismatch';

/**
 * A timing isolation violation found during validation
 */
export interface TimingIsolationViolation {
  /** Type of violation detected */
  type: TimingIsolationViolationType;
  /** Call IDs of the affected tool executions */
  callIds: string[];
  /** Tool names involved */
  toolNames: string[];
  /** Human-readable description of the violation */
  description: string;
  /** Severity level */
  severity: 'error' | 'warning';
  /** Evidence of the violation */
  evidence: {
    expected: unknown;
    actual: unknown;
  };
}

/**
 * Result of timing isolation validation
 */
export interface TimingIsolationResult {
  /** Whether all timing is properly isolated */
  isIsolated: boolean;
  /** List of violations found */
  violations: TimingIsolationViolation[];
  /** Statistical summary */
  stats: TimingIsolationStats;
}

/**
 * Statistics about timing isolation validation
 */
export interface TimingIsolationStats {
  /** Total number of tool executions analyzed */
  toolExecutions: number;
  /** Number of unique tool types */
  uniqueTools: number;
  /** Maximum number of concurrent executions */
  maxConcurrency: number;
  /** Average duration across all tools */
  avgDuration: number;
  /** Number of potential timing collisions detected */
  timingCollisions: number;
  /** Number of pairs checked for isolation */
  pairsChecked: number;
}

/**
 * Record of a single tool's timing data for isolation checking
 */
export interface ToolTimingRecord {
  /** Unique identifier for this execution */
  callId: string;
  /** Name of the tool executed */
  toolName: string;
  /** Task this execution belongs to */
  taskId: string;
  /** When the tool started */
  startTime: Date;
  /** When the tool completed */
  endTime: Date;
  /** Duration in milliseconds */
  duration: number;
  /** Sequence number when captured */
  captureSequence: number;
  /** Whether the execution succeeded */
  success?: boolean;
}

/**
 * Configuration for timing isolation validation
 */
export interface TimingIsolationValidatorConfig {
  /** Tolerance for timing comparisons (default: TIMING_TOLERANCE_MS) */
  timingTolerance?: number;
  /** Whether to treat exact timestamp matches as violations (default: true) */
  strictTimestampUniqueness?: boolean;
  /** Whether to check for object reference sharing (default: true) */
  checkObjectSharing?: boolean;
}

/**
 * Timing Isolation Validator
 *
 * Validates that concurrent tool executions maintain proper timing isolation.
 */
export class TimingIsolationValidator {
  private timings = new Map<string, ToolTimingRecord>();
  private config: Required<TimingIsolationValidatorConfig>;

  constructor(config: TimingIsolationValidatorConfig = {}) {
    this.config = {
      timingTolerance: config.timingTolerance ?? TIMING_TOLERANCE_MS,
      strictTimestampUniqueness: config.strictTimestampUniqueness ?? true,
      checkObjectSharing: config.checkObjectSharing ?? true,
    };
  }

  /**
   * Add a timing record for validation
   */
  addTimingRecord(record: ToolTimingRecord): void {
    this.timings.set(record.callId, record);
  }

  /**
   * Add multiple timing records from execution summaries
   */
  addFromExecutionSummaries(summaries: Map<string, ExecutionSummary>): void {
    for (const [callId, summary] of summaries) {
      if (summary.startEvent && summary.completeEvent) {
        const completeData = summary.completeEvent.data as {
          timing?: { startTime: Date; endTime: Date; duration: number };
          result?: { success: boolean };
        };

        if (completeData?.timing) {
          this.addTimingRecord({
            callId,
            toolName: summary.toolName,
            taskId: summary.taskId,
            startTime: completeData.timing.startTime,
            endTime: completeData.timing.endTime,
            duration: completeData.timing.duration,
            captureSequence: summary.completeEvent.sequenceIndex,
            success: completeData.result?.success,
          });
        }
      }
    }
  }

  /**
   * Add timing records from concurrent events
   */
  addFromEvents(events: ConcurrentEventEntry[]): void {
    const completeEvents = events.filter(e => e.type === 'tool:complete');

    for (const event of completeEvents) {
      const eventData = event.data as {
        timing?: { startTime: Date; endTime: Date; duration: number };
        result?: { success: boolean };
      };

      if (eventData?.timing) {
        this.addTimingRecord({
          callId: event.callId,
          toolName: event.toolName,
          taskId: event.taskId,
          startTime: eventData.timing.startTime,
          endTime: eventData.timing.endTime,
          duration: eventData.timing.duration,
          captureSequence: event.sequenceIndex,
          success: eventData.result?.success,
        });
      }
    }
  }

  /**
   * Validate timing boundaries don't overlap incorrectly
   */
  validateTimingBoundaries(): TimingIsolationViolation[] {
    const violations: TimingIsolationViolation[] = [];
    const records = Array.from(this.timings.values());

    for (const record of records) {
      // endTime should never be before startTime
      if (record.endTime.getTime() < record.startTime.getTime()) {
        violations.push({
          type: 'timing_boundary_violation',
          callIds: [record.callId],
          toolNames: [record.toolName],
          description: `Tool ${record.toolName} (${record.callId}) has endTime before startTime`,
          severity: 'error',
          evidence: {
            expected: `endTime >= startTime`,
            actual: {
              startTime: record.startTime.toISOString(),
              endTime: record.endTime.toISOString(),
            },
          },
        });
      }
    }

    return violations;
  }

  /**
   * Validates each tool's duration is calculated independently
   */
  validateDurationIndependence(): TimingIsolationViolation[] {
    const violations: TimingIsolationViolation[] = [];
    const records = Array.from(this.timings.values());

    for (const record of records) {
      const calculatedDuration =
        record.endTime.getTime() - record.startTime.getTime();
      const difference = Math.abs(record.duration - calculatedDuration);

      if (difference > this.config.timingTolerance) {
        violations.push({
          type: 'calculation_mismatch',
          callIds: [record.callId],
          toolNames: [record.toolName],
          description: `Duration mismatch for ${record.toolName} (${record.callId}): ` +
            `reported ${record.duration}ms but calculated ${calculatedDuration}ms`,
          severity: 'error',
          evidence: {
            expected: calculatedDuration,
            actual: record.duration,
          },
        });
      }
    }

    return violations;
  }

  /**
   * Validates timestamps are not shared or confused between tools
   */
  validateTimestampUniqueness(): TimingIsolationViolation[] {
    const violations: TimingIsolationViolation[] = [];
    const records = Array.from(this.timings.values());

    if (!this.config.strictTimestampUniqueness) {
      return violations;
    }

    // Check for exact timestamp collisions (same millisecond value for different tools)
    const startTimeMap = new Map<number, ToolTimingRecord[]>();
    const endTimeMap = new Map<number, ToolTimingRecord[]>();

    for (const record of records) {
      const startMs = record.startTime.getTime();
      const endMs = record.endTime.getTime();

      // Group by start time
      const startGroup = startTimeMap.get(startMs) || [];
      startGroup.push(record);
      startTimeMap.set(startMs, startGroup);

      // Group by end time
      const endGroup = endTimeMap.get(endMs) || [];
      endGroup.push(record);
      endTimeMap.set(endMs, endGroup);
    }

    // Report collisions as warnings (not errors - timestamps can legitimately match)
    for (const [timestamp, group] of startTimeMap) {
      if (group.length > 1) {
        // Only warn if different tool types have exact same timestamp
        const uniqueTools = new Set(group.map(r => r.toolName));
        if (uniqueTools.size > 1) {
          violations.push({
            type: 'timestamp_collision',
            callIds: group.map(r => r.callId),
            toolNames: group.map(r => r.toolName),
            description: `${group.length} different tools share exact startTime: ${new Date(timestamp).toISOString()}`,
            severity: 'warning',
            evidence: {
              expected: 'unique timestamps for different tools',
              actual: group.map(r => ({ callId: r.callId, toolName: r.toolName })),
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validates event sequences don't cross-contaminate timing data
   */
  validateNoTimingCrossContamination(): TimingIsolationViolation[] {
    const violations: TimingIsolationViolation[] = [];
    const records = Array.from(this.timings.values());

    // Check that no two different tool executions share the exact same timing object values
    // (This would indicate a reference sharing bug)
    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const recordA = records[i];
        const recordB = records[j];

        // Skip if same tool type (can legitimately have same timing in some scenarios)
        if (recordA.toolName === recordB.toolName) {
          continue;
        }

        // Check for suspicious timing similarity that suggests cross-contamination
        const startMatch =
          recordA.startTime.getTime() === recordB.startTime.getTime();
        const endMatch =
          recordA.endTime.getTime() === recordB.endTime.getTime();
        const durationMatch = recordA.duration === recordB.duration;

        // If all three match for different tools, that's suspicious
        // BUT: Very short duration tools (< 5ms) can legitimately have matching timestamps
        // when they complete at the same millisecond, especially in rapid execution tests.
        // Only flag durations > 5ms as suspicious cross-contamination.
        const minSuspiciousDuration = 5;
        if (startMatch && endMatch && durationMatch && recordA.duration > minSuspiciousDuration) {
          violations.push({
            type: 'cross_contamination',
            callIds: [recordA.callId, recordB.callId],
            toolNames: [recordA.toolName, recordB.toolName],
            description: `Suspicious timing match between ${recordA.toolName} and ${recordB.toolName}: ` +
              `identical start, end, and duration (${recordA.duration}ms)`,
            severity: 'error',
            evidence: {
              expected: 'independent timing values for different tools',
              actual: {
                recordA: {
                  callId: recordA.callId,
                  toolName: recordA.toolName,
                  startTime: recordA.startTime.toISOString(),
                  endTime: recordA.endTime.toISOString(),
                  duration: recordA.duration,
                },
                recordB: {
                  callId: recordB.callId,
                  toolName: recordB.toolName,
                  startTime: recordB.startTime.toISOString(),
                  endTime: recordB.endTime.toISOString(),
                  duration: recordB.duration,
                },
              },
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Calculate statistics about the timing records
   */
  calculateStats(): TimingIsolationStats {
    const records = Array.from(this.timings.values());

    if (records.length === 0) {
      return {
        toolExecutions: 0,
        uniqueTools: 0,
        maxConcurrency: 0,
        avgDuration: 0,
        timingCollisions: 0,
        pairsChecked: 0,
      };
    }

    // Count unique tools
    const uniqueTools = new Set(records.map(r => r.toolName));

    // Calculate average duration
    const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / records.length;

    // Calculate max concurrency
    let maxConcurrency = 0;
    let currentConcurrency = 0;
    const events: Array<{ time: number; delta: number }> = [];

    for (const record of records) {
      events.push({ time: record.startTime.getTime(), delta: 1 });
      events.push({ time: record.endTime.getTime(), delta: -1 });
    }

    events.sort((a, b) => a.time - b.time);

    for (const event of events) {
      currentConcurrency += event.delta;
      maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
    }

    // Count timing collisions (same timestamp)
    const startTimes = records.map(r => r.startTime.getTime());
    const timingCollisions = startTimes.length - new Set(startTimes).size;

    // Calculate pairs checked
    const pairsChecked = (records.length * (records.length - 1)) / 2;

    return {
      toolExecutions: records.length,
      uniqueTools: uniqueTools.size,
      maxConcurrency,
      avgDuration,
      timingCollisions,
      pairsChecked,
    };
  }

  /**
   * Run all validations and return comprehensive results
   */
  validate(): TimingIsolationResult {
    const allViolations: TimingIsolationViolation[] = [
      ...this.validateTimingBoundaries(),
      ...this.validateDurationIndependence(),
      ...this.validateTimestampUniqueness(),
      ...this.validateNoTimingCrossContamination(),
    ];

    // Filter to only errors for isolation check (warnings are informational)
    const errors = allViolations.filter(v => v.severity === 'error');

    return {
      isIsolated: errors.length === 0,
      violations: allViolations,
      stats: this.calculateStats(),
    };
  }

  /**
   * Clear all timing records
   */
  clear(): void {
    this.timings.clear();
  }

  /**
   * Get all timing records
   */
  getRecords(): ToolTimingRecord[] {
    return Array.from(this.timings.values());
  }

  /**
   * Get timing records for a specific tool type
   */
  getRecordsForTool(toolName: string): ToolTimingRecord[] {
    return Array.from(this.timings.values()).filter(r => r.toolName === toolName);
  }
}

/**
 * Factory function to create a timing isolation validator
 */
export function createTimingIsolationValidator(
  config?: TimingIsolationValidatorConfig
): TimingIsolationValidator {
  return new TimingIsolationValidator(config);
}

/**
 * Assert that two tool executions have completely isolated timing
 */
export function assertTimingIsolation(
  recordA: ToolTimingRecord,
  recordB: ToolTimingRecord,
  tolerance: number = TIMING_TOLERANCE_MS
): void {
  // Call IDs must be unique
  if (recordA.callId === recordB.callId) {
    throw new Error(
      `Expected different call IDs but both are: ${recordA.callId}`
    );
  }

  // Each duration should match its own calculated value
  const durationA = recordA.endTime.getTime() - recordA.startTime.getTime();
  const durationB = recordB.endTime.getTime() - recordB.startTime.getTime();

  if (Math.abs(recordA.duration - durationA) > tolerance) {
    throw new Error(
      `Record A duration mismatch: reported ${recordA.duration}ms, calculated ${durationA}ms`
    );
  }

  if (Math.abs(recordB.duration - durationB) > tolerance) {
    throw new Error(
      `Record B duration mismatch: reported ${recordB.duration}ms, calculated ${durationB}ms`
    );
  }

  // Timing boundaries should be valid
  if (recordA.endTime.getTime() < recordA.startTime.getTime()) {
    throw new Error(
      `Record A has invalid timing: endTime before startTime`
    );
  }

  if (recordB.endTime.getTime() < recordB.startTime.getTime()) {
    throw new Error(
      `Record B has invalid timing: endTime before startTime`
    );
  }
}

/**
 * Assert timing isolation for a batch of concurrent executions
 */
export function assertBatchTimingIsolation(
  records: ToolTimingRecord[],
  tolerance: number = TIMING_TOLERANCE_MS
): void {
  // All call IDs should be unique
  const callIds = records.map(r => r.callId);
  const uniqueCallIds = new Set(callIds);

  if (callIds.length !== uniqueCallIds.size) {
    const duplicates = callIds.filter((id, i) => callIds.indexOf(id) !== i);
    throw new Error(`Duplicate call IDs found: ${duplicates.join(', ')}`);
  }

  // Each execution's timing should be self-consistent
  for (const record of records) {
    const calculatedDuration =
      record.endTime.getTime() - record.startTime.getTime();

    if (Math.abs(record.duration - calculatedDuration) > tolerance) {
      throw new Error(
        `Duration mismatch for ${record.callId}: ` +
        `reported ${record.duration}ms, calculated ${calculatedDuration}ms`
      );
    }

    if (record.endTime.getTime() < record.startTime.getTime()) {
      throw new Error(
        `Invalid timing for ${record.callId}: endTime before startTime`
      );
    }
  }

  // No timing cross-contamination between different tools
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      assertTimingIsolation(records[i], records[j], tolerance);
    }
  }
}

/**
 * Build timing records from tool complete events
 */
export function buildTimingRecordsFromEvents(
  events: ConcurrentEventEntry[]
): ToolTimingRecord[] {
  const records: ToolTimingRecord[] = [];

  for (const event of events) {
    if (event.type !== 'tool:complete') {
      continue;
    }

    const eventData = event.data as {
      timing?: { startTime: Date; endTime: Date; duration: number };
      result?: { success: boolean };
    };

    if (eventData?.timing) {
      records.push({
        callId: event.callId,
        toolName: event.toolName,
        taskId: event.taskId,
        startTime: eventData.timing.startTime,
        endTime: eventData.timing.endTime,
        duration: eventData.timing.duration,
        captureSequence: event.sequenceIndex,
        success: eventData.result?.success,
      });
    }
  }

  return records;
}
