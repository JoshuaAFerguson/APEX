# Technical Design: Approval State Recovery After Restart Integration Test

## Overview

This document provides the technical design for an integration test that verifies approval state recovery after orchestrator restart. The test validates that pending approvals persisted in SQLite are correctly recovered and can still be approved/resumed after the orchestrator is restarted.

## Test Requirements (Acceptance Criteria)

1. Create a task that pauses at an approval gate
2. Simulate orchestrator restart
3. Verify pending approval is recovered from SQLite
4. Verify task can still be approved/resumed after restart

## Architecture Decision

### Approach: End-to-End Integration Test with Real SQLite

The test will use a real SQLite database (via TaskStore) in a temporary directory, simulating actual orchestrator lifecycle. This approach:

- Tests the real persistence layer
- Validates the full approval flow
- Exercises `getPendingApprovals()`, `getApprovalStateById()`, `grantApproval()`, and `resumeTask()` methods
- Mimics production restart scenarios

### Rationale for Two-Layer Testing

Based on code analysis, there are two distinct layers to test:

1. **TaskStore Layer** (Lower Level): Direct SQLite persistence
   - `approval_states` table with schema: id, task_id, gate_name, status, approver, etc.
   - Already has good coverage in `approval-state-persistence.integration.test.ts`
   - Tests raw CRUD operations on approval state

2. **ApexOrchestrator Layer** (Higher Level): Business logic orchestration
   - `grantApproval()` - validates state, updates status, emits events, resumes task
   - `denyApproval()` - validates state, updates status, emits events, fails task
   - `getPendingApprovals()` - delegates to store
   - `getApprovalStateById()` - delegates to store
   - This is where the restart recovery test focuses

### Key Components

1. **ApexOrchestrator** - Main orchestrator class with approval gate handling
   - `grantApproval(approvalId, approver, comment?)` - Lines 3107-3183 in index.ts
   - `denyApproval(approvalId, approver, reason)` - Lines 3185-3265 in index.ts
   - `resumeTask(taskId, options?)` - Lines 4323+ in index.ts
   - Emits: `approval:approved`, `approval:denied`, `task:session-resumed`

2. **TaskStore** - SQLite-backed storage for tasks and approval states
   - `approval_states` table (Lines 400-417 in store.ts)
   - `saveApprovalState()` - Lines 2639-2667 in store.ts
   - `getApprovalStateById()` - Lines 2816-2820 in store.ts
   - `getPendingApprovals()` - Lines 2697-2705 in store.ts
   - `updateApprovalState()` - Lines 2723-2759 in store.ts
   - `close()` - Line 2874 in store.ts

3. **Approval State APIs**:
   - `saveApprovalState()` - Persists approval state
   - `getApprovalStateById()` - Retrieves specific approval
   - `getPendingApprovals()` - Lists all pending approvals
   - `updateApprovalState()` - Updates approval status

4. **Task Resume APIs**:
   - `resumeTask()` - Resumes task from checkpoint
   - `grantApproval()` - Approves and resumes task

## Test Implementation Design

### Test File Structure

```typescript
// packages/orchestrator/src/__tests__/approval-state-recovery-restart.integration.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import { query } from '@anthropic-ai/claude-agent-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the Claude Agent SDK query function
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Approval State Recovery After Restart', () => {
  // Test setup and lifecycle...
});
```

### Test Setup Requirements

1. **Temporary Directory**: Create temp dir for `.apex/` configuration and SQLite database
2. **Config Files**: Generate minimal `config.yaml` with:
   - Workflow with approval gates
   - Required agent definitions
   - Permission presets
3. **Mock Claude SDK**: Mock `query()` to simulate agent responses without actual API calls

### Test Cases

#### Test 1: Basic Approval Recovery After Restart

```
Given: A task paused at an approval gate with pending approval in SQLite
When: Orchestrator is shutdown and a new instance is created
Then: The pending approval is recovered and can be listed
```

#### Test 2: Grant Approval After Restart Resumes Task

```
Given: A recovered pending approval after restart
When: grantApproval() is called on the recovered approval
Then: Task resumes execution from checkpoint and continues workflow
```

#### Test 3: Multiple Pending Approvals Recovery

