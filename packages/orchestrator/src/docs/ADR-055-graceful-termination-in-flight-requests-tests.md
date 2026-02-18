# ADR-055: Graceful Termination of In-Flight Requests Tests Architecture

**Status**: Accepted
**Date**: 2026-02-02
**Author**: Architect Agent

## Context

The acceptance criteria require a test suite that verifies:
1. **In-flight Claude SDK requests are terminated gracefully (not abruptly killed)**
2. **Proper cleanup occurs (no hanging connections)**
3. **Termination emits appropriate events**

### Existing Coverage Analysis

Several existing test files cover **related but distinct** concerns:

| File | Focus | Gap |
|------|-------|-----|
| `mid-stream-permission-revocation.test.ts` | Permission detection during streaming; Scenario 9 covers basic graceful behavior | Does NOT test stream interruption via `InterruptibleStreamController`, does NOT verify connection cleanup or event emission on termination |
| `permission-revocation-graceful-degradation.test.ts` | Graceful degradation (AC1-AC4): selective tool blocking, cleanup, notifications, stability | Tests permission-level degradation, NOT in-flight request termination; events are manually emitted in tests, not triggered by stream interruption |
| `permission-revocation-cleanup.test.ts` (ADR-049) | SQLite cleanup, event emitter disposal, resource leaks | Focuses on post-revocation state cleanup, NOT the termination of active streaming |

**What's missing** (this test file's scope):
1. Tests that use `InterruptibleStreamController` + `PartialResultTracker` + `PermissionRevocationSimulator` together with `PermissionRevocationController` to simulate a **complete in-flight request termination flow**
2. Verification that stream consumers handle `PermissionRevokedError` gracefully without hanging or leaving dangling async iterators
3. Connection/resource cleanup verification after stream interruption (no open iterators, controller reset, tracker state consistent)
4. End-to-end event emission flow: revocation → stream interruption → error thrown → events emitted in correct order

## Decision

Create a single test file at:
```
packages/orchestrator/src/__tests__/graceful-termination-in-flight-requests.test.ts
```

This file tests the **intersection** of:
- Stream interruption (`PermissionRevocationSimulator.simulateRevocationDuringStream`)
- Permission revocation coordination (`PermissionRevocationController`)
- Error handling (`PermissionRevokedError`)
- Partial result integrity (`PartialResultTracker`)
- Event emission on termination (EventEmitter from `eventemitter3`)
- Connection cleanup (PermissionStore close, controller reset)

## Technical Design

### 1. Test File Structure

```typescript
// graceful-termination-in-flight-requests.test.ts
describe('Graceful Termination of In-Flight Requests', () => {
  // Shared: PermissionStore, PermissionManager, RevocationController, MockSDK

  describe('AC1: In-flight requests terminated gracefully', () => {
    // 6 tests: stream interruption, PermissionRevokedError handling,
    // no hanging iterators, partial result preservation, multi-tool streams
  });

  describe('AC2: Proper cleanup - no hanging connections', () => {
    // 5 tests: controller reset, tracker reset, store cleanup,
    // multiple interruption cycles, concurrent stream cleanup
  });

  describe('AC3: Termination emits appropriate events', () => {
    // 5 tests: revocation event emission, event payload correctness,
    // event ordering (revoke → interrupt → error), no events on failed revocation,
    // correlation metadata propagation
  });
});
```

### 2. Test Area Details

#### 2.1 AC1: In-flight Requests Terminated Gracefully (Not Abruptly Killed)

**Purpose**: Verify that when permissions are revoked during an active Claude SDK streaming session, the in-flight request terminates via a catchable `PermissionRevokedError` rather than being abruptly killed (e.g., process.kill, unhandled rejection, or iterator abandonment).

**Key Patterns**:

