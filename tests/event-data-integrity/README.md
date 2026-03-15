# Event Data Integrity Testing Architecture

## Overview

This document describes the technical design for comprehensive event data integrity testing
in the APEX system. The tests ensure that all event types defined in `ApexEventType` maintain
proper data structure, type safety, and integrity throughout the system lifecycle.

## Architecture Decision Record (ADR)

### ADR-001: Event Data Integrity Testing Strategy

**Status**: Proposed

**Context**:
The APEX system emits ~90 distinct event types across multiple categories (task, subtask, agent,
tool, gate/approval, container, permission, policy, undo/redo, auto-fix, TDD, visual, browser).
Each event type has specific data payload requirements defined by Zod schemas or TypeScript interfaces.
We need to ensure that:
1. All event payloads conform to their defined schemas
2. Event data maintains integrity through serialization/deserialization cycles
3. Event sequences follow logical workflows
4. Cross-event references (taskId, approvalId, etc.) are consistent

**Decision**:
Implement a multi-layered testing approach:
1. **Schema Validation Tests**: Verify each event type's data conforms to its schema
2. **Serialization Tests**: Ensure events survive JSON round-trips
3. **Workflow Tests**: Validate event sequences in realistic scenarios
4. **Cross-Reference Tests**: Check referential integrity across related events
5. **Edge Case Tests**: Handle malformed, missing, or unexpected data gracefully

**Consequences**:
- Comprehensive coverage of all event types
- Early detection of schema drift or breaking changes
- Clear documentation of event contracts through tests

## Event Categories

### 1. Task Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `task:created` | TaskCreatedEventData | taskId, description, workflow, priority |
| `task:started` | TaskStartedEventData | taskId, timestamp |
| `task:stage-changed` | TaskStageChangedEventData | taskId, oldStage, newStage |
| `task:completed` | TaskCompletedEventData | taskId, result, duration |
| `task:failed` | TaskFailedEventData | taskId, error, retryable |
| `task:paused` | TaskPausedEventData | taskId, reason |
| `task:session-resumed` | TaskSessionResumedEventData | taskId, previousState |
| `task:decomposed` | TaskDecomposedEventData | taskId, subtasks[] |
| `task:iteration-started` | TaskIterationEventData | taskId, iteration |
| `task:iteration-completed` | TaskIterationEventData | taskId, iteration, result |
| `task:trashed` | TaskTrashedEventData | taskId, trashedAt |
| `task:restored` | TaskRestoredEventData | taskId, restoredAt |
| `task:archived` | TaskArchivedEventData | taskId, archivedAt |
| `task:unarchived` | TaskUnarchivedEventData | taskId, unarchivedAt |
| `trash:emptied` | TrashEmptiedEventData | count, timestamp |

### 2. Subtask Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `subtask:created` | SubtaskCreatedEventData | subtaskId, parentTaskId, description |
| `subtask:completed` | SubtaskCompletedEventData | subtaskId, parentTaskId, result |
| `subtask:failed` | SubtaskFailedEventData | subtaskId, parentTaskId, error |

### 3. Agent Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `agent:message` | AgentMessageEventData | taskId, agent, message, role |
| `agent:thinking` | AgentThinkingEventData | taskId, agent, content |
| `agent:tool-use` | AgentToolUseEventData | taskId, agent, tool, input |
| `agent:tool-result` | AgentToolResultEventData | taskId, agent, tool, result |

### 4. Tool Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `tool:start` | ToolStartEventData | taskId, toolName, callId, input |
| `tool:progress` | ToolProgressEventData | taskId, toolName, callId, progress |
| `tool:complete` | ToolCompleteEventData | taskId, toolName, callId, result, timing |
| `tool:timing` | ToolTimingEventData | taskId, toolName, duration, metrics |

### 5. Gate/Approval Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `gate:required` | GateRequiredEventData | gateId, taskId, type |
| `approval-required` | ApprovalRequiredEventData | approvalId, taskId, gateName, minApprovals |
| `approval-resolved` | ApprovalResolvedEventData | approvalId, taskId, resolution |
| `gate:approved` | GateApprovedEventData | gateId, taskId, approver |
| `gate:rejected` | GateRejectedEventData | gateId, taskId, rejecter, reason |
| `approval:granted` | ApprovalGrantedEventData | approvalId, taskId, timestamp |
| `approval:denied` | ApprovalDeniedEventData | approvalId, taskId, timestamp |

