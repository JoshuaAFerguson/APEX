# ADR-004: ApprovalGate Class Design

## Status
Proposed

## Date
2025-01-03

## Context

The APEX orchestrator needs a class-based abstraction for managing approval gates that can:
1. Pause execution and wait for approval
2. Support async approval/rejection with timeout
3. Emit 'approval:requested' and 'approval:resolved' events
4. Integrate with the existing EventEmitter pattern in the orchestrator

### Current State Analysis

The codebase already has:
- **ApprovalGate type** (Zod schema): Configuration for approval gates (`packages/core/src/types.ts`)
- **ApprovalState type** (Zod schema): Runtime state of approval requests
- **Approval methods** in `ApexOrchestrator`: `grantApproval`, `denyApproval`, `getApprovalStateById`
- **Approval events**: `approval:required`, `approval:approved`, `approval:denied`
- **TaskStore persistence**: `saveApprovalState`, `getApprovalState`, `updateApprovalState`, `getPendingApprovals`, `getExpiredApprovals`
- **Gate configuration storage**: `this.gates: Map<string, ApprovalGate>` in orchestrator

The approval flow currently works as follows:
1. Orchestrator checks for gates before stage execution
2. If gate is required, creates `ApprovalState` and saves to database
3. Emits `approval:required` event
4. Task status changes to `awaiting-approval`
5. External system calls `grantApproval` or `denyApproval`
6. Corresponding event is emitted, task resumes or fails

### Problem

The current implementation spreads approval gate logic across the orchestrator, making it difficult to:
- Test approval gate behavior in isolation
- Reuse approval gate logic in other contexts
- Add new approval-related features without modifying the orchestrator

## Decision

We will implement an `ApprovalGate` **class** that encapsulates the approval gate lifecycle, providing:
1. A clean interface for requesting and waiting for approvals
2. Promise-based async waiting with configurable timeout
3. EventEmitter integration for approval events
4. Proper cleanup and timeout handling

### Design Principles

1. **Single Responsibility**: The class manages one approval gate instance lifecycle
2. **Event-Driven**: Uses EventEmitter for approval notifications
3. **Timeout Support**: Configurable timeout with auto-resolution options
4. **Promise-Based**: `waitForApproval()` returns a Promise for clean async/await usage
5. **Non-Breaking**: Integrates with existing types and store methods

## Technical Design

### Class Interface

```typescript
import { EventEmitter } from 'eventemitter3';
import {
  ApprovalGate as ApprovalGateConfig,
  ApprovalState,
  ApprovalStatus,
  generateApprovalId,
} from '@apexcli/core';
import { TaskStore } from './store';

export interface ApprovalGateEvents {
  'approval:requested': (state: ApprovalState) => void;
  'approval:resolved': (state: ApprovalState, decision: 'approved' | 'denied' | 'timeout') => void;
  'approval:timeout': (state: ApprovalState) => void;
}

export interface ApprovalGateOptions {
  /** The gate configuration */
  config: ApprovalGateConfig;
  /** Task ID this approval is for */
  taskId: string;
  /** Current stage name */
  stage: string;
  /** Agent handling this stage */
  agent: string;
  /** Store for persistence */
  store: TaskStore;
  /** Optional parent emitter to forward events to */
  parentEmitter?: EventEmitter;
  /** Optional context data */
  context?: Record<string, unknown>;
}

export interface ApprovalResult {
  status: 'approved' | 'denied' | 'timeout';
  approver?: string;
  comment?: string;
  respondedAt?: Date;
  approvalsReceived: number;
  approvalsRequired: number;
}

export class ApprovalGateController extends EventEmitter<ApprovalGateEvents> {
  private state: ApprovalState;
  private config: ApprovalGateConfig;
  private store: TaskStore;
  private parentEmitter?: EventEmitter;
  private timeoutHandle?: NodeJS.Timeout;
  private resolveWait?: (result: ApprovalResult) => void;
  private rejectWait?: (error: Error) => void;

  constructor(options: ApprovalGateOptions);

  /** Get the current approval state */
  get approvalState(): ApprovalState;

  /** Get the approval ID */
  get id(): string;

  /** Check if approval is still pending */
  get isPending(): boolean;

  /** Check if approval has been resolved */
  get isResolved(): boolean;

  /**
   * Request approval and wait for resolution
   * @returns Promise that resolves when approval is granted, denied, or times out
   */
  async requestApproval(): Promise<ApprovalResult>;

  /**
   * Grant the approval
   * @param approver Who granted the approval
   * @param comment Optional comment
   */
  async grant(approver: string, comment?: string): Promise<void>;

  /**
   * Deny the approval
   * @param approver Who denied the approval
   * @param reason Reason for denial
   */
  async deny(approver: string, reason: string): Promise<void>;

  /**
   * Cancel the pending approval (e.g., if task is cancelled)
   */
  async cancel(): Promise<void>;

  /**
   * Clean up resources (timers, etc.)
   */
  dispose(): void;
}
```

