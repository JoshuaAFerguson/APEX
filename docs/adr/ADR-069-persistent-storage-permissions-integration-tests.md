# ADR-069: Persistent Storage Access Permissions Integration Tests

## Status
Proposed

## Context

The APEX platform needs integration tests for persistent storage access permissions, covering the `navigator.storage.persist()` API and related Storage API permission flows. The existing `@apexcli/browser` package already provides a robust permission mocking system (`packages/browser/src/permission-mocking/`) that supports the W3C Permissions API, including the `'persistent-storage'` permission name. However, there are no tests that specifically exercise:

1. `navigator.storage.persist()` requiring appropriate permissions
2. Storage quota and persistence state reporting via `navigator.storage.estimate()` and `navigator.storage.persisted()`
3. Permission state transitions for the `'persistent-storage'` permission
4. Edge cases like storage pressure and quota exceeded scenarios

### Existing Infrastructure

The codebase provides:
- **MockPermissionStatus** (`packages/browser/src/permission-mocking/mock-permission-status.ts`): Full EventTarget-based mock with state change events
- **mockPermissions / withMockedPermissions** (`packages/browser/src/permission-mocking/mock-permissions.ts`): Factory functions for creating and managing permission mocks
- **Permission types** including `'persistent-storage'` in the `PermissionName` union type
- **Integration test patterns** in `tests/integration/` using `vi.fn()`, temp directories, and structured describe blocks
- **Vitest** with jsdom environment for browser-API tests, node environment for backend tests
- **BrowserStateBuilder** for constructing browser state fixtures

### Gap Analysis

| Capability | Current Status | Needed |
|-----------|---------------|--------|
| `navigator.permissions.query({ name: 'persistent-storage' })` | Supported by mock | Tests needed |
| `navigator.storage.persist()` | Not mocked | Mock + tests needed |
| `navigator.storage.estimate()` | Not mocked | Mock + tests needed |
| `navigator.storage.persisted()` | Not mocked | Mock + tests needed |
| Permission state transitions for storage | MockPermissionStatus supports it | Tests needed |
| Storage pressure simulation | Not available | Mock + tests needed |
| Quota exceeded scenarios | Not available | Mock + tests needed |

## Decision

### 1. Architecture Overview

Create a **StorageManager mock** that integrates with the existing permission mocking system, plus a comprehensive integration test suite.

```
packages/browser/src/
├── permission-mocking/          # Existing - no changes needed
│   ├── types.ts
│   ├── mock-permission-status.ts
│   ├── mock-permissions.ts
│   └── index.ts
└── storage-mocking/             # NEW
    ├── types.ts                 # StorageManager mock types
    ├── mock-storage-manager.ts  # Mock implementation of navigator.storage
    └── index.ts                 # Barrel exports

tests/integration/
└── persistent-storage-permissions.integration.test.ts  # NEW - Integration tests
```

### 2. Mock StorageManager Design

The `MockStorageManager` will simulate the browser's `StorageManager` API with configurable behavior for testing:

```typescript
interface MockStorageManagerConfig {
  /** Initial persisted state */
  initialPersisted: boolean;
  /** Initial quota in bytes */
  quota: number;
  /** Initial usage in bytes */
  usage: number;
  /** Whether persist() should succeed (simulates user/browser decision) */
  persistAllowed: boolean;
  /** Simulate storage pressure (triggers quota pressure events) */
  storagePressure: 'none' | 'moderate' | 'critical';
  /** Link to permission mock for integrated behavior */
  permissionHandle?: MockPermissionHandle;
}

interface MockStorageManagerHandle {
  /** Set the persisted state */
  setPersisted(persisted: boolean): void;
  /** Set storage usage/quota values */
  setEstimate(usage: number, quota: number): void;
  /** Simulate storage pressure */
  simulateStoragePressure(level: 'none' | 'moderate' | 'critical'): void;
  /** Simulate quota exceeded error */
  simulateQuotaExceeded(): void;
  /** Configure whether persist() will succeed */
  setPersistAllowed(allowed: boolean): void;
  /** Restore original navigator.storage */
  restore(): void;
  /** Check if mock is active */
  readonly isActive: boolean;
}
```

**Key Design Decision**: The `MockStorageManager.persist()` method integrates with the permission mocking system:
- If `'persistent-storage'` permission is `'granted'` -> `persist()` returns `true`
- If `'persistent-storage'` permission is `'denied'` -> `persist()` returns `false`
- If `'persistent-storage'` permission is `'prompt'` -> uses `persistAllowed` config value (simulates user response)

### 3. Integration Test Structure

The test suite covers all 5 acceptance criteria organized as follows:

