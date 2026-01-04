# ADR-051: Audit Logs Table Design

## Status
Proposed

## Context

APEX needs comprehensive audit logging capabilities to track significant events across the system for:
- Compliance and governance requirements
- Debugging and troubleshooting
- Security monitoring
- Usage analytics and reporting

The audit logs should capture task lifecycle events, agent actions, configuration changes, and other significant system activities with sufficient context for forensic analysis.

## Decision

### 1. Type Definition (packages/core/src/types.ts)

Add a new `AuditLogEntry` Zod schema and type following established patterns:

```typescript
// ============================================================================
// Audit Log Types (v0.5.0)
// ============================================================================

/**
 * Audit log event types for tracking significant system events
 */
export const AuditEventTypeSchema = z.enum([
  // Task lifecycle events
  'task.created',
  'task.started',
  'task.completed',
  'task.failed',
  'task.cancelled',
  'task.paused',
  'task.resumed',
  'task.trashed',
  'task.restored',
  'task.archived',

  // Agent events
  'agent.started',
  'agent.completed',
  'agent.failed',
  'agent.handoff',

  // Approval events
  'approval.requested',
  'approval.granted',
  'approval.denied',
  'approval.timeout',

  // Configuration events
  'config.updated',
  'permission.granted',
  'permission.revoked',

  // Tool events
  'tool.executed',
  'tool.undone',

  // Security events
  'security.policy_violation',
  'security.rate_limited',
]);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

/**
 * Severity levels for audit log entries
 */
export const AuditSeveritySchema = z.enum(['debug', 'info', 'warn', 'error', 'critical']);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

/**
 * Audit log entry schema for tracking significant system events
 * Provides comprehensive context for compliance, debugging, and security monitoring
 */
export const AuditLogEntrySchema = z.object({
  /** Unique identifier for the audit log entry */
  id: z.string().min(1),

  /** Associated task ID (optional - some events are system-wide) */
  taskId: z.string().optional(),

  /** Type of event being logged */
  eventType: AuditEventTypeSchema,

  /** Severity level of the event */
  severity: AuditSeveritySchema,

  /** ISO 8601 timestamp when the event occurred */
  timestamp: z.date(),

  /** Actor that triggered the event (user, agent, system) */
  actor: z.string(),

  /** Human-readable description of the event */
  message: z.string(),

  /** Stage during which the event occurred (if applicable) */
  stage: z.string().optional(),

  /** Agent that was active when the event occurred (if applicable) */
  agent: z.string().optional(),

  /** Structured metadata about the event (JSON serialized in DB) */
  metadata: z.record(z.unknown()).optional(),

  /** Previous state before the event (for state changes) */
  previousState: z.string().optional(),

  /** New state after the event (for state changes) */
  newState: z.string().optional(),

  /** Duration of the operation in milliseconds (if applicable) */
  durationMs: z.number().optional(),

  /** Whether the event was successful */
  success: z.boolean().default(true),

  /** Error details if the event represents a failure */
  error: z.string().optional(),

  /** Correlation ID for linking related events */
  correlationId: z.string().optional(),

  /** Session ID for grouping events within a session */
  sessionId: z.string().optional(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
```

### 2. SQLite Table Schema (packages/orchestrator/src/store.ts)

Add the `audit_logs` table in the `createTables()` method:

```sql
-- v0.5.0 Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  message TEXT NOT NULL,
  stage TEXT,
  agent TEXT,
  metadata TEXT,
  previous_state TEXT,
  new_state TEXT,
  duration_ms INTEGER,
  success INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  correlation_id TEXT,
  session_id TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- v0.5.0 Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
```

### 3. Row Interface (packages/orchestrator/src/store.ts)

Add the corresponding row interface:

```typescript
interface AuditLogRow {
  id: string;
  task_id: string | null;
  event_type: string;
  severity: string;
  timestamp: string;
  actor: string;
  message: string;
  stage: string | null;
  agent: string | null;
  metadata: string | null;
  previous_state: string | null;
  new_state: string | null;
  duration_ms: number | null;
  success: number;
  error: string | null;
  correlation_id: string | null;
  session_id: string | null;
}
```

