# ADR-092: Error Message Security Tests Architecture

## Status
Accepted

## Context

APEX exposes error information across multiple layers:
1. **API layer** (`packages/api/src/index.ts`) — returns `error.message` directly in HTTP JSON responses
2. **CLI layer** (`packages/cli/src/utils/ErrorFormatter.ts`) — has verbosity levels but no production-mode filtering
3. **Core layer** (`packages/core/src/apex-error.ts`) — `getDetails()`/`toJSON()` expose full stack traces, cause chains, and internal context

Current error handling patterns present security risks:
- `error instanceof Error ? error.message : 'Failed to ...'` passes raw internal error messages to API consumers
- `ApexError.getDetails()` includes `stack`, `cause.stack`, and metadata that may contain sensitive paths
- No environment-aware sanitization exists — the same error details are exposed in development and production

We need **security-focused tests** that verify error messages don't leak sensitive information.

## Decision

### Test Architecture

Create a single, focused test file at:
```
packages/core/src/__tests__/error-message-security.test.ts
```

This test file lives in `packages/core` because:
1. The `ApexError` class and error utilities are core infrastructure used by all packages
2. The security contracts being tested are fundamental to the error system itself
3. Core is the standalone package with no upstream dependencies, making tests faster and simpler
4. Error sanitization logic (if added) would live in core for reuse by API, CLI, and orchestrator

### Test Categories

#### Category 1: Stack Trace Suppression
Tests that verify `ApexError` serialization doesn't leak stack traces in production-safe outputs.

**What to test:**
- `ApexError.toJSON()` includes `stack` property (documenting current behavior)
- `ApexError.getDetails()` includes `stack` and `cause.stack`
- `ApexError.toString(false)` omits stack traces
- `ApexError.toString(true)` includes stack traces (developer mode only)

**Design rationale:** These tests document the current exposure surface. They provide a foundation for a future `toSafeJSON()` method that strips stack traces.

#### Category 2: Internal Path Leakage Prevention
Tests that verify error messages constructed from common failure scenarios don't embed absolute filesystem paths, config file locations, or database paths.

**What to test:**
- Error messages should not contain absolute paths like `/Users/`, `/home/`, `C:\`
- Error messages should not contain `.apex/config.yaml` or `apex.db` paths
- Error messages should not reference `node_modules/` internal paths
- `ApexError` metadata should not accidentally include filesystem paths in user-facing serialization

**Sensitive path patterns to check:**
```typescript
const SENSITIVE_PATH_PATTERNS = [
  /\/Users\/[^/]+\//,          // macOS home directories
  /\/home\/[^/]+\//,           // Linux home directories
  /[A-Z]:\\Users\\/i,          // Windows home directories
  /node_modules\//,            // Internal dependency paths
  /\.apex\/(config|apex\.db)/, // APEX internal config/db paths
  /\/tmp\//,                   // Temporary file paths
];
```

#### Category 3: Credential/Secret Leakage Prevention
Tests that verify error messages and serialized error objects don't contain API keys, tokens, passwords, or connection strings.

**What to test:**
- Error messages constructed with cause errors containing credentials are sanitized
- `ApexError` metadata doesn't leak `ANTHROPIC_API_KEY` or similar env vars
- Database connection strings in error context are not exposed
- Auth tokens in error messages from failed HTTP requests are redacted

**Sensitive value patterns to check:**
```typescript
const SENSITIVE_VALUE_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-]+/,       // Anthropic API keys
  /Bearer\s+[a-zA-Z0-9._-]+/,   // Bearer tokens
  /password[=:]\s*\S+/i,        // Password values
  /postgres:\/\/[^@]+@/,        // DB connection strings with credentials
  /mongodb(\+srv)?:\/\/[^@]+@/, // MongoDB connection strings
  /ANTHROPIC_API_KEY/,          // Env var names
  /(?:api[_-]?key|secret|token)[=:]\s*\S+/i, // Generic secrets
];
```

#### Category 4: Generic Error Messages for Security-Sensitive Failures
Tests that verify security-sensitive error codes map to generic, safe messages.

**What to test:**
- `AUTHENTICATION_ERROR` → generic "Authentication failed" (no details about why)
- `FILE_ACCESS_DENIED` → generic "Access denied" (no path details)
- `DATABASE_CONNECTION_FAILED` → generic "Service unavailable" (no connection details)
- `CONFIGURATION` errors → generic "Configuration error" (no config values)

**Design note:** This category defines the contract for a future `toSafeMessage()` utility.

### Test Implementation Pattern

```typescript
// packages/core/src/__tests__/error-message-security.test.ts

import { describe, it, expect } from 'vitest';
import { ApexError, ApexErrorCode } from '../apex-error';

describe('Error Message Security', () => {
  describe('Stack Trace Exposure', () => {
    // Tests verifying stack trace handling
  });

  describe('Internal Path Leakage', () => {
    // Tests with error messages containing paths
  });

  describe('Credential Leakage Prevention', () => {
    // Tests with error messages containing secrets
  });

  describe('Generic Error Messages for Security-Sensitive Failures', () => {
    // Tests mapping error codes to safe messages
  });
});
```

### Utility: Error Sanitization Helper

The tests will also validate a new utility function to be added to `apex-error.ts`:

```typescript
/**
 * Sanitize an error message for safe external display.
 * Strips stack traces, internal paths, and credential patterns.
 */
export function sanitizeErrorMessage(message: string): string;

/**
 * Get a production-safe representation of an ApexError.
 * Returns only the error code, sanitized message, and errorId.
 */
export function toSafeErrorResponse(error: ApexError): {
  errorId: string;
  code: ApexErrorCode;
  message: string;
};
```

These utilities will be implemented in core and tested alongside the security tests.

### Integration Points

The security tests are pure unit tests of the core error system. Future stages should:

1. **API layer**: Use `toSafeErrorResponse()` in catch blocks instead of raw `error.message`
2. **CLI layer**: Use `sanitizeErrorMessage()` when `ErrorVerbosity.MINIMAL` is set
3. **Orchestrator**: Log full error details server-side, emit sanitized errors to events

### File Structure

```
packages/core/src/
├── apex-error.ts                              # Add sanitizeErrorMessage(), toSafeErrorResponse()
├── __tests__/
│   ├── apex-error.test.ts                     # Existing tests (unchanged)
│   └── error-message-security.test.ts         # NEW: Security-focused tests
```

## Consequences

### Positive
- Security contracts are explicitly documented and enforced by tests
- Sanitization utilities are reusable across all packages
- Tests serve as regression protection against future error message changes
- Clear separation between developer-facing and user-facing error details

### Negative
- Adds maintenance burden for keeping sensitive patterns up to date
- Sanitization may make debugging harder in production (mitigated by errorId for log correlation)

### Risks
- Pattern-based detection may miss novel leakage vectors — periodic review recommended
- Over-sanitization could hide useful error context — tests verify both safety and usefulness
