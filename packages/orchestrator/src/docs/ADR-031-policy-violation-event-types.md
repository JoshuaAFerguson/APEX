# ADR-031: Policy Violation Event Types for Orchestrator Event System

## Status

Proposed

## Date

2025-01-07

## Context

The acceptance criteria require adding four new policy event types to the orchestrator event system:

1. `policy:violation` - When a policy violation is detected
2. `policy:blocked` - When an action is blocked due to policy
3. `policy:warned` - When a warning is issued (non-blocking)
4. `policy:audited` - When a policy check is logged for audit purposes

Event payloads must include:
- Task ID
- Agent name
- Action being performed
- Violation details
- Enforcement mode (strict/warn/audit/disabled)

### Current State Analysis

1. **Existing Infrastructure**:
   - `PolicyEnforcerEvents` interface in `policy/policy-enforcer.ts` already defines `'policy:violation'` event
   - `PolicyViolationEvent` type is defined in `@apexcli/core` with Zod schema
   - `OrchestratorEvents` interface contains 60+ event types with established patterns
   - `ApexEventType` union in core types does NOT yet include policy events

2. **Existing Types**:
   - `PolicyViolationEvent` (core): Contains `violation`, `taskId`, `agentId`, `workflowId`, `metadata`
   - `PolicyViolation` (core): Contains `id`, `rule`, `policyType`, `severity`, `message`, `blocking`, `resource`, `context`
   - `PolicyEnforcementMode`: `'strict' | 'warn' | 'audit' | 'disabled'`

3. **ADR-026 Proposal**:
   - Proposed `policy:check`, `policy:pass`, `policy:violation`, `policy:block` events
   - Has not been implemented yet
   - This ADR supersedes ADR-026 with the specific requirements from acceptance criteria

## Decision

### 1. New Event Types

Add four policy event types to `OrchestratorEvents` interface:

```typescript
// In packages/orchestrator/src/index.ts

export interface OrchestratorEvents {
  // ... existing events ...

  // Policy enforcement events (v0.5.0)
  'policy:violation': (event: PolicyViolationEventData) => void;
  'policy:blocked': (event: PolicyBlockedEventData) => void;
  'policy:warned': (event: PolicyWarnedEventData) => void;
  'policy:audited': (event: PolicyAuditedEventData) => void;
}
```

### 2. Event Payload Interfaces

```typescript
/**
 * Base interface for all policy event payloads
 * Contains common fields required by acceptance criteria
 */
export interface PolicyEventDataBase {
  /** Task ID the policy check is associated with */
  taskId: string;
  /** Agent performing the action */
  agent: string;
  /** Action being performed (e.g., 'file:write', 'command:execute') */
  action: string;
  /** Enforcement mode in effect */
  enforcementMode: PolicyEnforcementMode;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Optional workflow ID */
  workflowId?: string;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event payload for policy:violation event
 * Emitted when a policy violation is detected (regardless of enforcement mode)
 */
export interface PolicyViolationEventData extends PolicyEventDataBase {
  /** Unique violation ID */
  violationId: string;
  /** The policy rule that was violated */
  rule: string;
  /** Type of policy violated */
  policyType: 'path' | 'test' | 'approval' | 'operation';
  /** Severity of the violation */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable violation message */
  message: string;
  /** Resource that triggered the violation (e.g., file path) */
  resource?: string;
  /** Whether this violation is blocking */
  blocking: boolean;
  /** Pattern that matched (if applicable) */
  matchedPattern?: string;
  /** Additional violation context */
  violationContext?: Record<string, unknown>;
}

/**
 * Event payload for policy:blocked event
 * Emitted when an action is blocked due to policy (strict mode)
 */
export interface PolicyBlockedEventData extends PolicyEventDataBase {
  /** Unique block event ID */
  blockId: string;
  /** Violations that caused the block */
  violations: Array<{
    violationId: string;
    rule: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    resource?: string;
  }>;
  /** Human-readable reason for blocking */
  reason: string;
  /** Whether approval could allow proceeding */
  canRequestApproval: boolean;
  /** Triggered approval rules (if any) */
  triggeredApprovalRules?: string[];
}

/**
 * Event payload for policy:warned event
 * Emitted when a policy warning is issued (warn mode, non-blocking)
 */
export interface PolicyWarnedEventData extends PolicyEventDataBase {
  /** Unique warning event ID */
  warningId: string;
  /** Violations that triggered the warning */
  violations: Array<{
    violationId: string;
    rule: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    resource?: string;
  }>;
  /** Human-readable warning message */
  warningMessage: string;
  /** Whether the action will proceed despite warning */
  actionProceeding: boolean;
}

/**
 * Event payload for policy:audited event
 * Emitted when a policy check is logged for audit (audit mode)
 */
export interface PolicyAuditedEventData extends PolicyEventDataBase {
  /** Unique audit event ID */
  auditId: string;
  /** Type of audit entry */
  auditType: 'check' | 'violation' | 'pass' | 'skip';
  /** Result of the policy check */
  checkResult: 'pass' | 'fail' | 'warn' | 'skip';
  /** Violations found (if any, for audit record) */
  violations?: Array<{
    violationId: string;
    rule: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    resource?: string;
  }>;
  /** Duration of policy check in milliseconds */
  durationMs?: number;
  /** Policy configuration name/identifier */
  policyName?: string;
}
```

