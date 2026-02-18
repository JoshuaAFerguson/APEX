# ADR-007: Tool Permission Boundary Testing Architecture

## Status

Accepted

## Date

2025-02-14

## Context

APEX uses a permission system to control agent access to tools (Read, Write, Edit, Bash, Grep, Glob). The acceptance criteria require:

> "Tests verify that filesystem tools (Read, Write, Edit), shell tools (Bash), and search tools (Grep, Glob) respect allow-always, allow-once, and deny permission levels. All tests pass."

We need to design a comprehensive test architecture that systematically verifies all tool-permission combinations work correctly.

## Decision

### Test Matrix Design

We will implement a **tool × permission level** test matrix covering:

| Tool     | Category   | allow-always | allow-once | deny |
|----------|------------|--------------|------------|------|
| Read     | filesystem | ✓            | ✓          | ✓    |
| Write    | filesystem | ✓            | ✓          | ✓    |
| Edit     | filesystem | ✓            | ✓          | ✓    |
| Bash     | shell      | ✓            | ✓          | ✓    |
| Grep     | search     | ✓            | ✓          | ✓    |
| Glob     | search     | ✓            | ✓          | ✓    |

**Total: 18 core test cases** (6 tools × 3 permission levels)

### Architecture Components

#### 1. Test File Location

```
tests/integration/tool-permission-boundaries.test.ts
```

Located in the integration tests directory alongside existing permission tests, using the same vitest configuration with extended timeouts.

#### 2. Test Structure Pattern

```typescript
describe('Tool Permission Boundaries', () => {
  // Shared setup/teardown with temporary directories

  describe('Filesystem Tools', () => {
    describe('Read Tool', () => {
      it('should allow reading when permission is allow-always', async () => {...});
      it('should allow reading once when permission is allow-once', async () => {...});
      it('should deny reading when permission is deny', async () => {...});
    });

    describe('Write Tool', () => {...});
    describe('Edit Tool', () => {...});
  });

  describe('Shell Tools', () => {
    describe('Bash Tool', () => {...});
  });

  describe('Search Tools', () => {
    describe('Grep Tool', () => {...});
    describe('Glob Tool', () => {...});
  });
});
```

#### 3. Leveraging Existing Infrastructure

The test suite will use:

1. **`ApexOrchestrator`** from `@apexcli/orchestrator` - for permission management
2. **`PermissionManager`** - for granting/checking permissions
3. **`PermissionPresetManager`** - for testing preset-based permissions
4. **Event capture utilities** from `packages/orchestrator/tests/utils/event-capture.ts`
5. **Mock factories** from `packages/core/src/test-fixtures/mock-factories.ts`
6. **Permission scenario helpers** from `packages/core/src/__tests__/helpers/`

#### 4. Test Implementation Strategy

**For allow-always:**
- Grant permission with `allow-always` level
- Verify tool execution is permitted
- Verify permission persists across multiple checks
- Verify no confirmation is required

**For allow-once:**
- Grant permission with `allow-once` level
- Verify first tool execution is permitted
- Verify permission is consumed after use
- Verify subsequent checks return null/require re-granting

**For deny:**
- Grant permission with `deny` level
- Verify tool execution is blocked
- Verify `result.allowed === false`
- Verify denial reason is provided
- Verify denial persists and cannot be bypassed

#### 5. Scope-Based Testing

Each tool should be tested with:
- Global scope (no specific path/pattern)
- Specific scope (e.g., `/tmp/test.txt`)
- Wildcard scope (e.g., `/src/**`)
- Nested scope (e.g., `/project/src/components/`)

#### 6. Event Verification

Tests will verify event emission:
- `permission:granted` when granting permissions
- `permission:denied` when denying permissions
- `permission:request` when requesting permission
- `dangerous:detected` for dangerous operations

### Test Configuration

```typescript
// Uses tests/integration/vitest.config.ts
// - 30s test timeout
// - 15s hook timeout
// - Node environment
// - Sequential execution for database safety
// - Max 4 forks for resource management
```

### Dependencies

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ApexOrchestrator, PermissionManager } from '@apexcli/orchestrator';
import type { PermissionLevel } from '@apexcli/core';
```

## Consequences

### Positive

1. **Comprehensive Coverage**: All 18 tool-permission combinations are explicitly tested
2. **Consistent Structure**: Uses established patterns from existing permission tests
3. **Maintainable**: Clear organization by tool category makes adding new tools simple
4. **Isolated**: Each test uses temporary directories and cleans up properly
5. **Integrated**: Uses real orchestrator and permission manager, not just mocks

### Negative

1. **Test Duration**: Integration tests with real filesystem operations take longer
2. **Resource Usage**: Each test creates isolated temp directories and databases

### Neutral

1. **Single File**: All tests in one file for cohesion; could be split if it grows too large
2. **Relies on Existing Infrastructure**: Depends on PermissionManager API stability

## Implementation Notes

### File Structure
```
tests/integration/
├── tool-permission-boundaries.test.ts   # NEW - Main test file
├── permissions-acceptance-criteria.test.ts  # Existing
├── permissions-system-integration.test.ts   # Existing
├── permission-denials-comprehensive.test.ts # Existing
├── setup.ts
└── vitest.config.ts
```

### Test Categories

1. **Core Boundary Tests** (18 tests)
   - 6 tools × 3 permission levels

2. **Scope Pattern Tests** (~12 tests)
   - Wildcard patterns for each tool category
   - Path-based restrictions

3. **Permission Lifecycle Tests** (~6 tests)
   - Grant → Check → Revoke cycles
   - allow-once consumption behavior
   - Permission persistence

4. **Edge Case Tests** (~6 tests)
   - Empty scope handling
   - Path traversal protection
   - Concurrent permission operations

**Total: ~42 test cases**

### Success Criteria

All tests must pass with:
- `npm run build` - No compilation errors
- `npm run test` - All tests pass
- Specific test run: `npm test tests/integration/tool-permission-boundaries.test.ts`

## References

- `packages/core/src/types.ts` - Permission type definitions
- `packages/orchestrator/src/index.ts` - ApexOrchestrator implementation
- `tests/integration/permissions-acceptance-criteria.test.ts` - Reference implementation
- `tests/integration/README-permission-denials.md` - Test documentation pattern
