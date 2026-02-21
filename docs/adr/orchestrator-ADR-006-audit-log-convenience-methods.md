# ADR-006: Audit Log Write Convenience Methods

## Status
Proposed

## Context
The TaskStore class already has a generic `addAuditLog(entry: AuditLogEntry)` method for inserting audit log entries into the SQLite database. However, the task requires adding specialized convenience methods for common audit logging scenarios:

1. `logAuditEntry(entry: AuditLogEntry)` - Generic entry point (alias for existing method)
2. `logModeChange(taskId, previousMode, newMode, reason)` - Log autonomy mode changes
3. `logApprovalRequest(taskId, context)` - Log when approval is requested
4. `logApprovalResponse(taskId, approver, approved, context)` - Log approval responses

These convenience methods reduce boilerplate and ensure consistent audit log formatting across the codebase.

## Decision

### Method Signatures

```typescript
// 1. Generic logging (alias for addAuditLog for API consistency)
async logAuditEntry(entry: AuditLogEntry): Promise<void>

// 2. Mode change logging
async logModeChange(
  taskId: string,
  previousMode: AutonomyLevel,
  newMode: AutonomyLevel,
  reason: string,
  options?: {
    actor?: string;          // defaults to 'system'
    stage?: string;          // current workflow stage
    agent?: string;          // active agent
    correlationId?: string;  // for linking related events
    sessionId?: string;      // for grouping within session
  }
): Promise<AuditLogEntry>

// 3. Approval request logging
async logApprovalRequest(
  taskId: string,
  context: {
    gateName: string;        // name of the approval gate
    gateType?: string;       // type of checkpoint (stage, action, etc.)
    description?: string;    // what is being approved
    approvers?: string[];    // who can approve
    changesSummary?: string; // summary of pending changes
    affectedFiles?: string[]; // files affected
  },
  options?: {
    actor?: string;          // defaults to 'system'
    stage?: string;          // current workflow stage
    agent?: string;          // agent that triggered the request
    correlationId?: string;
    sessionId?: string;
  }
): Promise<AuditLogEntry>

// 4. Approval response logging
async logApprovalResponse(
  taskId: string,
  approver: string,
  approved: boolean,
  context?: {
    comment?: string;        // reason for approval/denial
    gateName?: string;       // which gate was approved
    responseTimeMs?: number; // time to respond
  },
  options?: {
    stage?: string;
    correlationId?: string;
    sessionId?: string;
  }
): Promise<AuditLogEntry>
```

### Event Type Mapping

| Method | Event Type |
|--------|------------|
| `logModeChange` | `config.updated` |
| `logApprovalRequest` | `approval.requested` |
| `logApprovalResponse` | `approval.granted` or `approval.denied` |

### Severity Mapping

| Method | Severity |
|--------|----------|
| `logModeChange` | `info` |
| `logApprovalRequest` | `info` |
| `logApprovalResponse` (approved) | `info` |
| `logApprovalResponse` (denied) | `warn` |

### Implementation Details

1. **ID Generation**: Each method generates a unique ID using `crypto.randomUUID()` or a similar pattern (e.g., `audit_${Date.now()}_${random}`).

2. **Timestamp**: All methods use `new Date()` for the timestamp at the moment of logging.

3. **State Tracking**: Mode changes use `previousState` and `newState` fields to track transitions.

4. **Metadata Storage**: Context objects are stored in the `metadata` JSON field for structured querying.

5. **Return Values**: All methods return the created `AuditLogEntry` for confirmation and potential chaining.

### Database Schema (Existing)

The existing `audit_logs` table schema already supports all required fields:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  message TEXT NOT NULL,
  stage TEXT,
  agent TEXT,
  metadata TEXT,           -- JSON for context storage
  previous_state TEXT,     -- For mode changes
  new_state TEXT,          -- For mode changes
  duration_ms INTEGER,
  success INTEGER DEFAULT 1,
  error TEXT,
  correlation_id TEXT,
  session_id TEXT
);
```

## Consequences

### Positive
- Reduces boilerplate code when logging common events
- Ensures consistent message formatting and event type usage
- Provides type-safe parameters for specific logging scenarios
- Returns created entries for confirmation/debugging

### Negative
- Adds more methods to the already large TaskStore class
- Slight increase in API surface area

### Neutral
- `logAuditEntry` is effectively an alias for `addAuditLog` to provide consistent naming

## Implementation Notes

1. The methods should be implemented in `/packages/orchestrator/src/store.ts` near the existing `addAuditLog` method (around line 3900).

2. Tests should be added to `/packages/orchestrator/src/__tests__/audit-logs.test.ts` to cover:
   - Basic functionality for each method
   - Default values (actor, severity)
   - Metadata storage and retrieval
   - State transitions for mode changes
   - Event type correctness

3. The methods should use the existing `rowToAuditLogEntry` helper for any round-trip testing.
