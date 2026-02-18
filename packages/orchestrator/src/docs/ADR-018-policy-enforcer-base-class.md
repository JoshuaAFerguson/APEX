# ADR-018: PolicyEnforcer Base Class Architecture

## Status

Accepted

## Date

2025-01-01

## Context

APEX requires a policy enforcement system to validate agent operations against configurable rules. The first enforcement capability is file path validation, which ensures agents can only access files matching allowed glob patterns defined in the PolicyConfig.

### Existing Infrastructure

1. **PolicyConfig** in `@apex/core/types.ts`:
   - Contains `allowedPaths: AllowedPathsConfig` with `mode`, `allow`, `block`, `sensitivePatterns`
   - Defines `PolicyViolation` schema with `id`, `ruleId`, `policyType`, `severity`, `message`, etc.

2. **DirectoryAccessValidator** in `@apex/core/directory-access-validator.ts`:
   - Uses `minimatch` for glob pattern matching
   - Provides `isPathAllowed()`, `matchesAllowlist()`, `matchesBlocklist()` methods
   - Follows allowlist/blocklist precedence pattern

3. **Existing patterns** in orchestrator:
   - `DangerousOperationDetector` class for detecting dangerous operations
   - Event-driven architecture using `eventemitter3`
   - SQLite-based persistence via TaskStore

## Decision

Implement `PolicyEnforcer` as a base class in `@apex/orchestrator` that:

1. **Constructor** accepts `PolicyConfig` and stores it for validation operations
2. **`validateFilePath(path: string)`** method checks paths against `allowedPaths` configuration
3. Returns `PolicyViolation[]` following the existing schema
4. Leverages `minimatch` from `@apex/core` dependency for glob pattern matching
5. Follows the validation precedence established in `DirectoryAccessValidator`:
   - Block patterns have highest priority
   - Allow patterns are checked next
   - Default behavior based on mode (allowlist vs blocklist)

### Architecture

```
packages/orchestrator/src/
├── policy/
│   ├── index.ts              # Re-exports PolicyEnforcer and related types
│   ├── policy-enforcer.ts    # PolicyEnforcer base class
│   └── policy-enforcer.test.ts # Unit tests
```

### Class Design

```typescript
import type { PolicyConfig, PolicyViolation, AllowedPathsConfig } from '@apex/core';

export class PolicyEnforcer {
  private readonly config: PolicyConfig;

  constructor(config: PolicyConfig);

  /**
   * Validates a file path against the allowedPaths configuration.
   * Returns empty array if path is allowed, or PolicyViolation[] if blocked.
   */
  validateFilePath(path: string): PolicyViolation[];

  // Protected helpers for future subclasses
  protected createViolation(opts: ViolationOptions): PolicyViolation;
  protected matchesPattern(path: string, patterns: string[]): boolean;
}
```

### PolicyViolation Creation

Each violation includes:
- `id`: UUID for unique identification
- `ruleId`: `"path-validation"` (consistent identifier for path rules)
- `policyType`: `"path"`
- `severity`: Based on config enforcement level (`warn` -> `warning`, `enforce` -> `error`)
- `message`: Human-readable description
- `resource`: The path that was evaluated
- `timestamp`: When the violation occurred

### Pattern Matching Strategy

1. **Normalize paths** for consistent comparison
2. **Check block patterns first** (highest priority denial)
3. **Check allow patterns** (explicit permission)
4. **Apply default behavior** based on mode:
   - `allowlist` mode: deny if not in allow list
   - `blocklist` mode: allow if not in block list
5. **Handle sensitive patterns** - flag paths matching sensitive patterns

### Integration Points

The PolicyEnforcer will be used by:
1. **Tool execution layer** - Before file read/write operations
2. **ApexOrchestrator** - When configuring agent sandboxes
3. **Future enforcement hooks** - Pre/post agent actions

## Consequences

### Positive

- **Reusability**: Base class enables extension for test and approval policy enforcement
- **Consistency**: Uses existing `PolicyViolation` schema from `@apex/core`
- **Testability**: Pure functions with clear inputs/outputs enable comprehensive testing
- **Type safety**: Full TypeScript with Zod-validated types from core

### Negative

- **Dependency on core**: Must keep in sync with PolicyConfig schema changes
- **Additional abstraction**: Adds a layer between config and enforcement

### Risks

- Pattern matching edge cases (Windows vs Unix paths)
- Performance with large allow/block lists (mitigated by early-exit matching)

## Alternatives Considered

### 1. Extend DirectoryAccessValidator

Rejected because:
- Couples orchestrator too tightly to core validation implementation
- DirectoryAccessValidator serves a different purpose (sandbox validation vs policy enforcement)
- Policy enforcement needs violation tracking, not just boolean results

### 2. Inline validation in ApexOrchestrator

Rejected because:
- Violates single responsibility principle
- Harder to test independently
- Prevents reuse across different enforcement scenarios

### 3. Pure function approach (no class)

Considered but rejected because:
- Class allows configuration caching
- Enables protected methods for subclasses
- Matches existing patterns in codebase (DangerousOperationDetector)

## References

- PolicyConfig schema: `packages/core/src/types.ts`
- DirectoryAccessValidator: `packages/core/src/directory-access-validator.ts`
- DangerousOperationDetector pattern: `packages/orchestrator/src/dangerous-operation-detector.ts`
