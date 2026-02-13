# ADR-147: Permission Integration Test Coverage Architecture

**Status**: Proposed
**Date**: 2026-02-12
**Context**: Technical architecture for verifying test coverage and adding integration tests for cross-package permission flows
**Related**: ADR-082 (Permission Coverage Gap Remediation), ADR-071 (Comprehensive Permission Test-to-Code Mapping)

---

## 1. Executive Summary

This ADR provides the **technical architecture** for verifying test coverage and implementing integration tests that verify end-to-end permission denial flows from CLI through orchestrator. This fulfills the acceptance criteria:

- **Test coverage report** shows adequate coverage for permission handling code paths
- **Integration tests** verify end-to-end permission denial flows from CLI through orchestrator
- **All tests pass**

---

## 2. Architecture Decision

### 2.1 Decision Summary

We will implement a **cross-package integration test architecture** that:

1. **Leverages existing test infrastructure** established in `tests/integration/`
2. **Validates permission flow paths** across CLI → Orchestrator → Core packages
3. **Uses event-driven test verification** to trace permission decisions through the stack
4. **Ensures coverage reporting** for critical permission handling code paths

### 2.2 Rationale

- **Existing Infrastructure**: The codebase already has robust integration test patterns in `tests/integration/cross-package-permission-flows.integration.test.ts` and `tests/integration/dynamic-permission-flows.integration.test.ts`
- **Event-Driven Architecture**: APEX uses EventEmitter-based permission events, making event capture an effective test verification strategy
- **Cross-Package Dependencies**: Permission decisions flow through multiple packages (Core → Orchestrator → CLI → API), requiring integration-level testing

---

## 3. Current Test Coverage Analysis

### 3.1 Existing Integration Tests

The following integration test files already exist and provide substantial coverage:

| Test File | Coverage Focus |
|-----------|----------------|
| `tests/integration/cross-package-permission-flows.integration.test.ts` | Complete denial flow tracing, error propagation, dynamic permission management |
| `tests/integration/dynamic-permission-flows.integration.test.ts` | Real-time revocation, concurrent access, session recovery |
| `tests/integration/browser-permission-denied-graceful-comprehensive.integration.test.ts` | Browser automation graceful denial handling |
| `packages/cli/src/__tests__/permission-cross-package-integration.test.ts` | CLI-Orchestrator-Core integration |

### 3.2 Key Code Paths Covered

Based on analysis of existing tests:

| Code Path | Coverage Status | Test Location |
|-----------|----------------|---------------|
| `PermissionStore.savePermission` | ✅ Covered | cross-package-permission-flows.integration.test.ts |
| `PermissionStore.getPermission` | ✅ Covered | cross-package-permission-flows.integration.test.ts |
| `PermissionStore.clearPermission` | ✅ Covered | cross-package-permission-flows.integration.test.ts |
| `PermissionManager.checkPermission` | ✅ Covered | dynamic-permission-flows.integration.test.ts |
| `PermissionManager.grantPermission` | ✅ Covered | dynamic-permission-flows.integration.test.ts |
| `PermissionManager.checkToolPermission` | ✅ Covered | Both integration test files |
| `ApexOrchestrator event emission` | ✅ Covered | Both integration test files |
| `Permission revocation during execution` | ✅ Covered | dynamic-permission-flows.integration.test.ts |
| `Concurrent permission access` | ✅ Covered | dynamic-permission-flows.integration.test.ts |
| `Permission state recovery` | ✅ Covered | dynamic-permission-flows.integration.test.ts |

### 3.3 Coverage Gaps Identified

The following areas may need additional coverage verification:

1. **CLI → Orchestrator Event Wiring**: The actual wiring of CLI event handlers to orchestrator events
2. **Session Cache Cleanup on Manager Restart**: Edge case for session-level cache persistence
3. **Tool Config Integration with Permission Checks**: ToolPermissionConfig usage in permission decisions

---

## 4. Technical Design

### 4.1 Test Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Integration Test Layer                    │
│  tests/integration/cross-package-permission-flows.test.ts   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Test Infrastructure                       │
│  - PermissionFlowTestContext (temp dir, orchestrator, etc)  │
│  - EventCapture (event collection & waiting)                │
│  - Isolated test environments per test                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Package Under Test                        │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │    CLI      │──│   Orchestrator    │──│     Core      │  │
│  │ (UI/Input)  │  │ (Task Execution)  │  │   (Types/    │  │
│  │             │  │                    │  │   Schemas)   │  │
│  └─────────────┘  └──────────────────┘  └───────────────┘  │
│        │                   │                    │           │
│        └───────────────────┴────────────────────┘           │
│                            │                                 │
│               PermissionManager + PermissionStore            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Event Capture Architecture

