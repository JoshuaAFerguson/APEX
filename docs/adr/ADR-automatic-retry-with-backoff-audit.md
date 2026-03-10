# ADR: Automatic Retries with Backoff Architecture Audit

**Status**: Verified
**Date**: 2026-03-08
**Author**: Architecture Agent

## Context

This document audits the automatic retries with exponential backoff implementation in APEX. The feature allows failed tasks to be automatically retried with configurable delays that increase exponentially to prevent overwhelming external services.

## Acceptance Criteria Verification

| Criteria | Status | Evidence |
|----------|--------|----------|
| `retryCount` field exists on Task type | ✅ PASS | `packages/core/src/types.ts:4766` - `retryCount: number` |
| `maxRetries` field exists on Task type | ✅ PASS | `packages/core/src/types.ts:4767` - `maxRetries: number` |
| Exponential backoff calculation implemented | ✅ PASS | `packages/orchestrator/src/index.ts:2532-2533` |
| Failed tasks are automatically retried | ✅ PASS | `packages/orchestrator/src/index.ts:2529-2716` |
| Retry-related tests pass | ✅ PASS | Task lifecycle and store tests pass |

## Technical Design

### 1. Task Type Definition

```typescript
// packages/core/src/types.ts (lines 4753-4829)
export interface Task {
  id: string;
  // ... other fields
  retryCount: number;      // Current retry attempt (0 = first attempt)
  maxRetries: number;      // Maximum allowed retries (default: 3)
  resumeAttempts: number;  // Separate tracking for pause/resume
  // ... other fields
}
```

### 2. LimitsConfig Schema

```typescript
// packages/core/src/types.ts (lines 2190-2201)
export const LimitsConfigSchema = z.object({
  maxRetries: z.number().optional().default(3),
  retryDelayMs: z.number().optional().default(1000),
  retryBackoffFactor: z.number().optional().default(2),
  // ... other fields
});
```

### 3. Automatic Retry Logic in Orchestrator

The `executeTask` method in `packages/orchestrator/src/index.ts` implements the retry loop:

```typescript
// packages/orchestrator/src/index.ts (lines 2522-2716)
const autoRetry = options?.autoRetry ?? true;
const maxRetries = task.maxRetries;
const retryDelayMs = this.effectiveConfig.limits.retryDelayMs;
const backoffFactor = this.effectiveConfig.limits.retryBackoffFactor;

for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    if (attempt > 0) {
      // Calculate backoff delay: retryDelayMs * (backoffFactor ^ (attempt - 1))
      const delay = retryDelayMs * Math.pow(backoffFactor, attempt - 1);
      await this.sleep(delay);

      // Update retry count
      await this.store.updateTask(taskId, {
        retryCount: attempt,
        updatedAt: new Date(),
      });

      // Log retry attempt
      await this.store.addLog(taskId, {
        level: 'info',
        message: `Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`,
      });
    }

    const shouldComplete = await this.runWorkflow(task, workflow);
    // ... success handling
  } catch (error) {
    // Check if we should retry
    const canRetry = autoRetry && attempt < maxRetries && this.isRetryableError(lastError);
    // ... retry or fail handling
  }
}
```

### 4. Exponential Backoff Calculation

The exponential backoff formula is:

```
delay = retryDelayMs × (backoffFactor ^ (attempt - 1))
```

With defaults:
- `retryDelayMs = 1000ms` (1 second)
- `backoffFactor = 2`
- `maxRetries = 3`

Example progression:
- Attempt 1: `1000 × 2^0 = 1000ms` (1 second)
- Attempt 2: `1000 × 2^1 = 2000ms` (2 seconds)
- Attempt 3: `1000 × 2^2 = 4000ms` (4 seconds)

### 5. Retryable Error Detection

```typescript
// packages/orchestrator/src/index.ts (lines 2728-2754)
private isRetryableError(error: Error): boolean {
  const nonRetryablePatterns = [
    'Task not found',
    'Workflow not found',
    'exceeded budget',
    'cancelled',
    'Invalid',
    'token limit',
    'context length',
    'rate limit exceeded',
    'authentication',
    'unauthorized',
    'forbidden',
    'usage limit',
    // ... more patterns
  ];

  return !nonRetryablePatterns.some(pattern =>
    error.message.toLowerCase().includes(pattern.toLowerCase())
  );
}
```

### 6. ExponentialBackoffReconnector Class

For connection-level retries (WebSocket, MCP), a dedicated class exists:

```typescript
// packages/core/src/exponential-backoff.ts
export class ExponentialBackoffReconnector extends EventEmitter<ExponentialBackoffEvents> {
  constructor(config: Partial<ExponentialBackoffConfig> = {});

  calculateDelay(attempt: number): number;  // Exponential delay with jitter
  scheduleReconnect(connectFn: () => Promise<void>): void;
  notifyConnected(): void;
  notifyConnectionFailed(error: string): void;
  notifyDisconnected(error?: string): void;
  getStats(): ReconnectionStats;
  reset(): void;
  destroy(): void;
}
```

