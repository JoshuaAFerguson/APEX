/**
 * Concurrent Event Collector
 *
 * Specialized event collection utility for capturing and analyzing events
 * from concurrent tool executions. Provides timeline construction,
 * sequencing analysis, and ordering validation.
 */

import { EventEmitter } from 'events';
import type { ToolCompleteEvent } from '../../tool-complete-events/shared/tool-event-validators';
import type { SupportedTool } from '../../tool-complete-events/shared/tool-test-fixtures';

/**
 * Represents a captured event in a concurrent execution scenario
 */
export interface ConcurrentEventEntry {
  /** Event type identifier */
  type: 'tool:start' | 'tool:progress' | 'tool:complete';
  /** Name of the tool that emitted this event */
  toolName: string;
  /** Unique call identifier for this tool execution */
  callId: string;
  /** Task ID this execution belongs to */
  taskId: string;
  /** When the event was emitted */
  timestamp: Date;
  /** Capture sequence number (monotonically increasing) */
  sequenceIndex: number;
  /** Original event data payload */
  data: unknown;
  /** High-resolution capture time (for sub-ms ordering) */
  captureTime: number;
}

/**
 * Statistics about concurrent event collection
 */
export interface ConcurrentEventStats {
  /** Total number of events captured */
  totalEvents: number;
  /** Number of unique call IDs (tool executions) */
  uniqueCallIds: number;
  /** Number of unique tool types used */
  uniqueToolTypes: number;
  /** Maximum number of tools executing simultaneously */
  maxConcurrentExecutions: number;
  /** Average time between consecutive events (ms) */
  averageInterEventDelay: number;
  /** Minimum time between consecutive events (ms) */
  minInterEventDelay: number;
  /** Maximum time between consecutive events (ms) */
  maxInterEventDelay: number;
  /** Time span from first to last event (ms) */
  totalDuration: number;
}

/**
 * Describes an ordering violation detected during validation
 */
export interface OrderingViolation {
  /** Type of violation */
  type:
    | 'out_of_order'
    | 'missing_start'
    | 'missing_complete'
    | 'duplicate_start'
    | 'duplicate_complete'
    | 'timing_inconsistency'
    | 'sequence_gap';
  /** Affected call ID */
  callId: string;
  /** Human-readable description */
  description: string;
  /** Events involved in the violation */
  events: ConcurrentEventEntry[];
}

/**
 * Result of ordering validation
 */
export interface OrderingValidationResult {
  /** Whether all ordering rules passed */
  isValid: boolean;
  /** List of detected violations */
  violations: OrderingViolation[];
  /** Full timeline of captured events */
  timeline: ConcurrentEventEntry[];
  /** Statistical summary */
  stats: ConcurrentEventStats;
  /** Per-tool execution summaries */
  executionSummaries: Map<string, ExecutionSummary>;
}

/**
 * Summary of a single tool execution
 */
export interface ExecutionSummary {
  callId: string;
  toolName: string;
  taskId: string;
  startEvent?: ConcurrentEventEntry;
  progressEvents: ConcurrentEventEntry[];
  completeEvent?: ConcurrentEventEntry;
  duration?: number;
  success?: boolean;
  eventsInOrder: boolean;
}

/**
 * Options for the concurrent event collector
 */
export interface ConcurrentEventCollectorOptions {
  /** Maximum events to collect before auto-stopping */
  maxEvents?: number;
  /** Event types to capture */
  eventTypes?: Array<'tool:start' | 'tool:progress' | 'tool:complete'>;
  /** Whether to include high-resolution timestamps */
  highResolutionTiming?: boolean;
}

/**
 * Concurrent Event Collector
 *
 * Captures events from concurrent tool executions and provides
 * analysis utilities for validating event ordering.
 */
export class ConcurrentEventCollector {
  private emitter: EventEmitter;
  private events: ConcurrentEventEntry[] = [];
  private sequenceCounter = 0;
  private isCapturing = false;
  private options: Required<ConcurrentEventCollectorOptions>;
  private listeners: Map<string, (...args: unknown[]) => void> = new Map();

  constructor(
    emitter: EventEmitter,
    options: ConcurrentEventCollectorOptions = {}
  ) {
    this.emitter = emitter;
    this.options = {
      maxEvents: options.maxEvents ?? 10000,
      eventTypes: options.eventTypes ?? ['tool:start', 'tool:progress', 'tool:complete'],
      highResolutionTiming: options.highResolutionTiming ?? true,
    };
  }

