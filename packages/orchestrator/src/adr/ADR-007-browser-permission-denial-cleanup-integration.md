# ADR-007: Browser Permission Denial + Cleanup + Error Class Integration

## Status
**Proposed** | Date: 2026-02-05

## Context

This ADR builds upon ADR-006 to provide the complete architecture for integrating permission denial with cleanup and the `BrowserPermissionDeniedError` class in the orchestrator's `browser-tool.ts`. The goal is to prevent process crashes by ensuring graceful handling of all permission denial scenarios.

### Current State Analysis

The codebase has most of the building blocks in place:

1. **BrowserPermissionDeniedError class** (`packages/core/src/tools/browser/browser-permission-denied-error.ts`):
   - Already exported from `@apexcli/core`
   - Already imported in orchestrator's `browser-tool.ts` (line 22)
   - Has `getUserFriendlyMessage()`, `getResolutionSuggestions()`, and `browserContext`
   - Properly extends `ApexError` with `BROWSER_PERMISSION_DENIED` code

2. **cleanup() method** (lines 1573-1665):
   - Gracefully closes console stream, page, context, and browser
   - Handles both Playwright and Puppeteer backends
   - Updates `resourceState` tracking
   - Swallows individual resource cleanup errors with console.warn

3. **handlePermissionDeniedError()** (lines 1714-1752):
   - Calls `cleanup()` before throwing
   - Throws `BrowserPermissionDeniedError` with full context
   - **Issue**: Returns `Promise<never>` (throws), not suitable for graceful returns

4. **eventEmitter** (lines 391, 423-425):
   - Optional field with `setEventEmitter()` injection
   - Used for visual comparison events
   - NOT currently used for permission:denied events in execute()

5. **Three Denial Paths in execute()** (lines 451-538):
   - **Path 1** (line 465): `!permissionResult.allowed` → returns bare error string
   - **Path 2** (line 481): `!configCheck.allowed` → returns bare error string
   - **Path 3** (line 497): `dangerCheck.isDangerous && !permissionResult.level` → returns bare error string

### Problem Statement

The three denial paths in `execute()`:
1. ❌ Do NOT create `BrowserPermissionDeniedError` with structured context
2. ❌ Do NOT call `cleanup()` when browser resources have been launched
3. ❌ Do NOT emit `permission:denied` event via `eventEmitter`
4. ✅ DO return graceful `BrowserResult` with `success: false` (no crashes)

## Decision

### Architecture: Introduce `handleDenialGracefully()` Helper

Rather than modifying `handlePermissionDeniedError()` (which is designed to throw), introduce a new private method that **returns** a graceful `BrowserResult`:

```typescript
private async handleDenialGracefully(
  operation: BrowserOperation,
  target: string,
  denialReason: string,
  startTime: number,
  permissionType?: BrowserPermissionDeniedContext['permissionType']
): Promise<BrowserResult>
```

This method implements a four-step pattern:
1. **Create** `BrowserPermissionDeniedError` with full context (for error extraction, not thrown)
2. **Cleanup** browser resources conditionally (if `resourceState.browserActive`)
3. **Emit** `permission:denied` event via `eventEmitter`
4. **Return** graceful `BrowserResult` with `success: false`

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BrowserTool.execute()                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐ │
│  │ Permission Check │   │ Config Restrict. │   │ Dangerous Op Check      │ │
│  │ (!allowed)       │   │ (!allowed)       │   │ (isDangerous && !level) │ │
│  └────────┬─────────┘   └────────┬─────────┘   └────────────┬────────────┘ │
│           │                      │                          │               │
│           └──────────────────────┼──────────────────────────┘               │
│                                  ▼                                          │
│              ┌───────────────────────────────────────────┐                  │
│              │      handleDenialGracefully()             │                  │
│              ├───────────────────────────────────────────┤                  │
│              │ 1. Create BrowserPermissionDeniedError    │                  │
│              │ 2. if (browserActive) cleanup()           │                  │
│              │ 3. emit('permission:denied', {...})       │                  │
│              │ 4. return BrowserResult {success: false}  │                  │
│              └───────────────────────────────────────────┘                  │
│                                  │                                          │
│                                  ▼                                          │
│              ┌───────────────────────────────────────────┐                  │
│              │           Graceful Return                 │                  │
│              │  - No exceptions thrown                   │                  │
│              │  - No process crashes                     │                  │
│              │  - Resources cleaned up                   │                  │
│              │  - Events emitted for observability       │                  │
│              └───────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Event Flow Diagram

