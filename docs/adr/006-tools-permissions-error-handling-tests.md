# ADR 006: Tools-Permissions Error Handling Test Architecture

## Status
Accepted

## Date
2025-02-14

## Context

We need to implement comprehensive tests for error handling in the tools-permissions interaction layer. The acceptance criteria require:

1. Tests verify proper error messages for denied tools
2. Graceful handling of invalid tool names
3. Concurrent permission modifications
4. Database errors

The current codebase has:
- **PermissionManager** (`packages/orchestrator/src/permission-manager.ts`) - High-level permission management with session-level caching
- **PermissionStore** (`packages/orchestrator/src/permission-store.ts`) - SQLite-based persistent storage
- **ApexError** (`packages/core/src/apex-error.ts`) - Custom error hierarchy with permission-specific error codes
- **Existing test infrastructure** - Test utilities, mock factories, and permission test helpers

### Gaps Identified

After thorough exploration, the following test gaps were identified:

1. **Error Message Quality Tests** - Need tests that verify user-friendly error messages are generated for all permission denial scenarios
2. **Invalid Tool Name Handling** - Need tests for graceful handling of non-existent or malformed tool names
3. **Concurrent Permission Modification Tests** - Need tests for race conditions and concurrent access
4. **Database Error Simulation Tests** - Need tests for database connection failures, corruption, and transaction errors

## Decision

### Test Architecture Design

#### 1. Test File Structure

Create a new comprehensive test file:
```
tests/integration/tools-permissions-error-handling.integration.test.ts
```

This file will contain four main test suites corresponding to the acceptance criteria:

```typescript
describe('Tools-Permissions Error Handling Integration Tests', () => {
  describe('1. Proper Error Messages for Denied Tools', () => {
    // Suite 1: Error message quality verification
  });

  describe('2. Graceful Handling of Invalid Tool Names', () => {
    // Suite 2: Invalid tool name scenarios
  });

  describe('3. Concurrent Permission Modifications', () => {
    // Suite 3: Race condition and concurrency tests
  });

  describe('4. Database Error Handling', () => {
    // Suite 4: Database failure scenarios
  });
});
```

#### 2. Test Suite Design

##### Suite 1: Proper Error Messages for Denied Tools

**Purpose**: Verify that permission denial produces clear, user-friendly error messages.

**Test Cases**:
- `should produce user-friendly error message when tool is explicitly denied`
- `should include denial reason in error message`
- `should not expose internal implementation details in error messages`
- `should provide actionable resolution suggestions`
- `should format error messages consistently across tool types`
- `should include tool and scope context in error messages`

**Implementation Pattern**:
```typescript
it('should produce user-friendly error message when tool is explicitly denied', async () => {
  // Grant deny permission
  await permissionManager.grantPermission('Write', '/protected/file.txt', 'deny');

  // Check tool permission
  const result = await permissionManager.checkToolPermission('Write', {
    scope: '/protected/file.txt'
  });

  // Assert error message quality
  expect(result.allowed).toBe(false);
  expect(result.denialReason).toBeDefined();
  expect(result.denialReason).not.toMatch(/undefined|null|TypeError/i);
  expect(result.denialReason!.charAt(0)).toMatch(/[A-Z]/); // Starts with capital
  expect(result.denialReason).toContain('denied');
});
```

##### Suite 2: Graceful Handling of Invalid Tool Names

**Purpose**: Verify system stability when invalid tool names are provided.

**Test Cases**:
- `should handle non-existent tool names without crashing`
- `should handle empty string as tool name`
- `should handle null/undefined tool names`
- `should handle tool names with special characters`
- `should handle very long tool names`
- `should return appropriate error for invalid tools`
- `should not corrupt permission state with invalid tool names`

