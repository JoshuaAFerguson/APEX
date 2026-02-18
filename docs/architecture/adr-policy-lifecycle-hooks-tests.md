# ADR: Policy Lifecycle Hooks Integration Tests

## Status
Proposed

## Date
2025-01-07

## Context

The APEX orchestrator requires comprehensive integration tests for policy lifecycle hooks to ensure:
1. Pre-execution policy checks are called before agent actions
2. Different enforcement modes (block, warn, audit) behave correctly
3. Correct events are emitted for each enforcement mode
4. Multiple policies can be evaluated together
5. PolicyEngine can be disabled or made optional

This ADR defines the technical design for these integration tests.

## Decision

### Test Architecture Overview

The integration tests will be organized into a single comprehensive test file with focused describe blocks:

```
packages/orchestrator/src/__tests__/
└── policy-lifecycle-hooks-integration.test.ts   # Main integration test suite
```

### Test Infrastructure

#### 1. Mock Factory Functions

```typescript
// Helper to create mock PolicyEngine with configurable responses
function createMockPolicyEngine(config: {
  defaultResponse?: PolicyCheckResult;
  enforcementMode?: PolicyEnforcementMode;
}): IPolicyEngine;

// Helper to create mock task with policy-relevant properties
function createMockTask(overrides?: Partial<Task>): Task;

// Helper to create policy configuration with specific enforcement mode
function createPolicyConfig(enforcement: PolicyEnforcementMode): PolicyConfig;

// Helper to create policy check context for tool actions
function createPolicyCheckContext(overrides?: Partial<PolicyCheckContext>): PolicyCheckContext;
```

#### 2. Event Capture Utility

```typescript
interface CapturedEvents {
  violations: PolicyViolationEventData[];
  blocked: PolicyBlockedEventData[];
  warned: PolicyWarnedEventData[];
  audited: PolicyAuditedEventData[];
}

function createEventCapture(orchestrator: ApexOrchestrator): CapturedEvents;
```

#### 3. Temporary Project Setup

```typescript
async function createTestProjectWithPolicy(
  policyConfig: PolicyConfig
): Promise<{ projectPath: string; cleanup: () => Promise<void> }>;
```

### Test Suites Structure

#### Suite 1: Pre-execution Policy Check Invocation

**Acceptance Criteria**: Pre-execution policy check is called before agent actions.

```typescript
describe('Pre-execution Policy Check', () => {
  it('should call PolicyEngine.checkPolicy before tool execution');
  it('should call checkPolicy with correct PolicyCheckContext');
  it('should include taskId, agentId, action, toolName in context');
  it('should include resource path when tool involves file operations');
  it('should include tool arguments in context');
  it('should call checkPolicy before runWorkflowForTask');
  it('should call checkPolicy for each tool invocation within a task');
});
```

**Key Verification Points**:
- Spy on `PolicyEngine.checkPolicy` method
- Verify call order using `mockInvocationCallOrder`
- Verify context contains required fields (taskId, agentId, action, toolName)
- Verify environment context includes projectPath

#### Suite 2: Block Mode Enforcement

**Acceptance Criteria**: Block mode prevents execution and emits correct event.

```typescript
describe('Block Mode Enforcement', () => {
  beforeEach(() => {
    // Configure PolicyEngine with enforcement: 'strict'
    // Mock checkPolicy to return { status: 'deny', violations: [...], enforcementMode: 'strict' }
  });

  it('should prevent task execution when policy returns deny status');
  it('should emit policy:blocked event with correct payload');
  it('should include all violations in blocked event');
  it('should set task status to failed when blocked');
  it('should store policy check result in task state');
  it('should not call workflow execution when blocked');
  it('should emit policy:violation event for each violation');
  it('should include enforcementMode in all events');
});
```

**Event Payload Verification**:
```typescript
interface PolicyBlockedEventData {
  taskId: string;
  agent: string;
  action: string;
  violations: PolicyViolation[];
  enforcementMode: 'strict';
  timestamp: Date;
}
```