```typescript
describe('Persistent Storage Access Permissions Integration Tests', () => {
  // AC1: navigator.storage.persist() requires appropriate permissions
  describe('AC1: persist() Permission Requirements', () => {
    it('should return true when persistent-storage permission is granted');
    it('should return false when persistent-storage permission is denied');
    it('should respect browser decision when permission is prompt');
    it('should query permission state before attempting persist');
    it('should handle permission check failure gracefully');
  });

  // AC2: Storage quota and persistence states are correctly reported
  describe('AC2: Storage Quota and Persistence State Reporting', () => {
    it('should report correct initial quota via estimate()');
    it('should report current usage via estimate()');
    it('should report persisted state via persisted()');
    it('should update reported values after persist() succeeds');
    it('should reflect quota changes in subsequent estimate() calls');
    it('should report usageDetails breakdown when available');
  });

  // AC3: Permission state transitions for storage access
  describe('AC3: Permission State Transitions', () => {
    it('should transition from prompt to granted on user approval');
    it('should transition from prompt to denied on user rejection');
    it('should transition from granted to denied on revocation');
    it('should fire onchange event on permission state transition');
    it('should update persist() behavior after permission state change');
    it('should handle rapid sequential state transitions');
    it('should maintain consistency between permission and storage state');
  });

  // AC4: Edge cases - storage pressure and quota exceeded
  describe('AC4: Edge Cases', () => {
    describe('Storage Pressure', () => {
      it('should handle moderate storage pressure gracefully');
      it('should restrict persist() under critical storage pressure');
      it('should recover when storage pressure is relieved');
      it('should emit appropriate events during storage pressure');
    });
    describe('Quota Exceeded', () => {
      it('should throw QuotaExceededError when storage is full');
      it('should report accurate quota/usage near capacity');
      it('should handle persist() when quota is near limit');
      it('should handle concurrent persist() and estimate() calls');
    });
    describe('Environment Edge Cases', () => {
      it('should handle navigator.storage being undefined');
      it('should handle permission query timeout');
      it('should handle storage API not being available');
      it('should work correctly with multiple concurrent storage operations');
    });
  });

  // AC5: All tests pass (meta - verified by running suite)
});
```

### 4. Test Environment Configuration

Tests will run in **jsdom** environment (default in `vitest.config.ts`) since they exercise browser APIs (`navigator.storage`, `navigator.permissions`).

The test file location (`tests/integration/`) is automatically included by the main vitest config:
```typescript
include: ['tests/**/*.test.ts']
```

### 5. Integration Points

```
┌──────────────────────────┐     ┌──────────────────────────────┐
│   MockPermissionHandle   │────▶│    MockStorageManagerHandle   │
│  (existing, unchanged)   │     │         (new)                │
│                          │     │                              │
│  setState('persistent-   │     │  persist() checks permission │
│   storage', 'granted')   │     │  estimate() returns quota    │
│                          │     │  persisted() returns state   │
└──────────────────────────┘     └──────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────────────────────────────────────────┐
│              navigator (jsdom environment)                │
│  .permissions.query()  ◀──── MockPermissionHandleImpl    │
│  .storage.persist()    ◀──── MockStorageManagerImpl       │
│  .storage.estimate()   ◀──── MockStorageManagerImpl       │
│  .storage.persisted()  ◀──── MockStorageManagerImpl       │
└──────────────────────────────────────────────────────────┘
```

### 6. Error Simulation Strategies

| Scenario | Simulation Technique |
|----------|---------------------|
| Permission denied | `mockHandle.setState('persistent-storage', 'denied')` |
| Quota exceeded | `storageHandle.simulateQuotaExceeded()` → throws `DOMException('QuotaExceededError')` |
| Storage pressure | `storageHandle.simulateStoragePressure('critical')` → reduces available quota |
| API unavailable | Delete/undefined `navigator.storage` before test |
| Concurrent access | `Promise.all([persist(), estimate(), persisted()])` |
| Permission timeout | Mock `permissions.query()` to return slow/never-resolving promise |

### 7. Convenience Helper

A `withMockedStorage` helper (analogous to `withMockedPermissions`) ensures cleanup:

```typescript
async function withMockedStorage<T>(
  config: MockStorageManagerConfig,
  fn: (storageHandle: MockStorageManagerHandle, permissionHandle: MockPermissionHandle) => Promise<T>
): Promise<T> {
  const permissionHandle = mockPermissions({
    initialStates: { 'persistent-storage': config.persistAllowed ? 'granted' : 'prompt' }
  });
  const storageHandle = mockStorageManager({ ...config, permissionHandle });
  try {
    return await fn(storageHandle, permissionHandle);
  } finally {
    storageHandle.restore();
    permissionHandle.restore();
  }
}
```

## Consequences

### Positive
- Comprehensive coverage of persistent storage permission flows
- Leverages existing permission mocking infrastructure (no duplication)
- Clean separation: `storage-mocking/` module is self-contained and reusable
- Integration with existing permission mock enables realistic permission-storage interaction testing
- Follows established project patterns (test structure, file naming, vitest configuration)

### Negative
- Adds a new mock module (`storage-mocking/`) that must be maintained
- jsdom may not perfectly replicate all browser storage behaviors
- Tests rely on mocks rather than real browser APIs (mitigated by standards-compliant mock design)

### Risks
- jsdom environment may need `navigator.storage` to be manually created (it may not exist by default)
  - Mitigation: Mock sets up `navigator.storage` via `Object.defineProperty`, same pattern as permission mocking
- Future W3C Storage API changes could require mock updates
  - Mitigation: Types are based on current stable spec; mock is designed to be extensible

## Implementation Notes for Next Stages

1. **Developer Stage**: Create `packages/browser/src/storage-mocking/` with the three files specified above
2. **Developer Stage**: Create `tests/integration/persistent-storage-permissions.integration.test.ts`
3. **Tester Stage**: Run full test suite, verify all tests pass, check for regressions
4. **Key dependency**: The `MockStorageManager` must handle the case where `navigator.storage` doesn't exist in jsdom (create it via `Object.defineProperty`)
5. **Export path**: Add storage mocking exports to `packages/browser/src/index.ts` barrel file
