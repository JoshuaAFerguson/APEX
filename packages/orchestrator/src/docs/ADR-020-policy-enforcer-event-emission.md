# ADR-020: PolicyEnforcer Event Emission for Policy Violations

## Status

Accepted

## Date

2025-01-02

## Context

The PolicyEnforcer class currently validates file paths against policy rules and returns PolicyViolation objects, but it does not emit events when violations occur. This limits observability and prevents real-time notification of policy violations to monitoring systems, UIs, and other consumers.

### Current State

1. **PolicyEnforcer** (`packages/orchestrator/src/policy/policy-enforcer.ts`):
   - Validates file paths against `PolicyConfig.allowedPaths` configuration
   - Validates approval requirements against `PolicyConfig.approvalRules`
   - Returns `PolicyViolation[]` from `validateFilePath()` method
   - Does NOT currently extend EventEmitter or emit events

2. **PolicyViolationEvent** (`packages/core/src/types.ts`):
   - Already defined and exported with comprehensive schema
   - Includes: `type`, `id`, `timestamp`, `violation`, `taskId`, `agentId`, `workflowId`, `metadata`
   - Zod-validated via `PolicyViolationEventSchema`

3. **Existing patterns** in orchestrator:
   - `CapacityMonitor extends EventEmitter<CapacityMonitorEvents>`
   - `WorkspaceManager extends EventEmitter<WorkspaceManagerEvents>`
   - `UsageManager extends EventEmitter<UsageManagerEvents>`
   - `SessionManager extends EventEmitter<SessionManagerEvents>`
   - Event interfaces defined for type-safe emission

## Decision

Extend PolicyEnforcer to emit `'policy:violation'` events when violations are detected.

### Architecture

```typescript
import { EventEmitter } from 'eventemitter3';
import type { PolicyViolationEvent } from '@apexcli/core';

export interface PolicyEnforcerEvents {
  'policy:violation': (event: PolicyViolationEvent) => void;
}

export class PolicyEnforcer extends EventEmitter<PolicyEnforcerEvents> {
  // ... existing implementation
}
```

### Event Emission Points

1. **In `validateFilePath()`** - Emit event for each violation detected
2. **In `checkApprovalRequired()`** - When approval rules trigger (optional, for audit logging)

### PolicyViolationEvent Payload Structure

The event payload uses the existing `PolicyViolationEvent` type from `@apexcli/core`:

```typescript
interface PolicyViolationEvent {
  type: 'policy_violation';           // Literal type discriminator
  id: string;                          // Unique event ID (UUID)
  timestamp: Date;                     // When violation occurred
  violation: PolicyViolation;          // Full violation details
  taskId?: string;                     // Associated task (if available)
  agentId?: string;                    // Agent that triggered (if available)
  workflowId?: string;                 // Associated workflow (if available)
  metadata?: Record<string, unknown>;  // Additional context
}
```

### Violation Type Categorization

Violations will be categorized by their `matchType` from `PathValidationResult`:

| Match Type | Description | Suggested Remediation |
|------------|-------------|----------------------|
| `block` | Path matches a block pattern | Remove file from operation or update block patterns |
| `allow` | Allowlist mode, path not in allow patterns | Add path to allowed patterns or use different path |
| `sensitive` | Path matches sensitive pattern | Require explicit approval before access |
| `default` | Default policy behavior applied | Review policy mode configuration |

### Integration with Orchestrator

The ApexOrchestrator will:
1. Subscribe to `'policy:violation'` events from PolicyEnforcer
2. Forward events to its own event emitter (if exposed externally)
3. Log violations based on enforcement mode
4. Block operations in `enforce` mode when violations occur

```typescript
// In ApexOrchestrator
this.policyEnforcer.on('policy:violation', (event) => {
  this.emit('policy:violation', event);

  if (this.config.policy?.enforcement === 'enforce') {
    // Handle blocking behavior
  }
});
```

### Backward Compatibility

