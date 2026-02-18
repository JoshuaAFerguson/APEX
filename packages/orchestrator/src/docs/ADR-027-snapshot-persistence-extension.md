# ADR-027: TaskStore Snapshot Persistence Extension

## Status

Proposed

## Date

2025-01-03

## Context

APEX's `ToolActionStore` currently tracks tool actions with file snapshots for undo capability. The existing schema stores file snapshots in `file_snapshots` table and links them to `tool_actions` via JSON arrays (`before_snapshots`, `after_snapshots`). However, there's a need for a dedicated `action_snapshots` table that provides:

1. **Direct task-to-snapshot relationships** - Enables querying snapshots by task without going through tool_actions
2. **Grouped file snapshots per action** - Associates multiple file snapshots with a single action atomically
3. **Independent snapshot lifecycle** - Allows snapshot management separate from tool action retention
4. **Enhanced query patterns** - Supports `getLatestSnapshot()` for rapid state recovery

### Existing Infrastructure

1. **`file_snapshots` table** in `store.ts`:
   - Stores individual file content with id, file_path, content, checksum, file_size, last_modified, snapshot_time, metadata
   - No direct task_id reference (linked via tool_actions JSON arrays)

2. **`tool_actions` table** in `store.ts`:
   - Has task_id, execution details, and JSON arrays for before_snapshots/after_snapshots (storing snapshot IDs)
   - Sequence numbered for ordering within a task

3. **`ToolActionSnapshot` type** in `@apex/core/types.ts`:
   - Schema: `actionId`, `toolName`, `snapshots` (array of FileSnapshot), `timestamp`, `description`, `canUndo`
   - Not currently persisted to SQLite - exists only as in-memory type

### Acceptance Criteria to Fulfill

- New `snapshots` table in SQLite schema with columns for `taskId`, `actionId`, `toolName`, `fileSnapshots` (JSON), `timestamp`
- Methods added: `saveSnapshot()`, `getSnapshots()`, `getLatestSnapshot()`, `deleteSnapshots()`
- Migrations handle schema changes

## Decision

Extend `TaskStore` (not `ToolActionStore`) with a new `action_snapshots` table and dedicated methods for snapshot persistence.

### Schema Design

```sql
CREATE TABLE IF NOT EXISTS action_snapshots (
  id TEXT PRIMARY KEY,                    -- UUID for this snapshot group
  task_id TEXT NOT NULL,                  -- Task this snapshot belongs to
  action_id TEXT NOT NULL,                -- Tool action ID that created this snapshot
  tool_name TEXT NOT NULL,                -- Name of the tool (Write, Edit, Bash, etc.)
  file_snapshots TEXT NOT NULL,           -- JSON array of FileSnapshot objects
  description TEXT,                       -- Optional human-readable description
  can_undo INTEGER NOT NULL DEFAULT 1,    -- Whether this snapshot can be used for undo
  created_at TEXT NOT NULL,               -- ISO timestamp when snapshot was created
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_action_snapshots_task_id ON action_snapshots(task_id);
CREATE INDEX IF NOT EXISTS idx_action_snapshots_action_id ON action_snapshots(action_id);
CREATE INDEX IF NOT EXISTS idx_action_snapshots_tool_name ON action_snapshots(tool_name);
CREATE INDEX IF NOT EXISTS idx_action_snapshots_created ON action_snapshots(created_at);
```

### Column Justification

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PRIMARY KEY | Unique identifier for the snapshot group (UUID) |
| `task_id` | TEXT NOT NULL | Foreign key to tasks table for direct task-snapshot queries |
| `action_id` | TEXT NOT NULL | Links to tool_actions.id for cross-referencing |
| `tool_name` | TEXT NOT NULL | Enables filtering snapshots by tool type |
| `file_snapshots` | TEXT NOT NULL | JSON array of FileSnapshot objects (full snapshot data, not IDs) |
| `description` | TEXT | Optional context about what the action did |
| `can_undo` | INTEGER | Boolean flag (0/1) for undo eligibility |
| `created_at` | TEXT | ISO timestamp for ordering and cleanup |

### Design Decision: Embedded vs. Normalized Snapshots

**Chosen: Embedded JSON** - Store full FileSnapshot objects in `file_snapshots` column

Rationale:
1. **Atomic retrieval** - Single query returns all snapshot data
2. **Consistency with existing patterns** - `tool_actions` already uses JSON arrays
3. **Simpler cleanup** - No orphaned snapshot references
4. **Query optimization** - Avoid joins for common operations