#### Suite 3: Warn Mode Enforcement

**Acceptance Criteria**: Warn mode logs and continues with correct event.

```typescript
describe('Warn Mode Enforcement', () => {
  beforeEach(() => {
    // Configure PolicyEngine with enforcement: 'warn'
    // Mock checkPolicy to return { status: 'allow', violations: [...], enforcementMode: 'warn' }
  });

  it('should allow task execution despite violations');
  it('should emit policy:warned event with correct payload');
  it('should emit policy:warned for each warning-level violation');
  it('should continue workflow execution after emitting warnings');
  it('should store violations in task policy check result');
  it('should set task status to in-progress (not failed)');
  it('should block execution for error-level violations even in warn mode');
  it('should emit both policy:warned and policy:blocked when mixed severities');
});
```

**Event Payload Verification**:
```typescript
interface PolicyWarnedEventData {
  taskId: string;
  agent: string;
  action: string;
  violation: PolicyViolation;
  enforcementMode: 'warn';
  timestamp: Date;
}
```

#### Suite 4: Audit Mode Enforcement

**Acceptance Criteria**: Audit mode records silently with correct event.

```typescript
describe('Audit Mode Enforcement', () => {
  beforeEach(() => {
    // Configure PolicyEngine with enforcement: 'audit'
    // Mock checkPolicy to return { status: 'allow', violations: [...], enforcementMode: 'audit' }
  });

  it('should allow task execution regardless of violations');
  it('should emit policy:audited event with correct payload');
  it('should emit policy:audited for all violations (no warnings/blocks)');
  it('should continue workflow execution without interruption');
  it('should store all violations in task policy check result');
  it('should set task status to in-progress');
  it('should include full violation details in audit event');
  it('should not block even for critical-severity violations');
});
```

**Event Payload Verification**:
```typescript
interface PolicyAuditedEventData {
  taskId: string;
  agent: string;
  action: string;
  violation: PolicyViolation;
  enforcementMode: 'audit';
  timestamp: Date;
}
```

#### Suite 5: Multiple Policy Evaluation

**Acceptance Criteria**: Multiple policies can be checked.

```typescript
describe('Multiple Policy Evaluation', () => {
  it('should evaluate multiple registered policies');
  it('should aggregate violations from all policies');
  it('should apply most restrictive enforcement mode');
  it('should emit events for violations from each policy');
  it('should include policyName in each violation');
  it('should handle mixed enforcement modes across policies');
  it('should block if any policy returns deny in strict mode');
  it('should aggregate rule counts from all policies');
});
```

**Multiple Policy Scenario**:
```typescript
// Register multiple policies
policyEngine.registerPolicy(pathPolicy);
policyEngine.registerPolicy(toolPolicy);
policyEngine.registerPolicy(approvalPolicy);

// checkPolicy aggregates results from all policies
const result = await policyEngine.checkPolicy(context);
expect(result.violations).toContainEqual(expect.objectContaining({ policyName: 'path-policy' }));
expect(result.violations).toContainEqual(expect.objectContaining({ policyName: 'tool-policy' }));
```

#### Suite 6: PolicyEngine Optional/Disabled

**Acceptance Criteria**: PolicyEngine can be disabled/optional.

```typescript
describe('PolicyEngine Disabled/Optional', () => {
  describe('when PolicyEngine is not provided', () => {
    it('should create orchestrator without PolicyEngine');
    it('should execute tasks without policy checks');
    it('should not emit any policy events');
    it('should not throw errors during task execution');
  });

  describe('when PolicyEngine is disabled via config', () => {
    beforeEach(() => {
      // Configure with enforcement: 'disabled'
    });

    it('should skip policy evaluation');
    it('should return early from checkPolicy');
    it('should not emit policy events');
    it('should allow all actions');
    it('should include disabled: true in metadata');
  });

  describe('when policy.enabled is false in config', () => {
    it('should not create PolicyEngine');
    it('should execute tasks normally');
    it('should not call checkPolicy');
  });
});
```