### 3. Update ApexEventType Union (Core Package)

Add new event types to `ApexEventType` in `packages/core/src/types.ts`:

```typescript
export type ApexEventType =
  // ... existing types ...
  | 'policy:violation'
  | 'policy:blocked'
  | 'policy:warned'
  | 'policy:audited';
```

### 4. Event Emission Points

Events are emitted from `ApexOrchestrator` at the following points:

| Event | When Emitted | Enforcement Mode |
|-------|--------------|------------------|
| `policy:violation` | Every violation detected | All modes |
| `policy:blocked` | Action blocked | strict |
| `policy:warned` | Warning issued, action proceeds | warn |
| `policy:audited` | Policy check logged | audit |

### 5. Event Forwarding from PolicyEnforcer

```typescript
// In ApexOrchestrator class

private setupPolicyEventForwarding(): void {
  // Forward violation events from PolicyEnforcer
  this.policyEnforcer.on('policy:violation', (event: PolicyViolationEvent) => {
    // Transform to new format with required fields
    const eventData: PolicyViolationEventData = {
      taskId: event.taskId || this.currentTaskId || '',
      agent: event.agentId || 'unknown',
      action: event.violation.resource ? `access:${event.violation.resource}` : 'unknown',
      enforcementMode: this.policyEnforcer.enforcementMode,
      timestamp: event.timestamp,
      workflowId: event.workflowId,
      metadata: event.metadata,
      violationId: event.violation.id,
      rule: event.violation.rule,
      policyType: event.violation.policyType as 'path' | 'test' | 'approval' | 'operation',
      severity: event.violation.severity,
      message: event.violation.message,
      resource: event.violation.resource,
      blocking: event.violation.blocking,
      matchedPattern: event.violation.context?.matchedPattern as string | undefined,
      violationContext: event.violation.context,
    };
    this.emit('policy:violation', eventData);
  });
}
```

### 6. File Changes Summary

| File | Changes |
|------|---------|
| `packages/core/src/types.ts` | Add 4 event types to `ApexEventType` union |
| `packages/orchestrator/src/index.ts` | Add event interfaces, extend `OrchestratorEvents`, add forwarding setup, export new types |

## Implementation Checklist

- [ ] Add `PolicyEventDataBase` interface
- [ ] Add `PolicyViolationEventData` interface
- [ ] Add `PolicyBlockedEventData` interface
- [ ] Add `PolicyWarnedEventData` interface
- [ ] Add `PolicyAuditedEventData` interface
- [ ] Extend `OrchestratorEvents` with 4 policy events
- [ ] Add `setupPolicyEventForwarding()` method
- [ ] Call setup in `initialize()` method
- [ ] Update `ApexEventType` in core types
- [ ] Export new event data types from orchestrator
- [ ] Run `npm run build` to verify compilation
- [ ] Run `npm run test` to verify tests pass

## Consequences

### Positive