  /**
   * Start capturing events from the emitter
   */
  startCapturing(): void {
    if (this.isCapturing) {
      return;
    }

    this.isCapturing = true;
    this.events = [];
    this.sequenceCounter = 0;

    for (const eventType of this.options.eventTypes) {
      const listener = (data: unknown) => {
        if (this.events.length >= this.options.maxEvents) {
          return;
        }

        const eventData = data as Record<string, unknown>;

        const entry: ConcurrentEventEntry = {
          type: eventType,
          toolName: String(eventData.toolName ?? ''),
          callId: String(eventData.callId ?? ''),
          taskId: String(eventData.taskId ?? ''),
          timestamp: eventData.timestamp instanceof Date
            ? eventData.timestamp
            : new Date(),
          sequenceIndex: this.sequenceCounter++,
          data,
          captureTime: this.options.highResolutionTiming
            ? performance.now()
            : Date.now(),
        };

        this.events.push(entry);
      };

      this.listeners.set(eventType, listener);
      this.emitter.on(eventType, listener);
    }
  }

  /**
   * Stop capturing events
   */
  stopCapturing(): void {
    if (!this.isCapturing) {
      return;
    }

    this.isCapturing = false;

    for (const [eventType, listener] of this.listeners) {
      this.emitter.off(eventType, listener);
    }
    this.listeners.clear();
  }

  /**
   * Get all captured events
   */
  getEvents(): ConcurrentEventEntry[] {
    return [...this.events];
  }

  /**
   * Get events sorted by capture sequence
   */
  getEventsBySequence(): ConcurrentEventEntry[] {
    return [...this.events].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  }

