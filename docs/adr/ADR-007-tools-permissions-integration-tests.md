# ADR-007: Tools and Permissions Integration Test Architecture

## Status
Accepted

## Date
2025-02-14

## Context

The APEX platform requires comprehensive integration tests that verify the interaction between the tool system and the permission system. The acceptance criteria states:

1. Tests verify that tools respect permission boundaries
2. Unauthorized tool access is blocked
3. Permission changes affect tool availability
4. Error handling works correctly
5. All tests pass

After analyzing the existing codebase, we found:

- **Extensive existing test infrastructure**: 100+ permission-related test files already exist
- **Well-established patterns**: Vitest with proper setup/teardown, SQLite test databases, mock factories
- **Core components**: PermissionManager, PermissionStore, PermissionPresetManager, ApexOrchestrator
- **Gap identified**: While individual tests exist, there's a need for a comprehensive integration test suite that specifically validates tool-permission interactions across the full lifecycle

## Decision

### Test Architecture Design

We will create a comprehensive integration test suite at `tests/integration/tools-permissions-comprehensive.integration.test.ts` that consolidates and extends existing test coverage for tool-permission interactions.

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Test Suite Architecture                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   Test Setup    │───▶│   Test Cases    │───▶│   Assertions    │ │
│  │  Infrastructure │    │   & Scenarios   │    │   & Cleanup     │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│          │                       │                      │          │
│          ▼                       ▼                      ▼          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               Test Utilities Layer                          │   │
│  │  - PermissionTestContext (isolated test environments)       │   │
│  │  - MockToolExecutor (simulates tool execution)              │   │
│  │  - EventCapture (captures permission events)                │   │
│  │  - PermissionAssertions (domain-specific assertions)        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│          │                       │                      │          │
│          ▼                       ▼                      ▼          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               APEX Core Components                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │   Permission │  │   Permission │  │   Permission      │   │   │
│  │  │   Manager    │  │   Store      │  │   PresetManager   │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  │                           │                                  │   │
│  │                    ┌──────▼──────┐                          │   │
│  │                    │   SQLite    │                          │   │
│  │                    │  (temp dir) │                          │   │
│  │                    └─────────────┘                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Test Categories

**1. Permission Boundary Tests** (`describe('Tool Permission Boundaries')`)
- Tools respect `allow-always` permissions (persist across uses)
- Tools respect `allow-once` permissions (consumed after first use)
- Tools respect `deny` permissions (blocked with proper error)
- Scope-based permission matching (wildcard patterns, nested hierarchies)

**2. Unauthorized Access Tests** (`describe('Unauthorized Tool Access')`)
- Deny permission blocks tool execution
- No permission (null) triggers appropriate handling
- Permission expiry blocks access
- Cross-tool permission isolation

**3. Permission Change Tests** (`describe('Permission Changes Affecting Tool Availability')`)
- Real-time permission grants enable tool access
- Real-time permission revocation disables tool access
- Permission level changes (upgrade/downgrade) are respected
- Session cache invalidation on permission change
- Event emission for permission state changes

**4. Error Handling Tests** (`describe('Permission Error Handling')`)
- Clear error messages for denials
- Graceful degradation on database errors
- Recovery from corrupted permission state
- Timeout handling for permission checks
- Concurrent access error handling

#### Test Utilities Structure

```typescript
// Test context creation (isolated environment per test)
interface ToolPermissionTestContext {
  tempDir: string;
  orchestrator: ApexOrchestrator;
  permissionManager: PermissionManager;
  permissionStore: PermissionStore;
  presetManager: PermissionPresetManager;
  eventCapture: EventCapture;
  cleanup: () => Promise<void>;
}

// Event capture for async permission events
class PermissionEventCapture {
  private events: PermissionEvent[];
  async waitForEvent(type: string, timeout?: number): Promise<PermissionEvent>;
  getEventsOfType(type: string): PermissionEvent[];
  clear(): void;
}

// Domain-specific assertions
class PermissionAssertions {
  static async assertToolAllowed(ctx: Context, tool: string, scope?: string): Promise<void>;
  static async assertToolDenied(ctx: Context, tool: string, scope?: string): Promise<void>;
  static async assertPermissionConsumed(ctx: Context, tool: string, scope?: string): Promise<void>;
  static async assertEventEmitted(ctx: Context, eventType: string): Promise<void>;
}
```

### Test Data Flow

```
Test Case Start
      │
      ▼
┌─────────────────┐
│ Create isolated │
│ temp directory  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Initialize      │
│ orchestrator    │
│ with test config│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Grant/set       │
│ permissions     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Execute tool    │
│ operation       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Assert expected │
│ behavior        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cleanup temp    │
│ directory       │
└─────────────────┘
```

