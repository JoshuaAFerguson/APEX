# Code Review: MCP WebSocket Error Event Broadcasting Integration Test

## Review Date
March 14, 2026

## Files Reviewed
1. `packages/api/src/__tests__/mcp-install-error-websocket.integration.test.ts` ✅ PASS
2. `packages/api/src/__tests__/mcp-error-broadcasting.integration.test.ts` ❌ FAIL (1/10 tests failing)

## Test Results Summary
- **mcp-install-error-websocket.integration.test.ts**: 5/5 tests passing ✅
- **mcp-error-broadcasting.integration.test.ts**: 9/10 tests passing, 1 failing ❌
- **Build Status**: ✅ PASSING

---

## CRITICAL ISSUES

### Issue #1: Inconsistent Error Name Serialization - HIGH SEVERITY
**Location**: `packages/api/src/__tests__/mcp-error-broadcasting.integration.test.ts:67,333`
**Status**: BLOCKS TEST EXECUTION

**Problem**:
The `serializeMCPError()` function (line 67) hard-codes `name: 'MCPError'`:
```typescript
name: 'MCPError', // Always use MCPError as the name
```

But the test on line 333 expects the error code to be used as the name:
```typescript
name: 'WEBSOCKET_TEST',
```

**Impact**:
- Test "delivers MCP error events to connected WebSocket clients" fails (line 322)
- Assertion error: Expected `name: 'WEBSOCKET_TEST'` but received `name: 'MCPError'`

**Root Cause**:
The serialization function creates error objects with fixed name, while test data passes `code: 'WEBSOCKET_TEST'` expecting it to be used as the name.

**Required Fix**:
Decide on one approach:
1. Change serializeMCPError to: `name: error.code || 'MCPError'` (preserve code)
2. OR update test expectation to: `name: 'MCPError'` (match serializer)

Recommendation: Option 1 (preserve the code as name) for better error identification.

---

### Issue #2: JSON Serialization Loses Date Object Type - HIGH SEVERITY
**Location**: `packages/api/src/__tests__/mcp-error-broadcasting.integration.test.ts:92,327,344`
**Status**: CAUSES TEST ASSERTION FAILURE

**Problem**:
WebSocket broadcast uses `JSON.stringify()` which converts Date objects to ISO strings:
```typescript
const message = JSON.stringify(event);  // Line 92
// Result: timestamp becomes "2026-03-14T11:09:30.787Z"
```

But test expects Date objects:
```typescript
timestamp: expect.any(Date),      // Line 327
errorOccurredAt: expect.any(Date) // Line 344
```

**Actual Test Failure Output**:
```
Expected: timestamp: Any<Date>
Received: timestamp: "2026-03-14T11:09:30.787Z"

Expected: errorOccurredAt: Any<Date>
Received: errorOccurredAt: "2026-03-14T11:09:30.787Z"
```

**Root Cause**:
JSON serialization converts all Date objects to ISO 8601 strings. When `JSON.parse()` reads the message (line 319), dates remain as strings.

**Required Fix**:
Implement date deserialization in WebSocket message handler. Either:
1. Modify JSON parsing to reconstruct dates
2. Update test expectations to use `expect.any(String)` for stringified dates
3. Create a custom JSON parser that handles date reconstruction

Recommendation: Option 1 - Create a date-aware JSON parser in the broadcast/receive handlers.

---

## MEDIUM SEVERITY ISSUES

### Issue #3: Inconsistent MCP Error Event Structures - MEDIUM SEVERITY
**Location**: Two different test files with incompatible interfaces
**Status**: DESIGN ISSUE

**Problem**:
`mcp-install-error-websocket.integration.test.ts` (lines 31-52) defines:
```typescript
interface MCPInstallErrorEventData {
  serverId: string;
  stage: 'error';
  progress: number;
  message: string;
  error: {
    message: string;
    code?: string;
    stack?: string;
    recoverable?: boolean;
  };
  timestamp: Date;
}
```

While `mcp-error-broadcasting.integration.test.ts` (lines 18-35) defines:
```typescript
interface MCPErrorEventData {
  serverId: string;
  error: string;  // Different: string instead of object
  timestamp: Date;
  code?: string;
  category?: string;  // Different: no 'stage'
  recoverable?: boolean;
  recovery?: { canRetry, retryDelayMs?, attempt?, maxAttempts?, suggestions? };
}
```

