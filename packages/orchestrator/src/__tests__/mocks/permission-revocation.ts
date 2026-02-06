/**
 * Permission Revocation Test Utilities
 *
 * Provides infrastructure for testing mid-stream permission revocation:
 * - InterruptibleStreamController: Controls when a stream is interrupted
 * - PartialResultTracker: Records events yielded before interruption
 * - PermissionRevocationSimulator: Orchestrates revocation simulation
 * - PermissionRevokedError: Custom error for permission revocation
 *
 * @see ADR-048 for architectural decisions
 */

import type { StreamingEvent } from './claude-agent-sdk.types';
import type { RevocationConfig, RevocationSimulationResult, TrackedToolCall } from './permission-revocation.types';
import { PermissionRevokedError } from '@apexcli/core';

/**
 * Controls interruption of an async generator stream.
 *
 * Inspired by the Web API AbortController pattern.
 * Call `interrupt()` to signal that the stream should stop yielding events.
 */
export class InterruptibleStreamController {
  private _interrupted = false;
  private _interruptReason?: string;

  /** Whether the stream has been interrupted */
  get interrupted(): boolean {
    return this._interrupted;
  }

  /** The reason for interruption, if provided */
  get reason(): string | undefined {
    return this._interruptReason;
  }

  /**
   * Interrupt the stream.
   * @param reason Optional reason string attached to the PermissionRevokedError
   */
  interrupt(reason?: string): void {
    this._interrupted = true;
    this._interruptReason = reason;
  }

  /**
   * Reset the controller to allow reuse
   */
  reset(): void {
    this._interrupted = false;
    this._interruptReason = undefined;
  }
}

/**
 * Records all streaming events yielded before interruption.
 *
 * Provides convenience methods to extract partial text, tool calls, etc.
 * from the events captured before the stream was interrupted.
 */
export class PartialResultTracker {
  private events: StreamingEvent[] = [];
  private _wasInterrupted = false;
  private _interruptReason?: string;

  /**
   * Record a streaming event
   */
  record(event: StreamingEvent): void {
    this.events.push(event);
  }

  /**
   * Mark the stream as interrupted
   */
  markInterrupted(reason?: string): void {
    this._wasInterrupted = true;
    this._interruptReason = reason;
  }

  /** Whether the tracked stream was interrupted */
  get wasInterrupted(): boolean {
    return this._wasInterrupted;
  }

  /** The reason for interruption */
  get interruptReason(): string | undefined {
    return this._interruptReason;
  }

  /** All events captured before interruption */
  get capturedEvents(): readonly StreamingEvent[] {
    return [...this.events];
  }

  /** Number of events captured */
  get eventCount(): number {
    return this.events.length;
  }

  /**
   * Extract all partial text from captured text/assistant events.
   *
   * Concatenates text content from events that contain text blocks.
   */
  getPartialText(): string {
    const textParts: string[] = [];

    for (const event of this.events) {
      if (event.type === 'text' || event.type === 'assistant') {
        const data = event.data as { message?: { content?: Array<{ type: string; text?: string }> } };
        if (data?.message?.content) {
          for (const block of data.message.content) {
            if (block.type === 'text' && block.text) {
              textParts.push(block.text);
            }
          }
        }
      }
    }

    return textParts.join('');
  }

  /**
   * Extract all tool_use calls from captured events
   */
  getToolUseCalls(): TrackedToolCall[] {
    const toolCalls: TrackedToolCall[] = [];

    for (const event of this.events) {
      if (event.type === 'tool_use') {
        const data = event.data as {
          message?: {
            content?: Array<{
              type: string;
              id?: string;
              name?: string;
              input?: Record<string, unknown>;
            }>;
          };
        };
        if (data?.message?.content) {
          for (const block of data.message.content) {
            if (block.type === 'tool_use' && block.id && block.name) {
              toolCalls.push({
                id: block.id,
                name: block.name,
                input: block.input ?? {},
              });
            }
          }
        }
      }
    }

    return toolCalls;
  }

