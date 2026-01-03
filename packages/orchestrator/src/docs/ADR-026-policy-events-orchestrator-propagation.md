# ADR-026: Policy Events Propagation Through Orchestrator Event System

## Status

Proposed

## Date

2025-01-03

## Context

The PolicyEnforcer class already extends `EventEmitter` and emits `'policy:violation'` events (as implemented in ADR-020). However, these events are currently internal to the PolicyEnforcer and are not propagated through the ApexOrchestrator's central event system.

### Current State

1. **PolicyEnforcer** (`packages/orchestrator/src/policy/policy-enforcer.ts`):
   - Extends `EventEmitter<PolicyEnforcerEvents>`
   - Emits `'policy:violation'` events when violations are detected
   - Events include: policy name, severity, violation details, and affected task context

2. **OrchestratorEvents** (`packages/orchestrator/src/index.ts`):
   - Currently does NOT include policy-specific events
   - Has established patterns for event propagation (e.g., container events, dependency events, permission events)

3. **PolicyViolationEvent** (`packages/core/src/types.ts`):
   - Already defined with Zod schema
   - Includes: `type`, `id`, `timestamp`, `violation`, `taskId`, `agentId`, `workflowId`, `metadata`

### Problem Statement

Subscribers listening to `ApexOrchestrator` events cannot receive policy events without directly accessing the internal `PolicyEnforcer` instance. This breaks the encapsulation pattern used throughout the orchestrator.

## Decision

Add policy events to `OrchestratorEvents` interface and forward PolicyEnforcer events through the ApexOrchestrator event system. Implement the full set of policy lifecycle events:

- `policy:check` - Emitted when policy checking starts
- `policy:pass` - Emitted when policy check passes
- `policy:violation` - Emitted for each policy violation (forwarded from PolicyEnforcer)
- `policy:block` - Emitted when a task is blocked due to policy violations

### Architecture

#### New Event Interfaces

```typescript
// In packages/orchestrator/src/index.ts

/**
 * Event payload for policy:check event
 * Emitted when policy evaluation begins for a task
 */
export interface PolicyCheckEventData {
  /** Task ID being checked */
  taskId: string;
  /** Policy name/configuration being evaluated */
  policyName?: string;
  /** Type of check being performed */
  checkType: 'task-start' | 'file-access' | 'approval-gate' | 'operation';
  /** Timestamp when check started */
  timestamp: Date;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Event payload for policy:pass event
 * Emitted when policy check completes successfully
 */
export interface PolicyPassEventData {
  /** Task ID that passed */
  taskId: string;
  /** Policy name/configuration used */
  policyName?: string;
  /** Check type that passed */
  checkType: 'task-start' | 'file-access' | 'approval-gate' | 'operation';
  /** Number of rules evaluated */
  rulesEvaluated: number;
  /** Number of warnings (non-blocking) */
  warningCount: number;
  /** Timestamp when check completed */
  timestamp: Date;
  /** Duration of policy check in milliseconds */
  durationMs?: number;
}

/**
 * Event payload for policy:block event
 * Emitted when a task is blocked due to policy violations
 */
export interface PolicyBlockEventData {
  /** Task ID that was blocked */
  taskId: string;
  /** Policy name/configuration that blocked */
  policyName?: string;
  /** Violations that caused the block */
  violations: PolicyViolation[];
  /** Severity of the most critical violation */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable reason for blocking */
  reason: string;
  /** Whether approval could allow proceeding */
  requiresApproval: boolean;
  /** Approval rules that were triggered (if any) */
  triggeredApprovalRules?: string[];
  /** Timestamp when block occurred */
  timestamp: Date;
}
```

#### OrchestratorEvents Extension

```typescript
// In packages/orchestrator/src/index.ts
export interface OrchestratorEvents {
  // ... existing events ...

  // Policy events (v0.5.0)
  'policy:check': (event: PolicyCheckEventData) => void;
  'policy:pass': (event: PolicyPassEventData) => void;
  'policy:violation': (event: PolicyViolationEvent) => void;
  'policy:block': (event: PolicyBlockEventData) => void;
}
```

