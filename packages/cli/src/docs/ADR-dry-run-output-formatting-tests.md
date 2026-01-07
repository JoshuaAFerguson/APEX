# ADR: Dry-Run Output Formatting Tests

## Status

Proposed

## Context

APEX v0.5.0 includes dry-run mode functionality in the orchestrator that simulates task execution without making actual changes. The acceptance criteria require tests in `packages/cli` to verify:

1. Dry-run mode displays appropriate 'DRY RUN' indicator
2. Output shows what WOULD happen without executing
3. Tool calls are logged with [DRY-RUN] prefix
4. Summary output correctly indicates dry-run completion

### Existing Implementation Analysis

**Orchestrator Side (Already Implemented):**
- `packages/orchestrator/src/index.ts` lines 817, 860: `dryRun?: boolean` parameter in `createTask()`
- Line 942-948: Dry-run mode detection and simulation routing
- Lines 7406-7462: `executeDryRunTask()` with stage simulation
- Log messages: `'🚀 DRY-RUN MODE: Simulating task execution...'` and `'✅ DRY-RUN COMPLETE: Task simulation finished successfully'`

**CLI Side (Gaps Identified):**
- `packages/cli/src/__tests__/dry-run-cli-integration.test.ts` exists but focuses on file system protection, NOT output formatting
- `packages/cli/src/index.ts` task execution functions don't currently handle dry-run output formatting
- No existing tests for dry-run output indicators or tool call prefixing

## Decision

Create a new test file `packages/cli/src/__tests__/dry-run-output-formatting.test.ts` that validates the dry-run output formatting requirements through unit tests that:

1. Mock the orchestrator events and verify CLI output formatting logic
2. Test output indicator rendering without requiring actual CLI execution
3. Validate tool event logging with appropriate prefixes
4. Test summary output formatting for dry-run completion

### Technical Design

#### Test File Structure

```typescript
// packages/cli/src/__tests__/dry-run-output-formatting.test.ts

/**
 * @fileoverview Tests for dry-run output formatting in CLI
 *
 * This test suite validates the acceptance criteria for dry-run output:
 * 1. Dry-run mode displays appropriate 'DRY RUN' indicator
 * 2. Output shows what WOULD happen without executing
 * 3. Tool calls are logged with [DRY-RUN] prefix
 * 4. Summary output correctly indicates dry-run completion
 */
```

#### Test Architecture

**AC1: DRY RUN Indicator Tests**
- Test that output includes visible "DRY RUN" or "🎭 DRY-RUN MODE" indicators
- Validate indicator appears at task start
- Test indicator visibility in different output modes (verbose, normal, quiet)

**AC2: "WOULD Happen" Output Tests**
- Test stage simulation messages show "Simulating" language
- Validate output differentiates between "will do" vs "would do"
- Test workflow stage progression shows simulation context

**AC3: [DRY-RUN] Tool Call Prefix Tests**
- Test tool event logging includes [DRY-RUN] prefix
- Validate useToolEventLogger handles dry-run context
- Test tool start/complete events are properly prefixed

**AC4: Dry-Run Completion Summary Tests**
- Test completion message indicates dry-run status
- Validate summary shows "DRY-RUN COMPLETE" language
- Test no actual token usage/cost is reported (zeros expected)

#### Key Components to Test

1. **Output Formatting Functions** (to be created/tested):
   ```typescript
   formatDryRunIndicator(): string
   formatDryRunToolCall(toolName: string, input: unknown): string
   formatDryRunSummary(task: Task): string
   ```

2. **Event Handler Integration**:
   - Hook into `task:created` with dryRun flag
   - Hook into `task:stage-changed` for simulation messages
   - Hook into `tool:start`/`tool:complete` for prefixed logging
   - Hook into `task:completed` for dry-run summary

