/**
 * Ordering Validator
 *
 * Provides validation rules and utilities for verifying correct
 * event ordering in concurrent tool execution scenarios.
 */

import type {
  ConcurrentEventEntry,
  OrderingViolation,
  ExecutionSummary,
} from './concurrent-event-collector';
import { TIMING_TOLERANCE_MS } from '../../event-data-integrity/shared/timing-consistency-utils';

/**
 * Individual ordering rule definition
 */
export interface OrderingRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule description */
  description: string;
  /** Validation function returning violations */
  validate: (
    events: ConcurrentEventEntry[],
    summaries: Map<string, ExecutionSummary>
  ) => OrderingViolation[];
}

/**
 * Configuration for ordering validation
 */
export interface OrderingValidatorConfig {
  /** Timing tolerance in milliseconds */
  timingTolerance?: number;
  /** Whether to allow missing complete events (for in-progress executions) */
  allowMissingComplete?: boolean;
  /** Whether to allow missing start events (for late-joining capture) */
  allowMissingStart?: boolean;
  /** Custom rules to add to validation */
  customRules?: OrderingRule[];
  /** Rules to skip by ID */
  skipRules?: string[];
}

/**
 * Standard ordering rules for concurrent tool executions
 */
export const STANDARD_ORDERING_RULES: OrderingRule[] = [
  {
    id: 'per-tool-sequence',
    description: 'Each tool execution must have events in order: start -> progress* -> complete',
    validate: (events, summaries) => {
      const violations: OrderingViolation[] = [];

      for (const [callId, summary] of summaries) {
        if (!summary.eventsInOrder) {
          const allEvents = [
            summary.startEvent,
            ...summary.progressEvents,
            summary.completeEvent,
          ].filter((e): e is ConcurrentEventEntry => e !== undefined);

          // Check specific ordering issues
          if (summary.startEvent && summary.completeEvent) {
            if (summary.startEvent.sequenceIndex > summary.completeEvent.sequenceIndex) {
              violations.push({
                type: 'out_of_order',
                callId,
                description: `Start event (seq: ${summary.startEvent.sequenceIndex}) captured after complete event (seq: ${summary.completeEvent.sequenceIndex})`,
                events: allEvents,
              });
            }
          }

          // Check progress events are between start and complete
          for (const progressEvent of summary.progressEvents) {
            if (summary.startEvent && progressEvent.sequenceIndex < summary.startEvent.sequenceIndex) {
              violations.push({
                type: 'out_of_order',
                callId,
                description: `Progress event (seq: ${progressEvent.sequenceIndex}) captured before start event (seq: ${summary.startEvent.sequenceIndex})`,
                events: [summary.startEvent, progressEvent],
              });
            }
            if (summary.completeEvent && progressEvent.sequenceIndex > summary.completeEvent.sequenceIndex) {
              violations.push({
                type: 'out_of_order',
                callId,
                description: `Progress event (seq: ${progressEvent.sequenceIndex}) captured after complete event (seq: ${summary.completeEvent.sequenceIndex})`,
                events: [progressEvent, summary.completeEvent],
              });
            }
          }
        }
      }

      return violations;
    },
  },

  {
    id: 'unique-start-events',
    description: 'Each call ID should have exactly one start event',
    validate: (events, summaries) => {
      const violations: OrderingViolation[] = [];
      const startCounts = new Map<string, ConcurrentEventEntry[]>();

      for (const event of events) {
        if (event.type === 'tool:start') {
          const existing = startCounts.get(event.callId) ?? [];
          existing.push(event);
          startCounts.set(event.callId, existing);
        }
      }

      for (const [callId, startEvents] of startCounts) {
        if (startEvents.length > 1) {
          violations.push({
            type: 'duplicate_start',
            callId,
            description: `Found ${startEvents.length} start events for call ID ${callId}`,
            events: startEvents,
          });
        }
      }

      return violations;
    },
  },

  {
    id: 'unique-complete-events',
    description: 'Each call ID should have exactly one complete event',
    validate: (events, summaries) => {
      const violations: OrderingViolation[] = [];
      const completeCounts = new Map<string, ConcurrentEventEntry[]>();

      for (const event of events) {
        if (event.type === 'tool:complete') {
          const existing = completeCounts.get(event.callId) ?? [];
          existing.push(event);
          completeCounts.set(event.callId, existing);
        }
      }

      for (const [callId, completeEvents] of completeCounts) {
        if (completeEvents.length > 1) {
          violations.push({
            type: 'duplicate_complete',
            callId,
            description: `Found ${completeEvents.length} complete events for call ID ${callId}`,
            events: completeEvents,
          });
        }
      }

      return violations;
    },
  },

  {
    id: 'timestamp-monotonicity',
    description: 'Within each execution, timestamps must be non-decreasing',
    validate: (events, summaries) => {
      const violations: OrderingViolation[] = [];

      for (const [callId, summary] of summaries) {
        const executionEvents = [
          summary.startEvent,
          ...summary.progressEvents.sort((a, b) => a.sequenceIndex - b.sequenceIndex),
          summary.completeEvent,
        ].filter((e): e is ConcurrentEventEntry => e !== undefined);

        for (let i = 1; i < executionEvents.length; i++) {
          const prev = executionEvents[i - 1];
          const curr = executionEvents[i];

          if (curr.timestamp.getTime() < prev.timestamp.getTime()) {
            violations.push({
              type: 'timing_inconsistency',
              callId,
              description: `Timestamp decreased from ${prev.timestamp.toISOString()} to ${curr.timestamp.toISOString()} within execution`,
              events: [prev, curr],
            });
          }
        }
      }

      return violations;
    },
  },

  {
    id: 'call-id-uniqueness',
    description: 'Each call ID should be associated with exactly one tool type',
    validate: (events, summaries) => {
      const violations: OrderingViolation[] = [];
      const callIdTools = new Map<string, Set<string>>();

      for (const event of events) {
        const tools = callIdTools.get(event.callId) ?? new Set();
        tools.add(event.toolName);
        callIdTools.set(event.callId, tools);
      }

      for (const [callId, tools] of callIdTools) {
        if (tools.size > 1) {
          violations.push({
            type: 'out_of_order',
            callId,
            description: `Call ID ${callId} used for multiple tools: ${Array.from(tools).join(', ')}`,
            events: events.filter(e => e.callId === callId),
          });
        }
      }

      return violations;
    },
  },

  {
    id: 'task-id-consistency',
    description: 'All events for a call ID should have the same task ID',
    validate: (events, summaries) => {
      const violations: OrderingViolation[] = [];
      const callIdTasks = new Map<string, Set<string>>();

      for (const event of events) {
        const tasks = callIdTasks.get(event.callId) ?? new Set();
        tasks.add(event.taskId);
        callIdTasks.set(event.callId, tasks);
      }

      for (const [callId, tasks] of callIdTasks) {
        if (tasks.size > 1) {
          violations.push({
            type: 'out_of_order',
            callId,
            description: `Call ID ${callId} has inconsistent task IDs: ${Array.from(tasks).join(', ')}`,
            events: events.filter(e => e.callId === callId),
          });
        }
      }

      return violations;
    },
  },
];

