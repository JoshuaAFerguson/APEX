# ADR-036: Integration Tests for Happy Path Approval Flow

## Status
Proposed

## Date
2025-01-10

## Context

We need to implement integration tests for the happy path approval flow in APEX. The acceptance criteria specify:

1. CLI command creates task via orchestrator
2. Task transitions through: `pending` → `running` → `awaiting_approval` → `approved` → `completed` states
3. Events are emitted correctly at each stage
4. Final task state is stored correctly in SQLite

### Existing Infrastructure Analysis

Based on comprehensive codebase analysis:

#### Test Framework
- **Vitest** with globals enabled
- Tests run in Node environment for orchestrator package
- Integration tests use `.integration.test.ts` suffix

#### Task State Machine
From `packages/core/src/types.ts`:
```typescript
type TaskStatus =
  | 'pending'           // Initial state
  | 'queued'            // Ready for processing
  | 'planning'          // Planner stage
  | 'in-progress'       // Active execution
  | 'waiting-approval'  // Gate approval needed
  | 'awaiting-approval' // Awaiting user decision
  | 'paused'            // Manually paused
  | 'completed'         // Successfully finished
  | 'failed'            // Execution failed
  | 'cancelled'         // User cancelled
```

#### Event System
The `ApexOrchestrator` extends `EventEmitter<OrchestratorEvents>` with key events:
- `task:created` - Emitted when task is created
- `task:started` - Emitted when task execution begins
- `task:stage-changed` - Emitted on workflow stage transitions
- `approval:required` - Emitted when approval gate is hit
- `approval:approved` - Emitted when approval is granted
- `task:completed` - Emitted on successful completion

#### Persistence Layer
- `TaskStore` uses `better-sqlite3` with WAL mode
- Database at `.apex/apex.db` in project directory
- Approval states stored in `approval_states` table

#### Existing Test Patterns
Key patterns observed in existing integration tests:
1. Temporary directory creation with `fs.mkdtemp()`
2. Mock Claude Agent SDK with `vi.mock('@anthropic-ai/claude-agent-sdk')`
3. Project initialization with `initializeApex()`
4. Event listener registration before operations
5. Cleanup in `afterEach()` with directory removal

## Decision

### Test File Location
```
packages/orchestrator/src/__tests__/happy-path-approval-flow.integration.test.ts
```

### Test Architecture

#### 1. Test Setup Pattern
```typescript
describe('Happy Path Approval Flow Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    // Create isolated temp directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-happy-path-'));

    // Mock Claude Agent SDK
    mockQuery = vi.mocked(query);

    // Initialize APEX project
    await initializeApex(testDir, {
      projectName: 'test-happy-path',
      language: 'typescript',
      framework: 'node',
    });

    // Create workflow with approval gate
    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });
});
```

#### 2. State Transition Verification Strategy

The test must track state transitions in order:

```typescript
interface StateTransition {
  from: TaskStatus | null;
  to: TaskStatus;
  timestamp: Date;
  event?: string;
}

const stateTransitions: StateTransition[] = [];
```

Key verification points:
- **Transition 1**: `null → pending` (on `task:created`)
- **Transition 2**: `pending → in-progress` (on `task:started`)
- **Transition 3**: `in-progress → awaiting-approval` (on `approval:required`)
- **Transition 4**: `awaiting-approval → in-progress` (on approval granted)
- **Transition 5**: `in-progress → completed` (on `task:completed`)

#### 3. Event Emission Verification

Track all emitted events with timestamps:
```typescript
const emittedEvents: { event: string; timestamp: Date; data: unknown }[] = [];

// Register listeners for all relevant events
const events = [
  'task:created', 'task:started', 'task:stage-changed',
  'approval:required', 'approval:approved', 'task:completed'
];
events.forEach(eventName => {
  orchestrator.on(eventName as keyof OrchestratorEvents, (data) => {
    emittedEvents.push({ event: eventName, timestamp: new Date(), data });
  });
});
```