### Event Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ApprovalGateController                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  requestApproval()                                               │
│       │                                                          │
│       ▼                                                          │
│  ┌────────────────┐                                              │
│  │ Create State   │──────► emit('approval:requested', state)     │
│  │ Save to Store  │                                              │
│  │ Start Timeout  │                                              │
│  └────────────────┘                                              │
│       │                                                          │
│       ▼                                                          │
│  ┌────────────────┐     grant()      ┌──────────────────────┐   │
│  │    PENDING     │─────────────────►│ Update State         │   │
│  │  (Waiting)     │                  │ Stop Timeout         │   │
│  └────────────────┘                  │ emit('resolved')     │   │
│       │                              │ Resolve Promise      │   │
│       │ deny()                       └──────────────────────┘   │
│       ▼                                                          │
│  ┌────────────────┐                                              │
│  │ Update State   │                                              │
│  │ Stop Timeout   │                                              │
│  │ emit('resolved')│                                             │
│  │ Resolve Promise│                                              │
│  └────────────────┘                                              │
│       │                                                          │
│       │ timeout                                                  │
│       ▼                                                          │
│  ┌────────────────┐                                              │
│  │ emit('timeout')│                                              │
│  │ Auto-deny OR   │──► emit('resolved', 'timeout')              │
│  │ Keep Pending   │                                              │
│  └────────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Integration with Orchestrator

The `ApexOrchestrator` will be updated to use `ApprovalGateController`:

```typescript
// In executeWorkflow, when gate check is needed:
const gateController = new ApprovalGateController({
  config: gateCheck.gate,
  taskId: task.id,
  stage: stage.name,
  agent: stage.agent,
  store: this.store,
  parentEmitter: this, // Forward events to orchestrator
  context: {
    workflowName: workflow.name,
    stageDescription: stage.description,
    gateDescription: gateCheck.gate.description,
  },
});

// Subscribe to events
gateController.on('approval:requested', (state) => {
  this.emit('approval:required', this.toApprovalRequiredEventData(state));
});

gateController.on('approval:resolved', (state, decision) => {
  if (decision === 'approved') {
    this.emit('approval:approved', this.toApprovalGrantedEventData(state));
  } else {
    this.emit('approval:denied', this.toApprovalDeniedEventData(state));
  }
});

// Request approval (this creates state, saves, emits, waits)
const result = await gateController.requestApproval();

if (result.status === 'approved') {
  // Continue workflow execution
} else {
  // Handle denial or timeout
}
```

### Timeout Handling

```typescript
// Configuration options from ApprovalGateConfig:
timeout?: number;           // Timeout in minutes
autoApproveOnTimeout?: boolean;  // Auto-approve if timeout

// Behavior:
// 1. If timeout is set and autoApproveOnTimeout is true:
//    - After timeout, automatically grant approval
//    - Resolve promise with status: 'timeout', treated as approval
//
// 2. If timeout is set and autoApproveOnTimeout is false (or unset):
//    - After timeout, emit 'approval:timeout' event
//    - Resolve promise with status: 'timeout', treated as denial
//
// 3. If no timeout:
//    - Wait indefinitely until grant/deny is called
```

### File Location

The new class will be in:
```
packages/orchestrator/src/approval-gate-controller.ts
```

### Exports

Add to `packages/orchestrator/src/index.ts`:
```typescript
export { ApprovalGateController, ApprovalGateOptions, ApprovalResult, ApprovalGateEvents } from './approval-gate-controller';
```

## Consequences

### Positive
- **Encapsulation**: Approval gate logic is contained in a single class
- **Testability**: Easy to unit test in isolation
- **Reusability**: Can be used in different contexts (CLI, API, tests)
- **Maintainability**: Changes to approval logic are localized
- **Event Consistency**: Maintains compatibility with existing events

### Negative
- **Additional Abstraction**: One more class to understand
- **Refactoring Required**: Orchestrator code needs updating to use the new class
- **Event Mapping**: Need to map between class events and orchestrator events

### Risks
- Must ensure backward compatibility with existing approval event consumers
- Timeout handling must be thoroughly tested
- Need to handle edge cases (multiple grants, grant after timeout, etc.)

## Implementation Plan

1. **Phase 1**: Create `ApprovalGateController` class with tests
2. **Phase 2**: Update `ApexOrchestrator` to use the new class
3. **Phase 3**: Verify all existing approval tests still pass
4. **Phase 4**: Add additional tests for new functionality

## Alternatives Considered

### Alternative 1: Extend existing ApexOrchestrator
Keep all logic in orchestrator, just refactor internal methods.
- **Rejected**: Doesn't address the encapsulation/testability concerns

### Alternative 2: Static utility functions
Create pure functions for approval logic.
- **Rejected**: Hard to manage state (timeouts, event listeners)

### Alternative 3: Use existing ApprovalState as a class
Convert the Zod type to a class.
- **Rejected**: ApprovalState is a pure data type; behavior should be separate

## References

- `packages/core/src/types.ts` - ApprovalGate, ApprovalState types
- `packages/orchestrator/src/index.ts` - ApexOrchestrator approval methods
- `packages/orchestrator/src/store.ts` - TaskStore approval persistence
