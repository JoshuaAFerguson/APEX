# ADR-031: Autonomy Controls Comprehensive Testing Architecture

## Status
Proposed

## Date
2025-01-10

## Context

APEX requires comprehensive test coverage for autonomy controls to ensure the platform maintains proper human oversight during AI agent operations. The acceptance criteria require:

1. Unit tests for all Zod schemas and type validation
2. Unit tests for resource limit tracking and threshold detection
3. Integration tests for approval gate flow (pause/resume/abort)
4. Integration tests for each autonomy level behavior
5. Edge case tests for limit recovery and approval timeout
6. All tests pass with `npm run test`

## Decision

### 1. Test Architecture Overview

The test architecture follows a layered approach mirroring the package structure:

```
packages/
├── core/src/__tests__/                    # Type and schema validation tests
│   ├── autonomy-control-types.test.ts     # Zod schema unit tests (EXISTS)
│   ├── autonomy-control-acceptance.test.ts # Acceptance criteria validation (EXISTS)
│   ├── autonomy-control-edge-cases.test.ts # Edge case handling (EXISTS)
│   └── autonomy-control-integration.test.ts # Cross-schema integration (EXISTS)
│
├── orchestrator/src/__tests__/            # Enforcement and runtime tests
│   ├── autonomy-enforcer.test.ts          # Core enforcer unit tests (EXISTS)
│   ├── autonomy-enforcer-edge-cases.test.ts # Edge cases (EXISTS)
│   ├── approval-gate-controller.test.ts   # Gate controller unit tests (EXISTS)
│   ├── approval-gate-controller.integration.test.ts # Integration tests (EXISTS)
│   ├── approval-timeout-basic.test.ts     # Timeout handling (EXISTS)
│   └── resource-limit-tracking.test.ts    # Resource tracking (EXISTS - in src/)
│
└── cli/src/__tests__/                     # CLI component tests
    ├── ui/components/status/              # Resource UI components (EXISTS)
    └── ui/components/autonomy/            # Autonomy UI components (EXISTS)
```

### 2. Test Categories and Coverage Matrix

#### 2.1 Unit Tests for Zod Schemas (packages/core)

**File:** `autonomy-control-types.test.ts` (COMPREHENSIVE - EXISTS)

| Schema | Test Coverage |
|--------|--------------|
| `AutonomyLevelSchema` | ✅ Valid levels, invalid levels, type inference |
| `LegacyAutonomyLevelSchema` | ✅ Valid legacy levels, migration function |
| `ApprovalCheckpointTypeSchema` | ✅ All 7 checkpoint types |
| `ApprovalGateSchema` | ✅ Minimal/complete gates, timeout/minApprovals constraints |
| `TaskResourceLimitsSchema` | ✅ All 10 limit fields, numeric constraints |
| `AgentAutonomyOverrideSchema` | ✅ Level, timeout, rejection behavior, gates |
| `AutonomyConfigSchema` | ✅ Defaults, gates array, stage/agent overrides |
| `RejectionBehaviorSchema` | ✅ skip/abort behaviors |

**Additional tests needed:** None - comprehensive coverage exists

#### 2.2 Unit Tests for Resource Limit Tracking (packages/orchestrator)

**File:** `resource-limit-tracking.test.ts` (COMPREHENSIVE - EXISTS)

| Feature | Test Coverage |
|---------|--------------|
| Token usage tracking | ✅ Accurate tracking, accumulation |
| Token limit warning (80%) | ✅ Event emission with correct values |
| Token limit exceeded | ✅ Event emission, percentage calculation |
| Cost tracking | ✅ Estimated cost tracking |
| Cost limit warning (80%) | ✅ Event emission at threshold |
| Cost limit exceeded + pause | ✅ Task paused, pauseReason set |
| Execution time tracking | ✅ Time elapsed tracking |
| Time limit warning (80%) | ✅ Event emission at threshold |
| Time limit exceeded | ✅ Event emission with percentage |
| File changes tracking | ✅ Created/modified file arrays |
| File limit warning (80%) | ✅ Combined file count warning |
| File limit exceeded | ✅ Event emission with totals |
| Multiple limits exceeded | ✅ 4 exceeded events simultaneously |
| Missing task handling | ✅ Graceful handling, no throw |
| Undefined limits | ✅ No error with empty config |
| Zero limits | ✅ Any usage triggers exceeded |

**Additional tests needed:** None - comprehensive coverage exists

#### 2.3 Integration Tests for Approval Gate Flow (packages/orchestrator)

**Files:** Multiple approval gate integration tests (COMPREHENSIVE - EXISTS)

| Flow State | Test Files |
|------------|-----------|
| Pending → Approved | `approval-gate-controller.integration.test.ts` |
| Pending → Denied | `approval-gate-controller.integration.test.ts` |
| Pending → Timeout (auto-deny) | `approval-timeout-basic.test.ts` |
| Pending → Timeout (auto-approve) | `approval-timeout-basic.test.ts` |
| Pause/Resume flow | `approval-workflow-pause-resume.test.ts` |
| Abort on rejection | `approval-resolution-edge-cases.test.ts` |
| State persistence | `approval-state-persistence.integration.test.ts` |
| State recovery after restart | `approval-state-recovery-restart.integration.test.ts` |
| Event ordering | `approval-event-ordering.test.ts` |
| Concurrent handling | `approval-concurrent-handling.test.ts` |

**Additional tests needed:** None - comprehensive coverage exists

#### 2.4 Integration Tests for Autonomy Level Behavior (packages/orchestrator)

**File:** `autonomy-enforcement-comprehensive.test.ts` (COMPREHENSIVE - EXISTS)

