# ADR-003: Extended Permission Store for Per-Tool and Directory Permissions

## Status

**Proposed**

## Context

APEX v0.5.0 introduces enhanced permission management capabilities with `ExtendedPermission`, `ToolPermissionConfig`, and `DirectoryAccessConfig` schemas (defined in `@apexcli/core`). The current `PermissionStore` in `packages/orchestrator/src/permission-store.ts` only persists basic permission data:

```sql
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  scope TEXT,
  level TEXT NOT NULL CHECK (level IN ('allow-always', 'allow-once', 'deny')),
  expires_at TEXT,
  created_at TEXT NOT NULL
);
```

This schema lacks support for:

1. **Per-tool configuration** (`ToolPermissionConfig`) - timeout, rate limits, enabled state, etc.
2. **Directory access control** (`DirectoryAccessConfig`) - allowlist/blocklist patterns, max depth, etc.
3. **Extended metadata** - grant reason, granted by, tags for categorization

### Requirements

Per acceptance criteria:
- New database columns/tables for `tool_config` and `directory_access`
- Migration runs successfully on existing databases
- CRUD operations extended to handle new permission structures
- Existing tests continue to pass
- Full backward compatibility with existing permissions

## Decision

We will extend the `PermissionStore` with new columns and a separate table to persist extended permission data while maintaining full backward compatibility.

### Database Schema Design

#### Option 1: JSON Column Extension (Recommended)

Add JSON columns to the existing `permissions` table:

```sql
-- Migration: Add extended permission columns
ALTER TABLE permissions ADD COLUMN config TEXT;          -- JSON: ToolPermissionConfig
ALTER TABLE permissions ADD COLUMN grant_reason TEXT;
ALTER TABLE permissions ADD COLUMN granted_by TEXT;
ALTER TABLE permissions ADD COLUMN tags TEXT;            -- JSON array
ALTER TABLE permissions ADD COLUMN directory_access TEXT; -- JSON: DirectoryAccessConfig (denormalized for convenience)
```

**Rationale:**
- SQLite has excellent JSON support via JSON1 extension
- Simpler queries for common operations
- Backward compatible - existing rows have NULL for new columns
- Tool configs are variable structure (union type), JSON handles this well
- Avoids complex joins for simple permission lookups

#### Option 2: Separate Tables (Alternative)

```sql
-- New table for tool configuration
CREATE TABLE permission_tool_configs (
  permission_id TEXT PRIMARY KEY REFERENCES permissions(id) ON DELETE CASCADE,
  enabled INTEGER DEFAULT 1,
  timeout INTEGER DEFAULT 0,
  require_confirmation INTEGER DEFAULT 0,
  rate_limit_per_minute INTEGER DEFAULT 0,
  metadata TEXT,                    -- JSON object
  tool_type TEXT,                   -- 'filesystem' | 'shell' | 'web' | 'search' | 'base'
  config_json TEXT,                 -- Full tool-specific config as JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- New table for directory access configuration
CREATE TABLE permission_directory_access (
  permission_id TEXT PRIMARY KEY REFERENCES permissions(id) ON DELETE CASCADE,
  allowlist TEXT,                   -- JSON array
  blocklist TEXT,                   -- JSON array
  default_allow INTEGER,            -- 0 or 1
  resolve_symlinks INTEGER DEFAULT 1,
  max_depth INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_permission_tool_configs_type ON permission_tool_configs(tool_type);
CREATE INDEX idx_permission_directory_access_permission ON permission_directory_access(permission_id);
```

**This option is NOT recommended** because:
- Adds complexity with multiple table joins
- Tool configs are typically loaded together with permissions
- SQLite foreign keys add overhead
- Harder to ensure atomicity

### Recommended Schema: Option 1 with Enhanced Indexes

```sql
-- Extend existing permissions table
ALTER TABLE permissions ADD COLUMN config TEXT;
ALTER TABLE permissions ADD COLUMN grant_reason TEXT;
ALTER TABLE permissions ADD COLUMN granted_by TEXT;
ALTER TABLE permissions ADD COLUMN tags TEXT;

-- Add functional indexes for JSON querying (SQLite 3.38+)
CREATE INDEX IF NOT EXISTS idx_permissions_enabled
  ON permissions(json_extract(config, '$.enabled')) WHERE config IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_permissions_granted_by
  ON permissions(granted_by) WHERE granted_by IS NOT NULL;
```

### Migration Strategy

The migration will be added to the existing `runMigrations()` method:

```typescript
private runMigrations(): void {
  // ... existing migration logic ...

  // v0.5.0 Extended Permission Migration
  const migrations: { column: string; definition: string }[] = [
    { column: 'config', definition: 'TEXT' },
    { column: 'grant_reason', definition: 'TEXT' },
    { column: 'granted_by', definition: 'TEXT' },
    { column: 'tags', definition: 'TEXT' },
  ];

  for (const { column, definition } of migrations) {
    if (!columnNames.has(column)) {
      try {
        this.db.exec(`ALTER TABLE permissions ADD COLUMN ${column} ${definition}`);
      } catch {
        // Column might already exist
      }
    }
  }
}
```

