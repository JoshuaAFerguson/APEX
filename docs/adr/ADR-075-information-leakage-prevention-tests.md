# ADR-075: Information Leakage Prevention Test Architecture

## Status
Accepted

## Date
2025-01-29

## Context

APEX processes sensitive information including API keys, file paths, database URLs, and credentials. Error messages surfaced through the API, orchestrator, and CLI must not leak internal implementation details that could aid attackers. We need a comprehensive test suite to verify that error messages do NOT expose:

1. **Internal file paths** (`/Users/*`, `/home/*`, absolute paths revealing server structure)
2. **Configuration values** (API keys, database URLs, secrets from `.apex/config.yaml`)
3. **Credential fragments or tokens** (partial keys, JWT tokens, auth headers)

## Decision

### Test Architecture

We will create a single, focused test file per package that validates error message sanitization:

```
packages/
├── core/src/__tests__/error-info-leakage-prevention.test.ts
├── orchestrator/src/__tests__/error-info-leakage-prevention.test.ts
├── api/src/__tests__/error-info-leakage-prevention.test.ts
└── cli/src/__tests__/error-info-leakage-prevention.test.ts
```

### Approach: Pattern-Based Assertion Helpers

Rather than testing every individual error path (which would be fragile and require constant maintenance), we define **reusable assertion helpers** that check any string for information leakage patterns. These are applied to error outputs from each package.

#### Core Leakage Patterns to Detect

```typescript
// Internal path patterns
const INTERNAL_PATH_PATTERNS = [
  /\/Users\/[^/]+\//,          // macOS home directories
  /\/home\/[^/]+\//,           // Linux home directories
  /[A-Z]:\\Users\\/i,          // Windows home directories
  /\/var\/lib\//,              // System directories
  /\/etc\//,                   // System config directories
  /\/tmp\/apex/,               // Temp directories with project context
  /node_modules\//,            // Node.js internals
];

// Secret/credential patterns
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,                     // AWS Access Key
  /ghp_[A-Za-z0-9]{36}/,                  // GitHub token
  /sk_(live|test)_[0-9a-zA-Z]{24}/,       // Stripe key
  /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/,   // JWT token
  /-----BEGIN.*PRIVATE KEY-----/,          // Private keys
  /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/,     // MongoDB connection strings with credentials
  /postgres(ql)?:\/\/[^:]+:[^@]+@/,       // PostgreSQL connection strings with credentials
  /mysql:\/\/[^:]+:[^@]+@/,               // MySQL connection strings with credentials
  /Authorization:\s*(Basic|Bearer)\s+\S+/, // Auth headers
];

// Config value patterns
const CONFIG_VALUE_PATTERNS = [
  /api[_-]?key\s*[=:]\s*\S{16,}/i,       // API key assignments
  /secret\s*[=:]\s*\S{12,}/i,            // Secret assignments
  /password\s*[=:]\s*\S+/i,              // Password assignments
  /database[_-]?url\s*[=:]\s*\S+/i,      // Database URLs
];
```

#### Shared Test Utility Module

A shared utility in `packages/core/src/__tests__/` provides the assertion helpers, ensuring consistency across all four package test files:

```typescript
// packages/core/src/__tests__/helpers/leakage-assertions.ts

export function assertNoInternalPaths(output: string, context?: string): void;
export function assertNoSecrets(output: string, context?: string): void;
export function assertNoConfigValues(output: string, context?: string): void;
export function assertNoInfoLeakage(output: string, context?: string): void; // all-in-one
```

### Test Scenarios Per Package

#### 1. `@apex/core` — Error Formatter Tests
- Verify `ErrorFormatter.format()` doesn't include raw file paths in output when errors contain absolute paths
- Verify `createStructuredError()` sanitizes error messages containing secrets
- Verify `SecretScanner` detection results don't include raw secret values (only masked)

#### 2. `@apex/orchestrator` — Task Execution Error Tests
- Verify task failure events don't expose internal file paths in error messages
- Verify `executeTask()` error handling doesn't leak config values (e.g., API keys from failed SDK calls)
- Verify `SecretOutputProcessor` properly redacts secrets in error scenarios
- Verify error messages from failed workflow stages don't expose absolute paths

#### 3. `@apex/api` — HTTP Error Response Tests
- Verify 4xx/5xx API responses contain only safe, generic error messages
- Verify catch blocks that call `reply.status(500).send()` don't forward raw `error.message` containing paths
- Verify WebSocket error events don't leak internal information
- Verify health check error responses don't expose system paths or config

#### 4. `@apex/cli` — CLI Error Display Tests
- Verify `ErrorFormatter` (CLI version) strips absolute paths from displayed errors
- Verify stack traces in verbose mode don't show full system paths (relativized)
- Verify error messages for config/filesystem errors don't leak `.apex/` directory internals

### Test Strategy

**Unit tests with synthetic error inputs**: Each test constructs error objects/messages containing intentional leakage (e.g., `"/Users/developer/project/secret.ts: AKIA1234567890ABCDEF"`) and verifies the package's error handling sanitizes them before output.

**No mocking of external services needed**: Tests focus on the error formatting/handling layer, not on triggering real errors from Claude SDK or databases.

### Pattern Matching Strategy

Tests use a **deny-list approach**: any error output matching a leakage pattern is a test failure. This is more robust than an allow-list because:
1. New error paths automatically get tested
2. No need to enumerate all valid error messages
3. Catches regressions when error messages change

## Consequences

### Positive
- Comprehensive coverage across all 4 packages
- Reusable assertion helpers prevent pattern duplication
- Easy to extend with new leakage patterns
- Tests are fast (no I/O, no external services)
- Pattern-based approach catches regressions automatically

### Negative
- May produce false positives for legitimate path references in error messages (mitigate with allowlists per test case)
- Tests validate the error formatting layer, not that errors are always routed through it

### Risks
- If error messages bypass the formatter entirely (e.g., raw `throw`), these tests won't catch it. Mitigated by also testing catch-block outputs.

## Related ADRs
- ADR-001: Secret Scanner Architecture
- ADR-010: Secret Detection in Tool Outputs
- ADR-070: Configurable Secret Detection Behavior Modes
