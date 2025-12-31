# ADR 0005: PermissionStore Architecture for SQLite Persistence

## Status

Proposed

## Context

APEX agents use tools to perform various operations (file system access, shell commands, web requests, etc.). User permission decisions about whether agents can use specific tools need to be persisted across sessions. Currently, the `Permission` type is defined in `@apex/core` (packages/core/src/types.ts, lines 74-109), but there is no persistence layer.

The existing `TaskStore` class in `@apex/orchestrator` provides an excellent pattern for SQLite-based persistence using `better-sqlite3`.

### Existing Types in @apex/core

```typescript
// PermissionLevel: 'allow-always' | 'allow-once' | 'deny'
export const PermissionLevelSchema = z.enum([
  'allow-always',  // Permanently allow the tool/scope combination
  'allow-once',    // Allow for a single invocation only
  'deny',          // Deny the tool/scope combination
]);

// Permission record structure
export const PermissionSchema = z.object({
  tool: z.string().min(1, 'Tool name is required'),
  scope: z.string().optional(),
  level: PermissionLevelSchema,
  expiry: z.date().optional(),
  createdAt: z.date(),
});

// Query parameters for looking up permissions
export const PermissionQuerySchema = z.object({
  tool: z.string().min(1, 'Tool name is required'),
  scope: z.string().optional(),
});
```

## Decision

We will implement a `PermissionStore` class in `@apex/orchestrator` following the same patterns as `TaskStore`:

### 1. Database Schema

Create a `permissions` table in the existing `apex.db` SQLite database:

```sql
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  scope TEXT,
  level TEXT NOT NULL CHECK (level IN ('allow-always', 'allow-once', 'deny')),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(tool_name, scope)
);

CREATE INDEX IF NOT EXISTS idx_permissions_tool_name ON permissions(tool_name);
CREATE INDEX IF NOT EXISTS idx_permissions_expires ON permissions(expires_at);
```

Key design decisions:
- Use INTEGER PRIMARY KEY for `id` (SQLite optimization for rowid alias)
- `tool_name` is NOT NULL as it's always required
- `scope` is nullable (NULL means "all scopes" or "global permission")
- Use UNIQUE constraint on (tool_name, scope) to ensure one permission per tool/scope combo
- Store dates as ISO8601 TEXT for consistency with TaskStore

### 2. Class Interface

```typescript
export class PermissionStore {
  private db!: Database.Database;
  private dbPath: string;
  private projectPath: string;

  constructor(projectPath: string);

  // Lifecycle
  async initialize(): Promise<void>;
  close(): void;

  // CRUD Operations
  async savePermission(permission: Omit<Permission, 'createdAt'>): Promise<Permission>;
  async getPermission(query: PermissionQuery): Promise<Permission | null>;
  async listPermissions(options?: {
    tool?: string;
    level?: PermissionLevel;
    includeExpired?: boolean;
  }): Promise<Permission[]>;
  async clearPermissions(options?: { tool?: string }): Promise<number>;
  async clearExpired(): Promise<number>;

  // Convenience methods
  async hasValidPermission(query: PermissionQuery): Promise<boolean>;
  async isAllowed(query: PermissionQuery): Promise<boolean>;
  async isDenied(query: PermissionQuery): Promise<boolean>;
}
```

### 3. Integration with Existing Infrastructure

The `PermissionStore` will:
- Share the same database file (`.apex/apex.db`) as `TaskStore`
- Be instantiated and managed by `ApexOrchestrator`
- Use the same migration pattern as `TaskStore` to add the table on initialization
- Export from `@apex/orchestrator` package index

### 4. Permission Matching Logic

When looking up permissions with `getPermission()`:
1. First, check for exact match (tool + scope)
2. If no exact match and scope is provided, check for global permission (tool + NULL scope)
3. Respect expiry dates - expired permissions should not match

### 5. Scope Pattern Matching (Future Enhancement)

For initial implementation, scope matching will be exact. Future versions may support:
- Glob patterns for file paths (e.g., `src/**/*.ts`)
- Regex patterns for command matching
- Hierarchical scopes

