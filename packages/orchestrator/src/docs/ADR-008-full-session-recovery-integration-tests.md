# ADR-008: Full Session Recovery Flow Integration Tests

## Status
Proposed

## Date
2024-12-20

## Context

APEX provides comprehensive session recovery functionality to handle context window limits, rate limits, and other pause scenarios. While individual components (SessionManager, checkpoint functionality, max resume attempts, context injection) have unit and some integration tests, there is no end-to-end integration test that validates the **complete session recovery flow**.

### Current Test Coverage

Existing tests cover individual components:

| Component | Test File | Coverage |
|-----------|-----------|----------|
| Session limit detection | `session-limit-integration.test.ts` | Token estimation, threshold detection |
| Checkpoint functionality | `checkpoint-functionality.test.ts` | Save/restore checkpoints, session data |
| Max resume attempts | `max-resume-attempts.integration.test.ts` | Infinite loop prevention |
| Resume context | `resume-integration.test.ts`, `coverage-report.test.ts` | `buildResumePrompt`, context injection |
| Session manager | `session-manager.test.ts` | Session recovery, auto-resume |

### Gap Analysis

Missing integration test that validates the **complete flow**:
1. Task execution → Context window limit detected → Checkpoint saved → Session ends
2. Session resumes → Context injected → Task continues → Completes or pauses again
3. Max resume attempts reached → Task fails with actionable error

This gap means we cannot verify that:
- All components work together correctly
- State transitions happen in the expected order
- Context is properly preserved across sessions
- Error messages and logs are appropriately generated

## Decision

Create a comprehensive integration test file `session-recovery-full-flow.integration.test.ts` that validates the **complete session recovery lifecycle**.

### Test Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    FULL SESSION RECOVERY INTEGRATION TESTS                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Test Suite 1: Context Window Limit Simulation                            │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ - Simulate task approaching context limit (85%+ utilization)            │   │
│  │ - Verify checkpoint is saved BEFORE session ends                        │   │
│  │ - Verify task status transitions: in-progress → paused                  │   │
│  │ - Verify pauseReason is set to 'session_limit'                          │   │
│  │ - Verify resumeAfter is set for delayed auto-resume                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Test Suite 2: Checkpoint Preservation                                    │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ - Verify checkpoint contains correct stage/stageIndex                    │   │
│  │ - Verify conversationState is preserved                                  │   │
│  │ - Verify metadata includes sessionLimitStatus                           │   │
│  │ - Verify checkpoint can be loaded after restart                         │   │
│  │ - Verify multiple checkpoints are ordered correctly                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Test Suite 3: Auto-Resume with Context Injection                         │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ - Verify createContextSummary() is called with conversation history     │   │
│  │ - Verify buildResumePrompt() generates proper resume context            │   │
│  │ - Verify resume context is injected into agent prompt                   │   │
│  │ - Verify task:session-resumed event is emitted with correct payload     │   │
│  │ - Verify resumed task continues from checkpoint (not restart)           │   │
│  │ - Verify conversation state is properly restored                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Test Suite 4: Max Attempts Prevention                                    │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ - Verify resumeAttempts counter increments on each resume               │   │
│  │ - Verify maxResumeAttempts is checked before resume execution           │   │
│  │ - Verify task fails with descriptive error when limit exceeded          │   │
│  │ - Verify error message suggests remediation strategies                   │   │
│  │ - Verify counter resets on successful task completion                    │   │
│  │ - Verify subtasks have independent resume counters                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Test Suite 5: End-to-End Flow Scenarios                                  │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ Scenario A: Successful recovery after 1 resume                          │   │
│  │   1. Task starts → hits session limit → pauses                          │   │
│  │   2. Task resumes → completes successfully                              │   │
│  │   3. Verify all state transitions and events                            │   │
│  │                                                                          │   │
│  │ Scenario B: Recovery after multiple resumes (within limit)              │   │
│  │   1. Task starts → pauses → resumes → pauses → resumes → completes      │   │
│  │   2. Verify context is accumulated across sessions                       │   │
│  │   3. Verify each checkpoint builds on previous context                   │   │
│  │                                                                          │   │
│  │ Scenario C: Task fails after max resume attempts                         │   │
│  │   1. Task repeatedly hits session limit                                  │   │
│  │   2. After N+1 resumes (N = maxResumeAttempts), task fails               │   │
│  │   3. Verify failure reason and suggested remediation                     │   │
│  │                                                                          │   │
│  │ Scenario D: Daemon auto-resume integration                               │   │
│  │   1. Task pauses with resumeAfter timestamp                              │   │
│  │   2. Daemon scheduler detects resumable task                             │   │
│  │   3. Task auto-resumes with context injection                            │   │
│  │   4. Verify end-to-end daemon integration                                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Technical Design