Trade-offs:
- Some data duplication if same file snapshot used by multiple actions
- Larger row size but bounded by practical limits

### API Design

```typescript
// Add to TaskStore class

/**
 * Save a tool action snapshot to the database
 */
async saveSnapshot(snapshot: ToolActionSnapshot, taskId: string): Promise<void>;

/**
 * Get all snapshots for a task, optionally filtered and paginated
 */
async getSnapshots(taskId: string, options?: {
  toolName?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';  // By created_at, default 'desc'
}): Promise<ToolActionSnapshot[]>;

/**
 * Get the most recent snapshot for a task, optionally filtered by tool
 */
async getLatestSnapshot(taskId: string, toolName?: string): Promise<ToolActionSnapshot | null>;

/**
 * Delete snapshots for a task
 */
async deleteSnapshots(taskId: string, options?: {
  actionId?: string;      // Delete specific action's snapshot
  toolName?: string;      // Delete snapshots for specific tool
  olderThan?: Date;       // Delete snapshots older than date
}): Promise<number>;      // Returns count of deleted snapshots
```

### Method Implementations

#### saveSnapshot()
```typescript
async saveSnapshot(snapshot: ToolActionSnapshot, taskId: string): Promise<void> {
  const stmt = this.db.prepare(`
    INSERT INTO action_snapshots (
      id, task_id, action_id, tool_name, file_snapshots,
      description, can_undo, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    crypto.randomUUID(),
    taskId,
    snapshot.actionId,
    snapshot.toolName,
    JSON.stringify(snapshot.snapshots),
    snapshot.description || null,
    snapshot.canUndo ? 1 : 0,
    snapshot.timestamp.toISOString()
  );
}
```

#### getSnapshots()
```typescript
async getSnapshots(taskId: string, options?: GetSnapshotsOptions): Promise<ToolActionSnapshot[]> {
  let query = 'SELECT * FROM action_snapshots WHERE task_id = ?';
  const params: unknown[] = [taskId];

  if (options?.toolName) {
    query += ' AND tool_name = ?';
    params.push(options.toolName);
  }

  query += ` ORDER BY created_at ${options?.orderBy === 'asc' ? 'ASC' : 'DESC'}`;

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const rows = this.db.prepare(query).all(...params);
  return rows.map(this.rowToSnapshot);
}
```

#### getLatestSnapshot()
```typescript
async getLatestSnapshot(taskId: string, toolName?: string): Promise<ToolActionSnapshot | null> {
  let query = 'SELECT * FROM action_snapshots WHERE task_id = ?';
  const params: unknown[] = [taskId];

  if (toolName) {
    query += ' AND tool_name = ?';
    params.push(toolName);
  }

  query += ' ORDER BY created_at DESC LIMIT 1';

  const row = this.db.prepare(query).get(...params);
  return row ? this.rowToSnapshot(row) : null;
}
```

#### deleteSnapshots()
```typescript
async deleteSnapshots(taskId: string, options?: DeleteSnapshotsOptions): Promise<number> {
  let query = 'DELETE FROM action_snapshots WHERE task_id = ?';
  const params: unknown[] = [taskId];

  if (options?.actionId) {
    query += ' AND action_id = ?';
    params.push(options.actionId);
  }

  if (options?.toolName) {
    query += ' AND tool_name = ?';
    params.push(options.toolName);
  }

  if (options?.olderThan) {
    query += ' AND created_at < ?';
    params.push(options.olderThan.toISOString());
  }

  const result = this.db.prepare(query).run(...params);
  return result.changes;
}
```

### Migration Strategy

The new table will be added to both:
1. **`createTables()`** method - For new databases
2. **`runMigrations()`** method - For existing databases

```typescript
// In runMigrations():
try {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS action_snapshots (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      action_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      file_snapshots TEXT NOT NULL,
      description TEXT,
      can_undo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);
  this.db.exec(`
    CREATE INDEX IF NOT EXISTS idx_action_snapshots_task_id ON action_snapshots(task_id);
    CREATE INDEX IF NOT EXISTS idx_action_snapshots_action_id ON action_snapshots(action_id);
    CREATE INDEX IF NOT EXISTS idx_action_snapshots_tool_name ON action_snapshots(tool_name);
    CREATE INDEX IF NOT EXISTS idx_action_snapshots_created ON action_snapshots(created_at);
  `);
} catch {
  // Table might already exist
}
```

### Integration with Existing ToolActionStore

The new `action_snapshots` table complements rather than replaces the existing `file_snapshots` table:

- **`file_snapshots`**: Used by `ToolActionStore` for undo operations, stores individual file states
- **`action_snapshots`**: Used for grouped snapshot queries and lifecycle management

The `ToolActionStore` can optionally call `saveSnapshot()` when recording tool actions to maintain both representations for different use cases.

### Relationship Diagram

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   tasks     │ 1──N │ action_snapshots │ 1──1 │   tool_actions  │
├─────────────┤      ├──────────────────┤      ├─────────────────┤
│ id          │◄─────│ task_id          │      │ id              │
│ ...         │      │ action_id        │──────►│ task_id         │
└─────────────┘      │ tool_name        │      │ execution_*     │
                     │ file_snapshots   │      │ before_snapshots│──┐
                     │ (JSON)           │      │ after_snapshots │──┤
                     │ created_at       │      └─────────────────┘  │
                     └──────────────────┘                           │
                                                                    │
                     ┌──────────────────┐                           │
                     │  file_snapshots  │◄──────────────────────────┘
                     ├──────────────────┤   (ID references in JSON)
                     │ id               │
                     │ file_path        │
                     │ content          │
                     └──────────────────┘
```