**Incompatibilities**:
- Error object vs error string
- `stage` vs `category`
- Different recovery structures
- Different required/optional fields

**Impact**:
- Code duplication
- Confusion when implementing actual event handling
- Potential runtime mismatches

**Recommendation**:
Create unified interface in `@apexcli/core` types or shared test utilities:
```typescript
interface MCPErrorEventData {
  serverId: string;
  serverName?: string;
  stage?: 'error' | string;
  category?: string;
  progress?: number;
  message: string;
  error: {
    message: string;
    code?: string;
    name?: string;
    stack?: string;
    recoverable?: boolean;
    suggestedAction?: string;
  };
  recovery?: {
    canRetry: boolean;
    retryDelayMs?: number;
    attempt?: number;
    maxAttempts?: number;
    suggestions?: string[];
  };
  timestamp: Date;
}
```

---

### Issue #4: Error Handling in WebSocket Message Handler - MEDIUM SEVERITY
**Location**: `packages/api/src/__tests__/mcp-error-broadcasting.integration.test.ts:318-320`
**Status**: SILENT FAILURE POTENTIAL

**Problem**:
JSON parsing errors are only logged to console, no test failure:
```typescript
ws.on('message', (data) => {
  const event = JSON.parse(data.toString());  // Unguarded parse
  receivedEvents.push(event);  // May never execute if parse fails
});
```

If a malformed message is sent, the test continues without registering the failure.

**Recommendation**:
```typescript
ws.on('message', (data) => {
  try {
    const event = JSON.parse(data.toString());
    receivedEvents.push(event);
  } catch (error) {
    console.error('Failed to parse WebSocket message:', error);
    // Explicitly signal test failure
    receivedEvents.push({ error: true, parseError: error });
  }
});
```

---

### Issue #5: Excessive Code Duplication - MEDIUM SEVERITY
**Location**: `packages/api/src/__tests__/mcp-*.integration.test.ts`
**Status**: MAINTENANCE BURDEN

**Problem**:
Both test files (mcp-install-error-websocket and mcp-error-broadcasting) duplicate 80+ lines of code:
- `createTestServer()` functions (lines 54-126 vs 76-166) - nearly identical
- `connectWebSocketClient()` pattern repeated
- Client tracking maps
- Broadcast function logic
- WebSocket endpoint setup

**Example Duplication**:
```typescript
// In BOTH files (lines 102-117 in second file, 101-100 in first):
const clients = new Map<string, Set<{ socket: WebSocket }>>();
const broadcastedEvents: any[] = [];

function broadcast(taskId: string, event: any) {
  broadcastedEvents.push({ taskId, event });
  const taskClients = clients.get(taskId);
  if (taskClients) {
    const message = JSON.stringify(event);
    for (const client of taskClients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    }
  }
}
```

**Impact**:
- Maintenance burden (fix in two places)
- Risk of divergence
- Hard to add new shared features

**Recommendation**:
Extract to `packages/api/src/__tests__/test-utils/mcp-test-server.ts`:
```typescript
export async function createMCPTestServer(config: {
  eventType: string;
  taskId: string;
  eventHandler?: (event: any) => any;
}): Promise<TestServerContext>
```

---

## LOW SEVERITY ISSUES

### Issue #6: Missing Timeout Configuration on Async Tests - LOW SEVERITY
**Location**: Multiple tests in `mcp-error-broadcasting.integration.test.ts`
**Status**: POTENTIAL FLAKINESS

**Problem**:
Tests use manual setTimeout for timeout, no explicit Vitest timeout:
```typescript
it('test name', async () => {  // No timeout configuration
  await new Promise((resolve, reject) => {
    // ...
    setTimeout(() => reject(new Error('Timeout')), 5000);
  });
});
```

**Issues**:
- If setTimeout doesn't fire, test hangs
- Hard to find hanging tests in CI/CD
- No WebSocket cleanup guaranteed

**Recommendation**:
```typescript
it('delivers MCP error events to connected WebSocket clients', { timeout: 10000 }, async () => {
  // Always cleanup
  try {
    // test code
  } finally {
    ws?.close();
  }
});
```

---

