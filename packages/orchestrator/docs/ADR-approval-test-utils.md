# ADR: Approval Flow Test Utilities Architecture

## Status
Accepted

## Context
The APEX orchestrator requires comprehensive test utilities for simulating approval workflows, including pending approvals, auto-approvals, rejections, and timeouts. Currently, tests for approval flows are verbose and require significant setup code (see `approval-gates.test.ts`, `approval-workflow-pause-resume.test.ts`). A centralized set of utilities following established patterns from `test-utils.ts` and `@apexcli/core/test-fixtures/mock-factories.ts` will streamline test development.

## Decision
Create a new `approval-test-utils.ts` module in `packages/orchestrator/src/` that provides:

### 1. Mock Factory Functions
Following the established pattern from `@apexcli/core/test-fixtures/mock-factories.ts`:

```typescript
// Core mock factories
createMockApprovalState(overrides?: Partial<ApprovalState>): ApprovalState
createMockApprovalGate(overrides?: Partial<ApprovalGate>): ApprovalGate
createMockApprovalRequest(overrides?: Partial<ApprovalRequest>): ApprovalRequest
createMockApprovalResponse(overrides?: Partial<ApprovalResponse>): ApprovalResponse
```

### 2. Pre-built Fixtures
Following the pattern from `@apexcli/core/test-utils/autonomy-fixtures.ts`:

```typescript
// Pre-built approval state fixtures
export const ApprovalStateFixtures = {
  pending: ApprovalState,           // Pending approval
  approved: ApprovalState,          // Approved state
  denied: ApprovalState,            // Denied state
  expired: ApprovalState,           // Timed-out state
  multiApprovalPending: ApprovalState,  // Multi-approval in progress
  multiApprovalComplete: ApprovalState, // Multi-approval complete
};

// Pre-built gate configuration fixtures
export const ApprovalGateFixtures = {
  stageCompletion: ApprovalGate,
  deployment: ApprovalGate,
  security: ApprovalGate,
  codeReview: ApprovalGate,
  autoApprove: ApprovalGate,
  shortTimeout: ApprovalGate,
  multiApprover: ApprovalGate,
};
```

### 3. Workflow Simulation Utilities
Helper functions for simulating complete approval workflows:

```typescript
// MockApprovalWorkflow - simulate full approval flow
class MockApprovalWorkflow {
  constructor(options: MockApprovalWorkflowOptions);

  // Simulate pending approval
  async createPendingApproval(gateConfig?: ApprovalGate): Promise<ApprovalState>;

  // Simulate auto-approval
  async simulateAutoApproval(gateConfig?: ApprovalGate): Promise<ApprovalResult>;

  // Simulate rejection
  async simulateRejection(reason?: string): Promise<ApprovalResult>;

  // Simulate timeout
  async simulateTimeout(): Promise<ApprovalResult>;

  // Multi-step approval chains
  async createApprovalChain(gates: ApprovalGate[]): ApprovalChainContext;

  // Clean up resources
  dispose(): void;
}

// Approval chain for multi-step workflows
interface ApprovalChainContext {
  gates: ApprovalGateController[];
  approveNext(approver: string, comment?: string): Promise<boolean>;
  denyNext(approver: string, reason: string): Promise<boolean>;
  approveAll(approver: string): Promise<void>;
  denyAll(approver: string, reason: string): Promise<void>;
  getCurrentPending(): ApprovalGateController | undefined;
  getAllStates(): ApprovalState[];
}
```

### 4. State Transition Testing Helpers

```typescript
// Approval state machine helpers
export const ApprovalStateTransitions = {
  // Verify valid state transitions
  canTransitionTo(from: ApprovalStatus, to: ApprovalStatus): boolean;

  // Get valid next states
  getValidNextStates(currentStatus: ApprovalStatus): ApprovalStatus[];

  // Create a state at a specific point in the lifecycle
  createAtState(status: ApprovalStatus, overrides?: Partial<ApprovalState>): ApprovalState;
};

// Assertion helpers
export async function assertApprovalState(
  state: ApprovalState,
  expected: Partial<ApprovalState>
): Promise<void>;

export async function assertApprovalEvent(
  emitter: EventEmitter,
  eventName: string,
  timeout?: number
): Promise<ApprovalState>;
```