### 6. Database Migration Strategy

Add migration in `TaskStore.runMigrations()` or as separate migration in `PermissionStore.initialize()`:

```typescript
private createTables(): void {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_name TEXT NOT NULL,
      scope TEXT,
      level TEXT NOT NULL CHECK (level IN ('allow-always', 'allow-once', 'deny')),
      expires_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(tool_name, scope)
    );

    CREATE INDEX IF NOT EXISTS idx_permissions_tool_name ON permissions(tool_name);
    CREATE INDEX IF NOT EXISTS idx_permissions_expires ON permissions(expires_at);
  `);
}
```

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     ApexOrchestrator                          │
│                                                               │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────┐  │
│  │  TaskStore  │    │ PermissionStore │    │  WorkTree    │  │
│  │             │    │                 │    │   Manager    │  │
│  └──────┬──────┘    └────────┬────────┘    └──────────────┘  │
│         │                    │                                │
│         └────────────────────┴────────────────────────────────│
│                              │                                │
└──────────────────────────────│────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   .apex/apex.db      │
                    │  ┌────────────────┐  │
                    │  │     tasks      │  │
                    │  ├────────────────┤  │
                    │  │  permissions   │  │
                    │  ├────────────────┤  │
                    │  │   task_logs    │  │
                    │  ├────────────────┤  │
                    │  │     gates      │  │
                    │  ├────────────────┤  │
                    │  │     ...        │  │
                    │  └────────────────┘  │
                    └──────────────────────┘
```

## Consequences

### Positive
- **Consistent patterns**: Follows established patterns from `TaskStore`
- **Single database**: All persistence in one SQLite database
- **Type safety**: Full TypeScript typing with Zod validation
- **Efficient queries**: Proper indexing for common lookups
- **Session persistence**: Permissions survive restarts
- **Expiry support**: Built-in support for time-limited permissions

### Negative
- **Shared database locking**: Multiple stores accessing same DB could cause contention
- **Migration complexity**: Adding new table requires migration logic
- **Scope matching limitations**: Initial implementation is exact-match only

### Risks
- **Stale permissions**: `allow-once` permissions that weren't consumed need cleanup
- **Database corruption**: SQLite file issues could affect all stores

## Implementation Notes

### File Structure
```
packages/orchestrator/src/
├── store.ts                    # Existing TaskStore
├── permission-store.ts         # New PermissionStore
├── permission-store.test.ts    # Unit tests
└── index.ts                    # Export PermissionStore
```

### Key Implementation Details

1. **Upsert behavior for savePermission()**: Use `INSERT OR REPLACE` to update existing permissions for the same tool/scope combination.

2. **NULL scope handling**: In SQLite, `NULL != NULL`, so use `IS` comparison:
   ```sql
   WHERE tool_name = ? AND (scope IS ? OR scope IS NULL)
   ```

3. **Expired permission cleanup**: `clearExpired()` deletes records where `expires_at < datetime('now')`

4. **allow-once consumption**: After a permission is used, it should be deleted (handled by the caller, not the store)

### Test Coverage Requirements

Unit tests should cover:
- Basic CRUD operations
- Upsert behavior (update existing permission)
- Scope matching (exact and global fallback)
- Expiry handling (expired permissions not returned)
- `clearPermissions()` with and without tool filter
- `clearExpired()` removes only expired records
- Edge cases: NULL scope, empty scope string

## Alternatives Considered

### 1. Separate Database File
Store permissions in `.apex/permissions.db` instead of sharing `apex.db`.
- **Rejected**: Adds complexity, no significant benefit

### 2. JSON File Storage
Store permissions in `.apex/permissions.json`.
- **Rejected**: Less efficient for queries, no transactional guarantees

### 3. In-Memory Only with Periodic Flush
Keep permissions in memory, periodically save to disk.
- **Rejected**: Risk of data loss, complexity of sync

## References

- Existing `TaskStore` implementation: `packages/orchestrator/src/store.ts`
- Permission types: `packages/core/src/types.ts` (lines 74-109)
- better-sqlite3 documentation: https://github.com/WiseLibs/better-sqlite3
