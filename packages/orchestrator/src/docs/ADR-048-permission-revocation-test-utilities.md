# ADR-048: Permission Revocation Test Utilities

**Status**: Proposed
**Date**: 2025-07-15
**Author**: Architect Agent

## Context

APEX needs test infrastructure to verify that permission revocation works correctly during active Claude SDK streaming sessions. Currently, the codebase has:

1. **MockClaudeAgentSDK** (ADR-035): Mocks for query(), streaming responses, errors, and usage tracking
2. **PermissionManager**: Session-cached permission system with `revokePermission()` method
3. **StreamingResponseBuilder**: Builder pattern for constructing streaming event sequences

However, there is no way to test the **intersection** of these systems: what happens when a permission is revoked *mid-stream* while Claude is actively generating output? This is critical for security — a revoked permission must halt agent execution gracefully, capturing any partial work.

## Decision

Create a dedicated `PermissionRevocationSimulator` class and supporting utilities in `packages/orchestrator/src/__tests__/mocks/permission-revocation.ts` that extend the existing mock infrastructure to support:

1. **Controllable stream interruption** via an `AbortController`-like mechanism
2. **Mid-stream permission revocation simulation** triggered at configurable points
3. **Partial result tracking** that captures all yielded events before interruption

## Technical Design

### 1. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│           PermissionRevocationSimulator               │
│                                                       │
│  ┌─────────────────┐    ┌─────────────────────────┐  │
│  │ InterruptControl │    │ PartialResultTracker    │  │
│  │                  │    │                         │  │
│  │ - signal         │    │ - events: StreamEvent[] │  │
│  │ - trigger()      │    │ - record(event)         │  │
│  │ - afterNEvents() │    │ - getPartialText()      │  │
│  │ - afterDelay()   │    │ - getToolCalls()        │  │
│  │ - onToolUse()    │    │ - getLastEvent()        │  │
│  └─────────────────┘    │ - wasInterrupted        │  │
│                          └─────────────────────────┘  │
│                                                       │
│  Methods:                                             │
│  - createInterruptibleStream(events)                  │
│  - simulateRevocationDuringStream(config)             │
│  - getTracker(): PartialResultTracker                 │
└──────────────────────────────────────────────────────┘
```

### 2. Core Components

#### 2.1 InterruptibleStreamController

Controls when a stream is interrupted. Similar to `AbortController` but designed for async generator interruption.

```typescript
export class InterruptibleStreamController {
  private _interrupted = false;
  private _interruptReason?: string;

  get interrupted(): boolean;
  get reason(): string | undefined;

  interrupt(reason?: string): void;
}
```

#### 2.2 PartialResultTracker

Records all events yielded before interruption.

```typescript
export class PartialResultTracker {
  private events: StreamingEvent[] = [];
  private _wasInterrupted = false;
  private _interruptReason?: string;

  record(event: StreamingEvent): void;
  markInterrupted(reason?: string): void;

  get wasInterrupted(): boolean;
  get interruptReason(): string | undefined;
  get capturedEvents(): readonly StreamingEvent[];
  getPartialText(): string;
  getToolUseCalls(): Array<{ id: string; name: string; input: Record<string, unknown> }>;
  getLastEvent(): StreamingEvent | undefined;
  get eventCount(): number;
}
```

#### 2.3 PermissionRevocationSimulator

Main class that ties together stream creation, interruption control, and result tracking.

```typescript
export class PermissionRevocationSimulator {
  createInterruptibleStream(
    events: StreamingEvent[],
    controller: InterruptibleStreamController
  ): AsyncIterable<unknown>;

  simulateRevocationDuringStream(config: RevocationConfig): {
    stream: AsyncIterable<unknown>;
    controller: InterruptibleStreamController;
    tracker: PartialResultTracker;
  };
}
```

#### 2.4 RevocationConfig

```typescript
export interface RevocationConfig {
  events: StreamingEvent[];                  // Full set of events to stream
  revokeAfterEvents?: number;               // Trigger revocation after N events
  revokeAfterDelayMs?: number;              // Trigger revocation after delay
  revokeOnToolUse?: string;                 // Trigger revocation when specific tool is used
  revocationReason?: string;                // Reason string for the revocation
}
```

#### 2.5 PermissionRevokedError

Custom error type for permission revocation, distinguishable from other errors.

```typescript
export class PermissionRevokedError extends Error {
  readonly code = 'PERMISSION_REVOKED';
  constructor(reason?: string);
}
```

### 3. Integration with Existing Mock Infrastructure

The simulator integrates with the existing `MockClaudeAgentSDK` and `StreamingResponseBuilder`:

```typescript
// Usage example
const builder = new StreamingResponseBuilder();
builder
  .addTextChunk('Starting analysis...')
  .addToolUse('tool-1', 'read_file', { path: '/etc/passwd' })
  .addTextChunk('File contents: ...')
  .addUsage(100, 50);

const simulator = new PermissionRevocationSimulator();
const { stream, controller, tracker } = simulator.simulateRevocationDuringStream({
  events: builder.build(),
  revokeAfterEvents: 2,  // Revoke after tool_use
  revocationReason: 'Access to /etc/passwd denied',
});

// Consume stream - will get 2 events then PermissionRevokedError
for await (const event of stream) {
  // processes first 2 events
}
// tracker.wasInterrupted === true
// tracker.capturedEvents.length === 2
// tracker.getPartialText() === 'Starting analysis...'
```

### 4. File Structure

```
packages/orchestrator/src/__tests__/mocks/
├── claude-agent-sdk.ts              # Existing - MockClaudeAgentSDK
├── claude-agent-sdk.types.ts        # Existing - Type definitions
├── permission-revocation.ts         # NEW - PermissionRevocationSimulator
├── permission-revocation.types.ts   # NEW - Type definitions
├── index.ts                         # Updated - Re-export new utilities
└── ...
```

### 5. Design Decisions

1. **Separate from MockClaudeAgentSDK**: The simulator is a separate class rather than extending MockClaudeAgentSDK, following Single Responsibility Principle. It composes with the existing streaming infrastructure.

2. **AbortController-inspired pattern**: The `InterruptibleStreamController` follows the familiar `AbortController` pattern from the Web API, making it intuitive for developers.

3. **Builder-compatible**: Works with existing `StreamingResponseBuilder.build()` output directly — no new event types needed.

4. **Custom error class**: `PermissionRevokedError` with a `code` property allows consumers to distinguish permission revocation from other stream errors (network, rate limit, etc.).

5. **Tracker is passive**: The `PartialResultTracker` records events as a side effect during iteration, requiring no changes to consuming code patterns.

## Consequences

### Positive
- Enables testing of permission revocation during active streaming
- Reuses existing `StreamingEvent[]` format — no breaking changes
- Composable with existing `MockClaudeAgentSDK` for full integration tests
- Custom error type enables precise error handling assertions

### Negative
- Adds new files to the test utilities directory
- Test authors need to learn the new API surface (mitigated by familiar patterns)

## Related ADRs
- ADR-035: Claude Agent SDK Mock Utilities
- ADR-037: Permissions Integration Tests Architecture
