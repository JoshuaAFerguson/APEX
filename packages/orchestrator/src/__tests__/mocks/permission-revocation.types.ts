/**
 * Type definitions for permission revocation test utilities
 *
 * These types support simulating mid-stream permission revocation
 * during Claude Agent SDK streaming responses.
 */

import type { StreamingEvent } from './claude-agent-sdk.types';

/**
 * Configuration for simulating permission revocation during streaming
 */
export interface RevocationConfig {
  /** Full set of streaming events to yield before/after revocation */
  events: StreamingEvent[];

  /** Trigger revocation after N events have been yielded */
  revokeAfterEvents?: number;

  /** Trigger revocation after a delay (ms) from stream start */
  revokeAfterDelayMs?: number;

  /** Trigger revocation when a specific tool_use event is encountered */
  revokeOnToolUse?: string;

  /** Reason string attached to the PermissionRevokedError */
  revocationReason?: string;
}

/**
 * Result of setting up a revocation simulation.
 *
 * Uses inline type references to avoid circular imports
 * (the classes are defined in permission-revocation.ts).
 */
export interface RevocationSimulationResult {
  /** The interruptible async iterable stream */
  stream: AsyncIterable<unknown>;

  /** Controller to manually trigger interruption */
  controller: {
    readonly interrupted: boolean;
    readonly reason: string | undefined;
    interrupt(reason?: string): void;
    reset(): void;
  };

  /** Tracker that records all events yielded before interruption */
  tracker: {
    readonly wasInterrupted: boolean;
    readonly interruptReason: string | undefined;
    readonly capturedEvents: readonly StreamingEvent[];
    readonly eventCount: number;
    record(event: StreamingEvent): void;
    markInterrupted(reason?: string): void;
    getPartialText(): string;
    getToolUseCalls(): TrackedToolCall[];
    getLastEvent(): StreamingEvent | undefined;
    reset(): void;
  };
}

/**
 * Extracted tool_use call data from streaming events
 */
export interface TrackedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