- **Complete policy event lifecycle**: All four enforcement outcomes are represented
- **Consistent payload structure**: Base interface ensures all events have required fields
- **Type safety**: Full TypeScript typing with Zod validation compatibility
- **Audit trail**: The `policy:audited` event enables comprehensive logging
- **Subscriber transparency**: External consumers can subscribe to specific event types

### Negative

- **Event volume**: Four separate events may increase event traffic in verbose scenarios
- **Transformation overhead**: Converting PolicyEnforcer events to new format adds minimal overhead

### Risks

- **Event listener cleanup**: Must ensure proper cleanup in `shutdown()` (standard pattern)
- **Event ordering**: Multiple events may fire for single check (documented behavior)

## Testing Strategy

### Unit Tests

```typescript
describe('Policy Violation Event Types', () => {
  describe('policy:violation', () => {
    it('should emit with all required fields from acceptance criteria', async () => {
      const events: PolicyViolationEventData[] = [];
      orchestrator.on('policy:violation', (e) => events.push(e));

      await triggerViolation();

      expect(events).toHaveLength(1);
      expect(events[0].taskId).toBeDefined();
      expect(events[0].agent).toBeDefined();
      expect(events[0].action).toBeDefined();
      expect(events[0].enforcementMode).toBeDefined();
      expect(['strict', 'warn', 'audit', 'disabled']).toContain(events[0].enforcementMode);
    });
  });

  describe('policy:blocked', () => {
    it('should emit when strict mode blocks action', async () => {
      configureStrictMode();
      const events: PolicyBlockedEventData[] = [];
      orchestrator.on('policy:blocked', (e) => events.push(e));

      await triggerViolation();

      expect(events).toHaveLength(1);
      expect(events[0].enforcementMode).toBe('strict');
      expect(events[0].violations.length).toBeGreaterThan(0);
    });
  });

  describe('policy:warned', () => {
    it('should emit when warn mode allows action with warning', async () => {
      configureWarnMode();
      const events: PolicyWarnedEventData[] = [];
      orchestrator.on('policy:warned', (e) => events.push(e));

      await triggerViolation();

      expect(events).toHaveLength(1);
      expect(events[0].enforcementMode).toBe('warn');
      expect(events[0].actionProceeding).toBe(true);
    });
  });

  describe('policy:audited', () => {
    it('should emit audit record when audit mode is active', async () => {
      configureAuditMode();
      const events: PolicyAuditedEventData[] = [];
      orchestrator.on('policy:audited', (e) => events.push(e));

      await runPolicyCheck();

      expect(events).toHaveLength(1);
      expect(events[0].enforcementMode).toBe('audit');
      expect(['pass', 'fail', 'warn', 'skip']).toContain(events[0].checkResult);
    });
  });

  describe('OrchestratorEvents type integration', () => {
    it('should include all policy events in OrchestratorEvents interface', () => {
      // Type-level check - compile-time verification
      type ViolationHandler = OrchestratorEvents['policy:violation'];
      type BlockedHandler = OrchestratorEvents['policy:blocked'];
      type WarnedHandler = OrchestratorEvents['policy:warned'];
      type AuditedHandler = OrchestratorEvents['policy:audited'];

      // Runtime verification
      const handlers: Partial<OrchestratorEvents> = {
        'policy:violation': (event) => { expect(event.taskId).toBeDefined(); },
        'policy:blocked': (event) => { expect(event.violations).toBeDefined(); },
        'policy:warned': (event) => { expect(event.warningMessage).toBeDefined(); },
        'policy:audited': (event) => { expect(event.auditType).toBeDefined(); },
      };
      expect(handlers).toBeDefined();
    });
  });
});
```

### Integration Tests

- Verify events flow through to CLI subscribers
- Verify API WebSocket broadcasts policy events
- Verify event order: violation → blocked/warned/audited

## References

- ADR-020: PolicyEnforcer Event Emission for Policy Violations
- ADR-026: Policy Events Orchestrator Propagation (superseded)
- `PolicyEnforcer`: `packages/orchestrator/src/policy/policy-enforcer.ts`
- `PolicyViolationEvent`: `packages/core/src/types.ts`
- Permission events pattern: `packages/orchestrator/src/index.ts` (lines 158-164)