```
Permission Denied Flow:
══════════════════════

Agent/Orchestrator
      │
      ▼
┌─────────────────┐
│ BrowserTool     │
│ .execute()      │
└────────┬────────┘
         │ denial detected
         ▼
┌─────────────────────────────────────┐
│ handleDenialGracefully()            │
│ ┌─────────────────────────────────┐ │
│ │ 1. new BrowserPermissionDenied  │ │
│ │    Error(message, context)      │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 2. if (browserActive)           │ │
│ │    await this.cleanup()         │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 3. eventEmitter?.emit(          │ │
│ │    'permission:denied', data)   │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 4. return BrowserResult         │ │
│ │    { success: false, ... }      │ │
│ └─────────────────────────────────┘ │
└────────────────────┬────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ EventEmitter    │    │ Caller receives │
│ 'permission:    │    │ BrowserResult   │
│  denied'        │    │ {success:false} │
└────────┬────────┘    └─────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ CLI    │ │ API    │
│ Handler│ │ WSS    │
└────────┘ └────────┘
```

## Detailed Design

### 1. New Method: `handleDenialGracefully()`

Location: `packages/orchestrator/src/tools/browser-tool.ts`

```typescript
/**
 * Handle permission denial with proper cleanup and event emission.
 * Returns a graceful BrowserResult instead of throwing.
 *
 * @param operation - The browser operation that was denied
 * @param target - The target (URL, selector, etc.) of the operation
 * @param denialReason - Human-readable reason for denial
 * @param startTime - Timestamp when execute() started (for timing)
 * @param permissionType - Type of permission denied (for context)
 * @returns BrowserResult with success: false
 */
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
      console.warn('Cleanup failed during permission denial handling:', cleanupError);
    }
  }

  // Step 3: Emit permission:denied event
  if (this.eventEmitter) {
    this.eventEmitter.emit('permission:denied', {
      requestId: this.sessionId,
      tool: 'Browser',
      scope: `${operation}:${target}`,
      deniedBy: 'browser-tool',
      timestamp: new Date(),
      reason: denialReason,
    });
  }

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

### 2. New Method: `mapOperationToPermissionType()`

```typescript
/**
 * Map browser operation to permission type for error context.
 *
 * @param operation - The browser operation
 * @param reason - Optional reason string to inspect for domain-related denials
 * @returns Appropriate permission type for error categorization
 */