### Updated Row Interface

```typescript
interface PermissionRow {
  id: string;
  tool_name: string;
  scope: string | null;
  level: string;
  expires_at: string | null;
  created_at: string;
  // New v0.5.0 fields
  config: string | null;          // JSON: ToolPermissionConfig
  grant_reason: string | null;
  granted_by: string | null;
  tags: string | null;            // JSON: string[]
}
```

### Extended CRUD Operations

#### 1. Save Extended Permission

```typescript
async saveExtendedPermission(permission: ExtendedPermission): Promise<void> {
  const id = this.generatePermissionId(permission.tool, permission.scope);

  const stmt = this.db.prepare(`
    INSERT INTO permissions (
      id, tool_name, scope, level, expires_at, created_at,
      config, grant_reason, granted_by, tags
    )
    VALUES (
      @id, @toolName, @scope, @level, @expiresAt, @createdAt,
      @config, @grantReason, @grantedBy, @tags
    )
    ON CONFLICT(id) DO UPDATE SET
      level = @level,
      expires_at = @expiresAt,
      created_at = @createdAt,
      config = @config,
      grant_reason = @grantReason,
      granted_by = @grantedBy,
      tags = @tags
  `);

  stmt.run({
    id,
    toolName: permission.tool,
    scope: permission.scope || null,
    level: permission.level,
    expiresAt: permission.expiry ? permission.expiry.toISOString() : null,
    createdAt: permission.createdAt.toISOString(),
    config: permission.config ? JSON.stringify(permission.config) : null,
    grantReason: permission.grantReason || null,
    grantedBy: permission.grantedBy || null,
    tags: permission.tags && permission.tags.length > 0
      ? JSON.stringify(permission.tags)
      : null,
  });
}
```

#### 2. Get Extended Permission

```typescript
async getExtendedPermission(query: PermissionQuery): Promise<ExtendedPermission | null> {
  const stmt = this.db.prepare(`
    SELECT * FROM permissions
    WHERE tool_name = ? AND scope IS ?
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const row = stmt.get(query.tool, query.scope || null) as ExtendedPermissionRow | undefined;

  if (!row) return null;

  // Check expiry
  if (row.expires_at) {
    const expiryDate = new Date(row.expires_at);
    if (new Date() > expiryDate) {
      await this.clearExpiredPermission(row.id);
      return null;
    }
  }

  return this.rowToExtendedPermission(row);
}