### 6. Container Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `container:created` | ContainerCreatedEventData | containerId, containerName, image |
| `container:started` | ContainerStartedEventData | containerId, pid, ports |
| `container:stopped` | ContainerStoppedEventData | containerId, exitCode, graceful |
| `container:died` | ContainerDiedEventData | containerId, exitCode, oomKilled |
| `container:removed` | ContainerRemovedEventData | containerId, forced |
| `container:health` | ContainerHealthEventData | containerId, status |

### 7. Permission Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `permission:request` | PermissionRequestEventData | requestId, tool, scope, isDangerous |
| `permission:granted` | PermissionGrantedEventData | requestId, tool, level |
| `permission:denied` | PermissionDeniedEventData | requestId, tool, reason |
| `dangerous:detected` | DangerousOperationDetectedEventData | operationId, tool, description |
| `dangerous:confirmed` | DangerousOperationConfirmedEventData | operationId, confirmedBy |
| `dangerous:blocked` | DangerousOperationBlockedEventData | operationId, reason |

### 8. Policy Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `policy:blocked` | PolicyBlockedEventData | taskId, agent, violations[] |
| `policy:warned` | PolicyWarnedEventData | taskId, agent, violations[] |
| `policy:audited` | PolicyAuditedEventData | taskId, agent, action |

### 9. Undo/Redo Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `undo:requested` | UndoRequestedEventData | taskId, operationId |
| `undo:started` | UndoStartedEventData | taskId, operationId |
| `undo:completed` | UndoCompletedEventData | taskId, operationId, result |
| `undo:failed` | UndoFailedEventData | taskId, operationId, error |
| `redo:requested` | RedoRequestedEventData | taskId, operationId |
| `redo:started` | RedoStartedEventData | taskId, operationId |
| `redo:completed` | RedoCompletedEventData | taskId, operationId, result |
| `redo:failed` | RedoFailedEventData | taskId, operationId, error |

### 10. Auto-fix Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `autofix:requested` | AutofixRequestedEventData | taskId, filePath, fixTypes[] |
| `autofix:started` | AutofixStartedEventData | taskId, filePath, fixType |
| `autofix:progress` | AutofixProgressEventData | taskId, iteration, issuesFixed |
| `autofix:completed` | AutofixCompletedEventData | taskId, issuesDetected, issuesFixed |
| `autofix:failed` | AutofixFailedEventData | taskId, error |
| `autofix:skipped` | AutofixSkippedEventData | taskId, reason |

### 11. TDD Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `tdd:started` | TDDStartedEventData | taskId, testCommand, maxIterations |
| `tdd:iteration-started` | TDDIterationStartedEventData | taskId, iteration |
| `tdd:test-run` | TDDTestRunEventData | taskId, success, failures[] |
| `tdd:fix-generated` | TDDFixGeneratedEventData | taskId, fixes[] |
| `tdd:fix-applied` | TDDFixAppliedEventData | taskId, file, changes |
| `tdd:regression-detected` | TDDRegressionDetectedEventData | taskId, regressions[] |
| `tdd:fix-reverted` | TDDFixRevertedEventData | taskId, file |
| `tdd:iteration-completed` | TDDIterationCompletedEventData | taskId, iteration, status |
| `tdd:completed` | TDDCompletedEventData | taskId, summary |
| `tdd:failed` | TDDFailedEventData | taskId, error |

### 12. Visual Comparison Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `visual:comparison:failed` | VisualComparisonEventData | testId, diffPercentage |
| `visual:comparison:passed` | VisualComparisonEventData | testId, diffPercentage |

### 13. Browser Events
| Event Type | Data Interface | Key Fields |
|------------|---------------|------------|
| `browser:console` | BrowserConsoleEventData | message, severity |
| `browser:error` | BrowserErrorEventData | name, message, stack |
| `browser:network-error` | BrowserNetworkErrorEventData | url, status |
| `browser:performance-warning` | BrowserPerformanceEventData | metric, value |
| `browser:security-violation` | BrowserSecurityEventData | type, blockedUrl |
| `browser:session-started` | BrowserSessionEventData | sessionId, url |
| `browser:session-ended` | BrowserSessionEventData | sessionId, duration |