### File Structure

```
tests/
├── integration/
│   └── tools-permissions-comprehensive.integration.test.ts  # Main test suite
│
├── test-utils/
│   ├── permission-test-context.ts        # Test context factory
│   ├── permission-event-capture.ts       # Event capture utility
│   ├── permission-assertions.ts          # Domain-specific assertions
│   └── mock-tool-executor.ts             # Tool execution simulator
```

### Interfaces and Contracts

#### Permission Check Flow Contract
```typescript
interface PermissionCheckContract {
  // Input
  tool: string;
  scope?: string;
  options?: {
    consumeAllowOnce?: boolean;
    baseDir?: string;
  };

  // Expected Output
  result: {
    allowed: boolean;
    level: PermissionLevel | null;
    requiresConfirmation: boolean;
    denialReason?: string;
  };
}
```

#### Permission Event Contract
```typescript
interface PermissionEventContract {
  'permission:granted': {
    tool: string;
    scope?: string;
    level: PermissionLevel;
    timestamp: Date;
  };
  'permission:denied': {
    tool: string;
    scope?: string;
    reason: string;
    timestamp: Date;
  };
  'permission:revoked': {
    tool: string;
    scope?: string;
    timestamp: Date;
  };
}
```

### Test Scenarios Matrix

| Scenario | Tool Type | Permission Level | Expected Behavior |
|----------|-----------|------------------|-------------------|
| Allow persistent | Filesystem (Read) | allow-always | Multiple uses allowed |
| Allow once | Filesystem (Write) | allow-once | Single use, then blocked |
| Deny explicit | Shell (Bash) | deny | Blocked with error |
| No permission | Search (Grep) | null | Depends on preset/config |
| Scope match | Filesystem (Read) | allow-always + scope | Matched scope allowed |
| Scope mismatch | Filesystem (Write) | allow-always + scope | Different scope blocked |
| Dynamic revoke | Any tool | allow → deny | Access revoked immediately |
| Dynamic grant | Any tool | deny → allow | Access granted immediately |
| Expiry | Any tool | allow-always + expiry | Blocked after expiry |
| Concurrent | Multiple tools | Mixed | Isolation maintained |

### Integration Points

The test suite will integrate with:

1. **PermissionManager** (`packages/orchestrator/src/permission-manager.ts`)
   - `checkPermission()` - Verify permission state
   - `grantPermission()` - Grant test permissions
   - `revokePermission()` - Revoke for cleanup/tests
   - `checkToolPermission()` - Comprehensive check with config

2. **PermissionStore** (`packages/orchestrator/src/permission-store.ts`)
   - SQLite persistence layer
   - Extended permission storage

3. **PermissionPresetManager** (`packages/orchestrator/src/permission-preset-manager.ts`)
   - Preset application for bulk permission setup

4. **ApexOrchestrator** (`packages/orchestrator/src/index.ts`)
   - Event emission for permission changes
   - Task execution with permission enforcement

### Performance Considerations

- Use isolated temp directories per test (no shared state)
- Use in-memory SQLite where possible for speed
- Parallel test execution supported via isolated contexts
- Test timeouts: 30s for integration tests, 10s for unit tests

### Security Considerations

- Tests must clean up all temp files/databases
- No credentials or sensitive data in test fixtures
- Mock external services (Claude SDK) completely
- Validate no permission escalation paths

## Consequences

### Positive
- Comprehensive coverage of tool-permission interactions
- Clear test documentation serves as behavior specification
- Isolated test environments prevent flaky tests
- Event-driven testing captures async behavior
- Extensible architecture for future test additions

### Negative
- Initial setup overhead for test infrastructure
- Longer test execution time than unit tests
- Requires SQLite for realistic testing

### Neutral
- Tests depend on existing APEX infrastructure
- May need updates when permission system evolves

## Implementation Notes

### Phase 1: Test Infrastructure (Already exists, leverage existing)
- Use existing `tests/test-utils/` utilities
- Extend `PermissionTestContext` pattern from existing tests
- Leverage existing factory patterns from `@apexcli/core`

### Phase 2: Core Test Implementation
- Implement comprehensive test file
- Cover all acceptance criteria scenarios
- Add edge cases identified in existing tests

### Phase 3: Validation
- Run tests to ensure all pass
- Verify coverage of acceptance criteria
- Validate no regressions in existing tests

## Related Documents
- ADR-002: Permission System Architecture
- `packages/orchestrator/src/permission-manager.ts`
- `packages/core/src/types.ts` (Permission types)
- Existing tests in `tests/integration/tool-permission-*.test.ts`