/**
 * Ordering Validator class for running validation rules
 */
export class OrderingValidator {
  private config: Required<OrderingValidatorConfig>;
  private rules: OrderingRule[];

  constructor(config: OrderingValidatorConfig = {}) {
    this.config = {
      timingTolerance: config.timingTolerance ?? TIMING_TOLERANCE_MS,
      allowMissingComplete: config.allowMissingComplete ?? false,
      allowMissingStart: config.allowMissingStart ?? false,
      customRules: config.customRules ?? [],
      skipRules: config.skipRules ?? [],
    };

    // Build rule set
    this.rules = [
      ...STANDARD_ORDERING_RULES.filter(
        rule => !this.config.skipRules.includes(rule.id)
      ),
      ...this.config.customRules,
    ];

    // Add conditional rules based on config
    if (!this.config.allowMissingComplete) {
      this.rules.push({
        id: 'complete-required',
        description: 'Every execution with a start event must have a complete event',
        validate: (events, summaries) => {
          const violations: OrderingViolation[] = [];

          for (const [callId, summary] of summaries) {
            if (summary.startEvent && !summary.completeEvent) {
              violations.push({
                type: 'missing_complete',
                callId,
                description: `Execution ${callId} has start event but no complete event`,
                events: [summary.startEvent, ...summary.progressEvents],
              });
            }
          }

          return violations;
        },
      });
    }

    if (!this.config.allowMissingStart) {
      this.rules.push({
        id: 'start-required',
        description: 'Every execution with a complete event must have a start event',
        validate: (events, summaries) => {
          const violations: OrderingViolation[] = [];

          for (const [callId, summary] of summaries) {
            if (!summary.startEvent && (summary.completeEvent || summary.progressEvents.length > 0)) {
              violations.push({
                type: 'missing_start',
                callId,
                description: `Execution ${callId} has events but no start event`,
                events: [
                  ...summary.progressEvents,
                  summary.completeEvent,
                ].filter((e): e is ConcurrentEventEntry => e !== undefined),
              });
            }
          }

          return violations;
        },
      });
    }
  }