### Event Flow Verification

```typescript
describe('Event Flow', () => {
  it('should emit events in correct order: check -> violation -> blocked/warned/audited');
  it('should emit events synchronously during policy check');
  it('should propagate events from PolicyEnforcer to ApexOrchestrator');
  it('should include consistent taskId across all related events');
  it('should include timestamp in all events');
});
```

### Integration Test Implementation Details

#### Test Setup Pattern

```typescript
describe('Policy Lifecycle Hooks Integration', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let mockPolicyEngine: IPolicyEngine;
  let capturedEvents: CapturedEvents;

  beforeEach(async () => {
    // 1. Create temporary project directory
    tempDir = await createTempDirectory('apex-policy-test-');

    // 2. Write minimal config.yaml
    await writeTestConfig(tempDir, { /* minimal config */ });

    // 3. Create mock PolicyEngine
    mockPolicyEngine = createMockPolicyEngine({ enforcementMode: 'warn' });

    // 4. Create orchestrator with injected PolicyEngine
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      policyEngine: mockPolicyEngine,
    });

    // 5. Set up event capture
    capturedEvents = createEventCapture(orchestrator);

    // 6. Mock workflow execution to avoid Claude API calls
    vi.spyOn(orchestrator as any, 'runWorkflowForTask').mockResolvedValue({
      success: true,
      result: 'Task completed',
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupTempDirectory(tempDir);
  });
});
```

#### PolicyEngine Mock Implementation

```typescript
function createMockPolicyEngine(config: {
  defaultResponse?: Partial<PolicyCheckResult>;
  enforcementMode?: PolicyEnforcementMode;
  checkPolicyImpl?: (context: PolicyCheckContext) => Promise<PolicyCheckResult>;
}): IPolicyEngine {
  const enforcementMode = config.enforcementMode ?? 'warn';

  const mockEngine: IPolicyEngine = {
    checkPolicy: vi.fn().mockImplementation(async (context) => {
      if (config.checkPolicyImpl) {
        return config.checkPolicyImpl(context);
      }
      return {
        status: 'allow',
        violations: [],
        enforcementMode,
        checkedAt: new Date(),
        policyName: 'mock-policy',
        policyId: 'mock-policy-id',
        rulesEvaluated: 0,
        rulesPassed: 0,
        rulesFailed: 0,
        durationMs: 10,
        metadata: {},
        ...config.defaultResponse,
      };
    }),
    getEnforcementMode: vi.fn().mockReturnValue(enforcementMode),
    setEnforcementMode: vi.fn(),
    registerPolicy: vi.fn(),
    unregisterPolicy: vi.fn().mockReturnValue(true),
    getPolicies: vi.fn().mockReturnValue([]),
    getPolicy: vi.fn(),
    hasPolicy: vi.fn().mockReturnValue(false),
    clearPolicies: vi.fn(),
  };

  return mockEngine;
}
```

#### Event Capture Implementation

```typescript
function createEventCapture(orchestrator: ApexOrchestrator): CapturedEvents {
  const captured: CapturedEvents = {
    violations: [],
    blocked: [],
    warned: [],
    audited: [],
  };

  orchestrator.on('policy:violation', (event) => captured.violations.push(event));
  orchestrator.on('policy:blocked', (event) => captured.blocked.push(event));
  orchestrator.on('policy:warned', (event) => captured.warned.push(event));
  orchestrator.on('policy:audited', (event) => captured.audited.push(event));

  return captured;
}
```

### Assertion Patterns

#### Verifying Pre-execution Check Order

