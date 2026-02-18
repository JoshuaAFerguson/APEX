# ADR-070: Active Claude SDK Session Permission Revocation Detection - Technical Design

## Status
Accepted

## Date
2025-02-02

## Context

The task requires implementing tests for active Claude SDK session permission revocation detection mid-stream. After thorough analysis, the existing codebase already has a **comprehensive, mature test infrastructure** covering this exact scenario across three test suites with extensive mock and helper infrastructure.

### Existing Infrastructure Assessment

| Component | File | Status |
|-----------|------|--------|
| **Mid-stream revocation tests** | `__tests__/mid-stream-permission-revocation.test.ts` | 10 scenarios, fully implemented |
| **Comprehensive edge cases** | `__tests__/permission-revocation-comprehensive.test.ts` | Edge cases, multi-dependency, recovery, performance |
| **Graceful degradation tests** | `__tests__/permission-revocation-graceful-degradation.test.ts` | 4 acceptance criteria verified |
| **Revocation controller helper** | `__tests__/helpers/permission-revocation-controller.ts` | `PermissionRevocationController` class |
| **Revocation mock utilities** | `__tests__/mocks/permission-revocation.ts` | `PermissionRevokedError`, `InterruptibleStreamController`, `PartialResultTracker`, `PermissionRevocationSimulator` |
| **Revocation mock types** | `__tests__/mocks/permission-revocation.types.ts` | `RevocationConfig`, `RevocationSimulationResult`, `TrackedToolCall` |
| **ADR-048** | `docs/ADR-048-mid-stream-permission-revocation-tests.md` | Original architectural decision |
| **ADR-050** | `docs/ADR-050-graceful-degradation-permission-revocation-tests.md` | Graceful degradation design |

## Decision

### Architecture Validation: Existing Design Is Complete

After analyzing the acceptance criteria against the existing implementation, all three acceptance criteria are **already fully satisfied**:

#### AC1: Permission revocation is detected during active streaming ✅

**Coverage in `mid-stream-permission-revocation.test.ts`:**
- **Scenario 1**: Permission revoked between tool calls — validates `hasPermission()` returns `false` after revocation point
- **Scenario 5**: Concurrent revocation during tool execution — validates detection even when revocation happens during in-flight operations
- **Integration tests**: Mock SDK streaming with `StreamingResponseBuilder` + `PermissionRevocationController` — validates real-time detection within `for await` loop processing

**Coverage in `permission-revocation-graceful-degradation.test.ts`:**
- **AC1 suite**: 6 tests covering graceful handling, non-fatal errors, partial result preservation, stream completion, re-granting, and multi-tool revocation at different points

**Technical mechanism**: The `PermissionRevocationController.notifyEventProcessed()` method executes revocations at precise event indices within the async stream loop. Each subsequent `hasPermission()` or `checkToolPermission()` call reflects the revoked state.

#### AC2: Detection triggers appropriate event/callback ✅

**Coverage in `mid-stream-permission-revocation.test.ts`:**
- **Scenario 8**: `onRevocation` callback invoked in correct order — validates that registered callbacks receive `RevocationLogEntry` with tool name, event index, and timestamp
- **Scenario 4**: `allow-always` to `deny` transition — validates `checkToolPermission()` returns `{ allowed: false, level: 'deny', denialReason: '...' }`
- **Scenario 9**: Graceful termination — validates no unhandled errors after revocation

**Coverage in `permission-revocation-comprehensive.test.ts`:**
- **Event propagation suite**: Tests `permission-revoked`, `permission-revocation-detailed` events with full payload validation
- **Error handling**: Event listener crash resilience, memory leak prevention

**Coverage in `permission-revocation-graceful-degradation.test.ts`:**
- **AC3 suite**: `permission:revoked`, `permission:denied`, `permission:granted` event emission with timestamp, metadata, and correlation IDs

**Technical mechanism**: Two callback/event patterns exist:
1. `PermissionRevocationController.onRevocation(callback)` — synchronous test-level callbacks
2. `EventEmitter` patterns with typed `PermissionEvent` interfaces — application-level event propagation

#### AC3: Detection works for various permission types ✅

**Permission types covered across test suites:**

| Permission Type | Test Coverage |
|----------------|---------------|
| `allow-always` | Scenarios 1-10 in mid-stream; AC2, AC4 in graceful degradation |
| `allow-once` | Scenario 7 (session cache invalidation); AC2 cleanup tests |
| `deny` (explicit) | Scenario 4, 9 (allow-always → deny transition) |
| Scoped permissions | Scenario 7 (`scope-a`, `scope-b`); AC2 (`/src`, `/tmp`, `/project/src`) |
| Unscoped permissions | Scenarios 1-6, 8-10 (default `undefined` scope) |
| Non-existent permissions | Scenario 9 (`NonExistentTool`); comprehensive edge cases |
| Multiple tools | Scenario 2 (5 tools), Scenario 10 (progressive narrowing) |
| Role-based scoping | Comprehensive tests (`role:Admin`, `role:User`, `role:Guest`) |

