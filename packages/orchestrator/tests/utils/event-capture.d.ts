/**
 * Test utility for capturing and asserting on orchestrator events
 * Supports all confirmation-related events and provides comprehensive testing capabilities
 */
import { EventEmitter } from 'eventemitter3';
import type { ApprovalRequiredEventData, ApprovalResponseEventData, ApprovalGrantedEventData, ApprovalDeniedEventData, ApprovalResolvedEventData } from '@apexcli/core';
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
export declare class EventCapture {
    private emitter;
    private capturedEvents;
    private isCapturing;
    private eventIndex;
    private options;
    private eventListeners;
    /**
     * Creates a new EventCapture instance
     * @param emitter The EventEmitter to capture events from (typically ApexOrchestrator)
     * @param options Configuration options
     */
    constructor(emitter: EventEmitter, options?: EventCaptureOptions);
    /**
     * Start capturing events
     */
    start(): void;
    /**
     * Stop capturing events and clean up listeners
     */
    stop(): void;
    /**
     * Clear all captured events
     */
    clear(): void;
    /**
     * Reset the event capture (clear events and restart if was running)
     */
    reset(): void;
    /**
     * Get all captured events
     */
    getAllEvents(): CapturedEvent[];
    /**
     * Get events filtered by type
     * @param eventType The event type to filter by
     */
    getEventsByType<T = any>(eventType: string): CapturedEvent<T>[];
    /**
     * Get events filtered by multiple types
     * @param eventTypes Array of event types to filter by
     */
    getEventsByTypes<T = any>(eventTypes: string[]): CapturedEvent<T>[];
    /**
     * Get the most recent event
     */
    getLastEvent(): CapturedEvent | undefined;
    /**
     * Get the most recent event of a specific type
     * @param eventType The event type to find
     */
    getLastEventOfType<T = any>(eventType: string): CapturedEvent<T> | undefined;
    /**
     * Get events within a specific time range
     * @param startTime Start of the time range
     * @param endTime End of the time range
     */
    getEventsInTimeRange(startTime: Date, endTime: Date): CapturedEvent[];
    /**
     * Get events matching a predicate function
     * @param predicate Function to test each event
     */
    getEventsWhere<T = any>(predicate: (event: CapturedEvent<T>) => boolean): CapturedEvent<T>[];
    /**
     * Assert that a specific event was emitted
     * @param eventType The expected event type
     * @param message Optional custom error message
     */
    expectEventEmitted(eventType: string, message?: string): void;
    /**
     * Assert that a specific event was NOT emitted
     * @param eventType The event type that should not be present
     * @param message Optional custom error message
     */
    expectEventNotEmitted(eventType: string, message?: string): void;
    /**
     * Assert that events were emitted in a specific sequence
     * @param eventTypes Array of event types in expected order
     * @param exact Whether the sequence must be exact (no other events between)
     * @param message Optional custom error message
     */
    expectEventSequence(eventTypes: string[], exact?: boolean, message?: string): void;
    /**
     * Assert that an event has specific data properties
     * @param event The event to check (or event type string to get the last event of that type)
     * @param expectedData Object with expected data properties
     * @param message Optional custom error message
     */
    expectEventData<T = any>(event: CapturedEvent<T> | string, expectedData: Partial<T>, message?: string): void;
    /**
     * Assert that an event count matches expected value
     * @param eventType The event type to count
     * @param expectedCount The expected number of events
     * @param message Optional custom error message
     */
    expectEventCount(eventType: string, expectedCount: number, message?: string): void;
    /**
     * Assert that total event count matches expected value
     * @param expectedCount The expected total number of events
     * @param message Optional custom error message
     */
    expectTotalEventCount(expectedCount: number, message?: string): void;
    /**
     * Convenience methods for common confirmation-related events
     */
    /**
     * Get all approval-required events
     */
    getApprovalRequiredEvents(): CapturedEvent<ApprovalRequiredEventData>[];
    /**
     * Get all approval response events (approved/denied)
     */
    getApprovalResponseEvents(): CapturedEvent<ApprovalResponseEventData>[];
    /**
     * Get all approval granted events
     */
    getApprovalGrantedEvents(): CapturedEvent<ApprovalGrantedEventData>[];
    /**
     * Get all approval denied events
     */
    getApprovalDeniedEvents(): CapturedEvent<ApprovalDeniedEventData>[];
    /**
     * Get all approval resolved events
     */
    getApprovalResolvedEvents(): CapturedEvent<ApprovalResolvedEventData>[];
    /**
     * Get all gate-related events
     */
    getGateEvents(): CapturedEvent[];
    /**
     * Get all confirmation-related events (approval + gate + permission)
     */
    getConfirmationEvents(): CapturedEvent[];
    /**
     * Wait for a specific event to be emitted
     * @param eventType The event type to wait for
     * @param timeout Timeout in milliseconds (default: 5000)
     * @returns Promise that resolves with the event when it's emitted
     */
    waitForEvent<T = any>(eventType: string, timeout?: number): Promise<CapturedEvent<T>>;
    /**
     * Wait for a sequence of events to be emitted
     * @param eventTypes Array of event types to wait for
     * @param timeout Timeout in milliseconds (default: 10000)
     * @returns Promise that resolves when all events have been emitted in sequence
     */
    waitForEventSequence(eventTypes: string[], timeout?: number): Promise<CapturedEvent[]>;
    /**
     * Setup event listeners based on configuration
     */
    private setupEventListeners;
    /**
     * Clean up all event listeners
     */
    private cleanupEventListeners;
    /**
     * Capture an event
     */
    private captureEvent;
    /**
     * Get a summary of captured events for debugging
     */
    getEventSummary(): string;
    /**
     * Cleanup resources
     */
    dispose(): void;
}
/**
 * Utility function to create an EventCapture instance with common defaults for testing
 * @param emitter The EventEmitter to capture events from
 * @param options Optional configuration
 */
export declare function createEventCapture(emitter: EventEmitter, options?: EventCaptureOptions): EventCapture;
/**
 * Helper function to create an EventCapture that only captures confirmation-related events
 * @param emitter The EventEmitter to capture events from
 * @param options Optional configuration
 */
export declare function createConfirmationEventCapture(emitter: EventEmitter, options?: Omit<EventCaptureOptions, 'filterTypes'>): EventCapture;
//# sourceMappingURL=event-capture.d.ts.map