#### Event Forwarding in ApexOrchestrator

```typescript
// In ApexOrchestrator class

private setupPolicyEventForwarding(): void {
  // Forward violation events from PolicyEnforcer
  this.policyEnforcer.on('policy:violation', (event: PolicyViolationEvent) => {
    this.emit('policy:violation', event);
  });
}
```

### Event Flow

```
┌───────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Task Start    │────▶│ PolicyEnforcer   │────▶│ ApexOrchestrator    │
│ Request       │     │ checkTaskStart() │     │ Event Emitter       │
└───────────────┘     └──────────────────┘     └─────────────────────┘
                              │                         │
                              │ 'policy:violation'      │
                              │ (internal)              │
                              ▼                         ▼
                      ┌──────────────────┐     ┌─────────────────────┐
                      │ PolicyEnforcer   │────▶│ Subscribers         │
                      │ EventEmitter     │     │ (CLI, API, etc.)    │
                      └──────────────────┘     └─────────────────────┘
```

### Event Emission Points

| Method | Events Emitted | Condition |
|--------|----------------|-----------|
| `executeTask()` | `policy:check` | Before calling `checkTaskStart()` |
| `executeTask()` | `policy:pass` | When `checkTaskStart().passed === true` |
| `executeTask()` | `policy:violation` | Forwarded from PolicyEnforcer |
| `executeTask()` | `policy:block` | When task execution is blocked |

### Violation Event Details

The `PolicyViolationEvent` (from PolicyEnforcer) includes:

```typescript
interface PolicyViolationEvent {
  type: 'policy_violation';
  id: string;                          // Unique event ID
  timestamp: Date;
  violation: {
    id: string;
    rule: string;                      // Policy rule ID
    policyType: 'path' | 'test' | 'approval';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    blocking: boolean;
    description?: string;
    resource?: string;                 // File path or resource that violated
    context?: {
      matchType?: 'block' | 'allow' | 'sensitive' | 'default';
      isSensitive?: boolean;
      matchedPattern?: string;
      requiresApproval?: boolean;
      // ... additional context
    };
    timestamp: Date;
    resolved: boolean;
  };
  taskId?: string;
  agentId?: string;
  workflowId?: string;
  metadata?: Record<string, unknown>;
}
```

## Implementation Plan

### Phase 1: Event Type Definitions

1. **Add event interfaces** to `packages/orchestrator/src/index.ts`:
   - `PolicyCheckEventData`
   - `PolicyPassEventData`
   - `PolicyBlockEventData`

2. **Extend OrchestratorEvents** with policy events:
   - `'policy:check'`
   - `'policy:pass'`
   - `'policy:violation'`
   - `'policy:block'`

### Phase 2: Event Forwarding Setup

3. **Add `setupPolicyEventForwarding()`** method in ApexOrchestrator:
   - Subscribe to PolicyEnforcer's `'policy:violation'` events
   - Forward to orchestrator's event emitter

4. **Call setup** in `initialize()`:
   - After PolicyEnforcer is created
   - Before any task execution

### Phase 3: Emission Points

5. **Emit `policy:check`** in `executeTask()`:
   - Before calling `policyEnforcer.checkTaskStart()`
   - Include task ID, policy name, check type

6. **Emit `policy:pass`** in `executeTask()`:
   - When policy check passes
   - Include evaluation results summary

7. **Emit `policy:block`** in `executeTask()`:
   - When task is blocked due to violations
   - Include violation details and severity

### Phase 4: Export Updates

8. **Export new types** from `packages/orchestrator/src/index.ts`:
   - Add to exports: `PolicyCheckEventData`, `PolicyPassEventData`, `PolicyBlockEventData`

### File Changes Summary

| File | Changes |
|------|---------|
| `packages/orchestrator/src/index.ts` | Add event interfaces, extend OrchestratorEvents, add forwarding setup, emit events |