  /**
   * Run all validation rules
   */
  validate(
    events: ConcurrentEventEntry[],
    summaries: Map<string, ExecutionSummary>
  ): OrderingViolation[] {
    const allViolations: OrderingViolation[] = [];

    for (const rule of this.rules) {
      const violations = rule.validate(events, summaries);
      allViolations.push(...violations);
    }

    return allViolations;
  }

  /**
   * Get list of active rule IDs
   */
  getActiveRules(): string[] {
    return this.rules.map(r => r.id);
  }

  /**
   * Check if a specific rule is active
   */
  hasRule(ruleId: string): boolean {
    return this.rules.some(r => r.id === ruleId);
  }
}

/**
 * Assertion helpers for ordering validation in tests
 */
export const orderingAssert = {
  /**
   * Assert that events are in correct per-tool sequence
   */
  perToolSequence(
    events: ConcurrentEventEntry[],
    callId: string
  ): void {
    const toolEvents = events
      .filter(e => e.callId === callId)
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex);

    const startIndex = toolEvents.findIndex(e => e.type === 'tool:start');
    const completeIndex = toolEvents.findIndex(e => e.type === 'tool:complete');

    if (startIndex >= 0 && completeIndex >= 0) {
      if (startIndex > completeIndex) {
        throw new Error(
          `Start event (index ${startIndex}) should come before complete event (index ${completeIndex}) for ${callId}`
        );
      }
    }

    // Check progress events
    for (let i = 0; i < toolEvents.length; i++) {
      const event = toolEvents[i];
      if (event.type === 'tool:progress') {
        if (startIndex >= 0 && i < startIndex) {
          throw new Error(
            `Progress event (index ${i}) should come after start event (index ${startIndex}) for ${callId}`
          );
        }
        if (completeIndex >= 0 && i > completeIndex) {
          throw new Error(
            `Progress event (index ${i}) should come before complete event (index ${completeIndex}) for ${callId}`
          );
        }
      }
    }
  },

  /**
   * Assert that all call IDs are unique across concurrent executions
   */
  uniqueCallIds(events: ConcurrentEventEntry[]): void {
    const startEvents = events.filter(e => e.type === 'tool:start');
    const callIds = startEvents.map(e => e.callId);
    const uniqueCallIds = new Set(callIds);

    if (callIds.length !== uniqueCallIds.size) {
      const duplicates = callIds.filter(
        (id, index) => callIds.indexOf(id) !== index
      );
      throw new Error(`Duplicate call IDs found: ${duplicates.join(', ')}`);
    }
  },

  /**
   * Assert that timestamps are monotonically non-decreasing for a call ID
   */
  timestampMonotonicity(
    events: ConcurrentEventEntry[],
    callId: string
  ): void {
    const toolEvents = events
      .filter(e => e.callId === callId)
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex);

    for (let i = 1; i < toolEvents.length; i++) {
      const prev = toolEvents[i - 1];
      const curr = toolEvents[i];

      if (curr.timestamp.getTime() < prev.timestamp.getTime()) {
        throw new Error(
          `Timestamp decreased from ${prev.timestamp.toISOString()} to ${curr.timestamp.toISOString()} for ${callId}`
        );
      }
    }
  },

  /**
   * Assert expected number of concurrent executions
   */
  concurrencyLevel(
    events: ConcurrentEventEntry[],
    expectedLevel: number,
    tolerance = 0
  ): void {
    const sortedEvents = [...events].sort(
      (a, b) => a.sequenceIndex - b.sequenceIndex
    );

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

    const diff = Math.abs(maxConcurrent - expectedLevel);
    if (diff > tolerance) {
      throw new Error(
        `Expected ${expectedLevel} concurrent executions (tolerance: ${tolerance}), but found ${maxConcurrent}`
      );
    }
  },
};

/**
 * Create a configured ordering validator
 */
export function createOrderingValidator(
  config?: OrderingValidatorConfig
): OrderingValidator {
  return new OrderingValidator(config);
}
