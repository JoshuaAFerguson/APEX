# ADR-037: Permissions Integration Tests Architecture

## Status
**Accepted**

## Date
2024-01-10

## Context

The APEX permissions system is a critical security feature that controls how AI agents can interact with tools and the file system. The task requires creating integration tests that verify the permissions system works correctly including:
- Permission checks
- Permission grants
- Permission denials
- User confirmation flows

### Current State Analysis

After comprehensive analysis of the codebase, the permissions system already has **extensive integration test coverage** (~50+ test files). The existing test coverage includes:

#### Core Package (`@apexcli/core`)
| Test File | Coverage Area |
|-----------|---------------|
| `permissions-config.test.ts` | Configuration loading and parsing |
| `permissions-config-edge-cases.test.ts` | Edge cases in configuration |
| `permissions-config-init.test.ts` | Initialization flows |
| `permissions-config-coverage.test.ts` | Coverage validation |
| `permissions-directory-access.test.ts` | Directory access patterns |
| `permissions-edge-cases.test.ts` | Edge case handling |
| `permissions-integration.test.ts` | Cross-component integration |
| `permissions-schema-validation.test.ts` | Zod schema validation |
| `permission-preset.test.ts` | Preset configurations |
| `permission-types.test.ts` | Type safety validation |
| `permission-validation.test.ts` | Validation logic |

#### Orchestrator Package (`@apexcli/orchestrator`)
| Test File | Coverage Area |
|-----------|---------------|
| `permission-store.test.ts` | SQLite persistence |
| `permission-store.integration.test.ts` | Store integration |
| `permission-store-extended.test.ts` | Extended storage scenarios |
| `permission-store-extended-integration.test.ts` | Extended integration |
| `permission-store-migration.test.ts` | Database migrations |
| `permission-store-migration-integration.test.ts` | Migration integration |
| `permission-store-per-tool.test.ts` | Per-tool configurations |
| `permission-manager.test.ts` | Manager logic |
| `permission-manager-extended.test.ts` | Extended manager scenarios |
| `permission-manager-granular.test.ts` | Granular permissions |
| `permission-manager-coverage.test.ts` | Manager coverage |
| `permission-preset-manager.test.ts` | Preset management |
| `permission-preset-manager.edge-cases.test.ts` | Preset edge cases |
| `permission-preset-manager.validation.test.ts` | Preset validation |
| `permission-preset-manager.performance.test.ts` | Performance testing |
| `permission-preset-manager.advanced-integration.test.ts` | Advanced integration |
| `permission-preset-manager-comprehensive.test.ts` | Comprehensive tests |
| `permission-preset-integration.test.ts` | Preset integration |
| `permission-preset-comprehensive.test.ts` | Comprehensive presets |
| `permission-preset-hooks.test.ts` | Hook integration |
| `permission-preset-hooks-integration.test.ts` | Hooks integration |
| `permission-preset-hooks-edge-cases.test.ts` | Hook edge cases |
| `permission-preset-warning-integration.test.ts` | Warning flows |
| `permission-flow-integration.test.ts` | End-to-end flows |
| `permission-orchestrator-e2e.test.ts` | Full E2E testing |
| `permission-confirmation.test.ts` | User confirmation flows |
| `permission-external-confirmation.test.ts` | External confirmations |
| `permission-events.test.ts` | Event emission |
| `permission-events-integration.test.ts` | Events integration |
| `permission-events-acceptance.test.ts` | Acceptance tests |
| `permission-events-types.test.ts` | Event type safety |
| `permission-events-verification.test.ts` | Event verification |
| `permission-events-final-verification.test.ts` | Final verification |
| `permission-granular-integration.test.ts` | Granular integration |
| `permission-manual-validation.test.ts` | Manual validation |
| `apex-orchestrator-permission-integration.test.ts` | Orchestrator integration |
| `apex-orchestrator-permission-initialization.test.ts` | Initialization |

## Decision

Given the **comprehensive existing test coverage**, the architecture stage confirms that:

### 1. Existing Tests Meet Acceptance Criteria

The acceptance criteria states: *"Integration tests exist that verify the permissions system works correctly including permission checks, grants, denials, and user confirmation flows. Tests pass successfully."*

Current tests already cover:
- **Permission Checks**: `permission-manager.test.ts`, `permission-flow-integration.test.ts`
- **Permission Grants**: `permission-confirmation.test.ts`, `permission-store.test.ts`
- **Permission Denials**: `permission-orchestrator-e2e.test.ts`, `permission-events.test.ts`
- **User Confirmation Flows**: `permission-confirmation.test.ts`, `permission-external-confirmation.test.ts`

### 2. Permissions System Architecture

