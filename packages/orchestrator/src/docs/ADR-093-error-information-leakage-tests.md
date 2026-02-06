# ADR-093: Error Information Leakage Tests for Orchestrator Package

## Status
Accepted

## Context
The core package (`@apex/core`) already has `error-message-security.test.ts` testing the `sanitizeErrorMessage()` and `toSafeErrorResponse()` utilities. However, the orchestrator package has its own error handling paths that could leak sensitive information. This ADR defines the test architecture for verifying that orchestrator-level error handling doesn't expose file paths, API keys, database paths, or SQL queries.

### Key Findings from Codebase Analysis

1. **Orchestrator does NOT use `ApexError` or `sanitizeErrorMessage()`** — The `ApexOrchestrator` class and `TaskStore` use plain `Error` objects and raw string concatenation for error messages.

2. **`parseErrorMessage()` appends raw original errors** — The orchestrator's `parseErrorMessage()` method adds `Original error: ${message}` to enhanced error messages, potentially leaking sensitive info from SDK errors, file system errors, or database errors.

3. **TaskStore throws errors with internal details** — Store errors include task IDs and status information but NOT file paths or SQL queries (database path is `this.dbPath` but not included in error messages).

4. **Error events emit raw Error objects** — `task:failed`, `agent:error`, and `subtask:failed` events pass the original Error object, which may contain sensitive stack traces and messages.

5. **Log messages contain raw error messages** — `store.addLog()` calls include unsanitized error messages from SDK responses.

## Decision

Create a single test file `packages/orchestrator/src/__tests__/error-information-leakage.test.ts` that validates three categories of error information leakage protection.

## Technical Design

### Test File Structure

```
packages/orchestrator/src/__tests__/error-information-leakage.test.ts
```

### Test Categories

#### Category 1: Task Execution Errors Don't Leak File Paths (6 tests)

These tests verify that when task execution encounters file-system errors, the error messages emitted/stored don't contain sensitive file paths.

**Approach**: Mock the Claude SDK `query()` function to throw errors containing file paths, then verify the orchestrator's `parseErrorMessage()` output and event emissions.

Tests:
1. `parseErrorMessage strips home directory paths from file errors`
2. `parseErrorMessage strips node_modules paths from module errors`
3. `parseErrorMessage strips .apex internal paths from config errors`
4. `parseErrorMessage strips /tmp paths from temporary file errors`
5. `task failure logs don't contain raw file paths` (integration with store.addLog)
6. `task:failed event error message doesn't expose project directory structure`

**Key Implementation Detail**: These tests directly call `parseErrorMessage()` (which is a private method, so we test it indirectly through the task execution flow) or test the public behavior by running a mocked task execution and inspecting logged/emitted errors.

Since `parseErrorMessage()` is private, tests should:
- Create an `ApexOrchestrator` instance with mocked dependencies
- Mock `query()` to throw errors with sensitive paths
- Call `executeTask()` and capture emitted events and stored logs
- Assert no sensitive paths appear in error messages

#### Category 2: Claude SDK Integration Errors Don't Expose API Keys (5 tests)

These tests verify that when the Claude Agent SDK throws authentication/API errors, the orchestrator doesn't propagate API key values.

**Approach**: Mock `query()` to throw errors containing API key patterns, then verify the orchestrator's error handling strips them.

Tests:
1. `SDK authentication error doesn't expose Anthropic API key`
2. `SDK error with Bearer token doesn't expose token value`
3. `SDK error with ANTHROPIC_API_KEY env var doesn't expose value`
4. `parseErrorMessage for auth errors replaces original message with safe message`
5. `rate limit error from SDK doesn't expose internal endpoint URLs`

**Key Implementation Detail**: The `parseErrorMessage()` method already categorizes auth errors but appends `Original error: ${message}` — tests should verify this pattern doesn't leak keys.

#### Category 3: SQLite/TaskStore Errors Don't Reveal Database Paths or Queries (6 tests)

These tests verify that TaskStore database errors don't leak the database file path, SQL queries, or internal schema details.

**Approach**: Use the `TaskStore` class with intentionally corrupted state or mock `better-sqlite3` to throw errors, then verify error messages.

