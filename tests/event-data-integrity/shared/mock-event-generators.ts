/**
 * Mock Event Generators
 *
 * Provides factory functions for creating mock event data for testing.
 * All generated events have realistic structure and timing data.
 */

import { generateTestId, createTestTimestamp } from './event-test-utils';
import { SUPPORTED_TOOLS, SupportedTool, TOOL_CONFIGS } from '../../tool-complete-events/shared/tool-test-fixtures';

/**
 * Tool Start Event Data structure
 */
export interface ToolStartEventData {
  taskId: string;
  toolName: string;
  callId: string;
  input: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Tool Complete Event Data structure
 */
export interface ToolCompleteEventData {
  taskId: string;
  toolName: string;
  callId: string;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  timestamp: Date;
}

/**
 * Options for customizing mock event generation
 */
export interface MockEventOptions {
  taskId?: string;
  callId?: string;
  timestamp?: Date;
  input?: Record<string, unknown>;
  customData?: Record<string, unknown>;
}

/**
 * Options for customizing mock tool complete events
 */
export interface MockToolCompleteOptions extends MockEventOptions {
  result?: {
    success?: boolean;
    output?: unknown;
    error?: string;
  };
  timing?: {
    startTime?: Date;
    endTime?: Date;
    duration?: number;
  };
}

/**
 * Create a mock tool start event
 */
export function createToolStartEvent(
  taskId?: string,
  toolName: SupportedTool = 'Read',
  options: MockEventOptions = {}
): ToolStartEventData {
  // Use provided taskId (including empty string) or fallback to options.taskId or generate one
  const finalTaskId = taskId !== undefined ? taskId : (options.taskId || generateTestId('task'));
  const callId = options.callId || generateTestId('call');
  const timestamp = options.timestamp || createTestTimestamp();

  // Get tool-specific input if not provided
  let input = options.input;
  if (!input) {
    const config = TOOL_CONFIGS[toolName];
    input = config ? { ...config.sampleInput } : {};
  }

  return {
    taskId: finalTaskId,
    toolName,
    callId,
    input,
    timestamp,
    ...options.customData
  };
}

/**
 * Create a mock tool complete event
 */
export function createToolCompleteEvent(
  taskId: string,
  toolName: SupportedTool,
  callId: string,
  options: MockToolCompleteOptions = {}
): ToolCompleteEventData {
  const config = TOOL_CONFIGS[toolName];

  // Generate realistic timing
  let timing = options.timing;
  if (!timing) {
    const duration = config
      ? Math.floor(Math.random() * (config.typicalDurationMs.max - config.typicalDurationMs.min)) + config.typicalDurationMs.min
      : 100;

    const startTime = createTestTimestamp(-duration - 50);
    const endTime = new Date(startTime.getTime() + duration);

    timing = { startTime, endTime, duration };
  }

  // Default result based on success flag
  let result = options.result;
  if (!result) {
    const success = true; // Default to success
    result = {
      success,
      output: success ? (config?.sampleSuccessOutput || 'mock output') : undefined,
      error: success ? undefined : (config?.sampleErrorOutput || 'mock error')
    };
  }

  const timestamp = options.timestamp || timing.endTime;

  return {
    taskId,
    toolName,
    callId,
    result: {
      success: true,
      ...result
    },
    timing,
    timestamp,
    ...options.customData
  };
}

/**
 * Create a pair of matching start and complete events
 */
export function createToolEventPair(
  toolName: SupportedTool,
  options: {
    taskId?: string;
    callId?: string;
    success?: boolean;
    duration?: number;
    startOptions?: MockEventOptions;
    completeOptions?: MockToolCompleteOptions;
  } = {}
): {
  startEvent: ToolStartEventData;
  completeEvent: ToolCompleteEventData;
} {
  const taskId = options.taskId || generateTestId('task');
  const callId = options.callId || generateTestId('call');
  const success = options.success ?? true;
  const config = TOOL_CONFIGS[toolName];

  // Calculate timing
  const duration = options.duration || (config
    ? Math.floor(Math.random() * (config.typicalDurationMs.max - config.typicalDurationMs.min)) + config.typicalDurationMs.min
    : 100);

  const startTime = createTestTimestamp();
  const endTime = new Date(startTime.getTime() + duration);

  // Create start event
  const startEvent = createToolStartEvent(taskId, toolName, {
    callId,
    timestamp: startTime,
    ...options.startOptions
  });

  // Create complete event
  const completeEvent = createToolCompleteEvent(taskId, toolName, callId, {
    result: {
      success,
      output: success ? (config?.sampleSuccessOutput || 'mock output') : undefined,
      error: success ? undefined : (config?.sampleErrorOutput || 'mock error')
    },
    timing: {
      startTime,
      endTime,
      duration
    },
    timestamp: endTime,
    ...options.completeOptions
  });

  return { startEvent, completeEvent };
}

/**
 * Create multiple tool events for testing sequences
 */
export function createToolEventSequence(
  tools: SupportedTool[],
  options: {
    taskId?: string;
    baseTime?: Date;
    successRates?: number; // 0-1, probability of success
    overlapEvents?: boolean; // Allow overlapping tool executions
  } = {}
): Array<{ startEvent: ToolStartEventData; completeEvent: ToolCompleteEventData }> {
  const taskId = options.taskId || generateTestId('task');
  const baseTime = options.baseTime || new Date();
  const successRate = options.successRates ?? 0.9;
  const allowOverlap = options.overlapEvents ?? false;

  const events: Array<{ startEvent: ToolStartEventData; completeEvent: ToolCompleteEventData }> = [];
  let currentTime = baseTime.getTime();

  for (let i = 0; i < tools.length; i++) {
    const toolName = tools[i];
    const config = TOOL_CONFIGS[toolName];
    const success = Math.random() < successRate;

    // Calculate timing
    const duration = config
      ? Math.floor(Math.random() * (config.typicalDurationMs.max - config.typicalDurationMs.min)) + config.typicalDurationMs.min
      : 100 + Math.random() * 400;

    const startTime = new Date(currentTime);
    const endTime = new Date(currentTime + duration);

    const eventPair = createToolEventPair(toolName, {
      taskId,
      success,
      duration,
      startOptions: { timestamp: startTime },
      completeOptions: {
        timing: { startTime, endTime, duration },
        timestamp: endTime
      }
    });

    events.push(eventPair);

    // Advance time for next event
    if (allowOverlap) {
      // Random overlap - next event can start before previous ends
      currentTime += Math.random() * duration;
    } else {
      // Sequential - next event starts after previous ends
      currentTime = endTime.getTime() + Math.random() * 100; // Small gap
    }
  }

  return events;
}

/**
 * Create an event with data integrity issues for testing validation
 */
export function createCorruptedEvent(
  corruptionType: 'missing-field' | 'wrong-type' | 'timing-mismatch' | 'invalid-date' | 'negative-duration',
  baseToolName: SupportedTool = 'Read'
): ToolCompleteEventData {
  // Start with a valid event
  const taskId = generateTestId('task');
  const callId = generateTestId('call');
  const event = createToolCompleteEvent(taskId, baseToolName, callId);

  // Apply corruption based on type
  switch (corruptionType) {
    case 'missing-field':
      // @ts-expect-error - Intentionally removing required field
      delete event.taskId;
      break;

    case 'wrong-type':
      // @ts-expect-error - Intentionally setting wrong type
      event.timing.duration = 'not-a-number';
      break;

    case 'timing-mismatch':
      // Set duration that doesn't match start/end times
      event.timing.duration = 999999;
      break;

    case 'invalid-date':
      // @ts-expect-error - Invalid date
      event.timing.startTime = new Date('invalid');
      break;

    case 'negative-duration':
      event.timing.duration = -100;
      break;
  }

  return event;
}

/**
 * Generate realistic error scenarios for all tools
 */
export function generateToolErrorScenarios(): Record<SupportedTool, ToolCompleteEventData[]> {
  const scenarios: Record<SupportedTool, ToolCompleteEventData[]> = {} as any;

  for (const toolName of SUPPORTED_TOOLS) {
    const config = TOOL_CONFIGS[toolName];
    scenarios[toolName] = [];

    // Create a few different error scenarios for each tool
    const errorTypes = [
      'Permission denied',
      'File not found',
      'Network timeout',
      'Invalid input',
      'System error'
    ];

    for (const errorType of errorTypes) {
      const taskId = generateTestId('task');
      const callId = generateTestId('call');

      const errorEvent = createToolCompleteEvent(taskId, toolName, callId, {
        result: {
          success: false,
          error: `${errorType}: ${config?.sampleErrorOutput || 'Mock error'}`
        }
      });

      scenarios[toolName].push(errorEvent);
    }
  }

  return scenarios;
}

/**
 * Generate events with edge case timings
 */
export function generateTimingEdgeCases(): {
  name: string;
  event: ToolCompleteEventData;
}[] {
  return [
    {
      name: 'Zero duration (instant completion)',
      event: createToolCompleteEvent(generateTestId(), 'Read', generateTestId(), {
        timing: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 0
        }
      })
    },
    {
      name: 'Very long duration',
      event: createToolCompleteEvent(generateTestId(), 'Bash', generateTestId(), {
        timing: {
          startTime: new Date(Date.now() - 300000),
          endTime: new Date(),
          duration: 300000 // 5 minutes
        }
      })
    },
    {
      name: 'Sub-millisecond precision',
      event: (() => {
        const start = new Date();
        const end = new Date(start.getTime() + 0.5); // Should round to same time
        return createToolCompleteEvent(generateTestId(), 'Grep', generateTestId(), {
          timing: {
            startTime: start,
            endTime: end,
            duration: 1
          }
        });
      })()
    },
    {
      name: 'Cross-day execution',
      event: (() => {
        const start = new Date('2026-03-14T23:59:30.000Z');
        const end = new Date('2026-03-15T00:00:30.000Z');
        return createToolCompleteEvent(generateTestId(), 'WebFetch', generateTestId(), {
          timing: {
            startTime: start,
            endTime: end,
            duration: 60000 // 1 minute
          }
        });
      })()
    }
  ];
}