private rowToExtendedPermission(row: ExtendedPermissionRow): ExtendedPermission {
  const base: ExtendedPermission = {
    tool: row.tool_name,
    scope: row.scope || undefined,
    level: row.level as PermissionLevel,
    expiry: row.expires_at ? new Date(row.expires_at) : undefined,
    createdAt: new Date(row.created_at),
    tags: [],
  };

  // Parse extended fields
  if (row.config) {
    try {
      base.config = JSON.parse(row.config) as ToolPermissionConfig;
    } catch {
      // Invalid JSON, ignore config
    }
  }

  if (row.grant_reason) {
    base.grantReason = row.grant_reason;
  }

  if (row.granted_by) {
    base.grantedBy = row.granted_by;
  }

  if (row.tags) {
    try {
      base.tags = JSON.parse(row.tags) as string[];
    } catch {
      base.tags = [];
    }
  }

  return base;
}
```

#### 3. List with Extended Filters

```typescript
async listExtendedPermissions(options?: {
  tool?: string;
  level?: PermissionLevel;
  grantedBy?: string;
  tags?: string[];
  includeExpired?: boolean;
  hasConfig?: boolean;
}): Promise<ExtendedPermission[]> {
  let sql = 'SELECT * FROM permissions';
  const params: unknown[] = [];
  const whereClauses: string[] = [];

  if (options?.tool) {
    whereClauses.push('tool_name = ?');
    params.push(options.tool);
  }

  if (options?.level) {
    whereClauses.push('level = ?');
    params.push(options.level);
  }

  if (options?.grantedBy) {
    whereClauses.push('granted_by = ?');
    params.push(options.grantedBy);
  }

  if (options?.hasConfig === true) {
    whereClauses.push('config IS NOT NULL');
  } else if (options?.hasConfig === false) {
    whereClauses.push('config IS NULL');
  }

  // Tag filtering using JSON
  if (options?.tags && options.tags.length > 0) {
    // Match any of the provided tags
    const tagConditions = options.tags.map(() =>
      `json_each.value = ?`
    ).join(' OR ');
    whereClauses.push(`EXISTS (
      SELECT 1 FROM json_each(tags) WHERE ${tagConditions}
    )`);
    params.push(...options.tags);
  }

  if (!options?.includeExpired) {
    whereClauses.push('(expires_at IS NULL OR expires_at > ?)');
    params.push(new Date().toISOString());
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC';

  const stmt = this.db.prepare(sql);
  const rows = stmt.all(...params) as ExtendedPermissionRow[];

  return rows.map(row => this.rowToExtendedPermission(row));
}
```

### Directory Access Convenience Methods

Since `DirectoryAccessConfig` is embedded in `ToolPermissionConfig`, we provide helper methods:

```typescript
/**
 * Get directory access configuration for a tool permission
 */
async getDirectoryAccess(
  query: PermissionQuery
): Promise<DirectoryAccessConfig | null> {
  const permission = await this.getExtendedPermission(query);

  if (!permission?.config) return null;

  // Extract directoryAccess from the appropriate config type
  if ('directoryAccess' in permission.config) {
    return permission.config.directoryAccess || null;
  }

  return null;
}

/**
 * Update directory access configuration for an existing permission
 */
async updateDirectoryAccess(
  query: PermissionQuery,
  directoryAccess: DirectoryAccessConfig
): Promise<boolean> {
  const permission = await this.getExtendedPermission(query);

  if (!permission) return false;

  // Create or update the config with new directory access
  const config = permission.config || {};
  const updatedConfig = { ...config, directoryAccess };

  await this.saveExtendedPermission({
    ...permission,
    config: updatedConfig as ToolPermissionConfig,
  });

  return true;
}
```

### Backward Compatibility

The design ensures full backward compatibility:

1. **Existing `savePermission()`** - Continues to work; new columns get NULL
2. **Existing `getPermission()`** - Returns `Permission` type (subset of `ExtendedPermission`)
3. **New `saveExtendedPermission()`** - Handles full `ExtendedPermission` type
4. **New `getExtendedPermission()`** - Returns `ExtendedPermission` with all fields

```typescript
// Existing method (unchanged signature)
async savePermission(permission: Permission): Promise<void> {
  // Delegates to extended version, with optional fields as undefined
  await this.saveExtendedPermission({
    ...permission,
    tags: [],
  });
}

// Existing method (unchanged signature, returns subset type)
async getPermission(query: PermissionQuery): Promise<Permission | null> {
  const extended = await this.getExtendedPermission(query);
  if (!extended) return null;

  // Return only base Permission fields for backward compat
  return {
    tool: extended.tool,
    scope: extended.scope,
    level: extended.level,
    expiry: extended.expiry,
    createdAt: extended.createdAt,
  };
}
```

### Data Validation

All JSON data is validated using Zod schemas on read:

```typescript
import {
  ToolPermissionConfigSchema,
  DirectoryAccessConfigSchema,
} from '@apexcli/core';

private parseToolConfig(json: string): ToolPermissionConfig | undefined {
  try {
    const parsed = JSON.parse(json);
    const result = ToolPermissionConfigSchema.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
```

## Consequences

### Positive

1. **Full Extended Permission Support**: Persists all v0.5.0 permission features
2. **Backward Compatible**: Existing code and data work unchanged
3. **Simple Migration**: Single ALTER TABLE statements, no data transformation
4. **Flexible JSON Storage**: Handles variable tool config structures
5. **Query Performance**: Indexed columns for common filters
6. **Zod Validation**: Runtime type safety on read

### Negative

1. **JSON Query Complexity**: Some queries require JSON functions
2. **No Foreign Key Integrity**: JSON blobs can't have referential constraints
3. **Serialization Overhead**: JSON parse/stringify on every operation

### Risks

1. **Large JSON Blobs**: Tool configs with many settings could grow large
   - Mitigation: Monitor blob sizes, add size limits if needed

2. **Schema Evolution**: Future ToolPermissionConfig changes require migration
   - Mitigation: Schema versioning in JSON, graceful unknown field handling

3. **SQLite JSON1 Dependency**: Requires SQLite with JSON1 extension
   - Mitigation: JSON1 is compiled in by default since SQLite 3.38.0 (2022)

## Implementation Plan

### Phase 1: Schema Extension
1. Add migration logic for new columns
2. Update `PermissionRow` interface
3. Add `ExtendedPermissionRow` interface

### Phase 2: Extended CRUD
1. Implement `saveExtendedPermission()`
2. Implement `getExtendedPermission()`
3. Implement `listExtendedPermissions()` with filters

### Phase 3: Directory Access Helpers
1. Implement `getDirectoryAccess()`
2. Implement `updateDirectoryAccess()`
3. Add convenience methods for common patterns

### Phase 4: Testing
1. Add migration tests (existing DB, fresh DB)
2. Add extended permission CRUD tests
3. Add directory access tests
4. Verify existing tests still pass

## Test Plan

### Unit Tests
- Migration adds columns correctly
- JSON serialization/deserialization works
- Zod validation catches invalid configs
- Backward compatible methods work unchanged

### Integration Tests
- Full extended permission lifecycle
- Directory access configuration workflow
- Tag-based filtering
- Concurrent access safety

### Regression Tests
- All existing PermissionStore tests pass unchanged
- Performance benchmarks show acceptable overhead

## References

- Core types: `packages/core/src/types.ts` (ExtendedPermission, ToolPermissionConfig, DirectoryAccessConfig)
- ADR-0001: Per-Tool Permission Configuration Schema
- Existing store: `packages/orchestrator/src/permission-store.ts`
- Existing tests: `packages/orchestrator/src/__tests__/permission-store.test.ts`