```typescript
it('should call checkPolicy before workflow execution', async () => {
  const checkPolicySpy = vi.spyOn(mockPolicyEngine, 'checkPolicy');
  const workflowSpy = vi.spyOn(orchestrator as any, 'runWorkflowForTask');

  await orchestrator.executeTask(task.id);

  const checkPolicyOrder = checkPolicySpy.mock.invocationCallOrder[0];
  const workflowOrder = workflowSpy.mock.invocationCallOrder[0];

  expect(checkPolicyOrder).toBeLessThan(workflowOrder);
});
```

#### Verifying Event Payloads

```typescript
it('should emit policy:blocked with correct payload', async () => {
  (mockPolicyEngine.checkPolicy as MockedFunction<any>).mockResolvedValue({
    status: 'deny',
    violations: [testViolation],
    enforcementMode: 'strict',
    // ... other fields
  });

  await expect(orchestrator.executeTask(task.id)).rejects.toThrow();

  expect(capturedEvents.blocked).toHaveLength(1);
  expect(capturedEvents.blocked[0]).toMatchObject({
    taskId: task.id,
    agent: expect.any(String),
    action: expect.any(String),
    violations: expect.arrayContaining([
      expect.objectContaining({ id: testViolation.id }),
    ]),
    enforcementMode: 'strict',
    timestamp: expect.any(Date),
  });
});
```

#### Verifying Policy Context

```typescript
it('should include correct context in policy check', async () => {
  await orchestrator.executeTask(task.id);

  expect(mockPolicyEngine.checkPolicy).toHaveBeenCalledWith(
    expect.objectContaining({
      taskId: task.id,
      agentId: expect.any(String),
      action: expect.any(String),
      toolName: expect.any(String),
      environment: expect.objectContaining({
        projectPath: tempDir,
      }),
    }),
    expect.any(Object) // options
  );
});
```

### Test Data Fixtures

```typescript
// Standard test violation
const testViolation: PolicyViolation = {
  id: 'test-violation-1',
  rule: 'blocked-path',
  policyType: 'path',
  severity: 'high',
  message: 'Access to blocked path denied',
  blocking: true,
  description: 'Path matches block pattern',
  resource: '/secrets/api-key.txt',
  context: { matchedPattern: 'secrets/**' },
  timestamp: new Date(),
  resolved: false,
};

// Standard task for testing
const testTask: Partial<Task> = {
  description: 'Test task for policy integration',
  workflow: 'feature-development',
  autonomy: 'autonomous',
  priority: 'medium',
  effort: 'small',
};
```

## Consequences

### Positive

1. **Comprehensive Coverage**: All acceptance criteria are covered by specific test cases
2. **Isolated Tests**: Each enforcement mode is tested in isolation
3. **Event Verification**: All policy events are captured and verified
4. **Reusable Infrastructure**: Mock factories and helpers can be reused
5. **Clear Structure**: Test organization mirrors acceptance criteria

### Negative

1. **Test Complexity**: Complex mock setup required for PolicyEngine integration
2. **Maintenance**: Tests depend on internal orchestrator structure
3. **Execution Time**: Integration tests may be slower than unit tests

### Mitigation

1. Use beforeEach/afterEach for consistent setup/teardown
2. Create shared test utilities in a separate file if needed
3. Mark slow tests with `it.slow()` for CI optimization

## Implementation Notes

### Dependencies

- vitest (test framework)
- eventemitter3 (for event capture)
- @apexcli/core (for type definitions)

### File Location

```
packages/orchestrator/src/__tests__/policy-lifecycle-hooks-integration.test.ts
```

### Estimated Test Count

- Pre-execution checks: 7 tests
- Block mode: 8 tests
- Warn mode: 8 tests
- Audit mode: 8 tests
- Multiple policies: 8 tests
- Disabled/optional: 9 tests
- Event flow: 5 tests

**Total: ~53 integration tests**

## Related Documents

- ADR-018: PolicyEnforcer Base Class
- ADR-020: PolicyEnforcer Event Emission
- ADR-026: Policy Events Orchestrator Propagation
- ADR-031: Policy Violation Event Types
- ADR-032: Policy Engine Pre-Execution Integration