## Consequences

### Positive

- **Direct task queries** - Get all snapshots for a task in O(1) with single indexed query
- **Flexible filtering** - Query by tool name, time range, or action ID
- **Atomic snapshot groups** - All file changes for an action stored together
- **Clean separation** - Independent lifecycle from tool_actions table
- **Migration safe** - Non-breaking addition to existing schema

### Negative

- **Data duplication** - FileSnapshot data stored twice (in file_snapshots and action_snapshots JSON)
- **JSON storage limits** - Very large file changes may hit SQLite row size limits (practical but worth noting)
- **Maintenance overhead** - Two tables to manage for snapshot-related cleanup

### Risks

- **Storage growth** - Snapshots can grow large with binary/large files (mitigated by retention config)
- **Query performance** - JSON extraction for filtering within snapshots not supported (mitigated by task-level filtering)

## Alternatives Considered

### 1. Add task_id to existing file_snapshots table

Rejected because:
- Doesn't provide atomic grouping of snapshots per action
- Would require schema migration with potential data loss
- Mixes concerns of individual file state vs. action-level grouping

### 2. Create junction table linking action_id to snapshot_ids

Rejected because:
- More complex queries with additional joins
- Harder to maintain referential integrity
- Existing pattern uses embedded JSON successfully

### 3. Extend tool_actions table with additional columns

Rejected because:
- Increases already-wide table schema
- Conflates action execution tracking with snapshot management
- Makes retention policies harder to differentiate

### 4. Use separate SQLite database file for snapshots

Rejected because:
- Complicates transaction management
- Adds operational complexity
- Breaks foreign key constraints

## Implementation Notes

### File Location
All changes will be made in `packages/orchestrator/src/store.ts`

### Type Imports
Ensure `ToolActionSnapshot` is imported from `@apex/core`

### Row Type Definition
```typescript
interface ActionSnapshotRow {
  id: string;
  task_id: string;
  action_id: string;
  tool_name: string;
  file_snapshots: string;  // JSON
  description: string | null;
  can_undo: number;
  created_at: string;
}
```

### Conversion Helper
```typescript
private rowToActionSnapshot(row: ActionSnapshotRow): ToolActionSnapshot {
  const snapshots = JSON.parse(row.file_snapshots) as Array<{
    id: string;
    filePath: string;
    content: string;
    checksum: string;
    fileSize: number;
    lastModified: string;
    snapshotTime: string;
    existed?: boolean;
    metadata?: Record<string, unknown>;
  }>;

  return {
    actionId: row.action_id,
    toolName: row.tool_name,
    snapshots: snapshots.map(s => ({
      ...s,
      lastModified: new Date(s.lastModified),
      snapshotTime: new Date(s.snapshotTime),
      existed: s.existed ?? true,
    })),
    timestamp: new Date(row.created_at),
    description: row.description || undefined,
    canUndo: Boolean(row.can_undo),
  };
}
```

## References

- Existing schema: `packages/orchestrator/src/store.ts` (lines 419-493)
- ToolActionSnapshot type: `packages/core/src/types.ts` (lines 671-685)
- FileSnapshot type: `packages/core/src/types.ts` (lines 592-616)
- ToolActionStore implementation: `packages/orchestrator/src/store.ts` (lines 3071-3484)