- `validateFilePath()` continues to return `PolicyViolation[]`
- Event emission is additive; existing code unaffected
- Consumers can optionally subscribe to events

## Implementation Plan

### Phase 1: Extend PolicyEnforcer (This Task)

1. Add `eventemitter3` import and extend EventEmitter
2. Define `PolicyEnforcerEvents` interface
3. Import `PolicyViolationEvent` from `@apexcli/core`
4. Emit `'policy:violation'` event in `validateFilePath()` when violations detected
5. Add context parameters for `taskId`, `agentId`, `workflowId` (optional overloads)

### Phase 2: Integration Tests

1. Test event emission for path violations
2. Test event emission for sensitive file access
3. Test event payload structure matches `PolicyViolationEventSchema`
4. Test multiple violations emit multiple events
5. Test no events when path is allowed

### Phase 3: Future Enhancements (Not in scope)

- Add `'policy:approval-required'` event for approval rule triggers
- Integrate with ApexOrchestrator event system
- Add event history/audit logging

## Consequences

### Positive

- **Real-time visibility**: Violations can be streamed to UIs, logs, monitoring
- **Decoupled architecture**: Event consumers don't need to poll for violations
- **Consistent patterns**: Follows existing EventEmitter patterns in codebase
- **Type safety**: Uses existing Zod-validated schemas from core
- **Extensibility**: Foundation for policy audit trails and analytics

### Negative

- **Slight complexity increase**: EventEmitter adds event loop behavior
- **Memory consideration**: Event listeners must be properly cleaned up
- **Breaking change**: If consumers rely on class prototype (unlikely)

### Risks

- Event listeners not removed could cause memory leaks (mitigated by standard cleanup patterns)
- High-frequency violations could flood event system (mitigated by batch operations)

## Alternatives Considered

### 1. Callback-based notification

```typescript
validateFilePath(path: string, onViolation?: (v: PolicyViolation) => void)
```

Rejected because:
- Less flexible than EventEmitter (single callback vs multiple listeners)
- Doesn't match existing patterns in codebase
- Harder to integrate with existing event infrastructure

### 2. Observable/RxJS pattern

Rejected because:
- Would add a new dependency
- Overkill for simple event notification
- Doesn't match existing patterns in codebase

### 3. Return events alongside violations

```typescript
validateFilePath(path: string): { violations: PolicyViolation[], events: PolicyViolationEvent[] }
```

Rejected because:
- Redundant data duplication
- Events should be optional subscription, not mandatory in return type
- Breaks existing API contract

## Test Strategy

Integration tests will verify:

1. **Event emission for blocked paths**
   ```typescript
   it('emits policy:violation event when path is blocked', async () => {
     const enforcer = createPolicyEnforcer({...});
     const events: PolicyViolationEvent[] = [];
     enforcer.on('policy:violation', (e) => events.push(e));

     enforcer.validateFilePath('node_modules/pkg/index.js');

     expect(events).toHaveLength(1);
     expect(events[0].type).toBe('policy_violation');
     expect(events[0].violation.policyType).toBe('path');
   });
   ```

2. **Event payload validation against schema**
   ```typescript
   it('emits events conforming to PolicyViolationEventSchema', () => {
     // Validate event payload can be parsed by Zod schema
     expect(() => PolicyViolationEventSchema.parse(event)).not.toThrow();
   });
   ```

3. **No events for allowed paths**
   ```typescript
   it('does not emit events when path is allowed', () => {
     // Verify no events emitted for valid paths
   });
   ```

## References

- PolicyEnforcer implementation: `packages/orchestrator/src/policy/policy-enforcer.ts`
- PolicyViolationEvent schema: `packages/core/src/types.ts` (line ~3705)
- CapacityMonitor pattern: `packages/orchestrator/src/capacity-monitor.ts`
- ADR-018 PolicyEnforcer base class: `packages/orchestrator/src/docs/ADR-018-policy-enforcer-base-class.md`
