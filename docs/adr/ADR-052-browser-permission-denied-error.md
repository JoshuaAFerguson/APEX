# ADR-052: Browser Permission Denied Error Handling Infrastructure

## Status
Accepted

## Date
2025-01-30

## Context

The APEX BrowserTool (in both `@apex/core` and `@apex/orchestrator`) currently handles permission denials by returning `{ success: false, error: '...' }` results. While functional, this approach has several issues:

1. **No dedicated error class**: Permission denials are indistinguishable from other operation failures (network errors, element not found, timeouts). Callers cannot programmatically differentiate a permission denial from a transient failure.

2. **No resource cleanup on denial**: When a permission is denied mid-operation, browser resources (pages, contexts, browser instances) may remain allocated. The orchestrator's `BrowserTool` lazily creates browser pages (`ensurePage()`) but has no corresponding cleanup path for permission denials.

3. **No state tracking**: There is no mechanism to track whether a browser tool instance is in a "denied" state, which could lead to repeated failed attempts against the same permission and resource leaks.

4. **Process crash risk**: Unhandled permission denial edge cases (e.g., permission revoked during an operation, or denial during browser launch) could theoretically propagate as uncaught exceptions.

The existing `ApexError` class (in `@apex/core/src/apex-error.ts`) provides a robust error hierarchy with error codes, context, and sanitization, but has no browser-permission-specific error code or subclass.

## Decision

### 1. New Error Code: `BROWSER_PERMISSION_DENIED`

Add a new error code to `ApexErrorCode` in the **Browser errors (1800-1899)** range:

```typescript
// Browser errors (1800-1899)
BROWSER_PERMISSION_DENIED = 'APEX_1800',
BROWSER_RESOURCE_LEAK = 'APEX_1801',
BROWSER_SESSION_INVALID = 'APEX_1802',
```

**Rationale**: Using the existing `ApexErrorCode` enum keeps the error taxonomy unified. A new 1800-range avoids conflicts with existing ranges (1000-1799).

### 2. `BrowserPermissionDeniedError` Class

Create a dedicated error class extending `ApexError`:

**Location**: `packages/core/src/errors/browser-permission-denied-error.ts`

```typescript
export class BrowserPermissionDeniedError extends ApexError {
  public readonly operation: BrowserOperation;
  public readonly target: string;
  public readonly deniedPermission: string;
  public readonly browserState: BrowserResourceState;

  constructor(options: {
    operation: BrowserOperation;
    target: string;
    deniedPermission: string;
    browserState: BrowserResourceState;
    context?: ApexErrorContext;
    cause?: Error;
  });
}
```

**Key properties**:
- `operation`: The browser operation that was denied (e.g., `'navigate'`, `'evaluate'`)
- `target`: The target of the operation (URL, selector, script hash)
- `deniedPermission`: The specific permission scope that was denied
- `browserState`: Snapshot of browser resource state at time of denial

**Rationale**: A dedicated class enables:
- `instanceof` checks for catch-block routing
- Type-safe access to denial-specific metadata
- Integration with the existing `isApexError()` / `isCode()` helpers
- Meaningful error messages with operation context

### 3. `BrowserResourceState` Interface

Define a state tracking interface:

**Location**: `packages/core/src/errors/browser-permission-denied-error.ts`

```typescript
export interface BrowserResourceState {
  hasActiveBrowser: boolean;
  hasActiveContext: boolean;
  hasActivePage: boolean;
  activeUrl: string | null;
  resourcesReleased: boolean;
  sessionId?: string;
}
```

**Rationale**: Capturing resource state at denial time provides diagnostics for debugging leaks and enables cleanup logic to make informed decisions.

### 4. Cleanup Methods in Orchestrator BrowserTool

Add cleanup infrastructure to `packages/orchestrator/src/tools/browser-tool.ts`:

```typescript
// New public methods
async cleanup(): Promise<void>;
async releaseResources(): Promise<BrowserResourceState>;

// New private methods
private async cleanupOnDenial(operation: BrowserOperation, target: string): Promise<void>;
private getBrowserResourceState(): BrowserResourceState;

// New state tracking
private _resourceState: BrowserResourceState;
private _isDenied: boolean = false;
```

**Cleanup flow on permission denial**:
1. Capture current `BrowserResourceState`
2. If console stream active, stop it gracefully
3. Close page (if open)
4. Close context (if open)
5. Close browser (if open and no other sessions)
6. Set `_isDenied = true` and `resourcesReleased = true`
7. Throw `BrowserPermissionDeniedError` with state snapshot

**Rationale**: The existing `BrowserTool` in orchestrator creates browser resources lazily via `ensurePage()` but never tears them down on denial. This creates a deterministic cleanup path.

