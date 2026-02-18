# ADR-007: BrowserTool.execute() Permission Denial Implementation Design

## Status
**Ready for Implementation** | Date: 2026-02-05

## Context

This document provides the implementation-level technical design for integrating `BrowserPermissionDeniedError`, `cleanup()`, and `permission:denied` event emission into `BrowserTool.execute()` permission denial paths, as specified in ADR-006.

## Current State Analysis

### Existing Infrastructure

The orchestrator's `BrowserTool` (`packages/orchestrator/src/tools/browser-tool.ts`) already has:

1. **`BrowserPermissionDeniedError`** - imported from `@apexcli/core` (line 22-26)
2. **`cleanup()`** method - lines 1573-1665, handles resource cleanup gracefully
3. **`handlePermissionDeniedError()`** - lines 1714-1752, **throws** (used for internal errors)
4. **`eventEmitter`** - field with `setEventEmitter()` injection (line 391, lines 423-425)
5. **`resourceState`** - tracks `browserActive`, `contextActive`, `pageActive` (line 392)
6. **`sessionId`** - unique identifier per browser session (line 393)

### Three Denial Paths in `execute()` (lines 451-538)

| Path | Line | Current Behavior | What's Missing |
|------|------|------------------|----------------|
| Permission Check | 465 | Returns bare `{success: false}` | No error object, no cleanup, no event |
| Config Restriction | 481 | Returns bare `{success: false}` | No error object, no cleanup, no event |
| Dangerous Operation | 497 | Returns bare `{success: false}` | No error object, no cleanup, no event |

### `PermissionDeniedEventData` Interface (index.ts, lines 549-556)

```typescript
interface PermissionDeniedEventData {
  requestId: string;    // → sessionId
  tool: string;         // → 'Browser'
  scope?: string;       // → 'operation:target'
  deniedBy: string;     // → 'browser-tool'
  timestamp: Date;
  reason: string;       // → denialReason
}
```

## Implementation Design

### 1. New Import Statement

Add to line 26 area:
```typescript
import { PermissionDeniedEventData } from '../index.js';
import type { BrowserPermissionDeniedContext } from '@apexcli/core';
```

### 2. New Private Method: `handleDenialGracefully()`

Insert after `handlePermissionDeniedError()` (around line 1753):

```typescript
/**
 * Handle permission denial gracefully without throwing
 *
 * This method:
 * 1. Creates a BrowserPermissionDeniedError for structured context
 * 2. Calls cleanup() if browser resources were launched
 * 3. Emits permission:denied event via eventEmitter
 * 4. Returns a graceful BrowserResult with success: false
 *
 * @param operation - The browser operation that was denied
 * @param target - The target URL, selector, or identifier
 * @param denialReason - Human-readable reason for denial
 * @param startTime - Operation start timestamp for execution time calculation
 * @param permissionType - The type of permission that was denied
 * @returns BrowserResult with success: false and error details
 */
private async handleDenialGracefully(
  operation: BrowserOperation,
  target: string,
  denialReason: string,
  startTime: number,
  permissionType?: BrowserPermissionDeniedContext['permissionType']
): Promise<BrowserResult> {
  // Step 1: Create structured error (NOT thrown — used for context and message)
  const error = new BrowserPermissionDeniedError(
    `Browser permission denied: ${denialReason}`,
    {
      operation,
      target,
      denialReason,
      permissionType: permissionType ?? 'unknown',
      sessionId: this.sessionId,
    }
  );

  // Step 2: Cleanup if browser was launched
  if (this.resourceState.browserActive) {
    try {
      await this.cleanup();
    } catch (cleanupError) {
      // Log but don't fail — permission denial is the primary concern
      console.warn(
        `Cleanup failed during permission denial handling:`,
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
      );
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

### 3. New Private Method: `mapOperationToPermissionType()`

Insert after `handleDenialGracefully()`:

```typescript
/**
 * Map browser operation to permission type for error context
 *
 * @param operation - The browser operation
 * @param reason - Optional denial reason (used to detect domain-specific denials)
 * @returns The appropriate permission type
 */