#### Test Infrastructure

```typescript
// Test fixtures and utilities
interface TestScenario {
  name: string;
  conversation: AgentMessage[];        // Initial conversation to simulate
  contextWindowSize: number;           // Simulated context window
  maxResumeAttempts: number;           // Config value
  expectedPauses: number;              // How many times task should pause
  expectedFinalStatus: TaskStatus;     // Expected end state
  shouldCompleteSuccessfully: boolean; // Whether task should complete
}

// Mock setup for controlled session limit simulation
function createSessionLimitMock(options: {
  failOnAttempt: number[];    // Which attempts should trigger session limit
  succeedOnAttempt: number;   // Which attempt should succeed
}): MockAgentQuery;

// Helper to build conversation that approaches context limit
function buildLargeConversation(
  targetTokens: number,
  messagesPerType: number
): AgentMessage[];
```

#### Component Integration Points

The test validates these integration points:

1. **ApexOrchestrator ↔ SessionManager**
   - `detectSessionLimit()` → checkpoint creation trigger
   - Checkpoint storage and retrieval
   - Session data persistence

2. **ApexOrchestrator ↔ TaskStore**
   - Task status updates (`in-progress` → `paused` → `in-progress` → `completed/failed`)
   - `resumeAttempts` counter persistence
   - Checkpoint CRUD operations
   - Session data storage

3. **ApexOrchestrator ↔ Prompts**
   - `createContextSummary()` for conversation analysis
   - `buildResumePrompt()` for context injection
   - Resume context integration into agent prompts

4. **DaemonRunner ↔ ApexOrchestrator**
   - Auto-resume scheduling
   - Resume execution through orchestrator
   - Event forwarding

5. **Events ↔ External Systems**
   - `task:paused` event with session_limit reason
   - `task:session-resumed` event with context summary
   - `task:completed` / `task:failed` events

#### Mock Strategy

```typescript
// Mock the claude-agent-sdk query function to simulate:
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn().mockImplementation(() => ({
    [Symbol.asyncIterator]: async function* () {
      const attemptNumber = getCurrentAttemptNumber();

      if (shouldTriggerSessionLimit(attemptNumber)) {
        // Simulate session limit detection
        throw new Error('Session limit reached: Context window utilization is 85%');
      }

      if (shouldSucceed(attemptNumber)) {
        yield { type: 'text', content: 'Task completed successfully' };
      }
    },
  })),
}));
```

### Acceptance Criteria Mapping

| Acceptance Criteria | Test Suite | Key Assertions |
|---------------------|------------|----------------|
| AC1: Simulate context window limit | Suite 1 | Token estimation triggers pause |
| AC2: Verify checkpoint saved before end | Suite 2 | Checkpoint exists with correct data |
| AC3: Verify auto-resume with context injection | Suite 3 | `buildResumePrompt` called, context injected |
| AC4: Verify max attempts prevents loops | Suite 4 | Counter increments, task fails at limit |
| AC5: All tests pass | All | vitest reports 100% pass rate |

### File Structure

```
packages/orchestrator/src/
├── session-recovery-full-flow.integration.test.ts  # NEW - Main integration test
├── test-utils/
│   └── session-recovery-fixtures.ts                # NEW - Test fixtures and mocks
```

### Key Test Cases

```typescript
describe('Full Session Recovery Flow - Integration Tests', () => {

  // Suite 1: Context Window Limit Simulation
  describe('Context Window Limit Detection and Pause', () => {
    it('should detect session limit when context approaches threshold');
    it('should transition task status to paused with session_limit reason');
    it('should set resumeAfter for delayed auto-resume');
    it('should emit task:paused event with correct payload');
  });

  // Suite 2: Checkpoint Preservation
  describe('Checkpoint Creation and Preservation', () => {
    it('should save checkpoint before task pauses');
    it('should preserve conversation state in checkpoint');
    it('should include session limit metadata in checkpoint');
    it('should load checkpoint correctly after simulated restart');
    it('should maintain checkpoint ordering for multiple checkpoints');
  });

  // Suite 3: Auto-Resume with Context Injection
  describe('Resume with Context Injection', () => {
    it('should call createContextSummary with conversation history');
    it('should call buildResumePrompt with task, checkpoint, and summary');
    it('should inject resume context into agent prompt');
    it('should emit task:session-resumed event');
    it('should continue from checkpoint stage, not restart');
    it('should restore and extend conversation state');
  });

  // Suite 4: Max Attempts Prevention
  describe('Max Resume Attempts Enforcement', () => {
    it('should increment resumeAttempts on each resume');
    it('should check limit before executing resume');
    it('should fail task with descriptive error when limit exceeded');
    it('should include remediation suggestions in error');
    it('should reset counter on successful completion');
    it('should track subtask resume attempts independently');
  });

  // Suite 5: End-to-End Scenarios
  describe('Complete Recovery Scenarios', () => {
    it('Scenario A: should complete after single recovery');
    it('Scenario B: should complete after multiple recoveries within limit');
    it('Scenario C: should fail after exceeding max resume attempts');
    it('Scenario D: should integrate with daemon auto-resume');
  });
});
```