Tests:
1. `TaskStore initialization error doesn't reveal database file path`
2. `TaskStore query error doesn't expose SQL statements`
3. `TaskStore error doesn't expose .apex/apex.db path`
4. `Task not found error only includes task ID, not database path`
5. `Database connection error doesn't reveal connection string`
6. `Store errors in task execution don't leak database internals`

**Key Implementation Detail**: `TaskStore` currently throws plain `Error` with messages like `Task with ID ${taskId} not found` — these are safe. But database-level errors from `better-sqlite3` could leak paths. Tests should verify these are caught and sanitized.

### Test Setup Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sanitizeErrorMessage, toSafeErrorResponse, ApexError, ApexErrorCode } from '@apexcli/core';

// Sensitive pattern matchers (same as core tests for consistency)
const SENSITIVE_PATH_PATTERNS = [
  /\/Users\/[^\s/]+\//,
  /\/home\/[^\s/]+\//,
  /[A-Z]:\\Users\\[^\s\\]+\\/i,
  /node_modules\/[^\s]+/,
  /\.apex\/(config\.yaml|apex\.db)/,
  /\/tmp\/[^\s]+/,
];

const SENSITIVE_VALUE_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-]+/,
  /sk-[a-zA-Z0-9]{20,}/,
  /Bearer\s+[a-zA-Z0-9._-]+/,
  /password[=:]\s*\S+/i,
  /(?:api[_-]?key|secret|token|credential)[=:]\s*\S+/i,
];

const SQL_PATTERNS = [
  /SELECT\s+.*\s+FROM/i,
  /INSERT\s+INTO/i,
  /UPDATE\s+.*\s+SET/i,
  /DELETE\s+FROM/i,
  /CREATE\s+TABLE/i,
  /PRAGMA\s+/i,
];
```

### Dependency Mocking Strategy

The orchestrator has heavy dependencies (Claude SDK, SQLite, filesystem). Tests should:

1. **Mock `@anthropic-ai/claude-agent-sdk`** — Mock `query()` to throw controlled errors
2. **Mock `better-sqlite3`** — For database error scenarios, mock the Database constructor or statement execution
3. **Use test-utils** — Leverage existing `createTempDirectoryAsync()`, `createTestDatabase()` for real-but-isolated database instances
4. **Mock filesystem** — For file path error scenarios, mock `fs` operations to throw errors with paths

### Test Execution

Tests run in the orchestrator package's vitest environment (node). No special configuration needed — the root `vitest.config.ts` already includes `packages/*/src/**/*.test.ts`.

### Validation Approach

Each test follows this pattern:
1. **Arrange**: Set up mocks to produce errors containing sensitive data
2. **Act**: Trigger the error path (task execution, store operation, SDK call)
3. **Assert**: Verify the error message/output doesn't contain sensitive patterns using the helper functions

For tests that exercise the full orchestrator flow, we capture:
- Emitted events via `orchestrator.on('task:failed', ...)`
- Stored logs via the TaskStore
- Thrown errors from public methods

### Important Design Notes

1. **This is a testing-only task** — No production code changes are needed for this ADR. The tests document the current behavior and verify security invariants.

2. **Some tests may fail initially** — If the orchestrator's `parseErrorMessage()` method leaks info via `Original error: ${message}`, that's a finding the tests should capture. The developer stage should either:
   - Fix the leak (add sanitization) and make tests pass, OR
   - Document the gap and create follow-up tasks

3. **Test file naming** — `error-information-leakage.test.ts` follows the existing pattern of `error-message-security.test.ts` in core.

4. **Dummy credentials** — All test fixtures use clearly fake values (e.g., `sk-ant-api03-AAAA...`) with comments noting they are NOT real credentials.

## Consequences

### Positive
- Systematic verification that orchestrator error paths don't leak sensitive info
- Regression protection against future changes that might introduce leakage
- Complements the core package's `error-message-security.test.ts`
- Documents current error handling behavior

### Negative
- Heavy mocking required for orchestrator dependencies
- Tests may initially expose gaps in current error sanitization

## File Impact

| File | Action | Purpose |
|------|--------|---------|
| `packages/orchestrator/src/__tests__/error-information-leakage.test.ts` | Create | New test file with 17 tests across 3 categories |
| `packages/orchestrator/src/docs/ADR-093-error-information-leakage-tests.md` | Create | This architectural decision record |
