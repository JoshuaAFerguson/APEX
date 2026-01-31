# ADR-052: Permission Denial and Error Handling Test Architecture

## Status
Accepted

## Context

The APEX platform has a comprehensive permission system spanning multiple packages:
- **@apex/core**: `BrowserPermissionDeniedError`, `ApexError`, type definitions (`Permission`, `PermissionLevel`, `PermissionQuery`)
- **@apex/orchestrator**: `PermissionManager` (session caching, permission checks), `PermissionStore` (SQLite persistence), `PermissionPresetManager`
- **Mock infrastructure**: `PermissionRevocationSimulator`, `InterruptibleStreamController`, `PartialResultTracker`, `PermissionRevokedError`

While there are existing tests for individual components (error class construction, store CRUD, preset management), there is a gap in **comprehensive permission denial and error handling tests** that verify:
1. Proper error messages when permissions are denied
2. Graceful degradation across the stack
3. Permission revocation mid-operation scenarios
4. User prompt cancellation handling
5. Error propagation and sanitization through layers

## Decision

### Test Architecture Overview

We will create a structured test suite organized into **4 test categories** across **2 packages**, following the existing test patterns (Vitest, `.test.ts` suffix, `describe`/`test` blocks).

### Test File Structure

```
packages/
├── core/src/__tests__/
│   ├── permission-denial-error-messages.test.ts      # Category 1: Error message validation
│   └── permission-denial-graceful-degradation.test.ts # Category 2: Graceful degradation
├── orchestrator/src/__tests__/
│   ├── permission-denial-scenarios.test.ts            # Category 3: Denial flow scenarios
│   └── permission-revocation-cancellation.test.ts     # Category 4: Revocation & cancellation
```

### Category 1: Error Message Validation (`core`)

**File**: `packages/core/src/__tests__/permission-denial-error-messages.test.ts`

**Purpose**: Verify that all permission denial paths produce correct, user-friendly, sanitized error messages.

**Test Groups**:

1. **BrowserPermissionDeniedError message formatting** (9 permission types)
   - Each permission type (`geolocation`, `camera`, `microphone`, `notifications`, `clipboard`, `storage`, `domain`, `javascript`, `form`) produces correct `getUserFriendlyMessage()` output
   - Default/unknown permission type produces generic message
   - Enhanced messages with operation + target + reason are properly composed
   - Messages with partial context (only operation, only target, etc.)

2. **Resolution suggestions per permission type**
   - Each permission type returns relevant, non-empty suggestions
   - Unknown types include denial reason in suggestions
   - Suggestions are actionable strings (not empty/null)

3. **Error sanitization for permission errors**
   - `sanitizeErrorMessage()` strips sensitive paths from permission error messages
   - `toSafeErrorResponse()` uses the generic "Browser permission denied" message for `BROWSER_PERMISSION_DENIED` code
   - Credential patterns are redacted in combined error messages

4. **Factory method error messages**
   - `fromBrowserPermissionError()` produces correct message format
   - `forDomainRestriction()` includes domain in message
   - `forDisabledFeature()` maps feature names to correct permission types
   - `toBrowserPermissionDeniedError()` preserves original message when wrapping non-permission errors

**Estimated tests**: ~35

### Category 2: Graceful Degradation (`core`)

**File**: `packages/core/src/__tests__/permission-denial-graceful-degradation.test.ts`

**Purpose**: Verify that permission denials result in graceful degradation rather than crashes or undefined behavior.

**Test Groups**:

1. **Type guard reliability**
   - `isBrowserPermissionDeniedError()` returns `true` for instances
   - Returns `false` for plain `Error`, `ApexError`, other subtypes, `null`, `undefined`, strings
   - Works correctly after `Object.setPrototypeOf` in constructor

2. **Error chain preservation**
   - Permission errors with `cause` maintain full error chain via `getDetails()`
   - Nested causes (permission error wrapping network error wrapping IO error) are traversable
   - `toString(includeStack: true)` includes cause chain

3. **Error context propagation**
   - `ApexErrorContext` fields (taskId, agentId, stage, operation, sessionId) survive through `BrowserPermissionDeniedError` constructor
   - Context is accessible via both `.context` and `.browserContext`
   - Zod validation in `ApexErrorContextSchema.parse()` doesn't reject valid contexts

4. **Safe error serialization**
   - `toJSON()` produces valid JSON without circular references
   - `getDetails()` returns all expected fields
   - Permission errors with undefined/null context fields serialize safely
   - `toSafeErrorResponse()` never exposes stack traces or internal paths

5. **Error code classification**
   - `isCode(ApexErrorCode.BROWSER_PERMISSION_DENIED)` returns `true`
   - `isCategory('APEX_18')` returns `true` for browser errors
   - Permission errors are distinguishable from other ApexError types

**Estimated tests**: ~25

### Category 3: Permission Denial Flow Scenarios (`orchestrator`)

**File**: `packages/orchestrator/src/__tests__/permission-denial-scenarios.test.ts`

**Purpose**: Verify end-to-end permission denial behavior through PermissionManager.

**Test Groups**:

1. **Explicit deny level**
   - `checkPermission()` returns `'deny'` after `grantPermission(tool, scope, 'deny')`
   - `hasPermission()` returns `false` for denied tools
   - `checkToolPermission()` returns `{ allowed: false, denialReason: 'Tool access is explicitly denied' }`

2. **No permission set (null level)**
   - `checkPermission()` returns `null` for unknown tools
   - `checkToolPermission()` with `requireConfirmation: true` config returns `{ allowed: false, requiresConfirmation: true }`
   - Default behavior (no config, no permission) allows access

3. **Allow-once consumption and expiry**
   - First `checkPermission()` returns `'allow-once'` and consumes it
   - Second `checkPermission()` for same tool/scope returns `null` (consumed)
   - `hasPermission()` returns `false` after consumption