```
Given: Multiple tasks with pending approvals at different gates
When: Orchestrator restarts
Then: All pending approvals are recovered with correct task associations
```

#### Test 4: Approval State Integrity After Restart

```
Given: Approval with full context (approver, comment, timestamps, etc.)
When: Orchestrator restarts and retrieves approval
Then: All fields are preserved correctly after deserialization
```

### Implementation Flow

```
┌────────────────────────────────────────────────────────────────┐
│                         Phase 1: Setup                          │
├────────────────────────────────────────────────────────────────┤
│ 1. Create temp directory with .apex structure                   │
│ 2. Write config.yaml with workflow containing approval gate     │
│ 3. Create first ApexOrchestrator instance                       │
│ 4. Initialize and create task                                   │
└──────────────────────────────────┬─────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────┐
│                    Phase 2: Create Approval                     │
├────────────────────────────────────────────────────────────────┤
│ 1. Manually save approval state (simulating gate pause)         │
│ 2. Update task status to 'paused' or 'awaiting-approval'        │
│ 3. Create checkpoint for task at approval gate stage            │
│ 4. Verify approval exists via getPendingApprovals()             │
└──────────────────────────────────┬─────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────┐
│                  Phase 3: Simulate Restart                      │
├────────────────────────────────────────────────────────────────┤
│ 1. Shutdown first orchestrator (close connections)              │
│ 2. Create NEW ApexOrchestrator instance (same project path)     │
│ 3. Initialize new orchestrator                                  │
└──────────────────────────────────┬─────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────┐
│                  Phase 4: Verify Recovery                       │
├────────────────────────────────────────────────────────────────┤
│ 1. Call getPendingApprovals() - verify approval recovered       │
│ 2. Verify approval has correct taskId, gateName, status         │
│ 3. Verify task is still in paused/awaiting-approval status      │
└──────────────────────────────────┬─────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────┐
│                  Phase 5: Test Resume                           │
├────────────────────────────────────────────────────────────────┤
│ 1. Call grantApproval() with approvalId                         │
│ 2. Verify 'approval:approved' event emitted                     │
│ 3. Verify task status changes to 'in-progress'                  │
│ 4. (Mock ensures workflow continues after approval)             │
└────────────────────────────────────────────────────────────────┘
```

## Key Implementation Details

### Config.yaml Structure

```yaml
project:
  name: approval-recovery-test
  version: 1.0.0

autonomy:
  default: guided
  gates:
    - id: deploy-approval
      name: Deploy Approval
      description: Requires approval before deployment
      required: true
      autoApprove: false

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
```

### Workflow Definition

```yaml
name: Approval Test Workflow
description: Workflow with approval gate for testing

gates:
  - id: test-approval-gate
    name: Test Approval
    required: true

stages:
  - role: planner
    description: Plan the work
  - role: developer
    description: Implement the work
    gate: test-approval-gate
  - role: reviewer
    description: Review the work
```

### Mock Query Response

```typescript
const mockQueryResponse = {
  usage: { input_tokens: 100, output_tokens: 50 },
  content: [{ type: 'text', text: 'Stage completed successfully' }],
  stop_reason: 'end_turn',
  inputMessages: [],
  outputMessages: [],
};
```

## Dependencies

- **vitest** - Test framework
- **better-sqlite3** - SQLite driver (via TaskStore)
- **fs/os** - Temporary directory management
- **@anthropic-ai/claude-agent-sdk** - Mocked

## File Location

```
packages/orchestrator/src/__tests__/approval-state-recovery-restart.integration.test.ts
```

## Similar Existing Tests (Reference)

- `approval-state-persistence.integration.test.ts` - Approval persistence tests
- `apex-orchestrator-gate-loading.test.ts` - Gate configuration loading
- `enhanced-daemon-edge-cases.test.ts` - Restart/recovery scenarios
- `session-recovery-flow.integration.test.ts` - Task resume flow tests

## Success Metrics

1. ✅ Test passes consistently (no flakiness)
2. ✅ Coverage of all acceptance criteria
3. ✅ Proper cleanup (no temp files left behind)
4. ✅ Build passes with no errors
5. ✅ All existing tests continue to pass

## Detailed Implementation Strategy

### Why This Test is Different from Existing Tests