#### 4. SQLite Persistence Verification

After task completion, verify:
```typescript
// Get task from store
const finalTask = await orchestrator.getTask(taskId);
expect(finalTask).toBeDefined();
expect(finalTask!.status).toBe('completed');
expect(finalTask!.completedAt).toBeInstanceOf(Date);

// Verify approval state is persisted
const approvalState = await orchestrator.getApprovalStateById(approvalId);
expect(approvalState!.status).toBe('approved');
```

#### 5. Workflow Configuration

Create a simple workflow with one approval gate:
```yaml
name: happy-path-workflow
description: Simple workflow with single approval gate
stages:
  - name: planning
    agent: planner
    description: Plan the task
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement the task
    gate: "code-review"
  - name: completion
    agent: reviewer
    dependsOn: [implementation]
    description: Complete the task
```

### Test Cases

#### Primary Test: Complete Happy Path Flow
```typescript
it('should transition task through complete approval flow and persist state', async () => {
  // 1. Create task
  // 2. Run task until approval gate
  // 3. Verify awaiting-approval state
  // 4. Approve task
  // 5. Verify task completes
  // 6. Verify all events emitted in correct order
  // 7. Verify SQLite persistence
});
```

#### Supporting Tests

1. **Event Ordering Verification**
   - Verify events are emitted in chronological order
   - Each event has required fields

2. **State Persistence Across Restart**
   - Create task, hit approval gate
   - Close orchestrator
   - Create new orchestrator instance
   - Verify state is recovered from SQLite

3. **CLI Integration Simulation**
   - Simulate CLI command creating task
   - Verify orchestrator receives correct parameters

### Mock Configuration

```typescript
// Mock successful stage completions
mockQuery
  .mockResolvedValueOnce({
    requestId: 'planning-request',
    output: {
      success: true,
      messages: [{
        role: 'assistant',
        content: [{ type: 'text', text: 'Planning completed.' }]
      }],
    },
    usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
  })
  .mockResolvedValueOnce({
    requestId: 'implementation-request',
    output: {
      success: true,
      messages: [{
        role: 'assistant',
        content: [{ type: 'text', text: 'Implementation ready for review.' }]
      }],
    },
    usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
  })
  .mockResolvedValueOnce({
    requestId: 'completion-request',
    output: {
      success: true,
      messages: [{
        role: 'assistant',
        content: [{ type: 'text', text: 'Task completed successfully.' }]
      }],
    },
    usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
  });
```

## Consequences

### Positive
- Comprehensive coverage of approval flow happy path
- Clear event ordering verification
- SQLite persistence validation
- Follows established test patterns

### Negative
- Integration tests are slower than unit tests
- Requires mocking Claude Agent SDK
- Temporary directory management overhead

### Risks
- State transitions may vary based on workflow configuration
- Event timing may be non-deterministic in edge cases

## Implementation Notes

### File Structure
```
packages/orchestrator/src/__tests__/
├── happy-path-approval-flow.integration.test.ts  # NEW - Main test file
├── approval-lifecycle-integration.test.ts         # Reference for patterns
├── approval-state-persistence.integration.test.ts # Reference for SQLite tests
└── mocks/
    └── mock-claude-sdk.ts                         # Existing mock utilities
```

### Dependencies
- `vitest` - Test framework
- `@apexcli/core` - Types and utilities
- `better-sqlite3` - Database operations (via TaskStore)
- `eventemitter3` - Event handling (via ApexOrchestrator)

### Key Imports
```typescript
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { initializeApex, type Task, type TaskStatus } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
```

## Related Documents
- `packages/orchestrator/src/__tests__/approval-lifecycle-integration.test.ts`
- `packages/orchestrator/src/__tests__/approval-state-persistence.integration.test.ts`
- `packages/core/src/types.ts` - TaskStatus enum definition
- `packages/orchestrator/src/index.ts` - OrchestratorEvents interface