**Implementation Pattern**:
```typescript
it('should handle non-existent tool names without crashing', async () => {
  const invalidTools = [
    'NonExistentTool',
    'Invalid_Tool_123',
    'Tool-With-Dashes',
    '   ', // Whitespace only
    'A'.repeat(1000), // Very long name
  ];

  for (const tool of invalidTools) {
    // Should not throw
    const result = await permissionManager.checkPermission(tool, 'some-scope');
    // Should return null (no permission exists)
    expect(result).toBeNull();

    // Granting permission should not crash
    await expect(
      permissionManager.grantPermission(tool, 'scope', 'allow-always')
    ).resolves.not.toThrow();

    // Verify system is still functional
    const validResult = await permissionManager.checkPermission('Read', '/valid/path');
    expect(validResult === null || typeof validResult === 'string').toBe(true);
  }
});
```

##### Suite 3: Concurrent Permission Modifications

**Purpose**: Verify correct behavior under concurrent access scenarios.

**Test Cases**:
- `should handle concurrent permission grants for same tool/scope`
- `should handle concurrent permission revocations`
- `should handle rapid grant/revoke cycles`
- `should maintain consistency with concurrent reads and writes`
- `should handle concurrent session cache updates`
- `should serialize conflicting permission operations`

**Implementation Pattern**:
```typescript
it('should handle concurrent permission grants for same tool/scope', async () => {
  const tool = 'Edit';
  const scope = '/concurrent/file.txt';
  const levels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];

  // Concurrent grants
  const promises = levels.map(level =>
    permissionManager.grantPermission(tool, scope, level)
  );

  // Should all complete without error
  await expect(Promise.all(promises)).resolves.toBeDefined();

  // Final state should be one of the levels (last-write-wins)
  const finalLevel = await permissionManager.checkPermission(tool, scope);
  expect(levels).toContain(finalLevel);
});

it('should maintain consistency with concurrent reads and writes', async () => {
  const tool = 'Read';
  const scope = '/concurrent-rw/file.txt';

  // Start concurrent operations
  const operations = [];

  // Writers
  for (let i = 0; i < 10; i++) {
    operations.push(
      permissionManager.grantPermission(tool, scope + i, 'allow-always')
    );
  }

  // Readers (interspersed)
  for (let i = 0; i < 10; i++) {
    operations.push(
      permissionManager.checkPermission(tool, scope + i)
    );
  }

  // All should complete
  await expect(Promise.allSettled(operations)).resolves.toBeDefined();

  // Verify final state is consistent
  for (let i = 0; i < 10; i++) {
    const result = await permissionManager.checkPermission(tool, scope + i);
    expect(result).toBe('allow-always');
  }
});
```

##### Suite 4: Database Error Handling

**Purpose**: Verify graceful handling of database failures.

**Test Cases**:
- `should handle database connection failures gracefully`
- `should handle database query failures`
- `should handle database write failures`
- `should recover from transient database errors`
- `should emit appropriate error events on database failure`
- `should not corrupt data on partial transaction failure`

**Implementation Approach**:
Use mocking to simulate database errors:

```typescript
describe('Database Error Handling', () => {
  let originalStore: PermissionStore;
  let mockStore: MockedObject<PermissionStore>;

  beforeEach(async () => {
    // Create a mock store that can simulate failures
    mockStore = {
      getPermission: vi.fn(),
      savePermission: vi.fn(),
      clearPermission: vi.fn(),
      // ... other methods
    };

    // Inject mock into permission manager
    permissionManager = new PermissionManager(mockStore as any);
  });

  it('should handle database connection failures gracefully', async () => {
    // Simulate database failure
    mockStore.getPermission.mockRejectedValue(
      new Error('SQLITE_ERROR: database is locked')
    );

    // Should throw but with proper error type
    await expect(
      permissionManager.checkPermission('Read', '/path')
    ).rejects.toThrow(/database/i);

    // System should still be operational after error
    mockStore.getPermission.mockResolvedValue(null);
    await expect(
      permissionManager.checkPermission('Read', '/path')
    ).resolves.toBeNull();
  });

  it('should not corrupt data on partial transaction failure', async () => {
    // Simulate partial failure
    let callCount = 0;
    mockStore.savePermission.mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 0) {
        throw new Error('Simulated write failure');
      }
    });

    // Attempt multiple grants
    const results = await Promise.allSettled([
      permissionManager.grantPermission('Read', '/path1', 'allow-always'),
      permissionManager.grantPermission('Write', '/path2', 'deny'),
      permissionManager.grantPermission('Edit', '/path3', 'allow-once'),
    ]);

    // Some should succeed, some should fail
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes.length).toBeGreaterThan(0);
    expect(failures.length).toBeGreaterThan(0);

    // Successful operations should be persisted
    // This would be verified by checking the mock call history
  });
});
```

