# Architecture Decision Record: Browser Permission Basic E2E Tests

## ADR-001: E2E Test Architecture for Browser-Permission Integration

### Status
**Approved**

### Context
The APEX platform requires comprehensive end-to-end testing of the integration between the Browser tool and the Permission system. These tests must validate four core scenarios:

1. **Permission Gate Blocking**: Browser operations must be blocked when permissions are denied
2. **Allow-Always Persistence**: Permissions granted with `allow-always` level persist across multiple operations
3. **Allow-Once Consumption**: Permissions granted with `allow-once` level are consumed after single use
4. **Domain Blocklist Enforcement**: Blocked domains are denied regardless of other permission settings

### Decision

#### Test File Location
```
tests/e2e/tri-system-integration/browser-permission-basic.e2e.test.ts
```

#### Architectural Approach

We adopt a **three-layer integration testing architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Layer (E2E Tests)                       │
│  browser-permission-basic.e2e.test.ts                          │
│  - Scenario-driven test organization                            │
│  - Assertion helpers for permission validation                  │
│  - Event sequence verification                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer (test-utils.ts)            │
│  - TriSystemTestEnvironment factory                             │
│  - Mock factories for all 3 systems                             │
│  - Event capture and correlation                                │
│  - Scenario builders (createPermissionDeniedScenario, etc.)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   System Layer (Core Components)                │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ Tool System │  │ Permission Sys  │  │   Browser System    │ │
│  │  - Registry │  │  - Store        │  │  - Tool Interface   │ │
│  │  - Executor │  │  - Manager      │  │  - Session Manager  │ │
│  │  - Mocks    │  │  - Config       │  │  - Mock Browser     │ │
│  └─────────────┘  └─────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### Test Organization Pattern

Each test scenario follows a consistent **Arrange-Act-Assert** pattern with explicit event tracking:

```typescript
describe('Scenario Category', () => {
  let testEnv: TriSystemTestEnvironment;

  beforeEach(async () => {
    testEnv = await createTriSystemTestEnvironment({
      permissionConfig: { preset: 'selective', defaultLevel: 'deny' },
      browserConfig: { backend: 'mock' },
      eventConfig: { captureAll: true, enableCorrelation: true }
    });
    assertTriSystemReady(testEnv);
  });

  afterEach(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  it('should [expected behavior]', async () => {
    // Arrange: Set up specific permissions
    await testEnv.permissionSystem.store.grantPermission(/* ... */);

    // Act: Execute browser operation
    const result = await testEnv.toolSystem.executor.executeWithPermissionCheck(/* ... */);

    // Assert: Verify outcomes
    assertPermissionEnforced(result, 'granted' | 'denied');
    assertBrowserPermissionRespected(result, operation);

    // Verify event flow
    assertTriSystemEventSequence(testEnv.systemEvents.getAllEvents(), [
      { type: 'permission:requested', system: 'permission' },
      { type: 'permission:granted', system: 'permission' },
      { type: 'tool:execution:complete', system: 'tool' }
    ]);
  });
});
```

### Test Scenarios Coverage

#### 1. Permission Gate Blocking Tests
| Test Case | Input | Expected Outcome |
|-----------|-------|------------------|
| Block navigation when denied | `Browser.navigate` with tool denied | `success: false`, `permissionDenied: true` |
| Block click when denied | `Browser.click` with tool denied | `success: false`, `permissionDenied: true` |
| Block screenshot when operation denied | `Browser.screenshot` with op denied | `success: false`, `permissionDenied: true` |

**Event Sequence**:
```
permission:requested → permission:denied → tool:execution:error
```

#### 2. Allow-Always Persistence Tests
| Test Case | Input | Expected Outcome |
|-----------|-------|------------------|
| Multiple operations succeed | 3+ operations after allow-always | All `success: true` |
| Different operations share permission | navigate, click, type, screenshot | All `success: true` |

**Event Sequence** (repeated for each operation):
```
permission:requested → permission:granted → browser:operation:start → browser:operation:complete → tool:execution:complete
```