**Tool types covered**: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Delete`, `Create`, `Move`, `Copy`, `Search`, `Find`, `Execute`, and dynamic tool names (`Tool0`-`Tool9`, `PerfTool0`-`PerfTool999`)

### Architecture Patterns

#### 1. Layered Test Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Test Suites                                                     │
│  ├── mid-stream-permission-revocation.test.ts (Core scenarios)   │
│  ├── permission-revocation-comprehensive.test.ts (Edge cases)    │
│  └── permission-revocation-graceful-degradation.test.ts (ACs)    │
├─────────────────────────────────────────────────────────────────┤
│  Test Helpers                                                     │
│  ├── PermissionRevocationController (event-indexed scheduling)   │
│  └── PermissionRevocationSimulator (stream interruption)         │
├─────────────────────────────────────────────────────────────────┤
│  Mock Infrastructure                                              │
│  ├── MockClaudeAgentSDK (streaming + delays)                     │
│  ├── StreamingResponseBuilder (fluent event builder)             │
│  ├── InterruptibleStreamController (AbortController pattern)     │
│  ├── PartialResultTracker (pre-interruption event capture)       │
│  └── PermissionRevokedError (typed error with code property)     │
├─────────────────────────────────────────────────────────────────┤
│  Production Code                                                  │
│  ├── PermissionManager (session cache + persistent store)        │
│  └── PermissionStore (SQLite WAL mode)                           │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Deterministic Revocation Timing

The `PermissionRevocationController` uses an event-counting model:

```
Stream:   [event₁] → [event₂] → [event₃] → [event₄] → [event₅]
                            ↑
              scheduleRevocation('Write', 2)
              → revokePermission('Write') called here
              → all subsequent hasPermission('Write') return false
```

This avoids timing-dependent tests by tying revocation to discrete event indices rather than wall-clock time.

#### 3. Dual Interruption Patterns

1. **Soft interruption** (via `PermissionRevocationController`): Stream continues but permission checks fail — used for testing orchestrator-level behavior where the stream loop checks permissions between events.

2. **Hard interruption** (via `PermissionRevocationSimulator`): Stream is forcefully interrupted with `PermissionRevokedError` — used for testing error handling and partial result preservation when the stream itself is terminated.

#### 4. Key Interfaces

```typescript
// Revocation scheduling (test helper)
interface RevocationSchedule {
  tool: string;
  scope?: string;
  afterEventIndex: number;
  setDeny?: boolean;  // Optional: also set explicit deny
}

// Revocation audit trail (test assertions)
interface RevocationLogEntry {
  tool: string;
  scope?: string;
  timestamp: Date;
  eventIndex: number;
  wasRevoked: boolean;
}

// Stream interruption config (mock infrastructure)
interface RevocationConfig {
  events: StreamingEvent[];
  revokeAfterEvents?: number;
  revokeAfterDelayMs?: number;
  revokeOnToolUse?: string;
  revocationReason?: string;
}

// Application-level event (orchestrator integration)
interface PermissionEvent {
  type: 'permission:revoked' | 'permission:denied' | 'permission:granted';
  tool: string;
  scope?: string;
  timestamp: Date;
  metadata?: { taskId?: string; sessionId?: string; reason?: string };
}
```

### Test Matrix Summary

| Test Suite | Tests | AC1 | AC2 | AC3 |
|-----------|-------|-----|-----|-----|
| `mid-stream-permission-revocation.test.ts` | 17 | ✅ | ✅ | ✅ |
| `permission-revocation-comprehensive.test.ts` | 11 | ✅ | ✅ | ✅ |
| `permission-revocation-graceful-degradation.test.ts` | 23 | ✅ | ✅ | ✅ |
| **Total** | **51** | | | |

### Quality Attributes

1. **Determinism**: Event-indexed revocation avoids flaky timing-dependent tests
2. **Isolation**: Each test uses isolated temp directories with real SQLite databases
3. **Cleanup**: `afterEach` hooks close DB connections and remove temp dirs
4. **Composability**: `StreamingResponseBuilder` fluent API enables rapid test scenario construction
5. **Auditability**: `RevocationLogEntry` trail enables precise assertion about revocation timing and success

## Consequences

### Positive
- All three acceptance criteria are comprehensively covered with 51+ tests
- Layered architecture separates concerns: test scenarios, helpers, mocks, and production code
- Deterministic timing model prevents flaky tests
- Real SQLite databases ensure persistence behavior matches production
- Extensive permission type coverage ensures no type-specific regressions

### Negative
- Large test surface area (51+ tests) increases CI time
- Three separate test files require coordination to avoid redundant coverage

### Risks
- None identified — existing infrastructure is stable and well-documented

## Notes for Next Stages (Developer/Tester)

1. **All implementation is complete** — the three test suites, helper, and mock infrastructure already exist and implement all acceptance criteria
2. **Verification required**: Run `npm run test` to confirm all 51+ tests pass in the current branch
3. **No new production code needed** — the `PermissionManager.revokePermission()` method and `PermissionStore.clearPermission()` already support mid-stream revocation correctly
4. **Build verification required**: Run `npm run build` to confirm no TypeScript errors
5. If any tests fail, investigate whether it's due to recent changes in the permission system or mock infrastructure

## Related ADRs
- ADR-048: Mid-Stream Permission Revocation Test Architecture (original design)
- ADR-050: Graceful Degradation Permission Revocation Tests
- ADR-049: Permission Revocation Cleanup Tests
- ADR-052: Permission Code Paths Test Coverage Map