### Issue #7: Incomplete Event Verification in Rapid Load Test - LOW SEVERITY
**Location**: `packages/api/src/__tests__/mcp-error-broadcasting.integration.test.ts:616-668`
**Status**: INSUFFICIENT VALIDATION

**Problem**:
Rapid event test only checks count, not ordering or integrity:
```typescript
if (receivedEvents.length === errorCount) {
  // Just checks length
  receivedEvents.forEach((event, index) => {
    expect(event.data.serverId).toBe(`rapid-test-${index}`);
  });
}
```

**Missing Validations**:
- Order consistency verification
- Duplicate detection
- Complete payload validation
- Timing distribution analysis

**Recommendation**:
```typescript
receivedEvents.forEach((event, index, arr) => {
  // Check ordering
  expect(event.data.serverId).toBe(`rapid-test-${index}`);
  // Check no duplicates
  const count = arr.filter(e => e.data.serverId === event.data.serverId).length;
  expect(count).toBe(1);
  // Check required fields
  expect(event.type).toBe('mcp:error');
  expect(event.timestamp).toBeDefined();
});
```

---

### Issue #8: Stack Trace Sanitization Not Tested - LOW SEVERITY
**Location**: `packages/api/src/__tests__/mcp-error-broadcasting.integration.test.ts:492-547`
**Status**: COVERAGE GAP

**Problem**:
Stack trace sanitization test (lines 492-547) only validates that patterns are removed, doesn't validate the sanitized output is still useful:
```typescript
expect(event.data.error.stack).not.toContain('/Users/developer/secret-project');
expect(event.data.error.stack).toContain('/Users/***');
```

**Missing**:
- Validation that useful line numbers/file info remains
- Test of various stack trace formats
- Validation of Windows paths
- Check that stack is still parseable

**Recommendation**:
Add assertion that sanitized stack is still helpful:
```typescript
const sanitizedStack = event.data.error.stack;
expect(sanitizedStack).toContain('test.js');  // Filename preserved
expect(sanitizedStack).toMatch(/:\d+:/);      // Line number format
expect(sanitizedStack).not.toMatch(/\/Users\/developer/); // Personal paths removed
```

---

## Acceptance Criteria Assessment

### ✅ AC1: WebSocket clients receive mcp:install-error events when installation fails
**Status**: VERIFIED
**Evidence**:
- mcp-install-error-websocket.integration.test.ts, lines 195-225
- Test "delivers mcp:install-error events to connected WebSocket clients" passes
- Events successfully received via WebSocket

### ⚠️ AC2: Error events contain serverId, error message, stage, and timestamp
**Status**: PARTIALLY VERIFIED
**Evidence**:
- mcp-install-error-websocket.integration.test.ts validates all fields (lines 253-268)
- mcp-error-broadcasting.integration.test.ts partially validates (missing stage validation)
- Timestamp handling has JSON serialization issues (Issue #2)

**Note**: The two tests use different field names (stage vs category), creating ambiguity.

### ✅ AC3: Multiple clients receive the same error broadcast
**Status**: VERIFIED
**Evidence**:
- mcp-install-error-websocket.integration.test.ts, lines 272-323
- Test "broadcasts error events to multiple connected clients simultaneously" passes
- Both clients receive identical event structures

---

## Summary

### Build Status
✅ **PASSING** - No compilation errors

### Test Status
- **Total**: 15 tests
- **Passing**: 14 ✅
- **Failing**: 1 ❌

### Failing Test Details
**Test**: `mcp-error-broadcasting.integration.test.ts > MCP Error Event Broadcasting Integration > WebSocket client error event reception > delivers MCP error events to connected WebSocket clients`
**Reason**: Multiple assertion failures due to Issues #1 and #2

### Required Actions Before Completion
1. **CRITICAL**: Fix Issue #1 (error name serialization) - Choose approach and implement
2. **CRITICAL**: Fix Issue #2 (date JSON serialization) - Implement date reconstruction
3. **HIGH**: Update test expectations to match implementation
4. **MEDIUM**: Consider refactoring duplicate test code
5. **LOW**: Add test timeout configurations

### Files Modified During Implementation
- `packages/api/src/__tests__/mcp-install-error-websocket.integration.test.ts` - Created
- `packages/api/src/__tests__/mcp-error-broadcasting.integration.test.ts` - Created/Modified
- `docs/adr/ADR-207-mcp-install-error-websocket-integration-test-design.md` - Created