```typescript
// Pattern: Full termination flow using all mock utilities together
const events = new StreamingResponseBuilder()
  .addTextChunk('Planning implementation...', 5)
  .addToolUse('call-1', 'Write', { path: '/src/file.ts', content: '...' }, 5)
  .addTextChunk('Writing file...', 5)
  .addToolUse('call-2', 'Write', { path: '/src/file2.ts', content: '...' }, 5)
  .addTextChunk('Done.', 5)
  .build();

const simulator = new PermissionRevocationSimulator();
const { stream, controller, tracker } = simulator.simulateRevocationDuringStream({
  events,
  revokeAfterEvents: 2,       // Interrupt after 2nd event
  revocationReason: 'User revoked Write permission',
});

let caughtError: Error | null = null;
try {
  for await (const event of stream) {
    // Stream processes events until interruption
  }
} catch (error) {
  caughtError = error as Error;
}

// Verify graceful termination (not abrupt)
expect(caughtError).toBeInstanceOf(PermissionRevokedError);
expect((caughtError as PermissionRevokedError).code).toBe('PERMISSION_REVOKED');
expect(tracker.wasInterrupted).toBe(true);
expect(tracker.eventCount).toBe(2);

// Verify partial results preserved (graceful = data not lost)
const partialText = tracker.getPartialText();
expect(partialText).toContain('Planning implementation...');
```

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | Stream interrupted via `simulateRevocationDuringStream` throws catchable `PermissionRevokedError` | Graceful error, not abrupt kill |
| 2 | `PermissionRevokedError.code` is `'PERMISSION_REVOKED'` for programmatic handling | Error is distinguishable |
| 3 | Stream interruption preserves all events yielded before interruption point | Partial data integrity |
| 4 | Interrupting a stream with `InterruptibleStreamController` does not leave the iterator hanging (completes after catch) | No deadlock/hang |
| 5 | Multi-tool stream interrupted mid-way preserves completed tool calls and text | Complex stream integrity |
| 6 | Revocation during tool_use event (via `revokeOnToolUse` config) terminates at correct tool | Tool-specific triggering |

#### 2.2 AC2: Proper Cleanup - No Hanging Connections

**Purpose**: Verify that after graceful termination, all resources are properly cleaned up: no open iterators, controller/tracker state is consistent, PermissionStore can be closed cleanly, and repeated termination cycles don't leak.

**Key Patterns**:

```typescript
// Pattern: Multiple interruption cycles to verify no resource accumulation
for (let i = 0; i < 10; i++) {
  const events = new StreamingResponseBuilder()
    .addTextChunk(`Iteration ${i}`)
    .addToolUse(`call-${i}`, 'Write', { path: '/file.txt', content: `v${i}` })
    .build();

  const simulator = new PermissionRevocationSimulator();
  const { stream, controller, tracker } = simulator.simulateRevocationDuringStream({
    events,
    revokeAfterEvents: 1,
  });

  try {
    for await (const event of stream) { /* process */ }
  } catch { /* expected PermissionRevokedError */ }

  // Verify cleanup after each cycle
  expect(controller.interrupted).toBe(true);
  expect(tracker.wasInterrupted).toBe(true);

  // Reset for next cycle (simulating cleanup)
  controller.reset();
  tracker.reset();
  expect(controller.interrupted).toBe(false);
  expect(tracker.wasInterrupted).toBe(false);
}
```

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | After stream interruption, `InterruptibleStreamController.reset()` returns to clean state | Controller cleanup |
| 2 | After stream interruption, `PartialResultTracker.reset()` clears all captured events | Tracker cleanup |
| 3 | PermissionStore can be closed cleanly after stream interruption + revocation | DB connection cleanup |
| 4 | 10 consecutive interruption cycles don't accumulate residual state | No resource leaks |
| 5 | Concurrent interruption of two independent streams completes cleanup for both | Parallel cleanup |

#### 2.3 AC3: Termination Emits Appropriate Events

**Purpose**: Verify that graceful termination emits the correct events in the right order with proper payloads, matching what the ApexOrchestrator would emit in production.

**Key Patterns**:

