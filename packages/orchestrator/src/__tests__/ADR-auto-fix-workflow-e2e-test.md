# ADR: End-to-End Test for Auto-Fix in Workflow Context

## Status

Proposed

## Context

We need to create a comprehensive end-to-end test that validates the auto-fix feature within the full workflow context. The test must verify that:

1. A task triggers code generation
2. AutoFixService is invoked automatically after code generation stages
3. Events are emitted in the correct order
4. The final task state reflects auto-fix results

### Existing Test Coverage Analysis

The codebase already has extensive auto-fix testing:

| Test File | Coverage Area |
|-----------|---------------|
| `auto-fix-orchestrator-integration.test.ts` | Orchestrator-level event emission |
| `auto-fix-execution-hook.test.ts` | Hook triggering and configuration |
| `auto-fix-service-integration.test.ts` | Service instantiation |
| `auto-fix-event-integration-comprehensive.test.ts` | Event streaming with mock orchestrator |

**Gap Identified**: No test validates the complete workflow lifecycle from task creation through stage execution to auto-fix completion with real orchestrator integration.

## Decision

### Test Architecture

Create a new test file `auto-fix-workflow-e2e.test.ts` that tests the complete flow:

```
Task Creation → Stage Execution → Auto-Fix Trigger → Events Emitted → Task State Updated
```

### Key Components

#### 1. Test Setup

```typescript
// Required mocks:
- fs/promises (file system operations)
- child_process (git operations)
- ImportAutoFixer (auto-fix service)
- Claude Agent SDK query() (stage execution)

// Real components:
- ApexOrchestrator (actual implementation)
- TaskStore (SQLite-backed)
- EventEmitter (real event capture)
```

#### 2. Test Scenarios

**Scenario A: Successful Auto-Fix Flow**
```typescript
describe('End-to-End Auto-Fix Workflow', () => {
  it('should execute complete auto-fix lifecycle in workflow context', async () => {
    // 1. Create task with auto-fix enabled config
    const task = await orchestrator.createTask({
      description: 'Implement feature with imports',
      workflow: 'feature',
    });

    // 2. Mock stage execution to return modified files
    // 3. Trigger executeStage for implementation stage
    // 4. Capture all auto-fix events
    // 5. Verify event sequence: start → progress → complete
    // 6. Verify task state includes autoFixResults
  });
});
```

**Scenario B: Event Ordering Validation**
```typescript
it('should emit events in correct order', async () => {
  // Capture events with timestamps
  // Verify: auto-fix-start before auto-fix-progress before auto-fix-complete
  // Verify: taskId matches across all events
  // Verify: timestamps are chronological
});
```

**Scenario C: Task State Reflects Results**
```typescript
it('should update task state with auto-fix results', async () => {
  // Execute workflow stage
  // Retrieve task from store
  // Verify task.results[x].autoFixResults contains:
  //   - applied: true
  //   - filesProcessed: [...]
  //   - filesModified: [...]
  //   - totalImportsAdded: number
  //   - totalDuration: number
});
```

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        E2E Test Environment                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌───────────────────┐    ┌─────────────────┐   │
│  │   Test       │───▶│  ApexOrchestrator │───▶│   TaskStore     │   │
│  │   Runner     │    │  (real instance)  │    │   (SQLite)      │   │
│  └──────────────┘    └───────────────────┘    └─────────────────┘   │
│         │                    │                                       │
│         │                    ▼                                       │
│         │            ┌───────────────────┐                          │
│         │            │   executeStage()  │                          │
│         │            └───────────────────┘                          │
│         │                    │                                       │
│         │                    ▼                                       │
│         │            ┌───────────────────┐                          │
│         │            │  ImportAutoFixer  │◀── (mocked)              │
│         │            │    .fix()         │                          │
│         │            └───────────────────┘                          │
│         │                    │                                       │
│         ▼                    ▼                                       │
│  ┌──────────────┐    ┌───────────────────┐                          │
│  │   Event      │◀───│   Event Emission  │                          │
│  │   Collector  │    │   auto-fix-*      │                          │
│  └──────────────┘    └───────────────────┘                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Event Types to Validate

| Event | Status | Validation Points |
|-------|--------|-------------------|
| `auto-fix-start` | `running` | taskId, currentFile, filesModified=[] |
| `auto-fix-progress` | `running` | issuesFixed array populated |
| `auto-fix-complete` | `success` | filesModified populated, duration > 0 |
| `auto-fix-error` | `failed` | error message present |

### Mock Strategy

