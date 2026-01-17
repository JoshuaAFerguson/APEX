/**
 * Test utility for capturing and asserting on orchestrator events
 * Supports all confirmation-related events and provides comprehensive testing capabilities
 */

import { EventEmitter } from 'eventemitter3';
import type { ApexEventType, ApprovalRequiredEventData, ApprovalResponseEventData, ApprovalGrantedEventData, ApprovalDeniedEventData, ApprovalResolvedEventData } from '@apexcli/core';

/**
 * Represents a captured event with timestamp and data
 */
export interface CapturedEvent<T = any> {
  /** The event type that was emitted */
  type: string;
  /** The event data/payload */
  data: T;
  /** When the event was captured */
  timestamp: Date;
  /** Index in the sequence of captured events */
  index: number;
}

/**
 * Configuration options for EventCapture
 */
export interface EventCaptureOptions {
  /** Whether to automatically start capturing events on creation */
  autoStart?: boolean;
  /** Maximum number of events to capture before discarding old ones */
  maxEvents?: number;
  /** Event types to capture (if empty, captures all) */
  filterTypes?: string[];
}

/**
 * EventCapture class for testing orchestrator events
 *
 * Provides comprehensive event capture and assertion capabilities specifically
 * designed for testing confirmation-related events in the APEX orchestrator.
 *
 * @example
 * ```typescript
 * const eventCapture = new EventCapture(orchestrator);
 * eventCapture.start();
 *
 * // Perform some action that triggers events
 * await orchestrator.executeTask(task);
 *
 * // Assert on the events
 * eventCapture.expectEventEmitted('approval:required');
 * eventCapture.expectEventSequence(['task:started', 'approval:required', 'task:paused']);
 *
 * const approvalEvent = eventCapture.getEventsByType('approval:required')[0];
 * eventCapture.expectEventData(approvalEvent, { taskId: 'test-task' });
 * ```
 */
export class EventCapture {
  private emitter: EventEmitter;
  private capturedEvents: CapturedEvent[] = [];
  private isCapturing = false;
  private eventIndex = 0;
  private options: Required<EventCaptureOptions>;
  private eventListeners: Map<string, (...args: any[]) => void> = new Map();