```typescript
/**
 * EventCapture class for integration test verification
 * Used to collect and wait for permission events across packages
 */
class EventCapture extends EventEmitter {
  private events: Array<{ type: string; data: unknown; timestamp: number }> = [];

  constructor() {
    super();
    this.onAny((type: string, data: unknown) => {
      this.events.push({ type, data, timestamp: Date.now() });
    });
  }

  /**
   * Wait for a specific event type with timeout
   */
  async waitForEvent(type: string, timeout = 5000): Promise<unknown>;

  /**
   * Get all events of a specific type
   */
  getEventsOfType(type: string): Array<unknown>;

  /**
   * Get events within a time range (for ordering verification)
   */
  getEventsInTimeRange(startTime: number, endTime: number): Array<{...}>;
}
```

### 4.3 Test Context Factory

```typescript
/**
 * Creates isolated test context with full orchestrator initialization
 */
async function createTestContext(): Promise<PermissionFlowTestContext> {
  // 1. Create temp directory for test isolation
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-permission-test-'));

  // 2. Create .apex directory with config.yaml
  const apexDir = path.join(tempDir, '.apex');
  await fs.mkdir(apexDir, { recursive: true });
  await fs.writeFile(path.join(apexDir, 'config.yaml'), testConfigYaml);

  // 3. Initialize orchestrator
  const orchestrator = new ApexOrchestrator();
  await orchestrator.init(tempDir);

  // 4. Extract permission components
  const permissionManager = orchestrator.permissionManager;
  const permissionStore = orchestrator.permissionStore;

  // 5. Wire up event capture
  const eventCapture = new EventCapture();
  orchestrator.on('permission:denied', (data) => eventCapture.emit('permission:denied', data));
  orchestrator.on('permission:granted', (data) => eventCapture.emit('permission:granted', data));
  // ... more events

  // 6. Return context with cleanup function
  return { tempDir, orchestrator, permissionManager, permissionStore, eventCapture, cleanup };
}
```

### 4.4 Critical Test Scenarios

#### 4.4.1 Complete Denial Flow (CLI → Orchestrator → Store)

```typescript
describe('Complete Permission Denial Flow', () => {
  it('should trace denial from config to event emission', async () => {
    const { permissionManager, eventCapture } = context;

    // Setup: Listen for denial event BEFORE action
    const denialPromise = eventCapture.waitForEvent('permission:denied', 5000);

    // Action: Check permission for denied tool
    const result = await permissionManager.checkToolPermission('Write', {
      scope: '/test/file.txt'
    });

    // Verify: Permission denied
    expect(result.allowed).toBe(false);
    expect(result.denialReason).toContain('denied');

    // Verify: Event emitted correctly
    const denialEvent = await denialPromise;
    expect(denialEvent).toMatchObject({
      tool: 'Write',
      scope: '/test/file.txt',
      level: 'deny'
    });

    // Verify: Persistent state consistent
    const storedPermission = await permissionManager.checkPermission('Write', '/test/file.txt');
    expect(storedPermission).toBe('deny');
  });
});
```

#### 4.4.2 Dynamic Permission Revocation

```typescript
describe('Dynamic Permission Revocation', () => {
  it('should handle mid-task permission revocation gracefully', async () => {
    const { permissionManager, eventCapture } = context;

    // Step 1: Grant initial permission
    await permissionManager.grantPermission('Bash', 'allow-always', 'test-command');

    // Step 2: Verify permission active
    const initialCheck = await permissionManager.checkToolPermission('Bash', {
      scope: 'test-command'
    });
    expect(initialCheck.allowed).toBe(true);

    // Step 3: Revoke permission (simulating admin action during task)
    const denialPromise = eventCapture.waitForEvent('permission:denied', 3000);
    await permissionManager.grantPermission('Bash', 'deny', 'test-command');
    await denialPromise;

    // Step 4: Verify subsequent checks denied
    const subsequentCheck = await permissionManager.checkToolPermission('Bash', {
      scope: 'test-command'
    });
    expect(subsequentCheck.allowed).toBe(false);
  });
});
```

#### 4.4.3 Concurrent Permission Access