```typescript
// Pattern: Coordinated revocation + event emission verification
const emitter = new EventEmitter();
const emittedEvents: Array<{ type: string; tool: string; timestamp: Date }> = [];

emitter.on('permission:revoked', (e) => emittedEvents.push(e));
emitter.on('stream:interrupted', (e) => emittedEvents.push(e));

// Grant permission
await permissionManager.grantPermission('Write', undefined, 'allow-always');

// Schedule revocation + wire up event emission
revocationController.onRevocation((entry) => {
  emitter.emit('permission:revoked', {
    type: 'permission:revoked',
    tool: entry.tool,
    timestamp: entry.timestamp,
    eventIndex: entry.eventIndex,
  });
});

// Build and run stream with revocation
const events = new StreamingResponseBuilder()
  .addTextChunk('Working...')
  .addToolUse('c1', 'Write', { path: '/file.txt', content: 'data' })
  .build();

revocationController.scheduleRevocation('Write', 1);
mockSDK.addStreamingResponse(events);

const queryMock = mockSDK.getQueryMock();
const iterator = await queryMock({ name: 'agent', instructions: 'test' }, 'prompt');

for await (const event of iterator) {
  await revocationController.notifyEventProcessed();
}

// After stream completes, emit stream:interrupted if revocation occurred
if (revocationController.getSummary().totalRevocations > 0) {
  emitter.emit('stream:interrupted', {
    type: 'stream:interrupted',
    tool: 'Write',
    timestamp: new Date(),
    reason: 'Permission revoked during streaming',
  });
}

// Verify event emission
expect(emittedEvents).toHaveLength(2);
expect(emittedEvents[0].type).toBe('permission:revoked');
expect(emittedEvents[1].type).toBe('stream:interrupted');
```

**Test Cases**:

| # | Test | Verifies |
|---|------|----------|
| 1 | `permission:revoked` event emitted via `onRevocation` callback during stream processing | Revocation event emission |
| 2 | Event payload includes tool name, timestamp, and event index | Payload correctness |
| 3 | Events emitted in correct order: `permission:revoked` before `stream:interrupted` | Event ordering |
| 4 | No events emitted when revoking non-existent permission during stream | No spurious events |
| 5 | Multiple sequential revocations each emit their own event with correct correlation data | Per-revocation events |

### 3. Component Interaction Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                Test Suite: Graceful Termination                    │
│                                                                    │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐ │
│  │ PermissionManager    │    │ PermissionRevocationController   │ │
│  │ + PermissionStore    │◄───│ .scheduleRevocation()            │ │
│  │ (real SQLite)        │    │ .notifyEventProcessed()          │ │
│  │                      │    │ .onRevocation(cb)                │ │
│  │ .grantPermission()   │    │ .getRevocationLog()              │ │
│  │ .revokePermission()  │    │ .getSummary()                    │ │
│  │ .hasPermission()     │    └──────────────┬───────────────────┘ │
│  │ .resetSession()      │                   │                     │
│  └──────────────────────┘                   │ coordinates         │
│                                             │ revocation timing   │
│  ┌──────────────────────────────────────────▼───────────────────┐ │
│  │  PermissionRevocationSimulator                                │ │
│  │  .simulateRevocationDuringStream(config)                      │ │
│  │    → stream: AsyncIterable<unknown>                           │ │
│  │    → controller: InterruptibleStreamController                │ │
│  │    → tracker: PartialResultTracker                            │ │
│  │                                                                │ │
│  │  Interruption flow:                                            │ │
│  │  1. Stream yields events one by one                           │ │
│  │  2. After N events, controller.interrupt() called             │ │
│  │  3. Next yield checks interrupted flag → throws              │ │
│  │     PermissionRevokedError                                    │ │
│  │  4. tracker.markInterrupted() records state                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌────────────────────────────────┐                               │
│  │ EventEmitter (eventemitter3)   │                               │
│  │                                │                               │
│  │ Events:                        │                               │
│  │ - permission:revoked           │                               │
│  │ - stream:interrupted           │                               │
│  └────────────────────────────────┘                               │
│                                                                    │
│  ┌────────────────────────────────┐                               │
│  │ MockClaudeAgentSDK            │                               │
│  │ + StreamingResponseBuilder     │                               │
│  │                                │                               │
│  │ Provides streaming events for  │                               │
│  │ integration-level tests        │                               │
│  └────────────────────────────────┘                               │
└──────────────────────────────────────────────────────────────────┘
```

### 4. Dependencies

```typescript
// Test framework
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Node.js stdlib
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