Existing tests cover:
- `approval-state-persistence.integration.test.ts` - TaskStore-level persistence (CRUD operations)
- `approval-handlers.integration.test.ts` - Concurrent operations, event ordering, data consistency

This test uniquely covers:
- **Full orchestrator restart simulation**: Complete shutdown and re-initialization
- **State recovery verification**: Confirming pending approval survives restart
- **Resume after recovery**: Granting approval works after restart

### Test Implementation Approach

The test should **NOT** mock the Claude SDK query for approval recovery testing because:
1. The approval state is persisted independently of the agent SDK
2. We're testing the TaskStore/Orchestrator persistence layer, not agent execution
3. We can directly manipulate approval states via `saveApprovalState()`

Instead, the test should:
1. Use real TaskStore with temp SQLite database
2. Manually create task and approval state (bypassing agent execution)
3. Simulate restart by closing and recreating orchestrator
4. Verify recovery through `getPendingApprovals()` and `getApprovalStateById()`
5. Test approval grant/deny through orchestrator methods

### API Contracts (from code analysis)

#### ApprovalState Interface (from @apexcli/core)
```typescript
interface ApprovalState {
  id: string;                    // Unique approval ID (PRIMARY KEY)
  taskId: string;                // Foreign key to tasks table
  gateName: string;              // Name of the approval gate
  status: ApprovalStatus;        // 'pending' | 'approved' | 'denied'
  approver?: string;             // Email/username of approver
  requestedAt: Date;             // When approval was requested
  respondedAt?: Date;            // When approval was granted/denied
  comment?: string;              // Optional comment from approver
  context?: Record<string, unknown>; // Arbitrary context (serialized as JSON)
  stage?: string;                // Current workflow stage
  agent?: string;                // Agent that triggered approval
  approvalsReceived: number;     // For multi-approval workflows
  approvalsRequired: number;     // Required approval count
  timeoutMinutes?: number;       // Optional timeout
  expiresAt?: Date;              // When approval expires
}
```

#### grantApproval Method Behavior (from index.ts lines 3107-3183)
```typescript
async grantApproval(approvalId: string, approver: string, comment?: string): Promise<void> {
  // 1. Validate approval exists and is pending
  // 2. Update approval state in database (status, approver, respondedAt, comment)
  // 3. Emit 'approval:approved' event
  // 4. Resume task (update status to 'in-progress')
  // 5. Emit 'task:session-resumed' event
}
```

#### Restart Simulation Pattern
```typescript
// Phase 1: Create and pause
const orchestrator1 = new ApexOrchestrator({ projectPath: tempDir });
await orchestrator1.initialize();
// ... create task and approval state ...

// Phase 2: Simulate restart
orchestrator1.store.close(); // Close DB connection
// Do NOT call orchestrator1.shutdown() if it cleans up state

// Phase 3: New instance
const orchestrator2 = new ApexOrchestrator({ projectPath: tempDir });
await orchestrator2.initialize();
// ... verify recovery and resume ...
```

### Risk Mitigation

1. **Race Conditions**: Use async/await properly, no parallel operations during critical sections
2. **Cleanup Failures**: Use try/finally in afterEach to ensure temp directories are removed
3. **WAL Mode Issues**: SQLite WAL mode may leave -wal and -shm files; cleanup should handle these
4. **Event Timing**: Add small delays or use event-based verification where needed

### Files to Create/Modify

1. **CREATE**: `packages/orchestrator/src/__tests__/approval-state-recovery-restart.integration.test.ts`
   - Main integration test file
   - 4-5 test cases covering all acceptance criteria

2. **NO MODIFICATIONS REQUIRED**: Existing code is sufficient to support this test
   - All necessary APIs already exist in TaskStore and ApexOrchestrator

### Estimated Test Structure

```typescript
describe('Approval State Recovery After Restart', () => {
  describe('Single approval recovery', () => {
    it('should recover pending approval after orchestrator restart');
    it('should grant approval on recovered pending approval');
  });

  describe('Multiple approval recovery', () => {
    it('should recover multiple pending approvals from different tasks');
  });

  describe('Approval state integrity', () => {
    it('should preserve all approval fields after restart');
    it('should correctly order recovered approvals by requestedAt');
  });
});
```