  /**
   * Creates a new EventCapture instance
   * @param emitter The EventEmitter to capture events from (typically ApexOrchestrator)
   * @param options Configuration options
   */
  constructor(emitter: EventEmitter, options: EventCaptureOptions = {}) {
    this.emitter = emitter;
    this.options = {
      autoStart: options.autoStart ?? false,
      maxEvents: options.maxEvents ?? 1000,
      filterTypes: options.filterTypes ?? [],
    };

    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Start capturing events
   */
  start(): void {
    if (this.isCapturing) {
      return;
    }

    this.isCapturing = true;
    this.setupEventListeners();
  }

  /**
   * Stop capturing events and clean up listeners
   */
  stop(): void {
    if (!this.isCapturing) {
      return;
    }

    this.isCapturing = false;
    this.cleanupEventListeners();
  }

  /**
   * Clear all captured events
   */
  clear(): void {
    this.capturedEvents = [];
    this.eventIndex = 0;
  }

  /**
   * Reset the event capture (clear events and restart if was running)
   */
  reset(): void {
    const wasCapturing = this.isCapturing;
    this.stop();
    this.clear();
    if (wasCapturing) {
      this.start();
    }
  }

  /**
   * Get all captured events
   */
  getAllEvents(): CapturedEvent[] {
    return [...this.capturedEvents];
  }

  /**
   * Get events filtered by type
   * @param eventType The event type to filter by
   */
  getEventsByType<T = any>(eventType: string): CapturedEvent<T>[] {
    return this.capturedEvents.filter(event => event.type === eventType);
  }

  /**
   * Get events filtered by multiple types
   * @param eventTypes Array of event types to filter by
   */
  getEventsByTypes<T = any>(eventTypes: string[]): CapturedEvent<T>[] {
    const typeSet = new Set(eventTypes);
    return this.capturedEvents.filter(event => typeSet.has(event.type));
  }

  /**
   * Get the most recent event
   */
  getLastEvent(): CapturedEvent | undefined {
    return this.capturedEvents[this.capturedEvents.length - 1];
  }

  /**
   * Get the most recent event of a specific type
   * @param eventType The event type to find
   */
  getLastEventOfType<T = any>(eventType: string): CapturedEvent<T> | undefined {
    for (let i = this.capturedEvents.length - 1; i >= 0; i--) {
      const event = this.capturedEvents[i];
      if (event.type === eventType) {
        return event as CapturedEvent<T>;
      }
    }
    return undefined;
  }

  /**
   * Get events within a specific time range
   * @param startTime Start of the time range
   * @param endTime End of the time range
   */
  getEventsInTimeRange(startTime: Date, endTime: Date): CapturedEvent[] {
    return this.capturedEvents.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Get events matching a predicate function
   * @param predicate Function to test each event
   */
  getEventsWhere<T = any>(predicate: (event: CapturedEvent<T>) => boolean): CapturedEvent<T>[] {
    return this.capturedEvents.filter(predicate) as CapturedEvent<T>[];
  }

  /**
   * Assert that a specific event was emitted
   * @param eventType The expected event type
   * @param message Optional custom error message
   */
  expectEventEmitted(eventType: string, message?: string): void {
    const events = this.getEventsByType(eventType);
    if (events.length === 0) {
      const actualTypes = this.capturedEvents.map(e => e.type);
      throw new Error(
        message || `Expected event '${eventType}' to be emitted, but it was not. Captured events: [${actualTypes.join(', ')}]`
      );
    }
  }

  /**
   * Assert that a specific event was NOT emitted
   * @param eventType The event type that should not be present
   * @param message Optional custom error message
   */
  expectEventNotEmitted(eventType: string, message?: string): void {
    const events = this.getEventsByType(eventType);
    if (events.length > 0) {
      throw new Error(
        message || `Expected event '${eventType}' to NOT be emitted, but it was emitted ${events.length} time(s)`
      );
    }
  }

  /**
   * Assert that events were emitted in a specific sequence
   * @param eventTypes Array of event types in expected order
   * @param exact Whether the sequence must be exact (no other events between)
   * @param message Optional custom error message
   */
  expectEventSequence(eventTypes: string[], exact = false, message?: string): void {
    if (eventTypes.length === 0) {
      return;
    }

    if (exact) {
      // Exact sequence: events must be consecutive with no other events between
      if (this.capturedEvents.length < eventTypes.length) {
        throw new Error(
          message || `Expected exact sequence [${eventTypes.join(', ')}] but only ${this.capturedEvents.length} events captured`
        );
      }

      for (let i = 0; i <= this.capturedEvents.length - eventTypes.length; i++) {
        let matches = true;
        for (let j = 0; j < eventTypes.length; j++) {
          if (this.capturedEvents[i + j].type !== eventTypes[j]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return; // Found exact sequence
        }
      }

      const actualSequence = this.capturedEvents.map(e => e.type);
      throw new Error(
        message || `Expected exact sequence [${eventTypes.join(', ')}] not found in captured events: [${actualSequence.join(', ')}]`
      );
    } else {
      // Non-exact sequence: events must appear in order but can have other events between
      let eventIndex = 0;
      let sequenceIndex = 0;

      while (eventIndex < this.capturedEvents.length && sequenceIndex < eventTypes.length) {
        if (this.capturedEvents[eventIndex].type === eventTypes[sequenceIndex]) {
          sequenceIndex++;
        }
        eventIndex++;
      }

      if (sequenceIndex < eventTypes.length) {
        const actualSequence = this.capturedEvents.map(e => e.type);
        const foundSequence = eventTypes.slice(0, sequenceIndex);
        const missingSequence = eventTypes.slice(sequenceIndex);
        throw new Error(
          message || `Expected sequence [${eventTypes.join(', ')}] not found. Found: [${foundSequence.join(', ')}], missing: [${missingSequence.join(', ')}]. Captured events: [${actualSequence.join(', ')}]`
        );
      }
    }
  }

  /**
   * Assert that an event has specific data properties
   * @param event The event to check (or event type string to get the last event of that type)
   * @param expectedData Object with expected data properties
   * @param message Optional custom error message
   */
  expectEventData<T = any>(
    event: CapturedEvent<T> | string,
    expectedData: Partial<T>,
    message?: string
  ): void {
    const targetEvent = typeof event === 'string'
      ? this.getLastEventOfType<T>(event)
      : event;

    if (!targetEvent) {
      throw new Error(
        message || `Cannot check event data: ${typeof event === 'string' ? `no event of type '${event}' found` : 'event is undefined'}`
      );
    }

    for (const [key, expectedValue] of Object.entries(expectedData)) {
      const actualValue = (targetEvent.data as any)?.[key];

      if (actualValue !== expectedValue) {
        throw new Error(
          message || `Expected event '${targetEvent.type}' to have ${key}=${JSON.stringify(expectedValue)}, but got ${JSON.stringify(actualValue)}`
        );
      }
    }
  }

  /**
   * Assert that an event count matches expected value
   * @param eventType The event type to count
   * @param expectedCount The expected number of events
   * @param message Optional custom error message
   */
  expectEventCount(eventType: string, expectedCount: number, message?: string): void {
    const events = this.getEventsByType(eventType);
    if (events.length !== expectedCount) {
      throw new Error(
        message || `Expected ${expectedCount} '${eventType}' events, but captured ${events.length}`
      );
    }
  }

  /**
   * Assert that total event count matches expected value
   * @param expectedCount The expected total number of events
   * @param message Optional custom error message
   */
  expectTotalEventCount(expectedCount: number, message?: string): void {
    if (this.capturedEvents.length !== expectedCount) {
      throw new Error(
        message || `Expected ${expectedCount} total events, but captured ${this.capturedEvents.length}`
      );
    }
  }

  /**
   * Convenience methods for common confirmation-related events
   */

  /**
   * Get all approval-required events
   */
  getApprovalRequiredEvents(): CapturedEvent<ApprovalRequiredEventData>[] {
    return this.getEventsByType<ApprovalRequiredEventData>('approval:required');
  }

  /**
   * Get all approval response events (approved/denied)
   */
  getApprovalResponseEvents(): CapturedEvent<ApprovalResponseEventData>[] {
    return this.getEventsByTypes<ApprovalResponseEventData>(['gate:approved', 'gate:rejected']);
  }

  /**
   * Get all approval granted events
   */
  getApprovalGrantedEvents(): CapturedEvent<ApprovalGrantedEventData>[] {
    return this.getEventsByType<ApprovalGrantedEventData>('approval:granted');
  }

  /**
   * Get all approval denied events
   */
  getApprovalDeniedEvents(): CapturedEvent<ApprovalDeniedEventData>[] {
    return this.getEventsByType<ApprovalDeniedEventData>('approval:denied');
  }

  /**
   * Get all approval resolved events
   */
  getApprovalResolvedEvents(): CapturedEvent<ApprovalResolvedEventData>[] {
    return this.getEventsByType<ApprovalResolvedEventData>('approval:resolved');
  }

  /**
   * Get all gate-related events
   */
  getGateEvents(): CapturedEvent[] {
    return this.getEventsByTypes(['gate:required', 'gate:approved', 'gate:rejected']);
  }

  /**
   * Get all confirmation-related events (approval + gate + permission)
   */
  getConfirmationEvents(): CapturedEvent[] {
    return this.getEventsByTypes([
      'approval:required',
      'approval:resolved',
      'gate:required',
      'gate:approved',
      'gate:rejected',
      'approval:granted',
      'approval:denied',
      'permission:request',
      'permission:granted',
      'permission:denied',
      'dangerous:detected',
      'dangerous:confirmed',
      'dangerous:blocked'
    ]);
  }

  /**
   * Wait for a specific event to be emitted
   * @param eventType The event type to wait for
   * @param timeout Timeout in milliseconds (default: 5000)
   * @returns Promise that resolves with the event when it's emitted
   */
  waitForEvent<T = any>(eventType: string, timeout = 5000): Promise<CapturedEvent<T>> {
    return new Promise((resolve, reject) => {
      // Check if event already exists
      const existingEvent = this.getLastEventOfType<T>(eventType);
      if (existingEvent) {
        resolve(existingEvent);
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for event '${eventType}' after ${timeout}ms`));
      }, timeout);

      // Set up a temporary listener for this specific event
      const listener = (...args: any[]) => {
        const capturedEvent = this.capturedEvents[this.capturedEvents.length - 1];
        if (capturedEvent && capturedEvent.type === eventType) {
          clearTimeout(timeoutId);
          resolve(capturedEvent as CapturedEvent<T>);
        }
      };

      this.emitter.on(eventType, listener);

      // Clean up the listener after timeout
      setTimeout(() => {
        this.emitter.off(eventType, listener);
      }, timeout + 100);
    });
  }

  /**
   * Wait for a sequence of events to be emitted
   * @param eventTypes Array of event types to wait for
   * @param timeout Timeout in milliseconds (default: 10000)
   * @returns Promise that resolves when all events have been emitted in sequence
   */
  async waitForEventSequence(eventTypes: string[], timeout = 10000): Promise<CapturedEvent[]> {
    const events: CapturedEvent[] = [];
    const startTime = Date.now();

    for (const eventType of eventTypes) {
      const remainingTime = timeout - (Date.now() - startTime);
      if (remainingTime <= 0) {
        throw new Error(`Timeout waiting for event sequence. Got [${events.map(e => e.type).join(', ')}], still waiting for '${eventType}'`);
      }

      const event = await this.waitForEvent(eventType, remainingTime);
      events.push(event);
    }

    return events;
  }

  /**
   * Setup event listeners based on configuration
   */
  private setupEventListeners(): void {
    // Get all possible event types - for confirmation-related events specifically
    const confirmationEventTypes = [
      'approval:required',
      'approval:resolved',
      'approval:granted',
      'approval:denied',
      'gate:required',
      'gate:approved',
      'gate:rejected',
      'permission:request',
      'permission:granted',
      'permission:denied',
      'dangerous:detected',
      'dangerous:confirmed',
      'dangerous:blocked',
      'task:created',
      'task:started',
      'task:completed',
      'task:failed',
      'task:paused',
      'task:stage-changed'
    ] as const;

    // Determine which events to listen to
    const eventsToCapture = this.options.filterTypes.length > 0
      ? this.options.filterTypes
      : confirmationEventTypes;

    for (const eventType of eventsToCapture) {
      const listener = (...args: any[]) => {
        if (this.isCapturing) {
          this.captureEvent(eventType, args);
        }
      };

      this.eventListeners.set(eventType, listener);
      this.emitter.on(eventType, listener);
    }
  }

  /**
   * Clean up all event listeners
   */
  private cleanupEventListeners(): void {
    for (const [eventType, listener] of this.eventListeners) {
      this.emitter.off(eventType, listener);
    }
    this.eventListeners.clear();
  }

  /**
   * Capture an event
   */
  private captureEvent(type: string, args: any[]): void {
    // Extract the data from the arguments
    // Most events pass data as the first argument, but handle various formats
    let data: any;
    if (args.length === 1) {
      data = args[0];
    } else if (args.length > 1) {
      // Multiple arguments - create object with indexed keys
      data = args.length === 2 && typeof args[1] === 'object' && args[1] !== null
        ? args[1] // Common pattern: (taskId, eventData)
        : args; // Array of arguments
    } else {
      data = undefined;
    }

    const capturedEvent: CapturedEvent = {
      type,
      data,
      timestamp: new Date(),
      index: this.eventIndex++,
    };

    this.capturedEvents.push(capturedEvent);

    // Enforce max events limit
    if (this.capturedEvents.length > this.options.maxEvents) {
      this.capturedEvents.shift();
    }
  }

  /**
   * Get a summary of captured events for debugging
   */
  getEventSummary(): string {
    const eventCounts = new Map<string, number>();

    for (const event of this.capturedEvents) {
      eventCounts.set(event.type, (eventCounts.get(event.type) || 0) + 1);
    }

    const summary = Array.from(eventCounts.entries())
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');

    return `Captured ${this.capturedEvents.length} events: ${summary}`;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    this.clear();
  }
}

/**
 * Utility function to create an EventCapture instance with common defaults for testing
 * @param emitter The EventEmitter to capture events from
 * @param options Optional configuration
 */
export function createEventCapture(
  emitter: EventEmitter,
  options: EventCaptureOptions = {}
): EventCapture {
  return new EventCapture(emitter, {
    autoStart: true,
    maxEvents: 500,
    ...options,
  });
}

/**
 * Helper function to create an EventCapture that only captures confirmation-related events
 * @param emitter The EventEmitter to capture events from
 * @param options Optional configuration
 */
export function createConfirmationEventCapture(
  emitter: EventEmitter,
  options: Omit<EventCaptureOptions, 'filterTypes'> = {}
): EventCapture {
  return new EventCapture(emitter, {
    ...options,
    autoStart: true,
    filterTypes: [
      'approval:required',
      'approval:resolved',
      'approval:granted',
      'approval:denied',
      'gate:required',
      'gate:approved',
      'gate:rejected',
      'permission:request',
      'permission:granted',
      'permission:denied',
      'dangerous:detected',
      'dangerous:confirmed',
      'dangerous:blocked',
    ],
  });
}