Features:
- Configurable jitter strategies: `'none' | 'full' | 'equal' | 'decorrelated'`
- State machine: `'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'`
- Event-driven: `state:changed`, `reconnect:attempt`, `reconnect:success`, `reconnect:failure`, `reconnect:exhausted`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Task Execution Layer                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────────────────────┐ │
│  │ executeTask │───▶│ Retry Loop       │───▶│ runWorkflow                │ │
│  │             │    │ (0..maxRetries)  │    │                            │ │
│  └─────────────┘    └────────┬─────────┘    └────────────────────────────┘ │
│                              │                                              │
│                              ▼                                              │
│                     ┌────────────────┐                                      │
│                     │ On Failure:    │                                      │
│                     │                │                                      │
│                     │ 1. Check if    │                                      │
│                     │    retryable   │                                      │
│                     │                │                                      │
│                     │ 2. Calculate   │                                      │
│                     │    backoff     │                                      │
│                     │    delay       │                                      │
│                     │                │                                      │
│                     │ 3. Sleep       │                                      │
│                     │                │                                      │
│                     │ 4. Update      │                                      │
│                     │    retryCount  │                                      │
│                     │                │                                      │
│                     │ 5. Log attempt │                                      │
│                     │                │                                      │
│                     │ 6. Retry       │                                      │
│                     └────────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         Connection Retry Layer                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │              ExponentialBackoffReconnector                             │ │
│  │                                                                        │ │
│  │  State Machine:                                                        │ │
│  │  ┌──────┐      ┌────────────┐      ┌───────────┐      ┌──────────┐   │ │
│  │  │ idle │─────▶│ connecting │─────▶│ connected │─────▶│ idle     │   │ │
│  │  └──────┘      └─────┬──────┘      └───────────┘      └──────────┘   │ │
│  │                      │ fail                                           │ │
│  │                      ▼                                                │ │
│  │              ┌──────────────┐                                         │ │
│  │              │ reconnecting │◀───────────────────────────────────────┐│ │
│  │              └──────┬───────┘                                        ││ │
│  │                     │                                                ││ │
│  │         ┌───────────┴───────────┐                                    ││ │
│  │         ▼                       ▼                                    ││ │
│  │  ┌───────────┐          ┌──────────┐                                ││ │
│  │  │ connected │          │  retry   │────────────────────────────────┘│ │
│  │  └───────────┘          │  (delay) │                                 │ │
│  │                         └────┬─────┘                                 │ │
│  │                              │ maxRetries exceeded                   │ │
│  │                              ▼                                        │ │
│  │                       ┌──────────┐                                    │ │
│  │                       │  failed  │                                    │ │
│  │                       └──────────┘                                    │ │
│  │                                                                        │ │
│  │  Jitter Strategies:                                                   │ │
│  │  - none: delay = baseDelay × factor^(attempt-1)                       │ │
│  │  - full: delay = random(0, cappedDelay)                               │ │
│  │  - equal: delay = cappedDelay×0.5 + random(0, cappedDelay×0.5)        │ │
│  │  - decorrelated: AWS-style decorrelated jitter                        │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Test Coverage

### Passing Tests

| Test Suite | Tests | Status |
|------------|-------|--------|
| Task Retry Tracking (store.test.ts) | 4 | ✅ Pass |
| isRetryableError (index.test.ts) | 2 | ✅ Pass |
| autoRetry=false option (index.test.ts) | 1 | ✅ Pass |
| Task failure and retry workflow (task-lifecycle) | 1 | ✅ Pass |
| ExponentialBackoffReconnector (exponential-backoff.test.ts) | 31 | ✅ Pass |
| Retry Command Tests (retry-command-verification.test.ts) | Multiple | ✅ Pass |

### Test Evidence

1. **Store Tests** - `packages/orchestrator/src/store.test.ts`:
   - `should create task with retry fields`
   - `should update retry count`
   - `should default retryCount to 0 and maxRetries to 3`
   - `should track failed task with retry count`

2. **Orchestrator Tests** - `packages/orchestrator/src/index.test.ts`:
   - `should identify non-retryable errors`
   - `should identify retryable errors`
   - `should respect autoRetry=false option`

3. **Lifecycle Tests** - `packages/orchestrator/src/__tests__/task-lifecycle-integration.test.ts`:
   - `should handle task failure and retry workflow`

## Build Verification

```bash
$ npm run build
# All packages compile successfully
Tasks:    7 successful, 7 total
Cached:   7 cached, 7 total
Time:     1.614s >>> FULL TURBO
```

## Consequences

### Positive
- **Resilience**: Transient failures are automatically recovered
- **Configurable**: Per-task `maxRetries`, global `retryDelayMs` and `backoffFactor`
- **Observable**: Retry attempts are logged with timing information
- **Smart Detection**: Non-retryable errors (auth, validation) are not retried
- **Connection Level**: Separate `ExponentialBackoffReconnector` for WebSocket/MCP

### Negative
- **Delay Accumulation**: Long-running retries can accumulate significant delays
- **No Per-Error Backoff**: All retryable errors use the same backoff schedule

### Neutral
- Retry logic is synchronous within the execution loop
- Store updates are atomic per-attempt

## Related ADRs

- [ADR-0015: Exponential Backoff Reconnector](./ADR-0015-exponential-backoff-reconnector.md)
- [ADR: APEX Retry Command Architecture](../architecture/ADR-retry-command.md)

## Conclusion

The automatic retries with exponential backoff implementation is **fully compliant** with all acceptance criteria:

1. ✅ **retryCount field exists** - Defined in Task interface and persisted in SQLite
2. ✅ **maxRetries field exists** - Defined in Task interface with default of 3
3. ✅ **Exponential backoff calculation** - Formula: `delay = retryDelayMs × backoffFactor^(attempt-1)`
4. ✅ **Failed tasks automatically retried** - Implemented in executeTask loop with isRetryableError check
5. ✅ **Retry-related tests pass** - All relevant test suites pass

---
**Architecture Verification**: 2026-03-09
**Tests Verified**:
- ExponentialBackoffReconnector: 31/31 pass
- Store retry tests: 4/4 pass
- Retry command verification: 22/22 pass
**Build Status**: ✅ PASS (7 packages, all successful)