| Autonomy Level | Behavior Tests |
|----------------|---------------|
| `full-auto` | ✅ No approvals for standard ops, gate-specific triggers only |
| `review-before-commit` | ✅ Git commit/push/deploy triggers, non-commit passes |
| `review-all` | ✅ Read ops pass, all other ops require approval |
| Stage overrides | ✅ Per-stage autonomy level application |
| Agent overrides | ✅ Per-agent autonomy level + timeout + gates |

**Additional files with level-specific tests:**
- `autonomy-level-approval-triggering.test.ts` - Level-based approval triggering
- `autonomy-agent-overrides.test.ts` - Agent override behavior
- `autonomy-git-commit-detection.test.ts` - Git operation detection

**Additional tests needed:** None - comprehensive coverage exists

#### 2.5 Edge Case Tests for Limit Recovery and Approval Timeout (packages/orchestrator)

**Files:** Multiple edge case test files (COMPREHENSIVE - EXISTS)

| Edge Case Category | Test File |
|--------------------|-----------|
| Limit recovery scenarios | `autonomy-enforcer-edge-cases.test.ts` |
| Zero/undefined limits | `autonomy-enforcer-edge-cases.test.ts` |
| Approval timeout edge cases | `approval-gate-controller.timeout-edge-cases.test.ts` |
| Timeout with errors | `approval-timeout-error-scenarios.integration.test.ts` |
| Promise rejection on cancel | `approval-promise-edge-cases.test.ts` |
| Multiple approval handling | `approval-concurrent-handling.test.ts` |
| State edge cases | `approval-state-edge-cases.test.ts` |
| Pre-action edge cases | `autonomy-preaction-edge-cases.test.ts` |

**Additional tests needed:** None - comprehensive coverage exists

### 3. Test Patterns and Best Practices

#### 3.1 Mock Pattern for Orchestrator

```typescript
const createMockOrchestrator = () => ({
  on: vi.fn(),
  emit: vi.fn(),
  store: {
    getTask: vi.fn(),
    updateTask: vi.fn(),
    saveApprovalState: vi.fn(),
    updateApprovalState: vi.fn(),
    getApprovalStateById: vi.fn(),
  },
});
```

#### 3.2 Task Creation Pattern

```typescript
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task-12345678',
  description: 'Test task',
  status: 'pending' as TaskStatus,
  workflow: 'test-workflow',
  agent: 'test-agent',
  priority: 'medium',
  createdAt: new Date(),
  updatedAt: new Date(),
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  },
  ...overrides,
});
```

#### 3.3 Database Integration Pattern

```typescript
let testDir: string;
let store: TaskStore;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
  store = new TaskStore(path.join(testDir, 'test.db'));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});
```

#### 3.4 Timer Mocking Pattern

```typescript
vi.useFakeTimers();

// Advance time to trigger timeout
vi.advanceTimersByTime(timeout * 60 * 1000);

// Clean up
afterEach(() => {
  vi.useRealTimers();
});
```

#### 3.5 Event Assertion Pattern

```typescript
const events: ApprovalState[] = [];
controller.on('approval:requested', (state) => events.push(state));
controller.on('approval:resolved', (state) => events.push(state));

// ... perform actions ...

expect(events).toHaveLength(2);
expect(events[0].status).toBe('pending');
expect(events[1].status).toBe('approved');
```

### 4. Test Organization Recommendations

#### 4.1 File Naming Conventions

- Unit tests: `{feature}.test.ts`
- Edge cases: `{feature}-edge-cases.test.ts`
- Integration: `{feature}.integration.test.ts`
- Performance: `{feature}.performance.test.ts`

#### 4.2 Test Suite Structure

```typescript
describe('FeatureName', () => {
  describe('constructor', () => { ... });
  describe('methodName', () => {
    describe('scenario A', () => { ... });
    describe('scenario B', () => { ... });
  });
  describe('edge cases', () => { ... });
  describe('error handling', () => { ... });
});
```

### 5. Coverage Summary

Based on analysis, the existing test suite provides **comprehensive coverage** of all acceptance criteria:

| Acceptance Criterion | Status | Key Test Files |
|---------------------|--------|----------------|
| Unit tests for Zod schemas | ✅ Complete | `autonomy-control-types.test.ts` |
| Unit tests for resource limits | ✅ Complete | `resource-limit-tracking.test.ts`, `autonomy-enforcer.test.ts` |
| Integration tests for approval flow | ✅ Complete | `approval-gate-controller.integration.test.ts`, `approval-workflow-pause-resume.test.ts` |
| Integration tests for autonomy levels | ✅ Complete | `autonomy-enforcement-comprehensive.test.ts`, `autonomy-level-approval-triggering.test.ts` |
| Edge case tests for recovery/timeout | ✅ Complete | `approval-timeout-error-scenarios.integration.test.ts`, `autonomy-enforcer-edge-cases.test.ts` |

### 6. Recommendations for Future Development

1. **Test Execution Performance**: Consider using Vitest's `--shard` option for parallel test execution
2. **Test Coverage Reporting**: Add NYC/Istanbul coverage reports to CI pipeline
3. **Visual Regression Tests**: Consider adding UI component visual tests for CLI
4. **Load Testing**: Add stress tests for concurrent approval handling

## Consequences

### Positive
- Comprehensive test coverage ensures autonomy controls work correctly
- Layered test structure mirrors package architecture for maintainability
- Standard patterns reduce cognitive load for test authors
- Edge cases are thoroughly covered preventing production issues

### Negative
- Large test suite increases CI/CD execution time
- Maintaining test patterns requires discipline from contributors

### Neutral
- Tests serve as living documentation of expected behavior
- Mock patterns may need updates as real implementations evolve

## Related ADRs

- ADR-029: Autonomy Enforcer Integration
- ADR-027: Approval Gate Controller Design
- ADR-025: Resource Limit Tracking System
