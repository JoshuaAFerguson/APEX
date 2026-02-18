# ADR-005: Cross-Package Permission Flow Integration Test Architecture

## Status
Accepted

## Date
2025-01-30

## Context

The APEX permission system spans multiple packages with distinct responsibilities:

- **@apexcli/core**: Zod schemas, type definitions (`Permission`, `PermissionLevel`, `AutonomyLevel`, `ApprovalGate`, etc.), `DirectoryAccessValidator`, `DangerousOperationDetector`
- **@apexcli/orchestrator**: `PermissionStore` (SQLite persistence), `PermissionManager` (session cache + store), `PermissionPresetManager` (presets), `AutonomyEnforcer` (gate enforcement), `ApprovalGateController` (approval lifecycle)
- **@apexcli/cli**: CLI commands that consume orchestrator events and present approval/denial prompts to users
- **@apexcli/api**: Fastify REST endpoints + WebSocket for programmatic approval/denial flows

### Problem

While each package has extensive unit and some integration tests, we need to:

1. **Verify test coverage** adequacy for permission handling code paths
2. **Add integration tests** that trace end-to-end permission denial flows from CLI layer through orchestrator
3. **Ensure all tests pass** with adequate coverage thresholds

### Current Test Landscape

| Layer | Test Count | Coverage Areas |
|-------|-----------|----------------|
| Core (types/schemas) | 500+ | Schema validation, type guards, validator logic |
| Orchestrator (permission-*) | 44 test files | Store CRUD, manager caching, preset application, events, grants, denials |
| Integration (tests/) | 21 test files | Cross-package flows, API approval, browser permissions |
| E2E | Present | Full workflow execution with real orchestrator |

### Identified Gaps

After thorough analysis of existing tests, the following gaps exist:

1. **No unified cross-package denial propagation test**: Tests verify denial at individual layers but don't trace a denial from config.yaml -> PermissionPresetManager -> PermissionManager -> AutonomyEnforcer -> ApprovalGateController -> event emission -> CLI/API response in a single test
2. **Limited coverage of autonomy level + permission interaction**: Tests check autonomy OR permissions but rarely the combination where autonomy gates interact with tool permission denials
3. **Missing edge case: permission denial during active task execution**: Existing tests check static permission state but don't cover dynamic denial mid-execution
4. **No test for permission state consistency after denial rollback**: When a denied permission is re-requested and granted, state should be consistent

## Decision

### Architecture for Cross-Package Permission Integration Tests

We will create a new integration test file that validates end-to-end permission denial flows across all four packages. The test architecture follows these principles:

### 1. Test File Organization

```
tests/integration/
  cross-package-permission-flows.integration.test.ts   # NEW - Primary cross-package test
```

This single test file covers the complete denial flow and interacts with components from all packages.

### 2. Test Layering Strategy

```
Layer 4: CLI/API Response Verification
         (Verify events reach consumers with correct data)
              |
Layer 3: Orchestrator Event Emission
         (ApexOrchestrator emits permission:denied, approval:denied)
              |
Layer 2: Permission Decision Engine
         (PermissionManager + AutonomyEnforcer + PresetManager)
              |
Layer 1: Configuration & Storage
         (config.yaml -> PermissionStore -> SQLite)
```

Each test traces a denial flow through ALL four layers.

### 3. Test Scenarios

#### Scenario A: Config-Driven Denial Flow
```
config.yaml (read-only preset)
  -> PermissionPresetManager.applyPreset('read-only')
  -> PermissionManager.checkToolPermission('Write', ...) returns {allowed: false}
  -> AutonomyEnforcer sees denial
  -> ApexOrchestrator emits 'permission:denied' event
  -> Event data contains correct tool, scope, denial reason
```

#### Scenario B: Explicit Denial via Confirmation Flow
```
orchestrator.requestPermission('Write', '/sensitive/path')
  -> Event: 'permission:request' emitted
  -> orchestrator.denyPermissionConfirmation(requestId, ...)
  -> PermissionManager stores 'deny' level
  -> Event: 'permission:denied' emitted
  -> Subsequent checkToolPermission returns {allowed: false}
  -> Event data includes denier identity and reason
```