#### 3. Allow-Once Consumption Tests
| Test Case | Input | Expected Outcome |
|-----------|-------|------------------|
| First operation succeeds | First call after allow-once | `success: true` |
| Second operation denied | Second call to same op | `success: false`, `permissionDenied: true` |
| Separate allow-once scopes work independently | Different operations | Each works once |

**Event Sequence**:
```
[First call]: permission:requested → permission:granted → tool:execution:complete
[Second call]: permission:requested → permission:denied → tool:execution:error
```

#### 4. Domain Blocklist Enforcement Tests
| Test Case | Input | Expected Outcome |
|-----------|-------|------------------|
| Blocked domain denied | Navigate to `malicious.com` | `success: false` with "blocked" error |
| Allowed domain succeeds | Navigate to `example.com` | `success: true` |
| All operations on blocked domain denied | click, screenshot, etc. | All `success: false` |
| Subdomain blocking is granular | Block `specific.site.com` | Only that subdomain blocked |

### Technical Design Details

#### Permission System Integration

The permission system provides three key interfaces:

```typescript
interface PermissionStore {
  checkPermission(tool: AgentTool, scope?: string): Promise<ToolPermissionResult>;
  grantPermission(tool: AgentTool, level: PermissionLevel, scope?: string): Promise<void>;
  denyPermission(tool: AgentTool, scope?: string): Promise<void>;
  clearPermissions(): Promise<void>;
}
```

**Permission Levels**:
- `allow-always`: Permanent permission, persists across all operations
- `allow-once`: Single-use permission, consumed after first use
- `deny`: Explicit denial, blocks all operations

#### Browser Tool Permission Scopes

Browser operations use scoped permissions:

| Operation | Scope Format | Example |
|-----------|--------------|---------|
| navigate | `navigate:{url}` | `navigate:https://example.com` |
| click | `click:{selector}` | `click:#submit-button` |
| screenshot | `screenshot` | `screenshot` |
| evaluate | `evaluate:script_{hash}` | `evaluate:script_a1b2c3` |

#### Event System Integration

Cross-system events enable verification of end-to-end flows:

```typescript
interface SystemEvent {
  id: string;
  type: string;
  system: 'tool' | 'permission' | 'browser';
  data: any;
  timestamp: Date;
  correlationId?: string;
}
```

**Tool System Events**: `tool:execution:start`, `tool:execution:complete`, `tool:execution:error`
**Permission Events**: `permission:requested`, `permission:granted`, `permission:denied`
**Browser Events**: `browser:operation:start`, `browser:operation:complete`, `browser:operation:error`

### Implementation Notes

#### Mock Strategy
All tests use fully mocked browser backend (`backend: 'mock'`) to ensure:
- Deterministic test execution
- No external dependencies
- Fast execution time
- Isolation between tests

#### Resource Cleanup
Every test must clean up resources in `afterEach`:
```typescript
afterEach(async () => {
  if (testEnv) await testEnv.cleanup();
});
```

#### Assertion Helpers
Use specialized helpers for consistent validation:
- `assertPermissionEnforced(result, 'granted'|'denied')` - Validates permission outcome
- `assertBrowserPermissionRespected(result, operation)` - Validates browser metadata
- `assertTriSystemEventSequence(events, sequence)` - Validates event flow
- `assertTriSystemReady(env)` - Validates environment initialization

### Consequences

**Positive**:
- Complete coverage of all four acceptance criteria scenarios
- Deterministic, fast test execution using mocks
- Clear event flow verification across all three systems
- Reusable test infrastructure for future tests

**Negative**:
- Mock-based testing may not catch real browser/permission edge cases
- Requires maintenance as permission system evolves

### References
- [Tri-System Test Infrastructure README](./README.md)
- [Core Types Definition](../../../packages/core/src/types.ts)
- [Permission Schema](../../../packages/core/src/types.ts#L100-L142)
- [Browser Tool Types](../../../packages/core/src/types.ts#L70-L82)
