# ADR-048: Mid-Stream Permission Revocation Test Architecture

## Status
Accepted

## Date
2025-01-29

## Context

The APEX orchestrator processes Claude SDK streaming responses via an async `for await` loop in `executeStage()`. During this loop, tool calls are made by the agent, and each tool call goes through the `PermissionManager` for permission checks. Currently, there are no tests verifying what happens when a permission is revoked **mid-stream** — i.e., while an active session is processing the async iterable from `query()`.

This is a critical gap because:
1. An admin or user could revoke a tool permission while a task is actively running
2. In-flight tool calls that had been previously authorized should be denied after revocation
3. Partial results from a stream that gets interrupted need proper handling
4. Data integrity must be maintained (task store, checkpoints, audit logs) even during interruption

## Decision

### Test Architecture

We will create a comprehensive test suite at:
```
packages/orchestrator/src/__tests__/mid-stream-permission-revocation.test.ts
```

The test suite will use the existing `MockClaudeAgentSDK` infrastructure with `StreamingResponseBuilder` to simulate multi-event streaming sessions where permission revocation occurs between events.

### Key Design Decisions

#### 1. Test Approach: Unit + Integration (No E2E)

We use unit tests with the existing mock infrastructure rather than end-to-end tests because:
- The `MockClaudeAgentSDK` already supports streaming with delays between events
- The `PermissionManager` and `PermissionStore` can be instantiated with real SQLite (temp dirs)
- This gives us deterministic control over exactly when revocation happens relative to stream events

#### 2. Permission Revocation Simulation Strategy

The `MockClaudeAgentSDK` supports `DynamicResponseHandler` and `StreamingEvent[]` with configurable delays. We will:

- Set up a streaming response with multiple tool_use events separated by delays
- Use the delay windows to trigger `PermissionManager.revokePermission()` concurrently
- Verify that subsequent tool permission checks in the orchestrator's processing loop reflect the revocation

The key insight: The orchestrator's `for await` loop processes events sequentially. Between processing events, other async operations (like permission revocation from an API call) can interleave. The streaming mock's `delay` property creates these interleaving windows.

#### 3. Test Helper: `PermissionRevocationController`

A new test helper class that coordinates permission revocation timing:

```typescript
interface PermissionRevocationController {
  // Schedule a revocation to happen after N stream events are processed
  revokeAfterEvents(tool: string, eventCount: number): void;

  // Notify controller that an event was processed (called from mock hooks)
  notifyEventProcessed(): void;

  // Get the revocation audit trail
  getRevocationLog(): RevocationLogEntry[];
}
```

This controller is wired into the mock SDK's dynamic handler to track event processing and trigger revocations at precise moments.

#### 4. Partial Result Handling Verification

When a permission is revoked mid-stream:
- Tool results received **before** revocation should be preserved in `ToolExecution` records
- Tool calls attempted **after** revocation should fail with `denialReason: 'Tool access is explicitly denied'`
- The task should not be marked as `completed` if critical tools were denied
- The task store should have accurate audit logs showing the revocation event

#### 5. Data Corruption Prevention Verification

We verify no corruption by checking:
- SQLite task store integrity after mid-stream interruption (all WAL transactions committed)
- `activeToolExecutions` map properly cleaned up
- Event emissions are ordered correctly (no `tool:end` without `tool:start`)
- Checkpoint data is consistent if session was interrupted

### Test Scenarios

| # | Scenario | What It Tests |
|---|----------|---------------|
| 1 | Permission revoked between tool calls | Active session detects revocation on next `checkToolPermission()` call |
| 2 | Revoke all tools for an agent mid-stream | Session encounters denial, task transitions to appropriate error state |
| 3 | Revoke during multi-tool streaming | First tool succeeds, second tool (post-revocation) fails, partial results preserved |
| 4 | Revoke allow-always → deny transition | Persistent permission change reflected immediately in-session |
| 5 | Concurrent revocation during tool execution | Tool execution in progress continues, but next tool attempt is denied |
| 6 | Revocation with checkpoint integrity | Checkpoint saved after revocation reflects correct state |
| 7 | Session cache invalidation on revoke | `resetSession()` and `revokePermission()` properly clear cached allow-always entries |
| 8 | Event ordering during revocation | `permission:denied` event emitted correctly, `tool:start`/`tool:end` pairs maintained |
| 9 | Graceful termination after revocation | Stream processing stops cleanly, no dangling promises or unhandled rejections |
| 10 | Multiple sequential revocations | Revoking permissions one by one during stream, each correctly detected |

### File Structure