The permissions system follows a layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        ApexOrchestrator                         │
│  - requestPermission()                                          │
│  - grantPermissionConfirmation()                                │
│  - denyPermissionConfirmation()                                 │
│  - flagDangerousOperation()                                     │
│  - confirmDangerousOperation()                                  │
│  - blockDangerousOperation()                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PermissionManager                            │
│  - checkPermission(tool, scope)                                 │
│  - grantPermission(tool, scope, level)                          │
│  - revokePermission(tool, scope)                                │
│  - checkToolPermission(tool, options)                           │
│  - checkDirectoryAccess(path, options)                          │
│  - Session cache management                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ PermissionStore │  │PermissionPreset │  │DirectoryAccess  │
│                 │  │    Manager      │  │   Validator     │
│ - SQLite DB     │  │                 │  │                 │
│ - CRUD ops      │  │ - Presets       │  │ - Allowlist     │
│ - Migrations    │  │ - Rules         │  │ - Blocklist     │
│ - Expiry        │  │ - Behaviors     │  │ - Pattern match │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 3. Permission Levels and Behaviors

```typescript
type PermissionLevel = 'allow-always' | 'allow-once' | 'deny';

type ToolPermissionBehavior = 'allow' | 'confirm' | 'deny';

type PermissionPreset = 'autonomous' | 'review-all' | 'read-only';
```

### 4. Event Flow

```
User Request → permission:request event
     │
     ▼
  [Wait for User Decision]
     │
     ├── Grant → permission:granted event
     │            └── Update PermissionStore
     │
     └── Deny  → permission:denied event
                 └── Update PermissionStore

Dangerous Operation → dangerous:detected event
     │
     ▼
  [Wait for User Decision]
     │
     ├── Confirm → dangerous:confirmed event
     │
     └── Block   → dangerous:blocked event
```

### 5. Verification Approach

Rather than creating redundant tests, the development stage should:

1. **Verify existing tests pass** - Run the full test suite
2. **Add any missing edge cases** - If gap analysis reveals missing scenarios
3. **Update documentation** - Ensure test coverage report is current

## Technical Design Summary

### Component Relationships

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| `ApexOrchestrator` | High-level permission API | PermissionManager, EventEmitter |
| `PermissionManager` | Permission logic & caching | PermissionStore, DirectoryAccessValidator |
| `PermissionStore` | SQLite persistence | better-sqlite3, fs |
| `PermissionPresetManager` | Preset configuration | PermissionStore |
| `DirectoryAccessValidator` | Path validation | Path patterns |

### Test Categories

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test complete workflows from user request to resolution
4. **Event Tests**: Verify correct event emission and ordering
5. **Edge Case Tests**: Handle error conditions and boundary cases

### Key Test Patterns

```typescript
// Pattern 1: Complete workflow test
it('should handle complete permission request-grant-execution flow', async () => {
  const requestId = await orchestrator.requestPermission(...);
  expect(events).toContain('permission:request');

  await orchestrator.grantPermissionConfirmation(requestId, ...);
  expect(events).toContain('permission:granted');
});

// Pattern 2: Permission persistence test
it('should persist granted permissions across operations', async () => {
  await orchestrator.grantPermissionConfirmation(..., 'allow-always', ...);
  const hasPermission = await orchestrator.permissionManager.hasPermission(tool, scope);
  expect(hasPermission).toBe(true);
});

// Pattern 3: Event ordering test
it('should emit events in correct order', async () => {
  const eventLog: string[] = [];
  orchestrator.on('permission:request', () => eventLog.push('request'));
  orchestrator.on('permission:granted', () => eventLog.push('granted'));
  // ... perform operations
  expect(eventLog).toEqual(['request', 'granted']);
});
```

## Consequences

### Positive
- No redundant test code needs to be written
- Existing comprehensive test suite validates all acceptance criteria
- Test patterns are well-established and consistent
- Documentation already exists (permission-test-coverage-report.md)

### Negative
- May need to verify tests still pass with any recent changes
- Some tests may need updates if implementation has changed

### Neutral
- Test infrastructure is already in place
- No new architectural changes required

## Implementation Notes for Development Stage

1. **Run full test suite**: `npm run test`
2. **Run permission-specific tests**: `npm test -- --testPathPattern="permission"`
3. **Verify build passes**: `npm run build`
4. **Review test coverage report**: Check `permission-test-coverage-report.md`
5. **If any tests fail**: Fix issues in implementation or tests
6. **If gaps found**: Add targeted tests for missing scenarios

## References

- [ADR-018: Policy Enforcer Base Class](./ADR-018-policy-enforcer-base-class.md)
- [ADR-026: Policy Events Orchestrator Propagation](./ADR-026-policy-events-orchestrator-propagation.md)
- [ADR-031: Policy Violation Event Types](./ADR-031-policy-violation-event-types.md)
- [ADR-032: Policy Engine Pre-Execution Integration](./ADR-032-policy-engine-pre-execution-integration.md)
- [Permission Test Coverage Report](../__tests__/permission-test-coverage-report.md)