### 4. TaskStore Methods

Add CRUD methods for audit logs:

```typescript
/**
 * Add an audit log entry
 */
async addAuditLog(entry: AuditLogEntry): Promise<void>;

/**
 * Get audit logs for a task
 */
async getAuditLogs(taskId: string, options?: {
  eventType?: AuditEventType;
  severity?: AuditSeverity;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<AuditLogEntry[]>;

/**
 * Get all audit logs with optional filters
 */
async queryAuditLogs(options?: {
  taskId?: string;
  eventType?: AuditEventType | AuditEventType[];
  severity?: AuditSeverity | AuditSeverity[];
  actor?: string;
  correlationId?: string;
  sessionId?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<AuditLogEntry[]>;

/**
 * Delete old audit logs based on retention policy
 */
async cleanupAuditLogs(maxAgeDays: number): Promise<number>;

/**
 * Get audit log statistics
 */
async getAuditLogStats(options?: {
  taskId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  total: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
  successRate: number;
}>;

/**
 * Convert row to AuditLogEntry
 */
private rowToAuditLogEntry(row: AuditLogRow): AuditLogEntry;
```

### 5. Migration Strategy

Add to `runMigrations()` method to handle existing databases:

```typescript
// Create audit_logs table if it doesn't exist (v0.5.0 audit logging support)
try {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),
      timestamp TEXT NOT NULL,
      actor TEXT NOT NULL,
      message TEXT NOT NULL,
      stage TEXT,
      agent TEXT,
      metadata TEXT,
      previous_state TEXT,
      new_state TEXT,
      duration_ms INTEGER,
      success INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      correlation_id TEXT,
      session_id TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
  `);
} catch {
  // Table might already exist
}
```

## Design Decisions

### Foreign Key with ON DELETE CASCADE
The `task_id` foreign key uses `ON DELETE CASCADE` to automatically clean up audit logs when tasks are permanently deleted. This ensures referential integrity while preventing orphaned records.

### Nullable task_id
The `task_id` is nullable to support system-wide events that aren't associated with a specific task (e.g., configuration changes, system startup/shutdown).

### ISO 8601 Timestamps
Timestamps are stored as TEXT in ISO 8601 format, consistent with other tables in the schema. This ensures proper sorting and human readability.

### JSON Metadata
The `metadata` column stores structured data as JSON, allowing flexible event-specific information without schema changes.

### State Tracking
`previous_state` and `new_state` columns enable tracking state transitions for compliance and debugging purposes.

### Correlation and Session IDs
These optional fields enable tracing related events across distributed operations and user sessions.

## Consequences

### Positive
- Comprehensive audit trail for compliance requirements
- Flexible metadata allows capturing event-specific context
- Efficient queries via targeted indexes
- Migration-safe approach works with existing databases
- Follows established codebase patterns

### Negative
- Additional storage overhead for high-volume systems
- Query performance may degrade with very large datasets
- Need to implement retention policies to manage growth

### Mitigations
- Implement `cleanupAuditLogs()` for automated retention management
- Consider partitioning strategies for very large deployments
- Add configurable log levels to control volume

## Implementation Notes

### Export Requirements
Add to `packages/core/src/types.ts`:
- Export `AuditEventTypeSchema` and `AuditEventType`
- Export `AuditSeveritySchema` and `AuditSeverity`
- Export `AuditLogEntrySchema` and `AuditLogEntry`

These will be automatically available via `packages/core/src/index.ts` which re-exports all from types.

### Deletion Cleanup
Update `purgeOldTrashedTasks()` to handle audit_logs with CASCADE or explicit deletion before task deletion.

## Related ADRs
- ADR for approval states (v0.5.0)
- ADR for tool action tracking (v0.5.0)
- ADR for fix attempts tracking (v0.5.0)

## References
- Existing table patterns in `packages/orchestrator/src/store.ts`
- Zod schema patterns in `packages/core/src/types.ts`