  /**
   * Get the last captured event, if any
   */
  getLastEvent(): StreamingEvent | undefined {
    return this.events.length > 0 ? this.events[this.events.length - 1] : undefined;
  }

  /**
   * Reset the tracker for reuse
   */
  reset(): void {
    this.events = [];
    this._wasInterrupted = false;
    this._interruptReason = undefined;
  }
}

/**
 * Orchestrates permission revocation simulation during Claude SDK streaming.
 *
 * Creates interruptible async iterable streams that can be stopped at
 * configurable points (after N events, after a delay, or on specific tool use).
 * Tracks all partial results yielded before interruption.
 *
 * @example
 * ```typescript
 * const simulator = new PermissionRevocationSimulator();
 * const events = new StreamingResponseBuilder()
 *   .addTextChunk('Hello')
 *   .addToolUse('t1', 'read_file', { path: '/etc/passwd' })
 *   .addTextChunk('Contents...')
 *   .build();
 *
 * const { stream, tracker } = simulator.simulateRevocationDuringStream({
 *   events,
 *   revokeAfterEvents: 2,
 *   revocationReason: 'Access denied',
 * });
 *
 * try {
 *   for await (const event of stream) { /* processes 2 events *\/ }
 * } catch (e) {
 *   // e instanceof PermissionRevokedError === true
 *   // tracker.wasInterrupted === true
 *   // tracker.eventCount === 2
 * }
 * ```
 */
export class PermissionRevocationSimulator {
  /**
   * Create an interruptible async iterable from a list of streaming events.
   *
   * The stream yields events one at a time, checking the controller's
   * `interrupted` flag before each yield. If interrupted, throws a
   * `PermissionRevokedError` and marks the tracker as interrupted.
   *
   * @param events The streaming events to yield
   * @param controller The controller that can signal interruption
   * @param tracker Optional tracker to record yielded events
   * @returns An async iterable that respects interruption signals
   */
  createInterruptibleStream(
    events: StreamingEvent[],
    controller: InterruptibleStreamController,
    tracker?: PartialResultTracker,
  ): AsyncIterable<unknown> {
    return {
      [Symbol.asyncIterator]: async function* () {
        for (const event of events) {
          // Check for interruption before yielding
          if (controller.interrupted) {
            if (tracker) {
              tracker.markInterrupted(controller.reason);
            }
            throw new PermissionRevokedError(controller.reason);
          }

          // Apply event delay if configured
          if (event.delay) {
            await new Promise(resolve => setTimeout(resolve, event.delay));
          }

          // Check again after delay (interruption may have occurred during wait)
          if (controller.interrupted) {
            if (tracker) {
              tracker.markInterrupted(controller.reason);
            }
            throw new PermissionRevokedError(controller.reason);
          }

          // Handle error events (existing streaming behavior)
          if (event.type === 'error') {
            throw event.data instanceof Error ? event.data : new Error(String(event.data));
          }

          // Record the event in the tracker
          if (tracker) {
            tracker.record(event);
          }

          yield event.data;
        }
      },
    };
  }

  /**
   * Set up a complete revocation simulation with automatic triggering.
   *
   * Creates a stream, controller, and tracker, and configures automatic
   * revocation based on the provided config (after N events, after delay,
   * or on specific tool use).
   *
   * @param config Revocation simulation configuration
   * @returns Stream, controller, and tracker for the simulation
   */
  simulateRevocationDuringStream(config: RevocationConfig): RevocationSimulationResult {
    const controller = new InterruptibleStreamController();
    const tracker = new PartialResultTracker();
    const reason = config.revocationReason ?? 'Permission revoked during stream';

    // Wrap events to inject automatic revocation triggers
    const wrappedEvents = this.wrapEventsWithTriggers(config, controller, reason);

    const stream = this.createInterruptibleStream(wrappedEvents, controller, tracker);

    // If delay-based revocation is configured, set a timer
    if (config.revokeAfterDelayMs !== undefined) {
      setTimeout(() => {
        controller.interrupt(reason);
      }, config.revokeAfterDelayMs);
    }

    return { stream, controller, tracker };
  }