```
packages/orchestrator/src/__tests__/
├── mid-stream-permission-revocation.test.ts          # Main test suite (10 scenarios)
├── helpers/
│   └── permission-revocation-controller.ts           # Test helper for coordinating revocations
└── docs/
    └── ADR-048-mid-stream-permission-revocation-tests.md  # This document
```

### Dependencies on Existing Infrastructure

| Component | File | Usage |
|-----------|------|-------|
| `MockClaudeAgentSDK` | `__tests__/mocks/claude-agent-sdk.ts` | Streaming mock with delays |
| `StreamingResponseBuilder` | `__tests__/mocks/claude-agent-sdk.ts` | Building multi-event streams |
| `PermissionManager` | `permission-manager.ts` | Real permission management with revocation |
| `PermissionStore` | `permission-store.ts` | Real SQLite store (temp dir) |
| `PermissionChangeEvent` | `@apexcli/core` types | Event type verification |
| Test utilities | `core/src/test-fixtures/test-utils.ts` | `waitFor()`, `createDeferredPromise()` |

### Interface Contracts

#### PermissionRevocationController (New Test Helper)

```typescript
// packages/orchestrator/src/__tests__/helpers/permission-revocation-controller.ts

import { PermissionManager } from '../../permission-manager';

export interface RevocationLogEntry {
  tool: string;
  scope?: string;
  timestamp: Date;
  eventIndex: number;       // Which stream event triggered this
  wasRevoked: boolean;      // Whether revocation actually removed a permission
}

export interface RevocationSchedule {
  tool: string;
  scope?: string;
  afterEventIndex: number;  // Revoke after this many events processed
}

export class PermissionRevocationController {
  private schedules: RevocationSchedule[] = [];
  private log: RevocationLogEntry[] = [];
  private eventCount = 0;
  private manager: PermissionManager;

  constructor(manager: PermissionManager) {
    this.manager = manager;
  }

  /** Schedule a permission revocation after N stream events */
  scheduleRevocation(tool: string, afterEventIndex: number, scope?: string): this {
    this.schedules.push({ tool, scope, afterEventIndex });
    return this;
  }

  /** Called by test hooks when a stream event is processed */
  async notifyEventProcessed(): Promise<void> {
    this.eventCount++;

    const pendingRevocations = this.schedules.filter(
      s => s.afterEventIndex === this.eventCount
    );

    for (const schedule of pendingRevocations) {
      const wasRevoked = await this.manager.revokePermission(
        schedule.tool,
        schedule.scope
      );

      this.log.push({
        tool: schedule.tool,
        scope: schedule.scope,
        timestamp: new Date(),
        eventIndex: this.eventCount,
        wasRevoked,
      });
    }
  }

  /** Get the full revocation audit trail */
  getRevocationLog(): RevocationLogEntry[] {
    return [...this.log];
  }

  /** Reset for re-use between tests */
  reset(): void {
    this.schedules = [];
    this.log = [];
    this.eventCount = 0;
  }
}
```

#### Test Setup Pattern

```typescript
// Typical test setup pattern
describe('Mid-stream permission revocation', () => {
  let mockSDK: MockClaudeAgentSDK;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let revocationController: PermissionRevocationController;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-midstream-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
    revocationController = new PermissionRevocationController(permissionManager);

    mockSDK = new MockClaudeAgentSDK();
  });

  afterEach(() => {
    permissionStore.close();
    rmSync(testDir, { recursive: true, force: true });
    revocationController.reset();
    mockSDK.reset();
  });
});
```

## Consequences

### Positive
- Comprehensive coverage of a critical security boundary (permission enforcement during active sessions)
- Reuses existing mock infrastructure — no new production code changes needed
- Deterministic testing through controlled delays and event counts
- Clear audit trail for debugging test failures

### Negative
- Tests with delays can be slower; mitigated by using short delays (10-50ms)
- Complex coordination between mock SDK and permission manager requires careful setup
- The `PermissionRevocationController` adds test infrastructure maintenance burden

### Risks
- The orchestrator currently does NOT actively check permissions between stream events (it relies on the SDK's `permissionMode: 'acceptEdits'`). The test suite may reveal that additional permission checking hooks need to be added to the production code in the `for await` loop. This is a **finding to surface during implementation**, not a blocker for the test architecture.

## Related
- `packages/orchestrator/src/permission-manager.ts` — `revokePermission()` method
- `packages/core/src/types.ts` — `PermissionChangeEvent`, `PermissionChangeType`
- `packages/orchestrator/src/docs/ADR-037-permissions-integration-tests-architecture.md` — prior permission test architecture
- `packages/orchestrator/src/__tests__/mocks/claude-agent-sdk.ts` — mock infrastructure