  /**
   * Get events sorted by timestamp
   */
  getEventsByTimestamp(): ConcurrentEventEntry[] {
    return [...this.events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  /**
   * Get events for a specific call ID
   */
  getEventsForCallId(callId: string): ConcurrentEventEntry[] {
    return this.events
      .filter(e => e.callId === callId)
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  }

  /**
   * Get events for a specific tool type
   */
  getEventsForTool(toolName: SupportedTool): ConcurrentEventEntry[] {
    return this.events
      .filter(e => e.toolName === toolName)
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  }

  /**
   * Build execution summaries for all captured tool executions
   */
  buildExecutionSummaries(): Map<string, ExecutionSummary> {
    const summaries = new Map<string, ExecutionSummary>();

    for (const event of this.events) {
      let summary = summaries.get(event.callId);

      if (!summary) {
        summary = {
          callId: event.callId,
          toolName: event.toolName,
          taskId: event.taskId,
          progressEvents: [],
          eventsInOrder: true,
        };
        summaries.set(event.callId, summary);
      }

      switch (event.type) {
        case 'tool:start':
          if (summary.startEvent) {
            summary.eventsInOrder = false; // Duplicate start
          }
          summary.startEvent = event;
          break;

        case 'tool:progress':
          summary.progressEvents.push(event);
          break;

        case 'tool:complete':
          if (summary.completeEvent) {
            summary.eventsInOrder = false; // Duplicate complete
          }
          summary.completeEvent = event;
          if (summary.startEvent) {
            summary.duration =
              event.timestamp.getTime() - summary.startEvent.timestamp.getTime();
          }
          const completeData = event.data as ToolCompleteEvent;
          summary.success = completeData?.result?.success;
          break;
      }
    }

    // Validate event ordering within each execution
    for (const summary of summaries.values()) {
      if (summary.startEvent && summary.completeEvent) {
        // Start should come before complete
        if (summary.startEvent.sequenceIndex > summary.completeEvent.sequenceIndex) {
          summary.eventsInOrder = false;
        }

        // Progress events should be between start and complete
        for (const progressEvent of summary.progressEvents) {
          if (
            progressEvent.sequenceIndex < summary.startEvent.sequenceIndex ||
            progressEvent.sequenceIndex > summary.completeEvent.sequenceIndex
          ) {
            summary.eventsInOrder = false;
          }
        }
      }
    }

    return summaries;
  }

  /**
   * Calculate concurrent execution statistics
   */
  calculateStats(): ConcurrentEventStats {
    if (this.events.length === 0) {
      return {
        totalEvents: 0,
        uniqueCallIds: 0,
        uniqueToolTypes: 0,
        maxConcurrentExecutions: 0,
        averageInterEventDelay: 0,
        minInterEventDelay: 0,
        maxInterEventDelay: 0,
        totalDuration: 0,
      };
    }

    const sortedEvents = this.getEventsBySequence();
    const callIds = new Set(sortedEvents.map(e => e.callId));
    const toolTypes = new Set(sortedEvents.map(e => e.toolName));

    // Calculate inter-event delays
    const delays: number[] = [];
    for (let i = 1; i < sortedEvents.length; i++) {
      const delay = sortedEvents[i].captureTime - sortedEvents[i - 1].captureTime;
      delays.push(delay);
    }

    // Calculate max concurrent executions
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const activeExecutions = new Set<string>();

    for (const event of sortedEvents) {
      if (event.type === 'tool:start') {
        activeExecutions.add(event.callId);
        currentConcurrent = activeExecutions.size;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      } else if (event.type === 'tool:complete') {
        activeExecutions.delete(event.callId);
      }
    }

    const totalDuration =
      sortedEvents[sortedEvents.length - 1].timestamp.getTime() -
      sortedEvents[0].timestamp.getTime();

    return {
      totalEvents: sortedEvents.length,
      uniqueCallIds: callIds.size,
      uniqueToolTypes: toolTypes.size,
      maxConcurrentExecutions: maxConcurrent,
      averageInterEventDelay:
        delays.length > 0
          ? delays.reduce((a, b) => a + b, 0) / delays.length
          : 0,
      minInterEventDelay: delays.length > 0 ? Math.min(...delays) : 0,
      maxInterEventDelay: delays.length > 0 ? Math.max(...delays) : 0,
      totalDuration,
    };
  }

  /**
   * Validate event ordering and return detailed results
   */
  validateOrdering(): OrderingValidationResult {
    const violations: OrderingViolation[] = [];
    const summaries = this.buildExecutionSummaries();
    const stats = this.calculateStats();

    // Check each execution for violations
    for (const [callId, summary] of summaries) {
      // Check for missing start event
      if (!summary.startEvent && (summary.completeEvent || summary.progressEvents.length > 0)) {
        violations.push({
          type: 'missing_start',
          callId,
          description: `No start event found for execution ${callId}`,
          events: [summary.completeEvent, ...summary.progressEvents].filter(
            (e): e is ConcurrentEventEntry => e !== undefined
          ),
        });
      }

      // Check for missing complete event
      if (summary.startEvent && !summary.completeEvent) {
        violations.push({
          type: 'missing_complete',
          callId,
          description: `No complete event found for execution ${callId}`,
          events: [summary.startEvent, ...summary.progressEvents],
        });
      }

      // Check for out-of-order events
      if (!summary.eventsInOrder) {
        const allEvents = [
          summary.startEvent,
          ...summary.progressEvents,
          summary.completeEvent,
        ].filter((e): e is ConcurrentEventEntry => e !== undefined);

        violations.push({
          type: 'out_of_order',
          callId,
          description: `Events for execution ${callId} are not in correct order`,
          events: allEvents,
        });
      }

      // Check timing consistency
      if (summary.startEvent && summary.completeEvent) {
        const startTime = summary.startEvent.timestamp.getTime();
        const completeTime = summary.completeEvent.timestamp.getTime();

        if (completeTime < startTime) {
          violations.push({
            type: 'timing_inconsistency',
            callId,
            description: `Complete event timestamp (${completeTime}) is before start event timestamp (${startTime})`,
            events: [summary.startEvent, summary.completeEvent],
          });
        }

        // Check progress events timing
        for (const progressEvent of summary.progressEvents) {
          const progressTime = progressEvent.timestamp.getTime();
          if (progressTime < startTime || progressTime > completeTime) {
            violations.push({
              type: 'timing_inconsistency',
              callId,
              description: `Progress event timestamp (${progressTime}) is outside execution window [${startTime}, ${completeTime}]`,
              events: [summary.startEvent, progressEvent, summary.completeEvent],
            });
          }
        }
      }
    }

    // Check for duplicate call IDs with different tools (should never happen)
    const callIdToTool = new Map<string, string>();
    for (const event of this.events) {
      const existingTool = callIdToTool.get(event.callId);
      if (existingTool && existingTool !== event.toolName) {
        violations.push({
          type: 'out_of_order',
          callId: event.callId,
          description: `Call ID ${event.callId} used for multiple tools: ${existingTool} and ${event.toolName}`,
          events: this.getEventsForCallId(event.callId),
        });
      }
      callIdToTool.set(event.callId, event.toolName);
    }

    return {
      isValid: violations.length === 0,
      violations,
      timeline: this.getEventsBySequence(),
      stats,
      executionSummaries: summaries,
    };
  }

  /**
   * Get a human-readable timeline representation
   */
  formatTimeline(): string {
    const lines: string[] = ['Concurrent Event Timeline:', ''];

    const sortedEvents = this.getEventsBySequence();
    const firstTime = sortedEvents[0]?.timestamp.getTime() ?? 0;

    for (const event of sortedEvents) {
      const relativeTime = event.timestamp.getTime() - firstTime;
      const eventType = event.type.replace('tool:', '').toUpperCase().padEnd(8);
      const toolName = event.toolName.padEnd(12);
      const callIdShort = event.callId.slice(-8);

      lines.push(
        `[${relativeTime.toString().padStart(6)}ms] ${eventType} | ${toolName} | ${callIdShort}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Clear all captured events
   */
  clear(): void {
    this.events = [];
    this.sequenceCounter = 0;
  }

  /**
   * Dispose of the collector and remove all listeners
   */
  dispose(): void {
    this.stopCapturing();
    this.clear();
  }
}

/**
 * Factory function to create a concurrent event collector
 */
export function createConcurrentEventCollector(
  emitter: EventEmitter,
  options?: ConcurrentEventCollectorOptions
): ConcurrentEventCollector {
  return new ConcurrentEventCollector(emitter, options);
}