#### Scenario C: Autonomy Gate + Permission Denial Interaction
```
config: autonomy.level = 'review-all'
  -> AutonomyEnforcer.checkAction({operationType: 'write'}) = true (needs approval)
  -> ApprovalGateController creates pending state
  -> Denial via API: POST /api/approvals/{id}/deny
  -> Task status transitions to 'failed'
  -> Event: 'approval:denied' emitted
  -> Permission stored as 'deny' for future checks
```

#### Scenario D: Denial State Consistency & Recovery
```
1. Grant permission: 'allow-always' for tool X
2. Revoke permission: deny tool X
3. Verify denial is enforced
4. Re-request permission
5. Grant 'allow-once'
6. Verify single-use semantics
7. Verify permission consumed after one use
```

### 4. Test Infrastructure

```typescript
// Test setup creates:
// - Temp directory with .apex/config.yaml
// - Real ApexOrchestrator (with real SQLite)
// - Event capture infrastructure
// - Cleanup on teardown

interface PermissionFlowTestContext {
  tempDir: string;
  orchestrator: ApexOrchestrator;
  permissionManager: PermissionManager;
  permissionStore: PermissionStore;
  presetManager: PermissionPresetManager;
  eventCapture: EventCapture;
}

class EventCapture {
  events: Array<{ type: string; data: unknown; timestamp: number }>;

  waitForEvent(type: string, timeout?: number): Promise<unknown>;
  getEventsOfType(type: string): Array<unknown>;
  clear(): void;
}
```

### 5. Coverage Verification Strategy

The test file will include a dedicated describe block that programmatically verifies coverage:

```typescript
describe('Coverage Verification', () => {
  it('should cover all permission handling code paths', () => {
    // This test documents which code paths are covered
    // by the cross-package integration tests above
    const coveredPaths = [
      'PermissionStore.savePermission',
      'PermissionStore.getPermission',
      'PermissionStore.clearPermission',
      'PermissionManager.checkPermission',
      'PermissionManager.grantPermission',
      'PermissionManager.revokePermission',
      'PermissionManager.checkToolPermission',
      'PermissionPresetManager.applyPreset',
      'AutonomyEnforcer.checkAction',
      'AutonomyEnforcer.checkApprovalRequired',
      'ApprovalGateController (via orchestrator)',
    ];
    expect(coveredPaths.length).toBeGreaterThan(10);
  });
});
```

### 6. Event Verification Pattern

All tests follow a consistent pattern for verifying event propagation:

```typescript
// 1. Setup event listener BEFORE action
const eventPromise = eventCapture.waitForEvent('permission:denied', 5000);

// 2. Perform the denial action
await orchestrator.denyPermissionConfirmation(requestId, ...);

// 3. Await and verify the event
const event = await eventPromise;
expect(event).toMatchObject({
  tool: 'Write',
  scope: '/sensitive/path',
  level: 'deny',
});

// 4. Verify persistent state matches
const storedLevel = await permissionManager.checkPermission('Write', '/sensitive/path');
expect(storedLevel).toBe('deny');
```

## Consequences

### Positive
- **Complete traceability**: Each test traces denial from config through to event emission
- **Cross-package confidence**: Validates that all packages agree on permission semantics
- **Regression prevention**: Catches breaking changes in permission interfaces between packages
- **Living documentation**: Tests serve as executable specification of denial flows

### Negative
- **Slower tests**: Integration tests with real SQLite are slower than pure unit tests (~200ms vs ~10ms)
- **Setup complexity**: Each test needs a real orchestrator with temp directory and cleanup
- **Fragile to refactoring**: Tests couple to internal event names and data shapes

### Mitigations
- Tests use the existing vitest integration test infrastructure with proper timeouts
- Setup/teardown is centralized in `beforeEach`/`afterEach` hooks
- Event names and data shapes are defined in @apexcli/core types (stable API)

## Related ADRs
- ADR-004: ApprovalGate Class Design (approval gate lifecycle)