```typescript
describe('Concurrent Permission Access', () => {
  it('should handle concurrent permission checks consistently', async () => {
    const { permissionManager } = context;

    // Grant permission
    await permissionManager.grantPermission('Read', 'allow-always', '/shared/file.txt');

    // Run 10 concurrent checks
    const concurrentChecks = Array.from({ length: 10 }, () =>
      permissionManager.checkToolPermission('Read', { scope: '/shared/file.txt' })
    );

    const results = await Promise.all(concurrentChecks);

    // All should succeed consistently
    results.forEach(result => {
      expect(result.allowed).toBe(true);
    });
  });

  it('should handle concurrent permission modifications', async () => {
    const { permissionManager } = context;

    const tool = 'Write';
    const scope = '/concurrent/test.txt';

    // Concurrent modifications (last write wins)
    const modifications = [
      permissionManager.grantPermission(tool, 'allow-once', scope),
      permissionManager.grantPermission(tool, 'deny', scope),
      permissionManager.grantPermission(tool, 'allow-always', scope)
    ];

    await Promise.all(modifications);

    // Final state should be consistent
    const finalState = await permissionManager.checkPermission(tool, scope);
    expect(['allow-once', 'deny', 'allow-always']).toContain(finalState);
  });
});
```

---

## 5. Coverage Verification Approach

### 5.1 Coverage Report Generation

```bash
# Run tests with coverage for permission-related code
npm test -- --coverage \
  --collectCoverageFrom='packages/*/src/**/*.ts' \
  --coveragePathIgnorePatterns='node_modules|dist|__tests__|\.d\.ts$' \
  --testNamePattern='permission|Permission'

# Generate coverage report
npm test -- --coverage --coverageReporters="text" --coverageReporters="lcov"
```

### 5.2 Coverage Thresholds

| Component | Target Coverage |
|-----------|-----------------|
| `PermissionStore` | ≥ 90% |
| `PermissionManager` | ≥ 90% |
| `ApexOrchestrator` (permission paths) | ≥ 85% |
| Integration test scenarios | 100% of critical paths |

### 5.3 Critical Paths Checklist

- [x] Permission grant (allow-always, allow-once, deny)
- [x] Permission check (with/without consumption)
- [x] Permission revocation
- [x] Session cache behavior
- [x] Event emission on permission changes
- [x] Concurrent access handling
- [x] Database persistence and recovery
- [x] Cross-package event propagation

---

## 6. Files to Verify/Create

### 6.1 Existing Tests (Verify Pass)

| File | Purpose |
|------|---------|
| `tests/integration/cross-package-permission-flows.integration.test.ts` | Cross-package denial flows |
| `tests/integration/dynamic-permission-flows.integration.test.ts` | Dynamic permission scenarios |
| `packages/cli/src/__tests__/permission-cross-package-integration.test.ts` | CLI integration |

### 6.2 Coverage Verification Script

Create `scripts/verify-permission-coverage.ts`:

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';

interface CoverageResult {
  total: { statements: { pct: number } };
}

function main() {
  // Run tests with coverage
  execSync('npm test -- --coverage --json --outputFile=coverage/coverage-summary.json', {
    stdio: 'inherit'
  });

  // Read coverage summary
  const summary: CoverageResult = JSON.parse(
    fs.readFileSync('coverage/coverage-summary.json', 'utf-8')
  );

  // Verify thresholds
  const statementCoverage = summary.total.statements.pct;

  if (statementCoverage < 85) {
    console.error(`Coverage ${statementCoverage}% is below threshold 85%`);
    process.exit(1);
  }

  console.log(`✅ Permission coverage: ${statementCoverage}%`);
}

main();
```

---

## 7. Verification Steps

### 7.1 Build Verification

```bash
npm run build
# Must pass with NO errors
```

### 7.2 Test Verification

```bash
npm run test
# ALL tests must pass
```

### 7.3 Integration Test Verification

```bash
# Run specific integration tests
npm test -- --testPathPattern='tests/integration/.*permission.*'

# Run cross-package tests
npm test -- --testPathPattern='cross-package-permission'
npm test -- --testPathPattern='dynamic-permission'
```

---

## 8. Success Criteria

1. ✅ **Build passes** with no errors
2. ✅ **All tests pass** including integration tests
3. ✅ **Coverage report** shows adequate coverage (≥85%) for:
   - `packages/orchestrator/src/permission-store.ts`
   - `packages/orchestrator/src/permission-manager.ts`
   - `packages/orchestrator/src/index.ts` (permission-related paths)
4. ✅ **Integration tests** verify end-to-end permission denial flows:
   - CLI config → Orchestrator → PermissionStore
   - Event emission for permission:denied, permission:granted
   - Dynamic revocation handling
   - Concurrent access scenarios

---

## 9. Conclusion

This architecture leverages the existing robust integration test infrastructure in APEX to verify permission handling coverage. The key findings are:

1. **Existing tests already provide substantial coverage** of critical permission paths
2. **Event-driven test verification** is the appropriate pattern for cross-package flows
3. **Test context isolation** ensures reliable, reproducible test runs

The implementation phase should focus on:
- Running existing tests to verify they pass
- Generating coverage reports to document coverage levels
- Addressing any identified gaps through targeted test additions

---

*Generated by Architect Agent*
*Date: 2026-02-12*