  /**
   * Wrap events to inject revocation triggers based on config.
   *
   * For event-count and tool-use triggers, we inject the interruption signal
   * by modifying the event sequence to trigger the controller at the right point.
   */
  private wrapEventsWithTriggers(
    config: RevocationConfig,
    controller: InterruptibleStreamController,
    reason: string,
  ): StreamingEvent[] {
    const events = [...config.events];

    if (config.revokeAfterEvents !== undefined) {
      const triggerIndex = config.revokeAfterEvents;
      if (triggerIndex < events.length) {
        // Insert a synthetic trigger event after the Nth event
        const triggerEvent: StreamingEvent = {
          type: 'text', // type doesn't matter, won't be yielded
          data: null,
          delay: 0,
        };

        // We use a special approach: modify the event at triggerIndex
        // to trigger interruption via its delay callback
        const originalEvent = events[triggerIndex];
        events[triggerIndex] = {
          ...originalEvent,
          // Set a minimal delay to allow the interruption check to fire
          delay: originalEvent.delay ?? 1,
        };

        // Schedule interruption to fire after the Nth event is yielded
        // We do this by inserting a trigger that fires the controller
        // right before the (N+1)th event
        events.splice(triggerIndex, 0, {
          type: 'text',
          data: {
            __revocationTrigger: true,
            _triggerFn: () => controller.interrupt(reason),
          },
          delay: 0,
        });

        // Actually, the cleaner approach: just use afterEvents count
        // Re-do this with a counted approach that doesn't modify events
        events.length = 0;
        events.push(...config.events);
      }
    }

    // For counted revocation, we track event count in the stream itself
    // using a proxy approach - wrap each event
    if (config.revokeAfterEvents !== undefined || config.revokeOnToolUse !== undefined) {
      return this.createTriggerableEvents(
        config.events,
        controller,
        reason,
        config.revokeAfterEvents,
        config.revokeOnToolUse,
      );
    }

    return events;
  }

  /**
   * Create a modified event list that triggers interruption at the right point.
   */
  private createTriggerableEvents(
    originalEvents: StreamingEvent[],
    controller: InterruptibleStreamController,
    reason: string,
    afterCount?: number,
    onToolUse?: string,
  ): StreamingEvent[] {
    const result: StreamingEvent[] = [];
    let yieldedCount = 0;

    for (const event of originalEvents) {
      result.push(event);
      yieldedCount++;

      // Check count trigger: interrupt AFTER the Nth event is yielded
      if (afterCount !== undefined && yieldedCount === afterCount) {
        // Insert a zero-delay event that will see the interrupted flag
        // We trigger interruption synchronously here via a pre-yield check
        // by scheduling it before the next event's pre-check
        result.push({
          type: 'text',
          data: null,
          // Use a small delay so the interruption check fires
          delay: 1,
        });
        // The controller will be interrupted by the time the delay resolves
        setTimeout(() => controller.interrupt(reason), 0);
        // Add remaining events (they won't be yielded due to interruption)
        for (let i = yieldedCount; i < originalEvents.length; i++) {
          result.push(originalEvents[i]);
        }
        return result;
      }

      // Check tool use trigger
      if (onToolUse !== undefined && event.type === 'tool_use') {
        const data = event.data as {
          message?: {
            content?: Array<{ type: string; name?: string }>;
          };
        };
        const hasMatch = data?.message?.content?.some(
          block => block.type === 'tool_use' && block.name === onToolUse,
        );

        if (hasMatch) {
          result.push({
            type: 'text',
            data: null,
            delay: 1,
          });
          setTimeout(() => controller.interrupt(reason), 0);
          for (let i = yieldedCount; i < originalEvents.length; i++) {
            result.push(originalEvents[i]);
          }
          return result;
        }
      }
    }

    return result;
  }
}