## Test File Structure

```
tests/event-data-integrity/
├── README.md                           # This architecture document
├── shared/
│   ├── event-test-utils.ts            # Shared test utilities
│   ├── event-validators.ts            # Validation helpers
│   ├── mock-event-generators.ts       # Factory functions for test events
│   └── timing-consistency-utils.ts    # Timing validation utilities
├── task-events.test.ts                # Task event integrity tests
├── subtask-events.test.ts             # Subtask event integrity tests
├── agent-events.test.ts               # Agent event integrity tests
├── tool-events.test.ts                # Tool event integrity tests
├── approval-events.test.ts            # Gate/approval event integrity tests
├── container-events.test.ts           # Container lifecycle event tests
├── permission-events.test.ts          # Permission event integrity tests
├── policy-events.test.ts              # Policy event integrity tests
├── undo-redo-events.test.ts          # Undo/redo event integrity tests
├── autofix-events.test.ts            # Auto-fix event integrity tests
├── tdd-events.test.ts                # TDD event integrity tests
├── visual-events.test.ts             # Visual comparison event tests
├── browser-events.test.ts            # Browser automation event tests
├── timing-consistency.test.ts        # Cross-event timing consistency tests
├── cross-reference-integrity.test.ts # Cross-event reference validation
└── event-workflow-sequences.test.ts  # Full workflow scenario tests
```

## Implementation Priorities

### Phase 1: Core Event Categories (High Priority)
1. Task events - fundamental to all workflows
2. Agent events - critical for observability
3. Tool events - essential for debugging
4. Approval/Gate events - security critical

### Phase 2: Lifecycle Events (Medium Priority)
5. Container events
6. Permission events
7. Policy events

### Phase 3: Specialized Events (Lower Priority)
8. Undo/Redo events
9. Auto-fix events
10. TDD events
11. Visual comparison events
12. Browser events

### Phase 4: Integration
13. Cross-reference integrity
14. Workflow sequence tests

## Test Patterns

### Pattern 1: Schema Validation
```typescript
describe('Event Schema Validation', () => {
  it('should accept valid event data', () => {
    const validEvent = createValidEventData();
    expect(() => EventSchema.parse(validEvent)).not.toThrow();
  });

  it('should reject missing required fields', () => {
    const invalidEvent = { /* missing required fields */ };
    expect(() => EventSchema.parse(invalidEvent)).toThrow();
  });

  it('should apply default values correctly', () => {
    const minimalEvent = createMinimalEventData();
    const parsed = EventSchema.parse(minimalEvent);
    expect(parsed.optionalField).toBe(defaultValue);
  });
});
```

### Pattern 2: Serialization Round-Trip
```typescript
describe('Event Serialization', () => {
  it('should survive JSON round-trip', () => {
    const original = createEventData();
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);

    // Date fields need special handling
    deserialized.timestamp = new Date(deserialized.timestamp);

    expect(deserialized).toMatchObject(original);
  });
});
```

### Pattern 3: Cross-Reference Validation
```typescript
describe('Cross-Reference Integrity', () => {
  it('should maintain consistent taskId across related events', () => {
    const taskId = 'task-123';
    const events = [
      createTaskStartedEvent(taskId),
      createToolStartEvent(taskId),
      createToolCompleteEvent(taskId),
      createTaskCompletedEvent(taskId),
    ];

    events.forEach(event => {
      expect(event.taskId).toBe(taskId);
    });
  });
});
```

## Success Criteria

1. **Coverage**: All 90+ event types have validation tests
2. **Schema Conformance**: 100% of events pass schema validation
3. **Serialization**: All events survive JSON round-trip
4. **Referential Integrity**: Cross-event references are validated
5. **Edge Cases**: Graceful handling of malformed data
6. **Documentation**: Event contracts are clearly documented in tests

## Integration with Existing Tests

The new event integrity tests complement existing test files:
- `packages/core/src/__tests__/approval-event-types.test.ts`
- `packages/core/src/__tests__/container-events-type-validation.test.ts`
- `packages/core/src/__tests__/auto-fix-event-validation.test.ts`
- `packages/orchestrator/tests/utils/event-capture.ts`

The new tests provide a unified, comprehensive approach to event data integrity
while the existing tests focus on specific functionality.