#### 3. Test Helper Enhancements

Add new helpers to `tests/test-utils/permission-test-helpers.ts`:

```typescript
/**
 * Create a mock PermissionStore that can simulate database errors
 */
export function createMockPermissionStore(options: {
  failOnRead?: boolean;
  failOnWrite?: boolean;
  failAfterCalls?: number;
  simulateLatency?: number;
  simulateLocking?: boolean;
} = {}): MockedPermissionStore;

/**
 * Assert that an error message meets quality standards
 */
export function assertErrorMessageQuality(message: string): void;

/**
 * Create concurrent permission operation scenarios
 */
export function createConcurrencyTestScenarios(): ConcurrencyScenario[];

/**
 * Verify permission state consistency after concurrent operations
 */
export function verifyPermissionStateConsistency(
  manager: PermissionManager,
  expectedState: Map<string, PermissionLevel>
): Promise<void>;
```

#### 4. Error Code Utilization

Leverage existing `ApexErrorCode` values for error testing:

```typescript
// From packages/core/src/apex-error.ts
ApexErrorCode.PERMISSION_DENIED = 'APEX_1801'
ApexErrorCode.PERMISSION_REVOKED = 'APEX_1800'
ApexErrorCode.PERMISSION_EXPIRED = 'APEX_1802'
ApexErrorCode.DATABASE_CONNECTION_FAILED = 'APEX_1600'
ApexErrorCode.DATABASE_QUERY_FAILED = 'APEX_1601'
```

Tests should verify these codes are used appropriately.

#### 5. Test Coverage Metrics

The new test file should achieve:
- **Statement Coverage**: > 90% for permission error paths
- **Branch Coverage**: > 85% for error handling branches
- **Error Path Coverage**: 100% of documented error scenarios

### Integration with Existing Tests

The new tests complement existing test files:
- `tool-permission-boundaries.test.ts` - Permission level verification
- `permission-denials-comprehensive.test.ts` - Denial tracking and re-requests
- `tool-permission-boundaries-edge-cases.test.ts` - Edge case coverage
- `infrastructure-edge-cases.test.ts` - Infrastructure error handling

### Test Dependencies

Required packages (already installed):
- `vitest` - Test runner
- `@apexcli/orchestrator` - PermissionManager, PermissionStore
- `@apexcli/core` - Types, ApexError
- `eventemitter3` - Event tracking

## Consequences

### Positive
- Comprehensive coverage of error handling scenarios
- Improved confidence in system stability under error conditions
- Documentation of expected error behavior
- Foundation for error handling improvements

### Negative
- Additional test maintenance burden
- Tests may need updates if error handling logic changes
- Database error simulation adds complexity

### Risks
- Mocking database errors may not perfectly simulate real failures
- Concurrent tests may be flaky on slow systems

## Implementation Notes

### File to Create
```
tests/integration/tools-permissions-error-handling.integration.test.ts
```

### Estimated Test Count
- Suite 1 (Error Messages): 8-10 tests
- Suite 2 (Invalid Tools): 8-10 tests
- Suite 3 (Concurrency): 8-10 tests
- Suite 4 (Database Errors): 8-10 tests
- **Total**: 32-40 tests

### Dependencies
- No new dependencies required
- Uses existing test infrastructure

### Verification
Run after implementation:
```bash
npm run build
npm run test -- tests/integration/tools-permissions-error-handling.integration.test.ts
```