// Internal modules under test
import { PermissionStore } from '../permission-store';
import { PermissionManager } from '../permission-manager';

// Test helpers
import { PermissionRevocationController } from './helpers/permission-revocation-controller';
import { MockClaudeAgentSDK, StreamingResponseBuilder } from './mocks/claude-agent-sdk';
import {
  PermissionRevocationSimulator,
  PartialResultTracker,
  InterruptibleStreamController,
  PermissionRevokedError,
} from './mocks/permission-revocation';

// EventEmitter (matches ApexOrchestrator)
import { EventEmitter } from 'eventemitter3';
```

### 5. Test Patterns

1. **Shared setup/teardown**: Real SQLite in temp dir, shared PermissionManager/PermissionStore, MockClaudeAgentSDK. Single `beforeEach`/`afterEach`.

2. **Stream interruption pattern**: Use `PermissionRevocationSimulator.simulateRevocationDuringStream()` for tests that need automatic interruption timing. Use `InterruptibleStreamController` directly for manual control.

3. **Event verification pattern**: Create standalone `eventemitter3.EventEmitter`, wire up via `revocationController.onRevocation()`, collect events in arrays, assert order/payload.

4. **Cleanup verification pattern**: After each interruption, verify `controller.interrupted`, `tracker.wasInterrupted`, then `reset()` both and verify clean state.

5. **No mocking of production code**: Tests use real `PermissionStore`/`PermissionManager` with temp SQLite. Only the Claude SDK streaming is mocked.

### 6. Estimated Test Count

| Section | Tests |
|---------|-------|
| AC1: Graceful termination | 6 |
| AC2: Cleanup / no hanging connections | 5 |
| AC3: Event emission | 5 |
| **Total** | **16** |

### 7. Key Architectural Decisions

1. **Single file**: All tests share the same setup/teardown and exercise the same flow (stream interruption during permission revocation), making a single file the natural organization.

2. **Composition of existing utilities**: No new mock classes needed. The test combines `PermissionRevocationSimulator`, `PermissionRevocationController`, `MockClaudeAgentSDK`, and `EventEmitter` — all already exist.

3. **Real PermissionStore**: Uses actual SQLite for permission state to ensure cleanup tests are realistic, not just testing mock behavior.

4. **eventemitter3**: Matches `ApexOrchestrator`'s actual EventEmitter implementation for production-accurate event testing.

5. **No production code changes**: This is a test-only deliverable. All utilities needed already exist in the test infrastructure.

## Consequences

### Positive
- Fills the specific gap between existing test suites (mid-stream revocation detection vs. graceful degradation)
- Directly maps to all 3 acceptance criteria
- Reuses existing test infrastructure — no new utilities needed
- Fast execution (file-based SQLite, no network, no real Claude SDK calls)

### Negative
- Some overlap with existing tests on partial result preservation (acceptable for focused AC coverage)
- ~250-350 lines of test code

### Risks
- `PermissionRevocationSimulator.simulateRevocationDuringStream` uses `setTimeout(..., 0)` for triggering — tests should use appropriate async handling to avoid flakiness
- `InterruptibleStreamController` and `PartialResultTracker` are from test mocks, not production code — tests validate mock behavior as proxy for production behavior

## Related ADRs
- ADR-048: Mid-Stream Permission Revocation Tests
- ADR-048: Permission Revocation Test Utilities
- ADR-049: Permission Revocation Cleanup Tests
- ADR-050: Graceful Degradation Permission Revocation Tests
- ADR-035: Claude Agent SDK Mock Utilities