### Implementation Checklist

- [ ] Add `PolicyCheckEventData` interface
- [ ] Add `PolicyPassEventData` interface
- [ ] Add `PolicyBlockEventData` interface
- [ ] Extend `OrchestratorEvents` with policy events
- [ ] Add `setupPolicyEventForwarding()` method
- [ ] Call setup in `initialize()` method
- [ ] Emit `policy:check` event before policy evaluation
- [ ] Emit `policy:pass` event on successful check
- [ ] Emit `policy:block` event when task blocked
- [ ] Export new event data types
- [ ] Run `npm run build` to verify compilation
- [ ] Run `npm run test` to verify tests pass

## Consequences

### Positive

- **Unified event system**: Policy events flow through the same channel as all other orchestrator events
- **Subscriber transparency**: CLI, API, and other consumers can subscribe to policy events without accessing internals
- **Consistent patterns**: Follows established event forwarding patterns (container events, dependency events)
- **Complete lifecycle visibility**: Start, pass, violation, and block events cover the full policy check lifecycle
- **Type safety**: All events use typed interfaces with full IntelliSense support

### Negative

- **Slight coupling**: Orchestrator becomes dependent on PolicyEnforcer's event interface
- **Event overhead**: Additional events may increase memory/processing for high-throughput scenarios

### Risks

- **Event listener leaks**: Must ensure proper cleanup in `shutdown()` (mitigated by standard cleanup patterns)
- **Event ordering**: Violations may emit before check-complete event (documented behavior)

## Testing Strategy

### Unit Tests

```typescript
describe('Policy Event Propagation', () => {
  it('should emit policy:check when task start check begins', async () => {
    const orchestrator = await createTestOrchestrator();
    const events: PolicyCheckEventData[] = [];
    orchestrator.on('policy:check', (e) => events.push(e));

    await orchestrator.createTask({ ... });

    expect(events).toHaveLength(1);
    expect(events[0].checkType).toBe('task-start');
  });

  it('should emit policy:pass when check passes', async () => {
    const orchestrator = await createTestOrchestrator({ policy: { enabled: true } });
    const events: PolicyPassEventData[] = [];
    orchestrator.on('policy:pass', (e) => events.push(e));

    await orchestrator.createTask({ ... });

    expect(events).toHaveLength(1);
  });

  it('should forward policy:violation from PolicyEnforcer', async () => {
    const orchestrator = await createTestOrchestrator({
      policy: {
        enabled: true,
        allowedPaths: { mode: 'allowlist', allow: ['src/**'], block: ['src/secrets/**'] }
      }
    });
    const events: PolicyViolationEvent[] = [];
    orchestrator.on('policy:violation', (e) => events.push(e));

    // Trigger task with violating path access
    await orchestrator.createTask({ ... });

    expect(events.length).toBeGreaterThan(0);
  });

  it('should emit policy:block when task is blocked', async () => {
    const orchestrator = await createTestOrchestrator({
      policy: { enabled: true, enforcement: 'strict' }
    });
    const events: PolicyBlockEventData[] = [];
    orchestrator.on('policy:block', (e) => events.push(e));

    // Trigger task that should be blocked
    await orchestrator.createTask({ workflow: 'production-deploy' });

    expect(events).toHaveLength(1);
    expect(events[0].severity).toBeDefined();
  });
});
```

### Integration Tests

- Verify CLI receives policy events and displays them
- Verify API WebSocket broadcasts policy events to connected clients
- Verify event order: check → violation(s) → block/pass

## References

- ADR-020: PolicyEnforcer Event Emission for Policy Violations
- ADR-018: PolicyEnforcer Base Class
- PolicyEnforcer: `packages/orchestrator/src/policy/policy-enforcer.ts`
- PolicyViolationEvent: `packages/core/src/types.ts`
- Container event forwarding pattern: `setupContainerEventForwarding()` in index.ts
- Dependency event forwarding pattern: `setupDependencyEventForwarding()` in index.ts
