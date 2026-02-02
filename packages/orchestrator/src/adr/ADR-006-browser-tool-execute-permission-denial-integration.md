# ADR-006: BrowserTool.execute() Permission Denial Integration

## Status
**Accepted** | Date: 2026-02-02

## Context

The orchestrator's `BrowserTool.execute()` method (in `packages/orchestrator/src/tools/browser-tool.ts`) has three permission denial paths that currently return a bare `BrowserResult` with `success: false` but do **not**:

1. Create a `BrowserPermissionDeniedError` with structured context
2. Call `cleanup()` when browser resources have been launched
3. Emit a `permission:denied` event via `eventEmitter`

Meanwhile, the codebase already has all the building blocks:
- **`BrowserPermissionDeniedError`** class (imported at line 22)
- **`cleanup()`** method (lines 1573-1665)
- **`handlePermissionDeniedError()`** helper (lines 1714-1752) — but it **throws** instead of returning gracefully
- **`eventEmitter`** field with `setEventEmitter()` injection (lines 391, 423-425)
- **`PermissionDeniedEventData`** interface (index.ts lines 548-555)

The task is to integrate all three concerns into the three denial paths so they follow a consistent pattern.

## Decision

### Architecture: Introduce a Private Helper Method `handleDenialGracefully()`

Rather than modifying `handlePermissionDeniedError()` (which is designed to **throw** and has a `Promise<never>` return type used elsewhere), we introduce a new private method that **returns** a graceful `BrowserResult`:

```typescript
private async handleDenialGracefully(
  operation: BrowserOperation,
  target: string,
  denialReason: string,
  startTime: number,
  permissionType?: BrowserPermissionDeniedContext['permissionType']
): Promise<BrowserResult>
```

This method encapsulates the three-step denial pattern:

1. **Create `BrowserPermissionDeniedError`** with full context (operation, target, denialReason, permissionType, sessionId)
2. **Call `cleanup()` conditionally** — only if `resourceState.browserActive` indicates browser was launched
3. **Emit `permission:denied` event** via `eventEmitter` with `PermissionDeniedEventData`
4. **Return** a graceful `BrowserResult` with `success: false` and error details from the error object

### Three Denial Paths in `execute()`

All three denial paths in the `execute()` method (lines 451-538) will be refactored to call `handleDenialGracefully()`:

#### Path 1: Permission Check Denial (line 465)
```
if (!permissionResult.allowed) → handleDenialGracefully(...)
```
- `denialReason`: from `permissionResult.denialReason` or default message
- `permissionType`: `'unknown'` (general permission policy denial)

#### Path 2: Configuration Restrictions (line 481)
```
if (!configCheck.allowed) → handleDenialGracefully(...)
```
- `denialReason`: from `configCheck.reason`
- `permissionType`: mapped from operation type:
  - `navigate` with domain reason → `'domain'`
  - `evaluate` → `'javascript'`
  - `submit` → `'form'`
  - default → `'unknown'`

#### Path 3: Dangerous Operations (line 497)
```
if (dangerCheck.isDangerous && !permissionResult.level) → handleDenialGracefully(...)
```
- `denialReason`: `Dangerous operation requires explicit permission: ${dangerCheck.reason}`
- `permissionType`: mapped from operation type (same mapping as Path 2)

### Catch Block Enhancement (line 526)

The existing catch block will be enhanced to detect `BrowserPermissionDeniedError` specifically:

```typescript
catch (error) {
  if (error instanceof BrowserPermissionDeniedError) {
    // Already handled by handleDenialGracefully if it originated there,
    // but can also come from executeOperation() -> handlePermissionDeniedError()
    return {
      success: false,
      operation,
      error: error.getUserFriendlyMessage(),
      metadata: {
        url: this.getCurrentUrl(),
        executionTime: Date.now() - startTime,
        permissionGranted: false,
        target: error.browserContext.target,
      },
    };
  }
  // existing generic error handling...
}
```

## Detailed Design

### `handleDenialGracefully()` Implementation Specification

```typescript
private async handleDenialGracefully(
  operation: BrowserOperation,
  target: string,
  denialReason: string,
  startTime: number,
  permissionType?: BrowserPermissionDeniedContext['permissionType']
): Promise<BrowserResult> {
  // Step 1: Create structured error (NOT thrown — used for context extraction)
  const error = new BrowserPermissionDeniedError(
    `Browser permission denied: ${denialReason}`,
    {
      operation,
      target,
      denialReason,
      permissionType,
      sessionId: this.sessionId,
    }
  );

  // Step 2: Cleanup if browser was launched
  if (this.resourceState.browserActive) {
    try {
      await this.cleanup();
    } catch (cleanupError) {
      // Log but don't fail — we still want to return gracefully
      // The cleanup failure is secondary to the permission denial
    }
  }

  // Step 3: Emit permission:denied event
  this.eventEmitter?.emit('permission:denied', {
    requestId: this.sessionId,
    tool: 'Browser',
    scope: `${operation}:${target}`,
    deniedBy: 'browser-tool',
    timestamp: new Date(),
    reason: denialReason,
  } satisfies PermissionDeniedEventData);

  // Step 4: Return graceful BrowserResult
  return {
    success: false,
    operation,
    error: error.getUserFriendlyMessage(),
    metadata: {
      url: this.getCurrentUrl(),
      executionTime: Date.now() - startTime,
      permissionGranted: false,
      target,
    },
  };
}
```