### 5. Integration Points

#### 5.1 Error Code Registration in `ApexErrorCode`

**File**: `packages/core/src/apex-error.ts`
- Add `BROWSER_PERMISSION_DENIED = 'APEX_1800'` to the enum
- Add safe error message: `'Browser permission denied'`

#### 5.2 Export from `@apex/core`

**File**: `packages/core/src/index.ts`
- Add export for the new error module

#### 5.3 New Errors Directory

**Location**: `packages/core/src/errors/`
- `browser-permission-denied-error.ts` - Error class and resource state interface
- `index.ts` - Barrel export

This keeps specialized errors organized separately from the base `apex-error.ts`.

#### 5.4 Orchestrator BrowserTool Integration

**File**: `packages/orchestrator/src/tools/browser-tool.ts`
- Import `BrowserPermissionDeniedError`
- Modify `execute()` to throw `BrowserPermissionDeniedError` on denial (instead of returning `{ success: false }`)
- Add `cleanup()` and `releaseResources()` public methods
- Add `getBrowserResourceState()` private method
- Add `_isDenied` state flag to prevent operations after denial

#### 5.5 Test Fixtures

**File**: `packages/core/src/test-fixtures/errors/browser-errors.ts`
- Add browser permission error presets
- Add browser error scenarios
- Export from `packages/core/src/test-fixtures/errors/index.ts`

### 6. Error Handling Contract

The `execute()` method in `BrowserTool` will follow a **dual-signal** approach:

1. **Permission denials** -> throw `BrowserPermissionDeniedError` (exceptional, requires cleanup)
2. **Operation failures** -> return `{ success: false, error: '...' }` (normal flow)

This makes permission denials **catchable** and **distinguishable** from normal operational failures.

```typescript
// Consumer code pattern
try {
  const result = await browserTool.execute(params);
  if (!result.success) {
    // Normal operation failure (element not found, timeout, etc.)
    handleOperationFailure(result);
  }
} catch (error) {
  if (error instanceof BrowserPermissionDeniedError) {
    // Permission denied - resources already cleaned up
    handlePermissionDenial(error);
  }
  throw error; // Re-throw unexpected errors
}
```

## File Change Summary

| File | Change Type | Description |
|------|------------|-------------|
| `packages/core/src/apex-error.ts` | Modify | Add `BROWSER_PERMISSION_DENIED` (+ 2 more) error codes, safe message |
| `packages/core/src/errors/browser-permission-denied-error.ts` | Create | New `BrowserPermissionDeniedError` class, `BrowserResourceState` interface |
| `packages/core/src/errors/index.ts` | Create | Barrel exports for errors directory |
| `packages/core/src/index.ts` | Modify | Add export for errors module |
| `packages/core/src/test-fixtures/errors/browser-errors.ts` | Create | Browser error presets and fixtures |
| `packages/core/src/test-fixtures/errors/index.ts` | Modify | Add browser error exports |
| `packages/orchestrator/src/tools/browser-tool.ts` | Modify | Add cleanup methods, state tracking, throw on denial |
| `packages/core/src/__tests__/browser-permission-denied-error.test.ts` | Create | Unit tests for error class |
| `packages/orchestrator/src/__tests__/browser-tool-permission-denial.test.ts` | Create | Integration tests for denial handling |

## Consequences

### Positive
- Permission denials are programmatically distinguishable from other failures
- Browser resources are deterministically cleaned up on denial
- State tracking prevents resource leaks from repeated denied operations
- Error messages include operation-specific context for debugging
- Follows existing APEX error patterns (extends `ApexError`, uses `ApexErrorCode`)
- No process crashes from unhandled permission denial edge cases

### Negative
- Breaking change: `execute()` now throws on permission denial instead of returning `{ success: false }`
- Callers must add try-catch blocks (documented in error handling contract)
- Additional complexity in the BrowserTool class

### Risks
- The dual-signal approach (throw vs return) adds cognitive load. Mitigated by clear documentation and type safety.
- Cleanup on denial could fail if browser process is unresponsive. Mitigated by timeout-guarded cleanup with fallback to forced kill.

## Alternatives Considered

### A. Return `{ success: false, permissionDenied: true }`
Rejected: Does not enable `catch` block routing, no cleanup trigger, not type-safe.

### B. Use existing `ApexErrorCode.FILE_ACCESS_DENIED`
Rejected: Semantically incorrect for browser permissions. Browser permission denials have different metadata needs (operation, target, resource state).

### C. Add cleanup to BrowserManager only
Rejected: The orchestrator's `BrowserTool` owns the browser lifecycle in the agent context. Cleanup must happen at that level.