4. **Permission revocation**
   - `revokePermission()` removes from session cache
   - `revokePermission()` removes from persistent store
   - `revokePermission()` returns `true` when permission existed, `false` when not
   - After revocation, `checkPermission()` returns `null`
   - After revocation, `hasPermission()` returns `false`

5. **Directory access denial**
   - `checkDirectoryAccess()` with blocklist pattern denies matching paths
   - `checkDirectoryAccess()` with empty allowlist and `defaultAllow: false` denies all paths
   - `checkToolPermission()` with path validation failure overrides tool-level allow
   - Denial reason includes path-specific message

6. **Tool disabled via config**
   - `checkToolPermission()` returns `{ allowed: false, denialReason: 'Tool is disabled via configuration' }` when tool config has `enabled: false`

7. **Session reset behavior**
   - `resetSession()` clears session cache, directory access cache, and tool config cache
   - After reset, previously cached allow-once permissions are gone
   - Persistent store permissions survive reset

**Estimated tests**: ~30

**Dependencies**: Requires SQLite (better-sqlite3) for PermissionStore. Use temp directories for test isolation.

### Category 4: Permission Revocation and User Cancellation (`orchestrator`)

**File**: `packages/orchestrator/src/__tests__/permission-revocation-cancellation.test.ts`

**Purpose**: Verify mid-stream permission revocation and user prompt cancellation scenarios using the existing mock infrastructure.

**Test Groups**:

1. **PermissionRevokedError behavior**
   - Error has `code === 'PERMISSION_REVOKED'`
   - Error has `name === 'PermissionRevokedError'`
   - Default message is 'Permission revoked'
   - Custom reason is used as message

2. **InterruptibleStreamController**
   - `interrupted` starts as `false`
   - `interrupt()` sets `interrupted` to `true`
   - `interrupt(reason)` stores the reason
   - `reset()` clears interrupted state and reason
   - Multiple `interrupt()` calls don't throw

3. **PartialResultTracker**
   - `record()` accumulates events
   - `eventCount` reflects recorded events
   - `markInterrupted()` sets `wasInterrupted` to `true`
   - `getPartialText()` extracts text from text/assistant events
   - `getToolUseCalls()` extracts tool_use blocks
   - `getLastEvent()` returns most recent event
   - `reset()` clears all state

4. **PermissionRevocationSimulator - event-count trigger**
   - `simulateRevocationDuringStream({ revokeAfterEvents: N })` yields exactly N events then throws `PermissionRevokedError`
   - Tracker shows `wasInterrupted === true` and `eventCount === N`
   - Events after the trigger point are not yielded

5. **PermissionRevocationSimulator - tool-use trigger**
   - `simulateRevocationDuringStream({ revokeOnToolUse: 'dangerous_tool' })` throws when that tool is encountered
   - Tracker captures events before the trigger
   - Events with non-matching tool names are yielded normally

6. **PermissionRevocationSimulator - delay trigger**
   - `simulateRevocationDuringStream({ revokeAfterDelayMs: 50 })` eventually interrupts
   - Some events are yielded before the delay triggers

7. **User prompt cancellation simulation**
   - Simulate user declining permission prompt by granting `'deny'` level
   - Simulate user closing prompt (timeout) by leaving no permission set
   - After cancellation, subsequent tool calls are blocked
   - After cancellation, partial results from before cancellation are preserved

8. **Graceful stream cleanup on revocation**
   - After `PermissionRevokedError`, stream is no longer iterable
   - Controller `reset()` allows creating new streams
   - Tracker preserves partial results for error reporting

**Estimated tests**: ~35

### Cross-Cutting Concerns

#### Test Isolation
- Each test file creates its own temp directory for SQLite databases
- `afterEach` hooks clean up temp files and reset mocks
- No shared mutable state between test suites

#### Test Data Patterns
- Use factory functions from `packages/core/src/test-fixtures/` for consistent test data
- Permission types tested: all 9 browser permission types + 'unknown'
- Tool names tested: representative set covering browser, filesystem, shell tools

#### Error Message Contracts
The following error messages are **contractual** (tested and relied upon):
- `'Tool access is explicitly denied'` - from `checkToolPermission()` on deny level
- `'Tool requires user confirmation before execution'` - from `checkToolPermission()` with `requireConfirmation`
- `'Tool is disabled via configuration'` - from `checkToolPermission()` with `enabled: false`
- `'Directory access denied: <reason>'` - from path validation failure
- `'Permission revoked'` - default `PermissionRevokedError` message
- `'Browser permission denied'` - safe error response for `BROWSER_PERMISSION_DENIED`

### Dependencies Between Test Categories

```
Category 1 (error messages) ──> no dependencies
Category 2 (degradation)    ──> no dependencies
Category 3 (denial flows)   ──> depends on PermissionStore (SQLite)
Category 4 (revocation)     ──> depends on mock infrastructure (permission-revocation.ts)
```

Categories 1 and 2 are pure unit tests with no external dependencies.
Categories 3 and 4 require test infrastructure but are self-contained.

## Consequences

### Positive
- Comprehensive coverage of all permission denial paths ensures consistent user experience
- Error message contracts prevent regressions in user-facing messages
- Revocation tests ensure mid-operation safety
- Graceful degradation tests ensure the system never crashes on permission denials

### Negative
- ~125 new tests add to test suite execution time (mitigated by fast Vitest runner)
- SQLite tests in Category 3 require filesystem access (mitigated by temp directories)

### Risks
- Mock infrastructure (`PermissionRevocationSimulator`) uses `setTimeout` which can cause flaky tests under CI load - mitigate with generous timeouts and retry strategies