### Configuration Requirements

The integration tests require specific configuration:

```yaml
# Test configuration
daemon:
  sessionRecovery:
    enabled: true
    maxResumeAttempts: 3  # For testing max attempts behavior
    contextWindowThreshold: 0.8  # Trigger at 80% for controlled testing
    autoResume: true
    resumeDelayMs: 0  # No delay for tests
```

### Expected Test Output

```
✓ session-recovery-full-flow.integration.test.ts (25 tests)
  ✓ Context Window Limit Detection and Pause (4 tests)
    ✓ should detect session limit when context approaches threshold
    ✓ should transition task status to paused with session_limit reason
    ✓ should set resumeAfter for delayed auto-resume
    ✓ should emit task:paused event with correct payload
  ✓ Checkpoint Creation and Preservation (5 tests)
    ✓ should save checkpoint before task pauses
    ✓ should preserve conversation state in checkpoint
    ✓ should include session limit metadata in checkpoint
    ✓ should load checkpoint correctly after simulated restart
    ✓ should maintain checkpoint ordering for multiple checkpoints
  ✓ Resume with Context Injection (6 tests)
    ✓ should call createContextSummary with conversation history
    ✓ should call buildResumePrompt with task, checkpoint, and summary
    ✓ should inject resume context into agent prompt
    ✓ should emit task:session-resumed event
    ✓ should continue from checkpoint stage, not restart
    ✓ should restore and extend conversation state
  ✓ Max Resume Attempts Enforcement (6 tests)
    ✓ should increment resumeAttempts on each resume
    ✓ should check limit before executing resume
    ✓ should fail task with descriptive error when limit exceeded
    ✓ should include remediation suggestions in error
    ✓ should reset counter on successful completion
    ✓ should track subtask resume attempts independently
  ✓ Complete Recovery Scenarios (4 tests)
    ✓ Scenario A: should complete after single recovery
    ✓ Scenario B: should complete after multiple recoveries within limit
    ✓ Scenario C: should fail after exceeding max resume attempts
    ✓ Scenario D: should integrate with daemon auto-resume
```

## Consequences

### Positive
- End-to-end validation of session recovery flow
- Catches integration bugs that unit tests miss
- Documents expected behavior through executable tests
- Provides regression safety for future changes
- Validates all acceptance criteria systematically

### Negative
- Longer test execution time (integration tests are slower)
- More complex test setup with mocking
- May require maintenance as implementation evolves

### Neutral
- Adds ~300-400 lines of test code
- Requires careful mock design to avoid false positives
- Complements rather than replaces existing unit tests

## Implementation Notes

1. **Mock Design**: Carefully design mocks to simulate realistic scenarios without over-mocking
2. **State Isolation**: Ensure each test case starts with clean state (new temp directory, fresh orchestrator)
3. **Event Verification**: Use event spies to verify correct event emission sequence
4. **Timing Considerations**: Handle async operations and potential race conditions
5. **Cleanup**: Ensure proper cleanup of temp directories and database connections

## Related ADRs

- ADR-007: Max Resume Attempts to Prevent Infinite Loops
- ADR-005: Enhanced Resume Events with contextSummary
- ADR-006: Resume Notification Event Tests Architecture

## File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/orchestrator/src/session-recovery-full-flow.integration.test.ts` | Add | Main integration test file |
| `packages/orchestrator/src/test-utils/session-recovery-fixtures.ts` | Add | Test fixtures and mock utilities |
| `packages/orchestrator/src/docs/ADR-008-full-session-recovery-integration-tests.md` | Add | This ADR |