private mapOperationToPermissionType(
  operation: BrowserOperation,
  reason?: string
): BrowserPermissionDeniedContext['permissionType'] {
  switch (operation) {
    case 'navigate':
      return reason?.toLowerCase().includes('domain') ? 'domain' : 'unknown';
    case 'evaluate':
      return 'javascript';
    case 'submit':
      return 'form';
    case 'screenshot':
    case 'compareScreenshot':
      return 'storage'; // Screenshots involve filesystem
    case 'click':
    case 'type':
    case 'hover':
    case 'scroll':
    case 'waitForSelector':
      return 'unknown'; // Interaction operations
    case 'getText':
    case 'getHtml':
    case 'getAttribute':
      return 'unknown'; // Data extraction operations
    default:
      return 'unknown';
  }
}
```

### 3. Refactored execute() Method

The three denial paths in `execute()` will be refactored:

```typescript
async execute(params: BrowserParams): Promise<BrowserResult> {
  const startTime = Date.now();
  const { operation } = params;
  this.consoleMessages = [];
  this.runtimeErrors = [];

  try {
    const target = this.extractTarget(params);
    const scope = this.buildScope(operation, target);

    // Path 1: Permission Check Denial
    const permissionResult = await this.checkPermissionInternal(operation, target);
    if (!permissionResult.allowed) {
      return this.handleDenialGracefully(
        operation,
        target,
        permissionResult.denialReason || 'Operation denied by permission policy',
        startTime,
        this.mapOperationToPermissionType(operation, permissionResult.denialReason)
      );
    }

    // Path 2: Configuration Restrictions Denial
    const configCheck = await this.checkConfigurationRestrictions(operation, params);
    if (!configCheck.allowed) {
      return this.handleDenialGracefully(
        operation,
        target,
        configCheck.reason || 'Operation denied by configuration',
        startTime,
        this.mapOperationToPermissionType(operation, configCheck.reason)
      );
    }

    // Path 3: Dangerous Operations Denial
    const dangerCheck = await this.checkDangerousOperation(operation, params);
    if (dangerCheck.isDangerous && !permissionResult.level) {
      return this.handleDenialGracefully(
        operation,
        target,
        `Dangerous operation requires explicit permission: ${dangerCheck.reason}`,
        startTime,
        this.mapOperationToPermissionType(operation, dangerCheck.reason)
      );
    }

    // Execute the actual operation
    const result = await this.executeOperation(params);

    return {
      ...result,
      metadata: {
        ...result.metadata,
        url: result.metadata?.url || this.getCurrentUrl() || '',
        executionTime: Date.now() - startTime,
        permissionGranted: true,
        permissionLevel: permissionResult.level || undefined,
        target,
      },
    };

  } catch (error) {
    // Enhanced catch block for BrowserPermissionDeniedError
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

    return {
      success: false,
      operation,
      error: this.formatError(error),
      metadata: {
        url: this.getCurrentUrl(),
        executionTime: Date.now() - startTime,
        permissionGranted: false,
      },
    };
  }
}
```

### 4. Import Requirements

Add import for `BrowserPermissionDeniedContext` (if not already available through existing imports):

```typescript
import {
  // ... existing imports ...
  BrowserPermissionDeniedError,
  BrowserPermissionDeniedContext,  // May need explicit import
} from '@apexcli/core';
```

### 5. PermissionDeniedEventData Contract

The `permission:denied` event data follows the established pattern used throughout the codebase:

```typescript
// Event data emitted by BrowserTool
{
  requestId: string;    // → this.sessionId (unique per browser session)
  tool: string;         // → 'Browser'
  scope: string;        // → 'operation:target' (e.g., 'navigate:https://blocked.com')
  deniedBy: string;     // → 'browser-tool' (identifies source of denial)
  timestamp: Date;      // → new Date()
  reason: string;       // → denialReason string
}
```

This matches the pattern used in:
- `packages/orchestrator/src/hooks.ts` (line 281)
- `packages/orchestrator/src/index.ts` (line 5532)
- Various test files confirming the contract

## Test Strategy

### Unit Tests for `handleDenialGracefully()`

File: `packages/orchestrator/src/tools/__tests__/browser-tool-permission-denial.test.ts`

1. **Error Creation Tests**:
   - Verify `BrowserPermissionDeniedError` is created with correct context
   - Verify `operation`, `target`, `denialReason`, `permissionType`, `sessionId` are set

2. **Cleanup Tests**:
   - Verify `cleanup()` is called when `resourceState.browserActive === true`
   - Verify `cleanup()` is NOT called when `resourceState.browserActive === false`
   - Verify cleanup errors are caught and logged, not thrown

3. **Event Emission Tests**:
   - Verify `permission:denied` event is emitted with correct data
   - Verify event is NOT emitted when `eventEmitter` is null
   - Verify `requestId`, `tool`, `scope`, `deniedBy`, `timestamp`, `reason` are set

4. **Return Value Tests**:
   - Verify `BrowserResult` has `success: false`
   - Verify `error` contains user-friendly message
   - Verify `metadata` contains correct timing and context

### Integration Tests for Denial Paths

File: `packages/orchestrator/src/tools/__tests__/browser-tool-denial-paths.integration.test.ts`

1. **Path 1 Integration**: Permission check denial
2. **Path 2 Integration**: Configuration restriction denial
3. **Path 3 Integration**: Dangerous operation denial
4. **All paths verify**: Error class + cleanup + event + graceful return

### Edge Case Tests

1. **eventEmitter is null**: No crash, graceful return
2. **cleanup() throws**: Error logged, still returns gracefully
3. **Multiple sequential denials**: Each emits its own event
4. **Denial after browser launch**: Cleanup actually closes browser
5. **Denial before browser launch**: Cleanup is skipped

## Consequences

### Positive

- **Consistent pattern**: All three denial paths follow identical handling flow
- **No breaking changes**: `handlePermissionDeniedError()` preserved for internal throws
- **Observable**: `permission:denied` events flow to CLI/API/WebSocket consumers
- **Resource-safe**: Browser resources cleaned up on denial, preventing leaks
- **Testable**: Each concern can be verified independently
- **No crashes**: All error paths return graceful `BrowserResult` objects

### Negative

- Code duplication between `handleDenialGracefully()` and `handlePermissionDeniedError()`
  - Acceptable: fundamentally different contracts (return vs throw)

### Risks

- `cleanup()` can throw `ApexError(BROWSER_RESOURCE_LEAK)`
  - Mitigation: Catch block in `handleDenialGracefully` logs and swallows
- `eventEmitter` may be null
  - Mitigation: Null check before emit

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/orchestrator/src/tools/browser-tool.ts` | Modified | Add `handleDenialGracefully()`, `mapOperationToPermissionType()`, refactor 3 denial paths |
| `packages/orchestrator/src/tools/__tests__/browser-tool-permission-denial.test.ts` | New | Unit tests for `handleDenialGracefully()` |
| `packages/orchestrator/src/tools/__tests__/browser-tool-denial-paths.integration.test.ts` | New | Integration tests for all denial paths |

## Acceptance Criteria Mapping

| Criteria | Implementation |
|----------|----------------|
| BrowserPermissionDeniedError thrown/returned | Created in `handleDenialGracefully()`, not thrown but used for context |
| cleanup() called to release resources | Called conditionally if `browserActive` |
| permission:denied event emitted | Emitted via `eventEmitter` with proper context |
| No unhandled exceptions or crashes | All paths return graceful `BrowserResult` |
| Integration tests verify full flow | Tests follow `browser-tool-error-handling.test.ts` patterns |