### 5. Test Environment Setup

```typescript
// Create isolated approval testing environment
interface ApprovalTestEnvironment {
  store: TaskStore;
  task: Task;
  emitter: EventEmitter;
  cleanup: () => Promise<void>;
}

async function createApprovalTestEnvironment(
  options?: ApprovalTestEnvironmentOptions
): Promise<ApprovalTestEnvironment>;

// Quick setup for common scenarios
async function setupPendingApprovalTest(): Promise<{
  env: ApprovalTestEnvironment;
  controller: ApprovalGateController;
  approvalPromise: Promise<ApprovalResult>;
}>;

async function setupMultiApprovalTest(
  requiredApprovals: number
): Promise<{
  env: ApprovalTestEnvironment;
  controller: ApprovalGateController;
  approvalPromise: Promise<ApprovalResult>;
}>;
```

## Architecture

### Module Structure
```
packages/orchestrator/src/
├── approval-test-utils.ts          # Main test utilities (NEW)
├── __tests__/
│   └── approval-test-utils.test.ts # Tests for utilities (NEW)
└── test-utils.ts                   # Existing utilities (re-export)
```

### Dependencies
- `@apexcli/core`: Type definitions (ApprovalState, ApprovalGate, etc.)
- `eventemitter3`: Event simulation
- `./store`: TaskStore for persistence
- `./approval-gate-controller`: ApprovalGateController

### Integration Points
1. **test-utils.ts**: Re-export approval test utilities for convenience
2. **TaskStore**: Uses `createTestTaskStore()` for isolated DB
3. **ApprovalGateController**: Wraps for simplified testing

## Design Patterns

### 1. Builder Pattern for Complex Fixtures
```typescript
// Fluent builder for complex approval scenarios
const scenario = new ApprovalScenarioBuilder()
  .withGate({ type: 'deployment', timeout: 60 })
  .withTask({ description: 'Deploy to prod' })
  .withPendingState()
  .build();
```

### 2. Factory Pattern with Sensible Defaults
All factory functions provide sensible defaults while allowing overrides:
```typescript
const state = createMockApprovalState({
  status: 'approved',  // Override only what you need
  approver: 'security-team'
});
```

### 3. Cleanup Pattern
All utilities that create resources return cleanup functions:
```typescript
const { env, cleanup } = await createApprovalTestEnvironment();
// ... tests
await cleanup(); // Clean up DB, event listeners, etc.
```

## Consequences

### Positive
- Reduced test boilerplate (60-70% reduction in setup code)
- Consistent test patterns across approval-related tests
- Type-safe mock creation
- Easy simulation of edge cases (timeouts, multi-approval, etc.)
- Isolated test environments prevent test pollution

### Negative
- Additional maintenance burden for test utilities
- Learning curve for new contributors
- Need to keep utilities in sync with core types

### Neutral
- Tests become more declarative, less imperative
- Utilities need their own test coverage

## Implementation Notes

### Phase 1: Core Factories
1. `createMockApprovalState()`
2. `createMockApprovalGate()`
3. `createMockApprovalRequest()`
4. `createMockApprovalResponse()`
5. Pre-built fixtures (`ApprovalStateFixtures`, `ApprovalGateFixtures`)

### Phase 2: Workflow Simulation
1. `MockApprovalWorkflow` class
2. `ApprovalChainContext` for multi-step
3. State transition helpers

### Phase 3: Environment Utilities
1. `createApprovalTestEnvironment()`
2. Quick setup helpers
3. Assertion helpers

## Related Decisions
- ADR-003: Mock Factory Architecture (core package)
- Test utilities in `test-utils.ts`
- Autonomy fixtures pattern in `autonomy-fixtures.ts`

## References
- `packages/orchestrator/src/approval-gate-controller.ts`
- `packages/core/src/types.ts` (ApprovalState, ApprovalGate schemas)
- `packages/orchestrator/src/__tests__/approval-gates.test.ts`
- `packages/orchestrator/src/__tests__/approval-workflow-pause-resume.test.ts`