```typescript
// 1. Mock ImportAutoFixer for predictable results
MockImportAutoFixer.mockImplementation(() => ({
  isAvailable: vi.fn().mockResolvedValue(true),
  analyze: vi.fn().mockResolvedValue([{
    missingImports: [{ identifier: 'React', source: 'react' }]
  }]),
  fix: vi.fn().mockResolvedValue([{
    success: true,
    filePath: '/src/Component.tsx',
    importsAdded: ['React', 'useState'],
    duration: 500,
    errors: []
  }]),
  getSummary: vi.fn().mockReturnValue({
    filesProcessed: 1,
    filesModified: 1,
    totalImportsAdded: 2,
    totalErrors: 0,
    totalDuration: 500
  })
}));

// 2. Mock toolActionStore to return modified files
orchestrator.toolActionStore = {
  getToolActions: vi.fn().mockResolvedValue([{
    stageName: 'implementation',
    modifiedFiles: ['/src/Component.tsx']
  }])
};

// 3. Mock Claude SDK query for stage execution (optional)
// Or use executeStage directly for unit-level control
```

### Test File Structure

```
packages/orchestrator/src/__tests__/auto-fix-workflow-e2e.test.ts
├── describe('Auto-Fix Workflow E2E Tests')
│   ├── beforeEach (setup orchestrator, mocks, event collectors)
│   ├── afterEach (cleanup)
│   │
│   ├── describe('Complete Workflow Lifecycle')
│   │   ├── it('should invoke AutoFixService after code generation stage')
│   │   ├── it('should emit events in correct lifecycle order')
│   │   └── it('should update task state with auto-fix results')
│   │
│   ├── describe('Event Validation')
│   │   ├── it('should emit auto-fix-start with correct payload')
│   │   ├── it('should emit auto-fix-progress during processing')
│   │   ├── it('should emit auto-fix-complete on success')
│   │   └── it('should emit auto-fix-error on failure')
│   │
│   ├── describe('Task State Integration')
│   │   ├── it('should persist autoFixResults in stage result')
│   │   └── it('should include auto-fix stats in task results')
│   │
│   └── describe('CI Compatibility')
│       └── it('should complete within timeout bounds')
```

### Acceptance Criteria Mapping

| Criterion | Test Coverage |
|-----------|---------------|
| Creates task that triggers code generation | `it('should invoke AutoFixService...')` |
| Verifies AutoFixService is invoked | Mock assertion on `fix()` call |
| Confirms events emitted in order | Event timestamp/sequence validation |
| Validates final task state | Task retrieval and autoFixResults check |
| Passes in CI | Timeout handling, deterministic mocks |

## Consequences

### Positive

1. **Coverage Gap Filled**: Tests the integration point between workflow execution and auto-fix
2. **Regression Prevention**: Catches breaking changes to auto-fix hook mechanism
3. **Documentation**: Serves as executable specification for auto-fix behavior
4. **CI Ready**: Designed with deterministic mocks for reliable CI execution

### Negative

1. **Complexity**: Requires careful mock orchestration
2. **Maintenance**: Changes to auto-fix events require test updates

### Neutral

1. **Test Duration**: Expected ~2-5 seconds per test scenario
2. **Dependencies**: Relies on existing mock patterns from other auto-fix tests

## Implementation Notes

### Key Files to Reference

- `/packages/orchestrator/src/index.ts` lines 3433-3800 (executeAutoFixForStage)
- `/packages/orchestrator/src/__tests__/auto-fix-orchestrator-integration.test.ts`
- `/packages/orchestrator/src/__tests__/auto-fix-execution-hook.test.ts`
- `/packages/core/src/types.ts` (AutoFixEvent, AutoFixStageResults schemas)

### Event Schema Reference

```typescript
interface AutoFixEvent {
  id: string;
  eventType: 'auto-fix-start' | 'auto-fix-progress' | 'auto-fix-complete' | 'auto-fix-error';
  taskId: string;
  filesModified: string[];
  issuesFixed: AutoFixIssueDetail[];
  iterationCount: number;
  totalIterations: number;
  currentFile: string;
  status: 'running' | 'success' | 'failed';
  timestamp: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface AutoFixStageResults {
  applied: boolean;
  filesProcessed: string[];
  filesModified: string[];
  totalImportsAdded: number;
  totalDuration: number;
  errors: Array<{ filePath: string; error: string; type: string }>;
  skipReason?: string;
}
```

## Next Stage Requirements

The **developer** stage should implement the test file following this architecture:

1. Create `/packages/orchestrator/src/__tests__/auto-fix-workflow-e2e.test.ts`
2. Follow mock patterns from existing auto-fix tests
3. Ensure all acceptance criteria are covered
4. Run `npm run test` to verify CI compatibility
5. Run `npm run build` to verify no type errors