3. **Orchestrator Event Mocking**:
   ```typescript
   const mockOrchestrator = {
     on: vi.fn(),
     off: vi.fn(),
     emit: vi.fn(),
     getTask: vi.fn().mockResolvedValue({
       id: 'test-task',
       dryRun: true,
       status: 'completed',
       usage: { totalTokens: 0, estimatedCost: 0 }
     })
   };
   ```

#### Test Data Fixtures

```typescript
const dryRunTask: Task = {
  id: 'dry-run-test-001',
  description: 'Test dry-run output formatting',
  dryRun: true,
  status: 'completed',
  workflow: 'feature',
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    totalCostCents: 0,
    executionTimeMs: 0
  },
  // ... other required fields
};

const dryRunToolEvent: ToolCallStartEvent = {
  taskId: 'dry-run-test-001',
  toolName: 'Write',
  callId: 'call-001',
  input: { file_path: '/test/file.ts', content: '...' },
  timestamp: new Date(),
  isDryRun: true  // New field to indicate dry-run context
};
```

#### Expected Output Patterns

```
AC1 - Mode Indicator:
🎭 DRY-RUN MODE: Simulating task execution without making actual changes

AC2 - Simulation Output:
🎭 Simulating workflow: feature with 3 stages
🎭 Simulating stage 1/3: planning (agent: planner)
✅ Stage planning simulated successfully

AC3 - Tool Prefix:
[DRY-RUN] 🔧 Write: /path/to/file.ts
[DRY-RUN] ✅ Write completed (simulated)

AC4 - Completion Summary:
╭─────────────────────────────────────╮
│  ✅ DRY-RUN COMPLETE                │
│                                     │
│  Task simulation finished           │
│  Tokens: 0                          │
│  Cost: $0.00                        │
│  Changes: None (simulation only)    │
╰─────────────────────────────────────╯
```

### Implementation Dependencies

1. **Orchestrator Changes (minimal)**:
   - Add `isDryRun` context to tool events (optional enhancement)
   - Current log messages already indicate dry-run status

2. **CLI Output Formatting (new utilities)**:
   - Create `formatDryRunOutput.ts` with formatting helpers
   - Integrate with existing `executeTaskWithOutput()` function

3. **Test Infrastructure**:
   - Use vitest for testing (consistent with existing tests)
   - Mock orchestrator events using vi.fn()
   - Capture console output for assertion

### Test Categories

| Category | Test Count | Priority |
|----------|-----------|----------|
| AC1: DRY RUN Indicator | 4 tests | High |
| AC2: WOULD Happen Output | 5 tests | High |
| AC3: Tool Call Prefix | 6 tests | High |
| AC4: Completion Summary | 4 tests | High |
| Edge Cases | 3 tests | Medium |
| Integration | 2 tests | Medium |

**Total: ~24 tests**

## Consequences

### Positive

- Comprehensive test coverage for dry-run output formatting
- Clear documentation of expected output behavior
- Unit tests enable fast iteration without CLI execution
- Validates user-facing output quality

### Negative

- Tests depend on output string matching which can be brittle
- Some tests may require output formatting utilities that don't exist yet
- Integration tests with real CLI still needed for full validation

### Risks

- Output format changes require test updates
- Chalk/boxen output may be difficult to assert in tests
- Console capture can have timing issues in async scenarios

## Implementation Plan

1. **Phase 1**: Create test file skeleton with all test cases (pending status)
2. **Phase 2**: Implement formatting utilities as needed
3. **Phase 3**: Enable tests progressively as utilities are implemented
4. **Phase 4**: Add integration tests for end-to-end validation

## References

- Existing test: `packages/cli/src/__tests__/dry-run-cli-integration.test.ts`
- Orchestrator implementation: `packages/orchestrator/src/index.ts` (lines 942-948, 7406-7462)
- Tool event logger: `packages/cli/src/ui/hooks/useToolEventLogger.ts`
- Core types: `packages/core/src/types.ts` (Task.dryRun field at line 1761)