### Permission Type Mapping Helper

```typescript
private mapOperationToPermissionType(
  operation: BrowserOperation,
  reason?: string
): BrowserPermissionDeniedContext['permissionType'] {
  switch (operation) {
    case 'navigate':
      return reason?.includes('domain') ? 'domain' : 'unknown';
    case 'evaluate':
      return 'javascript';
    case 'submit':
      return 'form';
    case 'screenshot':
      return 'unknown';
    default:
      return 'unknown';
  }
}
```

### Import Requirements

The file already imports `BrowserPermissionDeniedError`. Additional imports needed:
- `PermissionDeniedEventData` from `../index.js` (for `satisfies` type check)
- `BrowserPermissionDeniedContext` from `@apex/core` (already available via existing import)

### Event Data Contract

The `permission:denied` event emitted from BrowserTool matches the `PermissionDeniedEventData` interface:

```typescript
interface PermissionDeniedEventData {
  requestId: string;    // → sessionId (unique per browser session)
  tool: string;         // → 'Browser'
  scope?: string;       // → 'operation:target' (e.g., 'navigate:https://evil.com')
  deniedBy: string;     // → 'browser-tool' (identifies source of denial)
  timestamp: Date;      // → new Date()
  reason: string;       // → denialReason string
}
```

## Consequences

### Positive
- **Consistent pattern**: All three denial paths follow identical cleanup + event + graceful-return flow
- **No breaking changes**: `handlePermissionDeniedError()` (which throws) is preserved for use by `executeOperation()` internals
- **Observable**: `permission:denied` events flow through the existing event infrastructure to CLI/API/WebSocket consumers
- **Resource-safe**: Browser resources are cleaned up on denial, preventing leaks
- **Testable**: Each concern (error creation, cleanup, event emission, result) can be verified independently

### Negative
- Slight code duplication between `handleDenialGracefully()` and `handlePermissionDeniedError()` — acceptable because they have fundamentally different contracts (return vs throw)

### Risks
- `cleanup()` can throw `ApexError(BROWSER_RESOURCE_LEAK)` — the catch block in `handleDenialGracefully` swallows this, which is intentional (permission denial is the primary concern, resource leak is secondary and logged)
- `eventEmitter` may be null (not injected) — handled via optional chaining (`?.emit`)

## File Impact

| File | Change Type | Description |
|------|------------|-------------|
| `packages/orchestrator/src/tools/browser-tool.ts` | **Modified** | Add `handleDenialGracefully()`, `mapOperationToPermissionType()`, refactor 3 denial paths in `execute()`, enhance catch block |
| `packages/orchestrator/src/tools/browser-tool.ts` | **Import** | Add `PermissionDeniedEventData` import |

## Test Strategy (for testing stage)

1. **Unit tests** for `handleDenialGracefully()`:
   - Verify `BrowserPermissionDeniedError` is created with correct context
   - Verify `cleanup()` is called when `resourceState.browserActive === true`
   - Verify `cleanup()` is NOT called when `resourceState.browserActive === false`
   - Verify `permission:denied` event is emitted with correct `PermissionDeniedEventData`
   - Verify graceful `BrowserResult` is returned with `success: false`

2. **Integration tests** for each denial path:
   - Permission check denial → full pattern executed
   - Config restriction denial → full pattern executed
   - Dangerous operation denial → full pattern executed

3. **Catch block** test:
   - `BrowserPermissionDeniedError` thrown during `executeOperation()` → caught gracefully
   - Other errors → existing behavior preserved

4. **Edge cases**:
   - `eventEmitter` is null → no crash
   - `cleanup()` throws → swallowed, still returns graceful result
   - Multiple sequential denials → each emits its own event

## Relationship to Existing Code

- **`handlePermissionDeniedError()`** (lines 1714-1752): **Preserved as-is**. It is used when operations need to throw (e.g., deep in `executeOperation()` call stack). Our new method is for the `execute()` top-level denial paths that should return gracefully.
- **`cleanup()`** (lines 1573-1665): Called conditionally based on `resourceState.browserActive`.
- **Core `BrowserTool`** (`packages/core/src/tools/browser/browser-tool.ts`): Has its own similar pattern in `executeImpl()` — this ADR only covers the orchestrator implementation.
- **hooks.ts** (line 280-288): Already emits `permission:denied` at the hook level. The BrowserTool emissions complement this at the tool level.