private mapOperationToPermissionType(
  operation: BrowserOperation,
  reason?: string
): BrowserPermissionDeniedContext['permissionType'] {
  switch (operation) {
    case 'navigate':
      // Check if reason indicates domain restriction
      if (reason?.toLowerCase().includes('domain')) {
        return 'domain';
      }
      return 'unknown';
    case 'evaluate':
      return 'javascript';
    case 'submit':
      return 'form';
    case 'screenshot':
    case 'compareScreenshot':
      return 'storage'; // Screenshots require storage permission
    default:
      return 'unknown';
  }
}
```

### 4. Refactor `execute()` Method

#### Path 1: Permission Check Denial (lines 465-477)

**Current:**
```typescript
if (!permissionResult.allowed) {
  return {
    success: false,
    operation,
    error: permissionResult.denialReason || 'Operation denied by permission policy',
    metadata: {
      url: this.getCurrentUrl(),
      executionTime: Date.now() - startTime,
      permissionGranted: false,
      target,
    },
  };
}
```

**New:**
```typescript
if (!permissionResult.allowed) {
  const denialReason = permissionResult.denialReason || 'Operation denied by permission policy';
  return this.handleDenialGracefully(
    operation,
    target,
    denialReason,
    startTime,
    'unknown'
  );
}
```

#### Path 2: Configuration Restrictions (lines 480-493)

**Current:**
```typescript
if (!configCheck.allowed) {
  return {
    success: false,
    operation,
    error: configCheck.reason,
    metadata: {
      url: this.getCurrentUrl(),
      executionTime: Date.now() - startTime,
      permissionGranted: false,
      target,
    },
  };
}
```

**New:**
```typescript
if (!configCheck.allowed) {
  const denialReason = configCheck.reason || 'Operation blocked by configuration';
  const permissionType = this.mapOperationToPermissionType(operation, denialReason);
  return this.handleDenialGracefully(
    operation,
    target,
    denialReason,
    startTime,
    permissionType
  );
}
```

#### Path 3: Dangerous Operations (lines 496-509)

**Current:**
```typescript
if (dangerCheck.isDangerous && !permissionResult.level) {
  return {
    success: false,
    operation,
    error: `Dangerous operation requires explicit permission: ${dangerCheck.reason}`,
    metadata: {
      url: this.getCurrentUrl(),
      executionTime: Date.now() - startTime,
      permissionGranted: false,
      target,
    },
  };
}
```

**New:**
```typescript
if (dangerCheck.isDangerous && !permissionResult.level) {
  const denialReason = `Dangerous operation requires explicit permission: ${dangerCheck.reason}`;
  const permissionType = this.mapOperationToPermissionType(operation, dangerCheck.reason);
  return this.handleDenialGracefully(
    operation,
    target,
    denialReason,
    startTime,
    permissionType
  );
}
```

### 5. Enhance Catch Block (lines 526-537)

**Current:**
```typescript
} catch (error) {
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
```

**New:**
```typescript
} catch (error) {
  // Handle BrowserPermissionDeniedError specifically (from executeOperation internals)
  if (error instanceof BrowserPermissionDeniedError) {
    // Cleanup if browser was launched
    if (this.resourceState.browserActive) {
      try {
        await this.cleanup();
      } catch (cleanupError) {
        console.warn(
          `Cleanup failed during BrowserPermissionDeniedError handling:`,
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        );
      }
    }

    // Emit permission:denied event
    this.eventEmitter?.emit('permission:denied', {
      requestId: this.sessionId,
      tool: 'Browser',
      scope: `${operation}:${error.browserContext.target || target}`,
      deniedBy: 'browser-tool',
      timestamp: new Date(),
      reason: error.browserContext.denialReason || error.message,
    } satisfies PermissionDeniedEventData);

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

  // Generic error handling (preserve existing behavior)
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
```

## Sequence Diagrams

### Permission Denial Flow

```
User → execute(params)
      │
      ├─ checkPermissionInternal()
      │   └─ if !allowed → handleDenialGracefully()
      │                    │
      │                    ├─ new BrowserPermissionDeniedError(...)
      │                    ├─ if browserActive → cleanup()
      │                    ├─ eventEmitter.emit('permission:denied', {...})
      │                    └─ return {success: false, error: friendlyMessage, ...}
      │
      ├─ checkConfigurationRestrictions()
      │   └─ if !allowed → handleDenialGracefully()
      │
      ├─ checkDangerousOperation()
      │   └─ if dangerous && !level → handleDenialGracefully()
      │
      └─ executeOperation()
          │
          └─ catch (BrowserPermissionDeniedError)
              │
              ├─ if browserActive → cleanup()
              ├─ eventEmitter.emit('permission:denied', {...})
              └─ return {success: false, ...}
```

## Acceptance Criteria Mapping

| Acceptance Criteria | Implementation |
|---------------------|----------------|
| (1) BrowserPermissionDeniedError created with context | `handleDenialGracefully()` step 1 |
| (2) cleanup() called if browser launched | `handleDenialGracefully()` step 2 (conditional on `resourceState.browserActive`) |
| (3) permission:denied event emitted | `handleDenialGracefully()` step 3 via `eventEmitter?.emit()` |
| (4) Graceful BrowserResult returned | `handleDenialGracefully()` step 4 |
| (5) All three denial paths follow pattern | Paths 1, 2, 3 all call `handleDenialGracefully()` |
| (6) Catch block handles BrowserPermissionDeniedError | Enhanced catch block with specific handling |

## Edge Cases and Safety

1. **`eventEmitter` is null**: Optional chaining (`?.emit`) prevents crash
2. **`cleanup()` throws**: Caught and logged, does not prevent graceful return
3. **Multiple sequential denials**: Each triggers independent event emission
4. **Browser not launched yet**: `resourceState.browserActive` check skips cleanup
5. **`target` extraction fails**: Falls back to `'unknown'` in `extractTarget()`

## Test Requirements (for Testing Stage)

### Unit Tests

1. `handleDenialGracefully()`:
   - Creates error with correct context
   - Calls cleanup when `browserActive === true`
   - Skips cleanup when `browserActive === false`
   - Emits event with correct `PermissionDeniedEventData`
   - Returns correct `BrowserResult` shape

2. `mapOperationToPermissionType()`:
   - Returns `'domain'` for navigate with domain reason
   - Returns `'javascript'` for evaluate
   - Returns `'form'` for submit
   - Returns `'unknown'` for other operations

### Integration Tests

1. Permission check denial path
2. Config restriction denial path
3. Dangerous operation denial path
4. Catch block handling of `BrowserPermissionDeniedError`

### Edge Case Tests

1. Null eventEmitter
2. cleanup() throwing error
3. Multiple sequential denials

## Dependencies

No new external dependencies required. All infrastructure exists:
- `BrowserPermissionDeniedError` (already imported)
- `cleanup()` (existing method)
- `eventEmitter` (existing field)
- `PermissionDeniedEventData` (existing interface in index.ts)

## File Changes Summary

| File | Change Type |
|------|-------------|
| `packages/orchestrator/src/tools/browser-tool.ts` | Add imports, add 2 methods, refactor 3 paths, enhance catch block |

## Risks

| Risk | Mitigation |
|------|------------|
| `cleanup()` timeout | `cleanup()` already has internal timeout handling |
| Event emission failure | Optional chaining, event is non-blocking |
| Breaking existing tests | Tests should pass; behavior is refined, not changed |
